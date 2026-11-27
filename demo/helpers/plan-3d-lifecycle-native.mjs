import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { fixture, mountResumeFixture } from './plan-3d-resume-fixture.mjs';

// Run in a disposable headed Chromium profile (e.g. xvfb-run -a node ...).
// The plan tab is never attached to a debugger before the native discard.
const srv = resolve(fileURLToPath(new URL('../srv', import.meta.url)));
const manifest = JSON.parse(await readFile(join(srv, 'assets/houseplan-assets.json'), 'utf8'));
const gpuModule = manifest.files.find(file => /(?:^|\/)plan-3d-runtime-[^/]+\.js$/.test(file.path))?.path;
assert.ok(gpuModule);
const entry = await readFile(join(srv, 'demo.html'), 'utf8');
const reports = [];
const report = documentState => fetch('/lifecycle', {
  method: 'POST', body: JSON.stringify(documentState), keepalive: true,
});
async function boot(mount, data, gpuModule, report) {
  const id = crypto.randomUUID(), discarded = document.wasDiscarded;
  const send = (phase, details) => report({ id, discarded, phase, ...details });
  addEventListener('pageshow', e => void send('pageshow', { persisted: e.persisted }));
  addEventListener('visibilitychange', () => void send(document.visibilityState, {}));
  await import('/assets/houseplan-panel.js');
  const Host = discarded ? (await import('/assets/' + gpuModule)).Plan3dHost : undefined;
  mount({ data, Host, deferGpu: discarded });
  const card = () => window.__tabResume.card();
  const stage = () => card()?.renderRoot.querySelector('.stage');
  async function until(predicate) {
    const started = performance.now();
    for (;;) {
      if (predicate()) return;
      if (performance.now() - started > 15000) throw Error('stage timeout');
      await new Promise(requestAnimationFrame);
    }
  }
  if (discarded) {
    await until(() => stage()?.querySelector('.floor-preparation-status'));
    const view = stage().querySelector('.zoomwrap');
    await send('covered', { masked: !view || getComputedStyle(view).visibility === 'hidden',
      inert: !view || stage().inert, neutral: !stage().querySelector('.hp-startup-view'),
      noCopy: !stage().querySelector('canvas[data-hp-plan-3d-ready]') });
    window.__tabResume.releaseOpeningGpu();
  }
  await until(() => !card()?._booting && !stage()?.inert
    && stage()?.querySelector('canvas[data-hp-plan-3d-ready]')
    && stage().querySelector('.dev[data-hp-3d-native]') && card()._continuity.hasCompleteFrame);
  await send('complete', { recovery: card().houseplanContinuityTrace().map(row => row.event),
    scale: stage().querySelector('svg[data-hp=stage]').getAttribute('viewBox'),
    ink: stage().querySelector('canvas').toDataURL().length,
    idFromLoad: performance.timeOrigin });
  window.__lifecycleCanvas = stage().querySelector('canvas');
  window.__lifecycleCard = card();
}
const bootSource = `(${boot})(${mountResumeFixture}, ${JSON.stringify(fixture)}, ${JSON.stringify(gpuModule)}, ${report})
  .catch(error => void fetch('/lifecycle',{method:'POST',body:JSON.stringify({phase:'error',message:String(error)})}));`;
const panelResponse = entry.replace('</body>', '<script src="/lifecycle-setup.js" type="module"></script></body>');
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/lifecycle' && req.method === 'POST') {
      req.setEncoding('utf8');
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const payload = JSON.parse(raw);
      reports.push(payload);
      console.log(JSON.stringify(payload));
      res.writeHead(204).end(); return;
    }
    if (path === '/other') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Other panel</title>'); return; }
    if (path === '/houseplan') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(panelResponse); return; }
    if (path === '/lifecycle-setup.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(bootSource); return; }
    const file = resolve(srv, '.' + decodeURIComponent(path));
    if (!file.startsWith(srv + sep)) throw Error('outside fixture');
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json'
      : path.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }).end(await readFile(file));
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});
async function until(read, label, timeout = 18000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await read();
    if (result) return result;
    await delay(100);
  }
  throw Error('Timed out: ' + label);
}
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const target = origin + '/houseplan?panel-cold=1';
const profile = await mkdtemp(join(tmpdir(), 'hp-plan-3d-lifecycle-'));
const child = spawn(chromium.executablePath(), [
  '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
  '--window-size=1120,820', '--remote-debugging-port=0', '--user-data-dir=' + profile, target,
], { stdio: 'ignore' });
const exited = new Promise(resolve => child.once('exit', resolve));
const sockets = [];
let browser;
try {
  const port = await until(async () => {
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch { return undefined; }
  }, 'headed Chromium');
  const endpoint = 'http://127.0.0.1:' + port;
  const getTabs = () => fetch(endpoint + '/json/list').then(r => r.json());
  async function newTab(url) {
    const res = await fetch(endpoint + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
    assert.ok(res.ok, await res.text().catch(() => ''));
    return (await getTabs()).find(tab => tab.url === url);
  }
  async function protocol(tab) {
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let id = 0;
    return (method, params = {}) => new Promise((resolve, reject) => {
      const command = ++id;
      const listener = event => {
        const reply = JSON.parse(event.data);
        if (reply.id !== command) return;
        socket.removeEventListener('message', listener);
        reply.error ? reject(new Error(reply.error.message)) : resolve(reply.result);
      };
      socket.addEventListener('message', listener);
      socket.send(JSON.stringify({ id: command, method, params }));
    });
  }
  const evaluate = async (send, expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const first = await until(() => reports.find(report => report.phase === 'complete' && !report.discarded), 'initial rendered plan');
  await newTab('chrome://chrome-urls/');
  const control = await until(async () => (await getTabs()).find(tab => tab.url === 'chrome://chrome-urls/'), 'Chrome URL list');
  const debug = await protocol(control);
  const deep = `const all=(root=document)=>Array.from(root.querySelectorAll('*')).flatMap(node=>[node,...(node.shadowRoot?all(node.shadowRoot):[])]);`;
  await until(() => evaluate(debug, `(()=>{${deep} const button=all().find(node=>node.matches('button,cr-button') && node.textContent.trim().startsWith('Enable')); if (!button) return false; button.click(); return true;})()`), 'enable isolated Chrome debug URLs');
  await debug('Page.navigate', { url: 'chrome://discards/' });
  const row = `${deep} const row=all().find(node=>node.matches('tr')&&node.innerText.includes('House Plan demo'));`;
  const state = () => evaluate(debug, `(()=>{${row} return row?.innerText;})()`);
  console.log('before discard:', await until(state, 'find plan in chrome://discards'));
  await until(() => evaluate(debug, `(()=>{${row} const action=all(row).reverse().find(node=>/^\\[?Urgent Discard\\]?$/.test(node.textContent.trim())); if(!action)return false; action.click();return true;})()`), 'actual Chromium urgent discard command');
  await until(async () => (await state() ?? '').includes('discarded (urgent)'), 'discarded Chromium lifecycle state')
    .catch(async error => { console.log('after discard:', await state()); throw error; });
  const plan = (await getTabs()).find(tab => tab.url === target);
  assert.ok(plan, 'plan tab remains in browser after real discard');
  const activated = await fetch(endpoint + '/json/activate/' + plan.id);
  assert.ok(activated.ok);
  const covered = await until(() => reports.find(report => report.phase === 'covered' && report.discarded), 'fresh document reports discarded branch');
  assert.deepEqual({ masked: covered.masked, inert: covered.inert, neutral: covered.neutral, noCopy: covered.noCopy },
    { masked: true, inert: true, neutral: true, noCopy: true });
  const next = await until(() => reports.find(report => report.id === covered.id && report.phase === 'complete'), 'complete scene after native discard');
  assert.notEqual(next.id, first.id);
  assert.notEqual(next.idFromLoad, first.idFromLoad);
  assert.equal(next.scale, first.scale);
  assert.ok(next.ink > 3000 && next.recovery.includes('3d-discard') && next.recovery.includes('3d-recovery-complete'));

  browser = await chromium.connectOverCDP(endpoint);
  const page = browser.contexts()[0].pages().find(page => page.url() === target);
  assert.ok(page);
  await page.goto(origin + '/other');
  await page.goBack({ waitUntil: 'commit' });
  const restored = await until(() => reports.find(report => report.phase === 'pageshow' && report.id === next.id && report.persisted), 'real BFCache pageshow.persisted')
    .catch(async error => {
      console.log('notRestoredReasons:', await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.notRestoredReasons?.toJSON()));
      throw error;
    });
  assert.equal(restored.id, next.id);
  assert.equal(await page.evaluate(() => {
    const card = window.__lifecycleCard;
    return card && card.renderRoot.querySelector('canvas[data-hp-plan-3d]') === window.__lifecycleCanvas;
  }), true);
  console.log('OK: real native discard and BFCache on House Plan, one scene per document');
} finally {
  for (const socket of sockets) socket.close();
  await browser?.close();
  if (child.exitCode === null) child.kill('SIGTERM');
  await exited;
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
