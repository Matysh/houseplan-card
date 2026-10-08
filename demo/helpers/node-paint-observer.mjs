/**
 * Test-only, phase-aware upper bound on a synchronous DOM update's next paint
 * opportunity. A producer already inside rAF finishes before that frame paints:
 * its next rAF is post-paint. A task/microtask producer's first rAF may precede
 * its first paint, so it needs the second. Neither observer paces native input.
 * Always retain the unconditional two-rAF diagnostic for before/after audits.
 */
export function installNodePaintObserver(view = globalThis) {
  const originalRaf = view.requestAnimationFrame;
  let depth = 0;
  function observedRaf(callback, ...args) {
    return originalRaf.call(this, function (...callbackArgs) {
      depth++;
      try { return callback.apply(this, callbackArgs); }
      finally { depth--; }
    }, ...args);
  }
  const observer = {
    measure(onMeasurement) {
      const producerWasRaf = depth > 0;
      let first = null, second = null, cancelled = false;
      first = view.requestAnimationFrame(() => {
        first = null;
        const firstRaf = view.performance.now();
        second = view.requestAnimationFrame(() => {
          second = null;
          if (cancelled) return;
          const twoRafOpportunity = view.performance.now();
          onMeasurement({ producerWasRaf, firstRaf, twoRafOpportunity,
            paintOpportunity: producerWasRaf ? firstRaf : twoRafOpportunity });
        });
      });
      return () => {
        cancelled = true;
        if (first !== null) view.cancelAnimationFrame(first);
        if (second !== null) view.cancelAnimationFrame(second);
      };
    },
    restore() {
      if (view.requestAnimationFrame === observedRaf) view.requestAnimationFrame = originalRaf;
    },
  };
  // Diagnostic harness surface only: never enters the shipped bundle or alters
  // the card's config, gesture, validation result, native RAF ID or cancel API.
  view.requestAnimationFrame = observedRaf;
  view.__hpNodePaintObserver = observer;
  return observer;
}
