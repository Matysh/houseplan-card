import test from 'node:test';
import assert from 'node:assert/strict';
import {isoMarkerBodyOutline,isoLockBodyOutline,isoMarkerGlass} from '../test-build/iso-marker-outline.js';
import {freeContactShape,contactOutline} from '../test-build/device-contact-geometry.js';
const shape=(x=0,y=0,diameter=80)=>freeContactShape({id:`${x}:${y}`,x,y,diameter,
  box:{left:-diameter*.634375,right:diameter*.634375,top:-diameter*.634375,bottom:diameter*.634375}});
const plane=(yaw,elevation)=>{const a=yaw*Math.PI/180,s=Math.sin(elevation*Math.PI/180);return[Math.cos(a),s*Math.sin(a),-Math.sin(a),s*Math.cos(a)];};
const segments=path=>{const out=[];let cursor;for(const match of path.matchAll(/([ML])([-\d.e+]+) ([-\d.e+]+)/g)){
  const p=[+match[2],+match[3]];if(match[1]==='L')out.push([cursor,p]);cursor=p;}return out;};
const project=(p,m)=>[m[0]*p[0]+m[2]*p[1],m[1]*p[0]+m[3]*p[1]];
const contains=(edges,[x,y])=>{let n=0;for(const[[ax,ay],[bx,by]]of edges)if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)n++;return n%2===1;};
test('glass lip rises above the body at every camera angle without moving its base or anchors',()=>{
  for(const yaw of[35,125,215,305])for(const elevation of[30,35,40]){
    const s=shape(),saved=JSON.stringify(s),m=plane(yaw,elevation),glass=isoMarkerGlass([s],m);
    const top=segments(glass.top),bottom=segments(glass.bottom);
    assert.ok(glass.front&&glass.back);assert.equal(top.length,bottom.length);
    top.forEach((edge,i)=>edge.forEach((p,j)=>{
      const a=project(p,m),b=project(bottom[i][j],m);
      assert.ok(Math.abs(a[0]-b[0])<1e-6);
      assert.ok(Math.abs(b[1]-a[1]-25.6)<1e-6,'0.32 D glass extends 0.08 D above the core');
    }));
    assert.equal(JSON.stringify(s),saved);
  }
});
test('glass remains open at a wall and follows a concave group instead of a bounding box',()=>{
  const s=shape();s.walls.top='wall';const m=plane(35,40),g=isoMarkerGlass([s],m);
  for(const edges of[segments(g.top),segments(g.bottom)]){
    assert.ok(edges.length>30);
    assert.ok(!edges.some(([p,q])=>Math.abs(p[1]-q[1])<1e-6 && Math.abs(p[0]-q[0])>90),'no pane across wall');
  }
  const l=isoMarkerGlass([shape(),shape(90,0),shape(0,90)],m);
  assert.ok(!contains(segments(l.top),[110,110]),'concavity remains empty');
});
test('whole body fits inside the border at every lab camera quadrant and elevation',()=>{
  for(const yaw of[25,35,45,125,215,305])for(const elevation of[30,35,40]){
    const m=plane(yaw,elevation),s=shape(),saved=JSON.stringify(s);
    const edges=segments(isoMarkerBodyOutline([s],m)).map(e=>e.map(p=>project(p,m)));
    for(let a=0;a<Math.PI*2;a+=Math.PI/24)for(const z of[-9.6,0,9.6]){
      const p=project([40*Math.cos(a),40*Math.sin(a)],m);p[1]+=z;
      assert.ok(contains(edges,p),`body escapes border at ${yaw}/${elevation}`);
    }
    const ps=edges.flat(),ys=ps.map(p=>p[1]),xs=ps.map(p=>p[0]);
    assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-(101.5*Math.sin(elevation*Math.PI/180)+19.2))<.08);
    assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-101.5)<.08,'width remains native');
    assert.equal(JSON.stringify(s),saved,'presentation does not move the native shape');
  }
});
test('L-shaped groups retain their indentation and ring groups retain the hole',()=>{
  const m=plane(35,35),l=[shape(),shape(90,0),shape(0,90)];
  const le=segments(isoMarkerBodyOutline(l,m));
  for(const s of l)assert.ok(contains(le,[s.marker.x,s.marker.y]));
  assert.equal(contains(le,[110,110]),false,'not replaced by a group bbox');
  const ring=[];for(const x of[-100,0,100])for(const y of[-100,0,100])if(x||y)ring.push(shape(x,y));
  assert.equal(contains(segments(isoMarkerBodyOutline(ring,m)),[0,0]),false,'empty centre stays empty');
});
test('wall-owned edge stays open while the body-facing edge extends below the side',()=>{
  const s=shape();s.walls.top='wall';
  const path=isoMarkerBodyOutline([s],plane(0,35)),edges=segments(path);
  const top=s.box.top,half=9.6/Math.sin(35*Math.PI/180);
  assert.ok(edges.length>30);
  for(const[p,q]of edges)assert.ok(!(Math.abs(p[1]-q[1])<1e-7&&p[1]<=top+half+1e-6),'no stroke across wall');
  assert.ok(Math.max(...edges.flat().map(p=>p[1]))>s.box.bottom+half-.01);
});
test('lock shares the same body envelope; invalid projection falls back to native contact ink',()=>{
  const m=plane(35,35);assert.equal(isoLockBodyOutline(m),isoMarkerBodyOutline([shape()],m));
  const s=shape();assert.equal(isoMarkerBodyOutline([s],[0,0,0,0]),contactOutline([s],true));
  assert.equal(isoMarkerBodyOutline([],m),'');
});
test('both wall connection ends stay on the original wall face at every yaw',()=>{
  const s=shape();s.walls.top='wall';
  for(const yaw of[25,35,45,125,215,305])for(const elevation of[30,35,40]){
    const path=isoMarkerBodyOutline([s],plane(yaw,elevation)),edges=segments(path);
    assert.equal([...path.matchAll(/M/g)].length,1,'one continuous open contour');
    assert.ok(Math.abs(edges[0][0][1]-s.box.top)<1e-6,'start reaches original wall');
    assert.ok(Math.abs(edges.at(-1)[1][1]-s.box.top)<1e-6,'end reaches original wall');
    assert.ok(Math.abs(edges[0][0][0]-edges[0][1][0])<1e-6,'start has no swept-corner spur');
    assert.ok(Math.abs(edges.at(-1)[0][0]-edges.at(-1)[1][0])<1e-6,'end has no swept-corner spur');
    for(const p of edges.flat())assert.ok(p[1]>=s.box.top-1e-6,'ink never continues behind the wall');
  }
});
