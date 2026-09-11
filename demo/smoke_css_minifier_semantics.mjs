// #526: включённая минификация не меняет смысл таблиц стилей.
//
// Минификатор молчал с самого начала (его отсев искал тег вплотную к бэктику,
// а плагин видит вывод TypeScript с пробелом), поэтому 23 КБ CSS проходят
// сжатие впервые. Риск задачи не в двух строках отсева, а в том, что где-то
// съеден значащий пробел — потомковый комбинатор, аргумент calc(), кавычка.
//
// Судим не глазами и не байтами, а браузером: исходный и минифицированный
// текст кладутся в отдельные CSSStyleSheet, и сериализованные правила обязаны
// совпасть посимвольно. Браузер сам приводит запись к канонической форме,
// поэтому совпадение cssText означает совпадение смысла.
import { readFileSync, readdirSync } from 'node:fs';
import { minifyCssText } from '../scripts/css-template-minifier.mjs';
import { launch, checkAll, finish } from './serve.mjs';

/** Тело статического css-шаблона модуля (интерполяций в них нет, см. ТЗ). */
const templateBody = (source) => {
  const match = /(^|[^\w$.])css\s*`/.exec(source);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = source.indexOf('`', start);
  if (end < 0) return null;
  const body = source.slice(start, end);
  return body.includes('\\') || body.includes('${') ? null : body;
};

const files = [
  ...readdirSync(new URL('../src/styles/', import.meta.url))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => [`src/styles/${name}`, new URL(`../src/styles/${name}`, import.meta.url)]),
  ['src/editor-secondary.styles.ts', new URL('../src/editor-secondary.styles.ts', import.meta.url)],
];

const pairs = [];
for (const [label, url] of files) {
  const body = templateBody(readFileSync(url, 'utf8'));
  if (!body) continue;
  pairs.push({ label, source: body, minified: minifyCssText(body, label) });
}

const { page, browser } = await launch();
const out = await page.evaluate(async (input) => {
  const result = {};
  // Минификатор по контракту схлопывает пробельные пробеги и убирает пробел
  // после запятой. В обычных значениях браузер делает то же самое сам, но
  // значение СВОЙСТВА-ПЕРЕМЕННОЙ он хранит текстом как есть, поэтому такие
  // правила отличались бы записью при полном совпадении смысла. Сравнение
  // нормализует ровно объявленную политику пробелов минификатора — пробельные
  // пробеги и пробел рядом с `,`, `:`, `(`, `)` — и ничего больше: пропавший
  // потомковый
  // комбинатор (`.a .b` → `.a.b`) или съеденный пробел в `calc(100% - 2px)`
  // остаются расхождением и валят свидетеля.
  const normalize = (text) => text
    .replace(/\s+/g, ' ')
    .replace(/([,:(])\s/g, '$1')
    .replace(/\s\)/g, ')');
  const rulesOf = (sheet) => {
    const list = [];
    const walk = (rules) => {
      for (const rule of rules) {
        list.push(normalize(rule.cssText));
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    walk(sheet.cssRules);
    return list;
  };
  const mismatches = [];
  let comparedRules = 0;
  for (const pair of input) {
    const before = new CSSStyleSheet();
    const after = new CSSStyleSheet();
    before.replaceSync(pair.source);
    after.replaceSync(pair.minified);
    const left = rulesOf(before);
    const right = rulesOf(after);
    comparedRules += left.length;
    if (left.length !== right.length) {
      mismatches.push(`${pair.label}: правил ${left.length} против ${right.length}`);
      continue;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        mismatches.push(`${pair.label}: правило ${index}\n  было: ${left[index].slice(0, 160)}\n  стало: ${right[index].slice(0, 160)}`);
        break;
      }
    }
  }
  result.filesCompared = input.length;
  result.enoughFiles = input.length >= 5;
  result.rulesCompared = comparedRules;
  result.enoughRules = comparedRules >= 500;
  result.everyRuleIdentical = mismatches.length === 0;
  result.mismatches = mismatches.slice(0, 3);
  // Минификация обязана быть не просто безопасной, но и полезной.
  const saved = input.reduce((sum, pair) => sum + pair.source.length - pair.minified.length, 0);
  result.savedBytes = saved;
  result.savesRealBytes = saved > 20000;
  return result;
}, pairs);

console.log(JSON.stringify({ ...out, mismatches: out.mismatches }, null, 1));
checkAll(out, {
  filesCompared: out.filesCompared,
  rulesCompared: out.rulesCompared,
  savedBytes: out.savedBytes,
  mismatches: [],
});
await browser.close();
finish();
