/** #866: all twelve frozen designer arrangements, real shared device renderer. */
import { designerContactCases } from '../fixtures/device-contact-designer-866.mjs';

export function makeDeviceContactsFixture() {
  const space='golden-contacts', k=1000/1500;
  const config={model_version:10,settings:{bg_mode:'static',sun_rays:false,marker_area_snapshot:{}},markers:[],
    spaces:[{id:space,title:'Device contacts',view_box:[0,0,1,1],cell_cm:5,rooms:[],walls:[],wall_segments:[],
      partitions:[],openings:[],wall_columns:[],decor:[],
      settings:{show_names:false,show_borders:true,fill_mode:'none',glow_enabled:false}}]};
  const layout={};
  designerContactCases.forEach((scene,index)=>{
    const ox=28+index%3*480,oy=25+Math.floor(index/3)*240;
    scene.walls.forEach(w=>config.spaces[0].partitions.push(w.w<=w.h
      ?{id:`${scene.id}-${w.id}`,a:[(ox+w.x+w.w/2)/1500,(oy+w.y)/1500],b:[(ox+w.x+w.w/2)/1500,(oy+w.bottom)/1500],cm:w.w*k*1.2}
      :{id:`${scene.id}-${w.id}`,a:[(ox+w.x)/1500,(oy+w.y+w.h/2)/1500],b:[(ox+w.right)/1500,(oy+w.y+w.h/2)/1500],cm:w.h*k*1.2}));
    scene.devices.forEach(d=>{
      const id=`${scene.id}-${d.id}`;
      config.markers.push({id,binding:'virtual',space,name:scene.title,icon:d.badge!=='none'?'mdi:thermometer':scene.id==='grid'?'mdi:power-socket':'mdi:power-plug',
        display:d.badge==='none'?'static_icon':'badge',size:d.size*80/103*k/45,
        value_badge:{enabled:d.badge!=='none',position:d.badge==='none'?'right':d.badge,
          source:{kind:'entity_state',entity_id:'sensor.contact_reference'}}});
      layout[id]={s:space,x:(ox+d.x)/1500,y:(oy+d.y)/1500};
    });
  });
  return {config,layout,devices:{},entities:{},areas:{},states:{'sensor.contact_reference':{
    entity_id:'sensor.contact_reference',state:'26%',attributes:{}}}};
}

export async function prepareDeviceContacts(page) {
  await page.waitForFunction(()=>window.__goldenCard?._deviceContacts?.scene?.shapes.size===32);
  return page.evaluate(()=>{
    const c=window.__goldenCard,root=c.renderRoot;
    const count=root.querySelectorAll('.device-contact-contour').length;
    const grouped=root.querySelectorAll('.device-contact-contour.grouped').length;
    if(count<10||grouped<7)throw Error(`device contact board incomplete: ${count}/${grouped}`);
    const glyphs=[...root.querySelectorAll('.device-core ha-icon')];
    if(glyphs.length!==32||glyphs.some(n=>!n.shadowRoot?.querySelector('path')?.getAttribute('d')))
      throw Error('device contact board has missing glyphs');
    return {markers:32,contours:count,groups:grouped,caseOrder:'row-major frozen designerContactCases'};
  });
}
