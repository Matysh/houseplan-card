// Pending UI Lab prototype: cover the plan below its persistent header.
export const sheetPatch = {
  path: '/assets/houseplan-assets/context-menu-B8pl442y.js',
  before: 'place(){const e=this.model,t=this.element;if(!e||!t)return;',
  after: `place(){const e=this.model,t=this.element;if(!e||!t)return;
    if(e.hp==='header-actions-menu'){
      const head=e.trigger?.closest('.head');
      const host=t.getRootNode().host;
      if(head&&host){
        const h=head.getBoundingClientRect(),b=host.getBoundingClientRect(),v=window.visualViewport;
        const vx=v?.offsetLeft||0,vy=v?.offsetTop||0;
        const left=Math.max(vx,b.left),right=Math.min(vx+(v?.width||innerWidth),b.right);
        const top=Math.max(vy,h.bottom),bottom=Math.min(vy+(v?.height||innerHeight),b.bottom);
        Object.assign(t.style,{position:'fixed',left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:'auto',minWidth:'0',maxWidth:'none',maxHeight:Math.max(0,bottom-top)+'px',boxSizing:'border-box',overflowY:'auto',overscrollBehavior:'contain',display:'flex',flexDirection:'column',borderRadius:'0',boxShadow:'none',margin:'0',padding:'0'});
        for(const button of t.children)button.style.flexShrink='0';
        return;
      }
    }`
};

export const triggerPatch = {
  before: '.hdr[data-panel-flow] .header-actions-trigger:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px;}',
  after: `.hdr[data-panel-flow] .head>button.header-actions-trigger[aria-expanded='true']:not(:hover){background:transparent;color:var(--primary-text-color);border-color:var(--primary-color);box-shadow:none;outline:none;filter:none;}
    .hdr[data-panel-flow] .head>button.header-actions-trigger[aria-expanded='false']:not(:hover){background:transparent;color:var(--primary-text-color);border-color:var(--divider-color);box-shadow:none;outline:none;filter:none;transition:none;}
    .hdr[data-panel-flow] .head>button.header-actions-trigger:not(:disabled):hover{background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 10%,transparent));color:var(--hpf-accent,var(--primary-color,#03a9f4));border-color:var(--hpf-accent,var(--primary-color,#03a9f4));box-shadow:0 0 0 1px var(--hpf-tint-line,var(--primary-color,#03a9f4));filter:brightness(1.08);outline:none;}
    .hdr[data-panel-flow='5']>.head>button.panel-menu{display:inline-flex;order:-1;flex:0 0 44px;width:44px;height:44px;}
    .hdr .head>button.panel-menu:not(:disabled):is(:hover,:active,:focus-visible){background:var(--ha-color-fill-neutral-quiet-hover,color-mix(in srgb,var(--primary-text-color) 10%,transparent));color:var(--primary-text-color);border-color:transparent;box-shadow:none;outline:none;filter:none;}
    .hdr .head>button.panel-menu{position:relative;transition:background 160ms ease;}
    .hdr .head>button.panel-menu>ha-icon{opacity:1;transition:opacity 160ms ease;pointer-events:none;}
    .hdr .head>button.panel-menu>svg.hp-lab-menu-open{display:block;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:24px;height:24px;fill:currentColor;pointer-events:none;opacity:0;transition:opacity 160ms ease;}
    :host([data-lab-sidebar-open]) .hdr .head>button.panel-menu>ha-icon{opacity:0;}
    :host([data-lab-sidebar-open]) .hdr .head>button.panel-menu>svg.hp-lab-menu-open{opacity:1;}
    @media(prefers-reduced-motion:reduce){.hdr .head>button.panel-menu,.hdr .head>button.panel-menu>ha-icon,.hdr .head>button.panel-menu>svg.hp-lab-menu-open{transition:none!important;}}
    .hpf-context-menu[data-hp='header-actions-menu']>button[data-action='summary-toggle']{font-weight:inherit;}
    .hpf-context-menu[data-hp='header-actions-menu']>button[data-action='summary-toggle']:not(:hover):not(:focus-visible){color:var(--primary-text-color);}
    .stage>.zoomwrap{user-select:none;-webkit-user-select:none;}
    .stage>.zoomwrap :is(input,textarea,[contenteditable]:not([contenteditable='false'])){user-select:text;-webkit-user-select:text;}
    .hdr[data-panel-flow='5'] .editbar-end{flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;padding:10px 8px;}
    .hdr[data-panel-flow='5'] .editbar-end>.btn{flex:0 0 40px;width:40px;min-width:40px;height:40px;min-height:40px;padding:0;}
    .hdr[data-panel-flow='5'] .editbar-end>.barclose{order:-1;}`
};

export const menuIconPatch = {
  before: '<ha-icon icon="mdi:menu"></ha-icon></button>',
  after: '<ha-icon icon="mdi:menu"></ha-icon><svg class="hp-lab-menu-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M21,15.61L19.59,17L14.58,12L19.59,7L21,8.39L17.44,12L21,15.61M3,6H16V8H3V6M3,13V11H13V13H3M3,18V16H16V18H3Z"></path></svg></button>'
};

const motionPatches = [
  ['this.animation=e.animate(n(!0),s.appear)', `this.animation=e.animate(this.model?.hp==='header-actions-menu'?[{clipPath:'inset(0 0 100% 0)',opacity:1,translate:'0 0'},{clipPath:'inset(0 0 0% 0)',opacity:1,translate:'0 0'}]:n(!0),this.model?.hp==='header-actions-menu'?s.disclosure:s.appear)`],
  ['l={opacity:o.opacity,translate:o.translate}', 'l={opacity:o.opacity,translate:o.translate,clipPath:o.clipPath}'],
  ['t.animate(n(!1,l),{...s.leave,fill:"both"})', `t.animate(this.model?.hp==='header-actions-menu'?[{clipPath:l.clipPath==='none'?'inset(0 0 0% 0)':l.clipPath,opacity:1,translate:'0 0'},{clipPath:'inset(0 0 100% 0)',opacity:1,translate:'0 0'}]:n(!1,l),{...(this.model?.hp==='header-actions-menu'?s.disclosure:s.leave),fill:'both'})`]
];
export function applySheetMotion(source) {
  for (const [before,after] of motionPatches) {
    if(source.split(before).length!==2) throw Error('Header sheet animation prototype no longer matches the dev bundle');
    source=source.replace(before,after);
  }
  return source;
}
