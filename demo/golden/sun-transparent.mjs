/** Observe both actual renderer output and the semantic receivers, never replace them. */
export async function prepareSunTransparent(page, sealed) {
  await page.waitForFunction(sealed=>{
    const c=window.__goldenCard,iso=c._renderProjection==='iso';
    const rays=iso?c._isoSunCache?.beams:c._sunRaysCache?.rays;
    return !!rays&&(sealed?rays.length===0:rays.some(r=>r.openingId==='W'&&r.roomId==='R'));
  },sealed);
  await page.waitForTimeout(3600); // complete the real view/sun fade, as in the ordinary smoke
  return page.evaluate(sealed=>{
    const c=window.__goldenCard,iso=c._renderProjection==='iso';
    const rays=iso?c._isoSunCache.beams:c._sunRaysCache.rays;
    const receivers=rays.map(r=>[r.openingId,r.roomId]);
    const fills=c.renderRoot.querySelectorAll('.sunlayer polygon,.sunlayer path').length;
    if(JSON.stringify(receivers)!==JSON.stringify(sealed?[]:[['W','R']])||(!sealed&&!fills)||(sealed&&fills))
      throw Error('Solar chain frame disagrees with the AC7 receiver/paint oracle');
    return {receivers,fills};
  },sealed);
}
