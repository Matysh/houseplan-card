// tsc keeps extensionless relative imports; Node ESM requires explicit ".js".
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
for (const f of readdirSync('test-build')) {
  if (!f.endsWith('.js')) continue;
  const p = `test-build/${f}`;
  const s = readFileSync(p, 'utf8').replace(/from\s+'(\.\/[\w-]+)'/g, "from '$1.js'");
  writeFileSync(p, s);
}
