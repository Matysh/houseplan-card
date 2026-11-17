/** Detach a small, plain-data architectural model before closing the WASM model. */
import { IfcError } from './ifc-errors.mjs';
import { ifcText, withIfc } from './ifc-read.mjs';
import { readOpening, readSpace, readWall, sourceInfo, wallEnvelope } from './ifc-elements.mjs';
import { distance, project, transform } from './ifc-math.mjs';

export async function readIfc(bytes) {
  return withIfc(bytes, (reader, schema) => {
    const header = reader.api.GetHeaderLine(reader.model,reader.api.GetTypeCodeFromName('FILE_NAME'))?.arguments || [];
    if(!Array.isArray(header)||header.length<7)throw new IfcError('ifc_invalid_file');
    const sourceProgram = ifcText(header[5]), sourcePreprocessor = ifcText(header[4]);
    const entities = [], parent = new Map(), ambiguous = new Set();
    const assign = (child, owner) => {
      if (parent.has(child) && parent.get(child) !== owner) ambiguous.add(child);
      else parent.set(child, owner);
    };
    for (const rel of reader.all('IFCRELAGGREGATES')) for (const child of rel.RelatedObjects || []) assign(child.value, rel.RelatingObject.value);
    for (const rel of reader.all('IFCRELCONTAINEDINSPATIALSTRUCTURE')) for (const child of rel.RelatedElements || []) assign(child.value, rel.RelatingStructure.value);
    const floors = reader.all('IFCBUILDINGSTOREY').map(floor => ({ ...sourceInfo(reader, floor, 'floor'),
      id: String(floor.expressID), title: ifcText(floor.Name) || ifcText(floor.LongName) || `#${floor.expressID}`,
      elevation: floor.ObjectPlacement ? transform(reader.matrix(floor), [0, 0, 0])[2] : null,
      declaredElevation: floor.Elevation == null ? null : reader.number(floor.Elevation)*reader.scale }));
    if (!floors.length) throw new IfcError('ifc_structure_missing');
    const floorIds = new Set(floors.map(f => Number(f.id))), buildings = new Map(reader.all('IFCBUILDING').map(b => [b.expressID, b]));
    const ancestor = (id, allowed) => {
      const seen = new Set();
      while (id && !allowed.has(id)) {
        if (ambiguous.has(id)) return null;
        if (seen.has(id) || seen.size > 128) throw new IfcError('ifc_placement_cycle');
        seen.add(id); id = parent.get(id);
      }
      return id || null;
    };
    for (const floor of floors) {
      const building = ancestor(Number(floor.id), buildings);
      floor.buildingId = building ? String(building) : 'project';
      floor.building = building ? ifcText(buildings.get(building).Name) : '';
    }
    floors.sort((a, b) => a.buildingId.localeCompare(b.buildingId)
      || (a.elevation??Infinity)-(b.elevation??Infinity) || a.title.localeCompare(b.title) || Number(a.id)-Number(b.id));
    const materials = new Map();
    for (const rel of reader.all('IFCRELASSOCIATESMATERIAL')) for (const obj of rel.RelatedObjects || []) {
      if (materials.has(obj.value) && materials.get(obj.value).expressID !== rel.RelatingMaterial.value) materials.set(obj.value, null);
      else materials.set(obj.value, reader.get(rel.RelatingMaterial));
    }
    const fatal = error => { if (['ifc_placement_cycle', 'ifc_invalid_number', 'ifc_invalid_reference'].includes(error.code)) throw error; };
    const wallsById = new Map();
    for (const wall of reader.all('IFCWALL')) {
      const info = { ...sourceInfo(reader, wall, 'wall'), floorId: String(ancestor(wall.expressID, floorIds) || '') };
      try {
        info.walls = readWall(reader, wall, materials.get(wall.expressID));
        if (info.walls.some(w => w.cm < 1 || w.cm > 100)) throw new IfcError('ifc_thickness_unsupported');
        info.outcome = 'transferred';
      } catch (error) {
        fatal(error); info.reason = error.code || 'ifc_geometry_unsupported'; info.detail = error.message; info.outcome = 'skipped';
        info.envelope = wallEnvelope(reader, wall);
        if (!info.envelope && info.walls?.length) {
          const points = info.walls.flatMap(w => [w.a,w.b]), margin = Math.max(...info.walls.map(w=>w.cm))/200;
          info.envelope = { minX:Math.min(...points.map(p=>p[0]))-margin,maxX:Math.max(...points.map(p=>p[0]))+margin,
            minY:Math.min(...points.map(p=>p[1]))-margin,maxY:Math.max(...points.map(p=>p[1]))+margin };
        }
      }
      entities.push(info); wallsById.set(wall.expressID, info);
    }
    for (const room of reader.all('IFCSPACE')) {
      const info = { ...sourceInfo(reader, room, 'room'), floorId: String(ancestor(room.expressID, floorIds) || '') };
      try { info.poly = readSpace(reader, room); info.outcome = 'transferred'; }
      catch (error) { fatal(error); info.reason = error.code || 'ifc_geometry_unsupported'; info.detail = error.message; info.outcome = 'skipped'; }
      entities.push(info);
    }
    const fills = new Map(), voids = new Map();
    const relationship = (map, id, target) => { if (!map.has(id)) map.set(id, target); else if (map.get(id) !== target) map.set(id, null); };
    for (const rel of reader.all('IFCRELFILLSELEMENT')) relationship(fills, rel.RelatedBuildingElement.value, rel.RelatingOpeningElement.value);
    for (const rel of reader.all('IFCRELVOIDSELEMENT')) relationship(voids, rel.RelatedOpeningElement.value, rel.RelatingBuildingElement.value);
    const filledVoids = new Set(reader.all('IFCRELFILLSELEMENT').map(r=>r.RelatingOpeningElement.value));
    const excludedVoids = [];
    for (const [voidId,hostId] of voids) {
      if (hostId && wallsById.has(hostId) && filledVoids.has(voidId)) continue;
      const element=reader.get(voidId), host=hostId?reader.get(hostId):null;
      excludedVoids.push({...sourceInfo(reader,element,'void'),floorId:String(hostId&&ancestor(hostId,floorIds)||''),
        hostType:host?reader.type(host):'',outcome:'skipped',reason:hostId&&wallsById.has(hostId)?'ifc_void_unfilled':'ifc_void_nonwall'});
    }
    for (const kind of ['door', 'window']) for (const element of reader.all(`IFC${kind.toUpperCase()}`)) {
      const info = { ...sourceInfo(reader, element, kind), floorId: String(ancestor(element.expressID, floorIds) || '') };
      try {
        const voidId = fills.get(element.expressID), hostId = voids.get(voidId), host = wallsById.get(hostId);
        if (!host || host.outcome === 'skipped') throw new IfcError('ifc_opening_host');
        info.floorId ||= host.floorId; info.hostSourceId = hostId;
        const candidates=[];
        for(const wall of host.walls)try {
          const opening=readOpening(reader,reader.get(voidId),wall);
          const hit=project([opening.x,opening.y],wall.a,wall.b),half=opening.length/(2*distance(wall.a,wall.b));
          if(hit.t>=half-1e-8&&hit.t<=1-half+1e-8)candidates.push(opening);
        }catch(error){fatal(error);}
        if(candidates.length!==1)throw new IfcError('ifc_opening_host');
        info.opening = candidates[0];
        info.outcome = kind === 'door' ? 'partial' : 'transferred';
        if (kind === 'door') info.reason = 'ifc_door_orientation';
      } catch (error) { fatal(error); info.reason = error.code || 'ifc_geometry_unsupported'; info.detail = error.message; info.outcome = 'skipped'; }
      entities.push(info);
    }
    // Resolve every placement, including unsupported entities, before releasing
    // WASM. Cycles must not be hidden by a per-element unsupported branch.
    for (const entity of entities) reader.placement(reader.get(entity.sourceId).ObjectPlacement);
    for (const entity of entities) if (!entity.floorId) { entity.outcome = 'skipped'; entity.reason = 'ifc_floor_missing'; }
    const guids = new Map();
    for (const entity of [...entities,...floors]) if (entity.guid) {
      if (!guids.has(entity.guid)) guids.set(entity.guid,[]);
      guids.get(entity.guid).push(entity);
    }
    for (const duplicates of guids.values()) if (duplicates.length > 1)
      for (const entity of duplicates) entity.warnings = ['ifc_duplicate_guid'];
    for(const entity of entities) if(entity.kind==='wall'&&entity.outcome!=='skipped'&&entity.walls.some(w=>w.zMin===null)) {
      const building=floors.find(f=>f.id===entity.floorId)?.buildingId;
      if(floors.filter(f=>f.buildingId===building).length>1)(entity.warnings??=[]).push('ifc_wall_height_unknown');
    }
    return { schema, sourceProgram, sourcePreprocessor, metresPerUnit: reader.scale, floors, entities, excludedVoids,
      wasmLinearBytes: reader.api.wasmModule.HEAPU8.byteLength };
  });
}
