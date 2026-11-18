import test from 'node:test';
import assert from 'node:assert/strict';
import {workstationTarget, toggleWorkstation, standaloneWorkstation, removeWorkstationItems,
  remapWorkstationItems, desktopSurface} from '../test-build/iso-lab-workstation.js';
import {copyDecor} from '../test-build/editors/decor/order.js';
import {createSpaceCopyCandidate} from '../test-build/space-copy.js';

const desk = {id:'desk', kind:'furniture', symbol:'desk', x:.2,y:.2,w:.3,h:.2,angle:0,color:'#123456'};
const computer = {id:'computer',kind:'furniture',symbol:'computer',x:.26,y:.23,w:.12,h:.06,
  angle:0, color:'#abcdef', opacity:.6, future:{keep:true}};
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-11, `${actual} != ${expected}`);
const towerCenter = shape => {
  const a=(shape.angle||0)*Math.PI/180, dx=(shape.flip_h?-1:1)*shape.w*.375;
  return [shape.x+shape.w/2+dx*Math.cos(a),shape.y+shape.h/2+dx*Math.sin(a)];
};

test('#1451 mount requires an existing computer and only a straight/corner work desk', () => {
  assert.equal(workstationTarget([desk],desk),null);
  assert.equal(desktopSurface('dining_table'),null);
  assert.equal(desktopSurface('coffee_table'),null);
  const candidate = workstationTarget([desk,computer],computer);
  assert.equal(candidate.desk,desk); assert.equal(candidate.pc,computer);
  assert.equal(workstationTarget([desk,{...computer,x:.8}],desk),null);
  const corner={...desk,symbol:'desk_corner'};
  assert.equal(workstationTarget([corner,{...computer,x:.42,y:.35}],corner),null,'L cutout is not a surface');
  const stale={...desk};
  assert.equal(toggleWorkstation([desk,computer],stale,computer)[0],desk,'stale command cannot attach');
});

test('#1451 mount/detach preserves the physical tower under rotation and both mirrors', () => {
  for(const angle of [0,37,90,180,270])for(const flip_h of [false,true])for(const flip_v of [false,true]){
    const pc={...computer,angle,flip_h,flip_v}, items=[desk,pc], frozen=structuredClone(items);
    const expected=towerCenter(pc), mounted=toggleWorkstation(items,desk,pc), tower=mounted[1];
    assert.equal(mounted[0].workstation,'mounted'); assert.equal(mounted[0].workstation_tower_id,pc.id);
    assert.equal(tower.workstation,'tower'); near(tower.w,pc.w/4);
    near(tower.x+tower.w/2,expected[0]); near(tower.y+tower.h/2,expected[1]);
    assert.equal(tower.angle,angle); assert.equal(tower.flip_h,flip_h); assert.equal(tower.flip_v,flip_v);
    assert.deepEqual(items,frozen);
    // A changed desk is not the source of the detached computer's geometry.
    const changed=[{...mounted[0],x:.7,w:.5,angle:123,flip_h:!flip_h,flip_v:!flip_v},tower];
    const detached=toggleWorkstation(changed,changed[0],tower)[1];
    near(detached.x,pc.x);near(detached.y,pc.y);near(detached.w,pc.w);near(detached.h,pc.h);
    assert.equal(detached.angle,pc.angle);assert.equal(detached.flip_h,pc.flip_h);
    assert.equal(detached.workstation,undefined);assert.deepEqual(detached.future,pc.future);
  }
});

test('#1451 detached computer follows independently moved/resized tower, not desk', () => {
  const mounted=toggleWorkstation([desk,computer],desk,computer);
  const tower={...mounted[1],x:.75,y:.65,w:.05,h:.08,angle:47,flip_h:true};
  const expected=standaloneWorkstation(tower);
  const result=toggleWorkstation([mounted[0],tower],mounted[0],tower);
  assert.deepEqual(result[1],expected);near(result[1].w,.2);
  const center=towerCenter(result[1]);near(center[0],tower.x+tower.w/2);near(center[1],tower.y+tower.h/2);
});

test('#1451 delete repairs only the surviving endpoint; undo snapshot stays intact', () => {
  const mounted=toggleWorkstation([desk,computer],desk,computer), unrelated={...desk,id:'other'};
  const items=[...mounted,unrelated], before=structuredClone(items);
  assert.deepEqual(removeWorkstationItems(items,new Set(['desk'])),[standaloneWorkstation(mounted[1]),unrelated]);
  assert.deepEqual(removeWorkstationItems(items,new Set(['computer'])),[standaloneWorkstation(mounted[0]),unrelated]);
  assert.deepEqual(removeWorkstationItems(items,new Set(['desk','computer'])),[unrelated]);
  assert.deepEqual(items,before,'one history snapshot restores the entire original pair');
});

test('#1451 single copy detaches only the copied endpoint; whole pair remaps its own IDs', () => {
  const mounted=toggleWorkstation([desk,computer],desk,computer), frozen=structuredClone(mounted);
  for(const item of mounted){
    const result=copyDecor(mounted,item.id,'copy',20);
    assert.ok(result.shape);assert.equal(result.shape.workstation,undefined);
    assert.equal(result.shape.workstation_tower_id,undefined);
    near(result.shape.w,item.id==='computer'?computer.w:desk.w);
  }
  const ids=new Map([['desk','new-desk'],['computer','new-computer']]);
  const copied=remapWorkstationItems(mounted.map(item=>({...structuredClone(item),id:ids.get(item.id)})),ids);
  assert.equal(copied[0].workstation_tower_id,'new-computer');assert.equal(copied[1].workstation,'tower');
  assert.deepEqual(mounted,frozen);
});

test('#1451 space copy preserves the workstation with fresh local IDs',()=>{
  const mounted=toggleWorkstation([desk,computer],desk,computer);
  const source={spaces:[{id:'source',title:'Source',view_box:[0,0,1000,1000],rooms:[],wall_segments:[],decor:mounted}],markers:[],settings:{}};
  const frozen=structuredClone(source);
  const result=createSpaceCopyCandidate(source,'source','Copy','workstation',{furniture:true});
  const [copiedDesk,copiedTower]=result.space.decor;
  assert.notEqual(copiedDesk.id,desk.id);assert.notEqual(copiedTower.id,computer.id);
  assert.equal(copiedDesk.workstation_tower_id,copiedTower.id);assert.equal(copiedTower.workstation,'tower');
  assert.deepEqual(source,frozen);assert.deepEqual(result.config.spaces[0],source.spaces[0]);
});
