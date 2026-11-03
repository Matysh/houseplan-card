import {currentGraphFixture,editGraphFixture} from '../../../../test/helpers/graph-fixture.mjs';
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const config=currentGraphFixture({spaces:[{id:'split',cell_cm:5,rooms:[
{id:'left',poly:rect(.1,.15,.5,.5)}, {id:'right',poly:rect(.5,.15,.9,.5)},
{id:'bottom-left',poly:rect(.1,.5,.5,.85),extension:{fixed:true}},
{id:'bottom-right',poly:rect(.5,.5,.9,.85)}]}]});
const before=structuredClone(config.spaces[0]);
editGraphFixture(config,'split',{kind:'resize',rooms:['left','right']},draft=>{
for(const r of draft.rooms)if(['left','right'].includes(r.id))r.poly=r.poly.map(p=>[p[0]===.5?.45:p[0],p[1]]);
});
const after=config.spaces[0];
const fixed=after.rooms.find(r=>r.id==='bottom-left');
const seams=after.wall_segments.filter(e=>e.a[1]===.5&&e.b[1]===.5).map(e=>({id:e.id,a:e.a,b:e.b,cm:e.cm}));
const ok=fixed.poly.some(p=>p[0]===.45&&p[1]===.5);
console.log(JSON.stringify({base:'0bda944e3',beforeFixed:before.rooms.find(r=>r.id==='bottom-left'),afterFixed:fixed,seams,hasIncidentSplitNode:ok},null,2));
if(!ok)process.exitCode=1;
