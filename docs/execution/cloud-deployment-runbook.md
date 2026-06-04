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
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<web-push public key>
VAPID_PRIVATE_KEY=<web-push private key>
VAPID_SUBJECT=mailto:<owner-email>
REMINDER_WORKER_SECRET=<manual worker secret>
CRON_SECRET=<vercel cron secret>
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

## Push Reminder Notes

PWA push reminders are device/browser subscriptions. Users must explicitly
enable push on the Reminders page. Meal/off-tray reminders are not automatic
meal detection: the reminder job is scheduled only after the user taps
`我取下牙套了`.

Vercel Hobby does not support five-minute cron schedules, so use the included
Cloudflare Worker Cron for production five-minute scheduling. The worker calls
the protected Vercel endpoint and does not store user data. The endpoint accepts
either:

- `Authorization: Bearer $CRON_SECRET` from an external scheduler.
- `x-worker-secret: $REMINDER_WORKER_SECRET` for manual smoke calls.

Manual smoke without sending user data:

```bash
curl -i -X POST \
  -H "x-worker-secret: $REMINDER_WORKER_SECRET" \
  https://<vercel-production-domain>/api/workers/reminders/run
```

Cloudflare Worker Cron deploy:

```bash
npx wrangler secret put REMINDER_WORKER_SECRET
npx wrangler deploy
```

Expected worker name: `loo-dental-reminder-cron`.

## AI Provider Notes

The product UI should not expose model or API-key settings. When Loo牙大臣 ships,
the server uses OpenRouter-compatible routing with fixed model `gpt-5.5` and
fixed reasoning effort `medium`. Store the API key only in local env and Vercel
environment variables.
