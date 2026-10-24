import test from 'node:test';
import assert from 'node:assert/strict';
import {VacuumHistory} from '../test-build/vacuum-history.js';
import {historyCatalog,historyLabels,historyMaterial} from '../test-build/vacuum-history-values.js';
import {MutableConfigAdoption} from '../test-build/config-adoption.js';
import {ConfigWriteContext} from '../test-build/config-write-context.js';
import {VacuumPathGeometryCache} from '../test-build/vacuum-path-geometry.js';
import {vacuumTrailSvg} from '../test-build/vacuum-trail-render.js';

const A='a'.repeat(64),B='b'.repeat(64),REV='f'.repeat(64),EPOCH='c'.repeat(32);
const rows=[{id:A,timestamp:1792800010},{id:B,timestamp:1792800040}];
const listing={version:1,records:rows,revision:REV,epoch:EPOCH,limited:false};
const route={id:'route',source:'camera.map',map_id:'floor',space:'f1',calibration:[.001,0,10,0,.001,20]};
const response=id=>({version:1,...rows.find(row=>row.id===id),revision:REV,epoch:EPOCH,route,
  completed:true,vacuum:'vacuum.robot',paths:[[[0,0],[1000,0],[1000,1000]],[[5000,0],[5000,200]]]});
function prepared(){
 const calls=[],pending=[];
 const marker={id:'m',binding:'entity:vacuum.robot',space:'f1',vacuum:{source:'camera.map',map_routes:[route]}};
 const config={spaces:[{id:'f1',title:'Floor',rooms:[]}],markers:[marker]};
 const adoption=new MutableConfigAdoption();
 adoption.adoptResponses({config,rev:1},{layout:{},rev:1},()=>{},()=>{});
 const device={id:'m',primary:'vacuum.robot',entities:['vacuum.robot','camera.map'],marker,space:'f1',
   bindingKind:'entity',bindingRef:'vacuum.robot',name:'Robot',model:'Synthetic',area:'',icon:'mdi:robot-vacuum'};
 const host={_adoption:adoption,_configWriteContext:new ConfigWriteContext(),_devices:[device],_model:config.spaces,
  _space:'f1',_mode:'view',_selId:null,_markerDialog:null,_infoCard:null,_haVacuumHistoryApi:1,
  _canEdit:true,_kiosk:false,_loadOk:true,isConnected:true,ownerDocument:{visibilityState:'visible'},
  requestUpdate(){},addController(c){this.controller=c;},_vacEntity:d=>d.primary,_vacSource:()=> 'camera.map',
  hass:{connection:{},user:{id:'writer'},config:{time_zone:'Europe/Moscow'},entities:{},states:{
   'camera.map':{state:'idle'},'vacuum.robot':{state:'docked'}},callWS:async message=>{
    calls.push(message);
    if(message.type.endsWith('/list'))return listing;
    if(host.hold)return new Promise(resolve=>pending.push({message,resolve}));
    return response(message.record_id);
  }},hold:false};
 host._configWriteContext.observe(host.hass);
 const owner=new VacuumHistory(host);owner.select(device);
 return {host,owner,calls,pending,device,config,adoption};
}
async function loaded(){const p=prepared();await p.owner.load();p.owner.selected=A;return p;}
function paint(owner){if(owner.shown)owner.paint(owner.shown,true,false);}

test('#999 inactive cold View does not scan the device roster for a missing selection',()=>{
 const {host,device}=prepared();let scans=0;
 host._devices=new Proxy(host._devices,{get(target,key,receiver){
  if(key==='find')scans++;return Reflect.get(target,key,receiver);
 }});
 const owner=new VacuumHistory(host);owner.hostUpdate();
 assert.equal(scans,0);assert.equal(owner.markerId,null);
 host._infoCard=device;owner.hostUpdate();
 assert.equal(owner.markerId,device.id);assert.ok(scans>0);
});

test('#999 catalogue is bounded, typed and keyed by identity, with genuine minute/DST labels',()=>{
 const catalog=historyCatalog(listing);assert.deepEqual(catalog.records.map(r=>r.id),[B,A]);
 assert.deepEqual([...historyLabels(rows,'Europe/Moscow').values()],['24.10.2026 · 03:00:10','24.10.2026 · 03:00:40']);
 const dst=[{id:A,timestamp:Date.parse('2026-10-25T00:30:00Z')/1000},{id:B,timestamp:Date.parse('2026-10-25T01:30:00Z')/1000}];
 assert.deepEqual([...historyLabels(dst,'Europe/Berlin').values()],['25.10.2026 · 02:30:00 · UTC+02:00','25.10.2026 · 02:30:00 · UTC+01:00']);
 for(const patch of [{version:2},{records:[rows[0],rows[0]]},{records:[rows[0],{id:B,timestamp:rows[0].timestamp}]},
  {records:[{id:A,timestamp:NaN}]},{records:[{id:A,timestamp:'1792800010'}]},{records:Array(101).fill(rows[0])}])
  assert.equal(historyCatalog({...listing,...patch}),null);
});
test('#999 decoded history uses the existing calibrated geometry/cache without connecting fragments',()=>{
 const catalog=historyCatalog(listing),value=historyMaterial(response(A),catalog,rows[0]);
 assert.ok(Object.isFrozen(value.paths)&&Object.isFrozen(value.paths[0][0]));
 const cache=new VacuumPathGeometryCache(),frame=vacuumTrailSvg(cache,value.paths,value.route.calibration,5,20000);
 assert.ok(frame.d.startsWith('M 10 20')&&frame.d.includes('11 21')&&frame.d.includes('M 15 20'));
 assert.equal((frame.d.match(/M /g)||[]).length,2);
 assert.equal(vacuumTrailSvg(cache,value.paths,value.route.calibration,5,20000),frame);
 for(const patch of [{id:B},{timestamp:rows[1].timestamp},{epoch:'d'.repeat(32)},{paths:[[[0,0],[NaN,1]]]},
  {paths:[[[0,0],[1]]]},{completed:null},{route:{...route,calibration:[1,0,0,0,1]}}])
  assert.equal(historyMaterial({...response(A),...patch},catalog,rows[0]),null);
});
test('#999 held Show A survives selection B and ordinary close, fill requires actual paint; Hide preserves choice',async()=>{
 const {host,owner,pending,calls,adoption}=await loaded(),before=JSON.stringify(adoption.snapshot(null));
 host.hold=true;host._markerDialog={devId:'m'};
 const work=owner.show();assert.equal(owner.loadingShow,true);
 owner.selected=B;host._markerDialog=null;owner.hostUpdate();
 pending[0].resolve(response(A));await work;
 assert.equal(owner.shown.id,A);assert.equal(owner.selected,B);assert.equal(owner.visible,false);
 paint(owner);assert.equal(owner.visible,true);assert.equal(owner.label(A),'24.10.2026 · 03:00:10');
 owner.hide();assert.equal(owner.shown,null);assert.equal(owner.selected,B);assert.equal(owner.visible,false);
 assert.equal(JSON.stringify(adoption.snapshot(null)),before);
 assert.ok(calls.every(c=>/houseplan\/vacuum\/history\/(list|get)$/.test(c.type)));
});
test('#999 newer Show owns adoption and finally; error B retains accepted A',async()=>{
 const {host,owner,pending}=await loaded();await owner.show();paint(owner);const a=owner.shown;
 host.hold=true;const old=owner.show();owner.selected=B;const fresh=owner.show();
 pending[0].resolve(response(A));await old;
 assert.equal(owner.loadingShow,true);assert.equal(owner.shown,a);
 pending[1].resolve({...response(B),id:A});await fresh;
 assert.equal(owner.shown,a);assert.equal(owner.reason,'stale');assert.equal(owner.loadingShow,false);
 host.hold=false;await owner.show();paint(owner);assert.equal(owner.shown.id,B);assert.equal(owner.visible,true);
});
for(const change of ['hide','space','authority_aba','permission','kiosk','removed','hidden','live_off','calibration','binding','other_vacuum','detach','pagehide','new_cleanup'])
 test(`#999 pending Show retires on ${change}; its finally cannot unlock a new intent`,async()=>{
  const {host,owner,pending,adoption,config,device}=await loaded();host.hold=true;const old=owner.show();
  const mutate=fn=>{const c=structuredClone(config);fn(c.markers[0]);adoption.adoptResponses({config:c,rev:2},undefined,()=>{},()=>{});};
  if(change==='hide')owner.hide();
  if(change==='space')host._space='f2';
  if(change==='authority_aba'){const original=host.hass;host.hass={...original,connection:{}};host._configWriteContext.observe(host.hass);host.hass=original;host._configWriteContext.observe(original);}
  if(change==='permission')host._canEdit=false;
  if(change==='kiosk')host._kiosk=true;
  if(change==='removed')mutate(m=>{m.removed=true;});
  if(change==='hidden')mutate(m=>{m.hidden=true;});
  if(change==='live_off')mutate(m=>{m.vacuum.live=false;});
  if(change==='calibration')mutate(m=>{m.vacuum.map_routes[0].calibration=[1,0,0,0,1,0];});
  if(change==='binding')mutate(m=>{m.binding='entity:vacuum.other';});
  if(change==='other_vacuum')owner.select({...device,id:'other',primary:'vacuum.other'});
  if(change==='detach')owner.hostDisconnected();
  if(change==='pagehide')owner.suspend();
  if(change==='new_cleanup')owner.adoptEpochs({vacuum_history_epochs:{default:'d'.repeat(32),markers:{}}});
  owner.hostUpdate();pending[0].resolve(response(A));await old;
  assert.equal(owner.shown,null);assert.equal(owner.loadingShow,false);
 });
test('#999 forbidden editor modes suspend paint, preserve accepted memory and do not load/switch/write',async()=>{
 const {host,owner,calls}=await loaded();await owner.show();paint(owner);const accepted=owner.shown,n=calls.length;
 for(const mode of ['plan','decor']){host._mode=mode;owner.hostUpdate();assert.equal(owner.visible,false);assert.equal(owner.canShow,false);await owner.show();assert.equal(host._mode,mode);assert.equal(owner.shown,accepted);}
 assert.equal(calls.length,n);host._mode='devices';owner.hostUpdate();assert.equal(owner.visible,true);
 host.hass={...host.hass,states:{...host.hass.states,'sensor.unrelated':{state:'123'}}};owner.hostUpdate();assert.equal(owner.shown,accepted);
});
test('#999 native camera/other-floor/old-backend/empty responses are honest and never fabricate a path',async()=>{
 const {host,owner}=await loaded();
 host.hass.callWS=async()=>({...response(A),paths:[]});await owner.show();assert.equal(owner.shown,null);assert.equal(owner.reason,'empty_path');
 host.hass.callWS=async()=>response(A);host._haVacuumHistoryApi=null;owner.hostUpdate();assert.equal(owner.canShow,false);assert.equal(owner.unavailableReason,'update');
});
test('#999 unsupported provider explanation is not concealed by a missing calibration',async()=>{
 const {host,owner,adoption,config}=await loaded();
 const saved=structuredClone(config);saved.markers[0].vacuum.map_routes[0].calibration=null;
 adoption.adoptResponses({config:saved,rev:2},undefined,()=>{},()=>{});owner.hostUpdate();
 host.hass.callWS=async()=>{throw {code:'unsupported'};};await owner.load();
 assert.equal(owner.unavailableReason,'needs_calibration');assert.equal(owner.messageReason,'unsupported');
 host._mode='plan';assert.equal(owner.messageReason,'mode');assert.equal(owner.canShow,false);
 host.hass.entities['camera.map']={disabled_by:'user'};owner.hostUpdate();assert.equal(owner.messageReason,'suppressed');
});
test('#999 a newer catalogue retires removed pending B while retaining valid shown A',async()=>{
 const {host,owner,pending}=await loaded();await owner.show();paint(owner);const accepted=owner.shown;
 host.hold=true;owner.selected=B;const old=owner.show();
 const changed={...listing,records:[rows[0]],revision:'d'.repeat(64)};
 host.hass.callWS=async message=>message.type.endsWith('/list')?changed:{...response(message.record_id),revision:changed.revision};
 await owner.load();pending[0].resolve(response(B));await old;
 assert.equal(owner.shown,accepted,'a removed pending record cannot replace the valid displayed cleanup');
 assert.equal(owner.loadingShow,false);
 owner.selected=A;await owner.show();paint(owner);assert.equal(owner.shown.id,A);assert.equal(owner.visible,true);
});
test('#999 a fresh empty catalogue prevents first pending Show from reviving removed data',async()=>{
 const {host,owner,pending}=await loaded();host.hold=true;const old=owner.show();
 host.hass.callWS=async()=>({...listing,records:[],revision:'d'.repeat(64)});
 await owner.load();pending[0].resolve(response(A));await old;
 assert.equal(owner.shown,null);assert.equal(owner.visible,false);assert.equal(owner.loadingShow,false);
});
test('#999 ordinary reopen with an equivalent new catalogue object preserves pending Show A',async()=>{
 const {host,owner,pending}=await loaded();host.hold=true;const old=owner.show();
 await owner.load();owner.selected=B;pending[0].resolve(response(A));await old;
 assert.equal(owner.shown.id,A);assert.equal(owner.selected,B);
});
