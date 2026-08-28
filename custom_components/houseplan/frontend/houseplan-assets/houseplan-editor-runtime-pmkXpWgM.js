globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="8e6599b6df97336743ce3679c5cb470f3fbdd7f9938031e18c183aafbc1bc99d";import{e as t,i as e,E as s,D as i,b as o,A as a,a as n,c as r,s as l,m as h,d as c,l as d,t as p,w as _,f as u,g as m,v as g,r as f,h as b,j as y,p as v,k as $,n as w,o as k,q as x,u as S,x as M,y as D,z as C,B as P,G as I,C as T,F as R,H as F,I as N,J as z,K as A,L as O,M as L,N as E,O as B,P as H,Q as G,R as W,S as j,T as q,U,V as K,W as V,X as J,Y,Z as X,_ as Z,$ as Q,a0 as tt,a1 as et,a2 as st,a3 as it,a4 as ot,a5 as at,a6 as nt,a7 as rt,a8 as lt,a9 as ht,aa as ct,ab as dt,ac as pt,ad as _t,ae as ut,af as mt,ag as gt,ah as ft,ai as bt,aj as yt,ak as vt,al as $t,am as wt,an as kt,ao as xt,ap as St,aq as Mt,ar as Dt,as as Ct,at as Pt,au as It,av as Tt,aw as Rt,ax as Ft,ay as Nt,az as zt,aA as At,aB as Ot,aC as Lt,aD as Et,aE as Bt,aF as Ht,aG as Gt,aH as Wt,aI as jt,aJ as qt,aK as Ut,aL as Kt,aM as Vt,aN as Jt,aO as Yt,aP as Xt,aQ as Zt,aR as Qt,aS as te,aT as ee,aU as se,aV as ie,aW as oe,aX as ae,aY as ne,aZ as re,a_ as le,a$ as he,b0 as ce,b1 as de,b2 as pe,b3 as _e,b4 as ue,b5 as me,b6 as ge,b7 as fe,b8 as be,b9 as ye,ba as ve,bb as $e,bc as we,bd as ke,be as xe,bf as Se,bg as Me,bh as De,bi as Ce,bj as Pe,bk as Ie,bl as Te,bm as Re,bn as Fe,bo as Ne,bp as ze,bq as Ae,br as Oe,bs as Le,bt as Ee,bu as Be,bv as He,bw as Ge,bx as We,by as je,bz as qe,bA as Ue,bB as Ke,bC as Ve,bD as Je,bE as Ye,bF as Xe,bG as Ze,bH as Qe,bI as ts,bJ as es,bK as ss,bL as is,bM as os,bN as as,bO as ns,bP as rs,bQ as ls,bR as hs,bS as cs,bT as ds,bU as ps,bV as _s,bW as us,bX as ms,bY as gs,bZ as fs,b_ as bs,b$ as ys,c0 as vs,c1 as $s,c2 as ws,c3 as ks,c4 as xs,c5 as Ss,c6 as Ms,c7 as Ds,c8 as Cs,c9 as Ps,ca as Is,cb as Ts,cc as Rs,cd as Fs,ce as Ns,cf as zs,cg as As,ch as Os,ci as Ls,cj as Es,ck as Bs,cl as Hs,cm as Gs,cn as Ws,co as js,cp as qs,cq as Us,cr as Ks,cs as Vs,ct as Js,cu as Ys,cv as Xs,cw as Zs,cx as Qs,cy as ti,cz as ei,cA as si,cB as ii,cC as oi,cD as ai,cE as ni,cF as ri,cG as li,cH as hi,cI as ci,cJ as di,cK as pi,cL as _i,cM as ui,cN as mi,cO as gi,cP as fi,cQ as bi,cR as yi,cS as vi,cT as $i,cU as wi,cV as ki,cW as xi,cX as Si,cY as Mi,cZ as Di,c_ as Ci,c$ as Pi,d0 as Ii,d1 as Ti}from"./houseplan-card-Dkqrn1Gf.js";import{i as Ri,c as Fi,a as Ni,s as zi,t as Ai}from"./space-deletion-CxhzkCZ-.js";const Oi={},Li=t(class extends e{constructor(){super(...arguments),this.ot=Oi}render(t,e){return e()}update(t,[e,i]){if(Array.isArray(e)){if(Array.isArray(this.ot)&&this.ot.length===e.length&&e.every((t,e)=>t===this.ot[e]))return s}else if(this.ot===e)return s;return this.ot=Array.isArray(e)?Array.from(e):e,this.render(e,i)}}),Ei=(t,e,s)=>Math.min(s,Math.max(e,Number.isFinite(t)?t:e));function Bi(t){return Number.isFinite(t)?(t%360+360)%360:0}function Hi(t){if("string"!=typeof t)return null;const e=t.trim().replace(/^#/,""),s=/^[0-9a-fA-F]{3}$/.test(e)?e.split("").map(t=>`${t}${t}`).join(""):e;return/^[0-9a-fA-F]{6}$/.test(s)?`#${s.toLowerCase()}`:null}function Gi(t){const e=Hi(t);return e?{r:Number.parseInt(e.slice(1,3),16),g:Number.parseInt(e.slice(3,5),16),b:Number.parseInt(e.slice(5,7),16)}:null}function Wi(t){const e=Ei(t.r,0,255)/255,s=Ei(t.g,0,255)/255,i=Ei(t.b,0,255)/255,o=Math.max(e,s,i),a=o-Math.min(e,s,i);let n=0;return a>0&&(n=o===e?(s-i)/a%6*60:o===s?60*((i-e)/a+2):60*((e-s)/a+4)),{h:Bi(n),s:0===o?0:a/o*100,v:100*o}}function ji(t){return function(t){const e=t=>Math.round(Ei(t,0,255)).toString(16).padStart(2,"0");return`#${e(t.r)}${e(t.g)}${e(t.b)}`}(function(t){const e=Bi(t.h),s=Ei(t.s,0,100)/100,i=Ei(t.v,0,100)/100,o=i*s,a=o*(1-Math.abs(e/60%2-1)),n=i-o;let r;return r=e<60?[o,a,0]:e<120?[a,o,0]:e<180?[0,o,a]:e<240?[0,a,o]:e<300?[a,0,o]:[o,0,a],{r:Math.round(255*(r[0]+n)),g:Math.round(255*(r[1]+n)),b:Math.round(255*(r[2]+n))}}(t))}function qi(t){const e=t.visualViewport;return e&&Number.isFinite(e.width)&&Number.isFinite(e.height)?{left:Number(e.offsetLeft)||0,top:Number(e.offsetTop)||0,width:Math.max(0,Number(e.width)||0),height:Math.max(0,Number(e.height)||0)}:{left:0,top:0,width:t.innerWidth,height:t.innerHeight}}function Ui(t,e,s,i=7,o=8){const a=s.left+o,n=s.top+o,r=Math.max(a,s.left+s.width-o),l=Math.max(n,s.top+s.height-o),h=Math.max(0,r-a),c=Math.max(0,l-n),d=Math.min(Math.max(0,e.width),h),p=Math.min(Math.max(0,e.height),c);let _=t.left;_+d>r&&(_=t.right-d),_=Math.min(Math.max(a,_),Math.max(a,r-d));const u=t.bottom+i,m=t.top-i-p;let g="bottom",f=u;return u+p>l&&m>=n?(g="top",f=Math.min(Math.max(n,m),Math.max(n,l-p))):f=Math.min(Math.max(n,u),Math.max(n,l-p)),{left:Math.round(_),top:Math.round(f),side:g,maxWidth:Math.round(h),maxHeight:Math.round(c)}}class Ki{constructor(t,e,s){this.owner=t,this.name=e,this.keydown=s,this.host=null,this.root=null}window(){return this.owner.ownerDocument.defaultView}dialog(){return this.owner.closest("hp-dialog")}usesPopover(t=!1){const e=this.window();return!t&&!!e&&function(t){const e=t.HTMLElement?.prototype;return"function"==typeof e?.showPopover&&"function"==typeof e?.hidePopover}(e)}get hasFallback(){return!!this.host}containsPath(t){return t.includes(this.owner)||!!this.host&&t.includes(this.host)}ownsActiveElement(){let t=this.owner.ownerDocument.activeElement;for(;t?.shadowRoot?.activeElement;)t=t.shadowRoot.activeElement;return!(!t||t!==this.owner&&!this.owner.shadowRoot?.contains(t)&&!this.root?.contains(t))}renderFallback(t,e){const s=this.ensureFallback();return s?(i(o`<style>${e}</style>${t}`,s),s):null}surface(t,e){return e?this.owner.shadowRoot?.querySelector(t)||null:this.root?.querySelector(t)||null}destroy(){this.root&&i(a,this.root),this.host?.remove(),this.host=null,this.root=null}ensureFallback(){if(this.root?.isConnected)return this.root;const t=this.dialog()?.overlayPortal()||this.owner.ownerDocument.body;if(!t)return null;const e=this.owner.ownerDocument.createElement("div");return e.dataset.hpOverlay=this.name,e.style.display="contents",this.keydown&&e.addEventListener("keydown",this.keydown,!0),t.append(e),this.host=e,this.root=e.attachShadow({mode:"open"}),this.root}}const Vi={title:"Color picker",hue:"Hue",saturation:"Saturation",value:"Brightness",hex:"Hex color",invalidHex:"Enter a 3- or 6-digit hex color"};class Ji extends r{constructor(){super(...arguments),this.label="",this.opacityLabel="Opacity",this.color="#607d8b",this.opacity=1,this.disabled=!1,this.showOpacity=!0,this.pickerLabels=Vi,this._open=!1,this._pickerRaf=0,this._emitRaf=0,this._forceFallback=!1,this._overlayDispose=null,this._hue=0,this._saturation=0,this._value=0,this._hexDraft="#607d8b",this._hexInvalid=!1,this._lastValidColor="#607d8b",this._activePointerId=null,this._outsidePointerDown=t=>{if(!this._open)return;const e=t.composedPath();this._floating.containsPath(e)||this._closePicker(!1,"outside")},this._keyDown=t=>{this._open&&"Escape"===t.key&&(t.preventDefault(),t.stopImmediatePropagation(),this._closePicker(this._floating.ownsActiveElement(),"escape"))},this._floating=new Ki(this,"color-opacity",this._keyDown),this._queuePickerPosition=()=>{if(!this._open)return;this._pickerRaf&&cancelAnimationFrame(this._pickerRaf);const t=this._window();t&&(this._pickerRaf=t.requestAnimationFrame(()=>{this._pickerRaf=0,this._positionPicker()||this._closePicker()}))}}connectedCallback(){super.connectedCallback(),this._syncFromColor(this.color,!1),this.ownerDocument.addEventListener("pointerdown",this._outsidePointerDown,!0),this.ownerDocument.addEventListener("scroll",this._queuePickerPosition,!0);const t=this.ownerDocument.defaultView;t?.addEventListener("resize",this._queuePickerPosition),t?.addEventListener("orientationchange",this._queuePickerPosition),t?.visualViewport?.addEventListener("resize",this._queuePickerPosition),t?.visualViewport?.addEventListener("scroll",this._queuePickerPosition),this.addEventListener("keydown",this._keyDown,!0)}disconnectedCallback(){this.ownerDocument.removeEventListener("pointerdown",this._outsidePointerDown,!0),this.ownerDocument.removeEventListener("scroll",this._queuePickerPosition,!0);const t=this.ownerDocument.defaultView;t?.removeEventListener("resize",this._queuePickerPosition),t?.removeEventListener("orientationchange",this._queuePickerPosition),t?.visualViewport?.removeEventListener("resize",this._queuePickerPosition),t?.visualViewport?.removeEventListener("scroll",this._queuePickerPosition),this.removeEventListener("keydown",this._keyDown,!0),this._pickerRaf&&cancelAnimationFrame(this._pickerRaf),this._emitRaf&&cancelAnimationFrame(this._emitRaf),this._pickerRaf=0,this._emitRaf=0,this._closePicker(!1,"disconnect"),super.disconnectedCallback()}updated(t){if(t.has("color")){const t=Hi(this.color);t&&t!==this._lastValidColor&&this._syncFromColor(t,this._open)}this.disabled&&this._open?this._closePicker():this._open&&(this._supportsPopover()||this._renderFallback(),(t.has("color")||t.has("opacity")||t.has("showOpacity")||t.has("label")||t.has("opacityLabel")||t.has("pickerLabels"))&&this._queuePickerPosition())}_window(){return this._floating.window()}_supportsPopover(){return this._floating.usesPopover(this._forceFallback)}_dialog(){return this._floating.dialog()}async _toggle(){this.disabled||(this._open?this._closePicker():(this._forceFallback=!1,this._syncFromColor(this.color,!1),this._hexInvalid=!1,this._activePointerId=null,this._open=!0,await this.updateComplete,this._open&&(this._supportsPopover()||this._renderFallback(),this._positionPicker()?this._overlayDispose=this._dialog()?.registerOverlay({owner:this,group:"transient",close:t=>this._closePicker("escape"===t&&this._floating.ownsActiveElement(),t)})||null:this._closePicker())))}_closePicker(t=!1,e="exclusive"){if(!this._open&&!this._floating.hasFallback)return;const s=this._overlayDispose;this._overlayDispose=null,s?.();const i=this.renderRoot.querySelector(".picker");if(i?.hidePopover)try{i.matches(":popover-open")&&i.hidePopover()}catch{}this._open=!1,this._cancelQueuedEmit(),this._activePointerId=null,this._floating.destroy(),t&&this.updateComplete.then(()=>this.renderRoot.querySelector(".trigger")?.focus())}_surface(){return this._floating.surface(".picker",this._supportsPopover())}_renderFallback(){const t=Ji.styles.cssText;this._floating.renderFallback(this._pickerTemplate(!1),t)}_positionPicker(){if(!this._open)return!1;const t=this._window(),e=this.renderRoot.querySelector(".trigger");let s=this._surface();if(!t||!e?.isConnected||!s?.isConnected)return!1;const i=qi(t);if(s.style.maxWidth=`${Math.max(0,i.width-16)}px`,s.style.maxHeight=`${Math.max(0,i.height-16)}px`,s.style.visibility="hidden",this._supportsPopover()&&s.showPopover)try{s.matches(":popover-open")||s.showPopover()}catch{if(this._forceFallback=!0,this._renderFallback(),s=this._surface(),!s?.isConnected)return!1;s.style.maxWidth=`${Math.max(0,i.width-16)}px`,s.style.maxHeight=`${Math.max(0,i.height-16)}px`,s.style.visibility="hidden"}const o=e.getBoundingClientRect(),a=s.getBoundingClientRect();if(!(o.width&&o.height&&a.width&&a.height))return!1;const n=Ui(o,a,i);return s.style.left=`${n.left}px`,s.style.top=`${n.top}px`,s.dataset.side=n.side,s.style.visibility="",!0}_labels(){const t=this.pickerLabels||Vi;return{title:t.title||Vi.title,hue:t.hue||Vi.hue,saturation:t.saturation||Vi.saturation,value:t.value||Vi.value,hex:t.hex||Vi.hex,invalidHex:t.invalidHex||Vi.invalidHex}}_syncFromColor(t,e){const s=Hi(l(t,"#607d8b"))||"#607d8b",i=Gi(s);if(!i)return;const o=Wi(i);(!e||o.s>1e-4)&&(this._hue=o.h),this._saturation=o.s,this._value=o.v,this._hexDraft=s,this._hexInvalid=!1,this._lastValidColor=s}_cancelQueuedEmit(t=!1){this._emitRaf&&cancelAnimationFrame(this._emitRaf),this._emitRaf=0,t&&this._syncFromColor(this._lastValidColor,!0)}_queueHsvEmit(){if(this._emitRaf)return;const t=this._window();t?this._emitRaf=t.requestAnimationFrame(()=>{this._emitRaf=0,this._emitHsv()}):this._emitHsv()}_emitHsv(){this._emit(ji({h:this._hue,s:this._saturation,v:this._value}),this.opacity)}_setHue(t){this._hue=Math.min(359,Math.max(0,Number.isFinite(t)?t:0)),this._emitHsv()}_setSaturation(t){this._saturation=Math.min(100,Math.max(0,Number.isFinite(t)?t:0)),this._emitHsv()}_setValue(t){this._value=Math.min(100,Math.max(0,Number.isFinite(t)?t:0)),this._emitHsv()}_setOpacity(t){this._emit(this._lastValidColor,t)}_shiftRangeKey(t,e,s,i,o){if(!t.shiftKey)return;const a="ArrowRight"===t.key||"ArrowUp"===t.key?10:"ArrowLeft"===t.key||"ArrowDown"===t.key?-10:0;a&&(t.preventDefault(),t.stopPropagation(),o(Math.min(i,Math.max(s,e+a))))}_setSvFromPointer(t,e){const s=t.currentTarget.getBoundingClientRect();s.width&&s.height&&(this._saturation=Math.min(100,Math.max(0,(t.clientX-s.left)/s.width*100)),this._value=Math.min(100,Math.max(0,100*(1-(t.clientY-s.top)/s.height))),e?(this._cancelQueuedEmit(),this._emitHsv()):this._queueHsvEmit())}_svPointerDown(t){if(t.preventDefault(),t.stopPropagation(),null===this._activePointerId){this._activePointerId=t.pointerId;try{t.currentTarget.setPointerCapture(t.pointerId)}catch{}this._setSvFromPointer(t,!0)}}_svPointerMove(t){t.pointerId===this._activePointerId&&(t.preventDefault(),t.stopPropagation(),this._setSvFromPointer(t,!1))}_svPointerUp(t){if(t.pointerId===this._activePointerId){t.preventDefault(),t.stopPropagation(),this._setSvFromPointer(t,!0),this._activePointerId=null;try{t.currentTarget.releasePointerCapture(t.pointerId)}catch{}}}_svPointerCancel(t){t.pointerId===this._activePointerId&&(t.preventDefault(),t.stopPropagation(),this._activePointerId=null,this._cancelQueuedEmit(!0))}_svLostPointerCapture(t){t.pointerId===this._activePointerId&&(this._activePointerId=null,this._cancelQueuedEmit(!0))}_hexInput(t){const e=t.target.value;this._hexDraft=e,this._hexInvalid=!1;const s=Hi(e),i=s?Gi(s):null;if(!s||!i)return;const o=Wi(i);o.s>1e-4&&(this._hue=o.h),this._saturation=o.s,this._value=o.v,this._emit(s,this.opacity,!0)}_commitHex(){const t=Hi(this._hexDraft);if(!t)return this._hexDraft=this._lastValidColor,void(this._hexInvalid=!0);this._hexDraft=t,this._hexInvalid=!1,t!==this._lastValidColor&&this._emit(t,this.opacity)}_hexKeyDown(t){"Enter"===t.key&&(t.preventDefault(),t.stopPropagation(),this._commitHex())}_emit(t,e,s=!1){const i=Hi(t)||this._lastValidColor,o=Number.isFinite(e)?e:Number(this.opacity)||0,a=Math.min(1,Math.max(0,o));this.color=i,this.opacity=a,this._lastValidColor=i,s||(this._hexDraft=i),this._hexInvalid=!1,this.dispatchEvent(new CustomEvent("hp-color-opacity-change",{detail:{color:i,opacity:a},bubbles:!0,composed:!0}))}_pickerTemplate(t){const e=Math.round(100*Math.min(1,Math.max(0,Number(this.opacity)||0))),s=ji({h:this._hue,s:this._saturation,v:this._value}),i=ji({h:this._hue,s:100,v:100}),n=this._labels(),r=Math.round(this._hue),l=Math.round(this._saturation),h=Math.round(this._value);return o`
      <div class="picker" popover=${t?"manual":a} role="dialog" aria-label=${n.title}>
        <div class="picker-head">
          <span class="caption">${this.label||n.title}</span>
          <span class="preview" aria-hidden="true"><span style=${`background:${s};opacity:${e/100}`}></span></span>
        </div>
        <div class="sv-field" aria-hidden="true"
          style=${`--hp-picker-hue:${i};--hp-picker-saturation:${this._saturation}%;--hp-picker-value:${100-this._value}%`}
          @pointerdown=${t=>this._svPointerDown(t)}
          @pointermove=${t=>this._svPointerMove(t)}
          @pointerup=${t=>this._svPointerUp(t)}
          @pointercancel=${t=>this._svPointerCancel(t)}
          @lostpointercapture=${t=>this._svLostPointerCapture(t)}>
          <span class="sv-thumb"></span>
        </div>
        <label class="control">
          <span class="control-head"><span class="caption">${n.hue}</span><span class="control-value">${r}°</span></span>
          <input class="hue-range" type="range" min="0" max="359" step="1" .value=${String(r)}
            aria-label=${n.hue} aria-valuetext=${`${r}°`} style=${`--hp-picker-hue:${i}`}
            @input=${t=>this._setHue(Number(t.target.value))}
            @keydown=${t=>this._shiftRangeKey(t,r,0,359,t=>this._setHue(t))} />
        </label>
        <label class="control">
          <span class="control-head"><span class="caption">${n.saturation}</span><span class="control-value">${l}%</span></span>
          <input type="range" min="0" max="100" step="1" .value=${String(l)}
            aria-label=${n.saturation} aria-valuetext=${`${l}%`}
            @input=${t=>this._setSaturation(Number(t.target.value))}
            @keydown=${t=>this._shiftRangeKey(t,l,0,100,t=>this._setSaturation(t))} />
        </label>
        <label class="control">
          <span class="control-head"><span class="caption">${n.value}</span><span class="control-value">${h}%</span></span>
          <input type="range" min="0" max="100" step="1" .value=${String(h)}
            aria-label=${n.value} aria-valuetext=${`${h}%`}
            @input=${t=>this._setValue(Number(t.target.value))}
            @keydown=${t=>this._shiftRangeKey(t,h,0,100,t=>this._setValue(t))} />
        </label>
        <label class="control">
          <span class="caption">${n.hex}</span>
          <input type="text" inputmode="text" autocomplete="off" spellcheck="false"
            .value=${this._hexDraft} aria-label=${n.hex}
            aria-invalid=${this._hexInvalid?"true":"false"}
            aria-describedby=${this._hexInvalid?"hex-error":a}
            @input=${t=>this._hexInput(t)}
            @blur=${()=>this._commitHex()}
            @keydown=${t=>this._hexKeyDown(t)} />
          ${this._hexInvalid?o`<span id="hex-error" class="error">${n.invalidHex}</span>`:a}
        </label>
        ${this.showOpacity?o`<div class="row">
          <span class="caption">${this.opacityLabel}</span>
          <input type="range" min="0" max="100" step="1" .value=${String(e)}
            aria-label=${this.opacityLabel} aria-valuetext=${`${e}%`}
            @input=${t=>this._setOpacity(Number(t.target.value)/100)}
            @keydown=${t=>this._shiftRangeKey(t,e,0,100,t=>this._setOpacity(t/100))} />
          <input type="number" min="0" max="100" step="1" .value=${String(e)}
            aria-label=${`${this.opacityLabel}, %`}
            @change=${t=>this._setOpacity(Number(t.target.value)/100)} />
          <span class="pct">%</span>
        </div>`:a}
      </div>`}render(){const t=Math.round(100*Math.min(1,Math.max(0,Number(this.opacity)||0))),e=l(this.color,"#607d8b"),s=this.showOpacity?`${this.label||"Color"}: ${e}, ${t}%`:`${this.label||"Color"}: ${e}`;return o`
      ${this.label?o`<span class="label">${this.label}</span>`:a}
      <button class="trigger" type="button" .disabled=${this.disabled}
        aria-label=${s} aria-haspopup="dialog" aria-expanded=${this._open?"true":"false"}
        title=${s} @click=${this._toggle}>
        <span class="swatch" style=${`background:${e};opacity:${this.showOpacity?t/100:1}`}></span>
      </button>
      ${this._open&&!this.disabled&&this._supportsPopover()?this._pickerTemplate(!0):a}
    `}}Ji.properties={label:{type:String},opacityLabel:{type:String,attribute:"opacity-label"},color:{type:String},opacity:{type:Number},disabled:{type:Boolean,reflect:!0},showOpacity:{type:Boolean,attribute:"show-opacity"},pickerLabels:{attribute:!1},_open:{state:!0},_hue:{state:!0},_saturation:{state:!0},_value:{state:!0},_hexDraft:{state:!0},_hexInvalid:{state:!0}},Ji.styles=n`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .label {
      font-size: 12px;
      color: var(--secondary-text-color, #9aa4ad);
      white-space: nowrap;
    }
    .trigger {
      width: 40px;
      height: 40px;
      flex: none;
      box-sizing: border-box;
      padding: 3px;
      border: 1px solid var(--divider-color, #666);
      border-radius: 7px;
      background:
        linear-gradient(45deg, #b8b8b8 25%, transparent 25%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 5px -5px / 10px 10px,
        linear-gradient(45deg, #b8b8b8 25%, #eee 25%) 5px 5px / 10px 10px;
      cursor: pointer;
    }
    :host([data-pointer-hover]) .trigger:hover {
      border-color: var(--primary-color, #03a9f4);
    }
    .trigger[aria-expanded='true'] {
      border-color: var(--primary-color, #03a9f4);
      outline: none;
      box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
    }
    .trigger:focus-visible {
      border-color: var(--primary-color, #03a9f4);
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: 2px;
    }
    .swatch {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.18);
      pointer-events: none;
    }
    .picker {
      /* The popover attribute promotes this surface into the browser top layer, outside
         hp-dialog's scrolling/clipping body. JS supplies viewport coordinates. */
      position: fixed;
      z-index: 2147483647;
      inset: auto;
      top: 0;
      left: 0;
      width: min(292px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      margin: 0;
      box-sizing: border-box;
      display: grid;
      gap: 10px;
      padding: 12px;
      overflow: auto;
      color: var(--primary-text-color, #fff);
      background: var(--card-background-color, #202126);
      border: 1px solid var(--primary-color, #03a9f4);
      border-radius: 10px;
      box-shadow: 0 10px 28px rgb(0 0 0 / 0.34);
    }
    .picker[popover]:not(:popover-open) {
      /* Keep the author-level display:grid from exposing the surface for one
         frame before showPopover() promotes it into the top layer. */
      display: none;
    }
    .picker-head,
    .row,
    .control-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .picker-head {
      justify-content: space-between;
    }
    .caption {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview {
      width: 52px;
      height: 30px;
      flex: none;
      box-sizing: border-box;
      padding: 3px;
      border: 1px solid var(--divider-color, #666);
      border-radius: 7px;
      background:
        linear-gradient(45deg, #b8b8b8 25%, transparent 25%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 5px -5px / 10px 10px,
        linear-gradient(45deg, #b8b8b8 25%, #eee 25%) 5px 5px / 10px 10px;
    }
    .preview > span {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 3px;
    }
    .sv-field {
      position: relative;
      width: 100%;
      height: 132px;
      overflow: hidden;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 8px;
      background:
        linear-gradient(to top, #000, transparent),
        linear-gradient(to right, #fff, var(--hp-picker-hue, #f00));
      cursor: crosshair;
      touch-action: none;
      user-select: none;
    }
    .sv-thumb {
      position: absolute;
      left: var(--hp-picker-saturation, 0%);
      top: var(--hp-picker-value, 100%);
      width: 14px;
      height: 14px;
      box-sizing: border-box;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgb(0 0 0 / .65), 0 1px 3px rgb(0 0 0 / .5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .control {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .control-value {
      flex: none;
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
    }
    input[type='range'] {
      width: auto;
      height: 40px;
      min-width: 0;
      flex: 1;
      margin: -5px 0;
      accent-color: var(--primary-color, #03a9f4);
      touch-action: none;
    }
    .hue-range {
      accent-color: var(--hp-picker-hue, #f00);
      --hp-picker-hue-track: linear-gradient(to right,
        #f00 0%, #ff0 16.667%, #0f0 33.333%, #0ff 50%,
        #00f 66.667%, #f0f 83.333%, #f00 100%);
      --hp-picker-hue-thumb-shadow:
        0 0 0 2px var(--card-background-color, #202126),
        0 0 0 3px var(--primary-text-color, #fff);
    }
    .hue-range::-webkit-slider-runnable-track {
      height: 10px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 999px;
      background: var(--hp-picker-hue-track);
    }
    .hue-range::-moz-range-track {
      height: 10px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 999px;
      background: var(--hp-picker-hue-track);
    }
    .hue-range::-moz-range-progress {
      height: 10px;
      border: 0;
      border-radius: 999px;
      background: transparent;
    }
    .hue-range::-webkit-slider-thumb {
      border-radius: 50%;
      box-shadow: var(--hp-picker-hue-thumb-shadow);
    }
    .hue-range::-moz-range-thumb {
      border-radius: 50%;
      box-shadow: var(--hp-picker-hue-thumb-shadow);
    }
    input[type='text'],
    input[type='number'] {
      min-height: 40px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 6px;
      padding: 6px 8px;
      color: var(--primary-text-color, #fff);
      background: var(--input-fill-color, transparent);
      font: inherit;
    }
    input[type='text'] {
      width: 100%;
    }
    input[type='number'] {
      width: 50px;
      flex: none;
    }
    input:focus-visible,
    .sv-field:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: 1px;
    }
    input[aria-invalid='true'] {
      border-color: var(--error-color, #db4437);
    }
    .error {
      color: var(--error-color, #db4437);
      font-size: 11px;
      line-height: 1.25;
    }
    .pct {
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
    }
    :host([disabled]) {
      opacity: .5;
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .picker { transition: none !important; }
    }
    @media (forced-colors: active) {
      .hue-range::-webkit-slider-runnable-track {
        border-color: ButtonText;
        background: Canvas;
      }
      .hue-range::-moz-range-track {
        border-color: ButtonText;
        background: Canvas;
      }
      .hue-range::-webkit-slider-thumb {
        box-shadow: none;
      }
      .hue-range::-moz-range-thumb {
        box-shadow: none;
      }
    }
  `,customElements.get("hp-color-opacity")||customElements.define("hp-color-opacity",Ji);let Yi=0;class Xi extends r{constructor(){super(...arguments),this.text="",this.ariaLabel="",this.pointerHover=!1,this._open=!1,this._openTimer=0,this._closeTimer=0,this._positionRaf=0,this._forceFallback=!1,this._hoverOwned=!1,this._overlayDispose=null,this._scrollDialog=null,this._descriptionId="hp-help-description-"+ ++Yi,this._surfacePointerEnter=()=>{const t=this._window();this._closeTimer&&t?.clearTimeout(this._closeTimer),this._closeTimer=0},this._surfacePointerLeave=()=>{this._scheduleClose()},this._outsidePointerDown=t=>{if(!this._open)return;const e=t.composedPath();this._floating.containsPath(e)||this._closeHelp(!1,"outside")},this._dialogScroll=t=>{const e=this._floating.containsPath(t.composedPath()),s=t.target,i=this._dialog(),o=s instanceof Node&&(s===i||s instanceof Element&&s.contains(this));var a;this._open&&(a=o,!e&&a)&&this._closeHelp(!1,"scroll")},this._keyDown=t=>{if(!this._open||t.defaultPrevented)return;if("Escape"===t.key)return t.preventDefault(),t.stopImmediatePropagation(),void this._closeHelp(this._floating.ownsActiveElement(),"escape");const e=this.renderRoot.querySelector(".trigger");if(!e||!t.composedPath().includes(e))return;const s=this._surface();if(!s||s.scrollHeight<=s.clientHeight)return;const i=Math.max(40,.8*s.clientHeight),o={ArrowDown:40,ArrowUp:-40,PageDown:i,PageUp:-i};if("Home"===t.key)s.scrollTop=0;else if("End"===t.key)s.scrollTop=s.scrollHeight;else{if(!(t.key in o))return;s.scrollBy({top:o[t.key],behavior:"auto"})}t.preventDefault(),t.stopImmediatePropagation()},this._floating=new Ki(this,"help",this._keyDown),this._queuePosition=()=>{if(!this._open||this._positionRaf)return;const t=this._window();t&&(this._positionRaf=t.requestAnimationFrame(()=>{this._positionRaf=0,this._position()||this._closeHelp()}))}}connectedCallback(){super.connectedCallback(),this.addEventListener("keydown",this._keyDown,!0)}willUpdate(){this.toggleAttribute("data-has-content",this._hasContent())}disconnectedCallback(){const t=this.ownerDocument.defaultView;this._unsubscribeOpenListeners(),this.removeEventListener("keydown",this._keyDown,!0),this._clearTimers(),this._positionRaf&&t?.cancelAnimationFrame(this._positionRaf),this._positionRaf=0,this._closeHelp(!1,"disconnect"),super.disconnectedCallback()}updated(t){if(t.has("pointerHover")&&!this.pointerHover){const t=this._window();this._openTimer&&t?.clearTimeout(this._openTimer),this._openTimer=0,this._hoverOwned&&this._closeHelp(!1,"outside")}this._hasContent()||!this._open?this._open&&t.has("text")&&(this._usesPopover()||this._renderFallback(),this._queuePosition()):this._closeHelp()}_window(){return this._floating.window()}_dialog(){return this._floating.dialog()}_usesPopover(){return this._floating.usesPopover(this._forceFallback)}_hasContent(){return t=this.text,e=this.ariaLabel,"string"==typeof t&&t.trim().length>0&&"string"==typeof e&&e.trim().length>0;var t,e}_clearTimers(){const t=this._window();this._openTimer&&t?.clearTimeout(this._openTimer),this._closeTimer&&t?.clearTimeout(this._closeTimer),this._openTimer=0,this._closeTimer=0}_scheduleOpen(){const t=this._window();this.pointerHover&&t&&!this._open&&!this._openTimer&&(this._closeTimer&&t.clearTimeout(this._closeTimer),this._closeTimer=0,this._openTimer=t.setTimeout(()=>{this._openTimer=0,this.isConnected&&(this._hoverOwned=!0,this._openHelp())},300))}_scheduleClose(){const t=this._window(),e=this.renderRoot.querySelector(".trigger");t&&!e?.matches(":focus-visible")&&(this._openTimer&&t.clearTimeout(this._openTimer),this._closeTimer&&t.clearTimeout(this._closeTimer),this._openTimer=0,this._closeTimer=t.setTimeout(()=>{this._closeTimer=0,this.isConnected&&this._closeHelp()},150))}_triggerPointerEnter(t){this.pointerHover&&"mouse"===t.pointerType&&this._scheduleOpen()}_triggerPointerLeave(t){"mouse"===t.pointerType&&this._scheduleClose()}_triggerFocus(){queueMicrotask(()=>{const t=this.renderRoot.querySelector(".trigger");t?.matches(":focus-visible")&&(this._hoverOwned=!1,this._openHelp())})}_triggerBlur(){this._scheduleClose()}_triggerClick(){this._open?this._closeHelp():(this._hoverOwned=!1,this._openHelp())}_subscribeOpenListeners(){this.ownerDocument.addEventListener("pointerdown",this._outsidePointerDown,!0),this.ownerDocument.addEventListener("keydown",this._keyDown,!0);const t=this._window();t?.addEventListener("resize",this._queuePosition),t?.addEventListener("orientationchange",this._queuePosition),t?.visualViewport?.addEventListener("resize",this._queuePosition),t?.visualViewport?.addEventListener("scroll",this._queuePosition),this._scrollDialog=this._dialog(),this._scrollDialog?.addEventListener("scroll",this._dialogScroll,!0)}_unsubscribeOpenListeners(){this.ownerDocument.removeEventListener("pointerdown",this._outsidePointerDown,!0),this.ownerDocument.removeEventListener("keydown",this._keyDown,!0);const t=this._window();t?.removeEventListener("resize",this._queuePosition),t?.removeEventListener("orientationchange",this._queuePosition),t?.visualViewport?.removeEventListener("resize",this._queuePosition),t?.visualViewport?.removeEventListener("scroll",this._queuePosition),this._scrollDialog?.removeEventListener("scroll",this._dialogScroll,!0),this._scrollDialog=null}async _openHelp(){!this._open&&this._hasContent()&&(this._clearTimers(),this._forceFallback=!1,this._open=!0,this._subscribeOpenListeners(),await this.updateComplete,this._open&&(this._usesPopover()||this._renderFallback(),this._position()?this._overlayDispose=this._dialog()?.registerOverlay({owner:this,group:"transient",close:t=>this._closeHelp("escape"===t&&this._floating.ownsActiveElement(),t)})||null:this._closeHelp()))}_closeHelp(t=!1,e="exclusive"){if(!this._open&&!this._floating.hasFallback)return;this._clearTimers();const s=this._overlayDispose;this._overlayDispose=null,s?.();const i=this.renderRoot.querySelector(".tooltip");if(i?.hidePopover)try{i.matches(":popover-open")&&i.hidePopover()}catch{}this._open=!1,this._hoverOwned=!1,this._unsubscribeOpenListeners(),this._floating.destroy(),t&&this.updateComplete.then(()=>this.renderRoot.querySelector(".trigger")?.focus())}_tooltipTemplate(t){return o`<div class="tooltip" data-side="bottom" popover=${t?"manual":a}
      role="tooltip" aria-hidden="true" tabindex="-1"
      @pointerenter=${this._surfacePointerEnter} @pointerleave=${this._surfacePointerLeave}>${this.text}</div>`}_renderFallback(){const t=Xi.styles.cssText;this._floating.renderFallback(this._tooltipTemplate(!1),t)}_surface(){return this._floating.surface(".tooltip",this._usesPopover())}_position(){if(!this._open)return!1;const t=this._window(),e=this.renderRoot.querySelector(".trigger");let s=this._surface();if(!t||!e?.isConnected||!s?.isConnected)return!1;const i=qi(t);if(s.style.maxWidth=`${Math.max(0,Math.min(320,i.width-16))}px`,s.style.maxHeight=`${Math.max(0,i.height-16)}px`,s.style.visibility="hidden",this._usesPopover()&&s.showPopover)try{s.matches(":popover-open")||s.showPopover()}catch{if(this._forceFallback=!0,this._renderFallback(),s=this._surface(),!s?.isConnected)return!1;s.style.visibility="hidden"}const o=e.getBoundingClientRect(),a=s.getBoundingClientRect();if(!(o.width&&o.height&&a.width&&a.height))return!1;const n=Ui(o,a,i);return s.style.left=`${n.left}px`,s.style.top=`${n.top}px`,s.dataset.side=n.side,s.style.visibility="",!0}render(){if(!this._hasContent())return a;const t=this.ariaLabel.trim();return o`
      <span id=${this._descriptionId} class="sr-only" role="tooltip"
        aria-hidden=${this._open?"false":"true"}>${this.text}</span>
      <button class="trigger" type="button" aria-label=${t}
        aria-describedby=${this._open?this._descriptionId:a}
        aria-expanded=${this._open?"true":"false"}
        @pointerenter=${this._triggerPointerEnter} @pointerleave=${this._triggerPointerLeave}
        @focus=${this._triggerFocus} @blur=${this._triggerBlur} @click=${this._triggerClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d=${h}></path>
        </svg>
      </button>
      ${this._usesPopover()?this._tooltipTemplate(!0):a}
    `}}Xi.properties={text:{type:String},ariaLabel:{type:String,attribute:"aria-label"},pointerHover:{type:Boolean,attribute:"data-pointer-hover",reflect:!0},_open:{state:!0},_forceFallback:{state:!0}},Xi.styles=n`
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
  `,customElements.get("hp-help")||customElements.define("hp-help",Xi);const Zi=new WeakMap;function Qi(t){const e=function(t){const e=t?.connection||t;return!e||"object"!=typeof e&&"function"!=typeof e?null:e}(t);if(!e)return null;let s=Zi.get(e);return s||(s={revision:0,loaded:!1,configEntries:{},manifests:{},listeners:new Set,refs:0},Zi.set(e,s)),s}function to(t){t.revision++;for(const e of[...t.listeners])try{e()}catch{}}function eo(t,e){const s=Qi(t);if(!s)return()=>{};s.refs++,s.listeners.add(e),async function(t,e){e.loading||"function"!=typeof t?.callWS?e.loading:e.loaded&&e.loadedAt&&Date.now()-e.loadedAt<3e5||(e.loading=(async()=>{const[s,i]=await Promise.allSettled([t.callWS({type:"config_entries/get"}),t.callWS({type:"manifest/list"})]);"fulfilled"===s.status&&Array.isArray(s.value)&&(e.configEntries=Object.fromEntries(s.value.filter(t=>"string"==typeof t?.entry_id).map(t=>[t.entry_id,t]))),"fulfilled"===i.status&&Array.isArray(i.value)&&(e.manifests=Object.fromEntries(i.value.filter(t=>"string"==typeof t?.domain).map(t=>[t.domain,t]))),e.loaded=!0,e.loadedAt=Date.now(),e.loading=void 0,to(e)})().catch(()=>{e.loaded=!0,e.loadedAt=Date.now(),e.loading=void 0,to(e)}),e.loading)}(t,s),async function(t,e){if(e.unsubscribe||e.subscribing)return e.subscribing;const s=t?.connection?.subscribeMessage;"function"==typeof s&&(e.subscribing=(async()=>{try{e.unsubscribe=await s.call(t.connection,t=>{const s=Array.isArray(t)?t:Array.isArray(t?.entries)?t.entries:t?[t]:[];let i=!1;const o={...e.configEntries};for(const t of s){const e=t?.entry||t?.data?.entry||("string"==typeof t?.entry_id?t:null),s=e?.entry_id;if("string"!=typeof s)continue;const a=t?.type||t?.action||t?.data?.action;"removed"===a||"remove"===a?delete o[s]:o[s]=e,i=!0}i&&(e.configEntries=o,to(e))},{type:"config_entries/subscribe"})}catch{}finally{0===e.refs&&(e.unsubscribe?.(),e.unsubscribe=void 0),e.subscribing=void 0}})(),e.subscribing)}(t,s);let i=!1;return()=>{i||(i=!0,s.listeners.delete(e),s.refs=Math.max(0,s.refs-1),s.refs||(s.unsubscribe?.(),s.unsubscribe=void 0))}}function so(t){const e=Qi(t);return e?{revision:e.revision,loaded:e.loaded,configEntries:e.configEntries,manifests:e.manifests}:{revision:0,loaded:!1,configEntries:{},manifests:{}}}function io(t,e,s=so(t),i){const o=s.manifests[e];return function(t,e){if("function"!=typeof t?.localize)return"";try{const s=`component.${e}.title`,i=t.localize(s);return"string"==typeof i&&i!==s?i:""}catch{return""}}(t,e)||String(o?.name||"")||String(i||"")||e.replace(/_/g," ")}function oo(t,e,s,i,o){const a=String(e||"").trim();if(!a)return null;const n=o?i.configEntries[o]:null;return{domain:a,label:io(t,a,i,n?.title),configEntryId:o,configEntryTitle:n?.title,confidence:s}}function ao(t){const e={"registry-owner":0,"entity-platform":1,"identifier-fallback":2},s=new Set;return t.filter(t=>!!t).sort((t,s)=>e[t.confidence]-e[s.confidence]||t.label.localeCompare(s.label)||t.domain.localeCompare(s.domain)).filter(t=>{const e=`${t.domain}\n${t.configEntryId||""}`;return!s.has(e)&&(s.add(e),!0)})}function no(t,e,s,i=so(t)){const o=s.entities?.[e]||t?.entities?.[e];if(!o)return null;const a=o.config_entry_id||void 0,n=a?i.configEntries[a]?.domain:"";return oo(t,o.platform||n,"entity-platform",i,a)}class ro extends r{constructor(){super(...arguments),this.deviceName="",this._metadataConnection=null,this._demoUntil=0,this._demoTimer=0,this._demoGeneration=1,this._demoKind=null,this._reducedMotion=!1,this._onMotionChange=t=>{this._reducedMotion=t.matches,this.requestUpdate()},this._startShortDemo=()=>{const t=this.presentation;t&&"icon_ripple"===t.display&&"none"===t.pulse.kind&&(this._demoGeneration++,this._demoKind="short",this._demoUntil=Date.now()+3300,window.clearTimeout(this._demoTimer),this._demoTimer=window.setTimeout(()=>{this._demoUntil=0,this._demoTimer=0,this._demoKind=null,this.requestUpdate()},3330),this.requestUpdate())},this._toggleContinuousDemo=()=>{const t=this.presentation;t&&"icon_ripple"===t.display&&"none"===t.pulse.kind&&("continuous"===this._demoKind?this._clearDemo():(this._clearDemo(),this._demoGeneration++,this._demoKind="continuous",this._demoUntil=Number.POSITIVE_INFINITY),this.requestUpdate())}}connectedCallback(){super.connectedCallback(),this._motionMedia=window.matchMedia?.("(prefers-reduced-motion: reduce)"),this._reducedMotion=!!this._motionMedia?.matches,this._motionMedia?.addEventListener?.("change",this._onMotionChange),this._ensureMetadata()}disconnectedCallback(){this._metadataRelease?.(),this._metadataRelease=void 0,this._metadataConnection=null,this._clearDemo(),this._motionMedia?.removeEventListener?.("change",this._onMotionChange),this._motionMedia=void 0,super.disconnectedCallback()}willUpdate(t){t.has("hass")&&this._ensureMetadata();const e=this.presentation,s=t.get("presentation");t.has("presentation")&&s?.binding!==e?.binding&&this._clearDemo(),e&&this._demoKind&&("icon_ripple"!==e.display||"none"!==e.pulse.kind)&&this._clearDemo()}_ensureMetadata(){const t=this.hass?.connection||null;t&&t!==this._metadataConnection&&(this._metadataRelease?.(),this._metadataConnection=t,this._metadataRelease=eo(this.hass,()=>this.requestUpdate()))}_clearDemo(){window.clearTimeout(this._demoTimer),this._demoTimer=0,this._demoUntil=0,this._demoKind=null}get _lang(){return d(this.hass)}_t(t,e){return p(this._lang,t,e)}_providerText(t){return"houseplan"===t.domain?this._t("marker.preview.virtual_provider"):t.label.toLowerCase()===t.domain.toLowerCase()?t.domain:`${t.label} (${t.domain})`}_providers(){return this.presentation&&this.registry?function(t,e,s,i=so(t)){if("virtual"===e)return[{domain:"houseplan",label:"House Plan",confidence:"registry-owner"}];const o=e.indexOf(":");if(o<1)return[];const a=e.slice(0,o),n=e.slice(o+1);if("entity"===a){const e=no(t,n,s,i);return e?[e]:[]}if("device"!==a)return[];const r=s.devices?.[n]||t?.devices?.[n];if(!r)return[];const l=[r.config_entry_id,...Array.isArray(r.config_entries)?r.config_entries:[]].filter(t=>"string"==typeof t&&!!t).map(e=>{const s=i.configEntries[e];return oo(t,s?.domain,"registry-owner",i,e)});if(l.some(Boolean))return ao(l);const h=[];for(const[e,o]of Object.entries(s.entities||{}))o?.device_id===n&&null==o?.disabled_by&&h.push(no(t,e,s,i));return h.some(Boolean)?ao(h):ao((Array.isArray(r.identifiers)?r.identifiers:[]).map(e=>{const s=Array.isArray(e)?e[0]:null;return oo(t,s,"identifier-fallback",i)}))}(this.hass,this.presentation.binding,this.registry,so(this.hass)):[]}_providerSummary(t){if(!t.length)return this._t("marker.preview.unknown_provider");const e=t.slice(0,2).map(t=>this._providerText(t)),s=t.length-e.length;return e.join(", ")+(s>0?` · ${this._t("marker.preview.more_sources",{n:s})}`:"")}_sourceSummary(t){const e=t.visualSources;return e.length?1===e.length?`${e[0].name} · ${e[0].eid} · ${this._sourceProvider(e[0].eid)}`:2===e.length?e.map(t=>t.name).join(" · "):this._t("marker.preview.multiple_sources",{n:e.length}):this._t("marker.preview.no_source")}_stateSummary(t){if(!t.visualSources.length)return this._t("marker.preview.no_state");if(1===t.visualSources.length)return t.visualSources[0].stateText||this._t("marker.preview.no_state");const e=[...new Set(t.visualSources.map(t=>t.stateText).filter(Boolean))];return 1===e.length?e[0]:this._t("marker.preview.mixed_states")}_reason(t){return this._t(`marker.preview.reason.${t}`)}_sourceProvider(t){if(!this.registry)return this._t("marker.preview.unknown_provider");const e=no(this.hass,t,this.registry,so(this.hass));return e?this._providerText(e):this._t("marker.preview.unknown_provider")}render(){const t=this.presentation;if(!t)return a;const e=!!this._demoKind&&this._demoUntil>Date.now()&&"icon_ripple"===t.display&&"none"===t.pulse.kind,s=e?(()=>{const e=_(t.pulse,this._demoKind,this._demoGeneration,this._reducedMotion,"short"===this._demoKind?this._demoUntil:null);return{...t,pulse:e,classes:[...t.classes.filter(t=>!t.startsWith("pulse-")),`pulse-${e.kind}`,...e.generation%2==0?["pulse-gen2"]:[]]}})():t,i=this._providers(),n="none"!==t.pulse.kind,r=s.scale*(s.pulse.animated?s.pulse.diameterScale:1);let l=-r/2,h=r/2,c=-r/2,d=r/2;if(s.valueBadge){const t=s.scale*Math.min(4,Math.max(.9,.29*s.valueBadge.text.length+.28)),e=.7*s.scale,i=.6*s.scale;"right"===s.valueBadge.position&&(h=Math.max(h,i+t)),"left"===s.valueBadge.position&&(l=Math.min(l,-i-t)),"top"===s.valueBadge.position&&(c=Math.min(c,-i-e)),"bottom"===s.valueBadge.position&&(d=Math.max(d,i+e))}if(null!=s.lqiText){const t=s.scale*("bottom"===s.valueBadge?.position?1.55:.95);d=Math.max(d,t)}const p=Math.min(1,2.35/Math.max(1,h-l),2.35/Math.max(1,d-c)),b=Math.round(100*p),y=[`left:calc(50% - ${54*((l+h)/2)*p}px)`,`top:calc(50% - ${54*((c+d)/2)*p}px)`,p<1?`transform:scale(${p})`:""].filter(Boolean).join(";"),v=["dev",u(this.hass),...s.classes,"virtual"===s.binding?"virtual":"",s.haDisabled?"ghost ha-disabled":"",null!=s.valueText?"valonly":""].filter(Boolean).join(" "),$=m(s).join(";"),w=e?this._t("continuous"===this._demoKind?"marker.preview.demo_continuous_notice":"marker.preview.demo_short_notice"):this._reason(t.explanation.reason),k=[this.deviceName,this._providerSummary(i),this._stateSummary(t),w,t.valueFullText||"",g(t.valueBadge),null!=t.lqiText&&t.lqiBand?this._t(`marker.lqi_a11y_${t.lqiBand}`,{value:t.lqiText}):""].filter(Boolean).join(". ");return o`<section class="devicepreview">
      <div class="previewhead">
        <strong>${this._t("marker.preview.title")}</strong>
        <span class="previewbadge ${e?"example":""}">
          ${this._t(e?"marker.preview.example":"marker.preview.actual")}
        </span>
      </div>
      <div class="previewgrid">
        <div class="previewstage" role="img" aria-label=${k}>
          <div class="previewfit" style=${y}>
            <div class=${v} style=${$}>
              ${f(s,{disabledTitle:this._reason("ha_disabled")})}
            </div>
          </div>
        </div>
        <div class="previewfacts" aria-live="polite">
          <div><span>${this._t("marker.preview.integration")}</span><b>${this._providerSummary(i)}</b></div>
          <div><span>${this._t("marker.preview.source")}</span><b>${this._sourceSummary(t)}</b></div>
          <div><span>${this._t("marker.preview.current_state")}</span><b>${this._stateSummary(t)}</b></div>
          <div><span>${this._t("marker.preview.result")}</span><b>${w}</b></div>
          ${t.fallbackReason?o`<p class="previewnotice">${this._reason(t.fallbackReason)}</p>`:a}
          ${t.explanation.notices.map(t=>o`<p class="previewnotice">${this._reason(t)}</p>`)}
          ${p<1?o`<p class="previewnotice">${this._t("marker.preview.scaled",{n:b})}</p>`:a}
          ${e&&this._reducedMotion?o`<p class="previewnotice">${this._t("marker.preview.reduced_motion")}</p>`:a}
        </div>
      </div>
      ${t.visualSources.length||t.criticalSources.length?o`<details class="previewdetails">
            <summary>${this._t("marker.preview.details")}</summary>
            <div class="previewtable">
              ${[...t.visualSources,...t.criticalSources].map(t=>o`
                <div class="previewsource">
                  <b>${t.name}</b><code>${t.eid}</code>
                  <span>${t.stateText||t.state}</span>
                  <span>${this._sourceProvider(t.eid)}</span>
                </div>`)}
            </div>
          </details>`:a}
      ${"icon_ripple"===t.display?o`<div class="previewdemos">
            <button class="previewdemo" type="button"
              ?disabled=${n||"continuous"===this._demoKind}
              title=${n?this._t("marker.preview.demo_already_visible"):""}
              @click=${this._startShortDemo}>
              <ha-icon icon="mdi:motion-play-outline"></ha-icon>
              ${this._t("marker.preview.demo_short")}
            </button>
            <button class="previewdemo" type="button"
              ?disabled=${n}
              title=${n?this._t("marker.preview.demo_already_visible"):""}
              @click=${this._toggleContinuousDemo}>
              <ha-icon icon=${"continuous"===this._demoKind?"mdi:stop-circle-outline":"mdi:repeat"}></ha-icon>
              ${this._t("continuous"===this._demoKind?"marker.preview.stop_continuous":"marker.preview.demo_continuous")}
            </button>
          </div>`:a}
    </section>`}}ro.properties={hass:{attribute:!1},presentation:{attribute:!1},registry:{attribute:!1},deviceName:{attribute:!1}},ro.styles=[c,n`
      :host { display: block; min-width: 0; }
      .devicepreview {
        margin: 4px 0 14px;
        padding: 14px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.28));
        border-radius: 14px;
        background: color-mix(in srgb, var(--card-background-color, #20232b) 92%, var(--primary-color, #03a9f4));
        color: var(--primary-text-color, #fff);
        overflow: hidden;
      }
      .previewhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
      .previewbadge {
        padding: 3px 9px;
        border-radius: 999px;
        color: var(--secondary-text-color, #9aa0aa);
        background: color-mix(in srgb, var(--secondary-text-color, #9aa0aa) 12%, transparent);
        font-size: 12px;
        font-weight: 700;
      }
      .previewbadge.example { color: var(--warning-color, #ffb300); }
      .previewgrid { display: grid; grid-template-columns: minmax(170px, 0.8fr) minmax(240px, 1.2fr); gap: 16px; align-items: stretch; }
      .previewstage {
        position: relative;
        min-height: 168px;
        border-radius: 12px;
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.16));
        overflow: hidden;
        pointer-events: none;
        container-type: inline-size;
        --icon-size: 54px;
        --device-base-size: 48.6px;
      }
      .previewfit { position: absolute; left: 50%; top: 50%; transform-origin: center; }
      .previewstage .dev { left: 0; top: 0; cursor: default; }
      :host([data-pointer-hover]) .previewstage .dev:hover { z-index: 2; }
      .previewfacts { min-width: 0; display: grid; align-content: start; gap: 8px; }
      .previewfacts > div { display: grid; grid-template-columns: minmax(115px, 0.8fr) minmax(0, 1.3fr); gap: 8px; }
      .previewfacts span { color: var(--secondary-text-color, #9aa0aa); }
      .previewfacts b { min-width: 0; overflow-wrap: anywhere; }
      .previewnotice { margin: 2px 0 0; color: var(--secondary-text-color, #9aa0aa); font-size: 13px; }
      .previewdetails { margin-top: 12px; }
      .previewdetails summary { cursor: pointer; color: var(--secondary-text-color, #9aa0aa); }
      .previewtable { display: grid; gap: 8px; margin-top: 9px; }
      .previewsource { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3px 10px; font-size: 13px; }
      .previewsource > * { min-width: 0; overflow-wrap: anywhere; }
      .previewsource code { color: var(--secondary-text-color, #9aa0aa); }
      .previewdemo {
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: 10px;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .previewdemos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .previewdemo:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
      .previewdemo:disabled { opacity: 0.5; cursor: not-allowed; }
      @media (max-width: 640px) {
        .previewgrid { grid-template-columns: minmax(0, 1fr); }
        .previewstage { min-height: 142px; }
        .previewfacts > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
      }
    `],customElements.get("hp-device-preview")||customElements.define("hp-device-preview",ro);const lo=(t,e)=>[t[0]-e[0],t[1]-e[1]],ho=(t,e)=>[t[0]+e[0],t[1]+e[1]],co=(t,e)=>t[0]*e[0]+t[1]*e[1],po=t=>Math.hypot(t[0],t[1]);function _o(t){let e=0;for(let s=0;s<t.length;s++){const i=t[s],o=t[(s+1)%t.length];e+=i[0]*o[1]-o[0]*i[1]}return e/2}function uo(t,e,s){const i=lo(s,e),o=co(i,i);if(o<1e-12)return po(lo(t,e));let a=co(lo(t,e),i)/o;return a=Math.max(0,Math.min(1,a)),po(lo(t,[e[0]+i[0]*a,e[1]+i[1]*a]))}function mo(t,e){const s=t[e],i=t[(e+1)%t.length],o=lo(i,s),a=po(o)||1;let n=[o[1]/a,-o[0]/a];const r=[(s[0]+i[0])/2,(s[1]+i[1])/2],l=Math.max(.01*a,1e-4);return function(t,e){let s=!1;for(let i=0,o=e.length-1;i<e.length;o=i++){const a=e[i][0],n=e[i][1],r=e[o][0],l=e[o][1];n>t[1]!=l>t[1]&&t[0]<(r-a)*(t[1]-n)/(l-n)+a&&(s=!s)}return s}([r[0]+n[0]*l,r[1]+n[1]*l],t)&&(n=[-n[0],-n[1]]),n}function go(t){const e=t.length;if(e<3)return!1;for(let s=0;s<e;s++)for(let i=s+1;i<e;i++)if(i!==s&&(i+1)%e!==s&&(s+1)%e!==i&&b(t[s],t[(s+1)%e],t[i],t[(i+1)%e]))return!1;return!0}function fo(t,e,s=1e-6){let i=1/0;for(const[o,a]of e){const e=lo(a,o),n=po(e);if(n<s)continue;const r=[e[0]/n,e[1]/n],l=t=>(t[0]-o[0])*r[1]-(t[1]-o[1])*r[0],h=t=>(t[0]-o[0])*r[0]+(t[1]-o[1])*r[1],c=s,d=n-s;for(const e of t){const t=Math.abs(l(e));if(t<=s)continue;const o=h(e);o<=c||o>=d||t<i&&(i=t)}for(let e=0;e<t.length;e++){const o=t[e],a=t[(e+1)%t.length],n=l(o),r=l(a);if(Math.abs(n)<=s||Math.abs(r)<=s)continue;const p=h(o),_=h(a),u=Math.max(c,Math.min(p,_)),m=Math.min(d,Math.max(p,_));if(m-u<=s)continue;const g=_-p;if(Math.abs(g)<s){i=Math.min(i,Math.abs(n),Math.abs(r));continue}const f=t=>Math.abs(n+(t-p)/g*(r-n));i=Math.min(i,f(u),f(m))}}return i}function bo(t,e,s){if($(t,e,s))return!0;if(v(t,e,s)||v(e,t,s))return!1;let i=0;try{const s=w([[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]],[[...e.map(t=>[t[0],t[1]]),[e[0][0],e[0][1]]]]);for(const t of s)t?.[0]&&(i+=k(t[0]))}catch{return!1}return i>Math.max(1e-7,s*s)}function yo(t,e,s){for(const i of e)for(let e=0;e<i.length;e++){const o=i[e],a=i[(e+1)%i.length],n=lo(a,o),r=po(n);if(r<s)continue;const l=[n[0]/r,n[1]/r];if(Math.abs((t.x-o[0])*l[1]-(t.y-o[1])*l[0])>s)continue;const h=(t.x-o[0])*l[0]+(t.y-o[1])*l[1];if(h-t.length/2>=-s&&h+t.length/2<=r+s)return!0}return!1}function vo(t,e,s){const i=Math.abs(e[0]-t[0]),o=Math.abs(e[1]-t[1]);return i<=s&&o>s?"v":o<=s&&i>s?"h":null}function $o(t,e,s){return Math.abs(t[0]-e[0])<=s&&Math.abs(t[1]-e[1])<=s}function wo(t,e,s,i,o){return $o(t,s,o)&&$o(e,i,o)||$o(t,i,o)&&$o(e,s,o)}function ko(t,e,s,i,o){const a=vo(t,e,o);return a&&vo(s,i,o)===a?"h"===a?Math.abs(t[1]-s[1])>o||Math.abs(t[1]-i[1])>o?0:Math.max(0,Math.min(Math.max(t[0],e[0]),Math.max(s[0],i[0]))-Math.max(Math.min(t[0],e[0]),Math.min(s[0],i[0]))):Math.abs(t[0]-s[0])>o||Math.abs(t[0]-i[0])>o?0:Math.max(0,Math.min(Math.max(t[1],e[1]),Math.max(s[1],i[1]))-Math.max(Math.min(t[1],e[1]),Math.min(s[1],i[1]))):0}function xo(t,e,s,i){const o=t.length,a=vo(t[(e-1+o)%o],t[e],i),n=vo(t[(e+1)%o],t[(e+2)%o],i),r="h"===s?"v":"h";return a===r&&n===r}function So(t){let e=1/0,s=1/0,i=-1/0,o=-1/0;for(const a of t)e=Math.min(e,a[0]),s=Math.min(s,a[1]),i=Math.max(i,a[0]),o=Math.max(o,a[1]);return[e,s,i,o]}function Mo(t,e,s){const i=So(t),o=So(e);return i[2]<o[0]-s||o[2]<i[0]-s||i[3]<o[1]-s||o[3]<i[1]-s}function Do(t,e,s,i){const o=i.eps;return"circle"===t.kind?uo(t.center,e,s)<t.radius+(i.movingHalf||0)-o:ko(e,s,t.a,t.b,o)>o}const Co=(t,e)=>"h"===e?t[0]:t[1],Po=(t,e)=>"h"===e?t[1]:t[0];function Io(t,e,s,i,o){const a=t.find(t=>t.id===e);if(!a)return null;const n=a.poly[s],r=a.poly[(s+1)%a.poly.length],l=vo(n,r,o);if(!l)return null;const h=0===i?r:n,c=0===i?n:r,d=Co(h,l),p=Co(c,l),_=Po(h,l),u=function(t,e,s,i){const o=[];for(const a of t)for(let t=0;t<a.poly.length;t++){const n=a.poly[t],r=a.poly[(t+1)%a.poly.length];if(vo(n,r,i)!==e||Math.abs(Po(n,e)-s)>i||Math.abs(Po(r,e)-s)>i)continue;const l=Co(n,e),h=Co(r,e),c=Math.min(l,h),d=Math.max(l,h);d-c>i&&o.push({roomId:a.id,edge:t,lo:c,hi:d})}return o.sort((t,e)=>t.lo-e.lo||t.hi-e.hi||t.roomId.localeCompare(e.roomId)||t.edge-e.edge)}(t,l,_,o),m=function(t,e,s,i){const o=[e,s];for(const a of t){const t=Math.max(e,a.lo),n=Math.min(s,a.hi);n-t>i&&o.push(t,n)}const a=[...new Set(o)].sort((t,e)=>t-e),n=[];for(let e=0;e+1<a.length;e++){const s=a[e],o=a[e+1];if(o-s<=i)continue;const r=(s+o)/2,l=[...new Set(t.filter(t=>r>t.lo-i&&r<t.hi+i).map(t=>t.roomId))].sort();n.push({lo:s,hi:o,owners:l})}return n}(u,Math.min(d,p),Math.max(d,p),o);return!m.length||m.some(t=>t.owners.length<1||t.owners.length>2)?null:{roomId:e,edge:s,movedEndpoint:i,axis:l,line:_,fixed:d,moving:p,intervals:u,baseline:m}}function To(t,e,s){const i=[];for(const o of t.intervals){const a=e.polys[o.roomId];if(!a){i.push(o);continue}if(o.edge<0||o.edge>=a.length)continue;const n=a[o.edge],r=a[(o.edge+1)%a.length];if(vo(n,r,s)!==t.axis||Math.abs(Po(n,t.axis)-t.line)>s||Math.abs(Po(r,t.axis)-t.line)>s)continue;const l=Co(n,t.axis),h=Co(r,t.axis),c=Math.min(l,h),d=Math.max(l,h);d-c>s&&i.push({...o,lo:c,hi:d})}return i}function Ro(t,e,s){return new Set(t.filter(t=>e>t.lo-s&&e<t.hi+s).map(t=>t.roomId)).size}function Fo(t,e,s){for(const i of e.sideOwnership){const e=t.polys[i.roomId];if(!e)return!1;const o=e[i.edge],a=e[(i.edge+1)%e.length];if(vo(o,a,s)!==i.axis)return!1;const n=Co(0===i.movedEndpoint?o:a,i.axis),r=To(i,t,s),l=(i.moving>=i.fixed?i.baseline[i.baseline.length-1]:i.baseline[0]).owners.length;if(l<1||l>2)return!1;const h=Math.min(i.fixed,i.moving,n),c=Math.max(i.fixed,i.moving,n),d=[h,c,i.fixed,i.moving,n];for(const t of i.intervals)d.push(t.lo,t.hi);for(const t of r)d.push(t.lo,t.hi);const p=[...new Set(d.filter(t=>t>=h&&t<=c))].sort((t,e)=>t-e),_=Math.min(i.fixed,i.moving),u=Math.max(i.fixed,i.moving),m=Math.min(i.fixed,n),g=Math.max(i.fixed,n);for(let t=0;t+1<p.length;t++){const e=p[t],o=p[t+1];if(o-e<=s)continue;const a=(e+o)/2,n=a>_-s&&a<u+s,h=a>m-s&&a<g+s;if(!n&&!h)continue;const c=Ro(i.intervals,a,s),d=Ro(r,a,s);if(c>2||d>2)return!1;if(n&&h){if(c!==d)return!1}else if(!n&&h){if(d!==l||c>0&&c!==d)return!1}else if(2===c?2!==d:d>1)return!1}}return!0}function No(t,e,s,i){const o=[s.n[0]*i,s.n[1]*i],a={polys:{},openings:{},movedSpans:{}};for(const e of s.roomIds){const i=t.find(t=>t.id===e),n=s.edgeByRoom[e];if(!i||null==n)continue;const r=(n+1)%i.poly.length;a.polys[e]=i.poly.map((t,e)=>e===n||e===r?ho(t,o):[...t]),a.movedSpans[e]=[[ho(i.poly[n],o),ho(i.poly[r],o)]]}for(const t of e)s.movingOpeningIds.includes(t.id)&&(a.openings[t.id]=[t.x+o[0],t.y+o[1]]);return a}function zo(t,e,s,i,o,a,n,r){if(!function(t,e,s,i){if(uo([t.x,t.y],e,s)>2*i)return!1;const o=po(lo(s,e));if(o<=i)return!1;const a=[(s[0]-e[0])/o,(s[1]-e[1])/o],n=(t.x-e[0])*a[0]+(t.y-e[1])*a[1];return n>=-i&&n<=o+i}(t,e,s,r))return!0;if(uo([t.x,t.y],i,o)>2*r)return!1;const l=0===a?i:o;return po(lo([t.x,t.y],l))>=t.length/2+n-r}function Ao(t,e,s,i){const o=i.movingHalf||0;return"circle"===t.kind?uo(t.center,e,s)<t.radius+o-i.eps:function(t,e,s,i){return b(t,e,s,i)?0:Math.min(uo(t,s,i),uo(e,s,i),uo(s,t,e),uo(i,t,e))}(e,s,t.a,t.b)<(t.half||0)+o-i.eps}function Oo(t,e,s,i,o){const{eps:a,minDim:n}=o;if(!Number.isFinite(i)||s.roomIds.length<1||s.roomIds.length>2)return!1;const r=No(t,e,s,i);if(Object.keys(r.polys).length!==s.roomIds.length)return!1;if(!Fo(r,s,a))return!1;const l=new Set(s.roomIds),h=t=>r.polys[t.id]||t.poly;for(const i of s.roomIds){const l=t.find(t=>t.id===i),h=r.polys[i],c=s.edgeByRoom[i];if(!l||!h||h.length!==s.topology[i]||h.length!==l.poly.length||!go(h))return!1;const d=l.poly.length,p=(c-1+d)%d,_=[p,c,(c+1)%d];for(const t of _)if(y(h[t],h[(t+1)%d]))return!1;const u=_o(l.poly),m=_o(h);if(Math.abs(m)<a||u*m<=0)return!1;const g=[l.poly[c],l.poly[(c+1)%l.poly.length]],f=r.movedSpans[i],b=fo(l.poly,[g],a);if(fo(h,f,a)<Math.min(n,b)-a)return!1;const v=[l.poly[p],l.poly[c]],$=[h[p],h[c]],w=[l.poly[(c+1)%d],l.poly[(c+2)%d]],k=[h[(c+1)%d],h[(c+2)%d]],x=vo(h[c],h[(c+1)%d],a),S="h"===x?"v":"v"===x?"h":null;if(!S||vo(...$,a)!==S||vo(...k,a)!==S)return!1;for(const t of e)if(!s.movingOpeningIds.includes(t.id)){if(!zo(t,...v,...$,1,o.movingHalf||0,a))return!1;if(!zo(t,...w,...k,0,o.movingHalf||0,a))return!1}}if(2===s.roomIds.length){const[t,e]=s.roomIds,i=r.polys[t],o=r.polys[e],n=s.edgeByRoom[t],l=s.edgeByRoom[e];if(!wo(i[n],i[(n+1)%i.length],o[l],o[(l+1)%o.length],a))return!1}for(const e of s.roomIds){const s=t.find(t=>t.id===e),i=r.polys[e];for(const o of t){if(o.id===e||l.has(o.id))continue;const t=h(o);if(!Mo(s.poly,o.poly,a)||!Mo(i,t,a))if(v(s.poly,o.poly,a)){if(!v(i,t,a))return!1}else if(v(o.poly,s.poly,a)){if(!v(t,i,a))return!1}else if(v(i,t,a)||v(t,i,a)||bo(i,t,a))return!1}}t.find(t=>t.id===s.roomId);const c=r.polys[s.roomId],d=s.edgeByRoom[s.roomId],p=c[d],_=c[(d+1)%c.length];if(Math.abs(i)>a)for(const t of o.obstacles||[])if(Ao(t,p,_,o))return!1;for(const t of e){if(!s.movingOpeningIds.includes(t.id))continue;const e=r.openings[t.id];if(!e||t.hosted)return!1;if(!yo({...t,x:e[0],y:e[1]},[c],2*a))return!1}return!0}const Lo=new WeakMap,Eo=t=>"number"==typeof t&&Number.isFinite(t),Bo=(t,e)=>{const s=new Map;for(const i of t||[])!Eo(i?.cm)||!e&&i.cm<=0||s.set(i.cm,(s.get(i.cm)||0)+1);return s},Ho=t=>[String(t),"см"].join(" ");function Go(t,e,s={}){if(s.allowClear)return[];const i=!0===s.exactMultiplicity,o=Bo(t,i),a=Bo(e,i),n=[];for(const[t,e]of o){const s=a.get(t)||0;0===s?n.push({invariant:"wall_records",kind:"lost",owner:Ho(t),reference:`было ${e}`,detail:"записи этой толщины исчезли целиком"}):i&&s!==e&&n.push({invariant:"wall_records",kind:"count",owner:Ho(t),reference:`было ${e}, стало ${s}`,detail:"изменилось число записей этой толщины"})}if(i)for(const[t,e]of a)o.has(t)||n.push({invariant:"wall_records",kind:"count",owner:Ho(t),reference:`было 0, стало ${e}`,detail:"появились записи новой толщины"});return n}class Wo{constructor(){this._selectedRoomId=null,this._session=null,this._eligibility=null}get dragging(){return null!==this._session}ownsPointer(t){return this._session?.pointerId===t}get selectedRoomId(){return this._selectedRoomId}get snapshotIdentity(){return this._session?.snapshotIdentity||null}get activePointerId(){return this._session?.pointerId??null}get moved(){return!0===this._session?.moved}get delta(){return this._session?.delta||0}get rooms(){return this._session?.rooms||null}get openings(){return this._session?.openings||null}get plan(){return this._session?.plan||null}get preview(){return this._session?.accepted?.preview||null}get liveLabels(){return this._session?.accepted?.labels||null}selectRoom(t){this._selectedRoomId=t}restoreSelection(t){this._selectedRoomId=t}escapeIdle(){return this._selectedRoomId?(this._selectedRoomId=null,"selection-cleared"):"exit-tool"}resolve(t,e,s){this._eligibility&&this._eligibility.context===t||(this._eligibility={context:t,values:new Map});const i=this._eligibility.values.get(e);if(i)return i;const o=s();return this._eligibility.values.set(e,o),o}begin(t){return!this._session&&(this._session={pointerId:t.pointerId,start:[...t.start],roomId:t.roomId,plan:t.plan,options:t.options,rooms:t.rooms,openings:t.openings,snapshotIdentity:t.snapshotIdentity,before:t.before,moved:!1,delta:0,changedRoomIds:[...t.plan.roomIds],rejectionNotified:!1,wallUnionBefore:t.wallUnionBefore,accepted:null},!0)}move(t){const e=this._session;if(!e||e.pointerId!==t.pointerId)return{kind:"no-op"};const s=(i=e.start,o=t.point,a=e.plan.n,[i?.[0],i?.[1],o?.[0],o?.[1],a?.[0],a?.[1]].every(Number.isFinite)?(o[0]-i[0])*a[0]+(o[1]-i[1])*a[1]:0);var i,o,a;const n=t.snap([e.plan.a[0]+e.plan.n[0]*s,e.plan.a[1]+e.plan.n[1]*s]),r=(n[0]-e.plan.a[0])*e.plan.n[0]+(n[1]-e.plan.a[1])*e.plan.n[1],l=function(t,e,s,i,o,a){if(!Number.isFinite(i)||Math.abs(i)<1e-9)return 0;const n=Math.sign(i),r=Math.abs(i),l=Math.max(Math.abs(o),1e-6);let h=Lo.get(s);h&&h.opts===a||(h={opts:a,values:new Map},Lo.set(s,h));const c=h.values;let d=0;for(let i=Math.min(l,r),o=0;o<4096&&i<=r+1e-9;o++,i=Math.min(r,i+l)){const o=n*i,h=`${o.toFixed(9)}|${l.toFixed(9)}`;let p=c.get(h);if(void 0===p&&(p=Oo(t,e,s,o,a),c.size<4096&&c.set(h,p)),!p)break;if(d=o,Math.abs(i-r)<=1e-9)break}return d}(e.rooms,e.openings,e.plan,r,t.step,e.options);if(e.moved&&l===e.delta)return{kind:"no-op"};const h=No(e.rooms,e.openings,e.plan,l);let c;try{if(c=t.project(e.snapshotIdentity,h.polys,h.openings,e.changedRoomIds,e.rooms),!c.ok)return this._projectionRejected(e);if(Go(c.value.beforeWalls,c.value.afterWalls,{exactMultiplicity:!0}).length)return this._projectionRejected(e)}catch{return this._projectionRejected(e)}const d=e.accepted,p={preview:c.value.preview,labels:null,artifact:c.value.artifact,beforeWalls:c.value.beforeWalls,afterWalls:c.value.afterWalls};e.accepted=p;try{t.publish(p.preview,p.artifact),p.labels=t.measure(h,e.plan)}catch{e.accepted=d;try{t.publish(d?.preview||null,d?.artifact||null)}catch{}return this._projectionRejected(e)}return e.moved=!0,e.delta=l,{kind:"accepted",preview:c.value.preview,labels:p.labels,artifact:c.value.artifact}}finish(t){const e=this._session;if(!e||e.pointerId!==t.pointerId)return{kind:"no-op"};const s=e.accepted;let i;if(e.moved&&Math.abs(e.delta)>1e-9&&s)if(t.currentSnapshotIdentity!==e.snapshotIdentity)i={kind:"rejected",reason:"stale-snapshot"};else if(Oo(e.rooms,e.openings,e.plan,e.delta,e.options))if(Go(s.beforeWalls,s.afterWalls,{exactMultiplicity:!0}).length)i={kind:"rejected",reason:"wall-records"};else{let o=!1;try{o=t.validatePreview(s.preview)}catch{o=!1}i=o?{kind:"commit",preview:s.preview,before:e.before}:{kind:"rejected",reason:"invalid-candidate"}}else i={kind:"rejected",reason:"invalid-topology"};else i={kind:"no-op"};return this._session=null,"commit"===i.kind&&(this._eligibility=null),i}cancel(t,e){const s=this._session;return!s||void 0!==e&&s.pointerId!==e?{kind:"no-op"}:(this._session=null,this._eligibility=null,{kind:"cancelled",restoreWallUnion:t===s.snapshotIdentity?s.wallUnionBefore:null})}reset(){this._selectedRoomId=null,this._session=null,this._eligibility=null}_projectionRejected(t){const e=!t.rejectionNotified;return t.rejectionNotified=!0,{kind:"rejected",notify:e}}}const jo=(t,e)=>[(t[0]-e.x)/Math.max(1e-9,e.w)*e.stageWidth,(t[1]-e.y)/Math.max(1e-9,e.h)*e.stageHeight];function qo(t){const{poly:e,edge:s,text:i,view:o}=t,a=e[s],n=e[(s+1)%e.length],r=[(a[0]+n[0])/2,(a[1]+n[1])/2],l=function(t,e){const s=t[e],i=t[(e+1)%t.length],o=i[0]-s[0],a=i[1]-s[1],n=Math.hypot(o,a)||1;return(t=>{let e=0;for(let s=0;s<t.length;s++){const i=t[s],o=t[(s+1)%t.length];e+=i[0]*o[1]-o[0]*i[1]}return e/2})(t)>=0?[-a/n,o/n]:[a/n,-o/n]}(e,s),h=Math.hypot(n[0]-a[0],n[1]-a[1])||1,c=[(n[0]-a[0])/h,(n[1]-a[1])/h],d=jo(r,o),p=jo(t.gearCenter,o),_=Math.max(34,7.2*i.length+12),u=Math.abs(l[0])>=Math.abs(l[1])?Math.max(28,_/2+4):Math.max(28,13),m=d[0]+l[0]*u,g=d[1]+l[1]*u,f=e=>{return s=m+c[0]*e,i=g+c[1]*e,o=_,a=18,n=p[0],r=p[1],l=t.gearWidthPx,h=t.gearHeightPx,2*Math.abs(s-n)<o+l+8&&2*Math.abs(i-r)<a+h+8;var s,i,o,a,n,r,l,h};let b=0;if(f(0)){const t=(Math.abs(c[0])>=Math.abs(c[1])?c[0]:c[1])>0?-1:1,e=Math.max(o.stageWidth,o.stageHeight,64);for(let s=4;s<=e;s+=4){const e=s*t;if(!f(e)){b=e;break}const i=-e;if(!f(i)){b=i;break}}}const y=l[0]*u+c[0]*b,v=l[1]*u+c[1]*b,$=Math.hypot(y,v)||1,w=v/$*12,k=[r[0]+y/$*12*o.w/Math.max(1,o.stageWidth),r[1]+w*o.h/Math.max(1,o.stageHeight)];return{anchor:r,offsetXPx:y,offsetYPx:v,tangentOffsetPx:b,side:Math.abs(l[0])>=Math.abs(l[1])?l[0]<0?"left":"right":l[1]<0?"above":"below",leader:{a:r,b:k}}}const Uo=1e-9,Ko=1e7,Vo=t=>{const e=Math.sign(t)*Math.floor(Math.abs(t)*Ko+.5)/Ko;return Object.is(e,-0)?0:e},Jo=t=>`${Vo(t[0])},${Vo(t[1])}`,Yo=(t,e)=>Math.hypot(e[0]-t[0],e[1]-t[1]),Xo=(t,e)=>Math.atan2(e[1]-t[1],e[0]-t[0]),Zo=t=>Array.isArray(t)&&t.length>=2&&t.every(t=>Number.isFinite(t)),Qo=t=>(t||[]).filter(t=>Zo(t?.a)&&Zo(t?.b)&&Yo(t.a,t.b)>Uo);function ta(t,{minAngleDeg:e=15,maxValence:s=6}={}){const i=new Map;for(const e of Qo(t))for(const[t,s]of[[e.a,e.b],[e.b,e.a]]){const e=i.get(Jo(t))||[];e.push(Xo(t,s)),i.set(Jo(t),e)}const o=[];for(const[t,a]of i){if(a.length>s&&o.push({rule:"valence",subject:t,actual:a.length,limit:s}),a.length<2)continue;const i=[...a].sort((t,e)=>t-e);let n=1/0;for(let t=0;t<i.length;t++){let e=i[(t+1)%i.length]-i[t];t===i.length-1&&(e+=2*Math.PI);const s=180*e/Math.PI;s>Uo&&s<n&&(n=s)}n<e-1e-9&&o.push({rule:"angle",subject:t,actual:n,limit:e})}return o}const ea=t=>(180*Math.atan2(t.b[1]-t.a[1],t.b[0]-t.a[0])/Math.PI%180+180)%180,sa=(t,e,s=1)=>{const i=Math.abs(ea(t)-ea(e));return Math.min(i,180-i)<=s},ia=t=>{const e=new Map;for(const s of t)for(const t of[s.a,s.b]){const i=e.get(Jo(t));i?i.push(s):e.set(Jo(t),[s])}return e};function oa(t,e,s){const i=Qo(e),o=s??ia(i),a=new Set([t]);let n=Yo(t.a,t.b);const r=[t.a,t.b];for(;r.length;){const e=r.pop();for(const s of o.get(Jo(e))||[])a.has(s)||sa(s,t)&&Number(s.cm||0)===Number(t.cm||0)&&(a.add(s),n+=Yo(s.a,s.b),r.push(s.a,s.b))}return n}function aa(t,e,s,{minLengthCm:i=20}={}){const o=[],a=Qo(t),n=ia(a);for(const t of a){const r=oa(t,a,n)/s*(e||1),l=Math.max(i,Number(t.cm)>0?Number(t.cm):0);r<l-1e-9&&o.push({rule:"length",subject:String(t.id||Jo(t.a)),actual:r,limit:l})}return o}const na=(t,e,s)=>{const i=s[0]-e[0],o=s[1]-e[1],a=i*i+o*o,n=a<=Uo?0:Math.max(0,Math.min(1,((t[0]-e[0])*i+(t[1]-e[1])*o)/a));return Math.hypot(t[0]-(e[0]+i*n),t[1]-(e[1]+o*n))};function ra(t,e,s,{minDistanceCm:i=5}={}){const o=Qo(t),a=new Map;for(const t of o)a.set(Jo(t.a),t.a),a.set(Jo(t.b),t.b);const n=((t,e,s)=>t/(e||1)*s)(i,e,s),r=n>Uo?n:1,l=(t,e)=>`${Math.floor(t/r)},${Math.floor(e/r)}`,h=new Map;for(const[t,e]of a){const s=l(e[0],e[1]),i=h.get(s);i?i.push([t,e]):h.set(s,[[t,e]])}const c=new Map;for(const t of o){const e=Math.min(t.a[0],t.b[0])-n,s=Math.max(t.a[0],t.b[0])+n,i=Math.min(t.a[1],t.b[1])-n,o=Math.max(t.a[1],t.b[1])+n;for(let a=Math.floor(e/r);a<=Math.floor(s/r);a++)for(let e=Math.floor(i/r);e<=Math.floor(o/r);e++){const s=`${a},${e}`,i=c.get(s);i?i.push(t):c.set(s,[t])}}const d=[];for(const[t,o]of a){const a=Math.floor(o[0]/r),l=Math.floor(o[1]/r);for(let r=-1;r<=1;r++)for(let c=-1;c<=1;c++)for(const[p,_]of h.get(`${a+r},${l+c}`)||[]){if(t>=p)continue;const a=Yo(o,_);a<=2e-7||a<n-1e-9&&d.push({rule:"distance",subject:`${t} ↔ ${p}`,actual:a/s*(e||1),limit:i})}for(const r of c.get(`${a},${l}`)||[]){if(Jo(r.a)===t||Jo(r.b)===t)continue;const a=na(o,r.a,r.b);a<=2e-7||a<n-1e-9&&d.push({rule:"distance",subject:`${t} → ${String(r.id||Jo(r.a))}`,actual:a/s*(e||1),limit:i})}}return d}function la(t,e,s,i,{minClearanceCm2:o=25}={}){const a=(e||[]).filter(Zo),n=a.length<3?0:Math.abs(a.reduce((t,e,s)=>{const i=a[(s+1)%a.length];return t+(e[0]*i[1]-i[0]*e[1])},0))/2,r=(s||1)/i,l=n*r*r;return l<o-1e-9?[{rule:"clearance",subject:t,actual:l,limit:o}]:[]}const ha=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);function ca(t){const{hass:e,devices:s,markers:i,showEntities:o,currentBinding:a,currentDeviceId:n,labels:r}=t,l=x(i),h=new Set(i.filter(t=>t.removed).map(t=>t.binding)),c=new Set;for(const t of s)t.id!==n&&("device"===t.bindingKind&&t.bindingRef&&c.add(`device:${t.bindingRef}`),"entity"===t.bindingKind&&t.bindingRef&&c.add(`entity:${t.bindingRef}`));const d=new Set;for(const t of s)"device"===t.bindingKind&&t.name&&d.add(`${t.name.trim()}|${t.area||""}`);const p=[];for(const t of Object.values(e?.devices||{})){if(!t||"service"===t.entry_type)continue;const e=`device:${t.id}`;if(c.has(e))continue;const s=String(t.name_by_user||t.name||t.id).trim();e!==a&&!h.has(e)&&d.has(`${s}|${t.area_id||""}`)||p.push({value:e,label:s,sub:(t.model||r.device)+("Group"===t.model?r.z2mGroup:""),kind:"device",ref:t.id,areaId:t.area_id||"",model:t.model||""})}for(const[t,s]of Object.entries(e?.entities||{})){const i=`entity:${t}`;if(c.has(i))continue;if(S(e,t,l)&&!h.has(i))continue;const o=ha.has(s?.platform),a="group"===s?.platform;if(!o&&!a)continue;if(s?.hidden&&!h.has(i))continue;const n=e?.states?.[t];p.push({value:i,label:s?.name||n?.attributes?.friendly_name||t,sub:`${t.split(".")[0]} · ${a?r.group:r.helper}`,kind:"entity",ref:t,areaId:s?.area_id||s?.device_id&&e?.devices?.[s.device_id]?.area_id||"",model:"",parentDeviceId:s?.device_id||void 0})}if(o){const t=new Set(p.map(t=>t.value));for(const[s,i]of Object.entries(e?.entities||{})){const o=`entity:${s}`;if(c.has(o)||t.has(o)||i?.hidden&&!h.has(o))continue;const a=!!i?.device_id&&l.devices.has(i.device_id);if(S(e,s,l)&&!h.has(o)&&!a)continue;const n=e?.states?.[s],d=i?.device_id?e?.devices?.[i.device_id]:null,_=d?String(d.name_by_user||d.name||""):"";p.push({value:o,label:i?.name||n?.attributes?.friendly_name||s,sub:`${s.split(".")[0]} · ${r.entity}${_?` · ${_}`:""}`,kind:"entity",ref:s,areaId:i?.area_id||d?.area_id||"",model:"",parentDeviceId:i?.device_id||void 0})}}return p.sort((t,e)=>t.label.localeCompare(e.label)||t.value.localeCompare(e.value))}const da={kind:"active",enabledEntityIds:[],allEntityIds:[]};function pa(t){return t.startsWith("entity:")?"entity":"device"}function _a(t){const e=t.binding.indexOf(":"),s=e>=0?t.binding.slice(e+1):"",i=Object.keys(t).filter(t=>!["id","binding","hidden"].includes(t));return t.id===`h${s}`&&0===i.length}const ua=.001;function ma(t){return!!t&&t.length>=2&&Number.isFinite(t[0])&&Number.isFinite(t[1])}function ga(t){return`${t[0].toFixed(6)},${t[1].toFixed(6)}`}function fa(t,e,s){return Math.abs(t[0]-e[0])<s&&Math.abs(t[1]-e[1])<s}function ba(t,e){const s=function(t,e){return t[0]-e[0]||t[1]-e[1]}(t,e)<=0?t:e,i=s===t?e:t;return[[s[0],s[1]],[i[0],i[1]]]}function ya(t){const[e,s]=ba(t.a,t.b);return`${t.kind}|${t.id}|${ga(e)}|${ga(s)}`}function va(t,e,s){const[i,o]=ba(e,s);return`${ya(t)}|${ga(i)}|${ga(o)}`}function $a(t){return"room"===t?0:"draft"===t?1:2}function wa(t,e,s){return fa(t,[e[0],e[1]],s)||fa(t,[e[2],e[3]],s)}function ka(t){const e=t.epsilon??ua,s=[];for(const[e,i]of M(t.space.rooms).entries())i.length<4||s.push({a:[i[0],i[1]],b:[i[2],i[3]],kind:"room",id:`room-edge-${e}`,cuts:[]});for(const i of t.space.room_drafts||[])if(i.id!==t.activeDraftId)for(let t=0;t+1<i.points.length;t++){const o=i.points[t],a=i.points[t+1];ma(o)&&ma(a)&&!fa(o,a,e)&&s.push({a:[o[0],o[1]],b:[a[0],a[1]],kind:"draft",id:`${i.id}:${t}`,cuts:[]})}for(const i of t.space.partitions||[])ma(i.a)&&ma(i.b)&&!fa(i.a,i.b,e)&&s.push({a:[i.a[0],i.a[1]],b:[i.b[0],i.b[1]],kind:"partition",id:i.id,cuts:[]});const i=s.filter(t=>"room"!==t.kind&&s.some(s=>s!==t&&function(t,e,s){const i=t.b[0]-t.a[0],o=t.b[1]-t.a[1],a=Math.hypot(i,o);if(!(a>s))return!1;const n=i/a,r=o/a,l=e=>Math.abs((e[0]-t.a[0])*r-(e[1]-t.a[1])*n);if(l(e.a)>s||l(e.b)>s)return!1;const h=(e.a[0]-t.a[0])*n+(e.a[1]-t.a[1])*r,c=(e.b[0]-t.a[0])*n+(e.b[1]-t.a[1])*r;return Math.min(a,Math.max(h,c))-Math.max(0,Math.min(h,c))>s}(t,s,e))),o=i.map(t=>{const[e,s]=ba(t.a,t.b);return{a:e,b:s,key:`hidden|${va(t,e,s)}`,sourceKind:t.kind,sourceId:t.id}}).sort((t,e)=>t.key.localeCompare(e.key)),a=i.flatMap(t=>[t.a,t.b].map((e,s)=>({point:[e[0],e[1]],key:`hidden|${ya(t)}|endpoint-${s}`,sourceKind:t.kind,sourceId:t.id}))).sort((t,e)=>t.key.localeCompare(e.key));return{segments:o,endpoints:a}}function xa(t){const e=t.epsilon??ua,s=t.roomCuts||[],i=new Map;for(const e of t.partitionCuts||[]){if("string"!=typeof e.hostId||!e.hostId||!ma(e.a)||!ma(e.b))continue;const t=i.get(e.hostId)||[];t.push([e.a[0],e.a[1],e.b[0],e.b[1]]),i.set(e.hostId,t)}const o=[];for(const[e,i]of M(t.space.rooms).entries())i.length<4||o.push({a:[i[0],i[1]],b:[i[2],i[3]],kind:"room",id:`room-edge-${e}`,cuts:s});for(const e of t.space.room_drafts||[])if(e.id!==t.activeDraftId)for(let t=0;t+1<e.points.length;t++){const s=e.points[t],i=e.points[t+1];ma(s)&&ma(i)&&o.push({a:[s[0],s[1]],b:[i[0],i[1]],kind:"draft",id:`${e.id}:${t}`,cuts:[]})}for(const e of t.space.partitions||[])ma(e.a)&&ma(e.b)&&o.push({a:[e.a[0],e.a[1]],b:[e.b[0],e.b[1]],kind:"partition",id:e.id,cuts:i.get(e.id)||[]});const a=new Map,n=new Map;for(const t of o){const s=[t.a[0],t.a[1],t.b[0],t.b[1]],i=D([s],t.cuts,e);if(i.length){for(const s of i){if(s.length<4)continue;const[i,o]=ba([s[0],s[1]],[s[2],s[3]]);if(fa(i,o,e))continue;const n=`${ga(i)}|${ga(o)}`,r={a:i,b:o,key:va(t,i,o),sourceKind:t.kind,sourceId:t.id},l=a.get(n);(!l||$a(r.sourceKind)<$a(l.sourceKind)||$a(r.sourceKind)===$a(l.sourceKind)&&r.key.localeCompare(l.key)<0)&&a.set(n,r)}for(const s of[t.a,t.b]){if(!i.some(t=>wa(s,t,e)))continue;const t=ga(s);n.has(t)||n.set(t,{point:[s[0],s[1]],key:t})}}}return{segments:[...a.values()].sort((t,e)=>t.key.localeCompare(e.key)),endpoints:[...n.values()].sort((t,e)=>t.key.localeCompare(e.key))}}function Sa(t,e,s){return e.some(e=>ma(e)&&fa(t,e,s))}function Ma(t,e,s){if(!s)return!0;const i=t-s.distance;return i<-1e-9||Math.abs(i)<=1e-9&&e.localeCompare(s.key)<0}function Da(t,e,s){const i=s.epsilon??ua,o=s.excludePoints||[],a=[...t.endpoints,...(s.extraEndpoints||[]).filter(t=>ma(t.point)).map(t=>({point:[t.point[0],t.point[1]],key:t.key}))],n=new Map;for(const t of a){if(Sa(t.point,o,i))continue;const e=ga(t.point),s=n.get(e);(!s||t.key.localeCompare(s.key)<0)&&n.set(e,t)}return[...n.values()].map(t=>({kind:"endpoint",point:[...t.point],key:t.key,distance:Math.hypot(e[0]-t.point[0],e[1]-t.point[1])})).filter(t=>t.distance<=s.tolerance).sort((t,e)=>t.distance-e.distance||t.key.localeCompare(e.key))}function Ca(t,e){if(!t.length)return null;if(e>0){const s=new Set;for(let i=0;i<t.length;i++)for(let o=i+1;o<t.length;o++)Math.hypot(t[i].point[0]-t[o].point[0],t[i].point[1]-t[o].point[1])<e&&(s.add(t[i].key),s.add(t[o].key));if(s.size>1)return{kind:"ambiguous",candidate:null,conflicts:t.filter(t=>s.has(t.key)).map(t=>({point:[...t.point],key:t.key}))}}return{kind:"resolved",candidate:t[0],conflicts:[]}}function Pa(t,e,s){const i=t.b[0]-t.a[0],o=t.b[1]-t.a[1],a=Math.hypot(i,o);if(!(a>0))return[...t.a];const n=i/a,r=o/a,l=Math.max(0,Math.min(a,(e[0]-t.a[0])*n+(e[1]-t.a[1])*r)),h=s>0?Math.max(0,Math.min(a,Math.round(l/s)*s)):l;return[t.a[0]+n*h,t.a[1]+r*h]}function Ia(t,e,s){if(!(ma(e)&&ma(s.anchor)&&s.tolerance>=0))return{kind:"none",candidate:null,conflicts:[]};const i=s.epsilon??ua,o=function(t,e){const s=e[0]-t[0],i=e[1]-t[1];if(!(Math.hypot(s,i)>Number.EPSILON))return null;const o=Math.round(Math.atan2(i,s)/(Math.PI/4))*(Math.PI/4);return[Math.cos(o),Math.sin(o)]}(s.anchor,e);if(!o)return{kind:"none",candidate:null,conflicts:[]};const a=Da(t,e,s).filter(t=>function(t,e,s,i){const o=t[0]-e[0],a=t[1]-e[1];return o*s[0]+a*s[1]>i&&Math.abs(o*s[1]-a*s[0])<=i*Math.max(Math.hypot(o,a),1)}(t.point,s.anchor,o,i)),n=Ca(a,s.distinguishTolerance||0);if(n)return n;let r=null;for(const a of t.segments){const t=a.b[0]-a.a[0],n=a.b[1]-a.a[1],l=a.a[0]-s.anchor[0],h=a.a[1]-s.anchor[1],c=o[0]*n-o[1]*t;let d=null;if(Math.abs(c)<=i*Math.max(Math.hypot(t,n),1)){if(Math.abs(l*o[1]-h*o[0])>i*Math.max(Math.hypot(l,h),1))continue;const t=[a.a,a.b].map(t=>({point:t,along:(t[0]-s.anchor[0])*o[0]+(t[1]-s.anchor[1])*o[1]})).filter(t=>t.along>i).sort((t,e)=>t.along-e.along);t.length&&(d=[...t[0].point])}else{const e=(l*n-h*t)/c,a=(l*o[1]-h*o[0])/c;e>i&&a>=-i&&a<=1+i&&(d=[s.anchor[0]+o[0]*e,s.anchor[1]+o[1]*e])}if(!d)continue;const p=Math.hypot(e[0]-d[0],e[1]-d[1]);p>s.tolerance||Sa(d,s.excludePoints||[],i)||!Ma(p,a.key,r)||(r={kind:"line",point:d,key:a.key,distance:p,segment:a})}return r?{kind:"resolved",candidate:r,conflicts:[]}:{kind:"none",candidate:null,conflicts:[]}}const Ta=.001;function Ra(t,e,s,i){const o=Number.isFinite(t)&&t>0?Math.floor(t):0,a=t=>"number"==typeof t&&Number.isFinite(t)&&t>=0?t:null,n=a(s),r=a(i)??0,l=[];let h=null;for(let t=0;t<o;t++){const s=a(e?.[t])??(t===o-1?n??h??r:h??n??r);l.push(s),h=s}return l}function Fa(t,e){const s=[];for(let i=0;i+1<t.length;i++){const o=t[i],a=t[i+1];!Na(o)||!Na(a)||Math.hypot(a[0]-o[0],a[1]-o[1])<=Number.EPSILON||s.push({a:[o[0],o[1]],b:[a[0],a[1]],cm:e[i]})}return s}function Na(t){return!!t&&t.length>=2&&Number.isFinite(t[0])&&Number.isFinite(t[1])}function za(t,e,s,i){return t*i-e*s}function Aa(t){let e=0;for(let s=0;s<t.length;s++){const i=t[s],o=t[(s+1)%t.length];e+=i[0]*o[1]-o[0]*i[1]}return e/2}function Oa(t,e){const s=Math.max(e,Number.EPSILON),i=Math.round(t[0]/s)*s,o=Math.round(t[1]/s)*s;return[Object.is(i,-0)?0:i,Object.is(o,-0)?0:o]}function La(t,e){const s=Oa(t,e);return`${Math.round(s[0]/e)},${Math.round(s[1]/e)}`}function Ea(t,e){return t.localeCompare(e)<=0?`${t}|${e}`:`${e}|${t}`}function Ba(t){if(!t.length)return"";const e=[];for(const s of[t,[...t].reverse()])for(let t=0;t<s.length;t++)e.push([...s.slice(t),...s.slice(0,t)].join(";"));return e.sort((t,e)=>t.localeCompare(e)),e[0]}function Ha(t,e,s){const i=[...t];for(let t=!0;t&&i.length>=3;){t=!1;for(let o=0;o<i.length;o++){const a=e.get(i[(o-1+i.length)%i.length]),n=e.get(i[o]),r=e.get(i[(o+1)%i.length]),l=n[0]-a[0],h=n[1]-a[1],c=r[0]-n[0],d=r[1]-n[1];if(Math.abs(za(l,h,c,d))<=s*Math.max(Math.hypot(l,h),Math.hypot(c,d),1)&&l*c+h*d>=0){i.splice(o,1),t=!0;break}}}return i}function Ga(t,e){const s=t.map(t=>Math.max(0,Math.min(1,t))).sort((t,e)=>t-e),i=[];for(const t of s)(!i.length||Math.abs(t-i[i.length-1])>e)&&i.push(t);return i}function Wa(t,e){return[t.a[0]+(t.b[0]-t.a[0])*e,t.a[1]+(t.b[1]-t.a[1])*e]}function ja(t,e,s){const i=function(t,e){const s=e.b[0]-e.a[0],i=e.b[1]-e.a[1],o=s*s+i*i;return o>0?((t[0]-e.a[0])*s+(t[1]-e.a[1])*i)/o:0}(t,e);if(i<-s||i>1+s)return null;const o=Wa(e,i);return Math.hypot(o[0]-t[0],o[1]-t[1])<=s?Math.max(0,Math.min(1,i)):null}function qa(t,e,s,i,o){const a=t.b[0]-t.a[0],n=t.b[1]-t.a[1],r=e.b[0]-e.a[0],l=e.b[1]-e.a[1],h=e.a[0]-t.a[0],c=e.a[1]-t.a[1],d=za(a,n,r,l),p=Math.max(Math.hypot(a,n),Math.hypot(r,l),1);if(Math.abs(d)>o*p){const t=za(h,c,r,l)/d,e=za(h,c,a,n)/d;return void(t>=-o&&t<=1+o&&e>=-o&&e<=1+o&&(s.push(Math.max(0,Math.min(1,t))),i.push(Math.max(0,Math.min(1,e)))))}if(!(Math.abs(za(h,c,a,n))>o*p)){for(const i of[e.a,e.b]){const e=ja(i,t,o);null!=e&&s.push(e)}for(const s of[t.a,t.b]){const t=ja(s,e,o);null!=t&&i.push(t)}}}function Ua(t){let e=t+1|0;return e^=e<<13,e^=e>>>17,e^=e<<5,e>>>0}function Ka(t,e){return t.minY-e.minY||t.index-e.index}function Va(t){return t.subtreeMaxY=Math.max(t.item.maxY,t.left?.subtreeMaxY??-1/0,t.right?.subtreeMaxY??-1/0),t}function Ja(t){const e=t.right;return t.right=e.left,e.left=Va(t),Va(e)}function Ya(t){const e=t.left;return t.left=e.right,e.right=Va(t),Va(e)}function Xa(t,e){return t?(Ka(e,t.item)<0?(t.left=Xa(t.left,e),t.left.priority<t.priority&&(t=Ya(t))):(t.right=Xa(t.right,e),t.right.priority<t.priority&&(t=Ja(t))),Va(t)):{item:e,priority:Ua(e.index),subtreeMaxY:e.maxY,left:null,right:null}}function Za(t,e){if(!t)return null;const s=Ka(e,t.item);if(s<0)t.left=Za(t.left,e);else if(s>0)t.right=Za(t.right,e);else{if(!t.left)return t.right;if(!t.right)return t.left;t.left.priority<t.right.priority?(t=Ya(t)).right=Za(t.right,e):(t=Ja(t)).left=Za(t.left,e)}return Va(t)}function Qa(t,e,s,i){!t||t.subtreeMaxY<e||(null!=t.left?.subtreeMaxY&&t.left.subtreeMaxY>=e&&Qa(t.left,e,s,i),t.item.minY<=s&&t.item.maxY>=e&&i.push(t.item),t.item.minY<=s&&Qa(t.right,e,s,i))}function tn(t,e=.001){const s=Number.isFinite(e)&&e>0?e:Ta,i=t.filter(t=>Na(t.a)&&Na(t.b)&&"string"==typeof t.key&&t.key.length>0&&Math.hypot(t.b[0]-t.a[0],t.b[1]-t.a[1])>s),o=i.map(()=>[0,1]);!function(t,e,s){const i=t.map((t,e)=>({index:e,minX:Math.min(t.a[0],t.b[0])-s,maxX:Math.max(t.a[0],t.b[0])+s,minY:Math.min(t.a[1],t.b[1])-s,maxY:Math.max(t.a[1],t.b[1])+s})),o=[...i].sort((t,e)=>t.minX-e.minX||t.minY-e.minY||t.index-e.index),a=[...i].sort((t,e)=>t.maxX-e.maxX||t.index-e.index),n=new Set;let r=null,l=0;for(const i of o){for(;l<a.length&&a[l].maxX<i.minX;){const t=a[l++];n.delete(t.index)&&(r=Za(r,t))}const o=[];Qa(r,i.minY,i.maxY,o),o.sort((t,e)=>t.index-e.index);for(const a of o)qa(t[a.index],t[i.index],e[a.index],e[i.index],s);n.add(i.index),r=Xa(r,i)}}(i,o,s);const a=new Map;for(let t=0;t<i.length;t++){const e=i[t],n=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),r=Ga(o[t],s/Math.max(n,1));for(let t=0;t+1<r.length;t++){const i=Oa(Wa(e,r[t]),s),o=Oa(Wa(e,r[t+1]),s);if(Math.hypot(o[0]-i[0],o[1]-i[1])<=s)continue;const n=La(i,s),l=La(o,s),h=Ea(n,l),c=a.get(h);c?c.sourceKeys.add(e.key):a.set(h,{a:n.localeCompare(l)<=0?i:o,b:n.localeCompare(l)<=0?o:i,sourceKeys:new Set([e.key])})}}return[...a.entries()].map(([t,e])=>({key:t,a:e.a,b:e.b,sourceKeys:[...e.sourceKeys].sort((t,e)=>t.localeCompare(e))})).sort((t,e)=>t.key.localeCompare(e.key))}function en(t,e=.001){const s=Number.isFinite(e)&&e>0?e:Ta,i=tn(t,s),o=new Map,a=new Map,n=new Map(i.map(t=>[t.key,t]));for(const t of i){const e=La(t.a,s),i=La(t.b,s);o.set(e,t.a),o.set(i,t.b),a.has(e)||a.set(e,new Set),a.has(i)||a.set(i,new Set),a.get(e).add(i),a.get(i).add(e)}const r=new Map;for(const[t,e]of a){const s=o.get(t);r.set(t,[...e].sort((t,e)=>{const i=o.get(t),a=o.get(e);return Math.atan2(i[1]-s[1],i[0]-s[0])-Math.atan2(a[1]-s[1],a[0]-s[0])||t.localeCompare(e)}))}const l=new Set,h=new Map,c=(t,e)=>`${t}>${e}`;for(const t of i){const e=[La(t.a,s),La(t.b,s)];for(const[t,a]of[e,[e[1],e[0]]]){if(l.has(c(t,a)))continue;const e=[],d=[];let p=t,_=a,u=!1;for(let s=0;s<=2*i.length+2;s++){const s=c(p,_);if(l.has(s)){u=p===t&&_===a;break}l.add(s),e.push(p),d.push(Ea(p,_));const i=r.get(_)||[],o=i.indexOf(p);if(o<0||!i.length)break;if(p=_,_=i[(o-1+i.length)%i.length],p===t&&_===a){u=!0;break}}if(!u||new Set(e).size<3||new Set(e).size!==e.length)continue;const m=e.map(t=>o.get(t)),g=Aa(m);if(!(g>s*s))continue;const f=Ba(Ha(e,o,s)),b=new Set;for(const t of d)for(const e of n.get(t)?.sourceKeys||[])b.add(e);const y={ring:m,key:f,area:g,atomKeys:[...d],sourceKeys:[...b].sort((t,e)=>t.localeCompare(e))};h.has(f)||h.set(f,y)}}return{atoms:i,faces:[...h.values()].sort((t,e)=>t.area-e.area||t.key.localeCompare(e.key))}}function sn(t,e,s=.001){if(!Na(e))return null;const i=t.faces.filter(t=>{if(t.ring.some((i,o)=>function(t,e,s,i){const o=s[0]-e[0],a=s[1]-e[1],n=o*o+a*a;if(!(n>0))return Math.hypot(t[0]-e[0],t[1]-e[1])<=i;const r=((t[0]-e[0])*o+(t[1]-e[1])*a)/n;return!(r<0||r>1)&&Math.hypot(e[0]+o*r-t[0],e[1]+a*r-t[1])<=i}(e,i,t.ring[(o+1)%t.ring.length],s)))return!1;let i=!1;for(let s=0,o=t.ring.length-1;s<t.ring.length;o=s++){const a=t.ring[s],n=t.ring[o];a[1]>e[1]!=n[1]>e[1]&&e[0]<(n[0]-a[0])*(e[1]-a[1])/(n[1]-a[1])+a[0]&&(i=!i)}return i});return[...i].sort((t,e)=>t.area-e.area||t.key.localeCompare(e.key))[0]||null}function on(t,e,s){const i=s[0]-e[0],o=s[1]-e[1],a=i*i+o*o,n=a>0?Math.max(0,Math.min(1,((t[0]-e[0])*i+(t[1]-e[1])*o)/a)):0;return Math.hypot(e[0]+i*n-t[0],e[1]+o*n-t[1])}function an(t,e,s=.5){let i=Math.abs(t-e)%180;return i>90&&(i=180-i),i<=s}function nn(t,e,s,i){const o=t.filter(t=>"outer"===t.kind&&!t.open&&t.cm>0).map(t=>({interval:t,reusePartitionId:e.find(e=>function(t,e,s){return!(Math.abs(t.cm-e.cm)>1e-6)&&(an(180*Math.atan2(t.b[1]-t.a[1],t.b[0]-t.a[0])/Math.PI,180*Math.atan2(e.b[1]-e.a[1],e.b[0]-e.a[0])/Math.PI,.001)&&on(e.a,t.a,t.b)<=s&&on(e.b,t.a,t.b)<=s)}(e,t,i))?.id||null})),a=new Map;for(const e of s){if("partition"===e.host?.kind)continue;const s=t.map(t=>{const s=180*Math.atan2(t.b[1]-t.a[1],t.b[0]-t.a[0])/Math.PI;return{interval:t,distance:an(e.angle,s)?on([e.x,e.y],t.a,t.b):1/0}}).filter(t=>t.distance<=i).sort((t,e)=>t.distance-e.distance||t.interval.key.localeCompare(e.interval.key)),o=s[0]?.interval;"outer"===o?.kind&&!o.open&&o.cm>0&&a.set(e.id,o.key)}return{materialize:o,openingIntervals:a,removeOpeningIds:[...a.keys()].sort((t,e)=>t.localeCompare(e))}}function rn(t,e){const s=e.b[0]-e.a[0],i=e.b[1]-e.a[1],o=s*s+i*i;return o>0?Math.max(0,Math.min(1,((t[0]-e.a[0])*s+(t[1]-e.a[1])*i)/o)):0}const ln=t=>!t.key.startsWith("static:room|");function hn(t,e){const s=e.b[0]-e.a[0],i=e.b[1]-e.a[1],o=s*s+i*i;if(!(o>0))return null;const a=((t[0]-e.a[0])*s+(t[1]-e.a[1])*i)/o,n=[e.a[0]+s*a,e.a[1]+i*a];return{point:n,t:a,distance:Math.hypot(n[0]-t[0],n[1]-t[1])}}function cn(t,e){return e>0?Math.hypot(t[0]-Math.round(t[0]/e)*e,t[1]-Math.round(t[1]/e)*e):0}function dn(t,e,s){if(ln(t.source)!==ln(e.source))return ln(t.source)?t:e;const i=cn(t.point,s),o=cn(e.point,s);return Math.abs(i-o)>1e-9?i>o?t:e:function(t,e){return t[0]-e[0]||t[1]-e[1]}(t.point,e.point)>0?t:e}function pn(t){return[t.from[0],t.from[1],t.to[0],t.to[1],t.targetKind].map(t=>"number"==typeof t?t.toFixed(6):t).join("|")}function _n(t,e){return t.map(t=>t.key!==e.sourceKey?t:{...t,[e.endpoint]:[...e.to]})}function un(t,e){const s=e.epsilon??.001;if(!(e.maxDistance>=0)||!e.point&&!e.requiredSourceKey)return{kind:"none"};const i=new Map,o=t.flatMap(t=>[{source:t,endpoint:"a",point:t.a},{source:t,endpoint:"b",point:t.b}]);for(let t=0;t<o.length;t++)for(let a=t+1;a<o.length;a++){const n=o[t],r=o[a];if(n.source===r.source)continue;const l=Math.hypot(n.point[0]-r.point[0],n.point[1]-r.point[1]);if(!(l>s)||l>e.maxDistance)continue;const h=dn(n,r,e.gridStep||0),c=h===n?r:n;if(!ln(h.source))continue;const d={sourceKey:h.source.key,endpoint:h.endpoint,from:[h.point[0],h.point[1]],to:[c.point[0],c.point[1]],targetSourceKey:c.source.key,targetKind:"endpoint",distance:l};i.set(pn(d),d)}for(const a of o)if(ln(a.source))for(const o of t){if(o===a.source)continue;const t=hn(a.point,o);if(!t||t.t<=s||t.t>=1-s||!(t.distance>s)||t.distance>e.maxDistance)continue;const n={sourceKey:a.source.key,endpoint:a.endpoint,from:[a.point[0],a.point[1]],to:t.point,targetSourceKey:o.key,targetKind:"line",distance:t.distance};i.set(pn(n),n)}const a=[];for(const o of i.values()){const i=en(_n(t,o),s),n=e.point?sn(i,e.point,s):i.faces.find(t=>!e.requiredSourceKey||t.sourceKeys.includes(e.requiredSourceKey))||null;n&&a.push({proposal:o,face:n})}if(a.sort((t,e)=>t.proposal.distance-e.proposal.distance||pn(t.proposal).localeCompare(pn(e.proposal))),!a.length)return{kind:"none"};return new Set(a.map(t=>`${pn(t.proposal)}|${t.face.key}`)).size>1?{kind:"ambiguous",proposals:a.map(t=>t.proposal)}:{kind:"repair",...a[0]}}const mn=(t,e)=>(t.composedPath?.()||[t.target]).some(t=>(t=>!!t&&"function"==typeof t.matches)(t)&&e(t));class gn{constructor(t){this.host=t,this._openGroupId=null,this._groupGeneration=0,this._renderedContext="",this._focusOwned=!1,this._currentModel=null,this._blocked=!1,this._dismissPointerTarget=null,this._globalDismissListening=!1,this._globalDismissGuard=t=>{this.handleOutsideDismiss(t)}}get hasOpenGroup(){return null!==this._openGroupId}get groupGeneration(){return this._groupGeneration}activeGroup(t){return this._openGroupId&&t.find(t=>t.id===this._openGroupId)||null}reset(){this._openGroupId=null,this._contentAnimation?.cancel(),this._contentAnimation=void 0,this._renderedContext="",this._focusOwned=!1,this._currentModel=null,this._blocked=!1,this._dismissPointerTarget=null,clearTimeout(this._dismissTimer),this._dismissTimer=void 0,this._syncGlobalDismissListener()}closeForNavigation(){const t="palette"===this._currentModel?.kind?this._currentModel.dismiss:void 0,e=!!this._openGroupId||!!t;this._openGroupId=null,t?.(),t&&(this._currentModel=null),this._clearDismissClick(),e&&this.host.requestUpdate(),this._syncGlobalDismissListener()}openPalette(){this._openGroupId&&this.closeGroup(!1)}toggleGroup(t,e){this._openGroupId!==e?t.some(t=>t.id===e)&&("palette"===this._currentModel?.kind&&this._currentModel.dismiss?.(),this._groupGeneration+=1,this._openGroupId=e,this.host.clearTip(),this.host.requestUpdate(),this._syncGlobalDismissListener()):this.closeGroup(!1)}closeGroup(t){const e=this._openGroupId;this._openGroupId=null,this.host.requestUpdate(),this._syncGlobalDismissListener(),t&&e&&this.host.updateComplete().then(()=>{const t=this.host.root(),s=[...t.querySelectorAll("[data-editor-group]")].find(t=>t.dataset.editorGroup===e&&null!==t.offsetParent);(s||t.querySelector(".editbar-tools"))?.focus?.()})}renderGroupLauncher(t,e,s){const i=this._openGroupId===t.id,a=t.items.find(e=>e.id===t.activeItemId&&!e.disabled);return o`<button class="btn editor-group-launcher ${i||a?"on":""}"
      data-editor-group=${t.id} aria-expanded=${i?"true":"false"}
      aria-pressed=${a?"true":"false"}
      aria-controls="hp-editor-secondary" @click=${()=>this.toggleGroup(e,t.id)}
      @keydown=${s=>{"ArrowDown"===s.key&&(s.preventDefault(),i||this.toggleGroup(e,t.id),this.host.updateComplete().then(()=>this.host.root().querySelector(".editor-group-item:not([disabled])")?.focus()))}}
      title=${a?s.groupActive(t.label,a.label):t.label}>
      <ha-icon icon=${t.icon}></ha-icon><span class="ml">${t.label}</span>
      <ha-icon class="group-chevron" icon="mdi:chevron-down"></ha-icon>
    </button>`}renderGroupModel(t,e,s){const i=t.items.find(t=>!t.disabled)?.id,n=t.items.some(e=>e.id===t.activeItemId&&!e.disabled)?t.activeItemId:void 0;return{contextId:e,kind:"group",ariaLabel:s.openGroup(t.label),visibleLabel:t.label,content:o`<div class="editor-group-items"
        @keydown=${t=>this._groupKeydown(t)}>
        ${t.items.map(e=>o`<button
          class="btn editor-group-item ${n===e.id?"on":""}"
          data-group-item=${e.id} ?disabled=${!!e.disabled}
          tabindex=${e.id===(n||i)?"0":"-1"}
          aria-label=${e.disabled&&e.disabledReason?s.disabledAction(e.label,e.disabledReason):e.label}
          aria-pressed=${"tool"===e.role||"toggle"===e.role?n===e.id?"true":"false":a}
          title=${e.disabled&&e.disabledReason||e.label}
          @click=${s=>this._activateGroupItem(t,e.id,s)}>
          <ha-icon icon=${e.icon}></ha-icon><span>${e.label}</span>
        </button>`)}
      </div>`}}runContext(t,e,s){t===e&&s()}render(t,e){this._currentModel=t,this._blocked=e;const s=t?.kind||"hidden";return o`<div
      class="editor-secondary-host kind-${s} ${t?"open":"closed"} ${e?"blocked":""}"
      aria-hidden=${t?"false":"true"}>
      <div id="hp-editor-secondary" class="editor-secondary kind-${s}"
        data-context-id=${t?.contextId||""} role="toolbar"
        aria-label=${t?.ariaLabel||""} ?inert=${!t||e}
        @focusin=${()=>this._focusOwned=!0}
        @focusout=${t=>{const e=t.relatedTarget;e&&t.currentTarget.contains(e)||(this._focusOwned=!1)}}
        @pointerenter=${()=>this.host.clearTip()}
        @pointerdown=${fn}
        @pointerup=${fn}
        @pointercancel=${fn}
        @click=${fn}
        @dblclick=${fn}
        @wheel=${fn}>
        ${t?.visibleLabel?o`<span class="editor-context-label">${t.visibleLabel}</span>`:a}
        <div class="editor-secondary-content">${t?.content||a}</div>
      </div>
    </div>`}afterRender(){const t=this.host.root();this._blocked&&(this._openGroupId?this.closeGroup(!1):"palette"===this._currentModel?.kind&&this._currentModel.dismiss?.()),this._syncGlobalDismissListener();const e=t.querySelector(".editor-secondary"),s=this._renderedContext,i=e?.dataset.contextId||"";if(i&&s&&i!==s&&!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches&&(this._contentAnimation?.cancel(),this._contentAnimation=e?.querySelector(".editor-secondary-content")?.animate([{opacity:.35,transform:"translateY(-4px)"},{opacity:1,transform:"translateY(0)"}],{duration:100,easing:"ease-out"})),this._renderedContext=i,s&&i!==s&&this._focusOwned){const s=i?e?.querySelector('[tabindex="0"], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'):t.querySelector(".editbar-tools");s?.focus?.(),this._focusOwned=!!i}if("palette"===this._currentModel?.kind&&this._currentModel.launcherId){const e=[...t.querySelectorAll("[data-editor-palette]")].find(t=>t.dataset.editorPalette===this._currentModel?.launcherId);e&&null!==e.offsetParent||this._currentModel.dismiss?.()}if(!this._openGroupId)return;const o=[...t.querySelectorAll("[data-editor-group]")].find(t=>t.dataset.editorGroup===this._openGroupId);o&&null!==o.offsetParent||this.closeGroup(!0)}handleOutsideDismiss(t){if(mn(t,t=>t.hasAttribute("data-editor-navigation")))return"pointerdown"===t.type?this.closeForNavigation():"click"===t.type&&this._dismissPointerTarget&&this._clearDismissClick(),!1;if("click"===t.type&&this._dismissPointerTarget){return!!(t.composedPath?.()||[t.target]).includes(this._dismissPointerTarget)&&(this._clearDismissClick(),t.preventDefault(),t.stopImmediatePropagation(),!0)}const e=this._openGroupId||this._blocked||"palette"!==this._currentModel?.kind?null:this._currentModel;if("pointerdown"===t.type&&(this._openGroupId||e)){const s=mn(t,t=>t.classList.contains("editor-secondary")),i=mn(t,t=>!!t.dataset.editorGroup),o=mn(t,t=>!!t.dataset.editorPalette),a=mn(t,t=>t.classList.contains("stage"));if(!(s||i||o||"stay-open-on-canvas"===e?.dismissPolicy&&a))return t.preventDefault(),t.stopImmediatePropagation(),this._dismissPointerTarget=t.target,clearTimeout(this._dismissTimer),this._dismissTimer=window.setTimeout(()=>{this._clearDismissClick()},800),this._openGroupId?this.closeGroup(!1):e?.dismiss?.(),this._syncGlobalDismissListener(),!0}return!1}_activateGroupItem(t,e,s){if(t.id!==this._openGroupId)return;const i=t.items.find(t=>t.id===e);if(!i||i.disabled)return;const o="toggle"===i.role&&"stay-open"===i.closePolicy,a=0===s.detail;o||(this._openGroupId=null,this.host.requestUpdate(),this._syncGlobalDismissListener()),i.invoke(),!o&&a&&this.host.updateComplete().then(()=>{const e=[...this.host.root().querySelectorAll("[data-editor-group]")].find(e=>e.dataset.editorGroup===t.id&&null!==e.offsetParent);e?.focus()})}_groupKeydown(t){if(!["ArrowLeft","ArrowRight","Home","End"].includes(t.key))return;const e=[...t.currentTarget.querySelectorAll(".editor-group-item:not([disabled])")];if(!e.length)return;t.preventDefault();const s=e.indexOf(this.host.root().activeElement),i="Home"===t.key?0:"End"===t.key?e.length-1:"ArrowLeft"===t.key?s<=0?e.length-1:s-1:(s+1)%e.length;e[i]?.focus()}_clearDismissClick(){this._dismissPointerTarget=null,clearTimeout(this._dismissTimer),this._dismissTimer=void 0,this._syncGlobalDismissListener()}_syncGlobalDismissListener(){const t=!this._blocked&&"palette"===this._currentModel?.kind,e=!!this._openGroupId||t||!!this._dismissPointerTarget;e!==this._globalDismissListening&&(this._globalDismissListening=e,e?(window.addEventListener("pointerdown",this._globalDismissGuard,!0),window.addEventListener("click",this._globalDismissGuard,!0)):(window.removeEventListener("pointerdown",this._globalDismissGuard,!0),window.removeEventListener("click",this._globalDismissGuard,!0)))}}const fn=t=>t.stopPropagation(),bn=1e-6*I,yn=6*I;function vn(t){return Number.isFinite(t)?Math.round(t/I)*I:t}const $n=(t,e,s,i)=>Math.hypot(s-t,i-e),wn=(t,e,s,i,o,a,n,r)=>Math.hypot(Math.max(Math.abs(o-t),Math.abs(o+n-(t+s))),Math.max(Math.abs(a-e),Math.abs(a+r-(e+i)))),kn=(t,e,s,i,o,a,n)=>{const r=Math.max(Number(i)||0,0)/2,l=Math.PI/180,h=Math.cos(s*l)*r,c=Math.sin(s*l)*r,d=Math.cos(n*l)*r,p=Math.sin(n*l)*r,_=Math.max($n(t+h,e+c,o+d,a+p),$n(t-h,e-c,o-d,a-p)),u=Math.max($n(t+h,e+c,o-d,a-p),$n(t-h,e-c,o+d,a+p));return Math.min(_,u)},xn=t=>{const e=Number(t?.cell_cm);return e>0?e:5};function Sn(t,e){const s=JSON.parse(JSON.stringify(t||[])),i=JSON.parse(JSON.stringify(e||{}));let o=0,a=0,n=0,r=0,l="",h=0,c=0,d=0;const p=(t,e)=>{Number.isFinite(t)&&Number.isFinite(e)&&t!==e&&Math.abs(e-t)<=bn&&c++},_=(t,e)=>{p(t[0],e[0]),p(t[1],e[1])},u={};let m=5;for(const t of s){const e=xn(t);null!=t?.id&&(u[String(t.id)]=e),e>m&&(m=e)}const g=(t,e,s,i=!1)=>{if(!(t>bn||i))return;o++,t>n&&(n=t);const a=t*T*e;a>r&&(r=a,l=s)};for(const t of s){const e=xn(t),s=null!=t?.id?String(t.id):"";for(const i of t.rooms||[]){a++;let t=0;if(i.poly?.length)i.poly=i.poly.map(e=>{const s=[vn(e[0]),vn(e[1])];return t=Math.max(t,$n(e[0],e[1],s[0],s[1])),_(e,s),s});else if(null!=i.x&&null!=i.y){const e=i.x,s=i.y,o=i.w||0,a=i.h||0,n=vn(e+o),r=vn(s+a),l=vn(e),h=vn(s),c=Math.max(I,n-l),d=Math.max(I,r-h);t=wn(e,s,o,a,l,h,c,d),i.x=l,i.y=h,i.w=c,i.h=d,p(e,l),p(s,h),p(e+o,l+c),p(s+a,h+d)}g(t,e,s)}for(const i of t.room_drafts||[]){a++;let t=0;const o=i.points||[],n=o.map(e=>{const s=[vn(e[0]),vn(e[1])];return t=Math.max(t,$n(e[0],e[1],s[0],s[1])),s}),r=n.length?[n[0]]:[],l=n.length?[[o[0],n[0]]]:[],h=[];for(let t=0;t+1<n.length;t++){const e=n[t+1],s=r[r.length-1];s&&$n(s[0],s[1],e[0],e[1])<=bn||(r.push(e),l.push([o[t+1],e]),h.push({...i.segments?.[t]||{},cm:Number.isFinite(Number(i.segments?.[t]?.cm))?Math.max(0,Math.min(100,Number(i.segments[t].cm))):15}))}if(i.points=r,i.segments=h,r.length>=2)for(const[t,e]of l)_(t,e);g(t,e,s)}if(Array.isArray(t.room_drafts)){const e=t.room_drafts.length;t.room_drafts=t.room_drafts.filter(t=>t.points?.length>=2),d+=e-t.room_drafts.length,t.room_drafts.length||delete t.room_drafts}for(const i of t.partitions||[]){a++;const o=[i.a[0],i.a[1]],n=[i.b[0],i.b[1]],r=[vn(o[0]),vn(o[1])],l=[vn(n[0]),vn(n[1])];let h=Math.max($n(o[0],o[1],r[0],r[1]),$n(n[0],n[1],l[0],l[1]));const c=$n(r[0],r[1],l[0],l[1]),d=(t.openings||[]).filter(t=>"partition"===t.host?.kind&&t.host.id===i.id).every(t=>{const e=Number(t.length),s=Number(t.host.t),i=s*c;return Number.isFinite(e)&&e>0&&Number.isFinite(s)&&s>=0&&s<=1&&i-e/2>=-bn&&i+e/2<=c+bn});c>bn&&d?(i.a=r,i.b=l,_(o,r),_(n,l)):h=0,g(h,e,s)}for(const i of t.wall_columns||[]){a++;const t=[i.center[0],i.center[1]],o=[vn(t[0]),vn(t[1])],n=$n(t[0],t[1],o[0],o[1]);i.center=o,_(t,o),g(n,e,s)}for(const i of t.decor||[]){a++;let t=0;if("line"===i.kind){const e=[i.x1,i.y1],s=[i.x2,i.y2],o=[vn(e[0]),vn(e[1])],a=[vn(s[0]),vn(s[1])];t=Math.max($n(e[0],e[1],o[0],o[1]),$n(s[0],s[1],a[0],a[1])),i.x1=o[0],i.y1=o[1],i.x2=a[0],i.y2=a[1],_(e,o),_(s,a)}else{const e=i.x,s=i.y,o=i.w,a=i.h,n=vn(e),r=vn(s);if(null!=i.w&&null!=i.h){const l=vn(e+o),h=vn(s+a),c=Math.max(I,l-n),d=Math.max(I,h-r);t=wn(e,s,o,a,n,r,c,d),i.w=c,i.h=d,p(e+o,n+c),p(s+a,r+d)}else t=$n(e,s,n,r);i.x=n,i.y=r,p(e,n),p(s,r)}g(t,e,s)}for(const i of t.openings||[]){if(a++,"partition"===i.host?.kind){const o=(t.partitions||[]).find(t=>t.id===i.host.id),a=Number(i.host.t);if(!o||!Number.isFinite(a)||a<0||a>1)continue;const n=o.b[0]-o.a[0],r=o.b[1]-o.a[1];if(Math.hypot(n,r)<=bn)continue;const l=o.a[0]+n*a,c=o.a[1]+r*a;let d=180*Math.atan2(r,n)/Math.PI;d>=90?d-=180:d<-90&&(d+=180);const p=Number(i.angle),_=!(Number.isFinite(p)&&p===d),u=kn(i.x,i.y,Number.isFinite(p)?p:d,Number(i.length)||0,l,c,d);i.x=l,i.y=c,i.angle=d,_&&h++,g(u,e,s,_);continue}const o=P([i.x,i.y],t.rooms||[],yn,{step:I,length:Number(i.length)||0});if(!o)continue;const n=Number(i.angle),r=!(Number.isFinite(n)&&n===o.angle),l=kn(i.x,i.y,Number.isFinite(n)?n:o.angle,Number(i.length)||0,o.x,o.y,o.angle);i.x=o.x,i.y=o.y,i.angle=o.angle,r&&h++,g(l,e,s,r)}}for(const[t,e]of Object.entries(i)){if(!e||"object"!=typeof e)continue;const s=e;if("number"!=typeof s.x||"number"!=typeof s.y)continue;a++;const o=vn(s.x),n=vn(s.y),r=$n(s.x,s.y,o,n);i[t]={...s,x:o,y:n},p(s.x,o),p(s.y,n);const l="string"==typeof s.s?s.s:"";g(r,u[l]??m,l)}return{spaces:s,layout:i,report:{moved:o,coordsCanonicalized:c,total:a,maxShift:n,maxShiftCm:r,maxSpace:l,rotated:h,removedDrafts:d},changed:o>0||c>0}}function Mn(t,e){const s=e.base+t*e.span;return Math.min(1,Math.max(0,s))}const Dn=t=>Array.isArray(t)&&t.length>=2&&Number.isFinite(t[0])&&Number.isFinite(t[1]),Cn=(t,e)=>Math.hypot(t[0]-e[0],t[1]-e[1]);function Pn(t,e,s){const i=s[0]-e[0],o=s[1]-e[1],a=i*i+o*o;if(a<=0)return Cn(t,e);let n=((t[0]-e[0])*i+(t[1]-e[1])*o)/a;return n=Math.max(0,Math.min(1,n)),Math.hypot(t[0]-(e[0]+i*n),t[1]-(e[1]+o*n))}function In(t,e,s,i,o){for(const i of e)if(i&&!s.has(i.id)&&Dn(i.a)&&Dn(i.b)&&(Cn(t,i.a)<=o||Cn(t,i.b)<=o))return!0;for(const e of i?.roomPolygons||[])for(let s=0;s<e.length;s++){const i=e[s],a=e[(s+1)%e.length];if(Dn(i)&&Dn(a)&&Pn(t,i,a)<=o)return!0}for(const e of i?.columns||[])if(Dn(e?.center)&&Cn(t,e.center)<=o)return!0;for(const e of i?.draftEnds||[])if(Dn(e)&&Cn(t,e)<=o)return!0;return!1}function Tn(t,e,s,i){if(t.cm!==e.cm)return null;const o=[t.b[0]-t.a[0],t.b[1]-t.a[1]],a=[e.b[0]-e.a[0],e.b[1]-e.a[1]],n=Math.hypot(o[0],o[1]),r=Math.hypot(a[0],a[1]);if(!(n>0&&r>0))return null;if(Math.abs(o[0]/n*(a[1]/r)-o[1]/n*(a[0]/r))>s)return null;for(const[s,o]of[[t.a,e.a],[t.a,e.b],[t.b,e.a],[t.b,e.b]])if(Cn(s,o)<=i)return[(s[0]+o[0])/2,(s[1]+o[1])/2];return null}function Rn(t,e){const s=.05*(Number(e.pitch)>0?Number(e.pitch):1),i=new Map;let o=(t||[]).filter(t=>!!t&&"string"==typeof t.id&&Dn(t.a)&&Dn(t.b));if(o.length<2)return{partitions:[...t||[]],merged:0,openingMoves:[]};const a=e.seedIds&&e.seedIds.length?new Set(e.seedIds):null;let n=0;for(let t=0;t<o.length+1;t++){let t=null;for(let i=0;i<o.length&&!t;i++)for(let n=i+1;n<o.length;n++){const r=Tn(o[i],o[n],.02,s);if(r&&((!a||a.has(o[i].id)||a.has(o[n].id))&&!In(r,o,new Set([o[i].id,o[n].id]),e.geometry,s))){t={i:i,j:n,at:r};break}}if(!t)break;const r=o[t.i],l=o[t.j],h=[r.a,r.b,l.a,l.b].filter(e=>Cn(e,t.at)>s);let c=h[0]??r.a,d=h[h.length-1]??l.b;if(h.length<2&&(c=r.a,d=l.b),d[0]<c[0]||d[0]===c[0]&&d[1]<c[1]){const t=c;c=d,d=t}const p={...r,a:[c[0],c[1]],b:[d[0],d[1]]},_=Cn(c,d),u=_>0?(d[0]-c[0])/_:0,m=_>0?(d[1]-c[1])/_:0,g=t=>_>0?((t[0]-c[0])*u+(t[1]-c[1])*m)/_:0;for(const t of[r,l]){const e=g(t.a),s=g(t.b)-e;for(const[o,a]of i)a.toId===t.id&&i.set(o,{fromId:a.fromId,toId:p.id,base:e+a.base*s,span:a.span*s});i.set(t.id,{fromId:t.id,toId:p.id,base:e,span:s})}a&&a.add(p.id),o=o.filter((e,s)=>s!==t.i&&s!==t.j),o.splice(t.i,0,p),n++}return{partitions:o,merged:n,openingMoves:[...i.values()]}}function Fn(t,e,s,i){if(!t?.length||!s.length)return 0;const o=new Map(s.map(t=>[t.fromId,t]));let a=0;for(const s of t){const t=s?.host;if(!t||"partition"!==t.kind)continue;const n=o.get(t.id);if(!n)continue;s.host={...t,id:n.toId,t:Mn(t.t,n)},a++;const r=F(s,e,i.coordScale,i.cellCm,i.gridPitch).resolved;r&&Object.assign(s,N(s,r,i.coordScale))}return a}function Nn(t,e){const s=e?.excludeDraftId||null;return{roomPolygons:(t?.rooms||[]).map(t=>R(t)).filter(t=>!!t),columns:t?.wall_columns||[],draftEnds:(t?.room_drafts||[]).flatMap(t=>{if(s&&t?.id===s)return[];const e=t?.points||[];return e.length?[e[0],e[e.length-1]]:[]})}}const zn=t=>!!t&&t.length>=2&&Number.isFinite(t[0])&&Number.isFinite(t[1]),An=(t,e)=>t[0]-e[0]||t[1]-e[1],On=(t,e,s,i)=>[t[0]+e*i,t[1]+s*i],Ln=(t,e,s,i)=>(t[0]-e[0])*s+(t[1]-e[1])*i,En=(t,e,s,i,o)=>{const a=e[0]-t[0],n=e[1]-t[1],r=Math.hypot(a,n);if(!(r>o))return null;const l=a/r,h=n/r,c=e=>Math.abs((e[0]-t[0])*h-(e[1]-t[1])*l);if(c(s)>o||c(i)>o)return null;const d=Ln(s,t,l,h),p=Ln(i,t,l,h),_=Math.max(0,Math.min(d,p)),u=Math.min(r,Math.max(d,p));return u-_>o?{lo:_,hi:u}:null},Bn=(t,e,s)=>Math.min(t.hi,e.hi)-Math.max(t.lo,e.lo)>s,Hn=t=>{const e=new Set(["id","a","b","cm"]);return Object.keys(t||{}).every(t=>e.has(t))},Gn=(t,e,s,i)=>{const o=t.b[0]-t.a[0],a=t.b[1]-t.a[1],n=Math.hypot(o,a);if(!(n>i))return!0;const r=o/n,l=a/n,h=j(t.cm,s.cellCm,s.gridPitch)/2;return e.some(e=>{const o=e?.center;if(!zn(o))return!0;const a=Ln(o,t.a,r,l),c=Math.abs((o[0]-t.a[0])*l-(o[1]-t.a[1])*r),d=j(Number(e.cm),s.cellCm,s.gridPitch)*("square"===e.shape?Math.SQRT1_2:.5);return!(Number.isFinite(d)&&d>0)||a>=-d-i&&a<=n+d+i&&c<=h+d+i})},Wn=(t,e,s)=>{if(t.host){const i=F(t,e,s.coordScale,s.cellCm,s.gridPitch).resolved;return i?{center:i.center,angle:i.angle,length:i.length}:null}const i=Number(t.x)*s.coordScale,o=Number(t.y)*s.coordScale,a=Number(t.angle),n=Number(t.length)*s.coordScale;return[i,o,a,n].every(Number.isFinite)&&n>0?{center:[i,o],angle:a,length:n}:null},jn=(t,e,s)=>{const i=t.angle*Math.PI/180,o=Math.cos(i),a=Math.sin(i),n=e.angle*Math.PI/180,r=Math.cos(n),l=Math.sin(n);if(Math.abs(o*l-a*r)>1e-6)return!1;const h=e.center[0]-t.center[0],c=e.center[1]-t.center[1];if(Math.abs(h*a-c*o)>s)return!1;const d=h*o+c*a;return Math.max(-t.length/2,d-e.length/2)<Math.min(t.length/2,d+e.length/2)-s},qn=(t,e)=>({...t,a:[t.a[0]*e,t.a[1]*e],b:[t.b[0]*e,t.b[1]*e]}),Un=(t,e,s,i)=>{const o=`~r-${(t=>{let e=2166136261;for(let s=0;s<t.length;s++)e^=t.charCodeAt(s),e=Math.imul(e,16777619)>>>0;return e.toString(36)})(`${t}|${e[0].toFixed(9)},${e[1].toFixed(9)}|${s[0].toFixed(9)},${s[1].toFixed(9)}`)}`,a=`${t.slice(0,Math.max(1,64-o.length))}${o}`;let n=a;for(let t=2;i.has(n);t++){const e=`-${t}`;n=`${a.slice(0,64-e.length)}${e}`}return i.add(n),n},Kn=(t,e)=>{const s=[];for(const i of t){const t=s[s.length-1];!(t&&Math.abs(t.hi-i.lo)<=e&&t.safe===i.safe)||i.safe&&t.signature!==i.signature?s.push({lo:i.lo,hi:i.hi,a:i.a,b:i.b,safe:i.safe,signature:i.signature,roomIds:i.roomIds,finalCm:i.finalCm}):(t.hi=i.hi,t.b=i.b)}return s};function Vn(t,e,s,i,o){const a=s||[],n=Array.isArray(t?.partitions)?t.partitions:[],r=Array.isArray(t?.openings)?t.openings:[],l=Array.isArray(t?.room_drafts)?t.room_drafts:[],h={walls:a,partitions:n,openings:r,roomDrafts:l,partitionsReconciled:0,openingsRehosted:0,removedDrafts:0};if(!n.length&&!l.length)return h;const c=Math.max(2e-4*o.gridPitch,1e-9);let d=a,p=n,_=r;const u=z(e.rooms,d,i,o.pitch,o.cellCm,o.gridPitch,o.coordScale),m=((t,e,s,i)=>{const o=new Map(t.map(t=>[t.id,t])),a=new Set;for(const t of e){if(!o.get(t.id)||!Array.isArray(t.points)||t.points.length<2||t.segments.length!==t.points.length-1)continue;let e=!0;for(let o=0;o+1<t.points.length&&e;o++){const a=t.points[o],n=t.points[o+1],r=Number(t.segments[o]?.cm);if(!(zn(a)&&zn(n)&&r>0)){e=!1;break}const l=Math.hypot(n[0]-a[0],n[1]-a[1]);if(!(l>i)){e=!1;break}const h=s.flatMap(t=>{const e=t.cm>0?t.cm:A;if(t.open||"outer"!==t.kind&&"shared"!==t.kind||e+i<r)return[];const s=En(a,n,t.a,t.b,i);return s?[s]:[]}).sort((t,e)=>t.lo-e.lo||t.hi-e.hi);let c=0;for(const t of h){if(t.lo>c+i)break;if(c=Math.max(c,t.hi),c>=l-i)break}c<l-i&&(e=!1)}e&&a.add(t.id)}return a})(l,e.room_drafts,u,c),g=l.filter(t=>!m.has(t.id));let f=0,b=0;const y=new Map(e.partitions.map(t=>[t.id,t]));for(const t of[...n].sort((t,e)=>t.id.localeCompare(e.id))){if(!p.some(e=>e.id===t.id))continue;if(!Hn(t))continue;const s=y.get(t.id);if(!(s&&zn(s.a)&&zn(s.b)&&Number.isFinite(s.cm)&&s.cm>0))continue;const[a,n]=An(s.a,s.b)<=0?[[s.a[0],s.a[1]],[s.b[0],s.b[1]]]:[[s.b[0],s.b[1]],[s.a[0],s.a[1]]],r=n[0]-a[0],l=n[1]-a[1],h=Math.hypot(r,l);if(!(h>c))continue;const u=r/h,g=l/h,v=z(e.rooms,d,i,o.pitch,o.cellCm,o.gridPitch,o.coordScale),$=v.flatMap(t=>{if(t.open||"outer"!==t.kind&&"shared"!==t.kind)return[];const e=En(a,n,t.a,t.b,c);return e?[{interval:t,range:e}]:[]});if(!$.length)continue;const w=_.filter(t=>"partition"===t.host?.kind&&t.host.id===s.id).map(t=>({opening:t,resolved:F(t,e.partitions,o.coordScale,o.cellCm,o.gridPitch).resolved}));if(w.some(t=>!t.resolved))continue;const k=[0,h];for(const{range:t}of $)k.push(t.lo,t.hi);const x=k.slice(),S=new Map;for(const{opening:t,resolved:e}of w){const s=Ln(e.center,a,u,g),i={lo:s-e.length/2,hi:s+e.length/2};S.set(t.id,i),x.push(Math.max(0,i.lo),Math.min(h,i.hi))}const M=[...new Set(x.filter(t=>Number.isFinite(t)&&t>=-c&&t<=h+c).map(t=>Math.max(0,Math.min(h,t)).toFixed(9)))].map(Number).sort((t,e)=>t-e),D=p.map(t=>qn(t,o.coordScale)).filter(t=>t.id!==s.id),C=e.room_drafts.filter(t=>!m.has(t.id)),P=[];for(let t=0;t+1<M.length;t++){const i=M[t],n=M[t+1];if(!(n-i>c))continue;const r=On(a,u,g,i),l=On(a,u,g,n),h=$.filter(({range:t})=>t.lo<=i+c&&t.hi>=n-c).map(({interval:t})=>t),d=new Map;for(const t of h)d.set(t.roomId,t);const p=[...d.values()],_=new Set(p.map(t=>t.kind)),m=new Set(p.map(t=>t.cm>0?t.cm:A)),f=p[0]?.kind,b=[...d.keys()].sort(),y=1===_.size&&1===m.size&&("outer"===f&&1===b.length||"shared"===f&&2===b.length),v={id:s.id,a:r,b:l,cm:s.cm},w=D.some(t=>!!En(r,l,t.a,t.b,c)),k=C.some(t=>t.points.some((e,s)=>s+1<t.points.length&&!!En(r,l,e,t.points[s+1],c))),x=y&&!w&&!k&&!Gn(v,e.wall_columns,o,c),S=y?p[0].cm>0?p[0].cm:A:0,I=y?Math.max(S,s.cm):s.cm;P.push({lo:i,hi:n,a:r,b:l,safe:x,signature:x?`${f}|${b.join(",")}|${I}`:"",roomIds:b,roomCm:S,finalCm:I})}if(!P.some(t=>t.safe))continue;const I=new Map;for(const{opening:t,resolved:e}of w){const i=S.get(t.id),a=k.some(t=>t>i.lo+c&&t<i.hi-c),n=P.filter(t=>Bn(t,i,c)),r=new Set(n.filter(t=>t.safe).map(t=>t.signature));if(!a&&n.length>0&&n.every(t=>t.safe)&&1===r.size&&O(e,v,c)){I.set(t.id,{resolved:e,signature:[...r][0]});continue}const l=L(s,o.cellCm,o.gridPitch),h={lo:i.lo-l,hi:i.hi+l};for(const t of P)Bn(t,h,c)&&(t.safe=!1,t.signature="")}let T=!0;for(;T;){T=!1;for(const[t,e]of[...I.entries()]){const i=S.get(t),a=P.filter(t=>Bn(t,i,c));if(a.length>0&&a.every(t=>t.safe)&&a.every(t=>t.signature===e.signature))continue;I.delete(t);const n=L(s,o.cellCm,o.gridPitch),r={lo:i.lo-n,hi:i.hi+n};for(const t of P)Bn(t,r,c)&&(t.safe=!1,t.signature="");T=!0}}const R=Kn(P,c),j=R.filter(t=>t.safe),q=R.filter(t=>!t.safe);if(!j.length)continue;if(p.length-1+q.length>2e3)continue;let U=d;for(const t of j){const[e,i]=An(s.a,s.b)<=0?[t.a,t.b]:[t.b,t.a];U=E(U,e,i,t.finalCm,o.pitch,o.coordScale)}if(U=B(e.rooms,U,i,o.pitch,o.cellCm,o.gridPitch,o.coordScale),U.length>500)continue;const K=new Set(p.map(t=>t.id));K.delete(s.id);const V=q.map((t,e)=>{const i=[t.a[0]/o.coordScale,t.a[1]/o.coordScale],a=[t.b[0]/o.coordScale,t.b[1]/o.coordScale],n=0===e?s.id:Un(s.id,i,a,K);return K.add(n),{id:n,a:i,b:a,cm:s.cm}}),J=p.findIndex(t=>t.id===s.id),Y=p.slice();Y.splice(J,1,...V);const X=Y.map(t=>qn(t,o.coordScale)),Z=new Map;let Q=!0;for(const{opening:t,resolved:e}of w){const s=I.get(t.id);if(s){const e=N(t,s.resolved,o.coordScale),{host:i,...a}=e;Z.set(t.id,a);continue}const i=S.get(t.id),a=V[q.findIndex(t=>t.lo<=i.lo+c&&t.hi>=i.hi-c)],n=a&&X.find(t=>t.id===a.id);if(!a||!n){Q=!1;break}const r=n.b[0]-n.a[0],l=n.b[1]-n.a[1],h=Math.hypot(r,l),d=Ln(e.center,n.a,r/h,l/h),p={...N(t,e,o.coordScale),host:{kind:"partition",id:a.id,t:d/h}};if(!H(p,X,o.coordScale,o.cellCm,o.gridPitch).resolved){Q=!1;break}Z.set(t.id,p)}if(!Q)continue;const tt=_.map(t=>Z.get(t.id)||t),et=[...I.keys()].map(t=>Z.get(t)),st=et.map(t=>Wn(t,X,o));if(st.some(t=>!t))continue;let it=!1;for(let t=0;t<st.length;t++)for(let e=t+1;e<st.length;e++)jn(st[t],st[e],c)&&(it=!0);const ot=new Set(et.map(t=>t.id));for(const t of tt){if(ot.has(t.id))continue;const e=Wn(t,X,o);e&&st.some(t=>jn(t,e,c))&&(it=!0)}if(it)continue;const at=G(e.rooms,U,i,o.pitch,o.cellCm,o.gridPitch,o.coordScale);[...I.entries()].every(([t,e])=>{const s=Z.get(t),i=W(at,{x:s.x*o.coordScale,y:s.y*o.coordScale,angle:s.angle,length:s.length*o.coordScale},!0),a=[i.negative,i.positive].filter(t=>!!t?.full),n=e.signature.split("|")[1].split(","),r=new Set(a.map(t=>t.roomId));return a.length===n.length&&r.size===n.length&&n.every(t=>r.has(t))})&&(d=U,p=Y,_=tt,f+=j.length,b+=I.size)}return{walls:d,partitions:p,openings:_,roomDrafts:g,partitionsReconciled:f,openingsRehosted:b,removedDrafts:m.size}}const Jn=t=>JSON.parse(JSON.stringify(t)),Yn=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),Xn=(t,e)=>e.length>0&&e.length<=35&&("space"===t?/^[a-z0-9_-]+$/.test(e):/^[A-Za-z0-9_-]+$/.test(e));function Zn(t,e){let s=String(e??"");const i=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),o=new RegExp(`^${i}_(.+)_([0-9a-f]{8})$`);let a=0;for(;a<16;a++){const t=o.exec(s);if(!t)return{root:s,layers:a,bounded:!1};s=t[1]}return{root:s,layers:a,bounded:o.test(s)}}const Qn=(t,e,s)=>{const i=t.get(e)||[];i.push(s),t.set(e,i)};const tr=1e-9;class er extends Error{constructor(t,e=""){super(e?`${t}: ${e}`:t),this.reason=t,this.name="WallSegmentModelError"}}const sr=t=>JSON.parse(JSON.stringify(t)),ir=t=>Array.isArray(t)&&t.length>=2&&Number.isFinite(Number(t[0]))&&Number.isFinite(Number(t[1])),or=t=>[Number(t[0]),Number(t[1])],ar=t=>`${Number(t[0]).toFixed(12)},${Number(t[1]).toFixed(12)}`,nr=(t,e)=>{const s=ar(t),i=ar(e);return s<i?`${s}|${i}`:`${i}|${s}`},rr=(t,e)=>ar(t)<=ar(e)?[or(t),or(e)]:[or(e),or(t)],lr=(t,e)=>Math.hypot(e[0]-t[0],e[1]-t[1]),hr=t=>{const e=[[Number(t.points[0][0]),Number(t.points[0][1])]],s=[];for(let i=1;i<t.points.length;i++){const o=[Number(t.points[i][0]),Number(t.points[i][1])];if(q(e[e.length-1],o))continue;e.push(o);const a=t.segments?.[i-1];s.push({...a&&"object"==typeof a?a:{},cm:Number.isFinite(Number(a?.cm))?Math.max(0,Math.min(100,Number(a.cm))):15})}return{points:e,segments:s}},cr=(t,e=[])=>{const s=new Set,i=t=>{const e=Number(t);if(!Number.isFinite(e))return;const i=e/I;Math.abs(i-Math.round(i))>=X&&s.add(e.toFixed(12))};for(const e of Array.isArray(t?.rooms)?t.rooms:[])for(const t of R(e)||[])i(t[0]),i(t[1]);for(const e of[t?.wall_segments,t?.walls])for(const t of Array.isArray(e)?e:[])i(t?.a?.[0]),i(t?.a?.[1]),i(t?.b?.[0]),i(t?.b?.[1]);for(const t of e)i(t?.[0]),i(t?.[1]);return s.size},dr=(t,e,s)=>{const i=s[0]-e[0],o=s[1]-e[1],a=i*i+o*o;return a>1e-18?((t[0]-e[0])*i+(t[1]-e[1])*o)/a:0},pr=(t,e,s)=>{const i=Math.max(0,Math.min(1,dr(t,e,s)));return Math.hypot(t[0]-(e[0]+(s[0]-e[0])*i),t[1]-(e[1]+(s[1]-e[1])*i))},_r=(t,e,s,i,o=tr)=>{const a=e[0]-t[0],n=e[1]-t[1],r=Math.hypot(a,n);if(r<=o)return 0;const l=e=>Math.abs((e[0]-t[0])*n-(e[1]-t[1])*a)/r;if(l(s)>o||l(i)>o)return 0;const h=dr(s,t,e),c=dr(i,t,e);return Math.max(0,Math.min(1,Math.max(h,c))-Math.max(0,Math.min(h,c)))*r},ur=t=>{const e=(new TextEncoder).encode(t),s=8*e.length,i=64*Math.ceil((e.length+9)/64),o=new Uint8Array(i);o.set(e),o[e.length]=128;const a=new DataView(o.buffer);a.setUint32(i-8,Math.floor(s/4294967296),!1),a.setUint32(i-4,s>>>0,!1);const n=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),r=new Uint32Array([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),l=new Uint32Array(64),h=(t,e)=>t>>>e|t<<32-e;for(let t=0;t<i;t+=64){for(let e=0;e<16;e++)l[e]=a.getUint32(t+4*e,!1);for(let t=16;t<64;t++){const e=l[t-15],s=l[t-2],i=h(e,7)^h(e,18)^e>>>3,o=h(s,17)^h(s,19)^s>>>10;l[t]=l[t-16]+i+l[t-7]+o>>>0}let[e,s,i,o,c,d,p,_]=r;for(let t=0;t<64;t++){const a=_+(h(c,6)^h(c,11)^h(c,25))+(c&d^~c&p)+n[t]+l[t]>>>0,r=e&s^e&i^s&i;_=p,p=d,d=c,c=o+a>>>0,o=i,i=s,s=e,e=a+((h(e,2)^h(e,13)^h(e,22))+r>>>0)>>>0}r[0]=r[0]+e>>>0,r[1]=r[1]+s>>>0,r[2]=r[2]+i>>>0,r[3]=r[3]+o>>>0,r[4]=r[4]+c>>>0,r[5]=r[5]+d>>>0,r[6]=r[6]+p>>>0,r[7]=r[7]+_>>>0}const c=new Uint8Array(32),d=new DataView(c.buffer);for(let t=0;t<r.length;t++)d.setUint32(4*t,r[t],!1);return c},mr=t=>{const e="abcdefghijklmnopqrstuvwxyz234567";let s=0,i=0,o="";for(const a of t)for(i=i<<8|a,s+=8;s>=5;)o+=e[i>>>s-5&31],s-=5;return s&&(o+=e[i<<5-s&31]),o},gr=(t,e,s,i,o="")=>{const[a,n]=rr(e,s),r=`${t}|${ar(a)}|${ar(n)}|${[...i].sort().join(",")}${o}`;return`wall-${mr(ur(r)).slice(0,20)}`};let fr=0;const br=t=>{for(let e=0;e<1e3;e++){const e=globalThis.crypto?.randomUUID?.(),s=`wall-${e||mr(ur(`${Date.now()}|${fr++}|${Math.random()}`)).slice(0,26)}`;if(!t.has(s))return s}throw new er("duplicate-id","id factory exhausted")},yr=t=>{const e=new Map;for(const s of Array.isArray(t?.wall_segments)?t.wall_segments:[])if(s&&"string"==typeof s.id&&ir(s.a)&&ir(s.b)){if(e.has(s.id))throw new er("duplicate-id",s.id);e.set(s.id,s)}return e},vr=(t,e,s)=>{const i=(s,i)=>{const o=t[0]-s[0],a=t[1]-s[1];return Math.abs(e[0]-i[0]-o)<=tr&&Math.abs(e[1]-i[1]-a)<=tr?[o,a]:null};return i(s.a,s.b)||i(s.b,s.a)},$r=(t,e)=>{const s=Array.isArray(t.rooms)?t.rooms:[],i=V(t.open_spans).map(t=>[t.a[0],t.a[1],t.b[0],t.b[1]]),o=i.length?i:J(s,null,1,.04*I,!0),a=[];for(const t of s){const s=R(t),i=Array.isArray(t?.wall_ids)?t.wall_ids:[];if(s&&i.length===s.length)for(let t=0;t<i.length;t++){const o="string"==typeof i[t]?e.get(i[t]):null;0===Number(o?.cm)&&a.push([s[t][0],s[t][1],s[(t+1)%s.length][0],s[(t+1)%s.length][1]])}}const n=[...a,...o],r=o.length?(Array.isArray(t.openings)?t.openings:[]).filter(t=>"partition"!==t.host?.kind&&[Number(t.x),Number(t.y)].every(Number.isFinite)&&Number.isFinite(Number(t.angle))&&Number(t.length)>0&&o.some(e=>pr([Number(t.x),Number(t.y)],[e[0],e[1]],[e[2],e[3]])<=.04*I)):[],l=r.map(t=>{const e=Number(t.angle)*Math.PI/180,s=[Math.cos(e),Math.sin(e)],i=Number(t.length)/2,o=[Number(t.x),Number(t.y)];return{a:[o[0]-s[0]*i,o[1]-s[1]*i],b:[o[0]+s[0]*i,o[1]+s[1]*i]}}),h=(t,e)=>r.some(s=>{const i=[Number(s.x),Number(s.y)];if(!Z(t,e,Number(s.angle)))return!1;if(pr(i,t,e)>.02*I)return!1;const o=lr(t,e),a=dr(i,t,e)*o,n=Number(s.length)/2;return a+n>=-tr&&a-n<=o+tr}),c=new Map,d=[];for(const i of s){const r=String(i?.id||""),p=R(i);if(!r||!p||p.length<3)throw new er("invalid-room",r);const _=Y(s,r,n,I,1,[...t.walls||[],...l]);if(!_||_.poly.length<3)throw new er("invalid-room",r);const u=Array.isArray(i.wall_ids)?i.wall_ids:[],m=u.length===p.length;let g=null,f=m;if(f)for(let t=0;t<p.length;t++){const s=e.get(u[t]),i=s?vr(p[t],p[(t+1)%p.length],s):null;if(!i||g&&(Math.abs(i[0]-g[0])>tr||Math.abs(i[1]-g[1])>tr)){f=!1;break}g=i}const b=[];for(let t=0;t<_.poly.length;t++){const s=_.poly[t],i=_.poly[(t+1)%_.poly.length];if(lr(s,i)<=tr)throw new er("zero-length",r);const n=nr(s,i);let l=c.get(n);if(!l){const[t,e]=rr(s,i);l={key:n,a:t,b:e,owners:new Set,preferredIds:new Set,positionalIds:new Set,preferredCarriers:new Map,parentKeys:new Set,zeroWall:!1},c.set(n,l)}if(l.owners.add(r),l.owners.size>2)throw new er("third-owner",n);const d=m?u[_.parent[t]]:void 0;if("string"==typeof d&&d){const o=e.get(d);f||!o||_r(s,i,o.a,o.b)>tr?l.preferredIds.add(d):l.positionalIds.add(d),l.preferredCarriers.set(d,{a:or(p[_.parent[t]]),b:or(p[(_.parent[t]+1)%p.length])})}const g=_.parent[t];l.parentKeys.add(K(p[g],p[(g+1)%p.length],I));const y=[(s[0]+i[0])/2,(s[1]+i[1])/2],v=t=>t.some(t=>pr(y,[t[0],t[1]],[t[2],t[3]])<=.04*I);l.zeroWall||=v(a)||v(o)&&!h(s,i),b.push(n)}const y={...i};delete y.wall_ids,d.push({...y,poly:_.poly.map(t=>[t[0],t[1]]),wall_ids:b})}return{atoms:[...c.values()].sort((t,e)=>t.key.localeCompare(e.key)),rooms:d}},wr=(t,e,s,i,o)=>{const a=new Map([...s.values()].map(t=>[nr(t.a,t.b),t])),n=(t=>{const e=new Map;for(const s of t)"wall"===s.host?.kind&&e.set(s.host.id,(e.get(s.host.id)||0)+1);return e})(t.openings||[]),r=new Map;for(const t of e){const e=o?.get(t.key);if(e){const i=s.get(e);if(!i)throw new er("duplicate-id",e);r.set(t,i);continue}if(t.preferredIds.size>1)throw new er("duplicate-id",[...t.preferredIds].sort().join(","));const i=[...t.preferredIds][0],l=i?s.get(i):void 0;if(l){r.set(t,l);continue}const h=i?t.preferredCarriers.get(i):void 0;if(i&&h){r.set(t,{id:i,a:h.a,b:h.b,cm:0});continue}const c=a.get(t.key);if(c){r.set(t,c);continue}const d=[...s.values()].filter(e=>_r(t.a,t.b,e.a,e.b)>tr),p=[...new Map(d.map(t=>[t.id,t])).values()];if(p.sort((t,e)=>(n.get(e.id)||0)-(n.get(t.id)||0)||lr(e.a,e.b)-lr(t.a,t.b)||t.id.localeCompare(e.id)),p[0])r.set(t,p[0]);else if(1===t.positionalIds.size){const e=s.get([...t.positionalIds][0]);e&&r.set(t,e)}}const l=new Map;for(const[t,e]of r){const s=l.get(e.id)||[];s.push(t),l.set(e.id,s)}for(const[t,e]of l){const i=s.get(t)||r.get(e[0]);if(!i)throw new er("duplicate-id",t);const o=[(i.a[0]+i.b[0])/2,(i.a[1]+i.b[1])/2];e.sort((t,e)=>{const s=pr(o,t.a,t.b)<=tr?0:1,a=pr(o,e.a,e.b)<=tr?0:1;if(s!==a)return s-a;return(pr(i.a,t.a,t.b)<=tr?0:1)-(pr(i.a,e.a,e.b)<=tr?0:1)||t.key.localeCompare(e.key)}),e[0].id=t}const h=(t=>{const e=new Set;for(const s of[t.rooms,t.openings,t.decor,t.room_drafts,t.partitions,t.wall_columns])for(const t of Array.isArray(s)?s:[])"string"==typeof t?.id&&t.id&&e.add(t.id);for(const s of Array.isArray(t.room_drafts)?t.room_drafts:[])for(const t of Array.isArray(s?.segments)?s.segments:[])"string"==typeof t?.id&&t.id&&e.add(t.id);return e})(t);for(const t of e)if(t.id){if(h.has(t.id))throw new er("duplicate-id",t.id);h.add(t.id)}const c=e.filter(t=>!t.id);if(i){const e=c.map(e=>{const[s,i]=rr(e.a,e.b),o=`${String(t.id||"")}|${ar(s)}|${ar(i)}|${[...e.owners].sort().join(",")}`,a=mr(ur(o));return{atom:e,seed:o,digest:a,base:`wall-${a.slice(0,20)}`}}).sort((t,e)=>t.digest.localeCompare(e.digest)||t.atom.key.localeCompare(e.atom.key)),s=new Map;for(const t of e){const e=s.get(t.digest);if(e&&e!==t.seed)throw new er("duplicate-id",t.digest);s.set(t.digest,t.seed);let i=1,o=t.base;for(;h.has(o);)o=`${t.base}-${++i}`;t.atom.id=o,h.add(o)}}else for(const t of c)t.id=br(h),h.add(t.id)},kr=(t,e)=>{if("partition"===t.host?.kind)return null;const s=[Number(t.x),Number(t.y)];if(!s.every(Number.isFinite))return null;const i=e=>{if(!(Number(e.cm)>0))return!1;const i=dr(s,e.a,e.b),o=lr(e.a,e.b),a=Number(t.length)/2;return i>=-tr&&i<=1+tr&&pr(s,e.a,e.b)<=.02*I&&Z(e.a,e.b,Number(t.angle))&&Number.isFinite(a)&&a>=0&&i*o-a>=-tr&&i*o+a<=o+tr},o="wall"===t.host?.kind?e.find(e=>e.id===t.host.id):null,a=o&&i(o)?[o]:e.filter(i);if(1!==a.length)return null;const n=a[0];return{kind:"wall",id:n.id,t:Math.max(0,Math.min(1,dr(s,n.a,n.b)))}},xr=(t,e)=>{const s=[Number(t.x),Number(t.y)];if(!s.every(Number.isFinite))return null;const i=Number(t.length)/2,o=e.filter(e=>{if(!(Number(e.cm)>0))return!1;const o=dr(s,e.a,e.b),a=lr(e.a,e.b);return o>=-tr&&o<=1+tr&&pr(s,e.a,e.b)<=.02*I&&Z(e.a,e.b,Number(t.angle))&&Number.isFinite(i)&&i>=0&&o*a-i>=-tr&&o*a+i<=a+tr}),a=(e=>{if(!e.length)return null;const i="wall"===t.host?.kind?e.find(e=>e.id===t.host.id):null;return i||[...e].sort((t,e)=>pr(s,t.a,t.b)-pr(s,e.a,e.b)||Number(e.cm)-Number(t.cm)||(t.id<e.id?-1:t.id>e.id?1:0))[0]})(o);return a?{kind:"wall",id:a.id,t:Math.max(0,Math.min(1,dr(s,a.a,a.b)))}:null},Sr=(t,e,s)=>{const i=yr(t),{atoms:o,rooms:a}=$r(t,i);wr(t,o,i,e,s);const n=o.map(e=>{const s=e.id?i.get(e.id):void 0,o=((t,e,s)=>{if(e.zeroWall)return 0;const i=Array.isArray(t.walls)?t.walls:[],o=K(e.a,e.b,I),a=i.filter(t=>Number(t.cm)>0&&(!(t.key!==o&&!e.parentKeys.has(t.key))||!(!ir(t.a)||!ir(t.b))&&_r(e.a,e.b,t.a,t.b)>=lr(e.a,e.b)-tr)).map(t=>Math.max(1,Math.min(100,Number(t.cm))));if(new Set(a.map(t=>t.toFixed(9))).size>1)throw new er("thickness-conflict",e.key);if(a.length)return a[0];const n=Q(i,e.a,e.b,I,1);return n>0?n:Number(s?.cm)>0?Number(s.cm):0})(t,e,s);return{...s||{},id:e.id,a:[...e.a],b:[...e.b],cm:o}}),r=new Map(o.map(t=>[t.key,t.id]));for(const t of a)t.wall_ids=t.wall_ids.map(t=>r.get(t));t.rooms=a,t.wall_segments=n,t.walls=n.filter(t=>t.cm>0).map(t=>({key:K(t.a,t.b,I),cm:t.cm,a:[...t.a],b:[...t.b]})),t.walls.length||delete t.walls,delete t.open_spans;for(const e of t.rooms)delete e.open_to;return((t,e)=>{const s=new Set;for(const e of[t.rooms,t.openings,t.decor,t.room_drafts,t.partitions,t.wall_columns,t.wall_segments])for(const t of Array.isArray(e)?e:[])"string"==typeof t?.id&&t.id&&s.add(t.id);for(const i of Array.isArray(t.room_drafts)?t.room_drafts:[]){const o=Array.isArray(i.segments)?i.segments:[];for(let a=0;a<o.length;a++){const n=o[a];if("string"==typeof n.id&&n.id){if(s.has(n.id))throw new er("duplicate-id",n.id);s.add(n.id);continue}const r=i.points?.[a],l=i.points?.[a+1];if(!ir(r)||!ir(l))throw new er("zero-length",i.id);if(e){const e=gr(String(t.id||""),r,l,[`draft:${String(i.id||"")}`]);let o=1;for(n.id=e;s.has(n.id);)n.id=`${e}-${++o}`}else n.id=br(s);s.add(n.id)}}})(t,e),((t,e,s)=>{const i=Array.isArray(t.openings)?t.openings:[];for(const t of i){if("partition"===t.host?.kind)continue;if(!t.host&&!s){const s=kr(t,e);s&&(t.host=s);continue}const i=kr(t,e)??(s?xr(t,e):null);if(i)t.host=i;else{if(!s)throw new er("opening-host",t.id);delete t.host}}})(t,n,e),n.reduce((t,e)=>t+(i.has(e.id)?0:1),0)};function Mr(t,e={}){const s=JSON.stringify(t),i=sr(t);U(i);let o=0;const a=Number(i?.model_version||0)<9;for(const t of Array.isArray(i?.spaces)?i.spaces:[]){const s=e.lineageSpaceId===String(t?.id||"")?e.lineageHints:void 0;o+=Sr(t,a,s)}return i.model_version=9,U(i),{config:i,changed:s!==JSON.stringify(i),migratedSegments:o}}const Dr=t=>!!t&&"object"==typeof t&&!Array.isArray(t);function Cr(t,e){const s=(t,e)=>{if(Array.isArray(t)&&Array.isArray(e)){const i=new Map;for(const e of t)Dr(e)&&"string"==typeof e.id&&e.id&&i.set(e.id,e);const o=e.map((e,o)=>{if(Dr(e)&&"string"==typeof e.id&&e.id){const t=i.get(e.id);return t?s(t,e):sr(e)}return o<t.length?s(t[o],e):sr(e)});return t.splice(0,t.length,...o),t}if(Dr(t)&&Dr(e)){const i=Object.entries(e).map(([e,i])=>[e,e in t?s(t[e],i):sr(i)]);for(const e of Object.keys(t))delete t[e];for(const[e,s]of i)t[e]=s;return t}return sr(e)};return s(t,e)}const Pr=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),Ir=(t,e,s)=>Math.min(s,Math.max(e,t)),Tr=t=>ut({spaces:[t]})[0],Rr=(t,e,s)=>{const i=s>0?s:1,o=t=>`${(t[0]/i).toFixed(12)},${(t[1]/i).toFixed(12)}`,a=o(t),n=o(e);return a<n?`${a}|${n}`:`${n}|${a}`};function Fr(t,e,s,i,o,a,n=1){if(!e?.length)return[];const r=n>0?n:1,l=Math.max(i*r*.02,1e-9),h=[];for(const e of t||[])for(const t of R(e)||[])h.push([t[0],t[1]]);const c=[];for(const t of s||[])Array.isArray(t)&&t.length>=4&&t.slice(0,4).every(Number.isFinite)&&c.push([t[0],t[1]],[t[2],t[3]]);const d=(t,e)=>e.some(e=>Math.hypot(t[0]-e[0],t[1]-e[1])<=2*l),p=new Map;for(const n of t||[]){if(!n?.id)continue;const _=mt(t,n.id,e,s,i,o,a,r);if(_)for(let t=0;t<_.orig.length;t++){const e=[];for(let s=0;s<_.parent.length;s++)_.parent[s]===t&&e.push(s);for(let t=1;t+1<e.length;t++){const s=e[t-1],i=e[t],o=e[t+1];if(null===_.kinds[s]||null===_.kinds[i]||null===_.kinds[o])continue;const n=_.cms[s],u=_.cms[i],m=_.cms[o];if(!(n>0&&u>0&&n===m&&u!==n))continue;const g=_.poly[i],f=_.poly[(i+1)%_.poly.length],b=Math.hypot(f[0]-g[0],f[1]-g[1]);if(!(b>l&&b<.5*a-1e-9*a))continue;if(d(g,c)||d(f,c))continue;if(d(g,h)&&d(f,h))continue;const y=Rr(g,f,r),v=p.get(y);v?v.targets.add(n):p.set(y,{a:[g[0],g[1]],b:[f[0],f[1]],targets:new Set([n])})}}}let _=e.slice();const u=(t,e)=>Math.hypot(t[0]-e[0],t[1]-e[1])<=2*l,m=(t,e)=>{if(!Array.isArray(t.a)||!Array.isArray(t.b)||t.a.length<2||t.b.length<2)return!1;const s=[Number(t.a[0])*r,Number(t.a[1])*r],i=[Number(t.b[0])*r,Number(t.b[1])*r];return!![...s,...i].every(Number.isFinite)&&(u(s,e.a)&&u(i,e.b)||u(s,e.b)&&u(i,e.a))};for(const t of[...p.values()].filter(t=>1===t.targets.size).sort((t,e)=>Rr(t.a,t.b,r).localeCompare(Rr(e.a,e.b,r)))){const e=[...t.targets][0],s=_.filter(e=>m(e,t));if(new Set(s.map(t=>t.cm)).size>1)continue;let o=!1;_=_.map(s=>m(s,t)?(o=!0,s.cm===e?s:{...s,cm:e}):s),o||(_=E(_,t.a,t.b,e,i,r))}return _}const Nr=t=>{const e=[];for(const s of t||[]){const t=R(s);if(t?.length)for(let s=0;s<t.length;s++)e.push([[t[s][0],t[s][1]],[t[(s+1)%t.length][0],t[(s+1)%t.length][1]]])}return e};function zr(t,e,s={},i={}){const o=i.reconcileCoincidentPartitions??Vn,a=function(t,e,s={}){const i=Jn(t||{spaces:[],markers:[],settings:{}}),o=Jn(e||{}),a=JSON.stringify(i),n=JSON.stringify(o),r=Array.isArray(i.spaces)?i.spaces:[],l=Array.isArray(i.markers)?i.markers:[],h=r.map(t=>"string"==typeof t?.id?t.id:"").filter(Boolean),c=new Set(h),d=new Map;for(const t of h){const e=Zn("space",t);e.layers>0&&Xn("space",e.root)&&Qn(d,e.root,t)}const p=new Map,_=new Map,u=new Map,m=new Map;for(const t of r){const e="string"==typeof t?.id?t.id:"";if(!e)continue;const s=new Map;for(const i of Array.isArray(t.rooms)?t.rooms:[]){const t="string"==typeof i?.id?i.id:"";if(!t)continue;const o=Zn("room",t);o.layers>0&&Xn("room",o.root)&&Qn(s,o.root,t),_.has(t)||_.set(t,e),u.has(t)||u.set(t,String(i.name||""));const a="string"==typeof i.area?i.area:"";if(a){const s=m.get(a)||[];s.push({spaceId:e,roomId:t}),m.set(a,s)}}p.set(e,s)}const g=new Set(_.keys()),f=new Map,b=new Map;for(const t of l)"string"==typeof t?.id&&t.id&&(!0===t.removed?b.set(t.id,t):f.set(t.id,t));const y={spaceRefsRemapped:0,roomRefsRemapped:0,positionsRemapped:0,markersDetached:0,positionsUnresolved:0,nestedRefsUnresolved:0,deadSpaceIds:[],orphanRoomLabelsRemoved:0,orphanDevicePositionsRemoved:0,orphanGroupPositionsRemoved:0,liveMissingPositionsRemoved:0,removedPositions:[],liveMissingPositions:[],unverifiedPositions:[]},v=new Set,$=t=>c.has(t)?null:(()=>{const e=Zn("space",t).root;if(!Xn("space",e))return null;const s=d.get(e)||[];return 1===s.length?s[0]:null})(),w=(t,e)=>{const s=Zn("room",t).root;if(!Xn("room",s))return null;const i=p.get(e)?.get(s)||[];return 1===i.length?i[0]:null},k=t=>{const e=s.effectiveAreaByMarker?.[t]||"",i=e&&m.get(e)||[];return 1===i.length?i[0]:null},x=(t,e,s)=>{if("string"==typeof t.room_id&&t.room_id&&!g.has(t.room_id)){const i=e?w(t.room_id,e):null;i?(t.room_id=i,y.roomRefsRemapped++):s?(t.room_id=s.roomId,y.roomRefsRemapped++):!0!==t.removed&&delete t.room_id}const i=t.vacuum?.segment_map;if(i&&"object"==typeof i&&!Array.isArray(i))for(const t of Object.keys(i)){const s=i[t];if("string"!=typeof s||!s||g.has(s))continue;const o=e?w(s,e):null;o?(i[t]=o,y.roomRefsRemapped++):y.nestedRefsUnresolved++}};for(const t of l){const e="string"==typeof t?.id?t.id:"";if(!e)continue;const s="string"==typeof t.space?t.space:"",i=s&&!c.has(s),a=o[e],n="string"==typeof a?.s?a.s:"",r=n&&!c.has(n),l=!0===t.removed;let h=s&&c.has(s)?s:null,d=null,p=!1;if(i){const i=$(s);i?(t.space=i,h=i,p=!0,y.spaceRefsRemapped++):l||"virtual"===t.binding?l||(delete t.space,h=null,y.markersDetached++):(d=k(e),d?(t.space=d.spaceId,h=d.spaceId,y.spaceRefsRemapped++):(delete t.space,h=null,y.markersDetached++))}l&&!p||x(t,h,d),r&&p&&n===s&&h&&(o[e]={...a,s:h},y.positionsRemapped++,v.add(e))}for(const t of Object.keys(o)){if(v.has(t))continue;const e=o[t],s="string"==typeof e?.s?e.s:"";if(!s||c.has(s))continue;const i=$(s);if(i){if(t.startsWith("rl_")){const s=t.slice(3),a=w(s,i);if(a){const s=`rl_${a}`;Yn(o,s)||(o[s]={...e,s:i}),delete o[t],y.roomRefsRemapped++,y.positionsRemapped++;continue}}o[t]={...e,s:i},y.positionsRemapped++}}const S=s.ownerRoster,M=!0===S?.authoritative,D=new Set(S?.deviceIds||[]),C=new Set(S?.entityIds||[]),P=new Set(Array.isArray(i.settings?.known_devices)?i.settings.known_devices.filter(t=>"string"==typeof t):[]),I=(t,e="")=>{const s=String(S?.names?.[t]||e||"").trim();return s&&s!==t?s:""},T=(t,e,s,i="",o)=>({id:t,spaceId:e,kind:s,name:I(t,i),...o?{reason:o}:{}}),R=t=>{"room_label"===t?y.orphanRoomLabelsRemoved++:"group"===t?y.orphanGroupPositionsRemoved++:y.orphanDevicePositionsRemoved++},F=new Set;for(const[t,e]of Object.entries(o)){const i="string"==typeof e?.s?e.s:"";if(!i||c.has(i))continue;let a,n;const r=f.get(t),l=b.get(t);if(r)a=T(t,i,"device",String(r.name||"")),n="live";else if(l)a=T(t,i,"device",String(l.name||"")),n="absent";else if(t.startsWith("rl_")){const e=t.slice(3);a=T(t,i,"room_label",u.get(e)||""),n=g.has(e)?"live":"absent"}else if(t.startsWith("lg_")){const e=t.slice(3);a=T(t,i,"group"),n=C.has(e)?"live":M?"absent":"unverified","unverified"===n&&(a.reason="registry_unavailable")}else D.has(t)?(a=T(t,i,"device"),n="live"):P.has(t)?(a=T(t,i,"device"),n=M?"absent":"unverified","unverified"===n&&(a.reason="registry_unavailable")):(a=T(t,i,"unknown","","unknown_owner"),n="unverified");if("absent"!==n){if("live"===n){if(y.liveMissingPositions.push(a),!0===s.removeLiveMissingPositions){delete o[t],y.liveMissingPositionsRemoved++,R(a.kind),y.removedPositions.push(a);continue}}else y.unverifiedPositions.push(a);y.positionsUnresolved++,F.add(i)}else delete o[t],R(a.kind),y.removedPositions.push(a)}return y.deadSpaceIds=[...F].sort((t,e)=>t.localeCompare(e)),{config:i,layout:o,report:y,changed:JSON.stringify(i)!==a||JSON.stringify(o)!==n}}(t,e,s),n=a.config,r=tt(n,a.layout);U(n),et(a.layout);const l=JSON.stringify(t||{}),h=JSON.stringify(e||{}),c=Number.isInteger(Number(n.model_version))?Number(n.model_version):0,d=(t=>{let e=0,s=0,i=0;for(const s of t.markers||[]){if("ripple"===s.display&&(s.display="icon_ripple",e++),Array.isArray(s.controls)){const t="string"==typeof s.binding&&s.binding.startsWith("entity:")?s.binding.slice(7):"",i=t?s.controls.filter(e=>e!==t):s.controls;JSON.stringify(i)!==JSON.stringify(s.controls)&&(s.controls=i.length?i:null,e++)}const t=s.vacuum;t&&Pr(t,"trail")&&(["never","cleaning","always"].includes(t.trail_mode)||(t.trail_mode=!1===t.trail?"never":"cleaning"),delete t.trail,e++)}for(const o of t.spaces||[]){const t=o.settings;"glow"===t?.fill_mode&&("boolean"!=typeof t.glow_enabled&&(t.glow_enabled=!0),t.fill_mode="none",e++,s++);for(const t of o.rooms||[]){const s=t.settings;"glow"===s?.fill_mode&&("boolean"!=typeof s.glow&&(s.glow=!0),delete s.fill_mode,e++,i++)}if(Pr(o,"segments")&&(delete o.segments,e++),Pr(o,"plan_scale")){const t=Number(o.plan_scale);Number.isFinite(t)&&t>=lt&&t<=ht&&(Pr(o,"plan_scale_x")||(o.plan_scale_x=t),Pr(o,"plan_scale_y")||(o.plan_scale_y=t),delete o.plan_scale,e++)}const a=Number(o.cell_cm);Pr(o,"cell_cm")&&(!Number.isFinite(a)||a<.1||a>1e3)&&(o.cell_cm=Number.isFinite(a)&&a>0?Ir(a,.1,1e3):5,e++);const n=Number(o.cell_cm),r=Number.isFinite(n)&&n>0?n:5;for(const t of o.wall_columns||[])if("circle"===t.shape)Pr(t,"angle")&&(delete t.angle,e++);else if("square"===t.shape&&Pr(t,"angle")){const s=((Number(t.angle)||0)%90+90)%90;t.angle!==s&&(t.angle=s,e++)}for(const t of o.decor||[]){if(Pr(t,"width")){const s=Number(t.width);(Pr(t,"width_cm")||Number.isFinite(s))&&(Pr(t,"width_cm")||(t.width_cm=Number(Ir(s/nt*r,.1,100).toFixed(6))),delete t.width,e++)}if("rect"!==t?.kind&&"ellipse"!==t?.kind||!0!==t.fill||(Pr(t,"fill_color")||(t.fill_color=t.color||"#607d8b",e++),Pr(t,"fill_opacity")||(t.fill_opacity=.25,e++)),"text"!==t?.kind)continue;void 0===t.size_cm?(t.size_cm=Number(Ir(ct*dt(t)/nt*r,.1,2e3).toFixed(6)),delete t.scale,delete t.size,e++):(Pr(t,"scale")||Pr(t,"size"))&&(delete t.scale,delete t.size,e++);let s=String(t.text??"");const i=[...s.matchAll(/\{([^{}\r\n]+)\}/g)].some(t=>!!pt(t[1]));if(!(Pr(t,"entity")||Pr(t,"attr")||Pr(t,"unit")))continue;const o=String(t.unit??"").trim(),a="state"===String(t.attr??"").trim().toLowerCase()?null:t.attr,n=i||o?"":_t(t.entity,a);if(i||n){if(n){const e=s.indexOf("{}");s=e>=0?s.slice(0,e)+n+s.slice(e+2):`${s}${s?" ":""}${n}`,t.text=s}delete t.entity,delete t.attr,delete t.unit,e++}}}return{total:e,glowSpaces:s,glowRooms:i}})(n);let p=d.total;const _=(u=n.spaces||[],JSON.parse(JSON.stringify(u)));var u;const m=Sn(n.spaces||[],a.layout);let g=0,f=0,b=0,y="";const v=m.spaces.map(t=>{const e=st(t);g+=e.report.wallsStraightened,f+=e.report.wallsStraightenSkipped;const s=Number(t?.cell_cm)>0?Number(t.cell_cm):5,i=e.report.maxStraightenShift/I*s;return i>b&&(b=i,y=String(t?.id||"")),e.space}),$=g?Sn(v,m.layout):{...m,spaces:v};n.spaces=$.spaces;const w=g?{...m.report,moved:m.report.moved+$.report.moved,coordsCanonicalized:m.report.coordsCanonicalized+$.report.coordsCanonicalized,maxShift:Math.max(m.report.maxShift,$.report.maxShift),maxShiftCm:Math.max(m.report.maxShiftCm,$.report.maxShiftCm),maxSpace:$.report.maxShiftCm>m.report.maxShiftCm?$.report.maxSpace:m.report.maxSpace,rotated:m.report.rotated+$.report.rotated,removedDrafts:m.report.removedDrafts+$.report.removedDrafts}:{...m.report};let k=0,x=0,S=0,M=0,D=0,C=0,P=0,T=0;for(let t=0;t<n.spaces.length;t++){const e=_[t],s=n.spaces[t],i=JSON.stringify({zero:(e.wall_segments||[]).filter(t=>0===Number(t.cm)),walls:e.walls||[]}),a=Tr(e),r=Tr(s);if(!a||!r)continue;const l=Nr(a.rooms),h=Nr(r.rooms),c=.02*nt,d=(e.wall_segments||[]).filter(t=>0===Number(t.cm)).map(t=>({...t,key:K(t.a,t.b,I),cm:0})),p=new Set(d.map(t=>t.key)),u=it(e,a.rooms,ot,c);x+=u.length;for(const t of u){const e=[t[0]/ot,t[1]/ot],s=[t[2]/ot,t[3]/ot],i=K(e,s,I);p.has(i)||(p.add(i),d.push({key:i,a:e,b:s,cm:0}))}const m=d.length,g=at(d,l,h,I,ot),f=(t,e,s)=>{const i=s[0]-e[0],o=s[1]-e[1],a=i*i+o*o;if(!(a>0))return Math.hypot(t[0]-e[0],t[1]-e[1]);const n=Math.max(0,Math.min(1,((t[0]-e[0])*i+(t[1]-e[1])*o)/a));return Math.hypot(t[0]-(e[0]+i*n),t[1]-(e[1]+o*n))},b=g.filter(t=>{if(!Array.isArray(t.a)||!Array.isArray(t.b))return!1;const e=t.a.map(t=>t*ot),s=t.b.map(t=>t*ot);return h.some(([t,i])=>f(e,t,i)<=4*c&&f(s,t,i)<=4*c)});S+=Math.max(0,m-b.length);const y=(s.wall_segments||[]).filter(t=>Number(t.cm)>0);s.wall_segments=[...y,...b.map(({key:t,...e})=>e)];const v=b.map(t=>[t.a[0]*ot,t.a[1]*ot,t.b[0]*ot,t.b[1]*ot]),$=Array.isArray(e.walls)?e.walls.length:0;let w=at(e.walls,l,h,I,ot);w=Fr(r.rooms,w,v,I,Number(s.cell_cm)>0?Number(s.cell_cm):5,nt,ot),w=B(r.rooms,w,v,I,Number(s.cell_cm)>0?Number(s.cell_cm):5,nt,ot),w=rt(w,s.rooms||[],I,1,v.map(t=>[t[0]/ot,t[1]/ot,t[2]/ot,t[3]/ot])),k+=Math.max(0,$-w.length),w.length?s.walls=w:delete s.walls;const R=Rn(s.partitions||[],{pitch:I,geometry:Nn(s)});R.merged&&(M+=R.merged,s.partitions=R.partitions,Fn(s.openings,s.partitions,R.openingMoves,{coordScale:ot,cellCm:Number(s.cell_cm)>0?Number(s.cell_cm):5,gridPitch:nt}));const F=Tr(s);if(F){const t=o(s,F,s.walls||[],v,{pitch:I,cellCm:Number(s.cell_cm)>0?Number(s.cell_cm):5,gridPitch:nt,coordScale:ot});t.partitionsReconciled&&(D+=t.partitionsReconciled,C+=t.openingsRehosted,t.partitions.length?s.partitions=t.partitions:delete s.partitions,t.openings.length?s.openings=t.openings:delete s.openings,t.walls.length?s.walls=t.walls:delete s.walls),t.removedDrafts&&(P+=t.removedDrafts,t.roomDrafts.length?s.room_drafts=t.roomDrafts:delete s.room_drafts)}JSON.stringify({zero:(s.wall_segments||[]).filter(t=>0===Number(t.cm)),walls:s.walls||[]})!==i&&T++}let R=0;c<=9&&(R=function(t){const e=Mr(t);return Cr(t,e.config),{...e,config:t}}(n).migratedSegments);const F=U(n),N=et($.layout),z=JSON.stringify(F)!==l||JSON.stringify(N)!==h;c<9&&z&&(F.model_version=9);const A=JSON.stringify(F)!==l||JSON.stringify(N)!==h,O=Number.isInteger(Number(F.model_version))?Number(F.model_version):c,L=A?w:{...w,moved:0,coordsCanonicalized:0,maxShift:0,maxShiftCm:0,maxSpace:"",rotated:0,removedDrafts:0},E=A?a.report:{...a.report,spaceRefsRemapped:0,roomRefsRemapped:0,positionsRemapped:0,markersDetached:0,orphanRoomLabelsRemoved:0,orphanDevicePositionsRemoved:0,orphanGroupPositionsRemoved:0,liveMissingPositionsRemoved:0};return{config:F,layout:N,report:{...L,modelFrom:c,modelTo:O,migrated:A?p:0,glowSpacesMigrated:A?d.glowSpaces:0,glowRoomsMigrated:A?d.glowRooms:0,canonicalized:A?T:0,wallSegmentsMigrated:A?R:0,legacyZeroWallsMigrated:A?x:0,wallsMerged:A?k:0,spansMerged:A?S:0,partitionsMerged:A?M:0,partitionsReconciled:A?D:0,openingsRehosted:A?C:0,redundantDraftsRemoved:A?P:0,wallsStraightened:A?g:0,wallsStraightenSkipped:f,maxStraightenShiftCm:A?b:0,maxStraightenSpace:A?y:"",latticeCoordinatesCanonicalized:A?r.canonicalized:0,latticeCoordinatesFar:A?r.far:0,latticeMaxShift:A?r.maxShift:0,latticeMaxShiftCm:A?r.maxShiftCm:0,latticeSpaces:A?r.spaces:[],...E},changed:A}}const Ar=(t,e)=>t[0]*e[1]-t[1]*e[0],Or=(t,e)=>t[0]*e[0]+t[1]*e[1],Lr=(t,e)=>[t[0]-e[0],t[1]-e[1]],Er=(t,e,s)=>[t[0]+e[0]*s,t[1]+e[1]*s];function Br(t,e,s){return Math.abs(Ar(t,e))<=s}function Hr(t,e,s){return Math.abs(Ar(Lr(t,e),s))}function Gr(t,e,s,i,o){const a=e[0]-t[0],n=e[1]-t[1],r=Math.hypot(a,n);if(!(r>o&&s>0))return[];const l=[a/r,n/r];return function(t,e,s){const i=e.map(([e,s])=>[Math.max(0,Math.min(e,s)),Math.min(t,Math.max(e,s))]).filter(([t,e])=>e>t+s).sort((t,e)=>t[0]-e[0]||t[1]-e[1]),o=[];for(const t of i){const e=o[o.length-1];!e||t[0]>e[1]+s?o.push([...t]):e[1]=Math.max(e[1],t[1])}const a=[];let n=0;for(const[t,e]of o)t>n+s&&a.push([n,t]),n=Math.max(n,e);return t>n+s&&a.push([n,t]),a}(r,i.flatMap(e=>{const i=e.b[0]-e.a[0],a=e.b[1]-e.a[1],n=Math.hypot(i,a);if(!(n>o&&Br(l,[i/n,a/n],1e-6)))return[];if(Hr(e.a,t,l)>1.1*Math.max(s,o)||Hr(e.b,t,l)>1.1*Math.max(s,o))return[];return[[Or(Lr(e.a,t),l),Or(Lr(e.b,t),l)]]}),o).flatMap(([e,i])=>{const o=bt({a:Er(t,l,e),b:Er(t,l,i),halfDepth:s});return o?[o]:[]})}function Wr(t){const e=t.coordScale??1,s=Math.max(t.epsilon??2e-4*t.gridPitch,1e-9),i=[];for(const s of t.rooms||[]){if(!s?.id)continue;const o=mt(t.rooms,s.id,t.walls,t.openCuts,t.pitch,t.cellCm,t.gridPitch,e);if(!o||o.poly.length<3)continue;const a=gt(o.poly,o.offsets);!a||a.length<3||i.push({roomId:s.id,profile:o,inner:a})}i.sort((t,e)=>t.roomId.localeCompare(e.roomId));const o=(t.roomOpenings||[]).map(t=>{const e=t.angle*Math.PI/180,s=[Math.cos(e),Math.sin(e)],i=Math.max(0,t.length)/2;return{a:Er([t.x,t.y],s,-i),b:Er([t.x,t.y],s,i)}}),a=[];for(const i of ft(t.rooms,t.walls,t.openCuts,t.pitch,t.cellCm,t.gridPitch,e))for(const t of Gr(i.a,i.b,i.depthUnits/2,o,s))a.push({body:t});const n=new Map;for(const e of t.partitionCuts||[]){const t=n.get(e.hostId)||[];t.push(e),n.set(e.hostId,t)}for(const e of t.partitions||[]){const i=j(e.cm,t.cellCm,t.gridPitch)/2;for(const t of Gr(e.a,e.b,i,n.get(e.id)||[],s))a.push({body:t,partitionId:e.id})}return{rooms:i,boundaries:a,epsilon:s}}function jr(t,e,s,i){const o=t.profile.offsets[e];if(!(o>0))return null;const a=function(t,e){const s=t[e],i=t[(e+1)%t.length],o=i[0]-s[0],a=i[1]-s[1],n=Math.hypot(o,a)||1;return function(t){let e=0;for(let s=0;s<t.length;s++){const i=t[s],o=t[(s+1)%t.length];e+=i[0]*o[1]-o[0]*i[1]}return e/2}(t)>=0?[-a/n,o/n]:[a/n,-o/n]}(t.profile.poly,e),n=Er(s.center,a,o),r=[];for(let e=0;e<t.inner.length;e++){const o=t.inner[e],a=t.inner[(e+1)%t.inner.length],l=Lr(a,o),h=Math.hypot(l[0],l[1]);if(!(h>i&&Br(s.axis,[l[0]/h,l[1]/h],1e-6)))continue;if(Hr(o,n,s.axis)>i||Hr(a,n,s.axis)>i)continue;const c=Or(Lr(o,n),s.axis),d=Or(Lr(a,n),s.axis);r.push([Math.min(c,d),Math.max(c,d)])}const l=function(t,e){t.sort((t,e)=>t[0]-e[0]||t[1]-e[1]);const s=[];for(const i of t){const t=s[s.length-1];!t||i[0]>t[1]+e?s.push([...i]):t[1]=Math.max(t[1],i[1])}return s}(r,i).find(([t,e])=>t<=i&&e>=-i);if(!l)return null;const[h,c]=l,d=Er(n,s.axis,-s.half),p=Er(n,s.axis,s.half),_=Math.max(0,-s.half-h),u=Math.max(0,c-s.half),m=_>0?Er(n,s.axis,h):d,g=u>0?Er(n,s.axis,c):p,f=Or(a,s.normal)>=0?1:-1,b=(e,i,o)=>({from:e,to:i,label:[(e[0]+i[0])/2,(e[1]+i[1])/2],axis:s.axis,labelNormal:a,distance:o,roomId:t.roomId,roomSide:f,source:"room-face"});return{left:b(d,m,_),right:b(p,g,u)}}function qr(t){const e=Er(t.center,t.axis,-t.half),s=Er(t.center,t.axis,t.half),i=Er(t.center,t.axis,Math.min(-t.half,t.targetLo)),o=Er(t.center,t.axis,Math.max(t.half,t.targetHi)),a=(e,s)=>({from:e,to:s,label:[(e[0]+s[0])/2,(e[1]+s[1])/2],axis:t.axis,labelNormal:t.normal,distance:Math.hypot(s[0]-e[0],s[1]-e[1]),source:"host-end"});return[a(e,i),a(s,o)]}function Ur(t,e,s,i){const o=Lr(s,e),a=Or(o,o);if(!(a>i*i))return Math.hypot(...Lr(t,e))<=i;const n=Or(Lr(t,e),o)/a;if(n<-i||n>1+i)return!1;const r=Er(e,o,Math.max(0,Math.min(1,n)));return Math.hypot(...Lr(t,r))<=i}function Kr(t,e,s){let i=!1;for(let o=0,a=e.length-1;o<e.length;a=o++){if(Ur(t,e[a],e[o],s))return!0;const[n,r]=e[o],[l,h]=e[a];r>t[1]!=h>t[1]&&t[0]<(l-n)*(t[1]-r)/(h-r)+n&&(i=!i)}return i}function Vr(t,e,s,i,o,a){const n=Lr(i,s),r=Ar(e,n);if(Math.abs(r)<=a)return null;const l=Lr(s,t),h=Ar(l,n)/r,c=Ar(l,e)/r;return h<-a||h>o+a||c<-a||c>1+a?null:Math.max(0,Math.min(o,h))}function Jr(t,e,s){const i=qr(s),o="partition"===t.host?.kind?t.host.id:void 0;return[{base:i[0],direction:[-s.axis[0],-s.axis[1]]},{base:i[1],direction:s.axis}].map(({base:t,direction:s})=>{const i=t.distance,a=function(t,e,s,i,o,a){let n=null;for(const r of i)if(!o||r.partitionId!==o){if(Kr(t,r.body,a))return 0;for(let i=0;i<r.body.length;i++){const o=Vr(t,e,r.body[i],r.body[(i+1)%r.body.length],s,a);null!=o&&(null==n||o<n)&&(n=o)}}return n}(t.from,s,i,e.boundaries,o,e.epsilon);if(null==a)return t;const n=Er(t.from,s,a);return{...t,to:n,label:[(t.from[0]+n[0])/2,(t.from[1]+n[1])/2],distance:a,source:"connected-face"}})}function Yr(t,e){const s=function(t){const e=t.angle*Math.PI/180,s=[Math.cos(e),Math.sin(e)],i=[-s[1],s[0]],o=[t.x,t.y],a=[t.target.a,t.target.b].map(t=>Or(Lr(t,o),s));return{center:o,axis:s,normal:i,half:Math.max(0,t.renderedLength)/2,targetLo:Math.min(...a),targetHi:Math.max(...a)}}(t),i=e.rooms.flatMap(t=>{const i=function(t,e,s){const{profile:i}=t;let o=null;for(let t=0;t<i.poly.length;t++){if(!(i.kinds[t]&&i.offsets[t]>0))continue;const a=i.poly[t],n=i.poly[(t+1)%i.poly.length],r=Lr(n,a),l=Math.hypot(r[0],r[1]);if(!(l>s&&Br(e.axis,[r[0]/l,r[1]/l],1e-6)))continue;if(Hr(a,e.center,e.axis)>s||Hr(n,e.center,e.axis)>s)continue;const h=Or(Lr(a,e.center),e.axis),c=Or(Lr(n,e.center),e.axis),d=Math.min(h,c),p=Math.max(h,c);if(d>-e.half+s||p<e.half-s)continue;const _=Math.max(0,d>0?d:p<0?-p:0);(!o||_<o.offset-s||Math.abs(_-o.offset)<=s&&t<o.edge)&&(o={edge:t,offset:_})}return o?.edge??null}(t,s,e.epsilon);return null==i?[]:[{room:t,edge:i}]});if(i.length>2)return qr(s);if(i.length){const t=i.map(({room:t,edge:i})=>jr(t,i,s,e.epsilon));if(t.some(t=>!t))return qr(s);const o=t;return[...o.map(t=>t.left),...o.map(t=>t.right)]}return Jr(t,e,s)}const Xr="1.68.1",Zr={badge:"display.badge",icon_ripple:"display.icon_ripple",value:"display.value",static_icon:"display.static_icon"},Qr={badge:"marker.display_hint_badge",icon_ripple:"marker.display_hint_icon_ripple",value:"marker.display_hint_value",static_icon:"marker.display_hint_static_icon"},tl=2e3,el=1e3,sl=t=>{const e=String(t??"").trim().replace(",",".");if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(e))return null;const s=Number(e);return Number.isFinite(s)?s:null},il=(t,e,s,i)=>{for(t.delete(e),t.set(e,s);t.size>i;){const e=t.keys().next().value;if(void 0===e)break;t.delete(e)}},ol=1e3,al=2e3,nl=t=>{try{t.target?.setPointerCapture?.(t.pointerId)}catch{}},rl="8e6599b6df97336743ce3679c5cb470f3fbdd7f9938031e18c183aafbc1bc99d";class ll{constructor(t){this.host=t,this._junctionBaselineCache=new WeakMap,this._undoGeometry=()=>{if(this.host._physicalDrag||this.host._physicalRotate)return void this._cancelPhysicalGesture();if(this.host._decorDraft)return this.host._decorDraft=null,void this.host.requestUpdate();if(this.host._decorMove||this.host._dtDrag||this.host._bdDrag)return void this._cancelDecorGesture();if(this.host._resize.dragging)return void this._rszCancelDrag();const t=this.host._geometryHistory.undo();t&&(this._applyGeometryState(t.before,!0)?this.host._showToast(this.host._t("history.undone",{name:t.name})):this.host._geometryHistory.clear())},this._redoGeometry=()=>{if(this.host._physicalDrag||this.host._physicalRotate)return void this._cancelPhysicalGesture();if(this.host._decorDraft)return this.host._decorDraft=null,void this.host.requestUpdate();if(this.host._decorMove||this.host._dtDrag||this.host._bdDrag)return void this._cancelDecorGesture();if(this.host._resize.dragging)return void this._rszCancelDrag();const t=this.host._geometryHistory.redo();t&&(this._applyGeometryState(t.after,!0)?this.host._showToast(this.host._t("history.redone",{name:t.name})):this.host._geometryHistory.clear())},this._savePhysicalDialog=()=>{const t=this.host._physicalDialog,e=this.host._curSpaceCfg,s=this.host._spaceModel();if(!t||!e||!s)return;const i=sl(t.cm);if(null==i)return void this._showPhysicalRange("column"===t.kind?yt:100,"column"===t.kind?1:0);const o=this.host._imperial?2.54*i:i,a="column"===t.kind?yt:100,n="column"===t.kind?1:0;if(!Number.isFinite(o)||o<n||o>a)return void this._showPhysicalRange(a,n);if("column"===t.kind){const e=s.wall_columns.find(e=>e.id===t.id);if(!e)return;const i=sl(t.angle||"0");if("circle"!==t.shape&&(null==i||i<0||i>=90))return void this.host._showToast(this.host._t("toast.physical_angle"));const a="circle"===t.shape?{id:t.id,shape:"circle",center:e.center,cm:o}:{id:t.id,shape:"square",center:e.center,cm:o,angle:i};if(s.wall_columns.some(e=>e.id!==t.id&&vt(e,a,.02*this.host._gridPitch)))return void this.host._showToast(this.host._t("toast.column_duplicate"))}const r=this._geometrySnapshot();if("partition"===t.kind){const s=(e.partitions||[]).find(e=>e.id===t.id);if(s&&0===o&&$t(e.openings,{kind:"partition",id:t.id}))return void this.host._showToast(this.host._t("toast.zero_wall_opening_conflict"));s&&(s.cm=o)}else if("column"===t.kind){const s=(e.wall_columns||[]).find(e=>e.id===t.id);s&&(s.cm=wt(o),s.shape="circle"===t.shape?"circle":"square","square"===s.shape?s.angle=sl(t.angle||"0"):delete s.angle)}else{const s=(e.room_drafts||[]).find(e=>e.id===t.id);s?.segments?.[t.segment||0]&&(s.segments[t.segment||0].cm=o)}const l=this._commitPhysicalGeometry(this.host._t("history.physical_edit"),r);this.host._physicalDialog=null,l||this.host.requestUpdate()},this._deletePhysicalSelection=()=>{const t=this.host._physicalSel,e=this.host._curSpaceCfg;if(!t||!e)return;if("draft"===t.kind)return void this._deleteDraftWhole();const s=this._geometrySnapshot();if("partition"===t.kind){const s=(e.openings||[]).filter(e=>"partition"===e.host?.kind&&e.host.id===t.id).sort((t,e)=>(t.host?.t||0)-(e.host?.t||0));if(s.length)return void(this.host._partitionDeleteDialog={id:t.id,openings:s.map(t=>JSON.parse(JSON.stringify(t)))})}const i="partition"===t.kind?"partitions":"column"===t.kind?"wall_columns":"room_drafts";e[i]=(e[i]||[]).filter(e=>e.id!==t.id),e[i].length||delete e[i],this.host._activeDraftId===t.id&&this._cancelPath(),this.host._physicalSel=null,this.host._physicalDialog=null,this._commitPhysicalGeometry(this.host._t("history.physical_delete"),s)},this._confirmPartitionDelete=()=>{const t=this.host._partitionDeleteDialog,e=this.host._curSpaceCfg;if(!t||!e)return;const s=this._geometrySnapshot();e.partitions=(e.partitions||[]).filter(e=>e.id!==t.id),e.partitions.length||delete e.partitions,e.openings=(e.openings||[]).filter(e=>"partition"!==e.host?.kind||e.host.id!==t.id),e.openings.length||delete e.openings,this.host._partitionDeleteDialog=null,this.host._physicalSel=null,this.host._physicalDialog=null,this._commitPhysicalGeometry(this.host._t("history.physical_delete"),s)},this._deleteDraftWhole=()=>{const t="draft"===this.host._physicalDialog?.kind?this.host._physicalDialog.id:"draft"===this.host._physicalSel?.kind?this.host._physicalSel.id:null,e=this.host._curSpaceCfg;if(!t||!e||!confirm(this.host._t("confirm.delete_draft")))return;const s=this._geometrySnapshot();e.room_drafts=(e.room_drafts||[]).filter(e=>e.id!==t),e.room_drafts.length||delete e.room_drafts,this.host._activeDraftId===t&&this._cancelPath(),this.host._physicalSel=null,this.host._physicalDialog=null,this._commitPhysicalGeometry(this.host._t("history.physical_delete"),s)},this._deleteDraftSegment=()=>{const t=this.host._physicalDialog,e=this.host._curSpaceCfg;if(!t||"draft"!==t.kind||!e)return;if(!confirm(this.host._t("confirm.delete_draft_segment")))return;const s=(e.room_drafts||[]).findIndex(e=>e.id===t.id);if(s<0)return;const i=e.room_drafts[s],o=Math.max(0,Math.min(i.segments.length-1,t.segment||0)),a=[],n=i.points.slice(0,o+1),r=i.points.slice(o+1);if(n.length>=2&&a.push({id:i.id,points:n,segments:i.segments.slice(0,o)}),r.length>=2&&a.push({id:a.length?`${i.id}-${Date.now().toString(36)}`:i.id,points:r,segments:i.segments.slice(o+1)}),2===a.length&&e.room_drafts.length>=200)return void this.host._showToast(this.host._t("toast.physical_limit"));const l=this._geometrySnapshot();e.room_drafts.splice(s,1,...a),e.room_drafts.length||delete e.room_drafts,this.host._activeDraftId===i.id&&this._cancelPath(),this.host._physicalDialog=null,this.host._physicalSel=a.length?{kind:"draft",id:a[0].id}:null,this._commitPhysicalGeometry(this.host._t("history.draft_segment_delete"),l)},this._confirmRoomDelete=t=>{const e=this.host._roomDeleteDialog,s=this.host._curSpaceCfg,i=this.host._spaceModel();if(!e||!s||!i)return;const o=i.rooms.find(t=>t.id===e.roomId);if(!o)return void(this.host._roomDeleteDialog=null);const a=this.host._openCuts(),n=nn(z(i.rooms,this.host._spaceWalls,a,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol).filter(t=>t.roomId===o.id),i.partitions,this.host._openingsR.map(t=>({...t,x:t.rx,y:t.ry})),.02*this.host._gridPitch),r=new Set(n.materialize.filter(t=>!t.reusePartitionId).map(t=>t.interval.key)).size;if(t&&(s.partitions||[]).length+r>al)return void this.host._showToast(this.host._t("toast.physical_limit"));const l=this._geometrySnapshot(),h=kt(i.rooms,this.host._spaceWalls,a,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol);if(t){s.partitions||=[];const t=new Map,e=new Map,i=t=>{const e=(s.wall_segments||[]).find(e=>{const s=[Number(e.a?.[0])*ol,Number(e.a?.[1])*ol],i=[Number(e.b?.[0])*ol,Number(e.b?.[1])*ol];return this._samePt(t.a,s)&&this._samePt(t.b,i)||this._samePt(t.a,i)&&this._samePt(t.b,s)});return"string"==typeof e?.id&&e.id?e.id:null},o=Date.now().toString(36);for(const a of n.materialize){let n=a.reusePartitionId?s.partitions.find(t=>t.id===a.reusePartitionId):e.get(a.interval.key);n||(n={id:i(a.interval)||`partition-room-${o}-${e.size}`,a:[a.interval.a[0]/ol,a.interval.a[1]/ol],b:[a.interval.b[0]/ol,a.interval.b[1]/ol],cm:a.interval.cm},s.partitions.push(n),e.set(a.interval.key,n)),t.set(a.interval.key,n)}for(const e of s.openings||[]){const s=n.openingIntervals.get(e.id),i=s?t.get(s):null,o=this.host._openingsR.find(t=>t.id===e.id);if(!i||!o)continue;const a={a:[i.a[0]*ol,i.a[1]*ol],b:[i.b[0]*ol,i.b[1]*ol]};e.host={kind:"partition",id:i.id,t:rn([o.rx,o.ry],a)}}}else if(n.removeOpeningIds.length){const t=new Set(n.removeOpeningIds);s.openings=(s.openings||[]).filter(e=>!t.has(e.id)),s.openings.length||delete s.openings}s.rooms=s.rooms.filter(t=>t.id!==o.id),this.host._cfgEpoch++;const c=this.host._normalizeWalls(h,this.host._openCuts());c.length?s.walls=c:delete s.walls,this.host._roomDeleteDialog=null,this._commitPhysicalGeometry(this.host._t(t?"history.delete_room_keep_walls":"history.delete_room_with_walls"),l),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host.requestUpdate()},this._rebindPartitionOpening=()=>{const t=this.host._openingDialog;if(!t?.id)return;const e=t.id;this._activateMarkupTool("opening"),"opening"===this.host._tool&&(this.host._openingRebindId=e,this.host._openingPreset={type:t.type,lengthCm:t.lengthCm,flipH:t.flipH,flipV:t.flipV,revision:++this.host._openingPresetRevision},this.host._openingDialog=null,this.host._openingHoverCandidate=null)},this._keepClosedAsPartitions=()=>{if(this.host._wallFaceBatch)return void this._decideWallFace(!1);if(!this.host._contourClosed||this.host._pendingSplit||!this.host._curSpaceCfg)return;const t=this.host._curSpaceCfg,e=this.host._path.slice(0,-1);if((t.partitions||[]).length+e.length>al)return void this.host._showToast(this.host._t("toast.physical_limit"));const s=this._geometrySnapshot(),i=Ra(e.length,[...this.host._draftSegmentCms,this.host._closingWallCm??void 0],this.host._drawWallCm,A);t.partitions||=[];const o=Date.now().toString(36),a=this.host._activeDraftId?(t.room_drafts||[]).find(t=>t.id===this.host._activeDraftId):null,n=this._draftSegmentsForPath(this.host._path,a,i);for(let s=0;s<e.length;s++){const a=e[s],r=e[(s+1)%e.length];t.partitions.push({id:n[s]?.id||`partition-${o}-${s}`,a:[a[0]/ol,a[1]/ol],b:[r[0]/ol,r[1]/ol],cm:i[s]})}this.host._activeDraftId&&Array.isArray(t.room_drafts)&&(t.room_drafts=t.room_drafts.filter(t=>t.id!==this.host._activeDraftId),t.room_drafts.length||delete t.room_drafts),this._commitPhysicalGeometry(this.host._t("history.contour_to_partitions"),s),this.host._roomDialog=!1,this.host._path=[],delete this.host._resumeDraftBySpace[this.host._space],this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null},this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),e=this.host._spaceDialog;e&&(this.host._spaceDialog={...e,saved:t?.plans||[],savedBusy:!1})}catch(t){const e=this.host._spaceDialog;e&&(this.host._spaceDialog={...e,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}},this._openSettingsDialog=()=>{if(!this.host._norm)return;const t=this.host._glowRadiusCm,e=this.host._imperial?Math.round(t/30.48*10)/10:Math.round(t)/100;this.host._settingsDialog={colors:JSON.parse(JSON.stringify(this.host._fillColors)),glowRadius:e,bgColor:Dt(this.host._settings,{bgColor:null})||null,northDeg:Mt(this.host._settings,{}),bgMode:St(this.host._settings,{}),sunRays:xt(this.host._settings,{}),busy:!1}},this._openAlignDialog=()=>this._previewAlignDialog(!1),this._toggleOptimizeLivePositions=()=>{const t=this.host._alignDialog;t&&!t.busy&&t.report.liveMissingPositions.length&&this._previewAlignDialog(!t.removeLiveMissingPositions)},this._openBackupExport=()=>{this.host._settingsDialog=null,this.host._backupExportDialog={kind:"full",planOnly:!1,busy:!1,error:""}},this._openRulesDialog=()=>{if(!this.host._norm)return;const t=this.host._settings.icon_rules,e=(t&&t.length?t:Ct).map(t=>({...t}));this.host._rulesDialog={rules:e,test:"",busy:!1}},t._editorSecondary=new gn({root:()=>t.renderRoot,requestUpdate:()=>t.requestUpdate(),updateComplete:()=>t.updateComplete,clearTip:()=>{t._tip=null}}),t._resize=new Wo}_help(t){const e=`${t}.aria`,s=d(this.host.hass,this.host._config?.language);return Pt(s,t)&&Pt(s,e)?o`<hp-help data-help-key=${t}
      .text=${p(s,t)} .ariaLabel=${p(s,e)}></hp-help>`:a}_setMode(t,e=!0){this.host._endTabDrag(),this.host._pendingNavMode=null;const s=this.host._spaceModel();if(!s)return this.host._cancelModeTransition(!1),void(this.host._mode="view");if(this.host._kiosk&&"view"!==t)return;if(this.host._mode===t){if(!e&&"view"===t&&this.host._modeTransitionBusy){const e=this.host._currentModeVisual(t),s=this.host._modeTransitionTargetZoom,i=this.host._modeTransitionTargetCenterX,o=this.host._modeTransitionTargetCenterY;this.host._cancelModeTransition(!1),this.host._commitViewModeAtomic(e,s,i,o)}return}if(this.host._bootSoftCancel(),("plan"===t||"decor"===t)&&!this.host._norm)return void this.host._showToast(this.host._t("toast.markup_needs_server"));if(this.host._wallFaceBatch&&this._roomDialogCancel(),"plan"===this.host._mode&&"draw"===this.host._tool&&!this._finishWallChain())return;this.host._clearTransientHover(!0),this.host._cancelDevicePressFeedback();const i=this.host._mode,o=this.host._effectiveProjection(),a=this.host._currentModeVisual(i),n=this.host._modeTransitionBusy,r=a&&"view"!==i&&"view"!==t?{...a,toolbarContentOpacity:this.host._reducedMotion?1:.35}:a;this.host._cancelModeTransition(!1),this.host._editorSecondary.closeForNavigation(),(this.host._decorMove||this.host._dtDrag||this.host._bdDrag)&&this._cancelDecorGesture();const l=!s.bg&&"view"===t!=("view"===i),h=n&&"view"===i&&"view"!==t?this.host._modeTransitionEditorCamera:null;let c=h?.zoom??(n?this.host._modeTransitionTargetZoom:this.host._zoom),d=h?h.centerX:n?this.host._modeTransitionTargetCenterX:r?.viewport.centerX,p=h?h.centerY:n?this.host._modeTransitionTargetCenterY:r?.viewport.centerY;if("view"===i&&"view"!==t&&!n){const e=this.host._view;if(this.host._viewModeSnap={space:this.host._space,zoom:this.host._zoom,cx:e?this.host._logicalViewCenter(o)?.x:void 0,cy:e?this.host._logicalViewCenter(o)?.y:void 0},"iso"===o){const e=this.host._logicalViewCenter("iso");d=e?.x,p=e?.y,this.host._view=null,this.host._mode=t,this.host._applyView(this.host._zoom,e?.x,e?.y)}l&&(c=1,d=void 0,p=void 0)}if("plan"===i&&this.host._activeDraftId&&(this.host._resumeDraftBySpace[this.host._space]=this.host._activeDraftId),this.host._mode=t,"devices"===i&&"devices"!==t&&(this.host._showHidden=!1,this.host._deviceInbox=null,this.host._deviceInboxReturn=null,this.host._deviceInboxMemo=null),this.host._editorChromeMode="view"===t?i:t,"view"===t){"view"===i||n||(this.host._modeTransitionEditorCamera={zoom:this.host._zoom,centerX:r?.viewport.centerX,centerY:r?.viewport.centerY});const t=this.host._viewModeSnap;if(t&&t.space===this.host._space){c=t.zoom;const e=this.host._labsIso&&"iso"===this.host._viewPreference[this.host._space]?"iso":"flat",s=null!=t.cx&&null!=t.cy&&"iso"===e?It([t.cx,t.cy],0):null;d=s?.[0]??t.cx,p=s?.[1]??t.cy}else t&&(c=this.host._zoomBySpace[this.host._space]||1,d=void 0,p=void 0)}else this.host._modeTransitionEditorCamera={zoom:c,centerX:d,centerY:p};this.host._modeTransitionTargetZoom=c,this.host._modeTransitionTargetCenterX=d,this.host._modeTransitionTargetCenterY=p,("iso"===o||"view"===t&&this.host._labsIso&&"iso"===this.host._viewPreference[this.host._space])&&(this.host._modeTransitionForceAtomic=!0);const _=++this.host._modeTransitionRequest;e?r?(this.host._modeTransitionPreparing=!0,this.host._modeTransitionVisual=r,this.host._prepareModeTransition(_,r,t,c,d,p)):(this.host._modeTransitionPreparing=!1,this.host._modeTransitionVisual=null,this.host._zoom=c,this.host._view=null,requestAnimationFrame(()=>{this.host.isConnected&&_===this.host._modeTransitionRequest&&this.host._mode===t&&(this.host._applyView(c,d,p),"view"===t&&(this.host._viewModeSnap=null,this.host._modeTransitionEditorCamera=null),this.host.requestUpdate())})):"view"===t&&this.host._commitViewModeAtomic(r,c,d,p),this.host._path=[],this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this.host._tool="draw",this.host._mergeSel=null,this.host._mergeDialog=null,this.host._splitSel=null,this.host._pendingSplit=null,this.host._selId=null,this.host._physicalSel=null,this.host._physicalDialog=null,this.host._physicalDrag=null,this._rszResetController(),this.host._tip=null,this.host._hoverRoom=null,this.host._decorDraft=null,this.host._decorSel=null,this.host._decorMove=null,this.host._backdropDialog=null,this.host._decorTool="select",this.host._bdDrag=null,this.host._dtDrag=null,this.host._dtBox=null,"plan"===t&&(this._primeDrawWallField(),this._resumeLastDraft()),this.host._saveNav()}_primeDrawWallField(){null===this.host._drawWallField&&(this.host._drawWallField=Tt(A,this.host._imperial))}_showPhysicalRange(t=this.host._drawWallMaxCm,e=0){this.host._showToast(this.host._t("toast.physical_range",{min:Tt(e,this.host._imperial),max:Tt(t,this.host._imperial),unit:this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}))}_draftSegmentCount(t=this.host._curSpaceCfg){return(t?.room_drafts||[]).reduce((t,e)=>t+(Array.isArray(e.segments)?e.segments.length:0),0)}_mergeSpacePartitions(t,e){const s=t?.partitions||[];if(s.length<2)return 0;const i=Rn(s,{pitch:I,seedIds:e,geometry:Nn(t,{excludeDraftId:this.host._activeDraftId})});return i.merged?(t.partitions=i.partitions,Fn(t.openings,t.partitions,i.openingMoves,{coordScale:ol,cellCm:this.host._cellCm,gridPitch:this.host._gridPitch}),i.merged):0}_finishWallChain(){if("draw"!==this.host._tool||this.host._wallFaceBatch||this.host._roomDialog)return!0;const t=this.host._curSpaceCfg;if(!t||this.host._path.length<2)return this.host._path=[],this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null,this._clearPlanSnapHover(),!0;const e=Fa(this.host._path,Ra(this.host._path.length-1,this.host._draftSegmentCms,this.host._drawWallCm,A)),s=e.length;if((t.partitions||[]).length+s>al)return this.host._showToast(this.host._t("toast.physical_limit")),!1;const i=this._geometrySnapshot();t.partitions||=[];const o=Date.now().toString(36),a=[],n=this.host._activeDraftId?(t.room_drafts||[]).find(t=>t.id===this.host._activeDraftId):null,r=this._draftSegmentsForPath(this.host._path,n,e.map(t=>t.cm));for(let i=0;i<s;i++){const s=e[i],n=r[i]?.id||`partition-${o}-${i}`;a.push(n),t.partitions.push({id:n,a:[s.a[0]/ol,s.a[1]/ol],b:[s.b[0]/ol,s.b[1]/ol],cm:s.cm})}return this._mergeSpacePartitions(t,a),this.host._activeDraftId&&Array.isArray(t.room_drafts)&&(t.room_drafts=t.room_drafts.filter(t=>t.id!==this.host._activeDraftId),t.room_drafts.length||delete t.room_drafts),this._commitPhysicalGeometry(this.host._t("history.wall_chain_finish"),i),delete this.host._resumeDraftBySpace[this.host._space],this.host._path=[],this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null,this._clearPlanSnapHover(),!0}_activateMarkupTool(t){t!==this.host._tool&&(this.host._wallFaceBatch&&this._roomDialogCancel(),("draw"!==this.host._tool||this._finishWallChain())&&(this._cancelPath(),"resize"===this.host._tool&&(this.host._resize.dragging?this._rszCancelDrag():this.host._resize.reset()),this.host._tool=t,"draw"===t&&this._resumeLastDraft(),"resize"===t&&this.host._resize.selectRoom(null),"wallthick"===t&&(this.host._wallDialog=null)))}_limitReached(t){const e=this.host._curSpaceCfg;if(!e)return!0;const s="draft"===t?(e.room_drafts||[]).length>=200:"partition"===t?(e.partitions||[]).length>=al:(e.wall_columns||[]).length>=500;return s&&this.host._showToast(this.host._t("toast.physical_limit")),s}_svgPoint(t){const e=this.host.renderRoot.querySelector(".stage").getBoundingClientRect();return this.host._screenToVb(t.clientX-e.left,t.clientY-e.top)}_snap(t){const e=this.host._gridPitch;return[Rt(Ft(t[0],e)),Rt(Ft(t[1],e))]}_snapDrawPoint(t,e=!1){const s=this.host._path[this.host._path.length-1],i=e&&s?Nt(s,t,this.host._gridPitch,Ti):t;return this._snap(i)}_planSnapOpeningCuts(t,e){if(!this.host._openingsR.length)return[];const s=this.host._openingWallIndexFor(t,e).value,i=[];for(const e of this.host._roomWallOpeningInputs(this.host._openingsR,t)){const t=W(s,e);if(!t.negative&&!t.positive)continue;const o=e.angle*Math.PI/180,a=Math.cos(o)*e.length/2,n=Math.sin(o)*e.length/2;i.push([e.x-a,e.y-n,e.x+a,e.y+n])}return i}_planSnapGeometrySnapshot(){const t=this.host._spaceModel();if(!t)return{key:`${this.host._space}|empty`,value:{segments:[],endpoints:[]}};const e=[this.host._space,this.host._cfgEpoch,this.host._activeDraftId||"",t.rooms.length,t.room_drafts.length,t.partitions.length].join("|");if(this.host._planSnapGeometryCache?.key===e)return this.host._planSnapGeometryCache;const s=this.host._openCuts(),i=xa({space:t,activeDraftId:this.host._activeDraftId,roomCuts:this._planSnapOpeningCuts(t,s),partitionCuts:this._partitionOpeningCuts(t),epsilon:2e-4*this.host._gridPitch});return this.host._planSnapGeometryCache={key:e,value:i},this.host._planSnapGeometryCache}_hiddenWallDiagnosticSnapshot(){const t=this.host._spaceModel();if(!t)return{key:`${this.host._space}|hidden-empty`,value:{segments:[],endpoints:[]}};const e=["hidden",this.host._space,this.host._cfgEpoch,this.host._activeDraftId||"",t.rooms.length,t.room_drafts.length,t.partitions.length].join("|");if(this.host._hiddenWallDiagnosticCache?.key===e)return this.host._hiddenWallDiagnosticCache;const s=ka({space:t,activeDraftId:this.host._activeDraftId,epsilon:2e-4*this.host._gridPitch});return this.host._hiddenWallDiagnosticCache={key:e,value:s},this.host._hiddenWallDiagnosticCache}_planStructuralGeometrySnapshot(){const t=this.host._spaceModel();if(!t)return{key:`${this.host._space}|structural-empty`,value:{segments:[],endpoints:[]}};const e=["structural",this.host._space,this.host._cfgEpoch,this.host._activeDraftId||"",t.rooms.length,t.room_drafts.length,t.partitions.length].join("|");if(this.host._planStructuralGeometryCache?.key===e)return this.host._planStructuralGeometryCache;const s=xa({space:t,activeDraftId:this.host._activeDraftId,epsilon:2e-4*this.host._gridPitch});return this.host._planStructuralGeometryCache={key:e,value:s},this.host._planStructuralGeometryCache}_planSnapContextKey(t){const e=this.host._path[0],s=this.host._path[this.host._path.length-1];return[t,this.host._tool,this.host._path.length,e?`${e[0]},${e[1]}`:"",s?`${s[0]},${s[1]}`:""].join("|")}_resolvePlanDrawPoint(t,e){const s=this._planSnapGeometrySnapshot(),i=this.host._path[this.host._path.length-1],o="draw"===this.host._tool&&this.host._path.length>=3?[{point:this.host._path[0],key:"closure:first-point"}]:[],a={tolerance:this._cssPxToRender(12),distinguishTolerance:this._cssPxToRender(8),gridStep:this.host._gridPitch,excludePoints:i?[i]:[],extraEndpoints:o,epsilon:2e-4*this.host._gridPitch},n=e&&i?Ia(s.value,t,{...a,anchor:i}):function(t,e,s){if(!(ma(e)&&s.tolerance>=0))return{kind:"none",candidate:null,conflicts:[]};const i=s.epsilon??ua,o=s.excludePoints||[],a=Ca(Da(t,e,s),s.distinguishTolerance||0);if(a)return a;let n=null;for(const a of t.segments){const t=[a.a[0],a.a[1],a.b[0],a.b[1]],r=C([e[0],e[1]],t);if(r>s.tolerance)continue;const l=Pa(a,e,s.gridStep);!Sa(l,o,i)&&Ma(r,a.key,n)&&(n={kind:"line",point:l,key:a.key,distance:r,segment:a})}return n?{kind:"resolved",candidate:n,conflicts:[]}:{kind:"none",candidate:null,conflicts:[]}}(s.value,t,a),r="resolved"===n.kind?n.candidate:null,l=r?[...r.point]:this._snapDrawPoint(t,e),h=i?zt(i,l):l;return{point:h,candidate:r&&q(h,r.point)?r:null,conflicts:"ambiguous"===n.kind?n.conflicts:[],ambiguous:"ambiguous"===n.kind,contextKey:this._planSnapContextKey(s.key)}}_clearPlanSnapHover(t=!0){this.host._planSnapHover=null,this._syncPlanSnapActiveMarker(null),this._syncPlanSnapConflictMarkers([]),t&&(this.host._cursorPt=null)}_samePt(t,e){return q(t,e)}_dropLegacySegments(){for(const t of this.host._serverCfg?.markers||[])"ripple"===t.display&&(t.display="icon_ripple");for(const t of this.host._serverCfg?.spaces||[]){delete t.segments;const e=new Set,s=t=>"string"==typeof t&&t.length>=1&&t.length<=64&&!e.has(t),i=t=>(e.add(t),!0),o=t=>Array.isArray(t)&&2===t.length&&t.every(t=>Number.isFinite(Number(t))&&Math.abs(Number(t))<=Xt);if(Array.isArray(t.partitions)&&(t.partitions=t.partitions.filter(t=>t&&s(t.id)&&o(t.a)&&o(t.b)&&Math.hypot(t.a[0]-t.b[0],t.a[1]-t.b[1])>1e-9&&i(t.id)).map(t=>({...t,cm:Number.isFinite(Number(t.cm))?Math.max(0,Math.min(100,Number(t.cm))):15})),t.partitions.length||delete t.partitions),Array.isArray(t.wall_columns)&&(t.wall_columns=t.wall_columns.filter(t=>t&&s(t.id)&&o(t.center)&&i(t.id)).map(t=>({id:t.id,shape:"circle"===t.shape?"circle":"square",center:[Number(t.center[0]),Number(t.center[1])],cm:wt(Number(t.cm)||15),..."circle"===t.shape?{}:{angle:At(t.angle)}})),t.wall_columns.length||delete t.wall_columns),Array.isArray(t.room_drafts)&&(t.room_drafts=t.room_drafts.filter(t=>t&&s(t.id)&&Array.isArray(t.points)&&t.points.length>=2&&t.points.every(o)&&i(t.id)).map(t=>{const e=hr(t);return{id:t.id,...e}}).filter(t=>t.points.length>=2),t.room_drafts.length||delete t.room_drafts),Array.isArray(t.walls)){const e=Ot(ut({spaces:[t]}),t.id),s=e?Lt(t,e,ol,.02*nt).contour.map(t=>t.map(t=>t/ol)):V(t.open_spans).map(t=>[t.a[0],t.a[1],t.b[0],t.b[1]]);t.walls=rt(t.walls,t.rooms||[],I,1,s),t.walls.length||delete t.walls}}}_rollbackRejectedPhysicalWrites(t){if(!this.host._serverCfg||!t.length)return!1;let e=!1;for(const[s]of t){const t=this.host._pendingPhysicalWrites.get(s);t&&(e=this._restoreGeometryStateInConfig(this.host._serverCfg,t.before)||e,this.host._pendingPhysicalWrites.delete(s))}return!!e&&(this._clearGeometryGesture(),this.host._geometryHistory.clear(),this.host._cfgEpoch++,this.host._modelCache=null,this.host._wallUnionCache=null,this.host._physicalBodiesCache=null,this.host._frame=null,this.host._regSignature="",this.host._cfgContentFingerprint=Et(this.host._serverCfg),this.host._maybeRebuildDevices(),this.host.requestUpdate(),!0)}async _reloadRejectedPhysicalWrite(){const t=this.host._writeChain;await t.catch(()=>{}),await this.host._reloadConfigOnly(!0)}_writeConfig(){this.host._writesPending++,this.host._writeChain=Bt(this.host._writeChain,async()=>{if(!this.host._serverCfg)return;this._dropLegacySegments();const t=Mi(this.host._serverCfg),e=Et(t),s=[...this.host._pendingPhysicalWrites.entries()];for(const[e,i]of s){const s=t.spaces.find(t=>t.id===e),o=jt(s);if(o===i.fingerprint)continue;let a=!1;try{a=this._checkSpacePhysicalGeometry(t,e).ok}catch{a=!1}if(!a)throw this._restoreGeometryStateLocal(i.before),this.host._pendingPhysicalWrites.delete(e),this.host._geometryHistory.clear(),this.host._showToast(this.host._t("toast.geometry_unsafe")),Object.assign(new Error("unsafe wall geometry"),{code:"geometry-unsafe"});i.fingerprint=o}e!==Et(this.host._serverCfg)&&(this.host._serverCfg=t),this.host._cfgContentFingerprint=e;try{await this.host._sendConfigCandidate(t)}catch(t){if(!this._rollbackRejectedPhysicalWrites(s))throw t;const e=t&&"object"==typeof t?t:Object.assign(new Error(String(t)),{cause:t});throw e.physicalGeometryRolledBack=!0,e}for(const[t,e]of s)this.host._pendingPhysicalWrites.get(t)?.fingerprint===e.fingerprint&&this.host._pendingPhysicalWrites.delete(t)});return this.host._writeChain.finally(()=>{this.host._writesPending--})}_saveConfig(){this.host._cfgEpoch++,this.host._saveConfigDebounced()}_geometrySnapshotFromConfig(t,e){const s=t?.spaces?.find(t=>t.id===e);if(!s)return null;const i=t=>JSON.parse(JSON.stringify(t)),o={};for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])void 0!==s[t]&&(o[t]=s[t]);return{spaceId:e,rooms:i(s.rooms||[]),...Array.isArray(s.openings)?{openings:i(s.openings)}:{},...Array.isArray(s.walls)?{walls:i(s.walls)}:{},...Array.isArray(s.wall_segments)?{wall_segments:i(s.wall_segments)}:{},...Array.isArray(s.open_spans)?{open_spans:i(s.open_spans)}:{},...Array.isArray(s.room_drafts)?{room_drafts:i(s.room_drafts)}:{},...Array.isArray(s.partitions)?{partitions:i(s.partitions)}:{},...Array.isArray(s.wall_columns)?{wall_columns:i(s.wall_columns)}:{},...Array.isArray(s.decor)?{decor:i(s.decor)}:{},plan_transform:o}}_geometrySnapshot(t=this.host._space){return this._geometrySnapshotFromConfig(this.host._serverCfg,t)}_recordGeometry(t,e){if(!e)return;const s=this._geometrySnapshot(e.spaceId);s&&JSON.stringify(e)!==JSON.stringify(s)&&(this.host._geometryHistory.push({name:t,before:e,after:s}),this.host.requestUpdate())}_restoreGeometryStateInConfig(t,e,s=!1){const i=t?.spaces?.find(t=>t.id===e.spaceId);if(!i)return!1;const o=t=>JSON.parse(JSON.stringify(t)),a=new Map((i.rooms||[]).map(t=>[t.id,t]));if(i.rooms=o(e.rooms),s)for(const t of i.rooms){const e=a.get(t.id);!Array.isArray(t.wall_ids)&&Array.isArray(e?.wall_ids)&&e.wall_ids.length===t.poly?.length&&(t.wall_ids=o(e.wall_ids))}const n=(t,e)=>{void 0!==e?i[t]=o(e):s&&"wall_segments"===t||delete i[t]},r=new Map((i.openings||[]).map(t=>[t.id,t])),l=new Map((i.room_drafts||[]).map(t=>[t.id,t]));if(n("openings",e.openings),n("walls",e.walls),n("wall_segments",e.wall_segments),n("open_spans",e.open_spans),n("room_drafts",e.room_drafts),n("partitions",e.partitions),n("wall_columns",e.wall_columns),n("decor",e.decor),s){for(const t of i.openings||[]){const e=r.get(t.id);t.host||"wall"!==e?.host?.kind||(t.host=o(e.host))}for(const t of i.room_drafts||[]){const e=l.get(t.id);for(let s=0;s<(t.segments||[]).length;s++)!t.segments[s]?.id&&e?.segments?.[s]?.id&&(t.segments[s].id=e.segments[s].id)}}for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])delete i[t];return Object.assign(i,o(e.plan_transform||{})),!0}_restoreGeometryStateLocal(t){return!!this._restoreGeometryStateInConfig(this.host._serverCfg,t)&&(this.host._cfgEpoch++,this.host._modelCache=null,this.host._wallUnionCache=null,this.host._physicalBodiesCache=null,this.host._frame=null,this.host.requestUpdate(),!0)}_wallModelBlockerLabel(t){const e=t instanceof er?t.reason:"invalid-room";return this.host._t(`wall_model.reason.${e}`)}_hasLegacyZeroWallFields(t=this.host._serverCfg){return(t?.spaces||[]).some(t=>Array.isArray(t?.open_spans)&&t.open_spans.length>0||(t?.rooms||[]).some(t=>Array.isArray(t?.open_to)&&t.open_to.length>0))}_showWallModelMigrationBlocked(t){const e=this._hasLegacyZeroWallFields()?"toast.zero_wall_migration_blocked":"toast.wall_model_migration_blocked";this.host._showToast(this.host._t(e,{reason:this._wallModelBlockerLabel(t)}))}_limitSegmentsOf(t){const e=[];for(const s of t?.wall_segments||[])s?.a&&s?.b&&e.push({id:String(s.id||""),a:s.a,b:s.b,cm:Number(s.cm)});for(const s of t?.partitions||[])s?.a&&s?.b&&e.push({id:String(s.id||""),a:s.a,b:s.b,cm:Number(s.cm)});for(const s of t?.room_drafts||[]){const t=Array.isArray(s?.points)?s.points:[],i=Array.isArray(s?.segments)?s.segments:[];for(let o=0;o+1<t.length;o++)e.push({id:String(i[o]?.id||`${s?.id||"draft"}-${o}`),a:t[o],b:t[o+1],cm:Number(i[o]?.cm)})}return e}_junctionLimitViolations(t,e,s){const i=(t?.spaces||[]).find(t=>t?.id===e);if(!i)return[];const o=Number(i.cell_cm)>0?Number(i.cell_cm):5,a=this._limitSegmentsOf(i),n=[...ta(a),...aa(a,o,I),...ra(a,o,I)];let r=null;try{r=Ht(i.rooms||[],i.walls||[],[],I,o,I,1)}catch{r=null}let l="ok"===s?.status||"degraded-extra"===s?.status?s.roomGeom:null;if(!l&&r&&r.nodes.length)try{const t=Gt(i.rooms||[],i.walls||[],[],[],I,o,I,1);l="ok"===t?.status||"degraded-extra"===t?.status?t.roomGeom:null}catch{l=null}for(const t of i.rooms||[]){const e=String(t?.id||"");if(!e)continue;let s=null;try{s=Wt(i.rooms||[],e,i.walls||[],[],I,o,I,1,l??void 0,r)}catch{s=null}n.push(...la(e,s,o,I))}return n}_junctionLimitLabel(t){const e=t=>String(Math.round(10*t)/10);return this.host._t(`junction.limit_${t.rule}`,{actual:e(t.actual),limit:e(t.limit)})}_junctionLimitsIntroduced(t,e,s,i){let o;const a=(e?.spaces||[]).find(t=>t?.id===s);let n="";try{n=jt(a)}catch{n=""}const r=e&&"object"==typeof e?this._junctionBaselineCache.get(e):void 0;if(r&&n&&r.fingerprint===n&&r.spaceId===s&&(o=r.violations),!o){try{const t=Number(e?.model_version||0)>=9?e:Mr(e).config;o=this.host._junctionLimitViolations(t,s)}catch{return[]}e&&"object"==typeof e&&n&&this._junctionBaselineCache.set(e,{spaceId:s,fingerprint:n,violations:o})}let l=[];try{l=this.host._junctionLimitViolations(t,s,i)}catch{return[{rule:"check_failed",subject:s,actual:0,limit:0}]}return function(t,e){const s=new Map;for(const t of e||[])s.set(t.rule,(s.get(t.rule)||0)+1);const i=new Map;for(const e of t||[])i.set(e.rule,[...i.get(e.rule)||[],e]);const o=[];for(const[t,e]of i){const i=e.length-(s.get(t)||0);i>0&&o.push(...e.slice(0,i))}return o}(l,o)}_commitPhysicalGeometry(t,e,s=[]){if(!e||!this.host._serverCfg)return!1;const i=this.host._serverCfg,o=this._geometrySnapshotFromConfig(i,e.spaceId),a=i.spaces.find(t=>t.id===e.spaceId);if(!a||jt(e)===jt(a))return!1;let n,r=!1;try{r=this._checkSpacePhysicalGeometry(i,e.spaceId).ok}catch{r=!1}if(!r)return this._clearGeometryGesture(),this._restoreGeometryStateLocal(e),this.host._showToast(this.host._t("toast.geometry_unsafe")),!1;let l=e;try{if(Number(i.model_version||0)<9){const t=JSON.parse(JSON.stringify(i));if(!this._restoreGeometryStateInConfig(t,e))throw new er("invalid-room",e.spaceId);const s=Mr(t).config;l=this._geometrySnapshotFromConfig(s,e.spaceId)||e;const a=JSON.parse(JSON.stringify(s));if(!o||!this._restoreGeometryStateInConfig(a,o,!0))throw new er("invalid-room",e.spaceId);const r=s.spaces.find(t=>t.id===e.spaceId),h=a.spaces.find(t=>t.id===e.spaceId);if(!Array.isArray(o.wall_segments)&&JSON.stringify(e.rooms)===JSON.stringify(o.rooms))for(const t of h?.wall_segments||[])t.cm=Q(o.walls,t.a,t.b,I,1);const c=((t,e,s)=>{const i=new Map,o=new Map((t?.rooms||[]).map(t=>[t.id,t])),a=new Map((e||[]).map(t=>[t.id,t])),{rooms:n}=$r(s,yr(t));for(const t of n){const e=a.get(t.id),n=o.get(t.id),r=R(e),l=(s.rooms||[]).find(e=>e.id===t.id),h=R(l),c=R(n);if(r&&h&&c&&r.length===h.length&&c.length===n?.wall_ids?.length&&t.poly.length===t.wall_ids.length)for(let e=0;e<r.length;e++){const s=(t,e,s,i)=>{const o=[];for(let a=0;a<t.length;a++){const n=t[a],r=t[(a+1)%t.length];if(pr(n,s,i)>tr||pr(r,s,i)>tr)continue;const l=dr(n,s,i),h=dr(r,s,i);l<-tr||h>1+tr||h<=l+tr||o.push({start:l,id:e[a]})}return o.sort((t,e)=>t.start-e.start)},o=s(c,n.wall_ids,r[e],r[(e+1)%r.length]),a=s(t.poly,t.wall_ids,h[e],h[(e+1)%h.length]);if(o.length&&o.length===a.length)for(let t=0;t<o.length;t++){const e=i.get(a[t].id);if(e&&e!==o[t].id)throw new er("duplicate-id",a[t].id);i.set(a[t].id,o[t].id)}}}return i})(r,e.rooms,h);n=Mr(a,{lineageHints:c,lineageSpaceId:e.spaceId}).config}else n=Mr(i).config}catch(t){return this._clearGeometryGesture(),this._restoreGeometryStateLocal(e),this._showWallModelMigrationBlocked(t),!1}let h=!1;try{const t=n.spaces.find(t=>t.id===e.spaceId),i=this.host._path.length>=2?this.host._path.map(t=>[t[0]/ol,t[1]/ol]):[];i.push(...s.map(t=>[t[0],t[1]])),h=cr(t)<=cr(l,i)&&this._checkSpacePhysicalGeometry(n,e.spaceId).ok}catch{h=!1}if(!h)return this._clearGeometryGesture(),this._restoreGeometryStateLocal(e),this.host._showToast(this.host._t("toast.geometry_unsafe")),!1;const c=JSON.parse(JSON.stringify(i));this._restoreGeometryStateInConfig(c,e);const d=this._junctionLimitsIntroduced(n,c,e.spaceId);if(d.length)return this._clearGeometryGesture(),this._restoreGeometryStateLocal(e),this.host._showToast(this._junctionLimitLabel(d[0])),!1;Cr(i,n),this._recordGeometry(t,l);const p=i.spaces.find(t=>t.id===e.spaceId),_=this.host._pendingPhysicalWrites.get(e.spaceId);return this.host._pendingPhysicalWrites.set(e.spaceId,{before:_?.before||l,fingerprint:jt(p)}),this._saveConfig(),!0}_clearGeometryGesture(){this.host._path=[],this._clearPlanSnapHover(),this._clearOpeningPlacement(!1),this.host._mergeSel=null,this.host._mergeDialog=null,this.host._splitSel=null,this.host._pendingSplit=null,this.host._wallFaceBatch=null,this.host._wallRepairDiagnostic=null,this.host._roomDeleteDialog=null,this.host._wallDialog=null,this.host._physicalDialog=null,this.host._physicalSel=null,this.host._physicalDrag=null,this.host._physicalRotate=null,this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null,this.host._openingDialog=null,this._rszResetController(),this.host._decorDraft=null,this.host._decorMove=null,this.host._dtDrag=null,this.host._bdDrag=null}_stagePointerCancel(t){if(clearTimeout(this.host._kioskHoldTimer),this.host._swipeStart?.id===t.pointerId&&(this.host._swipeStart=null),this.host._physicalDrag?.pid===t.pointerId||this.host._physicalRotate?.pid===t.pointerId)return void this._cancelPhysicalGesture();if(this.host._decorDraft?.pid===t.pointerId)return this.host._decorDraft=null,void this.host.requestUpdate();if(this.host._decorMove?.pid===t.pointerId||this.host._dtDrag?.pid===t.pointerId||this.host._bdDrag?.pid===t.pointerId)return void this._cancelDecorGesture();"opening"===this.host._tool?(this.host._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this.host._tool&&this._clearPlanSnapHover();const e=!!this.host._pinchStart||!!this.host._panStart;this.host._pointers.delete(t.pointerId),this.host._pointers.size<2&&(this.host._pinchStart=null),0===this.host._pointers.size&&(this.host._panStart=null,this.host._panLock=null),e&&0===this.host._pointers.size&&this.host.requestUpdate()}_applyGeometryState(t,e=!1){if(!this.host._canCommitSpace(t.spaceId))return!1;const s=this._geometrySnapshot(t.spaceId);if(!s||!this._restoreGeometryStateLocal(t))return!1;const i=this.host._serverCfg,o=jt(s)!==jt(t);if(o){let o=!1;try{const s=i?this._checkSpacePhysicalGeometry(i,t.spaceId):null;o=!!s?.ok||!(!e||"wall-degraded-extra"!==s?.reason)}catch{o=!1}if(!o)return this._restoreGeometryStateLocal(s),this.host._showToast(this.host._t("toast.geometry_unsafe")),!1}let a;try{a=Mr(i).config}catch(t){return this._restoreGeometryStateLocal(s),this._showWallModelMigrationBlocked(t),!1}if(o){let o=!1;try{const s=a?this._checkSpacePhysicalGeometry(a,t.spaceId):null;o=!!s?.ok||!(!e||"wall-degraded-extra"!==s?.reason)}catch{o=!1}if(!o)return this._restoreGeometryStateLocal(s),this.host._showToast(this.host._t("toast.geometry_unsafe")),!1;Cr(i,a);const n=i?.spaces.find(e=>e.id===t.spaceId),r=this.host._pendingPhysicalWrites.get(t.spaceId);this.host._pendingPhysicalWrites.set(t.spaceId,{before:r?.before||s,fingerprint:jt(n)})}else Cr(i,a);return this._clearGeometryGesture(),this.host._space!==t.spaceId&&(this.host._commitSpace(t.spaceId),this.host._saveNav(),this.host._restoreZoom()),this.host._modelCache=null,this.host._frame=null,this.host._regSignature="",this.host._maybeRebuildDevices(),this._saveConfig(),this.host.requestUpdate(),!0}_roomAt(t){return this.host._spaceModel()?.rooms.find(e=>{const s=R(e);return!!s&&qt(t,s)})}_overlapRoom(t){return this.host._spaceModel()?.rooms.find(e=>{const s=R(e);return!!s&&$(t,s)})}_pointInRoom(t,e){return e.poly?Ut(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_contourSelfIntersects(t){if(!go(t))return!0;const e=t.length,s=.001;for(let i=0;i<e;i++){const o=t[i],a=t[(i+1)%e];for(let n=i+1;n<e;n++){if(n===i+1||0===i&&n===e-1)continue;const r=t[n],l=t[(n+1)%e],h=[r[0],r[1],l[0],l[1]],c=[o[0],o[1],a[0],a[1]];if(C(o,h)<=s||C(a,h)<=s||C(r,c)<=s||C(l,c)<=s)return!0}}return!1}_canAppendRoomDraftPoint(){if(null==this.host._drawWallCm)return this._showPhysicalRange(100),!1;if(this.host._path.length>=500)return this.host._showToast(this.host._t("toast.physical_limit")),!1;const t=this.host._curSpaceCfg;return!(!this.host._activeDraftId&&(t?.room_drafts||[]).length>=200||this._draftSegmentCount(t)>=2e3||(t?.partitions||[]).length+this.host._path.length>al)||(this.host._showToast(this.host._t("toast.physical_limit")),!1)}_markupClick(t){if(this.host._vacFit)return;if(!this.host._markup)return;const e=this.host._spaceModel();if(!e)return void this._clearGeometryGesture();if(this.host._suppressClick)return;if(this.host._drag||this.host._rlResize)return;const s=t.composedPath?.()||[];if(s.some(t=>t?.classList?.contains?.("roomlabel")||t?.classList?.contains?.("rlhandle")))return;if(s.some(t=>t?.classList?.contains?.("physical-hit")))return;const i=this._svgPoint(t);if("select"===this.host._tool)return void(this.host._physicalSel=null);if("resize"===this.host._tool){if(this.host._resize.dragging||s.some(t=>t?.classList?.contains?.("rszhandle")))return;const t=[...e.rooms].reverse().find(t=>this._pointInRoom(i,t));return this.host._resize.selectRoom(t?.id||null),void this.host.requestUpdate()}if("delroom"===this.host._tool)return void this._deleteRoomClick(i);if("opening"===this.host._tool)return void this._openingClick(i);if("merge"===this.host._tool)return void this._mergeClick(i);if("wallthick"===this.host._tool)return void this._wallThickClick(i);if("split"===this.host._tool)return void this._splitClick(i);if("column"===this.host._tool)return void this._columnClick(i);this.host._wallRepairDiagnostic=null;const o=this._resolvePlanDrawPoint(i,t.shiftKey);if(o.ambiguous)return this.host._planSnapHover={contextKey:o.contextKey,candidate:null,conflicts:o.conflicts},this._syncPlanSnapActiveMarker(null),this._syncPlanSnapConflictMarkers(o.conflicts),void this.host._showToast(this.host._t("toast.plan_snap_ambiguous"));let a=o.point;if(t.ctrlKey||t.metaKey){if(t.preventDefault(),this.host._path.length<3)return;a=zt(this.host._path[this.host._path.length-1],this.host._path[0])}if(!this.host._path.length){if(!t.shiftKey&&!o.candidate&&this._offerExistingWallFace(i))return;const e=this._draftEndAt(a);return e?(this.host._activeDraftId=e.draft.id,this.host._resumeDraftBySpace[this.host._space]=e.draft.id,this.host._path=e.reverse?[...e.draft.points].reverse().map(t=>[...t]):e.draft.points.map(t=>[...t]),void(this.host._draftSegmentCms=this._adoptDraftCms(this.host._path,e.reverse?[...e.draft.segments].reverse().map(t=>t.cm):e.draft.segments.map(t=>t.cm),e.draft.id))):(this.host._activeDraftId=null,this.host._draftSegmentCms=[],void(this.host._path=[a]))}const n=this.host._path[this.host._path.length-1];if(this._samePt(a,n))return;const r=this._draftEndAt(a,this.host._activeDraftId||void 0);if(r)return void this._mergeDraftEndpoint(r);if(!this._canAppendRoomDraftPoint())return;const l=this.host._drawWallCm;if(null==l)return void this._showPhysicalRange(100);const h=this.host._path.map(t=>[...t]);this.host._path=[...this.host._path,a],this.host._draftSegmentCms=[...this.host._draftSegmentCms,l],this._persistActiveDraftSegment(),this._offerWallFaces(h)}_draftEndAt(t,e){const s=this.host._spaceModel();if(!s)return null;const i=this.host._viewOr(this.host._baseVb()),o=Math.max(.15*this.host._gridPitch,this.host._stageEl?.clientWidth?i.w/this.host._stageEl.clientWidth*12:0);for(const i of s.room_drafts||[]){if(i.id===e)continue;if(i.points.length<2)continue;const s=i.points[0],a=i.points[i.points.length-1];if(Math.hypot(t[0]-a[0],t[1]-a[1])<=o)return{draft:i,reverse:!1};if(Math.hypot(t[0]-s[0],t[1]-s[1])<=o)return{draft:i,reverse:!0}}return null}_mergeDraftEndpoint(t){const e=this.host._curSpaceCfg;if(!e||!this.host._path.length)return;const s=this.host._path.map(t=>[...t]),i=this._wallGraphSources(s),o=Array.isArray(e.room_drafts)?e.room_drafts:[],a=this.host._activeDraftId?o.find(t=>t.id===this.host._activeDraftId):null,n=o.find(e=>e.id===t.draft.id);if(!n)return;const r=t.reverse?t.draft.points.map(t=>[...t]):[...t.draft.points].reverse().map(t=>[...t]),l=t.reverse?(n.segments||[]).map(t=>({...t})):[...n.segments||[]].reverse().map(t=>({...t})),h=this.host._path[this.host._path.length-1],c=this._samePt(h,r[0]),d=c?null:this.host._drawWallCm;if(!c&&null==d)return void this._showPhysicalRange(100);const p=this._draftSegmentsForPath(this.host._path,a,this.host._draftSegmentCms),_=[...this.host._path.map(t=>[...t]),...c?r.slice(1):r],u=[...p,...null==d?[]:[{cm:d}],...l],m=_.length>=4&&this._samePt(_[0],_[_.length-1]),g=_,f=u;if(g.length>500)return void this.host._showToast(this.host._t("toast.physical_limit"));const b=(a?.segments?.length||0)+(n.segments?.length||0);if(this._draftSegmentCount(e)-b+f.length>2e3)return void this.host._showToast(this.host._t("toast.physical_limit"));if(m){const t=g.slice(0,-1);if(this._contourSelfIntersects(t)||k(t)<=1e-6)return void this.host._showToast(this.host._t("toast.contour_cannot_close"));const e=this._overlapRoom(t);if(e)return void this.host._showToast(this.host._t("toast.room_overlap",{name:e.name||""}))}const y=this._geometrySnapshot(),v=this.host._activeDraftId||t.draft.id,$={...a||n,id:v,points:g.map(t=>[t[0]/ol,t[1]/ol]),segments:f};e.room_drafts=o.filter(e=>e.id!==t.draft.id&&(!this.host._activeDraftId||e.id!==this.host._activeDraftId)),e.room_drafts.push($),this.host._activeDraftId=v,this.host._resumeDraftBySpace[this.host._space]=v,this.host._path=g,this.host._draftSegmentCms=this._adoptDraftCms(g,f.map(t=>Number(t.cm)),v),this.host._physicalSel=null,this._commitPhysicalGeometry(this.host._t("history.draft_merge"),y),null!=d&&this._offerWallFaces(s,s.length-1,i)}_adoptDraftCms(t,e,s){const i=Math.max(0,t.length-1),o=Ra(i,e,this.host._drawWallCm,A);return e.length!==i&&console.debug(`[houseplan] draft ${s??"?"}: восстановлено толщин ${i-e.length} (#234)`),o}_draftSegmentsForPath(t,e,s){const i=Array.isArray(e?.points)?e.points.map(t=>[Number(t?.[0])*ol,Number(t?.[1])*ol]):[],o=Array.isArray(e?.segments)?e.segments:[];return Ra(Math.max(0,t.length-1),s,this.host._drawWallCm,A).map((e,s)=>{const a=t[s],n=t[s+1],r=i.findIndex((t,e)=>{if(e+1>=i.length)return!1;const s=i[e+1];return this._samePt(a,t)&&this._samePt(n,s)||this._samePt(a,s)&&this._samePt(n,t)});return{...r>=0?o[r]:{},cm:e}})}_persistActiveDraftSegment(){if(this.host._path.length<2||!this.host._curSpaceCfg)return;const t=this._geometrySnapshot(),e=this.host._curSpaceCfg;e.room_drafts||=[],this.host._activeDraftId||(this.host._activeDraftId="draft-"+Date.now().toString(36)),this.host._resumeDraftBySpace[this.host._space]=this.host._activeDraftId;const s=e.room_drafts.findIndex(t=>t.id===this.host._activeDraftId),i={...s>=0?e.room_drafts[s]:{},id:this.host._activeDraftId,points:this.host._path.map(t=>[t[0]/ol,t[1]/ol]),segments:this._draftSegmentsForPath(this.host._path,s>=0?e.room_drafts[s]:null,this.host._draftSegmentCms)};s>=0?e.room_drafts[s]=i:e.room_drafts.push(i),this._commitPhysicalGeometry(this.host._t("history.draft_segment"),t)}_activeWallSourceKey(t){return`active:${this.host._activeDraftId||"session"}:${t}`}_wallGraphSources(t){const e=this._planStructuralGeometrySnapshot().value.segments.map(t=>({a:t.a,b:t.b,key:`static:${t.key}`}));for(let s=0;s+1<t.length;s++)e.push({a:t[s],b:t[s+1],key:this._activeWallSourceKey(s)});return e}_wallFaceGraph(t,e){const s=`${this.host._space}|${e}|${JSON.stringify(t)}`,i=this.host._wallFaceGraphCache.findIndex(t=>t.key===s);if(i>=0){const[t]=this.host._wallFaceGraphCache.splice(i,1);return this.host._wallFaceGraphCache.push(t),t.value}const o=en(t,e);return this.host._wallFaceGraphCache.push({key:s,value:o}),this.host._wallFaceGraphCache.length>4&&this.host._wallFaceGraphCache.shift(),o}_offerWallFaces(t,e=this.host._path.length-2,s){if(this.host._path.length<2||this.host._wallFaceBatch||this.host._roomDialog)return;const i=this.host._spaceModel();if(!i)return;const o=this._activeWallSourceKey(e),a=2e-4*this.host._gridPitch;let n,r;try{const e=s||this._wallGraphSources(t);r=this._wallGraphSources(this.host._path),n=function(t,e,s){const i=new Set(t.faces.map(t=>t.key));return e.faces.filter(t=>!i.has(t.key)&&t.sourceKeys.includes(s))}(this._wallFaceGraph(e,a),this._wallFaceGraph(r,a),o)}catch{return}if(!n.length){const t=un(r,{requiredSourceKey:o,maxDistance:j(2,this.host._cellCm,this.host._gridPitch),gridStep:this.host._gridPitch,epsilon:a});return"ambiguous"===t.kind?(this.host._wallRepairDiagnostic=t.proposals[0]||null,void this.host._showToast(this.host._t(0===this.host._drawWallCm?"toast.zero_wall_ambiguous":"toast.wall_repair_ambiguous"))):void("repair"!==t.kind||this._overlapRoom(t.face.ring)||this._beginWallFaceBatch([{...t.face,repair:t.proposal}]))}for(const t of i.rooms){const e=R(t);if(!t.id||!e)continue;const s=Kt(e,this.host._path,.02*this.host._gridPitch);if(!s)continue;const[i,o]=s,a=k(i)>=k(o)?i:o,r=a===i?o:i,l=[...n].sort((t,e)=>Math.abs(t.area-k(r))-Math.abs(e.area-k(r))||t.key.localeCompare(e.key))[0];if(!l)return;return void this._beginWallFaceBatch([{...l,ring:r.map(t=>[t[0],t[1]]),split:{roomId:t.id,mainPoly:a,newPoly:r},consumeAllActive:!0}])}const l=n.filter(t=>!(t.ring.length<3||this._contourSelfIntersects(t.ring))&&!this._overlapRoom(t.ring));l.length&&this._beginWallFaceBatch(l)}_beginWallFaceBatch(t){this.host._wallRepairDiagnostic=null,this.host._wallFaceBatch={candidates:[...t].sort((t,e)=>t.area-e.area||t.key.localeCompare(e.key)),index:0,decisions:[],activePath:this.host._path.map(t=>[...t]),activeCms:[...this.host._draftSegmentCms],activeDraftId:this.host._activeDraftId},this._clearPlanSnapHover(),this.host._nameSel="",this.host._areaSel="",this._resetRoomDialogFields(),this.host._roomDialog=!0}_offerExistingWallFace(t){if(this.host._path.length||this.host._wallFaceBatch||this.host._roomDialog)return!1;const e=2e-4*this.host._gridPitch;try{let s,i=sn(this._wallFaceGraph(this._wallGraphSources([]),e),t,e);if(!i){const o=un(this._wallGraphSources([]),{point:t,maxDistance:j(2,this.host._cellCm,this.host._gridPitch),gridStep:this.host._gridPitch,epsilon:e});if("ambiguous"===o.kind)return this.host._wallRepairDiagnostic=o.proposals[0]||null,this.host._showToast(this.host._t(0===this.host._drawWallCm?"toast.zero_wall_ambiguous":"toast.wall_repair_ambiguous")),!0;if("repair"===o.kind)i=o.face,s=o.proposal;else if("none"===o.kind){const s=un(this._wallGraphSources([]),{point:t,maxDistance:this._cssPxToRender(12),gridStep:this.host._gridPitch,epsilon:e});if("repair"===s.kind)return this.host._wallRepairDiagnostic=s.proposal,this.host._showToast(this.host._t("toast.wall_repair_too_large")),!0}}return!(!i||i.ring.length<3||this._contourSelfIntersects(i.ring)||this._overlapRoom(i.ring))&&(this._beginWallFaceBatch([{...i,existing:!s,repair:s}]),!0)}catch{return!1}}_columnClick(t){const e=this._snap(t),s=this.host._drawWallCm;if(null==s)return void this._showPhysicalRange(yt,1);if(!this.host._curSpaceCfg||this._limitReached("column"))return;const i=this.host._spaceModel();if(!i)return;const o={id:"column-"+Date.now().toString(36),shape:"square",center:e,cm:wt(s),angle:0},a=(i.wall_columns||[]).find(t=>vt(t,o,.02*this.host._gridPitch));if(a)return clearTimeout(this.host._duplicateColumnTimer),this.host._duplicateColumnId=a.id,this.host._duplicateColumnTimer=window.setTimeout(()=>{this.host._duplicateColumnId=null},900),void this.host._showToast(this.host._t("toast.column_duplicate"));const n=this._geometrySnapshot(),r=this.host._curSpaceCfg;r.wall_columns||=[],r.wall_columns.push({...o,center:[e[0]/ol,e[1]/ol]}),this._commitPhysicalGeometry(this.host._t("history.column_add"),n)}_openPhysicalDialog(t,e,s){const i=this.host._spaceModel();if(i)if("partition"===t){const s=i.partitions.find(t=>t.id===e);s&&(this.host._physicalDialog={kind:t,id:e,cm:Tt(s.cm,this.host._imperial),length:this.host._fmtLen(s.a,s.b)})}else if("column"===t){const s=i.wall_columns.find(t=>t.id===e);s&&(this.host._physicalDialog={kind:t,id:e,cm:Tt(s.cm,this.host._imperial),shape:s.shape,angle:this.host._angleField("square"===s.shape?At(s.angle):0)})}else{const o=i.room_drafts.find(t=>t.id===e),a=Math.max(0,Math.min(o?.segments.length?o.segments.length-1:0,s||0));o?.segments[a]&&(this.host._physicalDialog={kind:t,id:e,segment:a,cm:Tt(o.segments[a].cm,this.host._imperial),length:this.host._fmtLen(o.points[a],o.points[a+1])})}}_physicalDown(t,e,s){const i=this.host._spaceModel();if(!i)return;t.stopPropagation(),nl(t);const o=this._svgPoint(t),a=[];for(const t of[...i.wall_columns].reverse())Vt(o,Jt(t,this.host._cellCm,this.host._gridPitch))&&a.push({kind:"column",id:t.id});for(const t of[...i.partitions].reverse()){const e=Yt(t.a,t.b,t.cm,this.host._cellCm,this.host._gridPitch);e&&Vt(o,e)&&a.push({kind:"partition",id:t.id})}a.some(t=>t.kind===e&&t.id===s)||a.unshift({kind:e,id:s});const n=a.map(t=>`${t.kind}:${t.id}`).sort().join("|"),r=performance.now(),l=this.host._physicalPickCycle,h=a.length>1&&l?.signature===n&&r-l.at>380&&r-l.at<=1200&&Math.hypot(t.clientX-l.x,t.clientY-l.y)<=10?(l.index+1)%a.length:Math.max(0,a.findIndex(t=>t.kind===e&&t.id===s));this.host._physicalPickCycle={signature:n,index:h,x:t.clientX,y:t.clientY,at:r},e=a[h].kind,s=a[h].id;const c="partition"===e?i.partitions.find(t=>t.id===s):i.wall_columns.find(t=>t.id===s);c&&(this.host._physicalSel={kind:e,id:s},this.host._physicalDrag={pid:t.pointerId,kind:e,id:s,start:this._svgPoint(t),startClient:[t.clientX,t.clientY],before:this._geometrySnapshot(),moved:!1,base:JSON.parse(JSON.stringify(c)),delta:[0,0]})}_clampPhysicalDelta(t,e,s){const i="partition"===t?[e.a,e.b]:[e.center],o=i.map(t=>t[0]),a=i.map(t=>t[1]);return[Math.max(-Xt*ol-Math.min(...o),Math.min(Xt*ol-Math.max(...o),s[0])),Math.max(-Xt*ol-Math.min(...a),Math.min(Xt*ol-Math.max(...a),s[1]))]}_physicalMove(t){const e=this.host._physicalDrag;if(!e||e.pid!==t.pointerId)return;t.stopPropagation();const s=this._svgPoint(t),i="partition"===e.kind?e.base.a:e.base.center,o=this._snap([i[0]+s[0]-e.start[0],i[1]+s[1]-e.start[1]]),a=this._clampPhysicalDelta(e.kind,e.base,[o[0]-i[0],o[1]-i[1]]);this.host._physicalDrag={...e,delta:a,moved:e.moved||Math.hypot(t.clientX-e.startClient[0],t.clientY-e.startClient[1])>=5}}_physicalUp(t){const e=this.host._physicalDrag;if(!e||e.pid!==t.pointerId)return;if(t.stopPropagation(),this.host._physicalDrag=null,!e.moved)return void this._registerPhysicalTap(e.kind,e.id);const s=this.host._spaceModel();if(!this.host._curSpaceCfg||!s)return;const i=this.host._curSpaceCfg;if("partition"===e.kind){const t=(i.partitions||[]).find(t=>t.id===e.id),s=e.base;if(t){const o={...s,a:[s.a[0]+e.delta[0],s.a[1]+e.delta[1]],b:[s.b[0]+e.delta[0],s.b[1]+e.delta[1]]};t.a=[o.a[0]/ol,o.a[1]/ol],t.b=[o.b[0]/ol,o.b[1]/ol];for(const t of i.openings||[]){if("partition"!==t.host?.kind||t.host.id!==e.id)continue;const s=F(t,[o],ol,this.host._cellCm,this.host._gridPitch).resolved;s&&Object.assign(t,N(t,s,ol))}}}else{const t=(i.wall_columns||[]).find(t=>t.id===e.id),o=e.base,a={...o,center:[o.center[0]+e.delta[0],o.center[1]+e.delta[1]]};if(s.wall_columns.some(t=>t.id!==e.id&&vt(t,a,.02*this.host._gridPitch)))return void this.host._showToast(this.host._t("toast.column_duplicate"));t&&(t.center=[(o.center[0]+e.delta[0])/ol,(o.center[1]+e.delta[1])/ol])}this._commitPhysicalGeometry(this.host._t("history.physical_move"),e.before)}_registerPhysicalTap(t,e,s){const i=performance.now(),o=this.host._physicalLastTap?.kind===t&&this.host._physicalLastTap.id===e&&this.host._physicalLastTap.segment===s&&i-this.host._physicalLastTap.at<=360;this.host._physicalLastTap={kind:t,id:e,segment:s,at:i},o&&(this.host._physicalLastTap=null,this._openPhysicalDialog(t,e,s))}_cancelPhysicalGesture(){this.host._physicalDrag=null,this.host._physicalRotate=null,this.host.requestUpdate()}_physicalRotateDown(t,e){if("square"!==e.shape||!this.host._spaceModel())return;t.preventDefault(),t.stopPropagation(),nl(t);const s=this._svgPoint(t);this.host._physicalSel={kind:"column",id:e.id},this.host._physicalRotate={pid:t.pointerId,id:e.id,center:[...e.center],startAngle:180*Math.atan2(s[1]-e.center[1],s[0]-e.center[0])/Math.PI,baseAngle:At(e.angle),angle:At(e.angle),before:this._geometrySnapshot(),moved:!1}}_physicalRotateMove(t){const e=this.host._physicalRotate;if(!e||e.pid!==t.pointerId)return;t.preventDefault(),t.stopPropagation();const s=this._svgPoint(t),i=180*Math.atan2(s[1]-e.center[1],s[0]-e.center[0])/Math.PI,o=e.baseAngle+i-e.startAngle,a=At(t.shiftKey?o:5*Math.round(o/5));this.host._physicalRotate={...e,angle:a,moved:e.moved||Math.abs(o-e.baseAngle)>=.5}}_physicalRotateUp(t){const e=this.host._physicalRotate;if(!e||e.pid!==t.pointerId)return;t.preventDefault(),t.stopPropagation(),this.host._physicalRotate=null;const s=this.host._spaceModel();if(!e.moved||!this.host._curSpaceCfg||!s)return;const i=s.wall_columns.find(t=>t.id===e.id);if(!i||"square"!==i.shape)return;const o={...i,angle:e.angle};if(s.wall_columns.some(t=>t.id!==e.id&&vt(t,o,.02*this.host._gridPitch)))return void this.host._showToast(this.host._t("toast.column_duplicate"));const a=this.host._curSpaceCfg.wall_columns?.find(t=>t.id===e.id);a&&(a.angle=e.angle,this._commitPhysicalGeometry(this.host._t("history.physical_edit"),e.before))}_rszRooms(){const t=[],e=this.host._spaceModel();if(!e)return t;for(const s of e.rooms){const e=s.id?R(s):null;e&&t.push({id:s.id,poly:e,wall_ids:Array.isArray(s.wall_ids)?[...s.wall_ids]:void 0})}return s=t,i=Math.max(1e-12,1e-12*this.host._gridPitch),s.map(t=>{if(!Array.isArray(t.wall_ids)||t.wall_ids.length!==t.poly.length)return{...t,poly:t.poly.map(t=>[...t])};const e=t.poly.map(t=>[...t]);let s=!0;for(;s&&e.length>3;){s=!1;for(let t=0;t<e.length;t++){const o=e[(t-1+e.length)%e.length],a=e[t],n=e[(t+1)%e.length],r=lo(a,o),l=lo(n,a),h=po(r),c=po(l);if(h<=i||c<=i)continue;const d=Math.abs(r[0]*l[1]-r[1]*l[0]),p=r[0]*l[0]+r[1]*l[1];if(d<=i*(h+c)&&p>0){e.splice(t,1),s=!0;break}}}return{...t,poly:e}});var s,i}_rszOpenings(){return this.host._openingsR.map(t=>({id:t.id,x:t.rx,y:t.ry,length:t.rlen,hosted:!!t.host,angle:t.angle,type:t.type}))}_rszObstacles(){const t=this.host._spaceModel();if(!t)return[];const e=[];for(const s of t.partitions||[])e.push({kind:"segment",a:[...s.a],b:[...s.b],half:j(s.cm,this.host._cellCm,this.host._gridPitch)/2});for(const s of t.room_drafts||[])for(let t=0;t+1<s.points.length;t++)e.push({kind:"segment",a:[...s.points[t]],b:[...s.points[t+1]],half:j(Number.isFinite(Number(s.segments?.[t]?.cm))?Number(s.segments[t].cm):A,this.host._cellCm,this.host._gridPitch)/2});for(const s of t.wall_columns||[]){const t=j(s.cm,this.host._cellCm,this.host._gridPitch)/2;e.push({kind:"circle",center:[...s.center],radius:"square"===s.shape?t*Math.SQRT2:t})}return e}_rszOptsFor(t,e){const s=Q(this.host._spaceWalls,t,e,this.host._wallKeyPitch,ol),i=this.host._spaceWalls.filter(t=>Array.isArray(t.a)&&Array.isArray(t.b)&&t.a.length>=2&&t.b.length>=2).map(t=>({wall:t,a:[t.a[0]*ol,t.a[1]*this.host._spaceH],b:[t.b[0]*ol,t.b[1]*this.host._spaceH]})),o=Math.abs(t[0]-e[0])<=.05*this.host._gridPitch?"v":Math.abs(t[1]-e[1])<=.05*this.host._gridPitch?"h":null,a=i.filter(s=>!!o&&("h"===o?!(Math.abs(s.a[1]-t[1])>.05*this.host._gridPitch||Math.abs(s.b[1]-t[1])>.05*this.host._gridPitch)&&Math.min(Math.max(t[0],e[0]),Math.max(s.a[0],s.b[0]))-Math.max(Math.min(t[0],e[0]),Math.min(s.a[0],s.b[0]))>.05*this.host._gridPitch:!(Math.abs(s.a[0]-t[0])>.05*this.host._gridPitch||Math.abs(s.b[0]-t[0])>.05*this.host._gridPitch)&&Math.min(Math.max(t[1],e[1]),Math.max(s.a[1],s.b[1]))-Math.max(Math.min(t[1],e[1]),Math.min(s.a[1],s.b[1]))>.05*this.host._gridPitch)),n=new Set(a.map(t=>Number(t.wall.cm)).filter(t=>t>0));return{minDim:this.host._cmToUnits(30),eps:.05*this.host._gridPitch,step:this.host._gridPitch,movingHalf:s>0?j(s,this.host._cellCm,this.host._gridPitch)/2:0,obstacles:this._rszObstacles(),thicknessConflict:n.size>1}}_rszResolution(t,e,s){const i=this.host._resize.snapshotIdentity||s||this._rszSnapshot(),o=`${this.host._space}|${this.host._cellCm}|${this.host._gridPitch}|${i}`,a=`${t}:${e}`;return this.host._resize.resolve(o,a,()=>{const s=[...this.host._resize.rooms||this._rszRooms()],i=s.find(e=>e.id===t),o=i?.poly?.[e]||[0,0],a=i?.poly?.[(e+1)%(i?.poly?.length||1)]||[0,0];return function(t,e,s,i,o){const{eps:a}=o,n=t.find(t=>t.id===s);if(!n||i<0||i>=(n.poly?.length||0)||n.poly.length<4||!go(n.poly))return{enabled:!1,reason:"invalid-geometry"};const r=n.poly[i],l=n.poly[(i+1)%n.poly.length],h=vo(r,l,a);if(!h)return{enabled:!1,reason:"diagonal"};if(!xo(n.poly,i,h,a))return{enabled:!1,reason:"side-angle"};if(o.thicknessConflict)return{enabled:!1,reason:"thickness-conflict"};for(const t of o.obstacles||[])if(Do(t,r,l,o))return{enabled:!1,reason:"duplicate-physical-wall"};const c=po(lo(l,r)),d=[],p=new Set;let _=!1,u=!1;for(const e of t)if(e.id!==s)for(let t=0;t<e.poly.length;t++){const s=e.poly[t],i=e.poly[(t+1)%e.poly.length],o=ko(r,l,s,i,a);o<=a||(p.add(e.id),wo(r,l,s,i,a)?d.push({room:e,edge:t}):o<c-a?_=!0:u=!0)}if(_)return{enabled:!1,reason:"partial-shared"};if(u)return{enabled:!1,reason:"unequal-shared"};if(p.size>1||d.length>1)return{enabled:!1,reason:"multiple-rooms"};const m={[s]:i},g=[s];if(1===d.length){const t=d[0];if(!go(t.room.poly))return{enabled:!1,reason:"invalid-geometry"};if(!xo(t.room.poly,t.edge,h,a))return{enabled:!1,reason:"side-angle"};g.push(t.room.id),m[t.room.id]=t.edge}const f=[];for(const t of e)if(!(uo([t.x,t.y],r,l)>2*a)){if(t.hosted||t.length>c+2*a)return{enabled:!1,reason:"opening-conflict"};f.push(t.id)}const b=Object.fromEntries(g.map(e=>[e,t.find(t=>t.id===e).poly.length])),y=[];for(const e of g){const s=t.find(t=>t.id===e),i=m[e],o=(i-1+s.poly.length)%s.poly.length,n=(i+1)%s.poly.length,r=Io(t,e,o,1,a),l=Io(t,e,n,0,a);if(!r||!l)return{enabled:!1,reason:"partial-shared"};y.push(r,l)}const v={roomId:s,edge:i,a:[...r],b:[...l],n:mo(n.poly,i),roomIds:g,edgeByRoom:m,topology:b,movingOpeningIds:f,sideOwnership:y};if(!Oo(t,e,v,0,o))return{enabled:!1,reason:"invalid-geometry"};const $=Math.abs(Number(o.step));if(Number.isFinite($)&&$>a){const s=[-$,$];if(!s.some(s=>Oo(t,e,v,s,o))){if(!s.some(s=>Fo(No(t,e,v,s),v,a)))return{enabled:!1,reason:"partial-shared"};const i={...o,obstacles:[]};return s.some(s=>Oo(t,e,v,s,i))?{enabled:!1,reason:"duplicate-physical-wall"}:e.length&&s.some(e=>Oo(t,[],v,e,o))?{enabled:!1,reason:"opening-conflict"}:{enabled:!1,reason:"invalid-geometry"}}}return{enabled:!0,plan:v}}(s,[...this.host._resize.openings||this._rszOpenings()],t,e,this._rszOptsFor(o,a))})}_rszSnapshot(){return JSON.stringify(this._geometrySnapshot()||{spaceId:this.host._space,rooms:[],openings:[],walls:[],open_spans:[]})}_rszResetController(){const t=null!==this.host._resize.preview;this.host._resize.reset(),t&&this.host._cfgEpoch++}_rszProjectPreview(t,e,s,i,o){this.host._rszLimitViolation=null;const a=this.host._serverCfg?.spaces.find(t=>t.id===this.host._space);if(!a||!this.host._serverCfg)return{ok:!1,reason:"missing-context"};const n=JSON.parse(t),r={...a,rooms:n.rooms,openings:n.openings||[]};for(const t of["walls","wall_segments","open_spans","room_drafts","partitions","wall_columns","decor"])void 0!==n[t]?r[t]=n[t]:delete r[t];for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])void 0!==n.plan_transform?.[t]?r[t]=n.plan_transform[t]:delete r[t];const l=this.host._spaceH;for(const[t,s]of Object.entries(e)){const e=r.rooms.find(e=>e.id===t);e&&(e.poly=s.map(t=>[t[0]/ol,t[1]/l]),delete e.x,delete e.y,delete e.w,delete e.h)}for(const[t,e]of Object.entries(s)){const s=(r.openings||[]).find(e=>e.id===t);s&&(s.x=e[0]/ol,s.y=e[1]/l)}const h=[],c=[];for(const t of i){const e=o.find(e=>e.id===t),s=r.rooms.find(e=>e.id===t);if(!e||!s?.poly)continue;const i=s.poly.map(t=>[t[0]*ol,t[1]*l]);if(e.poly.length!==i.length)continue;const a=Array.isArray(e.wall_ids)?e.wall_ids:[];for(let t=0;t<e.poly.length;t++){h.push([e.poly[t],e.poly[(t+1)%e.poly.length]]),c.push([i[t],i[(t+1)%i.length]]);const s=a[t],o="string"==typeof s?(r.wall_segments||[]).find(t=>t.id===s):null;o&&(o.a=[i[t][0]/ol,i[t][1]/ol],o.b=[i[(t+1)%i.length][0]/ol,i[(t+1)%i.length][1]/ol])}}if(h.length&&Array.isArray(r.walls)&&r.walls.length){const t=Zt(r.walls,h,c,this.host._wallKeyPitch,ol,"fixed-topology");if(t.rejected)return{ok:!1,reason:"wall-metadata"};r.walls=t.walls}const d=[];for(const t of r.rooms||[]){const e=R(t);if(e&&!(e.length<2))for(let t=0;t<e.length;t++)d.push([[e[t][0]*ol,e[t][1]*ol],[e[(t+1)%e.length][0]*ol,e[(t+1)%e.length][1]*ol]])}const p=t=>JSON.stringify([t?.key,t?.cm,t?.a,t?.b]),_=new Map;for(const t of n.walls||[]){const e=p(t);_.set(e,(_.get(e)||0)+1)}const u=[];for(const t of r.walls||[]){const e=p(t),s=_.get(e)||0;s?_.set(e,s-1):u.push(t)}if(Qt(u,d,this.host._wallKeyPitch,ol,n.walls||[]).length)return{ok:!1,reason:"wall-metadata"};const m=this._rszSpaceCandidateGeometry(this.host._space,r);if(!m.ok)return{ok:!1,reason:"physical-geometry"};const g={...this.host._serverCfg,spaces:(this.host._serverCfg?.spaces||[]).map(t=>t?.id===this.host._space?r:t)},f=this._junctionLimitsIntroduced(g,this.host._serverCfg,this.host._space,m.wallGeometry);return f.length?(this.host._rszLimitViolation=f[0],{ok:!1,reason:"junction-limit"}):{ok:!0,value:{preview:{space:this.host._space,sp:r},beforeWalls:n.walls||[],afterWalls:r.walls||[],artifact:m.wallGeometry}}}_rszAcceptPreview(t,e){if(this.host._cfgEpoch++,!t||!e)return;const s=te(e);if(!s)return;const i=`${this.host._space}|${this.host._cfgEpoch}|${t.sp.rooms.length}`;Object.defineProperty(s,"sourceFingerprint",{value:Et([t.sp,this.host._cellCm,this.host._gridPitch]),enumerable:!1});const o={key:i,value:s};il(this.host._wallUnionPool,i,o,8),this.host._wallUnionCache=o}_rszSpaceCandidateGeometry(t,e){if(!this.host._serverCfg)return{ok:!1,wallGeometry:null};const s={...this.host._serverCfg,spaces:this.host._serverCfg.spaces.map(s=>s.id===t?e:s)};let i=null;try{return{ok:this._checkSpacePhysicalGeometry(s,t,t=>{i=t}).ok,wallGeometry:i}}catch{return{ok:!1,wallGeometry:null}}}_rszSpaceCandidateRenderable(t,e){if(!this.host._serverCfg)return!1;try{const s={...this.host._serverCfg,spaces:this.host._serverCfg.spaces.map(s=>s.id===t?e:s)};return this._checkSpacePhysicalGeometry(s,t).ok}catch{return!1}}_rszCandidateRenderable(t){return!!t&&t.space===this.host._space&&this._rszSpaceCandidateRenderable(t.space,t.sp)}_rszEdgeDown(t,e,s){if("resize"!==this.host._tool||this.host._resize.dragging)return;t.stopPropagation(),t.preventDefault();const i=this._rszRooms(),o=this._rszResolution(e,s);if(!o.enabled)return void this.host._showToast(this._rszReasonText(o.reason));nl(t);const a=o.plan,n=this._svgPoint(t),r=`${this.host._space}|${this.host._cfgEpoch}|${i.length}`,l=this.host._wallUnionCache?.key===r?this.host._wallUnionCache.value:null,h=this._rszSnapshot();this.host._resize.begin({pointerId:t.pointerId,start:[n[0],n[1]],roomId:e,plan:a,options:this._rszOptsFor(a.a,a.b),rooms:i,openings:this._rszOpenings(),snapshotIdentity:h,before:JSON.parse(h),wallUnionBefore:l})}_rszReasonText(t){return this.host._t(`resize.disabled.${t}`)}_rszDisabledActivate(t,e){t.stopPropagation(),t.preventDefault(),this.host._showToast(this._rszReasonText(e))}_rszDisabledKey(t,e){"Enter"!==t.key&&" "!==t.key||this._rszDisabledActivate(t,e)}_rszMove(t){if(!this.host._resize.ownsPointer(t.pointerId))return;t.stopPropagation();const e=this._svgPoint(t),s=this.host._resize.move({pointerId:t.pointerId,point:[e[0],e[1]],step:this.host._gridPitch,snap:t=>{const e=this._snap(t);return[e[0],e[1]]},project:(t,e,s,i,o)=>this._rszProjectPreview(t,e,s,i,o),publish:(t,e)=>this._rszAcceptPreview(t,e),measure:(t,e)=>this._rszEdgeLabels(t,e)});if("rejected"===s.kind)return s.notify&&this.host._showToast(this.host._rszLimitViolation?`${this.host._t("resize.limit_stopped")} — `+this._junctionLimitLabel(this.host._rszLimitViolation):this.host._t("resize.preview_failed")),void this.host.requestUpdate();"accepted"===s.kind&&this.host.requestUpdate()}_rszUp(t){if(!this.host._resize.ownsPointer(t.pointerId))return;t.stopPropagation();const e=this.host._resize.finish({pointerId:t.pointerId,currentSnapshotIdentity:this._rszSnapshot(),validatePreview:t=>this._rszCandidateRenderable(t)});if("no-op"===e.kind)return this.host._cfgEpoch++,void this.host.requestUpdate();if("rejected"===e.kind)return this.host._cfgEpoch++,this.host._showToast(this.host._t("resize.commit_failed")),void this.host.requestUpdate();const s=e.preview,i=this.host._serverCfg?.spaces.find(t=>t.id===s.space);i&&(i.rooms=s.sp.rooms,i.openings=s.sp.openings,Array.isArray(s.sp.walls)&&(s.sp.walls.length?i.walls=s.sp.walls:delete i.walls),Array.isArray(s.sp.wall_segments)&&(i.wall_segments=s.sp.wall_segments)),this.host._suppressClick=!0,setTimeout(()=>this.host._suppressClick=!1,0),this._commitPhysicalGeometry(this.host._t("history.resize_room"),e.before),this.host.requestUpdate()}_rszCancelDrag(t){const e=this.host._resize.cancel(this._rszSnapshot(),t);if("no-op"!==e.kind){if(this.host._cfgEpoch++,e.restoreWallUnion){const t=this.host._spaceModel();if(t){const s=`${this.host._space}|${this.host._cfgEpoch}|${t.rooms.length}`,i={key:s,value:e.restoreWallUnion};il(this.host._wallUnionPool,s,i,8),this.host._wallUnionCache=i}}this.host.requestUpdate()}}_rszPointerCancel(t){this.host._resize.ownsPointer(t.pointerId)&&(t.stopPropagation(),this._rszCancelDrag(t.pointerId))}_rszEdgeLabels(t,e,s=this.host._resize.rooms){const i=s,o=[],a=t.polys[e.roomId]||i?.find(t=>t.id===e.roomId).poly;if(!a||!i)return o;const n=a.length,r=this._rszInnerSpanCms(e.roomId,a,t.polys);for(const t of function(t,e){const s=t.length;return[(e-1+s)%s,(e+1)%s]}(a,e.edge)){const e=a[t],s=a[(t+1)%n],i=r?.[t];o.push({kind:"length",x:(e[0]+s[0])/2,y:(e[1]+s[1])/2,text:null==i?this.host._fmtLen(e,s):ee(i,"mi"===this.host.hass?.config?.unit_system?.length),edge:{a:[e[0],e[1]],b:[s[0],s[1]]}})}const l="mi"===this.host.hass?.config?.unit_system?.length,h=e.roomIds,c=this.host._spaceWalls,d=this.host._physicalBodiesR(),p=this.host._baseVb(),_=this.host._view&&this.host._view.w>0&&this.host._view.h>0?this.host._view:{x:p[0],y:p[1],w:p[2],h:p[3]},[u,m]=this.host._lastValidStageSize||[_.w,_.h],g={..._,stageWidth:Math.max(1,u),stageHeight:Math.max(1,m)},f=this.host._spaceModel(),b=this.host._config?.icon_size??2.5,y=f?se(b>8?2.5:b,f,_.w,this.host._kiosk?this.host._kioskScale.icon:1)*g.stageWidth/100:24,v=Math.max(10,.77*y),$=this.host._t("room.settings_short"),w=v*(1.457+.66*Math.max(1,$.length)*.42);for(const s of h){const a=t.polys[s]||i.find(t=>t.id===s).poly,n=c.length&&f&&this.host._innerRoomContour(f,s)||a,r=d.length?ie(oe(n,d))*Math.pow(this.host._cellCm/this.host._gridPitch,2)/1e4:ae(n,this.host._gridPitch,this.host._cellCm),h=ne(r,l),p=qo({poly:a,edge:e.edgeByRoom[s],text:h,view:g,gearCenter:re(a),gearWidthPx:w,gearHeightPx:v});o.push({kind:"area",roomId:s,x:p.anchor[0],y:p.anchor[1],text:h,placement:p})}return o}_rszInnerSpanCms(t,e,s){const i=Object.keys(s).length?Object.entries(s).map(([t,e])=>({id:t,poly:e})):this.host._spaceModel()?.rooms;if(!i?.length)return null;const o=this.host._spaceWalls;if(!o.length)return null;const a=this.host._openCuts(),n=le(i,t,o,a,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol);if(!n||n.length!==e.length)return null;const r=this.host._cellCm/this.host._gridPitch;return e.map((t,s)=>he(e,s,n)*r)}_renderResizeMeasurements(){const t=this.host._resize.liveLabels;if(!t?.length)return a;const e=t.filter(t=>"length"===t.kind),s=t.filter(t=>"area"===t.kind);return ce`<g class="rszmeasurelayer" aria-hidden="true" pointer-events="none">
      ${e.map((t,e)=>ce`<g class="rszmeasuredge"
          data-hp="resize-measured-edge" data-edge-index=${e}>
        <line class="rszmeasurehalo" x1=${t.edge.a[0]} y1=${t.edge.a[1]}
          x2=${t.edge.b[0]} y2=${t.edge.b[1]}></line>
        <line class="rszmeasureink" x1=${t.edge.a[0]} y1=${t.edge.a[1]}
          x2=${t.edge.b[0]} y2=${t.edge.b[1]}></line>
      </g>`)}
      ${s.map(t=>ce`<line class="rszleader" data-hp="resize-area-leader"
        data-room=${t.roomId}
        x1=${t.placement.leader.a[0]} y1=${t.placement.leader.a[1]}
        x2=${t.placement.leader.b[0]} y2=${t.placement.leader.b[1]}></line>`)}
    </g>`}_renderResizeLayer(t){const e=Math.max(.013*t.w,5),s=e/2,i=t=>t.toFixed(1),o=`M ${i(-.7*s)} 0 H ${i(.7*s)} M 0 ${i(-.22*s)} V ${i(-s)} M ${i(-.32*s)} ${i(-.6*s)} L 0 ${i(-s)} L ${i(.32*s)} ${i(-.6*s)} M 0 ${i(.22*s)} V ${i(s)} M ${i(-.32*s)} ${i(.6*s)} L 0 ${i(s)} L ${i(.32*s)} ${i(.6*s)}`,a=[],n=this._rszRooms(),r=this.host._resize.snapshotIdentity||this._rszSnapshot();for(const t of n)for(let s=0;s<t.poly.length;s++){const n=t.poly[s],l=t.poly[(s+1)%t.poly.length];if(Math.hypot(l[0]-n[0],l[1]-n[1])<this.host._gridPitch)continue;const h=i((n[0]+l[0])/2),c=i((n[1]+l[1])/2),d=i(180*Math.atan2(l[1]-n[1],l[0]-n[0])/Math.PI),p=this._rszResolution(t.id,s,r),_=!p.enabled,u=_?this._rszReasonText(p.reason):this.host._t("title.markup_resize");a.push(ce`<circle class="rszhandle ${_?"disabled":""}"
          cx="${h}" cy="${c}" r="${i(e)}" tabindex="0" role="button"
          aria-disabled="${_?"true":"false"}" aria-label="${u}"
          @pointerdown=${e=>this._rszEdgeDown(e,t.id,s)}
          @pointermove=${t=>this._rszMove(t)}
          @pointerup=${t=>this._rszUp(t)}
          @pointercancel=${t=>this._rszPointerCancel(t)}
          @lostpointercapture=${t=>this._rszPointerCancel(t)}
          @click=${_?t=>this._rszDisabledActivate(t,p.reason):null}
          @keydown=${_?t=>this._rszDisabledKey(t,p.reason):null}>
          <title>${u}</title>
        </circle>`),a.push(ce`<g class="rszicon ${_?"disabled":""}" transform="translate(${h} ${c}) rotate(${d})"><path class="rszhalo" d="${o}"></path><path class="rszink" d="${o}"></path></g>`)}return ce`${a}`}_partitionOpeningCuts(t=this.host._spaceModel(),e=()=>!0){if(!t)return[];const s=this.host._curSpaceCfg?.id===t.id?this.host._curSpaceCfg:null,i=de(s,t,this.host._cellCm,this.host._gridPitch,ol);return pe(i,e)}_decorSnapGeometry(t){const e=this.host._spaceModel();if(!e)return{points:[],segments:[]};const s=t||"",i=this.host._decorSnapCache;if(i&&i.epoch===this.host._cfgEpoch&&i.space===this.host._space&&i.height===this.host._decorH&&i.exclude===s)return i.geometry;const o=[];for(const e of this.host._decorList)if(e.id!==t)if("line"===e.kind){const t=[e.x1*ol,e.y1*this.host._decorH],s=[e.x2*ol,e.y2*this.host._decorH];o.push({points:[t,s,[(t[0]+s[0])/2,(t[1]+s[1])/2]],segments:[{a:t,b:s}]})}else if("text"===e.kind)o.push({points:[[e.x*ol,e.y*this.host._decorH]],segments:[]});else{const t=this.host._decorBoxOf(e);t&&o.push(_e(t))}for(const t of e.rooms){const e=R(t);e?.length&&o.push({points:e.flatMap((t,s)=>{const i=e[(s+1)%e.length];return[t,[(t[0]+i[0])/2,(t[1]+i[1])/2]]}),segments:e.map((t,s)=>({a:t,b:e[(s+1)%e.length]}))})}const a=ue(o);return this.host._decorSnapCache={epoch:this.host._cfgEpoch,space:this.host._space,height:this.host._decorH,exclude:s,geometry:a},a}_decorSnap(t,e="mouse",s){const i=this.host._stageEl,o=this.host._viewOr(this.host._baseVb()),a="touch"===e||"pen"===e?14:8,n=i?o.w/Math.max(1,i.clientWidth)*a:this.host._gridPitch;return me(t,this._decorSnapGeometry(s),n,t=>this._snap(t)).point}_replaceDecor(t,e){const s=this.host._curSpaceCfg;s&&(s.decor=this.host._decorList.map(s=>s.id===t?{...s,...e}:s),this.host.requestUpdate())}_cancelDecorGesture(){const t=this.host._decorMove?.before||this.host._dtDrag?.before||this.host._bdDrag?.before,e=t&&this.host._serverCfg?.spaces.find(e=>e.id===t.spaceId);if(t&&e){const s=t=>JSON.parse(JSON.stringify(t));void 0!==t.decor?e.decor=s(t.decor):delete e.decor;for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])delete e[t];Object.assign(e,s(t.plan_transform||{})),this.host._cfgEpoch++}this.host._decorMove=null,this.host._dtDrag=null,this.host._bdDrag=null,this.host.requestUpdate()}_decorPointerDown(t){const e=this.host._decorTool;if("select"===e||"erase"===e?t.target.closest?.(".dshape"):null)return!0;if("line"===e||"rect"===e||"ellipse"===e){t.preventDefault();const s=this._decorSnap(this._svgPoint(t),t.pointerType);return this.host._decorDraft={kind:e,a:s,b:s,pid:t.pointerId},nl(t),!0}if("text"===e){const e=this._decorSnap(this._svgPoint(t),t.pointerType);return this.host._decorTextDialog={x:fe(e[0]/ol),y:fe(e[1]/this.host._decorH),text:"",color:this.host._decorStyle.color,opacity:this.host._decorStyle.opacity,angle:"0",sizeCm:ge(ct,this.host._cellCm,this.host._gridPitch)},this.host._decorTextSelection={start:0,end:0},!0}if("furniture"===e)return!!this.host._furnPalette&&(t.preventDefault(),this._furnPlace(this._svgPoint(t),t.shiftKey),!0);if("select"===e&&(this.host._decorSel=null),this.host._bdMovable){const e=this.host._bdRect,s=this._svgPoint(t),i=e.x+e.w/2,o=e.y+e.h/2,a=-be(e.angle)*Math.PI/180,n=s[0]-i,r=s[1]-o,l=[i+n*Math.cos(a)-r*Math.sin(a),o+n*Math.sin(a)+r*Math.cos(a)];if(l[0]>=e.x&&l[0]<=e.x+e.w&&l[1]>=e.y&&l[1]<=e.y+e.h)return t.preventDefault(),this._bdStart(t)}return!1}_decorCommitDraft(){const t=this.host._decorDraft;if(this.host._decorDraft=null,!t)return;const e=.5*this.host._gridPitch;if(!ye(t.kind,t.a,t.b,e))return;const s=ol,i=this.host._decorH,o=this.host._decorStyle,a=this._geometrySnapshot(),n="dc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),r=fe;let l;if("line"===t.kind)l={id:n,kind:"line",x1:r(t.a[0]/s),y1:r(t.a[1]/i),x2:r(t.b[0]/s),y2:r(t.b[1]/i),...ve(o,!1)};else{const e=r(Math.min(t.a[0],t.b[0])/s),a=r(Math.min(t.a[1],t.b[1])/i),h=Math.abs(t.b[0]-t.a[0])/s,c=Math.abs(t.b[1]-t.a[1])/i;l={id:n,kind:t.kind,x:e,y:a,w:h,h:c,...ve(o,!0)}}this.host._curSpaceCfg.decor=[...this.host._decorList,l],this.host._decorSel=n,this._recordGeometry(this.host._t("history.decor_add"),a),this._saveConfig(),this.host.requestUpdate()}_decorShapeDown(t,e){if("decor"!==this.host._mode)return;const s=this.host._decorTool;if("text"===s){if("text"!==e.kind)return;return t.stopPropagation(),t.preventDefault(),void this._decorOpenText(e)}"select"!==s&&"erase"!==s||(t.stopPropagation(),t.preventDefault(),"erase"!==s?(this.host._decorSel=e.id,this.host._decorMove={id:e.id,start:this._svgPoint(t),orig:JSON.parse(JSON.stringify(e)),pid:t.pointerId,moved:!1,before:this._geometrySnapshot()},nl(t)):this.host._decorEraseConfirm={id:e.id,kind:e.kind})}_decorMoveUpdate(t){const e=this.host._decorMove;if("furniture"===e.orig?.kind)return void this._furnMoveUpdate(t);const s=this._svgPoint(t),i=e.orig,o=("line"===i.kind?i.x1:i.x)*ol,a=("line"===i.kind?i.y1:i.y)*this.host._decorH,n=this._decorSnap([o+(s[0]-e.start[0]),a+(s[1]-e.start[1])],t.pointerType,e.id);let r=(n[0]-o)/ol,l=(n[1]-a)/this.host._decorH;const h=e.orig,c="line"===h.kind?Math.min(h.x1,h.x2):h.x,d="line"===h.kind?Math.min(h.y1,h.y2):h.y,p="line"===h.kind?Math.abs(h.x2-h.x1):h.w||0,_="line"===h.kind?Math.abs(h.y2-h.y1):h.h||0,u=Xt;r=Math.max(-u-c,Math.min(u-c-p,r)),l=Math.max(-u-d,Math.min(u-d-_,l)),(r||l)&&(e.moved=!0);this.host._curSpaceCfg.decor=this.host._decorList.map(t=>{if(t.id!==e.id)return t;const s=e.orig;return"line"===t.kind?{...t,x1:s.x1+r,y1:s.y1+l,x2:s.x2+r,y2:s.y2+l}:{...t,x:s.x+r,y:s.y+l}}),this.host.requestUpdate()}_decorShapeDbl(t,e){"decor"===this.host._mode&&"select"===this.host._decorTool&&(t.preventDefault(),t.stopPropagation(),this.host._decorMove=null,this.host._decorSel=e.id,this._openDecorProperties(e))}_openDecorProperties(t){if("decor"!==this.host._mode||"select"!==this.host._decorTool)return;if("text"===t.kind)return void this._decorOpenText(t);if(!["line","rect","ellipse","furniture"].includes(t.kind))return;const e=this.host._decorResolvedStyle(t),s="line"===t.kind?t:null,i=this.host._decorBoxOf(t);this.host._decorShapeDialog={id:t.id,kind:t.kind,color:e.color,opacity:e.opacity,widthCm:e.widthCm,angle:this.host._angleField(be(s?$e([s.x1*ol,s.y1*this.host._decorH],[s.x2*ol,s.y2*this.host._decorH]):t.angle)),...s?{lengthCm:ge(Math.hypot((s.x2-s.x1)*ol,(s.y2-s.y1)*this.host._decorH),this.host._cellCm,this.host._gridPitch),lineStyle:"dashed"===s.line_style?"dashed":"solid"}:{},...i?{sizeWCm:ge(i.w,this.host._cellCm,this.host._gridPitch),sizeHCm:ge(i.h,this.host._cellCm,this.host._gridPitch)}:{},..."furniture"===t.kind?{symbol:t.symbol}:{},..."rect"===t.kind||"ellipse"===t.kind?{fill:e.fill,fillColor:e.fillColor,fillOpacity:e.fillOpacity}:{}}}_decorOpenText(t){if("text"!==t.kind)return;let e=String(t.text??"");const s=[...e.matchAll(/\{([^{}\r\n]+)\}/g)].some(t=>!!pt(t[1])),i=String(t.unit??"").trim(),o="state"===String(t.attr??"").trim().toLowerCase()?null:t.attr,a=s||i?"":_t(t.entity,o),n=!(!String(t.entity??"").trim()||s||a&&!i);if(a&&!n){const t=e.indexOf("{}");e=t>=0?e.slice(0,t)+a+e.slice(t+2):`${e}${e?" ":""}${a}`}this.host._decorTextDialog={id:t.id,x:t.x,y:t.y,text:e,color:l(t.color,this.host._decorStyle.color),opacity:we(t.opacity,this.host._decorStyle.opacity),angle:this.host._angleField(t.angle),sizeCm:this.host._decorTextSizeCm(t),pickerEntity:t.entity||"",preserveLegacy:n||void 0},this.host._decorTextSelection={start:e.length,end:e.length}}_decorRememberTextSelection(t){this.host._decorTextSelection={start:t.selectionStart??t.value.length,end:t.selectionEnd??t.value.length}}_decorInsertLiveVariable(t){const e=this.host._decorTextDialog;if(!e)return;const s=_t(e.pickerEntity,t);if(!s)return;const i=e.text,o=Math.max(0,Math.min(i.length,this.host._decorTextSelection.start)),a=Math.max(o,Math.min(i.length,this.host._decorTextSelection.end));if(i.length-(a-o)+s.length>200)return;const n=i.slice(0,o)+s+i.slice(a),r=o+s.length;this.host._decorTextSelection={start:r,end:r},this.host._decorTextDialog={...e,text:n,preserveLegacy:void 0},this.host.updateComplete.then(()=>{const t=this.host.renderRoot.querySelector("textarea.dtarea");t&&(t.focus(),t.setSelectionRange(r,r))})}_decorSaveText(){const t=this.host._decorTextDialog,e=String(t?.text??"").replace(/\r\n?/g,"\n").trim();if(!t||!e)return void(this.host._decorTextDialog=null);const s=this._geometrySnapshot(),i=this.host._curSpaceCfg,o={color:t.color,opacity:we(t.opacity),size_cm:Number(Math.max(.1,Math.min(tl,t.sizeCm)).toFixed(4)),...be(t.angle)?{angle:be(t.angle)}:{}};if(t.id)i.decor=this.host._decorList.map(s=>{if(s.id!==t.id)return s;if("text"!==s.kind)return s;if(t.preserveLegacy){const{angle:t,size:i,scale:a,...n}=s;return{...n,text:e,...o}}const{entity:i,attr:a,unit:n,...r}=s,{angle:l,size:h,scale:c,...d}=r;return{...d,text:e,...o}});else{const s="dc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);i.decor=[...this.host._decorList,{id:s,kind:"text",x:t.x,y:t.y,text:e,...o}],this.host._decorSel=s}this.host._decorTextDialog=null,this._recordGeometry(this.host._t(t.id?"history.decor_edit":"history.decor_add"),s),this._saveConfig(),this.host.requestUpdate()}_decorSaveShape(){const t=this.host._decorShapeDialog;if(!t)return;const e=this._geometrySnapshot(),s={color:t.color,opacity:we(t.opacity),widthCm:Math.max(.1,Math.min(100,Number(t.widthCm)||.1)),fill:!!t.fill,fillColor:t.fillColor||t.color,fillOpacity:we(t.fillOpacity,.25)};this.host._curSpaceCfg.decor=this.host._decorList.map(e=>{if(e.id!==t.id)return e;const i="rect"===t.kind||"ellipse"===t.kind,o=ve(s,i);if("line"===e.kind){const s=(e.x1+e.x2)/2*ol,i=(e.y1+e.y2)/2*this.host._decorH,a=ke(Math.max(.1,Number(t.lengthCm)||.1),this.host._cellCm,this.host._gridPitch),n=be(t.angle)*Math.PI/180,r=Math.cos(n)*a/2,l=Math.sin(n)*a/2,h=this._snap([s-r,i-l]),c=this._snap([s+r,i+l]),{width:d,line_style:p,..._}=e;return{..._,...o,x1:fe(h[0]/ol),y1:fe(h[1]/this.host._decorH),x2:fe(c[0]/ol),y2:fe(c[1]/this.host._decorH),..."dashed"===t.lineStyle?{line_style:"dashed"}:{}}}if("rect"===e.kind||"ellipse"===e.kind||"furniture"===e.kind){const s=e.w*ol,i=e.h*this.host._decorH,a=Math.max(this.host._gridPitch,Ft(ke(Number(t.sizeWCm),this.host._cellCm,this.host._gridPitch),this.host._gridPitch)),n=Math.max(this.host._gridPitch,Ft(ke(Number(t.sizeHCm),this.host._cellCm,this.host._gridPitch),this.host._gridPitch)),r=e.x*ol+s/2,l=e.y*this.host._decorH+i/2,h=be(t.angle),c=xe({x:r-a/2,y:l-n/2},h,t=>this._snap(t)),{width:d,angle:p,..._}=e;return{..._,...o,x:fe(c[0]/ol),y:fe(c[1]/this.host._decorH),w:a/ol,h:n/this.host._decorH,..."furniture"===e.kind&&t.symbol?{symbol:t.symbol}:{},...h?{angle:h}:{}}}return e}),this.host._decorStyle={...s,fill:"rect"===t.kind||"ellipse"===t.kind?s.fill:this.host._decorStyle.fill,fillColor:"rect"===t.kind||"ellipse"===t.kind?s.fillColor:this.host._decorStyle.fillColor,fillOpacity:"rect"===t.kind||"ellipse"===t.kind?s.fillOpacity:this.host._decorStyle.fillOpacity},this.host._decorShapeDialog=null,this._recordGeometry(this.host._t("history.decor_edit"),e),this._saveConfig(),this.host.requestUpdate()}_dtPivot(t){return"line"===t.kind?[(t.x1+t.x2)/2*ol,(t.y1+t.y2)/2*this.host._decorH]:"furniture"===t.kind||"rect"===t.kind||"ellipse"===t.kind?[(t.x+t.w/2)*ol,(t.y+t.h/2)*this.host._decorH]:[t.x*ol,t.y*this.host._decorH]}_dtApply(t,e){const s=this.host._curSpaceCfg;s&&(s.decor=this.host._decorList.map(s=>{if(s.id!==t)return s;const i={...s};"text"===s.kind&&void 0!==e.textSizeCm&&(delete i.size,delete i.scale);const o={...i};return void 0!==e.textSizeCm&&(o.size_cm=Number(Math.max(.1,Math.min(tl,e.textSizeCm)).toFixed(4))),void 0!==e.angle&&(e.angle?o.angle=Number(e.angle.toFixed(2)):delete o.angle),o}),this.host._cfgEpoch++,this.host.requestUpdate())}_dtStart(t,e,s,i){const o=this.host._dtSel;if(!o)return;t.stopPropagation(),t.preventDefault();const[a,n]=this._dtPivot(o),r=this._svgPoint(t),l=this.host._decorBoxOf(o);this.host._dtDrag={id:o.id,kind:e,pid:t.pointerId,ax:a,ay:n,r0:Math.hypot(r[0]-a,r[1]-n),a0:180*Math.atan2(r[1]-n,r[0]-a)/Math.PI,textSizeCm0:"text"===o.kind?this.host._decorTextSizeCm(o):1,angle0:"line"===o.kind?0:Number(o.angle)||0,sgx:s?.[0],sgy:s?.[1],orig:l||void 0,origShape:JSON.parse(JSON.stringify(o)),before:this._geometrySnapshot(),lineEnd:i,moved:!1},nl(t)}_dtMove(t){const e=this.host._dtDrag;if(!e)return;const s=this._svgPoint(t);if(void 0!==e.lineEnd&&"line"===e.origShape.kind){const i=this._decorSnap(s,t.pointerType,e.id),o=fe(i[0]/ol),a=fe(i[1]/this.host._decorH),n=e.origShape,r=0===e.lineEnd?n.x1:n.x2,l=0===e.lineEnd?n.y1:n.y2;return(Math.abs(o-r)>1e-9||Math.abs(a-l)>1e-9)&&(e.moved=!0),void this._replaceDecor(e.id,0===e.lineEnd?{x1:o,y1:a}:{x2:o,y2:a})}if("scale"===e.kind&&e.orig){const i=Se(e.orig,e.sgx??1,e.sgy??1,s[0],s[1],!t.shiftKey,this.host._gridPitch,this.host._gridPitch),o=Math.abs(i.x-e.orig.x)>1e-6||Math.abs(i.y-e.orig.y)>1e-6||Math.abs(i.w-e.orig.w)>1e-6||Math.abs(i.h-e.orig.h)>1e-6;if(!o&&!e.moved)return;return e.moved||=o,void this._decorApplyBox(e.id,i)}if("scale"===e.kind){const t=Math.hypot(s[0]-e.ax,s[1]-e.ay);if(e.r0<1e-6)return;const i=Math.max(.1,Math.min(tl,e.textSizeCm0*(t/e.r0))),o=Math.abs(i-e.textSizeCm0)>1e-6;if(!o&&!e.moved)return;return e.moved||=o,void this._dtApply(e.id,{textSizeCm:i})}const i=180*Math.atan2(s[1]-e.ay,s[0]-e.ax)/Math.PI;let o=e.angle0+(i-e.a0);t.shiftKey||(o=5*Math.round(o/5)),o=(o%360+360)%360,o>180&&(o-=360);const a=Math.abs(o-e.angle0)>1e-6;(a||e.moved)&&(e.moved||=a,this._dtApply(e.id,{angle:o}))}_dtUp(){const t=this.host._dtDrag;this.host._dtDrag=null,t?.moved&&(this._recordGeometry(this.host._t("history.decor_transform"),t.before),this._saveConfig()),this.host.requestUpdate()}_dtMeasure(){const t=this.host._dtSel;if(!t)return void(this.host._dtBox&&(this.host._dtBox=null,this.host.requestUpdate()));let e;if("line"===t.kind){const s=t.x1*ol,i=t.y1*this.host._decorH,o=t.x2*ol,a=t.y2*this.host._decorH;e={id:t.id,x:Math.min(s,o),y:Math.min(i,a),w:Math.abs(o-s),h:Math.abs(a-i)}}else if("furniture"===t.kind||"rect"===t.kind||"ellipse"===t.kind)e={id:t.id,x:t.x*ol,y:t.y*this.host._decorH,w:t.w*ol,h:t.h*this.host._decorH};else{const s=this.host.renderRoot.querySelector(`text.dtext[data-id="${t.id}"]`);if(!s||"function"!=typeof s.getBBox)return;let i;try{i=s.getBBox()}catch{return}if(!i||!i.width&&!i.height)return;e={id:t.id,x:i.x,y:i.y,w:i.width,h:i.height}}const s=this.host._dtBox;s&&s.id===e.id&&Math.abs(s.x-e.x)<.01&&Math.abs(s.y-e.y)<.01&&Math.abs(s.w-e.w)<.01&&Math.abs(s.h-e.h)<.01||(this.host._dtBox=e,this.host.requestUpdate())}_deleteDecor(t){if(!this.host._decorList.some(e=>e.id===t))return;const e=this._geometrySnapshot();this.host._curSpaceCfg.decor=this.host._decorList.filter(e=>e.id!==t),this.host._decorSel===t&&(this.host._decorSel=null),this._recordGeometry(this.host._t("history.decor_delete"),e),this._saveConfig(),this.host.requestUpdate()}_decorDeleteSel(){this.host._decorSel&&this._deleteDecor(this.host._decorSel)}_confirmDecorErase(){const t=this.host._decorEraseConfirm;this.host._decorEraseConfirm=null,t&&this._deleteDecor(t.id)}_furnFieldValue(t){return Math.round(100*(this.host._imperial?t/30.48:t/100))/100}_furnFieldToCm(t){return Me(this.host._imperial?30.48*t:100*t)}_furnPick(t){const e=De(t);this.host._furnPalette={symbol:t,w:e.w,h:e.h}}_furnPlace(t,e=!1){const s=this.host._furnPalette,i=this.host._curSpaceCfg;if(!s||!i)return;const o=ol,a=this.host._decorH,n=Ce(Pe(s.w,this.host._cellCm,this.host._gridPitch,o)),r=Ce(Pe(s.h,this.host._cellCm,this.host._gridPitch,o)),l=this._geometrySnapshot(),h=this._decorSnap(t);let c=h[0],d=h[1],p=0;const _=e?null:Ie(c,d,r*a,this.host._furnWalls,this.host._furnWallReach,this.host._gridPitch);_&&(c=_.cx,d=_.cy,p=_.angle);const u="df"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),m={id:u,kind:"furniture",symbol:s.symbol,x:fe(c/o-n/2),y:fe(d/a-r/2),w:n,h:r,...ve(this.host._decorStyle,!1)};p&&(m.angle=Number(p.toFixed(2))),i.decor=[...this.host._decorList,m],this.host._decorSel=u,this.host._decorTool="select",this.host._furnPalette=null,this._recordGeometry(this.host._t("history.decor_add"),l),this._saveConfig(),this.host.requestUpdate()}_furnMoveUpdate(t){const e=this.host._decorMove;if("furniture"!==e.orig.kind)return;const s=e.orig,i=this.host._curSpaceCfg;if(!i)return;const o=ol,a=this.host._decorH,n=this._svgPoint(t),r=(s.x+s.w/2)*o+(n[0]-e.start[0]),l=(s.y+s.h/2)*a+(n[1]-e.start[1]);let h,c,d=Number(s.angle)||0;const p=t.shiftKey?null:Ie(r,l,s.h*a,this.host._furnWalls,this.host._furnWallReach,this.host._gridPitch);if(p)h=p.cx/o-s.w/2,c=p.cy/a-s.h/2,d=p.angle;else{const i=this._decorSnap([r-s.w/2*o,l-s.h/2*a],t.pointerType,e.id);h=i[0]/o,c=i[1]/a}h=fe(h),c=fe(c),(Math.abs(h-s.x)>1e-9||Math.abs(c-s.y)>1e-9||Math.abs(d-(Number(s.angle)||0))>1e-9)&&(e.moved=!0),i.decor=this.host._decorList.map(t=>{if(t.id!==e.id)return t;const s={...t,x:h,y:c};return d?s.angle=Number(d.toFixed(2)):delete s.angle,s}),this.host.requestUpdate()}_decorApplyBox(t,e){const s=this.host._curSpaceCfg;if(!s)return;const i=ol,o=this.host._decorH;s.decor=this.host._decorList.map(s=>{if(s.id!==t)return s;const a=xe(e,s.angle,t=>this._snap(t));return{...s,x:fe(a[0]/i),y:fe(a[1]/o),w:Math.max(this.host._gridPitch/i,Math.min(2*Xt,e.w/i)),h:Math.max(this.host._gridPitch/o,Math.min(2*Xt,e.h/o))}}),this.host._cfgEpoch++,this.host.requestUpdate()}_renderFurnPalette(){const t=this.host._furnPalette,e=this.host._t(this.host._imperial?"gs.unit_ft":"gs.unit_m");return o`<div class="furnpalette" @pointerdown=${t=>t.stopPropagation()}>
      <div class="furnhd">
        <ha-icon icon="mdi:sofa-outline"></ha-icon>${this.host._t("furn.title")}
        <span class="spacer"></span>
        <button class="btn furnclose" title=${this.host._t("btn.close")}
          @click=${()=>{this.host._furnPalette=null,this.host._decorTool="select"}}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="furnbody">
        ${Te.map(e=>o`
          <div class="furngroup" data-group=${e}>${this.host._t(`furn.group_${e}`)}</div>
          <div class="furnrow">
            ${Re(e).map(e=>o`<button
              class="furnitem ${t?.symbol===e.id?"on":""}" data-symbol=${e.id}
              title=${this.host._t(`furn.sym_${e.id}`)}
              @click=${()=>this._furnPick(e.id)}>
              ${(t=>{const e=Di(t),s=36/Math.max(e.w,e.h),i=e.w*s,o=e.h*s;return ce`<svg class="furnprev" viewBox="0 0 40 40" aria-hidden="true"><g
        transform="translate(${(40-i)/2} ${(40-o)/2})"><path
        d=${Ci(t,i,o)} fill="none" stroke="currentColor"
        stroke-width="1.2" stroke-linejoin="round"></path></g></svg>`})(e.id)}<span>${this.host._t(`furn.sym_${e.id}`)}</span>
            </button>`)}
          </div>`)}
      </div>
      ${t?o`<div class="furnsize">
        <label>${this.host._t("furn.width")}<span class="furnunit">${e}</span></label>
        <input class="namein furnw" type="number" min="0.01" step="0.05"
          .value=${String(this._furnFieldValue(t.w))}
          @input=${e=>this.host._furnPalette={...t,w:this._furnFieldToCm(Number(e.target.value))}} />
        <label>${this.host._t("furn.depth")}<span class="furnunit">${e}</span></label>
        <input class="namein furnh" type="number" min="0.01" step="0.05"
          .value=${String(this._furnFieldValue(t.h))}
          @input=${e=>this.host._furnPalette={...t,h:this._furnFieldToCm(Number(e.target.value))}} />
        <span class="furnhint">${this.host._t("furn.place_hint")}</span>
      </div>`:o`<div class="furnsize"><span class="furnhint">${this.host._t("furn.pick_hint")}</span></div>`}
    </div>`}_openBackdropDialog(t){if(!this.host._bdMovable||!this.host._bdRect)return;t?.preventDefault(),t?.stopPropagation(),this.host._bdDrag=null;const e=this.host._bdRect;this.host._backdropDialog={widthCm:ge(e.w,this.host._cellCm,this.host._gridPitch),heightCm:ge(e.h,this.host._cellCm,this.host._gridPitch),angle:this.host._angleField(e.angle)}}_saveBackdropDialog(){const t=this.host._backdropDialog,e=this.host._bdBase,s=this.host._bdRect;if(!t||!e||!s)return;const i=be(t.angle),o=this._geometrySnapshot(),a=Math.min(e.w*ht,Math.max(e.w*lt,Ft(ke(t.widthCm,this.host._cellCm,this.host._gridPitch),this.host._gridPitch))),n=Math.min(e.h*ht,Math.max(e.h*lt,Ft(ke(t.heightCm,this.host._cellCm,this.host._gridPitch),this.host._gridPitch))),r=s.x+s.w/2,l=s.y+s.h/2,h=xe({x:r-a/2,y:l-n/2},i,t=>this._snap(t));this._bdApply((h[0]-e.x)/ol,(h[1]-e.y)/ol,a/e.w,n/e.h,i),this.host._backdropDialog=null,this._recordGeometry(this.host._t("history.backdrop_transform"),o),this._saveConfig()}_bdApply(t,e,s,i,o){const a=this.host._curSpaceCfg;if(!a)return;a.plan_x=Number(fe(t).toFixed(6)),a.plan_y=Number(fe(e).toFixed(6)),delete a.plan_scale,a.plan_scale_x=Number(Math.min(ht,Math.max(lt,s)).toFixed(6)),a.plan_scale_y=Number(Math.min(ht,Math.max(lt,i)).toFixed(6));const n=be(o);n?a.plan_angle=Number(n.toFixed(2)):delete a.plan_angle,this.host._cfgEpoch++,this.host.requestUpdate()}_bdStart(t,e,s=!1){const i=this.host._bdBase,o=this.host._bdRect;if(!i||!o)return!1;const a=this._svgPoint(t),n=e?e[0]:0,r=e?e[1]:0,l=n>0?o.x:o.x+o.w,h=r>0?o.y:o.y+o.h;return this.host._bdDrag={kind:s?"rotate":e?"scale":"move",pid:t.pointerId,sx:a[0],sy:a[1],base:i,p0:this.host._bdParams,fx:l,fy:h,sgx:n,sgy:r,rect0:{x:o.x,y:o.y,w:o.w,h:o.h,angle:o.angle},before:this._geometrySnapshot(),moved:!1},nl(t),!0}_bdMove(t){const e=this.host._bdDrag;if(!e)return;const s=this._svgPoint(t),i=e.base;if("move"===e.kind){const t=e.rect0.x,o=e.rect0.y,a=this._snap([t+(s[0]-e.sx),o+(s[1]-e.sy)]),n=Math.abs(a[0]-t)>1e-9||Math.abs(a[1]-o)>1e-9;if(!n&&!e.moved)return;return e.moved||=n,void this._bdApply((a[0]-i.x)/ol,(a[1]-i.y)/ol,e.p0.sx,e.p0.sy,e.p0.angle)}if("rotate"===e.kind){const i=e.rect0.x+e.rect0.w/2,o=e.rect0.y+e.rect0.h/2,a=180*Math.atan2(e.sy-o,e.sx-i)/Math.PI;let n=e.p0.angle+(180*Math.atan2(s[1]-o,s[0]-i)/Math.PI-a);t.shiftKey||(n=5*Math.round(n/5)),n=be(n);const r=Math.abs(n-e.p0.angle)>1e-9;if(!r&&!e.moved)return;return e.moved||=r,void this._bdApply(e.p0.dx,e.p0.dy,e.p0.sx,e.p0.sy,n)}const o=Se(e.rect0,e.sgx,e.sgy,s[0],s[1],!t.shiftKey,this.host._gridPitch,Math.min(i.w,i.h)*lt),a=o.w/Math.max(1e-9,i.w),n=o.h/Math.max(1e-9,i.h),r=Math.abs(a-e.p0.sx)>1e-9||Math.abs(n-e.p0.sy)>1e-9||Math.abs(o.x-e.rect0.x)>1e-9||Math.abs(o.y-e.rect0.y)>1e-9;if(!r&&!e.moved)return;e.moved||=r;const l=xe(o,e.p0.angle,t=>this._snap(t));this._bdApply((l[0]-i.x)/ol,(l[1]-i.y)/ol,a,n,e.p0.angle)}_bdReset(){const t=this.host._curSpaceCfg;if(!t)return;const e=this._geometrySnapshot();delete t.plan_x,delete t.plan_y,delete t.plan_scale,delete t.plan_scale_x,delete t.plan_scale_y,delete t.plan_angle,this.host._bdDrag=null,this._recordGeometry(this.host._t("history.backdrop_transform"),e),this._saveConfig(),this.host._showToast(this.host._t("decor.backdrop_reset_done")),this.host.requestUpdate()}_bdUp(){const t=this.host._bdDrag;this.host._bdDrag=null,t?.moved&&(this._recordGeometry(this.host._t("history.backdrop_transform"),t.before),this._saveConfig()),this.host.requestUpdate()}_renderBackdropFrame(t){const e=this.host._bdRect;if(!this.host._bdActive||!e)return a;const s=.02*Math.max(t.w,t.h),i=s/4,o=e.x+e.w/2,n=e.y+e.h/2,r=be(e.angle),l=2.2*s;return ce`<g class="bdframe" transform=${r?`rotate(${r} ${o} ${n})`:a}>
      <rect class="bdbox" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}"></rect>
      <line class="dtstem" x1="${o}" y1="${e.y}" x2="${o}" y2="${e.y-l}"></line>
      <circle class="bdhandle dtrot" cx="${o}" cy="${e.y-l}" r="${s.toFixed(1)}"
        @pointerdown=${t=>{t.stopPropagation(),t.preventDefault(),this._bdStart(t,void 0,!0)}}></circle>
      <circle class="bdknob" cx="${o}" cy="${e.y-l}" r="${i.toFixed(2)}"></circle>
      ${[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]].map(([t,o,a])=>{const n=t<0?e.x:e.x+e.w,r=o<0?e.y:e.y+e.h;return ce`<circle
          class="bdhandle bd-${a}" data-corner="${t+","+o}"
          cx="${n}" cy="${r}" r="${s.toFixed(1)}"
          @pointerdown=${e=>{e.stopPropagation(),e.preventDefault(),this._bdStart(e,[t,o])}}></circle><circle class="bdknob" cx="${n}" cy="${r}" r="${i.toFixed(2)}"></circle>`})}
    </g>`}_renderEditorGroupLauncher(t){return this.host._editorSecondary.renderGroupLauncher(t,this.host._editorToolbarGroups,this.host._editorSecondaryCopy)}_runEditorContext(t,e){this.host._editorSecondary.runContext(t,this.host._editorSecondaryContextId,e)}_renderEditorGroupModel(t){return this.host._editorSecondary.renderGroupModel(t,this.host._editorSecondaryContextId,this.host._editorSecondaryCopy)}_renderDrawWallControl(){const t="column"===this.host._tool?1:0;return o`<label class="drawwall ${null==this.host._drawWallCm?"invalid":""}">${this.host._t("wallthick.field")}
      <input type="number" min=${Tt(t,this.host._imperial)}
        max=${Tt(this.host._drawWallMaxCm,this.host._imperial)} step="any"
        .value=${this.host._drawWallFieldValue}
        @input=${t=>{this.host._drawWallField=t.target.value}}
        title=${this.host._t("draw"===this.host._tool?"markup.draw_wall_title":"physical.column_size_title")} />
      <span class="opl">${this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span>
      <span class="rangehint">${this.host._t("physical.allowed_range",{min:Tt(t,this.host._imperial),max:Tt(this.host._drawWallMaxCm,this.host._imperial),unit:this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")})}</span>
    </label>`}_renderPlanSecondary(){const t=this.host._editorSecondaryContextId,e=this.host._physicalSel;if(e){if(!("partition"===e.kind?!!this.host._curSpaceCfg.partitions?.some(t=>t.id===e.id):"column"===e.kind?!!this.host._curSpaceCfg.wall_columns?.some(t=>t.id===e.id):!!this.host._curSpaceCfg.room_drafts?.some(t=>t.id===e.id)))return null;const s="partition"===e.kind?this.host._t("markup.partition"):"column"===e.kind?this.host._t("markup.column"):this.host._t("markup.add");return{contextId:t,kind:"selection",ariaLabel:this.host._t("editor.context_actions",{object:s}),visibleLabel:s,content:o`
          <button class="btn ghost" @click=${()=>this._runEditorContext(t,()=>{const t=this.host._physicalSel;t&&this._openPhysicalDialog(t.kind,t.id,t.segment)})}><ha-icon icon="mdi:tune"></ha-icon>${this.host._t("btn.properties")}</button>
          <button class="btn danger" @click=${()=>this._runEditorContext(t,()=>this._deletePhysicalSelection())}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
          </button>`}}const s="draw"===this.host._tool||"column"===this.host._tool,i="column"===this.host._tool?"markup.hint_column":"resize"===this.host._tool?"markup.hint_resize":"wallthick"===this.host._tool?"markup.hint_wallthick":null,n="draw"===this.host._tool?this.host._t(this.host._path.length?"markup.hint_points":"markup.hint_start",this.host._path.length?{n:this.host._path.length}:void 0):"";if(!s&&!i&&!n)return null;const r="draw"===this.host._tool&&this.host._path.length>0;return{contextId:t,kind:r?"operation":"tool",ariaLabel:this.host._t("editor.tool_options",{tool:this.host._t("draw"===this.host._tool?"markup.add":"column"===this.host._tool?"markup.column":"resize"===this.host._tool?"markup.resize":"markup.wallthick")}),content:o`
        ${s?this._renderDrawWallControl():a}
        ${n?o`<span class="hint">${n}</span>`:a}
        ${i?o`<span class="hint">${this.host._t(i)}</span>`:a}
        ${"draw"===this.host._tool&&this.host._path.length?o`<button class="btn ghost" @click=${()=>this._runEditorContext(t,()=>this._cancelPath())}>
              ${this.host._t("btn.reset")}
            </button>`:a}`}}_renderDecorSecondary(){const t=this.host._editorSecondaryContextId;if("furniture"===this.host._decorTool)return{contextId:t,kind:"palette",ariaLabel:this.host._t("editor.palette",{tool:this.host._t("decor.furniture")}),launcherId:"furniture",dismissPolicy:this.host._furnPalette?"stay-open-on-canvas":"outside",dismiss:()=>{"furniture"===this.host._decorTool&&(this.host._furnPalette=null,this.host._decorTool="select",this.host.requestUpdate())},content:this._renderFurnPalette()};const e=this.host._dtSel;if(e){const s=this.host._t(`decor.${e.kind}`);return{contextId:t,kind:"selection",ariaLabel:this.host._t("editor.context_actions",{object:s}),visibleLabel:s,content:o`
          <button class="btn ghost" @click=${()=>this._runEditorContext(t,()=>{const t=this.host._dtSel;t&&this._openDecorProperties(t)})}><ha-icon icon="mdi:tune"></ha-icon>${this.host._t("btn.properties")}</button>
          <button class="btn danger" @click=${()=>this._runEditorContext(t,()=>this._decorDeleteSel())}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
          </button>`}}const s="line"===this.host._decorTool||"rect"===this.host._decorTool||"ellipse"===this.host._decorTool,i="rect"===this.host._decorTool||"ellipse"===this.host._decorTool,n="backdrop"===this.host._decorTool&&!!this.host._bdRect;return s||n?{contextId:t,kind:"tool",ariaLabel:this.host._t("editor.tool_options",{tool:this.host._t(s?`decor.${this.host._decorTool}`:"decor.backdrop")}),content:o`
        ${s?o`
          <hp-color-opacity .label=${this.host._t("decor.color")} .color=${this.host._decorStyle.color}
            .opacity=${this.host._decorStyle.opacity} .opacityLabel=${this.host._t("space.opacity")}
            .pickerLabels=${this.host._colorPickerLabels}
            @hp-color-opacity-change=${t=>this.host._decorStyle={...this.host._decorStyle,...t.detail}}></hp-color-opacity>
          <label class="drawwall">${this.host._t("decor.width")}
            <input type="number" min=${this.host._decorSmallField(.1)}
              max=${this.host._decorSmallField(100)} step="0.1"
              .value=${String(this.host._decorSmallField(this.host._decorStyle.widthCm))}
              @input=${t=>this.host._decorStyle={...this.host._decorStyle,widthCm:this.host._decorSmallCm(Number(t.target.value))}} />
            <span class="opl">${this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span>
          </label>
          ${i?o`<label class="dfill"><input type="checkbox" .checked=${this.host._decorStyle.fill}
              @change=${t=>this.host._decorStyle={...this.host._decorStyle,fill:t.target.checked}} />${this.host._t("decor.fill")}</label>
            <hp-color-opacity .label=${this.host._t("decor.fill_color")} .color=${this.host._decorStyle.fillColor}
              .opacity=${this.host._decorStyle.fillOpacity} .opacityLabel=${this.host._t("space.opacity")}
              .pickerLabels=${this.host._colorPickerLabels}
              .disabled=${!this.host._decorStyle.fill}
              @hp-color-opacity-change=${t=>this.host._decorStyle={...this.host._decorStyle,fillColor:t.detail.color,fillOpacity:t.detail.opacity}}></hp-color-opacity>`:a}
        `:a}
        ${n?o`<span class="bdhint">${this.host._t("decor.backdrop_hint")}</span>`:a}`}:null}_withBackdropReset(t){if(!this.host._bdMoved||this.host._bdDrag||"palette"===t?.kind)return t;const e=this.host._editorSecondaryContextId,s=o`<button class="btn bdreset" title=${this.host._t("decor.backdrop_reset")}
      @click=${()=>this._runEditorContext(e,()=>this._bdReset())}>
      <ha-icon icon="mdi:image-refresh-outline"></ha-icon>${this.host._t("decor.backdrop_reset")}
    </button>`;return t?{...t,kind:"selection"===t.kind?"mixed":t.kind,content:o`${t.content}${s}`}:{contextId:e,kind:"tool",ariaLabel:this.host._t("editor.tool_options",{tool:this.host._t("decor.backdrop")}),content:s}}_renderEditorSecondary(){if(!this.host._editing)return a;const t=this.host._editorSecondary.activeGroup(this.host._editorToolbarGroups),e=t?this._renderEditorGroupModel(t):"plan"===this.host._mode?this._renderPlanSecondary():"decor"===this.host._mode?this._withBackdropReset(this._renderDecorSecondary()):null;return this.host._editorSecondary.render(e,this.host._editorSecondaryDialogBlocked)}_renderDecorBar(){const t=[["select","mdi:cursor-default-outline","decor.select"],...this.host._bdRect?[["backdrop","mdi:image-move","decor.backdrop"]]:[],["line","mdi:vector-line","decor.line"],["rect","mdi:rectangle-outline","decor.rect"],["ellipse","mdi:ellipse-outline","decor.ellipse"],["text","mdi:format-text","decor.text"],["furniture","mdi:sofa-outline","decor.furniture"],["erase","mdi:eraser","decor.erase"]],e=this.host._geometryHistory.undoName,s=this.host._geometryHistory.redoName;return o`<div class="editbar decorbar">
      <div class="editbar-tools" tabindex="-1" ?inert=${this.host._modeTransitionBusy}>
      ${t.map(([t,e,s])=>o`<button class="btn dtool ${this.host._decorTool===t?"on":""}"
          data-editor-palette=${"furniture"===t?"furniture":a}
          @click=${()=>{if("furniture"===t&&"furniture"===this.host._decorTool)return this.host._furnPalette=null,void(this.host._decorTool="select");"furniture"===t&&this.host._editorSecondary.openPalette(),this.host._decorTool=t,this.host._decorDraft=null,"furniture"!==t&&(this.host._furnPalette=null)}}
          title=${this.host._t(s)}>
          <ha-icon icon=${e}></ha-icon><span class="ml">${this.host._t(s)}</span>
        </button>`)}
      ${this.host._editorToolbarGroups.map(t=>this._renderEditorGroupLauncher(t))}
      <button class="btn ghost" @click=${this._undoGeometry} ?disabled=${!e}
        title=${e?this.host._t("history.undo_named",{name:e}):this.host._t("history.undo_empty")}>
        <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t("history.undo")}
      </button>
      <button class="btn ghost" @click=${this._redoGeometry} ?disabled=${!s}
        title=${s?this.host._t("history.redo_named",{name:s}):this.host._t("history.redo_empty")}>
        <ha-icon icon="mdi:redo-variant"></ha-icon>${this.host._t("history.redo")}
      </button>
      </div>
      <div class="editbar-end">
        <button class="btn barclose" title=${this.host._t("title.close_editor")}
          data-editor-navigation="view"
          @click=${()=>this._setMode("view")}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    </div>`}_renderDecorEraseConfirm(){const t=this.host._decorEraseConfirm,e=this.host._t(`decor.${t.kind}`);return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("decor.erase_confirm_title")}
      icon="mdi:eraser" dismiss-on-scrim @hp-close=${()=>this.host._decorEraseConfirm=null}>
        <div class="body"><p>${this.host._t("confirm.erase_decor",{kind:e})}</p></div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this.host._decorEraseConfirm=null}>
            ${this.host._t("btn.cancel")}
          </button>
          <button class="btn danger" @click=${this._confirmDecorErase}>
            <ha-icon icon="mdi:eraser"></ha-icon>${this.host._t("decor.erase")}
          </button>
        </div>
    </hp-dialog>`}_renderDecorTextDialog(){const t=this.host._decorTextDialog,e=(t.pickerEntity||"").trim(),s=e?this.host.hass?.states?.[e]:null;return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("decor.text_title")}
      icon="mdi:format-text" dismiss-on-scrim @hp-close=${()=>this.host._decorTextDialog=null}>
        <div class="body">
          <label>${this.host._t("decor.text_label")}</label>
          ${""}
          <textarea class="namein dtarea" rows="3" maxlength="200" .value=${t.text} autofocus
            @input=${e=>{const s=e.target;this._decorRememberTextSelection(s),this.host._decorTextDialog={...t,text:s.value}}}
            @click=${t=>this._decorRememberTextSelection(t.target)}
            @keyup=${t=>this._decorRememberTextSelection(t.target)}
            @select=${t=>this._decorRememberTextSelection(t.target)}
            @blur=${t=>this._decorRememberTextSelection(t.target)}
            @keydown=${t=>{t.stopPropagation(),"Enter"===t.key&&(t.ctrlKey||t.metaKey)&&this._decorSaveText()}}></textarea>
          <hp-color-opacity .label=${this.host._t("decor.color")} .color=${t.color} .opacity=${t.opacity}
            .opacityLabel=${this.host._t("space.opacity")} .pickerLabels=${this.host._colorPickerLabels}
            @hp-color-opacity-change=${e=>this.host._decorTextDialog={...t,...e.detail}}></hp-color-opacity>
          <label>${this.host._t("decor.text_size")}</label>
          <div class="colorrow"><input class="namein" type="number" min="0.1"
            max=${this.host._decorSmallField(tl)} step="0.1"
            .value=${String(this.host._decorSmallField(t.sizeCm))}
            @input=${e=>this.host._decorTextDialog={...t,sizeCm:this.host._decorTextCm(Number(e.target.value))}} />
            <span class="opl">${this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span></div>
          <label>${this.host._t("decor.angle")}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${t.angle}
            @input=${e=>this.host._decorTextDialog={...t,angle:e.target.value}} />
          <label class="dispsection">${this.host._t("decor.live_group")}</label>
          <label>${this.host._t("decor.live_entity")}</label>
          <input class="namein" type="text" list="hp-dtext-ents" placeholder=${this.host._t("decor.live_entity_ph")}
            .value=${t.pickerEntity||""}
            @input=${e=>this.host._decorTextDialog={...t,pickerEntity:e.target.value}} />
          <datalist id="hp-dtext-ents">
            ${Object.keys(this.host.hass?.states||{}).map(t=>o`<option value=${t}></option>`)}
          </datalist>
          ${e?o`
            <label>${this.host._t("decor.live_attr")}</label>
            <select id="decor-live-attribute" class="namein" .value=${""}
              @change=${t=>{const e=t.target.value;e&&this._decorInsertLiveVariable("__state__"===e?null:e)}}>
              <option value="">${this.host._t("decor.live_attr_ph")}</option>
              <option value="__state__">${this.host._t("decor.live_state")}</option>
              ${Object.keys(s?.attributes||{}).filter(t=>!!_t(e,t)).map(t=>o`<option value=${t}>${t}</option>`)}
            </select>
          `:a}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this.host._decorTextDialog=null}>${this.host._t("btn.cancel")}</button>
          <button class="btn primary" ?disabled=${!t.text.trim()} @click=${()=>this._decorSaveText()}>${this.host._t("btn.save")}</button>
        </div>
    </hp-dialog>`}_renderDecorShapeDialog(){const t=this.host._decorShapeDialog,e="rect"===t.kind||"ellipse"===t.kind,s=this.host._t("decor."+t.kind),i=this.host._t(this.host._imperial?"gs.unit_ft":"gs.unit_m");return o`<hp-dialog .hass=${this.host.hass}
      .title=${this.host._t("decor.object_title",{kind:s})} icon="mdi:pencil-outline"
      dismiss-on-scrim @hp-close=${()=>this.host._decorShapeDialog=null}>
        <div class="body">
          ${"furniture"===t.kind?o`
            <label>${this.host._t("furn.symbol")}</label>
            <select class="namein"
              @change=${e=>this.host._decorShapeDialog={...t,symbol:e.target.value}}>
              ${Te.map(e=>o`<optgroup label=${this.host._t(`furn.group_${e}`)}>
                ${Re(e).map(e=>o`<option value=${e.id}
                  ?selected=${e.id===t.symbol}>
                  ${this.host._t(`furn.sym_${e.id}`)}
                </option>`)}
              </optgroup>`)}
            </select>`:a}
          <hp-color-opacity .label=${this.host._t("decor.color")} .color=${t.color} .opacity=${t.opacity}
            .opacityLabel=${this.host._t("space.opacity")} .pickerLabels=${this.host._colorPickerLabels}
            @hp-color-opacity-change=${e=>this.host._decorShapeDialog={...t,...e.detail}}></hp-color-opacity>
          <label>${this.host._t("decor.width")}</label>
          <div class="colorrow"><input class="namein" type="number"
            min=${this.host._decorSmallField(.1)} max=${this.host._decorSmallField(100)} step="0.1"
            .value=${String(this.host._decorSmallField(t.widthCm))}
            @input=${e=>this.host._decorShapeDialog={...t,widthCm:this.host._decorSmallCm(Number(e.target.value))}} /><span class="opl">${this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span></div>
          ${"line"===t.kind?o`
            <label>${this.host._t("decor.line_style")}</label>
            <div role="radiogroup" aria-label=${this.host._t("decor.line_style")}>
              <label class="srcrow"><input type="radio" name="decor-line-style"
                .checked=${"dashed"!==t.lineStyle}
                @change=${()=>this.host._decorShapeDialog={...t,lineStyle:"solid"}} />
                <span>${this.host._t("decor.line_style_solid")}</span></label>
              <label class="srcrow"><input type="radio" name="decor-line-style"
                .checked=${"dashed"===t.lineStyle}
                @change=${()=>this.host._decorShapeDialog={...t,lineStyle:"dashed"}} />
                <span>${this.host._t("decor.line_style_dashed")}</span></label>
            </div>
            <label>${this.host._t("decor.length")}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this.host._decorLargeField(t.lengthCm||0))}
              @input=${e=>this.host._decorShapeDialog={...t,lengthCm:this.host._decorLargeCm(Number(e.target.value))}} />
              <span class="opl">${i}</span></div>`:o`
            <label>${this.host._t("decor.size")}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this.host._decorLargeField(t.sizeWCm||0))}
              @input=${e=>this.host._decorShapeDialog={...t,sizeWCm:this.host._decorLargeCm(Number(e.target.value))}} />
              <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this.host._decorLargeField(t.sizeHCm||0))}
              @input=${e=>this.host._decorShapeDialog={...t,sizeHCm:this.host._decorLargeCm(Number(e.target.value))}} />
              <span class="opl">${i}</span></div>`}
          <label>${this.host._t("decor.angle")}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${t.angle}
            @input=${e=>this.host._decorShapeDialog={...t,angle:e.target.value}} />
          ${e?o`<label class="dfill"><input type="checkbox" .checked=${!!t.fill}
            @change=${e=>this.host._decorShapeDialog={...t,fill:e.target.checked}} />${this.host._t("decor.fill")}</label>
            <hp-color-opacity .label=${this.host._t("decor.fill_color")}
              .color=${t.fillColor||t.color} .opacity=${t.fillOpacity??.25}
              .opacityLabel=${this.host._t("space.opacity")} .pickerLabels=${this.host._colorPickerLabels}
              .disabled=${!t.fill}
              @hp-color-opacity-change=${e=>this.host._decorShapeDialog={...t,fillColor:e.detail.color,fillOpacity:e.detail.opacity}}></hp-color-opacity>`:a}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this.host._decorShapeDialog=null}>${this.host._t("btn.cancel")}</button>
          <button class="btn primary" @click=${()=>this._decorSaveShape()}>${this.host._t("btn.save")}</button>
        </div>
    </hp-dialog>`}_renderBackdropDialog(){const t=this.host._backdropDialog,e=this.host._t(this.host._imperial?"gs.unit_ft":"gs.unit_m");return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("decor.backdrop_properties")}
      icon="mdi:image-edit-outline" dismiss-on-scrim @hp-close=${()=>this.host._backdropDialog=null}>
      <div class="body">
        <label>${this.host._t("decor.size")}</label>
        <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this.host._decorLargeField(t.widthCm))}
          @input=${e=>this.host._backdropDialog={...t,widthCm:this.host._decorLargeCm(Number(e.target.value))}} />
          <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this.host._decorLargeField(t.heightCm))}
          @input=${e=>this.host._backdropDialog={...t,heightCm:this.host._decorLargeCm(Number(e.target.value))}} />
          <span class="opl">${e}</span></div>
        <label>${this.host._t("decor.angle")}</label>
        <input class="namein" type="number" min="-180" max="180" step="1" .value=${t.angle}
          @input=${e=>this.host._backdropDialog={...t,angle:e.target.value}} />
      </div>
      <div class="row" slot="footer"><span class="spacer"></span>
        <button class="btn ghost" @click=${()=>this.host._backdropDialog=null}>${this.host._t("btn.cancel")}</button>
        <button class="btn primary" @click=${()=>this._saveBackdropDialog()}>${this.host._t("btn.save")}</button>
      </div>
    </hp-dialog>`}_cssPxToRender(t){const e=this.host._stageEl,s=this.host._viewOr(this.host._baseVb());return e?.clientWidth&&e.clientHeight?Math.max(s.w/e.clientWidth,s.h/e.clientHeight)*t:this.host._gridPitch/8*t}_deleteRoomClick(t){const e=this.host._spaceModel();if(!e)return;const s=[...e.rooms].reverse().find(e=>this._pointInRoom(t,e));s?s.id&&(this.host._roomDeleteDialog={roomId:s.id,name:s.name}):this.host._showToast(this.host._t("toast.delete_room_pick"))}_wallThickHit(t){const e=this.host._spaceModel();if(!e)return null;const s=6*this.host._gridPitch,i=this.host._openCuts();let o=null;const a=(t,e,i)=>{e>s||(!o||e<o.d-1e-9||i&&!o.independent&&e<=o.d+1e-9)&&(o={hit:t,d:e,independent:i})};for(const s of z(e.rooms,this.host._spaceWalls,i,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol))a({a:s.a,b:s.b,roomId:s.roomId,segs:[[s.a[0],s.a[1],s.b[0],s.b[1]]],open:s.open,cm:s.cm,source:{kind:"room"}},C(t,[s.a[0],s.a[1],s.b[0],s.b[1]]),!1);for(const s of e.partitions||[]){const e=[s.a[0],s.a[1]],i=[s.b[0],s.b[1]];a({a:e,b:i,roomId:"",segs:[[e[0],e[1],i[0],i[1]]],open:!1,cm:Number(s.cm)||0,source:{kind:"partition",id:s.id}},C(t,[e[0],e[1],i[0],i[1]]),!0)}for(const s of e.room_drafts||[])if(s.id!==this.host._activeDraftId)for(let e=0;e+1<s.points.length;e++){const i=[s.points[e][0],s.points[e][1]],o=[s.points[e+1][0],s.points[e+1][1]],n=Number(s.segments[e]?.cm);a({a:i,b:o,roomId:"",segs:[[i[0],i[1],o[0],o[1]]],open:!1,cm:Number.isFinite(n)?n:15,source:{kind:"draft",id:s.id,segment:e}},C(t,[i[0],i[1],o[0],o[1]]),!0)}return o?o.hit:null}_wallThickClick(t){const e=this._wallThickHit(t);if(!e)return void this.host._showToast(this.host._t("toast.wallthick_pick"));const s=e.cm,i=this.host._viewOr(this.host._baseVb()),o=(e.a[0]+e.b[0])/2,a=(e.a[1]+e.b[1])/2;this.host._wallDialog={a:e.a,b:e.b,value:Tt(s,this.host._imperial),roomId:e.roomId,source:e.source,sx:(o-i.x)/i.w*100,sy:(a-i.y)/i.h*100}}_wallThickApply(t){const e=this.host._wallDialog;if(!e)return;const s=this.host._curSpaceCfg,i=this.host._spaceModel();if(!s||!i)return;const o=e.value.trim(),a=o?sl(o):null;if(null==a)return void this._showPhysicalRange(100);const n=this.host._imperial?2.54*a:a;if(!Number.isFinite(n)||n<0||n>100)return void this._showPhysicalRange(100);if("room"!==e.source.kind){const t=this._geometrySnapshot();if("partition"===e.source.kind){const t=(s.partitions||[]).find(t=>t.id===e.source.id);if(!t)return;if(0===n&&$t(s.openings,{kind:"partition",id:t.id}))return void this.host._showToast(this.host._t("toast.zero_wall_opening_conflict"));t.cm=n}else{const t=(s.room_drafts||[]).find(t=>t.id===e.source.id),i=t?.segments?.[e.source.segment];if(!i)return;i.cm=n}this.host._wallDialog=null;return this._commitPhysicalGeometry(this.host._t("history.wall_thickness"),t)&&this.host._showToast(this.host._t("toast.wallthick_set")),void this.host.requestUpdate()}const r=this._geometrySnapshot(),l=n>0?n:null;if(0===n){const i=.02*this.host._gridPitch,o=[e.a[0],e.a[1],e.b[0],e.b[1]],a=(s.rooms||[]).find(t=>t.id===e.roomId),n=new Set(t&&a&&Array.isArray(a.wall_ids)?a.wall_ids:(s.wall_segments||[]).filter(t=>{const e=[Number(t.a?.[0])*ol,Number(t.a?.[1])*ol],s=[Number(t.b?.[0])*ol,Number(t.b?.[1])*ol];return C(e,o)<=i&&C(s,o)<=i}).map(t=>String(t.id))),r=(s.openings||[]).some(t=>{if("partition"===t.host?.kind)return!1;if("wall"===t.host?.kind&&n.has(t.host.id))return!0;if(t.host)return!1;const e=[Number(t.x)*ol,Number(t.y)*ol];return e.every(Number.isFinite)&&C(e,o)<=i});if(r)return void this.host._showToast(this.host._t("toast.zero_wall_opening_conflict"))}let h,c=this.host._openCuts();if(n>0&&c.length){const o=[];if(t&&e.roomId){const t=(s.rooms||[]).find(t=>t.id===e.roomId),a=new Set(Array.isArray(t?.wall_ids)?t.wall_ids:[]);for(const t of s.wall_segments||[])a.has(t.id)&&o.push([Number(t.a?.[0])*ol,Number(t.a?.[1])*ol,Number(t.b?.[0])*ol,Number(t.b?.[1])*ol]);if(!o.length){const t=i.rooms.find(t=>t.id===e.roomId),s=t?R(t):null;for(let t=0;s&&t<s.length;t++){const e=s[t],i=s[(t+1)%s.length];o.push([e[0],e[1],i[0],i[1]])}}}else o.push([e.a[0],e.a[1],e.b[0],e.b[1]]);const a=.02*this.host._gridPitch;c=c.filter(t=>!o.some(e=>C([t[0],t[1]],e)<=a&&C([t[2],t[3]],e)<=a&&C([e[0],e[1]],t)<=a&&C([e[2],e[3]],t)<=a))}h=t&&e.roomId?Fe(s.walls,i.rooms,e.roomId,l,this.host._wallKeyPitch,c,ol):E(s.walls,e.a,e.b,l,this.host._wallKeyPitch,ol),h=this.host._normalizeWalls(h,c);for(const t of s.wall_segments||[])t.cm=Q(h,t.a,t.b,I,1);h.length?s.walls=h:delete s.walls,this.host._wallDialog=null,this._commitPhysicalGeometry(this.host._t("history.wall_thickness"),r)&&this.host._showToast(this.host._t(0===n?"toast.wallthick_cleared":"toast.wallthick_set")),this.host.requestUpdate()}_wallHatchDefs(t){if(!this.host._spaceWalls.length&&!this.host._physicalBodiesR().length&&!this.host._markup)return ce``;const e=Ne(this.host._cellCm);return ce`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
        width="${e}" height="${e}" patternTransform="rotate(45)">
        <path d="M0 0 L0 ${e}" stroke="${t||"#607d8b"}" stroke-width="${e/Pi*2}"></path>
      </pattern>
    </defs>`}_renderWallThickUi(){const t=this.host._wallThickHover;return t&&t.d?ce`<path class="wallthick-hover ${t.open?"isopen":""}"
      d="${t.d}"></path>`:ce``}_renderWallThickDialog(){const t=this.host._wallDialog;return t?o`<div class="wallthick-dlg" style="left:${t.sx.toFixed(2)}%;top:${t.sy.toFixed(2)}%"
      @click=${t=>t.stopPropagation()}>
      <div class="row">
        <label>${this.host._t("wallthick.field")}</label>
        <input type="number" min="0" max="100" step="any" .value=${t.value}
          @input=${e=>{this.host._wallDialog={...t,value:e.target.value}}}
          @keydown=${t=>{"Enter"===t.key&&(t.preventDefault(),this._wallThickApply(!1))}} />
        <span class="opl">${this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span>
      </div>
      <div class="row">
        ${"room"===t.source.kind?o`<button class="btn ghost"
          @click=${()=>this._wallThickApply(!0)}>
          ${this.host._t("wallthick.apply_room")}
        </button>`:a}
        <span class="spacer"></span>
        <button class="btn on" @click=${()=>this._wallThickApply(!1)}>
          <ha-icon icon="mdi:check"></ha-icon>
        </button>
      </div>
    </div>`:o``}_openingAt(t){if(!this.host._openingsR.length)return null;const e=this.host._openingsR.flatMap(e=>{const s=e.angle*Math.PI/180,i=t[0]-e.rx,o=t[1]-e.ry,a=i*Math.cos(s)+o*Math.sin(s);return Math.abs(a)>e.rlen/2+ze(12,this.host._cellCm)?[]:[{o:e,localY:-i*Math.sin(s)+o*Math.cos(s)}]});if(!e.length)return null;const s=this.host._spaceModel();if(!s)return null;const i=this.host._openCuts(),o=this.host._openingWallIndexFor(s,i).value;return e.find(({o:t,localY:e})=>{const s="gate"===t.type?!t.flip_v:t.flip_v,i=t.partitionHost||this.host._spaceWalls.length||"gate"===t.type?this.host._openingFace(t,o,!!s):{ox:0,oy:0,cm:0,side:-1},a=Ae({type:t.type,length:t.rlen,angle:t.angle,amount:this.host._openingAmt(t),flipH:!!t.flip_h,flipV:!!t.flip_v,cellCm:this.host._cellCm,gridPitch:this.host._gridPitch,face:i});return Math.abs(e)<=a.hitHalf})?.o||null}_resolveOpeningPlacement(t){const e=this.host._openingPreset;if("opening"!==this.host._tool||!e)return null;const s=this.host._spaceModel();if(!s)return null;const i=this.host._openCuts(),o=this.host._openingWallIndexFor(s,i),a=`${o.key}|partitions:${this.host._cfgEpoch}`;this.host._openingPlacementIntervalsCache&&this.host._openingPlacementIntervalsCache.key===a||(this.host._openingPlacementIntervalsCache={key:a,value:[...z(s.rooms,this.host._spaceWalls,i,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol),...Oe(s.partitions,this.host._cellCm,this.host._gridPitch)]}),this.host._openingDimensionContextCache&&this.host._openingDimensionContextCache.key===a||(this.host._openingDimensionContextCache={key:a,value:Wr({rooms:s.rooms,walls:this.host._spaceWalls,openCuts:i,partitions:s.partitions,roomOpenings:this.host._roomWallOpeningInputs(),partitionCuts:this._partitionOpeningCuts(s),pitch:this.host._wallKeyPitch,cellCm:this.host._cellCm,gridPitch:this.host._gridPitch,coordScale:ol,epsilon:2e-4*this.host._gridPitch})});const n=Le({pointer:[t[0],t[1]],preset:e,geometryRevision:this.host._cfgEpoch,renderedLength:this.host._cmToUnits(e.lengthCm),intervals:this.host._openingPlacementIntervalsCache.value,baseTolerance:1.5*this.host._gridPitch,bodyPointerPadding:this._cssPxToRender("touch"===this.host._pointerModality.modality||"pen"===this.host._pointerModality.modality?10:6),gridStep:this.host._gridPitch});this.host._openingJambBlockCm=n.jambBlockedTarget?n.jambBlockedTarget.physicalHalfWidth/this.host._gridPitch*this.host._cellCm:null;const r=n.candidate;if(!r)return null;const l="gate"===r.type?!r.flipV:r.flipV;let h;if(r.host){const t=F({id:"preview",type:r.type,x:r.x/ol,y:r.y/ol,angle:r.angle,length:r.renderedLength/ol,host:r.host},s.partitions,ol,this.host._cellCm,this.host._gridPitch).resolved;h=t?Ee(t,l):{ox:0,oy:0,cm:0,side:-1}}else h=Be(o.value,{x:r.x,y:r.y,angle:r.angle,length:r.renderedLength,flip_v:l});const c="mi"===this.host.hass?.config?.unit_system?.length,d=Yr(r,this.host._openingDimensionContextCache.value).map(t=>({x:t.label[0],y:t.label[1],text:ee(t.distance/this.host._gridPitch*this.host._cellCm,c),dimension:t}));return{...r,face:h,measure:{labels:d,guide:r.measure.guide}}}_activateOpeningPlacement(t){this._activateMarkupTool("opening"),"opening"===this.host._tool&&(this.host._openingPreset=He(t,++this.host._openingPresetRevision),this.host._openingHoverCandidate=null,this.host._cursorPt=null)}_clearOpeningPlacement(t){this.host._openingHoverCandidate=null,this.host._openingJambBlockCm=null,t&&(this.host._openingPreset=null,this.host._openingRebindId=null)}_openingClick(t){const e=this.host._spaceModel();if(!e)return;const s=this.host._openingRebindId?null:this._openingAt(t);if(s)return void this._editOpening(s);const i=this.host._openingPreset;if(!i)return;const o=this.host._openingHoverCandidate,a=o&&Ge(o,[t[0],t[1]],i.revision,this.host._cfgEpoch)?o:this._resolveOpeningPlacement(t);if(!a){if(null!=this.host._openingJambBlockCm)return void this.host._showToast(this.host._t("opening.partition_jamb_margin",{distance:ee(this.host._openingJambBlockCm,this.host._imperial)}));const s=1.5*this.host._gridPitch,i=P(t,e.rooms,s);return i&&We(i.x,i.y,i.angle,this.host._openCuts(),s)?void this.host._showToast(this.host._t("toast.opening_on_zero_wall")):void this.host._showToast(this.host._t("toast.opening_no_wall"))}const n=this.host._openingRebindId?this.host._curSpaceCfg?.openings?.find(t=>t.id===this.host._openingRebindId):null;this.host._openingDialog={...n?{id:n.id,type:n.type,lengthCm:Math.round(n.length*ol/this.host._gridPitch*this.host._cellCm),lengthTouched:!1,contact:n.contact||"",lock:n.lock||"",invert:!!n.invert,flipH:!!n.flip_h,flipV:!!n.flip_v}:{type:a.type,lengthCm:a.lengthCm,contact:"",lock:"",invert:!1,flipH:a.flipH,flipV:a.flipV},...a.host?{host:a.host}:{},x:a.x,y:a.y,angle:a.angle},this.host._openingRebindId=null,this.host._openingHoverCandidate=null,this.host._cursorPt=null}_editOpening(t){this.host._openingDialog={id:t.id,type:t.type,lengthCm:Math.round(t.rlen/this.host._gridPitch*this.host._cellCm),lengthTouched:!1,contact:t.contact||"",lock:t.lock||"",invert:!!t.invert,flipH:!!t.flip_h,flipV:!!t.flip_v,..."partition"===t.host?.kind?{host:{...t.host}}:{},x:t.rx,y:t.ry,angle:t.angle}}_opPointerDown(t,e){if("plan"===this.host._mode&&this.host._spaceModel()&&"resize"!==this.host._tool){t.preventDefault(),t.stopPropagation();try{nl(t)}catch{}this.host._opDrag={id:e.id,moved:!1,sx:t.clientX,sy:t.clientY,dirty:!1,before:this._geometrySnapshot()}}}_opPointerMove(t,e){if(!this.host._opDrag||this.host._opDrag.id!==e.id)return;if(Math.abs(t.clientX-this.host._opDrag.sx)+Math.abs(t.clientY-this.host._opDrag.sy)<=3)return;const s=this.host._spaceModel();if(!s)return;const i=this._svgPoint(t),o=this.host._curSpaceCfg,a=o?.openings?.find(t=>t.id===e.id);if(!a)return;if("partition"===a.host?.kind){const t=s.partitions.find(t=>t.id===a.host.id);if(!t)return;const e=t.b[0]-t.a[0],o=t.b[1]-t.a[1],n=Math.hypot(e,o);if(!(n>1e-9))return;const r=e/n,l=o/n;if(Math.abs((i[0]-t.a[0])*l-(i[1]-t.a[1])*r)>4*this.host._gridPitch)return;const h=a.length*ol/2+L(t,this.host._cellCm,this.host._gridPitch);let c=(i[0]-t.a[0])*r+(i[1]-t.a[1])*l;if(c=Math.round(c/this.host._gridPitch)*this.host._gridPitch,c=Math.max(h,Math.min(n-h,c)),n<2*h-1e-9)return;const d=c/n,p=(t.a[0]+r*c)/ol,_=(t.a[1]+l*c)/this.host._spaceH;let u=180*Math.atan2(o,e)/Math.PI;u>=90?u-=180:u<-90&&(u+=180);const m=a.host.t!==d||a.x!==p||a.y!==_||a.angle!==u;return this.host._opDrag.moved=!0,m&&(this.host._opDrag.dirty=!0),a.host={...a.host,t:d},a.x=p,a.y=_,a.angle=u,this.host._opMeasure=null,m&&this.host._cfgEpoch++,void this.host.requestUpdate()}const n=P(i,s.rooms,4*this.host._gridPitch);if(!n)return;this.host._opDrag.moved=!0;const r=this._opRuler(n,a.length*ol);this.host._opMeasure=r.measure;const l=r.x/ol,h=r.y/this.host._spaceH,c=a.x!==l||a.y!==h||a.angle!==n.angle;if(c&&(this.host._opDrag.dirty=!0),a.x=l,a.y=h,a.angle=n.angle,Number(this.host._serverCfg?.model_version||0)>=9){const t=kr(a,o?.wall_segments||[]);t?a.host=t:delete a.host}c&&this.host._cfgEpoch++,this.host.requestUpdate()}_opRuler(t,e){const s=this.host._spaceModel()?.rooms||[],i=this.host._gridPitch/2;let o=t.x,a=t.y,n=je([o,a],t.angle,e,s,i);if(n&&n.centered&&(o!==n.wallCenter[0]||a!==n.wallCenter[1]))[o,a]=n.wallCenter,n=je([o,a],t.angle,e,s,i);else if(n){const[r,l]=n.wallA,[h,c]=n.wallB,d=h-r,p=c-l,_=Math.hypot(d,p);if(_>0){const h=this.host._gridPitch,c=Math.min(e/2,_/2);let u=Math.round(((o-r)*d+(a-l)*p)/_/h)*h;u=Math.max(c,Math.min(_-c,u)),o=r+u/_*d,a=l+u/_*p,n=je([o,a],t.angle,e,s,i)||n}}if(!n)return{x:o,y:a,angle:t.angle,measure:null};const r="mi"===this.host.hass?.config?.unit_system?.length,l=(t,e)=>({x:e[0],y:e[1],text:ee(t/this.host._gridPitch*this.host._cellCm,r)});return{x:o,y:a,angle:t.angle,measure:{labels:[l(n.sideA,n.midA),l(n.sideB,n.midB)],guide:n.centered?{x:n.wallCenter[0],y:n.wallCenter[1],angle:t.angle}:null}}}_opPointerUp(t,e){if(!this.host._opDrag||this.host._opDrag.id!==e.id)return;const s=this.host._opDrag,i=s.moved;this.host._opMeasure=null,i&&s.dirty&&this._commitPhysicalGeometry(this.host._t("history.move_opening"),s.before),i?window.setTimeout(()=>this.host._opDrag=null,0):this.host._opDrag=null}_opClick(t,e){"plan"===this.host._mode&&"resize"===this.host._tool||(t.stopPropagation(),this.host._opDrag?.moved||"plan"===this.host._mode&&this._editOpening(e))}_saveOpening(){const t=this.host._openingDialog,e=this.host._curSpaceCfg,s=this.host._spaceModel();if(!t||!e||!s)return;const i=this._geometrySnapshot(),o=this.host._spaceH,a=(e.openings||[]).find(e=>e.id===t.id),n={...a||{},id:t.id||"o"+Date.now().toString(36),type:t.type,x:t.x/ol,y:t.y/o,angle:t.angle,length:a&&!t.lengthTouched?a.length:this.host._cmToUnits(Math.max(20,t.lengthCm))/ol,...t.host?{host:{...t.host}}:{}};if("partition"===n.host?.kind){const t=qe(a,n)?H(n,s.partitions,ol,this.host._cellCm,this.host._gridPitch):F(n,s.partitions,ol,this.host._cellCm,this.host._gridPitch);if(!t.resolved){const e=s.partitions.find(t=>t.id===n.host.id);if("does-not-fit-jamb"===t.reason&&e){const t=L(e,this.host._cellCm,this.host._gridPitch);this.host._showToast(this.host._t("opening.partition_jamb_margin",{distance:ee(t/this.host._gridPitch*this.host._cellCm,this.host._imperial)}))}else this.host._showToast(this.host._t("opening.partition_orphan"));return}const i=(e.openings||[]).flatMap(t=>{if(!t.host||t.id===n.id)return[];const e=F(t,s.partitions,ol,this.host._cellCm,this.host._gridPitch).resolved;return e?[e]:[]});if(Ue(t.resolved,i))return void this.host._showToast(this.host._t("toast.opening_no_wall"));Object.assign(n,N(n,t.resolved,ol))}else if(Number(this.host._serverCfg?.model_version||0)>=9){const t=kr(n,e.wall_segments||[]);if(!t)return void this.host._showToast(this.host._t("toast.opening_no_wall"));n.host=t}else delete n.host;"passage"===t.type?(delete n.contact,delete n.lock,delete n.invert,delete n.flip_h,delete n.flip_v):(n.contact=t.contact||null,n.lock=("door"===t.type||"gate"===t.type)&&t.lock||null,n.invert=t.invert||void 0,n.flip_h="gate"!==t.type&&t.flipH||void 0,n.flip_v=t.flipV||void 0),e.openings=e.openings||[];const r=e.openings.findIndex(t=>t.id===n.id);r>=0?e.openings[r]=n:e.openings.push(n),this._commitPhysicalGeometry(this.host._t(t.id?"history.edit_opening":"history.add_opening"),i),this.host._openingDialog=null,this.host.requestUpdate()}_deleteOpening(){const t=this.host._openingDialog,e=this.host._curSpaceCfg;if(!t?.id||!e?.openings)return;const s=this._geometrySnapshot();e.openings=e.openings.filter(e=>e.id!==t.id),this._commitPhysicalGeometry(this.host._t("history.delete_opening"),s),this.host._openingDialog=null,this.host.requestUpdate()}_contactCandidates(){const t=[];for(const e of Object.keys(this.host.hass.states)){if(!this.host._openingEntityAvailable(e))continue;const s=e.split(".")[0];if("binary_sensor"!==s&&"cover"!==s)continue;const i=this.host.hass.states[e],o=["door","window","opening","garage_door","garage"].includes(i?.attributes?.device_class||"");("cover"!==s||o)&&t.push([e,i?.attributes?.friendly_name||e,o?0:1])}return t.sort((t,e)=>t[2]-e[2]||t[1].localeCompare(e[1])).map(([t,e])=>({value:t,label:e}))}_lockCandidates(){return Object.keys(this.host.hass.states).filter(t=>t.startsWith("lock.")&&this.host._openingEntityAvailable(t)).map(t=>({value:t,label:this.host.hass.states[t]?.attributes?.friendly_name||t})).sort((t,e)=>t.label.localeCompare(e.label))}_toggleOpeningEntityPicker(t){const e=this.host._openingDialog;if(!e)return;const s="contact"===t?!e.contactOpen:!e.lockOpen;this.host._openingDialog={...e,contactOpen:"contact"===t&&s,lockOpen:"lock"===t&&s}}_filterOpeningEntities(t,e){const s=this.host._openingDialog;s&&(this.host._openingDialog="contact"===t?{...s,contactFilter:e}:{...s,lockFilter:e})}_selectOpeningEntity(t,e){const s=this.host._openingDialog;s&&(this.host._openingDialog="contact"===t?{...s,contact:e,contactOpen:!1,contactFilter:""}:{...s,lock:e,lockOpen:!1,lockFilter:""})}_mergeClick(t){const e=this.host._spaceModel();if(!e)return;const s=e.rooms,i=[...s].reverse().find(e=>this._pointInRoom(t,e));if(!i?.id)return;const o=i.id;if(!this.host._mergeSel||this.host._mergeSel===o)return void(this.host._mergeSel=this.host._mergeSel===o?null:o);const a=s.find(t=>t.id===this.host._mergeSel),n=a?R(a):null,r=R(i),l=n&&r?Ke(n,r):null;if(!l)return this.host._showToast(this.host._t("toast.merge_not_adjacent")),void(this.host._mergeSel=null);this.host._mergeDialog={aId:this.host._mergeSel,bId:o,poly:l,pick:"a"},this.host._mergeSel=null}_commitMerge(){const t=this.host._mergeDialog,e=this.host._curSpaceCfg;if(!t||!e||!this.host._spaceModel())return;const s=this._geometrySnapshot(),i=this.host._spaceH,o="a"===t.pick?t.aId:t.bId,a="a"===t.pick?t.bId:t.aId,n=e.rooms.find(t=>t.id===o);if(!n)return void(this.host._mergeDialog=null);n.poly=t.poly.map(t=>[t[0]/ol,t[1]/i]),delete n.x,delete n.y,delete n.w,delete n.h,e.rooms=e.rooms.filter(t=>t.id!==a);const r=this._commitPhysicalGeometry(this.host._t("history.merge_rooms"),s);this.host._mergeDialog=null,this.host._regSignature="",this.host._maybeRebuildDevices(),r&&this.host._showToast(this.host._t("toast.rooms_merged",{name:n.name||""}))}_splitClick(t){const e=this.host._spaceModel();if(!e)return;const s=e.rooms;if(!this.host._splitSel){const e=[...s].reverse().find(e=>this._pointInRoom(t,e));if(!e?.id)return;return void(this.host._splitSel={roomId:e.id,pts:[]})}const i=s.find(t=>t.id===this.host._splitSel.roomId),o=i?R(i):null;if(!i||!o)return void(this.host._splitSel=null);const a=.02*this.host._gridPitch,n=6*this.host._gridPitch,r=Ve(t,o),l=r&&Je(r,o,this.host._gridPitch)||r,h=r&&l&&Math.hypot(r[0]-t[0],r[1]-t[1])<=n?l:null,c=!!h&&Ye(h,o,a),d=this.host._splitSel.pts;if(!d.length)return c?void(this.host._splitSel={...this.host._splitSel,pts:[h]}):void this.host._showToast(this.host._t("toast.split_pick_wall"));if(!c){const e=this._snap(t);return qt(e,o,a)?void(this.host._splitSel={...this.host._splitSel,pts:[...d,e]}):void this.host._showToast(this.host._t("toast.split_pick_inside"))}const p=Kt(o,[...d,h],a);if(!p)return void this.host._showToast(this.host._t("toast.split_bad_cut"));this._resetRoomDialogFields();const[_,u]=p,m=k(_)>=k(u)?_:u,g=m===_?u:_;this.host._pendingSplit={roomId:i.id,mainPoly:m,newPoly:g},this.host._cursorPt=null,this.host._nameSel="",this.host._areaSel="",this.host._roomDialog=!0}_markupMove(t){if(!this.host._markup)return;if("column"===this.host._tool)return void(this.host._cursorPt=this._snap(this._svgPoint(t)));if("opening"===this.host._tool||"wallthick"===this.host._tool)return void(this.host._cursorPt=this._svgPoint(t));const e="draw"===this.host._tool&&!this.host._contourClosed,s="split"===this.host._tool&&!!this.host._splitSel?.pts?.length;if(!e&&!s)return;const i=this._svgPoint(t);if(e){const e=this._resolvePlanDrawPoint(i,t.shiftKey);return this.host._planSnapHover={contextKey:e.contextKey,candidate:e.candidate,conflicts:e.conflicts},this._syncPlanSnapConflictMarkers(e.conflicts),this.host._path.length?void(this.host._cursorPt=e.point):void this._syncPlanSnapActiveMarker(e.candidate)}this.host._cursorPt=this._snap(i)}_saveRoom(){(this.host._areaSel||this.host._nameSel.trim())&&(this.host._wallFaceBatch?this._decideWallFace(!0):this._commitRoom())}_decideWallFace(t){const e=this.host._wallFaceBatch;if(!e)return;const s=e.candidates[e.index];if(!s)return;if(!t&&(s.existing||s.repair)&&1===e.candidates.length)return this.host._wallFaceBatch=null,this.host._roomDialog=!1,this.host._nameSel="",this.host._areaSel="",void this.host.requestUpdate();const i=t?{candidate:s,create:!0,name:this.host._nameSel.trim(),area:this.host._areaSel||null,settings:this._roomSettingsFromDialog()?JSON.parse(JSON.stringify(this._roomSettingsFromDialog())):null}:{candidate:s,create:!1},o=[...e.decisions,i],a=e.index+1;if(a<e.candidates.length)return this.host._wallFaceBatch={...e,decisions:o,index:a},this.host._nameSel="",this.host._areaSel="",this._resetRoomDialogFields(),void this.host.requestUpdate();this.host._wallFaceBatch={...e,decisions:o},this._applyWallFaceBatch()}_wallSourceCmAt(t,e,s){const i=t=>"number"==typeof t&&Number.isFinite(t)&&t>=0?t:null,o=.02*this.host._gridPitch,a=this.host._spaceModel();if(!a)return A;for(const e of this._planSnapGeometrySnapshot().value.segments){if("room"===e.sourceKind||C(t,[e.a[0],e.a[1],e.b[0],e.b[1]])>o)continue;if("partition"===e.sourceKind)return i(a.partitions.find(t=>t.id===e.sourceId)?.cm)??A;const s=e.sourceId.lastIndexOf(":"),n=s>=0?e.sourceId.slice(0,s):e.sourceId,r=s>=0?Number(e.sourceId.slice(s+1)):-1;return i(a.room_drafts.find(t=>t.id===n)?.segments[r]?.cm)??A}const n=Ra(Math.max(0,e.length-1),s,this.host._drawWallCm,A);for(let s=0;s+1<e.length;s++){const i=e[s],a=e[s+1];if(C(t,[i[0],i[1],a[0],a[1]])<=o)return n[s]??A}return A}_activePathWithRepair(t,e){const s=t.map(t=>[...t]);if(!e?.sourceKey.startsWith("active:"))return s;const i=/:(\d+)$/.exec(e.sourceKey),o=i?Number(i[1])+("b"===e.endpoint?1:0):-1;return o>=0&&o<s.length&&(s[o]=[...e.to]),s}_validateWallRepair(t,e){const s=2e-4*this.host._gridPitch,i=this._wallGraphSources(e),o=i.find(e=>e.key===t.sourceKey),a=i.find(e=>e.key===t.targetSourceKey);if(!o||!a)return!1;const n="a"===t.endpoint?o.a:o.b;return!(Math.hypot(n[0]-t.from[0],n[1]-t.from[1])>s)&&(!(C(t.to,[a.a[0],a.a[1],a.b[0],a.b[1]])>s)&&!function(t,e){if(!t.sourceKey.startsWith("static:partition|"))return!1;const s=t.sourceKey.slice(17).split("|")[0];return!!s&&e.some(t=>"partition"===t.host?.kind&&t.host.id===s)}(t,this.host._curSpaceCfg?.openings||[]))}_applyWallRepair(t,e){const s=this.host._curSpaceCfg;if(!s||!this._validateWallRepair(t,e.activePath))return!1;const i=e=>{e[0]=t.to[0]/ol,e[1]=t.to[1]/ol};if(t.sourceKey.startsWith("active:")){const o=/:(\d+)$/.exec(t.sourceKey),a=o?Number(o[1])+("b"===t.endpoint?1:0):-1;if(a<0||a>=e.activePath.length)return!1;e.activePath[a]=[...t.to];const n=(s.room_drafts||[]).find(t=>t.id===e.activeDraftId);return n?.points?.[a]&&i(n.points[a]),!0}if(!t.sourceKey.startsWith("static:"))return!1;const[o,a]=t.sourceKey.slice(7).split("|");if("partition"===o){const e=(s.partitions||[]).find(t=>t.id===a);if(!e)return!1;const o=[e.a[0]*ol,e.a[1]*ol],n=[e.b[0]*ol,e.b[1]*ol],r=Math.hypot(o[0]-t.from[0],o[1]-t.from[1])<=2e-4*this.host._gridPitch?e.a:Math.hypot(n[0]-t.from[0],n[1]-t.from[1])<=2e-4*this.host._gridPitch?e.b:null;return!!r&&(i(r),!0)}if("draft"===o){const e=a.lastIndexOf(":"),o=e>=0?a.slice(0,e):"",n=e>=0?Number(a.slice(e+1)):-1,r=(s.room_drafts||[]).find(t=>t.id===o);if(!r?.points?.[n]||!r?.points?.[n+1])return!1;const l=[n,n+1].find(e=>Math.hypot(r.points[e][0]*ol-t.from[0],r.points[e][1]*ol-t.from[1])<=2e-4*this.host._gridPitch);return null!=l&&(i(r.points[l]),!0)}return!1}_applyWallFaceBatch(){const t=this.host._wallFaceBatch,e=this.host._curSpaceCfg,s=this.host._spaceModel();if(!t||!e||!s)return;const i=(t,e)=>{this.host._showToast(this.host._t(t,e)),this._roomDialogCancel()},o=t.decisions.filter(t=>t.create),a=o.map(t=>t.candidate.ring),n=s.rooms;for(let t=0;t<a.length;t++){if(this._contourSelfIntersects(a[t])||k(a[t])<=1e-6)return void i("toast.contour_cannot_close");for(let e=t+1;e<a.length;e++)if($(a[t],a[e]))return void i("toast.contour_cannot_close");const e=o[t].candidate.split?.roomId,s=n.find(s=>s.id!==e&&!!R(s)&&$(a[t],R(s)));if(s)return void i("toast.room_overlap",{name:s.name||""})}if((e.rooms||[]).length+o.length>400)return void i("toast.physical_limit");if(o.some(t=>t.candidate.split&&!e.rooms.some(e=>e.id===t.candidate.split.roomId)))return void i("toast.contour_cannot_close");const r=o.map(t=>t.candidate.repair).filter(t=>!!t);if(r.length>1||r[0]&&!this._validateWallRepair(r[0],t.activePath))return void i("toast.wall_repair_changed");const l=this._activePathWithRepair(t.activePath,r[0]),h=2e-4*this.host._gridPitch,c=new Map;for(let e=0;e<t.activeCms.length;e++)c.set(this._activeWallSourceKey(e),t.activeCms[e]);const d=[];if(o.length){const t=new Set(o.flatMap(t=>t.candidate.atomKeys)),e=o.some(t=>t.candidate.consumeAllActive);for(const s of tn(this._wallGraphSources(l),h)){const i=s.sourceKeys.find(t=>c.has(t));!i||e||t.has(s.key)||d.push({a:s.a,b:s.b,cm:c.get(i)})}}else d.push(...Fa(l,Ra(l.length-1,t.activeCms,this.host._drawWallCm,A)));if((e.partitions||[]).length+d.length>al)return void i("toast.physical_limit");const p=o.map(t=>t.candidate.ring.map(()=>"")),_=t.activeDraftId?(e.room_drafts||[]).find(e=>e.id===t.activeDraftId):null,u=this._draftSegmentsForPath(t.activePath,_,t.activeCms),m=(t,e)=>{const s=`${t[0].toFixed(9)},${t[1].toFixed(9)}`,i=`${e[0].toFixed(9)},${e[1].toFixed(9)}`;return s<=i?`${s}|${i}`:`${i}|${s}`};for(let e=0;e<u.length;e++){const s=u[e]?.id;if(!s)continue;const i=t.activePath[e],a=t.activePath[e+1],n=[i[0],i[1],a[0],a[1]],r=[];o.forEach((t,e)=>t.candidate.ring.forEach((s,i)=>{const o=t.candidate.ring[(i+1)%t.candidate.ring.length];C(s,n)<=h&&C(o,n)<=h&&r.push({kind:"room",owner:e,edge:i,a:s,b:o})})),d.forEach((t,e)=>{C(t.a,n)<=h&&C(t.b,n)<=h&&r.push({kind:"partition",owner:e,edge:0,a:t.a,b:t.b})});const l=[(i[0]+a[0])/2,(i[1]+a[1])/2];r.sort((t,e)=>{const s=[t.a[0],t.a[1],t.b[0],t.b[1]],o=[e.a[0],e.a[1],e.b[0],e.b[1]];return(C(l,s)<=h?0:1)-(C(l,o)<=h?0:1)||(C(i,s)<=h?0:1)-(C(i,o)<=h?0:1)||m(t.a,t.b).localeCompare(m(e.a,e.b))});const c=r[0];if(!c)continue;const _=m(c.a,c.b);for(const t of r)m(t.a,t.b)===_&&("room"===t.kind?p[t.owner][t.edge]=s:d[t.owner].id=s)}const g=this._geometrySnapshot();if(r[0]&&!this._applyWallRepair(r[0],t))return void i("toast.wall_repair_changed");const f=o.some(t=>!!t.candidate.split),b=f?kt(s.rooms,e.walls,this.host._openCuts(),this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol):null,y=f&&Array.isArray(e.walls)?e.walls:null;for(const t of o){const s=t.candidate.split;if(!s)continue;const o=e.rooms.find(t=>t.id===s.roomId);if(!o)return void i("toast.contour_cannot_close");o.poly=s.mainPoly.map(t=>[t[0]/ol,t[1]/this.host._spaceH]),delete o.x,delete o.y,delete o.w,delete o.h}const v=Date.now().toString(36),w=[];if(o.forEach((t,s)=>{const i=t.area?this.host.hass.areas[t.area]?.name:"",o={id:`r${v}-${s}`,name:t.name||i||this.host._t("room.default_name"),area:t.area||null,poly:t.candidate.ring.map(t=>[t[0]/ol,t[1]/this.host._spaceH]),...p[s].some(Boolean)?{wall_ids:p[s]}:{},...t.settings?{settings:JSON.parse(JSON.stringify(t.settings))}:{}};e.rooms.push(o),w.push({room:o,decision:t})}),t.activeDraftId&&Array.isArray(e.room_drafts)&&(e.room_drafts=e.room_drafts.filter(e=>e.id!==t.activeDraftId),e.room_drafts.length||delete e.room_drafts),d.length&&(e.partitions||=[],d.forEach((t,s)=>e.partitions.push({id:t.id||`partition-${v}-${s}`,a:[t.a[0]/ol,t.a[1]/ol],b:[t.b[0]/ol,t.b[1]/ol],cm:t.cm}))),f){const t=this.host._normalizeWalls(b,this.host._openCuts());t.length?e.walls=t:y?.length?e.walls=y:delete e.walls}if(w.length){this.host._cfgEpoch++;const s=this.host._openCuts(),i=this.host._spaceModel();if(!i)return;let o=e.walls;for(const{room:e,decision:a}of w){const n=a.candidate.ring,r=this._wallSourceCmAt(n[0],t.activePath,t.activeCms);o=Xe(o,i.rooms,e.id,r,this.host._wallKeyPitch,s,ol);for(const a of z(i.rooms,o,s,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol)){if(a.roomId!==e.id||"outer"!==a.kind)continue;const s=[(a.a[0]+a.b[0])/2,(a.a[1]+a.b[1])/2];o=E(o,a.a,a.b,this._wallSourceCmAt(s,t.activePath,t.activeCms),this.host._wallKeyPitch,ol)}}const a=this.host._normalizeWalls(o,s);a.length?e.walls=a:delete e.walls}if(!this._commitPhysicalGeometry(this.host._t("history.wall_face_batch"),g))return;delete this.host._resumeDraftBySpace[this.host._space],this.host._path=[],this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null,this.host._wallFaceBatch=null,this.host._roomDialog=!1,this.host._nameSel="",this.host._areaSel="",this.host._regSignature="",this.host._maybeRebuildDevices();const x=new Set(o.map(t=>t.area).filter(t=>!!t));if(x.size){const t={...this.host._layout};for(const e of this.host._devices){if(!x.has(e.area||"")||e.space!==this.host._space)continue;if(this.host._layout[e.id])continue;const s=this.host._defPos[e.id];s&&(t[e.id]={s:this.host._space,x:s.x/ol,y:s.y/ol},this.host._dirtyPos.add(e.id))}this.host._layout=t,this.host._persistLayout()}this.host._showToast(this.host._t(o.length?"toast.wall_rooms_saved":"toast.wall_chain_saved",{n:o.length}))}_commitRoom(){const t=this.host._curSpaceCfg,e=this.host._spaceModel();if(!t||!e)return;const s=this._geometrySnapshot(),i=this.host._spaceH,o=!!this.host._pendingSplit,a=o?kt(e.rooms,t.walls,this.host._openCuts(),this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol):null,n=o&&Array.isArray(t.walls)?t.walls:null;let r;if(this.host._pendingSplit){const e=t.rooms.find(t=>t.id===this.host._pendingSplit.roomId);if(!e)return this.host._pendingSplit=null,this.host._splitSel=null,void(this.host._roomDialog=!1);e.poly=this.host._pendingSplit.mainPoly.map(t=>[t[0]/ol,t[1]/i]),delete e.x,delete e.y,delete e.w,delete e.h,r=this.host._pendingSplit.newPoly}else{if(!this.host._contourClosed)return;r=this.host._path.slice(0,-1)}const l=this.host._areaSel?this.host.hass.areas[this.host._areaSel]?.name:"",h={id:"r"+Date.now().toString(36),name:this.host._nameSel||l||this.host._t("room.default_name"),area:this.host._areaSel||null,poly:r.map(t=>[t[0]/ol,t[1]/i]),...this._roomSettingsFromDialog()?{settings:this._roomSettingsFromDialog()}:{}};if(!o&&this.host._activeDraftId){const e=Array.isArray(t.room_drafts)?t.room_drafts.find(t=>t.id===this.host._activeDraftId):null,s=Ra(r.length,[...this.host._draftSegmentCms,this.host._closingWallCm??void 0],this.host._drawWallCm,A),i=this._draftSegmentsForPath(this.host._path,e,s);i.length===r.length&&i.every(t=>!!t.id)&&(h.wall_ids=i.map(t=>t.id))}if(t.rooms.push(h),!o&&this.host._activeDraftId&&Array.isArray(t.room_drafts)&&(t.room_drafts=t.room_drafts.filter(t=>t.id!==this.host._activeDraftId),t.room_drafts.length||delete t.room_drafts),o){const e=this.host._normalizeWalls(a,this.host._openCuts());e.length?t.walls=e:n?.length?t.walls=n:delete t.walls}if(!o){const e=Ra(r.length,[...this.host._draftSegmentCms,this.host._closingWallCm??void 0],this.host._drawWallCm,A),s=e[0];if(null!=s){this.host._cfgEpoch++;const i=this.host._openCuts(),o=this.host._spaceModel();if(!o)return;let a=Xe(t.walls,o.rooms,h.id,s,this.host._wallKeyPitch,i,ol);for(const t of z(o.rooms,a,i,this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol)){if(t.roomId!==h.id||"outer"!==t.kind)continue;const s=[(t.a[0]+t.b[0])/2,(t.a[1]+t.b[1])/2],i=r.findIndex((t,e)=>{const i=r[(e+1)%r.length];return C(s,[t[0],t[1],i[0],i[1]])<=.02*this.host._gridPitch});i>=0&&(a=E(a,t.a,t.b,e[i],this.host._wallKeyPitch,ol))}a=this.host._normalizeWalls(a,i),a.length?t.walls=a:delete t.walls}}const c=this._commitPhysicalGeometry(this.host._t(o?"history.split_room":"history.add_room"),s);this.host._path=[],delete this.host._resumeDraftBySpace[this.host._space],this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null,this.host._pendingSplit=null,this.host._splitSel=null;const d=this.host._areaSel;if(this.host._areaSel="",this.host._nameSel="",this.host._roomDialog=!1,this.host._regSignature="",this.host._maybeRebuildDevices(),!c)return;let p=0;if(d){const t=ol,e={...this.host._layout};for(const s of this.host._devices){if(s.area!==d||s.space!==this.host._space)continue;if(p++,this.host._layout[s.id])continue;const i=this.host._defPos[s.id];i&&(e[s.id]={s:this.host._space,x:i.x/ol,y:i.y/t},this.host._dirtyPos.add(s.id))}this.host._layout=e,this.host._persistLayout()}const _=this.host._model.find(t=>t.id===this.host._space)?.rooms.length||0;this.host._showToast(d?this.host._t("toast.room_saved",{n:_,added:p}):this.host._t("toast.room_saved_no_area",{n:_}))}_cancelPath(){this.host._wallRepairDiagnostic=null,this.host._activeDraftId&&(this.host._resumeDraftBySpace[this.host._space]=this.host._activeDraftId),this.host._path=[],this.host._activeDraftId=null,this.host._draftSegmentCms=[],this.host._closingWallCm=null,this._clearPlanSnapHover(),this.host._roomDialog=!1,this.host._pendingSplit=null,this.host._wallFaceBatch=null,this.host._splitSel=null,this.host._mergeSel=null,this.host._mergeDialog=null,this.host._physicalSel=null,this.host._physicalDrag=null,this.host._physicalRotate=null,this._clearOpeningPlacement(!0)}_resumeLastDraft(){const t=this.host._resumeDraftBySpace[this.host._space];if(!t)return;const e=this.host._spaceModel()?.room_drafts.find(e=>e.id===t);e?(this.host._activeDraftId=t,this.host._path=e.points.map(t=>[...t]),this.host._draftSegmentCms=this._adoptDraftCms(this.host._path,e.segments.map(t=>t.cm),e.id),this._clearPlanSnapHover()):delete this.host._resumeDraftBySpace[this.host._space]}_roomDialogCancel(){if(this.host._roomDialog=!1,this.host._roomEditId)return this.host._roomEditId=null,this.host._nameSel="",void(this.host._areaSel="");if(this.host._wallFaceBatch){const t=this.host._wallFaceBatch;return this.host._wallFaceBatch=null,this.host._path=t.activePath.map(t=>[...t]),this.host._draftSegmentCms=[...t.activeCms],this.host._activeDraftId=t.activeDraftId,this.host._nameSel="",this.host._areaSel="",void this.host.requestUpdate()}if(this.host._pendingSplit)return this.host._pendingSplit=null,void(this.host._splitSel=null);this.host._undoPoint()}_openDeviceInbox(){this.host._deviceInboxReturn=null,this.host._deviceInbox=this.host._deviceInbox||{tab:"on_plan",search:"",showEntities:!1,onlyNew:!1,limit:100}}_closeMarkerDialog(){if(this.host._markerDialog=null,this.host._deviceInboxReturn){const t={...this.host._deviceInboxReturn};this.host._deviceInbox=t,this.host._deviceInboxReturn=null,t.anchor&&this.host.updateComplete.then(()=>requestAnimationFrame(()=>{const e=`.device-inbox-row[data-binding="${CSS.escape(t.anchor)}"]`;this.host.renderRoot.querySelector(e)?.scrollIntoView({block:"nearest"})}))}}_deviceInboxCandidates(t){return ca({hass:this.host._planHass,devices:this.host._devices,markers:this.host._markers,showEntities:t,labels:{device:this.host._t("marker.sub_device"),z2mGroup:this.host._t("marker.sub_z2m_group"),group:this.host._t("marker.sub_group"),helper:this.host._t("marker.sub_helper"),entity:this.host._t("marker.sub_entity")}})}_deviceInboxRows(){const t=this.host._deviceInbox||this.host._deviceInboxReturn,e=!!t?.showEntities,s=[this.host._haRegistry.revision,this.host._cfgRev,this.host._cfgEpoch,this.host._regSignature,this.host._newSyncKey,e?1:0,this.host._showAll?1:0,d(this.host.hass,this.host._config?.language)].join("|");if(this.host._deviceInboxMemo?.key===s)return this.host._deviceInboxMemo.rows;const i=this._deviceInboxCandidates(e),o=new Set(i.map(t=>t.value));for(const t of this.host._markers)t.binding&&"virtual"!==t.binding&&o.add(t.binding);for(const t of this.host._devices)t.bindingKind&&"virtual"!==t.bindingKind&&t.bindingRef&&o.add(`${t.bindingKind}:${t.bindingRef}`);const a=new Map;for(const t of o)a.set(t,this.host._bindingStatus(t));const n=this.host._areaToSpace,r={};for(const[t,e]of Object.entries(this.host.hass?.areas||{}))r[t]=n[t]?.room?.name||e?.name||t;for(const[t,e]of Object.entries(n))r[t]=e.room.name||r[t]||t;const l=Object.fromEntries(this.host._model.map(t=>[t.id,t.title])),h=Object.fromEntries(Object.entries(n).map(([t,e])=>[t,e.space])),c={},p=new Map;for(const[t,e]of Object.entries(this.host._fullRegistryHass.entities||{})){const s=String(e?.platform||"").trim();if(s&&(c[`entity:${t}`]=s),s&&e?.device_id){const t=p.get(e.device_id)||new Set;t.add(s),p.set(e.device_id,t)}}for(const[t,e]of p)c[`device:${t}`]=[...e].sort().join(", ");const _={};for(const[t,e]of Object.entries(this.host._fullRegistryHass.devices||{})){const s=`device:${t}`,i=p.get(t)||new Set,o=Array.isArray(e?.identifiers?.[0])?String(e.identifiers[0][0]||""):"",a=[o,...i].some(t=>this.host._excluded.has(t));"service"===e?.entry_type?_[s]="service_entry":a?_[s]="excluded_integration":"Group"===e?.model?_[s]="grouped_light":/scene/i.test(e?.model||"")?_[s]="excluded_domain":(/bridge/i.test(`${e?.model||""}${e?.name||""}`)||"myheat"===o&&e?.via_device_id)&&(_[s]="represented_by_parent")}const u=function(t){const{devices:e,markers:s,candidates:i,statuses:o,newDeviceIds:a,showHiddenOnPlan:n,areaNames:r={},spaceNames:l={},spaceByArea:h={},integrationByBinding:c={},reasonByBinding:d={}}=t,p=new Map;for(const t of e)!t.virtual&&t.bindingKind&&"virtual"!==t.bindingKind&&t.bindingRef&&p.set(`${t.bindingKind}:${t.bindingRef}`,t);const _=new Map,u=new Map;for(const t of s)t?.binding&&"virtual"!==t.binding&&(t.removed?u.set(t.binding,t):_.set(t.binding,t));const m=new Map(i.map(t=>[t.value,t])),g=new Set([...p.keys(),..._.keys(),...m.keys(),...[...u.keys()].filter(t=>m.has(t))]),f=[];for(const t of g){const e=p.get(t),s=_.get(t),i=s?void 0:u.get(t),g=m.get(t);let b;if(i&&g)b="readd";else if(!0===s?.hidden)b="hidden";else if(e||s)b="on_plan";else{if(!g)continue;b="available"}const y=e?.bindingStatus||o.get(t)||da,v=s||i,$=pa(t),w=e?.area||g?.areaId||v?.area||"",k=e?.space||v?.space||h[w]||"",x=e?.name||v?.name||g?.label||t,S=e?.model||v?.model||g?.model||"",M=!!g?.parentDeviceId&&p.has(`device:${g.parentDeviceId}`),D="readd"===b?"removed":"hidden"===b?s&&_a(s)?d[t]||"automatic_hidden":"manual_hidden":"on_plan"===b?s?"visible_explicit":"visible_auto":d[t]||(M?"represented_by_parent":w&&k?"available":"no_bound_room"),C=!!e&&(!e.hidden||n),P="active"===y.kind,I=C&&(P||"ha_disabled"===y.kind&&n),T=[x,S,c[t],r[w],l[k],t,g?.sub].filter(Boolean).join(" ").toLocaleLowerCase();f.push({key:t,binding:t,category:b,status:y,reason:D,deviceId:e?.id,markerId:v?.id,name:x,icon:e?.icon||v?.icon||("entity"===$?"mdi:code-braces":"mdi:devices"),model:S,integration:c[t]||"",areaId:w,areaName:r[w]||"",spaceId:k,spaceName:l[k]||"",kind:$,isNew:!!e&&a.has(e.id),searchText:T,canFind:I,canEdit:!!e||!!s,canHide:"on_plan"===b&&P,canShow:"hidden"===b&&P,canAdd:("available"===b||"readd"===b)&&P})}const b=t=>"active"===t.status.kind?1:0;return f.sort((t,e)=>t.category.localeCompare(e.category)||Number(e.isNew)-Number(t.isNew)||b(t)-b(e)||t.name.localeCompare(e.name)||t.binding.localeCompare(e.binding))}({devices:this.host._devices,markers:this.host._markers,candidates:i,statuses:a,newDeviceIds:this.host._newIds,showHiddenOnPlan:this.host._showAll,areaNames:r,spaceNames:l,spaceByArea:h,integrationByBinding:c,reasonByBinding:_});return this.host._deviceInboxMemo={key:s,rows:u},u}_deviceForInboxRow(t){const e=t.deviceId?this.host._devices.find(e=>e.id===t.deviceId):null;if(e)return e;const s=t.markerId?this.host._markers.find(e=>e.id===t.markerId):null;return!s||s.removed?null:{id:s.id,name:t.name,model:t.model,area:t.areaId,space:t.spaceId||this.host._space,hidden:!0===s.hidden||"ha_disabled"===t.status.kind,userHidden:!0===s.hidden,bindingStatus:t.status,icon:t.icon,entities:"active"===t.status.kind?t.status.enabledEntityIds:[],allEntities:t.status.allEntityIds,primary:"active"===t.status.kind?t.status.enabledEntityIds[0]:void 0,marker:s,bindingKind:t.kind,bindingRef:t.binding.slice(t.binding.indexOf(":")+1),pdfs:s.pdfs||[]}}_openInboxMarker(t,e=!1){const s=this.host._deviceInbox;if(s){if(this.host._deviceInboxReturn={...s,anchor:t.key},this.host._deviceInbox=null,!e){const e=this._deviceForInboxRow(t);return void(e?this._openMarkerDialog(e):this._closeMarkerDialog())}this._openMarkerDialog(),this.host._markerDialog?this.host._markerDialog={...this.host._markerDialog,bindingMode:"ha",binding:t.binding,bindingOpen:!1,showEntities:"entity"===t.kind,name:""}:this._closeMarkerDialog()}}async _setInboxHidden(t,e){const s=this.host._deviceInbox,i=this.host._serverCfg;if(!s||!i||s.busy||"active"!==t.status.kind)return;const o=i.markers||[],a=o.find(e=>!e.removed&&e.binding===t.binding);if(!e&&!a)return;const n=a?.id||Ze(t.binding,t.markerId,()=>`m_${Date.now().toString(36)}`),r=a?{...a,hidden:e}:{id:n,binding:t.binding,hidden:!0};i.markers=[...o.filter(e=>e.id!==n&&(e.binding!==t.binding||!0===e.removed)),r],this.host._deviceInbox={...s,busy:t.key,anchor:t.key};try{await this._saveConfigNow(),this.host._regSignature="",this.host._deviceInboxMemo=null,this.host._maybeRebuildDevices(),this.host._deviceInbox&&(this.host._deviceInbox={...this.host._deviceInbox,busy:void 0}),this.host._showToast(this.host._t("device_inbox.saved"))}catch(t){this.host._serverCfg===i&&(i.markers=o),this.host._deviceInbox&&(this.host._deviceInbox={...this.host._deviceInbox,busy:void 0}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}_findInboxDevice(t){if(!t.canFind)return;const e=this._deviceForInboxRow(t);if(!e)return;if(this.host._deviceInbox=null,e.space&&e.space!==this.host._space){if(!this.host._commitSpace(e.space))return;this.host._restoreZoom()}const s=()=>{const t=this.host._devices.find(t=>t.id===e.id)||e,s=this.host._pos(t);this.host._applyView(this.host._zoom,s.x,s.y),this.host._selId=t.id,this.host.requestUpdate(),window.setTimeout(()=>{this.host._selId===t.id&&(this.host._selId=null,this.host.requestUpdate())},1500)};requestAnimationFrame(()=>requestAnimationFrame(s))}_deviceInboxTabKey(t){if("ArrowLeft"!==t.key&&"ArrowRight"!==t.key)return;const e=this.host._deviceInbox;if(!e)return;const s=["on_plan","available","hidden","readd"],i="ArrowRight"===t.key?1:-1,o=(s.indexOf(e.tab)+i+s.length)%s.length;this.host._deviceInbox={...e,tab:s[o],limit:100,onlyNew:!1},t.preventDefault()}_openMarkerDialog(t){if(this.host._vacAllCamerasFor=null,this.host._vacAllCameraCache=null,t&&this.host._ackNewDevice(t.id),this.host._norm)if(t){const e=t.marker,s=Object.prototype.hasOwnProperty.call(e||{},"is_light"),i=Object.prototype.hasOwnProperty.call(e||{},"light_entity"),o=Object.prototype.hasOwnProperty.call(e||{},"glow_color"),a=Object.prototype.hasOwnProperty.call(e||{},"value_badge"),n=Object.prototype.hasOwnProperty.call(e||{},"tap_action"),r=Object.prototype.hasOwnProperty.call(e||{},"toggle_entity"),h=Qe(e?.glow_color),c=this.host._devicePresentation(t,!0).valueBadge,d=ts(this.host._planHass,t,this.host._devices),p=es(this.host._planHass,t,d);this.host._markerDialog={devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingMode:"virtual"===t.bindingKind?"virtual":"ha",bindingOpen:!1,showEntities:"entity"===t.bindingKind&&!!this.host._fullRegistryHass.entities[t.bindingRef||""]?.device_id,bindingFilter:"",icon:t.marker?.icon||"",autoIcon:t.icon||"",display:os(t.marker?.display),rippleColor:l(t.marker?.ripple_color,""),rippleSize:Number(t.marker?.ripple_size)>0?Number(t.marker.ripple_size):1.5,size:Number(t.marker?.size)>0?Number(t.marker.size):1,angle:Number(t.marker?.angle)||0,tapAction:is(t.marker?.tap_action,t.primary?.split(".")[0]),tapActionTouched:!1,originalHasTapAction:n,originalTapAction:t.marker?.tap_action,tapHintAnnouncement:"",toggleEntity:e?.toggle_entity||"",toggleEntityTouched:!1,originalHasToggleEntity:r,originalToggleEntity:e?.toggle_entity,tapTarget:t.marker?.tap_target||"",tapConfirm:!0===t.marker?.tap_confirm,runFilter:"",controls:ss(t.marker?.binding,t.marker?.controls,t.entities),controlsFilter:"",lightRole:!0===e?.is_light?"always":!1===e?.is_light?"never":"auto",lightRoleTouched:!1,originalHasIsLight:s,originalIsLight:e?.is_light,lightEntity:e?.light_entity||"",lightEntityTouched:!1,originalHasLightEntity:i,originalLightEntity:e?.light_entity,glowMode:null!=h?.bri?"fixed":h?"color":"auto",glowColor:h?.c||this.host._fillColors.glow_light.c,glowBrightness:Math.max(1,Math.round(100*(h?.bri??1))),glowColorDrafted:!!h,glowBrightnessDrafted:null!=h?.bri,glowTouched:!1,originalHasGlowColor:o&&(!!h||null===e?.glow_color),originalGlowColor:h||(null===e?.glow_color?null:void 0),valueBadgeEnabled:a?!0===e?.value_badge?.enabled:!!c,valueBadgeSource:e?.value_badge?.source||c?.source||p,valueBadgePosition:e?.value_badge?.position||c?.position||"right",valueBadgeTouched:!1,originalHasValueBadge:a,originalValueBadge:e?.value_badge,useClimateTemp:!0===t.marker?.use_climate_temp,glowRadius:Number(t.marker?.glow_radius_cm)>0?String(this.host._imperial?Math.round(Number(t.marker.glow_radius_cm)/30.48*10)/10:Math.round(Number(t.marker.glow_radius_cm))/100):"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.marker?.room_id?t.space+"#@"+t.marker.room_id:t.space&&t.area?t.space+"#"+t.area:"",hideFromPlan:!0===t.marker?.hidden,busy:!1}}else this.host._markerDialog={name:"",binding:"virtual",bindingMode:"virtual",bindingOpen:!1,showEntities:!1,bindingFilter:"",icon:"",autoIcon:"",display:"badge",rippleColor:"",rippleSize:1.5,size:1,angle:0,tapAction:"info",tapActionTouched:!1,originalHasTapAction:!1,originalTapAction:void 0,tapHintAnnouncement:"",toggleEntity:"",toggleEntityTouched:!1,originalHasToggleEntity:!1,originalToggleEntity:void 0,tapTarget:"",tapConfirm:!1,runFilter:"",controls:[],controlsFilter:"",lightRole:"auto",lightRoleTouched:!1,originalHasIsLight:!1,originalIsLight:void 0,lightEntity:"",lightEntityTouched:!1,originalHasLightEntity:!1,originalLightEntity:void 0,glowMode:"auto",glowColor:this.host._fillColors.glow_light.c,glowBrightness:100,glowColorDrafted:!1,glowBrightnessDrafted:!1,glowTouched:!1,originalHasGlowColor:!1,originalGlowColor:void 0,valueBadgeEnabled:!1,valueBadgeSource:null,valueBadgePosition:"right",valueBadgeTouched:!1,originalHasValueBadge:!1,originalValueBadge:void 0,useClimateTemp:!1,glowRadius:"",model:"",link:"",description:"",pdfs:[],room:"",hideFromPlan:!1,busy:!1,uploadId:"up_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};else this.host._showToast(this.host._t("toast.marker_needs_server"))}_runCandidates(){const t=[];for(const e of as)for(const[s,i]of Object.entries(this.host.hass.states))s.startsWith(e+".")&&this.host._planEntityAvailable(s)&&t.push({value:s,label:i?.attributes?.friendly_name||s,sub:this.host._t("run."+e)});return t.sort((t,e)=>t.sub.localeCompare(e.sub)||t.label.localeCompare(e.label))}_bindingCandidates(){const t=ca({hass:this.host._planHass,devices:this.host._devices,markers:this.host._markers,showEntities:!!this.host._markerDialog?.showEntities,currentBinding:this.host._markerDialog?.binding,currentDeviceId:this.host._markerDialog?.devId,labels:{device:this.host._t("marker.sub_device"),z2mGroup:this.host._t("marker.sub_z2m_group"),group:this.host._t("marker.sub_group"),helper:this.host._t("marker.sub_helper"),entity:this.host._t("marker.sub_entity")}}),e=(this.host._markerDialog?.bindingFilter||"").toLowerCase().trim(),s=e?t.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(e)):t;return s.sort((t,e)=>t.label.localeCompare(e.label)),s.slice(0,200)}_backupErrorText(t){const e=t?.code??t?.error;if("string"==typeof e){const t=`backup.error.${e}`,s=this.host._t(t);if(s!==t)return s}return this.host._errText(t)}async _pickMarkerFiles(t){const e=t.target,s=e.files?[...e.files]:[];if(e.value="",!s.length||!this.host._markerDialog)return;const i=this.host._markerDialog.uploadId||this.host._markerDialog.devId||"new",o=[];for(const t of s)try{const e=new FormData;e.append("marker_id",i),e.append("file",t,t.name);const s=this.host.hass?.fetchWithAuth?await this.host.hass.fetchWithAuth("/api/houseplan/upload",{method:"POST",body:e}):await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:this.host.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.host.hass.auth.data.access_token}`}:{}}),a=await s.json().catch(()=>({}));if(!s.ok||a.error){const t={too_large:this.host._t("err.too_large",{mb:a.max_mb||50}),bad_ext:this.host._t("err.bad_ext"),unauthorized:this.host._t("err.unauthorized")};throw new Error(t[a.error]||a.error||"HTTP "+s.status)}o.push({name:a.name||t.name,url:a.url})}catch(e){this.host._showToast(this.host._t("toast.file_failed",{name:t.name,err:this.host._errText(e)}))}o.length&&this.host._markerDialog&&(this.host._markerDialog={...this.host._markerDialog,pdfs:[...this.host._markerDialog.pdfs,...o]},this.host._showToast(this.host._t("toast.files_attached",{n:o.length})))}_removeMarkerPdf(t){this.host._markerDialog&&(this.host._markerDialog={...this.host._markerDialog,pdfs:this.host._markerDialog.pdfs.filter(e=>e.url!==t)})}_markerLightFields(t){const e={};if(t.lightRoleTouched?"always"===t.lightRole?e.is_light=!0:"never"===t.lightRole&&(e.is_light=!1):t.originalHasIsLight&&(e.is_light=t.originalIsLight??null),t.lightEntityTouched?t.lightEntity&&(e.light_entity=t.lightEntity):t.originalHasLightEntity&&(e.light_entity=t.originalLightEntity??null),t.glowTouched){if("auto"!==t.glowMode){const s={c:l(t.glowColor,this.host._fillColors.glow_light.c)};"fixed"===t.glowMode&&(s.bri=Math.max(.01,Math.min(1,Math.round(t.glowBrightness)/100))),e.glow_color=s}}else t.originalHasGlowColor&&(e.glow_color=t.originalGlowColor??null);return e}_markerTapActionFields(t){return t.tapActionTouched?{tap_action:t.tapAction||null}:t.originalHasTapAction?{tap_action:t.originalTapAction??null}:{}}_markerToggleEntityFields(t){return(e={touched:t.toggleEntityTouched,originalHas:t.originalHasToggleEntity,original:t.originalToggleEntity,value:t.toggleEntity}).touched?e.value?{toggle_entity:e.value}:{}:e.originalHas?{toggle_entity:e.original??null}:{};var e}async _saveMarker(){const t=this.host._markerDialog;if(!t||t.busy)return;const e=this._effectiveMarkerTapAction(t);if("ha"===t.bindingMode&&(!t.binding||"virtual"===t.binding))return;if("virtual"===t.binding&&!t.name.trim())return void this.host._showToast(this.host._t("toast.virtual_name_required"));if("run"===e&&!t.tapTarget)return void this.host._showToast(this.host._t("toast.run_target_required"));if(t.valueBadgeTouched&&t.valueBadgeEnabled&&!t.valueBadgeSource)return void this.host._showToast(this.host._t("toast.value_badge_source_required"));if("ha"===t.bindingMode){const e=this.host._bindingStatus(t.binding),s=t.devId?this.host._markers.find(e=>e.id===t.devId):null,i=!s||s.binding!==t.binding;if("active"!==e.kind&&i)return void this.host._showToast(this.host._t("ha_disabled"===e.kind?"toast.ha_disabled_add":"toast.ha_binding_unverified"));if("ha_disabled"===e.kind&&!0===s?.hidden&&!t.hideFromPlan)return this.host._markerDialog={...t,hideFromPlan:!0},void this.host._showToast(this.host._t("entity"===e.reason?"toast.ha_disabled_show_entity":"toast.ha_disabled_show_device"))}const s=this.host._serverCfg;if(!s)return;const i=s.markers||[],o=ns(t.room);let a=o?.space||null;const n=o?.area||null,r=o?.roomId||null,l=Ze(t.binding,t.devId,()=>"v_"+Date.now().toString(36)),h=t.devId,c=h?this.host._devices.find(t=>t.id===h):null,d=o?.space||c?.space||null,p=d?this.host._spaceModelById(d):this.host._spaceModel();if(!p)return;const _=p.id;"virtual"!==t.binding||a||(a=_),this.host._markerDialog={...t,busy:!0};try{const o="virtual"===t.binding?[]:i.filter(e=>e.removed&&e.binding===t.binding).map(t=>t.id),d=o.length>0,u=ss(t.binding,t.controls,this.host._bindingEntities(t.binding)),m=i.find(t=>t.id===l||t.id===h)?.vacuum||null,g={id:l,vacuum:m,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,display:"badge"!==t.display?t.display:null,ripple_color:"icon_ripple"===t.display&&t.rippleColor?t.rippleColor:null,ripple_size:"icon_ripple"===t.display&&1.5!==t.rippleSize?t.rippleSize:null,size:1!==t.size?t.size:null,angle:t.angle?t.angle:null,...this._markerTapActionFields(t),...this._markerToggleEntityFields(t),tap_target:"run"===e&&t.tapTarget||null,tap_confirm:!!t.tapConfirm||null,controls:u.length?u:null,...this._markerLightFields(t),...this._markerValueBadgeFields(t),use_climate_temp:!!t.useClimateTemp||null,glow_radius_cm:(()=>{const e=sl(t.glowRadius);return null==e||e<=0?null:Math.round(this.host._imperial?30.48*e:100*e)})(),model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs,hidden:!!t.hideFromPlan};("virtual"===t.binding||t.room)&&(g.space=a,g.area=n,g.room_id=r);const f=c?.marker?.room_id??null,b=!!t.room&&null!=c&&(c.space!==a||c.area!==n||f!==r);let y=!1;const v=t.uploadId||h;if(v&&v!==l&&g.pdfs?.length)try{const t=await this.host.hass.callWS({type:"houseplan/files/migrate",from_id:v,to_id:l}),e=t?.mapping||{};g.pdfs=rs(g.pdfs,v,l,e),y=Object.keys(e).length>0}catch(t){this.host._showToast(this.host._t("toast.files_migrate_failed",{err:this.host._errText(t)}))}s.markers=i,h&&h!==l&&(s.markers=ls(s.markers,h,l)),h&&h!==l&&"derived_marker_state"===g.value_badge?.source?.kind&&g.value_badge.source.ref===`marker:${h}`&&(g.value_badge.source={kind:"derived_marker_state",ref:`marker:${l}`}),s.markers=s.markers.filter(t=>t.id!==l&&t.id!==h&&("virtual"===g.binding||t.binding!==g.binding)),s.markers.push(g);let $=null;const w=h?this.host._layout[h]:null,k=w?{s:w.s||c?.space||this.host._space,x:w.x,y:w.y}:h&&c&&this.host._defPos[h]?this.host._normPos(c.space,this.host._defPos[h].x,this.host._defPos[h].y):null;if(!d&&k&&k.s===_)l===h&&this.host._layout[l]&&!b||($={s:k.s,x:k.x,y:k.y},this.host._layout={...this.host._layout,[l]:$});else if(d||!this.host._layout[l]||b){let t=p.vb[0]+p.vb[2]/2,e=p.vb[1]+p.vb[3]/2;const s=r?p.rooms.find(t=>t.id===r):n?p.rooms.find(t=>t.area===n):void 0;s&&([t,e]=this.host._roomCenter(s)),$=this.host._normPos(_,t,e),this.host._layout={...this.host._layout,[l]:$}}if(await this._saveConfigNow(),$){const t=hs($);this.host._layout={...this.host._layout,[l]:t},this.host._noteLayoutRev(await this.host.hass.callWS({type:"houseplan/layout/update",device_id:l,pos:t}))}const x=new Set(o);h&&h!==l&&x.add(h),x.delete(l);for(const t of x)delete this.host._layout[t],await this.host.hass.callWS({type:"houseplan/layout/delete",device_id:t}).then(t=>this.host._noteLayoutRev(t)).catch(()=>{});y&&v&&await this.host.hass.callWS({type:"houseplan/files/cleanup",marker_id:v}).catch(()=>{}),this._closeMarkerDialog(),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._showToast(this.host._t("toast.marker_saved"))}catch(t){this.host._markerDialog&&(this.host._markerDialog={...this.host._markerDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}async _deleteMarker(){const t=this.host._markerDialog;if(!t||t.busy||!t.devId)return;const e=t.devId?this.host._devices.find(e=>e.id===t.devId):null,s=this.host._markers.find(e=>e.id===t.devId);if(!e&&!s)return;const i=t.name||this.host._t("device.fallback");if(!confirm(this.host._t("confirm.remove_marker",{name:i})))return;const o=this.host._serverCfg;o.markers=o.markers||[];const a=o.markers,n=e?.id||s.id,r=e?"virtual"===e.bindingKind?"virtual":e.bindingKind&&e.bindingRef?`${e.bindingKind}:${e.bindingRef}`:"":s.binding;if(!r)return;const l=cs(o.markers,n,r,"virtual"===r);o.markers=ds(l.markers,l.cleanupIds);const h=l.cleanupIds;this.host._markerDialog={...t,busy:!0};try{await this._saveConfigNow();for(const t of h){delete this.host._layout[t],delete this.host._defPos[t],this.host._dirtyPos.delete(t),this.host._sentPos.delete(t);const e=this.host._activityRt.get(t);e&&clearTimeout(e.timer),this.host._activityRt.delete(t),this.host._vacRt.delete(t),delete this.host._vacSrvTrails[t],await this.host.hass.callWS({type:"houseplan/layout/delete",device_id:t}).then(t=>this.host._noteLayoutRev(t)).catch(()=>{}),await this.host.hass.callWS({type:"houseplan/files/cleanup",marker_id:t}).catch(()=>{}),await this.host.hass.callWS({type:"houseplan/trail/delete",marker_id:t}).catch(()=>{})}this.host._deviceInboxReturn&&(this.host._deviceInboxReturn={...this.host._deviceInboxReturn,tab:"readd",anchor:r}),this._closeMarkerDialog(),this.host._infoCard?.id===n&&this.host._closeInfoCard(),this.host._selId===n&&(this.host._selId=null),this.host._drag?.id===n&&(this.host._drag=null),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._showToast(this.host._t("toast.marker_removed"))}catch(t){this.host._serverCfg===o&&(o.markers=a),this.host._markerDialog&&(this.host._markerDialog={...this.host._markerDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}_openSpaceDialog(t,e){if(this.host._serverStorage&&this.host._serverCfg)if("edit"===t){const s=this.host._serverCfg.spaces.find(t=>t.id===e);if(!s)return;const i=ps(s),o=s.settings?.custom_fill&&"object"==typeof s.settings.custom_fill?_s(s.settings.custom_fill):null,a="none"===i.fill?{...o||us,a:0}:o;this.host._spaceDialog={mode:t,spaceId:e,title:s.title,planUrl:s.plan_url||null,planFile:null,source:s.plan_url?"file":"draw",showBorders:i.showBorders,showNames:i.showNames,zeroWallStyle:gs(s),displayTouched:!0,hideDecor:i.hideDecor,hideOpenings:i.hideOpenings,roomColor:i.color,roomOpacity:i.opacity,fillMode:"none"===i.fill?"custom":i.fill,customFill:a,glowEnabled:i.glow,bgColor:i.bgColor,bgMode:"static"===s.settings?.bg_mode||"daynight"===s.settings?.bg_mode?s.settings.bg_mode:null,northDeg:Mt({},s.settings),sunRays:"boolean"==typeof s.settings?.sun_rays?s.settings.sun_rays:null,tempMin:i.tempMin,tempMax:i.tempMax,showLqi:i.showLqi??this.host._config?.show_signal??!0,cardFontScale:i.cardFontScale,labelTemp:i.labelTemp,labelHum:i.labelHum,labelLqi:i.labelLqi,labelLight:i.labelLight,cellCm:Number(s.cell_cm)>0?Number(s.cell_cm):5,cellCmInput:ms(Number(s.cell_cm)>0?Number(s.cell_cm):5,this.host._imperial),cellCmTouched:!1,busy:!1}}else this.host._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,...Ri(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:vs,roomOpacity:ys,fillMode:"custom",customFill:{...us,a:0},glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:bs,tempMax:fs,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:$s(this.host._imperial),cellCmInput:ms($s(this.host._imperial),this.host._imperial),cellCmTouched:!1,busy:!1};else this.host._showToast(this.host._t("toast.integration_missing"))}async _pickPlanFile(t){const e=t.target,s=e.files?.[0];if(!s||!this.host._spaceDialog)return;const i={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[s.type]||(s.name.toLowerCase().endsWith(".svg")?"svg":"");if(!i)return void this.host._showToast(this.host._t("toast.plan_formats"));const o=new Uint8Array(await s.arrayBuffer());let a="";for(let t=0;t<o.length;t+=32768)a+=String.fromCharCode(...o.subarray(t,t+32768));const n=btoa(a),r=URL.createObjectURL(s),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=r});URL.revokeObjectURL(r),this.host._spaceDialog={...this.host._spaceDialog,planFile:{ext:i,b64:n,aspect:l,name:s.name}}}_useServerPlan(t){const e=this.host._spaceDialog;e&&(this.host._spaceDialog={...e,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this.host._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let e=0;e<40;e++){const e=this.host._display(t);if(e){const s=await new Promise(t=>{const s=new Image;s.onload=()=>t(s.naturalWidth&&s.naturalHeight?s.naturalWidth/s.naturalHeight:0),s.onerror=()=>t(0),s.src=e}),i=this.host._spaceDialog;return i&&i.planUrl===t&&Number.isFinite(s)&&s>0?(this.host._spaceDialog={...i,savedAspect:s},s):0}if(await new Promise(t=>setTimeout(t,150)),this.host._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){if(confirm(this.host._t("confirm.delete_plan",{name:t})))try{await this.host.hass.callWS({type:"houseplan/plans/delete",name:t});const e=this.host._spaceDialog;e?.saved&&(this.host._spaceDialog={...e,saved:e.saved.filter(e=>e.name!==t)})}catch(t){this.host._showToast(this.host._t("toast.plan_delete_failed",{err:this.host._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return o`<div class="savedplans muted">${this.host._t("space.loading")}</div>`;const e=t.saved||[];if(!e.length)return o`<div class="savedplans muted">${this.host._t("space.no_saved")}</div>`;return o`<div class="savedplans">
      ${e.map(e=>{return o`
        <div class="savedplan ${e.url===t.planUrl?"cur":""}">
          <img src=${this.host._display(e.url)} alt="" loading="lazy" decoding="async" />
          <div class="savedmeta">
            <b>${e.name}</b>
            <span class="muted">${s=e.size,s>=1048576?(s/1048576).toFixed(1)+" MB":Math.round(s/1024)+" KB"}${e.used_by.length?" · "+this.host._t("space.used_by",{list:e.used_by.join(", ")}):""}</span>
          </div>
          <button class="btn ghost" @click=${()=>this._useServerPlan(e.url)}
            ?disabled=${e.url===t.planUrl}>${this.host._t("btn.use")}</button>
          <button class="btn ghost danger"
            title=${e.used_by.length||e.url===t.planUrl?this.host._t("space.in_use"):this.host._t("btn.delete")}
            ?disabled=${e.used_by.length>0||e.url===t.planUrl}
            @click=${()=>this._deleteServerPlan(e.name)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>`;var s})}
    </div>`}async _saveSpaceDialog(){const t=this.host._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this.host._showToast(this.host._t("toast.plan_required"));const e="create"===t.mode&&0===(this.host._serverCfg?.spaces.length||0);this.host._spaceDialog={...t,busy:!0};try{const s="create"===t.mode?"s"+Date.now().toString(36):t.spaceId;let i=null;if("file"===t.source&&t.planFile){i={url:(await this.host.hass.callWS({type:"houseplan/plan/set",space_id:s,ext:t.planFile.ext,data:t.planFile.b64})).url,aspect:t.planFile.aspect}}let o=t.savedAspect||null;!i&&"file"===t.source&&t.planUrl&&!o&&this.host._aspectJob&&(o=await this.host._aspectJob||null);const a=this.host._serverCfg;let n;if("create"===t.mode)n=Fi(s,t.title.trim()),a.spaces.push(n);else{if(n=a.spaces.find(t=>t.id===s),!n)throw new Error("space "+s+" is gone from the config");n.title=t.title.trim()}i?(n.plan_url=i.url,n.plan_aspect=i.aspect):"file"===t.source&&t.planUrl&&t.planUrl!==n.plan_url&&(n.plan_url=t.planUrl,n.plan_aspect=o),"draw"===t.source&&(n.plan_url=null,n.plan_aspect=null,delete n.plan_x,delete n.plan_y,delete n.plan_scale,delete n.plan_scale_x,delete n.plan_scale_y,delete n.plan_angle),n.settings={...n.settings||{},show_borders:t.showBorders,show_names:t.showNames,hide_decor:t.hideDecor||void 0,hide_openings:t.hideOpenings||void 0,room_color:t.roomColor,room_opacity:t.roomOpacity,bg_color:t.bgColor||void 0,bg_mode:t.bgMode||void 0,north_deg:t.northDeg??void 0,sun_rays:t.sunRays??void 0,fill_mode:t.fillMode,custom_fill:t.customFill||void 0,glow_enabled:t.glowEnabled,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):bs,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):fs,show_lqi:t.showLqi,card_font_scale:1!==t.cardFontScale?t.cardFontScale:void 0,label_temp:t.labelTemp,label_hum:t.labelHum,label_lqi:t.labelLqi,label_light:t.labelLight},n.zero_wall_style=t.zeroWallStyle,n.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?Math.max(.1,Math.min(el,t.cellCm)):5,await this._saveConfigNow(),this.host._spaceDialog=null,"create"===t.mode&&this.host._commitSpace(n.id),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._importQueue.length?this._openNextImport():e||this.host._importTotal>0?(this.host._importTotal=0,this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||this.host._space),this._setMode("plan"),this.host._tool="draw",this.host._path=[],this.host._cursorPt=null,this._primeDrawWallField(),this.host._showToast(this.host._t(e&&!this.host._importTotal?"toast.space_added_onboard":"import.done"))):(this.host._showToast("create"===t.mode?this.host._t("toast.space_added"):this.host._t("toast.space_saved")),"create"===t.mode&&("plan"!==this.host._mode?this._setMode("plan"):(this.host._tool="draw",this.host._path=[],this.host._cursorPt=null,this._primeDrawWallField(),this.host._saveNav())))}catch(t){"conflict"!==t?.code&&await this.host._reloadConfigOnly(!0),this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}async _deleteSpace(){const t=this.host._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this.host._serverCfg;if(!e)return;const s=e.spaces.find(e=>e.id===t.spaceId),i=Ni(e,this.host._layout||{},t.spaceId||""),o=1===e.spaces.length&&e.spaces[0]?.id===t.spaceId;if(!i.count||o){if(confirm(this.host._t("confirm.delete_space",{title:s.title}))){this.host._spaceDialog={...t,deleteBlockers:0,busy:!0};try{this.host._saveConfigDebounced.pending()&&this.host._saveConfigDebounced.flush(),this.host._persistLayout.pending()&&this.host._persistLayout.flush(),await this.host._writeChain;const e=await this.host.hass.callWS({type:"houseplan/space/delete",space_id:t.spaceId,expected_config_rev:this.host._cfgRev,expected_layout_rev:this.host._layoutRev}),[s,i]=await Promise.all([this.host.hass.callWS({type:"houseplan/config/get"}),this.host.hass.callWS({type:"houseplan/layout/get"})]);this.host._adoptStructuralResponses(s,i),this.host._cfgRev=e?.config_rev??this.host._cfgRev,this.host._layoutRev=e?.layout_rev??this.host._layoutRev,this.host._spaceDialog=null,this.host._space===t.spaceId&&this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||""),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._showToast(this.host._t("toast.space_deleted"))}catch(e){"conflict"!==e?.code&&"space_in_use"!==e?.code||await Promise.all([this.host._reloadConfigOnly(!0),this.host._reloadLayoutOnly()]);const s=this.host._serverCfg;if(this.host._spaceDialog&&s){const e=Ni(s,this.host._layout||{},t.spaceId||""),i=1===s.spaces.length&&s.spaces[0]?.id===t.spaceId;this.host._spaceDialog={...this.host._spaceDialog,busy:!1,deleteBlockers:i?0:e.count}}this.host._showToast(this.host._t("toast.delete_failed",{err:this.host._errText(e)}))}}}else this.host._spaceDialog={...t,deleteBlockers:i.count}}async _saveConfigNow(){this.host._cfgEpoch++;try{await this._writeConfig()}catch(t){throw t?.physicalGeometryRolledBack?await this._reloadRejectedPhysicalWrite():"conflict"===t?.code&&await this.host._reloadConfigOnly(),t}}_startImport(){const t=this.host._importDialog;if(!t)return;const e=t.floors.filter(t=>t.checked).map(t=>t.name);this.host._importDialog=null,e.length?(this.host._importQueue=e,this.host._importTotal=e.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this.host._importQueue.shift();void 0!==t&&(this.host._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,...Ri(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:vs,roomOpacity:ys,fillMode:"custom",customFill:null,glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:bs,tempMax:fs,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:$s(this.host._imperial),cellCmInput:ms($s(this.host._imperial),this.host._imperial),cellCmTouched:!1,busy:!1})}_skipImport(){this.host._spaceDialog=null,this.host._importQueue.length?this._openNextImport():this.host._importTotal>0&&this.host._model.length&&(this.host._importTotal=0,this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||this.host._space),this._setMode("plan"),this.host._showToast(this.host._t("import.done")))}_renderImportDialog(){const t=this.host._importDialog,e=t.floors.filter(t=>t.checked).length;return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("import.title")} icon="mdi:home-floor-1"
      @hp-close=${()=>this.host._importDialog=null}>
        <div class="body">
          <div class="rhint">${this.host._t("import.hint")}</div>
          ${t.floors.map((e,s)=>o`<label class="floorrow">
              <input type="checkbox" .checked=${e.checked}
                @change=${i=>{const o=[...t.floors];o[s]={...e,checked:i.target.checked},this.host._importDialog={floors:o}}} />
              <span>${e.name}</span>
              ${null!=e.level?o`<span class="floorlvl">L${e.level}</span>`:a}
            </label>`)}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>{this.host._importDialog=null,this._openSpaceDialog("create")}}>
            ${this.host._t("import.manual")}
          </button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._startImport()} ?disabled=${!e}>
            <ha-icon icon="mdi:import"></ha-icon>${this.host._t("import.start",{n:e})}
          </button>
        </div>
    </hp-dialog>`}_preflightDiagnostics(t,e){const s=new Map((e?.spaces||[]).map(t=>[String(t?.id||""),t]));return{kind:"houseplan-optimize-preflight",origin:"runtime",cardVersion:Xr,checkedAt:(new Date).toISOString(),preflightFingerprint:t.fingerprint,failures:t.failures.map(t=>({spaceId:t.spaceId,displayName:t.displayName,reason:t.reason,detail:t.detail??null,spaceGeometryFingerprint:s.has(t.spaceId)?jt(s.get(t.spaceId)):null}))}}_reportPreflightFailure(t,e){t.ok||t.fingerprint===this.host._reportedPreflightFingerprint||(this.host._reportedPreflightFingerprint=t.fingerprint,console.warn("[houseplan] optimize preflight failed",this._preflightDiagnostics(t,e)))}_preflightVersionsDiffer(){const t=this.host._haIntegrationVersion;return"string"==typeof t&&t.length>0&&t!==Xr}async _copyPreflightDiagnostics(){const t=this.host._alignDialog?.preflight;if(!t||t.ok)return;const e=JSON.stringify(this._preflightDiagnostics(t,this.host._alignDialog?.config??null),null,2);try{await navigator.clipboard.writeText(e),this.host._preflightClipboardFallback=null,this.host._showToast(this.host._t("gs.preflight_copied"))}catch{this.host._preflightClipboardFallback=e}}_checkOptimizeGeometry(t){return ws(t,{fallbackSpaceName:t=>this.host._t("gs.align_preflight_space",{n:String(t)})})}_checkSpacePhysicalGeometry(t,e,s){return ks(t,e,{fallbackSpaceName:t=>this.host._t("gs.align_preflight_space",{n:String(t)}),captureWallGeometry:s?(t,e)=>s(e):void 0})}_optimizeReferenceContext(t){const e=this.host._haRegistry,s=this.host._fullRegistryHass,i={},o=(...t)=>{for(const e of t){const t=String(e||"").trim();if(t)return t}return""};for(const[t,s]of Object.entries(e.devices||{}))i[t]=o(s?.name_by_user,s?.name,s?.model);for(const[t,s]of Object.entries(e.entities||{}))i[`lg_${t}`]=o(this.host.hass?.states?.[t]?.attributes?.friendly_name,s?.name,s?.original_name);for(const t of this.host._devices)i[t.id]=o(t.name,i[t.id]);for(const t of this.host._serverCfg?.markers||[]){const e=String(t.binding||"").indexOf(":"),a=e>0?t.binding.slice(0,e):"",n=e>0?t.binding.slice(e+1):"",r="device"===a?s?.devices?.[n]:"entity"===a?s?.entities?.[n]:null;i[t.id]=o(t.name,"device"===a?r?.name_by_user:null,r?.name,"entity"===a?this.host.hass?.states?.[n]?.attributes?.friendly_name:null,i[t.id])}return{effectiveAreaByMarker:Object.fromEntries(this.host._devices.filter(t=>!t.virtual&&!!t.area).map(t=>[t.id,t.area])),ownerRoster:{authoritative:e.authoritative,deviceIds:Object.keys(e.devices||{}),entityIds:[...new Set([...Object.keys(e.entities||{}),...Object.keys(this.host.hass?.states||{})])],names:i},removeLiveMissingPositions:t}}_previewAlignDialog(t){if(!this.host._norm||!this.host._serverCfg)return;const e=this.host._serverCfg.spaces||[];let s;try{s=zr(this.host._serverCfg,this.host._layout||{},this._optimizeReferenceContext(t))}catch(t){return void this._showWallModelMigrationBlocked(t)}const i=s.changed?this._checkOptimizeGeometry(s.config):null;i&&this._reportPreflightFailure(i,s.config);const o=Math.ceil(10*s.report.maxShiftCm)/10,a=e.find(t=>null!=t?.id&&String(t.id)===s.report.maxSpace),n=e.length>1&&a?String(a.title||a.id):"";this.host._preflightClipboardFallback=null,this.host._alignDialog={report:s.report,config:s.config,layout:s.layout,cm:o,where:n,preflight:i,changed:s.changed,busy:!1,removeLiveMissingPositions:t}}async _runAlignToGrid(){let t=this.host._alignDialog;if(!t||t.busy||!this.host._serverCfg||!t.changed||!t.preflight?.ok)return;const e=Et(t.config);if(t.preflight.fingerprint!==e){const e=this._checkOptimizeGeometry(t.config);if(this._reportPreflightFailure(e,t.config),t={...t,preflight:e},this.host._alignDialog=t,!e.ok)return}this._clearGeometryGesture(),this.host._alignDialog={...t,busy:!0};try{this.host._saveConfigDebounced.pending()&&this.host._saveConfigDebounced.flush(),await this.host._writeChain;const e=await this.host.hass.callWS({type:"houseplan/plan/optimize",config:t.config,layout:t.layout,expected_config_rev:this.host._cfgRev,expected_layout_rev:this.host._layoutRev});this.host._serverCfg=t.config,this.host._layout=t.layout,this.host._geometryHistory.clear(),this.host._cfgRev=e?.config_rev??this.host._cfgRev+1,this.host._layoutRev=e?.layout_rev??this.host._layoutRev+1,this.host._canOptimizeUndo=!!e?.can_undo,this.host._undoKind=e?.can_undo?"optimize":null,this.host._dirtyPos.clear(),this.host._sentPos.clear(),this.host._cfgEpoch++,this.host._modelCache=null,this.host._frame=null,this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._cacheSnapshot(),this.host._alignDialog=null,this.host._preflightClipboardFallback=null,this.host.requestUpdate(),this.host._showToast(this.host._t("gs.align_done",{n:String(t.report.moved),m:String(t.report.migrated+t.report.canonicalized+t.report.coordsCanonicalized+t.report.latticeCoordinatesCanonicalized+t.report.wallsMerged+t.report.spansMerged+t.report.partitionsMerged+t.report.partitionsReconciled+t.report.openingsRehosted+t.report.wallsStraightened),r:String(t.report.spaceRefsRemapped+t.report.roomRefsRemapped+t.report.positionsRemapped+t.report.markersDetached+t.report.orphanRoomLabelsRemoved+t.report.orphanDevicePositionsRemoved+t.report.orphanGroupPositionsRemoved)}))}catch(t){if(this.host._alignDialog&&(this.host._alignDialog={...this.host._alignDialog,busy:!1}),"wall_model_client_outdated"===t?.code)return void this.host._showToast(this.host._t("toast.wall_model_client_outdated"));"conflict"===t?.code&&await Promise.all([this.host._reloadConfigOnly(!0),this.host._reloadLayoutOnly()]),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}async _undoPlanOptimization(){if(!this.host._canOptimizeUndo||this.host._optimizeUndoBusy)return;const t=this.host._undoKind;this._clearGeometryGesture(),this.host._optimizeUndoBusy=!0,this.host.requestUpdate();try{await this.host.hass.callWS({type:"houseplan/plan/optimize_undo",expected_config_rev:this.host._cfgRev,expected_layout_rev:this.host._layoutRev});const[e,s]=await Promise.all([this.host.hass.callWS({type:"houseplan/config/get"}),this.host.hass.callWS({type:"houseplan/layout/get"})]);this.host._serverCfg=e?.config||this.host._serverCfg,this.host._cfgRev=e?.rev??this.host._cfgRev,this.host._layout=s?.layout||this.host._layout,this.host._geometryHistory.clear(),this.host._layoutRev=s?.rev??this.host._layoutRev,this.host._canOptimizeUndo=!1,this.host._undoKind=null,this.host._cfgEpoch++,this.host._modelCache=null,this.host._frame=null,this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._cacheSnapshot(),this.host.requestUpdate(),this.host._showToast(this.host._t("import"===t?"backup.import_undone":"gs.optimize_undone"))}catch(t){this.host._canOptimizeUndo=!1,this.host._undoKind=null,this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}finally{this.host._optimizeUndoBusy=!1,this.host.requestUpdate()}}async _runBackupExport(){const t=this.host._backupExportDialog;if(t&&!t.busy){this.host._backupExportDialog={...t,busy:!0,error:""};try{const e=await this.host.hass.callWS({type:"houseplan/export/create",kind:t.kind,space_id:"space"===t.kind?this.host._space:void 0,..."space"===t.kind&&t.planOnly?{plan_only:!0}:{},card_version:Xr}),s=new Blob([JSON.stringify(e.document,null,2)+"\n"],{type:"application/json;charset=utf-8"}),i=URL.createObjectURL(s),o=document.createElement("a");o.href=i,o.download=e.filename||`houseplan-${t.kind}.json`,o.style.display="none",document.body.append(o),o.click(),o.remove(),window.setTimeout(()=>URL.revokeObjectURL(i),0),this.host._backupExportDialog=null,this.host._showToast(this.host._t("backup.export_done"))}catch(t){this.host._backupExportDialog&&(this.host._backupExportDialog={...this.host._backupExportDialog,busy:!1,error:this._backupErrorText(t)})}}}async _pickBackupImport(t){const e=t.target,s=e.files?.[0];if(e.value="",s){this.host._settingsDialog=null,this.host._backupImportDialog={filename:s.name,size:s.size,token:"",preview:null,expectedConfigRev:this.host._cfgRev,expectedLayoutRev:this.host._layoutRev,duplicatePolicy:"skip",confirmMissing:!1,busy:!0,error:""};try{this.host._saveConfigDebounced.pending()&&this.host._saveConfigDebounced.flush(),await this.host._writeChain,this.host._persistLayout.pending()&&this.host._persistLayout.flush();const t="/api/houseplan/import/preview?duplicate_policy=skip",e={method:"POST",body:s,headers:{"content-type":"application/json"}},i=this.host.hass?.fetchWithAuth?await this.host.hass.fetchWithAuth(t,e):await fetch(t,{...e,headers:{...e.headers,...this.host.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.host.hass.auth.data.access_token}`}:{}}}),o=await i.json().catch(()=>({}));if(!i.ok||o.error)throw Object.assign(new Error(o.message||o.error||`HTTP ${i.status}`),{code:o.error});this.host._backupImportDialog&&(this.host._backupImportDialog={...this.host._backupImportDialog,token:o.token,preview:o.preview,expectedConfigRev:o.expected_config_rev,expectedLayoutRev:o.expected_layout_rev,busy:!1})}catch(t){this.host._backupImportDialog&&(this.host._backupImportDialog={...this.host._backupImportDialog,busy:!1,error:this._backupErrorText(t)})}}}async _setBackupDuplicatePolicy(t){const e=this.host._backupImportDialog;if(e&&!e.busy&&e.token&&t!==e.duplicatePolicy){this.host._backupImportDialog={...e,duplicatePolicy:t,busy:!0,error:""};try{const s=await this.host.hass.callWS({type:"houseplan/import/revalidate",token:e.token,duplicate_policy:t});this.host._backupImportDialog&&(this.host._backupImportDialog={...this.host._backupImportDialog,preview:{...e.preview,...s.preview},expectedConfigRev:s.expected_config_rev,expectedLayoutRev:s.expected_layout_rev,confirmMissing:!1,busy:!1})}catch(t){this.host._backupImportDialog&&(this.host._backupImportDialog={...this.host._backupImportDialog,duplicatePolicy:e.duplicatePolicy,preview:e.preview,confirmMissing:e.confirmMissing,busy:!1,error:this._backupErrorText(t)})}}}async _applyBackupImport(){const t=this.host._backupImportDialog;if(!t||t.busy||!t.token||!t.preview)return;if(t.preview.confirmation_required&&!t.confirmMissing)return;this.host._backupImportDialog={...t,busy:!0,error:""};const e=this.host._space;try{const s=await this.host.hass.callWS({type:"houseplan/import/apply",token:t.token,expected_config_rev:t.expectedConfigRev,expected_layout_rev:t.expectedLayoutRev,duplicate_policy:t.duplicatePolicy,confirm_missing_content:t.confirmMissing}),[i,o]=await Promise.all([this.host.hass.callWS({type:"houseplan/config/get"}),this.host.hass.callWS({type:"houseplan/layout/get"})]);this.host._adoptStructuralResponses(i,o),this.host._geometryHistory.clear(),this.host._dirtyPos.clear(),this.host._sentPos.clear(),this.host._defPos={},this.host._cfgEpoch++,this.host._modelCache=null,this.host._frame=null,this.host._visibleDeviceSnapshot=null,this.host._candidateDeviceSnapshot=null,this.host._stagedDeviceSnapshotToken=-1,this.host._capturedSnapshotConfigEpoch=-1,this.host._regSignature="",this.host._signer.invalidate(this.host.hass),this.host._resign(),this.host._maybeRebuildDevices();const a=this.host._serverCfg?.spaces||[],n="space"===s.kind&&s.space_id?s.space_id:a.some(t=>t.id===e)?e:a[0]?.id||this.host._space;this.host._hasFixedFloor?this.host._adoptInitialSpace(this.host._model,!0):this.host._commitSpace(n),this.host._backupImportDialog=null,this.host._cacheSnapshot(),this.host.requestUpdate();const r="space"===s.kind?t.preview.counts:s.counts;this.host._showToast(this.host._t("space"===s.kind?"backup.space_done":"backup.full_done",{spaces:String(r?.spaces||0),rooms:String(r?.rooms||0),markers:String(r?.markers||0),refs:String(s.repaired_target_refs||0)}))}catch(t){if("conflict"===t?.code&&this.host._backupImportDialog?.token)try{const t=this.host._backupImportDialog,e=await this.host.hass.callWS({type:"houseplan/import/revalidate",token:t.token,duplicate_policy:t.duplicatePolicy});return void(this.host._backupImportDialog={...t,preview:{...t.preview,...e.preview},expectedConfigRev:e.expected_config_rev,expectedLayoutRev:e.expected_layout_rev,confirmMissing:!1,busy:!1,error:this.host._t("backup.revalidated")})}catch(e){t=e}this.host._backupImportDialog&&(this.host._backupImportDialog={...this.host._backupImportDialog,busy:!1,error:this._backupErrorText(t)})}}_renderBackupExportDialog(){const t=this.host._backupExportDialog,e=(this.host._serverCfg?.spaces||[]).find(t=>t.id===this.host._space);return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("backup.export_title")}
      icon="mdi:download" dismiss-on-scrim @hp-close=${()=>this.host._backupExportDialog=null}>
      <div class="body backupbody">
        <div class="rhint">${this.host._t("backup.export_hint")}</div>
        <label class="srcrow"><input type="radio" name="backup-kind" value="full"
          .checked=${"full"===t.kind}
          @change=${()=>this.host._backupExportDialog={...t,kind:"full",planOnly:!1}} />
          <span>${this.host._t("backup.full")}</span></label>
        <label class="srcrow"><input type="radio" name="backup-kind" value="space"
          .checked=${"space"===t.kind} ?disabled=${!e}
          @change=${()=>this.host._backupExportDialog={...t,kind:"space"}} />
          <span>${e?this.host._t("backup.current_space_title",{title:e.title||e.id}):this.host._t("backup.no_current_space")}</span></label>
        ${"space"===t.kind&&e?o`<label class="srcrow backupplanonly">
          <input type="checkbox" .checked=${t.planOnly}
            @change=${e=>this.host._backupExportDialog={...t,planOnly:e.target.checked}} />
          <span><b>${this.host._t("backup.plan_only")}</b><small>${this.host._t("backup.plan_only_hint")}</small></span>
        </label>`:a}
        <div class="backupwarn">${this.host._t("backup.privacy_warning")}</div>
        ${t.error?o`<div class="backuperror" role="alert">${t.error}</div>`:a}
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" autofocus @click=${()=>this.host._backupExportDialog=null}>${this.host._t("btn.cancel")}</button>
        <span class="spacer"></span>
        <button class="btn on" ?disabled=${t.busy||"space"===t.kind&&!e}
          @click=${this._runBackupExport}>
          <ha-icon icon="mdi:download"></ha-icon>${t.busy?"…":this.host._t("backup.download")}
        </button>
      </div>
    </hp-dialog>`}_renderBackupImportDialog(){const t=this.host._backupImportDialog,e=t.preview,s=e?.counts||{},i=e?.reference_report||{},n=t=>Object.values(t||{}).reduce((t,e)=>t+(Number(e)||0),0),r=[["incoming_remapped",n(i.remapped?.incoming)],["target_repaired",n(i.remapped?.target)],["preserved_unresolved",n(i.preservedUnresolved)],["collisions",n(i.collisions)],["dropped_links",n(i.droppedIncomingLinks)],["bounded_lineages",Number(i.boundedLineages)||0]].filter(([,t])=>t>0);return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("backup.import_title")}
      icon="mdi:upload" wide dismiss-on-scrim @hp-close=${()=>this.host._backupImportDialog=null}>
      <div class="body backupbody" aria-busy=${t.busy?"true":"false"}>
        <div class="backupfile"><b>${t.filename}</b><span>${(t.size/1024).toFixed(1)} KB</span></div>
        ${t.busy&&!e?o`<div class="rhint" role="status" aria-live="polite">${this.host._t("backup.reading")}</div>`:a}
        ${t.error?o`<div class="backuperror" role="alert">${t.error}</div>`:a}
        ${e?o`
          <div class="backupsummary">
            <b>${this.host._t("full"===e.kind?"backup.full":"backup.current_space")}</b>
            ${e.plan_only?o`<span class="backupplanonlystatus">${this.host._t("backup.plan_only_preview")}</span>`:a}
            <span>${this.host._t("same"===e.source?"backup.same_source":"backup.foreign_source")}</span>
            <span>${this.host._t("backup.created",{value:e.created_at||"—"})}</span>
            <span>${this.host._t("backup.versions",{card:e.card_version||"—",integration:e.integration_version||"—",model:String(e.model_version??"—")})}</span>
          </div>
          <div class="backupcounts">
            <span>${this.host._t("backup.count_spaces",{n:"full"===e.kind?`${e.current_counts?.spaces||0} → ${s.spaces||0}`:String(s.spaces||0)})}</span>
            <span>${this.host._t("backup.count_rooms",{n:"full"===e.kind?`${e.current_counts?.rooms||0} → ${s.rooms||0}`:String(s.rooms||0)})}</span>
            <span>${this.host._t("backup.count_walls",{n:"full"===e.kind?`${e.current_counts?.walls||0} → ${s.walls||0}`:String(s.walls||0)})}</span>
            <span>${this.host._t("backup.count_openings",{n:"full"===e.kind?`${e.current_counts?.openings||0} → ${s.openings||0}`:String(s.openings||0)})}</span>
            <span>${this.host._t("backup.count_decor",{n:"full"===e.kind?`${e.current_counts?.decor||0} → ${s.decor||0}`:String(s.decor||0)})}</span>
            <span>${this.host._t("backup.count_markers",{n:"full"===e.kind?`${e.current_counts?.markers||0} → ${s.markers||0}`:String(s.markers||0)})}</span>
            <span>${this.host._t("backup.count_layout",{n:"full"===e.kind?`${e.current_counts?.layout||0} → ${s.layout||0}`:String(s.layout||0)})}</span>
          </div>
          ${e.bindings?o`<div class="rhint">${this.host._t("backup.bindings",{device:String(e.bindings.device||0),entity:String(e.bindings.entity||0),virtual:String(e.bindings.virtual||0),legacy:String(e.legacy_positions||0)})}</div><div class="rhint">${this.host._t("backup.binding_status",{active:String(e.bindings.active||0),disabled:String(e.bindings.disabled||0),missing:String(e.bindings.missing||0)})}</div>`:a}
          ${e.missing_areas?.length?o`<div class="backupwarn">${this.host._t("backup.missing_areas",{areas:e.missing_areas.join(", ")})}</div>`:a}
          ${e.dropped_marker_links?o`<div class="backupwarn">${this.host._t("backup.dropped_marker_links",{n:String(e.dropped_marker_links)})}</div>`:a}
          ${e.repaired_target_refs?o`<div class="rhint">${this.host._t("backup.repaired_target_refs",{n:String(e.repaired_target_refs)})}</div>`:a}
          ${e.preserved_unresolved_refs?o`
            <div class="backupwarn">${this.host._t("backup.preserved_unresolved_refs",{n:String(e.preserved_unresolved_refs)})}<br />${this.host._t("backup.preserved_unresolved_hint")}</div>
          `:a}
          ${r.length?o`<details class="backupdetails">
            <summary>${this.host._t("backup.import_details")}</summary>
            <div>
              ${r.map(([t,e])=>o`<span>${this.host._t(`backup.import_detail.${t}`,{n:String(e)})}</span>`)}
              ${(i.examples||[]).slice(0,8).map(t=>o`
                <code>${t.owner} → ${t.reference}</code>
              `)}
            </div>
          </details>`:a}
          ${"full"===e.kind?o`
            <div class="backupwarn">${this.host._t("backup.replace_warning")}</div>
            ${"foreign"===e.source?o`<div class="rhint">${this.host._t("backup.foreign_bookkeeping")}</div>`:a}`:o`
            <div class="backupsummary"><b>${this.host._t("backup.final_name")}</b><span>${e.space_title}</span></div>
            <div class="rhint">${this.host._t("backup.target_settings")}</div>
            ${e.duplicates?o`<fieldset class="backupchoices"><legend>${this.host._t("backup.duplicates",{n:String(e.duplicates)})}</legend>
              <label><input type="radio" name="duplicate-policy" .checked=${"skip"===t.duplicatePolicy}
                @change=${()=>this._setBackupDuplicatePolicy("skip")} />${this.host._t("backup.skip")}</label>
              <label><input type="radio" name="duplicate-policy" .checked=${"virtual"===t.duplicatePolicy}
                @change=${()=>this._setBackupDuplicatePolicy("virtual")} />${this.host._t("backup.virtual_copy")}</label>
            </fieldset>`:a}`}
          ${e.content?.length?o`<div class="backupcontent">
            <b>${this.host._t("backup.content")}</b>
            ${e.content.map(t=>o`<span>${t.url} · ${this.host._t("available"===t.state?"backup.content_available":"external"===t.state?"backup.content_external":"backup.content_detach_required")}</span>`)}
          </div>`:a}
          ${e.confirmation_required?o`<label class="srcrow backupconfirm">
            <input type="checkbox" .checked=${t.confirmMissing}
              @change=${e=>this.host._backupImportDialog={...t,confirmMissing:e.target.checked}} />
            <span>${this.host._t("backup.confirm_detach")}</span>
          </label>`:a}
        `:a}
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" autofocus @click=${()=>this.host._backupImportDialog=null}>${this.host._t("btn.cancel")}</button>
        <span class="spacer"></span>
        ${e?o`<button class="btn ${"full"===e.kind?"danger":"on"}"
          ?disabled=${t.busy||e.confirmation_required&&!t.confirmMissing} @click=${this._applyBackupImport}>
          <ha-icon icon=${"full"===e.kind?"mdi:database-import":"mdi:plus"}></ha-icon>
          ${t.busy?"…":this.host._t("full"===e.kind?"backup.replace":"backup.add")}
        </button>`:a}
      </div>
    </hp-dialog>`}_setFillColor(t,e){const s=this.host._settingsDialog;this.host._settingsDialog={...s,colors:{...s.colors,[t]:{...s.colors[t],...e}}}}async _saveSettingsDialog(){const t=this.host._settingsDialog;if(t&&!t.busy){this.host._settingsDialog={...t,busy:!0};try{const e=this.host._serverCfg,s=JSON.stringify(t.colors)===JSON.stringify(xs),i={...e.settings};s?delete i.fill_colors:i.fill_colors=t.colors;const o=this.host._imperial?30.48*t.glowRadius:100*t.glowRadius;Number.isFinite(o)&&o>0&&300!==Math.round(o)?i.glow_radius_cm=Math.round(o):delete i.glow_radius_cm,t.bgColor?i.bg_color=t.bgColor:delete i.bg_color,null!==t.northDeg&&Number.isInteger(t.northDeg)&&t.northDeg>=0&&t.northDeg<=359?i.north_deg=t.northDeg:delete i.north_deg,i.bg_mode=t.bgMode,t.sunRays?i.sun_rays=!0:delete i.sun_rays,delete i.weather_entity,this.host._serverCfg={...e,settings:i},await this._saveConfigNow(),this.host._settingsDialog=null,this.host.requestUpdate(),this.host._showToast(this.host._t("gs.saved"))}catch(t){this.host._settingsDialog&&(this.host._settingsDialog={...this.host._settingsDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}}_boolInput(t,e,s=!1){const i=t=>e(!!t.target.checked);return customElements.get("ha-switch")?o`<ha-switch .checked=${t} .disabled=${s} @change=${i}></ha-switch>`:o`<input type="checkbox" .checked=${t} ?disabled=${s} @change=${i} />`}_rangeInput(t,e,s,i,n,r=!1,l){const h=t=>{const e=Number(t.target.value);Number.isFinite(e)&&n(e)};return customElements.get("ha-slider")?o`<ha-slider .min=${t} .max=${e} .step=${s} .value=${i}
          .disabled=${r} aria-label=${l||a} @input=${h} @change=${h}></ha-slider>`:o`<input type="range" min=${t} max=${e} step=${s} .value=${String(i)}
          ?disabled=${r} aria-label=${l||a} @input=${h} />`}_renderColorRow(t,e){const s=this.host._settingsDialog.colors[t];return o`<div class="colorrow gsrow">
      <hp-color-opacity .label=${this.host._t(e)}
        .opacityLabel=${this.host._t("space.opacity")}
        .pickerLabels=${this.host._colorPickerLabels}
        .color=${s.c} .opacity=${s.a} .showOpacity=${!0}
        @hp-color-opacity-change=${e=>{this._setFillColor(t,{c:e.detail.color,a:e.detail.opacity})}}></hp-color-opacity>
    </div>`}_renderAlignDialog(){const t=this.host._alignDialog,e=t.report,s=t.changed&&!t.preflight?.ok,i=t.preflight?.failures||[],n=i.slice(0,3).map(t=>t.displayName),r=n.length?n.join(", "):this.host._t("gs.align_preflight_space",{n:"1"}),l=Math.max(0,i.length-n.length),h=l?this.host._t("gs.align_preflight_more",{n:String(l)}):"",c=e.spaceRefsRemapped+e.roomRefsRemapped+e.positionsRemapped+e.markersDetached,d=e.migrated+e.canonicalized+e.coordsCanonicalized+e.wallSegmentsMigrated+e.wallsMerged+e.spansMerged+e.partitionsMerged+e.partitionsReconciled+e.openingsRehosted+e.redundantDraftsRemoved,p=e.moved+e.rotated+e.removedDrafts+e.coordsCanonicalized+e.wallsStraightened,_=Math.ceil(10*e.maxStraightenShiftCm)/10,u=(this.host._serverCfg?.spaces||[]).find(t=>String(t?.id||"")===e.maxStraightenSpace),m=(this.host._serverCfg?.spaces||[]).length>1&&u?String(u.title||u.id):"",g=e.orphanRoomLabelsRemoved+e.orphanDevicePositionsRemoved+e.orphanGroupPositionsRemoved,f=e.liveMissingPositions.map(t=>t.name).filter(Boolean),b=f.slice(0,3).join(", "),y=Math.max(0,f.length-3),v=b?this.host._t("gs.optimize_live_names",{names:b,more:y?this.host._t("gs.optimize_reference_more",{n:String(y)}):""}):"",$=e.unverifiedPositions.some(t=>"registry_unavailable"===t.reason),w=t=>e.removedPositions.some(e=>e.id===t.id)?this.host._t("gs.optimize_detail_removed"):e.liveMissingPositions.some(e=>e.id===t.id)?this.host._t("gs.optimize_detail_live"):this.host._t("gs.optimize_detail_unverified"),k=t=>this.host._t("room_label"===t?"gs.optimize_detail_room_label":"group"===t?"gs.optimize_detail_group":"device"===t?"gs.optimize_detail_device":"gs.optimize_detail_unknown"),x=[...e.removedPositions,...e.liveMissingPositions.filter(t=>!e.removedPositions.some(e=>e.id===t.id)),...e.unverifiedPositions],S=x.slice(0,10),M=Math.max(0,x.length-S.length);return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("gs.align_title")} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${()=>{this.host._alignDialog=null,this.host._preflightClipboardFallback=null}}>
        <div class="body">
          ${s?o`
              <p class="alignmsg">${this.host._t("gs.align_preflight_failed",{spaces:r,more:h})}</p>
              ${i.slice(0,10).map(t=>o`<p class="alignmsg">
                ${t.displayName}: ${this.host._t(`gs.preflight_reason_${t.reason}`)}
              </p>`)}
              ${i.length>10?o`<p class="alignmsg">
                ${this.host._t("gs.align_preflight_more",{n:String(i.length-10)})}
              </p>`:a}
              <div class="rhint">${this.host._t("gs.align_preflight_hint")}</div>
              ${this._preflightVersionsDiffer()?o`
                <div class="rhint">${this.host._t("gs.preflight_update_hint")}</div>`:a}
              <div class="row">
                <button class="btn ghost" @click=${()=>this._copyPreflightDiagnostics()}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>
                  ${this.host._t("gs.preflight_copy")}
                </button>
              </div>
              ${this.host._preflightClipboardFallback?o`<details open>
                <summary>${this.host._t("gs.preflight_copy")}</summary>
                <pre style="user-select:text;white-space:pre-wrap">${this.host._preflightClipboardFallback}</pre>
              </details>`:a}`:t.changed?o`
              ${e.moved?o`<p class="alignmsg">${this.host._t("gs.align_count",{n:String(e.moved),total:String(e.total),cm:String(t.cm)})}</p>`:a}
              ${e.latticeCoordinatesCanonicalized?o`
                <p class="alignmsg">${this.host._t("gs.optimize_lattice_summary",{n:String(e.latticeCoordinatesCanonicalized),cm:Ss(e.latticeMaxShiftCm)})}</p>
                ${e.latticeSpaces.map(t=>o`<p class="alignmsg">${this.host._t("gs.optimize_lattice_space",{space:t.space,n:String(t.canonicalized),far:String(t.far)})}</p>`)}
              `:a}
              ${t.where?o`<p class="alignmsg">${this.host._t("gs.align_where",{s:t.where})}</p>`:a}
              ${e.rotated?o`<p class="alignmsg">${this.host._t("gs.align_turned",{n:String(e.rotated)})}</p>`:a}
              ${e.removedDrafts?o`<p class="alignmsg">${this.host._t("gs.align_removed_drafts",{n:String(e.removedDrafts)})}</p>`:a}
              ${e.redundantDraftsRemoved?o`<p class="alignmsg">${this.host._t("gs.optimize_redundant_drafts",{n:String(e.redundantDraftsRemoved)})}</p>`:a}
              ${e.wallSegmentsMigrated?o`<p class="alignmsg">${this.host._t("gs.wall_segments_migrated",{n:String(e.wallSegmentsMigrated)})}</p>`:a}
              ${e.legacyZeroWallsMigrated?o`<p class="alignmsg">${this.host._t("gs.zero_walls_migrated",{n:String(e.legacyZeroWallsMigrated)})}</p>`:a}
              ${d?o`<p class="alignmsg">${this.host._t("gs.optimize_changes",{m:String(e.migrated),c:String(e.canonicalized),p:String(e.coordsCanonicalized),w:String(e.wallsMerged),s:String(e.spansMerged),i:String(e.partitionsMerged)})}</p>`:a}
              ${e.partitionsReconciled?o`<p class="alignmsg">${this.host._t("gs.optimize_coincident_partitions",{n:String(e.partitionsReconciled)})}</p>`:a}
              ${e.openingsRehosted?o`<p class="alignmsg">${this.host._t("gs.optimize_openings_rehosted",{n:String(e.openingsRehosted)})}</p>`:a}
              ${e.wallsStraightened?o`<p class="alignmsg">${this.host._t("gs.optimize_walls_straightened",{n:String(e.wallsStraightened),cm:String(_)})}</p>`:a}
              ${m?o`<p class="alignmsg">${this.host._t("gs.optimize_walls_straightened_where",{s:m})}</p>`:a}
              ${e.glowSpacesMigrated||e.glowRoomsMigrated?o`<p class="alignmsg">${this.host._t("gs.optimize_glow_migration",{spaces:String(e.glowSpacesMigrated),rooms:String(e.glowRoomsMigrated)})}</p>`:a}
              ${p?o`<div class="rhint">${this.host._t("gs.align_warn")}</div>`:a}`:o`<p class="alignmsg">${this.host._t(e.liveMissingPositions.length||e.unverifiedPositions.length||e.nestedRefsUnresolved?"gs.optimize_no_automatic_changes":"gs.align_none")}</p>`}
          ${!s&&e.wallsStraightenSkipped?o`<p class="rhint">${this.host._t("gs.optimize_walls_straighten_skipped",{n:String(e.wallsStraightenSkipped)})}</p>`:a}
          ${c?o`<p class="alignmsg">${this.host._t("gs.optimize_references",{spaces:String(e.spaceRefsRemapped),rooms:String(e.roomRefsRemapped),positions:String(e.positionsRemapped),detached:String(e.markersDetached)})}</p>`:a}
          ${g?o`<p class="alignmsg">${this.host._t("gs.optimize_orphans_removed",{total:String(g),rooms:String(e.orphanRoomLabelsRemoved),devices:String(e.orphanDevicePositionsRemoved),groups:String(e.orphanGroupPositionsRemoved)})}</p>`:a}
          ${e.liveMissingPositions.length?o`<div class="optimize-live">
                <p class="alignmsg">${this.host._t(t.removeLiveMissingPositions?"gs.optimize_live_positions_remove":"gs.optimize_live_positions",{n:String(e.liveMissingPositions.length),names:v})}</p>
                <button class="btn ghost optimize-cleanup" type="button"
                  aria-pressed=${t.removeLiveMissingPositions?"true":"false"}
                  @click=${this._toggleOptimizeLivePositions} ?disabled=${t.busy}>
                  <ha-icon icon=${t.removeLiveMissingPositions?"mdi:undo":"mdi:map-marker-remove-outline"}></ha-icon>
                  ${this.host._t(t.removeLiveMissingPositions?"gs.optimize_live_keep":"gs.optimize_live_remove")}
                </button>
                ${t.removeLiveMissingPositions?o`<div class="rhint optimize-selected" role="status">
                      ${this.host._t("gs.optimize_live_selected")}
                    </div>`:a}
              </div>`:a}
          ${e.unverifiedPositions.length?o`<div class="rhint" role="alert">
                ${this.host._t("gs.optimize_unverified",{n:String(e.unverifiedPositions.length)})}
                ${$?` ${this.host._t("gs.optimize_registry_limited")}`:""}
              </div>`:a}
          ${e.nestedRefsUnresolved?o`<div class="rhint" role="alert">${this.host._t("gs.optimize_vacuum_warning",{n:String(e.nestedRefsUnresolved)})}</div>`:a}
          ${x.length?o`<details class="optimize-details">
                <summary>${this.host._t("gs.optimize_details")}</summary>
                <ul>
                  ${S.map(t=>o`<li>${this.host._t("gs.optimize_detail_item",{status:w(t),kind:k(t.kind),id:t.id,space:t.spaceId})}</li>`)}
                </ul>
                ${M?o`<div class="rhint">${this.host._t("gs.optimize_details_more",{n:String(M)})}</div>`:a}
              </details>`:a}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>{this.host._alignDialog=null,this.host._preflightClipboardFallback=null}}>${this.host._t("btn.cancel")}</button>
          ${t.changed&&t.preflight?.ok?o`
            <button class="btn on" @click=${this._runAlignToGrid} ?disabled=${t.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this.host._t("gs.align_run")}
            </button>`:a}
        </div>
    </hp-dialog>`}_renderSettingsDialog(){return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("gs.title")} icon="mdi:cog-outline" wide
      @hp-close=${()=>this.host._settingsDialog=null}>
        <div class="body">
          <div class="rhint">${this.host._t("gs.hint")}</div>
          <label class="dispsection">${this.host._t("gs.light_group")}</label>
          ${this._renderColorRow("light_on","gs.light_on")}
          ${this._renderColorRow("light_off","gs.light_off")}
          ${this._renderColorRow("light_none","gs.light_none")}
          <label class="dispsection">${this.host._t("gs.temp_group")}</label>
          ${this._renderColorRow("temp_cold","gs.temp_cold")}
          ${this._renderColorRow("temp_ok","gs.temp_ok")}
          ${this._renderColorRow("temp_hot","gs.temp_hot")}
          <label class="dispsection">${this.host._t("gs.lqi_group")}</label>
          ${this._renderColorRow("lqi_low","gs.lqi_low")}
          ${this._renderColorRow("lqi_high","gs.lqi_high")}
          <label class="dispsection">${this.host._t("gs.glow_group")}</label>
          ${this._renderColorRow("glow_base","gs.glow_base")}
          ${this._renderColorRow("glow_light","gs.glow_light")}
          <div class="colorrow gsrow">
            <span class="gsl">${this.host._t("gs.glow_radius")}</span>
            <input type="number" class="tempin" min="0.5" step="0.5"
              .value=${String(this.host._settingsDialog.glowRadius)}
              @input=${t=>{const e=sl(t.target.value);null!=e&&e>0&&(this.host._settingsDialog={...this.host._settingsDialog,glowRadius:e})}} />
            <span class="opl">${this.host._imperial?this.host._t("gs.unit_ft"):this.host._t("gs.unit_m")}</span>
          </div>
          <label class="dispsection">${this.host._t("gs.wall_group")}</label>
          ${this._renderColorRow("wall_fill","gs.wall_fill")}
          <label class="dispsection">${this.host._t("gs.bg_group")}</label>
          <div class="colorrow gsrow">
            <span class="gsl">${this.host._t("gs.bg_mode")}</span>
            <select class="areasel"
              @change=${t=>this.host._settingsDialog={...this.host._settingsDialog,bgMode:"daynight"===t.target.value?"daynight":"static"}}>
              <option value="static" ?selected=${"static"===this.host._settingsDialog.bgMode}>${this.host._t("gs.bg_static")}</option>
              <option value="daynight" ?selected=${"daynight"===this.host._settingsDialog.bgMode}>${this.host._t("gs.bg_daynight")}</option>
            </select>
          </div>
          ${"static"===this.host._settingsDialog.bgMode?o`<div class="colorrow gsrow">
                <hp-color-opacity .label=${this.host._t("gs.bg_color")}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${this.host._settingsDialog.bgColor||this.host._stageBgHex()}
                  .opacity=${1} .showOpacity=${!1}
                  @hp-color-opacity-change=${t=>{this.host._settingsDialog={...this.host._settingsDialog,bgColor:t.detail.color}}}></hp-color-opacity>
                ${this.host._settingsDialog.bgColor?o`<button class="btn ghost" @click=${()=>this.host._settingsDialog={...this.host._settingsDialog,bgColor:null}}>${this.host._t("gs.bg_default")}</button>`:o`<span class="opl">${this.host._t("gs.bg_theme")}</span>`}
              </div>`:o`<div class="rhint">${this.host._t("gs.bg_daynight_hint")}</div>`}
          <label class="dispsection">${this.host._t("gs.sun_group")}</label>
          ${Ms(this.host.hass)?a:o`<div class="rhint">${this.host._t("gs.sun_missing")}</div>`}
          <div class="sunrow">
            ${this.host._renderCompass()}
            <div class="suncol">
              <span class="gsl">${this.host._t("gs.north")}</span>
              <div class="colorrow">
                <input class="namein tempin" type="number" min="0" max="359" step="1"
                  placeholder=${this.host._t("gs.north_ph")}
                  .value=${null===this.host._settingsDialog.northDeg?"":String(this.host._settingsDialog.northDeg)}
                  @input=${t=>{const e=t.target.value.trim(),s=""===e?null:Math.round(Number(e));this.host._settingsDialog={...this.host._settingsDialog,northDeg:null!==s&&Number.isFinite(s)?Math.min(359,Math.max(0,s)):null}}} />
                ${null!==this.host._settingsDialog.northDeg?o`<button class="btn ghost" @click=${()=>this.host._settingsDialog={...this.host._settingsDialog,northDeg:null}}>${this.host._t("gs.north_clear")}</button>`:a}
              </div>
              ${null===this.host._settingsDialog.northDeg?o`<div class="rhint">${this.host._t("gs.north_hint")}</div>`:a}
            </div>
          </div>
          <label class="srcrow">
            ${this._boolInput(this.host._settingsDialog.sunRays,t=>this.host._settingsDialog={...this.host._settingsDialog,sunRays:t})}
            <span>${this.host._t("gs.sun_rays")}</span>
          </label>
          ${this.host._canEdit?o`
            <label class="dispsection">${this.host._t("gs.backup_group")}</label>
            <div class="rhint">${this.host._t("gs.backup_hint")}</div>
            <div class="backupactions">
              <button class="btn ghost" @click=${this._openBackupExport}>
                <ha-icon icon="mdi:download"></ha-icon>${this.host._t("backup.export_open")}
              </button>
              <span class="backupupload">
                <button class="btn ghost" type="button" @click=${t=>t.currentTarget.nextElementSibling?.click()}>
                  <ha-icon icon="mdi:upload"></ha-icon>${this.host._t("backup.import_open")}
                </button>
                <input type="file" accept="application/json,.json" @change=${this._pickBackupImport} />
              </span>
              ${this.host._canOptimizeUndo&&"import"===this.host._undoKind?o`
                <button class="btn ghost" @click=${this._undoPlanOptimization}
                  ?disabled=${this.host._optimizeUndoBusy}>
                  <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t("backup.undo_import")}
                </button>`:a}
            </div>`:a}
          <label class="dispsection">${this.host._t("gs.grid_group")}</label>
          <div class="rhint">${this.host._t("gs.grid_hint")}</div>
          <div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._openAlignDialog}>
              <ha-icon icon="mdi:broom"></ha-icon>${this.host._t("gs.align_all")}
            </button>
          </div>
          ${this.host._canOptimizeUndo&&"import"!==this.host._undoKind?o`<div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._undoPlanOptimization}
              ?disabled=${this.host._optimizeUndoBusy}>
              <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t("gs.optimize_undo")}
            </button>
          </div>`:a}
          <label class="dispsection">${this.host._t("gs.about_group")}</label>
          <div class="aboutver">${this.host._t("gs.about_version",{v:Xr})}</div>
          <a class="aboutlink" href="https://github.com/Matysh/houseplan-card" target="_blank" rel="noopener">
            <ha-icon icon="mdi:github"></ha-icon>${this.host._t("gs.about_github")}</a>
          <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener">
            <ha-icon icon="mdi:send"></ha-icon>${this.host._t("gs.about_telegram")}</a>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this.host._settingsDialog={...this.host._settingsDialog,colors:JSON.parse(JSON.stringify(xs)),glowRadius:this.host._imperial?9.8:3,bgColor:null,northDeg:null,bgMode:"daynight",sunRays:!1}}>
            ${this.host._t("gs.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this.host._settingsDialog=null}>${this.host._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSettingsDialog} ?disabled=${this.host._settingsDialog.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this.host._settingsDialog.busy?"…":this.host._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_rulesSet(t){this.host._rulesDialog={...this.host._rulesDialog,rules:t}}async _saveRules(){const t=this.host._rulesDialog;if(!t||t.busy)return;const e=t.rules.filter(t=>t.pattern.trim()&&t.icon.trim());this.host._rulesDialog={...t,busy:!0};try{const t=this.host._serverCfg,s=JSON.stringify(e)===JSON.stringify(Ct),i={...t.settings};s?delete i.icon_rules:i.icon_rules=e,this.host._serverCfg={...t,settings:i},await this._saveConfigNow(),this.host._rulesDialog=null,this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._showToast(this.host._t("rules.saved"))}catch(t){this.host._rulesDialog&&(this.host._rulesDialog={...this.host._rulesDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}_renderRulesDialog(){const t=this.host._rulesDialog,e=Ds(t.rules),s=t.test.trim()?Cs(t.test,"",e):null,i=(e,s)=>{const i=[...t.rules],o=e+s;o<0||o>=i.length||([i[e],i[o]]=[i[o],i[e]],this._rulesSet(i))};return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("rules.title")}
      icon="mdi:shape-plus-outline" wide @hp-close=${()=>this.host._rulesDialog=null}>
        <div class="body">
          <div class="rhint">${this.host._t("rules.hint")}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this.host._t("rules.test_ph")}
              .value=${t.test}
              @input=${e=>this.host._rulesDialog={...t,test:e.target.value}} />
            ${s?o`<ha-icon icon=${s}></ha-icon><span class="rtesticon">${s}</span>`:a}
          </div>
          ${t.rules.map((e,s)=>{const a=""!==e.pattern.trim()&&!Ps(e.pattern);return o`<div class="rrow">
              <input class="namein rpat ${a?"bad":""}" type="text"
                placeholder=${this.host._t("rules.pattern_ph")}
                title=${a?this.host._t("rules.invalid"):""}
                .value=${e.pattern}
                @input=${i=>{const o=[...t.rules];o[s]={...e,pattern:i.target.value},this._rulesSet(o)}} />
              <input class="namein ricon" type="text" placeholder=${this.host._t("rules.icon_ph")}
                .value=${e.icon}
                @input=${i=>{const o=[...t.rules];o[s]={...e,icon:i.target.value},this._rulesSet(o)}} />
              <ha-icon class="rprev" icon=${e.icon||"mdi:chip"}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-up" title=${this.host._t("btn.up")}
                @click=${()=>i(s,-1)}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-down" title=${this.host._t("btn.down")}
                @click=${()=>i(s,1)}></ha-icon>
              <ha-icon class="ract del" icon="mdi:close" title=${this.host._t("btn.delete")}
                @click=${()=>this._rulesSet(t.rules.filter((t,e)=>e!==s))}></ha-icon>
            </div>`})}
          <button class="btn ghost" @click=${()=>this._rulesSet([...t.rules,{pattern:"",icon:""}])}>
            <ha-icon icon="mdi:plus"></ha-icon>${this.host._t("rules.add")}
          </button>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this._rulesSet(Ct.map(t=>({...t})))}>
            ${this.host._t("rules.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this.host._rulesDialog=null}>${this.host._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveRules} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this.host._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_saveKioskScale(t){this.host._kioskScale={...this.host._kioskScale,...t};try{localStorage.setItem("houseplan_card_kiosk_v1",JSON.stringify(this.host._kioskScale))}catch{}this.host.requestUpdate()}_renderKioskDialog(){const t=this.host._kioskScale,e=(e,s)=>o`<label>${s}</label>
      <div class="colorrow">
        ${this._rangeInput(50,300,5,Math.round(100*t[e]),t=>this._saveKioskScale({[e]:t/100}))}
        <span class="opv">${Math.round(100*t[e])}%</span>
      </div>`;return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("kiosk.title")} icon="mdi:tablet"
      dismiss-on-scrim @hp-close=${()=>this.host._kioskDialog=!1}>
        <div class="body">
          <div class="rhint">${this.host._t("kiosk.hint")}</div>
          ${e("icon",this.host._t("kiosk.icon_scale"))}
          ${e("font",this.host._t("kiosk.font_scale"))}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this._saveKioskScale({icon:1,font:1})}>${this.host._t("gs.reset")}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this.host._kioskDialog=!1}>${this.host._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_renderVacSection(t){const e=this.host._devices.find(e=>e.id===t.devId);if(!e||!this.host._isVacDev(e))return a;const s=e.marker?.vacuum||{},i=this.host._vacAllCamerasFor===e.id,n=this.host._vacSourceResolution(e,i),r=n.entityId,l=n.candidates.find(t=>t.entityId===r)||null,h=r?Is(this.host.hass?.states[r]?.attributes):null,c=!1!==s.live&&("ok"===n.status||"unsupported"===n.status),d=this._vacPlanRoomAnchors(e.space),p=h?Ts(h.rooms,d.map(t=>t.name)):0,_=!!(c&&h&&p>=3),u=Object.keys(s.calibration||{}),m=t=>{const s=this.host._vacEnsureMarker(e);s&&(s.vacuum={...s.vacuum||{},...t},this.host._regSignature="",this.host._maybeRebuildDevices(),this._saveConfig(),this.host.requestUpdate())},g=new Set(e.entities||[]),f=n.candidates.filter(t=>g.has(t.entityId)||t.entityId===s.source),b=i?n.candidates.filter(t=>t.entityId.startsWith("camera.")&&!f.some(e=>e.entityId===t.entityId)):[],y=t=>[t.hasPosition?this.host._t("vac.cap_position"):"",t.hasRooms?this.host._t("vac.cap_rooms_short"):"",t.hasPath?this.host._t("vac.cap_path"):"",t.hasMapId?this.host._t("vac.cap_map"):""].filter(Boolean).join(" · ")||this.host._t("vac.cap_none"),v=t=>o`
      <button type="button" class="vacsource ${t.entityId===r?"on":""}"
        @click=${()=>m({source:t.entityId})}>
        <span><b>${t.name}</b><small>${t.entityId}</small></span>
        <span class="vacsource-meta">${t.platform||this.host._t("vac.platform_unknown")} · ${y(t)}</span>
      </button>`,$=n.candidates.some(t=>g.has(t.entityId)&&"known_xcme_incomplete"===t.category)||!!n.pinned&&!!r?.startsWith("camera.")&&!l?.hasPosition;return o`
      <label>${this.host._t("vac.section")}</label>
      <div class="bindbox vacbox">
        <div class="vacdiag" role="status">
          <div><span>${this.host._t("vac.diag_source")}</span><b>${r||this.host._t("vac.source_none")}</b></div>
          ${l?.platform?o`<div><span>${this.host._t("vac.diag_platform")}</span><b>${l.platform}</b></div>`:a}
          <div><span>${this.host._t("vac.diag_status")}</span><b>${this.host._t(`vac.source_status_${n.status}`)}</b></div>
          <div><span>${this.host._t("vac.diag_position")}</span><b>${h?.pos?this.host._t("common.yes"):this.host._t("common.no")}</b></div>
          <div><span>${this.host._t("vac.diag_rooms")}</span><b>${Rs(this.host._t("vac.diag_rooms_value"),{total:String(h?.rooms.length||0),matched:String(p),readiness:this.host._t(p>=3?"vac.autocal_ready":"vac.autocal_not_ready")})}</b></div>
          <div><span>${this.host._t("vac.diag_path")}</span><b>${h?.path.length?this.host._t("common.yes"):this.host._t("common.no")}</b></div>
          <div><span>${this.host._t("vac.diag_map")}</span><b>${h?.mapId??"default"}</b></div>
        </div>
        ${"missing"===n.status||"disabled"===n.status||"unverified"===n.status?o`<div class="warn vacsource-warning">
              <span>${this.host._t(`vac.source_banner_${n.status}`)}</span>
              <button type="button" class="btn ghostbtn" @click=${()=>{const t=[...this.host.renderRoot.querySelectorAll("details.vacpicker")].find(t=>t.dataset.devId===e.id);t&&(t.open=!0,t.querySelector("summary")?.focus())}}>${this.host._t("vac.choose_source")}</button>
            </div>`:a}
        ${$?o`<div class="warn vacxcme">
          <b>${this.host._t("vac.xcme_hint")}</b>
          <pre>attributes:
  - vacuum_position
  - rooms
  - path
  - map_name</pre>
        </div>`:a}
        <details class="vacpicker" data-dev-id=${e.id}>
          <summary class="btn ghostbtn">${this.host._t("vac.choose_source")}</summary>
          <div class="vacsource-list">
            <button type="button" class="vacsource ${n.pinned?"":"on"}"
              @click=${()=>m({source:null})}>
              <span><b>${this.host._t("vac.source_auto")}</b><small>${this.host._t("vac.source_auto_hint")}</small></span>
            </button>
            ${f.map(v)}
            <details ?open=${i}
              @toggle=${t=>{t.currentTarget.open?this.host._vacOpenAllCameras(e):(this.host._vacAllCamerasFor=null,this.host._vacAllCameraCache=null)}}>
              <summary>${this.host._t("vac.all_cameras")}</summary>
              <div class="rhint">${this.host._t("vac.all_cameras_warn")}</div>
              ${i?b.length?b.map(v):o`<div class="rhint">${this.host._t("vac.all_cameras_empty")}</div>`:a}
            </details>
          </div>
        </details>
        <div class="vacbtns">
          ${_?o`<button class="btn" @click=${()=>this._vacAutoCalibrate(e)}>${this.host._t("vac.autocal")}</button>`:a}
          ${c?o`<button class="btn ghostbtn" @click=${()=>this._vacStartFit(e)}>${this.host._t("vac.fit")}</button>`:a}
          <a class="btn ghostbtn" href="https://github.com/Matysh/houseplan-card/blob/main/docs/VACUUM.md"
            target="_blank" rel="noopener">${this.host._t("vac.documentation")}</a>
        </div>
        ${h?o`
          <label class="srcrow">
            ${this._boolInput(!1!==s.live,t=>m({live:!!t&&null}))}
            <span>${this.host._t("vac.live")}</span>
          </label>
          <label>${this.host._t("vac.trail")}</label>
          <select class="areasel"
            @change=${t=>m({trail_mode:t.target.value,trail:null})}>
            ${["never","cleaning","always"].map(t=>o`
              <option value=${t} ?selected=${Fs(s)===t}>${this.host._t("vac.trail_"+t)}</option>`)}
          </select>
          ${u.length?o`<div class="rhint">${Rs(this.host._t("vac.cal_maps"),{maps:u.join(", ")})}</div>`:a}
        `:a}
      </div>`}_vacMapId(t,e,s=this.host._planHass){const i=this.host._vacEntity(t),o=i?s?.states?.[i]?.attributes?.selected_map:null;return Ns(e.mapId,o)}_vacSaveMatrix(t,e,s,i){const o=this.host._devices.find(e=>e.id===t),a=o?this.host._vacEnsureMarker(o):this.host._serverCfg?.markers?.find(e=>e.id===t);if(!a)return!1;const n={...a.vacuum||{}};return n.source=e,n.calibration={...n.calibration||{},[s]:i.map(t=>Number(t.toFixed(6)))},a.vacuum=n,this.host._regSignature="",this.host._maybeRebuildDevices(),this._saveConfig(),this.host.requestUpdate(),!0}_vacPlanRoomAnchors(t){return(this.host._spaceModelById(t)?.rooms||[]).map(t=>({room:t,poly:R(t)})).filter(({room:t,poly:e})=>t.name&&e).map(({room:t,poly:e})=>{const s=zs(e);return s?{name:String(t.name),cx:s[0],cy:s[1]}:null}).filter(Boolean)}_vacAutoCalibrate(t){const e=this.host._vacSource(t),s=e?Is(this.host.hass?.states[e]?.attributes):null;if(!e||!s||s.rooms.length<3)return void this.host._showToast(this.host._t("vac.autocal_no_rooms"));const i=this._vacPlanRoomAnchors(t.space),o=As(s.rooms,i);if(!o)return void this.host._showToast(this.host._t("vac.autocal_no_match"));const a=this.host._serverCfg?.spaces?.find(e=>e.id===t.space),n=Number(a?.cell_cm),r=Number.isFinite(n)&&n>0?n:5,l=Os(o.residual,this.host._gridPitch,r),h=this._vacMapId(t,s);l>Ls?this.host._vacCalConfirm={markerId:t.id,source:e,mapId:h,matrix:o.matrix,rooms:o.matched.length,error:ee(l,"mi"===this.host.hass?.config?.unit_system?.length)}:this._vacSaveMatrix(t.id,e,h,o.matrix)&&this.host._showToast(Rs(this.host._t("vac.autocal_done"),{rooms:String(o.matched.length)}))}_vacApplyCalibrationProposal(t){const e=this.host._vacCalConfirm;if(e){if(this.host._vacCalConfirm=null,t){const t=this.host._devices.find(t=>t.id===e.markerId),s=Es(e.matrix);if(!t||!s)return;if(this.host._markerDialog=null,t.space!==this.host._space&&!this.host._commitSpace(t.space))return;return void(this.host._vacFit={markerId:e.markerId,source:e.source,mapId:e.mapId,p:s,drag:null})}this._vacSaveMatrix(e.markerId,e.source,e.mapId,e.matrix)&&this.host._showToast(Rs(this.host._t("vac.autocal_done"),{rooms:String(e.rooms)}))}}_vacStartFit(t){const e=this.host._vacSource(t),s=e?Is(this.host.hass?.states[e]?.attributes):null;if(!e||!s)return void this.host._showToast(this.host._t("vac.cal_need_pos"));const i=this._vacMapId(t,s),o=t.marker?.vacuum?.calibration?.[i],a=this.host._spaceModelById(t.space);if(!a)return;const n=a.vb,r=o&&6===o.length&&Es(o)||Bs(s.rooms,n);this.host._markerDialog=null,(t.space===this.host._space||this.host._commitSpace(t.space))&&(this.host._vacFit={markerId:t.id,source:e,mapId:i,p:r,drag:null})}_vacFitSave(){const t=this.host._vacFit;if(!t)return;const e=this._vacSaveMatrix(t.markerId,t.source,t.mapId,Hs(t.p));this.host._vacFit=null,e&&this.host._showToast(this.host._t("vac.cal_done"))}_vacFitTurn(t){const e=this.host._vacFit;if(!e)return;const s=Is(this.host.hass?.states[e.source]?.attributes),i=this._vacGhostCentre(s?.rooms||[]),o={...e.p,...t};this.host._vacFit={...e,p:Gs(o,e.p,i[0],i[1])}}_vacGhostCentre(t){const e=[],s=[];for(const i of t)e.push(i.x0??i.cx,i.x1??i.cx),s.push(i.y0??i.cy,i.y1??i.cy);return e.length?[(Math.min(...e)+Math.max(...e))/2,(Math.min(...s)+Math.max(...s))/2]:[0,0]}_vacDelta(t,e,s){const i=this.host._stageEl,o=i?.clientWidth||1,a=i?.clientHeight||1;return[e/o*t.w,s/a*t.h]}_vacFitPointer(t,e){const s=this.host._vacFit;if(!s)return;if(t.stopPropagation(),"pointerdown"===t.type){const e=t.target,i=e.getAttribute?.("data-corner");try{t.currentTarget.setPointerCapture?.(t.pointerId)}catch{}return void(this.host._vacFit={...s,drag:i?{kind:"scale",sx:t.clientX,sy:t.clientY,p0:{...s.p},fx:Number(i.split(",")[0]),fy:Number(i.split(",")[1])}:{kind:"move",sx:t.clientX,sy:t.clientY,p0:{...s.p},fx:0,fy:0}})}const i=s.drag;if(i){if("pointermove"===t.type){const[o,a]=this._vacDelta(e,t.clientX-i.sx,t.clientY-i.sy);if("move"===i.kind)this.host._vacFit={...s,p:{...i.p0,ox:i.p0.ox+o,oy:i.p0.oy+a}};else{const t=Is(this.host.hass?.states[s.source]?.attributes),e=this._vacGhostCentre(t?.rooms||[]),n=Hs(i.p0),[r,l]=Ws(n,e[0],e[1]),[h,c]=Ws(n,i.fx,i.fy),d=Math.hypot(r-h,l-c)||1,[p,_]=[2*r-h,2*l-c],u=Math.hypot(p+2*o-h,_+2*a-c)/2,m=Math.max(.05,u/d),g={...i.p0,s:i.p0.s*m};this.host._vacFit={...s,p:Gs(g,i.p0,i.fx,i.fy)}}return}"pointerup"!==t.type&&"pointercancel"!==t.type||(this.host._vacFit={...s,drag:null})}}_renderVacFit(t){const e=this.host._vacFit;if(!e)return a;const s=Is(this.host._renderPlanHass?.states?.[e.source]?.attributes);if(!s)return a;const i=Hs(e.p),n=[],r=[],l=[];for(const t of s.rooms){if(null==t.x0)continue;const e=[[t.x0,t.y0],[t.x1,t.y0],[t.x1,t.y1],[t.x0,t.y1]].map(([t,e])=>Ws(i,t,e));e.forEach(([t,e])=>{r.push(t),l.push(e)});const[s,o]=Ws(i,t.cx,t.cy);n.push(ce`<polygon points="${e.map(t=>t[0].toFixed(1)+","+t[1].toFixed(1)).join(" ")}"></polygon>
        <text x="${s.toFixed(1)}" y="${o.toFixed(1)}">${t.name}</text>`)}let h=a;if(s.pos){const[e,o]=Ws(i,s.pos.x,s.pos.y);h=ce`<circle class="vacfitdot" cx="${e.toFixed(1)}" cy="${o.toFixed(1)}" r="${(.012*t.w).toFixed(1)}"></circle>`}const c=[];if(r.length){const e=(()=>{const t=i[0]*i[4]-i[1]*i[3];return(e,s)=>[(i[4]*(e-i[2])-i[1]*(s-i[5]))/t,(-i[3]*(e-i[2])+i[0]*(s-i[5]))/t]})(),s=Math.min(...r),o=Math.max(...r),a=Math.min(...l),n=Math.max(...l),h=.022*t.w,d=h/4;for(const[t,i,r,l]of[[s,a,o,n],[o,a,s,n],[o,n,s,a],[s,n,o,a]]){const s=e(r,l);c.push(ce`<circle class="vacfithandle" data-corner="${s[0]+","+s[1]}"
          cx="${t.toFixed(1)}" cy="${i.toFixed(1)}" r="${h.toFixed(1)}"></circle>
          <circle class="vacfitknob" cx="${t.toFixed(1)}" cy="${i.toFixed(1)}" r="${d.toFixed(2)}"></circle>`)}}return o`<svg class="vacfit" viewBox="${t.x} ${t.y} ${t.w} ${t.h}"
        preserveAspectRatio="none"
        @pointerdown=${e=>this._vacFitPointer(e,t)}
        @pointermove=${e=>this._vacFitPointer(e,t)}
        @pointerup=${e=>this._vacFitPointer(e,t)}
        @pointercancel=${e=>this._vacFitPointer(e,t)}>${n}${h}${c}</svg>`}_resetRoomDialogFields(){this.host._roomEditId=null,this.host._roomFill="",this.host._roomCustomFill=null,this.host._roomTempSrc="",this.host._roomHumSrc="",this.host._roomSrcOpen=null,this.host._roomSrcFilter="",this.host._roomNameScale=1,this.host._roomLabelScale=1}_openRoomEdit(t){if(!t.id)return;this.host._roomEditId=t.id,this.host._nameSel=t.name||"",this.host._areaSel=t.area||"",this.host._roomFill="glow"===t.settings?.fill_mode?"":t.settings?.fill_mode||"";const e=t.settings?.custom_fill;this.host._roomCustomFill=e&&"object"==typeof e?_s(e,ps(this.host._curSpaceCfg).customFill):null,this.host._roomTempSrc=t.settings?.temp_source||"",this.host._roomHumSrc=t.settings?.hum_source||"",this.host._roomNameScale=js(t.settings?.name_scale),this.host._roomLabelScale=js(t.settings?.label_scale),this.host._roomSrcOpen=null,this.host._roomSrcFilter="",this.host._roomDialog=!0}_roomSettingsFromDialog(){const t={};return this.host._roomFill&&(t.fill_mode=this.host._roomFill),this.host._roomCustomFill&&(t.custom_fill=this.host._roomCustomFill),this.host._roomTempSrc&&(t.temp_source=this.host._roomTempSrc),this.host._roomHumSrc&&(t.hum_source=this.host._roomHumSrc),1!==this.host._roomNameScale&&(t.name_scale=this.host._roomNameScale),1!==this.host._roomLabelScale&&(t.label_scale=this.host._roomLabelScale),Object.keys(t).length?t:null}_saveRoomEdit(){const t=this.host._curSpaceCfg,e=t?.rooms.find(t=>t.id===this.host._roomEditId);if(!e)return this.host._roomDialog=!1,void(this.host._roomEditId=null);e.name=this.host._nameSel.trim()||e.name,e.area=this.host._areaSel||null;const s=e.settings||{},i={...s};this.host._roomFill?i.fill_mode=this.host._roomFill:delete i.fill_mode,this.host._roomCustomFill?i.custom_fill=this.host._roomCustomFill:delete i.custom_fill,"glow"===s.fill_mode&&"boolean"!=typeof s.glow&&(i.glow=!0),this.host._roomTempSrc?i.temp_source=this.host._roomTempSrc:delete i.temp_source,this.host._roomHumSrc?i.hum_source=this.host._roomHumSrc:delete i.hum_source,1!==this.host._roomNameScale?i.name_scale=this.host._roomNameScale:delete i.name_scale,1!==this.host._roomLabelScale?i.label_scale=this.host._roomLabelScale:delete i.label_scale,Object.keys(i).length?e.settings=i:delete e.settings,this._saveConfig(),this.host._roomDialog=!1,this.host._roomEditId=null,this.host._nameSel="",this.host._areaSel="",this.host._regSignature="",this.host._maybeRebuildDevices(),this.host.requestUpdate(),this.host._showToast(this.host._t("toast.room_updated"))}_roomSrcCandidates(){const t=this.host._planHass,e=x(this.host._markers),s=this.host._roomSrcFilter.trim().toLowerCase(),i=[];for(const o of Object.values(t.devices)){if("service"===o.entry_type)continue;if(e.devices.has(o.id))continue;const t=(o.name_by_user||o.name||o.id).trim();s&&!t.toLowerCase().includes(s)||i.push({value:"device:"+o.id,label:t,sub:o.model||this.host._t("marker.sub_device")})}for(const[o,a]of Object.entries(t.entities)){if(!o.startsWith("sensor.")||a.hidden)continue;if(S(t,o,e))continue;const n=a.name||t.states[o]?.attributes?.friendly_name||o;s&&!(n+" "+o).toLowerCase().includes(s)||i.push({value:"entity:"+o,label:n,sub:o})}return i.sort((t,e)=>t.label.localeCompare(e.label)),i.slice(0,200)}_roomSrcLabel(t){const e=t.indexOf(":"),s=t.slice(0,e),i=t.slice(e+1);return"device"===s?this.host._fullRegistryHass.devices[i]?.name_by_user||this.host._fullRegistryHass.devices[i]?.name||i:this.host._fullRegistryHass.entities[i]?.name||this.host.hass.states[i]?.attributes?.friendly_name||i}_labelPos(t,e){const s=this.host._layout["rl_"+(t.id||"")];if(s&&s.s===e)return{x:s.x*ol,y:s.y*ol};const i=this._snap(this.host._roomCenter(t));return{x:i[0],y:i[1]}}_labelDown(t,e,s){if("plan"!==this.host._mode)return;t.preventDefault(),t.stopPropagation();const i=this._labelPos(e,s);this.host._drag={id:"rl_"+(e.id||""),sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},nl(t),this.host._tip=null}_labelMove(t,e,s){const i="rl_"+(e.id||"");if(!this.host._drag||this.host._drag.id!==i)return;const o=this.host._stageEl;if(!o)return;const a=this.host._spaceModelById(s);if(!a)return;const n=a.vb,r=o.getBoundingClientRect(),l=this.host._viewOr(n),h=(t.clientX-this.host._drag.sx)/r.width*l.w,c=(t.clientY-this.host._drag.sy)/r.height*l.h;Math.abs(t.clientX-this.host._drag.sx)+Math.abs(t.clientY-this.host._drag.sy)>3&&(this.host._drag.moved=!0);const d=Rt(this.host._drag.ox+h),p=Rt(this.host._drag.oy+c);this.host._savePos({id:i,space:s},d,p)}_labelUp(t){const e="rl_"+(t.id||"");if(!this.host._drag||this.host._drag.id!==e)return;const s=this.host._drag.moved;this.host._drag=s?this.host._drag:null,s&&window.setTimeout(()=>this.host._drag=null,0)}_labelScale(t){const e=this.host._layout["rl_"+(t.id||"")]?.k;return"number"==typeof e&&Number.isFinite(e)?Math.min(3,Math.max(.5,e)):1}_rlResizeDown(t,e,s){if("plan"!==this.host._mode)return;t.preventDefault(),t.stopPropagation();const i=t.target.closest(".roomlabel");if(!i)return;const o=i.getBoundingClientRect(),a=o.left+o.width/2,n=o.top+o.height/2,r=Math.max(8,Math.hypot(t.clientX-a,t.clientY-n));this.host._rlResize={id:"rl_"+(e.id||""),space:s,k0:this._labelScale(e),cx:a,cy:n,d0:r},nl(t)}_rlResizeMove(t){const e=this.host._rlResize;if(!e)return;t.stopPropagation();const s=Math.max(8,Math.hypot(t.clientX-e.cx,t.clientY-e.cy)),i=Math.min(3,Math.max(.5,e.k0*(s/e.d0))),o=this.host._layout[e.id];if(o)this.host._layout={...this.host._layout,[e.id]:{...o,k:i}};else{const t=e.id.slice(3),s=this.host._spaceModelById(e.space);if(!s)return;const o=s.rooms.find(e=>e.id===t);if(!o)return;const a=this._labelPos(o,e.space);this.host._layout={...this.host._layout,[e.id]:{s:e.space,x:a.x/ol,y:a.y/ol,k:i}}}this.host._dirtyPos.add(e.id)}_rlResizeUp(){this.host._rlResize&&(this.host._rlResize=null,this.host._persistLayout())}_renderRoomGear(t,e,s){if(!t.id)return a;let i=null;if(t.poly?(i=this.host._gearPtCache.get(t.poly)||null,i||(i=re(t.poly),this.host._gearPtCache.set(t.poly,i))):null!=t.x&&null!=t.y&&(i=[t.x+(t.w||0)/2,t.y+(t.h||0)/2]),!i)return a;const n=(i[0]-s.x)/s.w*100,r=(i[1]-s.y)/s.h*100;return o`<button class="rlgearbtn" data-hp="room-settings" data-room=${t.id}
      style="left:${n}%;top:${r}%"
      title=${this.host._t("room.settings_title")}
      @pointerdown=${t=>t.stopPropagation()}
      @click=${e=>{e.stopPropagation(),this._openRoomEdit(t)}}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
      <span class="rlgeartext">${this.host._t("room.settings_short")}</span>
    </button>`}_alignCandidates(){const t=[],e=this.host._spaceModel();if(this.host._markup){if(!e)return t;if(this.host._drag?.id.startsWith("rl_")){const s=this.host._drag.id.slice(3);for(const i of e.rooms){if(!i.name||i.id===s)continue;const e=this._labelPos(i,this.host._space);t.push([e.x,e.y])}return t}for(const s of e.rooms){const e=R(s);if(e)for(const s of e)t.push(s)}if("draw"===this.host._tool)for(const e of this.host._path)t.push(e);if("split"===this.host._tool&&this.host._splitSel?.pts)for(const e of this.host._splitSel.pts)t.push(e);return t}if("devices"===this.host._mode){for(const e of this.host._devices){if(e.space!==this.host._space||e.id===this.host._drag?.id||"ha_disabled"===e.bindingStatus?.kind)continue;const s=this.host._pos(e);t.push([s.x,s.y])}return t}if("decor"===this.host._mode){const e=this.host._decorMove?.id;return t.push(...this._decorSnapGeometry(e).points),this.host._decorDraft&&t.push(this.host._decorDraft.a),t}return t}_renderAlignGuides(){const t=this.host._alignPoint;if(!t)return ce``;const e=this.host._drag?.id.startsWith("rl_")?.5*this.host._gridPitch:.05*this.host._gridPitch,s=qs(t,this._alignCandidates(),e);if(!s.length)return ce``;const i=this.host._gridPitch,o=1.5*i;return ce`<g class="alignguides">
      ${s.map(e=>{const[s,a,n,r]="x"===e.axis?[e.at,e.from[1],e.at,t[1]+Math.sign(t[1]-e.from[1])*o]:[e.from[0],e.at,t[0]+Math.sign(t[0]-e.from[0])*o,e.at];return ce`<line class="alignline" x1="${s}" y1="${a}" x2="${n}" y2="${r}"></line>
          <circle class="aligndot" cx="${e.from[0]}" cy="${e.from[1]}"
            r="${ze(.18*i,this.host._cellCm)}"></circle>`})}
    </g>`}_renderOpeningCenterTick(t){const e=(t.angle+90)*Math.PI/180,s=ze(15,this.host._cellCm);return ce`<line class="alignline opcentertick"
      x1="${t.x-Math.cos(e)*s}" y1="${t.y-Math.sin(e)*s}"
      x2="${t.x+Math.cos(e)*s}" y2="${t.y+Math.sin(e)*s}"></line>`}_renderOpeningDimensionGuides(t){const e=t.labels.flatMap(t=>t.dimension?[t.dimension]:[]);if(!e.length)return ce``;const s=this._cssPxToRender(4);return ce`<g class="opening-dimensions" aria-hidden="true" pointer-events="none">
      ${e.map(t=>{const e=-t.axis[1],i=t.axis[0],o=(t,o)=>ce`<line
          class="opening-dimension-tick" data-end=${o}
          x1=${t[0]-e*s} y1=${t[1]-i*s}
          x2=${t[0]+e*s} y2=${t[1]+i*s}></line>`;return ce`<g class="opening-dimension" data-source=${t.source}
          data-room=${t.roomId||a}>
          <line class="opening-dimension-line"
            x1=${t.from[0]} y1=${t.from[1]}
            x2=${t.to[0]} y2=${t.to[1]}></line>
          ${o(t.from,"from")}${o(t.to,"to")}
        </g>`})}
    </g>`}_renderOpeningPlacementPreview(){const t=this.host._openingPreview;if(!t)return ce``;const e={type:t.type,length:t.renderedLength,angle:t.angle,amount:Us(t.type,null),flipH:t.flipH,flipV:t.flipV,base:"var(--hp-open)",tone:"var(--hp-open)",cellCm:this.host._cellCm,gridPitch:this.host._gridPitch,face:t.face},s="passage"===t.type?Ks(t,ze(this.host._gridPitch,this.host._cellCm)):null;return ce`<g class="opening-preview" data-kind=${t.type}
      aria-hidden="true" pointer-events="none"
      transform="translate(${t.x} ${t.y}) rotate(${t.angle})">
      ${s?ce`
        <rect class="passage-preview-cut" pointer-events="none"
          x=${s.rect.x} y=${s.rect.y}
          width=${s.rect.width} height=${s.rect.height}></rect>
        ${s.boundaries.map(t=>ce`
          <line class="passage-preview-boundary" pointer-events="none"
            x1=${t.x1} y1=${t.y1}
            x2=${t.x2} y2=${t.y2}></line>`)}
      `:Vs(e)}
    </g>
    <circle class="opening-preview-dot opghost-dot" aria-hidden="true" pointer-events="none"
      cx=${t.x} cy=${t.y}
      r=${ze(.18*this.host._gridPitch,this.host._cellCm)}></circle>`}_renderOpeningDialog(){const t=this.host._openingDialog,e=this.host._spaceModel()?.partitions||[],s=t.id?this.host._curSpaceCfg?.openings?.find(e=>e.id===t.id):null,i={id:t.id||"preview",type:t.type,x:t.x/ol,y:t.y/this.host._spaceH,angle:t.angle,length:s&&!t.lengthTouched?s.length:this.host._cmToUnits(Math.max(20,t.lengthCm))/ol,...t.host?{host:t.host}:{}},n=qe(s,i),r=t.host?n?H(i,e,ol,this.host._cellCm,this.host._gridPitch):F(i,e,ol,this.host._cellCm,this.host._gridPitch):null,l="does-not-fit-jamb"===r?.reason,h=t.host?e.find(e=>e.id===t.host.id):null,c=h?ee(h.cm/2,this.host._imperial):"",d=!!t.host&&!r?.resolved&&!l,p="gate"===t.type?"mdi:gate":"window"===t.type?"mdi:window-closed-variant":"passage"===t.type?"mdi:arch":"mdi:door",_=(e,s)=>{const i="contact"===e?t.contact:t.lock,n="contact"===e?!!t.contactOpen:!!t.lockOpen,r="contact"===e?t.contactFilter||"":t.lockFilter||"",l=s.find(t=>t.value===i),h=l?.label||this.host.hass.states[i]?.attributes?.friendly_name||this.host._fullRegistryHass.entities[i]?.name||i,c=Ii(s,r);return o`
        <button type="button" class="dropbtn opening-entity-drop ${n?"open":""}"
          data-opening-picker=${e} aria-expanded=${n?"true":"false"}
          @click=${()=>this._toggleOpeningEntityPicker(e)}>
          ${i?o`<b>${h}</b><span class="ref">${i}</span>`:o`<span class="muted">${this.host._t("opening.none")}</span>`}
          <ha-icon icon=${n?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
        </button>
        ${n?o`<div class="droppanel opening-entity-panel" data-opening-panel=${e}>
              <input class="namein opening-entity-search" type="text"
                placeholder=${this.host._t("opening.search_ph")} .value=${r}
                @input=${t=>this._filterOpeningEntities(e,t.target.value)} />
              <div class="candlist">
                <button type="button" class="cand opening-entity-candidate ${i?"":"sel"}"
                  data-opening-entity="" @click=${()=>this._selectOpeningEntity(e,"")}>
                  <span class="cl">${this.host._t("opening.none")}</span>
                </button>
                ${c.map(t=>o`
                  <button type="button"
                    class="cand opening-entity-candidate ${t.value===i?"sel":""}"
                    data-opening-entity=${t.value}
                    @click=${()=>this._selectOpeningEntity(e,t.value)}>
                    <span class="cl">${t.label}</span>
                    <span class="cs">${t.value}</span>
                  </button>`)}
                ${c.length?a:o`<div class="cand muted opening-entity-empty">${this.host._t("marker.nothing_found")}</div>`}
              </div>
            </div>`:a}`};return o`<hp-dialog .hass=${this.host.hass} wide
      .title=${t.id?this.host._t("opening.edit"):this.host._t("opening.new")} icon=${p}
      @hp-close=${()=>this.host._openingDialog=null}>
        <div class="body">
          ${t.host?o`<label>${this.host._t("opening.host_partition")}</label>
            <div class=${d||l?"habindingbanner":"rhint"}
              role=${d||l?"status":a}>
              ${d||l?o`<ha-icon icon="mdi:alert-outline"></ha-icon>`:a}
              <span>${d?this.host._t("opening.partition_orphan"):l?this.host._t("opening.partition_jamb_margin",{distance:c}):this.host._t("opening.host_partition")}</span>
            </div>`:a}
          <label>${this.host._t("opening.type_label")}</label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${"window"===t.type}
            @change=${()=>this.host._openingDialog={...t,type:"window",lengthCm:t.id?t.lengthCm:Js("window"),contactOpen:!1,lockOpen:!1}} />
            <span>${this.host._t("opening.window")}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${"door"===t.type}
            @change=${()=>this.host._openingDialog={...t,type:"door",lengthCm:t.id?t.lengthCm:Js("door"),contactOpen:!1,lockOpen:!1}} />
            <span>${this.host._t("opening.door")}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${"passage"===t.type}
            @change=${()=>this.host._openingDialog={...t,type:"passage",lengthCm:t.id?t.lengthCm:Js("passage"),contactOpen:!1,lockOpen:!1}} />
            <span>${this.host._t("opening.passage")}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${"gate"===t.type}
            @change=${()=>this.host._openingDialog={...t,type:"gate",lengthCm:t.id?t.lengthCm:Js("gate"),flipH:!1,contactOpen:!1,lockOpen:!1}} />
            <span>${this.host._t("opening.gate")}</span></label>

          <label>${this.host._t("opening.length_label")}</label>
          <input class="namein tempin" type="number" min="20" max="600" step="5" .value=${String(t.lengthCm)}
            @input=${e=>{const s=sl(e.target.value);null!=s&&(this.host._openingDialog={...t,lengthCm:s,lengthTouched:!0})}} />

          ${"passage"===t.type&&(t.contact||t.lock)?o`<div class="habindingbanner" role="status" aria-live="polite">
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                <span>${this.host._t("opening.passage_binding_warning")}</span>
              </div>`:a}

          ${"passage"!==t.type?o`<label>${this.host._t("opening.contact_label")}</label>
                ${_("contact",this._contactCandidates())}
                ${t.contact?o`<label class="srcrow">${this._boolInput(t.invert,e=>this.host._openingDialog={...t,invert:e})}
                      <span>${this.host._t("opening.invert")}</span></label>`:a}`:a}

          ${"door"===t.type||"gate"===t.type?o`<label>${this.host._t("opening.lock_label")}</label>
                ${_("lock",this._lockCandidates())}`:a}

          ${"gate"!==t.type&&"passage"!==t.type?o`<label class="srcrow">${this._boolInput(t.flipH,e=>this.host._openingDialog={...t,flipH:e})}
                <span>${this.host._t("opening.flip_h")}</span></label>`:a}
          ${"passage"!==t.type?o`<label class="srcrow">${this._boolInput(t.flipV,e=>this.host._openingDialog={...t,flipV:e})}
                <span>${this.host._t("opening.flip_v")}</span></label>`:a}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${t.id?o`<div class="dialog-action-group dialog-action-danger">
                <button class="btn danger" @click=${this._deleteOpening}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
                </button>
              </div>`:a}
          ${d?o`<button class="btn ghost" @click=${this._rebindPartitionOpening}>
                ${this.host._t("opening.rebind_partition")}
              </button>`:a}
          <div class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" @click=${()=>this.host._openingDialog=null}>${this.host._t("btn.cancel")}</button>
            <button class="btn on" @click=${this._saveOpening}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}_gridLevels(){const t=this.host._stageEl,e=this.host._viewOr(this.host._baseVb()),s=t&&t.clientWidth&&e.w?t.clientWidth/e.w:1;return Ys(this.host._gridPitch,s)}_renderMarkupDefs(t){const e=this._gridLevels();if(!e)return ce`<defs></defs>`;const s=this.host._gridPitch*e.fine,i=this.host._gridPitch*e.coarse,o=this.host._gridPitch*e.fine*.14;return ce`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${s}" height="${s}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${o}" class="griddot"></circle>
          <circle cx="${s}" cy="0" r="${o}" class="griddot"></circle>
          <circle cx="0" cy="${s}" r="${o}" class="griddot"></circle>
          <circle cx="${s}" cy="${s}" r="${o}" class="griddot"></circle>
        </pattern>
        <pattern id="hp-grid-major" x="0" y="0" width="${i}" height="${i}" patternUnits="userSpaceOnUse">
          <rect width="${i}" height="${i}" fill="url(#hp-grid)"></rect>
          <circle cx="0" cy="0" r="${2.1*o}" class="griddot major"></circle>
          <circle cx="${i}" cy="0" r="${2.1*o}" class="griddot major"></circle>
          <circle cx="0" cy="${i}" r="${2.1*o}" class="griddot major"></circle>
          <circle cx="${i}" cy="${i}" r="${2.1*o}" class="griddot major"></circle>
        </pattern>
      </defs>`}_renderPhysicalEditorLayer(){const t=this.host._spaceModel();if(!t)return ce``;const e=this.host._gridPitch,s=this.host._viewOr(this.host._baseVb()),i=this.host._stageEl,o=i?.clientWidth?s.w/i.clientWidth:e/8,n=Math.max(.22*e,8*o),r=Math.max(n,12*o),l=t=>`M ${t.map(t=>`${t[0]} ${t[1]}`).join(" L ")} Z`,h=(t,e)=>this.host._physicalSel?.kind===t&&this.host._physicalSel.id===e||"column"===t&&this.host._duplicateColumnId===e,c=(t.room_drafts||[]).flatMap(t=>t.points.slice(0,-1).map((e,s)=>{const i=t.points[s+1],a=Number(t.segments[s]?.cm),n=j(Number.isFinite(a)?a:15,this.host._cellCm,this.host._gridPitch);return ce`<line class="physical-hit ${h("draft",t.id)?"selected":""}"
        data-hp="room-draft" data-kind="segment" data-id=${t.id} data-segment=${s}
        x1=${e[0]} y1=${e[1]} x2=${i[0]} y2=${i[1]}
        stroke-width=${Math.max(24,n/Math.max(o,1e-9))}
        vector-effect="non-scaling-stroke"
        @pointerdown=${e=>{this.host._physicalSel={kind:"draft",id:t.id,segment:s},this._registerPhysicalTap("draft",t.id,s)}}></line>`})),d=(t.partitions||[]).map(t=>{const e=Yt(t.a,t.b,t.cm,this.host._cellCm,this.host._gridPitch);return e?ce`<path class="physical-hit ${h("partition",t.id)?"selected":""}"
            data-hp="partition" data-kind="partition" data-id=${t.id} d=${l(e)}
            stroke-width=${24} vector-effect="non-scaling-stroke"
            @pointerdown=${e=>this._physicalDown(e,"partition",t.id)}
            @pointermove=${t=>this._physicalMove(t)}
            @pointerup=${t=>this._physicalUp(t)}></path>`:ce`<line class="physical-hit ${h("partition",t.id)?"selected":""}"
            data-hp="partition" data-kind="partition" data-id=${t.id}
            x1=${t.a[0]} y1=${t.a[1]} x2=${t.b[0]} y2=${t.b[1]}
            stroke-width=${24} vector-effect="non-scaling-stroke"
            @pointerdown=${e=>this._physicalDown(e,"partition",t.id)}
            @pointermove=${t=>this._physicalMove(t)}
            @pointerup=${t=>this._physicalUp(t)}></line>`}),p=(t.wall_columns||[]).map(t=>{const e=this.host._physicalRotate?.id===t.id?{...t,angle:this.host._physicalRotate.angle}:t,s=Jt(e,this.host._cellCm,this.host._gridPitch);return ce`<path class="physical-hit ${h("column",t.id)?"selected":""}"
        data-hp="wall-column" data-kind=${t.shape} data-id=${t.id} d=${l(s)}
        stroke-width=${24} vector-effect="non-scaling-stroke"
        @pointerdown=${e=>this._physicalDown(e,"column",t.id)}
        @pointermove=${t=>this._physicalMove(t)}
        @pointerup=${t=>this._physicalUp(t)}></path>`}),_=this.host._physicalDrag,u=(()=>{if(!_?.moved)return a;if("partition"===_.kind&&0===Number(_.base.cm)){const t=_.base;return ce`<line class="physical-drag zero"
          x1=${t.a[0]} y1=${t.a[1]}
          x2=${t.b[0]} y2=${t.b[1]}
          transform="translate(${_.delta[0]} ${_.delta[1]})"></line>`}const t="partition"===_.kind?Yt(_.base.a,_.base.b,_.base.cm,this.host._cellCm,this.host._gridPitch):Jt(_.base,this.host._cellCm,this.host._gridPitch);return t?ce`<path class="physical-drag" d=${l(t)}
        transform="translate(${_.delta[0]} ${_.delta[1]})"></path>`:a})(),m=(()=>{const s=this.host._physicalSel;if(!s)return a;if("draft"===s.kind){const e=t.room_drafts.find(t=>t.id===s.id);return e?ce`<g class="physical-chrome" data-kind="draft-selection">
          <polyline class="frame" points=${e.points.map(t=>t.join(",")).join(" ")}></polyline>
          ${e.points.map(t=>ce`<circle class="move-dot" cx=${t[0]} cy=${t[1]} r=${.55*n}></circle>`)}
        </g>`:a}if("partition"===s.kind){const e=t.partitions.find(t=>t.id===s.id);if(!e)return a;const i=Yt(e.a,e.b,e.cm,this.host._cellCm,this.host._gridPitch),o=(e.a[0]+e.b[0])/2,r=(e.a[1]+e.b[1])/2;return ce`<g class="physical-chrome" data-kind="partition-selection">
          ${i?ce`<path class="frame" d=${l(i)}></path>`:ce`<line class="frame" x1=${e.a[0]} y1=${e.a[1]}
                x2=${e.b[0]} y2=${e.b[1]}></line>`}
          <circle class="move-dot" cx=${e.a[0]} cy=${e.a[1]} r=${.55*n}></circle>
          <circle class="move-dot" cx=${e.b[0]} cy=${e.b[1]} r=${.55*n}></circle>
          <circle class="move-dot" cx=${o} cy=${r} r=${n}></circle>
        </g>`}const i=t.wall_columns.find(t=>t.id===s.id);if(!i)return a;const h=this.host._physicalRotate?.id===i.id?{...i,angle:this.host._physicalRotate.angle}:i,c=Jt(h,this.host._cellCm,this.host._gridPitch);if("square"!==h.shape)return ce`<g class="physical-chrome" data-kind="circle-selection">
        <path class="frame" d=${l(c)}></path>
        <circle class="move-dot" cx=${h.center[0]} cy=${h.center[1]} r=${n}></circle>
      </g>`;const d=j(h.cm,this.host._cellCm,this.host._gridPitch),p=At(h.angle)*Math.PI/180,_=Math.sin(p),u=-Math.cos(p),m=[h.center[0]+_*d/2,h.center[1]+u*d/2],g=[m[0]+_*Math.max(e,24*o),m[1]+u*Math.max(e,24*o)];return ce`<g class="physical-chrome" data-kind="square-selection">
        <path class="frame" d=${l(c)}></path>
        <circle class="move-dot" cx=${h.center[0]} cy=${h.center[1]} r=${n}></circle>
        <line class="stem" x1=${m[0]} y1=${m[1]} x2=${g[0]} y2=${g[1]}></line>
        <circle class="rotate-handle" cx=${g[0]} cy=${g[1]} r=${r}
          data-kind="rotate" @pointerdown=${t=>this._physicalRotateDown(t,i)}
          @pointermove=${t=>this._physicalRotateMove(t)}
          @pointerup=${t=>this._physicalRotateUp(t)}></circle>
      </g>`})();return ce`<g class="physical-editor">${c}${d}${p}${u}${m}</g>`}_renderHiddenWallDiagnosticOverlay(){if(!this.host._markup)return ce``;const t=this._hiddenWallDiagnosticSnapshot().value;if(!t.segments.length)return ce``;const e=j(5,this.host._cellCm,this.host._gridPitch);return ce`<g class="hidden-wall-diagnostic" data-hp="hidden-wall-diagnostic"
      data-segment-count=${t.segments.length}
      data-endpoint-count=${t.endpoints.length}
      aria-hidden="true" pointer-events="none">
      ${t.segments.map(t=>ce`<line class="hidden-wall-line"
        data-key=${t.key} data-source-kind=${t.sourceKind}
        data-source-id=${t.sourceId}
        x1=${t.a[0]} y1=${t.a[1]} x2=${t.b[0]} y2=${t.b[1]}
        vector-effect="non-scaling-stroke" pointer-events="none"></line>`)}
      ${t.endpoints.map(t=>ce`<circle class="hidden-wall-node"
        data-key=${t.key} data-source-kind=${t.sourceKind}
        data-source-id=${t.sourceId}
        cx=${t.point[0]} cy=${t.point[1]} r=${e}
        pointer-events="none"></circle>`)}
    </g>`}_renderPlanSnapOverlay(){if(!this.host._markup)return ce``;const t=this._planSnapGeometrySnapshot().value,e=this.host._activePlanSnapCandidate,s=new Set(this.host._activePlanSnapConflicts.map(t=>t.key)),i=j(5,this.host._cellCm,this.host._gridPitch),o=j(10,this.host._cellCm,this.host._gridPitch);return ce`<g class="plan-snap-overlay" data-hp="plan-snap-overlay"
      data-segment-count=${t.segments.length}
      data-endpoint-count=${t.endpoints.length}
      aria-hidden="true" pointer-events="none">
      ${Li([t,i,[...s].sort().join("|")],()=>ce`
        ${t.segments.map(t=>ce`<line class="plan-snap-line"
          data-key=${t.key} data-source-kind=${t.sourceKind}
          x1=${t.a[0]} y1=${t.a[1]} x2=${t.b[0]} y2=${t.b[1]}
          vector-effect="non-scaling-stroke" pointer-events="none"></line>`)}
        ${t.endpoints.map(t=>ce`<circle class="plan-snap-node ${s.has(t.key)?"conflict":""}"
          data-kind="endpoint" data-key=${t.key} data-active="false"
          cx=${t.point[0]} cy=${t.point[1]} r=${i}
          pointer-events="none"></circle>`)}
      `)}
      <circle class="plan-snap-node ${e?"active":""} ${"line"===e?.kind?"dynamic":""}"
        data-hp="plan-snap-active-marker"
        data-kind=${e?.kind??a} data-key=${e?.key??a}
        data-active=${e?"true":"false"}
        cx=${e?.point[0]??0} cy=${e?.point[1]??0} r=${o}
        visibility=${e?"visible":"hidden"} pointer-events="none"></circle>
    </g>`}_syncPlanSnapActiveMarker(t){const e=this.host.renderRoot?.querySelector('[data-hp="plan-snap-active-marker"]');if(e){if(e.setAttribute("class",`plan-snap-node${t?" active":""}${"line"===t?.kind?" dynamic":""}`),e.setAttribute("data-active",t?"true":"false"),e.setAttribute("visibility",t?"visible":"hidden"),!t)return e.removeAttribute("data-kind"),void e.removeAttribute("data-key");e.setAttribute("data-kind",t.kind),e.setAttribute("data-key",t.key),e.setAttribute("cx",String(t.point[0])),e.setAttribute("cy",String(t.point[1])),e.setAttribute("r",String(j(10,this.host._cellCm,this.host._gridPitch)))}}_syncPlanSnapConflictMarkers(t){const e=new Set(t.map(t=>t.key));for(const t of this.host.renderRoot?.querySelectorAll('.plan-snap-node[data-kind="endpoint"]')||[])t.setAttribute("class","plan-snap-node"+(e.has(t.dataset.key||"")?" conflict":""))}_planSnapPhysicalSegment(t){let e=0;const s=this.host._spaceModel();if(!s)return null;if("partition"===t.sourceKind)e=Number(s.partitions.find(e=>e.id===t.sourceId)?.cm)||0;else if("draft"===t.sourceKind){const i=/^(.*):(\d+)$/.exec(t.sourceId),o=i?s.room_drafts.find(t=>t.id===i[1]):null;e=o&&i&&Number(o.segments[Number(i[2])]?.cm)||0}else e=Xs(s.rooms,this.host._spaceWalls,this.host._openCuts(),[t.a[0],t.a[1],t.b[0],t.b[1]],this.host._wallKeyPitch,this.host._cellCm,this.host._gridPitch,ol);return e>0?{a:[...t.a],b:[...t.b],halfDepth:j(e,this.host._cellCm,this.host._gridPitch)/2}:null}_drawPreviewJoinPatchD(t,e){if(t.length<2)return"";const s=[];for(let i=0;i+1<t.length;i++)e[i]>0&&s.push({a:t[i],b:t[i+1],halfDepth:e[i]});if(!s.length)return"";const i=2e-4*this.host._gridPitch,o=this._planSnapGeometrySnapshot().value.segments.filter(e=>t.some(t=>C(t,[e.a[0],e.a[1],e.b[0],e.b[1]])<=i)).map(t=>this._planSnapPhysicalSegment(t)).filter(t=>!!t);return Zs([...s,...o],i).map(t=>`M ${t.map(t=>`${t[0]} ${t[1]}`).join(" L ")} Z`).join(" ")}_renderMarkupLayer(t){const e=this.host._openCuts(),s=this.host._thickWallCuts(),i=e.concat(s),o=i.length?D(this.host._segments,i,.02*this.host._gridPitch):this.host._segments,n=this.host._path,r=this.host._gridPitch,l=this.host._viewOr(this.host._baseVb()),h="draw"===this.host._tool?this.host._drawWallCm:null,c=(()=>"draw"===this.host._tool&&n.length&&null!=h?this.host._contourClosed?n:this.host._cursorPt?[...n,this.host._cursorPt]:n.length>=2?n:null:null)(),d=c?Ra(c.length-1,this.host._contourClosed?[...this.host._draftSegmentCms,this.host._closingWallCm??void 0]:this.host._draftSegmentCms,h,A).map(t=>j(t,this.host._cellCm,this.host._gridPitch)/2):[],p=c?Qs(c,j(h,this.host._cellCm,this.host._gridPitch)/2,this.host._contourClosed,d):"",_=c?this._drawPreviewJoinPatchD(c,d):"",u=this.host._wallFaceBatch?.candidates[this.host._wallFaceBatch.index]?.repair||this.host._wallRepairDiagnostic;return ce`
      ${this._gridLevels()?ce`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:a}
      ${o.map(t=>ce`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${this._renderPhysicalEditorLayer()}
      ${"column"===this.host._tool&&this.host._cursorPt&&this.host._drawWallCm?ce`<path class="physical-drag" d=${(()=>{const t={shape:"square",center:this.host._cursorPt,cm:this.host._drawWallCm};return`M ${Jt(t,this.host._cellCm,this.host._gridPitch).map(t=>`${t[0]} ${t[1]}`).join(" L ")} Z`})()}></path>`:a}
      ${p?ce`<path class="drawwall-preview-fill" d="${p}"></path>
             <path class="drawwall-preview" d="${p}"></path>`:a}
      ${c&&0===h?ce`<polyline class="drawwall-zero-preview ${gs(this.host._curSpaceCfg)}"
            points=${c.map(t=>t.join(",")).join(" ")}></polyline>`:a}
      ${_?ce`<path class="drawwall-preview-fill" d="${_}"></path>
             <path class="drawwall-preview" style="stroke:none" d="${_}"></path>`:a}
      ${u?ce`<line class="wall-repair-preview"
        x1=${u.from[0]} y1=${u.from[1]}
        x2=${u.to[0]} y2=${u.to[1]}
        aria-hidden="true" pointer-events="none"></line>`:a}
      ${"split"===this.host._tool&&this.host._splitSel?.pts?.length?ce`${this.host._splitSel.pts.length>1?ce`<polyline class="pathline" points="${this.host._splitSel.pts.map(t=>t.join(",")).join(" ")}"></polyline>`:a}
            ${this.host._splitSel.pts.map((t,e)=>ce`<circle class="vertex ${0===e?"first":""}"
              cx="${t[0]}" cy="${t[1]}" r="${ze(.22*r,this.host._cellCm)}"></circle>`)}
            ${this.host._cursorPt?ce`<line class="preview" x1="${this.host._splitSel.pts[this.host._splitSel.pts.length-1][0]}" y1="${this.host._splitSel.pts[this.host._splitSel.pts.length-1][1]}"
                  x2="${this.host._cursorPt[0]}" y2="${this.host._cursorPt[1]}"></line>`:a}`:a}
    `}_renderActiveChainInk(){const t=this.host._path,e=this.host._gridPitch;return ce`
      ${t.length>1?ce`<polyline class="pathline" points="${t.map(t=>t.join(",")).join(" ")}"></polyline>`:a}
      ${t.length&&this.host._cursorPt&&"draw"===this.host._tool&&!this.host._contourClosed?ce`<line class="active-axis" x1="${t[t.length-1][0]}" y1="${t[t.length-1][1]}"
            x2="${this.host._cursorPt[0]}" y2="${this.host._cursorPt[1]}" aria-hidden="true"></line>
            ${this.host._activePlanSnapCandidate||this.host._activePlanSnapConflicts.length?a:ce`<circle class="active-vertex" cx="${this.host._cursorPt[0]}" cy="${this.host._cursorPt[1]}"
                  r="${ze(.22*e,this.host._cellCm)}" aria-hidden="true"></circle>`}`:a}
      ${t.map((t,s)=>ce`<circle class="vertex ${0===s?"first":""}"
        cx="${t[0]}" cy="${t[1]}" r="${ze(.22*e,this.host._cellCm)}"></circle>`)}
    `}_renderPartitionDeleteDialog(){const t=this.host._partitionDeleteDialog,e="mi"===this.host.hass?.config?.unit_system?.length;return o`<hp-dialog .hass=${this.host.hass}
      .title=${this.host._t("confirm.delete_partition_openings_title")}
      icon="mdi:wall" dismiss-on-scrim
      @hp-close=${()=>this.host._partitionDeleteDialog=null}>
      <div class="body">
        <p>${this.host._t("confirm.delete_partition_openings_body",{count:t.openings.length})}</p>
        <ul aria-label=${this.host._t("confirm.delete_partition_openings_title")}>
          ${t.openings.map(t=>o`<li>${this.host._t("confirm.delete_partition_openings_item",{type:this.host._t(`opening.${t.type}`),length:ee(t.length*ol/this.host._gridPitch*this.host._cellCm,e)})}</li>`)}
        </ul>
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" @click=${()=>this.host._partitionDeleteDialog=null}>
          ${this.host._t("btn.cancel")}
        </button>
        <span class="spacer"></span>
        <button class="btn danger" @click=${this._confirmPartitionDelete}>
          <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
        </button>
      </div>
    </hp-dialog>`}_renderRoomDeleteDialog(){const t=this.host._roomDeleteDialog;return o`<hp-dialog .hass=${this.host.hass}
      .title=${this.host._t("confirm.delete_room_title",{name:t.name})}
      icon="mdi:floor-plan" dismiss-on-scrim
      @hp-close=${()=>this.host._roomDeleteDialog=null}>
      <div class="body">
        <p>${this.host._t("confirm.delete_room_body")}</p>
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" @click=${()=>this.host._roomDeleteDialog=null}>
          ${this.host._t("btn.cancel")}
        </button>
        <span class="spacer"></span>
        <button class="btn" @click=${()=>this._confirmRoomDelete(!0)}>
          <ha-icon icon="mdi:wall"></ha-icon>${this.host._t("btn.delete_room_keep_walls")}
        </button>
        <button class="btn danger" @click=${()=>this._confirmRoomDelete(!1)}>
          <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete_room_with_walls")}
        </button>
      </div>
    </hp-dialog>`}_renderPhysicalDialog(){const t=this.host._physicalDialog,e="column"===t.kind;return o`<hp-dialog .hass=${this.host.hass} wide
      .title=${this.host._t(e?"physical.column_properties":"partition"===t.kind?"physical.partition_properties":"physical.draft_properties")}
      icon=${e?"mdi:vector-square":"mdi:wall"}
      @hp-close=${()=>this.host._physicalDialog=null}>
        <div class="body">
          ${e?o`<label>${this.host._t("physical.shape")}</label>
            <select class="areasel" @change=${e=>{const s=e.target.value;this.host._physicalDialog={...t,shape:s}}}>
              <option value="square" ?selected=${"square"===t.shape}>${this.host._t("physical.square")}</option>
              <option value="circle" ?selected=${"circle"===t.shape}>${this.host._t("physical.circle")}</option>
            </select>`:a}
          <label>${this.host._t(e?"circle"===t.shape?"physical.diameter":"physical.side":"wallthick.field")}</label>
          <div class="row"><input class="namein tempin" type="number"
            min=${Tt(e?1:0,this.host._imperial)}
            max=${Tt(e?150:100,this.host._imperial)} step="any" .value=${t.cm}
            @input=${e=>this.host._physicalDialog={...t,cm:e.target.value}} />
            <span class="opl">${this.host._t(this.host._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span></div>
          ${e&&"square"===t.shape?o`
            <label>${this.host._t("physical.rotation")}</label>
            <input class="namein tempin" type="number" min="0" max="89.999" step="5"
              .value=${t.angle||"0"}
              @input=${e=>this.host._physicalDialog={...t,angle:e.target.value}} />`:a}
          ${t.length?o`<div class="muted">${this.host._t("physical.length")}: ${t.length}</div>`:a}
        </div>
        <div class="row dialog-action-footer physicalfooter" slot="footer">
          <div class="dialog-action-group dialog-action-danger">
            ${"draft"===t.kind?o`
              <button class="btn danger" @click=${this._deleteDraftSegment}>
                <ha-icon icon="mdi:vector-line"></ha-icon>${this.host._t("physical.delete_segment")}
              </button>
              <button class="btn danger" @click=${this._deleteDraftWhole}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("physical.delete_draft")}
              </button>`:o`
              <button class="btn danger" @click=${this._deletePhysicalSelection}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
              </button>`}
          </div>
          <div class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" @click=${()=>this.host._physicalDialog=null}>${this.host._t("btn.cancel")}</button>
            <button class="btn on" @click=${this._savePhysicalDialog}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}_renderMarkupBar(){const t=this.host._geometryHistory.undoName,e=this.host._geometryHistory.redoName,s=t?this.host._t("history.undo_named",{name:t}):this.host._t("history.undo_empty"),i=e?this.host._t("history.redo_named",{name:e}):this.host._t("history.redo_empty");return o`<div class="editbar planbar">
      <div class="editbar-tools" tabindex="-1" ?inert=${this.host._modeTransitionBusy}>
        <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
        <span class="wallsgroup">
        <button class="btn ${"select"===this.host._tool?"on":""}"
          @click=${()=>this._activateMarkupTool("select")}
          title=${this.host._t("title.markup_select")}>
          <ha-icon icon="mdi:cursor-default-outline"></ha-icon>${this.host._t("markup.select")}
        </button>
        <button class="btn ${"draw"===this.host._tool?"on":""}"
          aria-pressed=${"draw"===this.host._tool?"true":"false"}
          @click=${()=>this._activateMarkupTool("draw")}
          title=${this.host._t("title.markup_add")}>
          <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this.host._t("markup.add")}
        </button>
        <button class="btn ${"column"===this.host._tool?"on":""}"
          @click=${()=>this._activateMarkupTool("column")}
          title=${this.host._t("title.markup_column")}>
          <ha-icon icon="mdi:vector-square"></ha-icon>${this.host._t("markup.column")}
        </button>
      </span>
      <button class="btn ${"merge"===this.host._tool?"on":""}"
        @click=${()=>this._activateMarkupTool("merge")}
        title=${this.host._t("title.markup_merge")}>
        <ha-icon icon="mdi:vector-union"></ha-icon>${this.host._t("markup.merge")}
      </button>
      <button class="btn ${"split"===this.host._tool?"on":""}"
        @click=${()=>this._activateMarkupTool("split")}
        title=${this.host._t("title.markup_split")}>
        <ha-icon icon="mdi:vector-polyline-remove"></ha-icon>${this.host._t("markup.split")}
      </button>
      <button class="btn ${"resize"===this.host._tool?"on":""}"
        @click=${()=>this._activateMarkupTool("resize")}
        title=${this.host._t("title.markup_resize")}>
        <ha-icon icon="mdi:arrow-expand-all"></ha-icon>${this.host._t("markup.resize")}
      </button>
      ${this.host._editorToolbarGroups.map(t=>this._renderEditorGroupLauncher(t))}
      <button class="btn ${"wallthick"===this.host._tool?"on":""}"
        @click=${()=>this._activateMarkupTool("wallthick")}
        title=${this.host._t("title.markup_wallthick")}>
        <ha-icon icon="mdi:wall"></ha-icon>${this.host._t("markup.wallthick")}
      </button>
      <button class="btn ${"delroom"===this.host._tool?"on":""}"
        @click=${()=>this._activateMarkupTool("delroom")}
        title=${this.host._t("title.markup_delroom")}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("markup.delete_room")}
      </button>
      <button class="btn ghost" @click=${this._undoGeometry}
        ?disabled=${!t}
        title=${s} aria-label=${s}>
        <ha-icon icon="mdi:undo-variant" aria-hidden="true"></ha-icon>
      </button>
      <button class="btn ghost" @click=${this._redoGeometry}
        ?disabled=${!e}
        title=${i} aria-label=${i}>
        <ha-icon icon="mdi:redo-variant" aria-hidden="true"></ha-icon>
      </button>
      </div>
      <div class="editbar-end">
        <button class="btn barclose" title=${this.host._t("title.close_editor")}
          data-editor-navigation="view"
          @click=${()=>this._setMode("view")}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    </div>`}_renderDevicesBar(){return o`<div class="editbar devbar">
      <div class="editbar-tools" tabindex="-1" ?inert=${this.host._modeTransitionBusy}>
        <ha-icon icon="mdi:tune-variant" class="warn"></ha-icon>
        <button class="btn ${this.host._showAll?"on":""}" @click=${this._openDeviceInbox}
          title=${this.host._t("device_inbox.title")}>
          <ha-icon icon="mdi:devices"></ha-icon>${this.host._t("device_inbox.button")}
        </button>
        <button class="btn" @click=${this._openRulesDialog} title=${this.host._t("title.icon_rules")}>
          <ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this.host._t("devbar.rules")}
        </button>
        ${this.host._editorToolbarGroups.map(t=>this._renderEditorGroupLauncher(t))}
      </div>
      <div class="editbar-end">
        <button class="btn barclose" title=${this.host._t("title.close_editor")}
          data-editor-navigation="view"
          @click=${()=>this._setMode("view")}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    </div>`}_renderDeviceInbox(){const t=this.host._deviceInbox,e=this._deviceInboxRows(),s=Object.fromEntries(["on_plan","available","hidden","readd"].map(t=>[t,e.filter(e=>e.category===t).length])),i=function(t,e,s,i=!1){const o=s.trim().toLocaleLowerCase();return t.filter(t=>t.category===e&&(!i||t.isNew)&&(!o||t.searchText.includes(o)))}(e,t.tab,t.search,"on_plan"===t.tab&&t.onlyNew),n=i.slice(0,t.limit),r=t=>this.host._t(`device_inbox.tab_${t}`),l=`device_inbox.empty_${t.tab}`;return o`<hp-dialog class="device-inbox-dialog" .hass=${this.host.hass}
      .title=${this.host._t("device_inbox.title")} icon="mdi:devices" wide
      @hp-close=${()=>this.host._deviceInbox=null}>
      <div class="device-inbox" ?inert=${!!t.busy}>
        <div class="device-inbox-head">
          <input class="device-inbox-search" type="search" autofocus
            placeholder=${this.host._t("device_inbox.search")} .value=${t.search}
            @input=${e=>this.host._deviceInbox={...t,search:e.target.value,limit:100}} />
          <button type="button" class="btn" @click=${()=>{this.host._deviceInboxReturn={...t},this.host._deviceInbox=null,this._openMarkerDialog(),this.host._markerDialog||this._closeMarkerDialog()}}>
            <ha-icon icon="mdi:map-marker-plus-outline"></ha-icon>
            ${this.host._t("device_inbox.add_virtual")}
          </button>
        </div>
        <div class="device-inbox-tabs" role="tablist" @keydown=${this._deviceInboxTabKey}>
          ${["on_plan","available","hidden","readd"].map(e=>o`
            <button type="button" role="tab" aria-selected=${t.tab===e?"true":"false"}
              class=${t.tab===e?"on":""}
              @click=${()=>this.host._deviceInbox={...t,tab:e,limit:100,onlyNew:!1}}>
              ${r(e)} <span>${s[e]}</span>
            </button>`)}
        </div>
        <div class="device-inbox-filters">
          ${"on_plan"===t.tab?o`<label>
            <input type="checkbox" .checked=${t.onlyNew}
              @change=${e=>this.host._deviceInbox={...t,onlyNew:e.target.checked,limit:100}} />${this.host._t("device_inbox.only_new")}
          </label>`:a}
          ${"available"===t.tab?o`<label>
            <input type="checkbox" .checked=${t.showEntities}
              @change=${e=>{this.host._deviceInboxMemo=null,this.host._deviceInbox={...t,showEntities:e.target.checked,limit:100}}} />${this.host._t("device_inbox.show_entities")}
          </label>`:a}
          <label>
            <input type="checkbox" .checked=${this.host._showAll}
              @change=${t=>{this.host._showHidden=t.target.checked,this.host._deviceInboxMemo=null,this.host.requestUpdate()}} />${this.host._t("device_inbox.show_hidden")}
          </label>
        </div>
        <div class="device-inbox-results" aria-live="polite">
          ${n.length?n.map(t=>{const e="on_plan"===t.category?t.canFind?o`<button type="button" class="btn" @click=${()=>this._findInboxDevice(t)}>
                  <ha-icon icon="mdi:crosshairs-gps"></ha-icon>${this.host._t("device_inbox.find")}</button>`:o`<button type="button" class="btn" @click=${()=>this._openInboxMarker(t)}
                    ?disabled=${!t.canEdit}>${this.host._t("device_inbox.edit")}</button>`:"hidden"===t.category?o`<button type="button" class="btn" @click=${()=>this._setInboxHidden(t,!1)}
                    title=${t.canShow?"":this.host._t("device_inbox.show_disabled")}
                    ?disabled=${!t.canShow}>${this.host._t("device_inbox.show")}</button>`:o`<button type="button" class="btn" @click=${()=>this._openInboxMarker(t,!0)}
                    ?disabled=${!t.canAdd}>${this.host._t("readd"===t.category?"device_inbox.readd":"device_inbox.add")}</button>`,s="active"===t.status.kind?"":this.host._t(`device_inbox.status_${t.status.kind}`);return o`<article class="device-inbox-row" data-binding=${t.binding}
              data-category=${t.category} data-status=${t.status.kind}>
              <ha-icon class="device-inbox-icon" .icon=${t.icon}></ha-icon>
              <div class="device-inbox-copy">
                <div class="device-inbox-name"><b>${t.name}</b>
                  ${t.isNew?o`<span class="device-inbox-new">${this.host._t("device_inbox.new")}</span>`:a}
                </div>
                <div class="device-inbox-meta">
                  ${[t.model,t.integration,t.spaceName,t.areaName].filter(Boolean).join(" · ")}
                </div>
                <div class="device-inbox-reason">
                  ${this.host._t(`device_inbox.reason_${t.reason}`)}
                  ${s?o`<span class="device-inbox-status">${s}</span>`:a}
                </div>
                <code>${t.binding}</code>
              </div>
              <div class="device-inbox-actions">
                ${e}
                ${t.canEdit||t.canHide||"available"===t.category||"hidden"===t.category||this.host._bindingHasHaPage(t.binding)?o`
                  <details class="device-inbox-menu">
                    <summary class="btn ghost" aria-label=${this.host._t("device_inbox.more_actions")}
                      title=${this.host._t("device_inbox.more_actions")}>
                      <ha-icon icon="mdi:dots-vertical"></ha-icon>
                    </summary>
                    <div class="device-inbox-menu-items">
                      ${t.canEdit&&("on_plan"!==t.category||t.canFind)?o`<button type="button" class="btn ghost" @click=${()=>this._openInboxMarker(t)}>
                            ${this.host._t("device_inbox.edit")}</button>`:a}
                      ${t.canHide?o`<button type="button" class="btn ghost"
                        @click=${()=>this._setInboxHidden(t,!0)}>${this.host._t("device_inbox.hide")}</button>`:a}
                      ${"available"===t.category?o`<button type="button" class="btn ghost"
                        @click=${()=>this._setInboxHidden(t,!0)}>${this.host._t("device_inbox.hide_available")}</button>`:a}
                      ${"hidden"===t.category?o`<button type="button" class="btn ghost"
                        title=${t.canFind?"":this.host._t("device_inbox.find_hidden_hint")}
                        ?disabled=${!t.canFind} @click=${()=>this._findInboxDevice(t)}>
                        <ha-icon icon="mdi:crosshairs-gps"></ha-icon>${this.host._t("device_inbox.find")}</button>`:a}
                      ${this.host._bindingHasHaPage(t.binding)?o`<button type="button" class="btn ghost"
                        @click=${()=>this.host._openBindingInHa(t.binding)}>${this.host._t("btn.open_in_ha")}</button>`:a}
                    </div>
                  </details>`:a}
              </div>
            </article>`}):o`<div class="device-inbox-empty">${this.host._t(l)}</div>`}
        </div>
        ${i.length>n.length?o`<button type="button" class="btn device-inbox-more"
          @click=${()=>this.host._deviceInbox={...t,limit:t.limit+100}}>
          ${this.host._t("device_inbox.show_more")} (${i.length-n.length})
        </button>`:a}
      </div>
      <div slot="footer" class="row">
        <button type="button" class="btn ghost" @click=${()=>this.host._deviceInbox=null}>
          ${this.host._t("btn.close")}</button>
      </div>
    </hp-dialog>`}_markerValueBadgeFields(t){return ti({touched:t.valueBadgeTouched,originalHas:t.originalHasValueBadge,original:t.originalValueBadge,enabled:t.valueBadgeEnabled,source:t.valueBadgeSource,position:t.valueBadgePosition})}_markerDraft(t){if("ha"===t.bindingMode&&(!t.binding||"virtual"===t.binding))return null;const e=ns(t.room),s=Ze(t.binding,t.devId,()=>"__hp_device_preview__"),i=this.host._markers.find(e=>e.id===s||e.id===t.devId),o=ss(t.binding,t.controls,this.host._bindingEntities(t.binding)),a=this._effectiveStoredTapAction(t),n={id:s,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,display:"badge"!==t.display?t.display:null,ripple_color:"icon_ripple"===t.display&&t.rippleColor?t.rippleColor:null,ripple_size:"icon_ripple"===t.display&&1.5!==t.rippleSize?t.rippleSize:null,size:1!==t.size?t.size:null,angle:t.angle||null,...this._markerTapActionFields(t),...this._markerToggleEntityFields(t),tap_target:"run"===a&&t.tapTarget||null,tap_confirm:!!t.tapConfirm||null,controls:o.length?o:null,...this._markerLightFields(t),...this._markerValueBadgeFields(t),use_climate_temp:!!t.useClimateTemp||null,glow_radius_cm:(()=>{const e=sl(t.glowRadius);return null==e||e<=0?null:Math.round(this.host._imperial?30.48*e:100*e)})(),model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs,hidden:t.hideFromPlan,vacuum:i?.vacuum||null};return("virtual"===t.binding||t.room)&&(n.space=e?.space||("virtual"===t.binding?this.host._space:null),n.area=e?.area||null,n.room_id=e?.roomId||null),n}_markerPreviewDevice(t){const e=this._markerDraft(t);if(!e)return null;const s=`${this.host._haRegistry.revision}\n${Et(this.host._markers)}\n${JSON.stringify(e)}`;if(this.host._markerPreviewMemo?.key===s)return this.host._markerPreviewMemo.device;const i=ei({hass:this.host.hass,registry:this.host._haRegistry,areaToSpace:Object.fromEntries(Object.entries(this.host._areaToSpace).map(([t,e])=>[t,e.space])),marker:e,siblingMarkers:this.host._markers,settings:this.host._settings,excluded:this.host._excluded,showAll:this.host._showAll,firstSpaceId:this.host._model[0]?.id||this.host._space,loc:t=>this.host._t(t),iconRules:this.host._iconRules});return this.host._markerPreviewMemo={key:s,device:i},i}_markerPreviewDevices(t){const e=this.host._markerPreviewDevicesMemo;if(e?.base===this.host._devices&&e.preview===t)return e.devices;const s=[...this.host._devices.filter(e=>e.id!==t.id),t];return this.host._markerPreviewDevicesMemo={base:this.host._devices,preview:t,devices:s},s}_toggleIntent(t,e=this.host._devices){return si({hass:this.host._planHass,registryHass:this.host._fullRegistryHass,devices:e,device:t,virtualLights:this.host._virtualLights})}_toggleIntentForDialog(t){const e=this._markerPreviewDevice(t);if(!e)return null;const s=this._markerPreviewDevices(e);return this._toggleIntent(e,s)}_toggleStateText(t,e){const s=this.host._planHass?.states?.[t]||this.host.hass?.states?.[t];try{return s&&"function"==typeof this.host.hass?.formatEntityState?this.host.hass.formatEntityState(s):e}catch{return e}}_toggleConfirmationStateText(t){const e=String(t.state||"unknown"),s=t.entityId?this._toggleStateText(t.entityId,e):e;if(s.trim().toLocaleLowerCase()!==e.trim().toLocaleLowerCase())return s;const i={on:"confirm.state_on",off:"confirm.state_off",open:"confirm.state_open",closed:"confirm.state_closed",opening:"confirm.state_opening",closing:"confirm.state_closing",unknown:"confirm.state_unknown"}[e];return i?this.host._t(i):e.replaceAll("_"," ").replaceAll("-"," ")}_toggleConfirmationLines(t){const e={"turn-on":"confirm.state_on","turn-off":"confirm.state_off",open:"confirm.state_open",close:"confirm.state_closed",stop:"confirm.state_stopped"};return ii(t,{state:t=>this._toggleConfirmationStateText(t),current:t=>this.host._t("confirm.current_state",{state:t}),expected:t=>this.host._t("confirm.expected_state",{state:t}),groupCurrent:(t,e)=>this.host._t("confirm.group_current",{on:t,total:e}),groupAllOn:()=>this.host._t("confirm.group_all_on"),groupAllOff:()=>this.host._t("confirm.group_all_off"),unavailable:t=>this.host._t("confirm.unavailable_targets",{count:t}),effect:t=>this.host._t(e[t]),expectedByHa:()=>this.host._t("confirm.expected_by_ha")})}_toggleHintLines(t){if(!t)return[];const e=t=>this.host._t(`marker.toggle_effect_${t.replace("-","_")}`),s=t=>this.host._t(`marker.toggle_skip_${t.replace("-","_")}`);return oi(t,{single:t=>{if("via"in t&&"virtual-light"===t.via)return this.host._t("marker.virtual_light_target",{name:t.name});const e=t.entityId||("ref"in t?t.ref:""),s=t.name||e;return this.host._t("marker.toggle_hint_single",{name:s,id:e})},group:t=>this.host._t("marker.toggle_hint_group",{count:t.length,names:t.map(t=>`${t.name} (${t.entityId})`).join(", ")}),currentNext:(t,s)=>"virtual-light"===t.via?this.host._t("marker.virtual_light_current",{state:this.host._t("on"===t.state?"marker.virtual_light_state_on":"marker.virtual_light_state_off"),effect:e(s)}):this.host._t("marker.toggle_hint_current",{state:this._toggleStateText(t.entityId,t.state),effect:e(s)}),groupCurrentNext:(t,s)=>this.host._t("marker.toggle_hint_group_current",{on:t.filter(t=>"on"===t.state).length,count:t.length,effect:e(s)}),skipped:t=>this.host._t("marker.toggle_hint_skipped",{count:t.length,targets:t.map(t=>{const e=t.entityId||t.ref;return`${t.name||e} (${e}: ${s(t.reason)})`}).join(", ")}),none:t=>this.host._t(`marker.toggle_none_${t.replaceAll("-","_")}`)})}_effectiveStoredTapAction(t,e){return t.tapActionTouched?t.tapAction:is(t.originalHasTapAction?t.originalTapAction:null,e)}_effectiveMarkerTapAction(t,e=this._markerPreviewDevice(t)){return this._effectiveStoredTapAction(t,e?.primary?.split(".")[0])}_announceToggleDraft(t){const e=this._markerPreviewDevice(t),s=t.tapActionTouched?t:{...t,tapAction:this._effectiveMarkerTapAction(t,e)},i="toggle"===s.tapAction?this._toggleHintLines(this._toggleIntentForDialog(s)).join(" "):"";return{...s,tapHintAnnouncement:i}}_valueBadgeForBinding(t,e){const s={...t,binding:e,valueBadgeEnabled:!1,valueBadgeSource:null,valueBadgeTouched:!0},i=this._markerPreviewDevice(s);if(!i)return{valueBadgeEnabled:!1,valueBadgeSource:null,valueBadgeTouched:!0};const o=[...this.host._devices.filter(t=>t.id!==i.id),i],a=ts(this.host._planHass,i,o),n=es(this.host._planHass,i,a);return{valueBadgeEnabled:t.valueBadgeEnabled&&!!n,valueBadgeSource:n,valueBadgeTouched:!0}}_markerSpatialSource(t){const e=this._markerPreviewDevice(t);if(!e)return null;const s={...e,hidden:!1};return ai(ni(this.host._planHass,[...this.host._devices.filter(t=>t.id!==s.id),s],null,this.host._virtualLights).filter(t=>t.device.id===s.id))}_markerAutoHasSpatialSource(t){const e={...t,lightRole:"auto",lightRoleTouched:!0},s=this._markerPreviewDevice(e);return!!s&&ri(this.host._planHass,{...s})}_setMarkerLightRole(t){const e=this.host._markerDialog;e&&(this.host._markerDialog={...e,lightRole:t,lightRoleTouched:!0})}_controlRefInfo(t){if(!t.startsWith("marker:"))return{label:this.host.hass.states[t]?.attributes?.friendly_name||t,sub:t,icon:t.startsWith("light.")?"mdi:lightbulb":"mdi:toggle-switch",warning:!this.host._planEntityAvailable(t)};const e=t.slice(7),s=this.host._markers.find(t=>t.id===e),i=this.host._devices.find(t=>t.id===e);if(!s||s.removed||!0!==s.is_light)return{label:this.host._t("marker.control_missing_label"),sub:`${this.host._t("marker.control_broken")} (${t})`,icon:"mdi:alert-outline",warning:!0};const o=this.host._serverCfg?.spaces.find(t=>t.id===(i?.space||s.space)),a=!!i&&li(i).length>0;return{label:s.name||i?.name||e,sub:[o?.title||i?.space||s.space,s.room_id||i?.area,a?"":this.host._t("marker.control_passive")].filter(Boolean).join(" · "),icon:s.icon||i?.icon||"mdi:lightbulb-outline",warning:!0===s.hidden||!0===i?.hidden}}_valueBadgeCandidateLabel(t){const e=t.source;if("derived_lqi"===e.kind)return this.host._t("marker.value_badge_lqi");if("derived_marker_state"===e.kind)return this.host._t("marker.value_badge_marker_state",{name:t.label});if("entity_state"===e.kind)return this.host._t("marker.value_badge_state",{name:t.label});const s=this.host.hass.states[e.entity_id]?.attributes?.friendly_name||this.host._fullRegistryHass.entities[e.entity_id]?.name||e.entity_id;return this.host._t(`marker.value_badge_attr_${e.attribute}`,{name:s})}_controlCandidates(t){const e=this._markerDraft(t)?.id||t.devId||"",s=[],i=new Set;for(const t of this.host._markers){if(t.id===e||t.removed||t.hidden||!0!==t.is_light)continue;if("virtual"!==t.binding&&"active"!==this.host._bindingStatus(t.binding).kind)continue;const o=this.host._devices.find(e=>e.id===t.id);if(!o||o.hidden)continue;const a=this._controlRefInfo(`marker:${t.id}`);for(const t of li(o))i.add(t);s.push({value:`marker:${t.id}`,label:a.label,sub:a.sub,icon:a.icon,search:`${a.label} ${a.sub} ${t.id} ${li(o).join(" ")}`.toLowerCase()})}const o=Object.keys(this.host.hass.states||{}).filter(e=>hi(e)&&!i.has(e)&&ci(t.binding,[e],this.host._bindingEntities(t.binding)).length>0&&this.host._planEntityAvailable(e)).map(t=>{const e=this._controlRefInfo(t);return{value:t,label:e.label,sub:t,icon:e.icon,search:`${e.label} ${t}`.toLowerCase()}}),a=t.controlsFilter.trim().toLowerCase();return[...s,...o].filter(e=>!t.controls.includes(e.value)&&(!a||e.search.includes(a))).slice(0,12).map(({search:t,...e})=>e)}_addControlRef(t,e){if(e.startsWith("marker:")){const s=this._markerDraft(t)?.id||t.devId||"";if(!s)return void this.host._showToast(this.host._t("toast.marker_binding_required"));const i=e.slice(7),o=this._markerDraft(t),a=o?[...this.host._markers.filter(t=>t.id!==s),o]:this.host._markers;if(di(a,s,i))return void this.host._showToast(this.host._t("toast.marker_control_cycle"))}this.host._markerDialog=this._announceToggleDraft({...t,controls:[...t.controls,e],controlsFilter:""})}_setMarkerGlowMode(t){const e=this.host._markerDialog;if(!e)return;if("auto"===t)return void(this.host._markerDialog={...e,glowMode:t,glowTouched:!0});const s=this._markerSpatialSource(e),i=pi(s?this.host._planHass.states[s.eid]:void 0,null,this.host._fillColors.glow_light.c),o=!e.glowColorDrafted,a="fixed"===t&&!e.glowBrightnessDrafted;this.host._markerDialog={...e,glowMode:t,glowColor:o?i.c:e.glowColor,glowBrightness:a?Math.max(1,Math.round(100*i.bri)):e.glowBrightness,glowColorDrafted:!0,glowBrightnessDrafted:e.glowBrightnessDrafted||"fixed"===t,glowTouched:!0}}_renderMarkerDialog(){const t=this.host._markerDialog,e="virtual"===t.bindingMode,s=this._bindingCandidates();this.host._bindingEntities(t.binding);const i=e?null:this.host._bindingStatus(t.binding),n=!e&&this.host._bindingHasHaPage(t.binding),r=this._markerPreviewDevice(t),l=this._effectiveMarkerTapAction(t,r),h=r?ps(this.host._serverCfg?.spaces.find(t=>t.id===r.space)):null,c=r?this._markerPreviewDevices(r):this.host._devices,d="toggle"===l&&r?this._toggleIntent(r,c):null,p=this._toggleHintLines(d),_=r?_i(this.host._planHass,r,{liveStates:!1!==this.host._config?.live_states,showTemperature:!1!==this.host._config?.show_temperature,showSignal:h?.showLqi??!1!==this.host._config?.show_signal,designPreview:!0,activityRuntime:this.host._activityRt.get(r.id),lightDevices:c,registryHass:this.host._fullRegistryHass,reducedMotion:this.host._reducedMotion}):null,u=r?ts(this.host._planHass,r,c):[],m=r?es(this.host._planHass,r,u):null,g=t.valueBadgeTouched?t.valueBadgeEnabled:!!_?.valueBadge,f=t.valueBadgeTouched?t.valueBadgeSource:_?.valueBadge?.source||t.valueBadgeSource,b=t.valueBadgeTouched?t.valueBadgePosition:_?.valueBadge?.position||t.valueBadgePosition,y=ui(f),v=!!f&&!u.some(t=>t.key===y),$=u.find(t=>t.key===y),w=_?.valueSource?_.valueSource.attribute?`attr:${_.valueSource.eid}:${_.valueSource.attribute}`:`state:${_.valueSource.eid}`:"",k=this._markerAutoHasSpatialSource(t),x=!!r&&mi(this.host._planHass,{...r}),S=gi(t.lightRole,k,x,t.glowMode),M=!S.sourceExists,D=!S.fromSourceEnabled,C=S.passive,P=S.effectiveMode,I="never"===t.lightRole?this.host._t("marker.glow_disabled_never"):"auto"!==t.lightRole||k?C?this.host._t("marker.glow_passive_hint"):this.host._t("marker.glow_disabled_no_entity"):this.host._t("marker.glow_disabled_auto"),T=r?li(r):[],R=r&&fi(r)||"",F=!!t.lightEntity&&!T.includes(t.lightEntity),N=r?bi(r):[],z=!!t.toggleEntity&&!N.includes(t.toggleEntity),A="toggle"===l?this._toggleIntentForDialog({...t,toggleEntity:"",toggleEntityTouched:!0}):null,O=A?[...A.targets,...A.skippedTargets].map(t=>t.entityId||("ref"in t?t.ref:"")).filter(Boolean).join(", "):"",L=(()=>{if(e)return null;const i=s.find(e=>e.value===t.binding);if(i)return i.label;const[o,a]=t.binding.split(":");return"device"===o?this.host._fullRegistryHass.devices[a]?.name_by_user||this.host._fullRegistryHass.devices[a]?.name||a:this.host._fullRegistryHass.entities[a]?.name||this.host.hass.states[a]?.attributes?.friendly_name||a})();return o`<hp-dialog .hass=${this.host.hass}
      .title=${t.devId?this.host._t("info.device_header"):this.host._t("marker.new_device")}
      icon="mdi:shape-plus" wide @hp-close=${this._closeMarkerDialog}>
        <div class="body">
          ${"ha_disabled"===i?.kind?o`<div class="habindingbanner" role="status">
                <ha-icon icon="mdi:power-plug-off-outline"></ha-icon>
                <span>${this.host._t(`marker.ha_disabled_${i.reason}`)}</span>
                ${n?o`<button class="btn ghost" type="button" @click=${()=>this.host._openBindingInHa(t.binding)}>
                      <ha-icon icon="mdi:open-in-new"></ha-icon>${this.host._t("btn.open_in_ha")}
                    </button>`:a}
              </div>`:"unverified"===i?.kind&&t.binding?o`<div class="habindingbanner limited" role="status">
                  <ha-icon icon="mdi:shield-alert-outline"></ha-icon>
                  <span>${this.host._t("marker.ha_registry_limited")}</span>
                </div>`:a}
          <label>${this.host._t("marker.name_label")}</label>
          <input class="namein" type="text" placeholder=${this.host._t("marker.name_ph")}
            .value=${t.name}
            @input=${e=>this.host._markerDialog={...t,name:e.target.value}} />

          <label>${this.host._t("marker.binding_label")}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${"virtual"===t.bindingMode}
                @change=${()=>{const e={...t,bindingMode:"virtual",binding:"virtual",bindingOpen:!1,controls:ss("virtual",t.controls),autoIcon:this.host._autoIconForBinding("virtual")};this.host._markerDialog=this._announceToggleDraft({...e,...this._valueBadgeForBinding(e,"virtual")})}} />
              <span>${this.host._t("marker.virtual_option")}</span>
            </label>
            <div class="bindharow">
              <label class="srcrow">
                <input type="radio" name="bmode" .checked=${"ha"===t.bindingMode}
                  @change=${()=>this.host._markerDialog=this._announceToggleDraft({...t,bindingMode:"ha",binding:"virtual"===t.binding?"":t.binding,bindingOpen:"virtual"===t.binding||!t.binding})} />
                <span>${this.host._t("marker.from_ha_option")}</span>
              </label>
              <label class="srcrow inline entcheck" title=${this.host._t("marker.show_entities_tip")}>
                ${this._boolInput(t.showEntities,e=>this.host._markerDialog={...t,showEntities:e},"ha"!==t.bindingMode)}
                <span>${this.host._t("marker.show_entities")}</span>
              </label>
            </div>
            ${"ha"===t.bindingMode?o`<button class="dropbtn ${t.bindingOpen?"open":""}"
                    @click=${()=>this.host._markerDialog={...t,bindingOpen:!t.bindingOpen}}>
                    ${L?o`<b>${L}</b><span class="ref">${t.binding}${"ha_disabled"===i?.kind?` · ${this.host._t("marker.binding_disabled")}`:""}</span>`:o`<span class="muted">${this.host._t("marker.pick_ph")}</span>`}
                    <ha-icon icon=${t.bindingOpen?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
                  </button>
                  ${t.bindingOpen?o`<div class="droppanel">
                        <input class="namein" type="text" placeholder=${this.host._t("marker.search_ph")}
                          .value=${t.bindingFilter}
                          @input=${e=>this.host._markerDialog={...t,bindingFilter:e.target.value}} />
                        <div class="candlist">
                          ${s.map(e=>o`<div class="cand ${e.value===t.binding?"sel":""}"
                              @click=${()=>{const s={...t,binding:e.value,bindingOpen:!1,controls:ss(e.value,t.controls,this.host._bindingEntities(e.value)),autoIcon:this.host._autoIconForBinding(e.value)};this.host._markerDialog=this._announceToggleDraft({...s,...this._valueBadgeForBinding(s,e.value)})}}>
                              <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                            </div>`)}
                          ${s.length?a:o`<div class="cand muted">${this.host._t("marker.nothing_found")}</div>`}
                        </div>
                      </div>`:a}`:a}
          </div>

          <label for="marker-room">${this.host._t("marker.room_label")}${e?"":this.host._t("marker.room_override")}</label>
          <select id="marker-room" class="areasel"
            @change=${e=>this.host._markerDialog={...t,room:e.target.value}}>
            <option value="" ?selected=${!t.room}>
              ${e?this.host._t("marker.room_choose"):this.host._t("marker.room_auto")}
            </option>
            ${this.host._allRoomsFlat().map(e=>o`<option value=${e.value} ?selected=${e.value===t.room}>${e.label}</option>`)}
          </select>

          ${this._renderVacSection(t)}

          <label>${this.host._t("marker.tap_label")}</label>
          <select id="marker-tap-action" class="areasel"
            aria-describedby=${"toggle"===l?"marker-toggle-hint":a}
            @change=${e=>{const s={...t,tapAction:e.target.value,tapActionTouched:!0};this.host._markerDialog=this._announceToggleDraft(s)}}>
            ${yi.map(t=>[t,"tap."+t.replace("-","_")]).map(([t,e])=>o`<option value=${t} ?selected=${t===l}>
                ${this.host._t(e)}
              </option>`)}
          </select>
          ${"toggle"===l&&(N.length>1||z)?o`<div class="markerhelpfield markertoggleentity">
                <div class="markerhelplabel">
                  <label for="marker-toggle-entity">${this.host._t("marker.toggle_entity_label")}</label>
                  ${this._help("marker.toggle_entity.help")}
                </div>
                <select id="marker-toggle-entity" class="areasel"
                  @change=${e=>{const s={...t,toggleEntity:e.target.value,toggleEntityTouched:!0};this.host._markerDialog=this._announceToggleDraft(s)}}>
                  <option value="" ?selected=${z||!t.toggleEntity}>
                    ${this.host._t("marker.toggle_entity_auto",{entity:O||this.host._t("marker.toggle_entity_none")})}
                  </option>
                  ${N.map(e=>o`<option value=${e}
                    ?selected=${!z&&e===t.toggleEntity}>
                    ${this.host.hass.states[e]?.attributes?.friendly_name||this.host._fullRegistryHass.entities[e]?.name||e} · ${e}
                  </option>`)}
                </select>
                ${z?o`<p class="muted markerlightwarning" role="status">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  ${this.host._t("marker.toggle_entity_missing",{entity:t.toggleEntity,fallback:O||this.host._t("marker.toggle_entity_none")})}
                </p>`:a}
              </div>`:a}
          ${"toggle"===l?o`<div id="marker-toggle-hint" class="rhint togglehint">
                ${p.map(t=>o`<div>${t}</div>`)}
              </div>
              <div class="sr-only" role="status" aria-live="polite">${t.tapHintAnnouncement}</div>`:a}
          ${"run"===l?(()=>{const e=t.runFilter.trim().toLowerCase(),s=this._runCandidates().filter(t=>!e||t.label.toLowerCase().includes(e)||t.value.includes(e)),i=t.tapTarget?this._runCandidates().find(e=>e.value===t.tapTarget):null;return o`
                  <label>${this.host._t("marker.run_target_label")}</label>
                  ${t.tapTarget&&!i?o`<div class="rhint">${this.host._t("marker.run_target_gone",{id:t.tapTarget})}</div>`:a}
                  <input class="namein" type="text" placeholder=${this.host._t("marker.run_search_ph")}
                    .value=${i?i.label:t.runFilter}
                    @focus=${t=>{t.target.select()}}
                    @input=${e=>this.host._markerDialog={...t,runFilter:e.target.value,tapTarget:""}} />
                  ${i?a:o`<div class="candlist">
                        ${s.slice(0,40).map(e=>o`<div class="cand ${e.value===t.tapTarget?"sel":""}"
                            @click=${()=>this.host._markerDialog={...t,tapTarget:e.value,runFilter:""}}>
                            <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                          </div>`)}
                        ${s.length?a:o`<div class="cand muted">${this.host._t("marker.nothing_found")}</div>`}
                      </div>`}`})():a}
          ${"run"===l||"toggle"===l?o`<label class="srcrow" title=${this.host._t("marker.tap_confirm_tip")}>
                ${this._boolInput(t.tapConfirm,e=>this.host._markerDialog={...t,tapConfirm:e})}
                <span>${this.host._t("marker.tap_confirm")}</span>
              </label>`:a}

          <label>${this.host._t("marker.controls_label")}</label>
          <div class="rhint">${this.host._t("marker.controls_hint")}</div>
          ${t.controls.length?o`<div class="ctrlchips">
                ${t.controls.map(e=>{const s=this._controlRefInfo(e);return o`<span class="ctrlchip ${s.warning?"warning":""}" title=${s.sub}>
                  <ha-icon icon=${s.icon}></ha-icon>${s.label}
                  <ha-icon icon="mdi:close" @click=${()=>this.host._markerDialog=this._announceToggleDraft({...t,controls:t.controls.filter(t=>t!==e)})}></ha-icon>
                </span>`})}
              </div>`:a}
          <input class="namein" type="text" placeholder=${this.host._t("marker.controls_filter")}
            .value=${t.controlsFilter}
            @input=${e=>this.host._markerDialog={...t,controlsFilter:e.target.value}} />
          ${t.controlsFilter.trim()?o`<div class="ctrllist">
                ${this._controlCandidates(t).map(e=>o`<button class="ctrlopt"
                    @click=${()=>this._addControlRef(t,e.value)}>
                    <ha-icon icon=${e.icon}></ha-icon>
                    ${e.label}
                    <span class="sub">${e.sub}</span>
                  </button>`)}
              </div>`:a}

          ${this.host._bindingHasClimate(t.binding)?o`<label class="srcrow climrow" title=${this.host._t("marker.use_climate_temp_tip")}>
                ${this._boolInput(t.useClimateTemp,e=>this.host._markerDialog={...t,useClimateTemp:e})}
                <span>${this.host._t("marker.use_climate_temp")}</span>
              </label>`:a}
          <fieldset class="markerlightgroup">
            <legend><span>${this.host._t("marker.light_role_label")}</span>${this._help("marker.light_role.help")}</legend>
            <div class="markerradios" role="radiogroup" aria-label=${this.host._t("marker.light_role_label")}>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="auto"
                .checked=${"auto"===t.lightRole} @change=${()=>this._setMarkerLightRole("auto")} />
                <span>${this.host._t(k?"marker.light_role_auto_yes":"marker.light_role_auto_no")}</span></label>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="always"
                .checked=${"always"===t.lightRole} @change=${()=>this._setMarkerLightRole("always")} />
                <span>${this.host._t("marker.light_role_always")}</span></label>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="never"
                .checked=${"never"===t.lightRole} @change=${()=>this._setMarkerLightRole("never")} />
                <span>${this.host._t("marker.light_role_never")}</span></label>
            </div>
          </fieldset>

          ${"always"===t.lightRole&&(T.length>1||F)?o`<div class="markerhelpfield markerleadingentity">
                <div class="markerhelplabel">
                  <label for="marker-light-entity">${this.host._t("marker.light_entity_label")}</label>
                  ${this._help("marker.light_entity.help")}
                </div>
                <select id="marker-light-entity" class="areasel"
                  @change=${e=>this.host._markerDialog={...t,lightEntity:e.target.value,lightEntityTouched:!0}}>
                  <option value="" ?selected=${F||!t.lightEntity}>
                    ${this.host._t("marker.light_entity_auto",{entity:R||this.host._t("marker.light_entity_none")})}
                  </option>
                  ${T.map(e=>o`<option value=${e}
                    ?selected=${!F&&e===t.lightEntity}>
                    ${this.host.hass.states[e]?.attributes?.friendly_name||this.host._fullRegistryHass.entities[e]?.name||e} · ${e}
                  </option>`)}
                </select>
                ${F?o`<p class="muted markerlightwarning" role="status">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  ${this.host._t("marker.light_entity_missing",{entity:t.lightEntity,fallback:R||"—"})}
                </p>`:a}
              </div>`:a}

          <fieldset class="markerlightgroup" ?disabled=${M}>
            <legend><span>${this.host._t("marker.glow_color_label")}</span>${this._help("marker.glow_mode.help")}</legend>
            <div class="markerradios" role="radiogroup" aria-label=${this.host._t("marker.glow_color_label")}>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="auto"
                .checked=${"auto"===P} ?disabled=${D}
                aria-describedby=${D?"marker-glow-disabled-hint":a}
                @change=${()=>this._setMarkerGlowMode("auto")} />
                <span>${this.host._t("marker.glow_mode_auto")}</span></label>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="color"
                .checked=${"color"===P} ?disabled=${M}
                aria-describedby=${M?"marker-glow-disabled-hint":a}
                @change=${()=>this._setMarkerGlowMode("color")} />
                <span>${this.host._t("marker.glow_mode_color")}</span></label>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="fixed"
                .checked=${"fixed"===P} ?disabled=${M}
                aria-describedby=${M?"marker-glow-disabled-hint":a}
                @change=${()=>this._setMarkerGlowMode("fixed")} />
                <span>${this.host._t("marker.glow_mode_fixed")}</span></label>
            </div>
            ${"auto"!==P?o`<div class="colorrow markerglowvalue">
              <hp-color-opacity .label=${this.host._t("marker.glow_color")}
                .color=${t.glowColor} .opacity=${1} .showOpacity=${!1}
                .pickerLabels=${this.host._colorPickerLabels}
                .disabled=${M}
                @hp-color-opacity-change=${e=>{this.host._markerDialog={...t,glowMode:P,glowColor:e.detail.color,glowColorDrafted:!0,glowTouched:!0}}}></hp-color-opacity>
              ${"fixed"===P?o`
                <span class="opl">${this.host._t("marker.glow_brightness")}</span>
                ${this._rangeInput(1,100,1,t.glowBrightness,e=>{this.host._markerDialog={...t,glowMode:P,glowBrightness:e,glowBrightnessDrafted:!0,glowTouched:!0}},M,this.host._t("marker.glow_brightness"))}
                <span class="opv">${Math.round(t.glowBrightness)}%</span>`:a}
            </div>`:a}
          </fieldset>
          <div class="markerhelpfield">
            <div class="markerhelplabel">
              <label for="marker-glow-radius">${this.host._t("marker.glow_radius_label")}</label>
              ${this._help("marker.glow_radius.help")}
            </div>
            <div class="colorrow">
              <input id="marker-glow-radius" class="tempin" type="number" min="0.5" step="0.5"
                placeholder=${this.host._glowRadiusPlaceholder} ?disabled=${M}
                aria-describedby=${M||C?"marker-glow-disabled-hint":a}
                .value=${t.glowRadius}
                @input=${e=>this.host._markerDialog={...t,glowRadius:e.target.value}} />
              <span class="opl">${this.host._imperial?this.host._t("gs.unit_ft"):this.host._t("gs.unit_m")}</span>
            </div>
          </div>
          ${M||C?o`<p id="marker-glow-disabled-hint" class="muted markerlightdisabled" role="note">
                <ha-icon icon="mdi:information-outline"></ha-icon>${I}
              </p>`:a}

          <label>${this.host._t("marker.icon_label")}</label>
          ${customElements.get("ha-icon-picker")?o`<ha-icon-picker .hass=${this.host.hass} .value=${t.icon||t.autoIcon}
                .placeholder=${t.autoIcon||void 0}
                .fallbackPath=${void 0}
                @value-changed=${e=>{const s=e.detail.value||"";(t.icon||s!==t.autoIcon)&&(this.host._markerDialog={...t,icon:s})}}></ha-icon-picker>`:o`<input class="namein" type="text"
                placeholder=${t.autoIcon||this.host._t("marker.icon_ph")}
                .value=${t.icon}
                @input=${e=>this.host._markerDialog={...t,icon:e.target.value}} />`}
          ${!t.icon&&t.autoIcon?o`<p class="muted iconauto"><ha-icon icon=${t.autoIcon}></ha-icon>
                <span>${this.host._t("marker.icon_auto",{icon:t.autoIcon})}</span>
                <button class="btn ghost" type="button"
                  @click=${()=>this.host._markerDialog={...t,icon:t.autoIcon}}>
                  ${this.host._t("marker.icon_pin_auto")}
                </button></p>`:a}

          <label for="marker-display">${this.host._t("marker.display_label")}</label>
          <select id="marker-display" class="areasel"
            @change=${e=>this.host._markerDialog={...t,display:os(e.target.value)}}>
            ${vi.map(e=>o`<option value=${e} ?selected=${e===t.display}>
              ${this.host._t(Zr[e])}
            </option>`)}
          </select>
          <p class="muted">${this.host._t(Qr[t.display])}</p>
          ${"static_icon"===t.display&&this.host._bindingHasAlarm(t.binding)?o`<div class="habindingbanner" role="note">
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                <span>${this.host._t("marker.static_alarm_warning")}</span>
              </div>`:a}
          <fieldset class="markerlightgroup markerbadgegroup">
            <legend><span>${this.host._t("marker.value_badge_title")}</span>${this._help("marker.value_badge.help")}</legend>
            <label class="srcrow">
              ${this._boolInput(g,e=>{const s=f||m;this.host._markerDialog={...t,valueBadgeEnabled:e&&!!s,valueBadgeSource:s,valueBadgeTouched:!0}},"static_icon"===t.display||!u.length&&!t.valueBadgeSource)}
              <span>${this.host._t("marker.value_badge_enabled")}</span>
            </label>
            ${"static_icon"===t.display?o`<p class="muted markerlightdisabled" role="note">
                  <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t("marker.value_badge_static")}
                </p>`:u.length||t.valueBadgeSource?a:o`<p class="muted markerlightdisabled" role="note">
                    <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t("marker.value_badge_empty")}
                  </p>`}
            ${g?o`
              <div class="markerhelplabel">
                <label for="marker-value-badge-source">${this.host._t("marker.value_badge_source")}</label>
                ${this._help("marker.value_badge_source.help")}
              </div>
          <select id="marker-value-badge-source" class="areasel"
                @change=${e=>this.host._markerDialog={...t,valueBadgeSource:$i(e.target.value),valueBadgeEnabled:!0,valueBadgeTouched:!0}}>
                ${v?o`<option value=${y} selected>
                  ${this.host._t("marker.value_badge_missing")}
                </option>`:a}
                ${u.map(t=>o`<option value=${t.key}
                  ?selected=${t.key===y}
                  title=${t.technical}>
                  ${this._valueBadgeCandidateLabel(t)} · ${t.value}
                </option>`)}
              </select>
              ${$?o`<p class="muted markerbadgetechnical"><code>${$.technical}</code></p>`:a}
              ${v?o`<p class="muted markerlightwarning" role="status">
                <ha-icon icon="mdi:alert-outline"></ha-icon>${this.host._t("marker.value_badge_missing_hint")}
              </p>`:a}
              ${"value"===t.display&&y===w?o`<p class="muted markerlightwarning" role="note">
                    <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t("marker.value_badge_duplicate")}
                  </p>`:a}
              <div class="markerhelplabel">
                <label for="marker-value-badge-position">${this.host._t("marker.value_badge_position")}</label>
                ${this._help("marker.value_badge_position.help")}
              </div>
          <select id="marker-value-badge-position" class="areasel"
                @change=${e=>this.host._markerDialog={...t,valueBadgeEnabled:g,valueBadgeSource:f,valueBadgePosition:e.target.value,valueBadgeTouched:!0}}>
                ${["right","bottom","left","top"].map(t=>o`
                  <option value=${t} ?selected=${t===b}>
                    ${this.host._t(`marker.value_badge_${t}`)}
                  </option>`)}
              </select>
            `:a}
          </fieldset>
          ${_?o`<hp-device-preview
                .hass=${this.host.hass}
                .presentation=${_}
                .registry=${this.host._haRegistry}
                .deviceName=${t.name.trim()||r?.name||L||""}>
              </hp-device-preview>`:o`<div class="devicepreview-empty">
                <ha-icon icon="mdi:eye-outline"></ha-icon>
                <span>${this.host._t("marker.preview.select_source")}</span>
              </div>`}
          ${"icon_ripple"===t.display?o`<div class="colorrow ripple-colorrow">
                <hp-color-opacity .label=${this.host._t("marker.activity_color")}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${t.rippleColor||"#3ea6ff"} .opacity=${1} .showOpacity=${!1}
                  @hp-color-opacity-change=${e=>{this.host._markerDialog={...t,rippleColor:e.detail.color}}}></hp-color-opacity>
              </div>
              <div class="colorrow ripple-sizerow">
                <span class="opl">${this.host._t("marker.ripple_size")}</span>
                ${this._rangeInput(1,8,.5,t.rippleSize,e=>this.host._markerDialog={...t,rippleSize:e})}
                <span class="opv">×${t.rippleSize}</span>
              </div>
              <p class="muted" role="note">${this.host._t("marker.activity_alarm_note")}</p>`:a}

          <label>${this.host._t("marker.size_label")}</label>
          <div class="colorrow">
            ${this._rangeInput(.5,3,.1,t.size,e=>this.host._markerDialog={...t,size:e})}
            <span class="opv">×${t.size.toFixed(1)}</span>
            <span class="opl">${this.host._t("marker.angle_label")}</span>
            ${""}
            ${this._rangeInput(0,355,5,t.angle,e=>this.host._markerDialog={...t,angle:e})}
            <span class="opv">${t.angle}°</span>
          </div>

          <label>${this.host._t("marker.model_label")}</label>
          <input class="namein" type="text" placeholder=${this.host._t("marker.model_ph")}
            .value=${t.model}
            @input=${e=>this.host._markerDialog={...t,model:e.target.value}} />

          <label>${this.host._t("marker.link_label")}</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${t.link}
            @input=${e=>this.host._markerDialog={...t,link:e.target.value}} />

          <label>${this.host._t("marker.desc_label")}</label>
          <textarea class="descin" rows="4" placeholder=${this.host._t("marker.desc_ph")}
            .value=${t.description}
            @input=${e=>this.host._markerDialog={...t,description:e.target.value}}></textarea>

          <label>${this.host._t("marker.manuals_label")}</label>
          <div class="pdfedit">
            ${t.pdfs.map(t=>o`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${wi(this.host._display(t.url))||"#"}" target="_blank" rel="noreferrer noopener">${t.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${()=>this._removeMarkerPdf(t.url)}></ha-icon></span>`)}
            <span class="fileupload">
              <button class="btn filebtn" type="button" @click=${t=>t.currentTarget.nextElementSibling?.click()}>
                <ha-icon icon="mdi:paperclip"></ha-icon>${this.host._t("btn.attach")}
              </button>
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${t=>this._pickMarkerFiles(t)} />
            </span>
          </div>
        </div>
        <div class="row markerfooter" slot="footer">
          <div class="markeractions">
            ${t.devId?o`<button class="btn" type="button"
                  ?disabled=${t.busy}
                  aria-pressed=${t.hideFromPlan||"ha_disabled"===i?.kind?"true":"false"}
                  title=${this.host._t(t.hideFromPlan||"ha_disabled"===i?.kind?"marker.show_tip":"marker.hide_tip")}
                  @click=${this.host._toggleMarkerDialogVisibility}>
                  <ha-icon icon=${t.hideFromPlan||"ha_disabled"===i?.kind?"mdi:eye-outline":"mdi:eye-off-outline"}></ha-icon>
                  ${this.host._t(t.hideFromPlan||"ha_disabled"===i?.kind?"marker.show":"marker.hide")}
                </button>`:a}
            ${t.devId?o`<button class="btn danger" type="button" ?disabled=${t.busy}
                  title=${this.host._t("marker.delete_tip")} @click=${this._deleteMarker}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
                </button>`:a}
          </div>
          <div class="markersaveactions">
            <button class="btn ghost" ?disabled=${t.busy}
              @click=${this._closeMarkerDialog}>${this.host._t("btn.cancel")}</button>
            <button class="btn on" @click=${this._saveMarker}
              ?disabled=${t.busy||"ha"===t.bindingMode&&(!t.binding||"virtual"===t.binding||!t.devId&&"active"!==i?.kind)}
              title=${"ha"!==t.bindingMode||t.binding&&"virtual"!==t.binding?"":this.host._t("marker.pick_ph")}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this.host._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}_renderSpaceDialog(){const t=this.host._spaceDialog,e=this.host._importTotal>0&&"create"===t.mode?this.host._t("import.progress",{i:this.host._importTotal-this.host._importQueue.length,n:this.host._importTotal}):"",s=()=>{this.host._spaceDialog=null,this.host._importQueue=[],this.host._importTotal=0};return o`<hp-dialog .hass=${this.host.hass}
      .title=${`${"create"===t.mode?this.host._t("space.new"):this.host._t("space.header")}${e?` · ${e}`:""}`}
      icon="mdi:floor-plan" wide @hp-close=${s}>
        <div class="body">
          <label>${this.host._t("space.title_label")}</label>
          <input class="namein" type="text" placeholder=${this.host._t("space.title_ph")}
            .value=${t.title}
            @input=${e=>this.host._spaceDialog={...t,title:e.target.value}} />
          <label>${this.host._t("space.plan_label")}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"file"===t.source}
              @change=${()=>this.host._spaceDialog=zi(t,"file")} />
            <span>${this.host._t("space.source_file")}</span>
          </label>
          ${"file"===t.source?o`<div class="planrow">
                ${t.planFile?o`<span class="planname">${t.planFile.name}</span>`:t.planUrl?o`<img class="planprev" src=${this.host._display(t.planUrl)} alt=${this.host._t("space.plan_alt")} />`:o`<span class="planname muted">${this.host._t("space.no_plan")}</span>`}
                <span class="fileupload">
                  <button class="btn filebtn" type="button" @click=${t=>t.currentTarget.nextElementSibling?.click()}>
                    <ha-icon icon="mdi:upload"></ha-icon>${t.planUrl||t.planFile?this.host._t("btn.replace"):this.host._t("btn.upload")}
                  </button>
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${t=>this._pickPlanFile(t)} />
                </span>
                <button class="btn ghost" @click=${this._toggleServerPlans}
                  title=${this.host._t("space.pick_saved_hint")}>
                  <ha-icon icon="mdi:folder-image"></ha-icon>${this.host._t("space.pick_saved")}
                </button>
              </div>
              ${t.pickSaved?this._renderServerPlans(t):a}`:a}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"draw"===t.source}
              @change=${()=>this.host._spaceDialog=zi(t,"draw")} />
            <span>${this.host._t("space.source_draw")}</span>
          </label>

          <label>${this.host._t("space.scale_label")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number"
              min=${ms(.1,this.host._imperial)}
              max=${ms(el,this.host._imperial)}
              step="0.1" .value=${t.cellCmInput??ms(t.cellCm,this.host._imperial)}
              @input=${e=>{const s=e.target.value,i=sl(s),o=null==i?null:ki(i,this.host._imperial);this.host._spaceDialog={...t,cellCmInput:s,cellCmTouched:!0,cellCm:null!=o&&o>0?Math.max(.1,Math.min(el,o)):t.cellCm}}} />
            <span class="opl">${this.host._t(this.host._imperial?"space.scale_unit_imperial":"space.scale_unit")}</span>
          </div>

          <label class="dispsection">${this.host._t("space.display_section")}</label>
          <label class="srcrow">
            ${this._boolInput(t.showBorders,e=>this.host._spaceDialog=Ai(t,"showBorders",e))}
            <span>${this.host._t("space.show_borders")}</span>
          </label>
          <label>${this.host._t("space.zero_wall_style")}</label>
          <select class="areasel"
            @change=${e=>{const s=e.target.value;this.host._spaceDialog={...t,zeroWallStyle:"solid"===s?"solid":"dashed"}}}>
            <option value="dashed" ?selected=${"dashed"===t.zeroWallStyle}>
              ${this.host._t("space.zero_wall_dashed")}
            </option>
            <option value="solid" ?selected=${"solid"===t.zeroWallStyle}>
              ${this.host._t("space.zero_wall_solid")}
            </option>
          </select>
          <div class="rhint">${this.host._t("space.zero_wall_help")}</div>
          <label class="srcrow">
            ${this._boolInput(t.showNames,e=>this.host._spaceDialog=Ai(t,"showNames",e))}
            <span>${this.host._t("space.show_names")}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(t.showLqi,e=>this.host._spaceDialog={...t,showLqi:e})}
            <span>${this.host._t("space.show_lqi")}</span>
          </label>
          ${""}
          <label class="srcrow">
            ${this._boolInput(t.hideDecor,e=>this.host._spaceDialog={...t,hideDecor:e})}
            <span>${this.host._t("space.hide_decor")}</span>
          </label>
          <div class="rhint">${this.host._t("space.hide_decor_tip")}</div>
          <label class="srcrow">
            ${this._boolInput(t.hideOpenings,e=>this.host._spaceDialog={...t,hideOpenings:e})}
            <span>${this.host._t("space.hide_openings")}</span>
          </label>
          <div class="rhint">${this.host._t("space.hide_openings_tip")}</div>
          <label class="dispsection">${this.host._t("space.roomcard_section")}</label>
          ${[["labelTemp","space.label_temp"],["labelHum","space.label_hum"],["labelLqi","space.label_lqi"],["labelLight","space.label_light"]].map(([e,s])=>o`<label class="srcrow">
              ${this._boolInput(t[e],s=>this.host._spaceDialog={...t,[e]:s})}
              <span>${this.host._t(s)}</span>
            </label>`)}
          <label>${this.host._t("space.card_font")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*t.cardFontScale),e=>this.host._spaceDialog={...t,cardFontScale:e/100})}
            <span class="opv">${Math.round(100*t.cardFontScale)}%</span>
          </div>
          ${this.host._renderCardPreview(t.cardFontScale,1,1)}
          <div class="colorrow">
            <hp-color-opacity .label=${this.host._t("space.room_color")}
              .opacityLabel=${this.host._t("space.opacity")}
              .pickerLabels=${this.host._colorPickerLabels}
              .color=${t.roomColor} .opacity=${t.roomOpacity} .showOpacity=${!0}
              @hp-color-opacity-change=${e=>{this.host._spaceDialog={...t,roomColor:e.detail.color,roomOpacity:e.detail.opacity}}}></hp-color-opacity>
          </div>
          <label>${this.host._t("space.bg_mode")}</label>
          <select class="areasel"
            @change=${e=>{const s=e.target.value;this.host._spaceDialog={...t,bgMode:"static"===s||"daynight"===s?s:null}}}>
            <option value="" ?selected=${null===t.bgMode}>${this.host._t("space.sun_inherit")}</option>
            <option value="static" ?selected=${"static"===t.bgMode}>${this.host._t("gs.bg_static")}</option>
            <option value="daynight" ?selected=${"daynight"===t.bgMode}>${this.host._t("gs.bg_daynight")}</option>
          </select>
          ${"static"===(t.bgMode??St(this.host._settings,{}))?o`<div class="colorrow">
                <hp-color-opacity .label=${this.host._t("space.bg_color")}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${t.bgColor||Dt(this.host._settings,{bgColor:null})||this.host._stageBgHex()}
                  .opacity=${1} .showOpacity=${!1}
                  @hp-color-opacity-change=${e=>{this.host._spaceDialog={...t,bgColor:e.detail.color}}}></hp-color-opacity>
                ${t.bgColor?o`<button class="btn ghost" @click=${()=>this.host._spaceDialog={...t,bgColor:null}}>
                      ${this.host._t("space.bg_inherit")}</button>`:o`<span class="opl">${this.host._t("space.bg_inherited")}</span>`}
              </div>`:a}
          <label>${this.host._t("space.north")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this.host._t("space.sun_inherit")}
              .value=${null===t.northDeg?"":String(t.northDeg)}
              @input=${e=>{const s=e.target.value.trim(),i=""===s?null:Math.round(Number(s));this.host._spaceDialog={...t,northDeg:null!==i&&Number.isFinite(i)?Math.min(359,Math.max(0,i)):null}}} />
            <span class="opl">${null===t.northDeg?this.host._t("space.north_inherited",{v:null===Mt(this.host._settings,{})?"—":String(Mt(this.host._settings,{}))+"°"}):"°"}</span>
          </div>
          <label>${this.host._t("space.sun_rays")}</label>
          <select class="areasel"
            @change=${e=>{const s=e.target.value;this.host._spaceDialog={...t,sunRays:""===s?null:"1"===s}}}>
            <option value="" ?selected=${null===t.sunRays}>${this.host._t("space.sun_inherit")}</option>
            <option value="1" ?selected=${!0===t.sunRays}>${this.host._t("space.sun_on")}</option>
            <option value="0" ?selected=${!1===t.sunRays}>${this.host._t("space.sun_off")}</option>
          </select>
          <label>${this.host._t("space.fill_label")}</label>
          ${xi.map(t=>[t,"fill."+t]).map(([e,s])=>o`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===e}
                @change=${()=>this.host._spaceDialog={...t,fillMode:e}} />
              <span>${this.host._t(s)}</span>
              ${"temp"===e&&"temp"===t.fillMode?o`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMin)}
                      @input=${e=>{const s=sl(e.target.value);null!=s&&(this.host._spaceDialog={...t,tempMin:s})}} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMax)}
                      @input=${e=>{const s=sl(e.target.value);null!=s&&(this.host._spaceDialog={...t,tempMax:s})}} />
                    °C
                  </span>`:a}
            </label>
              ${"custom"===e&&"custom"===t.fillMode?o`<div class="colorrow gsrow">
                    <span class="gsl">${this.host._t("space.custom_fill")}</span>
                    <hp-color-opacity
                      .label=${this.host._t("space.custom_fill")}
                      .opacityLabel=${this.host._t("space.opacity")}
                      .pickerLabels=${this.host._colorPickerLabels}
                      .color=${(t.customFill||us).c}
                      .opacity=${(t.customFill||us).a}
                      @hp-color-opacity-change=${e=>{this.host._spaceDialog={...t,customFill:{c:e.detail.color,a:e.detail.opacity}}}}></hp-color-opacity>
                    ${t.customFill?o`<button class="btn ghost" type="button"
                          @click=${()=>this.host._spaceDialog={...t,customFill:null}}>
                          ${this.host._t("btn.reset")}</button>`:a}
                  </div>`:a}`)}
          <label class="srcrow">
            ${this._boolInput(t.glowEnabled,e=>{this.host._spaceDialog={...t,glowEnabled:e}})}
            <span>${this.host._t("space.glow_enabled")}</span>
          </label>
          ${t.deleteBlockers?o`<div class="backuperror" role="alert">${this.host._t("space.delete_blocked",{n:String(t.deleteBlockers)})}</div>`:a}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${"edit"===t.mode?o`<div class="dialog-action-group dialog-action-danger">
                <button class="btn danger" @click=${this._deleteSpace} ?disabled=${t.busy}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
                </button>
              </div>`:a}
          <div class="dialog-action-group dialog-action-commit">
            ${this.host._importTotal>0&&"create"===t.mode?o`<button class="btn ghost" @click=${()=>this._skipImport()}>${this.host._t("btn.skip")}</button>`:a}
            <button class="btn ghost" @click=${s}>${this.host._t("btn.cancel")}</button>
            <button class="btn on" @click=${this._saveSpaceDialog}
              ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
              title=${"file"!==t.source||t.planFile||t.planUrl?"":this.host._t("title.need_plan")}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this.host._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}_renderMergeDialog(){const t=this.host._mergeDialog,e=this.host._spaceModel()?.rooms||[],s=(s,i)=>{const a=e.find(t=>t.id===s),n=a?.area?this.host.hass.areas[a.area]?.name:null;return o`<label class="srcrow">
        <input type="radio" name="mergekeep" .checked=${t.pick===i}
          @change=${()=>this.host._mergeDialog={...t,pick:i}} />
        <span>${a?.name||""} <span class="muted">· ${n||this.host._t("merge.no_area")}</span></span>
      </label>`};return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("merge.header")} icon="mdi:vector-union"
      @hp-close=${()=>this.host._mergeDialog=null}>
        <div class="body">
          <p class="muted">${this.host._t("merge.hint")}</p>
          <label>${this.host._t("merge.keep")}</label>
          ${s(t.aId,"a")}
          ${s(t.bId,"b")}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this.host._mergeDialog=null}>${this.host._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._commitMerge}>
            <ha-icon icon="mdi:check"></ha-icon>${this.host._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_renderRoomSource(t){const e="temp"===t?this.host._roomTempSrc:this.host._roomHumSrc,s=e=>{"temp"===t?this.host._roomTempSrc=e:this.host._roomHumSrc=e,this.host.requestUpdate()},i=this.host._roomSrcOpen===t;return o`
      <label>${this.host._t("temp"===t?"room.temp_src_label":"room.hum_src_label")}</label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${t}" .checked=${!e}
          @change=${()=>{s(""),this.host._roomSrcOpen=null}} />
        <span>${this.host._t("room.src_average")}</span>
      </label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${t}" .checked=${!!e}
          @change=${()=>{this.host._roomSrcOpen=t,this.host._roomSrcFilter="",this.host.requestUpdate()}} />
        <span>${this.host._t("room.src_pick")}</span>
      </label>
      ${e||i?o`<button class="dropbtn ${i?"open":""}"
              @click=${()=>{this.host._roomSrcOpen=i?null:t,this.host._roomSrcFilter=""}}>
              ${e?o`<b>${this._roomSrcLabel(e)}</b><span class="ref">${e}</span>`:o`<span class="muted">${this.host._t("room.src_ph")}</span>`}
              <ha-icon icon=${i?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
            </button>
            ${i?o`<div class="droppanel">
                  <input class="namein" type="text" placeholder=${this.host._t("marker.search_ph")}
                    .value=${this.host._roomSrcFilter}
                    @input=${t=>{this.host._roomSrcFilter=t.target.value,this.host.requestUpdate()}} />
                  <div class="candlist">
                    ${this._roomSrcCandidates().map(t=>o`<div class="cand ${t.value===e?"sel":""}"
                        @click=${()=>{s(t.value),this.host._roomSrcOpen=null}}>
                        <span class="cl">${t.label}</span><span class="cs">${t.sub}</span>
                      </div>`)}
                  </div>
                </div>`:a}`:a}`}_renderRoomDialog(){const t=!!this.host._roomEditId,e=t?null:this.host._wallFaceBatch,s=e&&e.candidates.length>1?this.host._t("room.queue_progress",{current:e.index+1,total:e.candidates.length}):"",i=!!this.host._areaSel||!!this.host._nameSel.trim(),n=ps(this.host._curSpaceCfg),r=this.host._roomFill||n.fill,l=this.host._roomCustomFill||n.customFill,h=[...this.host._freeAreas];if(t&&this.host._areaSel&&!h.some(t=>t.area_id===this.host._areaSel)){const t=this.host.hass.areas[this.host._areaSel];t&&h.unshift(t)}return o`<hp-dialog class="roomdialog" .hass=${this.host.hass} wide
      .title=${t?this.host._t("room.settings_title"):s||this.host._t("room.new")}
      icon=${t?"mdi:cog-outline":"mdi:floor-plan"} @hp-close=${this._roomDialogCancel}>
        <div class="body">
          ${s?o`<p class="muted" role="status" aria-live="polite">
            ${s}
          </p>`:a}
          <label>${this.host._t("room.name_label")}</label>
          <input class="namein" type="text" placeholder=${this.host._t("room.name_ph")}
            .value=${this.host._nameSel}
            @input=${t=>this.host._nameSel=t.target.value} />
          <label>${this.host._t("room.area_label")}</label>
          <select class="areasel"
            @change=${t=>{this.host._areaSel=t.target.value,!this.host._nameSel&&this.host._areaSel&&(this.host._nameSel=this.host.hass.areas[this.host._areaSel]?.name||""),this.host.requestUpdate()}}>
            <option value="">${this.host._t("room.no_area_option")}</option>
            ${h.map(t=>o`<option value=${t.area_id} ?selected=${t.area_id===this.host._areaSel}>${t.name}</option>`)}
          </select>

          <label class="dispsection">${this.host._t("room.settings_section")}</label>
          <label>${this.host._t("room.fill_label")}</label>
          ${[["","fill.inherit"],...Si.map(t=>[t,"fill."+t])].map(([t,e])=>o`<label class="srcrow inline">
              <input type="radio" name="rfill" .checked=${this.host._roomFill===t}
                @change=${()=>{this.host._roomFill=t,this.host.requestUpdate()}} />
              <span>${this.host._t(e)}</span>
            </label>`)}
          ${"custom"===r?o`<div class="colorrow gsrow">
                <span class="gsl">${this.host._roomCustomFill?this.host._t("room.custom_fill_own"):this.host._t("room.custom_fill_space")}</span>
                <hp-color-opacity
                  .label=${this.host._roomCustomFill?this.host._t("room.custom_fill_own"):this.host._t("room.custom_fill_space")}
                  .opacityLabel=${this.host._t("space.opacity")}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${l.c}
                  .opacity=${l.a}
                  @hp-color-opacity-change=${t=>{this.host._roomCustomFill={c:t.detail.color,a:t.detail.opacity}}}></hp-color-opacity>
                ${this.host._roomCustomFill?o`<button class="btn ghost" type="button" @click=${()=>{this.host._roomCustomFill=null}}>${this.host._t("btn.reset")}</button>`:a}
              </div>`:a}
          ${this._renderRoomSource("temp")}
          ${this._renderRoomSource("hum")}

          <label class="dispsection">${this.host._t("room.sizes_section")}</label>
          <label>${this.host._t("room.name_scale")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*this.host._roomNameScale),t=>{this.host._roomNameScale=t/100,this.host.requestUpdate()})}
            <span class="opv">${Math.round(100*this.host._roomNameScale)}%</span>
          </div>
          <label>${this.host._t("room.label_scale")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*this.host._roomLabelScale),t=>{this.host._roomLabelScale=t/100,this.host.requestUpdate()})}
            <span class="opv">${Math.round(100*this.host._roomLabelScale)}%</span>
          </div>
          ${this.host._renderCardPreview(ps(this.host._curSpaceCfg).cardFontScale,this.host._roomNameScale,this.host._roomLabelScale)}
        </div>
        <div class="row roomfooter" slot="footer">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this.host._t("btn.cancel")}</button>
          <span class="spacer"></span>
          ${t?o`<button class="btn on" @click=${()=>this._saveRoomEdit()} ?disabled=${!this.host._nameSel.trim()}>
                <ha-icon icon="mdi:check"></ha-icon>${this.host._t("btn.save")}
              </button>`:o`${this.host._pendingSplit?a:o`<button class="btn ghost" @click=${this._keepClosedAsPartitions}>
                <ha-icon icon="mdi:wall"></ha-icon>${this.host._t("btn.keep_as_walls")}
              </button>`}
              <button class="btn on room-save" @click=${this._saveRoom} ?disabled=${!i}>
                <ha-icon icon="mdi:check"></ha-icon>${this.host._t("btn.save")}
              </button>`}
        </div>
    </hp-dialog>`}}export{rl as EDITOR_RUNTIME_FINGERPRINT,ll as HouseplanEditorRuntime};
