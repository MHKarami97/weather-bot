# weather-bot

## What it does
- Telegram bot built with TypeScript on Cloudflare Workers.
- User sends a city name.
- Bot replies with today’s weather using Open-Meteo.

## Files
- `src/index.ts` — Worker + Telegram webhook + weather logic.
- `wrangler.toml` — Worker config.
- `.github/workflows/deploy.yml` — GitHub Actions deploy.

## Setup
1. Create a bot with `@BotFather` and get the token.
2. Install deps:

```powershell
npm install
```

3. Set Cloudflare secrets:

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

4. Deploy:

```powershell
npm run deploy
```

5. Set the webhook:

```powershell
curl.exe -X POST "https://<your-worker>.workers.dev/set-webhook" `
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## GitHub + Cloudflare link
- Push this repo to GitHub.
- In GitHub, add secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Cloudflare secrets still stay in Cloudflare:
  - `TELEGRAM_BOT_TOKEN`
  - `ADMIN_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
- GitHub Actions will deploy on push to `main`.

## Local dev

```powershell
npm run dev
```

## Message format
- `London`
- `/weather London`

