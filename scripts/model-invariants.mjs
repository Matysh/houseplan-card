#!/usr/bin/env node
/**
 * Инварианты модели плана (#254).
 *
 *   npm run invariants -- --config <файл>            # экспорт, config/get или сырой config
 *   npm run invariants -- --config <файл> --layout <файл>
 *   npm run invariants -- --config <файл> --json
 *
 * Зачем это существует. Самый дорогой класс дефектов проекта — не ошибки
 * формул, а потеря согласованности между геометрией и ссылками на неё: #253
 * (ресайз потерял запись толщины), #244 (маркеры на удалённые пространства),
 * #252 (37 забытых позиций в layout), #248, #126. Каждый раз это находил
 * человек глазами. Здесь те же вопросы задаются машинно и одинаково.
 *
 * Модуль сознательно не импортирует `src/**`: он должен читать сырой JSON
 * экспорта и живого хранилища, не требуя сборки и не завися от того, что
 * продуктовый код считает «правильным» сегодня.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Доля шага сетки, в пределах которой запись считается лежащей на ребре. */
const EDGE_TOLERANCE = 0.004;

/** Решётка редактора: та же, что `GRID_N` в `src/space-geometry.ts`. */
const GRID_N = 240;
const GRID_STEP_N = 1 / GRID_N;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const point = (value) => (Array.isArray(value) && isFiniteNumber(value[0])
  && isFiniteNumber(value[1]) ? [value[0], value[1]] : null);

const roomPolygon = (room) => {
  const poly = Array.isArray(room?.poly) ? room.poly.map(point).filter(Boolean) : [];
  if (poly.length >= 3) return poly;
  // Прямоугольная запись старого формата — тоже полигон, просто записанный иначе.
  if ([room?.x, room?.y, room?.w, room?.h].every(isFiniteNumber)) {
    return [[room.x, room.y], [room.x + room.w, room.y],
      [room.x + room.w, room.y + room.h], [room.x, room.y + room.h]];
  }
  return null;
};

const edgesOf = (poly) => poly.map((a, index) => [a, poly[(index + 1) % poly.length]]);

const distToSegment = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

/** Все отрезки пространства, на которых законно жить записи толщины. */
const carriers = (space) => {
  const out = [];
  for (const room of space?.rooms || []) {
    const poly = roomPolygon(room);
    if (poly) out.push(...edgesOf(poly));
  }
  for (const partition of space?.partitions || []) {
    const a = point(partition?.a), b = point(partition?.b);
    if (a && b) out.push([a, b]);
  }
  return out;
};

const onSomeCarrier = (span, list, tolerance) => list.some(([a, b]) =>
  distToSegment(span[0], a, b) <= tolerance && distToSegment(span[1], a, b) <= tolerance);

/**
 * Инвариант 2: каждая ссылка указывает на существующий объект.
 *
 * Каждое нарушение адресуется: что ссылается, куда и чего не нашли. Пустой
 * список — не «наверное всё хорошо», а «проверено».
 */
export function checkReferences({ config, layout = {} } = {}, { notes = [] } = {}) {
  const violations = [];
  const spaces = Array.isArray(config?.spaces) ? config.spaces : [];
  const spaceIds = new Set(spaces.map((space) => String(space?.id ?? '')).filter(Boolean));
  const markerIds = new Set((config?.markers || [])
    .map((marker) => String(marker?.id ?? '')).filter(Boolean));
  const roomIdsBySpace = new Map(spaces.map((space) => [String(space?.id ?? ''),
    new Set((space?.rooms || []).map((room) => String(room?.id ?? '')).filter(Boolean))]));
  const areasBySpace = new Map(spaces.map((space) => [String(space?.id ?? ''),
    new Set((space?.rooms || []).map((room) => String(room?.area ?? '')).filter(Boolean))]));
  const add = (kind, owner, reference, detail) =>
    violations.push({ invariant: 'references', kind, owner, reference, detail });

  for (const marker of config?.markers || []) {
    if (marker?.removed) continue;
    const space = marker?.space == null ? '' : String(marker.space);
    if (space && !spaceIds.has(space)) {
      add('marker_space', String(marker.id ?? '?'), space, 'пространства не существует');
    }
  }

  for (const [key, position] of Object.entries(layout || {})) {
    const space = position?.s == null ? '' : String(position.s);
    if (space && !spaceIds.has(space)) {
      add('layout_space', key, space, 'пространства не существует');
      continue;
    }
    // Владелец позиции: подпись комнаты, групповая метка области либо маркер.
    if (key.startsWith('rl_')) {
      const roomId = key.slice(3);
      const rooms = roomIdsBySpace.get(space);
      if (rooms && !rooms.has(roomId)) {
        add('layout_owner', key, roomId, 'комнаты не существует в этом пространстве');
      }
      continue;
    }
    if (key.startsWith('grp_')) {
      const area = key.slice(4);
      const areas = areasBySpace.get(space);
      if (areas && areas.size && !areas.has(area)) {
        add('layout_owner', key, area, 'в этом пространстве нет комнаты с такой областью');
      }
      continue;
    }
    if (!markerIds.has(key)) {
      // Позиция может принадлежать устройству HA, у которого ещё нет записи в
      // `markers`: маркеры создаются лениво, а позиция сохраняется сразу. По
      // одной конфигурации это не отличить от мусора, поэтому — наблюдение, а
      // не нарушение. Проверка с ложными срабатываниями умирает первой.
      notes.push({ invariant: 'references', kind: 'unknown_owner', owner: key,
        reference: key, detail: 'владелец не найден в конфигурации (возможно устройство HA)' });
    }
  }

  for (const space of spaces) {
    const spaceId = String(space?.id ?? '?');
    const list = carriers(space);
    const tolerance = EDGE_TOLERANCE;
    for (const wall of space?.walls || []) {
      const a = point(wall?.a), b = point(wall?.b);
      if (!a || !b) continue; // запись только с ключом — совместимость, не ссылка
      if (!list.length || !onSomeCarrier([a, b], list, tolerance)) {
        add('wall_carrier', `${spaceId}:${wall?.key ?? '?'}`, `${wall?.cm} см`,
          'запись толщины не лежит ни на одном ребре комнаты и ни на одной перегородке');
      }
    }
    for (const span of space?.open_spans || []) {
      const a = point(span?.a), b = point(span?.b);
      if (!a || !b) continue;
      if (!list.length || !onSomeCarrier([a, b], list, tolerance)) {
        add('open_span_carrier', `${spaceId}:${span?.id ?? '?'}`, 'open_span',
          'виртуальный проём не лежит на границе существующих комнат');
      }
    }
  }
  return violations;
}

/**
 * Инвариант 1: запись толщины не исчезает.
 *
 * Сравнивается мультимножество значений `cm`, а не суммарная длина: ресайз
 * законно укорачивает стены, а склейка двух одинаковых записей законно
 * уменьшает их число. Незаконно ровно одно — исчезновение значения целиком,
 * как в #253, где 33 см пропали вместе с кладкой соседних комнат.
 *
 * `allowClear` — единственное исключение, и оно объявляется вызывающим:
 * пользователь очистил толщину явно.
 */
export function checkWallRecordsPreserved(before, after, { allowClear = false } = {}) {
  if (allowClear) return [];
  const counts = (walls) => {
    const map = new Map();
    for (const wall of walls || []) {
      if (!isFiniteNumber(wall?.cm) || !(wall.cm > 0)) continue;
      const key = String(wall.cm);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };
  const from = counts(before), to = counts(after);
  const violations = [];
  for (const [cm, was] of from) {
    const now = to.get(cm) || 0;
    if (now === 0) {
      violations.push({
        invariant: 'wall_records', kind: 'lost', owner: `${cm} см`,
        reference: `было ${was}`, detail: 'записи этой толщины исчезли целиком',
      });
    }
  }
  return violations;
}

/**
 * Копия ключа отрезка из `src/wall-thickness.ts`.
 *
 * Дублировать формулу приходится: модуль сознательно читает сырой JSON без
 * сборки, а `wallKey` живёт в TypeScript. Дубль величины, видимой в двух
 * местах, — ровно тот дефект, который проект ловил трижды (#233, #234, #258),
 * поэтому копия прикреплена тестом: `test/model-invariants.test.mjs` берёт
 * настоящий `wallKey` из `test-build` и сверяет с этой копией на наборе
 * отрезков, включая попадающие в ничью округления. Разойдутся — покраснеет.
 */
const quantise = (value, pitch) => (!(pitch > 0) || !Number.isFinite(value)
  ? value : Math.round(value / pitch) * pitch);

const segmentDirection = (a, b) => {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return [1, 0];
  dx /= length; dy /= length;
  if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) return [-dx, -dy];
  return [dx, dy];
};

export function wallKey(a, b, pitch = GRID_STEP_N) {
  const mx = quantise((a[0] + b[0]) / 2, pitch);
  const my = quantise((a[1] + b[1]) / 2, pitch);
  const [dx, dy] = segmentDirection(a, b);
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI;
  const bucket = Math.round(angle * 1800) / 1800;
  const precision = pitch > 0 && pitch < 0.01 ? 6 : pitch < 1 ? 4 : 2;
  return `${mx.toFixed(precision)},${my.toFixed(precision)}@${bucket.toFixed(4)}`;
}

/**
 * Вершина на ближайшем узле решётки.
 *
 * Через индекс узла, а не делением: `Math.round(v * 240) / 240` даёт точное
 * `k/240`, тогда как умножение на шаг накапливает разницу в последних битах —
 * а весь этот инвариант живёт именно там.
 */
export const latticePoint = (p) => [
  Math.round(p[0] * GRID_N) / GRID_N,
  Math.round(p[1] * GRID_N) / GRID_N,
];

/**
 * Инвариант 3: ключ записи толщины — это ключ решёточного ребра (#258, #259).
 *
 * Сравниваются строки, без допусков: допуск здесь и был причиной промаха.
 * `checkReferences` проверяет попадание середины на ребро с точностью 0.004,
 * а сдвиг ключа на один шаг решётки равен 0.00417 — проверка стояла ровно на
 * границе своего же допуска.
 *
 * Ключ считается от концов, ПРИВЕДЁННЫХ К УЗЛАМ, а не от сырых. Разница не
 * косметическая, и первая формулировка в #258 была из-за неё неверной: до
 * дефекта ключ `0.887500,0.200000@1.5706` не совпадал с ключом от сырых концов
 * записи, и план при этом рисовался верно. Рендер ключует от узловой формы,
 * поэтому сверять надо с ней; форма от сырых концов помечает исправное
 * состояние и пропускает дефектное — проверено на паре экспортов «до/после».
 *
 * Причина, по которой одна вершина даёт два разных ключа: `wallKey` квантует
 * середину через `Math.round`, а у стены нечётной длины в шагах середина
 * попадает ровно на границу округления. `83/240` даёт 47.5 шага и бакет 48,
 * записанное в конфиге `0.345833333` — 47.49999996 и бакет 47.
 */
export function checkWallKeys(config) {
  const violations = [];
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    const spaceId = String(space?.id ?? '?');
    for (const wall of space?.walls || []) {
      const a = point(wall?.a), b = point(wall?.b);
      // Запись только с ключом — совместимость: проверять нечем, и это не повод
      // объявлять её сломанной.
      if (!a || !b) continue;
      if (typeof wall?.key !== 'string' || !wall.key) continue;
      const expected = wallKey(latticePoint(a), latticePoint(b));
      if (wall.key !== expected) {
        violations.push({
          invariant: 'wall_keys', kind: 'wall_key', owner: `${spaceId}:${wall.key}`,
          reference: expected,
          detail: `ключ записи ${wall?.cm} см не равен ключу решёточного ребра —`
            + ' запись не найдётся при отрисовке',
        });
      }
    }
  }
  return violations;
}

/** Разобрать любой из трёх форматов, в которых приходит конфигурация. */
export function readModel(text) {
  const parsed = JSON.parse(text);
  const config = parsed?.payload?.config ?? parsed?.result?.config ?? parsed?.config ?? parsed;
  const layout = parsed?.payload?.layout ?? parsed?.result?.layout ?? parsed?.layout ?? {};
  return { config, layout };
}

function report(violations, notes = []) {
  if (!violations.length) {
    const tail = notes.length
      ? `\nНаблюдений (не нарушения): ${notes.length} — позиции без записи маркера.`
      : '';
    return 'Инварианты выполнены: ссылки разрешимы, ключи записей толщины на месте.'
      + tail;
  }
  const lines = [`Нарушений: ${violations.length}.`, ''];
  const byKind = new Map();
  for (const violation of violations) {
    const list = byKind.get(violation.kind) || [];
    list.push(violation);
    byKind.set(violation.kind, list);
  }
  const titles = {
    marker_space: 'Маркеры ссылаются на несуществующие пространства',
    layout_space: 'Позиции ссылаются на несуществующие пространства',
    layout_owner: 'Позиции без владельца',
    wall_carrier: 'Записи толщины вне рёбер и перегородок',
    open_span_carrier: 'Виртуальные проёмы вне границ комнат',
    lost: 'Потерянные записи толщины',
    wall_key: 'Ключи записей толщины не совпадают с ребром решётки',
  };
  for (const [kind, list] of byKind) {
    lines.push(`${titles[kind] || kind}: ${list.length}`);
    for (const violation of list.slice(0, 12)) {
      lines.push(`  ${violation.owner} → ${violation.reference}: ${violation.detail}`);
    }
    if (list.length > 12) lines.push(`  и ещё ${list.length - 12}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function main(argv) {
  const arg = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const configPath = arg('--config');
  if (!configPath) {
    console.error('использование: model-invariants.mjs --config <файл> [--layout <файл>] [--json]');
    return 2;
  }
  const model = readModel(readFileSync(configPath, 'utf8'));
  if (arg('--layout')) model.layout = readModel(readFileSync(arg('--layout'), 'utf8')).layout;
  const notes = [];
  const violations = [
    ...checkReferences(model, { notes }),
    ...checkWallKeys(model.config),
  ];
  if (argv.includes('--json')) console.log(JSON.stringify({ violations, notes }, null, 2));
  else console.log(report(violations, notes));
  // Код возврата — не приговор конфигурации пользователя, а сигнал для CI.
  return violations.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
