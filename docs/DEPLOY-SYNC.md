# TransPak — Deterministic multi-repo deployment

## Architecture (single source of orchestration)

| Repository | Role | Deploy target |
|------------|------|---------------|
| **`fyp`** (this monorepo) | Development + CI orchestration only | Nothing deploys directly from here |
| **`transpak-backend`** | Render deploy repo | Render Web Service |
| **`transpak-frontend`** | Cloudflare deploy repo | Cloudflare Pages |

**Rule:** Production never deploys from feature branches or partial monorepo pushes alone.

Every meaningful change lands in `fyp/main` → CI runs `sync-deploy-repos.mjs` → both deploy repos update → Render + Cloudflare auto-deploy → verify chain.

## Deploy manifest (`deploy/manifest.json`)

Maps the three-repo chain:

```
fyp SHA + content hashes → backend repo SHA → frontend repo SHA → live asset fingerprint
```

- **Content hashes** detect monorepo drift without requiring identical git SHAs across repos.
- **assetFingerprint** is the Vite `index-*.js` hash from the production build.
- CI commits an updated manifest after each successful sync (with `[deploy-sync]`; pushes ignore manifest-only loops).

## Commands (run from monorepo root)

```bash
# Push monorepo subtrees to deploy repos (local nested .git or --ci in Actions)
npm run sync:deploy-repos

# Poll Render until manifest backend SHA is live
npm run wait:production

# Strict triple-chain + backend health (exit 1 on DRIFT STATE)
npm run verify:production

# Chain check only
npm run verify:deploy-chain -- --strict
```

### Local sync (requires nested `.git` in transpak-backend / transpak-frontend)

```bash
npm run sync:deploy-repos
npm run wait:production
npm run verify:production
```

### Idempotent sync

If `deploy/manifest.json` already matches current `fyp` HEAD and content hashes, sync exits without pushing.

## GitHub Actions (`deploy-sync.yml`)

On every push to `fyp/main` (except manifest-only commits):

1. Build frontend with `VITE_API_URL`
2. `sync-deploy-repos.mjs --ci` — clone deploy repos, copy subtrees, commit, push, SHA-verify via GitHub API
3. Optional Render deploy hook (`RENDER_DEPLOY_HOOK_URL` secret)
4. Wait for Render health
5. `verify-deploy-chain.mjs --strict`
6. `verify-production-alignment.mjs --strict`
7. Commit updated `deploy/manifest.json` back to `fyp`

### Required secrets

| Secret | Purpose |
|--------|---------|
| `DEPLOY_GITHUB_TOKEN` | PAT with `contents: write` on `transpak-backend` + `transpak-frontend` |
| `RENDER_DEPLOY_HOOK_URL` | Optional — force Render rebuild after sync |

## Drift detection

`verify-deploy-chain.mjs --strict` fails with **DRIFT STATE** when any of these mismatch:

- `fyp` HEAD vs manifest
- Nested deploy repo HEAD vs manifest (when present locally)
- GitHub `main` vs manifest (backend + frontend)
- Render live commit vs manifest backend SHA
- Cloudflare HTML bundle vs manifest `assetFingerprint`
- Multiple different JS bundles across production URLs

`verify:production` also fails on CODE_DRIFT and broken DB/schema when `--strict`.

## Cache control (Cloudflare)

`transpak-frontend/public/_headers`:

- `/` and `/index.html` — `no-cache, no-store` (HTML never stale)
- `/assets/*` — immutable long cache (fingerprinted filenames only)

Build embeds `<meta name="transpak-build" content="…">` for live verification.

## Render reliability

- `render.yaml`: `rootDir: transpak-backend` (monorepo) or `.` (backend-only repo)
- Build clears `node_modules`, `dist`, `.render-build-stamp.json` each deploy
- `startCommand`: `npm run db:migrate && node server.js` (migration lock = atomic per deploy)
- Health check: `/api/health` (includes `socketEngine: ready`)
- Production boot **exits** if Socket.io engine fails to initialize

## Acceptance criteria (production stable)

- [ ] `npm run verify:production` → FULL PASS (exit 0)
- [ ] Manifest maps fyp → backend → frontend SHAs
- [ ] Render commit == manifest backend SHA
- [ ] All Cloudflare URLs serve the same `index-*.js` fingerprint
- [ ] No manual deploy steps (CI chain on `fyp/main` push)

## Rollback / partial sync

If frontend push fails after backend push, `deploy/.sync-state.json` records partial state. Re-run:

```bash
npm run sync:deploy-repos -- --force
```

Or revert the backend deploy repo to the SHA listed in `.sync-state.json`.
