# Loo牙管理器 Development Task List

## Current Rule For Audit Tasks

Do not run background audit/check tasks by default during normal development. Run an audit only when the user explicitly requests it or confirms a key-feature signoff / pre-deployment gate.

## Working Rule For This Task List

Update this task list whenever a meaningful feature slice is completed, pushed, or deployed. The task list is the source of truth for current implementation progress before starting the next slice.

## P0.0 Cloud, Auth, And Mobile URL Baseline

Status: deployed

Tasks:

- Pull initial GitHub repo and preserve the project as a separate app from Loo国 / portfolio-manager. Completed.
- Add Vercel + separate Neon Postgres deployment baseline under the same personal cloud account family. Completed.
- Add registration and login pages. Completed.
- Protect app pages and APIs behind signed sessions. Completed.
- Require registered users for sessions; removed password-only singleton login path. Completed.
- Keep database separate from portfolio-manager. Completed.
- Deploy stable mobile PWA URL. Completed: `https://alignerlog-personal-app.vercel.app`.

Acceptance:

- New users can register and log in from the mobile URL.
- Protected pages redirect unauthenticated users.
- User data is partitioned by registered account.
- Cloud deployment is reproducible through Vercel.

## P0.1 Product Renaming And Chinese UX

Status: deployed

Tasks:

- Rename user-facing app copy from AlignerLog to Loo牙管理器. Completed.
- Convert primary navigation, login/register, Today, History, Calendar, Settings, and error copy to Chinese. Completed.
- Update PWA manifest name and short name. Completed.
- Preserve English code identifiers unless a code rename is necessary.
- Apply Loo国宝库 visual direction: warm treasury style, calm personal cards, non-clinical but trustworthy. Completed first pass.

Acceptance:

- Mobile URL opens as Loo牙管理器.
- No major user-facing screen still presents the product as AlignerLog.
- Medical disclaimer appears in plan/AI contexts.

## P0.2 Guided Plan Import

Status: deployed

Tasks:

- Add data model for treatment series and planned tray schedule. Implemented.
- Add guided import API. Implemented as `POST /api/treatment-plan/import`.
- Add guided import mobile UI. Implemented in Settings first pass.
- Support already-started users with current tray number and current tray start date or next change date. Implemented.
- Support 7/10/14/custom-day intervals. Implemented as custom day input.
- Support status values: not started, active, holding/passive, waiting for refinement, retainer.
- Preview generated schedule before save. Implemented.
- Persist confirm path atomically so active series and planned trays cannot be partially written. Completed.
- Separate default settings from real dental plans; new accounts do not display default values as a saved plan. Completed.
- Keep plan setup form collapsed until user chooses `开始新计划` or `导入已进行计划`. Completed.
- Protect existing plans: `修改当前计划` updates the active series in place; ordinary confirm is rejected when an active plan exists; reset/re-import is explicit. Completed.

Acceptance:

- User can import a plan while already on tray X.
- System generates current known-series schedule rows.
- Generated schedule does not create fake wear-session history.
- Same account's existing wear logs remain intact after import.
- Existing active plan is not overwritten unless user explicitly chooses reset/re-import.

## P0.3 Plan Progress Dashboard

Status: deployed first pass

Tasks:

- Add backend progress calculation from imported series/schedule. Implemented first pass.
- Extend snapshot API or add plan-progress API. Implemented via snapshot `planProgress`.
- Show current tray, current tray day, days to next change, trays remaining, and estimated current-series end date. Implemented on Today except estimated end date is currently in import preview.
- Mark paused/holding/waiting states clearly.
- Add tray boundary markers to Calendar. Not yet implemented.

Acceptance:

- Today page shows `第 X / Y 副`.
- Today page shows next planned change date and remaining days.
- Calendar shows tray boundaries without implying medical approval to change trays.

## P0.3.1 Data Truthfulness And Empty-State Semantics

Status: deployed

Tasks:

- Stop calculating wear time for dates that have no real wear/off-tray records. Completed.
- Add `DailySummary.hasData` and use it in Today, History, and Calendar. Completed.
- Make Today show `暂无记录` instead of invented `今日已戴` minutes before first real check-in. Completed.
- Make History averages/charts use only recorded days. Completed.
- Keep no-data calendar days gray / `暂无佩戴记录`. Completed.
- Derive visible wearing/out status from active off-tray sessions when present, so deploy/reload cannot mask an active `已取下` session as `佩戴中`. Completed.
- Avoid creating a persisted default `wear_states.is_wearing=true` row from read-only Today snapshot access. Completed.
- Add `wear_action_logs` audit table for each take-out / put-back action, including action, changed flag, session id, resulting status, request id, source, user-agent, and referer. Completed.

Acceptance:

- New accounts do not show fake 7-day/30-day averages.
- History does not show near-24-hour bars for days without logs.
- Today metrics begin only after user performs a real tracking action.
- Calendar no-data status stays visually distinct from success/failure.
- If an active off-tray session exists, Today shows `已取下` after reload/deploy.
- If status changes unexpectedly, the backend has per-action audit rows to inspect source and request metadata.

## P0.3.2 User Time Zone Boundary

Status: deployed

Tasks:

- Capture the user's browser time zone with `Intl.DateTimeFormat().resolvedOptions().timeZone`. Implemented.
- Send `X-Loo-Time-Zone` from Today, wear toggle, History, Calendar, Settings, and plan import requests. Completed.
- Support `timeZone` query parameter for export links. Completed.
- Compute Today, summaries, calendar session range, CSV export, and plan progress using the requested user time zone instead of server/UTC day boundaries. Completed.
- Keep imported plan dates as plain user-entered dates; only "today" and session aggregation use the time zone boundary. Completed.
- Use the same client-local date key for Settings default plan dates and Calendar initially selected date. Completed.
- Add regression tests for Toronto local day boundary and DST day length. Completed.
- Deploy and verify public mobile route health. Completed.

Acceptance:

- In Toronto, "today" starts at local midnight, not UTC midnight.
- A session that crosses UTC midnight but not Toronto midnight stays on the same local day.
- A session that crosses Toronto midnight is split into two local days.
- Today, History, Calendar, Settings plan progress, and CSV export use the same day boundary.
- DST days use the actual local day length for elapsed-time calculations.

## P0.4 Loo牙大臣 Floating AI Agent

Status: planned

Tasks:

- Add server-side AI env contract:
  - `LOO_DENTAL_OPENROUTER_API_KEY`
  - `LOO_DENTAL_OPENROUTER_BASE_URL`
  - fixed model `gpt-5.5`
  - fixed reasoning effort `medium`
- Add AI route for Q&A over bounded plan/log context.
- Add floating mobile component.
- Add system prompt with dental clear-aligner expert persona and safety boundaries.
- Add usage/error logging lightweight enough for personal use.
- Do not expose model/key configuration in product UI.

Acceptance:

- User can ask Chinese questions about plan and wear logs.
- AI answers include safety caveat when question touches tray changes, pain, poor fit, breakage, lost trays, or clinical uncertainty.
- AI never recommends skipping/advancing/reversing trays as a clinical instruction.

## P0.5 Manual QA And Deploy

Status: partially complete / ongoing

Tasks:

- Add manual QA checklist for plan import, progress, Chinese copy, and AI safety cases.
- Run local verification: tests, typecheck, build. Completed for deployed P0.0-P0.3.2 slices.
- Ask user whether to run pre-deployment audit. Active rule established.
- Deploy to Vercel after signoff. Completed for current deployed slices.
- Run cloud smoke. Public route checks completed; authenticated write smoke should only run when explicitly requested because it creates/updates smoke account data.
- Move logout out of bottom navigation and into Settings account area to reduce mobile mis-taps. Implemented locally.
- Replace plan numeric free-text inputs with bottom-sheet pickers to prevent invalid mobile input states. Implemented locally.
- Scope Settings save payload and repository updates to editable fields only, preventing ISO timestamp strings from being written back to timestamp columns. Implemented locally.
- Add visible Settings time zone control for manual override of the user's day boundary. Implemented locally.
- Clarify Calendar daily note persistence with saved-state feedback and note-only day labeling. Implemented locally.
- Clarify reminder UX as manual off-tray timer, not automatic meal detection. Implemented locally.
- Add Calendar tray boundary markers and selected-day tray start/end details from imported plan. Implemented locally.
- Add PWA Web Push P0: browser subscription UI, push subscription storage, off-tray reminder jobs, service-worker notification handling, and protected reminder worker endpoint. Implemented locally and ready for deploy.
- Add external five-minute reminder scheduler. Implemented locally with Cloudflare Worker Cron because Vercel Hobby cron cannot run every five minutes.
- Simplify Reminders page into an action-first layout: current device push, current reminder rule, and collapsed work-principle explanation. Implemented locally.
- Add manual off-tray backfill for missed taps and expand return-reminder interval options from short breaks to longer meals. Implemented locally.
- Make manual off-tray backfill look like an explicit CTA instead of a static display card. Implemented locally.
- Fix Today local-day rollover progress so started users continue accumulating today's wear time without needing a new toggle action. Implemented locally.
- Split manual correction into forgot-take-off already-back, forgot-take-off still-out, and forgot-put-back modes. Implemented locally.
- Improve Today next-change date presentation to avoid narrow ISO date wrapping. Implemented locally.
- Fix active off-tray duration display after local midnight to use today's day-sliced off time. Implemented locally.
- Add treatment exception lifecycle and Today change-confirmation flow: active/resolved/cancelled exception records, Settings resolve/cancel controls, Today active-exception banner, and explicit confirm-to-advance current tray. Implemented locally.
- Add dental photo records: authenticated photo upload, client-side compression, date/stage/tray/view metadata, photo archive, delete action, and two-photo side-by-side comparison. Implemented and deployed.
- Refine photo IA: remove the bottom-nav photo tab, embed stage-photo upload in Calendar day detail and History day/session editor, and keep `/photos` as a hidden full archive route. Implemented locally.
- Refine reminder IA: remove the bottom-nav reminder tab, merge push permission/status and reminder rule explanation into Settings -> 提醒偏好, and redirect the old `/reminders` route to Settings. Implemented locally.
- Add manual mobile QA checklist for current deployed surfaces. Pending.

Acceptance:

- Production mobile URL works.
- Registration/login still works.
- Existing Today/Calendar/Notes flows still work.
- Plan import/progress and AI route are protected by auth.

## Current Next Priorities

1. Deploy current exception lifecycle / tray-change confirmation slice and run mobile QA on Today + Settings.
2. Manual mobile QA checklist for deployed pages: register/login, Today empty state, first off-tray session, Today timezone boundary, History no-data and recorded-data states, Calendar notes/no-data/tray-boundary states, Settings plan create/import/update/reset, push subscription and reminder worker.
3. Calendar exception markers: show exception start/resolution dots alongside tray boundary markers.
4. Photo records QA: upload from mobile camera/library through Calendar and History details, verify compressed save/readback, delete isolation, hidden full archive, and same-angle comparison.
5. Loo牙大臣 P0: server-side OpenRouter route, bounded context, floating component, safety prompt.
6. Multi-series timeline: initial/refinement/holding/retainer stages.

## P1 Multi-Series And Exceptions

Status: active first pass

Tasks:

- Add refinement series. Planned.
- Add passive/holding and retainer-specific flows. First pass implemented through waiting-refinement / waiting-retainer exception states.
- Add exception events: delayed change, tray extension, poor fit, lost/broken tray, waiting for rescan/refinement/retainer. Lifecycle closure implemented locally with active/resolved/cancelled states and Settings controls.
- Add explicit tray-change confirmation on Today. Implemented locally; the app does not auto-advance current tray when a planned interval ends.
- Add Calendar exception markers. Planned.
- Add per-tray notes/symptom tags.
- Add adherence-by-tray charts and forecast confidence labels.

## P1 Dental Photo Records

Status: active first pass

Tasks:

- Add photo record database table and authenticated API. Implemented locally.
- Add mobile photo upload with metadata: date, stage, tray number, view type, and note. Implemented locally.
- Compress photos client-side before saving to Postgres. Implemented locally as a low-volume personal-project shortcut.
- Add photo archive and two-photo comparison view. Implemented locally.
- Embed photo upload into Calendar day detail and History previous-session editor. Implemented locally.
- Remove photo from bottom navigation to keep mobile IA at five primary tabs. Implemented locally.
- Add object storage migration path if photo volume grows beyond small personal use. Planned; current recommendation is Cloudflare R2 first for larger free quota and free egress, Vercel Blob second for simplest Vercel integration, while keeping Postgres data URLs only as a tightly capped personal MVP bridge.
- Add AI-assisted descriptive comparison only after strict medical-safety copy and no-diagnosis boundary are in place. Planned.

Acceptance:

- Users can record teeth shape photos by stage without mixing accounts.
- Users can compare two same-angle photos side-by-side.
- Product copy makes clear that photos are for self-recording, not diagnosis or clinical treatment decisions.

Acceptance:

- User can pause or extend current schedule without losing history.
- Forecast clearly says "current known series only" when future refinements are unknown.
- Exception flows record events without giving clinical instructions.
