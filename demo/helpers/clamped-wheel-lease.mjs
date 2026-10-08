/** #825: judge observed phases, not Node wall time or an invented late origin. */
export function clampedWheelVerdict({ before, during, deadline, idle }) {
  const stable = row => row.scale === before.scale && row.cache === before.cache;
  return {
    'clamped wheel during coarse does not cancel the current lease': during.coarse,
    'clamped wheel does not extend the original lease': !deadline.coarse,
    'clamped wheel leaves scale unchanged': [during, deadline, idle].every(stable),
    'clamped wheel neither enters coarse nor extends its deadline': !idle.coarse,
  };
}

/** Only this page context owns the clock; finally restores observation hooks. */
export async function observeClampedWheelLease(page, point) {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.evaluate(() => {
    const probe = window.__clampProbe = { timers: new Map(), events: [], fired: [] };
    probe.originalTimeout = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => {
      const at = performance.now();
      const id = probe.originalTimeout(() => {
        if (delay === 160) probe.fired.push({ id, at: performance.now() });
        callback(...args);
      }, delay);
      if (delay === 160) probe.timers.set(id, { at, deadline: at + delay });
      return id;
    };
    probe.stage = window.__card.shadowRoot.querySelector('.stage');
    probe.listener = event => probe.events.push({ at: performance.now(), timestamp: event.timeStamp,
      trusted: event.isTrusted });
    probe.stage.addEventListener('wheel', probe.listener, true);
  });
  const sample = () => page.evaluate(() => {
    const card = window.__card, probe = window.__clampProbe;
    return { at: performance.now(), scale: card._zoom,
      coarse: card.hasAttribute('data-led-zoom-quality'),
      cache: JSON.stringify([...card.shadowRoot.querySelectorAll('.led-fields')]
        .map(node => [node.dataset.ledCache, node.dataset.ledRecomputes])),
      lease: probe.timers.get(card._zoomScaleActivity.timer), events: [...probe.events] };
  });
  const wheel = async () => {
    const p = await point(); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, -80);
    await page.clock.runFor(1);
  };
  try {
    // Actual changes, with reduced motion, reach the real camera maximum.
    for (let i = 0; i < 25; i++) {
      await wheel();
      if ((await sample()).scale >= 8) break;
    }
    const before = await sample();
    if (before.scale !== 8 || !before.coarse || !before.lease) {
      throw new Error(`no known active clamp lease: ${JSON.stringify(before)}`);
    }
    await page.clock.runFor(Math.max(0, before.lease.at + 45 - before.at));
    // Deliberately exceed 160 real ms between commands. Browser time is held;
    // the original production timer, not the harness, still decides expiry.
    await new Promise(resolve => setTimeout(resolve, 240));
    await wheel();
    const during = await sample();
    await page.clock.runFor(Math.max(0, before.lease.deadline - during.at));
    const deadline = await sample();
    await new Promise(resolve => setTimeout(resolve, 240));
    await wheel();
    const idle = await sample();
    const report = { before, during, deadline, idle };
    report.delivery = during.events.length === before.events.length + 1
      && during.events.at(-1).trusted && during.events.at(-1).at < before.lease.deadline
      && idle.events.length === during.events.length + 1 && idle.events.at(-1).trusted
      && deadline.at === before.lease.deadline;
    return report;
  } finally {
    await page.evaluate(() => {
      const probe = window.__clampProbe;
      window.setTimeout = probe.originalTimeout;
      probe.stage.removeEventListener('wheel', probe.listener, true);
      delete window.__clampProbe;
    });
    await page.clock.resume();
  }
}
