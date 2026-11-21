import { detachedTv, tvCabinet } from './tv-mount';
import type {FurniturePart} from './furniture-volume-types';
import type {DecorFurniture, DecorShape} from './editors/decor/types';
import {furnitureSymbol} from './furniture';

// Coordinates in the original top-view SVGs (desk 140 × 70, computer 120 × 60).
// The rightmost 30 cm of the computer drawing contain the freestanding tower.
export function desktopSurface(symbol: string) {
  const table = furnitureSymbol(symbol);
  if (!table || !['desk','desk_corner'].includes(symbol)) return null;
  const {w,h} = table;
  // The corner model has a full-width rear wing above its inside cutout.
  if (symbol === 'desk_corner') return {w,h,x:40,y:3,scale:1};
  const scale = Math.min(1, w/80, h/60);
  return {w,h,x:(w-80*scale)/2,y:(h-60*scale)/2,scale};
}
export const TOWER_BOX = {x:90, y:0, width:30, height:60};
const isTower = (p: FurniturePart) => p.name.startsWith('tower-') || p.name === 'power-button';

function rotated(x: number, y: number, angle = 0) {
  const radians = angle * Math.PI / 180;
  return [x*Math.cos(radians)-y*Math.sin(radians), x*Math.sin(radians)+y*Math.cos(radians)];
}

// Compare desktop centres in desk-local coordinates, including mirrored and
// rotated placements. The missing quadrant of the L is not a work surface.
function mountDistance(desk: DecorFurniture, pc: DecorFurniture) {
  const [ox,oy] = rotated((pc.flip_h ? 1 : -1)*pc.w/6, 0, pc.angle);
  const [dx,dy] = rotated(pc.x+pc.w/2+ox-desk.x-desk.w/2,
    pc.y+pc.h/2+oy-desk.y-desk.h/2, -(desk.angle || 0));
  const x = .5 + dx/desk.w*(desk.flip_h ? -1 : 1);
  const y = .5 + dy/desk.h*(desk.flip_v ? -1 : 1);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return Infinity;
  if (desk.symbol === 'desk_corner' && y > .41 && x > .43) return Infinity;
  const top = desktopSurface(desk.symbol)!;
  return Math.hypot(x-(top.x+40*top.scale)/top.w, y-(top.y+30*top.scale)/top.h);
}

export function workstationTarget(items: readonly DecorShape[], selected: DecorShape) {
  if (selected.kind !== 'furniture') return null;
  const isDesk = !!desktopSurface(selected.symbol);
  if (!isDesk && (selected.symbol !== 'computer' || selected.workstation)) return null;
  if (isDesk && selected.workstation === 'mounted') {
    const pc = items.find(item => item.id === selected.workstation_tower_id);
    return pc?.kind === 'furniture' && pc.symbol === 'computer' && pc.workstation === 'tower'
      ? {desk:selected, pc} : null;
  }
  let distance = Infinity;
  let match: {desk:DecorFurniture; pc:DecorFurniture} | null = null;
  for (const item of items) {
    if (item.kind !== 'furniture' || item.workstation) continue;
    const desk = isDesk ? selected : item, pc = isDesk ? item : selected;
    if (desk.workstation || !desktopSurface(desk.symbol) || pc.symbol !== 'computer') continue;
    const d = mountDistance(desk,pc);
    if (d < distance) { match = {desk,pc}; distance = d; }
  }
  return match;
}

/** Reassemble around the CURRENT tower, not the desk's initial transform. */
export function standaloneWorkstation<T extends DecorShape>(shape: T): T {
  if (shape.kind !== 'furniture') return shape;
  if (shape.tv_cabinet_id) return detachedTv(shape) as T;
  if (!shape.workstation && !shape.workstation_tower_id) return shape;
  const out: DecorFurniture = {...shape};
  if (shape.symbol === 'computer' && shape.workstation === 'tower') {
    const w = shape.w * 4;
    const [dx,dy] = rotated((shape.flip_h ? -1 : 1)*w*.375, 0, shape.angle);
    Object.assign(out, {w, x:shape.x+shape.w/2-dx-w/2, y:shape.y-dy});
  }
  delete out.workstation; delete out.workstation_tower_id;
  return out as T;
}

export function toggleWorkstation(items: readonly DecorShape[], desk: DecorFurniture, pc: DecorFurniture | null): readonly DecorShape[] {
  if (!desktopSurface(desk.symbol) || !items.includes(desk)) return items;
  if (desk.workstation === 'mounted') {
    const tower = items.find(item => item.id === desk.workstation_tower_id);
    if (tower?.kind !== 'furniture' || tower.symbol !== 'computer' || tower.workstation !== 'tower') return items;
    return items.map(item => item === desk || item === tower ? standaloneWorkstation(item) : item);
  }
  if (!pc || !items.includes(pc) || pc.symbol !== 'computer' || pc.workstation || desk.workstation
      || !Number.isFinite(mountDistance(desk, pc))) return items;
  // Crop the original right-hand tower in place. Mounting must not move it to
  // the desk, replace its orientation, or change another piece of furniture.
  const w = pc.w / 4;
  const [dx,dy] = rotated((pc.flip_h ? -1 : 1)*pc.w*.375, 0, pc.angle);
  return items.map(item => item === desk
    ? {...desk, workstation:'mounted' as const, workstation_tower_id:pc.id}
    : item === pc ? {...pc, workstation:'tower' as const, w,
      x:pc.x+pc.w/2+dx-w/2, y:pc.y+dy} : item);
}

/** Copying a partial pair never leaves a pointer into the source space. */
export function remapWorkstationItems<T extends DecorShape>(items: readonly T[], ids: ReadonlyMap<string,string>): T[] {
  const claimed = new Set<string>();
  const linked = items.map(item => {
    if (item.kind !== 'furniture') return item;
    if (item.tv_cabinet_id) {
      const target = ids.get(item.tv_cabinet_id);
      if (!target || !tvCabinet(items, { ...item, tv_cabinet_id: target }) || claimed.has(target)) {
        return detachedTv(item);
      }
      claimed.add(target);
      return { ...item, tv_cabinet_id: target };
    }
    if (item.workstation !== 'mounted') return item;
    const tower = ids.get(item.workstation_tower_id || '');
    if (!tower || !items.some(candidate => candidate.id === tower && candidate.kind === 'furniture'
        && candidate.symbol === 'computer' && candidate.workstation === 'tower') || claimed.has(tower)) {
      return standaloneWorkstation(item);
    }
    claimed.add(tower);
    return {...item, workstation_tower_id:tower};
  });
  return linked.map(item => item.kind === 'furniture' && item.workstation === 'tower' && !claimed.has(item.id)
    ? standaloneWorkstation(item) : item) as T[];
}

/** One delete transaction also detaches its surviving counterpart. */
export function removeWorkstationItems(items: readonly DecorShape[], ids: ReadonlySet<string>): DecorShape[] {
  const detach = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'furniture' || item.workstation !== 'mounted') continue;
    if (ids.has(item.id) && item.workstation_tower_id) detach.add(item.workstation_tower_id);
    if (item.workstation_tower_id && ids.has(item.workstation_tower_id)) detach.add(item.id);
  }
  return items.filter(item => !ids.has(item.id)).map(item => {
    if (item.kind === 'furniture' && item.tv_cabinet_id && ids.has(item.tv_cabinet_id)) {
      return detachedTv(item, tvCabinet(items, item));
    }
    return detach.has(item.id) ? standaloneWorkstation(item) : item;
  });
}

export function workstationParts(shape: Pick<DecorFurniture,'symbol'|'workstation'>,
  base: readonly FurniturePart[], computer: readonly FurniturePart[]): readonly FurniturePart[] {
  const surface = desktopSurface(shape.symbol);
  const onDesk = surface && shape.workstation === 'mounted';
  const tower = shape.symbol === 'computer' && shape.workstation === 'tower';
  if (!onDesk && !tower) return base;
  const source = computer.filter(p => isTower(p) === tower);
  if (!source.length) return base;
  const top = base.find(p => p.name === 'tabletop');
  if (onDesk && !top) return base;
  const dz = onDesk ? top!.top - Math.min(...source.map(p => p.bottom)) : 0;
  const width = onDesk ? surface.w : TOWER_BOX.width, height = onDesk ? surface.h : TOWER_BOX.height;
  const scale = onDesk ? surface.scale : 1;
  const dx = onDesk ? surface.x : -TOWER_BOX.x, dy = onDesk ? surface.y : 0;
  const equipment = source.map(p => ({
    ...p,
    x:(dx+p.x*120*scale)/width, y:(dy+p.y*60*scale)/height, w:p.w*120*scale/width, h:p.h*60*scale/height,
    bottom:p.bottom+dz, top:p.top+dz,
    ...(p.inset ? {inset:[p.inset[0]*120*scale/width,p.inset[1]*60*scale/height,p.inset[2]] as const} : {}),
  }));
  return onDesk ? [...base,...equipment] : equipment;
}
