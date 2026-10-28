import test from 'node:test';
import assert from 'node:assert/strict';
import {subscribeExternalScreenConfig} from '../test-build/external-screens-events.js';
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
  assert.equal(removed,1);assert.deepEqual(frames,[]);
});
test('#1113 no forbidden generic fallback when advertised own transport is unavailable',async()=>{
  let generic=0;await assert.rejects(subscribeExternalScreenConfig({subscribeEvents:async()=>{generic++;return()=>{};}},true,0,()=>{}),/unavailable/);
  assert.equal(generic,0);
});
test('#1113 initial stream revision never becomes a complete config candidate',()=>{
  const config={settings:{},spaces:[{id:'one'}]};
  for(const event of [{kind:'ready',rev:4},{kind:'resync',rev:9},{rev:10}])assert.equal(externalScreenEventCandidate(config,4,event),null);
});
