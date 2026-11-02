import test from 'node:test';
import assert from 'node:assert/strict';
import {externalScreensOf,externalScreensForEdit,defaultExternalScreen,defaultExternalScreenView,
  externalScreenView,ExternalScreenResolver,externalScreenEventCandidate} from '../test-build/external-screens.js';
const legacy=()=>({version:1,next_id:2,opaque:'kept',screens:[{id:1,space:null,rotation:90,cycle:30,idle:120,
 summary:'show',hidden_devices:'show',icon_scale:1.5,font_scale:null,controls:true,future:{nested:[1,2]}}]});
const current=()=>({version:2,next_id:2,screens:[defaultExternalScreen(1)]});
test('#1165 legacy conversion is read-only, memoized and preserves inherited presentation',()=>{
 const raw=legacy(),before=structuredClone(raw),converted=externalScreensForEdit(raw);
 assert.equal(externalScreensOf(raw),raw);assert.equal(externalScreensForEdit(raw),converted);
 assert.deepEqual(raw,before);assert.equal(converted.version,2);assert.equal(converted.opaque,'kept');
 assert.deepEqual(converted.screens[0].future,{nested:[1,2]});
 assert.deepEqual(converted.screens[0].default_view,{...defaultExternalScreenView(),rotation:90,summary:'show',icon_scale:1.5});
 assert.deepEqual(converted.screens[0].space_views,{});
 for(const key of ['rotation','summary','hidden_devices','controls','icon_scale','font_scale'])assert.ok(!Object.hasOwn(converted.screens[0],key));
});
test('#1165 each stable space and profile resolves independently and retains raw identity',()=>{
 const raw=current(),row=raw.screens[0];row.space_views.a={...defaultExternalScreenView(),rotation:270,zoom:.5,center_summary:true,summary:'hide',font_scale:2};
 raw.next_id=3;raw.screens.push({...defaultExternalScreen(2),default_view:{...defaultExternalScreenView(),zoom:10}});
 const r=new ExternalScreenResolver(),route={enabled:true,profile:1};
 const a=r.read(raw,route,'a');assert.equal(a.zoom,.5);assert.equal(a.rotation,270);assert.equal(a.summary,false);assert.equal(a.center_summary,true);
 assert.equal(r.read(raw,route,'a'),a);const b=r.read(raw,route,'b');assert.equal(b.zoom,1);assert.equal(b.rotation,0);assert.equal(b.summary,undefined);
 assert.equal(r.read(raw,{enabled:true,profile:2},'a').zoom,10);
 assert.equal(externalScreenView(row,'b'),row.default_view);
});
test('#1165 raw v2 rejects invalid known fields instead of treating them as future',()=>{
 for(const patch of [{zoom:NaN},{zoom:Infinity},{zoom:.09},{zoom:10.01},{zoom:.105},{zoom:true},{center_summary:1},{rotation:45},{font_scale:.51},{summary:'auto'}]){
  const raw=current();Object.assign(raw.screens[0].default_view,patch);assert.equal(externalScreensOf(raw),null,JSON.stringify(patch));
  assert.equal(externalScreenEventCandidate({settings:{}},4,{rev:5,external_screens_update:{version:1,base_rev:4,value:raw}}),null);
 }
 const big=current();big.opaque='я'.repeat(70000);assert.equal(externalScreensOf(big),null);
 assert.equal(externalScreensForEdit({version:3,opaque:'future'}),null);
});
test('#1165 space maps use own stable keys including prototype-like names',()=>{
 const raw=current();raw.screens[0].space_views=JSON.parse('{"__proto__":'+JSON.stringify({...defaultExternalScreenView(),zoom:2})+'}');
 assert.equal(externalScreensOf(raw),raw);assert.equal(externalScreenView(raw.screens[0],'__proto__').zoom,2);
 assert.equal(externalScreenView(raw.screens[0],'constructor').zoom,1);
});
test('#1165 obsolete profile and injected URL controls cannot override House Plan visibility',()=>{
 const raw=legacy(),r=new ExternalScreenResolver();
 const result=r.read(raw,{enabled:true,profile:1,overrides:{hidden_devices:true,controls:true,summary:false}},'floor');
 assert.equal(result.hidden_devices,undefined);assert.equal(result.controls,undefined);assert.equal(result.summary,false);
});
