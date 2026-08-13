# Sukoon — Groq + Vercel prototype

Sukoon is a browser-based prototype of a reflective mental-wellbeing companion.

## Architecture

Browser
→ `/api/chat`
→ Vercel Node.js Function
→ Groq API

The Groq API key is **never placed in the browser**.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. In Vercel → Project → Settings → Environment Variables, add:

`GROQ_API_KEY` = your Groq API key

4. Enable it for Preview and/or Production as required.
5. Redeploy.

Vercel exposes environment variables to server-side Functions through `process.env`.

## Local development

Install Vercel CLI:

```bash
npm install -g vercel
```

Then:

```bash
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Alternatively, create `.env.local` yourself:

```text
GROQ_API_KEY=your_key_here
```

Do not commit `.env.local`.

## Files

- `index.html` — complete Sukoon UI and conversation logic
- `api/chat.js` — secure Groq proxy
- `package.json` — minimal Vercel project configuration
- `.gitignore` — prevents local secrets from being committed

## Important prototype note

The current memory and MI aggregate code uses `window.storage`, which is available in the original Claude Artifact environment but is **not a standard browser API**.

For a normal GitHub/Vercel deployment, those calls will fail harmlessly because the code already wraps them in `try/catch`. The chat itself will work, but persistent Memory and all-time MI metrics will not persist across page reloads unless a storage backend is added.

For a first prototype, that is intentional: get the Groq conversation loop working first.
