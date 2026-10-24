export function addDecorMultiselectFixture(fixture,scenario) {
  const shape=(id,x,color,opacity)=>({id,kind:'rect',x,y:.35,w:.2,h:.15,angle:id==='group-a'?17:-12,
    color,opacity,width_cm:2,fill:true,fill_color:'#9fbbbb',fill_opacity:.4});
  fixture.config.spaces.push({id:scenario.space,title:'Общий декор',cell_cm:5,view_box:[0,0,1,1],rooms:[],
    decor:[shape('group-a',.18,'#ff0000',.3),shape('group-b',.6,'#0000ff',.8)],
  });
}

export async function prepareDecorMultiselect(page) {
  const root=page.locator('houseplan-card');
  for(const [index,id] of ['group-a','group-b'].entries()){
    const target=root.locator(`.decorlayer [data-hp="decor"][data-id="${id}"]`).first();
    if(index)await page.keyboard.down('Control');await target.click();if(index)await page.keyboard.up('Control');
  }
  await page.waitForFunction(()=>window.__goldenCard.renderRoot.querySelectorAll('.hp-prop-group-contour').length===2);
  await page.mouse.move(4,4);
  return {selected:await root.locator('.hp-prop-group-contour').count()};
}
