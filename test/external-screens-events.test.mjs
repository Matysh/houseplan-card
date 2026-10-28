import test from 'node:test';
import assert from 'node:assert/strict';
import {subscribeExternalScreenConfig,ExternalConfigStreamRecovery} from '../test-build/external-screens-events.js';
import {externalScreenEventCandidate} from '../test-build/external-screens.js';

test('#1113 stream capability selects exactly one own config subscription; legacy remains generic',async()=>{
  const calls=[],frames=[];let receive;let removed=0;
  const connection={subscribeEvents:async(cb,event)=>{calls.push(['generic',event]);receive=cb;return()=>removed++;},
    subscribeMessage:async(cb,message)=>{calls.push(['own',message]);receive=cb;return()=>removed++;}};
  const stop=await subscribeExternalScreenConfig(connection,true,7,data=>frames.push(data));
  assert.deepEqual(calls,[['own',{type:'houseplan/external_screens/subscribe',base_rev:7}]]);
  receive({kind:'ready',rev:7});receive({rev:8});assert.deepEqual(frames,[{kind:'ready',rev:7},{rev:8}]);
  stop();stop();receive({rev:9});assert.equal(removed,1);assert.equal(frames.length,2);
  const legacy=await subscribeExternalScreenConfig(connection,false,7,data=>frames.push(data));
  assert.deepEqual(calls.at(-1),['generic','houseplan_config_updated']);receive({data:{rev:10}});assert.deepEqual(frames.at(-1),{rev:10});legacy();
});
test('#1113 revoked stream retires late subscribe completion exactly once',async()=>{
  let settle,receive,removed=0;const frames=[];
  const pending=subscribeExternalScreenConfig({subscribeEvents:async()=>{throw Error('generic forbidden');},
    subscribeMessage:(cb)=>{receive=cb;return new Promise(resolve=>{settle=resolve;});}},true,4,data=>frames.push(data));
  receive({kind:'closed'});receive({rev:5});settle(()=>removed++);const stop=await pending;stop();stop();
  assert.equal(removed,1);assert.deepEqual(frames,[{kind:'closed'}]);
});
test('#1113 no forbidden generic fallback when advertised own transport is unavailable',async()=>{
  let generic=0;await assert.rejects(subscribeExternalScreenConfig({subscribeEvents:async()=>{generic++;return()=>{};}},true,0,()=>{}),/unavailable/);
  assert.equal(generic,0);
});
test('#1113 initial stream revision never becomes a complete config candidate',()=>{
  const config={settings:{},spaces:[{id:'one'}]};
  for(const event of [{kind:'ready',rev:4},{kind:'resync',rev:9},{rev:10}])assert.equal(externalScreenEventCandidate(config,4,event),null);
});

test('#1113 runtime closure refreshes once and resumes only after an accepted full read/capability',()=>{
  const recovery=new ExternalConfigStreamRecovery();let retire=0,reads=0,subs=0,applied;
  const port={retire(){retire++;},refresh(done){reads++;applied=done;},canResume:()=>true,resume(){subs++;}};
  recovery.closed('runtime_changed',port);recovery.closed('runtime_changed',port);
  assert.equal(recovery.blocked,true);assert.deepEqual([retire,reads,subs],[1,1,0]);
  applied();applied();assert.equal(recovery.blocked,false);assert.equal(subs,1);
  recovery.closed('runtime_changed',port);const oldApplied=applied;recovery.reset();
  recovery.closed('runtime_changed',{...port,canResume:()=>false});oldApplied();applied();assert.equal(subs,1,'late read completion and missing capability stay inert');assert.equal(recovery.blocked,true);
});
test('#1113 auth closure is terminal on ordinary ticks until actual ready resets the owner',()=>{
  const recovery=new ExternalConfigStreamRecovery();let retire=0,reads=0,subs=0;
  const port={retire(){retire++;},refresh(){reads++;},canResume:()=>true,resume(){subs++;}};
  for(let tick=0;tick<10;tick++)recovery.closed('unauthorized',port);
  assert.equal(recovery.blocked,true);assert.deepEqual([retire,reads,subs],[1,0,0]);
  recovery.reset();assert.equal(recovery.blocked,false);
});
test('#1113 a late closed stream ACK cannot adopt into its retired owner epoch',async()=>{
  const recovery=new ExternalConfigStreamRecovery();let receive,resolve,epoch=1,removed=0,adopted=0;
  const claim=epoch;
  const pending=subscribeExternalScreenConfig({subscribeEvents:async()=>{throw Error('forbidden');},subscribeMessage:cb=>{receive=cb;return new Promise(r=>{resolve=r;});}},true,1,data=>{
    recovery.closed(data.reason,{retire(){epoch++;},refresh(){throw Error('auth cannot reload');},canResume:()=>true,resume(){}});
  });
  receive({kind:'closed',reason:'unauthorized'});resolve(()=>removed++);const remove=await pending;
  if(claim===epoch)adopted++;else remove();
  assert.equal(adopted,0);assert.equal(removed,1);assert.equal(recovery.blocked,true);
});
