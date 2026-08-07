const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let o=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const n=(t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(s,t,i)},r=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:a,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:h,getOwnPropertySymbols:d,getPrototypeOf:p}=Object,u=globalThis,_=u.trustedTypes,m=_?_.emptyScript:"",g=u.reactiveElementPolyfillSupport,f=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?m:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!a(t,e),y={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),u.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=y){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:o}=c(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);o?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??y}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...h(t),...d(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(r(t))}else void 0!==t&&e.push(r(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),o=t.litNonce;void 0!==o&&s.setAttribute("nonce",o),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==o?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const n=o.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(void 0!==t){const n=this.constructor;if(!1===s&&(o=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==o||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[f("elementProperties")]=new Map,w[f("finalized")]=new Map,g?.({ReactiveElement:w}),(u.reactiveElementVersions??=[]).push("2.1.2");const k=globalThis,x=t=>t,$=k.trustedTypes,S=$?$.createPolicy("lit-html",{createHTML:t=>t}):void 0,M="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,D="?"+C,z=`<${D}>`,T=document,P=()=>T.createComment(""),R=t=>null===t||"object"!=typeof t&&"function"!=typeof t,A=Array.isArray,N="[ \t\n\f\r]",E=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,O=/-->/g,F=/>/g,I=RegExp(`>|${N}(?:([^\\s"'>=/]+)(${N}*=${N}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),L=/'/g,H=/"/g,q=/^(?:script|style|textarea|title)$/i,U=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),W=U(1),B=U(2),j=Symbol.for("lit-noChange"),V=Symbol.for("lit-nothing"),G=new WeakMap,K=T.createTreeWalker(T,129);function Y(t,e){if(!A(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const J=(t,e)=>{const i=t.length-1,s=[];let o,n=2===e?"<svg>":3===e?"<math>":"",r=E;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,h=0;for(;h<i.length&&(r.lastIndex=h,l=r.exec(i),null!==l);)h=r.lastIndex,r===E?"!--"===l[1]?r=O:void 0!==l[1]?r=F:void 0!==l[2]?(q.test(l[2])&&(o=RegExp("</"+l[2],"g")),r=I):void 0!==l[3]&&(r=I):r===I?">"===l[0]?(r=o??E,c=-1):void 0===l[1]?c=-2:(c=r.lastIndex-l[2].length,a=l[1],r=void 0===l[3]?I:'"'===l[3]?H:L):r===H||r===L?r=I:r===O||r===F?r=E:(r=I,o=void 0);const d=r===I&&t[e+1].startsWith("/>")?" ":"";n+=r===E?i+z:c>=0?(s.push(a),i.slice(0,c)+M+i.slice(c)+C+d):i+C+(-2===c?e:d)}return[Y(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Z{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,n=0;const r=t.length-1,a=this.parts,[l,c]=J(t,e);if(this.el=Z.createElement(l,i),K.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=K.nextNode())&&a.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(M)){const e=c[n++],i=s.getAttribute(t).split(C),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:o,name:r[2],strings:i,ctor:"."===r[1]?it:"?"===r[1]?st:"@"===r[1]?ot:et}),s.removeAttribute(t)}else t.startsWith(C)&&(a.push({type:6,index:o}),s.removeAttribute(t));if(q.test(s.tagName)){const t=s.textContent.split(C),e=t.length-1;if(e>0){s.textContent=$?$.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],P()),K.nextNode(),a.push({type:2,index:++o});s.append(t[e],P())}}}else if(8===s.nodeType)if(s.data===D)a.push({type:2,index:o});else{let t=-1;for(;-1!==(t=s.data.indexOf(C,t+1));)a.push({type:7,index:o}),t+=C.length-1}o++}}static createElement(t,e){const i=T.createElement("template");return i.innerHTML=t,i}}function X(t,e,i=t,s){if(e===j)return e;let o=void 0!==s?i._$Co?.[s]:i._$Cl;const n=R(e)?void 0:e._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),void 0===n?o=void 0:(o=new n(t),o._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=o:i._$Cl=o),void 0!==o&&(e=X(t,o._$AS(t,e.values),o,s)),e}class Q{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??T).importNode(e,!0);K.currentNode=s;let o=K.nextNode(),n=0,r=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new tt(o,o.nextSibling,this,t):1===a.type?e=new a.ctor(o,a.name,a.strings,this,t):6===a.type&&(e=new nt(o,this,t)),this._$AV.push(e),a=i[++r]}n!==a?.index&&(o=K.nextNode(),n++)}return K.currentNode=T,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=V,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=X(this,t,e),R(t)?t===V||null==t||""===t?(this._$AH!==V&&this._$AR(),this._$AH=V):t!==this._$AH&&t!==j&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>A(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==V&&R(this._$AH)?this._$AA.nextSibling.data=t:this.T(T.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Z.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new Q(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=G.get(t.strings);return void 0===e&&G.set(t.strings,e=new Z(t)),e}k(t){A(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new tt(this.O(P()),this.O(P()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=x(t).nextSibling;x(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=V,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=V}_$AI(t,e=this,i,s){const o=this.strings;let n=!1;if(void 0===o)t=X(this,t,e,0),n=!R(t)||t!==this._$AH&&t!==j,n&&(this._$AH=t);else{const s=t;let r,a;for(t=o[0],r=0;r<o.length-1;r++)a=X(this,s[i+r],e,r),a===j&&(a=this._$AH[r]),n||=!R(a)||a!==this._$AH[r],a===V?t=V:t!==V&&(t+=(a??"")+o[r+1]),this._$AH[r]=a}n&&!s&&this.j(t)}j(t){t===V?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class it extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===V?void 0:t}}class st extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==V)}}class ot extends et{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=X(this,t,e,0)??V)===j)return;const i=this._$AH,s=t===V&&i!==V||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==V&&(i===V||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class nt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){X(this,t)}}const rt=k.litHtmlPolyfillSupport;rt?.(Z,tt),(k.litHtmlVersions??=[]).push("3.3.3");const at=globalThis;class lt extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let o=s._$litPart$;if(void 0===o){const t=i?.renderBefore??null;s._$litPart$=o=new tt(e.insertBefore(P(),t),t,void 0,i??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return j}}lt._$litElement$=!0,lt.finalized=!0,at.litElementHydrateSupport?.({LitElement:lt});const ct=at.litElementPolyfillSupport;ct?.({LitElement:lt}),(at.litElementVersions??=[]).push("4.2.2");const ht=new WeakMap;let dt=0;class pt extends lt{constructor(){super(...arguments),this.title="",this.icon="",this.wide=!1,this.dismissOnScrim=!1,this.hass=null,this._opener=null,this._focusRoot=null,this._useHaDialog=!1,this._closing=!1,this._titleId="hp-dialog-title-"+ ++dt,this._focusInitial=()=>{const t=this.querySelector("[autofocus]")||this._focusableElements()[0]||(this._useHaDialog?null:this.renderRoot.querySelector(".close"))||this.renderRoot.querySelector(".surface")||this.renderRoot.querySelector("ha-dialog");t?.focus({preventScroll:!0})},this._requestClose=()=>{this._closing||(this._closing=!0,this.dispatchEvent(new CustomEvent("hp-close",{bubbles:!0,composed:!0})))},this._onKeyDown=t=>{if("Escape"===t.key)return t.preventDefault(),t.stopImmediatePropagation(),void this._requestClose();if("Tab"!==t.key||this._useHaDialog)return;const e=this.renderRoot.querySelector(".close"),i=e?[e,...this._focusableElements()]:this._focusableElements();if(!i.length)return t.preventDefault(),void this.renderRoot.querySelector(".surface")?.focus({preventScroll:!0});const s=this._deepActiveElement(),o=i[0],n=i[i.length-1];!t.shiftKey||s!==o&&i.includes(s)?t.shiftKey||s!==n||(t.preventDefault(),o.focus()):(t.preventDefault(),n.focus())},this._onFallbackCancel=t=>{t.preventDefault(),this._requestClose()},this._onFallbackClick=t=>{this.dismissOnScrim&&t.target===t.currentTarget&&this._requestClose()}}connectedCallback(){super.connectedCallback(),this._opener=this._deepActiveElement();const t=this.getRootNode();this._focusRoot=t;const e=ht.get(t)||{dialogs:new Set,opener:this._opener};e.dialogs.add(this),ht.set(t,e),this._useHaDialog=!!customElements.get("ha-dialog"),this.addEventListener("keydown",this._onKeyDown,!0)}disconnectedCallback(){this.removeEventListener("keydown",this._onKeyDown,!0);const t=this._focusRoot,e=this._opener;this._opener=null,this._focusRoot=null;const i=t?ht.get(t):void 0;i?.dialogs.delete(this),super.disconnectedCallback(),t&&i&&requestAnimationFrame(()=>{const i=ht.get(t);if(!i)return;if(!i.dialogs.size)return i.opener?.isConnected&&i.opener.focus({preventScroll:!0}),void ht.delete(t);const s=e?.closest("hp-dialog");e?.isConnected&&s&&i.dialogs.has(s)&&e.focus({preventScroll:!0})})}firstUpdated(t){if(super.firstUpdated(t),!this._useHaDialog){const t=this.renderRoot.querySelector("dialog");t&&!t.open&&t.showModal()}queueMicrotask(()=>this._focusInitial())}_deepActiveElement(){let t=document.activeElement;for(;t?.shadowRoot?.activeElement;)t=t.shadowRoot.activeElement;return t&&t!==document.body?t:null}_focusableElements(){const t=["[autofocus]","a[href]","button:not([disabled])",'input:not([disabled]):not([type="hidden"])',"select:not([disabled])","textarea:not([disabled])",'[contenteditable="true"]','[tabindex]:not([tabindex="-1"])'].join(",");return Array.from(this.querySelectorAll(t)).filter(t=>{const e=getComputedStyle(t);return!t.hidden&&"none"!==e.display&&"hidden"!==e.visibility})}render(){const t=W`<span class="title" id=${this._titleId}>
      ${this.icon?W`<ha-icon icon=${this.icon}></ha-icon>`:V}
      <span>${this.title}</span>
    </span>`;return this._useHaDialog?W`<ha-dialog
        .hass=${this.hass}
        .open=${!0}
        width=${this.wide?"medium":"small"}
        .preventScrimClose=${!this.dismissOnScrim}
        .ariaLabelledBy=${this._titleId}
        @opened=${this._focusInitial}
        @closed=${this._requestClose}
      >
        <span slot="headerTitle">${t}</span>
        <slot></slot>
        <span class="footer" slot="footer"><slot name="footer"></slot></span>
      </ha-dialog>`:W`<dialog
      role="dialog"
      aria-modal="true"
      aria-labelledby=${this._titleId}
      @cancel=${this._onFallbackCancel}
      @click=${this._onFallbackClick}
    >
      <section class="surface" tabindex="-1">
        <header class="header">
          ${t}
          <button class="close" type="button"
            aria-label=${this.hass?.localize?.("ui.common.close")||"Close"}
            @click=${this._requestClose}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="content"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </section>
    </dialog>`}}pt.properties={title:{type:String},icon:{type:String},wide:{type:Boolean,reflect:!0},dismissOnScrim:{type:Boolean,attribute:"dismiss-on-scrim"},hass:{attribute:!1}},pt.styles=n`
    :host {
      display: contents;
      color: var(--primary-text-color, #e6e7eb);
      font: inherit;
    }

    ha-dialog {
      --dialog-content-padding: 0;
      --dialog-surface-background: var(--card-background-color, var(--hp-bg, #202126));
      --ha-dialog-border-radius: var(--rad-l, 18px);
      color: inherit;
    }

    ha-dialog::part(dialog) {
      border: 1px solid var(--hp-accent, #d89300);
      box-shadow: var(--shadow-3, 0 18px 48px rgb(0 0 0 / 0.34));
      overflow: hidden;
    }

    .title {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-4, 12px);
      min-width: 0;
      font-weight: 600;
    }

    .title ha-icon {
      flex: none;
      color: var(--hp-accent, #d89300);
    }

    .footer {
      /* ha-dialog lays out its footer slot as a flex row. display: contents
         exposed the consumer's action row as a shrink-to-fit flex item, so a
         wide device dialog got a half-width divider and its Hide action slid
         toward the centre. Keep one full-width slot item in both HA and the
         native fallback. */
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    ::slotted([slot='footer']) {
      width: 100%;
      box-sizing: border-box;
    }

    dialog {
      width: auto;
      max-width: none;
      max-height: none;
      margin: auto;
      padding: 0;
      border: 0;
      overflow: visible;
      color: inherit;
      background: transparent;
    }

    dialog::backdrop {
      background: rgb(0 0 0 / 0.45);
    }

    .surface {
      width: min(360px, 92vw);
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      color: inherit;
      background: var(--card-background-color, var(--hp-bg, #202126));
      border: 1px solid var(--hp-accent, #d89300);
      border-radius: var(--rad-l, 18px);
      box-shadow: var(--shadow-3, 0 18px 48px rgb(0 0 0 / 0.34));
    }

    :host([wide]) .surface {
      width: min(500px, 94vw);
    }

    .header {
      min-height: 56px;
      display: flex;
      align-items: center;
      gap: var(--sp-4, 12px);
      padding: var(--sp-4, 12px) var(--sp-5, 16px);
      box-sizing: border-box;
      border-bottom: 1px solid var(--hp-line, rgb(255 255 255 / 0.12));
    }

    .header .title {
      flex: 1;
    }

    .close {
      width: 40px;
      height: 40px;
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: inherit;
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .close:hover,
    .close:focus-visible {
      background: rgb(127 127 127 / 0.16);
    }

    .content {
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  `,customElements.get("hp-dialog")||customElements.define("hp-dialog",pt);class ut extends lt{constructor(){super(...arguments),this.label="",this.opacityLabel="Opacity",this.color="#607d8b",this.opacity=1,this.disabled=!1,this._open=!1,this._pickerRaf=0,this._outsidePointerDown=t=>{this._open&&!t.composedPath().includes(this)&&this._closePicker()},this._keyDown=t=>{this._open&&"Escape"===t.key&&(t.preventDefault(),t.stopImmediatePropagation(),this._closePicker(!0))},this._queuePickerPosition=()=>{this._open&&(this._pickerRaf&&cancelAnimationFrame(this._pickerRaf),this._pickerRaf=requestAnimationFrame(()=>{this._pickerRaf=0,this._positionPicker()}))}}connectedCallback(){super.connectedCallback(),document.addEventListener("pointerdown",this._outsidePointerDown,!0),document.addEventListener("scroll",this._queuePickerPosition,!0),window.addEventListener("resize",this._queuePickerPosition),this.addEventListener("keydown",this._keyDown,!0)}disconnectedCallback(){document.removeEventListener("pointerdown",this._outsidePointerDown,!0),document.removeEventListener("scroll",this._queuePickerPosition,!0),window.removeEventListener("resize",this._queuePickerPosition),this.removeEventListener("keydown",this._keyDown,!0),this._pickerRaf&&cancelAnimationFrame(this._pickerRaf),this._pickerRaf=0,super.disconnectedCallback()}_toggle(){this.disabled||(this._open?this._closePicker():(this._open=!0,this.updateComplete.then(()=>this._positionPicker())))}_closePicker(t=!1){const e=this.renderRoot.querySelector(".picker");if(e?.hidePopover)try{e.matches(":popover-open")&&e.hidePopover()}catch{}this._open=!1,t&&this.updateComplete.then(()=>this.renderRoot.querySelector(".trigger")?.focus())}_positionPicker(){if(!this._open)return;const t=this.renderRoot.querySelector(".trigger"),e=this.renderRoot.querySelector(".picker");if(!t||!e)return;if(e.style.visibility="hidden",e.showPopover)try{e.matches(":popover-open")||e.showPopover()}catch{}const i=t.getBoundingClientRect(),s=e.getBoundingClientRect(),o=Math.max(8,window.innerWidth-s.width-8);let n=i.left;n+s.width>window.innerWidth-8&&(n=i.right-s.width),n=Math.min(o,Math.max(8,n));const r=i.bottom+7,a=i.top-7-s.height;let l=r;l=r+s.height>window.innerHeight-8&&a>=8?a:Math.min(Math.max(8,l),Math.max(8,window.innerHeight-s.height-8)),e.style.left=`${Math.round(n)}px`,e.style.top=`${Math.round(l)}px`,e.style.visibility=""}_emit(t,e){const i=Number.isFinite(e)?e:Number(this.opacity)||0,s=Math.min(1,Math.max(0,i));this.color=t,this.opacity=s,this.dispatchEvent(new CustomEvent("hp-color-opacity-change",{detail:{color:t,opacity:s},bubbles:!0,composed:!0}))}render(){const t=Math.round(100*Math.min(1,Math.max(0,Number(this.opacity)||0))),e=`${this.label||"Color"}: ${this.color}, ${t}%`;return W`
      ${this.label?W`<span class="label">${this.label}</span>`:V}
      <button class="trigger" type="button" .disabled=${this.disabled}
        aria-label=${e} aria-haspopup="dialog" aria-expanded=${this._open?"true":"false"}
        title=${e} @click=${this._toggle}>
        <span class="swatch" style=${`background:${this.color};opacity:${t/100}`}></span>
      </button>
      ${this._open&&!this.disabled?W`
        <div class="picker" popover="manual" role="dialog" aria-label=${this.label||"Color"}>
          <div class="row">
            <span class="caption">${this.label||"Color"}</span>
            <input type="color" .value=${this.color} aria-label=${this.label||"Color"}
              @input=${t=>this._emit(t.target.value,this.opacity)} />
          </div>
          <div class="row">
            <span class="caption">${this.opacityLabel}</span>
            <input type="range" min="0" max="100" step="1" .value=${String(t)}
              aria-label=${this.opacityLabel}
              @input=${t=>this._emit(this.color,Number(t.target.value)/100)} />
            <input type="number" min="0" max="100" step="1" .value=${String(t)}
              aria-label=${`${this.opacityLabel}, %`}
              @change=${t=>this._emit(this.color,Number(t.target.value)/100)} />
            <span class="pct">%</span>
          </div>
        </div>`:V}
    `}}ut.properties={label:{type:String},opacityLabel:{type:String,attribute:"opacity-label"},color:{type:String},opacity:{type:Number},disabled:{type:Boolean,reflect:!0},_open:{state:!0}},ut.styles=n`
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
      width: 34px;
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
      cursor: pointer;
    }
    .trigger:hover,
    .trigger:focus-visible,
    .trigger[aria-expanded='true'] {
      border-color: var(--primary-color, #03a9f4);
      outline: none;
      box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
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
      width: min(226px, calc(100vw - 16px));
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
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
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
    input[type='color'] {
      width: 76px;
      height: 34px;
      flex: none;
      padding: 2px;
      border: 1px solid var(--divider-color, #666);
      border-radius: 7px;
      background: transparent;
      cursor: pointer;
    }
    input[type='range'] {
      width: auto;
      min-width: 0;
      flex: 1;
      accent-color: var(--primary-color, #03a9f4);
    }
    input[type='number'] {
      width: 50px;
      flex: none;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 6px;
      padding: 4px 5px;
      color: var(--primary-text-color, #fff);
      background: var(--input-fill-color, transparent);
      font: inherit;
    }
    .pct {
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
    }
    :host([disabled]) {
      opacity: .5;
      pointer-events: none;
    }
  `,customElements.get("hp-color-opacity")||customElements.define("hp-color-opacity",ut);const _t=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),mt=[{pattern:"протечк|leak|water sensor",icon:"mdi:water-alert"},{pattern:"клапан|valve",icon:"mdi:pipe-valve"},{pattern:"дым|smoke",icon:"mdi:smoke-detector"},{pattern:"термоголов|trv|radiator",icon:"mdi:radiator"},{pattern:"чайник|kettle|термопот",icon:"mdi:kettle"},{pattern:"сауна|sauna|harvia|парная|парилк",icon:"mdi:hot-tub"},{pattern:"температ|temperature|thermometer|climate sensor",icon:"mdi:thermometer"},{pattern:"qingping|air monitor|молекул|air quality",icon:"mdi:air-filter"},{pattern:"штор|curtain|blind|shade",icon:"mdi:roller-shade"},{pattern:"розетк|plug|socket|outlet",icon:"mdi:power-socket-de"},{pattern:"выключат|switch",icon:"mdi:light-switch"},{pattern:"лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip",icon:"mdi:lightbulb"},{pattern:"камер|camera",icon:"mdi:cctv"},{pattern:"замок|ttlock|lock|sn609|sn9161",icon:"mdi:lock"},{pattern:"ворота|garage|gate",icon:"mdi:garage-variant"},{pattern:"калитк|door|открыт|contact",icon:"mdi:door"},{pattern:"счётчик|счетчик|kws|meter",icon:"mdi:meter-electric"},{pattern:"вводный автомат|breaker|wifimcbn",icon:"mdi:electric-switch"},{pattern:"myheat|котёл|котел|boiler|отоплен|heating",icon:"mdi:water-boiler"},{pattern:"холодильник|fridge",icon:"mdi:fridge"},{pattern:"стиральн|washer|washing",icon:"mdi:washing-machine"},{pattern:"сушилк|dryer",icon:"mdi:tumble-dryer"},{pattern:"пылесос|vacuum|dreame|roborock",icon:"mdi:robot-vacuum"},{pattern:"soundbar",icon:"mdi:soundbar"},{pattern:"колонк|станц|speaker|яндекс|yandex|алиса|alice",icon:"mdi:speaker"},{pattern:"tv|телевизор|hyundaitv|mitv|television",icon:"mdi:television"},{pattern:"keenetic|роутер|router|mesh|access point",icon:"mdi:router-wireless"},{pattern:"ибп|ups|kirpich",icon:"mdi:battery-charging-high"},{pattern:"slzb|координат|zigbee|coordinator",icon:"mdi:zigbee"},{pattern:"motion|движен|presence|присутств",icon:"mdi:motion-sensor"},{pattern:"humidity|влажн",icon:"mdi:water-percent"}];function gt(t){const e=[];for(const i of t)if(i&&"string"==typeof i.pattern&&i.icon)try{e.push({re:new RegExp(i.pattern,"i"),icon:i.icon})}catch{}return e}const ft=gt(mt),vt={temperature:"mdi:thermometer",humidity:"mdi:water-percent",motion:"mdi:motion-sensor",occupancy:"mdi:motion-sensor",presence:"mdi:motion-sensor",door:"mdi:door",window:"mdi:window-closed",garage_door:"mdi:garage-variant",smoke:"mdi:smoke-detector",moisture:"mdi:water-alert",gas:"mdi:gas-cylinder",power:"mdi:meter-electric",energy:"mdi:meter-electric",illuminance:"mdi:brightness-5",co2:"mdi:molecule-co2",pm25:"mdi:air-filter",battery:"mdi:battery"},bt="mdi:chip";function yt(t,e,i){const s=((t||"")+" "+(e||"")).toLowerCase();for(const{re:t,icon:e}of i??ft)if(t.test(s))return e;return bt}const wt=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];var kt=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,xt=Math.ceil,$t=Math.floor,St="[BigNumber Error] ",Mt=St+"Number primitive has more than 15 significant digits: ",Ct=1e14,Dt=14,zt=9007199254740991,Tt=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],Pt=1e7,Rt=1e9;function At(t){var e=0|t;return t>0||t===e?e:e-1}function Nt(t){for(var e,i,s=1,o=t.length,n=t[0]+"";s<o;){for(e=t[s++]+"",i=Dt-e.length;i--;e="0"+e);n+=e}for(o=n.length;48===n.charCodeAt(--o););return n.slice(0,o+1||1)}function Et(t,e){var i,s,o=t.c,n=e.c,r=t.s,a=e.s,l=t.e,c=e.e;if(!r||!a)return null;if(i=o&&!o[0],s=n&&!n[0],i||s)return i?s?0:-a:r;if(r!=a)return r;if(i=r<0,s=l==c,!o||!n)return s?0:!o^i?1:-1;if(!s)return l>c^i?1:-1;for(a=(l=o.length)<(c=n.length)?l:c,r=0;r<a;r++)if(o[r]!=n[r])return o[r]>n[r]^i?1:-1;return l==c?0:l>c^i?1:-1}function Ot(t,e,i,s){if(t<e||t>i||t!==$t(t))throw Error(St+(s||"Argument")+("number"==typeof t?t<e||t>i?" out of range: ":" not an integer: ":" not a primitive number: ")+String(t))}function Ft(t){var e=t.c.length-1;return At(t.e/Dt)==e&&t.c[e]%2!=0}function It(t,e){return(t.length>1?t.charAt(0)+"."+t.slice(1):t)+(e<0?"e":"e+")+e}function Lt(t,e,i){var s,o;if(e<0){for(o=i+".";++e;o+=i);t=o+t}else if(++e>(s=t.length)){for(o=i,e-=s;--e;o+=i);t+=o}else e<s&&(t=t.slice(0,e)+"."+t.slice(e));return t}var Ht=function t(e){var i,s,o,n,r,a,l,c,h,d,p=M.prototype={constructor:M,toString:null,valueOf:null},u=new M(1),_=20,m=4,g=-7,f=21,v=-1e7,b=1e7,y=!1,w=1,k=0,x={prefix:"",groupSize:3,secondaryGroupSize:0,groupSeparator:",",decimalSeparator:".",fractionGroupSize:0,fractionGroupSeparator:" ",suffix:""},$="0123456789abcdefghijklmnopqrstuvwxyz",S=!0;function M(t,e){var i,n,r,a,l,c,h,d,p=this;if(!(p instanceof M))return new M(t,e);if(null==e){if(t&&!0===t._isBigNumber)return p.s=t.s,void(!t.c||t.e>b?p.c=p.e=null:t.e<v?p.c=[p.e=0]:(p.e=t.e,p.c=t.c.slice()));if((c="number"==typeof t)&&0*t==0){if(p.s=1/t<0?(t=-t,-1):1,t===~~t){for(a=0,l=t;l>=10;l/=10,a++);return void(a>b?p.c=p.e=null:(p.e=a,p.c=[t]))}d=String(t)}else{if(!kt.test(d=String(t)))return o(p,d,c);p.s=45==d.charCodeAt(0)?(d=d.slice(1),-1):1}(a=d.indexOf("."))>-1&&(d=d.replace(".","")),(l=d.search(/e/i))>0?(a<0&&(a=l),a+=+d.slice(l+1),d=d.substring(0,l)):a<0&&(a=d.length)}else{if(Ot(e,2,$.length,"Base"),10==e&&S)return T(p=new M(t),_+p.e+1,m);if(d=String(t),c="number"==typeof t){if(0*t!=0)return o(p,d,c,e);if(p.s=1/t<0?(d=d.slice(1),-1):1,M.DEBUG&&d.replace(/^0\.0*|\./,"").length>15)throw Error(Mt+t)}else p.s=45===d.charCodeAt(0)?(d=d.slice(1),-1):1;for(i=$.slice(0,e),a=l=0,h=d.length;l<h;l++)if(i.indexOf(n=d.charAt(l))<0){if("."==n){if(l>a){a=h;continue}}else if(!r&&(d==d.toUpperCase()&&(d=d.toLowerCase())||d==d.toLowerCase()&&(d=d.toUpperCase()))){r=!0,l=-1,a=0;continue}return o(p,String(t),c,e)}c=!1,(a=(d=s(d,e,10,p.s)).indexOf("."))>-1?d=d.replace(".",""):a=d.length}for(l=0;48===d.charCodeAt(l);l++);for(h=d.length;48===d.charCodeAt(--h););if(d=d.slice(l,++h)){if(h-=l,c&&M.DEBUG&&h>15&&(t>zt||t!==$t(t)))throw Error(Mt+p.s*t);if((a=a-l-1)>b)p.c=p.e=null;else if(a<v)p.c=[p.e=0];else{if(p.e=a,p.c=[],l=(a+1)%Dt,a<0&&(l+=Dt),l<h){for(l&&p.c.push(+d.slice(0,l)),h-=Dt;l<h;)p.c.push(+d.slice(l,l+=Dt));l=Dt-(d=d.slice(l)).length}else l-=h;for(;l--;d+="0");p.c.push(+d)}}else p.c=[p.e=0]}function C(t,e,i,s){var o,n,r,a,l;if(null==i?i=m:Ot(i,0,8),!t.c)return t.toString();if(o=t.c[0],r=t.e,null==e)l=Nt(t.c),l=1==s||2==s&&(r<=g||r>=f)?It(l,r):Lt(l,r,"0");else if(n=(t=T(new M(t),e,i)).e,a=(l=Nt(t.c)).length,1==s||2==s&&(e<=n||n<=g)){for(;a<e;l+="0",a++);l=It(l,n)}else if(e-=r+(2===s&&n>r),l=Lt(l,n,"0"),n+1>a){if(--e>0)for(l+=".";e--;l+="0");}else if((e+=n-a)>0)for(n+1==a&&(l+=".");e--;l+="0");return t.s<0&&o?"-"+l:l}function D(t,e){for(var i,s,o=1,n=new M(t[0]);o<t.length;o++)(!(s=new M(t[o])).s||(i=Et(n,s))===e||0===i&&n.s===e)&&(n=s);return n}function z(t,e,i){for(var s=1,o=e.length;!e[--o];e.pop());for(o=e[0];o>=10;o/=10,s++);return(i=s+i*Dt-1)>b?t.c=t.e=null:i<v?t.c=[t.e=0]:(t.e=i,t.c=e),t}function T(t,e,i,s){var o,n,r,a,l,c,h,d=t.c,p=Tt;if(d){t:{for(o=1,a=d[0];a>=10;a/=10,o++);if((n=e-o)<0)n+=Dt,r=e,l=d[c=0],h=$t(l/p[o-r-1]%10);else if((c=xt((n+1)/Dt))>=d.length){if(!s)break t;for(;d.length<=c;d.push(0));l=h=0,o=1,r=(n%=Dt)-Dt+1}else{for(l=a=d[c],o=1;a>=10;a/=10,o++);h=(r=(n%=Dt)-Dt+o)<0?0:$t(l/p[o-r-1]%10)}if(s=s||e<0||null!=d[c+1]||(r<0?l:l%p[o-r-1]),s=i<4?(h||s)&&(0==i||i==(t.s<0?3:2)):h>5||5==h&&(4==i||s||6==i&&(n>0?r>0?l/p[o-r]:0:d[c-1])%10&1||i==(t.s<0?8:7)),e<1||!d[0])return d.length=0,s?(e-=t.e+1,d[0]=p[(Dt-e%Dt)%Dt],t.e=-e||0):d[0]=t.e=0,t;if(0==n?(d.length=c,a=1,c--):(d.length=c+1,a=p[Dt-n],d[c]=r>0?$t(l/p[o-r]%p[r])*a:0),s)for(;;){if(0==c){for(n=1,r=d[0];r>=10;r/=10,n++);for(r=d[0]+=a,a=1;r>=10;r/=10,a++);n!=a&&(t.e++,d[0]==Ct&&(d[0]=1));break}if(d[c]+=a,d[c]!=Ct)break;d[c--]=0,a=1}for(n=d.length;0===d[--n];d.pop());}t.e>b?t.c=t.e=null:t.e<v&&(t.c=[t.e=0])}return t}function P(t){var e,i=t.e;return null===i?t.toString():(e=Nt(t.c),e=i<=g||i>=f?It(e,i):Lt(e,i,"0"),t.s<0?"-"+e:e)}return M.clone=t,M.ROUND_UP=0,M.ROUND_DOWN=1,M.ROUND_CEIL=2,M.ROUND_FLOOR=3,M.ROUND_HALF_UP=4,M.ROUND_HALF_DOWN=5,M.ROUND_HALF_EVEN=6,M.ROUND_HALF_CEIL=7,M.ROUND_HALF_FLOOR=8,M.EUCLID=9,M.config=M.set=function(t){var e,i;if(null!=t){if("object"!=typeof t)throw Error(St+"Object expected: "+t);if(t.hasOwnProperty(e="DECIMAL_PLACES")&&(Ot(i=t[e],0,Rt,e),_=i),t.hasOwnProperty(e="ROUNDING_MODE")&&(Ot(i=t[e],0,8,e),m=i),t.hasOwnProperty(e="EXPONENTIAL_AT")&&((i=t[e])&&i.pop?(Ot(i[0],-Rt,0,e),Ot(i[1],0,Rt,e),g=i[0],f=i[1]):(Ot(i,-Rt,Rt,e),g=-(f=i<0?-i:i))),t.hasOwnProperty(e="RANGE"))if((i=t[e])&&i.pop)Ot(i[0],-Rt,-1,e),Ot(i[1],1,Rt,e),v=i[0],b=i[1];else{if(Ot(i,-Rt,Rt,e),!i)throw Error(St+e+" cannot be zero: "+i);v=-(b=i<0?-i:i)}if(t.hasOwnProperty(e="CRYPTO")){if((i=t[e])!==!!i)throw Error(St+e+" not true or false: "+i);if(i){if("undefined"==typeof crypto||!crypto||!crypto.getRandomValues&&!crypto.randomBytes)throw y=!i,Error(St+"crypto unavailable");y=i}else y=i}if(t.hasOwnProperty(e="MODULO_MODE")&&(Ot(i=t[e],0,9,e),w=i),t.hasOwnProperty(e="POW_PRECISION")&&(Ot(i=t[e],0,Rt,e),k=i),t.hasOwnProperty(e="FORMAT")){if("object"!=typeof(i=t[e]))throw Error(St+e+" not an object: "+i);x=i}if(t.hasOwnProperty(e="ALPHABET")){if("string"!=typeof(i=t[e])||/^.?$|[+\-.\s]|(.).*\1/.test(i))throw Error(St+e+" invalid: "+i);S="0123456789"==i.slice(0,10),$=i}}return{DECIMAL_PLACES:_,ROUNDING_MODE:m,EXPONENTIAL_AT:[g,f],RANGE:[v,b],CRYPTO:y,MODULO_MODE:w,POW_PRECISION:k,FORMAT:x,ALPHABET:$}},M.isBigNumber=function(t){if(!t||!0!==t._isBigNumber)return!1;if(!M.DEBUG)return!0;var e,i,s=t.c,o=t.e,n=t.s;t:if("[object Array]"=={}.toString.call(s)){if((1===n||-1===n)&&o>=-Rt&&o<=Rt&&o===$t(o)){if(0===s[0]){if(0===o&&1===s.length)return!0;break t}if((e=(o+1)%Dt)<1&&(e+=Dt),String(s[0]).length==e){for(e=0;e<s.length;e++)if((i=s[e])<0||i>=Ct||i!==$t(i))break t;if(0!==i)return!0}}}else if(null===s&&null===o&&(null===n||1===n||-1===n))return!0;throw Error(St+"Invalid BigNumber: "+t)},M.maximum=M.max=function(){return D(arguments,-1)},M.minimum=M.min=function(){return D(arguments,1)},M.random=(n=9007199254740992,r=Math.random()*n&2097151?function(){return $t(Math.random()*n)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(t){var e,i,s,o,n,a=0,l=[],c=new M(u);if(null==t?t=_:Ot(t,0,Rt),o=xt(t/Dt),y)if(crypto.getRandomValues){for(e=crypto.getRandomValues(new Uint32Array(o*=2));a<o;)(n=131072*e[a]+(e[a+1]>>>11))>=9e15?(i=crypto.getRandomValues(new Uint32Array(2)),e[a]=i[0],e[a+1]=i[1]):(l.push(n%1e14),a+=2);a=o/2}else{if(!crypto.randomBytes)throw y=!1,Error(St+"crypto unavailable");for(e=crypto.randomBytes(o*=7);a<o;)(n=281474976710656*(31&e[a])+1099511627776*e[a+1]+4294967296*e[a+2]+16777216*e[a+3]+(e[a+4]<<16)+(e[a+5]<<8)+e[a+6])>=9e15?crypto.randomBytes(7).copy(e,a):(l.push(n%1e14),a+=7);a=o/7}if(!y)for(;a<o;)(n=r())<9e15&&(l[a++]=n%1e14);for(o=l[--a],t%=Dt,o&&t&&(n=Tt[Dt-t],l[a]=$t(o/n)*n);0===l[a];l.pop(),a--);if(a<0)l=[s=0];else{for(s=-1;0===l[0];l.splice(0,1),s-=Dt);for(a=1,n=l[0];n>=10;n/=10,a++);a<Dt&&(s-=Dt-a)}return c.e=s,c.c=l,c}),M.sum=function(){for(var t=1,e=arguments,i=new M(e[0]);t<e.length;)i=i.plus(e[t++]);return i},s=function(){var t="0123456789";function e(t,e,i,s){for(var o,n,r=[0],a=0,l=t.length;a<l;){for(n=r.length;n--;r[n]*=e);for(r[0]+=s.indexOf(t.charAt(a++)),o=0;o<r.length;o++)r[o]>i-1&&(null==r[o+1]&&(r[o+1]=0),r[o+1]+=r[o]/i|0,r[o]%=i)}return r.reverse()}return function(s,o,n,r,a){var l,c,h,d,p,u,g,f,v=s.indexOf("."),b=_,y=m;for(v>=0&&(d=k,k=0,s=s.replace(".",""),u=(f=new M(o)).pow(s.length-v),k=d,f.c=e(Lt(Nt(u.c),u.e,"0"),10,n,t),f.e=f.c.length),h=d=(g=e(s,o,n,a?(l=$,t):(l=t,$))).length;0==g[--d];g.pop());if(!g[0])return l.charAt(0);if(v<0?--h:(u.c=g,u.e=h,u.s=r,g=(u=i(u,f,b,y,n)).c,p=u.r,h=u.e),v=g[c=h+b+1],d=n/2,p=p||c<0||null!=g[c+1],p=y<4?(null!=v||p)&&(0==y||y==(u.s<0?3:2)):v>d||v==d&&(4==y||p||6==y&&1&g[c-1]||y==(u.s<0?8:7)),c<1||!g[0])s=p?Lt(l.charAt(1),-b,l.charAt(0)):l.charAt(0);else{if(g.length=c,p)for(--n;++g[--c]>n;)g[c]=0,c||(++h,g=[1].concat(g));for(d=g.length;!g[--d];);for(v=0,s="";v<=d;s+=l.charAt(g[v++]));s=Lt(s,h,l.charAt(0))}return s}}(),i=function(){function t(t,e,i){var s,o,n,r,a=0,l=t.length,c=e%Pt,h=e/Pt|0;for(t=t.slice();l--;)a=((o=c*(n=t[l]%Pt)+(s=h*n+(r=t[l]/Pt|0)*c)%Pt*Pt+a)/i|0)+(s/Pt|0)+h*r,t[l]=o%i;return a&&(t=[a].concat(t)),t}function e(t,e,i,s){var o,n;if(i!=s)n=i>s?1:-1;else for(o=n=0;o<i;o++)if(t[o]!=e[o]){n=t[o]>e[o]?1:-1;break}return n}function i(t,e,i,s){for(var o=0;i--;)t[i]-=o,o=t[i]<e[i]?1:0,t[i]=o*s+t[i]-e[i];for(;!t[0]&&t.length>1;t.splice(0,1));}return function(s,o,n,r,a){var l,c,h,d,p,u,_,m,g,f,v,b,y,w,k,x,$,S=s.s==o.s?1:-1,C=s.c,D=o.c;if(!(C&&C[0]&&D&&D[0]))return new M(s.s&&o.s&&(C?!D||C[0]!=D[0]:D)?C&&0==C[0]||!D?0*S:S/0:NaN);for(g=(m=new M(S)).c=[],S=n+(c=s.e-o.e)+1,a||(a=Ct,c=At(s.e/Dt)-At(o.e/Dt),S=S/Dt|0),h=0;D[h]==(C[h]||0);h++);if(D[h]>(C[h]||0)&&c--,S<0)g.push(1),d=!0;else{for(w=C.length,x=D.length,h=0,S+=2,(p=$t(a/(D[0]+1)))>1&&(D=t(D,p,a),C=t(C,p,a),x=D.length,w=C.length),y=x,v=(f=C.slice(0,x)).length;v<x;f[v++]=0);$=D.slice(),$=[0].concat($),k=D[0],D[1]>=a/2&&k++;do{if(p=0,(l=e(D,f,x,v))<0){if(b=f[0],x!=v&&(b=b*a+(f[1]||0)),(p=$t(b/k))>1)for(p>=a&&(p=a-1),_=(u=t(D,p,a)).length,v=f.length;1==e(u,f,_,v);)p--,i(u,x<_?$:D,_,a),_=u.length,l=1;else 0==p&&(l=p=1),_=(u=D.slice()).length;if(_<v&&(u=[0].concat(u)),i(f,u,v,a),v=f.length,-1==l)for(;e(D,f,x,v)<1;)p++,i(f,x<v?$:D,v,a),v=f.length}else 0===l&&(p++,f=[0]);g[h++]=p,f[0]?f[v++]=C[y]||0:(f=[C[y]],v=1)}while((y++<w||null!=f[0])&&S--);d=null!=f[0],g[0]||g.splice(0,1)}if(a==Ct){for(h=1,S=g[0];S>=10;S/=10,h++);T(m,n+(m.e=h+c*Dt-1)+1,r,d)}else m.e=c,m.r=+d;return m}}(),a=/^(-?)0([xbo])(?=\w[\w.]*$)/i,l=/^([^.]+)\.$/,c=/^\.([^.]+)$/,h=/^-?(Infinity|NaN)$/,d=/^\s*\+(?=[\w.])|^\s+|\s+$/g,o=function(t,e,i,s){var o,n=i?e:e.replace(d,"");if(h.test(n))t.s=isNaN(n)?null:n<0?-1:1;else{if(!i&&(n=n.replace(a,function(t,e,i){return o="x"==(i=i.toLowerCase())?16:"b"==i?2:8,s&&s!=o?t:e}),s&&(o=s,n=n.replace(l,"$1").replace(c,"0.$1")),e!=n))return new M(n,o);if(M.DEBUG)throw Error(St+"Not a"+(s?" base "+s:"")+" number: "+e);t.s=null}t.c=t.e=null},p.absoluteValue=p.abs=function(){var t=new M(this);return t.s<0&&(t.s=1),t},p.comparedTo=function(t,e){return Et(this,new M(t,e))},p.decimalPlaces=p.dp=function(t,e){var i,s,o,n=this;if(null!=t)return Ot(t,0,Rt),null==e?e=m:Ot(e,0,8),T(new M(n),t+n.e+1,e);if(!(i=n.c))return null;if(s=((o=i.length-1)-At(this.e/Dt))*Dt,o=i[o])for(;o%10==0;o/=10,s--);return s<0&&(s=0),s},p.dividedBy=p.div=function(t,e){return i(this,new M(t,e),_,m)},p.dividedToIntegerBy=p.idiv=function(t,e){return i(this,new M(t,e),0,1)},p.exponentiatedBy=p.pow=function(t,e){var i,s,o,n,r,a,l,c,h=this;if((t=new M(t)).c&&!t.isInteger())throw Error(St+"Exponent not an integer: "+P(t));if(null!=e&&(e=new M(e)),r=t.e>14,!h.c||!h.c[0]||1==h.c[0]&&!h.e&&1==h.c.length||!t.c||!t.c[0])return c=new M(Math.pow(+P(h),r?t.s*(2-Ft(t)):+P(t))),e?c.mod(e):c;if(a=t.s<0,e){if(e.c?!e.c[0]:!e.s)return new M(NaN);(s=!a&&h.isInteger()&&e.isInteger())&&(h=h.mod(e))}else{if(t.e>9&&(h.e>0||h.e<-1||(0==h.e?h.c[0]>1||r&&h.c[1]>=24e7:h.c[0]<8e13||r&&h.c[0]<=9999975e7)))return n=h.s<0&&Ft(t)?-0:0,h.e>-1&&(n=1/n),new M(a?1/n:n);k&&(n=xt(k/Dt+2))}for(r?(i=new M(.5),a&&(t.s=1),l=Ft(t)):l=(o=Math.abs(+P(t)))%2,c=new M(u);;){if(l){if(!(c=c.times(h)).c)break;n?c.c.length>n&&(c.c.length=n):s&&(c=c.mod(e))}if(o){if(0===(o=$t(o/2)))break;l=o%2}else if(T(t=t.times(i),t.e+1,1),t.e>14)l=Ft(t);else{if(0===(o=+P(t)))break;l=o%2}h=h.times(h),n?h.c&&h.c.length>n&&(h.c.length=n):s&&(h=h.mod(e))}return s?c:(a&&(c=u.div(c)),e?c.mod(e):n?T(c,k,m,void 0):c)},p.integerValue=function(t){var e=new M(this);return null==t?t=m:Ot(t,0,8),T(e,e.e+1,t)},p.isEqualTo=p.eq=function(t,e){return 0===Et(this,new M(t,e))},p.isFinite=function(){return!!this.c},p.isGreaterThan=p.gt=function(t,e){return Et(this,new M(t,e))>0},p.isGreaterThanOrEqualTo=p.gte=function(t,e){return 1===(e=Et(this,new M(t,e)))||0===e},p.isInteger=function(){return!!this.c&&At(this.e/Dt)>this.c.length-2},p.isLessThan=p.lt=function(t,e){return Et(this,new M(t,e))<0},p.isLessThanOrEqualTo=p.lte=function(t,e){return-1===(e=Et(this,new M(t,e)))||0===e},p.isNaN=function(){return!this.s},p.isNegative=function(){return this.s<0},p.isPositive=function(){return this.s>0},p.isZero=function(){return!!this.c&&0==this.c[0]},p.minus=function(t,e){var i,s,o,n,r=this,a=r.s;if(e=(t=new M(t,e)).s,!a||!e)return new M(NaN);if(a!=e)return t.s=-e,r.plus(t);var l=r.e/Dt,c=t.e/Dt,h=r.c,d=t.c;if(!l||!c){if(!h||!d)return h?(t.s=-e,t):new M(d?r:NaN);if(!h[0]||!d[0])return d[0]?(t.s=-e,t):new M(h[0]?r:3==m?-0:0)}if(l=At(l),c=At(c),h=h.slice(),a=l-c){for((n=a<0)?(a=-a,o=h):(c=l,o=d),o.reverse(),e=a;e--;o.push(0));o.reverse()}else for(s=(n=(a=h.length)<(e=d.length))?a:e,a=e=0;e<s;e++)if(h[e]!=d[e]){n=h[e]<d[e];break}if(n&&(o=h,h=d,d=o,t.s=-t.s),(e=(s=d.length)-(i=h.length))>0)for(;e--;h[i++]=0);for(e=Ct-1;s>a;){if(h[--s]<d[s]){for(i=s;i&&!h[--i];h[i]=e);--h[i],h[s]+=Ct}h[s]-=d[s]}for(;0==h[0];h.splice(0,1),--c);return h[0]?z(t,h,c):(t.s=3==m?-1:1,t.c=[t.e=0],t)},p.modulo=p.mod=function(t,e){var s,o,n=this;return t=new M(t,e),!n.c||!t.s||t.c&&!t.c[0]?new M(NaN):!t.c||n.c&&!n.c[0]?new M(n):(9==w?(o=t.s,t.s=1,s=i(n,t,0,3),t.s=o,s.s*=o):s=i(n,t,0,w),(t=n.minus(s.times(t))).c[0]||1!=w||(t.s=n.s),t)},p.multipliedBy=p.times=function(t,e){var i,s,o,n,r,a,l,c,h,d,p,u,_,m,g,f=this,v=f.c,b=(t=new M(t,e)).c;if(!(v&&b&&v[0]&&b[0]))return!f.s||!t.s||v&&!v[0]&&!b||b&&!b[0]&&!v?t.c=t.e=t.s=null:(t.s*=f.s,v&&b?(t.c=[0],t.e=0):t.c=t.e=null),t;for(s=At(f.e/Dt)+At(t.e/Dt),t.s*=f.s,(l=v.length)<(d=b.length)&&(_=v,v=b,b=_,o=l,l=d,d=o),o=l+d,_=[];o--;_.push(0));for(m=Ct,g=Pt,o=d;--o>=0;){for(i=0,p=b[o]%g,u=b[o]/g|0,n=o+(r=l);n>o;)i=((c=p*(c=v[--r]%g)+(a=u*c+(h=v[r]/g|0)*p)%g*g+_[n]+i)/m|0)+(a/g|0)+u*h,_[n--]=c%m;_[n]=i}return i?++s:_.splice(0,1),z(t,_,s)},p.negated=function(){var t=new M(this);return t.s=-t.s||null,t},p.plus=function(t,e){var i,s=this,o=s.s;if(e=(t=new M(t,e)).s,!o||!e)return new M(NaN);if(o!=e)return t.s=-e,s.minus(t);var n=s.e/Dt,r=t.e/Dt,a=s.c,l=t.c;if(!n||!r){if(!a||!l)return new M(o/0);if(!a[0]||!l[0])return l[0]?t:new M(a[0]?s:0*o)}if(n=At(n),r=At(r),a=a.slice(),o=n-r){for(o>0?(r=n,i=l):(o=-o,i=a),i.reverse();o--;i.push(0));i.reverse()}for((o=a.length)-(e=l.length)<0&&(i=l,l=a,a=i,e=o),o=0;e;)o=(a[--e]=a[e]+l[e]+o)/Ct|0,a[e]=Ct===a[e]?0:a[e]%Ct;return o&&(a=[o].concat(a),++r),z(t,a,r)},p.precision=p.sd=function(t,e){var i,s,o,n=this;if(null!=t&&t!==!!t)return Ot(t,1,Rt),null==e?e=m:Ot(e,0,8),T(new M(n),t,e);if(!(i=n.c))return null;if(s=(o=i.length-1)*Dt+1,o=i[o]){for(;o%10==0;o/=10,s--);for(o=i[0];o>=10;o/=10,s++);}return t&&n.e+1>s&&(s=n.e+1),s},p.shiftedBy=function(t){return Ot(t,-9007199254740991,zt),this.times("1e"+t)},p.squareRoot=p.sqrt=function(){var t,e,s,o,n,r=this,a=r.c,l=r.s,c=r.e,h=_+4,d=new M("0.5");if(1!==l||!a||!a[0])return new M(!l||l<0&&(!a||a[0])?NaN:a?r:1/0);if(0==(l=Math.sqrt(+P(r)))||l==1/0?(((e=Nt(a)).length+c)%2==0&&(e+="0"),l=Math.sqrt(+e),c=At((c+1)/2)-(c<0||c%2),s=new M(e=l==1/0?"5e"+c:(e=l.toExponential()).slice(0,e.indexOf("e")+1)+c)):s=new M(l+""),s.c[0])for((l=(c=s.e)+h)<3&&(l=0);;)if(n=s,s=d.times(n.plus(i(r,n,h,1))),Nt(n.c).slice(0,l)===(e=Nt(s.c)).slice(0,l)){if(s.e<c&&--l,"9999"!=(e=e.slice(l-3,l+1))&&(o||"4999"!=e)){+e&&(+e.slice(1)||"5"!=e.charAt(0))||(T(s,s.e+_+2,1),t=!s.times(s).eq(r));break}if(!o&&(T(n,n.e+_+2,0),n.times(n).eq(r))){s=n;break}h+=4,l+=4,o=1}return T(s,s.e+_+1,m,t)},p.toExponential=function(t,e){return null!=t&&(Ot(t,0,Rt),t++),C(this,t,e,1)},p.toFixed=function(t,e){return null!=t&&(Ot(t,0,Rt),t=t+this.e+1),C(this,t,e)},p.toFormat=function(t,e,i){var s,o=this;if(null==i)null!=t&&e&&"object"==typeof e?(i=e,e=null):t&&"object"==typeof t?(i=t,t=e=null):i=x;else if("object"!=typeof i)throw Error(St+"Argument not an object: "+i);if(s=o.toFixed(t,e),o.c){var n,r=s.split("."),a=+i.groupSize,l=+i.secondaryGroupSize,c=i.groupSeparator||"",h=r[0],d=r[1],p=o.s<0,u=p?h.slice(1):h,_=u.length;if(l&&(n=a,a=l,l=n,_-=n),a>0&&_>0){for(n=_%a||a,h=u.substr(0,n);n<_;n+=a)h+=c+u.substr(n,a);l>0&&(h+=c+u.slice(n)),p&&(h="-"+h)}s=d?h+(i.decimalSeparator||"")+((l=+i.fractionGroupSize)?d.replace(new RegExp("\\d{"+l+"}\\B","g"),"$&"+(i.fractionGroupSeparator||"")):d):h}return(i.prefix||"")+s+(i.suffix||"")},p.toFraction=function(t){var e,s,o,n,r,a,l,c,h,d,p,_,g=this,f=g.c;if(null!=t&&(!(l=new M(t)).isInteger()&&(l.c||1!==l.s)||l.lt(u)))throw Error(St+"Argument "+(l.isInteger()?"out of range: ":"not an integer: ")+P(l));if(!f)return new M(g);for(e=new M(u),h=s=new M(u),o=c=new M(u),_=Nt(f),r=e.e=_.length-g.e-1,e.c[0]=Tt[(a=r%Dt)<0?Dt+a:a],t=!t||l.comparedTo(e)>0?r>0?e:h:l,a=b,b=1/0,l=new M(_),c.c[0]=0;d=i(l,e,0,1),1!=(n=s.plus(d.times(o))).comparedTo(t);)s=o,o=n,h=c.plus(d.times(n=h)),c=n,e=l.minus(d.times(n=e)),l=n;return n=i(t.minus(s),o,0,1),c=c.plus(n.times(h)),s=s.plus(n.times(o)),c.s=h.s=g.s,p=i(h,o,r*=2,m).minus(g).abs().comparedTo(i(c,s,r,m).minus(g).abs())<1?[h,o]:[c,s],b=a,p},p.toNumber=function(){return+P(this)},p.toPrecision=function(t,e){return null!=t&&Ot(t,1,Rt),C(this,t,e,2)},p.toString=function(t){var e,i=this,o=i.s,n=i.e;return null===n?o?(e="Infinity",o<0&&(e="-"+e)):e="NaN":(null==t?e=n<=g||n>=f?It(Nt(i.c),n):Lt(Nt(i.c),n,"0"):10===t&&S?e=Lt(Nt((i=T(new M(i),_+n+1,m)).c),i.e,"0"):(Ot(t,2,$.length,"Base"),e=s(Lt(Nt(i.c),n,"0"),10,t,o,!0)),o<0&&i.c[0]&&(e="-"+e)),e},p.valueOf=p.toJSON=function(){return P(this)},p._isBigNumber=!0,p[Symbol.toStringTag]="BigNumber",p[Symbol.for("nodejs.util.inspect.custom")]=p.valueOf,null!=e&&M.set(e),M}(),qt=class{key;left=null;right=null;constructor(t){this.key=t}},Ut=class extends qt{constructor(t){super(t)}},Wt=class{size=0;modificationCount=0;splayCount=0;splay(t){const e=this.root;if(null==e)return this.compare(t,t),-1;let i=null,s=null,o=null,n=null,r=e;const a=this.compare;let l;for(;;)if(l=a(r.key,t),l>0){let e=r.left;if(null==e)break;if(l=a(e.key,t),l>0&&(r.left=e.right,e.right=r,r=e,e=r.left,null==e))break;null==i?s=r:i.left=r,i=r,r=e}else{if(!(l<0))break;{let e=r.right;if(null==e)break;if(l=a(e.key,t),l<0&&(r.right=e.left,e.left=r,r=e,e=r.right,null==e))break;null==o?n=r:o.right=r,o=r,r=e}}return null!=o&&(o.right=r.left,r.left=n),null!=i&&(i.left=r.right,r.right=s),this.root!==r&&(this.root=r,this.splayCount++),l}splayMin(t){let e=t,i=e.left;for(;null!=i;){const t=i;e.left=t.right,t.right=e,e=t,i=e.left}return e}splayMax(t){let e=t,i=e.right;for(;null!=i;){const t=i;e.right=t.left,t.left=e,e=t,i=e.right}return e}_delete(t){if(null==this.root)return null;if(0!=this.splay(t))return null;let e=this.root;const i=e,s=e.left;if(this.size--,null==s)this.root=e.right;else{const t=e.right;e=this.splayMax(s),e.right=t,this.root=e}return this.modificationCount++,i}addNewRoot(t,e){this.size++,this.modificationCount++;const i=this.root;null!=i?(e<0?(t.left=i,t.right=i.right,i.right=null):(t.right=i,t.left=i.left,i.left=null),this.root=t):this.root=t}_first(){const t=this.root;return null==t?null:(this.root=this.splayMin(t),this.root)}_last(){const t=this.root;return null==t?null:(this.root=this.splayMax(t),this.root)}clear(){this.root=null,this.size=0,this.modificationCount++}has(t){return this.validKey(t)&&0==this.splay(t)}defaultCompare(){return(t,e)=>t<e?-1:t>e?1:0}wrap(){return{getRoot:()=>this.root,setRoot:t=>{this.root=t},getSize:()=>this.size,getModificationCount:()=>this.modificationCount,getSplayCount:()=>this.splayCount,setSplayCount:t=>{this.splayCount=t},splay:t=>this.splay(t),has:t=>this.has(t)}}},Bt=class t extends Wt{root=null;compare;validKey;constructor(t,e){super(),this.compare=t??this.defaultCompare(),this.validKey=e??(t=>null!=t&&null!=t)}delete(t){return!!this.validKey(t)&&null!=this._delete(t)}deleteAll(t){for(const e of t)this.delete(e)}forEach(t){const e=this[Symbol.iterator]();let i;for(;i=e.next(),!i.done;)t(i.value,i.value,this)}add(t){const e=this.splay(t);return 0!=e&&this.addNewRoot(new Ut(t),e),this}addAndReturn(t){const e=this.splay(t);return 0!=e&&this.addNewRoot(new Ut(t),e),this.root.key}addAll(t){for(const e of t)this.add(e)}isEmpty(){return null==this.root}isNotEmpty(){return null!=this.root}single(){if(0==this.size)throw"Bad state: No element";if(this.size>1)throw"Bad state: Too many element";return this.root.key}first(){if(0==this.size)throw"Bad state: No element";return this._first().key}last(){if(0==this.size)throw"Bad state: No element";return this._last().key}lastBefore(t){if(null==t)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(t)<0)return this.root.key;let e=this.root.left;if(null==e)return null;let i=e.right;for(;null!=i;)e=i,i=e.right;return e.key}firstAfter(t){if(null==t)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(t)>0)return this.root.key;let e=this.root.right;if(null==e)return null;let i=e.left;for(;null!=i;)e=i,i=e.left;return e.key}retainAll(e){const i=new t(this.compare,this.validKey),s=this.modificationCount;for(const t of e){if(s!=this.modificationCount)throw"Concurrent modification during iteration.";this.validKey(t)&&0==this.splay(t)&&i.add(this.root.key)}i.size!=this.size&&(this.root=i.root,this.size=i.size,this.modificationCount++)}lookup(t){if(!this.validKey(t))return null;return 0!=this.splay(t)?null:this.root.key}intersection(e){const i=new t(this.compare,this.validKey);for(const t of this)e.has(t)&&i.add(t);return i}difference(e){const i=new t(this.compare,this.validKey);for(const t of this)e.has(t)||i.add(t);return i}union(t){const e=this.clone();return e.addAll(t),e}clone(){const e=new t(this.compare,this.validKey);return e.size=this.size,e.root=this.copyNode(this.root),e}copyNode(t){if(null==t)return null;const e=new Ut(t.key);return function t(e,i){let s,o;do{if(s=e.left,o=e.right,null!=s){const e=new Ut(s.key);i.left=e,t(s,e)}if(null!=o){const t=new Ut(o.key);i.right=t,e=o,i=t}}while(null!=o)}(t,e),e}toSet(){return this.clone()}entries(){return new Gt(this.wrap())}keys(){return this[Symbol.iterator]()}values(){return this[Symbol.iterator]()}[Symbol.iterator](){return new Vt(this.wrap())}[Symbol.toStringTag]="[object Set]"},jt=class{tree;path=new Array;modificationCount=null;splayCount;constructor(t){this.tree=t,this.splayCount=t.getSplayCount()}[Symbol.iterator](){return this}next(){return this.moveNext()?{done:!1,value:this.current()}:{done:!0,value:null}}current(){if(!this.path.length)return null;const t=this.path[this.path.length-1];return this.getValue(t)}rebuildPath(t){this.path.splice(0,this.path.length),this.tree.splay(t),this.path.push(this.tree.getRoot()),this.splayCount=this.tree.getSplayCount()}findLeftMostDescendent(t){for(;null!=t;)this.path.push(t),t=t.left}moveNext(){if(this.modificationCount!=this.tree.getModificationCount()){if(null==this.modificationCount){this.modificationCount=this.tree.getModificationCount();let t=this.tree.getRoot();for(;null!=t;)this.path.push(t),t=t.left;return this.path.length>0}throw"Concurrent modification during iteration."}if(!this.path.length)return!1;this.splayCount!=this.tree.getSplayCount()&&this.rebuildPath(this.path[this.path.length-1].key);let t=this.path[this.path.length-1],e=t.right;if(null!=e){for(;null!=e;)this.path.push(e),e=e.left;return!0}for(this.path.pop();this.path.length&&this.path[this.path.length-1].right===t;)t=this.path.pop();return this.path.length>0}},Vt=class extends jt{getValue(t){return t.key}},Gt=class extends jt{getValue(t){return[t.key,t.key]}},Kt=t=>()=>t,Yt=t=>{const e=t?(e,i)=>i.minus(e).abs().isLessThanOrEqualTo(t):Kt(!1);return(t,i)=>e(t,i)?0:t.comparedTo(i)};function Jt(t){const e=t?(e,i,s,o,n)=>e.exponentiatedBy(2).isLessThanOrEqualTo(o.minus(i).exponentiatedBy(2).plus(n.minus(s).exponentiatedBy(2)).times(t)):Kt(!1);return(t,i,s)=>{const o=t.x,n=t.y,r=s.x,a=s.y,l=n.minus(a).times(i.x.minus(r)).minus(o.minus(r).times(i.y.minus(a)));return e(l,o,n,r,a)?0:l.comparedTo(0)}}var Zt=t=>t,Xt=t=>{if(t){const e=new Bt(Yt(t)),i=new Bt(Yt(t)),s=(t,e)=>e.addAndReturn(t),o=t=>({x:s(t.x,e),y:s(t.y,i)});return o({x:new Ht(0),y:new Ht(0)}),o}return Zt},Qt=t=>({set:t=>{te=Qt(t)},reset:()=>Qt(t),compare:Yt(t),snap:Xt(t),orient:Jt(t)}),te=Qt(),ee=(t,e)=>t.ll.x.isLessThanOrEqualTo(e.x)&&e.x.isLessThanOrEqualTo(t.ur.x)&&t.ll.y.isLessThanOrEqualTo(e.y)&&e.y.isLessThanOrEqualTo(t.ur.y),ie=(t,e)=>{if(e.ur.x.isLessThan(t.ll.x)||t.ur.x.isLessThan(e.ll.x)||e.ur.y.isLessThan(t.ll.y)||t.ur.y.isLessThan(e.ll.y))return null;const i=t.ll.x.isLessThan(e.ll.x)?e.ll.x:t.ll.x,s=t.ur.x.isLessThan(e.ur.x)?t.ur.x:e.ur.x;return{ll:{x:i,y:t.ll.y.isLessThan(e.ll.y)?e.ll.y:t.ll.y},ur:{x:s,y:t.ur.y.isLessThan(e.ur.y)?t.ur.y:e.ur.y}}},se=(t,e)=>t.x.times(e.y).minus(t.y.times(e.x)),oe=(t,e)=>t.x.times(e.x).plus(t.y.times(e.y)),ne=t=>oe(t,t).sqrt(),re=(t,e,i)=>{const s={x:e.x.minus(t.x),y:e.y.minus(t.y)},o={x:i.x.minus(t.x),y:i.y.minus(t.y)};return se(o,s).div(ne(o)).div(ne(s))},ae=(t,e,i)=>{const s={x:e.x.minus(t.x),y:e.y.minus(t.y)},o={x:i.x.minus(t.x),y:i.y.minus(t.y)};return oe(o,s).div(ne(o)).div(ne(s))},le=(t,e,i)=>e.y.isZero()?null:{x:t.x.plus(e.x.div(e.y).times(i.minus(t.y))),y:i},ce=(t,e,i)=>e.x.isZero()?null:{x:i,y:t.y.plus(e.y.div(e.x).times(i.minus(t.x)))},he=class t{point;isLeft;segment;otherSE;consumedBy;static compare(e,i){const s=t.comparePoints(e.point,i.point);return 0!==s?s:(e.point!==i.point&&e.link(i),e.isLeft!==i.isLeft?e.isLeft?1:-1:ve.compare(e.segment,i.segment))}static comparePoints(t,e){return t.x.isLessThan(e.x)?-1:t.x.isGreaterThan(e.x)?1:t.y.isLessThan(e.y)?-1:t.y.isGreaterThan(e.y)?1:0}constructor(t,e){void 0===t.events?t.events=[this]:t.events.push(this),this.point=t,this.isLeft=e}link(t){if(t.point===this.point)throw new Error("Tried to link already linked events");const e=t.point.events;for(let t=0,i=e.length;t<i;t++){const i=e[t];this.point.events.push(i),i.point=this.point}this.checkForConsuming()}checkForConsuming(){const t=this.point.events.length;for(let e=0;e<t;e++){const i=this.point.events[e];if(void 0===i.segment.consumedBy)for(let s=e+1;s<t;s++){const t=this.point.events[s];void 0===t.consumedBy&&(i.otherSE.point.events===t.otherSE.point.events&&i.segment.consume(t.segment))}}}getAvailableLinkedEvents(){const t=[];for(let e=0,i=this.point.events.length;e<i;e++){const i=this.point.events[e];i!==this&&!i.segment.ringOut&&i.segment.isInResult()&&t.push(i)}return t}getLeftmostComparator(t){const e=new Map,i=i=>{const s=i.otherSE;e.set(i,{sine:re(this.point,t.point,s.point),cosine:ae(this.point,t.point,s.point)})};return(t,s)=>{e.has(t)||i(t),e.has(s)||i(s);const{sine:o,cosine:n}=e.get(t),{sine:r,cosine:a}=e.get(s);return o.isGreaterThanOrEqualTo(0)&&r.isGreaterThanOrEqualTo(0)?n.isLessThan(a)?1:n.isGreaterThan(a)?-1:0:o.isLessThan(0)&&r.isLessThan(0)?n.isLessThan(a)?-1:n.isGreaterThan(a)?1:0:r.isLessThan(o)?-1:r.isGreaterThan(o)?1:0}}},de=class t{events;poly;_isExteriorRing;_enclosingRing;static factory(e){const i=[];for(let s=0,o=e.length;s<o;s++){const o=e[s];if(!o.isInResult()||o.ringOut)continue;let n=null,r=o.leftSE,a=o.rightSE;const l=[r],c=r.point,h=[];for(;n=r,r=a,l.push(r),r.point!==c;)for(;;){const e=r.getAvailableLinkedEvents();if(0===e.length){const t=l[0].point,e=l[l.length-1].point;throw new Error(`Unable to complete output ring starting at [${t.x}, ${t.y}]. Last matching segment found ends at [${e.x}, ${e.y}].`)}if(1===e.length){a=e[0].otherSE;break}let s=null;for(let t=0,e=h.length;t<e;t++)if(h[t].point===r.point){s=t;break}if(null!==s){const e=h.splice(s)[0],o=l.splice(e.index);o.unshift(o[0].otherSE),i.push(new t(o.reverse()));continue}h.push({index:l.length,point:r.point});const o=r.getLeftmostComparator(n);a=e.sort(o)[0].otherSE;break}i.push(new t(l))}return i}constructor(t){this.events=t;for(let e=0,i=t.length;e<i;e++)t[e].segment.ringOut=this;this.poly=null}getGeom(){let t=this.events[0].point;const e=[t];for(let i=1,s=this.events.length-1;i<s;i++){const s=this.events[i].point,o=this.events[i+1].point;0!==te.orient(s,t,o)&&(e.push(s),t=s)}if(1===e.length)return null;const i=e[0],s=e[1];0===te.orient(i,t,s)&&e.shift(),e.push(e[0]);const o=this.isExteriorRing()?1:-1,n=this.isExteriorRing()?0:e.length-1,r=this.isExteriorRing()?e.length:-1,a=[];for(let t=n;t!=r;t+=o)a.push([e[t].x.toNumber(),e[t].y.toNumber()]);return a}isExteriorRing(){if(void 0===this._isExteriorRing){const t=this.enclosingRing();this._isExteriorRing=!t||!t.isExteriorRing()}return this._isExteriorRing}enclosingRing(){return void 0===this._enclosingRing&&(this._enclosingRing=this._calcEnclosingRing()),this._enclosingRing}_calcEnclosingRing(){let t=this.events[0];for(let e=1,i=this.events.length;e<i;e++){const i=this.events[e];he.compare(t,i)>0&&(t=i)}let e=t.segment.prevInResult(),i=e?e.prevInResult():null;for(;;){if(!e)return null;if(!i)return e.ringOut;if(i.ringOut!==e.ringOut)return i.ringOut?.enclosingRing()!==e.ringOut?e.ringOut:e.ringOut?.enclosingRing();e=i.prevInResult(),i=e?e.prevInResult():null}}},pe=class{exteriorRing;interiorRings;constructor(t){this.exteriorRing=t,t.poly=this,this.interiorRings=[]}addInterior(t){this.interiorRings.push(t),t.poly=this}getGeom(){const t=this.exteriorRing.getGeom();if(null===t)return null;const e=[t];for(let t=0,i=this.interiorRings.length;t<i;t++){const i=this.interiorRings[t].getGeom();null!==i&&e.push(i)}return e}},ue=class{rings;polys;constructor(t){this.rings=t,this.polys=this._composePolys(t)}getGeom(){const t=[];for(let e=0,i=this.polys.length;e<i;e++){const i=this.polys[e].getGeom();null!==i&&t.push(i)}return t}_composePolys(t){const e=[];for(let i=0,s=t.length;i<s;i++){const s=t[i];if(!s.poly)if(s.isExteriorRing())e.push(new pe(s));else{const t=s.enclosingRing();t?.poly||e.push(new pe(t)),t?.poly?.addInterior(s)}}return e}},_e=class{queue;tree;segments;constructor(t,e=ve.compare){this.queue=t,this.tree=new Bt(e),this.segments=[]}process(t){const e=t.segment,i=[];if(t.consumedBy)return t.isLeft?this.queue.delete(t.otherSE):this.tree.delete(e),i;t.isLeft&&this.tree.add(e);let s=e,o=e;do{s=this.tree.lastBefore(s)}while(null!=s&&null!=s.consumedBy);do{o=this.tree.firstAfter(o)}while(null!=o&&null!=o.consumedBy);if(t.isLeft){let n=null;if(s){const t=s.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(n=t),!s.isAnEndpoint(t))){const e=this._splitSafely(s,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}let r=null;if(o){const t=o.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(r=t),!o.isAnEndpoint(t))){const e=this._splitSafely(o,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}if(null!==n||null!==r){let t=null;if(null===n)t=r;else if(null===r)t=n;else{t=he.comparePoints(n,r)<=0?n:r}this.queue.delete(e.rightSE),i.push(e.rightSE);const s=e.split(t);for(let t=0,e=s.length;t<e;t++)i.push(s[t])}i.length>0?(this.tree.delete(e),i.push(t)):(this.segments.push(e),e.prev=s)}else{if(s&&o){const t=s.getIntersection(o);if(null!==t){if(!s.isAnEndpoint(t)){const e=this._splitSafely(s,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}if(!o.isAnEndpoint(t)){const e=this._splitSafely(o,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}}this.tree.delete(e)}return i}_splitSafely(t,e){this.tree.delete(t);const i=t.rightSE;this.queue.delete(i);const s=t.split(e);return s.push(i),void 0===t.consumedBy&&this.tree.add(t),s}},me=new class{type;numMultiPolys;run(t,e,i){me.type=t;const s=[new we(e,!0)];for(let t=0,e=i.length;t<e;t++)s.push(new we(i[t],!1));if(me.numMultiPolys=s.length,"difference"===me.type){const t=s[0];let e=1;for(;e<s.length;)null!==ie(s[e].bbox,t.bbox)?e++:s.splice(e,1)}if("intersection"===me.type)for(let t=0,e=s.length;t<e;t++){const e=s[t];for(let i=t+1,o=s.length;i<o;i++)if(null===ie(e.bbox,s[i].bbox))return[]}const o=new Bt(he.compare);for(let t=0,e=s.length;t<e;t++){const e=s[t].getSweepEvents();for(let t=0,i=e.length;t<i;t++)o.add(e[t])}const n=new _e(o);let r=null;for(0!=o.size&&(r=o.first(),o.delete(r));r;){const t=n.process(r);for(let e=0,i=t.length;e<i;e++){const i=t[e];void 0===i.consumedBy&&o.add(i)}0!=o.size?(r=o.first(),o.delete(r)):r=null}te.reset();const a=de.factory(n.segments);return new ue(a).getGeom()}},ge=me,fe=0,ve=class t{id;leftSE;rightSE;rings;windings;ringOut;consumedBy;prev;_prevInResult;_beforeState;_afterState;_isInResult;static compare(t,e){const i=t.leftSE.point.x,s=e.leftSE.point.x,o=t.rightSE.point.x,n=e.rightSE.point.x;if(n.isLessThan(i))return 1;if(o.isLessThan(s))return-1;const r=t.leftSE.point.y,a=e.leftSE.point.y,l=t.rightSE.point.y,c=e.rightSE.point.y;if(i.isLessThan(s)){if(a.isLessThan(r)&&a.isLessThan(l))return 1;if(a.isGreaterThan(r)&&a.isGreaterThan(l))return-1;const i=t.comparePoint(e.leftSE.point);if(i<0)return 1;if(i>0)return-1;const s=e.comparePoint(t.rightSE.point);return 0!==s?s:-1}if(i.isGreaterThan(s)){if(r.isLessThan(a)&&r.isLessThan(c))return-1;if(r.isGreaterThan(a)&&r.isGreaterThan(c))return 1;const i=e.comparePoint(t.leftSE.point);if(0!==i)return i;const s=t.comparePoint(e.rightSE.point);return s<0?1:s>0?-1:1}if(r.isLessThan(a))return-1;if(r.isGreaterThan(a))return 1;if(o.isLessThan(n)){const i=e.comparePoint(t.rightSE.point);if(0!==i)return i}if(o.isGreaterThan(n)){const i=t.comparePoint(e.rightSE.point);if(i<0)return 1;if(i>0)return-1}if(!o.eq(n)){const t=l.minus(r),e=o.minus(i),h=c.minus(a),d=n.minus(s);if(t.isGreaterThan(e)&&h.isLessThan(d))return 1;if(t.isLessThan(e)&&h.isGreaterThan(d))return-1}return o.isGreaterThan(n)?1:o.isLessThan(n)||l.isLessThan(c)?-1:l.isGreaterThan(c)?1:t.id<e.id?-1:t.id>e.id?1:0}constructor(t,e,i,s){this.id=++fe,this.leftSE=t,t.segment=this,t.otherSE=e,this.rightSE=e,e.segment=this,e.otherSE=t,this.rings=i,this.windings=s}static fromRing(e,i,s){let o,n,r;const a=he.comparePoints(e,i);if(a<0)o=e,n=i,r=1;else{if(!(a>0))throw new Error(`Tried to create degenerate segment at [${e.x}, ${e.y}]`);o=i,n=e,r=-1}const l=new he(o,!0),c=new he(n,!1);return new t(l,c,[s],[r])}replaceRightSE(t){this.rightSE=t,this.rightSE.segment=this,this.rightSE.otherSE=this.leftSE,this.leftSE.otherSE=this.rightSE}bbox(){const t=this.leftSE.point.y,e=this.rightSE.point.y;return{ll:{x:this.leftSE.point.x,y:t.isLessThan(e)?t:e},ur:{x:this.rightSE.point.x,y:t.isGreaterThan(e)?t:e}}}vector(){return{x:this.rightSE.point.x.minus(this.leftSE.point.x),y:this.rightSE.point.y.minus(this.leftSE.point.y)}}isAnEndpoint(t){return t.x.eq(this.leftSE.point.x)&&t.y.eq(this.leftSE.point.y)||t.x.eq(this.rightSE.point.x)&&t.y.eq(this.rightSE.point.y)}comparePoint(t){return te.orient(this.leftSE.point,t,this.rightSE.point)}getIntersection(t){const e=this.bbox(),i=t.bbox(),s=ie(e,i);if(null===s)return null;const o=this.leftSE.point,n=this.rightSE.point,r=t.leftSE.point,a=t.rightSE.point,l=ee(e,r)&&0===this.comparePoint(r),c=ee(i,o)&&0===t.comparePoint(o),h=ee(e,a)&&0===this.comparePoint(a),d=ee(i,n)&&0===t.comparePoint(n);if(c&&l)return d&&!h?n:!d&&h?a:null;if(c)return h&&o.x.eq(a.x)&&o.y.eq(a.y)?null:o;if(l)return d&&n.x.eq(r.x)&&n.y.eq(r.y)?null:r;if(d&&h)return null;if(d)return n;if(h)return a;const p=((t,e,i,s)=>{if(e.x.isZero())return ce(i,s,t.x);if(s.x.isZero())return ce(t,e,i.x);if(e.y.isZero())return le(i,s,t.y);if(s.y.isZero())return le(t,e,i.y);const o=se(e,s);if(o.isZero())return null;const n={x:i.x.minus(t.x),y:i.y.minus(t.y)},r=se(n,e).div(o),a=se(n,s).div(o),l=t.x.plus(a.times(e.x)),c=i.x.plus(r.times(s.x)),h=t.y.plus(a.times(e.y)),d=i.y.plus(r.times(s.y));return{x:l.plus(c).div(2),y:h.plus(d).div(2)}})(o,this.vector(),r,t.vector());return null===p?null:ee(s,p)?te.snap(p):null}split(e){const i=[],s=void 0!==e.events,o=new he(e,!0),n=new he(e,!1),r=this.rightSE;this.replaceRightSE(n),i.push(n),i.push(o);const a=new t(o,r,this.rings.slice(),this.windings.slice());return he.comparePoints(a.leftSE.point,a.rightSE.point)>0&&a.swapEvents(),he.comparePoints(this.leftSE.point,this.rightSE.point)>0&&this.swapEvents(),s&&(o.checkForConsuming(),n.checkForConsuming()),i}swapEvents(){const t=this.rightSE;this.rightSE=this.leftSE,this.leftSE=t,this.leftSE.isLeft=!0,this.rightSE.isLeft=!1;for(let t=0,e=this.windings.length;t<e;t++)this.windings[t]*=-1}consume(e){let i=this,s=e;for(;i.consumedBy;)i=i.consumedBy;for(;s.consumedBy;)s=s.consumedBy;const o=t.compare(i,s);if(0!==o){if(o>0){const t=i;i=s,s=t}if(i.prev===s){const t=i;i=s,s=t}for(let t=0,e=s.rings.length;t<e;t++){const e=s.rings[t],o=s.windings[t],n=i.rings.indexOf(e);-1===n?(i.rings.push(e),i.windings.push(o)):i.windings[n]+=o}s.rings=null,s.windings=null,s.consumedBy=i,s.leftSE.consumedBy=i.leftSE,s.rightSE.consumedBy=i.rightSE}}prevInResult(){return void 0!==this._prevInResult||(this.prev?this.prev.isInResult()?this._prevInResult=this.prev:this._prevInResult=this.prev.prevInResult():this._prevInResult=null),this._prevInResult}beforeState(){if(void 0!==this._beforeState)return this._beforeState;if(this.prev){const t=this.prev.consumedBy||this.prev;this._beforeState=t.afterState()}else this._beforeState={rings:[],windings:[],multiPolys:[]};return this._beforeState}afterState(){if(void 0!==this._afterState)return this._afterState;const t=this.beforeState();this._afterState={rings:t.rings.slice(0),windings:t.windings.slice(0),multiPolys:[]};const e=this._afterState.rings,i=this._afterState.windings,s=this._afterState.multiPolys;for(let t=0,s=this.rings.length;t<s;t++){const s=this.rings[t],o=this.windings[t],n=e.indexOf(s);-1===n?(e.push(s),i.push(o)):i[n]+=o}const o=[],n=[];for(let t=0,s=e.length;t<s;t++){if(0===i[t])continue;const s=e[t],r=s.poly;if(-1===n.indexOf(r))if(s.isExterior)o.push(r);else{-1===n.indexOf(r)&&n.push(r);const t=o.indexOf(s.poly);-1!==t&&o.splice(t,1)}}for(let t=0,e=o.length;t<e;t++){const e=o[t].multiPoly;-1===s.indexOf(e)&&s.push(e)}return this._afterState}isInResult(){if(this.consumedBy)return!1;if(void 0!==this._isInResult)return this._isInResult;const t=this.beforeState().multiPolys,e=this.afterState().multiPolys;switch(ge.type){case"union":{const i=0===t.length,s=0===e.length;this._isInResult=i!==s;break}case"intersection":{let i,s;t.length<e.length?(i=t.length,s=e.length):(i=e.length,s=t.length),this._isInResult=s===ge.numMultiPolys&&i<s;break}case"xor":{const i=Math.abs(t.length-e.length);this._isInResult=i%2==1;break}case"difference":{const i=t=>1===t.length&&t[0].isSubject;this._isInResult=i(t)!==i(e);break}}return this._isInResult}},be=class{poly;isExterior;segments;bbox;constructor(t,e,i){if(!Array.isArray(t)||0===t.length)throw new Error("Input geometry is not a valid Polygon or MultiPolygon");if(this.poly=e,this.isExterior=i,this.segments=[],"number"!=typeof t[0][0]||"number"!=typeof t[0][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const s=te.snap({x:new Ht(t[0][0]),y:new Ht(t[0][1])});this.bbox={ll:{x:s.x,y:s.y},ur:{x:s.x,y:s.y}};let o=s;for(let e=1,i=t.length;e<i;e++){if("number"!=typeof t[e][0]||"number"!=typeof t[e][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const i=te.snap({x:new Ht(t[e][0]),y:new Ht(t[e][1])});i.x.eq(o.x)&&i.y.eq(o.y)||(this.segments.push(ve.fromRing(o,i,this)),i.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.x),i.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.y),i.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.x),i.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.y),o=i)}s.x.eq(o.x)&&s.y.eq(o.y)||this.segments.push(ve.fromRing(o,s,this))}getSweepEvents(){const t=[];for(let e=0,i=this.segments.length;e<i;e++){const i=this.segments[e];t.push(i.leftSE),t.push(i.rightSE)}return t}},ye=class{multiPoly;exteriorRing;interiorRings;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");this.exteriorRing=new be(t[0],this,!0),this.bbox={ll:{x:this.exteriorRing.bbox.ll.x,y:this.exteriorRing.bbox.ll.y},ur:{x:this.exteriorRing.bbox.ur.x,y:this.exteriorRing.bbox.ur.y}},this.interiorRings=[];for(let e=1,i=t.length;e<i;e++){const i=new be(t[e],this,!1);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.interiorRings.push(i)}this.multiPoly=e}getSweepEvents(){const t=this.exteriorRing.getSweepEvents();for(let e=0,i=this.interiorRings.length;e<i;e++){const i=this.interiorRings[e].getSweepEvents();for(let e=0,s=i.length;e<s;e++)t.push(i[e])}return t}},we=class{isSubject;polys;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");try{"number"==typeof t[0][0][0]&&(t=[t])}catch(t){}this.polys=[],this.bbox={ll:{x:new Ht(Number.POSITIVE_INFINITY),y:new Ht(Number.POSITIVE_INFINITY)},ur:{x:new Ht(Number.NEGATIVE_INFINITY),y:new Ht(Number.NEGATIVE_INFINITY)}};for(let e=0,i=t.length;e<i;e++){const i=new ye(t[e],this);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.polys.push(i)}this.isSubject=e}getSweepEvents(){const t=[];for(let e=0,i=this.polys.length;e<i;e++){const i=this.polys[e].getSweepEvents();for(let e=0,s=i.length;e<s;e++)t.push(i[e])}return t}},ke=(t,...e)=>ge.run("union",t,e),xe=(t,...e)=>ge.run("intersection",t,e),$e=(t,...e)=>ge.run("difference",t,e);function Se(t){const e=Math.max(0,Math.min(120,(t-40)/140*120));return`hsl(${Math.round(e)}, 85%, 55%)`}function Me(t,e){if(!(Number.isFinite(t)&&e>0))return t;const i=Math.round(t/e)*e;return Math.abs(i-t)<=1e-9*e?t:i}function Ce(t,e){if(e){const e=t/2.54;let i=Math.floor(e/12),s=Math.round(e-12*i);return 12===s&&(i+=1,s=0),`${i}′ ${s}″`}return`${(t/100).toFixed(2)} m`}function De(t,e,i=1){const s=t[0].toFixed(i),o=t[1].toFixed(i),n=e[0].toFixed(i),r=e[1].toFixed(i),a=s<n||s===n&&o<=r,[l,c,h,d]=a?[s,o,n,r]:[n,r,s,o];return`${l},${c}-${h},${d}`}function ze(t){return t?.poly?.length>=3?t.poly:t&&null!=t.x&&null!=t.y&&null!=t.w&&null!=t.h?[[t.x,t.y],[t.x+t.w,t.y],[t.x+t.w,t.y+t.h],[t.x,t.y+t.h]]:null}function Te(t){const e=[];for(const i of t||[])i?.poly?.length>=3?e.push({poly:i.poly.map(t=>t.join(",")).join(" ")}):i&&null!=i.x&&null!=i.y&&null!=i.w&&null!=i.h&&e.push({rect:{x:i.x,y:i.y,w:i.w,h:i.h,rx:.03*Math.min(i.w,i.h)}});return e}function Pe(t){const e=[],i=new Set;for(const s of t||[]){const t=ze(s);if(t)for(let s=0;s<t.length;s++){const o=t[s],n=t[(s+1)%t.length],r=De(o,n,5);i.has(r)||(i.add(r),e.push([o[0],o[1],n[0],n[1]]))}}return e}function Re(t,e,i,s={}){let o=null,n=i;for(const i of Pe(e)){const[e,r,a,l]=i,c=a-e,h=l-r,d=c*c+h*h;if(!d)continue;let p=((t[0]-e)*c+(t[1]-r)*h)/d;p=Math.max(0,Math.min(1,p));const u=[e+p*c,r+p*h],_=Math.hypot(t[0]-u[0],t[1]-u[1]);if(_<n){n=_;let t=180*Math.atan2(h,c)/Math.PI;if(t>=90?t-=180:t<-90&&(t+=180),s.step&&s.step>0){const i=Math.sqrt(d),n=Math.min(Math.max(s.length||0,0)/2,i/2);let a=Math.round(p*i/s.step)*s.step;Math.abs(p*i-i/2)<=s.step/2&&(a=i/2),a=Math.max(n,Math.min(i-n,a));const l=a/i;o={x:e+l*c,y:r+l*h,angle:t}}else o={x:u[0],y:u[1],angle:t}}}return o}function Ae(t,e,i,s,o,n=1){const r=e*Math.PI/180,a=[Math.cos(r),Math.sin(r)];let l=null,c=n;for(const e of Pe(s)){const i=[[e[0],e[1]],[e[2],e[3]]],s=e=>Math.abs(a[0]*(e[1]-t[1])-a[1]*(e[0]-t[0]));if(s(i[0])>n||s(i[1])>n)continue;const o=(i[0][0]-t[0])*a[0]+(i[0][1]-t[1])*a[1],r=(i[1][0]-t[0])*a[0]+(i[1][1]-t[1])*a[1],h=Math.min(o,r),d=Math.max(o,r),p=h>0?h:d<0?-d:0;p<c&&(c=p,l=[h,d])}if(!l)return null;const[h,d]=l,p=i/2,u=Math.max(0,-p-h),_=Math.max(0,d-p),m=e=>[t[0]+a[0]*e,t[1]+a[1]*e],g=(h+d)/2;return{wallA:m(h),wallB:m(d),sideA:u,sideB:_,midA:m((h-p)/2),midB:m((p+d)/2),wallCenter:m(g),centered:Math.abs(g)<=o}}function Ne(t,e,i=!1){if(null==e||"unavailable"===e||"unknown"===e)return"door"===t?1:0;const s=function(t){return["on","open","home","detected","playing","cleaning"].includes(String(t))}(e)!==!!i;return s?1:0}function Ee(t,e,i=.001){return Math.abs(t[0]-e[0])<i&&Math.abs(t[1]-e[1])<i}function Oe(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const[n,r]=e[s],[a,l]=e[o];r>t[1]!=l>t[1]&&t[0]<(a-n)*(t[1]-r)/(l-r)+n&&(i=!i)}return i}function Fe(t,e,i){const s=i[0]-e[0],o=i[1]-e[1],n=s*s+o*o;let r=n?((t[0]-e[0])*s+(t[1]-e[1])*o)/n:0;return r=Math.max(0,Math.min(1,r)),Math.hypot(t[0]-(e[0]+r*s),t[1]-(e[1]+r*o))}function Ie(t,e){if(!e||e.length<2)return null;let i=null,s=1/0;for(let o=0;o<e.length;o++){const n=e[o],r=e[(o+1)%e.length],a=r[0]-n[0],l=r[1]-n[1],c=a*a+l*l;let h=c?((t[0]-n[0])*a+(t[1]-n[1])*l)/c:0;h=Math.max(0,Math.min(1,h));const d=[n[0]+h*a,n[1]+h*l],p=Math.hypot(t[0]-d[0],t[1]-d[1]);p<s&&(s=p,i=d)}return i}function Le(t,e,i=1e-6){if(!e||e.length<2)return!1;for(let s=0;s<e.length;s++)if(Fe(t,e[s],e[(s+1)%e.length])<=i)return!0;return!1}function He(t,e,i=1e-6){return!(!e||e.length<3)&&(!Le(t,e,i)&&Oe(t,e))}function qe(t,e,i){return(e[0]-t[0])*(i[1]-t[1])-(e[1]-t[1])*(i[0]-t[0])}function Ue(t,e,i,s,o=1e-9){const n=qe(i,s,t),r=qe(i,s,e),a=qe(t,e,i),l=qe(t,e,s);return(n>o&&r<-o||n<-o&&r>o)&&(a>o&&l<-o||a<-o&&l>o)}function We(t,e=24){const i=t.map(t=>t[0]),s=t.map(t=>t[1]),o=Math.min(...i),n=Math.max(...i),r=Math.min(...s),a=Math.max(...s),l=Math.max(n-o,a-r)||1;let c=0,h=0,d=0;for(let e=0;e<t.length;e++){const i=t[e],s=t[(e+1)%t.length],o=i[0]*s[1]-s[0]*i[1];c+=o,h+=(i[0]+s[0])*o,d+=(i[1]+s[1])*o}const p=Math.abs(c)>1e-9?[h/(3*c),d/(3*c)]:[(o+n)/2,(r+a)/2],u=(e,i)=>{const s=((e,i)=>{if(!Oe([e,i],t))return-1/0;let s=1/0;for(let o=0;o<t.length;o++){const n=t[o],r=t[(o+1)%t.length];s=Math.min(s,Zi([e,i],[n[0],n[1],r[0],r[1]]))}return s})(e,i);return s===-1/0?s:s-.08*Math.hypot(e-p[0],i-p[1])-1e-4*l};let _=null,m=-1/0;for(let t=1;t<e;t++)for(let i=1;i<e;i++){const s=o+(n-o)*t/e,l=r+(a-r)*i/e,c=u(s,l);c>m&&(m=c,_=[s,l])}if(_){const[t,i]=_,s=(n-o)/e,l=(a-r)/e;for(let e=-4;e<=4;e++)for(let o=-4;o<=4;o++){const n=t+s*e/4,r=i+l*o/4,a=u(n,r);a>m&&(m=a,_=[n,r])}}return _||Be(t)||t[0]}function Be(t,e=1e-6){if(!t||t.length<3)return null;const i=t.length,s=[t.reduce((t,e)=>t+e[0],0)/i,t.reduce((t,e)=>t+e[1],0)/i];if(He(s,t,e))return s;for(let s=0;s<i;s++){const o=t[(s-1+i)%i],n=t[s],r=t[(s+1)%i],a=[(o[0]+n[0]+r[0])/3,(o[1]+n[1]+r[1])/3];if(He(a,t,e))return a}for(let s=0;s<i;s++)for(let o=s+2;o<i;o++){const i=[(t[s][0]+t[o][0])/2,(t[s][1]+t[o][1])/2];if(He(i,t,e))return i}return null}function je(t,e,i){let s=!0;for(const o of t){if(He(o,e,i))return!0;Le(o,e,i)||(s=!1)}if(s){const s=Be(t,i);return!!s&&He(s,e,i)}return!1}function Ve(t,e,i=1e-6){if(!t||!e||t.length<3||e.length<3)return!1;for(let i=0;i<e.length;i++)for(let s=0;s<t.length;s++)if(Ue(e[i],e[(i+1)%e.length],t[s],t[(s+1)%t.length]))return!1;for(const s of e)if(!He(s,t,i)&&!Le(s,t,i))return!1;const s=Be(e,i);return!!s&&He(s,t,i)&&Ye(e)<Ye(t)-i}function Ge(t,e,i=1e-6){if(!t||!e||t.length<3||e.length<3)return!1;for(let i=0;i<t.length;i++)for(let s=0;s<e.length;s++)if(Ue(t[i],t[(i+1)%t.length],e[s],e[(s+1)%e.length]))return!0;return!Ve(t,e,i)&&!Ve(e,t,i)&&(je(t,e,i)||je(e,t,i))}function Ke(t,e,i=1e-6){const s=e.filter(e=>Ve(t,e,i));return s.filter(t=>!s.some(e=>e!==t&&Ve(e,t,i)))}function Ye(t){if(!t||t.length<3)return 0;let e=0;for(let i=0;i<t.length;i++){const s=t[i],o=t[(i+1)%t.length];e+=s[0]*o[1]-o[0]*s[1]}return Math.abs(e)/2}function Je(t){return[[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]]}function Ze(t,e,i){for(let s=0;s<t.length;s++)if(Fe(e,t[s],t[(s+1)%t.length])<=i)return s;return-1}function Xe(t,e){const i=[];for(const s of t)i.length&&Ee(i[i.length-1],s,e)||i.push(s);return i.length>1&&Ee(i[0],i[i.length-1],e)&&i.pop(),i}function Qe(t){return t.length?Math.round(t.reduce((t,e)=>t+e,0)/t.length):null}function ti(t,e){if(e>t[2]/t[3]){const i=t[3],s=t[3]*e;return{x:t[0]-(s-t[2])/2,y:t[1],w:s,h:i}}const i=t[2],s=t[2]/e;return{x:t[0],y:t[1]-(s-t[3])/2,w:i,h:s}}function ei(t,e,i,s){if(t.length<2)return;const o=e.x+s,n=e.x+e.w-s,r=e.y+s,a=e.y+e.h-s;for(let e=0;e<60;e++){let e=!1;for(let s=0;s<t.length;s++)for(let o=s+1;o<t.length;o++){const n=t[o].x-t[s].x,r=t[o].y-t[s].y,a=Math.hypot(n,r)||.001;if(a<i){const l=(i-a)/2,c=n/a,h=r/a;t[s].x-=c*l,t[s].y-=h*l,t[o].x+=c*l,t[o].y+=h*l,e=!0}}for(const e of t)e.x=Math.max(o,Math.min(n,e.x)),e.y=Math.max(r,Math.min(a,e.y));if(!e)break}}function ii(t){if(!t)return null;const e=t.trim();return/^(https?:)?\/\//i.test(e)||e.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(e)?/^[a-z][\w+.-]*:/i.test(e)&&!/^https?:/i.test(e)?null:e:null}te.set;const si=["badge","icon_ripple","value"],oi=["info","more-info","toggle","run","cover"],ni=["glow","none","lqi","light","temp"],ri=["none","lqi","light","temp"],ai=new Set(["light","switch","fan","humidifier","cover","valve"]),li=new Set(["lock","alarm_control_panel"]),ci=new Set(["garage","door","gate"]);function hi(t){return(t||[]).find(t=>t.startsWith("cover."))||null}const di=["automation","script","scene"];const pi="—",ui="{}";function _i(t){const e=String(t??"").trim();if(!e)return null;let i=e,s="";const o=e.indexOf(":");if(o>=0)i=e.slice(0,o).trim(),s=e.slice(o+1).trim();else{const t=e.split(".");t.length>2&&(i=t.slice(0,2).join("."),s=t.slice(2).join("."))}return/^[a-z0-9_]+\.[a-z0-9_]+$/.test(i)?o>=0&&!s||s&&!/^[a-zA-Z0-9_.-]+$/.test(s)?null:s?{entity:i,attr:s}:{entity:i}:null}function mi(t,e){const i=String(t??"").trim(),s=String(e??"").trim(),o=_i(s?`${i}:${s}`:i);return o?`{${o.entity}${o.attr?`:${o.attr}`:""}}`:""}function gi(t,e,i){const s=String(e??"").trim();if(!s)return null;const o=t?.states?.[s];if(!o)return null;const n=String(i??"").trim(),r=t=>t.slice(0,60);if(n){const e=function(t){if(null==t)return null;if(Array.isArray(t)){const e=t.map(t=>null==t?"":String(t)).join(", ");return e?e.slice(0,60):null}if("object"==typeof t)return null;const e=String(t);return""===e?null:e.slice(0,60)}(o.attributes?.[n]);if(null===e)return null;const i=t?.formatEntityAttributeValue;if("function"==typeof i)try{const e=i.call(t,o,n);if("string"==typeof e&&""!==e)return{text:r(e),formatted:!0}}catch{}return{text:e,formatted:!1}}const a=o.state;if(null==a||""===a)return null;const l=t?.formatEntityState;if("function"==typeof l)try{const e=l.call(t,o);if("string"==typeof e&&""!==e)return{text:r(e),formatted:!0}}catch{}return{text:r(String(a)),formatted:!1}}function fi(t,e,i){const s=String(e??"").trim(),o=String(i??"").trim()||s;if(!o)return t.text;const n=t.formatted&&s?function(t,e){if(!e)return t;const i=t.replace(/\s+$/,"");return i.endsWith(e)?i.slice(0,i.length-e.length).replace(/\s+$/,""):t}(t.text,s):t.text;return`${n} ${o}`}function vi(t,e){const i=(e?.entity||"").trim();if(!i)return"";const s=t?.states?.[i],o=s?.state;if(!s||null==o||""===o||"unavailable"===o||"unknown"===o)return pi;const n=(e?.attr||"").trim(),r=gi(t,i,n||null);if(null===r)return pi;return fi(r,n?"":String(s.attributes?.unit_of_measurement??"").trim(),e?.unit)}const bi=20;function yi(t){const e=Number(t?.scale);if(Number.isFinite(e)&&e>0)return Math.min(20,Math.max(.15,e));return{s:.7,m:1,l:1.5}[String(t?.size??"")]??1}function wi(t,e){if(!e)return t;let i=t;for(const[t,s]of Object.entries(e))i=i.split("{"+t+"}").join(String(s));return i}const ki="#55606c",xi=.55;function $i(t){const e=t?.settings||{},i=!t?.plan_url;return{showBorders:e.show_borders??i,showNames:e.show_names??i,color:"string"==typeof e.room_color&&/^#[0-9a-f]{6}$/i.test(e.room_color)?e.room_color:ki,opacity:"number"==typeof e.room_opacity?Math.min(1,Math.max(0,e.room_opacity)):xi,fill:["lqi","light","temp","glow"].includes(e.fill_mode)?e.fill_mode:"none",tempMin:"number"==typeof e.temp_min?e.temp_min:20,tempMax:"number"==typeof e.temp_max?e.temp_max:25,showLqi:"boolean"==typeof e.show_lqi?e.show_lqi:null,cardFontScale:"number"==typeof e.card_font_scale&&e.card_font_scale>0?Math.min(3,Math.max(.5,e.card_font_scale)):1,labelTemp:!0===e.label_temp,labelHum:!0===e.label_hum,labelLqi:!0===e.label_lqi,labelLight:!0===e.label_light,bgColor:"string"==typeof e.bg_color&&/^#[0-9a-f]{6}$/i.test(e.bg_color)?e.bg_color:null,hideDecor:!0===e.hide_decor,hideOpenings:!0===e.hide_openings}}function Si(t,e){if(e.bgColor)return e.bgColor;const i=t?.bg_color;return"string"==typeof i&&/^#[0-9a-f]{6}$/i.test(i)?i:""}const Mi={light_on:{c:"#ffd45c",a:.18},light_off:{c:"#9aa0a6",a:.14},light_none:{c:"#6b7480",a:0},temp_cold:{c:"#4fc3f7",a:.18},temp_ok:{c:"#66d17a",a:.18},temp_hot:{c:"#ffd45c",a:.18},lqi_low:{c:"#f25a4a",a:.18},lqi_high:{c:"#4bd28f",a:.18},glow_base:{c:"#0d1b2a",a:.5},glow_light:{c:"#ffd9a0",a:.85},wall_fill:{c:"#ffffff",a:1}},Ci=/^#[0-9a-f]{6}$/i;function Di(t){const e={},i=t?.fill_colors||{};for(const t of Object.keys(Mi)){const s=Mi[t],o=i[t];e[t]={c:o&&"string"==typeof o.c&&Ci.test(o.c)?o.c:s.c,a:o&&"number"==typeof o.a?Math.min(1,Math.max(0,o.a)):s.a}}return e}function zi(t,e,i){const s=Math.min(1,Math.max(0,i)),o=[1,3,5].map(e=>parseInt(t.slice(e,e+2),16)),n=[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),r=o.map((t,e)=>Math.round(t+(n[e]-t)*s));return"#"+r.map(t=>t.toString(16).padStart(2,"0")).join("")}function Ti(t,e,i,s,o,n,r){if("lqi"===t){if(null==e)return null;const t=(e-40)/140;return{c:zi(r.lqi_low.c,r.lqi_high.c,t),a:r.lqi_low.a+(r.lqi_high.a-r.lqi_low.a)*Math.min(1,Math.max(0,t))}}if("light"===t)return"none"===i?r.light_none.a>0?r.light_none:null:"on"===i?r.light_on:r.light_off;if("temp"===t){if(null==s)return null;const t=Math.min(o,n),e=Math.max(o,n);return s<t?r.temp_cold:s>e?r.temp_hot:r.temp_ok}return null}const Pi={blind:["mdi:blinds","mdi:blinds-open"],shade:["mdi:blinds","mdi:blinds-open"],shutter:["mdi:window-shutter","mdi:window-shutter-open"],curtain:["mdi:curtains-closed","mdi:curtains"],window:["mdi:window-closed","mdi:window-open"],awning:["mdi:awning-outline","mdi:awning"],door:["mdi:door-closed","mdi:door-open"],garage:["mdi:garage","mdi:garage-open"],gate:["mdi:gate","mdi:gate-open"],damper:["mdi:circle-slice-8","mdi:circle-outline"]},Ri=[["mdi:roller-shade-closed","mdi:roller-shade"],["mdi:blinds-horizontal-closed","mdi:blinds-horizontal"],["mdi:garage-variant","mdi:garage-open-variant"],["mdi:door","mdi:door-open"]];function Ai(t){for(const e of[...Object.values(Pi),...Ri])if(t===e[0]||t===e[1])return e;return null}function Ni(t,e,i,s,o){if(!s||"unavailable"===s||"unknown"===s)return t;if(o){const i="cover"===e?Ai(t):null;return i?"closed"===s?i[0]:i[1]:t}if("binary_sensor"===e){if("door"===i)return"on"===s?"mdi:door-open":"mdi:door-closed";if("window"===i)return"on"===s?"mdi:window-open":"mdi:window-closed";if("garage_door"===i)return"on"===s?"mdi:garage-open-variant":"mdi:garage-variant"}if("cover"===e){const e=Pi[String(i||"")];if(e)return"closed"===s?e[0]:e[1];const o=Ai(t);return o?"closed"===s?o[0]:o[1]:t}return"lock"===e?"locked"===s?"mdi:lock":"mdi:lock-open-variant":"light"===e&&"mdi:lightbulb"===t&&"on"===s?"mdi:lightbulb-on":t}function Ei(t,e){if(!t||"on"!==t.state)return null;const i=t.attributes||{},s=Number(i.brightness),o=Number.isFinite(s)&&s>0?Math.max(.15,Math.min(1,s/255)):1,n=i.rgb_color;if(Array.isArray(n)&&n.length>=3&&n.every(t=>Number.isFinite(t)))return{c:`rgb(${n[0]}, ${n[1]}, ${n[2]})`,bri:o};const r=Number(i.color_temp_kelvin)||(Number(i.color_temp)>0?1e6/Number(i.color_temp):NaN);if(Number.isFinite(r)&&r>0){const[t,e,i]=function(t){const e=Math.min(4e4,Math.max(1e3,t))/100,i=e<=66?255:329.698727446*Math.pow(e-60,-.1332047592),s=e<=66?99.4708025861*Math.log(e)-161.1195681661:288.1221695283*Math.pow(e-60,-.0755148492),o=e>=66?255:e<=19?0:138.5177312231*Math.log(e-10)-305.0447927307,n=t=>Math.round(Math.min(255,Math.max(0,t)));return[n(i),n(s),n(o)]}(r);return{c:`rgb(${t}, ${e}, ${i})`,bri:o}}return{c:e,bri:o}}function Oi(t,e,i,s,o=170,n=0){const r=Math.hypot(e[0]-t[0],e[1]-t[1]),a=Math.hypot(i[0]-t[0],i[1]-t[1]);if(r<1e-6||a<1e-6||Math.min(r,a)>=s)return null;let l,c;if(Number.isFinite(n)&&n>1e-6){const s=i[0]-e[0],o=i[1]-e[1],r=Math.hypot(s,o);if(r<1e-6)return null;const a=-(o/r),h=s/r,d=(e[0]+i[0])/2,p=(e[1]+i[1])/2,u=(t[0]-d)*a+(t[1]-p)*h>=0?1:-1,_=n/2,m=[e[0]+a*_*u,e[1]+h*_*u],g=[i[0]+a*_*u,i[1]+h*_*u],f=[e[0]-a*_*u,e[1]-h*_*u],v=[i[0]-a*_*u,i[1]-h*_*u],b=Math.atan2(p-t[1],d-t[0]),y=e=>{let i=Math.atan2(e[1]-t[1],e[0]-t[0]);for(;i-b>Math.PI;)i-=2*Math.PI;for(;i-b<-Math.PI;)i+=2*Math.PI;return i},w=y(m),k=y(g),x=y(f),$=y(v),S=Math.max(Math.min(w,k),Math.min(x,$)),M=Math.min(Math.max(w,k),Math.max(x,$));if(!(M-S>1e-9))return null;l=S,c=M-S}else{for(l=Math.atan2(e[1]-t[1],e[0]-t[0]),c=Math.atan2(i[1]-t[1],i[0]-t[0])-l;c>Math.PI;)c-=2*Math.PI;for(;c<-Math.PI;)c+=2*Math.PI}const h=o*Math.PI/180;if(Math.abs(c)>h){const t=l+c/2;c=h*Math.sign(c),l=t-c/2}const d=[[t[0],t[1]]];for(let e=0;e<=8;e++){const i=l+c*e/8;d.push([t[0]+Math.cos(i)*s,t[1]+Math.sin(i)*s])}return d}function Fi(t,e,i,s,o){const n=e*Math.PI/180,r=[-Math.sin(n),Math.cos(n)],a=(i[0]-t[0])*r[0]+(i[1]-t[1])*r[1]>0?-1:1,l=[t[0]+r[0]*o*a,t[1]+r[1]*o*a];return s.some(t=>He(l,t,1e-9))}function Ii(t){return t.startsWith("light.")||t.startsWith("switch.")}function Li(t,e,i=1e-6){const s=[];if(!t||!e||t.length<3||e.length<3)return s;for(let o=0;o<t.length;o++){const n=t[o],r=t[(o+1)%t.length],a=r[0]-n[0],l=r[1]-n[1],c=Math.hypot(a,l);if(c<i)continue;const h=a/c,d=l/c;for(let t=0;t<e.length;t++){const o=e[t],r=e[(t+1)%e.length],a=Math.abs((o[0]-n[0])*d-(o[1]-n[1])*h),l=Math.abs((r[0]-n[0])*d-(r[1]-n[1])*h),p=Math.max(i,1e-6*c);if(a>p||l>p)continue;const u=(o[0]-n[0])*h+(o[1]-n[1])*d,_=(r[0]-n[0])*h+(r[1]-n[1])*d,m=Math.max(0,Math.min(u,_)),g=Math.min(c,Math.max(u,_));g-m>i&&s.push([n[0]+h*m,n[1]+d*m,n[0]+h*g,n[1]+d*g])}}return s}function Hi(t,e){const i=new Set([t]),s=(t,e)=>(t.open_to||[]).includes(e.id)||(e.open_to||[]).includes(t.id);let o=!0;for(;o;){o=!1;for(const t of e)if(t.id&&!i.has(t.id))for(const n of e)if(n.id&&i.has(n.id)&&s(t,n)){i.add(t.id),o=!0;break}}return i}function qi(t,e,i=1e-6){const s=[];for(const o of t){const t=[o[0],o[1]],n=[o[2],o[3]],r=n[0]-t[0],a=n[1]-t[1],l=Math.hypot(r,a);if(l<i)continue;const c=r/l,h=a/l,d=[];for(const s of e){const e=Math.abs((s[0]-t[0])*h-(s[1]-t[1])*c),o=Math.abs((s[2]-t[0])*h-(s[3]-t[1])*c),n=Math.max(i,1e-6*l);if(e>n||o>n)continue;const r=(s[0]-t[0])*c+(s[1]-t[1])*h,a=(s[2]-t[0])*c+(s[3]-t[1])*h,p=Math.max(0,Math.min(r,a)),u=Math.min(l,Math.max(r,a));u-p>i&&d.push([p,u])}if(!d.length){s.push([t[0],t[1],n[0],n[1]]);continue}d.sort((t,e)=>t[0]-e[0]);let p=0;for(const[e,o]of d)e-p>i&&s.push([t[0]+c*p,t[1]+h*p,t[0]+c*e,t[1]+h*e]),p=Math.max(p,o);l-p>i&&s.push([t[0]+c*p,t[1]+h*p,n[0],n[1]])}return s}function Ui(t,e,i=1e-6){const s=[];for(let e=0;e<t.length;e++){const i=t[e],o=t[(e+1)%t.length];s.push([i[0],i[1],o[0],o[1]])}return qi(s,e,i)}const Wi=864e5,Bi=576e5;function ji(t){const e=new Set,i=t=>{if("string"!=typeof t||!t)return;const i=Vi(t);i.startsWith("/api/houseplan/content/")&&e.add(i)};for(const e of t?.spaces||[]){i(e?.plan_url);for(const t of e?.markers||[])for(const e of t?.pdfs||[])i(e?.url)}for(const e of t?.markers||[])for(const t of e?.pdfs||[])i(t?.url);return e}function Vi(t){return t?t.startsWith("/houseplan_files/plans/")?"/api/houseplan/content/plans/_/"+t.slice(23):t.startsWith("/houseplan_files/files/")?"/api/houseplan/content/files/"+t.slice(23):t:""}function Gi(t,e){const i=e?.settings?.fill_mode;return"none"===i||"lqi"===i||"light"===i||"temp"===i?i:t}function Ki(t,e=1){const i=Number(t);return Number.isFinite(i)&&i>0?Math.min(3,Math.max(.5,i)):e}function Yi(t,e){let i=180*Math.atan2(e[1]-t[1],e[0]-t[0])/Math.PI;return i<0&&(i+=360),i}function Ji(t,e=.5){const i=(t%45+45)%45;return i<=e||45-i<=e}function Zi(t,e){const i=e[2]-e[0],s=e[3]-e[1],o=i*i+s*s;if(!o)return Math.hypot(t[0]-e[0],t[1]-e[1]);let n=((t[0]-e[0])*i+(t[1]-e[1])*s)/o;return n=Math.max(0,Math.min(1,n)),Math.hypot(t[0]-(e[0]+n*i),t[1]-(e[1]+n*s))}const Xi=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);const Qi=(t,e)=>[t[0]-e[0],t[1]-e[1]],ts=(t,e)=>[t[0]+e[0],t[1]+e[1]],es=(t,e)=>t[0]*e[0]+t[1]*e[1],is=t=>Math.hypot(t[0],t[1]);function ss(t){let e=0;for(let i=0;i<t.length;i++){const s=t[i],o=t[(i+1)%t.length];e+=s[0]*o[1]-o[0]*s[1]}return e/2}function os(t,e,i){const s=Qi(i,e),o=es(s,s);if(o<1e-12)return is(Qi(t,e));let n=es(Qi(t,e),s)/o;return n=Math.max(0,Math.min(1,n)),is(Qi(t,[e[0]+s[0]*n,e[1]+s[1]*n]))}function ns(t,e){const i=t[e],s=t[(e+1)%t.length],o=Qi(s,i),n=is(o)||1;let r=[o[1]/n,-o[0]/n];const a=[(i[0]+s[0])/2,(i[1]+s[1])/2],l=Math.max(.01*n,1e-4);return function(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const n=e[s][0],r=e[s][1],a=e[o][0],l=e[o][1];r>t[1]!=l>t[1]&&t[0]<(a-n)*(t[1]-r)/(l-r)+n&&(i=!i)}return i}([a[0]+r[0]*l,a[1]+r[1]*l],t)&&(r=[-r[0],-r[1]]),r}function rs(t,e,i,s){const o=s||ns(t,e),n=(e+1)%t.length;return t.map((t,s)=>s===e||s===n?[t[0]+o[0]*i,t[1]+o[1]*i]:[...t])}function as(t,e,i,s){const o=[],n=Qi(i,e),r=is(n);if(r<s)return o;const a=[n[0]/r,n[1]/r];for(let i=0;i<t.length;i++){const n=t[i],l=t[(i+1)%t.length],c=Math.abs((n[0]-e[0])*a[1]-(n[1]-e[1])*a[0]),h=Math.abs((l[0]-e[0])*a[1]-(l[1]-e[1])*a[0]);if(c>s||h>s)continue;const d=es(Qi(n,e),a),p=es(Qi(l,e),a),u=Math.max(0,Math.min(d,p)),_=Math.min(r,Math.max(d,p));_-u>s&&o.push([[e[0]+a[0]*u,e[1]+a[1]*u],[e[0]+a[0]*_,e[1]+a[1]*_]])}return o}function ls(t,e,i,s,o){const n=as(t,e,i,o);if(!n.length)return null;const r=t=>n.some(([e,i])=>os(t,e,i)<=o),a=t.length,l=[];for(let n=0;n<a;n++){const c=t[n],h=t[(n+1)%a];l.push(r(c)?ts(c,s):[...c]);const d=Qi(h,c),p=is(d);if(p<o)continue;const u=[d[0]/p,d[1]/p],_=is(Qi(i,e))||1,m=[(i[0]-e[0])/_,(i[1]-e[1])/_],g=Math.abs((c[0]-e[0])*m[1]-(c[1]-e[1])*m[0]),f=Math.abs((h[0]-e[0])*m[1]-(h[1]-e[1])*m[0]);if(g>o||f>o)continue;const v=es(Qi(e,c),u),b=es(Qi(i,c),u),y=Math.max(0,Math.min(v,b)),w=Math.min(p,Math.max(v,b));if(!(w-y<=o)){if(y>o&&y<p-o){const t=[c[0]+u[0]*y,c[1]+u[1]*y];l.push([...t],ts(t,s))}if(w>o&&w<p-o){const t=[c[0]+u[0]*w,c[1]+u[1]*w];l.push(ts(t,s),[...t])}}}return l}function cs(t,e=1e-6){let i=t.filter((i,s)=>is(Qi(i,t[(s+1)%t.length]))>e);for(let t=0;t<2;t++)i=i.filter((t,s)=>{const o=i[(s-1+i.length)%i.length],n=i[(s+1)%i.length],r=(t[0]-o[0])*(n[1]-o[1])-(t[1]-o[1])*(n[0]-o[0]),a=is(Qi(n,o))||1;return Math.abs(r)/a>e});return i.length>=3?i:t}function hs(t){const e=t.length;if(e<3)return!1;for(let i=0;i<e;i++)for(let s=i+1;s<e;s++)if(s!==i&&(s+1)%e!==i&&(i+1)%e!==s&&Ue(t[i],t[(i+1)%e],t[s],t[(s+1)%e]))return!1;return!0}function ds(t,e,i=1e-6){let s=1/0;for(const[o,n]of e){const e=Qi(n,o),r=is(e);if(r<i)continue;const a=[e[0]/r,e[1]/r],l=t=>(t[0]-o[0])*a[1]-(t[1]-o[1])*a[0],c=t=>(t[0]-o[0])*a[0]+(t[1]-o[1])*a[1],h=i,d=r-i;for(const e of t){const t=Math.abs(l(e));if(t<=i)continue;const o=c(e);o<=h||o>=d||t<s&&(s=t)}for(let e=0;e<t.length;e++){const o=t[e],n=t[(e+1)%t.length],r=l(o),a=l(n);if(Math.abs(r)<=i||Math.abs(a)<=i)continue;const p=c(o),u=c(n),_=Math.max(h,Math.min(p,u)),m=Math.min(d,Math.max(p,u));if(m-_<=i)continue;const g=u-p;if(Math.abs(g)<i){s=Math.min(s,Math.abs(r),Math.abs(a));continue}const f=t=>Math.abs(r+(t-p)/g*(a-r));s=Math.min(s,f(_),f(m))}}return s}function ps(t,e,i){if(Ge(t,e,i))return!0;if(Ve(t,e,i)||Ve(e,t,i))return!1;let s=0;try{const i=xe([[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]],[[...e.map(t=>[t[0],t[1]]),[e[0][0],e[0][1]]]]);for(const t of i)t?.[0]&&(s+=Ye(t[0]))}catch{return!1}return s>Math.max(1e-7,i*i)}function us(t,e,i,s,o){const n=[i.n[0]*s,i.n[1]*s],r={polys:{},openings:{},movedSpans:{}};if(Math.abs(s)<1e-9)return r;for(const e of t){if(e.id===i.roomId){r.polys[e.id]=rs(e.poly,i.edge,s,i.n),r.movedSpans[e.id]=[[ts(i.a,n),ts(i.b,n)]];continue}const t=as(e.poly,i.a,i.b,o);if(!t.length)continue;const a=ls(e.poly,i.a,i.b,n,o);a&&(r.polys[e.id]=a,r.movedSpans[e.id]=t.map(([t,e])=>[ts(t,n),ts(e,n)]))}for(const t of e)os([t.x,t.y],i.a,i.b)<=o&&(r.openings[t.id]=[t.x+n[0],t.y+n[1]]);return r}function _s(t,e,i){for(const s of e)for(let e=0;e<s.length;e++){const o=s[e],n=s[(e+1)%s.length],r=Qi(n,o),a=is(r);if(a<i)continue;const l=[r[0]/a,r[1]/a];if(Math.abs((t.x-o[0])*l[1]-(t.y-o[1])*l[0])>i)continue;const c=(t.x-o[0])*l[0]+(t.y-o[1])*l[1];if(c-t.length/2>=-i&&c+t.length/2<=a+i)return!0}return!1}function ms(t,e,i){return t.filter(t=>e.some(e=>{for(let s=0;s<e.length;s++)if(os([t.x,t.y],e[s],e[(s+1)%e.length])<=i)return!0;return!1}))}function gs(t,e,i,s,o){const{minDim:n,eps:r}=o;if(!Number.isFinite(s))return!1;if(Math.abs(s)<1e-9)return!0;const a=us(t,e,i,s,r),l=Object.keys(a.polys),c=t=>a.polys[t.id]||t.poly;for(const e of l){const s=t.find(t=>t.id===e),o=a.polys[e];if(!hs(o))return!1;const l=ss(s.poly),h=ss(o);if(Math.abs(h)<r||l*h<=0)return!1;const d=e===i.roomId?[[i.a,i.b]]:as(s.poly,i.a,i.b,r),p=ds(s.poly,d,r);if(ds(o,a.movedSpans[e]||[],r)<Math.min(n,p)-r)return!1;for(const i of t){if(i.id===e)continue;const t=c(i);if(Ve(s.poly,i.poly,r)){if(!Ve(o,t,r))return!1}else if(Ve(i.poly,s.poly,r)){if(!Ve(t,o,r))return!1}else{if(Ve(o,t,r)||Ve(t,o,r))return!1;if(ps(o,t,r))return!1}}}const h=l.map(e=>t.find(t=>t.id===e).poly),d=t.map(c);for(const t of ms(e,h,2*r)){const e=a.openings[t.id];if(!_s(e?{...t,x:e[0],y:e[1]}:t,d,2*r))return!1}return!0}function fs(t,e,i,s,o,n){const r=t=>[s[0]+(t[0]-s[0])*o,s[1]+(t[1]-s[1])*o],a={poly:t.poly.map(r),openings:{}};for(const s of e){let e=!1;for(let i=0;i<t.poly.length;i++)if(os([s.x,s.y],t.poly[i],t.poly[(i+1)%t.poly.length])<=n){e=!0;break}if(!e)continue;if(!i.some(t=>{for(let e=0;e<t.length;e++)if(os([s.x,s.y],t[e],t[(e+1)%t.length])<=n)return!0;return!1})){const t=r([s.x,s.y]);a.openings[s.id]=[t[0],t[1]]}}return a}function vs(t,e,i,s,o,n){const{minDim:r,eps:a}=n;if(!Number.isFinite(o)||o<=0)return!1;if(Math.abs(o-1)<1e-9)return!0;const l=t.find(t=>t.id===i);if(!l)return!1;const c=t.filter(t=>t.id!==i).map(t=>t.poly),h=fs(l,e,c,s,o,2*a),d=h.poly,p=function(t){const e=function(t){const e=[...t].sort((t,e)=>t[0]-e[0]||t[1]-e[1]);if(e.length<3)return e;const i=(t,e,i)=>(e[0]-t[0])*(i[1]-t[1])-(e[1]-t[1])*(i[0]-t[0]),s=[];for(const t of e){for(;s.length>=2&&i(s[s.length-2],s[s.length-1],t)<=0;)s.pop();s.push(t)}const o=[];for(let t=e.length-1;t>=0;t--){const s=e[t];for(;o.length>=2&&i(o[o.length-2],o[o.length-1],s)<=0;)o.pop();o.push(s)}return s.pop(),o.pop(),s.concat(o)}(t);if(e.length<3)return 0;let i=1/0;for(let t=0;t<e.length;t++){const s=e[t],o=e[(t+1)%e.length],n=Qi(o,s),r=is(n);if(r<1e-12)continue;const a=[n[0]/r,n[1]/r];let l=0;for(const t of e)l=Math.max(l,Math.abs((t[0]-s[0])*a[1]-(t[1]-s[1])*a[0]));l<i&&(i=l)}return Number.isFinite(i)?i:0}(l.poly);if(p*o<Math.min(r,p)-a)return!1;for(const e of t)if(e.id!==i)if(Ve(l.poly,e.poly,a)){if(!Ve(d,e.poly,a))return!1}else if(Ve(e.poly,l.poly,a)){if(!Ve(e.poly,d,a))return!1}else{if(Ve(d,e.poly,a)||Ve(e.poly,d,a))return!1;if(ps(d,e.poly,a))return!1}const u=t.map(t=>t.id===i?d:t.poly);for(const t of ms(e,[l.poly],2*a)){const e=h.openings[t.id];if(!_s(e?{...t,x:e[0],y:e[1]}:t,u,2*a))return!1}return!0}function bs(t,e,i){const s=i/e;return Ye(t)*s*s/1e4}function ys(t,e){return e?`${Math.round(10.7639*t)} ft²`:`${(Math.round(10*t)/10).toFixed(1)} m²`}const ws=[[-90,"#070c14"],[-12,"#070c14"],[-4,"#131a28"],[0,"#4a3527"],[10,"#e8ddcf"],[30,"#ffffff"],[90,"#ffffff"]],ks=t=>Math.min(1,Math.max(0,t));function xs(t){const e=Math.min(90,Math.max(-90,Number(t)||0));let i=ws[ws.length-1][1];for(let t=1;t<ws.length;t++){const[s,o]=ws[t-1],[n,r]=ws[t];if(e<=n){i=zi(o,r,(e-s)/(n-s));break}}return{bg:i,planDim:.1*ks((10-e)/16),warmth:e<0?1:ks(1-e/10)}}function $s(t,e,i=6){const s=t.angle*Math.PI/180,o=[Math.sin(s),-Math.cos(s)],n=s=>{const n=[t.x+o[0]*i*s,t.y+o[1]*i*s];return e.find(t=>t.poly.length>=3&&Oe(n,t.poly))||null},r=n(1),a=n(-1);return r&&a?null:r||a?r?{normal:[-o[0],-o[1]],roomId:r.id}:{normal:o,roomId:a.id}:null}function Ss(t,e,i){return i>0&&t[0]*e[0]+t[1]*e[1]>.05}function Ms(t,e,i,s){return[[t[0],t[1]],[e[0],e[1]],[e[0]+i[0]*s,e[1]+i[1]*s],[t[0]+i[0]*s,t[1]+i[1]*s]]}function Cs(t,e){try{const i=xe([[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]],[[...e.map(t=>[t[0],t[1]]),[e[0][0],e[0][1]]]]),s=[];for(const t of i){const e=t?.[0];!Array.isArray(e)||e.length<4||s.push(e.slice(0,e.length-1).map(t=>[t[0],t[1]]))}return s}catch{return[]}}function Ds(t,e,i,s,o,n,r){if(!(s>0))return[];const a=function(t,e){const i=function(t,e){return function(t){const e=t%360;return e<0?e+360:e}(t-e)}(t,e)*Math.PI/180;return[Math.sin(i),-Math.cos(i)]}(i,o),l=[-a[0],-a[1]],c=function(t){const e=Math.min(90,Math.max(0,t));return.7*(.8+1.7*Math.pow(1-e/90,1.6))}(s),h=[];for(const i of e){if(!(i.length>0))continue;const e=$s(i,t);if(!e||!Ss(e.normal,a,s))continue;const o=t.find(t=>t.id===e.roomId);if(!o)continue;const d=n&&n[e.roomId]||o.poly,p=i.angle*Math.PI/180,u=i.length/2,_=[-e.normal[0],-e.normal[1]],m=Math.max(0,r?.[i.id]||0),g=i.x+_[0]*m/2,f=i.y+_[1]*m/2,v=Math.cos(p)*u,b=Math.sin(p)*u,y=[g-v,f-b],w=[g+v,f+b],k=c*i.length,x=Cs(Ms(y,w,l,k),d);if(!x.length)continue;const $=l[0]*_[0]+l[1]*_[1];h.push({openingId:i.id,roomId:e.roomId,polys:x,a:y,b:w,dir:l,len:k,normal:_,depth:k*$})}return h}function zs(t){return Math.round(10*(Number(t)||0))/10}const Ts={clear:1,sunny:1,"clear-night":1,windy:1,exceptional:1,partlycloudy:.7,"windy-variant":.7,cloudy:.4,overcast:.25,fog:.25,rainy:0,pouring:0,snowy:0,"snowy-rainy":0,hail:0,lightning:0,"lightning-rainy":0};const Ps=t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=359?t:null;function Rs(t,e){const i=Ps(e?.north_deg);return null!==i?i:Ps(t?.north_deg)}function As(t,e){const i=t=>"static"===t||"daynight"===t?t:null;return i(e?.bg_mode)??i(t?.bg_mode)??"static"}function Ns(t,e){const i=e?.sun_rays;return"boolean"==typeof i?i:!0===t?.sun_rays}function Es(t){const e=t?.weather_entity;return"string"==typeof e&&e.trim()?e.trim():null}function Os(t){const e=t?.states?.["sun.sun"]?.attributes,i=Number(e?.azimuth),s=Number(e?.elevation);return Number.isFinite(i)&&Number.isFinite(s)?{azimuth:i,elevation:s}:null}const Fs={color:"#607d8b",opacity:1,widthCm:3.6,fill:!1,fillColor:"#607d8b",fillOpacity:.25},Is=(t,e=1)=>{const i=Number(t);return Number.isFinite(i)?Math.min(1,Math.max(0,i)):e},Ls=t=>{let e=Number(t);return Number.isFinite(e)?(e=(e%360+360)%360,e>180?e-360:e):0};function Hs(t,e,i){return Ls(e)?[t.x,t.y]:i([t.x,t.y])}const qs=(t,e,i)=>{const s=Number(t),o=Number.isFinite(e)&&e>0?e:5;return Number.isFinite(s)&&s>0?s/o*i:0},Us=(t,e,i)=>{const s=Number(t),o=Number.isFinite(e)&&e>0?e:5;return Number.isFinite(s)&&i>0?s/i*o:0},Ws=(t,e,i,s=Fs.widthCm)=>{const o=Number(t?.width_cm);if(Number.isFinite(o)&&o>0)return o;const n=Number(t?.width);return Number.isFinite(n)&&n>0?Us(n,e,i):s};function Bs(t,e){return{color:t.color,opacity:Is(t.opacity),width_cm:Math.max(.1,Math.min(100,Number(t.widthCm)||.1)),...e?{fill:t.fill,fill_color:t.fillColor,fill_opacity:Is(t.fillOpacity,.25)}:{}}}function js(t){const e=t.x+t.w/2,i=t.y+t.h/2,s=Ls(t.angle)*Math.PI/180,o=Math.cos(s),n=Math.sin(s),r=(t,s)=>{const r=t-e,a=s-i;return[e+r*o-a*n,i+r*n+a*o]};return[r(t.x,t.y),r(t.x+t.w,t.y),r(t.x+t.w,t.y+t.h),r(t.x,t.y+t.h)]}function Vs(t){const e=js(t),i=(t,e)=>[(t[0]+e[0])/2,(t[1]+e[1])/2],s=[(e[0][0]+e[2][0])/2,(e[0][1]+e[2][1])/2];return{points:[...e,i(e[0],e[1]),i(e[1],e[2]),i(e[2],e[3]),i(e[3],e[0]),s],segments:e.map((t,i)=>({a:t,b:e[(i+1)%4]}))}}function Gs(t,e,i,s,o,n,r,a){const l=Ls(t.angle)*Math.PI/180,c=Math.cos(l),h=Math.sin(l),d=-Math.sin(l),p=Math.cos(l),u=t.x+t.w/2,_=t.y+t.h/2,m=e>0?-t.w/2:t.w/2,g=i>0?-t.h/2:t.h/2,f=u+m*c+g*d,v=_+m*h+g*p,b=s-f,y=o-v;let w=(b*c+y*h)*(e>0?1:-1),k=(b*d+y*p)*(i>0?1:-1),x=null;if(n){const e=w/Math.max(t.w,a),i=k/Math.max(t.h,a);x=Math.max(a/Math.max(t.w,a),a/Math.max(t.h,a),e,i),w=t.w*x,k=t.h*x}if(r>0)if(n){const e=Math.max(1,Math.round(t.w/r)),i=Math.max(1,Math.round(t.h/r));if(Math.abs(t.w-e*r)<1e-6&&Math.abs(t.h-i*r)<1e-6){const s=(t,e)=>{let i=Math.abs(t),s=Math.abs(e);for(;s;)[i,s]=[s,i%s];return Math.max(1,i)},o=1/s(e,i),n=Math.max(a/t.w,a/t.h),r=Math.max(n,Math.round((x??1)/o)*o);w=t.w*r,k=t.h*r}else{t.w>=t.h?(w=Math.round(w/r)*r,k=w*(t.h/Math.max(t.w,a))):(k=Math.round(k/r)*r,w=k*(t.w/Math.max(t.h,a)))}}else w=Math.round(w/r)*r,k=Math.round(k/r)*r;w=Math.max(a,w),k=Math.max(a,k);return{x:f+(e>0?w/2:-w/2)*c+(i>0?k/2:-k/2)*d-w/2,y:v+(e>0?w/2:-w/2)*h+(i>0?k/2:-k/2)*p-k/2,w:w,h:k,angle:Ls(t.angle)||void 0}}const Ks=(t,e,i)=>{const s=i[0]-e[0],o=i[1]-e[1],n=s*s+o*o;if(n<1e-12)return[...e];const r=Math.max(0,Math.min(1,((t[0]-e[0])*s+(t[1]-e[1])*o)/n));return[e[0]+s*r,e[1]+o*r]};const Ys=1e3;function Js(t,e){const i=Number(t),s=Number.isFinite(i)&&i>0?i:1,o=s>=1?e:e*s,n=s>=1?e/s:e;return{x:(e-o)/2,y:(e-n)/2,w:o,h:n}}const Zs=.01,Xs=100;function Qs(t,e=1e3){const i=Js(t?.plan_aspect,e),s=Number(t?.plan_scale),o=Number.isFinite(s)&&s>0?Math.min(Xs,Math.max(Zs,s)):1,n=Number(t?.plan_scale_x),r=Number(t?.plan_scale_y),a=Number.isFinite(n)&&n>0?Math.min(Xs,Math.max(Zs,n)):o,l=Number.isFinite(r)&&r>0?Math.min(Xs,Math.max(Zs,r)):o,c=Number(t?.plan_x),h=Number(t?.plan_y),d=Ls(t?.plan_angle);return{x:i.x+(Number.isFinite(c)?ho(c):0)*e,y:i.y+(Number.isFinite(h)?ho(h):0)*e,w:i.w*a,h:i.h*l,...d?{angle:d}:{}}}function to(t){if(null==t.x||null==t.y)return{x:t.x,y:t.y,w:t.w,h:t.h};const e=Number(t.w)||0,i=Number(t.h)||0;return{x:e<0?t.x+e:t.x,y:i<0?t.y+i:t.y,w:Math.abs(e),h:Math.abs(i)}}function eo(t){return t&&Array.isArray(t.spaces)?t.spaces.map(t=>{const e=Ys,i=function(t){return Array.isArray(t)&&4===t.length&&t.every(t=>Number.isFinite(t))&&t[2]>1e-6&&t[3]>1e-6?t:[0,0,1,1]}(t.view_box);return{id:t.id,title:t.title,vb:[i[0]*Ys,i[1]*e,i[2]*Ys,i[3]*e],bg:t.plan_url?{href:Vi(t.plan_url),...Qs(t,Ys)}:null,rooms:(t.rooms||[]).map(t=>{const i={...t,...to(t)};return{id:i.id,name:i.name,area:i.area??null,open_to:i.open_to||void 0,settings:i.settings||void 0,x:null!=i.x?i.x*Ys:void 0,y:null!=i.y?i.y*e:void 0,w:null!=i.w?i.w*Ys:void 0,h:null!=i.h?i.h*e:void 0,poly:i.poly?i.poly.map(t=>[t[0]*Ys,t[1]*e]):void 0}})}}):[]}const io=5e3,so=io*Ys,oo=240,no=Ys/oo,ro=1/oo;function ao(t){if(!Number.isFinite(t))return t;const e=Math.round(t*oo/Ys)*Ys/oo;return Math.abs(e-t)<=1e-9*no?t:e}function lo(t){return{x:ao(t.x),y:ao(t.y)}}function co(t){return Number.isFinite(t)?Math.min(so,Math.max(-so,t)):0}function ho(t){return Number.isFinite(t)?Math.min(io,Math.max(-io,t)):0}const po=1/3,uo=200;function _o(t){let e=1/0,i=1/0,s=-1/0,o=-1/0;for(const n of t){const t=Number(n[0]),r=Number(n[1]);Number.isFinite(t)&&Number.isFinite(r)&&(t<e&&(e=t),r<i&&(i=r),t>s&&(s=t),r>o&&(o=r))}return e>s?null:{minX:e,minY:i,maxX:s,maxY:o}}function mo(t){return t.poly&&t.poly.length?_o(t.poly):null==t.x||null==t.y?null:_o([[t.x,t.y],[t.x+(t.w||0),t.y+(t.h||0)]])}function go(t,e){const i=[];for(const e of t.rooms||[]){const t=mo(e);t&&i.push(t)}if(t.bg){const e=_o(js(t.bg));e&&i.push(e)}for(const t of e||[])if(Array.isArray(t)){const e=_o([t]);e&&i.push(e)}else i.push(t);return i}const fo=t=>{if(!t.length)return 0;const e=[...t].sort((t,e)=>t-e),i=e.length>>1;return e.length%2?e[i]:(e[i-1]+e[i])/2},vo=t=>{let e=1/0,i=1/0,s=-1/0,o=-1/0;for(const n of t)n.minX<e&&(e=n.minX),n.minY<i&&(i=n.minY),n.maxX>s&&(s=n.maxX),n.maxY>o&&(o=n.maxY);return e>s||i>o?null:{x:e,y:i,w:s-e,h:o-i}};function bo(t,e){let{x:i,y:s,w:o,h:n}=t;o<30&&(i=i+o/2-100,o=uo),n<30&&(s=s+n/2-100,n=uo);const r=Math.max(o,n)*e;return{x:i-r,y:s-r,w:o+2*r,h:n+2*r}}function yo(t,e={}){const i=e.pad??.05,s=e.k??10,o=e.minSpread??50,n=t.filter(t=>Number.isFinite(t.minX)&&Number.isFinite(t.minY)&&Number.isFinite(t.maxX)&&Number.isFinite(t.maxY)&&Math.abs(t.minX)<=so&&Math.abs(t.maxX)<=so&&Math.abs(t.minY)<=so&&Math.abs(t.maxY)<=so);if(!n.length)return{core:null,all:null,outliers:0};const r=vo(n);if(n.length<4){const t=bo(r,i);return{core:t,all:t,outliers:0}}const a=n.map(t=>(t.minX+t.maxX)/2),l=n.map(t=>(t.minY+t.maxY)/2),c=fo(a),h=fo(l),d=n.map((t,e)=>Math.max(Math.abs(a[e]-c),Math.abs(l[e]-h))),p=Math.max(((t,e)=>t.length?t[Math.min(t.length-1,Math.max(0,Math.round(e*(t.length-1))))]:0)([...d].sort((t,e)=>t-e),.75),o),u=d.map(t=>t>s*p),_=u.filter(Boolean).length,m=_&&_<=n.length*po?n.filter((t,e)=>!u[e]):n;return{core:bo(vo(m)||r,i),all:bo(r,i),outliers:m===n?0:_}}function wo(t,e,i=.05){const s=yo(go(t,e),{pad:i});if(s.core)return s.core;const o=t.vb&&4===t.vb.length&&t.vb[2]>0&&t.vb[3]>0?t.vb:[0,0,Ys,Ys];return{x:o[0],y:o[1],w:o[2],h:o[3]}}function ko(t){const e=wo(t);return{x:e.x+e.w/2,y:e.y+e.h/2}}function xo(t){const e=[];for(const i of t.rooms||[]){const t=mo(i);t&&e.push(t)}const i=yo(e,{pad:0}).core;return i?Math.max(Ys,Math.min(so,Math.max(i.w,i.h))):Ys}function $o(t,e,i,s=1){const o=Number(i),n=Number.isFinite(s)&&s>0?s:1;return!Number.isFinite(o)||o<=0?t*n:t*xo(e)*n/o}const So=[1,2,5,10,20,50,100,200,500,1e3];function Mo(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}function Co(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}const Do=["furniture","appliance","sanitary","other"],zo=[{id:"sofa",group:"furniture",w:220,h:90,g:[["r",0,0,1,1],["l",.09,.26,.91,.26],["l",.09,.26,.09,1],["l",.91,.26,.91,1],["l",.5,.26,.5,1]]},{id:"armchair",group:"furniture",w:90,h:85,g:[["r",0,0,1,1],["l",.14,.28,.86,.28],["l",.14,.28,.14,1],["l",.86,.28,.86,1]]},{id:"coffee_table",group:"furniture",w:110,h:60,g:[["r",0,0,1,1],["r",.08,.14,.84,.72]]},{id:"table_dining",group:"furniture",w:140,h:80,g:[["r",0,0,1,1],["r",.06,.11,.88,.78]]},{id:"table_round",group:"furniture",w:120,h:120,g:[["e",.5,.5,.5,.5],["e",.5,.5,.41,.41]]},{id:"chair",group:"furniture",w:45,h:45,g:[["r",0,0,1,.18],["r",.06,.18,.88,.8]]},{id:"desk",group:"furniture",w:120,h:60,g:[["r",0,0,1,1],["r",.63,.07,.31,.86],["l",.63,.5,.94,.5]]},{id:"bed_double",group:"furniture",w:160,h:200,g:[["r",0,0,1,1],["r",0,0,1,.07],["r",.06,.1,.4,.15],["r",.54,.1,.4,.15],["l",0,.33,1,.33]]},{id:"bed_single",group:"furniture",w:90,h:200,g:[["r",0,0,1,1],["r",0,0,1,.07],["r",.15,.1,.7,.15],["l",0,.33,1,.33]]},{id:"nightstand",group:"furniture",w:45,h:40,g:[["r",0,0,1,1],["r",.12,.14,.76,.33],["r",.12,.53,.76,.33]]},{id:"wardrobe",group:"furniture",w:100,h:60,g:[["r",0,0,1,1],["l",0,.72,1,.72],["l",.5,.72,.5,1]]},{id:"bookshelf",group:"furniture",w:80,h:30,g:[["r",0,0,1,1],["l",.34,0,.34,1],["l",.67,0,.67,1]]},{id:"fridge",group:"appliance",w:60,h:65,g:[["r",0,0,1,1],["l",0,.36,1,.36],["l",.83,.44,.83,.64]]},{id:"stove",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["e",.29,.31,.15,.15],["e",.71,.31,.15,.15],["e",.29,.71,.15,.15],["e",.71,.71,.15,.15]]},{id:"dishwasher",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["r",.1,.12,.8,.76],["e",.5,.5,.27,.27],["e",.5,.5,.13,.13]]},{id:"washer",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["l",.08,.17,.92,.17],["e",.5,.57,.3,.3],["e",.5,.57,.14,.14]]},{id:"dryer",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["l",.08,.17,.92,.17],["e",.5,.57,.3,.3],["p",.36,.5,.5,.64,.64,.5]]},{id:"tv",group:"appliance",w:120,h:30,g:[["r",0,0,1,.42],["l",.5,.42,.5,.72],["l",.3,.72,.7,.72]]},{id:"ac",group:"appliance",w:90,h:25,g:[["r",0,0,1,1],["l",.05,.55,.95,.55],["l",.05,.79,.95,.79]]},{id:"water_heater",group:"appliance",w:45,h:45,g:[["e",.5,.5,.5,.5],["e",.5,.5,.31,.31]]},{id:"toilet",group:"sanitary",w:40,h:70,g:[["r",.06,0,.88,.2],["e",.5,.58,.37,.35],["e",.5,.58,.22,.2]]},{id:"bathtub",group:"sanitary",w:170,h:75,g:[["r",0,0,1,1],["r",.05,.11,.77,.78],["e",.89,.5,.045,.1]]},{id:"shower",group:"sanitary",w:90,h:90,g:[["r",0,0,1,1],["l",0,0,1,1],["l",1,0,0,1],["e",.5,.5,.08,.08]]},{id:"sink",group:"sanitary",w:60,h:45,g:[["r",0,0,1,1],["e",.5,.6,.34,.3],["e",.5,.15,.07,.07]]},{id:"kitchen_sink",group:"sanitary",w:80,h:60,g:[["r",0,0,1,1],["r",.06,.24,.44,.64],["r",.54,.24,.4,.64],["e",.5,.12,.06,.06]]},{id:"bidet",group:"sanitary",w:40,h:55,g:[["e",.5,.5,.44,.5],["e",.5,.5,.26,.3]]},{id:"stairs",group:"other",w:100,h:280,g:[["r",0,0,1,1],["l",0,.111,1,.111],["l",0,.222,1,.222],["l",0,.333,1,.333],["l",0,.444,1,.444],["l",0,.556,1,.556],["l",0,.667,1,.667],["l",0,.778,1,.778],["l",0,.889,1,.889],["l",.5,.93,.5,.06],["p",.38,.16,.5,.06,.62,.16]]},{id:"fireplace",group:"other",w:120,h:40,g:[["r",0,0,1,1],["p",.22,1,.22,.42,.78,.42,.78,1]]},{id:"plant",group:"other",w:40,h:40,g:[["e",.5,.5,.22,.22],["l",.5,.28,.5,.02],["l",.5,.72,.5,.98],["l",.28,.5,.02,.5],["l",.72,.5,.98,.5],["l",.34,.34,.13,.13],["l",.66,.66,.87,.87],["l",.66,.34,.87,.13],["l",.34,.66,.13,.87]]},{id:"rug",group:"other",w:200,h:140,g:[["r",0,0,1,1],["r",.06,.09,.88,.82]]}],To=new Map(zo.map(t=>[t.id,t]));function Po(t){return t&&To.get(t)||null}function Ro(t){return zo.filter(e=>e.group===t)}function Ao(t,e,i=no,s=1e3){const o=Number(e)>0?Number(e):5;return(Number(t)||0)/o*i/s}const No=5e-4,Eo=io;function Oo(t){return Number.isFinite(t)?Math.max(No,Math.min(Eo,t)):No}const Fo=t=>{const e=Math.round(1e3*t)/1e3;return Object.is(e,-0)?"0":String(e)};function Io(t,e,i){const s=Po(t);if(!(s&&e>0&&i>0))return"";const o=t=>Fo(t*e),n=t=>Fo(t*i),r=[];for(const t of s.g)if("r"===t[0]){const[,e,i,s,a]=t;r.push(`M${o(e)} ${n(i)}H${o(e+s)}V${n(i+a)}H${o(e)}Z`)}else if("l"===t[0]){const[,e,i,s,a]=t;r.push(`M${o(e)} ${n(i)}L${o(s)} ${n(a)}`)}else if("e"===t[0]){const[,s,a,l,c]=t;r.push(`M${o(s-l)} ${n(a)}A${Fo(l*e)} ${Fo(c*i)} 0 0 1 ${o(s+l)} ${n(a)}A${Fo(l*e)} ${Fo(c*i)} 0 0 1 ${o(s-l)} ${n(a)}Z`)}else{const e=t.slice(1);if(e.length<4)continue;let i=`M${o(e[0])} ${n(e[1])}`;for(let t=2;t+1<e.length;t+=2)i+=`L${o(e[t])} ${n(e[t+1])}`;r.push(i)}return r.join("")}const Lo=t=>{let e=(t%360+360)%360;return e>180&&(e-=360),e};function Ho(t,e,i,s,o,n=0){let r=null,a=o;for(const o of s){const[s,l,c,h]=o,d=c-s,p=h-l,u=d*d+p*p;if(!u)continue;const _=Math.sqrt(u);let m=((t-s)*d+(e-l)*p)/u;m=Math.max(0,Math.min(1,m));let g=s+m*d,f=l+m*p;const v=Math.hypot(t-g,e-f);if(!(v<a))continue;a=v;let b=t-g,y=e-f;const w=Math.hypot(b,y);if(w<1e-9?(b=p/_,y=-d/_):(b/=w,y/=w),n>0){const t=Math.round(m*_/n)*n;g=s+t/_*d,f=l+t/_*p}r={cx:g+b*(i/2),cy:f+y*(i/2),angle:Lo(180*Math.atan2(-b,y)/Math.PI),dist:v}}return r}function qo(t,e){return Number.isFinite(t)&&t>0&&Number.isFinite(e)&&e>0&&t*e<3}function Uo(t){return Number.isFinite(t)?Math.max(1,Math.min(100,t)):1}function Wo(t,e){return!Number.isFinite(t)||t<=0?"":String(e?Math.round(t/2.54*100)/100:Math.round(100*t)/100)}function Bo(t,e){const i="number"==typeof t?t:parseFloat(String(t).trim().replace(",","."));if(!Number.isFinite(i)||i<=0)return null;return Uo(e?2.54*i:i)}function jo(t,e,i){const s=Number(e)>0?Number(e):5;return Uo(t)/s*i}function Vo(t,e){return e>0&&Number.isFinite(t)?Math.round(t/e)*e:t}function Go(t,e){let i=e[0]-t[0],s=e[1]-t[1];const o=Math.hypot(i,s);return o<1e-12?[1,0]:(i/=o,s/=o,(i<-1e-12||Math.abs(i)<=1e-12&&s<0)&&(i=-i,s=-s),[i,s])}function Ko(t,e,i){const s=Vo((t[0]+e[0])/2,i),o=Vo((t[1]+e[1])/2,i),[n,r]=Go(t,e);let a=Math.atan2(r,n);a<0&&(a+=Math.PI);const l=Math.round(1800*a)/1800,c=i>0&&i<.01?6:i<1?4:2;return`${s.toFixed(c)},${o.toFixed(c)}@${l.toFixed(4)}`}function Yo(t,e,i,s){return 1===s?Ko(t,e,i):Ko([t[0]/s,t[1]/s],[e[0]/s,e[1]/s],i)}function Jo(t,e){if(!Array.isArray(t.a)||!Array.isArray(t.b)||t.a.length<2||t.b.length<2)return null;const i=[Number(t.a[0]),Number(t.a[1]),Number(t.b[0]),Number(t.b[1])];if(!i.every(Number.isFinite))return null;const s=e>0?e:1;return[[i[0]*s,i[1]*s],[i[2]*s,i[3]*s]]}function Zo(t,e,i,s,o){const n=o>0?o:1;return{key:Yo(t,e,s,n),cm:Uo(i),a:[t[0]/n,t[1]/n],b:[e[0]/n,e[1]/n]}}function Xo(t,e){const i=e>0?e:1,s=[];for(const e of t){const t=e.key.lastIndexOf("@");if(t<0)continue;const[o,n]=e.key.slice(0,t).split(",").map(Number),r=Number(e.key.slice(t+1));[o,n,r].every(Number.isFinite)&&s.push({w:e,x:o*i,y:n*i,ang:r})}return s}function Qo(t,e){const[i,s]=Go(t,e);let o=Math.atan2(s,i);return o<0&&(o+=Math.PI),o}function tn(t,e){let i=Math.abs(t-e);return i>Math.PI/2&&(i=Math.PI-i),i<.02}function en(t,e,i,s,o=1){if(!t?.length)return null;const n=Yo(e,i,s,o),r=t.find(t=>t.key===n);if(r)return r;const a=o>0?o:1,l=(e[0]+i[0])/2,c=(e[1]+i[1])/2,h=Qo(e,i),d=Math.max(.5*s,1e-9)*a;for(const e of Xo(t,a))if(tn(e.ang,h)&&Math.hypot(e.x-l,e.y-c)<=d)return e.w;return null}function sn(t,e,i,s,o=1){const n=en(t,e,i,s,o);return n&&n.cm>0?Uo(n.cm):0}function on(t,e,i,s=1,o=[]){if(!t?.length)return[];const n=new Set,r=Pe(e);for(const t of r)n.add(Yo([t[0],t[1]],[t[2],t[3]],i,s));const a=e||[],l=Math.max(i*s*.02,1e-9);for(let t=0;t<a.length;t++){const e=ze(a[t]);if(e)for(let o=t+1;o<a.length;o++){const t=ze(a[o]);if(t)for(const o of Li(e,t,l))n.add(Yo([o[0],o[1]],[o[2],o[3]],i,s))}}for(const e of a){if(!e?.id)continue;const r=vn(a,e.id,o,i,s,t);if(r)for(let t=0;t<r.poly.length;t++)n.add(Yo(r.poly[t],r.poly[(t+1)%r.poly.length],i,s))}return t.filter(t=>(n.has(t.key)||(t=>{const e=Jo(t,s);if(!e)return!1;const[i,n]=e,a=n[0]-i[0],c=n[1]-i[1],h=Math.hypot(a,c);if(h<=l)return!1;if(!r.some(t=>{const e=[t[0],t[1]],s=[t[2],t[3]];return tn(Qo(i,n),Qo(e,s))&&$n(i[0],i[1],e[0],e[1],s[0],s[1])<=l&&$n(n[0],n[1],e[0],e[1],s[0],s[1])<=l}))return!1;const d=(o||[]).some(t=>{const e=[t[0],t[1]],s=[t[2],t[3]];if(!tn(Qo(i,n),Qo(e,s)))return!1;const o=t=>Math.abs((t[0]-i[0])*c-(t[1]-i[1])*a)/h;if(o(e)>l||o(s)>l)return!1;const r=h*h,d=((e[0]-i[0])*a+(e[1]-i[1])*c)/r,p=((s[0]-i[0])*a+(s[1]-i[1])*c)/r;return Math.min(1,Math.max(d,p))-Math.max(0,Math.min(d,p))>l/h});return!d})(t))&&t.cm>=1&&t.cm<=100)}function nn(t,e,i,s=8){const[o,n]=Go(t,e);let r=Math.atan2(n,o);r<0&&(r+=Math.PI);let a=i*Math.PI/180%Math.PI;a<0&&(a+=Math.PI);let l=Math.abs(r-a);return l>Math.PI/2&&(l=Math.PI-l),l<=s*Math.PI/180}function rn(t,e,i,s,o=1){if(!t?.length)return[];if(e.length!==i.length)return t.slice();const n=new Map;for(let t=0;t<e.length;t++){const[r,a]=e[t],[l,c]=i[t],h=Yo(r,a,s,o),d=Yo(l,c,s,o);h!==d&&n.set(h,d)}const r=o>0?o:1,a=Math.max(.5*s,1e-9)*r,l=new Set,c=[];for(const o of t){let t="",h=null;const d=Jo(o,r);if(d)for(let o=0;o<e.length;o++){const[n,l]=e[o],[c,p]=i[o];if(!tn(Qo(d[0],d[1]),Qo(n,l)))continue;if($n(d[0][0],d[0][1],n[0],n[1],l[0],l[1])>a||$n(d[1][0],d[1][1],n[0],n[1],l[0],l[1])>a)continue;const u=l[0]-n[0],_=l[1]-n[1],m=u*u+_*_;if(m<1e-18)continue;const g=t=>{const e=Math.max(0,Math.min(1,((t[0]-n[0])*u+(t[1]-n[1])*_)/m));return[c[0]+(p[0]-c[0])*e,c[1]+(p[1]-c[1])*e]};h=[g(d[0]),g(d[1])],t=Yo(h[0],h[1],s,r);break}if(d||(t=n.get(o.key)||""),!t){const n=Xo([o],r)[0];if(n)for(let o=0;o<e.length;o++){const[l,c]=e[o],[h,d]=i[o];if(!tn(n.ang,Qo(l,c)))continue;const p=c[0]-l[0],u=c[1]-l[1],_=p*p+u*u;if(_<1e-18)continue;const m=((n.x-l[0])*p+(n.y-l[1])*u)/_;if(m<-1e-6||m>1.000001)continue;if($n(n.x,n.y,l[0],l[1],c[0],c[1])>a)continue;const g=h[0]+(d[0]-h[0])*Math.max(0,Math.min(1,m)),f=h[1]+(d[1]-h[1])*Math.max(0,Math.min(1,m)),[v,b]=Go(h,d),y=Math.max(s*r,1e-6);t=Yo([g-v*y,f-b*y],[g+v*y,f+b*y],s,r);break}}t||(t=o.key),l.has(t)||(l.add(t),c.push(h?Zo(h[0],h[1],o.cm,s,r):{...o,key:t,cm:Uo(o.cm)}))}return c}function an(t,e,i,s,o,n=1){const r=Yo(e,i,o,n),a=(t||[]).filter(t=>t.key!==r);return null==s||s<1?a:[...a,Zo(e,i,s,o,n)]}function ln(t,e,i,s,o,n=[],r=1){let a=t?t.slice():[];for(const t of function(t,e,i,s,o=1,n=[]){const r=vn(t,e,i,s,o,n);if(!r)return[];const a=[];for(let t=0;t<r.poly.length;t++){const e=r.poly[t],n=r.poly[(t+1)%r.poly.length];hn(e,n,i,s,o)||a.push({a:e,b:n})}return a}(e,i,n,o,r,a))a=an(a,t.a,t.b,s,o,r);return a}function cn(t,e,i){if(!(e>0)||!t||t.length<2)return"";if(i&&t.length>=3){let i=t;const s=t[t.length-1];if(t.length>=4&&Math.hypot(t[0][0]-s[0],t[0][1]-s[1])<1e-9&&(i=t.slice(0,-1)),i.length>=3){const t=i.map(()=>e),s=Dn(i,t),o=mn(i,t);if(s&&o)return`${gn(s)} ${gn(fn(o))}`}}let s="";for(let i=0;i<t.length-1;i++){const o=t[i],n=t[i+1],r=n[0]-o[0],a=n[1]-o[1],l=Math.hypot(r,a);if(l<1e-9)continue;const c=-(a/l),h=r/l,d=e;s+=(s?" ":"")+gn([[o[0]+c*d,o[1]+h*d],[n[0]+c*d,n[1]+h*d],[n[0]-c*d,n[1]-h*d],[o[0]-c*d,o[1]-h*d]])}return s}function hn(t,e,i,s,o=1){if(!i.length)return!1;const n=dn(s,o),r=(t[0]+e[0])/2,a=(t[1]+e[1])/2,[l,c]=Go(t,e);for(const t of i){const[e,i]=Go([t[0],t[1]],[t[2],t[3]]);if(!(Math.abs(l*i-c*e)>.05)&&$n(r,a,t[0],t[1],t[2],t[3])<=n)return!0}return!1}function dn(t,e){return Math.max(t*(e>0?e:1)*.04,1e-9)}function pn(t,e){const i=t[e],s=t[(e+1)%t.length],o=s[0]-i[0],n=s[1]-i[1],r=Math.hypot(o,n)||1;let a=-n/r,l=o/r;const c=[(i[0]+s[0])/2,(i[1]+s[1])/2];return function(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const n=e[s][0],r=e[s][1],a=e[o][0],l=e[o][1];r>t[1]!=l>t[1]&&t[0]<(a-n)*(t[1]-r)/(l-r+0)+n&&(i=!i)}return i}([c[0]+.001*a,c[1]+.001*l],t)||(a=-a,l=-l),[a,l]}function un(t,e){const i=t[0]*e[1]-t[1]*e[0],s=t[0]*e[0]+t[1]*e[1];return Math.abs(i)<1e-9&&s>0}function _n(t,e,i,s){const o=e[0]*s[1]-e[1]*s[0];if(Math.abs(o)<1e-12)return null;const n=[i[0]-t[0],i[1]-t[1]],r=(n[0]*s[1]-n[1]*s[0])/o;return[t[0]+r*e[0],t[1]+r*e[1]]}function mn(t,e){const i=t?.length||0;if(i<3||e.length!==i)return null;if(e.every(t=>!(t>0)))return t.map(t=>[t[0],t[1]]);const s=[];for(let o=0;o<i;o++){const n=(o-1+i)%i,r=t[n],a=t[o],l=t[o],c=t[(o+1)%i],h=Math.max(0,e[n]),d=Math.max(0,e[o]),[p,u]=pn(t,n),[_,m]=pn(t,o),g=[a[0]-r[0],a[1]-r[1]],f=[c[0]-l[0],c[1]-l[1]],v=Math.hypot(g[0],g[1])||1,b=Math.hypot(f[0],f[1])||1,y=[g[0]/v,g[1]/v],w=[f[0]/b,f[1]/b],k=[r[0]+p*h,r[1]+u*h],x=[l[0]+_*d,l[1]+m*d];if(!(h>0||d>0)){s.push([t[o][0],t[o][1]]);continue}if(un(y,w)){const e=t[o],i=[e[0]+p*h,e[1]+u*h],n=[e[0]+_*d,e[1]+m*d];s.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&s.push(n);continue}const $=_n(k,y,x,w),S=Math.max(h,d,1e-9);if($){if(Math.hypot($[0]-t[o][0],$[1]-t[o][1])<=4*S){s.push($);continue}}h>0&&s.push([t[o][0]+p*h,t[o][1]+u*h]),d>0&&s.push([t[o][0]+_*d,t[o][1]+m*d]),h>0||d>0||s.push([t[o][0],t[o][1]])}return s.length>=3?s:null}function gn(t,e=!0){if(!t.length)return"";let i=`M ${t[0][0]} ${t[0][1]}`;for(let e=1;e<t.length;e++)i+=` L ${t[e][0]} ${t[e][1]}`;return e&&(i+=" Z"),i}function fn(t){return t.slice().reverse()}function vn(t,e,i,s,o=1,n=[]){const r=(t||[]).find(t=>t?.id===e),a=ze(r);if(!a||a.length<3)return null;const l=dn(s,o),c=[];for(const i of t||[]){if(!i||i.id===e)continue;const t=ze(i);if(t)for(const e of Li(a,t,l))c.push([e[0],e[1]],[e[2],e[3]])}for(const t of i||[])c.push([t[0],t[1]],[t[2],t[3]]);for(const t of n||[]){const e=Jo(t,o);e&&c.push(e[0],e[1])}const h=[],d=[];for(let t=0;t<a.length;t++){const e=a[t],i=a[(t+1)%a.length];h.push([e[0],e[1]]),d.push(t);const s=Math.hypot(i[0]-e[0],i[1]-e[1]);if(s<2*l||!c.length)continue;const o=Math.min(.499,2*l/s),n=[];for(const t of c){if($n(t[0],t[1],e[0],e[1],i[0],i[1])>l)continue;const r=((t[0]-e[0])*(i[0]-e[0])+(t[1]-e[1])*(i[1]-e[1]))/(s*s);r<=o||r>=1-o||(n.some(t=>Math.abs(t-r)*s<=2*l)||n.push(r))}n.sort((t,e)=>t-e);for(const s of n)h.push([e[0]+(i[0]-e[0])*s,e[1]+(i[1]-e[1])*s]),d.push(t)}return{poly:h,parent:d,orig:a}}function bn(t,e,i,s){const o=e.poly.length,n=new Array(o).fill(0);if(!t?.length)return n;const r=new Set,a=[];for(let l=0;l<o;l++){const c=en(t,e.poly[l],e.poly[(l+1)%o],i,s);c&&c.cm>0?(n[l]=Uo(c.cm),r.add(c.key)):a.push(l)}if(!a.length)return n;const l=s>0?s:1,c=Math.max(.5*i,1e-9)*l,h=Xo(t,l).filter(t=>t.w.cm>0),d=new Map;for(const t of a){const i=e.parent[t],s=d.get(i);s?s.push(t):d.set(i,[t])}for(const[t,i]of d){const s=e.orig[t],o=e.orig[(t+1)%e.orig.length],a=Qo(s,o),d=(s[0]+o[0])/2,p=(s[1]+o[1])/2;let u=null;const _=Math.hypot(o[0]-s[0],o[1]-s[1]);for(const t of h){if(r.has(t.w.key))continue;if(!tn(t.ang,a))continue;const e=Jo(t.w,l);let i=!1,n=0;if(e){if(!tn(Qo(e[0],e[1]),a))continue;if($n(s[0],s[1],e[0][0],e[0][1],e[1][0],e[1][1])>c||$n(o[0],o[1],e[0][0],e[0][1],e[1][0],e[1][1])>c)continue;i=!0,n=Math.max(0,Math.hypot(e[1][0]-e[0][0],e[1][1]-e[0][1])-_)}else{if($n(t.x,t.y,s[0],s[1],o[0],o[1])>c)continue;n=Math.hypot(t.x-d,t.y-p)}(!u||i&&!u.exact||i===u.exact&&n<u.d)&&(u={cm:Uo(t.w.cm),d:n,exact:i})}if(u)for(const t of i)n[t]=u.cm}return n}function yn(t,e,i,s,o,n,r,a=1){const l=vn(t,e,s,o,a,i);if(!l)return null;const c=function(t,e,i){const s=(t||[]).find(t=>t?.id===e),o=ze(s);if(!o)return[];const n=[];for(const s of t||[]){if(!s||s.id===e)continue;const t=ze(s);if(t)for(const e of Li(o,t,i))n.push(e)}return n}(t,e,dn(o,a)),h=function(t,e,i,s,o){const n=dn(s,o),r=[];for(let a=0;a<t.length;a++){const l=t[a],c=t[(a+1)%t.length];if(hn(l,c,i,s,o)){r.push(null);continue}const h=(l[0]+c[0])/2,d=(l[1]+c[1])/2,p=e.some(t=>$n(h,d,t[0],t[1],t[2],t[3])<=n);r.push(p?"shared":"outer")}return r}(l.poly,c,s,o,a),d=bn(i,l,o,a),p=d.map((t,e)=>h[e]&&t>0?jo(t,n,r)/2:0);return{...l,kinds:h,cms:d,offsets:p}}function wn(t,e,i,s,o,n,r=1){const a=[];for(const l of t||[]){if(!l?.id)continue;const c=yn(t,l.id,e,i,s,o,n,r);if(c)for(let t=0;t<c.poly.length;t++){const e=c.poly[t],i=c.poly[(t+1)%c.poly.length];a.push({roomId:l.id,a:[e[0],e[1]],b:[i[0],i[1]],key:Yo(e,i,s,r),kind:c.kinds[t],cm:c.kinds[t]?c.cms[t]:0,open:null===c.kinds[t],half:c.offsets[t]})}}return a}function kn(t,e,i,s,o,n,r=1){if(!e?.length)return[];const a=[],l=new Set;for(const c of wn(t,e,i,s,o,n,r))!c.open&&c.cm>0&&!l.has(c.key)&&(l.add(c.key),a.push(c));const c=[];for(const a of t||[]){if(!a?.id)continue;const l=yn(t,a.id,e,i,s,o,n,r);if(l)for(let t=0;t<l.orig.length;t++){const e=[];for(let i=0;i<l.parent.length;i++)l.parent[i]===t&&e.push(i);if(e.length)for(let t=0;t<e.length;){const i=e[t],o=l.cms[i];if(!(o>0)||null===l.kinds[i]){t++;continue}let n=t;for(;n+1<e.length;){const t=e[n+1];if(null===l.kinds[t]||l.cms[t]!==o)break;n++}const a=e[n],h=l.poly[i],d=l.poly[(a+1)%l.poly.length],p=Math.hypot(d[0]-h[0],d[1]-h[1]);p>0&&c.push({a:[h[0],h[1]],b:[d[0],d[1]],key:Yo(h,d,s,r),cm:o,len:p}),t=n+1}}}c.sort((t,e)=>e.len-t.len||t.key.localeCompare(e.key));const h=[],d=new Set,p=new Set,u=4*dn(s,r);for(const t of c){const e=a.filter(e=>!p.has(e.key)&&e.cm===t.cm&&tn(Qo(e.a,e.b),Qo(t.a,t.b))&&$n(e.a[0],e.a[1],t.a[0],t.a[1],t.b[0],t.b[1])<=u&&$n(e.b[0],e.b[1],t.a[0],t.a[1],t.b[0],t.b[1])<=u);if(e.length){for(const t of e)p.add(t.key);d.has(t.key)||(d.add(t.key),h.push(Zo(t.a,t.b,t.cm,s,r)))}}for(const t of a)p.has(t.key)||d.has(t.key)||(d.add(t.key),h.push(Zo(t.a,t.b,t.cm,s,r)));return h}function xn(t,e,i,s,o,n,r,a=1){const l=dn(o,a),c=(s[0]+s[2])/2,h=(s[1]+s[3])/2,d=Qo([s[0],s[1]],[s[2],s[3]]);let p=null;for(const s of wn(t,e,i,o,n,r,a)){if(!tn(Qo(s.a,s.b),d))continue;const t=$n(c,h,s.a[0],s.a[1],s.b[0],s.b[1]);t>4*l||(!p||t<p.d)&&(p={cm:s.cm,d:t})}return p?.cm||0}function $n(t,e,i,s,o,n){const r=o-i,a=n-s,l=r*r+a*a;if(l<1e-18)return Math.hypot(t-i,e-s);let c=((t-i)*r+(e-s)*a)/l;return c=Math.max(0,Math.min(1,c)),Math.hypot(t-(i+r*c),e-(s+a*c))}function Sn(t,e,i,s,o,n,r,a=1){const l=(t||[]).find(t=>t?.id===e),c=ze(l);if(!c||c.length<3)return null;if(!i?.length)return c.map(t=>[t[0],t[1]]);const h=yn(t,e,i,s,o,n,r,a);return h&&h.offsets.some(t=>t>0)&&mn(h.poly,h.offsets)||c.map(t=>[t[0],t[1]])}function Mn(t){const e=t.map(t=>[t[0],t[1]]);return e.push([t[0][0],t[0][1]]),[e]}function Cn(t,e,i,s=[],o,n,r,a=1){if(!e?.length)return null;const l=[];let c=0;for(const s of t||[]){if(!s?.id)continue;const h=yn(t,s.id,e,i,o,n,r,a);if(!h||h.poly.length<3||!h.offsets.some(t=>t>0))continue;for(const t of h.offsets)t>0&&(c=Math.max(c,2*t));const d=Dn(h.poly,h.offsets),p=mn(h.poly,h.offsets);d&&l.push({outset:d,inset:p})}if(!l.length)return null;const h=function(t,e,i,s,o,n,r){if(!e?.length||!i?.length)return[];const a=4*dn(s,r),l=new Map;for(const a of wn(t,e,i,s,o,n,r))!a.open&&a.half>0&&!l.has(a.key)&&l.set(a.key,a);const c=[...l.values()];if(c.length<2)return[];const h=[];for(const t of i)for(const e of[[t[0],t[1]],[t[2],t[3]]])h.some(t=>Math.hypot(t[0]-e[0],t[1]-e[1])<=a)||h.push(e);const d=[],p=(t,e)=>{let i=0,s=0;if(Math.hypot(t.a[0]-e[0],t.a[1]-e[1])<=a)i=t.b[0]-t.a[0],s=t.b[1]-t.a[1];else{if(!(Math.hypot(t.b[0]-e[0],t.b[1]-e[1])<=a))return null;i=t.a[0]-t.b[0],s=t.a[1]-t.b[1]}const o=Math.hypot(i,s);return o>a?[i/o,s/o]:null};for(const t of h){const e=c.map(e=>({iv:e,u:p(e,t)})).filter(t=>!!t.u);for(let i=0;i<e.length;i++)for(let s=i+1;s<e.length;s++){const o=e[i],n=e[s],r=o.u[0]*n.u[1]-o.u[1]*n.u[0],a=Math.abs(r);if(a<.001)continue;const l=n.iv.half/a,c=o.iv.half/a,h=[t[0]-o.u[0]*l,t[1]-o.u[1]*l],p=[t[0]-n.u[0]*c,t[1]-n.u[1]*c],u=[h[0]+p[0]-t[0],h[1]+p[1]-t[1]],_=Math.max(o.iv.half,n.iv.half,1e-9);Math.hypot(u[0]-t[0],u[1]-t[1])>4*_||d.push(r>0?[t.slice(),h,u,p]:[t.slice(),p,u,h])}}return d}(t,e,i,o,n,r,a);try{const t=t=>{const e=Mn(t.outset);return t.inset?$e(e,Mn(t.inset)):e};let e=t(l[0]);for(let i=1;i<l.length;i++)e=ke(e,t(l[i]));for(const t of h)e=ke(e,Mn(t));for(const t of s){if(!(t.length>0))continue;const i=t.angle*Math.PI/180,s=Math.cos(i),n=Math.sin(i),r=-n,l=s,h=t.length/2,d=1.25*Math.max(c,o*a),p=[[t.x-s*h-r*d,t.y-n*h-l*d],[t.x+s*h-r*d,t.y+n*h-l*d],[t.x+s*h+r*d,t.y+n*h+l*d],[t.x-s*h+r*d,t.y-n*h+l*d]];e=$e(e,Mn(p))}const i=function(t){if(!t)return"";let e="";for(const i of t)if(Array.isArray(i))for(const t of i){if(!Array.isArray(t)||t.length<4)continue;const i=t.slice(0,t.length-1);i.length<3||(e+=(e?" ":"")+gn(i.map(t=>[t[0],t[1]])))}return e}(e);return i?{d:i,depthUnits:c}:null}catch{const s=function(t,e,i,s,o,n,r=1){if(!e?.length)return[];const a=[];for(const l of t||[]){if(!l?.id)continue;const c=yn(t,l.id,e,i,s,o,n,r);if(!c||c.poly.length<3||!c.offsets.some(t=>t>0))continue;const h=Dn(c.poly,c.offsets),d=mn(c.poly,c.offsets);if(!h||!d)continue;const p=`${gn(h)} ${gn(fn(d))}`;let u="",_="outer",m=0,g=0;for(let t=0;t<c.poly.length;t++)if(c.offsets[t]>0){u=Yo(c.poly[t],c.poly[(t+1)%c.poly.length],s,r),_=c.kinds[t]||"outer",m=c.cms[t],g=jo(m,o,n);break}a.push({d:p,key:u,kind:_,cm:m,depthUnits:g})}return a}(t,e,i,o,n,r,a);return s.length?{d:s.map(t=>t.d).join(" "),depthUnits:c}:null}}function Dn(t,e){const i=t?.length||0;if(i<3||e.length!==i)return null;if(e.every(t=>!(t>0)))return t.map(t=>[t[0],t[1]]);fn(t),e.slice().reverse();const s=[];for(let o=0;o<i;o++){const n=(o-1+i)%i,r=Math.max(0,e[n]),a=Math.max(0,e[o]),[l,c]=pn(t,n),[h,d]=pn(t,o),p=t[n],u=t[o],_=t[o],m=t[(o+1)%i],g=[u[0]-p[0],u[1]-p[1]],f=[m[0]-_[0],m[1]-_[1]],v=Math.hypot(g[0],g[1])||1,b=Math.hypot(f[0],f[1])||1,y=[g[0]/v,g[1]/v],w=[f[0]/b,f[1]/b],k=[p[0]-l*r,p[1]-c*r],x=[_[0]-h*a,_[1]-d*a];if(!(r>0||a>0)){s.push([t[o][0],t[o][1]]);continue}if(un(y,w)){const e=t[o],i=[e[0]-l*r,e[1]-c*r],n=[e[0]-h*a,e[1]-d*a];s.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&s.push(n);continue}const $=_n(k,y,x,w),S=Math.max(r,a,1e-9);if($){if(Math.hypot($[0]-t[o][0],$[1]-t[o][1])<=4*S){s.push($);continue}}r>0&&s.push([t[o][0]-l*r,t[o][1]-c*r]),a>0&&s.push([t[o][0]-h*a,t[o][1]-d*a])}return s.length>=3?s:null}function zn(t,e,i,s,o,n,r=1){const a=[];for(const l of t||[]){const c=ze(l);if(c&&c.length>=3){const h=yn(t,l.id,e,i,s,o,n,r),d=h&&h.offsets.some(t=>t>0)?Dn(h.poly,h.offsets):null,p=d||c;a.push({poly:p.map(t=>t.join(",")).join(" ")})}else l&&null!=l.x&&null!=l.y&&null!=l.w&&null!=l.h&&a.push({rect:{x:l.x,y:l.y,w:l.w,h:l.h,rx:.03*Math.min(l.w,l.h)}})}return a}function Tn(t,e,i,s,o,n,r=1){let a=null;for(const i of t||[]){const t=ze(i);if(t)for(let s=0;s<t.length;s++){const o=t[s],n=t[(s+1)%t.length],r=$n(e.x,e.y,o[0],o[1],n[0],n[1]),l=nn(o,n,e.angle);a?(l&&!a.angled||l===a.angled&&r<a.dist)&&(a={a:o,b:n,room:i,edge:s,dist:r,angled:l}):a={a:o,b:n,room:i,edge:s,dist:r,angled:l}}}if(!a||a.dist>s*r)return{ox:0,oy:0,cm:0};const l=sn(i,a.a,a.b,s,r);if(!(l>0))return{ox:0,oy:0,cm:0};const c=jo(l,o,n),h=ze(a.room),[d,p]=pn(h,a.edge),u=e.flip_v?-1:1,_=c/2;return{ox:d*_*u,oy:p*_*u,cm:l}}function Pn(t,e,i){const s=i;return{a:[t[0]/s,t[1]/s],b:[e[0]/s,e[1]/s]}}function Rn(t,e){const i=e;return[t.a[0]*i,t.a[1]*i,t.b[0]*i,t.b[1]*i]}function An(t){return Array.isArray(t)&&t.length>=2&&Number.isFinite(Number(t[0]))&&Number.isFinite(Number(t[1]))}function Nn(t){if(!Array.isArray(t))return[];const e=[];for(const i of t){if(!i||"object"!=typeof i)continue;const t=i;if(!An(t.a)||!An(t.b))continue;const s=[Number(t.a[0]),Number(t.a[1])],o=[Number(t.b[0]),Number(t.b[1])];Math.hypot(o[0]-s[0],o[1]-s[1])<.001||e.push({a:s,b:o})}return e}function En(t,e){const i=e[0],s=e[1],o=e[2]-i,n=e[3]-s,r=o*o+n*n;if(r<1e-18){return{q:[i,s],t:0,d:Math.hypot(t[0]-i,t[1]-s)}}let a=((t[0]-i)*o+(t[1]-s)*n)/r;a=Math.max(0,Math.min(1,a));const l=[i+a*o,s+a*n];return{q:l,t:a,d:Math.hypot(t[0]-l[0],t[1]-l[1])}}function On(t,e){return En(t,e).q}function Fn(t,e,i,s,o){const n=En(t,e).q;let r=n,a=1/0;for(const t of i){const e=Math.hypot(n[0]-t[0],n[1]-t[1]);e<=o&&e<a&&(a=e,r=[t[0],t[1]])}if(a<=o)return r;const l=e[0],c=e[1],h=e[2]-l,d=e[3]-c,p=Math.hypot(h,d)||1,u=((n[0]-l)*h+(n[1]-c)*d)/p,_=s>0?s:1,m=Math.round(u/_)*_,g=Math.max(0,Math.min(p,m))/p;return[l+h*g,c+d*g]}function In(t,e){const i=[],s=(t||[]).filter(t=>t?.id);for(let t=0;t<s.length;t++){const o=ze(s[t]);if(o)for(let n=t+1;n<s.length;n++){const r=ze(s[n]);if(r)for(const s of Li(o,r,e))i.push({seg:s,pair:`${t}:${n}`})}}return i}function Ln(t,e,i,s){const o=function(t,e){return In(t,e).map(t=>t.seg)}(e,s);let n=null;for(const r of e||[]){if(!r?.id)continue;const e=ze(r);if(e)for(let a=0;a<e.length;a++){const l=e[a],c=e[(a+1)%e.length],h=[l[0],l[1],c[0],c[1]],d=Zi(t,h);if(d>i)continue;let p=!1;for(const t of o)if(Zi([(l[0]+c[0])/2,(l[1]+c[1])/2],t)<2*s){p=!0;break}p||(!n||d<n.d)&&(n={room:r,edge:h,d:d})}}return n?{room:n.room,edge:n.edge}:null}function Hn(t,e,i,s,o=!0){const n=(t||[]).filter(t=>t?.id),r=Nn(e);if(r.length)return Vn(r,t,i,s).map(t=>Rn(t,i));if(!o)return[];const a=[],l=(t,e)=>(t.open_to||[]).includes(e.id)||(e.open_to||[]).includes(t.id);for(let t=0;t<n.length;t++)for(let e=t+1;e<n.length;e++){if(!l(n[t],n[e]))continue;const i=ze(n[t]),o=ze(n[e]);if(i&&o)for(const t of Li(i,o,s))a.push(t)}return a}function qn(t,e){return t.map(t=>Pn([t[0],t[1]],[t[2],t[3]],e))}function Un(t,e,i,s){for(const e of t||[])e.open_to&&delete e.open_to;if(!i.length)return;const o=(e||[]).filter(t=>t?.id);new Map(o.map(t=>[t.id,t]));const n=new Map((t||[]).filter(t=>t?.id).map(t=>[t.id,t])),r=(t,e)=>{const i=n.get(t),s=n.get(e);i&&s&&((i.open_to||[]).includes(e)||(i.open_to=[...i.open_to||[],e]),(s.open_to||[]).includes(t)||(s.open_to=[...s.open_to||[],t]))};for(let t=0;t<o.length;t++)for(let e=t+1;e<o.length;e++){const n=ze(o[t]),a=ze(o[e]);if(!n||!a)continue;const l=Li(n,a,s);if(l.length)for(const n of i){const i=[(n[0]+n[2])/2,(n[1]+n[3])/2];if(l.some(t=>Zi(i,t)<4*s)){r(o[t].id,o[e].id);break}}}for(const e of t||[])e.open_to&&!e.open_to.length&&delete e.open_to}function Wn(t,e,i){let s=null;for(const o of e){const e=Zi(t,o);e<=i&&(!s||e<s.d)&&(s={sg:o,d:e})}return s?s.sg:null}function Bn(t,e,i,s,o=1,n=15){const r=function(t,e,i,s,o=1,n=15){const[r,a]=Go([e[0],e[1]],[e[2],e[3]]);let l=0,c=1/0;const h=[(e[0]+e[2])/2,(e[1]+e[3])/2];for(const e of i){const[i,n]=Go([e[0],e[1]],[e[2],e[3]]);if(Math.abs(r*n-a*i)>.05)continue;const d=sn(t,[e[0],e[1]],[e[2],e[3]],s,o);if(!(d>0))continue;const p=[(e[0]+e[2])/2,(e[1]+e[3])/2],u=Math.hypot(p[0]-h[0],p[1]-h[1]);u<c&&(c=u,l=d)}return l>0?l:n}(t,e,i,s,o,n);return an(t,[e[0],e[1]],[e[2],e[3]],r,s,o)}function jn(t,e,i){const s=[[t[0],t[1]],[t[2],t[3]]],o=[(t[0]+t[2])/2,(t[1]+t[3])/2];for(const n of e)if(!(Zi(o,n)>Math.hypot(t[2]-t[0],t[3]-t[1])&&Zi([n[0],n[1]],t)>i))for(const e of[[n[0],n[1]],[n[2],n[3]]])Zi(e,t)<=2*i&&s.push(e);return s}function Vn(t,e,i,s){const o=Nn(t);if(!o.length)return[];const n=In(e,s);if(!n.length)return[];const r=[],a=Math.max(4*s,1e-6);for(const t of o){const e=Rn(t,i),o=e[0],l=e[1],c=e[2]-o,h=e[3]-l,d=Math.hypot(c,h);if(d<a)continue;const p=c/d,u=h/d,_=new Map;for(const{seg:t,pair:e}of n){const i=Math.abs((t[0]-o)*u-(t[1]-l)*p),n=Math.abs((t[2]-o)*u-(t[3]-l)*p);if(i>4*s||n>4*s)continue;const r=(t[0]-o)*p+(t[1]-l)*u,c=(t[2]-o)*p+(t[3]-l)*u,h=Math.max(0,Math.min(r,c)),m=Math.min(d,Math.max(r,c));if(m-h<a)continue;const g=_.get(e)||[];g.push({lo:h,hi:m}),_.set(e,g)}for(const[t,e]of _){e.sort((t,e)=>t.lo-e.lo||t.hi-e.hi);const i=[];for(const t of e){const e=i[i.length-1];e&&t.lo<=e.hi+a?e.hi=Math.max(e.hi,t.hi):i.push({...t})}for(const e of i){const i=[o+p*e.lo,l+u*e.lo],s=[o+p*e.hi,l+u*e.hi];Math.hypot(s[0]-i[0],s[1]-i[1])<a||r.push({pair:t,seg:[i[0],i[1],s[0],s[1]]})}}}const l=[],c=Math.max(4*s,1e-6);for(const{pair:t,seg:e}of r){const i=e[2]-e[0],s=e[3]-e[1],o=Math.hypot(i,s);if(o<a)continue;let n=i/o,r=s/o;(n<-1e-12||Math.abs(n)<=1e-12&&r<0)&&(n=-n,r=-r);let h=l.find(i=>i.pair===t&&Math.abs(i.ux*r-i.uy*n)<=1e-6&&Math.abs((e[0]-i.origin[0])*i.uy-(e[1]-i.origin[1])*i.ux)<=c&&Math.abs((e[2]-i.origin[0])*i.uy-(e[3]-i.origin[1])*i.ux)<=c);h||(h={pair:t,origin:[e[0],e[1]],ux:n,uy:r,ranges:[]},l.push(h));const d=(e[0]-h.origin[0])*h.ux+(e[1]-h.origin[1])*h.uy,p=(e[2]-h.origin[0])*h.ux+(e[3]-h.origin[1])*h.uy;h.ranges.push({lo:Math.min(d,p),hi:Math.max(d,p)})}const h=[];for(const t of l){t.ranges.sort((t,e)=>t.lo-e.lo||t.hi-e.hi);const e=[];for(const i of t.ranges){const t=e[e.length-1];t&&i.lo<=t.hi+a?t.hi=Math.max(t.hi,i.hi):e.push({...i})}for(const s of e){const e=[t.origin[0]+t.ux*s.lo,t.origin[1]+t.uy*s.lo],o=[t.origin[0]+t.ux*s.hi,t.origin[1]+t.uy*s.hi];Math.hypot(o[0]-e[0],o[1]-e[1])>=a&&h.push(Pn(e,o,i))}}return h}function Gn(t,e,i,s){const o=Nn(t);if(!o.length)return[];if(e.length!==i.length)return o;const n=[];for(const t of o){const o=Rn(t,s),r=[o[0],o[1]],a=[o[2],o[3]];let l=r,c=a;for(let t=0;t<e.length;t++){const[s,o]=e[t],[n,h]=i[t],d=t=>{const e=En(t,[s[0],s[1],o[0],o[1]]);if(e.d>.001)return t;const i=h[0]-n[0],r=h[1]-n[1];return[n[0]+i*e.t,n[1]+r*e.t]};if(En([(r[0]+a[0])/2,(r[1]+a[1])/2],[s[0],s[1],o[0],o[1]]).d<.01){l=d(r),c=d(a);break}}n.push(Pn(l,c,s))}return n}class Kn{constructor(t,e=()=>Date.now()){this.onUpdate=t,this.now=e,this.signed={},this.queued=new Set,this.inFlight=new Map,this.retry=new Map,this.disposed=!1}start(t,e){this.disposed=!1,this.stopTimer(),this.resignTimer=setInterval(()=>this.resign(t(),e()),288e5)}dispose(){this.disposed=!0,this.stopTimer(),clearTimeout(this.batchTimer),this.queued.clear(),this.inFlight.clear()}stopTimer(){void 0!==this.resignTimer&&clearInterval(this.resignTimer),this.resignTimer=void 0}display(t,e){const i=Vi(e);if(!i.startsWith("/api/houseplan/content/"))return i;const s=this.signed[i],o=s?this.now()-s.at:1/0;return o<Bi?s.url:o<Wi?(this.request(t,i),s.url):(s&&delete this.signed[i],this.request(t,i),"")}request(t,e){if(!t?.callWS||this.queued.has(e))return;const i=this.now(),s=this.inFlight.get(e);if(void 0!==s&&i-s<15e3)return;const o=this.retry.get(e);o&&i<o.notBefore||(this.queued.add(e),clearTimeout(this.batchTimer),this.batchTimer=setTimeout(()=>{const e=[...this.queued];this.queued.clear(),this.sign(t,e)},30))}sign(t,e){if(e.length&&t?.callWS)for(const i of function(t,e){const i=Math.max(1,Math.floor(e)),s=[];for(let e=0;e<t.length;e+=i)s.push(t.slice(e,e+i));return s}(e,200)){const e=this.now();for(const t of i)this.inFlight.set(t,e);t.callWS({type:"houseplan/content/sign",paths:i}).then(t=>{if(this.disposed)return;const e=this.now(),s={...this.signed};let o=0;for(const n of i){const i=t?.urls?.[n];"string"==typeof i&&i?(s[n]={url:i,at:e},this.retry.delete(n),o++):this.backOff(n)}o&&(this.signed=s,this.onUpdate())}).catch(()=>{for(const t of i)this.backOff(t)}).finally(()=>{for(const t of i)this.inFlight.get(t)===e&&this.inFlight.delete(t)})}}backOff(t){const e=this.retry.get(t)?.delay||0,i=Math.min(6e4,e?2*e:2e3);this.retry.set(t,{notBefore:this.now()+i,delay:i})}resign(t,e){const i=this.now(),s={};for(const[t,o]of Object.entries(this.signed))e.has(t)&&i-o.at<Wi&&(s[t]=o);this.signed=s,this.retry.clear(),this.sign(t,Object.keys(s))}get entries(){return this.signed}get inFlightUrls(){return[...this.inFlight.keys()]}}function Yn(t,e,i){return[t[0]*e+t[1]*i+t[2],t[3]*e+t[4]*i+t[5]]}function Jn(t,e){let i=0;for(const[s,o]of e){const e=Yn(t,s[0],s[1]);i=Math.max(i,Math.hypot(e[0]-o[0],e[1]-o[1]))}return i}const Zn=t=>{const e=Number(t);return Number.isFinite(e)?e:null};function Xn(t){if(!t)return null;const e=t.vacuum_position||t.robot_position||null,i=e&&null!=Zn(e.x)&&null!=Zn(e.y)?{x:Zn(e.x),y:Zn(e.y),a:Zn(e.a??e.angle??e.theta)}:null;let s=null;const o=t.path?.points??t.path;if(Array.isArray(o)&&o.length){s=[];for(const t of o){const e=Zn(Array.isArray(t)?t[0]:t?.x),i=Zn(Array.isArray(t)?t[1]:t?.y);null!=e&&null!=i&&s.push([e,i])}s.length||(s=null)}const n=[],r=t.rooms,a=Array.isArray(r)?r.map((t,e)=>[String(t?.id??e),t]):r&&"object"==typeof r?Object.entries(r):[];for(const[t,e]of a){if(!e||"object"!=typeof e)continue;const i=String(e.name??e.label??"").trim();let s=Zn(e.cx??e.center?.x),o=Zn(e.cy??e.center?.y);if(null==s||null==o){const t=Zn(e.x0),i=Zn(e.y0),n=Zn(e.x1),r=Zn(e.y1);null!=t&&null!=i&&null!=n&&null!=r&&(s=(t+n)/2,o=(i+r)/2)}if(null!=s&&null!=o||(s=Zn(e.x),o=Zn(e.y)),i&&null!=s&&null!=o){const r={id:t,name:i,cx:s,cy:o},a=Zn(e.x0),l=Zn(e.y0),c=Zn(e.x1),h=Zn(e.y1);null!=a&&null!=l&&null!=c&&null!=h&&(r.x0=Math.min(a,c),r.y0=Math.min(l,h),r.x1=Math.max(a,c),r.y1=Math.max(l,h)),n.push(r)}}const l=function(t){return String(t.map_name??t.current_map??t.map_index??t.selected_map??"default")}(t);return i||n.length||s?{pos:i,path:s,rooms:n,mapId:l}:null}function Qn(t){const e=t?.attributes;return!(!e||!e.vacuum_position&&!e.robot_position)}const tr=t=>t.toLowerCase().replace(/[\s_\-.,]+/g,"");function er(t,e){const i=new Map(e.map(t=>[tr(t.name),t])),s=[],o=[];for(const e of t){const t=i.get(tr(e.name));t&&(s.push([[e.cx,e.cy],[t.cx,t.cy]]),o.push(e.name))}if(s.length<3)return null;const n=function(t){if(t.length<3)return null;let e=0,i=0,s=0,o=0,n=0,r=0,a=0,l=0,c=0,h=0,d=0,p=0;for(const[[u,_],[m,g]]of t){if(![u,_,m,g].every(Number.isFinite))return null;e+=u*u,i+=u*_,s+=u,o+=_*_,n+=_,r+=1,a+=u*m,l+=_*m,c+=m,h+=u*g,d+=_*g,p+=g}const u=[e,i,s,i,o,n,s,n,r],_=t=>{const[e,i,s,o,n,r,a,l,c]=u,h=e*(n*c-r*l)-i*(o*c-r*a)+s*(o*l-n*a);if(!Number.isFinite(h)||Math.abs(h)<1e-9)return null;const d=[(n*c-r*l)/h,(s*l-i*c)/h,(i*r-s*n)/h,(r*a-o*c)/h,(e*c-s*a)/h,(s*o-e*r)/h,(o*l-n*a)/h,(i*a-e*l)/h,(e*n-i*o)/h];return[d[0]*t[0]+d[1]*t[1]+d[2]*t[2],d[3]*t[0]+d[4]*t[1]+d[5]*t[2],d[6]*t[0]+d[7]*t[1]+d[8]*t[2]]},m=_([a,l,c]),g=_([h,d,p]);if(!m||!g)return null;const f=[m[0],m[1],m[2],g[0],g[1],g[2]];return f.every(Number.isFinite)?f:null}(s);return n?{matrix:n,matched:o,residual:Jn(n,s)}:null}function ir(t,e,i){const s=t[t.length-1];if(s&&s[0]===e[0]&&s[1]===e[1])return t;if(t.push(e),t.length<=600)return t;let o=function(t,e){if(t.length<3)return t.slice();const i=new Uint8Array(t.length);i[0]=i[t.length-1]=1;const s=[[0,t.length-1]];for(;s.length;){const[o,n]=s.pop(),[r,a]=t[o],[l,c]=t[n],h=l-r,d=c-a,p=Math.hypot(h,d)||1e-9;let u=0,_=-1;for(let e=o+1;e<n;e++){const i=Math.abs((t[e][0]-r)*d-(t[e][1]-a)*h)/p;i>u&&(u=i,_=e)}_>0&&u>e&&(i[_]=1,s.push([o,_],[_,n]))}const o=[];for(let e=0;e<t.length;e++)i[e]&&o.push(t[e]);return o}(t,i);return o.length>600&&(o=o.filter((t,e)=>e%2==0||e===o.length-1)),o}function sr(t){return"cleaning"===t||"returning"===t||"on"===t}const or={0:[1,0],90:[0,1],180:[-1,0],270:[0,-1]};function nr(t){const[e,i]=or[t.rot]||[1,0],s=t.mir?-1:1;return[t.s*e*s,-t.s*i,t.ox,t.s*i*s,t.s*e,t.oy]}function rr(t,e,i,s){const[o,n]=Yn(nr(e),i,s),r=nr({...t,ox:0,oy:0}),[a,l]=Yn(r,i,s);return{...t,ox:o-a,oy:n-l}}function ar(t){const e=t?.trail_mode;return"never"===e||"cleaning"===e||"always"===e?e:!1===t?.trail?"never":"cleaning"}const lr={availability:"available",status:"alarm",activity:"none"},cr=new Set(["motion","vibration","sound"]),hr=new Set(["occupancy","presence"]),dr=new Set(["door","window","garage_door","opening"]),pr=new Set(["running","power"]),ur=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);const _r=new Set(["running","working","washing","rinsing","spinning","drying","heating","cooling","cleaning","cooking","playing","recording","pumping","irrigating","humidifying","dehumidifying","fan"]),mr=new Set(["off","idle","paused","standby","docked","finished","complete","completed","stopped","ready","sleeping"]),gr=new Set(["heat","cool","heat_cool","auto","dry","fan_only"]),fr=t=>""===t||"unknown"===t||"unavailable"===t||"__missing__"===t,vr=t=>String(t??"").trim().toLowerCase();function br(t){for(const e of["hvac_action","action","current_operation","run_state","job_state","operation","activity"]){const i=vr(t?.[e]);if(i)return i}return""}function yr(t,e){const i=t?.states?.[e],s=i?vr(i.state):"__missing__",o=String(e||"").split(".")[0],n=vr(i?.attributes?.device_class),r={eid:e,state:s,availability:fr(s)?"unavailable":"available",status:"neutral",activity:"none",edge:"none"};if("unavailable"===r.availability)return r;if(function(t,e,i){return"alarm_control_panel"===t?"triggered"===i:"on"===i&&("siren"===t||"binary_sensor"===t&&!!e&&Xi.has(e))}(o,n,s))return{...r,status:"alarm"};if("binary_sensor"===o)return cr.has(n)?{...r,edge:"rising"}:hr.has(n)?{...r,activity:"on"===s?"presence":"none"}:dr.has(n)?{...r,status:"on"===s?"open":"neutral",edge:"rising"}:"moving"===n?{...r,activity:"on"===s?"transition":"none"}:pr.has(n)&&"on"===s?{...r,status:"working",activity:"running"}:r;if("cover"===o)return{...r,activity:"opening"===s||"closing"===s?"transition":"none",edge:"terminal_transition"};if("lock"===o)return{...r,status:"unlocked"===s||"open"===s?"open":"neutral",activity:"locking"===s||"unlocking"===s?"transition":"none",edge:"terminal_transition"};if("valve"===o)return{...r,status:["open","opening","closing"].includes(s)?"open":"neutral",activity:"opening"===s||"closing"===s?"transition":"none",edge:"terminal_transition"};if("climate"===o){const t=br(i.attributes),e=Array.isArray(i.attributes?.hvac_modes)?i.attributes.hvac_modes.map(vr):[],o=!mr.has(s)&&(gr.has(s)||_r.has(s)||e.includes(s));return(t?_r.has(t):o)?{...r,status:"working",activity:"running"}:r}if(["light","switch","fan","humidifier"].includes(o))return"on"===s?{...r,status:"working",activity:"running"}:r;if("media_player"===o)return"off"===s?{...r,availability:"unavailable"}:r;if("vacuum"===o)return"cleaning"===s?{...r,status:"working",activity:"running"}:"returning"===s?{...r,status:"working",activity:"transition"}:r;if("script"===o)return"on"===s?{...r,status:"working",activity:"running"}:r;if("automation"===o)return r;if("button"===o||"event"===o)return{...r,edge:"change"};const a=br(i.attributes);return _r.has(a)||_r.has(s)&&!mr.has(s)?{...r,status:"working",activity:"running"}:r}function wr(t,e){if(!(t=>!!t&&!fr(t))(t)||"unavailable"===e.availability||t===e.state)return null;if("rising"===e.edge)return"off"===t&&"on"===e.state?"event":null;if("change"===e.edge)return"event";if("terminal_transition"===e.edge){const i=new Set([t,e.state]);if(i.has("closed")&&i.has("open")||i.has("locked")&&i.has("unlocked"))return"transition"}return null}function kr(t){const e={};for(const[i,s]of Object.entries(t.entities))s?.device_id&&(e[s.device_id]=e[s.device_id]||[]).push(i);return e}function xr(t,e,i){if(e.identifiers?.[0]?.[0])return e.identifiers[0][0];for(const e of i){const i=t.entities[e]?.platform;if(i)return i}return""}function $r(t,e){if(/_device_temperature$/.test(e))return!1;if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_temperature$/.test(e);const s=i.attributes||{};return"temperature"===s.device_class||/°C|°F/.test(s.unit_of_measurement||"")||/_temperature$/.test(e)}const Sr=["vacuum","lawn_mower","climate","media_player","light","cover","lock","valve","alarm_control_panel","water_heater","fan","humidifier","siren","camera","remote"],Mr=t=>[...t.filter(t=>!t.reg?.hidden),...t.filter(t=>!!t.reg?.hidden)];function Cr(t,e){const i=e.map(e=>({eid:e,reg:t?.entities?.[e]})).filter(t=>!!t.reg);if(!i.length)return[];const s=i.filter(t=>!t.reg.entity_category),o=s.length?s:i;for(const t of Sr){const e=o.filter(e=>e.eid.startsWith(t+"."));if(e.length)return Mr(e).map(t=>t.eid)}const n=o.filter(e=>function(t,e){if(!e.startsWith("binary_sensor."))return!1;const i=vr(t?.states?.[e]?.attributes?.device_class||t?.entities?.[e]?.device_class||t?.entities?.[e]?.original_device_class);return cr.has(i)||hr.has(i)||dr.has(i)||pr.has(i)||"moving"===i||ur.has(i)}(t,e.eid));if(n.length)return Mr(n).map(t=>t.eid);const r=o.filter(t=>t.eid.startsWith("switch."));if(r.length)return Mr(r).map(t=>t.eid);const a=[];for(const t of wt)a.push(...Mr(o.filter(e=>e.eid.startsWith(t+"."))));return a.push(...Mr(o.filter(t=>!wt.includes(t.eid.split(".")[0])))),a.map(t=>t.eid)}function Dr(t,e,i){const s=e.map(e=>({eid:e,reg:t.entities[e],st:t.states[e]})).filter(t=>t.reg),o=[s.filter(t=>!t.reg.hidden&&!t.reg.entity_category),s.filter(t=>!t.reg.entity_category),s.filter(t=>!t.reg.hidden),s];if("mdi:thermometer"===i||"mdi:air-filter"===i)for(const e of o){const i=e.find(e=>$r(t,e.eid));if(i)return i.eid}return Cr(t,e)[0]}function zr(t,e,i=[]){const s=t?.startsWith("entity:")?new Set([t.slice(7)]):new Set(i);return[...new Set(e||[])].filter(t=>Ii(t)&&!s.has(t))}function Tr(t,e,i=[]){const s=t?.startsWith("entity:")?new Set([t.slice(7)]):new Set(i);return(e||[]).some(t=>t.startsWith("switch.")&&s.has(t))}function Pr(t,e){if("string"==typeof e)return t.area===e;const i=t.marker?.room_id;return i?!!e.id&&i===e.id:!!e.area&&t.area===e.area}function Rr(t,e){const i=zr(e.marker?.binding,e.controls??e.marker?.controls,e.entities).map(t=>({eid:t,via:"controls"}));if(!0===e.marker?.is_light||Tr(e.marker?.binding,e.marker?.controls,e.entities)){const t=function(t){const e=t.marker?.binding?.startsWith("entity:")?t.marker.binding.slice(7):null,i=t.entities.filter(Ii),s=t.primary&&Ii(t.primary)?t.primary:null;return(e&&Ii(e)?e:null)||s||i[0]||null}(e);t&&!i.some(e=>e.eid===t)&&i.push({eid:t,via:"forced"})}if(i.length)return i;const s=e.primary||Cr(t,e.entities)[0];return s&&!s.startsWith("light.")?[]:e.entities.filter(t=>t.startsWith("light.")).map(t=>({eid:t,via:"light"}))}function Ar(t,e,i){const s=[],o=new Set;for(const n of e){if(n.hidden||null!=i&&!Pr(n,i))continue;const e=Rr(t,n);for(const{eid:i,via:r}of e)i&&!o.has(i)&&(o.add(i),s.push({eid:i,device:n,via:r,on:"on"===t.states[i]?.state}))}return s}function Nr(t){return t.length?t.some(t=>t.on)?"on":"off":"none"}function Er(t,e){const i=[];for(const s of e){const e=t.states[s];if(!e)continue;const o=(e.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(s)||"lqi"===o){const t=parseFloat(e.state);isNaN(t)||i.push(t);continue}const n=e.attributes?.linkquality??e.attributes?.lqi;if(null!=n){const t=parseFloat(n);isNaN(t)||i.push(t)}}return Qe(i)}function Or(t,e){for(const i of e){if(!$r(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(10*s)/10}return null}function Fr(t,e){for(const i of e){if(!i.startsWith("climate."))continue;const e=t.states[i];if(!e||"unavailable"===e.state||"unknown"===e.state)continue;const s=parseFloat(e.attributes?.current_temperature);if(Number.isFinite(s))return Math.round(10*s)/10}return null}function Ir(t,e){if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_humidity$/.test(e);const s=i.attributes||{};return"humidity"===s.device_class||"%"===s.unit_of_measurement&&/_humidity$/.test(e)||/_humidity$/.test(e)}function Lr(t,e){for(const i of e){if(!Ir(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(s)}return null}function Hr(t,e){if(!e)return[];const i=[];for(const[e,s]of Object.entries(t.entities)){if(!e.startsWith("light.")||s.hidden)continue;let o=null;if("group"===s.platform)o=s.area_id||null;else{if(!s.device_id)continue;{const e=t.devices[s.device_id];if("Group"!==e?.model)continue;o=e.area_id||s.area_id||null}}if(!o)continue;const n=t.states[e];i.push({eid:e,name:s.name||n?.attributes?.friendly_name||e,area:o})}return i}function qr(t,e,i,s,o){const n=yt(e,i,o);if(n!==bt)return n;const r=[];for(const e of s){const i=t.states[e]?.attributes?.device_class;i&&r.push(i)}return function(t){for(const e of t){const t=vt[e];if(t)return t}return null}(r)??bt}function Ur(t){const e=new Set,i=new Set;for(const s of t||[]){if(!0!==s?.removed)continue;const t=String(s.binding||"").indexOf(":");if(t<1)continue;const o=s.binding.slice(0,t),n=s.binding.slice(t+1);n&&("device"===o?e.add(n):"entity"===o&&i.add(n))}return{devices:e,entities:i}}function Wr(t,e,i){if(i.entities.has(e))return!0;const s=t?.entities?.[e]?.device_id;return!!s&&i.devices.has(s)}function Br(t,e,i,s){const o=zr(e.binding,e.controls,t.entities).filter(t=>!Wr(i,t,s));t.marker=e,t.controls=o,e.hidden&&(t.hidden=!0),e.name&&(t.name=e.name),e.icon&&(t.icon=e.icon),null!=e.model&&(t.model=e.model),t.link=e.link??null,t.description=e.description??null,t.pdfs=e.pdfs||[],t.tapAction=e.tap_action??null}function jr(t){const{hass:e,areaToSpace:i,markers:s,settings:o,excluded:n,showAll:r,firstSpaceId:a,loc:l,iconRules:c}=t,h=!1!==o.group_lights,d=Ur(s),p=Hr(e,h).filter(t=>!Wr(e,t.eid,d)),u=new Set(p.map(t=>t.area)),_=kr(e),m=new Set;for(const t of s){const[e,i]=t.binding.split(":");"device"!==e&&"entity"!==e||!i||m.add(t.binding)}const g=(t,e)=>s.find(i=>i.binding===t+":"+e),f={},v=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(m.has("device:"+t.id))continue;const a=g("device",t.id);if(a&&a.hidden&&!o.filter_seeded)continue;const d=_[t.id]||[],p=xr(e,t,d),b=!o.filter_seeded;if(b&&!r){if(n.has(p))continue;if("Group"===t.model)continue;if(/scene/i.test(t.model||""))continue;if(/bridge/i.test((t.model||"")+(t.name||"")))continue;if("myheat"===p&&t.via_device_id)continue}const y=(t.name_by_user||t.name||l("device.unnamed")).trim(),w=y+"|"+s;let k=qr(e,y,t.model,d,c);if(d.some(t=>t.startsWith("lock."))&&(k="mdi:lock"),b&&!r&&h&&"mdi:lightbulb"===k&&u.has(s))continue;f[w]=(f[w]||0)+1;const x=f[w]>1?y+" "+f[w]:y,$={id:t.id,name:x,model:t.model||"",area:s,space:i[s],icon:k,entities:d,bindingKind:"device",bindingRef:t.id,pdfs:[]};$.primary=Dr(e,d,k),"mdi:thermometer"!==k&&"mdi:air-filter"!==k||($.temp=Or(e,d)),$.primary&&Ir(e,$.primary)&&($.hum=Lr(e,d)),v.push($)}for(const t of p)i[t.area]&&(m.has("entity:"+t.eid)||v.push({id:"lg_"+t.eid,name:t.name,model:l("device.light_group"),area:t.area,space:i[t.area],icon:"mdi:lightbulb-group",entities:[t.eid],primary:t.eid,bindingKind:"entity",bindingRef:t.eid,pdfs:[]}));for(const t of s){if(t.removed)continue;if(t.hidden&&!o.filter_seeded)continue;const[s,n]=t.binding.split(":");if("device"===s){const s=e.devices[n],o=t.area||s?.area_id||"",r=o&&i[o]||t.space||a,h=s&&_[s.id]||[];let p=s?qr(e,s.name_by_user||s.name||"",s.model,h,c):"mdi:help-circle";h.some(t=>t.startsWith("lock."))&&(p="mdi:lock");const u={id:t.id,name:s?.name_by_user||s?.name||l("device.fallback"),model:s?.model||"",area:o,space:r,icon:p,entities:h,bindingKind:"device",bindingRef:n};u.primary=Dr(e,h,p),"mdi:thermometer"!==p&&"mdi:air-filter"!==p||(u.temp=Or(e,h)),u.primary&&Ir(e,u.primary)&&(u.hum=Lr(e,h)),u.primary&&Ir(e,u.primary)&&(u.hum=Lr(e,h)),Br(u,t,e,d),v.push(u)}else if("entity"===s){if(Wr(e,n,d))continue;const s=e.entities[n],o=t.area||s?.area_id||s?.device_id&&e.devices[s.device_id]?.area_id||"",r=o&&i[o]||t.space||a,l=e.states[n],h=s?.name||l?.attributes?.friendly_name||n;let p=qr(e,h,"",[n],c);n.startsWith("lock.")&&(p="mdi:lock");const u={id:t.id,name:h,model:"",area:o,space:r,icon:p,entities:[n],primary:n,bindingKind:"entity",bindingRef:n};"mdi:thermometer"!==p&&"mdi:air-filter"!==p||(u.temp=Or(e,[n])),Ir(e,n)&&(u.hum=Lr(e,[n])),Br(u,t,e,d),v.push(u)}else{const s=t.area||"",o=t.space||s&&i[s]||a,n={id:t.id,name:t.name||l("device.virtual"),model:t.model||"",area:s,space:o,icon:t.icon||"mdi:map-marker",entities:[],bindingKind:"virtual",virtual:!0};Br(n,t,e,d),v.push(n)}}return v}function Vr(t,e,i,s){if(!e)return null;if(function(t,e,i){if(!e)return!1;const s=e.indexOf(":");if(s<1)return!1;const o=e.slice(0,s),n=e.slice(s+1),r=Ur(i);return"device"===o?r.devices.has(n):"entity"===o&&Wr(t,n,r)}(t,e,s))return null;const o=e.indexOf(":");if(o<0)return null;const n=e.slice(0,o),r=e.slice(o+1);if(!r)return null;if("entity"===n){const e=parseFloat(t.states[r]?.state);return Number.isFinite(e)?"temp"===i?Math.round(10*e)/10:Math.round(e):null}if("device"===n){const e=Object.entries(t.entities).filter(([,t])=>t.device_id===r).map(([t])=>t);return"temp"===i?Or(t,e):Lr(t,e)}return null}const Gr=new RegExp(["water","voda","coolant","flow_?temp","return_?temp","target","setpoint","chip","cpu","processor","board","core_temp","device_temp","batter","akkum","freezer","fridge","oven","kettle","boiler"].join("|"),"i");var Kr={"card.title":"House plan","count.devices":"{n} dev.","empty.no_spaces":"No spaces yet.","empty.add_first":"Add the first space and upload a floor plan.","empty.install":'Install the House Plan integration and add it in "Devices & services".',"btn.add_space":"Add space","btn.cancel":"Cancel","btn.save":"Save","btn.close":"Close","btn.delete":"Delete","btn.edit":"Edit","btn.open_in_ha":"Open in HA","btn.reset":"Reset","btn.attach":"Attach…","btn.upload":"Upload…","btn.replace":"Replace…","btn.no_area":"No area","title.zoom_in":"Zoom in","title.zoom_out":"Zoom out","title.zoom_fit":"Fit all","title.add_device":"Add a device to the plan","title.show_all":"Show hidden devices (ghosted, this tab only)","title.markup":"Room markup: grid, lines, outlines","title.configure_space":"Configure space","title.add_space":"Add space","title.markup_add":"Room outline: connect grid dots until the room closes","title.markup_merge":"Merge rooms: click one room, then the neighbour it shares a wall with","title.markup_split":"Split a room: click the room, then two points on its walls","title.markup_delroom":"Delete room: click inside a room and confirm","title.markup_closewall":"Close boundary opening: click a dashed virtual stretch","title.no_area_room":"Decorative room without an HA area (e.g. a hallway)","title.choose_area":"Select a Home Assistant area","title.need_plan":"Upload a floor-plan image","markup.add":"Room outline","markup.merge":"Merge rooms","markup.split":"Split","markup.resize":"Resize","title.markup_resize":"Resize rooms: drag a wall handle; click a room for a corner scale frame","markup.hint_resize":"drag a wall handle · click a room — corner frame · Esc cancels a drag · Ctrl+Z — undo a step","markup.opening":"Opening","markup.closewall":"Close boundary opening","markup.delete_room":"Delete room","history.undo":"Undo","history.redo":"Redo","history.undo_named":"Undo: {name} (Ctrl+Z)","history.redo_named":"Redo: {name} (Ctrl+Shift+Z / Ctrl+Y)","history.undo_empty":"Nothing to undo","history.redo_empty":"Nothing to redo","history.undone":"Undone: {name}","history.redone":"Redone: {name}","history.add_room":"Create room","history.split_room":"Split room","history.merge_rooms":"Merge rooms","history.resize_room":"Resize room","history.open_boundary":"Open boundary stretch","history.close_boundary":"Close boundary opening","history.wall_thickness":"Change wall thickness","history.add_opening":"Add door or window opening","history.edit_opening":"Edit door or window opening","history.move_opening":"Move door or window opening","history.delete_opening":"Delete door or window opening","history.delete_room":"Delete room","history.decor_add":"Add decor object","history.decor_edit":"Edit decor object","history.decor_move":"Move decor object","history.decor_transform":"Transform decor object","history.decor_delete":"Delete decor object","history.backdrop_transform":"Transform plan backdrop","title.markup_opening":"Doors & windows: click a wall to place, click an opening to edit","opening.new":"New opening","opening.edit":"Door / window","opening.door":"Door","opening.window":"Window","opening.type_label":"Type","opening.length_label":"Length, cm","opening.contact_label":"Open/close sensor","opening.lock_label":"Lock","opening.none":"— none —","opening.invert":"Invert open/closed","opening.flip_h":"Hinge on the other jamb","opening.flip_v":"Opens to the other side","opening.open":"Open","opening.closed":"Closed","opening.locked":"Locked","opening.unlocked":"Unlocked","opening.state_unknown":"unavailable","opening.no_entities":"No sensors bound — a static symbol on the plan.","toast.opening_no_wall":"Click next to a room wall — openings sit on walls","markup.delete":"Delete","markup.hint_points":"points: {n} · Esc/Ctrl+Z — undo a dot · first point or Ctrl/Cmd+click — close","markup.hint_start":"click a grid dot to start the outline","tip.lqi":"average zigbee signal:","tip.area":"area: {value}","info.device_header":"Device on the plan","info.model":"Model","info.state":"State","info.link":"Link","info.manuals":"Manuals","info.none":"No additional information","marker.new_device":"New device","marker.name_label":"Name (shown on the plan)","marker.name_ph":"Name","marker.binding_label":"Bind to an HA device","marker.virtual_option":"Virtual device (no binding)","marker.search_ph":"Search device / group…","marker.nothing_found":"nothing found","marker.room_label":"Room","marker.room_override":" (override placement)","marker.room_choose":"— select a room —","marker.room_auto":"— by device area (auto) —","marker.icon_label":"Icon","marker.icon_ph":"mdi:… (empty = auto)","marker.display_label":"Display","display.badge":"Icon","display.icon_ripple":"Icon + activity","marker.display_hint":"A yellow plate means actual work. Activity adds events, presence and movement; alarms are always visible.","marker.activity_color":"Effect color","marker.ripple_size":"Effect size","marker.size_label":"Icon size / rotation","marker.angle_label":"Rotate","marker.model_label":"Model","marker.model_ph":"e.g. Aqara T&H","marker.link_label":"Link","marker.desc_label":"Description","marker.desc_ph":"Notes, specs…","marker.manuals_label":"Manuals (PDF etc.)","marker.sub_device":"device","marker.sub_z2m_group":" · Z2M group","marker.sub_group":"group","marker.sub_helper":"helper","space.new":"New space","space.header":"Space","space.title_label":"Title","space.title_ph":"e.g. Garage","space.plan_label":"Floor plan (background)","space.no_plan":"no plan image","space.plan_alt":"plan","room.new":"New room","room.name_label":"Display name","room.name_ph":"e.g. Terrace","room.area_label":"Home Assistant area (unassigned)","room.no_area_option":"— no area —","room.default_name":"Room","device.unnamed":"unnamed","device.light_group":"light group","device.fallback":"device","device.virtual":"virtual device","confirm.delete_room":'Delete room "{name}"?',"confirm.merge_rooms":'Merge rooms "{a}" and "{b}"?',"confirm.remove_marker":'Delete "{name}" from the plan? The device will disappear completely and stop contributing to plan data. You can add it again later.',"confirm.erase_decor":"Erase the {kind} object? You can undo this action from the editor history.","confirm.delete_space":'Delete space "{title}" with all its rooms and markup?',"toast.pos_save_failed":"Failed to save position: {err}","toast.no_entity":"The device has no suitable entity","toast.markup_needs_server":"Markup is available after the config is moved to the server","toast.conflict":"Config was changed in another window — data refreshed, repeat your last action","toast.cfg_save_failed":"Failed to save config: {err}","toast.room_overlap":"The outline overlaps room “{name}” — rooms must not overlap","toast.contour_min_edges":"Draw at least two edges before closing the outline","toast.contour_cannot_close":"The outline cannot close because it is degenerate or intersects itself","toast.merge_not_adjacent":"Only rooms that share a wall can be merged","toast.rooms_merged":"Rooms merged into “{name}”","toast.split_pick_wall":"Start the cut on the room’s wall","toast.split_bad_cut":"The cut must run wall to wall inside the room, without crossing walls or itself","merge.header":"Merge rooms","merge.hint":"The merged room keeps one name and one area. The other area is released — its devices leave the plan until another room claims it.","merge.keep":"Keep","merge.no_area":"no area","room.split_header":"New room from the split","toast.room_saved":"Room saved ({n}). Devices added: {added}. Outline the next one or exit markup.","toast.room_saved_no_area":"Room saved ({n}, no area). Outline the next one or exit markup.","toast.marker_needs_server":"Device editing is available after the config is moved to the server","toast.virtual_name_required":"Enter a name for the virtual device","toast.marker_saved":"Device saved","toast.marker_removed":"Device deleted from the plan","toast.integration_missing":"The House Plan integration is not installed — management unavailable","toast.plan_formats":"Supported formats: SVG, PNG, JPG, WebP","toast.plan_required":"Upload a floor plan — it is required","toast.space_added_onboard":"Space added. Outline the rooms: click grid dots and close the contour.","toast.space_added":"Space added","toast.space_saved":"Space saved","toast.space_deleted":"Space deleted","toast.delete_failed":"Delete failed: {err}","toast.error":"Error: {err}","toast.file_failed":'File "{name}" was not uploaded: {err}',"toast.files_attached":"Files attached: {n}","err.unknown":"unknown error","err.code":"code {code}","err.too_large":"file larger than {mb} MB","err.bad_ext":"unsupported type (PDF/image expected)","err.unauthorized":"administrator rights required","editor.title":"Title","editor.default_floor":"Default space","editor.icon_size":"Icon size, % of plan width","editor.show_temperature":"Show temperature","editor.live_states":"Live states (on/off, open…)","editor.show_signal":"Show zigbee signal (LQI)","editor.language":"Interface language","editor.lang_auto":"Auto (HA profile)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Icon rules: which MDI icon devices get by name","rules.title":"Icon rules","rules.hint":"Rules are checked top-down against “device name + model” (case-insensitive regex); the first match wins. When nothing matches, the entity device class decides, then the generic chip icon.","rules.pattern_ph":"regex, e.g. plug|socket","rules.icon_ph":"mdi:power-socket-de","rules.add":"Add rule","rules.reset":"Reset to defaults","rules.test_ph":"Try a device name…","rules.invalid":"invalid regex","rules.saved":"Icon rules saved","btn.up":"Up","btn.down":"Down","tap.info":"Device card","tap.more_info":"HA more-info dialog","tap.toggle":"Toggle (lights/switches)","marker.tap_label":"Tap action for this device","tap.toggle_note":"Toggle never applies to locks and alarms; hold the icon to open the info card.","import.title":"Create spaces from HA floors","import.hint":"Your Home Assistant already knows these floors. Pick the ones to turn into plan spaces — you will upload a floor-plan image for each one next. Rooms are then outlined by hand on the plan.","import.start":"Create {n} space(s)","import.manual":"Start from scratch","import.progress":"Floor {i} of {n}","import.done":"Spaces created. Outline the rooms: click grid dots and close the contour.","btn.skip":"Skip","space.scale_label":"Scale (grid cell size)","space.scale_unit":"cm per cell","space.display_section":"Display","space.show_borders":"Always show room borders","space.show_names":"Show room names (drag to move)","space.room_color":"Border & name color","space.opacity":"Opacity","space.fill_label":"Room fill","fill.none":"None","fill.lqi":"Zigbee signal","fill.light":"Lights","space.source_file":"I have a floor-plan image","space.source_draw":"No image — I'll outline rooms by hand","space.orientation":"Canvas","orient.landscape":"Landscape","orient.portrait":"Portrait","orient.square":"Square","fill.temp":"Temperature","space.temp_min":"Comfort from","space.temp_max":"to","tip.temp_avg":"average temperature:","space_card.button":"Open the space plan","space_card.not_found":"Space “{id}” not found","space_card.loading":"Loading…","editor.space":"Space","editor.show_button":"Show button","editor.button_label":"Button label","editor.button_target":"Target dashboard path","marker.sub_entity":"entity","title.general_settings":"General settings","gs.title":"General settings","gs.hint":"Fill colors apply to every space; each color has its own opacity. Which fill mode a space uses is set in that space's dialog.","gs.light_group":"Fill: lights","gs.light_on":"Lights on","gs.light_off":"All lights off","gs.temp_group":"Fill: temperature","gs.temp_cold":"Cold","gs.temp_ok":"Comfortable","gs.temp_hot":"Hot","gs.lqi_group":"Fill: zigbee signal","gs.lqi_low":"Weak signal","gs.lqi_high":"Strong signal","gs.reset":"Reset to defaults","gs.saved":"General settings saved","space.show_lqi":"Show zigbee signal (LQI) next to devices","space.hide_decor":"Hide the decorative layer","space.hide_decor_tip":"Lines, shapes, labels and furniture stay where they are — visible in the backdrop editor, not on the plan.","space.hide_openings":"Hide doors and windows","space.hide_openings_tip":"The symbols are not drawn, but the openings keep working: light passes through, the sun comes in at a window, contact sensors still open them. The plan editor always shows them.","gs.light_none":"No light sources","mode.plan":"Plan editor","mode.devices":"Device editor","display.value":"Value instead of an icon","marker.subarea":"no area, manual","device.new":"New device — open its editor to dismiss","opening.unlock_action":"Unlock","opening.lock_action":"Lock","opening.lock_pending":"Working…","title.close_editor":"Close editor (back to view)","devbar.add":"Add","devbar.show_all":"Show hidden","devbar.rules":"Icon rules","space.roomcard_section":"Room card shows:","space.label_temp":"Temperature","space.label_hum":"Humidity","space.label_lqi":"Average Zigbee signal","space.label_light":"Lights on/off","roomcard.light_on":"On","roomcard.light_off":"Off","roomcard.light_partial":"{on} of {total}","toast.split_pick_inside":"Intermediate cut points must be inside the room","mode.decor":"Background editor","decor.select":"Select","decor.line":"Line","decor.rect":"Rectangle","decor.ellipse":"Oval","decor.text":"Text","decor.erase":"Erase","decor.erase_confirm_title":"Erase object?","decor.color":"Color","decor.width":"Line width","decor.fill":"Fill","decor.fill_color":"Fill color","decor.length":"Length","decor.size":"Size","decor.angle":"Rotation angle, °","decor.text_size":"Text size","decor.backdrop_properties":"Plan backdrop properties","decor.text_title":"Text label","decor.object_title":"Edit {kind}","decor.text_label":"Text","decor.live_group":"Insert HA variable","decor.live_entity":"Entity","decor.live_entity_ph":"choose an entity","decor.live_attr":"Value","decor.live_attr_ph":"choose state or attribute","decor.live_state":"State","decor.backdrop":"Backdrop image","decor.backdrop_hint":"Drag to move; pull a corner to resize; use the top handle to rotate. Shift changes proportions or frees the angle.","decor.backdrop_reset":"Reset the picture","decor.backdrop_reset_done":"The picture is back at its original place and size","marker.icon_auto":"Auto: {icon} (by icon rules; pick one to override)","marker.icon_pin_auto":"Pin","mode.plan_tip":"Plan editor — the geometry of the home: draw and split/merge rooms, bind them to HA areas, place doors and windows, move room cards, set the scale","mode.devices_tip":"Device editor — everything about icons: drag to position, click to edit binding/icon/display, add virtual devices, icon rules","mode.decor_tip":"Background editor — purely visual decor under the plan: lines, rectangles, ovals and text labels that never react to clicks","fill.glow":"Light sources (dark house, glowing lamps)","gs.glow_group":"Light-sources fill","gs.glow_base":"House darkness","gs.glow_light":"Default light color / intensity","gs.wall_group":"Walls","gs.wall_fill":"Wall fill","gs.glow_radius":"Glow radius","gs.unit_m":"m","gs.unit_ft":"ft","marker.controls_label":"Controls other light sources","marker.controls_hint":"With tap action “Toggle”, a click flips every source added here. The marker’s own bound entity is controlled directly and cannot be added; use the switch below to classify it as a light.","marker.controls_filter":"Search lights and switches…","info.controls":"Controls","marker.glow_radius_label":"Glow radius (light-sources fill)","marker.glow_radius_hint":"empty = default from general settings","markup.wallthick":"Wall thickness","title.markup_wallthick":"Wall thickness — click a wall to set how thick it is. Empty or zero removes the thickness.","markup.hint_wallthick":"click a wall · Esc closes without applying","wallthick.field":"Thickness","wallthick.unit_cm":"cm","wallthick.unit_in":"in","wallthick.apply_room":"Apply to all walls of this room","markup.draw_wall_title":"Thickness for new room walls. Empty or zero — thin walls. Shared walls keep the neighbour's value.","toast.wallthick_pick":"Click a wall (not an open boundary)","toast.wallthick_open":"Open boundaries have no thickness","toast.wallthick_set":"Wall thickness set","toast.wallthick_cleared":"Wall thickness removed","markup.openwall":"Open boundary","title.markup_openwall":"Open boundary — click a point on a shared wall, then a second point on the same wall (within the nearest corners) to make that stretch virtual. Crosshair cursor.","toast.openwall_pick":"Click a wall shared by two rooms","toast.openwall_shared_only":"Only a shared wall between two rooms can be opened","toast.openwall_short":"Stretch too short — pick a farther point","toast.openwall_opened_span":"Virtual stretch opened","toast.openwall_closed_span":"Virtual stretch closed","toast.closewall_pick":"Click a dashed virtual stretch","toast.closewall_use_tool":"Use “Close boundary opening” for this stretch","toast.delete_room_pick":"Click inside the room you want to delete","toast.openwall_openings_removed":"Openings on the virtual stretch were removed","toast.openwall_opened":"Boundary “{a}” ↔ “{b}” is now open","toast.openwall_closed":"Boundary “{a}” ↔ “{b}” is closed again","toast.opening_on_virtual":"Openings cannot sit on a virtual wall","marker.from_ha_option":"Pick from the HA list","marker.show_entities":"Show entities","marker.show_entities_tip":"Adds not only devices to the list, but all their entities too","marker.pick_ph":"Choose a device…","room.open_area":"Open the HA area","kiosk.title":"This screen's sizes","kiosk.hint":"Stored on this device only — every wall tablet or TV can have its own comfortable sizes.","kiosk.icon_scale":"Device icon size","kiosk.font_scale":"Room card text size","editor.kiosk":"Wall device (kiosk) mode","editor.cycle":"Auto-switch spaces every N seconds (kiosk, 0 = off)","room.settings_title":"Room settings","room.settings_section":"Room settings (override the space)","room.fill_label":"Fill in THIS room","fill.inherit":"As the space","room.temp_src_label":"Temperature source","room.hum_src_label":"Humidity source","room.src_average":"Average over the room's sensors (default)","room.src_pick":"A specific HA device or entity","room.src_ph":"Choose a source…","toast.room_updated":"Room updated","space.card_font":"Room-card font size (whole space)","room.sizes_section":"Font sizes","room.name_scale":"Room name size","room.label_scale":"Metrics size","preview.room_name":"Living room","toast.cfg_reload_failed":"Could not reload the plan from the server: {err}","room.settings_short":"Room settings","room.unnamed":"Unnamed room","marker.use_climate_temp":"Use the device's temperature sensor","marker.use_climate_temp_tip":"Air conditioners and thermostats know the room temperature (current_temperature). Shows it as a badge next to the icon and counts it in the room average — like a regular thermometer.","marker.is_light":"This device is a light source","marker.is_light_tip":"Makes the icon glow in the “Light sources” fill even without a light entity — for a smart switch driving ordinary fixtures. The glow follows the switch (or the lights bound above).","confirm.unlock":"Unlock “{name}”?","toast.files_migrate_failed":"Attachments could not be moved to the new binding, links keep pointing at the old files: {err}","space.pick_saved":"Already uploaded","space.pick_saved_hint":"Plans stored on the server, including ones you detached earlier","space.no_saved":"No plans stored on the server yet.","space.loading":"Loading…","space.used_by":"in use: {list}","space.in_use":"A space still uses this plan — detach it first","btn.use":"Use","confirm.delete_plan":'Delete the plan file "{name}" from the server? This cannot be undone.',"toast.plans_list_failed":"Could not list the stored plans: {err}","toast.plan_delete_failed":"Could not delete the plan: {err}","marker.hide":"Hide","marker.hide_tip":'The device will disappear from the plan after saving but will still count toward the room signal. Restore it through "Show hidden" in the device editor.',"marker.show":"Show","marker.show_tip":"The device will appear on the plan again after saving.","marker.delete_tip":"Completely delete the device from the plan and every aggregate. You can add it again later.","tap.run":"Run automation/script/scene","tap.cover":"Open/close (curtains/blinds)","marker.run_target_label":"What to run","marker.run_search_ph":"Search: automation, script or scene…","marker.run_target_gone":"Target {id} not found — pick again","marker.tap_confirm":"Ask for confirmation","marker.tap_confirm_tip":"Show a confirmation dialog before acting — a guard against accidental taps.","run.automation":"automation","run.script":"script","run.scene":"scene","confirm.tap_run":'Run "{name}"?',"confirm.tap_toggle":'Toggle "{name}"?',"confirm.tap_cover":'Open/close "{name}"?',"toast.run_started":"Started: {name}","toast.run_target_missing":"Run target not found — check the device settings","toast.run_target_required":"Pick an automation, script or scene","btn.run":"Run","vac.section":"Robot vacuum: live position","vac.status_found":"Position source found: {name}","vac.status_none":"The integration reports no coordinates — the robot will only be shown at its base","vac.autocal":"Set up automatically","vac.live":"Live position on the plan","vac.trail":"Show the robot's path","vac.cal_maps":"Calibrated maps: {maps}","vac.autocal_no_rooms":"The integration reports no room list — open “Fit manually”","vac.autocal_no_match":"Room names did not match (need ≥3 in common) — open “Fit manually”","vac.autocal_res_warn":"Matched {rooms} rooms but the fit is rough — verify and refine via “Fit manually” if needed","vac.autocal_done":"Done: bound via {rooms} rooms. Start a cleanup and check","vac.cal_need_pos":"The robot is not reporting coordinates — start a cleanup and pause it","vac.cal_done":"Calibration saved. Start a cleanup and check","vac.cal_cancelled":"Calibration cancelled","vac.fit":"Fit manually","vac.fit_hint":"Drag the robot map into place, stretch by the corners","vac.fit_rotate":"Rotate 90°","vac.fit_mirror":"Mirror","vac.trail_never":"Never","vac.trail_cleaning":"While cleaning","vac.trail_always":"Always","gs.bg_group":"Stage background","gs.bg_color":"Background around the plan","gs.bg_default":"Theme default","gs.bg_theme":"theme default","gs.bg_mode":"Plan background","gs.bg_static":"Static color","gs.bg_daynight":"Follows the sun (day/night)","gs.bg_daynight_hint":"The stage follows the sun: neutral day, warm golden hour, deep night. Needs the compass below.","gs.sun_group":"Sun","gs.sun_missing":"The sun.sun entity was not found — the sun features stay off.","gs.north":"North on the plan","gs.north_ph":"not set","gs.north_hint":"Point the arrow at north (1° steps, 15° with Shift) or type the degrees — until then the sun features stay off.","gs.north_clear":"Clear","gs.north_letter":"N","gs.sun_rays":"Sunlight through windows","gs.weather":"Weather entity","gs.weather_ph":"weather.home (optional)","gs.about_group":"About","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · docs & issues","gs.about_telegram":"Telegram chat","space.bg_color":"Background around the plan","space.bg_inherit":"Inherit general","space.bg_inherited":"inherits general settings","space.bg_mode":"Plan background","space.north":"North on the plan (override)","space.north_inherited":"inherited: {v}","space.sun_rays":"Sunlight through windows","space.sun_inherit":"Inherit general","space.sun_on":"On","space.sun_off":"Off","canvas.far_objects":"{n} object(s) far from the plan","canvas.show_far":"Show","canvas.home_tip":"The plan is over there — click to fit it","gs.grid_group":"Plan maintenance","gs.grid_hint":"Updates data models, aligns plan elements to the grid and merges redundant wall fragments. An exact report is shown before anything is stored.","gs.align_all":"Optimize plans","gs.align_title":"Optimize plans","gs.align_none":"All plans already use the current optimized data model.","gs.align_count":"{n} of {total} elements will move, by at most {cm} cm.","gs.align_where":"The largest shift is in “{s}”.","gs.align_turned":"Openings whose angle is corrected: {n}.","gs.optimize_changes":"Model migrations: {m}; plans canonicalized: {c}; merged real-wall fragments: {w}; virtual fragments: {s}.","gs.align_warn":"Elements deliberately placed between grid nodes will move. One undo is available after the operation, only until the next plan edit.","gs.align_run":"Optimize","gs.align_done":"Plans optimized: {n} elements moved, {m} records maintained","gs.optimize_undo":"Undo last optimization","gs.optimize_undone":"The last optimization was undone","decor.furniture":"Furniture","furn.title":"Furniture library","furn.symbol":"Symbol","furn.group_furniture":"Furniture","furn.group_appliance":"Appliances","furn.group_sanitary":"Plumbing","furn.group_other":"Other","furn.width":"Width","furn.depth":"Depth","furn.pick_hint":"Pick a symbol, then click on the plan.","furn.place_hint":"Click on the plan — the piece lands against the nearest wall. Shift places it free.","furn.sym_sofa":"Sofa","furn.sym_armchair":"Armchair","furn.sym_coffee_table":"Coffee table","furn.sym_table_dining":"Dining table","furn.sym_table_round":"Round table","furn.sym_chair":"Chair","furn.sym_desk":"Desk","furn.sym_bed_double":"Double bed","furn.sym_bed_single":"Single bed","furn.sym_nightstand":"Nightstand","furn.sym_wardrobe":"Wardrobe","furn.sym_bookshelf":"Bookshelf","furn.sym_fridge":"Fridge","furn.sym_stove":"Cooker","furn.sym_dishwasher":"Dishwasher","furn.sym_washer":"Washing machine","furn.sym_dryer":"Tumble dryer","furn.sym_tv":"TV","furn.sym_ac":"Air conditioner","furn.sym_water_heater":"Water heater","furn.sym_toilet":"Toilet","furn.sym_bathtub":"Bathtub","furn.sym_shower":"Shower","furn.sym_sink":"Washbasin","furn.sym_kitchen_sink":"Kitchen sink","furn.sym_bidet":"Bidet","furn.sym_stairs":"Stairs","furn.sym_fireplace":"Fireplace","furn.sym_plant":"Plant","furn.sym_rug":"Rug"};const Yr={en:Kr,ru:{"card.title":"План дома","count.devices":"{n} устр.","empty.no_spaces":"Пространств пока нет.","empty.add_first":"Добавьте первое пространство и загрузите план этажа.","empty.install":"Установите интеграцию House Plan и добавьте запись в «Устройства и службы».","btn.add_space":"Добавить пространство","btn.cancel":"Отмена","btn.save":"Сохранить","btn.close":"Закрыть","btn.delete":"Удалить","btn.edit":"Редактировать","btn.open_in_ha":"Открыть в HA","btn.reset":"Сброс","btn.attach":"Прикрепить…","btn.upload":"Загрузить…","btn.replace":"Заменить…","btn.no_area":"Без зоны","title.zoom_in":"Приблизить","title.zoom_out":"Отдалить","title.zoom_fit":"Вписать всё","title.add_device":"Добавить устройство на план","title.show_all":"Показать скрытые устройства (полупрозрачными, только в этой вкладке)","title.markup":"Разметка комнат: сетка, линии, контуры","title.configure_space":"Настроить пространство","title.add_space":"Добавить пространство","title.markup_add":"Контур комнаты: соединяйте точки сетки линиями до замыкания комнаты","title.markup_merge":"Объединить комнаты: клик по одной, затем по соседней с общей стеной","title.markup_split":"Разделить комнату: клик по комнате, затем две точки на её стенах","title.markup_delroom":"Удалить комнату: кликните внутри комнаты и подтвердите удаление","title.markup_closewall":"Закрыть проём в границе: кликните по пунктирному виртуальному участку","title.no_area_room":"Декоративная комната без привязки к зоне (например, холл)","title.choose_area":"Выберите зону Home Assistant","title.need_plan":"Загрузите подложку (план этажа)","markup.add":"Контур комнаты","markup.merge":"Объединить комнаты","markup.split":"Разделить","markup.resize":"Размер","title.markup_resize":"Изменение размера комнат: тяните ручку стены; клик по комнате — угловая рамка масштаба","markup.hint_resize":"тяните ручку стены · клик по комнате — угловая рамка · Esc отменяет перетаскивание · Ctrl+Z — отмена шага","markup.opening":"Проём","markup.closewall":"Закрыть проём в границе","markup.delete_room":"Удалить комнату","history.undo":"Отменить","history.redo":"Повторить","history.undo_named":"Отменить: {name} (Ctrl+Z)","history.redo_named":"Повторить: {name} (Ctrl+Shift+Z / Ctrl+Y)","history.undo_empty":"Нет операций для отмены","history.redo_empty":"Нет операций для повтора","history.undone":"Отменено: {name}","history.redone":"Повторено: {name}","history.add_room":"Создание комнаты","history.split_room":"Разделение комнаты","history.merge_rooms":"Объединение комнат","history.resize_room":"Изменение размера комнаты","history.open_boundary":"Открытие участка границы","history.close_boundary":"Закрытие проёма в границе","history.wall_thickness":"Изменение толщины стены","history.add_opening":"Добавление дверного или оконного проёма","history.edit_opening":"Изменение дверного или оконного проёма","history.move_opening":"Перемещение дверного или оконного проёма","history.delete_opening":"Удаление дверного или оконного проёма","history.delete_room":"Удаление комнаты","history.decor_add":"Добавление объекта декора","history.decor_edit":"Изменение объекта декора","history.decor_move":"Перемещение объекта декора","history.decor_transform":"Трансформация объекта декора","history.decor_delete":"Удаление объекта декора","history.backdrop_transform":"Трансформация подложки плана","title.markup_opening":"Двери и окна: клик по стене — добавить, клик по проёму — редактировать","opening.new":"Новый проём","opening.edit":"Дверь / окно","opening.door":"Дверь","opening.window":"Окно","opening.type_label":"Тип","opening.length_label":"Длина, см","opening.contact_label":"Датчик открытия","opening.lock_label":"Замок","opening.none":"— нет —","opening.invert":"Инвертировать открыто/закрыто","opening.flip_h":"Петли с другой стороны","opening.flip_v":"Открывается в другую сторону","opening.open":"Открыто","opening.closed":"Закрыто","opening.locked":"Заперто","opening.unlocked":"Не заперто","opening.state_unknown":"недоступно","opening.no_entities":"Датчики не привязаны — статичный символ на плане.","toast.opening_no_wall":"Кликните рядом со стеной комнаты — проёмы ставятся на стены","markup.delete":"Удалить","markup.hint_points":"точек: {n} · Esc/Ctrl+Z — убрать точку · клик по первой или Ctrl+клик — замкнуть","markup.hint_start":"кликните точку сетки, чтобы начать контур","tip.lqi":"средний сигнал zigbee:","tip.area":"площадь: {value}","info.device_header":"Устройство на плане","info.model":"Модель","info.state":"Состояние","info.link":"Ссылка","info.manuals":"Инструкции","info.none":"Нет дополнительной информации","marker.new_device":"Новое устройство","marker.name_label":"Имя (отображается на плане)","marker.name_ph":"Название","marker.binding_label":"Привязка к устройству HA","marker.virtual_option":"Виртуальное устройство (без привязки)","marker.search_ph":"Поиск устройства / группы…","marker.nothing_found":"ничего не найдено","marker.room_label":"Комната","marker.room_override":" (переопределить размещение)","marker.room_choose":"— выберите комнату —","marker.room_auto":"— по зоне устройства (авто) —","marker.icon_label":"Иконка","marker.icon_ph":"mdi:… (пусто = авто)","marker.display_label":"Отображение","display.badge":"Значок","display.icon_ripple":"Значок + активность","marker.display_hint":"Жёлтая подложка означает фактическую работу. Активность добавляет события, присутствие и движение; тревога видна всегда.","marker.activity_color":"Цвет эффекта","marker.ripple_size":"Размер эффекта","marker.size_label":"Размер / поворот значка","marker.angle_label":"Поворот","marker.model_label":"Модель","marker.model_ph":"напр. Aqara T&H","marker.link_label":"Ссылка","marker.desc_label":"Описание","marker.desc_ph":"Заметки, характеристики…","marker.manuals_label":"Инструкции (PDF и т.п.)","marker.sub_device":"устройство","marker.sub_z2m_group":" · Z2M-группа","marker.sub_group":"группа","marker.sub_helper":"хелпер","space.new":"Новое пространство","space.header":"Пространство","space.title_label":"Название","space.title_ph":"Например: Гараж","space.plan_label":"Подложка (план)","space.no_plan":"нет подложки","space.plan_alt":"план","room.new":"Новая комната","room.name_label":"Отображаемое имя","room.name_ph":"Например: Терраса","room.area_label":"Зона Home Assistant (свободные)","room.no_area_option":"— без зоны —","room.default_name":"Комната","device.unnamed":"без имени","device.light_group":"группа света","device.fallback":"устройство","device.virtual":"виртуальное устройство","confirm.delete_room":"Удалить комнату «{name}»?","confirm.merge_rooms":"Слить комнаты «{a}» и «{b}»?","confirm.remove_marker":"Удалить «{name}» с плана? Устройство исчезнет полностью и перестанет участвовать в данных плана. Позже его можно будет добавить заново.","confirm.erase_decor":"Стереть объект «{kind}»? Действие можно отменить из истории редактора.","confirm.delete_space":"Удалить пространство «{title}» со всеми комнатами и разметкой?","toast.pos_save_failed":"Не удалось сохранить позицию: {err}","toast.no_entity":"У устройства нет подходящей сущности","toast.markup_needs_server":"Разметка доступна после переноса конфига на сервер","toast.conflict":"Конфиг изменён в другом окне — данные обновлены, повторите последнее действие","toast.cfg_save_failed":"Не удалось сохранить конфиг: {err}","toast.room_overlap":"Контур накладывается на комнату «{name}» — комнаты не должны накладываться","toast.contour_min_edges":"Чтобы замкнуть контур, сначала нарисуйте минимум две грани","toast.contour_cannot_close":"Контур нельзя замкнуть: он вырожден или пересекает сам себя","toast.merge_not_adjacent":"Объединять можно только комнаты с общей стеной","toast.rooms_merged":"Комнаты объединены в «{name}»","toast.split_pick_wall":"Начните разрез на стене комнаты","toast.split_bad_cut":"Разрез — от стены до стены внутри комнаты, без пересечения стен и самого себя","merge.header":"Объединение комнат","merge.hint":"У объединённой комнаты одно имя и одна зона. Вторая зона освобождается — её устройства уйдут с плана, пока их не заберёт другая комната.","merge.keep":"Оставить","merge.no_area":"без зоны","room.split_header":"Новая комната после разделения","toast.room_saved":"Комната сохранена ({n}). Устройств добавлено: {added}. Обведите следующую или выйдите из разметки.","toast.room_saved_no_area":"Комната сохранена ({n}, без зоны). Обведите следующую или выйдите из разметки.","toast.marker_needs_server":"Редактирование устройств доступно после переноса конфига на сервер","toast.virtual_name_required":"Укажите имя виртуального устройства","toast.marker_saved":"Устройство сохранено","toast.marker_removed":"Устройство удалено с плана","toast.integration_missing":"Интеграция House Plan не установлена — управление недоступно","toast.plan_formats":"Поддерживаются SVG, PNG, JPG, WebP","toast.plan_required":"Загрузите подложку — план этажа обязателен","toast.space_added_onboard":"Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.","toast.space_added":"Пространство добавлено","toast.space_saved":"Пространство сохранено","toast.space_deleted":"Пространство удалено","toast.delete_failed":"Ошибка удаления: {err}","toast.error":"Ошибка: {err}","toast.file_failed":"Файл «{name}» не загружен: {err}","toast.files_attached":"Прикреплено файлов: {n}","err.unknown":"неизвестная ошибка","err.code":"код {code}","err.too_large":"файл больше {mb} МБ","err.bad_ext":"недопустимый тип (нужен PDF/изображение)","err.unauthorized":"нужны права администратора","editor.title":"Заголовок","editor.default_floor":"Пространство по умолчанию","editor.icon_size":"Размер иконок, % ширины плана","editor.show_temperature":"Показывать температуру","editor.live_states":"Живые состояния (вкл/выкл, открыто…)","editor.show_signal":"Показывать сигнал zigbee (LQI)","editor.language":"Язык интерфейса","editor.lang_auto":"Авто (профиль HA)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Правила иконок: какая MDI-иконка достаётся устройству по имени","rules.title":"Правила иконок","rules.hint":"Правила проверяются сверху вниз по строке «имя устройства + модель» (regex без учёта регистра); срабатывает первое совпадение. Если ничего не подошло — решает device class сущности, затем — иконка-заглушка.","rules.pattern_ph":"regex, напр. розетк|plug","rules.icon_ph":"mdi:power-socket-de","rules.add":"Добавить правило","rules.reset":"Сбросить к умолчаниям","rules.test_ph":"Проверьте имя устройства…","rules.invalid":"некорректный regex","rules.saved":"Правила иконок сохранены","btn.up":"Вверх","btn.down":"Вниз","tap.info":"Карточка устройства","tap.more_info":"Диалог HA (more-info)","tap.toggle":"Переключить (свет/розетки)","marker.tap_label":"Действие по нажатию для этого устройства","tap.toggle_note":"Toggle никогда не применяется к замкам и сигнализациям; долгое нажатие всегда открывает инфо-карточку.","import.title":"Создать пространства из этажей HA","import.hint":"Home Assistant уже знает эти этажи. Отметьте, какие превратить в пространства плана — далее для каждого попросим картинку плана. Комнаты затем обводятся вручную по плану.","import.start":"Создать: {n}","import.manual":"Начать с нуля","import.progress":"Этаж {i} из {n}","import.done":"Пространства созданы. Обведите комнаты: кликайте по точкам сетки и замкните контур.","btn.skip":"Пропустить","space.scale_label":"Масштаб (размер клетки сетки)","space.scale_unit":"см на клетку","space.display_section":"Отображение","space.show_borders":"Всегда отображать границы комнат","space.show_names":"Отображать названия комнат (перетаскиваются)","space.room_color":"Цвет границ и названий","space.opacity":"Прозрачность","space.fill_label":"Заливка комнат","fill.none":"Нет","fill.lqi":"По силе зигби-сигнала","fill.light":"По освещению","space.source_file":"У меня есть картинка плана","space.source_draw":"Нет подложки — нарисую комнаты вручную","space.orientation":"Холст","orient.landscape":"Альбомный","orient.portrait":"Портретный","orient.square":"Квадрат","fill.temp":"По температуре","space.temp_min":"Комфорт от","space.temp_max":"до","tip.temp_avg":"средняя температура:","space_card.button":"Перейти к пространству","space_card.not_found":"Пространство «{id}» не найдено","space_card.loading":"Загрузка…","editor.space":"Пространство","editor.show_button":"Показывать кнопку","editor.button_label":"Текст кнопки","editor.button_target":"Путь дашборда (куда вести)","marker.sub_entity":"сущность","title.general_settings":"Общие настройки","gs.title":"Общие настройки","gs.hint":"Цвета заливок действуют на все пространства; у каждого цвета своя прозрачность. Какой режим заливки использует пространство — задаётся в его диалоге.","gs.light_group":"Заливка: освещение","gs.light_on":"Свет включён","gs.light_off":"Весь свет выключен","gs.temp_group":"Заливка: температура","gs.temp_cold":"Холодно","gs.temp_ok":"Комфорт","gs.temp_hot":"Жарко","gs.lqi_group":"Заливка: зигби-сигнал","gs.lqi_low":"Слабый сигнал","gs.lqi_high":"Сильный сигнал","gs.reset":"Сбросить к умолчаниям","gs.saved":"Общие настройки сохранены","space.show_lqi":"Показывать зигби-сигнал (LQI) у устройств","space.hide_decor":"Скрыть декоративный слой","space.hide_decor_tip":"Линии, фигуры, надписи и мебель остаются на месте — их видно в редакторе подложки, но не на плане.","space.hide_openings":"Скрыть проёмы","space.hide_openings_tip":"Двери и окна не рисуются, но продолжают работать: свет проходит, солнце светит в окна, датчики открытия срабатывают. В редакторе плана проёмы видно всегда.","gs.light_none":"Нет источников света","mode.plan":"Редактор плана","mode.devices":"Редактор устройств","display.value":"Значение вместо иконки","marker.subarea":"без зоны, вручную","device.new":"Новое устройство — откройте его редактор, чтобы снять отметку","opening.unlock_action":"Открыть замок","opening.lock_action":"Закрыть замок","opening.lock_pending":"Выполняется…","title.close_editor":"Закрыть редактор (вернуться к просмотру)","devbar.add":"Добавить","devbar.show_all":"Показать скрытые","devbar.rules":"Правила иконок","space.roomcard_section":"В карточке комнаты:","space.label_temp":"Температура","space.label_hum":"Влажность","space.label_lqi":"Средний Zigbee-сигнал","space.label_light":"Свет вкл/выкл","roomcard.light_on":"Вкл","roomcard.light_off":"Выкл","roomcard.light_partial":"{on} из {total}","toast.split_pick_inside":"Промежуточные точки разреза — внутри комнаты","mode.decor":"Редактор подложки","decor.select":"Выбрать","decor.line":"Линия","decor.rect":"Прямоугольник","decor.ellipse":"Овал","decor.text":"Надпись","decor.erase":"Стереть","decor.erase_confirm_title":"Стереть объект?","decor.color":"Цвет","decor.width":"Толщина линии","decor.fill":"Заливка","decor.fill_color":"Цвет заливки","decor.length":"Длина","decor.size":"Размер","decor.angle":"Угол поворота, °","decor.text_size":"Размер текста","decor.backdrop_properties":"Свойства картинки-подложки","decor.text_title":"Надпись","decor.object_title":"Редактирование: {kind}","decor.text_label":"Текст","decor.live_group":"Вставить переменную HA","decor.live_entity":"Сущность","decor.live_entity_ph":"выберите сущность","decor.live_attr":"Значение","decor.live_attr_ph":"выберите состояние или атрибут","decor.live_state":"Состояние","decor.backdrop":"Картинка-подложка","decor.backdrop_hint":"Тяните картинку — перемещение; угол — размер; верхнюю ручку — поворот. Shift меняет пропорции или снимает шаг угла.","decor.backdrop_reset":"Вернуть картинку","decor.backdrop_reset_done":"Картинка вернулась на своё место и в свой размер","marker.icon_auto":"Авто: {icon} (по правилам иконок; выберите свою, чтобы заменить)","marker.icon_pin_auto":"Закрепить","mode.plan_tip":"Редактор плана — геометрия дома: рисование и объединение/разделение комнат, привязка к зонам HA, двери и окна, карточки комнат, масштаб","mode.devices_tip":"Редактор устройств — всё про значки: перетаскивание, клик — настройка привязки/иконки/отображения, виртуальные устройства, правила иконок","mode.decor_tip":"Редактор подложки — чисто визуальный декор под планом: линии, прямоугольники, овалы и надписи, не реагирующие на клики","fill.glow":"Свет по источникам (тёмный дом, пятна света)","gs.glow_group":"Заливка «Свет по источникам»","gs.glow_base":"Темнота дома","gs.glow_light":"Цвет света по умолчанию / интенсивность","gs.wall_group":"Стены","gs.wall_fill":"Цвет заливки стен","gs.glow_radius":"Радиус свечения","gs.unit_m":"м","gs.unit_ft":"фут","marker.controls_label":"Управляет другими источниками света","marker.controls_hint":"При действии «Переключить» клик разом переключает все добавленные здесь источники. Собственная сущность маркера управляется напрямую и сюда не добавляется; чтобы считать её светом, включите флаг ниже.","marker.controls_filter":"Поиск ламп и выключателей…","info.controls":"Управляет","marker.glow_radius_label":"Радиус свечения (заливка «Свет по источникам»)","marker.glow_radius_hint":"пусто = по умолчанию из общих настроек","markup.wallthick":"Толщина стен","title.markup_wallthick":"Толщина стен — клик по стене задаёт толщину. Пустое поле или ноль убирает толщину.","markup.hint_wallthick":"клик по стене · Esc закрывает без применения","wallthick.field":"Толщина","wallthick.unit_cm":"см","wallthick.unit_in":"дюйм","wallthick.apply_room":"Применить ко всем стенам комнаты","markup.draw_wall_title":"Толщина стен новой комнаты. Пустое или ноль — без толщины. Общие стены сохраняют значение соседа.","toast.wallthick_pick":"Кликните по стене (не по открытой границе)","toast.wallthick_open":"У открытой границы нет толщины","toast.wallthick_set":"Толщина стены задана","toast.wallthick_cleared":"Толщина стены убрана","markup.openwall":"Открытая граница","title.markup_openwall":"Открытая граница — клик по точке на общей стене, затем второй клик на той же стене (не дальше ближайших углов) открывает виртуальный участок. Курсор — крестик.","toast.openwall_pick":"Кликните по стене, разделяющей две комнаты","toast.openwall_shared_only":"Открыть можно только общую стену двух комнат","toast.openwall_short":"Слишком короткий отрезок — кликните дальше","toast.openwall_opened_span":"Виртуальный отрезок открыт","toast.openwall_closed_span":"Виртуальный отрезок закрыт","toast.closewall_pick":"Кликните по пунктирному виртуальному участку","toast.closewall_use_tool":"Для этого участка выберите «Закрыть проём в границе»","toast.delete_room_pick":"Кликните внутри комнаты, которую нужно удалить","toast.openwall_openings_removed":"Проёмы на виртуальном отрезке удалены","toast.openwall_opened":"Граница «{a}» ↔ «{b}» теперь открыта","toast.openwall_closed":"Граница «{a}» ↔ «{b}» снова закрыта","toast.opening_on_virtual":"Проёмы на виртуальной стене запрещены","marker.from_ha_option":"Выбрать из списка HA","marker.show_entities":"Отображать сущности","marker.show_entities_tip":"Добавляет в список не только устройства, но и все их сущности","marker.pick_ph":"Выберите устройство…","room.open_area":"Открыть зону в HA","kiosk.title":"Размеры на этом экране","kiosk.hint":"Хранится только на этом устройстве — у каждого настенного планшета или ТВ свои удобные размеры.","kiosk.icon_scale":"Размер значков устройств","kiosk.font_scale":"Размер текста карточек комнат","editor.kiosk":"Режим настенного устройства (киоск)","editor.cycle":"Автосмена пространств каждые N секунд (киоск, 0 = выкл)","room.settings_title":"Настройки комнаты","room.settings_section":"Настройки комнаты (переопределяют пространство)","room.fill_label":"Заливка в ЭТОЙ комнате","fill.inherit":"Как у пространства","room.temp_src_label":"Источник температуры","room.hum_src_label":"Источник влажности","room.src_average":"Средняя по датчикам комнаты (по умолчанию)","room.src_pick":"Конкретное устройство или сущность HA","room.src_ph":"Выберите источник…","toast.room_updated":"Комната обновлена","space.card_font":"Размер шрифта карточек комнат (всё пространство)","room.sizes_section":"Размеры шрифтов","room.name_scale":"Размер названия","room.label_scale":"Размер подписей","preview.room_name":"Гостиная","toast.cfg_reload_failed":"Не удалось перечитать план с сервера: {err}","room.settings_short":"Настройки комнаты","room.unnamed":"Комната без имени","marker.use_climate_temp":"Использовать датчик температуры устройства","marker.use_climate_temp_tip":"Кондиционеры и термостаты знают температуру комнаты (current_temperature). Показывает её плашкой у значка и учитывает в средней температуре комнаты — как обычный термометр.","marker.is_light":"Это устройство — источник света","marker.is_light_tip":"Даёт ореол в заливке «Свет по источникам» даже без light-сущности — для умного выключателя с обычными светильниками. Ореол следует за выключателем (или за привязанными выше лампами).","confirm.unlock":"Открыть замок «{name}»?","toast.files_migrate_failed":"Не удалось перенести вложения к новой привязке, ссылки остались на старые файлы: {err}","space.pick_saved":"Уже загруженные","space.pick_saved_hint":"Планы, сохранённые на сервере, включая отцеплённые ранее","space.no_saved":"На сервере пока нет сохранённых планов.","space.loading":"Загрузка…","space.used_by":"используется: {list}","space.in_use":"План используется пространством — сначала отцепите его","btn.use":"Выбрать","confirm.delete_plan":"Удалить файл плана «{name}» с сервера? Действие необратимо.","toast.plans_list_failed":"Не удалось получить список планов: {err}","toast.plan_delete_failed":"Не удалось удалить план: {err}","marker.hide":"Скрыть","marker.hide_tip":"Устройство исчезнет с плана после сохранения, но продолжит участвовать в расчёте сигнала комнаты. Вернуть его можно через кнопку «Показать скрытые» в редакторе устройств.","marker.show":"Показать","marker.show_tip":"Устройство снова появится на плане после сохранения.","marker.delete_tip":"Полностью удалить устройство с плана и из всех расчётов. Позже его можно добавить заново.","tap.run":"Запустить автоматизацию/скрипт/сцену","tap.cover":"Открыть/закрыть (шторы/жалюзи)","marker.run_target_label":"Что запускать","marker.run_search_ph":"Поиск: автоматизация, скрипт или сцена…","marker.run_target_gone":"Цель {id} не найдена — выберите заново","marker.tap_confirm":"Спрашивать подтверждение","marker.tap_confirm_tip":"Перед выполнением показать диалог подтверждения — защита от случайных нажатий.","run.automation":"автоматизация","run.script":"скрипт","run.scene":"сцена","confirm.tap_run":"Запустить «{name}»?","confirm.tap_toggle":"Переключить «{name}»?","confirm.tap_cover":"Открыть/закрыть «{name}»?","toast.run_started":"Запущено: {name}","toast.run_target_missing":"Цель запуска не найдена — проверьте настройки устройства","toast.run_target_required":"Выберите автоматизацию, скрипт или сцену","btn.run":"Выполнить","vac.section":"Робот-пылесос: живая позиция","vac.status_found":"Источник координат найден: {name}","vac.status_none":"Интеграция не отдаёт координаты — робот будет показан только на базе","vac.autocal":"Настроить автоматически","vac.live":"Живая позиция на плане","vac.trail":"Показывать путь робота","vac.cal_maps":"Откалиброваны карты: {maps}","vac.autocal_no_rooms":"Интеграция не отдаёт список комнат — откройте «Подогнать вручную»","vac.autocal_no_match":"Не совпали имена комнат (нужно ≥3 общих) — откройте «Подогнать вручную»","vac.autocal_res_warn":"Совпало комнат: {rooms}, но привязка грубовата — проверьте и при необходимости откройте «Подогнать вручную»","vac.autocal_done":"Готово: привязка по {rooms} комнатам. Запустите уборку и проверьте","vac.cal_need_pos":"Робот сейчас не отдаёт координаты — запустите уборку и поставьте на паузу","vac.cal_done":"Калибровка сохранена. Запустите уборку и проверьте","vac.cal_cancelled":"Калибровка отменена","vac.fit":"Подогнать вручную","vac.fit_hint":"Перетащите карту робота на место, растяните за уголки","vac.fit_rotate":"Повернуть 90°","vac.fit_mirror":"Отразить","vac.trail_never":"Не показывать никогда","vac.trail_cleaning":"Во время уборки","vac.trail_always":"Показывать всегда","gs.bg_group":"Фон сцены","gs.bg_color":"Цвет фона вокруг плана","gs.bg_default":"Как в теме","gs.bg_theme":"по умолчанию — из темы","gs.bg_mode":"Фон плана","gs.bg_static":"Статичный цвет","gs.bg_daynight":"Следует за солнцем (день/ночь)","gs.bg_daynight_hint":"Фон следует за солнцем: нейтральный день, тёплый золотой час, глубокая ночь. Нужен компас ниже.","gs.sun_group":"Солнце","gs.sun_missing":"Сущность sun.sun не найдена — солнечные функции выключены.","gs.north":"Север на плане","gs.north_ph":"не задан","gs.north_hint":"Направьте стрелку на север (шаг 1°, с Shift 15°) или введите градусы — до этого солнечные функции молчат.","gs.north_clear":"Сбросить","gs.north_letter":"С","gs.sun_rays":"Солнце в окнах","gs.weather":"Сущность погоды","gs.weather_ph":"weather.home (необязательно)","gs.about_group":"О карточке","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · документация и issues","gs.about_telegram":"Чат в Telegram","space.bg_color":"Цвет фона вокруг плана","space.bg_inherit":"Наследовать общий","space.bg_inherited":"наследуется из общих настроек","space.bg_mode":"Фон плана","space.north":"Север на плане (переопределение)","space.north_inherited":"наследуется: {v}","space.sun_rays":"Солнце в окнах","space.sun_inherit":"Наследовать общий","space.sun_on":"Вкл","space.sun_off":"Выкл","canvas.far_objects":"Объектов далеко от плана: {n}","canvas.show_far":"Показать","canvas.home_tip":"План там — нажмите, чтобы вписать","gs.grid_group":"Обслуживание планов","gs.grid_hint":"Обновляет модели данных, выравнивает элементы по сетке и объединяет лишние фрагменты стен. Перед записью будет показан точный отчёт.","gs.align_all":"Оптимизировать планы","gs.align_title":"Оптимизировать планы","gs.align_none":"Все планы уже используют актуальную и оптимальную модель данных.","gs.align_count":"Сдвинется элементов: {n} из {total}, максимум на {cm} см.","gs.align_where":"Наибольший сдвиг — в пространстве «{s}».","gs.align_turned":"Проёмов с исправлением угла: {n}.","gs.optimize_changes":"Миграций модели: {m}; канонизировано планов: {c}; объединено отрезков реальных стен: {w}; виртуальных: {s}.","gs.align_warn":"Элементы, намеренно поставленные между узлами, будут сдвинуты. После операции доступна одна отмена — только до следующего изменения плана.","gs.align_run":"Оптимизировать","gs.align_done":"Планы оптимизированы: сдвинуто элементов — {n}, обслужено записей — {m}","gs.optimize_undo":"Отменить последнюю оптимизацию","gs.optimize_undone":"Последняя оптимизация отменена","decor.furniture":"Мебель","furn.title":"Библиотека мебели","furn.symbol":"Символ","furn.group_furniture":"Мебель","furn.group_appliance":"Техника","furn.group_sanitary":"Сантехника","furn.group_other":"Прочее","furn.width":"Ширина","furn.depth":"Глубина","furn.pick_hint":"Выберите символ и кликните по плану.","furn.place_hint":"Кликните по плану — предмет встанет к ближайшей стене. Shift — свободно.","furn.sym_sofa":"Диван","furn.sym_armchair":"Кресло","furn.sym_coffee_table":"Журнальный столик","furn.sym_table_dining":"Обеденный стол","furn.sym_table_round":"Круглый стол","furn.sym_chair":"Стул","furn.sym_desk":"Письменный стол","furn.sym_bed_double":"Двуспальная кровать","furn.sym_bed_single":"Односпальная кровать","furn.sym_nightstand":"Тумбочка","furn.sym_wardrobe":"Шкаф","furn.sym_bookshelf":"Стеллаж","furn.sym_fridge":"Холодильник","furn.sym_stove":"Плита","furn.sym_dishwasher":"Посудомоечная машина","furn.sym_washer":"Стиральная машина","furn.sym_dryer":"Сушильная машина","furn.sym_tv":"Телевизор","furn.sym_ac":"Кондиционер","furn.sym_water_heater":"Бойлер","furn.sym_toilet":"Унитаз","furn.sym_bathtub":"Ванна","furn.sym_shower":"Душ","furn.sym_sink":"Раковина","furn.sym_kitchen_sink":"Кухонная мойка","furn.sym_bidet":"Биде","furn.sym_stairs":"Лестница","furn.sym_fireplace":"Камин","furn.sym_plant":"Растение","furn.sym_rug":"Ковёр"}};function Jr(t,e){if(e&&e in Yr)return e;return(t?.locale?.language||t?.language||"en").toLowerCase().startsWith("ru")?"ru":"en"}function Zr(t,e,i){return wi(Yr[t][e]??Kr[e]??e,i)}class Xr extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return Jr(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[],e=this._lang;return[{name:"title",selector:{text:{}}},t.length?{name:"default_floor",selector:{select:{mode:"dropdown",options:t}}}:{name:"default_floor",selector:{text:{}}},{name:"language",selector:{select:{mode:"dropdown",options:[{value:"",label:Zr(e,"editor.lang_auto")},{value:"en",label:Zr(e,"editor.lang_en")},{value:"ru",label:Zr(e,"editor.lang_ru")}]}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}},{name:"kiosk",selector:{boolean:{}}},{name:"cycle",selector:{number:{min:0,max:3600,step:5,mode:"box"}}}]}render(){if(!this.hass||!this._config)return V;this._loadSpaces();const t=this._lang,e={title:Zr(t,"editor.title"),default_floor:Zr(t,"editor.default_floor"),language:Zr(t,"editor.language"),icon_size:Zr(t,"editor.icon_size"),show_temperature:Zr(t,"editor.show_temperature"),live_states:Zr(t,"editor.live_states"),show_signal:Zr(t,"editor.show_signal"),kiosk:Zr(t,"editor.kiosk"),cycle:Zr(t,"editor.cycle")};return W`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}Xr.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-card-editor")||customElements.define("houseplan-card-editor",Xr);const Qr=n`
    :host {
      --hp-bg: var(--card-background-color, #16212e);
      --hp-line: var(--divider-color, #2b3d4f);
      --hp-txt: var(--primary-text-color, #e6edf3);
      --hp-muted: var(--secondary-text-color, #8aa0b3);
      --hp-accent: var(--primary-color, #3ea6ff);
      --hp-on: #ffd45c;
      --hp-open: #ff9f43;
      /* design tokens (UI chrome only). The icon/plan scale math stays on
         --icon-size/--dev-size cqw units and never uses these. */
      /* spacing scale, fact-based; stray 3/5/7/9/13/14px values are unified
         onto the nearest step (max +-2px, the whole point of the pass) */
      --sp-1: 2px;
      --sp-2: 4px;
      --sp-3: 6px;
      --sp-4: 8px;
      --sp-5: 12px;
      --sp-6: 16px;
      /* px radii of dialogs/buttons/plates (the 22% badge radius is scale math) */
      --rad-s: 6px;
      --rad-m: 8px;
      --rad-l: 12px;
      /* font tiers: fine print+labels / body+buttons / title */
      --fs-s: 12px;
      --fs-m: 13px;
      --fs-l: 15px;
      /* elevation: badge / floating panel (menu, tip, toast) / dialog */
      --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.45);
      --shadow-2: 0 6px 22px rgba(0, 0, 0, 0.45);
      --shadow-3: 0 8px 30px rgba(0, 0, 0, 0.5);
    }
    ha-card {
      overflow: visible; /* overflow:hidden breaks position:sticky on the header */
    }
    .empty {
      padding: 40px 24px;
      color: var(--hp-txt);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-4);
    }
    .empty .big {
      --mdc-icon-size: 56px;
      color: var(--hp-accent);
      opacity: 0.7;
    }
    .empty .muted {
      color: var(--hp-muted);
      font-size: var(--fs-m);
      margin: 0;
    }
    .empty .btn {
      margin-top: var(--sp-4);
    }
    .hdr {
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
      background: var(--card-background-color, var(--hp-bg));
      border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px var(--sp-5);
      border-bottom: 1px solid var(--hp-line);
      flex-wrap: wrap;
    }
    .title {
      font-size: var(--fs-l);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      white-space: nowrap;
    }
    .title ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 18px;
    }
    .tabs {
      display: flex;
      gap: var(--sp-2);
      background: rgba(127, 127, 127, 0.12);
      padding: var(--sp-2);
      border-radius: var(--rad-l);
      flex-wrap: wrap;
    }
    @media (max-width: 620px) {
      .head { gap: var(--sp-3); padding: var(--sp-4) 10px; }
      .head .count { display: none; }
      .head .title { font-size: var(--fs-m); }
    }
    .tab {
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      display: inline-flex;
      align-items: center;
      padding: var(--sp-3) var(--sp-5);
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      font-weight: 600;
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
    }
    .tab:hover {
      color: var(--hp-txt);
    }
    .tab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .count {
      font-size: var(--fs-s);
      color: var(--hp-muted);
    }
    .spacer {
      flex: 1;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      padding: var(--sp-3) 10px;
      border-radius: var(--rad-m);
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
      font-size: var(--fs-m);
    }
    .btn ha-icon {
      --mdc-icon-size: 17px;
    }
    .btn:hover {
      border-color: var(--hp-accent);
    }
    .btn.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .btn.ghost {
      border: none;
    }
    .btn[disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
    .stage.noplan {
      background: #ffffff;
    }
    /* Editors always keep the white drawing sheet — even when a backdrop
       image is loaded. Without this, a picture plan painted the theme card
       colour under the grid (owner 2026-08-05). View keeps the historical
       theme / .noplan split. */
    .stage.mode-plan,
    .stage.mode-devices,
    .stage.mode-decor {
      background: #ffffff;
    }
    .stage {
      position: relative;
      width: 100%;
      container-type: inline-size;
      overflow: hidden;
      touch-action: none; /* custom pinch/pan gestures */
      background: var(--ha-card-background, var(--card-background-color, #111));
    }
    /* A deliberate navigation change gets one short visual settle. The class
       is transient, so normal day/night breathing keeps its slow cadence. */
    .stage.hpnav,
    .stage.daynight.hpnav {
      transition:
        background-color 0.18s ease,
        outline-color 0.18s ease;
    }
    .zoomwrap {
      position: absolute;
      inset: 0;
    }
    /* Sun on the plan (docs/SUN.md): the stage breathes with the day over tens
       of seconds; the plan itself dims at most ~10%. Reduced motion = static. */
    .stage.daynight {
      transition: background-color 45s linear;
    }
    .stage.daynight .zoomwrap {
      transition: filter 45s linear;
    }
    .stage.daynight.hpsettle {
      transition: height 0.25s ease, background-color 45s linear;
    }
    /* Catch-up frame (docs/SUN.md): the sky is out of date because the card
       was not painting — show the truth at once, the glide comes back on the
       very next frame. */
    .stage.daynight.skysnap,
    .stage.daynight.skysnap .zoomwrap,
    .stage.daynight.skysnap.hpsettle {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .stage.daynight,
      .stage.daynight .zoomwrap,
      .stage.daynight.hpsettle {
        transition: none;
      }
    }
    .sunlayer {
      pointer-events: none;
    }
    /* the compass dial in the general settings (docs/SUN.md) */
    .sunrow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      margin: var(--sp-3) 0;
    }
    .suncol {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      min-width: 0;
    }
    .compass {
      width: 120px;
      height: 120px;
      flex: none;
      touch-action: none;
      cursor: grab;
      user-select: none;
    }
    .compass:active {
      cursor: grabbing;
    }
    .compass .cring {
      fill: rgba(255, 255, 255, 0.04);
      stroke: var(--divider-color, #444);
      stroke-width: 2;
    }
    .compass .ctick {
      stroke: var(--secondary-text-color, #9aa4ad);
      stroke-width: 2;
    }
    .compass .ctick.minor {
      stroke-width: 1;
      opacity: 0.6;
    }
    .compass .cneedle line {
      stroke: var(--primary-color, #3ea6ff);
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .compass .cneedle path {
      fill: var(--primary-color, #3ea6ff);
    }
    .compass .cneedle text {
      fill: var(--text-primary-color, #fff);
      font-size: 11px;
      font-weight: 700;
    }
    .compass .cdeg {
      fill: var(--secondary-text-color, #9aa4ad);
      font-size: 13px;
    }
    .compass.unset .cneedle {
      opacity: 0.35;
    }
    /* HP-1552: first-open boot veil — the plan hides until the stage height settles */
    .stage.hpboot .zoomwrap,
    .stage.hpboot .zoombadge {
      visibility: hidden;
    }
    /* A long-suspended normal View wakes through transient HA/viewport
       geometry. Keep those few frames behind the already-correct stage
       background; the final viewport and reveal are committed together.
       This class is never set in kiosk or an editor. */
    .stage.hpresume .zoomwrap,
    .stage.hpresume .zoombadge,
    .stage.hpresume .farhint,
    .stage.hpresume .homearrow {
      visibility: hidden;
    }
    /* AUD-1552-02: post-veil grace — HA chrome landing after the cap moves
       the stage height smoothly; the viewport ResizeObserver refits the plan
       along the transition, so a late panel glides instead of jumping. */
    .stage.hpsettle {
      transition: height 0.25s ease;
    }
    .bootveil {
      position: absolute;
      inset: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--hp-bg, #16212e);
      opacity: 1;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }
    .bootveil.off {
      opacity: 0;
    }
    .bootveil .boothouse {
      position: static; /* .stage svg pins itself to inset:0 — not this one */
      width: 56px;
      height: 56px;
      fill: var(--hp-accent);
      opacity: 0.85;
      animation: hp-boot-pulse 1.3s ease-in-out infinite;
    }
    @keyframes hp-boot-pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.94); }
      50% { opacity: 0.9; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .bootveil .boothouse {
        animation: none;
        opacity: 0.7;
      }
      .stage.hpsettle {
        transition: none;
      }
    }
    .zoomctl {
      display: inline-flex;
      gap: var(--sp-1);
      background: rgba(127, 127, 127, 0.12);
      border-radius: var(--rad-m);
      padding: var(--sp-1);
    }
    .zoomctl .zb {
      border: none;
      padding: var(--sp-3) var(--sp-4);
    }
    .zoomctl .zb[disabled] {
      opacity: 0.4;
      pointer-events: none;
    }
    /* docs/CANVAS.md §4.1: objects an order of magnitude away from the plan
       do not decide the opening view — one quiet chip says so and offers to
       take them in. Never a modal (owner). */
    .farhint {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: var(--sp-4);
      z-index: 12;
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      max-width: calc(100% - var(--sp-8));
      background: var(--card-background-color, var(--hp-bg));
      opacity: 0.94;
      color: var(--hp-txt);
      border: 1px solid var(--divider-color, #33404d);
      border-radius: var(--rad-m);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--fs-s);
    }
    .farhint ha-icon {
      --mdc-icon-size: 18px;
      color: var(--hp-warn, #e2a03f);
      flex: none;
    }
    .farhint span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* docs/CANVAS.md §5: the plane has no edges, so you can pan until nothing
       is on screen. One pointer home, one click back. */
    .homearrow {
      position: absolute;
      z-index: 12;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: var(--card-background-color, var(--hp-bg));
      color: var(--hp-accent);
      border: 1px solid var(--hp-accent);
      opacity: 0.9;
      padding: 0;
    }
    .homearrow ha-icon {
      --mdc-icon-size: 22px;
      line-height: 1;
    }
    .zoombadge {
      position: absolute;
      left: var(--sp-4);
      bottom: var(--sp-4);
      background: var(--card-background-color, var(--hp-bg));
      opacity: 0.92;
      color: var(--hp-txt);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-m);
      padding: var(--sp-1) var(--sp-4);
      font-size: var(--fs-s);
      font-weight: 600;
      pointer-events: none;
    }
    .stage svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    /* Opaque plan paper (owner 2026-08-03): the scene bg_color / daynight sky
       shows ONLY around the plan, never through it. The colour is the
       pre-bg_color canvas — the theme card background under an image plan,
       plain white for a hand-drawn one (.stage.noplan). On drawn plans the
       paper is per-room shapes following the room contours — fill only,
       never a stroke, so the paper cannot poke past a wall. Night dimming
       comes from the .zoomwrap brightness filter, never from alpha
       (docs/SUN.md). */
    .hp-paper {
      fill: var(--ha-card-background, var(--card-background-color, #111));
      stroke: none;
    }
    .stage.noplan .hp-paper,
    .stage.mode-plan .hp-paper,
    .stage.mode-devices .hp-paper,
    .stage.mode-decor .hp-paper {
      fill: #ffffff;
    }
    /* White day (owner 2026-08-03): at high sun the daynight sky is #ffffff —
       the same white as a drawn plan's paper. A whisper of a drop shadow on
       the paper GROUP keeps the sheet's contour readable on the white sky
       (user units on the 1000-unit canvas ≈ a few screen px). Invisible at
       night against the dark sky; 'static' mode never gets it. */
    .stage.daynight .hp-paperg {
      filter: drop-shadow(0 2px 8px rgba(10, 16, 26, 0.28));
    }
    /* Owner 2026-08-04: «углы границ комнат всё ещё с зубцами». A miter join
       on a 30-45° corner shoots a spike far past the wall (and flips to an
       ugly bevel once past the miter limit) — the same defect the decor lines
       had before they got round caps. Every room border, in EVERY renderer
       that reuses these styles (plan view, plan editor, static space-card),
       joins its walls with a ROUND join instead: the corner reads as the
       stroke's own radius, never as a tooth. The linecap matters only for the
       open outlines below, but it costs nothing to state it here. */
    .room {
      transition: 0.12s;
      cursor: default; /* v1.40.1: rooms are not clickable — the label's link icon is */
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .room.overlay {
      fill: transparent;
      stroke: transparent;
      stroke-width: 2;
    }
    .stage.mode-view .room.overlay:not(.styled):hover {
      fill: var(--hp-accent);
      fill-opacity: 0.18;
      stroke: var(--hp-accent);
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: 2;
    }
    .stage.mode-view .room.yard:not(.styled):hover {
      fill: var(--hp-accent);
      fill-opacity: 0.2;
      stroke: var(--hp-accent);
    }
    .room.styled {
      stroke: var(--room-stroke, transparent);
      stroke-opacity: var(--room-stroke-op, 0);
      stroke-width: 2.5;
      fill: var(--room-fill, transparent);
      fill-opacity: var(--room-fill-op, 0);
    }
    /* View hover: brighten the current fill; accent wash when unfilled. */
    .stage.mode-view .room.styled.filled:hover {
      filter: brightness(1.2) saturate(1.08) drop-shadow(0 0 4px var(--hp-accent));
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    .stage.mode-view .room.styled:not(.filled):hover {
      fill: var(--hp-accent);
      fill-opacity: 0.18;
      stroke-opacity: 1;
    }
    /* doors & windows */
    .op-leaf {
      transition: transform 0.6s ease;
    }
    .op-arc {
      stroke-width: 1.5;
      transition: stroke-dashoffset 0.6s ease;
    }
    /* hover affordance: a rounded outline hugging the wall strip + a grab cursor */
    .op-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    .stage.markup g.opening:hover .op-outline {
      opacity: 0.9;
    }
    /* openings are pure status graphics outside Plan mode: no cursor, no hover,
       no hit target — View must not interact with them at all */
    .op-hit {
      fill: transparent;
      pointer-events: none;
      cursor: default;
    }
    .stage.markup .op-hit {
      pointer-events: auto;
      cursor: grab;
      touch-action: none; /* drags, not scrolls, on touch */
    }
    .stage.markup .op-hit:active {
      cursor: grabbing;
    }
    /* HP-1550-04: in the resize tool the wall handles own the hit test — the
       transparent .op-hit of a door at the midpoint of a wall used to sit ON
       TOP of the handle and made that wall ungrabbable for both rooms.
       Openings are not editable in this tool (they ride along with the wall),
       so their hit area goes fully inert; every other Plan tool is untouched. */
    .stage.markup.tool-resize .op-hit {
      pointer-events: none;
      cursor: default;
    }
    .oplock {
      pointer-events: none; /* inert while editing; clickable in View (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      width: calc(var(--icon-size, 2.5cqw) * 0.62);
      height: calc(var(--icon-size, 2.5cqw) * 0.62);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      z-index: 1;
    }
    .stage.mode-view .oplock {
      pointer-events: auto;
      cursor: pointer;
    }
    .oplock ha-icon {
      --mdc-icon-size: calc(var(--icon-size, 2.5cqw) * 0.4);
      display: flex;
      line-height: 0;
    }
    .oplock.locked { color: #66d17a; border-color: #66d17a; }
    .oplock.unlocked { color: var(--hp-open); border-color: var(--hp-open); }
    .oplock.unknown { color: var(--hp-muted); }
    .btn.lockact {
      width: 100%;
      justify-content: center;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-top: var(--sp-4);
    }
    .btn.lockact.warn {
      color: var(--error-color, #d33);
      border-color: var(--error-color, #d33);
    }
    .oprow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) 0;
    }
    .oprow b { margin-left: auto; }
    .oprow.ok b { color: #66d17a; }
    .oprow.warn b { color: var(--hp-open); }
    @media (prefers-reduced-motion: reduce) {
      .op-leaf, .op-arc { transition: none; }
    }
    /* Semantic activity: event / presence / transition / actual running all
       share one ring layer and one colour/size override. */
    .dev ha-icon {
      position: relative;
      z-index: 1;
    }
    .activity-ring {
      position: absolute;
      left: 50%;
      top: 50%;
      width: calc(var(--dev-size) * var(--ripple-scale, 3));
      height: calc(var(--dev-size) * var(--ripple-scale, 3));
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    .activity-ring i {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--ripple-color, var(--hp-accent));
      opacity: 0;
    }
    /* A witnessed edge: exactly three waves over the 3.3 s runtime window. */
    .activity-ring.event i {
      animation: hp-activity-event 1.1s ease-out 1 forwards;
    }
    .activity-ring.event i:nth-child(2) { animation-delay: 1.1s; }
    .activity-ring.event i:nth-child(3) { animation-delay: 2.2s; }
    .activity-ring.event.gen2 i { animation-name: hp-activity-event-b; }
    /* Presence is a state, not an event: calm and deliberately static. */
    .activity-ring.presence i:first-child { opacity: 0.4; }
    .activity-ring.presence i:nth-child(n + 2),
    .activity-ring.transition i:nth-child(n + 2),
    .activity-ring.running i:nth-child(n + 2) { display: none; }
    /* Physical travel and actual work use related but distinct tempos. */
    .activity-ring.transition i:first-child {
      animation: hp-activity-breathe 2.2s ease-in-out infinite;
    }
    .activity-ring.running i:first-child {
      animation: hp-activity-running 2.8s ease-in-out infinite;
    }
    @keyframes hp-activity-event {
      0% { transform: scale(0.18); opacity: 0.7; }
      70% { opacity: 0.22; }
      100% { transform: scale(1); opacity: 0; }
    }
    /* Alternate identity: a rapid retrigger restarts the browser timeline. */
    @keyframes hp-activity-event-b {
      0% { transform: scale(0.18); opacity: 0.7; }
      70% { opacity: 0.22; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes hp-activity-breathe {
      0% { transform: scale(0.92); opacity: 0.16; }
      50% { transform: scale(1.04); opacity: 0.5; }
      100% { transform: scale(0.92); opacity: 0.16; }
    }
    @keyframes hp-activity-running {
      0% { transform: scale(0.94); opacity: 0.18; }
      50% { transform: scale(1.02); opacity: 0.42; }
      100% { transform: scale(0.94); opacity: 0.18; }
    }
    @media (prefers-reduced-motion: reduce) {
      .activity-ring i { animation: none !important; }
      .activity-ring i:first-child { opacity: 0.4; }
      .activity-ring i:nth-child(n + 2) { display: none; }
    }
    .roomlabel {
      pointer-events: none; /* draggable only in plan mode (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.5 * var(--rl-scale, 1) * var(--rl-font, 1) * var(--rl-space, 1));
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15em;
      text-align: center;
    }
    .rlname {
      display: inline-flex;
      align-items: center;
      gap: 0.25em;
      font-size: calc(1em * var(--rl-name, 1));
    }
    /* Space changes keep their direction, but travel only a few percent: the
       motion explains what changed without making the whole plan fly around. */
    @keyframes hp-slide-left {
      0%   { transform: translateX(4%); opacity: 0.72; }
      100% { transform: translateX(0);   opacity: 1; }
    }
    @keyframes hp-slide-right {
      0%   { transform: translateX(-4%); opacity: 0.72; }
      100% { transform: translateX(0);    opacity: 1; }
    }
    @keyframes hp-editor-enter {
      0%   { transform: translateY(5px) scale(0.997); opacity: 0.72; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes hp-editor-exit {
      0%   { transform: translateY(-4px) scale(1.002); opacity: 0.72; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes hp-editor-swap {
      0%   { transform: scale(0.997); opacity: 0.68; }
      100% { transform: scale(1); opacity: 1; }
    }
    .zoomwrap.slide-left  { animation: hp-slide-left 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .zoomwrap.slide-right { animation: hp-slide-right 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .zoomwrap.nav-enter   { animation: hp-editor-enter 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .zoomwrap.nav-exit    { animation: hp-editor-exit 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .zoomwrap.nav-swap    { animation: hp-editor-swap 0.16s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .stage.hpnav,
      .stage.daynight.hpnav { transition: none; }
      .zoomwrap.slide-left,
      .zoomwrap.slide-right,
      .zoomwrap.nav-enter,
      .zoomwrap.nav-exit,
      .zoomwrap.nav-swap { animation: none; }
    }
    /* The name is the anchor: the label box is centred on the room point, so
       anything that takes part in its layout SHIFTS THE NAME. The gear button
       and the metrics hang below as absolutes — the name renders in exactly
       the same place in view mode and in the plan editor (owner's request),
       and the button sits at the very bottom of the card. */
    /* Standalone, centred on the room, sized from the device icon: icon-size
       already rescales with the view, so the button zooms WITH the plan
       instead of keeping a constant screen size (owner's spec). */
    .rlgearbtn {
      --gear-h: calc(var(--icon-size, 2.5cqw) * 0.77); /* owner: half the previous size */
      position: absolute;
      /* dead-centred on the room, both axes (owner's spec) */
      transform: translate(-50%, -50%);
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      height: var(--gear-h);
      padding: 0 calc(var(--gear-h) * 0.38);
      border: 0;
      border-radius: 999px;
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font: inherit;
      font-size: calc(var(--gear-h) * 0.42);
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      pointer-events: auto;
      opacity: 0.92;
      box-shadow: var(--shadow-1);
      z-index: 2;
    }
    .rlgearbtn { transition: opacity 0.15s, filter 0.15s; }
    .rlgearbtn:hover { opacity: 1; filter: brightness(1.18); }
    .rlgearbtn ha-icon { --mdc-icon-size: calc(var(--gear-h) * 0.55); display: inline-flex; }
    .rlgear {
      --mdc-icon-size: 0.9em;
      display: inline-flex;
      margin-right: 0.2em;
      opacity: 0.6;
      cursor: pointer;
      pointer-events: auto;
    }
    .rlgear:hover { opacity: 1; }
    .rlgo {
      --mdc-icon-size: 0.85em;
      display: inline-flex;
      opacity: 0.55;
    }
    .stage.mode-view .rlgo {
      pointer-events: auto;
      cursor: pointer;
    }
    .stage.mode-view .rlgo:hover { opacity: 1; }
    .roomlabel .rlmetrics {
      position: absolute; /* below the name, outside the centring math */
      top: calc(100% + 0.15em);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 0.55em;
      font-size: calc(0.75em * var(--rl-meta, 1)); /* feedback: 0.62 was unreadable on a tablet */
      font-weight: 600;
      letter-spacing: 0.02em;
      opacity: 0.9;
    }
    .roomlabel .rlm {
      display: inline-flex;
      align-items: center;
      gap: 0.12em;
    }
    .roomlabel .rlm ha-icon {
      --mdc-icon-size: 1.05em;
      display: inline-flex;
    }
    .roomlabel .rlm.lit { opacity: 1; }
    .bindharow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      flex-wrap: wrap;
    }
    .bindharow .entcheck { opacity: 0.9; }
    .dropbtn {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      width: 100%;
      text-align: left;
      border: 1px solid var(--hp-muted);
      border-radius: var(--rad-m);
      background: transparent;
      color: var(--hp-txt);
      padding: var(--sp-4) 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--fs-m);
      margin-top: var(--sp-3);
    }
    .dropbtn .ref { color: var(--hp-muted); font-size: var(--fs-s); margin-left: auto; }
    .dropbtn ha-icon { --mdc-icon-size: 18px; margin-left: var(--sp-2); }
    .dropbtn.open { border-color: var(--hp-accent); }
    .droppanel {
      border: 1px solid var(--hp-accent);
      border-top: none;
      border-radius: 0 0 var(--rad-m) var(--rad-m);
      padding: var(--sp-3);
      margin-top: -4px;
    }
    .ctrlchips { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin: var(--sp-2) 0; }
    .ctrlchip {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      background: var(--hp-accent); color: var(--text-primary-color, #fff);
      border-radius: var(--rad-l); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-s);
    }
    .ctrlchip ha-icon { --mdc-icon-size: 14px; cursor: pointer; }
    .ctrllist { display: flex; flex-direction: column; gap: var(--sp-1); margin-top: var(--sp-2); }
    .ctrlopt {
      display: flex; align-items: center; gap: var(--sp-4); text-align: left;
      border: 0; background: transparent; color: var(--hp-txt);
      padding: var(--sp-3) var(--sp-4); border-radius: var(--rad-s); cursor: pointer; font-family: inherit; font-size: var(--fs-m);
    }
    .ctrlopt:hover { background: var(--secondary-background-color, rgba(128,128,128,0.15)); }
    .ctrlopt .sub { color: var(--hp-muted); font-size: var(--fs-s); margin-left: auto; }
    .ctrlopt ha-icon { --mdc-icon-size: 16px; }
    .ctrlstates { display: flex; flex-direction: column; gap: var(--sp-2); }
    .ctrlstate { display: inline-flex; align-items: center; gap: var(--sp-3); color: var(--hp-muted); }
    .ctrlstate.on { color: var(--hp-txt); }
    .ctrlstate ha-icon { --mdc-icon-size: 15px; }
    .cardpreview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      margin: var(--sp-4) 0 var(--sp-1);
      padding: 10px;
      border: 1px dashed var(--hp-muted);
      border-radius: var(--rad-m);
    }
    .cardpreview .cpname { font-weight: 700; letter-spacing: 0.04em; }
    .cardpreview .cpmeta {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      font-weight: 600;
      opacity: 0.85;
    }
    .cardpreview .cpmeta ha-icon { --mdc-icon-size: 1.05em; }
    .iconauto {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--fs-s);
      margin: var(--sp-2) 0 0;
    }
    .iconauto ha-icon { --mdc-icon-size: 18px; }
    .iconauto span { flex: 1; }
    .iconauto .btn { min-height: 32px; padding: 0 var(--sp-3); }
    .rlhandle {
      display: none;
      position: absolute;
      width: 9px;
      height: 9px;
      border-radius: 2px;
      background: var(--hp-accent);
      border: 1px solid var(--card-background-color, #fff);
      z-index: 2;
    }
    .rlhandle.tl { left: -6px; top: -6px; cursor: nwse-resize; }
    .rlhandle.br { right: -6px; bottom: -6px; cursor: nwse-resize; }
    .rlhandle.tr { right: -6px; top: -6px; cursor: nesw-resize; }
    .rlhandle.bl { left: -6px; bottom: -6px; cursor: nesw-resize; }
    .stage.markup .roomlabel:hover .rlhandle { display: block; }
    .stage.markup .roomlabel { pointer-events: auto; }
    .roomlabel:active { cursor: grabbing; }
    .measurelayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .alignline {
      stroke: var(--hp-accent);
      stroke-width: 1.2;
      stroke-dasharray: 4 4;
      pointer-events: none;
      opacity: 0.9;
    }
    .aligndot {
      fill: var(--hp-accent);
      pointer-events: none;
    }
    .measurelabel.on45 {
      color: #4bd28f;
      border-color: #4bd28f;
    }
    .hdr.kioskhide { display: none; }
    .kioskdots {
      position: absolute;
      left: 50%;
      bottom: var(--sp-5);
      transform: translateX(-50%);
      display: flex;
      gap: var(--sp-4);
      z-index: 5;
      pointer-events: none;
    }
    .kdot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--hp-muted);
      opacity: 0.55;
    }
    .kdot.on { background: var(--hp-accent); opacity: 1; }
    .measurelabel {
      position: absolute;
      transform: translate(12px, -150%);
      font-size: var(--fs-s);
      font-weight: 600;
      padding: 1px var(--sp-3);
      border-radius: var(--rad-s);
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      z-index: 3;
    }
    /* decor (background) layer */
    .decorlayer .dshape { pointer-events: none; }
    .stage.mode-decor .decorlayer .dshape {
      pointer-events: visiblePainted;
      cursor: pointer;
    }
    .stage.mode-decor.dtool-select .decorlayer .dshape { cursor: move; }
    /* …but a DRAWING tool owns the canvas: existing shapes stop being targets
       entirely, so a new line can start exactly on the end of an old one
       instead of grabbing it (owner, 2026-08-04). Same for the picture tool —
       a shape lying over the plan must not block the picture's own drag.
       Only select (move) and erase (delete) keep the shapes clickable. */
    .stage.mode-decor.dtool-line .decorlayer .dshape,
    .stage.mode-decor.dtool-rect .decorlayer .dshape,
    .stage.mode-decor.dtool-ellipse .decorlayer .dshape,
    .stage.mode-decor.dtool-text .decorlayer .dshape,
    .stage.mode-decor.dtool-furniture .decorlayer .dshape,
    .stage.mode-decor.dtool-backdrop .decorlayer .dshape { pointer-events: none; }
    /* the furniture tool is a stamp: the press must reach the stage even when
       it lands on a sofa that is already there (docs/FURNITURE.md §4) */
    .stage.mode-decor.dtool-furniture { cursor: copy; }
    /* ONE exception (owner, 2026-08-04): under the TEXT tool an existing LABEL
       is a target again — pressing it opens its editor instead of starting a
       new label on top of the old one. Only labels: a line or a rectangle
       under the text tool stays inert, so the press reaches the stage and a
       new label is created there. */
    .stage.mode-decor.dtool-text .decorlayer .dshape.dtext,
    .stage.mode-decor.dtool-select .decorlayer .dshape.dtext,
    .stage.mode-decor.dtool-erase .decorlayer .dshape.dtext {
      /* A label is one logical decor object. SVG's visiblePainted would hit
         only the ink of individual glyphs, so spaces, counters and the area
         inside its selection glow behaved like empty canvas. */
      pointer-events: bounding-box;
    }
    .stage.mode-decor.dtool-text .decorlayer .dshape.dtext {
      cursor: text;
    }
    .decorlayer .dsel {
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .decorlayer .ddraft {
      stroke-dasharray: 6 5;
      pointer-events: none;
    }
    .decorlayer text {
      font-weight: 600;
      user-select: none;
      dominant-baseline: middle;
      text-anchor: middle;
    }
    .stage.mode-decor {
      outline: 2px solid #26a69a;
      outline-offset: -2px;
    }
    /* backdrop transform frame (docs/BACKDROP.md §2). Editor chrome: the
       outline never takes a pointer, the four corner handles do — and they are
       finger-sized (r = 2 % of the visible view), because this is dragged on a
       tablet as often as with a mouse. */
    .bdframe .bdbox {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 2;
      stroke-dasharray: 10 7;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.9;
    }
    /* the HIT circle: invisible, finger-sized, the only thing that takes a
       pointer. The visible bead is .bdknob, a quarter of its radius — the same
       visual/hit split .dthandle + .dtknob and .rszhandle + .rszicon use. */
    .bdframe .bdhandle {
      fill: transparent;
      stroke: none;
      pointer-events: all;
      touch-action: none;
    }
    .bdframe .bdknob {
      fill: var(--hp-accent);
      stroke: #fff;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .bdframe .bdhandle:hover + .bdknob { fill: #fff; stroke: var(--hp-accent); }
    .bdframe .bd-nwse { cursor: nwse-resize; }
    .bdframe .bd-nesw { cursor: nesw-resize; }
    /* the picture itself is the drag target for a move (grab, then grabbing) */
    .stage.mode-decor.bdgrab { cursor: grab; }
    .stage.mode-decor.bdgrabbing,
    .stage.mode-decor.bdgrabbing .bdframe .bdhandle { cursor: grabbing; }
    .measurelabel.bdmeasure {
      transform: translate(-50%, -50%);
      border: 1px solid var(--hp-accent);
    }
    /* the selected decor object's frame — same chrome rules as the backdrop's:
       the outline never takes a pointer, the handles always do, and they are
       finger-sized because this is dragged on a tablet too */
    .dtframe .dtbox {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      stroke-dasharray: 7 5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.85;
    }
    .dtframe .dtstem,
    .bdframe .dtstem {
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.85;
    }
    /* the HIT circle: invisible, finger-sized, the only thing that takes a
       pointer. The visible bead is .dtknob, a quarter of its radius — the
       same visual/hit split .rszhandle + .rszicon use. */
    .dtframe .dthandle {
      fill: transparent;
      stroke: none;
      pointer-events: all;
      touch-action: none;
    }
    .dtframe .dtknob {
      fill: var(--hp-accent);
      stroke: #fff;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .dtframe .dthandle:hover + .dtknob { fill: #fff; stroke: var(--hp-accent); }
    .dtframe .dt-nwse { cursor: nwse-resize; }
    .dtframe .dt-nesw { cursor: nesw-resize; }
    .dtframe .dtrot { cursor: grab; }
    .dtframe .dtendpoint { cursor: crosshair; }
    .bdframe .dtrot { cursor: grab; }
    .dtarea {
      resize: vertical;
      min-height: 3.4em;
      font: inherit;
      line-height: 1.35;
    }
    .stage.mode-decor.dtool-line, .stage.mode-decor.dtool-rect,
    .stage.mode-decor.dtool-ellipse, .stage.mode-decor.dtool-text {
      cursor: crosshair;
    }
    .stage.mode-decor.dtool-erase,
    .stage.mode-decor.dtool-erase .decorlayer .dshape {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg transform='rotate(-45 12 12)'%3E%3Crect x='7' y='2' width='10' height='18' rx='2' fill='%23fff' stroke='%23111' stroke-width='1.5'/%3E%3Cpath d='M7 13h10v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z' fill='%23ff9f43' stroke='%23111' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E") 5 22, pointer;
    }
    .stage.mode-decor .room, .stage.mode-decor .devlayer { pointer-events: none; }
    .stage.mode-decor .oplock { pointer-events: none; }
    /* decor mode: everything but the decor itself fades back */
    .stage.mode-decor .room,
    .stage.mode-decor .devlayer,
    .stage.mode-decor .opening,
    .stage.mode-decor .rlabel {
      opacity: 0.35;
    }
    .decorbar .dcolor {
      width: 30px; height: 26px; padding: 0; border: none; background: none; cursor: pointer;
    }
    .decorbar .dwidth {
      font-family: inherit; font-size: var(--fs-s); border-radius: var(--rad-s);
      background: var(--hp-bg2, transparent); color: var(--hp-txt); border: 1px solid var(--hp-muted);
      padding: var(--sp-2) var(--sp-3);
    }
    .decorbar .bdhint {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .decorbar .dfill {
      display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-s); cursor: pointer;
    }
    .decorbar .dfill input[type="checkbox"] {
      width: 16px;
      height: 16px;
      flex: none;
      margin: 0;
      padding: 0;
    }
    .decorbar hp-color-opacity { flex: 0 0 auto; }
    hp-dialog .dfill {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      cursor: pointer;
    }
    .opghost {
      stroke: var(--hp-open, #ff9800);
      stroke-width: 5;
      stroke-linecap: round;
      stroke-dasharray: 7 6;
      opacity: 0.85;
      pointer-events: none;
    }
    .opghost-dot {
      fill: var(--hp-open, #ff9800);
      opacity: 0.85;
      pointer-events: none;
    }
    .rlabel {
      fill: var(--hp-muted);
      font-size: 15px;
      font-weight: 600;
      pointer-events: none;
      text-anchor: middle;
    }
    .stage.edit .room {
      pointer-events: none;
    }
    .stage.markup {
      cursor: crosshair;
    }
    /* room-picking stages: merge (both clicks) and split before a room is chosen */
    .stage.markup.tool-merge,
    .stage.markup.tool-split.pickstage,
    .stage.markup.tool-delroom {
      cursor: pointer;
    }
    /* open-wall tool: default until a shared wall is under the cursor */

    .stage.markup.tool-wallthick { cursor: default; }
    .stage.markup.tool-wallthick.wallhot { cursor: pointer; }
    /* Solid wall colour sits under the hatch (owner: both, not either/or). */
    .wallbody-fill {
      fill: var(--wall-fill, #ffffff);
      fill-opacity: var(--wall-fill-op, 1);
      fill-rule: evenodd;
      stroke: none;
      pointer-events: none;
    }
    .wallbody {
      fill: url(#hp-wall-hatch);
      fill-rule: evenodd;
      stroke: var(--room-stroke, var(--hp-muted));
      stroke-width: 0.6;
      pointer-events: none;
    }
    /* Thin-on-screen: hatch collapses into noise — fill alone, stroke from fill path's sibling. */
    .wallbody.solid {
      fill: none;
    }
    .wallthick-hover {
      fill: var(--accent-color, #03a9f4);
      fill-opacity: 0.38;
      stroke: var(--accent-color, #03a9f4);
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .wallthick-dlg {
      position: absolute;
      z-index: 40;
      min-width: 200px;
      transform: translate(-50%, 8px);
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--card-background-color, #fff);
      box-shadow: 0 8px 28px rgba(0,0,0,.22);
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: auto;
    }
    .wallthick-hover.isopen {
      fill: var(--error-color, #f44336);
      stroke: var(--error-color, #f44336);
    }
    .wallthick-dlg .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .wallthick-dlg input[type="number"] {
      width: 5.5em;
      padding: 4px 6px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 6px;
      background: var(--input-fill, transparent);
      color: var(--primary-text-color);
    }
    .stage.markup.tool-openwall { cursor: crosshair; }
    .stage.markup.tool-openwall.wallhot { cursor: crosshair; }
    .stage.markup.tool-closewall { cursor: default; }
    .stage.markup.tool-closewall.wallhot { cursor: pointer; }
    .openwall {
      stroke: var(--ow-stroke, var(--hp-muted));
      stroke-width: 2.5;
      stroke-dasharray: 7 7;
      stroke-linecap: butt;
      pointer-events: none;
      opacity: 0.9;
    }
    /* Rooms with open/thick stretches: the polygon's own stroke is fully off.
       The trimmed .room-outline draws normal walls; View hover gets its own
       top overlay after the wall bodies. */
    .room.noedge {
      stroke-opacity: 0 !important;
    }
    /* rooms with open boundaries draw their walls as separate M..L subpaths,
       so a corner between two of them is two stroke ENDS meeting: round caps
       fill it in the same way a round join fills a closed contour's corner
       (owner 2026-08-04 — no teeth anywhere on a room border). */
    .room-outline {
      fill: none;
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    /* Plan editor: trimmed outlines use the markup blue */
    .room-outline.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      stroke-opacity: 1;
    }
    /* View hover follows the clean-floor face above the unioned wall body. The
       original room stroke remains responsible for fill and thin-wall fallback. */
    .room-hover-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 3;
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .openwalls.hot .openwall {
      stroke: #ffc14d;
      opacity: 1;
    }
    .openwall-preview {
      stroke: #ffc14d;
      stroke-width: 5;
      stroke-dasharray: 7 7;
      stroke-linecap: round;
      pointer-events: none;
      opacity: 0.95;
    }
    /* an already-open boundary under the cursor: the click will CLOSE it */
    .openwall-preview.willclose {
      stroke: #f25a4a;
      stroke-dasharray: none;
    }
    .stage.markup .room {
      pointer-events: none;
    }
    .stage.markup .devlayer .dev {
      display: none; /* in plan mode the icons do not get in the way; labels stay */
    }
    /* mode frames: the edit modes are visible at a glance */
    .stage.mode-plan {
      outline: 2px solid #ffc14d;
      outline-offset: -2px;
    }
    .stage.mode-devices {
      outline: 2px solid var(--hp-accent);
      outline-offset: -2px;
    }
    .modes {
      display: inline-flex;
      gap: var(--sp-1);
      background: rgba(127, 127, 127, 0.12);
      border-radius: var(--rad-l);
      padding: var(--sp-2);
    }
    .modetab {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      padding: var(--sp-3) 10px; /* 10px h-padding kept: +2px would wrap the header modes row */
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background-color 0.14s ease, color 0.14s ease, transform 0.14s ease;
    }
    .modetab:active { transform: scale(0.97); }
    .modetab ha-icon { --mdc-icon-size: 15px; }
    .modetab .closex {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: 2px;
      opacity: 0.75;
      cursor: pointer;
      border-radius: var(--rad-s);
    }
    .modetab .closex:hover { opacity: 1; }
    .editbar .barclose {
      padding: var(--sp-2) var(--sp-3);
      margin-left: var(--sp-3);
    }
    .modetab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    @media (max-width: 720px) {
      .modetab .ml { display: none; }
    }
    .room.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      fill: rgba(62, 166, 255, 0.06);
    }
    /* AFTER .outlined: same specificity — source order decides (gotcha x4) */
    .room.picked {
      stroke: #ffc14d;
      stroke-width: 3;
      fill: rgba(255, 193, 77, 0.25);
    }
    /* Owner 2026-08-04: the grid is a HINT, not content — at full strength the
       dots argued with the plan on white paper. Both levels are muted, the
       hierarchy is kept (major still denser than fine). */
    .griddot {
      fill: var(--hp-accent);
      opacity: 0.35;
      stroke: rgba(0, 0, 0, 0.35);
      stroke-width: 0.4;
    }
    /* docs/CANVAS.md §7: every coarse node (5x/10x the live step) keeps a
       bigger, more opaque dot, so zoomed far out the grid still reads as a
       grid instead of a grey wash. */
    .griddot.major {
      opacity: 0.5;
      stroke-width: 0;
    }
    /* the contour being drawn in the Plan editor: each wall is its own <line>,
       so the round cap IS the corner (matches the finished .room border) */
    .seg {
      stroke: var(--hp-accent);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pathline {
      stroke: #ffc14d;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .preview {
      stroke: #ffc14d;
      stroke-width: 2;
      stroke-dasharray: 6 5;
      opacity: 0.7;
    }
    .drawwall-preview-fill {
      fill: var(--wall-fill, #ffffff);
      fill-opacity: calc(var(--wall-fill-op, 1) * 0.55);
      fill-rule: evenodd;
      stroke: none;
      pointer-events: none;
    }
    .drawwall-preview {
      fill: url(#hp-wall-hatch);
      fill-opacity: 0.55;
      fill-rule: evenodd;
      stroke: var(--accent-color, #03a9f4);
      stroke-width: 0.5;
      stroke-opacity: 0.7;
      pointer-events: none;
    }
    .vertex {
      fill: #ffc14d;
      stroke: #4a2800;
      stroke-width: 1;
    }
    .vertex.first {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .areasel,
    .namein {
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
      font-family: inherit;
    }
    .namein {
      width: 130px;
    }
    .dev.valonly {
      /* all satellite metrics from --dev-size, not --icon-size: the per-device
         size multiplier must scale the value plate with its marker — same bug
         class as the v1.51.3 glyph fix (pinned to base size, the multiplier
         grew nothing). */
      width: auto;
      min-width: var(--dev-size, var(--icon-size, 2.5cqw));
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.16);
    }
    .dev.valonly .valtext {
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
      font-weight: 700;
      white-space: nowrap;
    }
    /* RGB lights: the bulb takes the light's actual color */
    /* v1.52.0: the RGB tint of the icon/border is gone — a lamp's colour
       lives ONLY in its glow spot (owner's rule). The ripple-color fallback
       keeps using the light colour; that is set inline via --ripple-color. */
    /* Sun wedges (docs/SUN.md). The layer is present ONLY above the 3°
       threshold; crossing it fades the whole layer in or out over EXACTLY
       2 s (owner 2026-08-03 — RAY_FADE_MS in src/sun.ts must match). The
       geometry is untouched: this is a plain opacity animation on the group,
       so overlapping wedges keep their own blending while it plays. */
    .sunlayer {
      animation: hp-sunfade-in 2s linear both;
    }
    .sunlayer.out {
      animation: hp-sunfade-out 2s linear both;
    }
    @keyframes hp-sunfade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes hp-sunfade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      /* no fade at all: the rays are simply there or simply gone */
      .sunlayer, .sunlayer.out { animation: none; }
      .sunlayer.out { opacity: 0; }
    }
    /* alarms pulse red over everything */
    .dev.alarm,
    .dev.alarm:hover {
      background: #6f2325;
      border-color: #f25a4a;
      color: #fff;
      box-shadow: 0 0 10px rgba(242, 90, 74, 0.65);
    }
    .dev.alarm::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 3px solid #f25a4a;
      border-radius: 50%;
      animation: hp-alarm 1s ease-out infinite;
      pointer-events: none;
    }
    @keyframes hp-alarm {
      0% { transform: scale(0.7); opacity: 1; }
      100% { transform: scale(1.25); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dev.alarm::after { animation: none; opacity: 0.9; }
    }
    .dev .newdot {
      position: absolute;
      top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.12);
      right: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.12);
      width: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.34);
      height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.34);
      border-radius: 50%;
      background: #f0301f;
      border: 2px solid var(--card-background-color, var(--hp-bg));
      pointer-events: none;
      z-index: 2;
    }
    .devlayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .dev {
      position: absolute;
      /* per-device multiplier on top of the card-wide icon size */
      --dev-size: calc(var(--icon-size, 2.5cqw) * var(--dev-scale, 1));
      /* центр квадрата (включая рамку 1px) точно на точке привязки: -(size/2 + border) */
      width: var(--dev-size);
      height: var(--dev-size);
      margin: calc(var(--dev-size) / -2 - 1px) 0 0 calc(var(--dev-size) / -2 - 1px);
      border-radius: 22%;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--hp-txt);
      cursor: pointer;
      pointer-events: auto;
      transition: background 0.15s, border-color 0.15s, opacity 0.2s;
      box-shadow: var(--shadow-1);
      z-index: 2;
    }
    .dev ha-icon {
      /* from --dev-size, NOT --icon-size: the per-device size multiplier must
         scale the GLYPH with its badge. Pinned to the base size, "make this
         icon bigger" grew an empty box around a default-size glyph (user
         report via the owner, 2026-07-29). */
      --mdc-icon-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.62);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .stage.mode-devices .dev { cursor: grab; }
    .stage.mode-devices .dev:active { cursor: grabbing; }
    .dev:hover {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      z-index: 5;
    }
    .dev.on {
      background: var(--hp-on);
      border-color: var(--hp-on);
      color: #503c00;
      box-shadow: 0 0 8px rgba(255, 212, 92, 0.7);
    }
    .dev.open {
      background: var(--hp-open);
      border-color: var(--hp-open);
      color: #4a2800;
    }
    .dev.unavail {
      opacity: 0.35;
    }
    .dev.virtual {
      border-style: dashed;
    }
    /* "hide from plan" flag, shown only in the device editor with the
       "show hidden devices" toggle on (docs/FILTERING.md). BLUE, so a hidden
       device cannot be mistaken for an unavailable one (translucent dark) —
       and no live-state paint at all: a ghost is configuration, not status
       (owner's request). */
    .dev.ghost {
      opacity: 0.6;
      border-style: dashed;
      border-color: var(--hp-accent);
      background: rgba(62, 166, 255, 0.22); /* fallback for old WebViews */
      background: color-mix(in srgb, var(--hp-accent) 30%, var(--card-background-color, #1c2530));
      color: var(--hp-accent);
      box-shadow: none;
    }
    .dev.sel {
      border-color: #ffc14d;
      box-shadow: 0 0 0 3px rgba(255, 193, 77, 0.35);
    }

    .dev .tval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.1);
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid var(--hp-accent);
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.18);
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.14);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
      font-weight: 700;
      line-height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.68);
      color: var(--hp-txt);
      white-space: nowrap;
      pointer-events: none;
    }
.dev .hval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.1);
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid #4fc3f7;
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.18);
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.14);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
      font-weight: 700;
      line-height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.68);
      color: var(--hp-txt);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .lqi {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.05);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.38);
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
      pointer-events: none;
    }
    .editbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: var(--sp-4) var(--sp-5);
      border-bottom: 1px solid var(--hp-line);
      font-size: var(--fs-m);
      flex-wrap: wrap;
    }
    .tab .tabedit {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: var(--sp-3);
      opacity: 0.4;
    }
    .tab:hover .tabedit {
      opacity: 0.9;
    }
    .tab.tabadd {
      padding: var(--sp-3) var(--sp-4);
    }
    .tab.tabadd ha-icon {
      --mdc-icon-size: 15px;
    }
    .srcrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      font-size: var(--fs-m);
      cursor: pointer;
      padding: var(--sp-1) 0;
    }
    .dispsection {
      margin-top: var(--sp-5) !important;
      padding-top: var(--sp-4);
      border-top: 1px solid var(--hp-line);
      font-weight: 600;
      color: var(--hp-txt) !important;
    }
    .colorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .colorrow input[type='color'] {
      width: 42px;
      height: 28px;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: transparent;
      padding: 1px;
      cursor: pointer;
    }
    .colorrow input[type='range'] { flex: 1; }
    .colorrow .tempin { width: 70px; flex: none; }
    .temprange {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      margin-left: auto;
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    /* beat the generic hp-dialog .body .namein { width:100% } rule */
    hp-dialog .body .temprange .tempin { width: 56px; flex: none; padding: var(--sp-2) var(--sp-3); }
    hp-dialog .body .colorrow .tempin { width: 72px; flex: none; }
    .srcrow { flex-wrap: nowrap; }
    /* native HA controls (rendered only when the HA frontend defines them;
       old HA and the smoke env keep the plain inputs). ha-switch is taller
       than a checkbox - cap its footprint so .srcrow keeps its rhythm. */
    .srcrow ha-switch { flex: none; }
    .colorrow ha-slider { flex: 1; min-width: 0; }
    .srcrow > span:first-of-type { white-space: nowrap; }
    .colorrow .opl { color: var(--hp-muted); font-size: var(--fs-s); }
    .colorrow .opv { font-size: var(--fs-s); min-width: 34px; text-align: right; }
    .planrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    /* the "already uploaded" picker: a plan is never deleted for being
       unreferenced, so it has to be findable again */
    .savedplans {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      max-height: 240px;
      overflow: auto;
      margin: var(--sp-3) 0 var(--sp-1);
      padding: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: var(--hp-bg2, rgba(255, 255, 255, 0.03));
      /* The same collapse that ate .candlist (v1.53.1): a scroll box is a
         flex item whose automatic minimum size is ZERO (overflow != visible),
         so inside hp-dialog .body — a flex column taller than its 66vh cap —
         it shrank to a 14px sliver: the rows were in the DOM, the owner saw
         a thin rounded stripe under the "Already uploaded" button. Don't
         shrink, and keep a floor even when the box is empty or loading. */
      flex: 0 0 auto;
      min-height: 2.6em;
    }
    .savedplan {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .savedplan.cur { outline: 1px solid var(--hp-accent); border-radius: var(--rad-s); }
    .savedplan img {
      width: 56px;
      height: 40px;
      object-fit: contain;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: #fff;
      flex: none;
    }
    .savedmeta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .savedmeta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .savedmeta .muted { font-size: var(--fs-s); }
    .savedplan .btn.danger ha-icon { color: #f25a4a; }
    .savedplan .btn[disabled] { opacity: 0.4; pointer-events: none; }
    .planprev {
      max-width: 120px;
      max-height: 70px;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: #fff;
    }
    .planname {
      font-size: var(--fs-m);
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .planname.muted {
      color: var(--hp-muted);
    }
    .filebtn {
      cursor: pointer;
    }
    .btn.danger {
      border-color: #b3402a;
      color: #ff7a5c;
    }
    hp-dialog .row .spacer {
      flex: 1;
    }
    hp-dialog .body {
      max-height: 66vh;
      overflow-y: auto;
    }
    .descin {
      width: 100%;
      box-sizing: border-box;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
      font-family: inherit;
      resize: vertical;
      /* flex column of the dialog body squeezes textareas — keep a usable height */
      min-height: 92px;
      flex-shrink: 0;
      line-height: 1.35;
    }
    .bindsel {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      padding: var(--sp-4);
    }
    .bindsel .opt {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      cursor: pointer;
      font-size: var(--fs-m);
      font-family: inherit;
    }
    .bindsel .opt.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .curbind {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--fs-m);
      color: var(--hp-txt);
      flex-wrap: wrap;
    }
    .curbind .ref {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    /* live vacuum: a round puck, no badge plate, soft pulse (docs/VACUUM.md) */
    .vacpuck {
      position: absolute;
      /* the base badge, but round and 20% smaller — the owner's wording:
         «иконка похожа на иконку базы, только круглая и чуть меньше» */
      --puck-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.8);
      width: var(--puck-size);
      height: var(--puck-size);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      box-shadow: var(--shadow-1);
      color: var(--hp-txt);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 6;
      /* glide between sparse position updates; .jump disables it so the robot
         never appears to drive through walls after a data gap */
      transition: left 1.2s linear, top 1.2s linear;
      animation: vacpulse 2.2s ease-out infinite;
    }
    .vacpuck.jump { transition: none; }
    .vacpuck.stale { opacity: 0.45; animation: none; }
    .vacpuck ha-icon {
      --mdc-icon-size: calc(var(--puck-size) * 0.68);
      color: var(--hp-txt);
      /* same centering recipe as .dev ha-icon: without flex + line-height 0
         the glyph sits on its text baseline and appears to float around the
         circle (owner report 2026-07-31) */
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      width: var(--mdc-icon-size);
      height: var(--mdc-icon-size);
    }
    @keyframes vacpulse {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--hp-accent) 45%, transparent); }
      70% { box-shadow: 0 0 0 12px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      .vacpuck { animation: none; }
    }
    .vactrail {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
      overflow: visible;
    }
    .vactrail polyline {
      fill: none;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    /* dark halo + light core: neutral, and one of the two always contrasts
       with whatever fill is underneath */
    .vactrail g.prev { opacity: 0.4; }
    .vactrail .case {
      stroke: rgba(0, 0, 0, 0.4);
      stroke-width: 2.25;
    }
    .vactrail .core {
      stroke: rgba(255, 255, 255, 0.82);
      stroke-width: 0.9;
    }
    .vacbox .vacbtns { display: flex; gap: var(--sp-4); margin: var(--sp-3) 0; flex-wrap: wrap; }
    .vacfit {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 12;
      overflow: visible;
      touch-action: none;
      cursor: grab;
      /* the devlayer is pointer-events: none and every child opts back in —
         without this line real clicks flew straight through the overlay
         (owner: «уголки не кликабельны»; synthetic smoke events bypass
         hit-testing, which is why they lied) */
      pointer-events: auto;
    }
    .vacfit:active { cursor: grabbing; }
    .vacfit polygon {
      fill: color-mix(in srgb, var(--hp-accent) 16%, transparent);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 6 4;
    }
    .vacfit text {
      fill: var(--hp-accent);
      font-size: 26px;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
      user-select: none;
    }
    /* room resize tool (docs/RESIZE.md) */
    /* wall handle: invisible finger-sized hit circle (HP-1550-04 hit priority
       kept), the visible glyph lives in the sibling .rszicon */
    .rszhandle {
      fill: transparent;
      stroke: none;
      pointer-events: all;
      cursor: grab;
      touch-action: none;
    }
    .rszhandle:active { cursor: grabbing; }
    /* wall-with-arrows glyph: accent ink over a bg halo, readable on any plan */
    .rszicon { pointer-events: none; }
    .rszicon path {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .rszhalo { stroke: var(--hp-bg); stroke-width: 6; }
    .rszink { stroke: var(--hp-accent); stroke-width: 2; }
    .rszhandle:hover + .rszicon .rszink { stroke-width: 3; }
    /* corner (scale-frame) handles: hit circle invisible, .rszknob is the bead */
    .rszcorner {
      fill: transparent;
      stroke: none;
      cursor: nwse-resize;
    }
    .rszknob {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .rszcorner:hover + .rszknob { fill: var(--hp-accent); }
    .rszcorner:active { cursor: nwse-resize; }
    .rszframe {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    /* the decor draft badge rides the MIDDLE of the shape, so it is centred
       horizontally and lifted clear of the line instead of trailing the
       cursor the way a wall badge does (owner 2026-08-04) */
    .measurelabel.dmeasure {
      transform: translate(-50%, -160%);
    }
    .measurelabel.rszarea {
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.6);
    }
    /* width and depth of a piece of furniture while its corner is dragged —
       centred on the edge they measure (docs/FURNITURE.md §6) */
    .measurelabel.furnmeasure {
      transform: translate(-50%, -50%);
      border: 1px solid var(--hp-accent);
    }
    /* ---- the furniture palette (docs/FURNITURE.md §3) ------------------- */
    .furnpalette {
      display: flex;
      flex-direction: column;
      max-height: 38vh;
      border-top: 1px solid var(--hp-border, rgba(255, 255, 255, 0.12));
      background: var(--card-background-color, var(--hp-bg));
      font-size: 0.85em;
    }
    .furnhd {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-weight: 600;
      opacity: 0.9;
    }
    .furnhd .spacer { flex: 1; }
    .furnbody {
      overflow: auto;
      padding: 0 8px 6px;
    }
    .furngroup {
      margin: 6px 0 3px;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
    }
    .furnrow {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .furnitem {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 74px;
      padding: 4px 2px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: rgba(127, 127, 127, 0.08);
      color: inherit;
      font: inherit;
      font-size: 0.8em;
      line-height: 1.15;
      text-align: center;
      cursor: pointer;
    }
    .furnitem:hover { background: rgba(127, 127, 127, 0.18); }
    .furnitem.on {
      border-color: var(--hp-accent);
      background: rgba(38, 166, 154, 0.18);
    }
    .furnprev {
      width: 40px;
      height: 40px;
      color: var(--primary-text-color, currentColor);
    }
    .furnsize {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
      border-top: 1px solid var(--hp-border, rgba(255, 255, 255, 0.12));
    }
    .furnsize label {
      display: flex;
      align-items: baseline;
      gap: 3px;
      opacity: 0.8;
    }
    .furnsize .furnunit { opacity: 0.6; font-size: 0.85em; }
    .furnsize input {
      width: 5.5em;
      padding: 3px 5px;
    }
    .furnhint { opacity: 0.6; }
    .vacfitdot { fill: var(--hp-accent); pointer-events: none; }
    /* hit target: invisible and finger-sized; .vacfitknob is the visible bead */
    .vacfithandle {
      fill: transparent;
      stroke: none;
      cursor: nwse-resize;
    }
    .vacfitknob {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .vaccalbar {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      display: flex;
      gap: var(--sp-5);
      align-items: center;
      background: var(--hp-bg);
      color: var(--hp-txt);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      padding: 10px var(--sp-5);
      z-index: 60;
      box-shadow: var(--shadow-2);
    }
    .candlist {
      max-height: 160px;
      overflow-y: auto;
      border-top: 1px solid var(--hp-line);
      /* A scrollable box is a flex item that HAPPILY collapses: inside the
         dialog body (a flex column) this list rendered its rows into a 1px
         sliver — the DOM had 26 candidates and the user saw nothing. In the
         binding dropdown it sits inside .droppanel (block context) and never
         showed the bug. Field report, 2026-07-30. */
      flex: 0 0 auto;
      min-height: 2.6em;
    }
    .cand {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      cursor: pointer;
      border-radius: var(--rad-s);
      font-size: var(--fs-m);
    }
    .cand:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .cand.sel {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .cand .cs {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      white-space: nowrap;
    }
    .cand.sel .cs {
      color: var(--text-primary-color, #fff);
      opacity: 0.85;
    }
    .cand.muted {
      color: var(--hp-muted);
      cursor: default;
    }
    .pdfedit {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      align-items: center;
    }
    .pdftag {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-2) var(--sp-3);
      font-size: var(--fs-s);
    }
    .pdftag a {
      color: var(--hp-txt);
      text-decoration: none;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pdftag .x {
      --mdc-icon-size: 15px;
      cursor: pointer;
      color: var(--hp-muted);
    }
    .pdftag .x:hover {
      color: #ff7a5c;
    }
    .entlist {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-bottom: 10px;
    }
    .entrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--rad-m);
      background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
    }
    .entrow ha-icon { --mdc-icon-size: 20px; color: var(--hp-muted); }
    .entrow.on ha-icon { color: var(--hp-accent); }
    .entrow .en { flex: 1; font-size: var(--fs-m); }
    .entrow .ev { font-size: var(--fs-m); color: var(--hp-muted); }
    .entbtn {
      min-width: 74px;
      min-height: 32px;
      padding: var(--sp-2) var(--sp-5);
      border: 1px solid var(--hp-muted);
      border-radius: 999px;
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      font-size: var(--fs-m);
      cursor: pointer;
    }
    .entbtn.on {
      background: var(--hp-accent);
      border-color: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font-weight: 600;
    }
    .inforow {
      display: flex;
      gap: 10px;
      font-size: var(--fs-m);
      margin: var(--sp-2) 0;
    }
    .inforow .k {
      color: var(--hp-muted);
      min-width: 84px;
    }
    .inforow a {
      color: var(--hp-accent);
      word-break: break-all;
    }
    .infodesc {
      font-size: var(--fs-m);
      white-space: pre-wrap;
      margin-top: var(--sp-3);
    }
    .infodesc.muted {
      color: var(--hp-muted);
    }
    .pdflist {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .pdf {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      color: var(--hp-accent);
      text-decoration: none;
    }
    ha-icon-picker {
      display: block;
    }
    .floorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-2);
      font-size: var(--fs-m);
      cursor: pointer;
    }
    .floorrow .floorlvl {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: 0 var(--sp-3);
    }
    .rhint {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-bottom: var(--sp-3);
    }
    .rtest {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .rtest .namein { flex: 1; }
    .rtest ha-icon { color: var(--hp-accent); }
    .rtesticon { font-size: var(--fs-s); color: var(--hp-muted); }
    .rrow {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin: var(--sp-1) 0;
    }
    .rrow .rpat { flex: 2; }
    .rrow .ricon { flex: 1.4; }
    .rrow .rpat.bad { border-color: #ff7a5c; }
    .rrow .rprev { --mdc-icon-size: 18px; color: var(--hp-txt); min-width: 18px; }
    .rrow .ract {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
      cursor: pointer;
    }
    .rrow .ract:hover { color: var(--hp-txt); }
    .rrow .ract.del:hover { color: #ff7a5c; }

    .gsrow .gsl {
      min-width: 150px;
      font-size: var(--fs-m);
      color: var(--hp-muted);
    }
    .alignmsg { margin: 0 0 8px; font-size: 13px; line-height: 1.45; }
    .btn.alignall { width: 100%; justify-content: center; }
    .aboutver {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin: var(--sp-2) 0 var(--sp-3);
    }
    .aboutlink {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      width: fit-content;
      color: var(--hp-accent);
      text-decoration: none;
      font-size: var(--fs-m);
      padding: var(--sp-1) 0;
    }
    .aboutlink:hover { text-decoration: underline; }
    .aboutlink ha-icon { --mdc-icon-size: 18px; line-height: 1; }
    hp-dialog .body {
      padding: var(--sp-5) var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    hp-dialog .body label {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-top: var(--sp-3);
    }
    hp-dialog .body .namein,
    hp-dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    /* Room settings contains long radio labels, two source pickers and live
       previews, so it deliberately uses hp-dialog's medium width. Keep its
       content shrinkable as well: the generic srcrow rule is nowrap because
       compact switch rows need it, but here that created a horizontal scroll
       box even on a wide desktop viewport. */
    hp-dialog.roomdialog .body {
      min-width: 0;
      overflow-x: hidden;
    }
    hp-dialog.roomdialog .body > * {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    hp-dialog.roomdialog .srcrow {
      min-width: 0;
      align-items: flex-start;
    }
    hp-dialog.roomdialog .srcrow > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.35;
    }
    hp-dialog.roomdialog .dropbtn > b,
    hp-dialog.roomdialog .dropbtn > .ref {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    hp-dialog .row {
      display: flex;
      justify-content: flex-end;
      gap: var(--sp-4);
      padding: var(--sp-5) var(--sp-6);
      border-top: 1px solid var(--hp-line);
    }
    hp-dialog .row.markerfooter {
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    hp-dialog .row.roomfooter {
      align-items: center;
      flex-wrap: wrap;
    }
    /* Keep the last editor bar mounted while the row collapses. This makes
       both entering and leaving an editor change the card geometry gradually;
       the header ResizeObserver keeps the stage fitted throughout. */
    .editorchrome {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      visibility: hidden;
      overflow: hidden;
      transition:
        grid-template-rows 0.18s cubic-bezier(0.2, 0.7, 0.2, 1),
        opacity 0.12s ease,
        visibility 0s linear 0.18s;
    }
    .editorchrome.open {
      grid-template-rows: 1fr;
      opacity: 1;
      visibility: visible;
      overflow: visible;
      transition-delay: 0s;
    }
    .editorchrome.open.nav-enter {
      overflow: hidden;
    }
    .editorchrome-inner {
      min-height: 0;
    }
    .editorchrome-inner.nav-enter { animation: hp-editor-enter 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .editorchrome-inner.nav-exit  { animation: hp-editor-exit 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .editorchrome-inner.nav-swap  { animation: hp-editor-swap 0.16s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .modetab { transition: none; }
      .editorchrome { transition: none; }
      .editorchrome-inner.nav-enter,
      .editorchrome-inner.nav-exit,
      .editorchrome-inner.nav-swap { animation: none; }
    }
    /* Device info can have Edit + Open in HA + Close. A small HA dialog is
       narrower than those three Russian-labelled actions; without wrapping,
       HA's end-aligned footer pushed the first button outside the surface. */
    hp-dialog .row.infofooter {
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-3);
    }
    hp-dialog .row.infofooter .btn {
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      hp-dialog .row.infofooter {
        padding: var(--sp-4) var(--sp-5);
      }
    }
    .markeractions,
    .markersaveactions {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .markeractions:empty { display: none; }
    .markersaveactions { margin-left: auto; }
    .editbar .warn {
      color: #ffc14d;
    }
    .editbar .sname {
      font-weight: 600;
    }
    .editbar input {
      width: 74px;
      background: transparent;
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
    }
    .editbar label,
    .editbar .hint {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .editbar .drawwall {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      white-space: nowrap;
    }
    .editbar .wallsgroup {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
    }
    .editbar .drawwall input {
      width: 4.2em;
    }
    .editbar .drawwall .opl {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .menuwrap {
      position: fixed;
      inset: 0;
      z-index: 80;
    }
    .menu {
      position: fixed;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      box-shadow: var(--shadow-2);
      min-width: 210px;
      max-width: 300px;
      overflow: hidden;
      transform: translate(0, 8px);
    }
    .menu .hd {
      padding: var(--sp-4) var(--sp-5);
      font-weight: 600;
      font-size: var(--fs-m);
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: var(--sp-3);
    }
    .menu .hd ha-icon,
    .menu .it.all ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 16px;
    }
    .menu .it {
      padding: var(--sp-4) var(--sp-5);
      font-size: var(--fs-m);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .menu .it ha-icon {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
    }
    .menu .it:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .menu .it.all {
      color: var(--hp-accent);
      font-weight: 600;
    }
    .tip {
      position: fixed;
      pointer-events: none;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: var(--sp-3) 10px;
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      box-shadow: var(--shadow-2);
      z-index: 99;
      max-width: 260px;
    }
    .tip .m {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      display: block;
    }
    .toast {
      position: fixed;
      pointer-events: none;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: var(--sp-4) var(--sp-6);
      border-radius: var(--rad-l);
      font-size: var(--fs-m);
      box-shadow: var(--shadow-2);
      z-index: 120;
      max-width: 90vw;
    }
  `;function ta(t){const e=eo(t.cfg),i=e.find(e=>e.id===t.spaceId);if(!i)return null;const s=$i(t.cfg.spaces.find(e=>e.id===t.spaceId)),o=t.iconSize??2.5,n=o>8?2.5:o,r={};for(const e of t.cfg.spaces||[])for(const t of e.rooms||[])t.area&&(r[t.area]=e.id);const a=t.cfg.settings?.exclude_integrations?new Set(t.cfg.settings.exclude_integrations):_t,l=gt(t.cfg.settings?.icon_rules?.length?t.cfg.settings.icon_rules:mt),c=jr({hass:t.hass,areaToSpace:r,markers:t.cfg.markers||[],settings:t.cfg.settings||{},excluded:a,showAll:!!t.cfg.settings?.show_all,firstSpaceId:e[0]?.id||"",loc:e=>Zr(t.lang,e),iconRules:l}),h=c.filter(e=>e.space===t.spaceId),d=h.filter(t=>!t.hidden),p=function(t,e,i){const s={},o=i/100*xo(e)*1.3;for(const i of e.rooms){if(!i.area)continue;const e=t.filter(t=>t.area===i.area);if(!e.length)continue;const n=Mo(i),r=.1*Math.min(n.w,n.h),a=n.w-2*r,l=n.h-2*r,c=Math.max(1,Math.round(Math.sqrt(e.length*a/Math.max(l,1)))),h=a/c,d=l/Math.max(Math.ceil(e.length/c),1),p=e.map((t,e)=>({x:n.x+r+h*(e%c+.5),y:n.y+r+d*(Math.floor(e/c)+.5)}));ei(p,n,o,.5*r),e.forEach((t,e)=>s[t.id]=lo(p[e]))}return s}(h,i,n),u=[];for(const e of d){const i=t.layout[e.id];if(i&&i.s===t.spaceId){const t=i.x*Ys,e=i.y*Ys;u.push({minX:t,minY:e,maxX:t,maxY:e})}}const _=wo(i,u),m=[_.x,_.y,_.w,_.h],g=i.rooms.filter(t=>t.area||s.showBorders||"light"===Gi(s.fill,t)).map(e=>{let o="room "+(i.bg?"overlay":"yard"),n="";const r=Gi(s.fill,e);if(s.showBorders||"none"!==r){o+=" styled";const i=[`--room-stroke:${s.color}`,`--room-stroke-op:${s.showBorders?s.opacity:0}`],a="light"===r?Ti("light",null,Nr(Ar(t.hass,h,e)),null,s.tempMin,s.tempMax,Di(t.cfg?.settings)):e.area?Ti(r,"lqi"===r?function(t,e,i){const s=[];for(const o of e){if(o.area!==i||o.virtual)continue;const e=Er(t,o.entities);null!=e&&s.push(e)}return Qe(s)}(t.hass,h,e.area):null,"none","temp"===r?function(t,e,i){const s=[];for(const o of e){if(o.area!==i)continue;if("mdi:thermometer"!==o.icon&&"mdi:air-filter"!==o.icon)continue;const e=Or(t,o.entities);null!=e&&s.push(e)}return s.length?Math.round(s.reduce((t,e)=>t+e,0)/s.length*10)/10:null}(t.hass,h,e.area):null,s.tempMin,s.tempMax,Di(t.cfg?.settings)):null;a?(o+=" filled",i.push(`--room-fill:${a.c}`,`--room-fill-op:${a.a.toFixed(3)}`)):i.push("--room-fill:transparent","--room-fill-op:0"),n=i.join(";")}const a=!i.bg&&!s.showNames,l=Co(e),c=e.id||V,d=e.area||V,p=e.poly?B`<polygon class="${o}" style="${n}" data-hp="room" data-id=${c} data-area=${d}
            points="${e.poly.map(t=>t.join(",")).join(" ")}"></polygon>`:B`<rect class="${o}" style="${n}" data-hp="room" data-id=${c} data-area=${d}
            x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${.03*Math.min(e.w,e.h)}"></rect>`;return B`${p}${a?B`<text class="rlabel" data-hp="room-label" data-id=${c} data-area=${d}
        x="${l[0]}" y="${l[1]}">${e.name}</text>`:V}`}),f=d.map(e=>{const s=function(t,e,i,s,o){const n=e[t.id];return n&&n.s===t.space?{x:n.x*Ys,y:n.y*Ys}:s[t.id]?s[t.id]:lo(ko(o))}(e,t.layout,t.cfg,p,i),o=(s.x-m[0])/m[2]*100,n=(s.y-m[1])/m[3]*100,r=Number(e.marker?.size)>0?Number(e.marker.size):1,a=Number(e.marker?.angle)||0,l=[`left:${o}%`,`top:${n}%`];return 1!==r&&l.push(`--dev-scale:${r}`),W`<div class="dev ${e.virtual?"virtual":""}"
      data-hp="device" data-id="${e.id}" data-entity=${e.primary||V} data-area=${e.area||V}
      style="${l.join(";")}">
      <ha-icon icon="${e.icon}" style=${a?`transform:rotate(${a}deg)`:V}></ha-icon>
    </div>`}),v=s.showNames?i.rooms.filter(t=>t.name).map(e=>{const o=function(t,e,i){const s=i["rl_"+(t.id||"")];if(s&&s.s===e)return{x:s.x*Ys,y:s.y*Ys};const o=Co(t);return lo({x:o[0],y:o[1]})}(e,i.id,t.layout,t.cfg),n=(o.x-m[0])/m[2]*100,r=(o.y-m[1])/m[3]*100,a=Math.min(1,s.opacity+.25);return W`<div class="roomlabel"
            data-hp="room-label" data-id=${e.id||V} data-area=${e.area||V}
            style="left:${n}%;top:${r}%;color:${s.color};opacity:${a}">${e.name}</div>`}):[],b=i.bg?t.displayUrl?t.displayUrl(i.bg.href):i.bg.href:"",y=t.cfg.spaces.find(e=>e.id===t.spaceId)?.settings||{};let w="";if("daynight"===As(t.cfg?.settings,y)&&null!==Rs(t.cfg?.settings,y)){const e=Os(t.hass);e&&(w=xs(e.elevation).bg)}const k=w||Si(t.cfg?.settings,s),x=t.cfg.spaces.find(e=>e.id===t.spaceId)||{},$=Array.isArray(x.walls)?x.walls:[],S=Number(x.cell_cm)>0?Number(x.cell_cm):5,M=$.length?zn(i.rooms,$,[],ro,S,no,Ys):Te(i.rooms),C=Di(t.cfg.settings),D=$.length&&s.showBorders?Cn(i.rooms,$,[],[],ro,S,no,Ys):null,z=t.stageWidth&&m[2]?t.stageWidth/m[2]:1,T=!!D&&qo(D.depthUnits,z),P=s.color||"#607d8b";return W`
    <div class="hp-static-stage" style="aspect-ratio:${m[2]}/${m[3]}${k?";background:"+k:""};--wall-fill:${C.wall_fill.c};--wall-fill-op:${C.wall_fill.a}">
      <svg viewBox="${m[0]} ${m[1]} ${m[2]} ${m[3]}" preserveAspectRatio="xMidYMid meet">
        ${D?B`<defs>
          <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse" width="8" height="8"
            patternTransform="rotate(45)">
            <path d="M0 0 L0 8" stroke="${P}" stroke-width="2"></path>
          </pattern>
        </defs>`:V}
        ${M.map(t=>"poly"in t?B`<polygon class="hp-paper" points="${t.poly}"></polygon>`:B`<rect class="hp-paper" x="${t.rect.x}" y="${t.rect.y}" width="${t.rect.w}" height="${t.rect.h}" rx="${t.rect.rx}"></rect>`)}
        ${b?B`<image href="${b}" x="${i.bg.x}" y="${i.bg.y}" width="${i.bg.w}" height="${i.bg.h}"
              transform=${i.bg.angle?`rotate(${i.bg.angle} ${i.bg.x+i.bg.w/2} ${i.bg.y+i.bg.h/2})`:V}
              preserveAspectRatio="none" />`:V}
        ${g}
        ${D?B`<g class="wallbodies" style="--room-stroke:${P}">
              <path class="wallbody-fill" d="${D.d}"
                fill="${C.wall_fill.c}" fill-opacity="${C.wall_fill.a}" fill-rule="evenodd"
                stroke="none" pointer-events="none"></path>
              <path class="wallbody ${T?"solid":""}" data-hp="wall" data-id="union" data-kind="union"
                d="${D.d}" fill="${T?"none":"url(#hp-wall-hatch)"}" fill-rule="evenodd"
                stroke="${P}" stroke-width="0.6" pointer-events="none"></path>
            </g>`:V}
      </svg>
      ${""}
      <div class="devlayer" style="--icon-size:${$o(n,i,m[2]).toFixed(3)}cqw">${f}${v}</div>
    </div>
  `}let ea=null,ia=null,sa=!1;const oa=new Set;function na(){if(ea)return ea;try{const t=JSON.parse(localStorage.getItem("houseplan_card_cfg_v1")||"null");if(t&&t.config&&Array.isArray(t.config.spaces))return{config:t.config,rev:t.rev||0,layout:t.layout||{}}}catch{}return null}function ra(t){return ea?Promise.resolve(ea):ia||(ia=async function(t){const[e,i]=await Promise.all([t.callWS({type:"houseplan/config/get"}),t.callWS({type:"houseplan/layout/get"})]);if(ea={config:e?.config??null,rev:e?.rev??0,layout:i?.layout??{}},!sa&&t.connection?.subscribeEvents){sa=!0;const e=()=>{ea=null,oa.forEach(t=>t())};try{await t.connection.subscribeEvents(e,"houseplan_config_updated"),await t.connection.subscribeEvents(e,"houseplan_layout_updated")}catch{sa=!1}}return ea}(t).finally(()=>{ia=null}),ia)}class aa extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return Jr(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[];return[t.length?{name:"space",selector:{select:{mode:"dropdown",options:t}}}:{name:"space",selector:{text:{}}},{name:"title",selector:{text:{}}},{name:"show_button",selector:{boolean:{}}},{name:"button_label",selector:{text:{}}},{name:"button_target",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}}]}render(){if(!this.hass||!this._config)return V;this._loadSpaces();const t=this._lang,e={space:Zr(t,"editor.space"),title:Zr(t,"editor.title"),show_button:Zr(t,"editor.show_button"),button_label:Zr(t,"editor.button_label"),button_target:Zr(t,"editor.button_target"),icon_size:Zr(t,"editor.icon_size")};return W`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config||{},...t.detail.value};delete e.aspect_ratio;const i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}aa.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-space-card-editor")||customElements.define("houseplan-space-card-editor",aa);const la=t=>{history.pushState(null,"",t),((t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)})(window,"location-changed",{replace:!1})};class ca extends lt{constructor(){super(...arguments),this._snap=null,this._loading=!1,this._stageWidth=0,this._loadedOnce=!1,this._signer=new Kn(()=>this.requestUpdate()),this._goToSpace=()=>{const t=(this._config?.button_target||"/plan-doma").replace(/#.*$/,"");la(`${t}#space=${encodeURIComponent(this._config.space)}`)}}static getConfigElement(){return document.createElement("houseplan-space-card-editor")}static getStubConfig(t){const e=na();return{type:"custom:houseplan-space-card",space:eo(e?.config||null)[0]?.id||"",show_button:!0}}setConfig(t){if(!t||!t.space)throw new Error('houseplan-space-card: "space" is required');this._config={show_button:!0,button_target:"/plan-doma",...t},this._snap=this._snap||na()}connectedCallback(){var t;super.connectedCallback(),this._unsub=(t=()=>{this._loading=!1,this._snap=null,this.requestUpdate()},oa.add(t),()=>oa.delete(t)),this._signer.start(()=>this.hass,()=>this._referenced())}disconnectedCallback(){this._unsub?.(),this._unsub=void 0,this._stageObserver?.disconnect(),this._stageObserver=void 0,this._observedStage=void 0,this._signer.dispose(),super.disconnectedCallback()}willUpdate(t){!this.hass||this._loading||this._snap&&!t.has("hass")||this._snap&&this._loadedOnce||this._load()}updated(){const t=this.renderRoot.querySelector(".hp-static-stage")||void 0;if(t===this._observedStage)return;if(this._stageObserver?.disconnect(),this._observedStage=t,!t)return void(this._stageObserver=void 0);const e=()=>{const e=t.clientWidth;e>0&&Math.abs(e-this._stageWidth)>.5&&(this._stageWidth=e,this.requestUpdate())};this._stageObserver=new ResizeObserver(e),this._stageObserver.observe(t),e()}async _load(){if(this.hass&&!this._loading){this._loading=!0;try{const t=await ra(this.hass);this._snap=t,this._loadedOnce=!0}catch{}finally{this._loading=!1,this.requestUpdate()}}}get _lang(){return Jr(this.hass,this._config?.language)}getCardSize(){const t=eo(this._snap?.config||null).find(t=>t.id===this._config?.space);if(t){const e=t.vb[3]/t.vb[2];return Math.max(3,Math.round(8*e))+(!1===this._config?.show_button?0:1)}return 6}_errorCard(t){return W`<ha-card><div class="hp-static-error">${t}</div></ha-card>`}_referenced(){return ji(this._snap?.config)}render(){if(!this._config)return V;const t=this._snap?.config;if(!t)return W`<ha-card><div class="hp-static-error">${Zr(this._lang,"space_card.loading")}</div></ha-card>`;const e=this._config.space,i=ta({hass:this.hass,cfg:t,layout:this._snap?.layout||{},spaceId:e,iconSize:this._config.icon_size,stageWidth:this._stageWidth,lang:this._lang,displayUrl:t=>this._signer.display(this.hass,t)});if(!i)return this._errorCard(Zr(this._lang,"space_card.not_found",{id:e}));const s=eo(t).find(t=>t.id===e),o=void 0!==this._config.title?this._config.title:s?.title||"",n=!1!==this._config.show_button,r=this._config.button_label||Zr(this._lang,"space_card.button");return W`
      <ha-card>
        ${o?W`<div class="hp-static-title">${o}</div>`:V}
        ${i}
        ${n?W`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${r}</button>
            </div>`:V}
      </ha-card>
    `}}ca.properties={hass:{attribute:!1},_config:{state:!0},_snap:{state:!0}},ca.styles=[Qr,n`
      .hp-static-title {
        font-weight: 700;
        padding: 10px 14px 6px;
        font-size: 16px;
        color: var(--primary-text-color);
      }
      .hp-static-stage {
        position: relative;
        width: 100%;
        container-type: inline-size;
        overflow: hidden;
        pointer-events: none; /* kill ALL interaction on the schematic (§4) */
        background: var(--ha-card-background, var(--card-background-color, #111));
      }
      .hp-static-stage svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
      /* Opaque plan paper — the scene bg_color/daynight sky shows only AROUND
         the plan (owner 2026-08-03). The static card keeps its historical
         canvas colour: the theme card background. Drawn plans paper the room
         contours (per-room shapes, fill only, no stroke) — same contract as
         the full card. */
      .hp-paper {
        fill: var(--ha-card-background, var(--card-background-color, #111));
        stroke: none;
      }
      .wallbody-fill {
        fill: var(--wall-fill, #ffffff);
        fill-opacity: var(--wall-fill-op, 1);
        fill-rule: evenodd;
        stroke: none;
        pointer-events: none;
      }
      .wallbody {
        fill: url(#hp-wall-hatch);
        fill-rule: evenodd;
        stroke: var(--room-stroke, var(--hp-muted, #607d8b));
        stroke-width: 0.6;
        pointer-events: none;
      }
      .wallbody.solid {
        fill: none;
      }
      .hp-static-stage .devlayer {
        position: absolute;
        inset: 0;
      }
      .hp-static-foot {
        padding: 8px 12px 12px;
        pointer-events: auto; /* the button stays clickable */
      }
      .hp-static-btn {
        width: 100%;
        padding: 9px 14px;
        border: none;
        border-radius: 10px;
        background: var(--primary-color, #3ea6ff);
        color: var(--text-primary-color, #fff);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .hp-static-btn:hover {
        filter: brightness(1.08);
      }
      .hp-static-error {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color, #9aa4ad);
      }
    `],customElements.get("houseplan-space-card")||customElements.define("houseplan-space-card",ca),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-space-card"===t.type)||window.customCards.push({type:"houseplan-space-card",name:"House Plan — Space (static)",description:"Read-only static schematic of a single houseplan space, with a deep-link button.",preview:!1,documentation:"https://github.com/Matysh/houseplan-card"});const ha=4.166666666666667e-9;function da(t){if(!Number.isFinite(t))return t;const e=Math.round(t/ro)*ro;return Math.abs(e-t)<=ha?t:e}const pa=(t,e,i,s)=>Math.hypot(i-t,s-e),ua=(t,e,i,s,o,n,r,a)=>Math.hypot(Math.max(Math.abs(o-t),Math.abs(o+r-(t+i))),Math.max(Math.abs(n-e),Math.abs(n+a-(e+s)))),_a=(t,e,i,s,o,n,r)=>{const a=Math.max(Number(s)||0,0)/2,l=Math.PI/180,c=Math.cos(i*l)*a,h=Math.sin(i*l)*a,d=Math.cos(r*l)*a,p=Math.sin(r*l)*a,u=Math.max(pa(t+c,e+h,o+d,n+p),pa(t-c,e-h,o-d,n-p)),_=Math.max(pa(t+c,e+h,o-d,n-p),pa(t-c,e-h,o+d,n+p));return Math.min(u,_)},ma=t=>{const e=Number(t?.cell_cm);return e>0?e:5};const ga=t=>JSON.parse(JSON.stringify(t)),fa=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),va=(t,e,i)=>Math.min(i,Math.max(e,t)),ba=t=>eo({spaces:[t]})[0],ya=t=>{const e=[];for(const i of t||[]){const t=ze(i);if(t?.length)for(let i=0;i<t.length;i++)e.push([[t[i][0],t[i][1]],[t[(i+1)%t.length][0],t[(i+1)%t.length][1]]])}return e};function wa(t,e){const i=ga(t||{spaces:[],markers:[],settings:{}}),s=JSON.stringify(t||{}),o=JSON.stringify(e||{}),n=Number.isInteger(Number(i.model_version))?Number(i.model_version):0;let r=(t=>{let e=0;for(const i of t.markers||[]){if("ripple"===i.display&&(i.display="icon_ripple",e++),Array.isArray(i.controls)){Tr(i.binding,i.controls)&&!0!==i.is_light&&(i.is_light=!0,e++);const t="string"==typeof i.binding&&i.binding.startsWith("entity:")?i.binding.slice(7):"",s=t?i.controls.filter(e=>e!==t):i.controls;JSON.stringify(s)!==JSON.stringify(i.controls)&&(i.controls=s.length?s:null,e++)}const t=i.vacuum;t&&fa(t,"trail")&&(["never","cleaning","always"].includes(t.trail_mode)||(t.trail_mode=!1===t.trail?"never":"cleaning"),delete t.trail,e++)}for(const i of t.spaces||[]){if(fa(i,"segments")&&(delete i.segments,e++),fa(i,"plan_scale")){const t=Number(i.plan_scale);Number.isFinite(t)&&t>=Zs&&t<=Xs&&(fa(i,"plan_scale_x")||(i.plan_scale_x=t),fa(i,"plan_scale_y")||(i.plan_scale_y=t),delete i.plan_scale,e++)}const t=Number(i.cell_cm);fa(i,"cell_cm")&&(!Number.isFinite(t)||t<.1||t>1e3)&&(i.cell_cm=Number.isFinite(t)?va(t,.1,1e3):5,e++);const s=Number(i.cell_cm),o=Number.isFinite(s)&&s>0?s:5;for(const t of i.decor||[]){if(fa(t,"width")){const i=Number(t.width);(fa(t,"width_cm")||Number.isFinite(i))&&(fa(t,"width_cm")||(t.width_cm=Number(va(i/no*o,.1,100).toFixed(6))),delete t.width,e++)}if("rect"!==t?.kind&&"ellipse"!==t?.kind||!0!==t.fill||(fa(t,"fill_color")||(t.fill_color=t.color||"#607d8b",e++),fa(t,"fill_opacity")||(t.fill_opacity=.25,e++)),"text"!==t?.kind)continue;void 0===t.size_cm?(t.size_cm=Number(va(bi*yi(t)/no*o,.1,2e3).toFixed(6)),delete t.scale,delete t.size,e++):(fa(t,"scale")||fa(t,"size"))&&(delete t.scale,delete t.size,e++);let i=String(t.text??"");const s=[...i.matchAll(/\{([^{}\r\n]+)\}/g)].some(t=>!!_i(t[1]));if(!(fa(t,"entity")||fa(t,"attr")||fa(t,"unit")))continue;const n=String(t.unit??"").trim(),r="state"===String(t.attr??"").trim().toLowerCase()?null:t.attr,a=s||n?"":mi(t.entity,r);if(s||a){if(a){const e=i.indexOf("{}");i=e>=0?i.slice(0,e)+a+i.slice(e+2):`${i}${i?" ":""}${a}`,t.text=i}delete t.entity,delete t.attr,delete t.unit,e++}}}return e})(i);for(const t of i.spaces||[]){const e=ba(t);if(!e)continue;if(!Nn(t.open_spans).length){const i=Hn(e.rooms,null,Ys,.02*no,!0);i.length&&(t.open_spans=qn(i,Ys),r++)}}const a=ga(i.spaces||[]),l=function(t,e){const i=JSON.parse(JSON.stringify(t||[])),s=JSON.parse(JSON.stringify(e||{}));let o=0,n=0,r=0,a=0,l="",c=0;const h={};let d=5;for(const t of i){const e=ma(t);null!=t?.id&&(h[String(t.id)]=e),e>d&&(d=e)}const p=(t,e,i,s=!1)=>{if(!(t>ha||s))return;o++,t>r&&(r=t);const n=t*oo*e;n>a&&(a=n,l=i)};for(const t of i){const e=ma(t),i=null!=t?.id?String(t.id):"";for(const s of t.rooms||[]){n++;let t=0;if(s.poly?.length)s.poly=s.poly.map(e=>{const i=[da(e[0]),da(e[1])];return t=Math.max(t,pa(e[0],e[1],i[0],i[1])),i});else if(null!=s.x&&null!=s.y){const e=s.x,i=s.y,o=s.w||0,n=s.h||0,r=da(e+o),a=da(i+n),l=da(e),c=da(i),h=Math.max(ro,r-l),d=Math.max(ro,a-c);t=ua(e,i,o,n,l,c,h,d),s.x=l,s.y=c,s.w=h,s.h=d}p(t,e,i)}for(const s of t.decor||[]){n++;let t=0;if("line"===s.kind){const e=[da(s.x1),da(s.y1)],i=[da(s.x2),da(s.y2)];t=Math.max(pa(s.x1,s.y1,e[0],e[1]),pa(s.x2,s.y2,i[0],i[1])),s.x1=e[0],s.y1=e[1],s.x2=i[0],s.y2=i[1]}else{const e=da(s.x),i=da(s.y);if(null!=s.w&&null!=s.h){const o=da(s.x+s.w),n=da(s.y+s.h),r=Math.max(ro,o-e),a=Math.max(ro,n-i);t=ua(s.x,s.y,s.w,s.h,e,i,r,a),s.w=r,s.h=a}else t=pa(s.x,s.y,e,i);s.x=e,s.y=i}p(t,e,i)}for(const s of t.openings||[]){n++;const o=Re([s.x,s.y],t.rooms||[],.025,{step:ro,length:Number(s.length)||0});if(!o)continue;const r=Number(s.angle),a=!(Number.isFinite(r)&&r===o.angle),l=_a(s.x,s.y,Number.isFinite(r)?r:o.angle,Number(s.length)||0,o.x,o.y,o.angle);s.x=o.x,s.y=o.y,s.angle=o.angle,a&&c++,p(l,e,i,a)}}for(const[t,e]of Object.entries(s)){if(!e||"object"!=typeof e)continue;const i=e;if("number"!=typeof i.x||"number"!=typeof i.y)continue;n++;const o=da(i.x),r=da(i.y),a=pa(i.x,i.y,o,r);s[t]={...i,x:o,y:r};const l="string"==typeof i.s?i.s:"";p(a,h[l]??d,l)}return{spaces:i,layout:s,report:{moved:o,total:n,maxShift:r,maxShiftCm:a,maxSpace:l,rotated:c},changed:o>0}}(i.spaces||[],e||{});i.spaces=l.spaces;const c={...l.report};let h=0,d=0,p=0;for(let t=0;t<i.spaces.length;t++){const e=a[t],s=i.spaces[t],o=JSON.stringify({spans:e.open_spans||[],links:(e.rooms||[]).map(t=>[t.id,t.open_to||[]]),walls:e.walls||[]}),n=ba(e),r=ba(s);if(!n||!r)continue;const l=ya(n.rooms),u=ya(r.rooms),_=.02*no;let m=Gn(Nn(e.open_spans),l,u,Ys);const g=m.length;m=Vn(m,r.rooms,Ys,_),m=m.map(t=>{const e=Rn(t,Ys),i=[e[0],e[1]],o=[e[2],e[3]],n=[(e[0]+e[2])/2,(e[1]+e[3])/2],r=e[2]-e[0],a=e[3]-e[1],l=Math.hypot(r,a)||1,h=u.map(([t,e])=>[t[0],t[1],e[0],e[1]]).filter(t=>{const e=t[2]-t[0],s=t[3]-t[1],c=Math.hypot(e,s)||1;return Math.abs(r*s-a*e)/(l*c)<=1e-6&&En(n,t).d<=4*_&&En(i,t).d<=4*_&&En(o,t).d<=4*_}).sort((t,e)=>Math.hypot(e[2]-e[0],e[3]-e[1])-Math.hypot(t[2]-t[0],t[3]-t[1]))[0];if(c.total++,!h)return t;const d=[[h[0],h[1]],[h[2],h[3]]],p=Fn(i,h,d,no,2*_),m=Fn(o,h,d,no,2*_);if(Math.hypot(m[0]-p[0],m[1]-p[1])<.5*no)return t;const g=Math.max(Math.hypot(p[0]-i[0],p[1]-i[1]),Math.hypot(m[0]-o[0],m[1]-o[1]));if(g>1e-6*no){c.moved++;const t=g/Ys;t>c.maxShift&&(c.maxShift=t);const e=g/no*(Number(s.cell_cm)>0?Number(s.cell_cm):5);e>c.maxShiftCm&&(c.maxShiftCm=e,c.maxSpace=String(s.id||""))}return Pn(p,m,Ys)}),m=Vn(m,r.rooms,Ys,_),d+=Math.max(0,g-m.length);const f=m.map(t=>Rn(t,Ys));m.length?s.open_spans=m:delete s.open_spans,Un(s.rooms||[],r.rooms,f,_);const v=Array.isArray(e.walls)?e.walls.length:0;let b=rn(e.walls,l,u,ro,Ys);b=kn(r.rooms,b,f,ro,Number(s.cell_cm)>0?Number(s.cell_cm):5,no,Ys),b=on(b,s.rooms||[],ro,1,f.map(t=>[t[0]/Ys,t[1]/Ys,t[2]/Ys,t[3]/Ys])),h+=Math.max(0,v-b.length),b.length?s.walls=b:delete s.walls;const y=JSON.stringify({spans:s.open_spans||[],links:(s.rooms||[]).map(t=>[t.id,t.open_to||[]]),walls:s.walls||[]});y!==o&&p++}const u=JSON.stringify(i)!==s||JSON.stringify(l.layout)!==o;n<4&&u&&(i.model_version=4);const _=JSON.stringify(i)!==s||JSON.stringify(l.layout)!==o,m=Number.isInteger(Number(i.model_version))?Number(i.model_version):n;return{config:i,layout:l.layout,report:{...c,modelFrom:n,modelTo:m,migrated:r,canonicalized:p,wallsMerged:h,spansMerged:d},changed:_}}class ka{constructor(t=50){this._undo=[],this._redo=[],this._limit=Math.max(30,Math.floor(t))}get canUndo(){return this._undo.length>0}get canRedo(){return this._redo.length>0}get undoName(){return this._undo[this._undo.length-1]?.name??null}get redoName(){return this._redo[this._redo.length-1]?.name??null}get size(){return this._undo.length}push(t){this._undo.push(t),this._undo.length>this._limit&&this._undo.splice(0,this._undo.length-this._limit),this._redo=[]}undo(){const t=this._undo.pop()??null;return t&&this._redo.push(t),t}redo(){const t=this._redo.pop()??null;return t&&this._undo.push(t),t}clear(){this._undo=[],this._redo=[]}}const xa="1.60.1-beta.1",$a=2e3,Sa=1e3,Ma=1500,Ca=15e3;let Da="undefined"!=typeof document&&"hidden"===document.visibilityState?Date.now():0,za=0;const Ta=new Map;let Pa=0;const Ra=t=>`${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(t??{})}`;let Aa=1e4;const Na="houseplan_card_layout_v1",Ea="houseplan_card_cfg_v1",Oa="houseplan_card_zoom_v1",Fa="houseplan_card_nav_v1",Ia="houseplan_card_kiosk_v1",La=1e3,Ha=3300,qa=(t,e)=>{const i=Math.min(t.x,e.x),s=Math.min(t.y,e.y);return{x:i,y:s,w:Math.max(t.x+t.w,e.x+e.w)-i,h:Math.max(t.y+t.h,e.y+e.h)-s}},Ua=(t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)},Wa=(t,e)=>{let i,s=null;const o=(...o)=>{clearTimeout(i),s=o,i=window.setTimeout(()=>{i=void 0;const e=s;s=null,e&&t(...e)},e)};return o.flush=()=>{if(void 0===i)return;clearTimeout(i),i=void 0;const e=s;s=null,e&&t(...e)},o.pending=()=>void 0!==i,o},Ba=t=>{try{t.target?.setPointerCapture?.(t.pointerId)}catch{}};class ja extends lt{constructor(){super(...arguments),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._serverCanWrite=null,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._unsubCfg=null,this._unsubLayout=null,this._layoutRev=0,this._canOptimizeUndo=!1,this._devices=[],this._regSignature="",this._defPos={},this._newSyncKey="",this._tip=null,this._hoverRoom=null,this._selId=null,this._toast="",this._mode="view",this._pendingNavMode=null,this._decorTool="select",this._decorStyle={...Fs},this._decorDraft=null,this._decorMove=null,this._decorSel=null,this._decorEraseConfirm=null,this._decorTextDialog=null,this._decorShapeDialog=null,this._backdropDialog=null,this._decorTextSelection={start:0,end:0},this._furnPalette=null,this._dtBox=null,this._dtDrag=null,this._bdDrag=null,this._slide="",this._navMotion="",this._editorChromeMode="plan",this._tool="draw",this._geometryHistory=new ka(50),this._wallDialog=null,this._drawWallField=null,this._rszSel=null,this._rszDrag=null,this._rszPreview=null,this._rszLive=null,this._path=[],this._cursorPt=null,this._mergeSel=null,this._openingDialog=null,this._openingInfo=null,this._opDrag=null,this._opMeasure=null,this._mergeDialog=null,this._openWallAnchor=null,this._splitSel=null,this._pendingSplit=null,this._areaSel="",this._nameSel="",this._roomDialog=!1,this._roomEditId=null,this._roomFill="",this._roomTempSrc="",this._roomHumSrc="",this._roomSrcOpen=null,this._roomSrcFilter="",this._roomNameScale=1,this._roomLabelScale=1,this._zoom=1,this._view=null,this._zoomBySpace={},this._viewModeSnap=null,this._pointers=new Map,this._panStart=null,this._panLock=null,this._pinchStart=null,this._suppressClick=!1,this._hdrH=118,this._booting=!0,this._bootFading=!1,this._bootLastH=-1,this._bootStart=0,this._bootLastChange=0,this._bootSoft=!1,this._tapConfirm=null,this._onboardingShown=!1,this._rulesDialog=null,this._alignDialog=null,this._settingsDialog=null,this._sunRaysCache=null,this._skyElev=null,this._skySnap=!1,this._skySnapRaf=0,this._compassDrag=!1,this._importDialog=null,this._importQueue=[],this._importTotal=0,this._rulesCompiledSrc="",this._infoCard=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=t=>this._onKey(t),this._warmVp=null,this._warmVpArmed=!1,this._warmLongReturn=!1,this._warmRevivePending=!1,this._warmGen=++Pa,this._warmKey=null,this._warmSlot=null,this._hashApplied=!1,this._navApplied=!1,this._kioskScale={icon:1,font:1},this._kioskDialog=!1,this._activityRt=new Map,this._vacRt=new Map,this._vacViewKey="",this._vacLastView=null,this._vacRaf=0,this._vacSrvTrails={},this._vacJumpOnce=!1,this._vacVisHandler=()=>{if("hidden"!==document.visibilityState){if("visible"===document.visibilityState){const t=Date.now();Da&&t-Da>=Ca&&(za=t),Da=0,this._vacJumpOnce=!0,this._skyElev=null,this._tip=null,this._hoverRoom=null,t-za<=15e3&&this._beginResumeSettle(),this.requestUpdate()}}else Da||(Da=Date.now())},this._resumeSettling=!1,this._resumeRaf=0,this._resumeStarted=0,this._resumeLastSize="",this._resumeLastChange=0,this._viewportInvalidAt=0,this._vacFit=null,this._kioskDots=!1,this._cyclePausedUntil=0,this._swipeStart=null,this._lastTap=0,this._onHashChange=()=>{const t=this._hashSpace();t&&this._model.find(e=>e.id===t)&&t!==this._space&&(this._space=t,this._selId=null,this._restoreZoom(),this.requestUpdate())},this._drag=null,this._rlResize=null,this._holdFired=!1,this._cfgEpoch=0,this._modelCache=null,this._decorSnapCache=null,this._showHidden=!1,this._connHooked=null,this._onConnReady=()=>{this._loadTries=0,clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,this._loading||(this._loadOk&&this._unsubCfg?this._reloadConfigOnly():this._loadFromServer())},this._signer=new Kn(()=>this.requestUpdate()),this._dirtyPos=new Set,this._sentPos=new Map,this._persistLayout=Wa(()=>{if(this._serverStorage){const t=[...this._dirtyPos];this._dirtyPos.clear();for(const e of t){const t=this._layout[e];t&&(this._sentPos.set(e,t),this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t}).then(t=>this._noteLayoutRev(t)).catch(t=>this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)}))).finally(()=>{this._sentPos.get(e)===t&&this._sentPos.delete(e)}))}this._cacheSnapshot()}else localStorage.setItem(Na,JSON.stringify(this._layout))},600),this._frame=null,this._showFar=!1,this._writesPending=0,this._writeChain=Promise.resolve(),this._undoGeometry=()=>{if(this._decorDraft)return this._decorDraft=null,void this.requestUpdate();if(this._decorMove||this._dtDrag||this._bdDrag)return void this._cancelDecorGesture();if(this._rszDrag)return void this._rszCancelDrag();const t=this._geometryHistory.undo();t&&(this._applyGeometryState(t.before)?this._showToast(this._t("history.undone",{name:t.name})):this._geometryHistory.clear())},this._redoGeometry=()=>{if(this._decorDraft)return this._decorDraft=null,void this.requestUpdate();if(this._decorMove||this._dtDrag||this._bdDrag)return void this._cancelDecorGesture();if(this._rszDrag)return void this._rszCancelDrag();const t=this._geometryHistory.redo();t&&(this._applyGeometryState(t.after)?this._showToast(this._t("history.redone",{name:t.name})):this._geometryHistory.clear())},this._saveConfigDebounced=Wa(()=>{this._serverCfg&&this._writeConfig().catch(t=>{"conflict"===t?.code?(this._showToast(this._t("toast.conflict")),this._cancelPath(),this._reloadConfigOnly(!0)):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(t)}))})},500),this._toggleServerPlans=async()=>{const t=this._spaceDialog;if(t)if(t.pickSaved)this._spaceDialog={...t,pickSaved:!1};else{this._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.hass.callWS({type:"houseplan/plans/list"}),e=this._spaceDialog;e&&(this._spaceDialog={...e,saved:t?.plans||[],savedBusy:!1})}catch(t){const e=this._spaceDialog;e&&(this._spaceDialog={...e,saved:[],savedBusy:!1}),this._showToast(this._t("toast.plans_list_failed",{err:this._errText(t)}))}}},this._aspectJob=null,this._sunShown=!1,this._sunOut=!1,this._sunOutTimer=0,this._openSettingsDialog=()=>{if(!this._norm)return;const t=this._glowRadiusCm,e=this._imperial?Math.round(t/30.48*10)/10:Math.round(t)/100;this._settingsDialog={colors:JSON.parse(JSON.stringify(this._fillColors)),glowRadius:e,bgColor:Si(this._settings,{bgColor:null})||null,northDeg:Rs(this._settings,{}),bgMode:As(this._settings,{}),sunRays:Ns(this._settings,{}),weatherEntity:Es(this._settings)||"",busy:!1}},this._openAlignDialog=()=>{if(!this._norm||!this._serverCfg)return;const t=this._serverCfg.spaces||[],e=wa(this._serverCfg,this._layout||{}),i=Math.ceil(10*e.report.maxShiftCm)/10,s=t.find(t=>null!=t?.id&&String(t.id)===e.report.maxSpace),o=t.length>1&&s?String(s.title||s.id):"";this._alignDialog={report:e.report,config:e.config,layout:e.layout,cm:i,where:o,changed:e.changed,busy:!1}},this._optimizeUndoBusy=!1,this._openRulesDialog=()=>{if(!this._norm)return;const t=this._settings.icon_rules,e=(t&&t.length?t:mt).map(t=>({...t}));this._rulesDialog={rules:e,test:"",busy:!1}},this._climateCache=null,this._gearPtCache=new WeakMap}get _canEdit(){return!!this._norm&&(!0===this._serverCanWrite||!1!==this._serverCanWrite&&!0===this.hass?.user?.is_admin)}get _kiosk(){return!!this._config?.kiosk}_showKioskDots(){this._kioskDots=!0,clearTimeout(this._kioskDotsTimer),this._kioskDotsTimer=window.setTimeout(()=>this._kioskDots=!1,2500)}_startNavMotion(t){clearTimeout(this._navMotionTimer),window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?this._navMotion="":(this._navMotion=t,this._navMotionTimer=window.setTimeout(()=>{this._navMotion="",this.requestUpdate()},190))}_slideTo(t,e){if(t===this._space)return;const i=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;this._space=t,this._selId=null,this._restoreZoom(),i||(this._slide=e,clearTimeout(this._slideTimer),this._slideTimer=window.setTimeout(()=>{this._slide="",this.requestUpdate()},190),this.requestUpdate())}_pickSpace(t){if(t===this._space)return;const e=this._model.map(t=>t.id),i=e.indexOf(this._space),s=e.indexOf(t);this._navApplied=!0,this._showFar=!1,this._frame=null,this._slideTo(t,i>=0&&s<i?"right":"left"),this._saveNav()}_cycleTick(){if(this._kiosk&&Number(this._config?.cycle)>0&&Date.now()>=this._cyclePausedUntil&&this._model.length>1&&this._zoom<=1.001){const t=this._model.map(t=>t.id),e=t.indexOf(this._space);this._slideTo(t[(e+1)%t.length],"left"),this._showKioskDots()}}get _editing(){return"plan"===this._mode||"devices"===this._mode||"decor"===this._mode}get _markup(){return"plan"===this._mode}_hashSpace(){const t=/(?:^|[#&])space=([^&]+)/.exec(window.location.hash||"");return t?decodeURIComponent(t[1]):""}connectedCallback(){document.addEventListener("visibilitychange",this._vacVisHandler),super.connectedCallback(),window.addEventListener("keydown",this._keyHandler),this._signer.start(()=>this.hass,()=>ji(this._serverCfg)),this._config?.kiosk&&Number(this._config?.cycle)>0&&(clearInterval(this._cycleTimer),this._cycleTimer=window.setInterval(()=>this._cycleTick(),1e3*Number(this._config.cycle))),window.addEventListener("hashchange",this._onHashChange),this._booting?this._bootWatch():this._bootFading&&(clearTimeout(this._bootTimer),this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220)),this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},Ma)),!this._loadOk&&this._serverCfg&&this.hass&&this._scheduleLoadRetry(),!this._warmSlot&&this._config&&this._warmAdopt(),this._warmVp&&!this._warmRevivePending&&void 0===this._warmReviveTimer&&(this._warmRevivePending=!0,this._warmReviveTimer=window.setTimeout(()=>this._warmReviveDialog(),0));const t=Date.now();"visible"===document.visibilityState&&Da&&(t-Da>=Ca&&(za=t),Da=0),(this._warmLongReturn||t-za<=15e3)&&this._beginResumeSettle(),this._warmLongReturn=!1}disconnectedCallback(){document.removeEventListener("visibilitychange",this._vacVisHandler),this._vacRaf&&(cancelAnimationFrame(this._vacRaf),this._vacRaf=0),this._resumeRaf&&(cancelAnimationFrame(this._resumeRaf),this._resumeRaf=0),this._skySnapRaf&&(cancelAnimationFrame(this._skySnapRaf),this._skySnapRaf=0);for(const t of this._activityRt.values())clearTimeout(t.timer);window.removeEventListener("keydown",this._keyHandler),clearInterval(this._cycleTimer),clearTimeout(this._kioskDotsTimer),clearTimeout(this._kioskHoldTimer),clearTimeout(this._reloadRetry),clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked=null,this._signer.dispose(),clearTimeout(this._toastTimer),clearTimeout(this._slideTimer),clearTimeout(this._navMotionTimer),clearTimeout(this._bootTimer),this._bootTimer=void 0,clearTimeout(this._bootSoftTimer),this._saveConfigDebounced.flush(),window.removeEventListener("hashchange",this._onHashChange),clearTimeout(this._holdTimer),this._roViewport?.disconnect(),this._roViewport=void 0,this._roHdr?.disconnect(),this._roHdr=void 0,this._onWinResize&&(window.removeEventListener("resize",this._onWinResize),this._onWinResize=void 0),this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),this._unsubLayout&&(this._unsubLayout(),this._unsubLayout=null),clearTimeout(this._layoutSyncTimer),this._warmSnapshot(),this._warmRevivePending=!1,clearTimeout(this._warmReviveTimer),this._warmReviveTimer=void 0,this._warmRelease(),this._resumeSettling=!1,super.disconnectedCallback()}_onKey(t){if("Escape"===t.key&&this._vacFit)return this._vacFit=null,this._showToast(this._t("vac.cal_cancelled")),void t.stopPropagation();if("Escape"===t.key){if(this._tapConfirm)return void(this._tapConfirm=null);if(this._decorEraseConfirm)return void(this._decorEraseConfirm=null);if(this._openingInfo)return void(this._openingInfo=null);if(this._infoCard)return void(this._infoCard=null);if(this._rulesDialog)return void(this._rulesDialog=null);if(this._alignDialog)return void(this._alignDialog=null);if(this._settingsDialog)return void(this._settingsDialog=null);if(this._markerDialog)return void(this._markerDialog=null);if(this._openingDialog)return void(this._openingDialog=null);if(this._backdropDialog)return void(this._backdropDialog=null);if(this._decorShapeDialog)return void(this._decorShapeDialog=null);if(this._decorTextDialog)return void(this._decorTextDialog=null);if(this._spaceDialog&&!this._roomDialog)return this._spaceDialog=null,this._importQueue=[],void(this._importTotal=0)}const e=(t.composedPath?.()||[t.target]).some(t=>t?.matches?.('input, textarea, select, [contenteditable="true"]')),i=t.ctrlKey||t.metaKey,s=t.key.toLowerCase(),o="KeyZ"===t.code||"z"===s,n="KeyY"===t.code||"y"===s,r=i&&(o&&t.shiftKey||n),a=i&&o&&!t.shiftKey;if("decor"===this._mode){if((a||r)&&e)return;return r?(t.preventDefault(),void this._redoGeometry()):a?(t.preventDefault(),this._decorDraft?void(this._decorDraft=null):this._decorMove||this._dtDrag||this._bdDrag?void this._cancelDecorGesture():void this._undoGeometry()):"Delete"!==t.key&&"Backspace"!==t.key||!this._decorSel||e?void("Escape"===t.key&&(t.preventDefault(),this._decorDraft?this._decorDraft=null:this._decorMove||this._dtDrag||this._bdDrag?this._cancelDecorGesture():this._furnPalette?this._furnPalette=null:this._decorSel?this._decorSel=null:"select"!==this._decorTool?this._decorTool="select":this._setMode("view"))):(t.preventDefault(),void this._decorDeleteSel())}if(this._markup&&(!a&&!r||!e)){if(r)return t.preventDefault(),void this._redoGeometry();if(a)return t.preventDefault(),this._rszDrag?void this._rszCancelDrag():"draw"===this._tool&&this._path.length?void this._undoPoint():"split"===this._tool&&this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},void(this._splitSel.pts.length||(this._cursorPt=null))):void this._undoGeometry();if("Escape"===t.key)return this._roomDialog?(t.preventDefault(),void this._roomDialogCancel()):"draw"===this._tool&&this._path.length?(t.preventDefault(),void this._undoPoint()):"resize"===this._tool?(t.preventDefault(),this._rszDrag?void this._rszCancelDrag():void(this._rszSel?this._rszSel=null:this._tool="draw")):"split"===this._tool?(t.preventDefault(),void(this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},this._splitSel.pts.length||(this._cursorPt=null)):this._splitSel?this._splitSel=null:this._tool="draw")):"merge"===this._tool?(t.preventDefault(),void(this._mergeSel?this._mergeSel=null:this._tool="draw")):this._wallDialog?(t.preventDefault(),void(this._wallDialog=null)):"openwall"===this._tool||"closewall"===this._tool?(t.preventDefault(),void(this._openWallAnchor?this._openWallAnchor=null:this._tool="draw")):void("opening"!==this._tool&&"wallthick"!==this._tool&&"delroom"!==this._tool||(t.preventDefault(),this._tool="draw"))}}_undoPoint(){this._path.length&&(this._path=this._path.slice(0,-1))}static getConfigElement(){return document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card"}}static _warmBootReset(t){for(const t of Ta.values())for(const e of t)clearTimeout(e.evict);Ta.clear(),Aa=t&&t>0?t:1e4}static _warmBootStats(){let t=0,e=0;const i=[];for(const s of Ta.values())for(const o of s)t++,o.dlg&&(e++,i.push(o.dlg.kind));return{keys:Ta.size,slots:t,dlgs:e,drafts:i}}setConfig(t){this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...t},this._config.kiosk&&(this._booting=!1,this._bootFading=!1),t.default_floor&&(this._space=t.default_floor);try{this._zoomBySpace=JSON.parse(localStorage.getItem(Oa)||"{}")||{}}catch{this._zoomBySpace={}}try{const t=JSON.parse(localStorage.getItem(Ia)||"null");this._kioskScale={icon:Ki(t?.icon),font:Ki(t?.font)}}catch{}try{const e=JSON.parse(localStorage.getItem(Ea)||"null");if(e&&e.config&&Array.isArray(e.config.spaces)){this._serverCfg=e.config,this._cfgEpoch++,this._cfgRev=e.rev||0,this._layout=e.layout||{},this._serverStorage=!0;const i=this._hashSpace(),s=this._savedNav();i&&this._model.find(t=>t.id===i)?(this._space=i,this._hashApplied=!0):s?.space&&this._model.find(t=>t.id===s.space)?(this._space=s.space,this._navApplied=!0):t.default_floor?this._space=t.default_floor:this._model.find(t=>t.id===this._space)||(this._space=this._model[0]?.id||this._space),s?.mode&&"view"!==s.mode&&!t.kiosk&&(this._canEdit?this._mode=s.mode:this._pendingNavMode=s.mode)}}catch{}"view"!==this._mode||this._view||(this._zoom=this._zoomBySpace[this._space]||1),this.isConnected&&(this._warmAdopt(),this._warmLongReturn&&this._beginResumeSettle(),this._warmLongReturn=!1)}_warmAdopt(){if(this._config?.kiosk)return;const t=Ra(this._config);if(this._warmKey===t&&this._warmSlot)return;this._warmSlot&&this._warmRelease();const e=this.parentNode,i=this._warmIdx(e),s=Ta.get(t);if(!s||!s.length)return;const o=s.find(t=>t.owner===this._warmGen);if(o)return this._warmLongReturn=!!o.freed&&Date.now()-o.freed>=Ca,clearTimeout(o.evict),o.evict=0,o.freed=0,o.live=!0,this._warmSlot=o,void(this._warmKey=t);const{slot:n,sure:r}=((t,e,i,s)=>{const o=t=>{const e=!!i&&t.place?.deref()===i;return e&&t.idx===s?4:t.live?0:e?3:2};let n=null,r=0,a=0,l=null;for(const i of t){if(i.owner===e)continue;l=i;const t=o(i);t<=0||(t>r?(n=i,r=t,a=1):t===r&&a++)}return!n||a>1?{slot:n||l,sure:!1}:{slot:n,sure:!0}})(s,this._warmGen,e,i);n&&(this._warmLongReturn=!!n.freed&&Date.now()-n.freed>=Ca,this._booting=!1,this._bootFading=!1,this._hdrH=n.hdrH,this._bootSoft=!0,this.isConnected&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},Ma)),this._warmKey=t,r?(clearTimeout(n.evict),n.evict=0,n.owner=this._warmGen,n.place=e?new WeakRef(e):null,n.idx=i,n.live=!0,this._warmSlot=n,this._warmVp=n.vp,this._warmAdoptViewport(this._config)):(this._warmSlot={owner:this._warmGen,place:e?new WeakRef(e):null,idx:i,live:!0,hdrH:n.hdrH,stageH:n.stageH,vp:null,dlg:null,freed:0,evict:0},s.push(this._warmSlot),this._warmTrim(s)))}_warmIdx(t){const e=t?.children;if(!e)return-1;for(let t=0;t<e.length;t++)if(e[t]===this)return t;return-1}_warmRelease(){const t=this._warmSlot,e=this._warmKey;this._warmSlot=null,this._warmKey=null,t&&e&&(t.freed=Date.now(),t.owner===this._warmGen&&(t.live=!1),this._warmScheduleEvict(t,e))}_warmTrim(t){for(;t.length>4;){const e=t.findIndex(t=>!t.live);if(e<0)break;clearTimeout(t[e].evict),t.splice(e,1)}}_warmScheduleEvict(t,e){if(clearTimeout(t.evict),!t.dlg)return;const i=t.freed,s=t.owner;t.evict=window.setTimeout(()=>{if(t.evict=0,t.freed!==i||t.owner!==s)return;t.dlg=null;const o=Ta.get(e);if(!t.live&&o&&o.length>1){const e=o.indexOf(t);e>=0&&o.splice(e,1)}},Aa+250)}_warmAdoptViewport(t){const e=this._warmVp;e&&(!this._hashApplied&&this._model.find(t=>t.id===e.space)?(this._space=e.space,this._navApplied=!0,this._mode="view"!==e.mode&&this._canEdit&&!t.kiosk?e.mode:"view",this._pendingNavMode="view"===e.mode||this._canEdit||t.kiosk?null:e.mode,this._zoom=e.zoom,this._view=e.view?{...e.view}:null,this._viewModeSnap=e.snap?{...e.snap}:null,this._tool=e.tool,this._decorTool=e.decorTool,this._showHidden=e.showHidden,this._showFar!==e.showFar&&(this._showFar=e.showFar,this._frame=null),this._selId=e.selId,this._rszSel=e.rszSel,this._decorSel=e.decorSel,this._warmVpArmed=!0):this._warmVp=null)}_warmPatch(t,e=!1){if(this._config?.kiosk)return;const i=Ra(this._config);if(!this._warmSlot||this._warmKey===i){if(!this._warmSlot){if(!e)return;const t=this.parentNode;this._warmKey=i,this._warmSlot={owner:this._warmGen,place:t?new WeakRef(t):null,idx:this._warmIdx(t),live:!0,hdrH:this._hdrH,stageH:0,vp:null,dlg:null,freed:0,evict:0};const s=Ta.get(i)||[];for(s.push(this._warmSlot),Ta.set(i,s),this._warmTrim(s);Ta.size>8;){const t=Ta.keys().next().value;if(void 0===t||t===i)break;for(const e of Ta.get(t)||[])clearTimeout(e.evict);Ta.delete(t)}}Object.assign(this._warmSlot,t)}}_warmViewportState(){return{space:this._space,mode:this._mode,zoom:this._zoom,view:this._view?{...this._view}:null,snap:this._viewModeSnap?{...this._viewModeSnap}:null,tool:this._tool,decorTool:this._decorTool,showHidden:this._showHidden,showFar:this._showFar,selId:this._selId,rszSel:this._rszSel,decorSel:this._decorSel}}_warmDialogState(){const t=(t,e)=>({kind:t,space:this._space,mode:this._mode,data:e});return this._tapConfirm||this._alignDialog||this._mergeDialog||this._importDialog?null:this._openingInfo?t("openingInfo",this._openingInfo.id):this._infoCard?t("info",this._infoCard.id):this._rulesDialog?this._rulesDialog.busy?null:t("rules",this._rulesDialog):this._settingsDialog?this._settingsDialog.busy?null:t("settings",this._settingsDialog):this._markerDialog?this._markerDialog.busy?null:t("marker",this._markerDialog):this._openingDialog?t("opening",this._openingDialog):this._backdropDialog?t("backdrop",this._backdropDialog):this._decorShapeDialog?t("decorShape",this._decorShapeDialog):this._decorTextDialog?t("decorText",this._decorTextDialog):this._roomDialog?t("room",{editId:this._roomEditId,fill:this._roomFill,tempSrc:this._roomTempSrc,humSrc:this._roomHumSrc,srcOpen:this._roomSrcOpen,srcFilter:this._roomSrcFilter,nameScale:this._roomNameScale,labelScale:this._roomLabelScale,areaSel:this._areaSel,nameSel:this._nameSel,pendingSplit:this._pendingSplit,path:this._path}):this._spaceDialog?this._spaceDialog.busy?null:t("space",this._spaceDialog):null}_warmSnapshot(){if(this._booting||this._resumeSettling||this._config?.kiosk)return;const t={vp:this._warmViewportState()};if(this._warmRevivePending||(t.dlg=this._warmDialogState()),this.isConnected&&this._warmSlot?.owner===this._warmGen){const e=this.parentNode;t.place=e?new WeakRef(e):null,t.idx=this._warmIdx(e)}this._warmPatch(t)}_warmReviveDialog(){this._warmRevivePending=!1;const t=this._warmSlot;if(this._warmReviveTimer=void 0,!t||!t.dlg)return;const e=t.dlg,i=t.freed;if(t.dlg=null,t.freed=0,clearTimeout(t.evict),t.evict=0,i&&!(Date.now()-i>Aa)&&e.space===this._space&&e.mode===this._mode){switch(e.kind){case"space":this._spaceDialog={...e.data,busy:!1,savedBusy:!1};break;case"marker":this._markerDialog={...e.data,busy:!1};break;case"settings":this._settingsDialog={...e.data,busy:!1};break;case"rules":this._rulesDialog={...e.data,busy:!1};break;case"opening":this._openingDialog={...e.data};break;case"backdrop":this._backdropDialog={...e.data};break;case"decorShape":this._decorShapeDialog={...e.data};break;case"decorText":{this._decorTextDialog={...e.data};const t=String(this._decorTextDialog?.text??"").length;this._decorTextSelection={start:t,end:t};break}case"room":{const t=e.data;this._roomEditId=t.editId,this._roomFill=t.fill,this._roomTempSrc=t.tempSrc,this._roomHumSrc=t.humSrc,this._roomSrcOpen=t.srcOpen,this._roomSrcFilter=t.srcFilter,this._roomNameScale=t.nameScale,this._roomLabelScale=t.labelScale,this._areaSel=t.areaSel,this._nameSel=t.nameSel,this._pendingSplit=t.pendingSplit,this._path=t.path,this._roomDialog=!0;break}case"info":{const t=this._devices.find(t=>t.id===e.data);t&&(this._infoCard=t);break}case"openingInfo":{const t=(this._curSpaceCfg?.openings||[]).find(t=>t.id===e.data);t&&(this._openingInfo=t);break}}this.requestUpdate()}}_cacheSnapshot(){if(this._serverCfg)try{localStorage.setItem(Ea,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,layout:this._layout}))}catch{}}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}_cfgFingerprint(){const t=this._serverCfg?.spaces||[];let e=t.length+":";for(const i of t){e+=(i.id||"")+","+(i.plan_aspect||"")+","+(i.plan_url||"").length+","+(i.plan_x??"")+","+(i.plan_y??"")+","+(i.plan_scale??"")+","+(i.plan_scale_x??"")+","+(i.plan_scale_y??"")+","+(i.plan_angle??"")+","+(i.rooms?.length||0)+","+(i.openings?.length||0)+","+(i.decor?.length||0)+";";for(const t of i.rooms||[]){const i=t.poly?.[0],s=t.poly?.[t.poly.length-1];e+=(t.poly?.length||0)+"."+(t.id||"")+"."+(t.open_to||[]).join("+")+"."+(t.area||"")+"."+JSON.stringify(t.settings||0)+"."+(t.x??"")+","+(t.y??"")+","+(t.w??"")+","+(t.h??"")+","+(i?i[0]+"/"+i[1]:"")+","+(s?s[0]+"/"+s[1]:"")+";"}}return e}get _model(){if(!this._serverCfg)return[];const t=this._cfgEpoch+"|"+this._cfgFingerprint();if(this._modelCache&&this._modelCache.key===t)return this._modelCache.model;const e=this._buildModel();return this._modelCache={key:t,model:e},e}_buildModel(){if(!this._serverCfg)return[];const t=this._renderCfg;return eo(t).map((e,i)=>{const s=t.spaces[i]?.plan_url;return e.bg&&s?{...e,bg:{...e.bg,href:s}}:e})}_spaceModel(t){const e=this._model;return e.find(e=>e.id===(t??this._space))||e[0]}get _areaToSpace(){const t={};for(const e of this._model)for(const i of e.rooms)i.area&&(t[i.area]={space:e.id,room:i});return t}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return this._settings.filter_seeded?this._showHidden:!!this._settings.show_all}_toggleShowAll(){if(this._serverCfg){if(this._settings.filter_seeded)return this._showHidden=!this._showHidden,void this.requestUpdate();this._serverCfg={...this._serverCfg,settings:{...this._serverCfg.settings,show_all:!this._settings.show_all}},this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate()}}_seedHiddenDevices(){if(!this._serverCfg||!this._norm||!this._canEdit)return;const t=this._serverCfg,e=function(t){const{hass:e,areaToSpace:i,markers:s,settings:o,excluded:n,iconRules:r}=t,a=!1!==o.group_lights,l=Ur(s),c=Hr(e,a).filter(t=>!Wr(e,t.eid,l)),h=new Set(c.map(t=>t.area)),d=kr(e),p=new Set(s.map(t=>t.binding)),u=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(p.has("device:"+t.id))continue;const o=d[t.id]||[],l=xr(e,t,o);let c=n.has(l)||"Group"===t.model||/scene/i.test(t.model||"")||/bridge/i.test((t.model||"")+(t.name||""))||"myheat"===l&&!!t.via_device_id;if(!c&&a&&h.has(s)){const i=(t.name_by_user||t.name||"").trim();"mdi:lightbulb"===qr(e,i,t.model,o,r)&&(c=!0)}c&&u.push("device:"+t.id)}return u}({hass:this.hass,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,firstSpaceId:this._model[0]?.id||"",iconRules:this._iconRules});if(!e.length&&t.settings?.filter_seeded)return;t.markers=t.markers||[];const i=[];for(const s of e){const e="h"+s.slice(s.indexOf(":")+1);t.markers.push({id:e,binding:s,hidden:!0}),i.push(s.slice(s.indexOf(":")+1))}const s={...t.settings||{},filter_seeded:!0};delete s.show_all,i.length&&Array.isArray(s.new_device_ids)&&(s.new_device_ids=s.new_device_ids.filter(t=>!i.includes(t))),t.settings=s,this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate()}get _iconRules(){const t=this._settings.icon_rules;if(!t||!Array.isArray(t)||!t.length)return;const e=JSON.stringify(t);return e!==this._rulesCompiledSrc&&(this._rulesCompiledSrc=e,this._rulesCompiled=gt(t)),this._rulesCompiled}get _fillColors(){return Di(this._settings)}get _excluded(){const t=this._settings.exclude_integrations;return t?new Set(t):_t}willUpdate(t){this._skyPlan(),t.has("hass")&&this.hass&&(this._hookConnection(),!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices(),this._vacTick(),this._activityTick())}updated(){this._skyRelease(),this._warmSnapshot(),this._dtMeasure();const t=this._stageEl;t&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(t)),t&&this._booting&&!this._bootTimer&&this._bootWatch();const e=this.renderRoot.querySelector(".hdr");if(e&&t&&!this._roHdr){const i=()=>{const e=this.renderRoot.querySelector("ha-card");if(!e)return;const i=t.getBoundingClientRect().top-e.getBoundingClientRect().top,s=Math.min(Math.max(e.getBoundingClientRect().top,0),120),o=Math.round(i+s);o>=0&&Math.abs(o-this._hdrH)>1&&(this._hdrH=o),o>=0&&!this._booting&&!this._config?.kiosk&&t.clientHeight>0&&this._warmPatch({hdrH:o,stageH:t.clientHeight})};this._roHdr=new ResizeObserver(()=>requestAnimationFrame(i)),this._roHdr.observe(e),this._onWinResize=()=>requestAnimationFrame(i),window.addEventListener("resize",this._onWinResize),i()}if(t&&!this._view&&this._refitView(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._importDialog&&!this._onboardingShown){this._onboardingShown=!0;const t=function(t){const e=t?.floors;if(!e||"object"!=typeof e)return[];const i=[];for(const t of Object.values(e))t&&t.floor_id&&i.push({id:t.floor_id,name:t.name||t.floor_id,level:t.level??null});return i.sort((t,e)=>{const i=t.level??1e9,s=e.level??1e9;return i!==s?i-s:t.name.localeCompare(e.name)}),i}(this.hass);t.length?this._importDialog={floors:t.map(t=>({...t,checked:!0}))}:this._openSpaceDialog("create")}}async _loadFromServer(){this._loading=!0,this._loadTries++;try{const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._loadOk=!0,this._serverStorage=!0,"boolean"==typeof t?.can_write&&(this._serverCanWrite=t.can_write),this._canOptimizeUndo=!(!t?.can_optimize_undo&&!e?.can_optimize_undo),this._pendingNavMode&&this._canEdit&&!this._config?.kiosk&&(this._mode=this._pendingNavMode,this._pendingNavMode=null);const i=t?.config;this._geometryHistory.clear(),this._serverCfg=i&&Array.isArray(i.spaces)?i:null,this._cfgEpoch++,this._cfgRev=t?.rev||0,this._layout=e?.layout||{},this._layoutRev=e?.rev??0,this._unsubCfg||(this._unsubCfg=await this.hass.connection.subscribeEvents(t=>{const e=Number(t?.data?.rev??-1);e!==this._cfgRev&&this._reloadConfigOnly(!1,e)},"houseplan_config_updated")),this.hass.callWS({type:"houseplan/trail/get"}).then(t=>{this._vacSrvTrails=t?.trails||{},this.requestUpdate()}).catch(()=>{}),this._unsubTrail||(this._unsubTrail=await this.hass.connection.subscribeEvents(async()=>{try{const t=await this.hass.callWS({type:"houseplan/trail/get"});this._vacSrvTrails=t?.trails||{},this.requestUpdate()}catch{}},"houseplan_trail_updated")),this._unsubLayout||(this._unsubLayout=await this.hass.connection.subscribeEvents(t=>this._onLayoutEvent(Number(t?.data?.rev??-1)),"houseplan_layout_updated"));const s=this._hashSpace(),o=this._savedNav();!this._hashApplied&&s&&this._model.find(t=>t.id===s)?(this._space=s,this._hashApplied=!0):o?.space&&!this._navApplied&&!this._hashApplied&&this._model.find(t=>t.id===o.space)?(this._space=o.space,this._navApplied=!0):this._norm&&!this._model.find(t=>t.id===this._space)&&(this._space=this._model[0]?.id||this._space),this._cacheSnapshot(),this._warmVpArmed&&this._space===this._warmVp?.space?this._warmVpArmed=!1:this._restoreZoom()}catch(t){if(this._serverCfg)this._scheduleLoadRetry();else if(this._loadTries>=8){this._serverStorage=!1;try{this._layout=JSON.parse(localStorage.getItem(Na)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1}this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}async _reloadConfigOnly(t=!1,e){if(!t){if(void 0!==e&&e<=this._cfgRev)return;if(this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),this._cfgWriting)return clearTimeout(this._reloadRetry),void(this._reloadRetry=window.setTimeout(()=>this._reloadConfigOnly(!1,e),400))}try{const t=await this.hass.callWS({type:"houseplan/config/get"}),e=t?.config;this._geometryHistory.clear(),this._serverCfg=e&&Array.isArray(e.spaces)?e:null,this._cfgEpoch++,this._cfgRev=t?.rev||0,this._canOptimizeUndo=!!t?.can_optimize_undo,"boolean"==typeof t?.can_write&&(this._serverCanWrite=t.can_write),this._pendingNavMode&&this._canEdit&&!this._config?.kiosk&&(this._mode=this._pendingNavMode,this._pendingNavMode=null),this._cacheSnapshot(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch(t){this._showToast(this._t("toast.cfg_reload_failed",{err:this._errText(t)}))}}_scheduleLoadRetry(){if(void 0!==this._loadRetryTimer)return;const t=Math.min(8e3,500*2**Math.min(4,Math.max(1,this._loadTries-7)));this._loadRetryTimer=window.setTimeout(()=>{this._loadRetryTimer=void 0,this._loadOk||this._loading||!this.hass||this._loadFromServer()},t)}_hookConnection(){const t=this.hass?.connection;t&&t!==this._connHooked&&(this._connHooked?.removeEventListener?.("ready",this._onConnReady),t.addEventListener?.("ready",this._onConnReady),this._connHooked=t)}_display(t){return this._signer.display(this.hass,t)}_resign(){this._signer.resign(this.hass,ji(this._serverCfg))}_onLayoutEvent(t){t<=this._layoutRev||(clearTimeout(this._layoutSyncTimer),this._layoutSyncTimer=window.setTimeout(()=>{t<=this._layoutRev||this._reloadLayoutOnly()},200))}_noteLayoutRev(t){const e=t?.rev;"number"==typeof e&&e>this._layoutRev&&(this._layoutRev=e)}async _reloadLayoutOnly(){if(!this._serverStorage||!this.hass?.callWS)return;const t=new Map;for(const e of this._dirtyPos)this._layout[e]&&t.set(e,this._layout[e]);this._persistLayout.pending()&&this._persistLayout.flush();for(const[e,i]of this._sentPos)t.set(e,i);try{const e=await this.hass.callWS({type:"houseplan/layout/get"}),i={...e?.layout||{}};for(const[e,s]of t)i[e]=s;this._layout=i,this._layoutRev=e?.rev??this._layoutRev,this._canOptimizeUndo=!!e?.can_optimize_undo,this._cacheSnapshot(),this.requestUpdate()}catch{}}_maybeRebuildDevices(){const t=this.hass;if(!t?.devices||!t?.entities||!t?.areas)return;const e=Object.keys(t.devices).length+":"+Object.keys(t.entities).length+":"+Object.keys(t.areas).length+":"+(this._norm?"n":"l")+":"+Jr(t,this._config?.language);e===this._regSignature&&this._devices.length||(this._regSignature=e,this._devices=jr({hass:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||"",loc:t=>this._t(t),iconRules:this._iconRules}),this._defPos=this._defaultPositions(),this._syncNewDevices(),this._seedHiddenDevices(),this._syncActivityRuntime())}_syncNewDevices(){if(!this._norm||!this._loadOk||!this._serverCfg)return;const t=this._devices.filter(t=>!t.marker&&!t.virtual).map(t=>t.id).sort(),e=t.join(",");if(e===this._newSyncKey)return;this._newSyncKey=e;const i=this._settings,{fresh:s,known:o}=function(t,e){if(!Array.isArray(e))return{fresh:[],known:[...t]};const i=new Set(e),s=t.filter(t=>!i.has(t));return{fresh:s,known:s.length?[...e,...s]:e}}(t,i.known_devices);if(!Array.isArray(i.known_devices)||s.length){const t=[...new Set([...i.new_device_ids||[],...s])];this._serverCfg={...this._serverCfg,settings:{...i,known_devices:o,new_device_ids:t}},this._saveConfig()}}get _newIds(){const t=this._settings.new_device_ids;return new Set(Array.isArray(t)?t:[])}_ackNewDevice(t){if(!this._newIds.has(t)||!this._serverCfg)return;const e=this._settings;this._serverCfg={...this._serverCfg,settings:{...e,new_device_ids:(e.new_device_ids||[]).filter(e=>e!==t)}},this._saveConfig(),this.requestUpdate()}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(t){if(!t)return null;const e=[];for(const i of this._devices){if(i.area!==t||i.virtual)continue;const s=Er(this.hass,i.entities);null!=s&&e.push(s)}return Qe(e)}_roomBounds(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}_defaultPositions(){const t={},e=this._config?.icon_size??2.5;for(const i of this._model){const s=e/100*xo(i)*1.3;for(const e of i.rooms){if(!e.area)continue;const o=this._devices.filter(t=>t.area===e.area&&t.space===i.id);if(!o.length)continue;const n=this._roomBounds(e),r=.1*Math.min(n.w,n.h),a=n.w-2*r,l=n.h-2*r,c=Math.max(1,Math.round(Math.sqrt(o.length*a/Math.max(l,1)))),h=Math.ceil(o.length/c),d=a/c,p=l/Math.max(h,1),u=o.map((t,e)=>({x:n.x+r+d*(e%c+.5),y:n.y+r+p*(Math.floor(e/c)+.5)}));ei(u,n,s,.5*r),o.forEach((e,i)=>t[e.id]=lo(u[i]))}}return t}_pos(t){const e=this._spaceModel(t.space),i=this._layout[t.id];if(i)if(this._norm){if(i.s===t.space)return{x:i.x*La,y:i.y*La}}else if(void 0===i.s)return{x:i.x,y:i.y};return this._defPos[t.id]?this._defPos[t.id]:lo(ko(e))}_savePos(t,e,i){if(this._norm){const s=this._gridPitch,o=Math.round(e/s)*s,n=Math.round(i/s)*s,r=this._layout[t.id]?.k;this._layout={...this._layout,[t.id]:{s:t.space,x:ho(o/La),y:ho(n/La),...r?{k:r}:{}}}}else this._layout={...this._layout,[t.id]:{x:Math.round(e),y:Math.round(i)}};this._dirtyPos.add(t.id),this._persistLayout()}_coverIndicator(t){return"cover"===t.tapAction?hi(t.entities):null}_actEntity(t){return this._coverIndicator(t)||t.primary}_displayOf(t){const e=t.marker?.display;return"ripple"===e?"icon_ripple":e||"badge"}_visualSamples(t){const e=[],i=this._coverIndicator(t),s=Ar(this.hass,[t]);if(i)e.push(i);else if(s.length)e.push(...s.map(t=>t.eid));else{const i=Cr(this.hass,t.entities);i.length?e.push(...i):t.primary&&e.push(t.primary)}for(const i of t.entities||[]){"alarm"!==yr(this.hass,i).status||e.includes(i)||e.push(i)}return e.map(t=>yr(this.hass,t))}_deviceVisual(t){if(t.hidden)return{availability:"available",status:"neutral",activity:"none"};const e=this._visualSamples(t),i=function(t){if(!t.length)return{availability:"available",status:"neutral",activity:"none"};const e=t.filter(t=>"available"===t.availability);if(!e.length)return{availability:"unavailable",status:"neutral",activity:"none"};if(e.some(t=>"alarm"===t.status))return lr;const i=e.some(t=>"working"===t.status)?"working":e.some(t=>"open"===t.status)?"open":"neutral",s=e.some(t=>"transition"===t.activity)?"transition":e.some(t=>"presence"===t.activity)?"presence":e.some(t=>"running"===t.activity)?"running":"none";return{availability:"available",status:i,activity:s}}(e);if("alarm"===i.status)return i;if(!this._config?.live_states)return{availability:"available",status:"neutral",activity:"none"};if("unavailable"===i.availability)return i;const s=this._activityRt.get(t.id),o=this._activitySourceKey(e);return s?.sources===o&&s.flashTs&&s.flashKind&&Date.now()-s.flashTs<Ha?{...i,activity:s.flashKind}:i}_stateClass(t,e=this._deviceVisual(t)){if(t.hidden)return"";const i=[];if("alarm"===e.status?i.push("alarm"):"unavailable"===e.availability?i.push("unavail"):"working"===e.status?i.push("on"):"open"===e.status&&i.push("open"),"icon_ripple"===this._displayOf(t)&&this._config?.live_states&&"alarm"!==e.status&&("none"!==e.activity&&i.push("activity-"+e.activity),"event"===e.activity)){const e=this._activityRt.get(t.id);e&&e.gen%2==0&&i.push("activity-gen2")}return i.join(" ")}_liveTemp(t){if(!this._config?.show_temperature)return null;if(!0===t.marker?.use_climate_temp){const e=Fr(this.hass,t.entities);if(null!=e)return e}return"mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon?null:Or(this.hass,t.entities)}_bindingEntities(t){if(t.startsWith("entity:"))return[t.slice(7)];if(!t.startsWith("device:"))return[];const e=t.slice(7);return Object.entries(this.hass?.entities||{}).filter(([,t])=>t?.device_id===e).map(([t])=>t)}_bindingHasClimate(t){return this._bindingEntities(t).some(t=>t.startsWith("climate."))}_bindingCoverEntity(t){return hi(this._bindingEntities(t))}_bindingCoverTap(t){const e=this._bindingCoverEntity(t);if(!e)return!1;const i=String(this.hass?.states?.[e]?.attributes?.device_class||"");return!ci.has(i)}_liveHum(t){return this._config?.show_temperature&&t.primary&&Ir(this.hass,t.primary)?Lr(this.hass,t.entities):null}_openMoreInfo(t){t?Ua(this,"hass-more-info",{entityId:t}):this._showToast(this._t("toast.no_entity"))}_ctxDevice(t,e){"view"===this._mode&&(t.preventDefault(),t.stopPropagation(),e.primary?this._openMoreInfo(e.primary):this._infoCard=e)}_clickDevice(t,e){if(t.stopPropagation(),this._drag?.moved||this._suppressClick||this._holdFired)return;if("plan"===this._mode)return;if("devices"===this._mode)return void this._openMarkerDialog(e);const i=this._coverIndicator(e),s=this._actEntity(e),o=s?s.split(".")[0]:null,n=(t,i)=>{e.marker?.tap_confirm?this._tapConfirm={text:t,exec:i}:i()},r=Ar(this.hass,[e]).filter(t=>"controls"===t.via).map(t=>t.eid);if("toggle"===e.tapAction&&r.length){const t=(a=r.map(t=>this.hass.states[t]?.state),a.some(t=>"on"===t)?"turn_off":"turn_on");return void n(this._t("confirm.tap_toggle",{name:e.name}),()=>{this.hass.callService("homeassistant",t,{entity_id:r}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))})}var a;const l=function(t,e,i,s){const o=t||e||("light"===i?"toggle":"info");return"more-info"===o?"more-info":"run"===o?"run"===t?"run":"info":"cover"===o?"cover"!==t||"cover"!==i||ci.has(String(s||""))?"info":"cover":"toggle"!==o||!i||li.has(i)?"info":"toggle"===t?"toggle":ai.has(i)?"cover"===i&&ci.has(String(s||""))?"info":"toggle":"info"}(e.tapAction,void 0,o,s?this.hass.states[s]?.attributes?.device_class:null);if("run"===l){const t=e.marker?.tap_target||"",i=function(t){const e=String(t||"").split(".")[0];return"automation"===e?{domain:"automation",service:"trigger"}:"script"===e?{domain:"script",service:"turn_on"}:"scene"===e?{domain:"scene",service:"turn_on"}:null}(t),s=this.hass.states[t];if(!i||!s)return void this._showToast(this._t("toast.run_target_missing"));const o=s.attributes?.friendly_name||t;return void n(this._t("confirm.tap_run",{name:o}),()=>{this.hass.callService(i.domain,i.service,{entity_id:t}).then(()=>{this._stampActivity(e.id,"event",this._activitySourceKey(this._visualSamples(e))),this.requestUpdate(),this._showToast(this._t("toast.run_started",{name:o}))}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))})}if("cover"===l&&i){const t=function(t){const e=String(t||"");return"closed"===e?"open_cover":"open"===e?"close_cover":"opening"===e||"closing"===e?"stop_cover":"toggle"}(this.hass.states[i]?.state);return void n(this._t("confirm.tap_cover",{name:e.name}),()=>{this.hass.callService("cover",t,{entity_id:i}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))})}"toggle"===l&&e.primary?n(this._t("confirm.tap_toggle",{name:e.name}),()=>{this.hass.callService("homeassistant","toggle",{entity_id:e.primary}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))}):"more-info"===l&&e.primary?this._openMoreInfo(e.primary):this._infoCard=e}_t(t,e){return Zr(Jr(this.hass,this._config?.language),t,e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_contentItems(t){const e=[];for(const i of this._devices){if(i.space!==t.id||i.hidden)continue;const s=this._pos(i);e.push({minX:s.x,minY:s.y,maxX:s.x,maxY:s.y})}if(t.id===this._space){for(const t of this._openingsR){const i=Number(t.angle)*Math.PI/180,s=Math.cos(i)*t.rlen/2,o=Math.sin(i)*t.rlen/2,n=_o([[t.rx-s,t.ry-o],[t.rx+s,t.ry+o]]);n&&e.push(n)}const t=this._decorH;for(const i of this._decorList){const s=_o("line"===i.kind?[[i.x1*La,i.y1*t],[i.x2*La,i.y2*t]]:"text"===i.kind?[[i.x*La,i.y*t]]:js({x:i.x*La,y:i.y*t,w:i.w*La,h:i.h*t,angle:i.angle}));s&&e.push(s)}}return go(t,e)}_frameOf(){const t=this._spaceModel(),e=this._frame,i="view"!==this._mode;if(e&&e.id===t.id&&this._bdDrag)return e;if(e&&e.id===t.id&&e.model===t&&e.layout===this._layout&&e.devs===this._devices&&e.far===this._showFar&&e.grow===i)return e;const s=yo(this._contentItems(t));let o=s.all||wo(t),n=this._showFar?o:s.core||wo(t);return e&&e.id===t.id&&i&&e.grow&&(n=qa(e.rect,n),o=qa(e.all,o)),this._frame={id:t.id,model:t,layout:this._layout,devs:this._devices,far:this._showFar,grow:i,rect:n,all:o,outliers:s.outliers},this._frame}_baseVb(){const t=this._frameOf().rect;return[t.x,t.y,t.w,t.h]}get _outliers(){return this._showFar?0:this._frameOf().outliers}_fitFar(){this._showFar=!0,this._frame=null,this._resetZoom()}_fitAll(){this._resetZoom()}_renderFarHint(){return this._kiosk||"view"!==this._mode||this._booting||!this._outliers?V:W`<div class="farhint">
      <ha-icon icon="mdi:map-marker-alert-outline"></ha-icon>
      <span>${this._t("canvas.far_objects",{n:this._outliers})}</span>
      <button class="btn ghostbtn" @click=${()=>this._fitFar()}>${this._t("canvas.show_far")}</button>
    </div>`}_renderHomeArrow(){if(this._booting)return V;const t=this._view;if(!t||!t.w||!t.h)return V;const e=this._frameOf().rect;if(!(e.x+e.w<=t.x||e.x>=t.x+t.w||e.y+e.h<=t.y||e.y>=t.y+t.h))return V;const i=Math.atan2(e.y+e.h/2-(t.y+t.h/2),e.x+e.w/2-(t.x+t.w/2)),s=50+38*Math.cos(i),o=50+38*Math.sin(i);return W`<button class="homearrow" title=${this._t("canvas.home_tip")}
      style="left:${s.toFixed(1)}%;top:${o.toFixed(1)}%"
      @click=${t=>{t.stopPropagation(),this._fitAll()}}>
      <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${(180*i/Math.PI).toFixed(1)}deg)"></ha-icon>
    </button>`}_stageAspect(){const t=this._stageEl,e=this._baseVb();return t&&t.clientHeight?t.clientWidth/t.clientHeight:e[2]/e[3]}_viewOr(t){return this._view&&this._view.w?this._view:ti(t,this._stageAspect())}_screenToVb(t,e){const i=this._stageEl,s=this._viewOr(this._baseVb()),o=i?.clientWidth||1,n=i?.clientHeight||1;return[s.x+t/o*s.w,s.y+e/n*s.h]}_clampView(t,e){const i=(t,e,i,s)=>{const o=1*Math.max(e,s),n=i-o,r=i+s-e+o;return Math.max(Math.min(n,r),Math.min(Math.max(n,r),t))};return{w:t.w,h:t.h,x:i(t.x,t.w,e.x,e.w),y:i(t.y,t.h,e.y,e.h)}}_applyView(t,e,i){const s=this._baseVb(),o=ti(s,this._stageAspect()),n=Math.min(ja.ZOOM_MAX,Math.max(ja.ZOOM_MIN,t)),r=o.w/n,a=o.h/n,l=this._viewOr(s),c=e??l.x+l.w/2,h=i??l.y+l.h/2;this._zoom=n,this._view=this._clampView({x:c-r/2,y:h-a/2,w:r,h:a},o)}_bootWatch(){clearTimeout(this._bootTimer),this._bootStart=Date.now(),this._bootLastH=-1,this._bootLastChange=this._bootStart;const t=()=>{if(!this._booting)return;const e=Date.now(),i=this._stageEl?this._stageEl.clientHeight:0;i!==this._bootLastH&&(this._bootLastH=i,this._bootLastChange=e);const s=e-this._bootStart;s>=1200||s>=700&&i>0&&e-this._bootLastChange>=250?this._bootSettled():this._bootTimer=window.setTimeout(t,100)};this._bootTimer=window.setTimeout(t,100)}_bootSettled(){if(!this._booting)return;this._refitView(),this._booting=!1;const t=this._stageEl?.clientHeight??0;!this._config?.kiosk&&t>0&&this._warmPatch({hdrH:this._hdrH,stageH:t,vp:this._warmViewportState()},!0),this._bootFading=!0,this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220),this._bootSoft=!0,clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},Ma)}_bootSoftCancel(){this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoft=!1)}_beginResumeSettle(){this._kiosk||"view"!==this._mode||this._booting||this._resumeSettling||(this._resumeSettling=!0,this._resumeStarted=performance.now(),this._resumeLastSize="",this._resumeLastChange=this._resumeStarted,this._viewportInvalidAt=0,this.requestUpdate(),this._resumeRaf&&cancelAnimationFrame(this._resumeRaf),this._resumeRaf=requestAnimationFrame(()=>this._resumeSettleTick()))}_resumeSettleTick(){if(this._resumeRaf=0,!this._resumeSettling||!this.isConnected)return;if(this._kiosk||"view"!==this._mode)return this._resumeSettling=!1,void this.requestUpdate();const t=performance.now(),e=this._stageEl,i=!!e&&e.clientWidth>0&&e.clientHeight>0;if(i){const i=`${e.clientWidth}x${e.clientHeight}`;i!==this._resumeLastSize&&(this._resumeLastSize=i,this._resumeLastChange=t)}const s=t-this._resumeStarted;if(i&&s>=220&&t-this._resumeLastChange>=80||s>=750){const t=this._view;return this._resumeSettling=!1,i&&this._applyView(this._zoom,t?t.x+t.w/2:void 0,t?t.y+t.h/2:void 0),void this.requestUpdate()}this._resumeRaf=requestAnimationFrame(()=>this._resumeSettleTick())}_refitView(){const t=this._stageEl;if(!t||"visible"!==document.visibilityState||t.clientWidth<=0||t.clientHeight<=0)return void(this._viewportInvalidAt||(this._viewportInvalidAt=Date.now()));if(this._viewportInvalidAt){const t=Date.now()-this._viewportInvalidAt;if(this._viewportInvalidAt=0,t>=Ca&&!this._resumeSettling&&(this._beginResumeSettle(),this._resumeSettling))return}if(this._resumeSettling)return;const e=this._view;this._applyView(this._zoom,e?e.x+e.w/2:void 0,e?e.y+e.h/2:void 0),this.requestUpdate()}_zoomAt(t,e,i){const s=this._stageEl;if(!s)return;const o=ti(this._baseVb(),this._stageAspect()),n=Math.min(ja.ZOOM_MAX,Math.max(ja.ZOOM_MIN,i)),r=s.clientWidth,a=s.clientHeight,l=this._screenToVb(t,e),c=o.w/n,h=o.h/n;this._zoom=n,this._view=this._clampView({x:l[0]-t/r*c,y:l[1]-e/a*h,w:c,h:h},o)}_onWheel(t){const e=this._stageEl;if(!e)return;t.preventDefault();const i=e.getBoundingClientRect(),s=t.deltaY<0?1.15:1/1.15;this._zoomAt(t.clientX-i.left,t.clientY-i.top,this._zoom*s),this._saveZoom()}_stepZoom(t){const e=this._stageEl;e&&(this._zoomAt(e.clientWidth/2,e.clientHeight/2,this._zoom*(t>0?1.4:1/1.4)),this._saveZoom())}_resetZoom(){const t=this._baseVb();this._zoom=1,this._view=ti(t,this._stageAspect()),this._saveZoom()}_saveZoom(){if("view"===this._mode){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(Oa,JSON.stringify(this._zoomBySpace))}catch{}}}_restoreZoom(){const t=this._zoomBySpace[this._space]||1;this._zoom=t;const e=this._stageEl;if(e&&e.clientHeight){const e=this._baseVb();return this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),void this.requestUpdate()}this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const e=this._baseVb();this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),this.requestUpdate()})}_stagePointerDown(t){if(this._vacFit)return;if(this._kiosk&&(this._cyclePausedUntil=Date.now()+6e4,0===this._pointers.size?(this._swipeStart={x:t.clientX,y:t.clientY,id:t.pointerId},t.target.closest?.(".dev, .roomlabel, .oplock")||(clearTimeout(this._kioskHoldTimer),this._kioskHoldTimer=window.setTimeout(()=>{this._kioskDialog=!0,this._swipeStart=null},3e3))):(this._swipeStart=null,clearTimeout(this._kioskHoldTimer))),this._drag)return;if(this._markup&&t.target.closest?.(".roomlabel, .rlhandle, .rszhandle, .dev, .oplock, .op-hit, button"))return;if("devices"===this._mode&&t.target.closest(".dev"))return;if("decor"===this._mode&&this._decorPointerDown(t))return;this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=this._viewOr(this._baseVb());if(1===this._pointers.size)this._panStart={sx:t.clientX,sy:t.clientY,vx:e.x,vy:e.y},this._panLock=null,this._suppressClick=!1;else if(2===this._pointers.size){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y);this._pinchStart={dist:e,zoom:this._zoom},this._panStart=null,this._panLock=null}}get _swipeZone(){return this._kiosk&&this._zoom<=1.001&&this._model.length>1}_stagePointerMove(t){if(this._dtDrag?.pid!==t.pointerId)if(this._bdDrag?.pid!==t.pointerId){if(this._decorDraft?.pid===t.pointerId){const e=this._decorDraft;let i=this._decorSnap(this._svgPoint(t),t.pointerType);if(t.shiftKey&&("rect"===e.kind||"ellipse"===e.kind)){const t=i[0]-e.a[0],s=i[1]-e.a[1],o=Math.max(Math.abs(t),Math.abs(s));i=this._snap([e.a[0]+(t<0?-o:o),e.a[1]+(s<0?-o:o)])}return void(this._decorDraft={...e,b:i})}if(this._decorMove?.pid!==t.pointerId)if(this._pointers.has(t.pointerId)){if(this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this._markup&&1===this._pointers.size&&this._markupMove(t),this._pinchStart&&this._pointers.size>=2){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),s=(t[0].x+t[1].x)/2-i.left,o=(t[0].y+t[1].y)/2-i.top;this._zoomAt(s,o,this._pinchStart.zoom*e),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const e=t.clientX-this._panStart.sx,i=t.clientY-this._panStart.sy;Math.abs(e)+Math.abs(i)>4&&(this._suppressClick=!0,clearTimeout(this._holdTimer)),null===this._panLock&&Math.abs(e)+Math.abs(i)>8&&(this._panLock=this._swipeZone&&Math.abs(e)>1.5*Math.abs(i)?"swipe":"pan");const s=this._stageEl;if("pan"===this._panLock&&s){const t=this._baseVb(),o=this._viewOr(t),n=ti(t,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-e/(s.clientWidth||1)*o.w,y:this._panStart.vy-i/(s.clientHeight||1)*o.h,w:o.w,h:o.h},n)}}}else this._markupMove(t);else this._decorMoveUpdate(t)}else this._bdMove(t);else this._dtMove(t)}_stagePointerUp(t){if(this._kiosk){clearTimeout(this._kioskHoldTimer);const e=this._swipeStart;if(this._swipeStart=null,e&&e.id===t.pointerId){const i=t.clientX-e.x,s=t.clientY-e.y;if(Math.abs(i)+Math.abs(s)<8){const t=Date.now();t-this._lastTap<350&&this._resetZoom(),this._lastTap=t}const o="pan"===this._panLock?null:function(t,e,i,s,o,n=60){if(i>1.001||s.length<2)return null;if(Math.abs(t)<n||Math.abs(t)<1.5*Math.abs(e))return null;const r=s.indexOf(o);if(r<0)return null;const a=s.length;return t<0?s[(r+1)%a]:s[(r-1+a)%a]}(i,s,this._zoom,this._model.map(t=>t.id),this._space);o&&(this._slideTo(o,i<0?"left":"right"),this._saveNav(),this._suppressClick=!0,setTimeout(()=>this._suppressClick=!1,0),this._showKioskDots())}}if(this._dtDrag?.pid!==t.pointerId)if(this._bdDrag?.pid!==t.pointerId)if(this._decorDraft?.pid!==t.pointerId){if(this._decorMove?.pid===t.pointerId)return this._decorMove.moved&&(this._recordGeometry(this._t("history.decor_move"),this._decorMove.before),this._saveConfig()),void(this._decorMove=null);this._pointers.delete(t.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,this._panLock=null,setTimeout(()=>this._suppressClick=!1,0))}else this._decorCommitDraft();else this._bdUp();else this._dtUp()}_clickRoom(t){var e;!this._suppressClick&&t.area&&(e="/config/areas/area/"+t.area,history.pushState(null,"",e),Ua(window,"location-changed",{replace:!1}))}_pointerDown(t,e){if("plan"===this._mode)return;if("view"===this._mode)return this._holdFired=!1,clearTimeout(this._holdTimer),void(this._holdTimer=window.setTimeout(()=>{this._holdFired=!0,this._infoCard=e},600));t.preventDefault();const i=this._pos(e);this._drag={id:e.id,sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},Ba(t),this._tip=null}_pointerMove(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const s=this._baseVb(),o=i.getBoundingClientRect(),n=this._viewOr(s),r=(t.clientX-this._drag.sx)/o.width*n.w,a=(t.clientY-this._drag.sy)/o.height*n.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0,clearTimeout(this._holdTimer));const l=co(this._drag.ox+r),c=co(this._drag.oy+a);this._savePos(e,l,c)}_pointerUp(t,e){if(clearTimeout(this._holdTimer),!this._drag||this._drag.id!==e.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=e.id,window.setTimeout(()=>this._drag=null,0))}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}get _noHover(){return ja._noHoverMq||ja._touchSeen}_notePointer(t){"touch"!==t.pointerType&&"pen"!==t.pointerType||(ja._touchSeen=!0,this._tip&&(this._tip=null))}_showTip(t,e,i,s,o){this._noHover||this._drag||(this._tip={x:t.clientX,y:t.clientY,title:e,meta:i,lqi:s,temp:o})}get _gridPitch(){return no}get _cellCm(){const t=Number(this._curSpaceCfg?.cell_cm);return Number.isFinite(t)&&t>0?t:5}_fmtLen(t,e){const i=function(t,e,i,s){return Math.hypot(e[0]-t[0],e[1]-t[1])/i*s}(t,e,this._gridPitch,this._cellCm);return Ce(i,"mi"===this.hass?.config?.unit_system?.length)}get _curSpaceCfg(){const t=this._rszPreview;return t&&t.space===this._space?t.sp:this._serverCfg?.spaces.find(t=>t.id===this._space)}get _renderCfg(){const t=this._rszPreview;return t&&this._serverCfg?{...this._serverCfg,spaces:this._serverCfg.spaces.map(e=>e.id===t.space?t.sp:e)}:this._serverCfg}get _spaceH(){return this._curSpaceCfg,La}get _segments(){const t=this._curSpaceCfg,e=this._spaceH;return Pe(t?.rooms||[]).map(t=>[t[0]*La,t[1]*e,t[2]*La,t[3]*e])}_savedNav(){try{return JSON.parse(localStorage.getItem(Fa)||"null")}catch{return null}}_saveNav(){try{localStorage.setItem(Fa,JSON.stringify({space:this._space,mode:this._mode}))}catch{}}_setMode(t){if(this._kiosk&&"view"!==t)return;if(this._mode===t)return;if(this._bootSoftCancel(),("plan"===t||"decor"===t)&&!this._norm)return void this._showToast(this._t("toast.markup_needs_server"));const e=this._mode;(this._decorMove||this._dtDrag||this._bdDrag)&&this._cancelDecorGesture();const i=!this._spaceModel().bg&&"view"===t!=("view"===this._mode);if("view"===this._mode&&"view"!==t){const t=this._view;this._viewModeSnap={space:this._space,zoom:this._zoom,cx:t?t.x+t.w/2:void 0,cy:t?t.y+t.h/2:void 0}}if(this._mode=t,this._editorChromeMode="view"===t?e:t,this._startNavMotion("view"===e?"enter":"view"===t?"exit":"swap"),i&&(this._zoom=1,this._view=null),"view"===t){const t=this._viewModeSnap;this._viewModeSnap=null,t&&t.space===this._space?(this._zoom=t.zoom,this._view=null,requestAnimationFrame(()=>{this._stageEl&&"view"===this._mode&&this._space===t.space&&(this._applyView(t.zoom,t.cx,t.cy),this._saveZoom(),this.requestUpdate())})):t&&this._restoreZoom()}this._path=[],this._cursorPt=null,this._tool="draw",this._mergeSel=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._selId=null,this._rszSel=null,this._rszDrag=null,this._rszLive=null,this._rszPreview=null,this._tip=null,this._hoverRoom=null,this._decorDraft=null,this._decorSel=null,this._decorMove=null,this._backdropDialog=null,this._decorTool="select",this._bdDrag=null,this._dtDrag=null,this._dtBox=null,"plan"===t&&this._primeDrawWallField(),this._saveNav()}_primeDrawWallField(){null===this._drawWallField&&(this._drawWallField=Wo(15,this._imperial))}get _drawWallFieldValue(){return null===this._drawWallField?Wo(15,this._imperial):this._drawWallField}get _drawWallCm(){return Bo(this._drawWallFieldValue,this._imperial)}_svgPoint(t){const e=this.renderRoot.querySelector(".stage").getBoundingClientRect();return this._screenToVb(t.clientX-e.left,t.clientY-e.top)}_snap(t){const e=this._gridPitch;return[co(Me(t[0],e)),co(Me(t[1],e))]}_samePt(t,e){return Ee(t,e)}_dropLegacySegments(){for(const t of this._serverCfg?.markers||[])"ripple"===t.display&&(t.display="icon_ripple");for(const t of this._serverCfg?.spaces||[])if(delete t.segments,Array.isArray(t.walls)){const e=Nn(t.open_spans).map(t=>[t.a[0],t.a[1],t.b[0],t.b[1]]);t.walls=on(t.walls,t.rooms||[],ro,1,e),t.walls.length||delete t.walls}}get _cfgWriting(){return this._writesPending>0}_writeConfig(){this._writesPending++,this._writeChain=this._writeChain.catch(()=>{}).then(async()=>{if(!this._serverCfg)return;this._dropLegacySegments();const t=await this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev});this._cfgRev=t?.rev??this._cfgRev+1});return this._writeChain.finally(()=>{this._writesPending--})}_saveConfig(){this._cfgEpoch++,this._saveConfigDebounced()}_geometrySnapshot(t=this._space){const e=this._serverCfg?.spaces.find(e=>e.id===t);if(!e)return null;const i=t=>JSON.parse(JSON.stringify(t)),s={};for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])void 0!==e[t]&&(s[t]=e[t]);return{spaceId:t,rooms:i(e.rooms||[]),...Array.isArray(e.openings)?{openings:i(e.openings)}:{},...Array.isArray(e.walls)?{walls:i(e.walls)}:{},...Array.isArray(e.open_spans)?{open_spans:i(e.open_spans)}:{},...Array.isArray(e.decor)?{decor:i(e.decor)}:{},plan_transform:s}}_recordGeometry(t,e){if(!e)return;const i=this._geometrySnapshot(e.spaceId);i&&JSON.stringify(e)!==JSON.stringify(i)&&(this._geometryHistory.push({name:t,before:e,after:i}),this.requestUpdate())}_clearGeometryGesture(){this._path=[],this._cursorPt=null,this._mergeSel=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._openWallAnchor=null,this._wallDialog=null,this._openingDialog=null,this._rszSel=null,this._rszDrag=null,this._rszPreview=null,this._rszLive=null,this._decorDraft=null,this._decorMove=null,this._dtDrag=null,this._bdDrag=null}_stagePointerCancel(t){if(clearTimeout(this._kioskHoldTimer),this._swipeStart?.id===t.pointerId&&(this._swipeStart=null),this._decorDraft?.pid===t.pointerId)return this._decorDraft=null,void this.requestUpdate();this._decorMove?.pid!==t.pointerId&&this._dtDrag?.pid!==t.pointerId&&this._bdDrag?.pid!==t.pointerId?(this._pointers.delete(t.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,this._panLock=null)):this._cancelDecorGesture()}_applyGeometryState(t){const e=this._serverCfg?.spaces.find(e=>e.id===t.spaceId);if(!e)return!1;const i=t=>JSON.parse(JSON.stringify(t));e.rooms=i(t.rooms),void 0!==t.openings?e.openings=i(t.openings):delete e.openings,void 0!==t.walls?e.walls=i(t.walls):delete e.walls,void 0!==t.open_spans?e.open_spans=i(t.open_spans):delete e.open_spans,void 0!==t.decor?e.decor=i(t.decor):delete e.decor;for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])delete e[t];return Object.assign(e,i(t.plan_transform||{})),this._clearGeometryGesture(),this._space!==t.spaceId&&(this._space=t.spaceId,this._saveNav(),this._restoreZoom()),this._modelCache=null,this._frame=null,this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate(),!0}_roomAt(t){return this._spaceModel().rooms.find(e=>{const i=ze(e);return!!i&&He(t,i)})}_overlapRoom(t){return this._spaceModel().rooms.find(e=>{const i=ze(e);return!!i&&Ge(t,i)})}_pointInRoom(t,e){return e.poly?Oe(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_contourSelfIntersects(t){if(!hs(t))return!0;const e=t.length,i=.001;for(let s=0;s<e;s++){const o=t[s],n=t[(s+1)%e];for(let r=s+1;r<e;r++){if(r===s+1||0===s&&r===e-1)continue;const a=t[r],l=t[(r+1)%e],c=[a[0],a[1],l[0],l[1]],h=[o[0],o[1],n[0],n[1]];if(Zi(o,c)<=i||Zi(n,c)<=i||Zi(a,h)<=i||Zi(l,h)<=i)return!0}}return!1}_closeRoomContour(t=!1){if(this._path.length<3)return void(t&&this._showToast(this._t("toast.contour_min_edges")));if(this._contourSelfIntersects(this._path)||Ye(this._path)<=1e-6)return void this._showToast(this._t("toast.contour_cannot_close"));const e=this._overlapRoom(this._path);e?this._showToast(this._t("toast.room_overlap",{name:e.name||""})):(this._path=[...this._path,[...this._path[0]]],this._cursorPt=null,this._nameSel="",this._areaSel="",this._resetRoomDialogFields(),this._roomDialog=!0)}_markupClick(t){if(this._vacFit)return;if(!this._markup)return;if(this._suppressClick)return;if(this._drag||this._rlResize)return;const e=t.composedPath?.()||[];if(e.some(t=>t?.classList?.contains?.("roomlabel")||t?.classList?.contains?.("rlhandle")))return;const i=this._svgPoint(t);if("resize"===this._tool){if(this._rszDrag||e.some(t=>t?.classList?.contains?.("rszhandle")))return;const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(i,t));return void(this._rszSel=t?.id||null)}if("delroom"===this._tool)return void this._deleteRoomClick(i);if("opening"===this._tool)return void this._openingClick(i);if("merge"===this._tool)return void this._mergeClick(i);if("wallthick"===this._tool)return void this._wallThickClick(i);if("openwall"===this._tool)return void this._openWallClick(i);if("closewall"===this._tool)return void this._closeWallClick(i);if("split"===this._tool)return void this._splitClick(i);const s=this._snap(i);if(t.ctrlKey||t.metaKey)return t.preventDefault(),void this._closeRoomContour(!0);const o=this._path.length>=3&&this._samePt(s,this._path[0]);if(!this._path.length)return void(this._path=[s]);const n=this._path[this._path.length-1];this._samePt(s,n)||(o?this._closeRoomContour():this._path=[...this._path,s])}_rszRooms(){const t=[];for(const e of this._spaceModel().rooms){const i=e.id?ze(e):null;i&&t.push({id:e.id,poly:i})}return t}_rszOpenings(){return this._openingsR.map(t=>({id:t.id,x:t.rx,y:t.ry,length:t.rlen}))}_rszOpts(){return{minDim:this._cmToUnits(30),eps:.05*this._gridPitch}}_rszSnapshot(){return JSON.stringify(this._geometrySnapshot()||{spaceId:this._space,rooms:[],openings:[],walls:[],open_spans:[]})}_rszApplyPreview(t,e){const i=this._rszDrag,s=this._serverCfg?.spaces.find(t=>t.id===this._space);if(!i||!s)return;const o=JSON.parse(i.snap),n={...s,rooms:o.rooms,openings:o.openings,walls:o.walls,open_spans:o.open_spans};Array.isArray(o.open_spans)&&o.open_spans.length||delete n.open_spans;const r=this._spaceH;for(const[e,i]of Object.entries(t)){const t=n.rooms.find(t=>t.id===e);t&&(t.poly=i.map(t=>[t[0]/La,t[1]/r]),delete t.x,delete t.y,delete t.w,delete t.h)}for(const[t,i]of Object.entries(e)){const e=(n.openings||[]).find(e=>e.id===t);e&&(e.x=i[0]/La,e.y=i[1]/r)}const a=[],l=[];for(const t of i.changed){const e=i.rooms.find(e=>e.id===t),s=n.rooms.find(e=>e.id===t);if(!e||!s?.poly)continue;const o=s.poly.map(t=>[t[0]*La,t[1]*r]);if(e.poly.length===o.length)for(let t=0;t<e.poly.length;t++)a.push([e.poly[t],e.poly[(t+1)%e.poly.length]]),l.push([o[t],o[(t+1)%o.length]])}if(a.length){const t=Gn(Nn(n.open_spans),a,l,La);t.length?n.open_spans=t:delete n.open_spans,Array.isArray(n.walls)&&n.walls.length&&(n.walls=rn(n.walls,a,l,this._wallKeyPitch,La))}this._rszPreview={space:this._space,sp:n},this._cfgEpoch++}_rszEdgeDown(t,e,i){if("resize"!==this._tool||this._rszDrag)return;t.stopPropagation(),t.preventDefault(),Ba(t);const s=this._rszRooms(),o=function(t,e,i){const s=t.find(t=>t.id===e);if(!s||!s.poly||s.poly.length<3)return null;if(i<0||i>=s.poly.length)return null;const o=[...s.poly[i]],n=[...s.poly[(i+1)%s.poly.length]];return{roomId:e,edge:i,a:o,b:n,n:ns(s.poly,i)}}(s,e,i);o&&(this._rszDrag={kind:"edge",pid:t.pointerId,roomId:e,plan:o,rooms:s,openings:this._rszOpenings(),snap:this._rszSnapshot(),moved:!1,d:0,k:1,changed:[]})}_rszCornerDown(t,e,i,s){"resize"!==this._tool||this._rszDrag||(t.stopPropagation(),t.preventDefault(),Ba(t),this._rszDrag={kind:"scale",pid:t.pointerId,roomId:e,fixed:s,span0:Math.hypot(i[0]-s[0],i[1]-s[1])||1,rooms:this._rszRooms(),openings:this._rszOpenings(),snap:this._rszSnapshot(),moved:!1,d:0,k:1,changed:[]})}_rszMove(t){const e=this._rszDrag;if(!e||e.pid!==t.pointerId)return;t.stopPropagation();const i=this._svgPoint(t);if("edge"===e.kind){const t=e.plan,s=(i[0]-t.a[0])*t.n[0]+(i[1]-t.a[1])*t.n[1],o=this._snap([t.a[0]+t.n[0]*s,t.a[1]+t.n[1]*s]);let n=(o[0]-t.a[0])*t.n[0]+(o[1]-t.a[1])*t.n[1];if(n=function(t,e,i,s,o,n){if(!Number.isFinite(s)||Math.abs(s)<1e-9)return 0;const r=Math.sign(s);let a=Math.abs(s);const l=Math.max(o,1e-6);for(let s=0;s<4096&&a>1e-9;s++,a-=l){const s=r*a;if(gs(t,e,i,s,n))return s}return 0}(e.rooms,e.openings,t,n,this._gridPitch,this._rszOpts()),n===e.d&&e.moved)return;e.d=n,e.moved=!0;const r=us(e.rooms,e.openings,t,n,this._rszOpts().eps);e.changed=Object.keys(r.polys),this._rszApplyPreview(r.polys,r.openings),this._rszLive=this._rszEdgeLabels(r,t)}else{const t=e.fixed,s=this._snap(i);let o=Math.hypot(s[0]-t[0],s[1]-t[1])/(e.span0||1);if(o=Math.max(.05,Math.min(20,o)),o=function(t,e,i,s,o,n){if(!Number.isFinite(o)||o<=0)return 1;if(vs(t,e,i,s,o,n))return o;let r=1,a=o;for(let o=0;o<28;o++){const o=(r+a)/2;vs(t,e,i,s,o,n)?r=o:a=o}return r}(e.rooms,e.openings,e.roomId,t,o,this._rszOpts()),o===e.k&&e.moved)return;e.k=o,e.moved=!0;const n=e.rooms.find(t=>t.id===e.roomId),r=e.rooms.filter(t=>t.id!==e.roomId).map(t=>t.poly),a=fs(n,e.openings,r,t,o,2*this._rszOpts().eps);e.changed=[e.roomId],this._rszApplyPreview({[e.roomId]:a.poly},a.openings),this._rszLive=this._rszScaleLabels(a.poly)}this.requestUpdate()}_rszUp(t){const e=this._rszDrag;if(!e||e.pid!==t.pointerId)return;t.stopPropagation();const i=this._rszPreview;this._rszDrag=null,this._rszLive=null,this._rszPreview=null;if(!(e.moved&&("edge"===e.kind?Math.abs(e.d)>1e-9:Math.abs(e.k-1)>1e-9))||!i)return this._cfgEpoch++,void this.requestUpdate();const s=JSON.parse(e.snap),o=this._curSpaceCfg;if(o){o.rooms=i.sp.rooms,o.openings=i.sp.openings,Array.isArray(i.sp.walls)&&(i.sp.walls.length?o.walls=i.sp.walls:delete o.walls),Array.isArray(i.sp.open_spans)&&i.sp.open_spans.length?o.open_spans=i.sp.open_spans:delete o.open_spans;for(const t of e.changed){const e=o.rooms.find(e=>e.id===t);e?.poly&&(e.poly=cs(e.poly,1e-9))}this._commitOpenSpans(),Array.isArray(o.walls)&&o.walls.length&&(o.walls=on(o.walls,o.rooms||[],ro,1,this._cfgOpenCuts()),o.walls.length||delete o.walls)}this._suppressClick=!0,setTimeout(()=>this._suppressClick=!1,0),this._recordGeometry(this._t("history.resize_room"),s),this._saveConfig(),this.requestUpdate()}_rszCancelDrag(){this._rszDrag&&(this._rszDrag=null,this._rszLive=null,this._rszPreview=null,this._cfgEpoch++,this.requestUpdate())}_rszPointerCancel(t){const e=this._rszDrag;e&&e.pid===t.pointerId&&(t.stopPropagation(),this._rszCancelDrag())}_rszEdgeLabels(t,e){const i=this._rszDrag,s=[],o=t.polys[e.roomId]||i.rooms.find(t=>t.id===e.roomId).poly,n=o.length,r=e.edge,a=(r+1)%n;for(const[t,e]of[[o[(r-1+n)%n],o[r]],[o[r],o[a]],[o[a],o[(a+1)%n]]])s.push({x:(t[0]+e[0])/2,y:(t[1]+e[1])/2,text:this._fmtLen(t,e)});const l="mi"===this.hass?.config?.unit_system?.length,c=Object.keys(t.polys).length?Object.keys(t.polys):[e.roomId],h=this._spaceWalls,d=this._openPairs().flatMap(t=>t.segs);for(const e of c){const o=t.polys[e]||i.rooms.find(t=>t.id===e).poly,n=h.length&&Sn(Object.entries(t.polys).map(([t,e])=>({id:t,poly:e})),e,h,d,this._wallKeyPitch,this._cellCm,this._gridPitch,La)||o,r=We(n);s.push({x:r[0],y:r[1],text:ys(bs(n,this._gridPitch,this._cellCm),l),area:!0})}return s}_rszScaleLabels(t){const e="mi"===this.hass?.config?.unit_system?.length,i=t.map(t=>t[0]),s=t.map(t=>t[1]),o=Math.max(...i)-Math.min(...i),n=Math.max(...s)-Math.min(...s),r=this._spaceWalls,a=r.length&&this._rszSel&&Sn([{id:this._rszSel,poly:t}],this._rszSel,r,[],this._wallKeyPitch,this._cellCm,this._gridPitch,La)||t,l=We(a);return[{x:Math.min(...i),y:Math.min(...s),text:`${this._fmtLen([0,0],[o,0])} × ${this._fmtLen([0,0],[n,0])}`},{x:l[0],y:l[1],text:ys(bs(a,this._gridPitch,this._cellCm),e),area:!0}]}_renderResizeLayer(t){const e=Math.max(.013*t.w,5),i=e/2,s=t=>t.toFixed(1),o=`M ${s(-.7*i)} 0 H ${s(.7*i)} M 0 ${s(-.22*i)} V ${s(-i)} M ${s(-.32*i)} ${s(-.6*i)} L 0 ${s(-i)} L ${s(.32*i)} ${s(-.6*i)} M 0 ${s(.22*i)} V ${s(i)} M ${s(-.32*i)} ${s(.6*i)} L 0 ${s(i)} L ${s(.32*i)} ${s(.6*i)}`,n=[],r=this._rszRooms();for(const t of r)for(let i=0;i<t.poly.length;i++){const r=t.poly[i],a=t.poly[(i+1)%t.poly.length];if(Math.hypot(a[0]-r[0],a[1]-r[1])<this._gridPitch)continue;const l=s((r[0]+a[0])/2),c=s((r[1]+a[1])/2),h=s(180*Math.atan2(a[1]-r[1],a[0]-r[0])/Math.PI);n.push(B`<circle class="rszhandle" cx="${l}" cy="${c}" r="${s(e)}"
          @pointerdown=${e=>this._rszEdgeDown(e,t.id,i)}
          @pointermove=${t=>this._rszMove(t)}
          @pointerup=${t=>this._rszUp(t)}
          @pointercancel=${t=>this._rszPointerCancel(t)}
          @lostpointercapture=${t=>this._rszPointerCancel(t)}></circle>`),n.push(B`<g class="rszicon" transform="translate(${l} ${c}) rotate(${h})"><path class="rszhalo" d="${o}"></path><path class="rszink" d="${o}"></path></g>`)}const a=this._rszSel?r.find(t=>t.id===this._rszSel):null;if(a){const t=a.poly.map(t=>t[0]),i=a.poly.map(t=>t[1]),s=Math.min(...t),o=Math.max(...t),r=Math.min(...i),l=Math.max(...i);n.push(B`<rect class="rszframe" x="${s}" y="${r}" width="${o-s}" height="${l-r}"></rect>`);for(const[t,i,c,h]of[[s,r,o,l],[o,r,s,l],[o,l,s,r],[s,l,o,r]])n.push(B`<circle class="rszhandle rszcorner" cx="${t}" cy="${i}" r="${(1.15*e).toFixed(1)}"
          @pointerdown=${e=>this._rszCornerDown(e,a.id,[t,i],[c,h])}
          @pointermove=${t=>this._rszMove(t)}
          @pointerup=${t=>this._rszUp(t)}
          @pointercancel=${t=>this._rszPointerCancel(t)}
          @lostpointercapture=${t=>this._rszPointerCancel(t)}></circle>`),n.push(B`<circle class="rszknob" cx="${t}" cy="${i}" r="${(1.15*e/4).toFixed(2)}"></circle>`)}return B`${n}`}get _openingsR(){const t=this._curSpaceCfg,e=this._spaceH;return(t?.openings||[]).map(t=>({...t,rx:t.x*La,ry:t.y*e,rlen:t.length*La}))}_cmToUnits(t){return t/this._cellCm*this._gridPitch}get _decorList(){const t=this._curSpaceCfg;return Array.isArray(t?.decor)?t.decor:[]}get _decorH(){return La}_decorResolvedStyle(t){return function(t,e,i,s=Fs){const o="rect"===t?.kind||"ellipse"===t?.kind,n=t,r=/^#[0-9a-f]{6}$/i.test(String(n?.color||""))?String(n.color):s.color;return{color:r,opacity:Is(n?.opacity,s.opacity),widthCm:Ws(t,e,i,s.widthCm),fill:!!o&&!0===n?.fill,fillColor:/^#[0-9a-f]{6}$/i.test(String(n?.fill_color||""))?String(n.fill_color):n?.fill?r:s.fillColor,fillOpacity:o&&n?.fill?Is(n?.fill_opacity,.25):s.fillOpacity}}(t,this._cellCm,this._gridPitch,Fs)}_decorWidthUnits(t){return((t,e,i,s=Fs.widthCm)=>{const o=Number(t?.width_cm);if(Number.isFinite(o)&&o>0)return qs(o,e,i);const n=Number(t?.width);return Number.isFinite(n)&&n>0?n:qs(s,e,i)})(t,this._cellCm,this._gridPitch,Fs.widthCm)}_decorTextSizeCm(t){if("text"===t?.kind){const e=Number(t.size_cm);return Number.isFinite(e)&&e>0?e:Us(bi*yi(t),this._cellCm,this._gridPitch)}return Us(bi,this._cellCm,this._gridPitch)}_decorTextUnits(t){if("text"!==t.kind)return bi;const e=Number(t.size_cm);return Number.isFinite(e)&&e>0?qs(e,this._cellCm,this._gridPitch):bi*yi(t)}_decorSmallField(t){return Math.round(100*(this._imperial?t/2.54:t))/100}_decorSmallCm(t){const e=this._imperial?2.54*t:t;return Number.isFinite(e)?Math.max(.1,Math.min(100,e)):.1}_decorTextCm(t){const e=this._imperial?2.54*t:t;return Number.isFinite(e)?Math.max(.1,Math.min($a,e)):.1}_decorLargeField(t){return Math.round(100*(this._imperial?t/30.48:t/100))/100}_decorLargeCm(t){const e=this._imperial?30.48*t:100*t;return Number.isFinite(e)?Math.max(.1,Math.min(io*this._cellCm,e)):.1}_decorBoxOf(t){return"rect"!==t.kind&&"ellipse"!==t.kind&&"furniture"!==t.kind?null:{x:t.x*La,y:t.y*this._decorH,w:t.w*La,h:t.h*this._decorH,angle:Ls(t.angle)||void 0}}_decorSnapGeometry(t){const e=t||"",i=this._decorSnapCache;if(i&&i.epoch===this._cfgEpoch&&i.space===this._space&&i.height===this._decorH&&i.exclude===e)return i.geometry;const s=[];for(const e of this._decorList)if(e.id!==t)if("line"===e.kind){const t=[e.x1*La,e.y1*this._decorH],i=[e.x2*La,e.y2*this._decorH];s.push({points:[t,i,[(t[0]+i[0])/2,(t[1]+i[1])/2]],segments:[{a:t,b:i}]})}else if("text"===e.kind)s.push({points:[[e.x*La,e.y*this._decorH]],segments:[]});else{const t=this._decorBoxOf(e);t&&s.push(Vs(t))}for(const t of this._spaceModel().rooms){const e=ze(t);e?.length&&s.push({points:e.flatMap((t,i)=>{const s=e[(i+1)%e.length];return[t,[(t[0]+s[0])/2,(t[1]+s[1])/2]]}),segments:e.map((t,i)=>({a:t,b:e[(i+1)%e.length]}))})}const o=function(t){return{points:t.flatMap(t=>t.points),segments:t.flatMap(t=>t.segments)}}(s);return this._decorSnapCache={epoch:this._cfgEpoch,space:this._space,height:this._decorH,exclude:e,geometry:o},o}_decorSnap(t,e="mouse",i){const s=this._stageEl,o=this._viewOr(this._baseVb()),n="touch"===e||"pen"===e?14:8,r=s?o.w/Math.max(1,s.clientWidth)*n:this._gridPitch;return function(t,e,i,s){const o=s(t);let n=null;for(const o of e.points){const e=s(o),r=Math.hypot(e[0]-t[0],e[1]-t[1]);r<=i&&(!n||r<n.d)&&(n={p:e,d:r,kind:"point",target:o})}for(const o of e.segments){const e=Ks(t,o.a,o.b),r=s(e),a=Math.hypot(r[0]-t[0],r[1]-t[1]);a<=i&&(!n||a<n.d)&&(n={p:r,d:a,kind:"edge",target:e})}return n?{point:n.p,target:n.target,kind:n.kind}:{point:o,target:null,kind:"grid"}}(t,this._decorSnapGeometry(i),r,t=>this._snap(t)).point}_replaceDecor(t,e){const i=this._curSpaceCfg;i&&(i.decor=this._decorList.map(i=>i.id===t?{...i,...e}:i),this.requestUpdate())}_cancelDecorGesture(){const t=this._decorMove?.before||this._dtDrag?.before||this._bdDrag?.before,e=t&&this._serverCfg?.spaces.find(e=>e.id===t.spaceId);if(t&&e){const i=t=>JSON.parse(JSON.stringify(t));void 0!==t.decor?e.decor=i(t.decor):delete e.decor;for(const t of["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"])delete e[t];Object.assign(e,i(t.plan_transform||{})),this._cfgEpoch++}this._decorMove=null,this._dtDrag=null,this._bdDrag=null,this.requestUpdate()}_decorPointerDown(t){const e=this._decorTool;if("select"===e||"erase"===e?t.target.closest?.(".dshape"):null)return!0;if("line"===e||"rect"===e||"ellipse"===e){t.preventDefault();const i=this._decorSnap(this._svgPoint(t),t.pointerType);return this._decorDraft={kind:e,a:i,b:i,pid:t.pointerId},Ba(t),!0}if("text"===e){const e=this._decorSnap(this._svgPoint(t),t.pointerType);return this._decorTextDialog={x:ho(e[0]/La),y:ho(e[1]/this._decorH),text:"",color:this._decorStyle.color,opacity:this._decorStyle.opacity,angle:0,sizeCm:Us(bi,this._cellCm,this._gridPitch)},this._decorTextSelection={start:0,end:0},!0}if("furniture"===e)return!!this._furnPalette&&(t.preventDefault(),this._furnPlace(this._svgPoint(t),t.shiftKey),!0);if("select"===e&&(this._decorSel=null),this._bdMovable){const e=this._bdRect,i=this._svgPoint(t),s=e.x+e.w/2,o=e.y+e.h/2,n=-Ls(e.angle)*Math.PI/180,r=i[0]-s,a=i[1]-o,l=[s+r*Math.cos(n)-a*Math.sin(n),o+r*Math.sin(n)+a*Math.cos(n)];if(l[0]>=e.x&&l[0]<=e.x+e.w&&l[1]>=e.y&&l[1]<=e.y+e.h)return t.preventDefault(),this._bdStart(t)}return!1}_decorCommitDraft(){const t=this._decorDraft;if(this._decorDraft=null,!t)return;const e=.5*this._gridPitch;if(!function(t,e,i,s){const o=Math.abs(i[0]-e[0]),n=Math.abs(i[1]-e[1]);return"line"===t?Math.hypot(o,n)>=s:o>=s&&n>=s}(t.kind,t.a,t.b,e))return;const i=La,s=this._decorH,o=this._decorStyle,n=this._geometrySnapshot(),r="dc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),a=ho;let l;if("line"===t.kind)l={id:r,kind:"line",x1:a(t.a[0]/i),y1:a(t.a[1]/s),x2:a(t.b[0]/i),y2:a(t.b[1]/s),...Bs(o,!1)};else{const e=a(Math.min(t.a[0],t.b[0])/i),n=a(Math.min(t.a[1],t.b[1])/s),c=Math.abs(t.b[0]-t.a[0])/i,h=Math.abs(t.b[1]-t.a[1])/s;l={id:r,kind:t.kind,x:e,y:n,w:c,h:h,...Bs(o,!0)}}this._curSpaceCfg.decor=[...this._decorList,l],this._decorSel=r,this._recordGeometry(this._t("history.decor_add"),n),this._saveConfig(),this.requestUpdate()}_decorShapeDown(t,e){if("decor"!==this._mode)return;const i=this._decorTool;if("text"===i){if("text"!==e.kind)return;return t.stopPropagation(),t.preventDefault(),void this._decorOpenText(e)}"select"!==i&&"erase"!==i||(t.stopPropagation(),t.preventDefault(),"erase"!==i?(this._decorSel=e.id,this._decorMove={id:e.id,start:this._svgPoint(t),orig:JSON.parse(JSON.stringify(e)),pid:t.pointerId,moved:!1,before:this._geometrySnapshot()},Ba(t)):this._decorEraseConfirm={id:e.id,kind:e.kind})}_decorMoveUpdate(t){const e=this._decorMove;if("furniture"===e.orig?.kind)return void this._furnMoveUpdate(t);const i=this._svgPoint(t),s=e.orig,o=("line"===s.kind?s.x1:s.x)*La,n=("line"===s.kind?s.y1:s.y)*this._decorH,r=this._decorSnap([o+(i[0]-e.start[0]),n+(i[1]-e.start[1])],t.pointerType,e.id);let a=(r[0]-o)/La,l=(r[1]-n)/this._decorH;const c=e.orig,h="line"===c.kind?Math.min(c.x1,c.x2):c.x,d="line"===c.kind?Math.min(c.y1,c.y2):c.y,p="line"===c.kind?Math.abs(c.x2-c.x1):c.w||0,u="line"===c.kind?Math.abs(c.y2-c.y1):c.h||0,_=io;a=Math.max(-_-h,Math.min(_-h-p,a)),l=Math.max(-_-d,Math.min(_-d-u,l)),(a||l)&&(e.moved=!0);this._curSpaceCfg.decor=this._decorList.map(t=>{if(t.id!==e.id)return t;const i=e.orig;return"line"===t.kind?{...t,x1:i.x1+a,y1:i.y1+l,x2:i.x2+a,y2:i.y2+l}:{...t,x:i.x+a,y:i.y+l}}),this.requestUpdate()}_decorShapeDbl(t,e){if("decor"!==this._mode||"select"!==this._decorTool)return;if(t.preventDefault(),t.stopPropagation(),this._decorMove=null,this._decorSel=e.id,"text"===e.kind)return void this._decorOpenText(e);if(!["line","rect","ellipse","furniture"].includes(e.kind))return;const i=this._decorResolvedStyle(e),s="line"===e.kind?e:null,o=this._decorBoxOf(e);this._decorShapeDialog={id:e.id,kind:e.kind,color:i.color,opacity:i.opacity,widthCm:i.widthCm,angle:Ls(s?Yi([s.x1*La,s.y1*this._decorH],[s.x2*La,s.y2*this._decorH]):e.angle),...s?{lengthCm:Us(Math.hypot((s.x2-s.x1)*La,(s.y2-s.y1)*this._decorH),this._cellCm,this._gridPitch)}:{},...o?{sizeWCm:Us(o.w,this._cellCm,this._gridPitch),sizeHCm:Us(o.h,this._cellCm,this._gridPitch)}:{},..."furniture"===e.kind?{symbol:e.symbol}:{},..."rect"===e.kind||"ellipse"===e.kind?{fill:i.fill,fillColor:i.fillColor,fillOpacity:i.fillOpacity}:{}}}_decorOpenText(t){if("text"!==t.kind)return;let e=String(t.text??"");const i=[...e.matchAll(/\{([^{}\r\n]+)\}/g)].some(t=>!!_i(t[1])),s=String(t.unit??"").trim(),o="state"===String(t.attr??"").trim().toLowerCase()?null:t.attr,n=i||s?"":mi(t.entity,o),r=!(!String(t.entity??"").trim()||i||n&&!s);if(n&&!r){const t=e.indexOf("{}");e=t>=0?e.slice(0,t)+n+e.slice(t+2):`${e}${e?" ":""}${n}`}this._decorTextDialog={id:t.id,x:t.x,y:t.y,text:e,color:t.color||this._decorStyle.color,opacity:Is(t.opacity,this._decorStyle.opacity),angle:Ls(t.angle),sizeCm:this._decorTextSizeCm(t),pickerEntity:t.entity||"",preserveLegacy:r||void 0},this._decorTextSelection={start:e.length,end:e.length}}_decorRememberTextSelection(t){this._decorTextSelection={start:t.selectionStart??t.value.length,end:t.selectionEnd??t.value.length}}_decorInsertLiveVariable(t){const e=this._decorTextDialog;if(!e)return;const i=mi(e.pickerEntity,t);if(!i)return;const s=e.text,o=Math.max(0,Math.min(s.length,this._decorTextSelection.start)),n=Math.max(o,Math.min(s.length,this._decorTextSelection.end));if(s.length-(n-o)+i.length>200)return;const r=s.slice(0,o)+i+s.slice(n),a=o+i.length;this._decorTextSelection={start:a,end:a},this._decorTextDialog={...e,text:r,preserveLegacy:void 0},this.updateComplete.then(()=>{const t=this.renderRoot.querySelector("textarea.dtarea");t&&(t.focus(),t.setSelectionRange(a,a))})}_decorSaveText(){const t=this._decorTextDialog,e=String(t?.text??"").replace(/\r\n?/g,"\n").trim();if(!t||!e)return void(this._decorTextDialog=null);const i=this._geometrySnapshot(),s=this._curSpaceCfg,o={color:t.color,opacity:Is(t.opacity),size_cm:Number(Math.max(.1,Math.min($a,t.sizeCm)).toFixed(4)),...Ls(t.angle)?{angle:Ls(t.angle)}:{}};if(t.id)s.decor=this._decorList.map(i=>{if(i.id!==t.id)return i;if("text"!==i.kind)return i;if(t.preserveLegacy){const{angle:t,size:s,scale:n,...r}=i;return{...r,text:e,...o}}const{entity:s,attr:n,unit:r,...a}=i,{angle:l,size:c,scale:h,...d}=a;return{...d,text:e,...o}});else{const i="dc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);s.decor=[...this._decorList,{id:i,kind:"text",x:t.x,y:t.y,text:e,...o}],this._decorSel=i}this._decorTextDialog=null,this._recordGeometry(this._t(t.id?"history.decor_edit":"history.decor_add"),i),this._saveConfig(),this.requestUpdate()}_decorSaveShape(){const t=this._decorShapeDialog;if(!t)return;const e=this._geometrySnapshot(),i={color:t.color,opacity:Is(t.opacity),widthCm:Math.max(.1,Math.min(100,Number(t.widthCm)||.1)),fill:!!t.fill,fillColor:t.fillColor||t.color,fillOpacity:Is(t.fillOpacity,.25)};this._curSpaceCfg.decor=this._decorList.map(e=>{if(e.id!==t.id)return e;const s="rect"===t.kind||"ellipse"===t.kind,o=Bs(i,s);if("line"===e.kind){const i=(e.x1+e.x2)/2*La,s=(e.y1+e.y2)/2*this._decorH,n=qs(Math.max(.1,Number(t.lengthCm)||.1),this._cellCm,this._gridPitch),r=Ls(t.angle)*Math.PI/180,a=Math.cos(r)*n/2,l=Math.sin(r)*n/2,c=this._snap([i-a,s-l]),h=this._snap([i+a,s+l]),{width:d,...p}=e;return{...p,...o,x1:ho(c[0]/La),y1:ho(c[1]/this._decorH),x2:ho(h[0]/La),y2:ho(h[1]/this._decorH)}}if("rect"===e.kind||"ellipse"===e.kind||"furniture"===e.kind){const i=e.w*La,s=e.h*this._decorH,n=Math.max(this._gridPitch,Me(qs(Number(t.sizeWCm),this._cellCm,this._gridPitch),this._gridPitch)),r=Math.max(this._gridPitch,Me(qs(Number(t.sizeHCm),this._cellCm,this._gridPitch),this._gridPitch)),a=e.x*La+i/2,l=e.y*this._decorH+s/2,c=Ls(t.angle),h=Hs({x:a-n/2,y:l-r/2},c,t=>this._snap(t)),{width:d,angle:p,...u}=e;return{...u,...o,x:ho(h[0]/La),y:ho(h[1]/this._decorH),w:n/La,h:r/this._decorH,..."furniture"===e.kind&&t.symbol?{symbol:t.symbol}:{},...c?{angle:c}:{}}}return e}),this._decorStyle={...i,fill:"rect"===t.kind||"ellipse"===t.kind?i.fill:this._decorStyle.fill,fillColor:"rect"===t.kind||"ellipse"===t.kind?i.fillColor:this._decorStyle.fillColor,fillOpacity:"rect"===t.kind||"ellipse"===t.kind?i.fillOpacity:this._decorStyle.fillOpacity},this._decorShapeDialog=null,this._recordGeometry(this._t("history.decor_edit"),e),this._saveConfig(),this.requestUpdate()}get _dtSel(){return"decor"===this._mode&&"select"===this._decorTool&&this._decorSel&&this._decorList.find(t=>t.id===this._decorSel)||null}_dtPivot(t){return"line"===t.kind?[(t.x1+t.x2)/2*La,(t.y1+t.y2)/2*this._decorH]:"furniture"===t.kind||"rect"===t.kind||"ellipse"===t.kind?[(t.x+t.w/2)*La,(t.y+t.h/2)*this._decorH]:[t.x*La,t.y*this._decorH]}_dtApply(t,e){const i=this._curSpaceCfg;i&&(i.decor=this._decorList.map(i=>{if(i.id!==t)return i;const s={...i};"text"===i.kind&&void 0!==e.textSizeCm&&(delete s.size,delete s.scale);const o={...s};return void 0!==e.textSizeCm&&(o.size_cm=Number(Math.max(.1,Math.min($a,e.textSizeCm)).toFixed(4))),void 0!==e.angle&&(e.angle?o.angle=Number(e.angle.toFixed(2)):delete o.angle),o}),this._cfgEpoch++,this.requestUpdate())}_dtStart(t,e,i,s){const o=this._dtSel;if(!o)return;t.stopPropagation(),t.preventDefault();const[n,r]=this._dtPivot(o),a=this._svgPoint(t),l=this._decorBoxOf(o);this._dtDrag={id:o.id,kind:e,pid:t.pointerId,ax:n,ay:r,r0:Math.hypot(a[0]-n,a[1]-r),a0:180*Math.atan2(a[1]-r,a[0]-n)/Math.PI,textSizeCm0:"text"===o.kind?this._decorTextSizeCm(o):1,angle0:"line"===o.kind?0:Number(o.angle)||0,sgx:i?.[0],sgy:i?.[1],orig:l||void 0,origShape:JSON.parse(JSON.stringify(o)),before:this._geometrySnapshot(),lineEnd:s,moved:!1},Ba(t)}_dtMove(t){const e=this._dtDrag;if(!e)return;const i=this._svgPoint(t);if(void 0!==e.lineEnd&&"line"===e.origShape.kind){const s=this._decorSnap(i,t.pointerType,e.id),o=ho(s[0]/La),n=ho(s[1]/this._decorH),r=e.origShape,a=0===e.lineEnd?r.x1:r.x2,l=0===e.lineEnd?r.y1:r.y2;return(Math.abs(o-a)>1e-9||Math.abs(n-l)>1e-9)&&(e.moved=!0),void this._replaceDecor(e.id,0===e.lineEnd?{x1:o,y1:n}:{x2:o,y2:n})}if("scale"===e.kind&&e.orig){const s=Gs(e.orig,e.sgx??1,e.sgy??1,i[0],i[1],!t.shiftKey,this._gridPitch,this._gridPitch),o=Math.abs(s.x-e.orig.x)>1e-6||Math.abs(s.y-e.orig.y)>1e-6||Math.abs(s.w-e.orig.w)>1e-6||Math.abs(s.h-e.orig.h)>1e-6;if(!o&&!e.moved)return;return e.moved||=o,void this._decorApplyBox(e.id,s)}if("scale"===e.kind){const t=Math.hypot(i[0]-e.ax,i[1]-e.ay);if(e.r0<1e-6)return;const s=Math.max(.1,Math.min($a,e.textSizeCm0*(t/e.r0))),o=Math.abs(s-e.textSizeCm0)>1e-6;if(!o&&!e.moved)return;return e.moved||=o,void this._dtApply(e.id,{textSizeCm:s})}const s=180*Math.atan2(i[1]-e.ay,i[0]-e.ax)/Math.PI;let o=e.angle0+(s-e.a0);t.shiftKey||(o=5*Math.round(o/5)),o=(o%360+360)%360,o>180&&(o-=360);const n=Math.abs(o-e.angle0)>1e-6;(n||e.moved)&&(e.moved||=n,this._dtApply(e.id,{angle:o}))}_dtUp(){const t=this._dtDrag;this._dtDrag=null,t?.moved&&(this._recordGeometry(this._t("history.decor_transform"),t.before),this._saveConfig()),this.requestUpdate()}_dtMeasure(){const t=this._dtSel;if(!t)return void(this._dtBox&&(this._dtBox=null,this.requestUpdate()));let e;if("line"===t.kind){const i=t.x1*La,s=t.y1*this._decorH,o=t.x2*La,n=t.y2*this._decorH;e={id:t.id,x:Math.min(i,o),y:Math.min(s,n),w:Math.abs(o-i),h:Math.abs(n-s)}}else if("furniture"===t.kind||"rect"===t.kind||"ellipse"===t.kind)e={id:t.id,x:t.x*La,y:t.y*this._decorH,w:t.w*La,h:t.h*this._decorH};else{const i=this.renderRoot.querySelector(`text.dtext[data-id="${t.id}"]`);if(!i||"function"!=typeof i.getBBox)return;let s;try{s=i.getBBox()}catch{return}if(!s||!s.width&&!s.height)return;e={id:t.id,x:s.x,y:s.y,w:s.width,h:s.height}}const i=this._dtBox;i&&i.id===e.id&&Math.abs(i.x-e.x)<.01&&Math.abs(i.y-e.y)<.01&&Math.abs(i.w-e.w)<.01&&Math.abs(i.h-e.h)<.01||(this._dtBox=e,this.requestUpdate())}_deleteDecor(t){if(!this._decorList.some(e=>e.id===t))return;const e=this._geometrySnapshot();this._curSpaceCfg.decor=this._decorList.filter(e=>e.id!==t),this._decorSel===t&&(this._decorSel=null),this._recordGeometry(this._t("history.decor_delete"),e),this._saveConfig(),this.requestUpdate()}_decorDeleteSel(){this._decorSel&&this._deleteDecor(this._decorSel)}_confirmDecorErase(){const t=this._decorEraseConfirm;this._decorEraseConfirm=null,t&&this._deleteDecor(t.id)}get _furnWalls(){return this._segments}get _furnWallReach(){return 6*this._gridPitch}_furnFieldValue(t){return Math.round(100*(this._imperial?t/30.48:t/100))/100}_furnFieldToCm(t){return e=this._imperial?30.48*t:100*t,Number.isFinite(e)?Math.max(1,Math.min(1e4,e)):1;var e}_furnPick(t){const e=function(t){const e=Po(t);return e?{w:e.w,h:e.h}:{w:60,h:60}}(t);this._furnPalette={symbol:t,w:e.w,h:e.h}}_furnPlace(t,e=!1){const i=this._furnPalette,s=this._curSpaceCfg;if(!i||!s)return;const o=La,n=this._decorH,r=Oo(Ao(i.w,this._cellCm,this._gridPitch,o)),a=Oo(Ao(i.h,this._cellCm,this._gridPitch,o)),l=this._geometrySnapshot(),c=this._decorSnap(t);let h=c[0],d=c[1],p=0;const u=e?null:Ho(h,d,a*n,this._furnWalls,this._furnWallReach,this._gridPitch);u&&(h=u.cx,d=u.cy,p=u.angle);const _="df"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),m={id:_,kind:"furniture",symbol:i.symbol,x:ho(h/o-r/2),y:ho(d/n-a/2),w:r,h:a,...Bs(this._decorStyle,!1)};p&&(m.angle=Number(p.toFixed(2))),s.decor=[...this._decorList,m],this._decorSel=_,this._decorTool="select",this._furnPalette=null,this._recordGeometry(this._t("history.decor_add"),l),this._saveConfig(),this.requestUpdate()}_furnMoveUpdate(t){const e=this._decorMove;if("furniture"!==e.orig.kind)return;const i=e.orig,s=this._curSpaceCfg;if(!s)return;const o=La,n=this._decorH,r=this._svgPoint(t),a=(i.x+i.w/2)*o+(r[0]-e.start[0]),l=(i.y+i.h/2)*n+(r[1]-e.start[1]);let c,h,d=Number(i.angle)||0;const p=t.shiftKey?null:Ho(a,l,i.h*n,this._furnWalls,this._furnWallReach,this._gridPitch);if(p)c=p.cx/o-i.w/2,h=p.cy/n-i.h/2,d=p.angle;else{const s=this._decorSnap([a-i.w/2*o,l-i.h/2*n],t.pointerType,e.id);c=s[0]/o,h=s[1]/n}c=ho(c),h=ho(h),(Math.abs(c-i.x)>1e-9||Math.abs(h-i.y)>1e-9||Math.abs(d-(Number(i.angle)||0))>1e-9)&&(e.moved=!0),s.decor=this._decorList.map(t=>{if(t.id!==e.id)return t;const i={...t,x:c,y:h};return d?i.angle=Number(d.toFixed(2)):delete i.angle,i}),this.requestUpdate()}_decorApplyBox(t,e){const i=this._curSpaceCfg;if(!i)return;const s=La,o=this._decorH;i.decor=this._decorList.map(i=>{if(i.id!==t)return i;const n=Hs(e,i.angle,t=>this._snap(t));return{...i,x:ho(n[0]/s),y:ho(n[1]/o),w:Math.max(this._gridPitch/s,Math.min(2*io,e.w/s)),h:Math.max(this._gridPitch/o,Math.min(2*io,e.h/o))}}),this._cfgEpoch++,this.requestUpdate()}get _furnLive(){const t=this._dtDrag;if(!t||"scale"!==t.kind||!t.orig)return null;const e=this._decorList.find(e=>e.id===t.id);if(!e||"furniture"!==e.kind)return null;const i=La,s=this._decorH,o=e.w*i,n=e.h*s,r=function(t,e,i,s,o){const n=t+i/2,r=e+s/2,a=(Number(o)||0)*Math.PI/180,l=Math.cos(a),c=Math.sin(a),h=(t,e)=>{const i=t-n,s=e-r;return[n+i*l-s*c,r+i*c+s*l]};return[h(t,e),h(t+i,e),h(t+i,e+s),h(t,e+s)]}(e.x*i,e.y*s,o,n,Number(e.angle)||0),a=(t,e)=>[(t[0]+e[0])/2,(t[1]+e[1])/2],l=a(r[0],r[1]),c=a(r[0],r[3]);return[{x:l[0],y:l[1],text:this._fmtLen([0,0],[o,0])},{x:c[0],y:c[1],text:this._fmtLen([0,0],[0,n])}]}_renderFurnPalette(){const t=this._furnPalette,e=this._t(this._imperial?"gs.unit_ft":"gs.unit_m");return W`<div class="furnpalette" @pointerdown=${t=>t.stopPropagation()}>
      <div class="furnhd">
        <ha-icon icon="mdi:sofa-outline"></ha-icon>${this._t("furn.title")}
        <span class="spacer"></span>
        <button class="btn furnclose" title=${this._t("btn.close")}
          @click=${()=>{this._furnPalette=null,this._decorTool="select"}}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="furnbody">
        ${Do.map(e=>W`
          <div class="furngroup" data-group=${e}>${this._t(`furn.group_${e}`)}</div>
          <div class="furnrow">
            ${Ro(e).map(e=>W`<button
              class="furnitem ${t?.symbol===e.id?"on":""}" data-symbol=${e.id}
              title=${this._t(`furn.sym_${e.id}`)}
              @click=${()=>this._furnPick(e.id)}>
              ${(t=>{const e=Po(t),i=36/Math.max(e.w,e.h),s=e.w*i,o=e.h*i;return B`<svg class="furnprev" viewBox="0 0 40 40" aria-hidden="true"><g
        transform="translate(${(40-s)/2} ${(40-o)/2})"><path
        d=${Io(t,s,o)} fill="none" stroke="currentColor"
        stroke-width="1.2" stroke-linejoin="round"></path></g></svg>`})(e.id)}<span>${this._t(`furn.sym_${e.id}`)}</span>
            </button>`)}
          </div>`)}
      </div>
      ${t?W`<div class="furnsize">
        <label>${this._t("furn.width")}<span class="furnunit">${e}</span></label>
        <input class="namein furnw" type="number" min="0.01" step="0.05"
          .value=${String(this._furnFieldValue(t.w))}
          @input=${e=>this._furnPalette={...t,w:this._furnFieldToCm(Number(e.target.value))}} />
        <label>${this._t("furn.depth")}<span class="furnunit">${e}</span></label>
        <input class="namein furnh" type="number" min="0.01" step="0.05"
          .value=${String(this._furnFieldValue(t.h))}
          @input=${e=>this._furnPalette={...t,h:this._furnFieldToCm(Number(e.target.value))}} />
        <span class="furnhint">${this._t("furn.place_hint")}</span>
      </div>`:W`<div class="furnsize"><span class="furnhint">${this._t("furn.pick_hint")}</span></div>`}
    </div>`}get _bdBase(){const t=this._curSpaceCfg;return t?.plan_url?{...Js(t.plan_aspect,La)}:null}get _bdRect(){const t=this._curSpaceCfg;return t?.plan_url?Qs(t,La):null}get _bdParams(){const t=this._curSpaceCfg,e=Number(t?.plan_x),i=Number(t?.plan_y),s=Number(t?.plan_scale),o=Number(t?.plan_scale_x),n=Number(t?.plan_scale_y),r=Number.isFinite(s)&&s>0?s:1;return{dx:Number.isFinite(e)?e:0,dy:Number.isFinite(i)?i:0,sx:Number.isFinite(o)&&o>0?o:r,sy:Number.isFinite(n)&&n>0?n:r,angle:Ls(t?.plan_angle)}}_openBackdropDialog(t){if(!this._bdMovable||!this._bdRect)return;t?.preventDefault(),t?.stopPropagation(),this._bdDrag=null;const e=this._bdRect;this._backdropDialog={widthCm:Us(e.w,this._cellCm,this._gridPitch),heightCm:Us(e.h,this._cellCm,this._gridPitch),angle:Ls(e.angle)}}_saveBackdropDialog(){const t=this._backdropDialog,e=this._bdBase,i=this._bdRect;if(!t||!e||!i)return;const s=this._geometrySnapshot(),o=Math.min(e.w*Xs,Math.max(e.w*Zs,Me(qs(t.widthCm,this._cellCm,this._gridPitch),this._gridPitch))),n=Math.min(e.h*Xs,Math.max(e.h*Zs,Me(qs(t.heightCm,this._cellCm,this._gridPitch),this._gridPitch))),r=Hs({x:i.x+i.w/2-o/2,y:i.y+i.h/2-n/2},t.angle,t=>this._snap(t));this._bdApply((r[0]-e.x)/La,(r[1]-e.y)/La,o/e.w,n/e.h,t.angle),this._backdropDialog=null,this._recordGeometry(this._t("history.backdrop_transform"),s),this._saveConfig()}get _bdActive(){return"decor"===this._mode&&!!this._bdRect&&"backdrop"===this._decorTool}get _bdMovable(){return"decor"===this._mode&&"backdrop"===this._decorTool&&!!this._bdRect}_bdApply(t,e,i,s,o){const n=this._curSpaceCfg;if(!n)return;n.plan_x=Number(ho(t).toFixed(6)),n.plan_y=Number(ho(e).toFixed(6)),delete n.plan_scale,n.plan_scale_x=Number(Math.min(Xs,Math.max(Zs,i)).toFixed(6)),n.plan_scale_y=Number(Math.min(Xs,Math.max(Zs,s)).toFixed(6));const r=Ls(o);r?n.plan_angle=Number(r.toFixed(2)):delete n.plan_angle,this._cfgEpoch++,this.requestUpdate()}_bdStart(t,e,i=!1){const s=this._bdBase,o=this._bdRect;if(!s||!o)return!1;const n=this._svgPoint(t),r=e?e[0]:0,a=e?e[1]:0,l=r>0?o.x:o.x+o.w,c=a>0?o.y:o.y+o.h;return this._bdDrag={kind:i?"rotate":e?"scale":"move",pid:t.pointerId,sx:n[0],sy:n[1],base:s,p0:this._bdParams,fx:l,fy:c,sgx:r,sgy:a,rect0:{x:o.x,y:o.y,w:o.w,h:o.h,angle:o.angle},before:this._geometrySnapshot(),moved:!1},Ba(t),!0}_bdMove(t){const e=this._bdDrag;if(!e)return;const i=this._svgPoint(t),s=e.base;if("move"===e.kind){const t=e.rect0.x,o=e.rect0.y,n=this._snap([t+(i[0]-e.sx),o+(i[1]-e.sy)]),r=Math.abs(n[0]-t)>1e-9||Math.abs(n[1]-o)>1e-9;if(!r&&!e.moved)return;return e.moved||=r,void this._bdApply((n[0]-s.x)/La,(n[1]-s.y)/La,e.p0.sx,e.p0.sy,e.p0.angle)}if("rotate"===e.kind){const s=e.rect0.x+e.rect0.w/2,o=e.rect0.y+e.rect0.h/2,n=180*Math.atan2(e.sy-o,e.sx-s)/Math.PI;let r=e.p0.angle+(180*Math.atan2(i[1]-o,i[0]-s)/Math.PI-n);t.shiftKey||(r=5*Math.round(r/5)),r=Ls(r);const a=Math.abs(r-e.p0.angle)>1e-9;if(!a&&!e.moved)return;return e.moved||=a,void this._bdApply(e.p0.dx,e.p0.dy,e.p0.sx,e.p0.sy,r)}const o=Gs(e.rect0,e.sgx,e.sgy,i[0],i[1],!t.shiftKey,this._gridPitch,Math.min(s.w,s.h)*Zs),n=o.w/Math.max(1e-9,s.w),r=o.h/Math.max(1e-9,s.h),a=Math.abs(n-e.p0.sx)>1e-9||Math.abs(r-e.p0.sy)>1e-9||Math.abs(o.x-e.rect0.x)>1e-9||Math.abs(o.y-e.rect0.y)>1e-9;if(!a&&!e.moved)return;e.moved||=a;const l=Hs(o,e.p0.angle,t=>this._snap(t));this._bdApply((l[0]-s.x)/La,(l[1]-s.y)/La,n,r,e.p0.angle)}get _bdMoved(){if("decor"!==this._mode||!this._bdRect)return!1;const t=this._bdParams;return 0!==t.dx||0!==t.dy||1!==t.sx||1!==t.sy||0!==t.angle}_bdReset(){const t=this._curSpaceCfg;if(!t)return;const e=this._geometrySnapshot();delete t.plan_x,delete t.plan_y,delete t.plan_scale,delete t.plan_scale_x,delete t.plan_scale_y,delete t.plan_angle,this._bdDrag=null,this._recordGeometry(this._t("history.backdrop_transform"),e),this._saveConfig(),this._showToast(this._t("decor.backdrop_reset_done")),this.requestUpdate()}_bdUp(){const t=this._bdDrag;this._bdDrag=null,t?.moved&&(this._recordGeometry(this._t("history.backdrop_transform"),t.before),this._saveConfig()),this.requestUpdate()}get _bdLive(){if(!this._bdDrag)return null;const t=this._bdRect;return t?{x:t.x+t.w/2,y:t.y+t.h/2,text:`${this._fmtLen([0,0],[t.w,0])} × ${this._fmtLen([0,0],[0,t.h])}`}:null}_renderBackdropFrame(t){const e=this._bdRect;if(!this._bdActive||!e)return V;const i=.02*Math.max(t.w,t.h),s=i/4,o=e.x+e.w/2,n=e.y+e.h/2,r=Ls(e.angle),a=2.2*i;return B`<g class="bdframe" transform=${r?`rotate(${r} ${o} ${n})`:V}>
      <rect class="bdbox" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}"></rect>
      <line class="dtstem" x1="${o}" y1="${e.y}" x2="${o}" y2="${e.y-a}"></line>
      <circle class="bdhandle dtrot" cx="${o}" cy="${e.y-a}" r="${i.toFixed(1)}"
        @pointerdown=${t=>{t.stopPropagation(),t.preventDefault(),this._bdStart(t,void 0,!0)}}></circle>
      <circle class="bdknob" cx="${o}" cy="${e.y-a}" r="${s.toFixed(2)}"></circle>
      ${[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]].map(([t,o,n])=>{const r=t<0?e.x:e.x+e.w,a=o<0?e.y:e.y+e.h;return B`<circle
          class="bdhandle bd-${n}" data-corner="${t+","+o}"
          cx="${r}" cy="${a}" r="${i.toFixed(1)}"
          @pointerdown=${e=>{e.stopPropagation(),e.preventDefault(),this._bdStart(e,[t,o])}}></circle><circle class="bdknob" cx="${r}" cy="${a}" r="${s.toFixed(2)}"></circle>`})}
    </g>`}_renderTextFrame(t){const e=this._dtSel,i=this._dtBox;if(!e||!i||i.id!==e.id)return V;const s=.018*Math.max(t.w,t.h),o=s/4;if("line"===e.kind){const t=[e.x1*La,e.y1*this._decorH],i=[e.x2*La,e.y2*this._decorH];return B`<g class="dtframe dtlineframe">
        <line class="dtbox" x1="${t[0]}" y1="${t[1]}" x2="${i[0]}" y2="${i[1]}"></line>
        ${[t,i].map((t,e)=>B`<circle class="dthandle dtendpoint" cx="${t[0]}" cy="${t[1]}"
          r="${s.toFixed(1)}" @pointerdown=${t=>this._dtStart(t,"scale",void 0,e)}></circle>
          <circle class="dtknob" cx="${t[0]}" cy="${t[1]}" r="${o.toFixed(2)}"></circle>`)}
      </g>`}const[n,r]=this._dtPivot(e),a=Number(e.angle)||0,l=2.2*s;return B`<g class="dtframe" transform=${a?`rotate(${a} ${n} ${r})`:V}>
      <rect class="dtbox" x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}"></rect>
      <line class="dtstem" x1="${i.x+i.w/2}" y1="${i.y}" x2="${i.x+i.w/2}" y2="${i.y-l}"></line>
      <circle class="dthandle dtrot" cx="${i.x+i.w/2}" cy="${i.y-l}" r="${s.toFixed(1)}"
        @pointerdown=${t=>this._dtStart(t,"rotate")}></circle>
      <circle class="dtknob" cx="${i.x+i.w/2}" cy="${i.y-l}" r="${o.toFixed(2)}"></circle>
      ${[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]].map(([t,e,n])=>B`<circle class="dthandle dt-${n}"
        cx="${t<0?i.x:i.x+i.w}" cy="${e<0?i.y:i.y+i.h}" r="${s.toFixed(1)}"
        @pointerdown=${i=>this._dtStart(i,"scale",[t,e])}></circle><circle class="dtknob"
        cx="${t<0?i.x:i.x+i.w}" cy="${e<0?i.y:i.y+i.h}" r="${o.toFixed(2)}"></circle>`)}
    </g>`}_renderDecorLayer(){const t=La,e=this._decorH,i="decor"===this._mode,s=this._decorList.map(s=>{const o="dshape"+(i&&this._decorSel===s.id?" dsel":""),n=this._decorResolvedStyle(s),r=this._decorWidthUnits(s),a=t=>this._decorShapeDown(t,s),l=t=>this._decorShapeDbl(t,s);if("line"===s.kind)return B`<line class="${o}" data-hp="decor" data-id="${s.id}" data-kind="${s.kind}"
          x1="${s.x1*t}" y1="${s.y1*e}" x2="${s.x2*t}" y2="${s.y2*e}"
          stroke="${n.color}" stroke-opacity="${n.opacity}" stroke-width="${r}" stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${a} @dblclick=${l}></line>`;if("rect"===s.kind){const i=(s.x+s.w/2)*t,c=(s.y+s.h/2)*e,h=Ls(s.angle);return B`<rect class="${o}" data-hp="decor" data-id="${s.id}" data-kind="${s.kind}"
          x="${s.x*t}" y="${s.y*e}" width="${s.w*t}" height="${s.h*e}"
          stroke="${n.color}" stroke-opacity="${n.opacity}" stroke-width="${r}"
          fill="${n.fill?n.fillColor:"none"}" fill-opacity="${n.fill?n.fillOpacity:0}"
          transform=${h?`rotate(${h} ${i} ${c})`:V}
          @pointerdown=${a} @dblclick=${l}></rect>`}if("ellipse"===s.kind){const i=(s.x+s.w/2)*t,c=(s.y+s.h/2)*e,h=Ls(s.angle);return B`<ellipse class="${o}" data-hp="decor" data-id="${s.id}" data-kind="${s.kind}"
          cx="${i}" cy="${c}"
          rx="${s.w/2*t}" ry="${s.h/2*e}" stroke="${n.color}" stroke-opacity="${n.opacity}" stroke-width="${r}"
          fill="${n.fill?n.fillColor:"none"}" fill-opacity="${n.fill?n.fillOpacity:0}"
          transform=${h?`rotate(${h} ${i} ${c})`:V}
          @pointerdown=${a} @dblclick=${l}></ellipse>`}if("furniture"===s.kind){const i=s.w*t,c=s.h*e,h=Io(s.symbol,i,c);if(!h)return V;const d=Number(s.angle)||0,p=s.x*t+i/2,u=s.y*e+c/2,_=`${d?`rotate(${d} ${p} ${u}) `:""}translate(${s.x*t} ${s.y*e})`;return B`<path class="${o} dfurn" data-hp="decor" data-id="${s.id}"
          data-kind="${s.kind}" data-symbol="${s.symbol}" d="${h}" transform=${_}
          stroke="${n.color}" stroke-opacity="${n.opacity}" stroke-width="${r}" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${a} @dblclick=${l}></path>`}if("text"===s.kind){const i=this._decorTextUnits(s),r=function(t){return String(t??"").replace(/\r\n?/g,"\n").split("\n")}(function(t,e,i,s=()=>!0){const o=t??"";let n=!1;const r=o.replace(/\{([^{}\r\n]+)\}/g,(t,e)=>{const o=_i(e);return o?(n=!0,s(o.entity||"")?vi(i,o):pi):t});if(n)return r;const a=(e?.entity||"").trim();if(!a)return o;if(!s(a)){const t=o.indexOf(ui);return t>=0?o.slice(0,t)+pi+o.slice(t+2):o?`${o} ${pi}`:pi}const l=vi(i,e),c=o.indexOf(ui);return c>=0?o.slice(0,c)+l+o.slice(c+2):o?`${o} ${l}`:l}(s.text,s,this.hass,t=>this._planEntityAvailable(t))),c=s.x*t,h=s.y*e,d=Number(s.angle)||0,p=h-(r.length-1)*i*1.2/2;return B`<text class="${o} dtext" data-hp="decor" data-id="${s.id}" data-kind="${s.kind}"
          x="${c}" y="${h}" fill="${n.color}" fill-opacity="${n.opacity}"
          font-size="${i}" transform=${d?`rotate(${d} ${c} ${h})`:V}
          @pointerdown=${a} @dblclick=${l}>${r.map((t,e)=>B`<tspan x="${c}" y="${p+e*i*1.2}">${t}</tspan>`)}</text>`}return V});let o=V;const n=this._decorDraft;if(n){const t=this._decorStyle,e=qs(t.widthCm,this._cellCm,this._gridPitch);if("line"===n.kind)o=B`<line class="ddraft" x1="${n.a[0]}" y1="${n.a[1]}" x2="${n.b[0]}" y2="${n.b[1]}"
          stroke="${t.color}" stroke-opacity="${t.opacity}" stroke-width="${e}" stroke-linecap="round" stroke-linejoin="round"></line>`;else{const i=Math.min(n.a[0],n.b[0]),s=Math.min(n.a[1],n.b[1]),r=Math.abs(n.b[0]-n.a[0]),a=Math.abs(n.b[1]-n.a[1]);o="rect"===n.kind?B`<rect class="ddraft" x="${i}" y="${s}" width="${r}" height="${a}" stroke="${t.color}"
              stroke-opacity="${t.opacity}" stroke-width="${e}" fill="${t.fill?t.fillColor:"none"}" fill-opacity="${t.fill?t.fillOpacity:0}"></rect>`:B`<ellipse class="ddraft" cx="${i+r/2}" cy="${s+a/2}" rx="${r/2}" ry="${a/2}"
              stroke="${t.color}" stroke-opacity="${t.opacity}" stroke-width="${e}" fill="${t.fill?t.fillColor:"none"}" fill-opacity="${t.fill?t.fillOpacity:0}"></ellipse>`}}return B`<g class="decorlayer">${s}${o}</g>`}_renderDecorBar(){const t=[["select","mdi:cursor-default-outline","decor.select"],...this._bdRect?[["backdrop","mdi:image-move","decor.backdrop"]]:[],["line","mdi:vector-line","decor.line"],["rect","mdi:rectangle-outline","decor.rect"],["ellipse","mdi:ellipse-outline","decor.ellipse"],["text","mdi:format-text","decor.text"],["furniture","mdi:sofa-outline","decor.furniture"],["erase","mdi:eraser","decor.erase"]],e=this._decorSel?this._decorList.find(t=>t.id===this._decorSel):null,i="rect"===this._decorTool||"ellipse"===this._decorTool||"rect"===e?.kind||"ellipse"===e?.kind,s=this._geometryHistory.undoName,o=this._geometryHistory.redoName;return W`<div class="editbar decorbar">
      ${t.map(([t,e,i])=>W`<button class="btn dtool ${this._decorTool===t?"on":""}"
          @click=${()=>{this._decorTool=t,this._decorDraft=null,"furniture"!==t&&(this._furnPalette=null)}}
          title=${this._t(i)}>
          <ha-icon icon=${e}></ha-icon><span class="ml">${this._t(i)}</span>
        </button>`)}
      <hp-color-opacity .label=${this._t("decor.color")} .color=${this._decorStyle.color}
        .opacity=${this._decorStyle.opacity} .opacityLabel=${this._t("space.opacity")}
        @hp-color-opacity-change=${t=>this._decorStyle={...this._decorStyle,...t.detail}}></hp-color-opacity>
      <label class="drawwall">${this._t("decor.width")}
        <input type="number" min=${this._decorSmallField(.1)}
          max=${this._decorSmallField(100)} step="0.1"
          .value=${String(this._decorSmallField(this._decorStyle.widthCm))}
          @input=${t=>this._decorStyle={...this._decorStyle,widthCm:this._decorSmallCm(Number(t.target.value))}} />
        <span class="opl">${this._t(this._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span>
      </label>
      ${i?W`<label class="dfill"><input type="checkbox" .checked=${this._decorStyle.fill}
          @change=${t=>this._decorStyle={...this._decorStyle,fill:t.target.checked}} />
          ${this._t("decor.fill")}</label>
        <hp-color-opacity .label=${this._t("decor.fill_color")} .color=${this._decorStyle.fillColor}
          .opacity=${this._decorStyle.fillOpacity} .opacityLabel=${this._t("space.opacity")}
          .disabled=${!this._decorStyle.fill}
          @hp-color-opacity-change=${t=>this._decorStyle={...this._decorStyle,fillColor:t.detail.color,fillOpacity:t.detail.opacity}}></hp-color-opacity>`:V}
      <button class="btn ghost" @click=${this._undoGeometry} ?disabled=${!s}
        title=${s?this._t("history.undo_named",{name:s}):this._t("history.undo_empty")}>
        <ha-icon icon="mdi:undo-variant"></ha-icon>${this._t("history.undo")}
      </button>
      <button class="btn ghost" @click=${this._redoGeometry} ?disabled=${!o}
        title=${o?this._t("history.redo_named",{name:o}):this._t("history.redo_empty")}>
        <ha-icon icon="mdi:redo-variant"></ha-icon>${this._t("history.redo")}
      </button>
      ${""}
      ${this._bdMoved&&!this._bdDrag?W`<button class="btn bdreset" title=${this._t("decor.backdrop_reset")}
            @click=${()=>this._bdReset()}>
            <ha-icon icon="mdi:image-refresh-outline"></ha-icon><span class="ml">${this._t("decor.backdrop_reset")}</span>
          </button>`:V}
      <span class="spacer"></span>
      ${this._bdMovable?W`<span class="bdhint">${this._t("decor.backdrop_hint")}</span>`:V}
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_renderDecorEraseConfirm(){const t=this._decorEraseConfirm,e=this._t(`decor.${t.kind}`);return W`<hp-dialog .hass=${this.hass} .title=${this._t("decor.erase_confirm_title")}
      icon="mdi:eraser" dismiss-on-scrim @hp-close=${()=>this._decorEraseConfirm=null}>
        <div class="body"><p>${this._t("confirm.erase_decor",{kind:e})}</p></div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._decorEraseConfirm=null}>
            ${this._t("btn.cancel")}
          </button>
          <button class="btn danger" @click=${this._confirmDecorErase}>
            <ha-icon icon="mdi:eraser"></ha-icon>${this._t("decor.erase")}
          </button>
        </div>
    </hp-dialog>`}_renderDecorTextDialog(){const t=this._decorTextDialog,e=(t.pickerEntity||"").trim(),i=e?this.hass?.states?.[e]:null;return W`<hp-dialog .hass=${this.hass} .title=${this._t("decor.text_title")}
      icon="mdi:format-text" dismiss-on-scrim @hp-close=${()=>this._decorTextDialog=null}>
        <div class="body">
          <label>${this._t("decor.text_label")}</label>
          ${""}
          <textarea class="namein dtarea" rows="3" maxlength="200" .value=${t.text} autofocus
            @input=${e=>{const i=e.target;this._decorRememberTextSelection(i),this._decorTextDialog={...t,text:i.value}}}
            @click=${t=>this._decorRememberTextSelection(t.target)}
            @keyup=${t=>this._decorRememberTextSelection(t.target)}
            @select=${t=>this._decorRememberTextSelection(t.target)}
            @blur=${t=>this._decorRememberTextSelection(t.target)}
            @keydown=${t=>{t.stopPropagation(),"Enter"===t.key&&(t.ctrlKey||t.metaKey)&&this._decorSaveText()}}></textarea>
          <hp-color-opacity .label=${this._t("decor.color")} .color=${t.color} .opacity=${t.opacity}
            .opacityLabel=${this._t("space.opacity")}
            @hp-color-opacity-change=${e=>this._decorTextDialog={...t,...e.detail}}></hp-color-opacity>
          <label>${this._t("decor.text_size")}</label>
          <div class="colorrow"><input class="namein" type="number" min="0.1"
            max=${this._decorSmallField($a)} step="0.1"
            .value=${String(this._decorSmallField(t.sizeCm))}
            @input=${e=>this._decorTextDialog={...t,sizeCm:this._decorTextCm(Number(e.target.value))}} />
            <span class="opl">${this._t(this._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span></div>
          <label>${this._t("decor.angle")}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${String(t.angle)}
            @input=${e=>this._decorTextDialog={...t,angle:Ls(Number(e.target.value))}} />
          <label class="dispsection">${this._t("decor.live_group")}</label>
          <label>${this._t("decor.live_entity")}</label>
          <input class="namein" type="text" list="hp-dtext-ents" placeholder=${this._t("decor.live_entity_ph")}
            .value=${t.pickerEntity||""}
            @input=${e=>this._decorTextDialog={...t,pickerEntity:e.target.value}} />
          <datalist id="hp-dtext-ents">
            ${Object.keys(this.hass?.states||{}).map(t=>W`<option value=${t}></option>`)}
          </datalist>
          ${e?W`
            <label>${this._t("decor.live_attr")}</label>
            <select class="namein" .value=${""}
              @change=${t=>{const e=t.target.value;e&&this._decorInsertLiveVariable("__state__"===e?null:e)}}>
              <option value="">${this._t("decor.live_attr_ph")}</option>
              <option value="__state__">${this._t("decor.live_state")}</option>
              ${Object.keys(i?.attributes||{}).filter(t=>!!mi(e,t)).map(t=>W`<option value=${t}>${t}</option>`)}
            </select>
          `:V}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._decorTextDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn primary" ?disabled=${!t.text.trim()} @click=${()=>this._decorSaveText()}>${this._t("btn.save")}</button>
        </div>
    </hp-dialog>`}_renderDecorShapeDialog(){const t=this._decorShapeDialog,e="rect"===t.kind||"ellipse"===t.kind,i=this._t("decor."+t.kind),s=this._t(this._imperial?"gs.unit_ft":"gs.unit_m");return W`<hp-dialog .hass=${this.hass}
      .title=${this._t("decor.object_title",{kind:i})} icon="mdi:pencil-outline"
      dismiss-on-scrim @hp-close=${()=>this._decorShapeDialog=null}>
        <div class="body">
          ${"furniture"===t.kind?W`
            <label>${this._t("furn.symbol")}</label>
            <select class="namein"
              @change=${e=>this._decorShapeDialog={...t,symbol:e.target.value}}>
              ${Do.map(e=>W`<optgroup label=${this._t(`furn.group_${e}`)}>
                ${Ro(e).map(e=>W`<option value=${e.id}
                  ?selected=${e.id===t.symbol}>
                  ${this._t(`furn.sym_${e.id}`)}
                </option>`)}
              </optgroup>`)}
            </select>`:V}
          <hp-color-opacity .label=${this._t("decor.color")} .color=${t.color} .opacity=${t.opacity}
            .opacityLabel=${this._t("space.opacity")}
            @hp-color-opacity-change=${e=>this._decorShapeDialog={...t,...e.detail}}></hp-color-opacity>
          <label>${this._t("decor.width")}</label>
          <div class="colorrow"><input class="namein" type="number"
            min=${this._decorSmallField(.1)} max=${this._decorSmallField(100)} step="0.1"
            .value=${String(this._decorSmallField(t.widthCm))}
            @input=${e=>this._decorShapeDialog={...t,widthCm:this._decorSmallCm(Number(e.target.value))}} /><span class="opl">${this._t(this._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span></div>
          ${"line"===t.kind?W`
            <label>${this._t("decor.length")}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this._decorLargeField(t.lengthCm||0))}
              @input=${e=>this._decorShapeDialog={...t,lengthCm:this._decorLargeCm(Number(e.target.value))}} />
              <span class="opl">${s}</span></div>`:W`
            <label>${this._t("decor.size")}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this._decorLargeField(t.sizeWCm||0))}
              @input=${e=>this._decorShapeDialog={...t,sizeWCm:this._decorLargeCm(Number(e.target.value))}} />
              <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this._decorLargeField(t.sizeHCm||0))}
              @input=${e=>this._decorShapeDialog={...t,sizeHCm:this._decorLargeCm(Number(e.target.value))}} />
              <span class="opl">${s}</span></div>`}
          <label>${this._t("decor.angle")}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${String(t.angle)}
            @input=${e=>this._decorShapeDialog={...t,angle:Ls(Number(e.target.value))}} />
          ${e?W`<label class="dfill"><input type="checkbox" .checked=${!!t.fill}
            @change=${e=>this._decorShapeDialog={...t,fill:e.target.checked}} />${this._t("decor.fill")}</label>
            <hp-color-opacity .label=${this._t("decor.fill_color")}
              .color=${t.fillColor||t.color} .opacity=${t.fillOpacity??.25}
              .opacityLabel=${this._t("space.opacity")} .disabled=${!t.fill}
              @hp-color-opacity-change=${e=>this._decorShapeDialog={...t,fillColor:e.detail.color,fillOpacity:e.detail.opacity}}></hp-color-opacity>`:V}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._decorShapeDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn primary" @click=${()=>this._decorSaveShape()}>${this._t("btn.save")}</button>
        </div>
    </hp-dialog>`}_renderBackdropDialog(){const t=this._backdropDialog,e=this._t(this._imperial?"gs.unit_ft":"gs.unit_m");return W`<hp-dialog .hass=${this.hass} .title=${this._t("decor.backdrop_properties")}
      icon="mdi:image-edit-outline" dismiss-on-scrim @hp-close=${()=>this._backdropDialog=null}>
      <div class="body">
        <label>${this._t("decor.size")}</label>
        <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this._decorLargeField(t.widthCm))}
          @input=${e=>this._backdropDialog={...t,widthCm:this._decorLargeCm(Number(e.target.value))}} />
          <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this._decorLargeField(t.heightCm))}
          @input=${e=>this._backdropDialog={...t,heightCm:this._decorLargeCm(Number(e.target.value))}} />
          <span class="opl">${e}</span></div>
        <label>${this._t("decor.angle")}</label>
        <input class="namein" type="number" min="-180" max="180" step="1" .value=${String(t.angle)}
          @input=${e=>this._backdropDialog={...t,angle:Ls(Number(e.target.value))}} />
      </div>
      <div class="row" slot="footer"><span class="spacer"></span>
        <button class="btn ghost" @click=${()=>this._backdropDialog=null}>${this._t("btn.cancel")}</button>
        <button class="btn primary" @click=${()=>this._saveBackdropDialog()}>${this._t("btn.save")}</button>
      </div>
    </hp-dialog>`}get _openWallHover(){if(!this._markup||"openwall"!==this._tool&&"closewall"!==this._tool||!this._cursorPt)return null;if("closewall"===this._tool){const t=Wn(this._cursorPt,this._openCuts(),6*this._gridPitch);return t?{segs:[t],open:!0}:null}if(this._openWallAnchor){const t=On(this._cursorPt,this._openWallAnchor.edge);return{segs:[[this._openWallAnchor.p[0],this._openWallAnchor.p[1],t[0],t[1]]],open:!1}}return null}_renderOpenWalls(t){if(t&&!t.showBorders&&!this._editing)return B``;const e=this._openCuts(),i=this._openWallHover;if(!e.length&&!i)return B``;const s=this._markup&&("openwall"===this._tool||"closewall"===this._tool);return B`<g class="openwalls ${s?"hot":""}" style="--ow-stroke:${t?.color||"var(--hp-muted)"}">
      ${e.map(t=>B`<line class="openwall"
        x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${i?i.segs.map(t=>B`<line class="openwall-preview ${i.open?"willclose":""}"
            x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`):V}
    </g>`}_openCuts(){const t=this._curSpaceCfg;return Hn(this._spaceModel().rooms,t?.open_spans,La,.02*this._gridPitch)}_openPairs(){const t=this._openCuts();if(!t.length)return[];const e=this._spaceModel().rooms.filter(t=>t.id),i=.02*this._gridPitch,s=[];for(let o=0;o<e.length;o++)for(let n=o+1;n<e.length;n++){const r=ze(e[o]),a=ze(e[n]);if(!r||!a)continue;const l=Li(r,a,i);if(!l.length)continue;const c=t.filter(t=>{const e=[(t[0]+t[2])/2,(t[1]+t[3])/2];return l.some(t=>Zi(e,t)<4*i)});c.length&&s.push({a:e[o],b:e[n],segs:c})}return s}_commitOpenSpans(t){const e=this._curSpaceCfg;if(!e)return;const i=.02*this._gridPitch;this._cfgEpoch++;const s=this._spaceModel().rooms;let o=Nn(e.open_spans);o.length&&t?.old.length?o=Gn(o,t.old,t.next,La):o.length||(o=qn(Hn(s,null,La,i),La)),o=Vn(o,s,La,i),this._persistOpenCuts(o.map(t=>Rn(t,La)))}_persistOpenCuts(t){const e=this._curSpaceCfg;if(!e)return;const i=.02*this._gridPitch,s=Vn(qn(t,La),this._spaceModel().rooms,La,i),o=s.map(t=>Rn(t,La));s.length?e.open_spans=s:delete e.open_spans,Un(e.rooms||[],this._spaceModel().rooms,o,i)}_closeOpenSpan(t){const e=this._curSpaceCfg;if(!e)return;const i=this._geometrySnapshot(),s=.02*this._gridPitch,o=this._openCuts();let n=Array.isArray(e.walls)?e.walls.slice():[];for(const t of wn(this._spaceModel().rooms,n,o,this._wallKeyPitch,this._cellCm,this._gridPitch,La))!t.open&&t.cm>0&&(n=an(n,t.a,t.b,t.cm,this._wallKeyPitch,La));const r=function(t,e,i){const s=[(e[0]+e[2])/2,(e[1]+e[3])/2];return t.filter(t=>{const e=[(t[0]+t[2])/2,(t[1]+t[3])/2];return Math.hypot(e[0]-s[0],e[1]-s[1])>4*i})}(o,t,s);let a=this._normalizeWalls(n,r);if(!(xn(this._spaceModel().rooms,a,r,t,this._wallKeyPitch,this._cellCm,this._gridPitch,La)>0)){const e=[];for(const t of wn(this._spaceModel().rooms,a,r,this._wallKeyPitch,this._cellCm,this._gridPitch,La))t.open||e.push([t.a[0],t.a[1],t.b[0],t.b[1]]);a=Bn(a,t,e,this._wallKeyPitch,La,15),a=this._normalizeWalls(a,r)}a.length?e.walls=a:delete e.walls,this._persistOpenCuts(r),this._showToast(this._t("toast.openwall_closed_span")),this._recordGeometry(this._t("history.close_boundary"),i),this._saveConfig(),this.requestUpdate()}_openWallClick(t){const e=6*this._gridPitch,i=.02*this._gridPitch,s=this._openCuts();if(this._openWallAnchor){const{p:o,edge:n}=this._openWallAnchor,r=On(Fn(t,n,jn(n,s,i),this._gridPitch,1.5*this._gridPitch),n),a=Math.hypot(r[0]-o[0],r[1]-o[1]);if(this._openWallAnchor=null,a<.5*this._gridPitch)return void this._showToast(this._t("toast.openwall_short"));if(Zi(t,n)>e)return void this._showToast(this._t("toast.openwall_pick"));const l=[o[0],o[1],r[0],r[1]],c=[...s,l],h=this._curSpaceCfg;if(!h)return;const d=this._geometrySnapshot(),p=this._normalizeWalls(h.walls,c);p.length?h.walls=p:delete h.walls;const u=(h.openings||[]).length;return h.openings=function(t,e,i,s){return t?.length?t.filter(t=>Zi([Number(t.x)*i,Number(t.y)*i],e)>s||!nn([e[0],e[1]],[e[2],e[3]],Number(t.angle)||0)):t?t.slice():[]}(h.openings,l,La,e),(h.openings||[]).length<u&&this._showToast(this._t("toast.openwall_openings_removed")),this._persistOpenCuts(c),this._showToast(this._t("toast.openwall_opened_span")),this._recordGeometry(this._t("history.open_boundary"),d),this._saveConfig(),void this.requestUpdate()}if(Wn(t,s,e))return void this._showToast(this._t("toast.closewall_use_tool"));const o=function(t,e,i,s){const o=(e||[]).filter(t=>t?.id);let n=null;for(let e=0;e<o.length;e++){const r=ze(o[e]);if(r)for(let a=e+1;a<o.length;a++){const l=ze(o[a]);if(l)for(const c of Li(r,l,s)){const s=Zi(t,c);s<=i&&(!n||s<n.d)&&(n={a:o[e],b:o[a],edge:c,d:s})}}}return n?{a:n.a,b:n.b,edge:n.edge}:null}(t,this._spaceModel().rooms,e,i);if(!o){const s=Ln(t,this._spaceModel().rooms,e,i);return void this._showToast(this._t(s?"toast.openwall_shared_only":"toast.openwall_pick"))}const n=jn(o.edge,s,i),r=Fn(t,o.edge,n,this._gridPitch,1.5*this._gridPitch);this._openWallAnchor={p:r,edge:o.edge,aId:o.a.id,bId:o.b.id}}_closeWallClick(t){const e=Wn(t,this._openCuts(),6*this._gridPitch);e?this._closeOpenSpan(e):this._showToast(this._t("toast.closewall_pick"))}_deleteRoomClick(t){const e=[...this._spaceModel().rooms].reverse().find(e=>this._pointInRoom(t,e));if(!e)return void this._showToast(this._t("toast.delete_room_pick"));if(!confirm(this._t("confirm.delete_room",{name:e.name})))return;const i=this._curSpaceCfg;if(!i)return;const s=this._geometrySnapshot();i.rooms=i.rooms.filter(t=>t.id!==e.id),this._commitOpenSpans(),this._recordGeometry(this._t("history.delete_room"),s),this._saveConfig(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}get _wallKeyPitch(){return ro}get _spaceWalls(){const t=this._curSpaceCfg?.walls;return Array.isArray(t)?t:[]}_cfgOpenCuts(){return Nn(this._curSpaceCfg?.open_spans).map(t=>[t.a[0],t.a[1],t.b[0],t.b[1]])}_intervalCm(t){return xn(this._spaceModel().rooms,this._spaceWalls,this._openCuts(),t,this._wallKeyPitch,this._cellCm,this._gridPitch,La)}_normalizeWalls(t,e){return on(kn(this._spaceModel().rooms,t,e,this._wallKeyPitch,this._cellCm,this._gridPitch,La),this._curSpaceCfg?.rooms||[],ro,1,e.map(t=>[t[0]/La,t[1]/La,t[2]/La,t[3]/La]))}_paperShapes(t){const e=this._spaceWalls;if(!e.length)return Te(t);const i=this._openPairs().flatMap(t=>t.segs);return zn(t,e,i,this._wallKeyPitch,this._cellCm,this._gridPitch,La)}_thickWallCuts(){const t=this._spaceWalls;if(!t.length)return[];const e=this._openPairs().flatMap(t=>t.segs);return function(t,e,i,s,o,n,r=1){if(!e?.length)return[];const a=new Set,l=[];for(const c of t||[]){if(!c?.id)continue;const h=yn(t,c.id,e,i,s,o,n,r);if(!h)continue;const d=h.poly;for(let t=0;t<d.length;t++){const e=d[t],i=d[(t+1)%d.length],c=h.kinds[t];if(!c)continue;const p=h.cms[t];if(!(p>0))continue;const u=Yo(e,i,s,r);if(a.has(u))continue;a.add(u);const _=jo(p,o,n),[m,g]=pn(d,t),f=-m,v=-g,b=_/2,y=[[e[0]+f*b,e[1]+v*b],[i[0]+f*b,i[1]+v*b],[i[0]+m*b,i[1]+g*b],[e[0]+m*b,e[1]+g*b]];l.push({key:u,kind:c,cm:p,quad:y,a:[e[0],e[1]],b:[i[0],i[1]],depthUnits:_})}}return l}(this._spaceModel().rooms,t,e,this._wallKeyPitch,this._cellCm,this._gridPitch,La).map(t=>[t.a[0],t.a[1],t.b[0],t.b[1]])}_wallThickHit(t){const e=6*this._gridPitch,i=this._openCuts();let s=null;for(const o of wn(this._spaceModel().rooms,this._spaceWalls,i,this._wallKeyPitch,this._cellCm,this._gridPitch,La)){const i=Zi(t,[o.a[0],o.a[1],o.b[0],o.b[1]]);i<=e&&(!s||i<s.d)&&(s={iv:o,d:i})}if(!s)return null;const o=s.iv;return{a:o.a,b:o.b,roomId:o.roomId,segs:[[o.a[0],o.a[1],o.b[0],o.b[1]]],open:o.open,cm:o.cm}}get _wallThickHover(){if(!this._markup||"wallthick"!==this._tool||!this._cursorPt||this._wallDialog)return null;const t=this._wallThickHit(this._cursorPt);if(!t)return null;const e=t.cm,i=e>0?jo(e,this._cellCm,this._gridPitch):3*this._gridPitch,s=Math.max(i/2,1.25*this._gridPitch);let o="";for(const e of t.segs)o+=(o?" ":"")+cn([[e[0],e[1]],[e[2],e[3]]],s,!1);return{segs:t.segs,open:t.open,d:o}}_wallThickClick(t){const e=this._wallThickHit(t);if(!e)return void this._showToast(this._t("toast.wallthick_pick"));if(e.open)return void this._showToast(this._t("toast.wallthick_open"));const i=e.cm,s=this._viewOr(this._baseVb()),o=(e.a[0]+e.b[0])/2,n=(e.a[1]+e.b[1])/2;this._wallDialog={a:e.a,b:e.b,value:Wo(i,this._imperial),roomId:e.roomId,sx:(o-s.x)/s.w*100,sy:(n-s.y)/s.h*100}}_wallThickApply(t){const e=this._wallDialog;if(!e)return;const i=this._curSpaceCfg;if(!i)return;const s=this._geometrySnapshot(),o=Bo(e.value,this._imperial),n=this._openCuts();let r;r=t&&e.roomId?ln(i.walls,this._spaceModel().rooms,e.roomId,o,this._wallKeyPitch,n,La):an(i.walls,e.a,e.b,o,this._wallKeyPitch,La),r=this._normalizeWalls(r,n),r.length?i.walls=r:delete i.walls,this._wallDialog=null,this._showToast(this._t(null==o?"toast.wallthick_cleared":"toast.wallthick_set")),this._recordGeometry(this._t("history.wall_thickness"),s),this._saveConfig(),this.requestUpdate()}_wallHatchDefs(t){if(!this._spaceWalls.length&&!this._markup)return B``;const e=Math.max(.4,1/Math.max(this._zoom,.4)),i=t||"#607d8b";return B`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse" width="8" height="8"
        patternTransform="rotate(45) scale(${e.toFixed(3)})">
        <path d="M0 0 L0 8" stroke="${i}" stroke-width="2"></path>
      </pattern>
    </defs>`}_renderWallBodies(t){if(t&&!t.showBorders&&!this._markup)return B``;const e=this._spaceWalls;if(!e.length)return B``;const i=this._openPairs().flatMap(t=>t.segs),s=(this._curSpaceCfg?.openings||[]).map(t=>({x:Number(t.x)*La,y:Number(t.y)*La,angle:Number(t.angle)||0,length:(Number(t.length)>0?Number(t.length):.9)*La})),o=Cn(this._spaceModel().rooms,e,i,s,this._wallKeyPitch,this._cellCm,this._gridPitch,La);if(!o)return B``;const n=this._stageEl,r=this._viewOr(this._baseVb()),a=n&&n.clientWidth&&r.w?n.clientWidth/r.w:1,l=t?.color||"#607d8b",c=qo(o.depthUnits,a),h=this._fillColors.wall_fill;return B`<g class="wallbodies" style="--room-stroke:${l};--wall-fill:${h.c};--wall-fill-op:${h.a}">
      <path class="wallbody-fill" d="${o.d}"
        fill="${h.c}" fill-opacity="${h.a}" fill-rule="evenodd"
        stroke="none" pointer-events="none"></path>
      <path class="wallbody ${c?"solid":""}"
        data-hp="wall" data-id="union" data-kind="union"
        d="${o.d}" fill="${c?"none":"url(#hp-wall-hatch)"}" fill-rule="evenodd"
        stroke="${l}" stroke-width="0.6" pointer-events="none"></path>
    </g>`}_renderRoomHover(t){const e=this._hoverRoom;if("view"!==this._mode||!e||e.space!==t.id)return B``;const i=t.rooms.find(t=>t===e.room||!!t.id&&t.id===e.room.id);if(!i)return B``;const s=ze(i);if(!s)return B``;const o=t.rooms.filter(t=>t!==i).map(t=>({room:t,poly:ze(t)})).filter(t=>!!t.poly),n=Ke(s,o.map(t=>t.poly)),r=this._openPairs(),a=r.flatMap(t=>t.segs),l=i.id?r.filter(t=>t.a.id===i.id||t.b.id===i.id).flatMap(t=>t.segs):r.flatMap(t=>t.segs),c=this._spaceWalls,h=[{axis:s,face:c.length&&i.id&&Sn(t.rooms,i.id,c,a,this._wallKeyPitch,this._cellCm,this._gridPitch,La)||s}];for(const e of n){const i=o.find(t=>t.poly===e)?.room;let s=e;if(c.length&&i?.id){const o=yn(t.rooms,i.id,c,a,this._wallKeyPitch,this._cellCm,this._gridPitch,La);o&&(s=Dn(o.poly,o.offsets)||e)}h.push({axis:e,face:s})}const d=this._openingsR.map(t=>{const e=t.angle*Math.PI/180,i=Math.cos(e)*t.rlen/2,s=Math.sin(e)*t.rlen/2;return[t.rx-i,t.ry-s,t.rx+i,t.ry+s]}),p=.02*this._gridPitch,u=l.concat(d),_=h.map(({axis:t,face:e})=>{const i=u.map(i=>((t,e,i)=>{const s=t[2]-t[0],o=t[3]-t[1],n=Math.hypot(s,o);if(n<p)return null;const r=s/n,a=o/n,l=(t[0]+t[2])/2,c=(t[1]+t[3])/2;let h=!1;for(let t=0;t<e.length;t++){const i=e[t],s=e[(t+1)%e.length],o=s[0]-i[0],n=s[1]-i[1],d=Math.hypot(o,n);if(!(d<p||Math.abs(r*(n/d)-a*(o/d))>.05)&&Zi([l,c],[i[0],i[1],s[0],s[1]])<=4*p){h=!0;break}}if(!h)return null;let d=null;for(let t=0;t<i.length;t++){const e=i[t],s=i[(t+1)%i.length],o=s[0]-e[0],n=s[1]-e[1],h=Math.hypot(o,n);if(h<p||Math.abs(r*(n/h)-a*(o/h))>.05)continue;const u=Zi([l,c],[e[0],e[1],s[0],s[1]]);(!d||u<d.d)&&(d={a:e,b:s,d:u})}if(!d)return null;const u=d.b[0]-d.a[0],_=d.b[1]-d.a[1],m=Math.hypot(u,_)||1,g=-_/m,f=u/m,v=(d.a[0]-l)*g+(d.a[1]-c)*f;return[t[0]+g*v,t[1]+f*v,t[2]+g*v,t[3]+f*v]})(i,t,e)).filter(t=>!!t);return i.length?Ui(e,i,p).map(t=>`M ${t[0]} ${t[1]} L ${t[2]} ${t[3]}`).join(" "):`M ${e.map(t=>`${t[0]} ${t[1]}`).join(" L ")} Z`}).filter(Boolean).join(" ");return _?B`<path class="room-hover-outline" d="${_}"></path>`:B``}_renderWallThickUi(){const t=this._wallThickHover;return t&&t.d?B`<path class="wallthick-hover ${t.open?"isopen":""}"
      d="${t.d}"></path>`:B``}_renderWallThickDialog(){const t=this._wallDialog;return t?W`<div class="wallthick-dlg" style="left:${t.sx.toFixed(2)}%;top:${t.sy.toFixed(2)}%"
      @click=${t=>t.stopPropagation()}>
      <div class="row">
        <label>${this._t("wallthick.field")}</label>
        <input type="number" min="0" max="100" step="any" .value=${t.value}
          @input=${e=>{this._wallDialog={...t,value:e.target.value}}}
          @keydown=${t=>{"Enter"===t.key&&(t.preventDefault(),this._wallThickApply(!1))}} />
        <span class="opl">${this._t(this._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span>
      </div>
      <div class="row">
        <button class="btn ghost" @click=${()=>this._wallThickApply(!0)}>
          ${this._t("wallthick.apply_room")}
        </button>
        <span class="spacer"></span>
        <button class="btn on" @click=${()=>this._wallThickApply(!1)}>
          <ha-icon icon="mdi:check"></ha-icon>
        </button>
      </div>
    </div>`:W``}_openingClick(t){const e=1.5*this._gridPitch,i=this._openingsR.find(i=>Math.hypot(t[0]-i.rx,t[1]-i.ry)<=Math.max(i.rlen/2,e));if(i)return void this._editOpening(i);const s=Re(t,this._spaceModel().rooms,e);if(!s)return void this._showToast(this._t("toast.opening_no_wall"));if(function(t,e,i,s,o){for(const n of s)if(!(Zi([t,e],n)>o)&&nn([n[0],n[1]],[n[2],n[3]],i))return!0;return!1}(s.x,s.y,s.angle,this._openCuts(),e))return void this._showToast(this._t("toast.opening_on_virtual"));const o=this._opRuler(s,this._cmToUnits(90));this._openingDialog={type:"door",lengthCm:90,contact:"",lock:"",invert:!1,flipH:!1,flipV:!1,x:o.x,y:o.y,angle:o.angle},this._cursorPt=null}_editOpening(t){this._openingDialog={id:t.id,type:t.type,lengthCm:Math.round(t.rlen/this._gridPitch*this._cellCm),contact:t.contact||"",lock:t.lock||"",invert:!!t.invert,flipH:!!t.flip_h,flipV:!!t.flip_v,x:t.rx,y:t.ry,angle:t.angle}}_opPointerDown(t,e){if("plan"===this._mode&&"resize"!==this._tool){t.preventDefault(),t.stopPropagation();try{Ba(t)}catch{}this._opDrag={id:e.id,moved:!1,sx:t.clientX,sy:t.clientY,dirty:!1,before:this._geometrySnapshot()}}}_opPointerMove(t,e){if(!this._opDrag||this._opDrag.id!==e.id)return;if(Math.abs(t.clientX-this._opDrag.sx)+Math.abs(t.clientY-this._opDrag.sy)<=3)return;const i=Re(this._svgPoint(t),this._spaceModel().rooms,4*this._gridPitch);if(!i)return;this._opDrag.moved=!0;const s=this._curSpaceCfg,o=s?.openings?.find(t=>t.id===e.id);if(!o)return;const n=this._opRuler(i,o.length*La);this._opMeasure=n.measure;const r=n.x/La,a=n.y/this._spaceH;o.x===r&&o.y===a&&o.angle===i.angle||(this._opDrag.dirty=!0),o.x=r,o.y=a,o.angle=i.angle,this.requestUpdate()}_opRuler(t,e){const i=this._spaceModel().rooms,s=this._gridPitch/2;let o=t.x,n=t.y,r=Ae([o,n],t.angle,e,i,s);if(r&&r.centered&&(o!==r.wallCenter[0]||n!==r.wallCenter[1]))[o,n]=r.wallCenter,r=Ae([o,n],t.angle,e,i,s);else if(r){const[a,l]=r.wallA,[c,h]=r.wallB,d=c-a,p=h-l,u=Math.hypot(d,p);if(u>0){const c=this._gridPitch,h=Math.min(e/2,u/2);let _=Math.round(((o-a)*d+(n-l)*p)/u/c)*c;_=Math.max(h,Math.min(u-h,_)),o=a+_/u*d,n=l+_/u*p,r=Ae([o,n],t.angle,e,i,s)||r}}if(!r)return{x:o,y:n,angle:t.angle,measure:null};const a="mi"===this.hass?.config?.unit_system?.length,l=(t,e)=>({x:e[0],y:e[1],text:Ce(t/this._gridPitch*this._cellCm,a)});return{x:o,y:n,angle:t.angle,measure:{labels:[l(r.sideA,r.midA),l(r.sideB,r.midB)],guide:r.centered?{x:r.wallCenter[0],y:r.wallCenter[1],angle:t.angle}:null}}}_opPointerUp(t,e){if(!this._opDrag||this._opDrag.id!==e.id)return;const i=this._opDrag,s=i.moved;this._opMeasure=null,s&&i.dirty&&(this._recordGeometry(this._t("history.move_opening"),i.before),this._saveConfig()),s?window.setTimeout(()=>this._opDrag=null,0):this._opDrag=null}_opClick(t,e){"plan"===this._mode&&"resize"===this._tool||(t.stopPropagation(),this._opDrag?.moved||"plan"===this._mode&&this._editOpening(e))}_saveOpening(){const t=this._openingDialog,e=this._curSpaceCfg;if(!t||!e)return;const i=this._geometrySnapshot(),s=this._spaceH,o={id:t.id||"o"+Date.now().toString(36),type:t.type,x:t.x/La,y:t.y/s,angle:t.angle,length:this._cmToUnits(Math.max(20,t.lengthCm))/La,contact:t.contact||null,lock:"door"===t.type&&t.lock||null,invert:t.invert||void 0,flip_h:t.flipH||void 0,flip_v:t.flipV||void 0};e.openings=e.openings||[];const n=e.openings.findIndex(t=>t.id===o.id);n>=0?e.openings[n]=o:e.openings.push(o),this._recordGeometry(this._t(t.id?"history.edit_opening":"history.add_opening"),i),this._saveConfig(),this._openingDialog=null,this.requestUpdate()}_deleteOpening(){const t=this._openingDialog,e=this._curSpaceCfg;if(!t?.id||!e?.openings)return;const i=this._geometrySnapshot();e.openings=e.openings.filter(e=>e.id!==t.id),this._recordGeometry(this._t("history.delete_opening"),i),this._saveConfig(),this._openingDialog=null,this.requestUpdate()}_contactCandidates(){const t=[];for(const e of Object.keys(this.hass.states)){if(!this._planEntityAvailable(e))continue;const i=e.split(".")[0];if("binary_sensor"!==i&&"cover"!==i)continue;const s=this.hass.states[e],o=["door","window","opening","garage_door","garage"].includes(s?.attributes?.device_class||"");("cover"!==i||o)&&t.push([e,s?.attributes?.friendly_name||e,o?0:1])}return t.sort((t,e)=>t[2]-e[2]||t[1].localeCompare(e[1])).map(([t,e])=>({value:t,label:e}))}_lockCandidates(){return Object.keys(this.hass.states).filter(t=>t.startsWith("lock.")&&this._planEntityAvailable(t)).map(t=>({value:t,label:this.hass.states[t]?.attributes?.friendly_name||t})).sort((t,e)=>t.label.localeCompare(e.label))}_mergeClick(t){const e=this._spaceModel().rooms,i=[...e].reverse().find(e=>this._pointInRoom(t,e));if(!i?.id)return;const s=i.id;if(!this._mergeSel||this._mergeSel===s)return void(this._mergeSel=this._mergeSel===s?null:s);const o=e.find(t=>t.id===this._mergeSel),n=o?ze(o):null,r=ze(i),a=n&&r?function(t,e){if(!t||!e||t.length<3||e.length<3)return null;const i=ke(Je(t),Je(e));if(1!==i.length)return null;if(1!==i[0].length)return null;const s=i[0][0].slice(0,-1).map(t=>[t[0],t[1]]);return s.length>=3?s:null}(n,r):null;if(!a)return this._showToast(this._t("toast.merge_not_adjacent")),void(this._mergeSel=null);this._mergeDialog={aId:this._mergeSel,bId:s,poly:a,pick:"a"},this._mergeSel=null}_commitMerge(){const t=this._mergeDialog,e=this._curSpaceCfg;if(!t||!e)return;const i=this._geometrySnapshot(),s=this._spaceH,o="a"===t.pick?t.aId:t.bId,n="a"===t.pick?t.bId:t.aId,r=e.rooms.find(t=>t.id===o);r?(r.poly=t.poly.map(t=>[t[0]/La,t[1]/s]),delete r.x,delete r.y,delete r.w,delete r.h,e.rooms=e.rooms.filter(t=>t.id!==n),this._commitOpenSpans(),this._recordGeometry(this._t("history.merge_rooms"),i),this._saveConfig(),this._mergeDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.rooms_merged",{name:r.name||""}))):this._mergeDialog=null}_splitClick(t){const e=this._spaceModel().rooms;if(!this._splitSel){const i=[...e].reverse().find(e=>this._pointInRoom(t,e));if(!i?.id)return;return void(this._splitSel={roomId:i.id,pts:[]})}const i=e.find(t=>t.id===this._splitSel.roomId),s=i?ze(i):null;if(!i||!s)return void(this._splitSel=null);const o=.02*this._gridPitch,n=6*this._gridPitch,r=Ie(t,s),a=r&&function(t,e,i){let s=null,o=1/0;for(let n=0;n<e.length;n++){const[r,a]=e[n],[l,c]=e[(n+1)%e.length],h=l-r,d=c-a,p=h*h+d*d;if(!p)continue;let u=((t[0]-r)*h+(t[1]-a)*d)/p;u=Math.max(0,Math.min(1,u));const _=Math.hypot(t[0]-(r+u*h),t[1]-(a+u*d));if(_>=o)continue;o=_;const m=Math.sqrt(p),g=(i>0?Math.max(0,Math.min(m,Math.round(u*m/i)*i)):u*m)/m;s=[r+g*h,a+g*d]}return s}(r,s,this._gridPitch)||r,l=r&&a&&Math.hypot(r[0]-t[0],r[1]-t[1])<=n?a:null,c=!!l&&Le(l,s,o),h=this._splitSel.pts;if(!h.length)return c?void(this._splitSel={...this._splitSel,pts:[l]}):void this._showToast(this._t("toast.split_pick_wall"));if(!c){const e=this._snap(t);return He(e,s,o)?void(this._splitSel={...this._splitSel,pts:[...h,e]}):void this._showToast(this._t("toast.split_pick_inside"))}const d=function(t,e,i=1e-6){if(!t||t.length<3||!e||e.length<2)return null;const s=e[0],o=e[e.length-1];if(Ee(s,o,i))return null;const n=Ze(t,s,i),r=Ze(t,o,i);if(n<0||r<0)return null;const a=e.slice(1,-1);for(const e of a)if(!He(e,t,i))return null;for(let i=0;i<e.length-1;i++)for(let s=0;s<t.length;s++)if(Ue(e[i],e[i+1],t[s],t[(s+1)%t.length]))return null;for(let t=0;t<e.length-1;t++)for(let i=t+2;i<e.length-1;i++)if(Ue(e[t],e[t+1],e[i],e[i+1]))return null;if(2===e.length&&!He([(s[0]+o[0])/2,(s[1]+o[1])/2],t,i))return null;const l=(e,s,o,n)=>{const r=[e];let a=(s+1)%t.length;for(let e=0;e<=t.length&&(r.push(t[a]),a!==n);e++)a=(a+1)%t.length;return r.push(o),Xe(r,i)};let c,h;if(n===r){const r=Xe([...e],i);if(r.length<3||Ye(r)<=i)return null;const a=[];for(let i=0;i<t.length;i++)if(a.push(t[i]),i===n){const i=(t[(n+1)%t.length][0]-t[n][0])*(o[0]-s[0])+(t[(n+1)%t.length][1]-t[n][1])*(o[1]-s[1])>=0?e:[...e].reverse();for(const t of i)a.push(t)}c=Xe(a,i),h=r}else c=Xe([...l(s,n,o,r),...[...a].reverse()],i),h=Xe([...l(o,r,s,n),...a],i);return c.length<3||h.length<3||Ye(c)<=i||Ye(h)<=i||Math.abs(Ye(c)+Ye(h)-Ye(t))>Math.max(i,1e-6*Ye(t))?null:[c,h]}(s,[...h,l],o);if(!d)return void this._showToast(this._t("toast.split_bad_cut"));this._resetRoomDialogFields();const[p,u]=d,_=Ye(p)>=Ye(u)?p:u,m=_===p?u:p;this._pendingSplit={roomId:i.id,mainPoly:_,newPoly:m},this._cursorPt=null,this._nameSel="",this._areaSel="",this._roomDialog=!0}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])}_markupMove(t){if(!this._markup)return;if("opening"===this._tool||"openwall"===this._tool||"closewall"===this._tool||"wallthick"===this._tool)return void(this._cursorPt=this._svgPoint(t));const e="draw"===this._tool&&this._path.length&&!this._contourClosed,i="split"===this._tool&&!!this._splitSel?.pts?.length;(e||i)&&(this._cursorPt=this._snap(this._svgPoint(t)))}get _openingPreview(){if("opening"!==this._tool||!this._cursorPt)return null;const t=this._cursorPt,e=1.5*this._gridPitch,i=this._openingsR.find(i=>Math.hypot(t[0]-i.rx,t[1]-i.ry)<=Math.max(i.rlen/2,e));if(i)return null;const s=this._cmToUnits(90),o=Re(t,this._spaceModel().rooms,e);if(!o)return null;const n=this._opRuler(o,s);return{x:n.x,y:n.y,angle:n.angle,rlen:s,measure:n.measure}}get _opMeasureView(){return this._opMeasure||this._openingPreview?.measure||null}_saveRoom(){this._areaSel&&this._commitRoom()}_saveRoomNoArea(){this._nameSel.trim()&&(this._areaSel="",this._commitRoom())}_commitRoom(){const t=this._curSpaceCfg;if(!t)return;const e=this._geometrySnapshot(),i=this._spaceH,s=!!this._pendingSplit;let o;if(this._pendingSplit){const e=t.rooms.find(t=>t.id===this._pendingSplit.roomId);if(!e)return this._pendingSplit=null,this._splitSel=null,void(this._roomDialog=!1);e.poly=this._pendingSplit.mainPoly.map(t=>[t[0]/La,t[1]/i]),delete e.x,delete e.y,delete e.w,delete e.h,o=this._pendingSplit.newPoly}else{if(!this._contourClosed)return;o=this._path.slice(0,-1)}const n=this._areaSel?this.hass.areas[this._areaSel]?.name:"",r={id:"r"+Date.now().toString(36),name:this._nameSel||n||this._t("room.default_name"),area:this._areaSel||null,poly:o.map(t=>[t[0]/La,t[1]/i]),...this._roomSettingsFromDialog()?{settings:this._roomSettingsFromDialog()}:{}};if(t.rooms.push(r),s&&this._commitOpenSpans(),!s){const e=this._drawWallCm;if(null!=e){this._cfgEpoch++;const i=this._openCuts();let s=function(t,e,i,s,o,n=[],r=1){if(null==s||s<1)return t?t.slice():[];const a=vn(e,i,n,o,r,t);if(!a)return t?t.slice():[];const l=bn(t,a,o,r);let c=t?t.slice():[];for(let t=0;t<a.poly.length;t++){const e=a.poly[t],i=a.poly[(t+1)%a.poly.length];hn(e,i,n,o,r)||l[t]>0||(c=an(c,e,i,s,o,r))}return c}(t.walls,this._spaceModel().rooms,r.id,e,this._wallKeyPitch,i,La);s=this._normalizeWalls(s,i),s.length?t.walls=s:delete t.walls}}this._recordGeometry(this._t(s?"history.split_room":"history.add_room"),e),this._saveConfig(),this._path=[],this._pendingSplit=null,this._splitSel=null;const a=this._areaSel;this._areaSel="",this._nameSel="",this._roomDialog=!1,this._regSignature="",this._maybeRebuildDevices();let l=0;if(a){const t=La,e={...this._layout};for(const i of this._devices){if(i.area!==a||i.space!==this._space)continue;if(l++,this._layout[i.id])continue;const s=this._defPos[i.id];s&&(e[i.id]={s:this._space,x:s.x/La,y:s.y/t},this._dirtyPos.add(i.id))}this._layout=e,this._persistLayout()}const c=this._model.find(t=>t.id===this._space)?.rooms.length||0;this._showToast(a?this._t("toast.room_saved",{n:c,added:l}):this._t("toast.room_saved_no_area",{n:c}))}_cancelPath(){this._path=[],this._cursorPt=null,this._roomDialog=!1,this._pendingSplit=null,this._splitSel=null,this._mergeSel=null,this._mergeDialog=null,this._openWallAnchor=null}_roomDialogCancel(){return this._roomDialog=!1,this._roomEditId?(this._roomEditId=null,this._nameSel="",void(this._areaSel="")):this._pendingSplit?(this._pendingSplit=null,void(this._splitSel=null)):void this._undoPoint()}get _freeAreas(){const t=new Set;for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.add(i.area);return Object.values(this.hass?.areas||{}).filter(e=>!t.has(e.area_id)).sort((t,e)=>(t.name||"").localeCompare(e.name||""))}_openMarkerDialog(t){t&&this._ackNewDevice(t.id),this._norm?this._markerDialog=t?{devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingMode:"virtual"===t.bindingKind?"virtual":"ha",bindingOpen:!1,showEntities:"entity"===t.bindingKind&&!!this.hass.entities[t.bindingRef||""]?.device_id,bindingFilter:"",icon:t.marker?.icon||"",autoIcon:t.icon||"",display:"ripple"===t.marker?.display?"icon_ripple":t.marker?.display||"badge",rippleColor:t.marker?.ripple_color||"",rippleSize:Number(t.marker?.ripple_size)>0?Number(t.marker.ripple_size):3,size:Number(t.marker?.size)>0?Number(t.marker.size):1,angle:Number(t.marker?.angle)||0,tapAction:t.marker?.tap_action||"",tapTarget:t.marker?.tap_target||"",tapConfirm:!0===t.marker?.tap_confirm,runFilter:"",defaultTap:"light"===t.primary?.split(".")[0]?"toggle":"info",controls:zr(t.marker?.binding,t.marker?.controls,t.entities),controlsFilter:"",isLight:!0===t.marker?.is_light||Tr(t.marker?.binding,t.marker?.controls,t.entities),useClimateTemp:!0===t.marker?.use_climate_temp,glowRadius:Number(t.marker?.glow_radius_cm)>0?String(this._imperial?Math.round(Number(t.marker.glow_radius_cm)/30.48*10)/10:Math.round(Number(t.marker.glow_radius_cm))/100):"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.marker?.room_id?t.space+"#@"+t.marker.room_id:t.space&&t.area?t.space+"#"+t.area:"",hideFromPlan:!0===t.marker?.hidden,busy:!1}:{name:"",binding:"virtual",bindingMode:"virtual",bindingOpen:!1,showEntities:!1,bindingFilter:"",icon:"",autoIcon:"",display:"badge",rippleColor:"",rippleSize:3,size:1,angle:0,tapAction:"",tapTarget:"",tapConfirm:!1,runFilter:"",defaultTap:"info",controls:[],controlsFilter:"",isLight:!1,useClimateTemp:!1,glowRadius:"",model:"",link:"",description:"",pdfs:[],room:"",hideFromPlan:!1,busy:!1,uploadId:"up_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}:this._showToast(this._t("toast.marker_needs_server"))}_runCandidates(){const t=[];for(const e of di)for(const[i,s]of Object.entries(this.hass.states))i.startsWith(e+".")&&t.push({value:i,label:s?.attributes?.friendly_name||i,sub:this._t("run."+e)});return t.sort((t,e)=>t.sub.localeCompare(e.sub)||t.label.localeCompare(e.label))}_bindingCandidates(){const t=this.hass,e=Ur(this._markers),i=new Set(this._markers.filter(t=>t.removed).map(t=>t.binding)),s=new Set;for(const t of this._devices)t.id!==this._markerDialog?.devId&&("device"===t.bindingKind&&t.bindingRef&&s.add("device:"+t.bindingRef),"entity"===t.bindingKind&&t.bindingRef&&s.add("entity:"+t.bindingRef));const o=new Set;for(const t of this._devices)"device"===t.bindingKind&&t.name&&o.add(t.name.trim()+"|"+(t.area||""));const n=[];for(const e of Object.values(t.devices)){if("service"===e.entry_type)continue;const t="device:"+e.id;if(s.has(t))continue;const r=(e.name_by_user||e.name||e.id).trim();t!==this._markerDialog?.binding&&!i.has(t)&&o.has(r+"|"+(e.area_id||""))||n.push({value:t,label:r,sub:(e.model||this._t("marker.sub_device"))+("Group"===e.model?this._t("marker.sub_z2m_group"):"")})}const r=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);for(const[o,a]of Object.entries(t.entities)){const l="entity:"+o;if(s.has(l))continue;if(Wr(t,o,e)&&!i.has(l))continue;const c=r.has(a.platform),h="group"===a.platform;if(!c&&!h)continue;if(a.hidden&&!i.has(l))continue;const d=t.states[o];n.push({value:l,label:a.name||d?.attributes?.friendly_name||o,sub:o.split(".")[0]+" · "+("group"===a.platform?this._t("marker.sub_group"):this._t("marker.sub_helper"))})}if(this._markerDialog?.showEntities){const o=new Set(n.map(t=>t.value));for(const[r,a]of Object.entries(t.entities)){const l="entity:"+r;if(s.has(l)||o.has(l)||a.hidden&&!i.has(l))continue;if(Wr(t,r,e)&&!i.has(l))continue;const c=t.states[r],h=a.name||c?.attributes?.friendly_name||r,d=a.device_id?t.devices[a.device_id]:null,p=d&&(d.name_by_user||d.name)||"";n.push({value:l,label:h,sub:r.split(".")[0]+" · "+this._t("marker.sub_entity")+(p?" · "+p:"")})}}const a=(this._markerDialog?.bindingFilter||"").toLowerCase().trim(),l=a?n.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(a)):n;return l.sort((t,e)=>t.label.localeCompare(e.label)),l.slice(0,200)}_autoIconForBinding(t){if("virtual"===t)return"mdi:map-marker";const[e,i]=t.split(":");if(!i)return"";if("device"===e){const t=this.hass.devices?.[i];if(!t)return"mdi:help-circle";const e=Object.entries(this.hass.entities||{}).filter(([,t])=>t?.device_id===i).map(([t])=>t);return e.some(t=>t.startsWith("lock."))?"mdi:lock":qr(this.hass,t.name_by_user||t.name||"",t.model,e,this._iconRules)}if("entity"===e){const t=this.hass.entities?.[i],e=this.hass.states?.[i],s=t?.name||e?.attributes?.friendly_name||i;return i.startsWith("lock.")?"mdi:lock":qr(this.hass,s,"",[i],this._iconRules)}return""}_allRoomsFlat(){const t=[];for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area?t.push({value:e.id+"#"+i.area,label:(e.title||e.id)+" · "+i.name}):i.id&&t.push({value:e.id+"#@"+i.id,label:(e.title||e.id)+" · "+i.name+" · "+this._t("marker.subarea")});return t}_errText(t){if(!t)return this._t("err.unknown");if("string"==typeof t)return t;if(t.message)return t.message;if(t.error)return t.error;if(null!=t.code)return this._t("err.code",{code:t.code});try{return JSON.stringify(t)}catch{return String(t)}}async _pickMarkerFiles(t){const e=t.target,i=e.files?[...e.files]:[];if(e.value="",!i.length||!this._markerDialog)return;const s=this._markerDialog.uploadId||this._markerDialog.devId||"new",o=[];for(const t of i)try{const e=new FormData;e.append("marker_id",s),e.append("file",t,t.name);const i=this.hass?.fetchWithAuth?await this.hass.fetchWithAuth("/api/houseplan/upload",{method:"POST",body:e}):await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:this.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.hass.auth.data.access_token}`}:{}}),n=await i.json().catch(()=>({}));if(!i.ok||n.error){const t={too_large:this._t("err.too_large",{mb:n.max_mb||50}),bad_ext:this._t("err.bad_ext"),unauthorized:this._t("err.unauthorized")};throw new Error(t[n.error]||n.error||"HTTP "+i.status)}o.push({name:n.name||t.name,url:n.url})}catch(e){this._showToast(this._t("toast.file_failed",{name:t.name,err:this._errText(e)}))}o.length&&this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:[...this._markerDialog.pdfs,...o]},this._showToast(this._t("toast.files_attached",{n:o.length})))}_removeMarkerPdf(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:this._markerDialog.pdfs.filter(e=>e.url!==t)})}async _saveMarker(){const t=this._markerDialog;if(t&&!t.busy&&("ha"!==t.bindingMode||t.binding&&"virtual"!==t.binding))if("virtual"!==t.binding||t.name.trim())if("run"!==t.tapAction||t.tapTarget){this._markerDialog={...t,busy:!0};try{const e=this._serverCfg;let i;e.markers=e.markers||[];const s=function(t){if(!t)return null;const e=t.indexOf("#");if(e<=0)return null;const i=t.slice(0,e),s=t.slice(e+1);if(!s)return null;if(s.startsWith("@")){const t=s.slice(1);return t?{space:i,area:null,roomId:t}:null}return{space:i,area:s,roomId:null}}(t.room);let o=s?.space||null,n=s?.area||null;const r=s?.roomId||null;"virtual"!==t.binding||o||(o=this._space),i=function(t,e,i){const[s,o]=t.split(":");return"device"===s?o:"entity"===s?"lg_"+o:e&&e.startsWith("v_")?e:i()}(t.binding,t.devId,()=>"v_"+Date.now().toString(36));const a=t.devId,l="virtual"===t.binding?[]:e.markers.filter(e=>e.removed&&e.binding===t.binding).map(t=>t.id),c=l.length>0,h=zr(t.binding,t.controls,this._bindingEntities(t.binding)),d=e.markers.find(t=>t.id===i||t.id===a)?.vacuum||null,p={id:i,vacuum:d,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,display:"badge"!==t.display?t.display:null,ripple_color:"icon_ripple"===t.display&&t.rippleColor?t.rippleColor:null,ripple_size:"icon_ripple"===t.display&&3!==t.rippleSize?t.rippleSize:null,size:1!==t.size?t.size:null,angle:t.angle?t.angle:null,tap_action:t.tapAction||null,tap_target:"run"===t.tapAction&&t.tapTarget||null,tap_confirm:!!t.tapConfirm||null,controls:h.length?h:null,is_light:!!t.isLight||null,use_climate_temp:!!t.useClimateTemp||null,glow_radius_cm:(()=>{const e=parseFloat(t.glowRadius);return!Number.isFinite(e)||e<=0?null:Math.round(this._imperial?30.48*e:100*e)})(),model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs,hidden:!!t.hideFromPlan};("virtual"===t.binding||t.room)&&(p.space=o,p.area=n,p.room_id=r);const u=a?this._devices.find(t=>t.id===a):null,_=u?.marker?.room_id??null,m=!!t.room&&null!=u&&(u.space!==o||u.area!==n||_!==r);let g=!1;const f=t.uploadId||a;if(f&&f!==i&&p.pdfs?.length)try{const t=await this.hass.callWS({type:"houseplan/files/migrate",from_id:f,to_id:i}),e=t?.mapping||{};p.pdfs=function(t,e,i,s){if(!e||!i||e===i)return t;const o="/files/"+e+"/",n="/files/"+i+"/";return t.map(t=>{if(!t.url.includes(o))return t;const e=t.url.split(o)[1]||"",[i,r]=[e.split("?")[0],e.includes("?")?"?"+e.split("?")[1]:""];if(s){const e=s[decodeURIComponent(i)]??s[i];return e?{...t,url:t.url.split(o+i)[0]+n+encodeURIComponent(e)+r}:t}return{...t,url:t.url.split(o).join(n)}})}(p.pdfs,f,i,e),g=Object.keys(e).length>0}catch(t){this._showToast(this._t("toast.files_migrate_failed",{err:this._errText(t)}))}e.markers=e.markers.filter(t=>t.id!==i&&t.id!==a&&("virtual"===p.binding||t.binding!==p.binding)),e.markers.push(p);let v=null;const b=o||u?.space||this._space,y=a?this._layout[a]:null,w=y?{s:y.s||u?.space||this._space,x:y.x,y:y.y}:a&&u&&this._defPos[a]?this._normPos(u.space,this._defPos[a].x,this._defPos[a].y):null;if(!c&&w&&w.s===b)i===a&&this._layout[i]&&!m||(v={s:w.s,x:w.x,y:w.y},this._layout={...this._layout,[i]:v});else if(c||!this._layout[i]||m){const t=this._spaceModel(o||void 0);let e=t.vb[0]+t.vb[2]/2,s=t.vb[1]+t.vb[3]/2;const a=r?t.rooms.find(t=>t.id===r):n?t.rooms.find(t=>t.area===n):void 0;a&&([e,s]=this._roomCenter(a)),v=this._normPos(o||this._space,e,s),this._layout={...this._layout,[i]:v}}await this._saveConfigNow(),v&&this._noteLayoutRev(await this.hass.callWS({type:"houseplan/layout/update",device_id:i,pos:v}));const k=new Set(l);a&&a!==i&&k.add(a),k.delete(i);for(const t of k)delete this._layout[t],await this.hass.callWS({type:"houseplan/layout/delete",device_id:t}).then(t=>this._noteLayoutRev(t)).catch(()=>{});g&&f&&await this.hass.callWS({type:"houseplan/files/cleanup",marker_id:f}).catch(()=>{}),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_saved"))}catch(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}else this._showToast(this._t("toast.run_target_required"));else this._showToast(this._t("toast.virtual_name_required"))}async _deleteMarker(){const t=this._markerDialog;if(!t||t.busy||!t.devId)return;const e=t.devId?this._devices.find(e=>e.id===t.devId):null;if(!e)return;const i=t.name||this._t("device.fallback");if(!confirm(this._t("confirm.remove_marker",{name:i})))return;const s=this._serverCfg;s.markers=s.markers||[];const o=s.markers,n="virtual"===e.bindingKind?"virtual":e.bindingKind&&e.bindingRef?`${e.bindingKind}:${e.bindingRef}`:"";if(!n)return;const r=function(t,e,i,s){const o=new Set([e]),n=t.filter(t=>{const n=t.id===e||!s&&t.binding===i;return n&&o.add(t.id),!n});return{markers:s?n:[...n,{id:e,binding:i,removed:!0,hidden:!0}],cleanupIds:o}}(s.markers,e.id,n,"virtual"===e.bindingKind);s.markers=r.markers;const a=r.cleanupIds;this._markerDialog={...t,busy:!0};try{await this._saveConfigNow();for(const t of a){delete this._layout[t],delete this._defPos[t],this._dirtyPos.delete(t),this._sentPos.delete(t);const e=this._activityRt.get(t);e&&clearTimeout(e.timer),this._activityRt.delete(t),this._vacRt.delete(t),delete this._vacSrvTrails[t],await this.hass.callWS({type:"houseplan/layout/delete",device_id:t}).then(t=>this._noteLayoutRev(t)).catch(()=>{}),await this.hass.callWS({type:"houseplan/files/cleanup",marker_id:t}).catch(()=>{}),await this.hass.callWS({type:"houseplan/trail/delete",marker_id:t}).catch(()=>{})}this._markerDialog=null,this._infoCard?.id===e.id&&(this._infoCard=null),this._selId===e.id&&(this._selId=null),this._drag?.id===e.id&&(this._drag=null),this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_removed"))}catch(t){this._serverCfg===s&&(s.markers=o),this._markerDialog&&(this._markerDialog={...this._markerDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_normPos(t,e,i){return{s:t,x:e/La,y:i/La}}_openSpaceDialog(t,e){if(this._serverStorage&&this._serverCfg)if("edit"===t){const i=this._serverCfg.spaces.find(t=>t.id===e);if(!i)return;const s=$i(i);this._spaceDialog={mode:t,spaceId:e,title:i.title,planUrl:i.plan_url||null,planFile:null,source:i.plan_url?"file":"draw",showBorders:s.showBorders,showNames:s.showNames,hideDecor:s.hideDecor,hideOpenings:s.hideOpenings,roomColor:s.color,roomOpacity:s.opacity,fillMode:s.fill,bgColor:s.bgColor,bgMode:"static"===i.settings?.bg_mode||"daynight"===i.settings?.bg_mode?i.settings.bg_mode:null,northDeg:Rs({},i.settings),sunRays:"boolean"==typeof i.settings?.sun_rays?i.settings.sun_rays:null,tempMin:s.tempMin,tempMax:s.tempMax,showLqi:s.showLqi??this._config?.show_signal??!0,cardFontScale:s.cardFontScale,labelTemp:s.labelTemp,labelHum:s.labelHum,labelLqi:s.labelLqi,labelLight:s.labelLight,cellCm:Number(i.cell_cm)>0?Number(i.cell_cm):5,busy:!1}}else this._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,source:"file",showBorders:!1,showNames:!1,hideDecor:!1,hideOpenings:!1,roomColor:ki,roomOpacity:xi,fillMode:"glow",bgColor:null,bgMode:null,northDeg:null,sunRays:null,tempMin:20,tempMax:25,showLqi:this._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:5,busy:!1};else this._showToast(this._t("toast.integration_missing"))}async _pickPlanFile(t){const e=t.target,i=e.files?.[0];if(!i||!this._spaceDialog)return;const s={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[i.type]||(i.name.toLowerCase().endsWith(".svg")?"svg":"");if(!s)return void this._showToast(this._t("toast.plan_formats"));const o=new Uint8Array(await i.arrayBuffer());let n="";for(let t=0;t<o.length;t+=32768)n+=String.fromCharCode(...o.subarray(t,t+32768));const r=btoa(n),a=URL.createObjectURL(i),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=a});URL.revokeObjectURL(a),this._spaceDialog={...this._spaceDialog,planFile:{ext:s,b64:r,aspect:l,name:i.name}}}_useServerPlan(t){const e=this._spaceDialog;e&&(this._spaceDialog={...e,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let e=0;e<40;e++){const e=this._display(t);if(e){const i=await new Promise(t=>{const i=new Image;i.onload=()=>t(i.naturalWidth&&i.naturalHeight?i.naturalWidth/i.naturalHeight:0),i.onerror=()=>t(0),i.src=e}),s=this._spaceDialog;return s&&s.planUrl===t&&Number.isFinite(i)&&i>0?(this._spaceDialog={...s,savedAspect:i},i):0}if(await new Promise(t=>setTimeout(t,150)),this._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){if(confirm(this._t("confirm.delete_plan",{name:t})))try{await this.hass.callWS({type:"houseplan/plans/delete",name:t});const e=this._spaceDialog;e?.saved&&(this._spaceDialog={...e,saved:e.saved.filter(e=>e.name!==t)})}catch(t){this._showToast(this._t("toast.plan_delete_failed",{err:this._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return W`<div class="savedplans muted">${this._t("space.loading")}</div>`;const e=t.saved||[];if(!e.length)return W`<div class="savedplans muted">${this._t("space.no_saved")}</div>`;return W`<div class="savedplans">
      ${e.map(e=>W`
        <div class="savedplan ${e.url===t.planUrl?"cur":""}">
          <img src=${this._display(e.url)} alt="" loading="lazy" decoding="async" />
          <div class="savedmeta">
            <b>${e.name}</b>
            <span class="muted">${(t=>t>=1048576?(t/1048576).toFixed(1)+" MB":Math.round(t/1024)+" KB")(e.size)}${e.used_by.length?" · "+this._t("space.used_by",{list:e.used_by.join(", ")}):""}</span>
          </div>
          <button class="btn ghost" @click=${()=>this._useServerPlan(e.url)}
            ?disabled=${e.url===t.planUrl}>${this._t("btn.use")}</button>
          <button class="btn ghost danger"
            title=${e.used_by.length||e.url===t.planUrl?this._t("space.in_use"):this._t("btn.delete")}
            ?disabled=${e.used_by.length>0||e.url===t.planUrl}
            @click=${()=>this._deleteServerPlan(e.name)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>`)}
    </div>`}async _saveSpaceDialog(){const t=this._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this._showToast(this._t("toast.plan_required"));const e="create"===t.mode&&0===(this._serverCfg?.spaces.length||0);this._spaceDialog={...t,busy:!0};try{const i="create"===t.mode?"s"+Date.now().toString(36):t.spaceId;let s=null;if("file"===t.source&&t.planFile){s={url:(await this.hass.callWS({type:"houseplan/plan/set",space_id:i,ext:t.planFile.ext,data:t.planFile.b64})).url,aspect:t.planFile.aspect}}let o=t.savedAspect||null;!s&&"file"===t.source&&t.planUrl&&!o&&this._aspectJob&&(o=await this._aspectJob||null);const n=this._serverCfg;let r;if("create"===t.mode)r={id:i,title:t.title.trim(),plan_url:null,view_box:[0,0,1,1],rooms:[]},n.spaces.push(r);else{if(r=n.spaces.find(t=>t.id===i),!r)throw new Error("space "+i+" is gone from the config");r.title=t.title.trim()}s?(r.plan_url=s.url,r.plan_aspect=s.aspect):"file"===t.source&&t.planUrl&&t.planUrl!==r.plan_url&&(r.plan_url=t.planUrl,r.plan_aspect=o),"draw"===t.source&&(r.plan_url=null,r.plan_aspect=null,delete r.plan_x,delete r.plan_y,delete r.plan_scale,delete r.plan_scale_x,delete r.plan_scale_y,delete r.plan_angle);const a="draw"===t.source;r.settings={...r.settings||{},show_borders:!(!a||"create"!==t.mode)||t.showBorders,show_names:!(!a||"create"!==t.mode)||t.showNames,hide_decor:t.hideDecor||void 0,hide_openings:t.hideOpenings||void 0,room_color:t.roomColor,room_opacity:t.roomOpacity,bg_color:t.bgColor||void 0,bg_mode:t.bgMode||void 0,north_deg:t.northDeg??void 0,sun_rays:t.sunRays??void 0,fill_mode:t.fillMode,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):20,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):25,show_lqi:t.showLqi,card_font_scale:1!==t.cardFontScale?t.cardFontScale:void 0,label_temp:t.labelTemp,label_hum:t.labelHum,label_lqi:t.labelLqi,label_light:t.labelLight},r.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?Math.max(.1,Math.min(Sa,t.cellCm)):5,await this._saveConfigNow(),this._spaceDialog=null,"create"===t.mode&&(this._space=r.id),this._regSignature="",this._maybeRebuildDevices(),this._importQueue.length?this._openNextImport():e||this._importTotal>0?(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._mode="plan",this._tool="draw",this._path=[],this._cursorPt=null,this._primeDrawWallField(),this._showToast(this._t(e&&!this._importTotal?"toast.space_added_onboard":"import.done"))):(this._showToast("create"===t.mode?this._t("toast.space_added"):this._t("toast.space_saved")),"create"===t.mode&&("plan"!==this._mode?this._setMode("plan"):(this._tool="draw",this._path=[],this._cursorPt=null,this._primeDrawWallField(),this._saveNav())))}catch(t){this._spaceDialog&&(this._spaceDialog={...this._spaceDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}async _deleteSpace(){const t=this._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this._serverCfg.spaces.find(e=>e.id===t.spaceId);if(confirm(this._t("confirm.delete_space",{title:e.title}))){this._serverCfg.spaces=this._serverCfg.spaces.filter(e=>e.id!==t.spaceId);try{await this._saveConfigNow(),this._spaceDialog=null,this._space===t.spaceId&&(this._space=this._serverCfg.spaces[0]?.id||""),this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.space_deleted"))}catch(t){this._showToast(this._t("toast.delete_failed",{err:this._errText(t)}))}}}async _saveConfigNow(){this._cfgEpoch++;try{await this._writeConfig()}catch(t){throw"conflict"===t?.code&&await this._reloadConfigOnly(),t}}_startImport(){const t=this._importDialog;if(!t)return;const e=t.floors.filter(t=>t.checked).map(t=>t.name);this._importDialog=null,e.length?(this._importQueue=e,this._importTotal=e.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this._importQueue.shift();void 0!==t&&(this._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,source:"file",showBorders:!1,showNames:!1,hideDecor:!1,hideOpenings:!1,roomColor:ki,roomOpacity:xi,fillMode:"glow",bgColor:null,bgMode:null,northDeg:null,sunRays:null,tempMin:20,tempMax:25,showLqi:this._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:5,busy:!1})}_skipImport(){this._spaceDialog=null,this._importQueue.length?this._openNextImport():this._importTotal>0&&this._model.length&&(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._mode="plan",this._showToast(this._t("import.done")))}_renderImportDialog(){const t=this._importDialog,e=t.floors.filter(t=>t.checked).length;return W`<hp-dialog .hass=${this.hass} .title=${this._t("import.title")} icon="mdi:home-floor-1"
      @hp-close=${()=>this._importDialog=null}>
        <div class="body">
          <div class="rhint">${this._t("import.hint")}</div>
          ${t.floors.map((e,i)=>W`<label class="floorrow">
              <input type="checkbox" .checked=${e.checked}
                @change=${s=>{const o=[...t.floors];o[i]={...e,checked:s.target.checked},this._importDialog={floors:o}}} />
              <span>${e.name}</span>
              ${null!=e.level?W`<span class="floorlvl">L${e.level}</span>`:V}
            </label>`)}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>{this._importDialog=null,this._openSpaceDialog("create")}}>
            ${this._t("import.manual")}
          </button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._startImport()} ?disabled=${!e}>
            <ha-icon icon="mdi:import"></ha-icon>${this._t("import.start",{n:e})}
          </button>
        </div>
    </hp-dialog>`}_sunGlobal(){const t=this._settingsDialog;return t?{...this._settings,north_deg:t.northDeg??void 0,bg_mode:t.bgMode,sun_rays:t.sunRays,weather_entity:(t.weatherEntity||"").trim()||void 0}:this._settings}_sunSpace(){const t=this._spaceDialog,e=this._curSpaceCfg?.settings||{};return t&&"edit"===t.mode&&t.spaceId===this._space?{...e,north_deg:t.northDeg??void 0,bg_mode:t.bgMode??void 0,sun_rays:t.sunRays??void 0}:e}_effNorth(){return Rs(this._sunGlobal(),this._sunSpace())}_effBgMode(){return As(this._sunGlobal(),this._sunSpace())}_effSunRays(){return Ns(this._sunGlobal(),this._sunSpace())}_sunNow(){return null!==this._effNorth()?Os(this.hass):null}_renderSunRays(t){const e=B``;if(this._editing||!this._effSunRays())return this._sunFadeReset(),e;const i=this._effNorth(),s=null!==i?Os(this.hass):null;if(!s||s.elevation<=0)return this._sunFadeReset(),e;const o=Es(this._sunGlobal()),n=function(t){if(!t)return 1;const e=Ts[String(t).toLowerCase()];return void 0===e?1:e}(o?this.hass?.states?.[o]?.state:null),r=function(t=1){return.3*ks(t)}(n);if(r<=0)return this._sunFadeReset(),e;if(a=s.elevation,Number(a)>=3)this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunOut=!1,this._sunShown=!0;else{if(!this._sunShown)return e;this._sunOut||(this._sunOut=!0,this._sunOutTimer=window.setTimeout(()=>{this._sunOutTimer=0,this._sunShown=!1,this._sunOut=!1,this.requestUpdate()},2e3))}var a;const l=`${t.id}|${s.azimuth}|${s.elevation}|${i}|${this._cfgEpoch}`;if(!this._sunRaysCache||this._sunRaysCache.key!==l){const e=t.rooms.map(t=>({id:t.id||"",poly:ze(t)})).filter(t=>!!t.id&&!!t.poly),o=this._openingsR.filter(t=>"window"===t.type).map(t=>({id:t.id,x:t.rx,y:t.ry,angle:t.angle,length:t.rlen})),n=this._spaceWalls,r=this._openPairs().flatMap(t=>t.segs),a={},c={};if(n.length){for(const i of e){const e=Sn(t.rooms,i.id,n,r,this._wallKeyPitch,this._cellCm,this._gridPitch,La);e&&(a[i.id]=e)}for(const e of o){const i=Tn(t.rooms,{x:e.x,y:e.y,angle:e.angle,length:e.length},n,this._wallKeyPitch,this._cellCm,this._gridPitch,La);i.cm>0&&(c[e.id]=jo(i.cm,this._cellCm,this._gridPitch))}}const h=Ds(e,o,s.azimuth,s.elevation,i,n.length?a:void 0,n.length?c:void 0);this._sunRaysCache={key:l,rays:h,rims:h.map(t=>function(t,e=1e-4){const[i,s]=t.dir,o=-s,n=i,r=[];for(const a of[t.a,t.b]){const l=[];for(const r of t.polys)for(let t=0;t<r.length;t++){const c=r[t],h=r[(t+1)%r.length];if(Math.abs((c[0]-a[0])*o+(c[1]-a[1])*n)>e)continue;if(Math.abs((h[0]-a[0])*o+(h[1]-a[1])*n)>e)continue;const d=(c[0]-a[0])*i+(c[1]-a[1])*s,p=(h[0]-a[0])*i+(h[1]-a[1])*s;Math.abs(p-d)<=e||l.push(d<p?[d,p]:[p,d])}l.sort((t,e)=>t[0]-e[0]);const c=[];for(const t of l){const i=c[c.length-1];i&&t[0]<=i[1]+e?i[1]=Math.max(i[1],t[1]):c.push([t[0],t[1]])}for(const[t,e]of c)r.push([[a[0]+i*t,a[1]+s*t],[a[0]+i*e,a[1]+s*e]])}return r}(t))}}const c=this._sunRaysCache.rays,h=this._sunRaysCache.rims;if(!c.length)return e;const d=(p=xs(s.elevation).warmth,zi("#ffe9c2","#ff9a45",ks(p)));var p;const u=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]],_=function(t=1){return.42*ks(t)}(n),m=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]];return B`<defs>
        ${c.map((t,e)=>{const i=(t.a[0]+t.b[0])/2,s=(t.a[1]+t.b[1])/2,o=i+t.normal[0]*t.depth,n=s+t.normal[1]*t.depth;return B`<linearGradient id="hp-sun-${e}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${s}" x2="${o}" y2="${n}">
            ${u.map(([t,e])=>B`<stop offset="${(100*t).toFixed(1)}%"
              stop-color="${d}" stop-opacity="${(r*e).toFixed(4)}"></stop>`)}
          </linearGradient>
          <linearGradient id="hp-sunrim-${e}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${s}" x2="${o}" y2="${n}">
            ${m.map(([t,e])=>B`<stop offset="${(100*t).toFixed(1)}%"
              stop-color="${"#000000"}" stop-opacity="${(_*e).toFixed(4)}"></stop>`)}
          </linearGradient>`})}
      </defs>
      <g class="sunlayer ${this._sunOut?"out":""}">
        ${c.map((t,e)=>t.polys.map(t=>B`<polygon
          points="${t.map(t=>t[0]+","+t[1]).join(" ")}" fill="url(#hp-sun-${e})"></polygon>`))}
        ${c.map((t,e)=>(h[e]||[]).map(t=>B`<line class="sunrim"
          x1="${t[0][0]}" y1="${t[0][1]}" x2="${t[1][0]}" y2="${t[1][1]}"
          stroke="url(#hp-sunrim-${e})" stroke-width="1"
          vector-effect="non-scaling-stroke"></line>`))}
      </g>`}_skyPlan(){const t=this._editing||"daynight"!==this._effBgMode()?null:this._sunNow();if(!t)return this._skyElev=null,void(this._skySnap=!1);const e=zs(t.elevation);var i,s;i=this._skyElev,s=e,(null===i||!Number.isFinite(i)||Math.abs(s-i)>=3)&&(this._skySnap=!0),this._skyElev=e}_skyRelease(){this._skySnap&&!this._skySnapRaf&&(this._skySnapRaf=requestAnimationFrame(()=>{this._skySnapRaf=requestAnimationFrame(()=>{this._skySnapRaf=0,this._skySnap=!1,this.requestUpdate()})}))}_sunFadeReset(){this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunShown=!1,this._sunOut=!1}_compassPoint(t){const e=t.currentTarget.getBoundingClientRect(),i=t.clientX-(e.left+e.width/2),s=t.clientY-(e.top+e.height/2);if(Math.hypot(i,s)<5)return;let o=Math.round(180*Math.atan2(i,-s)/Math.PI);t.shiftKey&&(o=15*Math.round(o/15)),o=(o%360+360)%360,this._settingsDialog={...this._settingsDialog,northDeg:o}}_renderCompass(){const t=this._settingsDialog.northDeg;return W`<svg class="compass ${null===t?"unset":""}" viewBox="-60 -60 120 120"
      @pointerdown=${t=>{t.currentTarget.setPointerCapture(t.pointerId),this._compassDrag=!0,this._compassPoint(t)}}
      @pointermove=${t=>{this._compassDrag&&this._compassPoint(t)}}
      @pointerup=${()=>this._compassDrag=!1}
      @pointercancel=${()=>this._compassDrag=!1}>
      <circle class="cring" r="50"></circle>
      ${[0,45,90,135,180,225,270,315].map(t=>B`<line class="ctick ${t%90?"minor":""}" x1="0" y1="-50" x2="0" y2="${t%90?-46:-43}"
          transform="rotate(${t})"></line>`)}
      <g class="cneedle" transform="rotate(${t??0})">
        <line x1="0" y1="34" x2="0" y2="-28"></line>
        <path d="M -7 -24 L 0 -42 L 7 -24 Z"></path>
        <text x="0" y="-12" text-anchor="middle">${this._t("gs.north_letter")}</text>
      </g>
      <text class="cdeg" x="0" y="26" text-anchor="middle">${null===t?"—":t+"°"}</text>
    </svg>`}_stageBg(t){if("daynight"===this._effBgMode()){const t=this._sunNow();if(t)return xs(zs(t.elevation)).bg}const e=this._settingsDialog,i=this._spaceDialog,s=e?e.bgColor||"":Si(this._settings,{bgColor:null});return(i&&"edit"===i.mode&&i.spaceId===this._space?i.bgColor||"":t.bgColor||"")||s}_stageBgHex(){const t=this._stageEl;if(t){const e=getComputedStyle(t).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(e)return"#"+e.slice(1,4).map(t=>(+t).toString(16).padStart(2,"0")).join("")}return"#111111"}async _runAlignToGrid(){const t=this._alignDialog;if(t&&!t.busy&&this._serverCfg){this._alignDialog={...t,busy:!0};try{this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),await this._writeChain;const e=await this.hass.callWS({type:"houseplan/plan/optimize",config:t.config,layout:t.layout,expected_config_rev:this._cfgRev,expected_layout_rev:this._layoutRev});this._serverCfg=t.config,this._layout=t.layout,this._geometryHistory.clear(),this._cfgRev=e?.config_rev??this._cfgRev+1,this._layoutRev=e?.layout_rev??this._layoutRev+1,this._canOptimizeUndo=!!e?.can_undo,this._dirtyPos.clear(),this._sentPos.clear(),this._cfgEpoch++,this._modelCache=null,this._frame=null,this._cacheSnapshot(),this._alignDialog=null,this.requestUpdate(),this._showToast(this._t("gs.align_done",{n:String(t.report.moved),m:String(t.report.migrated+t.report.canonicalized+t.report.wallsMerged+t.report.spansMerged)}))}catch(t){this._alignDialog&&(this._alignDialog={...this._alignDialog,busy:!1}),"conflict"===t?.code&&await Promise.all([this._reloadConfigOnly(!0),this._reloadLayoutOnly()]),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}}async _undoPlanOptimization(){if(this._canOptimizeUndo&&!this._optimizeUndoBusy){this._optimizeUndoBusy=!0,this.requestUpdate();try{await this.hass.callWS({type:"houseplan/plan/optimize_undo",expected_config_rev:this._cfgRev,expected_layout_rev:this._layoutRev});const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._serverCfg=t?.config||this._serverCfg,this._cfgRev=t?.rev??this._cfgRev,this._layout=e?.layout||this._layout,this._geometryHistory.clear(),this._layoutRev=e?.rev??this._layoutRev,this._canOptimizeUndo=!1,this._cfgEpoch++,this._modelCache=null,this._frame=null,this._cacheSnapshot(),this.requestUpdate(),this._showToast(this._t("gs.optimize_undone"))}catch(t){this._canOptimizeUndo=!1,this._showToast(this._t("toast.error",{err:this._errText(t)}))}finally{this._optimizeUndoBusy=!1,this.requestUpdate()}}}_setFillColor(t,e){const i=this._settingsDialog;this._settingsDialog={...i,colors:{...i.colors,[t]:{...i.colors[t],...e}}}}async _saveSettingsDialog(){const t=this._settingsDialog;if(t&&!t.busy){this._settingsDialog={...t,busy:!0};try{const e=this._serverCfg,i=JSON.stringify(t.colors)===JSON.stringify(Mi),s={...e.settings};i?delete s.fill_colors:s.fill_colors=t.colors;const o=this._imperial?30.48*t.glowRadius:100*t.glowRadius;Number.isFinite(o)&&o>0&&300!==Math.round(o)?s.glow_radius_cm=Math.round(o):delete s.glow_radius_cm,t.bgColor?s.bg_color=t.bgColor:delete s.bg_color,null!==t.northDeg&&Number.isInteger(t.northDeg)&&t.northDeg>=0&&t.northDeg<=359?s.north_deg=t.northDeg:delete s.north_deg,"daynight"===t.bgMode?s.bg_mode="daynight":delete s.bg_mode,t.sunRays?s.sun_rays=!0:delete s.sun_rays;const n=(t.weatherEntity||"").trim();n?s.weather_entity=n:delete s.weather_entity,this._serverCfg={...e,settings:s},await this._saveConfigNow(),this._settingsDialog=null,this.requestUpdate(),this._showToast(this._t("gs.saved"))}catch(t){this._settingsDialog&&(this._settingsDialog={...this._settingsDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}}_boolInput(t,e,i=!1){const s=t=>e(!!t.target.checked);return customElements.get("ha-switch")?W`<ha-switch .checked=${t} .disabled=${i} @change=${s}></ha-switch>`:W`<input type="checkbox" .checked=${t} ?disabled=${i} @change=${s} />`}_rangeInput(t,e,i,s,o){const n=t=>{const e=Number(t.target.value);Number.isFinite(e)&&o(e)};return customElements.get("ha-slider")?W`<ha-slider .min=${t} .max=${e} .step=${i} .value=${s} @input=${n} @change=${n}></ha-slider>`:W`<input type="range" min=${t} max=${e} step=${i} .value=${String(s)} @input=${n} />`}_renderColorRow(t,e){const i=this._settingsDialog.colors[t];return W`<div class="colorrow gsrow">
      <span class="gsl">${this._t(e)}</span>
      <input type="color" .value=${i.c}
        @input=${e=>this._setFillColor(t,{c:e.target.value})} />
      ${this._rangeInput(0,100,1,Math.round(100*i.a),e=>this._setFillColor(t,{a:e/100}))}
      <span class="opv">${Math.round(100*i.a)}%</span>
    </div>`}get _glowRadiusCm(){const t=Number(this._settings.glow_radius_cm);return Number.isFinite(t)&&t>0?t:300}get _imperial(){return"mi"===this.hass?.config?.unit_system?.length}get _glowRadiusPlaceholder(){const t=this._glowRadiusCm;return this._imperial?String(Math.round(t/30.48*10)/10):String(t/100)}_renderGlowLayer(t){const e=this._fillColors,i=this._glowRadiusCm/this._cellCm*this._gridPitch,s=this._gridPitch,o=t.rooms.map(t=>({r:t,poly:ze(t)})).filter(t=>!!t.poly),n=this._openingsR.filter(t=>"door"===t.type),r=this._spaceWalls,a=this._openPairs().flatMap(t=>t.segs),l=new Map;if(r.length)for(const e of n){const i=e.angle*Math.PI/180,s=Math.cos(i)*e.rlen/2,o=Math.sin(i)*e.rlen/2,n=xn(t.rooms,r,a,[e.rx-s,e.ry-o,e.rx+s,e.ry+o],this._wallKeyPitch,this._cellCm,this._gridPitch,La);n>0&&l.set(e.id,jo(n,this._cellCm,this._gridPitch))}const c=new Map;for(const e of Ar(this.hass,this._devices.filter(e=>e.space===t.id)))e.on&&e.device.id&&!c.has(e.device.id)&&c.set(e.device.id,e.eid);const h=[];for(const d of this._devices){if(d.space!==t.id)continue;const p=c.get(d.id);if(!p)continue;const u=Ei(this.hass.states[p],e.glow_light.c);if(!u)continue;const _=Number(d.marker?.glow_radius_cm),m=Number.isFinite(_)&&_>0?_/this._cellCm*this._gridPitch:i,g=this._pos(d),f=[...o].reverse().find(t=>this._pointInRoom([g.x,g.y],t.r));let v=null;if(f){const e=f.r.id?Hi(f.r.id,t.rooms):new Set([f.r.id]),i=o.filter(t=>t.r.id&&e.has(t.r.id)),c=i.length?i:[f],h=c.map(e=>"M "+(r.length&&e.r.id&&Sn(t.rooms,e.r.id,r,a,this._wallKeyPitch,this._cellCm,this._gridPitch,La)||e.poly).map(t=>t[0]+" "+t[1]).join(" L ")+" Z"),d=o.filter(t=>!c.includes(t)).map(t=>t.poly);for(const t of n){const e=c.some(e=>{const i=Ie([t.rx,t.ry],e.poly);return i&&Math.hypot(i[0]-t.rx,i[1]-t.ry)<=.75*s});if(!e)continue;const i=t.angle*Math.PI/180,o=Math.cos(i)*t.rlen/2,n=Math.sin(i)*t.rlen/2;if(!Fi([t.rx,t.ry],t.angle,[g.x,g.y],d,.6*s))continue;const r=Oi([g.x,g.y],[t.rx-o,t.ry-n],[t.rx+o,t.ry+n],m,170,l.get(t.id)||0);r&&h.push("M "+r.map(t=>t[0]+" "+t[1]).join(" L ")+" Z")}v=h}h.push({pos:g,c:u.c,alpha:e.glow_light.a*u.bri,clip:v,r:m})}return h.length?B`<defs>
        ${h.map((t,e)=>B`
          <radialGradient id="hp-glow-${e}">
            <stop offset="0%" stop-color="${t.c}" stop-opacity="${t.alpha.toFixed(3)}"></stop>
            <stop offset="70%" stop-color="${t.c}" stop-opacity="${t.alpha.toFixed(3)}"></stop>
            <stop offset="100%" stop-color="${t.c}" stop-opacity="0"></stop>
          </radialGradient>
          ${t.clip?B`<clipPath id="hp-glowclip-${e}">${t.clip.map(t=>B`<path d="${t}"></path>`)}</clipPath>`:V}`)}
      </defs>
      ${""}
      <g class="glowlayer" pointer-events="none" opacity="0.7">
        ${h.map((t,e)=>B`<circle cx="${t.pos.x}" cy="${t.pos.y}" r="${t.r}"
          fill="url(#hp-glow-${e})" ${""}
          clip-path=${t.clip?`url(#hp-glowclip-${e})`:V}></circle>`)}
      </g>`:B``}_renderAlignDialog(){const t=this._alignDialog,e=t.report;return W`<hp-dialog .hass=${this.hass} .title=${this._t("gs.align_title")} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${()=>this._alignDialog=null}>
        <div class="body">
          ${t.changed?W`
              ${e.moved?W`<p class="alignmsg">${this._t("gs.align_count",{n:String(e.moved),total:String(e.total),cm:String(t.cm)})}</p>`:V}
              ${t.where?W`<p class="alignmsg">${this._t("gs.align_where",{s:t.where})}</p>`:V}
              ${e.rotated?W`<p class="alignmsg">${this._t("gs.align_turned",{n:String(e.rotated)})}</p>`:V}
              <p class="alignmsg">${this._t("gs.optimize_changes",{m:String(e.migrated),c:String(e.canonicalized),w:String(e.wallsMerged),s:String(e.spansMerged)})}</p>
              <div class="rhint">${this._t("gs.align_warn")}</div>`:W`<p class="alignmsg">${this._t("gs.align_none")}</p>`}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._alignDialog=null}>${this._t("btn.cancel")}</button>
          ${t.changed?W`
            <button class="btn on" @click=${this._runAlignToGrid} ?disabled=${t.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("gs.align_run")}
            </button>`:V}
        </div>
    </hp-dialog>`}_renderSettingsDialog(){return W`<hp-dialog .hass=${this.hass} .title=${this._t("gs.title")} icon="mdi:cog-outline" wide
      @hp-close=${()=>this._settingsDialog=null}>
        <div class="body">
          <div class="rhint">${this._t("gs.hint")}</div>
          <label class="dispsection">${this._t("gs.light_group")}</label>
          ${this._renderColorRow("light_on","gs.light_on")}
          ${this._renderColorRow("light_off","gs.light_off")}
          ${this._renderColorRow("light_none","gs.light_none")}
          <label class="dispsection">${this._t("gs.temp_group")}</label>
          ${this._renderColorRow("temp_cold","gs.temp_cold")}
          ${this._renderColorRow("temp_ok","gs.temp_ok")}
          ${this._renderColorRow("temp_hot","gs.temp_hot")}
          <label class="dispsection">${this._t("gs.lqi_group")}</label>
          ${this._renderColorRow("lqi_low","gs.lqi_low")}
          ${this._renderColorRow("lqi_high","gs.lqi_high")}
          <label class="dispsection">${this._t("gs.glow_group")}</label>
          ${this._renderColorRow("glow_base","gs.glow_base")}
          ${this._renderColorRow("glow_light","gs.glow_light")}
          <label class="dispsection">${this._t("gs.wall_group")}</label>
          ${this._renderColorRow("wall_fill","gs.wall_fill")}
          <div class="colorrow gsrow">
            <span class="gsl">${this._t("gs.glow_radius")}</span>
            <input type="number" class="tempin" min="0.5" step="0.5"
              .value=${String(this._settingsDialog.glowRadius)}
              @input=${t=>{const e=parseFloat(t.target.value);Number.isFinite(e)&&e>0&&(this._settingsDialog={...this._settingsDialog,glowRadius:e})}} />
            <span class="opl">${this._imperial?this._t("gs.unit_ft"):this._t("gs.unit_m")}</span>
          </div>
          <label class="dispsection">${this._t("gs.bg_group")}</label>
          <div class="colorrow gsrow">
            <span class="gsl">${this._t("gs.bg_mode")}</span>
            <select class="areasel"
              @change=${t=>this._settingsDialog={...this._settingsDialog,bgMode:"daynight"===t.target.value?"daynight":"static"}}>
              <option value="static" ?selected=${"static"===this._settingsDialog.bgMode}>${this._t("gs.bg_static")}</option>
              <option value="daynight" ?selected=${"daynight"===this._settingsDialog.bgMode}>${this._t("gs.bg_daynight")}</option>
            </select>
          </div>
          ${"static"===this._settingsDialog.bgMode?W`<div class="colorrow gsrow">
                <span class="gsl">${this._t("gs.bg_color")}</span>
                <input type="color" .value=${this._settingsDialog.bgColor||this._stageBgHex()}
                  @input=${t=>this._settingsDialog={...this._settingsDialog,bgColor:t.target.value}} />
                ${this._settingsDialog.bgColor?W`<button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,bgColor:null}}>${this._t("gs.bg_default")}</button>`:W`<span class="opl">${this._t("gs.bg_theme")}</span>`}
              </div>`:W`<div class="rhint">${this._t("gs.bg_daynight_hint")}</div>`}
          <label class="dispsection">${this._t("gs.sun_group")}</label>
          ${Os(this.hass)?V:W`<div class="rhint">${this._t("gs.sun_missing")}</div>`}
          <div class="sunrow">
            ${this._renderCompass()}
            <div class="suncol">
              <span class="gsl">${this._t("gs.north")}</span>
              <div class="colorrow">
                <input class="namein tempin" type="number" min="0" max="359" step="1"
                  placeholder=${this._t("gs.north_ph")}
                  .value=${null===this._settingsDialog.northDeg?"":String(this._settingsDialog.northDeg)}
                  @input=${t=>{const e=t.target.value.trim(),i=""===e?null:Math.round(Number(e));this._settingsDialog={...this._settingsDialog,northDeg:null!==i&&Number.isFinite(i)?Math.min(359,Math.max(0,i)):null}}} />
                ${null!==this._settingsDialog.northDeg?W`<button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,northDeg:null}}>${this._t("gs.north_clear")}</button>`:V}
              </div>
              ${null===this._settingsDialog.northDeg?W`<div class="rhint">${this._t("gs.north_hint")}</div>`:V}
            </div>
          </div>
          <label class="srcrow">
            ${this._boolInput(this._settingsDialog.sunRays,t=>this._settingsDialog={...this._settingsDialog,sunRays:t})}
            <span>${this._t("gs.sun_rays")}</span>
          </label>
          <div class="colorrow gsrow">
            <span class="gsl">${this._t("gs.weather")}</span>
            <input class="namein" type="text" list="hp-weather-list" placeholder=${this._t("gs.weather_ph")}
              .value=${this._settingsDialog.weatherEntity}
              @input=${t=>this._settingsDialog={...this._settingsDialog,weatherEntity:t.target.value}} />
            <datalist id="hp-weather-list">
              ${Object.keys(this.hass?.states||{}).filter(t=>t.startsWith("weather.")).map(t=>W`<option value=${t}></option>`)}
            </datalist>
          </div>
          <label class="dispsection">${this._t("gs.grid_group")}</label>
          <div class="rhint">${this._t("gs.grid_hint")}</div>
          <div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._openAlignDialog}>
              <ha-icon icon="mdi:broom"></ha-icon>${this._t("gs.align_all")}
            </button>
          </div>
          ${this._canOptimizeUndo?W`<div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._undoPlanOptimization}
              ?disabled=${this._optimizeUndoBusy}>
              <ha-icon icon="mdi:undo-variant"></ha-icon>${this._t("gs.optimize_undo")}
            </button>
          </div>`:V}
          <label class="dispsection">${this._t("gs.about_group")}</label>
          <div class="aboutver">${this._t("gs.about_version",{v:xa})}</div>
          <a class="aboutlink" href="https://github.com/Matysh/houseplan-card" target="_blank" rel="noopener">
            <ha-icon icon="mdi:github"></ha-icon>${this._t("gs.about_github")}</a>
          <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener">
            <ha-icon icon="mdi:send"></ha-icon>${this._t("gs.about_telegram")}</a>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,colors:JSON.parse(JSON.stringify(Mi)),glowRadius:this._imperial?9.8:3,bgColor:null,northDeg:null,bgMode:"static",sunRays:!1,weatherEntity:""}}>
            ${this._t("gs.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._settingsDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSettingsDialog} ?disabled=${this._settingsDialog.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this._settingsDialog.busy?"…":this._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_rulesSet(t){this._rulesDialog={...this._rulesDialog,rules:t}}async _saveRules(){const t=this._rulesDialog;if(!t||t.busy)return;const e=t.rules.filter(t=>t.pattern.trim()&&t.icon.trim());this._rulesDialog={...t,busy:!0};try{const t=this._serverCfg,i=JSON.stringify(e)===JSON.stringify(mt),s={...t.settings};i?delete s.icon_rules:s.icon_rules=e,this._serverCfg={...t,settings:s},await this._saveConfigNow(),this._rulesDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("rules.saved"))}catch(t){this._rulesDialog&&(this._rulesDialog={...this._rulesDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_renderRulesDialog(){const t=this._rulesDialog,e=gt(t.rules),i=t.test.trim()?yt(t.test,"",e):null,s=(e,i)=>{const s=[...t.rules],o=e+i;o<0||o>=s.length||([s[e],s[o]]=[s[o],s[e]],this._rulesSet(s))};return W`<hp-dialog .hass=${this.hass} .title=${this._t("rules.title")}
      icon="mdi:shape-plus-outline" wide @hp-close=${()=>this._rulesDialog=null}>
        <div class="body">
          <div class="rhint">${this._t("rules.hint")}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this._t("rules.test_ph")}
              .value=${t.test}
              @input=${e=>this._rulesDialog={...t,test:e.target.value}} />
            ${i?W`<ha-icon icon=${i}></ha-icon><span class="rtesticon">${i}</span>`:V}
          </div>
          ${t.rules.map((e,i)=>{const o=""!==e.pattern.trim()&&!function(t){try{return new RegExp(t,"i"),!0}catch{return!1}}(e.pattern);return W`<div class="rrow">
              <input class="namein rpat ${o?"bad":""}" type="text"
                placeholder=${this._t("rules.pattern_ph")}
                title=${o?this._t("rules.invalid"):""}
                .value=${e.pattern}
                @input=${s=>{const o=[...t.rules];o[i]={...e,pattern:s.target.value},this._rulesSet(o)}} />
              <input class="namein ricon" type="text" placeholder=${this._t("rules.icon_ph")}
                .value=${e.icon}
                @input=${s=>{const o=[...t.rules];o[i]={...e,icon:s.target.value},this._rulesSet(o)}} />
              <ha-icon class="rprev" icon=${e.icon||"mdi:chip"}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-up" title=${this._t("btn.up")}
                @click=${()=>s(i,-1)}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-down" title=${this._t("btn.down")}
                @click=${()=>s(i,1)}></ha-icon>
              <ha-icon class="ract del" icon="mdi:close" title=${this._t("btn.delete")}
                @click=${()=>this._rulesSet(t.rules.filter((t,e)=>e!==i))}></ha-icon>
            </div>`})}
          <button class="btn ghost" @click=${()=>this._rulesSet([...t.rules,{pattern:"",icon:""}])}>
            <ha-icon icon="mdi:plus"></ha-icon>${this._t("rules.add")}
          </button>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this._rulesSet(mt.map(t=>({...t})))}>
            ${this._t("rules.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._rulesDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveRules} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_saveKioskScale(t){this._kioskScale={...this._kioskScale,...t};try{localStorage.setItem(Ia,JSON.stringify(this._kioskScale))}catch{}this.requestUpdate()}_renderKioskDialog(){const t=this._kioskScale,e=(e,i)=>W`<label>${i}</label>
      <div class="colorrow">
        ${this._rangeInput(50,300,5,Math.round(100*t[e]),t=>this._saveKioskScale({[e]:t/100}))}
        <span class="opv">${Math.round(100*t[e])}%</span>
      </div>`;return W`<hp-dialog .hass=${this.hass} .title=${this._t("kiosk.title")} icon="mdi:tablet"
      dismiss-on-scrim @hp-close=${()=>this._kioskDialog=!1}>
        <div class="body">
          <div class="rhint">${this._t("kiosk.hint")}</div>
          ${e("icon",this._t("kiosk.icon_scale"))}
          ${e("font",this._t("kiosk.font_scale"))}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this._saveKioskScale({icon:1,font:1})}>${this._t("gs.reset")}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._kioskDialog=!1}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}render(){if(!this._config||!this.hass)return V;const t=this._model;if(!t.length)return W`<ha-card>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>${this._t("empty.no_spaces")}</p>
          ${this._serverStorage?W`<p class="muted">${this._t("empty.add_first")}</p>
                <button class="btn on" @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>${this._t("btn.add_space")}
                </button>`:W`<p class="muted">${this._t("empty.install")}</p>`}
        </div>
        ${this._spaceDialog?this._renderSpaceDialog():V}
        ${this._importDialog?this._renderImportDialog():V}
        ${this._toast?W`<div class="toast">${this._toast}</div>`:V}
      </ha-card>`;const e=this._spaceModel(),i=e.vb,s="devices"===this._mode&&this._showAll,o=this._devices.filter(t=>t.space===e.id&&(!t.hidden||s)),n=$i(this._curSpaceCfg),r=n.showLqi??this._config.show_signal??!0,a=this._config.icon_size??2.5,l=a>8?2.5:a,c=this._viewOr(i),h=this._editing?"":this._stageBg(n),d=this._editing||"daynight"!==this._effBgMode()?null:this._sunNow(),p=d?xs(zs(d.elevation)).planDim:0,u=this._opMeasureView,_=this._decorMeasure,m=this._bdLive,g=this._furnLive,f="view"===this._mode?this._editorChromeMode:this._mode;return W`
      <ha-card>
        <div class="hdr ${this._kiosk?"kioskhide":""}">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title||this._t("card.title")}
          </div>
          <div class="tabs">
            ${t.map(t=>W`<button
                data-hp="space-tab" data-id="${t.id}"
                class="tab ${this._space===t.id?"active":""}"
                @click=${()=>this._pickSpace(t.id)}
              >
                ${t.title}${this._norm&&this._canEdit?W`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t("title.configure_space")}
                      @click=${e=>{e.stopPropagation(),this._openSpaceDialog("edit",t.id)}}></ha-icon>`:V}
              </button>`)}
            ${""}
            ${this._canEdit&&!this._kiosk?W`<button class="tab tabadd" title=${this._t("title.add_space")}
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`:V}
          </div>
          ${this._canEdit?W`<div class="modes">
                ${[["plan","mdi:floor-plan"],["devices","mdi:tune-variant"],["decor","mdi:draw"]].map(([t,e])=>W`<button class="modetab ${this._mode===t?"active":""}"
                    title=${this._t("mode."+t+"_tip")}
                    @click=${()=>{this._mode!==t&&this._setMode(t)}}>
                    <ha-icon icon=${e}></ha-icon><span class="ml">${this._t("mode."+t)}</span>
                    ${this._mode===t?W`<ha-icon class="closex" icon="mdi:close" title=${this._t("title.close_editor")}
                          @click=${t=>{t.stopPropagation(),this._setMode("view")}}></ha-icon>`:V}
                  </button>`)}
              </div>`:V}
          <span class="count">${this._t("count.devices",{n:o.filter(t=>!t.hidden).length})}</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${()=>this._stepZoom(-1)} title=${this._t("title.zoom_out")}><ha-icon icon="mdi:minus"></ha-icon></button>
            ${""}
            <button class="btn zb" @click=${()=>this._fitAll()}
              title=${this._t("title.zoom_fit")}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._stepZoom(1)} title=${this._t("title.zoom_in")}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm&&this._canEdit?W`<button class="btn" @click=${this._openSettingsDialog} title=${this._t("title.general_settings")}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>`:V}
        </div>
        ${this._canEdit&&!this._kiosk?W`<div class="editorchrome ${this._editing?"open":""}${this._navMotion?" nav-"+this._navMotion:""}" aria-hidden=${this._editing?"false":"true"}>
              <div class="editorchrome-inner ${this._navMotion?"nav-"+this._navMotion:""}">
                ${"plan"===f?this._renderMarkupBar():"devices"===f?this._renderDevicesBar():this._renderDecorBar()}
                ${""}
                ${"decor"===f&&"furniture"===this._decorTool?this._renderFurnPalette():V}
              </div>
            </div>`:V}
        </div>

        <div class="stage ${this._markup?"markup tool-"+this._tool+("split"!==this._tool||this._splitSel?"":" pickstage")+("openwall"!==this._tool&&"closewall"!==this._tool||!this._openWallHover?"":" wallhot")+("wallthick"===this._tool&&this._wallThickHover?" wallhot":""):""} ${"decor"===this._mode?"dtool-"+this._decorTool:""} ${e.bg?"":"noplan"} mode-${this._mode}${this._bdMovable?" bdgrab":""}${this._bdDrag?" bdgrabbing":""}${d?" daynight":""}${d&&this._skySnap?" skysnap":""}${this._booting?" hpboot":""}${this._bootSoft?" hpsettle":""}${this._navMotion?" hpnav":""}${this._resumeSettling&&"view"===this._mode&&!this._kiosk?" hpresume":""}"
          style="height:${this._kiosk?"100dvh":`calc(100dvh - ${this._hdrH}px)`}${h?`;background:${h}`:""};--wall-fill:${this._fillColors.wall_fill.c};--wall-fill-op:${this._fillColors.wall_fill.a}"
          @click=${t=>this._markupClick(t)}
          @wheel=${t=>this._onWheel(t)}
          @pointerdown=${t=>{this._notePointer(t),this._stagePointerDown(t)}}
          @pointermove=${t=>this._stagePointerMove(t)}
          @pointerup=${t=>this._stagePointerUp(t)}
          @pointercancel=${t=>this._stagePointerCancel(t)}>
          <div class="zoomwrap ${this._slide?"slide-"+this._slide:""}${this._navMotion?" nav-"+this._navMotion:""}"
            style="${d?`filter:brightness(${(1-p).toFixed(3)})`:""}">
          <svg viewBox="${c.x} ${c.y} ${c.w} ${c.h}" preserveAspectRatio="xMidYMid meet">
            ${""}
            ${this._wallHatchDefs(n.color)}${B`<g class="hp-paperg">${this._paperShapes(e.rooms).map(t=>"poly"in t?B`<polygon class="hp-paper" points="${t.poly}" pointer-events="none"></polygon>`:B`<rect class="hp-paper" x="${t.rect.x}" y="${t.rect.y}" width="${t.rect.w}" height="${t.rect.h}" rx="${t.rect.rx}" pointer-events="none"></rect>`)}</g>`}
            ${this._editing?this._renderMarkupDefs(i):V}
            ${""}
            ${this._editing&&!this._markup&&this._gridLevels()?B`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:V}
            ${e.bg&&this._display(e.bg.href)?B`<image href="${this._display(e.bg.href)}" x="${e.bg.x}" y="${e.bg.y}" width="${e.bg.w}" height="${e.bg.h}"
                  opacity="${"decor"===this._mode&&"backdrop"!==this._decorTool?.5:1}"
                  transform=${e.bg.angle?`rotate(${e.bg.angle} ${e.bg.x+e.bg.w/2} ${e.bg.y+e.bg.h/2})`:V}
                  @dblclick=${t=>this._openBackdropDialog(t)}
                  preserveAspectRatio="none" />`:V}
            ${""}
            ${n.hideDecor&&"decor"!==this._mode?V:this._renderDecorLayer()}
            ${(()=>{const t=this._openPairs(),i=new Map,s=t=>(i.has(t)||i.set(t,ze(t)),i.get(t));return e.rooms.filter(t=>t.area||"view"===this._mode||this._markup||n.showBorders).map(i=>{let o="room "+(e.bg?"overlay":"yard")+(this._markup?" outlined":"");!this._markup||i.id!==this._mergeSel&&i.id!==this._splitSel?.roomId||(o+=" picked");let a="";const l=Gi(n.fill,i);if(!this._markup&&(n.showBorders||"none"!==l)){o+=" styled";const t=[];t.push(`--room-stroke:${n.color}`,`--room-stroke-op:${n.showBorders?n.opacity:0}`);const e="glow"===l?this._fillColors.glow_base:"temp"===l?Ti("temp",null,"none",this._roomTemp(i),n.tempMin,n.tempMax,this._fillColors):"light"===l?Ti("light",null,Nr(Ar(this.hass,this._devices,i)),null,n.tempMin,n.tempMax,this._fillColors):i.area?Ti(l,"lqi"===l?this._roomLqi(i.area):null,"none",null,n.tempMin,n.tempMax,this._fillColors):null;e?(o+=" filled",t.push(`--room-fill:${e.c}`,`--room-fill-op:${e.a.toFixed(3)}`)):t.push("--room-fill:transparent","--room-fill-op:0"),a=t.join(";")}let c;const h=t=>{"view"===this._mode&&(void 0===c&&(c=this._roomArea(i)),this._showTip(t,i.name||this._t("room.unnamed"),c?this._t("tip.area",{value:c}):"",r?this._roomLqi(i.area):null,this._roomTemp(i)))},d=!e.bg&&!n.showNames&&!this._markup,p=this._roomCenter(i),u=this._markup&&(i.id===this._mergeSel||i.id===this._splitSel?.roomId),_=i.id&&!u?t.filter(t=>t.a.id===i.id||t.b.id===i.id).flatMap(t=>t.segs):[],m=u?[]:this._thickWallCuts(),g=_.concat(m);g.length&&(o+=" noedge");const f=s(i),v=this._spaceWalls,b=v.length&&i.id&&f&&Sn(e.rooms,i.id,v,this._openPairs().flatMap(t=>t.segs),this._wallKeyPitch,this._cellCm,this._gridPitch,La)||f,y=b?Ke(b,(w=i,e.rooms.filter(t=>t!==w).map(s).filter(Boolean))):[];var w;const k=i.id||V,x=i.area||V,$=y.length&&b?B`<path class="${o}" style="${a}" fill-rule="evenodd"
                    data-hp="room" data-id=${k} data-area=${x}
                    d="${[b,...y].map(t=>"M "+t.map(t=>t[0]+" "+t[1]).join(" L ")+" Z").join(" ")}"
                    @mouseenter=${()=>this._hoverRoom={space:e.id,room:i}}
                    @mousemove=${h}
                    @mouseleave=${()=>{this._tip=null,this._hoverRoom=null}}></path>`:b&&b!==f?B`<polygon class="${o}" style="${a}" points="${b.map(t=>t.join(",")).join(" ")}"
                     data-hp="room" data-id=${k} data-area=${x}
                    @mouseenter=${()=>this._hoverRoom={space:e.id,room:i}}
                    @mousemove=${h}
                    @mouseleave=${()=>{this._tip=null,this._hoverRoom=null}}></polygon>`:i.poly?B`<polygon class="${o}" style="${a}" points="${i.poly.map(t=>t.join(",")).join(" ")}"
                     data-hp="room" data-id=${k} data-area=${x}
                    @mouseenter=${()=>this._hoverRoom={space:e.id,room:i}}
                    @mousemove=${h}
                    @mouseleave=${()=>{this._tip=null,this._hoverRoom=null}}></polygon>`:B`<rect class="${o}" style="${a}"
                     data-hp="room" data-id=${k} data-area=${x}
                     x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="${.03*Math.min(i.w,i.h)}"
                    @mouseenter=${()=>this._hoverRoom={space:e.id,room:i}}
                    @mousemove=${h}
                    @mouseleave=${()=>{this._tip=null,this._hoverRoom=null}}></rect>`,S=g.length&&f?Ui(f,g,.02*this._gridPitch):null,M=S?B`<path class="room-outline ${this._markup?"outlined":""}"
                    d="${S.map(t=>`M ${t[0]} ${t[1]} L ${t[2]} ${t[3]}`).join(" ")}"
                    style=${this._markup?V:`stroke:${n.color};stroke-opacity:${n.showBorders?n.opacity:0}`}></path>`:V;return B`${$}${M}${d?B`<text class="rlabel"
                data-hp="room-label" data-id=${k} data-area=${x}
                x="${p[0]}" y="${p[1]}">${i.name}</text>`:V}`})})()}
            ${"glow"!==n.fill||this._markup?V:this._renderGlowLayer(e)}
            ${this._renderSunRays(e)}
            ${this._editing?this._renderAlignGuides():V}
            ${u?.guide?this._renderOpeningCenterTick(u.guide):V}
            ${this._markup?this._renderMarkupLayer(i):V}
            ${""}
            ${""}
            ${this._editing?V:this._renderOpenWalls(n)}
            ${this._renderWallBodies(n)}
            ${this._renderRoomHover(e)}
            ${""}
            ${this._editing?this._renderOpenWalls(n):V}
            ${n.hideOpenings&&!this._markup?V:this._renderOpenings(n)}
            ${this._renderWallThickUi()}
            ${this._markup&&"resize"===this._tool?this._renderResizeLayer(c):V}
            ${""}
            ${this._renderBackdropFrame(c)}
            ${this._renderTextFrame(c)}
          </svg>
          ${""}
          <div class="devlayer" style="--icon-size:${$o(l,e,c.w,this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--rl-font:${this._kiosk?this._kioskScale.font:1}">
            ${o.map(t=>this._renderDevice(t,c,r))}
            ${this._renderVacuums(o,c)}
            ${this._renderVacFit(c)}
            ${this._renderOpeningLocks(c)}
            ${n.showNames||this._markup?e.rooms.map(t=>this._renderRoomLabel(t,e,c,n)):V}
            ${this._markup?e.rooms.map(t=>this._renderRoomGear(t,e,c)):V}
          </div>
          ${this._measureAnchor?W`<div class="measurelayer">${this._renderMeasureLabel(c)}</div>`:V}
          ${this._rszLive?W`<div class="measurelayer">${this._rszLive.map(t=>W`<div
                class="measurelabel ${t.area?"rszarea":""}"
                style="left:${((t.x-c.x)/c.w*100).toFixed(2)}%;top:${((t.y-c.y)/c.h*100).toFixed(2)}%">${t.text}</div>`)}</div>`:V}
          ${u?W`<div class="measurelayer">${u.labels.map(t=>W`<div
                class="measurelabel opshoulder"
                style="left:${((t.x-c.x)/c.w*100).toFixed(2)}%;top:${((t.y-c.y)/c.h*100).toFixed(2)}%">${t.text}</div>`)}</div>`:V}
          ${this._wallDialog?W`<div class="measurelayer">${this._renderWallThickDialog()}</div>`:V}
          ${_?W`<div class="measurelayer"><div
                class="measurelabel dmeasure ${_.on45?"on45":""}"
                style="left:${((_.x-c.x)/c.w*100).toFixed(2)}%;top:${((_.y-c.y)/c.h*100).toFixed(2)}%">${_.text}</div></div>`:V}
          ${g?W`<div class="measurelayer">${g.map(t=>W`<div
                class="measurelabel furnmeasure"
                style="left:${((t.x-c.x)/c.w*100).toFixed(2)}%;top:${((t.y-c.y)/c.h*100).toFixed(2)}%">${t.text}</div>`)}</div>`:V}
          ${m?W`<div class="measurelayer"><div
                class="measurelabel bdmeasure"
                style="left:${((m.x-c.x)/c.w*100).toFixed(2)}%;top:${((m.y-c.y)/c.h*100).toFixed(2)}%">${m.text}</div></div>`:V}
          </div>
          ${this._zoom>1?W`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:V}
          ${this._renderFarHint()}
          ${this._renderHomeArrow()}
          ${this._booting||this._bootFading?W`<div class="bootveil ${this._booting?"":"off"}" aria-hidden="true">
                <svg class="boothouse" viewBox="0 0 24 24"><path d="${"M10,2V4.26L12,5.59V4H22V19H17V21H24V2H10M7.5,5L0,10V21H15V10L7.5,5M14,6V6.93L15.61,8H16V6H14M18,6V8H20V6H18M7.5,7.5L13,11V19H10V13H5V19H2V11L7.5,7.5M18,10V12H20V10H18M18,14V16H20V14H18Z"}"></path></svg>
              </div>`:V}
        </div>

        ${this._roomDialog?this._renderRoomDialog():V}
        ${this._mergeDialog?this._renderMergeDialog():V}
        ${this._openingDialog?this._renderOpeningDialog():V}
        ${this._openingInfo?this._renderOpeningInfoCard():V}
        ${this._decorTextDialog?this._renderDecorTextDialog():V}
        ${this._decorShapeDialog?this._renderDecorShapeDialog():V}
        ${this._backdropDialog?this._renderBackdropDialog():V}
        ${this._decorEraseConfirm?this._renderDecorEraseConfirm():V}
        ${this._spaceDialog?this._renderSpaceDialog():V}
        ${this._markerDialog?this._renderMarkerDialog():V}
        ${this._infoCard?this._renderInfoCard():V}
        ${this._rulesDialog?this._renderRulesDialog():V}
        ${this._settingsDialog?this._renderSettingsDialog():V}
        ${this._alignDialog?this._renderAlignDialog():V}
        ${this._importDialog?this._renderImportDialog():V}
        ${this._tip?W`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?W`<span class="m">${this._tip.meta}</span>`:V}
              ${null!=this._tip.temp?W`<span class="m">${this._t("tip.temp_avg")} <b>${this._tip.temp}°</b></span>`:V}
              ${null!=this._tip.lqi?W`<span class="m">${this._t("tip.lqi")}
                    <b style="color:${Se(this._tip.lqi)}">${this._tip.lqi}</b></span>`:V}
            </div>`:V}
        ${this._kiosk&&this._kioskDots&&this._model.length>1?W`<div class="kioskdots">
              ${this._model.map(t=>W`<span class="kdot ${t.id===this._space?"on":""}"></span>`)}
            </div>`:V}
        ${this._kioskDialog?this._renderKioskDialog():V}
        ${this._vacFit?W`<div class="vaccalbar">
          <span>${this._t("vac.fit_hint")}</span>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({rot:(this._vacFit.p.rot+90)%360})}>${this._t("vac.fit_rotate")}</button>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({mir:!this._vacFit.p.mir})}>${this._t("vac.fit_mirror")}</button>
          <button class="btn" @click=${()=>this._vacFitSave()}>${this._t("btn.save")}</button>
          <button class="btn ghostbtn" @click=${()=>{this._vacFit=null}}>${this._t("btn.cancel")}</button>
        </div>`:V}
        ${this._tapConfirm?W`<hp-dialog .hass=${this.hass} .title=${this._t("btn.run")} icon="mdi:alert-outline"
              dismiss-on-scrim @hp-close=${()=>this._tapConfirm=null}>
                <div class="body"><p>${this._tapConfirm.text}</p></div>
                <div class="row" slot="footer">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${()=>this._tapConfirm=null}>${this._t("btn.cancel")}</button>
                  <button class="btn on" @click=${()=>{const t=this._tapConfirm;this._tapConfirm=null,t.exec()}}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.run")}
                  </button>
                </div>
            </hp-dialog>`:V}
        ${this._toast?W`<div class="toast">${this._toast}</div>`:V}
      </ha-card>
    `}_vacSource(t){const e=t.marker?.vacuum;if(!1===e?.live)return null;if(e?.source&&this.hass?.states[e.source])return e.source;for(const e of t.entities||[])if(Qn(this.hass?.states[e]))return e;return null}_vacEntity(t){return t.primary?.startsWith("vacuum.")?t.primary:(t.entities||[]).find(t=>t.startsWith("vacuum."))||null}_isVacDev(t){return!!this._vacEntity(t)}_activitySourceKey(t){return t.map(t=>t.eid).sort().join("\n")}_stampActivity(t,e,i){let s=this._activityRt.get(t);s||(s={sources:i||"",last:{},flashTs:0,flashKind:null,timer:0,gen:0},this._activityRt.set(t,s)),null!=i&&(s.sources=i),s.flashTs&&Date.now()-s.flashTs<Ha&&"event"===s.flashKind&&"transition"===e||(s.flashTs=Date.now(),s.flashKind=e,s.gen++,clearTimeout(s.timer),s.timer=window.setTimeout(()=>this.requestUpdate(),3360))}_syncActivityRuntime(){if(!this.hass)return;const t=new Set;for(const e of this._devices){if(e.hidden)continue;t.add(e.id);const i=this._visualSamples(e),s=this._activitySourceKey(i);let o=this._activityRt.get(e.id);if(o){if(o.sources!==s){clearTimeout(o.timer),o.sources=s,o.last={},o.flashTs=0,o.flashKind=null;for(const t of i)o.last[t.eid]=t.state}}else{o={sources:s,last:{},flashTs:0,flashKind:null,timer:0,gen:0};for(const t of i)o.last[t.eid]=t.state;this._activityRt.set(e.id,o)}}for(const[e,i]of this._activityRt)t.has(e)||(clearTimeout(i.timer),this._activityRt.delete(e))}_activityTick(){if(this.hass){this._syncActivityRuntime();for(const t of this._devices){if(t.hidden)continue;const e=this._visualSamples(t),i=this._activitySourceKey(e),s=this._activityRt.get(t.id);if(!s||s.sources!==i)continue;"transition"===s.flashKind&&e.some(t=>"transition"===t.activity)&&(clearTimeout(s.timer),s.flashTs=0,s.flashKind=null);let o=null;for(const t of e){const e=wr(s.last[t.eid],t);("event"===e||!o&&e)&&(o=e),s.last[t.eid]=t.state}o&&this._stampActivity(t.id,o,i)}}}_vacTick(){if(this.hass)for(const t of this._devices){if(t.hidden||!this._isVacDev(t))continue;const e=this._vacSource(t);if(!e)continue;const i=this._vacEntity(t),s=sr(this.hass.states[i||""]?.state),o=Xn(this.hass.states[e]?.attributes);let n=this._vacRt.get(t.id);n||(n={trail:[],lastKey:"",lastTs:0,moving:!1,jump:!1,endedTs:0,lastPos:null},this._vacRt.set(t.id,n)),s&&!n.moving&&(n.trail=[],n.lastPos=null);const r="never"!==ar(t.marker?.vacuum)&&!o?.path;!s&&n.moving&&(n.endedTs=Date.now(),r&&n.lastPos&&(n.trail=ir(n.trail,n.lastPos,40)),n.lastPos=null),n.moving=s;const a=o?.pos;if(s&&a){const t=a.x+":"+a.y;if(t!==n.lastKey){const e=Date.now();n.jump=n.lastTs>0&&e-n.lastTs>1e4,n.lastKey=t,n.lastTs=e,r&&n.lastPos&&(n.trail=ir(n.trail,n.lastPos,40)),n.lastPos=[a.x,a.y]}}}}_vacEnsureMarker(t){const e=this._serverCfg;if(!e)return null;e.markers=e.markers||[];const i=e.markers.find(e=>e.id===t.id);if(i)return i;if("device"!==t.bindingKind&&"entity"!==t.bindingKind||!t.bindingRef)return null;const s={id:t.id,binding:t.bindingKind+":"+t.bindingRef,space:t.space||null,area:t.area||null,hidden:!!t.hidden};return e.markers.push(s),s}_renderVacSection(t){const e=this._devices.find(e=>e.id===t.devId);if(!e||!this._isVacDev(e))return V;const i=e.marker?.vacuum||{},s=this._vacSource(e),o=s?Xn(this.hass?.states[s]?.attributes):null,n=!!(o&&o.rooms.length>=3),r=o?.pos?wi(this._t("vac.status_found"),{name:s||""}):this._t("vac.status_none"),a=Object.keys(i.calibration||{}),l=t=>{const i=this._vacEnsureMarker(e);i&&(i.vacuum={...i.vacuum||{},...t},this._regSignature="",this._saveConfig(),this.requestUpdate())};return W`
      <label>${this._t("vac.section")}</label>
      <div class="bindbox vacbox">
        <div class="rhint">${r}</div>
        ${o?W`
          <div class="vacbtns">
            ${n?W`<button class="btn" @click=${()=>this._vacAutoCalibrate(e)}>${this._t("vac.autocal")}</button>`:V}
            <button class="btn ghostbtn" @click=${()=>this._vacStartFit(e)}>${this._t("vac.fit")}</button>
          </div>
          <label class="srcrow">
            ${this._boolInput(!1!==i.live,t=>l({live:!!t&&null}))}
            <span>${this._t("vac.live")}</span>
          </label>
          <label>${this._t("vac.trail")}</label>
          <select class="areasel"
            @change=${t=>l({trail_mode:t.target.value,trail:null})}>
            ${["never","cleaning","always"].map(t=>W`
              <option value=${t} ?selected=${ar(i)===t}>${this._t("vac.trail_"+t)}</option>`)}
          </select>
          ${a.length?W`<div class="rhint">${wi(this._t("vac.cal_maps"),{maps:a.join(", ")})}</div>`:V}
        `:V}
      </div>`}_vacMapId(t,e){const i=this._vacEntity(t),s=i?this.hass?.states[i]?.attributes?.selected_map:null;return o=e.mapId,n=s,"default"!==o?o:null!=n?String(n):"default";var o,n}_vacSaveMatrix(t,e,i,s){const o=this._devices.find(e=>e.id===t),n=o?this._vacEnsureMarker(o):this._serverCfg?.markers?.find(e=>e.id===t);if(!n)return!1;const r={...n.vacuum||{}};return r.source=e,r.calibration={...r.calibration||{},[i]:s.map(t=>Number(t.toFixed(6)))},n.vacuum=r,this._regSignature="",this._saveConfig(),this.requestUpdate(),!0}_vacAutoCalibrate(t){const e=this._vacSource(t),i=e?Xn(this.hass?.states[e]?.attributes):null;if(!e||!i||i.rooms.length<3)return void this._showToast(this._t("vac.autocal_no_rooms"));const s=this._spaceModel(t.space),o=(s?.rooms||[]).map(t=>({r:t,poly:ze(t)})).filter(({r:t,poly:e})=>t.name&&e).map(({r:t,poly:e})=>{const i=We(e);return{name:t.name,cx:i[0],cy:i[1]}}),n=er(i.rooms,o);n?this._vacSaveMatrix(t.id,e,this._vacMapId(t,i),n.matrix)&&(n.residual>50&&this._showToast(wi(this._t("vac.autocal_res_warn"),{rooms:String(n.matched.length)})),this._showToast(wi(this._t("vac.autocal_done"),{rooms:String(n.matched.length)}))):this._showToast(this._t("vac.autocal_no_match"))}_vacStartFit(t){const e=this._vacSource(t),i=e?Xn(this.hass?.states[e]?.attributes):null;if(!e||!i)return void this._showToast(this._t("vac.cal_need_pos"));const s=this._vacMapId(t,i),o=t.marker?.vacuum?.calibration?.[s],n=this._spaceModel(t.space),r=n?.vb||[0,0,La,La],a=o&&6===o.length&&function(t){const e=t[0]*t[4]-t[1]*t[3];if(!Number.isFinite(e)||Math.abs(e)<1e-12)return null;const i=e<0,s=Math.sqrt(Math.abs(e));let o=180*Math.atan2(-t[1],t[4])/Math.PI;return o=(90*Math.round(o/90)%360+360)%360,{ox:t[2],oy:t[5],s:s,rot:o,mir:i}}(o)||function(t,e){const i=[],s=[];for(const e of t)null!=e.x0?(i.push(e.x0,e.x1),s.push(e.y0,e.y1)):(i.push(e.cx),s.push(e.cy));if(!i.length)return{ox:e[0]+e[2]/2,oy:e[1]+e[3]/2,s:e[2]/1e4,rot:0,mir:!0};const o=Math.min(...i),n=Math.max(...i),r=Math.min(...s),a=Math.max(...s),l=Math.max(n-o,a-r)||1,c={ox:0,oy:0,s:.6*Math.min(e[2],e[3])/l,rot:0,mir:!0},h=nr(c),[d,p]=Yn(h,(o+n)/2,(r+a)/2);return c.ox=e[0]+e[2]/2-d,c.oy=e[1]+e[3]/2-p,c}(i.rooms,r);this._markerDialog=null,t.space!==this._space&&(this._space=t.space),this._vacFit={markerId:t.id,source:e,mapId:s,p:a,drag:null}}_vacFitSave(){const t=this._vacFit;if(!t)return;const e=this._vacSaveMatrix(t.markerId,t.source,t.mapId,nr(t.p));this._vacFit=null,e&&this._showToast(this._t("vac.cal_done"))}_vacFitTurn(t){const e=this._vacFit;if(!e)return;const i=Xn(this.hass?.states[e.source]?.attributes),s=this._vacGhostCentre(i?.rooms||[]),o={...e.p,...t};this._vacFit={...e,p:rr(o,e.p,s[0],s[1])}}_vacGhostCentre(t){const e=[],i=[];for(const s of t)e.push(s.x0??s.cx,s.x1??s.cx),i.push(s.y0??s.cy,s.y1??s.cy);return e.length?[(Math.min(...e)+Math.max(...e))/2,(Math.min(...i)+Math.max(...i))/2]:[0,0]}_vacDelta(t,e,i){const s=this._stageEl,o=s?.clientWidth||1,n=s?.clientHeight||1;return[e/o*t.w,i/n*t.h]}_vacFitPointer(t,e){const i=this._vacFit;if(!i)return;if(t.stopPropagation(),"pointerdown"===t.type){const e=t.target,s=e.getAttribute?.("data-corner");try{t.currentTarget.setPointerCapture?.(t.pointerId)}catch{}return void(this._vacFit={...i,drag:s?{kind:"scale",sx:t.clientX,sy:t.clientY,p0:{...i.p},fx:Number(s.split(",")[0]),fy:Number(s.split(",")[1])}:{kind:"move",sx:t.clientX,sy:t.clientY,p0:{...i.p},fx:0,fy:0}})}const s=i.drag;if(s){if("pointermove"===t.type){const[o,n]=this._vacDelta(e,t.clientX-s.sx,t.clientY-s.sy);if("move"===s.kind)this._vacFit={...i,p:{...s.p0,ox:s.p0.ox+o,oy:s.p0.oy+n}};else{const t=Xn(this.hass?.states[i.source]?.attributes),e=this._vacGhostCentre(t?.rooms||[]),r=nr(s.p0),[a,l]=Yn(r,e[0],e[1]),[c,h]=Yn(r,s.fx,s.fy),d=Math.hypot(a-c,l-h)||1,[p,u]=[2*a-c,2*l-h],_=Math.hypot(p+2*o-c,u+2*n-h)/2,m=Math.max(.05,_/d),g={...s.p0,s:s.p0.s*m};this._vacFit={...i,p:rr(g,s.p0,s.fx,s.fy)}}return}"pointerup"!==t.type&&"pointercancel"!==t.type||(this._vacFit={...i,drag:null})}}_renderVacFit(t){const e=this._vacFit;if(!e)return V;const i=Xn(this.hass?.states[e.source]?.attributes);if(!i)return V;const s=nr(e.p),o=[],n=[],r=[];for(const t of i.rooms){if(null==t.x0)continue;const e=[[t.x0,t.y0],[t.x1,t.y0],[t.x1,t.y1],[t.x0,t.y1]].map(([t,e])=>Yn(s,t,e));e.forEach(([t,e])=>{n.push(t),r.push(e)});const[i,a]=Yn(s,t.cx,t.cy);o.push(B`<polygon points="${e.map(t=>t[0].toFixed(1)+","+t[1].toFixed(1)).join(" ")}"></polygon>
        <text x="${i.toFixed(1)}" y="${a.toFixed(1)}">${t.name}</text>`)}let a=V;if(i.pos){const[e,o]=Yn(s,i.pos.x,i.pos.y);a=B`<circle class="vacfitdot" cx="${e.toFixed(1)}" cy="${o.toFixed(1)}" r="${(.012*t.w).toFixed(1)}"></circle>`}const l=[];if(n.length){const e=(()=>{const t=s[0]*s[4]-s[1]*s[3];return(e,i)=>[(s[4]*(e-s[2])-s[1]*(i-s[5]))/t,(-s[3]*(e-s[2])+s[0]*(i-s[5]))/t]})(),i=Math.min(...n),o=Math.max(...n),a=Math.min(...r),c=Math.max(...r),h=.022*t.w,d=h/4;for(const[t,s,n,r]of[[i,a,o,c],[o,a,i,c],[o,c,i,a],[i,c,o,a]]){const i=e(n,r);l.push(B`<circle class="vacfithandle" data-corner="${i[0]+","+i[1]}"
          cx="${t.toFixed(1)}" cy="${s.toFixed(1)}" r="${h.toFixed(1)}"></circle>
          <circle class="vacfitknob" cx="${t.toFixed(1)}" cy="${s.toFixed(1)}" r="${d.toFixed(2)}"></circle>`)}}return W`<svg class="vacfit" viewBox="${t.x} ${t.y} ${t.w} ${t.h}"
        preserveAspectRatio="none"
        @pointerdown=${e=>this._vacFitPointer(e,t)}
        @pointermove=${e=>this._vacFitPointer(e,t)}
        @pointerup=${e=>this._vacFitPointer(e,t)}
        @pointercancel=${e=>this._vacFitPointer(e,t)}>${o}${a}${l}</svg>`}_vacRafLoop(){this._vacRaf=requestAnimationFrame(()=>{const t=this.renderRoot,e=this._stageEl,i=this._vacLastView,s=t?.querySelectorAll?.(".vacpuck")||[];if(!e||!i||!s.length)return void(this._vacRaf=0);const o=e.getBoundingClientRect();for(const e of s){const s=e.getAttribute("data-mid"),n=e.getBoundingClientRect(),r=i.x+(n.left+n.width/2-o.left)/o.width*i.w,a=i.y+(n.top+n.height/2-o.top)/o.height*i.h;for(const e of t.querySelectorAll(`line.tip[data-mid="${s}"]`))e.setAttribute("x2",r.toFixed(1)),e.setAttribute("y2",a.toFixed(1))}this._vacRafLoop()})}_renderVacuums(t,e){if(this._markup||"decor"===this._mode)return V;const i=this._space+"|"+e.x+"|"+e.y+"|"+e.w+"|"+e.h,s=this._vacJumpOnce||i!==this._vacViewKey;this._vacViewKey=i,this._vacJumpOnce=!1;const o=[],n=[];for(const i of t){if(i.hidden||!this._isVacDev(i))continue;const t=this._vacSource(i);if(!t)continue;const r=Xn(this.hass?.states[t]?.attributes);if(!r)continue;const a=i.marker?.vacuum?.calibration?.[this._vacMapId(i,r)];if(!a||6!==a.length)continue;const l=this._vacRt.get(i.id),c=l?.moving??!1,h=ar(i.marker?.vacuum),d="always"===h||"cleaning"===h&&c,p=this._vacSrvTrails[i.id],u=this._vacMapId(i,r),_=p?.current?.map_id===u&&Array.isArray(p.current.points)?p.current:null,m=p?.previous?.map_id===u&&Array.isArray(p.previous.points)?p.previous:null;if("always"===h&&m&&m.points.length>1){const t=m.points.map(([t,e])=>{const[i,s]=Yn(a,t,e);return i.toFixed(1)+","+s.toFixed(1)}).join(" ");n.push(B`<g class="prev"><polyline class="case" points="${t}"></polyline><polyline class="core" points="${t}"></polyline></g>`)}if(d&&(c||_)){const t=_?.points||r.path||l?.trail||[],e=c&&(_||r.path)&&t.length>1?t.slice(0,-1):t;if(e.length>1){const t=e.map(([t,e])=>{const[i,s]=Yn(a,t,e);return i.toFixed(1)+","+s.toFixed(1)}).join(" ");if(n.push(B`<polyline class="case" points="${t}"></polyline><polyline class="core" points="${t}"></polyline>`),c){const[t,s]=Yn(a,e[e.length-1][0],e[e.length-1][1]),o=t.toFixed(1),r=s.toFixed(1);n.push(B`<line class="case tip" data-mid="${i.id}" x1="${o}" y1="${r}" x2="${o}" y2="${r}"></line><line class="core tip" data-mid="${i.id}" x1="${o}" y1="${r}" x2="${o}" y2="${r}"></line>`)}}}if(!c||!r.pos)continue;const[g,f]=Yn(a,r.pos.x,r.pos.y),v=(g-e.x)/e.w*100,b=(f-e.y)/e.h*100,y=l&&l.lastTs>0&&Date.now()-l.lastTs>6e4,w=i.marker?.icon||i.icon||"mdi:robot-vacuum";o.push(W`<div
        data-mid="${i.id}"
        class="vacpuck ${l?.jump||s?"jump":""} ${y?"stale":""}"
        style="left:${v}%;top:${b}%"
        title=${i.name}
        @click=${t=>{t.stopPropagation();const e=this._vacEntity(i);e&&this._openMoreInfo(e)}}>
        <ha-icon .icon=${w}></ha-icon>
      </div>`)}return this._vacLastView=e,o.length&&!this._vacRaf&&this._vacRafLoop(),o.length||n.length?W`
      ${n.length?B`<svg class="vactrail" viewBox="${e.x} ${e.y} ${e.w} ${e.h}" preserveAspectRatio="none">${n}</svg>`:V}
      ${o}`:V}_renderDevice(t,e,i=!0){const s=this._pos(t),o=(s.x-e.x)/e.w*100,n=(s.y-e.y)/e.h*100,r=this._deviceVisual(t),a=t.hidden?"":this._stateClass(t,r),l=t.hidden?null:this._liveTemp(t),c=t.hidden?null:this._liveHum(t),h=!i||t.virtual||t.hidden?null:Er(this.hass,t.entities),d=t.marker,p=this._displayOf(t),u="icon_ripple"===p&&!t.hidden&&this._config?.live_states&&"alarm"!==r.status?r.activity:"none",_=this._actEntity(t),m=_?this.hass.states[_]:void 0,g="value"!==p||t.hidden||null!=l||null!=c||!m||isNaN(parseFloat(m.state))?null:gi(this.hass,_),f="value"!==p||t.hidden?null:null!=l?l+"°":null!=c?c+"%":g?g.formatted?fi(g,m.attributes?.unit_of_measurement):parseFloat(m.state)+(m.attributes?.unit_of_measurement?" "+m.attributes.unit_of_measurement:""):null,v=_?_.split(".")[0]:null,b=this._config?.live_states&&!t.hidden?Ni(t.icon,v,m?.attributes?.device_class,m?.state,!!d?.icon):t.icon,y=Ar(this.hass,[t]),w=this._config?.live_states&&!t.hidden&&y.map(t=>function(t){if(!t||"on"!==t.state)return null;const e=t.attributes?.rgb_color;return Array.isArray(e)&&e.length>=3&&e.every(t=>Number.isFinite(t))?`rgb(${e[0]}, ${e[1]}, ${e[2]})`:null}(this.hass.states[t.eid])).find(t=>t)||null,k=Number(d?.size)>0?Number(d.size):1,x=Number(d?.angle)||0,$=Number(d?.ripple_size)>0?Number(d.ripple_size):3,S=[`left:${o}%`,`top:${n}%`];return 1!==k&&S.push(`--dev-scale:${k}`),"icon_ripple"===p&&(S.push(`--ripple-scale:${$}`),d?.ripple_color?S.push(`--ripple-color:${d.ripple_color}`):w&&S.push(`--ripple-color:${w}`)),W`<div
      ${""}
      data-hp="device"
      data-id="${t.id}"
      data-entity=${t.primary||V}
      data-area=${t.area||V}
      class="dev ${a} ${this._selId===t.id?"sel":""} ${t.virtual?"virtual":""} ${t.hidden?"ghost":""} ${null!=f?"valonly":""}"
      style="${S.join(";")}"
      @click=${e=>this._clickDevice(e,t)}
      @contextmenu=${e=>this._ctxDevice(e,t)}
      @mousemove=${e=>this._showTip(e,t.name,t.model+(null!=l?" · "+l+"°":"")+(null!=c?" · "+c+"%":"")+(null!=h?" · LQI "+h:""))}
      @mouseleave=${()=>this._tip=null}
      @pointerdown=${e=>this._pointerDown(e,t)}
      @pointermove=${e=>this._pointerMove(e,t)}
      @pointerup=${e=>this._pointerUp(e,t)}
      @pointercancel=${e=>this._pointerUp(e,t)}
    >
      ${"none"!==u?W`<span class="activity-ring ${u} ${a.includes("activity-gen2")?"gen2":""}"><i></i><i></i><i></i></span>`:V}
      ${this._newIds.has(t.id)?W`<span class="newdot" title=${this._t("device.new")}></span>`:V}
      ${null!=f?W`<span class="valtext">${f}</span>`:W`<ha-icon icon="${b}" style=${x?`transform:rotate(${x}deg)`:V}></ha-icon>`}
      ${null!=l&&null==f?W`<span class="tval">${l}°</span>`:V}
      ${null!=c&&null==f?W`<span class="hval">${c}%</span>`:V}
      ${null!=h?W`<span class="lqi" style="color:${Se(h)}">${h}</span>`:V}
    </div>`}_roomArea(t){const e=ze(t);if(!e)return null;const i=this._spaceWalls,s=i.length&&t.id&&Sn(this._spaceModel().rooms,t.id,i,this._openPairs().flatMap(t=>t.segs),this._wallKeyPitch,this._cellCm,this._gridPitch,La)||e;return ys(bs(s,this._gridPitch,this._cellCm),"mi"===this.hass?.config?.unit_system?.length)}_roomTemp(t){const e=t.settings?.temp_source;return e?Vr(this.hass,e,"temp",this._markers):t.area?this._climate().get(t.area)?.temp??null:null}_roomHum(t){const e=t.settings?.hum_source;return e?Vr(this.hass,e,"hum",this._markers):t.area?this._climate().get(t.area)?.hum??null:null}_climate(){const t=this._serverCfg?.markers,e=this._climateCache;if(e&&e.h===this.hass&&e.r===this._iconRules&&e.mk===t)return e.m;const i=function(t,e,i){const s=new Map;if(!t?.entities)return s;const o=Ur(i),n=new Set;for(const t of i||[]){if(t?.removed||!0!==t?.use_climate_temp)continue;const e=(t.binding||"").indexOf(":");e>0&&n.add(t.binding.slice(e+1))}const r=new Map;for(const[e,i]of Object.entries(t.entities)){if(i.device_id&&o.devices.has(i.device_id)||!i.device_id&&o.entities.has(e))continue;const s=i.device_id?t.devices?.[i.device_id]:null,a=i.area_id||s?.area_id||null;if(!a)continue;if(i.entity_category)continue;if(!(n.size>0&&e.startsWith("climate.")&&(n.has(e)||i.device_id&&n.has(i.device_id)))){if(_t.has(i.platform))continue;if(Gr.test(e))continue}let l=r.get(a);l||(l=new Map,r.set(a,l));const c=i.device_id||e;let h=l.get(c);if(!h){const o=t.states?.[e];h={name:(s?s.name_by_user||s.name:i.name||o?.attributes?.friendly_name||e)||e,model:s?.model,ents:[]},l.set(c,h)}h.ents.push(e)}for(const[i,o]of r){const r=[],a=[];for(const[i,s]of o){const o=qr(t,s.name,s.model,s.ents,e),l="mdi:thermometer"===o||"mdi:air-filter"===o;if(l){const e=Or(t,s.ents);null!=e&&r.push(e)}if(n.size>0&&(n.has(i)||s.ents.some(t=>n.has(t)))){const e=Fr(t,s.ents);null!=e&&r.push(e)}if(l||"mdi:water-percent"===o){const e=Lr(t,s.ents);null!=e&&a.push(e)}}(r.length||a.length)&&s.set(i,{temp:r.length?Math.round(r.reduce((t,e)=>t+e,0)/r.length*10)/10:null,hum:a.length?Math.round(a.reduce((t,e)=>t+e,0)/a.length):null})}return s}(this.hass,this._iconRules,t);return this._climateCache={h:this.hass,r:this._iconRules,mk:t,m:i},i}_resetRoomDialogFields(){this._roomEditId=null,this._roomFill="",this._roomTempSrc="",this._roomHumSrc="",this._roomSrcOpen=null,this._roomSrcFilter="",this._roomNameScale=1,this._roomLabelScale=1}_openRoomEdit(t){t.id&&(this._roomEditId=t.id,this._nameSel=t.name||"",this._areaSel=t.area||"",this._roomFill=t.settings?.fill_mode||"",this._roomTempSrc=t.settings?.temp_source||"",this._roomHumSrc=t.settings?.hum_source||"",this._roomNameScale=Ki(t.settings?.name_scale),this._roomLabelScale=Ki(t.settings?.label_scale),this._roomSrcOpen=null,this._roomSrcFilter="",this._roomDialog=!0)}_roomSettingsFromDialog(){const t={};return this._roomFill&&(t.fill_mode=this._roomFill),this._roomTempSrc&&(t.temp_source=this._roomTempSrc),this._roomHumSrc&&(t.hum_source=this._roomHumSrc),1!==this._roomNameScale&&(t.name_scale=this._roomNameScale),1!==this._roomLabelScale&&(t.label_scale=this._roomLabelScale),Object.keys(t).length?t:null}_saveRoomEdit(){const t=this._curSpaceCfg,e=t?.rooms.find(t=>t.id===this._roomEditId);if(!e)return this._roomDialog=!1,void(this._roomEditId=null);e.name=this._nameSel.trim()||e.name,e.area=this._areaSel||null;const i=this._roomSettingsFromDialog();i?e.settings=i:delete e.settings,this._saveConfig(),this._roomDialog=!1,this._roomEditId=null,this._nameSel="",this._areaSel="",this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate(),this._showToast(this._t("toast.room_updated"))}_roomSrcCandidates(){const t=this.hass,e=Ur(this._markers),i=this._roomSrcFilter.trim().toLowerCase(),s=[];for(const o of Object.values(t.devices)){if("service"===o.entry_type)continue;if(e.devices.has(o.id))continue;const t=(o.name_by_user||o.name||o.id).trim();i&&!t.toLowerCase().includes(i)||s.push({value:"device:"+o.id,label:t,sub:o.model||this._t("marker.sub_device")})}for(const[o,n]of Object.entries(t.entities)){if(!o.startsWith("sensor.")||n.hidden)continue;if(Wr(t,o,e))continue;const r=n.name||t.states[o]?.attributes?.friendly_name||o;i&&!(r+" "+o).toLowerCase().includes(i)||s.push({value:"entity:"+o,label:r,sub:o})}return s.sort((t,e)=>t.label.localeCompare(e.label)),s.slice(0,200)}_roomSrcLabel(t){const e=t.indexOf(":"),i=t.slice(0,e),s=t.slice(e+1);return"device"===i?this.hass.devices[s]?.name_by_user||this.hass.devices[s]?.name||s:this.hass.entities[s]?.name||this.hass.states[s]?.attributes?.friendly_name||s}_labelPos(t,e){const i=this._layout["rl_"+(t.id||"")];if(i&&i.s===e)return{x:i.x*La,y:i.y*La};const s=this._snap(this._roomCenter(t));return{x:s[0],y:s[1]}}_labelDown(t,e,i){if("plan"!==this._mode)return;t.preventDefault(),t.stopPropagation();const s=this._labelPos(e,i);this._drag={id:"rl_"+(e.id||""),sx:t.clientX,sy:t.clientY,ox:s.x,oy:s.y,moved:!1},Ba(t),this._tip=null}_labelMove(t,e,i){const s="rl_"+(e.id||"");if(!this._drag||this._drag.id!==s)return;const o=this._stageEl;if(!o)return;const n=this._spaceModel(i).vb,r=o.getBoundingClientRect(),a=this._viewOr(n),l=(t.clientX-this._drag.sx)/r.width*a.w,c=(t.clientY-this._drag.sy)/r.height*a.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0);const h=co(this._drag.ox+l),d=co(this._drag.oy+c);this._savePos({id:s,space:i},h,d)}_labelUp(t){const e="rl_"+(t.id||"");if(!this._drag||this._drag.id!==e)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&window.setTimeout(()=>this._drag=null,0)}_labelScale(t){const e=this._layout["rl_"+(t.id||"")]?.k;return"number"==typeof e&&Number.isFinite(e)?Math.min(3,Math.max(.5,e)):1}_rlResizeDown(t,e,i){if("plan"!==this._mode)return;t.preventDefault(),t.stopPropagation();const s=t.target.closest(".roomlabel");if(!s)return;const o=s.getBoundingClientRect(),n=o.left+o.width/2,r=o.top+o.height/2,a=Math.max(8,Math.hypot(t.clientX-n,t.clientY-r));this._rlResize={id:"rl_"+(e.id||""),space:i,k0:this._labelScale(e),cx:n,cy:r,d0:a},Ba(t)}_rlResizeMove(t){const e=this._rlResize;if(!e)return;t.stopPropagation();const i=Math.max(8,Math.hypot(t.clientX-e.cx,t.clientY-e.cy)),s=Math.min(3,Math.max(.5,e.k0*(i/e.d0))),o=this._layout[e.id];if(o)this._layout={...this._layout,[e.id]:{...o,k:s}};else{const t=e.id.slice(3),i=this._spaceModel(e.space).rooms.find(e=>e.id===t);if(!i)return;const o=this._labelPos(i,e.space);this._layout={...this._layout,[e.id]:{s:e.space,x:o.x/La,y:o.y/La,k:s}}}this._dirtyPos.add(e.id)}_rlResizeUp(){this._rlResize&&(this._rlResize=null,this._persistLayout())}_renderRoomGear(t,e,i){if(!t.id)return V;let s=null;if(t.poly?(s=this._gearPtCache.get(t.poly)||null,s||(s=We(t.poly),this._gearPtCache.set(t.poly,s))):null!=t.x&&null!=t.y&&(s=[t.x+(t.w||0)/2,t.y+(t.h||0)/2]),!s)return V;const o=(s[0]-i.x)/i.w*100,n=(s[1]-i.y)/i.h*100;return W`<button class="rlgearbtn" style="left:${o}%;top:${n}%"
      title=${this._t("room.settings_title")}
      @pointerdown=${t=>t.stopPropagation()}
      @click=${e=>{e.stopPropagation(),this._openRoomEdit(t)}}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
      <span class="rlgeartext">${this._t("room.settings_short")}</span>
    </button>`}_renderRoomLabel(t,e,i,s){if(!t.name&&!this._markup)return V;const o=this._labelPos(t,e.id),n=(o.x-i.x)/i.w*100,r=(o.y-i.y)/i.h*100,a=Math.min(1,s.opacity+.25),l=this._labelScale(t),c=[];if(t.area||t.settings?.temp_source||t.settings?.hum_source||s.labelLight){if(s.labelTemp){const e=this._roomTemp(t);null!=e&&c.push(W`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${e}°</span>`)}if(s.labelHum){const e=this._roomHum(t);null!=e&&c.push(W`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${e}%</span>`)}if(s.labelLqi&&t.area){const e=this._roomLqi(t.area);null!=e&&c.push(W`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${e}</span>`)}if(s.labelLight){const e=(h=Ar(this.hass,this._devices,t)).length?{on:h.filter(t=>t.on).length,total:h.length}:null;if(e){const t=0===e.on?this._t("roomcard.light_off"):e.on===e.total?this._t("roomcard.light_on"):this._t("roomcard.light_partial",{on:e.on,total:e.total});c.push(W`<span class="rlm ${e.on?"lit":""}"><ha-icon icon=${e.on?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>${t}</span>`)}}}var h;return W`<div class="roomlabel ${c.length?"card":""}"
      data-hp="room-label" data-id=${t.id||V} data-area=${t.area||V}
      style="left:${n}%;top:${r}%;color:${s.color};opacity:${a};--rl-scale:${l};--rl-space:${s.cardFontScale};--rl-name:${Ki(t.settings?.name_scale)};--rl-meta:${Ki(t.settings?.label_scale)}"
      @pointerdown=${i=>this._labelDown(i,t,e.id)}
      @pointermove=${i=>this._labelMove(i,t,e.id)}
      @pointerup=${()=>this._labelUp(t)}
      @pointercancel=${()=>this._labelUp(t)}
    ><span class="rlname">${t.name||(this._markup?this._t("room.unnamed"):"")}${!this._markup&&t.area?W`<ha-icon class="rlgo" icon="mdi:open-in-new"
            title=${this._t("room.open_area")}
            @click=${e=>{e.stopPropagation(),this._clickRoom(t)}}
            @pointerdown=${t=>t.stopPropagation()}></ha-icon>`:V}</span>
      ${c.length?W`<span class="rlmetrics">${c}</span>`:V}
      ${"plan"===this._mode?["tl","tr","bl","br"].map(i=>W`<span class="rlhandle ${i}"
              @pointerdown=${i=>this._rlResizeDown(i,t,e.id)}
              @pointermove=${t=>this._rlResizeMove(t)}
              @pointerup=${()=>this._rlResizeUp()}
              @pointercancel=${()=>this._rlResizeUp()}></span>`):V}
    </div>`}get _measureAnchor(){return this._markup&&this._cursorPt?"draw"===this._tool&&this._path.length&&!this._contourClosed?this._path[this._path.length-1]:"split"===this._tool&&this._splitSel?.pts?.length?this._splitSel.pts[this._splitSel.pts.length-1]:null:null}_renderMeasureLabel(t){const e=this._measureAnchor,i=this._cursorPt,s=(i[0]-t.x)/t.w*100,o=(i[1]-t.y)/t.h*100,n=Yi(e,i),r=Math.round(10*n)/10,a=Ji(n);return W`<div class="measurelabel ${a?"on45":""}" style="left:${s}%;top:${o}%">
      ${this._fmtLen(e,i)} · ${r}°</div>`}get _decorMeasure(){const t=this._decorDraft;if(!t||"decor"!==this._mode)return null;const[e,i]=t.a,[s,o]=t.b;if(Math.abs(e-s)<1e-6&&Math.abs(i-o)<1e-6)return null;const n=(e+s)/2,r=(i+o)/2;if("line"===t.kind){const e=Yi(t.a,t.b);return{x:n,y:r,on45:Ji(e),text:`${this._fmtLen(t.a,t.b)} · ${Math.round(10*e)/10}°`}}const a=this._fmtLen([e,i],[s,i]),l=this._fmtLen([s,i],[s,o]);if("ellipse"===t.kind){const t=this._fmtLen([0,0],[Math.abs(s-e)/2,0]),a=this._fmtLen([0,0],[0,Math.abs(o-i)/2]);return{x:n,y:r,on45:!1,text:Math.abs(Math.abs(s-e)-Math.abs(o-i))<1e-6?`R ${t}`:`Rx ${t} × Ry ${a}`}}return{x:n,y:r,on45:!1,text:`${a} × ${l} · ${ys(Us(Math.abs(s-e),this._cellCm,this._gridPitch)*Us(Math.abs(o-i),this._cellCm,this._gridPitch)/1e4,this._imperial)}`}}get _alignPoint(){if(this._markup){if("draw"===this._tool&&this._path.length&&!this._contourClosed&&this._cursorPt)return this._cursorPt;if("split"===this._tool&&this._splitSel?.pts?.length&&this._cursorPt)return this._cursorPt;if(this._drag?.id.startsWith("rl_")&&this._drag.moved){const t=this._drag.id.slice(3),e=this._spaceModel().rooms.find(e=>e.id===t);return e?(()=>{const t=this._labelPos(e,this._space);return[t.x,t.y]})():null}return null}if("devices"===this._mode&&this._drag?.moved){const t=this._devices.find(t=>t.id===this._drag.id);return t?(()=>{const e=this._pos(t);return[e.x,e.y]})():null}if("decor"===this._mode){if(this._decorDraft)return this._decorDraft.b;if(this._decorMove){const t=this._decorList.find(t=>t.id===this._decorMove.id);if(!t)return null;const e=La,i=this._decorH;return"line"===t.kind?[t.x1*e,t.y1*i]:[t.x*e,t.y*i]}return null}return null}_alignCandidates(){const t=[],e=this._spaceModel();if(this._markup){if(this._drag?.id.startsWith("rl_")){const i=this._drag.id.slice(3);for(const s of e.rooms){if(!s.name||s.id===i)continue;const e=this._labelPos(s,this._space);t.push([e.x,e.y])}return t}for(const i of e.rooms){const e=ze(i);if(e)for(const i of e)t.push(i)}if("draw"===this._tool)for(const e of this._path)t.push(e);if("split"===this._tool&&this._splitSel?.pts)for(const e of this._splitSel.pts)t.push(e);return t}if("devices"===this._mode){for(const e of this._devices){if(e.space!==this._space||e.id===this._drag?.id)continue;const i=this._pos(e);t.push([i.x,i.y])}return t}if("decor"===this._mode){const e=this._decorMove?.id;return t.push(...this._decorSnapGeometry(e).points),this._decorDraft&&t.push(this._decorDraft.a),t}return t}_renderAlignGuides(){const t=this._alignPoint;if(!t)return B``;const e=this._drag?.id.startsWith("rl_")?.5*this._gridPitch:.05*this._gridPitch,i=function(t,e,i){let s=null,o=null;for(const n of e)if(!(Math.abs(n[0]-t[0])<1e-6&&Math.abs(n[1]-t[1])<1e-6)){if(Math.abs(n[0]-t[0])<=i){const e=Math.abs(n[1]-t[1]);e>1e-6&&(!s||e<s.d)&&(s={d:e,c:n})}if(Math.abs(n[1]-t[1])<=i){const e=Math.abs(n[0]-t[0]);e>1e-6&&(!o||e<o.d)&&(o={d:e,c:n})}}const n=[];return s&&n.push({axis:"x",at:s.c[0],from:s.c}),o&&n.push({axis:"y",at:o.c[1],from:o.c}),n}(t,this._alignCandidates(),e);if(!i.length)return B``;const s=this._gridPitch,o=1.5*s;return B`<g class="alignguides">
      ${i.map(e=>{const[i,n,r,a]="x"===e.axis?[e.at,e.from[1],e.at,t[1]+Math.sign(t[1]-e.from[1])*o]:[e.from[0],e.at,t[0]+Math.sign(t[0]-e.from[0])*o,e.at];return B`<line class="alignline" x1="${i}" y1="${n}" x2="${r}" y2="${a}"></line>
          <circle class="aligndot" cx="${e.from[0]}" cy="${e.from[1]}" r="${.18*s}"></circle>`})}
    </g>`}_renderOpeningCenterTick(t){const e=(t.angle+90)*Math.PI/180;return B`<line class="alignline opcentertick"
      x1="${t.x-15*Math.cos(e)}" y1="${t.y-15*Math.sin(e)}"
      x2="${t.x+15*Math.cos(e)}" y2="${t.y+15*Math.sin(e)}"></line>`}_roomCenter(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}_openingAmt(t){const e=t.contact&&this._planEntityAvailable(t.contact)?this.hass.states[t.contact]?.state:null;return Ne(t.type,e,!!t.invert)}_planEntityAvailable(t){return!!t&&!Wr(this.hass,t,Ur(this._markers))}_renderOpenings(t){const e=this._openingsR;if(!e.length)return B``;const i=t.color,s=this._spaceWalls,o=this._spaceModel().rooms;return B`${e.map(t=>{const e=t.rlen/2,n=this._openingAmt(t),r=n>0&&!!t.contact&&this._planEntityAvailable(t.contact)?"var(--hp-open)":i,a=s.length?Tn(o,{x:t.rx,y:t.ry,angle:t.angle,length:t.rlen,flip_v:t.flip_v},s,this._wallKeyPitch,this._cellCm,this._gridPitch,La):{ox:0,oy:0,cm:0},l=a.cm>0?a.cm/this._cellCm*this._gridPitch/2:4,c=t.flip_h?-1:1,h=t.flip_v?-1:1;let d,p=0,u=0;if(a.cm>0&&(a.ox||a.oy)){const e=-t.angle*Math.PI/180,i=Math.cos(e),s=Math.sin(e);p=a.ox*i-a.oy*s,u=a.ox*s+a.oy*i,u*=h,p*=c}if("window"===t.type){const t=Math.PI/2*e,i=a.cm>0?B`<line class="op-glass" x1="0" y1="${-l}" x2="0" y2="${l}"
              stroke="${r}" stroke-width="1.5"></line>`:V;d=B`
          <g transform="translate(${p} ${u})">
          <path class="op-arc" d="M 0 0 A ${e} ${e} 0 0 0 ${-e} ${-e}" fill="none"
            stroke="${r}" stroke-dasharray="${t}" stroke-dashoffset="${t*(1-n)}"></path>
          <path class="op-arc" d="M 0 0 A ${e} ${e} 0 0 1 ${e} ${-e}" fill="none"
            stroke="${r}" stroke-dasharray="${t}" stroke-dashoffset="${t*(1-n)}"></path>
          <g transform="translate(${-e} 0)">
            <g class="op-leaf" style="transform:rotate(${-90*n}deg)">
              <rect x="0" y="-1.5" width="${e}" height="3" fill="${r}"></rect>
            </g>
          </g>
          <g transform="translate(${e} 0)">
            <g class="op-leaf" style="transform:rotate(${90*n}deg)">
              <rect x="${-e}" y="-1.5" width="${e}" height="3" fill="${r}"></rect>
            </g>
          </g>
          ${i}
          </g>`}else{const i=t.rlen,s=Math.PI/2*i;d=B`
          <g transform="translate(${p} ${u})">
          <path class="op-arc" d="M ${e} 0 A ${i} ${i} 0 0 0 ${-e} ${-i}" fill="none"
            stroke="${r}" stroke-dasharray="${s}" stroke-dashoffset="${s*(1-n)}"></path>
          <g transform="translate(${-e} 0)">
            <g class="op-leaf" style="transform:rotate(${-90*n}deg)">
              <rect x="0" y="-1.75" width="${i}" height="3.5" fill="${r}"></rect>
            </g>
          </g>
          </g>`}return B`<g class="opening" data-hp="opening" data-id="${t.id}" data-kind="${t.type}"
        transform="translate(${t.rx} ${t.ry}) rotate(${t.angle})">
        <g transform="scale(${c} ${h})">
          <line x1="${-e}" y1="${-l}" x2="${-e}" y2="${l}" stroke="${i}" stroke-width="2.5"></line>
          <line x1="${e}" y1="${-l}" x2="${e}" y2="${l}" stroke="${i}" stroke-width="2.5"></line>
          ${d}
        </g>
        <rect class="op-outline" x="${-e-10}" y="${-Math.max(16,l+8)}" width="${t.rlen+20}" height="${Math.max(32,2*l+16)}" rx="6"></rect>
        <rect class="op-hit" x="${-e-12}" y="${-Math.max(20,l+10)}" width="${t.rlen+24}" height="${Math.max(40,2*l+20)}"
          @click=${e=>this._opClick(e,t)}
          @pointerdown=${e=>this._opPointerDown(e,t)}
          @pointermove=${e=>this._opPointerMove(e,t)}
          @pointerup=${e=>this._opPointerUp(e,t)}
          @pointercancel=${e=>this._opPointerUp(e,t)}></rect>
      </g>`})}`}_renderOpeningLocks(t){const e=this._openingsR.filter(t=>"door"===t.type&&t.lock&&this._planEntityAvailable(t.lock));return e.length?W`${e.map(e=>{const i=this.hass.states[e.lock]?.state,s="locked"===i,o=s||["unlocked","open","opening","unlocking","locking"].includes(String(i)),n=(e.angle+90)*Math.PI/180,r=16*(e.flip_v?-1:1),a=e.rx+Math.cos(n)*r,l=e.ry+Math.sin(n)*r,c=(a-t.x)/t.w*100,h=(l-t.y)/t.h*100;return W`<div class="oplock ${s?"locked":o?"unlocked":"unknown"}"
        style="left:${c}%;top:${h}%"
        @click=${t=>{t.stopPropagation(),"view"===this._mode&&(this._openingInfo=e)}}>
        <ha-icon icon="${s?"mdi:lock":o?"mdi:lock-open-variant":"mdi:lock-question"}"></ha-icon>
      </div>`})}`:W``}_lockAction(t,e){if(this._planEntityAvailable(t)){if("unlock"===e){const e=this.hass?.states?.[t]?.attributes?.friendly_name||t;if(!confirm(this._t("confirm.unlock",{name:e})))return}this.hass?.callService?.("lock",e,{entity_id:t})}}_renderOpeningInfoCard(){const t=this._openingInfo,e=t.contact&&this._planEntityAvailable(t.contact)?t.contact:null,i=t.lock&&this._planEntityAvailable(t.lock)?t.lock:null,s=e?this.hass.states[e]?.state:null,o=this._openingAmt(t),n=i?this.hass.states[i]?.state:null,r=(t,e,i,s="")=>W`<div class="oprow ${s}"><ha-icon icon=${t}></ha-icon><span>${e}</span><b>${i}</b></div>`;return W`<hp-dialog .hass=${this.hass}
      .title=${this._t("door"===t.type?"opening.door":"opening.window")}
      icon=${"door"===t.type?"mdi:door":"mdi:window-closed-variant"} dismiss-on-scrim
      @hp-close=${()=>this._openingInfo=null}>
        <div class="body">
          ${e?r(o>0?"mdi:door-open":"mdi:door-closed",this._t("opening.contact_label"),"unavailable"===s||null==s?this._t("opening.state_unknown"):this._t(o>0?"opening.open":"opening.closed"),o>0?"warn":"ok"):V}
          ${i?r("locked"===n?"mdi:lock":"mdi:lock-open-variant",this._t("opening.lock_label"),"locked"===n?this._t("opening.locked"):["unlocked","open"].includes(String(n))?this._t("opening.unlocked"):this._t("opening.state_unknown"),"locked"===n?"ok":"warn"):V}
          ${i&&("locked"===n||["unlocked","open"].includes(String(n)))?W`<button
                class="btn lockact ${"locked"===n?"warn":""}"
                @click=${()=>this._lockAction(i,"locked"===n?"unlock":"lock")}>
                <ha-icon icon=${"locked"===n?"mdi:lock-open-variant":"mdi:lock"}></ha-icon>
                ${this._t("locked"===n?"opening.unlock_action":"opening.lock_action")}
              </button>`:i&&["locking","unlocking"].includes(String(n))?W`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("opening.lock_pending")}
                </button>`:V}
          ${e||i?V:W`<p class="muted">${this._t("opening.no_entities")}</p>`}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingInfo=null}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_renderOpeningDialog(){const t=this._openingDialog,e=(t,e,i)=>W`<select class="areasel" @change=${t=>i(t.target.value)}>
        <option value="" ?selected=${!e}>${this._t("opening.none")}</option>
        ${t.map(t=>W`<option value=${t.value} ?selected=${t.value===e}>${t.label}</option>`)}
      </select>`;return W`<hp-dialog .hass=${this.hass}
      .title=${t.id?this._t("opening.edit"):this._t("opening.new")} icon="mdi:door"
      @hp-close=${()=>this._openingDialog=null}>
        <div class="body">
          <label>${this._t("opening.type_label")}</label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${"door"===t.type}
            @change=${()=>this._openingDialog={...t,type:"door",lengthCm:t.id?t.lengthCm:90}} />
            <span>${this._t("opening.door")}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${"window"===t.type}
            @change=${()=>this._openingDialog={...t,type:"window",lengthCm:t.id?t.lengthCm:120}} />
            <span>${this._t("opening.window")}</span></label>

          <label>${this._t("opening.length_label")}</label>
          <input class="namein tempin" type="number" min="20" max="600" step="5" .value=${String(t.lengthCm)}
            @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._openingDialog={...t,lengthCm:i})}} />

          <label>${this._t("opening.contact_label")}</label>
          ${e(this._contactCandidates(),t.contact,e=>this._openingDialog={...t,contact:e})}
          ${t.contact?W`<label class="srcrow">${this._boolInput(t.invert,e=>this._openingDialog={...t,invert:e})}
                <span>${this._t("opening.invert")}</span></label>`:V}

          ${"door"===t.type?W`<label>${this._t("opening.lock_label")}</label>
                ${e(this._lockCandidates(),t.lock,e=>this._openingDialog={...t,lock:e})}`:V}

          <label class="srcrow">${this._boolInput(t.flipH,e=>this._openingDialog={...t,flipH:e})}
            <span>${this._t("opening.flip_h")}</span></label>
          <label class="srcrow">${this._boolInput(t.flipV,e=>this._openingDialog={...t,flipV:e})}
            <span>${this._t("opening.flip_v")}</span></label>
        </div>
        <div class="row" slot="footer">
          ${t.id?W`<button class="btn danger" @click=${this._deleteOpening}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveOpening}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_gridLevels(){const t=this._stageEl,e=this._viewOr(this._baseVb()),i=t&&t.clientWidth&&e.w?t.clientWidth/e.w:1;return function(t,e,i=7){if(!(t>0&&e>0&&Number.isFinite(e)))return null;const s=So.find(s=>t*s*e>=i);if(void 0===s)return null;const o=So.find(t=>t>=5*s)??5*s;return{fine:s,coarse:o}}(this._gridPitch,i)}_renderMarkupDefs(t){const e=this._gridLevels();if(!e)return B`<defs></defs>`;const i=this._gridPitch*e.fine,s=this._gridPitch*e.coarse,o=this._gridPitch*e.fine*.14;return B`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${i}" height="${i}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${o}" class="griddot"></circle>
          <circle cx="${i}" cy="0" r="${o}" class="griddot"></circle>
          <circle cx="0" cy="${i}" r="${o}" class="griddot"></circle>
          <circle cx="${i}" cy="${i}" r="${o}" class="griddot"></circle>
        </pattern>
        <pattern id="hp-grid-major" x="0" y="0" width="${s}" height="${s}" patternUnits="userSpaceOnUse">
          <rect width="${s}" height="${s}" fill="url(#hp-grid)"></rect>
          <circle cx="0" cy="0" r="${2.1*o}" class="griddot major"></circle>
          <circle cx="${s}" cy="0" r="${2.1*o}" class="griddot major"></circle>
          <circle cx="0" cy="${s}" r="${2.1*o}" class="griddot major"></circle>
          <circle cx="${s}" cy="${s}" r="${2.1*o}" class="griddot major"></circle>
        </pattern>
      </defs>`}_renderMarkupLayer(t){const e=this._openPairs().flatMap(t=>t.segs),i=this._thickWallCuts(),s=e.concat(i),o=s.length?qi(this._segments,s,.02*this._gridPitch):this._segments,n=this._path,r=this._gridPitch,a=this._viewOr(this._baseVb()),l="draw"===this._tool?this._drawWallCm:null,c=(()=>"draw"===this._tool&&n.length&&null!=l&&l>0?this._contourClosed?n:this._cursorPt?[...n,this._cursorPt]:n.length>=2?n:null:null)(),h=c?cn(c,jo(l,this._cellCm,this._gridPitch)/2,this._contourClosed):"";return B`
      ${this._gridLevels()?B`<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:V}
      ${o.map(t=>B`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${h?B`<path class="drawwall-preview-fill" d="${h}"></path>
             <path class="drawwall-preview" d="${h}"></path>`:V}
      ${n.length>1?B`<polyline class="pathline" points="${n.map(t=>t.join(",")).join(" ")}"></polyline>`:V}
      ${n.length&&this._cursorPt&&"draw"===this._tool&&!this._contourClosed?B`<line class="preview" x1="${n[n.length-1][0]}" y1="${n[n.length-1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:V}
      ${n.map((t,e)=>B`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*r}"></circle>`)}
      ${(()=>{const t=this._openingPreview;if(!t)return V;const e=t.angle*Math.PI/180,i=Math.cos(e)*t.rlen/2,s=Math.sin(e)*t.rlen/2;return B`<line class="opghost" x1="${t.x-i}" y1="${t.y-s}"
          x2="${t.x+i}" y2="${t.y+s}"></line>
          <circle class="opghost-dot" cx="${t.x}" cy="${t.y}" r="${.18*r}"></circle>`})()}
      ${"split"===this._tool&&this._splitSel?.pts?.length?B`${this._splitSel.pts.length>1?B`<polyline class="pathline" points="${this._splitSel.pts.map(t=>t.join(",")).join(" ")}"></polyline>`:V}
            ${this._splitSel.pts.map((t,e)=>B`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*r}"></circle>`)}
            ${this._cursorPt?B`<line class="preview" x1="${this._splitSel.pts[this._splitSel.pts.length-1][0]}" y1="${this._splitSel.pts[this._splitSel.pts.length-1][1]}"
                  x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:V}`:V}
    `}_renderMarkupBar(){const t=this._geometryHistory.undoName,e=this._geometryHistory.redoName;return W`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <span class="wallsgroup">
        <button class="btn ${"draw"===this._tool?"on":""}" @click=${()=>this._tool="draw"}
          title=${this._t("title.markup_add")}>
          <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this._t("markup.add")}
        </button>
        ${"draw"===this._tool?W`<label class="drawwall">${this._t("wallthick.field")}
              <input type="number" min="0" max="100" step="any"
                .value=${this._drawWallFieldValue}
                @input=${t=>{this._drawWallField=t.target.value}}
                title=${this._t("markup.draw_wall_title")} />
              <span class="opl">${this._t(this._imperial?"wallthick.unit_in":"wallthick.unit_cm")}</span>
            </label>`:V}
      </span>
      <button class="btn ${"merge"===this._tool?"on":""}"
        @click=${()=>{this._tool="merge",this._cancelPath(),this._tool="merge"}}
        title=${this._t("title.markup_merge")}>
        <ha-icon icon="mdi:vector-union"></ha-icon>${this._t("markup.merge")}
      </button>
      <button class="btn ${"split"===this._tool?"on":""}"
        @click=${()=>{this._tool="split",this._cancelPath(),this._tool="split"}}
        title=${this._t("title.markup_split")}>
        <ha-icon icon="mdi:vector-polyline-remove"></ha-icon>${this._t("markup.split")}
      </button>
      <button class="btn ${"resize"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="resize",this._rszSel=null}}
        title=${this._t("title.markup_resize")}>
        <ha-icon icon="mdi:arrow-expand-all"></ha-icon>${this._t("markup.resize")}
      </button>
      <button class="btn ${"opening"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="opening"}}
        title=${this._t("title.markup_opening")}>
        <ha-icon icon="mdi:door"></ha-icon>${this._t("markup.opening")}
      </button>
      <button class="btn ${"openwall"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="openwall",this._wallDialog=null}}
        title=${this._t("title.markup_openwall")}>
        <ha-icon icon="mdi:border-none-variant"></ha-icon>${this._t("markup.openwall")}
      </button>
      <button class="btn ${"closewall"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="closewall",this._wallDialog=null}}
        title=${this._t("title.markup_closewall")}>
        <ha-icon icon="mdi:border-all-variant"></ha-icon>${this._t("markup.closewall")}
      </button>
      <button class="btn ${"wallthick"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="wallthick",this._wallDialog=null}}
        title=${this._t("title.markup_wallthick")}>
        <ha-icon icon="mdi:wall"></ha-icon>${this._t("markup.wallthick")}
      </button>
      <button class="btn ${"delroom"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="delroom"}}
        title=${this._t("title.markup_delroom")}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("markup.delete_room")}
      </button>
      <button class="btn ghost" @click=${this._undoGeometry}
        ?disabled=${!t}
        title=${t?this._t("history.undo_named",{name:t}):this._t("history.undo_empty")}>
        <ha-icon icon="mdi:undo-variant"></ha-icon>${this._t("history.undo")}
      </button>
      <button class="btn ghost" @click=${this._redoGeometry}
        ?disabled=${!e}
        title=${e?this._t("history.redo_named",{name:e}):this._t("history.redo_empty")}>
        <ha-icon icon="mdi:redo-variant"></ha-icon>${this._t("history.redo")}
      </button>
      <span class="spacer"></span>
      ${"draw"===this._tool?W`<span class="hint">${this._path.length?this._t("markup.hint_points",{n:this._path.length}):this._t("markup.hint_start")}</span>
            ${this._path.length?W`<button class="btn ghost" @click=${this._cancelPath}>${this._t("btn.reset")}</button>`:V}`:V}
      ${"resize"===this._tool?W`<span class="hint">${this._t("markup.hint_resize")}</span>`:V}
      ${"wallthick"===this._tool?W`<span class="hint">${this._t("markup.hint_wallthick")}</span>`:V}
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_renderDevicesBar(){return W`<div class="editbar devbar">
      <ha-icon icon="mdi:tune-variant" class="warn"></ha-icon>
      <button class="btn" @click=${()=>this._openMarkerDialog()} title=${this._t("title.add_device")}>
        <ha-icon icon="mdi:plus-box-outline"></ha-icon>${this._t("devbar.add")}
      </button>
      <button class="btn ${this._showAll?"on":""}" @click=${this._toggleShowAll}
        title=${this._t("title.show_all")}>
        <ha-icon icon="${this._showAll?"mdi:eye":"mdi:eye-off-outline"}"></ha-icon>${this._t("devbar.show_all")}
      </button>
      <button class="btn" @click=${this._openRulesDialog} title=${this._t("title.icon_rules")}>
        <ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t("devbar.rules")}
      </button>
      <span class="spacer"></span>
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_cardEntities(t){const e=this.hass,i=[],s=new Set,o=t=>{if(!t||s.has(t)||!e.states[t])return;const o=e.entities[t];if("config"===o?.entity_category||"diagnostic"===o?.entity_category)return;s.add(t);const n=t.split(".")[0];["light","switch","fan","humidifier","siren","input_boolean"].includes(n)?i.push({eid:t,kind:"toggle"}):["cover","valve","lock","climate","media_player","vacuum","water_heater"].includes(n)?i.push({eid:t,kind:"open"}):["sensor","binary_sensor","number","select"].includes(n)&&i.push({eid:t,kind:"value"})};for(const i of Ar(e,[t]))o(i.eid);t.primary&&o(t.primary);for(const e of t.entities)o(e);return i.slice(0,12)}_cardToggle(t){const e=t.split(".")[0];"lock"!==e&&"alarm_control_panel"!==e&&this.hass.callService("homeassistant","toggle",{entity_id:t}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))}_renderInfoCard(){const t=this._infoCard,e=t.primary?this.hass.states[t.primary]:void 0,i=e?gi(this.hass,t.primary)?.text??e.state:null,s=(t.controls??t.marker?.controls??[]).filter(Ii);return W`<hp-dialog .hass=${this.hass} .title=${t.name} .icon=${t.icon}
      dismiss-on-scrim @hp-close=${()=>this._infoCard=null}>
        <div class="body">
          ${(()=>{const e=this._cardEntities(t);return e.length?W`<div class="entlist">
              ${e.map(({eid:t,kind:e})=>{const i=this.hass.states[t],s=this.hass.entities[t]?.name||i?.attributes?.friendly_name||t,o=i?gi(this.hass,t)?.text??i.state:"",n="on"===i?.state||["open","unlocked","playing","cleaning"].includes(i?.state);return W`<div class="entrow ${n?"on":""}">
                  <ha-icon icon=${Ni(yt(s,"",this._iconRules),t.split(".")[0],i?.attributes?.device_class,i?.state,!1)}></ha-icon>
                  <span class="en">${s}</span>
                  ${"toggle"===e?W`<button class="entbtn ${n?"on":""}"
                        @click=${()=>this._cardToggle(t)}>${o}</button>`:"open"===e?W`<button class="entbtn"
                          @click=${()=>{this._infoCard=null,this._openMoreInfo(t)}}>${o}</button>`:W`<span class="ev">${o}</span>`}
                </div>`})}
            </div>`:V})()}
          ${t.model?W`<div class="inforow"><span class="k">${this._t("info.model")}</span><span>${t.model}</span></div>`:V}
          ${i&&!this._cardEntities(t).length?W`<div class="inforow"><span class="k">${this._t("info.state")}</span><span>${i}</span></div>`:V}
          ${ii(t.link)?W`<div class="inforow"><span class="k">${this._t("info.link")}</span>
                <a href="${ii(t.link)}" target="_blank" rel="noreferrer noopener">${t.link}</a></div>`:V}
          ${t.description?W`<div class="infodesc">${t.description}</div>`:V}
          ${t.pdfs&&t.pdfs.length?W`<div class="inforow"><span class="k">${this._t("info.manuals")}</span><span class="pdflist">
                ${t.pdfs.map(t=>W`<a class="pdf" href="${ii(this._display(t.url))||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${t.name}</a>`)}</span></div>`:V}
          ${s.length?W`<div class="inforow"><span class="k">${this._t("info.controls")}</span>
                <span class="ctrlstates">
                  ${s.map(t=>{const e=this.hass.states[t],i="on"===e?.state;return W`<span class="ctrlstate ${i?"on":""}">
                      <ha-icon icon=${i?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>
                      ${e?.attributes?.friendly_name||t}</span>`})}
                </span></div>`:V}
          ${t.model||i||t.link||t.description||t.pdfs&&t.pdfs.length||s.length?V:W`<div class="infodesc muted">${this._t("info.none")}</div>`}
        </div>
        <div class="row infofooter" slot="footer">
          <button class="btn" @click=${()=>{const e=t;this._infoCard=null,this._openMarkerDialog(e)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t("btn.edit")}
          </button>
          ${t.primary?W`<button class="btn" @click=${()=>{const e=t.primary;this._infoCard=null,this._openMoreInfo(e)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("btn.open_in_ha")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._infoCard=null}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_renderMarkerDialog(){const t=this._markerDialog,e="virtual"===t.bindingMode,i=this._bindingCandidates(),s=this._bindingEntities(t.binding),o=(()=>{if(e)return null;const s=i.find(e=>e.value===t.binding);if(s)return s.label;const[o,n]=t.binding.split(":");return"device"===o?this.hass.devices[n]?.name_by_user||this.hass.devices[n]?.name||n:this.hass.states[n]?.attributes?.friendly_name||n})();return W`<hp-dialog .hass=${this.hass}
      .title=${t.devId?this._t("info.device_header"):this._t("marker.new_device")}
      icon="mdi:shape-plus" wide @hp-close=${()=>this._markerDialog=null}>
        <div class="body">
          <label>${this._t("marker.name_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("marker.name_ph")}
            .value=${t.name}
            @input=${e=>this._markerDialog={...t,name:e.target.value}} />

          <label>${this._t("marker.binding_label")}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${"virtual"===t.bindingMode}
                @change=${()=>this._markerDialog={...t,bindingMode:"virtual",binding:"virtual",bindingOpen:!1,controls:zr("virtual",t.controls),autoIcon:this._autoIconForBinding("virtual")}} />
              <span>${this._t("marker.virtual_option")}</span>
            </label>
            <div class="bindharow">
              <label class="srcrow">
                <input type="radio" name="bmode" .checked=${"ha"===t.bindingMode}
                  @change=${()=>this._markerDialog={...t,bindingMode:"ha",binding:"virtual"===t.binding?"":t.binding,bindingOpen:"virtual"===t.binding||!t.binding}} />
                <span>${this._t("marker.from_ha_option")}</span>
              </label>
              <label class="srcrow inline entcheck" title=${this._t("marker.show_entities_tip")}>
                ${this._boolInput(t.showEntities,e=>this._markerDialog={...t,showEntities:e},"ha"!==t.bindingMode)}
                <span>${this._t("marker.show_entities")}</span>
              </label>
            </div>
            ${"ha"===t.bindingMode?W`<button class="dropbtn ${t.bindingOpen?"open":""}"
                    @click=${()=>this._markerDialog={...t,bindingOpen:!t.bindingOpen}}>
                    ${o?W`<b>${o}</b><span class="ref">${t.binding}</span>`:W`<span class="muted">${this._t("marker.pick_ph")}</span>`}
                    <ha-icon icon=${t.bindingOpen?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
                  </button>
                  ${t.bindingOpen?W`<div class="droppanel">
                        <input class="namein" type="text" placeholder=${this._t("marker.search_ph")}
                          .value=${t.bindingFilter}
                          @input=${e=>this._markerDialog={...t,bindingFilter:e.target.value}} />
                        <div class="candlist">
                          ${i.map(e=>W`<div class="cand ${e.value===t.binding?"sel":""}"
                              @click=${()=>this._markerDialog={...t,binding:e.value,bindingOpen:!1,controls:zr(e.value,t.controls,this._bindingEntities(e.value)),autoIcon:this._autoIconForBinding(e.value)}}>
                              <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                            </div>`)}
                          ${i.length?V:W`<div class="cand muted">${this._t("marker.nothing_found")}</div>`}
                        </div>
                      </div>`:V}`:V}
          </div>

          <label>${this._t("marker.room_label")}${e?"":this._t("marker.room_override")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,room:e.target.value}}>
            <option value="">${e?this._t("marker.room_choose"):this._t("marker.room_auto")}</option>
            ${this._allRoomsFlat().map(e=>W`<option value=${e.value} ?selected=${e.value===t.room}>${e.label}</option>`)}
          </select>

          ${this._renderVacSection(t)}

          <label>${this._t("marker.tap_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,tapAction:e.target.value}}>
            ${oi.filter(e=>"cover"!==e||this._bindingCoverTap(t.binding)).map(t=>[t,"tap."+t.replace("-","_")]).map(([e,i])=>W`<option value=${e} ?selected=${(t.tapAction||t.defaultTap)===e}>${this._t(i)}</option>`)}
          </select>
          ${"run"===t.tapAction?(()=>{const e=t.runFilter.trim().toLowerCase(),i=this._runCandidates().filter(t=>!e||t.label.toLowerCase().includes(e)||t.value.includes(e)),s=t.tapTarget?this._runCandidates().find(e=>e.value===t.tapTarget):null;return W`
                  <label>${this._t("marker.run_target_label")}</label>
                  ${t.tapTarget&&!s?W`<div class="rhint">${this._t("marker.run_target_gone",{id:t.tapTarget})}</div>`:V}
                  <input class="namein" type="text" placeholder=${this._t("marker.run_search_ph")}
                    .value=${s?s.label:t.runFilter}
                    @focus=${t=>{t.target.select()}}
                    @input=${e=>this._markerDialog={...t,runFilter:e.target.value,tapTarget:""}} />
                  ${s?V:W`<div class="candlist">
                        ${i.slice(0,40).map(e=>W`<div class="cand ${e.value===t.tapTarget?"sel":""}"
                            @click=${()=>this._markerDialog={...t,tapTarget:e.value,runFilter:""}}>
                            <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                          </div>`)}
                        ${i.length?V:W`<div class="cand muted">${this._t("marker.nothing_found")}</div>`}
                      </div>`}`})():V}
          ${"run"===t.tapAction||"toggle"===t.tapAction||"cover"===t.tapAction||!t.tapAction&&"toggle"===t.defaultTap?W`<label class="srcrow" title=${this._t("marker.tap_confirm_tip")}>
                ${this._boolInput(t.tapConfirm,e=>this._markerDialog={...t,tapConfirm:e})}
                <span>${this._t("marker.tap_confirm")}</span>
              </label>`:V}

          <label>${this._t("marker.controls_label")}</label>
          <div class="rhint">${this._t("marker.controls_hint")}</div>
          ${t.controls.length?W`<div class="ctrlchips">
                ${t.controls.map(e=>W`<span class="ctrlchip">
                  ${this.hass.states[e]?.attributes?.friendly_name||e}
                  <ha-icon icon="mdi:close" @click=${()=>this._markerDialog={...t,controls:t.controls.filter(t=>t!==e)}}></ha-icon>
                </span>`)}
              </div>`:V}
          <input class="namein" type="text" placeholder=${this._t("marker.controls_filter")}
            .value=${t.controlsFilter}
            @input=${e=>this._markerDialog={...t,controlsFilter:e.target.value}} />
          ${t.controlsFilter.trim()?W`<div class="ctrllist">
                ${Object.keys(this.hass.states).filter(e=>zr(t.binding,[e],s).length>0&&!t.controls.includes(e)).filter(e=>{const i=t.controlsFilter.trim().toLowerCase(),s=String(this.hass.states[e]?.attributes?.friendly_name||"");return e.toLowerCase().includes(i)||s.toLowerCase().includes(i)}).slice(0,8).map(e=>W`<button class="ctrlopt"
                    @click=${()=>this._markerDialog={...t,controls:[...t.controls,e],controlsFilter:""}}>
                    <ha-icon icon=${e.startsWith("light.")?"mdi:lightbulb":"mdi:toggle-switch"}></ha-icon>
                    ${this.hass.states[e]?.attributes?.friendly_name||e}
                    <span class="sub">${e}</span>
                  </button>`)}
              </div>`:V}

          ${this._bindingHasClimate(t.binding)?W`<label class="srcrow climrow" title=${this._t("marker.use_climate_temp_tip")}>
                ${this._boolInput(t.useClimateTemp,e=>this._markerDialog={...t,useClimateTemp:e})}
                <span>${this._t("marker.use_climate_temp")}</span>
              </label>`:V}
          <label class="srcrow" title=${this._t("marker.is_light_tip")}>
            ${this._boolInput(t.isLight,e=>this._markerDialog={...t,isLight:e})}
            <span>${this._t("marker.is_light")}</span>
          </label>
          <label>${this._t("marker.glow_radius_label")}</label>
          <div class="colorrow">
            <input class="tempin" type="number" min="0.5" step="0.5"
              placeholder=${this._glowRadiusPlaceholder}
              .value=${t.glowRadius}
              @input=${e=>this._markerDialog={...t,glowRadius:e.target.value}} />
            <span class="opl">${this._imperial?this._t("gs.unit_ft"):this._t("gs.unit_m")}</span>
            <span class="opl muted">${this._t("marker.glow_radius_hint")}</span>
          </div>

          <label>${this._t("marker.icon_label")}</label>
          ${customElements.get("ha-icon-picker")?W`<ha-icon-picker .hass=${this.hass} .value=${t.icon||t.autoIcon}
                .placeholder=${t.autoIcon||void 0}
                .fallbackPath=${void 0}
                @value-changed=${e=>{const i=e.detail.value||"";(t.icon||i!==t.autoIcon)&&(this._markerDialog={...t,icon:i})}}></ha-icon-picker>`:W`<input class="namein" type="text"
                placeholder=${t.autoIcon||this._t("marker.icon_ph")}
                .value=${t.icon}
                @input=${e=>this._markerDialog={...t,icon:e.target.value}} />`}
          ${!t.icon&&t.autoIcon?W`<p class="muted iconauto"><ha-icon icon=${t.autoIcon}></ha-icon>
                <span>${this._t("marker.icon_auto",{icon:t.autoIcon})}</span>
                <button class="btn ghost" type="button"
                  @click=${()=>this._markerDialog={...t,icon:t.autoIcon}}>
                  ${this._t("marker.icon_pin_auto")}
                </button></p>`:V}

          <label>${this._t("marker.display_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,display:e.target.value}}>
            ${si.map(t=>[t,"display."+t]).map(([e,i])=>W`<option value=${e} ?selected=${t.display===e}>${this._t(i)}</option>`)}
          </select>
          <p class="muted">${this._t("marker.display_hint")}</p>
          ${"icon_ripple"===t.display?W`<div class="colorrow">
                <span class="opl">${this._t("marker.activity_color")}</span>
                <input type="color" .value=${t.rippleColor||"#3ea6ff"}
                  @input=${e=>this._markerDialog={...t,rippleColor:e.target.value}} />
                <span class="opl">${this._t("marker.ripple_size")}</span>
                ${this._rangeInput(2,8,.5,t.rippleSize,e=>this._markerDialog={...t,rippleSize:e})}
                <span class="opv">×${t.rippleSize}</span>
              </div>`:V}

          <label>${this._t("marker.size_label")}</label>
          <div class="colorrow">
            ${this._rangeInput(.5,3,.1,t.size,e=>this._markerDialog={...t,size:e})}
            <span class="opv">×${t.size.toFixed(1)}</span>
            <span class="opl">${this._t("marker.angle_label")}</span>
            ${""}
            ${this._rangeInput(0,355,5,t.angle,e=>this._markerDialog={...t,angle:e})}
            <span class="opv">${t.angle}°</span>
          </div>

          <label>${this._t("marker.model_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("marker.model_ph")}
            .value=${t.model}
            @input=${e=>this._markerDialog={...t,model:e.target.value}} />

          <label>${this._t("marker.link_label")}</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${t.link}
            @input=${e=>this._markerDialog={...t,link:e.target.value}} />

          <label>${this._t("marker.desc_label")}</label>
          <textarea class="descin" rows="4" placeholder=${this._t("marker.desc_ph")}
            .value=${t.description}
            @input=${e=>this._markerDialog={...t,description:e.target.value}}></textarea>

          <label>${this._t("marker.manuals_label")}</label>
          <div class="pdfedit">
            ${t.pdfs.map(t=>W`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${ii(this._display(t.url))||"#"}" target="_blank" rel="noreferrer noopener">${t.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${()=>this._removeMarkerPdf(t.url)}></ha-icon></span>`)}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>${this._t("btn.attach")}
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${t=>this._pickMarkerFiles(t)} />
            </label>
          </div>
        </div>
        <div class="row markerfooter" slot="footer">
          <div class="markeractions">
            ${t.devId?W`<button class="btn" type="button"
                  ?disabled=${t.busy}
                  aria-pressed=${t.hideFromPlan?"true":"false"}
                  title=${this._t(t.hideFromPlan?"marker.show_tip":"marker.hide_tip")}
                  @click=${()=>this._markerDialog={...t,hideFromPlan:!t.hideFromPlan}}>
                  <ha-icon icon=${t.hideFromPlan?"mdi:eye-outline":"mdi:eye-off-outline"}></ha-icon>
                  ${this._t(t.hideFromPlan?"marker.show":"marker.hide")}
                </button>`:V}
            ${t.devId?W`<button class="btn danger" type="button" ?disabled=${t.busy}
                  title=${this._t("marker.delete_tip")} @click=${this._deleteMarker}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
                </button>`:V}
          </div>
          <div class="markersaveactions">
            <button class="btn ghost" ?disabled=${t.busy}
              @click=${()=>this._markerDialog=null}>${this._t("btn.cancel")}</button>
            <button class="btn on" @click=${this._saveMarker}
              ?disabled=${t.busy||"ha"===t.bindingMode&&(!t.binding||"virtual"===t.binding)}
              title=${"ha"!==t.bindingMode||t.binding&&"virtual"!==t.binding?"":this._t("marker.pick_ph")}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}_renderSpaceDialog(){const t=this._spaceDialog,e=this._importTotal>0&&"create"===t.mode?this._t("import.progress",{i:this._importTotal-this._importQueue.length,n:this._importTotal}):"",i=()=>{this._spaceDialog=null,this._importQueue=[],this._importTotal=0};return W`<hp-dialog .hass=${this.hass}
      .title=${`${"create"===t.mode?this._t("space.new"):this._t("space.header")}${e?` · ${e}`:""}`}
      icon="mdi:floor-plan" wide @hp-close=${i}>
        <div class="body">
          <label>${this._t("space.title_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("space.title_ph")}
            .value=${t.title}
            @input=${e=>this._spaceDialog={...t,title:e.target.value}} />
          <label>${this._t("space.plan_label")}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"file"===t.source}
              @change=${()=>this._spaceDialog={...t,source:"file"}} />
            <span>${this._t("space.source_file")}</span>
          </label>
          ${"file"===t.source?W`<div class="planrow">
                ${t.planFile?W`<span class="planname">${t.planFile.name}</span>`:t.planUrl?W`<img class="planprev" src=${this._display(t.planUrl)} alt=${this._t("space.plan_alt")} />`:W`<span class="planname muted">${this._t("space.no_plan")}</span>`}
                <label class="btn filebtn">
                  <ha-icon icon="mdi:upload"></ha-icon>${t.planUrl||t.planFile?this._t("btn.replace"):this._t("btn.upload")}
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${t=>this._pickPlanFile(t)} />
                </label>
                <button class="btn ghost" @click=${this._toggleServerPlans}
                  title=${this._t("space.pick_saved_hint")}>
                  <ha-icon icon="mdi:folder-image"></ha-icon>${this._t("space.pick_saved")}
                </button>
              </div>
              ${t.pickSaved?this._renderServerPlans(t):V}`:V}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"draw"===t.source}
              @change=${()=>this._spaceDialog={...t,source:"draw"}} />
            <span>${this._t("space.source_draw")}</span>
          </label>

          <label>${this._t("space.scale_label")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min=${.1} max=${Sa}
              step="0.1" .value=${String(t.cellCm)}
              @input=${e=>{const i=parseFloat(e.target.value);this._spaceDialog={...t,cellCm:Number.isFinite(i)&&i>0?Math.max(.1,Math.min(Sa,i)):t.cellCm}}} />
            <span class="opl">${this._t("space.scale_unit")}</span>
          </div>

          <label class="dispsection">${this._t("space.display_section")}</label>
          <label class="srcrow">
            ${this._boolInput(t.showBorders,e=>this._spaceDialog={...t,showBorders:e})}
            <span>${this._t("space.show_borders")}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(t.showNames,e=>this._spaceDialog={...t,showNames:e})}
            <span>${this._t("space.show_names")}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(t.showLqi,e=>this._spaceDialog={...t,showLqi:e})}
            <span>${this._t("space.show_lqi")}</span>
          </label>
          ${""}
          <label class="srcrow">
            ${this._boolInput(t.hideDecor,e=>this._spaceDialog={...t,hideDecor:e})}
            <span>${this._t("space.hide_decor")}</span>
          </label>
          <div class="rhint">${this._t("space.hide_decor_tip")}</div>
          <label class="srcrow">
            ${this._boolInput(t.hideOpenings,e=>this._spaceDialog={...t,hideOpenings:e})}
            <span>${this._t("space.hide_openings")}</span>
          </label>
          <div class="rhint">${this._t("space.hide_openings_tip")}</div>
          <label class="dispsection">${this._t("space.roomcard_section")}</label>
          ${[["labelTemp","space.label_temp"],["labelHum","space.label_hum"],["labelLqi","space.label_lqi"],["labelLight","space.label_light"]].map(([e,i])=>W`<label class="srcrow">
              ${this._boolInput(t[e],i=>this._spaceDialog={...t,[e]:i})}
              <span>${this._t(i)}</span>
            </label>`)}
          <label>${this._t("space.card_font")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*t.cardFontScale),e=>this._spaceDialog={...t,cardFontScale:e/100})}
            <span class="opv">${Math.round(100*t.cardFontScale)}%</span>
          </div>
          ${this._renderCardPreview(t.cardFontScale,1,1)}
          <label>${this._t("space.room_color")}</label>
          <div class="colorrow">
            <input type="color" .value=${t.roomColor}
              @input=${e=>this._spaceDialog={...t,roomColor:e.target.value}} />
            <span class="opl">${this._t("space.opacity")}</span>
            ${this._rangeInput(0,100,1,Math.round(100*t.roomOpacity),e=>this._spaceDialog={...t,roomOpacity:e/100})}
            <span class="opv">${Math.round(100*t.roomOpacity)}%</span>
          </div>
          <label>${this._t("space.bg_mode")}</label>
          <select class="areasel"
            @change=${e=>{const i=e.target.value;this._spaceDialog={...t,bgMode:"static"===i||"daynight"===i?i:null}}}>
            <option value="" ?selected=${null===t.bgMode}>${this._t("space.sun_inherit")}</option>
            <option value="static" ?selected=${"static"===t.bgMode}>${this._t("gs.bg_static")}</option>
            <option value="daynight" ?selected=${"daynight"===t.bgMode}>${this._t("gs.bg_daynight")}</option>
          </select>
          ${"static"===(t.bgMode??As(this._settings,{}))?W`<label>${this._t("space.bg_color")}</label>
              <div class="colorrow">
                <input type="color" .value=${t.bgColor||Si(this._settings,{bgColor:null})||this._stageBgHex()}
                  @input=${e=>this._spaceDialog={...t,bgColor:e.target.value}} />
                ${t.bgColor?W`<button class="btn ghost" @click=${()=>this._spaceDialog={...t,bgColor:null}}>
                      ${this._t("space.bg_inherit")}</button>`:W`<span class="opl">${this._t("space.bg_inherited")}</span>`}
              </div>`:V}
          <label>${this._t("space.north")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this._t("space.sun_inherit")}
              .value=${null===t.northDeg?"":String(t.northDeg)}
              @input=${e=>{const i=e.target.value.trim(),s=""===i?null:Math.round(Number(i));this._spaceDialog={...t,northDeg:null!==s&&Number.isFinite(s)?Math.min(359,Math.max(0,s)):null}}} />
            <span class="opl">${null===t.northDeg?this._t("space.north_inherited",{v:null===Rs(this._settings,{})?"—":String(Rs(this._settings,{}))+"°"}):"°"}</span>
          </div>
          <label>${this._t("space.sun_rays")}</label>
          <select class="areasel"
            @change=${e=>{const i=e.target.value;this._spaceDialog={...t,sunRays:""===i?null:"1"===i}}}>
            <option value="" ?selected=${null===t.sunRays}>${this._t("space.sun_inherit")}</option>
            <option value="1" ?selected=${!0===t.sunRays}>${this._t("space.sun_on")}</option>
            <option value="0" ?selected=${!1===t.sunRays}>${this._t("space.sun_off")}</option>
          </select>
          <label>${this._t("space.fill_label")}</label>
          ${ni.map(t=>[t,"fill."+t]).map(([e,i])=>W`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===e}
                @change=${()=>this._spaceDialog={...t,fillMode:e}} />
              <span>${this._t(i)}</span>
              ${"temp"===e&&"temp"===t.fillMode?W`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMin)}
                      @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._spaceDialog={...t,tempMin:i})}} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMax)}
                      @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._spaceDialog={...t,tempMax:i})}} />
                    °C
                  </span>`:V}
            </label>`)}
        </div>
        <div class="row" slot="footer">
          ${"edit"===t.mode?W`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:V}
          <span class="spacer"></span>
          ${this._importTotal>0&&"create"===t.mode?W`<button class="btn ghost" @click=${()=>this._skipImport()}>${this._t("btn.skip")}</button>`:V}
          <button class="btn ghost" @click=${i}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
            title=${"file"!==t.source||t.planFile||t.planUrl?"":this._t("title.need_plan")}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_renderMergeDialog(){const t=this._mergeDialog,e=this._spaceModel().rooms,i=(i,s)=>{const o=e.find(t=>t.id===i),n=o?.area?this.hass.areas[o.area]?.name:null;return W`<label class="srcrow">
        <input type="radio" name="mergekeep" .checked=${t.pick===s}
          @change=${()=>this._mergeDialog={...t,pick:s}} />
        <span>${o?.name||""} <span class="muted">· ${n||this._t("merge.no_area")}</span></span>
      </label>`};return W`<hp-dialog .hass=${this.hass} .title=${this._t("merge.header")} icon="mdi:vector-union"
      @hp-close=${()=>this._mergeDialog=null}>
        <div class="body">
          <p class="muted">${this._t("merge.hint")}</p>
          <label>${this._t("merge.keep")}</label>
          ${i(t.aId,"a")}
          ${i(t.bId,"b")}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._mergeDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._commitMerge}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
          </button>
        </div>
    </hp-dialog>`}_renderCardPreview(t,e,i){const s=18*t;return W`<div class="cardpreview">
      <span class="cpname" style="font-size:${(s*e).toFixed(1)}px">
        ${this._t("preview.room_name")}</span>
      <span class="cpmeta" style="font-size:${(.62*s*i).toFixed(1)}px">
        <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
        <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
        <ha-icon icon="mdi:lightbulb-on"></ha-icon>${this._t("roomcard.light_partial",{on:1,total:3})}
      </span>
    </div>`}_renderRoomSource(t){const e="temp"===t?this._roomTempSrc:this._roomHumSrc,i=e=>{"temp"===t?this._roomTempSrc=e:this._roomHumSrc=e,this.requestUpdate()},s=this._roomSrcOpen===t;return W`
      <label>${this._t("temp"===t?"room.temp_src_label":"room.hum_src_label")}</label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${t}" .checked=${!e}
          @change=${()=>{i(""),this._roomSrcOpen=null}} />
        <span>${this._t("room.src_average")}</span>
      </label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${t}" .checked=${!!e}
          @change=${()=>{this._roomSrcOpen=t,this._roomSrcFilter="",this.requestUpdate()}} />
        <span>${this._t("room.src_pick")}</span>
      </label>
      ${e||s?W`<button class="dropbtn ${s?"open":""}"
              @click=${()=>{this._roomSrcOpen=s?null:t,this._roomSrcFilter=""}}>
              ${e?W`<b>${this._roomSrcLabel(e)}</b><span class="ref">${e}</span>`:W`<span class="muted">${this._t("room.src_ph")}</span>`}
              <ha-icon icon=${s?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
            </button>
            ${s?W`<div class="droppanel">
                  <input class="namein" type="text" placeholder=${this._t("marker.search_ph")}
                    .value=${this._roomSrcFilter}
                    @input=${t=>{this._roomSrcFilter=t.target.value,this.requestUpdate()}} />
                  <div class="candlist">
                    ${this._roomSrcCandidates().map(t=>W`<div class="cand ${t.value===e?"sel":""}"
                        @click=${()=>{i(t.value),this._roomSrcOpen=null}}>
                        <span class="cl">${t.label}</span><span class="cs">${t.sub}</span>
                      </div>`)}
                  </div>
                </div>`:V}`:V}`}_renderRoomDialog(){const t=!!this._roomEditId,e=[...this._freeAreas];if(t&&this._areaSel&&!e.some(t=>t.area_id===this._areaSel)){const t=this.hass.areas[this._areaSel];t&&e.unshift(t)}return W`<hp-dialog class="roomdialog" .hass=${this.hass} wide
      .title=${t?this._t("room.settings_title"):this._t("room.new")}
      icon=${t?"mdi:cog-outline":"mdi:floor-plan"} @hp-close=${this._roomDialogCancel}>
        <div class="body">
          <label>${this._t("room.name_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("room.name_ph")}
            .value=${this._nameSel}
            @input=${t=>this._nameSel=t.target.value} />
          <label>${this._t("room.area_label")}</label>
          <select class="areasel"
            @change=${t=>{this._areaSel=t.target.value,!this._nameSel&&this._areaSel&&(this._nameSel=this.hass.areas[this._areaSel]?.name||""),this.requestUpdate()}}>
            <option value="">${this._t("room.no_area_option")}</option>
            ${e.map(t=>W`<option value=${t.area_id} ?selected=${t.area_id===this._areaSel}>${t.name}</option>`)}
          </select>

          <label class="dispsection">${this._t("room.settings_section")}</label>
          <label>${this._t("room.fill_label")}</label>
          ${[["","fill.inherit"],...ri.map(t=>[t,"fill."+t])].map(([t,e])=>W`<label class="srcrow inline">
              <input type="radio" name="rfill" .checked=${this._roomFill===t}
                @change=${()=>{this._roomFill=t,this.requestUpdate()}} />
              <span>${this._t(e)}</span>
            </label>`)}
          ${this._renderRoomSource("temp")}
          ${this._renderRoomSource("hum")}

          <label class="dispsection">${this._t("room.sizes_section")}</label>
          <label>${this._t("room.name_scale")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*this._roomNameScale),t=>{this._roomNameScale=t/100,this.requestUpdate()})}
            <span class="opv">${Math.round(100*this._roomNameScale)}%</span>
          </div>
          <label>${this._t("room.label_scale")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*this._roomLabelScale),t=>{this._roomLabelScale=t/100,this.requestUpdate()})}
            <span class="opv">${Math.round(100*this._roomLabelScale)}%</span>
          </div>
          ${this._renderCardPreview($i(this._curSpaceCfg).cardFontScale,this._roomNameScale,this._roomLabelScale)}
        </div>
        <div class="row roomfooter" slot="footer">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this._t("btn.cancel")}</button>
          <span class="spacer"></span>
          ${t?W`<button class="btn on" @click=${()=>this._saveRoomEdit()} ?disabled=${!this._nameSel.trim()}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
              </button>`:W`<button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
                title=${this._t("title.no_area_room")}>
                ${this._t("btn.no_area")}
              </button>
              <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
                title=${this._areaSel?"":this._t("title.choose_area")}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
              </button>`}
        </div>
    </hp-dialog>`}}ja.properties={_hdrH:{state:!0},_booting:{state:!0},_bootFading:{state:!0},_bootSoft:{state:!0},_tapConfirm:{state:!0},hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_hoverRoom:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_mode:{state:!0},_tool:{state:!0},_wallDialog:{state:!0},_drawWallField:{state:!0},_rszSel:{state:!0},_rszLive:{state:!0},_opMeasure:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_mergeSel:{state:!0},_openingDialog:{state:!0},_openingInfo:{state:!0},_mergeDialog:{state:!0},_openWallAnchor:{state:!0},_splitSel:{state:!0},_decorTool:{state:!0},_decorStyle:{state:!0},_decorDraft:{state:!0},_decorSel:{state:!0},_decorEraseConfirm:{state:!0},_decorTextDialog:{state:!0},_decorShapeDialog:{state:!0},_backdropDialog:{state:!0},_furnPalette:{state:!0},_bdDrag:{state:!0},_dtBox:{state:!0},_dtDrag:{state:!0},_kioskDialog:{state:!0},_vacFit:{state:!0},_kioskDots:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_roomEditId:{state:!0},_roomFill:{state:!0},_roomTempSrc:{state:!0},_roomHumSrc:{state:!0},_roomSrcOpen:{state:!0},_roomSrcFilter:{state:!0},_roomNameScale:{state:!0},_roomLabelScale:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_rulesDialog:{state:!0},_settingsDialog:{state:!0},_alignDialog:{state:!0},_importDialog:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},ja.ZOOM_MAX=8,ja.ZOOM_MIN=1/3,ja._touchSeen=!1,ja._noHoverMq="undefined"!=typeof window&&"function"==typeof window.matchMedia&&window.matchMedia("(hover: none)").matches,ja.styles=Qr,customElements.get("houseplan-card")||customElements.define("houseplan-card",ja),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-card"===t.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Interactive house plan: spaces, rooms and devices with live states and drag layout."}),console.info(`%c HOUSEPLAN-CARD %c v${xa} `,"background:#3ea6ff;color:#04121f;font-weight:700","");
