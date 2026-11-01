// One npm-free dependency walk for generated triggers and immutable proof reads.
import { posix } from 'node:path';
import { BUILD_OUTPUT, LEAF_FILES, globToRegExp } from './check-inputs.mjs';
import { relativeDependencies, scanJavaScript } from './relative-dependencies.mjs';

const outputs = BUILD_OUTPUT.map(globToRegExp);

function* dependencyReads(tests, tracked, maxReads) {
  const files = new Set([...tracked, ...tests]), seen = new Set(), traversed = new Set();
  let queue = [...tests], reads = 0;
  const resolve = (from, spec) => {
    let path = posix.normalize(posix.join(posix.dirname(from), spec.split(/[?#]/)[0]));
    if (path.startsWith('test-build/')) path = path.replace(/^test-build\//, 'src/').replace(/\.js$/, '.ts');
    return [path, `${path}.mjs`, `${path}.js`, `${path}.ts`, `${path}/index.mjs`, `${path}/index.js`]
      .filter(file => files.has(file));
  };
  while (queue.length) {
    const batch = [...new Set(queue)].filter(file => !traversed.has(file));
    queue = [];
    for (const file of batch) { seen.add(file); traversed.add(file); }
    const codeFiles = batch.filter(file => !LEAF_FILES.has(file) && /\.(?:mjs|cjs|js|ts)$/.test(file));
    reads += codeFiles.length;
    // Check the whole frontier before issuing any reads: a remote verifier
    // without local Git objects must not turn a cache probe into an API storm.
    if (reads > maxReads) throw Error('tooling policy exceeds immutable read budget');
    const texts = codeFiles.length ? yield codeFiles : [];
    for (let index = 0; index < codeFiles.length; index++) {
      const file = codeFiles[index], text = texts[index];
      const scanned = scanJavaScript(text), { tokens } = scanned;
      queue.push(...relativeDependencies(text, scanned).flatMap(spec => resolve(file, spec)));
      for (let i = 0; i < tokens.length; i++) {
        const tail = tokens[i].value === 'new' ? tokens.slice(i, i + 12) : [];
        if (tail[0]?.value === 'new' && tail[1]?.value === 'URL' && tail[2]?.value === '('
          && tail[3]?.kind === 'string'
          && tail.slice(4, 11).map(token => token.value).join(' ') === ', import . meta . url )') {
          for (const input of resolve(file, tail[3].value)) seen.add(input);
        }
        if (!['readFile', 'readFileSync'].includes(tokens[i].value) || tokens[i + 1]?.value !== '(') continue;
        let depth = 1;
        for (let j = i + 2; j < tokens.length && depth; j++) {
          const token = tokens[j];
          if (token.value === '(') depth++;
          if (token.value === ')') depth--;
          if (token.kind === 'string' && files.has(token.value)) seen.add(token.value);
        }
      }
    }
  }
  // Documentation has task preflight; its broad unit contracts run at beta.
  return [...seen].filter(file => !outputs.some(re => re.test(file))
    && !/^docs\//.test(file) && !/\.md$/i.test(file)).sort();
}

export function toolingDependencies(tests, { tracked, read, maxReads = Infinity }) {
  const walk = dependencyReads(tests, tracked, maxReads);
  let next = walk.next();
  while (!next.done) next = walk.next(next.value.map(read));
  return next.value;
}

export async function immutableToolingDependencies(tests, { tracked, read, readMany, maxReads = 4096 }) {
  const walk = dependencyReads(tests, tracked, maxReads);
  let next = walk.next();
  while (!next.done) next = walk.next(await (readMany ? readMany(next.value) : Promise.all(next.value.map(read))));
  return next.value;
}
