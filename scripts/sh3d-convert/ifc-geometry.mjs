/** Match actual room faces to wall axes; never use the SH3D centimetre snap. */
import { IfcError } from './ifc-errors.mjs';
import { distance, EPS, intersectLines, project, sub, unit, validPolygon } from './ifc-math.mjs';

const MM = .001;
const midpoint = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const parallel = (a, b, c, d) => {
  const u = unit(sub(b, a)), v = unit(sub(d, c));
  return Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-6;
};
const overlap = (a, b, c, d) => {
  const t1 = project(c, a, b).t, t2 = project(d, a, b).t;
  return [Math.max(0, Math.min(t1, t2)), Math.min(1, Math.max(t1, t2))];
};
function covers(intervals, length) {
  let end = 0;
  for (const [lo, hi] of intervals.sort((a, b) => a[0] - b[0])) {
    if (lo - end > MM / length) return false;
    end = Math.max(end, hi);
  }
  return (1 - end) * length <= MM;
}
function envelopeTouches(poly, box) {
  if (!box) return true; // an unknown body cannot prove an open boundary
  return Math.max(...poly.map(p => p[0])) >= box.minX - MM && Math.min(...poly.map(p => p[0])) <= box.maxX + MM
    && Math.max(...poly.map(p => p[1])) >= box.minY - MM && Math.min(...poly.map(p => p[1])) <= box.maxY + MM;
}
/** Join axes only where the physical wall footprints touch; not a wide snap. */
export function joinIfcAxes(walls) {
  const result = walls.map(w => ({ ...w, a: [...w.a], b: [...w.b] }));
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j], hit = intersectLines(a.a, a.b, b.a, b.b);
    if (!hit || !a.cm || !b.cm) continue;
    const ta = project(hit, a.a, a.b).t, tb = project(hit, b.a, b.b).t;
    const da = Math.max(0, -ta, ta - 1) * distance(a.a, a.b), db = Math.max(0, -tb, tb - 1) * distance(b.a, b.b);
    if (da > b.cm / 200 + MM || db > a.cm / 200 + MM) continue;
    if (ta < 0) result[i].a = hit; else if (ta > 1) result[i].b = hit;
    if (tb < 0) result[j].a = hit; else if (tb > 1) result[j].b = hit;
  }
  return result;
}
export function alignIfcRoom(poly, walls, unsupportedWalls = []) {
  if (!validPolygon(poly)) throw new IfcError('ifc_room_invalid');
  if (unsupportedWalls.some(w => envelopeTouches(poly, w.envelope))) throw new IfcError('ifc_room_boundary');
  // A single FootPrint edge may contain a physical wall followed by an open
  // boundary. Split it at proven wall extents before assigning thickness.
  poly = poly.flatMap((a, i) => {
    const b = poly[(i + 1) % poly.length], length = distance(a,b), stops = [0];
    for (const wall of walls) {
      if (!parallel(a,b,wall.a,wall.b)) continue;
      const d = project(a,wall.a,wall.b).distance;
      if (d > MM && Math.abs(d-wall.cm/200) > MM) continue;
      for (const point of [wall.a,wall.b]) {
        const t = project(point,a,b).t;
        if (t*length > MM && (1-t)*length > MM && !stops.some(s => Math.abs(s-t)*length < MM)) stops.push(t);
      }
    }
    return stops.sort((x,y)=>x-y).map(t => a.map((v,k)=>v+(b[k]-v)*t));
  });
  const lines = [], virtual = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], length = distance(a, b), groups = [];
    let blocked = false;
    for (const wall of walls) {
      if (!parallel(a, b, wall.a, wall.b)) continue;
      const span = overlap(a, b, wall.a, wall.b);
      if (span[1] - span[0] <= EPS) continue;
      const d = project(midpoint(a, b), wall.a, wall.b).distance;
      if (d <= wall.cm / 200 + MM) blocked = true;
      if (d > MM && Math.abs(d - wall.cm / 200) > MM) continue;
      let group = groups.find(g => project(wall.a, g.wall.a, g.wall.b).distance < MM && Math.abs(g.wall.cm - wall.cm) < 1e-5);
      if (!group) { group = { wall, intervals: [] }; groups.push(group); }
      group.intervals.push(span);
    }
    const matches = groups;
    if (matches.length > 1 || !matches.length && (blocked || groups.length)) throw new IfcError('ifc_room_boundary');
    if (matches.length) {
      const wall = matches[0].wall;
      lines.push({ a: wall.a, b: wall.b, cm: wall.cm, sources: matches[0] });
    } else { lines.push({ a, b, cm: 0 }); virtual.push(i); }
  }
  // Open-plan contours may continue an inner wall face into a virtual edge.
  // Carry that same reference-line shift through a collinear run, keeping cm=0.
  // Otherwise its meeting with the physical axis would be two parallel lines.
  for (const index of virtual) {
    const sources = [];
    for (const direction of [-1, 1]) {
      let cursor = (index + direction + lines.length) % lines.length;
      while (cursor !== index && parallel(poly[index], poly[(index + 1) % poly.length], poly[cursor], poly[(cursor + 1) % poly.length])) {
        if (lines[cursor].cm > 0) { sources.push(lines[cursor]); break; }
        cursor = (cursor + direction + lines.length) % lines.length;
      }
    }
    if (sources.length > 1 && project(sources[0].a, sources[1].a, sources[1].b).distance > MM) throw new IfcError('ifc_room_boundary');
    if (sources.length) lines[index] = { a: sources[0].a, b: sources[0].b, cm: 0 };
  }
  const result = poly.map((p, i) => {
    const previous = lines[(i + lines.length - 1) % lines.length], current = lines[i];
    const hit = intersectLines(previous.a, previous.b, current.a, current.b);
    if (hit) return hit;
    if (project(previous.a, current.a, current.b).distance > MM) throw new IfcError('ifc_room_boundary');
    return project(p, current.a, current.b).point;
  });
  const segments = result.map((a, i) => {
    const b = result[(i + 1) % result.length], line = lines[i];
    if (line.sources && distance(a, b) > EPS) {
      const same = walls.filter(w => Math.abs(w.cm - line.cm) < 1e-5 && parallel(a,b,w.a,w.b) && project(w.a,a,b).distance < MM);
      if (!covers(same.map(w => overlap(a,b,w.a,w.b)).filter(([lo,hi]) => hi > lo), distance(a,b))) throw new IfcError('ifc_room_boundary', `Uncovered edge ${i + 1}`);
    }
    return { a, b, cm: line.cm };
  }).filter(w => distance(w.a, w.b) > EPS);
  const cleaned = segments.map(w => w.a);
  if (!validPolygon(cleaned)) throw new IfcError('ifc_room_invalid');
  return { poly: cleaned, walls: segments, virtual };
}
