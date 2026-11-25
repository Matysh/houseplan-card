import test from 'node:test';
import assert from 'node:assert/strict';
import {StartupFloor} from '../test-build/startup-floor.js';

const defer = () => {
  let resolve;
  return {promise:new Promise(done => { resolve=done; }), resolve};
};
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const selection = {authority:{},connection:1,scope:'installation/account',floor:'A',variant:'a',revision:'one',size:[640,480],zoomHint:1};
const packet = {image:new Blob(),zoomHint:1};

function harness(remote) {
  let current=selection;
  const paint=[],writes=[],reads=[];
  const owner = new StartupFloor(() => current, () => paint.push('observed'), remote);
  owner.store={
    read(key){ reads.push(key); return Promise.resolve(null); },
    write(key,value,allowed){ if (!allowed()) return Promise.resolve(false); writes.push({key,value}); return Promise.resolve(true); },
    close(){},
  };
  return {owner,paint,writes,reads,set:next => { current=next; }};
}

test('#1520 a confirmed View alone can publish its presentation revision',async ({mock})=>{
  mock.timers.enable({apis:['setTimeout']});
  const h=harness(); let accepted=false,captures=0;
  const capture=async()=>{ captures++; return packet; };
  h.owner.capture(selection,capture,()=>accepted);
  mock.timers.tick(200); await flush();
  assert.equal(captures,0); assert.equal(h.reads.length,0);
  accepted=true; h.owner.capture(selection,capture,()=>accepted);
  mock.timers.tick(200); await flush();
  assert.equal(captures,1); assert.deepEqual(h.writes,[{key:selection,value:packet}]);
  assert.equal(h.owner.facts.capture,'stored');
  h.owner.capture(selection,capture,()=>true);
  mock.timers.tick(200); await flush();
  assert.equal(captures,1,'a published key cannot schedule work on each render');
  assert.equal(h.owner.canCapture({...selection,zoomHint:1.4}),false,'zoom does not use another key or schedule another capture');
  h.owner.dispose();
});

test('#1520 a different cold zoom is a miss before any SVG decode',async()=>{
  const h=harness();
  let decoded=false;
  h.owner.store.read=async()=>({zoomHint:2,get image(){decoded=true;return new Blob();}});
  h.owner.observe(selection);await flush();
  assert.equal(h.owner.facts.status,'camera-miss');assert.equal(decoded,false);
  h.owner.dispose();
});

test('#1520 a pan during idle capture cannot publish a mixed camera packet',async ({mock})=>{
  mock.timers.enable({apis:['setTimeout']});
  const h=harness(), rendering=defer();
  let centred=true;
  h.owner.capture(selection,()=>rendering.promise,()=>centred);
  mock.timers.tick(200);await flush();
  assert.equal(h.owner.facts.capture,'working');
  centred=false;rendering.resolve(packet);await flush();
  assert.deepEqual(h.writes,[]);
  assert.equal(h.owner.canCapture(selection),true,'an abandoned capture does not consume its useful slot');
  h.owner.dispose();
});

test('#1520 capture finishing after revision, viewport or authority changes cannot write',async ({mock})=>{
  mock.timers.enable({apis:['setTimeout']});
  for (const next of [{...selection,revision:'new-note'}, {...selection,size:[660,480]}, {...selection,authority:{}}]) {
    const h=harness(), rendering=defer();
    let signal;
    h.owner.capture(selection,abort=>{ signal=abort; return rendering.promise; },()=>true);
    mock.timers.tick(200); await flush();
    assert.equal(h.owner.facts.capture,'working');
    h.set(next);
    h.owner.publishedLive(); h.owner.observe(next);
    rendering.resolve(packet); await flush();
    assert.deepEqual(h.writes,[]);
    assert.equal(signal.aborted,true,'changed identity or dimensions retire the old capture immediately');
    h.owner.dispose();
  }
});

test('#1520 an image read from a retired navigation cannot set presentation facts',async()=>{
  const h=harness(), first=defer(), second=defer();
  let read=0;
  h.owner.store.read=()=> (++read===1?first:second).promise;
  assert.equal(h.owner.observe(selection),undefined);
  const b={...selection,floor:'B'};
  h.set(b); h.owner.observe(b);
  first.resolve({zoomHint:1,get image(){ assert.fail('retired image cannot reach the decoder'); }});
  await flush();
  assert.equal(h.owner.facts.status,'reading'); assert.deepEqual(h.paint,[]);
  h.owner.publishedLive();
  second.resolve({zoomHint:1,get image(){ assert.fail('optional bytes cannot reclaim a live frame'); }});
  await flush();
  assert.equal(h.owner.awaitsLive,false); assert.deepEqual(h.paint,[]);
  h.owner.dispose();
});
test('#1520 explicit A→B→A retirement fences work even if no intermediate view paints',async()=>{
  const h=harness(), old=defer(), current=defer();
  let read=0;
  h.owner.store.read=()=> (++read===1?old:current).promise;
  h.owner.observe(selection);
  h.set({...selection,floor:'B'}); h.owner.retire();
  h.set(selection); h.owner.retire(); h.owner.observe(selection);
  let reachedDecoder=false;
  old.resolve({zoomHint:1,get image(){ reachedDecoder=true; return new Blob(); }});
  await flush();
  assert.equal(reachedDecoder,false);
  assert.equal(h.owner.facts.status,'reading');
  h.owner.dispose(); current.resolve(null); await flush();
});

const portable = { ...selection, remote:{source:['c','l'],variant:'fit',projection:'iso',rotation:45} };

test('#1522 optional fit is no longer recalculated in steady View after one accepted write', async({mock})=>{
  mock.timers.enable({apis:['setTimeout']});
  const h=harness({publish:async()=>true});
  h.set(portable);
  h.owner.publishedLive();
  const wants=(source=portable.remote.source)=>h.owner.wantsPortable(portable.scope,portable.floor,'iso',45,source);
  assert.equal(wants(),true);
  h.owner.capture(portable,async()=>({...packet,geometry:{}}),()=>true);
  mock.timers.tick(200);await flush();
  assert.equal(h.owner.facts.remote,'stored');
  assert.equal(wants(),false);
  assert.equal(wants(['newer','layout']),true);
  h.owner.dispose();
});

test('#1545 an undecodable browser image falls back to the compatible server preview', async()=>{
  let calls=0;
  const h=harness({read:async()=>{calls++;return null;}});
  h.set(portable);
  h.owner.store.read=async()=>({
    size:portable.size, zoomHint:1, image:new Blob(['<?xml version="1.0"?>']),
  });
  h.owner.observe(portable);
  await flush();
  assert.equal(calls,1);
  assert.equal(h.owner.facts.status,'invalid');
  assert.equal(h.owner.facts.remote,'miss');
  h.owner.dispose();
});

test('#1545 live publication retains the same decoded image only for the current visual identity', async(t)=>{
  const originalImage = Object.getOwnPropertyDescriptor(globalThis,'Image');
  class DecodedImage {
    dataset = {};
    async decode() {}
    setAttribute() {}
  }
  Object.defineProperty(globalThis,'Image',{value:DecodedImage,configurable:true});
  t.after(()=>{
    if (originalImage) Object.defineProperty(globalThis,'Image',originalImage);
    else delete globalThis.Image;
  });
  const image = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {type:'image/svg+xml'});
  const h=harness({read:async()=>({...packet,image,size:portable.size})});
  t.after(()=>h.owner.dispose());
  h.set(portable);
  h.owner.observe(portable);
  await flush();
  const preview=h.owner.observe(portable);
  assert.ok(preview?.remote);
  h.owner.shown();
  h.owner.publishedLive(true);
  assert.equal(h.owner.awaitsLive,false);
  assert.strictEqual(h.owner.observe(portable).element,preview.element);
  const changed={...portable,revision:'updated'};
  h.set(changed);
  assert.equal(h.owner.observe(changed),undefined);
  assert.equal(h.owner.observe(portable),undefined);
  assert.equal(h.reads.length,1,'the fade cannot schedule another image read');
});

test('#1522 stale fit and accepted live View retire the same remote read owner', async()=>{
  for(const change of ['fit','live','authority']) {
    const first=defer();
    let reads=0, signal;
    const h=harness({
      read:async(_sel,abort)=>{ if(++reads===1){signal=abort;return first.promise;} return null; },
    });
    h.set(portable);h.owner.observe(portable);await flush();
    assert.equal(reads,1);
    if(change==='live') h.owner.publishedLive();
    else {
      const next={...portable,...(change==='fit'?{remote:{...portable.remote,variant:'bigger-badge'}}:{authority:{}})};
      h.set(next);h.owner.observe(next);
    }
    first.resolve({size:portable.size,zoomHint:1,get image(){assert.fail('old remote reply reached decode');}});
    await flush();
    assert.equal(signal.aborted,true);
    assert.deepEqual(h.paint,[]);
    h.owner.dispose();
  }
});
