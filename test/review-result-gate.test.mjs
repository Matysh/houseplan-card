// #556: враждебные фикстуры на границу «работа модели → привилегированная
// публикация». Стадия модели — единственная недоверенная в конвейере; всё, что
// она передаёт дальше, это один artifact, и публикация обязана принимать его
// как ввод противника. В inline-shell эту границу нельзя было прогнать ни одним
// отрицательным случаем — потому проверка и вынесена в функцию.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  reviewResultProblems, parseManifest, sha256, REQUIRED_FILES, PASSPORT_FIELDS,
} from '../scripts/review-result-gate.mjs';

const EXPECTED = Object.fromEntries(PASSPORT_FIELDS.map((f) => [f, `значение-${f}`]));

/** Честный artifact стадии модели. */
function fixture(over = {}) {
  const document = over.document ?? '# разбор\n\nвсё проверено\n';
  const prepared = JSON.stringify({ schema: 1, ...EXPECTED, ...(over.prepared || {}) });
  const verdict = JSON.stringify({ verdict: 'green', high: 0, medium: 0, summary: 'ok', ...(over.verdict || {}) });
  const body = { 'review-document.md': document, 'prepared.json': prepared, 'verdict.json': verdict };
  const manifest = Object.entries(body)
    .map(([name, text]) => `${over.breakSum === name ? 'f'.repeat(64) : sha256(text)}  ${name}`)
    .join('\n') + '\n';
  const files = { ...body, 'manifest.sha256': manifest, ...(over.extraFiles || {}) };
  for (const name of over.drop || []) delete files[name];
  return {
    files: Object.keys(files),
    read: (name) => files[name],
    expected: EXPECTED,
  };
}

test('#556: честный результат принимается', () => {
  assert.deepEqual(reviewResultProblems(fixture()), []);
});

test('#556: неполный набор файлов отвергается', () => {
  for (const name of REQUIRED_FILES) {
    const problems = reviewResultProblems(fixture({ drop: [name] }));
    assert.ok(problems.length >= 1, name);
    assert.match(problems[0], /набор файлов не тот/, name);
  }
});

test('#556: лишний файл в artifact отвергается', () => {
  const problems = reviewResultProblems(fixture({ extraFiles: { 'payload.sh': 'rm -rf /' } }));
  assert.match(problems[0], /набор файлов не тот/);
});

test('#556: подменённое содержимое ловится контрольной суммой', () => {
  for (const name of ['review-document.md', 'prepared.json', 'verdict.json']) {
    const problems = reviewResultProblems(fixture({ breakSum: name }));
    assert.ok(problems.some((p) => p.includes(`контрольная сумма не сходится: ${name}`)), name);
  }
});

test('#556: чужой прогон и чужая попытка отвергаются', () => {
  for (const field of ['run_id', 'run_attempt']) {
    const problems = reviewResultProblems(fixture({ prepared: { [field]: 'чужое' } }));
    assert.ok(problems.some((p) => p.startsWith(`паспорт не совпал: ${field}`)), field);
  }
});

test('#556: устаревший материал отвергается — и по SHA, и по дереву', () => {
  for (const field of ['material_sha', 'material_tree']) {
    const problems = reviewResultProblems(fixture({ prepared: { [field]: 'a'.repeat(40) } }));
    assert.ok(problems.some((p) => p.startsWith(`паспорт не совпал: ${field}`)), field);
  }
});

test('#556: чужая задача, этап, раунд и ветка отвергаются', () => {
  for (const field of ['issue', 'stage', 'cycle', 'branch']) {
    const problems = reviewResultProblems(fixture({ prepared: { [field]: 'чужое' } }));
    assert.ok(problems.some((p) => p.startsWith(`паспорт не совпал: ${field}`)), field);
  }
});

test('#556: сверяется КАЖДОЕ поле паспорта, а не выбранные', () => {
  for (const field of PASSPORT_FIELDS) {
    const problems = reviewResultProblems(fixture({ prepared: { [field]: 'подменено' } }));
    assert.ok(problems.some((p) => p.startsWith(`паспорт не совпал: ${field}`)), field);
  }
});

test('#556: чужая схема паспорта отвергается', () => {
  assert.ok(reviewResultProblems(fixture({ prepared: { schema: 2 } }))
    .some((p) => p.includes('не та схема')));
});

test('#556: вердикт вне словаря и кривые поля отвергаются', () => {
  assert.ok(reviewResultProblems(fixture({ verdict: { verdict: 'merged' } }))
    .some((p) => p.startsWith('verdict вне словаря')));
  assert.ok(reviewResultProblems(fixture({ verdict: { high: '0' } }))
    .some((p) => p.includes('high не число')));
  assert.ok(reviewResultProblems(fixture({ verdict: { summary: 42 } }))
    .some((p) => p.includes('summary не строка')));
});

test('#556: пустой документ ревью — не документ', () => {
  assert.ok(reviewResultProblems(fixture({ document: '   \n' }))
    .some((p) => p.includes('документ ревью пуст')));
});

test('#556: manifest, который покрывает не те файлы, отвергается', () => {
  const base = fixture();
  const read = (name) => (name === 'manifest.sha256'
    ? `${sha256(base.read('verdict.json'))}  verdict.json\n`
    : base.read(name));
  assert.ok(reviewResultProblems({ ...base, read })
    .some((p) => p.startsWith('manifest покрывает не те файлы')));
});

test('#556: неразбираемые manifest и JSON — отказ, а не исключение', () => {
  const base = fixture();
  const broken = (name, text) => ({ ...base, read: (n) => (n === name ? text : base.read(n)) });
  assert.deepEqual(reviewResultProblems(broken('manifest.sha256', 'мусор')), ['manifest.sha256 не разобран']);
  assert.ok(reviewResultProblems(broken('prepared.json', '{')).some((p) => p.includes('prepared.json не разобран')));
  assert.ok(reviewResultProblems(broken('verdict.json', '{')).some((p) => p.includes('verdict.json не разобран')));
});

test('#556: разбор строки sha256sum терпит и пробел, и звёздочку', () => {
  const hex = 'a'.repeat(64);
  assert.deepEqual(parseManifest(`${hex}  x.md\n`), [{ hash: hex, name: 'x.md' }]);
  assert.deepEqual(parseManifest(`${hex} *x.md\n`), [{ hash: hex, name: 'x.md' }]);
  assert.equal(parseManifest('не хеш вовсе'), null);
});

// Проверка обязана стоять на пути привилегированной стадии, а не просто
// существовать в репозитории.
test('#556: integrate пропускает artifact только через гейт', () => {
  const workflow = readFileSync(new URL('../.github/workflows/process.yml', import.meta.url), 'utf8');
  const integrate = workflow.slice(workflow.indexOf('\n  integrate:\n'));
  const step = integrate.slice(
    integrate.indexOf('      - name: Проверить полноту и происхождение результата'),
    integrate.indexOf('      # Ревьюер пишет только в docs/reviews/.'),
  );
  assert.ok(step.length > 0, 'шаг проверки найден');
  assert.match(step, /^\s+node scripts\/review-result-gate\.mjs --dir="\$dir"$/m);
  for (const field of PASSPORT_FIELDS) {
    if (field === 'run_id' || field === 'run_attempt') continue; // приходят из GITHUB_*
    assert.match(step, new RegExp(`^\\s+${field.toUpperCase()}: `, 'm'), `${field} передаётся гейту`);
  }
  // Публикация читает вердикт только после гейта.
  assert.ok(step.indexOf('review-result-gate.mjs') < step.indexOf('structured_output'));
});
