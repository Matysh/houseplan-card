/**
 * Маппинг модели Sweet Home 3D в документ импорта House Plan (#446).
 *
 * Форма выхода — «v7»: комнаты с полигонами, стены с толщиной, проёмы по
 * координатам. Ни сегментов, ни `wall_ids`, ни хостов проёмов конвертер не
 * строит: их собирает серверный писатель импорта (`commit_wall_segment_model`),
 * тот же, которым едут старые бэкапы. Проверено прогоном: v7 → валидный v9,
 * общая граница двух комнат склеивается в один сегмент, дверь получает хозяина
 * сама. Строить каталог сегментов на стороне сайта означало бы повторить этот
 * алгоритм и разойтись с ним на первом же изменении модели.
 *
 * Главное геометрическое решение: **план строится по комнатам.** Стена в нашей
 * модели существует как ребро контура комнаты (валидатор требует у сегмента
 * одного-двух владельцев-комнат), поэтому стены Sweet Home 3D дают рёбрам
 * только толщину. Уровень, где комнат нет, конвертировать нечем — и это отказ
 * с объяснением, а не пустой план.
 */

export const FORMAT = 'houseplan-export';
export const EXPORT_VERSION = 2;
/** Форма документа: структуру из неё собирает сервер (см. шапку). */
export const MODEL_VERSION = 7;
/** Версия House Plan, на которой проверен путь импорта. */
export const MIN_HOUSEPLAN = '1.71';

/** Сантиметров в клетке. Выбирается из лестницы — «красивый» масштаб читаем. */
export const CELL_LADDER = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 500];
/** Доля единичного квадрата под план: остаток — поля. */
export const TARGET_EXTENT = 0.86;
/** Решётка нашего редактора: 240 клеток на ширину плана. */
export const GRID_N = 240;
/** Сварка вершин: две точки ближе этого считаются одной (см).  */
export const WELD_CM = 1;
/** Допуск привязки вершины к осевой линии стены сверх её полутолщины (см). */
export const SNAP_TOL_CM = 3;
/** Допуск поиска хозяина проёма сверх полутолщины стены (см). */
export const OPENING_TOL_CM = 8;
export const MAX_POLY_POINTS = 500;
export const MIN_THICKNESS_CM = 1;
export const MAX_THICKNESS_CM = 100;

export class ConvertError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// --- геометрия в сантиметрах -------------------------------------------------

const hypot = (dx, dy) => Math.sqrt(dx * dx + dy * dy);

const projectT = (point, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denominator = dx * dx + dy * dy;
  if (denominator <= 1e-18) return 0;
  return ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator;
};

const pointAt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const distanceToLine = (point, a, b) => {
  const t = projectT(point, a, b);
  const foot = pointAt(a, b, t);
  return hypot(point[0] - foot[0], point[1] - foot[1]);
};

const distanceToSegment = (point, a, b) => {
  const t = Math.max(0, Math.min(1, projectT(point, a, b)));
  const foot = pointAt(a, b, t);
  return hypot(point[0] - foot[0], point[1] - foot[1]);
};

const direction = (a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = hypot(dx, dy);
  return length < 1e-12 ? [1, 0] : [dx / length, dy / length];
};

const lineIntersection = (a1, a2, b1, b2) => {
  const [dx1, dy1] = [a2[0] - a1[0], a2[1] - a1[1]];
  const [dx2, dy2] = [b2[0] - b1[0], b2[1] - b1[1]];
  const denominator = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((b1[0] - a1[0]) * dy2 - (b1[1] - a1[1]) * dx2) / denominator;
  return [a1[0] + dx1 * t, a1[1] + dy1 * t];
};

/** Угол между направлениями без учёта знака, 0…90°. */
const angleBetween = (first, second) => {
  const dot = Math.abs(first[0] * second[0] + first[1] * second[1]);
  return Math.acos(Math.min(1, dot)) * (180 / Math.PI);
};

// --- порты серверных формул (совпадать обязаны побайтово) --------------------

const jsRound = (value) => Math.floor(value + 0.5);

/** `canonicalize_number`: одна стабильная запись с девятью знаками. */
export function canonicalizeNumber(value) {
  if (!Number.isFinite(value)) return value;
  const sign = Object.is(value, -0) || value < 0 ? -1 : 1;
  const result = sign * (Math.floor(Math.abs(value) * 1e9 + 0.5) / 1e9);
  return result === 0 ? 0 : result;
}

/** `canonicalize_lattice_coordinate`: шум у узла решётки сваливается в узел. */
export function canonicalizeLattice(value) {
  if (!Number.isFinite(value)) return value;
  const scaled = value * GRID_N;
  const nearest = Math.floor(scaled + 0.5);
  if (Math.abs(scaled - nearest) < 1e-4) {
    const result = nearest / GRID_N;
    return result === 0 ? 0 : result;
  }
  return canonicalizeNumber(value);
}

/** `_wall_key`: квантованная середина и угол — так сервер ищет толщину. */
export function wallKey(a, b) {
  const quantize = (value) => (jsRound(value * GRID_N) / GRID_N);
  const midX = quantize((a[0] + b[0]) / 2);
  const midY = quantize((a[1] + b[1]) / 2);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = hypot(dx, dy);
  let [ux, uy] = length < 1e-12 ? [1, 0] : [dx / length, dy / length];
  if (ux < -1e-12 || (Math.abs(ux) <= 1e-12 && uy < 0)) {
    ux = -ux;
    uy = -uy;
  }
  let angle = Math.atan2(uy, ux);
  if (angle < 0) angle += Math.PI;
  angle = jsRound(angle * 1800) / 1800;
  return `${midX.toFixed(6)},${midY.toFixed(6)}@${angle.toFixed(4)}`;
}

// --- подготовка одного уровня ------------------------------------------------

const weld = (value) => Math.round(value / WELD_CM) * WELD_CM;
const vertexKey = (point) => `${weld(point[0])},${weld(point[1])}`;

/** Привязать вершины комнат к осевым линиям стен и сварить совпадающие. */
function alignRooms(rooms, walls, report) {
  const usable = walls.filter((wall) => hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) > 1e-6);
  let snapped = 0;
  const aligned = rooms.map((room) => ({
    ...room,
    points: room.points.map((point) => {
      const near = usable
        .map((wall) => ({
          wall,
          distance: distanceToSegment(point, wall.a, wall.b),
          reach: (Number.isFinite(wall.thickness) ? wall.thickness : 0) / 2 + SNAP_TOL_CM,
        }))
        .filter((item) => item.distance <= item.reach)
        .sort((first, second) => first.distance - second.distance);
      if (!near.length) return point;
      const first = near[0];
      const crossing = near.find((item) =>
        angleBetween(direction(item.wall.a, item.wall.b), direction(first.wall.a, first.wall.b)) > 20);
      const target = crossing
        ? lineIntersection(first.wall.a, first.wall.b, crossing.wall.a, crossing.wall.b)
          || pointAt(first.wall.a, first.wall.b, projectT(point, first.wall.a, first.wall.b))
        : pointAt(first.wall.a, first.wall.b, projectT(point, first.wall.a, first.wall.b));
      if (hypot(target[0] - point[0], target[1] - point[1]) > 1e-9) snapped += 1;
      return target;
    }),
  }));
  if (snapped) report.push({ code: 'vertices_snapped', count: snapped });
  // Сварка: рёбра двух комнат обязаны совпасть точка-в-точку, иначе общая
  // граница станет двумя параллельными стенами.
  const welded = new Map();
  for (const room of aligned) {
    for (const point of room.points) {
      const key = vertexKey(point);
      if (!welded.has(key)) welded.set(key, [weld(point[0]), weld(point[1])]);
    }
  }
  return aligned.map((room) => ({
    ...room,
    points: room.points.map((point) => welded.get(vertexKey(point))),
  }));
}

/** Убрать нулевые рёбра и дубли; вернуть null, если полигон рассыпался. */
function cleanPolygon(points) {
  const out = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    out.push(point);
  }
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) out.pop();
    else break;
  }
  return out.length >= 3 ? out : null;
}

const edgesOf = (points) =>
  points.map((point, index) => [point, points[(index + 1) % points.length]]);

const spanKey = (a, b) => {
  const first = `${a[0]},${a[1]}`;
  const second = `${b[0]},${b[1]}`;
  return first <= second ? `${first}|${second}` : `${second}|${first}`;
};

/** Толщина ребра: стена, чья осевая линия его накрывает; шире — та, что ближе. */
function thicknessFor(edge, walls) {
  const [a, b] = edge;
  const length = hypot(b[0] - a[0], b[1] - a[1]);
  let best = null;
  for (const wall of walls) {
    if (!Number.isFinite(wall.thickness) || wall.thickness <= 0) continue;
    const reach = wall.thickness / 2 + SNAP_TOL_CM;
    if (distanceToLine(a, wall.a, wall.b) > reach) continue;
    if (distanceToLine(b, wall.a, wall.b) > reach) continue;
    const ta = projectT(a, wall.a, wall.b);
    const tb = projectT(b, wall.a, wall.b);
    const low = Math.max(0, Math.min(ta, tb));
    const high = Math.min(1, Math.max(ta, tb));
    const wallLength = hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    const overlap = Math.max(0, high - low) * wallLength;
    if (overlap < length - 1e-6) continue;
    const score = overlap - distanceToSegment(pointAt(a, b, 0.5), wall.a, wall.b);
    if (!best || score > best.score) best = { score, thickness: wall.thickness };
  }
  return best ? best.thickness : 0;
}

const clampThickness = (cm) =>
  Math.min(MAX_THICKNESS_CM, Math.max(MIN_THICKNESS_CM, canonicalizeNumber(cm)));

/** Масштаб: наименьшая «красивая» клетка, при которой план влезает с полями. */
export function pickCellCm(extentCm) {
  const needed = extentCm / (GRID_N * TARGET_EXTENT);
  return CELL_LADDER.find((cell) => cell >= needed) ?? CELL_LADDER[CELL_LADDER.length - 1];
}

/**
 * Идентификатор: только ASCII. Схема разрешает любой текст, но id уезжает в
 * ключи layout, в DOM и в URL предпросмотра, а кириллица там читается плохо.
 * Имя человека при этом не теряется — оно живёт в `name`/`title`.
 */
const slug = (raw, fallback) => {
  const cleaned = String(raw || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return cleaned || fallback;
};

// --- собственно конверсия ----------------------------------------------------

/**
 * Собрать документы импорта: по одному на уровень.
 * Возвращает `{ documents, report }`; отказы — исключение `ConvertError`.
 */
export function convertHome(home, options = {}) {
  const toolVersion = options.toolVersion || 'sh3d-convert';
  const createdAt = options.now || new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  if (home.unit && !['centimeter', 'millimeter', 'meter'].includes(home.unit)) {
    throw new ConvertError('unit_not_metric',
      `Единицы плана «${home.unit}» не метрические: пересохраните план в сантиметрах`);
  }
  const levels = home.levels.length
    ? [...home.levels].sort((first, second) => first.elevationIndex - second.elevationIndex)
    : [{ id: null, name: home.name, elevation: 0, elevationIndex: 0 }];
  const documents = [];
  const report = { levels: [], items: [], toolVersion, minHouseplan: MIN_HOUSEPLAN };
  const onLevel = (item, level) =>
    item.level === null || item.level === undefined || item.level === level.id
    || (level.id === null && true);

  for (const [index, level] of levels.entries()) {
    const notes = [];
    const rawRooms = home.rooms
      .filter((room) => onLevel(room, level))
      .filter((room) => {
        if (room.points.length >= 3) return true;
        notes.push({ code: 'room_without_polygon', id: room.id });
        return false;
      });
    const walls = home.walls.filter((wall) => onLevel(wall, level));
    const curved = walls.filter((wall) => Math.abs(wall.arcExtent) > 1e-6);
    if (curved.length) notes.push({ code: 'curved_wall_straightened', count: curved.length });
    const thick = walls.filter((wall) => wall.thickness > MAX_THICKNESS_CM);
    if (thick.length) {
      notes.push({ code: 'thickness_clamped', count: thick.length, limit: MAX_THICKNESS_CM });
    }
    if (!rawRooms.length) {
      report.levels.push({
        id: level.id, title: level.name, rooms: 0, walls: 0, openings: 0,
        skipped: 'no_rooms', notes,
      });
      report.items.push({ code: 'level_without_rooms', id: level.id, title: level.name });
      continue;
    }

    const aligned = alignRooms(rawRooms, walls, notes);
    const polygons = [];
    for (const room of aligned) {
      const polygon = cleanPolygon(room.points);
      if (!polygon) {
        notes.push({ code: 'room_collapsed', id: room.id });
        continue;
      }
      if (polygon.length > MAX_POLY_POINTS) {
        throw new ConvertError('room_too_complex',
          `Комната «${room.name || room.id}»: ${polygon.length} вершин, предел ${MAX_POLY_POINTS}`);
      }
      polygons.push({ ...room, points: polygon });
    }
    if (!polygons.length) {
      report.levels.push({
        id: level.id, title: level.name, rooms: 0, walls: 0, openings: 0,
        skipped: 'no_rooms', notes,
      });
      report.items.push({ code: 'level_without_rooms', id: level.id, title: level.name });
      continue;
    }

    // Масштаб и сдвиг: план центрируется в единичном квадрате.
    const xs = polygons.flatMap((room) => room.points.map((point) => point[0]));
    const ys = polygons.flatMap((room) => room.points.map((point) => point[1]));
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const height = Math.max(...ys) - minY;
    if (!(width > 0 && height > 0)) {
      throw new ConvertError('degenerate_level',
        `Уровень «${level.name || level.id}»: у плана нет площади`);
    }
    const cellCm = pickCellCm(Math.max(width, height));
    const unitCm = cellCm * GRID_N;
    const offsetX = (1 - width / unitCm) / 2;
    const offsetY = (1 - height / unitCm) / 2;
    const toNorm = (point) => [
      canonicalizeLattice((point[0] - minX) / unitCm + offsetX),
      canonicalizeLattice((point[1] - minY) / unitCm + offsetY),
    ];

    const rooms = polygons.map((room, roomIndex) => ({
      id: `${slug(room.id, `room-${roomIndex + 1}`)}`,
      name: room.name || `Room ${roomIndex + 1}`,
      poly: room.points.map(toNorm),
    }));

    // Стены: одна запись на уникальное ребро контура. Толщина берётся у стены
    // Sweet Home 3D, накрывающей это ребро; ребро без стены остаётся открытой
    // границей (сервер даст сегменту нулевую толщину).
    const wallByKey = new Map();
    const spanByKey = new Map();
    for (const room of polygons) {
      for (const [a, b] of edgesOf(room.points)) {
        const key = spanKey(a, b);
        if (wallByKey.has(key)) continue;
        const cm = thicknessFor([a, b], walls);
        spanByKey.set(key, { a, b, cm });
        if (cm <= 0) continue;
        const [na, nb] = [toNorm(a), toNorm(b)];
        wallByKey.set(key, { key: wallKey(na, nb), cm: clampThickness(cm), a: na, b: nb });
      }
    }
    const openBoundaries = [...spanByKey.values()].filter((span) => span.cm <= 0).length;
    if (openBoundaries) notes.push({ code: 'edge_without_wall', count: openBoundaries });

    // Проёмы: центр проецируется на ребро, угол берётся у ребра. Полагаться на
    // угол из файла нельзя — в нём иначе заданы единицы, и проверка хоста на
    // сервере допускает расхождение всего 8°.
    const openings = [];
    for (const piece of home.openings.filter((item) => onLevel(item, level))) {
      const width_cm = Number.isFinite(piece.width) && piece.width > 0 ? piece.width : 0;
      if (!width_cm) {
        notes.push({ code: 'opening_without_width', id: piece.id });
        continue;
      }
      let best = null;
      for (const span of spanByKey.values()) {
        if (span.cm <= 0) continue;
        const distance = distanceToSegment([piece.x, piece.y], span.a, span.b);
        if (distance > span.cm / 2 + OPENING_TOL_CM) continue;
        if (!best || distance < best.distance) best = { span, distance };
      }
      if (!best) {
        notes.push({ code: 'opening_unhosted', id: piece.id, kind: piece.kind });
        continue;
      }
      const { a, b } = best.span;
      const spanLength = hypot(b[0] - a[0], b[1] - a[1]);
      const length_cm = Math.min(width_cm, spanLength);
      if (length_cm < width_cm - 1e-6) {
        notes.push({ code: 'opening_shortened', id: piece.id });
      }
      const half = length_cm / 2;
      const raw = projectT([piece.x, piece.y], a, b) * spanLength;
      const centreAlong = Math.min(spanLength - half, Math.max(half, raw));
      const centre = pointAt(a, b, spanLength > 0 ? centreAlong / spanLength : 0.5);
      const [na, nb] = [toNorm(a), toNorm(b)];
      const [nc] = [toNorm(centre)];
      const angle = canonicalizeNumber(
        Math.atan2(nb[1] - na[1], nb[0] - na[0]) * (180 / Math.PI));
      openings.push({
        id: `${slug(piece.id, `opening-${openings.length + 1}`)}`,
        type: piece.kind,
        x: nc[0],
        y: nc[1],
        angle,
        length: canonicalizeNumber(length_cm / unitCm),
      });
    }

    const polyPoints = rooms.flatMap((room) => room.poly);
    const boxMinX = Math.min(...polyPoints.map((point) => point[0]));
    const boxMinY = Math.min(...polyPoints.map((point) => point[1]));
    const boxMaxX = Math.max(...polyPoints.map((point) => point[0]));
    const boxMaxY = Math.max(...polyPoints.map((point) => point[1]));
    const margin = 0.02;
    const space = {
      id: `sh3d-${index + 1}-${slug(level.name || home.name, `level-${index + 1}`)}`,
      title: level.name || home.name || `Level ${index + 1}`,
      cell_cm: cellCm,
      view_box: [
        canonicalizeNumber(boxMinX - margin),
        canonicalizeNumber(boxMinY - margin),
        canonicalizeNumber(boxMaxX - boxMinX + margin * 2),
        canonicalizeNumber(boxMaxY - boxMinY + margin * 2),
      ],
      rooms,
      ...(wallByKey.size ? { walls: [...wallByKey.values()] } : {}),
      ...(openings.length ? { openings } : {}),
    };
    documents.push({
      format: FORMAT,
      export_version: EXPORT_VERSION,
      kind: 'space',
      created_at: createdAt,
      card_version: toolVersion,
      integration_version: toolVersion,
      model_version: MODEL_VERSION,
      payload: { config: { spaces: [space], markers: [] }, layout: {} },
      placement_manifest: [],
      content_manifest: [],
      transfer: { plan_only: true },
    });
    report.levels.push({
      id: level.id,
      title: space.title,
      spaceId: space.id,
      cellCm: cellCm,
      rooms: rooms.length,
      walls: wallByKey.size,
      openings: openings.length,
      notes,
    });
  }

  if (!documents.length) {
    throw new ConvertError('nothing_to_convert',
      'В плане нет ни одной комнаты: House Plan строит геометрию по комнатам, '
      + 'нарисуйте их в Sweet Home 3D и сохраните файл заново');
  }
  // Мебель и прочее не читается вовсе — но человек должен знать, что её нет.
  report.items.push({ code: 'furniture_dropped' });
  return { documents, report };
}
