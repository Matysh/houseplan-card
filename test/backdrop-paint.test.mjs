import assert from 'node:assert/strict';
import test from 'node:test';
import {backdropPaintBox} from '../test-build/backdrop-paint.js';
import {gridVisualScale} from '../test-build/grid-scale.js';

for(const cm of [.1,1,2.54,5,10,1000])for(const angle of [0,33,-90,180]){
  test(`#1400 backdrop paint preserves world placement and local raster basis: ${cm}cm / ${angle}°`,()=>{
    const scale=gridVisualScale(cm),base={x:20,y:110,w:1000,h:800};
    const world=Object.fromEntries(Object.entries(base).map(([k,v])=>[k,v*scale]));world.angle=angle;
    const before=structuredClone(world),p=backdropPaintBox(world,cm);
    for(const key of ['x','y','w','h']){
      assert.ok(Math.abs(p[key]-base[key])<1e-9);
      assert.ok(Math.abs(p[key]*p.scale-world[key])<1e-9);
    }
    const rotation=angle?`rotate(${angle} ${world.x+world.w/2} ${world.y+world.h/2})`:'';
    const scaling=scale!==1?`scale(${scale})`:'';
    assert.equal(p.transform,[rotation,scaling].filter(Boolean).join(' ')||null);
    assert.deepEqual(world,before,'render projection never rewrites authored geometry');
  });
}
test('#1400 backdrop paint retains the legacy 5cm basis for absent/invalid calibration',()=>{
  const box={x:-25,y:14,w:80,h:120,angle:45};
  for(const cm of [undefined,null,0,-1,NaN,Infinity])assert.deepEqual(backdropPaintBox(box,cm),backdropPaintBox(box,5));
});
