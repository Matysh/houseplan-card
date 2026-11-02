/** Portable visual handoff. Product implementation/acceptance is a separate task. */
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const BASE = '783d427d2a571cd89a972c8cc922d52d1fdb6a6b';
const ZIP_HASH = 'c4b235255a957e40f42c7e93c56b06548411d3d24eaae413ec10e47557a4accb';
const FINGERPRINT = '233216a19647e5445b3de8c196fd92b52357fc93332e45bb5cf2f7d44764e66f';
const packageRoot = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { repo: { type: 'string' }, port: { type: 'string', default: '8893' }, 'ha-cache': { type: 'string' }, 'release-zip': { type: 'string' } } });
if (!values.repo) throw Error('Use --repo PATH to the package checkout or clean v1.84.0-beta.2 checkout');
const sourceRoot = resolve(values.repo), port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid port');
// Documentation commits are allowed; runtime sources must match the pinned base.
execFileSync('git', ['diff', '--exit-code', BASE, '--', 'demo', 'src', 'package.json'], { cwd: sourceRoot, stdio: 'pipe' });
const root = await mkdtemp(join(tmpdir(), 'houseplan-ui-184b2-'));
const repoRoot = join(root, 'repo'), labRoot = join(root, 'lab');
await mkdir(repoRoot);
await cp(join(sourceRoot, 'demo/srv'), join(repoRoot, 'demo/srv'), { recursive: true });
await cp(join(sourceRoot, 'package.json'), join(repoRoot, 'package.json'));
await cp(join(sourceRoot, 'demo/ui-lab'), labRoot, { recursive: true });
for (const name of ['app.mjs', 'index.html', 'lab.css', 'theme-local.css']) await cp(join(packageRoot, 'runtime', name), join(labRoot, name));
await cp(join(packageRoot, 'fixture.json'), join(labRoot, 'fixture.json'));
let zip;
if (values['release-zip']) zip = await readFile(resolve(values['release-zip']));
else {
  const response = await fetch('https://github.com/Matysh/houseplan-card/releases/download/v1.84.0-beta.2/houseplan.zip');
  if (!response.ok) throw Error(`Release download failed: ${response.status}; supply --release-zip PATH`);
  zip = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(zip).digest('hex') !== ZIP_HASH) throw Error('Release ZIP SHA256 mismatch');
const archive = join(root, 'houseplan.zip'), extracted = join(root, 'release');
await writeFile(archive, zip);
if (process.platform === 'win32') {
  const script = join(root, 'extract.ps1');
  await writeFile(script, 'param([string]$Archive,[string]$Target)\n$ErrorActionPreference="Stop"\nExpand-Archive -LiteralPath $Archive -DestinationPath $Target\n');
  execFileSync('powershell.exe', ['-NoProfile', '-File', script, '-Archive', archive, '-Target', extracted]);
} else execFileSync('unzip', ['-q', archive, '-d', extracted]);
await cp(join(extracted, 'frontend'), join(repoRoot, 'dist'), { recursive: true });
const manifest = JSON.parse(await readFile(join(repoRoot, 'dist/houseplan-assets.json'), 'utf8'));
if (manifest.fingerprint !== FINGERPRINT) throw Error('Unexpected release frontend fingerprint');
const { createLabServer } = await import(pathToFileURL(join(sourceRoot, 'demo/ui-lab/server.mjs')).href);
const server = createLabServer({ repoRoot, labRoot, port, theme: join(labRoot, 'theme-local.css'), overrides: join(packageRoot, 'overrides'), ...(values['ha-cache'] ? { haCache: resolve(values['ha-cache']) } : {}) });
const handler = server.listeners('request')[0];
server.removeListener('request', handler);
server.on('request', (req, res) => {
  if (['/HousePlan', '/dashboard'].includes(req.url?.split('?')[0])) req.url = '/';
  handler(req, res);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Approved UI replay:\nhttp://127.0.0.1:${port}/HousePlan\nhttp://127.0.0.1:${port}/dashboard\nTemporary files: ${root}\nSynthetic data only; Ctrl+C stops the server.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
