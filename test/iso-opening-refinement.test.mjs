import test from 'node:test';
import assert from 'node:assert/strict';
import { clipIsoOpeningDepthQueue } from '../test-build/iso-lab-visibility.js';
import { buildIsoOpeningBasis, projectIsoOpening, projectIsoOpeningStructure, isoOpeningBounds } from '../test-build/iso-openings.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';
import { buildIsoWallDepthQueue } from '../test-build/iso-scene-geometry.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';
import { resolvedOpeningAmount, resolveOpeningVisual } from '../test-build/opening-features.js';

const cam=(yaw=35)=>({rotDeg:yaw,tiltDeg:50,xyScale:1,zScale:1,origin:[0,0],floorScaleY:Math.sin(40*Math.PI/180)});
const input=(patch={})=>({id:'door',sourceIndex:0,type:'door',x:480,y:370,angle:90,length:120,
  flipH:false,flipV:false,face:{ox:-10,oy:0,cm:20,side:1},handleSides:[false,true],...patch});

test('window handles stay on the occupied side of each hinged and tilting sash', () => {
  const vec=(a,b)=>[b.point[0]-a.point[0],b.point[1]-a.point[1],b.z-a.z];
  for(const side of ['positive','negative']) for(const hinge of ['start','end','top'])
    for(const occupied of [-1,1]) for(const yaw of [35,215]) {
      const basis=buildIsoOpeningBasis(input({type:'window',angle:28,handleSides:[occupied<0,occupied>0],
        opening_features:{version:1,side,leaves:[{id:'one',hinge}]}}));
      for(const amount of [0,.5,1]) {
        const [{surfaces}]=projectIsoOpening(basis,amount,cam(yaw),true);
        const pane=surfaces.find(s=>s.kind==='window-glass').points;
        const v=vec(pane[0],pane[3]),u=vec(pane[0],pane[1]);
        const n=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]];
        const points=surfaces.filter(s=>s.kind==='window-handle').flatMap(s=>s.points);
        assert.ok(points.length);
        for(const p of points) {
          const d=vec(pane[0],p);
          assert.equal(Math.sign(n.reduce((s,x,i)=>s+x*d[i],0)),occupied*(hinge==='end'?-1:1));
        }
      }
    }
});

test('swing door hand and swing direction independently place both fixed hinge pins and the latch', () => {
  for(const angle of [0,90,27]) for(const flipH of [false,true]) for(const flipV of [false,true])
    for(const transparent of [true,false]) {
      const rad=angle*Math.PI/180,faceSide=flipV?1:-1;
      const basis=buildIsoOpeningBasis(input({angle,flipH,flipV,face:{
        ox:-10*Math.sin(rad)*faceSide,oy:10*Math.cos(rad)*faceSide,cm:20,side:faceSide}}));
      const pivot=basis.leaves[0].hinge,[nx,ny]=basis.axis.normal;
      const end=flipH?basis.axis.end:basis.axis.start;
      assert.ok(Math.abs((pivot[0]-end[0])*basis.axis.tangent[0]+(pivot[1]-end[1])*basis.axis.tangent[1])<1e-7);
      let fixed;
      for(const amount of [0,.5,1]) {
        const [{surfaces}]=projectIsoOpening(basis,amount,cam(),true,transparent);
        const pins=surfaces.filter(s=>s.kind==='door-hinge').flatMap(s=>s.points);
        assert.ok(pins.length && new Set(pins.map(p=>p.z)).size===4);
        assert.ok(pins.every(p=>Math.hypot(p.point[0]-pivot[0],p.point[1]-pivot[1])<basis.leafThickness));
        if(fixed) assert.deepEqual(pins,fixed); else fixed=pins;
        const handles=surfaces.filter(s=>s.kind==='door-handle').flatMap(s=>s.points);
        assert.ok(handles.length && handles.every(p=>Math.hypot(p.point[0]-pivot[0],p.point[1]-pivot[1])>80));
        if(amount>0) assert.ok(handles.every(p=>
          Math.sign((p.point[0]-pivot[0])*nx+(p.point[1]-pivot[1])*ny)===(flipV?1:-1)));
      }
    }
  const slide=buildIsoOpeningBasis(input({opening_features:{version:1,mechanism:'slide'}}));
  assert.ok(projectIsoOpening(slide,1,cam(),true)[0].surfaces.every(s=>s.kind!=='door-hinge'));
});

test('roller blind covers its own pane from the top at every sash pose', () => {
  const basis=buildIsoOpeningBasis(input({type:'window',opening_features:{version:1,side:'negative',
    leaves:[{id:'left',hinge:'top'},{id:'right',hinge:'end'}]}}));
  const distance=(a,b)=>Math.hypot(a.point[0]-b.point[0],a.point[1]-b.point[1],a.z-b.z);
  for(const sash of [0,.5,1]) for(const amount of [0,.3,.5,1,null,undefined]) {
    for(const panel of projectIsoOpening(basis,sash,cam(),true,false,[amount,amount])) {
      const face=kind=>panel.surfaces.find(s=>s.kind===kind)?.points;
      const glass=projectIsoOpening(basis,sash,cam(),true)[panel.leaf].surfaces.find(s=>s.kind==='window-glass').points;
      const cloth=face('window-blind'), hem=face('window-blind-hem');
      if (amount==null || amount===1) {
        assert.equal(cloth,undefined); assert.equal(hem,undefined); continue;
      }
      assert.ok(Math.abs(distance(cloth[3],hem[0])/distance(glass[3],glass[0])-(1-amount))<1e-8);
      assert.ok(distance(cloth[3],glass[3])<basis.frameThickness);
      assert.deepEqual(hem[3],cloth[0]);
    }
  }
  const pair=projectIsoOpening(basis,0,cam(),true,false,[0,1]);
  assert.deepEqual(pair.map(p=>p.surfaces.some(s=>s.kind==='window-blind')),[true,false]);
});

test('#1451 independent moving sashes keep their full frame thickness inside their own bay and above the sill', () => {
  for (const count of [2, 3, 4]) for (const side of ['positive','negative']) {
    for (const hinges of [['end','start','end','start'], ['start','end','top','top'], ['top','top','start','end']]) {
      const leaves = hinges.slice(0,count).map((hinge,i) => ({id:String(i), hinge}));
      const basis = buildIsoOpeningBasis(input({type:'window', angle:27,
        opening_features:{version:1, side, leaves}}));
      const {start, tangent} = basis.axis, width = 120/count;
      for (const amount of [0,.01,.25,.5,.75,1]) {
        for (const positions of [leaves.map(() => amount), leaves.map((_,i) => i%2 ? 1-amount : amount)]) {
          for (const panel of projectIsoOpening(basis, positions, cam(), true)) {
            for (const surface of panel.surfaces) for (const {point,z} of surface.points) {
              const along = (point[0]-start[0])*tangent[0]+(point[1]-start[1])*tangent[1];
              assert.ok(along >= panel.leaf*width-1e-7 && along <= (panel.leaf+1)*width+1e-7,
                'sash frame crosses its jamb or enters the neighbouring sash bay');
              assert.ok(z >= basis.windowProfile.frameBottom-1e-7 && z <= basis.windowProfile.frameTop+1e-7,
                'tilt sash crosses the sill or upper frame');
            }
          }
        }
      }
    }
  }
});

test('#1451 sliding doors and gates travel along the wall in the selected direction', () => {
  for (const type of ['door','gate']) for (const direction of ['start','end']) {
    for (const angle of [0,90,27]) for (const flipV of [false,true]) {
      const basis = buildIsoOpeningBasis(input({type, angle, flipV, opening_features:{
        version:1, mechanism:'slide', slide_direction:direction}}));
      const front = amount => projectIsoOpening(basis,amount,cam(),true)[0].surfaces.find(s=>s.kind==='leaf-front').points;
      const closed = front(0);
      for (const amount of [.5,1]) {
        const delta = (direction==='end' ? 1 : -1)*120*amount;
        const moved = front(amount);
        closed.forEach((p,i) => {
          for (const axis of [0,1])
            assert.ok(Math.abs(moved[i].point[axis]-p.point[axis]-delta*basis.axis.tangent[axis]) < 1e-7);
          assert.equal(moved[i].z,p.z);
        });
      }
    }
  }
});

test('#1451 a glazed door keeps the same opening, leaf motion and frame-mounted hardware', () => {
  for (const mechanism of ['swing', 'slide']) {
    for (const flipH of [false, true]) {
      const basis = buildIsoOpeningBasis(input({flipH, opening_features:{version:1, mechanism}}));
      for (const amount of [0, .5, 1]) {
        const [solid] = projectIsoOpening(basis, amount, cam(), true);
        const [glass] = projectIsoOpening(basis, amount, cam(), true, true);
        assert.equal(glass.d, solid.d);
        assert.equal(glass.shadowD, solid.shadowD);
        assert.equal(glass.thickness, solid.thickness);
        assert.equal(glass.surfaces.filter(s => s.kind === 'door-glass').length, 1);
        assert.ok(glass.surfaces.some(s => s.kind === 'door-rail'));
        assert.ok(glass.surfaces.some(s => s.kind === 'door-stile'));
        assert.ok(glass.surfaces.some(s => s.kind === 'door-handle'));
        assert.ok(glass.surfaces.every(s => s.material !== 'matte-leaf'));
        assert.ok(solid.surfaces.every(s => s.kind !== 'door-glass'));
      }
    }
  }
  for (const type of ['window', 'gate', 'passage']) {
    const basis = buildIsoOpeningBasis(input({type}));
    assert.deepEqual(projectIsoOpening(basis, .5, cam(), true, true),
      projectIsoOpening(basis, .5, cam(), true));
  }
});
const area=d=>{const parts=d.match(/M[^Z]+Z/g)||[];return parts.reduce((sum,s)=>{const n=s.match(/-?\d+(?:\.\d+)?/g).map(Number);let a=0;for(let i=0;i<n.length;i+=2){const j=(i+2)%n.length;a+=n[i]*n[j+1]-n[j]*n[i+1];}return sum+a/2;},0);};

const contains=(d,x,y)=>{
  let inside=false;
  for(const part of d.match(/M[^Z]+Z/g)||[]) {
    const n=part.match(/-?\d+(?:\.\d+)?/g).map(Number);
    for(let i=0,j=n.length-2;i<n.length;j=i,i+=2)
      if((n[i+1]>y)!==(n[j+1]>y)&&x<(n[j]-n[i])*(y-n[i+1])/(n[j+1]-n[i+1])+n[i])inside=!inside;
  }
  return inside;
};

test('#1451 detailed swing gates open 90 degrees with fixed hinges; baseline and sliding motion are preserved',()=>{
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
  for(const angle of [0,90,27])for(const side of [-1,1])for(const flipH of [false,true]) {
    const opening=input({type:'gate',angle,flipH,face:{ox:0,oy:10*side,cm:20,side}});
    const basis=buildIsoOpeningBasis(opening),before=JSON.stringify(basis);
    for(const detailed of [false,true])for(const amount of [0,.5,1]) {
      const panels=projectIsoOpening(basis,amount,cam(),detailed);
      panels.forEach((panel,i)=>{
        const face=panel.surfaces.find(s=>s.kind==='leaf-front').points;
        const v=[face[1].point[0]-face[0].point[0],face[1].point[1]-face[0].point[1]],base=basis.leaves[i].closedVector;
        near(Math.hypot(...v),Math.hypot(...base));
        const dot=(v[0]*base[0]+v[1]*base[1])/(Math.hypot(...v)*Math.hypot(...base));
        near(Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI,(detailed?90:10)*amount);
        const edge=panel.surfaces.find(s=>s.kind==='leaf-edge'&&s.edge==='hinge').points;
        for(const axis of [0,1])near((edge[0].point[axis]+edge[1].point[axis])/2,basis.leaves[i].hinge[axis]);
      });
    }
    assert.equal(JSON.stringify(basis),before);
    const slide=buildIsoOpeningBasis({...opening,opening_features:{version:1,mechanism:'slide',slide_direction:'end'}});
    for(const amount of [0,.5,1])assert.equal(projectIsoOpening(slide,amount,cam(),true)[0].d,
      projectIsoOpening(slide,amount,cam(),false)[0].d,'slide retains its original path');
  }
});

test('#1451 detailed tilt sash rotates rigidly about its lower edge with frame, glass and thickness in one pose',()=>{
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
  const distance=(a,b)=>Math.hypot(a.point[0]-b.point[0],a.point[1]-b.point[1],a.z-b.z);
  for(const angle of [0,90,27])for(const side of ['negative','positive'])for(const height of [42,84,105,168]) {
    const opening=input({type:'window',length:32,angle,opening_features:{version:1,side,leaves:[
      {id:'top',hinge:'top',manual:'closed'}]}}),basis=buildIsoOpeningBasis(opening,height),before=JSON.stringify(opening);
    const closed=projectIsoOpening(basis,0,cam(),true)[0],bounds=isoOpeningBounds([basis],true);
    const pivot=basis.windowProfile.frameBottom,n=basis.leaves[0].tiltSash.outward;
    for(const amount of [.5,1])for(const yaw of [35,125,215,305]) {
      const panel=projectIsoOpening(basis,amount,cam(yaw),true)[0],theta=30*amount*Math.PI/180;
      panel.surfaces.forEach((surface,i)=>{
        const previous=closed.surfaces[i].points;
        surface.points.forEach((p,j)=>{
          near(distance(p,surface.points[(j+1)%surface.points.length]),distance(previous[j],previous[(j+1)%previous.length]));
          assert(p.point[0]>=bounds.x-1e-7&&p.point[0]<=bounds.x+bounds.w+1e-7);
          assert(p.point[1]>=bounds.y-1e-7&&p.point[1]<=bounds.y+bounds.h+1e-7);
        });
      });
      // Both endpoints of the lower hinge line stay fixed in every view.
      const corners = panel.d.split(' L '), shutCorners = projectIsoOpening(basis,0,cam(yaw),true)[0].d.split(' L ');
      assert.deepEqual(corners.slice(0,2),shutCorners.slice(0,2));
      assert.notDeepEqual(corners.slice(2),shutCorners.slice(2));
      const glass=panel.surfaces.find(s=>s.kind==='window-glass').points;
      const oldGlass=closed.surfaces.find(s=>s.kind==='window-glass').points;
      for (const [j,vertex] of glass.entries()) {
        const aboveSill=oldGlass[j].z-pivot;
        near(vertex.z,pivot+aboveSill*Math.cos(theta));
        near((vertex.point[0]-oldGlass[j].point[0])*n[0]+(vertex.point[1]-oldGlass[j].point[1])*n[1],aboveSill*Math.sin(theta));
      }
      assert(panel.surfaces.every(s=>!/(NaN|Infinity)/.test(s.d)));
    }
    assert.equal(JSON.stringify(opening),before);
    assert.deepEqual(projectIsoOpening(basis,0,cam(),true)[0],closed);
    const legacy0=projectIsoOpening(basis,0)[0],legacy1=projectIsoOpening(basis,1)[0];
    assert.deepEqual(legacy1.surfaces[0].points.map(p=>p.z),legacy0.surfaces[0].points.map(p=>p.z),'ordinary dev retains legacy parallel shift');
  }
});

test('#1451 degenerate slab corners do not cancel visible wall and door regions',()=>{
  const c=cam(0);
  const surface=(id,points)=>({layer:'opening',depth:0,surface:{id,type:'door',sourceIndex:0,
    kind:'leaf-front',material:'matte-leaf',points,
    d:'M '+points.map(p=>projectPlanPoint(p.point,p.z,c).join(' ')).join(' L ')+' Z'}});
  const back=surface('back',[{point:[0,20],z:0},{point:[100,20],z:0},{point:[100,20],z:84},{point:[0,20],z:84}]);
  for(const triangular of [false,true]) {
    const points=[{point:[40,50],z:0},{point:[120,50],z:0},
      {point:[120,50],z:84},...(!triangular?[{point:[40,50],z:84}]:[])];
    const normal=clipIsoOpeningDepthQueue([back,surface('clean',points)],c).find(e=>e.surface.id==='back').surface.d;
    const duplicate=clipIsoOpeningDepthQueue([back,surface('duplicate',[...points,points[0]])],c).find(e=>e.surface.id==='back').surface.d;
    for(let x=1.23;x<100;x+=3)for(let y=-50.17;y<12;y+=3)
      assert.equal(contains(duplicate,x,y),contains(normal,x,y),`coverage at ${x},${y}, triangle=${triangular}`);
  }
});

test('#1451 visibility removes only nearer portions, independent of painter order',()=>{
  const c=cam(0);
  const face=(id,y,x0,x1)=>{
    const points=[{point:[x0,y],z:0},{point:[x1,y],z:0},{point:[x1,y],z:84},{point:[x0,y],z:84}];
    return {layer:'opening',depth:y,surface:{id,type:'door',sourceIndex:0,kind:'leaf-front',material:'matte-leaf',points,
      cameraDepth:y,d:'M '+points.map(p=>projectPlanPoint(p.point,p.z,c).join(' ')).join(' L ')+' Z'}};
  };
  const back=face('back',20,0,80),front=face('front',50,40,120);
  const forward=clipIsoOpeningDepthQueue([front,back],c);
  assert.ok(Math.abs(Math.abs(area(forward.find(e=>e.surface.id==='front').surface.d))-Math.abs(area(front.surface.d)))<.02);
  assert.ok(Math.abs(area(forward.find(e=>e.surface.id==='back').surface.d))<Math.abs(area(back.surface.d)));
  const reverse=clipIsoOpeningDepthQueue([back,front],c);
  assert.deepEqual(forward.map(e=>[e.surface.id,e.surface.d]).sort(),reverse.map(e=>[e.surface.id,e.surface.d]).sort());
});

test('#1478 a disjoint foreground face with overlapping bounds leaves one uncut wall polygon', () => {
  const camera = cam(0);
  const face = (id, corners, z) => ({ layer: 'opening', depth: z, surface: {
    id, type: 'door', sourceIndex: 0, kind: 'leaf-front', material: 'matte-leaf', d: id,
    points: corners.map(([x, y]) => ({ point: [x, (y + z * Math.sin(50 * Math.PI / 180)) / camera.floorScaleY], z })),
  } });
  const wall = face('wall', [[0, 0], [100, 0], [0, 100]], 0);
  const foreground = face('foreground', [[90, 60], [130, 60], [90, 130]], 10);
  const result = clipIsoOpeningDepthQueue([wall, foreground], camera).find(entry => entry.surface.id === 'wall');
  assert.equal(result.surface.d.match(/M/g).length, 1);
  assert.equal(area(result.surface.d), 5000);
});

test('#1451 doors, gate ribs and handles stay finite at all quarter views and motion states',()=>{
  const started=performance.now();let rendered=0;
  for(const type of ['door','gate']) for(const yaw of [35,125,215,305]) for(const amount of [0,.4,1]) {
    const basis=buildIsoOpeningBasis(input({type})),before=JSON.stringify(basis),c=cam(yaw);
    const panels=projectIsoOpening(basis,amount,c,true);
    const surfaces=[...projectIsoOpeningStructure(basis,c,true),...panels.flatMap(p=>p.surfaces)].map(s=>({...s,id:type,type,sourceIndex:0}));
    assert(surfaces.some(s=>s.kind==='door-handle'));
    assert.equal(surfaces.some(s=>s.kind==='gate-rail'),type==='gate');
    const walls=buildIsoWallGeometry([[[[470,220],[490,220],[490,310],[470,310]]]],c);
    const entries=clipIsoOpeningDepthQueue(buildIsoWallDepthQueue(walls,surfaces,true),c);
    assert(entries.every(e=>!/(NaN|Infinity)/.test(e.layer==='opening'?e.surface.d:e.face.d)));
    assert.equal(JSON.stringify(basis),before);
    rendered+=entries.length;
  }
  console.log(JSON.stringify({refinementCases:24,renderedPaths:rendered,milliseconds:Math.round(performance.now()-started)}));
});

test('#1451 simple window has one glass surface per sash, no duplicate fixed rails, reveal above sill',()=>{
  const basis=buildIsoOpeningBasis(input({type:'window'}));
  const structure=projectIsoOpeningStructure(basis,cam(),true);
  assert(!structure.some(s=>['window-frame-side','window-frame-top'].includes(s.kind)));
  for(const reveal of structure.filter(s=>s.kind==='jamb-reveal'))
    assert.equal(Math.min(...reveal.points.map(p=>p.z)),basis.windowProfile.frameBottom);
  const panels=projectIsoOpening(basis,[0,1],cam(),true);
  for(const panel of panels) assert.equal(panel.surfaces.filter(s=>s.kind==='window-glass').length,1);
  const closed=projectIsoOpening(basis,0,cam(),true),open=projectIsoOpening(basis,1,cam(),true);
  assert.notEqual(closed[0].surfaces.at(-1).d,open[0].surfaces.at(-1).d);
  const thin=buildIsoOpeningBasis(input({type:'window',face:{ox:-2,oy:0,cm:4,side:1}}));
  for(const panel of projectIsoOpening(thin,0,cam(),true))for(const face of panel.surfaces)
    for(const vertex of face.points)
      assert.ok(Math.abs(vertex.point[0]-thin.axis.center[0])<=thin.face.depth*(face.kind==='window-handle' ? .28 : .16)+1e-8,
        'centred frame leaves actual reveal depth on both sides of a thin host');
});

test('#1451 only internal side hinges get a stationary post, independently of motion and camera', () => {
  for (const [hinges, expected] of [
    [['start'],0], [['start','end'],0], [['top','top'],0], [['end','start'],1],
    [['start','start','top','end'],1], [['end','end','end','end'],3],
  ]) for (const side of ['negative','positive']) {
    const basis = buildIsoOpeningBasis(input({type:'window', opening_features:{
      version:1, side, leaves:hinges.map((hinge,i)=>({id:String(i),hinge})),
    }}));
    const structure = yaw => projectIsoOpeningStructure(basis,cam(yaw),true)
      .filter(s=>s.kind==='window-mullion').map(s=>s.points);
    const stored = structure(35);
    assert.equal(stored.length,5*expected);
    for (const amount of [0,.5,1]) {
      const panels = projectIsoOpening(basis,amount,cam(),true);
      assert(panels.every(p=>p.surfaces.some(s=>s.kind==='window-handle')));
      assert(panels.every(p=>p.surfaces.every(s=>s.kind!=='window-mullion')));
      assert.deepEqual(structure(125).flat(2).map(p=>JSON.stringify(p)).sort(),
        stored.flat(2).map(p=>JSON.stringify(p)).sort());
    }
    assert(!projectIsoOpeningStructure(basis,cam()).some(s=>s.kind==='window-mullion'));
  }
  const small = buildIsoOpeningBasis(input({type:'window',length:20}));
  assert(projectIsoOpening(small,1,cam(),true).every(p=>
    p.surfaces.some(s=>s.kind==='window-glass') && !p.surfaces.some(s=>s.kind==='window-handle')));
});

test('#1451 coplanar reveal replaces only the upper cut face, never wall below sill',()=>{
  const c=cam(),walls=buildIsoWallGeometry([[[[0,0],[10,0],[10,100],[0,100]]]],c);
  const points=[{point:[10,30],z:32},{point:[10,70],z:32},{point:[10,70],z:84},{point:[10,30],z:84}];
  const reveal={id:'window',type:'window',sourceIndex:0,kind:'jamb-reveal',material:'reveal',points,
    d:'M '+points.map(p=>projectPlanPoint(p.point,p.z,c).join(' ')).join(' L ')+' Z',depth:100};
  const output=clipIsoOpeningDepthQueue(buildIsoWallDepthQueue(walls,[reveal],true),c);
  const wall=output.find(e=>e.layer==='wall-side'&&e.face.edge===1);
  assert.ok(wall);
  const low=projectPlanPoint([10,50],16,c),high=projectPlanPoint([10,50],60,c);
  assert(contains(wall.face.d,...low),'wall below sill remains');
  assert(!contains(wall.face.d,...high),'cut wall does not overpaint upper reveal');
  assert(contains(output.find(e=>e.layer==='opening').surface.d,...high),'upper reveal remains visible');
});

test('#1451 neighbouring panes tint only the rear sill, independently of painter slots and camera turn',()=>{
  for(const yaw of [35,125,215,305]) {
    const c=cam(yaw),surface=(id,kind,material,points)=>({layer:'opening',depth:0,surface:{id,type:'window',sourceIndex:0,
      kind,material,points,d:'M '+points.map(p=>projectPlanPoint(p.point,p.z,c).join(' ')).join(' L ')+' Z'}});
    const sill=surface('sill','window-sill','light-sill',[[0,-5],[100,-5],[100,5],[0,5]].map(point=>({point,z:20})));
    const panes=[0,50].map(x=>surface('glass'+x,'window-glass','glass-side',
      [{point:[x,0],z:20},{point:[x+50,0],z:20},{point:[x+50,0],z:80},{point:[x,0],z:80}]));
    for(const input of [[sill,...panes],[panes[0],sill,panes[1]],[...panes,sill]]) {
      const output=clipIsoOpeningDepthQueue(input,c),side=Math.sign(Math.cos(yaw*Math.PI/180));
      for(const x of [25,75])for(const near of [false,true]) {
        const p=projectPlanPoint([x,(near?1:-1)*side*3],20,c);
        const top=output.filter(e=>contains(e.surface.d,...p)).at(-1);
        assert.equal(top?.surface.material,near?'light-sill':'glass-side',`yaw=${yaw}, x=${x}, near=${near}`);
      }
    }
  }
});

test('#1451 entity-driven window, door and gate complete close-open-close cycles without changing saved geometry',()=>{
  let position=0;
  const read=()=>({state:position===null?'unavailable':position===0?'closed':'open',attributes:{current_position:position}});
  let cases=0;
  for(const type of ['window','door','gate'])for(const angle of [0,90,27])for(const mirror of [false,true]) {
    for(const mechanism of type==='window'?['swing']:['swing','slide']) {
      const opening={...input({type,angle,flipH:mirror,flipV:mirror}),contact:'cover.test',
        opening_features:type==='window'?{version:1,side:mirror?'positive':'negative',leaves:[
          {id:'a',hinge:'start',contact:'cover.test'},{id:'b',hinge:'end',contact:'cover.test'},
          {id:'c',hinge:'top',contact:'cover.test'},{id:'fixed',hinge:'end',manual:'closed'}]}:
          {version:1,mechanism,slide_direction:mirror?'start':'end',manual:'closed'}};
      const stored=JSON.stringify(opening),basis=buildIsoOpeningBasis(opening),poses=[];
      for(const state of [0,50,100,0,null]) {
        position=state;
        const amount=resolvedOpeningAmount(opening,read),visual=resolveOpeningVisual(opening,read,amount);
        const panels=projectIsoOpening(basis,visual.leaves?.map(l=>l.amount)||amount,cam(),true);
        poses.push(panels.map(p=>p.surfaces.map(s=>s.d)));
        assert(panels.every(p=>p.surfaces.every(s=>!/(NaN|Infinity)/.test(s.d))));
        if(type==='window')assert.deepEqual(poses.at(-1).at(-1),poses[0].at(-1),'manual closed sash stays independent');
        assert.equal(JSON.stringify(opening),stored);
      }
      assert.deepEqual(poses[0],poses[3],'closed pose returns exactly');
      assert.notDeepEqual(poses[0],poses[1]);assert.notDeepEqual(poses[1],poses[2]);
      assert.deepEqual(poses[4],type==='window'?poses[0]:poses[2],'existing unknown-state fallback is preserved');
      cases++;
    }
  }
  console.log(JSON.stringify({openingMotionCases:cases,statesPerCase:5}));
});
