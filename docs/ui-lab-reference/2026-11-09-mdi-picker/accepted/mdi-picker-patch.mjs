// Pending UI Lab proposal for #1375; not yet accepted or journaled.
export const assetPath='/assets/houseplan-assets/houseplan-editor-runtime-B1c0Vfmk.js';
export function patchPicker(source){
  const changes=[
    ['.arrow { position:absolute; inset-inline-end:14px; width:18px; height:18px; pointer-events:none; }','.arrow { position:absolute; inset-inline-end:14px; width:18px; height:18px; pointer-events:none; transform:rotate(0deg); transition:transform var(--hpf-paint-duration,160ms) var(--hpf-paint-easing,ease); } .trigger[aria-expanded=true] .arrow { transform:rotate(180deg); } @media(prefers-reduced-motion:reduce) { .arrow { transition:none; } }'],
    ['<div class="status" role="status">${this._failed?this.labels.error:this._catalog?i.length>=60?this.labels.refine:i.length?e:this.labels.refine:this.labels.loading}</div>','${this._failed||!this._catalog?s`<div class="status" role="status">${this._failed?this.labels.error:this.labels.loading}</div>`:e}'],
    ['autoIcon:t.icon||""','autoIcon:this.host._autoIconForBinding(t.bindingKind==="virtual"?"virtual":t.bindingKind+":"+t.bindingRef)'],
    ['.field { position:relative; display:flex;','.field { cursor:pointer; position:relative; display:flex;'],
    ['.clear { margin-inline-end:34px; width:42px; height:42px; flex:none; padding:9px; }','.clear { display:inline-flex; align-items:center; justify-content:center; margin-inline-end:34px; width:40px; height:40px; flex:none; padding:0; border-radius:50%; }'],
    ['m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z','M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12Z'],
    ['.field:focus-within { border-color:var(--hpf-accent,var(--primary-color)); box-shadow:inset 0 0 0 1px var(--hpf-accent,var(--primary-color)); }','.field:focus-within { border-color:var(--hpf-accent,var(--primary-color)); box-shadow:none; }'],
    ['button:focus-visible,[role=option].active { outline:2px solid var(--hpf-accent,var(--primary-color)); outline-offset:-3px; }','.clear:focus-visible,[role=option].active { outline:2px solid var(--hpf-accent,var(--primary-color)); outline-offset:-3px; } .trigger:focus-visible { outline:none; }'],
    ['@media(hover:hover) { .field:hover { border-color:var(--hpf-accent,var(--primary-color)); } .clear:hover { background:var(--hpf-tint); } }','@media(hover:hover) and (pointer:fine) { .field:hover { border-color:var(--hpf-accent,var(--primary-color,#03a9f4)); background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 10%,var(--card-background-color,#202126))); } .clear:hover { background:rgb(127 127 127 / .16); } }'],
  ];
  for(const [before,after] of changes){
    if(source.split(before).length!==2)throw Error('MDI prototype anchor mismatch: '+before);
    source=source.replace(before,after);
  }
  const start=source.indexOf('class ip extends a{'),end=source.indexOf('ip.properties=',start);
  if(start<0||end<0)throw Error('Picker class not found');
  let picker=source.slice(start,end);
  if(picker.split('this._active=0').length!==4)throw Error('Unexpected picker active initializers');
  picker=picker.replaceAll('this._active=0','this._active=-1');
  const keys=[
    ['aria-activedescendant=${i.length?','aria-activedescendant=${i.length&&this._active>=0?'],
    ['void(e[this._active]&&this.choose(e[this._active]))','void(e[Math.max(0,this._active)]&&this.choose(e[Math.max(0,this._active)]))'],
    ['this._active=e.length?(this._active+("ArrowDown"===t.key?1:-1)+e.length)%e.length:0','this._active=e.length?(this._active<0?("ArrowDown"===t.key?0:e.length-1):(this._active+("ArrowDown"===t.key?1:-1)+e.length)%e.length):-1'],
  ];
  for(const [before,after] of keys){if(picker.split(before).length!==2)throw Error('Picker key anchor mismatch: '+before);picker=picker.replace(before,after);}
  return source.slice(0,start)+picker+source.slice(end);
}
