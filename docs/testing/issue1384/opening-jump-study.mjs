import {makeResizeJunctionFixture} from '../../../demo/fixtures/resize-junctions.mjs';
import {commitGraphEditResult,commitGraphEdit} from '../../../test-build/graph-edit-intent.js';
import {coalesceResizeRooms,resolveSafeResize,validateSafeResize,clampSafeResize} from '../../../test-build/resize.js';
import {ordinaryRoomWriteReply} from '../../../demo/helpers/room-write-python.mjs';
import {checkSpacePhysicalGeometry} from '../../../test-build/plan-geometry-preflight.js';
const fixture=makeResizeJunctionFixture('partition');let base=fixture.config.spaces[0];
if(process.argv.includes('--both')){
 const next=structuredClone(base),door=next.openings.find(o=>o.id==='bottom-door');door.x=.3;
 const edge=base.wall_segments.find(e=>e.a[1]===.5&&e.b[1]===.5&&Math.min(e.a[0],e.b[0])<=.3&&Math.max(e.a[0],e.b[0])>=.3);
 door.host={kind:'wall',id:edge.id,t:(door.x-edge.a[0])/(edge.b[0]-edge.a[0])};
 base=commitGraphEdit(base,next,{kind:'openings',ids:[door.id]});fixture.config.spaces=[base];
}
const sourceRooms=coalesceResizeRooms(base.rooms,1e-12);
const rooms=sourceRooms.map(r=>({...r,poly:r.poly.map(p=>p.map(v=>v*1000))}));
const openings=base.openings.map(o=>({...o,x:o.x*1000,y:o.y*1000,length:o.length*1000,hosted:false}));
const opts={eps:1e-7,minDim:25,movingHalf:10,obstacles:[]};
const edge=rooms.find(r=>r.id==='left').poly.findIndex((p,i,a)=>p[0]===500&&a[(i+1)%a.length][0]===500);
const resolution=resolveSafeResize(rooms,openings,'left',edge,opts);
if(!resolution.enabled)throw Error(JSON.stringify(resolution));
function draftAt(space,x){
 const draft=structuredClone(space);
 for(const r of draft.rooms)if(['left','right'].includes(r.id))r.poly=sourceRooms.find(old=>old.id===r.id).poly.map(([a,b])=>[a===.5?x:a,b]);
 const moving=draft.openings?.find(o=>o.id==='moving-door');if(moving)moving.x=x;
 return draft;
}
for(const x of [.4,.3,.2]){
 const wanted=(x-.5)*1000;
 let graphResult;
 try{commitGraphEditResult(base,draftAt(base,x),{kind:'resize',rooms:['left','right']});graphResult='accepted';}
 catch(e){graphResult=e.message;}
 // Analysis only: construct the requested final shape without openings, then
 // explicitly bind the same synthetic openings at their original world point.
 // This is not a product implementation and never writes to HA.
 const bare={...structuredClone(base),openings:[]};
 let candidate=commitGraphEdit(bare,draftAt(bare,x),{kind:'resize',rooms:['left','right']});
 const finalOpenings=base.openings.map(old=>{
  const o={...structuredClone(old),...(old.id==='moving-door'?{x}: {})};
  const axis=old.id==='moving-door'?1:0,other=axis?0:1,p=[o.x,o.y];
  const host=candidate.wall_segments.find(e=>e.a[other]===p[other]&&e.b[other]===p[other]
   &&Math.min(e.a[axis],e.b[axis])<=p[axis]&&Math.max(e.a[axis],e.b[axis])>=p[axis]);
  if(!host)throw Error('diagnostic host absent');
  return{...o,host:{kind:'wall',id:host.id,t:(p[axis]-host.a[axis])/(host.b[axis]-host.a[axis])}};
 });
 candidate=commitGraphEdit(candidate,{...structuredClone(candidate),openings:finalOpenings},{kind:'openings',ids:finalOpenings.map(o=>o.id)});
 const config={...structuredClone(fixture.config),spaces:[candidate]};
 const reply=ordinaryRoomWriteReply(fixture.config,{type:'houseplan/config/set',config});
 console.log(JSON.stringify({target:x,pureFinalAllowed:validateSafeResize(rooms,openings,resolution.plan,wanted,opts),
  contiguousClamp:clampSafeResize(rooms,openings,resolution.plan,wanted,5,opts),graphResult,
  explicitRehostFinalPython:reply.ok?'accepted':reply.error,
  physicalCheck:checkSpacePhysicalGeometry(config,base.id).ok,
  bothEndpoints:process.argv.includes('--both'),
  explicitEndpointClearance:Math.abs(x-.3)*1000>=50+opts.movingHalf}));
}
