// Read-only corpus loader shared by the compatibility unit and executable parity.
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Script} from 'node:vm';

export const CORPUS_ROOT=fileURLToPath(new URL('../..',import.meta.url));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function identityProjection(config) {
  return (config.spaces||[]).map(space=>({
    space:space.id,
    catalogue:(space.wall_segments||[]).map(w=>w.id),
    rooms:(space.rooms||[]).map(r=>({id:r.id,walls:r.wall_ids})),
    openings:(space.openings||[]).map(o=>({id:o.id,host:o.host?{kind:o.host.kind,id:o.host.id}:null})),
    partitions:(space.partitions||[]).map(w=>w.id),
  }));
}

export function extractCorpusConfigs(value,label) {
  const entries=[];
  const visit=(v,path)=>{
    if(!v||typeof v!=='object')return;
    if(!Array.isArray(v)&&Array.isArray(v.spaces)
      &&v.spaces.every(s=>s&&typeof s==='object'&&!Array.isArray(s))){
      entries.push({label:path,input:structuredClone(v)}); return;
    }
    if(!Array.isArray(v)&&typeof v.id==='string'&&Array.isArray(v.rooms)){
      entries.push({label:path,input:{spaces:[structuredClone(v)],markers:[],settings:{}}}); return;
    }
    for(const [key,child] of Object.entries(v))visit(child,path+'/'+key);
  };
  visit(value,label);
  return entries;
}

function demoConfig(root) {
  const html=readFileSync(resolve(root,'demo/srv/demo.html'),'utf8');
  const declaration=html.search(/\b(?:const|let) CFG = /);
  if(declaration<0)throw Error('wall corpus: demo CFG is missing');
  const start=html.indexOf('{',declaration);
  // Find an actual complete object expression, not a brace count inside strings.
  for(let end=start+1;end<html.length;end++){
    if(html[end]!=='}')continue;
    try { return new Script('('+html.slice(start,end+1)+')').runInNewContext(); }
    catch(error) { if(!(error instanceof SyntaxError)&&error.name!=='SyntaxError')throw error; }
  }
  throw Error('wall corpus: demo CFG cannot be parsed');
}

export async function loadWallIdentityCorpus(root=CORPUS_ROOT) {
  const entries=[],inventory=[];
  const directory=resolve(root,'test/fixtures');
  const walk=dir=>{
    for(const file of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
      const path=resolve(dir,file.name);
      if(file.isDirectory()){walk(path);continue;}
      if(!file.name.endsWith('.json'))continue;
      const label=relative(root,path).replaceAll('\\','/');
      // These are the explicit repaired witnesses and this guard's own passport.
      if(/^845-wall-(identity-parity|corpus-identities)\.json$/.test(file.name))continue;
      const found=extractCorpusConfigs(JSON.parse(readFileSync(path,'utf8')),label);
      inventory.push({file:label,configs:found.length});
      entries.push(...found);
    }
  };
  walk(directory);
  const demo=resolve(root,'demo/fixtures');
  for(const file of readdirSync(demo).filter(f=>f.endsWith('.mjs')).sort()){
    const label='demo/fixtures/'+file,loaded=await import(pathToFileURL(resolve(demo,file)).href);
    let count=0;
    for(const [name,factory] of Object.entries(loaded)){
      if(typeof factory!=='function'||!/^make.*Fixture$/.test(name))continue;
      const found=extractCorpusConfigs(factory(),label+':'+name);
      entries.push(...found);count+=found.length;
    }
    inventory.push({file:label,configs:count});
  }
  entries.push(...extractCorpusConfigs(demoConfig(root),'demo/srv/demo.html:CFG'));
  inventory.push({file:'demo/srv/demo.html',configs:1});
  if(!entries.length)throw Error('wall corpus: no configs');
  return {entries,inventory};
}

// Current-model incomplete test inputs legitimately allocate fresh UUIDs.
// Pin only the test factory, never persisted/product identity or production entropy.
export function withCorpusIds(callback) {
  const original=globalThis.crypto.randomUUID;
  let sequence=0;
  globalThis.crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0');
  try{return callback();}finally{globalThis.crypto.randomUUID=original;}
}

export function corpusOutcome(commit,input) {
  return withCorpusIds(()=>{
    try {
      const config=commit(input).config;
      return {ok:true,identity:identityProjection(config)};
    }catch(error){
      if(!error.reason)throw error;
      return {ok:false,reason:error.reason};
    }
  });
}

export function corpusPassport(commit,corpus) {
  return {schema:1,baseline:'a7ee8e44f23e0f2b1e5b77cb73987bfb3116ba64',
    inventory:corpus.inventory,
    documents:corpus.entries.map(({label,input})=>({label,fingerprint:hash(input),...corpusOutcome(commit,input)}))};
}
