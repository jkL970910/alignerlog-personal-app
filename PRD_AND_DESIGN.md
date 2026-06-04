# AlignerLog Personal App — Product Requirement & Design Document

## 1. Project Overview

> Implementation note: the initial PRD was local-first and did not require
> login. The active implementation direction is now a cloud-first personal PWA:
> Vercel-hosted Next.js, Postgres via `DATABASE_URL`, single-user password
> login, and iPhone usage through the deployed mobile URL.

### Current Cloud Decision Overrides

The historical sections below are preserved as the original product baseline,
but implementation should follow these current decisions when they conflict:

* Use Vercel + managed Postgres as the first deploy target.
* Treat the deployed Vercel URL as the mobile PWA URL for iPhone Safari and
  Home Screen install.
* Require password login before any page or API can access personal tracking
  data.
* Store app data in Postgres, not IndexedDB/Dexie, for the active cloud-first
  version.
* Defer Cloudflare Workers, cron, and Web Push until reminder delivery becomes
  the active feature slice.

### 1.1 Project Name

**AlignerLog**

Personal-use clear aligner tracking app for iOS users, designed as a free alternative for tracking Invisalign-style aligner wear time, reminders, historical trends, and treatment progress.

### 1.2 Background

The user is currently using Invisalign-style clear aligners and needs a lightweight personal app to:

* Track daily aligner wear time.
* Record when aligners are taken out and put back in.
* Visualize historical wear-time data.
* Receive reminders to put aligners back in after meals or breaks.
* Track current tray number and tray change schedule.
* Avoid unnecessary subscription fees or heavy commercial app features.

This project is intended for **personal use only** and should not copy any third-party branding, UI, icons, trademarks, or proprietary designs.

### 1.3 Product Goal

Build a mobile-first iOS-friendly PWA that can be installed on the iPhone Home Screen and used like a lightweight app.

The first version should be simple, reliable, and local-first.

Primary goal:

> Help the user consistently wear clear aligners for the target number of hours per day by combining frictionless tracking, historical visualization, and timely reminders.

---

## 2. Target User

### 2.1 Primary User

A single personal user wearing Invisalign-style clear aligners.

### 2.2 User Context

* Uses iOS.
* Wants a free or near-free personal solution.
* Wants to avoid App Store deployment and Apple Developer Program if possible.
* Needs frequent daily interaction.
* Needs simple one-tap logging.
* Needs reminder support.
* Wants historical data visualization.

### 2.3 Key User Scenarios

1. User removes aligners for eating.
2. User wants to be reminded after 30–60 minutes.
3. User puts aligners back in and wants the app to record it.
4. User checks today’s total wear time.
5. User checks whether the daily goal has been met.
6. User reviews past 7 / 14 / 30 days of compliance.
7. User tracks current tray number and next tray change date.
8. User exports data if needed.

---

## 3. Product Principles

### 3.1 Simplicity First

The app should prioritize fast daily usage. The Today screen must be usable in under 3 seconds.

### 3.2 Event-Based Tracking

Do not rely on a continuously running timer for persistence.

The app should store timestamped events:

* aligners taken out
* aligners put back in

Daily wear time should be calculated from these events.

### 3.3 Local-First Data

All sensitive tracking data should stay on the device by default.

For MVP:

* No login.
* No cloud sync.
* No account system.
* No medical or dental data uploaded.

### 3.4 Progressive Enhancement

Start with local-only tracking. Add push reminders later.

### 3.5 Personal Use, No Medical Claims

The app should avoid giving medical advice. It should include a disclaimer:

> Follow your orthodontist’s instructions for wear time and tray changes.

---

## 4. Scope

## 4.1 MVP Scope

MVP must include:

* Today screen
* One-tap “I took my aligners out”
* One-tap “I put my aligners back in”
* Current status: Wearing / Out
* Today’s wear time
* Daily goal progress
* Active off-tray duration
* Basic historical chart
* Local IndexedDB persistence
* Settings for daily goal
* PWA installability
* JSON / CSV data export

## 4.2 V1 Scope

V1 should include:

* Calendar view
* Color-coded day status
* Daily notes
* Treatment plan settings
* Current tray number
* Days per tray
* Next tray change date
* Bedtime reminder placeholder
* Notification permission UI

## 4.3 V2 Scope

V2 should include:

* Web Push reminders
* Cloudflare Worker backend
* Meal reminder scheduling
* Reminder cancellation when aligners are put back in
* Tray change reminder
* Optional backup / restore

## 4.4 Out of Scope for Early Versions

Do not implement in MVP:

* Apple Watch support
* Native iOS app
* App Store deployment
* Login system
* Subscription system
* AI diagnosis
* Dental photo analysis
* Doctor portal
* Live Activities
* Siri Shortcuts
* Complex appointment management

---

## 5. Functional Requirements

## 5.1 Today Screen

### Requirement ID: FR-001

The app must show current aligner status.

Possible states:

* Wearing
* Out

Acceptance criteria:

* If status is Wearing, primary button says: `I took my aligners out`.
* If status is Out, primary button says: `I put my aligners back in`.
* Status persists after page refresh.

---

### Requirement ID: FR-002

The app must start an off-tray session when the user taps `I took my aligners out`.

Acceptance criteria:

* A new `OffTraySession` is created.
* `startAt` is set to current timestamp.
* `endAt` remains empty.
* WearState is updated to `isWearing = false`.
* UI immediately updates to Out state.

---

### Requirement ID: FR-003

The app must end the active off-tray session when the user taps `I put my aligners back in`.

Acceptance criteria:

* The active session receives an `endAt` timestamp.
* WearState is updated to `isWearing = true`.
* Today’s summary recalculates.
* UI immediately updates to Wearing state.

---

### Requirement ID: FR-004

The app must calculate today’s wear time.

Calculation:

```text
todayWearMinutes = elapsedMinutesToday - offTrayMinutesToday
```

For a full completed day:

```text
dailyWearMinutes = 1440 - offTrayMinutes
```

For current day:

```text
dailyWearMinutes = minutesElapsedSinceStartOfDay - offTrayMinutesSoFar
```

Acceptance criteria:

* Same-day sessions are calculated correctly.
* Active off-tray session is included in current calculation.
* Cross-midnight sessions are split correctly.
* Display format is `21h 35m`.

---

### Requirement ID: FR-005

The app must show progress against the daily goal.

Default daily goal:

```text
22 hours = 1320 minutes
```

Acceptance criteria:

* Show total worn time.
* Show target goal.
* Show remaining time to goal.
* Show progress percentage.
* If goal is met, show positive completion state.

---

## 5.2 History Screen

### Requirement ID: FR-006

The app must show a 14-day wear-time bar chart.

Acceptance criteria:

* X-axis shows dates.
* Y-axis shows wear hours.
* Each bar represents one day.
* Data is calculated from local sessions.
* Active current-day session is reflected.

---

### Requirement ID: FR-007

The app must show summary metrics.

Metrics:

* 7-day average wear time
* 30-day average wear time
* Goal achievement rate
* Longest goal-meeting streak
* Average off-tray duration
* Longest off-tray session

Acceptance criteria:

* Metrics update when sessions change.
* Metrics use current daily goal setting.
* Empty data state is handled gracefully.

---

## 5.3 Calendar Screen

### Requirement ID: FR-008

The app must show a monthly calendar view.

Day color logic:

| Status | Condition                       |
| ------ | ------------------------------- |
| Green  | wearMinutes >= goalMinutes      |
| Yellow | wearMinutes >= goalMinutes - 60 |
| Red    | wearMinutes < goalMinutes - 60  |
| Gray   | no data                         |

Acceptance criteria:

* Current month is shown by default.
* User can move to previous or next month.
* Each day is color-coded.
* Tapping a day shows detailed summary.

---

### Requirement ID: FR-009

The app must support daily notes.

Acceptance criteria:

* User can add or edit a note for a specific date.
* Note persists locally.
* Note appears in day detail view.

---

## 5.4 Settings Screen

### Requirement ID: FR-010

The app must allow daily goal configuration.

Acceptance criteria:

* Default is 1320 minutes.
* User can set goal using hours and minutes.
* Goal persists locally.
* History and calendar update based on new goal.

---

### Requirement ID: FR-011

The app must support treatment plan settings.

Fields:

* Treatment start date
* Current tray number
* Total trays
* Days per tray
* Next tray change date

Acceptance criteria:

* User can update settings.
* Next tray date is calculated.
* Data persists locally.

---

### Requirement ID: FR-012

The app must support data export.

Export formats:

* JSON
* CSV

Acceptance criteria:

* JSON exports all local data.
* CSV exports daily summaries.
* Export works on mobile Safari where possible.
* No backend is required.

---

### Requirement ID: FR-013

The app must support data reset.

Acceptance criteria:

* User must confirm before reset.
* Reset clears sessions, summaries, settings, and notes.
* App returns to initial state.

---

## 5.5 Reminder Screen

### Requirement ID: FR-014

The app must include reminder settings.

Fields:

* Meal reminder duration: 30 / 45 / 60 / 90 minutes
* Enable meal reminder
* Bedtime reminder time
* Enable bedtime reminder
* Enable tray change reminder
* Notification permission status

Acceptance criteria:

* Settings persist locally.
* Notification features can be disabled.
* MVP can include placeholder UI before backend is implemented.

---

### Requirement ID: FR-015

V2 must support Web Push meal reminders.

Trigger:

* User taps `I took my aligners out`.

Behavior:

* Schedule a reminder at `now + mealReminderMinutes`.

Cancellation:

* If user taps `I put my aligners back in` before reminder time, cancel reminder.

Acceptance criteria:

* Backend stores only anonymous reminder data.
* Push is sent if aligners are still out.
* Push is not sent if reminder was canceled.
* No sensitive dental data is stored server-side.

---

## 6. Non-Functional Requirements

## 6.1 Performance

* Today screen should load quickly on mobile.
* All local calculations should complete instantly for normal personal data volume.
* App should work smoothly with at least 3 years of daily data.

## 6.2 Reliability

* Data should persist after refresh.
* Active session should survive refresh.
* Active session should survive browser close and reopen.
* Cross-midnight calculation must be reliable.

## 6.3 Privacy

* MVP must keep all tracking data local.
* No account system.
* No analytics by default.
* No third-party tracking scripts.
* No upload of health-related data.

## 6.4 Accessibility

* Large tap targets.
* Clear button labels.
* Sufficient contrast.
* Avoid relying on color alone; also include text status.

## 6.5 Mobile UX

* Primary target: iPhone Safari / iOS Home Screen PWA.
* Layout must be mobile-first.
* Bottom navigation preferred.
* Primary action button should be reachable by thumb.

---

## 7. Recommended Tech Stack

## 7.1 Frontend

```text
Next.js App Router
TypeScript
React
Tailwind CSS
Recharts
Dexie.js
date-fns
```

## 7.2 Local Storage

```text
IndexedDB via Dexie.js
```

## 7.3 PWA

```text
Web App Manifest
Service Worker
iOS Home Screen meta tags
Local-first offline shell
```

## 7.4 Future Backend

```text
Cloudflare Worker
Cloudflare KV or D1
Web Push with VAPID
Cron trigger every 5 minutes
```

## 7.5 Testing

```text
Vitest for utility logic
React Testing Library for key UI flows
Playwright optional for end-to-end tests
```

---

## 8. System Architecture

## 8.1 MVP Architecture

```text
iPhone PWA
  |
  |-- Next.js / React UI
  |
  |-- Dexie local database
  |
  |-- Calculation utilities
  |
  |-- Recharts visualization
  |
  |-- PWA manifest / service worker
```

## 8.2 V2 Reminder Architecture

```text
iPhone PWA
  |
  |-- Push subscription
  |
  v
Cloudflare Worker API
  |
  |-- Store subscription and scheduled reminders
  |
  v
Cloudflare KV / D1
  |
  v
Worker Cron
  |
  v
Web Push notification
```

---

## 9. Data Model

## 9.1 TreatmentPlan

```ts
type TreatmentPlan = {
  id: string;
  startDate: string;
  currentTrayNumber: number;
  totalTrays?: number;
  daysPerTray: number;
  dailyGoalMinutes: number;
  createdAt: string;
  updatedAt: string;
};
```

## 9.2 WearState

```ts
type WearState = {
  id: string;
  isWearing: boolean;
  currentOffSessionId?: string;
  lastChangedAt: string;
  updatedAt: string;
};
```

## 9.3 OffTraySession

```ts
type OffTraySession = {
  id: string;
  startAt: string;
  endAt?: string;
  reason?: "meal" | "drink" | "brushing" | "other";
  reminderAt?: string;
  reminderStatus?: "none" | "scheduled" | "sent" | "cancelled";
  createdAt: string;
  updatedAt: string;
};
```

## 9.4 DailyNote

```ts
type DailyNote = {
  id: string;
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};
```

## 9.5 ReminderSettings

```ts
type ReminderSettings = {
  id: string;
  enableMealReminder: boolean;
  mealReminderMinutes: number;
  enableBedtimeReminder: boolean;
  bedtimeReminderTime: string;
  enableTrayChangeReminder: boolean;
  updatedAt: string;
};
```

## 9.6 DailySummary

DailySummary may be calculated dynamically instead of stored.

```ts
type DailySummary = {
  date: string;
  offMinutes: number;
  wearMinutes: number;
  goalMinutes: number;
  trayNumber?: number;
  sessionCount: number;
  longestOffSessionMinutes: number;
  goalMet: boolean;
};
```

Recommendation:

* Store raw sessions.
* Calculate summaries dynamically.
* Optional: cache summaries later if performance becomes an issue.

---

## 10. Core Calculation Rules

## 10.1 Active Session

If an off-tray session has no `endAt`, it is active.

When calculating current day:

```text
effectiveEndAt = now
```

## 10.2 Cross-Midnight Split

If a session starts before midnight and ends after midnight, split it by local calendar day.

Example:

```text
Start: 2026-05-31 23:50
End:   2026-06-01 00:20
```

Calculation:

```text
2026-05-31 offMinutes += 10
2026-06-01 offMinutes += 20
```

## 10.3 Current-Day Wear Time

For current date:

```text
minutesElapsedToday = now - startOfToday
wearMinutes = minutesElapsedToday - offMinutesToday
```

## 10.4 Past-Day Wear Time

For completed past date:

```text
wearMinutes = 1440 - offMinutes
```

## 10.5 Future Dates

Future dates should not show summaries.

---

## 11. UI Design Ideas

## 11.1 Navigation

Use bottom navigation:

```text
Today | History | Calendar | Reminders | Settings
```

## 11.2 Today Screen Layout

Top section:

```text
AlignerLog
Today, May 31
Current Tray: #4
```

Status card:

```text
Status: Wearing
Today worn: 21h 35m
Goal: 22h
Remaining: 25m
```

Primary button:

```text
I took my aligners out
```

If aligners are out:

```text
Status: Out
Out for: 37m
Reminder: in 8m
Primary button: I put my aligners back in
```

Secondary stats:

```text
Off-tray sessions today: 3
Longest off-tray session: 42m
```

Disclaimer:

```text
Follow your orthodontist’s instructions for wear time and tray changes.
```

## 11.3 History Screen Layout

Cards:

```text
7-day average: 21h 42m
30-day average: 21h 10m
Goal met: 80%
Current streak: 5 days
```

Chart:

```text
Last 14 Days Wear Time
```

List:

```text
May 31 — 21h 35m — Goal almost met
May 30 — 22h 10m — Goal met
May 29 — 18h 45m — Below goal
```

## 11.4 Calendar Screen Layout

Header:

```text
May 2026
< Previous | Next >
```

Calendar grid:

* Green day: goal met.
* Yellow day: close to goal.
* Red day: below goal.
* Gray day: no data.

Day detail card:

```text
May 31
Wear time: 21h 35m
Off time: 2h 25m
Sessions: 3
Note: ...
```

## 11.5 Reminders Screen Layout

Settings:

```text
Meal reminder: Enabled
Remind me after: 45 minutes

Bedtime reminder: Enabled
Time: 10:30 PM

Tray change reminder: Enabled
Next change: June 4
```

Permission state:

```text
Notifications: Not enabled
[Enable Notifications]
```

## 11.6 Settings Screen Layout

Sections:

1. Daily Goal
2. Treatment Plan
3. Data Export
4. Reset Data
5. About

---

## 12. Reminder Design

## 12.1 MVP Reminder Strategy

MVP may include only reminder settings UI and local placeholder logic.

No push backend required in MVP.

## 12.2 V2 Web Push Strategy

When the user takes aligners out:

```text
Create OffTraySession locally
Schedule reminder via backend
```

Backend reminder object:

```ts
type ScheduledReminder = {
  id: string;
  userId: string;
  reminderType: "meal" | "bedtime" | "trayChange";
  nextReminderAt: string;
  cancelled: boolean;
  sentAt?: string;
};
```

Server must not store:

* wear history
* tray history
* notes
* photos
* dental provider information

## 12.3 Push Notification Copy

Meal reminder:

```text
Your aligners have been out for 45 minutes. Remember to put them back in.
```

Bedtime reminder:

```text
Don’t forget to wear your aligners before sleep.
```

Tray change reminder:

```text
Today may be your tray change day. Follow your orthodontist’s instructions before switching.
```

---

## 13. Privacy & Security Design

## 13.1 Local Data

Data stored locally:

* Sessions
* Wear state
* Daily notes
* Treatment plan
* Reminder settings

## 13.2 Backend Data

Only for V2 push reminders:

* Anonymous user ID
* Push subscription
* Next reminder time
* Reminder status

## 13.3 Export

Export should be user-triggered only.

## 13.4 No Analytics

Do not include Google Analytics, Meta Pixel, or third-party tracking.

---

## 14. Edge Cases

## 14.1 User Forgets to Tap “Put Back In”

If aligners remain Out for a very long time:

* Show warning state.
* Continue counting off-tray duration.
* Let user manually correct session later in V1 or V2.

Future enhancement:

```text
Edit session start/end time manually
```

## 14.2 User Taps Wrong Button

MVP:

* Allow undo for last action if easy.

V1:

* Add session edit page.

## 14.3 Browser Refresh

App must restore:

* current state
* active session
* today summary

## 14.4 Timezone Change

Use local timezone for daily views.

If user travels, sessions should still be calculated based on current local timezone for display.

## 14.5 Multiple Tabs

Avoid duplicate active sessions.

When starting a session:

* Check if active session already exists.
* If yes, do not create another.

---

## 15. Development Roadmap

## Phase 0 — Project Setup

Goal:

Set up clean project foundation.

Deliverables:

* Next.js project
* TypeScript
* Tailwind
* Dexie
* Recharts
* Vitest
* Basic routing
* Bottom nav

Exit criteria:

* App runs locally.
* Build passes.
* Basic empty pages exist.

---

## Phase 1 — Local Data Layer

Goal:

Build reliable local persistence and calculation logic.

Deliverables:

* Dexie schema
* TypeScript models
* WearState helpers
* OffTraySession helpers
* Daily summary calculation
* Cross-midnight splitting
* Unit tests

Exit criteria:

* Core utility tests pass.
* Session calculations are reliable.

---

## Phase 2 — Today Screen

Goal:

Build the main daily-use interface.

Deliverables:

* Wearing / Out status
* Primary action button
* Active session display
* Today wear time
* Daily goal progress
* Session count
* Live UI refresh

Exit criteria:

* User can track a real day locally.
* Refresh does not lose state.

---

## Phase 3 — History Screen

Goal:

Add historical data visualization.

Deliverables:

* 14-day bar chart
* 7-day average
* 30-day average
* Goal achievement rate
* Longest streak
* Daily summary list

Exit criteria:

* Charts update from real local data.
* Empty state works.

---

## Phase 4 — Calendar Screen

Goal:

Add month-level compliance view.

Deliverables:

* Monthly calendar
* Day status color logic
* Day detail card
* Daily notes

Exit criteria:

* User can review historical compliance by month.

---

## Phase 5 — Settings & Export

Goal:

Make the app configurable and portable.

Deliverables:

* Daily goal settings
* Treatment plan settings
* Reminder settings placeholder
* JSON export
* CSV export
* Reset data

Exit criteria:

* User can configure personal aligner plan.
* User can export and reset data.

---

## Phase 6 — PWA Installation

Goal:

Make app usable from iPhone Home Screen.

Deliverables:

* Manifest
* Icons
* Apple mobile web app meta tags
* Service worker
* Install instructions

Exit criteria:

* App can be added to iPhone Home Screen.
* App opens in standalone mode where supported.

---

## Phase 7 — Web Push Reminders

Goal:

Add real reminders.

Deliverables:

* Notification permission UI
* Service worker push handler
* Push subscription
* Cloudflare Worker API
* KV / D1 reminder storage
* Cron reminder sender
* Cancel reminder endpoint

Exit criteria:

* User receives reminder after aligners are out too long.
* Reminder is canceled if aligners are put back in.

---

## 16. Project Tracker

| ID           | Phase | Task                                               | Priority | Status      | Acceptance Criteria                                       |
| ------------ | ----: | -------------------------------------------------- | -------- | ----------- | --------------------------------------------------------- |
| SETUP-001    |     0 | Initialize Next.js + TypeScript + Tailwind project | P0       | Not Started | App runs locally                                          |
| SETUP-002    |     0 | Add routing and bottom navigation                  | P0       | Not Started | Today, History, Calendar, Reminders, Settings pages exist |
| SETUP-003    |     0 | Add Dexie, Recharts, Vitest                        | P0       | Not Started | Dependencies installed and build passes                   |
| DATA-001     |     1 | Define TypeScript data models                      | P0       | Not Started | Models compile without errors                             |
| DATA-002     |     1 | Create Dexie database schema                       | P0       | Not Started | IndexedDB tables created                                  |
| DATA-003     |     1 | Implement WearState helpers                        | P0       | Not Started | Can get/create/update wear state                          |
| DATA-004     |     1 | Implement startOffTraySession                      | P0       | Not Started | Active session created correctly                          |
| DATA-005     |     1 | Implement endActiveOffTraySession                  | P0       | Not Started | Active session closes correctly                           |
| DATA-006     |     1 | Implement daily summary calculation                | P0       | Not Started | Wear/off minutes calculated correctly                     |
| DATA-007     |     1 | Implement cross-midnight splitting                 | P0       | Not Started | Sessions crossing midnight split correctly                |
| DATA-008     |     1 | Add unit tests for calculation logic               | P0       | Not Started | Tests pass                                                |
| TODAY-001    |     2 | Build Today page status card                       | P0       | Not Started | Shows Wearing / Out                                       |
| TODAY-002    |     2 | Build primary toggle button                        | P0       | Not Started | Starts and ends sessions                                  |
| TODAY-003    |     2 | Show today wear time                               | P0       | Not Started | Displays correct h/m format                               |
| TODAY-004    |     2 | Show goal progress                                 | P0       | Not Started | Progress updates with data                                |
| TODAY-005    |     2 | Show active off-tray duration                      | P0       | Not Started | Live duration updates while Out                           |
| TODAY-006    |     2 | Add disclaimer                                     | P1       | Not Started | Disclaimer visible                                        |
| HISTORY-001  |     3 | Build 14-day bar chart                             | P0       | Not Started | Chart uses local summaries                                |
| HISTORY-002  |     3 | Add 7-day and 30-day averages                      | P0       | Not Started | Metrics correct                                           |
| HISTORY-003  |     3 | Add goal achievement rate                          | P1       | Not Started | Rate calculated correctly                                 |
| HISTORY-004  |     3 | Add longest streak metric                          | P1       | Not Started | Streak calculated correctly                               |
| HISTORY-005  |     3 | Add daily summary list                             | P1       | Not Started | List renders correctly                                    |
| CAL-001      |     4 | Build monthly calendar                             | P1       | Not Started | Month grid renders                                        |
| CAL-002      |     4 | Add day color logic                                | P1       | Not Started | Green/yellow/red/gray status works                        |
| CAL-003      |     4 | Add day detail card                                | P1       | Not Started | Tap day shows details                                     |
| CAL-004      |     4 | Add daily notes                                    | P2       | Not Started | Notes persist                                             |
| SETTINGS-001 |     5 | Build daily goal setting                           | P0       | Not Started | Goal persists and affects summaries                       |
| SETTINGS-002 |     5 | Build treatment plan setting                       | P1       | Not Started | Tray number and days per tray persist                     |
| SETTINGS-003 |     5 | Build reminder settings placeholder                | P1       | Not Started | Settings persist locally                                  |
| SETTINGS-004 |     5 | Add JSON export                                    | P1       | Not Started | Full data exports                                         |
| SETTINGS-005 |     5 | Add CSV export                                     | P1       | Not Started | Daily summaries export                                    |
| SETTINGS-006 |     5 | Add reset data flow                                | P1       | Not Started | Confirmation required                                     |
| PWA-001      |     6 | Add web manifest                                   | P0       | Not Started | Manifest validates                                        |
| PWA-002      |     6 | Add iOS meta tags                                  | P0       | Not Started | Home Screen friendly                                      |
| PWA-003      |     6 | Add service worker                                 | P1       | Not Started | Basic offline shell works                                 |
| PWA-004      |     6 | Add install instructions                           | P2       | Not Started | User can follow steps                                     |
| PUSH-001     |     7 | Add notification permission UI                     | P1       | Not Started | User can request permission                               |
| PUSH-002     |     7 | Add service worker push handler                    | P1       | Not Started | Push event can display notification                       |
| PUSH-003     |     7 | Build Cloudflare Worker API                        | P1       | Not Started | Can save subscription                                     |
| PUSH-004     |     7 | Schedule meal reminder                             | P1       | Not Started | Reminder stored after aligners taken out                  |
| PUSH-005     |     7 | Cancel reminder                                    | P1       | Not Started | Reminder canceled after aligners put back in              |
| PUSH-006     |     7 | Add Worker cron sender                             | P1       | Not Started | Due reminders are sent                                    |

---

## 17. Suggested Codex Workflow

For every development task:

1. Ask Codex to read this design document.
2. Pick one tracker item or one small group of related items.
3. Ask Codex to implement only that scope.
4. Run build and tests.
5. Review diff.
6. Commit.

Recommended instruction pattern:

```text
Read docs/PRD_AND_DESIGN.md first.

Implement tracker item DATA-006 only.

Do not change unrelated UI.
Do not introduce backend.
Run tests and fix failures.
Keep the implementation simple and type-safe.
```

---

## 18. MVP Definition of Done

MVP is done when:

* User can open app on iPhone.
* User can add it to Home Screen.
* User can tap “I took my aligners out”.
* User can tap “I put my aligners back in”.
* App calculates today’s wear time.
* App shows last 14 days history.
* App persists data after refresh.
* App allows daily goal configuration.
* App exports data.
* Build passes.
* Core calculation tests pass.

---

## 19. Future Enhancements

Potential future improvements:

* Manual session editing
* Undo last action
* Teeth photo timeline stored locally
* Tray-by-tray progress page
* iCloud backup via manual file export
* Shortcuts integration
* Native SwiftUI version
* Apple Watch companion app
* More advanced charts
* PDF report export

---

## 20. Key Design Decision Summary

| Decision         | Choice                       | Reason                                           |
| ---------------- | ---------------------------- | ------------------------------------------------ |
| Platform         | PWA first                    | Free, iOS Home Screen friendly, avoids App Store |
| Data storage     | IndexedDB                    | Local-first and private                          |
| Tracking method  | Event timestamps             | More reliable than timer persistence             |
| Visualization    | Recharts                     | Fast implementation in React                     |
| Reminder V1      | Placeholder                  | Avoid backend complexity in MVP                  |
| Reminder V2      | Web Push + Cloudflare Worker | Free/low-cost and compatible with PWA            |
| Authentication   | None                         | Personal use only                                |
| Medical features | None                         | Avoid medical claims and complexity              |
| Branding         | Original                     | Avoid copying third-party app identity           |

---
