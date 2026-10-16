export const WIDTH=1408, HEIGHT=1744;
// Screen pixels: walls need a deliberate close approach at every zoom level.
const WALL_SNAP_DISTANCE=6, WALL_RELEASE_DISTANCE=9;
export function face(d){
  const s=d.size; let left=-s/2,top=-s/2,w=s,h=s;
  if(d.badge==='right')w=s*2.15;
  if(d.badge==='left'){w=s*2.15;left=-s*1.65;}
  if(d.badge==='top'||d.badge==='bottom'){w=s*1.16;left=-w/2;h=s*1.8;if(d.badge==='top')top=-s*1.3;}
  return {x:d.x+left,y:d.y+top,w,h,left,top,right:d.x+left+w,bottom:d.y+top+h};
}
export function overlaps(a,b,epsilon=.35){return a.x<b.right-epsilon&&a.right>b.x+epsilon&&a.y<b.bottom-epsilon&&a.bottom>b.y+epsilon;}
export function valid(d,walls,devices){
 const b=face(d);
 if(b.x<0||b.y<0||b.right>WIDTH||b.bottom>HEIGHT||walls.some(w=>overlaps(b,w)))return false;
 let connected;
 return !devices.some(n=>{
  if(n.id===d.id||!overlaps(b,face(n))||joinedSide(d,n))return false;
  const a=face(n),depth=joinDepth(d,n)+.6;
  // In an L or grid, diagonal neighbours share only the empty shell padding.
  // Allow that corner only when side-connected through the same group.
  const corner=Math.min(b.right,a.right)-Math.max(b.x,a.x)<=depth&&Math.min(b.bottom,a.bottom)-Math.max(b.y,a.y)<=depth;
  if(!corner)return true;
  connected ||= new Set(clusters([d,...devices.filter(v=>v.id!==d.id)]).find(g=>g.some(v=>v.id===d.id)).map(v=>v.id));
  return !connected.has(n.id);
 });
}
const near=(a,b)=>Math.abs(a-b)<.6;
export function contacts(d,walls,devices){
 const b=face(d),out={};
 for(const w of walls){
  if(b.x>=w.x-.6&&b.right<=w.right+.6){if(near(b.y,w.bottom))out.top='wall';if(near(b.bottom,w.y))out.bottom='wall';}
  if(b.y>=w.y-.6&&b.bottom<=w.bottom+.6){if(near(b.x,w.right))out.left='wall';if(near(b.right,w.x))out.right='wall';}
 }
 for(const n of devices){if(n.id===d.id)continue;const side=joinedSide(d,n);if(side)out[side]='device';}
 return out;
}
export function snap(raw,walls,devices,scale=1,previous=null){
 const b=face(raw),candidates=[];let targetId=null;
 const add=(x,y,id,line,kind)=>{const dist=Math.hypot(x-raw.x,y-raw.y)*scale,limit=kind==='wall'?(id===previous?WALL_RELEASE_DISTANCE:WALL_SNAP_DISTANCE):(id===previous?22:14);if(dist>limit)return;const d={...raw,x,y};if(valid(d,walls,devices))candidates.push({d,id,line,kind,dist,targetId});};
 for(const w of walls){
  if(b.x>=w.x&&b.right<=w.right){add(raw.x,w.y-b.h-b.top,w.id+'-top',[b.x,w.y,b.right,w.y],'wall');add(raw.x,w.bottom-b.top,w.id+'-bottom',[b.x,w.bottom,b.right,w.bottom],'wall');}
  if(b.y>=w.y&&b.bottom<=w.bottom){add(w.x-b.w-b.left,raw.y,w.id+'-left',[w.x,b.y,w.x,b.bottom],'wall');add(w.right-b.left,raw.y,w.id+'-right',[w.right,b.y,w.right,b.bottom],'wall');}
 }
 for(const n of devices){if(n.id===raw.id)continue;targetId=n.id;const a=face(n),depth=joinDepth(raw,n);
  const ys=[a.y-b.top,a.y+(a.h-b.h)/2-b.top,a.bottom-b.h-b.top];
  const xs=[a.x-b.left,a.x+(a.w-b.w)/2-b.left,a.right-b.w-b.left];
  ys.forEach((y,i)=>{add(a.right-depth-b.left,y,n.id+'-right-'+i,[a.right-depth/2,y+b.top,a.right-depth/2,y+b.top+b.h],'device');add(a.x+depth-b.w-b.left,y,n.id+'-left-'+i,[a.x+depth/2,y+b.top,a.x+depth/2,y+b.top+b.h],'device');});
  xs.forEach((x,i)=>{add(x,a.bottom-depth-b.top,n.id+'-bottom-'+i,[x+b.left,a.bottom-depth/2,x+b.left+b.w,a.bottom-depth/2],'device');add(x,a.y+depth-b.h-b.top,n.id+'-top-'+i,[x+b.left,a.y+depth/2,x+b.left+b.w,a.y+depth/2],'device');});
 }
 candidates.sort((a,b)=>Math.abs(a.dist-b.dist)>.01?a.dist-b.dist:(a.id===previous?-1:b.id===previous?1:a.id.localeCompare(b.id)));
 return candidates[0]||null;
}
// One geometry supplies the painted shell, its hit path and editor outline.
export function outline(w,h,r,c={}){
 const tl=c.top||c.left?0:r,tr=c.top||c.right?0:r,br=c.bottom||c.right?0:r,bl=c.bottom||c.left?0:r;
 const arc=(r,x,y)=>r?`A${r} ${r} 0 0 1 ${x} ${y}`:`L${x} ${y}`;
 const fill=`M${tl} 0 H${w-tr} ${arc(tr,w,tr)} V${h-br} ${arc(br,w-br,h)} H${bl} ${arc(bl,0,h-bl)} V${tl} ${arc(tl,tl,0)} Z`;
 return {fill,stroke:fill};
}
export const joinDepth=(a,b)=>Math.min(a.size,b.size)*13/103;
export function joinedSide(a,b){
 const x=face(a),y=face(b),depth=joinDepth(a,b),close=g=>g>=-.6&&g<=depth+.6;
 const ay=near(x.y,y.y)||near(x.bottom,y.bottom)||near(x.y+x.h/2,y.y+y.h/2);
 const ax=near(x.x,y.x)||near(x.right,y.right)||near(x.x+x.w/2,y.x+y.w/2);
 if(ay&&Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y)>.6){if(x.x<y.x&&close(x.right-y.x))return 'right';if(x.x>y.x&&close(y.right-x.x))return 'left';}
 if(ax&&Math.min(x.right,y.right)-Math.max(x.x,y.x)>.6){if(x.y<y.y&&close(x.bottom-y.y))return 'bottom';if(x.y>y.y&&close(y.bottom-x.y))return 'top';}
 return null;
}
export function clusters(devices){
 const remaining=new Set(devices),result=[];
 while(remaining.size){const first=remaining.values().next().value,group=[first];remaining.delete(first);
  for(let i=0;i<group.length;i++)for(const other of [...remaining])if(joinedSide(group[i],other)){group.push(other);remaining.delete(other);}
  result.push(group);
 }
 return result;
}
export function groupBounds(group){const rects=group.map(face),x=Math.min(...rects.map(b=>b.x)),y=Math.min(...rects.map(b=>b.y)),right=Math.max(...rects.map(b=>b.right)),bottom=Math.max(...rects.map(b=>b.bottom));return{x,y,right,bottom,w:right-x,h:bottom-y};}
export function validGroup(group,walls,others){const ids=new Set(group.map(d=>d.id)),all=[...others.filter(d=>!ids.has(d.id)),...group];return group.every(d=>valid(d,walls,all));}
export function snapGroup(group,walls,others,scale=1,previous=null){
 const b=groupBounds(group),candidates=[],ids=new Set(group.map(d=>d.id)),neighbours=others.filter(d=>!ids.has(d.id));
 const add=(dx,dy,id,line)=>{const dist=Math.hypot(dx,dy)*scale;if(dist>(id===previous?WALL_RELEASE_DISTANCE:WALL_SNAP_DISTANCE))return;const moved=group.map(d=>({...d,x:d.x+dx,y:d.y+dy}));if(validGroup(moved,walls,others))candidates.push({group:moved,id,line,kind:'wall',dist});};
 for(const w of walls){
  if(b.x>=w.x&&b.right<=w.right){add(0,w.y-b.bottom,w.id+'-top',[b.x,w.y,b.right,w.y]);add(0,w.bottom-b.y,w.id+'-bottom',[b.x,w.bottom,b.right,w.bottom]);}
  if(b.y>=w.y&&b.bottom<=w.bottom){add(w.x-b.right,0,w.id+'-left',[w.x,b.y,w.x,b.bottom]);add(w.right-b.x,0,w.id+'-right',[w.right,b.y,w.right,b.bottom]);}
 }
 // Each member can anchor the translated layout to a neighbour. Validate the entire layout.
 for(const member of group){
  const candidate=snap(member,[],neighbours,scale,previous);
  if(!candidate)continue;
  const dx=candidate.d.x-member.x,dy=candidate.d.y-member.y;
  const moved=group.map(d=>({...d,x:d.x+dx,y:d.y+dy}));
  if(validGroup(moved,walls,others))candidates.push({...candidate,group:moved});
 }
 candidates.sort((a,b)=>Math.abs(a.dist-b.dist)>.01?a.dist-b.dist:(a.id===previous?-1:b.id===previous?1:a.id.localeCompare(b.id)));
 return candidates[0]||null;
}
export function groupOutline(group,walls=[]){
 const box=groupBounds(group),rects=group.map(face),radius=Math.min(...group.map(d=>d.size))/2,round=n=>Math.round(n*1000)/1000;
 const xs=[...new Set(rects.flatMap(b=>[round(b.x-box.x),round(b.right-box.x)]))].sort((a,b)=>a-b);
 const ys=[...new Set(rects.flatMap(b=>[round(b.y-box.y),round(b.bottom-box.y)]))].sort((a,b)=>a-b);
 const occupied=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<ys.length-1&&rects.some(b=>box.x+(xs[i]+xs[i+1])/2>b.x-.01&&box.x+(xs[i]+xs[i+1])/2<b.right+.01&&box.y+(ys[j]+ys[j+1])/2>b.y-.01&&box.y+(ys[j]+ys[j+1])/2<b.bottom+.01);
 let complete=true;const edges=[];
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  if(!occupied(i,j)){complete=false;continue;}const x=xs[i],y=ys[j],r=xs[i+1],b=ys[j+1];
  if(!occupied(i,j-1))edges.push([[x,y],[r,y]]);if(!occupied(i+1,j))edges.push([[r,y],[r,b]]);if(!occupied(i,j+1))edges.push([[r,b],[x,b]]);if(!occupied(i-1,j))edges.push([[x,b],[x,y]]);
 }
 const c={};
 for(const w of walls){if(box.x>=w.x-.6&&box.right<=w.right+.6){if(near(box.y,w.bottom))c.top='wall';if(near(box.bottom,w.y))c.bottom='wall';}if(box.y>=w.y-.6&&box.bottom<=w.bottom+.6){if(near(box.x,w.right))c.left='wall';if(near(box.right,w.x))c.right='wall';}}
 // Multi-row blocks retain the corner radius of one icon; a half-block radius cuts through corner cores.
 if(complete)return{box,path:outline(box.w,box.h,Math.min(radius,box.w/2,box.h/2),c).fill};
 // Trace the rectangle union; an L-shaped group does not outline empty floor space.
 const key=p=>p.join(','),paths=[];
 while(edges.length){const edge=edges.shift(),points=[edge[0]];let end=edge[1];
  while(key(end)!==key(points[0])){points.push(end);const i=edges.findIndex(e=>key(e[0])===key(end));if(i<0)break;end=edges.splice(i,1)[0][1];}
  let changed=true;while(changed&&points.length>3){changed=false;for(let i=0;i<points.length;i++){const a=points[(i+points.length-1)%points.length],b=points[i],d=points[(i+1)%points.length];if((a[0]===b[0]&&b[0]===d[0])||(a[1]===b[1]&&b[1]===d[1])){points.splice(i,1);changed=true;break;}}}
  const corners=points.map((p,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],u=[p[0]-prev[0],p[1]-prev[1]],v=[next[0]-p[0],next[1]-p[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);
   const wall=(c.left&&near(p[0],0))||(c.right&&near(p[0],box.w))||(c.top&&near(p[1],0))||(c.bottom&&near(p[1],box.h));
   const r=u[0]*v[1]-u[1]*v[0]>0&&!wall?Math.min(radius,lu/2,lv/2):0;return{p,entry:[p[0]-u[0]*r/lu,p[1]-u[1]*r/lu],exit:[p[0]+v[0]*r/lv,p[1]+v[1]*r/lv],r};});
  paths.push(corners.map((p,i)=>`${i?'L':'M'}${p.entry.join(' ')} ${p.r?`A${p.r} ${p.r} 0 0 1 ${p.exit.join(' ')}`:`L${p.p.join(' ')}`}`).join(' ')+' Z');
 }
 return{box,path:paths.join(' ')};
}
