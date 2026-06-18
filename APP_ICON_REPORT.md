# App Icon & Splash Audit Report

**Date:** 2026-06-17  
**Project:** `transpak-mobile-frontend`

---

## Before (issues)

| Config key | Asset | Problem |
|------------|-------|---------|
| `icon` | `landing.png` (1376×680) | Non-square — expo-doctor fail |
| `android.adaptiveIcon.*` | `landing.png` | Non-square |
| `splash.image` | `landing.png` | Non-square |
| `web.favicon` | `landing.png` | Wrong aspect |

Square assets existed but were **unwired**.

---

## After (fixed)

| Config key | Asset | Dimensions |
|------------|-------|------------|
| `icon` | `./assets/icon.png` | 1024×1024 |
| `android.adaptiveIcon.foregroundImage` | `./assets/android-icon-foreground.png` | 512×512 |
| `android.adaptiveIcon.backgroundImage` | `./assets/android-icon-background.png` | — |
| `android.adaptiveIcon.monochromeImage` | `./assets/android-icon-monochrome.png` | — |
| `splash.image` (app.config.js) | `./assets/splash-icon.png` | 1024×1024 |
| `web.favicon` | `./assets/favicon.png` | 48×48 |

Files changed: `app.json`, `app.config.js`

---

## Asset checklist

| Asset | Present | Wired | Square |
|-------|---------|-------|--------|
| `icon.png` | Yes | Yes | Yes |
| `splash-icon.png` | Yes | Yes | Yes |
| `android-icon-foreground.png` | Yes | Yes | Yes |
| `android-icon-background.png` | Yes | Yes | Yes |
| `android-icon-monochrome.png` | Yes | Yes | Yes |
| `favicon.png` | Yes | Yes | Yes |
| `landing.png` | Yes | No (retained for marketing) | No |

---

## expo-doctor result

```
17/18 checks passed
1 failed: app.json + app.config.js merge notice
```

Non-square icon warning **resolved**. Remaining warning is Expo advisory about dual config files (`app.config.js` spreads `app.json` via `require('./app.json')` — functional).

---

## Export evidence

`npx expo export --platform android`: **PASS** — 1100 modules, `dist/` generated

---

## No images generated

Per scope: only config wiring of existing assets. No placeholder generation.
