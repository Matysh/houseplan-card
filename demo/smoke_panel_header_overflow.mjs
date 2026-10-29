import { launchPanelCold, check, finish } from './serve.mjs';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';
import { requirePinnedBrowser } from '../scripts/browser-attestation.mjs';

requirePinnedBrowser('#1120 panel content overflow and public HA menu');
const { page, browser } = await launchPanelCold({width:1800,height:900});
const evidence = { widths: [], menu: [] };
try {
  await page.evaluate(async () => {
    history.replaceState(null,'','/houseplan');
    const host = document.getElementById('host');
    host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
    host.replaceChildren();
    const base = window.__mkHass(), original = base.callWS;
    window.__panelHeaderCalls = [];
    const hass = {...base,kioskMode:false,dockedSidebar:'always_hidden',
      localize:key=>key==='ui.sidebar.sidebar_toggle'?'Native sidebar':undefined,
      callWS:message=>{window.__panelHeaderCalls.push(message.type);return original(message);}};
    const panel = document.createElement('houseplan-panel');
    panel.panel = {component_name:'houseplan-panel'}; panel.route = {prefix:'/houseplan',path:''};
    panel.narrow = false; panel.hass = hass; host.append(panel);
    await import('/assets/houseplan-panel.js');
    await customElements.whenDefined('houseplan-panel');
    window.__overflowPanel = panel;
    window.__overflowEvents = [];
    panel.addEventListener('hass-toggle-menu',event=>window.__overflowEvents.push({
      bubbles:event.bubbles,composed:event.composed,
    }));
    window.__overflowRead = () => {
      const card=panel.shadowRoot?.querySelector('houseplan-card'),root=card?.shadowRoot;
      const head=root?.querySelector('.hdr>.head');
      if(!head) return null;
      const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const visible=e=>!!e&&e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden';
      const find=selector=>[...head.querySelectorAll(selector)].find(visible);
      const menu=find('[data-hp=panel-menu]'), picker=find('[data-hp=space-select]');
      const modes=find('.modes'),actions=find('.header-actions'),rotate=find('[data-hp=rotate-right]');
      return {head:box(head),stage:box(root.querySelector('.stage')),panel:box(panel),scroll:head.scrollWidth,
        menu:menu?box(menu):null,menuName:menu?.getAttribute('aria-label'),
        first:find('button')?.dataset.hp, picker:!!picker,
        labels:!!find('.panel-mode-full'),zoom:[...head.querySelectorAll('[data-hp^=zoom-]')].filter(visible).length,
        rotations:[...head.querySelectorAll('[data-hp^=rotate-]')].filter(visible).map(e=>box(e)),
        gear:!!find('[data-hp=header-menu]'),rows:actions&&menu&&box(actions).y>=box(menu).bottom?2:1,
        gap:modes&&actions?box(actions).x-box(modes).right:null,
        rightRadius:rotate?getComputedStyle(rotate).borderTopRightRadius:null,
        outer:!!panel.shadowRoot.querySelector('.appbar,.toolbar,.title'),
        metrics:root.querySelectorAll('.panel-header-metrics').length,
        mode:root.querySelector('ha-card')?.dataset.hpMode,
        controls:[...head.querySelectorAll('button')].filter(visible).map(e=>({kind:e.dataset.hp,rect:box(e)}))};
    };
    window.__overflowSettle = async () => {
      let previous='', stable=0;
      for(let frame=0;frame<30;frame++) {
        await new Promise(requestAnimationFrame);
        const read=window.__overflowRead(), value=JSON.stringify(read);
        stable = read&&value===previous ? stable+1 : 0; previous=value;
        if(stable>=2) return read;
      }
      throw Error('header did not settle after bounded native frames');
    };
  });
  await page.waitForFunction(()=>window.__overflowPanel?.shadowRoot?.querySelector('houseplan-card')
    ?.shadowRoot?.querySelector('ha-card[data-hp-state="ready"]'));
  await assertFreshDemoBundleUnlessAllowed(page);
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.spaces[0].title='Long ground floor with kitchen';
      cfg.spaces[1].title='Second floor with office';
      cfg.spaces.push({...structuredClone(cfg.spaces[0]),id:'third-header-floor',title:'Third floor with guest rooms',rooms:[]});
    });
    await window.__overflowSettle();
    window.__overflowCallBaseline=JSON.stringify(window.__panelHeaderCalls.filter(t=>/houseplan\/(config|layout)\/(get|set)/.test(t)));
  });
  // Resize the actual host at a fixed viewport: policy cannot use window breakpoints.
  for(const width of [1800,1600,1500,1400,1300,1200,1100,1050,1000,950,900,850,800,700,600,480,359,320,
    359,480,600,700,800,850,900,950,1000,1050,1100,1200,1300,1400,1500,1600,1800]) {
    const row=await page.evaluate(async width=>{
      document.getElementById('host').style.width=width+'px';
      return await window.__overflowSettle();
    },width);
    evidence.widths.push({width,...row});
  }
  for(const row of evidence.widths) {
    check('width'+row.width+'noOuterReserve',!row.outer&&Math.abs(row.head.y-row.panel.y)<=1);
    check('width'+row.width+'noHorizontalOverflow',row.scroll<=row.head.width+1);
    check('width'+row.width+'twoRowsMaximum',row.head.height<=140);
    check('width'+row.width+'menuFirst44',row.first==='panel-menu'&&row.menu?.width>=44&&row.menu?.height>=44);
    check('width'+row.width+'rotationRetained',row.rotations.length===2&&row.rotations.every(r=>r.width>=44&&r.height>=44));
    check('width'+row.width+'metricTreeRetired',row.metrics===0);
    if(row.rows===2) {
      const firstAction=row.controls.find(c=>c.kind==='rotate-left');
      check('width'+row.width+'wrappedActionsLeft',Math.abs(firstAction.rect.x-(row.head.x+12))<=1);
    }
    if(row.zoom===0) check('width'+row.width+'rotationEndRounded',parseFloat(row.rightRadius)>=6);
  }
  const classify=row=>row.rows===2?4:row.picker?3:row.zoom===0?2:row.labels?0:1;
  const down=evidence.widths.slice(0,18).map(classify), up=evidence.widths.slice(18).map(classify);
  check('allOrderedObservableStages',new Set(down).size===5);
  check('orderedReduction',down.every((phase,i)=>i===0||phase>=down[i-1]));
  check('reverseRestoration',up.every((phase,i)=>i===0||phase<=up[i-1])&&up.at(-1)===0);
  // Find the final single-row physical minimum: no guessed product threshold.
  const compact=evidence.widths.find(row=>classify(row)===3);
  if(compact) {
    let last=null;
    for(let width=compact.width;width>=320;width--) {
      const row=await page.evaluate(async width=>{
        document.getElementById('host').style.width=width+'px';return await window.__overflowSettle();
      },width);
      if(row.rows===2) break;
      last={width,...row};
    }
    evidence.lastSingleRow=last;
    check('physicalGapReaches10',!!last&&last.gap>=9.99&&last.gap<=11);
  } else check('physicalGapReaches10',false);
  await page.evaluate(async()=>{
    document.getElementById('host').style.width='320px';await window.__overflowSettle();
  });
  const gear=page.locator('houseplan-panel houseplan-card [data-hp=header-menu]');
  await gear.click();
  const items=await page.locator('houseplan-panel houseplan-card [data-hp=header-menu-item]').evaluateAll(nodes=>
    nodes.map(e=>({id:e.dataset.id,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  evidence.phoneItems=items;
  check('phoneKeepsAllWriterActions',['mode-plan','mode-devices','mode-decor','space-settings','space-add',
    'settings','pdf','support','hidden-devices'].every(id=>items.some(item=>item.id===id)));
  check('phoneMenuTargets44',items.every(item=>item.width>=44&&item.height>=44));
  await page.keyboard.press('Escape');
  check('phoneEscapeRestoresVisibleTrigger',await gear.evaluate(e=>e.getRootNode().activeElement===e));
  const card=page.locator('houseplan-panel houseplan-card');
  // All modes remain reachable from the real phone menu; the retained close
  // control keeps its existing 24px contract and returns to the same View.
  for(const mode of ['plan','devices','decor']) {
    await gear.click();
    await card.locator('[data-hp=header-menu-item][data-id=mode-'+mode+']').click();
    await page.waitForFunction(mode=>{
      const r=window.__overflowPanel.shadowRoot.querySelector('houseplan-card').shadowRoot;
      return r.querySelector('ha-card')?.dataset.hpMode===mode
        &&!r.querySelector('.editorchrome.transitioning')&&!r.querySelector('.stage')?.inert;
    },mode);
    const state=await page.evaluate(()=>window.__overflowSettle());
    evidence['phoneEditor'+mode]=state;
    check('phoneEditor'+mode+'twoRows',state.rows===2&&state.head.height<=140);
    const close=card.locator('.hdr>.head [data-hp=editor-close]');
    check('phoneEditor'+mode+'close24',await close.evaluate(e=>{
      const r=e.getBoundingClientRect();return r.width>=24&&r.height>=24;
    }));
    await close.click();
    await page.waitForFunction(()=>{
      const r=window.__overflowPanel.shadowRoot.querySelector('houseplan-card').shadowRoot;
      return r.querySelector('ha-card')?.dataset.hpMode==='view'&&!r.querySelector('.editorchrome.transitioning');
    });
    const view=await page.evaluate(()=>window.__overflowSettle());
    check('phoneEditor'+mode+'fillsPanel',view.stage.height>0
      &&Math.abs(view.stage.height+view.head.height-view.panel.height)<=1);
  }
  await page.evaluate(async()=>{document.getElementById('host').style.width='1280px';await window.__overflowSettle();});
  const savedView=await card.locator('.plan-svg').getAttribute('viewBox');
  for(const mode of ['plan','devices','decor']) {
    await card.locator('[data-hp=mode-tab][data-mode='+mode+']').click();
    await page.waitForFunction(mode=>{
      const r=window.__overflowPanel.shadowRoot.querySelector('houseplan-card').shadowRoot;
      return r.querySelector('ha-card')?.dataset.hpMode===mode
        &&!r.querySelector('.editorchrome.transitioning')&&!r.querySelector('.stage')?.inert;
    },mode);
    await page.evaluate(()=>window.__overflowSettle());
    const wide=await card.evaluate(element=>{
      const root=element.shadowRoot,head=root.querySelector('.head'),hdr=root.querySelector('.hdr');
      const h=head.getBoundingClientRect(),stage=root.querySelector('.stage').getBoundingClientRect();
      const properties=root.querySelector('[data-hp=properties-panel]')?.getBoundingClientRect();
      const controls=[...head.querySelectorAll('button,hp-settings-select')].filter(e=>e.getBoundingClientRect().width>0);
      const boxes=controls.map(e=>{const r=e.getBoundingClientRect(),hit=root.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return{kind:e.dataset.hp,inHead:r.x>=h.x-.01&&r.right<=h.right+.01,hit:hit===e||e.contains(hit)};});
      const vb=root.querySelector('.plan-svg').viewBox.baseVal;
      return{headWidth:h.width,cardWidth:element.getBoundingClientRect().width,propertiesWidth:properties?.width,
        fits:head.scrollWidth<=h.width+1,boxes,positive:stage.width>0&&stage.height>0,
        height:Math.abs(stage.height+hdr.getBoundingClientRect().height-element.getBoundingClientRect().height)<=1,
        cameraAspect:Math.abs(vb.width/vb.height-stage.width/stage.height)<.01};
    });
    evidence['wideEditor'+mode]=wide;
    check('wideEditor'+mode+'usesAllocatedHead',wide.headWidth<wide.cardWidth&&wide.propertiesWidth===360);
    check('wideEditor'+mode+'allControlsFitAndHit',wide.fits&&wide.boxes.every(b=>b.inHead&&b.hit));
    check('wideEditor'+mode+'heightAndCamera',wide.positive&&wide.height&&wide.cameraAspect);
    await card.locator('.hdr>.head [data-hp=editor-close]').click();
    await page.waitForFunction(()=>{
      const r=window.__overflowPanel.shadowRoot.querySelector('houseplan-card').shadowRoot;
      return r.querySelector('ha-card')?.dataset.hpMode==='view'&&!r.querySelector('.editorchrome.transitioning');
    });
    await page.evaluate(()=>window.__overflowSettle());
    const restored=await card.locator('.plan-svg').getAttribute('viewBox');
    check('wideEditor'+mode+'restoresViewCamera',restored.split(/\s+/).every((v,i)=>Math.abs(+v-+savedView.split(/\s+/)[i])<1e-5));
  }
  await page.evaluate(async()=>{document.getElementById('host').style.width='320px';await window.__overflowSettle();});
  // A real dirty dialog retains its text and focus across layout changes and
  // Keep; Discard closes without writing the server plan.
  await gear.click();
  await card.locator('[data-hp=header-menu-item][data-id=space-settings]').click();
  const form=card.locator('hp-dialog[data-kind=space]');
  const title=form.locator('input[data-field$="-title"]');
  await title.fill('Unfinished header resize');
  await page.evaluate(async()=>{document.getElementById('host').style.width='600px';await window.__overflowSettle();});
  check('dirtyResizePreservesTextAndFocus',await title.evaluate(e=>e.value==='Unfinished header resize'
    &&e.getRootNode().activeElement===e));
  await page.keyboard.press('Escape');
  await card.locator('hp-confirm .btn[data-hp=dialog-cancel]').click();
  check('dirtyKeepPreservesTextAndFocus',await title.evaluate(e=>e.value==='Unfinished header resize'
    &&e.getRootNode().activeElement===e));
  await page.keyboard.press('Escape');
  await card.locator('hp-confirm [data-hp=dialog-confirm]').click();
  await form.waitFor({state:'detached'});
  await page.evaluate(async()=>{document.getElementById('host').style.width='320px';await window.__overflowSettle();});
  check('dirtyDiscardReturnsToView',await card.locator('ha-card').getAttribute('data-hp-mode'),'view');
  // Actual pointer and Enter must each emit one public event.
  const menu=page.locator('houseplan-panel houseplan-card [data-hp=panel-menu]');
  await menu.click();await menu.focus();await page.keyboard.press('Enter');
  check('nativePointerAndEnterPublicEvents',await page.evaluate(()=>window.__overflowEvents.length===2
    &&window.__overflowEvents.every(e=>e.bubbles&&e.composed)));
  // Mutate the same public HA object, including fields absent on minimum HA.
  for(const [name,patch,narrow,expected] of [
    ['wideAuto',{kioskMode:false,dockedSidebar:'auto'},false,false],
    ['narrowAuto',{kioskMode:false,dockedSidebar:'auto'},true,true],
    ['wideHidden',{kioskMode:false,dockedSidebar:'always_hidden'},false,true],
    ['nativeKiosk',{kioskMode:true,dockedSidebar:'always_hidden'},true,false],
    ['externalSidebar',{kioskMode:false,dockedSidebar:'always_hidden',auth:{external:{config:{hasSidebar:true}}}},true,false],
    ['minimumAbsent',{dockedSidebar:'auto'},true,true],
  ]) {
    const row=await page.evaluate(async({patch,narrow})=>{
      const panel=window.__overflowPanel,hass=panel.hass;
      delete hass.kioskMode; delete hass.auth;Object.assign(hass,patch);
      panel.narrow=narrow;panel.hass=hass;
      return await window.__overflowSettle();
    },{patch,narrow});
    evidence.menu.push({name,...row});
    check('publicPolicy'+name,!!row.menu===expected);
  }
  await page.evaluate(async()=>{
    const panel=window.__overflowPanel;
    panel.narrow=false;panel.hass={...panel.hass,kioskMode:false,dockedSidebar:'always_hidden'};
    document.getElementById('host').style.width='1800px';await window.__overflowSettle();
  });
  const firstSpace=card.locator('[data-hp=space-tab]').first();
  await firstSpace.focus();
  await page.evaluate(async()=>{document.getElementById('host').style.width='800px';await window.__overflowSettle();});
  check('focusedTabTransfersToPicker',await card.locator('[data-hp=space-select]').evaluate(e=>
    e.shadowRoot?.activeElement===e.shadowRoot?.querySelector('[data-hp=select-trigger]')));
  await card.locator('[data-hp=space-select] [data-hp=select-trigger]').focus();
  await page.evaluate(async()=>{document.getElementById('host').style.width='1800px';await window.__overflowSettle();});
  check('focusedPickerTransfersToCurrentTab',await card.locator('[data-hp=space-tab][aria-current=page]').evaluate(e=>
    e.getRootNode().activeElement===e));
  await card.locator('[data-hp=zoom-in]').focus();
  await page.evaluate(async()=>{document.getElementById('host').style.width='1000px';await window.__overflowSettle();});
  check('hiddenZoomFocusTransfersToRotation',await card.locator('[data-hp=rotate-right]').evaluate(e=>
    e.getRootNode().activeElement===e));
  await page.evaluate(async()=>{document.getElementById('host').style.width='1800px';await window.__overflowSettle();});
  await card.locator('[data-hp=mode-tab][data-mode=plan]').focus();
  await page.evaluate(async()=>{document.getElementById('host').style.width='320px';await window.__overflowSettle();});
  check('phoneEditorFocusTransfersToGear',await gear.evaluate(e=>e.getRootNode().activeElement===e));
  await page.evaluate(async()=>{
    const outside=document.createElement('button');outside.id='native-outside-focus';outside.textContent='Outside header';
    document.body.append(outside);outside.focus();
    document.getElementById('host').style.width='1800px';await window.__overflowSettle();
  });
  check('resizeDoesNotStealOutsideFocus',await page.locator('#native-outside-focus').evaluate(e=>document.activeElement===e));
  await page.evaluate(()=>document.getElementById('native-outside-focus').remove());
  // Same owner width, real public locale changes: captions must update while
  // the original full accessible names remain attached to compact controls.
  for(const [language,labels] of [['ru',['План','Устройства','Подложка']],['en',['Plan','Devices','Background']]]) {
    await page.evaluate(async language=>{
      const panel=window.__overflowPanel;panel.hass={...panel.hass,language,locale:{...panel.hass.locale,language}};
      await window.__overflowSettle();
    },language);
    const text=await card.locator('.modetab .panel-mode-full:not(ha-icon)').allTextContents();
    check('locale'+language+'ShortCaptions',text,labels);
  }
  check('resizeAndHATicksDoNotReadOrWriteConfig',await page.evaluate(()=>JSON.stringify(
    window.__panelHeaderCalls.filter(t=>/houseplan\/(config|layout)\/(get|set)/.test(t)))===window.__overflowCallBaseline));
  // Observe native probe nodes from the test, without replacing product
  // methods or constructors. Unchanged HA values must reuse the settled memo.
  const probes=await page.evaluate(async()=>{
    const panel=window.__overflowPanel,root=panel.shadowRoot.querySelector('houseplan-card').shadowRoot;
    let measurements=0;
    const observer=new MutationObserver(records=>{
      for(const record of records) for(const node of record.addedNodes)
        if(node instanceof Element&&node.classList.contains('panel-header-metrics')) measurements++;
    });
    observer.observe(root,{subtree:true,childList:true});
    for(let i=0;i<12;i++) { panel.hass={...panel.hass};await new Promise(requestAnimationFrame); }
    await window.__overflowSettle();observer.disconnect();return measurements;
  });
  check('unchangedHATicksReuseHeaderMeasurement',probes,0);
  const content=await page.evaluate(async()=>{
    const panel=window.__overflowPanel;
    document.getElementById('host').style.width='1200px';await window.__overflowSettle();
    const long=window.__overflowRead();
    await window.__hpTest.setServerConfig(cfg=>cfg.spaces.forEach((space,i)=>{space.title=['A','B','C'][i];}));
    const short=await window.__overflowSettle();return{long,short};
  });
  evidence.sameWidthContent=content;
  check('sameWidthShorterRosterRestoresEarlierStage',content.long.head.width===content.short.head.width
    &&classify(content.short)<classify(content.long));
  await page.evaluate(async()=>{
    document.getElementById('host').style.width='320px';await window.__overflowSettle();
  });
  await gear.click();
  const lifecycle=await page.evaluate(async()=>{
    const panel=window.__overflowPanel,card=panel.shadowRoot.querySelector('houseplan-card');
    const oldMenu=card.shadowRoot.querySelector('#hp-header-menu'),host=panel.parentElement;
    panel.remove();await new Promise(requestAnimationFrame);host.append(panel);
    await card.updateComplete;const current=await window.__overflowSettle();
    return{sameCard:panel.shadowRoot.querySelector('houseplan-card')===card,
      oldMenuRetired:!oldMenu.isConnected&&!card.shadowRoot.querySelector('#hp-header-menu'),current};
  });
  evidence.lifecycle=lifecycle;
  check('detachRetiresPopupAndKeepsOneCard',lifecycle.sameCard&&lifecycle.oldMenuRetired);
  check('remountSettlesFullPanel',lifecycle.current.stage.height>0
    &&Math.abs(lifecycle.current.head.height+lifecycle.current.stage.height-lifecycle.current.panel.height)<=1);
} catch(error) {
  check('nativeRuntimeCompletes',false); throw error;
} finally {
  console.log('HP_PANEL_HEADER_EVIDENCE '+JSON.stringify(evidence));
  await finish(browser);
}
