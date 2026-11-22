/** One frozen set of authored supports reused by both native panel projections. */
import {readFileSync} from 'node:fs';
import {contactResizeSeeds, contactResizePartitions} from '../fixtures/device-contact-resize-1517.mjs';

const layout = JSON.parse(readFileSync(new URL('../fixtures/device-contact-resize-1517-layout.json',import.meta.url),'utf8'));
const individual = new Set(['straight','corner','free-b','wall-c','angle-b']);

export function makeDeviceContactResizeFixture({iconScale,markerScale}) {
  const markers=contactResizeSeeds.map(([id,,,size,icon])=>({
    id,binding:'virtual',name:id,icon,size:size*(individual.has(id)?markerScale:1),space:'f1',area:null,
    display:id==='free-b'?'icon':'static_icon',tap_action:'info',
    ...(id==='free-b'?{value_badge:{enabled:true,position:'right',source:{kind:'entity_state',entity_id:'sensor.living_temp'}}}:{}),
  }));
  return {
    config:{model_version:10,markers,spaces:[{id:'f1',title:'Device contact resize',view_box:[0,0,1,1],cell_cm:5,
      partitions:structuredClone(contactResizePartitions),
      rooms:[{id:'test-area',name:'',poly:[[.05,.07],[.95,.07],[.95,.94],[.05,.94]]}],
      settings:{show_names:false,show_borders:true,fill_mode:'custom',custom_fill:{c:'#e6f4f9',a:.7}}}],
    settings:{bg_mode:'static',sun_rays:false,external_screens:{version:2,next_id:2,screens:[{
      id:1,space:'f1',cycle:0,idle:0,default_view:{rotation:0,zoom:1,summary:'hide',center_summary:false,
        icon_scale:iconScale,font_scale:null},space_views:{},
    }]}}},
    layout:structuredClone(layout),devices:{},entities:{},areas:{},
    states:{'sensor.living_temp':{entity_id:'sensor.living_temp',state:'22.4',attributes:{unit_of_measurement:'°C'}}},
  };
}

export async function prepareDeviceContactResize(page,{iconScale}) {
  await page.waitForFunction(scale=>window.__goldenPanel && window.__goldenCard._effectiveKioskScale.icon===scale
    && window.__goldenCard._deviceContacts?.scene?.shapes.size===12,iconScale);
  return page.evaluate(()=>{
    const card=window.__goldenCard,scene=card._deviceContacts.scene;
    const supports=Object.fromEntries([...scene.shapes].map(([id,shape])=>[id,Object.values(shape.walls).sort()]));
    const components=['free','wall','angle'].map(prefix=>scene.component(prefix+'-b'));
    if(supports.straight.length!==1||supports.diagonal.length!==1||supports.corner.length!==2
      ||supports['wall-a'].length!==1||supports['angle-a'].length!==2
      ||components.some(ids=>ids.length!==3)||card._deviceContacts.resizeStatus)
      throw Error('Invalid contact resize fixture: '+JSON.stringify({supports,components,status:card._deviceContacts.resizeStatus}));
    return {supports,components, camera:{view:card._view,zoom:card._zoom},profileScale:card._effectiveKioskScale.icon};
  });
}
