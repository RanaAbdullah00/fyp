#!/usr/bin/env node
/**
 * Static mobile/responsive audit — HTML + bundle markers (no Playwright).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND = (process.env.VITE_FRONTEND_URL || 'https://transpak-frontend.pages.dev').replace(/\/$/, '');
const VIEWPORTS = ['320', '375', '768', '1024'];

async function main() {
  const res = await fetch(FRONTEND, { headers: { Accept: 'text/html' } });
  const html = await res.text();
  const bundle = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[0];
  const hasViewport = /name=["']viewport["']/i.test(html);
  const results = [];

  let js = '';
  if (bundle) {
    js = await fetch(`${FRONTEND}/${bundle}`).then((r) => r.text());
  }

  for (const w of VIEWPORTS) {
    const markers = {
      mobileDrawer: js.includes('MobileDrawer') || js.includes('tp-mobile'),
      responsiveGrid: js.includes('dashboard-grid') || js.includes('tp-dashboard'),
      pagination: js.includes('Pagination'),
      adminWidget: js.includes('AdminWidgetShell') || js.includes('tp-admin')
    };
    results.push({
      viewport: `${w}px`,
      httpStatus: res.status,
      hasViewportMeta: hasViewport,
      bundleLoaded: Boolean(bundle),
      markers,
      pass: res.ok && hasViewport && Boolean(bundle)
    });
  }

  const out = path.join(root, 'deploy', 'post-deploy-audit-mobile.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), frontend: FRONTEND, results }, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Mobile static audit: ${results.length - failed}/${results.length} passed → ${out}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
