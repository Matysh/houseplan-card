/** Inspect the actual displayed Glow clip. Also used by the pixel smoke so
 * golden and native scenarios share the same observable geometry contract. */
export async function inspectClosedDoorLight(page, probes, { led = false, staticCard = false } = {}) {
  return page.evaluate(({ probes, led, staticCard }) => {
    const root = (staticCard ? document.querySelector('houseplan-space-card') : window.__goldenCard || window.__card).shadowRoot;
    const pool = root.querySelector(led ? '.led-field-bands' : '[data-glow-source="light.ceiling"] .glow-pool');
    const id = pool?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
    const paths = id ? [...root.querySelectorAll(`clipPath[id="${id}"] path`)] : [];
    const has = point => paths.some(path => path.isPointInFill(new DOMPoint(point[0] * 1000, point[1] * 1000)));
    const screen = point => {
      const matrix = pool?.getScreenCTM();
      const p = matrix && new DOMPoint(point[0] * 1000, point[1] * 1000).matrixTransform(matrix);
      return p ? { x: p.x, y: p.y } : null;
    };
    return { pool: !!pool, paths: paths.length, target: has(probes.target), shadow: has(probes.shadow),
      outdoor: has(probes.outdoor), clip: paths.map(path => path.getAttribute('d')),
      targetScreen: screen(probes.target), shadowScreen: screen(probes.shadow) };
  }, { probes, led, staticCard });
}

export async function prepareClosedDoorLight(page, fixture, options = {}) {
  await page.waitForFunction(({ led, staticCard }) => {
    const root = (staticCard ? document.querySelector('houseplan-space-card') : window.__goldenCard || window.__card)?.shadowRoot;
    return root?.querySelector(led ? '.led-field-bands' : '[data-glow-source="light.ceiling"] .glow-pool');
  }, options);
  const result = await inspectClosedDoorLight(page, fixture.doorLightProbes, options);
  if (!result.pool || !result.paths || !result.target || result.shadow || options.exterior && result.outdoor)
    throw new Error(`Closed door must light its source-side pocket, stop at the leaf and never invent outdoor floor: ${JSON.stringify({options,probes:fixture.doorLightProbes,result:{...result,clip:undefined}})}`);
  return result;
}
