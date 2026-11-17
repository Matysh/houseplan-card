import { IfcError } from './ifc-errors.mjs';
import { ifcText, value } from './ifc-read.mjs';
import { cross3, distance, EPS, horizontal, multiply, project, sub, transform, unit, validPolygon } from './ifc-math.mjs';

const xy = poly => poly.map(p => p.slice(0, 2));
const clean = poly => {
  const points = [...poly];
  if (points.length > 1 && distance(points[0], points.at(-1)) < EPS) points.pop();
  return points;
};
const fail = reason => { throw new IfcError(reason || 'ifc_geometry_unsupported'); };
export const sourceInfo = (reader, element, kind) => ({ sourceId: element.expressID,
  guid: ifcText(element.GlobalId), name: ifcText(element.LongName) || ifcText(element.Name),
  number: ifcText(element.Name), type: reader.type(element), kind });

function rectangle(poly) {
  poly = clean(poly);
  if (poly.length !== 4 || !validPolygon(xy(poly))) fail();
  const lengths = poly.map((p, i) => distance(p, poly[(i + 1) % 4]));
  if (Math.abs(lengths[0] - lengths[2]) > .001 || Math.abs(lengths[1] - lengths[3]) > .001) fail();
  const a = sub(poly[1], poly[0]), b = sub(poly[2], poly[1]);
  if (Math.abs(a.reduce((n, v, i) => n + v * b[i], 0)) > EPS) fail();
  const longer = lengths[0] > lengths[1] ? 0 : 1;
  if (Math.abs(lengths[0] - lengths[1]) < .001) fail('ifc_wall_ambiguous');
  const midpoint = (i, j) => poly[i].map((p, k) => (p + poly[j][k]) / 2);
  return longer === 0 ? { a: midpoint(0, 3), b: midpoint(1, 2), thickness: lengths[1] }
    : { a: midpoint(0, 1), b: midpoint(3, 2), thickness: lengths[0] };
}

/** Only horizontal half-space clipping leaves a constant plan footprint. */
function solid(reader, item, matrix) {
  if (reader.type(item) !== 'IFCBOOLEANCLIPPINGRESULT') return reader.extrusion(item, matrix);
  if (ifcText(item.Operator) !== 'DIFFERENCE') fail();
  const cutter = reader.get(item.SecondOperand);
  if (reader.type(cutter) !== 'IFCHALFSPACESOLID') fail();
  const plane = reader.get(cutter.BaseSurface);
  if (reader.type(plane) !== 'IFCPLANE') fail();
  const pm = multiply(matrix, reader.axis(plane.Position));
  if (!horizontal(pm)) fail();
  const result = solid(reader, reader.get(item.FirstOperand), matrix);
  const z = transform(pm, [0, 0, 0])[2], normal = transform(pm, [0, 0, 1], true)[2];
  const removePositive = value(cutter.AgreementFlag) === true || value(cutter.AgreementFlag) === 'T';
  if ((normal > 0) === removePositive) result.zMax = Math.min(result.zMax, z);
  else result.zMin = Math.max(result.zMin, z);
  if (result.zMax - result.zMin <= EPS) fail();
  return result;
}

function bodySolids(reader, element) {
  const matrix = reader.matrix(element);
  if (!horizontal(matrix)) fail();
  const bodies = reader.representations(element).filter(r => ifcText(r.RepresentationIdentifier).toLowerCase() === 'body');
  return bodies.flatMap(r => reader.items(r, matrix)).map(({ item, matrix: m }) => ({
    ...solid(reader, item, m), layerScale: Math.hypot(...transform(m, [0, 1, 0], true)),
  }));
}

export function readWall(reader, element, material) {
  const matrix = reader.matrix(element);
  if (!horizontal(matrix)) fail();
  const axes = reader.representations(element).filter(r => ifcText(r.RepresentationIdentifier).toLowerCase() === 'axis');
  const lines = axes.flatMap(r => reader.items(r, matrix)).map(({ item, matrix: m }) => {
    if(!horizontal(m))fail();
    const points = reader.curves(item, m), straight = [];
    // Interior points on one straight reference line are not wall ends.
    // Retain actual bends and reversals; never approximate a curved axis.
    for(const point of points){
      while(straight.length>1){
        const a=straight.at(-2),b=straight.at(-1);
        const length=distance(a,point);
        if(length<=EPS||Math.hypot(...cross3(sub(point,a),sub(b,a)))/length>EPS
          ||distance(a,b)+distance(b,point)-length>EPS)break;
        straight.pop();
      }
      straight.push(point);
    }
    return { points: straight, matrix: m };
  });
  let layer = null;
  if (material && reader.type(material) === 'IFCMATERIALLAYERSETUSAGE') {
    const set = reader.get(material.ForLayerSet);
    const thickness = set.MaterialLayers.reduce((n, ref) => n + reader.number(reader.get(ref).LayerThickness) * reader.scale, 0);
    if (ifcText(material.LayerSetDirection) !== 'AXIS2' || !(thickness > 0)) fail();
    const sign = ifcText(material.DirectionSense) === 'NEGATIVE' ? -1 : 1;
    const offset = reader.number(material.OffsetFromReferenceLine) * reader.scale + sign * thickness / 2;
    layer = { thickness, offset };
  }
  let body, bodies, bodyError;
  try { bodies = bodySolids(reader, element); if (bodies.length === 1) body = { ...bodies[0], ...rectangle(bodies[0].poly) }; }
  catch (error) { if (['ifc_placement_cycle','ifc_invalid_number','ifc_invalid_reference'].includes(error.code)) throw error; bodyError = error.code; }
  if (body && layer && Math.abs(body.thickness - layer.thickness * body.layerScale) > .001) fail('ifc_thickness_conflict');
  // A trustworthy Axis/layer definition is the construction reference. The
  // rectangle body is a fallback, and can independently provide height.
  if (!lines.length || !layer) {
    if(body)return [{ a: body.a.slice(0, 2), b: body.b.slice(0, 2), cm: body.thickness * 100, zMin: body.zMin, zMax: body.zMax }];
    fail(bodyError);
  }
  const walls = [];
  for (const { points, matrix: lineMatrix } of lines) for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i][2] - points[i - 1][2]) > .001 || distance(points[i], points[i - 1]) < EPS) fail();
    const shift=transform(lineMatrix,[0,layer.offset,0],true);
    const shifted = [points[i - 1], points[i]].map(p => p.map((v, k) => v + shift[k]).slice(0, 2));
    walls.push({ a: shifted[0], b: shifted[1], cm: layer.thickness * Math.hypot(...transform(lineMatrix,[0,1,0],true)) * 100,
      zMin: bodies?.length === 1 ? bodies[0].zMin : null, zMax: bodies?.length === 1 ? bodies[0].zMax : null });
  }
  return walls;
}

export function readSpace(reader, element) {
  const matrix = reader.matrix(element);
  if (!horizontal(matrix)) fail();
  const footprints = reader.representations(element).filter(r => ifcText(r.RepresentationIdentifier).toLowerCase() === 'footprint');
  const curves = footprints.flatMap(r => reader.items(r, matrix)).flatMap(({ item, matrix: m }) => {
    if (['IFCGEOMETRICCURVESET', 'IFCGEOMETRICSET'].includes(reader.type(item))) return item.Elements.map(ref => reader.curves(ref, m));
    return [reader.curves(item, m)];
  });
  let polygons = curves;
  if (!polygons.length) polygons = bodySolids(reader, element).map(s => s.poly);
  if (polygons.length !== 1) fail('ifc_room_holes');
  const poly3 = clean(polygons[0]);
  if (poly3.some(p => Math.abs(p[2] - poly3[0][2]) > .001)) fail();
  const poly = xy(poly3);
  if (!validPolygon(poly)) fail('ifc_room_invalid');
  return poly;
}

export function readOpening(reader, opening, wall) {
  const items = reader.representations(opening).filter(r => ifcText(r.RepresentationIdentifier).toLowerCase() === 'body')
    .flatMap(r => reader.items(r, reader.matrix(opening)));
  if (!items.length || items.length > 16) fail();
  const u = unit(sub(wall.b, wall.a));
  const prisms = items.map(({ item, matrix }) => {
    if (reader.type(item) !== 'IFCEXTRUDEDAREASOLID') fail();
    const m = multiply(matrix, reader.axis(item.Position)), base = clean(reader.profile(item.SweptArea, m));
    if (base.length !== 4) fail();
    const depth = reader.number(item.Depth) * reader.scale;
    if (!(depth > EPS)) fail();
    const delta = transform(m, reader.direction(item.ExtrudedDirection, [0, 0, 1]), true).map(v => v * depth);
    for (const edge of [sub(base[1], base[0]), sub(base[2], base[1]), delta].map(unit)) {
      const components = [Math.abs(edge[0] * u[0] + edge[1] * u[1]), Math.abs(-edge[0] * u[1] + edge[1] * u[0]), Math.abs(edge[2])];
      if (Math.max(...components) < 1 - 1e-6) fail();
    }
    return [...base, ...base.map(p => p.map((v, i) => v + delta[i]))];
  });
  const ranges = prisms.map(points => {
    const along = points.map(p => (p[0] - wall.a[0]) * u[0] + (p[1] - wall.a[1]) * u[1]);
    const lateral = points.map(p => -(p[0] - wall.a[0]) * u[1] + (p[1] - wall.a[1]) * u[0]);
    return [Math.min(...along), Math.max(...along), Math.min(...points.map(p => p[2])), Math.max(...points.map(p => p[2])), Math.min(...lateral), Math.max(...lateral)];
  });
  if (ranges.some(r => r.slice(0, 4).some((v, i) => Math.abs(v - ranges[0][i]) > .001))) fail();
  const lateralRanges = ranges.map(r => r.slice(4)).sort((a,b) => a[0] - b[0]);
  let end = lateralRanges[0][1];
  for (const [lo, hi] of lateralRanges.slice(1)) { if (lo > end + .001) fail(); end = Math.max(end, hi); }
  const poly = prisms.flat();
  const ts = poly.map(p => (p[0] - wall.a[0]) * u[0] + (p[1] - wall.a[1]) * u[1]);
  const low = Math.min(...ts), high = Math.max(...ts), middle = (low + high) / 2;
  if (!(high - low > EPS)) fail();
  const centre = [wall.a[0] + u[0] * middle, wall.a[1] + u[1] * middle];
  // The void must actually intersect the wall, not merely project onto it.
  const lateral = poly.map(p => -(p[0] - wall.a[0]) * u[1] + (p[1] - wall.a[1]) * u[0]);
  if (Math.min(...lateral) > wall.cm / 200 + .001 || Math.max(...lateral) < -wall.cm / 200 - .001) fail('ifc_opening_host');
  return { x: centre[0], y: centre[1], length: high - low, angle: Math.atan2(u[1], u[0]) * 180 / Math.PI,
    zMin: Math.min(...poly.map(p => p[2])), zMax: Math.max(...poly.map(p => p[2])) };
}

/** Unsupported walls still need a conservative extent for room exclusion. */
export function wallEnvelope(reader, element) {
  try {
    const matrix = reader.matrix(element);
    for (const rep of reader.representations(element)) for (const { item, matrix: m } of reader.items(rep, matrix)) {
      if (reader.type(item) !== 'IFCBOUNDINGBOX') continue;
      const a = reader.point(item.Corner), dims = [item.XDim, item.YDim, item.ZDim].map(v => reader.number(v) * reader.scale);
      const corners = [];
      for (const x of [0, dims[0]]) for (const y of [0, dims[1]]) for (const z of [0, dims[2]]) corners.push(transform(m, [a[0] + x, a[1] + y, a[2] + z]));
      return { minX: Math.min(...corners.map(p => p[0])), maxX: Math.max(...corners.map(p => p[0])),
        minY: Math.min(...corners.map(p => p[1])), maxY: Math.max(...corners.map(p => p[1])) };
    }
  } catch (error) { if (error.code === 'ifc_placement_cycle') throw error; }
  return null;
}
