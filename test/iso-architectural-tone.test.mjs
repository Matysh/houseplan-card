import test from 'node:test';
import assert from 'node:assert/strict';
import {architecturalFloorTone} from '../test-build/iso-architectural-tone.js';
import {colorLuma, parseCssColor} from '../test-build/iso-materials.js';

const luma = c => colorLuma(parseCssColor(c));
test('#1495 a matching static floor keeps visible contrast with the walls', () => {
  assert(luma(architecturalFloorTone('#ffffff','#ffffff',true)) < luma('#ffffff'));
  assert(luma(architecturalFloorTone('#11141a','#11141a',true)) > luma('#11141a'));
  assert(luma(architecturalFloorTone('#9ab5b2','#9ab5b2',true)) < luma('#9ab5b2'));
  assert.equal(architecturalFloorTone('#223344','#ffffff',true),'#223344');
  assert.equal(architecturalFloorTone('#9ab5b2','#9ab5b2',false),'#9ab5b2','dynamic fill');
});
