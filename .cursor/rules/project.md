# VeloPlanner — project conventions

**Current version:** 3.2.2

## Live site

- **Production:** GitHub Pages — https://kvothe86.github.io/friel-cycle-plan/
- **Repo:** https://github.com/kvothe86/friel-cycle-plan
- **Git remote:** `github` → GitHub (production). `origin` → Cursor-hosted mirror.
- **Deploy:** push to `github` `main` → GitHub Actions (`.github/workflows/deploy-pages.yml`) builds `pages-deploy/` and publishes automatically.

When the user says **“commit to GitHub”** (or similar), they mean: **commit locally and `git push github main`** so the live site updates. Do not stop at a local commit only.

## Local dev

```bash
npm run dev            # static server on http://localhost:4317
npm run prepare:pages  # preview GitHub Pages bundle in pages-deploy/
```

No build step. App is a single `index.html` plus static assets and LLM context markdown files.

## intervals.icu

- Browser calls `https://intervals.icu/api/v1/` directly (CORS supported). No server proxy.
- API key + athlete ID in localStorage / JSON export-import.

## Plan generation

- **Static:** Settings → focus + start date → **Generate 12-Week Plan**
- **Sunday durations:** Fondo 1h30–3h; other focuses 1h30–2h30 (recovery weeks ~70%)
- **AI Plan:** Settings → story + **Copy for AI plan** → LLM → **Apply AI plan** (`veloplanner-plan` JSON)

## Friel Coach (LLM)

- **Export:** Dashboard → Today's session → **Copy for coach**
- **Import:** **Paste coach reply** → **Apply coach changes** (`veloplanner-coach` JSON)
- **Chat shortcuts:** branded logo buttons → ChatGPT, Gemini, Claude, Mistral (new tab)
- Keep `.cursor/skills/friel-coach/SKILL.md` and `friel-coach-context.md` in sync.

## AI Plan (LLM)

- **Export:** Settings → **Copy for AI plan** (story + athlete snapshot + preset catalog)
- **Import:** **Paste AI plan reply** → **Apply AI plan**
- **Chat shortcuts:** same logo buttons as coach
- Keep `veloplanner-plan-context.md` in sync with the export schema in `index.html`.

## Git identity

If `git commit` fails on author identity, use `-c user.name=kvothe86 -c user.email=kvothe86@users.noreply.github.com` for that commit (do not set global git config unless the user asks).
