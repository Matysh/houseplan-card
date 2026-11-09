/** House Plan owns MDI selection and paint; HA is optional for custom icon sets. */
import { LitElement, html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { FloatingSurfaceController } from '../floating-surface-controller';
import { floatingViewport, placeFloatingSurface } from '../floating-surface';
import { floatingSurfaceCss } from '../styles/floating-surface.styles';
import { selectionListCss } from '../styles/selection-list.styles';
import { textFieldsCss, CARD_DIALOG_FORM_KIT } from '../styles/form-kit.styles';
import { settingsActionTransition } from '../styles/settings-action.styles';
import { controlMotion, controlMotionReduced, controlSurfaceFrames } from '../ui-motion';
import { controlReducedMotionCss } from '../styles/ui-motion.styles';

interface PickerLabels { search:string; clear:string; use:string; loading:string; error:string; retry:string; refine:string; }
let catalogRetry = 0;
let catalogPromise: Promise<ReadonlyMap<string,string>> | undefined;
function loadCatalog(): Promise<ReadonlyMap<string,string>> {
  if (catalogPromise) return catalogPromise;
  const attempt = catalogRetry++;
  return catalogPromise ||= (attempt === 0 ? import('../mdi-icon-catalog')
    : import(new URL('__HOUSEPLAN_MDI_CATALOG_RETRY_ASSET__?retry=' + attempt, import.meta.url).href))
    .then(m => m.mdiCatalog as ReadonlyMap<string,string>).catch(error => {
    catalogPromise = undefined; throw error;
  });
}
let sequence = 0;
export class HpIconPicker extends LitElement {
  static properties = {
    value:{type:String}, autoIcon:{type:String}, label:{type:String}, labels:{attribute:false},
    _open:{state:true}, _query:{state:true}, _active:{state:true}, _catalog:{state:true}, _failed:{state:true},
  };
  value = '';
  autoIcon = '';
  label = '';
  labels!: PickerLabels;
  private _open = false;
  private _query = '';
  private _active = 0;
  private _catalog?: ReadonlyMap<string,string>;
  private _failed = false;
  private readonly uid = 'hp-icons-' + ++sequence;
  private readonly floating = new FloatingSurfaceController(this, 'icon-picker', e => this.keydown(e));
  private fallback = false;
  private dispose?: () => void;
  private motion?: Animation;
  private closeTimer?: number;
  static styles = unsafeCSS(
    floatingSurfaceCss('.menu','7px') + selectionListCss('[role=option]','[aria-selected=true]','.active')
    + textFieldsCss(CARD_DIALOG_FORM_KIT,'input') + `
    :host { display:block; min-width:0; font:inherit; }
    * { box-sizing:border-box; }
    .field { position:relative; display:flex; align-items:center; width:100%; height:44px; overflow:hidden;
      border:1px solid var(--hpf-line,var(--divider-color,#7776)); border-radius:8px;
      background:var(--hpf-control-surface,var(--hpf-canvas,var(--secondary-background-color,#282930)));
      color:var(--primary-text-color,#e6e7eb); }
    button { color:inherit; font:inherit; border:0; background:transparent; cursor:pointer; }
    .trigger { display:flex; align-items:center; gap:14px; flex:1; min-width:0; height:42px;
      padding:0 14px; text-align:start; scroll-margin-block:2px; }
    .trigger span { padding-inline-end:24px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .clear { margin-inline-end:34px; width:42px; height:42px; flex:none; padding:9px; }
    svg,ha-icon { display:block; width:24px; height:24px; flex:none; fill:currentColor; --mdc-icon-size:24px; }
    .arrow { position:absolute; inset-inline-end:14px; width:18px; height:18px; pointer-events:none; }
    .field:focus-within { border-color:var(--hpf-accent,var(--primary-color)); box-shadow:inset 0 0 0 1px var(--hpf-accent,var(--primary-color)); }
    button:focus-visible,[role=option].active { outline:2px solid var(--hpf-accent,var(--primary-color)); outline-offset:-3px; }
    .menu { position:fixed; inset:auto; margin:0; padding:5px; z-index:10000; width:320px;
      max-width:calc(100vw - 16px); max-height:360px; overflow:hidden; font:inherit; opacity:0; }
    .menu:popover-open,.menu:not([popover]) { display:flex; flex-direction:column; }
    .menu.visible { opacity:1; }
    .menu:not(.visible) { pointer-events:none; }
    input { flex:none; display:block; border-radius:8px; margin-bottom:5px; }
    .list { min-height:0; flex:1 1 auto; overflow:auto; overscroll-behavior:contain; max-height:240px; }
    [role=option] { display:flex; align-items:center; gap:14px; min-height:44px; padding:10px 12px;
      border-radius:6px; cursor:pointer; overflow-wrap:anywhere; }
    [role=option] span { min-width:0; flex:1; }
    .status { flex:none; padding:8px 12px; color:var(--secondary-text-color); font-size:13px; }
    .retry { min-height:44px; padding:10px 12px; text-decoration:underline; }
    @media(hover:hover) { .field:hover { border-color:var(--hpf-accent,var(--primary-color)); } .clear:hover { background:var(--hpf-tint); } }
    @media(max-width:550px) { .field,input { font-size:16px; } }
    .field,button,[role=option] { ` + settingsActionTransition + ' }'
    + controlReducedMotionCss('.field,button,.menu,[role=option]'));
  connectedCallback(): void { super.connectedCallback(); void this.load(); }
  disconnectedCallback(): void { this.close(false,true); super.disconnectedCallback(); }
  private async load(): Promise<void> {
    this._failed = false;
    try { const catalog = await loadCatalog(); if (this.isConnected) this._catalog = catalog; }
    catch { if (this.isConnected) this._failed = true; }
  }
  private get effective(): string { return this.value || this.autoIcon; }
  private get options(): string[] {
    const query = this._query.trim().toLowerCase();
    const words = query.replace(/^mdi:/,'').split(/\s+/).filter(Boolean);
    const names = this._catalog ? Array.from(this._catalog.keys()).filter(name => words.every(w => name.includes(w))).slice(0,60) : [];
    const exact=this._query.trim();
    if (/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(exact)) {
      const index=names.indexOf(exact); if(index>=0)names.splice(index,1);
      names.unshift(exact);
    }
    return names;
  }
  private glyph(name: string): TemplateResult {
    const path = this._catalog?.get(name);
    return path ? html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d=${path}></path></svg>`
      : name && !name.startsWith('mdi:') ? html`<ha-icon aria-hidden="true" icon=${name}></ha-icon>`
      : html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3m0 4 6.5 12h-13L12 7Z"></path></svg>`;
  }
  private surface(): HTMLElement | null { return this.floating.surface('.menu',!this.fallback); }
  private menu(popover: boolean): TemplateResult {
    const options = this.options;
    return html`<div class="menu" popover=${popover?'manual':nothing} @keydown=${(e:KeyboardEvent)=>this.keydown(e)}>
      <input type="search" role="combobox" autocomplete="off" spellcheck="false" aria-label=${this.labels.search}
        aria-expanded="true" aria-controls=${this.uid} aria-autocomplete="list"
        aria-activedescendant=${options.length ? this.uid+'-'+this._active : nothing}
        placeholder=${this.labels.search} .value=${this._query} @input=${(e:Event)=>{
          this._query=(e.target as HTMLInputElement).value; this._active=0;
        }} />
      <div class="list" role="listbox" id=${this.uid} aria-label=${this.label}>
        ${options.map((name,i)=>html`<div role="option" id=${this.uid+'-'+i} data-icon=${name}
          class=${this._active===i?'active':''} aria-selected=${String(name===this.effective)}
          @pointerdown=${(e:PointerEvent)=>e.preventDefault()} @click=${()=>this.choose(name)}>
          ${this.glyph(name)}<span>${this._catalog?.has(name)?name:this.labels.use+' '+name}</span>
          ${name===this.effective?html`<b aria-hidden="true">✓</b>`:nothing}</div>`)}
      </div>
      <div class="status" role="status">${this._failed?this.labels.error:!this._catalog?this.labels.loading:options.length>=60?this.labels.refine:options.length?nothing:this.labels.refine}</div>
      ${this._failed?html`<button class="retry" type="button" @click=${()=>void this.load()}>${this.labels.retry}</button>`:nothing}
    </div>`;
  }
  protected updated(_changed:PropertyValues): void {
    if (this._open && this.fallback) { this.floating.renderFallback(this.menu(false),HpIconPicker.styles.cssText); this.surface()?.classList.add('visible'); }
    if (this._open) this.position();
  }
  private position = (): void => {
    const win=this.floating.window(), anchor=this.renderRoot.querySelector('.field'), surface=this.surface();
    if (!win||!anchor||!surface) return;
    const viewport=floatingViewport(win), bounds=anchor.getBoundingClientRect(); this.floating.recordAnchor(bounds);
    surface.style.width=Math.min(Math.max(bounds.width,280),viewport.width-16)+'px';
    surface.style.maxHeight=Math.min(360,viewport.height-16)+'px';
    const place=placeFloatingSurface(bounds,surface.getBoundingClientRect(),viewport);
    surface.style.left=place.left+'px'; surface.style.top=place.top+'px';
  };
  private outside = (e:PointerEvent): void => { if(!this.floating.containsPath(e.composedPath())) this.close(); };
  private tabAway = (e:KeyboardEvent):void => {
    if(this._open && e.key==='Tab' && this.floating.containsPath(e.composedPath()))this.close(true);
  };
  private focusout = ():void => { queueMicrotask(()=>{if(this._open&&!this.floating.ownsActiveElement())this.close();}); };
  private dismissScroll = (e:Event):void => {
    if(this.floating.containsPath(e.composedPath()))return;
    const bounds=this.renderRoot.querySelector('.field')?.getBoundingClientRect();
    if(bounds&&this.floating.anchorMoved(bounds))this.close();
  };
  private async open():Promise<void> {
    if(this._open)return;
    const win=this.floating.window(); if(!win)return;
    this.close(false,true); this._open=true; this._query=''; this._active=0;
    this.fallback=!this.floating.usesPopover();
    if(this._failed)void this.load();
    await this.updateComplete; if(!this._open)return;
    if(!this.fallback)try{this.surface()?.showPopover();}catch{this.fallback=true;}
    if(this.fallback)this.floating.renderFallback(this.menu(false),HpIconPicker.styles.cssText);
    const surface=this.surface(); if(surface)surface.inert=false;
    this.position();
    this.dispose=this.floating.dialog()?.registerOverlay({owner:this,group:'transient',close:reason=>this.close(reason==='escape')});
    this.ownerDocument.addEventListener('keydown',this.tabAway,true);
    this.ownerDocument.addEventListener('pointerdown',this.outside,true);
    this.ownerDocument.addEventListener('focusout',this.focusout);
    this.floating.dialog()?.addEventListener('scroll',this.dismissScroll,true);
    win.addEventListener('resize',this.position);win.visualViewport?.addEventListener('resize',this.position);win.visualViewport?.addEventListener('scroll',this.position);
    surface?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
    surface?.classList.add('visible');
    if(surface&&!controlMotionReduced(win))this.motion=surface.animate(controlSurfaceFrames(true),{...controlMotion.appear,fill:'both'});
  }
  private close(refocus=false,immediate=false):void {
    this._open=false; this.dispose?.();this.dispose=undefined;
    const win=this.floating.window();
    this.ownerDocument.removeEventListener('keydown',this.tabAway,true);
    this.ownerDocument.removeEventListener('pointerdown',this.outside,true);this.ownerDocument.removeEventListener('focusout',this.focusout);
    this.floating.dialog()?.removeEventListener('scroll',this.dismissScroll,true);
    win?.removeEventListener('resize',this.position);win?.visualViewport?.removeEventListener('resize',this.position);win?.visualViewport?.removeEventListener('scroll',this.position);
    if(this.closeTimer)win?.clearTimeout(this.closeTimer); this.closeTimer=undefined;
    const surface=this.surface();this.motion?.cancel();this.motion=undefined;
    const finish=()=>{try{surface?.hidePopover();}catch{}this.floating.destroy();this.closeTimer=undefined;this.motion?.cancel();this.motion=undefined;};
    surface?.classList.remove('visible');if(surface)surface.inert=true;
    if(immediate||!win||controlMotionReduced(win))finish();
    else {this.motion=surface?.animate(controlSurfaceFrames(false),{...controlMotion.leave,fill:'both'});this.closeTimer=win.setTimeout(finish,controlMotion.leave.duration);}
    if(refocus)this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus({preventScroll:true});
  }
  private choose(value:string):void {
    this.value=value;this.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true,composed:true}));this.close(true);
  }
  private keydown(e:KeyboardEvent):void {
    if(e.defaultPrevented||e.isComposing)return;
    if(!this._open){if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();void this.open();}return;}
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close(true);return;}
    if(e.key==='Tab'){this.close(true);return;}
    const options=this.options;
    if(e.key==='Enter'){e.preventDefault();if(options[this._active])this.choose(options[this._active]);return;}
    if(!['ArrowDown','ArrowUp'].includes(e.key))return;
    e.preventDefault();this._active=options.length?(this._active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length:0;
    void this.updateComplete.then(()=>this.surface()?.querySelector('#'+this.uid+'-'+this._active)?.scrollIntoView({block:'nearest'}));
  }
  render():TemplateResult {
    return html`<div class="field"><button class="trigger" type="button" aria-label=${this.label+': '+this.effective}
      aria-haspopup="listbox" aria-expanded=${String(this._open)} aria-controls=${this.uid}
      @keydown=${(e:KeyboardEvent)=>this.keydown(e)} @click=${()=>this._open?this.close(true):void this.open()}>
      ${this.glyph(this.effective)}<span>${this.effective||'mdi:…'}</span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5z"></path></svg></button>
      ${this.value?html`<button class="clear" type="button" aria-label=${this.labels.clear} @click=${()=>this.choose('')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z"></path></svg></button>`:nothing}</div>
      ${!this.fallback?this.menu(true):nothing}`;
  }
}
if(typeof customElements!=='undefined'&&!customElements.get('hp-icon-picker'))customElements.define('hp-icon-picker',HpIconPicker);
