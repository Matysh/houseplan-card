/** One frozen set of authored supports reused by both native panel projections. */
import {readFileSync} from 'node:fs';
import {contactResizeSeeds, contactResizePartitions, individuallyResizedContacts, hasElbowResizeContacts} from '../fixtures/device-contact-resize-1517.mjs';

const layout = JSON.parse(readFileSync(new URL('../fixtures/device-contact-resize-1517-layout.json',import.meta.url),'utf8'));

export function makeDeviceContactResizeFixture({iconScale,markerScale,screenRotation = 0}) {
  const markers=contactResizeSeeds.map(([id,,,size,icon])=>({
    id,binding:'virtual',name:id,icon,size:size*(individuallyResizedContacts.has(id)?markerScale:1),space:'f1',area:null,
    display:id==='free-b'?'icon':'static_icon',tap_action:'info',
    ...(id==='free-b'?{value_badge:{enabled:true,position:'right',source:{kind:'entity_state',entity_id:'sensor.living_temp'}}}:{}),
  }));
  return {
    config:{model_version:10,markers,spaces:[{id:'f1',title:'Device contact resize',view_box:[0,0,1,1],cell_cm:5,
      partitions:structuredClone(contactResizePartitions),
      rooms:[{id:'test-area',name:'',poly:[[.05,.07],[.95,.07],[.95,.94],[.05,.94]]}],
      settings:{show_names:false,show_borders:true,fill_mode:'custom',custom_fill:{c:'#e6f4f9',a:.7}}}],
    settings:{bg_mode:'static',sun_rays:false,external_screens:{version:2,next_id:2,screens:[{
      id:1,space:'f1',cycle:0,idle:0,default_view:{rotation:screenRotation,zoom:1,summary:'hide',center_summary:false,
        icon_scale:iconScale,font_scale:null},space_views:{},
    }]}}},
    layout:structuredClone(layout),devices:{},entities:{},areas:{},
    states:{'sensor.living_temp':{entity_id:'sensor.living_temp',state:'22.4',attributes:{unit_of_measurement:'°C'}}},
  };
}

export async function prepareDeviceContactResize(page,{iconScale,screenRotation = 0}) {
  await page.waitForFunction(({scale,count,rotation})=>window.__goldenPanel && window.__goldenCard._effectiveKioskScale.icon===scale
    && window.__goldenCard._rotation===rotation && window.__goldenCard._deviceContacts?.scene?.shapes.size===count,
  {scale:iconScale,count:contactResizeSeeds.length,rotation:screenRotation});
  const proof = await page.evaluate(expectedRotation=>{
    const card=window.__goldenCard,scene=card._deviceContacts.scene;
    const plan=card.renderRoot.querySelector('.plan-svg[data-projection]');
    const yaw=Number(plan?.dataset.yaw);
    const expectedYaw=(expectedRotation+(plan?.dataset.projection==='iso'?35:0))%360;
    if (!plan || (yaw+360)%360!==expectedYaw)
      throw Error('Painted plan rotation differs from the screen profile: '+yaw+' vs '+expectedYaw);
    if (plan.dataset.projection === 'flat' && expectedRotation === 180) {
      const nodes=['free-a','free-b','free-c'].map(id=>card.renderRoot.querySelector('.dev[data-id="'+id+'"]'));
      const group=nodes[1]?.dataset.hpDeviceComponent;
      const badge=nodes[1]?.querySelector('.value-badge')?.getBoundingClientRect();
      const cores=nodes.map(node=>node?.querySelector('.device-core')?.getBoundingClientRect());
      if (!group || nodes.some(node=>node?.dataset.hpDeviceComponent!==group) || !badge || cores.some(core=>!core)
          || badge.left < cores[1].right-.5 || [cores[0],cores[2]].some(core=>
            Math.min(core.right,badge.right)-Math.max(core.left,badge.left)>.5
            && Math.min(core.bottom,badge.bottom)-Math.max(core.top,badge.top)>.5))
        throw Error('Half-turn broke the painted group or let the badge overlap a neighbouring core');
    }
    const supports=Object.fromEntries([...scene.shapes].map(([id,shape])=>[id,Object.values(shape.walls).sort()]));
    const components=['free','wall','angle'].map(prefix=>scene.component(prefix+'-b'));
    if(supports.straight.length!==1||supports.diagonal.length!==1||supports.corner.length!==2
      ||supports['wall-a'].length!==1||supports['angle-a'].length!==2
      ||components.some(ids=>ids.length!==3)||card._deviceContacts.resizeStatus)
      throw Error('Invalid contact resize fixture: '+JSON.stringify({supports,components,status:card._deviceContacts.resizeStatus}));
    const wallFaces=Object.fromEntries([...scene.shapes].map(([id,shape])=>[id,shape.walls]));
    const edges=Object.fromEntries([...scene.edges].map(([id,neighbours])=>[id,[...neighbours]]));
    return {supports,components,wallFaces,edges, screenRotation:card._rotation, yaw, camera:{view:card._viewOr(card._baseVb()),zoom:card._zoom},profileScale:card._effectiveKioskScale.icon};
  },screenRotation);
  if (!hasElbowResizeContacts(proof.wallFaces,proof.edges))
    throw Error('Corner group lost an arm or a wall contact: '+JSON.stringify(proof));
  return proof;
}
