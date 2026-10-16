/** Easy Floorplan -> current ordinary space, shared by CLI and the offline page. */
import { EasyInputError, easyFloors, readEasy } from './easy-read.mjs';
import { estimateEasyScale } from './easy-scale.mjs';
import { frameForEasy, makeIds, numberAt, projectFloorGeometry, readFloorGeometry } from './easy-geometry.mjs';
import { FURNITURE } from './geometry-runtime.generated.mjs';
import { colorResolver, stringAt } from './easy-style.mjs';
import { backgroundFields, furnitureDecor, openingConfig, roomConfig, textDecor } from './easy-content.mjs';
import { convertItems } from './easy-markers.mjs';
import { MIN_CURRENT_HOUSEPLAN, modernDocument } from './output.mjs';

export const TOOL_VERSION = 'plan-convert 0.2';
const unknown = (object, keys, id, notes) => {
  const fields = Object.keys(object).filter(key => !keys.includes(key));
  if (fields.length) notes.push({ code: 'source_fields_unsupported', id, fields: fields.join(', ') });
};

export function convertEasy(text, options = {}) {
  const config = readEasy(text), floors = easyFloors(config);
  const estimate = estimateEasyScale(floors, FURNITURE);
  const report = { levels: [], items: [{ code: `scale_${estimate.basis}`, cmPerUnit: estimate.cmPerUnit, count: estimate.count }],
    toolVersion: options.toolVersion || TOOL_VERSION, minHouseplan: MIN_CURRENT_HOUSEPLAN };
  report.items.push({ code: 'easy_compatibility' });
  unknown(config, ['type', 'title', 'width', 'height', 'floors', 'walls', 'openings', 'items', 'furniture', 'texts', 'areas',
    'trackers', 'palette', 'north', 'sunlight', 'ambientDaylight', 'image', 'imageFit', 'imageOpacity'], 'card', report.items);
  if (config.floors?.length && ['walls', 'openings', 'items', 'furniture', 'texts', 'areas'].some(key => config[key]?.length))
    report.items.push({ code: 'legacy_arrays_ignored' });
  if (config.ambientDaylight !== undefined) report.items.push({ code: 'ambient_daylight_skipped' });
  const color = colorResolver(config.palette);
  const candidates = floors.map((floor, index) => {
    const ids = makeIds(`easy-${index + 1}`), notes = [];
    const title = stringAt(floor.name, `floors[${index}].name`, `Floor ${index + 1}`);
    const record = { id: String(floor.id ?? index), title, notes };
    report.levels.push(record);
    try {
      const geometry = readFloorGeometry(floor, { ids, cmPerUnit: estimate.cmPerUnit, notes });
      frameForEasy(config, [floor], [geometry], estimate.cmPerUnit);
      return { floor, index, ids, notes, record, geometry };
    } catch (error) {
      if (!(error instanceof EasyInputError)) throw error;
      record.skipped = error.code; notes.push({ code: 'floor_refused', id: record.id, reason: error.code });
      return null;
    }
  }).filter(Boolean);
  if (!candidates.length) throw Object.assign(new EasyInputError('easy_nothing_to_convert'), { report });
  // A common frame and coefficient retain relative floor coordinates. An invalid
  // floor cannot distort the frame of the remaining downloadable floors.
  const frame = frameForEasy(config, candidates.map(c => c.floor), candidates.map(c => c.geometry), estimate.cmPerUnit);
  const documents = [];
  for (const candidate of candidates) {
    const { floor, index, ids, notes, record, geometry } = candidate;
    try {
      const context = { ids, notes, frame, cmPerUnit: estimate.cmPerUnit, color };
      const projected = projectFloorGeometry(geometry, frame, ids);
      const rooms = projected.rooms.map(room => roomConfig(room, context));
      const spaceId = `easy-${index + 1}`;
      const items = convertItems(floor.items || [], rooms, spaceId, context);
      const decor = [...items.decor, ...(floor.furniture || []).flatMap(source => furnitureDecor(source, context)),
        ...(floor.texts || []).map(source => textDecor(source, context)).filter(Boolean)];
      const openings = (floor.openings || []).map(source => openingConfig(source, context)).filter(Boolean);
      const display = { glow_enabled: true };
      if (config.north !== undefined) display.north_deg = ((Math.round(numberAt(config.north, 'north')) % 360) + 360) % 360;
      if (config.sunlight !== undefined) {
        if (typeof config.sunlight !== 'boolean') throw new EasyInputError('easy_invalid_boolean', 'sunlight');
        display.sun_rays = config.sunlight;
        notes.push({ code: 'sun_runtime_semantics', id: spaceId });
      }
      if (items.markers.length > 2000 || decor.length > 1000 || items.strips.length > 50 || rooms.length > 400)
        throw new EasyInputError('easy_too_complex', spaceId);
      const space = { id: spaceId, title: record.title, cell_cm: frame.cellCm, view_box: frame.viewBox,
        rooms, walls: projected.walls, partitions: projected.partitions, openings, decor, display,
        ...(items.strips.length ? { led_strips: items.strips } : {}), ...backgroundFields(config, floor, frame, notes) };
      const converted = modernDocument(space, { markers: items.markers, layout: items.layout,
        now: options.now, toolVersion: options.toolVersion || TOOL_VERSION });
      notes.push(...converted.notes);
      if (floor.trackers?.length) notes.push({ code: 'trackers_skipped', count: floor.trackers.length });
      unknown(floor, ['id', 'name', 'image', 'imageFit', 'imageOpacity', 'walls', 'areas', 'items', 'openings', 'texts', 'furniture', 'trackers'], record.id, notes);
      for (const wall of floor.walls || []) unknown(wall, ['id', 'x1', 'y1', 'x2', 'y2', 'thickness', 'divider', 'kind'], wall.id, notes);
      const output = converted.document.payload.config.spaces[0];
      Object.assign(record, { spaceId, cellCm: frame.cellCm, rooms: rooms.length,
        walls: output.wall_segments.length + (output.partitions?.length || 0), openings: output.openings?.length || 0,
        devices: items.markers.length, decor: decor.length });
      documents.push(converted.document);
    } catch (error) {
      if (!error.code) throw error;
      record.skipped = error.code; notes.push({ code: 'floor_refused', id: record.id, reason: error.code });
    }
  }
  if (!documents.length) throw Object.assign(new EasyInputError('easy_nothing_to_convert'), { report });
  return { documents, report };
}
