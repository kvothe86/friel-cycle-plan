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

## Run locally

```bash
npm run dev
```

Open [http://localhost:4317](http://localhost:4317)

Or open `index.html` directly in a browser (CDN requires network for Tailwind/JSZip).

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
