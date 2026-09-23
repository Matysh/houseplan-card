#!/usr/bin/env node
/**
 * Гейт «мёртвый код и связность монолита» (#624): `npm run lint:unused`.
 *
 *   node scripts/unused-locals-gate.mjs            # проверить против базы
 *   node scripts/unused-locals-gate.mjs --update   # записать текущие числа в базу
 *   node scripts/unused-locals-gate.mjs --json     # числа и разбор в JSON
 *
 * Две проверки, оба ответа — в одном прогоне:
 *
 * 1. `tsc --noUnusedLocals` по всему проекту чист, кроме приватных членов
 *    карточки, которых карточка не читает, но читает рантайм через порт
 *    (`portPrivates`) или зовут браузерные смоки (`harnessPrivates`). Любая
 *    другая диагностика — неиспользуемый импорт, мёртвая константа, локальная
 *    переменная, приватный член вне порта и харнесса — красный: это код,
 *    который компилятор доказал мёртвым.
 *
 * 2. Храповик: шесть чисел `scripts/monolith-metrics.mjs` не растут
 *    относительно `scripts/monolith-baseline.json` (`bundleBytes` — с полосой
 *    ±2 000 Б, как gzip-потолок #438; остальные — точно). Снижение — не ошибка, но
 *    база обязана быть опущена тем же коммитом (`--update`): незафиксированный
 *    выигрыш монолит отыграет обратно первой же правкой. Рост допускается
 *    только с явной записью в issue задачи и правкой базы в том же коммите —
 *    гейт печатает, какое число и на сколько.
 *
 * `bundleBytes` требует собранного `dist/`: гейт стоит после `npm run build`
 * (в `gate:small` и в job `frontend` Validate). Без сборки число не судится,
 * и гейт говорит об этом явно, а не молчит зелёным.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import {
  BASELINE_FILE, METRIC_NAMES, collectMetrics, compareWithBaseline, formatMetrics, readBaseline,
} from './monolith-metrics.mjs';

/**
 * Чистое решение гейта: код выхода и строки отчёта по замеру и базе.
 * `violations` — диагностики вне разрешённых; `grown` — выросшие числа.
 */
export function decide({ metrics, violations, baseline }) {
  const lines = [];
  let fail = false;
  lines.push(`monolith: ${formatMetrics(metrics)}`);
  if (violations.length) {
    fail = true;
    lines.push(`FAIL мёртвый код — ${violations.length} диагностик(и) noUnusedLocals вне порта и харнесса:`);
    for (const v of violations.slice(0, 40)) lines.push(`  ${v.file}:${v.line} TS${v.code} ${v.message}`);
    if (violations.length > 40) lines.push(`  … ещё ${violations.length - 40}`);
  } else {
    lines.push('ok   мёртвого кода нет: единственные непрочитанные члены — порт и харнесс');
  }
  if (!baseline) {
    fail = true;
    lines.push(`FAIL базы ${BASELINE_FILE} нет — создать: node scripts/unused-locals-gate.mjs --update`);
    return { fail, lines, grown: [], shrunk: [] };
  }
  const { grown, shrunk } = compareWithBaseline(metrics, baseline);
  if (grown.length) {
    fail = true;
    for (const g of grown) {
      lines.push(`FAIL связность выросла: ${g.name} ${g.base ?? 'нет в базе'} → ${g.now}`
        + ' — вернуть или обосновать в issue и поднять базу тем же коммитом');
    }
  }
  if (shrunk.length) {
    // Снижение без записи в базу — тоже отказ: храповик работает в обе стороны.
    fail = true;
    for (const s of shrunk) lines.push(`FAIL связность упала, база не опущена: ${s.name} ${s.base} → ${s.now} — node scripts/unused-locals-gate.mjs --update`);
  }
  if (!grown.length && !shrunk.length) lines.push('ok   все числа равны базе');
  if (metrics.bundleBytes == null) {
    fail = true;
    lines.push('FAIL dist/ не собран — bundleBytes не судится; сначала npm run build');
  }
  return { fail, lines, grown, shrunk };
}

export function baselineFrom(metrics) {
  const out = {};
  for (const name of METRIC_NAMES) out[name] = metrics[name];
  return out;
}

if (isMainModule(import.meta.url)) {
  const root = process.cwd();
  const update = process.argv.includes('--update');
  const json = process.argv.includes('--json');
  const result = collectMetrics(root);
  if (update) {
    if (result.metrics.bundleBytes == null) {
      console.error('dist/ не собран — база без bundleBytes была бы ложью; сначала npm run build');
      process.exit(1);
    }
    writeFileSync(resolve(root, BASELINE_FILE), `${JSON.stringify(baselineFrom(result.metrics), null, 2)}\n`);
    console.log(`${BASELINE_FILE} записан: ${formatMetrics(result.metrics)}`);
  }
  const baseline = readBaseline(root);
  const decision = decide({ metrics: result.metrics, violations: result.violations, baseline });
  if (json) {
    console.log(JSON.stringify({ metrics: result.metrics, allowed: result.allowed, violations: result.violations, ...decision }, null, 2));
  } else {
    for (const line of decision.lines) console.log(line);
  }
  process.exit(decision.fail && !update ? 1 : 0);
}
