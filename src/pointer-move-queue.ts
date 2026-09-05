interface QueuedMove { run: () => void }

const moveQueues = new WeakMap<object, Map<string, QueuedMove>>();

/**
 * Keep only the latest raw move from one browser event turn.
 *
 * Gesture state must be current before a following pointerup/cancel is handled:
 * postponing the input itself until requestAnimationFrame lets the terminal
 * event clear that state first.  The live renderer still coalesces the paint
 * to one animation frame; this queue only coalesces the state calculation.
 */
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
  const entry: QueuedMove = { run };
  queues.set(key, entry);
  queueMicrotask(() => {
    if (queues!.get(key) !== entry) return;
    queues!.delete(key);
    entry.run();
  });
}

export function flushHouseplanPointerMove(host: object, key: string): void {
  const queues = moveQueues.get(host);
  const queued = queues?.get(key);
  if (!queued) return;
  queues!.delete(key);
  queued.run();
}

export function cancelHouseplanPointerMove(host: object, key?: string): void {
  const queues = moveQueues.get(host);
  if (!queues) return;
  const entries = key ? [...queues].filter(([name]) => name === key) : [...queues];
  for (const [name] of entries) queues.delete(name);
  if (!queues.size) moveQueues.delete(host);
}
