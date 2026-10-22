import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appearanceColorOf, spaceAppearanceOf, roomNameColorOf, normalizeRoomAppearance, spaceDraftAppearanceOf } from '../test-build/room-appearance.js';
import { spaceDisplayOf, roomCustomFillOf } from '../test-build/logic.js';
import { newSpaceDialogDraft, savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/room-appearance.json', import.meta.url)));
test('old warm drafts resolve new colours without mutating or dirtying the original draft',()=>{
  const d={roomColor:'#123456',roomOpacity:.2},before=JSON.stringify(d);
  assert.deepEqual(spaceDraftAppearanceOf(d,{settings:{wall_fill:{c:'#abcdef',a:0}}}),
    {nameColor:{c:'#123456',a:.45},wallFill:{c:'#abcdef',a:0}});
  assert.equal(JSON.stringify(d),before);
});
test('legacy appearance parity corpus: effective alpha once; local values including zero win', () => {
  for (const f of fixtures) {
    assert.deepEqual(spaceAppearanceOf(f.space, f.general), {nameColor:f.nameColor,wallFill:f.wallFill});
    const source = {spaces:[{id:'s',...f.space}],settings:f.general,unknown:{keep:true}};
    const before = structuredClone(source), normalized = normalizeRoomAppearance(source);
    assert.deepEqual(source,before);
    assert.deepEqual(normalizeRoomAppearance(normalized),normalized);
    assert.deepEqual(normalized.spaces[0].settings.name_color,f.nameColor);
    assert.deepEqual(normalized.spaces[0].settings.wall_fill,f.wallFill);
    assert.deepEqual(normalized.unknown,source.unknown);
  }
});
test('caption inheritance is independent of wall opacity, fill modes, room custom fill and global palette', () => {
  const name={c:'#123456',a:0.4}, own={c:'#654321',a:0};
  for (const fill_mode of ['none','custom','lqi','light','temp','glow']) {
    const room={settings:{fill_mode,name_color:own,custom_fill:{c:'#998877',a:0.9}}};
    assert.deepEqual(roomNameColorOf(name,room),own);
    assert.deepEqual(roomNameColorOf(name,{settings:{...room.settings,name_color:null}}),name);
    assert.deepEqual(roomNameColorOf(name,{}),name);
    assert.deepEqual(roomCustomFillOf({c:'#aabbcc',a:0.2},room),fill_mode==='custom'?room.settings.custom_fill:{c:'#aabbcc',a:0.2});
  }
  const source=normalizeRoomAppearance({spaces:[{id:'a'},{id:'b',settings:{name_color:own}}],settings:{}});
  source.spaces[0].settings.name_color={c:'#abcdef',a:1};
  source.settings={fill_colors:{wall_fill:{c:'#000000',a:0}}};
  assert.deepEqual(spaceDisplayOf(source.spaces[1],source.settings).nameColor,own);
  assert.deepEqual(spaceDisplayOf(source.spaces[1],source.settings).wallFill,{c:'#ffffff',a:1});
});
test('appearance read boundary rejects malformed tokens without truthy-zero fallbacks', () => {
  const fallback={c:'#123456',a:0.2};
  for(const a of [null,true,'0',NaN,Infinity])assert.deepEqual(appearanceColorOf({c:'url(evil)',a},fallback),fallback);
  assert.deepEqual(appearanceColorOf({c:'#112233',a:0},fallback),{c:'#112233',a:0});
});
test('space drafts preserve legacy alpha and unknown colour siblings; fresh defaults are local', () => {
  const draft=newSpaceDialogDraft(false);
  assert.deepEqual(draft.nameColor,{c:'#55606c',a:0.8});
  assert.equal(draft.customFill.a,0);
  assert.deepEqual(draft.wallFill,{c:'#ffffff',a:1});
  const old={id:'s',title:'Old',settings:{room_color:'#123456',room_opacity:0.2}};
  const edited=savedSpaceDialogDraft(old,false,undefined,{fill_colors:{wall_fill:{c:'#abcdef',a:0}}});
  assert.deepEqual(edited.nameColor,{c:'#123456',a:0.45});
  assert.deepEqual(edited.wallFill,{c:'#abcdef',a:0});
  const saved=spaceDialogSettings(edited,{future:1,name_color:{future:'keep'}});
  assert.deepEqual(saved.name_color,{future:'keep',c:'#123456',a:0.45});
  assert.equal(saved.future,1);
});
