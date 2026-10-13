import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogSession, forgetDialogBaseline, rememberDialogBaseline, restoreDialogBaseline } from '../test-build/editors/dialog-baseline.js';
import { requestDraftClose } from '../test-build/editors/draft-close.js';
import { EditorChainExit } from '../test-build/editor-chain-exit.js';

const request = { key: 'test', kind: 'warning', title: 'Discard?', message: 'Unsaved', confirmLabel: 'Discard', cancelLabel: 'Keep' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('#851 dialog ownership is replaced even when identical values are reopened or transferred warm', () => {
  const host = {};
  rememberDialogBaseline(host, 'room', 'same');
  const first = dialogSession(host, 'room');
  rememberDialogBaseline(host, 'room', 'same');
  assert.notEqual(dialogSession(host, 'room'), first);
  const warm = {};
  restoreDialogBaseline(warm, 'room', 'same');
  assert.notEqual(dialogSession(warm, 'room'), dialogSession(host, 'room'));
  forgetDialogBaseline(host, 'room');
  assert.equal(dialogSession(host, 'room'), undefined);
});

for (const kind of ['room', 'marker']) {
  test(`#851 ${kind}: pristine closes without question; Keep restores surface; discard closes once`, async () => {
    const host = {};
    rememberDialogBaseline(host, kind, 'initial');
    let closes = 0, questions = 0, restores = 0;
    const options = { host, kind, dirty: false, current: () => true, request,
      close: () => { closes++; }, surface: { rejectClose: () => { restores++; } },
      confirm: async () => { questions++; return false; } };
    assert.equal(await requestDraftClose(options), true);
    assert.equal(questions, 0);
    assert.equal(closes, 1);
    assert.equal(await requestDraftClose({ ...options, dirty: true }), false);
    assert.equal(restores, 1);
    assert.equal(closes, 1);
    assert.equal(await requestDraftClose({ ...options, dirty: true, confirm: async () => true }), true);
    assert.equal(closes, 2);
  });

  test(`#851 ${kind}: late answer A cannot close or refocus B (including reopening same target)`, async () => {
    const host = {}, answer = deferred();
    rememberDialogBaseline(host, kind, 'same');
    let closes = 0, restores = 0;
    const options = { host, kind, dirty: true, current: () => true, request,
      confirm: () => answer.promise, close: () => { closes++; }, surface: { rejectClose: () => { restores++; } } };
    const closing = requestDraftClose(options);
    rememberDialogBaseline(host, kind, 'same');
    answer.resolve(true);
    assert.equal(await closing, false);
    assert.equal(closes, 0);
    assert.equal(restores, 0);
  });
}

test('#851 draft close revalidates navigation/lifecycle after awaiting, without invoking any close', async () => {
  const host = {}, answer = deferred();
  rememberDialogBaseline(host, 'room', 'initial');
  let current = true, closes = 0;
  const closing = requestDraftClose({ host, kind: 'room', dirty: true, current: () => current,
    request, confirm: () => answer.promise, close: () => { closes++; } });
  current = false;
  answer.resolve(true);
  assert.equal(await closing, false);
  assert.equal(closes, 0);
});

test('#851 failed chain: Keep is inert; leave releases session then performs the requested transition', async () => {
  let answer = deferred(), cancels = 0;
  const events = [];
  const controller = new EditorChainExit(() => answer.promise, () => { cancels++; });
  const options = { request, current: () => true, leave: () => events.push('session'), navigate: () => events.push('destination') };
  controller.request(options);
  answer.resolve(false);
  await answer.promise; await Promise.resolve();
  assert.deepEqual(events, []);
  answer = deferred();
  controller.request(options);
  answer.resolve(true);
  await answer.promise; await Promise.resolve();
  assert.deepEqual(events, ['session', 'destination']);
  assert.equal(cancels, 0);
});

test('#851 failed chain: replaced intent, changed geometry and disconnected lifecycle reject stale answers', async () => {
  let answer = deferred(), cancels = 0, leaves = 0, current = true;
  const controller = new EditorChainExit(() => answer.promise, () => { cancels++; });
  const options = { request, current: () => current, leave: () => { leaves++; }, navigate: () => { leaves++; } };
  controller.request(options);
  controller.invalidate();
  answer.resolve(true);
  await answer.promise; await Promise.resolve();
  assert.equal(cancels, 1);
  assert.equal(leaves, 0);
  answer = deferred();
  controller.request(options);
  current = false;
  answer.resolve(true);
  await answer.promise; await Promise.resolve();
  assert.equal(leaves, 0);
});
