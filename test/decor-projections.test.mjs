import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpaceStatic } from '../test-build/space-render.js';
import { reorderDecor } from '../test-build/editors/decor/order.js';

// Inspect emitted image nodes of the executed Lit renderer, never source text.
function imageIds(value, out = []) {
  if (Array.isArray(value)) for (const child of value) imageIds(child, out);
  else if (value?.strings) {
    if (value.strings[0].startsWith('<image class="dimage"')) out.push(value.values[0]);
    for (const child of value.values) imageIds(child, out);
  }
  return out;
}
test('#1035 static space renderer keeps the relative stored order of supported decor images', () => {
  const shape={kind:'image',asset_id:'a'.repeat(64),x:.1,y:.1,w:.2,h:.2};
  const decor=[{...shape,id:'first'},{kind:'text',id:'label',text:'full card only',x:.5,y:.5},{...shape,id:'second'}];
  const render=items=>renderSpaceStatic({
    cfg:{model_version:10,spaces:[{id:'order',title:'Order',cell_cm:5,rooms:[],decor:items}],markers:[],settings:{}},
    hass:{states:{}},layout:{},spaceId:'order',lang:'en',decorAssetUrl:()=>'/asset.png',displayUrl:raw=>raw,
  });
  assert.deepEqual(imageIds(render(decor)),['first','second']);
  assert.deepEqual(imageIds(render(reorderDecor(decor,'first','front'))),['second','first']);
  assert.deepEqual(imageIds(render(reorderDecor(decor,'second','back'))),['second','first']);
  assert.equal(decor[1].text,'full card only');
});
