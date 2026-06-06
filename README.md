# Loo牙管理器

Cloud-first Chinese personal clear-aligner / Invisalign-style tracking PWA for
iPhone-friendly mobile URL usage.

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
personal account session.

## Getting Started

Create `.env.local`. For the current personal deployment, use the same
Neon/Vercel account as `portfolio-manager`, but use a separate AlignerLog
database URL. Keep AlignerLog's auth secret and login password separate:

```bash
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
ALIGNERLOG_USER_ID="00000000-0000-0000-0000-000000000001"
ALIGNERLOG_AUTH_SECRET="replace-with-at-least-32-random-characters"
ALIGNERLOG_LOGIN_PASSWORD="replace-with-a-personal-password"
LOO_DENTAL_OPENROUTER_API_KEY="optional-server-side-ai-key"
LOO_DENTAL_OPENROUTER_BASE_URL="https://openrouter.icu/v1/responses"
LOO_DENTAL_PROVIDER_ENABLED="true"
LOO_DENTAL_DISABLE_RESPONSE_STORAGE="true"
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

- Registration/login with a signed HttpOnly cookie
- Today status and toggle flow
- Cloud schema for treatment plan, wear state, sessions, notes, and reminders
- Daily summary calculation with cross-midnight session splitting
- History metrics and 14-day chart
- Settings updates
- JSON and CSV export
- PWA shell

## Active Product Direction

- Chinese-first product name: `Loo牙管理器`
- Guided import for existing clear-aligner plans
- Current tray / current-series progress tracking
- Generated planned schedule rows without fake wear history
- Floating `Loo牙大臣` AI assistant over plan and wear logs
- Server-side OpenRouter-compatible AI routing with fixed `gpt-5.5` and `medium`
  reasoning effort

See:

- `docs/product/current-product-spec.md`
- `docs/execution/task-list.md`

## Later Backend Step

Add a cloud worker reminder queue when reminder delivery becomes active:

1. Store push subscriptions.
2. Create reminder records when an off-tray session starts.
3. Cancel scheduled reminders when the active session ends.
4. Run a cron sender every few minutes.

## Deployment

Use `docs/execution/cloud-deployment-runbook.md` for the Vercel + Postgres deployment
checklist and smoke test.
