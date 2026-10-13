import test from 'node:test';
import assert from 'node:assert/strict';
import { vacuumScreenPoint, syncVacuumTips } from '../test-build/vacuum-view.js';

const I = {a:1,b:0,c:0,d:1,e:0,f:0};
test('#871 full affine inverse includes ancestor camera, scale, shear and oblique translation', () => {
  for (const m of [I, {a:2,b:0,c:0,d:3,e:35,f:-72}, {a:0,b:2,c:-3,d:0,e:-23,f:17},
    {a:1.5,b:.2,c:.7,d:2,e:80,f:55}]) {
    const [x,y]=[234.5,-93.7];
    const p=vacuumScreenPoint(m,m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f);
    assert.ok(Math.hypot(p[0]-x,p[1]-y)<1e-10);
  }
  assert.deepEqual(vacuumScreenPoint({...I,e:35},100,90),[65,90], 'negative stale-camera witness');
});
test('#871 invalid, singular, nonfinite and overflow inverses refuse without writing NaN', () => {
  for (const m of [null,{...I,a:0,d:0},{...I,a:NaN},{...I,e:Infinity},
    {...I,is2D:false},{...I,a:1e308,d:1e308},{...I,a:Number.MIN_VALUE,d:1}]) {
    assert.equal(vacuumScreenPoint(m,100,200),null);
  }
  assert.equal(vacuumScreenPoint(I,Infinity,0),null);
});

function fixture() {
  const order=[]; let matrix={...I,e:35,f:-25};
  const line=(id) => ({isConnected:true, attrs:{'data-mid':id,x1:'3',y1:'4',x2:'3',y2:'4'},
    getAttribute(k){return this.attrs[k]??null;}, setAttribute(k,v){order.push('write');this.attrs[k]=v;}});
  const lines=[line('a'),line('a'),line('b'),line('missing')];
  const puck=(id,x,y)=>({isConnected:true,getAttribute:()=>id,getBoundingClientRect(){
    order.push('read');return {left:x-5,top:y-5,width:10,height:10};}});
  const a=puck('a',100,200),b=puck('b',220,180);
  const svg={isConnected:true,getScreenCTM(){order.push('matrix');return matrix;},querySelectorAll:()=>lines};
  const root={querySelectorAll:selector=>selector.startsWith('.vacpuck')?[a,b]:[svg]};
  return {root,svg,lines,a,b,order,setMatrix:m=>matrix=m};
}
test('#871 tip pairs retain robot identity, one matrix/read pass and unchanged anchors', () => {
  const f=fixture(); assert.equal(syncVacuumTips(f.root),true);
  assert.deepEqual(f.lines.map(x=>x.attrs.x2),['65','65','185','3']);
  assert.deepEqual(f.lines.map(x=>x.attrs.y2),['225','225','205','4']);
  assert.ok(f.lines.every(x=>x.attrs.x1==='3'&&x.attrs.y1==='4'));
  assert.equal(f.order.filter(x=>x==='matrix').length,1);
  assert.equal(f.order.filter(x=>x==='read').length,2);
  const firstWrite=f.order.indexOf('write');assert.ok(!f.order.slice(firstWrite).includes('read'));
  f.order.length=0;syncVacuumTips(f.root);assert.ok(!f.order.includes('write'),'idle has no equal writes');
});
test('#871 matrix gaps safely recover and detached pairs stop the existing loop', () => {
  const f=fixture(); f.setMatrix(null);assert.equal(syncVacuumTips(f.root),true);
  assert.equal(f.lines[0].attrs.x2,'3');
  f.setMatrix({...I,e:70});syncVacuumTips(f.root);assert.equal(f.lines[0].attrs.x2,'30');
  f.a.isConnected=false;f.b.isConnected=false;assert.equal(syncVacuumTips(f.root),false);
  f.svg.isConnected=false;assert.equal(syncVacuumTips(f.root),false);
});
