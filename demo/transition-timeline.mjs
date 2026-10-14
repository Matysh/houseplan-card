// Observation only: no timers, retries, style flushes or product hooks.
export function transitionOutcome(events, { card, kind, phase, startedAt, deadlineMs = 750 }) {
  const rows = events.filter(row => row.card === card && row.kind === kind && row.phase === phase);
  const run = rows.find(row => row.event === 'transitionrun');
  const end = rows.find(row => row.event === 'transitionend' && row.node === run?.node);
  let cause = null;
  if (!run) cause = 'missing-transitionrun';
  else if (run.listenerAt > startedAt) cause = 'listener-attached-late';
  else if (!end) cause = 'missing-transitionend';
  else if (end.deliveredAt > startedAt + deadlineMs) cause = 'delivered-after-deadline';
  else if (Math.abs(end.elapsed - 0.5) >= 0.01) cause = 'unexpected-native-duration';
  return { passed: cause === null, cause, card, kind, phase, startedAt, deadlineMs, rows };
}
