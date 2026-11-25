import assert from 'node:assert/strict';
import test from 'node:test';
import { StandaloneLayoutWrite } from '../test-build/standalone-layout-write.js';

const position = (x, k) => ({ x, y: .3, s: 'floor', ...(k === undefined ? {} : { k }) });
const tick = () => new Promise(resolve => setImmediate(resolve));
const reject = code => Object.assign(new Error(code), { code });
const ack = (pending, rev = 9) => {
  const {room_id, space_id, position} = pending.command.room_label;
  pending.resolve({ok:true,rev,room_label:{room_id,space_id,position}});
};
const fixture = ({recover} = {}) => {
  let epoch = {}, active = 0;
  const calls = [], base = {rl_a: position(.2)}, failures = [], states = [];
  const writer = new StandaloneLayoutWrite({
    guard() { const claim = epoch; return () => claim === epoch; },
    begin() { active++; let live=true; return () => { if(live){live=false;active--;} }; },
    base: key => base[key],
    send: command => new Promise((resolve,reject) => calls.push({command,resolve,reject})),
    accept: (key, value) => { base[key] = value; },
    recover: recover ?? (async () => true),
    reportFailure: error => { failures.push(error); },
  });
  writer.subscribeSaveState(s => states.push(s));
  return {writer,calls,base,failures,states,get active(){return active;},
    revoke(){epoch={};writer.retire();},dropConnection(){epoch={};}};
};
const stateOf = (writer, roomId) => writer.getSaveState().entries.find(entry => entry.roomId === roomId)?.status;

test('debounce state precedes dispatch and newer edits serialize on the accepted point', async () => {
  const f = fixture(), {writer,calls,base} = f;
  assert.equal(writer.stage('rl_a', position(.4)), true);
  assert.equal(stateOf(writer,'a'),'pending');
  assert.equal(calls.length,0);
  base.rl_a = position(.25); // A later read must not rebase this started gesture.
  writer.flush('rl_a');
  assert.deepEqual(calls[0].command.room_label.before,position(.2));
  writer.stage('rl_a',position(.5,1.4)); writer.flush('rl_a');
  assert.equal(calls.length,1);
  ack(calls[0]); await tick();
  assert.equal(stateOf(writer,'a'),'pending');
  assert.deepEqual(calls[1].command.room_label.before,position(.4));
  ack(calls[1],10); await tick();
  assert.equal(stateOf(writer,'a'),'accepted');
  assert.equal(f.active,0);
  // Once idle, a new gesture uses the latest authoritative server value.
  base.rl_a = position(.55,1.4);
  writer.stage('rl_a',position(.6,1.4)); writer.flush('rl_a');
  assert.deepEqual(calls[2].command.room_label.before,position(.55,1.4));
  ack(calls[2],11); await tick();
});

test('conflict is retained; recovery discards queued edits and a deliberate retry uses the server base', async () => {
  let finishRead;
  const f = fixture({recover: key => new Promise(resolve => { assert.equal(key,'rl_a'); finishRead = resolve; })});
  const {writer,calls,base} = f;
  writer.stage('rl_a',position(.4)); writer.flush('rl_a');
  writer.stage('rl_a',position(.5)); writer.flush('rl_a');
  calls[0].reject(reject('conflict')); await tick();
  assert.equal(stateOf(writer,'a'),'rejected');
  assert.equal(writer.canStage('rl_a'),false);
  assert.equal(writer.stage('rl_a',position(.6)),false);
  base.rl_a=position(.26); finishRead(true); await tick();
  assert.equal(writer.canStage('rl_a'),true);
  assert.equal(calls.length,1,'no automatic overwrite');
  writer.stage('rl_b',position(.31)); writer.flush('rl_b'); ack(calls[1]); await tick();
  assert.equal(writer.getSaveState().unresolved,true,'other accepted entry does not mask rejection');
  writer.stage('rl_a',position(.6)); writer.flush('rl_a');
  assert.deepEqual(calls[2].command.room_label.before,position(.26));
  ack(calls[2]); await tick();
  assert.equal(writer.getSaveState().pending,false);
  assert.equal(writer.getSaveState().unresolved,false);
});

test('unverified receipt and failed recovery do not permit another write', async () => {
  const {writer,calls,base} = fixture({recover:async()=>false});
  writer.stage('rl_a',position(.4)); writer.flush('rl_a');
  calls[0].resolve({ok:true,rev:8}); await tick();
  assert.equal(stateOf(writer,'a'),'unknown');
  assert.equal(writer.getSaveState().unresolved,true);
  assert.equal(writer.stage('rl_a',position(.5)),false);
  writer.flush('rl_a');
  assert.equal(calls.length,1);
  assert.deepEqual(base.rl_a,position(.2));
});

test('revocation neither dispatches a queued write nor accepts an old-project reply', async () => {
  const f = fixture(), {writer,calls,base,states} = f;
  writer.stage('rl_a',position(.4)); writer.flush('rl_a');
  writer.stage('rl_b',position(.5));
  f.revoke();
  writer.flush('rl_b'); ack(calls[0]); await tick();
  assert.equal(calls.length,1);
  assert.deepEqual(base.rl_a,position(.2));
  assert.equal(f.active,0);
  assert.equal(writer.getSaveState().unresolved,true);
  assert.equal(states.some(state => state.entries.some(entry => entry.status==='accepted')),false);
});

test('loss of authority before dispatch is observable even though the host has no requests', async () => {
  const f = fixture(), {writer,calls} = f;
  writer.stage('rl_a',position(.4));
  f.dropConnection();
  writer.flush('rl_a'); await tick();
  assert.equal(calls.length,0);
  assert.equal(stateOf(writer,'a'),'rejected');
  assert.equal(writer.getSaveState().unresolved,true);
});
