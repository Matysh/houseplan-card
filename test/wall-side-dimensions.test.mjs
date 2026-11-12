import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveWallSideDimensions,changedWallSideDimensions} from '../test-build/wall-side-dimensions.js';

const rectangle=(x1,y1,x2,y2)=>[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]];
const geometry=(carriers,rings,materials)=>({carriers,geometry:[rings],materials,perUnitCm:1,epsilon:1e-8});
const carrier={id:'wall:bounded',a:[0,0],b:[320,0],cm:20};
const owned=(poly,owners=[carrier.id])=>({owners,poly});

test('#1381 free flat ends retain two equal real sides; reversal never exchanges them',()=>{
  const body=rectangle(0,-10,320,10),input=geometry([carrier],[body],[owned(body)]);
  const result=resolveWallSideDimensions(input);
  assert.deepEqual(result.map(i=>[i.side,i.source,i.lengthCm,i.from,i.to]),[
    [-1,'physical',320,[0,-10],[320,-10]], [1,'physical',320,[0,10],[320,10]],
  ]);
  assert.deepEqual(resolveWallSideDimensions({...input,carriers:[{...carrier,a:carrier.b,b:carrier.a}]}),result);
  assert.equal(resolveWallSideDimensions({...input,carriers:[carrier,carrier]}).length,2);
});

test('#1381 rectangular room measures physical 3.00/3.40 m, not its 3.20 m axis',()=>{
  // Independent manually specified masonry, including both visible corners.
  const outside=rectangle(-10,-10,330,210),inside=rectangle(10,10,310,190);
  const material=rectangle(-10,-10,330,10);
  const result=resolveWallSideDimensions(geometry([carrier],[outside,inside],[owned(material)]));
  assert.deepEqual(result.map(i=>[i.side,i.lengthCm,i.from,i.to]),[
    [-1,340,[-10,-10],[330,-10]], [1,300,[10,10],[310,10]],
  ]);
});

test('#1381 stable endpoint identities prevent side/row flips while crossing a vertical pose',()=>{
  const at=x=>{
    const a=[0,0],b=[x,100],len=Math.hypot(x,100),n=[-100/len,x/len];
    const body=[[a[0]-n[0]*5,a[1]-n[1]*5],[b[0]-n[0]*5,b[1]-n[1]*5],
      [b[0]+n[0]*5,b[1]+n[1]*5],[a[0]+n[0]*5,a[1]+n[1]*5]];
    const wall={id:'vertical',a,b,cm:10,ends:['fixed','moving']};
    const input=geometry([wall],[body],[owned(body,['vertical'])]);
    const result=resolveWallSideDimensions(input);
    assert.deepEqual(resolveWallSideDimensions({...input,carriers:[{...wall,a:b,b:a,ends:['moving','fixed']}]}),result);
    return result;
  };
  const before=at(1),after=at(-1);
  assert.deepEqual(after.map(i=>i.id),before.map(i=>i.id));
  assert.ok(after.every((i,index)=>i.normal[0]*before[index].normal[0]+i.normal[1]*before[index].normal[1]>.99));
});

test('#1381 T junction has an asymmetric 1-to-2 chain; opening-free carrier is the authority',()=>{
  const wall={id:'horizontal',a:[0,0],b:[100,0],cm:10};
  const outline=[[0,-5],[100,-5],[100,5],[55,5],[55,40],[45,40],[45,5],[0,5],[0,-5]];
  const input=geometry([wall],[outline],[owned(rectangle(0,-5,100,5),[wall.id])]);
  const result=resolveWallSideDimensions(input);
  assert.deepEqual(result.map(i=>[i.side,i.low,i.high,i.lengthCm]),[[-1,0,100,100],[1,0,45,45],[1,55,100,45]]);
  assert.ok(result.every(i=>i.source==='physical'));
  const swapped=resolveWallSideDimensions({...input,materials:[owned(rectangle(0,-5,100,5),['different-carrier'])]});
  assert.ok(swapped.every(i=>i.source==='axis'),'a spatially matching face with foreign lineage is not proof');
});

test('#1381 an internal arrangement split is not a stop; an adjacent saved carrier stays bounded',()=>{
  const outline=rectangle(0,-5,200,5),wall={id:'first',a:[0,0],b:[100,0],cm:10};
  const input=geometry([wall],[outline],[owned(rectangle(0,-5,40,5),['first']),owned(rectangle(40,-5,100,5),['first']),
    owned(rectangle(100,-5,200,5),['second'])]);
  assert.deepEqual(resolveWallSideDimensions(input).map(i=>[i.low,i.high,i.lengthCm]),[[0,100,100],[0,100,100]]);
});

test('#1381 X junction has two true intervals on either side, with finite lineage',()=>{
  const wall={id:'cross',a:[0,0],b:[100,0],cm:10};
  const outline=[[0,-5],[45,-5],[45,-40],[55,-40],[55,-5],[100,-5],[100,5],
    [55,5],[55,40],[45,40],[45,5],[0,5],[0,-5]];
  const input=geometry([wall],[outline],[owned(rectangle(0,-5,100,5),['cross']),
    owned(rectangle(45,-40,55,40),['branch'])]);
  const result=resolveWallSideDimensions(input);
  assert.deepEqual(result.map(i=>[i.side,i.low,i.high]),[[-1,0,45],[-1,55,100],[1,0,45],[1,55,100]]);
  assert.equal(new Set(result.map(i=>i.id)).size,4);
  assert.deepEqual(resolveWallSideDimensions({...input,geometry:[[outline.slice().reverse()]],materials:input.materials.slice().reverse()}),result);
});

test('#1381 T supports keep interval identities while its branch moves, without a phantom paired cut',()=>{
  const wall={id:'beam',a:[0,0],b:[100,0],cm:10};
  const at=x=>{
    const outline=[[0,-5],[100,-5],[100,5],[x+5,5],[x+5,40],[x-5,40],[x-5,5],[0,5],[0,-5]];
    return resolveWallSideDimensions(geometry([wall],[outline],[owned(rectangle(0,-5,100,5),['beam']),
      owned(rectangle(x-5,0,x+5,40),['branch'])]));
  };
  const before=at(50),next=at(65);
  assert.deepEqual(next.map(i=>i.id),before.map(i=>i.id));
  assert.deepEqual(next.map(i=>i.lengthCm),[100,60,30]);
  assert.equal(changedWallSideDimensions(before,next,1e-8).length,3);
});

test('#1381 a thickness step stops at the bounded source, never stretches to the facade',()=>{
  const wall={id:'thin',a:[0,0],b:[100,0],cm:10};
  const outline=[[0,-5],[100,-5],[100,-10],[200,-10],[200,10],[100,10],[100,5],[0,5],[0,-5]];
  const result=resolveWallSideDimensions(geometry([wall],[outline],[owned(rectangle(0,-5,100,5),['thin']),
    owned(rectangle(100,-10,200,10),['thick'])]));
  assert.deepEqual(result.map(i=>[i.lengthCm,i.from,i.to]),[[100,[0,-5],[100,-5]],[100,[0,5],[100,5]]]);
});

test('#1381 continuing outer facade reaches the physical transverse support, not its axis seam',()=>{
  const wall={id:'left',a:[0,0],b:[100,0],cm:10},body=rectangle(0,-5,200,5);
  const result=resolveWallSideDimensions({...geometry([wall],[body],[owned(rectangle(0,-5,100,5),['left']),
    owned(rectangle(100,-5,200,5),['right']),owned(rectangle(90,-5,110,50),['cross'])]),
    supports:[wall,{id:'right',a:[100,0],b:[200,0],cm:10},{id:'cross',a:[100,0],b:[100,50],cm:20}]});
  assert.equal(result[0].high,110);
  assert.equal(result[0].lengthCm,110);
  assert.ok(result.every(i=>i.high<=110),'collinear right carrier never extends the selected left wall to 200');
});

test('#1381 diagonal/bevel ends use the finite visible corner, not an infinite offset intersection',()=>{
  const wall={id:'bevel',a:[0,0],b:[100,0],cm:10};
  const body=[[0,-5],[100,-5],[90,5],[0,5],[0,-5]],rotate=p=>[(p[0]-p[1])/Math.SQRT2,(p[0]+p[1])/Math.SQRT2];
  const rotated={...wall,a:rotate(wall.a),b:rotate(wall.b)};
  const result=resolveWallSideDimensions(geometry([rotated],[body.map(rotate)],[owned(body.map(rotate),['bevel'])]));
  assert.ok(Math.abs(result[0].lengthCm-100)<1e-8);
  assert.ok(Math.abs(result[1].lengthCm-90)<1e-8);
  for(const interval of result)assert.ok(interval.from.every(Number.isFinite)&&interval.to.every(Number.isFinite));
});

test('#1381 only an attached construction column interrupts the physical side',()=>{
  const wall={id:'column-wall',a:[0,0],b:[100,0],cm:10};
  const outline=[[0,-5],[100,-5],[100,5],[60,5],[60,20],[40,20],[40,5],[0,5],[0,-5]];
  const body=rectangle(0,-5,100,5),column=rectangle(40,0,60,20);
  const attached=resolveWallSideDimensions(geometry([wall],[outline],[owned(body,[wall.id]),owned(column,['column:c'])]));
  assert.deepEqual(attached.map(i=>[i.side,i.lengthCm]),[[-1,100],[1,40],[1,40]]);
  const remote=rectangle(40,15,60,30);
  const separated=resolveWallSideDimensions(geometry([wall],[body,remote],[owned(body,[wall.id]),owned(remote,['column:c'])]));
  assert.deepEqual(separated.map(i=>i.lengthCm),[100,100]);
});

test('#1381 zero thickness and unproved positive faces use an honest axis fallback',()=>{
  for(const cm of [0,20]) {
    const input=geometry([{...carrier,cm}],[],[]);
    const result=resolveWallSideDimensions(input);
    assert.deepEqual(result.map(i=>[i.source,i.lengthCm,i.from,i.to]),[
      ['axis',320,[0,0],[320,0]],['axis',320,[0,0],[320,0]],
    ]);
  }
  for(const a of [[NaN,0],[Infinity,1],[320,0]]) {
    const missing=resolveWallSideDimensions(geometry([{...carrier,a}],[],[]));
    assert.equal(missing.length,2);
    assert.ok(missing.every(i=>i.source==='unavailable'&&i.from===null&&i.to===null&&i.lengthCm===null));
  }
});

const interval=(id,side,low,high,lengthCm=high-low)=>({id,carrier:'w',side,order:0,source:'physical',low,high,
  lengthCm,from:[low,side*5],to:[high,side*5],normal:[0,side]});
test('#1381 zero boundary has a clear interval only with two proved physical end supports',()=>{
  const wall={id:'zero',a:[0,0],b:[100,0],cm:0};
  const left=rectangle(-5,-20,5,20),right=rectangle(95,-20,105,20);
  const result=resolveWallSideDimensions(geometry([wall],[left,right],[owned(left,['left']),owned(right,['right'])]));
  assert.deepEqual(result.map(i=>[i.source,i.lengthCm,i.from,i.to]),[
    ['boundary',90,[5,0],[95,0]],['boundary',90,[5,0],[95,0]],
  ]);
  const one=resolveWallSideDimensions(geometry([wall],[left],[owned(left,['left'])]));
  assert.ok(one.every(i=>i.source==='axis'&&i.lengthCm===100));
});
test('#1381 one-to-three opposite overlap is non-transitive and excludes point tangency',()=>{
  const full=interval('full',-1,0,100),parts=[interval('left',1,0,20),interval('middle',1,30,70),interval('right',1,80,100)];
  const candidate=[full,...parts,interval('next',1,100,150),{...full,id:'other',carrier:'other'}];
  const changedMiddle=changedWallSideDimensions(candidate.map(i=>i.id==='middle'?{...i,lengthCm:41}:i),candidate,1e-8);
  assert.deepEqual(changedMiddle.map(i=>i.id),['full','middle']);
  const changedFull=changedWallSideDimensions(candidate.map(i=>i.id==='full'?{...i,lengthCm:101}:i),candidate,1e-8);
  assert.deepEqual(changedFull.map(i=>i.id),['full','left','middle','right']);
});

test('#1381 raw lengths detect sub-format changes, but translation and return to baseline do not',()=>{
  const baseline=[interval('one',-1,0,100),interval('two',1,0,100)];
  const candidate=baseline.map(i=>({...i,high:i.high+.001,lengthCm:i.lengthCm+.001}));
  assert.equal(changedWallSideDimensions(baseline,candidate,1e-8).length,2);
  assert.deepEqual(changedWallSideDimensions(baseline,baseline,1e-8),[]);
  assert.deepEqual(changedWallSideDimensions(baseline,baseline.map(i=>({...i,
    from:[i.from[0]+50,i.from[1]],to:[i.to[0]+50,i.to[1]]})),1e-8),[]);
});
