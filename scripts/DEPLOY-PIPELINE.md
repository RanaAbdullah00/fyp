# TransPak deployment pipeline — root cause & fix

## Why GitHub `main` did not update production

### Render (`a7f5fb32e94c` vs `38bfc71`)

Most common causes (check Dashboard → **transpak-backend-1**):

1. **Auto-Deploy disabled** — Settings → Build & Deploy → enable **Auto-Deploy**
2. **Wrong branch** — must be `main`
3. **Wrong root directory** — monorepo must use `transpak-backend` (see root `render.yaml`)
4. **Service created from old repo** — service may point at a different GitHub repo than `RanaAbdullah00/fyp`
5. **Blueprint not applied** — `render.yaml` only applies when creating via Blueprint; existing services use Dashboard settings
6. **Failed deploy** — Deploys tab → check last deploy failed silently

**Fix:** Manual Deploy → Deploy latest commit. Confirm **Environment** includes:

- `ENABLE_TRANSPAK_DEMO_ADMIN=true`
- `TRANSPAK_DEMO_ADMIN_EMAIL=mrrajpoot.327@gmail.com`
- `TRANSPAK_DEMO_ADMIN_PASSWORD=11223344` (Dashboard only — do not commit)

Optional: Settings → Deploy Hook → copy URL → `RENDER_DEPLOY_HOOK_URL=... node scripts/trigger-render-deploy.mjs`

### Cloudflare Pages (`index-CCWY7hVK.js` stale)

1. **Git integration not rebuilding** — Pages → project → Deployments → Retry
2. **Wrong build settings** — Root: `transpak-frontend`, Build: `npm ci && npm run build`, Output: `dist`
3. **Env** — `VITE_API_URL=https://transpak-backend-1.onrender.com`
4. **Cache** — Caching → Purge Everything after deploy

**CLI deploy:**

```powershell
cd transpak-frontend
npm run build
$env:CLOUDFLARE_API_TOKEN = "<token>"
npx wrangler pages deploy dist --project-name transpak-frontend
```

## Verify

```powershell
cd transpak-backend
npm run deploy:qa    # 14/14 when synced
npm run deploy:smoke
```
