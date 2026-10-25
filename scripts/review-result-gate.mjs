#!/usr/bin/env node
/**
 * Граница доверия между стадией модели и привилегированной публикацией (#556).
 *
 * `model_review` — единственная недоверенная стадия конвейера: там исполняется
 * чужой код с Read/Write и fixed-check runner. Всё, что она может передать дальше, — один
 * artifact. Публикация разбора, перестановка метки и слияние в `dev` идут в
 * другой job, на чистом checkout `dev`, и обязаны принимать этот artifact как
 * недоверенный ввод: полный набор файлов, сходящиеся контрольные суммы и
 * совпадение КАЖДОГО поля паспорта с тем, что посчитала детерминированная
 * стадия `prepare`. Подменённый, неполный, устаревший или чужой результат
 * отвергается fail-closed.
 *
 * Проверка вынесена из inline-shell в функцию именно ради враждебных фикстур:
 * в YAML её нельзя прогнать ни одним отрицательным случаем.
 *
 *   node scripts/review-result-gate.mjs --dir=<путь>   # поля ожидания из env
 */
import { createHash } from 'node:crypto';
import { reportProblems } from './review-execution-policy.mjs';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FINDINGS_FILE, findingsTextProblems, outsideFindingsProblems, readFindingsPolicy } from './review-findings-policy.mjs';

/** Ровно эти файлы и ни одного больше: лишний файл — это уже чужой artifact. */
export const REQUIRED_FILES = ['manifest.sha256', 'prepared.json', 'review-document.md', 'verdict.json'];
/** Паспорт материала. Каждое поле сверяется с outputs стадии `prepare`. */
export const PASSPORT_FIELDS = [
  'run_id', 'run_attempt', 'issue', 'stage', 'cycle', 'branch',
  'material_sha', 'material_tree', 'material_specs', 'material_issue_body',
  'validate_result', 'validate_url', 'rebase_note', 'validated_note',
  'spec_body_changed', 'spec_body_doc', 'spec_body_recorded',
  'findings_policy_snapshot',
];
export const VERDICTS = ['green', 'yellow', 'red'];
/**
 * Маршрут вердикта (#726): `fix` — вернуть автору по находкам; `reclassify` —
 * трек `show` выбран неверно, задача не проходит критерий §5. Смысл
 * `criterion` судит `reviewRoute` (`process-track.mjs`), а не граница.
 */
export const ROUTES = ['fix', 'reclassify'];

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Only trusted successful model-job outputs may identify a retained same-run artifact. */
export function reviewProducerIdentity({ run, attempt, producerRun, producerAttempt, producerManifest, manifest, producerResult }) {
  const supplied = [producerRun, producerAttempt, producerManifest, producerResult].some(v => v !== undefined && v !== '');
  if (!supplied) return { run_id: String(run ?? ''), run_attempt: String(attempt ?? '') };
  const valid = value => /^[1-9]\d{0,15}$/.test(String(value)) && Number.isSafeInteger(Number(value));
  if (producerResult !== 'success' || !valid(run) || String(producerRun) !== String(run)
    || !valid(attempt) || !valid(producerAttempt)
    || Number(producerAttempt) > Number(attempt) || !/^[a-f0-9]{64}$/.test(producerManifest || '')
    || producerManifest !== sha256(manifest)) throw new Error('retained review producer identity is missing, foreign or inconsistent');
  return { run_id: String(producerRun), run_attempt: String(producerAttempt) };
}

/**
 * Маршрут структурного вердикта: поля нет (вердикты до #726, модель его не
 * заполнила) — `fix`, прежний путь; значение вне словаря — `null`.
 */
export function verdictRoute(verdict) {
  if (verdict?.route == null) return 'fix';
  return ROUTES.includes(verdict.route) ? verdict.route : null;
}

/** Причины отказа самого `verdict.json`; пустой массив — вердикт цел. */
export function verdictProblems(verdict, findingsPolicy) {
  const problems = [];
  if (!VERDICTS.includes(verdict?.verdict)) problems.push(`verdict вне словаря: ${JSON.stringify(verdict?.verdict)}`);
  if (typeof verdict?.high !== 'number') problems.push('verdict.high не число');
  if (typeof verdict?.medium !== 'number') problems.push('verdict.medium не число');
  if (typeof verdict?.summary !== 'string') problems.push('verdict.summary не строка');
  const route = verdictRoute(verdict);
  if (route === null) {
    problems.push(`route вне словаря: ${JSON.stringify(verdict?.route)}`);
  } else if (route === 'reclassify' && verdict?.verdict === 'green') {
    // Противоречивый результат: «вперёд» и «трек неверен» сразу. Fail-closed,
    // молчаливый green здесь хуже остановки (#726, порядок владельца #707).
    problems.push('reclassify при зелёном вердикте — результат противоречив');
  }
  problems.push(...outsideFindingsProblems(verdict?.outside_findings, findingsPolicy));
  for (const finding of Array.isArray(verdict?.outside_findings) ? verdict.outside_findings : [])
    problems.push(...reportProblems(finding?.body || ''));
  return problems;
}

/** Разбор строки `sha256sum`: «<hex>  <имя>». */
export function parseManifest(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64})\s[\s*](.+)$/.exec(line);
    if (!match) return null;
    rows.push({ hash: match[1], name: match[2].trim() });
  }
  return rows;
}

/**
 * @param {object} p
 * @param {string[]} p.files   имена файлов в каталоге artifact
 * @param {(name:string)=>string} p.read  содержимое файла
 * @param {Record<string,string>} p.expected  паспорт, посчитанный `prepare`
 * @returns {string[]} причины отказа; пустой массив — принять
 */
export function reviewResultProblems({ files, read, expected }) {
  const problems = [];
  let policy;
  try {
    // In-flight pre-#926 workflow has no trusted output: retain only its old
    // four-file issues protocol. It can never authorize a companion/path.
    policy = expected.findings_policy_snapshot ? readFindingsPolicy(expected.findings_policy_snapshot, {
      repo: expected.repo, issue: Number(expected.issue), stage: expected.stage, round: Number(expected.cycle),
    }) : { mode: 'issues' };
  } catch (error) { return [`доверенная политика находок: ${error.message}`]; }
  const required = [...REQUIRED_FILES, ...(policy.mode === 'file' ? [FINDINGS_FILE] : [])];
  const actual = [...files].sort();
  const wanted = [...required].sort();
  if (actual.join(',') !== wanted.join(',')) {
    return [`набор файлов не тот: ожидалось ${wanted.join(', ')}, получено ${actual.join(', ') || '(пусто)'}`];
  }

  const manifest = parseManifest(read('manifest.sha256'));
  if (!manifest) return ['manifest.sha256 не разобран'];
  const covered = manifest.map((row) => row.name).sort();
  const mustCover = required.filter((name) => name !== 'manifest.sha256').sort();
  if (covered.join(',') !== mustCover.join(',')) {
    problems.push(`manifest покрывает не те файлы: ${covered.join(', ') || '(пусто)'}`);
  }
  for (const row of manifest) {
    if (!required.includes(row.name)) continue;
    const digest = sha256(read(row.name));
    if (digest !== row.hash) problems.push(`контрольная сумма не сходится: ${row.name}`);
  }

  if (!String(read('review-document.md')).trim()) problems.push('документ ревью пуст');
  problems.push(...reportProblems(read('review-document.md')));
  if (policy.mode === 'file') problems.push(...findingsTextProblems(read(FINDINGS_FILE)));

  let prepared;
  try {
    prepared = JSON.parse(read('prepared.json'));
  } catch (error) {
    return [...problems, `prepared.json не разобран: ${error.message}`];
  }
  if (prepared?.schema !== 1) problems.push('prepared.json: не та схема');
  for (const field of PASSPORT_FIELDS) {
    const want = expected[field] ?? '';
    const got = prepared?.[field] ?? '';
    if (String(got) !== String(want)) {
      problems.push(`паспорт не совпал: ${field} = «${got}», ожидалось «${want}»`);
    }
  }

  let verdict;
  try {
    verdict = JSON.parse(read('verdict.json'));
  } catch (error) {
    return [...problems, `verdict.json не разобран: ${error.message}`];
  }
  return [...problems, ...verdictProblems(verdict, policy), ...reportProblems(verdict?.summary)];
}

/** Ship/release publication retries bind only to trusted outputs of their successful model job. */
export function batchReviewResultProblems({ kind, files, read, expected, consumer, producer }) {
  if (!['ship', 'release'].includes(kind)) return ['unknown batch review kind'];
  if (producer?.producerResult !== 'success') return ['batch review has no successful trusted producer'];
  const report = `${kind}-review.md`, required = ['manifest.sha256', 'producer.json', 'result.json', report];
  if ([...files].sort().join(',') !== required.sort().join(',')) return ['batch review artifact file set differs'];
  try {
    const identity = reviewProducerIdentity({ ...consumer, ...producer, manifest: read('manifest.sha256') });
    const sealed = JSON.parse(read('producer.json'));
    const want = { schema: 1, kind, ...expected, ...identity };
    if (Object.keys(sealed).sort().join(',') !== Object.keys(want).sort().join(',')
      || Object.keys(want).some(key => sealed[key] !== want[key])) return ['batch review producer passport differs'];
    if (!/^[a-f0-9]{40}$/.test(want.candidate || '') || !/^[a-f0-9]{64}$/.test(want.input_manifest || ''))
      return ['batch review trusted material/input identity missing'];
    const manifest = parseManifest(read('manifest.sha256'));
    const payloads = required.filter(name => name !== 'manifest.sha256').sort();
    if (!manifest || manifest.map(row => row.name).sort().join(',') !== payloads.join(',')
      || manifest.some(row => row.hash !== sha256(read(row.name)))) return ['batch review manifest differs'];
    const result = JSON.parse(read('result.json'));
    if (!['high', 'medium', 'low'].every(key => typeof result[key] === 'number') || typeof result.summary !== 'string'
      || !String(read(report)).trim()) return ['batch review result/report incomplete'];
    return [...reportProblems(read(report)), ...reportProblems(result.summary)];
  } catch { return ['batch review producer or artifact is invalid']; }
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const dir = process.argv.find((a) => a.startsWith('--dir='))?.slice(6);
  if (!dir) { console.error('usage: review-result-gate.mjs --dir=<путь>'); process.exit(2); }
  const batch = process.argv.find(a => a.startsWith('--batch='))?.slice(8);
  if (batch) {
    const problems = batchReviewResultProblems({ kind: batch,
      files: readdirSync(dir, { withFileTypes: true }).map(e => e.name), read: name => readFileSync(resolve(dir, name), 'utf8'),
      expected: { repo: process.env.REPO, candidate: process.env.CANDIDATE, base: process.env.BASE || '',
        document: process.env.DOC, input_manifest: process.env.INPUT_MANIFEST },
      consumer: { run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT },
      producer: { producerRun: process.env.REVIEW_PRODUCER_RUN_ID, producerAttempt: process.env.REVIEW_PRODUCER_ATTEMPT,
        producerManifest: process.env.REVIEW_PRODUCER_MANIFEST, producerResult: process.env.REVIEW_PRODUCER_RESULT } });
    if (problems.length) { console.error(problems.join('; ')); process.exit(1); }
    console.log('batch review producer and exact artifact verified'); process.exit(0);
  }
  const env = (name) => process.env[name.toUpperCase()] ?? '';
  const expected = Object.fromEntries(PASSPORT_FIELDS.map((field) => [field, env(field)]));
  try {
    Object.assign(expected, reviewProducerIdentity({ run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
      producerRun: process.env.REVIEW_PRODUCER_RUN_ID, producerAttempt: process.env.REVIEW_PRODUCER_ATTEMPT,
      producerManifest: process.env.REVIEW_PRODUCER_MANIFEST, producerResult: process.env.REVIEW_PRODUCER_RESULT,
      manifest: readFileSync(resolve(dir, 'manifest.sha256')) }));
  } catch (error) { console.error(`::error::${error.message}`); process.exit(1); }
  expected.repo = process.env.REPO ?? '';
  const problems = reviewResultProblems({
    files: readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name),
    read: (name) => readFileSync(resolve(dir, name), 'utf8'),
    expected,
  });
  if (problems.length) {
    for (const problem of problems) console.error(`::error::результат модели отвергнут — ${problem}`);
    process.exit(1);
  }
  if (process.env.REVIEW_VERIFIED_OUTPUT)
    writeFileSync(process.env.REVIEW_VERIFIED_OUTPUT, JSON.stringify(expected) + '\n', { flag: 'wx' });
  console.log('результат модели полон, суммы сходятся, паспорт совпал');
}
