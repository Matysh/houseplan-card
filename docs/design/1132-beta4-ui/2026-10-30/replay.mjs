/** Portable approved visual reference #1132. No private fixture or product rebuild. */
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const BASE = '08b154115ff815062cfc0221f39f7e53545dbe45';
const packageRoot = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { repo: { type: 'string' }, port: { type: 'string', default: '8893' }, 'ha-cache': { type: 'string' } } });
if (!values.repo) throw Error('Use --repo PATH to a checkout of v1.83.0-beta.4');
const repoRoot = resolve(values.repo), port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid port');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
if (head !== BASE) throw Error(`Expected base ${BASE}, got ${head}`);
try { await access(resolve(repoRoot, 'dist/houseplan-assets.json')); }
catch { await cp(resolve(repoRoot, 'custom_components/houseplan/frontend'), resolve(repoRoot, 'dist'), { recursive: true }); }
const labRoot = await mkdtemp(join(tmpdir(), 'houseplan-ui-1132-'));
await cp(resolve(repoRoot, 'demo/ui-lab'), labRoot, { recursive: true });
// Restore the unmodified mock so the owner's machine-specific demo never travels.
await writeFile(resolve(labRoot, 'mock-ha.mjs'), execFileSync('git', ['show', `${BASE}:demo/ui-lab/mock-ha.mjs`], { cwd: repoRoot }));
await cp(resolve(packageRoot, 'runtime/app.mjs'), resolve(labRoot, 'app.mjs'));
await cp(resolve(packageRoot, 'fixture.json'), resolve(labRoot, 'fixture.json'));
const { createLabServer } = await import(pathToFileURL(resolve(repoRoot, 'demo/ui-lab/server.mjs')).href);
const server = createLabServer({ repoRoot, labRoot, port, overrides: resolve(packageRoot, 'overrides'), ...(values['ha-cache'] ? { haCache: resolve(values['ha-cache']) } : {}) });
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Approved UI #1132: http://127.0.0.1:${port}/\nTemporary lab: ${labRoot}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
