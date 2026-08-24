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
 * Structural geometry is the exception: the CLI deliberately imports the
 * compiled production preparation instead of maintaining a second boolean
 * model which can drift from the renderer (#278).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkOptimizeGeometry } from '../test-build/plan-geometry-preflight.js';

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

const keyEpsilon = (pitch) => Math.max(Math.abs(pitch) * 1e-6, 1e-9);
const canonicalKeyCoordinate = (value, pitch) => {
  if (!(pitch > 0) || !Number.isFinite(value)) return value;
  const snapped = quantise(value, pitch);
  return Math.abs(snapped - value) <= keyEpsilon(pitch) ? snapped : value;
};

const segmentDirection = (a, b) => {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return [1, 0];
  dx /= length; dy /= length;
  if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) return [-dx, -dy];
  return [dx, dy];
};

export function wallKey(a, b, pitch = GRID_STEP_N) {
  const ca = [canonicalKeyCoordinate(a[0], pitch), canonicalKeyCoordinate(a[1], pitch)];
  const cb = [canonicalKeyCoordinate(b[0], pitch), canonicalKeyCoordinate(b[1], pitch)];
  const mx = quantise((ca[0] + cb[0]) / 2, pitch);
  const my = quantise((ca[1] + cb[1]) / 2, pitch);
  const [dx, dy] = segmentDirection(ca, cb);
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI;
  const bucket = Math.round(angle * 1800) / 1800;
  const precision = pitch > 0 && pitch < 0.01 ? 6 : pitch < 1 ? 4 : 2;
  return `${mx.toFixed(precision)},${my.toFixed(precision)}@${bucket.toFixed(4)}`;
};

/** Середина, записанная в ключе. `null` — ключ не разбирается как координаты. */
export function keyMidpoint(key) {
  const match = /^(-?[0-9.]+),(-?[0-9.]+)@(-?[0-9.]+)$/.exec(String(key ?? ''));
  if (!match) return null;
  const x = Number(match[1]), y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/**
 * Диагностика совместимого ключа записи толщины (#258, #259).
 *
 * После #258 точная пара `a/b` является строгой идентичностью того же span и
 * разрешается до legacy midpoint fallback. Поэтому любой отличный или даже
 * неразбираемый compatibility key у записи с валидными endpoints — наблюдение,
 * а не нарушение: runtime найдёт запись по endpoints, а явный Optimize
 * перепишет стабильный key. Legacy key-only запись проверить и исправить по
 * догадке нельзя, поэтому она по-прежнему пропускается.
 */
export function checkWallKeys(config, { notes = [] } = {}) {
  const violations = [];
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    const spaceId = String(space?.id ?? '?');
    for (const wall of space?.walls || []) {
      const a = point(wall?.a), b = point(wall?.b);
      // Запись только с ключом — совместимость: сверять не с чем, и это не
      // повод объявлять её сломанной.
      if (!a || !b) continue;
      if (typeof wall?.key !== 'string' || !wall.key) continue;
      const expected = wallKey(a, b);
      if (wall.key === expected) continue;
      const owner = `${spaceId}:${wall.key}`;
      const stored = keyMidpoint(wall.key);
      const drift = stored
        ? Math.hypot(stored[0] - (a[0] + b[0]) / 2, stored[1] - (a[1] + b[1]) / 2)
          / GRID_STEP_N
        : null;
      const driftText = drift === null ? 'ключ не разбирается как координаты'
        : `середина отличается на ${drift.toFixed(2)} шага`;
      notes.push({ invariant: 'wall_keys', kind: 'stale_wall_key', owner,
        reference: expected,
        detail: `${driftText}; запись находится по точной паре endpoints,`
          + ' явный Optimize перепишет совместимый ключ' });
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

/** Production structural pass with bounded, anonymised diagnostics. */
export function checkPhysicalGeometry(config) {
  let result;
  try { result = checkOptimizeGeometry(config); } catch {
    return [{
      invariant: 'physical_geometry', kind: 'geometry_exception', owner: 'config',
      reference: 'prepare-exception', detail: 'production geometry check failed',
    }];
  }
  return result.failures.map((failure, index) => ({
    invariant: 'physical_geometry', kind: 'physical_geometry',
    owner: `space[${index + 1}]`, reference: failure.reason,
    detail: 'canonical wall geometry is not safe for a write',
  }));
}

/** Наблюдения перечисляются по смыслу: «их 39» читателю ничего не говорит. */
function noteSummary(notes) {
  const counts = new Map();
  for (const note of notes) counts.set(note.kind, (counts.get(note.kind) || 0) + 1);
  const titles = {
    unknown_owner: 'позиции без записи маркера',
    stale_wall_key: 'записей толщины используют exact endpoints вместо своего ключа',
  };
  return [...counts].map(([kind, n]) => `${n} — ${titles[kind] || kind}`).join('; ') + '.';
}

function report(violations, notes = []) {
  if (!violations.length) {
    const tail = notes.length
      ? `\nНаблюдений (не нарушения): ${notes.length}. ` + noteSummary(notes)
      : '';
    return 'Инварианты выполнены: ссылки разрешимы, записи толщины находятся.'
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
    physical_geometry: 'Небезопасная каноническая геометрия стен',
    geometry_exception: 'Сбой проверки канонической геометрии стен',
    lost: 'Потерянные записи толщины',
    wall_key: 'Записи толщины, которые не найдутся по ключу',
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
    ...checkWallKeys(model.config, { notes }),
    ...checkPhysicalGeometry(model.config),
  ];
  if (argv.includes('--json')) console.log(JSON.stringify({ violations, notes }, null, 2));
  else console.log(report(violations, notes));
  // Код возврата — не приговор конфигурации пользователя, а сигнал для CI.
  return violations.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
