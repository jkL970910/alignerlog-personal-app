# AlignerLog Personal App

Cloud-first personal clear aligner wear-time tracker for iPhone-friendly PWA usage.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Drizzle ORM with `pg.Pool`
- Cloud Postgres through `DATABASE_URL`
- Recharts
- PWA manifest and service worker

The backend is intentionally cloud-first. Local IndexedDB is not the source of truth in this implementation.
The database layout follows the Portfolio Manager pattern: `lib/db/schema.ts`, `lib/db/client.ts`, Drizzle Kit, and `db:push`.
The app is intended to be opened as a mobile PWA URL and is protected by a
single personal password session.

## Getting Started

Create `.env.local`. For the current personal deployment, use the same
Neon/Vercel account as `portfolio-manager`, but use a separate AlignerLog
database URL. Keep AlignerLog's auth secret and login password separate:

```bash
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
ALIGNERLOG_USER_ID="00000000-0000-0000-0000-000000000001"
ALIGNERLOG_AUTH_SECRET="replace-with-at-least-32-random-characters"
ALIGNERLOG_LOGIN_PASSWORD="replace-with-a-personal-password"
REPOSITORY_MODE="postgres-drizzle"
```

Install dependencies:

```bash
npm install
```

Push the schema:

```bash
npm run db:push
```

Run the app:

```bash
npm run dev
```

## Current Scope

- Password-protected personal login with a signed HttpOnly cookie
- Today status and toggle flow
- Cloud schema for treatment plan, wear state, sessions, notes, and reminders
- Daily summary calculation with cross-midnight session splitting
- History metrics and 14-day chart
- Settings updates
- JSON and CSV export
- PWA shell

## Next Backend Step

Add a cloud worker reminder queue:

1. Store push subscriptions anonymously.
2. Create reminder records when an off-tray session starts.
3. Cancel scheduled reminders when the active session ends.
4. Run a cron sender every few minutes.

## Deployment

Use `docs/execution/cloud-deployment-runbook.md` for the Vercel + Postgres deployment
checklist and smoke test.
