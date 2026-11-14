import { planHostFrom } from './ha-plan-host';
import type { HouseplanCommand, PlanHost } from './plan-host';

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
  /** A submitted response may remain adoptable after its editor closes;
   * staging never authorizes dispatch from a retired gesture. */
  canDispatch?(): boolean;
  signal?: AbortSignal;
  /** Evidence for the owning operation; uploading a temporary body is not commit. */
  onDispatch?(): void;
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
  input: HouseplanWriteHass | PlanHost, message: HouseplanWriteMessage, options: HouseplanWriteOptions,
): Promise<T> {
  const host = planHostFrom(input);
  if (!host.environment.ready || !host.environment.connected) throw error('not_ready');
  const authority = host.authorityKey, revision = host.writeAuthorityRevision;
  const assertCurrent = () => {
    if (options.signal?.aborted) throw new DOMException('Houseplan write cancelled', 'AbortError');
    const current = planHostFrom(input);
    if (!options.isCurrent() || current.authorityKey !== authority || current.writeAuthorityRevision !== revision) {
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
  const assertDispatch = () => {
    assertCurrent();
    if (!host.environment.connected || options.canDispatch && !options.canDispatch()) throw error('context-changed');
  };
  assertDispatch();
  if (bytes <= WS_DIRECT_LIMIT_BYTES) {
    options.onDispatch?.();
    return current(host.request<T>(snapshot as HouseplanCommand));
  }

  const reply = await current(host.http.postJson(STRUCTURAL_UPLOAD_PATH, snapshot, options.signal));
  assertCurrent();
  const staged = uploadReply(reply, snapshot.type);
  const compact: HouseplanWriteMessage = {
    type: snapshot.type, upload_token: staged.token, upload_sha256: staged.sha256,
  };
  for (const key of CONTROL_KEYS) if (own(snapshot, key)) compact[key] = snapshot[key];
  if (new TextEncoder().encode(JSON.stringify(compact)).byteLength > WS_DIRECT_LIMIT_BYTES) throw error('too_large');
  assertDispatch();
  options.onDispatch?.();
  return current(host.request<T>(compact as HouseplanCommand));
}
