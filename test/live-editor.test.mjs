import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  commitHouseplanEditor,
  disposeHouseplanEditor,
  routeHouseplanEditorUpdate,
  whenHouseplanEditorSettled,
  physicalOpeningIds,
  measureHouseplanDecorText,
  scheduleHouseplanEditor,
} from '../test-build/live-editor.js';

test('#1080 a cancelled or detached frame cannot paint or consume a later action', () => {
  const beforeRaf = globalThis.requestAnimationFrame, beforeCancel = globalThis.cancelAnimationFrame;
  const callbacks = new Map(); let next = 1;
  globalThis.requestAnimationFrame = callback => { const id = next++; callbacks.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = () => {};
  const host = { isConnected: true, renderRoot: { querySelector: () => null, querySelectorAll: () => [] } };
  try {
    scheduleHouseplanEditor(host); const cancelled = callbacks.get(next - 1);
    commitHouseplanEditor(host);
    scheduleHouseplanEditor(host);
    const waiting = whenHouseplanEditorSettled(host);
    let finished = false; waiting.then(() => { finished = true; });
    host.renderRoot.querySelector = () => { throw new Error('retired frame queried the current scene'); };
    cancelled();
    assert.equal(finished, false);
    disposeHouseplanEditor(host);
    const detached = callbacks.get(next - 1);
    scheduleHouseplanEditor(host);
    detached();
  } finally { disposeHouseplanEditor(host); globalThis.requestAnimationFrame = beforeRaf; globalThis.cancelAnimationFrame = beforeCancel; }
});

test('#1047 text measurement follows Properties while a drawing tool keeps native handles inactive',()=>{
  let selectedTextId='new',queries=[],updates=0;
  const host={_dtSel:null,_dtBox:null,_editorRuntime:{properties:{get selectedTextId(){return selectedTextId;}}},
    requestUpdate(){updates++;},renderRoot:{querySelector(selector){queries.push(selector);return {getBBox:()=>({x:10,y:20,width:60,height:15})};}}};
  measureHouseplanDecorText(host);
  assert.deepEqual(host._dtBox,{id:'new',x:10,y:20,w:60,h:15});assert.equal(updates,1);
  assert.deepEqual(queries,['text.dtext[data-id="new"]']);
  selectedTextId=null;measureHouseplanDecorText(host);
  assert.equal(host._dtBox,null);assert.equal(updates,2);
});

test('#861 physical opening projection is exact-host only and shared by live paint/suppression', () => {
  const openings = [
    { id: 'door', host: { kind: 'partition', id: 'moved' } },
    { id: 'window', host: { kind: 'partition', id: 'moved' } },
    { id: 'other', host: { kind: 'partition', id: 'other' } },
    { id: 'wall', host: { kind: 'wall', id: 'moved' } },
    { id: 'orphan', host: { kind: 'partition', id: 'moved' }, orphanReason: 'missing' },
  ];
  const drag = { kind: 'partition', id: 'moved', moved: true };
  assert.deepEqual(physicalOpeningIds(drag, openings), ['door', 'window']);
  for (const inactive of [null, undefined, { ...drag, moved: false }, { ...drag, kind: 'column' }])
    assert.deepEqual(physicalOpeningIds(inactive, openings), []);
});
import {
  cancelHouseplanPointerMove,
  flushHouseplanPointerMove,
  queueHouseplanPointerMove,
} from '../test-build/pointer-move-queue.js';

test('cancelled device frame restores imperative DOM coordinates after its drag owner is gone', () => {
  const element = { dataset: { id: 'moved' }, style: { left: '-10%', top: '70%' } };
  const host = {
    isConnected: true,
    _deviceDrag: null, _devices: [{ id: 'moved' }],
    _livePos: () => ({ x: 150, y: 200 }), _baseVb: () => [0, 0, 1000, 1000],
    _viewOr: () => ({ x: -50, y: 0, w: 1000, h: 1000 }),
    renderRoot: { querySelectorAll: () => [element], querySelector: () => null },
  };
  try {
    commitHouseplanEditor(host, 'moved');
    assert.deepEqual(element.style, { left: '20%', top: '20%' });
  } finally { disposeHouseplanEditor(host); }
});

test('detached rollback paints only the restored marker without reviving disposed live rendering', async () => {
  const element = { dataset: { id: 'moved' }, style: { left: '-10%', top: '70%' } };
  const host = {
    isConnected: false, _deviceDrag: null, _devices: [{ id: 'moved' }],
    _livePos: () => ({ x: 150, y: 200 }), _baseVb: () => [0, 0, 1000, 1000],
    _viewOr: () => ({ x: -50, y: 0, w: 1000, h: 1000 }),
    renderRoot: { querySelectorAll: () => [element],
      querySelector: () => { throw new Error('disposed live renderer must not be queried'); } },
  };
  disposeHouseplanEditor(host);
  commitHouseplanEditor(host, 'moved');
  assert.deepEqual(element.style, { left: '20%', top: '20%' });
  await whenHouseplanEditorSettled(host);
});

test('owned physical gesture routes its unnamed live updates, not other reactive changes', () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 17;
  globalThis.cancelAnimationFrame = () => {};
  const host = {
    isConnected: true,
    _mode: 'plan',
    _editorRuntime: { physicalGesture: { active: true } },
  };
  try {
    assert.equal(routeHouseplanEditorUpdate(host), true);
    assert.equal(routeHouseplanEditorUpdate(host, '_physicalSel', null), false);
    host._editorRuntime.physicalGesture.active = false;
    assert.equal(routeHouseplanEditorUpdate(host), false);
    assert.equal(routeHouseplanEditorUpdate(host, '_toast', ''), false);
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('pointer-following editor hover routes while View remains reactive', () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 21;
  globalThis.cancelAnimationFrame = () => {};
  const host = { isConnected: true, _mode: 'plan', _cursorPt: [1, 2] };
  try {
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', null), true);
    const previous = host._cursorPt;
    host._cursorPt = null;
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', previous), false);
    host._cursorPt = [1, 2];
    host._mode = 'view';
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [1, 2]), false);
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('#917 gesture entry stays reactive before subsequent moves use one live frame', () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let nextFrame = 1;
  globalThis.requestAnimationFrame = callback => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  try {
    for (const property of ['_decorDraft', '_dtDrag']) {
      for (const previous of [null, undefined]) {
        const host = { isConnected: true, _mode: 'plan', [property]: {} };
        try {
          assert.equal(routeHouseplanEditorUpdate(host, property, previous), false,
            `${property}: pointerdown must reconcile selection/chrome through Lit`);
          assert.equal(frames.size, 0, 'gesture entry cannot schedule a live-only frame');
          const started = host[property];
          host[property] = {};
          assert.equal(routeHouseplanEditorUpdate(host, property, started), true);
          assert.equal(routeHouseplanEditorUpdate(host, property, started), true);
          assert.equal(frames.size, 1, 'subsequent moves share one pending live frame');
          commitHouseplanEditor(host);
          assert.equal(frames.size, 0);
          const moving = host[property];
          host[property] = null;
          assert.equal(routeHouseplanEditorUpdate(host, property, moving), false,
            'terminal state must reconcile through Lit too');
          assert.equal(frames.size, 0);
        } finally { disposeHouseplanEditor(host); }
      }
    }
  } finally {
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('pointer move queue is event-turn coalesced, last-wins and flushable', async () => {
  const host = {};
  const seen = [];
  try {
    queueHouseplanPointerMove(host, 'drag', () => seen.push(1));
    queueHouseplanPointerMove(host, 'drag', () => seen.push(2));
    assert.deepEqual(seen, []);
    await Promise.resolve();
    assert.deepEqual(seen, [2]);

    queueHouseplanPointerMove(host, 'drag', () => seen.push(3));
    flushHouseplanPointerMove(host, 'drag');
    assert.deepEqual(seen, [2, 3]);
    await Promise.resolve();
    assert.deepEqual(seen, [2, 3]);

    queueHouseplanPointerMove(host, 'drag', () => seen.push(4));
    cancelHouseplanPointerMove(host, 'drag');
    await Promise.resolve();
    assert.deepEqual(seen, [2, 3]);
  } finally {
    disposeHouseplanEditor(host);
  }
});

test('live editor settlement waits for paint and releases on commit or dispose', async () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let nextFrame = 1;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const root = { querySelector: () => null, querySelectorAll: () => [] };
  const host = { isConnected: true, _mode: 'plan', renderRoot: root, _cursorPt: [0, 0] };
  const runFrame = () => {
    const [id, callback] = frames.entries().next().value || [];
    assert.ok(id, 'a live frame is scheduled');
    frames.delete(id);
    callback(0);
  };
  try {
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', null), true);
    const first = whenHouseplanEditorSettled(host);
    let firstDone = false;
    void first.then(() => { firstDone = true; });
    await Promise.resolve();
    assert.equal(firstDone, false, 'settlement cannot run ahead of the live paint');
    runFrame();
    await first;
    assert.equal(firstDone, true);

    const previousCursor = host._cursorPt;
    host._cursorPt = null;
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', previousCursor), false,
      'terminal hover null must reconcile the settled layer through Lit');
    assert.equal(frames.size, 0, 'terminal hover null does not leave a live frame');

    host._cursorPt = [1, 2];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [1, 2]), true);
    host._cursorPt = [2, 3];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [2, 3]), true);
    assert.equal(frames.size, 1, 'coalesced updates own one frame');
    const coalesced = whenHouseplanEditorSettled(host);
    runFrame();
    await coalesced;

    host._cursorPt = [3, 4];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [2, 3]), true);
    const committed = whenHouseplanEditorSettled(host);
    commitHouseplanEditor(host);
    await committed;
    assert.equal(frames.size, 0, 'a complete Lit commit cancels its superseded live frame');

    host._cursorPt = [4, 5];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [3, 4]), true);
    const disposed = whenHouseplanEditorSettled(host);
    disposeHouseplanEditor(host);
    await disposed;
    assert.equal(frames.size, 0, 'dispose leaves no frame or waiter behind');
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('live editor browser smokes use the explicit settlement contract', () => {
  for (const name of ['smoke_furniture.mjs', 'smoke_decor.mjs', 'smoke_decor_text.mjs']) {
    const source = readFileSync(new URL(`../demo/${name}`, import.meta.url), 'utf8');
    const helper = source.match(/const settleLive = ([^;]+);/)?.[0] || '';
    assert.match(helper, /_whenLiveEditorSettled\(\)/, `${name}: explicit contract`);
    assert.doesNotMatch(helper, /requestAnimationFrame|setTimeout|sleep|Promise\.resolve/,
      `${name}: no timing heuristic`);
  }
});

test('#1098 stair and LED move requests coalesce into the existing live frame',()=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;let scheduled=0;
 globalThis.requestAnimationFrame=()=>++scheduled;globalThis.cancelAnimationFrame=()=>{};
 try{
  for(const [mode,runtime,led] of [['plan',{stairs:{live:true}},null],['devices',{}, {dragging:true}]]){
   const host={isConnected:true,_mode:mode,_editorRuntime:runtime,_ledEditor:led};const before=scheduled;
   for(let i=0;i<30;i++)assert.equal(routeHouseplanEditorUpdate(host),true);
   assert.equal(scheduled-before,1);disposeHouseplanEditor(host);
  }
 }finally{globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel;}
});
import {LiveRuntime} from '../test-build/live-interaction-runtime.js';
test('#1098 HA deferral recognizes both gesture owners until their terminal event',()=>{
 const host={_pointers:{size:0},_cameraTransition:{active:false},_editorRuntime:{stairs:{dragging:false}}};
 const runtime=new LiveRuntime(host);assert.equal(runtime.active(),false);
 host._editorRuntime.stairs.dragging=true;assert.equal(runtime.active(),true);
 host._editorRuntime.stairs.dragging=false;host._ledEditor={dragging:true};assert.equal(runtime.active(),true);
 host._ledEditor.dragging=false;assert.equal(runtime.active(),false);
});