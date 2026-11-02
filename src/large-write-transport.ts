/** Bounded transport only: upload tokens never replace server ACL/CAS/domain validation. */
export const WS_DIRECT_LIMIT_BYTES = 3 * 1024 * 1024;
export const STRUCTURAL_UPLOAD_LIMIT_BYTES = 32 * 1024 * 1024;
export const STRUCTURAL_UPLOAD_PATH = '/api/houseplan/structural/upload';

export interface HouseplanWriteHass {
  connection?: unknown;
  user?: { id?: string };
  callWS<T>(message: HouseplanWriteMessage): Promise<T>;
  fetchWithAuth?(path: string, init?: RequestInit): Promise<Response>;
  callApi?<T>(method: 'POST', path: string, parameters?: Record<string, unknown>): Promise<T>;
}
export interface HouseplanWriteOptions {
  /** Must fence the live host/operation generation, including A -> B -> A changes. */
  isCurrent(): boolean;
  signal?: AbortSignal;
}
export type HouseplanWriteMessage = Record<string, unknown> & { type: string };

const PURPOSES = new Set([
  'houseplan/config/set', 'houseplan/plan/optimize', 'houseplan/plan/optimize_undo',
  'houseplan/wall/node_move', 'houseplan/wall/node_delete', 'houseplan/marker/copy',
  'houseplan/marker/history', 'houseplan/layout/set', 'houseplan/layout/update',
]);
const CONTROL_KEYS = ['expected_rev', 'expected_config_rev', 'expected_layout_rev', 'direction', 'action', 'space_id'] as const;
type UploadReply = { token: string; sha256: string; purpose: string; expires_at: string };
const error = (code: string) => Object.assign(new Error(code), { code });
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function responseError(data: unknown, status?: number): Error & { code: string } {
  if (status === 401 || status === 403) return error('unauthorized');
  if (status === 413) return error('too_large');
  const code = object(data) ? data.error ?? data.code : undefined;
  return error(typeof code === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(code)
    ? code : status === 404 ? 'upload_unavailable' : 'upload_failed');
}
function uploadReply(data: unknown, purpose: string): UploadReply {
  if (!object(data) || typeof data.token !== 'string' || !data.token || data.token.length > 512
      || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sha256)
      || data.purpose !== purpose || typeof data.expires_at !== 'string'
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(data.expires_at)) {
    throw error('invalid_upload');
  }
  const expires = Date.parse(data.expires_at);
  if (!Number.isFinite(expires) || expires <= Date.now()) throw error('upload_expired');
  return data as UploadReply;
}

/**
 * Same command/result contract as callWS; only the byte transport changes.
 * Small messages use WS. Larger messages stage the exact detached JSON without
 * transport id, then echo its server digest and original control fields in WS.
 * HA owns auth refresh. No access token is read, logged or stored here.
 */
export async function sendHouseplanWrite<T = unknown>(
  hass: HouseplanWriteHass, message: HouseplanWriteMessage, options: HouseplanWriteOptions,
): Promise<T> {
  if (!hass || typeof hass.callWS !== 'function') throw error('not_ready');
  const authority = hass.connection ?? hass.callWS, user = hass.user?.id;
  const callWS = hass.callWS.bind(hass) as HouseplanWriteHass['callWS'];
  const fetchWithAuth = hass.fetchWithAuth?.bind(hass), callApi = hass.callApi?.bind(hass);
  const assertCurrent = () => {
    if (options.signal?.aborted) throw new DOMException('Houseplan write cancelled', 'AbortError');
    if (!options.isCurrent() || (hass.connection ?? hass.callWS) !== authority || hass.user?.id !== user) {
      throw error('context-changed');
    }
  };
  // Rejections are fenced too: a foreign response/error must not affect the new host.
  const current = async <R>(pending: Promise<R>): Promise<R> => {
    try { const result = await pending; assertCurrent(); return result; }
    catch (failure) { assertCurrent(); throw failure; }
  };
  assertCurrent();
  if (!object(message) || !PURPOSES.has(message.type)
      || own(message, 'upload_token') || own(message, 'upload_sha256')) {
    throw error('invalid_payload');
  }
  let body: string, snapshot: HouseplanWriteMessage;
  try {
    const { id: _transportId, ...payload } = message;
    body = JSON.stringify(payload);
    snapshot = JSON.parse(body);
    if (!object(snapshot) || snapshot.type !== message.type) throw error('invalid_payload');
  } catch { throw error('invalid_payload'); }
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes > STRUCTURAL_UPLOAD_LIMIT_BYTES) throw error('too_large');
  assertCurrent();
  if (bytes <= WS_DIRECT_LIMIT_BYTES) return current(callWS<T>(snapshot));

  let reply: unknown;
  if (fetchWithAuth) {
    // Preserve HA's receiver/auth context instead of falling back to a raw bearer.
    const response = await current(fetchWithAuth(STRUCTURAL_UPLOAD_PATH, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: options.signal,
    }));
    let data: unknown;
    try { data = await current(response.json()); }
    catch (failure) {
      assertCurrent();
      if ((failure as Error)?.name === 'AbortError') throw failure;
      throw responseError(undefined, response.status);
    }
    if (!response.ok) throw responseError(data, response.status);
    reply = data;
  } else if (callApi) {
    // HA callApi prefixes /api/, serializes JSON and performs its own auth refresh.
    // It has no AbortSignal argument; the completion fence still prevents WS commit.
    try { reply = await current(callApi('POST', 'houseplan/structural/upload', snapshot)); }
    catch (failure) {
      assertCurrent();
      const http = failure as { status_code?: number; body?: unknown };
      if (http?.status_code !== undefined || http?.body !== undefined) throw responseError(http.body, http.status_code);
      throw failure;
    }
  } else throw error('upload_unavailable');
  assertCurrent();
  const staged = uploadReply(reply, snapshot.type);
  const compact: HouseplanWriteMessage = {
    type: snapshot.type, upload_token: staged.token, upload_sha256: staged.sha256,
  };
  for (const key of CONTROL_KEYS) if (own(snapshot, key)) compact[key] = snapshot[key];
  if (new TextEncoder().encode(JSON.stringify(compact)).byteLength > WS_DIRECT_LIMIT_BYTES) throw error('too_large');
  assertCurrent();
  return current(callWS<T>(compact));
}
