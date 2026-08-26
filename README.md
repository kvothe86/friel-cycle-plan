# Friel Cycle Plan (VeloPlanner)

A single-page cycling training plan generator based on **Joe Friel's** periodization principles. Generates a fixed **12-week (3-month)** plan with **3/1 blocks** — three weeks of progressive load followed by one recovery week.

**Live app:** [veloplanner.netlify.app](https://veloplanner.netlify.app/)

## Views

The app has four main views, switched from the header navigation:

| View | Purpose |
|------|---------|
| **List** | Week-by-week plan with prev/next navigation and session rows |
| **Calendar** | 4-week rolling grid; click workouts to open details and mark complete |
| **Dashboard** | CTL / ATL / form chart, weekly TSS bars, and plan timeline |
| **Settings** | Generate or clear plan; set FTP; seed training-load baseline |

Plan settings moved out of the main flow into **Settings**. Generate a plan there, then use List or Calendar to follow it.

## Features

- **Training focuses:** Endurance (Fondo), Sprint, TT, Hills/Climbs, All-Round (FTP)
- **Fixed schedule:**
  - **Tue / Thu / Sat** — structured workouts (≤60 min)
  - **Sunday** — endurance ride (duration recommendation only)
  - **Mon / Wed / Fri** — rest or optional recovery spin (≤90 min)
- **Auto-save** to browser `localStorage` (`friel-cycle-plan-v2`)
- **Export / import** full plan + progress as JSON (header buttons)
- **Zwift export** — downloads a ZIP of `.zwo` workout files (built-in, no external library)
- **Session tracking** — mark complete with RPE (1–10), skip, or undo (List rows and Calendar modal)
- **FTP prediction** — adjusts from expected vs actual RPE (conservative, ±8% cap for low volume)
- **Post-plan FTP test** — The Grade in Zwift, scheduled 3 days after final training
- **Training load dashboard** — CTL, ATL, and form (TSB) chart with optional baseline from intervals.icu / Strava
- **Workout detail modal** — click any session to view Zwift-style instructions, watt targets, intensity profile, and zone breakdown

## Workout detail modal

Click any **structured**, **endurance**, or **FTP test** row (List) or calendar workout pill to open the viewer.

| Panel | Contents |
|-------|----------|
| Instructions | Step blocks with Zwift zone colours; every step shows **% FTP and watts** (based on predicted/starting FTP) |
| Profile | Time-proportional intensity chart on a shared baseline, solid zone colours |
| Stats | Duration, estimated TSS, and Z1–Z6 time split |
| Completion | Mark done / skip / undo with RPE slider (Calendar and Sunday endurance in modal; always on List rows) |

Close with **×**, the backdrop, or **Escape**.

## Dashboard

Available after generating a plan. Shows:

- **Stat cards** — today's CTL, form (TSB), week-over-week ramp rate, and completed load vs planned TSS
- **Fitness & fatigue chart** — projected CTL / ATL / form across the plan; hover or click to inspect any day
- **Weekly volume** — planned TSS per week with blue overlay for completed work
- **Plan position** — 12-week block timeline with current week highlighted

Seed the chart from your real fitness data in **Settings → Training load baseline** (CTL, ATL, form, and anchor date).

## Tech stack

Everything ships in a **single `index.html`** file:

- **Outfit** font (Google Fonts)
- **Inlined Tailwind CSS** subset — no CDN or build step at runtime
- **Self-contained ZIP builder** for Zwift export (no JSZip dependency)
- **Embedded artwork** (logo and summary illustration as data URIs)

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

No build step. Push `index.html` (and `.nojekyll` for GitHub Pages) to any static host.

### Netlify

Connect the repo or drag-and-drop the folder. Publish directory is the repo root. Live example: [veloplanner.netlify.app](https://veloplanner.netlify.app/).

### GitHub Pages

1. Push to GitHub
2. **Settings → Pages** → build from **main**, **/ (root)**
3. Site updates on each push (~1 minute)

`.nojekyll` is included so GitHub Pages serves the app as-is.

## Zwift import

1. Generate a plan and click **Zwift**
2. Unzip the downloaded file
3. Copy `.zwo` files to `Documents/Zwift/Workouts/<your-zwift-id>/`
4. Restart Zwift — workouts appear under Custom Workouts
5. Set your Zwift FTP to match the value you entered in the app

Sunday endurance rides are outdoor/free rides and are not exported as Zwift workouts.

## Methodology

Plans follow Friel-style periodization across three phases:

| Weeks | Phase | Focus |
|-------|-------|-------|
| 1–4   | Base  | Aerobic foundation, technique |
| 5–8   | Build | Sport-specific intensity |
| 9–12  | Peak  | Race-ready sharpening |

Each 4-week block ends with a recovery week (weeks 4, 8, 12).

## Changelog

### v2 — Multi-view app (current)

- **List / Calendar / Dashboard / Settings** navigation
- **4-week calendar** with colour-coded workout pills and in-modal completion
- **Dashboard** with CTL / ATL / form chart, weekly TSS bars, and plan timeline
- **Training load baseline** in Settings (CTL, ATL, TSB from intervals.icu or Strava)
- **Flat UI redesign** — Outfit font, design tokens, embedded artwork
- **Self-contained build** — inlined Tailwind, built-in ZIP export, no runtime CDN deps
- **QHD scaling** — responsive root font-size up to 140% on 2560px+ displays

### Workout modal fixes

- **Close button** — modal dismiss wired to ×, backdrop, and Escape
- **Watt display** — warmup, cooldown, intervals, and steady blocks show calculated watts alongside % FTP
- **Profile chart** — time-proportional bars, shared baseline, solid Zwift zone colours, stepped ramps

### Workout duration fixes

- **Interval repeats preserved** — 3×12 and 3×15 threshold sessions no longer drop to 2 repeats
- **~60 min sessions** — short workouts get Z2 filler; long ones trim cooldown/recovery first (never interval count)
- **Zwift cooldown ramp** — cooldown exports as stepped SteadyState blocks (compatible with Zwift and intervals.icu)
