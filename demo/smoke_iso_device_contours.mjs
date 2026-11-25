// #1482 / #1514: physical outlines follow standalone and grouped devices,
// including wall contacts and wide values, through the shared 3D depth pass.
import { mkdirSync, writeFileSync } from 'node:fs';
import { check, finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { makeDeviceContactsFixture } from './golden/device-contacts.mjs';
import { compareInPage } from '../scripts/png-identical.mjs';

const dir=process.env.HP_ISO_CONTOUR_OUTPUT||'artifacts/1482';
mkdirSync(dir,{recursive:true});
const evidence=[];
for (const dpr of [1,2]) {
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
    const canvas=page.locator('canvas[data-hp-plan-3d-ready]');
    await canvas.waitFor({state:'attached'});
    await page.waitForFunction(()=>window.__isoPaint._deviceContacts?.scene?.shapes.size===23
      && window.__isoPaint._plan3dHost?.world.markerGlass.children.length>0);
    const initial=await page.evaluate(()=>({
      config:JSON.stringify(window.__isoPaint._serverCfg),layout:JSON.stringify(window.__isoPaint._layout),
    }));
    const snapshot=()=>page.evaluate(()=>{
      const card=window.__isoPaint, root=card.renderRoot, contacts=card._deviceContacts;
      const ids=new Set([...root.querySelectorAll('.dev[data-hp-3d-native]')].map(element=>element.dataset.id));
      const world=card._plan3dHost.world;
      const outlines=contacts.volumeOutlines(ids).filter(item=>item.outline);
      return {
        angle:card._rotation, count:world.markerGlass.children.length,
        layout:JSON.stringify(card._layout),config:JSON.stringify(card._serverCfg),writes:window.__isoPaintWrites.length,
        groups:outlines.map(group=>{
          const meshes=world.glassMeshes.get(group.id)?.meshes??[];
          const heights=meshes.map(({geometry})=>{
            const position=geometry.getAttribute('position');
            return [...new Set(Array.from({length:position.count},(_,i)=>position.getY(i)))].sort((a,b)=>a-b);
          });
          const attached=group.members.some(id=>Object.keys(contacts.scene.shapes.get(id).walls).length>0);
          return {...group,attached,heights,depthTest:meshes.every(mesh=>mesh.material.depthTest&&mesh.parent===world.markerGlass)};
        }),
      };
    });
    for (const darkMode of [false,true]) {
      await page.evaluate(darkMode=>{
        const card=window.__isoPaint;
        card.hass={...card.hass,themes:{...card.hass.themes,darkMode}};
      },darkMode);
      await settleIsoPaint(page);
      for (const angle of [0,45,90,135]) {
        for (const zoom of [1,2.18]) {
          await zoomIsoPaint(page,zoom);
          const frame=await snapshot();
          const label=`DPR${dpr}/${darkMode?'dark':'light'}/${angle}/${zoom}`;
          check(label+' follows the camera',frame.angle===angle);
          check(label+' draws exactly one glass body and rim per outline',frame.count===frame.groups.length*2 && frame.count>0);
          check(label+' displays singleton and shared outlines, attached groups and both styles',
            frame.groups.some(g=>g.members.length===1) && frame.groups.some(g=>g.members.length>=3&&g.attached)
            && frame.groups.some(g=>g.virtual) && frame.groups.some(g=>!g.virtual));
          check(label+' uses two physical elevations and the shared depth buffer',frame.groups.every(g=>
            g.depthTest&&g.heights.length===2&&g.heights.every(levels=>levels.length===2
              &&Math.abs(levels[1]-levels[0]-.24*g.diameter)<.001)));
          check(label+' pan, zoom and rotation preserve devices and config',frame.layout===initial.layout
            && frame.config===initial.config && frame.writes===0);
          evidence.push({label,groups:frame.groups.map(({id,members,virtual,attached})=>({id,members,virtual,attached}))});
          if (angle===45&&zoom===2.18) {
            const painted=await canvas.screenshot();
            const draw=async visible=>page.evaluate(async visible=>{
              const host=window.__isoPaint._plan3dHost;
              host.world.markerGlass.visible=visible;
              host.draw();
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            },visible);
            try {
              await draw(false);
              const control=await canvas.screenshot();
              check(label+' the native outlines contribute visible pixels',(await compareInPage(page,painted,control)).differing>50);
            } finally { await draw(true); }
            writeFileSync(`${dir}/dpr${dpr}-${darkMode?'dark':'light'}-45.png`,painted);
          }
        }
        await page.locator('[data-hp="rotate-right"]').first().click();
        await settleIsoPaint(page);
      }
      for (let step=0;step<4;step++) {
        await page.locator('[data-hp="rotate-right"]').first().click();
        await settleIsoPaint(page);
      }
    }
    await page.evaluate(async()=>{
      const card=window.__isoPaint;
      card._serverCfg={...card._serverCfg,settings:{...card._serverCfg.settings,volumetric_view:false}};
      await card.updateComplete;
    });
    await settleIsoPaint(page);
    check(`DPR${dpr}: 2D returns to its original contact ink`,await page.evaluate(()=>{
      const card=window.__isoPaint;
      return !card._plan3dHost && card.renderRoot.querySelectorAll('.device-contact-contour').length>0;
    }));
  } finally { await finish(browser); }
}
writeFileSync(`${dir}/results.json`,JSON.stringify({scenes:evidence},null,2));
