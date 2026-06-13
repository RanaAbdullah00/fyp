# TransPak — Live deploy sync (manual steps)

When `npm run deploy:qa` fails on **build sync** or **favicon v6**, live CDN/API is behind git `main`.

## Expected (local, commit `7e96c1e`)

| Target | Expected |
|--------|----------|
| Render API build | `7e96c1e` (short SHA) |
| Frontend JS | `index-DDNhIt32.js` |
| Favicon | `/favicon.svg?v=6` |

## 1. Render backend

1. Open Render Dashboard → **transpak-backend** service.
2. Confirm branch `main`, root directory `transpak-backend` if monorepo.
3. **Manual Deploy → Deploy latest commit**.
4. Logs should show `[db] applying migration: 015_load_deadline_minutes.sql` and `[db] connected successfully`.
5. Verify: `/api/health` returns `"build":"7e96c1e..."`.

**Environment:** `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (include `https://cb3857ee.transpak-frontend.pages.dev`).

## 2. Cloudflare Pages

- Retry deployment from latest `main`, or `npx wrangler pages deploy dist --project-name transpak-frontend`
- Purge Cloudflare cache after deploy.

## 3. Verify

```powershell
cd transpak-backend
npm run deploy:qa
```

Target: **14/14** pass.
