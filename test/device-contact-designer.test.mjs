import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {designerContactCases} from '../demo/fixtures/device-contact-designer-866.mjs';
import {makeDeviceContactsFixture} from '../demo/golden/device-contacts.mjs';

test('#866 designer oracle stays byte-identical to the accepted archive',()=>{
  const hashes={
    'geometry.mjs':'1e5076ac432af256ecff2fca0a013a86381cd72e7dff8fa63a726eb309160660',
    'marker.mjs':'d05f6bfc0fd3a377690821f593246a698182b87da2f65daad01453c0e697a901',
    'demo.css':'18e1c033b966d2c8ca3b1dcc26ae89103212a048ce3a55168182c820ff737137',
    'review.css':'59e56cf4113ecec88c64bbede2651535c70e6b1fcad07bf3585db278e4b579e7',
  };
  for(const [name,hash] of Object.entries(hashes))assert.equal(createHash('sha256')
    .update(readFileSync(new URL(`./fixtures/866-designer/${name}`,import.meta.url))).digest('hex'),hash,name);
});
test('#866 all twelve arrangements enter the real golden fixture without schema extensions',()=>{
  assert.equal(designerContactCases.length,12);
  const f=makeDeviceContactsFixture();assert.equal(f.config.markers.length,32);
  for(const scene of designerContactCases)for(const d of scene.devices){
    const id=`${scene.id}-${d.id}`;
    assert.ok(f.config.markers.some(m=>m.id===id));assert.deepEqual(Object.keys(f.layout[id]).sort(),['s','x','y']);
  }
});
