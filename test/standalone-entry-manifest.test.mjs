import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,mkdirSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { standalonePath,verifyStandaloneManifest,sha256,compatibility,buildStandalone } from '../scripts/standalone-build.mjs';
import { fileURLToPath } from 'node:url';

test('#1423 manifest rejects escaping and remote paths',()=>{
  const output=resolve(tmpdir(),'output');
  for(const path of ['../dist/card.js','https://ha.test/card.js','/etc/passwd','a\\b','a/../b','a//b','x?q=1','x#hash','a%2f..%2fb',''])
    assert.throws(()=>standalonePath(output,path),path);
  assert.equal(standalonePath(output,'chunks/editor-abc.js'),join(output,'chunks','editor-abc.js'));
});
test('#1423 builder refuses HA/root/outside and preserves an unowned output directory',async t=>{
  const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
  for(const directory of [root,resolve(root,'dist'),resolve(root,'src'),resolve(root,'..','standalone-external')])
    await assert.rejects(buildStandalone(directory),/separate generated directory/);
  const parent=resolve(root,'artifacts');mkdirSync(parent,{recursive:true});
  const dir=mkdtempSync(join(parent,'standalone-unowned-')),file=join(dir,'keep.txt');writeFileSync(file,'user data');
  t.after(()=>{unlinkSync(file);rmdirSync(dir);});
  await assert.rejects(buildStandalone(dir),/not owned/);assert.equal(readFileSync(file,'utf8'),'user data');
});
test('#1423 complete local manifest proves bytes, graph and required font/CSS, not file existence alone',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hp-standalone-manifest-'));
  const files=['entry.js','editor.js','theme.css','font.ttf'].map(path=>{
    const bytes=Buffer.from(path);writeFileSync(join(dir,path),bytes);return {path,bytes:bytes.length,sha256:sha256(bytes)};
  });
  const manifest={schema:1,product:'houseplan-standalone',entry:'entry.js',stylesheet:'theme.css',font:'font.ttf',files,
    modules:[{path:'entry.js',imports:[],dynamicImports:['editor.js']},{path:'editor.js',imports:[],dynamicImports:[]}]};
  assert.equal(verifyStandaloneManifest(dir,manifest),true);
  for(const invalid of [{...manifest,files:[...files,files[0]]},{...manifest,font:'absent.ttf'},
    {...manifest,modules:[{path:'entry.js',imports:['missing.js'],dynamicImports:[]}]}])assert.throws(()=>verifyStandaloneManifest(dir,invalid));
  writeFileSync(join(dir,'editor.js'),'tampered');assert.throws(()=>verifyStandaloneManifest(dir,manifest),/hash mismatch/);
});
test('#1423 compatibility comes from the actual portable core, independent of UI version',()=>{
  const c=compatibility();assert.equal(c.modelVersion,11);assert.equal(c.exportVersion,3);
  assert.deepEqual(c.readableExportVersions,[1,2,3]);assert.equal(c.installationBackup,false);
  const source=readFileSync(new URL('../custom_components/houseplan/core/constants.py',import.meta.url),'utf8');
  assert.ok(source.includes(`PLAN_MODEL_VERSION = ${c.modelVersion}`));
});
test('#1423 renderer has no HA card-registration, picker or banner effect; the installed entry retains them',()=>{
  const core=readFileSync(new URL('../src/houseplan-card.ts',import.meta.url),'utf8');
  assert.doesNotMatch(core,/registerPickerCard\(|customElements\.define\('houseplan-card'|console\.info\(/);
  const entry=readFileSync(new URL('../src/houseplan-ha-card-entry.ts',import.meta.url),'utf8');
  assert.match(entry,/customElements\.define\('houseplan-card', HouseplanCard\)/);
  assert.match(entry,/registerPickerCard\('houseplan-card'\)/);assert.match(entry,/console\.info\(/);
});
