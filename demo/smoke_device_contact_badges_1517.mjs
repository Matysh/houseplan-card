
/** #1517: a live middle badge in both flat orientations, through the real View controls. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, checkAll, finish } from './serve.mjs';
import { fitVisibleView } from './helpers/view-controls.mjs';
import { contactBoxIn, contactShapeJoinDepth, freeContactShape } from '../test-build/device-contact-geometry.js';
import { makeContactBasis } from '../test-build/device-contact-basis.js';

const directory=process.env.HP_CONTACT_BADGE_ARTIFACTS || 'artifacts/1517/badge-refit';
const shortValue='22.4', longValue='123456789012.4';
const groups=[
  {name:'row', ids:['row-a','row-b','row-c'], start:[245,300], side:'right'},
  {name:'column', ids:['column-a','column-b','column-c'],start:[635,280],side:'bottom'},
  {name:'stack',ids:['stack-a','stack-b','stack-c'],start:[635,590],side:'bottom',badge:'bottom'},
];
const {page,browser}=await launch({width:1280,height:920});
const checks={}, evidence={};
mkdirSync(directory,{recursive:true});
const settle=()=>page.evaluate(async()=>{
  await window.__hpTest.settled();
  await document.fonts.ready;
  await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
});
const setValue=async value=>{
  await page.evaluate(value=>{
    const c=window.__card, entity='sensor.living_temp';
    c.hass={...c.hass,states:{...c.hass.states,[entity]:{...c.hass.states[entity],state:value}}};
  },value);
  await page.waitForFunction(value=>{
    const card=window.__card;
    return [...card.renderRoot.querySelectorAll('.dev .value-badge')].filter(b=>b.textContent.includes(value)).length===3;
  },value);
  await settle();
};
const snapshot=()=>page.evaluate(groups=>{
  const card=window.__card,renderer=card._deviceContacts, screen=renderer.screen.scene;
  const box=node=>{
    const r=node.getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,x:r.x+r.width/2,y:r.y+r.height/2};
  };
  return {rotation:card._rotation, layout:structuredClone(card._layout),writes:window.__badgeWrites.length,
    groups:Object.fromEntries(groups.map(({name,ids})=>{
      const elements=ids.map(id=>card.renderRoot.querySelector('.dev[data-id="'+id+'"]'));
      const badge=box(elements[1].querySelector('.value-badge'));
      const cores=elements.map(element=>box(element.querySelector('.device-core')));
      const widths=[...cores,badge];
      const comp=screen.component(ids[1]);
      const neighbors=[...screen.edges.get(ids[1])].sort();
      return [name,{members:comp,neighbors,paint:elements.map(e=>e.dataset.hpDeviceComponent),
        badge,cores,width:Math.max(...widths.map(r=>r.right))-Math.min(...widths.map(r=>r.left))}];
    })),
  };
},groups);
const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5
  && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;

try {
  await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
  const all=groups.flatMap(({ids,badge})=>ids.map((id,i)=>({id,position:i===1?(badge||'right'):null})));
  await page.evaluate(async list=>{
    const c=window.__card, space=c._space;
    c.setConfig({...c._config,icon_size:4});
    await window.__hpTest.setServerConfig(cfg=>{
      const model=cfg.spaces.find(s=>s.id===space);
      cfg.spaces=[{...model,rooms:[],partitions:[],walls:[],openings:[],wall_columns:[],decor:[]}];
      delete cfg.spaces[0].plan_url;
      cfg.settings={...cfg.settings,bg_mode:'static',volumetric_view:false};
      cfg.markers=list.map(({id,position})=>({id,binding:'virtual',name:id,icon:'mdi:lightbulb',space,area:null,
        display:position?'icon':'static_icon',tap_action:'info',
        ...(position?{value_badge:{enabled:true,position,source:{kind:'entity_state',entity_id:'sensor.living_temp'}}}:{})}));
      return cfg;
    });
    await window.__hpTest.setLayout(Object.fromEntries(list.map(({id},i)=>[id,{s:space,x:.1+(i%3)*.28,y:.1+Math.floor(i/3)*.28}])));
    await window.__hpTest.setMode('view');
  },all);
  await setValue(shortValue);
  await page.waitForFunction(count=>window.__card._deviceContacts?.scene?.shapes.size===count,all.length);
  const {measured,space}=await page.evaluate(()=>{
    const c=window.__card;
    return {measured:Object.fromEntries([...c._deviceContacts.scene.shapes].map(([id,s])=>[id,s.marker])),space:c._space};
  });
  const authored={};
  for (const {ids,start,side} of groups) {
    const vertical=side==='bottom';
    let previous=freeContactShape({...measured[ids[0]],x:start[0],y:start[1],precise:true});
    for (const id of ids) {
      if (id!==ids[0]) {
        const next=freeContactShape({...measured[id],precise:true}), p=contactBoxIn(previous);
        const pitch=contactShapeJoinDepth(previous,next,side);
        const marker={...next.marker,x:vertical?p.left-next.box.left:p.right-pitch-next.box.left,
          y:vertical?p.bottom-pitch-next.box.top:p.top-next.box.top};
        previous=freeContactShape(marker);
      }
      const contact_basis=makeContactBasis(previous.marker,space);
      authored[id]={...contact_basis.at,contact_basis};
    }
  }
  await page.evaluate(layout=>window.__hpTest.setLayout(layout),authored);
  await fitVisibleView(page);
  await settle();
  await page.evaluate(()=>{
    const c=window.__card,call=c.hass.callWS.bind(c.hass);
    window.__badgeWrites=[];
    c.hass={...c.hass,callWS:msg=>{
      if(/houseplan\/(config|layout)\/(set|update|delete)$/.test(msg.type))window.__badgeWrites.push(msg);
      return call(msg);
    }};
  });
  for (const rotation of [0,180,0]) {
    if (await page.evaluate(()=>window.__card._rotation)!==rotation) {
      for (const turn of [90,180]) {
        await page.locator('houseplan-card [data-hp="rotate-right"]').click();
        const expected=rotation===180?turn:(180+turn)%360;
        await page.waitForFunction(expected=>window.__card._rotation===expected&&!window.__card._rotationMotion.running,expected);
        await settle();
      }
    }
    const phase=evidence['0']&&rotation===0?'restored-angle':String(rotation);
    let before;
    for (const [variant,value] of [['short',shortValue],['long',longValue],['restored',shortValue]]) {
      await setValue(value);
      const now=await snapshot();
      evidence[phase]??={};evidence[phase][variant]=now;
      checks[phase+':'+variant+':unchanged storage']=JSON.stringify(now.layout)===JSON.stringify(authored) && now.writes===0;
      for (const {name,ids,badge} of groups) {
        const g=now.groups[name], key=phase+':'+variant+':'+name;
        checks[key+':all contacts']=g.members.length===3&&g.neighbors.length===2&&g.neighbors.every(id=>id!==ids[1])
          && g.paint.every(owner=>owner&&owner===g.paint[0]);
        checks[key+':upright badge']=badge==='bottom'?g.badge.top>g.cores[1].bottom-.5:g.badge.left>g.cores[1].right-.5;
        checks[key+':no overlap']=g.cores.filter((_,i)=>i!==1).every(core=>!overlaps(core,g.badge));
        if (name==='column') checks[key+':aligned cores']=g.cores.every(core=>Math.abs(core.x-g.cores[0].x)<.5);
        if (variant==='long') checks[key+':width grows']=g.width>before.groups[name].width+2;
        if (variant==='restored') checks[key+':returns without drift']=Math.abs(g.width-before.groups[name].width)<.25
          && g.cores.every((core,i)=>Math.abs(core.x-before.groups[name].cores[i].x)<.25&&Math.abs(core.y-before.groups[name].cores[i].y)<.25);
      }
      if (variant==='short') before=now;
      if (phase!=='restored-angle'&&variant!=='restored') {
        await page.locator('houseplan-card .stage').screenshot({path:join(directory,phase+'-'+variant+'.png')});
      }
    }
  }
  writeFileSync(join(directory,'report.json'),JSON.stringify({checks,evidence},null,2));
  checkAll(checks);
  await finish(browser,checks);
} catch(error) {
  await browser.close();
  throw error;
}
