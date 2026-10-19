import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {toastInkMatch} from '../demo/helpers/toast-paint-956.mjs';
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const sample=ink=>{const p=new PNG({width:100,height:35});for(let i=0;i<p.data.length;i+=4)p.data.set([255,255,255,255],i);if(ink)for(let y=10;y<22;y++)for(let x=15;x<85;x+=4)p.data.set([30,30,30,255],(y*100+x)*4);return PNG.sync.write(p);};
test('independent ink oracle rejects covered/blank text and an empty reference',()=>{
 const blank=sample(false),letters=sample(true),fg=[30,30,30],bg=[255,255,255];
 assert.equal(toastInkMatch(letters,letters,fg,bg).painted,true);
 assert.equal(toastInkMatch(blank,letters,fg,bg).painted,false);
 assert.equal(toastInkMatch(blank,blank,fg,bg).painted,false);
});
