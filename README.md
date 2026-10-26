# Social Studio

**A local desktop tool for indie game community research, content planning, and human-reviewed Reddit publishing.**

Social Studio helps a small indie game development team understand relevant communities, prepare original development updates and gameplay posts, and manage the process of publishing content on Reddit.

The application is designed around a **human-in-the-loop workflow**: developers inspect community rules, review and edit drafts, and explicitly authorize **each individual Reddit post** before it is submitted. It does not run unattended posting campaigns.

> **Project status:** Experimental local application. Access to Reddit's Data API, including any promotional/commercial use, requires the appropriate authorization from Reddit. The existence of OAuth credentials does not, by itself, grant that authorization.

## What it does

### Community research and comparison

- Retrieve a limited sample of top public posts from a selected subreddit using an **authorized Reddit OAuth connection**.
- Compare visible signals such as scores, comment counts, titles, and relevant discussion topics.
- Retrieve subreddit rules for review; moderators' pinned posts and any additional posting requirements still need to be checked manually.
- Use selected examples as references for **original content planning**, not for copying existing posts.

Engagement numbers are descriptive: high scores or comment counts do **not** establish why a post performed well or how many Steam wishlists it generated.

### Content preparation

- Create three alternative post concepts, titles, and draft descriptions for an indie game.
- Prepare short-video concepts, practical shot lists, and a suggested seven-day content plan.
- Produce language adaptations and export drafts, plans, and manually recorded metrics as CSV/JSON.
- Work with the included profiles for **Liminal Backrooms** and **ⱯL∞P**, or enter the details of a different game.

**Optional local AI assistance:** Social Studio can use **Ollama with `qwen3.5:9b`** to help analyze developer-provided context and prepare draft copy. The model runs locally. It does **not** make publishing decisions or submit posts. Developers remain responsible for factual accuracy, editing, compliance with community rules, and any disclosure required by a subreddit. The application does not train or fine-tune models on Reddit data.

### Reddit publishing after manual approval

The authorized Reddit integration supports **one text/self post at a time**, with the following workflow:

1. Choose a subreddit and review its rules, including restrictions on self-promotion.
2. Select a draft or write a post manually.
3. **Personally review** the exact subreddit, title, and body, and **edit them if needed**.
4. Confirm the applicable community rules and required disclosures.
5. Generate a final preview; the approved draft expires after 10 minutes.
6. Enter the specific confirmation phrase and explicitly authorize this **single** submission.
7. Only then does Social Studio call Reddit's official `POST /api/submit` endpoint.

The application records locally the fingerprints of successfully submitted posts to reduce accidental duplicates. If Reddit's response is ambiguous, it does not automatically retry. The user must inspect Reddit before attempting another submission.

**No mass posting, scheduled/unattended publication, automated comments, votes, unsolicited DMs, account farming, or attempts to circumvent subreddit restrictions or API rate limits.**

Reddit text-post submission is the only directly integrated publishing flow in this version. TikTok, Instagram, YouTube Shorts, X, and Bluesky are available for **draft planning**, not automated posting. Native Reddit video/image uploads are not implemented.

## Requirements

- Windows with **Python 3** available from the command line (the project uses the Python standard library; no `pip install` is required).
- Optional, for draft generation and translation: [Ollama](https://ollama.com/) with the model `qwen3.5:9b`.
- Optional, for the Reddit integration: **Reddit-approved Data API access** for the intended use, an OAuth app with a Client ID/Secret, and the owner's explicit account authorization.

The app runs locally on `127.0.0.1:8766` by default. Ollama runs locally on `127.0.0.1:11434`.

## Getting started

1. Clone or download this repository.
2. To use the optional local drafting features, install [Ollama](https://ollama.com/) and download the model:

   ```bash
   ollama pull qwen3.5:9b
   ```

3. On Windows, run `AVVIA_SOCIAL_STUDIO.bat`. Alternatively, from the project directory run:

   ```bash
   python social_studio_server.py
   ```

4. Open **http://127.0.0.1:8766/** in a browser.
5. Use **Create content** to prepare drafts and a plan, or **Compare & Publish** to configure the authorized Reddit connection.

Content drafting and manual posting do **not** require Reddit API credentials. Reddit research and API-based submission do.

## Connecting Reddit (authorized use only)

If Reddit has approved your intended API usage:

1. Create/configure the approved OAuth app as required by Reddit.
2. Use the exact redirect URI: `http://127.0.0.1:8766/reddit/callback` (or the matching port if you change `SOCIAL_STUDIO_PORT`).
3. In **Compare & Publish**, enter the Reddit Client ID, Client Secret, and an identifiable User-Agent.
4. Confirm that Reddit has approved the intended API use, connect your own Reddit account via OAuth, and grant `identity`, `read`, and `submit` permissions.
5. Review each post and authorize its submission individually.

The application uses an OAuth **temporary** session, so you may need to reconnect when it expires. Connecting an account never starts a background posting process.

Without approved API access, you can still create and edit drafts and open the Reddit post composer to publish **manually**.

## Privacy and local data

- Draft generation uses a locally hosted Ollama model; this project does not send prompts to a hosted AI provider.
- Using Reddit's API necessarily sends authorized requests and submitted content to Reddit.
- Client ID, Client Secret, and User-Agent are stored locally in `reddit_config.json`. **Do not commit or share this file.**
- OAuth access tokens and prepared drafts are kept in process memory, not intentionally persisted across restarts.
- The tool keeps a local `social_published.json` record of successful submissions to help prevent duplicates.
- Drafts, preferences, and manually entered performance metrics may be stored in the browser's `localStorage`.
- The local server binds to `127.0.0.1`; do not expose it publicly or deploy it as-is on a shared server.

Recommended `.gitignore` entries:

```gitignore
reddit_config.json
social_published.json
.env
.env.*
!.env.example
__pycache__/
*.pyc
*.log
.venv/
venv/
```

Never upload API secrets, OAuth tokens, local browser exports containing private data, or screenshots showing credentials.

## Responsible use

- Follow [Reddit's API requirements](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data), [Data API Terms](https://redditinc.com/policies/data-api-terms), and [spam policy](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam).
- Obtain the appropriate permission for promotional or other commercial usage **before** using the Data API.
- Respect individual community rules, moderator guidance, posting limits, and any requirements to disclose promotional affiliations or AI-assisted material.
- A user must evaluate each post in context and approve it; **no automated approval** is provided.
- This is not an official Reddit product and is not affiliated with, endorsed by, or approved by Reddit.

## Implementation and current limitations

| Component | Implementation |
| --- | --- |
| Local backend | Python 3 standard library (`social_studio_server.py`) |
| Web interface | HTML and vanilla JavaScript (`index.html`, `client.js`, `reddit_workflow.js`) |
| Reddit integration | OAuth 2.0 and official Reddit Data API (`reddit_integration.py`) |
| Optional draft assistant | Ollama / Qwen 3.5 9B, hosted on the user's machine |
| Local persistence | Browser `localStorage` and small local JSON files |

This is an experimental project. API connectivity and submission logic have been exercised with **simulated Reddit responses**; that is not proof of working production access or Reddit approval. The application does not guarantee engagement, wishlist growth, subreddit acceptance, or publication success.

## Project links

- Repository: https://github.com/Chryi123/social-studio
- Reddit API reference: https://www.reddit.com/dev/api/
