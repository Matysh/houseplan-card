// Actual houseplan-space-card capture, with a physical cut and painted leaf oracle.
export async function prepareStaticWallOpenings(page, scenario) {
  return page.evaluate(async ({ fit, width, diagonal, linePlan }) => {
    const full = window.__goldenCard;
    const host = document.getElementById('host');
    const el = document.createElement('houseplan-space-card');
    el.setConfig({type:'custom:houseplan-space-card',space:'f1',title:'',show_button:false,fit});
    el.hass = full.hass;
    host.style.setProperty('width',`${width}px`,'important');
    host.style.setProperty('padding','0','important');host.style.height='auto';host.replaceChildren(el);
    const deadline = performance.now()+7000;
    while(!el.shadowRoot?.querySelector('[data-id="wall-door"] .op-leaf')) {
      if(performance.now()>deadline)throw Error('Static wall-door leaf missing');
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    await el.updateComplete;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const root=el.shadowRoot,leaf=root.querySelector('[data-id="wall-door"] .op-leaf rect');
    const rect=leaf.getBoundingClientRect(),style=getComputedStyle(leaf);
    const turn=([x,y])=>diagonal?[(.5+(x-y)/Math.SQRT2)*1000,(.5+(x+y-1)/Math.SQRT2)*1000]:[x*1000,y*1000];
    const paths=[...root.querySelectorAll('.wallbodies path')];
    const solid=point=>paths.some(p=>p.isPointInFill(new DOMPoint(...turn(point))));
    if(Math.abs(el.getBoundingClientRect().width-width)>1
      ||!(rect.width>1&&rect.height>1)||style.display==='none'||style.visibility==='hidden'
      ||!paths.length||solid([.375,.1875])
      ||(linePlan?!solid([.26,.5625]):!solid([.16,.1875])))
      throw Error('Static wall-opening painted leaf/cut/control contract failed');
    if(root.querySelectorAll('[data-hp="opening"]').length!==5
      ||(!linePlan&&!root.querySelector('.static-opening-tunnels [data-id="shared-window"]')))
      throw Error('Static opening neighbor/tunnel missing');
    window.__goldenCard=el;
    return {wallDoorPainted:true,wallDoorCut:true,solidControl:true,visibleSymbols:5,fit,width,diagonal,linePlan:!!linePlan};
  },scenario.staticWallOpenings);
}
