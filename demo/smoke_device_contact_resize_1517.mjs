/** #1517: full production View, one authored layout reused for both projections. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {launch,checkAll,finish} from './serve.mjs';
import {fitVisibleView} from './helpers/view-controls.mjs';
import {authorContactResizePositions,contactResizePartitions,contactResizeSeeds,
  hasElbowResizeContacts,individuallyResizedContacts} from './fixtures/device-contact-resize-1517.mjs';

const artifactDir=process.env.HP_CONTACT_RESIZE_ARTIFACTS || 'artifacts/1517/contact-resize';
const sizes=Object.fromEntries(contactResizeSeeds.map(([id,,,size])=>[id,size]));
const markers=contactResizeSeeds.map(([id,,,size,icon])=>({
  id,binding:'virtual',name:id,icon,size,space:'f1',area:null,display:id==='free-b'?'icon':'static_icon',tap_action:'info',
  ...(id==='free-b'?{value_badge:{enabled:true,position:'right',source:{kind:'entity_state',entity_id:'sensor.living_temp'}}}:{}),
}));
const variants=[
  ['base',1,1],
  ['individual-larger',1,1.25],
  ['individual-smaller',1,.8],
  ['surface-larger',1.28,1],
  ['surface-smaller',.78,1],
  ['restored',1,1],
];
const {page,browser}=await launch({width:1280,height:920});
const out={},frames=[];
mkdirSync(artifactDir,{recursive:true});
const settle=()=>page.evaluate(async()=>{
  await window.__hpTest.settled();await document.fonts.ready;
  await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
});
const sample=()=>page.evaluate(()=>{
  const c=window.__card,scene=c._deviceContacts.scene;
  const shapes=Object.fromEntries([...scene.shapes].map(([id,s])=>[id,s.marker]));
  const edges=Object.fromEntries([...scene.edges].map(([id,edges])=>[id,[...edges].sort()]));
  const walls=Object.fromEntries([...scene.shapes].map(([id,s])=>[id,Object.values(s.walls).sort()]));
  const wallFaces=Object.fromEntries([...scene.shapes].map(([id,s])=>[id,s.walls]));
  const visible=Object.fromEntries([...scene.shapes].map(([id])=>{
    const node=c.renderRoot.querySelector('.dev[data-id="'+id+'"]');
    return [id,!!node && node.getBoundingClientRect().width>0];
  }));
  return {shapes,edges,walls,wallFaces,visible,wallSegments:scene.walls,layout:structuredClone(c._layout),
    view:structuredClone(c._view),zoom:c._zoom,status:c._deviceContacts.resizeStatus};
});
try{
  await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
  await page.evaluate(async ({parts,markers})=>{
    const c=window.__card;
    c.setConfig({...c._config,icon_size:4});
    await window.__hpTest.setServerConfig(cfg=>{
      const space=cfg.spaces.find(s=>s.id==='f1');
      cfg.spaces=[{id:'f1',title:'Device contact resize',view_box:[0,0,1,1],cell_cm:5,
        partitions:parts,rooms:[{id:'test-area',name:'',poly:[[.05,.07],[.95,.07],[.95,.94],[.05,.94]]}],
        settings:{...space.settings,show_names:false,show_borders:true,fill_mode:'custom',custom_fill:{c:'#e6f4f9',a:.7}}}];
      cfg.settings={...cfg.settings,bg_mode:'static',volumetric_view:false};
      cfg.markers=markers;
      return cfg;
    });
    await window.__hpTest.setLayout(Object.fromEntries(markers.map(({id},i)=>[id,{s:'f1',x:.10+(i%6)*.14,y:i<6?.10:i<12?.88:.52}])));
    await window.__hpTest.setMode('view');
  },{parts:contactResizePartitions,markers});
  await page.waitForFunction(n=>window.__card._deviceContacts?.scene?.shapes.size===n,markers.length);
  const measured=await sample();
  const layout=await authorContactResizePositions(measured.shapes,measured.wallSegments,'f1');
  await page.evaluate(layout=>window.__hpTest.setLayout(layout),layout);await settle();
  await page.evaluate(()=>{
    const c=window.__card,original=c.hass.callWS.bind(c.hass);window.__resizeWrites=[];
    c.hass={...c.hass,callWS:async msg=>{
      if(/houseplan\/(config|layout)\/(set|update|delete)$/.test(msg.type))window.__resizeWrites.push(msg.type);
      return original(msg);
    }};
  });
  const change=async(multiplier,factor)=>{
    const revision=await page.evaluate(({factor,sizes,individual})=>{
      const cfg=structuredClone(window.__card._serverCfg);
      const next=cfg.markers.map(m=>({...m,size:sizes[m.id]*(individual.includes(m.id)?factor:1)}));
      if (next.every((m,i)=>m.size===cfg.markers[i].size)) return null;
      cfg.markers=next;
      return window.__pushServerConfig(cfg);
    },{factor,sizes,individual:[...individuallyResizedContacts]});
    if (revision!==null) await page.waitForFunction(rev=>window.__card._cfgRev>=rev,revision);
    await page.evaluate(iconSize=>{
      const c=window.__card;
      if(c._config.icon_size!==iconSize)c.setConfig({...c._config,icon_size:iconSize});
    },4*multiplier);
    await settle();
  };
  for(const [projection,iso] of [['flat',false],['iso',true]]){
    await page.evaluate(iso=>window.__hpTest.setVolumetricView(iso),iso);
    await page.waitForFunction(iso=>{
      const c=window.__card;
      return !!c.renderRoot.querySelector('.plan-svg[data-projection="iso"]')===iso
        && c._deviceContacts?.scene?.shapes.size>0 && (!iso || !!c._isoFloorMarkerPlane);
    },iso);
    await fitVisibleView(page);await settle();
    const base=await sample();
    out[projection+':existing contact cases']=base.walls.straight.length===1 && base.walls.diagonal.length===1
      && base.walls.corner.length===2 && ['free','wall','angle'].every(prefix=>base.edges[prefix+'-b']?.length===2)
      && base.walls['wall-a'].length===1 && base.walls['angle-a'].length===2;
    for(const [variant,multiplier,factor] of variants){
      await change(multiplier,factor);
      const frame=await sample();
      const prefix=projection+':'+variant;
      out[prefix+':connections']=JSON.stringify(frame.edges)===JSON.stringify(base.edges)
        && JSON.stringify(frame.walls)===JSON.stringify(base.walls);
      out[prefix+':layout and camera']=JSON.stringify(frame.layout)===JSON.stringify(base.layout)
        && JSON.stringify(frame.view)===JSON.stringify(base.view)&&Math.abs(frame.zoom-base.zoom)<1e-6;
      out[prefix+':elbow preserves both arms']=hasElbowResizeContacts(frame.wallFaces,frame.edges);
      out[prefix+':visible']=Object.values(frame.visible).every(Boolean) && !frame.status;
      const direction=Math.sign(multiplier*factor-1);
      out[prefix+':size']=Object.keys(frame.shapes).every(id=>{
        const difference=frame.shapes[id].diameter-base.shapes[id].diameter;
        const expected=multiplier!==1||individuallyResizedContacts.has(id)?direction:0;
        return expected===0?Math.abs(difference)<1e-6:Math.sign(difference)===expected && Math.abs(difference)>1e-6;
      });
      if(variant==='restored')out[projection+':exact return']=JSON.stringify(frame.shapes)===JSON.stringify(base.shapes);
      const file=projection+'-'+variant+'.png';
      await page.locator('houseplan-card .stage').screenshot({path:join(artifactDir,file)});
      const sha256=createHash('sha256').update(readFileSync(join(artifactDir,file))).digest('hex');
      frames.push({projection,variant,file,sha256,view:frame.view,zoom:frame.zoom,markers:frame.shapes});
    }
  }
  out['local overrides perform no writes']=await page.evaluate(()=>window.__resizeWrites.length===0);
  writeFileSync(join(artifactDir,'frames.json'),JSON.stringify({viewport:[1280,920],dpr:1,theme:'light',layout,frames,checks:out},null,2));
  checkAll(out);await finish(browser,out);
}catch(error){await browser.close();throw error;}
