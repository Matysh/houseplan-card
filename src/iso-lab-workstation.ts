import type {FurniturePart} from './furniture-volume-types';
import type {DecorFurniture, DecorShape} from './editors/decor/types';
import {furnitureSymbol} from './furniture';

// Coordinates in the original top-view SVGs (desk 140 × 70, computer 120 × 60).
// The rightmost 30 cm of the computer drawing contain the freestanding tower.
export function desktopSurface(symbol: string) {
  const table = furnitureSymbol(symbol);
  if (!table || !['work_table','coffee_table','dining_table'].includes(table.category)) return null;
  const {w,h} = table;
  // The corner model has a full-width rear wing above its inside cutout.
  if (symbol === 'desk_corner') return {w,h,x:40,y:3,scale:1};
  const curved = symbol.endsWith('_round') || symbol.endsWith('_oval');
  const scale = curved ? Math.min(1, .96 / Math.hypot(80/w, 60/h)) : Math.min(1, w/80, h/60);
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
  if ((desk.symbol.endsWith('_round') || desk.symbol.endsWith('_oval')) && Math.hypot((x-.5)/.48,(y-.5)/.48)>1) return Infinity;
  return Math.hypot(x-(top.x+40*top.scale)/top.w, y-(top.y+30*top.scale)/top.h);
}

export function workstationTarget(items: readonly DecorShape[], selected: DecorShape) {
  if (selected.kind !== 'furniture') return null;
  const isDesk = !!desktopSurface(selected.symbol);
  if (!isDesk && (selected.symbol !== 'computer' || selected.lab_workstation)) return null;
  if (isDesk && selected.lab_workstation === 'mounted') return {desk:selected, pc:null};
  let distance = Infinity;
  let match: {desk:DecorFurniture; pc:DecorFurniture | null} | null =
    isDesk && furnitureSymbol(selected.symbol)?.category === 'work_table' ? {desk:selected, pc:null} : null;
  for (const item of items) {
    if (item.kind !== 'furniture' || item.lab_workstation) continue;
    const desk = isDesk ? selected : item, pc = isDesk ? item : selected;
    if (!desktopSurface(desk.symbol) || pc.symbol !== 'computer') continue;
    const d = mountDistance(desk,pc);
    if (d < distance) { match = {desk,pc}; distance = d; }
  }
  return match;
}

export function toggleWorkstation(items: readonly DecorShape[], desk: DecorFurniture, pc: DecorFurniture | null) {
  const next = {...desk};
  const removing = desk.lab_workstation === 'mounted';
  if (removing) { delete next.lab_workstation; delete next.lab_tower_id; }
  else { next.lab_workstation = 'mounted'; if (pc) next.lab_tower_id = pc.id; }
  return items.map(item => {
    if (item.id === desk.id) return next;
    if (item.kind !== 'furniture') return item;
    if (removing && item.id === desk.lab_tower_id && item.lab_workstation === 'tower') {
      // Reassemble the native drawing around the independently moved tower.
      const w = item.w * 4;
      const [dx,dy] = rotated((item.flip_h ? -1 : 1)*w*.375, 0, item.angle);
      const full = {...item, w, x:item.x+item.w/2-dx-w/2, y:item.y-dy};
      delete full.lab_workstation;
      return full;
    }
    if (!pc || item.id !== pc.id) return item;
    const w = pc.w / 4, h = pc.h, top = desktopSurface(desk.symbol)!;
    const [dx,dy] = rotated((desk.flip_h ? -1 : 1)*(desk.w/2+w*.65),
      (desk.flip_v ? -1 : 1)*desk.h*((top.y+30*top.scale)/top.h-.5), desk.angle);
    return {...pc, lab_workstation:'tower' as const, w, h, angle:desk.angle,
      flip_h:desk.flip_h, flip_v:desk.flip_v, x:desk.x+desk.w/2+dx-w/2, y:desk.y+desk.h/2+dy-h/2};
  });
}

export function workstationParts(shape: Pick<DecorFurniture,'symbol'|'lab_workstation'>,
  base: readonly FurniturePart[], computer: readonly FurniturePart[]): readonly FurniturePart[] {
  const surface = desktopSurface(shape.symbol);
  const onDesk = surface && shape.lab_workstation === 'mounted';
  const tower = shape.symbol === 'computer' && shape.lab_workstation === 'tower';
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
