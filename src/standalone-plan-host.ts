/** Per-mount presentation/lifetime facade; persistence and authority stay host-owned. */
import { capabilityHost, PLAN_ONLY_CAPABILITIES, CAPABILITY_NAMES, validateCapabilities } from './plan-capabilities';
import { hostError, once, type PlanHost, type HostPresentationContext, type Unsubscribe } from './plan-host';
import { normalizeRuntimeVersion } from './version-recovery';

export const STANDALONE_REQUIRED_APIS = Object.freeze({opening_features_api:1,graph_change_api:2,plan_graph_api:1,
  room_label_layout_api:1,decor_assets_api:1,wall_node_move_api:1,wall_node_delete_api:1,wall_node_merge_api:1,wall_node_attach_api:1});
export function validateStandaloneHandshake(response:Record<string,unknown>,fingerprint:string,version:string):void {
  if(!response || !normalizeRuntimeVersion(response.integration_version)
    || normalizeRuntimeVersion(response.integration_version)!==normalizeRuntimeVersion(version)
    || response.frontend_fingerprint!==fingerprint || !Number.isSafeInteger(response.rev) || Number(response.rev)<0
    || typeof response.can_write!=='boolean' || !response.config || typeof response.config!=='object'
    || Object.entries(STANDALONE_REQUIRED_APIS).some(([key,value])=>response[key]!==value))
    throw hostError('standalone_host_incompatible');
}

export function validateStandaloneHost(source: PlanHost): void {
  validateCapabilities(source?.capabilities);
  if (CAPABILITY_NAMES.some(name => source.capabilities[name] !== PLAN_ONLY_CAPABILITIES[name])
    || !Object.isFrozen(source.capabilities)
    || typeof source.request !== 'function' || typeof source.subscribe !== 'function'
    || typeof source.subscribeEnvironment !== 'function'
    || typeof source.http?.request !== 'function' || typeof source.http?.postJson !== 'function'
    || typeof source.content?.resolve !== 'function' || typeof source.content?.resolveAssets !== 'function'
    || !source.authorityKey || typeof source.authorityKey !== 'object'
    || !Number.isSafeInteger(source.environmentRevision) || !Number.isSafeInteger(source.writeAuthorityRevision)
    || !source.environment || typeof source.environment.ready !== 'boolean'
    || typeof source.environment.connected !== 'boolean'
    || ['read','write','admin'].some(key => typeof source.environment.permissions?.[key as 'read'] !== 'boolean'))
    throw hostError('standalone_host_invalid');
}

export function createStandaloneHost(source: PlanHost, initial: HostPresentationContext) {
  validateStandaloneHost(source);
  const guarded = capabilityHost(source), listeners = new Set<() => void>(), leases = new Set<Unsubscribe>();
  let disposed=false, revision=0, presentation=initial, snapshot: PlanHost['environment'] | undefined;
  let sourceSnapshot: PlanHost['environment'] | undefined, sourceRevision=-1;
  const notify = () => { revision++; snapshot=undefined; for(const receive of [...listeners])receive(); };
  const live = () => { if(disposed)throw hostError('context-changed'); };
  const lease = () => { live(); return [guarded.authorityKey,guarded.writeAuthorityRevision] as const; };
  const request = async <T>(run:()=>Promise<T>): Promise<T> => {
    const [key,epoch]=lease(); const value=await run();live();
    if(key!==guarded.authorityKey || epoch!==guarded.writeAuthorityRevision)throw hostError('context-changed');
    return value;
  };
  const releaseSource=once(guarded.subscribeEnvironment(notify));
  const host: PlanHost = {
    capabilities:guarded.capabilities,
    get authorityKey(){return guarded.authorityKey;},
    get writeAuthorityRevision(){return guarded.writeAuthorityRevision+(disposed?1:0);},
    get environmentRevision(){return guarded.environmentRevision+revision;},
    get environment(){
      const value=guarded.environment;
      if(!snapshot || sourceSnapshot!==value || sourceRevision!==guarded.environmentRevision){
        sourceSnapshot=value;sourceRevision=guarded.environmentRevision;
        snapshot=Object.freeze({...value,presentation,...(disposed?{ready:false,connected:false,
          permissions:Object.freeze({read:false,write:false,admin:false})}:{})});
      }
      return snapshot;
    },
    request:command=>request(()=>guarded.request(command)),
    async subscribe(event,receive,options){
      const [key,epoch]=lease();
      const current=()=>!disposed && key===guarded.authorityKey && epoch===guarded.writeAuthorityRevision;
      const release=await guarded.subscribe(event,value=>{if(current())return receive(value);},options);
      if(!current()){release();throw hostError('context-changed');}
      const owned=once(()=>{leases.delete(owned);release();});leases.add(owned);return owned;
    },
    subscribeEnvironment(receive){live();listeners.add(receive);return once(()=>listeners.delete(receive));},
    content:{resolve:paths=>request(()=>guarded.content.resolve(paths)),resolveAssets:ids=>request(()=>guarded.content.resolveAssets(ids))},
    http:{request:(path,init)=>request(()=>guarded.http.request(path,init)),
      postJson:(path,value,signal)=>request(()=>guarded.http.postJson(path,value,signal))},
  };
  return {host,publish(value:HostPresentationContext){live();presentation=value;notify();},
    dispose(){if(disposed)return;disposed=true;notify();releaseSource();for(const release of [...leases])release();listeners.clear();}};
}
