globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="14f25e2af003b885a21dcf773abf5174187147da3127df89c33bff15d84f7309";import{d5 as e,c as t,A as i,a as o,b as n,d6 as s}from"./houseplan-card-DXme09zR.js";function r(e){const t=e.visualViewport;return t&&Number.isFinite(t.width)&&Number.isFinite(t.height)?{left:Number(t.offsetLeft)||0,top:Number(t.offsetTop)||0,width:Math.max(0,Number(t.width)||0),height:Math.max(0,Number(t.height)||0)}:{left:0,top:0,width:e.innerWidth,height:e.innerHeight}}function a(e,t,i,o=7,n=8){const s=i.left+n,r=i.top+n,a=Math.max(s,i.left+i.width-n),l=Math.max(r,i.top+i.height-n),h=Math.max(0,a-s),c=Math.max(0,l-r),d=Math.min(Math.max(0,t.width),h),u=Math.min(Math.max(0,t.height),c);let p=e.left;p+d>a&&(p=e.right-d),p=Math.min(Math.max(s,p),Math.max(s,a-d));const _=e.bottom+o,g=e.top-o-u;let m="bottom",f=_;return _+u>l&&g>=r?(m="top",f=Math.min(Math.max(r,g),Math.max(r,l-u))):f=Math.min(Math.max(r,_),Math.max(r,l-u)),{left:Math.round(p),top:Math.round(f),side:m,maxWidth:Math.round(h),maxHeight:Math.round(c)}}class l{constructor(e,t,i){this.owner=e,this.name=t,this.keydown=i,this.host=null,this.root=null}window(){return this.owner.ownerDocument.defaultView}dialog(){return this.owner.closest("hp-dialog")}usesPopover(e=!1){const t=this.window();return!e&&!!t&&function(e){const t=e.HTMLElement?.prototype;return"function"==typeof t?.showPopover&&"function"==typeof t?.hidePopover}(t)}get hasFallback(){return!!this.host}containsPath(e){return e.includes(this.owner)||!!this.host&&e.includes(this.host)}ownsActiveElement(){let e=this.owner.ownerDocument.activeElement;for(;e?.shadowRoot?.activeElement;)e=e.shadowRoot.activeElement;return!(!e||e!==this.owner&&!this.owner.shadowRoot?.contains(e)&&!this.root?.contains(e))}renderFallback(i,o){const n=this.ensureFallback();return n?(e(t`<style>${o}</style>${i}`,n),n):null}surface(e,t){return t?this.owner.shadowRoot?.querySelector(e)||null:this.root?.querySelector(e)||null}destroy(){this.root&&e(i,this.root),this.host?.remove(),this.host=null,this.root=null}ensureFallback(){if(this.root?.isConnected)return this.root;const e=this.dialog()?.overlayPortal()||this.owner.ownerDocument.body;if(!e)return null;const t=this.owner.ownerDocument.createElement("div");return t.dataset.hpOverlay=this.name,t.style.display="contents",this.keydown&&t.addEventListener("keydown",this.keydown,!0),e.append(t),this.host=t,this.root=t.attachShadow({mode:"open"}),this.root}}let h=0;class c extends n{constructor(){super(...arguments),this.text="",this.ariaLabel="",this.pointerHover=!1,this._open=!1,this._openTimer=0,this._closeTimer=0,this._positionRaf=0,this._forceFallback=!1,this._hoverOwned=!1,this._overlayDispose=null,this._scrollDialog=null,this._descriptionId="hp-help-description-"+ ++h,this._surfacePointerEnter=()=>{const e=this._window();this._closeTimer&&e?.clearTimeout(this._closeTimer),this._closeTimer=0},this._surfacePointerLeave=()=>{this._scheduleClose()},this._outsidePointerDown=e=>{if(!this._open)return;const t=e.composedPath();this._floating.containsPath(t)||this._closeHelp(!1,"outside")},this._dialogScroll=e=>{const t=this._floating.containsPath(e.composedPath()),i=e.target,o=this._dialog(),n=i instanceof Node&&(i===o||i instanceof Element&&i.contains(this));var s;this._open&&(s=n,!t&&s)&&this._closeHelp(!1,"scroll")},this._keyDown=e=>{if(!this._open||e.defaultPrevented)return;if("Escape"===e.key)return e.preventDefault(),e.stopImmediatePropagation(),void this._closeHelp(this._floating.ownsActiveElement(),"escape");const t=this.renderRoot.querySelector(".trigger");if(!t||!e.composedPath().includes(t))return;const i=this._surface();if(!i||i.scrollHeight<=i.clientHeight)return;const o=Math.max(40,.8*i.clientHeight),n={ArrowDown:40,ArrowUp:-40,PageDown:o,PageUp:-o};if("Home"===e.key)i.scrollTop=0;else if("End"===e.key)i.scrollTop=i.scrollHeight;else{if(!(e.key in n))return;i.scrollBy({top:n[e.key],behavior:"auto"})}e.preventDefault(),e.stopImmediatePropagation()},this._floating=new l(this,"help",this._keyDown),this._queuePosition=()=>{if(!this._open||this._positionRaf)return;const e=this._window();e&&(this._positionRaf=e.requestAnimationFrame(()=>{this._positionRaf=0,this._position()||this._closeHelp()}))}}connectedCallback(){super.connectedCallback(),this.addEventListener("keydown",this._keyDown,!0)}willUpdate(){this.toggleAttribute("data-has-content",this._hasContent())}disconnectedCallback(){const e=this.ownerDocument.defaultView;this._unsubscribeOpenListeners(),this.removeEventListener("keydown",this._keyDown,!0),this._clearTimers(),this._positionRaf&&e?.cancelAnimationFrame(this._positionRaf),this._positionRaf=0,this._closeHelp(!1,"disconnect"),super.disconnectedCallback()}updated(e){if(e.has("pointerHover")&&!this.pointerHover){const e=this._window();this._openTimer&&e?.clearTimeout(this._openTimer),this._openTimer=0,this._hoverOwned&&this._closeHelp(!1,"outside")}this._hasContent()||!this._open?this._open&&e.has("text")&&(this._usesPopover()||this._renderFallback(),this._queuePosition()):this._closeHelp()}_window(){return this._floating.window()}_dialog(){return this._floating.dialog()}_usesPopover(){return this._floating.usesPopover(this._forceFallback)}_hasContent(){return e=this.text,t=this.ariaLabel,"string"==typeof e&&e.trim().length>0&&"string"==typeof t&&t.trim().length>0;var e,t}_clearTimers(){const e=this._window();this._openTimer&&e?.clearTimeout(this._openTimer),this._closeTimer&&e?.clearTimeout(this._closeTimer),this._openTimer=0,this._closeTimer=0}_scheduleOpen(){const e=this._window();this.pointerHover&&e&&!this._open&&!this._openTimer&&(this._closeTimer&&e.clearTimeout(this._closeTimer),this._closeTimer=0,this._openTimer=e.setTimeout(()=>{this._openTimer=0,this.isConnected&&(this._hoverOwned=!0,this._openHelp())},300))}_scheduleClose(){const e=this._window(),t=this.renderRoot.querySelector(".trigger");e&&!t?.matches(":focus-visible")&&(this._openTimer&&e.clearTimeout(this._openTimer),this._closeTimer&&e.clearTimeout(this._closeTimer),this._openTimer=0,this._closeTimer=e.setTimeout(()=>{this._closeTimer=0,this.isConnected&&this._closeHelp()},150))}_triggerPointerEnter(e){this.pointerHover&&"mouse"===e.pointerType&&this._scheduleOpen()}_triggerPointerLeave(e){"mouse"===e.pointerType&&this._scheduleClose()}_triggerFocus(){queueMicrotask(()=>{const e=this.renderRoot.querySelector(".trigger");e?.matches(":focus-visible")&&(this._hoverOwned=!1,this._openHelp())})}_triggerBlur(){this._scheduleClose()}_triggerClick(){this._open?this._closeHelp():(this._hoverOwned=!1,this._openHelp())}_subscribeOpenListeners(){this.ownerDocument.addEventListener("pointerdown",this._outsidePointerDown,!0),this.ownerDocument.addEventListener("keydown",this._keyDown,!0);const e=this._window();e?.addEventListener("resize",this._queuePosition),e?.addEventListener("orientationchange",this._queuePosition),e?.visualViewport?.addEventListener("resize",this._queuePosition),e?.visualViewport?.addEventListener("scroll",this._queuePosition),this._scrollDialog=this._dialog(),this._scrollDialog?.addEventListener("scroll",this._dialogScroll,!0)}_unsubscribeOpenListeners(){this.ownerDocument.removeEventListener("pointerdown",this._outsidePointerDown,!0),this.ownerDocument.removeEventListener("keydown",this._keyDown,!0);const e=this._window();e?.removeEventListener("resize",this._queuePosition),e?.removeEventListener("orientationchange",this._queuePosition),e?.visualViewport?.removeEventListener("resize",this._queuePosition),e?.visualViewport?.removeEventListener("scroll",this._queuePosition),this._scrollDialog?.removeEventListener("scroll",this._dialogScroll,!0),this._scrollDialog=null}async _openHelp(){!this._open&&this._hasContent()&&(this._clearTimers(),this._forceFallback=!1,this._open=!0,this._subscribeOpenListeners(),await this.updateComplete,this._open&&(this._usesPopover()||this._renderFallback(),this._position()?this._overlayDispose=this._dialog()?.registerOverlay({owner:this,group:"transient",close:e=>this._closeHelp("escape"===e&&this._floating.ownsActiveElement(),e)})||null:this._closeHelp()))}_closeHelp(e=!1,t="exclusive"){if(!this._open&&!this._floating.hasFallback)return;this._clearTimers();const i=this._overlayDispose;this._overlayDispose=null,i?.();const o=this.renderRoot.querySelector(".tooltip");if(o?.hidePopover)try{o.matches(":popover-open")&&o.hidePopover()}catch{}this._open=!1,this._hoverOwned=!1,this._unsubscribeOpenListeners(),this._floating.destroy(),e&&this.updateComplete.then(()=>this.renderRoot.querySelector(".trigger")?.focus())}_tooltipTemplate(e){return t`<div class="tooltip" data-side="bottom" popover=${e?"manual":i}
      role="tooltip" aria-hidden="true" tabindex="-1"
      @pointerenter=${this._surfacePointerEnter} @pointerleave=${this._surfacePointerLeave}>${this.text}</div>`}_renderFallback(){const e=c.styles.cssText;this._floating.renderFallback(this._tooltipTemplate(!1),e)}_surface(){return this._floating.surface(".tooltip",this._usesPopover())}_position(){if(!this._open)return!1;const e=this._window(),t=this.renderRoot.querySelector(".trigger");let i=this._surface();if(!e||!t?.isConnected||!i?.isConnected)return!1;const o=r(e);if(i.style.maxWidth=`${Math.max(0,Math.min(320,o.width-16))}px`,i.style.maxHeight=`${Math.max(0,o.height-16)}px`,i.style.visibility="hidden",this._usesPopover()&&i.showPopover)try{i.matches(":popover-open")||i.showPopover()}catch{if(this._forceFallback=!0,this._renderFallback(),i=this._surface(),!i?.isConnected)return!1;i.style.visibility="hidden"}const n=t.getBoundingClientRect(),s=i.getBoundingClientRect();if(!(n.width&&n.height&&s.width&&s.height))return!1;const l=a(n,s,o);return i.style.left=`${l.left}px`,i.style.top=`${l.top}px`,i.dataset.side=l.side,i.style.visibility="",!0}render(){if(!this._hasContent())return i;const e=this.ariaLabel.trim();return t`
      <span id=${this._descriptionId} class="sr-only" role="tooltip"
        aria-hidden=${this._open?"false":"true"}>${this.text}</span>
      <button class="trigger" type="button" aria-label=${e}
        aria-describedby=${this._open?this._descriptionId:i}
        aria-expanded=${this._open?"true":"false"}
        @pointerenter=${this._triggerPointerEnter} @pointerleave=${this._triggerPointerLeave}
        @focus=${this._triggerFocus} @blur=${this._triggerBlur} @click=${this._triggerClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d=${s}></path>
        </svg>
      </button>
      ${this._usesPopover()?this._tooltipTemplate(!0):i}
    `}}function d(e,t){return{id:e,title:t,plan_url:null,view_box:[0,0,1,1],rooms:[],wall_segments:[]}}function u(e="file"){const t="draw"===e;return{source:e,showBorders:t,showNames:t,displayTouched:!1}}function p(e,t){if(e.displayTouched)return{...e,source:t};const i="draw"===t;return{...e,source:t,showBorders:i,showNames:i}}function _(e,t,i){return{...e,[t]:i,displayTouched:!0}}function g(e,t,i){const o=(e?.spaces||[]).find(e=>e?.id===i),n=new Set((o?.rooms||[]).map(e=>String(e?.id||"")).filter(Boolean)),s=[...new Set((e?.markers||[]).filter(e=>!0!==e?.removed&&"string"==typeof e?.id).filter(e=>e.space===i||"string"==typeof e.room_id&&n.has(e.room_id)||t?.[e.id]?.s===i).map(e=>e.id))].sort((e,t)=>e.localeCompare(t));return{markerIds:s,count:s.length}}c.properties={text:{type:String},ariaLabel:{type:String,attribute:"aria-label"},pointerHover:{type:Boolean,attribute:"data-pointer-hover",reflect:!0},_open:{state:!0},_forceFallback:{state:!0}},c.styles=o`
    :host {
      display: none;
      flex: none;
      vertical-align: middle;
    }

    :host([data-has-content]) {
      display: inline-flex;
    }

    .trigger {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      box-sizing: border-box;
      padding: 0;
      color: var(--secondary-text-color, #9aa4ad);
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: help;
      -webkit-tap-highlight-color: transparent;
    }

    .trigger svg {
      display: block;
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    :host([data-pointer-hover]) .trigger:hover,
    .trigger:focus-visible,
    .trigger[aria-expanded='true'] {
      color: var(--primary-text-color, #fff);
      background: rgb(127 127 127 / 0.18);
      outline: none;
    }

    .trigger:focus-visible {
      box-shadow: 0 0 0 2px var(--primary-color, #03a9f4);
    }

    .tooltip {
      position: fixed;
      z-index: 2147483647;
      inset: auto;
      top: 0;
      left: 0;
      width: max-content;
      max-width: min(320px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      margin: 0;
      box-sizing: border-box;
      padding: 9px 11px;
      overflow: auto;
      color: var(--primary-text-color, #fff);
      background: var(--card-background-color, #202126);
      border: 1px solid var(--divider-color, rgb(255 255 255 / 0.2));
      border-radius: 9px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.32);
      font: 400 13px/1.4 system-ui, sans-serif;
      text-align: start;
      white-space: normal;
      overflow-wrap: anywhere;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 120ms ease, transform 120ms ease;
    }

    .tooltip[data-side='top'] {
      transform-origin: bottom center;
    }

    .tooltip[data-side='bottom'] {
      transform-origin: top center;
    }

    .tooltip[popover]:not(:popover-open) {
      display: none;
    }

    @starting-style {
      .tooltip {
        opacity: 0;
        transform: translateY(3px);
      }
    }

    .sr-only {
      /* Keep the accessibility-only description outside every dialog scroll
         container's overflow geometry. Toggling the hidden attribute on the former
         absolutely-positioned node made some browsers add a vertical
         scrollbar while help was open, even though the visible tooltip was
         already in the Popover top layer / fixed fallback portal. */
      position: fixed;
      inset: 0 auto auto 0;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    @media (pointer: coarse) {
      .trigger {
        width: 40px;
        height: 40px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tooltip {
        transition: none;
      }
    }
  `,customElements.get("hp-help")||customElements.define("hp-help",c);const m=1e6,f=()=>({kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null}),w=(e,t,i)=>{if(!Number.isInteger(e)||!Number.isInteger(t)||e<=0||t<=0||e>m||t>m)return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null};const o=e*t*4;return{kind:Math.max(e,t)>16384?"hard":o>134217728?"warn":"safe",width:e,height:t,alpha:i,decodedBytes:o}},b=(e,t)=>(e[t]<<24|e[t+1]<<16|e[t+2]<<8|e[t+3])>>>0,y=(e,t)=>e[t]<<8|e[t+1],v=(e,t)=>e[t]|e[t+1]<<8|e[t+2]<<16,k=(e,t)=>e[t]|e[t+1]<<8,x=(e,t,i)=>{for(let o=0;o<i.length;o++)if(e[t+o]!==i.charCodeAt(o))return!1;return!0};function T(e,t){try{return"png"===t?function(e){if(e.length<33||2303741511!==b(e,0)||218765834!==b(e,4))return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null};if(!x(e,12,"IHDR"))return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null};const t=b(e,16),i=b(e,20),o=e[25];let n=4===o||6===o;if(!n){let t=33;for(let i=0;i<64&&t+8<=e.length;i++){const i=b(e,t);if(x(e,t+4,"tRNS")){n=!0;break}if(x(e,t+4,"IDAT")||x(e,t+4,"IEND"))break;if(i>e.length)break;t+=12+i}}return w(t,i,n)}(e):"jpg"===t?function(e){if(e.length<4||255!==e[0]||216!==e[1])return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null};let t=2;for(let i=0;i<256&&t+4<=e.length;i++){if(255!==e[t]){t++;continue}const i=e[t+1];if(216===i||i>=208&&i<=217){t+=2;continue}if(i>=192&&i<=207&&196!==i&&200!==i&&204!==i)return t+9>e.length?f():w(y(e,t+7),y(e,t+5),!1);if(218===i)return f();const o=y(e,t+2);if(o<2)return f();t+=2+o}return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null}}(e):"webp"===t?function(e){if(e.length<30||!x(e,0,"RIFF")||!x(e,8,"WEBP"))return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null};if(x(e,12,"VP8X")){const t=!!(16&e[20]);return w(v(e,24)+1,v(e,27)+1,t)}if(x(e,12,"VP8 "))return 157!==e[23]||1!==e[24]||42!==e[25]?{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null}:w(16383&k(e,26),16383&k(e,28),!1);if(x(e,12,"VP8L")){if(47!==e[20])return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null};const t=e[21]|e[22]<<8|e[23]<<16|e[24]<<24;return w(1+(16383&t),1+(t>>14&16383),1==(t>>28&1))}return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null}}(e):{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null}}catch{return{kind:"unknown",width:null,height:null,alpha:!1,decodedBytes:null}}}const P={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"};function E(e){return new Promise((t,i)=>{const o=new FileReader;o.onerror=()=>i(o.error||new Error("read failed")),o.onload=()=>{const e=String(o.result||""),n=e.indexOf(",");n<0?i(new Error("unexpected data url")):t(e.slice(n+1))},o.readAsDataURL(e)})}async function L(e,t=1.414){const i=URL.createObjectURL(e);try{return await new Promise(e=>{const o=new Image;o.onload=()=>e(o.naturalWidth&&o.naturalHeight?o.naturalWidth/o.naturalHeight:t),o.onerror=()=>e(t),o.src=i})}finally{URL.revokeObjectURL(i)}}async function M(e,t,i){const[o,n]=await Promise.all([E(e),L(e)]);return{ext:t,b64:o,aspect:n,name:i}}async function $(e){const t=function(e){return P[e.type]||(e.name.toLowerCase().endsWith(".svg")?"svg":"")}(e);if(!t)return{kind:"reject"};if("svg"===t)return{kind:"pass",ext:t};const i=T(new Uint8Array(await e.arrayBuffer()),t);return"safe"===i.kind?{kind:"pass",ext:t}:{kind:"guard",state:{file:e,ext:t,probe:i,busy:!1}}}async function D(e){const t=createImageBitmap(e.file,{imageOrientation:"from-image"}),i=await Promise.race([t,new Promise((e,t)=>{setTimeout(()=>t(new Error("decode timeout")),globalThis.__HP_BACKDROP_TIMEOUT_MS??1e4)})]);try{const{width:t,height:o}=function(e,t,i=4096){const o=Math.min(1,i/Math.max(e,t));return{width:Math.max(1,Math.round(e*o)),height:Math.max(1,Math.round(t*o))}}(i.width,i.height,4096),n=e.probe.alpha,s=n?"image/png":"image/jpeg";let r;if("function"==typeof OffscreenCanvas){const e=new OffscreenCanvas(t,o),n=e.getContext("2d");if(!n)throw new Error("no 2d context");n.drawImage(i,0,0,t,o),r=await e.convertToBlob({type:s,quality:.9})}else{const e=document.createElement("canvas");e.width=t,e.height=o;const n=e.getContext("2d");if(!n)throw new Error("no 2d context");n.drawImage(i,0,0,t,o),r=await new Promise((t,i)=>{e.toBlob(e=>e?t(e):i(new Error("encode failed")),s,.9)})}const a=n?"png":"jpg";return{blob:r,ext:a,name:`${e.file.name.replace(/\.[^.]+$/,"")||"plan"}-reduced.${a}`}}finally{i.close()}}const H=e=>(e/1048576).toFixed(e>=10485760?0:1);function C(e,i,o,n){const s=e._backdropGuard;if(!s)return null;const{probe:r}=s,a="hard"===r.kind,l=a?e._t("backdrop.too_large_body",{w:r.width??0,h:r.height??0,limit:16384}):"unknown"===r.kind?e._t("backdrop.unknown_body"):e._t("backdrop.large_body",{w:r.width??0,h:r.height??0,fileMb:H(s.file.size),decodedMb:H(r.decodedBytes??0)}),h=()=>{e._backdropGuard?.busy||o()},c=()=>e._backdropGuard?.file===s.file;return t`<hp-dialog .hass=${n}
      .title=${e._t(a?"backdrop.too_large_title":"backdrop.large_title")}
      icon="mdi:image-size-select-large" dismiss-on-scrim @hp-close=${()=>h()}>
    <div class="body"><p>${l}</p></div>
    <div class="row" slot="footer">
      <button class="btn ghost" ?disabled=${s.busy} @click=${()=>h()}>
        ${e._t("btn.cancel")}</button>
      <span class="spacer"></span>
      ${a?null:t`
        <button class="btn ghost" ?disabled=${s.busy} @click=${()=>(async()=>{if(e._backdropGuard?.busy)return;const t=await M(s.file,s.ext,s.file.name);c()&&(i(t),o())})()}>
          ${e._t("backdrop.keep_original")}</button>
        <button class="btn on" ?disabled=${s.busy} @click=${()=>(async()=>{if(!e._backdropGuard?.busy){e._backdropGuard={...s,busy:!0},e.requestUpdate?.();try{const e=await D(s),t=await M(e.blob,e.ext,e.name);if(!c())return;i(t),o()}catch{if(!c())return;o(),e._showToast(e._t("backdrop.downscale_failed"))}}})()}>
          ${s.busy?e._t("backdrop.reducing"):e._t("backdrop.use_downscaled")}
        </button>`}
    </div>
  </hp-dialog>`}export{l as F,d as a,g as b,$ as c,M as e,r as f,u as i,a as p,C as r,p as s,_ as t};
