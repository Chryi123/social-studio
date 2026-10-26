"""Opt-in Reddit Data API integration for Social Studio (local desktop only).

OAuth access is conditional on Reddit-granted API access, explicitly attested by
user. OAuth tokens and approved drafts are held in memory only (restart clears).
No scraping, no bulk posting, no unsolicited outreach, no background publishing.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import date as Date
from urllib.error import HTTPError, URLError

ALLOWED_TIMES = {'day','week','month','year','all'}
RE_SUB = re.compile(r'^[A-Za-z0-9_]{2,23}$')
RE_TITLE = re.compile(r'(?s).{1,300}$')
API_BASE = 'https://oauth.reddit.com'
AUTH_URL = 'https://www.reddit.com/api/v1/authorize'
TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
README_UA = 'SocialStudioLocal/2.0 (owner-reviewed indie-game posts)'
USER_DATA_MAX = 25000

class RedditError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status=status


def subreddit(value):
    name=str(value or '').strip().removeprefix('r/').removeprefix('/r/')
    if not RE_SUB.fullmatch(name):
        raise RedditError('Subreddit non valido: usa r/NomeCommunity.',400)
    return name


def safe_web_url(url):
    u=urllib.parse.urlparse(str(url or ''))
    if u.scheme not in ('https','http') or not u.netloc:
        raise RedditError('URL non valido.',400)
    return url


class RedditService:
    def __init__(self, root, port):
        self.root=Path(root)
        self.port=port
        self.lock=threading.RLock()
        self.config_path=self.root/'reddit_config.json'
        self.config=self._read_config()
        self.access_token=None
        self.refresh_token=None
        self.expiry=0
        self.username=''
        self.auth_state=''
        self.auth_expiry=0
        self.drafts={}
        self.last_posts={}
        self.posts_log=self.root/'social_published.json'
        try:
            self.last_posts=json.loads(self.posts_log.read_text(encoding='utf-8'))
            if not isinstance(self.last_posts,dict):self.last_posts={}
        except (OSError,ValueError):self.last_posts={}
        self.csrf=secrets.token_urlsafe(28)

    @property
    def redirect(self): return f'http://127.0.0.1:{self.port}/reddit/callback'

    def _read_config(self):
        try:
            data=json.loads(self.config_path.read_text(encoding='utf-8'))
            return data if isinstance(data,dict) else {}
        except (FileNotFoundError,ValueError,OSError):return {}

    def save_config(self, data):
        client_id=str(data.get('client_id','')).strip()
        client_secret=str(data.get('client_secret','')).strip()
        user_agent=str(data.get('user_agent','')).strip()
        approved=data.get('api_access_approved') is True
        if not 8<=len(client_id)<=150 or not 8<=len(client_secret)<=500:
            raise RedditError('Inserisci Client ID e Client Secret reali dell’app Reddit autorizzata.')
        if not 12<=len(user_agent)<=200:
            raise RedditError('Inserisci uno User-Agent riconoscibile, per esempio windows:MySocialTool:v2.0 (by /u/tuoaccount).')
        if not approved:
            raise RedditError('Devi dichiarare che Reddit ha autorizzato l’uso previsto delle API, inclusa l’eventuale finalità commerciale.')
        config={'client_id':client_id,'client_secret':client_secret,'user_agent':user_agent,'api_access_approved':True}
        tmp=self.config_path.with_suffix('.json.tmp')
        tmp.write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
        try:os.chmod(tmp,0o600)
        except OSError:pass
        tmp.replace(self.config_path)
        with self.lock:
            self.config=config
            self.access_token=self.refresh_token=None
            self.username=''
            self.drafts.clear()
        return self.get_status()

    def get_status(self):
        with self.lock:
            return {'configured':bool(self.config.get('client_id') and self.config.get('client_secret') and self.config.get('api_access_approved')),
                    'approved_attested':bool(self.config.get('api_access_approved')),
                    'connected':bool(self.username and (self.access_token or self.refresh_token)),
                    'username':self.username,'redirect_uri':self.redirect,'csrf':self.csrf,
                    'note':'Autorizzazione Reddit soggetta ad approvazione API; la checkbox non conferisce permessi.'}

    def _require_config(self):
        if not self.get_status()['configured']:
            raise RedditError('Configura prima una app Reddit autorizzata.',403)

    def auth_start(self):
        self._require_config()
        with self.lock:
            self.auth_state=secrets.token_urlsafe(30)
            self.auth_expiry=time.monotonic()+600
            params={'client_id':self.config['client_id'],'response_type':'code','state':self.auth_state,
                    'redirect_uri':self.redirect,'duration':'temporary','scope':'identity read submit'}
            return {'url':AUTH_URL+'?'+urllib.parse.urlencode(params)}

    def _base_request(self, url, data=None, basic_auth=False, access_token=None, timeout=18):
        headers={'User-Agent':self.config.get('user_agent',README_UA),'Accept':'application/json'}
        if data is not None:headers['Content-Type']='application/x-www-form-urlencoded'
        if basic_auth:
            cred=(self.config['client_id']+':'+self.config['client_secret']).encode('utf-8')
            headers['Authorization']='Basic '+base64.b64encode(cred).decode('ascii')
        elif access_token:headers['Authorization']='bearer '+access_token
        req=urllib.request.Request(url, headers=headers, data=(urllib.parse.urlencode(data).encode('utf8') if data is not None else None))
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r:
                raw=r.read(1_000_000)
                return json.loads(raw.decode('utf8'))
        except HTTPError as e:
            body=e.read(500).decode('utf8','replace')
            raise RedditError('Reddit API HTTP '+str(e.code)+': '+body[:270], 502)
        except (URLError,TimeoutError,ValueError) as e:
            raise RedditError('Impossibile contattare Reddit: '+str(e)[:260],502)

    def callback(self, code, state, error):
        with self.lock:
            if not self.auth_state or time.monotonic()>self.auth_expiry or not hmac.compare_digest(str(state),self.auth_state):
                raise RedditError('Stato OAuth scaduto/non valido: ripeti il collegamento.')
            # One-time CSRF nonce.
            self.auth_state=''
            if error:raise RedditError('Reddit non ha autorizzato l’accesso: '+str(error)[:150])
            if not code:raise RedditError('Reddit non ha restituito un codice.')
        token=self._base_request(TOKEN_URL,{'grant_type':'authorization_code','code':code,'redirect_uri':self.redirect},basic_auth=True)
        if not token.get('access_token'):raise RedditError('Reddit non ha restituito un access token.',502)
        with self.lock:
            self.access_token=token['access_token']
            self.refresh_token=token.get('refresh_token') # duration temporary; generally none
            self.expiry=time.monotonic()+max(0,int(token.get('expires_in',3600))-60)
        me=self.call('/api/v1/me')
        with self.lock:self.username=str(me.get('name',''))
        if not self.username:raise RedditError('Non è stato possibile verificare l’account Reddit.',502)
        return self.username

    def call(self, path, params=None, form=None):
        if not self.access_token:
            raise RedditError('Account Reddit non collegato. Connettiti nuovamente.',401)
        with self.lock:
            if time.monotonic()>self.expiry:
                self.access_token=None
                self.username=''
                raise RedditError('Sessione Reddit scaduta: ricollega l’account. Le bozze non vengono pubblicate.',401)
            token=self.access_token
        url=API_BASE+path
        if params:url+='?'+urllib.parse.urlencode(params)
        return self._base_request(url,data=form,access_token=token)

    def top_posts(self, sub, window='month', query=''):
        sub=subreddit(sub)
        if window not in ALLOWED_TIMES:raise RedditError('Intervallo non valido.')
        query=str(query or '').strip().lower()[:100]
        if self.get_status()['connected'] is False:raise RedditError('Collega Reddit prima della ricerca.',401)
        listing=self.call('/r/'+sub+'/top',params={'t':window,'limit':50,'raw_json':1})
        posts=[]
        for row in (listing.get('data',{}).get('children',[]) if isinstance(listing,dict) else []):
            d=row.get('data',{})
            if not isinstance(d,dict) or d.get('stickied') or d.get('over_18'):continue
            text=str(d.get('selftext',''))[:500]
            title=str(d.get('title',''))[:300]
            url='https://www.reddit.com'+str(d.get('permalink',''))
            if not url.startswith('https://www.reddit.com/r/'):continue
            tags=[s for s in re.findall(r'[a-z\d]{3,}',query) if s not in {'the','and','for','game','horror','indie'}]
            relevance=sum(1 for term in tags if term in (title+' '+text).lower())
            posts.append({'title':title,'excerpt':text,'score':int(d.get('score',0)),
                'comments':int(d.get('num_comments',0)), 'upvote_ratio':d.get('upvote_ratio'),
                'created_utc':d.get('created_utc'),'subreddit':d.get('subreddit',sub),'url':url,
                'relevance':relevance,'is_self':d.get('is_self',False),'link_flair_text':d.get('link_flair_text')})
        if query:
            matches=[p for p in posts if p['relevance']>0]
            if matches:posts=sorted(matches,key=lambda p:(p['relevance'],p['score']),reverse=True)
        return {'subreddit':'r/'+sub,'window':window,'query':query,'posts':posts[:25],
                'sample_size':len(posts),'note':'Campione dei top post della community in questo periodo; non prova causalità o probabilità di successo. Nessuno scraping o pubblicazione.'}

    def community_rules(self,sub):
        sub=subreddit(sub)
        data=self.call('/r/'+sub+'/about/rules')
        return {'subreddit':'r/'+sub,
                'rules':[{'title':str(x.get('short_name',''))[:150], 'description':str(x.get('description',''))[:1600]}
                          for x in (data.get('rules',[]) if isinstance(data,dict) else [])]}

    def prepare(self,d):
        if not self.get_status()['connected']:raise RedditError('Connetti Reddit prima di preparare la pubblicazione.',401)
        sub=subreddit(d.get('subreddit'))
        title=str(d.get('title','')).strip()
        body=str(d.get('body','')).strip()
        if not title or len(title)>300 or len(title)<5:raise RedditError('Titolo obbligatorio: 5–300 caratteri.')
        if not body or len(body)>USER_DATA_MAX:raise RedditError('Corpo richiesto; massimo 25.000 caratteri per questa versione.')
        # Explicit manual permissions, no unattended mass posting.
        if d.get('reviewed_text') is not True or d.get('reviewed_rules') is not True or d.get('promo_permitted') is not True:
            raise RedditError('Conferma la revisione del testo, delle regole e l’ammissibilità dell’autopromozione.')
        if d.get('ai_disclosure_checked') is not True:
            raise RedditError('Controlla le regole sull’eventuale dichiarazione dell’IA usata.')
        if 'liminal' in (title+' '+body).lower() and any(t in (title+' '+body).lower() for t in ['faceless','employee','worker','blackout','lights go out']):
            if not any(t in (title+' '+body).lower() for t in ['upcoming','not in the demo','in development','not yet released','future level','non disponibile']):
                raise RedditError('Per Liminal specifica che il livello dei dipendenti non è ancora disponibile nella demo.')
        last_post=str(d.get('last_post','')).strip()
        gap_days=str(d.get('gap_days','')).strip()
        if last_post and gap_days:
            try:
                gap=int(gap_days)
                elapsed=(Date.today()-Date.fromisoformat(last_post)).days
                if gap<0 or gap>365:raise ValueError('Invalid gap')
                if elapsed<gap:
                    raise RedditError(f'Intervallo dichiarato non rispettato: {elapsed} giorni trascorsi, minimo {gap}.', 409)
            except RedditError:raise
            except (ValueError,OverflowError):raise RedditError('Data ultimo post / intervallo non validi.')
        # No recent identical/near identical posts by this tool.
        digest=hashlib.sha256((sub.lower()+'\n'+title.lower()+'\n'+body.lower()).encode('utf8')).hexdigest()
        if digest in self.last_posts:
            raise RedditError('Testo già pubblicato da Social Studio in questa sessione. Non ripubblicarlo.')
        draft_id=secrets.token_urlsafe(24)
        with self.lock:
            self.drafts[draft_id]={'sub':sub,'title':title,'body':body,'hash':digest,
                'created':time.monotonic(), 'state':'prepared'}
        return {'draft_id':draft_id,'subreddit':'r/'+sub,'title':title,'body':body,'expires_in_seconds':600,
                'confirm_phrase':'PUBBLICA IN r/'+sub,
                'notice':'Solo post di testo, pubblicazione singola mediante API OAuth. Nessuna pubblicazione programmata o in massa.'}

    def publish(self,d):
        key=str(d.get('draft_id',''))
        with self.lock:
            item=self.drafts.get(key)
            if not item:raise RedditError('Bozza non trovata: ripeti la revisione.')
            if time.monotonic()-item['created']>600:raise RedditError('Revisione scaduta: ripeti il controllo.')
            if item['state']!='prepared':raise RedditError('Questa bozza è già stata inviata o è in stato incerto. Non inviare di nuovo.')
            phrase='PUBBLICA IN r/'+item['sub']
            if d.get('typed_confirmation')!=phrase:
                raise RedditError('Digita esattamente '+phrase+' per confermare.')
            if d.get('final_confirm') is not True:
                raise RedditError('Conferma esplicitamente l’invio di questo singolo post.')
            item['state']='sending'  # Set BEFORE request to avoid double submission.
        try:
            result=self.call('/api/submit',form={'api_type':'json','kind':'self', 'sr':item['sub'],
                             'title':item['title'],'text':item['body'],'resubmit':'false','sendreplies':'true'})
        except RedditError as e:
            # Ambiguous failure: do not retry blindly and cause a duplicate.
            with self.lock:item['state']='unknown'
            raise RedditError(str(e)+' Non riprovare automaticamente: controlla prima i tuoi post Reddit.',e.status)
        data=(result.get('json') or {}) if isinstance(result,dict) else {}
        errors=data.get('errors') or []
        if errors:
            with self.lock:item['state']='blocked'
            raise RedditError('Reddit ha rifiutato la pubblicazione: '+str(errors)[:350],422)
        post=data.get('data') or {}
        url=post.get('url','')
        if not url and post.get('name'):
            url='https://www.reddit.com/'+str(post['name'])
        if not url:
            with self.lock:item['state']='unknown'
            raise RedditError('Reddit non ha confermato il link del post. Controlla il tuo profilo prima di riprovare.',502)
        if not url.startswith('https://www.reddit.com/') and not url.startswith('https://reddit.com/'):
            with self.lock:item['state']='unknown'
            raise RedditError('Reddit ha risposto con un indirizzo inatteso. Controlla il tuo profilo.',502)
        with self.lock:
            item['state']='published'
            self.last_posts[item['hash']]={'utc_timestamp':time.time(), 'subreddit':item['sub'], 'url':url}
            try:
                tmp=self.posts_log.with_suffix('.json.tmp')
                tmp.write_text(json.dumps(self.last_posts, ensure_ascii=False, indent=2),encoding='utf-8')
                try:os.chmod(tmp,0o600)
                except OSError:pass
                tmp.replace(self.posts_log)
            except OSError as exc:print('ATTENZIONE: impossibile salvare storico post:',exc)
        return {'success':True,'url':url,'subreddit':'r/'+item['sub'], 'title':item['title'],
                'note':'Pubblicato su Reddit dopo approvazione manuale del post.'}
