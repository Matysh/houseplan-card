// tsc keeps extensionless relative imports; Node ESM requires explicit ".js".
// Walk the complete output tree: feature modules may import siblings from a
// nested directory, and a root-only pass leaves those suites unable to start.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { coverageMapsEnabled, editMappedSource, replacementEdits } from './coverage-maps.mjs';
import { isMainModule } from './spawn-portable.mjs';

export const patchImports = (dir, { coverage = coverageMapsEnabled() } = {}) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      patchImports(path, { coverage });
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    const input = readFileSync(path, 'utf8');
    const { code: source, edits } = replacementEdits(input,
      /(from\s+['"]|import(?:\s*\(\s*|\s+)['"])(\.\.?\/[^'"]+)(['"])/g,
      (match, prefix, specifier, suffix) => (
        // A dot inside the module NAME is not an extension: `./styles/base.styles`
        // must still get `.js` (#266). Only real loader extensions pass through.
        ['.js', '.mjs', '.json'].includes(extname(specifier))
          ? match : `${prefix}${specifier}.js${suffix}`
      ),
    );
    if (coverage) {
      const mapPath = `${path}.map`;
      if (!existsSync(mapPath)) throw Error(`Coverage test output has no source map: ${path}`);
      const updated = editMappedSource(input, edits, { id: path, previous: JSON.parse(readFileSync(mapPath, 'utf8')) });
      writeFileSync(mapPath, JSON.stringify(updated.map));
    }
    writeFileSync(path, source);
  }
};

if (isMainModule(import.meta.url)) patchImports('test-build');
