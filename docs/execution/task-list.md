# Loo牙管理器 Development Task List

## Current Rule For Audit Tasks

Do not run background audit/check tasks by default during normal development. Run an audit only when the user explicitly requests it or confirms a key-feature signoff / pre-deployment gate.

## P0.1 Product Renaming And Chinese UX

Status: completed locally

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

Status: implemented locally

Tasks:

- Add data model for treatment series and planned tray schedule. Implemented.
- Add guided import API. Implemented as `POST /api/treatment-plan/import`.
- Add guided import mobile UI. Implemented in Settings first pass.
- Support already-started users with current tray number and current tray start date or next change date. Implemented.
- Support 7/10/14/custom-day intervals. Implemented as custom day input.
- Support status values: not started, active, holding/passive, waiting for refinement, retainer.
- Preview generated schedule before save. Implemented.

Acceptance:

- User can import a plan while already on tray X.
- System generates current known-series schedule rows.
- Generated schedule does not create fake wear-session history.
- Same account's existing wear logs remain intact after import.

## P0.3 Plan Progress Dashboard

Status: partially implemented locally

Tasks:

- Add backend progress calculation from imported series/schedule. Implemented first pass.
- Extend snapshot API or add plan-progress API. Implemented via snapshot `planProgress`.
- Show current tray, current tray day, days to next change, trays remaining, and estimated current-series end date. Implemented on Today except estimated end date is currently in import preview.
- Mark paused/holding/waiting states clearly.
- Add tray boundary markers to Calendar.

Acceptance:

- Today page shows `第 X / Y 副`.
- Today page shows next planned change date and remaining days.
- Calendar shows tray boundaries without implying medical approval to change trays.

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

Status: planned

Tasks:

- Add manual QA checklist for plan import, progress, Chinese copy, and AI safety cases.
- Run local verification: tests, typecheck, build.
- Ask user whether to run pre-deployment audit.
- Deploy to Vercel after signoff.
- Run cloud smoke.

Acceptance:

- Production mobile URL works.
- Registration/login still works.
- Existing Today/Calendar/Notes flows still work.
- Plan import/progress and AI route are protected by auth.

## P1 Multi-Series And Exceptions

Status: planned

Tasks:

- Add refinement series.
- Add passive/holding and retainer-specific flows.
- Add exception events: delayed change, tray extension, poor fit, lost/broken tray, waiting for rescan/refinement/retainer.
- Add per-tray notes/symptom tags.
- Add adherence-by-tray charts and forecast confidence labels.

Acceptance:

- User can pause or extend current schedule without losing history.
- Forecast clearly says "current known series only" when future refinements are unknown.
- Exception flows record events without giving clinical instructions.
