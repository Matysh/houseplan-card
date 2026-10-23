/** Editor-only contact persistence. No HA tick calls this module. */
import {canonicalizePosition} from './coordinate-canonicalization';
import {makeContactBasis,readContactBasis} from './device-contact-basis';
import {applyDevicePlacement,devicePlacement,sameDevicePlacement,type DeviceLayout,type DevicePlacement,type DevicePositionState} from './device-position-history';
import type {DeviceContactRenderer} from './device-contact-render';
import type {ConfigAdoption} from './config-adoption';
import type {LayoutWriteReload} from './layout-write-reload';
import type {ServerConfig} from './types';
interface ContactWriter {
  _layout:DeviceLayout;_layoutRev:number;_cfgRev:number;_space:string;
  _deviceContacts?:DeviceContactRenderer;_adoption:ConfigAdoption;_layoutIO:LayoutWriteReload;
  _serverStorage:boolean;_loadOk:boolean;
  hass:{callWS(message:Record<string,unknown>):Promise<unknown>};
  _sentPos:Map<string,DeviceLayout[string]|null>;
  _cacheSnapshot():void;_persistLocalLayout():void;requestUpdate():void;
}
const record=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;

/** Only affected groups are materialised; a name/size dialog never writes an
 * unrelated floor or captures a live value into the reference of another group. */
export async function contactConfigPatch(value:object,candidate:ServerConfig):Promise<DeviceLayout|undefined> {
  const host=value as ContactWriter,renderer=host._deviceContacts,scene=renderer?.scene;
  const accepted=host._adoption.snapshot(undefined)?.config;
  if(!scene||!accepted||!host._serverStorage)return;
  const old=new Map((accepted.markers??[]).map(m=>[m.id,m]));
  const metric=(m:{size?:unknown;display?:unknown;value_badge?:unknown;value_source?:unknown;use_climate_temp?:unknown}|undefined)=>
    JSON.stringify([m?.size??1,m?.display??null,m?.value_badge??null,m?.value_source??null,m?.use_climate_temp??false]);
  const changed=new Set((candidate.markers??[]).filter(m=>metric(old.get(m.id))!==metric(m)).map(m=>m.id));
  const patch:DeviceLayout={};
  for(const id of changed) for(const member of scene.component(id)) {
    const reference=renderer.reference(member),entry=host._layout[member];
    if(!reference || !entry || entry.s!==host._space || readContactBasis(entry.contact_basis))continue;
    // Future blocks are opaque. An unrelated marker edit must not downgrade one.
    if(Object.prototype.hasOwnProperty.call(entry,'contact_basis'))continue;
    const group=scene.component(member);
    if(group.length<2&&!Object.keys(scene.shapes.get(member)!.walls).length)continue;
    const basis={...makeContactBasis(reference,host._space),legacy:true};
    const pos=canonicalizePosition(entry);
    patch[member]={...pos,contact_basis:{...basis,at:{x:pos.x,y:pos.y,s:pos.s}}};
  }
  if(!Object.keys(patch).length)return;
  const current=host._layoutIO.guard(),revision=host._cfgRev,layoutRevision=host._layoutRev;
  const capability=record(await host.hass.callWS({type:'houseplan/config/get',fields:[]}));
  if(!current()||revision!==host._cfgRev||layoutRevision!==host._layoutRev)throw new Error('contact write context changed');
  if(capability?.device_contact_api!==1)return;
  if(capability.rev!==revision)throw Object.assign(new Error('configuration changed elsewhere'),{code:'conflict'});
  return patch;
}

export function prepareContactMove(value:object,drag:{id:string;spaceId:string;before:DevicePlacement|null;contactMembers?:readonly string[]},
  after:DevicePlacement):{before:DevicePositionState;after:DevicePositionState} {
  const host=value as ContactWriter,scene=host._deviceContacts?.scene;
  const base={deviceId:drag.id,spaceId:drag.spaceId};
  const result={before:{...base,placement:drag.before} as DevicePositionState,after:{...base,placement:after} as DevicePositionState};
  if(!scene)return result;
  const ids=new Set([...(drag.contactMembers??[]),...scene.component(drag.id)]);
  const active=ids.size>1||Object.keys(scene.shapes.get(drag.id)?.walls??{}).length>0;
  if(!active)ids.clear();
  ids.add(drag.id);
  for(const id of [...ids].sort()) {
    const shape=scene.shapes.get(id);if(!shape)continue;
    const position=canonicalizePosition({x:shape.marker.x/1000,y:shape.marker.y/1000,s:drag.spaceId});
    const basis=makeContactBasis({...shape.marker,x:position.x*1000,y:position.y*1000},drag.spaceId);
    const existing=host._layout[id]?.contact_basis;
    const opaque=record(existing)?.v!==1&&existing!==undefined;
    const placement:DevicePlacement={...position,contact_basis:opaque?structuredClone(existing):basis};
    if(id===drag.id)result.after.placement=placement;
    else {
      (result.before.related??=[]).push({deviceId:id,spaceId:drag.spaceId,placement:devicePlacement(host._layout,id)});
      (result.after.related??=[]).push({deviceId:id,spaceId:drag.spaceId,placement});
    }
  }
  return result;
}

/** Existing layout/set CAS over a fresh complete read, never the active-floor
 * projection. A conflicting read cannot overwrite another client's positions. */
export async function persistContactPlacements(value:object,state:DevicePositionState):Promise<void> {
  const host=value as ContactWriter,changes=[state,...state.related??[]];
  const current=host._layoutIO.guard(),owns=host._layoutIO.guard(true),finish=host._layoutIO.begin();
  const sent=new Map<string,DeviceLayout[string]|null>();
  try {
    if(!current()||!host._loadOk)throw new Error('contact write context changed');
    if(!host._serverStorage){
      for(const c of changes)host._adoption.stageLocalLayout(applyDevicePlacement(host._layout,c.deviceId,c.placement));
      host._persistLocalLayout();return;
    }
    const accepted=host._adoption.snapshot(undefined)?.layout;
    if(!accepted)throw new Error('no accepted layout authority');
    const expected=new Map(changes.map(c=>[c.deviceId,devicePlacement(accepted,c.deviceId)]));
    const snapshot=record(await host.hass.callWS({type:'houseplan/layout/get'}));
    if(!current()||typeof snapshot?.rev!=='number'||!record(snapshot.layout))throw new Error('invalid complete layout snapshot');
    let layout=structuredClone(snapshot.layout) as DeviceLayout;
    for(const c of changes) {
      if(!sameDevicePlacement(devicePlacement(layout,c.deviceId),expected.get(c.deviceId)??null))
        throw Object.assign(new Error('device position changed elsewhere'),{code:'conflict'});
      layout=applyDevicePlacement(layout,c.deviceId,c.placement);
      sent.set(c.deviceId,layout[c.deviceId]??null);host._sentPos.set(c.deviceId,layout[c.deviceId]??null);
    }
    let response:Record<string,unknown>|null;
    try {
      response=record(await host.hass.callWS({type:'houseplan/layout/set',layout,expected_rev:snapshot.rev,
        expected_config_rev:host._cfgRev}));
    } catch(error) {
      // A transport failure is not proof that the server rejected the write.
      // Reconcile only our named placements; never replay the full snapshot.
      if(!current()||record(error)?.code)throw error;
      const recovered=record(await host.hass.callWS({type:'houseplan/layout/get'}));
      const saved=record(recovered?.layout) as DeviceLayout|null;
      if(!saved||!changes.every(c=>sameDevicePlacement(devicePlacement(saved,c.deviceId),c.placement)))throw error;
      response=recovered;
    }
    if(!current())throw new Error('contact write context changed');
    if(typeof response?.rev!=='number')throw new Error('invalid contact write acknowledgement');
    for(const [id,pos] of sent) {
      host._adoption.stageLocalLayout(applyDevicePlacement(host._layout,id,pos));
      host._adoption.acceptLayoutPosition(id,pos,response?.rev);
    }
    host._adoption.refreshLayoutFingerprint();host._cacheSnapshot();host.requestUpdate();
  } finally {
    if(owns())for(const [id,pos] of sent)if(host._sentPos.get(id)===pos)host._sentPos.delete(id);
    finish();
  }
}
