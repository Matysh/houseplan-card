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
    return 'Инварианты выполнены: неразрешимых ссылок не найдено.' + tail;
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
  const violations = checkReferences(model, { notes });
  if (argv.includes('--json')) console.log(JSON.stringify({ violations, notes }, null, 2));
  else console.log(report(violations, notes));
  // Код возврата — не приговор конфигурации пользователя, а сигнал для CI.
  return violations.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
