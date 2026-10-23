// #1003: real pointer capture into two finite masonry faces, not resolver calls.
import {launch,checkAll,finish} from './serve.mjs';
const {page,browser}=await launch({width:1400,height:1000});
const card=page.locator('houseplan-card'),results=[];
const settle=async()=>{
  await page.waitForFunction(()=>!window.__card._devicePositionBusy&&!window.__card._modeTransitionBusy
    &&!window.__card._modeTransitionPreparing);
  await page.evaluate(async()=>{await window.__card.updateComplete;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
};
for(const angle of [0,30,-30])for(const [cm,diameter] of [[36,40],[72,80]])for(const direction of [[1,0],[0,1],[1,1]]){
  const item={angle,cm,diameter,direction};
  await page.evaluate(async item=>{
    const c=window.__card,a=item.angle*Math.PI/180,ex=[Math.cos(a),Math.sin(a)],ey=[-Math.sin(a),Math.cos(a)];
    const point=(x,y)=>[.35+x*ex[0]+y*ey[0],.35+x*ex[1]+y*ey[1]];
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.settings={...cfg.settings,volumetric_view:false};
      cfg.spaces=[{id:c._space,title:'Synthetic corner',cell_cm:5,view_box:[0,0,1,1],rooms:[],walls:[],wall_segments:[],openings:[],
        partitions:[{id:'vertical',a:point(0,0),b:point(0,.5),cm:item.cm},
          {id:'horizontal',a:point(0,0),b:point(.5,0),cm:item.cm}],settings:{show_names:false,show_borders:true}}];
      cfg.markers=[{id:'corner-target',binding:'virtual',space:c._space,icon:'mdi:lightbulb',
        display:'static_icon',size:item.diameter/45,name:'Synthetic virtual light'}];return cfg;
    });
    await window.__hpTest.setLayout({'corner-target':{s:c._space,x:point(.2,.2)[0],y:point(.2,.2)[1]}});
    await window.__hpTest.setMode('devices');
  },item);await settle();
  const target=await page.evaluate(item=>{
    const c=window.__card,scene=c._deviceContacts.scene,m=scene.shapes.get('corner-target').marker;
    const a=item.angle*Math.PI/180,ex=[Math.cos(a),Math.sin(a)],ey=[-Math.sin(a),Math.cos(a)];
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
    const face=n=>scene.walls.find(w=>dot(n,w.normal)>.999&&Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])>250);
    const left=face(ex),top=face(ey);
    if(!left||!top)throw new Error('fixture lacks both finite inner faces');
    // Circle support + the specified wall padding, independent of snap output.
    const radius=(m.box.right-m.box.left)/2+m.diameter*.009375;
    const x=dot(ex,left.a)+radius,y=dot(ey,top.a)+radius;
    const expected={x:x*ex[0]+y*ey[0],y:x*ex[1]+y*ey[1]};
    const r=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb()),scale=r.width/v.w;
    const project=p=>({x:r.left+(p.x-v.x)*scale,y:r.top+(p.y-v.y)*r.height/v.h});
    return {from:project(m),to:project(expected),expected,
      dx:ex[0]*item.direction[0]+ey[0]*item.direction[1],dy:ex[1]*item.direction[0]+ey[1]*item.direction[1]};
  },item);
  await page.mouse.move(target.from.x,target.from.y);await page.mouse.down();
  await page.mouse.move(target.to.x+target.dx*3,target.to.y+target.dy*3,{steps:12});await settle();
  await page.mouse.up();await settle();
  const actual=await page.evaluate(()=>{
    const c=window.__card,s=c._deviceContacts.scene.shapes.get('corner-target');
    const path=c.renderRoot.querySelector('.device-contact-contour');
    return {position:c._layout['corner-target'],walls:Object.values(s.walls),
      dash:path?.getAttribute('stroke-dasharray'),stroke:path?.getAttribute('d'),
      history:c._devicePositionHistory.size};
  });
  const result={...item,...actual,exact:Math.hypot(actual.position.x*1000-target.expected.x,
    actual.position.y*1000-target.expected.y)<.002};results.push(result);
  checkAll({['corner '+JSON.stringify(item)]:result.exact&&actual.walls.length===2
    &&actual.dash==='4 3'&&!!actual.stroke&&!actual.stroke.includes('Z')});
}
await finish(browser,results);
