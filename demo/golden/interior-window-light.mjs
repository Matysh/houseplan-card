/** Require actual light/clip content before accepting a new glass frame. */
export async function prepareInteriorWindowLight(page, probes, led) {
  await page.waitForFunction(led => window.__goldenCard.renderRoot.querySelector(
    led ? '.led-field-bands' : '[data-glow-source="light.ceiling"] .glow-pool'), led);
  return page.evaluate(({probes,led}) => {
    const root=window.__goldenCard.renderRoot;
    const pool=root.querySelector(led?'.led-field-bands':'[data-glow-source="light.ceiling"] .glow-pool');
    const id=pool?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
    const paths=id?[...root.querySelectorAll(`clipPath[id="${id}"] path`)]:[];
    const has=point=>paths.some(path=>path.isPointInFill(new DOMPoint(point[0]*1000,point[1]*1000)));
    const result={target:has(probes.target),shadow:has(probes.shadow),paths:paths.length};
    if(!result.target||result.shadow||!result.paths) throw Error('golden internal glass lacks the real receiving beam/column shadow');
    return result;
  },{probes,led});
}
