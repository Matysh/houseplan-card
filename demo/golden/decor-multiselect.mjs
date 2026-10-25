export function addDecorMultiselectFixture(fixture,scenario) {
  const shape=(id,x,color,opacity)=>({id,kind:'rect',x,y:.35,w:.2,h:.15,angle:id==='group-a'?17:-12,
    color,opacity,width_cm:2,fill:true,fill_color:'#9fbbbb',fill_opacity:.4});
  const decor=scenario.decorGroupStyle ? [
    {id:'group-a',kind:'furniture',x:.18,y:.35,w:.24,h:.18,symbol:'sofa',color:'#ff0000',opacity:.3},
    {id:'group-b',kind:'furniture',x:.6,y:.35,w:.2,h:.2,symbol:'armchair',color:'#0000ff',opacity:.8},
  ] : [shape('group-a',.18,'#ff0000',.3),shape('group-b',.6,'#0000ff',.8)];
  fixture.config.spaces.push({id:scenario.space,title:'Общий декор',cell_cm:5,view_box:[0,0,1,1],rooms:[],decor,
  });
}

export async function prepareDecorMultiselect(page,scenario) {
  const root=page.locator('houseplan-card');
  for(const [index,id] of ['group-a','group-b'].entries()){
    const target=root.locator(`.decorlayer ${scenario?.decorGroupStyle?'.dfurniturehit':''}[data-hp="decor"][data-id="${id}"]`).first();
    if(index)await page.keyboard.down('Control');
    if(scenario?.decorGroupStyle){
      const point=await target.evaluate(el=>{
        const p=el.getPointAtLength(el.getTotalLength()*.25).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};
      });
      await page.mouse.click(point.x,point.y);
    }else await target.click();
    if(index)await page.keyboard.up('Control');
  }
  await page.waitForFunction(()=>window.__goldenCard.renderRoot.querySelectorAll('.hp-prop-group-contour').length===2);
  if(scenario?.decorGroupStyle){
    const picker=root.locator('[data-hp="properties-panel"] [data-property="stroke"] hp-color-opacity');
    await picker.locator('.trigger').click();
    await picker.locator('[data-field="colour-hex"]').fill('#CA24EF');
    await picker.locator('.confirm').click();
    await page.waitForFunction(async()=>{
      const c=window.__goldenCard,config=(await c.hass.callWS({type:'houseplan/config/get'})).config;
      const decor=config.spaces.find(s=>s.id===c._space)?.decor;
      const paths=[...c.renderRoot.querySelectorAll('.decorlayer path.dshape[data-kind="furniture"][stroke]')];
      return decor?.length===2&&decor.every(s=>s.color==='#ca24ef')&&decor[0].opacity===.3&&decor[1].opacity===.8
        &&paths.length===2&&paths.every(p=>p.getAttribute('stroke')==='#ca24ef')
        &&paths[0].getAttribute('stroke-opacity')==='0.3'&&paths[1].getAttribute('stroke-opacity')==='0.8'
        &&!c._writesPending&&!c._editorRuntime.properties.fields.draft;
    });
  }
  await page.mouse.move(4,4);
  return {selected:await root.locator('.hp-prop-group-contour').count()};
}
