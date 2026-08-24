// Обход последовательностей правок: инварианты после каждого жеста (#297).
//
// Зачем это отдельно от всех прежних гейтов. Решётка и шум (#283), непрерывность
// кладки (#285/#286), смешанные роли (#287), ключи стен (#259), аудит ручек
// (#292) — каждый берёт ГОТОВЫЙ план и что-то в нём измеряет. А дефекты
// геометрии рождаются не в хранении, а в РЕДАКТИРОВАНИИ: #289 (ресайз наружного
// ребра создал запись со смешанной ролью), #290, #296 (после удаления комнаты
// остались перегородка поверх стены и черновик из двух точек, и обе ручки
// ресайза выключились). Ни один снимок этого не показывает: такая геометрия
// ничего не портит в модели, она портит следующий жест.
//
// Поэтому здесь план не проверяется, а РАСШАТЫВАЕТСЯ: продуктовыми жестами, в
// продуктовом карте, по детерминированному семени, с проверкой инвариантов
// после каждого шага. Второе представление редактора при этом не появляется —
// жесты идут через `_rszEdgeDown/_rszMove/_rszUp` и `_confirmRoomDelete`, то
// есть через тот самый код, который выполняется у пользователя.
//
// Найденное нарушение печатается вместе с семенем и полной цепочкой жестов,
// поэтому воспроизводится одной командой:
//   node demo/smoke_edit_walk.mjs --seed 7 --plan real-plan-second-floor.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';

// `model-invariants.mjs` и оптимизатор — скомпилированный продуктовый код, а не
// вторая модель. Значит смок обязан собрать тот же `test-build`, который делает
// `npm test`: на чистом Linux CI этого каталога нет, и опора на оставшийся от
// разработчика падает до запуска браузера. Ровно эту ошибку уже проходил
// `smoke_lattice_write_barrier.mjs` — здесь она повторена по той же причине.
const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, [
  resolve(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.test.json',
], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [resolve(root, 'scripts/fix-test-build.mjs')], {
  cwd: root, stdio: 'inherit',
});
const { optimizePlans } = await import('../test-build/plan-optimizer.js');
const {
  checkHiddenObstacles, checkMixedRoleRecords, checkWallKeys, checkReferences,
  checkPhysicalGeometry, latticeProfile, readModel,
} = await import('../scripts/model-invariants.mjs');

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

/**
 * Известный долг фикстур, а не «должно быть ноль».
 *
 * `real-plan-second-floor.json` содержит перегородку `partition-mt2on9ou-0`,
 * лежащую на наружной стене трёх комнат: это живой дефект из плана владельца,
 * предмет #296. Обход обязан замечать НОВЫЕ нарушения, а не падать на старом —
 * иначе он не заработает до починки #296 и никого не защитит в промежутке.
 * Когда #296 закроется, число здесь станет нулём, и тест это потребует.
 */
const PLANS = [
  { file: 'real-plan-second-floor.json', debt: 1 },
  { file: 'real-plan-first-floor.json', debt: 0 },
];

/**
 * Что обход находит СЕГОДНЯ. Не «допустимо», а «заведено и ждёт починки».
 *
 * Таблица работает в обе стороны: обход падает и когда находок стало больше, и
 * когда стало меньше. Второе — не придирчивость. Молча позеленевший гейт не
 * сообщает о починке, и долг перестаёт быть виден; ровно так исчез из вида
 * `partition-mt2on9ou-0`, проживший в плане владельца от беты 9 до rc.1.
 * Починили — обновить строку в этой таблице тем же коммитом.
 */
const KNOWN = {
  // #298 убрал producer off-grid/wall-carrier на первом Resize. Обход теперь
  // доходит до независимого долга удаления комнаты/смешанной роли #299 и
  // существующей скрытой перегородки #296; эти строки не выдают его за норму,
  // а держат следующий заведённый дефект видимым до его собственного фикса.
  'real-plan-second-floor.json:1': {
    step: 9, kinds: ['mixed_role_record'],
  },
  'real-plan-second-floor.json:2': {
    step: 1, kinds: ['mixed_role_record'],
  },
  'real-plan-second-floor.json:3': {
    step: 1, kinds: ['mixed_role_record'],
  },
  // На первом этаже оставшиеся mixed-role записи также рождаются Optimize или
  // удалением комнаты с сохранением стен, а не fixed-topology Resize #298.
  'real-plan-first-floor.json:1': { step: 1, kinds: ['mixed_role_record'] },
  'real-plan-first-floor.json:2': { step: 3, kinds: ['mixed_role_record'] },
  'real-plan-first-floor.json:3': { step: 1, kinds: ['mixed_role_record'] },
};
const STEPS = Number(arg('--steps', 24));
const SEEDS = arg('--seed') ? [Number(arg('--seed'))] : [1, 2, 3];

/** mulberry32: короткий, воспроизводимый, без зависимостей. */
const rng = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const configOf = (file) => readModel(readFileSync(
  new URL(`../test/fixtures/${file}`, import.meta.url), 'utf8',
));

/**
 * Полный набор инвариантов по одному конфигу. Судит node, не страница.
 *
 * Про решётку судится ТОЛЬКО «вне сетки», а подшаговый шум остаётся
 * наблюдением. Причина измерена, а не выбрана: координата пишется девятью
 * знаками после запятой, и `304/240 = 1.2666666666…` в этой записи становится
 * `1.266666667` — отклонение 8e-8 шага. Такой шум неустраним никаким исправлением
 * жеста, он свойство формата хранения и уйдёт на этапе 1 ADR #282. Гейт,
 * падающий на неустранимом, отключат в первую неделю.
 */
const inspect = (config, layout = {}) => {
  const notes = [];
  const lattice = latticeProfile({ config, layout });
  return {
    violations: [
      ...checkReferences({ config, layout }, { notes }),
      ...checkHiddenObstacles(config),
      ...checkMixedRoleRecords(config),
      ...checkWallKeys(config, { notes }),
      ...checkPhysicalGeometry(config),
    ],
    noise: lattice.noise,
    offGrid: lattice.offGrid,
  };
};

/** Виды нарушений, которых стало больше, чем было в исходной фикстуре. */
const countKinds = (violations) => {
  const counts = new Map();
  for (const violation of violations) {
    counts.set(violation.kind, (counts.get(violation.kind) || 0) + 1);
  }
  return counts;
};

const beyondBaseline = (violations, baseline) => {
  const now = countKinds(violations);
  return [...now]
    .filter(([kind, count]) => count > (baseline.get(kind) || 0))
    .map(([kind]) => kind)
    .sort();
};

const { page, browser } = await launch();
const out = {};
const failures = [];

/** Установить конфиг в карту и включить разметку с инструментом ресайза. */
const install = (config) => page.evaluate(async (config) => {
  const card = window.__card;
  card._serverCfg = JSON.parse(JSON.stringify(config));
  card._cfgEpoch = (card._cfgEpoch || 0) + 1;
  card._modelCache = null;
  card._space = config.spaces[0].id;
  card._setMode?.('plan');
  card._markup = true;
  card._tool = 'resize';
  card.requestUpdate();
  await card.updateComplete;
  card._fitAll?.();
  card.requestUpdate();
  await card.updateComplete;
  return true;
}, config);

/** Перечислить ручки ресайза так, как их видит рендер слоя. */
const handles = () => page.evaluate(() => {
  const card = window.__card;
  const snap = card._rszSnapshot();
  const rooms = card._rszRooms();
  const list = [];
  for (const room of rooms) {
    for (let edge = 0; edge < room.poly.length; edge++) {
      const a = room.poly[edge], b = room.poly[(edge + 1) % room.poly.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < card._gridPitch) continue;
      const resolution = card._rszResolution(room.id, edge, snap);
      list.push({
        roomId: room.id, edge, enabled: !!resolution.enabled,
        reason: resolution.enabled ? null : resolution.reason,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      });
    }
  }
  return list;
});

/**
 * Перетащить ручку на `steps` шагов решётки.
 *
 * Смещение задаётся в клиентских координатах, поэтому масштаб «клиент → SVG»
 * измеряется у самой карты: подставлять свои цифры значило бы завести второе
 * представление её геометрии.
 */
const dragHandle = (roomId, edge, mid, steps) => page.evaluate(
  async ({ roomId, edge, mid, steps }) => {
    const card = window.__card;
    const at = (x, y) => card._svgPoint({ clientX: x, clientY: y });
    const origin = at(0, 0), unitX = at(100, 0), unitY = at(0, 100);
    const perClientX = (unitX[0] - origin[0]) / 100;
    const perClientY = (unitY[1] - origin[1]) / 100;
    if (!(Math.abs(perClientX) > 1e-9) || !(Math.abs(perClientY) > 1e-9)) return 'нет масштаба';
    // Клиентская точка, попадающая в середину ребра.
    const clientX = (mid[0] - origin[0]) / perClientX;
    const clientY = (mid[1] - origin[1]) / perClientY;
    const ev = (x, y) => ({
      pointerId: 77, clientX: x, clientY: y,
      target: card._stageEl, preventDefault() {}, stopPropagation() {},
    });
    card._rszEdgeDown(ev(clientX, clientY), roomId, edge);
    if (!card._rszDrag) return 'жест не начался';
    const plan = card._rszDrag.plan;
    const shift = card._gridPitch * steps;
    const dx = plan.n[0] * shift / perClientX;
    const dy = plan.n[1] * shift / perClientY;
    card._rszMove(ev(clientX + dx, clientY + dy));
    const moved = !!card._rszDrag?.moved;
    card._rszUp(ev(clientX + dx, clientY + dy));
    card.requestUpdate();
    await card.updateComplete;
    return moved ? null : 'предпросмотр не сдвинулся';
  }, { roomId, edge, mid, steps },
);

/** Удалить комнату с сохранением стен — путь, который и родил #296. */
const deleteRoom = (roomId) => page.evaluate(async (roomId) => {
  const card = window.__card;
  card._roomDeleteDialog = { roomId, name: roomId };
  card._confirmRoomDelete(true);
  card.requestUpdate();
  await card.updateComplete;
  return null;
}, roomId);

const currentConfig = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__card._serverCfg)));

for (const plan of PLANS) {
  const source = configOf(plan.file);
  for (const seed of SEEDS) {
    const random = rng(seed);
    const trace = [];
    let config = JSON.parse(JSON.stringify(source.config));
    let broke = null;
    const baseline = inspect(config);
    baseline.counts = countKinds(baseline.violations);
    if (baseline.violations.length !== plan.debt) {
      failures.push({
        plan: plan.file, seed, step: -1,
        action: `объявленный долг фикстуры ${plan.debt}`
          + `, фактический ${baseline.violations.length}`,
        violations: baseline.violations, trace: [],
      });
      out[`debt_${plan.file.replace(/[^a-z0-9]+/gi, '_')}`] = false;
      continue;
    }
    await install(config);
    for (let step = 0; step < STEPS && !broke; step++) {
      const list = await handles();
      const enabled = list.filter((handle) => handle.enabled);
      const roll = random();
      let action = null;
      if (roll < 0.75 && enabled.length) {
        const handle = enabled[Math.floor(random() * enabled.length)];
        const steps = (random() < 0.5 ? -1 : 1) * (1 + Math.floor(random() * 4));
        const note = await dragHandle(handle.roomId, handle.edge, handle.mid, steps);
        action = `ресайз ${handle.roomId}#${handle.edge} на ${steps}${note ? ` (${note})` : ''}`;
      } else if (roll < 0.9) {
        const rooms = [...new Set(list.map((handle) => handle.roomId))];
        if (!rooms.length) continue;
        const roomId = rooms[Math.floor(random() * rooms.length)];
        await deleteRoom(roomId);
        action = `удаление комнаты ${roomId} с сохранением стен`;
      } else {
        const before = await currentConfig();
        const result = optimizePlans(before, {}, {}, {});
        await install(result.config);
        action = `оптимизация (изменений: ${result.report.total})`;
      }
      trace.push(action);
      config = await currentConfig();
      const state = inspect(config);
      const found = [...state.violations];
      if (state.offGrid > baseline.offGrid) {
        found.push({
          kind: 'off_lattice_coordinate', owner: 'config',
          reference: `вне сетки ${baseline.offGrid} → ${state.offGrid}`
            + ` (подшаговый шум ${baseline.noise} → ${state.noise})`,
          detail: 'жест записал координату мимо решётки',
        });
      }
      const fresh = beyondBaseline(found, baseline.counts);
      if (fresh.length) broke = { step, action, violations: found, kinds: fresh };
    }
    const key = `${plan.file}:${seed}`;
    const known = KNOWN[key] || null;
    const label = `${plan.file.replace('real-plan-', '').replace('.json', '')}_seed${seed}`;
    const asExpected = known
      ? !!broke && broke.step === known.step
        && JSON.stringify(broke.kinds) === JSON.stringify([...known.kinds].sort())
      : !broke;
    out[`walk_${label.replace(/[^a-z0-9]+/gi, '_')}`] = asExpected;
    if (!asExpected) {
      failures.push({
        plan: plan.file, seed, trace,
        step: broke ? broke.step : -1,
        action: broke
          ? broke.action
          : `находок нет, а объявлено: шаг ${known.step}, ${known.kinds.join(', ')}`
            + ' — если это починка, обновите KNOWN тем же коммитом',
        violations: broke ? broke.violations : [],
      });
      mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
      writeFileSync(
        new URL(`../artifacts/edit-walk-${label}.json`, import.meta.url),
        JSON.stringify(config, null, 1),
      );
    }
  }
}

if (failures.length) {
  console.error('\nОбход нашёл нарушения:');
  for (const failure of failures) {
    console.error(`\n  ${failure.plan}, семя ${failure.seed}, шаг ${failure.step}: ${failure.action}`);
    for (const violation of failure.violations.slice(0, 8)) {
      console.error(`    ${violation.kind} · ${violation.owner} · ${violation.reference}`);
    }
    console.error('    цепочка жестов:');
    for (const [index, action] of failure.trace.entries()) {
      console.error(`      ${index}. ${action}`);
    }
    console.error(`    конфиг сохранён: artifacts/edit-walk-${failure.plan}-seed${failure.seed}.json`);
  }
}

checkAll(out);
await finish(browser, out);
