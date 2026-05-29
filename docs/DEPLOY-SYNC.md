# Production deploy sync (TransPak)

## Root cause of CODE_DRIFT (documented)

TransPak uses **three Git remotes**:

| Repo | Remote | Used by |
|------|--------|---------|
| `fyp` (monorepo) | `github.com/RanaAbdullah00/fyp` | Local dev, CI |
| `transpak-backend` (nested `.git`) | `github.com/RanaAbdullah00/transpak-backend` | **Render** |
| `transpak-frontend` (nested `.git`) | `github.com/RanaAbdullah00/transpak-frontend` | **Cloudflare Pages** |

Pushing only to `fyp/main` does **not** update Render until you sync the deploy repos.

## Sync deploy repos (after monorepo changes)

```bash
node scripts/sync-deploy-repos.mjs
```

Or manually:

```bash
cd transpak-backend && git add -A && git commit -m "sync" && git push origin main
cd transpak-frontend && git add -A && git commit -m "sync" && git push origin main
```

## Verify

```bash
npm run verify:production   # compares transpak-backend HEAD vs Render /api/health
npm run wait:production     # polls until commitMatch
```

## Render settings (confirm once)

- **Repository:** `RanaAbdullah00/transpak-backend` (or monorepo with root `transpak-backend`)
- **Branch:** `main`
- **Auto-Deploy:** On
- Manual deploy: **Clear build cache & deploy**

## Cloudflare Pages

- **Repository:** `RanaAbdullah00/transpak-frontend`
- **Build env:** `VITE_API_URL=https://transpak-backend-1.onrender.com`

## Optional: single monorepo deploy

Point Render at `fyp` with **Root Directory** `transpak-backend` and remove nested `.git` folders to avoid drift.
