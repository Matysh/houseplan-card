// Offline reference transport; no live HA, private fixture or product rebuild.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { prepareReference, DEFAULT_REPO } from './prepare-reference.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { repo: { type: 'string' }, 'ha-cache': { type: 'string' }, port: { type: 'string', default: '8893' } } });
const repo = resolve(values.repo || DEFAULT_REPO), port = Number(values.port);
prepareReference(repo);
const { createLabServer } = await import(pathToFileURL(resolve(repo, 'demo/ui-lab/server.mjs')));
const server = createLabServer({ repoRoot: repo, port, overrides: resolve(here, 'runtime/overrides'),
  theme: resolve(here, 'reference-theme.css'), ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}) });
// The pinned public lab does not preload the real icon picker. Add the same
// official module 53214 used by accepted/ha-bootstrap.mjs to its native loader.
const nativeBootstrap = readFileSync(resolve(repo, 'demo/ui-lab/ha-bootstrap.mjs'), 'utf8');
const anchor = 'runtime.modules.contexts]';
if (nativeBootstrap.split(anchor).length !== 2) throw Error('Unexpected pinned HA bootstrap');
const bootstrap = nativeBootstrap.replace(anchor, "runtime.modules.contexts, '53214']");
const routes = new Map([
  ['/ha-bootstrap.mjs', bootstrap],
  ['/reference-install.mjs', readFileSync(resolve(here, 'install.mjs'))],
  ['/overrides/device-picker-kit.mjs', readFileSync(resolve(here, 'accepted/device-picker-kit.mjs'))],
  ['/app.mjs', readFileSync(resolve(repo, 'demo/ui-lab/app.mjs'), 'utf8') + '\nawait import("/reference-install.mjs");\n'],
]);
const nativeHandler = server.listeners('request')[0];
server.removeListener('request', nativeHandler);
server.on('request', (req, res) => {
  const path = req.url?.split('?')[0];
  if (!routes.has(path)) return nativeHandler(req, res);
  const host = /^(localhost|127\.0\.0\.1)(?::(\d+))?$/i.exec(req.headers.host || '');
  if (!host || (host[2] && Number(host[2]) !== server.address()?.port)) { res.writeHead(403).end('Loopback only'); return; }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end('Read only'); return; }
  res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(req.method === 'HEAD' ? undefined : routes.get(path));
});
server.listen(port, '127.0.0.1', () => console.log(`UI-029 reference: http://localhost:${server.address().port}/ · synthetic data. Ctrl+C stops it.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
