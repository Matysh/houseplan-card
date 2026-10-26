// Local reference transport, not product code. Reuses the repository UI Lab.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { prepareReference, DEFAULT_REPO } from './prepare-reference.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { repo: { type: 'string' }, 'ha-cache': { type: 'string' },
  port: { type: 'string', default: '8892' }, empty: { type: 'boolean', default: false } } });
const repo = resolve(values.repo || DEFAULT_REPO), port = Number(values.port);
prepareReference(repo);
const { createLabServer } = await import(pathToFileURL(resolve(repo, 'demo/ui-lab/server.mjs')));
const server = createLabServer({ repoRoot: repo, port, overrides: resolve(here, 'accepted/overrides'),
  theme: resolve(here, 'reference-theme.css'), ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}) });
const nativeHandler = server.listeners('request')[0];
server.removeListener('request', nativeHandler);
const js = new Set(['color-picker-motion','decor-selection-frames','space-dialog','furniture-placement-pan',
  'device-context-actions','confirmation-kit','hidden-device-status','editor-grid-coverage','first-space-converter','plan-converter']
  .map(name => `/overrides/${name}.mjs`));
const fixture = JSON.parse(readFileSync(resolve(repo, 'demo/ui-lab/fixture.json')));
if (values.empty) {
  fixture.config.spaces = []; fixture.config.markers = []; fixture.layout = {};
  fixture.floors = { ground: { floor_id: 'ground', name: 'Ground floor', level: 0 }, upper: { floor_id: 'upper', name: '2nd floor', level: 1 } };
}
const fixtureText = JSON.stringify(fixture);
const datasetId = 'reference-' + createHash('sha256').update(fixtureText).digest('hex').slice(0, 24);
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'" };
server.on('request', (req, res) => {
  const path = req.url?.split('?')[0];
  const host = /^(localhost|127\.0\.0\.1)(?::(\d+))?$/i.exec(req.headers.host || '');
  if (!host || (host[2] && Number(host[2]) !== server.address()?.port)) { res.writeHead(403).end('Loopback only'); return; }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end('Read only'); return; }
  let body, type = 'text/javascript; charset=utf-8';
  try {
    if (path === '/reference-install.mjs') body = readFileSync(resolve(here, 'install.mjs'));
    else if (js.has(path)) body = readFileSync(resolve(here, 'accepted', path.slice(1)));
    else if (path === '/app.mjs') body = readFileSync(resolve(repo, 'demo/ui-lab/app.mjs'), 'utf8') + '\nawait import("/reference-install.mjs");\n';
    else if (path === '/fixture.json') { body = fixtureText; type = 'application/json'; }
    else if (path === '/provenance.json' || path === '/health') {
      // Preserve the native response and its headers, adding reference identity.
      const end = res.end.bind(res);
      res.end = (data, ...args) => {
        const original = JSON.parse(String(data));
        const revised = Buffer.from(JSON.stringify({ ...original, datasetId, privateDataset: false,
          referenceBaseline: 'v1.83.0-beta.2', referenceAdapters: 'accepted-2026-10-25', syntheticReference: true }));
        // Native handler already wrote Content-Length; wrap writeHead below.
        return end(req.method === 'HEAD' ? undefined : revised, ...args);
      };
      const writeHead = res.writeHead.bind(res);
      res.writeHead = (status, responseHeaders) => { const updated = { ...responseHeaders }; delete updated['Content-Length']; delete updated.ETag; return writeHead(status, updated); };
      if (req.method === 'HEAD') { res.end = end; }
      return nativeHandler(req, res);
    } else return nativeHandler(req, res);
    res.writeHead(200, { ...headers, 'Content-Type': type }); res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) { console.error(error.message); if (!res.headersSent) res.writeHead(500); res.end('Reference file unavailable'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Reference: http://localhost:${server.address().port}/ (${values.empty ? 'empty' : 'synthetic plan'}). Ctrl+C stops it.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
