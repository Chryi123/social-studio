# Social Studio 2.0 — Benchmark Reddit e pubblicazione dopo revisione

Questa versione conserva le funzioni v1 (post per Liminal, ⱯL∞P e giochi nuovi; Qwen 3.5:9b; varianti; traduzioni; calendario; metriche) e aggiunge **confronto dei post più votati tramite Reddit OAuth e pubblicazione di un singolo post dopo revisione e conferma esplicita**.

## Requisiti

- Windows, Python 3 (senza dipendenze pip).
- Ollama con `qwen3.5:9b`, per la generazione IA; per il confronto e la pubblicazione tramite Reddit non è necessario che Qwen sia acceso.
- **Accesso alla Reddit Data API già autorizzato** per il vostro utilizzo, inclusa l'eventuale promozione commerciale. Reddit può richiedere approvazione, accordi e corrispettivi. L'esistenza di una app OAuth non è prova di approvazione. Prima di attivare l'integrazione chiedete e ottenete accesso Reddit per il caso d'uso.
- Una app Reddit di tipo Web/Confidential autorizzata, con `client_id`, `client_secret` e redirect URI **identico** a `http://127.0.0.1:8766/reddit/callback` (se usate una porta diversa, adattate la URI). L’app richiede gli scope `identity read submit`.

## Avvio e collegamento

1. Estrai lo ZIP e fai doppio clic su `AVVIA_SOCIAL_STUDIO.bat`.
2. Apri `http://127.0.0.1:8766/` > **Confronta & Pubblica**.
3. Dopo aver ottenuto accesso Reddit, inserisci Client ID, Client Secret, User-Agent identificabile e dichiara che Reddit ha autorizzato il caso d'uso. Clicca **Salva configurazione autorizzata**. Non inserire credenziali Reddit username/password.
4. Clicca **Collega il mio account Reddit** e completa **OAuth nel sito Reddit**. Torna a Social Studio e premi **Verifica collegamento**.
5. Il tool conserva le credenziali della app **solo** in `reddit_config.json` sulla macchina (file da NON condividere e NON caricare qui). Gli access token sono **soltanto in memoria** e, usando sessioni temporanee, vanno ricollegati quando scadono. Non c'è autopost dopo aver chiuso il PC.

## Confronto post già riusciti

- Inserisci una community specifica, ad esempio `r/IndieGaming`.
- Seleziona periodo e, facoltativamente, parole chiave.
- Clicca **Analizza post più votati**: il tool richiede l'elenco top alla Reddit Data API autorizzata. Mostra punteggio, commenti, titolo, estratto, fonte e un'indicazione semplice di pertinenza.
- Clicca **Aggiungi come riferimento per Qwen** su un post pertinente; tornerà nel campo Esempi della scheda Crea contenuti. Rigenera le varianti: Qwen può confrontare gli hook e la struttura del post senza copiarlo.
- Clicca **Leggi regole Reddit**: vengono richieste le regole della community via API e riportate nel campo di revisione. Occorre **comunque** leggere i post fissati e i requisiti specifici/moderazione, e non confondere una community adatta al tema con il permesso di autopromozione.
- Se le API non sono autorizzate, resta disponibile il vecchio flusso senza raccolta automatica: incollare esempi e regole legittimamente ottenuti.

## Se l’accesso Data API non è stato ancora autorizzato

Puoi usare Qwen e la scheda **Crea contenuti** senza Reddit API: incolla nel campo Esempi i post consultati legittimamente. Nella scheda di revisione, **Apri Reddit per pubblicare manualmente** copia titolo e corpo, apre Reddit e lascia a te l'invio. Non aggira le autorizzazioni né pubblica senza consenso.

## Pubblicare **dopo** approvazione

1. Da **Crea contenuti**, genera le tre proposte di Reddit per il gioco desiderato. Puoi anche scrivere da zero la bozza finale.
2. Vai in **Confronta & Pubblica**, scegli una variante e clicca **Importa bozza selezionata**.
3. Modifica il **subreddit finale, titolo e corpo esatti** che vuoi pubblicare. Questa versione supporta **post di testo** con eventuali link nel corpo (se la community li consente). Foto, GIF e video vanno ancora caricati manualmente su Reddit.
4. Leggi le regole, verifica che l'autopromozione sia permessa e che l'eventuale IA usata sia dichiarata se richiesto. Conferma tutte e quattro le checkbox.
5. Clicca **Prepara anteprima finale**. Il server salva la versione revisionata per 10 minuti, senza pubblicarla.
6. Controlla l'anteprima, digita **`PUBBLICA IN r/NomeCommunity`**, conferma il singolo invio e premi **PUBBLICA QUESTO POST**.
7. Il backend invia **una sola richiesta** Reddit `POST /api/submit` via OAuth ufficiale e restituisce il link solo se Reddit conferma. Per risposte ambigue NON tenta un reinvio automatico: controlla prima i tuoi post su Reddit.

Non c'è invio in massa, crossposting automatico, programmazione non presidiata, DM automatici, scraping o aggiramento dei rate limit. Una settimana di post va decisa da te, subreddit per subreddit.

## Limiti e controlli

- Le API Reddit, le credenziali e la pubblicazione potrebbero non essere disponibili finché Reddit non concede l'autorizzazione al tuo caso d'uso. Il tool **non** richiede ai mod di un subreddit l'autorizzazione a postare per tuo conto e non può garantirla.
- Il confronto valuta l'engagement visibile in un campione di top post, **non** le wishlist generate. Un post con molti upvote non è automaticamente marketing efficace.
- Lo User-Agent deve identificare realmente la app e l'account. Non usare app di terze parti o credenziali rubate per aggirare l'approvazione Reddit.
- Cambiare il testo dopo la revisione invalida l'anteprima e obbliga a una nuova conferma.
- Il server locale ascolta solo su `127.0.0.1` con token anti-CSRF. Le impronte dei post pubblicati sono salvate localmente in `social_published.json` per ridurre i reinvii identici anche dopo un riavvio (non contiene credenziali). Non esporre mai il servizio su Internet.
- Le richieste ai servizi Reddit vanno **su Internet**, mentre la generazione Qwen resta locale. Non condividere `reddit_config.json` o log con credenziali.
- Progettato come software sperimentale: OAuth, query benchmark e invio sono stati testati con risposte Reddit **simulate**, non pubblicando su un account reale.

Fonti ufficiali: https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data ; https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam ; https://www.reddit.com/dev/api/ ; https://redditinc.com/policies/data-api-terms .


## 3.0 — Video → Fotogrammi → Post

- Nuova scheda **Video → Post**: seleziona fino a due file gameplay MP4, WebM o MOV (se il browser riesce a decodificarli). I video non vengono inviati integralmente a Social Studio, Reddit, o Ollama: il browser legge il file localmente e campiona un fotogramma circa ogni 4/7/10 secondi.
- Il tool mostra una **galleria di fotogrammi con timestamp** e preseleziona automaticamente quattro candidati in base a un semplice punteggio visivo. **Non è una rilevazione sicura delle anomalie**: verificare e selezionare i frame a mano.
- Seleziona fino a 4 frame e premi **Usa i fotogrammi per generare il post**; nella scheda Crea contenuti premi **Genera 3 post e piano**. Il modello Qwen 3.5 9B vision riceverà solo quei 4 JPEG, con un elenco dei timestamp.
- Puoi scaricare ogni frame JPG o i fotogrammi selezionati. Il tool non monta clip video, non carica video nativi su Reddit e non pubblica video via API; l'upload del video finale va eseguito manualmente nel browser Reddit.
- È possibile mantenere il confronto e il flusso di approvazione manuale di Social Studio 2.0. La generazione e l'analisi visuale dipendono da Ollama.

**Importante:** Se un subreddit richiede trasparenza sull'uso di IA generativa nella promozione, dichiarare che il testo del post è stato assistito da Qwen (anche se lo sviluppatore lo ha revisionato). Non dichiarare erroneamente che il gioco non usa IA.

### Aggiornare un repository GitHub già esistente

Sostituisci i file aggiornati nella cartella locale di `social-studio`, poi:

```bash
git add .
git commit -m "feat: add local video frame extraction for social posts"
git push origin main
```
