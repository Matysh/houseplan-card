/**
 * Home Assistant websocket oracle: the House Plan document as the server has
 * stored it. "Saved" in these journeys means "the integration returns it from
 * houseplan/config/get or houseplan/layout/get", not "the tab still shows it".
 *
 * The same channel restores the seed plan after a scenario that edits it, so
 * scenarios stay independent of their order. Restoring is test setup, never an
 * oracle: every assertion about an edit reads the server after the edit made
 * through the real UI.
 */
import { HA_URL } from '../../scripts/users.mjs';
import { accessToken } from './ha-api.mjs';

const WS_URL = `${HA_URL.replace(/^http/, 'ws')}/api/websocket`;

export async function connect(role = 'admin') {
  const token = await accessToken(role);
  const socket = new WebSocket(WS_URL);
  const pending = new Map();
  let nextId = 1;
  let authed;
  const ready = new Promise((resolveReady, rejectReady) => { authed = { resolveReady, rejectReady }; });
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.type === 'auth_required') socket.send(JSON.stringify({ type: 'auth', access_token: token }));
    else if (msg.type === 'auth_ok') authed.resolveReady();
    else if (msg.type === 'auth_invalid') authed.rejectReady(new Error(`websocket auth: ${msg.message}`));
    else if (msg.type === 'result' && pending.has(msg.id)) {
      const { resolveCall, rejectCall, type } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.success) resolveCall(msg.result);
      else rejectCall(Object.assign(new Error(`${type}: ${msg.error?.code} ${msg.error?.message}`), { code: msg.error?.code }));
    }
  });
  socket.addEventListener('error', () => authed.rejectReady(new Error(`websocket ${WS_URL} failed`)));
  await ready;
  return {
    call(message) {
      const id = nextId++;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolveCall, rejectCall, type: message.type });
        socket.send(JSON.stringify({ ...message, id }));
      });
    },
    close() { socket.close(); },
  };
}

export async function wsCall(message, role = 'admin') {
  const connection = await connect(role);
  try {
    return await connection.call(message);
  } finally {
    connection.close();
  }
}

/** `{ config, rev, can_write, … }` exactly as the integration returns it. */
export const planConfig = (extra = {}) => wsCall({ type: 'houseplan/config/get', ...extra });
/** `{ layout, rev, … }`. */
export const planLayout = (extra = {}) => wsCall({ type: 'houseplan/layout/get', ...extra });

export const spaceOf = (config, spaceId) => config.spaces.find((s) => s.id === spaceId);

/**
 * The whole stored document pair, to put back after an editing scenario, plus
 * the product's own full export of the same state for the fallback below.
 */
export async function snapshotPlan() {
  const [config, layout, exported] = await Promise.all([
    planConfig(), planLayout(), wsCall({ type: 'houseplan/export/create', kind: 'full' }),
  ]);
  return { config: config.config, layout: layout.layout, document: exported.document };
}

/** Replace the stored plan with an exported document: preview, then apply. */
export async function importDocument(document, { duplicatePolicy = 'skip' } = {}) {
  const response = await fetch(`${HA_URL}/api/houseplan/import/preview?duplicate_policy=${duplicatePolicy}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken('admin')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  const preview = await response.json();
  if (!response.ok) throw new Error(`import preview: HTTP ${response.status} ${JSON.stringify(preview)}`);
  return wsCall({
    type: 'houseplan/import/apply', token: preview.token,
    expected_config_rev: preview.expected_config_rev, expected_layout_rev: preview.expected_layout_rev,
  });
}

/**
 * Put a snapshot back. The cheap path writes the two documents with the
 * integration's optimistic locking (a scenario that left an editor open could
 * still be writing: re-read the revision, retry a conflict). A wholesale write
 * of an earlier plan can look exactly like a stale card to the integration's
 * guard — for instance after a room was deleted and drawn again in the same
 * walls (`wall_model_client_outdated`). Then the snapshot goes back the way a
 * user restores a backup: the product's own full import of its own export.
 */
export async function restorePlan(snapshot) {
  const connection = await connect('admin');
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const config = await connection.call({ type: 'houseplan/config/get' });
        await connection.call({ type: 'houseplan/config/set', config: snapshot.config, expected_rev: config.rev });
        const layout = await connection.call({ type: 'houseplan/layout/get' });
        await connection.call({ type: 'houseplan/layout/set', layout: snapshot.layout, expected_rev: layout.rev });
        return 'documents';
      } catch (error) {
        if (error.code === 'conflict' && attempt < 4) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        if (error.code === 'wall_model_client_outdated' && snapshot.document) {
          await importDocument(snapshot.document);
          return 'import';
        }
        throw error;
      }
    }
  } finally {
    connection.close();
  }
}

/** Poll the server until `predicate(config)` holds; returns that config. */
export async function waitForConfig(predicate, { timeout = 20_000, message = 'server config' } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = (await planConfig()).config;
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${message}: condition not met within ${timeout} ms`);
}

/** Same for the layout document (marker positions). */
export async function waitForLayout(predicate, { timeout = 20_000, message = 'server layout' } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const last = (await planLayout()).layout;
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${message}: condition not met within ${timeout} ms`);
}
