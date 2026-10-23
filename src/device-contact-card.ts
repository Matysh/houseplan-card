/** Full-card adapter, loaded with the existing fingerprinted live runtime. */
import { deviceContactWalls, type ContactMasonry } from './device-contact-walls';
import type { DeviceContactRenderer } from './device-contact-render';
import { positionableIconMarkers } from './device-icon-roster';
import { ledStripsByMarker } from './led-strip-gate';
import { effectiveDeviceBaseSize } from './device-marker-geometry';
import { iconUnit } from './space-geometry';
import type { DevItem, SpaceModel } from './types';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { DeviceHitController } from './device-hit-owner';
import { floorGeometryKeyReader, type FloorKeySource } from './floor-geometry-key';
import { contentFingerprint } from './visual-continuity';
import type { HassRenderSnapshot } from './render-invalidation';

interface ContactCard extends FloorKeySource {
  renderRoot: ParentNode;
  _config?: { icon_size?: number };
  _renderProjection: string; _mode: string; _markup: boolean;
  _kioskScale: { icon: number };
  _renderDevices: readonly DevItem[];
  _deviceHits: DeviceHitController;
  _spaceModel(): SpaceModel | undefined;
  _spaceDisplayForRender(): { showBorders: boolean };
  _wallUnionGeometry(): { components: readonly { geom: ContactMasonry }[] } | null;
  _zeroWalls(): { lines: number[][] };
  _pos(d: DevItem, contacts?:boolean): { x: number; y: number };
  _devicePresentation(d: DevItem): ResolvedDevicePresentation;
  _invalidateDeviceHitGeometry(): void;
  _layout: Record<string,{x:number;y:number;s?:string;contact_basis?:unknown}>;
  _deviceDrag?: {id:string;pointerId:number;moved:boolean;lastPointer?:{clientX:number;clientY:number;altKey:boolean}} | null;
  _pointerMoveNow(ev:PointerEvent,d:DevItem):void;
  requestUpdate(): void;
}
/** Keep ordinary HA ticks deferred during gestures. Only values consumed by
 * the held component may refresh its actual faces without losing capture. */
export function contactValueFrameChanged(value:object,renderer:DeviceContactRenderer,
  before:HassRenderSnapshot|null|undefined,after:HassRenderSnapshot|null|undefined):boolean {
  const host=value as ContactCard,id=host._deviceDrag?.id;
  if(!id||!host._renderDevices||!before||!after)return false;
  const members=new Set(renderer.scene?.component(id)??[id]);
  for(const d of host._renderDevices)if(members.has(d.id)){
    const p=host._devicePresentation(d),ids=new Set<string>();
    if(p.valueSource?.eid)ids.add(p.valueSource.eid);
    const source=p.valueBadge?.source;
    if(source?.kind==='entity_state'||source?.kind==='entity_attribute')ids.add(source.entity_id);
    if(p.tempText||p.humText||d.marker?.use_climate_temp
        ||source?.kind==='derived_lqi'||p.valueSource?.kind==='derived_lqi')for(const eid of d.entities)ids.add(eid);
    if(source?.kind==='derived_marker_state'||p.valueSource?.kind==='derived_marker_state')
      for(const s of p.visualSources)ids.add(s.eid);
    for(const eid of ids)if(before.states?.[eid]!==after.states?.[eid])return true;
  }
  return false;
}
const wallCache = new WeakMap<object, { key: string; walls: ReturnType<typeof deviceContactWalls>; masonry: ContactMasonry }>();
const wallKeys = new WeakMap<object, (spaceId: string) => string>();
// Decor never changes masonry. Keep every other current/model-record field,
// including unknown compatible inputs, and the reader's epoch/identity rules.
const withoutDecor = (record: unknown): unknown => record && typeof record === 'object' && !Array.isArray(record)
  ? Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'decor')) : record;
const wallFingerprint = (records: unknown): string => contentFingerprint(
  Array.isArray(records) ? records.map(withoutDecor) : withoutDecor(records),
);
export function syncHouseplanDeviceContacts(value: object, renderer: DeviceContactRenderer): void {
  const host = value as ContactCard, space = host._spaceModel();
  if (host._deviceHits.contactGeometry !== renderer.hit) host._deviceHits.contactGeometry = renderer.hit;
  if (!space || host._renderProjection === 'iso') { renderer.clear(); return; }
  const visible = host._spaceDisplayForRender().showBorders || host._markup;
  let keyOf = wallKeys.get(host);
  if (!keyOf) { keyOf = floorGeometryKeyReader(host, wallFingerprint); wallKeys.set(host, keyOf); }
  const key = `${keyOf(space.id)}|${visible}`;
  let wall = wallCache.get(host);
  if (wall?.key !== key) {
    const masonry = visible ? host._wallUnionGeometry()?.components.flatMap((c) => c.geom) || [] : [];
    wall = { key, masonry, walls: visible ? deviceContactWalls(masonry, host._zeroWalls().lines) : [] };
    wallCache.set(host, wall);
  }
  const size = host._config?.icon_size ?? 2.5;
  const base = effectiveDeviceBaseSize(size > 8 ? 2.5 : size) / 100 * iconUnit(space)
    * (host._mode === 'view' ? host._kioskScale.icon : 1);
  const wasReflowed=renderer.reflowed;
  const changed = renderer.sync(host.renderRoot, { key, enabled: true, walls: wall.walls, masonry: wall.masonry,
    space:space.id,layout:host._layout,invalidate:()=>host.requestUpdate(),
    markers: positionableIconMarkers(host._renderDevices, space.id, ledStripsByMarker(space)).map((d) => ({
      id: d.id, ...host._pos(d,false), virtual:d.virtual===true||d.bindingKind==='virtual', diameter: base * host._devicePresentation(d).scale,
    })) });
  if (changed) {
    host._invalidateDeviceHitGeometry();
    const drag=host._deviceDrag,d=drag&&host._renderDevices.find(d=>d.id===drag.id);
    if(drag?.moved&&drag.lastPointer&&d)host._pointerMoveNow(new PointerEvent('pointermove',{
      ...drag.lastPointer,pointerId:drag.pointerId,
    }),d);
    // Painting a contour alone must not interrupt another editor's live layer.
    if(wasReflowed||renderer.reflowed)host.requestUpdate();
  }
}
