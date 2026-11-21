import test from 'node:test';
import assert from 'node:assert/strict';
import {repairMarkerSpacesInPlace} from '../test-build/marker-placement.js';
import {canonicalizeConfigWrite} from '../test-build/coordinate-canonicalization.js';
import {repairSpaceReferences} from '../test-build/space-reference-repair.js';
const config=()=>({spaces:[{id:'current',rooms:[{id:'r',area:'garage'}]}],markers:[
 {id:'sensor',binding:'device:ble',space:'deleted',area:'garage',size:1,tap_action:'info',private:{keep:true}},
 {id:'hidden',binding:'device:h',space:'deleted',area:'garage',hidden:true},
 {id:'removed',binding:'device:x',space:'deleted',area:'garage',removed:true},
 {id:'auto',binding:'device:a'},
 {id:'manual',binding:'virtual',space:'deleted',area:null,room_id:'r'},
]});
test('#1512 ordinary writes repair only room-proved references without mutating input',()=>{
 const cfg=config(),before=structuredClone(cfg),saved=canonicalizeConfigWrite(cfg);
 assert.deepEqual(cfg,before);
 for(const marker of saved.markers.filter(m=>m.id!=='auto'))assert.equal(marker.space,'current');
 assert.deepEqual(saved.markers[0],{...before.markers[0],space:'current'});
 assert.deepEqual(saved.markers.find(m=>m.id==='auto'),before.markers.find(m=>m.id==='auto'));
 assert.equal(repairMarkerSpacesInPlace(saved),0);
});
test('#1512 room transfer repairs even an existing old floor; ambiguous or missing rooms are not guessed',()=>{
 const cfg=config();cfg.spaces.push({id:'deleted',rooms:[]});
 assert.equal(repairMarkerSpacesInPlace(cfg),4);assert.equal(cfg.markers[0].space,'current');
 const ambiguous=config();ambiguous.spaces.push({id:'other',rooms:[{id:'r',area:'garage'}]});
 assert.equal(repairMarkerSpacesInPlace(ambiguous),0);
 const absent=config();absent.spaces[0].rooms=[];assert.equal(repairMarkerSpacesInPlace(absent),0);
});
test('#1512 Optimize repairs stale metadata with no registry, keeps all positions and is idempotent',()=>{
 const cfg=config(),layout={sensor:{s:'current',x:.23123,y:.67345},unrelated:{s:'current',x:.9,y:.1}};
 const first=repairSpaceReferences(cfg,layout);
 assert.equal(first.report.spaceRefsRemapped,4);assert.deepEqual(first.layout,layout);
 assert.equal(first.config.markers[0].space,'current');assert.deepEqual(cfg,config());
 const second=repairSpaceReferences(first.config,first.layout);
 assert.equal(second.changed,false);assert.deepEqual(second.layout,layout);
});

test('#1512 full Optimize entry repairs metadata and remains idempotent',async()=>{
 const {optimizePlans}=await import('../test-build/plan-optimizer.js');
 const raw={spaces:[{id:'current',title:'Home',view_box:[0,0,1,1],cell_cm:5,rooms:[{id:'r',name:'Garage',area:'garage',poly:[[0,0],[1,0],[1,1],[0,1]]}]}],markers:[{id:'sensor',binding:'device:ble',space:'current',area:'garage'}],settings:{}};
 const layout={sensor:{s:'current',x:.2,y:.3}};
 const prepared=optimizePlans(raw,layout);
 prepared.config.markers[0].space='gone';
 const repaired=optimizePlans(prepared.config,prepared.layout);
 assert.equal(repaired.config.markers[0].space,'current');assert.equal(repaired.report.spaceRefsRemapped,1);
 assert.deepEqual(repaired.layout,layout);assert.equal(repaired.changed,true);
 const again=optimizePlans(repaired.config,repaired.layout);
 assert.equal(again.changed,false);assert.equal(again.report.spaceRefsRemapped,0);assert.deepEqual(again.layout,layout);
});

test('#1512 repair cannot separate a linked LED strip from its marker',()=>{
 const cfg=config();cfg.spaces.push({id:'deleted',rooms:[],led_strips:[{marker:'sensor'}]});
 repairMarkerSpacesInPlace(cfg);assert.equal(cfg.markers[0].space,'deleted');
});
