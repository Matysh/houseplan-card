/* Paste into Chrome DevTools on the House Plan page in 2.5D. The probe
 * observes normal input and paint. It sends no requests and saves nothing. */
(() => {
  function findStage(root) {
    const found = root.querySelector('.stage.projection-iso');
    if (found) return found;
    for (const element of root.querySelectorAll('*')) {
      const stage = element.shadowRoot && findStage(element.shadowRoot);
      if (stage) return stage;
    }
  }

  const results = [];
  let active = false;
  window.houseplanIsoCameraProbe = {
    results,
    async measure(scenario, durationMs = 3500) {
      if (active) throw Error('A House Plan capture is already running');
      const stage = findStage(document);
      if (!stage) throw Error('Open the House Plan page in 2.5D before measuring');
      const rect = stage.getBoundingClientRect();
      const environment = { width: rect.width, height: rect.height, dpr: devicePixelRatio,
        browser: navigator.userAgent, visibility: document.visibilityState };
      active = true;
      console.info(`${scenario}: begin in 3 seconds. Return focus to House Plan.`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      const start = performance.now();
      const card = stage.getRootNode().host;
      const gaps = [], wheel = [], viewBox = [], camera = [];
      let issued = 0;
      const onWheel = event => {
        if (!event.isTrusted) return;
        const before = card?._cameraTransition?.state?.token;
        const input = { sequence: ++issued, ms: performance.now() - start,
          eventMs: event.timeStamp - start, deltaY: event.deltaY, mode: event.deltaMode };
        queueMicrotask(() => {
          const motion = card?._cameraTransition?.state;
          wheel.push({ ...input, accepted: motion?.token !== undefined && motion.token !== before });
        });
      };
      const observer = new MutationObserver(records => {
        for (const record of records) viewBox.push({ ms: performance.now() - start,
          projection: record.target.getAttribute('data-projection') });
      });
      for (const node of stage.querySelectorAll('svg[data-hp-live-viewbox]')) {
        observer.observe(node, { attributes: true, attributeFilter: ['viewBox'] });
      }
      let raf, previous;
      const tick = timestamp => {
        if (previous !== undefined) gaps.push(timestamp - previous);
        camera.push({ ms: performance.now() - start, zoom: card?._zoom,
          active: card?._cameraTransition?.active === true });
        previous = timestamp;
        raf = requestAnimationFrame(tick);
      };
      stage.addEventListener('wheel', onWheel, { capture: true, passive: true });
      raf = requestAnimationFrame(tick);
      console.info(`${scenario}: start`);
      try {
        await new Promise(resolve => setTimeout(resolve, durationMs));
        const duration = performance.now() - start;
        const sorted = [...gaps].sort((a, b) => a - b);
        const raster = performance.getEntriesByType('mark').filter(entry =>
          entry.startTime >= start && entry.name.startsWith('houseplan.iso.raster.'))
          .map(({ name, startTime, detail }) => ({ event: name.split('.').at(-1), ms: startTime - start, detail }));
        const result = { scenario, environment, durationMs: duration,
          fps: gaps.length * 1000 / duration, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
          maxMs: sorted.at(-1), gaps, wheel, viewBox, camera, raster };
        results.push(result);
        console.table([{ scenario, fps: result.fps, p95Ms: result.p95Ms, maxMs: result.maxMs,
          deliveredWheel: wheel.length, acceptedWheel: wheel.filter(input => input.accepted).length, viewBoxWrites: viewBox.length }]);
        return result;
      } finally {
        cancelAnimationFrame(raf);
        observer.disconnect();
        stage.removeEventListener('wheel', onWheel, true);
        active = false;
      }
    },
  };
})();
