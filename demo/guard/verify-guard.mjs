#!/usr/bin/env node
/**
 * Отрицательный прогон гарда исключений (#404).
 *
 * Гард объявлен в `demo/serve.mjs` с 2026-07-27 и до этой задачи не срабатывал
 * ни разу: счётчик читался раньше, чем Playwright доставлял `pageerror`. Такое
 * ловится только запуском — «проверка, которая не умеет падать» выглядит
 * идентично работающей во всём, кроме исхода.
 *
 * Почему не тест в `test/`: пробам нужен настоящий Chromium, а job «Фронтенд»,
 * где идёт `npm test`, браузеры не ставит. Тест там молча скипался бы — то есть
 * ровно тот тихий успех, против которого всё это и делается. Поэтому проверка
 * живёт в job «Смоки в браузере», где браузер есть, и вызывается один раз.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Каждая проба: чего ждём от кода возврата и что обязано быть в выводе.
 *
 * `args` — необязательные аргументы запуска; `file` может указывать и выше
 * этого каталога (`../benchmark_*.mjs`), потому что benchmark в `demo/guard/`
 * не переселить: его гоняют руками при рекалибровке порогов (#430).
 */
const PROBES = [
  {
    file: 'guard_tail_exception.mjs',
    expectExit: 1,
    expectOutput: /uncaught exception\(s\) inside the card/,
    because: 'исключение в хвосте — та самая слепая зона, из-за которой заводился #404',
  },
  {
    file: 'guard_tail_rejection.mjs',
    expectExit: 1,
    expectOutput: /uncaught exception\(s\) inside the card/,
    because: 'отклонение промиса приходит тем же каналом; на этом держится связь с #405',
  },
  {
    file: 'guard_closed_page.mjs',
    expectExit: 0,
    expectOutput: /OK/,
    because: 'round-trip к закрытой странице не имеет права ронять вердикт',
  },
  {
    // #430: до этой задачи гард benchmark доказывался тестом, который искал
    // в тексте те самые подстроки, которые сам же и вырезал у мутанта, —
    // доказано было, что регулярка не пуста. Режим `--guard-probe` в
    // benchmark существовал с #423 и не вызывался ни одним прогоном; теперь
    // вызывается здесь, в единственной job с настоящим браузером.
    file: '../benchmark_backdrop_decode.mjs',
    args: ['--guard-probe'],
    expectExit: 1,
    expectOutput: /uncaught exception\(s\) inside the card/,
    because: 'benchmark открывает страницу Playwright и обязан выносить тот же вердикт,'
      + ' что и смоки: исключение внутри карточки во время замера иначе не увидит никто',
  },
  {
    file: 'guard_report_page_errors.mjs',
    expectExit: 1,
    expectOutput: /uncaught exception\(s\) inside the card/,
    because: 'reportPageErrors() обязан сам дождаться хвостового pageerror, не полагаясь на finish()',
  },
];

let failed = 0;
for (const probe of PROBES) {
  const run = spawnSync(process.execPath, [resolve(HERE, probe.file), ...probe.args || []], {
    encoding: 'utf8', cwd: resolve(HERE, '../..'), timeout: 90_000,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const exitOk = run.status === probe.expectExit;
  const textOk = probe.expectOutput.test(output);
  if (exitOk && textOk) {
    console.log(`ok   ${[probe.file, ...probe.args || []].join(' ')} → exit ${run.status}`);
    continue;
  }
  failed += 1;
  console.error(`FAIL ${probe.file}: ${probe.because}`);
  console.error(`  ожидался exit ${probe.expectExit}, получен ${run.status}`);
  if (!textOk) console.error(`  в выводе нет ${probe.expectOutput}`);
  console.error(output.split('\n').slice(-12).map((line) => `  | ${line}`).join('\n'));
}

if (failed) {
  console.error(`\nгард исключений не доказан: проб провалено ${failed} из ${PROBES.length}`);
  process.exit(1);
}
console.log(`\nгард исключений доказан на ${PROBES.length} пробах`);
