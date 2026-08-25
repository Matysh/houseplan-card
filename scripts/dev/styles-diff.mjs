/**
 * #266: refactor-only proof for the styles split. Extracts every css`...`
 * template from the style sources (they contain no interpolations), parses
 * the text into a normalised multiset of rules (media-scope + selector ->
 * sorted declarations) and prints sorted JSON. Run on the base commit and on
 * the branch, then diff the outputs: an empty diff proves the split moved
 * rules without editing, adding or dropping a single declaration.
 *
 *   node scripts/dev/styles-diff.mjs [files…] > after.json
 */
import { readFileSync } from 'node:fs';

// Default file set: src/styles.ts plus whatever surface files it actually
// imports — so intermediate slices are compared honestly, not against stale
// files left in src/styles/ by other runs. The multiset ignores order.
const detect = () => {
  const aggregator = readFileSync('src/styles.ts', 'utf8');
  const files = [];
  if (/css`/.test(aggregator)) files.push('src/styles.ts');
  for (const m of aggregator.matchAll(/from '\.\/styles\/([\w-]+)\.styles'/g)) {
    files.push(`src/styles/${m[1]}.styles.ts`);
  }
  return files.length ? files : ['src/styles.ts'];
};
const files = process.argv.slice(2).length ? process.argv.slice(2) : detect();

const cssText = files.map((file) => {
  const source = readFileSync(file, 'utf8');
  const chunks = [...source.matchAll(/css`([\s\S]*?)`/g)].map((m) => m[1]);
  if (!chunks.length) throw new Error(`${file}: no css\`\` template found`);
  if (chunks.some((chunk) => chunk.includes('${'))) {
    throw new Error(`${file}: interpolation found — the parser assumes plain CSS`);
  }
  return chunks.join('\n');
}).join('\n');

const text = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [];
const normalise = (s) => s.replace(/\s+/g, ' ').trim();
const walk = (chunk, scope) => {
  let i = 0;
  while (i < chunk.length) {
    const open = chunk.indexOf('{', i);
    if (open === -1) break;
    const header = chunk.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < chunk.length && depth > 0) {
      if (chunk[j] === '{') depth++;
      else if (chunk[j] === '}') depth--;
      j++;
    }
    const body = chunk.slice(open + 1, j - 1);
    if (header.startsWith('@') && body.includes('{')) {
      walk(body, `${scope} ${normalise(header)}`.trim());
    } else {
      rules.push({
        scope,
        selector: normalise(header),
        declarations: body.split(';').map(normalise).filter(Boolean).sort(),
      });
    }
    i = j;
  }
};
walk(text, '');

rules.sort((a, b) => (a.scope + '|' + a.selector).localeCompare(b.scope + '|' + b.selector)
  || JSON.stringify(a.declarations).localeCompare(JSON.stringify(b.declarations)));
console.log(JSON.stringify(rules, null, 1));
