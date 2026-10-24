import test from 'node:test';
import assert from 'node:assert/strict';
import {TAP_ACTIONS} from '../test-build/logic.js';
import {projectedTapAction,infoCardTapConfirmationRequired,toggleOriginOf} from '../test-build/device-toggle.js';
import {virtualDeviceCopy} from '../test-build/device-copy.js';
import {currentMarkerSettingsDevice,markerSettingsTargetKey} from '../test-build/view-action-context.js';
const device={id:'settings-source',name:'Settings target',space:'f1',area:null,icon:'mdi:lightbulb',model:null,description:'kept',entities:['light.settings'],primary:'light.settings',bindingKind:'entity',bindingRef:'light.settings',tapAction:'settings',marker:{id:'settings-source',binding:'entity:light.settings',tap_action:'settings',tap_target:'script.unrelated',tap_confirm:true,description:'kept'}};
test('#1050 settings is a persisted UI action, independently of domain/service eligibility',()=>{
  assert.ok(TAP_ACTIONS.includes('settings'));
  for(const domain of ['light','switch','sensor','lock',null])assert.equal(projectedTapAction('settings',domain),'settings');
  assert.equal(toggleOriginOf(device),null);
  assert.equal(infoCardTapConfirmationRequired(device),false);
  assert.equal(projectedTapAction('future-action','light'),'info');
  assert.equal(projectedTapAction('cover','cover'),'toggle');
});
test('#1050 actual virtual copy preserves settings and does not rewrite unrelated saved action fields',()=>{
  const before=structuredClone(device);
  const copy=virtualDeviceCopy(device,'settings-copy','Settings target 2',[],{states:{}},'#ffffff');
  assert.equal(copy.tap_action,'settings');
  assert.equal(copy.tap_target,'script.unrelated');
  assert.equal(copy.tap_confirm,true);
  assert.equal(copy.description,'kept');
  assert.deepEqual(device,before);
});
test('#1050 a settings target follows fresh HA state but never another binding, hidden row or floor',()=>{
  const context={spaceId:'f1',id:device.id},key=markerSettingsTargetKey(device);
  const fresh={...device,name:'Current name',state:'off',primary:'light.settings',marker:{...device.marker}};
  assert.equal(currentMarkerSettingsDevice([fresh],'f1',context,key),fresh);
  for(const replacement of [
    {...fresh,id:'other'}, {...fresh,space:'f2'}, {...fresh,hidden:true},
    {...fresh,bindingKind:'device'}, {...fresh,bindingRef:'light.other'},
    {...fresh,marker:{...fresh.marker,binding:'entity:light.other'}},
  ])assert.equal(currentMarkerSettingsDevice([replacement],'f1',context,key),null);
  assert.equal(currentMarkerSettingsDevice([fresh],'f2',context,key),null);
  assert.equal(currentMarkerSettingsDevice([],'f1',context,key),null);
});
test('#1050 virtual and unavailable targets do not gain a service-capability ACL',()=>{
  for(const current of [
    {...device,primary:undefined,entities:[],bindingKind:'virtual',bindingRef:undefined,marker:{...device.marker,binding:'virtual'}},
    {...device,state:'unavailable',entities:[]},
  ]){
    assert.equal(currentMarkerSettingsDevice([current],'f1',{spaceId:'f1',id:current.id},markerSettingsTargetKey(current)),current);
    assert.equal(infoCardTapConfirmationRequired(current),false);
  }
});
