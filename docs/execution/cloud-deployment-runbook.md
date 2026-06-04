# Loo牙管理器 Cloud Deployment Runbook

## Target

- Use the same personal Neon/Vercel account as `portfolio-manager`, but create
  a separate AlignerLog database or Neon project/branch with its own
  `DATABASE_URL`.
- Vercel for the Next.js app, APIs, and mobile PWA URL.
- iPhone access through the Vercel production URL, then Add to Home Screen.

## Required Environment Variables

```env
DATABASE_URL=postgresql://...
ALIGNERLOG_USER_ID=00000000-0000-0000-0000-000000000001
ALIGNERLOG_AUTH_SECRET=<32+ character random secret>
ALIGNERLOG_LOGIN_PASSWORD=<personal login password>
LOO_DENTAL_OPENROUTER_API_KEY=<server-side OpenRouter key, optional until AI ships>
LOO_DENTAL_OPENROUTER_BASE_URL=https://openrouter.icu/v1/responses
REPOSITORY_MODE=postgres-drizzle
```

## Local Setup

This project should not share the `portfolio-manager` database. Keep it under
the same personal cloud account for billing and access simplicity, but use a
separate AlignerLog `DATABASE_URL`. Keep the app password and auth secret
separate as well.

```bash
npm install
npm run db:push
npm run dev
```

## Production Setup

1. Create a separate AlignerLog database, Neon project, or Neon branch under
   the same personal account.
2. Add the required environment variables to this app's Vercel production
   project.
3. Apply the AlignerLog schema to the AlignerLog database:

```bash
DATABASE_URL="<production database url>" npm run db:push
```

4. Deploy:

```bash
npx vercel deploy --prod
```

## Smoke Checks

```bash
APP_BASE_URL=https://<vercel-production-domain> npm run cloud:smoke
```

To include a positive login check, run it with the same password used in
production:

```bash
APP_BASE_URL=https://<vercel-production-domain> \
ALIGNERLOG_LOGIN_PASSWORD="<production login password>" \
npm run cloud:smoke
```

Expected:

- `/today` redirects to `/login` without a session.
- `/api/snapshot` returns `401` without a session.
- `/manifest.webmanifest` and `/sw.js` return `200`.
- wrong login returns `401`.
- correct login opens the protected API, settings, and export flows.

## AI Provider Notes

The product UI should not expose model or API-key settings. When Loo牙大臣 ships,
the server uses OpenRouter-compatible routing with fixed model `gpt-5.5` and
fixed reasoning effort `medium`. Store the API key only in local env and Vercel
environment variables.
