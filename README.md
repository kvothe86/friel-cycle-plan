# Friel Cycle Plan

A single-page cycling training plan generator based on **Joe Friel's** periodization principles. Generates a fixed **12-week (3-month)** plan with **3/1 blocks** — three weeks of progressive load followed by one recovery week.

## Features

- **Training focuses:** Endurance (Fondo), Sprint, TT, Hills/Climbs, All-Round (FTP)
- **Fixed schedule:**
  - **Tue / Thu / Sat** — structured workouts (≤60 min)
  - **Sunday** — endurance ride (duration recommendation only)
  - **Mon / Wed / Fri** — rest or optional recovery spin (≤90 min)
- **Auto-save** to browser `localStorage`
- **Export / import** full plan as JSON
- **Zwift export** — downloads a ZIP of `.zwo` workout files for all structured sessions
- **Session tracking** — mark complete with RPE (1–10), skip, or undo
- **FTP prediction** — adjusts from expected vs actual RPE (conservative, ±8% cap for low volume)
- **Post-plan FTP test** — The Grade in Zwift, scheduled 3 days after final training
- **Workout detail modal** — click any session to view Zwift-style instructions, watt targets, intensity profile, and zone breakdown

## Workout detail modal

Click any **structured**, **endurance**, or **FTP test** row to open the workout viewer.

| Panel | Contents |
|-------|----------|
| Instructions | Step blocks with Zwift zone colours; every step shows **% FTP and watts** (based on predicted/starting FTP) |
| Profile | Time-proportional intensity chart on a shared baseline, solid zone colours |
| Stats | Duration, estimated TSS, and Z1–Z6 time split |

Close the modal with **×**, the backdrop, or **Escape**.

## Run locally

```bash
npm run dev
```

Open [http://localhost:4317](http://localhost:4317)

Or open `index.html` directly in a browser (CDN requires network for Tailwind/JSZip).

## Deploy on GitHub Pages

Your repo is ready — `index.html` is at the root and `.nojekyll` is included.

1. **Push to GitHub** (if not already there):
   - In Cursor: use **Publish to GitHub** or create a repo at [github.com/new](https://github.com/new)
   - Then in terminal:
   ```bash
   git remote add github https://github.com/YOUR_USERNAME/friel-cycle-plan.git
   git push -u github main
   ```

2. **Enable Pages** on the GitHub repo:
   - **Settings → Pages**
   - Build from: **main** branch, **/ (root)** folder
   - Save

3. Live at: `https://YOUR_USERNAME.github.io/REPO_NAME/`

No build step needed. Every `git push` updates the site within ~1 minute.

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

### Workout modal fixes
- **Close button** — modal dismiss now wired to the modal element (×, backdrop, Escape)
- **Watt display** — warmup, cooldown, intervals, and steady blocks all show calculated watts alongside % FTP
- **Profile chart** — rebuilt with pixel-height bars, shared baseline, solid Zwift zone colours, and stepped ramps (no floating/misaligned bars)

### Workout duration fixes
- **Interval repeats preserved** — 3×12 and 3×15 threshold sessions no longer drop to 2 repeats
- **~60 min sessions** — short workouts get Z2 filler; long ones trim cooldown/recovery first (never interval count)
- **Zwift cooldown ramp** — cooldown exports as stepped SteadyState blocks (compatible with Zwift and intervals.icu)
