/**
 * Home Assistant REST oracle for the tests: the truth about entity state lives
 * in HA, not in our DOM. Tokens come from HA's own login flow (the same steps
 * the login page performs), so no long-lived token has to be seeded.
 */
import { HA_URL, USERS } from '../../scripts/users.mjs';

const CLIENT_ID = `${HA_URL}/`;
const tokens = new Map();

export async function accessToken(role = 'admin') {
  if (tokens.has(role)) return tokens.get(role);
  const user = USERS[role];
  const start = await fetch(`${HA_URL}/auth/login_flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, handler: ['homeassistant', null], redirect_uri: CLIENT_ID }),
  }).then((r) => r.json());
  const step = await fetch(`${HA_URL}/auth/login_flow/${start.flow_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, username: user.username, password: user.password }),
  }).then((r) => r.json());
  if (step.type !== 'create_entry') throw new Error(`login flow for ${role}: ${JSON.stringify(step)}`);
  const token = await fetch(`${HA_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: step.result, client_id: CLIENT_ID }),
  }).then((r) => r.json());
  if (!token.access_token) throw new Error(`token for ${role}: ${JSON.stringify(token)}`);
  tokens.set(role, token.access_token);
  return token.access_token;
}

async function api(path, { method = 'GET', body, role = 'admin' } = {}) {
  const r = await fetch(`${HA_URL}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(role)}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

export const getState = (entityId) => api(`/states/${entityId}`);
export const callService = (domain, service, data) => api(`/services/${domain}/${service}`, { method: 'POST', body: data });
export const config = () => api('/config');

/** Poll HA until the entity reaches `state` (the card must follow, never lead). */
export async function waitForState(entityId, state, timeoutMs = 10000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    last = (await getState(entityId)).state;
    if (last === state) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${entityId} stayed "${last}", expected "${state}"`);
}
