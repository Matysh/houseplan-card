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
import { launch, checkAll, finish } from './serve.mjs';

// The process prepares test-build once for the complete validation candidate.
// Standalone use requires: node process-next/catalog/prepare.mjs tests
const { optimizePlans } = await import('../test-build/plan-optimizer.js');
const { checkOptimizeGeometry } = await import('../test-build/plan-geometry-preflight.js');
const { WallSegmentModelError, commitWallSegmentModel } = await import('../test-build/wall-segment-model.js');
const { PlanGraphError } = await import('../test-build/plan-graph.js');
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
 * лежащую на наружной стене трёх комнат. #296 научил явный Optimize безопасно
 * удалять этот объект, но исходная raw-фикстура намеренно не переписана: обход
 * обязан отделять её исходный долг от НОВЫХ нарушений каждого жеста.
 */
const PLANS = [
  // The one historical carrier has three exact role atoms after model11 migration.
  { file: 'real-plan-second-floor.json', debt: 1, currentDebt: 3 },
  { file: 'real-plan-first-floor.json', debt: 0, currentDebt: 0 },
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
// #298 убрал off-grid/carrier producer Resize, а #299 — mixed-role producer
// Optimize/Delete-room. Поэтому все шесть 24-шаговых обходов теперь обязаны
// завершаться без нового нарушения; исходный fixture debt учтён отдельно выше.
const KNOWN = {};
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
    offGridUnique: lattice.offGridUnique,
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

// Ignore only the documented old physical carrier, including its exact
// migration atoms. Other owners, changed thickness/metadata or points outside
// that original carrier remain ordinary new violations, regardless of counts.
const withoutHistoricalDebt = (violations, config, source) => violations.filter(v => {
  if(v.kind !== 'partition_over_room_wall'
    || !/^real-second-floor:partition-mt2on9ou-0(?:~[12])?$/.test(v.owner)) return true;
  const old = source.spaces.find(s => s.id === 'real-second-floor')?.partitions
    ?.find(p => p.id === 'partition-mt2on9ou-0');
  const part = config.spaces.find(s => s.id === 'real-second-floor')?.partitions
    ?.find(p => 'real-second-floor:' + p.id === v.owner);
  if(!old || !part) return true;
  const metadata = p => JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !['id','a','b'].includes(k))));
  if(metadata(part) !== metadata(old)) return true;
  const d=old.b.map((x,i)=>x-old.a[i]), length=d[0]**2+d[1]**2;
  return ![part.a,part.b].every(p => {
    const q=p.map((x,i)=>x-old.a[i]), t=(q[0]*d[0]+q[1]*d[1])/length;
    return Math.abs(q[0]*d[1]-q[1]*d[0]) < 1e-12 && t >= -1e-12 && t <= 1+1e-12;
  });
});

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
    if (!card._resize?.dragging) return 'жест не начался';
    const plan = card._resize.plan;
    const shift = card._gridPitch * steps;
    const dx = plan.n[0] * shift / perClientX;
    const dy = plan.n[1] * shift / perClientY;
    card._rszMove(ev(clientX + dx, clientY + dy));
    const moved = card._resize?.moved === true;
    card._rszUp(ev(clientX + dx, clientY + dy));
    card.requestUpdate();
    await card.updateComplete;
    // pointerup flushes the queued RAF move, so this pre-release observation
    // cannot claim that the final committed gesture did not move anything.
    return moved ? null : 'нет синхронного предпросмотра до отпускания';
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
  const legacy = inspect(source.config);
  checkAll({ ['legacy_debt_' + plan.file]: legacy.violations.length }, { ['legacy_debt_' + plan.file]: plan.debt });
  // Cross the official model11 boundary before measuring the gesture baseline.
  // This exposes existing atomized debt before the first command instead of
  // reporting a no-op migration split as three newly created hidden walls.
  const current = commitWallSegmentModel(source.config).config;
  if (plan.debt) checkAll({ historicalCarrierDebtOnly: inspect(current).violations.every(v =>
    v.kind === 'partition_over_room_wall' && /^real-second-floor:partition-mt2on9ou-0(?:~[12])?$/.test(v.owner)) });
  // Retain the original legacy walks; current walks add graph-era coverage.
  for (const representation of ['legacy', 'current']) for (const seed of SEEDS) {
    const random = rng(seed);
    const trace = [];
    let config = JSON.parse(JSON.stringify(representation === 'legacy' ? source.config : current));
    let broke = null;
    const baseline = inspect(config);
    baseline.counts = countKinds(withoutHistoricalDebt(baseline.violations, config, source.config));
    const debt = representation === 'legacy' ? plan.debt : plan.currentDebt;
    if (baseline.violations.length !== debt) {
      failures.push({
        plan: plan.file, seed, step: -1,
        action: `объявленный ${representation}-долг фикстуры ${debt}`
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
        const beforeBytes = JSON.stringify(before);
        try {
          const result = optimizePlans(before, {}, {}, {});
          // The product shows the preview but refuses to apply a candidate
          // rejected by the exact geometry preflight. The walk must exercise
          // that same transaction boundary rather than installing the pure
          // optimizer's intermediate result behind the card's back.
          const preflight = result.changed ? checkOptimizeGeometry(result.config) : null;
          if (preflight && !preflight.ok) {
            const reasons = [...new Set(preflight.failures.map((failure) => failure.reason))];
            action = `оптимизация безопасно заблокирована (${reasons.join(', ')})`;
          } else {
            await install(result.config);
            action = `оптимизация (изменений: ${result.report.total})`;
          }
        } catch (error) {
          if (!(error instanceof WallSegmentModelError) && !(error instanceof PlanGraphError)) throw error;
          checkAll({ refusedOptimizeRetainsInputAndLiveConfig: beforeBytes === JSON.stringify(before)
            && beforeBytes === JSON.stringify(await currentConfig()) });
          action = `оптимизация безопасно заблокирована (${error.reason || error.code})`;
        }
      }
      trace.push(action);
      config = await currentConfig();
      const state = inspect(config);
      const found = [...state.violations];
      if (state.offGridUnique > baseline.offGridUnique) {
        found.push({
          kind: 'off_lattice_coordinate', owner: 'config',
          reference: `уникальных значений вне сетки ${baseline.offGridUnique} → ${state.offGridUnique}`
            + ` (координат ${baseline.offGrid} → ${state.offGrid})`
            + ` (подшаговый шум ${baseline.noise} → ${state.noise})`,
          detail: 'жест записал координату мимо решётки',
        });
      }
      const fresh = beyondBaseline(withoutHistoricalDebt(found, config, source.config), baseline.counts);
      if (fresh.length) broke = { step, action, violations: found, kinds: fresh };
    }
    const key = `${plan.file}:${seed}`;
    const known = KNOWN[key] || null;
    const label = `${plan.file.replace('real-plan-', '').replace('.json', '')}_seed${seed}${representation === 'current' ? '_current' : ''}`;
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
