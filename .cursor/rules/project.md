# VeloPlanner — project conventions

## Live site

- **Production:** GitHub Pages — https://kvothe86.github.io/friel-cycle-plan/
- **Repo:** https://github.com/kvothe86/friel-cycle-plan
- **Git remote:** `github` → GitHub (production). `origin` → Cursor-hosted mirror.
- **Deploy:** push to `github` `main` → GitHub Actions (`.github/workflows/deploy-pages.yml`) builds `pages-deploy/` and publishes automatically.

When the user says **“commit to GitHub”** (or similar), they mean: **commit locally and `git push github main`** so the live site updates. Do not stop at a local commit only.

## Local dev

```bash
npm run dev          # static server on http://localhost:4317
npm run prepare:pages  # preview GitHub Pages bundle in pages-deploy/
```

No build step. App is a single `index.html` plus static assets.

## intervals.icu

- Browser calls `https://intervals.icu/api/v1/` directly (CORS supported). No server proxy.
- API key + athlete ID in localStorage / JSON export-import.

## Friel Coach (LLM)

- **Export:** Dashboard → Today's session → **Copy for coach**
- **Import:** Expand **Paste coach reply** on the same panel → **Apply coach changes**
- Keep `.cursor/skills/friel-coach/SKILL.md` and `friel-coach-context.md` in sync.

## AI Plan (LLM)

- **Export:** Settings → **Copy for AI plan** (includes athlete story + workout preset catalog)
- **Import:** Settings → **Paste AI plan reply** → **Apply AI plan**
- Keep `veloplanner-plan-context.md` in sync with the export schema in `index.html`.

## Git identity

If `git commit` fails on author identity, use `-c user.name=kvothe86 -c user.email=kvothe86@users.noreply.github.com` for that commit (do not set global git config unless the user asks).
