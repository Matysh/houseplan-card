/** Closed read-only history DTOs and truthful labels; no editor/runtime imports. */
import type {VacPath} from './vacuum';
import {freezeVacuumPath,VAC_RAW_MAX_POINTS,VAC_RAW_MAX_SEGMENTS} from './vacuum-path-geometry';
import {normalizeRouteMatrix,type VacuumMapRoute} from './vacuum-routes';

export interface HistoryRecord {id:string;timestamp:number}
export interface HistoryCatalog {records:readonly HistoryRecord[];revision:string;epoch:string;limited:boolean}
export interface HistoryMaterial extends HistoryRecord {
  paths:VacPath;route:VacuumMapRoute;vacuum:string;completed:boolean;epoch:string;
}
const record=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const opaque=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const epoch=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const timestamp=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=253402300799;
export function historyCatalog(value:unknown):HistoryCatalog|null {
  const v=record(value);
  if(v?.version!==1||!opaque(v.revision)||!epoch(v.epoch)||typeof v.limited!=='boolean'
    ||!Array.isArray(v.records)||v.records.length>100)return null;
  const seen=new Set<string>(),times=new Set<number>(),rows:HistoryRecord[]=[];
  for(const raw of v.records){
    const row=record(raw);
    if(!row||!opaque(row.id)||!timestamp(row.timestamp)||seen.has(row.id)||times.has(row.timestamp))return null;
    seen.add(row.id);times.add(row.timestamp);rows.push(Object.freeze({id:row.id,timestamp:row.timestamp}));
  }
  rows.sort((a,b)=>b.timestamp-a.timestamp||a.id.localeCompare(b.id));
  return Object.freeze({records:Object.freeze(rows),revision:v.revision,epoch:v.epoch,limited:v.limited});
}
export function historyMaterial(value:unknown,catalog:HistoryCatalog,requested:HistoryRecord):HistoryMaterial|null {
  const v=record(value),route=record(v?.route),matrix=normalizeRouteMatrix(route?.calibration);
  if(v?.version!==1||v.id!==requested.id||v.timestamp!==requested.timestamp||v.revision!==catalog.revision
    ||v.epoch!==catalog.epoch||typeof v.completed!=='boolean'||typeof v.vacuum!=='string'
    ||!/^vacuum\.[a-z0-9_]+$/.test(v.vacuum)||!route||!matrix
    ||!['id','source','map_id','space'].every(key=>typeof route[key]==='string'&&(route[key] as string).length<=256)
    ||!route.id||!route.space||!Array.isArray(v.paths)||v.paths.length>VAC_RAW_MAX_SEGMENTS)return null;
  const paths:VacPath=[];let count=0;
  for(const raw of v.paths){
    if(!Array.isArray(raw)||!raw.length)return null;
    const path:VacPath[number]=[];
    for(const point of raw){
      if(++count>VAC_RAW_MAX_POINTS||!Array.isArray(point)||point.length!==2
        ||!point.every(n=>typeof n==='number'&&Number.isFinite(n)))return null;
      path.push([point[0],point[1]]);
    }
    paths.push(path);
  }
  return Object.freeze({id:requested.id,timestamp:requested.timestamp,completed:v.completed,epoch:catalog.epoch,
    vacuum:v.vacuum,paths:freezeVacuumPath(paths),route:Object.freeze({id:route.id as string,source:route.source as string,
      map_id:route.map_id as string,space:route.space as string,calibration:Object.freeze(matrix) as typeof matrix})});
}

/** Seconds apply to the whole collision group; DST ambiguity uses real offsets. */
export function historyLabels(records:readonly HistoryRecord[],timeZone:string):ReadonlyMap<string,string> {
  const format=(stamp:number,seconds:boolean):string=>{
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone,day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit' as const}:{}),hourCycle:'h23'}).formatToParts(stamp*1000);
    const p=(type:string)=>parts.find(v=>v.type===type)?.value??'';
    return `${p('day')}.${p('month')}.${p('year')} · ${p('hour')}:${p('minute')}${seconds?`:${p('second')}`:''}`;
  };
  const minutes=records.map(row=>format(row.timestamp,false));
  const labels=records.map((row,i)=>minutes.filter(label=>label===minutes[i]).length>1?format(row.timestamp,true):minutes[i]);
  return new Map(records.map((row,i)=>{
    const offset=labels.filter(label=>label===labels[i]).length>1
      ? new Intl.DateTimeFormat('en-GB',{timeZone,timeZoneName:'longOffset'}).formatToParts(row.timestamp*1000)
        .find(p=>p.type==='timeZoneName')?.value.replace('GMT','UTC') : '';
    return [row.id,`${labels[i]}${offset?` · ${offset==='UTC'?'UTC+00:00':offset}`:''}`];
  }));
}
