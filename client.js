/* Social Studio v1 — local Ollama + manual posting/measurement.
   Videos processed locally; publish only with approved OAuth review. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const q = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='social_studio_1_settings',reportKey='social_studio_1_report',metricKey='social_studio_1_metrics';
let report=null, chosen=0, currentLanguage='en', busy=false;
let chosenVideoFrames=[], videoFrameList=[];
const langNames={en:'English',it:'Italiano',fr:'Français',de:'Deutsch',es:'Español','pt-BR':'Português (BR)',pl:'Polski',ja:'日本語',ko:'한국어','zh-CN':'简体中文',tr:'Türkçe',ru:'Русский'};
const fields=['game','platform','goal','community','rules','last-post','gap','angle','extra','samples','custom-name','custom-premise','custom-loop','custom-hook','custom-available','custom-planned'];
function safeRead(key, fallback) {try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch(e){return fallback}}
function safeSave(key,x){try{localStorage.setItem(key,JSON.stringify(x))}catch(e){/* blocked storage */}}
function copy(text){
 const content=String(text||'');
 if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(content);
 const tmp=document.createElement('textarea');tmp.value=content;document.body.appendChild(tmp);tmp.select();
 const copied=document.execCommand('copy');tmp.remove();return copied?Promise.resolve():Promise.reject(new Error('Copia non disponibile'));
}
function download(name,content,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function csv(rows){return '\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')}
function saveSettings(){let data={};for(const name of fields)data[name]=$(name).value;data.languages=selectedLangs();safeSave(storageKey,data)}
function loadSettings(){const d=safeRead(storageKey,{});for(const name of fields)if(d[name]!==undefined)$(name).value=d[name];if(Array.isArray(d.languages))document.querySelectorAll('#lang-choice input').forEach(x=>x.checked=d.languages.includes(x.value))}
function selectedLangs(){return [...document.querySelectorAll('#lang-choice input:checked')].map(x=>x.value)}
function tab(id){document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('main .tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+id));if(id==='week')renderWeek();if(id==='track')renderMetrics()}
function updateSections(){const game=$('game').value,platform=$('platform').value;$('custom-wrap').classList.toggle('hidden',game!=='custom');$('reddit-details').classList.toggle('hidden',platform!=='reddit');updateGate()}
function currentCommunity(){let x=$('community').value.trim().replace(/^\/*/,'');if(!x.startsWith('r/'))x='r/'+x;return /^r\/[A-Za-z0-9_]{2,23}$/.test(x)?x:''}
function rulesIndicateBan(rules){
 const r=rules.toLowerCase();
 return /\b(no|not allowed|prohibited|forbidden|vietat[oaie]|non consentit[oaie]|divieto di)\b.{0,90}\b(self[- ]?promo|promotion|promozione|autopromozione|steam links|link steam|marketing|advertis)/i.test(r)
 || /\b(self[- ]?promo|promotion|promozione|autopromozione|steam links|link steam|marketing|advertis).{0,65}\b(not allowed|prohibited|forbidden|vietat[oaie]|non consentit[oaie])\b/i.test(r);
}
function gateStatus(){
 if($('platform').value!=='reddit')return {level:'ok',text:'Per questo social verifica comunque termini, copyright, hashtag e requisiti della piattaforma.'};
 const name=currentCommunity();if(!name)return {level:'warn',text:'Non hai indicato un subreddit valido. Scegline uno e leggi le sue regole attuali.'};
 const rules=$('rules').value.trim();if(rulesIndicateBan(rules))return {level:'danger',text:'Il testo che hai inserito sembra vietare l’autopromozione o i link: NON pubblicare contenuti promozionali qui. Verifica le regole originali.'};
 const last=$('last-post').value;const gap=$('gap').value;
 if(last&&gap!==''&&Number(gap)>0){
  const diff=Math.floor((new Date().getTime()-new Date(last+'T00:00:00').getTime())/86400000);
  if(diff<Number(gap))return {level:'danger',text:`Hai indicato un intervallo di ${gap} giorni ma l’ultimo post risale a ${Math.max(0,diff)} giorni fa. Rimanda la pubblicazione e controlla la policy attuale.`};
 }
 if(!rules)return {level:'warn',text:`Regole di ${name} NON verificate. Apri le regole prima di postare: la frequenza ammessa e l’autopromozione dipendono dai moderatori.`};
 return {level:'warn',text:`Regole di ${name} incollate da te, NON verificate in tempo reale. Rileggile sul sito prima di pubblicare (soprattutto limiti e link).`};
}
function updateGate(){const gate=gateStatus(),e=$('rule-gate');e.className=gate.level==='ok'?'safe':'notice';e.innerHTML=`<b>Controllo prima del post:</b> ${q(gate.text)}`}
function linkRules(){const name=currentCommunity();if(!name){$('error').textContent='Inserisci un subreddit valido (es. r/IndieDev).';return;}window.open('https://www.reddit.com/'+name+'/about/rules/','_blank','noopener,noreferrer')}
function linkCommunity(){const name=currentCommunity();if(!name){$('error').textContent='Inserisci un subreddit valido.';return;}window.open('https://www.reddit.com/'+name+'/','_blank','noopener,noreferrer')}
async function check(){let e=$('status');e.textContent='Controllo Ollama…';try{
 const r=await fetch('/api/status',{cache:'no-store'});const data=await r.json();
 if(data.connected&&data.ready){e.innerHTML='<span class="ok">✓ Qwen 3.5 9B pronto</span> · Ollama locale';e.className='status'}
 else if(data.connected){e.textContent='Ollama attivo, ma qwen3.5:9b non trovato: esegui ollama list.';e.className='status warn'}
 else{e.textContent=data.error||'Ollama spento.';e.className='status warn'}
}catch(err){e.textContent='Server locale non disponibile: avvia AVVIA_SOCIAL_STUDIO.bat';e.className='status warn'}}
async function imagesBase64(){const files=[...$('images').files];if(files.length>4)throw new Error('Carica al massimo 4 immagini.');const output=[];for(const file of files){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Carica solo JPG, PNG o WebP.');
 const dataUrl=await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(new Error('Lettura immagine fallita'));f.readAsDataURL(file)});
 const image=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(new Error('Immagine non valida'));x.src=dataUrl});
 const scale=Math.min(1,1152/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#101820';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);output.push(canvas.toDataURL('image/jpeg',0.76).split(',')[1]);}
 return output;}
function params(){return {game:$('game').value,platform:$('platform').value,goal:$('goal').value,community:currentCommunity()||'',rules:$('rules').value,angle:$('angle').value,extra:$('extra').value,examples:$('samples').value,gate:{last_post:$('last-post').value,gap_days:$('gap').value}, custom:{name:$('custom-name').value,premise:$('custom-premise').value,core_loop:$('custom-loop').value,hook:$('custom-hook').value,available:$('custom-available').value,planned:$('custom-planned').value}}}
async function api(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});let json=await r.json();if(!r.ok)throw new Error(json.error||'Impossibile completare la richiesta');return json}
function setBusy(v,desc){busy=v;$('generate').disabled=v;$('translate').disabled=v||!report;$('generate').textContent=v?'Qwen sta lavorando…':'Genera 3 post e piano';if(desc)$('progress').textContent=desc}
async function generate(){if(busy)return;$('error').textContent='';const payload=params();if(payload.game==='custom'&&(!payload.custom.premise||!payload.custom.core_loop)){$('error').textContent='Per un gioco nuovo indica almeno Premessa e Core loop.';return;}
 if(payload.platform==='reddit'&&!payload.community){$('error').textContent='Inserisci una community Reddit (es. r/indiegames).';return;}
 try{setBusy(true,'Preparo i riferimenti e le immagini…');payload.images=[...chosenVideoFrames.map(f=>f.jpeg.split(',')[1]),...await imagesBase64()];if(payload.images.length>4)throw new Error('Massimo 4 fotogrammi/immagini in totale. Deseleziona un frame o rimuovi immagini manuali.');payload.video_frame_times=chosenVideoFrames.map(f=>f.name+' @ '+f.time.toFixed(1)+'s').join('; ');setBusy(true,'Analisi Qwen 9B in locale: tre proposte, scalette video e calendario.');const res=await api('/api/generate',payload);res.translations={};report=res;chosen=0;currentLanguage='en';safeSave(reportKey,res);renderReport();renderWeek();setBusy(false,'Piano pronto. Seleziona il post migliore e, se vuoi, traducilo.');}
 catch(e){$('error').textContent=e.message;setBusy(false,'Non completato. Controlla Ollama oppure riprova senza immagini.');}
}
function selectedPost(){return report?.posts?.[chosen]||null}
function outputPost(p,idx){
 const risks=Array.isArray(p.risk_notes)?p.risk_notes:[];
 return `<article class="post"><div class="row between"><span class="pill">Variante ${idx+1} · ${q(p.angle||'')}</span><button class="secondary" data-select="${idx}">${idx===chosen?'✓ Selezionata':'Scegli questa'}</button></div><h3>${q(p.title)}</h3><p class="copy">${q(p.body)}</p><div class="buttons"><button class="secondary" data-copy="${idx}">Copia titolo + testo</button></div><div class="inner"><b>Testo nel video:</b> ${q(p.overlay_text||'')}<p><b>Scaletta per la clip</b></p><ol>${(p.shotlist||[]).map(x=>`<li>${q(x)}</li>`).join('')}</ol></div><p><b>CTA:</b> ${q(p.suggested_cta||'')}</p><p class="hint"><b>Perché potrebbe funzionare:</b> ${q(p.why)}</p>${risks.length?`<div class="notice"><b>Prima di pubblicare:</b> ${risks.map(q).join(' · ')}</div>`:''}</article>`;
}
function renderReport(){if(!report)return;$('empty').classList.add('hidden');$('report').classList.add('ready');$('report-title').textContent='Piano: '+(report._meta?.game_name||'Gioco');$('report-model').textContent=report._meta?.model||'Qwen';$('strategy').textContent=report.strategy_summary||'';$('fit').textContent=report.community_fit||'Regole da controllare';$('hook').textContent=report.primary_hook||'';$('audience').textContent='Pubblico: '+(report.audience||'da definire');$('posts').innerHTML=(report.posts||[]).map(outputPost).join('');
 $('posts').querySelectorAll('button[data-select]').forEach(btn=>btn.addEventListener('click',()=>{chosen=Number(btn.dataset.select);currentLanguage='en';renderReport()}));
 $('posts').querySelectorAll('button[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const p=report.posts[Number(btn.dataset.copy)];try{await copy((p.title||'')+'\n\n'+(p.body||''));btn.textContent='Copiato ✓'}catch(e){$('error').textContent='Copia non consentita dal browser.'}}));
 $('avoid').innerHTML='<ul>'+(report.what_to_avoid||[]).map(x=>`<li>${q(x)}</li>`).join('')+'</ul>';
 $('measurement-tips').innerHTML='<ul>'+(report.metrics_to_track||[]).map(x=>`<li>${q(x)}</li>`).join('')+'</ul>';
 $('uncertainties').innerHTML='<ul>'+(report.uncertainties||[]).map(x=>`<li>${q(x)}</li>`).join('')+'</ul>';
 $('translate').disabled=busy||false;renderTranslations();}
function renderTranslations(){if(!report||!selectedPost())return;const key=String(chosen),existing=report.translations?.[key]||{};const base=selectedPost();const options=[{language_code:'en',language_name:'English',title:base.title,body:base.body,overlay_text:base.overlay_text,suggested_cta:base.suggested_cta},...Object.values(existing)];
 if(!options.find(p=>p.language_code===currentLanguage))currentLanguage='en';const data=options.find(p=>p.language_code===currentLanguage)||options[0];
 $('locale-tabs').innerHTML=options.map(p=>`<button class="secondary ${currentLanguage===p.language_code?'active':''}" data-locale="${q(p.language_code)}">${q(p.language_name||p.language_code)}</button>`).join('');
 $('locale-content').innerHTML=`<div class="audit-box"><b>${q(data.title)}</b><div class="copy" style="margin-top:8px">${q(data.body)}</div><p class="hint">Overlay: ${q(data.overlay_text||'')} · CTA: ${q(data.suggested_cta||'')}</p><div class="buttons"><button class="secondary" id="copy-locale">Copia questo testo</button></div>${(data.notes||[]).length?`<ul class="hint">${data.notes.map(n=>`<li>${q(n)}</li>`).join('')}</ul>`:''}</div>`;
 $('locale-tabs').querySelectorAll('[data-locale]').forEach(btn=>btn.addEventListener('click',()=>{currentLanguage=btn.dataset.locale;renderTranslations()}));
 $('copy-locale').addEventListener('click',async()=>{try{await copy((data.title||'')+'\n\n'+(data.body||''));$('copy-locale').textContent='Copiato ✓';}catch(e){$('error').textContent='Non è stato possibile copiare il testo.'}});
}
async function translate(){if(!report||busy)return;$('error').textContent='';const langs=selectedLangs();if(langs.length>6){$('error').textContent='Seleziona massimo 6 lingue per volta (una generazione Qwen per lingua).';return;}
 const key=String(chosen);report.translations ||= {};report.translations[key] ||= {};
 const needed=langs.filter(code=>!report.translations[key][code]);if(!needed.length){$('progress').textContent='Lingue selezionate già pronte. Seleziona un altro post o un’altra lingua.';return;}
 let failed=[];setBusy(true,'Generazione traduzioni in corso…');for(let i=0;i<needed.length;i++){const lang=needed[i];$('progress').textContent=`Qwen traduce ${lang} (${i+1}/${needed.length})…`;
 try{const res=await api('/api/translate',{language:lang,post:selectedPost()});report.translations[key][lang]=res;currentLanguage=lang;renderTranslations();safeSave(reportKey,report)}catch(e){failed.push(lang+': '+e.message)}}
 setBusy(false,failed.length?'Alcune traduzioni non riuscite, puoi riprovare quelle mancanti.':'Traduzioni disponibili.');if(failed.length)$('error').textContent='Non completate: '+failed.join(' | ');
}
function dayLabel(offset){const day=new Date();day.setHours(12,0,0,0);day.setDate(day.getDate()+offset);return day.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'short'})}
function renderWeek(){const target=$('weekly');if(!report){target.innerHTML='<div class="empty">Genera prima un piano.</div>';return;}
 const days=(report.weekly_plan||[]).filter(p=>Number.isInteger(p.day_offset)&&p.day_offset>=0&&p.day_offset<=6).sort((a,b)=>a.day_offset-b.day_offset);
 target.innerHTML=days.length?days.map(d=>`<div class="day"><div><b>${q(dayLabel(d.day_offset))}</b></div><div><b>${q(d.activity)}</b><p>${q(d.concept)}</p><p class="hint">Materiale: ${q(d.asset||'—')}</p><div class="notice">Prima di pubblicare: ${q(d.check_before_posting||'Verifica regole e contenuto.')}</div></div></div>`).join(''):'<div class="empty">Il modello non ha restituito un calendario completo. Rigenera il piano.</div>';
}
function reportExport(){if(report)download('social_studio_report.json',JSON.stringify(report,null,2),'application/json;charset=utf-8')}
function postsCsv(){if(!report)return;let rows=[['platform','game','community','variant','language','title','body','overlay','cta','risks']];
 report.posts.forEach((post,i)=>{rows.push([report._meta.platform,report._meta.game_name,report._meta.community,i+1,'en',post.title,post.body,post.overlay_text,post.suggested_cta,(post.risk_notes||[]).join(' | ')]);
 for(const l of Object.values(report.translations?.[String(i)]||{}))rows.push([report._meta.platform,report._meta.game_name,report._meta.community,i+1,l.language_code,l.title,l.body,l.overlay_text,l.suggested_cta,(l.notes||[]).join(' | ')])});
 download('social_studio_posts.csv',csv(rows),'text/csv;charset=utf-8')}
function weekCsv(){if(!report)return;const rows=[['day_offset','date','activity','concept','asset','prepublish_check']];for(const d of report.weekly_plan||[])rows.push([d.day_offset,dayLabel(d.day_offset),d.activity,d.concept,d.asset,d.check_before_posting]);download('social_studio_calendario.csv',csv(rows),'text/csv;charset=utf-8')}
function tracks(){return safeRead(metricKey,[])}
function metricVal(id){const v=$(id).value.trim();return v===''?null:Math.max(0,Number(v))}
function urlString(v){if(!v)return '';try{let u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.toString():''}catch(e){return ''}}
function addTrack(){const d=$('track-date').value;if(!d){alert('Inserisci una data.');return;}
 const url=$('track-url').value.trim();if(url&&!urlString(url)){alert('Il link non è un URL HTTP/HTTPS valido.');return;}
 const item={game:$('track-game').value,platform:$('track-platform').value,date:d,community:$('track-community').value.trim().slice(0,120),url:urlString(url),views:metricVal('track-views'),votes:metricVal('track-votes'),comments:metricVal('track-comments'),clicks:metricVal('track-clicks'),notes:$('track-notes').value.trim().slice(0,1000)};
 const data=tracks();data.push(item);safeSave(metricKey,data);renderMetrics()}
function renderMetrics(){const data=tracks();const total=x=>data.reduce((acc,p)=>acc+(typeof p[x]==='number'&&Number.isFinite(p[x])?p[x]:0),0),number=x=>Number(x).toLocaleString('it-IT');
 $('metric-cards').innerHTML=`<div class="metric"><strong>${data.length}</strong><small>Post registrati</small></div><div class="metric"><strong>${number(total('votes'))}</strong><small>Like / upvote rilevati</small></div><div class="metric"><strong>${number(total('clicks'))}</strong><small>Click tracciati inseriti</small></div>`;
 $('track-table').innerHTML=data.length?`<table><thead><tr><th>Data</th><th>Social</th><th>Gioco</th><th>Community</th><th>Viste</th><th>Like</th><th>Commenti</th><th>Click</th><th>Post</th></tr></thead><tbody>${data.slice().reverse().map(p=>`<tr><td>${q(p.date)}</td><td>${q(p.platform)}</td><td>${q(p.game)}</td><td>${q(p.community)}</td><td>${p.views??'—'}</td><td>${p.votes??'—'}</td><td>${p.comments??'—'}</td><td>${p.clicks??'—'}</td><td>${p.url?`<a target="_blank" rel="noopener noreferrer" href="${q(p.url)}">Apri</a>`:'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nessun post registrato. Inserisci i primi risultati qui a fianco.</div>';
}
function metricsCsv(){const rows=[['date','game','platform','community','url','views','votes','comments','clicks','notes'],...tracks().map(p=>['date','game','platform','community','url','views','votes','comments','clicks','notes'].map(k=>p[k]))];download('social_studio_metriche.csv',csv(rows),'text/csv;charset=utf-8')}
/* Client-only MP4/WebM frame extraction. Only selected JPEG frames reach Ollama. */
function videoFrameDownload(frame){const a=document.createElement('a');a.href=frame.jpeg;a.download=frame.name.replace(/[^a-z0-9_-]/gi,'_')+'_'+Math.round(frame.time)+'s.jpg';document.body.appendChild(a);a.click();a.remove();}
async function loadVideo(file) {
  const url=URL.createObjectURL(file), vid=document.createElement('video');
  vid.preload='auto';vid.muted=true;vid.playsInline=true;vid.src=url;
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Timeout apertura '+file.name)),16000);
      vid.onloadedmetadata=()=>{clearTimeout(timer);resolve()};
      vid.onerror=()=>{clearTimeout(timer);reject(new Error('Formato video non decodificabile: '+file.name))};
      vid.load();
    });
    if(!Number.isFinite(vid.duration)||vid.duration<=0)throw new Error('Durata video non valida: '+file.name);
    const interval=Number($('video-interval').value)||7;
    const times=[];
    for(let t=Math.min(1,vid.duration/2);t<vid.duration-0.25 && times.length<14;t+=interval)times.push(t);
    if(!times.length)times.push(vid.duration/2);
    const result=[];
    for(let i=0;i<times.length;i++){
      const t=times[i];
      $('video-state').textContent=`Analizzo ${file.name}: fotogramma ${i+1}/${times.length}`;
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{vid.removeEventListener('seeked',done);reject(new Error('Timeout ricerca fotogramma '+file.name))},12000);
        function done(){clearTimeout(timer);vid.removeEventListener('seeked',done);resolve()}
        vid.addEventListener('seeked',done,{once:true});vid.currentTime=t;
      });
      const ratio=Math.min(1,960/Math.max(vid.videoWidth,vid.videoHeight));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(vid.videoWidth*ratio));c.height=Math.max(1,Math.round(vid.videoHeight*ratio));
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(vid,0,0,c.width,c.height);
      const pix=ctx.getImageData(0,0,Math.min(c.width,240),Math.min(c.height,160)),v=pix.data;
      let avg=0,delta=0;
      for(let k=0;k<v.length;k+=16){const y=(v[k]+v[k+1]+v[k+2])/3;avg+=y;delta+=Math.abs(y-128)}
      const divisor=Math.ceil(v.length/16);avg/=divisor;delta/=divisor;
      result.push({id:file.name+'-'+i,name:file.name,time:t,jpeg:c.toDataURL('image/jpeg',0.73),score:avg>18&&avg<228?delta:0});
    }
    return result;
  }finally{vid.pause();vid.removeAttribute('src');vid.load();URL.revokeObjectURL(url)}
}
function renderVideoFrames(){
  $('video-selected').textContent=`${chosenVideoFrames.length} / 4 fotogrammi selezionati`;
  $('video-download').disabled=!chosenVideoFrames.length;
  $('video-use').disabled=!chosenVideoFrames.length;
  const gallery=$('video-gallery');
  if(!videoFrameList.length){gallery.innerHTML='<div class="video-empty">Nessun fotogramma estratto.</div>';return}
  gallery.innerHTML=videoFrameList.map((f,i)=>`<div><button type="button" class="video-frame ${chosenVideoFrames.includes(f)?'chosen':''}" data-vindex="${i}" aria-pressed="${chosenVideoFrames.includes(f)}"><img loading="lazy" src="${f.jpeg}" alt="Fotogramma di ${q(f.name)} al secondo ${f.time.toFixed(1)}"><small>${q(f.name)} · ${f.time.toFixed(1)}s</small><span>${chosenVideoFrames.includes(f)?'✓ Selezionato':'Seleziona per Qwen'}</span></button><button type="button" class="secondary" data-vsave="${i}" style="width:100%;margin-top:5px">Scarica JPG</button></div>`).join('');
  gallery.querySelectorAll('[data-vindex]').forEach(button=>{
    button.addEventListener('click',(e)=>{
      const f=videoFrameList[Number(button.dataset.vindex)];
      if(chosenVideoFrames.includes(f))chosenVideoFrames=chosenVideoFrames.filter(x=>x!==f);
      else if(chosenVideoFrames.length>=4){$('video-state').textContent='Sono selezionabili al massimo 4 fotogrammi per Qwen. Deselezionane uno.';return}
      else chosenVideoFrames.push(f);
      renderVideoFrames();
    });
  });
  gallery.querySelectorAll('[data-vsave]').forEach(button=>button.addEventListener('click',()=>videoFrameDownload(videoFrameList[Number(button.dataset.vsave)])));
}
async function extractVideos(){
  const files=Array.from($('video-files').files);
  if(!files.length||files.length>2){$('video-state').textContent='Seleziona 1 o 2 file video.';return}
  if(files.some(f=>!(/\.(mp4|webm|mov)$/i).test(f.name))){$('video-state').textContent='Carica MP4, WebM o MOV.';return}
  $('video-extract').disabled=true;videoFrameList=[];chosenVideoFrames=[];renderVideoFrames();
  try{
    for(const f of files)videoFrameList.push(...await loadVideo(f));
    // Select up to 4 candidates spread across clips; all choices remain editable.
    const perClip=Math.max(1,Math.floor(4/files.length));
    for(const file of files){
      const candidates=videoFrameList.filter(f=>f.name===file.name);
      const picks=candidates.filter(f=>f.score>0).sort((a,b)=>b.score-a.score);
      for(const f of picks.slice(0,perClip))if(!chosenVideoFrames.includes(f)&&chosenVideoFrames.length<4)chosenVideoFrames.push(f);
    }
    $('video-state').textContent=`Estratti ${videoFrameList.length} fotogrammi da ${files.length} video. Selezione iniziale automatica: controllala e correggila prima di generare il post.`;
    renderVideoFrames();
  }catch(e){$('video-state').textContent='Errore: '+e.message;renderVideoFrames();}
  finally{$('video-extract').disabled=false}
}
function setupVideos(){
  $('video-extract').addEventListener('click',extractVideos);
  $('video-files').addEventListener('change',()=>{videoFrameList=[];chosenVideoFrames=[];renderVideoFrames();$('video-state').textContent='Pronto per estrarre i fotogrammi.'});
  $('video-download').addEventListener('click',()=>chosenVideoFrames.forEach((frame,i)=>setTimeout(()=>videoFrameDownload(frame),i*180)));
  $('video-use').addEventListener('click',()=>{
    $('game').value=$('video-game').value;
    $('platform').value='reddit';
    $('angle').value='Spunto da gameplay reale: chiedere quale dettaglio sembra cambiato o fuori posto, senza inventare anomalie non visibili. I fotogrammi sono immagini campionate nel tempo e NON provano da soli le modifiche.';
    const newNote=chosenVideoFrames.map(f=>`${f.name} ${f.time.toFixed(1)}s`).join('; ');
    $('extra').value=`Video caricati dallo sviluppatore; frame analizzati: ${newNote}. Non affermare di aver esaminato il video completo. Evita di affermare anomalie specifiche non dimostrate dai frame.`;
    updateSections();saveSettings();tab('plan');$('video-state').textContent='Fotogrammi applicati al brief. Premi «Genera 3 post e piano» nella scheda Crea contenuti.';
  });
}

function init(){loadSettings();for(const name of fields)$(name).addEventListener('change',()=>{saveSettings();updateSections()});document.querySelectorAll('#lang-choice input').forEach(x=>x.addEventListener('change',saveSettings));
 document.querySelectorAll('nav.tabs button').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
 $('check').addEventListener('click',check);$('open-rules').addEventListener('click',linkRules);$('open-community').addEventListener('click',linkCommunity);
 $('generate').addEventListener('click',generate);$('translate').addEventListener('click',translate);$('export-json').addEventListener('click',reportExport);$('export-csv').addEventListener('click',postsCsv);$('week-export').addEventListener('click',weekCsv);
 $('save-posts').addEventListener('click',()=>{if(report){safeSave(reportKey,report);$('progress').textContent='Salvato nel browser (esporta anche il JSON per sicurezza).'}});
 setupVideos();$('track-date').value=new Date().toLocaleDateString('en-CA');$('track-save').addEventListener('click',addTrack);$('track-export').addEventListener('click',metricsCsv);$('track-clear').addEventListener('click',()=>{if(confirm('Cancellare lo storico social di questo browser? Esporta prima il CSV.')){safeSave(metricKey,[]);renderMetrics()}});
 updateSections();report=safeRead(reportKey,null);if(report&&Array.isArray(report.posts)){report.translations ||= {};renderReport()};renderMetrics();check();}
init();
})();
