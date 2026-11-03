#!/usr/bin/env node
/**
 * Lifecycle of the ephemeral Home Assistant container.
 *
 *   node scripts/ha.mjs up     [--version=stable] [--dir=run] [--port=8123]
 *   node scripts/ha.mjs wait   [--url=http://127.0.0.1:8123] [--timeout=300]
 *   node scripts/ha.mjs logs
 *   node scripts/ha.mjs down
 *
 * `up` mounts the prepared run directory as /config, exactly like the demo
 * stand's compose file, and binds the port to loopback only. `wait` is what
 * the test run gates on: the API answers, onboarding is done, and the House
 * Plan frontend bundle is served by the integration (so the config entry has
 * actually loaded, not just the core).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const NAME = process.env.HA_CONTAINER || 'hp-e2e';
const cmd = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (cmd === 'up') {
  const version = arg('version', process.env.HA_VERSION || 'stable');
  const dir = resolve(ROOT, arg('dir', 'run'));
  const port = arg('port', '8123');
  spawnSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
  execFileSync('docker', [
    'run', '-d', '--name', NAME,
    '-p', `127.0.0.1:${port}:8123`,
    '-v', `${dir}:/config`,
    '-e', 'TZ=Europe/Moscow',
    `ghcr.io/home-assistant/home-assistant:${version}`,
  ], { stdio: 'inherit' });
  console.log(`home-assistant:${version} → http://127.0.0.1:${port} (config ${dir})`);
} else if (cmd === 'wait') {
  const url = arg('url', process.env.HA_URL || 'http://127.0.0.1:8123').replace(/\/$/, '');
  const timeout = Number(arg('timeout', '300')) * 1000;
  // the sidebar panel entry exists from v1.73.0-beta.5; older releases under
  // test (the upgrade suite starts from one) ship only the card
  const dir = resolve(ROOT, arg('dir', process.env.E2E_RUN_DIR || 'run'));
  const expectsPanel = existsSync(resolve(dir, 'custom_components/houseplan/frontend/houseplan-panel.js'));
  const started = Date.now();
  const probe = async (path) => {
    try {
      const r = await fetch(`${url}${path}`, { redirect: 'manual' });
      return r.status;
    } catch { return 0; }
  };
  let stage = '';
  while (Date.now() - started < timeout) {
    const api = await probe('/api/');
    if (api === 401 || api === 200) {
      // the frontend bundle is registered by the integration's own HTTP view:
      // 200 here means async_setup_entry ran, not merely that the core is up
      const bundle = await probe('/houseplan_files/houseplan-card.js');
      const panel = expectsPanel ? await probe('/houseplan_files/houseplan-panel.js') : 'n/a';
      const next = `api ${api}, card ${bundle}, panel ${panel}`;
      if (next !== stage) { stage = next; console.log(`${Math.round((Date.now() - started) / 1000)}s: ${stage}`); }
      if (bundle === 200 && (!expectsPanel || panel === 200)) {
        // give the frontend a moment to finish its own startup work
        await sleep(3000);
        console.log('home assistant is ready');
        process.exit(0);
      }
    } else if (stage !== `api ${api}`) {
      stage = `api ${api}`;
      console.log(`${Math.round((Date.now() - started) / 1000)}s: ${stage}`);
    }
    await sleep(2000);
  }
  console.error('home assistant did not become ready in time');
  spawnSync('docker', ['logs', '--tail', '80', NAME], { stdio: 'inherit' });
  process.exit(1);
} else if (cmd === 'logs') {
  spawnSync('docker', ['logs', NAME], { stdio: 'inherit' });
} else if (cmd === 'down') {
  spawnSync('docker', ['rm', '-f', NAME], { stdio: 'inherit' });
} else {
  console.error('usage: ha.mjs up|wait|logs|down');
  process.exit(2);
}
