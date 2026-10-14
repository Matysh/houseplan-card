/**
 * #850: the work of one HA tick of a sensor that stands on the plan.
 *
 * Four scenarios on the shown floor of `led-strips-v1` (benchmark_led_strips.mjs):
 *   S0  — an entity that is not on the plan (no render at all, #775); it is
 *         added and settled first, so the series ticks an existing row;
 *         before it the lazy live runtime has landed and captured once (its
 *         first capture is complete), primed by one value of the S1 sensor;
 *   S1  — a temperature sensor of a device on the shown floor, not a light;
 *   S1b — the same kind of sensor on another floor;
 *   S2  — the light of an LED strip on the shown floor, on/off (an ordinary
 *         light of the floor when the size has no strips).
 * Each scenario assigns `ticks` new HA objects, one row changed per tick, and
 * awaits the card's update after each. Exact counters per scenario:
 *   fullRenders        — `_renderBody` calls (an instance wrapper, removed after);
 *   snapshots          — new render-device snapshots (identity, both SHAs);
 *   presentationsReplaced — snapshot presentations whose object changed (both SHAs);
 *   presentationBuilds, snapshotFull, snapshotIncremental, lightGraphs,
 *   lightResolutions   — the live runtime's work counters (`work()`, #850);
 *   ledFrames, ledTubes — LED frames built and tubes derived (`ledStats`, #850);
 *   lightGeometry      — architectural light fingerprints (`work()`, #850);
 * a product counter a base does not have is null, never a guess. `observe`
 * (the profile mode) adds wrappers that measure the same work on a base:
 * LED frame identity read through `_ledRt`, strip models replaced (each one a
 * tube derivation) and `_resolveLightBarriers` calls (each one a fingerprint
 * on a base). They cost time, so the gate never installs them.
 * S2 also counts `staleStripes`: ticks after which the strip's stripe does
 * not show the light's new state. `mark(name, 'start' | 'end')` brackets each
 * scenario for a CPU profile in the profile mode.
 * Timing per tick: assignment → `updateComplete`; median and p95 are noisy on
 * a shared runner, the counters are exact. Dependencies are passed in, so
 * this exact function runs in the page (serialised by the runner).
 */
export async function sensorTickScenarios({ card, host, layout, entities, ticks, strips, observe, frame, stats, mark }) {
  const shown = card._space;
  const ledMarkers = new Set(card._model.flatMap((space) => (space.led_strips || []).map((strip) => strip.marker)));
  const floorOf = (id) => layout[entities[id]?.device_id]?.s;
  const sensor = (onShown) => Object.keys(host.states).find((id) => id.startsWith('sensor.')
    && !ledMarkers.has(entities[id]?.device_id) && (floorOf(id) === shown) === onShown);
  const floorIndex = card._model.findIndex((space) => space.id === shown);
  const light = strips ? `light.perf_led_${floorIndex}_0`
    : Object.keys(host.states).find((id) => id.startsWith('light.') && floorOf(id) === shown);
  const scenarios = [
    ['S0', 'sensor.performance_unrelated', (i) => ({ entity_id: 'sensor.performance_unrelated', state: String(i), attributes: {} })],
    ['S1', sensor(true), (i, row) => ({ ...row, state: String(20 + (i % 10) / 10) })],
    ['S1b', sensor(false), (i, row) => ({ ...row, state: String(20 + (i % 10) / 10) })],
    ['S2', light, (i, row) => ({ ...row, state: i % 2 ? 'on' : 'off' })],
  ];
  let renders = 0;
  const renderBody = card._renderBody;
  card._renderBody = function (...args) { renders++; return renderBody.apply(this, args); }; // private-ok: counts full renders
  let barrierResolutions = 0, observedFrames = 0, stripsReplaced = 0;
  let lastFrame = null;
  const lastStrips = new Map();
  if (observe) {
    const resolve = card._resolveLightBarriers;
    card._resolveLightBarriers = function (...args) { barrierResolutions++; return resolve.apply(this, args); }; // private-ok: profile mode only
    const ledRt = card._ledRt;
    card._ledRt = function (space) { // private-ok: profile mode only, reads the frame it just drew
      const runtime = ledRt.call(this, space);
      if (!runtime) return runtime;
      return {
        ...runtime,
        renderLedLayerFor: (h, s, glow, view) => {
          const result = runtime.renderLedLayerFor(h, s, glow, view);
          const built = runtime.ledFrameFor(h, s, glow);
          if (built !== lastFrame) {
            if (lastFrame) observedFrames++;
            lastFrame = built;
            for (const item of built.views) {
              if (lastStrips.has(item.strip.id) && lastStrips.get(item.strip.id) !== item.strip) stripsReplaced++;
              lastStrips.set(item.strip.id, item.strip);
            }
          }
          return result;
        },
      };
    };
  }
  const work = () => card._liveRt?.work?.() ?? null;
  const read = async () => {
    const led = await stats();
    const own = work();
    return {
      ledFrames: led.loaded ? led.frames ?? null : 0,
      ledTubes: led.loaded ? led.tubes ?? null : 0,
      lightGeometry: own?.lightGeometry ?? null,
      presentationBuilds: own?.presentations ?? null,
      snapshotFull: own?.full ?? null,
      snapshotIncremental: own?.incremental ?? null,
      lightGraphs: own?.lightGraphs ?? null,
      lightResolutions: own?.lightResolutions ?? null,
      fieldRecomputes: led.recomputes ?? 0,
    };
  };
  const delta = (after, before) => Object.fromEntries(Object.keys(after).map((key) => [key,
    after[key] == null || before[key] == null ? null : after[key] - before[key]]));
  const quantile = (values, q) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)].toFixed(3)) : null;
  };
  const snapshotOf = () => card._visibleDeviceSnapshot || card._candidateDeviceSnapshot || null;
  const out = { shown, sensors: {}, scenarios: {} };
  // S0 ticks an entity that already exists: its first appearance is a
  // composition change (the summary may count it), not a state tick.
  const [, unrelated, seed] = scenarios[0];
  if (!host.states[unrelated]) host.setStates({ ...host.states, [unrelated]: seed(-1) });
  // Settle so the first tick of S0 does not pay for the previous step: the
  // post-reveal grace (`_bootSoft`, 1.5 s after mount) ends with a render
  // that lands inside S0 when the plan is quick to stabilise (`none`), and a
  // render a step scheduled may land frames later (bounded waits).
  for (let waited = 0; card._bootSoft && waited < 3000; waited += 25) await new Promise((done) => setTimeout(done, 25));
  // The View's live runtime is a lazy chunk: its reuse window starts empty
  // and its first capture is complete. Wait for it (bounded) and prime it
  // with one value of the S1 sensor, so no series pays for that capture.
  for (let waited = 0; !card._liveRt && waited < 3000; waited += 25) await new Promise((done) => setTimeout(done, 25));
  const [, primer, prime] = scenarios[1];
  if (primer && host.states[primer]) host.setStates({ ...host.states, [primer]: prime(-1, host.states[primer]) });
  for (let attempt = 0, seen = -1; attempt < 20 && seen !== renders; attempt++) {
    seen = renders;
    await card.updateComplete;
    await frame();
    await frame();
  }
  for (const [name, entityId, next] of scenarios) {
    out.sensors[name] = entityId || null;
    if (!entityId) { out.scenarios[name] = null; continue; }
    const before = await read();
    const rendersBefore = renders, intakesBefore = card._hassSequence;
    const observedBefore = { barrierResolutions, observedFrames, stripsReplaced };
    let snapshot = snapshotOf(), snapshots = 0, replaced = 0, staleStripes = 0;
    const times = [];
    const marker = entities[entityId]?.device_id;
    await mark?.(name, 'start');
    for (let tick = 0; tick < ticks; tick++) {
      const started = performance.now();
      host.setStates({ ...host.states, [entityId]: next(tick, host.states[entityId]) });
      await card.updateComplete;
      times.push(performance.now() - started);
      // S2: the stripe shows the new state in the same render (AC5).
      if (name === 'S2' && strips) {
        const stripe = card.renderRoot.querySelector(`[data-led-strip][data-marker="${marker}"]`);
        if (stripe?.dataset.state !== host.states[entityId].state) staleStripes++;
      }
      const current = snapshotOf();
      if (current && current !== snapshot) {
        snapshots++;
        if (snapshot) for (const [key, value] of current.presentations) if (snapshot.presentations.get(key) !== value) replaced++;
        snapshot = current;
      }
    }
    await mark?.(name, 'end');
    await frame();
    out.scenarios[name] = {
      entityId, ticks, staleStripes,
      intakes: card._hassSequence - intakesBefore,
      fullRenders: renders - rendersBefore,
      snapshots,
      presentationsReplaced: replaced,
      ...delta(await read(), before),
      tickMs: { median: quantile(times, 0.5), p95: quantile(times, 0.95),
        sum: Number(times.reduce((sum, value) => sum + value, 0).toFixed(2)) },
      ...(observe ? { observed: {
        ledFrames: observedFrames - observedBefore.observedFrames,
        stripsReplaced: stripsReplaced - observedBefore.stripsReplaced,
        barrierResolutions: barrierResolutions - observedBefore.barrierResolutions,
      } } : {}),
    };
  }
  // Leave the strip light on for the steps that follow.
  if (light) {
    host.setStates({ ...host.states, [light]: { ...host.states[light], state: 'on' } });
    await card.updateComplete;
    await frame();
  }
  delete card._renderBody; // private-ok: removes the instance wrapper installed above
  if (observe) { delete card._resolveLightBarriers; delete card._ledRt; } // private-ok: removes the profile wrappers
  return out;
}

/**
 * H1/H2 of the profile (contract п.1): 120 pointer moves over a device marker
 * and over an LED hit path. #850 does not change hover; the series record the
 * cost of one move, full renders, snapshots and the tooltip's DOM churn.
 */
export async function hoverScenarios({ card, frame }) {
  const root = card.renderRoot;
  const ledMarkers = new Set(card._model.flatMap((space) => (space.led_strips || []).map((strip) => strip.marker)));
  let renders = 0;
  const renderBody = card._renderBody;
  card._renderBody = function (...args) { renders++; return renderBody.apply(this, args); }; // private-ok: counts full renders
  const tip = root.querySelector('[data-hp-live-tip]');
  const series = async (label, element, moves = 120) => {
    if (!element) return { label, missing: true };
    const rect = element.getBoundingClientRect();
    const at = (x, y) => ({ clientX: x, clientY: y, bubbles: true, composed: true, pointerId: 991,
      pointerType: 'mouse', isPrimary: true });
    const mutations = { added: 0, removed: 0, attributes: 0 };
    const observer = new MutationObserver((list) => { for (const record of list) {
      mutations.added += record.addedNodes.length; mutations.removed += record.removedNodes.length;
      if (record.type === 'attributes') mutations.attributes++;
    } });
    if (tip) observer.observe(tip, { childList: true, subtree: true, attributes: true, characterData: true });
    const rendersBefore = renders;
    const snapshot = card._visibleDeviceSnapshot;
    element.dispatchEvent(new PointerEvent('pointerover', at(rect.left + rect.width / 2, rect.top + rect.height / 2)));
    const times = [];
    for (let move = 0; move < moves; move++) {
      const started = performance.now();
      element.dispatchEvent(new PointerEvent('pointermove',
        at(rect.left + rect.width / 2 + (move % 5) - 2, rect.top + rect.height / 2 + ((move >> 2) % 3) - 1)));
      times.push(performance.now() - started);
    }
    await card.updateComplete;
    await frame();
    observer.takeRecords();
    observer.disconnect();
    element.dispatchEvent(new PointerEvent('pointerleave', { ...at(0, 0), bubbles: false }));
    await frame();
    const sorted = [...times].sort((a, b) => a - b);
    return { label, moves, fullRenders: renders - rendersBefore,
      snapshots: card._visibleDeviceSnapshot === snapshot ? 0 : 1, tipMutations: mutations,
      moveMs: { median: Number(sorted[Math.floor(moves / 2)].toFixed(4)),
        p95: Number(sorted[Math.ceil(0.95 * moves) - 1].toFixed(4)) } };
  };
  const device = [...root.querySelectorAll('[data-hp="device"]')]
    .find((node) => node.tagName !== 'path' && !ledMarkers.has(node.dataset.id));
  const out = { H1: await series('device marker', device), H2: await series('LED hit path', root.querySelector('.led-hit')) };
  delete card._renderBody; // private-ok: removes the instance wrapper installed above
  return out;
}

/** The exact counters judged at zero (or per tick) for each scenario. */
export const TICK_COUNTERS = ['fullRenders', 'snapshots', 'presentationBuilds', 'ledFrames', 'ledTubes',
  'lightGeometry', 'lightGraphs', 'lightResolutions'];

/**
 * Judge every sample's scenarios against `budget` ({ S1: { ledFrames: 0,
 * presentationBuildsPerTick: 2, … }, … }). A judged counter that is missing
 * (null: a build without the counter) fails closed; a scenario without its
 * entity fails too.
 */
export function tickCounterFailures(rows, budget) {
  const failures = [];
  rows.forEach((row, index) => {
    for (const [name, limits] of Object.entries(budget || {})) {
      const scenario = row?.ticks?.scenarios?.[name];
      if (!scenario) { failures.push(`sample ${index}: ${name} not measured`); continue; }
      for (const [key, limit] of Object.entries(limits)) {
        const perTick = key.endsWith('PerTick');
        const counter = perTick ? key.slice(0, -'PerTick'.length) : key;
        const value = scenario[counter];
        const max = perTick ? limit * scenario.ticks : limit;
        if (!Number.isFinite(value)) failures.push(`sample ${index}: ${name}.${counter} missing`);
        else if (value > max) failures.push(`sample ${index}: ${name}.${counter} = ${value} > ${max}`);
      }
    }
  });
  return failures;
}

/**
 * Attribution of a CDP CPU profile (contract п.1): self time of the garbage
 * collector, of idle/program and of everything else — the product's JS. The
 * harness overhead is S0's tick, judged separately.
 */
export function summarizeCpuProfile(profile) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map();
  const deltas = profile.timeDeltas || [];
  (profile.samples || []).forEach((id, index) => self.set(id, (self.get(id) || 0) + (deltas[index] || 0)));
  const totals = { product: 0, gc: 0, idle: 0, program: 0 };
  for (const [id, micros] of self) {
    const name = byId.get(id)?.callFrame?.functionName;
    const kind = name === '(garbage collector)' ? 'gc' : name === '(idle)' ? 'idle' : name === '(program)' ? 'program' : 'product';
    totals[kind] += micros;
  }
  const all = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(totals).map(([key, micros]) => [key,
    { ms: Number((micros / 1000).toFixed(1)), share: Number((micros / all).toFixed(4)) }]));
}
