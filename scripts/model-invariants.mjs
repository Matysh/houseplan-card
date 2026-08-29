#!/usr/bin/env node
/**
 * Инварианты модели плана (#254).
 *
 *   npm run invariants -- --config <файл>            # экспорт, config/get или сырой config
 *   npm run invariants -- --config <файл> --layout <файл>
 *   npm run invariants -- --config <файл> --near-axis --json
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
import { classifyNearAxisSegment } from '../test-build/near-axis.js';
import { checkWallRecordsPreserved } from '../test-build/wall-record-preservation.js';
export { checkWallRecordsPreserved } from '../test-build/wall-record-preservation.js';
import {
  LATTICE_GRID_N as GRID_N,
  LATTICE_NOISE_STEPS as NOISE_STEPS,
} from '../test-build/coordinate-canonicalization.js';

/** Доля шага сетки, в пределах которой запись считается лежащей на ребре. */
const EDGE_TOLERANCE = 0.004;

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

/** Deduplicated physical near-axis segments, including both room-owner copies. */
export function nearAxisProfile(config) {
  const spaces = [];
  let total = 0;
  const keyOf = (a, b) => {
    const ka = `${a[0]},${a[1]}`, kb = `${b[0]},${b[1]}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  for (const space of config?.spaces || []) {
    const found = new Set();
    for (const room of space?.rooms || []) {
      const poly = roomPolygon(room);
      if (!poly) continue;
      for (const [a, b] of edgesOf(poly)) {
        if (classifyNearAxisSegment(a, b)) found.add(keyOf(a, b));
      }
    }
    for (const draft of space?.room_drafts || []) {
      for (let index = 0; index + 1 < (draft?.points || []).length; index++) {
        const a = point(draft.points[index]), b = point(draft.points[index + 1]);
        if (a && b && classifyNearAxisSegment(a, b)) found.add(`draft:${draft.id}:${index}`);
      }
    }
    for (const partition of space?.partitions || []) {
      const a = point(partition?.a), b = point(partition?.b);
      if (a && b && classifyNearAxisSegment(a, b)) {
        found.add(`partition:${partition.id || keyOf(a, b)}`);
      }
    }
    const count = found.size;
    spaces.push({ spaceId: String(space?.id || ''), count });
    total += count;
  }
  return { total, spaces };
}

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
  const activeMarkerIds = new Set((config?.markers || [])
    .filter((marker) => marker?.removed !== true)
    .map((marker) => String(marker?.id ?? '')).filter(Boolean));
  const activeLightMarkerIds = new Set((config?.markers || [])
    .filter((marker) => marker?.removed !== true && marker?.is_light === true)
    .map((marker) => String(marker?.id ?? '')).filter(Boolean));
  const roomIdsBySpace = new Map(spaces.map((space) => [String(space?.id ?? ''),
    new Set((space?.rooms || []).map((room) => String(room?.id ?? '')).filter(Boolean))]));
  const areasBySpace = new Map(spaces.map((space) => [String(space?.id ?? ''),
    new Set((space?.rooms || []).map((room) => String(room?.area ?? '')).filter(Boolean))]));
  const add = (kind, owner, reference, detail) =>
    violations.push({ invariant: 'references', kind, owner, reference, detail });

  for (const marker of config?.markers || []) {
    if (marker?.removed) continue;
    const markerId = String(marker.id ?? '?');
    const space = marker?.space == null ? '' : String(marker.space);
    if (space && !spaceIds.has(space)) {
      add('marker_space', markerId, space, 'пространства не существует');
    }
    const room = marker?.room_id == null ? '' : String(marker.room_id);
    if (room && spaceIds.has(space) && !roomIdsBySpace.get(space)?.has(room)) {
      add('marker_room', markerId, room, 'комнаты не существует в пространстве маркера');
    }
    const segments = marker?.vacuum?.segment_map;
    if (segments && typeof segments === 'object' && !Array.isArray(segments)) {
      for (const [segment, value] of Object.entries(segments)) {
        const roomId = String(value ?? '');
        if (roomId && spaceIds.has(space) && !roomIdsBySpace.get(space)?.has(roomId)) {
          add('vacuum_room', `${markerId}:${segment}`, roomId,
            'комнаты сегмента не существует в пространстве маркера');
        }
      }
    }
    for (const value of Array.isArray(marker?.controls) ? marker.controls : []) {
      if (typeof value !== 'string' || !value.startsWith('marker:')) continue;
      const target = value.slice('marker:'.length);
      if (!activeLightMarkerIds.has(target)) {
        add('marker_control', markerId, target,
          activeMarkerIds.has(target)
            ? 'маркер-цель не является источником света'
            : 'активного маркера-цели не существует');
      }
    }
    const badgeSource = marker?.value_badge?.source;
    if (badgeSource?.kind === 'derived_marker_state') {
      const ref = String(badgeSource.ref ?? '');
      const target = ref.startsWith('marker:') ? ref.slice('marker:'.length) : '';
      if (!target || !activeLightMarkerIds.has(target)) {
        add('marker_badge', markerId, ref || '?',
          target && activeMarkerIds.has(target)
            ? 'маркер-источник не является источником света'
            : 'активного маркера-источника не существует');
      }
    }
    const valueSource = marker?.value_source;
    if (valueSource?.kind === 'derived_marker_state') {
      const ref = String(valueSource.ref ?? '');
      const target = ref.startsWith('marker:') ? ref.slice('marker:'.length) : '';
      if (!target || !activeLightMarkerIds.has(target)) {
        add('marker_value_source', markerId, ref || '?',
          target && activeMarkerIds.has(target)
            ? 'маркер-цель не является источником света'
            : 'активного маркера-цели не существует');
      }
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
    const roomIds = roomIdsBySpace.get(spaceId) || new Set();
    const wallSegments = new Map((space?.wall_segments || [])
      .map((segment) => [String(segment?.id ?? ''), segment]).filter(([id]) => id));
    for (const room of space?.rooms || []) {
      const roomId = String(room?.id ?? '?');
      for (const target of Array.isArray(room?.open_to) ? room.open_to : []) {
        const targetId = String(target ?? '');
        if (targetId && !roomIds.has(targetId)) {
          add('room_open_to', `${spaceId}:${roomId}`, targetId,
            'комнаты назначения не существует в том же пространстве');
        }
      }
      if (Number(config?.model_version || 0) >= 8) {
        const wallIds = Array.isArray(room?.wall_ids) ? room.wall_ids : [];
        const poly = roomPolygon(room) || [];
        if (wallIds.length !== poly.length) {
          add('room_wall_ids', `${spaceId}:${roomId}`, String(wallIds.length),
            `ожидалось по одному id для ${poly.length} рёбер`);
        }
        for (const target of wallIds) {
          const targetId = String(target ?? '');
          if (!targetId || !wallSegments.has(targetId)) {
            add('room_wall_ids', `${spaceId}:${roomId}`, targetId || '?',
              'сегмента стены не существует в том же пространстве');
          }
        }
      }
    }
    const partitionIds = new Set((space?.partitions || [])
      .map((partition) => String(partition?.id ?? '')).filter(Boolean));
    for (const opening of space?.openings || []) {
      const host = opening?.host;
      if (!host) {
        // #316 §3.3: since model v9 an unhosted contour opening is a valid
        // degraded state (the migration keeps an opening with no in-place
        // carrier as data, inert until re-placed). Only model v8 documents
        // still require an explicit host on every opening.
        if (Number(config?.model_version || 0) === 8) {
          add('opening_host', `${spaceId}:${opening?.id ?? '?'}`, '?',
            'в model v8 у проёма нет явной стены-хоста');
        }
        continue;
      }
      const target = String(host.id ?? '');
      const exists = host?.kind === 'partition'
        ? partitionIds.has(target)
        : host?.kind === 'wall' && wallSegments.has(target);
      if (!target || !exists) {
        add('opening_host', `${spaceId}:${opening?.id ?? '?'}`, target || '?',
          'стены-хоста не существует в том же пространстве');
      }
    }
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

/**
 * Стадия 0 из ADR #282: профиль отклонений от решётки.
 *
 * Весь класс #258/#279/#248 держится на одном свойстве представления: узел
 * решётки это `k/240`, число без точного двоичного представления, а хранимая
 * координата это float. Сколько реальной геометрии лежит вне решётки и
 * насколько далеко — не знает никто, а Optimize берётся «убрать шум
 * координат», не имея проверяемого определения шума.
 *
 * Здесь ничего не судится и не чинится: считается профиль. Три населения
 * разделены намеренно, потому что это разные проблемы, а не разные степени
 * одной:
 *
 *   exact — точно на узле, делать нечего;
 *   noise — рядом с узлом, но не точно. ЭТО класс дефектов: ключ стены
 *           попадает не в тот бакет, Optimize не сходится, «почти
 *           ортогональная» стена рисует клин;
 *   offGrid — далеко от узла. Законная по нынешней модели геометрия: авторские
 *           координаты фикстур (0.06 — это 14.4 шага от узла) ничем не
 *           запрещены. Объявить их нарушением значит получить проверку,
 *           которую отключат в первую неделю.
 *
 * Граница между noise и offGrid — доля шага, а не абсолют: `NOISE_STEPS`.
 * Взята на четыре порядка ниже шага, то есть заведомо ниже любого осмысленного
 * пользовательского ввода и заведомо выше двоичного мусора одиночной операции.
 */
const latticeDeviation = (value) => {
  const steps = value * GRID_N;
  return Math.abs(steps - Math.round(steps));
};

/** Все координаты модели с адресом, по которому их можно найти глазами. */
function* modelCoordinates(config, layout = {}) {
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    const spaceId = String(space?.id ?? '?');
    for (const room of space?.rooms || []) {
      const poly = Array.isArray(room?.poly) ? room.poly : [];
      for (const [index, p] of poly.entries()) {
        const point = pointOf(p);
        if (point) yield { kind: 'room', owner: `${spaceId}:${room?.id ?? '?'}#${index}`, point };
      }
      const origin = pointOf([room?.x, room?.y]);
      if (origin) yield { kind: 'room', owner: `${spaceId}:${room?.id ?? '?'}.origin`, point: origin };
      const size = pointOf([room?.w, room?.h]);
      if (size) yield { kind: 'room', owner: `${spaceId}:${room?.id ?? '?'}.size`, point: size };
    }
    for (const part of space?.partitions || []) {
      for (const end of ['a', 'b']) {
        const point = pointOf(part?.[end]);
        if (point) yield { kind: 'partition', owner: `${spaceId}:${part?.id ?? '?'}.${end}`, point };
      }
    }
    for (const wall of space?.walls || []) {
      for (const end of ['a', 'b']) {
        const point = pointOf(wall?.[end]);
        if (point) yield { kind: 'wall', owner: `${spaceId}:${wall?.key ?? '?'}.${end}`, point };
      }
    }
    for (const span of space?.open_spans || []) {
      for (const end of ['a', 'b']) {
        const point = pointOf(span?.[end]);
        if (point) yield { kind: 'open_span', owner: `${spaceId}:${span?.id ?? '?'}.${end}`, point };
      }
    }
    for (const column of space?.wall_columns || []) {
      const point = pointOf(column?.center);
      if (point) yield { kind: 'column', owner: `${spaceId}:${column?.id ?? '?'}`, point };
    }
    for (const opening of space?.openings || []) {
      const point = pointOf([opening?.x, opening?.y]);
      if (point) yield { kind: 'opening', owner: `${spaceId}:${opening?.id ?? '?'}`, point };
    }
    for (const draft of space?.room_drafts || []) {
      for (const [index, value] of (draft?.points || []).entries()) {
        const point = pointOf(value);
        if (point) yield { kind: 'room_draft', owner: `${spaceId}:${draft?.id ?? '?'}#${index}`, point };
      }
    }
    for (const decor of space?.decor || []) {
      const id = `${spaceId}:${decor?.id ?? '?'}`;
      if (decor?.kind === 'line') {
        const a = pointOf([decor?.x1, decor?.y1]);
        const b = pointOf([decor?.x2, decor?.y2]);
        if (a) yield { kind: 'decor', owner: `${id}.a`, point: a };
        if (b) yield { kind: 'decor', owner: `${id}.b`, point: b };
      } else if (['rect', 'ellipse', 'furniture'].includes(decor?.kind)) {
        const origin = pointOf([decor?.x, decor?.y]);
        const size = pointOf([decor?.w, decor?.h]);
        if (origin) yield { kind: 'decor', owner: `${id}.origin`, point: origin };
        if (size) yield { kind: 'decor', owner: `${id}.size`, point: size };
      } else if (decor?.kind === 'text') {
        const point = pointOf([decor?.x, decor?.y]);
        if (point) yield { kind: 'decor', owner: id, point };
      }
    }
  }
  for (const [key, position] of Object.entries(layout || {})) {
    const point = pointOf([position?.x, position?.y]);
    if (point) yield { kind: 'layout', owner: key, point };
  }
}

const pointOf = (value) => (Array.isArray(value) && isFiniteNumber(value[0])
  && isFiniteNumber(value[1]) ? [value[0], value[1]] : null);

/**
 * Профиль модели: сколько координат точно на узле, сколько в шуме, сколько
 * законно вне сетки. Ни одного нарушения не возвращается — по построению.
 */
export function latticeProfile({ config, layout = {} } = {}) {
  const buckets = { exact: 0, noise: 0, offGrid: 0 };
  const offGridValues = new Set();
  const byKind = new Map();
  let worstNoise = null;
  let total = 0;
  for (const { kind, owner, point } of modelCoordinates(config, layout)) {
    for (const [axis, value] of [['x', point[0]], ['y', point[1]]]) {
      const deviation = latticeDeviation(value);
      const bucket = deviation === 0 ? 'exact' : deviation < NOISE_STEPS ? 'noise' : 'offGrid';
      if (bucket === 'offGrid') offGridValues.add(Number(value).toFixed(12));
      total++;
      buckets[bucket]++;
      const seen = byKind.get(kind) || { exact: 0, noise: 0, offGrid: 0 };
      seen[bucket]++;
      byKind.set(kind, seen);
      if (bucket === 'noise' && (!worstNoise || deviation > worstNoise.steps)) {
        worstNoise = { kind, owner, axis, value, steps: deviation };
      }
    }
  }
  return {
    total,
    ...buckets,
    offGridUnique: offGridValues.size,
    noiseSteps: NOISE_STEPS,
    worstNoise,
    byKind: Object.fromEntries([...byKind].map(([kind, counts]) => [kind, counts])),
  };
}

/**
 * Инвариант 4: запись толщины не описывает сразу общую и наружную стену (#287).
 *
 * Откуда это взялось. Владелец прислал пару экспортов до и после ресайза: одна
 * комната из общей пары сдвинулась на 43 шага, вторая осталась. Нижние 43 шага
 * стены перестали быть общими — стали наружными, — но продолжают нести 20 см
 * бывшей общей границы, тогда как соседние наружные несут 30 см. Толщина
 * сохранена ПО КЛЮЧУ, а не по роли ребра.
 *
 * Проверить это можно в одном состоянии, без пары «до и после»: признак —
 * **одна запись толщины, чей пролёт частью общий, а частью наружный**. Такую
 * запись пользователь не мог задать осознанно: он назначал толщину границе
 * между двумя комнатами либо наружной стене, но не обоим сразу.
 *
 * Роль считается из полигонов и не требует ни сборки, ни продуктового кода:
 * участок общий, если его накрывает ребро другой комнаты.
 */
const SHARE_TOLERANCE = 1e-6;

const segmentsOfSpace = (space) => {
  const out = [];
  for (const room of space?.rooms || []) {
    const poly = roomPolygon(room);
    if (!poly) continue;
    for (const [a, b] of edgesOf(poly)) out.push({ room: String(room?.id ?? '?'), a, b });
  }
  return out;
};

/** Доля пролёта записи, накрытая ребром ДРУГОЙ комнаты, по точкам выборки. */
const roleProfile = (wall, segments, samples = 41) => {
  const a = point(wall?.a), b = point(wall?.b);
  if (!a || !b) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > SHARE_TOLERANCE)) return null;
  let shared = 0;
  let outer = 0;
  // Концы записи не выбираются: конец — это узел, а не участок. В узле стена
  // законно касается рёбер двух комнат, и включение концов давало «95%
  // наружного» на каждой наружной стене, упирающейся в общую.
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const p = [a[0] + dx * t, a[1] + dy * t];
    // Считаются РАЗНЫЕ комнаты, а не рёбра: в углу одной комнаты точка лежит
    // сразу на двух её рёбрах. Проверено мутантом: после исключения концов
    // (ниже) подсчёт рёбер на реальных планах даёт тот же результат, то есть
    // сам по себе этот выбор не несущий — он оставлен как смысловая страховка,
    // а не как то, чем держится проверка. Мутанта на него не ставлю: он
    // выживает, а выживающий мутант хуже отсутствующего.
    const owners = new Set();
    for (const segment of segments) {
      if (distToSegment(p, segment.a, segment.b) <= SHARE_TOLERANCE) owners.add(segment.room);
    }
    if (owners.size >= 2) shared++;
    else if (owners.size === 1) outer++;
  }
  return { shared, outer, samples: samples - 1 };
};

export function checkMixedRoleRecords(config) {
  const violations = [];
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    const spaceId = String(space?.id ?? '?');
    const segments = segmentsOfSpace(space);
    if (!segments.length) continue;
    for (const wall of space?.walls || []) {
      const profile = roleProfile(wall, segments);
      if (!profile) continue;
      // Оба вида в одной записи, и ни один не является краевым шумом выборки.
      const edge = Math.max(2, Math.round(profile.samples * 0.05));
      if (profile.shared >= edge && profile.outer >= edge) {
        const outerShare = profile.outer / profile.samples;
        violations.push({
          invariant: 'wall_roles', kind: 'mixed_role_record',
          owner: `${spaceId}:${wall?.key ?? '?'}`,
          reference: `${wall?.cm} см`,
          detail: `пролёт записи частью общий, частью наружный`
            + ` (${(outerShare * 100).toFixed(0)}% наружного) — толщина сохранена`
            + ' по ключу, а не по роли ребра',
        });
      }
    }
  }
  return violations;
}

/**
 * Геометрия, которая ничего не рисует, но выключает ручки ресайза (#296).
 *
 * Зачем отдельная проверка. Перегородка, лежащая ровно под стеной комнаты, и
 * черновик из двух точек не видны на плане и не портят ни один снимок модели —
 * ни ключи, ни роли, ни решётку, ни кладку. При этом `resolveSafeResize`
 * законно отказывает по ним `duplicate-physical-wall`, и пользователь получает
 * выключенную ручку с подсказкой про объект, который нельзя ни увидеть, ни
 * выделить, ни удалить. Ни один прежний гейт этого класса не видит: все они
 * измеряют снимок, а эта геометрия снимок не портит.
 *
 * Судится только доказуемое: перекрытие по длине больше шага решётки — то есть
 * не касание углом, — и черновик, который не может стать комнатой ни при какой
 * последующей правке.
 */
const collinearOverlapN = (a, b, c, d) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > GRID_STEP_N)) return 0;
  const ux = dx / length, uy = dy / length;
  const across = (p) => Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux);
  if (across(c) > EDGE_TOLERANCE || across(d) > EDGE_TOLERANCE) return 0;
  const along = (p) => (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
  const lo = Math.max(0, Math.min(along(c), along(d)));
  const hi = Math.min(length, Math.max(along(c), along(d)));
  return Math.max(0, hi - lo);
};

/** Точки черновика как есть: замыкание контура здесь не предполагается. */
const draftSegments = (draft) => {
  const points = Array.isArray(draft?.points) ? draft.points.map(point).filter(Boolean) : [];
  const segments = [];
  for (let i = 0; i + 1 < points.length; i++) segments.push([points[i], points[i + 1]]);
  return { points, segments };
};

export function checkHiddenObstacles(config) {
  const violations = [];
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    const spaceId = String(space?.id ?? '?');
    const edges = [];
    for (const room of space?.rooms || []) {
      const poly = roomPolygon(room);
      if (!poly) continue;
      for (const [a, b] of edgesOf(poly)) edges.push({ a, b, room: String(room?.id ?? '?') });
    }
    const longestOverlap = (a, b) => {
      let best = null;
      for (const edge of edges) {
        const overlap = collinearOverlapN(edge.a, edge.b, a, b);
        if (overlap > GRID_STEP_N && (!best || overlap > best.overlap)) {
          best = { overlap, room: edge.room };
        }
      }
      return best;
    };
    for (const partition of space?.partitions || []) {
      const a = point(partition?.a), b = point(partition?.b);
      if (!a || !b) continue;
      const hit = longestOverlap(a, b);
      if (!hit) continue;
      violations.push({
        invariant: 'hidden_obstacles', kind: 'partition_over_room_wall',
        owner: `${spaceId}:${partition?.id ?? '?'}`,
        reference: `${(hit.overlap / GRID_STEP_N).toFixed(0)} шагов по стене ${hit.room}`,
        detail: 'перегородка лежит на стене комнаты: на плане её не видно,'
          + ' а ресайз этой стены она выключает',
      });
    }
    for (const draft of space?.room_drafts || []) {
      const { points, segments } = draftSegments(draft);
      if (points.length < 3) {
        violations.push({
          invariant: 'hidden_obstacles', kind: 'unusable_draft',
          owner: `${spaceId}:${draft?.id ?? '?'}`,
          reference: `${points.length} точки`,
          detail: 'контур не может стать комнатой ни при какой правке,'
            + ' но препятствием для ресайза остаётся',
        });
        continue;
      }
      for (const [a, b] of segments) {
        const hit = longestOverlap(a, b);
        if (!hit) continue;
        violations.push({
          invariant: 'hidden_obstacles', kind: 'draft_over_room_wall',
          owner: `${spaceId}:${draft?.id ?? '?'}`,
          reference: `${(hit.overlap / GRID_STEP_N).toFixed(0)} шагов по стене ${hit.room}`,
          detail: 'незакрытый контур лежит на стене комнаты и выключает её ресайз',
        });
        break;
      }
    }
  }
  return violations;
}

/** Разобрать runtime-ответы, сырой config и tracked single-space fixtures. */
export function readModel(text) {
  const parsed = JSON.parse(text);
  const source = parsed?.payload?.config ?? parsed?.result?.config ?? parsed?.config ?? parsed;
  const config = !Array.isArray(source?.spaces) && parsed?.space
    ? { spaces: [parsed.space] }
    : source;
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

/** Профиль решётки на языке решения, а не на языке счётчиков (ADR #282). */
function latticeReport(profile) {
  const share = (n) => (profile.total ? `${(n / profile.total * 100).toFixed(2)}%` : '—');
  const lines = [
    `Координат в модели: ${profile.total}.`,
    '',
    `  точно на узле       ${profile.exact} (${share(profile.exact)})`,
    `  шум у узла          ${profile.noise} (${share(profile.noise)})`
      + `  — ближе ${profile.noiseSteps} шага, но не точно`,
    `  законно вне сетки   ${profile.offGrid} (${share(profile.offGrid)})`,
    '',
  ];
  if (profile.worstNoise) {
    const w = profile.worstNoise;
    lines.push(`Худший шум: ${w.owner} по ${w.axis} = ${w.value}`
      + ` — ${w.steps.toExponential(2)} шага от узла.`, '');
  }
  lines.push('По видам объектов (точно / шум / вне сетки):');
  for (const [kind, counts] of Object.entries(profile.byKind)) {
    lines.push(`  ${kind.padEnd(11)} ${counts.exact} / ${counts.noise} / ${counts.offGrid}`);
  }
  lines.push('', 'Шум — это класс дефектов #258/#279/#248: ключ стены попадает не в тот',
    'бакет, Optimize не сходится. «Вне сетки» — законная геометрия нынешней модели.',
    'Стадия 0 ADR #282 измеряет, а не судит: нарушений здесь не бывает.');
  return lines.join('\n');
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
    marker_room: 'Маркеры ссылаются на несуществующие комнаты',
    vacuum_room: 'Сегменты пылесоса ссылаются на несуществующие комнаты',
    marker_control: 'Управление светом ссылается на несовместимый маркер',
    marker_badge: 'Бейдж значения ссылается на несовместимый маркер',
    room_open_to: 'Связи комнат ссылаются на несуществующие комнаты',
    opening_host: 'Проёмы ссылаются на несуществующие стены',
    room_wall_ids: 'Комнаты ссылаются на несуществующие сегменты стен',
    layout_space: 'Позиции ссылаются на несуществующие пространства',
    layout_owner: 'Позиции без владельца',
    wall_carrier: 'Записи толщины вне рёбер и перегородок',
    open_span_carrier: 'Виртуальные проёмы вне границ комнат',
    physical_geometry: 'Небезопасная каноническая геометрия стен',
    geometry_exception: 'Сбой проверки канонической геометрии стен',
    lost: 'Потерянные записи толщины',
    wall_key: 'Записи толщины, которые не найдутся по ключу',
    mixed_role_record: 'Записи толщины, описывающие сразу общую и наружную стену',
    partition_over_room_wall: 'Перегородки, лежащие на стенах комнат',
    draft_over_room_wall: 'Незакрытые контуры, лежащие на стенах комнат',
    unusable_draft: 'Черновики, которые не могут стать комнатой',
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
    console.error('использование: model-invariants.mjs --config <файл> [--layout <файл>]'
      + ' [--lattice|--near-axis] [--json]');
    return 2;
  }
  const model = readModel(readFileSync(configPath, 'utf8'));
  if (arg('--layout')) model.layout = readModel(readFileSync(arg('--layout'), 'utf8')).layout;
  const notes = [];
  if (argv.includes('--lattice')) {
    const profile = latticeProfile(model);
    if (argv.includes('--json')) console.log(JSON.stringify({ lattice: profile }, null, 2));
    else console.log(latticeReport(profile));
    return 0;
  }
  if (argv.includes('--near-axis')) {
    const profile = nearAxisProfile(model.config);
    if (argv.includes('--json')) console.log(JSON.stringify({ nearAxis: profile }, null, 2));
    else {
      console.log(`Почти осевых физических стен: ${profile.total}.`);
      for (const space of profile.spaces.filter((item) => item.count)) {
        console.log(`  ${space.spaceId || '(без id)'}: ${space.count}`);
      }
    }
    return 0;
  }
  const violations = [
    ...checkReferences(model, { notes }),
    ...checkWallKeys(model.config, { notes }),
    ...checkMixedRoleRecords(model.config),
    ...checkHiddenObstacles(model.config),
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
