import type {FurnitureVolumeModels} from './furniture-volume-types';
import {canonicalFurnitureId} from './furniture-id';
type VolumeModule={FURNITURE_VOLUME_FINGERPRINT:string;FURNITURE_VOLUME_MODELS:FurnitureVolumeModels};
type Host={isConnected:boolean;requestUpdate():void};
/** One lazy registry for product View and gallery. Failure keeps the native flat drawing. */
export class FurnitureVolumeRuntime {
  private models:FurnitureVolumeModels|null=null;
  private failed=false;
  private pending:Promise<void>|null=null;
  private hosts=new Set<Host>();
  constructor(private expected:string,private load:()=>Promise<VolumeModule>,private warn:(e:unknown)=>void=console.warn){}
  state(){return this.models?'ready':this.failed?'fallback':'pending';}
  parts(id:string){
    const key=canonicalFurnitureId(id);
    return this.models && Object.prototype.hasOwnProperty.call(this.models,key) ? this.models[key] : null;
  }
  ensure(host?:Host):Promise<void>{
    if(this.state()!=='pending')return Promise.resolve();
    if(host)this.hosts.add(host);
    if(!this.pending)this.pending=this.loadOnce();
    return this.pending;
  }
  private async loadOnce():Promise<void>{
    try{
      const module=await this.load();
      if(module?.FURNITURE_VOLUME_FINGERPRINT!==this.expected)throw new Error('Furniture volume build mismatch');
      const models=module.FURNITURE_VOLUME_MODELS;
      if(!models || typeof models!=='object' || Array.isArray(models) || !Object.keys(models).length
        || Object.values(models).some(parts=>!Array.isArray(parts) || !parts.length || parts.length>96
          || parts.some(part=>!part || typeof part.name!=='string'
            || ![part.x,part.y,part.w,part.h,part.radius,part.bottom,part.top].every(Number.isFinite)
            || part.w<=0 || part.h<=0 || part.top<=part.bottom)))throw new Error('Furniture volume registry is invalid');
      this.models=models;
    }catch(error){
      this.failed=true;
      // Diagnostics must not turn the settled fallback into an unhandled load.
      try{this.warn(error);}catch{/* A host logger is not part of the renderer. */}
    }
    const hosts=[...this.hosts];this.hosts.clear();
    for(const host of hosts)if(host.isConnected)host.requestUpdate();
  }
}
export const FURNITURE_VOLUME_RUNTIME=new FurnitureVolumeRuntime('__HOUSEPLAN_SOURCE_FINGERPRINT__',
 ()=>import('./furniture-volume.generated'));
