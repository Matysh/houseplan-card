// #1065: the model selects a declared check, never an executable or argv.
// MCP 2025-06-18: basic/transports (stdio), basic/lifecycle and utilities/cancellation.
import { readFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';

export const REVIEW_MCP_PROTOCOL = '2025-06-18';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' || Number.isSafeInteger(value);
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const failure = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/** JSON-RPC/MCP transport. Cancellation reaches only the active owned check. */
export function createReviewCheckServer({ definition, execute, send, onError = () => {} }) {
  if (!object(definition) || definition.name !== 'run_check' || typeof execute !== 'function') throw new Error('invalid review server configuration');
  let initialized = false, ready = false, closed = false, active = null, activePromise;
  const queue = [], pending = new Map();
  const reply = value => { if (!closed) send(value); };
  const finish = async job => {
    active = job;
    try {
      const receipt = await execute({ checkId: job.checkId, signal: job.controller.signal });
      if (!object(receipt) || receipt.schema !== 'houseplan-review-check-result/v1') throw new Error('invalid check receipt');
      if (!job.cancelled) reply({ jsonrpc: '2.0', id: job.id, result: {
        content: [{ type: 'text', text: JSON.stringify(receipt) }], structuredContent: receipt,
        ...(receipt.executed !== true || receipt.exitCode !== 0 ? { isError: true } : {}),
      } });
    } catch {
      // Never reflect child output, source text, credentials or exception text.
      if (!job.cancelled) reply(failure(job.id, -32603, 'review check could not produce a valid receipt'));
      onError('check-receipt-unavailable');
    } finally {
      pending.delete(job.id); active = null; drain();
    }
  };
  const drain = () => { if (!closed && !active && queue.length) activePromise = finish(queue.shift()); };
  const receive = message => {
    if (closed) return;
    if (!object(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string'
      || Object.hasOwn(message, 'id') && !validId(message.id)) {
      reply(failure(null, -32600, 'invalid JSON-RPC request')); return;
    }
    const notification = !Object.hasOwn(message, 'id');
    if (message.method === 'notifications/cancelled' && notification) {
      const id = message.params?.requestId, job = pending.get(id);
      if (!job) return;
      job.cancelled = true; job.controller.abort();
      if (job !== active) {
        queue.splice(queue.indexOf(job), 1); pending.delete(id);
      }
      return;
    }
    if (notification) {
      if (message.method === 'notifications/initialized' && initialized) ready = true;
      return;
    }
    const id = message.id;
    if (pending.has(id)) { reply(failure(id, -32600, 'duplicate active request id')); return; }
    if (message.method === 'ping') { reply({ jsonrpc: '2.0', id, result: {} }); return; }
    if (message.method === 'initialize') {
      if (initialized || !object(message.params) || typeof message.params.protocolVersion !== 'string'
        || !object(message.params.capabilities) || !object(message.params.clientInfo)
        || typeof message.params.clientInfo.name !== 'string' || typeof message.params.clientInfo.version !== 'string') {
        reply(failure(id, -32602, 'invalid initialization')); return;
      }
      initialized = true;
      reply({ jsonrpc: '2.0', id, result: { protocolVersion: REVIEW_MCP_PROTOCOL,
        capabilities: { tools: {} }, serverInfo: { name: 'houseplan-review-checks', version: '1' } } }); return;
    }
    if (!ready) { reply(failure(id, -32002, 'server is not initialized')); return; }
    if (message.method === 'tools/list') {
      if (message.params?.cursor !== undefined) { reply(failure(id, -32602, 'pagination is not supported')); return; }
      reply({ jsonrpc: '2.0', id, result: { tools: [definition] } }); return;
    }
    if (message.method !== 'tools/call') { reply(failure(id, -32601, 'method is not supported')); return; }
    const params = message.params, args = params?.arguments;
    if (!only(params, ['name', 'arguments', '_meta']) || params.name !== definition.name
      || params._meta !== undefined && !object(params._meta) || !only(args, ['check_id'])
      || typeof args.check_id !== 'string' || !args.check_id.length || args.check_id.length > 256) {
      reply(failure(id, -32602, 'expected run_check with one check_id')); return;
    }
    if (pending.size >= 128) { reply(failure(id, -32000, 'review check queue is full')); return; }
    const job = { id, checkId: args.check_id, controller: new AbortController(), cancelled: false };
    pending.set(id, job); queue.push(job); drain();
  };
  return {
    receive,
    parseError() { reply(failure(null, -32700, 'invalid JSON')); },
    close() {
      closed = true; active?.controller.abort(); queue.length = 0; pending.clear();
      return activePromise;
    },
  };
}

export async function startReviewCheckServer({ policyPath, input = process.stdin, output = process.stdout,
  maxLineBytes = 1024 * 1024 }, dependencies = {}) {
  const capabilities = dependencies.capabilities ?? await import('./review-capabilities.mjs');
  const executor = dependencies.executor ?? await import('./review-approved-check.mjs');
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  const manifest = capabilities.readReviewCapabilities(policy);
  const definition = capabilities.reviewCheckToolDefinition(manifest);
  const server = createReviewCheckServer({ definition,
    execute: ({ checkId, signal }) => executor.runApprovedCheck({ policyPath, checkId, signal }),
    send: message => output.write(JSON.stringify(message) + '\n'),
  });
  let buffer = Buffer.alloc(0), failed = false;
  const stop = () => { failed = true; server.close(); };
  const outputError = () => { stop(); input.destroy?.(); };
  output.on('error', outputError);
  try {
    for await (const chunk of input) {
      if (failed) break;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      let end;
      while ((end = buffer.indexOf(10)) !== -1) {
        const line = buffer.subarray(0, end); buffer = buffer.subarray(end + 1);
        if (line.length > maxLineBytes) { stop(); break; }
        if (!line.length) continue;
        try { server.receive(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line))); }
        catch { server.parseError(); }
      }
      if (buffer.length > maxLineBytes) stop();
      if (failed) break;
    }
    // A partial final frame never dispatches, even when it contains valid JSON.
    if (buffer.length && !failed) server.parseError();
  } finally {
    await server.close();
    output.off('error', outputError);
  }
  if (failed) throw new Error('review MCP transport failed or exceeded its bound');
}

if (isMainModule(import.meta.url)) {
  if (process.argv.length !== 3) { console.error('review check server: expected policy path'); process.exitCode = 1; }
  else startReviewCheckServer({ policyPath: process.argv[2] }).catch(() => {
    console.error('review check server unavailable'); process.exitCode = 1;
  });
}
