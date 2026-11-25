/** #1518: native settings, per-space persistence and 3D wall compositing. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

const reviewDir = process.env.HP_WALL_TRANSPARENCY_REVIEW_DIR;
if (reviewDir) {
  requirePinnedBrowser('#1518 wall transparency visual comparison');
  await mkdir(reviewDir,{recursive:true});
}
const { page,browser } = await launch({ width:1400,height:940 },1,[],{reducedMotion:'reduce'});
const out={}, frames=[];
const stage=page.locator('houseplan-card .stage');
const TOP='#9d6a39', SIDE='#2f786e';

try {
  await page.evaluate(async ({top,side}) => {
    Object.assign(document.getElementById('host').style,{width:'100%',maxWidth:'none'});
    await window.__hpTest.setServerConfig(cfg => {
    const s = cfg.spaces.find(item => item.id==='f1');
    s.plan_url=null;
    // Include straight, joined and diagonal masonry, an opening's lower and
    // upper wall segments, two column shapes and recognizable objects behind it.
    s.partitions=[
      {id:'wt-front',a:[.15,.70],b:[.82,.70],cm:25},
      {id:'wt-corner',a:[.82,.70],b:[.90,.46],cm:22},
      {id:'wt-diagonal',a:[.21,.34],b:[.51,.59],cm:18},
    ];
    s.openings=[
      {id:'wt-window',type:'window',x:.42135,y:.70,angle:0,length:.12,host:{kind:'partition',id:'wt-front',t:.405}},
      {id:'wt-door',type:'door',x:.6793,y:.70,angle:0,length:.10,host:{kind:'partition',id:'wt-front',t:.79}},
    ];
    s.stairs=[{id:'wt-stairs',kind:'straight',direction:'forward',x:.34,y:.605,length:.11,width:.05,angle:90,
      target_space_id:cfg.spaces.find(space=>space.id!=='f1').id}];
    s.wall_columns=[
      {id:'wt-circle',shape:'circle',center:[.72,.45],cm:42},
      {id:'wt-square',shape:'square',center:[.28,.56],cm:38,angle:30},
    ];
    s.decor=[
      {id:'wt-sofa',kind:'furniture',symbol:'sofa',x:.48,y:.632,w:.22,h:.08,color:'#80302b',opacity:1,width_cm:2},
      {id:'wt-desk',kind:'furniture',symbol:'desk',x:.36,y:.42,w:.13,h:.09,color:'#7d654b',opacity:1,width_cm:2},
    ];
    s.settings={...s.settings,show_borders:true,show_names:false,room_color:top,room_opacity:.55,
      wall_fill:{c:side,a:.38},bg_mode:'static',fill_mode:'custom',custom_fill:{c:'#cc9668',a:.35},glow_enabled:false,sun_rays:false};
    delete s.settings.transparent_walls_3d;
    cfg.settings={...cfg.settings,bg_mode:'static',sun_rays:false,volumetric_view:false};
    return cfg;
    });
  },{top:TOP,side:SIDE});
  const settle=()=>page.evaluate(()=>window.__hpTest.settled());
  const setIso=on=>page.evaluate(on=>window.__hpTest.setVolumetricView(on),on);
  const capture=async id=>{
    if(reviewDir) await page.locator('houseplan-card [data-hp="toast"]').waitFor({state:'hidden'});
    const buffer=await stage.screenshot({animations:'disabled'});
    if(reviewDir){
      const file=id+'.png';
      await writeFile(join(reviewDir,file),buffer);
      frames.push({id,file,sha256:createHash('sha256').update(buffer).digest('hex')});
    }
    return buffer;
  };
  const signature=()=>stage.evaluate(el=>{
    const card=window.__card, world=card._plan3dHost?.world;
    const materialList=group=>group?.children.flatMap(mesh=>[mesh.material].flat()
      .filter(material=>mesh.geometry.attributes.position.count>0).map(material=>({
        color:material.color.getHexString(), opacity:material.opacity, depthWrite:material.depthWrite,
      })))??[];
    return {
      rotation:el.dataset.hpPlanRotation, yaw:el.querySelector('.plan-svg')?.dataset.yaw,
      mode:world?'iso':'flat', masonry:materialList(world?.structure), surfaces:materialList(world?.openings),
      background:getComputedStyle(el).getPropertyValue('--wall-fill-op'),
      stairLinks:el.querySelectorAll('[data-hp="stair"][data-id="wt-stairs"][role="link"]').length,
    };
  });
  const uses=(frame,color,opacity)=>frame.masonry.some(material=>material.color===color &&
    material.opacity===opacity && material.depthWrite===(opacity===1));
  const opaque=frame=>frame.masonry.slice(0,6).length===6 &&
    frame.masonry.slice(0,6).every(material=>material.opacity===1&&material.depthWrite);
  const setMaterial=async (on, side=.38, top=.55) => {
    await page.evaluate(({on,side,top}) => window.__hpTest.setServerConfig(cfg=>{
      const settings=cfg.spaces.find(s=>s.id==='f1').settings;
      if(on===undefined)delete settings.transparent_walls_3d;
      else settings.transparent_walls_3d=on;
      settings.wall_fill={...settings.wall_fill,a:side};
      settings.room_opacity=top;
      return cfg;
    }),{on,side,top});
    await settle();
  };
  const theme=async dark=>{
    await page.emulateMedia({colorScheme:dark?'dark':'light',reducedMotion:'reduce'});
    await page.evaluate(dark=>{
      const c=window.__card;
      c.hass={...c.hass,themes:{...c.hass.themes,darkMode:dark}};
      c.style.setProperty('--card-background-color',dark?'#1b222d':'#f7f7f4');
      return window.__hpTest.setServerConfig(cfg=>{
        cfg.spaces.find(space=>space.id==='f1').settings.bg_color=dark?'#202832':'#f7f7f4';
        return cfg;
      });
    },dark);
    await settle();
  };
  const fixtureFlatBefore=await signature();
  const control=await page.evaluate(async()=>{
    const {__hpTest:hp,__card:c}=window;
    const otherBefore=JSON.stringify(c._serverCfg.spaces.find(s=>s.id!=='f1').settings);
    const dialog=await hp.openSpaceDialog('edit','f1');
    dialog.querySelector('[data-section-target="appearance"]').click();
    await hp.settled();
    const wall=dialog.querySelector('[data-field="space-wall-fill"]').closest('.hpf-colorrow');
    const toggle=dialog.querySelector('[data-field="space-transparent-walls-3d"]');
    const row=toggle.closest('label');
    return {off:!toggle.checked,afterWall:!!wall&&(wall.compareDocumentPosition(row)&Node.DOCUMENT_POSITION_FOLLOWING)!==0,
      help:row.querySelector('.hpf-toggle-caption')?.textContent.includes('opaque white base'),otherBefore};
  });
  out.defaultOff=control.off;
  out.controlAfterWallColor=control.afterWall;
  out.persistentCaptionExplainsOpacity=control.help===true;
  if(reviewDir){
    await page.evaluate(()=>window.__card.renderRoot.querySelector('[data-field="space-transparent-walls-3d"]').closest('label').scrollIntoView({block:'center'}));
    const data=await page.screenshot({animations:'disabled'});
    await writeFile(join(reviewDir,'settings.png'),data);
    frames.push({id:'settings',file:'settings.png',sha256:createHash('sha256').update(data).digest('hex')});
  }
  const saved=await page.evaluate(async()=>{
    const {__hpTest:hp,__card:c}=window;
    const dialog=c.renderRoot.querySelector('hp-dialog[data-kind="space"]');
    dialog.querySelector('[data-field="space-transparent-walls-3d"]').click();
    await hp.settled();
    dialog.querySelector('[data-hp="dialog-confirm"]').click();
    await hp.waitForWrites();
    await hp.settled();
    const read=await c.planHost.request({type:'houseplan/config/get'});
    const s=read.config.spaces.find(s=>s.id==='f1');
    const reopened=await hp.openSpaceDialog('edit','f1');
    const checked=reopened.querySelector('[data-field="space-transparent-walls-3d"]').checked;
    await hp.close(reopened,{via:'cancel'});
    return {optedIn:s.settings.transparent_walls_3d,checked,wall:s.settings.wall_fill,top:s.settings.room_opacity,
      other:JSON.stringify(read.config.spaces.find(s=>s.id!=='f1').settings)};
  });
  out.savedAndReopened=saved.optedIn===true&&saved.checked;
  out.keptColoursAndOtherSpace=saved.wall.c===SIDE&&saved.wall.a===.38&&saved.top===.55&&saved.other===control.otherBefore;
  out.flatIsIdentical=JSON.stringify(await signature())===JSON.stringify(fixtureFlatBefore);
  await setIso(true);
  const savedIso=await signature();
  out.savedOptionIsLive=savedIso.mode==='iso'&&uses(savedIso,SIDE.slice(1),.38)&&uses(savedIso,TOP.slice(1),.55);
  await page.evaluate(()=>window.__hpTest.setMode('plan'));
  out.planEditorKeepsFlat=(await signature()).mode==='flat';
  await page.evaluate(()=>window.__hpTest.setMode('view'));
  out.viewRestoresLocalOption=uses(await signature(),SIDE.slice(1),.38);

  const cameraYaw=async()=>Number((await signature()).yaw);
  const initialYaw=await cameraYaw();
  const oppositeYaw=(initialYaw+180)%360;
  for(const dark of [false,true]){
    const name=dark?'dark':'light';
    await theme(dark);
    if(dark) for(let turn=0;turn<8&&(await cameraYaw())%360!==oppositeYaw;turn++){
      const previous=await cameraYaw();
      await page.locator('houseplan-card [data-hp="rotate-right"]').click();
      await page.waitForFunction(previous=>Number(window.__card.renderRoot.querySelector('.plan-svg')?.dataset.yaw)!==previous,previous);
      await settle();
    }
    await settle();
    await setMaterial(undefined);
    const before=await signature(), opaqueImage=await capture(name+'-white-base');
    await setMaterial(false);
    const off=await signature();
    out[name+'DefaultMatchesOff']=JSON.stringify(before)===JSON.stringify(off)&&opaque(off);
    await setMaterial(true);
    const after=await signature(), transparent=await capture(name+'-transparent');
    out[name+'ExpectedViewDirection']=Number(after.yaw)%360===(dark?oppositeYaw:initialYaw%360);
    out[name+'TranslucentCapsAndSides']=uses(after,TOP.slice(1),.55)&&uses(after,SIDE.slice(1),.38);
    out[name+'OpeningMaterialsUnchanged']=JSON.stringify(before.surfaces)===JSON.stringify(after.surfaces)
      &&after.surfaces.length>0;
    out[name+'CameraUnchanged']=before.rotation===after.rotation&&before.yaw===after.yaw;
    out[name+'UniqueStairTarget']=after.stairLinks===1;
    out[name+'PixelsDiffer']=!opaqueImage.equals(transparent);
  }
  await setMaterial(true,1,1);
  const solid=await signature(), solidImage=await capture('both-wall-colours-opaque');
  out.fullOpacityDrawsBoth=uses(solid,TOP.slice(1),1)&&uses(solid,SIDE.slice(1),1);
  await setMaterial(true,0,.55);
  const noSide=await signature(), noSideImage=await capture('no-wall-sides');
  out.zeroSideOnly=uses(noSide,TOP.slice(1),.55)&&!noSide.masonry.some(material=>material.color===SIDE.slice(1))
    &&!noSideImage.equals(solidImage);
  await setMaterial(true,.38,0);
  const noTop=await signature(), noTopImage=await capture('no-wall-caps');
  out.zeroTopOnly=uses(noTop,SIDE.slice(1),.38)&&!noTop.masonry.some(material=>material.color===TOP.slice(1))
    &&!noTopImage.equals(noSideImage);
  await setMaterial(true,0,0);
  const clear=await signature(), clearImage=await capture('both-wall-colours-transparent');
  out.fullyTransparentMasonryKeepsOpenings=clear.surfaces.length>0&&!clearImage.equals(solidImage)
    &&!clearImage.equals(noTopImage)&&!clearImage.equals(noSideImage)
    &&!clear.masonry.some(material=>material.color===TOP.slice(1)||material.color===SIDE.slice(1));
  await setMaterial(true,.38,0);
  const disabled = await page.evaluate(async()=>{
    const {__hpTest:hp,__card:c}=window;
    const dialog=await hp.openSpaceDialog('edit','f1');
    dialog.querySelector('[data-field="space-transparent-walls-3d"]').click();
    await hp.settled();
    dialog.querySelector('[data-hp="dialog-confirm"]').click();
    await hp.waitForWrites();
    await hp.settled();
    const read=await c.planHost.request({type:'houseplan/config/get'});
    return read.config.spaces.find(s=>s.id==='f1').settings;
  });
  out.disableThroughFormRestoresBacking=disabled.transparent_walls_3d!==true
    &&disabled.wall_fill.a===.38&&disabled.room_opacity===0&&opaque(await signature());
  if(reviewDir) await writeFile(join(reviewDir,'frames.json'),JSON.stringify({
    node:process.version,chromium:browser.version(),viewport:page.viewportSize(),dpr:1,frames,
  },null,2)+'\n');
  checkAll(out);
  await finish(browser,out);
} catch(error){
  await browser.close();
  throw error;
}
