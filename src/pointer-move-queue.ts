interface QueuedMove { raf: number; run: () => void }

const moveQueues = new WeakMap<object, Map<string, QueuedMove>>();

/** Keep only the latest raw move of each active gesture between two frames. */
export function queueHouseplanPointerMove(host: object, key: string, run: () => void): void {
  let queues = moveQueues.get(host);
  if (!queues) {
    queues = new Map();
    moveQueues.set(host, queues);
  }
  const queued = queues.get(key);
  if (queued) {
    queued.run = run;
    return;
  }
  const entry: QueuedMove = { raf: 0, run };
  queues.set(key, entry);
  if (typeof requestAnimationFrame !== 'function') {
    queues.delete(key);
    run();
    return;
  }
  entry.raf = requestAnimationFrame(() => {
    queues!.delete(key);
    entry.run();
  });
}

export function flushHouseplanPointerMove(host: object, key: string): void {
  const queues = moveQueues.get(host);
  const queued = queues?.get(key);
  if (!queued) return;
  if (queued.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(queued.raf);
  queues!.delete(key);
  queued.run();
}

export function cancelHouseplanPointerMove(host: object, key?: string): void {
  const queues = moveQueues.get(host);
  if (!queues) return;
  const entries = key ? [...queues].filter(([name]) => name === key) : [...queues];
  for (const [name, queued] of entries) {
    if (queued.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(queued.raf);
    queues.delete(name);
  }
  if (!queues.size) moveQueues.delete(host);
}
