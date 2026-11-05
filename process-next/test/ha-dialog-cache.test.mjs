import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {prepareHaDialogAssets} from '../../demo/helpers/ha-dialog-assets.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('#1316 two cold HA asset clients publish one fully verified cache',{timeout:20000},async()=>{
  const root=mkdtempSync(join(tmpdir(),'hp-ha-cache-1316-'));
  const code='export var __webpack_modules__={7:(e,t,o)=>{o(9)},9:(e,t,o)=>{}};';
  const wheel=join(root,'fixture.whl');
  execFileSync(process.env.PYTHON||'python3',['-c',
    "import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z:z.writestr('hass_frontend/frontend_latest/1.aaaa.js',sys.argv[2])",wheel,code]);
  const bytes=readFileSync(wheel),waiting=[];let requests=0;
  const server=createServer((req,res)=>{requests++;waiting.push(res);if(waiting.length===2)for(const r of waiting){r.writeHead(200,{'content-length':bytes.length});r.end(bytes);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const files=[{path:'hass_frontend/frontend_latest/1.aaaa.js',sha256:digest(code)}];
    const modules={'7':{file:'1.aaaa.js',bytes:code.length,dependencies:['9']},'9':{file:'1.aaaa.js',bytes:code.length,dependencies:[]}};
    const pin={version:'1316-fixture',bytes:bytes.length,sha256:digest(bytes),module:'7',url:`http://127.0.0.1:${server.address().port}/fixture.whl`};
    pin.cacheManifestSha256=digest(JSON.stringify({version:pin.version,sha256:pin.sha256,url:pin.url,files,modules}));
    const options={pin,cacheDir:join(root,'cache')};
    const results=await Promise.allSettled([prepareHaDialogAssets(options),prepareHaDialogAssets(options)]);
    assert.ok(results.every(r=>r.status==='fulfilled'),results.map(r=>r.reason?.stack).join('\n'));
    const [a,b]=results.map(r=>r.value);assert.equal(a.root,b.root);assert.equal(requests,2);
    assert.equal(readFileSync(join(a.root,'frontend_latest/1.aaaa.js'),'utf8'),code);
    assert.deepEqual(await prepareHaDialogAssets(options),a);assert.equal(requests,2,'warm readers never redownload');
    writeFileSync(join(a.root,'frontend_latest/1.aaaa.js'),'corrupt');
    await assert.rejects(prepareHaDialogAssets(options),/integrity failed/,'a concurrent winner is still verified');
    const bad=join(root,'bad');
    await assert.rejects(prepareHaDialogAssets({pin:{...pin,module:'999'},cacheDir:bad,wheelPath:wheel}),/factory is absent/);
    assert.equal(existsSync(join(bad,'verified')),false,'failed extraction is never published');
    assert.deepEqual(readdirSync(bad),[],'only the caller staging directory is cleaned');
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});
