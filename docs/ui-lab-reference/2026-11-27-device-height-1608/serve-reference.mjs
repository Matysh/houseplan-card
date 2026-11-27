import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--repo', '--port', '--ha-cache'].includes(args[i]) || !args[i + 1]) throw Error('Use --repo CHECKOUT [--port 8892] [--ha-cache CACHE]');
  options[args[i].slice(2)] = args[i + 1];
}
const repo = resolve(options.repo ?? process.cwd()), port = Number(options.port ?? 8892);
const { createLabServer } = await import(pathToFileURL(resolve(repo, 'demo/ui-lab/server.mjs')));
const server = createLabServer({ repoRoot: repo, port,
  ...(options['ha-cache'] ? { haCache: options['ha-cache'] } : {}),
  fixture: resolve(here, 'fixture.json'),
  assets: resolve(repo, 'demo/ui-lab/default-plan/assets'),
  theme: resolve(repo, 'demo/ui-lab/default-plan/theme.css') });
server.provenance.privateDataset = false;
server.provenance.datasetId = 'synthetic-1608-' + createHash('sha256').update(readFileSync(resolve(here, 'fixture.json'))).digest('hex').slice(0, 24);
server.listen(port, '127.0.0.1', () => console.log('UI Lab #1608: http://localhost:' + port));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
