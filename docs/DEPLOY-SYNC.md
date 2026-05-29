# Production deploy sync (Render + Cloudflare)

## Target commit

After pushing to `main`, production must report the same commit as local:

```bash
git rev-parse --short=12 HEAD
npm run verify:production
```

## Render (backend)

1. Dashboard → **transpak-backend** → **Settings** → confirm **Root Directory** = `transpak-backend` (monorepo) or `.` if backend-only repo.
2. **Branch** = `main`, **Auto-Deploy** = On.
3. **Manual Deploy** → **Clear build cache** → Deploy.
4. Logs must show: `[build] stamp written … 60db455…` and `[deploy] commit=60db455…`.
5. Health: `GET https://transpak-backend-1.onrender.com/api/health` → `commit` matches git.

## Cloudflare Pages (frontend)

1. Project → **Deployments** → **Retry deployment** on latest `main` (or trigger new build).
2. Build env: `VITE_API_URL=https://transpak-backend-1.onrender.com`
3. Optional: `VITE_APP_BUILD_ID` from CI commit SHA (Vite sets from `CF_PAGES_COMMIT_SHA` when present).

## Verify locally

```bash
npm run verify:production
npm run wait:production
```

`wait:production` polls until remote commit matches `60db455` (or pass another short SHA).

## If CODE_DRIFT persists

- Render did not rebuild from latest `main` (redeploy + clear cache).
- Wrong GitHub repo/branch connected in Render.
- Multiple Render services — ensure the URL in `VITE_API_URL` is the service you updated.
