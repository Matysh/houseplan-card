/** Unapproved UI Lab proposal. Activated only by the local workbench bootstrap. */
import { html, nothing } from 'lit';
import { pointInPolygon, roomPoly } from './logic';
import { renderOpeningVisibleGeometry, openingVisibleMetrics, labWindowLeafLayout } from './render/opening-symbol';
import { selectControl } from './settings-select-control';
import { helpLabel, callout } from './editors/form-kit';
import './hp-help';
import { openingPropertiesCore, propertiesOpeningSides } from './editors/properties/physical';

export const labNativeEnabled = (): boolean => (globalThis as any).__hpNativePrototypes === true;
const KEY = 'houseplan-ui-lab:native-openings:1024:v1';
type Leaf = { manual?: string; contact: string; invert: boolean; hinge: string; side: string; shutters: boolean; shutterSource: string; shutterState: string; shutterContact: string; shutterInvert: boolean };
type State = { manualPosition?: string; windowSide?: string; leaves: Leaf[]; selected: string; movement: string; direction: string; _reduce?: number; _editing?: { index: number; leaf: Leaf } };
let saved: Record<string, State> | undefined;
const data = () => { if (!saved) { try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; } } return saved!; };
const key = (h: any, id: string) => `${h._space}:${id}`;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const freshLeaf = (d: any, i: number): Leaf => ({ manual: 'closed', contact: i < 2 ? d.contact || '' : '', invert: !!d.invert, hinge: (i === 1) !== !!d.flipH ? 'right' : 'left', side: d.flipV ? 'back' : 'front', shutters: false, shutterSource: 'manual', shutterState: 'open', shutterContact: '', shutterInvert: false });
const draft = (h: any, d: any): State => {
  const state:State=d._labOpening ||= copy(data()[key(h, d.id || '')] || { leaves: [freshLeaf(d, 0), freshLeaf(d, 1)], selected: 'all', movement: 'swing', direction: 'right' });
  if(d.type==='window') {
    state.windowSide ||= state.leaves[0]?.side || (d.flipV?'back':'front');
    state.leaves.forEach(leaf=>leaf.side=state.windowSide!);
    d.flipV=state.windowSide==='back';
  }
  return state;
};
const help = (text:string,label:string) => html`<hp-help instant .text=${text} .ariaLabel=${`Подсказка: ${label}`}></hp-help>`;
const bool = (label: string, value: boolean, change: (v: boolean) => void, id: string, tip = '') => html`<label class="hpf-check hpf-check-wrap srcrow"><input type="checkbox" data-field=${id} .checked=${value} @change=${(e: Event) => change((e.target as HTMLInputElement).checked)}><span>${helpLabel(label,tip?help(tip,label):nothing)}</span></label>`;
const field = (name: string, label: string, value: string, options: [string, string][], change: (v: string) => void) => html`<label>${label}</label>${selectControl({ name: `lab-${name}`, value, options: options.map(([value, label]) => ({ value, label })), onChange: change })}`;

/** Geometric room occupancy, independent of room names and window opening direction. */
export function labWindowHandleSides(h:any,o:any,wallCm=0):[boolean,boolean]|undefined {
  if(!labNativeEnabled() || o.type!=='window')return undefined;
  const angle=o.angle*Math.PI/180, offset=wallCm/h._cellCm*h._gridPitch/2+h._gridPitch*.1;
  const rooms=h._spaceModel()?.rooms || [];
  return [-1,1].map(sign=>rooms.some((room:any)=>{
    const poly=roomPoly(room);
    return poly && pointInPolygon([o.rx-Math.sin(angle)*offset*sign,o.ry+Math.cos(angle)*offset*sign],poly);
  })) as [boolean,boolean];
}

/** Same architectural symbol and screen orientation as the real plan; draft changes stay local. */
function leafPreview(h:any,d:any,s:State) {
  const edit=s._editing!;
  const leaves=s.leaves.map((leaf,i)=>i===edit.index?edit.leaf:leaf);
  const o=(h._openingsR||[]).find((o:any)=>o.id===d.id);
  const element=[...h.shadowRoot.querySelectorAll('[data-hp="opening"]')].find((el:any)=>el.dataset.id===d.id) as SVGGraphicsElement|undefined;
  const matrix=element?.getScreenCTM();
  const scale=matrix?Math.hypot(matrix.a,matrix.b):1;
  const radians=(d.angle+(h._rotation||0))*Math.PI/180;
  const m=matrix&&scale>0?[matrix.a/scale,matrix.b/scale,matrix.c/scale,matrix.d/scale]:[Math.cos(radians),Math.sin(radians),-Math.sin(radians),Math.cos(radians)];
  const length=d.lengthTouched||!o?h._cmToUnits(d.lengthCm):o.rlen;
  const face=o?h._openingFace(o,h._openingWallIndexFor(h._spaceModel(),h._openCuts()).value,!!d.flipV):{ox:0,oy:0,cm:0,side:-1};
  const spec={type:'window' as const,length,angle:d.angle,amount:0,flipH:!!d.flipH,flipV:!!d.flipV,
    labHandleSides:labWindowHandleSides(h,{type:'window',rx:o?.rx??d.x,ry:o?.ry??d.y,angle:d.angle},face.cm),
    base:'var(--secondary-text-color)',tone:'var(--secondary-text-color)',cellCm:h._cellCm,gridPitch:h._gridPitch,face,
    lab:{movement:'swing',direction:'right',previewSelected:edit.index,leaves:leaves.map(leaf=>({hinge:leaf.hinge,side:leaf.side,
      amount:openingPosition(h,leaf.contact,leaf.invert,leaf.manual)??0,active:false,sensorDriven:!!leaf.contact}))}};
  const {width,pitch}=labWindowLeafLayout(length,leaves.length);
  const half=length/2,jamb=openingVisibleMetrics(spec).jambHalf,pad=Math.max(length*.05,3);
  // Reserve each leaf's swing envelope so changing its position does not zoom the preview.
  const extent=Math.max(width,20/h._cellCm*h._gridPitch);
  const top=Math.max(jamb,...leaves.map(leaf=>leaf.side==='back'?0:extent));
  const bottom=Math.max(jamb,...leaves.map(leaf=>leaf.side==='back'?extent:0));
  const points=[[-half-pad,-top-pad],[half+pad,-top-pad],[half+pad,bottom+pad],[-half-pad,bottom+pad]]
    .map(([x,y])=>[m[0]*x+m[2]*y,m[1]*x+m[3]*y]);
  const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));
  const w=Math.max(...points.map(p=>p[0]))-x,height=Math.max(...points.map(p=>p[1]))-y;
  return html`<figure class="lab-window-preview" aria-label=${`Окно на плане: выделена створка ${edit.index+1}`}>
    <svg data-lab-window-preview viewBox=${`${x} ${y} ${w} ${height}`} role="img">
      <g data-lab-preview-orientation transform=${`matrix(${m.join(' ')} 0 0)`}>
        <rect data-lab-preview-highlight x=${-half+edit.index*pitch} y=${-jamb-pad*.25} width=${width} height=${2*jamb+pad*.5}
          fill="var(--primary-color)" fill-opacity=".16" stroke="var(--primary-color)" stroke-width="1.2" vector-effect="non-scaling-stroke"></rect>
        ${renderOpeningVisibleGeometry(spec)}
      </g>
    </svg>
    <figcaption>Створка ${edit.index+1} из ${leaves.length}</figcaption>
  </figure>`;
}

function leafDirectionOptions(h:any,d:any):[string,string][] {
  const space=h._curSpaceCfg,model=h._spaceModel();
  const opening=space?.openings?.find((o:any)=>o.id===d.id);
  const core=opening && openingPropertiesCore(opening,space.partitions||[],space.wall_segments||[],h._cellCm);
  const sides=core&&model?propertiesOpeningSides(core,model.rooms):null;
  const oneRoom=sides?.filter(side=>side.kind==='room').length===1 && sides?.some(side=>side.kind==='outside');
  return ['front','back'].map((value,i):[string,string]=>{
    const side=sides?.[i];
    return [value,side?.kind==='room' ? oneRoom ? 'Внутрь' : `В комнату «${side.name}»` : side?.kind==='outside' ? 'Наружу' : `К стороне ${i?'B':'A'}`];
  });
}

export function labOpeningFields(h: any, d: any) {
  if (!labNativeEnabled() || d.type === 'passage') return nothing;
  const s = draft(h, d);
  const update = () => h.requestUpdate();
  if (d.type !== 'window') return html`${field('movement', 'Тип движения', s.movement, [['swing', 'Распашной'], ['slide', 'Откатной']], v => { s.movement = v; update(); })}
    ${s.movement === 'slide' ? field('direction', 'Направление движения', s.direction, [['left', '← Вдоль стены к началу'], ['right', 'Вдоль стены к концу →']], v => { s.direction = v; update(); }) : nothing}`;
  const candidates: [string, string][] = [['', 'Не назначено'], ...(h._editorRuntime?._contactCandidates?.() || []).map((v: any) => [v.value, v.label])];
  const shadeCandidates: [string, string][] = [...candidates, ...Object.entries(h.hass?.states || {})
    .filter(([id]) => id.startsWith('cover.') && !candidates.some(c => c[0] === id))
    .map(([id, entity]: [string, any]): [string, string] => [id, entity.attributes?.friendly_name || id])];
  const sourceName = (id: string) => id ? h.hass?.states?.[id]?.attributes?.friendly_name || id : 'Вручную';
  const position = (contact: string, invert: boolean, manual = 'closed') => openingPosition(h, contact, invert, manual);
  const positionLabel = (v: number | null, feminine = false) => v === null ? 'Нет данных' : v === 0 ? (feminine ? 'Закрыта' : 'Закрыто') : v === 1 ? (feminine ? 'Открыта' : 'Открыто') : 'Частично открыто';
  const lightLabel = (l: Leaf) => !l.shutters ? 'Свет проходит' : position(l.shutterContact, l.shutterInvert, l.shutterState) === null ? 'Нет данных о шторах' : position(l.shutterContact, l.shutterInvert, l.shutterState) === 0 ? 'Свет перекрыт' : 'Свет проходит';
  const lightIcon = (l: Leaf) => !l.shutters || position(l.shutterContact, l.shutterInvert, l.shutterState)!==0 ? 'mdi:weather-sunny' : 'mdi:weather-sunny-off';
  const edit = s._editing;
  const l = edit?.leaf;
  const change = (k: keyof Leaf, v: any) => { if (l) { (l as any)[k] = v; update(); } };
  const helpText:Partial<Record<keyof Leaf,string>>={
    contact:'Датчик задаёт положение этой створки и имеет приоритет над ручным выбором. Чтобы задавать положение вручную, выберите «Не назначено». House Plan только читает состояние датчика.',
    invert:'Меняет трактовку состояния датчика на противоположную: открыто становится закрыто и наоборот. Включите, если положение на плане не совпадает с реальным.',
    manual:'Без датчика выберите, как показать створку на плане: открытой или закрытой. С датчиком поле показывает его состояние и недоступно для ручного выбора. Положение створки не влияет на прохождение света.',
    hinge:'«Слева» и «Справа» задают край с петлями. При варианте «Открывается вверх» открытая створка показана параллельно проёму с отступом 20 см и двумя тонкими наклонными линиями. Между ними показана голубая плоскость стекла. Ориентируйтесь на превью: текущая створка выделена цветом. Сторона открывания задаётся в свойствах всего окна.',
    shutters:'Включите, если у этой створки есть шторы, жалюзи или ставни. Их положение настраивается отдельно от створки: закрытые перекрывают свет, открытые пропускают. Сами шторы на плане не рисуются.',
    shutterContact:'Устройство задаёт положение штор, жалюзи или ставней и имеет приоритет над ручным выбором. Без привязки положение можно выбрать вручную. Команды устройству не отправляются.',
    shutterInvert:'Меняет трактовку состояния устройства штор на противоположную. Используйте, если оно сообщает «открыто», когда шторы закрыты, или наоборот. От этого зависит прохождение света.',
    shutterState:'Без устройства выберите положение вручную. С привязанным устройством поле показывает его состояние и недоступно для редактирования. Закрытые шторы перекрывают свет; открытые пропускают его независимо от положения створки.',
  };
  const choices = (k: keyof Leaf, label: string, list: [string, string][], disabled = false, actual?: string) => {
    const value = actual ?? String(l?.[k] ?? '');
    if (value && !list.some(([v]) => v === value)) list = [...list, [value, sourceName(value)]];
    return html`<div class="lab-leaf-field"><label><span>${label}</span>${help(helpText[k] || '',label)}</label>${selectControl({name:`lab-${k}`, value, disabled,
      options:list.map(([value,label])=>({value,label})), onChange:v=>change(k,v)})}</div>`;
  };
  const manualField = (shade = false) => {
    const id = shade ? l!.shutterContact : l!.contact;
    const value = position(id, shade ? l!.shutterInvert : l!.invert, shade ? l!.shutterState : l!.manual);
    const current = value === null ? 'unknown' : value > 0 && value < 1 ? 'partial' : value ? 'open' : 'closed';
    return html`${choices(shade ? 'shutterState' : 'manual', shade ? 'Положение штор' : 'Положение створки',
      [['closed','Закрыто'],['open','Открыто'], ...(current==='unknown' ? [['unknown','Нет данных'] as [string,string]] : []), ...(current==='partial' ? [['partial','Частично открыто'] as [string,string]] : [])], !!id, current)}
      ${id ? callout({className:'lab-leaf-source',text:
        `${value===null ? `Нет данных от «${sourceName(id)}»` : `Сейчас: ${positionLabel(value).toLowerCase()}. Источник: «${sourceName(id)}»`}.${(shade?l!.shutterInvert:l!.invert)?' Состояние инвертировано.':''} Ручной выбор недоступен, пока ${shade?'привязано устройство':'выбран датчик'}. Для ручного выбора установите «Не назначено» в поле ${shade?'устройства штор':'датчика открытия'}.`}) : nothing}`;
  };
  const remove = (index: number) => {
    if (s.leaves.length <= 1) return;
    const leaf = s.leaves[index];
    if (leaf.contact || leaf.shutters) { s._reduce = index; update(); }
    else { s.leaves.splice(index, 1); update(); }
  };
  return html`
    <style>
      .lab-leaves{margin-top:24px;border-top:1px solid var(--divider-color);padding-top:20px;}
      .lab-leaves-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
      .lab-leaves-head strong{font-size:16px;}
      .lab-leaf-add-help{display:inline-flex;}
      [data-lab-add-leaf]:disabled{pointer-events:none;}
      .lab-leaf-list{display:grid;gap:10px;}
      .lab-leaf-row{display:flex;align-items:center;gap:8px;min-width:0;}
      .lab-leaf-row .lab-leaf-open{display:flex!important;align-items:center;gap:12px;flex:1;min-width:0;text-align:left;justify-content:flex-start;padding:12px;min-height:64px;}
      .lab-leaf-copy{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;flex:1;}
      .lab-leaf-copy strong{font-size:14px;}
      .lab-leaf-copy small{font-size:12px;color:var(--secondary-text-color);font-weight:400;white-space:normal;line-height:1.4;}
      .lab-leaf-row ha-icon{flex:none;--mdc-icon-size:20px;}
      .lab-leaf-icon.btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;padding:0;flex:none;}
      .lab-window-preview{margin:0!important;padding:12px;display:grid;gap:8px;justify-items:center;background:var(--secondary-background-color);border-radius:var(--ha-card-border-radius,12px);}
      .lab-window-preview svg{display:block;width:100%;height:130px;max-width:360px;overflow:visible;pointer-events:none;}
      .lab-window-preview figcaption{font-size:12px;line-height:1.4;color:var(--secondary-text-color);}
      .lab-leaf-form{display:flex;flex-direction:column;gap:20px;}
      .lab-leaf-group{display:flex;flex-direction:column;gap:16px;}
      .lab-leaf-group + .lab-leaf-group{border-top:1px solid var(--divider-color);padding-top:20px;}
      .lab-leaf-field{display:grid;gap:8px;min-width:0;}
      .lab-leaf-field > label{margin:0!important;display:flex;align-items:center;gap:4px;}
      .lab-leaf-form .hpf-label-tail{white-space:nowrap;}
      .lab-leaf-form .hpf-label-tail hp-help{margin-inline-start:4px;}
      .lab-leaf-source{margin:0!important;}
      .lab-leaf-form .hpf-check{margin:0!important;}
      .lab-leaf-hint{margin:0!important;}
      .lab-leaf-status{display:flex;align-items:center;gap:8px;color:var(--secondary-text-color);font-size:13px;}
      .lab-leaf-limit{font-size:12px;color:var(--secondary-text-color);margin:10px 0 0;}
    </style>
    ${!edit ? html`${field('window-side','Открывание',s.windowSide!,leafDirectionOptions(h,d),v=>{
      s.windowSide=v;s.leaves.forEach(leaf=>leaf.side=v);d.flipV=v==='back';update();
    })}<section class="lab-leaves" data-lab-leaves>
      <div class="lab-leaves-head"><strong>Створки</strong><span class="lab-leaf-add-help" data-hp-tooltip=${s.leaves.length >= 4 ? 'У окна может быть не больше четырёх створок' : 'Добавить створку'}>
        <button class="btn ghost hpf-action-icon lab-leaf-icon" type="button" data-lab-add-leaf aria-label="Добавить створку" ?disabled=${s.leaves.length >= 4}
          @click=${()=>{if(s.leaves.length<4){s.leaves.push(freshLeaf({...d,contact:'',invert:false},s.leaves.length));update();}}}><ha-icon icon="mdi:plus"></ha-icon></button></span></div>
      <div class="lab-leaf-list">${s.leaves.map((leaf,i)=>html`<div class="lab-leaf-row">
        <button type="button" class="btn ghost hpf-action-option lab-leaf-open" data-lab-edit-leaf=${i} @click=${()=>{s._editing={index:i,leaf:copy(leaf)};update();}}>
          <ha-icon icon=${position(leaf.contact,leaf.invert,leaf.manual) ? 'mdi:window-open-variant' : 'mdi:window-closed-variant'}></ha-icon>
          <span class="lab-leaf-copy"><strong>Створка ${i+1}</strong><small>${positionLabel(position(leaf.contact,leaf.invert,leaf.manual),true)} · ${sourceName(leaf.contact)}</small></span>
          ${leaf.shutters ? html`<ha-icon icon=${lightIcon(leaf)} title=${lightLabel(leaf)}></ha-icon>` : nothing}
          <ha-icon icon="mdi:chevron-right"></ha-icon>
        </button>
        <button type="button" class="btn ghost hpf-action-icon lab-leaf-icon" data-lab-remove-leaf=${i} aria-label=${`Удалить створку ${i+1}`} title="Удалить створку" ?disabled=${s.leaves.length<=1} @click=${()=>remove(i)}><ha-icon icon="mdi:minus"></ha-icon></button>
      </div>`)}</div>
      ${s.leaves.length===4 ? html`<p class="lab-leaf-limit">У окна может быть не больше четырёх створок.</p>` : nothing}
    </section>` : nothing}
    ${edit && l ? html`<div class="lab-leaf-form" data-kind="window-leaf">
        ${leafPreview(h,d,s)}
        <div class="lab-leaf-group">
          ${choices('contact','Датчик открытия',candidates)}
          ${l.contact ? bool('Инвертировать состояние',l.invert,v=>change('invert',v),'lab-invert',helpText.invert) : nothing}
          ${manualField()}
          ${choices('hinge','Петли',[['left','Слева'],['right','Справа'],['top','Открывается вверх']])}
        </div>
        <div class="lab-leaf-group">
          ${bool('Есть шторы, жалюзи или ставни',l.shutters,v=>change('shutters',v),'lab-shutters',helpText.shutters)}
          ${l.shutters ? html`${choices('shutterContact','Устройство штор, жалюзи или ставней',shadeCandidates)}
            ${l.shutterContact ? bool('Инвертировать состояние',l.shutterInvert,v=>change('shutterInvert',v),'lab-shutterInvert',helpText.shutterInvert) : nothing}
            ${manualField(true)}
            <div class="lab-leaf-status"><ha-icon icon=${lightIcon(l)}></ha-icon><span>${lightLabel(l)}</span></div>
            <div class="rhint lab-leaf-hint">Закрытые шторы перекрывают свет через эту створку. Положение самого окна влияет только на его изображение.</div>` : nothing}
        </div>
      </div>` : nothing}
    ${s._reduce!==undefined ? html`<hp-dialog alert form-shell settings-layout compact class="ui-dialog" .hass=${h.hass} title="Удалить створку?" @hp-close=${(e:Event)=>{e.stopPropagation();delete s._reduce;update();}}>
      <div class="body">Настройки и привязки створки ${s._reduce+1} будут удалены. Остальные створки сохранят свои настройки.</div>
      <div class="row dialog-action-footer" slot="footer"><button class="btn ghost" @click=${()=>{delete s._reduce;update();}}>Отмена</button><button class="btn danger" @click=${()=>{s.leaves.splice(s._reduce!,1);delete s._reduce;update();}}>Удалить</button></div>
    </hp-dialog>` : nothing}`;
}

/** Manual position belongs to the opening, and never overrides a bound sensor. */
export function labManualOpeningField(h:any,d:any) {
  if(!labNativeEnabled() || !['door','gate'].includes(d.type))return nothing;
  const s=draft(h,d);
  const value=openingPosition(h,d.contact,!!d.invert,s.manualPosition || 'open');
  const current=value===null?'unknown':value>0&&value<1?'partial':value?'open':'closed';
  const options=[{value:'open',label:'Открыто'},{value:'closed',label:'Закрыто'}];
  if(current==='unknown')options.push({value:'unknown',label:'Нет данных'});
  if(current==='partial')options.push({value:'partial',label:'Частично открыто'});
  return html`<label>Положение</label>${selectControl({name:'lab-opening-position',value:current,disabled:!!d.contact,options,
    onChange:v=>{s.manualPosition=v;h.requestUpdate();}})}
    ${d.contact ? html`<div class="rhint">Положение задаёт датчик открытия. Чтобы выбрать его вручную, уберите привязку.</div>` : nothing}`;
}

export function labManualOpeningAmount(h:any,o:any):number|undefined {
  if(!labNativeEnabled() || !['door','gate'].includes(o.type) || o.contact)return undefined;
  return data()[key(h,o.id)]?.manualPosition==='closed'?0:1;
}

export function labCloseLeaf(h:any, commit=false):boolean {
  const s=h._openingDialog?._labOpening;
  if(!labNativeEnabled()||!s?._editing)return false;
  if(commit)s.leaves[s._editing.index]=copy(s._editing.leaf);
  delete s._editing;h.requestUpdate();return true;
}

/** Local visual source: never sends commands to HA and never falls back from a missing bound source. */
function openingPosition(h:any, contact:string, invert:boolean, manual='closed'):number|null {
  if(!contact)return manual==='open'?1:0;
  const entity=h.hass?.states?.[contact],state=entity?.state;
  if(!entity||state==='unknown'||state==='unavailable')return null;
  let value:number;
  if(contact.startsWith('cover.') && Number.isFinite(entity.attributes?.current_position))value=Math.max(0,Math.min(1,entity.attributes.current_position/100));
  else if(['on','open'].includes(state))value=1;
  else if(['off','closed'].includes(state))value=0;
  else return null;
  return invert ? 1-value : value;
}

export function labSaveOpening(h: any, d: any, opening: any) {
  if (!labNativeEnabled() || !d._labOpening) return;
  data()[key(h, opening.id)] = copy(d._labOpening);
  delete data()[key(h, opening.id)]._reduce;
  delete data()[key(h, opening.id)]._editing;
  localStorage.setItem(KEY, JSON.stringify(data()));
  h._cfgEpoch++;
  h._sunRaysCache = null; h._isoSunCache = null; h._lightBarrierPool?.clear();
  (globalThis as any).__hpLabOpeningRevision = ((globalThis as any).__hpLabOpeningRevision || 0) + 1;
}
export function labSliding(d: any): boolean { return labNativeEnabled() && d._labOpening?.movement === 'slide'; }

export function labOpeningVisual(h: any, o: any): any {
  if (!labNativeEnabled()) return undefined;
  const s = data()[key(h, o.id)]; if (!s) return undefined;
  return { movement: s.movement, direction: s.direction, leaves: s.leaves.map(l => {
    const value = openingPosition(h,l.contact,l.invert,l.manual);
    return { hinge:l.hinge, side:s.windowSide || s.leaves[0]?.side || (o.flip_v?'back':'front'), amount:value??0, active:value!==null, sensorDriven:!!l.contact, light:l.shutters ? openingPosition(h,l.shutterContact,l.shutterInvert,l.shutterState) : undefined };
  }) };
}
export function labShutterSegments(h: any): { a: number[]; b: number[] }[] {
  if (!labNativeEnabled()) return [];
  return (h._openingsR || []).flatMap((o: any) => {
    const s = data()[key(h, o.id)]; if (o.type !== 'window' || !s) return [];
    const rad = o.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), len = o.rlen / s.leaves.length;
    return s.leaves.flatMap((l, i) => {
      const closed = openingPosition(h,l.shutterContact,l.shutterInvert,l.shutterState) === 0;
      if (!l.shutters || !closed) return [];
      const start = -o.rlen / 2 + i * len, end = start + len;
      return [{ a: [o.rx + ux * start, o.ry + uy * start], b: [o.rx + ux * end, o.ry + uy * end] }];
    });
  });
}
export function labSolarWindows(h: any, windows: any[]): any[] {
  if (!labNativeEnabled()) return windows;
  return windows.flatMap(w => {
    const s = data()[key(h, w.id)]; if (!s) return [w];
    const rad = w.angle * Math.PI / 180, len = w.length / s.leaves.length;
    const blocked = s.leaves.map(l => {
      return l.shutters && openingPosition(h,l.shutterContact,l.shutterInvert,l.shutterState) === 0;
    });
    if (!blocked.some(Boolean)) return [w];
    const result: any[] = [];
    for (let i = 0; i < blocked.length;) {
      if (blocked[i]) { i++; continue; }
      const start = i; while (i < blocked.length && !blocked[i]) i++;
      const offset = -w.length / 2 + (start + i) / 2 * len;
      result.push({ ...w, id: `${w.id}:leaf:${start}`, x: w.x + Math.cos(rad) * offset, y: w.y + Math.sin(rad) * offset, length: (i - start) * len });
    }
    return result;
  });
}
