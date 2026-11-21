import type { DecorFurniture, DecorShape } from './editors/decor/types';

const isTelevision = (item: DecorShape): item is DecorFurniture =>
  item.kind === 'furniture' && item.symbol === 'tv';
const isCabinet = (item: DecorShape): item is DecorFurniture =>
  item.kind === 'furniture' && item.symbol === 'cabinet_tv';

export function tvCabinet(items: readonly DecorShape[], tv: DecorFurniture): DecorFurniture | undefined {
  return isTelevision(tv) && tv.tv_cabinet_id
    ? items.find((item): item is DecorFurniture => isCabinet(item) && item.id === tv.tv_cabinet_id)
    : undefined;
}

export function tvOnCabinet(tv: DecorFurniture, cabinet: DecorFurniture): DecorFurniture {
  return {
    ...tv,
    x: cabinet.x + (cabinet.w - tv.w) / 2,
    y: cabinet.y + (cabinet.h - tv.h) / 2,
    angle: cabinet.angle,
    flip_h: cabinet.flip_h,
    flip_v: cabinet.flip_v,
  };
}

function distanceOnCabinet(tv: DecorFurniture, cabinet: DecorFurniture): number {
  const dx = tv.x + tv.w / 2 - (cabinet.x + cabinet.w / 2);
  const dy = tv.y + tv.h / 2 - (cabinet.y + cabinet.h / 2);
  const angle = -(cabinet.angle ?? 0) * Math.PI / 180;
  const x = dx * Math.cos(angle) - dy * Math.sin(angle);
  const y = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(x) <= cabinet.w / 2 && Math.abs(y) <= cabinet.h / 2
    ? Math.hypot(dx, dy) : Infinity;
}

export interface TvMountTarget {
  readonly tv: DecorFurniture;
  readonly cabinet: DecorFurniture;
  readonly mounted: boolean;
}

export function tvMountTarget(items: readonly DecorShape[], selected: DecorShape): TvMountTarget | null {
  const cabinetSelected = isCabinet(selected);
  if (!cabinetSelected && !isTelevision(selected)) return null;
  const currentCabinet = cabinetSelected ? selected : tvCabinet(items, selected);
  const occupant = currentCabinet && items.find((item): item is DecorFurniture =>
    isTelevision(item) && item.tv_cabinet_id === currentCabinet.id);
  if (currentCabinet && occupant) return { tv: occupant, cabinet: currentCabinet, mounted: true };

  const occupied = new Set(items.filter(isTelevision).map(item => item.tv_cabinet_id));
  let nearest = Infinity;
  let target: TvMountTarget | null = null;
  for (const item of items) {
    const tv = cabinetSelected ? item : selected;
    const cabinet = cabinetSelected ? selected : item;
    if (!isTelevision(tv) || tv.tv_cabinet_id || !isCabinet(cabinet) || occupied.has(cabinet.id)) continue;
    const distance = distanceOnCabinet(tv, cabinet);
    if (distance < nearest) {
      nearest = distance;
      target = { tv, cabinet, mounted: false };
    }
  }
  return target;
}

export function detachedTv(tv: DecorFurniture, cabinet?: DecorFurniture): DecorFurniture {
  const result = cabinet ? tvOnCabinet(tv, cabinet) : { ...tv };
  delete result.tv_cabinet_id;
  return result;
}

export function toggleTvMount(items: readonly DecorShape[], target: TvMountTarget): DecorShape[] {
  const { tv, cabinet, mounted } = target;
  const next = mounted
    ? detachedTv(tv, cabinet)
    : { ...tvOnCabinet(tv, cabinet), tv_cabinet_id: cabinet.id };
  return items.map(item => item === tv ? next : item);
}
