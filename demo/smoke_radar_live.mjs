// #485 Stage 1: exact-space subscription, safe normalized render and teardown.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const originalHass = card.hass;
  const marker = card._serverCfg.markers.find((item) => item.space === card._space && !item.removed)
    || { id: 'radar-smoke', binding: 'virtual', space: card._space };
  if (!card._serverCfg.markers.includes(marker)) card._serverCfg.markers.push(marker);
  marker.radar = {
    version: 1, enabled: true, profile: 'cartesian_v1', room_id: card._spaceModel().rooms[0].id,
    sources: { slots: [{ id: 'target_1', x_entity: 'sensor.radar_x',
      y_entity: 'sensor.radar_y', unit: 'cm' }] },
    mount: { installation_id: 'smoke', x: .5, y: .5, heading_deg: 0 },
    calibration: { method: 'manual', mirror: false, cell_cm: card._spaceModel().cellCm || 5 },
  };
  card._serverCfg.settings.radar = { version: 1 };
  card._haRadarStage1Api = 1;
  card._radarLive.stop();
  let callback;
  let unsubscribed = 0;
  const connection = {
    ...originalHass.connection,
    subscribeMessage: async (next, message) => {
      if (message.type === 'houseplan/radar/subscribe') callback = next;
      return () => { unsubscribed += 1; };
    },
  };
  card.hass = { ...originalHass, connection };
  card._syncRadarLive();
  await new Promise((resolve) => setTimeout(resolve, 0));
  callback?.({
    server_session_id: 'smoke-session', marker_id: marker.id,
    source_generation: 'sources', calibration_revision: 'calibration', seq: 1,
    reported_at: Date.now() / 1000, expires_at: Date.now() / 1000 + 3,
    health: 'ok', reported_presence: true, complete: true,
    targets: [{ slot: 'target_1', x: .5, y: .5, reported_at: Date.now() / 1000,
      expires_at: Date.now() / 1000 + 3, pair_quality: 'bounded_latest', included: true }],
    ranges: [], zones: [],
  });
  await update();
  const target = root().querySelector(`.radar-target[data-radar-marker="${marker.id}"]`);
  const visible = !!target && target.style.left === '50%' && target.style.top === '50%';
  const pointerTransparent = target ? getComputedStyle(target).pointerEvents === 'none' : false;
  card._serverCfg.settings.radar = { version: 1, show_live: false };
  card._syncRadarLive();
  await update();
  const globalHideRemovesTarget = !root().querySelector('.radar-target');
  const globalHideUnsubscribes = unsubscribed >= 1;
  card.hass = originalHass;
  card._radarLive.stop();
  return { subscribed: typeof callback === 'function', visible, pointerTransparent,
    globalHideRemovesTarget, globalHideUnsubscribes };
});

await finish(browser, checkAll(out));
