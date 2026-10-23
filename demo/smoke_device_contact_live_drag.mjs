// #1003 AC11: a real HA scalar changes between a trusted move and release.
import {launch,checkAll,finish} from './serve.mjs';
const {page,browser}=await launch({width:1400,height:1000});
try{
  await page.evaluate(async()=>{
    const c=window.__card,space=c._space;
    c.hass={...c.hass,entities:{...c.hass.entities,
      'sensor.drag_value':{entity_id:'sensor.drag_value'},'sensor.drag_target':{entity_id:'sensor.drag_target'}},
      states:{...c.hass.states,'sensor.drag_value':{entity_id:'sensor.drag_value',state:'23.1',attributes:{unit_of_measurement:'°C'}},
        'sensor.drag_target':{entity_id:'sensor.drag_target',state:'52',attributes:{unit_of_measurement:'%'}}}};
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.settings={...cfg.settings,filter_seeded:true,volumetric_view:false};
      cfg.spaces=[{id:space,title:'Live drag',cell_cm:5,view_box:[0,0,1,1],rooms:[],walls:[],wall_segments:[],
        partitions:[],openings:[],settings:{show_names:false,show_borders:false}}];
      cfg.markers=['value','target'].map(id=>({id:'lg_sensor.drag_'+id,binding:'entity:sensor.drag_'+id,space,
        icon:'mdi:thermometer',display:'icon',value_badge:{enabled:id==='value',position:'right',
          source:{kind:'entity_state',entity_id:'sensor.drag_'+id}}}));return cfg;
    });
    await window.__hpTest.setLayout({'lg_sensor.drag_value':{s:space,x:.25,y:.4},'lg_sensor.drag_target':{s:space,x:.6,y:.4}});
    await window.__hpTest.setMode('devices');
    const original=c.hass.callWS;window.__liveContactWrites=[];
    c.hass={...c.hass,callWS:async m=>{
      if(/houseplan\/(config|layout)\/(set|update|delete)$/.test(m.type))window.__liveContactWrites.push(m);
      return original(m);
    }};
  });
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing
    &&window.__card._deviceContacts?.scene?.shapes.has('lg_sensor.drag_value'));
  const settle=()=>page.evaluate(async()=>{await window.__card.updateComplete;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.evaluate(()=>window.__hpTest.settled());
  await page.waitForFunction(()=>!window.__card._cameraTransition.active);await settle();
  const target=await page.evaluate(()=>{
    const c=window.__card,s=c._deviceContacts.scene,a=s.shapes.get('lg_sensor.drag_value').marker,
      b=s.shapes.get('lg_sensor.drag_target').marker;
    const depth=Math.min(a.diameter,b.diameter)*13/80-(a.diameter+b.diameter)*.009375;
    const r=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb());
    const project=(x,y)=>({x:r.x+(x-v.x)/v.w*r.width,y:r.y+(y-v.y)/v.h*r.height});
    return {from:project(a.x,a.y),to:project(b.x+b.box.left+depth-a.box.right,b.y),
      width:a.box.right-a.box.left};
  });
  await page.mouse.move(target.from.x,target.from.y);await page.mouse.down();
  await page.mouse.move(target.to.x+3,target.to.y,{steps:10});await settle();
  await page.waitForFunction(()=>window.__card._deviceDrag?.contact?.hint?.kind==='device').catch(async e=>{
    console.log('live-drag diagnostic',target,await page.evaluate(()=>{
      const c=window.__card,d=c._deviceDrag;
      return {mode:c._mode,drag:d?{id:d.id,moved:d.moved,hint:d.contact?.hint}:null,
        layout:c._layout,shapes:[...c._deviceContacts.scene.shapes.values()].map(s=>s.marker)};
    }));throw e;
  });
  const pointer=await page.evaluate(()=>{
    const c=window.__card,id=c._deviceDrag.pointerId;
    window.__contactCapturedNode=[...c.renderRoot.querySelectorAll('*')].find(n=>n.hasPointerCapture?.(id));
    return {id,captured:!!window.__contactCapturedNode};
  });
  await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
    'sensor.drag_value':{...c.hass.states['sensor.drag_value'],state:'123.1'}}};});
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-id="lg_sensor.drag_value"] .value-badge')?.textContent.includes('123.1'));
  await settle();
  const held=await page.evaluate(()=>{const c=window.__card,d=c._deviceDrag,m=c._deviceContacts.scene.shapes.get('lg_sensor.drag_value').marker,
    b=c._deviceContacts.scene.shapes.get('lg_sensor.drag_target').marker;
    const depth=Math.min(m.diameter,b.diameter)*13/80-(m.diameter+b.diameter)*.009375;
    return {id:d?.pointerId,captured:window.__contactCapturedNode?.isConnected
      &&window.__contactCapturedNode.hasPointerCapture(d.pointerId),width:m.box.right-m.box.left,
      contactError:Math.abs(m.x+m.box.right-b.x-b.box.left-depth),writes:window.__liveContactWrites.length};});
  checkAll({'native-started-with-real-capture':pointer.captured,
    'HA-update-keeps-native-pointer':held.id===pointer.id&&held.captured,
    'HA-update-keeps-preview-contact-valid':held.contactError<.001,
    'HA-update-really-widens-dragged-face':held.width>target.width,'HA-update-does-not-write':held.writes===0});
  // No further move event: terminal must use the current face.
  await page.mouse.up();await page.evaluate(()=>window.__hpTest.waitForWrites());
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);await settle();
  const result=await page.evaluate(()=>{
    const c=window.__card,s=c._deviceContacts.scene,a=s.shapes.get('lg_sensor.drag_value').marker,
      b=s.shapes.get('lg_sensor.drag_target').marker;
    const depth=Math.min(a.diameter,b.diameter)*13/80-(a.diameter+b.diameter)*.009375;
    return {members:s.component(a.id),error:Math.abs(a.x+a.box.right-b.x-b.box.left-depth),
      writes:window.__liveContactWrites.length,history:c._devicePositionHistory.size,
      value:c.hass.states['sensor.drag_value'].state};
  });
  checkAll({'release-validates-current-contact':result.members.length===2&&result.error<.001,
    'release-is-one-group-write-and-history':result.writes===1&&result.history===1,
    'release-does-not-rollback-HA-state':result.value==='123.1'});
}finally{await finish(browser);}
