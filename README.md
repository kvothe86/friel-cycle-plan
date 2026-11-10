# CyclingHub

Personal, desktop-only adaptive cycling training app:
availability-driven daily planning, long-term periodisation around a goal,
dynamic re-planning from intervals.icu health and performance data,
two-way intervals.icu sync, sickness mode with return-to-training, and a Bluetooth ERG player.

See **[PLAN.md](PLAN.md)** for the full product and architecture plan.

## Status

| Milestone | Status |
|-----------|--------|
| M0 Scaffold (Vite + React + TS, lint, tests, CI, Pages deploy) | ✅ |
| M1 Connect & data (intervals.icu: profile, wellness, activities, PMC, readiness) | ✅ |
| M2 Goals, availability, season plan (Base/Build/Peak, target CTL) | ✅ |
| M3 Sessions: workout library, week planner, 14-day view with reasons | ✅ |
| M4 Push/pull planned workouts with intervals.icu, fixed days, compliance | ✅ |
| M5 Dynamic: readiness adjustments, skip/easier/swap, no cramming, sickness mode, progression levels | ✅ |
| M6–M7 | ❌ |

## Development

Requires Node 22+. Use desktop Chrome or Edge (Web Bluetooth).

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm test
npm run build      # output in dist/
```

## Deploy

`.github/workflows/ci.yml` runs lint, tests and build on every push and PR.
Pushes to `main` are also deployed to GitHub Pages
(repo Settings → Pages → Source: **GitHub Actions**).

The previous app (VeloPlanner) is preserved in git history.
