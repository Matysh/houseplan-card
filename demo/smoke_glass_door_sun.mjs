import assert from 'node:assert/strict';
import {launch,checkAll,finish} from './serve.mjs';
import {currentGraphFixture} from './helpers/graph-fixture.mjs';
import {makeStaticWallOpeningsFixture} from './fixtures/static-wall-openings.mjs';
import {mkdirSync} from 'node:fs';
import {fixtureWallKey} from './fixtures/wall-key.mjs';
const authored=makeStaticWallOpeningsFixture(),space=authored.spaces[0];
space.openings=[
 {id:'window',type:'window',x:.125,y:.5,angle:90,length:.5,host:{kind:'wall',id:'west',t:.5}},
 {id:'glass',type:'door',x:.625,y:.5,angle:90,length:.125,contact:'binary_sensor.window',host:{kind:'wall',id:'shared',t:.5}}
];
Object.assign(authored.settings,{sun_rays:true,north_deg:0});space.partitions=[];
// A 200-unit source room fits within both renderers' existing reach.
const narrow=([x,y])=>[.375+x*.4,y];
for(const r of space.rooms)r.poly=r.poly.map(narrow);
for(const w of [...space.wall_segments,...space.walls]){w.a=narrow(w.a);w.b=narrow(w.b);w.key=fixtureWallKey(w.a,w.b);}
for(const o of space.openings)o.x=.375+o.x*.4;
const fixture=currentGraphFixture(authored),out={};
const {page,browser}=await launch({width:1280,height:900});
mkdirSync('artifacts/glass-door-1348',{recursive:true});
const inside=async iso=>page.evaluate(iso=>{
 const c=window.__card,door=c._openingsR.find(o=>o.id==='glass'),p=[door.rx+door.rlen*.3,door.ry];
 const point=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 const beams=iso?c._isoSunCache?.beams:c._sunRaysCache?.rays;
 const geometry=beams?.some(r=>r.polys.some(poly=>point(p,poly)))??false;
 const rendered=[...c.renderRoot.querySelectorAll('.sunlayer path,.sunlayer polygon')].some(el=>el.isPointInFill?.(new DOMPoint(...p)));
 return {geometry,rendered,symbol:c._openingAmt(door),p,beams:beams?.map(r=>[r.openingId,r.roomId])};
},iso);
try{
 await page.evaluate(async config=>{await window.__hpTest.setServerConfig(config);await window.__hpTest.switchSpace('f1');const c=window.__card;
 c.hass={...c.hass,states:{...c.hass.states,'binary_sensor.window':{...c.hass.states['binary_sensor.window'],state:'off'},
 'sun.sun':{entity_id:'sun.sun',state:'above_horizon',attributes:{azimuth:270,elevation:10,rising:false}}}};
 await window.__hpTest.settled();},fixture);
 let state=await inside(false);assert.equal(state.geometry,false,JSON.stringify(state));out.closedOpaqueFlat=true;
 await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{cfg.spaces[0].openings.find(o=>o.id==='glass').light_transparent=true;}));
 state=await inside(false);assert.equal(state.geometry,false,JSON.stringify(state));assert.equal(state.rendered,false,JSON.stringify(state));assert.equal(state.symbol,0);out.interiorGlassKeepsFlatLocal=true;
 await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/glass-door-1348/flat.png'});
 await page.evaluate(() => window.__hpTest.setVolumetricView(true));
 state=await inside(true);assert.equal(state.geometry,false,JSON.stringify(state));assert.equal(state.symbol,0);assert.ok(await page.locator('.sunlayer polygon,.sunlayer path').count());out.interiorGlassKeepsIsoLocal=true;
 await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/glass-door-1348/iso.png'});
 await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{delete cfg.spaces[0].openings.find(o=>o.id==='glass').light_transparent;}));
 state=await inside(true);assert.equal(state.geometry,false,JSON.stringify(state));out.toggleInvalidatesIso=true;
 await page.evaluate(()=>window.__hpTest.setVolumetricView(false));state=await inside(false);assert.equal(state.geometry,false,JSON.stringify(state));out.toggleInvalidatesFlat=true;
 await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{Object.assign(cfg.spaces[0].openings.find(o=>o.id==='window'),{type:'door',light_transparent:true});}));
 for(const iso of [false,true]){await page.evaluate(iso=>window.__hpTest.setVolumetricView(iso),iso);
 const beams=await page.evaluate(iso=>{const c=window.__card;return (iso?c._isoSunCache?.beams:c._sunRaysCache?.rays)?.map(r=>r.openingId);},iso);
 assert.ok(beams?.includes('window'),'exterior glass door remains a solar source');assert.equal((await inside(iso)).geometry,false);}
 out.exteriorGlassBothRenderers=true;
 await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{delete cfg.spaces[0].openings.find(o=>o.id==='window').light_transparent;}));
 assert.equal(await page.locator('.sunlayer polygon,.sunlayer path').count(),0,'opaque exterior door is not a solar source');out.exteriorOpaqueStaysDark=true;
}catch(error){out.completed=false;throw error;}finally{checkAll(out);await finish(browser,out);}
