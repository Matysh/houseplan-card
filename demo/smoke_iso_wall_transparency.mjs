/** #1518: native settings, per-space persistence and 2.5D wall compositing. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

const reviewDir = process.env.HP_WALL_TRANSPARENCY_REVIEW_DIR;
if (reviewDir) {
  requirePinnedBrowser('#1518 wall transparency visual comparison');
  await mkdir(reviewDir,{recursive:true});
}
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
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
  const signature=()=>stage.evaluate(el => {
    const all=(s)=>[...el.querySelectorAll(s)];
    // Read the paint itself: translucent faces no longer composite opacity
    // on their parent group. Continuous cut fragments paint through <use>.
    const seen=kind=>[...new Set(all('.iso-translucent-masonry-face[data-material="'+kind+'"]')
      .map(node=>node.querySelector('.iso-wall-side,.iso-wall-top,[data-hp-round-column],use[href="#hp-iso-translucent-cut-paint"]'))
      .map(node=>node ? getComputedStyle(node).fillOpacity : null))];
    const surfaces=all('.iso-opening-panel').map(node=>({
      kind:node.dataset.surface, fill:getComputedStyle(node).fill, alpha:getComputedStyle(node).fillOpacity,
    }));
    return {
      rotation:el.dataset.hpPlanRotation,
      yaw:el.querySelector('.plan-svg')?.dataset.yaw,
      mode:el.classList.contains('projection-iso')?'iso':'flat',
      backing:el.querySelector('.iso-wall-side-backing')?.getAttribute('fill')??null,
      basePaper:all('.iso-wall-base-paper').length,
      topStops:all('stop.iso-top-hi').map(node=>getComputedStyle(node).stopColor),
      side:seen('side'),top:seen('top'),surfaces,
      round:all('[data-hp-round-column]').length,
      apron:all('.iso-wall-side[data-surface="window-apron-side"]').length,
      lintelUnderside:all('.iso-wall-side[data-surface="opening-lintel-underside"]').length,
      background:getComputedStyle(el).getPropertyValue('--wall-fill-op'),
      stairLinks:all('[data-hp="stair"][data-id="wt-stairs"][role="link"]').length,
    };
  });
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
  const openingJoins=()=>stage.evaluate(el=>{
    const scene=window.__card._isoScene();
    const camera=scene.camera;
    const angle=camera.rotDeg*Math.PI/180;
    const tilt=camera.tiltDeg*Math.PI/180;
    const project=(x,y,z)=>{
      const dx=x-camera.origin[0],dy=y-camera.origin[1];
      return new DOMPoint(camera.origin[0]+camera.xyScale*(dx*Math.cos(angle)-dy*Math.sin(angle)),
        camera.origin[1]+camera.xyScale*(camera.floorScaleY??1)*(dx*Math.sin(angle)+dy*Math.cos(angle))
        -z*camera.zScale*Math.sin(tilt));
    };
    const pointAt=(basis,along,across,z)=>project(
      basis.axis.center[0]+basis.axis.tangent[0]*along+basis.axis.normal[0]*across,
      basis.axis.center[1]+basis.axis.tangent[1]*along+basis.axis.normal[1]*across,z);
    const door=scene.openings.find(basis=>basis.id==='wt-door');
    const windowBasis=scene.openings.find(basis=>basis.id==='wt-window');
    const doorHalf=Math.hypot(door.axis.end[0]-door.axis.start[0],door.axis.end[1]-door.axis.start[1])/2;
    const cap=el.querySelector('#hp-iso-translucent-cut-contour');
    const sill=[...el.querySelectorAll('path[data-id="wt-window"][data-surface="window-sill"]')];
    const apron=[...el.querySelectorAll('path[data-id="wt-window"][data-surface="window-apron-top"]')];
    const windowHalf=Math.hypot(windowBasis.axis.end[0]-windowBasis.axis.start[0],
      windowBasis.axis.end[1]-windowBasis.axis.start[1])/2;
    const sillSpansOpening=[-.8,-.4,0,.4,.8].every(t=>[-.5,-.3,0,.3,.5].some(v=>{
      const p=pointAt(windowBasis,t*windowHalf,v*windowBasis.face.depth,windowBasis.windowProfile.frameBottom);
      return sill.some(path=>path.isPointInFill(p));
    }));
    const continuousLintel=!!cap&&[doorHalf,-doorHalf].every(end=>[-.0008,0,.0008].every(delta=>
      [-.3,0,.3].every(v=>{
        const p=pointAt(door,end+delta,v*door.face.depth,door.wallHeight);
        return cap.isPointInFill(p)&&!cap.isPointInStroke(p);
      })));
    const bounds=el.getBoundingClientRect(), matrix=el.querySelector('.plan-svg').getScreenCTM();
    const floorSamples=[[720,450],[720,475]].map(([x,y])=>{
      const screen=project(x,y,0).matrixTransform(matrix);
      return [(screen.x-bounds.x)/bounds.width,(screen.y-bounds.y)/bounds.height];
    });
    return {sillSpansOpening,continuousLintel,floorSamples,
      apronOpacity:apron[0]?getComputedStyle(apron[0]).fillOpacity:null};
  });
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
  out.savedOptionIsLive=savedIso.mode==='iso'&&savedIso.side.includes('0.38')&&savedIso.top.includes('0.55');
  await page.evaluate(()=>window.__hpTest.setMode('plan'));
  out.planEditorKeepsFlat=(await signature()).mode==='flat';
  await page.evaluate(()=>window.__hpTest.setMode('view'));
  out.viewRestoresLocalOption=(await signature()).side.includes('0.38');

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
    const before=await signature(), opaque=await capture(name+'-white-base');
    await setMaterial(false);
    const off=await signature();
    out[name+'DefaultMatchesOff']=JSON.stringify(before)===JSON.stringify(off)&&off.backing==='#ffffff';
    await setMaterial(true);
    const after=await signature(), transparent=await capture(name+'-transparent');
    const joins=await openingJoins();
    out[name+'WindowSillAndApron']=joins.sillSpansOpening&&joins.apronOpacity==='0.55';
    out[name+'TopCutContinuousAtLintel']=joins.continuousLintel;
    out[name+'ExpectedViewDirection']=Number(after.yaw)%360===(dark?oppositeYaw:initialYaw%360);
    out[name+'Materials']=after.backing===null&&after.side.join()==='0.38'&&after.top.join()==='0.55'
      &&after.topStops.includes('rgb(157, 106, 57)')&&after.round>0&&after.apron>0
      &&after.surfaces.some(surface=>surface.kind.includes('glass'));
    out[name+'TranslucentMasonryRetainsFloorBase']=after.basePaper>0;
    const materialSignature=p=>new Set(p.surfaces
      .filter(surface=>surface.kind!=='jamb-reveal').map(surface=>JSON.stringify(surface)));
    const afterMaterials=materialSignature(after);
    out[name+'OpeningMaterialsUnchanged']=[...materialSignature(before)].every(s=>afterMaterials.has(s));
    out[name+'CameraUnchanged']=before.rotation===after.rotation&&before.yaw===after.yaw;
    out[name+'UniqueStairTarget']=after.stairLinks===1;
    out[name+'NoHiddenLintelUnderside']=after.lintelUnderside===0;
    out[name+'PixelsDiffer']=!opaque.equals(transparent);
  }
  // Compare a known colour painted below the real structural pass. Saturated
  // magenta cannot occur in this fixture and proves actual transmission.
  for(const [kind, side, top] of [['top',1,.55],['side',.38,1]]){
    await setMaterial(true,side,top);
    const before=PNG.sync.read(await stage.screenshot({animations:'disabled'}));
    const probe=await stage.evaluate((el,kind)=>{
      const selector=kind==='side'?'.iso-translucent-masonry-face[data-material="side"] > .iso-wall-side'
        :'.iso-translucent-masonry-face[data-material="top"]';
      const faces=[...el.querySelectorAll(selector)];
      const layers=el.querySelector('.iso-furniture-foreground');
      const ns='http://www.w3.org/2000/svg';
      const svg=layers.closest('svg');
      const coverage=Object.fromEntries(['top','side'].map(type=>[type,[...el.querySelectorAll(
        '.iso-translucent-masonry-face[data-material="'+type+'"]')].map(g=>g.querySelector('clipPath path')||g.querySelector('path'))]));
      const active=faces.map(face=>kind==='top'?face.querySelector('clipPath path'):face).filter(Boolean);
      const bounds=el.getBoundingClientRect(),matrix=svg.getScreenCTM(),points=[];
      for (const path of active) {
        const d=path.getAttribute('d');
        const paint=document.createElementNS(ns,'path');
        paint.setAttribute('d',d);
        paint.setAttribute('fill-rule','evenodd');
        paint.setAttribute('fill','#ff00ff');
        paint.setAttribute('data-transparency-probe','');
        layers.before(paint);
        const {x,y,width,height}=paint.getBBox();
        for(let i=1;i<8;i++)for(let j=1;j<8;j++){
          const point=new DOMPoint(x+i*width/8,y+j*height/8);
          if(!paint.isPointInFill(point)||coverage[kind==='top'?'side':'top'].some(p=>p?.isPointInFill(point)))continue;
          const screen=point.matrixTransform(matrix);
          if(screen.x<=bounds.left||screen.y<=bounds.top||screen.x>=bounds.right||screen.y>=bounds.bottom)continue;
          points.push([(screen.x-bounds.left)/bounds.width,(screen.y-bounds.top)/bounds.height]);
        }
      }
      return points;
    },kind);
    const after=PNG.sync.read(await stage.screenshot({animations:'disabled'}));
    await stage.evaluate(el=>el.querySelectorAll('[data-transparency-probe]').forEach(node=>node.remove()));
    const channelDiff=probe.filter(([x,y])=>{
      const offset=(Math.floor(y*before.height)*before.width+Math.floor(x*before.width))*4;
      return before.data[offset+1]-after.data[offset+1]>25&&after.data[offset+2]-before.data[offset+2]>20;
    }).length;
    out[kind+'TransmitsUnderlyingPixels']=channelDiff>0;
  }
  await setMaterial(true,1,1);
  const solid=await signature();
  out.fullOpacityDrawsBoth=solid.side.join()==='1'&&solid.top.join()==='1';
  await setMaterial(true,0,.55);
  const noSide=await signature();
  out.zeroSideOnly=noSide.side.length===0&&noSide.top.join()==='0.55'&&noSide.backing===null&&noSide.basePaper>0;
  await setMaterial(true,.38,0);
  const noTop=await signature();
  const noTopJoins=await openingJoins();
  out.fullyTransparentTopKeepsOnlyTheIndependentSill=noTopJoins.sillSpansOpening&&noTopJoins.apronOpacity===null;
  out.zeroTopOnly=noTop.side.join()==='0.38'&&noTop.top.length===0&&noTop.backing===null&&noTop.basePaper>0;
  await setMaterial(true,0,0);
  const clearWalls=await signature(), clearJoins=await openingJoins();
  out.fullyTransparentMasonryRetainsWindowSill=clearWalls.side.length===0&&clearWalls.top.length===0
    &&clearJoins.sillSpansOpening;
  const clearFrame=PNG.sync.read(await capture('both-wall-colours-transparent'));
  const [underColumn,nearbyFloor]=clearJoins.floorSamples.map(([x,y])=>{
    const offset=(Math.floor(y*clearFrame.height)*clearFrame.width+Math.floor(x*clearFrame.width))*4;
    return Array.from(clearFrame.data.subarray(offset,offset+3));
  });
  out.fullyTransparentWallShowsContinuousRoomColour=clearWalls.basePaper===0&&underColumn.length===3&&nearbyFloor.length===3
    &&underColumn.every((channel,index)=>Math.abs(channel-nearbyFloor[index])<=8);
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
    &&disabled.wall_fill.a===.38&&disabled.room_opacity===0&&(await signature()).backing==='#ffffff';
  if(reviewDir) await writeFile(join(reviewDir,'frames.json'),JSON.stringify({
    node:process.version,chromium:browser.version(),viewport:page.viewportSize(),dpr:1,frames,
  },null,2)+'\n');
  checkAll(out);
  await finish(browser,out);
} catch(error){
  await browser.close();
  throw error;
}
