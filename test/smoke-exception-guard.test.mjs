import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #404. Гард «uncaught exception внутри карточки» существовал с 2026-07-27 и не
// срабатывал ни разу: счётчик читался синхронно, а Playwright доставляет
// pageerror асинхронно. Поведение доказывается запуском проб —
// demo/guard/verify-guard.mjs в job со браузером. Здесь закреплено то, что
// запуском не проверить: порядок операций в исходнике, место проб и наличие
// вызова там, где он должен быть.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (rel) => readFileSync(new URL(rel, `file://${ROOT}`), 'utf8');

test('счётчик читается ПОСЛЕ доставки событий, а не до (#404)', () => {
  const serve = read('demo/serve.mjs');
  const flush = serve.indexOf('await roundTripLivePages();\n  if (_pageErrors)');
  assert.ok(flush > 0,
    'round-trip обязан стоять непосредственно перед чтением счётчика: обратный'
    + ' порядок и был дефектом #404');
  // Вторая половина правки: опрашивать нечего, если страницы не регистрируются.
  assert.match(serve, /const _livePages = new Set\(\)/);
  assert.match(serve, /export function watchPage\(page\)/);
  assert.match(serve, /_livePages\.add\(page\)/);
  assert.match(serve, /page\.on\('close', \(\) => _livePages\.delete\(page\)\)/,
    'закрытая страница обязана уходить из реестра');
  // Round-trip к закрытой странице бросает — и не имеет права ронять вердикт.
  assert.match(serve, /try \{ await page\.evaluate\(\(\) => 0\); \} catch/);
});

test('оба читателя счётчика ждут доставки (#404, #407)', () => {
  const serve = read('demo/serve.mjs');
  assert.match(serve, /export async function reportPageErrors\(\)\s*\{\s*await roundTripLivePages\(\);/,
    'вердикт для смоков со своей развязкой обязан ждать так же, как finish()');
});

test('пробы гарда лежат вне маски смоков и вне корпуса отпечатка (#404)', () => {
  const guard = readdirSync(new URL('demo/guard/', `file://${ROOT}`));
  assert.ok(guard.includes('verify-guard.mjs'));
  const probes = guard.filter((name) => name.startsWith('guard_'));
  assert.deepEqual(probes.sort(), [
    'guard_closed_page.mjs',
    'guard_report_page_errors.mjs',
    'guard_tail_exception.mjs',
    'guard_tail_rejection.mjs',
  ], 'четыре адресные пробы гарда обязаны оставаться обнаружимыми');

  // Маска demo/smoke_*.mjs — то, что гоняют шарды CI. Проба, попавшая туда,
  // покрасит шард по построению: она обязана падать.
  for (const name of probes) {
    assert.equal(name.startsWith('smoke_'), false, `${name} попала бы в шарды CI`);
  }

  // demo/fixtures/**/*.mjs входит в корпус sourceFingerprint: каждый файл там
  // объявляет устаревшими бандл, скриншот-индекс и golden-индекс. Пробы гарда
  // не касаются ни одного пикселя — платить за них пересъёмкой нечем.
  for (const name of probes.concat('verify-guard.mjs')) {
    assert.equal(existsSync(new URL(`demo/fixtures/${name}`, `file://${ROOT}`)), false,
      `${name} в demo/fixtures/ протухал бы отпечаток исходников`);
  }
});

test('пробы вызываются в job с браузером и служат guard мутантов (#404)', () => {
  const workflow = read('.github/workflows/validate.yml');
  const smoke = workflow.slice(workflow.indexOf('\n  smoke:\n'), workflow.indexOf('\n  smoke_done:\n'));
  assert.match(smoke, /node demo\/guard\/verify-guard\.mjs/,
    'проверка обязана идти там, где есть Chromium: в job «Фронтенд» npm test браузер не ставит,'
    + ' и тест на пробах молча скипался бы');
  assert.match(smoke, /if: matrix\.shard == 1/, 'один раз, а не в каждом шарде');

  const mutants = read('scripts/mutation-gate.mjs');
  // Правка #404 состоит из двух половин, и мутант на одну оставил бы другую
  // недоказанной. Список ведётся руками, и это осознанно: счётчик обязан
  // совпадать с ним, поэтому новый мутант на этих пробах нельзя добавить, не
  // назвав его здесь (в #430 так добавился четвёртый — гард page-benchmark).
  const guarded = [
    'smoke-guard-blind-to-tail',
    'smoke-guard-forgets-to-register-pages',
    'report-page-errors-skips-round-trip',
    'benchmark-page-verdict-unwatched',
  ];
  for (const id of guarded) {
    assert.match(mutants, new RegExp(`id: '${id}'`), `мутант ${id} не зарегистрирован`);
  }
  assert.equal(
    (mutants.match(/node demo\/guard\/verify-guard\.mjs/g) || []).length,
    guarded.length,
    'мутант на пробах гарда есть, а в списке выше его нет — список отстал от реестра',
  );
});

test('#434 smoke job and each smoke file have independent time bounds', () => {
  const workflow = read('.github/workflows/validate.yml');
  const smoke = workflow.slice(workflow.indexOf('\n  smoke:\n'), workflow.indexOf('\n  smoke_done:\n'));
  assert.match(smoke, /\n    timeout-minutes: 20\n/,
    'job smoke must not inherit the six-hour GitHub Actions default');
  assert.match(smoke, /timeout --kill-after=10s 180s node "\$f"/,
    'one hung file must be killed while the remaining shard files still run');
  assert.match(smoke, /if \[ "\$status" -eq 124 \]; then\s*\n\s*echo "diagnostic smoke-timeout:/,
    'a timeout needs a distinct diagnostic rather than a generic test failure');
});

test('страницы, созданные вне launch(), подписаны общим гардом (#404, Medium-1)', () => {
  // Ревью ТЗ нашло разрыв: smoke_zoom_flash открывал вторую страницу со своей
  // подпиской, печатавшей EXC2 мимо счётчика, а три страницы smoke_svg_sandbox
  // не имели слушателя вовсе. Регистрация в launchInternal их не покрывает.
  const zoom = read('demo/smoke_zoom_flash.mjs');
  assert.match(zoom, /watchPage\(await ctx\.newPage\(\)\)/);
  assert.equal(/p2\.on\('pageerror'/.test(zoom), false,
    'своя подписка мимо счётчика убрана (EXC2 остался только в объяснении)');

  const sandbox = read('demo/smoke_svg_sandbox.mjs');
  assert.equal((sandbox.match(/watchPage\(await ctx\.newPage\(\)\)/g) || []).length, 3);

  // Общий инвариант — не «никто не подписывается сам», а «ни одна страница не
  // создаётся мимо гарда». Своя подписка поверх гарда законна и полезна:
  // smoke_cold_view_toggle и smoke_cold_view_vacuum считают исключения ещё и
  // отдельным утверждением `noPageErrors`, а их страница приходит из
  // launchColdView, то есть уже зарегистрирована.
  const demo = fileURLToPath(new URL('demo/', `file://${ROOT}`));
  const smokes = readdirSync(demo)
    .filter((name) => name.startsWith('smoke_') && name.endsWith('.mjs'));
  const unwatched = [];
  for (const name of smokes) {
    const text = readFileSync(demo + name, 'utf8');
    const total = (text.match(/newPage\(\)/g) || []).length;
    const watched = (text.match(/watchPage\(await [\w.]+\.newPage\(\)\)/g) || []).length;
    if (total > watched) unwatched.push(name);
  }
  assert.deepEqual(unwatched, ['smoke_entry_stale.mjs'],
    'страница, созданная мимо watchPage, остаётся слепой зоной гарда.'
    + ' Единственное законное исключение — smoke_entry_stale: он намеренно'
    + ' поднимает свой браузер, ведёт свой счётчик исключений (он и есть'
    + ' предмет проверки #353) и выносит вердикт через finish()');

  // Свои подписки допускаются только поверх общего гарда: страница обязана
  // приходить из launch()/launchColdView(), иначе счётчик гарда её не видит.
  for (const name of smokes) {
    const text = readFileSync(demo + name, 'utf8');
    if (!/\.on\('pageerror'/.test(text) || name === 'smoke_entry_stale.mjs') continue;
    assert.match(text, /launch(ColdView)?[,}]|launch(ColdView)?\(/,
      `${name}: своя подписка на pageerror поверх страницы, которую гард не знает`);
  }
});
