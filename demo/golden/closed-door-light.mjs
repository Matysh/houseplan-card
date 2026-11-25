/** Inspect the actual displayed Glow clip. Also used by the pixel smoke so
 * golden and native scenarios share the same observable geometry contract. */
export async function inspectClosedDoorLight(page, probes, { led = false, staticCard = false } = {}) {
  return page.evaluate(({ probes, led, staticCard }) => {
    const card = staticCard ? document.querySelector('houseplan-space-card') : window.__goldenCard || window.__card;
    const root = card.shadowRoot;
    const host = !staticCard && card._renderProjection === 'iso' ? card._plan3dHost : null;
    if (host?.frame) {
      const sources = card._plan3dPresentation.world.lights.filter(source =>
        source.intensity > 0 && !source.sun && source.id.startsWith('led:') === led);
      const check = document.createElement('canvas').getContext('2d');
      const has = ([x, y]) => sources.some(source => {
        const inPath = (path, rule) => check.isPointInPath(path, x * 1000, y * 1000, rule);
        if (source.floorClip && !source.floorClip.some(path => inPath(new Path2D(path), 'evenodd'))) return false;
        return source.visible.some(path => inPath(new Path2D(path), source.rule ?? 'evenodd'));
      });
      const { camera } = host.frame;
      const rect = host.canvas.getBoundingClientRect();
      const project = (matrix, [x, y, z, w]) => [0, 1, 2, 3].map(i =>
        matrix[i] * x + matrix[i + 4] * y + matrix[i + 8] * z + matrix[i + 12] * w);
      const screen = ([x, y]) => {
        const eye = project(camera.matrixWorldInverse.elements, [x * 1000, 0, y * 1000, 1]);
        const [sx, sy, , w] = project(camera.projectionMatrix.elements, eye);
        return { x: rect.x + (sx / w + 1) * rect.width / 2, y: rect.y + (1 - sy / w) * rect.height / 2 };
      };
      const clip = sources.flatMap(source => source.visible);
      return { pool: sources.length > 0, paths: clip.length, target: has(probes.target), shadow: has(probes.shadow),
        outdoor: has(probes.outdoor), clip, targetScreen: screen(probes.target), shadowScreen: screen(probes.shadow) };
    }
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
  await page.waitForFunction(({ led = false, staticCard }) => {
    const card = staticCard ? document.querySelector('houseplan-space-card') : window.__goldenCard || window.__card;
    const root = card?.shadowRoot;
    if (!staticCard && card?._renderProjection === 'iso') return root?.querySelector('canvas[data-hp-plan-3d-ready]')
      && card._plan3dPresentation?.world.lights.some(source => source.intensity > 0 && !source.sun
        && source.id.startsWith('led:') === led);
    return root?.querySelector(led ? '.led-field-bands' : '[data-glow-source="light.ceiling"] .glow-pool');
  }, options);
  const volume = !options.staticCard && await page.evaluate(() => !!(window.__goldenCard || window.__card)
    .shadowRoot.querySelector('canvas[data-hp-plan-3d-ready]'));
  const probes = volume ? fixture.doorLightIsoProbes : fixture.doorLightProbes;
  const result = await inspectClosedDoorLight(page, probes, options);
  if (!result.pool || !result.paths || !result.target || result.shadow || options.exterior && result.outdoor)
    throw new Error(`Closed door must light its source-side pocket, stop at the leaf and never invent outdoor floor: ${JSON.stringify({options,probes,result:{...result,clip:undefined}})}`);
  return result;
}
