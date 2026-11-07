/** Browser-side diagnostic. RAF callbacks are proxies, not compositor proof.
 * Serialized by Playwright; keep this function independent of module imports. */
export async function collectModeTransitionSamples({ fixture = 'large-house-v1', samples = 1 } = {}) {
  const card = window.__hpModeDiagnosticCard || window.__card;
  if (!card || !card._editorRuntime) throw Error('Mode diagnostic requires a warm editor');
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const ready = async () => {
    const start = performance.now();
    while (card._modeTransitionBusy) {
      if (performance.now() - start > 5000) throw Error('Mode diagnostic did not settle');
      await frame();
    }
    await card.updateComplete;
    await frame(); await frame();
  };
  const rows = [];
  for (let sample = 0; sample < samples; sample++) {
    for (const [from, to] of [['view', 'plan'], ['plan', 'view'], ['view', 'devices'],
      ['devices', 'view'], ['view', 'decor'], ['decor', 'view'], ['plan', 'devices']]) {
      if (card._mode !== from) { card._setMode(from); await ready(); }
      await ready();
      const updates = [], frames = [], originals = {};
      const startBuilds = card._modeSceneBuilds ? { ...card._modeSceneBuilds } : null;
      let started = 0, endpoint = null, interactive = null, rafIndex = 0, sampling = true, raf = 0;
      const mark = 'hp-mode:' + fixture + ':' + sample + ':' + from + '-' + to;
      const pulse = () => { if (sampling) { rafIndex++; raf = requestAnimationFrame(pulse); } };
      raf = requestAnimationFrame(pulse);
      const stage = card._stageEl;
      const observer = new MutationObserver(() => {
        if (interactive === null && !stage.inert && !card._modeTransitionBusy) {
          interactive = performance.now();
          performance.mark(mark + ':interactive');
        }
      });
      observer.observe(stage, { attributes: true, attributeFilter: ['inert'] });
      originals.update = card.performUpdate;
      card.performUpdate = function (...args) {
        const at = performance.now();
        const result = originals.update.apply(this, args);
        updates.push({ at: at - started, ms: performance.now() - at });
        return result;
      };
      originals.frame = card._applyModeTransitionFrame;
      card._applyModeTransitionFrame = function (state) {
        const at = performance.now();
        const result = originals.frame.call(this, state);
        if (state.presented !== state.from) {
          frames.push({ at: performance.now() - started, rafIndex, controllerTime: at - started,
            phase: state.phase, paintJsMs: performance.now() - at });
          if (state.phase === 'settling') {
            endpoint = performance.now();
            performance.mark(mark + ':to');
          }
        }
        return result;
      };
      try {
        started = performance.now(); performance.mark(mark + ':start');
        card._setMode(to);
        await ready();
        const end = performance.now();
        const builds = startBuilds && Object.fromEntries(Object.entries(card._modeSceneBuilds)
          .map(([key, value]) => [key, value - (startBuilds[key] || 0)]));
        rows.push({ fixture, sample, from, to, firstMotionMs: frames[0]?.at ?? null,
          firstMotionRaf: frames[0]?.rafIndex ?? null, rafSamples: frames.length,
          maxFrameGapMs: frames.length > 1 ? Math.max(...frames.slice(1)
            .map((value, index) => value.controllerTime - frames[index].controllerTime)) : null,
          toTickMs: endpoint === null ? null : endpoint - started,
          afterToInteractiveMs: endpoint === null || interactive === null ? null : interactive - endpoint,
          afterToReadyMs: endpoint === null ? null : end - endpoint,
          finalUpdates: endpoint === null ? null : updates.filter(value => value.at >= endpoint - started).length,
          updates, frames, partBuilds: builds, inertAfter: stage.inert,
          sceneNodes: card.renderRoot.querySelectorAll('.zoomwrap *').length });
      } finally {
        observer.disconnect(); sampling = false; cancelAnimationFrame(raf);
        card.performUpdate = originals.update;
        card._applyModeTransitionFrame = originals.frame;
      }
    }
  }
  return { status: 'measured', diagnostic: true, reducedMotion: false,
    cadence: 'RAF callbacks are proxies; presented frames require an addressed trace',
    interactive: 'MutationObserver observes inert removal after the final commit',
    samples, fixture, rows };
}
