// #1171: real read-only card, shared symbol geometry, masonry and lifecycle.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { makeStaticWallOpeningsFixture } from './fixtures/static-wall-openings.mjs';
requirePinnedBrowser('static-wall-openings-1171');
const {page,browser}=await launch({width:1100,height:900},1,[],{hasTouch:true});
const out=await page.evaluate(async ({fixture,diagonalFixture,linePlanFixture,beforeOnly})=>{
  const T=window.__hpTest,c=window.__card, result={};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const until=async predicate=>{const end=performance.now()+6000;while(!predicate()){if(performance.now()>end)throw Error('1171 fixture did not settle '+JSON.stringify({transform:root()?.querySelector('[data-id="wall-door"]')?.getAttribute('transform'),opening:el._snap?.config?.spaces[0]?.openings?.[0],result}));await frame();}};
  await T.waitForWrites(); await T.setServerConfig(fixture);
  const host=document.createElement('div');host.style.width='780px';document.body.append(host);
  const el=document.createElement('houseplan-space-card');
  const config={type:'custom:houseplan-space-card',space:'f1',title:'',show_button:false,fit:'house'};
  el.setConfig(config);el.hass=c.hass;host.append(el);
  const root=()=>el.shadowRoot;
  await until(()=>root()?.querySelector('.hp-static-plan-svg'));
  const update=async()=>{await el.updateComplete;await c.updateComplete;await frame();};
  const opening=(id,r=root())=>r?.querySelector(`[data-hp="opening"][data-id="${id}"]`);
  const solid=(x,y)=>[...root().querySelectorAll('.wallbodies path')].some(p=>p.isPointInFill(new DOMPoint(x,y)));
  const shape=node=>node ? [node,...node.querySelectorAll('*')].map(n=>[n.tagName,
    ['transform','d','x','y','x1','y1','x2','y2','width','height','stroke-width','stroke-dasharray','stroke-dashoffset','style'].map(k=>n.getAttribute(k))]) : null;
  const sameSymbol=id=>{
    const a=opening(id),b=opening(id,c.shadowRoot);
    return !!a&&!!b&&a.getAttribute('transform')===b.getAttribute('transform')
      &&JSON.stringify(shape(a.firstElementChild))===JSON.stringify(shape(b.firstElementChild));
  };
  const box=()=>root().querySelector('.hp-static-plan-svg').getAttribute('viewBox');
  window.__static1171=el;window.__host1171=host;
  await update();
  const expected=['wall-door','shared-window','outer-gate','legacy-window','partition-door'];
  result.eachVisibleOnce=expected.every(id=>root().querySelectorAll(`[data-hp="opening"][data-id="${id}"]`).length===1);
  result.fullStaticSymbolParity=expected.every(sameSymbol);
  result.wallCutsAndSolidControl=!solid(375,187.5)&&!solid(625,437.5)&&!solid(800,812.5)
    &&!solid(975,375)&&!solid(625,687.5)&&solid(160,187.5)&&solid(625,300);
  result.passageHasNoVisibleSymbol=!opening('shared-passage')?.querySelector('line,path,rect,.op-leaf');
  result.sharedWindowTunnel=!!root().querySelector('.static-opening-tunnels [data-id="shared-window"]');
  if(beforeOnly)return result;
  const before=JSON.stringify(fixture);
  const servicesBefore=window.__serviceCalls?.length||0;
  let info=0;el.addEventListener('hass-more-info',()=>info++);
  opening('wall-door')?.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
  opening('wall-door')?.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true,composed:true}));
  await update();
  result.readOnlyNoHits=!root().querySelector('.op-hit,.oplock,.opinfo')&&info===0
    &&(window.__serviceCalls?.length||0)===servicesBefore&&JSON.stringify(fixture)===before;

  // Config events use the same public path as another HA client's save.
  await T.setServerConfig(cfg=>{cfg.spaces[0].openings[0].contact='cover.synthetic_door';});
  await until(()=>el._snap?.config?.spaces?.[0]?.openings?.[0]?.contact==='cover.synthetic_door');
  const contact=id=>({entity_id:'cover.synthetic_door',state:id,attributes:{current_position:0}});
  const states=async(state,pos)=>{
    const e={...contact(state),attributes:{current_position:pos}};
    const hass={...c.hass,states:{...c.hass.states,'cover.synthetic_door':e}};
    c.hass=hass;el.hass=hass;await update();
  };
  const stableBox=box();
  await states('closed',0);const shut=opening('wall-door')?.querySelector('.op-leaf')?.getAttribute('style');
  await states('open',50);const partial=opening('wall-door')?.querySelector('.op-leaf')?.getAttribute('style');
  await states('open',100);const open=opening('wall-door')?.querySelector('.op-leaf')?.getAttribute('style');
  result.contactMovesLeafWithoutRefit=!!shut&&shut!==partial&&partial!==open&&box()===stableBox&&sameSymbol('wall-door');
  const geometryBefore=root().querySelector('.wallbodies')?.innerHTML;
  await states('unavailable',null);
  result.contactDoesNotChangeMasonry=root().querySelector('.wallbodies')?.innerHTML===geometryBefore&&box()===stableBox;
  const withoutContact={...c.hass.states};delete withoutContact['cover.synthetic_door'];
  const missingHass={...c.hass,states:withoutContact};c.hass=missingHass;el.hass=missingHass;await update();
  const leafFill=(r)=>opening('wall-door',r)?.querySelector('.op-leaf rect')?.getAttribute('fill');
  result.missingContactHasFullPlanNeutralTone=leafFill(root())===leafFill(c.shadowRoot)&&box()===stableBox;
  await T.setServerConfig(cfg=>{cfg.spaces[0].openings[0].invert=true;});
  await until(()=>el._snap?.config?.spaces[0].openings[0].invert===true);
  await states('closed',0);
  result.invertUsesCommonState=opening('wall-door')?.querySelector('.op-leaf')?.getAttribute('style')===open&&sameSymbol('wall-door');

  await T.setServerConfig(cfg=>{const o=cfg.spaces[0].openings[0];o.x=.45;o.host.t=.65;o.length=.08;});
  await until(()=>opening('wall-door')?.getAttribute('transform')?.includes('450'));
  result.moveResizeRefreshesCut=solid(335,187.5)&&!solid(450,187.5)&&sameSymbol('wall-door');
  await T.setServerConfig(cfg=>{cfg.spaces[0].openings=cfg.spaces[0].openings.filter(o=>o.id!=='wall-door');});
  await until(()=>!opening('wall-door'));
  result.deleteRestoresMasonry=solid(450,187.5);
  await T.setServerConfig(cfg=>{cfg.spaces[0].openings.unshift(structuredClone(fixture.spaces[0].openings[0]));});
  await until(()=>!!opening('wall-door'));
  result.recreateRestoresCut=!solid(375,187.5)&&sameSymbol('wall-door');

  await T.setServerConfig(cfg=>{cfg.spaces[0].settings.show_borders=false;});
  await until(()=>!opening('wall-door'));
  result.hideBordersAlsoHidesOpenings=!root().querySelector('.wallbodies');
  await T.setServerConfig(structuredClone(fixture));
  await until(()=>!!opening('wall-door')&&!!root().querySelector('.wallbodies'));
  result.showRestoresPhysicalCut=!solid(375,187.5)&&sameSymbol('wall-door');
  await T.setServerConfig(cfg=>{const o=cfg.spaces[0].openings[0];o.x=.54;o.host.t=.83;});
  await until(()=>opening('wall-door')?.getAttribute('transform')?.includes('540'));
  result.nearUnequalWallJunctionKeepsCutAndJamb=!solid(540,187.5)&&solid(620,187.5)&&sameSymbol('wall-door');
  await T.setServerConfig(structuredClone(fixture));await until(()=>opening('wall-door')?.getAttribute('transform')?.includes('375'));

  let parity=true;
  for(const flip_h of [false,true])for(const flip_v of [false,true]){
    await T.setServerConfig(cfg=>{for(const o of cfg.spaces[0].openings)Object.assign(o,{flip_h,flip_v});});
    await until(()=>opening('wall-door')?.firstElementChild?.getAttribute('transform')===`scale(${flip_h?-1:1} ${flip_v?-1:1})`);
    parity&&=expected.every(sameSymbol);
  }
  result.allFlipsPreserveFullParity=parity;
  await T.setServerConfig(structuredClone(fixture));await update();
  const paintedInside=()=>{
    const svg=root().querySelector('.hp-static-plan-svg'),b=svg.getBoundingClientRect();
    return [...svg.querySelectorAll('.static-opening line,.static-opening path,.static-opening rect')].every(n=>{
      const r=n.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1;
    });
  };
  let fits=true;
  for(const fit of ['house','content'])for(const width of [780,360]){
    host.style.width=`${width}px`;el.setConfig({...config,fit});await update();
    await new Promise(resolve=>setTimeout(resolve,80));await update();
    fits&&=paintedInside();
    const initial=box();el.hass={...el.hass,states:{...el.hass.states}};await update();fits&&=box()===initial;
  }
  result.desktopPhoneBothFitsIncludeSymbols=fits;
  host.style.width='780px';el.setConfig(config);await update();

  const nodeBeforeSpace=opening('wall-door');
  await T.setServerConfig(cfg=>{const other=structuredClone(cfg.spaces[0]);other.id='other';other.title='Other';other.openings[0].flip_h=true;cfg.spaces.push(other);});
  el.setConfig({...config,space:'other'});await T.switchSpace('other');
  await until(()=>root().querySelector('.hp-static-stage')&&opening('wall-door')!==nodeBeforeSpace);
  result.sameIdAcrossSpacesGetsFreshNode=!!opening('wall-door')&&opening('wall-door')!==nodeBeforeSpace&&sameSymbol('wall-door');
  el.setConfig(config);await T.switchSpace('f1');await update();
  await T.setServerConfig(cfg=>{cfg.spaces[0].openings[0].host={kind:'partition',id:'divider',t:.7};cfg.spaces[0].openings.find(o=>o.id==='partition-door').host.t=.2;});
  await until(()=>opening('wall-door')?.getAttribute('transform')?.includes('562.5'));
  result.rehostRefreshesBothBodies=solid(375,187.5)&&!solid(425,562.5)&&sameSymbol('wall-door');
  await T.setServerConfig(diagonalFixture);
  await until(()=>opening('wall-door')?.getAttribute('transform')?.includes('rotate(45)'));
  result.diagonalSharesFaceCutAndFrame=expected.every(sameSymbol)&&paintedInside()
    &&!solid((.5+(.375-.1875)/Math.SQRT2)*1000,(.5+(.375+.1875-1)/Math.SQRT2)*1000);
  c.shadowRoot.querySelector('[data-hp="rotate-right"]').click();
  await until(()=>root().querySelector('.hp-static-stage')?.getAttribute('data-hp-plan-rotation')==='90');
  await update();result.quarterTurnKeepsSymbolsInFrame=paintedInside();
  c.shadowRoot.querySelector('[data-hp="rotate-left"]').click();
  await until(()=>root().querySelector('.hp-static-stage')?.getAttribute('data-hp-plan-rotation')==='0');
  await T.setServerConfig(linePlanFixture);
  await until(()=>el._snap?.config?.spaces[0].walls?.length===0);
  await update();
  result.linePlanMixedGateDoorWindowParity=expected.every(sameSymbol)&&paintedInside();
  await T.setServerConfig(fixture);await until(()=>el._snap?.config?.spaces[0].walls?.length===7);
  await update();

  window.__static1171=el;window.__host1171=host;
  return result;
},{fixture:makeStaticWallOpeningsFixture(),diagonalFixture:makeStaticWallOpeningsFixture({diagonal:true}),linePlanFixture:makeStaticWallOpeningsFixture({linePlan:true}),beforeOnly:process.argv.includes('--before')});
if(!process.argv.includes('--before')){
  const target=page.locator('houseplan-space-card .static-opening[data-id="wall-door"]');
  await target.scrollIntoViewIfNeeded();const r=await target.boundingBox();
  const snapshot=()=>page.evaluate(()=>({calls:window.__serviceCalls.length,revision:window.__servedRevision.config,info:!!window.__static1171.shadowRoot.querySelector('.opinfo,hp-dialog')}));
  const before=await snapshot();
  await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  out.nativeMouseTouchRemainReadOnly=JSON.stringify(await snapshot())===JSON.stringify(before);
}
if(process.env.HP_STATIC_OPENINGS_CAPTURE){
  const prefix=process.env.HP_STATIC_OPENINGS_CAPTURE;
  await page.locator('houseplan-card').screenshot({path:`${prefix}-full.png`});
  await page.evaluate(()=>{document.querySelector('houseplan-card').style.display='none';});
  await page.locator('houseplan-space-card').screenshot({path:`${prefix}-static.png`});
}
checkAll(out);
await finish(browser,out);
