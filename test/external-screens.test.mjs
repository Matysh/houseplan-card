import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultExternalScreen, emptyExternalScreens, externalScreensOf,
  upsertExternalScreen, ExternalScreenResolver } from '../test-build/external-screens.js';
import { parseRouteKiosk, screenOverrides } from '../test-build/panel-route-kiosk.js';

test('#1113 detached draft adds/edits/deletes without reusing numbers or overflowing20', () => {
  let d = emptyExternalScreens(); const original = structuredClone(d);
  d = upsertExternalScreen(d, defaultExternalScreen(1));
  assert.deepEqual(original, emptyExternalScreens());
  d = upsertExternalScreen(d, defaultExternalScreen(2));
  d = upsertExternalScreen(d, defaultExternalScreen(3));
  d = { ...d, screens: d.screens.filter(row => row.id !== 2) };
  d = upsertExternalScreen(d, defaultExternalScreen(4));
  assert.deepEqual(d.screens.map(row => row.id), [1,3,4]);
  assert.equal(d.next_id, 5);
  d = upsertExternalScreen(d, { ...d.screens[0], rotation: 270 });
  assert.equal(d.screens[0].rotation, 270); assert.equal(d.next_id,5);
  assert.equal(upsertExternalScreen(d, defaultExternalScreen(2)), d);
  while (d.screens.length < 20) d = upsertExternalScreen(d, defaultExternalScreen(d.next_id));
  assert.equal(upsertExternalScreen(d, defaultExternalScreen(d.next_id)), d);
});

test('#1113 codec is inert on future/malformed envelopes and preserves unknown v1 fields', () => {
  const d = { ...emptyExternalScreens(), next_id:2, screens:[{...defaultExternalScreen(1), future:{n:3}}] };
  assert.equal(externalScreensOf(d), d);
  for (const malformed of [null,[],{...d,version:2},{...d,next_id:1}, {...d,screens:[d.screens[0],d.screens[0]]},
    {...d,screens:[{...d.screens[0],cycle:true}]}, {...d,screens:[{...d.screens[0],icon_scale:.51}]}]) assert.equal(externalScreensOf(malformed), null);
});

test('#1113 profile enables kiosk independently and path position wins only its own fields', () => {
  assert.deepEqual(parseRouteKiosk('', '?hpprofile=1&hpkiosk=0'), {enabled:true,position:null,profile:1});
  assert.deepEqual(parseRouteKiosk('/kiosk/2', '?hpprofile=1&hpspace=3&hprotate=90'),
    {enabled:true,position:2,profile:1,overrides:{rotation:90}});
  for (const value of ['abc','0','-1','1.5','9007199254740992','']) assert.deepEqual(parseRouteKiosk('', '?hpprofile='+value),{enabled:false,position:null});
  assert.equal(parseRouteKiosk('', '?hpprofile=2&hpprofile=3').profile,2);
  assert.equal(parseRouteKiosk('', '?HPprofile=1').enabled,false);
  assert.deepEqual(parseRouteKiosk('', '?hprotate=90'), {enabled:false,position:null});
  const query='?other=x%20y&hpprofile=4&Other=2'; parseRouteKiosk('',query); assert.equal(query,'?other=x%20y&hpprofile=4&Other=2');
});

test('#1113 exact syntax and URL boundary matrix, including first repeated values', () => {
  assert.deepEqual(screenOverrides(new URLSearchParams('hprotate=270&hpcycle=3600&hpidle=0&hpsummary=1&hphidden=0&hpcontrols=0&hpicons=52&hptext=300')),
    {rotation:270,cycle:3600,idle:0,summary:true,hidden_devices:false,controls:false,icon_scale:.5,font_scale:3});
  assert.deepEqual(screenOverrides(new URLSearchParams('hprotate=45&hpcycle=3601&hpidle=-1&hpsummary=true&hphidden=01&hpcontrols=yes&hpicons=49&hptext=301')),{});
  for (const n of [50,51,52,53,54,55,299,300]) assert.equal(screenOverrides(new URLSearchParams('hpicons='+n)).icon_scale, Math.round(n/5)/20);
  assert.deepEqual(screenOverrides(new URLSearchParams('hpcycle=0&hpcycle=300&hpsummary=0&hpsummary=1')), {cycle:0,summary:false});
});

test('#1113 each explicit URL field overrides profile while local sentinels remain absent', () => {
  const row = {...defaultExternalScreen(1),space:'upstairs',rotation:180,cycle:30,idle:120,summary:'show',hidden_devices:'hide',icon_scale:2,font_scale:1.5,controls:false};
  const raw={version:1,next_id:2,screens:[row]}, resolver=new ExternalScreenResolver();
  const base=resolver.read(raw,{enabled:true,profile:1});
  assert.deepEqual(base,{space:'upstairs',rotation:180,cycle:30,idle:120,summary:true,hidden_devices:false,icon_scale:2,font_scale:1.5,controls:false});
  const overrides={rotation:90,cycle:0,idle:0,summary:false,hidden_devices:true,icon_scale:.5,font_scale:3,controls:true};
  const route={enabled:true,profile:1,overrides};
  const result=resolver.read(raw,route);assert.deepEqual(result,{space:'upstairs',...overrides});
  assert.equal(resolver.read(raw,route),result,'ordinary HA tick does not resolve again');
  assert.deepEqual(resolver.read(raw,{enabled:false,profile:1}),{});
  assert.deepEqual(resolver.read(raw,{enabled:true,profile:404,overrides:{rotation:90}}),{rotation:90});
  const local={...raw,screens:[defaultExternalScreen(1)]};
  const effective=resolver.read(local,{enabled:true,profile:1});
  for(const field of ['summary','hidden_devices','icon_scale','font_scale'])assert.equal(effective[field],undefined);
  assert.deepEqual(resolver.read({version:2,anything:'opaque'},{enabled:true,profile:1,overrides:{cycle:30}}),{cycle:30});
  assert.deepEqual(row,{...defaultExternalScreen(1),space:'upstairs',rotation:180,cycle:30,idle:120,summary:'show',hidden_devices:'hide',icon_scale:2,font_scale:1.5,controls:false},'resolution cannot rewrite persisted or local state');
});

test('#1113 screen-only events require exact successor/base and retain unrelated field identities', async () => {
  const {externalScreenEventCandidate,externalScreenOnlyCandidate}=await import('../test-build/external-screens.js');
  const previous={spaces:[{id:'floor'}],markers:[],settings:{show_lqi:false,external_screens:emptyExternalScreens()}};
  const value={version:1,next_id:2,screens:[defaultExternalScreen(1)]};
  const event={rev:8,external_screens_update:{version:1,base_rev:7,value}};
  const result=externalScreenEventCandidate(previous,7,event);
  assert.equal(result.rev,8);assert.equal(result.config.spaces,previous.spaces);assert.equal(result.config.markers,previous.markers);
  assert.equal(result.config.settings.show_lqi,false);assert.equal(result.config.settings.external_screens,value);
  assert.equal(externalScreenOnlyCandidate(previous,result.config),true);
  assert.equal(externalScreenOnlyCandidate(previous,{...result.config,spaces:[]}),false);
  assert.equal(externalScreenOnlyCandidate(previous,{...result.config,settings:{...result.config.settings,show_lqi:true}}),false);
  assert.equal(externalScreenEventCandidate(previous,8,event),null,'old event/replay');
  assert.equal(externalScreenEventCandidate(previous,6,event),null,'missed predecessor');
  for(const bad of [{...event,rev:9},{...event,rev:'8'}, {rev:8}, {...event,external_screens_update:{version:2,base_rev:7,value}},
    {...event,external_screens_update:{version:1,base_rev:7,value:{version:1,next_id:1,screens:[defaultExternalScreen(1)]}}}])assert.equal(externalScreenEventCandidate(previous,7,bad),null);
  const future=externalScreenEventCandidate(previous,7,{...event,external_screens_update:{version:1,base_rev:7,value:{version:4,opaque:'kept'}}});
  assert.deepEqual(future.config.settings.external_screens,{version:4,opaque:'kept'});
});

test('#1113 panel aliases share local addresses while Lovelace keeps complete paths', async () => {
  const {summaryPreferenceKey}=await import('../test-build/summary-panel-identity.js');
  const {hiddenDevicePreferenceKey}=await import('../test-build/hidden-device-visibility.js');
  const old=Object.getOwnPropertyDescriptor(globalThis,'location');
  try{
    const addresses=[];
    for(const pathname of ['/houseplan','/houseplan/kiosk','/houseplan/kiosk/2']){
      Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname}});
      const host={localName:'houseplan-card',panelHost:true,hass:{user:{id:'alice'}},ownerDocument:{defaultView:{location:{pathname}}}};
      addresses.push([summaryPreferenceKey(host),hiddenDevicePreferenceKey(host)]);
      host.panelHost=false;
      assert.ok(summaryPreferenceKey(host).includes(encodeURIComponent(pathname)));
      assert.ok(hiddenDevicePreferenceKey(host).includes(pathname));
    }
    assert.deepEqual(addresses[1],addresses[0]);assert.deepEqual(addresses[2],addresses[0]);
  }finally{if(old)Object.defineProperty(globalThis,'location',old);else delete globalThis.location;}
});

test('#1113 profile links always target the main panel, including settings opened from Lovelace', async()=>{
  const {externalScreenPath}=await import('../test-build/route-kiosk.js');
  assert.equal(externalScreenPath('/houseplan/kiosk/2',true,3),'/houseplan?hpprofile=3');
  assert.equal(externalScreenPath('/houseplan',true,3),'/houseplan?hpprofile=3');
  assert.equal(externalScreenPath('/dashboard/home',false,3),'/houseplan?hpprofile=3');
  assert.equal(externalScreenPath('/',true,3),'/houseplan?hpprofile=3');
  assert.equal(externalScreenPath('',true,3),'/houseplan?hpprofile=3');
});

test('#1113 nested constructor retires stale sessions/authority and cannot write through busy/read-only/disconnected owners', async()=>{
  const {ExternalScreensEditor}=await import('../test-build/editors/external-screens.js');
  const {rememberDialogBaseline}=await import('../test-build/editors/dialog-baseline.js');
  let authority={};const controllers=[];
  const host={isConnected:true,_canEdit:true,_kiosk:false,_connectionWasLost:false,_haExternalScreensApi:1,
    _settingsDialog:{externalScreens:emptyExternalScreens(),busy:false},hass:{user:{id:'admin'}},
    _configWriteContext:{claim:()=>authority,current:value=>value===authority},addController:controller=>controllers.push(controller),requestUpdate(){}};
  rememberDialogBaseline(host,'settings','initial');
  const editor=new ExternalScreensEditor({host});
  editor.open();const first=editor.draft;
  assert.equal(first.row.id,1);editor.change({rotation:90},first.instance);
  assert.equal(host._settingsDialog.externalScreens.screens.length,0,'child edits are detached');
  rememberDialogBaseline(host,'settings','replacement');editor.save(first.instance);
  assert.equal(host._settingsDialog.externalScreens.screens.length,0,'old session has no authority');
  editor.hostUpdate();assert.equal(editor.draft,null);
  for(const flag of ['_canEdit','isConnected','_connectionWasLost','_kiosk']){
    editor.open();const d=editor.draft;assert.ok(d);
    const was=host[flag];host[flag]=!was;editor.save(d.instance);assert.equal(host._settingsDialog.externalScreens.screens.length,0,flag);
    editor.hostUpdate();assert.equal(editor.draft,null);host[flag]=was;
  }
  editor.open();const d=editor.draft;authority={};editor.save(d.instance);
  assert.equal(host._settingsDialog.externalScreens.screens.length,0);editor.hostUpdate();assert.equal(editor.draft,null);
  editor.open();const busy=editor.draft;host._settingsDialog.busy=true;editor.save(busy.instance);editor.hostUpdate();assert.equal(editor.draft,null);
  host._settingsDialog.busy=false;editor.open();const valid=editor.draft;editor.save(valid.instance);
  assert.equal(host._settingsDialog.externalScreens.screens.length,1);assert.equal(host._settingsDialog.externalScreens.next_id,2);
  assert.equal(editor.draft,null);assert.equal(controllers.length,1);
});
