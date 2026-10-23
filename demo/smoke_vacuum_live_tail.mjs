// #1049: delayed native geometry must not strand a moving puck after a turn.
import {launchColdView, requirePinnedBrowser, checkAll, finish} from './serve.mjs';

requirePinnedBrowser();
const {page, browser} = await launchColdView({width:1200,height:900});
const out = {};
try {
  await page.evaluate(async () => {
    const old = window.__card, ws = old.hass.callWS.bind(old.hass);
    const subscribe = old.hass.connection.subscribeEvents.bind(old.hass.connection);
    window.__addRegistryEntity('vacuum.live1049', null, 'cleaning');
    window.__addRegistryEntity('camera.live1049', null, 'idle');
    const marker = {id:'e_live1049', binding:'entity:vacuum.live1049', space:'f1',
      vacuum:{source:'camera.live1049', trail_mode:'always', trail_color:'#FF00FF', trail_opacity:1,
        map_routes:[{id:'live-route', source:'camera.live1049', map_id:'floor', space:'f1',
          calibration:[1,0,0,0,1,0]}]}};
    await window.__hpTest.setServerConfig(c => ({...c,markers:[...c.markers,marker]}));
    await window.__hpTest.setLayout(l => ({...l,[marker.id]:{s:'f1',x:.1,y:.1}}));
    await window.__hpTest.setServerConfig(c => ({...c,spaces:c.spaces.map(s=>s.id==='f1'?{...s,cell_cm:1}:s)}));
    const now = Date.now();
    const run = {map_id:'floor',route_id:'live-route',path_format:2,
      paths:[[[100,100],[200,100]]], points:[[100,100],[200,100]],
      quality:{source:'native',reason:'ok',raw_points:2,stored_points:2},revision:'unchanged',
      received_at:now/1000, live_tail:{version:1,epoch:'current-task',waiting:false,limited:false,
        paths:[[[200,100,now-6000],[200,240,now-3000],[350,240,now]]]} };
    const f = window.__live1049 = {cards:[],listeners:new Set(),run,samples:[],writes:0,reads:0};
    const hass = {...old.hass,connection:{...old.hass.connection,subscribeEvents:async (handler,event) => {
      if(event==='houseplan_trail_updated'){f.listeners.add(handler);return()=>f.listeners.delete(handler);}
      return subscribe(handler,event);
    }},states:{...old.hass.states,
      'vacuum.live1049':{entity_id:'vacuum.live1049',state:'cleaning',attributes:{}},
      'camera.live1049':{entity_id:'camera.live1049',state:'idle',last_updated:new Date(now).toISOString(),
        attributes:{map_name:'floor',robot_position:{x:350,y:240}}}},
      callWS:async m=>{
        if(m.type==='houseplan/trail/get'){f.reads++;return {trail_format:2,live_tail_format:1,trails:{[marker.id]:{current:structuredClone(f.run)}}};}
        if(/\/(set|save|delete|update)$/.test(m.type))f.writes++;
        return ws(m);
      }};
    const c=document.createElement('houseplan-card');c.hass=hass;
    c.setConfig({type:'custom:houseplan-card',language:'en'});
    old.replaceWith(c);window.__card=c;f.cards.push(c);
    f.move = async (x,y) => {
      const at=new Date().toISOString();
      f.samples.push([x,y,Date.parse(at)]);
      for(const c of f.cards)c.hass={...c.hass,states:{...c.hass.states,
        'camera.live1049':{entity_id:'camera.live1049',state:'idle',last_updated:at,
          attributes:{map_name:'floor',robot_position:{x,y}}}}};
      await Promise.all(f.cards.map(c=>c.updateComplete));
    };
    f.measure = () => f.cards.map(c=>{
      const root=c.renderRoot,svg=root.querySelector('.vactrail');
      const line=svg?.querySelector('line.tip[data-mid="e_live1049"]');
      const puck=root.querySelector('.vacpuck[data-mid="e_live1049"]');
      const matrix=svg?.getScreenCTM(),box=puck?.getBoundingClientRect();
      if(!matrix||!box)return {ready:false,gap:null};
      const point=(x,y)=>new DOMPoint(x,y).matrixTransform(matrix);
      const end=line?point(Number(line.getAttribute('x2')),Number(line.getAttribute('y2'))):null;
      const turn=point(270,240);
      return {ready:true,gap:end?Math.hypot(end.x-box.left-box.width/2,end.y-box.top-box.height/2):null,
        puck:[box.left+box.width/2,box.top+box.height/2],lastKey:c._vacRt.get('e_live1049')?.lastKey,
        turn:{x:turn.x,y:turn.y},native:c._vacSrvTrails.e_live1049.current.paths,
        d:svg.querySelector('path.core')?.getAttribute('d')||''};
    });
  });
  await page.waitForFunction(()=>window.__live1049.cards.every(c=>c._loadOk&&c._vacSrvTrails.e_live1049
    &&c.renderRoot.querySelector('.stage:not(.hpboot):not(.hpiso-pending)')));
  for(const kiosk of [false,true])for(const iso of [false,true]){
    await page.evaluate(async()=>{
      const f=window.__live1049,now=Date.now();
      f.run.live_tail={...f.run.live_tail,epoch:`mode-${now}`,
        paths:[[[200,100,now-6000],[200,240,now-3000],[350,240,now]]]};
      for(const c of f.cards)c.hass={...c.hass,states:{...c.hass.states,
        'camera.live1049':{entity_id:'camera.live1049',state:'idle',last_updated:new Date(now).toISOString(),
          attributes:{map_name:'floor',robot_position:{x:350,y:240}}}}};
      for(const handler of f.listeners)handler({event_type:'houseplan_trail_updated',data:{}});
    });
    await page.waitForFunction(()=>window.__live1049.cards.every(c=>
      c._vacSrvTrails.e_live1049.current.live_tail.epoch===window.__live1049.run.live_tail.epoch));
    await page.evaluate(kiosk=>window.__card.setConfig({type:'custom:houseplan-card',language:'en',kiosk}),kiosk);
    await page.evaluate(value=>window.__hpTest.setVolumetricView(value),iso);
    await page.waitForFunction(iso=>window.__live1049.cards.every(c=>{
      const stage=c.renderRoot.querySelector('.stage:not(.hpboot):not(.hpiso-pending)');
      return stage&&stage.classList.contains('projection-iso')===iso;
    }),iso);
    const mode=`${kiosk?'kiosk':'view'}-${iso?'iso':'flat'}`;
    for(const [x,y] of [[400,240],[400,310],[500,310]]){
      await page.evaluate(([x,y])=>window.__live1049.move(x,y),[x,y]);
      await page.waitForFunction(([x,y])=>window.__live1049.cards.every(c=>c._vacRt.get('e_live1049')?.lastKey===`${x}:${y}`),[x,y]);
      await page.waitForTimeout(120); // Observe the real animation in progress, not only settled targets.
      const frames=await page.evaluate(()=>window.__live1049.measure());
      out[`tip_${mode}_${x}_${y}`]=frames.every(f=>f.ready&&f.gap!==null&&f.gap<1);
      out[`native_unchanged_${mode}_${x}_${y}`]=frames.every(f=>JSON.stringify(f.native)==='[[[100,100],[200,100]]]');
    }
    await page.waitForTimeout(1300); // Pixel witness uses the fully painted target, not a loading veil or initial tween.
    const frames=await page.evaluate(()=>window.__live1049.measure());
    const png=await page.screenshot({path:`artifacts/1049-live-tail-${mode}.png`});
    const ink=await page.evaluate(async({png64,point})=>{
      const image=await createImageBitmap(new Blob([Uint8Array.from(atob(png64),c=>c.charCodeAt(0))],{type:'image/png'}));
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const x=Math.round(point.x),y=Math.round(point.y);
      if(x<4||y<4||x+4>=image.width||y+4>=image.height){image.close();return -1;}
      const pixels=ctx.getImageData(x-4,y-4,9,9).data;let count=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]>140&&pixels[i+2]>140&&pixels[i+1]<110)count++;
      image.close();return count;
    },{png64:png.toString('base64'),point:frames[0].turn});
    out[`turn_painted_${mode}`]=ink>=2;
    console.log(JSON.stringify({mode,frames:frames.map(f=>({gap:f.gap,puck:f.puck,lastKey:f.lastKey,turn:f.turn,d:f.d})),ink}));
  }
  await page.evaluate(async()=>{
    const f=window.__live1049,stamp=f.samples.at(-1)[2];
    f.readsBefore=f.reads;
    f.run.paths=[[[100,100],[200,100],[200,240],[400,240],[400,310]]];
    f.run.points=f.run.paths[0];f.run.revision='caught-prefix';
    f.run.live_tail={version:1,epoch:f.run.live_tail.epoch,waiting:false,limited:false,
      paths:[[[400,310,stamp-100],[500,310,stamp]]]};
    for(const handler of f.listeners)handler({event_type:'houseplan_trail_updated',data:{}});
  });
  await page.waitForFunction(()=>window.__card._vacSrvTrails.e_live1049.current.revision==='caught-prefix');
  out.catchup_keeps_endpoint=(await page.evaluate(()=>window.__live1049.measure())).every(f=>f.gap!==null&&f.gap<1);
  await page.evaluate(()=>{
    const f=window.__live1049;
    f.run.paths=[];f.run.points=[];f.run.revision='explicit-empty';f.run.quality={source:'native',reason:'empty_integration',raw_points:0,stored_points:0};
    for(const handler of f.listeners)handler({event_type:'houseplan_trail_updated',data:{}});
  });
  await page.waitForFunction(()=>window.__card._vacSrvTrails.e_live1049.current.revision==='explicit-empty');
  out.empty_keeps_fresh_tip=(await page.evaluate(()=>window.__live1049.measure())).every(f=>f.gap!==null&&f.gap<1&&f.native.length===0);
  await page.evaluate(async()=>{
    const f=window.__live1049,first=f.cards[0];
    const c=document.createElement('houseplan-card');c.hass=first.hass;
    c.setConfig({type:'custom:houseplan-card',language:'en'});first.after(c);f.cards.push(c);
  });
  await page.waitForFunction(()=>window.__live1049.cards.every(c=>c._loadOk&&c._vacSrvTrails.e_live1049
    &&c.renderRoot.querySelector('.stage:not(.hpboot):not(.hpiso-pending)')));
  await page.waitForTimeout(1300);
  out.two_clients_restore_shared_tail=(await page.evaluate(()=>window.__live1049.measure())).every(f=>f.gap!==null&&f.gap<1&&f.native.length===0);
  const counters=await page.evaluate(()=>({writes:window.__live1049.writes,
    reads:window.__live1049.reads-window.__live1049.readsBefore}));
  out.no_client_writes=counters.writes===0;
  out.no_client_poll=counters.reads<=3; // Two ordinary update events and one new card's initial read only.
  checkAll(out);
} finally {await finish(browser);}
