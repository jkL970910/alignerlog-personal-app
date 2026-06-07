# Loo牙管理器 Current Product Spec

## Product Positioning

**Loo牙管理器** is a Chinese-first personal PWA for clear-aligner / Invisalign-style treatment administration. It helps users import an existing aligner plan, track daily wear time, understand current tray progress, and ask a built-in AI dental assistant questions about their plan and logged behavior.

The product is not a diagnosis tool. It manages schedules, reminders, logs, summaries, and education. Clinical decisions remain with the user's dentist or orthodontist.

## Product Style

- User-facing language: Chinese.
- Brand family: inherits the Loo国宝库 feeling: personal, warm, careful, slightly ceremonial, and not generic medical SaaS.
- Mobile-first: primary experience is iPhone Safari / PWA Home Screen.
- Visual priority: dense progress cards, calendar timelines, adherence charts, and short decision-support copy.
- Avoid: cold hospital UI, heavy English labels, alarmist medical claims, or debug/internal wording.

## Core Medical Product Assumptions

- Wear-time goal is usually 20-22 hours/day; default to 22 hours/day but allow clinician-specific override.
- Tray change interval is clinician-specific; support 7, 10, 14, and custom-day protocols.
- A treatment course is series-based: initial active series, possible refinements, passive/holding period, and retainers.
- Users often start tracking after treatment has already begun, so import must support "I am already on tray X".
- The app may record exceptions such as delayed changes, poor fit, broken/lost tray, waiting for refinement, or passive holding, but must not recommend skipping ahead, going backward, or ignoring fit/pain issues.

## Current Implemented Baseline

- Vercel-hosted Next.js PWA.
- Separate Neon Postgres database.
- Registration/login with signed HttpOnly session cookie.
- Today wear-state toggle.
- Daily summaries with cross-midnight session splitting.
- Calendar with color status and daily notes.
- History chart and metrics.
- Settings for daily goal and basic treatment plan fields.
- JSON/CSV export.

## P0 Feature: Guided Plan Import And Progress

### User Goal

The user may already be wearing aligners and needs to import the current plan without manually backfilling every day.

### Guided Import Inputs

- Treatment status:
  - Not started
  - Active treatment
  - Holding/passive aligner
  - Waiting for refinement
  - Retainer phase
- Plan series name, default: `第一阶段`
- Series type:
  - Active
  - Refinement
  - Holding/passive
  - Retainer
- Current tray number.
- Total trays in the current known series.
- Current tray start date, or next planned tray-change date.
- Treatment start date if known.
- Tray interval: 7 / 10 / 14 / custom days.
- Daily wear goal, default 22h.
- Optional appointment date.
- Optional note from clinician instructions.

### Generated Plan Output

Generate planned tray schedule rows for the current known series:

- Tray number.
- Planned start date.
- Planned end/change date.
- Stage/series.
- Status:
  - upcoming
  - current
  - completed
  - extended
  - paused
  - skipped_by_clinician
- Source:
  - imported
  - generated
  - adjusted

Important boundary: generated rows are planned schedule data, not proof of actual wear. Actual adherence still comes from user logging.

### Progress Metrics

- Current stage card: show stage type, current-stage tray count, and `正在佩戴第 N 副`.
- Current stage completion: derived only from the current known series.
- Current tray cycle progress: derived from elapsed local hours between current-tray start and next planned change.
- Do not present an overall-treatment completion percentage unless the value is clinically reliable and explicitly sourced.
- Current tray day: `第 N 天 / 计划 M 天`.
- Days until next planned change.
- Trays remaining in current known series.
- Estimated current-series end date.
- If the current stage is on its final tray and the appointment date is later than the planned final-tray end date, default to recommending `延戴到复诊日`; the user must confirm before the schedule is adjusted.
- Today wear time vs goal.
- 7-day adherence percentage.
- Recent missed hours.
- Schedule status:
  - on track
  - behind due to extension
  - paused
  - waiting for refinement/retainer

## P1 Feature: Exception And Multi-Series Tracking

### Exception Actions

- 延长当前牙套.
- 延迟换下一副.
- 牙套不贴合.
- 牙套丢失/损坏.
- 等待 refinement / rescan.
- 等待保持器.
- 医生要求继续佩戴当前/上一副.
- 复诊衔接: when the last tray ends before the next doctor appointment, surface a confirmable extension to the appointment date instead of silently changing the plan.

Exception flows should record events and update the schedule when appropriate. They must include clinical safety copy and avoid giving treatment instructions.

### Multi-Series Timeline

Support multiple treatment series:

- Initial active series.
- Refinement 1 / 2 / later.
- Holding/passive aligner.
- Retainer.

Forecasts should be labeled as "current known series only" when future refinement duration is unknown.

## Floating AI Agent

### Name And Role

Working name: **Loo牙大臣**.

Persona: Chinese-speaking clear-aligner treatment administration assistant. It explains plan progress, summarizes adherence, highlights risks based on logged data, and prepares questions the user can ask their provider.

### Allowed Behaviors

- Explain the user's current plan status.
- Answer "我现在第几副 / 还剩几副 / 下次什么时候换".
- Summarize wear-time adherence.
- Identify logged patterns such as frequent long off-tray sessions.
- Explain common clear-aligner concepts in non-diagnostic language.
- Suggest what information to bring to the dentist/orthodontist.
- Clarify that generated schedule is based on imported plan assumptions.

### Disallowed Behaviors

- Diagnose dental conditions.
- Tell the user to skip ahead, go backward, or change trays early.
- Tell the user to ignore pain, poor fit, broken/lost trays, or clinical concerns.
- Claim treatment success from app logs alone.
- Provide emergency dental advice beyond contacting a professional.

### Provider Contract

- Routing: OpenRouter-compatible Responses endpoint, same style as Loo国.
- Model: fixed `gpt-5.5`.
- Reasoning effort: fixed `medium`.
- API key: server-side env only.
- Product UI must not expose AI model/key configuration.
- Prompt context should include only bounded user data needed for the current answer:
  - current treatment plan / series
  - current tray progress
  - recent wear summaries
  - recent exceptions
  - selected page context

## Safety Copy

Canonical short disclaimer:

> Loo牙管理器用于记录和理解你的佩戴计划，不提供诊断或医疗决策。牙套不贴合、疼痛、损坏、丢失或是否换下一副，请以牙医/正畸医生指导为准。
