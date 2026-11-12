/** Geometry adapters, with no rendering, snapping, history or write authority. */
import type {OpeningDimension} from './opening-dimensions';
import {spacingChainGaps,type SpacingMagnet} from './device-spacing';
import type {EditorDimensionRecord,DimensionPoint} from './editor-dimension-record';

export function openingDimensionRecord(d:OpeningDimension,id:string,perUnit:number):EditorDimensionRecord {
  return {id,role:'opening-gap',source:'physical',from:d.from,to:d.to,normal:d.labelNormal,
    direction:d.axis,lengthCm:d.distance*perUnit,referenceSource:d.source,roomId:d.roomId};
}
export function lineDimensionRecord(a:DimensionPoint,b:DimensionPoint,perUnit:number):EditorDimensionRecord|null {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!(length>0))return null;
  let normal:DimensionPoint=[(b[1]-a[1])/length,-(b[0]-a[0])/length];
  if(normal[1]>1e-6 || Math.abs(normal[1])<1e-6&&normal[0]>0)normal=[-normal[0],-normal[1]];
  return {id:'decor-line',role:'decor-line',source:'physical',from:a,to:b,normal,lengthCm:length*perUnit};
}
export function spacingDimensionRecords(magnet:SpacingMagnet<unknown>,perUnit:number):EditorDimensionRecord[] {
  return magnet.hint.flatMap(row=>spacingChainGaps(row).map(([a,b],index)=>({
    id:`spacing:${row.axis}:${row.line}:${index}`,role:'device-spacing' as const,source:'physical' as const,
    from:row.axis==='h'?[a,row.line] as const:[row.line,a] as const,
    to:row.axis==='h'?[b,row.line] as const:[row.line,b] as const,
    normal:row.axis==='h'?[0,-1] as const:[-1,0] as const,
    lengthCm:Math.abs(b-a)*perUnit,clearance:magnet.clear,
  })));
}
