import { CANVAS_LIMIT, GRID_PITCH, NORM_W } from '../../canvas-constants';
import { planRect } from '../../space-geometry';
import type { DevItem, LedStripModel, Marker, OpeningCfg, PartitionCfg, RoomCfg, WallColumnCfg, WallSegmentEntry } from '../../types';
import type { DecorShape } from '../decor/types';
import { decorStyleOf } from '../decor/geometry';
import { stairVisualStyle, type Stair, type StairVisualStyle } from '../../stairs';
import type { PropertiesIdentity } from './controller';
import type { PropertiesField, PropertiesGroup, PropertiesSurface, PropertiesAction } from './surface';
import type { PropertiesString } from './strings';
import { cmPerNorm, decorPropertiesBox, canonicalPropertiesAngle, type PropertiesBackdrop } from './transforms';
import { freePartitionEnds, propertiesContourRooms } from './physical';
import type { OpeningDimension } from '../../opening-dimensions';

export interface PropertiesSpace extends PropertiesBackdrop {
  id: string; title: string; plan_url?: string;
  rooms?: RoomCfg[];
  partitions?: PartitionCfg[]; wall_segments?: WallSegmentEntry[]; wall_columns?: WallColumnCfg[];
  openings?: OpeningCfg[]; decor?: DecorShape[]; stairs?: Stair[]; led_strips?: LedStripModel[];
}
export type PropertiesTarget =
  | { kind: 'partition'; value: PartitionCfg }
  | { kind: 'contour'; value: WallSegmentEntry }
  | { kind: 'column'; value: WallColumnCfg }
  | { kind: 'opening'; value: OpeningCfg }
  | { kind: 'stair'; value: Stair }
  | { kind: 'device'; value: DevItem; marker?: Marker }
  | { kind: 'led'; value: LedStripModel; device?: DevItem }
  | { kind: 'decor'; value: DecorShape }
  | { kind: 'backdrop'; value: PropertiesSpace };

/** Stable IDs resolve against current state, never the rendered DevItem snapshot. */
export function resolvePropertiesTarget(
  identity: PropertiesIdentity, space: PropertiesSpace, devices: readonly DevItem[], markers: readonly Marker[],
): PropertiesTarget | null {
  if (identity.spaceId !== space.id) return null;
  const id = identity.objectId;
  if (identity.kind === 'backdrop') return space.plan_url && id === space.id ? { kind: 'backdrop', value: space } : null;
  if (identity.kind === 'device') {
    const value = devices.find(d => d.id === id && d.space === space.id && !d.marker?.removed);
    const marker = markers.find(m => m.id === id && !m.removed);
    const binding = marker?.binding ?? (value?.bindingKind === 'virtual' ? 'virtual' : value ? `${value.bindingKind}:${value.bindingRef}` : '');
    return value && binding === identity.binding ? { kind: 'device', value, marker } : null;
  }
  if (identity.kind === 'led') {
    const value = space.led_strips?.find(s => s.id === id && s.active !== false);
    if (!value || (identity.binding ?? '') !== (value.marker ?? '')) return null;
    return { kind: 'led', value, device: devices.find(d => d.id === value.marker && d.space === space.id && !d.marker?.removed) };
  }
  if (identity.editor === 'plan') {
    if (identity.kind === 'partition') { const value = space.partitions?.find(x => x.id === id); return value ? { kind: 'partition', value } : null; }
    if (identity.kind === 'contour') { const value = space.wall_segments?.find(x => x.id === id); return value ? { kind: 'contour', value } : null; }
    if (identity.kind === 'column') { const value = space.wall_columns?.find(x => x.id === id); return value ? { kind: 'column', value } : null; }
    if (identity.kind === 'opening') { const value = space.openings?.find(x => x.id === id);
      return value && (identity.binding === undefined || identity.binding === JSON.stringify(value.host ? [value.host.kind,value.host.id] : null))
        ? { kind: 'opening', value } : null; }
    if (identity.kind === 'stair') { const value = space.stairs?.find(x => x.id === id); return value ? { kind: 'stair', value } : null; }
  }
  if (identity.editor === 'decor') {
    const value = space.decor?.find(x => x.id === id && x.kind === identity.kind);
    return value ? { kind: 'decor', value } : null;
  }
  return null;
}

export interface PropertiesCatalogContext {
  space: PropertiesSpace; cellCm: number;
  t(key: PropertiesString, vars?: Record<string, string | number>): string;
  position(device: DevItem): { x: number; y: number };
  textBox(shape: DecorShape): { w: number; h: number };
  fontCm(shape: DecorShape): number;
  imageName(asset: string): string;
  textName?(shape: DecorShape): string;
  openingReference: OpeningDimension | null;
  openingSides: [string, string];
  openingRooms?: readonly string[];
  stairFallback?: StairVisualStyle;
  ratioLocked: boolean;
}
const number = (key: string, label: PropertiesString, value: number, unit: PropertiesField['unit'] = 'cm',
  extra: Partial<PropertiesField> = {}): PropertiesField => ({ key, label, value, unit, ...extra });
const disabled = (key: string, label: PropertiesString, unit: PropertiesField['unit'] = 'cm'): PropertiesField =>
  ({ key, label, unit, value: null, mode: 'disabled' });
const action = (key: string, label: PropertiesString, icon: string, reason?: PropertiesString): PropertiesAction =>
  ({ key, label, icon, ...(reason ? { disabled: reason } : {}) });
const color = (key: string, label: PropertiesString, c: string, opacity: number): PropertiesField =>
  ({ key, label, value: { color: c, opacity }, control: 'color' });
const choice = (key: string, label: PropertiesString, value: string | boolean,
  options: { value: string; label: string }[], wide = true): PropertiesField =>
  ({ key, label, value, options, control: 'choices', wide });

/** All families keep the same three groups; only non-empty type groups exist. */
export function propertiesCatalog(target: PropertiesTarget | null, context: PropertiesCatalogContext): PropertiesSurface {
  const { cellCm, t, space } = context, factor = cmPerNorm(cellCm);
  const bounds = CANVAS_LIMIT * factor;
  const numericPos = (key: 'x' | 'y', value: number, readonly = false): PropertiesField =>
    number(key, key === 'x' ? 'center_x' : 'center_y', value * factor, 'cm', { min: -bounds, max: bounds, ...(readonly ? { mode: 'readonly' } : {}) });
  let title = t('empty'), kind: PropertiesString | null = null;
  let position: PropertiesField[] = [disabled('x', 'center_x'), disabled('y', 'center_y')];
  let geometry: PropertiesField[] = [disabled('w', 'width'), disabled('h', 'height'), disabled('angle', 'angle', '°'), disabled('scale', 'scale', '%')];
  let appearance: PropertiesField[] = [
    { ...disabled('stroke', 'stroke'), control: 'color' }, { ...disabled('fill', 'fill'), control: 'color' },
    disabled('stroke_width', 'stroke_width'), disabled('line_style', 'line_style', ''),
  ];
  let positionHint: PropertiesString | undefined = target ? 'center_hint' : 'empty_hint';
  let geometryHint: PropertiesString | undefined;
  const features: PropertiesField[] = [];
  let featureTitle: PropertiesString | undefined, featureHint: PropertiesString | undefined;
  let actions: PropertiesAction[] = [action('delete', 'delete', 'delete', 'empty_hint')];
  const angle = (value: number, readonly = false, label: PropertiesString = 'angle') => number('angle', label,
    label === 'icon_angle' ? value : canonicalPropertiesAngle(value), '°', { ...(readonly ? { mode: 'readonly' as const } : {}) });
  const reflection = (value: { flip_h?: boolean; flip_v?: boolean }): void => {
    features.push({ key: 'flip_h', label: 'horizontal', value: value.flip_h === true, control: 'toggle', section: 'reflection', icon: 'flip_h' },
      { key: 'flip_v', label: 'vertical', value: value.flip_v === true, control: 'toggle', icon: 'flip_v' });
  };
  if (target) {
    actions = [action('delete', 'delete', 'delete')];
    if (target.kind === 'partition' || target.kind === 'contour') {
      const wall = target.value;
      kind = target.kind === 'partition' ? 'wall' : 'contour';
      const freedom = target.kind === 'partition' ? freePartitionEnds(target.value, [...(space.partitions ?? []), ...(space.wall_segments ?? [])]) : [false, false];
      position = (['a', 'b'] as const).flatMap((end, index) => ([0, 1] as const).map(axis =>
        number(`${end}${axis}`, target.kind === 'contour' ? end === 'a' ? axis === 0 ? 'point_a_x' : 'point_a_y' : axis === 0 ? 'point_b_x' : 'point_b_y'
          : end === 'a' ? axis === 0 ? 'start_x' : 'start_y' : axis === 0 ? 'end_x' : 'end_y', wall[end][axis] * factor, 'cm',
          { min: -bounds, max: bounds, ...(freedom[index] ? {} : { mode: 'readonly', reason: target.kind === 'contour' ? 'contour_hint' : 'connected_hint' }) })));
      geometry = [number('length', 'length', Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) * factor, 'cm', { mode: 'readonly' }),
        number('cm', 'thickness', wall.cm, 'cm', { min: 0, max: 100 }),
        angle(canonicalPropertiesAngle(Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0]) * 180 / Math.PI), true), disabled('scale', 'scale', '%')];
      positionHint = target.kind === 'contour' ? 'contour_hint' : freedom.every(Boolean) ? undefined : 'connected_hint';
      geometryHint = target.kind === 'contour' ? 'contour_geometry_hint' : 'wall_hint';
      if (target.kind === 'contour') { actions[0].disabled = 'contour_delete_reason'; featureHint = 'contour_context'; }
    } else if (target.kind === 'column') {
      kind = 'column'; const column = target.value;
      position = [numericPos('x', column.center[0]), numericPos('y', column.center[1])];
      geometry = [number('cm', column.shape === 'circle' ? 'diameter' : 'side', column.cm, 'cm', { min: 1, max: 150 }), disabled('h', 'height'),
        column.shape === 'square' ? angle(column.angle ?? 0) : disabled('angle', 'angle', '°'), disabled('scale', 'scale', '%')];
      featureTitle = 'column'; features.push(choice('shape', 'shape', column.shape, ['square', 'circle'].map(key => ({ value: key, label: t(key as PropertiesString) }))));
    } else if (target.kind === 'opening') {
      const opening = target.value; kind = opening.type;
      position = [numericPos('x', opening.x, true), numericPos('y', opening.y, true)];
      const ref = context.openingReference;
      position.push({ key: 'gap', label: ref?.source === 'host-end' ? 'wall_end_gap' : 'corner_gap',
        value: ref ? ref.distance / NORM_W * factor : null, unit: 'cm', min: 0, max: bounds * 2, wide: true,
        ...(!ref ? { mode: 'readonly', reason: 'gap_unavailable' } as const : {}) });
      positionHint = ref ? 'gap_hint' : 'gap_unavailable';
      geometry = [number('length', 'opening_width', opening.length * factor, 'cm', { min: 20, max: 600, step: 5 }), disabled('h', 'height'), angle(opening.angle, true), disabled('scale', 'scale', '%')];
      geometryHint = 'opening_hint';
      if (opening.type !== 'passage') {
        featureTitle = opening.type === 'door' ? 'door_features' : opening.type;
        if (opening.type === 'door') features.push({ key: 'flip_h', label: 'hinge', value: opening.flip_h === true, control: 'toggle', icon: 'swap', wide: true });
        if (opening.type === 'window') features.push({ key: 'flip_h', label: 'along_wall', value: opening.flip_h === true, control: 'toggle', wide: true },
          { key: 'flip_v', label: 'across_wall', value: opening.flip_v === true, control: 'toggle', wide: true });
        else features.push(choice('flip_v', 'opening_side', opening.flip_v === true, context.openingSides.map((label, i) => ({ value: String(!!i), label }))));
      }
    } else if (target.kind === 'stair') {
      const stair = target.value; kind = stair.kind;
      position = [numericPos('x', stair.x), numericPos('y', stair.y)];
      geometry = [stair.kind === 'straight' ? number('length', 'length', stair.length * factor, 'cm', { min: 30, max: 10000 }) : number('radius', 'radius', stair.radius * factor, 'cm', { min: 30, max: 10000 }),
        stair.kind === 'straight' ? number('w', 'width', stair.width * factor, 'cm', { min: 30, max: 10000 }) : disabled('h', 'height'), angle(stair.angle), disabled('scale', 'scale', '%')];
      const visual = stairVisualStyle(stair, context.stairFallback);
      appearance = [color('stroke', 'stroke', visual.color, visual.opacity), color('fill', 'fill', visual.fillColor, visual.fillOpacity), disabled('stroke_width', 'stroke_width'), disabled('line_style', 'line_style', '')];
      featureTitle = kind;
      const directions = stair.kind === 'straight' ? [['forward', 'up'], ['backward', 'down']] : [['clockwise', 'clockwise'], ['counterclockwise', 'counterclockwise']];
      features.push(choice('direction', 'direction', stair.direction, directions.map(([value, key]) => ({ value, label: t(key as PropertiesString) }))));
    } else if (target.kind === 'device') {
      kind = 'device'; title = target.value.name;
      const pos = context.position(target.value);
      const ghost = target.value.bindingStatus?.kind === 'ha_disabled';
      position = [numericPos('x', pos.x), numericPos('y', pos.y)]; positionHint = 'device_hint';
      geometry[2] = angle(target.marker?.angle ?? 0, false, 'icon_angle');
      geometry[3] = number('size', 'icon_scale', (target.marker?.size ?? 1) * 100, '%', { min: 50, max: 300, step: 10 });
      geometry[2].min = 0; geometry[2].max = 355; geometry[2].step = 5;
      if (ghost) [...position, ...geometry].forEach(field => { if (!field.mode) { field.mode = 'readonly'; field.reason = 'ghost_reason'; } });
      geometryHint = 'device_size_hint'; featureHint = 'device_settings_hint';
      features.push({ key: 'settings', label: 'device_settings', value: '', control: 'action', wide: true, action: 'settings' });
      actions = [action('copy', 'copy', 'copy', ghost ? 'ghost_reason' : undefined), action('delete', 'delete', 'delete')];
    } else if (target.kind === 'led') {
      kind = 'led'; title = target.device?.name ?? t('led'); const points = target.value.points;
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      position = [numericPos('x', (Math.min(...xs) + Math.max(...xs)) / 2, true), numericPos('y', (Math.min(...ys) + Math.max(...ys)) / 2, true)];
      const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
      geometry[0] = number('length', 'led_length', length * factor, 'cm', { mode: 'readonly' });
      positionHint = 'led_position'; geometryHint = 'led_hint'; featureHint = 'led_device_hint'; const orphan = !target.device;
      features.push({ key: 'settings', label: 'device_settings', value: '', control: 'action', wide: true, ...(orphan ? { mode: 'disabled', reason: 'orphan_strip_reason' } : {}) });
      actions = [action('copy', 'copy', 'copy', orphan ? 'orphan_strip_reason' : undefined), action('display_device', 'display_device', 'settings', orphan ? 'orphan_strip_reason' : undefined)];
    } else if (target.kind === 'backdrop') {
      kind = 'backdrop'; const rect = planRect(target.value);
      try { title = decodeURIComponent(new URL(target.value.plan_url!, 'https://houseplan.invalid').pathname.split('/').pop() || '') || t('backdrop'); } catch { title = t('backdrop'); }
      position = [numericPos('x', (rect.x + rect.w / 2) / NORM_W), numericPos('y', (rect.y + rect.h / 2) / NORM_W)];
      geometry = [number('w', 'width', rect.w / NORM_W * factor, 'cm'), number('h', 'height', rect.h / NORM_W * factor, 'cm'), angle(rect.angle ?? 0), disabled('scale', 'scale', '%')];
      appearance[2] = number('opacity', 'opacity', (target.value.plan_opacity ?? 1) * 100, '%', { min: 0, max: 100 });
      positionHint = 'backdrop_hint'; featureHint = 'reset_hint'; features.push({ key: 'reset', label: 'reset_backdrop', value: '', control: 'action', action: 'reset', icon: 'reset', wide: true });
      actions = [action('delete', 'delete', 'delete', 'backdrop_delete_reason')];
    } else if (target.kind === 'decor') {
      const shape = target.value, box = decorPropertiesBox(shape, context.textBox(shape)); kind = shape.kind;
      position = [numericPos('x', box.x), numericPos('y', box.y)];
      geometry[2] = angle(box.angle);
      if (shape.kind === 'line') geometry[0] = number('length', 'length', box.w * factor, 'cm', { min: cellCm, max: bounds * 2 });
      else { geometry[0] = number('w', 'width', box.w * factor, 'cm', { min: shape.kind==='rect'||shape.kind==='ellipse'?cellCm:.1, max: CANVAS_LIMIT * cellCm });
        geometry[1] = number('h', 'height', box.h * factor, 'cm', { min: shape.kind==='rect'||shape.kind==='ellipse'?cellCm:.1, max: CANVAS_LIMIT * cellCm }); }
      if (shape.kind === 'text') {
        title = context.textName?.(shape) || t('text');
        geometry[0].mode = geometry[1].mode = 'readonly';
        geometry[3] = number('size_cm', 'font', context.fontCm(shape), 'cm', { min: .1, max: 2000 });
        positionHint = 'text_center_hint'; geometryHint = 'text_size_hint'; featureTitle = 'text';
        features.push({ key: 'text', label: 'text', value: shape.text, control: 'text', wide: true });
      }
      if (shape.kind === 'image') {
        appearance[2] = number('opacity', 'opacity', (shape.opacity ?? 1) * 100, '%', { min: 0, max: 100 });
        title = context.imageName(shape.asset_id) || t('image'); featureTitle = 'image_features'; positionHint = 'image_hint';
        reflection(shape); features.push({ key: 'ratio', label: 'keep_ratio', value: context.ratioLocked, control: 'toggle', icon: 'link', section: 'proportions', wide: true });
        actions = [action('replace', 'replace', 'image'), action('delete', 'delete', 'delete')];
      } else {
        const visual = decorStyleOf(shape, cellCm, GRID_PITCH);
        appearance[0] = color('stroke', shape.kind === 'text' ? 'text_color' : 'stroke', visual.color, visual.opacity);
        if (shape.kind !== 'text') appearance[2] = number('width_cm', 'stroke_width', visual.widthCm, 'cm', { min: .1, max: 100 });
        if (shape.kind === 'rect' || shape.kind === 'ellipse') appearance[1] = {
          ...color('fill', 'fill', visual.fillColor, visual.fillOpacity), value: { color: visual.fillColor, opacity: visual.fillOpacity, noFill: !visual.fill },
        };
        if (shape.kind === 'line') appearance[3] = { key: 'line_style', label: 'line_style', value: shape.line_style ?? 'solid', control: 'select', options: ['solid', 'dashed'].map(value => ({ value, label: t(value as PropertiesString) })) };
        if (shape.kind === 'furniture') { featureTitle = 'furniture'; reflection(shape); }
      }
    }
    if (title === t('empty') && kind) title = t(kind);
  }
  const groups: PropertiesGroup[] = [
    { key: 'position', title: 'position', fields: position, hint: positionHint },
    { key: 'geometry', title: 'geometry', fields: geometry, hint: geometryHint },
    { key: 'appearance', title: 'appearance', fields: appearance },
  ];
  if (features.length || featureHint) groups.push({ key: 'features', title: featureTitle,
    icon: target?.kind==='opening' ? target.value.type : target?.kind==='decor' ? target.value.kind : undefined,
    fields: features, hint: featureHint });
  const owners = target?.kind === 'contour' ? propertiesContourRooms(target.value, space.rooms ?? []) : [];
  const meta = !target ? '' : target.kind === 'partition' ? t('wall_meta', {space:space.title})
    : target.kind === 'contour' ? owners.length ? t('contour_named_meta', {room: owners.join(' — '), space:space.title}) : t('contour_meta', {space:space.title})
    : target.kind === 'opening' && context.openingRooms?.length ? `${space.title} · ${context.openingRooms.join(' — ')}`
    : target.kind === 'decor' && ['rect','ellipse','line'].includes(target.value.kind) ? t('decor_meta', {space:space.title})
    : `${kind ? t(kind) + ' · ' : ''}${space.title}`;
  return { title, meta, groups, actions };
}
