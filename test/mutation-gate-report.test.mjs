import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_TITLE_MARKER, mutationGateReport, mutationShardEvidence, parseShardLogs,
  telegramSummary, validateMutationShardEvidence,
} from '../scripts/mutation-gate-report.mjs';

// #472. Еженедельный полный прогон падал дважды подряд, и никто не смотрел:
// у отказа не было адресата. Отчёт обязан назвать сбежавших так, чтобы
// команда воспроизведения из письма работала, — а не выдумывать сущности из
// строк, которые выглядят похоже.

const KNOWN = ['alpha-mutant', 'beta-mutant', 'gamma-mutant'];
const guards = new Map([
  ['alpha-mutant', 'node --test test/a.test.mjs'],
  ['beta-mutant', 'node demo/smoke_b.mjs'],
  ['gamma-mutant', 'node --test test/g.test.mjs'],
]);
const meta = { runUrl: 'https://x/runs/1', ref: 'dev', sha: 'abcdef1234567890', date: '2026-09-08' };
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const expectedEvidence = {
  materialSha: A, materialTree: B, workflowSha: C,
  runId: 549, runAttempt: 2, shardCount: 4,
};
const evidenceRow = (shard, overrides = {}) => ({
  file: `attempt-${overrides.runAttempt || 1}/shard-${shard}/evidence.json`,
  evidence: mutationShardEvidence({
    ...expectedEvidence, shard, runAttempt: 1, ...overrides,
  }),
});

test('#549: четыре шарда одного material образуют доказанный результат', () => {
  const result = validateMutationShardEvidence(
    [1, 2, 3, 4].map((shard) => evidenceRow(shard)), expectedEvidence,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.selected.map((row) => row.evidence.shard), [1, 2, 3, 4]);
});

test('#549: foreign SHA и отсутствующий шард отвергаются fail-closed', () => {
  const rows = [evidenceRow(1), evidenceRow(2, { materialSha: 'd'.repeat(40) }), evidenceRow(4)];
  const result = validateMutationShardEvidence(rows, expectedEvidence);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('foreign material SHA')));
  assert.ok(result.errors.some((error) => error.includes('shard 3: evidence is missing')));
});

test('#549: partial retry выбирает новый attempt, но сохраняет единый material', () => {
  const rows = [1, 2, 3, 4].map((shard) => evidenceRow(shard));
  rows.push(evidenceRow(2, { runAttempt: 2 }));
  const result = validateMutationShardEvidence(rows, expectedEvidence);
  assert.equal(result.ok, true);
  assert.equal(result.selected.find((row) => row.evidence.shard === 2).evidence.runAttempt, 2);
  assert.equal(result.selected.find((row) => row.evidence.shard === 1).evidence.runAttempt, 1);
});

test('#549: partial retry с другим material не склеивается со старыми шардами', () => {
  const rows = [1, 2, 3, 4].map((shard) => evidenceRow(shard));
  rows.push(evidenceRow(2, { runAttempt: 2, materialSha: 'd'.repeat(40) }));
  const result = validateMutationShardEvidence(rows, expectedEvidence);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('foreign material SHA')));
});

test('сбежавшие собираются из нескольких шардов без дублей и по порядку (#472 AC3)', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'ok   x\nFAIL beta-mutant: тест остался зелёным на сломанном коде\n     guard: node demo/smoke_b.mjs\n' },
    { shard: 2, text: 'FAIL alpha-mutant: тест остался зелёным на сломанном коде\nFAIL beta-mutant: тест остался зелёным на сломанном коде\n' },
    { shard: 3, text: 'ok   gamma-mutant: тест покраснел, как обязан\n\nпоймано 1 из 1\n' },
  ] });
  assert.deepEqual(report.escaped, ['alpha-mutant', 'beta-mutant']);
  assert.deepEqual(report.shards.map((s) => s.status), ['failed', 'failed', 'ok']);
  assert.equal(report.failed, true);
  assert.match(report.body, /--id=alpha-mutant/);
  assert.match(report.body, /guard: `node demo\/smoke_b\.mjs`/);
});

test('красный гард без мутанта — не сбежавший мутант (#472 AC3, ревью r1)', () => {
  // runCleanGuards пишет в тот же лог. Наивный парсер сделал бы мутанта «чистый».
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'FAIL чистый прогон: node --test test/g.test.mjs красный без мутанта\n' },
  ] });
  assert.deepEqual(report.escaped, []);
  assert.deepEqual(report.redGuards, ['node --test test/g.test.mjs']);
  assert.ok(!report.body.includes('--id=чистый'));
  assert.match(report.body, /красные без мутанта/);
  assert.equal(report.failed, true);
});

test('#550: setup/invalid/interruption reported as unverified, never escaped or caught', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: [
      'FAIL alpha-mutant: ошибка подготовки до заявленного теста',
      'FAIL beta-mutant: неприменимый мутант',
      'FAIL gamma-mutant: прерывание инфраструктуры',
      'FAIL чистая подготовка: npx tsc -p tsconfig.test.json',
    ].join('\n') },
  ] });
  assert.deepEqual(report.escaped, []);
  assert.deepEqual(report.redGuards, []);
  assert.equal(report.unverifiable.length, 4);
  assert.equal(report.unparsed.length, 0);
  assert.match(report.body, /Свидетели без доказательства \(4\)/);
  assert.match(report.body, /не записывается в ledger/);
  assert.ok(!report.body.includes('--id=alpha-mutant'));
  assert.equal(report.failed, true);
});

test('id вне реестра не выдумывается, строка сохраняется как есть (#472 AC3)', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'FAIL ghost-mutant: тест остался зелёным на сломанном коде\n' },
  ] });
  assert.deepEqual(report.escaped, []);
  assert.equal(report.unparsed.length, 1);
  assert.match(report.unparsed[0].line, /ghost-mutant/);
  assert.match(report.body, /Неразобранные строки FAIL/);
});

test('отсутствующий лог шарда — отказ, а не «сбежавших нет» (#472 AC3)', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'ok   alpha-mutant: тест покраснел, как обязан\n' },
    { shard: 2, text: null },
  ] });
  assert.deepEqual(report.escaped, []);
  assert.equal(report.shards[1].status, 'missing');
  assert.equal(report.failed, true, 'нет артефакта — не знаем, что сбежало');
  assert.match(report.body, /Артефакты шардов 2 не пришли/);
});

test('заголовок несёт постоянный маркер, тело — прогон, SHA и дату (#472 AC4)', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [{ shard: 1, text: 'FAIL alpha-mutant: тест остался зелёным на сломанном коде\n' }] });
  assert.ok(report.title.startsWith(REPORT_TITLE_MARKER));
  assert.match(report.body, /https:\/\/x\/runs\/1/);
  assert.match(report.body, /abcdef123456/);
  assert.match(report.body, /2026-09-08/);
});

test('зелёный набор логов даёт failed=false (#472)', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'ok   alpha-mutant: тест покраснел, как обязан\n\nпоймано 1 из 1\n', outcome: 'success' },
    { shard: 2, text: 'поймано 3 из 3\n' },
  ] });
  assert.equal(report.failed, false);
  assert.deepEqual(report.shards.map((s) => s.status), ['ok', 'ok']);
});

// #604. Шард 2/4 ночного прогона 21.09 снят по timeout-minutes на 60-й минуте
// после ≥155 зелёных строк; строк FAIL в обрывке нет, и отчёт написал «ok» при
// красном прогоне. Зелёным считается только лог, дошедший до итоговой строки.
test('#604: лог без итоговой строки — прерван, а не «ok»', () => {
  const truncated = 'ok   alpha-mutant: тест покраснел, как обязан\nok   beta-mutant: тест покраснел, как обязан\n';
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'поймано 2 из 2\n' },
    { shard: 2, text: truncated },
  ] });
  assert.deepEqual(report.shards.map((s) => s.status), ['ok', 'interrupted']);
  assert.equal(report.failed, true, 'обрыв — отказ: до сбежавших могли не дойти');
  assert.deepEqual(report.escaped, [], 'сбежавших из обрывка не выдумывается');
  assert.match(report.body, /\| 2 \| \*\*прерван — лог без итоговой строки \(таймаут или отмена\)\*\* \|/);
  assert.match(report.body, /Шарды 2 прерваны до итоговой строки/);
  assert.match(telegramSummary(report, 'https://x/issues/9'), /2:interrupted/);
});

test('#604: исход шага cancelled прерывает шард даже при итоговой строке; failure без FAIL — красный', () => {
  const finished = 'ok   alpha-mutant: тест покраснел, как обязан\n\nпоймано 1 из 1\n';
  const parsed = parseShardLogs([
    { shard: 1, text: finished, outcome: 'cancelled' },
    { shard: 2, text: finished, outcome: 'skipped' },
    { shard: 3, text: finished, outcome: 'failure' },
    { shard: 4, text: 'поймано 2 из 3\n', outcome: 'success' },
    { shard: 5, text: finished, outcome: 'success' },
    { shard: 6, text: finished },
  ], KNOWN);
  assert.deepEqual(parsed.shards.map((s) => s.status), ['interrupted', 'interrupted', 'failed', 'failed', 'ok', 'ok']);
});

test('#604: evidence несёт исход шага, агрегатор отвергает прерванный шард как неполный', () => {
  const rows = [1, 2, 3, 4].map((shard) => evidenceRow(shard, { outcome: shard === 2 ? 'cancelled' : 'success' }));
  assert.equal(rows[1].evidence.outcome, 'cancelled');
  assert.equal(evidenceRow(1).evidence.outcome, undefined, 'старые артефакты без исхода остаются валидными');
  const result = validateMutationShardEvidence(rows, expectedEvidence);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('shard 2: run was interrupted (step outcome cancelled)')));
  // красный шаг — не нарушение identity: красноту называет лог, не агрегатор
  const red = validateMutationShardEvidence([1, 2, 3, 4].map((shard) => evidenceRow(shard, { outcome: 'failure' })), expectedEvidence);
  assert.equal(red.ok, true);
  assert.throws(() => mutationShardEvidence({ ...expectedEvidence, shard: 1, runAttempt: 1, outcome: 'timed-out' }), /unknown shard outcome/);
});

test('сводка для Telegram коротка и ведёт на issue (#472)', () => {
  const report = mutationGateReport({ ...meta, guards, logs: [
    { shard: 1, text: 'FAIL alpha-mutant: тест остался зелёным на сломанном коде\n' },
    { shard: 2, text: null },
  ] });
  const text = telegramSummary(report, 'https://x/issues/9');
  assert.match(text, /alpha-mutant/);
  assert.match(text, /2:missing/);
  assert.match(text, /https:\/\/x\/issues\/9/);
  assert.ok(text.length < 600);
});

test('parseShardLogs терпит CRLF и пустой ввод (#472)', () => {
  const parsed = parseShardLogs([{ shard: 1, text: 'FAIL alpha-mutant: тест остался зелёным на сломанном коде\r\n' }], KNOWN);
  assert.deepEqual(parsed.escaped, ['alpha-mutant']);
  assert.deepEqual(parseShardLogs([], KNOWN).shards, []);
});
