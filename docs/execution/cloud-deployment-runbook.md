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
LOO_DENTAL_PROVIDER_ENABLED=true
LOO_DENTAL_DISABLE_RESPONSE_STORAGE=true
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<web-push public key>
VAPID_PRIVATE_KEY=<web-push private key>
VAPID_SUBJECT=mailto:<owner-email>
REMINDER_WORKER_SECRET=<manual worker secret>
REMINDER_WORKER_SCHEDULE_URL=https://loo-dental-reminder-cron.jkliu97.workers.dev/schedule
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
enable push from Settings -> 提醒偏好. Meal/off-tray reminders are not automatic
meal detection: the reminder job is scheduled only after the user taps
`我取下牙套了`.

The production path uses Cloudflare Queues with delayed delivery. When the user
taps `我取下牙套了`, the app writes a `reminder_jobs` row and calls the Worker
`/schedule` endpoint. The queued message is keyed by `userId + sessionId + dueAt`
and, after the delay, calls the protected Vercel `/api/workers/reminders/send-one`
endpoint for that one session. This avoids proactive database polling.

The legacy `/api/workers/reminders/run` endpoint remains available as a manual
catch-up fallback, but it is no longer the scheduled production path. Worker
endpoints accept:

- `Authorization: Bearer $CRON_SECRET` from an external scheduler.
- `x-worker-secret: $REMINDER_WORKER_SECRET` for manual smoke calls.

Manual catch-up smoke without sending user data:

```bash
curl -i -X POST \
  -H "x-worker-secret: $REMINDER_WORKER_SECRET" \
  https://<vercel-production-domain>/api/workers/reminders/run
```

Cloudflare Queue + Worker deploy:

```bash
npx wrangler queues create loo-dental-reminders
npx wrangler secret put REMINDER_WORKER_SECRET
npx wrangler deploy
```

Expected worker name: `loo-dental-reminder-cron`.

## AI Provider Notes

The product UI should not expose model or API-key settings. When Loo牙大臣 ships,
the server uses OpenRouter-compatible routing with fixed model `gpt-5.5` and
fixed reasoning effort `medium`. Store the API key only in local env and Vercel
environment variables.

The first-pass chat route is `/api/minister/chat`. It uses bounded local app
context only: current plan/progress, recent wear summaries, active exceptions,
and reminder settings. It does not send photos, raw notes, action logs, user
agent data, or unbounded session history to the AI provider.
