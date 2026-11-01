#!/usr/bin/env node
// #1146: source counters from the owner-approved #1131 census.
// CSS coverage, rather than lexical class-name guesses, owns dead-rule candidates.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import ts from 'typescript';
import { htmlTags } from './css-source.mjs';
import { cssTokens } from './css-lex.mjs';

const blank = text => text.replace(/[^\r\n]/g, ' ');
const cssCode = (text, tokens) => tokens.map(token =>
  ['comment', 'string'].includes(token.kind) ? blank(text.slice(token.start, token.end)) : text.slice(token.start, token.end)).join('');

export const UI_KIT_BASELINE_FILE = 'scripts/ui-kit-baseline.json';
export const UI_KIT_REGISTRY_FILE = 'docs/design/ui-kit-inventory.json';
export const UI_KIT_BANDS = Object.freeze({ cssLines: 20, keyframes: 0, transitions: 0,
  inlineDecorativeStyles: 0, hpDialogWithoutKit: 0, btnRulesOutsideKit: 0, registryOffKit: 0 });
export const UI_KIT_METRICS = Object.freeze(Object.keys(UI_KIT_BANDS));

export function registryMetrics(registry) {
  if (registry?.schema !== 'houseplan-ui-kit-inventory/v1' || !Array.isArray(registry.surfaces) || !registry.surfaces.length)
    throw Error('UI Kit registry: invalid schema or empty surfaces');
  const ids = new Set(), buckets = { K: 0, L: 0, M: 0, N: 0 };
  for (const surface of registry.surfaces) {
    if (!surface.id || ids.has(surface.id) || !surface.cells || typeof surface.cells !== 'object' || Array.isArray(surface.cells))
      throw Error('UI Kit registry: duplicate/missing surface identity or cells');
    ids.add(surface.id);
    const cells = Object.values(surface.cells);
    if (!cells.length || cells.some(values => !Array.isArray(values) || !values.length)) throw Error('UI Kit registry: empty cell');
    for (const value of cells.flat()) {
      const match = typeof value === 'string' && /^([KLMN])\|([^|\s][^|]*)(?:\|.*)?$/.exec(value);
      if (!match) throw Error(`UI Kit registry: unknown bucket or missing evidence at ${surface.id}`);
      buckets[match[1]]++;
    }
  }
  return { surfaces: ids.size, cells: Object.values(buckets).reduce((a, b) => a + b, 0), buckets,
    registryOffKit: buckets.L + buckets.M };
}

export function collectUiKitMetrics(root, { report = collectUiKitReport(root), registry } = {}) {
  registry ??= JSON.parse(readFileSync(resolve(root, UI_KIT_REGISTRY_FILE), 'utf8'));
  validateCapturePlans(root, registry);
  const totals = report.totals;
  return { cssLines: totals.cssLinesStylesDir + totals.cssLinesElsewhere, keyframes: totals.keyframes,
    transitions: totals.transitionsInCss + totals.strayTransitions, inlineDecorativeStyles: totals.inlineDecorative,
    hpDialogWithoutKit: totals.hpDialogWithoutUiDialog, btnRulesOutsideKit: totals.btnRulesOutsideKit,
    registryOffKit: registryMetrics(registry).registryOffKit };
}

export function validateCapturePlans(root, registry) {
  for (const surface of registry.surfaces) {
    const frames = Array.isArray(surface.frames) ? surface.frames : [];
    if (frames.length) {
      for (const frame of frames) if (typeof frame !== 'string' || !existsSync(resolve(root, frame)))
        throw Error(`UI Kit registry: missing frame at ${surface.id}`);
      continue;
    }
    const plan = registry.capturePlans?.[surface.captureScenario];
    if (!plan?.command || !plan.entry || !existsSync(resolve(root, plan.entry)))
      throw Error(`UI Kit registry: missing runnable capture plan at ${surface.id}`);
  }
}

export function readUiKitBaseline(root) {
  return JSON.parse(readFileSync(resolve(root, UI_KIT_BASELINE_FILE), 'utf8'));
}

export function uiKitViolations(metrics, baseline) {
  return UI_KIT_METRICS.flatMap(name => {
    const now = metrics[name], base = baseline?.[name], band = UI_KIT_BANDS[name];
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(base) || base < 0 || now > base + band)
      return [{ name, now: now ?? null, base: base ?? null, band }];
    return [];
  });
}

export function isStyleModule(file) {
  const path = file.replaceAll('\\', '/');
  return path.startsWith('src/styles/') || path.includes('/src/styles/') || /-styles?\.ts$|\.styles\.ts$|-style\.ts$/.test(path);
}

// Keep the census's literal view (expressions are not executed). The TS parser
// owns strings, regexes, comments and nested expressions; offsets stay physical.
export function templates(src) {
  const file = ts.createSourceFile('census.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw Error('UI Kit census: invalid TypeScript source');
  const out = [];
  const visit = node => {
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const start = node.getStart(file), end = node.end;
      const tag = ts.isTaggedTemplateExpression(node.parent) ? node.parent.tag.getText(file).split('.').at(-1) : '';
      let text = src.slice(start + 1, end - 1);
      if (ts.isTemplateExpression(node)) {
        let cursor = start + 1; text = '';
        for (const span of node.templateSpans) {
          const expression = span.expression.getFullStart() - 2;
          const close = span.literal.getStart(file);
          text += src.slice(cursor, expression) + '${}' + '\n'.repeat((src.slice(expression, close + 1).match(/\n/g) || []).length);
          cursor = close + 1;
        }
        text += src.slice(cursor, end - 1);
      }
      out.push({ tag, start, end, text });
    } else if (ts.isStringLiteral(node)) {
      // The original census doesn't interpret strings inside ${expressions}.
      let parent = node.parent;
      while (parent && !ts.isTemplateExpression(parent)) parent = parent.parent;
      if (!parent) { const start = node.getStart(file); out.push({ tag: '#str', start, end: node.end, text: src.slice(start + 1, node.end - 1) }); }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out.sort((a, b) => a.start - b.start);
}

export function collectUiKitReport(root) {
const files = [];
(function walk(d) { for (const n of readdirSync(d).sort()) { const p = join(d, n); const s = statSync(p);
  if (s.isDirectory()) walk(p); else if (/\.ts$/.test(n) && !/\.d\.ts$/.test(n)) files.push(p); } })(join(root, 'src'));
const rel = p => relative(root, p).replaceAll('\\', '/');
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;
const report = { files: {}, keyframes: [], transitions: [], animations: [], inlineStyles: [], reducedMotion: 0 };
const cssTextByFile = {};
for (const f of files) {
  const src = readFileSync(f, 'utf8'); const r = rel(f);
  const tpls = templates(src);
  const looksCss = t => /(^|[\s}])[.#:@a-z*\[][^{}]*\{[^{}]*[a-z-]+\s*:[^{}]*[;}]/i.test(t.text) || (t.tag === '#str' && /^[a-z-]+\s*:\s*[^;]+;([a-z-]+\s*:\s*[^;]+;?)*$/.test(t.text.trim()) && t.text.split(';').length > 2);
  const cssT = tpls.filter(t => t.tag === 'css' || (t.tag !== 'html' && t.tag !== 'svg' && (isStyleModule(f) ? /[{};]/.test(t.text) && /:\s*[^;]+;/.test(t.text) : looksCss(t))));
  const htmlT = tpls.filter(t => t.tag === 'html' || t.tag === 'svg');
  for (const t of htmlT) for (const tag of htmlTags(t.text).filter(tag => tag.name === 'style')) {
    const end = t.text.toLowerCase().indexOf('</style', tag.end);
    if (end < 0) throw Error(`UI Kit census: unclosed style tag at ${r}`);
    // Interpolations preserve newlines, not byte lengths. Derive a physical
    // base line from the literal, never add its shortened offset to src.
    cssT.push({ tag: 'html<style>', start: t.start, baseLine: lineOf(src, t.start) + lineOf(t.text, tag.end) - 1,
      text: t.text.slice(tag.end, end) });
    report.styleTags = (report.styleTags || 0) + 1;
  }
  const cssLineSet = new Set(); let decls = 0, rules = 0; let text = '';
  for (const t of cssT) {
    const original = t.text, tokens = cssTokens(original), body = cssCode(original, tokens);
    text += body + '\n';
    const l0 = t.baseLine ?? lineOf(src, t.start);
    original.split('\n').forEach((l, k) => { if (l.trim()) cssLineSet.add(l0 + k); });
    decls += (body.match(/[a-z-]+\s*:\s*[^;{}]+;?/g) || []).filter(d => !/^(https?|data)\b/.test(d)).length;
    rules += (body.match(/\{/g) || []).length;
    const significant = tokens.filter(token => !['space', 'comment'].includes(token.kind));
    for (let index = 0; index < significant.length - 2; index++) {
      if (significant[index].kind === '@' && /^(?:-\w+-)?keyframes$/i.test(significant[index + 1].value)
        && ['name', 'string'].includes(significant[index + 2].kind)) {
        report.keyframes.push({ name: significant[index + 2].value, file: r,
          line: l0 + original.slice(0, significant[index].start).split('\n').length - 1 });
      }
    }
    for (const m of body.matchAll(/transition\s*:\s*([^;}]+)/g)) report.transitions.push({ file: r, value: m[1].trim().replace(/\s+/g, ' ') });
    for (const m of body.matchAll(/(?<![\w-])animation\s*:\s*([^;}]+)/g)) report.animations.push({ file: r, value: m[1].trim().replace(/\s+/g, ' ') });
    report.reducedMotion += (body.match(/prefers-reduced-motion/g) || []).length;
  }
  const cssLines = cssLineSet.size;
  // transition strings outside css templates (e.g. TS string constants / inline style objects)
  const strayTrans = tpls.filter(t => !cssT.includes(t)).reduce((n, t) => n
    + (t.text.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').match(/transition\s*:/g) || []).length, 0);
  let inline = 0, inlineDyn = 0;
  const el = { button: 0, input: 0, select: 0, textarea: 0, details: 0, dialog: 0, 'hp-dialog': 0, 'hp-settings-select': 0, 'hp-help': 0, 'ha-switch': 0, 'ha-icon-button': 0, 'role=switch': 0, 'role=menu': 0, 'role=tooltip': 0 };
  for (const t of htmlT) {
    for (const m of t.text.matchAll(/\sstyle="([^"]*)"/g)) { inline++; if (m[1].length >= 40) report.inlineStyles.push({ file: r, line: lineOf(src, t.start), len: m[1].length, sample: m[1].slice(0, 90) }); }
    inlineDyn += (t.text.match(/\sstyle=\$\{\}/g) || []).length;
    for (const k of Object.keys(el)) {
      if (k.startsWith('role=')) el[k] += (t.text.match(new RegExp(`role=["']?${k.slice(5)}["' >]`, 'g')) || []).length;
      else el[k] += (t.text.match(new RegExp(`<${k}[\\s>]`, 'g')) || []).length;
    }
  }
  const physical = src.split('\n').length;
  if (cssLines || inline || inlineDyn || Object.values(el).some(Boolean) || strayTrans)
    report.files[r] = { physical, styleModule: isStyleModule(f), cssLines, decls, rules, strayTransitions: strayTrans, inlineStatic: inline, inlineDynamic: inlineDyn, elements: el };
  cssTextByFile[r] = text;
}
// Totals
const T = { cssLinesStylesDir: 0, cssLinesElsewhere: 0, physicalStylesDir: 0, decls: 0, rules: 0, filesWithCss: 0, inlineStatic: 0, inlineDynamic: 0, inlineLong: report.inlineStyles.length, keyframes: report.keyframes.length, keyframeNames: new Set(report.keyframes.map(k => k.name)).size, transitionsInCss: report.transitions.length, strayTransitions: 0, animations: report.animations.length, reducedMotion: report.reducedMotion, elements: {} };
for (const [r, v] of Object.entries(report.files)) {
  if (v.cssLines) T.filesWithCss++;
  if (r.startsWith('src/styles/')) { T.cssLinesStylesDir += v.cssLines; T.physicalStylesDir += v.physical; } else T.cssLinesElsewhere += v.cssLines;
  T.decls += v.decls; T.rules += v.rules; T.inlineStatic += v.inlineStatic; T.inlineDynamic += v.inlineDynamic; T.strayTransitions += v.strayTransitions;
  for (const [k, n] of Object.entries(v.elements)) T.elements[k] = (T.elements[k] || 0) + n;
}
report.totals = T;
// hp-dialog call sites and whether they switch the kit on (class ui-dialog)
const dialogs = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const literal of templates(src)) {
    for (const tag of htmlTags(literal.text).filter(tag => tag.name === 'hp-dialog')) {
      const attributes = Object.fromEntries(tag.attributes.map(a => [a.name, a.value]));
      const classes = (attributes.class || '').split(/\s+/);
      dialogs.push({ file: rel(f), line: lineOf(src, literal.start) + literal.text.slice(0, tag.start).split('\n').length - 1,
        kind: attributes['data-kind'] || '?', uiDialog: classes.includes('ui-dialog'), settingsLayout: classes.includes('settings-layout') });
    }
  }
}
report.dialogs = dialogs; T.hpDialogSites = dialogs.length; T.hpDialogWithoutUiDialog = dialogs.filter(d => !d.uiDialog).length;
// static inline style="" classified: geometry/custom-properties only vs decoration
const GEO = new Set(['left','top','right','bottom','width','height','transform','transform-origin','position','inset','aspect-ratio','z-index','pointer-events','visibility','display','flex','grid-column','grid-row','rotate','translate','min-width','max-width','min-height','max-height','opacity','clip-path','touch-action']);
const inl = [];
for (const f of files) { const src = readFileSync(f, 'utf8'); for (const m of src.matchAll(/\sstyle="([^"]*)"/g)) {
  const props = [...m[1].matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map(x => x[1]);
  inl.push({ file: rel(f), line: lineOf(src, m.index), decorative: props.some(p => !p.startsWith('--') && !GEO.has(p)), props }); } }
report.inlineAll = inl; T.inlineStyleAttrs = inl.length; T.inlineDecorative = inl.filter(x => x.decorative).length;
// legacy .btn rules outside the kit generators
const KIT = /settings-action\.styles|compact-dialog-styles|form-kit/;
T.btnRulesOutsideKit = Object.entries(cssTextByFile).filter(([r]) => !KIT.test(r)).reduce((n, [, t]) => n + (t.match(/\.btn\b[^{};]*\{/g) || []).length, 0);
report.method = 'templates(): tagged css`` everywhere + any CSS-looking template literal in style modules (src/styles/**, *-style(s).ts, *.styles.ts); non-empty lines; inline long = static style="" ≥40 chars in html``/svg``';
return report;
}

if (isMainModule(import.meta.url)) {
  try {
    const root=resolve(process.argv.find(a=>a.startsWith('--root='))?.slice(7)||process.cwd());
    const report=collectUiKitReport(root);
    const output=process.argv.find(a=>a.startsWith('--json='))?.slice(7);
    if(output)writeFileSync(resolve(output),JSON.stringify(report,null,2)+'\n');
    if (process.argv.includes('--check')) {
      const metrics=collectUiKitMetrics(root,{report});
      const failures=uiKitViolations(metrics,readUiKitBaseline(root));
      console.log(JSON.stringify({metrics,failures},null,2));
      if(failures.length)process.exitCode=1;
    } else console.log(JSON.stringify(report.totals,null,2));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
