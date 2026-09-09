/** #505: offline real HA dialog. No HA server, authentication or device access. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HA_DIALOG_PIN, prepareHaDialogAssets } from './ha-dialog-assets.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.svg': 'image/svg+xml', '.png': 'image/png' };

// Runs in the browser. core.* is deliberately absent: importing it starts auth.
async function bootstrap(pin) {
  window.__ha505WebSockets ||= [];
  window.WebSocket = class {
    constructor(url) {
      window.__ha505WebSockets.push(String(url));
      void window.__ha505RecordWebSocket(String(url));
      throw new Error('Production HA connections are forbidden in the #505 fixture');
    }
  };
  window.hassConnection = new Promise(() => {});
  window.frontendVersion = pin.version;
  await import(`/frontend_latest/${pin.app}`);
  const require = window.__ha505Require;
  const index = await (await fetch('/ha505-module-index.json')).json();
  const visited = new Set(), loaded = new Set();
  async function prepare(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const info = index[id];
    if (!info) {
      if (!require.m[id]) throw new Error(`Missing official HA module ${id}`);
      return;
    }
    if (!require.m[id] && !loaded.has(info.file)) {
      const chunk = await import(`/frontend_latest/${info.file}`);
      Object.assign(require.m, chunk.__webpack_modules__);
      chunk.__rspack_esm_runtime?.(require);
      loaded.add(info.file);
    }
    for (const dependency of info.dependencies) await prepare(dependency);
  }
  await prepare(pin.module);
  await require(pin.module);
  await customElements.whenDefined('ha-dialog');
  window.__ha505Ready = { version: pin.version, chunks: [...loaded] };
}

/** Starts a synthetic loopback-only page; `authentic:false` keeps native hp-dialog. */
export async function launchHaDialogFixture({
  authentic = true, viewport = { width: 1600, height: 1000 },
  cacheDir, wheelPath, assets, colorScheme = 'light',
} = {}) {
  const ha = authentic ? assets || await prepareHaDialogAssets({ cacheDir, wheelPath }) : null;
  const errors = [], externalRequests = [], websocketAttempts = [];
  const server = createServer((request, response) => {
    let body, type = 'text/javascript';
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/ha505-bootstrap.mjs' && ha) body = `await (${bootstrap})(${JSON.stringify(HA_DIALOG_PIN)});`;
      else if (pathname === '/ha505-probe.html' && ha) {
        type = 'text/html';
        body = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">await import("/ha505-bootstrap.mjs"); const parent=document.createElement("section"); parent.id="parent"; const dialog=document.createElement("ha-dialog"); dialog.width="small"; dialog.headerTitle="Authentic HA dialog — offline diagnostic"; dialog.innerHTML="<p>Official pinned component; synthetic content; no HA server.</p>"; parent.append(dialog); document.body.append(parent); dialog.open=true;</script>';
      }
      else if (pathname === '/ha505-module-index.json' && ha) {
        body = JSON.stringify(ha.manifest.modules); type = 'application/json';
      } else {
        let base = join(REPO, 'demo/srv'), relative = pathname;
        if (pathname === '/product.html') relative = '/demo.html';
        if (pathname.startsWith('/reference/')) {
          base = join(REPO, 'docs/design/505-summary-panel/reference');
          relative = pathname.slice('/reference'.length);
        } else if (ha && (pathname.startsWith('/frontend_latest/') || pathname.startsWith('/static/'))) base = ha.root;
        const file = resolve(base, '.' + relative);
        if (!file.startsWith(resolve(base) + sep) || !existsSync(file) || !statSync(file).isFile()) {
          response.writeHead(404).end('Not found'); return;
        }
        body = readFileSync(file);
        type = MIME[extname(file)] || 'application/octet-stream';
        if (ha && pathname === `/frontend_latest/${HA_DIALOG_PIN.app}`) {
          const source = body.toString();
          if (source.split(HA_DIALOG_PIN.entry).length !== 2) throw new Error('Pinned HA app bootstrap changed');
          // The sole runtime instrumentation: expose its loader. The original
          // wheel and every component factory/CSS remain byte-for-byte intact.
          body = source.replace(HA_DIALOG_PIN.entry, `window.__ha505Require=o;${HA_DIALOG_PIN.entry}`);
        }
        if (ha && pathname === '/product.html') {
          const original = body.toString();
          if (!/<script>\r?\nclass HaIcon/.test(original) || !/<script type="module">\r?\nconst CFG/.test(original)) {
            throw new Error('Synthetic demo bootstrap changed; update the explicit fixture adapter');
          }
          body = original
            .replace(/<script>\r?\nclass HaIcon/, '<script type="module">\nawait import("/ha505-bootstrap.mjs");\nclass HaIcon')
            .replace("customElements.define('ha-icon',HaIcon);", "if(!customElements.get('ha-icon'))customElements.define('ha-icon',HaIcon);")
            .replace("customElements.define('ha-card',HaCard);", "if(!customElements.get('ha-card'))customElements.define('ha-card',HaCard);")
            .replace(/<script type="module">\r?\nconst CFG/, '<script type="module">\nawait import("/ha505-bootstrap.mjs");\nconst CFG');
        }
      }
      response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store',
        'content-security-policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'none'" }).end(body);
    } catch (error) { errors.push(String(error)); response.writeHead(500).end('Diagnostic fixture error'); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme, timezoneId: 'Europe/Moscow', serviceWorkers: 'block' });
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin !== url) {
        externalRequests.push(route.request().url()); await route.abort();
      } else await route.continue();
    });
    await context.exposeBinding('__ha505RecordWebSocket', (_, address) => websocketAttempts.push(address));
    await context.exposeBinding('__ha505RecordPolicyViolation', (_, violation) => errors.push(`CSP blocked attempted request: ${violation}`));
    await context.addInitScript(() => {
      window.__ha505WebSockets = [];
      window.WebSocket = class { constructor(url) { window.__ha505WebSockets.push(String(url)); void window.__ha505RecordWebSocket(String(url)); throw new Error('WebSocket forbidden in offline fixture'); } };
      document.addEventListener('securitypolicyviolation', (event) => {
        void window.__ha505RecordPolicyViolation(`${event.effectiveDirective}: ${event.blockedURI}`);
      });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.stack || String(error)));
    return { page, browser, context, url, errors, externalRequests, websocketAttempts,
      provenance: ha ? { version: ha.manifest.version, sha256: ha.manifest.sha256,
        runtimeExposure: 'App loader exposed; genuine component factories/CSS unmodified; no core/auth/HA host' } : null,
      async assertClean() {
        websocketAttempts.push(...await page.evaluate(() => window.__ha505WebSockets || []));
        if (errors.length || externalRequests.length || websocketAttempts.length) {
          throw new Error(JSON.stringify({ errors, externalRequests, websocketAttempts }));
        }
      },
      async close() { await browser.close(); await new Promise((accept) => server.close(accept)); },
    };
  } catch (error) {
    await browser?.close(); await new Promise((accept) => server.close(accept)); throw error;
  }
}
