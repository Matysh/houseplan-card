/** #1066: executed in the page. Observe DOM/native events; never write product state. */
export function installDaycycleObservation({ marker }) {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  const roles = new Map();
  for (const [role, selector] of [['stage', '.stage'], ['paper', '.hp-paperg'],
    ['plan', '.plan-svg'], ['outline', '.hp-paper-outline-svg']]) {
    const node = root.querySelector(selector);
    if (node) roles.set(node, role);
  }
  for (const node of root.querySelectorAll('[data-hp-live-viewbox]')) {
    if (!roles.has(node)) roles.set(node, `viewport-${roles.size}`);
  }
  const attributes = ['viewBox', 'transform', 'style', 'width', 'height', 'data-hp-live-viewbox'];
  const geometry = () => [...roles].map(([node, role]) => ({ role,
    connected: node.isConnected, inRoot: root.contains(node),
    attributes: Object.fromEntries(attributes.map(name => [name, node.getAttribute(name)])) }));
  const data = { schema: 1, clock: 'page performance.now milliseconds', marker,
    installedAt: performance.now(), initial: geometry(), pointers: [], frames: [], mutations: [],
    markerAt: null, overheadMs: 0 };
  const observePointer = event => {
    const began = performance.now();
    data.pointers.push({ type: event.type, at: began, eventTimeStamp: event.timeStamp,
      x: event.clientX, y: event.clientY, buttons: event.buttons, trusted: event.isTrusted,
      pointerId: event.pointerId, primary: event.isPrimary });
    data.overheadMs += performance.now() - began;
  };
  const stage = root.querySelector('.stage');
  const pointerTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
  for (const type of pointerTypes) stage.addEventListener(type, observePointer, { capture: true, passive: true });
  let batch = 0;
  const observer = new MutationObserver(records => {
    const began = performance.now();
    batch += 1;
    for (const record of records) {
      if (!roles.has(record.target)) continue;
      data.mutations.push({ batch, observedAt: began, role: roles.get(record.target),
        attribute: record.attributeName, oldValue: record.oldValue,
        // Delivery time is an upper bound, not the time of the write. Multiple
        // records can share this terminal value; retain every original oldValue.
        valueAtDelivery: record.target.getAttribute(record.attributeName) });
    }
    data.overheadMs += performance.now() - began;
  });
  observer.observe(root, { attributes: true, subtree: true, attributeOldValue: true,
    attributeFilter: [...attributes, 'class'] });
  window.__hpDaycycleObservation = {
    frame(step, raf, timestamp) {
      const began = performance.now();
      if (data.markerAt === null) {
        performance.mark(marker);
        data.markerAt = performance.getEntriesByName(marker).at(-1).startTime;
      }
      data.frames.push({ step, raf, timestamp, observedAt: began,
        ...(raf === 2 ? { geometry: geometry() } : {}) });
      data.overheadMs += performance.now() - began;
    },
    stop() {
      observer.disconnect();
      for (const type of pointerTypes) stage.removeEventListener(type, observePointer, true);
      data.stoppedAt = performance.now();
      data.final = geometry();
      performance.clearMarks(marker);
      delete window.__hpDaycycleObservation;
      return data;
    },
  };
}

/** Existing two-rAF wait, with timestamps only; no extra frame or per-step CDP call. */
export function observeDaycycleFrames(step) {
  return new Promise(resolve => requestAnimationFrame(first => {
    window.__hpDaycycleObservation.frame(step, 1, first);
    requestAnimationFrame(second => {
      window.__hpDaycycleObservation.frame(step, 2, second);
      resolve();
    });
  }));
}
