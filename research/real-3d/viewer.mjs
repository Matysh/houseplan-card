import * as THREE from 'three';
import {buildScene,openingFaces,isoCameraFor,projectPlanPoint} from './scene.mjs';

const start=performance.now(),params=new URLSearchParams(location.search);
const view=document.querySelector('#viewport'),overlay=document.querySelector('#overlays');
let kind=params.get('size')||'home',mode=params.get('engine')||'three',turn=0,zoom=1,pan=[0,0],amount=.55,dark=false;
let data,staticFaces,liveFaces,svg,renderer,scene,camera,group,liveGroup,rect,frame,devices=[],roomLabels=[],renderCount=0,builds=0,contextLost=false,occlusionDirty=true,occlusionBuilds=0;
const raycaster=new THREE.Raycaster(),temp=new THREE.Vector3();
let pending=0;
function invalidate(){if(!pending)pending=requestAnimationFrame(()=>{pending=0;render();});}
function cleanLoop(loop){return loop.filter((p,i)=>{const previous=loop[(i+loop.length-1)%loop.length];return Math.hypot(p.point[0]-previous.point[0],p.point[1]-previous.point[1],p.z-previous.z)>1e-8;});}
export function triangles(face){
 const loops=face.loops.map(cleanLoop).filter(l=>l.length>=3);if(!loops.length)return [];
 const p=loops[0],normal=[0,0,0];
 for(let i=0;i<p.length;i++){const a=[...p[i].point,p[i].z],b=[...p[(i+1)%p.length].point,p[(i+1)%p.length].z];normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);}
 const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
 const flat=loops.flat(),project=({point:[x,y],z})=>axis===2?new THREE.Vector2(x,y):axis===1?new THREE.Vector2(x,z):new THREE.Vector2(y,z);
 return THREE.ShapeUtils.triangulateShape(loops[0].map(project),loops.slice(1).map(l=>l.map(project))).flatMap(t=>t.flatMap(i=>[...flat[i].point,flat[i].z]));
}
function meshGroup(faces){
 const batches=new Map();
 for(const face of faces){const key=face.color+(face.glass?'glass':'');if(!batches.has(key))batches.set(key,{face,points:[]});batches.get(key).points.push(...triangles(face));}
 const g=new THREE.Group();
 for(const {face,points} of batches.values()){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeVertexNormals();
  const material=new THREE.MeshLambertMaterial({color:face.color,side:THREE.DoubleSide,transparent:!!face.glass,opacity:face.glass?.65:1,depthWrite:!face.glass});
  g.add(new THREE.Mesh(geometry,material));
 }
 g.scale.y=-1;return g;
}
function disposeGroup(g){if(!g)return;g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});g.parent?.remove(g);}
function initWebGL(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  view.prepend(renderer.domElement);scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-500,500,500,-500,.1,5000);camera.up.set(0,0,1);
  scene.add(new THREE.AmbientLight(0xffffff,2.0));const light=new THREE.DirectionalLight(0xffffff,1.0);light.position.set(-400,-700,1300);scene.add(light);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;setMode('svg');notify('WebGL-контекст потерян. В MVP включён SVG-контроль.');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{contextLost=false,occlusionDirty=true,occlusionBuilds=0;notify('WebGL восстановлен. Можно переключиться обратно.');});
 }catch(error){mode='svg';contextLost=true;notify('WebGL недоступен: '+error.message);}
}
function notify(text){const e=document.querySelector('#tip');e.textContent=text;e.style.display='block';clearTimeout(e.timer);e.timer=setTimeout(()=>e.style.display='none',2400);}
function load(){
 occlusionDirty=true;
 const before=performance.now();data=buildScene(kind);staticFaces=data.faces;liveFaces=openingFaces(data.bases,amount);builds++;
 if(renderer){disposeGroup(group);disposeGroup(liveGroup);group=meshGroup(staticFaces);liveGroup=meshGroup(liveFaces);scene.add(group,liveGroup);}
 overlay.replaceChildren();
 roomLabels=data.space.rooms.map(room=>{const el=document.createElement('span');el.className='room';el.textContent=room.name;overlay.append(el);return {el,x:room.poly.reduce((a,p)=>a+p[0],0)/room.poly.length*1000,y:room.poly.reduce((a,p)=>a+p[1],0)/room.poly.length*1000,z:.5};});
 devices=data.devices.map((d,i)=>{
  const el=document.createElement('button');el.className='device'+(d.on?' on':'');el.textContent=(i%3?'◉ ':'☀ ')+d.value;el.title=d.name;el.dataset.device=d.id;
  el.addEventListener('pointerdown',e=>e.stopPropagation());el.addEventListener('click',()=>{d.on=!d.on;el.classList.toggle('on',d.on);notify(d.name+': '+(d.on?'включено':'выключено')+' · только локальный MVP');invalidate();});overlay.append(el);return {...d,el};
 });
 zoom=1;pan=[0,0];buildSvg();fit();window.lab.buildMs=performance.now()-before;invalidate();
}
function project(vertex){return projectPlanPoint(vertex.point,vertex.z,isoCameraFor(turn));}
function buildSvg(){
 if(svg)svg.remove();svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-label','SVG-контроль тех же физических поверхностей');view.prepend(svg);
 const faces=[...staticFaces,...liveFaces].map(f=>({...f,ps:f.loops.map(l=>l.map(project))}));
 const yaw=(35+turn)*Math.PI/180,elev=40*Math.PI/180;
 const depth=f=>f.loops[0].reduce((sum,p)=>sum+(p.point[0]*Math.sin(yaw)+p.point[1]*Math.cos(yaw))*Math.cos(elev)+p.z*Math.sin(elev),0)/f.loops[0].length;
 faces.sort((a,b)=>depth(a)-depth(b));
 for(const f of faces){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',f.ps.map(l=>'M'+l.map(p=>p.join(',')).join('L')+'Z').join(' '));path.setAttribute('fill',f.color);path.setAttribute('fill-rule','evenodd');if(f.glass)path.setAttribute('opacity','.65');svg.append(path);}
}
function fit(){
 const ps=staticFaces.flatMap(f=>f.loops.flat().map(project)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);
 const x=Math.min(...xs)-40,y=Math.min(...ys)-40,w=Math.max(...xs)-x+40,h=Math.max(...ys)-y+40;
 frame={cx:x+w/2,cy:y+h/2,w,h};invalidate();
}
function render(){
 renderCount++;rect=view.getBoundingClientRect();
 const span=Math.max(frame.h,frame.w/(rect.width/rect.height))/zoom,w=span*rect.width/rect.height;
 const cx=frame.cx+pan[0],cy=frame.cy+pan[1];
 if(mode==='three'&&renderer&&!contextLost){
  renderer.domElement.style.display='block';svg.style.display='none';
  renderer.setSize(rect.width,rect.height,false);
  camera.left=cx-500-w/2;camera.right=cx-500+w/2;camera.top=500-cy+span/2;camera.bottom=500-cy-span/2;
  const yaw=(35+turn)*Math.PI/180,el=40*Math.PI/180;
  camera.position.set(500+1500*Math.sin(yaw)*Math.cos(el),-500-1500*Math.cos(yaw)*Math.cos(el),1500*Math.sin(el));camera.lookAt(500,-500,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  renderer.render(scene,camera);
 }else{if(renderer)renderer.domElement.style.display='none';svg.style.display='block';svg.setAttribute('viewBox',`${cx-w/2} ${cy-span/2} ${w} ${span}`);}
 const screen=(x,y,z)=>{const p=project({point:[x,y],z});return [(p[0]-cx+w/2)/w*rect.width,(p[1]-cy+span/2)/span*rect.height];};
 for(const d of [...roomLabels,...devices]){const [x,y]=screen(d.x,d.y,d.z);d.el.style.left=x+'px';d.el.style.top=y+'px';}
 // A minimal visibility witness, not the product's complete hit/occlusion policy.
 if(mode==='three'&&renderer&&occlusionDirty){occlusionBuilds++;for(const d of devices){
  temp.set(d.x,-d.y,d.z).project(camera);raycaster.setFromCamera(new THREE.Vector2(temp.x,temp.y),camera);
  const hits=raycaster.intersectObjects(group.children,false);const distance=raycaster.ray.origin.distanceTo(new THREE.Vector3(d.x,-d.y,d.z));
  d.el.classList.toggle('occluded',!!hits[0]&&hits[0].distance<distance-2);
 }occlusionDirty=false;}
 document.querySelector('#three').classList.toggle('active',mode==='three');document.querySelector('#svg').classList.toggle('active',mode==='svg');
 document.querySelector('#status').textContent=`${mode.toUpperCase()} · ${data.space.rooms.length} комнат · ${devices.length} устройств · ${renderer&&mode==='three'?renderer.info.render.calls+' draw calls':svg.children.length+' SVG paths'}`;
}
function setMode(value){if(value==='three'&&contextLost)return;mode=value;invalidate();}
function setAmount(value){occlusionDirty=true;amount=value;liveFaces=openingFaces(data.bases,amount);if(renderer){disposeGroup(liveGroup);liveGroup=meshGroup(liveFaces);scene.add(liveGroup);}buildSvg();invalidate();}
window.lab={ready:false,buildMs:0,setMode,setAmount,setTurn(value){occlusionDirty=true;turn=value;buildSvg();fit();},setSize(value){kind=value;load();},tick(i){devices.forEach((d,n)=>{if(n%8===0){d.el.textContent='◉ '+(20+(n+i)%9)+'.'+i%10+'°';}});invalidate();},pan(i){pan=[Math.sin(i/18)*70,Math.cos(i/21)*45];zoom=1+Math.sin(i/35)*.15;invalidate();},sync(){if(pending)cancelAnimationFrame(pending);pending=0;render();},stats(){return{mode,kind,builds,renderCount,occlusionBuilds,staticFaces:staticFaces.length,openingFaces:liveFaces.length,svgPaths:svg.children.length,dom:document.querySelectorAll('*').length,geometry:renderer?renderer.info.memory:null,calls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,contextLost};},project(x,y,z=0){return project({point:[x,y],z});},projectGpu(x,y,z=0){const p=new THREE.Vector3(x,-y,z).project(camera);const span=camera.top-camera.bottom,w=camera.right-camera.left;return [frame.cx+pan[0]+p.x*w/2,frame.cy+pan[1]-p.y*span/2];},get camera(){return camera;},get renderer(){return renderer;}};
initWebGL();load();
document.querySelector('#three').onclick=()=>setMode('three');document.querySelector('#svg').onclick=()=>setMode('svg');
document.querySelector('#size').value=kind;document.querySelector('#size').onchange=e=>window.lab.setSize(e.target.value);
document.querySelector('#turn').onclick=()=>{occlusionDirty=true;turn=(turn+90)%360;buildSvg();fit();};document.querySelector('#fit').onclick=()=>{pan=[0,0];zoom=1;fit();};
document.querySelector('#opening').oninput=e=>setAmount(Number(e.target.value));document.querySelector('#dark').onchange=e=>{dark=e.target.checked;view.style.background=dark?'#17232f':'#e7eff0';invalidate();};
let pointer;
view.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,pan:[...pan]};view.setPointerCapture(e.pointerId);});
view.addEventListener('pointermove',e=>{if(!pointer)return;const scale=Math.max(frame.h,frame.w/(rect.width/rect.height))/zoom/rect.height;pan=[pointer.pan[0]-(e.clientX-pointer.x)*scale,pointer.pan[1]-(e.clientY-pointer.y)*scale];invalidate();});
view.addEventListener('pointerup',()=>pointer=null);view.addEventListener('pointercancel',()=>pointer=null);
view.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.4,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));invalidate();},{passive:false});
new ResizeObserver(invalidate).observe(view);
render();window.lab.firstFrameMs=performance.now()-start;window.lab.ready=true;
