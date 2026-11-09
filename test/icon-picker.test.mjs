import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mdiCatalog} from '../test-build/mdi-icon-catalog.js';
import {mdiNumeric0Circle,mdiAccessPointMinus,mdiFan} from '@mdi/js';
test('local MDI catalog preserves canonical digit separators and exact glyphs',()=>{
 assert.equal(mdiCatalog.get('mdi:numeric-0-circle'),mdiNumeric0Circle);
 assert.equal(mdiCatalog.get('mdi:access-point-minus'),mdiAccessPointMinus);
 assert.equal(mdiCatalog.get('mdi:fan'),mdiFan);
 assert.equal(mdiCatalog.has('mdi:numeric0-circle'),false);
});
test('local catalog covers every pinned MDI name with an SVG path',()=>{
 const meta=JSON.parse(readFileSync(new URL('../node_modules/@mdi/svg/meta.json',import.meta.url)));
 const names=JSON.parse(readFileSync(new URL('../src/mdi-icon-names.json',import.meta.url)));
 assert.deepEqual(names,meta.map(icon=>icon.name).sort());
 assert.equal(mdiCatalog.size,meta.length);
 for(const name of names)assert.match(mdiCatalog.get('mdi:'+name),/^M\s*[\d.-]/,name);
});
