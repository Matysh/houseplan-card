// #1112: native full-card placement burst -> shared static snapshot -> painted positions.
import { launch, checkAll, finish } from './serve.mjs';
const {page,browser}=await launch({width:1300,height:1000},1);
const full=page.locator('houseplan-card');
await full.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
await page.waitForFunction(()=>window.__card._mode==='devices'&&!window.__card._modeTransitionBusy);
const fixture=await page.evaluate(async()=>{
  await customElements.whenDefined('houseplan-space-card');
  const c=window.__card,original=c.hass.callWS,counts={full:{},staticA:{},staticB:{}},writes=[];
  const delivery={hold:false,queue:[]},originalConnection=c.hass.connection;
  const connection={...originalConnection,subscribeEvents:(cb,event)=>originalConnection.subscribeEvents(value=>{
    if(delivery.hold&&event==='houseplan_layout_updated')delivery.queue.push(()=>cb(value));else cb(value);
  },event)};
  const tagged=tag=>async message=>{
    counts[tag][message.type]=(counts[tag][message.type]||0)+1;
    const reply=await original(message);
    if(tag==='full'&&message.type==='houseplan/layout/update')writes.push({id:message.device_id,pos:structuredClone(message.pos),rev:reply.rev,ack:performance.now()});
    return reply;
  };
  c.hass={...c.hass,connection,callWS:tagged('full')};
  const space=c._space;
  for(const tag of ['staticA','staticB']){
    const host=document.createElement('div');host.style.width='400px';
    const card=document.createElement('houseplan-space-card');card.id=tag;
    card.setConfig({type:'custom:houseplan-space-card',space,show_button:false});
    card.hass={...c.hass,callWS:tagged(tag)};host.append(card);document.body.append(host);
  }
  const id=c.renderRoot.querySelector('.dev:not(.ha-disabled)')?.dataset.id;
  window.__static1112={counts,writes,id,delivery};return{id};
});
await page.waitForFunction(id=>['staticA','staticB'].every(tag=>document.querySelector('#'+tag)?.renderRoot?.querySelector(`[data-hp="device"][data-id="${id}"]`)),fixture.id);
await page.waitForTimeout(300);
await page.evaluate(()=>{window.__static1112.delivery.hold=true;for(const tag of Object.keys(window.__static1112.counts))window.__static1112.counts[tag]={};});
const marker=full.locator(`.dev[data-id="${fixture.id}"]`).first();
await page.keyboard.down('Alt');
for(let index=0;index<5;index++){
  const rect=await marker.boundingBox();if(!rect)throw Error('missing drag marker');
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y+8,{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);
}
await page.keyboard.up('Alt');
await page.waitForFunction(()=>window.__static1112.writes.length>=5);
await page.evaluate(()=>{
  const delivery=window.__static1112.delivery;delivery.hold=false;
  for(const notify of delivery.queue.splice(0))notify();
});
await page.waitForTimeout(500);
const result=await page.evaluate(async()=>{
  const c=window.__card,s=window.__static1112,last=s.writes.at(-1),server=await c.hass.callWS({type:'houseplan/layout/get'});
  const cards=['staticA','staticB'].map(tag=>{
    const card=document.querySelector('#'+tag),node=card.renderRoot.querySelector(`[data-hp="device"][data-id="${s.id}"]`);
    const view=card.renderRoot.querySelector('.hp-static-plan-svg').viewBox.baseVal;
    const expected=server.layout[s.id];
    return{tag,reads:s.counts[tag],saved:card._snap.layout[s.id],rev:card._snap.layoutRev,actual:[node.style.left,node.style.top],frame:[view.x,view.y,view.width,view.height],
      painted:Math.abs(parseFloat(node.style.left)-(expected.x*1000-view.x)/view.width*100)<1e-4
        &&Math.abs(parseFloat(node.style.top)-(expected.y*1000-view.y)/view.height*100)<1e-4};
  });
  const reads=cards.reduce((n,x)=>n+(x.reads['houseplan/layout/get']||0),0);
  return{checks:{nativeBurstWrites:s.writes.length===5,
    staticConfigNotReloaded:cards.every(x=>!x.reads['houseplan/config/get']),
    eachStaticAtMostOneRead:cards.every(x=>(x.reads['houseplan/layout/get']||0)<=1),
    sharedOneLayoutRead:reads===1,
    latestServerPosition:cards.every(x=>JSON.stringify(x.saved)===JSON.stringify(server.layout[s.id])&&x.rev===server.rev),
    bothStaticMarkersPaintLatestPosition:cards.every(x=>x.painted),
    lastAckIsServerRevision:last.rev===server.rev},callWS:s.counts,writes:s.writes,cards};
});
checkAll(result.checks);await finish(browser,result);