/** Browser-side diagnostic. RAF callbacks are proxies, not compositor proof.
 * Serialized by Playwright; keep this function independent of module imports. */
export async function collectModeTransitionSamples({ fixture = 'large-house-v1', samples = 1, coldTarget = null, afterFloorSwitch = false } = {}) {
  const card = window.__hpModeDiagnosticCard || window.__card;
  if (coldTarget) {
    if (!card?._editorRuntimeLoader || card._mode !== 'view' || card._editorRuntime
        || performance.getEntriesByType('resource').some(entry => entry.name.includes('/houseplan-editor-runtime'))) {
      throw Error('Cold diagnostic requires an untouched View and unloaded module');
    }
  } else if (!card?._editorRuntime) throw Error('Mode diagnostic requires a warm editor');
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const ready = async (expected = card._mode) => {
    const start = performance.now();
    while (card._mode !== expected || card._modeTransitionBusy || card._stageEl?.inert) {
      if (performance.now() - start > 5000) throw Error('Mode diagnostic did not settle');
      await frame();
    }
    await card.updateComplete;
    await frame(); await frame();
  };
  const rows = [], initialMode = card._mode;
  const transitions = coldTarget || afterFloorSwitch ? [['view', coldTarget ?? 'plan']] : [['view', 'plan'], ['plan', 'view'],
    ['view', 'devices'], ['devices', 'view'], ['view', 'decor'], ['decor', 'view'], ['plan', 'devices']];
  const buildCounts = () => ({ ...card._modeSceneBuilds, ...Object.fromEntries(
    Object.entries(card._editorRuntime?.modeSceneBuilds ?? {}).map(([key, value]) => ['editor:' + key, value])) });
  try {
  for (let sample = 0; sample < (coldTarget ? 1 : samples); sample++) {
    for (const [from, to] of transitions) {
      if (card._mode !== from) { card._setMode(from); await ready(); }
      await ready();
      const updates = [], frames = [], originals = {};
      const longTasks = [];
      const loaderOptions = coldTarget ? card._editorRuntimeLoader.options : null;
      let taskObserver, moduleLoadMs = null, runtimeReadyMs = null;
      if (loaderOptions) {
        const load = originals.load = loaderOptions.load;
        loaderOptions.load = async function (...args) {
          const at = performance.now();
          try {
            const module = await load.apply(this, args);
            if (!module.prepare) return module;
            return { ...module, async prepare(...prepareArgs) {
              const before = performance.now();
              try { return await module.prepare(...prepareArgs); }
              finally { moduleLoadMs += performance.now() - before; }
            } };
          } finally {
            moduleLoadMs = (moduleLoadMs ?? 0) + performance.now() - at;
          }
        };
        const ensure = originals.ensure = card._ensureEditorRuntime;
        card._ensureEditorRuntime = async function (...args) {
          const ready = await ensure.apply(this, args);
          runtimeReadyMs = performance.now() - started;
          return ready;
        };
        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          taskObserver = new PerformanceObserver(list => longTasks.push(...list.getEntries()));
          taskObserver.observe({ type: 'longtask' });
        }
      }
      const startBuilds = card._modeSceneBuilds || card._editorRuntime?.modeSceneBuilds ? buildCounts() : null;
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
        const visual = state.presented, from = state.from;
        const changed = visual.headerHeight !== from.headerHeight || visual.stageHeight !== from.stageHeight
          || visual.viewWeight !== from.viewWeight || visual.planWeight !== from.planWeight
          || visual.editorWeight !== from.editorWeight
          || visual.viewport.centerX !== from.viewport.centerX || visual.viewport.centerY !== from.viewport.centerY
          || visual.viewport.pixelsPerUnit !== from.viewport.pixelsPerUnit;
        // A new interpolated object at raw=0 is still the unchanged source frame.
        if (changed || state.phase === 'settling') {
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
        if (coldTarget || afterFloorSwitch) {
          const button = card.renderRoot.querySelector('[data-hp="mode-tab"][data-mode="' + to + '"]');
          if (!button) throw Error('Editor navigation is not available');
          button.click();
        } else card._setMode(to);
        await ready(to);
        const end = performance.now();
        if (taskObserver) longTasks.push(...taskObserver.takeRecords());
        const builds = startBuilds && Object.fromEntries(Object.entries(buildCounts())
          .map(([key, value]) => [key, value - (startBuilds[key] || 0)]));
        rows.push({ fixture, sample, from, to, firstMotionMs: frames[0]?.at ?? null,
          firstMotionRaf: frames[0]?.rafIndex ?? null, rafSamples: frames.length,
          maxFrameGapMs: frames.length > 1 ? Math.max(...frames.slice(1)
            .map((value, index) => value.controllerTime - frames[index].controllerTime)) : null,
          toTickMs: endpoint === null ? null : endpoint - started,
          afterToInteractiveMs: endpoint === null || interactive === null ? null : interactive - endpoint,
          afterToReadyMs: endpoint === null ? null : end - endpoint,
          finalUpdates: endpoint === null ? null : updates.filter(value => value.at >= endpoint - started).length,
          updates, frames, partBuilds: builds, inertAfter: card._stageEl.inert,
          ...(coldTarget ? { moduleLoadMs, runtimeReadyMs, settledMs: end - started,
            firstLongTaskMs: longTasks.find(task => task.startTime + task.duration >= started)?.duration ?? null } : {}),
          sceneNodes: card.renderRoot.querySelectorAll('.zoomwrap *').length });
      } finally {
        observer.disconnect(); sampling = false; cancelAnimationFrame(raf);
        card.performUpdate = originals.update;
        card._applyModeTransitionFrame = originals.frame;
        taskObserver?.disconnect();
        if (loaderOptions) {
          loaderOptions.load = originals.load;
          card._ensureEditorRuntime = originals.ensure;
        }
      }
    }
  }
  } finally {
    if (!coldTarget && card._mode !== initialMode) { card._setMode(initialMode); await ready(); }
  }
  return { status: 'measured', diagnostic: true, reducedMotion: false,
    cadence: 'RAF callbacks are proxies; presented frames require an addressed trace',
    interactive: 'MutationObserver observes inert removal after the final commit',
    samples: coldTarget ? 1 : samples, fixture, rows };
}
