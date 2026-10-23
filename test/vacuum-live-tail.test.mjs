import test from 'node:test';
import assert from 'node:assert/strict';
import { ownVacuumLiveTail, recordVacuumLivePosition, vacuumLiveGeometry } from '../test-build/vacuum-live-tail.js';
import { vacuumTrailMaterial, currentVacuumTrailFrame } from '../test-build/vacuum-trail-material.js';
import { VacuumPathGeometryCache } from '../test-build/vacuum-path-geometry.js';

const live = (patch={}) => ownVacuumLiveTail({version:1,epoch:'one',paths:[[[0,0,1000],[10,0,2000]]],...patch});
const run = (tail=live()) => ({path_format:2,paths:[[[0,0],[10,0]]],quality:{source:'native',reason:'ok'},live_tail:tail});
function frame(server, pending, position={x:10,y:10},budget=20000){
  return currentVacuumTrailFrame({telemetry:{pos:position},server,livePending:pending,local:[],serverFormat:2,
    moving:true,matrix:[1,0,0,0,1,0],cache:new VacuumPathGeometryCache(),cmPerUnit:1,budget});
}

test('#1049 closed owned capability rejects malformed and future tails',()=>{
  for(const patch of [{version:2},{version:true},{epoch:''},{paths:[[[0,0,true]]]},{paths:[[[0,0,Infinity]]]},{paths:Array(33).fill([])}])
    assert.equal(live(patch),undefined);
  const raw={version:1,epoch:'one',paths:[[[0,0,1]]],source:'secret',generation:'secret'};
  const value=ownVacuumLiveTail(raw);raw.paths[0][0][0]=999;
  assert.deepEqual(Object.keys(value),['version','epoch','paths','waiting','limited']);
  assert.equal(value.paths[0][0][0],0);assert.ok(Object.isFrozen(value.paths[0][0]));
});

test('#1049 ordered local observations follow turns, ACK never resurrects them',()=>{
  const tail=live();let p=recordVacuumLivePosition(undefined,tail,'owner',[10,0],2000,false,[10,0]);
  p=recordVacuumLivePosition(p,tail,'owner',[10,10],3000,false,[10,10]);
  p=recordVacuumLivePosition(p,tail,'owner',[20,10],4000,false,[20,10]);
  assert.deepEqual(vacuumLiveGeometry(tail,p).path,[[[0,0],[10,0],[10,10],[20,10]]]);
  const caught=live({paths:[[[10,10,3000]]]});
  p=recordVacuumLivePosition(p,caught,'owner',[20,10],4000,false,[20,10]);
  assert.deepEqual(vacuumLiveGeometry(caught,p).path,[[[10,10],[20,10]]]);
  const f=frame(run(caught),p,{x:20,y:10});
  assert.ok(f.current.allowTip);assert.deepEqual(f.path,[[[10,10]]]);
  assert.equal(f.provisional,2);assert.equal(f.liveReceivedAt,4000);
});

test('#1049 repeat native, empty and old capability do not fabricate remote chords',()=>{
  const tail=live({paths:[[[90,90,1000],[100,90,2000],[100,100,3000]]]});
  for(const paths of [[[[0,0],[10,0]]],[]]){
    const server={...run(tail),paths};const f=frame(server,undefined,{x:100,y:100});
    assert.ok(f.current.allowTip);assert.ok(f.frame.d.includes('M 90 90'));
    assert.deepEqual(server.paths,paths);assert.equal(f.provisional,3);
  }
  const old=frame({...run(),live_tail:undefined});assert.equal(old.current.allowTip,false);
  const malformed=vacuumTrailMaterial({m:{current:{...run(),live_tail:{version:2}}}}).m.current;
  assert.equal(frame(malformed).current.hybrid,undefined);
});

test('#1049 HA microseconds survive the browser millisecond cursor without a false gap',()=>{
  const tail=live({paths:[[[0,0,1000],[10,0,2000.123]]]});
  let p=recordVacuumLivePosition(undefined,tail,'owner',[10,0],2000,false,[10,0]);
  p=recordVacuumLivePosition(p,tail,'owner',[10,10],3000,false,[10,10]);
  assert.deepEqual(vacuumLiveGeometry(tail,p).path,[[[0,0],[10,0],[10,10]]]);
});

test('#1049 a newly announced epoch cannot adopt a cached position from the previous task',()=>{
  const tail=live({paths:[],since:3000});
  let p=recordVacuumLivePosition(undefined,tail,'owner',[900,900],2000,false,[900,900]);
  assert.deepEqual(vacuumLiveGeometry(tail,p).path,[]);
  p=recordVacuumLivePosition(p,tail,'owner',[10,10],4000,false,[10,10]);
  assert.deepEqual(vacuumLiveGeometry(tail,p).path,[[[10,10]]]);
});

test('#1049 owner, epoch, unknown, clock rollback and teleport preserve literal gaps',()=>{
  let p=recordVacuumLivePosition(undefined,live(),'owner',[10,0],2000,false,[10,0]);
  p=recordVacuumLivePosition(p,live(),'owner',[10,10],3000,false,[10,10]);
  p=recordVacuumLivePosition(p,live(),'owner',null,NaN,true);
  p=recordVacuumLivePosition(p,live(),'owner',[20,10],4000,true,[20,10]);
  assert.equal(vacuumLiveGeometry(live(),p).path.length,2);
  p=recordVacuumLivePosition(p,live(),'other',[30,10],5000,false,[30,10]);
  assert.deepEqual(vacuumLiveGeometry(live(),p).path,[],'old calibration tail is blocked until a new server epoch');
  const next=live({epoch:'two',paths:[]});
  p=recordVacuumLivePosition(p,next,'other',[40,10],6000,false,[40,10]);
  assert.deepEqual(vacuumLiveGeometry(next,p).path,[[[40,10]]]);
  p=recordVacuumLivePosition(p,next,'other',[5000,10],7000,false,[5000,10]);
  assert.equal(vacuumLiveGeometry(next,p).path.length,2,'teleport cannot bridge');
});

test('#1049 tail cap, geometry quota and native raw counts are independent',()=>{
  const tail=live({paths:[]});let p;
  for(let i=0;i<600;i++)p=recordVacuumLivePosition(p,tail,'owner',[i,0],i*1000,false,[i,0]);
  assert.equal(vacuumLiveGeometry(tail,p).count,512);assert.ok(p.limited);
  const f=frame(run(tail),p,{x:599,y:0},4);
  assert.ok(f.frame.count<=4);assert.ok(f.frame.limited);
  assert.equal(f.provisional,512);assert.deepEqual(run(tail).paths,[[[0,0],[10,0]]]);
});
