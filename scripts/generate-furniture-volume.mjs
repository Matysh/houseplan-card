import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMainModule} from './spawn-portable.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=message=>{throw new Error('Furniture volume: '+message);};
const identifier=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]*$/.test(value)&&!['constructor','prototype'].includes(value);
function attributes(text,allowed){
  const result=Object.create(null);
  const remainder=(' '+text).replace(/\s+([\w-]+)="([^"<>]*)"/g,(_,key,value)=>{
    if(!allowed.includes(key)||Object.hasOwn(result,key)||value.includes('&'))fail('unsupported or duplicate attribute '+key);
    result[key]=value;return '';
  });
  if(remainder.trim())fail('malformed attributes');
  return result;
}
const number=(value,name)=>{if(!/^-?\d+(?:\.\d+)?$/.test(value||'')||!Number.isFinite(Number(value)))fail('invalid '+name);return Number(value);};
const norm=(v,size)=>Number((v/size).toFixed(12));
/** Inert, versioned authoring format. Unknown primitives fail instead of silently changing shape. */
export function parseVolumeSvg(source,symbol){
  if(typeof source!=='string'||source.length>150000)fail('source size');
  const match=source.trim().match(/^<svg\s+([^<>]*)>([\s\S]*)<\/svg>$/);
  if(!match)fail('one svg root required');
  const root=attributes(match[1],['xmlns','viewBox','data-hp-volume-schema','data-hp-model','data-hp-back']);
  const version=root['data-hp-volume-schema'];
  if(root.xmlns!=='http://www.w3.org/2000/svg'||!['1','2'].includes(version)||root['data-hp-model']!==symbol.id||root['data-hp-back']!=='top')fail('model/schema/back mismatch');
  if(root.viewBox!==`0 0 ${symbol.width_cm} ${symbol.depth_cm}`)fail('viewBox must match catalog');
  const parts=[],ids=new Set();
  const remainder=match[2].replace(/<(rect|ellipse|polygon)\s+([^<>]*?)\/>/g,(_,tag,text)=>{
    if(version==='1'&&tag!=='rect')fail('schema 1 supports rect only');
    const shapeAttrs={rect:['x','y','width','height','rx','data-hp-radius-ratio'],ellipse:['cx','cy','rx','ry'],polygon:['points','data-hp-hole-points']}[tag];
    const a=attributes(text,['data-hp-part','data-hp-z-min-cm','data-hp-z-max-cm',...shapeAttrs,...(version==='2'?['data-hp-plane','data-hp-inset-cm','data-hp-base-scale','data-hp-top-scale','data-hp-top-offset']:[])]);
    const name=a['data-hp-part'];
    if(!identifier(name)||ids.has(name))fail('invalid/duplicate part id');ids.add(name);
    const w=symbol.width_cm,h=symbol.depth_cm;
    let x,y,width,height,points;
    if(tag==='rect'){x=number(a.x,'x');y=number(a.y,'y');width=number(a.width,'width');height=number(a.height,'height');}
    if(tag==='ellipse'){
      const cx=number(a.cx,'cx'),cy=number(a.cy,'cy'),rx=number(a.rx,'rx'),ry=number(a.ry,'ry');
      x=cx-rx;y=cy-ry;width=2*rx;height=2*ry;
    }
    if(tag==='polygon'){
      points=(a.points||'').trim().split(/\s+/).map(pair=>{const p=pair.split(',');if(p.length!==2)fail('polygon point');return p.map(v=>number(v,'point'));});
      if(points.length<3||points.length>48)fail('polygon vertex count');
      validatePolygon(points);
      x=Math.min(...points.map(p=>p[0]));y=Math.min(...points.map(p=>p[1]));
      width=Math.max(...points.map(p=>p[0]))-x;height=Math.max(...points.map(p=>p[1]))-y;
    }
    const p={name,x:norm(x,w),y:norm(y,h),w:norm(width,w),h:norm(height,h),
      radius:tag==='rect'?number(a['data-hp-radius-ratio'],'radius'):0,bottom:number(a['data-hp-z-min-cm'],'bottom'),top:number(a['data-hp-z-max-cm'],'top')};
    if(p.x<0||p.y<0||p.w<=0||p.h<=0||p.x+p.w>1+1e-9||p.y+p.h>1+1e-9||p.radius<0||p.radius>.5||p.bottom<0||p.top<=p.bottom||p.top>2000)fail('invalid bounds or height');
    if(tag==='rect'&&Math.abs(number(a.rx,'rx')-p.radius*Math.min(w,h))>1e-6)fail('rx and relative radius disagree');
    if(version==='2'&&tag==='rect')p.profile='rect';
    if(tag==='ellipse')p.profile='ellipse';
    if(points){p.profile='polygon';p.points=points.map(([x,y])=>[norm(x,w),norm(y,h)]);}
    if(Object.hasOwn(a,'data-hp-hole-points')){
      const hole=a['data-hp-hole-points'].trim().split(/\s+/).map(pair=>{const p=pair.split(',');if(p.length!==2)fail('hole point');return p.map(v=>number(v,'hole point'));});
      if(hole.length<3||hole.length>48)fail('hole vertex count');
      validatePolygon(hole);
      const contains=([x,y])=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,ay]=points[i],[bx,by]=points[j];
        if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
      }return inside;};
      if(!hole.every(contains))fail('hole outside profile');
      for(let i=0;i<hole.length;i++)for(let j=0;j<points.length;j++)
        if(edgesMeet(hole[i],hole[(i+1)%hole.length],points[j],points[(j+1)%points.length]))fail('hole intersects profile');
      p.hole=hole.map(([x,y])=>[norm(x,w),norm(y,h)]);
    }
    if(Object.hasOwn(a,'data-hp-plane')){
      if(!['xy','xz','yz'].includes(a['data-hp-plane'])||tag==='polygon')fail('unsupported profile plane');
      p.plane=a['data-hp-plane'];
    }
    if(Object.hasOwn(a,'data-hp-inset-cm')){
      const inset=number(a['data-hp-inset-cm'],'inset'),plane=p.plane||'xy';
      const limits=plane==='xy'?[width,height]:plane==='xz'?[width,p.top-p.bottom]:[height,p.top-p.bottom];
      if(tag==='polygon'||inset<=0||limits.some(v=>inset*2>=v))fail('invalid inset');
      p.inset=[norm(inset,w),norm(inset,h),inset];
    }
    if(Object.hasOwn(a,'data-hp-base-scale')){
      p.baseScale=number(a['data-hp-base-scale'],'base scale');
      if((p.plane&&p.plane!=='xy')||p.baseScale<.05||p.baseScale>1)fail('invalid base scale');
    }
    if(Object.hasOwn(a,'data-hp-top-scale')||Object.hasOwn(a,'data-hp-top-offset')){
      p.topScale=number(a['data-hp-top-scale'],'top scale');
      p.topOffset=(a['data-hp-top-offset']||'0,0').split(',').map(v=>number(v,'top offset'));
      if((p.plane&&p.plane!=='xy')||p.topScale<.05||p.topScale>1||p.topOffset.length!==2||p.topOffset.some(v=>Math.abs(v)+p.topScale/2>.5))fail('invalid top profile');
    }
    parts.push(p);return '';
  });
  if(remainder.trim())fail('unsupported SVG content');
  if(!parts.length||parts.length>96)fail('part count');
  return parts;
}

/** Reject self-intersections, zero edges and zero-area polygons before meshing. */
function validatePolygon(points){
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  let area=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(a[0]===b[0]&&a[1]===b[1])fail('zero polygon edge');
    area+=a[0]*b[1]-b[0]*a[1];
    for(let j=i+2;j<points.length;j++){
      if(i===0&&j===points.length-1)continue;
      const c=points[j],d=points[(j+1)%points.length];
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))fail('self-intersecting polygon');
    }
  }
  if(Math.abs(area)<1e-8)fail('zero polygon area');
  if(area<0)points.reverse();
}

function edgesMeet(a,b,c,d){
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function loadVolumeModels(packRoot){
  const pack=JSON.parse(fs.readFileSync(path.join(packRoot,'pack.json'),'utf8'));
  if(!Array.isArray(pack.symbols)||!pack.symbols.length)fail('catalog is empty');
  const symbols=new Map();
  for(const symbol of pack.symbols){
    if(!identifier(symbol.id)||symbols.has(symbol.id))fail('invalid/duplicate catalog id');
    symbols.set(symbol.id,symbol);
  }
  const directory=path.join(packRoot,'svg/volume'),models={};
  for(const file of fs.readdirSync(directory).sort()){
    if(!file.endsWith('.svg'))fail('unexpected file '+file);
    const id=file.slice(0,-4),symbol=symbols.get(id);
    if(!symbol||!identifier(id))fail('unknown model '+id);
    models[id]=parseVolumeSvg(fs.readFileSync(path.join(directory,file),'utf8'),symbol);
  }
  const missing=[...symbols.keys()].filter(id=>!Object.hasOwn(models,id));
  if(missing.length)fail('missing model '+missing.join(', '));
  return models;
}
export function generateVolume(root=ROOT,check=false){
  const models=loadVolumeModels(path.join(root,'assets/furniture/houseplan-0.4.1'));
  const text='/* Generated from annotated svg/volume. Do not edit. */\n'
    +"export const FURNITURE_VOLUME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';\n"
    +'export const FURNITURE_VOLUME_MODELS = '+JSON.stringify(models)+' as const;\n';
  const pack=JSON.parse(fs.readFileSync(path.join(root,'assets/furniture/houseplan-0.4.1/pack.json'),'utf8'));
  const catalog=pack.symbols.map(({id,name_ru,name_en,group,width_cm,depth_cm})=>({id,name_ru,name_en,group,width_cm,depth_cm}));
  const files=[['furniture-volume.generated.ts',text],['furniture-gallery-catalog.generated.ts',
    '/* Generated gallery labels; kept out of the product entry. */\nexport const FURNITURE_GALLERY_CATALOG = '+JSON.stringify(catalog)+' as const;\n']];
  for(const [name,body] of files){
    const output=path.join(root,'src',name);
    if(check){if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==body)fail('generated '+name+' is stale');}
    else fs.writeFileSync(output,body);
  }
  return Object.keys(models).length;
}
if(isMainModule(import.meta.url))console.log(`Furniture volume: ${generateVolume(ROOT,process.argv.includes('--check'))}/60 models; ${process.argv.includes('--check')?'current':'generated'}.`);
