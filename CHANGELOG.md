# Changelog

All notable changes to VeloPlanner.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.1.8] - 2026-08-29

### Added
- **Friel Coach LLM import/export** — paste coach replies containing a `veloplanner-coach` JSON block; **Apply coach changes** adjusts sessions, skip/complete, revert, or push to intervals.icu
- **GitHub Pages production deploy** — Actions workflow; live at kvothe86.github.io/friel-cycle-plan

### Changed
- **intervals.icu** — browser calls `/api/v1/` directly (CORS); no server proxy required
- **Local dev** — `npm run dev` serves static files only (removed Netlify CLI dependency)
- **Copy coach context** — export format instructions included; coach prompt updated in `friel-coach-context.md`

## [3.1.7] - 2026-08-28

### Added
- **Copy coach context** — Dashboard and Settings button copies the full Friel coach system prompt (`friel-coach-context.md`) plus a live athlete snapshot (readiness, PMC, plan, compliance, week ahead) for paste into Cursor or Codex chat; no API key required

## [3.1.6] - 2026-08-28

### Fixed
- **Stale best ride window** — ride-window advice could stay on old timings after a forecast update because synthetic hourly slots (derived from daily data) were mixed with real hourly data from intervals.icu; derived slots are now dropped only when native hourly coverage is substantial (≥3 points, or ≥2 points spanning ≥2 hours)
- **Single time slot (e.g. 09:00 only)** — a sparse native hourly point (often one anchor at sunrise) incorrectly caused all derived slots to be removed, leaving one row in the timeline; the app now keeps derived slots until real hourly data is sufficient, and re-expands daily forecasts on the fly when needed
- **Ride window after sync** — plan/calendar weather panels refresh on every successful intervals.icu sync (not only when a plan already exists)

### Changed
- **Daylight-aware ride windows** — Sunday outdoor endurance “best ride window” must fit fully between sunrise and sunset from the daily forecast; daily-only advice starts at sunrise and caps duration before sunset; if no window fits in daylight, the driest window is shown with an explicit note

## [3.1.5] - 2026-08-28

### Changed
- All times use 24-hour format (no AM/PM)

## [3.1.4] - 2026-08-28

### Changed
- Calendar weather: compact icon (sun/cloud/rain) + wind direction; full chronological forecast when opening a day

## [3.1.3] - 2026-08-28

### Fixed
- Weather shows multiple times per day (sunrise, 10:00, 13:00, afternoon, sunset) when intervals.icu only returns daily forecast; also parses 3-hourly data when available

## [3.1.2] - 2026-08-28

### Changed
- Weather forecast on every plan day (rest, indoor, structured) with times — hourly snapshots or best ride window on outdoor Sundays

## [3.1.1] - 2026-08-28

### Fixed
- Sleep and sleep score show the most recent wellness record (not only today/yesterday)
- Warning when today's sleep is not in yet; readiness penalized when last sleep is 2+ days old

## [3.1.0] - 2026-08-27

### Changed
- **Publish plan** always replaces existing workouts on plan days (one button; no separate republish)
- **eFTP is optional** — manual "Pull eFTP from intervals" only; no FTP pull on sync or push to intervals
- Workout targets use VeloPlan FTP unless you pull eFTP (switch back anytime)

### Removed
- Republish plan button, Pull/Push FTP buttons, "Pull FTP on sync" checkbox

## [3.0.2] - 2026-08-27

### Added
- **Republish plan** — removes existing workouts on plan days (duplicates and conflicts), then pushes the plan again with updated descriptions

### Fixed
- Intervals workout text uses correct duration syntax (`-2h30m z2`, not `-2h30 z2`)
- Intervals.icu settings no longer trigger browser/Bitwarden save-login prompts

## [3.0.1] - 2026-08-27

### Fixed
- Publish plan checks intervals.icu calendar first — skips veloplanner-* duplicates and days with other workouts
- Non-ZWO events (Sunday endurance, FTP test) use intervals workout text (`-2h30 z2`) with duration and load

## [3.0.0] - 2026-08-27

### Added
- **Publish plan** — bulk push upcoming workouts to intervals.icu calendar (upsert via `veloplanner-YYYY-MM-DD`)
- **Publish workout library** — unique structured workouts to a VeloPlanner folder
- **Pull calendar events** on sync — show icu/local/moved/other status on calendar and modals
- **FTP two-way** — pull Ride FTP from sport settings on sync; manual pull/push; auto-push after FTP test
- **Week ahead** dashboard panel — 7-day readiness hints + calendar sync tags
- **Missed sessions** panel — skip, push, or view past planned workouts without logged rides
- **Wellness write-back** — optional feel/fatigue/soreness to intervals when logging RPE
- **Planned vs actual TSS** — compare calendar event load and logged activity TSS
- **Sunday weather start time** used when pushing calendar events
- Netlify proxies: events, sport-settings, wellness-put, folders, workouts-bulk

## [2.3.3] - 2026-08-27

### Fixed
- JSON export/import now includes intervals.icu API key and athlete ID (local backup only)

## [2.3.2] - 2026-08-27

### Fixed
- Parse intervals.icu nested `daily`/`hourly` forecast arrays (was only reading location config, so only today appeared)
- Sync status shows forecast date range; daily-only Sundays get sunrise-based advice

## [2.3.1] - 2026-08-27

### Fixed
- Sunday weather panel always shows status (was silently hidden when forecast missing)
- Forecast date matching uses local timezone; credentials read from Settings inputs on sync

## [2.3.0] - 2026-08-27

### Added
- Sunday endurance weather advice from intervals.icu forecast: best dry start window + headwind/tailwind direction
- Proxies: `/api/intervals/weather-forecast`, `/api/intervals/weather-config`
- Weather fetched on sync; shown in Sunday workout modal and calendar

## [2.2.3] - 2026-08-27

### Added
- Auto-complete plan sessions from synced intervals.icu rides, using `icu_rpe` when logged

## [2.2.2] - 2026-08-27

### Changed
- Readiness panel shows HRV, sleep, sleep score, RHR, form & subjective metrics with horizontal bars and 7-day trends
- Score dampened when few signals available (no more 100% from RHR alone)
- HRV/sleep fall back to last 1–2 days when today's Garmin sync is incomplete

### Fixed
- Skip adjust/push suggestions when today's activity is already completed in intervals.icu

## [2.2.1] - 2026-08-27

### Fixed
- JavaScript parse error from duplicate orphaned code block — broke all buttons and nav styling

## [2.2.0] - 2026-08-27

### Added
- **Readiness score** (0–100) from HRV, resting HR, sleep, fatigue, soreness & stress vs 21-day baseline
- **Today's session** panel: adjust workout from readiness + form, revert, push to intervals.icu
- Activity sync from intervals.icu — actual TSS on calendar and weekly volume bars
- Netlify proxies: `/api/intervals/activities`, `/api/intervals/events-bulk`
- Settings toggle: push to intervals.icu when adjusting

### Changed
- Sync now pulls wellness + activities in parallel

## [2.1.0] - 2026-08-27

### Added
- Intervals.icu integration (Phase 1): Settings panel for API key + athlete ID
- Netlify serverless proxy (`/api/intervals/wellness`) for wellness sync
- Sync now / sync on app load — pulls 90 days of wellness data
- Auto-fill CTL / ATL / form baseline from intervals.icu
- Dashboard dual chart: solid = actual (intervals.icu), dashed = plan projection
- `npm run dev` via `netlify-cli@17.38.1` (static + functions); `npm run dev:static` for UI-only

### Fixed
- CTL/ATL sync now reads `ctl` / `atl` wellness fields (fitness/fatigue), not `ctlLoad` / `atlLoad`

## [2.0.0] - 2026-08-27

### Changed
- Rebrand from Friel Cycle Plan to VeloPlanner
- localStorage key `veloplanner-v2` with legacy migration from `friel-cycle-plan-v2`
- Zwift export paths and filenames use `veloplanner-zwift` prefix
- Favicon assets (`favicon.ico`, `favicon.png`, `apple-touch-icon.png`)

### Added
- v2 app: calendar view, training load dashboard, QHD scaling
- Settings view for plan generation and manual CTL/ATL baseline
