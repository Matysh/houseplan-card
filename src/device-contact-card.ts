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

interface ContactCard {
  renderRoot: ParentNode;
  _config?: { icon_size?: number };
  _renderProjection: string; _mode: string; _markup: boolean;
  _kioskScale: { icon: number };
  _renderDevices: readonly DevItem[];
  _deviceHits: DeviceHitController;
  _spaceModel(): SpaceModel | undefined;
  _floorKey(id: string): string;
  _spaceDisplayForRender(): { showBorders: boolean };
  _wallUnionGeometry(): { components: readonly { geom: ContactMasonry }[] } | null;
  _zeroWalls(): { lines: number[][] };
  _pos(d: DevItem): { x: number; y: number };
  _devicePresentation(d: DevItem): ResolvedDevicePresentation;
  _invalidateDeviceHitGeometry(): void;
}
const wallCache = new WeakMap<object, { key: string; walls: ReturnType<typeof deviceContactWalls>; masonry: ContactMasonry }>();
export function syncHouseplanDeviceContacts(value: object, renderer: DeviceContactRenderer): void {
  const host = value as ContactCard, space = host._spaceModel();
  if (host._deviceHits.contactGeometry !== renderer.hit) host._deviceHits.contactGeometry = renderer.hit;
  if (!space || host._renderProjection === 'iso') { renderer.clear(); return; }
  const visible = host._spaceDisplayForRender().showBorders || host._markup;
  const key = `${host._floorKey(space.id)}|${visible}`;
  let wall = wallCache.get(host);
  if (wall?.key !== key) {
    const masonry = visible ? host._wallUnionGeometry()?.components.flatMap((c) => c.geom) || [] : [];
    wall = { key, masonry, walls: visible ? deviceContactWalls(masonry, host._zeroWalls().lines) : [] };
    wallCache.set(host, wall);
  }
  const size = host._config?.icon_size ?? 2.5;
  const base = effectiveDeviceBaseSize(size > 8 ? 2.5 : size) / 100 * iconUnit(space)
    * (host._mode === 'view' ? host._kioskScale.icon : 1);
  const changed = renderer.sync(host.renderRoot, { key, enabled: true, walls: wall.walls, masonry: wall.masonry,
    markers: positionableIconMarkers(host._renderDevices, space.id, ledStripsByMarker(space)).map((d) => ({
      id: d.id, ...host._pos(d), diameter: base * host._devicePresentation(d).scale,
    })) });
  if (changed) host._invalidateDeviceHitGeometry();
}
