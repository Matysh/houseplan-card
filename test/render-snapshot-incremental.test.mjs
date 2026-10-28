// #850 AC3: the incremental render-device snapshot equals a complete rebuild.
//
// A differential oracle on the real resolvers and the `large-house` fixture:
// every random tick is captured twice — through the live runtime's reuse
// window and as a complete rebuild without it — and the two snapshots must be
// equal. A state tick of a device's own row rebuilds that device's two
// presentations and keeps every other presentation, DevItem, state and
// registry row, and the roster itself, by identity. The snapshot stays deeply
// frozen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureHost, oracleFixture, prng } from './render-snapshot-fixture.mjs';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { presentationSnapshotKey } from '../test-build/render-device-snapshot.js';
import { HiddenDeviceRoster } from '../test-build/hidden-device-visibility.js';
import { thresholdIssues } from '../test-build/marker-alert-presentation.js';

/** A comparable projection of a snapshot: maps become entry lists, the capture time is dropped. */
const plain = (snapshot) => ({
  sourceSequence: snapshot.sourceSequence,
  hass: snapshot.hass,
  devices: snapshot.devices,
  vacuumDevices: snapshot.vacuumDevices,
  positions: [...snapshot.positions],
  presentations: [...snapshot.presentations],
  facts: [...snapshot.facts],
  entityIds: snapshot.entityIds,
  geometry: snapshot.geometry,
});

test('#1093 routed vacuum facts follow the route floor without painting its off-floor dock', () => {
  const host = captureHost(oracleFixture()), reuse = new RenderSnapshotReuseWindow();
  host._space = host._devices[0].space; host._mode = 'view';
  const route = {id:'remote-route',source:'camera.remote_map',map_id:'upstairs',space:host._space,
    calibration:[1,0,0,0,1,0]};
  const robot = {...host._devices[0],id:'remote-vacuum',space:'remote-dock',primary:'vacuum.remote',
    entities:['vacuum.remote'],allEntities:['vacuum.remote'],bindingKind:'entity',bindingRef:'vacuum.remote',
    marker:{id:'remote-vacuum',vacuum:{source:'camera.remote_map',map_routes:[route]}}};
  host._devices = [...host._devices,robot];
  host.hass = {...host.hass,states:{...host.hass.states,
    'vacuum.remote':{state:'cleaning',attributes:{}},
    'camera.remote_map':{state:'idle',attributes:{map_name:'upstairs',robot_position:{x:100,y:200}}},
    'camera.unrelated':{state:'idle',attributes:{map_name:'elsewhere'}}}};
  host._isVacDev = device => device.id === robot.id;
  host._vacRuntimeSource = (device,hass) => ({source:route.source,
    mapId:hass.states[route.source].attributes.map_name,
    telemetry:{pos:hass.states[route.source].attributes.robot_position},
    routes:[route],resolution:{kind:'ready',route},unavailable:false});
  host._vacRt.set(robot.id,{material:[],lastTs:1,moving:true,jump:false});
  const first = captureRenderDeviceSnapshot(host,reuse);
  assert.deepEqual(first.vacuumDevices.map(d=>d.id),[robot.id]);
  assert.equal(first.facts.get(`vacuum:${robot.id}`).telemetry.pos.x,100);
  assert.ok(first.entityIds.includes('vacuum.remote') && first.entityIds.includes('camera.remote_map'));
  assert.equal(first.entityIds.includes('camera.unrelated'),false);
  assert.equal(first.presentations.has(presentationSnapshotKey(robot.id,false)),false,'off-floor dock stays dormant');
  assert.equal(first.positions.has(robot.id),false);
  host.hass = {...host.hass,states:{...host.hass.states,'camera.remote_map':{
    state:'idle',attributes:{map_name:'upstairs',robot_position:{x:140,y:240}}}}};
  const next = captureRenderDeviceSnapshot(host,reuse);
  assert.equal(next.facts.get(`vacuum:${robot.id}`).telemetry.pos.x,140);
  assert.equal(first.facts.get(`vacuum:${robot.id}`).telemetry.pos.x,100,'held old frame immutable');
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
  route.space = 'unrelated-floor';
  const unrelated = captureRenderDeviceSnapshot(host,reuse);
  assert.equal(unrelated.vacuumDevices.length,0);
  assert.equal(unrelated.entityIds.includes('camera.remote_map'),false,'unrelated route remains dormant');
  route.space = host._space; robot.hidden = true;
  assert.equal(captureRenderDeviceSnapshot(host,reuse).vacuumDevices.length,0);
  robot.hidden = false; robot.marker.removed = true;
  assert.equal(captureRenderDeviceSnapshot(host,reuse).vacuumDevices.length,0);
});

test('#1093 one marker presentation edit preserves unrelated faces and fresh immutable roster', () => {
  const host=captureHost(oracleFixture()),reuse=new RenderSnapshotReuseWindow();
  const first=captureRenderDeviceSnapshot(host,reuse), before=reuse.stats.presentations;
  const id=host._devices[0].id, other=host._devices[1].id;
  host._devices[0].name='Changed one marker';
  const next=captureRenderDeviceSnapshot(host,reuse);
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
  assert.equal(reuse.stats.presentations-before,2,'only both projections of the changed device');
  assert.equal(next.presentations.get(presentationSnapshotKey(other,false)),first.presentations.get(presentationSnapshotKey(other,false)));
  assert.notEqual(next.devices.find(d=>d.id===id),first.devices.find(d=>d.id===id));
  assert.notEqual(first.devices.find(d=>d.id===id).name,'Changed one marker','previous frame remains immutable');
});

test('#1093 one threshold change invalidates its face, not unrelated presentations', () => {
  const host=captureHost(oracleFixture()),reuse=new RenderSnapshotReuseWindow();
  const id=host._devices[0].id,other=host._devices[1].id;let rows=[];
  host._alerts={version:0,issuesForDevice:current=>current===id?thresholdIssues(rows,'en'):[]};
  const first=captureRenderDeviceSnapshot(host,reuse),before=reuse.stats.presentations;
  rows=[{key:'test/r1',identity:'test',rule:{id:'r1',type:'threshold',entity_id:'sensor.co2',level:'attention',operator:'gt',value:1000},
    value:1200,comparable:true,name:'CO2',unit:'ppm'}];host._alerts.version++;
  const next=captureRenderDeviceSnapshot(host,reuse);
  assert.equal(reuse.stats.presentations-before,2);
  assert.equal(next.presentations.get(presentationSnapshotKey(other,false)),first.presentations.get(presentationSnapshotKey(other,false)));
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
});

test('#1093 inherited battery updates only consumers whose effective policy changes', () => {
  const fixture=oracleFixture();
  fixture.config.spaces[0].settings={...fixture.config.spaces[0].settings,show_device_battery_mode:'off'};
  const host=captureHost(fixture),reuse=new RenderSnapshotReuseWindow();
  const first=captureRenderDeviceSnapshot(host,reuse), before=reuse.stats.presentations;
  const fixed=host._devices.find(d=>d.space===fixture.config.spaces[0].id);
  const inherited=host._devices.filter(d=>d.space!==fixture.config.spaces[0].id);
  assert.ok(fixed&&inherited.length);
  host._settings.show_device_battery=false;
  const next=captureRenderDeviceSnapshot(host,reuse);
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
  assert.equal(reuse.stats.presentations-before,inherited.length*2);
  assert.equal(next.presentations.get(presentationSnapshotKey(fixed.id,false)),first.presentations.get(presentationSnapshotKey(fixed.id,false)));
});

test('#1093 current-floor hidden faces remain dormant until an editor actually paints ghosts', () => {
  const host=captureHost(oracleFixture()),reuse=new RenderSnapshotReuseWindow();
  const hidden=host._devices[0];host._space=hidden.space;host._mode='view';hidden.hidden=true;
  const first=captureRenderDeviceSnapshot(host,reuse);
  assert.equal(first.presentations.has(presentationSnapshotKey(hidden.id,false)),false);
  host._mode='devices';host._showAll=true;
  const next=captureRenderDeviceSnapshot(host,reuse);
  assert.equal(next.presentations.has(presentationSnapshotKey(hidden.id,false)),true);
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
});

test('#1026 diagnostic-only own ticks and registry ownership match complete snapshots', () => {
  const host=captureHost(oracleFixture()),reuse=new RenderSnapshotReuseWindow();
  const id='perf-device-7',key=presentationSnapshotKey(id,true);
  const own=host._devices.find(device=>device.id===id);
  const diagnostic='sensor.perf_7_battery';
  assert.ok(own.entities.includes(diagnostic));
  const setRows=values=>{
    const states={...host.hass.states};
    for(const [eid,state]of Object.entries(values)){
      if(state===null)delete states[eid];
      else states[eid]={...(states[eid]||{entity_id:eid,attributes:{}}),state};
    }
    host.hass={...host.hass,states};host._hassSequence++;
  };
  setRows(Object.fromEntries(own.entities.map(eid=>[eid,'unavailable'])));
  let previous=captureRenderDeviceSnapshot(host,reuse);
  assert.equal(previous.presentations.get(key).ownAvailability,'unavailable');
  for(const [state,want]of [['100','available'],['unknown','unknown'],[null,'unknown'],
    ['unavailable','unavailable'],['0','available']]){
    setRows({[diagnostic]:state});
    const incremental=captureRenderDeviceSnapshot(host,reuse);
    assert.deepEqual(plain(incremental),plain(captureRenderDeviceSnapshot(host,null)));
    const presentation=incremental.presentations.get(key);
    assert.equal(presentation.ownAvailability,want,`diagnostic=${state}`);
    assert.equal(presentation.offline,want==='unavailable');
    assert.notEqual(presentation,previous.presentations.get(key),'own diagnostic invalidates this presentation');
    assert.equal(incremental.presentations.get(presentationSnapshotKey('perf-device-8',true)),
      previous.presentations.get(presentationSnapshotKey('perf-device-8',true)),
      'an unrelated marker retains its presentation');
    assertDeepFrozen(incremental);previous=incremental;
  }
  // An available row stops being own evidence as soon as the registry disables it.
  host.hass={...host.hass,entities:{...host.hass.entities,
    [diagnostic]:{...host.hass.entities[diagnostic],disabled_by:'user'}}};
  host.rebuildRoster();
  let next=captureRenderDeviceSnapshot(host,reuse);
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
  assert.equal(next.presentations.get(key).ownAvailability,'unavailable');
  // A new exact-entity marker claims that diagnostic; a registry/context rebuild
  // cannot let it silently prove the residual physical parent online again.
  host.hass={...host.hass,entities:{...host.hass.entities,
    [diagnostic]:{...host.hass.entities[diagnostic],disabled_by:null}}};
  host._markers.push({id:'own-diagnostic',binding:`entity:${diagnostic}`,space:'perf-floor-1'});
  host._cfgEpoch++;host.rebuildRoster();
  next=captureRenderDeviceSnapshot(host,reuse);
  assert.deepEqual(plain(next),plain(captureRenderDeviceSnapshot(host,null)));
  assert.equal(next.presentations.get(key).ownAvailability,'unavailable');
  assert.equal(next.presentations.get(presentationSnapshotKey('own-diagnostic',true)).ownAvailability,'available');
});

test('#920 an explicit CO2 source outside every room remains in the immutable live snapshot', () => {
  const fixture = oracleFixture();
  const id = 'sensor.external_co2';
  fixture.entities[id] = { entity_id: id, area_id: null, device_id: null, platform: 'houseplan_perf', disabled_by: null };
  fixture.states[id] = { entity_id: id, state: '850', attributes: { device_class: 'carbon_dioxide', unit_of_measurement: 'ppm' } };
  fixture.config.spaces[0].rooms[0].settings = { co2_source: `entity:${id}` };
  const host = captureHost(fixture), reuse = new RenderSnapshotReuseWindow();
  const first = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(first.hass.states[id].state, '850');
  host.hass = { ...host.hass, states: { ...host.hass.states, [id]: { ...host.hass.states[id], state: '1375' } } };
  host._hassSequence++;
  const next = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(next.hass.states[id].state, '1375');
  assert.equal(first.hass.states[id].state, '850');
  assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host, null)));
});

test('#919 local reveal invalidates reuse, preserves raw intent and follows live updates like a complete capture', () => {
  const fixture = oracleFixture();
  const id = 'perf-device-0';
  fixture.config.settings.filter_seeded = true;
  fixture.config.markers = fixture.config.markers.filter(marker => marker.id !== id);
  fixture.config.markers.push({ id, binding: `device:${id}`, hidden: true, is_light: true });
  const host = captureHost(fixture), roster = new HiddenDeviceRoster();
  Object.defineProperty(host, '_displayDevices', { get() { return roster.read(this._devices, this._showHidden, this._cfgEpoch); } });
  const reuse = new RenderSnapshotReuseWindow(), key = presentationSnapshotKey(id, true);
  const raw = host._devices.find(device => device.id === id);
  assert.equal(raw.hidden, true);
  for (const shown of [false, true, false, true]) {
    host._showHidden = shown;
    const snapshot = captureRenderDeviceSnapshot(host, reuse);
    assert.deepEqual(plain(snapshot), plain(captureRenderDeviceSnapshot(host, null)));
    assert.equal(snapshot.presentations.get(key).userHidden, !shown);
    assert.equal(snapshot.devices.find(device => device.id === id).hidden, !shown);
    assert.equal(raw.hidden, true); assert.equal(raw.marker.hidden, true);
    assertDeepFrozen(snapshot);
    for (const state of ['unavailable', 'off', 'on']) {
      const eid = 'light.perf_0';
      host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: { ...host.hass.states[eid], state } } };
      host._hassSequence++;
      const live = captureRenderDeviceSnapshot(host, reuse);
      assert.deepEqual(plain(live), plain(captureRenderDeviceSnapshot(host, null)), `shown=${shown}, state=${state}`);
      if (shown) assert.equal(live.presentations.get(key).visual.availability, state === 'unavailable' ? 'unavailable' : 'available');
    }
  }
});

const assertDeepFrozen = (value, path = 'snapshot', seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `${path} is frozen`);
  for (const [key, item] of Object.entries(value)) assertDeepFrozen(item, `${path}.${key}`, seen);
};

test('#850 AC3: 250 random ticks — the incremental snapshot equals a complete rebuild after every tick', () => {
  const fixture = oracleFixture();
  const host = captureHost(fixture);
  const reuse = new RenderSnapshotReuseWindow();
  let previous = captureRenderDeviceSnapshot(host, reuse);
  assert.deepEqual(plain(previous), plain(captureRenderDeviceSnapshot(host, null)), 'the first capture is complete');
  const random = prng(850);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const ownRows = (prefix) => Object.keys(host.hass.states).filter((id) => id.startsWith(prefix));
  const sensors = ownRows('sensor.perf_').filter((id) => /^sensor\.perf_\d+$/.test(id));
  // Rows with exactly one reader, their own device: no battery sibling whose
  // classification reads them, no badge or entity marker elsewhere.
  const single = new Set(sensors.filter((id) => {
    const index = Number(id.slice('sensor.perf_'.length));
    return index % 7 !== 0 && index !== 12 && index !== 42;
  }));
  const batteries = ownRows('sensor.perf_').filter((id) => id.endsWith('_battery'));
  const lqis = ownRows('sensor.perf_').filter((id) => id.endsWith('_linkquality'));
  const doors = ownRows('binary_sensor.perf_door_');
  const lights = ownRows('light.perf_');
  const counts = {};
  const setRow = (eid, patch) => {
    const states = { ...host.hass.states };
    if (patch === undefined) delete states[eid];
    else states[eid] = { ...states[eid], ...patch, entity_id: eid };
    host.hass = { ...host.hass, states };
  };
  const kinds = {
    value: () => { const eid = pick(sensors); setRow(eid, { state: String(15 + Math.round(random() * 100) / 10) }); return eid; },
    battery: () => { const eid = pick(batteries); setRow(eid, { state: random() < 0.5 ? '4' : '96' }); return eid; },
    lqi: () => { const eid = pick(lqis); setRow(eid, { state: String(Math.round(random() * 255)) }); return eid; },
    door: () => { const eid = pick(doors); setRow(eid, { state: host.hass.states[eid].state === 'on' ? 'off' : 'on' }); return null; },
    unavailable: () => {
      const eid = pick([...sensors, ...batteries, ...doors]);
      setRow(eid, { state: host.hass.states[eid].state === 'unavailable' ? '20' : 'unavailable' });
      return null;
    },
    light: () => {
      const eid = pick(lights);
      setRow(eid, random() < 0.5 ? { state: host.hass.states[eid].state === 'on' ? 'off' : 'on' }
        : { attributes: { ...host.hass.states[eid].attributes, rgb_color: [Math.round(random() * 255), 120, 80] } });
      return null;
    },
    controller: () => { setRow('switch.perf_1', { state: host.hass.states['switch.perf_1'].state === 'on' ? 'off' : 'on' }); return null; },
    registry: () => {
      const entities = { ...host.hass.entities };
      const eid = pick(sensors);
      entities[eid] = { ...entities[eid], name: `Renamed ${random()}` };
      host.hass = { ...host.hass, entities };
      host.rebuildRoster();
      return null;
    },
    settings: () => {
      // The card adopts a new stored config; its settings change the battery mode.
      host._serverCfg = { ...host._serverCfg, settings: { ...host._serverCfg.settings,
        show_device_battery: pick([undefined, 'low', false]) } };
      return null;
    },
    virtual: () => {
      const off = new Set(host._virtualLights.off);
      const id = pick(['perf-virtual-a', 'perf-virtual-b']);
      if (off.has(id)) off.delete(id); else off.add(id);
      host._virtualLights = { rev: host._virtualLights.rev + 1, configRev: 0, off };
      return null;
    },
    activity: () => {
      const id = pick(host._devices).id;
      const runtime = host._activityRt.get(id) || { sources: '', flashTs: 0, flashKind: null, gen: 1 };
      host._activityRt.set(id, { ...runtime, flashTs: Date.now(), flashKind: 'event', gen: runtime.gen + 1 });
      return null;
    },
    sameRows: () => { host.hass = { ...host.hass, states: { ...host.hass.states } }; return null; },
  };
  const weights = [['value', 6], ['battery', 3], ['lqi', 3], ['door', 2], ['unavailable', 2], ['light', 2],
    ['controller', 2], ['registry', 1], ['settings', 1], ['virtual', 1], ['activity', 1], ['sameRows', 1]];
  const bag = weights.flatMap(([kind, weight]) => Array(weight).fill(kind));
  let singleTicks = 0;
  for (let tick = 0; tick < 250; tick++) {
    const kind = pick(bag);
    counts[kind] = (counts[kind] || 0) + 1;
    const own = kinds[kind]();
    host._hassSequence++;
    const builds = reuse.stats.presentations, incrementalBefore = reuse.stats.incremental;
    const incremental = captureRenderDeviceSnapshot(host, reuse);
    const complete = captureRenderDeviceSnapshot(host, null);
    assert.deepEqual(plain(incremental), plain(complete), `tick ${tick} (${kind}): incremental equals complete`);
    if (tick % 25 === 0) {
      assertDeepFrozen(incremental);
      for (const map of [incremental.positions, incremental.presentations, incremental.facts]) {
        assert.ok(Object.isFrozen(map), 'the map facade is frozen');
        for (const [key, value] of map) assertDeepFrozen(value, key);
      }
    }
    // An activity window that expired between two ticks rebuilds every presentation.
    if (single.has(own) && reuse.stats.incremental === incrementalBefore + 1) {
      // A plan sensor ticked: only its own device was resolved again.
      const owner = host._devices.filter((device) => device.entities.includes(own)).map((device) => device.id);
      singleTicks++;
      assert.ok(reuse.stats.presentations - builds <= 2 * owner.length,
        `tick ${tick}: ${reuse.stats.presentations - builds} presentation builds for ${own}`);
      assert.equal(incremental.devices, previous.devices, 'the roster keeps its identity');
      assert.equal(incremental.hass.entities, previous.hass.entities, 'the registry projection keeps its identity');
      for (const [key, presentation] of previous.presentations) {
        if (owner.some((id) => key.startsWith(`${id}:`))) continue;
        assert.equal(incremental.presentations.get(key), presentation, `tick ${tick}: ${key} kept`);
      }
      for (const [eid, row] of Object.entries(previous.hass.states)) {
        if (eid !== own) assert.equal(incremental.hass.states[eid], row, `tick ${tick}: ${eid} row kept`);
      }
      incremental.devices.forEach((device, index) => assert.equal(device, previous.devices[index]));
    }
    previous = incremental;
  }
  for (const [kind] of weights) assert.ok(counts[kind] > 0, `the oracle exercised ${kind} (${JSON.stringify(counts)})`);
  assert.ok(singleTicks > 20, `identity was judged on ${singleTicks} single-reader ticks`);
  assert.ok(reuse.stats.incremental > 100, `most ticks were incremental: ${JSON.stringify(reuse.stats)}`);
});

test('#850 AC3: a plan sensor tick rebuilds two presentations; S1b on another floor as well', () => {
  const host = captureHost(oracleFixture());
  const reuse = new RenderSnapshotReuseWindow();
  const first = captureRenderDeviceSnapshot(host, reuse);
  for (const [eid, floor] of [['sensor.perf_2', 'shown'], ['sensor.perf_22', 'another']]) {
    const before = { ...reuse.stats };
    host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: { ...host.hass.states[eid], state: '30.5' } } };
    host._hassSequence++;
    const next = captureRenderDeviceSnapshot(host, reuse);
    assert.equal(reuse.stats.presentations - before.presentations, 2, `${eid} (${floor} floor): 2 × 1 device`);
    assert.equal(reuse.stats.full, before.full, 'no complete rebuild');
    const owner = host._devices.find((device) => device.entities.includes(eid));
    assert.notEqual(next.presentations.get(presentationSnapshotKey(owner.id, false)),
      first.presentations.get(presentationSnapshotKey(owner.id, false)));
    assert.match(JSON.stringify(next.presentations.get(presentationSnapshotKey(owner.id, false))), /30\.5/,
      'the new value is in the same capture');
    assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host, null)));
  }
});

test('#1093 paint, equivalent config/layout clones and epoch changes keep faces but refresh snapshot authority', () => {
  const host=captureHost(oracleFixture()),reuse=new RenderSnapshotReuseWindow();
  captureRenderDeviceSnapshot(host,reuse);
  for(const change of [
    ()=>{host._cfgEpoch++;},
    ()=>{host._layout=structuredClone(host._layout);},
    ()=>{host._serverCfg=structuredClone(host._serverCfg);},
    ()=>{host._serverCfg.spaces[0].settings={...host._serverCfg.spaces[0].settings,bg_mode:'static',name_color:{c:'#abcdef',a:.5}};},
  ]) {
    const before={...reuse.stats};change();host._hassSequence++;
    const snapshot=captureRenderDeviceSnapshot(host,reuse);
    assert.equal(reuse.stats.presentations,before.presentations,'unrelated paint does not resolve faces');
    assert.equal(snapshot.geometry,host._cfgEpoch,'fresh coherent geometry identity is published');
    assert.deepEqual(plain(snapshot),plain(captureRenderDeviceSnapshot(host,null)));
  }
  host._serverCfg.spaces[0].rooms[0].settings={temp_source:'entity:sensor.new_temperature'};
  const before=reuse.stats.full;
  const changed=captureRenderDeviceSnapshot(host,reuse);
  assert.equal(reuse.stats.full,before+1,'a changed room source refreshes projected registry selectors');
  assert.deepEqual(plain(changed),plain(captureRenderDeviceSnapshot(host,null)));
});

test('#850 AC3: a structural change rebuilds every presentation or everything; disconnect forgets the window', () => {
  const host = captureHost(oracleFixture());
  const reuse = new RenderSnapshotReuseWindow();
  const first = captureRenderDeviceSnapshot(host, reuse);
  const all = 2 * host._devices.length;
  for (const [label, change, tier] of [
    ['locale', () => { host.hass = { ...host.hass, locale: { language: 'de' } }; }, 'refreshed'],
    ['themes', () => { host.hass = { ...host.hass, themes: { darkMode: true } }; }, 'refreshed'],
    ['card config', () => { host._config = { ...host._config, show_temperature: false }; }, 'refreshed'],
    ['reduced motion', () => { host._reducedMotion = !host._reducedMotion; }, 'refreshed'],
    ['manual lights', () => { host._virtualLights = { rev: 9, configRev: 0, off: new Set(['perf-virtual-a']) }; }, 'refreshed'],
    ['settings', () => { host._serverCfg = { ...host._serverCfg, settings: { show_device_battery: false } }; }, 'incremental'],
    ['registry', () => { host.hass = { ...host.hass, entities: { ...host.hass.entities } }; host.rebuildRoster(); }, 'full'],
    ['equivalent roster', () => { host.rebuildRoster(); }, 'incremental'],
  ]) {
    const previous = captureRenderDeviceSnapshot(host, reuse);
    const before = { ...reuse.stats };
    change();
    host._hassSequence++;
    const next = captureRenderDeviceSnapshot(host, reuse);
    assert.equal(reuse.stats[tier], before[tier] + 1, `${label}: ${tier}`);
    assert.equal(reuse.stats.presentations - before.presentations, label === 'equivalent roster' ? 0 : all, `${label} resolves only changed presentations`);
    assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host, null)), `${label}: equals complete`);
    if (tier === 'refreshed') {
      // A new clone memo (the old one would collect every rebuilt presentation)
      // still lends what did not change: roster, DevItems, rows, registry rows.
      assert.equal(next.devices, previous.devices, `${label} keeps the roster clone`);
      assert.equal(next.devices[3], previous.devices[3], `${label} keeps a DevItem clone`);
      const row = Object.keys(previous.hass.states).find((id) => !id.startsWith('camera.'));
      assert.equal(next.hass.states[row], previous.hass.states[row], `${label} keeps an unchanged row's clone`);
      const device = Object.keys(previous.hass.devices)[0];
      assert.ok(device && next.hass.devices[device] === previous.hass.devices[device],
        `${label} keeps a registry device row's clone`);
    }
  }
  reuse.reset();
  const full = reuse.stats.full;
  captureRenderDeviceSnapshot(host, reuse);
  assert.equal(reuse.stats.full, full + 1, 'a reset window starts with a complete capture');
  assert.ok(first);
});

test('#850 AC3: an in-place edit of a marker record, the stored settings or the card config is an input', () => {
  // DevItems hold the live marker records of the stored config; an edit in
  // place keeps every identity (no epoch, no new roster) and a complete capture
  // read it on the next HA frame (smoke_vacuum: `trail_mode` set in place).
  const host = captureHost(oracleFixture());
  const reuse = new RenderSnapshotReuseWindow();
  captureRenderDeviceSnapshot(host, reuse);
  const sensor = 'sensor.perf_3';
  const tick = (value) => {
    host.hass = { ...host.hass, states: { ...host.hass.states,
      [sensor]: { ...host.hass.states[sensor], state: String(value) } } };
    host._hassSequence++;
  };
  const device = host._devices.find((item) => item.marker && item.entities.length);
  for (const [label, edit] of [
    ['marker record', () => { device.marker.vacuum = { trail_mode: 'always' }; device.marker.display = 'value'; }],
    ['stored settings', () => { host._serverCfg.settings.show_device_battery = false; }],
    ['space battery policy', () => { const space=host._serverCfg.spaces.find(s=>s.id===device.space); space.settings={...space.settings,show_device_battery_mode:'all'}; }],
    ['card config', () => { host._config.show_temperature = false; }],
  ]) {
    edit();
    tick(label.length);
    const next = captureRenderDeviceSnapshot(host, reuse);
    assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host, null)), `${label}: equals complete`);
  }
  assert.equal(host._devices.find((item) => item.id === device.id).marker.vacuum.trail_mode, 'always');
});

test('#850 AC3: a row read only through the battery context or a badge is still an input', () => {
  const host = captureHost(oracleFixture());
  const reuse = new RenderSnapshotReuseWindow();
  captureRenderDeviceSnapshot(host, reuse);
  const tick = (eid, state) => {
    host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: { ...host.hass.states[eid], state } } };
    host._hassSequence++;
    const next = captureRenderDeviceSnapshot(host, reuse);
    assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host, null)), `${eid} → ${state}`);
    return next;
  };
  // The entity-bound marker owns sensor.perf_42; its battery is a sibling of the parent device.
  const marker = presentationSnapshotKey('perf-entity-42', false);
  assert.equal(tick('sensor.perf_42_battery', '96').presentations.get(marker).battery?.state, 'normal');
  assert.equal(tick('sensor.perf_42_battery', '4').presentations.get(marker).battery?.state, 'low',
    'a low charge of the sibling is visible in the same capture');
  // perf-device-2 shows a badge of another device's row.
  const badge = presentationSnapshotKey('perf-device-2', false);
  assert.match(JSON.stringify(tick('sensor.perf_12', '17.25').presentations.get(badge).valueBadge), /17/,
    'the badge of another device\'s row is fresh');
});
