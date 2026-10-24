import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDeviceOwnAvailability,controllerSourceAvailability} from '../test-build/device-own-availability.js';
import {resolveDevicePresentation,deviceA11yState} from '../test-build/device-presentation.js';
import {entityVisualSample,entityVisualSamplesForDevice} from '../test-build/device-visual.js';
import {buildDevices} from '../test-build/devices.js';

const row=(entity_id,state,attributes={})=>({entity_id,state,attributes});
const device=(entities=['media_player.own'],extra={})=>({id:'own',name:'Own',model:'',icon:'mdi:television',
  area:'room',space:'floor',entities,primary:entities[0],bindingKind:'device',bindingRef:'physical',
  bindingStatus:{kind:'active',enabledEntityIds:entities,allEntityIds:entities},
  marker:{id:'own',binding:'device:physical'},...extra});
const hass=states=>({states,entities:{},devices:{},config:{unit_system:{temperature:'°C'}}});
const options={liveStates:true,showTemperature:false,showSignal:false,showBattery:false,now:10000};

test('#1026 real roster ownership excludes claimed and disabled siblings from residual evidence',()=>{
  const ids=['media_player.own','switch.aux','sensor.battery'];
  const h={...hass(Object.fromEntries(ids.map(id=>[id,row(id,id==='sensor.battery'?'100':'unavailable')]))),
    devices:{physical:{id:'physical',name:'Physical',area_id:'room',identifiers:[['demo','physical']]}},
    entities:Object.fromEntries(ids.map(id=>[id,{entity_id:id,device_id:'physical',platform:'demo',
      disabled_by:id==='sensor.battery'?'user':null}]))};
  const marker={id:'exact',binding:'entity:media_player.own',controls:['switch.elsewhere']};
  const build=markers=>buildDevices({hass:h,areaToSpace:{room:'floor'},markers,settings:{group_lights:false},
    excluded:new Set(),showAll:false,firstSpaceId:'floor',loc:key=>key});
  let roster=build([marker]);
  const exact=roster.find(d=>d.id==='exact'),residual=roster.find(d=>d.id==='physical');
  assert.deepEqual(exact.entities,['media_player.own']);
  assert.deepEqual(residual.entities,['switch.aux']);
  assert.equal(resolveDeviceOwnAvailability(h,exact),'unavailable');
  assert.equal(resolveDeviceOwnAvailability(h,residual),'unavailable');
  h.entities['sensor.battery']={...h.entities['sensor.battery'],disabled_by:null};
  roster=build([marker]);
  assert.equal(resolveDeviceOwnAvailability(h,roster.find(d=>d.id==='exact')),'unavailable');
  assert.equal(resolveDeviceOwnAvailability(h,roster.find(d=>d.id==='physical')),'available',
    'a newly enabled own diagnostic proves the residual parent available');
  h.states['media_player.own']=row('media_player.own','off');
  roster=build([marker,{id:'whole',binding:'device:physical'}]);
  assert.equal(resolveDeviceOwnAvailability(h,roster.find(d=>d.id==='whole')),'available');
  assert.equal(resolveDeviceOwnAvailability(h,roster.find(d=>d.id==='exact')),'available');
  h.entities['media_player.own']={...h.entities['media_player.own'],disabled_by:'user'};
  const disabled=build([marker]).find(d=>d.id==='exact');
  assert.equal(disabled.bindingStatus.kind,'ha_disabled');
  assert.equal(resolveDeviceOwnAvailability(h,disabled),'unknown');
});

test('#1026 own availability is symmetric, three-valued and independent of domain power',()=>{
  const cases=[
    [[], 'unknown'],[['unavailable'],'unavailable'],[['unavailable','unavailable'],'unavailable'],
    [['off'],'available'],[['idle'],'available'],[['standby'],'available'],[['paused'],'available'],
    [['unknown'],'unknown'],[[''],'unknown'],[[undefined],'unknown'],[[null],'unknown'],[[{}],'unknown'],
    [['unavailable','unknown'],'unknown'],[['unavailable',undefined],'unknown'],
    [['unavailable',''],'unknown'],[['unavailable','0'],'available'],[['unknown','off'],'available'],
  ];
  for(const [values,want]of cases)for(const ordered of [values,[...values].reverse()]){
    const ids=ordered.map((_,i)=>`sensor.own_${i}`),states=Object.fromEntries(ids.flatMap((id,i)=>
      ordered[i]===undefined?[]:[[id,row(id,ordered[i])]]));
    assert.equal(resolveDeviceOwnAvailability(hass(states),device(ids)),want,JSON.stringify(ordered));
  }
});

test('#1026 foreign controls/value/physical siblings cannot replace the active own roster',()=>{
  const h=hass({'media_player.own':row('media_player.own','unavailable'),
    'sensor.sibling':row('sensor.sibling','100'),'light.target':row('light.target','on')});
  const d=device(['media_player.own'],{bindingKind:'entity',bindingRef:'media_player.own',
    allEntities:['media_player.own','sensor.sibling'],controls:['light.target'],
    marker:{id:'own',binding:'entity:media_player.own',value_source:{kind:'entity_state',entity_id:'sensor.sibling'}}});
  assert.equal(resolveDeviceOwnAvailability(h,d),'unavailable');
  assert.equal(resolveDeviceOwnAvailability(h,device(['media_player.own','sensor.sibling'])),'available',
    'a physical-device roster can use its own diagnostic, unlike the exact entity roster above');
  for(const kind of ['ha_disabled','orphaned','unverified'])
    assert.equal(resolveDeviceOwnAvailability(h,{...d,bindingStatus:{kind}}),'unknown');
  assert.equal(resolveDeviceOwnAvailability(h,{...d,virtual:true}),'unknown');
});

test('#1026 one positive own row is sufficient; confirming offline reads every own row only',()=>{
  const ids=Array.from({length:100},(_,i)=>`sensor.own_${i}`),reads=[];
  const states=new Proxy(Object.fromEntries(ids.map(id=>[id,row(id,'unavailable')])),{
    get(target,key){reads.push(key);return target[key];},ownKeys(){throw Error('No global row enumeration');}});
  states[ids[0]]=row(ids[0],'off');
  assert.equal(resolveDeviceOwnAvailability({states},device(ids)),'available');assert.deepEqual(reads,[ids[0]]);
  reads.length=0;states[ids[0]]=row(ids[0],'unavailable');
  assert.equal(resolveDeviceOwnAvailability({states},device(ids)),'unavailable');assert.deepEqual(reads,ids);
});

test('#1026 entityless/virtual controller source eligibility does not invent physical evidence',()=>{
  const d=device([]);
  assert.equal(resolveDeviceOwnAvailability(hass({}),d),'unknown');
  assert.equal(controllerSourceAvailability('unknown',d),'available');
  assert.equal(controllerSourceAvailability('unknown',{...d,bindingStatus:{kind:'active',allEntityIds:['event.disabled']}}),'unavailable');
  assert.equal(controllerSourceAvailability('unknown',device(['event.own'])),'unavailable');
  assert.equal(controllerSourceAvailability('unknown',{...d,virtual:true}),'available');
});

test('#1026 off and selected-source loss are distinct from own offline in the real common presentation',()=>{
  const d=device();
  for(const state of ['on','off','playing','paused','idle','standby']){
    const r=resolveDevicePresentation(hass({'media_player.own':row('media_player.own',state)}),d,options);
    assert.equal(r.ownAvailability,'available');assert.equal(r.offline,false);assert.equal(r.visual.status,'neutral');
    assert.ok(!r.classes.includes('unavail'));assert.equal(r.pulse.kind,'none');
  }
  for(const state of ['unknown',undefined,'unavailable']){
    const h=hass(state===undefined?{}:{'media_player.own':row('media_player.own',state)});
    const r=resolveDevicePresentation(h,d,options),offline=state==='unavailable';
    assert.equal(r.offline,offline);assert.equal(r.classes.includes('unavail'),offline);
    assert.equal(deviceA11yState(r),offline?'unavailable':'neutral');
    assert.equal(r.explanation.reason==='unavailable',offline);assert.equal(r.pulse.kind,'none');
  }
});

test('#1026 every semantic domain keeps ordinary inactive states separate from own offline',()=>{
  const domains=['binary_sensor','cover','lock','valve','climate','light','switch','fan','humidifier',
    'media_player','vacuum','script','automation','button','event','siren','alarm_control_panel','sensor',
    'select','number','vendor_domain'];
  for(const domain of domains){
    const id=`${domain}.own`,d=device([id]);
    for(const state of ['off','idle','standby','paused','unknown','unavailable']){
      const r=resolveDevicePresentation(hass({[id]:row(id,state)}),d,options);
      const offline=state==='unavailable';
      assert.equal(r.ownAvailability,offline?'unavailable':state==='unknown'?'unknown':'available',`${id}:${state}`);
      assert.equal(r.offline,offline,`${id}:${state}`);
      assert.equal(r.classes.includes('unavail'),offline,`${id}:${state}`);
      assert.equal(r.visual.status,'neutral',`${id}:${state} must not invent work or alarms`);
      assert.equal(r.pulse.kind,'none',`${id}:${state}`);
    }
  }
});

test('#1026 static/live/lifecycle gates suppress offline paint while an ordinary live device retains it',()=>{
  const h=hass({'media_player.own':row('media_player.own','unavailable')}),d=device();
  assert.equal(resolveDevicePresentation(h,d,options).offline,true);
  for(const display of ['static_icon','value_static_icon']){
    const r=resolveDevicePresentation(h,{...d,marker:{...d.marker,display}},options);
    assert.equal(r.offline,false);assert.ok(!r.classes.includes('unavail'));
  }
  assert.equal(resolveDevicePresentation(h,d,{...options,liveStates:false}).offline,false);
});

test('#1026 composite Power off ends work without declaring every role unavailable',()=>{
  const ids=['switch.machine_power','switch.machine_feature'];
  const h=hass(Object.fromEntries(ids.map((id,i)=>[id,row(id,i?'on':'off')])));
  h.entities=Object.fromEntries(ids.map(id=>[id,{entity_id:id,translation_key:id.endsWith('_power')?'power':undefined}]));
  const samples=entityVisualSamplesForDevice(h,ids,ids);
  assert.ok(samples.every(s=>s.status==='neutral'&&s.activity==='none'&&s.availability==='available'));
  assert.equal(entityVisualSample(h,'switch.machine_feature').status,'working','a lone relay still works');
});
