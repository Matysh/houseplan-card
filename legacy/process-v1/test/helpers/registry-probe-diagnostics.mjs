// #1072: passive fixture evidence, never a change to the registry's deadlines.
import { availableParallelism, cpus } from 'node:os';
import { fetchRegistry } from '../../scripts/ci-proof-registry.mjs';

export function traceRegistryProbe(root, { gitOp, deadline = Date.now() + 8000 } = {}) {
  const operations = [], started = performance.now();
  let omitted = 0;
  const store = fetchRegistry(root, { deadline, gitOp(dir, args, options) {
    const before = performance.now();
    const entry = { step: ['fetch', 'rev-parse', 'show'].includes(args[0]) ? args[0] : 'other',
      timeoutMs: options.timeout, outcome: 'success' };
    try {
      const value = gitOp(dir, args, options);
      if (args[0] === 'show') {
        try { JSON.parse(value); entry.json = 'valid'; }
        catch { entry.json = 'invalid'; }
      }
      return value;
    } catch (error) {
      entry.outcome = 'error';
      entry.code = ['ETIMEDOUT', 'ENOENT', 'EACCES', 'EPERM', 'ENOBUFS'].includes(error?.code) ? error.code : 'other';
      entry.status = Number.isInteger(error?.status) ? error.status : null;
      entry.signal = ['SIGKILL', 'SIGTERM', 'SIGINT'].includes(error?.signal) ? error.signal : null;
      throw error;
    } finally {
      entry.durationMs = Math.round((performance.now() - before) * 100) / 100;
      entry.remainingMs = deadline - Date.now();
      if (operations.length < 16) operations.push(entry); else omitted++;
    }
  } });
  return { store, diagnostic() {
    return JSON.stringify({ schema: 'registry-fixture-probe/v1',
      environment: { node: process.version, platform: process.platform, arch: process.arch,
        availableParallelism: availableParallelism(), logicalCpus: cpus().length },
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      remainingMs: deadline - Date.now(), tipAvailable: store.tip !== null, operations, omitted });
  } };
}
