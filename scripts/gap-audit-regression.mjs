#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
  { name: 'validate-defect-fixes', cmd: 'node', args: ['transpak-backend/scripts/validate-defect-fixes.mjs'] },
  {
    name: 'db-integrity-check',
    cmd: 'node',
    args: ['transpak-backend/scripts/db-integrity-check.mjs', '--strict']
  },
  {
    name: 'release-gate-probe',
    cmd: 'node',
    args: ['scripts/release-gate-probe.mjs', '--strict-integrity']
  },
  { name: 'tracking-perf', cmd: 'node', args: ['scripts/gap-audit-tracking-perf.mjs'] },
  { name: 'cors', cmd: 'node', args: ['scripts/gap-audit-cors.mjs'] },
  { name: 'bid-stress', cmd: 'node', args: ['scripts/gap-audit-bid-stress.mjs'] },
  { name: 'status-integrity', cmd: 'node', args: ['scripts/gap-audit-status-integrity.mjs'] },
  { name: 'realtime', cmd: 'node', args: ['scripts/gap-audit-realtime.mjs'] },
  { name: 'notifications', cmd: 'node', args: ['scripts/gap-audit-notifications.mjs'] },
  { name: 'admin-data', cmd: 'node', args: ['scripts/gap-audit-admin-data.mjs'] },
  { name: 'capacity-expiry', cmd: 'node', args: ['scripts/gap-audit-capacity-expiry.mjs'] },
  { name: 'frontend-perf', cmd: 'node', args: ['scripts/gap-audit-frontend-perf.mjs'] }
];

function runStep(step) {
  const r = spawnSync(step.cmd, step.args, { cwd: root, encoding: 'utf8', shell: true });
  const out = (r.stdout || '') + (r.stderr || '');
  return { ...step, exitCode: r.status ?? 1, output: out.slice(-2000) };
}

function loadArtifacts() {
  const deploy = path.join(root, 'deploy');
  const files = fs.existsSync(deploy)
    ? fs.readdirSync(deploy).filter((f) => f.startsWith('gap-audit-') && f.endsWith('.json'))
    : [];
  const artifacts = {};
  for (const f of files) {
    try {
      artifacts[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(deploy, f), 'utf8'));
    } catch {
      /* ignore */
    }
  }
  return artifacts;
}

async function main() {
  const results = [];
  for (const step of scripts) {
    console.log(`\n=== ${step.name} ===`);
    const r = runStep(step);
    results.push(r);
    console.log(r.output || `(exit ${r.exitCode})`);
  }

  const artifacts = loadArtifacts();
  const passCount = results.filter((r) => r.exitCode === 0).length;
  const allPass = passCount === results.length;

  const summary = {
    at: new Date().toISOString(),
    pass: allPass,
    steps: results.map(({ name, exitCode }) => ({ name, pass: exitCode === 0 })),
    passCount,
    total: results.length,
    artifacts
  };

  const outFile = path.join(root, 'deploy', 'gap-audit-regression.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log(`\n${allPass ? 'PASS' : 'FAIL'} [regression] ${passCount}/${results.length}`);
  console.log('artifact:', outFile);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
