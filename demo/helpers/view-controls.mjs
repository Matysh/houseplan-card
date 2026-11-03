// Native compact View controls. A hidden desktop button is never force-clicked.
async function backgroundPoint(page) {
  return page.locator('houseplan-card').first().locator('.stage').evaluate(stage => {
    const r=stage.getBoundingClientRect();
    for(const fy of [.02,.98,.1,.9,.5]) for(const fx of [.02,.98,.1,.9,.5]) {
      const x=r.left+r.width*fx,y=r.top+r.height*fy;
      if(x<1||y<1||x>=innerWidth-1||y>=innerHeight-1)continue;
      let hit=document.elementFromPoint(x,y);
      while(hit?.shadowRoot) { const next=hit.shadowRoot.elementFromPoint(x,y); if(!next||next===hit)break;hit=next; }
      if(hit&&stage.contains(hit)&&!hit.closest('button,input,select,textarea,[role=button],.dev,.roomlabel,[data-hp=room],.opening,.rlgo'))return {x,y};
    }
    throw Error('No visible unoccupied View background for native fit');
  });
}

export async function fitVisibleView(page) {
  const card=page.locator('houseplan-card').first(),button=card.locator('[data-hp="zoom-fit"]');
  if(await button.isVisible()) { await button.click();return; }
  if(await card.locator('ha-card').getAttribute('data-hp-mode')!=='view')throw Error('Background double-tap fit is available only in View');
  const p=await backgroundPoint(page);
  await page.mouse.dblclick(p.x,p.y);
}

export async function zoomVisibleView(page) {
  const card=page.locator('houseplan-card').first(),button=card.locator('[data-hp="zoom-in"]');
  if(await button.isVisible()) {await button.click();return;}
  const p=await backgroundPoint(page);
  await page.mouse.move(p.x,p.y);
  await page.keyboard.down('Control');
  try {await page.mouse.wheel(0,-100);} finally {await page.keyboard.up('Control');}
}
