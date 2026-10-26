/* Social Studio 2: authorized comparison + single post after explicit manual review. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let csrf='', prepared=null, sending=false, username='';
const xs=['reddit-final-title','reddit-final-body','reddit-final-subreddit'];
const checks=['reddit-check-text','reddit-check-rules','reddit-check-promo','reddit-check-ai'];
function msg(text,err=false){$('reddit-message').className=err?'notice':'safe';$('reddit-message').textContent=text;}
function invalidate(){prepared=null;$('reddit-publication').classList.add('hidden');$('reddit-preview').innerHTML='';$('reddit-confirm-typed').value='';$('reddit-final-confirm').checked=false;}
function currentSub(){return $('reddit-subreddit').value.trim().replace(/^\/?r\//,'').replace(/^\//,'');}
async function getJSON(path){const r=await fetch(path,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Errore API');return d;}
async function post(path,data){
 if(!csrf)await connection();
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data)});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Errore API');return result;
}
async function connection(){
 const d=await getJSON('/api/reddit/status');csrf=d.csrf;username=d.username||'';
 const note=d.connected?`✓ Collegato: u/${d.username} (sessione temporanea)`:d.configured?'App configurata, account non collegato. Clicca “Collega il mio account Reddit”.':'Nessuna app Reddit autorizzata configurata.';
 $('reddit-connection').className=d.connected?'safe':'notice';$('reddit-connection').textContent=note;
 $('reddit-redirect').textContent=d.redirect_uri;
 return d;
}
async function configure(){
 try{
  const ok=$('reddit-approved').checked;
  const data={client_id:$('reddit-client-id').value.trim(),client_secret:$('reddit-client-secret').value.trim(),user_agent:$('reddit-agent').value.trim(),api_access_approved:ok};
  await post('/api/reddit/config',data);$('reddit-client-secret').value='';$('reddit-approved').checked=false;
  await connection();msg('Configurazione salvata solo sul tuo computer. Ora collega l’account Reddit.');
 }catch(e){msg(e.message,true)}
}
async function oauthStart(){
 try{const data=await post('/api/reddit/auth-start',{});window.open(data.url,'_blank','noopener,noreferrer');msg('Completa l’autorizzazione Reddit nella scheda aperta, poi premi “Verifica collegamento”.');}
 catch(e){msg(e.message,true)}
}
function postCard(p,i){
 const likes=Number(p.score||0).toLocaleString('it-IT');
 return `<article class="benchmark-post"><div class="row between"><b>${esc(p.title)}</b><span class="pill">${likes} punti</span></div>
 <div class="score">${Number(p.comments||0)} commenti · ${(p.upvote_ratio===null||p.upvote_ratio===undefined)?'nessun dato ratio':(100*Number(p.upvote_ratio)).toFixed(0)+'% upvote ratio'} · ${Number(p.relevance)||0} segnali attinenza</div>
 <p>${esc((p.excerpt||'').slice(0,300))}</p><a target="_blank" rel="noopener noreferrer" href="${esc(p.url)}">Apri il post originale</a>
 <button class="secondary" data-example="${i}" style="margin-left:6px">Aggiungi come riferimento per Qwen</button></article>`;
}
async function research(){
 const sub=currentSub();if(!sub){msg('Inserisci un subreddit valido.',true);return}
 $('reddit-benchmark').textContent='Lettura dei post Reddit autorizzati…';
 try{
  const data=await post('/api/reddit/top',{subreddit:sub,window:$('reddit-window').value,query:$('reddit-query').value});
  $('reddit-final-subreddit').value='r/'+sub;
  $('reddit-benchmark').innerHTML=`<h3>Confronto: ${esc(data.subreddit)} (${esc(data.window)})</h3><p class="reddit-compare-top">${data.sample_size} post nel campione selezionato · dati Reddit, non una previsione di risultati. I post non tematici possono comparire se nessun risultato corrisponde alla ricerca.</p>`+data.posts.map(postCard).join('');
  $('reddit-benchmark').querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{
    const p=data.posts[Number(b.dataset.example)];const prev=$('samples').value.trim();
    const text=`Post originale: ${p.url}\nTitolo: ${p.title}\nPunteggio: ${p.score}; commenti: ${p.comments}\nEstratto: ${p.excerpt}`;
    $('samples').value=(prev?prev+'\n\n':'')+text;
    $('samples').dispatchEvent(new Event('change',{bubbles:true}));
    b.textContent='Aggiunto ✓';msg('Post aggiunto ai riferimenti. Torna su “Crea contenuti” e rigenera le varianti: Qwen analizzerà gli esempi senza copiarli.');
  }));
 }catch(e){$('reddit-benchmark').textContent='';msg(e.message,true)}
}
async function rules(){
 const sub=currentSub();if(!sub){msg('Inserisci un subreddit.',true);return}
 $('reddit-rule-results').textContent='Lettura delle regole Reddit…';
 try{
  const d=await post('/api/reddit/rules',{subreddit:sub});
  $('reddit-rule-results').innerHTML='<h3>Regole ufficiali di '+esc(d.subreddit)+'</h3><div class="reddit-rules">'+(d.rules||[]).map(r=>`<div class="audit-box"><b>${esc(r.title)}</b><p>${esc(r.description)}</p></div>`).join('')+'</div>';
  const text=(d.rules||[]).map(r=>r.title+'\n'+r.description).join('\n\n').slice(0,5500);
  $('rules').value=text;$('rules').dispatchEvent(new Event('change',{bubbles:true}));
  msg('Regole importate per il confronto. Verifica anche gli avvisi e i post fissati dai moderatori: le regole non garantiscono che il tuo post sia ammissibile.');
 }catch(e){$('reddit-rule-results').textContent='';msg(e.message,true)}
}
function importDraft(){
 try{
  const result=JSON.parse(localStorage.getItem('social_studio_1_report')||'{}');const i=Number($('reddit-variant').value);
  const p=(result.posts||[])[i];if(!p)throw Error('Prima genera e salva un piano dalla scheda “Crea contenuti”.');
  if(result._meta?.platform!=='reddit')throw Error('Questa pubblicazione è solo per Reddit. Crea una variante Reddit.');
  $('reddit-final-title').value=p.title||'';$('reddit-final-body').value=p.body||'';
  $('reddit-final-subreddit').value=result._meta?.community||('r/'+currentSub());
  checks.forEach(id=>$(id).checked=false);invalidate();msg('Bozza importata. Ora modifica e rivedi il testo completo; nessuna pubblicazione è stata effettuata.');
 }catch(e){msg(e.message,true)}
}
async function prepare(){
 invalidate();
 const data={subreddit:$('reddit-final-subreddit').value,title:$('reddit-final-title').value,body:$('reddit-final-body').value,
  reviewed_text:$('reddit-check-text').checked, reviewed_rules:$('reddit-check-rules').checked,
  promo_permitted:$('reddit-check-promo').checked,ai_disclosure_checked:$('reddit-check-ai').checked,
  last_post:document.getElementById('last-post').value,gap_days:document.getElementById('gap').value};
 try{
  const p=await post('/api/reddit/prepare',data);prepared=p;
  $('reddit-preview').innerHTML=`<div class="approved-preview"><p><b>ANTEPRIMA ESATTA • ${esc(p.subreddit)}</b></p><h3>${esc(p.title)}</h3><pre>${esc(p.body)}</pre><p class="hint">Scade in 10 minuti. Questa azione NON ha ancora pubblicato nulla.</p></div>`;
  $('reddit-confirm-label').textContent=p.confirm_phrase;$('reddit-publication').classList.remove('hidden');
  msg('Anteprima preparata. Leggi attentamente il risultato. Pubblicazione solo con conferma finale.');
 }catch(e){msg(e.message,true)}
}
async function publish(){
 if(!prepared||sending){msg('Prepara nuovamente la bozza prima di pubblicare.',true);return}
 const data={draft_id:prepared.draft_id,typed_confirmation:$('reddit-confirm-typed').value,final_confirm:$('reddit-final-confirm').checked};
 if(!data.final_confirm||data.typed_confirmation!==prepared.confirm_phrase){msg('Spunta la conferma finale e digita la frase esatta.',true);return}
 if(!confirm(`Inviare ADESSO un solo post su ${prepared.subreddit} dall’account Reddit collegato?`))return;
 sending=true;$('reddit-publish').disabled=true;
 try{
  const d=await post('/api/reddit/publish',data);
  $('reddit-publication').classList.add('hidden');
  $('reddit-preview').innerHTML=`<div class="safe"><b>✓ Post pubblicato</b><p><a target="_blank" rel="noopener noreferrer" href="${esc(d.url)}">Apri il post Reddit</a></p></div>`;
  prepared=null;msg('Reddit ha confermato il post. Puoi registrare le metriche nella scheda “Misura i risultati”.');
 }catch(e){
  // In case the network response was ambiguous, the backend blocks blind retries.
  msg(e.message,true);$('reddit-publication').classList.add('hidden');prepared=null;
 }finally{sending=false;$('reddit-publish').disabled=false}
}
function init(){
 connection().catch(e=>msg('Server Reddit non disponibile: '+e.message,true));
 $('reddit-refresh').addEventListener('click',()=>connection().catch(e=>msg(e.message,true)));
 $('reddit-save-config').addEventListener('click',configure);$('reddit-connect').addEventListener('click',oauthStart);
 $('reddit-research').addEventListener('click',research);$('reddit-read-rules').addEventListener('click',rules);
 $('reddit-import').addEventListener('click',importDraft);$('reddit-prepare').addEventListener('click',prepare);
 $('reddit-publish').addEventListener('click',publish);
 $('reddit-manual').addEventListener('click',async()=>{
   try{
     const sub=$('reddit-final-subreddit').value.trim().replace(/^\/?r\//,'').replace(/^\//,'');
     if(!/^[A-Za-z0-9_]{2,23}$/.test(sub))throw Error('Indica un subreddit valido.');
     if(!$('reddit-final-title').value.trim())throw Error('Scrivi prima un titolo.');
     const body=$('reddit-final-title').value.trim()+'\n\n'+$('reddit-final-body').value.trim();
     if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(body);
     else {const txt=document.createElement('textarea');txt.value=body;document.body.appendChild(txt);txt.select();document.execCommand('copy');txt.remove();}
     window.open('https://www.reddit.com/r/'+sub+'/submit/','_blank','noopener,noreferrer');
     msg('Titolo e testo copiati. Incollali nel compositore Reddit e pubblica manualmente dopo aver letto le regole.');
   }catch(e){msg(e.message,true)}
 });
 $('reddit-reset-review').addEventListener('click',()=>{invalidate();checks.forEach(id=>$(id).checked=false);msg('Revisione azzerata; correggi il testo e prepara una nuova anteprima.');});
 xs.forEach(id=>$(id).addEventListener('input',invalidate));
 checks.forEach(id=>$(id).addEventListener('change',invalidate));
}
init();
})();
