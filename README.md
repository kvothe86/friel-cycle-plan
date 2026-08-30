# VeloPlanner

Your personal **12-week** cycling plan generator. Fixed **3/1 blocks** — three weeks of progressive load followed by one recovery week.

**Live app:** [kvothe86.github.io/friel-cycle-plan](https://kvothe86.github.io/friel-cycle-plan/)

## Views

The app has four main views, switched from the header navigation:

| View | Purpose |
|------|---------|
| **List** | Week-by-week plan with prev/next navigation and session rows |
| **Calendar** | 4-week rolling grid; click workouts to open details and mark complete |
| **Dashboard** | CTL / ATL / form chart, readiness, Friel Coach, weekly TSS bars, plan timeline |
| **Guide** | Methodology, zones, and readiness reference |
| **Settings** | Generate or AI-import plan; FTP; intervals.icu; training-load baseline |

Plan settings moved out of the main flow into **Settings**. Generate a plan there, then use List or Calendar to follow it.

## Features

- **Training focuses:** Endurance (Fondo), Sprint, TT, Hills/Climbs, All-Round (FTP)
- **Fixed schedule:**
  - **Tue / Thu / Sat** — structured workouts (≤60 min)
  - **Sunday** — outdoor endurance (duration only; Fondo 1h30–3h, other focuses 1h30–2h30)
  - **Mon / Wed / Fri** — rest or optional recovery spin (≤90 min)
- **Auto-save** to browser `localStorage` (`veloplanner-v2`)
- **Export / import** full plan + progress as JSON (header buttons)
- **Zwift export** — downloads a ZIP of `.zwo` workout files (built-in, no external library)
- **Session tracking** — mark complete with RPE (1–10), skip, or undo (List rows and Calendar modal)
- **FTP prediction** — adjusts from expected vs actual RPE (conservative, ±8% cap for low volume)
- **Post-plan FTP test** — The Grade in Zwift, scheduled 3 days after final training
- **Training load dashboard** — CTL, ATL, and form (TSB) chart with optional baseline from intervals.icu / Strava
- **Workout detail modal** — click any session to view Zwift-style instructions, watt targets, intensity profile, and zone breakdown
- **Weather forecast** (intervals.icu) — hourly timeline on plan days; best dry ride window on outdoor Sundays; see [Weather forecast](#weather-forecast) below
- **Friel Coach (LLM)** — day-to-day adjustments: copy snapshot, paste coach JSON, apply on **Dashboard → Today's session**
- **AI Plan (LLM)** — custom 12-week block from your story: copy on **Settings**, paste `veloplanner-plan` JSON, apply
- **LLM chat shortcuts** — branded buttons (ChatGPT, Gemini, Claude, Mistral) open your preferred chat in a new tab; no API key in the app

## Workout detail modal

Click any **structured**, **endurance**, or **FTP test** row (List) or calendar workout pill to open the viewer.

| Panel | Contents |
|-------|----------|
| Instructions | Step blocks with Zwift zone colours; every step shows **% FTP and watts** (based on predicted/starting FTP) |
| Profile | Time-proportional intensity chart on a shared baseline, solid zone colours |
| Stats | Duration, estimated TSS, and Z1–Z6 time split |
| Completion | Mark done / skip / undo with RPE slider (Calendar and Sunday endurance in modal; always on List rows) |

Close with **×**, the backdrop, or **Escape**.

## Weather forecast

When intervals.icu is connected, the app syncs a **weather forecast** for your home location (same sync as wellness / training load). Forecast data appears on plan days in the **List** view and on **Sunday endurance** sessions.

### What you see

| UI element | When | Meaning |
|------------|------|---------|
| **Hourly timeline** | Tue / Thu / Sat workouts and other days with slots | Rain %, wind, and temperature per time slot for that calendar day |
| **Best ride window** | Sunday outdoor endurance | Suggested start time for the planned ride duration, favouring the driest contiguous window |

After you change location in intervals.icu or when the forecast updates, use **Sync** in Settings so the app replaces stored forecast data and refreshes the plan view.

### Best ride window logic

The Sunday advice picks a **contiguous dry window** long enough for that day's planned ride (typically 1h30–3h on Fondo, 1h30–2h30 on other focuses):

1. Sort slots by time for that day.
2. Prefer windows with **low rain probability** and **moderate wind** (wind is a tie-breaker).
3. Require the full ride to fit **inside daylight** — between sunrise and sunset from the daily forecast for that date. If no dry window fits in daylight, the driest option is still shown with a note that it may extend into dusk or darkness.

Outdoor Sunday rides are not exported to Zwift; the weather panel is guidance for when to ride outside.

### Forecast slot types (intervals.icu)

intervals.icu does not always return the same shape of data. The app normalises three kinds of slot:

| Type | Source | Typical times |
|------|--------|----------------|
| **Native hourly** | Real hourly points from the API | Whatever the API provides (often sparse early in the week) |
| **Derived hourly** | Daily summary split into four synthetic points | Morning, midday, afternoon, evening (sunrise used as morning anchor; sunset is not used as a ride start) |
| **Daily only** | Single row per day with min/max rain and wind | One slot; ride advice uses sunrise as earliest start |

**Timeline display** — the app shows the richest set available for each day:

1. Substantial **native hourly** (≥3 points, or ≥2 points at least 2 hours apart) — use native only; drop derived slots for that day so stale synthetic times do not override fresh hourly data.
2. Otherwise **derived hourly** (≥2 points) — e.g. four times per day from the daily forecast.
3. Otherwise **native hourly** if at least 2 points exist.
4. Otherwise **expand daily** — rebuild four derived times from the stored daily record on the fly.
5. Fall back to whatever slots exist.

This avoids two failure modes that were fixed in v3.1.6:

- **Stale window** — old derived slots mixed with new native hourly data kept suggesting yesterday’s timing after sync.
- **Single 09:00 slot** — one sparse native point (e.g. at sunrise) incorrectly removed all derived slots, so the timeline showed only one hour.

### Implementation notes

All logic lives in `index.html` (no separate weather module):

- `normalizeWeatherForecast()` — cleans synced payload; strips `derivedFromDaily` only when `hasSubstantialNativeHourly()` is true for that date.
- `forecastsForDate()` — chooses which slots to render in the timeline.
- `adviseDayWeather()` — computes best ride window with daylight checks via `daylightBoundsForDate()` / `rideFitsDaylight()`.
- `syncIntervalsWellness()` — always calls `renderPlan()` after a successful sync so weather panels update even before a plan is generated.

- `syncIntervalsWellness()` — fetches wellness, activities, weather, and events directly from intervals.icu `/api/v1/` (browser CORS). State key: `state.intervalsWeatherForecast` in `localStorage`.

## LLM workflows (free API tiers)

VeloPlanner calls LLM APIs directly from your browser. Add a free-tier key in **Settings → AI assistant** — see [free-llm.com](https://free-llm.com) for providers (Groq, Google AI Studio, OpenRouter, Mistral, …). Keys stay in localStorage only.

### Friel Coach — adjust today's plan

**Dashboard → Today's session**

1. Type your question (e.g. “Should I do today?” or “Table tennis tonight — swap to recovery”)
2. **Ask coach** — sends Friel instructions + live athlete snapshot (readiness, PMC, plan, compliance)
3. Review the reply → **Apply coach changes** (or use **Manual import**)

Export block: `veloplanner-coach` JSON with `actions` (adjust, skip, complete, revert, push). Spec: `friel-coach-context.md`.

### AI Plan — build a custom 12-week block

**Settings → AI Plan**

1. Write **Your story & constraints** (goal event, weekly life, cross-training, injuries)
2. **Generate plan** — sends plan-builder instructions + snapshot + workout preset catalog
3. Review the reply → **Apply AI plan** (replaces the current plan; manual import fallback)

Use static **Generate 12-Week Plan** for template plans by focus, or AI Plan when your schedule needs custom overrides (e.g. table tennis Wednesdays, shorter Sundays). Spec: `veloplanner-plan-context.md`.

### Context files (served with the app)

| File | Used by |
|------|---------|
| `friel-coach-context.md` | Friel Coach system prompt |
| `veloplanner-plan-context.md` | AI Plan system prompt |

Both are included in the GitHub Pages deploy bundle.

## Dashboard

Available after generating a plan. Shows:

- **Stat cards** — today's CTL, form (TSB), week-over-week ramp rate, and completed load vs planned TSS
- **Fitness & fatigue chart** — projected CTL / ATL / form across the plan; hover or click to inspect any day
- **Weekly volume** — planned TSS per week with blue overlay for completed work
- **Plan position** — 12-week block timeline with current week highlighted

Seed the chart from your real fitness data in **Settings → Training load baseline** (CTL, ATL, form, and anchor date).

## Tech stack

The app logic lives in a **single `index.html`** file, plus static assets at the repo root:

- **Outfit** font (Google Fonts)
- **Inlined Tailwind CSS** subset — no CDN or build step at runtime
- **Self-contained ZIP builder** for Zwift export (no JSZip dependency)
- **Embedded artwork** (logo and summary illustration as data URIs)
- **Favicons** — `favicon.ico`, `favicon.png`, and `apple-touch-icon.png`
- **LLM context** — `friel-coach-context.md`, `veloplanner-plan-context.md` (loaded by copy buttons)

Open `index.html` directly in a browser, or serve the folder locally. No `npm install` required.

### QHD / large display scaling

On wide screens the UI scales up automatically so text stays readable without browser zoom:

| Viewport width | Scale |
|----------------|-------|
| &lt; 2000px | 100% |
| 2000px+ | 110% |
| 2200px+ | 125% |
| 2560px+ (QHD) | 140% |

Typography, spacing, calendar cells, and charts all use `rem`-based sizing so they scale together.

## Run locally

```bash
npm run dev
```

Open [http://localhost:4317](http://localhost:4317)

Or open `index.html` directly in a browser (network needed only for the Google Font).

## Deploy

No build step at runtime. **Production is GitHub Pages** — auto-deploys on every push to `main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

**Live site:** https://kvothe86.github.io/friel-cycle-plan/

```bash
git push github main   # updates the live site (~1 min)
```

One-time setup: GitHub **Settings → Pages → Source: GitHub Actions**.

Local preview: `GITHUB_PAGES_BASE=/friel-cycle-plan/ npm run prepare:pages` then serve `pages-deploy/`.

**intervals.icu sync** calls the API directly from your browser (`/api/v1/` supports CORS). API key stays in localStorage — never on a server.

`.nojekyll` is included so GitHub Pages serves the app as-is.

## Zwift import

1. Generate a plan and click **Zwift**
2. Unzip the downloaded file
3. Copy `.zwo` files to `Documents/Zwift/Workouts/<your-zwift-id>/`
4. Restart Zwift — workouts appear under Custom Workouts
5. Set your Zwift FTP to match the value you entered in the app

Sunday endurance rides are outdoor/free rides and are not exported as Zwift workouts.

## Methodology

Plans follow classic periodization across three phases:

| Weeks | Phase | Focus |
|-------|-------|-------|
| 1–4   | Base  | Aerobic foundation, technique |
| 5–8   | Build | Sport-specific intensity |
| 9–12  | Peak  | Race-ready sharpening |

Each 4-week block ends with a recovery week (weeks 4, 8, 12).

Sunday endurance progresses by phase; recovery weeks reduce duration ~30%. Regenerate or use **AI Plan** to customize.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
