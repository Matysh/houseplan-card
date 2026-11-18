import type {FurnitureVolumeModels} from './furniture-volume-types';
import {canonicalFurnitureId} from './furniture-id';
type VolumeModule={FURNITURE_VOLUME_FINGERPRINT:string;FURNITURE_VOLUME_MODELS:FurnitureVolumeModels};
type Host={isConnected:boolean;requestUpdate():void};
/** One lazy registry for both Lab and gallery. Failure keeps the native flat drawing. */
export class FurnitureVolumeRuntime {
  private models:FurnitureVolumeModels|null=null;
  private failed=false;
  private pending:Promise<void>|null=null;
  private hosts=new Set<Host>();
  constructor(private expected:string,private load:()=>Promise<VolumeModule>,private warn:(e:unknown)=>void=console.warn){}
  state(){return this.models?'ready':this.failed?'fallback':'pending';}
  parts(id:string){return this.models?.[canonicalFurnitureId(id)]??null;}
  ensure(host?:Host):Promise<void>{
    if(this.state()!=='pending')return Promise.resolve();
    if(host)this.hosts.add(host);
    if(!this.pending)this.pending=this.load().then(module=>{
      if(module.FURNITURE_VOLUME_FINGERPRINT!==this.expected)throw new Error('Furniture volume build mismatch');
      this.models=module.FURNITURE_VOLUME_MODELS;
    }).catch(error=>{this.failed=true;this.warn(error);}).then(()=>{
      for(const h of this.hosts)if(h.isConnected)h.requestUpdate();this.hosts.clear();
    });
    return this.pending;
  }
}
export const FURNITURE_VOLUME_RUNTIME=new FurnitureVolumeRuntime('__HOUSEPLAN_SOURCE_FINGERPRINT__',
 ()=>import('./furniture-volume.generated'));
