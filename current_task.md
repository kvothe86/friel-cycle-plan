# Current task

**Version:** 3.1.8  
**Updated:** 2026-08-29

## Status

Production on **GitHub Pages** (auto-deploy on push to `github` `main`).

Recent:
- [x] GitHub Pages + Actions deploy
- [x] intervals.icu direct API (no proxy)
- [x] Friel Coach LLM import/export (`veloplanner-coach` JSON block)

## Deploy (production)

```bash
git push github main
```

GitHub Actions runs → live at https://kvothe86.github.io/friel-cycle-plan/

Local Pages preview:

```bash
GITHUB_PAGES_BASE=/friel-cycle-plan/ npm run prepare:pages
npx serve pages-deploy
```

## Local dev

```bash
npm run dev   # http://localhost:4317
```

## Friel Coach loop

1. **Copy coach context** (Dashboard / Settings)
2. Paste into Cursor or Codex + ask question
3. Coach replies with Verdict/Prescription + optional ` ```veloplanner-coach` JSON
4. **Apply coach changes** in VeloPlanner

Format spec: `friel-coach-context.md` → VeloPlanner export block.

## Not planned

- Activity interval compliance
- Webhook / scheduled sync

## Notes

- Library workouts on intervals = metadata only; calendar gets full ZWO
- JSON export/import includes intervals API key if saved
