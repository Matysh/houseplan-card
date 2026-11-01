// #1116: bounded discovery reads only; no claims, labels, verdicts or dispatch.
import { retryingReadFetch } from './read-only-fetch.mjs';

export const DISCOVERY_BODY_BYTES = 8 * 1024 * 1024;
const endpointPattern = /^repos\/[\w.-]+\/[\w.-]+\/actions\/(?:runs\/[1-9]\d*|artifacts\?per_page=100)$/;
const safeReason = value => typeof value === 'string' && /^(?:http-[1-5]\d\d|malformed-json|invalid-utf8|invalid-response|response-too-large|invalid-endpoint|read-cancelled|transport-failed)$/.test(value || '') ? value : null;
const rejected = reason => Object.assign(new Error(reason), { discoveryReason: reason });

async function boundedJson(response) {
  // Do not parse an error response: gh can replace its HTTP status with a Go
  // JSON-decoder error when the upstream error body is empty or malformed.
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw rejected(`http-${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw rejected('malformed-json');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > DISCOVERY_BODY_BYTES) throw rejected('response-too-large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)); }
  catch { throw rejected('invalid-utf8'); }
  try { return JSON.parse(text); }
  catch { throw rejected('malformed-json'); }
}

export function discoveryJsonRead({ token = process.env.GH_TOKEN, fetchImpl = fetch, pause,
  signal = AbortSignal.timeout(30_000) } = {}) {
  // One retry boundary includes the response body. Known socket failures retain
  // #921's three attempts / 100,400ms; HTTP/JSON/size/deadline errors never retry.
  const read = retryingReadFetch(async (url, init) => boundedJson(await fetchImpl(url, init)), { pause });
  return endpoint => {
    if (!endpointPattern.test(endpoint)) throw rejected('invalid-endpoint');
    return read(`https://api.github.com/${endpoint}`, { method: 'GET', signal,
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  };
}

export async function continuationDiscovery(repo, eventId, read = discoveryJsonRead()) {
  const step = async (stage, endpoint, valid) => {
    try {
      const value = await read(endpoint);
      if (!valid(value)) throw rejected('invalid-response');
      return value;
    } catch (error) {
      // Never retain/log the original response, exception text or headers.
      const reason = safeReason(error?.discoveryReason) || (error?.name === 'AbortError' || error?.name === 'TimeoutError'
        ? 'read-cancelled' : 'transport-failed');
      throw Object.assign(new Error(`continuation discovery ${stage} GET ${endpoint}: ${reason}`),
        { discoveryStage: stage, discoveryEndpoint: endpoint, discoveryReason: reason });
    }
  };
  const event = eventId ? await step('event-run', `repos/${repo}/actions/runs/${eventId}`,
    value => value && !Array.isArray(value) && Number.isSafeInteger(value.id) && String(value.id) === String(eventId)) : null;
  const result = await step('artifact-list', `repos/${repo}/actions/artifacts?per_page=100`,
    value => value && !Array.isArray(value) && Array.isArray(value.artifacts)
      && value.artifacts.every(row => row && !Array.isArray(row) && typeof row.name === 'string' && typeof row.expired === 'boolean'));
  return { event, artifacts: result.artifacts };
}

export function discoveryFailure(error) {
  return { action: 'unverified', code: 'discovery-failed',
    stage: ['event-run', 'artifact-list'].includes(error?.discoveryStage) ? error.discoveryStage : 'input',
    endpoint: endpointPattern.test(error?.discoveryEndpoint || '') ? error.discoveryEndpoint : null,
    reason: safeReason(error?.discoveryReason) || 'invalid-input-or-read', authority: false };
}
