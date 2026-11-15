/** #1454 faults and atomic publication against the actual browser IDB store. */
import { launch, check, finish } from './serve.mjs';
const {page,browser}=await launch({width:1280,height:900});
try{
  const out=await page.evaluate(async()=>{
    const card=window.__card;
    const until=async(predicate,label)=>{const start=performance.now();while(!predicate()){
      if(performance.now()-start>15_000)throw Error(label);await new Promise(resolve=>setTimeout(resolve,5));}};
    card.requestUpdate();await until(()=>card._floorPreparation?.diagnostic.store.writes>0,'production publication');
    const original=card._floorPreparation.store, Store=original.constructor;
    // A second same-origin browsing surface owns a separate IDB connection.
    const iframe=document.createElement('iframe');document.body.append(iframe);
    const left=new Store(),right=new Store(iframe.contentWindow.indexedDB);
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('houseplan-derived-floors-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const readAll=()=>Promise.all(['meta','preview','geometry'].map(name=>req(db.transaction(name).objectStore(name).getAll())));
    const [meta,preview,geometry]=await readAll();
    const example={address:{scope:'synthetic-storage-scope',floor:'floor-0',key:'key'},generation:'g',created:Date.now(),
      preview:preview[0].payload,geometry:geometry[0].payload};
    if(!meta.length||!example.geometry)throw Error('positive payload missing');
    const publish=(store,floor,generation)=>store.publish({...example,address:{...example.address,floor},generation},()=>true);
    const revoked=await left.publish(example,()=>false);
    // Both connections write the same bucket. A reader must never observe a
    // pointer from one transaction and a level from the other.
    await Promise.all([publish(left,'atomic','left'),publish(right,'atomic','right')]);
    const [allMeta,allL1,allL2]=await readAll();
    const active=allMeta.find(row=>row.floor==='atomic');
    const atomic=!!active&&allL1.some(row=>row.generation===active.generation)&&allL2.some(row=>row.generation===active.generation);
    for(let i=0;i<8;i++)await publish(left,`lru-${i}`,`lru-${i}`);
    const zero={...example.address,floor:'lru-0'};
    await left.read(zero,'preview');
    // A round trip through a subsequent writer serializes the deferred touch.
    await publish(right,'lru-8','lru-8');
    const lruRows=(await readAll())[0].filter(row=>row.scope===example.address.scope);
    const lru=lruRows.length===8&&lruRows.some(row=>row.floor==='lru-0')&&!lruRows.some(row=>row.floor==='lru-1');
    const start=performance.now(), slow=new Store();slow.connection=new Promise(()=>{});
    const timeout=await slow.read(example.address,'geometry');
    const bounded=timeout===null&&performance.now()-start<400&&slow.metrics.timeouts===1;
    const forbidden=new Store({open(){throw new DOMException('private storage','SecurityError');}});
    const privateMiss=await forbidden.read(example.address,'geometry')===null;
    const oversized=await left.publish({...example,preview:{...example.preview,bytes:2*1024**2+1,text:'x'.repeat(2*1024**2+1)}},()=>true);
    const wrongScope=await right.read({...zero,scope:'another-user'},'preview');
    // Envelope-byte boundaries exercise the real transaction eviction. These
    // synthetic cap payloads are never offered to a geometry decoder/renderer.
    const capPayload=(size)=>({text:'x'.repeat(size),bytes:size,checksum:'a'.repeat(64)});
    for(const scope of ['cap-A','cap-B','cap-C'])for(let i=0;i<(scope==='cap-C'?1:4);i++)
      await left.publish({...example,address:{scope,floor:`cap-${i}`,key:'cap'},generation:`${scope}-${i}`,
        preview:capPayload(2*1024**2),geometry:capPayload(8*1024**2)},()=>true);
    const capped=await req(db.transaction('meta').objectStore('meta').getAll());
    const bytes=capped.reduce((n,row)=>n+row.bytes,0);
    const caps=bytes<=64*1024**2&&['cap-A','cap-B','cap-C'].every(scope=>
      capped.filter(row=>row.scope===scope).reduce((n,row)=>n+row.bytes,0)<=32*1024**2);
    db.close();left.close();right.close();forbidden.close();iframe.remove();
    const upgraded=await new Promise((resolve,reject)=>{const r=indexedDB.open('houseplan-derived-floors-v1',2);
      // close() is close-pending until already accepted transactions finish.
      // A transient blocked event is legal; an upgrade that never completes is not.
      const deadline=setTimeout(()=>reject(Error('versionchange did not close cache connection')),3000);
      r.onsuccess=()=>{clearTimeout(deadline);resolve(r.result);};
      r.onerror=()=>{clearTimeout(deadline);reject(r.error);};});
    const versionMiss=await original.read(zero,'preview')===null;
    card.requestUpdate();await card.updateComplete;
    const versionSafe=versionMiss&&original.closed&&!!card.renderRoot.querySelector('.dev');upgraded.close();
    return{atomic,lru,bounded,privateMiss,revocationDenied:!revoked,oversizedDenied:!oversized,wrongScopeMiss:wrongScope===null,
      count:lruRows.length,bytes,caps,versionSafe};
  });
  console.log(JSON.stringify(out));
  for(const key of ['atomic','lru','bounded','privateMiss','revocationDenied','oversizedDenied','wrongScopeMiss','caps','versionSafe'])check(key,out[key]);
}finally{await finish(browser);}
