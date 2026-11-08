import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
const safeRelative = value => typeof value === 'string' && value && !value.startsWith('-') && !value.includes('\\') && !value.split('/').includes('..') && !value.startsWith('/') && !value.includes(':');
// These modules describe future worker commands; literals there are not calls.
// Ordinary tests may spawn a script instead of importing it. Keep their literal
// repository paths conservative for both selection and result fingerprints.
// Runtime witnesses name their owner; dynamic scanners name the text trees they read.
const DECLARED_SOURCE_SCOPES = new Map([
  // The converter tsc entry and backend literals are real build inputs, not card dist.
  ['scripts/sh3d-convert/build-runtime.mjs', ['scripts/sh3d-convert/geometry-entry.ts', 'scripts/sh3d-convert/tsconfig.json', 'custom_components/houseplan/validation.py', 'custom_components/houseplan/led_strips.py']],
  ['demo/smoke_header_observer_retirement.mjs', ['src/houseplan-card.ts']],
  ['demo/smoke_header_mode_position_regression.mjs', ['src/editors/properties/styles.ts', 'src/styles/panel-header.styles.ts', 'src/styles/navigation.styles.ts']],
  ['scripts/config-compatibility-inventory.mjs', ['src/**/*.ts', 'custom_components/houseplan/**/*.py']],
  ['test/isometric-contract.test.mjs', ['demo/smoke_*.mjs']],
  ['test/smoke-exception-guard.test.mjs', ['demo/smoke_*.mjs']],
  ['test/smoke-harness-contract.test.mjs', ['demo/smoke_*.mjs']],
]);
const COMMAND_DECLARATIONS = new Set(['process-next/lib/catalog.mjs', 'process-next/lib/task-selection.mjs', 'process-next/catalog/selections.mjs', 'process-next/lib/background.mjs', 'process-next/lib/e2e.mjs', 'process-next/lib/converters.mjs', 'scripts/mutation-registry.mjs']);
export function dependencyReader(root) {
    const cache = new Map();
    function direct(file) {
        if (!cache.has(file))
            cache.set(file, (async () => {
                try {
                    if (!(await stat(resolve(root, file))).isFile())
                        return null;
                    if (!/\.(?:mjs|cjs|js|ts|py)$/.test(file))
                        return [];
                    const text = await readFile(resolve(root, file), 'utf8');
                    const edges = [...(DECLARED_SOURCE_SCOPES.get(file) || [])];
                    // A literal inside fixture source text is data being constructed, not
                    // a second import/read of the host repository. Ignore comments as well.
                    const literalStarts = new Set([...text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g)]
                        .filter(m => !m[0].startsWith('/')).map(m => m.index));
                    // Keep ordinary repository literals conservative, including spawn targets.
                    // The explicit worker declaration modules above describe future calls:
                    // a worker's command array is
                    // a declaration, not an import of every executable it may later launch.
                    for (const match of text.matchAll(/['"]((?:src|demo|scripts|docs|custom_components|dist|test\/fixtures)\/[^'"\n]+\.(?:mjs|ts|json|html))['"]/g)) {
                        if (!literalStarts.has(match.index))
                            continue;
                        const prefix = text.slice(Math.max(0, match.index - 180), match.index);
                        if (!COMMAND_DECLARATIONS.has(file) || /^(?:src\/|test\/fixtures\/|demo\/fixtures\/)/.test(match[1])
                            || /(?:\breadFile(?:Sync)?\s*\(|\bnew\s+URL\s*\()[^;]*$/.test(prefix))
                            edges.push(match[1]);
                    }
                    // Dynamic directory readers cannot honestly be narrowed to literal imports.
                    if (/\breaddirSync\b|\bimport\s*\(\s*[^'"\s]/.test(text) && file.startsWith('test/'))
                        edges.push('src/**');
                    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|new\s+URL\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
                        const quote = match.index + match[0].search(/['"]/);
                        if (!literalStarts.has(quote))
                            continue;
                        let candidate = relative(root, resolve(root, dirname(file), match[1].split(/[?#]/)[0])).replaceAll('\\', '/');
                        if (!safeRelative(candidate))
                            continue;
                        if (candidate.startsWith('test-build/'))
                            candidate = candidate.replace(/^test-build\//, 'src/').replace(/\.js$/, '.ts');
                        if (file.endsWith('.ts') && candidate.endsWith('.js'))
                            edges.push(candidate.replace(/\.js$/, '.ts'));
                        edges.push(...(extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.mjs`, `${candidate}.js`]));
                    }
                    if (file.endsWith('.py'))
                        for (const match of text.matchAll(/^\s*from\s+(custom_components\.houseplan(?:\.[\w.]+)?|tests_backend(?:\.[\w.]+)?|\.[\w.]*)\s+import\s+([^\n]+)/gm)) {
                            const module = match[1], base = module.startsWith('.') ? relative(root, resolve(root, dirname(file), ...Array(Math.max(0, module.match(/^\.+/)[0].length - 1)).fill('..'), module.replace(/^\.+/, '').replaceAll('.', '/'))).replaceAll('\\', '/') : module.replaceAll('.', '/');
                            edges.push(base + '.py', base + '/__init__.py');
                            for (const name of match[2].replace(/[()]/g, '').split(',')) {
                                const value = name.trim().split(/\s+/)[0];
                                if (/^\w+$/.test(value))
                                    edges.push(base + '/' + value + '.py');
                            }
                        }
                    if (file.endsWith('.py'))
                        for (const match of text.matchAll(/^\s*import\s+([^\n]+)/gm))
                            for (const part of match[1].split(',')) {
                                const name = part.trim().split(/\s+/)[0];
                                if (!/^(?:custom_components\.houseplan|tests_backend)\./.test(name))
                                    continue;
                                const module = name.replaceAll('.', '/');
                                edges.push(module + '.py', module + '/__init__.py');
                            }
                    return edges;
                }
                catch {
                    return null;
                }
            })());
        return cache.get(file);
    }
    return direct;
}
