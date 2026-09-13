#!/usr/bin/env node
/**
 * Отчёт об отказе полного мутационного прогона по расписанию (#472).
 *
 * Что случилось. Еженедельный прогон `mutation-gate.yml` дважды подряд не дал
 * зелёного результата (24.08 отменён, 31.08 красный во всех шардах), и никто
 * этого не открыл: у отказа не было адресата. Пять дней спустя ручной прогон
 * перед стабильной v1.72.0 остановил релиз теми же сбежавшими мутантами
 * (#465–#467). Механизм есть — его выход никто не читает.
 *
 * Этот модуль — чистая функция «логи шардов → отчёт» и тонкий CLI. Обвязка
 * (`gh issue`, `curl` в Telegram) остаётся в workflow, потому что у shell там
 * нет тестов, а у разбора логов — есть (урок #454).
 *
 * Две формы `FAIL` в логе раннера различаются явно:
 *
 *   FAIL <mutant-id>: тест остался зелёным на сломанном коде   → escaped
 *   FAIL чистый прогон: <guard> красный без мутанта             → redGuards
 *   FAIL <mutant-id>: ошибка подготовки до заявленного теста    → unverifiable
 *
 * Наивный парсер «id — это слово после FAIL» сделал бы из второй формы
 * мутанта по имени «чистый», которого в реестре нет, и команда `--id=чистый`
 * в письме не сработала бы. Поэтому id обязан существовать в реестре; всё
 * остальное уходит в `unparsed` с текстом как есть — потерять строку нельзя,
 * но и выдумывать из неё сущность тоже.
 */
import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const REPORT_TITLE_MARKER = '[mutation-gate] отказ прогона по расписанию';
export const MUTATION_EVIDENCE_SCHEMA = 'houseplan-mutation-shard-evidence/v1';

const ESCAPED_LINE = /^FAIL (\S+): тест остался зелёным на сломанном коде\s*$/;
const RED_GUARD_LINE = /^FAIL чистый прогон: (.+?) красный без мутанта\s*$/;
const UNVERIFIABLE_LINE = /^FAIL (\S+): (неприменимый мутант|ошибка подготовки до заявленного теста|прерывание инфраструктуры)\s*$/;
const CLEAN_UNVERIFIABLE_LINE = /^FAIL чистая (подготовка|инфраструктура): (.+?)\s*$/;
const ANY_FAIL_LINE = /^FAIL /;

const FULL_SHA = /^[0-9a-f]{40}$/;
const positiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

/** Machine-readable identity written beside every nightly shard log (#549). */
export function mutationShardEvidence(input) {
  const evidence = {
    schema: MUTATION_EVIDENCE_SCHEMA,
    materialSha: String(input.materialSha || ''),
    materialTree: String(input.materialTree || ''),
    workflowSha: String(input.workflowSha || ''),
    runId: Number(input.runId),
    runAttempt: Number(input.runAttempt),
    shard: Number(input.shard),
    shardCount: Number(input.shardCount),
  };
  if (!FULL_SHA.test(evidence.materialSha) || !FULL_SHA.test(evidence.materialTree)
    || !FULL_SHA.test(evidence.workflowSha) || !positiveInteger(evidence.runId)
    || !positiveInteger(evidence.runAttempt) || !positiveInteger(evidence.shard)
    || !positiveInteger(evidence.shardCount) || evidence.shard > evidence.shardCount) {
    throw new Error('invalid mutation shard evidence identity');
  }
  return evidence;
}

/**
 * Select the newest artifact attempt for each shard, then prove that the whole
 * set belongs to one immutable material and workflow run. Older artifacts are
 * deliberately ignored so a full rerun may pin a fresh material, while a
 * partial rerun can reuse successful shards from its earlier attempt.
 */
export function validateMutationShardEvidence(rows, expected) {
  const errors = [];
  const byShard = new Map();
  for (const row of rows || []) {
    if (row?.error) { errors.push(`${row.file || 'evidence'}: ${row.error}`); continue; }
    const evidence = row?.evidence;
    try {
      mutationShardEvidence(evidence || {});
    } catch {
      errors.push(`${row?.file || 'evidence'}: invalid evidence identity`);
      continue;
    }
    const shard = Number(evidence.shard);
    const current = byShard.get(shard);
    if (!current || Number(evidence.runAttempt) > Number(current.evidence.runAttempt)) {
      byShard.set(shard, row);
    } else if (Number(evidence.runAttempt) === Number(current.evidence.runAttempt)) {
      errors.push(`shard ${shard}: duplicate evidence for attempt ${evidence.runAttempt}`);
    }
  }

  const selected = [];
  const shardCount = Number(expected.shardCount);
  for (let shard = 1; shard <= shardCount; shard++) {
    const row = byShard.get(shard);
    if (!row) { errors.push(`shard ${shard}: evidence is missing`); continue; }
    const evidence = row.evidence;
    selected.push(row);
    if (evidence.schema !== MUTATION_EVIDENCE_SCHEMA) errors.push(`shard ${shard}: wrong schema`);
    if (Number(evidence.shardCount) !== shardCount) errors.push(`shard ${shard}: wrong shard count`);
    if (evidence.materialSha !== expected.materialSha) errors.push(`shard ${shard}: foreign material SHA`);
    if (evidence.materialTree !== expected.materialTree) errors.push(`shard ${shard}: foreign material tree`);
    if (evidence.workflowSha !== expected.workflowSha) errors.push(`shard ${shard}: foreign workflow SHA`);
    if (Number(evidence.runId) !== Number(expected.runId)) errors.push(`shard ${shard}: foreign run id`);
    if (!positiveInteger(evidence.runAttempt)
      || Number(evidence.runAttempt) > Number(expected.runAttempt)) {
      errors.push(`shard ${shard}: impossible run attempt`);
    }
  }
  return { ok: errors.length === 0, errors, selected };
}

function evidenceFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === 'evidence.json') out.push(path);
    }
  };
  walk(root);
  return out.sort();
}

export function loadMutationShardArtifacts(root, expected) {
  const rows = evidenceFiles(root).map((file) => {
    try { return { file, evidence: JSON.parse(readFileSync(file, 'utf8')) }; }
    catch (error) { return { file, error: `invalid JSON: ${error.message}` }; }
  });
  const validation = validateMutationShardEvidence(rows, expected);
  const selectedByShard = new Map(validation.selected.map((row) => [Number(row.evidence.shard), row]));
  const logs = [];
  for (let shard = 1; shard <= Number(expected.shardCount); shard++) {
    const row = selectedByShard.get(shard);
    const path = row ? join(dirname(row.file), `mutation-shard-${shard}.log`) : '';
    logs.push({ shard, text: path && existsSync(path) ? readFileSync(path, 'utf8') : null });
    if (row && (!path || !existsSync(path))) validation.errors.push(`shard ${shard}: log is missing`);
  }
  validation.ok = validation.errors.length === 0;
  return { ...validation, logs };
}

/**
 * Разобрать логи шардов.
 *
 * @param {Array<{ shard: number, text: string | null }>} logs — `text: null`
 *   означает, что артефакт шарда не пришёл. Это тоже отказ: «лога нет» не
 *   значит «сбежавших нет», это значит «мы не знаем».
 * @param {Set<string>|string[]} knownIds — id реестра.
 */
export function parseShardLogs(logs, knownIds) {
  const known = new Set(knownIds);
  const escaped = new Set();
  const redGuards = new Set();
  const unverifiable = [];
  const unparsed = [];
  const shards = [];
  for (const { shard, text } of logs) {
    if (text == null) { shards.push({ shard, status: 'missing' }); continue; }
    let failed = false;
    for (const raw of String(text).split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (!ANY_FAIL_LINE.test(line)) continue;
      failed = true;
      const asEscaped = ESCAPED_LINE.exec(line);
      if (asEscaped && known.has(asEscaped[1])) { escaped.add(asEscaped[1]); continue; }
      const asRed = RED_GUARD_LINE.exec(line);
      if (asRed) { redGuards.add(asRed[1]); continue; }
      const asUnverifiable = UNVERIFIABLE_LINE.exec(line);
      if (asUnverifiable && known.has(asUnverifiable[1])) {
        unverifiable.push({ shard, id: asUnverifiable[1], reason: asUnverifiable[2] });
        continue;
      }
      const asCleanUnverifiable = CLEAN_UNVERIFIABLE_LINE.exec(line);
      if (asCleanUnverifiable) {
        unverifiable.push({ shard, id: '', reason: `чистая ${asCleanUnverifiable[1]}: ${asCleanUnverifiable[2]}` });
        continue;
      }
      unparsed.push({ shard, line });
    }
    shards.push({ shard, status: failed ? 'failed' : 'ok' });
  }
  return {
    escaped: [...escaped].sort(),
    redGuards: [...redGuards].sort(),
    unverifiable,
    unparsed,
    shards: shards.sort((a, b) => a.shard - b.shard),
  };
}

/**
 * Собрать заголовок и тело issue.
 *
 * @param {object} input
 * @param {Array<{ shard: number, text: string | null }>} input.logs
 * @param {Map<string, string>|Record<string, string>} input.guards — id → guard
 * @param {string} input.runUrl
 * @param {string} input.ref
 * @param {string} input.sha
 * @param {string} input.date — ISO
 */
export function mutationGateReport(input) {
  const guards = input.guards instanceof Map ? input.guards : new Map(Object.entries(input.guards || {}));
  const parsed = parseShardLogs(input.logs || [], [...guards.keys()]);
  const evidenceErrors = [...(input.evidenceErrors || [])];
  const failed = evidenceErrors.length > 0 || parsed.shards.some((s) => s.status !== 'ok')
    || parsed.escaped.length > 0 || parsed.redGuards.length > 0
    || parsed.unverifiable.length > 0 || parsed.unparsed.length > 0;
  const lines = [];
  lines.push(`Полный мутационный прогон по расписанию не прошёл: ${input.date}, \`${input.ref}\` @ \`${String(input.sha || '').slice(0, 12)}\`.`);
  lines.push(`Прогон: ${input.runUrl}`);
  lines.push('');
  lines.push('| шард | результат |');
  lines.push('|---|---|');
  for (const s of parsed.shards) {
    const label = s.status === 'ok' ? 'ok' : s.status === 'failed' ? '**красный**' : '**артефакт не пришёл**';
    lines.push(`| ${s.shard} | ${label} |`);
  }
  if (evidenceErrors.length) {
    lines.push('');
    lines.push('## Материал шардов не доказан');
    lines.push('');
    lines.push('Агрегатор отверг смешанные или неполные evidence; общий результат этому SHA не приписывается.');
    lines.push('');
    for (const error of evidenceErrors) lines.push(`- ${error}`);
  }
  if (parsed.escaped.length) {
    lines.push('');
    lines.push(`## Сбежавшие мутанты (${parsed.escaped.length})`);
    lines.push('');
    lines.push('Тест остался зелёным на сломанном коде — свидетель разучился краснеть. Воспроизведение:');
    lines.push('');
    for (const id of parsed.escaped) {
      lines.push(`- \`${id}\` — \`node scripts/mutation-gate.mjs --id=${id}\``);
      const guard = guards.get(id);
      if (guard) lines.push(`  guard: \`${guard}\``);
    }
  }
  if (parsed.redGuards.length) {
    lines.push('');
    lines.push(`## Гарды, красные без мутанта (${parsed.redGuards.length})`);
    lines.push('');
    lines.push('Это не сбежавший мутант: тест падает и на исправном коде, доказать им ничего нельзя. Команда как есть:');
    lines.push('');
    for (const guard of parsed.redGuards) lines.push(`- \`${guard}\``);
  }
  if (parsed.unverifiable.length) {
    lines.push('');
    lines.push(`## Свидетели без доказательства (${parsed.unverifiable.length})`);
    lines.push('');
    lines.push('Заявленный тест не дал вердикт: такой исход не записывается в ledger и не переиспользуется.');
    lines.push('');
    for (const item of parsed.unverifiable) {
      const target = item.id ? `\`${item.id}\`` : `шард ${item.shard}`;
      lines.push(`- ${target} — ${item.reason}`);
    }
  }
  if (parsed.unparsed.length) {
    lines.push('');
    lines.push(`## Неразобранные строки FAIL (${parsed.unparsed.length})`);
    lines.push('');
    for (const { shard, line } of parsed.unparsed) lines.push(`- шард ${shard}: \`${line}\``);
  }
  const missing = parsed.shards.filter((s) => s.status === 'missing');
  if (missing.length) {
    lines.push('');
    lines.push(`Артефакты шардов ${missing.map((s) => s.shard).join(', ')} не пришли — это отказ, а не отсутствие сбежавших.`);
  }
  return {
    title: `${REPORT_TITLE_MARKER}: ${input.date}`,
    body: `${lines.join('\n')}\n`,
    failed,
    ...parsed,
  };
}

/** Короткий текст для Telegram: заголовок, сбежавшие, ссылка. */
export function telegramSummary(report, issueUrl) {
  const head = `⛔ houseplan-card: ${REPORT_TITLE_MARKER}`;
  const escaped = report.escaped.length
    ? `сбежали: ${report.escaped.slice(0, 8).join(', ')}${report.escaped.length > 8 ? ` +${report.escaped.length - 8}` : ''}`
    : 'сбежавших не разобрано';
  const shards = report.shards.filter((s) => s.status !== 'ok').map((s) => `${s.shard}:${s.status}`).join(' ');
  return `${head}\n${escaped}\nшарды: ${shards || '—'}\n${issueUrl}`;
}

// #496: pathToFileURL, не `file://${argv}` — на Windows последнее давало
// `file:///C:/C:/...`, CLI считал себя импортированным и молчал.
const invokedDirectly = isMainModule(import.meta.url);
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const value = (name, fallback = '') => {
    const found = argv.find((item) => item.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3) : fallback;
  };
  const writeEvidence = value('write-evidence');
  const shardCount = Number(value('shards', '4'));
  if (writeEvidence) {
    const evidence = mutationShardEvidence({
      materialSha: value('sha'), materialTree: value('tree'), workflowSha: value('workflow-sha'),
      runId: value('run-id'), runAttempt: value('run-attempt'),
      shard: value('shard'), shardCount,
    });
    mkdirSync(dirname(writeEvidence), { recursive: true });
    writeFileSync(writeEvidence, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    console.log(`evidence=${writeEvidence}`);
  } else {
    const dir = value('logs', 'artifacts/mutation-logs');
    const expected = {
      materialSha: value('sha'), materialTree: value('tree'), workflowSha: value('workflow-sha'),
      runId: Number(value('run-id')), runAttempt: Number(value('run-attempt')), shardCount,
    };
    const requireEvidence = argv.includes('--require-evidence') || argv.includes('--verify-only');
    let logs = [];
    let evidenceErrors = [];
    if (requireEvidence) {
      const loaded = loadMutationShardArtifacts(dir, expected);
      logs = loaded.logs;
      evidenceErrors = loaded.errors;
      for (const error of evidenceErrors) console.error(`evidence: ${error}`);
      if (argv.includes('--verify-only')) {
        console.log(`verified=${loaded.ok}`);
        if (!loaded.ok) process.exitCode = 1;
      }
    } else {
      for (let shard = 1; shard <= shardCount; shard++) {
        const path = `${dir}/mutation-shard-${shard}/mutation-shard-${shard}.log`;
        logs.push({ shard, text: existsSync(path) ? readFileSync(path, 'utf8') : null });
      }
    }
    if (!argv.includes('--verify-only')) {
      const { MUTANTS } = await import('./mutation-gate.mjs');
      const guards = new Map(MUTANTS.map((m) => [m.id, m.guard]));
      const report = mutationGateReport({
        logs, guards, evidenceErrors,
        runUrl: value('run-url'), ref: value('ref', 'dev'), sha: value('sha'),
        date: value('date', new Date().toISOString().slice(0, 10)),
      });
      const bodyPath = value('body-out', 'artifacts/mutation-report.md');
      mkdirSync(dirname(bodyPath), { recursive: true });
      writeFileSync(bodyPath, report.body, 'utf8');
      const summaryPath = value('telegram-out', 'artifacts/mutation-telegram.txt');
      mkdirSync(dirname(summaryPath), { recursive: true });
      writeFileSync(summaryPath, telegramSummary(report, value('issue-url', '(issue)')), 'utf8');
      console.log(`title=${report.title}`);
      console.log(`marker=${REPORT_TITLE_MARKER}`);
      console.log(`body=${bodyPath}`);
      console.log(`escaped=${report.escaped.join(',')}`);
      console.log(`failed=${report.failed}`);
    }
  }
}
