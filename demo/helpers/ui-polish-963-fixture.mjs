/** Synthetic public counterpart of the frozen UI Lab; no owner data/assets. */
export async function installUiPolish963Fixture(page) {
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  await page.evaluate(async()=>{
    const c=window.__card;
    await window.__hpTest.waitForWrites(); c.setConfig({...c._config,language:'ru'});
    window.__addRegistryEntity('sensor.polish_value','living','24','demo',{}, {friendly_name:'Synthetic reading',unit_of_measurement:'°C'});
    c.hass=window.__mkHass();
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.model_version=10;
      cfg.spaces=[{id:'polish',title:'Synthetic floor',view_box:[0,0,1,1],cell_cm:5,plan_url:null,
        rooms:[{id:'living',name:'Gallery',poly:[[.1,.1],[.5,.1],[.5,.65],[.1,.65]]},
          {id:'kitchen',name:'Kitchen',poly:[[.5,.1],[.9,.1],[.9,.65],[.5,.65]]}],
        wall_segments:[{id:'contour',a:[.1,.1],b:[.5,.1],cm:12}],
        partitions:[{id:'wall',a:[.15,.8],b:[.5,.8],cm:12}],
        wall_columns:[{id:'column',shape:'square',center:[.88,.3],cm:30,angle:0}],
        openings:[{id:'window',type:'window',x:.3,y:.1,angle:0,length:.08,host:{kind:'wall',id:'contour',t:.5}},
          {id:'door',type:'door',x:.32,y:.8,angle:0,length:.08,host:{kind:'partition',id:'wall',t:.485714}}],
        stairs:[{id:'stair',kind:'straight',x:.7,y:.5,width:.1,length:.15,angle:0,direction:'forward'}],
        led_strips:[{id:'led',marker:'strip',active:true,points:[[.6,.2],[.85,.2],[.85,.3]]}],
        decor:[{id:'rect',kind:'rect',x:.18,y:.4,w:.2,h:.1,angle:0,color:'#718B82',opacity:1,fill:true,fill_color:'#C4D5CF',fill_opacity:.65,width_cm:2},
          {id:'text',kind:'text',x:.3,y:.58,text:'Keep this note',color:'#526871',size_cm:12}],
      },{id:'other',title:'Other floor',rooms:[],wall_segments:[],partitions:[],view_box:[0,0,1,1]}];
      cfg.markers=[{id:'lamp',binding:'virtual',space:'polish',name:'Reading lamp',icon:'mdi:lightbulb',size:1,angle:0,
        value_badge:{enabled:true,source:{kind:'entity_state',entity_id:'sensor.polish_value'},position:'right'}},
        {id:'strip',binding:'virtual',space:'polish',name:'LED strip',icon:'mdi:led-strip-variant'}];
    });
    await window.__hpTest.setLayout(()=>({lamp:{s:'polish',x:.65,y:.72},strip:{s:'polish',x:.8,y:.75}}));
    await window.__hpTest.switchSpace('polish');
  });
}
