import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshDeviceTip, showDeviceFocusTip, showDevicePointerTip,
  clearPointerHover } from '../test-build/live-hover.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';

test('#1119 visible pointer tooltip consumes the same current owned fact without moving the pointer', () => {
  const device = { id: 'own', name: 'Relay', model: 'Native', area: 'room', space: 'floor',
    icon: 'mdi:toggle-switch', entities: ['switch.relay'], primary: 'switch.relay',
    bindingKind: 'device', bindingRef: 'own', marker: { id: 'own', binding: 'device:own' },
    bindingStatus: { kind: 'active', enabledEntityIds: ['switch.relay'], allEntityIds: ['switch.relay'] } };
  const h = { states: {}, entities: { 'switch.relay': {entity_id:'switch.relay',device_id:'own',platform:'demo'} },
    devices: {}, config: {unit_system:{}}, formatEntityState: item => item.state };
  const host = { _devices: [device], _settings: {}, _config: null,
    _renderPlanHass: h, _fullRegistryHass: h, _spaceDisplayForRender: () => ({}),
    _t: key => ({'device.power_off':'Off','device.presentation_unavailable':'Unavailable'})[key] || key,
    _tip: {deviceId:'own',source:'pointer',x:240,y:160,title:'old',meta:''},
    _devicePresentation: current => resolveDevicePresentation(h,current,
      {liveStates:true,showTemperature:true,showSignal:true}) };
  for (const [state, status] of [['off','Off'],['on',''],['unavailable','Unavailable'],['unknown','']]) {
    h.states = {'switch.relay':{entity_id:'switch.relay',state,attributes:{}}};
    refreshDeviceTip(host);
    assert.equal(host._tip.status,status,state);
    assert.equal(host._tip.title,'Relay'); assert.equal(host._tip.meta,'Native');
    assert.deepEqual([host._tip.x,host._tip.y],[240,160]);
  }
  host._devices = [{...device,name:'Current binding name'}]; refreshDeviceTip(host);
  assert.equal(host._tip.title,'Current binding name');
  host._devices = []; refreshDeviceTip(host);
  assert.equal(host._tip,null,'a retired visible device cannot retain its old status');
});

test('#1119 refreshing device status leaves room information unchanged', () => {
  const room = {room:true,title:'Kitchen',meta:'',x:3,y:4};
  const host = {_tip:room}; refreshDeviceTip(host);
  assert.equal(host._tip,room);
});

test('#1119 retiring a pointer target does not retire a different valid focus tooltip', () => {
  const a = {id:'a',name:'Pointer',model:'',entities:[]};
  const b = {id:'b',name:'Keyboard',model:'',entities:[]};
  const host = {_devices:[a,b],_mode:'view',_drag:null,_deviceDrag:null,_tip:null,
    _hoverRoom:null,renderRoot:{querySelector:()=>null},_settings:{},_config:null,
    _pointerModality:{hoverEnabled:true},_notePointer:()=>{},_deviceHits:{hover:()=>{}},
    _spaceDisplayForRender:()=>({}),_renderPlanHass:null,_fullRegistryHass:null,_t:key=>key,
    _devicePresentation:()=>({haDisabled:false,valueBadge:null,lqiTipText:null,lqiSource:null,
      offline:false,powerOff:false})};
  showDeviceFocusTip(host,{matches:()=>true,getBoundingClientRect:()=>({right:42,top:18})},b);
  showDevicePointerTip(host,{clientX:90,clientY:60},a);
  host._devices=[b]; refreshDeviceTip(host);
  assert.equal(host._tip,null);
  clearPointerHover(host);
  assert.equal(host._tip.deviceId,'b'); assert.equal(host._tip.title,'Keyboard');
});
