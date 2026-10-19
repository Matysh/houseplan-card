// UI Lab persistence format, not a product backup or a backend validator.
export const SESSION_FORMAT = 'houseplan-ui-lab/session';
export const MAX_SESSION_BYTES = 8 * 1024 * 1024;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`UI Lab: ${message}`); };

function validateJson(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 250000 || depth > 64) fail('session structure is too large');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') fail('session must contain only JSON values');
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('unsafe session key');
    validateJson(child, depth + 1, budget);
  }
}

export function sessionIdentity(provenance) {
  const { datasetId, productFingerprint } = provenance;
  if (typeof datasetId !== 'string' || !datasetId || typeof productFingerprint !== 'string' || !productFingerprint) fail('missing dataset provenance');
  return { datasetId, productFingerprint };
}

export function sessionKey(identity) {
  sessionIdentity(identity);
  return `houseplan-ui-lab:session:v2:${encodeURIComponent(identity.datasetId)}:${encodeURIComponent(identity.productFingerprint)}`;
}

export function validateSnapshot(snapshot) {
  if (!record(snapshot) || !record(snapshot.config) || !Array.isArray(snapshot.config.spaces)
    || !Array.isArray(snapshot.config.markers) || !record(snapshot.layout) || !record(snapshot.states)
    || !Array.isArray(snapshot.virtualLightsOff)) fail('invalid session snapshot');
  if (snapshot.config.spaces.some(space => !record(space) || typeof space.id !== 'string' || !Array.isArray(space.rooms))
    || snapshot.config.markers.some(marker => !record(marker) || typeof marker.id !== 'string')
    || Object.values(snapshot.layout).some(position => !record(position)
      || typeof position.s !== 'string' || !Number.isFinite(position.x) || !Number.isFinite(position.y))
    || Object.values(snapshot.states).some(state => !record(state) || typeof state.entity_id !== 'string'
      || typeof state.state !== 'string' || !record(state.attributes))
    || snapshot.virtualLightsOff.some(id => typeof id !== 'string')) fail('invalid session data shape');
  validateJson(snapshot);
  return structuredClone(snapshot);
}

export function createSession(identity, snapshot) {
  return { format: SESSION_FORMAT, schema: 1, ...sessionIdentity(identity), snapshot: validateSnapshot(snapshot) };
}

export function serializeSession(identity, snapshot) {
  const text = JSON.stringify(createSession(identity, snapshot));
  if (new TextEncoder().encode(text).length > MAX_SESSION_BYTES) fail('session exceeds the 8 MiB limit');
  return text;
}

export function parseSession(text, identity) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SESSION_BYTES) fail('session exceeds the 8 MiB limit');
  let envelope;
  try { envelope = JSON.parse(text); } catch { fail('invalid JSON session'); }
  if (!record(envelope) || envelope.format !== SESSION_FORMAT || envelope.schema !== 1) fail('unsupported session format');
  sessionIdentity(identity);
  if (envelope.datasetId !== identity.datasetId || envelope.productFingerprint !== identity.productFingerprint) fail('session belongs to another dataset or product build');
  return validateSnapshot(envelope.snapshot);
}

// Validate completely before the single atomic storage replacement. A rejected
// import or QuotaExceededError leaves the old session available.
export function saveSession(storage, identity, snapshot) {
  const text = serializeSession(identity, snapshot);
  storage.setItem(sessionKey(identity), text);
}

export function importSession(storage, identity, text) {
  const snapshot = parseSession(text, identity);
  saveSession(storage, identity, snapshot);
  return snapshot;
}

export function loadSession(storage, identity) {
  const text = storage.getItem(sessionKey(identity));
  return text === null ? null : parseSession(text, identity);
}

// Defence in depth, installed before HA or product modules. The localhost
// server separately enforces GET/HEAD-only static routes and a restrictive CSP.
export function installNetworkGuard(win) {
  const safety = { blocked: [], services: [], ws: [], errors: [] };
  const recordBlock = kind => { safety.blocked.push(kind); if (safety.blocked.length > 200) safety.blocked.shift(); };
  const sameOrigin = value => {
    try { const url = new URL(value, win.location.href); return url.origin === win.location.origin && ['http:', 'https:'].includes(url.protocol); }
    catch { return false; }
  };
  const localBlob = value => { try { const url = new URL(value); return url.protocol === 'blob:' && url.origin === win.location.origin; } catch { return false; } };
  const blocked = kind => { recordBlock(kind); throw Error(`UI Lab: ${kind} disabled`); };
  const originalFetch = win.fetch.bind(win);
  win.fetch = (input, options) => {
    const request = typeof input === 'object' && input !== null && 'url' in input;
    const url = request ? input.url : input;
    const method = String(options?.method || (request && input.method) || 'GET').toUpperCase();
    if (!sameOrigin(url) || !['GET', 'HEAD'].includes(method)) {
      recordBlock('fetch'); return Promise.reject(Error('UI Lab: external or write request blocked'));
    }
    return originalFetch(input, options);
  };
  const originalXhrOpen = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (!sameOrigin(url) || !['GET', 'HEAD'].includes(String(method).toUpperCase())) return blocked('XHR external/write request');
    return originalXhrOpen.call(this, method, url, ...rest);
  };
  win.WebSocket = class { constructor() { blocked('WebSocket'); } };
  win.EventSource = class { constructor() { blocked('EventSource'); } };
  const originalOpen = win.open.bind(win);
  win.open = (url, ...args) => {
    if (!sameOrigin(url || '/') && !localBlob(url)) { recordBlock('navigation'); return null; }
    return originalOpen(url, ...args);
  };
  win.navigator.sendBeacon = () => { recordBlock('beacon'); return false; };
  if (win.navigator.serviceWorker) win.navigator.serviceWorker.register = () => {
    recordBlock('serviceWorker'); return Promise.reject(Error('UI Lab: service workers disabled'));
  };
  const preventExternalLink = event => {
    const anchor = event.composedPath().find(node => node?.tagName === 'A');
    if (anchor?.href && !sameOrigin(anchor.href) && !(anchor.download && localBlob(anchor.href))) {
      event.preventDefault(); recordBlock('navigation');
    }
  };
  win.document.addEventListener('click', preventExternalLink, true);
  win.document.addEventListener('auxclick', preventExternalLink, true);
  win.document.addEventListener('submit', event => {
    event.preventDefault(); recordBlock('form submission');
  }, true);
  for (const [event, format] of [['error', e => e.error?.stack || e.message], ['unhandledrejection', e => e.reason?.stack || e.reason]]) {
    win.addEventListener(event, e => { safety.errors.push(String(format(e))); if (safety.errors.length > 100) safety.errors.shift(); });
  }
  win.__labSafety = safety;
  return safety;
}
