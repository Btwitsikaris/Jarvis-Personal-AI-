# JARVIS — Personal AI Assistant

Chat UI with voice input/output, Tavily web search with source cards, PDF/TXT/MD/CSV/JSON understanding,
Groq-powered answers, College and Code modes, and browser-saved chat history.

## Local setup

```bash
cd jarvis
npm install
cp .env.example .env     # then fill in your keys
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. **Set "Root Directory" to `jarvis`** (the app lives in that subfolder). Framework preset: Vite (auto-detected).
3. Add Environment Variables (Project Settings -> Environment Variables):

| Name | Required | Purpose |
|------|----------|---------|
| `GROQ_API_KEY` | yes | Groq chat model |
| `TAVILY_API_KEY` | yes (for web search) | Tavily search |
| `ACCESS_CODE` | **strongly recommended** | Passphrase required to use the API; the app asks for it once per browser |
| `RATE_LIMIT_PER_MIN` | no | Per-IP requests/min per route (default 20) |
| `ALLOWED_ORIGINS` | no | Extra allowed origins if you use a custom domain |
| `GROQ_MODEL` | no | Override model (default `openai/gpt-oss-20b`) |

4. Deploy. Never prefix these with `VITE_` — that would expose them to the browser.

### Before sharing the URL publicly
- Set `ACCESS_CODE`, otherwise anyone with the link can spend your Groq/Tavily quota.
- The built-in rate limiter is per serverless instance (best effort). For hard limits add a
  Vercel Firewall rate-limit rule on `/api/*`.
- If a key was ever committed to Git or shared, rotate it.

## Security notes
- API keys stay server-side; the browser never sees them.
- API routes enforce same-origin, optional access code, per-IP rate limits, input validation and size caps.
- Web results and uploaded documents are passed to the model as delimited, untrusted data.
- Markdown images are blocked in replies; links open with `noopener noreferrer`.
- `vercel.json` sets a strict Content-Security-Policy, HSTS, Permissions-Policy and other headers.
- pdf.js is bundled locally (no third-party CDN code at runtime).
- Chat history lives in your browser's localStorage (plain text) — use "Clear current chat"/delete on shared computers.

## Notes
- Voice input uses the browser Speech Recognition API (Chrome/Edge); audio is processed by the browser vendor.
- An attached document stays attached to the chat until you click Remove, so follow-up questions keep working.
