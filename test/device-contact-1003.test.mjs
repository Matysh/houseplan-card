import test from 'node:test';
import assert from 'node:assert/strict';
import {contactAtCorner,contactBoxIn,contactContains,contactContourShapes,contactOutline,contactRotate,
  deriveContactShape,joinedContactSide} from '../test-build/device-contact-geometry.js';
import {DeviceContactScene} from '../test-build/device-contact-scene.js';
import {DeviceContactMagnet} from '../test-build/device-contact-snap.js';
import {DeviceContactLayout} from '../test-build/device-contact-layout.js';
import {contactBasisMarker,makeContactBasis,readContactBasis} from '../test-build/device-contact-basis.js';
import {contactIntersectsMasonry} from '../test-build/device-contact-collision.js';
const marker=(id,x=200,y=200,d=40)=>({id,x,y,diameter:d,box:{left:-d*.634375,right:d*.634375,top:-d*.634375,bottom:d*.634375}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const left={id:'left',a:[0,0],b:[0,500],normal:[1,0]};
const canonical=(x,y)=>({x:+x.toFixed(7),y:+y.toFixed(7)});

test('#1003 AC1 corner has both finite faces from every approach and rotated basis',()=>{
  for(const angle of [0,Math.PI/6,-Math.PI/6]) for(const p of [[29,26],[26,29],[29,29]]){
    const r=p=>contactRotate(p,angle),walls=[left,{id:'top',a:[0,0],b:[500,0],normal:[0,1]}]
      .map(w=>({...w,a:r(w.a),b:r(w.b),normal:r(w.normal)}));
    const [x,y]=r(p),m=marker('m',x,y),scene=new DeviceContactScene([m],walls);
    const snap=new DeviceContactMagnet(scene,m,canonical).resolve(x,y,1,1);
    assert.ok(snap?.key.startsWith('corner:'));
    const shape=deriveContactShape({...m,x:snap.x,y:snap.y},walls);
    assert.deepEqual(Object.values(shape.walls).sort(),['left','top']);
  }
  assert.deepEqual(contactAtCorner(marker('m',29,29),[{...left,b:[0,10]},
    {id:'top',a:[0,0],b:[10,0],normal:[0,1]}]),[],'short finite faces cannot become a corner');
});

test('#1003 AC2 old recognition is explicit; new contact never accepts stored slack',()=>{
  const a=deriveContactShape(marker('a'),[]),b=deriveContactShape(marker('b',249),[]);
  assert.equal(joinedContactSide(a,b),null);
  assert.equal(joinedContactSide(a,b,false),'right');
  const c=deriveContactShape(marker('b',245),[]);
  assert.equal(joinedContactSide(a,c),'right');
});

test('#1003 AC11 a captured resolver uses the current HA face, not its pointerdown width',()=>{
  const a=marker('a',100),b=marker('b',200),scene=new DeviceContactScene([a,b],[]);
  const magnet=new DeviceContactMagnet(scene,a,canonical);
  const wide={...a,box:{...a.box,right:35}};scene.replace(wide);
  const snap=magnet.resolve(150,200,1,1);
  assert.equal(snap.kind,'device');
  assert.equal(joinedContactSide(deriveContactShape({...wide,x:snap.x,y:snap.y},[]),scene.shapes.get('b')),'right');
});

test('#1003 AC4/AC8/AC10 shared normalised contour/hit keeps wall, free end and L void',()=>{
  const a=deriveContactShape(marker('a',25.75,200),[left]),b=deriveContactShape(marker('b',70.75,200),[left]);
  const saved=JSON.stringify([a,b]),[x,y]=contactContourShapes([a,b]);
  near(contactBoxIn(x).top,contactBoxIn(y).top);near(contactBoxIn(x).left,0);
  assert.equal(JSON.stringify([a,b]),saved,'projection never mutates reference or snap targets');
  const normalised=contactContourShapes([deriveContactShape({...marker('a'),box:{...marker('a').box,right:60}},[]),
    deriveContactShape(marker('b',200,245),[])]);
  near(contactBoxIn(normalised[0]).right,contactBoxIn(normalised[1]).right);
  assert.ok(contactContains(normalised[1],[255,245]),'own hit uses the same extended empty field');
  const l=[marker('a'),marker('b',245),marker('c',200,245)].map(m=>deriveContactShape(m,[]));
  const projected=contactContourShapes(l);
  assert.ok(projected.every(s=>!contactContains(s,[250,250])),'empty L corner is not a group target');
});

test('#1003 AC8 open stroke removes only wall-owned edges, closed hit remains',()=>{
  const walls=[left,{id:'top',a:[0,0],b:[500,0],normal:[0,1]}];
  const shape=deriveContactShape(marker('m',25.75,25.75),walls);
  const stroke=contactOutline([shape],true),hit=contactOutline([shape]);
  assert.ok(hit.endsWith(' Z'));assert.ok(!stroke.includes('Z'));
  let cursor=null;
  const straight=[];
  for(const token of stroke.matchAll(/([MLA])([^MLA]+)/g)){
    const values=token[2].trim().split(/\s+/).map(Number),point=values.slice(-2);
    if(token[1]==='L'&&cursor)straight.push([...cursor,...point]);
    cursor=point;
  }
  assert.equal(straight.length,2);
  assert.ok(straight.every(([x1,y1,x2,y2])=>!(x1===0&&x2===0)&&!(y1===0&&y2===0)));
  assert.ok(contactContains(shape,[0,20]));
});

test('#1003 AC5/AC6 live widths reflow from a stable free anchor without drift',()=>{
  const a=marker('a'),b=marker('b',245),layout=new DeviceContactLayout(),bases=new Map();
  assert.deepEqual(layout.resolve([a,b],[],[],bases,'floor'),[a,b]);
  const wide={...a,box:{...a.box,right:60}},before=JSON.stringify([a,b]);
  const grown=layout.resolve([wide,b],[],[],bases,'floor');
  near(grown[0].x,200);near(grown[1].x,279.625);
  assert.equal(joinedContactSide(...grown.map(m=>deriveContactShape(m,[]))),'right');
  assert.deepEqual(layout.resolve([a,b],[],[],bases,'floor'),[a,b]);
  assert.deepEqual(layout.resolve([wide,b],[],[],bases,'floor'),grown);
  assert.equal(JSON.stringify([a,b]),before);assert.equal(layout.work.referenceBuilds,1);
});

test('#1003 AC5/AC12 durable basis reproduces live layout in a cold renderer and rejects stale identity',()=>{
  const a=marker('a'),b=marker('b',245),wide={...a,box:{...a.box,right:60}};
  const entries=new Map([a,b].map(m=>[m.id,{x:m.x/1000,y:m.y/1000,s:'floor',contact_basis:makeContactBasis(m,'floor')}]));
  const bases=new Map([wide,b].map(m=>[m.id,contactBasisMarker(m,entries.get(m.id),'floor')]));
  const first=new DeviceContactLayout().resolve([wide,b],[],[],bases,'floor');
  assert.deepEqual(new DeviceContactLayout().resolve([wide,b],[],[],bases,'floor'),first);
  assert.equal(contactBasisMarker(wide,{...entries.get('a'),x:.201},'floor'),null);
  assert.equal(contactBasisMarker(wide,entries.get('a'),'other-floor'),null);
  for(const bad of [null,{},NaN,{v:2},{...makeContactBasis(a,'floor'),diameter:Infinity},
    {...makeContactBasis(a,'floor'),box:[0,0,0,0]},
    {...makeContactBasis(a,'floor'),diameter:1e-12,box:[-5000,-5000,5000,5000]}])assert.equal(readContactBasis(bad),null);
});

test('#1003 AC6 wall anchor follows its real face while a changed value moves neighbours',()=>{
  const a=marker('a',25.75),b=marker('b',70.75),layout=new DeviceContactLayout();
  layout.resolve([a,b],[left],[],new Map(),'floor');
  const wide={...a,box:{...a.box,right:60}};
  const grown=layout.resolve([wide,b],[left],[],new Map(),'floor');
  const shapes=grown.map(m=>deriveContactShape(m,[left]));
  near(contactBoxIn(shapes[0]).left,0);assert.equal(joinedContactSide(...shapes),'right');
});

test('#1003 AC7 impossible width releases only the obstructed contacts and shrink restores them',()=>{
  const a=marker('a'),b=marker('b',245),outside=marker('outside',400,400);
  const solid=[[[[325,150],[345,150],[345,260],[325,260],[325,150]]]];
  const layout=new DeviceContactLayout(),bases=new Map();
  layout.resolve([a,b,outside],[],solid,bases,'floor');
  const wide={...a,box:{...a.box,right:120}};
  const separated=layout.resolve([wide,b,outside],[],solid,bases,'floor');
  const shapes=separated.map(m=>deriveContactShape(m,[]));
  assert.ok(shapes.every(s=>!contactIntersectsMasonry(s,solid)));
  assert.equal(joinedContactSide(shapes[0],shapes[1],false),null,'no fabricated contact');
  assert.deepEqual(separated[2],outside);
  assert.deepEqual(layout.resolve([a,b,outside],[],solid,bases,'floor'),[a,b,outside]);
  assert.deepEqual(layout.resolve([wide,b,outside],[],solid,bases,'floor'),separated,'no accumulated fallback offset');
});

test('#1003 AC15 identical 200-marker frame does not rebuild indexes or solve again',()=>{
  const markers=Array.from({length:200},(_,i)=>marker(`id-${i}`,100+(i%20)*80,100+Math.floor(i/20)*80));
  const layout=new DeviceContactLayout(),bases=new Map();
  const first=layout.resolve(markers,[],[],bases,'floor'),work={...layout.work};
  for(let i=0;i<20;i++)assert.deepEqual(layout.resolve(structuredClone(markers),[],[],bases,'floor'),first);
  assert.deepEqual(layout.work,work);
  const changed=structuredClone(markers);changed[0].box.right+=10;
  layout.resolve(changed,[],[],bases,'floor');
  assert.equal(layout.work.referenceBuilds,work.referenceBuilds);
  assert.equal(layout.work.occupancyBuilds,work.occupancyBuilds);
  assert.equal(layout.work.components-work.components,1);
});
