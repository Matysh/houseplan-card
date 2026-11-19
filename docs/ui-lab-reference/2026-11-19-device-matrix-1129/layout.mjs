// Laboratory geometry only. Native marker styles and content are not changed.
export function measureMatrix(card,matrix){
 const root=card.shadowRoot,svg=root.querySelector('svg.plan-svg');
 const inverse=svg.getScreenCTM().inverse();
 const selectors='.device-shell-frame,.device-core,.value-badge,.device-contact-contour,.device-battery,.device-maintenance,.device-attention,.lqi,.newdot,.activity-dot';
 const worldRect=rect=>{
  const points=[[rect.left,rect.top],[rect.right,rect.top],[rect.right,rect.bottom],[rect.left,rect.bottom]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(inverse));
  return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
 };
 return matrix.cells.map(cell=>{
  const rects=[];
  for(const id of [cell.id,cell.neighbor].filter(Boolean)){
   const el=root.querySelector('.dev[data-id="'+id+'"]');if(!el)continue;
   for(const node of el.querySelectorAll(selectors)){
    const style=getComputedStyle(node),rect=node.getBoundingClientRect();
    if(style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0)rects.push(worldRect(rect));
   }
   const pulse=el.querySelector('.device-pulse');
   if(pulse&&getComputedStyle(pulse).display!=='none'){
    const device=card._renderDevices.find(d=>d.id===id),presentation=card._devicePresentation(device),wave=pulse.querySelector('i');
    const rect=wave.getBoundingClientRect(),transform=new DOMMatrixReadOnly(getComputedStyle(wave).transform);
    // The actual ring border box includes its fixed screen-pixel stroke at far zoom.
    const diameter=presentation.pulse.diameterScale,halfWidth=rect.width/Math.abs(transform.a||1)*diameter/2,halfHeight=rect.height/Math.abs(transform.d||1)*diameter/2;
    const cx=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
    rects.push(worldRect({left:cx-halfWidth,right:cx+halfWidth,top:cy-halfHeight,bottom:cy+halfHeight}));
   }
  }
  const left=matrix.grid.left+matrix.columns.findIndex(c=>c.id===cell.column)*matrix.grid.col,top=matrix.grid.top+(Number(cell.row)-1)*matrix.grid.row;
  const limits={left:left+16,right:left+matrix.grid.col-16,top:top+52,bottom:top+matrix.grid.row-38};
  const bounds=rects.length?{left:Math.min(...rects.map(r=>r.left)),right:Math.max(...rects.map(r=>r.right)),top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))}:null;
  const overflow=bounds?Math.max(0,limits.left-bounds.left,bounds.right-limits.right,limits.top-bounds.top,bounds.bottom-limits.bottom):0;
  return {code:cell.code,bounds,limits,overflow};
 });
}

// One-time calibration command; normal playback uses the stored fixture positions.
export async function centerMatrix(card,matrix){
 const measured=measureMatrix(card,matrix),layout={...card._layout};
 for(let i=0;i<matrix.cells.length;i++){
  const cell=matrix.cells[i],{bounds,limits}=measured[i];if(!bounds)continue;
  const dx=(limits.left+limits.right-bounds.left-bounds.right)/2,dy=(limits.top+limits.bottom-bounds.top-bounds.bottom)/2;
  for(const id of [cell.id,cell.neighbor].filter(Boolean))layout[id]={...layout[id],x:layout[id].x+dx/1000,y:layout[id].y+dy/1000};
 }
 card._layout=layout;card._deviceContacts.clear();card.requestUpdate();await card.updateComplete;
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 return measureMatrix(card,matrix);
}
