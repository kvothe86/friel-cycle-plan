# Adaptive Cycling Coach — Product & Architecture Plan

> Working title. A ground-up rebuild. The previous app (VeloPlanner, single-file
> fixed 12-week plans) lives on in git history (`main` / commit `7d215ba`).

**One-line pitch:** *Tell it when you can ride and what you're aiming for — it
plans every ride, re-plans every day from your real health and performance
data, syncs with intervals.icu, and can run the workout on your smart trainer.*

Think JOIN-style adaptive planning, driven by intervals.icu data:
CTL/ATL/TSB, HRV, resting HR, sleep, eFTP, power curve and how well you
actually completed each workout.

---

## 1. Core principles

1. **Availability is the only required input per day.** "Tue 60 min, Thu 45,
   Sat 180, Sun 120" → the app decides what to do with each minute.
2. **The plan is a forecast, not a contract.** The next 14 days are always
   visible, but only *today* is committed. Everything after it is
   recalculated whenever something changes: a ride completed, skipped or
   partly done, new wellness data, or new availability.
3. **The long-term structure is fixed, the daily detail is not.** The
   macro plan (Base → Build → Peak → Taper) and the target CTL curve are
   stable anchors. The daily sessions move freely around them.
4. **Data first, but conservative.** Health metrics can *reduce* load
   on their own. They only *increase* load when several signals agree.
5. **Deterministic and explainable.** The same state always gives the
   same plan. Every session carries a short "why" ("VO2 key session —
   Build 2, TSB +4, HRV normal").
6. **intervals.icu is the source of truth for history.** The app owns the
   *future* (planned workouts) and reads the *past* (activities, wellness).

---

## 2. Feature scope

### 2.1 Onboarding / connection
- Enter intervals.icu **Athlete ID** and **API key** (Settings → Developer
  in intervals.icu). Auth is HTTP Basic: user `API_KEY`, password = key.
- On connect, pull: athlete profile (FTP, LTHR, max HR, weight, zones),
  the last 90–180 days of wellness and activities, the power curve and
  existing future events.
- Starting state comes from real data: current CTL/ATL, eFTP, recent
  weekly volume, typical ride days.

### 2.2 Goals (the long-term background schedule)
A goal is one of:

| Goal type | Input | Result |
|-----------|-------|--------|
| **Event** | Date + event type (road race, crit, TT, gran fondo, gravel, climb/hill event, stage race) + priority (A/B/C) | Periodised plan back-calculated from the event date |
| **Specialty** | Climbing, Sprint/Crit, Time Trial, Endurance/Fondo, Gravel, All-round FTP | Rolling blocks focused on that specialty, no end date |
| **Target date + metric** | "FTP 300 W by 1 June", "CTL 80 by 1 May" | Plan shaped to hit the metric on that date |

- Several goals are allowed. One **A goal** shapes the macro plan; **B/C
  events** get a mini-taper (B) or are trained through (C).
- Races added in intervals.icu (categories `RACE_A/B/C`) are picked up
  automatically as goals.

### 2.3 Availability
- **Weekly template:** minutes per weekday, plus an indoor/outdoor
  preference per day.
- **Per-date overrides:** "Wed 12 Nov: 30 min", "holiday 20–27 Dec: 0",
  "Sat: 4 h outdoor".
- Optional per-day flags: *indoor only*, *outdoor only*, *must be easy*
  (for example the day after a late shift).
- Changing availability triggers an immediate re-plan.

### 2.4 Plan views
- **Today:** the session, its intensity profile, the "why", a readiness
  badge and quick actions: *Ride in app*, *Done outside*, *Swap*, *Make
  easier*, *Skip*.
- **14-day view:** the next two weeks. Day 1 is committed; days 2–14 are
  shown as *tentative* (dimmed or with a dashed border).
- **Season view:** phases, weekly TSS targets vs. actual, and the
  projected CTL curve vs. the target CTL curve, up to the goal date.
- **History / analysis:** compliance per session (planned vs. actual
  TSS, IF, time in zone), plus HRV and RHR trends.

### 2.5 Sync with intervals.icu
- **Push:** planned workouts become intervals.icu `WORKOUT` events with
  structured workout text, so they show up on Garmin, Wahoo, Zwift and
  others through intervals.icu's own sync.
- **Pull:** completed activities, wellness, eFTP changes, user-created
  events and races.
- The app manages only its own events. Each one is tagged with an
  `external_id` (`acc-<date>-<slot>`). Workouts the user adds by hand in
  intervals.icu are treated as **fixed constraints**, not overwritten.

### 2.6 Local player (indoor ERG)
- Connect a smart trainer over **Bluetooth (FTMS)**, plus an optional HR
  strap and power meter.
- **ERG mode:** the app sets target watts per interval, with ramps and
  smoothing.
- Live screen: target vs. actual power, cadence, HR, interval timer and
  workout profile.
- Controls: pause, skip interval, intensity ±1–10 %, extend recovery.
- The ride is recorded, encoded to **FIT**, uploaded to intervals.icu and
  matched to the planned event → compliance → adaptation.

---

## 3. Training engine (the core)

The engine is a **pure TypeScript module** with no UI and no I/O, so it
can be unit-tested and simulated.

```
            ┌──────────────────────────────────────────────┐
 inputs ──▶ │ 1. Athlete state  (CTL/ATL/TSB, FTP, levels, │
            │                     readiness, history)      │
            │ 2. Macro planner  (goal → phases → CTL path) │
            │ 3. Week planner   (weekly load + key slots)  │
            │ 4. Day allocator  (availability → day types) │
            │ 5. Session builder(template × time × level)  │
            │ 6. Daily adjuster (readiness → modify today) │
            └──────────────────────────────────────────────┘
                              │
                              ▼
                   14-day plan + reasons
```

### 3.1 Athlete state
- **Load model:** Banister/PMC. CTL uses a 42-day constant, ATL a 7-day
  constant, TSB = CTL − ATL. Values come from intervals.icu where
  available and are projected forward with planned TSS.
- **FTP:** intervals.icu FTP setting, eFTP from the power curve, and
  in-app ramp/20-min tests. Raising FTP needs confirmation; lowering it
  only after a sustained trend.
- **Progression levels** (one per energy system: Endurance, Tempo,
  Sweet Spot, Threshold, VO2max, Anaerobic, Sprint), on a scale of 1.0–10.0.
  - Each workout template has a difficulty level per system.
  - Completing a session near the edge of your level raises it, failing
    lowers it, and the levels slowly decay with inactivity.
  - The session builder picks templates at *level + small step*. That
    gives progressive overload without fixed weekly scripts.
- **Readiness score** (0–100), recalculated every day:

  | Signal | Source | Weight idea |
  |--------|--------|-------------|
  | HRV (rMSSD) vs. 7-day mean and 60-day normal range | wellness `hrv` | high |
  | Resting HR vs. baseline | wellness `restingHR` | medium |
  | Sleep duration / score | wellness `sleepSecs`, `sleepScore` | medium |
  | TSB / ATL ramp | PMC | medium |
  | Subjective (fatigue, soreness, mood, motivation) | wellness fields or in-app check-in | medium |
  | Recent compliance (failed intervals) | activity analysis | low |

  Missing signals are skipped and the weights are renormalised. With no
  data, readiness is neutral.

### 3.2 Macro planner (long-term)
Input: goal(s), today, current CTL, and typical weekly hours from the
availability template.

1. **Timeline:** count the weeks to the A goal and split them into
   Friel-style phases:
   - Prep/Base 1–3 → Build 1–2 → Peak → Taper/Race → Transition
   - Short timelines (< 8 weeks) compress or skip Base. Long ones (> 24
     weeks) repeat base/build blocks.
   - **Recovery-week rhythm:** 3:1 by default, 2:1 as an option
     (masters, or high stress).
2. **Target CTL path:** from current CTL to a goal CTL that is realistic
   for the available hours (the hours cap the achievable CTL). Ramp
   limits are about +3 to +7 CTL per week, set by experience level. The
   path drops back during recovery weeks and taper.
3. **Weekly TSS target** = the TSS needed to follow the CTL path,
   capped by available time × a realistic IF.
4. **Intensity distribution per phase × specialty**, for example:

   | Phase | Default mix | Climbing tweak | Crit/Sprint tweak | TT tweak |
   |-------|-------------|----------------|-------------------|----------|
   | Base | Z2 heavy, tempo/SST, neuromuscular drills | long SST climbs at low cadence | sprint drills | SST on TT position |
   | Build | Threshold + VO2 key sessions | long threshold, over-unders | VO2 + anaerobic repeats | long threshold blocks |
   | Peak | race-specific, lower volume | climbing-specific efforts | race simulations, sprints | race-pace efforts |
   | Taper | volume ↓ 40–60 %, keep short intensity | | | |

   With a specialty goal and no date, the app cycles 4–6-week blocks:
   build that specialty, then a recovery/base block, then repeat.

The macro plan is recomputed only when goals or availability templates
change, or when the actual CTL drifts more than about 10 % from the path.

### 3.3 Week planner
For each week in the 14-day window, using the phase, the weekly TSS target
and the intensity mix:
- Decide the number of **key sessions**: 1 in recovery weeks, 2–3 in
  build weeks, depending on available days and hours.
- Rank session types by priority for this phase and specialty (for
  example Build/Climbing: 1. threshold climbs, 2. VO2, 3. long Z2).

### 3.4 Day allocator
This is a small constraint problem: greedy placement, then local search.
- Put key sessions on the **longest available slots**, first by priority.
- **No hard days back-to-back**, and at most 3 hard days a week.
- The long endurance ride goes on the longest day (usually the weekend).
- Fill the remaining available days with endurance or recovery to
  reach the weekly TSS. A rest day is allowed even when the day is
  available.
- Respect fixed constraints: manual intervals.icu workouts, races,
  "must be easy" flags.
- Short days (< 45 min) take compact intensity or recovery. Very short
  days (< 25 min) take an optional spin or rest.

### 3.5 Session builder
- A **workout library of parametric templates**, for example:
  `VO2 repeats: N × (D @ P% FTP, R @ 50%)`, with N, D and P ranges plus
  a difficulty function `level(N, D, P)`.
- Given (type, available minutes, target TSS, athlete level), it solves
  for N, D and P, adds a warm-up and cool-down sized to the time, and
  checks TSS and level.
- Output is a structured workout model, rendered to:
  - intervals.icu workout text (push)
  - the player's ERG step list
  - optionally `.zwo` and `.fit` workout files for export
- Outdoor sessions get a simpler format: time in zone or a target
  duration/TSS with a few efforts.

### 3.6 Daily adjuster and dynamic re-planning
Triggers: an app start or sync with new data, a completed or skipped
session, or an availability change.

| Situation | Action |
|-----------|--------|
| Readiness low (< 40) or illness flag | Today → recovery or rest. Key session moves to the next suitable day |
| Readiness reduced (40–60) | Downgrade: fewer reps or lower %, or swap to endurance |
| Readiness high + TSB positive + levels lagging | Allow a small step up (+1 level) |
| Session **skipped** | Key session: move it to the next free slot within 3 days if that doesn't create back-to-back hard days, otherwise drop it. Endurance: drop it. **Never cram the missed load** |
| Session **partially done / failed** | Lower the progression level for that energy system. Repeat the same type at a similar level next time |
| Unplanned ride uploaded | Count its TSS and intensity. Reshuffle the next days (a hard group ride replaces a key session) |
| Week behind on TSS | Spread a small part of the deficit (≤ 10 %) over the remaining days. Never add an extra hard day |

Re-planning = run steps 3.3–3.6 again from *tomorrow* over the
14-day window, keeping the macro plan. Only events that actually changed
are pushed to intervals.icu (diff by `external_id` + content hash).

### 3.7 Safety rails
- Weekly ramp cap (CTL +7/week max, ATL spike guard).
- Minimum 1 rest day per 7–10 days unless the user overrides it.
- Strongly negative TSB (< −30) blocks further intensity.
- Every automatic decision is logged, and the user can always override it.

---

## 4. intervals.icu integration

Base URL `https://intervals.icu/api/v1`, Basic auth (`API_KEY`:`<key>`).
The browser can call it directly (CORS works; the old app already did
this).

| Purpose | Endpoint (verify against the current API docs) |
|---------|-------------------------------------------------|
| Athlete profile, FTP, zones | `GET /athlete/{id}` |
| Wellness (CTL, ATL, HRV, RHR, sleep, subjective) | `GET /athlete/{id}/wellness?oldest=&newest=` |
| Activities | `GET /athlete/{id}/activities?oldest=&newest=` |
| Activity detail / streams (compliance) | `GET /activity/{aid}` · `GET /activity/{aid}/streams` |
| Power curve / eFTP | `GET /athlete/{id}/power-curves` |
| Read events (planned, races, notes) | `GET /athlete/{id}/events?oldest=&newest=` |
| Create/update workouts in bulk | `POST /athlete/{id}/events/bulk?upsert=true` (with `external_id`) |
| Delete a stale workout | `DELETE /athlete/{id}/events/{eventId}` |
| Upload a recorded FIT ride | `POST /athlete/{id}/activities` (multipart) |

Sync strategy:
- **Incremental pull:** keep the last-synced timestamps and refetch a
  sliding window of the last 7 days (data gets edited after the fact).
- **Push window:** only the 14-day horizon. Events the app owns outside
  it are removed or not created.
- **Conflicts:** if the user edits an app-owned event in intervals.icu
  (its content hash changes), that event becomes "user-owned" and turns
  into a constraint.
- **Activity ↔ plan matching:** same date + sport, closest start time
  and duration. Use `paired_event_id` when intervals.icu provides it.

Example of the workout text pushed to intervals.icu:
```
Warmup
- 10m ramp 50-75%

Main set 5x
- 4m 115%
- 4m 55%

Cooldown
- 8m 60%
```

---

## 5. Local player (Bluetooth ERG)

| Item | Choice |
|------|--------|
| Protocol | **FTMS** (Fitness Machine Service `0x1826`). Most current trainers support it (Wahoo, Tacx, Elite, Saris, Zwift Hub, Wattbike) |
| Control | Control Point `0x2AD9`: `0x00` request control → `0x07` start → `0x05` set target power (sint16 W) |
| Data | Indoor Bike Data `0x2AD2` (power, cadence, speed), plus the optional Cycling Power Service `0x1818` and Heart Rate `0x180D` |
| API | **Web Bluetooth**: works in Chrome/Edge on desktop and Android. **Not in iOS Safari.** iOS needs a native wrapper (Capacitor + BLE plugin) or the Bluefy browser |
| Fallback | Tacx FE-C over BLE for older trainers (later) |
| Recording | 1 Hz samples → FIT file (activity, session, laps per interval, records) → upload to intervals.icu |
| Reliability | Screen Wake Lock, auto-reconnect, local save every 10 s (IndexedDB), resume after a crash |
| ERG comfort | Ramp target changes over 2–3 s, low-cadence protection (drop target if < 60 rpm), "spin-down" pause |

---

## 6. Architecture & tech stack

**v1: a client-only PWA**, no backend. This is a single-user app; the
API key stays on the device.

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) | One language across engine, UI and BLE |
| UI | React + Vite, as an installable PWA | Fast, offline-capable, hosted on GitHub Pages |
| State | Zustand | Simple |
| Storage | IndexedDB (Dexie) | Cached activities and wellness, plan state, recorded rides |
| Charts | uPlot (live player) + a light chart lib for PMC | uPlot handles 1 Hz live data well |
| Engine | `src/engine`, pure functions, no I/O | Testable, simulatable |
| Tests | Vitest + simulation harness | Simulate 16 weeks with random skips, illness and availability changes, then assert ramp caps, no back-to-back hard days, and CTL near the target |
| FIT | `@garmin/fitsdk` (encode) | Official SDK |
| CI/CD | GitHub Actions → lint, test, build → GitHub Pages | |

Planned folder layout:
```
src/
  engine/         # athlete state, macro, week, day, session, adjuster
    library/      # parametric workout templates
  integrations/
    intervals/    # API client, mappers, sync, matching
  player/
    ble/          # FTMS, HR, CPS drivers
    recorder/     # sample buffer, FIT encoder
  store/          # Zustand + Dexie persistence
  ui/             # screens: Today, 14-day, Season, Player, Settings, Goals
tests/
  engine/  sim/
```

**Later (v2+), only if needed:** a small backend (for example Cloudflare
Workers + D1) for multi-user use, OAuth with intervals.icu, a nightly
re-plan cron and push notifications. Capacitor wrapper for iOS BLE.

---

## 7. Roadmap

| Milestone | Content | Done when |
|-----------|---------|-----------|
| **M0 Scaffold** | Vite/React/TS, lint, Vitest, CI, Pages deploy, PWA shell | Empty app is deployed |
| **M1 Connect & data** | intervals.icu client, settings, pull wellness/activities/profile, IndexedDB cache, PMC + readiness display | Real CTL/HRV visible in the app |
| **M2 Engine: macro + availability** | Goals UI, availability template + overrides, phase timeline, target CTL path, Season view | Goal → phases + weekly TSS shown |
| **M3 Engine: sessions** | Workout library (~30 templates), week planner, day allocator, session builder, 14-day view with "why" | Availability → 14 days of concrete workouts |
| **M4 Push/pull** | Push to intervals.icu with `external_id` upsert/diff, pull manual events/races as constraints, activity ↔ plan matching | Workouts appear in the intervals.icu calendar, completed rides get matched |
| **M5 Dynamic** | Daily adjuster, skip/partial handling, progression levels, re-plan triggers, simulation test suite | Skipping a day visibly reshapes the next days |
| **M6 Player** | Web Bluetooth FTMS + HR, ERG execution, live UI, FIT recording + upload | Full indoor ride in ERG → appears in intervals.icu |
| **M7 Polish** | FTP test protocols, export `.zwo`/`.fit`, B/C race mini-tapers, onboarding, explanations | |

---

## 8. Open decisions

1. **iOS:** is Android/desktop Chrome enough for the player in v1, or is
   iPhone/iPad required from the start (→ Capacitor)?
2. **Single user (just you) or multi-user?** That decides whether a
   backend/OAuth is needed.
3. **Outdoor rides:** structured intervals or mainly duration + zone
   guidance?
4. **Strength/other sports:** cycling only, or should non-cycling load
   from intervals.icu (running, gym) count towards fatigue? (Proposal:
   count TSS, don't plan it.)
5. **Name** for the new app.
