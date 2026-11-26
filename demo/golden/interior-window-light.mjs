/** Require actual light/clip content before accepting a new glass frame. */
export async function prepareInteriorWindowLight(page, probes, led) {
  await page.waitForFunction(led => {
    const c=window.__goldenCard;
    return c.renderRoot.querySelector(led ? '.led-field-bands'
      : '[data-glow-source="light.ceiling"] .glow-pool,canvas[data-hp-plan-3d-ready]');
  }, led);
  return page.evaluate(({probes,led}) => {
    const c=window.__goldenCard,root=c.renderRoot;
    if(root.querySelector('canvas[data-hp-plan-3d-ready]')){
      const lamp=c._devices.find(device=>device.primary==='light.ceiling');
      const sources=c._plan3dPresentation.world.lights.filter(light=>!light.sun&&light.intensity>0
        &&(led?light.ribbon:!light.ribbon&&light.id===`${c._space}|${lamp?.id}`));
      const ctx=document.createElement('canvas').getContext('2d');
      const has=([x,y])=>sources.some(light=>ctx.isPointInPath(new Path2D(light.visible.join(' ')),x*1000,y*1000,light.rule??'evenodd')
        &&(!light.floorClip||ctx.isPointInPath(new Path2D(light.floorClip.join(' ')),x*1000,y*1000,'evenodd')));
      const result={target:has(probes.target),shadow:has(probes.shadow),paths:sources.flatMap(light=>light.visible).length};
      if(!result.target||result.shadow||!result.paths) throw Error('WebGL golden lost the receiving beam/column shadow: '+JSON.stringify(result));
      return result;
    }
    const pool=root.querySelector(led?'.led-field-bands':'[data-glow-source="light.ceiling"] .glow-pool');
    const id=pool?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
    const paths=id?[...root.querySelectorAll(`clipPath[id="${id}"] path`)]:[];
    const has=point=>paths.some(path=>path.isPointInFill(new DOMPoint(point[0]*1000,point[1]*1000)));
    const result={target:has(probes.target),shadow:has(probes.shadow),paths:paths.length};
    if(!result.target||result.shadow||!result.paths) throw Error('golden internal glass lacks the real receiving beam/column shadow');
    return result;
  },{probes,led});
}
