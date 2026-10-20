import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxMenuViewport } from '../test-build/device-inbox-menu.js';
import { placeFloatingSurface } from '../test-build/floating-surface.js';

test('#976 inbox menu at the final row flips above inside the visible dialog body', () => {
  const viewport = inboxMenuViewport({left:0,right:390,bottom:78}, {top:532}, {left:0,top:0,width:390,height:600});
  const anchor = {left:14,right:58,top:462,bottom:506,width:44,height:44};
  const place = placeFloatingSurface(anchor,{width:180,height:154},viewport,4);
  assert.equal(place.side,'top');
  assert.ok(place.top >= 78 + 8 && place.top + 154 <= 532 - 8);
  assert.ok(place.left >= 8 && place.left + 180 <= 390 - 8);
});

test('#976 inbox viewport intersects dialog chrome and keyboard/pinch viewport', () => {
  assert.deepEqual(inboxMenuViewport({left:100,right:1020,bottom:120},{top:760},
    {left:150,top:140,width:360,height:300}), {left:150,top:140,width:360,height:300});
  const bounds = inboxMenuViewport({left:0,right:390,bottom:100},{top:90},
    {left:0,top:0,width:390,height:600});
  assert.equal(bounds.height,0);
});
