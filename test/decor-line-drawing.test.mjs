import test from 'node:test';
import assert from 'node:assert/strict';
import { DecorLineDrawing, decorLineEnd } from '../test-build/editors/decor/line-drawing.js';

function fixture() {
  const state = { context: 'floor-a', authority: true, blocked: false, preview: null, commands: [] };
  const events = new EventTarget();
  const drawing = new DecorLineDrawing({
    context: () => state.context, blocked: () => state.blocked,
    current: () => () => state.authority,
    point: event => [event.clientX, event.clientY], pitch: () => 10,
    snap: raw => raw.map(n => Math.round(n / 10) * 10),
    preview: (a, b) => { state.preview = a ? { a, b } : null; },
    commit: (a, b, before, after) => state.commands.push({ a, b, before, after }),
    queue: run => run(), cancelQueue() {}, events,
  });
  const event = (x, y, id = 1) => ({ clientX: x, clientY: y, pointerId: id,
    button: 0, pointerType: 'mouse', shiftKey: false });
  const click = (x, y) => { const e = event(x, y); drawing.pointerDown(e); drawing.pointerUp(e); drawing.click(e, false); };
  return { state, drawing, event, click, events };
}

test('clicks accept independent segments; up, hover and short points cannot write', () => {
  const f = fixture();
  f.click(10, 10); f.drawing.pointerMove(f.event(40, 20));
  assert.equal(f.state.commands.length, 0); assert.deepEqual(f.state.preview.b, [40, 20]);
  f.click(10, 10); assert.equal(f.state.commands.length, 0);
  f.click(40, 20); f.click(80, 60);
  assert.deepEqual(f.state.commands.map(c => [c.a, c.b]), [[[10, 10], [40, 20]], [[40, 20], [80, 60]]]);
  assert.deepEqual(f.drawing.snapshot.anchor, [80, 60]); f.drawing.reset();
});

test('Shift retains exact rays across octants and rejects incompatible magnets', () => {
  for (const [raw, expected] of [ [[45, 12], [50, 10]], [[42, 35], [40, 40]],
    [[12, 45], [10, 50]], [[-25, 40], [-20, 40]], [[-40, -20], [-30, -30]],
    [[40, -30], [50, -30]], [[-40, 10], [-40, 10]], [[10, -40], [10, -40]] ]) {
    const end = decorLineEnd([10, 10], raw, 10, true, [raw[0] + 2, raw[1] + 1]);
    assert.deepEqual(end, expected);
  }
  assert.deepEqual(decorLineEnd([10, 10], [45, 35], 10, true, [45, 45]), [45, 45]);
  assert.deepEqual(decorLineEnd([10, 10], [45, 35], 10, false, [47, 36]), [47, 36]);
});

test('drag, second pointer, cancel, lost contact and synthetic clicks retain anchor without writes', () => {
  const f = fixture(); f.click(10, 10);
  const a = f.event(40, 20), b = f.event(50, 20, 2);
  f.drawing.pointerDown(a); f.drawing.pointerMove(f.event(55, 20));
  f.drawing.pointerUp(a); f.drawing.click(a, false);
  f.drawing.pointerDown(a); f.drawing.pointerDown(b);
  f.drawing.pointerUp(b); f.drawing.pointerUp(a); f.drawing.click(a, false);
  f.drawing.pointerDown(a); f.drawing.cancel(a); f.drawing.pointerUp(a); f.drawing.click(a, false);
  f.drawing.click(a, false);
  assert.equal(f.state.commands.length, 0); assert.deepEqual(f.drawing.snapshot.anchor, [10, 10]);
  f.click(40, 20); assert.equal(f.state.commands.length, 1); f.drawing.reset();
});

test('modifier without pointer movement updates preview; reset retires listeners and stale contact', () => {
  const f = fixture(); f.click(10, 10); f.drawing.pointerMove(f.event(42, 25));
  const shift = type => { const e = new Event(type); Object.assign(e, { key: 'Shift' }); f.events.dispatchEvent(e); };
  shift('keydown'); assert.deepEqual(f.state.preview.b, [30, 30]);
  shift('keyup'); assert.deepEqual(f.state.preview.b, [40, 30]);
  f.drawing.pointerDown(f.event(50, 20)); f.drawing.reset();
  f.drawing.pointerUp(f.event(50, 20)); f.drawing.click(f.event(50, 20), false);
  shift('keydown'); assert.equal(f.state.preview, null); assert.equal(f.state.commands.length, 0);
});

test('only the active session can restore its common-history cursor; foreign context retires it', () => {
  const f = fixture(); f.click(10, 10); f.click(40, 20);
  const { before, after } = f.state.commands[0], token = f.drawing.snapshot.token;
  f.drawing.reset(); f.drawing.restore(before, token); assert.deepEqual(f.drawing.snapshot.anchor, [10, 10]);
  f.drawing.reset(); f.drawing.restore(after, token); assert.deepEqual(f.drawing.snapshot.anchor, [40, 20]);
  f.drawing.reset(); f.drawing.restore(after, undefined); assert.equal(f.drawing.active, false);
  f.click(20, 20); f.state.context = 'floor-b'; f.drawing.sync();
  assert.equal(f.drawing.active, false); assert.equal(f.state.preview, null);
  f.state.blocked = true; f.click(50, 20); assert.equal(f.state.commands.length, 1);
});

test('authority loss and page interruption retire the chain and a delayed click', () => {
  const f=fixture();f.click(10,10);const e=f.event(40,20);
  f.drawing.pointerDown(e);f.state.authority=false;f.drawing.pointerUp(e);f.drawing.click(e,false);
  assert.equal(f.state.commands.length,0);assert.equal(f.drawing.active,false);
  f.state.authority=true;f.click(10,10);f.events.dispatchEvent(new Event('pagehide'));
  assert.equal(f.drawing.active,false);assert.equal(f.state.preview,null);
});

test('canvas-edge preview, stored endpoint and continuation agree through production snapping and commit', async () => {
  globalThis.window ??= { customCards: [] };
  const { HouseplanCard } = await import('../test-build/houseplan-card.js');
  const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');
  const { CommandStack } = await import('../test-build/command-stack.js');
  const { NORM_W, SANE_LIMIT, GRID_PITCH } = await import('../test-build/space-geometry.js');
  const height = Object.getOwnPropertyDescriptor(HouseplanCard.prototype, '_decorH');
  const list = Object.getOwnPropertyDescriptor(HouseplanCard.prototype, '_decorList');
  const limit = SANE_LIMIT, pitch = GRID_PITCH;
  const cases = [
    [[limit-3*pitch, limit-7*pitch], [limit+30*pitch, limit+20*pitch], true],
    [[-limit+3*pitch, -limit+7*pitch], [-limit-30*pitch, -limit-20*pitch], true],
    [[limit-7*pitch, -limit+3*pitch], [limit+20*pitch, -limit-30*pitch], true],
    [[-limit+7*pitch, limit-3*pitch], [-limit-20*pitch, limit+30*pitch], true],
    [[limit-3*pitch, 0], [limit+30*pitch, 0], false],
    [[0, -limit+3*pitch], [0, -limit-30*pitch], false],
  ];
  for (const [start, end, shift] of cases) {
    const space = { id:'floor', rooms:[], decor:[] };
    let saves = 0;
    const host = {
      _space:'floor', _serverCfg:{spaces:[space]}, _curSpaceCfg:space,
      _gridPitch:pitch, _stageEl:{clientWidth:1600,clientHeight:700},
      _viewOr:()=>({w:1600}), _baseVb:()=>[0,0,1600,700],
      _spaceModel:()=>({rooms:[]}), _cfgEpoch:0, _decorSnapCache:null,
      _decorStyle:{color:'#123456',opacity:1,widthCm:5,fill:false,fillColor:'#123456',fillOpacity:.25},
      _geometryHistory:new CommandStack(50), _pendingPhysicalWrites:new Map(),
      _saveConfigDebounced:()=>{saves++;}, _t:key=>key, requestUpdate(){},
    };
    Object.defineProperties(host, {_decorH:height, _decorList:list});
    assert.equal(host._decorH,NORM_W,'a non-square viewport still uses square Decor coordinates');
    const runtime = Object.create(HouseplanEditorRuntime.prototype); runtime.host = host;
    const drawing = new DecorLineDrawing({
      context:()=> 'floor', current:()=>()=>true, blocked:()=>false,
      point:e=>[e.clientX,e.clientY], snap:(p,type)=>runtime._decorSnap(p,type), pitch:()=>pitch,
      preview:(a,b)=>{host._decorDraft=a?{kind:'line',a:[...a],b:[...b],pid:-1}:null;},
      commit:(a,b,before,after)=>{
        host._decorDraft={kind:'line',a,b,pid:-1};runtime._decorCommitDraft({before,after});
      },
      queue:run=>run(),cancelQueue(){},events:new EventTarget(),
    });
    runtime.decorLine=drawing;
    const event = p=>({clientX:p[0],clientY:p[1],pointerId:1,button:0,pointerType:'mouse',shiftKey:shift});
    const click = p=>{const e=event(p);drawing.pointerDown(e);drawing.pointerUp(e);drawing.click(e,false);};
    click(start); drawing.pointerMove(event(end));
    const preview=structuredClone(host._decorDraft);
    click(end);
    assert.equal(space.decor.length,1);assert.equal(saves,1);assert.equal(host._geometryHistory.size,1);
    const shape=space.decor[0], persisted=[shape.x2*NORM_W,shape.y2*host._decorH];
    const close=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<1e-8);
    assert.ok(close(persisted,preview.b));assert.ok(close(drawing.snapshot.anchor,persisted));
    assert.ok(persisted.every(n=>Number.isFinite(n)&&Math.abs(n)<=limit+1e-8));
    if(shift) assert.ok(Math.abs(Math.abs(persisted[0]-preview.a[0])-Math.abs(persisted[1]-preview.a[1]))<1e-8);
    click(end);assert.equal(space.decor.length,1,'a repeat clipped to the same boundary is too short');
    assert.equal(saves,1);assert.equal(host._geometryHistory.size,1);
    drawing.reset();click([NaN,Infinity]);
    assert.equal(drawing.active,false,'a malformed screen coordinate cannot supply a clean click');
    assert.deepEqual(runtime._decorSnap([NaN,Infinity]),[0,0],'the production snap also bounds malformed render input');
    drawing.reset();click([2*limit,-2*limit]);
    assert.deepEqual(drawing.snapshot.anchor,[limit,-limit],'an off-canvas first click cannot seed an unbounded anchor');
    drawing.reset();
  }
});
