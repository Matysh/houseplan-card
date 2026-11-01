// #556: враждебные фикстуры на границу «работа модели → привилегированная
// публикация». Стадия модели — единственная недоверенная в конвейере; всё, что
// она передаёт дальше, это один artifact, и публикация обязана принимать его
// как ввод противника. В inline-shell эту границу нельзя было прогнать ни одним
// отрицательным случаем — потому проверка и вынесена в функцию.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { findingsPolicy } from '../scripts/review-findings-policy.mjs';

import {
  reviewResultProblems, parseManifest, sha256, REQUIRED_FILES, PASSPORT_FIELDS, ROUTES, verdictRoute, reviewProducerIdentity, batchReviewResultProblems,
} from '../scripts/review-result-gate.mjs';

const EXPECTED = Object.fromEntries(PASSPORT_FIELDS.map((f) => [f, `значение-${f}`]));
Object.assign(EXPECTED, { repo: 'owner/repo', issue: '7', stage: 'code', cycle: '1',
  findings_policy_snapshot: JSON.stringify(findingsPolicy('', { repo: 'owner/repo', issue: 7, stage: 'code', round: 1 })) });

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

test('#1065 same-run successful sealed producer may precede the consumer attempt', () => {
  const input = { run: '123', attempt: '2', producerRun: '123', producerAttempt: '1',
    producerResult: 'success', manifest: 'exact manifest bytes\n', producerManifest: sha256('exact manifest bytes\n') };
  assert.deepEqual(reviewProducerIdentity(input), { run_id: '123', run_attempt: '1' });
  for (const over of [{ producerRun: '124' }, { producerAttempt: '3' }, { producerAttempt: '0' },
    { producerAttempt: '999999999999999999999' }, { producerResult: 'failure' }, { producerResult: '' },
    { producerManifest: '' }, { producerManifest: 'f'.repeat(64) }, { manifest: 'changed bytes' }])
    assert.throws(() => reviewProducerIdentity({ ...input, ...over }));
  assert.deepEqual(reviewProducerIdentity({ run: '123', attempt: '2' }), { run_id: '123', run_attempt: '2' });
  assert.throws(() => reviewProducerIdentity({ run: '123', attempt: '2', producerResult: 'success' }), 'new workflow requires all producer outputs');
});

for (const kind of ['ship', 'release']) test(`#1065 ${kind} retains only the same-run successful producer and exact batch inputs`, () => {
  const expected = { repo: 'o/r', candidate: 'a'.repeat(40), base: 'v1.82.0', document: `docs/reviews/${kind}.md`,
    input_manifest: sha256('immutable prepared input manifest') };
  const bytes = { [`${kind}-review.md`]: '# Independent review\n',
    'result.json': JSON.stringify({ high: 0, medium: 0, low: 0, summary: 'Complete independent inspection' }),
    'producer.json': JSON.stringify({ schema: 1, kind, ...expected, run_id: '42', run_attempt: '1' }) };
  bytes['manifest.sha256'] = Object.entries(bytes).map(([name, value]) => `${sha256(value)}  ${name}`).join('\n');
  const input = { kind, files: Object.keys(bytes), read: name => bytes[name], expected,
    consumer: { run: '42', attempt: '2' }, producer: { producerRun: '42', producerAttempt: '1',
      producerResult: 'success', producerManifest: sha256(bytes['manifest.sha256']) } };
  assert.deepEqual(batchReviewResultProblems(input), []);
  assert.deepEqual(batchReviewResultProblems({ ...input, consumer: { run: '42', attempt: '1' } }), []);
  for (const over of [{ producer: {} }, { producer: { ...input.producer, producerResult: 'failure' } },
    { producer: { ...input.producer, producerRun: '43' } }, { consumer: { run: '42', attempt: '0' } },
    { producer: { ...input.producer, producerAttempt: '3' } },
    { producer: { ...input.producer, producerManifest: 'f'.repeat(64) } },
    { files: [...input.files, 'untrusted.json'] }, { kind: 'task' }])
    assert.ok(batchReviewResultProblems({ ...input, ...over }).length);
  for (const key of Object.keys(expected))
    assert.ok(batchReviewResultProblems({ ...input, expected: { ...expected, [key]: 'foreign' } }).length, key);
  assert.ok(batchReviewResultProblems({ ...input, read: name => name === `${kind}-review.md` ? 'changed' : bytes[name] }).length);
});

test('#1065 typed publication payload is part of sealed verdict validation', () => {
  const item = { id: 'F1', title: 'Outside issue', body: 'Concrete independent defect.', severity: 'medium' };
  assert.deepEqual(reviewResultProblems(fixture({ verdict: { outside_findings: [item] } })), []);
  for (const outside_findings of [[{ ...item, repo: 'foreign/repo' }], [{ ...item, severity: 'high' }],
    [{ ...item, body: 'Temporary patch then run ordinary test, mutant not executed' }], [item, item]])
    assert.ok(reviewResultProblems(fixture({ verdict: { outside_findings } })).length);
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
  const workflow = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
  const integrate = workflow.slice(workflow.indexOf('\n  integrate:\n'));
  const step = integrate.slice(
    integrate.indexOf('      - name: Проверить полноту и происхождение результата'),
    integrate.indexOf('      # Ревьюер пишет только в docs/reviews/.'),
  );
  assert.ok(step.length > 0, 'шаг проверки найден');
  assert.match(step, /^\s+node "\$TOOLS\/scripts\/review-result-gate\.mjs" --dir="\$dir"$/m);
  for (const field of PASSPORT_FIELDS) {
    if (field === 'run_id' || field === 'run_attempt') continue; // приходят из GITHUB_*
    assert.match(step, new RegExp(`^\\s+${field.toUpperCase()}: `, 'm'), `${field} передаётся гейту`);
  }
  // Публикация читает вердикт только после гейта.
  assert.ok(step.indexOf('review-result-gate.mjs') < step.indexOf('structured_output'));
});

// #726: маршрут вердикта на границе доверия. Смысл criterion судит reviewRoute,
// граница — только словарь route и противоречие с зелёным вердиктом.
test('#726 AC1: route — нет → fix, словарь, green + reclassify — отказ, criterion любой строкой', () => {
  assert.deepEqual(ROUTES, ['fix', 'reclassify']);
  // route нет (вердикты до #726, модель не заполнила) — принято и читается как fix.
  assert.deepEqual(reviewResultProblems(fixture()), []);
  assert.deepEqual(reviewResultProblems(fixture({ verdict: { verdict: 'yellow', route: null } })), [], 'null — не заполнено');
  assert.equal(verdictRoute({ verdict: 'yellow' }), 'fix');
  assert.equal(verdictRoute({ verdict: 'yellow', route: null }), 'fix');
  for (const [verdict, route] of [['yellow', 'fix'], ['red', 'fix'], ['green', 'fix'], ['yellow', 'reclassify'], ['red', 'reclassify']]) {
    assert.deepEqual(reviewResultProblems(fixture({ verdict: { verdict, route } })), [], `${verdict} + ${route}`);
    assert.equal(verdictRoute({ verdict, route }), route);
  }
  // Вне словаря — отказ.
  for (const route of ['merge', 'Fix', '', 42, true, {}, ['fix']]) {
    const problems = reviewResultProblems(fixture({ verdict: { verdict: 'yellow', route } }));
    assert.ok(problems.some((p) => p.startsWith('route вне словаря')), JSON.stringify(route));
    assert.equal(verdictRoute({ route }), null);
  }
  // Зелёный вместе с reclassify — противоречивый результат, fail-closed.
  const green = reviewResultProblems(fixture({ verdict: { verdict: 'green', route: 'reclassify', criterion: 'undocumented' } }));
  assert.ok(green.some((p) => p.startsWith('reclassify при зелёном вердикте')), green.join('; '));
  // criterion любой строкой проходит границу — его смысл судит маршрут (К2).
  for (const criterion of ['undocumented', 'vibes', '', 'q` --> <b>']) {
    assert.deepEqual(reviewResultProblems(fixture({ verdict: { verdict: 'yellow', route: 'reclassify', criterion } })), [], criterion);
  }
});
