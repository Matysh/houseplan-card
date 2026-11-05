/** Observe a native target, never the expected hover/route outcome. Camera
 * tweens update SVG CTMs in RAF, beyond Lit's updateComplete. Do not move the
 * pointer until three painted samples agree and hit testing finds a target. */
export async function devicePointerPoint(page, locator, { strip = false, vertical = .5 } = {}) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const deadline = Date.now() + 5000;
  let previous, stable = 0;
  const history = [];
  while (Date.now() < deadline) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    const sample = await locator.evaluate((node, { strip, vertical }) => {
      const rect = node.getBoundingClientRect(), matrix = node.getScreenCTM?.();
      let point = { x: rect.x + rect.width / 2, y: rect.y + rect.height * vertical };
      if (strip && matrix) {
        const closed = node.closest('[data-led-strip]').dataset.closed === 'true';
        const p = node.getPointAtLength(node.getTotalLength() * (closed ? .85 : .3)).matrixTransform(matrix);
        point = { x: p.x, y: p.y };
      }
      const hit = node.getRootNode().elementFromPoint(point.x, point.y);
      return { point, rect: rect.toJSON(), matrix: matrix ? [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] : null,
        hit: hit?.tagName ?? null, hitId: hit?.closest('[data-hp="device"]')?.getAttribute('data-id') ?? null,
        // A stroked horizontal/vertical SVG path legitimately has a zero
        // fill-box dimension. Its real length and native hit are the oracle.
        ready: node.isConnected && (strip ? node.getTotalLength() > 0 : rect.width > 0 && rect.height > 0)
          // Overlapping LED hit floors are intentional: the product chooses
          // the nearest owner, and the smoke must still judge that choice.
          && !!hit && (strip ? !!hit.closest('[data-led-strip]') : node.contains(hit)) };
    }, { strip, vertical });
    const key = JSON.stringify([sample.point, sample.rect, sample.matrix]);
    stable = sample.ready ? (key === previous ? stable + 1 : 1) : 0;
    previous = key;
    history.push(sample);
    if (history.length > 4) history.splice(1, 1); // first plus latest observations
    if (stable >= 3) return { ...sample.point, observation: history };
  }
  throw Error(`Native device target did not settle/hit within 5s: ${JSON.stringify(history)}`);
}
