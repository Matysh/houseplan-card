// Read-only screen presentation: physical-length and interaction rules live in the sibling suites.
import assert from 'node:assert/strict';
import test from 'node:test';
import {layoutWallSideDimensions,dimensionListBox,resizeHandleDimensionObstacle,screenDimensionObstacle} from '../test-build/wall-side-dimension-layout.js';

test('#1403 fixed editor tray is a clipped screen obstacle, not projected plan geometry',()=>{
  const stage={x:100,y:200,w:600,h:400};
  assert.deepEqual(screenDimensionObstacle(stage,{x:90,y:190,w:640,h:100},600,400),{x:0,y:0,w:600,h:90});
  assert.deepEqual(screenDimensionObstacle(stage,{x:100,y:200,w:600,h:90},1200,800),{x:0,y:0,w:1200,h:180});
  assert.equal(screenDimensionObstacle(stage,{x:100,y:100,w:600,h:80},600,400),null);
  assert.equal(screenDimensionObstacle(stage,{x:100,y:200,w:0,h:90},600,400),null);
  assert.equal(screenDimensionObstacle({...stage,w:0},{x:100,y:200,w:600,h:90},600,400),null);
});
import {formatLength} from '../test-build/logic.js';
import {propertiesT} from '../test-build/editors/properties/strings.js';
const dimension={id:'wall:1:-1:0',carrier:'wall:1',side:-1,order:0,source:'physical',
  from:[50,50],to:[250,50],normal:[0,-1],low:0,high:200,lengthCm:200};
const input=(intervals=[dimension])=>({intervals,width:600,height:400,project:p=>p,
  format:cm=>formatLength(cm,false,3),unavailable:'Dimension unavailable',textWidth:s=>s.length*6.3,obstacles:[],lanes:new Map(),numbers:new Map()});
test('#1403 vertical dimensions hidden by a top tray retain their exact value in an unobscured list',()=>{
  const edge={...dimension,from:[260,40],to:[260,120],normal:[1,0],lengthCm:120};
  const tray={x:0,y:0,w:600,h:100},base={...input([edge]),obstacles:[tray]};
  const before=layoutWallSideDimensions(input([edge]))[0];
  assert.ok(before.labelBox.y<100,'the original value is behind the tray');
  const items=layoutWallSideDimensions(base),placed=items[0];
  assert.equal(placed.listed,true);assert.equal(placed.label,'1.200 m');
  assert.ok(placed.labelBox.y>=103,'the numbered reference is below the tray');
  const list=dimensionListBox(items,600,400,[tray]);assert.ok(list.y>=100);
  assert.deepEqual(placed.a,edge.from);assert.deepEqual(placed.b,edge.to);
});
test('#1381 witnesses start at exact corners and remain normal; zoom only changes projection',()=>{
  const base=input(),first=layoutWallSideDimensions(base)[0];
  assert.deepEqual(first.a,[50,50]);assert.deepEqual(first.b,[250,50]);
  assert.deepEqual(first.railA,[50,38]);assert.deepEqual(first.railB,[250,38]);
  assert.equal(first.label,'2.000 m');
  const zoomed=layoutWallSideDimensions({...base,project:p=>[p[0]*2,p[1]*2]})[0];
  assert.equal(zoomed.a[1]-zoomed.railA[1],12);
  assert.equal(zoomed.railA[0],zoomed.a[0]);
  assert.equal(zoomed.label,first.label);assert.equal(zoomed.interval.lengthCm,200);
});
test('#1381 diagonal rails retain the true interval, without rotating text upside down',()=>{
  const placement=layoutWallSideDimensions({...input(),project:p=>[p[0]+p[1],300-p[0]+p[1]]})[0];
  const witness=[placement.railA[0]-placement.a[0],placement.railA[1]-placement.a[1]];
  const rail=[placement.railB[0]-placement.railA[0],placement.railB[1]-placement.railA[1]];
  assert.ok(Math.abs(witness[0]*rail[0]+witness[1]*rail[1])<1e-8);
  assert.ok(Math.abs(Math.hypot(...witness)-12)<1e-8);
});
test('#1381 thin-wall labels avoid the real Resize arrow, without treating its hit disk as painted ink',()=>{
  const thin={...dimension,from:[50,50.5],to:[250,50.5],normal:[0,1]};
  const base=input([thin]),handle=resizeHandleDimensionObstacle([50,50],[250,50],p=>p,600,600);
  const intersects=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
  assert.ok(intersects(layoutWallSideDimensions(base)[0].labelBox,handle),'precondition: the first thin-wall row collides');
  const placed=layoutWallSideDimensions({...base,obstacles:[handle]})[0];
  assert.ok(!intersects(placed.labelBox,handle));assert.ok(placed.lane>0);
  assert.deepEqual(placed.a,thin.from);assert.deepEqual(placed.b,thin.to);
});
test('#1381 dense fallback retains every interval and stable numeric correspondence',()=>{
  const intervals=Array.from({length:23},(_,i)=>({...dimension,id:`wall:${i}:-1:0`,carrier:`wall:${i}`}));
  const base={...input(intervals),width:300,height:150,obstacles:[{x:0,y:0,w:300,h:150}]};
  const placements=layoutWallSideDimensions(base);
  assert.equal(placements.length,23);assert.ok(placements.every(p=>p.listed));
  assert.equal(new Set(placements.map(p=>p.number)).size,23);
  for(let i=0;i<placements.length;i++)for(const other of placements.slice(i+1)) {
    const a=placements[i].labelBox,b=other.labelBox;
    assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'dense markers remain independently legible');
  }
  const list=dimensionListBox(placements,300,150,base.obstacles);
  assert.ok(list&&list.h<=150&&list.w<=300);
  const smaller=layoutWallSideDimensions({...base,intervals:intervals.slice(10)});
  assert.equal(smaller[0].number,11,'existing intervals are not renumbered');
});
test('#1381 unprovable axis is named honestly, without manufactured dimension endpoints',()=>{
  const item={...dimension,id:'missing',source:'unavailable',from:null,to:null,lengthCm:null,anchor:[100,100]};
  const placement=layoutWallSideDimensions(input([item]))[0];
  assert.equal(placement.label,'Dimension unavailable');
  assert.equal(placement.interval.from,null);assert.equal(placement.interval.to,null);
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(placement)));
});
test('#1381 metric precision is opt-in; imperial and existing consumers retain their format',()=>{
  assert.equal(formatLength(340.7,false,3),'3.407 m');
  assert.equal(formatLength(340.7,false),'3.41 m');
  assert.equal(formatLength(340.7,true,3),formatLength(340.7,true));
  for(const language of ['ru','en','de','fr'])for(const key of ['wall_dimensions','wall_dimension_unavailable','wall_dimensions_hint','wall_dimensions_axis_hint','wall_dimensions_axis_fallback','wall_dimensions_boundary','wall_dimensions_boundary_hint']) {
    const label=propertiesT(language,key);
    assert.notEqual(label,key);assert.ok(label.length>0);
  }
  assert.equal(propertiesT('ru','wall_dimensions_hint'),'Длина по оси. Размеры сторон показаны на плане.');
});
import {openingDimensionRecord,lineDimensionRecord,spacingDimensionRecords} from '../test-build/editor-dimension-adapters.js';
import {SpacingMagnet} from '../test-build/device-spacing.js';

test('#1398 all adapters use physical supports and the same screen-space rail contract, including zero',()=>{
  const opening={from:[100,100],to:[100,100],axis:[1,0],labelNormal:[0,-1],distance:0};
  const zero=openingDimensionRecord(opening,'gap',1.2);
  const line=lineDimensionRecord([100,100],[400,300],1.2);
  assert.equal(zero.lengthCm,0);assert.deepEqual(zero.direction,[1,0]);
  assert.equal(line.lengthCm,Math.hypot(300,200)*1.2);
  assert.ok(line.normal[1]<0);assert.equal(lineDimensionRecord([1,1],[1,1],1),null);
  const m=new SpacingMagnet([{x:100,y:200},{x:200,y:200},{x:300,y:200}],
    (x,y)=>({x,y,p:{x,y}}),20);
  m.resolve(400,200,1,1);
  const gaps=spacingDimensionRecords(m,1.2);
  assert.deepEqual(gaps.map(d=>[d.from,d.to]),[[[100,200],[200,200]],[[200,200],[300,200]],[[300,200],[400,200]]]);
  const layout=layoutWallSideDimensions({intervals:[zero,...gaps],width:800,height:600,project:p=>p,
    format:cm=>formatLength(cm,false,3),unavailable:'unavailable',textWidth:t=>t.length*6,
    obstacles:[],lanes:new Map(),numbers:new Map()});
  assert.equal(layout.length,4);assert.equal(layout[0].label,'0.000 m');
  assert.deepEqual(layout[0].tangent,[1,0]);assert.equal(layout[0].railA[1],88);
  for(const item of layout.slice(1)) {
    assert.equal(item.label,'1.200 m');assert.equal(item.railA[1],168);
    assert.equal(item.labelBox.h,16);assert.deepEqual(item.a,item.interval.from);
  }
  for(const bad of [{lengthCm:NaN},{lengthCm:-1},{from:[NaN,0]},{to:null}])
    assert.equal(layoutWallSideDimensions({...input(),intervals:[{...zero,...bad}]}).length,0,'no fake zero/NaN for an unavailable physical reference');
});
