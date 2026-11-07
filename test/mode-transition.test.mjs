import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModeTransitionController,
  modeStageHeight, modeRasterExposureClip, modeRasterOriginBias,
  interpolateModeVisualState,
  viewBoxFromViewport,
  viewportFromViewBox,
} from '../test-build/mode-transition.js';

const endpoint = (mode, chrome, stageHeight, viewBox, opacity = mode === 'view' ? 0 : 1) => ({
  presentedMode: mode,
  headerHeight: 55,
  headerBudget: 55 + chrome,
  editorChromeHeight: chrome,
  stageWidth: 800,
  stageHeight,
  viewport: viewportFromViewBox(viewBox, 800),
  stageColor: mode === 'view' ? 'rgb(20, 30, 40)' : 'rgb(255, 255, 255)',
  paperColor: mode === 'view' ? '#202830' : '#ffffff',
  sceneBrightness: mode === 'view' ? 0.9 : 1,
  architectureOpacity: mode === 'decor' ? 0.35 : 1,
  backdropOpacity: mode === 'decor' ? 0.5 : 1,
  viewWeight: mode === 'view' ? 1 : 0,
  editorWeight: mode === 'view' ? 0 : 1,
  toolbarContentOpacity: opacity,
});

test('camera round-trip preserves center and uses the current stage aspect', () => {
  const view = { x: 10, y: 20, w: 400, h: 300 };
  const viewport = viewportFromViewBox(view, 800);
  const roundTrip = viewBoxFromViewport(viewport, 800, 600);
  assert.deepEqual(roundTrip, view);
  const narrow = viewBoxFromViewport(viewport, 400, 600);
  assert.equal(narrow.x + narrow.w / 2, viewport.centerX);
  assert.equal(narrow.y + narrow.h / 2, viewport.centerY);
  assert.equal(narrow.w / narrow.h, 400 / 600);
});

test('one interpolation owns chrome, stage, camera, colors and content fade', () => {
  const from = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const to = endpoint('plan', 120, 480, { x: 100, y: 80, w: 600, h: 360 });
  const mid = interpolateModeVisualState(from, to, 0.5);
  assert.ok(mid.editorChromeHeight > 0 && mid.editorChromeHeight < 120);
  assert.ok(mid.editorChromeHeight > 108,
    'the shared timeline follows cubic-bezier(0.2, 0.7, 0.2, 1), not a generic easing');
  assert.ok(mid.stageHeight > 480 && mid.stageHeight < 600);
  assert.equal(mid.viewport.viewBox.w / mid.viewport.viewBox.h, mid.stageWidth / mid.stageHeight);
  assert.ok(mid.sceneBrightness > 0.9 && mid.sceneBrightness < 1);
  assert.ok(mid.toolbarContentOpacity > 0 && mid.toolbarContentOpacity < 1);
  assert.match(mid.stageColor, /^rgba\(/);
});

test('one-row View and two-row editor keep one total height through the shared timeline', () => {
  const from = endpoint('view', 0, 745, { x: 100, y: 40, w: 600, h: 558.75 });
  const to = { ...endpoint('decor', 120, 579, { x: 130, y: 70, w: 500, h: 361.875 }), headerHeight: 101, headerBudget: 221 };
  for (const progress of [0, .01, .1, .5, .9, .99, 1]) {
    const value = interpolateModeVisualState(from, to, progress);
    assert.ok(Math.abs(value.headerHeight + value.editorChromeHeight + value.stageHeight - 800) < 1e-9);
    assert.ok(Math.abs(value.headerBudget + value.stageHeight - 800) < 1e-9);
    assert.ok(Math.abs(value.viewport.viewBox.w / value.viewport.viewBox.h - value.stageWidth / value.stageHeight) < 1e-12);
  }
  assert.equal(interpolateModeVisualState(from, to, 1).headerHeight, 101);
});

test('fractional native toolbar height preserves the settled client-height camera basis', () => {
  const view = { stageHeight: 836, headerHeight: 55, editorChromeHeight: 0 };
  const editor = { stageHeight: modeStageHeight(view, 101, 212.3125), headerHeight: 101, editorChromeHeight: 212.3125 };
  assert.equal(editor.stageHeight, 578);
  assert.equal(modeStageHeight(editor, 55), view.stageHeight);
  assert.equal(modeStageHeight(view, 101, 10000), 1);
});

test('controller is deterministic, settles exactly and leaves no scheduled frame', () => {
  let now = 0;
  let sequence = 0;
  const callbacks = new Map();
  const clock = {
    now: () => now,
    requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
    cancelFrame: (handle) => callbacks.delete(handle),
  };
  const frames = [];
  let settled = null;
  const controller = new ModeTransitionController({
    frame: (state) => frames.push(state.presented),
    settled: (state) => { settled = state.presented; },
  }, clock);
  const from = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const to = endpoint('devices', 96, 504, { x: 50, y: 30, w: 700, h: 441 });
  controller.start(from, to, 'devices', 100);
  assert.equal(controller.active, true);
  const step = (time) => {
    now = time;
    const [id, callback] = callbacks.entries().next().value;
    callbacks.delete(id);
    callback(time);
  };
  step(50);
  assert.ok(controller.presented.stageHeight > 504 && controller.presented.stageHeight < 600);
  step(100);
  assert.deepEqual(controller.presented, to);
  assert.equal(settled, null, 'the terminal frame owns a complete presentation opportunity');
  assert.equal(controller.active, true);
  assert.equal(callbacks.size, 1);
  step(116);
  assert.equal(settled, null, 'first RAF retains to while the compositor presents it');
  assert.equal(controller.active, true);
  assert.equal(callbacks.size, 1);
  step(132);
  assert.deepEqual(settled, to);
  assert.equal(controller.active, false);
  assert.equal(callbacks.size, 0);
  assert.ok(frames.length >= 3);
});

test('zero-duration and interrupted transitions commit one exact target', () => {
  let sequence = 0;
  const callbacks = new Map();
  const clock = {
    now: () => 0,
    requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
    cancelFrame: (handle) => callbacks.delete(handle),
  };
  const settled = [];
  const controller = new ModeTransitionController({
    frame: () => {},
    settled: (state) => settled.push(state.presented),
  }, clock);
  const view = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const plan = endpoint('plan', 120, 480, { x: 40, y: 30, w: 720, h: 432 });

  controller.start(view, plan, 'plan', 0);
  assert.deepEqual(settled.pop(), plan);
  assert.equal(callbacks.size, 0);

  controller.start(view, plan, 'plan', 220);
  controller.cancel(true);
  assert.deepEqual(settled.pop(), plan);
  assert.equal(controller.active, false);
  assert.equal(callbacks.size, 0);
});

test('retarget starts from the actually presented frame and invalidates old RAF', () => {
  let now = 0;
  let sequence = 0;
  const callbacks = new Map();
  const clock = {
    now: () => now,
    requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
    cancelFrame: (handle) => callbacks.delete(handle),
  };
  const frames = [];
  const controller = new ModeTransitionController({
    frame: (state) => frames.push(state.presented),
    settled: () => {},
  }, clock);
  const view = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const plan = endpoint('plan', 120, 480, { x: 40, y: 30, w: 720, h: 432 });
  const decor = endpoint('decor', 160, 440, { x: 80, y: 50, w: 640, h: 352 });

  controller.start(view, plan, 'plan', 100);
  now = 40;
  const [oldHandle, oldFrame] = callbacks.entries().next().value;
  callbacks.delete(oldHandle);
  oldFrame(now);
  const presented = controller.presented;
  controller.start(presented, decor, 'decor', 100);

  assert.deepEqual(frames.at(-1), presented);
  assert.equal(callbacks.size, 1, 'the previous generation cannot retain a scheduled frame');
});

test('#1344 terminal-frame retarget/cancel/dispose cannot deliver an old finish', () => {
  let now = 0, sequence = 0;
  const callbacks = new Map(), settled = [];
  const clock = { now: () => now,
    requestFrame: cb => { callbacks.set(++sequence, cb); return sequence; },
    cancelFrame: id => callbacks.delete(id) };
  const controller = new ModeTransitionController({ frame: () => {}, settled: s => settled.push(s.targetMode) }, clock);
  const view = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const plan = endpoint('plan', 120, 480, { x: 40, y: 30, w: 720, h: 432 });
  const step = time => { now = time; const [id, cb] = callbacks.entries().next().value; callbacks.delete(id); cb(time); };
  controller.start(view, plan, 'plan', 100);
  step(100);
  assert.deepEqual(controller.presented, plan);
  assert.equal(controller.active, true);
  assert.deepEqual(settled, []);
  const staleFinish = callbacks.values().next().value;
  controller.start(plan, view, 'view', 100);
  staleFinish(101);
  assert.deepEqual(settled, []);
  assert.equal(callbacks.size, 1);
  step(200);
  controller.cancel(true);
  assert.deepEqual(settled, ['view']);
  assert.equal(callbacks.size, 0);
  controller.start(view, plan, 'plan', 100);
  step(300);
  const disposedFinish = callbacks.values().next().value;
  controller.dispose();
  disposedFinish(301);
  assert.deepEqual(settled, ['view']);
  assert.equal(controller.active, false);
  assert.equal(callbacks.size, 0);
});

test('#1344 fixed raster exposure covers a wider endpoint without unbounded promotion', () => {
  const clip=modeRasterExposureClip({stageWidth:540,stageHeight:600},{stageWidth:900,stageHeight:700});
  const [y,x]=clip.match(/-([\d.]+)%/g).map(Number.parseFloat).map(Math.abs);
  assert.equal(y,8.5);
  assert.equal((1+y/50)*600,702, 'exact taller endpoint plus two raster pixels');
  assert.ok(x>33.333&&x<34);
});

test('#1344 atomic completion releases busy before terminal layout measurement', () => {
  const from=endpoint('view',0,600,{x:0,y:0,w:800,h:600});
  const to=endpoint('plan',120,480,{x:0,y:0,w:800,h:480});
  let completed=0;
  const controller=new ModeTransitionController({
    frame:state=>assert.equal(state.presented,to),
    settled:state=>{completed++;assert.equal(controller.active,false);assert.equal(state.targetMode,'plan');},
  },{now:()=>0,requestFrame:()=>{throw Error('atomic transition scheduled a frame');},cancelFrame:()=>{}});
  controller.start(from,to,'plan',0);
  assert.equal(completed,1);
});

test('#1344 target height rounds the fixed chrome once instead of subtracting rounded totals', () => {
  const from={stageHeight:743,headerHeight:55.8,editorChromeHeight:0,headerBudget:57,headerFixedBudget:1.4};
  assert.equal(modeStageHeight(from,71.2),727);
});

test('#1344 Devices retains live glow while Plan and Decor fade it', () => {
  const view = {...endpoint('view',0,600,{x:0,y:0,w:800,h:600}),glowWeight:1};
  const devices = {...endpoint('devices',100,500,{x:0,y:0,w:800,h:500}),glowWeight:1};
  const plan = {...devices,presentedMode:'plan',glowWeight:0};
  for (const p of [0,.25,.5,.75,1]) assert.equal(interpolateModeVisualState(view,devices,p).glowWeight,1);
  assert.equal(interpolateModeVisualState(plan,devices,0).glowWeight,0);
  assert.equal(interpolateModeVisualState(plan,devices,1).glowWeight,1);
  assert.ok(interpolateModeVisualState(plan,devices,.5).glowWeight>0);
});

test('#1344 smaller target keeps only the one-pixel raster rounding reserve',()=>{
 const clip=modeRasterExposureClip({stageWidth:1000,stageHeight:800},{stageWidth:700,stageHeight:400});
 assert.equal(clip,'inset(-0.125% -0.1%)');
});

test('#1344 finish after the presentation opportunity still belongs to the cancelled token', () => {
 let now=0,sequence=0;const callbacks=new Map(),settled=[];
 const clock={now:()=>now,requestFrame:cb=>{callbacks.set(++sequence,cb);return sequence;},cancelFrame:id=>callbacks.delete(id)};
 const c=new ModeTransitionController({frame:()=>{},settled:s=>settled.push(s.targetMode)},clock);
 const view=endpoint('view',0,600,{x:0,y:0,w:800,h:600}),plan=endpoint('plan',120,480,{x:0,y:0,w:800,h:480});
 const step=t=>{now=t;const[id,cb]=callbacks.entries().next().value;callbacks.delete(id);cb(t);};
 c.start(view,plan,'plan',100);step(100);step(116);
 const stale=callbacks.values().next().value;assert.equal(callbacks.size,1);
 c.start(plan,view,'view',100);stale(132);assert.deepEqual(settled,[]);assert.equal(callbacks.size,1);
 c.cancel(true);assert.deepEqual(settled,['view']);assert.equal(callbacks.size,0);
 c.start(view,plan,'plan',100);step(216);step(232);const disposed=callbacks.values().next().value;
 c.dispose();disposed(248);assert.deepEqual(settled,['view']);assert.equal(c.active,false);assert.equal(callbacks.size,0);
});

test('#1344 target-snapped raster preserves the physical centre through odd and even heights',()=>{
 for(const from of [{stageWidth:800,stageHeight:673},{stageWidth:1280,stageHeight:700}])
 for(const to of [{stageWidth:920,stageHeight:458},{stageWidth:800,stageHeight:674}]){
  const bias=modeRasterOriginBias(from,to),ppu=.742,centre=[450,530],point=[550,570];
  for(const p of [0,.1,.5,.9,1])for(const [axis,key]of[[0,'stageWidth'],[1,'stageHeight']]){
   const size=from[key]+(to[key]-from[key])*p,origin=(size-from[key])/2-bias[axis];
   const anchor=centre[axis]-bias[axis]/ppu;
   const actual=(point[axis]-anchor)*ppu+from[key]/2+origin;
   assert.ok(Math.abs(actual-((point[axis]-centre[axis])*ppu+size/2))<1e-9);
   if(p===1)assert.equal(origin,Math.round(origin));
  }
 }
});
test('#1344 unchanged physical scale is exact rather than an exp/log near-identity',()=>{
 const from=endpoint('view',0,673,{x:0,y:0,w:800,h:673});from.viewport.pixelsPerUnit=.742;
 const to={...from,presentedMode:'devices',viewport:{...from.viewport}};
 for(const p of [0,.1,.5,.9,1])assert.equal(interpolateModeVisualState(from,to,p).viewport.pixelsPerUnit,.742);
});

test('#1344 trace joins presentation by trace_id, keeps missing frames explicit and deduplicates merged presents', async t => {
  const fs = await import('node:fs'), path = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'houseplan-mode-trace-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const events = [];
  for (const [id, sequence, begin] of [['A',10,1000],['B',11,4000],['missing',12,8000],['C',13,12000]]) {
    events.push({name:'AnimationFrame',ph:'b',pid:7,tid:8,id2:{local:'track'},ts:begin,
      args:{id,animation_frame_timing_info:{begin_frame_id:{source_id:1,sequence_number:sequence}}}},
      {name:'AnimationFrame',ph:'e',pid:7,tid:8,id2:{local:'track'},ts:begin+2000,args:{}});
  }
  for (const [id, sequence, ts] of [['A',100,10000],['B',101,20000],['C',101,20000],['decoy',10,7000],['missing',0,17000]])
    events.push({name:'AnimationFrame::Presentation',ph:'n',pid:7,tid:8,ts,
      args:{id,begin_frame_id:{source_id:sequence?1:0,sequence_number:sequence}}});
  events.push({name:'hp-mode:large:0:view-plan:start',ts:0},
    {name:'hp-mode:large:0:view-plan:interactive',ts:25000},
    {name:'UpdateLayoutTree',ph:'X',pid:7,tid:8,ts:1200,dur:100},
    {name:'Layout',ph:'X',pid:7,tid:8,ts:1600,dur:1000},
    {name:'Layout',ph:'X',pid:9,tid:10,ts:1600,dur:999999},
    {name:'Paint',ph:'X',pid:7,tid:8,ts:1800,dur:200,args:{data:{nodeName:'SVG proof'}}},
    {name:'Paint',ph:'X',pid:9,tid:10,ts:1800,dur:200,args:{data:{nodeName:'other renderer'}}});
  fs.writeFileSync(path.join(dir,'sample-large-trace.json'),JSON.stringify({traceEvents:events}));
  fs.writeFileSync(path.join(dir,'sample.json'),JSON.stringify({rows:[{fixture:'large',sample:0,from:'view',to:'plan',rafSamples:4,
    frames:[1.5,4.5,8.5,12.5].map((controllerTime,index)=>({controllerTime,phase:index===3?'settling':'running'}))}]}));
  const script=fileURLToPath(new URL('../docs/testing/issue1344/analyze-presented.mjs',import.meta.url));
  const run=spawnSync(process.execPath,[script,dir,'sample'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const [row]=JSON.parse(fs.readFileSync(path.join(dir,'sample-presented-analysis.json'),'utf8')).rows;
  assert.equal(row.presentedChangedFrames,2);
  assert.equal(row.unmatched,0);
  assert.equal(row.notPresented,1);
  assert.equal(row.maxPresentedGapMs,10);
  assert.equal(row.firstPresentedMs,10);
  assert.equal(row.interactiveMinusToPresentationMs,5);
  assert.equal(row.terminalFrame.traceId,'C');
  assert.equal(row.maxStyleLayoutMs,1.1);
  assert.equal(row.startup.synchronousStyleLayoutBeforePaintMs,.1);
  assert.equal(row.startup.styleLayoutAfterPaintInFirstOpportunityMs,1);
  assert.equal(row.runningPaintEvents,1);
  assert.deepEqual(row.runningPaintNodes,['SVG proof']);
});

test('preparation does not consume the 220ms motion interval', () => {
  let now=24, sequence=0;const pending=new Map(),shown=[];
  const c=new ModeTransitionController({frame:s=>shown.push(s.presented),settled:()=>{}},
    {now:()=>now,requestFrame:cb=>{pending.set(++sequence,cb);return sequence},cancelFrame:id=>pending.delete(id)});
  const from=endpoint('view',0,600,{x:0,y:0,w:800,h:600});
  const to=endpoint('plan',96,504,{x:0,y:48,w:800,h:504});
  c.start(from,to,'plan',220);
  assert.equal(shown[0],from,'the unchanged preparation frame is never counted as motion');
  assert.equal(c.state.startedAt,24);
  const [id,tick]=pending.entries().next().value;pending.delete(id);now=40;tick(now);
  assert.deepEqual(shown[1],interpolateModeVisualState(from,to,16/220));
  assert.equal(pending.size,1);
  c.cancel(false);assert.equal(pending.size,0);
});

test('#1344 a late to callback retains two complete observed intervals, with one cancellable owner',()=>{
 let now=0,seq=0;const pending=new Map(),completed=[];
 const clock={now:()=>now,requestFrame:cb=>{pending.set(++seq,cb);return seq},cancelFrame:id=>pending.delete(id)};
 const c=new ModeTransitionController({frame:()=>{},settled:s=>completed.push(s.targetMode)},clock);
 const from=endpoint('view',0,600,{x:0,y:0,w:800,h:600}),to=endpoint('plan',96,504,{x:0,y:48,w:800,h:504});
 const tick=(time,wall=time)=>{now=wall;assert.equal(pending.size,1);const[id,cb]=pending.entries().next().value;pending.delete(id);cb(time);};
 c.start(from,to,'plan',220);tick(16);tick(204);tick(220,234);
 assert.equal(c.state.phase,'settling');tick(236,238);tick(252,254);
 assert.equal(c.active,true,'second callback had only 20ms since a late paint');
 assert.deepEqual(completed,[]);assert.equal(pending.size,1);
 const stale=pending.values().next().value;c.cancel(false);stale(268);
 assert.equal(pending.size,0);assert.deepEqual(completed,[]);
 now=300;c.start(from,to,'plan',220);tick(316);tick(504);tick(520,534);tick(536,538);tick(552,554);tick(568,570);
 assert.equal(c.active,false);assert.equal(pending.size,0);assert.deepEqual(completed,['plan']);
});

test('#1344 the partial first RAF after start is not a display interval',()=>{
 let now=10,seq=0,finished=0;const pending=new Map();
 const c=new ModeTransitionController({frame:()=>{},settled:()=>finished++},
 {now:()=>now,requestFrame:cb=>{pending.set(++seq,cb);return seq},cancelFrame:id=>pending.delete(id)});
 const from=endpoint('view',0,600,{x:0,y:0,w:800,h:600}),to=endpoint('plan',96,504,{x:0,y:48,w:800,h:504});
 const tick=(time,wall=time)=>{now=wall;const[id,cb]=pending.entries().next().value;pending.delete(id);cb(time);};
 c.start(from,to,'plan',30);tick(16);tick(32);tick(48,50);tick(64);tick(80);
 assert.equal(c.active,true,'6ms from start to first RAF must not shrink the two 16ms opportunities');
 assert.equal(pending.size,1);tick(96);assert.equal(c.active,false);assert.equal(finished,1);
});

test('#1344 ordinary sub-millisecond RAF phase jitter does not add a third hold frame',()=>{
 let now=0,seq=0,finished=0;const pending=new Map();
 const c=new ModeTransitionController({frame:()=>{},settled:()=>finished++},
 {now:()=>now,requestFrame:cb=>{pending.set(++seq,cb);return seq},cancelFrame:id=>pending.delete(id)});
 const from=endpoint('view',0,600,{x:0,y:0,w:800,h:600}),to=endpoint('plan',96,504,{x:0,y:48,w:800,h:504});
 const tick=(time,wall)=>{now=wall;assert.equal(pending.size,1);const[id,cb]=pending.entries().next().value;pending.delete(id);cb(time);};
 c.start(from,to,'plan',30);tick(16.7,17.2);tick(33.4,34.4);tick(50.1,50.5);tick(66.8,67.1);
 assert.equal(c.active,false);assert.equal(finished,1);assert.equal(pending.size,0);
});
