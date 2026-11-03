// Read-only corpus loader shared by the compatibility unit and executable parity.
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Script} from 'node:vm';

export const CORPUS_ROOT=fileURLToPath(new URL('../..',import.meta.url));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Full persisted JSON: only object key order is canonical; arrays and values are intact. */
export function fullConfigSha256(config) {
  const canonical=value=>Array.isArray(value)?value.map(canonical)
    :value!==null&&typeof value==='object'
      ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  return hash(canonical(config));
}
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
    // graph_change.spaces contains protocol patches, not persisted spaces.
    // Stop at the typed envelope; never reinterpret patch fragments as configs.
    if(!Array.isArray(v)&&[1,2].includes(v.version)&&Array.isArray(v.spaces)&&v.spaces.length
      &&v.spaces.every(s=>s&&typeof s==='object'&&!Array.isArray(s)
        &&typeof s.space_id==='string'&&!Object.hasOwn(s,'id')
        &&s.patch&&typeof s.patch==='object'&&!Array.isArray(s.patch)
        &&(Object.hasOwn(s,'base')||Object.hasOwn(s,'base_digest'))))return;
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
      if(/^845-wall-(identity-parity|corpus-identities|corpus-current-identities)\.json$/.test(file.name))continue;
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

/** Immutable original inputs: never depend on Git history or current decoder output. */
export function loadHistoricalWallIdentityCorpus(root=CORPUS_ROOT) {
  const bytes=readFileSync(resolve(root,'docs/testing/issue1226/repros/845-historical-inputs.json.gz'));
  const expected=readFileSync(resolve(root,'test/fixtures/845-wall-corpus-identities.json'));
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(digest(bytes)!=='166699b562311b4f742f2ad563f081e0356239b89afe5168a30273a8fe078115')
    throw Error('wall corpus: historical archive bytes changed');
  const archive=JSON.parse(gunzipSync(bytes)), manifest=JSON.parse(expected);
  if(digest(expected)!=='1507c3a072c3eb42a754d5908ac17f9b51d6d9a126248cfbe6adbd626fef5317'
    ||archive.manifest!==digest(expected)||archive.schema!==1||archive.records?.length!==229)
    throw Error('wall corpus: original passport or archive membership changed');
  const old=new Map(manifest.documents.map(row=>[row.label,row])), labels=new Set();
  const entries=archive.records.map(record=>{
    if(labels.has(record.label)||!old.has(record.label)||hash(record.input)!==record.fingerprint
      ||JSON.stringify(record.expected)!==JSON.stringify(old.get(record.label))
      ||record.expected.fingerprint!==record.fingerprint||!record.source?.commit)
      throw Error('wall corpus: historical input/expected/provenance mismatch: '+record.label);
    labels.add(record.label);
    return {label:record.label,input:structuredClone(record.input),fingerprint:record.fingerprint,
      provenance:[{...structuredClone(record.source),recoveryKind:record.source.kind,kind:'historical'}]};
  });
  if(labels.size!==old.size)throw Error('wall corpus: an original source is missing');
  return {entries,inventory:structuredClone(manifest.inventory)};
}

/** Preserve historical label+input pairs; append changed/new current sources separately. */
export async function loadCompleteWallIdentityCorpus(root=CORPUS_ROOT) {
  const historical=loadHistoricalWallIdentityCorpus(root), current=await loadWallIdentityCorpus(root);
  const entries=historical.entries, old=new Map(entries.map(entry=>[entry.label,entry]));
  for(const entry of current.entries){
    const fingerprint=hash(entry.input), previous=old.get(entry.label);
    const provenance={kind:'current',label:entry.label,fingerprint};
    if(previous?.fingerprint===fingerprint){previous.provenance.push(provenance);continue;}
    entries.push({...entry,label:previous?entry.label+'@current:'+fingerprint:entry.label,fingerprint,
      provenance:[provenance]});
  }
  return {entries,inventory:current.inventory,historicalInventory:historical.inventory};
}