// #1482: a member's body mask must not crop the overflowing shared glass.
import {mkdirSync,writeFileSync} from 'node:fs';
import {check,finish} from './serve.mjs';
import {startIsoPaintScene,settleIsoPaint,zoomIsoPaint} from './helpers/iso-paint-scene.mjs';
import {makeDeviceContactsFixture} from './golden/device-contacts.mjs';
import {compareInPage} from '../scripts/png-identical.mjs';

const dir=process.env.HP_ISO_CONTOUR_OUTPUT||'artifacts/1482';mkdirSync(dir,{recursive:true});
const evidence=[],negativeControls=[];
for(const dpr of [1,2]) {
  const {page,browser}=await startIsoPaintScene({width:1480,height:1080,dpr,configureFixture(fixture){
    Object.assign(fixture,makeDeviceContactsFixture());
    const s=fixture.config.spaces[0],source=fixture.config.markers;
    s.settings={...s.settings,fill_mode:'custom',custom_fill:{c:'#405c70',a:1}};
    s.rooms=[{id:'contour-room',name:'Fictional contour room',poly:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]}];
    s.partitions=[];s.walls=s.rooms[0].poly.map((a,i)=>({a,b:s.rooms[0].poly[(i+1)%4],cm:20}));
    const support=(20/1.2/2+45*.64375)/1000,pitch=45*1.14375/1000;
    const positions=[...Array.from({length:3},(_,i)=>[.1+support,.35+i*pitch]),
      ...Array.from({length:6},(_,i)=>[.3+i*pitch,.9-support]),
      ...Array.from({length:3},(_,i)=>[.9-support,.35+i*pitch]),
      ...Array.from({length:6},(_,i)=>[.3+i*pitch,.1+support]),
      [.4,.4],[.55,.4],[.5,.55],[.5+pitch,.55],[.5,.55+pitch]];
    fixture.config.markers=positions.map((_,i)=>({...source[i%source.length],id:`contour-${i}`,size:2,
      binding:i%3===0?'entity:sensor.contact_reference':'virtual',display:'static_icon',
      value_badge:i===19?{enabled:true,position:'right',source:{kind:'entity_state',entity_id:'sensor.contact_reference'}}:{enabled:false}}));
    fixture.layout=Object.fromEntries(positions.map(([x,y],i)=>[`contour-${i}`,{s:s.id,x,y}]));
    fixture.config.settings={...fixture.config.settings,volumetric_view:true,bg_color:'#303030',
      known_devices:[],new_device_ids:[],filter_seeded:true};
  }});
  try {
    await page.waitForFunction(()=>window.__isoPaint._deviceContacts?.scene?.shapes.size===23);
    const initial=await page.evaluate(()=>{const c=window.__isoPaint;
      return {layout:JSON.stringify(c._layout),config:JSON.stringify(c._serverCfg)};});
    let negativePixels=0;
    for(const dark of [false,true]) {
      await page.evaluate(async dark=>{const c=window.__isoPaint;c.hass={...c.hass,themes:{darkMode:dark}};await c.updateComplete;},dark);
      for(const rotation of [0,90,180,270]) {
        if(rotation){await page.locator('[data-hp="rotate-right"]').first().click();await settleIsoPaint(page);}
        for(const zoom of [.73,1,1.33,2.18,3.17]) {
          await zoomIsoPaint(page,zoom);
          await page.evaluate(()=>{const c=window.__isoPaint,root=c.renderRoot;
            const owners=[...root.querySelectorAll('.dev[data-hp-device-occlusion]')]
              .filter(n=>n.querySelector('.iso-marker-glass.rear')&&n.dataset.hpDeviceComponent);
            const target=owners[0]||root.querySelector('.dev[data-id="contour-4"]');
            const r=target.getBoundingClientRect(),s=root.querySelector('.stage').getBoundingClientRect(),v=c._view;
            c._applyView(c._zoom,v.x+v.w/2+(r.x+r.width/2-s.x-s.width/2)*v.w/s.width,
              v.y+v.h/2+(r.y+r.height/2-s.y-s.height/2)*v.h/s.height);c.requestUpdate();});
          await settleIsoPaint(page);
          const result=await page.evaluate(()=>{const root=window.__isoPaint.renderRoot;
            const devices=[...root.querySelectorAll('.dev[data-hp="device"]')];
            const masked=devices.filter(n=>n.hasAttribute('data-hp-device-occlusion'));
            const allGlass=[...root.querySelectorAll('.iso-marker-glass')];
            const clean=allGlass.every(n=>{for(let p=n;p&&!p.classList.contains('stage');p=p.parentElement)
              if(getComputedStyle(p).maskImage!=='none')return false;return true;});
            const registered=masked.every(n=>{const body=n.querySelector('.device-occlusion-body');
              if(!body||getComputedStyle(body).maskImage==='none')return false;
              const a=n.getBoundingClientRect(),b=body.getBoundingClientRect();
              return ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.05);});
            return {devices:devices.length,masked:masked.length,glass:allGlass.length,clean,registered,
              ownMasks:root.querySelectorAll('.iso-marker-glass g[mask]').length,
              groups:[...new Set(devices.map(n=>n.dataset.hpDeviceComponent).filter(Boolean))].length,
              virtual:root.querySelectorAll('.iso-marker-glass.virtual .glass-rim[stroke-dasharray="6 5"]').length,
              solid:root.querySelectorAll('.iso-marker-glass:not(.virtual) .glass-rim[stroke-dasharray="none"]').length};});
          const label=`DPR${dpr}/${dark?'dark':'light'}/${rotation}/${zoom}`;
          check(`${label}: glass has no inherited body mask`,result.clean&&result.glass>0);
          check(`${label}: body keeps its registered wall mask`,result.devices===23&&result.masked>0&&result.registered&&result.ownMasks>0);
          check(`${label}: individual and group ink keep virtual/physical styles`,result.groups>=4&&result.virtual>0&&result.solid>0);
          // Compare actual glass pixels with/without the legacy root mask.
          // Hide bodies but retain their boxes/occlusion state; glass keeps its
          // own masks. Old parent scoping changes these pixels, correct scoping
          // does not. This is a metamorphic oracle, not a new golden baseline.
          await page.evaluate(()=>{const root=window.__isoPaint.renderRoot,style=document.createElement('style');
            style.id='contour-probe';style.textContent='.device-shell,.device-pulse,.activity-dot,.newdot,.habadge,.lqi{visibility:hidden!important}';root.append(style);});
          const painted=await page.screenshot();
          await page.evaluate(()=>{const s=document.createElement('style');s.id='contour-mask-control';
            s.textContent='.dev[data-hp-device-occlusion]{mask:none!important}';window.__isoPaint.renderRoot.append(s);});
          const reference=await page.screenshot(),comparison=await compareInPage(page,painted,reference);
          check(`${label}: body masking cannot change glass pixels`,comparison.identical);
          if(rotation===0&&dark&&zoom===3.17){
            await page.evaluate(()=>{window.__isoPaint.renderRoot.querySelector('#contour-mask-control').textContent=
              '.dev[data-hp-device-occlusion]{mask:var(--hp-device-wall-mask)!important;mask-clip:no-clip}';});
            const legacy=await page.screenshot();negativePixels=(await compareInPage(page,reference,legacy)).differing;
            check(`DPR${dpr}: old parent scoping visibly fails the pixel oracle`,negativePixels>20);
            writeFileSync(`${dir}/dpr${dpr}-correct.png`,reference);writeFileSync(`${dir}/dpr${dpr}-legacy-negative.png`,legacy);
          }
          await page.evaluate(()=>{const r=window.__isoPaint.renderRoot;r.querySelector('#contour-probe').remove();r.querySelector('#contour-mask-control').remove();});
          evidence.push({label,...result,comparison});
        }
      }
      await page.locator('[data-hp="rotate-right"]').first().click();await settleIsoPaint(page);
    }
    const glassUnmasked=()=>page.evaluate(()=>[...window.__isoPaint.renderRoot.querySelectorAll('.iso-marker-glass')].every(n=>{
      for(let p=n;p&&!p.classList.contains('stage');p=p.parentElement)if(getComputedStyle(p).maskImage!=='none')return false;
      return true;
    }));
    const stage=await page.locator('.stage:not([inert])').first().boundingBox();
    const zoomBefore=await page.evaluate(()=>window.__isoPaint._zoom);
    await page.mouse.move(stage.x+30,stage.y+35);await page.mouse.wheel(0,-180);
    let wheelFrames=true;
    for(let i=0;i<5;i++){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));wheelFrames&&=await glassUnmasked();}
    await settleIsoPaint(page);
    check(`DPR${dpr}: native wheel keeps glass independent during and after zoom`,wheelFrames&&await glassUnmasked()
      &&await page.evaluate(z=>window.__isoPaint._zoom!==z,zoomBefore));
    const viewBefore=await page.evaluate(()=>JSON.stringify(window.__isoPaint._view));
    await page.mouse.move(stage.x+30,stage.y+35);await page.mouse.down();
    await page.mouse.move(stage.x+100,stage.y+70,{steps:5});const panFrame=await glassUnmasked();
    await page.mouse.up();await settleIsoPaint(page);
    check(`DPR${dpr}: native pan retains the same mask ownership`,panFrame&&await glassUnmasked()
      &&await page.evaluate(v=>JSON.stringify(window.__isoPaint._view)!==v,viewBefore));
    await page.evaluate(async()=>{const c=window.__isoPaint;c._serverCfg={...c._serverCfg,settings:{...c._serverCfg.settings,volumetric_view:false}};await c.updateComplete;});
    await settleIsoPaint(page);
    check(`DPR${dpr}: Flat has its original unwrapped face and no ISO mask`,await page.evaluate(()=>{
      const r=window.__isoPaint.renderRoot;return !r.querySelector('.device-occlusion-body,.iso-marker-glass')&&r.querySelectorAll('.device-contact-contour').length>0;
    }));
    await page.evaluate(async()=>{const c=window.__isoPaint;c._serverCfg={...c._serverCfg,settings:{...c._serverCfg.settings,volumetric_view:true}};await c.updateComplete;});
    await settleIsoPaint(page);
    check(`DPR${dpr}: projection changes restore one wrapper and ink per device`,await page.evaluate(()=>{
      const r=window.__isoPaint.renderRoot;return [...r.querySelectorAll('.dev[data-hp="device"]')].every(n=>
        n.querySelectorAll('.device-occlusion-body').length===1&&n.querySelectorAll('.device-contact-ink').length===1);
    }));
    check(`DPR${dpr}: navigation never writes or moves the plan`,await page.evaluate(initial=>{
      const c=window.__isoPaint;return JSON.stringify(c._layout)===initial.layout&&JSON.stringify(c._serverCfg)===initial.config
        &&window.__isoPaintWrites.length===0;
    },initial));
    negativeControls.push({dpr,differingPixels:negativePixels});
  }finally{await finish(browser);}
}
writeFileSync(`${dir}/results.json`,JSON.stringify({scenes:evidence,negativeControls},null,2));
