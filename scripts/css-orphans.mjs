#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCssSources } from './css-source.mjs';
import { cssTokens, parseCss, selectorClasses } from './css-lex.mjs';

const animationKeywords = new Set(('none initial inherit unset revert revert-layer ease ease-in ease-out ease-in-out linear step-start step-end '
  + 'infinite normal reverse alternate alternate-reverse forwards backwards both running paused auto replace add accumulate').split(' '));
/** Shorthand grammar components and timing-function arguments are not names.
 * A var() is followed only at the current animation/name grammar position. */
function animationNames(value, nameOnly, variables, active = new Set()) {
  const tokens = cssTokens(value).filter(token => !['comment','space'].includes(token.kind)), names = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === 'name' && tokens[i + 1]?.kind === '(') {
      let end = i + 2, depth = 1;
      for (; end < tokens.length && depth; end++) {
        if (tokens[end].kind === '(') depth++;
        else if (tokens[end].kind === ')') depth--;
      }
      if (token.value.toLowerCase() === 'var') {
        const key = tokens[i + 2]?.value, context = key + ':' + nameOnly;
        if (!active.has(context)) {
          const next = new Set(active).add(context), assigned = variables.get(key) || [];
          for (const item of assigned) names.push(...animationNames(item, nameOnly, variables, next));
          if (!assigned.length && tokens[i + 3]?.kind === ',')
            names.push(...animationNames(value.slice(tokens[i + 3].end, tokens[end - 1]?.start), nameOnly, variables, next));
        }
      }
      i = end - 1; continue;
    }
    if (token.kind === 'string') names.push(token.value);
    else if (token.kind === 'name' && (!/^\d/.test(token.value) || value[token.start] === '\\')
      && !(nameOnly ? /^(none|initial|inherit|unset|revert|revert-layer)$/i.test(token.value)
        : animationKeywords.has(token.value.toLowerCase()))) names.push(token.value);
  }
  return names;
}

function definitionSite(sheet, name) {
  const needles = ['.' + name, '@keyframes ' + name];
  for (let dash = name.indexOf('-'); dash >= 0; dash = name.indexOf('-', dash + 1))
    needles.push('}' + name.slice(dash), '`' + name.slice(dash));
  for (const needle of needles) for (const segment of sheet.segments) {
    const index = segment.raw.indexOf(needle);
    if (index < 0 || !/[{}]/.test(segment.raw)) continue;
    const character = segment.raw[index + needle.length];
    if (character && /[\p{L}\p{N}_-]/u.test(character)) continue;
    const position = segment.node.getStart() + index;
    return { file: segment.file,
      line: segment.node.getSourceFile().getLineAndCharacterOfPosition(position).line + 1,
      owner: segment.owner, emittedAt: { file: sheet.file, line: sheet.line, owner: sheet.owner } };
  }
  return { file: sheet.file, line: sheet.line, owner: sheet.owner, sourceKind: 'composition' };
}

export function scanCssOrphans(root = process.cwd()) {
  const source = analyzeCssSources(root), diagnostics = [...source.diagnostics];
  const definitions = [], keyframes = [], animations = [...source.animations], variables = new Map(source.variables);
  for (const sheet of source.css) {
    let rules;
    try { rules = parseCss(sheet.text); }
    catch (error) { diagnostics.push({ file: sheet.file, line: sheet.line, kind: 'css-syntax', name: '', message: error.message }); continue; }
    for (const rule of rules) {
      if (rule.header.includes('__HP_DYNAMIC__')) diagnostics.push({ file: sheet.file, line: sheet.line,
        kind: 'dynamic-css', name: rule.header, message: 'CSS selector/at-rule recipe is not finite' });
      if (rule.kind === 'keyframes') keyframes.push({ ...definitionSite(sheet, rule.name), name: rule.name });
      if (rule.kind === 'rule') for (const selector of rule.selectors) {
        for (const token of selectorClasses(selector)) {
          const location = definitionSite(sheet, token.name);
          definitions.push({ ...location, ...token, selector });
          if (token.positive && !source.classes.has(token.name)) diagnostics.push({ ...location,
            kind: 'class', name: token.name, selector, branch: token.branch,
            message: 'No actual class producer (positive selector token; not a whole-rule deadness claim)' });
        }
      }
      for (const declaration of rule.declarations) {
        const colon = declaration.indexOf(':');
        if (declaration.slice(0, colon < 0 ? undefined : colon).includes('__HP_DYNAMIC__'))
          diagnostics.push({ file: sheet.file, line: sheet.line, kind: 'dynamic-css', name: declaration,
            message: 'CSS declaration property/fragment recipe is not finite' });
        if (colon < 0) continue;
        const key = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).trim();
        if (/^(?:-\w+-)?animation(?:-name)?$/.test(key)) animations.push({ value, nameOnly: key.endsWith('-name') });
        if (key.startsWith('--')) variables.set(key, [...(variables.get(key) || []), value]);
      }
    }
  }
  const animationTokens = new Set(animations.flatMap(({ value, nameOnly }) => animationNames(value, nameOnly, variables)));
  for (const frame of keyframes) if (!animationTokens.has(frame.name)) diagnostics.push({ ...frame,
    kind: 'keyframes', message: 'No animation declaration or reachable programmatic assignment' });
  // Repeated composition roots are allowed; repeated diagnostics add no proof.
  const unique = rows => [...new Map(rows.map(row => {
    const { emittedAt, ...identity } = row;
    return [JSON.stringify(identity), row];
  })).values()];
  return { diagnostics: unique(diagnostics), dynamic: unique(source.dynamic), definitions: unique(definitions),
    keyframes: unique(keyframes), consumers: [...source.classes].sort(),
    sheets: source.css.map(({ file, line, owner }) => ({ file, line, owner })),
    metrics: { files: source.sources.length, sheets: source.css.length, classConsumers: source.classes.size, keyframes: keyframes.length } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv.find(arg => arg.startsWith('--root='))?.slice(7)
    || (process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : process.cwd());
  const result = scanCssOrphans(root);
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const entry of [...result.diagnostics, ...result.dynamic])
      console.error(`${entry.file}:${entry.line} ${entry.kind} ${JSON.stringify(entry.name)}: ${entry.message || entry.expression}`);
    console.log(`css-orphans: ${result.metrics.files} files, ${result.metrics.sheets} emitted sheets, ${result.metrics.classConsumers} class consumers; ${result.diagnostics.length} diagnostics, ${result.dynamic.length} unresolved producers`);
  }
  process.exitCode = result.diagnostics.length || result.dynamic.length ? 1 : 0;
}
