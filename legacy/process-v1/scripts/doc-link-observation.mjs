// Passive metadata only: the fetch, dispatcher, method and deadline are unchanged.
import { channel } from 'node:diagnostics_channel';

const CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'ENETUNREACH', 'EHOSTUNREACH', 'ABORT_ERR', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
const errorCode = error => CODES.has(error?.code) ? error.code : CODES.has(error?.cause?.code) ? error.cause.code : null;
export function publicLink(value, base) {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? (url.origin + url.pathname).slice(0, 1024) : null;
  } catch { return null; }
}

export async function observeDocLink(url, onTrace = () => {}, { fetchImpl = fetch } = {}) {
  const started = performance.now(), target = new URL(url);
  const origins = new Set([target.origin]), hosts = new Set([target.hostname]);
  const requests = new WeakMap(), subscriptions = [], sockets = [];
  let nextRequest = 0;
  const trace = { schema: 'houseplan-doc-link/v1', url: publicLink(url), method: 'HEAD',
    redirect: 'follow', timeoutMs: 8000, events: [], omitted: 0 };
  const record = (phase, fields = {}) => {
    trace.lastPhase = phase;
    if (trace.events.length < 64) trace.events.push({ phase, ms: Math.round((performance.now() - started) * 100) / 100, ...fields });
    else trace.omitted++;
  };
  const listen = (name, callback) => {
    const entry = channel(name), safe = value => { try { callback(value); } catch { trace.observerError = true; } };
    entry.subscribe(safe); subscriptions.push(() => entry.unsubscribe(safe));
  };
  listen('undici:request:create', ({ request }) => {
    if (!origins.has(String(request.origin))) return;
    requests.set(request, ++nextRequest); record('request', { request: nextRequest, url: publicLink(request.path, request.origin) });
  });
  listen('undici:client:beforeConnect', ({ connectParams }) => {
    if (hosts.has(connectParams.hostname)) record('connect-start', { host: connectParams.hostname.slice(0, 253) });
  });
  listen('net.client.socket', ({ socket }) => {
    if (sockets.length >= 32) return;
    let tracked = false;
    const handlers = {
      lookup(error, _address, family, host) {
        tracked = hosts.has(host);
        if (tracked) record('dns', { host: host.slice(0, 253), family: [4, 6].includes(family) ? family : null, code: errorCode(error) });
      },
      connect() { if (tracked) record('tcp-connected'); },
      secureConnect() { if (tracked) record('tls-connected'); },
    };
    for (const [name, callback] of Object.entries(handlers)) socket.on(name, callback);
    sockets.push(() => { for (const [name, callback] of Object.entries(handlers)) socket.removeListener(name, callback); });
  });
  listen('undici:client:connected', ({ connectParams }) => {
    if (hosts.has(connectParams.hostname)) record('connection-ready', { host: connectParams.hostname.slice(0, 253) });
  });
  listen('undici:client:connectError', ({ connectParams, error }) => {
    if (hosts.has(connectParams.hostname)) record('connect-error', { host: connectParams.hostname.slice(0, 253), code: errorCode(error) });
  });
  listen('undici:client:sendHeaders', ({ request }) => {
    if (requests.has(request)) record('headers-sent', { request: requests.get(request) });
  });
  listen('undici:request:headers', ({ request, response }) => {
    if (!requests.has(request)) return;
    let location = null;
    if (Array.isArray(response.headers)) for (let i = 0; i < response.headers.length; i += 2) {
      if (String(response.headers[i]).toLowerCase() === 'location') location = String(response.headers[i + 1]);
    }
    const base = new URL(request.path, request.origin);
    const destination = location === null ? null : publicLink(location, base);
    if (destination && [301, 302, 303, 307, 308].includes(response.statusCode)) {
      const next = new URL(destination); origins.add(next.origin); hosts.add(next.hostname);
    }
    record('response-headers', { request: requests.get(request), url: publicLink(base), status: response.statusCode, location: destination });
  });
  listen('undici:request:error', ({ request, error }) => {
    if (requests.has(request)) record('request-error', { request: requests.get(request), code: errorCode(error) });
  });
  try {
    const response = await fetchImpl(url, {
      method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'houseplan-docs-check/1' },
    });
    trace.status = response.status; trace.finalUrl = publicLink(response.url);
    return response;
  } catch (error) {
    trace.failure = { name: ['TimeoutError', 'AbortError', 'TypeError', 'Error'].includes(error?.name) ? error.name : 'other', code: errorCode(error) };
    throw error;
  } finally {
    for (const remove of [...subscriptions, ...sockets]) remove();
    trace.elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    try { onTrace(trace); } catch { /* Diagnostics never change the result. */ }
  }
}
