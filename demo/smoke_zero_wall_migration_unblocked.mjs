/** Issue #316: a legacy opening/zero-wall conflict in ANY space must not block
 * drawing in another (empty) space — the migration auto-resolves it (§3). */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const toasts = [];
  const origToast = card._showToast.bind(card);
  card._showToast = (text) => { toasts.push(String(text)); };

  // Space B replays the #316 report: a room, a legacy open_span along its top
  // wall and a door standing inside that former "border".
  const spaceB = {
    id: 'B', title: 'B', cell_cm: 5, view_box: [0, 0, 1, 0.7],
    rooms: [{ id: 'rB', poly: [[0.2, 0.2], [0.6, 0.2], [0.6, 0.5], [0.2, 0.5]] }],
    walls: [{ key: '', a: [0.2, 0.2], b: [0.6, 0.2], cm: 15 }],
    open_spans: [{ a: [0.2, 0.2], b: [0.6, 0.2] }],
    openings: [{ id: 'op1', type: 'door', x: 0.4, y: 0.2, angle: 0, length: 0.09, cm: 90 }],
  };
  const spaceA = { id: 'A', title: 'A', cell_cm: 5, view_box: [0, 0, 1, 0.7], rooms: [] };
  card._serverCfg = { spaces: [spaceA, spaceB], markers: [], settings: {} };
  const sent = [];
  const baseCall = card.hass.callWS.bind(card.hass);
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      sent.push(structuredClone(message));
      return { ok: true, rev: (message.expected_rev ?? 0) + 1 };
    }
    return baseCall(message);
  } };
  card._space = 'A'; card._layout = {};
  card._cfgEpoch++; card._modelCache = null; card._frame = null;
  card._setMode('plan'); card._tool = 'draw'; card._drawWallField = '20';
  card._path = []; await update();

  // The two clicks of the Walls tool: a first draft segment is committed.
  const before = card._geometrySnapshotFromConfig(card._serverCfg, 'A');
  const fresh = card._serverCfg.spaces.find((space) => space.id === 'A');
  fresh.room_drafts = [{ id: 'd1', points: [[0.24, 0.24], [0.48, 0.24]],
    segments: [{ cm: 20 }] }];
  result.commitSucceeds = card._commitPhysicalGeometry('draw', before) === true;
  result.noMigrationToast = !toasts.some((text) => /не преобразовано|not converted/i.test(text));

  // The auto-resolution kept the door on a real wall and zeroed the border on
  // both sides of it (§3.1) inside the migrated candidate.
  const migratedB = card._serverCfg.spaces.find((space) => space.id === 'B');
  const top = (migratedB.wall_segments || [])
    .filter((s) => Math.abs(s.a[1] - 0.2) < 1e-9 && Math.abs(s.b[1] - 0.2) < 1e-9)
    .sort((x, y) => x.a[0] - y.a[0]);
  result.doorKeepsItsWall = top.length === 3
    && top[0].cm === 0 && top[1].cm > 0 && top[2].cm === 0
    && migratedB.openings[0]?.host?.id === top[1].id;
  result.legacyFieldsGone = !('open_spans' in migratedB)
    && (migratedB.rooms || []).every((room) => !('open_to' in room));
  result.draftSurvives = (card._serverCfg.spaces.find((s) => s.id === 'A')
    .room_drafts || []).length === 1;

  card._showToast = origToast;
  return result;
});

checkAll(out);
await finish(browser);
