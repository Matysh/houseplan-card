// tsc keeps extensionless relative imports; Node ESM requires explicit ".js".
// Walk the complete output tree: feature modules may import siblings from a
// nested directory, and a root-only pass leaves those suites unable to start.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const patchImports = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      patchImports(path);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    const source = readFileSync(path, 'utf8').replace(
      /(from\s+['"]|import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"])/g,
      (match, prefix, specifier, suffix) => (
        extname(specifier) ? match : `${prefix}${specifier}.js${suffix}`
      ),
    );
    writeFileSync(path, source);
  }
};

patchImports('test-build');
