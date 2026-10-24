/** One memory-only history owner per card; Show intent outlives its dialog. */
import type {ReactiveControllerHost} from 'lit';
import type {DevItem,ServerConfig} from './types';
import type {ConfigAdoption} from './config-adoption';
import type {ConfigWriteContext} from './config-write-context';
import {effectiveRoutes,type VacuumMapRoute} from './vacuum-routes';
import {displayIsNeutral,normalizeDeviceDisplay} from './logic';
import {historyCatalog,historyLabels,historyMaterial,type HistoryCatalog,type HistoryMaterial,type HistoryRecord} from './vacuum-history-values';

interface HistoryHass {
  connection?:unknown;user?:{id?:string};config?:{time_zone?:string};
  callWS<T>(message:Record<string,unknown>):Promise<T>;
  states:Record<string,{state:string;attributes?:Record<string,unknown>}>;
  entities?:Record<string,{device_id?:unknown;platform?:unknown;disabled_by?:unknown}>;
}
export interface VacuumHistoryHost extends ReactiveControllerHost {
  hass:HistoryHass;isConnected:boolean;ownerDocument:{visibilityState:string};
  _configWriteContext:ConfigWriteContext;_adoption:ConfigAdoption;
  _canEdit:boolean;_kiosk:boolean;_loadOk:boolean;_haVacuumHistoryApi:number|null;
  _space:string;_mode:string;_devices:DevItem[];_selId:string|null;
  _markerDialog:{devId:string}|null;_infoCard:DevItem|null;
  _model:{id:string;title:string}[];
  _vacEntity(device:DevItem):string|null;_vacSource(device:DevItem):string|null;
}
type Context={key:string;claim:object;vacuum:string;routes:VacuumMapRoute[]};
type ShowIntent={record:HistoryRecord;catalog:HistoryCatalog;context:Context};
export type HistoryReason='update'|'unsupported'|'unavailable'|'empty'|'empty_path'|'loading'|'stale'|'ambiguous'
  |'limited'|'incomplete'|'coordinates_unverified'|'needs_calibration'|'missing_space'|'other_space'
  |'suppressed'|'mode'|'unauthorized'|'retired'|'interrupted';
const errorReason=(error:unknown):HistoryReason=>{
  const code=(error as {code?:string})?.code;
  if(code==='not_found')return 'retired';
  return ['unsupported','unavailable','empty','stale','ambiguous','limited','incomplete','coordinates_unverified',
    'needs_calibration','missing_space','suppressed','unauthorized','retired'].includes(code??'')?code as HistoryReason:'unavailable';
};

export class VacuumHistory {
  markerId:string|null=null;
  selected='';catalog:HistoryCatalog|null=null;shown:HistoryMaterial|null=null;
  reason:HistoryReason|null=null;otherSpace='';loadingList=false;loadingShow=false;renderLimited=false;
  private context:Context|null=null;
  private listGeneration=0;private requested:ShowIntent|null=null;private openDialog:string|null=null;
  private loaded=false;private observedEpoch:string|null=null;
  private painted:HistoryMaterial|null=null;
  private labelMemo:{catalog:HistoryCatalog;zone:string;labels:ReadonlyMap<string,string>}|null=null;

  constructor(private readonly host:VacuumHistoryHost){host.addController(this);}
  hostDisconnected():void {this.suspend();}
  hostUpdate():void {
    const id=this.host._markerDialog?.devId??this.host._infoCard?.id
      ??(this.host._mode==='devices'?this.host._selId:null);
    const next=id?this.host._devices.find(d=>d.id===id):null;
    if(next&&this.host._vacEntity(next))this.select(next);
    if(!this.host._markerDialog)this.openDialog=null;
    this.synchronize();
  }
  private readContext():Context|null {
    const h=this.host,id=this.markerId;
    if(!id||!h.hass||!h._canEdit||h._kiosk||!h._loadOk||h._haVacuumHistoryApi!==1)return null;
    const config:ServerConfig|undefined=h._adoption.snapshot(null)?.config;
    const marker=config?.markers?.find(m=>m.id===id&&!m.removed),device=h._devices.find(d=>d.id===id);
    if(!marker||!device||device.hidden||marker.hidden||displayIsNeutral(normalizeDeviceDisplay(marker.display))
      ||marker.vacuum?.live===false)return null;
    const vacuum=h._vacEntity(device),source=h._vacSource({...device,marker});
    if(!vacuum)return null;
    const settings=marker.vacuum??{};
    const routes=effectiveRoutes(id,settings,device.space,source);
    const sources=[...new Set([source,...routes.map(r=>r.source)].filter((s):s is string=>!!s))];
    if(!sources.length)return null;
    const entities=[vacuum,...sources].map(entity=>[entity,h.hass.entities?.[entity]?.platform,
      h.hass.entities?.[entity]?.device_id,h.hass.entities?.[entity]?.disabled_by,
      !h.hass.states[entity]||['unknown','unavailable'].includes(h.hass.states[entity].state)]);
    if(entities.some(entity=>entity[4]===true||entity[3]!=null))return null;
    return {claim:h._configWriteContext.claim(),vacuum,routes,key:JSON.stringify([id,h._space,marker.binding,device.bindingKind,device.bindingRef,
      marker.space,source,routes,entities,h._model.map(s=>s.id)])};
  }
  private synchronize():boolean {
    const context=this.readContext(),old=this.context;
    if(old&&(!context||old.key!==context.key||!this.host._configWriteContext.current(old.claim,this.host.hass))){
      this.hide('retired');this.listGeneration++;this.catalog=null;this.loaded=false;this.loadingList=false;
      this.observedEpoch=null;this.openDialog=null;
    }
    this.context=context;
    return !!context&&this.host.isConnected&&this.host.ownerDocument.visibilityState!=='hidden';
  }
  select(device:DevItem):void {
    if(this.markerId===device.id)return;
    this.hide();this.listGeneration++;this.markerId=device.id;this.selected='';this.catalog=null;
    this.loaded=false;this.loadingList=false;this.openDialog=null;this.context=null;this.observedEpoch=null;
  }
  open(device:DevItem):void {
    this.select(device);
    if(!this.synchronize())return;
    if(this.openDialog!==device.id||!this.loaded){this.openDialog=device.id;void this.load();}
  }
  suspend():void {
    this.requested=null;this.listGeneration++;this.loadingList=false;this.loadingShow=false;
    this.openDialog=null;
  }
  hide(reason:HistoryReason|null=null):void {
    this.requested=null;this.loadingShow=false;this.shown=null;this.painted=null;this.reason=reason;this.renderLimited=false;
    this.host.requestUpdate();
  }
  get unavailableReason():HistoryReason|null {
    const h=this.host;
    if(h._haVacuumHistoryApi!==1)return 'update';
    if(!h._canEdit||h._kiosk||!h._loadOk)return 'unauthorized';
    if(!this.readContext())return 'suppressed';
    if(h._mode!=='view'&&h._mode!=='devices')return 'mode';
    if(!this.context?.routes.some(r=>r.calibration&&h._model.some(s=>s.id===r.space)))return 'needs_calibration';
    return null;
  }
  get applicable():boolean {
    if(!this.shown||this.unavailableReason||!this.context||!this.synchronize())return false;
    return this.shown.route.space===this.host._space&&this.validRoute(this.shown)&&this.shown.paths.length>0;
  }
  get visible():boolean {return this.applicable&&this.painted===this.shown;}
  paint(material:HistoryMaterial,drawn:boolean,limited:boolean):void {
    this.painted=drawn?material:null;this.renderLimited=limited;
  }
  get canShow():boolean {return !this.unavailableReason&&!!this.catalog?.records.some(r=>r.id===this.selected);}
  get messageReason():HistoryReason|null {
    if(this.loadingList||this.loadingShow)return 'loading';
    const guard=this.unavailableReason;
    return guard&&guard!=='needs_calibration'?guard:this.reason??guard??(this.renderLimited?'limited':null);
  }
  label(id:string):string {
    const catalog=this.catalog;if(!catalog)return '';
    const zone=this.host.hass.config?.time_zone??'UTC';
    if(this.labelMemo?.catalog!==catalog||this.labelMemo.zone!==zone)
      this.labelMemo={catalog,zone,labels:historyLabels(catalog.records,zone)};
    return this.labelMemo.labels.get(id)??'';
  }
  private validRoute(material:HistoryMaterial):boolean {
    return this.context?.vacuum===material.vacuum&&this.context.routes.filter(r=>r.id===material.route.id
      &&r.source===material.route.source&&r.map_id===material.route.map_id&&r.space===material.route.space
      &&JSON.stringify(r.calibration)===JSON.stringify(material.route.calibration)).length===1;
  }
  adoptEpochs(packet:unknown):void {
    const epochs=(packet as {vacuum_history_epochs?:{default?:unknown;markers?:Record<string,unknown>}})?.vacuum_history_epochs;
    const value=this.markerId?epochs?.markers?.[this.markerId]??epochs?.default:null;
    if(typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value))return;
    if(this.observedEpoch&&this.observedEpoch!==value||this.catalog&&this.catalog.epoch!==value){
      this.hide('retired');this.listGeneration++;this.catalog=null;this.loaded=false;this.loadingList=false;
    }
    this.observedEpoch=value;
  }
  private fail(error:unknown,catalog=false):void {
    const reason=errorReason(error);
    if(reason==='unauthorized'||reason==='retired'
      ||reason==='suppressed'
      ||catalog&&['unavailable','unsupported','suppressed','ambiguous'].includes(reason)){
      this.hide(reason);this.listGeneration++;this.catalog=null;this.loadingList=false;this.labelMemo=null;
      // Keep this dialog's loaded/open state: rendering must not retry a denial.
    }else this.reason=reason;
  }
  async load():Promise<void> {
    if(!this.synchronize()||this.loadingList||!this.context)return;
    const generation=++this.listGeneration,context=this.context,epochAtStart=this.observedEpoch;
    const endedAtStart=this.reason==='retired';
    this.loaded=true;this.loadingList=true;this.reason=null;this.host.requestUpdate();
    const current=()=>generation===this.listGeneration&&this.synchronize()&&this.context?.key===context.key
      &&this.host._configWriteContext.current(context.claim,this.host.hass);
    try {
      const raw=await this.host.hass.callWS({type:'houseplan/vacuum/history/list',marker_id:this.markerId});
      if(!current())return;
      const catalog=historyCatalog(raw);
      if(!catalog)throw {code:'unsupported'};
      const learnedEpoch=!!this.observedEpoch&&this.observedEpoch!==catalog.epoch;
      if(learnedEpoch){
        this.hide('retired');
        // A newer trail epoch observed during this read fences its old reply.
        // Otherwise this fresh catalog is itself proof of a new cleanup.
        if(this.observedEpoch!==epochAtStart)throw {code:'stale'};
      }
      this.observedEpoch=catalog.epoch;this.catalog=catalog;
      const pending=this.requested;
      const retired=!!pending&&(pending.catalog.epoch!==catalog.epoch||pending.catalog.revision!==catalog.revision
        ||!catalog.records.some(row=>row.id===pending.record.id&&row.timestamp===pending.record.timestamp));
      if(retired){this.requested=null;this.loadingShow=false;}
      if(this.shown&&!catalog.records.some(r=>r.id===this.shown!.id))this.hide('stale');
      else this.reason=!catalog.records.length?'empty':retired?'stale':learnedEpoch||endedAtStart?'retired':catalog.limited?'limited':null;
    }catch(error){if(current())this.fail(error,true);}
    finally {if(generation===this.listGeneration){this.loadingList=false;this.host.requestUpdate();}}
  }
  async show():Promise<void> {
    if(!this.synchronize()||!this.canShow||!this.catalog||!this.context)return;
    const catalog=this.catalog,requested=catalog.records.find(row=>row.id===this.selected)!;
    const context=this.context,intent:ShowIntent={record:requested,catalog,context};
    this.requested=intent;
    this.loadingShow=true;this.reason=null;this.host.requestUpdate();
    const current=()=>this.requested===intent&&this.synchronize()&&this.context?.key===context.key
      &&this.catalog?.revision===catalog.revision&&this.catalog.epoch===catalog.epoch
      &&this.catalog.records.some(row=>row.id===requested.id&&row.timestamp===requested.timestamp)
      &&this.host._configWriteContext.current(context.claim,this.host.hass);
    try {
      const raw=await this.host.hass.callWS({type:'houseplan/vacuum/history/get',marker_id:this.markerId,
        record_id:requested.id,revision:catalog.revision});
      if(!current())return;
      const material=historyMaterial(raw,catalog,requested);
      if(!material||!this.validRoute(material)||this.observedEpoch!==material.epoch)throw {code:'stale'};
      if(material.route.space!==this.host._space){
        this.otherSpace=this.host._model.find(s=>s.id===material.route.space)?.title??material.route.space;
        this.reason='other_space';return;
      }
      this.shown=material.paths.length?material:null;this.renderLimited=false;
      this.reason=!material.paths.length?'empty_path':!material.completed?'interrupted':null;
    }catch(error){if(current())this.fail(error);}
    finally {if(this.requested===intent){this.requested=null;this.loadingShow=false;this.host.requestUpdate();}}
  }
}
