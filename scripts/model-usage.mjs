#!/usr/bin/env node
/**
 * Расход модели одной машинной строкой (#737, PROCESS.md §10.4).
 *
 *   node scripts/model-usage.mjs --execution-file=<путь>
 *
 * Шаг `Review` (`claude-code-action`) отдаёт выход `execution_file` — JSON-массив
 * всех сообщений сессии SDK, он пишется и при ошибке SDK. Журнал Actions
 * расхода не покажет: action сознательно печатает результат урезанным
 * («without exposing token usage or cost details»). Других следов расхода у
 * конвейера нет, а без них у отчёта «Метрики процесса» нет третьей оси
 * «качество → скорость → токены» (#707, #728).
 *
 * Здесь — единственное место, которое собирает и разбирает строку (у
 * публикации и отчёта копии формата нет):
 *
 *   <!-- hp:usage input_tokens=N output_tokens=N cache_creation_input_tokens=N cache_read_input_tokens=N num_turns=N -->
 *   <!-- hp:usage-none reason=<код> -->
 *
 * Ровно пять ключей в этом порядке, N — десятичное целое без знака и без
 * ведущих нулей, не длиннее 12 цифр. Формат замораживается первой публикацией:
 * документы ревью задним числом не правят. Поэтому ключи — имена SDK без
 * перевода, а «нет данных» — отдельный маркер, а не отсутствие строки: иначе
 * «конвейер не смог» не отличить от «документа до #737». Предварительный
 * читатель #728 строку данных читает, а `hp:usage-none` — нет: после
 * `hp:usage` ему нужен пробел. В строке нет SHA и хешей: блок якорей кода
 * считает якорем каждые 40 hex-символов (`materialAnchorsFrom`).
 *
 * Из файла берётся только последнее сообщение `type: "result"`. Остальное в
 * нём — результаты инструментов, то есть возможные секреты, и ни одна их
 * буква не печатается: даже сообщение об ошибке JSON.parse цитирует текст,
 * поэтому причины здесь — коды, а не тексты ошибок. Скрипт не падает на
 * данных: любой исход — строка, код выхода 0.
 */
import { readFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';

/** Ключи строки данных — в порядке строки. */
export const USAGE_KEYS = Object.freeze([
  'input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'num_turns',
]);

/** Токены — поля `modelUsage[<модель>]` SDK (camelCase) и `result.usage` (snake_case). */
const MODEL_USAGE_FIELDS = Object.freeze({
  input_tokens: 'inputTokens',
  output_tokens: 'outputTokens',
  cache_creation_input_tokens: 'cacheCreationInputTokens',
  cache_read_input_tokens: 'cacheReadInputTokens',
});

/**
 * Причины «нет данных». Первые четыре — снятие из `execution_file`, две
 * последние — публикация: строки от стадии модели нет (`missing`) или она
 * пришла не по формату (`invalid`).
 */
export const USAGE_REASONS = Object.freeze([
  'no-execution-file', 'unreadable', 'no-result', 'no-usage', 'missing', 'invalid',
]);

/** Наибольшее значение, которое помещается в 12 цифр. */
const MAX_COUNT = 999_999_999_999;
const COUNT = '(0|[1-9]\\d{0,11})';
const DATA_RE = new RegExp(`^<!-- hp:usage ${USAGE_KEYS.map((key) => `${key}=${COUNT}`).join(' ')} -->$`);
const NONE_RE = new RegExp(`^<!-- hp:usage-none reason=(${USAGE_REASONS.join('|')}) -->$`);

const isCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNT;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Строка из разобранного вида: `{ input_tokens, …, num_turns }` либо
 * `{ reason }`. Обратна `parseUsageLine`. Вход не по контракту — исключение:
 * это ошибка вызывающего кода, не данных.
 */
export function formatUsage(usage) {
  if (isRecord(usage) && 'reason' in usage) {
    if (!USAGE_REASONS.includes(usage.reason)) throw new TypeError(`model-usage: неизвестная причина ${JSON.stringify(usage.reason)}`);
    return `<!-- hp:usage-none reason=${usage.reason} -->`;
  }
  if (!isRecord(usage) || !USAGE_KEYS.every((key) => isCount(usage[key]))) {
    throw new TypeError('model-usage: расход не по формату');
  }
  return `<!-- hp:usage ${USAGE_KEYS.map((key) => `${key}=${usage[key]}`).join(' ')} -->`;
}

/**
 * Строгий разбор одной строки: `{ input_tokens, …, num_turns }`,
 * `{ reason }` или `null` (не по формату). Пробелы по краям, лишний или
 * пропущенный ключ, другой порядок, знак, дробь, ведущий ноль, 13 цифр,
 * перевод строки внутри — `null`.
 */
export function parseUsageLine(line) {
  const text = String(line ?? '');
  const data = DATA_RE.exec(text);
  if (data) return Object.fromEntries(USAGE_KEYS.map((key, index) => [key, Number(data[index + 1])]));
  const none = NONE_RE.exec(text);
  return none ? { reason: none[1] } : null;
}

/**
 * Строка для документа ревью из недоверенного выхода стадии модели (#556):
 * пусто — `missing`, не по формату — `invalid`, иначе та же строка.
 */
export function publishedUsageLine(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return formatUsage({ reason: 'missing' });
  return formatUsage(parseUsageLine(text) ?? { reason: 'invalid' });
}

/** Последняя строка формата в тексте машинного блока, разобранная, либо `null`. */
export function lastUsageIn(text) {
  let found = null;
  for (const line of String(text ?? '').split('\n')) {
    const parsed = parseUsageLine(line.trim());
    if (parsed) found = parsed;
  }
  return found;
}

/**
 * Расход из сообщений сессии SDK: сумма по всем моделям `modelUsage`
 * последнего `result` (лимит подписки тратят и вспомогательные модели); без
 * `modelUsage` — те же ключи из `result.usage`. Значение не целое ≥ 0 — это
 * не данные (`unreadable`), а не ноль.
 */
export function usageFromMessages(messages) {
  if (!Array.isArray(messages)) return { reason: 'unreadable' };
  const result = messages.findLast((message) => isRecord(message) && message.type === 'result');
  if (!result) return { reason: 'no-result' };
  const models = isRecord(result.modelUsage) ? Object.values(result.modelUsage) : [];
  const usage = {};
  if (models.length) {
    for (const [key, field] of Object.entries(MODEL_USAGE_FIELDS)) {
      usage[key] = 0;
      for (const model of models) {
        const value = isRecord(model) ? model[field] : undefined;
        if (!isCount(value)) return { reason: 'unreadable' };
        usage[key] += value;
      }
    }
  } else if (isRecord(result.usage)) {
    for (const key of Object.keys(MODEL_USAGE_FIELDS)) usage[key] = result.usage[key];
  } else {
    return { reason: 'no-usage' };
  }
  usage.num_turns = result.num_turns;
  return USAGE_KEYS.every((key) => isCount(usage[key])) ? usage : { reason: 'unreadable' };
}

/** Расход из файла `execution_file`; файла нет или путь пуст — `no-execution-file`. */
export function usageFromExecutionFile(path, read = (file) => readFileSync(file, 'utf8')) {
  if (!String(path ?? '').trim()) return { reason: 'no-execution-file' };
  let text;
  try {
    text = read(path);
  } catch (error) {
    return { reason: error?.code === 'ENOENT' ? 'no-execution-file' : 'unreadable' };
  }
  let messages;
  try {
    messages = JSON.parse(text);
  } catch {
    return { reason: 'unreadable' };
  }
  return usageFromMessages(messages);
}

if (isMainModule(import.meta.url)) {
  const flag = process.argv.slice(2).find((item) => item.startsWith('--execution-file='));
  let line;
  try {
    line = formatUsage(usageFromExecutionFile(flag ? flag.slice('--execution-file='.length) : ''));
  } catch {
    line = formatUsage({ reason: 'unreadable' });
  }
  process.stdout.write(`${line}\n`);
}
