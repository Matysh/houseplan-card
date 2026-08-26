import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // #306: a hass tick that changes no geometry must not rebuild spaces. The
  // shared zero-wall resolver may run during paint, but must not storm.
  let zeroCalls = 0, buildCalls = 0;
  const origZero = c._zeroWalls.bind(c);
  c._zeroWalls = (...a) => { zeroCalls++; return origZero(...a); };
  const origBuild = c._buildModel.bind(c);
  c._buildModel = (...a) => { buildCalls++; return origBuild(...a); };
  const sp = c._curSpaceCfg;
  sp.zero_wall_style = 'dashed';
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  zeroCalls = 0; buildCalls = 0;
  const devicesBeforeHassTicks = c._devices;
  for (let i = 0; i < 10; i++) {
    c.hass = { ...c.hass, states: { ...c.hass.states } };
    await c.updateComplete;
  }
  out.zeroResolutionBounded = zeroCalls <= 30;
  out.modelBuildsPer10Renders = buildCalls;
  out.devicesStableAcrossHassTicks = c._devices === devicesBeforeHassTicks;

  // #146: the browser-clock fallback repaints only the environment. A 30 s
  // tick must not rebuild the plan, devices, wall union, or sun-ray geometry.
  c._serverCfg = {
    ...c._serverCfg,
    settings: { ...(c._serverCfg?.settings || {}), bg_mode: 'daynight' },
  };
  const statesWithoutSun = { ...c.hass.states };
  delete statesWithoutSun['sun.sun'];
  c.hass = { ...c.hass, states: statesWithoutSun };
  c.requestUpdate(); await c.updateComplete;
  const clockModel = c._model;
  const clockDevices = c._devices;
  const clockWallUnion = c._wallUnionCache;
  const clockSunRays = c._sunRaysCache;
  buildCalls = 0;
  c._dayCycleClockKey = 'force-next-clock-tick';
  c._dayCycleTick();
  await c.updateComplete;
  out.fallbackClockActive = (c.shadowRoot || c.renderRoot)
    .querySelector('.hp-day-cycle-env')?.dataset.dayCycleSource === 'clock';
  out.clockTickModelBuilds = buildCalls;
  out.clockTickKeepsModel = c._model === clockModel;
  out.clockTickKeepsDevices = c._devices === clockDevices;
  out.clockTickKeepsWallUnion = c._wallUnionCache === clockWallUnion;
  out.clockTickKeepsSunRays = c._sunRaysCache === clockSunRays;

  const before = zeroCalls;
  sp.zero_wall_style = 'solid';
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  out.invalidatesOnEdit = zeroCalls > before;
  // The shared demo has no zero wall by default. Add one independent axis so
  // the paint assertion exercises #306 instead of passing only when another
  // fixture happens to contain a legacy open span.
  sp.partitions ||= [];
  sp.partitions.push({ id: 'perf-zero-wall', a: [0.1, 0.95], b: [0.2, 0.95], cm: 0 });
  sp.zero_wall_style = 'dashed';
  sp.settings = { ...(sp.settings || {}), show_borders: true };
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  out.dashesStillRendered = (c.shadowRoot || c.renderRoot).querySelectorAll('.zero-wall').length > 0;
  return out;
});
checkAll(res, {
  modelBuildsPer10Renders: 0,
  clockTickModelBuilds: 0,
});
await finish(browser, res);
