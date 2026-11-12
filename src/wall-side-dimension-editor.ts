/** Four read-only adapters, one resolver and one screen-space renderer. The
 * owning native paint calls render(); there are no observers, polls or writes. */
import {nothing,type TemplateResult} from 'lit';
import type {HouseplanEditorRuntime} from './houseplan-editor-runtime';
import {NORM_W,GRID_PITCH} from './canvas-constants';
import {encodePoint,readAuthoredPoint} from './plan-exact';
import type {PlanGraph} from './plan-graph';
import type {NodeMoveSpace} from './wall-node-move';
import {formatLength} from './logic';
import {roomPoly,spaceDisplayOf} from './logic';
import {iconCqw} from './space-geometry';
import {langOf} from './i18n';
import {propertiesT} from './editors/properties/strings';
import {DRAW_WALL_DEFAULT_CM} from './wall-thickness';
import {affectedDimensionCarriers,dimensionCarriers,WallDimensionGeometry} from './wall-side-dimension-geometry';
import {changedWallSideDimensions,type DimensionInterval,type DimensionPoint} from './wall-side-dimensions';
import {layoutWallSideDimensions,dimensionListBox,resizeHandleDimensionObstacle,type DimensionBox} from './wall-side-dimension-layout';
import {renderWallSideDimensions} from './wall-side-dimension-render';

interface Request {kind:'draw'|'node'|'resize'|'selection';before:NodeMoveSpace|null;candidate:NodeMoveSpace;ids:readonly string[];owner:object|string}
interface View {x:number;y:number;w:number;h:number}
export class WallSideDimensionEditor {
  public readonly geometry=new WallDimensionGeometry();
  private owner:object|string|null=null;
  private lanes=new Map<string,number>();
  private numbers=new Map<string,number>();
  private source:object|null=null;
  private drawNext:{base:object;key:string;space:NodeMoveSpace}|null=null;
  private widths=new Map<string,number>();
  private disposed=false;
  private basisFallback=false;
  private basisEpoch=0;
  constructor(private readonly runtime:HouseplanEditorRuntime) {
    const measure=()=>{
      if(this.disposed)return;
      const context=runtime.host.ownerDocument?.createElement('canvas').getContext?.('2d');
      if(!context)return;
      context.font='12px Roboto,Arial,sans-serif';
      for(const char of '0123456789., m′″[]−-') this.widths.set(char,context.measureText(char).width);
      runtime.host.requestUpdate();
    };
    // Font work is outside all held-pointer paths. Per-frame text uses cached
    // glyph advances, never getBoundingClientRect/getComputedStyle per label.
    queueMicrotask(measure);
    void runtime.host.ownerDocument?.fonts?.ready.then(measure);
  }
  private selected():string|null {
    const target=this.runtime.properties.dimensionTarget;
    return target ? `${target.kind==='contour'?'wall':'partition'}:${target.id}` : null;
  }
  private draft(space:NodeMoveSpace,points:readonly number[][],cms:readonly number[],prefix:string):NodeMoveSpace {
    const partitions=[...(space.partitions||[])];
    const base=space.plan_graph;
    const graph:PlanGraph|undefined=base?{...base,nodes:[...base.nodes],edges:[...base.edges]}:undefined;
    const nodes=new Map(graph?.nodes.map(node=>[JSON.stringify(node.p),node.id])||[]);
    const node=(point:number[],index:number):string=>{
      const p=encodePoint(readAuthoredPoint([point[0]/NORM_W,point[1]/NORM_W])),key=JSON.stringify(p);
      const old=nodes.get(key);if(old)return old;
      const id=`${prefix}:node:${index}`;nodes.set(key,id);graph!.nodes.push({id,p});return id;
    };
    for(let i=0;i+1<points.length;i++) {
      const a=points[i],b=points[i+1];
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9)continue;
      const id=`${prefix}:${i}`,cm=cms[i]??DRAW_WALL_DEFAULT_CM;
      partitions.push({id,a:[a[0]/NORM_W,a[1]/NORM_W],b:[b[0]/NORM_W,b[1]/NORM_W],cm});
      if(graph)graph.edges.push({kind:'partition',id,from:node(a,i),to:node(b,i+1),cm});
    }
    return {...space,partitions,...(graph?{plan_graph:graph}:{})};
  }
  private request():Request|null {
    const host=this.runtime.host;
    if(!host.isConnected||host._mode!=='plan'||!host._canEdit||host._kiosk||host._modeTransitionBusy
      ||host._openingDialog||host._roomDialog||this.runtime.physicalGesture.active)return null;
    const stored=host._serverCfg?.spaces.find(space=>space.id===host._space) as NodeMoveSpace|undefined;
    if(!stored)return null;
    if(this.source!==stored.plan_graph && this.source!==stored) {
      this.source=stored.plan_graph||stored;this.drawNext=null;
    }
    const node=this.runtime.nodeMove?.dimensionContext;
    if(node?.moved) {
      // A refused candidate may paint an outline rather than physical faces.
      // Hide measurements instead of presenting yesterday's valid corners as
      // belonging to the currently displayed invalid shape.
      if(!node.candidate)return null;
      const candidate=node.candidate;
      return {kind:'node',before:node.before,candidate,ids:affectedDimensionCarriers(node.before,candidate),owner:node.before};
    }
    const resize=host._resize;
    if(host._tool==='resize'&&resize.dragging&&resize.preview) {
      const candidate=resize.preview.sp as NodeMoveSpace;
      return {kind:'resize',before:stored,candidate,ids:affectedDimensionCarriers(stored,candidate),owner:resize.plan!};
    }
    if(host._tool==='draw'&&host._path.length&&host._cursorPt&&!host._contourClosed) {
      let prefix='__hp_dimension_draft';
      while((stored.partitions||[]).some(p=>p.id.startsWith(prefix))
        ||stored.plan_graph?.nodes.some(n=>n.id.startsWith(prefix)))prefix+='_';
      // Each ordinary click already commits its edge to the current graph.
      // Replaying the whole path here would create duplicate material owners.
      // The immutable graph identity is the baseline until the next click.
      const base=stored.plan_graph||stored,tail=host._path[host._path.length-1];
      const cm=host._drawWallCm??DRAW_WALL_DEFAULT_CM;
      const key=JSON.stringify([tail,host._cursorPt,cm,host._cellCm]);
      if(this.drawNext?.base!==base||this.drawNext?.key!==key)
        this.drawNext={base,key,space:this.draft(stored,[tail,host._cursorPt],[cm],prefix)};
      return {kind:'draw',before:stored,candidate:this.drawNext.space,
        ids:affectedDimensionCarriers(stored,this.drawNext.space),owner:base};
    }
    const id=this.selected();
    return id&&host._tool==='select'?{kind:'selection',before:null,candidate:stored,ids:[id],owner:`${stored.id}:${id}`} : null;
  }
  private resetLayout():void {this.owner=null;this.lanes.clear();this.numbers.clear();}
  private publishBasis(fallback:boolean):void {
    if(this.basisFallback===fallback)return;
    this.basisFallback=fallback;const epoch=++this.basisEpoch;
    // Only a basis transition refreshes the existing Properties hint. A
    // normal held-pointer frame remains a measurement-only native paint.
    queueMicrotask(()=>{if(!this.disposed&&epoch===this.basisEpoch&&this.runtime.host.isConnected)
      // This is a named invalidation token, not a stored Lit property: force
      // its update explicitly, otherwise undefined === undefined is a no-op.
      this.runtime.host.requestUpdate('_wallDimensionBasis',undefined,{hasChanged:()=>true});});
  }
  private measurements(request:Request):readonly DimensionInterval[] {
    const model=this.geometry.read(request.candidate,request.ids);
    let intervals:readonly DimensionInterval[]=model.intervals;
    if(request.before) {
      intervals=changedWallSideDimensions(this.geometry.read(request.before,request.ids).intervals,
        model.intervals,model.epsilonCm);
      if(!intervals.length) {
        const selected=this.selected();intervals=selected?model.intervals.filter(i=>i.carrier===selected):[];
      }
    }
    return intervals;
  }
  public render(view:View):TemplateResult|typeof nothing {
    const request=this.request();
    if(!request){this.publishBasis(false);this.resetLayout();return nothing;}
    if(this.owner!==request.owner){this.resetLayout();this.owner=request.owner;}
    const intervals=this.measurements(request);
    this.publishBasis(intervals.some(i=>i.source==='axis'));
    const host=this.runtime.host,size=host._lastValidStageSize;
    if(!size||size[0]<=0||size[1]<=0)return nothing;
    const [width,height]=size;
    const project=(point:DimensionPoint):DimensionPoint=>{
      const p=host._framePercent(point,view);return[p[0]*width/100,p[1]*height/100];
    };
    const obstacles:DimensionBox[]=[];
    const nodes=new Set<string>();
    for(const carrier of dimensionCarriers(request.candidate))for(const point of [carrier.a,carrier.b]) {
      const key=point.join(',');if(nodes.has(key))continue;nodes.add(key);
      const p=project(point);obstacles.push({x:p[0]-8,y:p[1]-8,w:16,h:16});
    }
    if(request.kind==='resize')for(const room of request.candidate.rooms) {
      const poly=roomPoly(room);if(!poly)continue;
      for(let i=0;i<poly.length;i++) {
        const a:DimensionPoint=[poly[i][0]*NORM_W,poly[i][1]*NORM_W];
        const b:DimensionPoint=[poly[(i+1)%poly.length][0]*NORM_W,poly[(i+1)%poly.length][1]*NORM_W];
        if(Math.hypot(b[0]-a[0],b[1]-a[1])<GRID_PITCH)continue;
        const box=resizeHandleDimensionObstacle(a,b,project,view.w,width);if(box)obstacles.push(box);
      }
    }
    const selected=this.runtime.properties.dimensionTarget;
    if(selected) {
      const carrier=dimensionCarriers(request.candidate).find(c=>c.id===this.selected());
      if(carrier)for(const point of [carrier.a,carrier.b]) {
        const p=project(point);
        obstacles.push({x:p[0]-(selected.kind==='contour'?14:23),y:p[1]+(selected.kind==='contour'?-48:24),w:29,h:26});
      }
    }
    for(const label of host._resize.liveLabels||[])if(label.kind==='area') {
      const p=project([label.x,label.y]),x=p[0]+label.placement.offsetXPx,y=p[1]+label.placement.offsetYPx;
      const w=label.text.length*7.2+12;obstacles.push({x:x-w/2,y:y-10,w,h:20});
    }
    // Mirror the existing gear's screen footprint from cached scene inputs,
    // including its session-only moved position. No per-label DOM measurement.
    const space=host._spaceModel();
    if(space&&host._markup) {
      const iconPct=(host._config?.icon_size??2.5)>8?2.5:host._config?.icon_size??2.5;
      const h=Math.max(10,iconCqw(iconPct,space,view.w,1)*width/100*.77);
      const w=h*(.55+.35*.42+.76+Math.max(1,host._t('room.settings_short').length)*.66*.42);
      for(const room of space.rooms) {
        const poly=roomPoly(room);if(!poly)continue;
        const center=host._resize.dragging?this.runtime.roomGear.previewCenter(room,poly,space.id)
          :this.runtime.roomGear.center(room,poly,space.id);
        if(center) {const p=project([center[0],center[1]]);obstacles.push({x:p[0]-w/2,y:p[1]-h/2,w,h});}
      }
    }
    if(request.kind==='draw'&&host._cursorPt) {
      const p=project([host._cursorPt[0],host._cursorPt[1]]);obstacles.push({x:p[0]-9,y:p[1]-9,w:18,h:18});
    }
    const language=langOf(host.hass,host._config?.language);
    const items=layoutWallSideDimensions({intervals,width,height,project,obstacles,lanes:this.lanes,numbers:this.numbers,
      format:cm=>formatLength(cm,host._imperial,3),
      unavailable:propertiesT(language,'wall_dimension_unavailable'),
      textWidth:text=>[...text].reduce((sum,c)=>sum+(this.widths.get(c)??7),0)});
    return renderWallSideDimensions(items,width,height,dimensionListBox(items,width,height,obstacles),
      propertiesT(language,'wall_dimensions'),request.kind,spaceDisplayOf(request.candidate,host._serverCfg?.settings).color);
  }
  public get sourceFallback():boolean {
    const request=this.request();return !!request&&this.measurements(request).some(i=>i.source==='axis');
  }
  public get active():boolean {return !!this.request();}
  public retire():void {this.publishBasis(false);this.resetLayout();this.source=null;this.geometry.clear();this.drawNext=null;}
  public dispose():void {this.disposed=true;this.retire();}
}
