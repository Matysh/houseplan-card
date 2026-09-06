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
 *
 * Наивный парсер «id — это слово после FAIL» сделал бы из второй формы
 * мутанта по имени «чистый», которого в реестре нет, и команда `--id=чистый`
 * в письме не сработала бы. Поэтому id обязан существовать в реестре; всё
 * остальное уходит в `unparsed` с текстом как есть — потерять строку нельзя,
 * но и выдумывать из неё сущность тоже.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const REPORT_TITLE_MARKER = '[mutation-gate] отказ прогона по расписанию';

const ESCAPED_LINE = /^FAIL (\S+): тест остался зелёным на сломанном коде\s*$/;
const RED_GUARD_LINE = /^FAIL чистый прогон: (.+?) красный без мутанта\s*$/;
const ANY_FAIL_LINE = /^FAIL /;

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
      unparsed.push({ shard, line });
    }
    shards.push({ shard, status: failed ? 'failed' : 'ok' });
  }
  return {
    escaped: [...escaped].sort(),
    redGuards: [...redGuards].sort(),
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
  const failed = parsed.shards.some((s) => s.status !== 'ok')
    || parsed.escaped.length > 0 || parsed.redGuards.length > 0 || parsed.unparsed.length > 0;
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

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const value = (name, fallback = '') => {
    const found = argv.find((item) => item.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3) : fallback;
  };
  const shardCount = Number(value('shards', '4'));
  const dir = value('logs', 'artifacts/mutation-logs');
  const logs = [];
  for (let shard = 1; shard <= shardCount; shard++) {
    const path = `${dir}/mutation-shard-${shard}/mutation-shard-${shard}.log`;
    logs.push({ shard, text: existsSync(path) ? readFileSync(path, 'utf8') : null });
  }
  const { MUTANTS } = await import('./mutation-gate.mjs');
  const guards = new Map(MUTANTS.map((m) => [m.id, m.guard]));
  const report = mutationGateReport({
    logs, guards,
    runUrl: value('run-url'), ref: value('ref', 'dev'), sha: value('sha'),
    date: value('date', new Date().toISOString().slice(0, 10)),
  });
  const bodyPath = value('body-out', 'artifacts/mutation-report.md');
  writeFileSync(bodyPath, report.body, 'utf8');
  const summaryPath = value('telegram-out', 'artifacts/mutation-telegram.txt');
  writeFileSync(summaryPath, telegramSummary(report, value('issue-url', '(issue)')), 'utf8');
  console.log(`title=${report.title}`);
  console.log(`marker=${REPORT_TITLE_MARKER}`);
  console.log(`body=${bodyPath}`);
  console.log(`escaped=${report.escaped.join(',')}`);
  console.log(`failed=${report.failed}`);
}
