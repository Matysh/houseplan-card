/** #1538: projected capsule, contact topology and layer order on the two approved floors. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { check, finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { makeIsoDevicePresentationFixture } from './fixtures/iso-device-presentation.mjs';
import { compareInPage } from '../scripts/png-identical.mjs';

const dir = process.env.HP_ISO_VALUE_OUTPUT;
if (dir) mkdirSync(dir,{recursive:true});
const measurements=[];
for (const angled of [false,true]) {
  const {page,browser} = await startIsoPaintScene({configureFixture:fixture =>
    Object.assign(fixture,makeIsoDevicePresentationFixture(angled))});
  const read = () => page.evaluate(() => {
    const card=window.__isoPaint, root=card.renderRoot, scene=card._deviceContacts.scene;
    const all=[...root.querySelectorAll('.devlayer > .dev[data-hp="device"]')];
    const shape = {};
    const values = {};
    const stackIssues = [];
    for (const members of scene.components(scene.shapes.keys())) {
      const set=new Set(members.map(({marker})=>marker.id));
      const nodes=all.filter(node=>set.has(node.dataset.id));
      const rear=nodes.flatMap(node=>[...node.querySelectorAll('.iso-marker-glass.rear')]);
      const front=nodes.flatMap(node=>[...node.querySelectorAll('.iso-marker-glass.front')]);
      // At some angles the wall owns the entire edge on one side; that
      // empty half emits no SVG. A free component must have both halves.
      const onWall=members.some(s=>Object.keys(s.walls).length>0);
      const agrees = rear.length<=1 && front.length<=1 && rear.length+front.length>=(onWall?1:2)
        && (!rear.length||rear[0].closest('.dev')===nodes[0])
        && (!front.length||front[0].closest('.dev')===nodes.at(-1))
        && [...rear,...front].every(svg=>svg.querySelectorAll('.glass-rim').length===2);
      if (!agrees) stackIssues.push({members: nodes.map(n=>n.dataset.id), rear:rear.map(n=>n.closest('.dev').dataset.id), front:front.map(n=>n.closest('.dev').dataset.id)});
      for (const s of members) shape[s.marker.id]={walls:s.walls,angle:s.angle,
        center:[s.marker.x,s.marker.y],member:[...set].sort()};
    }
    for (const node of all) {
      const shell=node.querySelector('.device-shell');
      const measure=(pill,content)=>{
        const {x,y,width,height}=pill.getBoundingClientRect();
        const midpoint={x:x+width/2,y:y+height/2};
        const stage=root.querySelector('.stage').getBoundingClientRect();
        const visible=midpoint.x>stage.left && midpoint.x<stage.right && midpoint.y>stage.top && midpoint.y<stage.bottom;
        const txt=content.getBoundingClientRect();
        return {turn:getComputedStyle(pill).rotate,textTurn:getComputedStyle(content).rotate, text:content.textContent.trim(),
          contains:txt.x>=x-.1&&txt.y>=y-.1&&txt.right<=x+width+.1&&txt.bottom<=y+height+.1,
          owner:visible ? card._deviceHitOwnerAt(midpoint.x,midpoint.y)?.id ?? null : undefined};
      };
      if(node.dataset.id==='straight'||node.dataset.id.endsWith('pill-0')||node.dataset.id.endsWith('pill-1')) {
        const core=node.querySelector('.device-core'), text=core?.querySelector('.valtext');
        if(!text)continue;
        const badge=node.querySelector('.value-badge');
        values[node.dataset.id]={core:measure(core,text),badge:badge&&measure(badge,badge.querySelector('.value-badge-content')),
          shift:[...['x','y'].map(axis=>Number(shell.style.getPropertyValue('--hp-value-shift-'+axis)))]};
      }
    }
    let wallGapError = null, outlineGapError = null;
    const wallMarker = all.find(node=>node.dataset.id==='straight');
    const wallShape = shape.straight;
    if (wallMarker && wallShape && Object.keys(wallShape.walls).length) {
      // Compare real DOM cap supports with CSS rotation/offset reset in place.
      // Sample the rounded faces independently from the production support solver.
      const outline=wallMarker.querySelector('.device-contact-hit');
      const svg=outline.ownerSVGElement;
      const plan=svg.getScreenCTM().inverse();
      const unit=svg.viewBox.baseVal.width/parseFloat(getComputedStyle(wallMarker).width);
      const row = [...wallMarker.querySelectorAll('.device-core,.value-badge')];
      const measure = () => {
        const points = row.flatMap(pill=>{
          const css=getComputedStyle(pill), box=pill.getBoundingClientRect();
          const at=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(plan);
          const w=parseFloat(css.width)/2,h=parseFloat(css.height)/2;
          const [first, second=first]=css.borderTopLeftRadius.split(' ');
          const r=(value,half)=>Math.min(half,value.endsWith('%')?2*half*parseFloat(value)/100:parseFloat(value));
          const rx=r(first,w),ry=r(second,h);
          const turn=(parseFloat(css.rotate)||0)*Math.PI/180;
          return Array.from({length:360},(_,i)=>{
            const angle=i*Math.PI/180,c=Math.cos(angle),sin=Math.sin(angle);
            const x=(Math.sign(c)*(w-rx)+rx*c)*unit;
            const y=(Math.sign(sin)*(h-ry)+ry*sin)*unit;
            const px=at.x+x*Math.cos(turn)-y*Math.sin(turn);
            const py=at.y+x*Math.sin(turn)+y*Math.cos(turn);
            const basis=wallShape.angle;
            return [px*Math.cos(basis)+py*Math.sin(basis),-px*Math.sin(basis)+py*Math.cos(basis)];
          });
        });
        return [Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0])),
          Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1]))];
      };
      const after=measure(), reset=document.createElement('style');
      reset.textContent='.dev[data-id="straight"] .device-shell { translate:none!important }'
        +'.dev[data-id="straight"] :is(.device-core,.value-badge) { rotate:none!important }';
      root.append(reset);
      const before=measure();
      reset.remove();
      wallGapError=Math.max(...['left','right','top','bottom'].flatMap((side,i)=>side in wallShape.walls
        ? [Math.abs(after[i]-before[i])/unit] : []));
      if (wallShape.member.length===1 && wallShape.angle===0) {
        const {marker,box}=scene.shapes.get('straight');
        const authored=[marker.x+box.left,marker.x+box.right,marker.y+box.top,marker.y+box.bottom];
        const bounds=outline.getBBox();
        const displayed=[bounds.x,bounds.x+bounds.width,bounds.y,bounds.y+bounds.height];
        outlineGapError=Math.max(...displayed.map((edge,i)=>
          Math.abs((edge-after[i])-(authored[i]-before[i]))/unit));
      }
    }
    const style=getComputedStyle(root.querySelector('.stage'));
    const glassMeshes=card._plan3dHost?.world.markerGlass.children.length ?? 0;
    return {shape,values,wallGapError,outlineGapError,correctStacks:stackIssues.length===0,stackIssues,glassMeshes,turn:parseFloat(style.getPropertyValue('--hp-iso-content-turn')),
      layout:JSON.stringify(card._layout),config:JSON.stringify(card._serverCfg), writes:window.__isoPaintWrites.length};
  });
  try {
    await page.evaluate(async ()=>{
      const card=window.__isoPaint;
      card.hass={...card.hass,themes:{darkMode:true}};
      await card.updateComplete;
    });
    await settleIsoPaint(page);
    const initial=await read(), cases=Object.values(initial.shape);
    check('fixture contains real attached corners and a joined component',cases.some(s=>Object.keys(s.walls).length>=2)
      &&cases.some(s=>s.member.length>=3) && (!angled||cases.some(s=>Math.abs(Math.sin(2*s.angle))>.5&&Object.keys(s.walls).length>0)));
    check('fixture contains separate main and auxiliary values',angled||initial.values.straight?.core.text==='320 lx'
      &&initial.values.straight?.badge?.text==='Выключено');
    let shifts=0, checkedHits=0;
    for (let step=0;step<=8;step++) {
      const frame=await read(), key=`${angled?'angled':'straight'}/${step*45}`;
      check(`${key}: the rear and front of each component paint once in depth order`,frame.correctStacks);
      check(`${key}: outlines are resident in the GPU scene`,frame.glassMeshes>0 && frame.glassMeshes%2===0);
      check(`${key}: authored layout, membership and centres persist`,frame.writes===0
        &&frame.layout===initial.layout&&frame.config===initial.config
        &&JSON.stringify(Object.entries(frame.shape).sort())===JSON.stringify(Object.entries(initial.shape).sort()));
      for(const [id,value] of Object.entries(frame.values)){
        const pills=[value.core,...value.badge?[value.badge]:[]];
        const modulo=angle=>((angle%360)+360)%360;
        check(`${key}/${id}: whole capsules carry their values and turn about their centres`,
          pills.every(pill=>modulo(parseFloat(pill.turn))===modulo(frame.turn)&&pill.textTurn==='none'&&pill.contains));
        for(const pill of pills)if(pill.owner!==undefined){
          check(`${key}/${id}/${pill.text}: the visible capsule owns the hit`,pill.owner===id);
          checkedHits++;
        }
      }
      if (step===3) {
        const capture=async (walls, glass)=>{
          await page.evaluate(async ({walls,glass})=>{
            const host=window.__isoPaint._plan3dHost;
            host.world.structure.visible=walls;
            host.world.markerGlass.visible=glass;
            host.draw();
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          },{walls,glass});
          return page.locator('canvas[data-hp-plan-3d-ready]').screenshot();
        };
        try {
          const physical=await compareInPage(page,await capture(true,true),await capture(true,false));
          const exposed=await compareInPage(page,await capture(false,true),await capture(false,false));
          check(`${key}: wall depth hides part of the real 3D outlines`,exposed.differing>physical.differing+20);
        } finally { await capture(true,true); }
      }
      if (!angled) check(`${key}: actual rotated capsules keep the wall gap`,
        frame.wallGapError!==null&&frame.wallGapError<.25);
      if (!angled) check(`${key}: a standalone wide outline keeps its padding at every turn (${frame.outlineGapError?.toFixed(2)} px)`,
        frame.outlineGapError!==null&&frame.outlineGapError<.35);
      shifts+=Number(Math.hypot(...(frame.values.straight?.shift??[0,0]))>.001);
      if(step<8 && dir)await page.screenshot({path:`${dir}/${key.replace('/','-')}.png`});
      if(step===3){
        await zoomIsoPaint(page,1.6);
        const zoomed=await read();
        check(`${key}: zoom preserves the visual wall clearance offset`,
          JSON.stringify(Object.values(zoomed.values).map(v=>v.shift))===JSON.stringify(Object.values(frame.values).map(v=>v.shift)));
        if(dir)await page.screenshot({path:`${dir}/${key.replace('/','-')}-zoom.png`});
        await zoomIsoPaint(page,1);
      }
      if (!angled && step===7) {
        const layers = () => page.evaluate(()=>{
          const root=window.__isoPaint.renderRoot, target=root.querySelector('.dev[data-id="free-b"]');
          const head=target.dataset.hpDeviceComponent;
          const group=[...root.querySelectorAll('.dev[data-hp-device-component]')].filter(n=>n.dataset.hpDeviceComponent===head);
          return {z:getComputedStyle(target).zIndex,
            focused:target.matches(':focus-visible'),
            front:group.filter(n=>n.querySelector('.iso-marker-glass.front')).map(n=>n.dataset.id)};
        });
        const original=await layers();
        check('fixture can observe a different front owner after promotion',!original.front.includes('free-b'));
        for (const attr of ['data-hp-device-hover','data-hp-zigbee-topology-endpoint']) {
          const hadHover=await page.evaluate(attr=>{
            const card=window.__isoPaint;
            const hadHover=card.hasAttribute('data-pointer-hover');
            card.setAttribute('data-pointer-hover','');
            card.renderRoot.querySelector('.dev[data-id="free-b"]').setAttribute(attr,'');
            return hadHover;
          },attr);
          await settleIsoPaint(page);
          const raised=await layers();
          check(`${attr}: nearest glass follows the actual raised stacking context`,
            Number(raised.z)>Number(original.z)&&JSON.stringify(raised.front)===JSON.stringify(['free-b']));
          await page.evaluate(({attr,hadHover})=>{
            const card=window.__isoPaint;
            card.toggleAttribute('data-pointer-hover',hadHover);
            card.renderRoot.querySelector('.dev[data-id="free-b"]').removeAttribute(attr);
          },{attr,hadHover});
          await settleIsoPaint(page);
          check(`${attr}: clearing promotion restores the stable owner`,(await layers()).front,original.front);
        }
        await page.evaluate(()=>window.__isoPaint.renderRoot.querySelector('.dev[data-id="free-b"]').focus({focusVisible:true}));
        await settleIsoPaint(page);
        const focused=await layers();
        check('keyboard focus lifts the front glass along with the focused card',
          focused.focused&&focused.z==='5'&&JSON.stringify(focused.front)===JSON.stringify(['free-b']));
        await page.evaluate(()=>window.__isoPaint.renderRoot.querySelector('.dev[data-id="free-b"]').blur());
        await settleIsoPaint(page);
        check('focus release restores the stable owner',(await layers()).front,original.front);
      }
      if(step===8)check(`${key}: a full rotation restores the exact initial wall offset`,
        JSON.stringify(Object.values(frame.values).map(v=>v.shift))===JSON.stringify(Object.values(initial.values).map(v=>v.shift)));
      measurements.push({key,glassMeshes:frame.glassMeshes,values:frame.values,wallGapError:frame.wallGapError,correctStacks:frame.correctStacks,stackIssues:frame.stackIssues});
      if(step===8)break;
      await page.locator('[data-hp="rotate-right"]').first().click();
      await settleIsoPaint(page);
    }
    check('visible pills had independent pointer ownership',checkedHits>=9);
    check('wide wall capsule uses a nonzero presentation offset',angled||shifts>0);
    await page.evaluate(async ()=>{
      const card=window.__isoPaint;
      card._serverCfg={...card._serverCfg,settings:{...card._serverCfg.settings,volumetric_view:false}};
      await card.updateComplete;
    });
    await settleIsoPaint(page);
    check('Flat removes the raised paint and restores ordinary capsules',await page.evaluate(()=>{
      const root=window.__isoPaint.renderRoot,pills=[...root.querySelectorAll('.dev .device-core:has(.valtext),.dev .value-badge')];
      return !root.querySelector('.iso-marker-glass,.device-occlusion-body')&&pills.length>0
        &&pills.every(node=>getComputedStyle(node).rotate==='none'
          &&getComputedStyle(node.closest('.device-shell')).translate==='none');
    }));
  } finally { await finish(browser); }
}
if(dir)writeFileSync(`${dir}/results.json`,JSON.stringify(measurements,null,2));
