import { readIfc } from './ifc-model.mjs';
import { IfcError } from './ifc-errors.mjs';
import { alignIfcRoom, joinIfcAxes } from './ifc-geometry.mjs';
import { atomizeSourceWalls, frameForEasy, makeIds, projectFloorGeometry } from './easy-geometry.mjs';
import { modernDocument, MIN_CURRENT_HOUSEPLAN } from './output.mjs';
import { distance, project } from './ifc-math.mjs';

const counts = items => Object.fromEntries(['floor', 'wall', 'room', 'door', 'window'].map(kind => [kind, items.filter(e => e.kind === kind).length]));
const note = (entity, code = entity.reason) => ({ code, id: String(entity.sourceId), name: entity.name,
  guid: entity.guid, type: entity.type, detail: entity.detail || '' });
const flip = p => [p[0], -p[1]];

export async function convertIfc(bytes, options = {}) { return convertIfcModel(await readIfc(bytes), options); }

/** One storey-membership rule for conversion and the browser's catalog. */
export function ifcFloorContents(model, floor, entities = model.entities) {
  const floorsById = new Map(model.floors.map(f => [f.id, f]));
  const owned = entities.filter(e => e.floorId === floor.id);
  const spanning = entities.filter(e => e.kind === 'wall' && e.floorId !== floor.id
    && floorsById.get(e.floorId)?.buildingId === floor.buildingId
    && Number.isFinite(floor.elevation) && e.walls?.some(w => w.zMin !== null && w.zMin <= floor.elevation + 1 && w.zMax > floor.elevation + 1));
  return { owned, wallEntities: [...owned.filter(e => e.kind === 'wall'), ...spanning] };
}

export function convertIfcModel(model, options = {}) {
  const entities = [...model.entities.map(e => ({ ...e, results: [] })), ...model.floors.map(f => ({ ...f,
    sourceId: Number(f.id), kind: 'floor', floorId: f.id, outcome: 'transferred', results: [] }))];
  const report = { sourceFormat: 'ifc', schema: model.schema, metresPerUnit: model.metresPerUnit,
    sourceProgram: model.sourceProgram, sourcePreprocessor: model.sourcePreprocessor,
    measurements: { wasmLinearBytes: model.wasmLinearBytes },
    excludedVoids: model.excludedVoids || [],
    minHouseplan: MIN_CURRENT_HOUSEPLAN, toolVersion: options.toolVersion || 'plan-convert 0.2',
    sourceCounts: { ...counts(entities), floor: model.floors.length }, entities,
    levels: [], items: [{ code: 'ifc_profile' }, { code: 'ifc_room_area' }] };
  const candidates = [];
  for (const floor of model.floors) {
    const { owned, wallEntities } = ifcFloorContents(model, floor, entities);
    const walls = joinIfcAxes(wallEntities.filter(e => e.outcome !== 'skipped').flatMap(e => e.walls.map((w, i) => ({ ...w, id: `ifc-w-${e.sourceId}-${i}`, sourceId: e.sourceId }))));
    const physicalWalls = [...walls];
    const notes = [], rooms = [], ids = makeIds(`ifc-${floor.id}`);
    const record = { id: floor.id, title: floor.title, building: floor.building, elevation: floor.elevation, notes,
      sourceCounts: counts(owned), selected: !options.floorIds || options.floorIds.map(String).includes(floor.id) };
    report.levels.push(record);
    if(!Number.isFinite(floor.elevation))notes.push(note({...floor,name:floor.title},'ifc_elevation_unknown'));
    for (const omitted of model.excludedVoids || []) if (omitted.floorId === floor.id) notes.push(note(omitted));
    for (const entity of owned) if (entity.outcome === 'skipped') notes.push(note(entity));
    for (const entity of owned) for (const warning of entity.warnings || []) notes.push(note(entity,warning));
    for (const entity of owned.filter(e => e.kind === 'room' && e.outcome !== 'skipped')) {
      try {
        const result = alignIfcRoom(entity.poly, physicalWalls, wallEntities.filter(e => e.outcome === 'skipped'));
        const id = ids('room', entity.sourceId);
        rooms.push({ id, name: entity.name || (options.language === 'ru' ? `Комната ${rooms.length + 1}` : `Room ${rooms.length + 1}`),
          poly: result.poly.map(flip), sourceId: entity.sourceId });
        walls.push(...result.walls.map((w, i) => ({ ...w, id: `${id}-edge-${i}`, sourceId: entity.sourceId })));
        entity.results.push({ floorId: floor.id, id, outcome: 'transferred' });
        if (result.virtual.length) notes.push(note(entity, 'ifc_virtual_boundary'));
      } catch (error) {
        entity.results.push({ floorId: floor.id, outcome: 'skipped', reason: error.code || 'ifc_room_boundary' });
        notes.push(note(entity, error.code || 'ifc_room_boundary'));
      }
    }
    try {
      const geometry = { rooms, walls: atomizeSourceWalls(walls.map(w => ({ ...w, a: flip(w.a), b: flip(w.b) }))) };
      if (!rooms.length && !geometry.walls.length) { record.skipped = 'ifc_floor_empty'; continue; }
      for (const entity of wallEntities.filter(e => e.outcome !== 'skipped')) entity.results.push({ floorId: floor.id, outcome: 'transferred' });
      candidates.push({ floor, owned, record, geometry, ids, physicalWalls });
    } catch (error) { record.skipped = 'ifc_topology_conflict'; notes.push({ code: record.skipped, detail: error.code || error.message }); }
  }
  const frames = new Map();
  for (const building of new Set(candidates.map(c => c.floor.buildingId))) {
    const members = candidates.filter(c => c.floor.buildingId === building);
    try { frames.set(building, frameForEasy({}, [], members.map(c => c.geometry), 100)); }
    catch(error) {
      for(const member of members){member.record.skipped='ifc_floor_refused';member.record.notes.push({code:'ifc_floor_refused',detail:error.code||error.message});}
    }
  }
  const documents = [];
  for (const candidate of candidates) {
    const { floor, owned, record, geometry, ids, physicalWalls } = candidate;
    const frame = frames.get(floor.buildingId);
    if(!frame)continue;
    try {
      const projected = projectFloorGeometry(geometry, frame, ids);
      const openings = [];
      for (const entity of owned.filter(e => ['door', 'window'].includes(e.kind) && e.outcome !== 'skipped')) {
        const source = entity.opening, p = flip([source.x, source.y]);
        const sourceCarriers = physicalWalls.filter(w => w.sourceId === entity.hostSourceId);
        const ownsCentre = sourceCarriers.some(w=>{
          const hit=project(p,flip(w.a),flip(w.b)), half=source.length/(2*distance(w.a,w.b));
          return hit.distance<.001&&hit.t>=half-1e-8&&hit.t<=1-half+1e-8;
        });
        // Atomization can coalesce coincident IFC wall objects. Retain their
        // explicit host lineage by exact physical-line correspondence, not by
        // choosing the nearest unrelated wall or depending on insertion order.
        const carriers = geometry.walls.filter(w => ownsCentre && w.cm > 0 && sourceCarriers.some(source =>
          Math.abs(source.cm-w.cm) < 1e-5 && project(w.a,flip(source.a),flip(source.b)).distance < .001
            && project(w.b,flip(source.a),flip(source.b)).distance < .001)).filter(w => {
          const hit = project(p, w.a, w.b), half = source.length / (2 * distance(w.a, w.b));
          return hit.distance < .001 && hit.t >= half && hit.t <= 1 - half;
        });
        if (carriers.length !== 1) {
          entity.results.push({ floorId: floor.id, outcome: 'skipped', reason: 'ifc_opening_host' }); notesPush(record, entity, 'ifc_opening_host'); continue;
        }
        const id = ids('opening', entity.sourceId), [x, y] = frame.point(p);
        openings.push({ id, type: entity.kind, x, y, angle: -source.angle, length: frame.size(source.length) });
        entity.results.push({ floorId: floor.id, id, outcome: entity.outcome, ...(entity.reason ? { reason: entity.reason } : {}) });
        if (entity.reason) notesPush(record, entity, entity.reason);
      }
      const spaceId = `ifc-${floor.id}`;
      const converted = modernDocument({ id: spaceId, title: floor.title, cell_cm: frame.cellCm, view_box: frame.viewBox,
        rooms: projected.rooms.map(r => ({ id: r.id, name: r.name, poly: r.poly })), walls: projected.walls,
        partitions: projected.partitions, openings, settings: { show_borders: true } }, { planOnly: true, now: options.now, toolVersion: report.toolVersion });
      for (const item of converted.notes) {
        const entity = entities.find(e => e.results.some(r => r.id === item.id));
        if (entity) { const result = entity.results.find(r => r.id === item.id); result.outcome = 'skipped'; result.reason = item.code; notesPush(record, entity, item.code); }
        else record.notes.push(item);
      }
      const output = converted.document.payload.config.spaces[0];
      record.previewSources = [];
      for (const entity of owned) {
        let shapes = [];
        if (entity.kind === 'wall') shapes = geometry.walls.filter(w => w.sourceId === entity.sourceId).map(w => [frame.point(w.a),frame.point(w.b)]);
        if (entity.kind === 'room' && entity.poly) {
          const aligned = geometry.rooms.find(r => r.sourceId === entity.sourceId);
          const poly = aligned ? aligned.poly.map(frame.point) : entity.poly.map(p => frame.point(flip(p)));
          shapes = [[...poly, poly[0]]];
        }
        if (entity.opening) {
          const o = entity.opening, angle = -o.angle * Math.PI/180, p = frame.point(flip([o.x,o.y])), half = frame.size(o.length)/2;
          shapes = [[[p[0]-Math.cos(angle)*half,p[1]-Math.sin(angle)*half],[p[0]+Math.cos(angle)*half,p[1]+Math.sin(angle)*half]]];
        }
        if (shapes.length) record.previewSources.push({ sourceId: entity.sourceId, shapes });
      }
      Object.assign(record, { spaceId, cellCm: frame.cellCm, rooms: output.rooms?.length || 0,
        walls: (output.wall_segments?.length || 0) + (output.partitions?.length || 0), openings: output.openings?.length || 0 });
      record.partial = record.notes.length > 0;
      const floorEntity = owned.find(e => e.kind === 'floor');
      floorEntity?.results.push({ floorId: floor.id, id: spaceId, outcome: record.partial ? 'partial' : 'transferred' });
      if (record.selected) documents.push(converted.document);
    } catch (error) { record.skipped = error.code || 'ifc_topology_conflict'; record.notes.push({ code: 'ifc_floor_refused', detail: record.skipped }); }
  }
  for (const entity of entities) {
    if (entity.kind === 'floor' && report.levels.find(l => l.id === entity.floorId)?.skipped) {
      entity.outcome = 'skipped'; entity.reason = report.levels.find(l => l.id === entity.floorId).skipped;
    }
    for (const result of entity.results) if (report.levels.find(l => l.id === result.floorId)?.skipped) { result.outcome = 'skipped'; result.reason = 'ifc_floor_refused'; }
    if (!entity.floorId) continue;
    if (entity.results.length) {
      entity.outcome = entity.results.every(r => r.outcome === 'skipped') ? 'skipped'
        : entity.results.some(r => r.outcome !== 'transferred') ? 'partial' : 'transferred';
      entity.reason = entity.results.find(r => r.reason)?.reason;
    }
    if (entity.warnings?.length && entity.outcome === 'transferred') entity.outcome = 'partial';
  }
  const unassigned = entities.filter(e => !e.floorId);
  if (unassigned.length) report.levels.push({ id: 'unassigned', title: options.language === 'ru' ? 'Не определён этаж' : 'Unknown floor',
    skipped: 'ifc_floor_missing', notes: unassigned.map(e => note(e)), sourceCounts: counts(unassigned) });
  report.outcomes = Object.fromEntries(['transferred', 'partial', 'skipped'].map(outcome => [outcome, counts(entities.filter(e => e.outcome === outcome))]));
  return { documents, report };
}
const notesPush = (record, entity, code) => record.notes.push(note(entity, code));
export { IfcError, readIfc };
