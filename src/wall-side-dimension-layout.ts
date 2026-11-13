/** Screen-space-only derivation. Physical endpoints never move to make room
 * for text; witness lines always leave those endpoints along the normal. */
import type {EditorDimensionRecord,DimensionPoint} from './editor-dimension-record';
export interface DimensionBox {x:number;y:number;w:number;h:number}
/** Convert a fixed UI surface to the same CSS-pixel viewport as dimensions.
 * The overlay is not plan geometry: camera pan/zoom must never project it. */
export function screenDimensionObstacle(stage:DimensionBox,overlay:DimensionBox,
  width:number,height:number):DimensionBox|null {
  if(!(stage.w>0&&stage.h>0&&overlay.w>0&&overlay.h>0&&width>0&&height>0))return null;
  const left=Math.max(stage.x,overlay.x),top=Math.max(stage.y,overlay.y);
  const right=Math.min(stage.x+stage.w,overlay.x+overlay.w),bottom=Math.min(stage.y+stage.h,overlay.y+overlay.h);
  if(!(right>left&&bottom>top))return null;
  return{x:(left-stage.x)*width/stage.w,y:(top-stage.y)*height/stage.h,
    w:(right-left)*width/stage.w,h:(bottom-top)*height/stage.h};
}
/** Cached scene math for the visible Resize glyph, not its larger invisible
 * hit disk. Matches _renderResizeLayer's half-size wall/arrows and neutral
 * stroke; no live DOM layout read is needed for a measurement label. */
export function resizeHandleDimensionObstacle(a:DimensionPoint,b:DimensionPoint,
  project:(p:DimensionPoint)=>DimensionPoint,viewWidth:number,stageWidth:number):DimensionBox|null {
  const p=project(a),q=project(b),length=Math.hypot(q[0]-p[0],q[1]-p[1]);
  if(!(length>0)||!(viewWidth>0))return null;
  const ux=Math.abs(q[0]-p[0])/length,uy=Math.abs(q[1]-p[1])/length;
  const s=Math.max(viewWidth*.013,5)/2*stageWidth/viewWidth;
  const center=project([Math.round((a[0]+b[0])*5)/10,Math.round((a[1]+b[1])*5)/10]);
  const hw=s*(.7*ux+uy)+2,hh=s*(.7*uy+ux)+2;
  return{x:center[0]-hw,y:center[1]-hh,w:2*hw,h:2*hh};
}
export interface DimensionPlacement {
  interval:EditorDimensionRecord; number:number; label:string; lane:number;
  a:DimensionPoint;b:DimensionPoint;railA:DimensionPoint;railB:DimensionPoint;
  normal:DimensionPoint;tangent:DimensionPoint;
  labelCenter:DimensionPoint;labelBox:DimensionBox;listed:boolean;
}
const add=(a:DimensionPoint,b:DimensionPoint,n=1):DimensionPoint=>[a[0]+b[0]*n,a[1]+b[1]*n];
const unit=(a:DimensionPoint):DimensionPoint=>{const l=Math.hypot(...a)||1;return[a[0]/l,a[1]/l];};
const overlaps=(a:DimensionBox,b:DimensionBox):boolean=>a.x<b.x+b.w+3&&b.x<a.x+a.w+3&&a.y<b.y+b.h+3&&b.y<a.y+a.h+3;
const within=(box:DimensionBox,w:number,h:number):boolean=>box.x>=4&&box.y>=4&&box.x+box.w<=w-4&&box.y+box.h<=h-4;
export interface DimensionLayoutInput {
  intervals:readonly EditorDimensionRecord[]; width:number;height:number;
  project(point:DimensionPoint):DimensionPoint;
  format(cm:number):string;
  unavailable:string;
  textWidth(text:string):number;
  obstacles:readonly DimensionBox[];
  /** Retained only for this selection/gesture, never used as geometry. */
  lanes:Map<string,number>;numbers:Map<string,number>;
}
export function layoutWallSideDimensions(input:DimensionLayoutInput):DimensionPlacement[] {
  const occupied=[...input.obstacles],out:DimensionPlacement[]=[];
  for(const interval of input.intervals) {
    const unavailable=interval.source==='unavailable';
    if(!unavailable&&(!interval.from||!interval.to||interval.lengthCm===null
      ||!Number.isFinite(interval.lengthCm)||interval.lengthCm<0
      ||![...interval.from,...interval.to,...interval.normal].every(Number.isFinite)))continue;
    if(!input.numbers.has(interval.id))input.numbers.set(interval.id,input.numbers.size+1);
    const number=input.numbers.get(interval.id)!,markerWidth=Math.max(24,input.textWidth(`[${number}]`)+8);
    const a=unavailable?(interval.anchor?input.project(interval.anchor):[input.width/2,input.height/2] as DimensionPoint):input.project(interval.from!);
    const b=unavailable?a:input.project(interval.to!);
    const direction=input.project(add(interval.from||[0,0],interval.direction||[1,0]));
    const tangent=unit(a[0]===b[0]&&a[1]===b[1]?[direction[0]-a[0],direction[1]-a[1]]:[b[0]-a[0],b[1]-a[1]]);
    const projectedNormal=input.project(add(interval.from||interval.anchor||[0,0],interval.normal));
    const origin=input.project(interval.from||interval.anchor||[0,0]);
    const normal=unit([projectedNormal[0]-origin[0],projectedNormal[1]-origin[1]]);
    const cleared=input.project(add(interval.from||interval.anchor||[0,0],interval.normal,interval.clearance||0));
    const clearance=Math.hypot(cleared[0]-origin[0],cleared[1]-origin[1]);
    const label=unavailable?input.unavailable:input.format(interval.lengthCm!),labelWidth=Math.max(24,input.textWidth(label)+8);
    let lane=input.lanes.get(interval.id)||0,railA:DimensionPoint=a,railB:DimensionPoint=b;
    let center:DimensionPoint=a,box:DimensionBox={x:0,y:0,w:labelWidth,h:16},fits=false;
    // The bound is available screen space, not a quota of dimensions.
    const maxLane=Math.ceil(Math.hypot(input.width,input.height)/16);
    for(let attempt=0;attempt<=maxLane;attempt++) {
      const candidate=attempt===0?lane:attempt-1;
      const offset=clearance+12+16*candidate;
      railA=add(a,normal,offset);railB=add(b,normal,offset);
      center=[(railA[0]+railB[0])/2,(railA[1]+railB[1])/2];
      if(Math.hypot(b[0]-a[0],b[1]-a[1])<labelWidth+8) center=add(center,normal,18);
      box={x:center[0]-labelWidth/2,y:center[1]-8,w:labelWidth,h:16};
      if(within(box,input.width,input.height)&&!occupied.some(obstacle=>overlaps(box,obstacle))) {
        lane=candidate;fits=true;break;
      }
    }
    if(!fits) {
      // All values remain in the scroll-owned list. Keep short numbered
      // witnesses on the correct side, instead of dropping short intervals.
      lane=input.lanes.get(interval.id)||0;
      railA=add(a,normal,clearance+12+16*lane);railB=add(b,normal,clearance+12+16*lane);
      center=[(railA[0]+railB[0])/2,(railA[1]+railB[1])/2];
      center=[Math.max(markerWidth/2+4,Math.min(input.width-markerWidth/2-4,center[0])),Math.max(12,Math.min(input.height-12,center[1]))];
      box={x:center[0]-markerWidth/2,y:center[1]-8,w:markerWidth,h:16};
      // Dense intervals may share their midpoint. Give every numbered marker
      // its own slot rather than stacking indistinguishable [n] at that point.
      const slots:DimensionBox[]=[];
      for(let y=4;y+16<=input.height-4;y+=22)for(let x=4;x+markerWidth<=input.width-4;x+=markerWidth+6)
        slots.push({x,y,w:markerWidth,h:16});
      const distance=(slot:DimensionBox)=>Math.hypot(slot.x+markerWidth/2-center[0],slot.y+8-center[1]);
      slots.sort((a,b)=>distance(a)-distance(b));
      const prior=out.map(item=>item.labelBox);
      const available=slots.find(slot=>!occupied.some(obstacle=>overlaps(slot,obstacle)))
        ||slots.find(slot=>!prior.some(obstacle=>overlaps(slot,obstacle)));
      if(available){box=available;center=[box.x+markerWidth/2,box.y+8];}
    }
    input.lanes.set(interval.id,lane);
    occupied.push(box);
    out.push({interval,number,label,lane,a,b,railA,railB,normal,tangent,
      labelCenter:center,labelBox:box,listed:!fits});
  }
  return out;
}

export function dimensionListBox(items:readonly DimensionPlacement[],width:number,height:number,
  obstacles:readonly DimensionBox[]):DimensionBox|null {
  const listed=items.filter(item=>item.listed);if(!listed.length)return null;
  const w=Math.min(190,Math.max(100,width-16)),h=Math.min(height-16,Math.max(52,Math.min(height*.4,30+listed.length*24)));
  const choices=[{x:8,y:8,w,h},{x:Math.max(8,width-w-8),y:8,w,h},
    {x:8,y:Math.max(8,height-h-8),w,h},{x:Math.max(8,width-w-8),y:Math.max(8,height-h-8),w,h}];
  const score=(box:DimensionBox)=>obstacles.reduce((sum,obstacle)=>sum+(overlaps(box,obstacle)?1:0),0);
  return choices.sort((a,b)=>score(a)-score(b))[0];
}
