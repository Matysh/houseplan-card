import test from 'node:test';
import assert from 'node:assert/strict';
import { savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { physicalSpaceRecord } from '../test-build/structural-space-record.js';

test('#1518 space draft saves a local opt-in without changing colours or geometry identity', () => {
  const space={id:'s',title:'Default',settings:{wall_fill:{c:'#748eff',a:.35},room_color:'#743721',room_opacity:0}};
  assert.equal(spaceDisplayOf(space).transparentWalls3d,false);
  const draft=savedSpaceDialogDraft(space,false);
  const settings=spaceDialogSettings({...draft,transparentWalls3d:true},space.settings);
  const confirmed={...space,settings};
  assert.equal(spaceDisplayOf(confirmed).transparentWalls3d,true);
  assert.equal(savedSpaceDialogDraft(confirmed,false).transparentWalls3d,true);
  assert.deepEqual(settings.wall_fill,space.settings.wall_fill);
  assert.equal(settings.room_color,space.settings.room_color);
  assert.equal(settings.room_opacity,space.settings.room_opacity);
  const disabled=spaceDialogSettings({...savedSpaceDialogDraft(confirmed,false),transparentWalls3d:false},settings);
  assert.equal(Object.hasOwn(disabled,'transparent_walls_3d'),false);
  assert.deepEqual(physicalSpaceRecord({...confirmed,settings:disabled}),physicalSpaceRecord(confirmed));
});
