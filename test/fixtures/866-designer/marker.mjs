import {face,contacts,outline,joinedSide} from './geometry.mjs';
const NS='http://www.w3.org/2000/svg';
export function markerSVG(d,all,group,walls=[]){
 const b=face(d),s=d.size,p=s*11.5/103,c=contacts(d,walls,all),cx=-b.left,cy=-b.top,core=s-2*p;
 const shell=outline(b.w,b.h,Math.min(b.w,b.h)/2,c);
 // Split the overlapping shell padding halfway. One painted core has one click owner.
 let left=0,top=0,right=b.w,bottom=b.h;
 for(const n of all){if(n.id===d.id)continue;const side=joinedSide(d,n),a=face(n);if(side==='right')right=Math.min(right,b.w-Math.max(0,b.right-a.x)/2);if(side==='left')left=Math.max(left,Math.max(0,a.right-b.x)/2);if(side==='top')top=Math.max(top,Math.max(0,a.bottom-b.y)/2);if(side==='bottom')bottom=Math.min(bottom,b.h-Math.max(0,b.bottom-a.y)/2);}
 let html=`<svg xmlns="${NS}" width="${b.w}" height="${b.h}" viewBox="0 0 ${b.w} ${b.h}" aria-hidden="true"><defs><clipPath id="hit-${d.id}"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs><path class="hit-face" clip-path="url(#hit-${d.id})" d="${shell.fill}"/><g class="visual">`;
 if(d.state==='alarm')html+=`<circle class="pulse" cx="${cx}" cy="${cy}" r="${s/2}"/>`;
 html+=`<circle class="core core-main" cx="${cx}" cy="${cy}" r="${core/2}"/><svg x="${cx-core/2}" y="${cy-core/2}" width="${core}" height="${core}" viewBox="${d.glyph.viewBox}"><path class="glyph" d="${d.glyph.path}"/></svg>`;
 if(d.badge!=='none'){
  let bw=s*1.05,bh=s*.62,bx,by;if(d.badge==='left'){bx=p;by=cy-bh/2;}if(d.badge==='right'){bx=cx+s/2;by=cy-bh/2;}if(d.badge==='top'){bw=s*.94;bx=(b.w-bw)/2;by=p;}if(d.badge==='bottom'){bw=s*.94;bx=(b.w-bw)/2;by=cy+s/2;}
  html+=`<rect class="core" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh/2}"/><text class="value" x="${bx+bw/2}" y="${by+bh/2}" dominant-baseline="central" text-anchor="middle" font-size="${s*.255}">${d.value}</text>`;
 }
 if(group.length>1)html+=`<circle class="member-selection" cx="${cx}" cy="${cy}" r="${core/2+2}"/>`;
 if(d.battery){const bs=s*56/96;html+=`<image class="satellite" x="${b.w+s*7/96}" y="${(b.h-bs)/2}" width="${bs}" height="${bs}" href="./assets/battery-normal.svg"/>`;}
 if(d.lqi)html+=`<text class="lqi" x="${b.w/2}" y="${b.h+14}" text-anchor="middle">128</text>`;
 return html+'</g></svg>';
}
