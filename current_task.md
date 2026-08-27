# Current task

**Version:** 3.1.5  
**Updated:** 2026-08-28

## Status

Phase 3 — **done** (intervals.icu two-way slice)

- [x] Publish plan (replace existing workouts on plan days)
- [x] Optional manual eFTP pull
- [x] Calendar events sync + status tags
- [x] Week ahead + missed sessions
- [x] Wellness write-back on RPE
- [x] Weather on all plan days (calendar icons + modal timeline)
- [x] Sleep/readiness fixes + 24h time format

## Netlify deploy (manual)

When updating production, run:

```bash
npm run prepare:netlify
```

This creates **`netlify-deploy/`** with only:
- `index.html`
- `netlify.toml`
- `netlify/functions/`

Excluded: all `.md` files, `package.json`, JSON backups, dev/git folders.

Upload **`netlify-deploy/`** to Netlify (drag & drop or `netlify deploy --dir=netlify-deploy`).

## Not planned

- Activity interval compliance
- Webhook / scheduled sync
- netlify-cli upgrade (for now)

## Notes

- Local dev: `npm run dev` (netlify dev for API proxies)
- Library workouts on intervals = metadata only; calendar gets full ZWO
