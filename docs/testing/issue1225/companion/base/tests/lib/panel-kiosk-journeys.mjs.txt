/** #1103: public DOM + real HA websocket seams, no private product state. */
import {expect} from '@playwright/test';
import {requireHooks} from './contract.mjs';
import {hasBeta4PanelContract} from './panel-release-contract.mjs';
import {connect,planConfig,snapshotPlan,importDocument} from './ha-ws.mjs';
import {card,expectPlanDrawn,navigateInApp} from './ha-page.mjs';
import {HP,hp} from './hooks.mjs';
import {stage,settle} from './plan.mjs';
import {expectPanelShell} from './panel-shell.mjs';
export {card,stage,settle,navigateInApp};

export function requirePanelBeta4(test) {
  test.skip(!hasBeta4PanelContract(),
    '#1103/#1120 require the installed panel contract; SKIP is not acceptance');
  // Unknown/foreign HA runs newest expectations, as the repository contract requires.
  requireHooks(test,'stage','room','mode-tab','dialog','settings-section','field');
}
export function restorePanelPlan(test) {
  let snapshot;
  test.beforeEach(async()=>{snapshot=await snapshotPlan();});
  // Full import restores the source namespace/counter too; an ordinary old writer
  // omitting external_screens intentionally cannot erase it (#1113).
  test.afterEach(async()=>{if(snapshot)await importDocument(snapshot.document);});
}
export async function writeConfig(change) {
  const ws=await connect('admin');
  try {const before=await ws.call({type:'houseplan/config/get'});const config=structuredClone(before.config);
    change(config);await ws.call({type:'houseplan/config/set',config,expected_rev:before.rev});return (await ws.call({type:'houseplan/config/get'})).config;
  }finally{ws.close();}
}
export async function orderedFixture() {
  return writeConfig(config=>{
    expect(config.spaces.length,'seed must expose three real floors').toBeGreaterThanOrEqual(3);
    const first=config.spaces.slice(0,3).reverse();
    first.forEach((space,i)=>{space.title=['Zeta E2E','Alpha E2E','Middle E2E'][i];});
    config.spaces=[...first,...config.spaces.slice(3)];
    expect(new Set(first.map(s=>JSON.stringify((s.rooms??[]).map(r=>r.id).sort()))).size,
      'three seed floors need distinguishable public painted room IDs').toBe(3);
    expect(first.every(s=>s.rooms?.length),'floor witnesses must be nonempty').toBe(true);
  });
}
export async function expectFloor(host,space) {
  const expected=space.rooms.map(room=>room.id).sort();
  expect(expected.length,'floor oracle must have real geometry').toBeGreaterThan(0);
  await expect.poll(()=>host.locator(hp('room')).evaluateAll(nodes=>nodes.map(el=>el.dataset.id).sort()),
    {message:`painted floor ${space.id}`}).toEqual(expected);
}
export async function openKiosk(page,url,space) {
  await page.goto(url);const host=card(page);await expectPlanDrawn(page,host);await expectFloor(host,space);await expectKiosk(host);return host;
}
export async function expectKiosk(host) {
  await expect(host.locator(HP.mode('view'))).toBeVisible();
  for(const selector of [HP.editorTabs,HP.settings,HP.spaceAdd,hp('space-tab'),hp('space-select'),HP.panelMenu]){
    // Kiosk hides the existing header as a whole. Its retained DOM is not
    // an exposed control;1120 may also omit it completely.
    for(const control of await host.locator(selector).all())await expect(control).toBeHidden();
  }
  await expect(host.getByRole('button').and(host.locator(HP.editorTabs))).toHaveCount(0);
  // #1120 supersedes #1103's former retained HA/panel outer appbar oracle.
  const panel=host.page().locator('houseplan-panel');
  if(await panel.count()) {
    await expectPanelShell(panel,host);
    for(const menu of await panel.locator(HP.panelMenu).all())await expect(menu).toBeHidden();
  }
}
export const camera=host=>stage(host).evaluate(svg=>{
  const m=svg.getScreenCTM();return {viewBox:svg.getAttribute('viewBox'),matrix:[m.a,m.b,m.c,m.d,m.e,m.f]};
});
export function observeApplicationIo(page) {
  const sent=[];let navigations=0;
  // framenavigated also fires for pushState/Back within the same document.
  // Count actual main-document requests so the SPA oracle rejects reloads
  // without mistaking the intentional URL transition for one.
  page.on('request',request=>{
    if(request.isNavigationRequest() && request.resourceType()==='document'
      && request.frame()===page.mainFrame())navigations++;
  });
  page.on('websocket',socket=>socket.on('framesent',({payload})=>{
    let decoded;try{decoded=JSON.parse(String(payload));}catch{return;}
    for(const msg of Array.isArray(decoded)?decoded:[decoded])if(msg.type?.startsWith('houseplan/'))sent.push({type:msg.type});
  }));
  return {snapshot:()=>({navigations,configGet:sent.filter(m=>m.type==='houseplan/config/get').length,
    layoutGet:sent.filter(m=>m.type==='houseplan/layout/get').length,
    writes:sent.filter(m=>/\/(set|patch|copy|delete|apply)$/.test(m.type)).length})};
}
export async function touch(page,frames) {
  const session=await page.context().newCDPSession(page);
  try {for(let i=0;i<frames.length;i++){
    const points=frames[i].map((p,id)=>({x:p.x,y:p.y,id:id+1,radiusX:1,radiusY:1,force:1}));
    await session.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':points.length?'touchMove':'touchEnd',touchPoints:points});
    await page.waitForTimeout(35);
  }}finally{await session.detach();}
}
export async function swipe(page,host) {
  const {config}=await planConfig();
  const painted=await host.locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort());
  const matches=config.spaces.map((space,index)=>({space,index})).filter(({space})=>
    JSON.stringify(space.rooms.map(room=>room.id).sort())===JSON.stringify(painted));
  expect(painted.length,'edge swipe needs a painted floor').toBeGreaterThan(0);
  expect(matches,'public painted rooms identify exactly one server floor').toHaveLength(1);
  const index=matches[0].index;
  expect(config.spaces.length,'edge swipe needs a real neighbour').toBeGreaterThan(1);
  // The accepted gesture starts within 48px of an edge and initially moves
  // inward. At the last floor use the previous edge, not a dead next edge.
  const next=index<config.spaces.length-1,direction=next?-1:1;
  const box=await stage(host).boundingBox(),x=next?box.x+box.width-20:box.x+20,y=box.y+box.height*.75;
  await touch(page,[[{x,y}],[{x:x+direction*50,y}],[{x:x+direction*110,y}],[]]);await settle(host);
  return config.spaces[index+(next?1:-1)];
}
/** Hold only the actual HA config/get response; auth, other replies and events pass unchanged. */
export async function holdFirstConfigGet(page) {
  let captureResolve,releaseReply,requestId;const reached=new Promise(r=>{captureResolve=r;});
  await page.routeWebSocket('**/api/websocket',socket=>{
    const server=socket.connectToServer();
    socket.onMessage(raw=>{let msg;try{msg=JSON.parse(String(raw));}catch{server.send(raw);return;}
      if(msg.type==='houseplan/config/get'&&requestId===undefined)requestId=msg.id;server.send(raw);});
    server.onMessage(raw=>{let decoded;try{decoded=JSON.parse(String(raw));}catch{socket.send(raw);return;}
      const batch=Array.isArray(decoded),rows=batch?decoded:[decoded],pass=[];
      for(const msg of rows)if(msg.type==='result'&&msg.id===requestId&&!releaseReply){
        releaseReply=()=>socket.send(JSON.stringify(batch?[msg]:msg));captureResolve();
      }else pass.push(msg);
      if(pass.length===rows.length)socket.send(raw);else if(pass.length)socket.send(JSON.stringify(batch?pass:pass[0]));
    });
  });
  return {reached,release(){expect(releaseReply,'real HA response must reach the proxy').toBeTruthy();releaseReply();}};
}
