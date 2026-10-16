import { EasyInputError } from './easy-read.mjs';
import { wallKey } from './geometry-runtime.generated.mjs';
import { CELL_LADDER, GRID_N, TARGET_EXTENT } from './units.mjs';

const EPS = 1e-8;
const round = (value) => Math.round(value * 1e9) / 1e9 || 0;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const edges = (poly) => poly.map((a, index) => [a, poly[(index + 1) % poly.length]]);
const fail = (code, path) => { throw new EasyInputError(code, path); };

export function numberAt(value, path, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('easy_invalid_number', path);
  return value;
}

export function makeIds(prefix) {
  const used = new Set();
  return (kind, original, index = 0) => {
    const stem = String(original ?? index).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 35) || String(index);
    const base = `${prefix}-${kind}-${stem}`;
    let value = base, suffix = 1;
    while (used.has(value)) value = `${base}-${suffix++}`;
    used.add(value);
    return value;
  };
}

const projection = (p, a, b) => {
  const delta = subtract(b, a), length2 = delta[0] ** 2 + delta[1] ** 2;
  return ((p[0] - a[0]) * delta[0] + (p[1] - a[1]) * delta[1]) / length2;
};
const onLine = (p, a, b) => Math.abs(cross(subtract(p, a), subtract(b, a))) / distance(a, b) <= EPS;

function intersection(a, b, c, d) {
  const first = subtract(b, a), second = subtract(d, c), delta = subtract(c, a);
  const denominator = cross(first, second);
  if (Math.abs(denominator) <= EPS) return null;
  return [cross(delta, second) / denominator, cross(delta, first) / denominator];
}

function validPolygon(poly, path) {
  if (poly.length < 3 || poly.length > 500) fail('easy_invalid_polygon', path);
  const area = edges(poly).reduce((sum, [a, b]) => sum + a[0] * b[1] - b[0] * a[1], 0);
  if (Math.abs(area) <= EPS) fail('easy_invalid_polygon', path);
  const segments = edges(poly);
  for (let i = 0; i < segments.length; i++) {
    if (distance(...segments[i]) <= EPS) fail('easy_invalid_polygon', path);
    for (let j = i + 2; j < segments.length; j++) {
      if (i === 0 && j === segments.length - 1) continue;
      const [a, b] = segments[i], [c, d] = segments[j];
      const hit = intersection(a, b, c, d);
      if (hit && hit.every(t => t >= -EPS && t <= 1 + EPS)) fail('easy_self_intersection', path);
      if (!hit && onLine(c, a, b) && onLine(d, a, b)) {
        const lo = Math.max(0, Math.min(projection(c, a, b), projection(d, a, b)));
        const hi = Math.min(1, Math.max(projection(c, a, b), projection(d, a, b)));
        if (hi >= lo - EPS) fail('easy_self_intersection', path);
      }
    }
  }
}

/** Split at real T/X intersections and overlap ends; deduplicate equal atoms. */
export function atomizeSourceWalls(walls) {
  const cuts = walls.map(() => new Set([0, 1]));
  let count = walls.length * 2;
  const add = (index, t) => {
    if (t < -EPS || t > 1 + EPS) return;
    // Do not round a parameter before interpolation: 5/7 rounded to nine
    // places would turn a shared endpoint 10 into 9.999999998 on one carrier.
    const value = Math.max(0, Math.min(1, t));
    if (![...cuts[index]].some(previous => Math.abs(previous - value) <= EPS)) {
      cuts[index].add(value);
      if (++count > 20000) fail('easy_too_complex', 'wall intersections');
    }
  };
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    if (distance(a.a, a.b) <= EPS) fail('easy_zero_wall', a.id);
    for (let j = i + 1; j < walls.length; j++) {
      const b = walls[j], hit = intersection(a.a, a.b, b.a, b.b);
      if (hit) {
        if (hit.every(t => t >= -EPS && t <= 1 + EPS)) { add(i, hit[0]); add(j, hit[1]); }
      } else if (onLine(b.a, a.a, a.b) && onLine(b.b, a.a, a.b)) {
        add(i, projection(b.a, a.a, a.b)); add(i, projection(b.b, a.a, a.b));
        add(j, projection(a.a, b.a, b.b)); add(j, projection(a.b, b.a, b.b));
      }
    }
  }
  const atoms = new Map();
  for (const [index, wall] of walls.entries()) {
    const stops = [...cuts[index]].sort((a, b) => a - b);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = at(wall.a, wall.b, stops[i]).map(round), b = at(wall.a, wall.b, stops[i + 1]).map(round);
      if (distance(a, b) <= EPS) continue;
      const labels = [JSON.stringify(a), JSON.stringify(b)].sort();
      const key = labels.join('|'), previous = atoms.get(key);
      if (previous && Math.abs(previous.cm - wall.cm) > EPS) fail('easy_thickness_conflict', wall.id);
      if (!previous) atoms.set(key, { ...wall, id: `${wall.id}-${i}`, a, b });
      if (atoms.size > 5000) fail('easy_too_complex', 'wall atoms');
    }
  }
  return [...atoms.values()];
}

export function readFloorGeometry(floor, { ids, cmPerUnit, notes }) {
  const rooms = (floor.areas || []).map((area, index) => {
    if (!Array.isArray(area.points)) fail('easy_invalid_polygon', `areas[${index}].points`);
    const poly = area.points.map((p, i) => [numberAt(p?.x, `areas[${index}].points[${i}].x`), numberAt(p?.y, `areas[${index}].points[${i}].y`)]);
    if (poly.length > 1 && distance(poly[0], poly.at(-1)) <= EPS) poly.pop();
    validPolygon(poly, `areas[${index}]`);
    return { id: ids('room', area.id, index), source: area, poly };
  });
  const walls = [];
  const pushWall = (source, a, b, id) => {
    if (source.kind === 'railing') { notes.push({ code: 'railing_skipped', id }); return; }
    const thickness = numberAt(source.thickness, `${id}.thickness`, 8);
    const effective = Math.max(2, Math.min(10, thickness)); // pinned Easy renderer's actual range
    const cm = source.divider ? 0 : Math.max(1, Math.min(100, round(effective * cmPerUnit)));
    if (effective !== thickness) notes.push({ code: 'source_thickness_clamped', id });
    if (!source.divider && Math.abs(cm - effective * cmPerUnit) > EPS)
      notes.push({ code: 'thickness_clamped', id, count: 1, limit: 100 });
    walls.push({ id: ids('wall', id, walls.length), a, b, cm });
  };
  for (const [index, wall] of (floor.walls || []).entries()) {
    const id = wall.id || `wall-${index}`;
    pushWall(wall, [numberAt(wall.x1, `${id}.x1`), numberAt(wall.y1, `${id}.y1`)],
      [numberAt(wall.x2, `${id}.x2`), numberAt(wall.y2, `${id}.y2`)], id);
  }
  for (const room of rooms) {
    const sides = room.source.sideWalls;
    if (sides === undefined) continue;
    if (!sides || typeof sides !== 'object' || Array.isArray(sides)) fail('easy_invalid_side_walls', room.id);
    const p = room.poly;
    const rectangle = p.length === 4 && p[0][1] === p[1][1] && p[1][0] === p[2][0]
      && p[2][1] === p[3][1] && p[3][0] === p[0][0] && p[0][0] < p[1][0] && p[0][1] < p[3][1];
    if (!rectangle) { notes.push({ code: 'side_walls_skipped', id: room.id }); continue; }
    for (const [index, name] of ['top', 'right', 'bottom', 'left'].entries()) {
      const value = sides[name];
      if (value === undefined || value === 'none') continue;
      if (!['wall', 'divider'].includes(value)) fail('easy_invalid_side_walls', room.id);
      pushWall({ divider: value === 'divider' }, p[index], p[(index + 1) % 4], `${room.id}-${name}`);
    }
  }
  return { rooms, walls: atomizeSourceWalls(walls) };
}

export function frameForEasy(config, floors, geometry, cmPerUnit) {
  const points = geometry.flatMap(g => [...g.rooms.flatMap(r => r.poly), ...g.walls.flatMap(w => [w.a, w.b])]);
  for (const floor of floors) {
    for (const key of ['items', 'texts', 'openings', 'furniture']) for (const item of floor[key] || []) {
      const x = numberAt(item.x, `${key}.${item.id}.x`), y = numberAt(item.y, `${key}.${item.id}.y`);
      points.push([x, y]);
      if (key === 'items' && item.glow === true && item.stripLength > 0) {
        const length = numberAt(item.stripLength, `items.${item.id}.stripLength`);
        const angle = numberAt(item.stripAngle, `items.${item.id}.stripAngle`, 0) * Math.PI / 180;
        for (const sign of [-1, 1]) points.push([x + sign * length * Math.cos(angle) / 2, y + sign * length * Math.sin(angle) / 2]);
      }
      if (key === 'furniture') {
        const w = numberAt(item.w, `furniture.${item.id}.w`), h = numberAt(item.h, `furniture.${item.id}.h`);
        if (!(w > 0 && h > 0)) fail('easy_invalid_size', `furniture.${item.id}`);
        const angle = numberAt(item.angle, `furniture.${item.id}.angle`, 0) * Math.PI / 180;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) points.push([
          x + Math.cos(angle) * sx * w / 2 - Math.sin(angle) * sy * h / 2,
          y + Math.sin(angle) * sx * w / 2 + Math.cos(angle) * sy * h / 2,
        ]);
      }
    }
    if (floor.image) points.push([0, 0], [config.width ?? 1000, config.height ?? 600]);
  }
  if (!points.length) fail('easy_nothing_to_convert', '$');
  if (points.every(p => distance(p, points[0]) <= EPS))
    points.push([0, 0], [config.width ?? 1000, config.height ?? 600]);
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const maxX = Math.max(...points.map(p => p[0])), maxY = Math.max(...points.map(p => p[1]));
  const extent = Math.max(maxX - minX, maxY - minY) * cmPerUnit;
  if (!(extent > 0 && Number.isFinite(extent))) fail('easy_invalid_size', 'bounds');
  const cellCm = CELL_LADDER.find(cell => cell * GRID_N * TARGET_EXTENT >= extent) ?? CELL_LADDER.at(-1);
  const scale = cmPerUnit / (cellCm * GRID_N);
  if (!Number.isFinite(scale) || Math.max(maxX - minX, maxY - minY) * scale > 4999)
    fail('easy_invalid_size', 'bounds');
  const shiftX = (1 - (maxX - minX) * scale) / 2 - minX * scale;
  const shiftY = (1 - (maxY - minY) * scale) / 2 - minY * scale;
  const point = p => [round(p[0] * scale + shiftX), round(p[1] * scale + shiftY)];
  return { cellCm, scale, point, size: value => round(value * scale),
    viewBox: [...point([minX, minY]).map(v => round(v - 0.02)),
      round((maxX - minX) * scale + 0.04), round((maxY - minY) * scale + 0.04)] };
}

/** Remove only contour-covered intervals, never an independent remainder. */
export function projectFloorGeometry(geometry, frame, ids) {
  const rooms = geometry.rooms.map(room => ({ ...room, poly: room.poly.map(frame.point) }));
  const contours = rooms.flatMap(room => edges(room.poly));
  const walls = [], partitions = [];
  for (const source of geometry.walls) {
    const a = frame.point(source.a), b = frame.point(source.b);
    if (distance(a, b) <= EPS) fail('easy_zero_wall', source.id);
    if (source.cm > 0) walls.push({ key: wallKey(a, b, 1 / GRID_N), a, b, cm: source.cm });
    const covered = contours.filter(([c, d]) => onLine(c, a, b) && onLine(d, a, b)).map(([c, d]) =>
      [Math.max(0, Math.min(projection(c, a, b), projection(d, a, b))), Math.min(1, Math.max(projection(c, a, b), projection(d, a, b)))])
      .filter(([lo, hi]) => hi - lo > EPS).sort((x, y) => x[0] - y[0]);
    let cursor = 0;
    const add = (lo, hi) => {
      if (hi - lo <= EPS) return;
      partitions.push({ id: ids('partition', source.id, partitions.length),
        a: at(a, b, lo).map(round), b: at(a, b, hi).map(round), cm: source.cm });
    };
    for (const [lo, hi] of covered) { add(cursor, lo); cursor = Math.max(cursor, hi); }
    add(cursor, 1);
  }
  return { rooms, walls, partitions };
}
