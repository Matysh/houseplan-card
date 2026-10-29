import { execFileSync } from 'node:child_process';

/** Replay the approved #1120 visual in an isolated copy of the existing UI Lab. */
import { appendFile, cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';

const packageRoot = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { values } = parseArgs({
    options: {
      repo: { type: 'string' },
      port: { type: 'string', default: '8893' },
      'ha-cache': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });
  if (values.help) {
    console.log('node replay.mjs --repo PATH [--port 8893] [--ha-cache PATH]\nRequires the prepared Houseplan base checkout described in README.md.');
    return;
  }
  if (!values.repo?.trim()) throw new Error('Specify the prepared base checkout with --repo PATH.');
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('--port must be an integer from 1 to 65535.');
  }

  const repoRoot = resolve(values.repo);
  const { createLabServer } = await import(pathToFileURL(resolve(repoRoot, 'demo/ui-lab/server.mjs')).href);
  const labRoot = await mkdtemp(join(tmpdir(), 'houseplan-ui-1120-'));
  await cp(resolve(repoRoot, 'demo/ui-lab'), labRoot, { recursive: true });
  for (const name of ['app.mjs', 'fixture.json']) {
    const bytes = execFileSync('git', ['show', '09bda8dbee8b50577bfc4affc332b8cda914f5b4:demo/ui-lab/' + name], { cwd: repoRoot });
    await writeFile(resolve(labRoot, name), bytes);
  }
  await cp(resolve(packageRoot, 'fixture.json'), resolve(labRoot, 'fixture.json'));
  const files = [...(await readdir(resolve(packageRoot, 'context'))).filter(name => name.endsWith('.mjs')).sort().map(name => '../context/' + name), 'UI-1120-panel-header.mjs', 'UI-1120-header-overflow.mjs'];
  const prototype = (await Promise.all(files.map(name => readFile(resolve(packageRoot, 'prototypes', name), 'utf8')))).join('\n\n');
  await appendFile(resolve(labRoot, 'app.mjs'), `\n\n// Approved visual reference: issue #1120, 2026-10-29.\n${prototype}\n`);
  await appendFile(resolve(labRoot, 'theme.css'), '\n/* Offline host token used by the approved visual. */\n:root { --mdc-dialog-scrim-color: rgb(0 0 0 / 0.45); }\n');

  await appendFile(resolve(labRoot, 'theme.css'), await readFile(resolve(packageRoot, 'theme.css'), 'utf8'));
  const server = createLabServer({
    repoRoot,
    labRoot,
    port,

    ...(values['ha-cache'] ? { haCache: resolve(values['ha-cache']) } : {}),
    // fixture.json remains the default synthetic dataset in the temporary labRoot.
  });
  server.on('error', error => {
    console.error(`UI Lab: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Houseplan #1120: http://127.0.0.1:${server.address().port}/`);
    console.log(`Temporary workbench: ${labRoot}`);
    console.log(JSON.stringify(server.provenance, null, 2));
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

main().catch(error => {
  console.error(`Cannot replay Houseplan #1120: ${error.message}`);
  process.exitCode = 1;
});
