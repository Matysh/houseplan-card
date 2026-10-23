/** Durable reference faces, not live values or effective layout positions. */
import { validContactMarker, type ContactMarker, type ContactRect } from './device-contact-geometry';

export interface ContactBasis {
  v: 1;
  /** s is the space ID of this original layout entry, never a group ID. */
  at: { x: number; y: number; s: string };
  diameter: number;
  box: [number, number, number, number];
  legacy?: boolean;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value==='object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value==='number' && Number.isFinite(value);
const bounded = (value: unknown): value is number => finite(value) && Math.abs(value)<=5000;

/** Unknown/future/malformed input remains in storage but grants no constraints. */
export function readContactBasis(value: unknown): ContactBasis | null {
  if(!record(value)||value.v!==1||!record(value.at)||!bounded(value.at.x)||!bounded(value.at.y)
      || typeof value.at.s!=='string'||!value.at.s.length||value.at.s.length>64
      || !finite(value.diameter)||value.diameter<=0||value.diameter>10000
      || value.legacy!==undefined&&typeof value.legacy!=='boolean'
      || !Array.isArray(value.box)||value.box.length!==4||!value.box.every(bounded)) return null;
  const [left,top,right,bottom]=value.box as number[];
  if(right<=left||bottom<=top) return null;
  return {v:1,at:{x:value.at.x,y:value.at.y,s:value.at.s},diameter:value.diameter,box:[left,top,right,bottom],
    ...(value.legacy===true?{legacy:true}:{})};
}

export function contactBasisMarker(
  marker: ContactMarker, entry: {x:number;y:number;s?:string;contact_basis?:unknown} | undefined, space: string,
): ContactMarker | null {
  const basis=readContactBasis(entry?.contact_basis);
  if(!entry || !basis || basis.at.s!==space || entry.s!==space
      || basis.at.x!==entry.x || basis.at.y!==entry.y) return null;
  const [left,top,right,bottom]=basis.box.map(v=>v*1000);
  const result={...marker,x:entry.x*1000,y:entry.y*1000,diameter:basis.diameter*1000,box:{left,top,right,bottom},precise:basis.legacy!==true};
  return validContactMarker(result)?result:null;
}

export function makeContactBasis(marker: ContactMarker, space: string): ContactBasis {
  return {v:1,at:{x:marker.x/1000,y:marker.y/1000,s:space},diameter:marker.diameter/1000,
    box:[marker.box.left/1000,marker.box.top/1000,marker.box.right/1000,marker.box.bottom/1000]};
}

export function sameContactRect(a: ContactRect,b: ContactRect): boolean {
  return a.left===b.left&&a.top===b.top&&a.right===b.right&&a.bottom===b.bottom;
}
