/** IFC access is lazy and bounded. No meshes, registry, DOM or URL loaders. */
import { createIfcEngine } from './vendor/ifc/engine.mjs';
import { IfcError, MAX_IFC_BYTES } from './ifc-errors.mjs';
import { axes, cross3, dot, EPS, horizontal, identity, inverse, multiply, transform, unit } from './ifc-math.mjs';

export const value = x => x && typeof x === 'object' && 'value' in x ? x.value : x;
const num = x => {
  const n = value(x);
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new IfcError('ifc_invalid_number');
  return n;
};
const name = x => String(value(x) ?? '');
export function validateIfcBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new IfcError('ifc_invalid_file');
  if (bytes.length > MAX_IFC_BYTES) throw new IfcError('ifc_file_too_large');
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  if (!/^\s*(?:\uFEFF)?ISO-10303-21\s*;/i.test(header)) throw new IfcError('ifc_invalid_file');
  let schema = null;
  // Inspect tokens outside STEP comments/strings. A label in a description is
  // not a FILE_SCHEMA statement. The engine checks the actual schema again.
  for (let i = 0; i < header.length;) {
    if (header.startsWith('/*',i)) { const end=header.indexOf('*/',i+2); if(end<0)break;i=end+2;continue; }
    if (header[i] === "'") {
      i++; while(i<header.length){if(header[i++]!=="'")continue;if(header[i]==="'"){i++;continue;}break;}continue;
    }
    if (/[A-Za-z_]/.test(header[i])) {
      const start=i;while(i<header.length&&/[A-Za-z0-9_]/.test(header[i]))i++;
      if(header.slice(start,i).toUpperCase()==='FILE_SCHEMA') {
        schema=/^\s*\(\s*\(\s*'([^']+)'\s*\)\s*\)\s*;/i.exec(header.slice(i))?.[1]?.toUpperCase()||null;break;
      }
    } else i++;
  }
  if (schema && !['IFC2X3', 'IFC4'].includes(schema)) throw new IfcError('ifc_schema_unsupported', schema);
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  if (!/END-ISO-10303-21\s*;\s*$/i.test(tail)) throw new IfcError('ifc_invalid_file');
  return schema;
}

export class IfcReader {
  constructor(api, model) { this.api = api; this.model = model; this.cache = new Map(); this.placements = new Map(); this.scale = 1; }
  get(ref) {
    if (ref == null) return null;
    if (ref.expressID) return ref;
    const id = typeof ref === 'number' ? ref : ref.type === 5 ? ref.value : null;
    if (!Number.isSafeInteger(id) || id <= 0) throw new IfcError('ifc_invalid_reference');
    if (!this.cache.has(id)) {
      const item = this.api.GetLine(this.model, id, false);
      if (!item) throw new IfcError('ifc_invalid_reference', `#${id}`);
      this.cache.set(id, item);
    }
    return this.cache.get(id);
  }
  type(ref) { const item = this.get(ref); return item ? this.api.GetNameFromTypeCode(item.type).toUpperCase() : ''; }
  all(type) {
    const code = this.api.GetTypeCodeFromName(type.toUpperCase());
    const vector = this.api.GetLineIDsWithType(this.model, code, true);
    try {
      if (vector.size() > 200000) throw new IfcError('ifc_too_complex');
      return Array.from({ length: vector.size() }, (_, i) => this.get(vector.get(i)));
    } finally { vector.delete?.(); }
  }
  number(x) { return num(x); }
  point(ref) { return this.get(ref).Coordinates.map(num).concat([0, 0, 0]).slice(0, 3).map(x => x * this.scale); }
  direction(ref, fallback) { return ref ? unit(this.get(ref).DirectionRatios.map(num).concat([0, 0, 0]).slice(0, 3)) : fallback; }
  axis(ref) {
    if (!ref) return identity();
    const item = this.get(ref), type = this.type(item), origin = this.point(item.Location);
    if (type === 'IFCAXIS2PLACEMENT2D') return axes(origin, [0, 0, 1], this.direction(item.RefDirection, [1, 0, 0]));
    if (type !== 'IFCAXIS2PLACEMENT3D') throw new IfcError('ifc_geometry_unsupported', type);
    return axes(origin, this.direction(item.Axis, [0, 0, 1]), this.direction(item.RefDirection, [1, 0, 0]));
  }
  placement(ref, stack = new Set()) {
    if (!ref) return identity();
    const item = this.get(ref), id = item.expressID;
    if (this.placements.has(id)) return this.placements.get(id);
    if (stack.has(id) || stack.size > 64) throw new IfcError('ifc_placement_cycle');
    if (this.type(item) !== 'IFCLOCALPLACEMENT') throw new IfcError('ifc_geometry_unsupported', this.type(item));
    stack.add(id);
    const matrix = multiply(this.placement(item.PlacementRelTo, stack), this.axis(item.RelativePlacement));
    stack.delete(id); this.placements.set(id, matrix); return matrix;
  }
  operator(ref) {
    const item = this.get(ref);
    const x = this.direction(item.Axis1, [1, 0, 0]), y = this.direction(item.Axis2, [0, 1, 0]);
    const z = this.direction(item.Axis3, cross3(x, y));
    const s = item.Scale == null ? 1 : num(item.Scale);
    const sy = item.Scale2 == null ? s : num(item.Scale2), sz = item.Scale3 == null ? s : num(item.Scale3);
    if (!(s > 0 && sy > 0 && sz > 0) || Math.abs(dot(x, y)) > EPS) throw new IfcError('ifc_geometry_unsupported');
    return [...x.map(v => v * s), 0, ...y.map(v => v * sy), 0, ...z.map(v => v * sz), 0, ...this.point(item.LocalOrigin), 1];
  }
  unitScale(ref, stack = new Set()) {
    const item = this.get(ref), id = item.expressID;
    if (stack.has(id) || stack.size > 16) throw new IfcError('ifc_units_invalid');
    stack.add(id);
    const type = this.type(item);
    if (name(item.UnitType) !== 'LENGTHUNIT') throw new IfcError('ifc_units_invalid');
    if (type === 'IFCSIUNIT') {
      const prefixes = { '': 1, DECI: .1, CENTI: .01, MILLI: .001, MICRO: 1e-6, KILO: 1000 };
      const scale = prefixes[name(item.Prefix)];
      if (name(item.Name) !== 'METRE' || scale === undefined) throw new IfcError('ifc_units_invalid');
      return scale;
    }
    if (type === 'IFCCONVERSIONBASEDUNIT') {
      const factor = this.get(item.ConversionFactor), n = num(factor.ValueComponent);
      if (!(n > 0)) throw new IfcError('ifc_units_invalid');
      return n * this.unitScale(factor.UnitComponent, stack);
    }
    throw new IfcError('ifc_units_invalid');
  }
  prepare() {
    const projects = this.all('IFCPROJECT');
    if (!projects.length) throw new IfcError('ifc_structure_missing');
    if (projects.length !== 1) throw new IfcError('ifc_multiple_projects');
    const units = this.get(projects[0].UnitsInContext)?.Units || [];
    const lengths = units.filter(u => name(this.get(u).UnitType) === 'LENGTHUNIT');
    if (lengths.length !== 1) throw new IfcError('ifc_units_invalid');
    this.scale = this.unitScale(lengths[0]);
    const contexts = (projects[0].RepresentationContexts || []).map(c => this.get(c)).filter(c => c.WorldCoordinateSystem);
    const context = contexts.find(c => name(c.ContextType).toLowerCase() === 'model') || contexts[0];
    this.world = context ? this.axis(context.WorldCoordinateSystem) : identity();
    if (!horizontal(this.world)) throw new IfcError('ifc_geometry_unsupported', 'project coordinate system');
  }
  matrix(element) { return multiply(this.world, this.placement(element.ObjectPlacement)); }
  representations(element) {
    const shape = this.get(element.Representation);
    return (shape?.Representations || []).map(r => this.get(r));
  }
  items(representation, matrix, stack = new Set()) {
    if (stack.has(representation.expressID) || stack.size > 64) throw new IfcError('ifc_placement_cycle');
    const next = new Set(stack); next.add(representation.expressID);
    let context=this.get(representation.ContextOfItems),contextSeen=new Set();
    while(context?.ParentContext){
      if(contextSeen.has(context.expressID)||contextSeen.size>64)throw new IfcError('ifc_placement_cycle');
      contextSeen.add(context.expressID);context=this.get(context.ParentContext);
    }
    if(context?.WorldCoordinateSystem&&this.axis(context.WorldCoordinateSystem).some((v,i)=>Math.abs(v-this.world[i])>EPS))
      throw new IfcError('ifc_geometry_unsupported','representation coordinate context');
    const result = [];
    for (const ref of representation.Items || []) {
      const item = this.get(ref);
      if (this.type(item) === 'IFCMAPPEDITEM') {
        const source = this.get(item.MappingSource);
        const m = multiply(matrix, multiply(this.operator(item.MappingTarget), inverse(this.axis(source.MappingOrigin))));
        result.push(...this.items(this.get(source.MappedRepresentation), m, next));
      } else result.push({ item, matrix });
    }
    return result;
  }
  curves(ref, matrix, stack = new Set()) {
    const curve = this.get(ref), type = this.type(curve);
    if (stack.has(curve.expressID) || stack.size > 64) throw new IfcError('ifc_placement_cycle');
    const next = new Set(stack); next.add(curve.expressID);
    if (type === 'IFCPOLYLINE') return curve.Points.map(p => transform(matrix, this.point(p)));
    if (type === 'IFCINDEXEDPOLYCURVE') {
      const points = this.get(curve.Points).CoordList.map(p => p.map(num).map(x => x * this.scale).concat([0]).slice(0, 3));
      if (!curve.Segments?.length) return points.map(p => transform(matrix, p));
      const indices = [];
      for (const segment of curve.Segments) {
        if (segment.constructor?.name !== 'IfcLineIndex' && segment.name !== 'IFCLINEINDEX') throw new IfcError('ifc_geometry_unsupported', 'arc');
        const row = value(segment);
        if (!Array.isArray(row)) throw new IfcError('ifc_invalid_geometry');
        for (const i of row) if (indices.at(-1) !== num(i)) indices.push(num(i));
      }
      return indices.map(i => { if (!points[i - 1]) throw new IfcError('ifc_invalid_geometry'); return transform(matrix, points[i - 1]); });
    }
    if (type === 'IFCCOMPOSITECURVE') {
      const points = [];
      for (const ref of curve.Segments) {
        const seg = this.get(ref), part = this.curves(seg.ParentCurve, matrix, next);
        if (value(seg.SameSense) === false || name(seg.SameSense) === 'F') part.reverse();
        if (points.length && part.length && Math.hypot(...points.at(-1).map((v, i) => v - part[0][i])) < EPS) part.shift();
        points.push(...part);
      }
      return points;
    }
    throw new IfcError('ifc_geometry_unsupported', type);
  }
  profile(ref, matrix) {
    const profile = this.get(ref), type = this.type(profile);
    if (type === 'IFCARBITRARYPROFILEDEFWITHVOIDS') throw new IfcError('ifc_room_holes');
    if (type === 'IFCRECTANGLEPROFILEDEF') {
      const x = num(profile.XDim) * this.scale / 2, y = num(profile.YDim) * this.scale / 2;
      if (!(x > 0 && y > 0)) throw new IfcError('ifc_invalid_geometry');
      const m = multiply(matrix, this.axis(profile.Position));
      return [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]].map(p => transform(m, p));
    }
    if (type === 'IFCARBITRARYCLOSEDPROFILEDEF') return this.curves(profile.OuterCurve, matrix);
    throw new IfcError('ifc_geometry_unsupported', type);
  }
  extrusion(item, matrix) {
    if (this.type(item) !== 'IFCEXTRUDEDAREASOLID') throw new IfcError('ifc_geometry_unsupported', this.type(item));
    const m = multiply(matrix, this.axis(item.Position));
    if (!horizontal(m)) throw new IfcError('ifc_geometry_unsupported', 'tilt/scale');
    const direction = transform(m, this.direction(item.ExtrudedDirection, [0, 0, 1]), true);
    if (Math.hypot(direction[0], direction[1]) > EPS) throw new IfcError('ifc_geometry_unsupported', 'tilted extrusion');
    const poly = this.profile(item.SweptArea, m);
    const depth = num(item.Depth) * this.scale * direction[2];
    if (!(Math.abs(depth) > EPS)) throw new IfcError('ifc_invalid_geometry');
    return { poly, zMin: Math.min(poly[0][2], poly[0][2] + depth), zMax: Math.max(poly[0][2], poly[0][2] + depth) };
  }
}

export async function withIfc(bytes, callback) {
  const schema = validateIfcBytes(bytes);
  const api = createIfcEngine();
  let model;
  try {
    await api.Init();
    model = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false, ALLOW_INCOMPATIBLE_SCHEMA_ALIASES: false, MEMORY_LIMIT: 1024 * 1024 * 1024 });
    if (!(model >= 0)) throw new IfcError('ifc_invalid_file');
    const actualSchema = String(api.GetModelSchema(model)).toUpperCase();
    if (!['IFC2X3','IFC4'].includes(actualSchema) || schema && actualSchema !== schema) throw new IfcError('ifc_schema_unsupported');
    const reader = new IfcReader(api, model); reader.prepare();
    return await callback(reader, actualSchema);
  } catch (error) {
    if (error instanceof IfcError) throw error;
    throw new IfcError('ifc_engine_error', String(error?.message || error));
  } finally { if (model !== undefined && model >= 0) api.CloseModel(model); if (api.wasmModule) api.Dispose?.(); }
}

export const ifcText = name;
