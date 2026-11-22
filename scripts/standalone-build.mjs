/** Separate local frontend distribution. Never cleans/writes the HA output. */
import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync, lstatSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { resolve, relative, dirname, isAbsolute, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../rollup.config.mjs';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { renderStandaloneIcons } from './standalone-icons.mjs';
import { isMainModule } from './spawn-portable.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const MANIFEST='houseplan-standalone-manifest.json';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function standalonePath(directory,path){
  if(typeof path!=='string'||!path||! /^[A-Za-z0-9_./-]+$/.test(path)||isAbsolute(path)||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')
    || /[:?#\0]/.test(path))throw Error('Invalid standalone asset path');
  const target=resolve(directory,path),rel=relative(directory,target);
  if(rel.startsWith('..')||isAbsolute(rel))throw Error('Standalone asset escapes output');
  return target;
}
export function compatibility(){
  const constants=readFileSync(resolve(root,'custom_components/houseplan/core/constants.py'),'utf8');
  const number=name=>{const value=constants.match(new RegExp(`^${name} = (\\d+)$`,'m'));if(!value)throw Error(`Missing core ${name}`);return Number(value[1]);};
  return {modelVersion:number('PLAN_MODEL_VERSION'),exportVersion:number('EXPORT_VERSION'),
    readableExportVersions:[1,2,number('EXPORT_VERSION')],minimumImportedModelVersion:0,
    transfer:'single-space-plan-only-json',installationBackup:false};
}
export function verifyStandaloneManifest(directory,manifest){
  if(manifest?.schema!==1||manifest?.product!=='houseplan-standalone'||!Array.isArray(manifest.files))throw Error('Not a standalone manifest');
  const paths=new Set();
  if(lstatSync(directory).isSymbolicLink())throw Error('Linked standalone output');
  for(const file of manifest.files){
    const path=standalonePath(directory,file.path);
    for(let parent=dirname(path);parent!==resolve(directory);parent=dirname(parent)){
      if(parent===dirname(parent)||lstatSync(parent).isSymbolicLink())throw Error('Linked standalone asset parent');
    }
    if(paths.has(file.path)||!existsSync(path)||lstatSync(path).isSymbolicLink())throw Error('Missing/duplicate/linked standalone asset');
    paths.add(file.path);const bytes=readFileSync(path);
    if(bytes.length!==file.bytes||sha256(bytes)!==file.sha256)throw Error(`Standalone asset hash mismatch: ${file.path}`);
  }
  if(!paths.has(manifest.entry)||!paths.has(manifest.stylesheet)||!paths.has(manifest.font))throw Error('Incomplete standalone distribution');
  for(const module of manifest.modules){
    if(!paths.has(module.path)||[...module.imports,...module.dynamicImports].some(path=>!paths.has(path)))throw Error('Incomplete standalone module graph');
  }
  return true;
}

export async function buildStandalone(directory=resolve(root,'dist-standalone')){
  const out=resolve(directory),rel=relative(root,out);
  if(!rel||rel.startsWith('..')||isAbsolute(rel)||['dist','custom_components','src','demo','assets'].includes(rel.split(/[\\/]/)[0]))
    throw Error('Standalone output must be a separate generated directory');
  // Refuse symlinked output/ancestors and pre-existing unowned data. On rebuild
  // retire only hash-proven files in our preceding manifest, never a directory.
  for(let path=out;path!==root;path=dirname(path)){
    if(path===dirname(path))throw Error('Standalone output is outside the source root');
    if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('Linked standalone output');
  }
  const previousPath=resolve(out,MANIFEST);
  let previous;
  if(existsSync(out)&&readdirSync(out).length){
    if(!existsSync(previousPath))throw Error('Standalone output is not owned by this builder');
    previous=JSON.parse(readFileSync(previousPath,'utf8'));verifyStandaloneManifest(out,previous);
    const rejectLinks=directory=>{for(const item of readdirSync(directory,{withFileTypes:true})){
      if(item.isSymbolicLink())throw Error('Linked standalone output');
      if(item.isDirectory())rejectLinks(resolve(directory,item.name));
    }};rejectLinks(out);
  }
  if(readFileSync(resolve(root,'src/standalone-icons.generated.ts'),'utf8')!==renderStandaloneIcons())throw Error('Finite standalone icon map is stale: regenerate it before building');
  const fingerprint=sourceFingerprint(root);
  const version=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const source={commit:git('rev-parse','HEAD'),fingerprint,channel:'dev',dirty:!!git('status','--porcelain','--untracked-files=no')};
  const skipped=new Set(['houseplan-clean-bundle-output','houseplan-bundle-manifest','houseplan-entry-fallback']);
  const fontBytes=readFileSync(resolve(root,'assets/fonts/Roboto-Regular.ttf'));
  const font=`fonts/Roboto-Regular-${sha256(fontBytes).slice(0,12)}.ttf`;
  const assetPlugin={name:'houseplan-standalone-assets',generateBundle(_options,bundle){
    let links=0;
    for(const chunk of Object.values(bundle))if(chunk.type==='chunk'&&chunk.code.includes('__HOUSEPLAN_STANDALONE_STYLESHEET__')){
      const target=posix.relative(posix.dirname(chunk.fileName),'houseplan-standalone.css');
      chunk.code=chunk.code.replace('__HOUSEPLAN_STANDALONE_STYLESHEET__',target.startsWith('.')?target:`./${target}`);links++;
    }
    if(links!==1)throw Error('Standalone stylesheet owner was not emitted exactly once');
    this.emitFile({type:'asset',fileName:font,source:fontBytes});
    this.emitFile({type:'asset',fileName:'houseplan-standalone.css',source:
      `@font-face{font-family:Roboto;src:url("./${font}") format("truetype");font-weight:400;font-style:normal;font-display:swap}.houseplan-standalone{font-family:Roboto,system-ui,sans-serif}.houseplan-standalone>houseplan-card{display:block;height:100%;min-height:400px}`});
    for(const [fileName,input] of [['licenses/MIT.txt','LICENSE'],['licenses/Roboto.txt','assets/fonts/LICENSE'],
      ['licenses/MDI.txt','custom_components/houseplan/licenses/mdi.txt'],['licenses/THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md']])
      this.emitFile({type:'asset',fileName,source:readFileSync(resolve(root,input))});
  }};
  const plugins=config.plugins.filter(p=>!skipped.has(p.name)).map(p=>p.name==='typescript'
    ?typescript({compilerOptions:{outDir:resolve(out,'.ts')}}):p);
  const build=await rollup({input:{'houseplan-standalone':'src/standalone-entry.ts'},plugins:[...plugins,assetPlugin]});
  let output;
  try{({output}=await build.write({...config.output,dir:out}));}finally{await build.close();}
  const files=output.map(item=>{
    const bytes=Buffer.from(item.type==='chunk'?item.code:item.source);
    return {path:item.fileName,bytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length,sha256:sha256(bytes)};
  }).sort((a,b)=>a.path.localeCompare(b.path));
  const modules=output.filter(i=>i.type==='chunk').map(i=>({path:i.fileName,entry:i.isEntry,
    imports:i.imports,dynamicImports:i.dynamicImports,modules:Object.keys(i.modules).map(p=>relative(root,p).replaceAll('\\','/'))}));
  const manifest={schema:1,product:'houseplan-standalone',version,source,compatibility:compatibility(),
    entry:'houseplan-standalone.js',stylesheet:'houseplan-standalone.css',font,
    fontWeights:{local:[400],synthesized:[500,600],fallback:'system-ui, sans-serif'},files,modules};
  verifyStandaloneManifest(out,manifest);
  const current=new Set(files.map(f=>f.path));
  for(const file of previous?.files||[])if(!current.has(file.path))unlinkSync(standalonePath(out,file.path));
  mkdirSync(out,{recursive:true});writeFileSync(previousPath,JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(isMainModule(import.meta.url)){
  const manifest=await buildStandalone();
  console.log(JSON.stringify({directory:'dist-standalone',source:manifest.source,files:manifest.files.length,
    rawBytes:manifest.files.reduce((n,f)=>n+f.bytes,0),gzipBytes:manifest.files.reduce((n,f)=>n+f.gzipBytes,0)}));
}
