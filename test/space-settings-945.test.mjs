import test from 'node:test';
import assert from 'node:assert/strict';
import { spaceDisplayOf } from '../test-build/logic.js';
import { savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';
import { deviceBatteryModeOf, showDeviceBatteryOf, spaceDeviceBatteryModeOf, writeSpaceDeviceBatterySetting } from '../test-build/device-battery-settings.js';

test('#945 independent font bases fall back separately without double multiplication', () => {
  const legacy = {id:'s',title:'S',settings:{card_font_scale:2}};
  assert.equal(spaceDisplayOf(legacy).cardNameScale,2);
  assert.equal(spaceDisplayOf(legacy).cardLabelScale,2);
  const draft = savedSpaceDialogDraft(legacy,false);
  draft.cardNameScale = 1;
  const saved = spaceDialogSettings(draft,legacy.settings);
  assert.equal(saved.card_font_scale,2,'legacy key is preserved for rollback');
  assert.equal(saved.card_name_scale,1,'explicit 100% cannot be omitted over legacy 200%');
  assert.equal(saved.card_label_scale,2);
  const reopened = savedSpaceDialogDraft({...legacy,settings:saved},false);
  assert.equal(reopened.cardNameScale,1);
  assert.equal(reopened.cardLabelScale,2);
  assert.equal(spaceDisplayOf({...legacy,settings:{...saved,card_name_scale:undefined}}).cardNameScale,2);
  for (const invalid of ['2', null, 0, -1, NaN, Infinity]) {
    assert.equal(spaceDisplayOf({...legacy,settings:{...legacy.settings,card_name_scale:invalid}}).cardNameScale,2);
  }
  assert.equal(spaceDisplayOf({...legacy,settings:{card_font_scale:'2'}}).cardNameScale,1);
});

test('#945 battery inheritance is live, local all overrides global off, inherit removes only its key', () => {
  for (const [global,expected] of [[{},'all'],[{show_device_battery:false},'off'],[{show_device_battery:'low'},'low']]) {
    for (const own of [undefined,'inherit','all','low','off']) {
      const space = {show_device_battery_mode:own};
      assert.equal(deviceBatteryModeOf(global,space),own === undefined || own === 'inherit' ? expected : own);
      assert.equal(showDeviceBatteryOf(global,space),deviceBatteryModeOf(global,space) !== 'off');
    }
  }
  const settings = {future:{keep:true},show_device_battery_mode:'all'};
  assert.equal(deviceBatteryModeOf({show_device_battery:false},settings),'all');
  writeSpaceDeviceBatterySetting(settings,'inherit');
  assert.deepEqual(settings,{future:{keep:true}});
  assert.equal(spaceDeviceBatteryModeOf(settings),'inherit');
  assert.equal(deviceBatteryModeOf({show_device_battery:false},settings),'off');
});

test('#945 active legacy background is explicit own static; inherit save clears colour and keeps unknown fields', () => {
  const old = {id:'s',title:'S',settings:{bg_color:'#112233',future:{keep:true},glow_enabled:false}};
  const before = structuredClone(old);
  const draft = savedSpaceDialogDraft(old,false,'static');
  assert.equal(draft.bgMode,'static');
  assert.equal(draft.glowEnabled,false,'legacy appearance stays until Save');
  assert.equal(savedSpaceDialogDraft(old,false,'daynight').bgMode,null,'inactive colour does not override follow-sun');
  assert.deepEqual(old,before,'opening or cancelling does not write');
  const own = spaceDialogSettings(draft,old.settings);
  assert.equal(own.bg_mode,'static'); assert.equal(own.bg_color,'#112233');
  assert.equal(own.glow_enabled,true,'ordinary Save retires the removed prohibition');
  draft.bgMode = null; draft.bgColor = null; draft.deviceBatteryMode = 'inherit';
  const inherited = JSON.parse(JSON.stringify(spaceDialogSettings(draft,old.settings)));
  assert.equal('bg_color' in inherited,false); assert.equal('bg_mode' in inherited,false);
  assert.equal('show_device_battery_mode' in inherited,false);
  assert.deepEqual(inherited.future,{keep:true});
});

test('#945 merged opening/border choice is immediate and stable on repeated saves', () => {
  for (const plan_url of [null,'/plan.svg']) for (const show_borders of [undefined,true,false]) {
    for (const hide_openings of [undefined,true,false]) {
      const space = {id:'s',title:'S',plan_url,settings:{show_borders,hide_openings}};
      const draft = savedSpaceDialogDraft(space,false);
      assert.equal(draft.hideOpenings,!draft.showBorders);
      const settings = spaceDialogSettings(draft,space.settings);
      const again = spaceDialogSettings(savedSpaceDialogDraft({...space,settings},false),settings);
      assert.deepEqual(again,settings);
      assert.equal(!!settings.hide_openings,!(show_borders ?? !plan_url));
    }
  }
});
