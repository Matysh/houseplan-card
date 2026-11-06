import{readFileSync,writeFileSync}from'node:fs';
import{chromium}from'playwright';
import * as Q from '../../test-build/plan-exact.js';
import{directWallGeometry,directStructure,directRoomFloor}from'../../test-build/direct-wall-geometry.js';
import{polyclipToPathD}from'../../test-build/wall-thickness.js';
const dir='artifacts/corner-20261106';const exp={card_version:'1.84.0',payload:{config:JSON.parse(readFileSync(dir+'/minimal-config.json'))}};const s=exp.payload.config.spaces[0],g=s.plan_graph;
const pts=new Map(g.nodes.map(n=>[n.id,Q.pointToNumbers(Q.decodePoint(n.p))]));
const before=JSON.stringify(g),source={graph:g,scale:1};const structure=directStructure(source,1,1/240),geometry=directWallGeometry(source,1,1/240,[],[]);
const floors=s.rooms.map(r=>({id:r.id,geom:directRoomFloor(source,1,1/240,r.poly)}));
writeFileSync(dir+'/geometry.json',JSON.stringify({keys:Object.keys(geometry),status:geometry.status,geometry,floors},null,2));
const nodeRows=[...pts].map(([id,p])=>{const edges=g.edges.filter(e=>e.from===id||e.to===id).map(e=>{const q=pts.get(e.from===id?e.to:e.from),v=q.map((x,i)=>x-p[i]);return{id:e.id,kind:e.kind,cm:e.cm,to:q,degrees:Math.atan2(v[1],v[0])*180/Math.PI,length:Math.hypot(...v)};});return{id,p,edges};});
writeFileSync(dir+'/nodes.json',JSON.stringify(nodeRows,null,2));
const path=geom=>polyclipToPathD(geom);const html=`<html><body style="margin:0;background:#1c2430"><svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1300" viewBox="1.65 -1.45 1.15 1.2"><defs><pattern id="h" width=".035" height=".035" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V.035" stroke="#59616b" stroke-width=".004"/></pattern></defs><g fill-rule="evenodd"><path d="${path(geometry.paperGeom||geometry.paper||[])}" fill="white"/>${floors.map(f=>`<path d="${path(f.geom)}" fill="white"/>`).join('')}<path d="${path(geometry.geom)}" fill="white"/><path d="${path(geometry.geom)}" fill="url(#h)" stroke="#59616b" stroke-width=".002"/></g></svg></body></html>`;
writeFileSync(dir+'/geometry.html',html);const b=await chromium.launch({headless:true});const page=await b.newPage({viewport:{width:1400,height:1300}});await page.setContent(html);await page.screenshot({path:dir+'/geometry.png'});await b.close();
console.log(JSON.stringify({sourceVersion:exp.card_version,geometryStatus:geometry.status,graphUnchanged:before===JSON.stringify(g),geometryKeys:Object.keys(geometry),nodes:nodeRows.filter(n=>n.p[0]>1.9&&n.p[0]<2.7&&n.p[1]>-1.5&&n.p[1]<0)},null,2));

