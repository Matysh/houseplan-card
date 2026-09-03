globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="0aa082f67d7e4e87ee87e11227a79f9f754d47a470f79cea2084b6001cf18246";const e=globalThis,t=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),n=new WeakMap;let r=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const i=this.t;if(t&&void 0===e){const t=void 0!==i&&1===i.length;t&&(e=n.get(i)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&n.set(i,e))}return e}toString(){return this.cssText}};const o=(e,...t)=>{const n=1===e.length?e[0]:t.reduce((t,i,n)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[n+1],e[0]);return new r(n,e,i)},s=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const i of e.cssRules)t+=i.cssText;return(e=>new r("string"==typeof e?e:e+"",void 0,i))(t)})(e):e,{is:a,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:h,getOwnPropertySymbols:d,getPrototypeOf:u}=Object,p=globalThis,m=p.trustedTypes,_=m?m.emptyScript:"",f=p.reactiveElementPolyfillSupport,g=(e,t)=>e,v={toAttribute(e,t){switch(t){case Boolean:e=e?_:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let i=e;switch(t){case Boolean:i=null!==e;break;case Number:i=null===e?null:Number(e);break;case Object:case Array:try{i=JSON.parse(e)}catch(e){i=null}}return i}},y=(e,t)=>!a(e,t),b={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:y};Symbol.metadata??=Symbol("metadata"),p.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=b){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const i=Symbol(),n=this.getPropertyDescriptor(e,i,t);void 0!==n&&l(this.prototype,e,n)}}static getPropertyDescriptor(e,t,i){const{get:n,set:r}=c(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:n,set(t){const o=n?.call(this);r?.call(this,t),this.requestUpdate(e,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??b}static _$Ei(){if(this.hasOwnProperty(g("elementProperties")))return;const e=u(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(g("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(g("properties"))){const e=this.properties,t=[...h(e),...d(e)];for(const i of t)this.createProperty(i,e[i])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,i]of t)this.elementProperties.set(e,i)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const i=this._$Eu(e,t);void 0!==i&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const e of i)t.unshift(s(e))}else void 0!==e&&t.push(s(e));return t}static _$Eu(e,t){const i=t.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,n)=>{if(t)i.adoptedStyleSheets=n.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const t of n){const n=document.createElement("style"),r=e.litNonce;void 0!==r&&n.setAttribute("nonce",r),n.textContent=t.cssText,i.appendChild(n)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){const i=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,i);if(void 0!==n&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(t,i.type);this._$Em=e,null==r?this.removeAttribute(n):this.setAttribute(n,r),this._$Em=null}}_$AK(e,t){const i=this.constructor,n=i._$Eh.get(e);if(void 0!==n&&this._$Em!==n){const e=i.getPropertyOptions(n),r="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:v;this._$Em=n;const o=r.fromAttribute(t,e.type);this[n]=o??this._$Ej?.get(n)??o,this._$Em=null}}requestUpdate(e,t,i,n=!1,r){if(void 0!==e){const o=this.constructor;if(!1===n&&(r=this[e]),i??=o.getPropertyOptions(e),!((i.hasChanged??y)(r,t)||i.useDefault&&i.reflect&&r===this._$Ej?.get(e)&&!this.hasAttribute(o._$Eu(e,i))))return;this.C(e,t,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:n,wrapped:r},o){i&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),!0!==r||void 0!==o)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),!0===n&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,i]of e){const{wrapped:e}=i,n=this[t];!0!==e||this._$AL.has(t)||void 0===n||this.C(t,void 0,i,n)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[g("elementProperties")]=new Map,w[g("finalized")]=new Map,f?.({ReactiveElement:w}),(p.reactiveElementVersions??=[]).push("2.1.2");const k=globalThis,x=e=>e,$=k.trustedTypes,S=$?$.createPolicy("lit-html",{createHTML:e=>e}):void 0,M="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+C,R=`<${T}>`,D=document,z=()=>D.createComment(""),A=e=>null===e||"object"!=typeof e&&"function"!=typeof e,P=Array.isArray,O="[ \t\n\f\r]",F=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,I=/-->/g,E=/>/g,H=RegExp(`>|${O}(?:([^\\s"'>=/]+)(${O}*=${O}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),N=/'/g,L=/"/g,B=/^(?:script|style|textarea|title)$/i,q=e=>(t,...i)=>({_$litType$:e,strings:t,values:i}),W=q(1),j=q(2),U=Symbol.for("lit-noChange"),V=Symbol.for("lit-nothing"),G=new WeakMap,K=D.createTreeWalker(D,129);function Y(e,t){if(!P(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(t):t}const X=(e,t)=>{const i=e.length-1,n=[];let r,o=2===t?"<svg>":3===t?"<math>":"",s=F;for(let t=0;t<i;t++){const i=e[t];let a,l,c=-1,h=0;for(;h<i.length&&(s.lastIndex=h,l=s.exec(i),null!==l);)h=s.lastIndex,s===F?"!--"===l[1]?s=I:void 0!==l[1]?s=E:void 0!==l[2]?(B.test(l[2])&&(r=RegExp("</"+l[2],"g")),s=H):void 0!==l[3]&&(s=H):s===H?">"===l[0]?(s=r??F,c=-1):void 0===l[1]?c=-2:(c=s.lastIndex-l[2].length,a=l[1],s=void 0===l[3]?H:'"'===l[3]?L:N):s===L||s===N?s=H:s===I||s===E?s=F:(s=H,r=void 0);const d=s===H&&e[t+1].startsWith("/>")?" ":"";o+=s===F?i+R:c>=0?(n.push(a),i.slice(0,c)+M+i.slice(c)+C+d):i+C+(-2===c?t:d)}return[Y(e,o+(e[i]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),n]};class Z{constructor({strings:e,_$litType$:t},i){let n;this.parts=[];let r=0,o=0;const s=e.length-1,a=this.parts,[l,c]=X(e,t);if(this.el=Z.createElement(l,i),K.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(n=K.nextNode())&&a.length<s;){if(1===n.nodeType){if(n.hasAttributes())for(const e of n.getAttributeNames())if(e.endsWith(M)){const t=c[o++],i=n.getAttribute(e).split(C),s=/([.?@])?(.*)/.exec(t);a.push({type:1,index:r,name:s[2],strings:i,ctor:"."===s[1]?ie:"?"===s[1]?ne:"@"===s[1]?re:te}),n.removeAttribute(e)}else e.startsWith(C)&&(a.push({type:6,index:r}),n.removeAttribute(e));if(B.test(n.tagName)){const e=n.textContent.split(C),t=e.length-1;if(t>0){n.textContent=$?$.emptyScript:"";for(let i=0;i<t;i++)n.append(e[i],z()),K.nextNode(),a.push({type:2,index:++r});n.append(e[t],z())}}}else if(8===n.nodeType)if(n.data===T)a.push({type:2,index:r});else{let e=-1;for(;-1!==(e=n.data.indexOf(C,e+1));)a.push({type:7,index:r}),e+=C.length-1}r++}}static createElement(e,t){const i=D.createElement("template");return i.innerHTML=e,i}}function J(e,t,i=e,n){if(t===U)return t;let r=void 0!==n?i._$Co?.[n]:i._$Cl;const o=A(t)?void 0:t._$litDirective$;return r?.constructor!==o&&(r?._$AO?.(!1),void 0===o?r=void 0:(r=new o(e),r._$AT(e,i,n)),void 0!==n?(i._$Co??=[])[n]=r:i._$Cl=r),void 0!==r&&(t=J(e,r._$AS(e,t.values),r,n)),t}class Q{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:i}=this._$AD,n=(e?.creationScope??D).importNode(t,!0);K.currentNode=n;let r=K.nextNode(),o=0,s=0,a=i[0];for(;void 0!==a;){if(o===a.index){let t;2===a.type?t=new ee(r,r.nextSibling,this,e):1===a.type?t=new a.ctor(r,a.name,a.strings,this,e):6===a.type&&(t=new oe(r,this,e)),this._$AV.push(t),a=i[++s]}o!==a?.index&&(r=K.nextNode(),o++)}return K.currentNode=D,n}p(e){let t=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}}class ee{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,n){this.type=2,this._$AH=V,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=J(this,e,t),A(e)?e===V||null==e||""===e?(this._$AH!==V&&this._$AR(),this._$AH=V):e!==this._$AH&&e!==U&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>P(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==V&&A(this._$AH)?this._$AA.nextSibling.data=e:this.T(D.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:i}=e,n="number"==typeof i?this._$AC(e):(void 0===i.el&&(i.el=Z.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===n)this._$AH.p(t);else{const e=new Q(n,this),i=e.u(this.options);e.p(t),this.T(i),this._$AH=e}}_$AC(e){let t=G.get(e.strings);return void 0===t&&G.set(e.strings,t=new Z(e)),t}k(e){P(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let i,n=0;for(const r of e)n===t.length?t.push(i=new ee(this.O(z()),this.O(z()),this,this.options)):i=t[n],i._$AI(r),n++;n<t.length&&(this._$AR(i&&i._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=x(e).nextSibling;x(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class te{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,n,r){this.type=1,this._$AH=V,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=V}_$AI(e,t=this,i,n){const r=this.strings;let o=!1;if(void 0===r)e=J(this,e,t,0),o=!A(e)||e!==this._$AH&&e!==U,o&&(this._$AH=e);else{const n=e;let s,a;for(e=r[0],s=0;s<r.length-1;s++)a=J(this,n[i+s],t,s),a===U&&(a=this._$AH[s]),o||=!A(a)||a!==this._$AH[s],a===V?e=V:e!==V&&(e+=(a??"")+r[s+1]),this._$AH[s]=a}o&&!n&&this.j(e)}j(e){e===V?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class ie extends te{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===V?void 0:e}}class ne extends te{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==V)}}class re extends te{constructor(e,t,i,n,r){super(e,t,i,n,r),this.type=5}_$AI(e,t=this){if((e=J(this,e,t,0)??V)===U)return;const i=this._$AH,n=e===V&&i!==V||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,r=e!==V&&(i===V||n);n&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class oe{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){J(this,e)}}const se={I:ee},ae=k.litHtmlPolyfillSupport;ae?.(Z,ee),(k.litHtmlVersions??=[]).push("3.3.3");const le=(e,t,i)=>{const n=i?.renderBefore??t;let r=n._$litPart$;if(void 0===r){const e=i?.renderBefore??null;n._$litPart$=r=new ee(t.insertBefore(z(),e),e,void 0,i??{})}return r._$AI(e),r},ce=globalThis;let he=class extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=le(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return U}};he._$litElement$=!0,he.finalized=!0,ce.litElementHydrateSupport?.({LitElement:he});const de=ce.litElementPolyfillSupport;de?.({LitElement:he}),(ce.litElementVersions??=[]).push("4.2.2");const ue=new WeakMap;let pe=0;class me extends he{constructor(){super(...arguments),this.title="",this.icon="",this.wide=!1,this.alert=!1,this.describedBy="",this.dismissOnScrim=!1,this.hass=null,this._opener=null,this._focusRoot=null,this._useHaDialog=!1,this._closing=!1,this._overlays=[],this._titleId="hp-dialog-title-"+ ++pe,this._focusInitial=()=>{const e=this._focusableElements(),t=e.find(e=>e.hasAttribute("autofocus"))||e[0]||(this._usesHaDialog()?null:this.renderRoot.querySelector(".close"))||this.renderRoot.querySelector(".surface")||this.renderRoot.querySelector("ha-dialog");t?.focus({preventScroll:!0})},this._requestClose=()=>{this._closing||(this._closing=!0,this.dispatchEvent(new CustomEvent("hp-close",{bubbles:!0,composed:!0})))},this._onKeyDown=e=>{if("Escape"===e.key){e.preventDefault(),e.stopImmediatePropagation(),this._pruneOverlays();const t=this._overlays[this._overlays.length-1];return t?void this._closeOverlay(t,"escape"):void this._requestClose()}if("Tab"!==e.key||this._usesHaDialog())return;const t=this.renderRoot.querySelector(".close"),i=t?[t,...this._focusableElements()]:this._focusableElements();if(!i.length)return e.preventDefault(),void this.renderRoot.querySelector(".surface")?.focus({preventScroll:!0});const n=this._deepActiveElement(),r=i[0],o=i[i.length-1];!e.shiftKey||n!==r&&i.includes(n)?e.shiftKey||n!==o||(e.preventDefault(),r.focus()):(e.preventDefault(),o.focus())},this._onFallbackCancel=e=>{e.preventDefault(),this._requestClose()},this._onFallbackClick=e=>{this.dismissOnScrim&&e.target===e.currentTarget&&this._requestClose()}}_usesHaDialog(){return this._useHaDialog&&!this.alert}connectedCallback(){super.connectedCallback(),this._opener=this._deepActiveElement();const e=this.getRootNode();this._focusRoot=e;const t=ue.get(e)||{dialogs:new Set,opener:this._opener};t.dialogs.add(this),ue.set(e,t),this._useHaDialog=!!customElements.get("ha-dialog"),this.addEventListener("keydown",this._onKeyDown,!0)}disconnectedCallback(){this.removeEventListener("keydown",this._onKeyDown,!0);const e=[...this._overlays];this._overlays=[];for(const t of e.reverse())t.close("disconnect");const t=this._focusRoot,i=this._opener;this._opener=null,this._focusRoot=null;const n=t?ue.get(t):void 0;n?.dialogs.delete(this),super.disconnectedCallback(),t&&n&&requestAnimationFrame(()=>{const e=ue.get(t);if(!e)return;if(!e.dialogs.size)return e.opener?.isConnected&&e.opener.focus({preventScroll:!0}),void ue.delete(t);const n=i?.closest("hp-dialog");i?.isConnected&&n&&e.dialogs.has(n)&&i.focus({preventScroll:!0})})}firstUpdated(e){if(super.firstUpdated(e),!this._usesHaDialog()){const e=this.renderRoot.querySelector("dialog");e&&!e.open&&e.showModal()}queueMicrotask(()=>this._focusInitial())}_deepActiveElement(){let e=document.activeElement;for(;e?.shadowRoot?.activeElement;)e=e.shadowRoot.activeElement;return e&&e!==document.body?e:null}_focusableElements(){const e=["[autofocus]","a[href]","button:not([disabled])",'input:not([disabled]):not([type="hidden"])',"select:not([disabled])","textarea:not([disabled])",'[contenteditable="true"]','[tabindex]:not([tabindex="-1"])'].join(","),t=[],i=new Set,n=r=>{if(!i.has(r)){if(i.add(r),r instanceof HTMLElement){if(r.matches(e)&&t.push(r),r instanceof HTMLSlotElement){for(const e of r.assignedNodes({flatten:!0}))n(e);return}if(r.shadowRoot){for(const e of r.shadowRoot.childNodes)n(e);return}}for(const e of r.childNodes)n(e)}};for(const e of this.childNodes)n(e);const r=this.overlayPortal();return r&&n(r),t.filter(e=>{let t=e;for(;t;){const e=getComputedStyle(t);if(t.hidden||t.inert||"true"===t.getAttribute("aria-hidden")||"none"===e.display||"hidden"===e.visibility)return!1;if(t=t.assignedSlot||t.parentElement||(t.getRootNode()instanceof ShadowRoot?t.getRootNode().host:null),t===this)break}return!0})}rejectClose(){this._closing=!1,this.requestUpdate()}_pruneOverlays(){this._overlays=this._overlays.filter(e=>e.owner.isConnected)}_closeOverlay(e,t){const i=this._overlays.findIndex(t=>t.token===e.token);i>=0&&this._overlays.splice(i,1),e.close(t)}registerOverlay(e){this._pruneOverlays();const t=this._overlays.find(t=>t.owner===e.owner);t&&this._overlays.splice(this._overlays.indexOf(t),1);const i=e.group||"transient";for(const e of[...this._overlays].reverse())e.group===i&&this._closeOverlay(e,"exclusive");const n={...e,group:i,token:Symbol("hp-overlay")};this._overlays.push(n);let r=!1;return()=>{if(r)return;r=!0;const e=this._overlays.findIndex(e=>e.token===n.token);e>=0&&this._overlays.splice(e,1)}}closeTransientOverlays(e="outside"){this._pruneOverlays();const t=[...this._overlays].filter(e=>"transient"===(e.group||"transient"));for(const i of t.reverse())this._closeOverlay(i,e);return t.length>0}overlayPortal(){return this.renderRoot.querySelector(".overlay-portal")}render(){const e=W`<span class="title" id=${this._titleId}>
      ${this.icon?W`<ha-icon icon=${this.icon}></ha-icon>`:V}
      <span class="title-text">${this.title}</span>
    </span>`;return this._usesHaDialog()?this.describedBy?W`<ha-dialog
          .hass=${this.hass}
          .open=${!0}
          width=${this.wide?"medium":"small"}
          .preventScrimClose=${!this.dismissOnScrim}
          .ariaLabelledBy=${this._titleId}
          .ariaDescribedBy=${this.describedBy}
          @opened=${this._focusInitial}
          @closed=${this._requestClose}
        >
          <span class="header-title-slot" slot="headerTitle">${e}</span>
          <slot></slot>
          <span class="footer" slot="footer"><slot name="footer"></slot></span>
        </ha-dialog><div class="overlay-portal"></div>`:W`<ha-dialog
        .hass=${this.hass}
        .open=${!0}
        width=${this.wide?"medium":"small"}
        .preventScrimClose=${!this.dismissOnScrim}
        .ariaLabelledBy=${this._titleId}
        @opened=${this._focusInitial}
        @closed=${this._requestClose}
      >
        <span class="header-title-slot" slot="headerTitle">${e}</span>
        <slot></slot>
        <span class="footer" slot="footer"><slot name="footer"></slot></span>
      </ha-dialog><div class="overlay-portal"></div>`:W`<dialog
      role=${this.alert?"alertdialog":"dialog"}
      aria-modal="true"
      aria-labelledby=${this._titleId}
      aria-describedby=${this.describedBy||V}
      @cancel=${this._onFallbackCancel}
      @click=${this._onFallbackClick}
    >
      <section class="surface" tabindex="-1">
        <header class="header">
          ${e}
          <button class="close" type="button"
            aria-label=${this.hass?.localize?.("ui.common.close")||"Close"}
            @click=${this._requestClose}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="content"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </section>
      <div class="overlay-portal"></div>
    </dialog>`}}me.properties={title:{type:String},icon:{type:String},wide:{type:Boolean,reflect:!0},alert:{type:Boolean,reflect:!0},describedBy:{type:String,attribute:"described-by"},dismissOnScrim:{type:Boolean,attribute:"dismiss-on-scrim"},hass:{attribute:!1}},me.styles=o`
    :host {
      display: contents;
      color: var(--primary-text-color, #e6e7eb);
      font: inherit;
    }

    ha-dialog {
      --dialog-content-padding: 0;
      --dialog-surface-background: var(--card-background-color, var(--hp-bg, #202126));
      --ha-dialog-border-radius: var(--rad-l, 18px);
      /* HA's ha-dialog-header defaults this custom property to a one-line
         fixed height.  Our localized slot is intentionally allowed to wrap,
         so leaving that default in place clips every line after the first at
         the bottom of the header.  auto is HA's public sizing hook and also
         stays harmless on older ha-dialog implementations that do not consume
         it. */
      --ha-dialog-header-title-height: auto;
      color: inherit;
    }

    ha-dialog::part(dialog) {
      border: 1px solid var(--hp-accent, #d89300);
      box-shadow: var(--shadow-3, 0 18px 48px rgb(0 0 0 / 0.34));
      overflow: hidden;
    }

    /* The HA header slot is a flex item with a constrained inline size.  The
       old inline-flex title kept its min-content width, so HA clipped the last
       word instead of giving it a second line.  Keep every wrapper shrinkable
       and let the text wrap; this applies to every hp-dialog, including long
       device names and translated titles. */
    .header-title-slot {
      display: block;
      flex: 1 1 auto;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      white-space: normal;
    }

    .title {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--sp-4, 12px);
      width: 100%;
      max-width: 100%;
      min-width: 0;
      font-weight: 600;
      line-height: 1.25;
      white-space: normal;
    }

    .title ha-icon {
      flex: none;
      color: var(--hp-accent, #d89300);
    }

    .title-text {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: normal;
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
      width: min(var(--hp-dialog-wide-width, 500px), 94vw);
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

    :host([data-pointer-hover]) .close:hover,
    .close:focus-visible {
      background: rgb(127 127 127 / 0.16);
    }

    .content {
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .overlay-portal {
      position: fixed;
      z-index: 2147483647;
      inset: 0;
      overflow: visible;
      pointer-events: none;
    }

    .overlay-portal:empty {
      display: none;
    }

    .overlay-portal > * {
      pointer-events: auto;
    }
  `,customElements.get("hp-dialog")||customElements.define("hp-dialog",me);class _e extends he{constructor(){super(...arguments),this.hass=null,this.request=null,this.token=0}createRenderRoot(){return this}_decide(e){this.dispatchEvent(new CustomEvent("hp-confirm-decision",{detail:{token:this.token,accepted:e},bubbles:!0,composed:!0}))}render(){const e=this.request;if(!e)return null;const t="destructive"===e.kind,i=`hp-confirm-description-${this.token}`;return W`<hp-dialog class="danger-confirm-dialog"
      .hass=${this.hass}
      .title=${e.title}
      .alert=${!0}
      .describedBy=${i}
      .icon=${e.icon||(t?"mdi:alert-outline":"mdi:lock-open-alert-outline")}
      dismiss-on-scrim
      @hp-close=${()=>this._decide(!1)}>
        <div id=${i} class="body danger-confirm-body" data-confirm-key=${e.key}>
          ${e.objectName?W`<strong class="danger-confirm-object">${e.objectName}</strong>`:null}
          <p>${e.message}</p>
        </div>
        <div class="row dialog-action-footer danger-confirm-footer" slot="footer">
          <span class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" type="button" autofocus
              @click=${()=>this._decide(!1)}>${e.cancelLabel}</button>
            <button class="btn ${t?"danger":"on"}" type="button"
              @click=${()=>this._decide(!0)}>
              <ha-icon icon=${t?"mdi:trash-can-outline":"mdi:lock-open-variant"}></ha-icon>
              ${e.confirmLabel}
            </button>
          </span>
        </div>
    </hp-dialog>`}}_e.properties={hass:{attribute:!1},request:{attribute:!1},token:{type:Number}},customElements.get("hp-confirm")||customElements.define("hp-confirm",_e);class fe{constructor(e){this._changed=e,this._sequence=0,this._active=null}get state(){return this._active?{token:this._active.token,request:this._active.request}:null}confirm(e){this.cancel();const t={token:++this._sequence,request:Object.freeze({...e})};return new Promise(e=>{this._active={...t,resolve:e},this._changed(t)})}resolve(e,t){const i=this._active;return!(!i||i.token!==e)&&(this._active=null,this._changed(null),i.resolve(t),!0)}cancel(){const e=this._active;return!!e&&this.resolve(e.token,!1)}}const ge=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),ve=[{pattern:"протечк|leak|water sensor",icon:"mdi:water-alert"},{pattern:"клапан|valve",icon:"mdi:pipe-valve"},{pattern:"дым|smoke",icon:"mdi:smoke-detector"},{pattern:"термоголов|trv|radiator",icon:"mdi:radiator"},{pattern:"чайник|kettle|термопот",icon:"mdi:kettle"},{pattern:"сауна|sauna|harvia|парная|парилк",icon:"mdi:hot-tub"},{pattern:"температ|temperature|thermometer|climate sensor",icon:"mdi:thermometer"},{pattern:"qingping|air monitor|молекул|air quality",icon:"mdi:air-filter"},{pattern:"штор|curtain|blind|shade",icon:"mdi:roller-shade"},{pattern:"розетк|plug|socket|outlet",icon:"mdi:power-socket-de"},{pattern:"выключат|switch",icon:"mdi:light-switch"},{pattern:"лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip",icon:"mdi:lightbulb"},{pattern:"камер|camera",icon:"mdi:cctv"},{pattern:"замок|ttlock|lock|sn609|sn9161",icon:"mdi:lock"},{pattern:"ворота|garage|gate",icon:"mdi:garage-variant"},{pattern:"калитк|door|открыт|contact",icon:"mdi:door"},{pattern:"счётчик|счетчик|kws|meter",icon:"mdi:meter-electric"},{pattern:"вводный автомат|breaker|wifimcbn",icon:"mdi:electric-switch"},{pattern:"myheat|котёл|котел|boiler|отоплен|heating",icon:"mdi:water-boiler"},{pattern:"холодильник|fridge",icon:"mdi:fridge"},{pattern:"стиральн|washer|washing",icon:"mdi:washing-machine"},{pattern:"сушилк|dryer",icon:"mdi:tumble-dryer"},{pattern:"пылесос|vacuum|dreame|roborock",icon:"mdi:robot-vacuum"},{pattern:"soundbar",icon:"mdi:soundbar"},{pattern:"колонк|станц|speaker|яндекс|yandex|алиса|alice",icon:"mdi:speaker"},{pattern:"tv|телевизор|hyundaitv|mitv|television",icon:"mdi:television"},{pattern:"keenetic|роутер|router|mesh|access point",icon:"mdi:router-wireless"},{pattern:"ибп|ups|kirpich",icon:"mdi:battery-charging-high"},{pattern:"slzb|координат|zigbee|coordinator",icon:"mdi:zigbee"},{pattern:"motion|движен|presence|присутств",icon:"mdi:motion-sensor"},{pattern:"humidity|влажн",icon:"mdi:water-percent"}];function ye(e){const t=[];for(const i of e)if(i&&"string"==typeof i.pattern&&i.icon)try{t.push({re:new RegExp(i.pattern,"i"),icon:i.icon})}catch{}return t}function be(e){try{return new RegExp(e,"i"),!0}catch{return!1}}const we=ye(ve),ke={temperature:"mdi:thermometer",humidity:"mdi:water-percent",motion:"mdi:motion-sensor",occupancy:"mdi:motion-sensor",presence:"mdi:motion-sensor",door:"mdi:door",window:"mdi:window-closed",garage_door:"mdi:garage-variant",smoke:"mdi:smoke-detector",moisture:"mdi:water-alert",gas:"mdi:gas-cylinder",power:"mdi:meter-electric",energy:"mdi:meter-electric",illuminance:"mdi:brightness-5",co2:"mdi:molecule-co2",pm25:"mdi:air-filter",battery:"mdi:battery"},xe="mdi:chip";function $e(e,t,i){const n=((e||"")+" "+(t||"")).toLowerCase();for(const{re:e,icon:t}of i??we)if(e.test(n))return t;return xe}const Se=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];var Me=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,Ce=Math.ceil,Te=Math.floor,Re="[BigNumber Error] ",De=Re+"Number primitive has more than 15 significant digits: ",ze=1e14,Ae=14,Pe=9007199254740991,Oe=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],Fe=1e7,Ie=1e9;function Ee(e){var t=0|e;return e>0||e===t?t:t-1}function He(e){for(var t,i,n=1,r=e.length,o=e[0]+"";n<r;){for(t=e[n++]+"",i=Ae-t.length;i--;t="0"+t);o+=t}for(r=o.length;48===o.charCodeAt(--r););return o.slice(0,r+1||1)}function Ne(e,t){var i,n,r=e.c,o=t.c,s=e.s,a=t.s,l=e.e,c=t.e;if(!s||!a)return null;if(i=r&&!r[0],n=o&&!o[0],i||n)return i?n?0:-a:s;if(s!=a)return s;if(i=s<0,n=l==c,!r||!o)return n?0:!r^i?1:-1;if(!n)return l>c^i?1:-1;for(a=(l=r.length)<(c=o.length)?l:c,s=0;s<a;s++)if(r[s]!=o[s])return r[s]>o[s]^i?1:-1;return l==c?0:l>c^i?1:-1}function Le(e,t,i,n){if(e<t||e>i||e!==Te(e))throw Error(Re+(n||"Argument")+("number"==typeof e?e<t||e>i?" out of range: ":" not an integer: ":" not a primitive number: ")+String(e))}function Be(e){var t=e.c.length-1;return Ee(e.e/Ae)==t&&e.c[t]%2!=0}function qe(e,t){return(e.length>1?e.charAt(0)+"."+e.slice(1):e)+(t<0?"e":"e+")+t}function We(e,t,i){var n,r;if(t<0){for(r=i+".";++t;r+=i);e=r+e}else if(++t>(n=e.length)){for(r=i,t-=n;--t;r+=i);e+=r}else t<n&&(e=e.slice(0,t)+"."+e.slice(t));return e}var je=function e(t){var i,n,r,o,s,a,l,c,h,d,u=M.prototype={constructor:M,toString:null,valueOf:null},p=new M(1),m=20,_=4,f=-7,g=21,v=-1e7,y=1e7,b=!1,w=1,k=0,x={prefix:"",groupSize:3,secondaryGroupSize:0,groupSeparator:",",decimalSeparator:".",fractionGroupSize:0,fractionGroupSeparator:" ",suffix:""},$="0123456789abcdefghijklmnopqrstuvwxyz",S=!0;function M(e,t){var i,o,s,a,l,c,h,d,u=this;if(!(u instanceof M))return new M(e,t);if(null==t){if(e&&!0===e._isBigNumber)return u.s=e.s,void(!e.c||e.e>y?u.c=u.e=null:e.e<v?u.c=[u.e=0]:(u.e=e.e,u.c=e.c.slice()));if((c="number"==typeof e)&&0*e==0){if(u.s=1/e<0?(e=-e,-1):1,e===~~e){for(a=0,l=e;l>=10;l/=10,a++);return void(a>y?u.c=u.e=null:(u.e=a,u.c=[e]))}d=String(e)}else{if(!Me.test(d=String(e)))return r(u,d,c);u.s=45==d.charCodeAt(0)?(d=d.slice(1),-1):1}(a=d.indexOf("."))>-1&&(d=d.replace(".","")),(l=d.search(/e/i))>0?(a<0&&(a=l),a+=+d.slice(l+1),d=d.substring(0,l)):a<0&&(a=d.length)}else{if(Le(t,2,$.length,"Base"),10==t&&S)return D(u=new M(e),m+u.e+1,_);if(d=String(e),c="number"==typeof e){if(0*e!=0)return r(u,d,c,t);if(u.s=1/e<0?(d=d.slice(1),-1):1,M.DEBUG&&d.replace(/^0\.0*|\./,"").length>15)throw Error(De+e)}else u.s=45===d.charCodeAt(0)?(d=d.slice(1),-1):1;for(i=$.slice(0,t),a=l=0,h=d.length;l<h;l++)if(i.indexOf(o=d.charAt(l))<0){if("."==o){if(l>a){a=h;continue}}else if(!s&&(d==d.toUpperCase()&&(d=d.toLowerCase())||d==d.toLowerCase()&&(d=d.toUpperCase()))){s=!0,l=-1,a=0;continue}return r(u,String(e),c,t)}c=!1,(a=(d=n(d,t,10,u.s)).indexOf("."))>-1?d=d.replace(".",""):a=d.length}for(l=0;48===d.charCodeAt(l);l++);for(h=d.length;48===d.charCodeAt(--h););if(d=d.slice(l,++h)){if(h-=l,c&&M.DEBUG&&h>15&&(e>Pe||e!==Te(e)))throw Error(De+u.s*e);if((a=a-l-1)>y)u.c=u.e=null;else if(a<v)u.c=[u.e=0];else{if(u.e=a,u.c=[],l=(a+1)%Ae,a<0&&(l+=Ae),l<h){for(l&&u.c.push(+d.slice(0,l)),h-=Ae;l<h;)u.c.push(+d.slice(l,l+=Ae));l=Ae-(d=d.slice(l)).length}else l-=h;for(;l--;d+="0");u.c.push(+d)}}else u.c=[u.e=0]}function C(e,t,i,n){var r,o,s,a,l;if(null==i?i=_:Le(i,0,8),!e.c)return e.toString();if(r=e.c[0],s=e.e,null==t)l=He(e.c),l=1==n||2==n&&(s<=f||s>=g)?qe(l,s):We(l,s,"0");else if(o=(e=D(new M(e),t,i)).e,a=(l=He(e.c)).length,1==n||2==n&&(t<=o||o<=f)){for(;a<t;l+="0",a++);l=qe(l,o)}else if(t-=s+(2===n&&o>s),l=We(l,o,"0"),o+1>a){if(--t>0)for(l+=".";t--;l+="0");}else if((t+=o-a)>0)for(o+1==a&&(l+=".");t--;l+="0");return e.s<0&&r?"-"+l:l}function T(e,t){for(var i,n,r=1,o=new M(e[0]);r<e.length;r++)(!(n=new M(e[r])).s||(i=Ne(o,n))===t||0===i&&o.s===t)&&(o=n);return o}function R(e,t,i){for(var n=1,r=t.length;!t[--r];t.pop());for(r=t[0];r>=10;r/=10,n++);return(i=n+i*Ae-1)>y?e.c=e.e=null:i<v?e.c=[e.e=0]:(e.e=i,e.c=t),e}function D(e,t,i,n){var r,o,s,a,l,c,h,d=e.c,u=Oe;if(d){e:{for(r=1,a=d[0];a>=10;a/=10,r++);if((o=t-r)<0)o+=Ae,s=t,l=d[c=0],h=Te(l/u[r-s-1]%10);else if((c=Ce((o+1)/Ae))>=d.length){if(!n)break e;for(;d.length<=c;d.push(0));l=h=0,r=1,s=(o%=Ae)-Ae+1}else{for(l=a=d[c],r=1;a>=10;a/=10,r++);h=(s=(o%=Ae)-Ae+r)<0?0:Te(l/u[r-s-1]%10)}if(n=n||t<0||null!=d[c+1]||(s<0?l:l%u[r-s-1]),n=i<4?(h||n)&&(0==i||i==(e.s<0?3:2)):h>5||5==h&&(4==i||n||6==i&&(o>0?s>0?l/u[r-s]:0:d[c-1])%10&1||i==(e.s<0?8:7)),t<1||!d[0])return d.length=0,n?(t-=e.e+1,d[0]=u[(Ae-t%Ae)%Ae],e.e=-t||0):d[0]=e.e=0,e;if(0==o?(d.length=c,a=1,c--):(d.length=c+1,a=u[Ae-o],d[c]=s>0?Te(l/u[r-s]%u[s])*a:0),n)for(;;){if(0==c){for(o=1,s=d[0];s>=10;s/=10,o++);for(s=d[0]+=a,a=1;s>=10;s/=10,a++);o!=a&&(e.e++,d[0]==ze&&(d[0]=1));break}if(d[c]+=a,d[c]!=ze)break;d[c--]=0,a=1}for(o=d.length;0===d[--o];d.pop());}e.e>y?e.c=e.e=null:e.e<v&&(e.c=[e.e=0])}return e}function z(e){var t,i=e.e;return null===i?e.toString():(t=He(e.c),t=i<=f||i>=g?qe(t,i):We(t,i,"0"),e.s<0?"-"+t:t)}return M.clone=e,M.ROUND_UP=0,M.ROUND_DOWN=1,M.ROUND_CEIL=2,M.ROUND_FLOOR=3,M.ROUND_HALF_UP=4,M.ROUND_HALF_DOWN=5,M.ROUND_HALF_EVEN=6,M.ROUND_HALF_CEIL=7,M.ROUND_HALF_FLOOR=8,M.EUCLID=9,M.config=M.set=function(e){var t,i;if(null!=e){if("object"!=typeof e)throw Error(Re+"Object expected: "+e);if(e.hasOwnProperty(t="DECIMAL_PLACES")&&(Le(i=e[t],0,Ie,t),m=i),e.hasOwnProperty(t="ROUNDING_MODE")&&(Le(i=e[t],0,8,t),_=i),e.hasOwnProperty(t="EXPONENTIAL_AT")&&((i=e[t])&&i.pop?(Le(i[0],-Ie,0,t),Le(i[1],0,Ie,t),f=i[0],g=i[1]):(Le(i,-Ie,Ie,t),f=-(g=i<0?-i:i))),e.hasOwnProperty(t="RANGE"))if((i=e[t])&&i.pop)Le(i[0],-Ie,-1,t),Le(i[1],1,Ie,t),v=i[0],y=i[1];else{if(Le(i,-Ie,Ie,t),!i)throw Error(Re+t+" cannot be zero: "+i);v=-(y=i<0?-i:i)}if(e.hasOwnProperty(t="CRYPTO")){if((i=e[t])!==!!i)throw Error(Re+t+" not true or false: "+i);if(i){if("undefined"==typeof crypto||!crypto||!crypto.getRandomValues&&!crypto.randomBytes)throw b=!i,Error(Re+"crypto unavailable");b=i}else b=i}if(e.hasOwnProperty(t="MODULO_MODE")&&(Le(i=e[t],0,9,t),w=i),e.hasOwnProperty(t="POW_PRECISION")&&(Le(i=e[t],0,Ie,t),k=i),e.hasOwnProperty(t="FORMAT")){if("object"!=typeof(i=e[t]))throw Error(Re+t+" not an object: "+i);x=i}if(e.hasOwnProperty(t="ALPHABET")){if("string"!=typeof(i=e[t])||/^.?$|[+\-.\s]|(.).*\1/.test(i))throw Error(Re+t+" invalid: "+i);S="0123456789"==i.slice(0,10),$=i}}return{DECIMAL_PLACES:m,ROUNDING_MODE:_,EXPONENTIAL_AT:[f,g],RANGE:[v,y],CRYPTO:b,MODULO_MODE:w,POW_PRECISION:k,FORMAT:x,ALPHABET:$}},M.isBigNumber=function(e){if(!e||!0!==e._isBigNumber)return!1;if(!M.DEBUG)return!0;var t,i,n=e.c,r=e.e,o=e.s;e:if("[object Array]"=={}.toString.call(n)){if((1===o||-1===o)&&r>=-Ie&&r<=Ie&&r===Te(r)){if(0===n[0]){if(0===r&&1===n.length)return!0;break e}if((t=(r+1)%Ae)<1&&(t+=Ae),String(n[0]).length==t){for(t=0;t<n.length;t++)if((i=n[t])<0||i>=ze||i!==Te(i))break e;if(0!==i)return!0}}}else if(null===n&&null===r&&(null===o||1===o||-1===o))return!0;throw Error(Re+"Invalid BigNumber: "+e)},M.maximum=M.max=function(){return T(arguments,-1)},M.minimum=M.min=function(){return T(arguments,1)},M.random=(o=9007199254740992,s=Math.random()*o&2097151?function(){return Te(Math.random()*o)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(e){var t,i,n,r,o,a=0,l=[],c=new M(p);if(null==e?e=m:Le(e,0,Ie),r=Ce(e/Ae),b)if(crypto.getRandomValues){for(t=crypto.getRandomValues(new Uint32Array(r*=2));a<r;)(o=131072*t[a]+(t[a+1]>>>11))>=9e15?(i=crypto.getRandomValues(new Uint32Array(2)),t[a]=i[0],t[a+1]=i[1]):(l.push(o%1e14),a+=2);a=r/2}else{if(!crypto.randomBytes)throw b=!1,Error(Re+"crypto unavailable");for(t=crypto.randomBytes(r*=7);a<r;)(o=281474976710656*(31&t[a])+1099511627776*t[a+1]+4294967296*t[a+2]+16777216*t[a+3]+(t[a+4]<<16)+(t[a+5]<<8)+t[a+6])>=9e15?crypto.randomBytes(7).copy(t,a):(l.push(o%1e14),a+=7);a=r/7}if(!b)for(;a<r;)(o=s())<9e15&&(l[a++]=o%1e14);for(r=l[--a],e%=Ae,r&&e&&(o=Oe[Ae-e],l[a]=Te(r/o)*o);0===l[a];l.pop(),a--);if(a<0)l=[n=0];else{for(n=-1;0===l[0];l.splice(0,1),n-=Ae);for(a=1,o=l[0];o>=10;o/=10,a++);a<Ae&&(n-=Ae-a)}return c.e=n,c.c=l,c}),M.sum=function(){for(var e=1,t=arguments,i=new M(t[0]);e<t.length;)i=i.plus(t[e++]);return i},n=function(){var e="0123456789";function t(e,t,i,n){for(var r,o,s=[0],a=0,l=e.length;a<l;){for(o=s.length;o--;s[o]*=t);for(s[0]+=n.indexOf(e.charAt(a++)),r=0;r<s.length;r++)s[r]>i-1&&(null==s[r+1]&&(s[r+1]=0),s[r+1]+=s[r]/i|0,s[r]%=i)}return s.reverse()}return function(n,r,o,s,a){var l,c,h,d,u,p,f,g,v=n.indexOf("."),y=m,b=_;for(v>=0&&(d=k,k=0,n=n.replace(".",""),p=(g=new M(r)).pow(n.length-v),k=d,g.c=t(We(He(p.c),p.e,"0"),10,o,e),g.e=g.c.length),h=d=(f=t(n,r,o,a?(l=$,e):(l=e,$))).length;0==f[--d];f.pop());if(!f[0])return l.charAt(0);if(v<0?--h:(p.c=f,p.e=h,p.s=s,f=(p=i(p,g,y,b,o)).c,u=p.r,h=p.e),v=f[c=h+y+1],d=o/2,u=u||c<0||null!=f[c+1],u=b<4?(null!=v||u)&&(0==b||b==(p.s<0?3:2)):v>d||v==d&&(4==b||u||6==b&&1&f[c-1]||b==(p.s<0?8:7)),c<1||!f[0])n=u?We(l.charAt(1),-y,l.charAt(0)):l.charAt(0);else{if(f.length=c,u)for(--o;++f[--c]>o;)f[c]=0,c||(++h,f=[1].concat(f));for(d=f.length;!f[--d];);for(v=0,n="";v<=d;n+=l.charAt(f[v++]));n=We(n,h,l.charAt(0))}return n}}(),i=function(){function e(e,t,i){var n,r,o,s,a=0,l=e.length,c=t%Fe,h=t/Fe|0;for(e=e.slice();l--;)a=((r=c*(o=e[l]%Fe)+(n=h*o+(s=e[l]/Fe|0)*c)%Fe*Fe+a)/i|0)+(n/Fe|0)+h*s,e[l]=r%i;return a&&(e=[a].concat(e)),e}function t(e,t,i,n){var r,o;if(i!=n)o=i>n?1:-1;else for(r=o=0;r<i;r++)if(e[r]!=t[r]){o=e[r]>t[r]?1:-1;break}return o}function i(e,t,i,n){for(var r=0;i--;)e[i]-=r,r=e[i]<t[i]?1:0,e[i]=r*n+e[i]-t[i];for(;!e[0]&&e.length>1;e.splice(0,1));}return function(n,r,o,s,a){var l,c,h,d,u,p,m,_,f,g,v,y,b,w,k,x,$,S=n.s==r.s?1:-1,C=n.c,T=r.c;if(!(C&&C[0]&&T&&T[0]))return new M(n.s&&r.s&&(C?!T||C[0]!=T[0]:T)?C&&0==C[0]||!T?0*S:S/0:NaN);for(f=(_=new M(S)).c=[],S=o+(c=n.e-r.e)+1,a||(a=ze,c=Ee(n.e/Ae)-Ee(r.e/Ae),S=S/Ae|0),h=0;T[h]==(C[h]||0);h++);if(T[h]>(C[h]||0)&&c--,S<0)f.push(1),d=!0;else{for(w=C.length,x=T.length,h=0,S+=2,(u=Te(a/(T[0]+1)))>1&&(T=e(T,u,a),C=e(C,u,a),x=T.length,w=C.length),b=x,v=(g=C.slice(0,x)).length;v<x;g[v++]=0);$=T.slice(),$=[0].concat($),k=T[0],T[1]>=a/2&&k++;do{if(u=0,(l=t(T,g,x,v))<0){if(y=g[0],x!=v&&(y=y*a+(g[1]||0)),(u=Te(y/k))>1)for(u>=a&&(u=a-1),m=(p=e(T,u,a)).length,v=g.length;1==t(p,g,m,v);)u--,i(p,x<m?$:T,m,a),m=p.length,l=1;else 0==u&&(l=u=1),m=(p=T.slice()).length;if(m<v&&(p=[0].concat(p)),i(g,p,v,a),v=g.length,-1==l)for(;t(T,g,x,v)<1;)u++,i(g,x<v?$:T,v,a),v=g.length}else 0===l&&(u++,g=[0]);f[h++]=u,g[0]?g[v++]=C[b]||0:(g=[C[b]],v=1)}while((b++<w||null!=g[0])&&S--);d=null!=g[0],f[0]||f.splice(0,1)}if(a==ze){for(h=1,S=f[0];S>=10;S/=10,h++);D(_,o+(_.e=h+c*Ae-1)+1,s,d)}else _.e=c,_.r=+d;return _}}(),a=/^(-?)0([xbo])(?=\w[\w.]*$)/i,l=/^([^.]+)\.$/,c=/^\.([^.]+)$/,h=/^-?(Infinity|NaN)$/,d=/^\s*\+(?=[\w.])|^\s+|\s+$/g,r=function(e,t,i,n){var r,o=i?t:t.replace(d,"");if(h.test(o))e.s=isNaN(o)?null:o<0?-1:1;else{if(!i&&(o=o.replace(a,function(e,t,i){return r="x"==(i=i.toLowerCase())?16:"b"==i?2:8,n&&n!=r?e:t}),n&&(r=n,o=o.replace(l,"$1").replace(c,"0.$1")),t!=o))return new M(o,r);if(M.DEBUG)throw Error(Re+"Not a"+(n?" base "+n:"")+" number: "+t);e.s=null}e.c=e.e=null},u.absoluteValue=u.abs=function(){var e=new M(this);return e.s<0&&(e.s=1),e},u.comparedTo=function(e,t){return Ne(this,new M(e,t))},u.decimalPlaces=u.dp=function(e,t){var i,n,r,o=this;if(null!=e)return Le(e,0,Ie),null==t?t=_:Le(t,0,8),D(new M(o),e+o.e+1,t);if(!(i=o.c))return null;if(n=((r=i.length-1)-Ee(this.e/Ae))*Ae,r=i[r])for(;r%10==0;r/=10,n--);return n<0&&(n=0),n},u.dividedBy=u.div=function(e,t){return i(this,new M(e,t),m,_)},u.dividedToIntegerBy=u.idiv=function(e,t){return i(this,new M(e,t),0,1)},u.exponentiatedBy=u.pow=function(e,t){var i,n,r,o,s,a,l,c,h=this;if((e=new M(e)).c&&!e.isInteger())throw Error(Re+"Exponent not an integer: "+z(e));if(null!=t&&(t=new M(t)),s=e.e>14,!h.c||!h.c[0]||1==h.c[0]&&!h.e&&1==h.c.length||!e.c||!e.c[0])return c=new M(Math.pow(+z(h),s?e.s*(2-Be(e)):+z(e))),t?c.mod(t):c;if(a=e.s<0,t){if(t.c?!t.c[0]:!t.s)return new M(NaN);(n=!a&&h.isInteger()&&t.isInteger())&&(h=h.mod(t))}else{if(e.e>9&&(h.e>0||h.e<-1||(0==h.e?h.c[0]>1||s&&h.c[1]>=24e7:h.c[0]<8e13||s&&h.c[0]<=9999975e7)))return o=h.s<0&&Be(e)?-0:0,h.e>-1&&(o=1/o),new M(a?1/o:o);k&&(o=Ce(k/Ae+2))}for(s?(i=new M(.5),a&&(e.s=1),l=Be(e)):l=(r=Math.abs(+z(e)))%2,c=new M(p);;){if(l){if(!(c=c.times(h)).c)break;o?c.c.length>o&&(c.c.length=o):n&&(c=c.mod(t))}if(r){if(0===(r=Te(r/2)))break;l=r%2}else if(D(e=e.times(i),e.e+1,1),e.e>14)l=Be(e);else{if(0===(r=+z(e)))break;l=r%2}h=h.times(h),o?h.c&&h.c.length>o&&(h.c.length=o):n&&(h=h.mod(t))}return n?c:(a&&(c=p.div(c)),t?c.mod(t):o?D(c,k,_,void 0):c)},u.integerValue=function(e){var t=new M(this);return null==e?e=_:Le(e,0,8),D(t,t.e+1,e)},u.isEqualTo=u.eq=function(e,t){return 0===Ne(this,new M(e,t))},u.isFinite=function(){return!!this.c},u.isGreaterThan=u.gt=function(e,t){return Ne(this,new M(e,t))>0},u.isGreaterThanOrEqualTo=u.gte=function(e,t){return 1===(t=Ne(this,new M(e,t)))||0===t},u.isInteger=function(){return!!this.c&&Ee(this.e/Ae)>this.c.length-2},u.isLessThan=u.lt=function(e,t){return Ne(this,new M(e,t))<0},u.isLessThanOrEqualTo=u.lte=function(e,t){return-1===(t=Ne(this,new M(e,t)))||0===t},u.isNaN=function(){return!this.s},u.isNegative=function(){return this.s<0},u.isPositive=function(){return this.s>0},u.isZero=function(){return!!this.c&&0==this.c[0]},u.minus=function(e,t){var i,n,r,o,s=this,a=s.s;if(t=(e=new M(e,t)).s,!a||!t)return new M(NaN);if(a!=t)return e.s=-t,s.plus(e);var l=s.e/Ae,c=e.e/Ae,h=s.c,d=e.c;if(!l||!c){if(!h||!d)return h?(e.s=-t,e):new M(d?s:NaN);if(!h[0]||!d[0])return d[0]?(e.s=-t,e):new M(h[0]?s:3==_?-0:0)}if(l=Ee(l),c=Ee(c),h=h.slice(),a=l-c){for((o=a<0)?(a=-a,r=h):(c=l,r=d),r.reverse(),t=a;t--;r.push(0));r.reverse()}else for(n=(o=(a=h.length)<(t=d.length))?a:t,a=t=0;t<n;t++)if(h[t]!=d[t]){o=h[t]<d[t];break}if(o&&(r=h,h=d,d=r,e.s=-e.s),(t=(n=d.length)-(i=h.length))>0)for(;t--;h[i++]=0);for(t=ze-1;n>a;){if(h[--n]<d[n]){for(i=n;i&&!h[--i];h[i]=t);--h[i],h[n]+=ze}h[n]-=d[n]}for(;0==h[0];h.splice(0,1),--c);return h[0]?R(e,h,c):(e.s=3==_?-1:1,e.c=[e.e=0],e)},u.modulo=u.mod=function(e,t){var n,r,o=this;return e=new M(e,t),!o.c||!e.s||e.c&&!e.c[0]?new M(NaN):!e.c||o.c&&!o.c[0]?new M(o):(9==w?(r=e.s,e.s=1,n=i(o,e,0,3),e.s=r,n.s*=r):n=i(o,e,0,w),(e=o.minus(n.times(e))).c[0]||1!=w||(e.s=o.s),e)},u.multipliedBy=u.times=function(e,t){var i,n,r,o,s,a,l,c,h,d,u,p,m,_,f,g=this,v=g.c,y=(e=new M(e,t)).c;if(!(v&&y&&v[0]&&y[0]))return!g.s||!e.s||v&&!v[0]&&!y||y&&!y[0]&&!v?e.c=e.e=e.s=null:(e.s*=g.s,v&&y?(e.c=[0],e.e=0):e.c=e.e=null),e;for(n=Ee(g.e/Ae)+Ee(e.e/Ae),e.s*=g.s,(l=v.length)<(d=y.length)&&(m=v,v=y,y=m,r=l,l=d,d=r),r=l+d,m=[];r--;m.push(0));for(_=ze,f=Fe,r=d;--r>=0;){for(i=0,u=y[r]%f,p=y[r]/f|0,o=r+(s=l);o>r;)i=((c=u*(c=v[--s]%f)+(a=p*c+(h=v[s]/f|0)*u)%f*f+m[o]+i)/_|0)+(a/f|0)+p*h,m[o--]=c%_;m[o]=i}return i?++n:m.splice(0,1),R(e,m,n)},u.negated=function(){var e=new M(this);return e.s=-e.s||null,e},u.plus=function(e,t){var i,n=this,r=n.s;if(t=(e=new M(e,t)).s,!r||!t)return new M(NaN);if(r!=t)return e.s=-t,n.minus(e);var o=n.e/Ae,s=e.e/Ae,a=n.c,l=e.c;if(!o||!s){if(!a||!l)return new M(r/0);if(!a[0]||!l[0])return l[0]?e:new M(a[0]?n:0*r)}if(o=Ee(o),s=Ee(s),a=a.slice(),r=o-s){for(r>0?(s=o,i=l):(r=-r,i=a),i.reverse();r--;i.push(0));i.reverse()}for((r=a.length)-(t=l.length)<0&&(i=l,l=a,a=i,t=r),r=0;t;)r=(a[--t]=a[t]+l[t]+r)/ze|0,a[t]=ze===a[t]?0:a[t]%ze;return r&&(a=[r].concat(a),++s),R(e,a,s)},u.precision=u.sd=function(e,t){var i,n,r,o=this;if(null!=e&&e!==!!e)return Le(e,1,Ie),null==t?t=_:Le(t,0,8),D(new M(o),e,t);if(!(i=o.c))return null;if(n=(r=i.length-1)*Ae+1,r=i[r]){for(;r%10==0;r/=10,n--);for(r=i[0];r>=10;r/=10,n++);}return e&&o.e+1>n&&(n=o.e+1),n},u.shiftedBy=function(e){return Le(e,-9007199254740991,Pe),this.times("1e"+e)},u.squareRoot=u.sqrt=function(){var e,t,n,r,o,s=this,a=s.c,l=s.s,c=s.e,h=m+4,d=new M("0.5");if(1!==l||!a||!a[0])return new M(!l||l<0&&(!a||a[0])?NaN:a?s:1/0);if(0==(l=Math.sqrt(+z(s)))||l==1/0?(((t=He(a)).length+c)%2==0&&(t+="0"),l=Math.sqrt(+t),c=Ee((c+1)/2)-(c<0||c%2),n=new M(t=l==1/0?"5e"+c:(t=l.toExponential()).slice(0,t.indexOf("e")+1)+c)):n=new M(l+""),n.c[0])for((l=(c=n.e)+h)<3&&(l=0);;)if(o=n,n=d.times(o.plus(i(s,o,h,1))),He(o.c).slice(0,l)===(t=He(n.c)).slice(0,l)){if(n.e<c&&--l,"9999"!=(t=t.slice(l-3,l+1))&&(r||"4999"!=t)){+t&&(+t.slice(1)||"5"!=t.charAt(0))||(D(n,n.e+m+2,1),e=!n.times(n).eq(s));break}if(!r&&(D(o,o.e+m+2,0),o.times(o).eq(s))){n=o;break}h+=4,l+=4,r=1}return D(n,n.e+m+1,_,e)},u.toExponential=function(e,t){return null!=e&&(Le(e,0,Ie),e++),C(this,e,t,1)},u.toFixed=function(e,t){return null!=e&&(Le(e,0,Ie),e=e+this.e+1),C(this,e,t)},u.toFormat=function(e,t,i){var n,r=this;if(null==i)null!=e&&t&&"object"==typeof t?(i=t,t=null):e&&"object"==typeof e?(i=e,e=t=null):i=x;else if("object"!=typeof i)throw Error(Re+"Argument not an object: "+i);if(n=r.toFixed(e,t),r.c){var o,s=n.split("."),a=+i.groupSize,l=+i.secondaryGroupSize,c=i.groupSeparator||"",h=s[0],d=s[1],u=r.s<0,p=u?h.slice(1):h,m=p.length;if(l&&(o=a,a=l,l=o,m-=o),a>0&&m>0){for(o=m%a||a,h=p.substr(0,o);o<m;o+=a)h+=c+p.substr(o,a);l>0&&(h+=c+p.slice(o)),u&&(h="-"+h)}n=d?h+(i.decimalSeparator||"")+((l=+i.fractionGroupSize)?d.replace(new RegExp("\\d{"+l+"}\\B","g"),"$&"+(i.fractionGroupSeparator||"")):d):h}return(i.prefix||"")+n+(i.suffix||"")},u.toFraction=function(e){var t,n,r,o,s,a,l,c,h,d,u,m,f=this,g=f.c;if(null!=e&&(!(l=new M(e)).isInteger()&&(l.c||1!==l.s)||l.lt(p)))throw Error(Re+"Argument "+(l.isInteger()?"out of range: ":"not an integer: ")+z(l));if(!g)return new M(f);for(t=new M(p),h=n=new M(p),r=c=new M(p),m=He(g),s=t.e=m.length-f.e-1,t.c[0]=Oe[(a=s%Ae)<0?Ae+a:a],e=!e||l.comparedTo(t)>0?s>0?t:h:l,a=y,y=1/0,l=new M(m),c.c[0]=0;d=i(l,t,0,1),1!=(o=n.plus(d.times(r))).comparedTo(e);)n=r,r=o,h=c.plus(d.times(o=h)),c=o,t=l.minus(d.times(o=t)),l=o;return o=i(e.minus(n),r,0,1),c=c.plus(o.times(h)),n=n.plus(o.times(r)),c.s=h.s=f.s,u=i(h,r,s*=2,_).minus(f).abs().comparedTo(i(c,n,s,_).minus(f).abs())<1?[h,r]:[c,n],y=a,u},u.toNumber=function(){return+z(this)},u.toPrecision=function(e,t){return null!=e&&Le(e,1,Ie),C(this,e,t,2)},u.toString=function(e){var t,i=this,r=i.s,o=i.e;return null===o?r?(t="Infinity",r<0&&(t="-"+t)):t="NaN":(null==e?t=o<=f||o>=g?qe(He(i.c),o):We(He(i.c),o,"0"):10===e&&S?t=We(He((i=D(new M(i),m+o+1,_)).c),i.e,"0"):(Le(e,2,$.length,"Base"),t=n(We(He(i.c),o,"0"),10,e,r,!0)),r<0&&i.c[0]&&(t="-"+t)),t},u.valueOf=u.toJSON=function(){return z(this)},u._isBigNumber=!0,u[Symbol.toStringTag]="BigNumber",u[Symbol.for("nodejs.util.inspect.custom")]=u.valueOf,null!=t&&M.set(t),M}(),Ue=class{key;left=null;right=null;constructor(e){this.key=e}},Ve=class extends Ue{constructor(e){super(e)}},Ge=class{size=0;modificationCount=0;splayCount=0;splay(e){const t=this.root;if(null==t)return this.compare(e,e),-1;let i=null,n=null,r=null,o=null,s=t;const a=this.compare;let l;for(;;)if(l=a(s.key,e),l>0){let t=s.left;if(null==t)break;if(l=a(t.key,e),l>0&&(s.left=t.right,t.right=s,s=t,t=s.left,null==t))break;null==i?n=s:i.left=s,i=s,s=t}else{if(!(l<0))break;{let t=s.right;if(null==t)break;if(l=a(t.key,e),l<0&&(s.right=t.left,t.left=s,s=t,t=s.right,null==t))break;null==r?o=s:r.right=s,r=s,s=t}}return null!=r&&(r.right=s.left,s.left=o),null!=i&&(i.left=s.right,s.right=n),this.root!==s&&(this.root=s,this.splayCount++),l}splayMin(e){let t=e,i=t.left;for(;null!=i;){const e=i;t.left=e.right,e.right=t,t=e,i=t.left}return t}splayMax(e){let t=e,i=t.right;for(;null!=i;){const e=i;t.right=e.left,e.left=t,t=e,i=t.right}return t}_delete(e){if(null==this.root)return null;if(0!=this.splay(e))return null;let t=this.root;const i=t,n=t.left;if(this.size--,null==n)this.root=t.right;else{const e=t.right;t=this.splayMax(n),t.right=e,this.root=t}return this.modificationCount++,i}addNewRoot(e,t){this.size++,this.modificationCount++;const i=this.root;null!=i?(t<0?(e.left=i,e.right=i.right,i.right=null):(e.right=i,e.left=i.left,i.left=null),this.root=e):this.root=e}_first(){const e=this.root;return null==e?null:(this.root=this.splayMin(e),this.root)}_last(){const e=this.root;return null==e?null:(this.root=this.splayMax(e),this.root)}clear(){this.root=null,this.size=0,this.modificationCount++}has(e){return this.validKey(e)&&0==this.splay(e)}defaultCompare(){return(e,t)=>e<t?-1:e>t?1:0}wrap(){return{getRoot:()=>this.root,setRoot:e=>{this.root=e},getSize:()=>this.size,getModificationCount:()=>this.modificationCount,getSplayCount:()=>this.splayCount,setSplayCount:e=>{this.splayCount=e},splay:e=>this.splay(e),has:e=>this.has(e)}}},Ke=class e extends Ge{root=null;compare;validKey;constructor(e,t){super(),this.compare=e??this.defaultCompare(),this.validKey=t??(e=>null!=e&&null!=e)}delete(e){return!!this.validKey(e)&&null!=this._delete(e)}deleteAll(e){for(const t of e)this.delete(t)}forEach(e){const t=this[Symbol.iterator]();let i;for(;i=t.next(),!i.done;)e(i.value,i.value,this)}add(e){const t=this.splay(e);return 0!=t&&this.addNewRoot(new Ve(e),t),this}addAndReturn(e){const t=this.splay(e);return 0!=t&&this.addNewRoot(new Ve(e),t),this.root.key}addAll(e){for(const t of e)this.add(t)}isEmpty(){return null==this.root}isNotEmpty(){return null!=this.root}single(){if(0==this.size)throw"Bad state: No element";if(this.size>1)throw"Bad state: Too many element";return this.root.key}first(){if(0==this.size)throw"Bad state: No element";return this._first().key}last(){if(0==this.size)throw"Bad state: No element";return this._last().key}lastBefore(e){if(null==e)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(e)<0)return this.root.key;let t=this.root.left;if(null==t)return null;let i=t.right;for(;null!=i;)t=i,i=t.right;return t.key}firstAfter(e){if(null==e)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(e)>0)return this.root.key;let t=this.root.right;if(null==t)return null;let i=t.left;for(;null!=i;)t=i,i=t.left;return t.key}retainAll(t){const i=new e(this.compare,this.validKey),n=this.modificationCount;for(const e of t){if(n!=this.modificationCount)throw"Concurrent modification during iteration.";this.validKey(e)&&0==this.splay(e)&&i.add(this.root.key)}i.size!=this.size&&(this.root=i.root,this.size=i.size,this.modificationCount++)}lookup(e){if(!this.validKey(e))return null;return 0!=this.splay(e)?null:this.root.key}intersection(t){const i=new e(this.compare,this.validKey);for(const e of this)t.has(e)&&i.add(e);return i}difference(t){const i=new e(this.compare,this.validKey);for(const e of this)t.has(e)||i.add(e);return i}union(e){const t=this.clone();return t.addAll(e),t}clone(){const t=new e(this.compare,this.validKey);return t.size=this.size,t.root=this.copyNode(this.root),t}copyNode(e){if(null==e)return null;const t=new Ve(e.key);return function e(t,i){let n,r;do{if(n=t.left,r=t.right,null!=n){const t=new Ve(n.key);i.left=t,e(n,t)}if(null!=r){const e=new Ve(r.key);i.right=e,t=r,i=e}}while(null!=r)}(e,t),t}toSet(){return this.clone()}entries(){return new Ze(this.wrap())}keys(){return this[Symbol.iterator]()}values(){return this[Symbol.iterator]()}[Symbol.iterator](){return new Xe(this.wrap())}[Symbol.toStringTag]="[object Set]"},Ye=class{tree;path=new Array;modificationCount=null;splayCount;constructor(e){this.tree=e,this.splayCount=e.getSplayCount()}[Symbol.iterator](){return this}next(){return this.moveNext()?{done:!1,value:this.current()}:{done:!0,value:null}}current(){if(!this.path.length)return null;const e=this.path[this.path.length-1];return this.getValue(e)}rebuildPath(e){this.path.splice(0,this.path.length),this.tree.splay(e),this.path.push(this.tree.getRoot()),this.splayCount=this.tree.getSplayCount()}findLeftMostDescendent(e){for(;null!=e;)this.path.push(e),e=e.left}moveNext(){if(this.modificationCount!=this.tree.getModificationCount()){if(null==this.modificationCount){this.modificationCount=this.tree.getModificationCount();let e=this.tree.getRoot();for(;null!=e;)this.path.push(e),e=e.left;return this.path.length>0}throw"Concurrent modification during iteration."}if(!this.path.length)return!1;this.splayCount!=this.tree.getSplayCount()&&this.rebuildPath(this.path[this.path.length-1].key);let e=this.path[this.path.length-1],t=e.right;if(null!=t){for(;null!=t;)this.path.push(t),t=t.left;return!0}for(this.path.pop();this.path.length&&this.path[this.path.length-1].right===e;)e=this.path.pop();return this.path.length>0}},Xe=class extends Ye{getValue(e){return e.key}},Ze=class extends Ye{getValue(e){return[e.key,e.key]}},Je=e=>()=>e,Qe=e=>{const t=e?(t,i)=>i.minus(t).abs().isLessThanOrEqualTo(e):Je(!1);return(e,i)=>t(e,i)?0:e.comparedTo(i)};function et(e){const t=e?(t,i,n,r,o)=>t.exponentiatedBy(2).isLessThanOrEqualTo(r.minus(i).exponentiatedBy(2).plus(o.minus(n).exponentiatedBy(2)).times(e)):Je(!1);return(e,i,n)=>{const r=e.x,o=e.y,s=n.x,a=n.y,l=o.minus(a).times(i.x.minus(s)).minus(r.minus(s).times(i.y.minus(a)));return t(l,r,o,s,a)?0:l.comparedTo(0)}}var tt=e=>e,it=e=>{if(e){const t=new Ke(Qe(e)),i=new Ke(Qe(e)),n=(e,t)=>t.addAndReturn(e),r=e=>({x:n(e.x,t),y:n(e.y,i)});return r({x:new je(0),y:new je(0)}),r}return tt},nt=e=>({set:e=>{rt=nt(e)},reset:()=>nt(e),compare:Qe(e),snap:it(e),orient:et(e)}),rt=nt(),ot=(e,t)=>e.ll.x.isLessThanOrEqualTo(t.x)&&t.x.isLessThanOrEqualTo(e.ur.x)&&e.ll.y.isLessThanOrEqualTo(t.y)&&t.y.isLessThanOrEqualTo(e.ur.y),st=(e,t)=>{if(t.ur.x.isLessThan(e.ll.x)||e.ur.x.isLessThan(t.ll.x)||t.ur.y.isLessThan(e.ll.y)||e.ur.y.isLessThan(t.ll.y))return null;const i=e.ll.x.isLessThan(t.ll.x)?t.ll.x:e.ll.x,n=e.ur.x.isLessThan(t.ur.x)?e.ur.x:t.ur.x;return{ll:{x:i,y:e.ll.y.isLessThan(t.ll.y)?t.ll.y:e.ll.y},ur:{x:n,y:e.ur.y.isLessThan(t.ur.y)?e.ur.y:t.ur.y}}},at=(e,t)=>e.x.times(t.y).minus(e.y.times(t.x)),lt=(e,t)=>e.x.times(t.x).plus(e.y.times(t.y)),ct=e=>lt(e,e).sqrt(),ht=(e,t,i)=>{const n={x:t.x.minus(e.x),y:t.y.minus(e.y)},r={x:i.x.minus(e.x),y:i.y.minus(e.y)};return at(r,n).div(ct(r)).div(ct(n))},dt=(e,t,i)=>{const n={x:t.x.minus(e.x),y:t.y.minus(e.y)},r={x:i.x.minus(e.x),y:i.y.minus(e.y)};return lt(r,n).div(ct(r)).div(ct(n))},ut=(e,t,i)=>t.y.isZero()?null:{x:e.x.plus(t.x.div(t.y).times(i.minus(e.y))),y:i},pt=(e,t,i)=>t.x.isZero()?null:{x:i,y:e.y.plus(t.y.div(t.x).times(i.minus(e.x)))},mt=class e{point;isLeft;segment;otherSE;consumedBy;static compare(t,i){const n=e.comparePoints(t.point,i.point);return 0!==n?n:(t.point!==i.point&&t.link(i),t.isLeft!==i.isLeft?t.isLeft?1:-1:kt.compare(t.segment,i.segment))}static comparePoints(e,t){return e.x.isLessThan(t.x)?-1:e.x.isGreaterThan(t.x)?1:e.y.isLessThan(t.y)?-1:e.y.isGreaterThan(t.y)?1:0}constructor(e,t){void 0===e.events?e.events=[this]:e.events.push(this),this.point=e,this.isLeft=t}link(e){if(e.point===this.point)throw new Error("Tried to link already linked events");const t=e.point.events;for(let e=0,i=t.length;e<i;e++){const i=t[e];this.point.events.push(i),i.point=this.point}this.checkForConsuming()}checkForConsuming(){const e=this.point.events.length;for(let t=0;t<e;t++){const i=this.point.events[t];if(void 0===i.segment.consumedBy)for(let n=t+1;n<e;n++){const e=this.point.events[n];void 0===e.consumedBy&&(i.otherSE.point.events===e.otherSE.point.events&&i.segment.consume(e.segment))}}}getAvailableLinkedEvents(){const e=[];for(let t=0,i=this.point.events.length;t<i;t++){const i=this.point.events[t];i!==this&&!i.segment.ringOut&&i.segment.isInResult()&&e.push(i)}return e}getLeftmostComparator(e){const t=new Map,i=i=>{const n=i.otherSE;t.set(i,{sine:ht(this.point,e.point,n.point),cosine:dt(this.point,e.point,n.point)})};return(e,n)=>{t.has(e)||i(e),t.has(n)||i(n);const{sine:r,cosine:o}=t.get(e),{sine:s,cosine:a}=t.get(n);return r.isGreaterThanOrEqualTo(0)&&s.isGreaterThanOrEqualTo(0)?o.isLessThan(a)?1:o.isGreaterThan(a)?-1:0:r.isLessThan(0)&&s.isLessThan(0)?o.isLessThan(a)?-1:o.isGreaterThan(a)?1:0:s.isLessThan(r)?-1:s.isGreaterThan(r)?1:0}}},_t=class e{events;poly;_isExteriorRing;_enclosingRing;static factory(t){const i=[];for(let n=0,r=t.length;n<r;n++){const r=t[n];if(!r.isInResult()||r.ringOut)continue;let o=null,s=r.leftSE,a=r.rightSE;const l=[s],c=s.point,h=[];for(;o=s,s=a,l.push(s),s.point!==c;)for(;;){const t=s.getAvailableLinkedEvents();if(0===t.length){const e=l[0].point,t=l[l.length-1].point;throw new Error(`Unable to complete output ring starting at [${e.x}, ${e.y}]. Last matching segment found ends at [${t.x}, ${t.y}].`)}if(1===t.length){a=t[0].otherSE;break}let n=null;for(let e=0,t=h.length;e<t;e++)if(h[e].point===s.point){n=e;break}if(null!==n){const t=h.splice(n)[0],r=l.splice(t.index);r.unshift(r[0].otherSE),i.push(new e(r.reverse()));continue}h.push({index:l.length,point:s.point});const r=s.getLeftmostComparator(o);a=t.sort(r)[0].otherSE;break}i.push(new e(l))}return i}constructor(e){this.events=e;for(let t=0,i=e.length;t<i;t++)e[t].segment.ringOut=this;this.poly=null}getGeom(){let e=this.events[0].point;const t=[e];for(let i=1,n=this.events.length-1;i<n;i++){const n=this.events[i].point,r=this.events[i+1].point;0!==rt.orient(n,e,r)&&(t.push(n),e=n)}if(1===t.length)return null;const i=t[0],n=t[1];0===rt.orient(i,e,n)&&t.shift(),t.push(t[0]);const r=this.isExteriorRing()?1:-1,o=this.isExteriorRing()?0:t.length-1,s=this.isExteriorRing()?t.length:-1,a=[];for(let e=o;e!=s;e+=r)a.push([t[e].x.toNumber(),t[e].y.toNumber()]);return a}isExteriorRing(){if(void 0===this._isExteriorRing){const e=this.enclosingRing();this._isExteriorRing=!e||!e.isExteriorRing()}return this._isExteriorRing}enclosingRing(){return void 0===this._enclosingRing&&(this._enclosingRing=this._calcEnclosingRing()),this._enclosingRing}_calcEnclosingRing(){let e=this.events[0];for(let t=1,i=this.events.length;t<i;t++){const i=this.events[t];mt.compare(e,i)>0&&(e=i)}let t=e.segment.prevInResult(),i=t?t.prevInResult():null;for(;;){if(!t)return null;if(!i)return t.ringOut;if(i.ringOut!==t.ringOut)return i.ringOut?.enclosingRing()!==t.ringOut?t.ringOut:t.ringOut?.enclosingRing();t=i.prevInResult(),i=t?t.prevInResult():null}}},ft=class{exteriorRing;interiorRings;constructor(e){this.exteriorRing=e,e.poly=this,this.interiorRings=[]}addInterior(e){this.interiorRings.push(e),e.poly=this}getGeom(){const e=this.exteriorRing.getGeom();if(null===e)return null;const t=[e];for(let e=0,i=this.interiorRings.length;e<i;e++){const i=this.interiorRings[e].getGeom();null!==i&&t.push(i)}return t}},gt=class{rings;polys;constructor(e){this.rings=e,this.polys=this._composePolys(e)}getGeom(){const e=[];for(let t=0,i=this.polys.length;t<i;t++){const i=this.polys[t].getGeom();null!==i&&e.push(i)}return e}_composePolys(e){const t=[];for(let i=0,n=e.length;i<n;i++){const n=e[i];if(!n.poly)if(n.isExteriorRing())t.push(new ft(n));else{const e=n.enclosingRing();e?.poly||t.push(new ft(e)),e?.poly?.addInterior(n)}}return t}},vt=class{queue;tree;segments;constructor(e,t=kt.compare){this.queue=e,this.tree=new Ke(t),this.segments=[]}process(e){const t=e.segment,i=[];if(e.consumedBy)return e.isLeft?this.queue.delete(e.otherSE):this.tree.delete(t),i;e.isLeft&&this.tree.add(t);let n=t,r=t;do{n=this.tree.lastBefore(n)}while(null!=n&&null!=n.consumedBy);do{r=this.tree.firstAfter(r)}while(null!=r&&null!=r.consumedBy);if(e.isLeft){let o=null;if(n){const e=n.getIntersection(t);if(null!==e&&(t.isAnEndpoint(e)||(o=e),!n.isAnEndpoint(e))){const t=this._splitSafely(n,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}}let s=null;if(r){const e=r.getIntersection(t);if(null!==e&&(t.isAnEndpoint(e)||(s=e),!r.isAnEndpoint(e))){const t=this._splitSafely(r,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}}if(null!==o||null!==s){let e=null;if(null===o)e=s;else if(null===s)e=o;else{e=mt.comparePoints(o,s)<=0?o:s}this.queue.delete(t.rightSE),i.push(t.rightSE);const n=t.split(e);for(let e=0,t=n.length;e<t;e++)i.push(n[e])}i.length>0?(this.tree.delete(t),i.push(e)):(this.segments.push(t),t.prev=n)}else{if(n&&r){const e=n.getIntersection(r);if(null!==e){if(!n.isAnEndpoint(e)){const t=this._splitSafely(n,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}if(!r.isAnEndpoint(e)){const t=this._splitSafely(r,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}}}this.tree.delete(t)}return i}_splitSafely(e,t){this.tree.delete(e);const i=e.rightSE;this.queue.delete(i);const n=e.split(t);return n.push(i),void 0===e.consumedBy&&this.tree.add(e),n}},yt=new class{type;numMultiPolys;run(e,t,i){yt.type=e;const n=[new St(t,!0)];for(let e=0,t=i.length;e<t;e++)n.push(new St(i[e],!1));if(yt.numMultiPolys=n.length,"difference"===yt.type){const e=n[0];let t=1;for(;t<n.length;)null!==st(n[t].bbox,e.bbox)?t++:n.splice(t,1)}if("intersection"===yt.type)for(let e=0,t=n.length;e<t;e++){const t=n[e];for(let i=e+1,r=n.length;i<r;i++)if(null===st(t.bbox,n[i].bbox))return[]}const r=new Ke(mt.compare);for(let e=0,t=n.length;e<t;e++){const t=n[e].getSweepEvents();for(let e=0,i=t.length;e<i;e++)r.add(t[e])}const o=new vt(r);let s=null;for(0!=r.size&&(s=r.first(),r.delete(s));s;){const e=o.process(s);for(let t=0,i=e.length;t<i;t++){const i=e[t];void 0===i.consumedBy&&r.add(i)}0!=r.size?(s=r.first(),r.delete(s)):s=null}rt.reset();const a=_t.factory(o.segments);return new gt(a).getGeom()}},bt=yt,wt=0,kt=class e{id;leftSE;rightSE;rings;windings;ringOut;consumedBy;prev;_prevInResult;_beforeState;_afterState;_isInResult;static compare(e,t){const i=e.leftSE.point.x,n=t.leftSE.point.x,r=e.rightSE.point.x,o=t.rightSE.point.x;if(o.isLessThan(i))return 1;if(r.isLessThan(n))return-1;const s=e.leftSE.point.y,a=t.leftSE.point.y,l=e.rightSE.point.y,c=t.rightSE.point.y;if(i.isLessThan(n)){if(a.isLessThan(s)&&a.isLessThan(l))return 1;if(a.isGreaterThan(s)&&a.isGreaterThan(l))return-1;const i=e.comparePoint(t.leftSE.point);if(i<0)return 1;if(i>0)return-1;const n=t.comparePoint(e.rightSE.point);return 0!==n?n:-1}if(i.isGreaterThan(n)){if(s.isLessThan(a)&&s.isLessThan(c))return-1;if(s.isGreaterThan(a)&&s.isGreaterThan(c))return 1;const i=t.comparePoint(e.leftSE.point);if(0!==i)return i;const n=e.comparePoint(t.rightSE.point);return n<0?1:n>0?-1:1}if(s.isLessThan(a))return-1;if(s.isGreaterThan(a))return 1;if(r.isLessThan(o)){const i=t.comparePoint(e.rightSE.point);if(0!==i)return i}if(r.isGreaterThan(o)){const i=e.comparePoint(t.rightSE.point);if(i<0)return 1;if(i>0)return-1}if(!r.eq(o)){const e=l.minus(s),t=r.minus(i),h=c.minus(a),d=o.minus(n);if(e.isGreaterThan(t)&&h.isLessThan(d))return 1;if(e.isLessThan(t)&&h.isGreaterThan(d))return-1}return r.isGreaterThan(o)?1:r.isLessThan(o)||l.isLessThan(c)?-1:l.isGreaterThan(c)?1:e.id<t.id?-1:e.id>t.id?1:0}constructor(e,t,i,n){this.id=++wt,this.leftSE=e,e.segment=this,e.otherSE=t,this.rightSE=t,t.segment=this,t.otherSE=e,this.rings=i,this.windings=n}static fromRing(t,i,n){let r,o,s;const a=mt.comparePoints(t,i);if(a<0)r=t,o=i,s=1;else{if(!(a>0))throw new Error(`Tried to create degenerate segment at [${t.x}, ${t.y}]`);r=i,o=t,s=-1}const l=new mt(r,!0),c=new mt(o,!1);return new e(l,c,[n],[s])}replaceRightSE(e){this.rightSE=e,this.rightSE.segment=this,this.rightSE.otherSE=this.leftSE,this.leftSE.otherSE=this.rightSE}bbox(){const e=this.leftSE.point.y,t=this.rightSE.point.y;return{ll:{x:this.leftSE.point.x,y:e.isLessThan(t)?e:t},ur:{x:this.rightSE.point.x,y:e.isGreaterThan(t)?e:t}}}vector(){return{x:this.rightSE.point.x.minus(this.leftSE.point.x),y:this.rightSE.point.y.minus(this.leftSE.point.y)}}isAnEndpoint(e){return e.x.eq(this.leftSE.point.x)&&e.y.eq(this.leftSE.point.y)||e.x.eq(this.rightSE.point.x)&&e.y.eq(this.rightSE.point.y)}comparePoint(e){return rt.orient(this.leftSE.point,e,this.rightSE.point)}getIntersection(e){const t=this.bbox(),i=e.bbox(),n=st(t,i);if(null===n)return null;const r=this.leftSE.point,o=this.rightSE.point,s=e.leftSE.point,a=e.rightSE.point,l=ot(t,s)&&0===this.comparePoint(s),c=ot(i,r)&&0===e.comparePoint(r),h=ot(t,a)&&0===this.comparePoint(a),d=ot(i,o)&&0===e.comparePoint(o);if(c&&l)return d&&!h?o:!d&&h?a:null;if(c)return h&&r.x.eq(a.x)&&r.y.eq(a.y)?null:r;if(l)return d&&o.x.eq(s.x)&&o.y.eq(s.y)?null:s;if(d&&h)return null;if(d)return o;if(h)return a;const u=((e,t,i,n)=>{if(t.x.isZero())return pt(i,n,e.x);if(n.x.isZero())return pt(e,t,i.x);if(t.y.isZero())return ut(i,n,e.y);if(n.y.isZero())return ut(e,t,i.y);const r=at(t,n);if(r.isZero())return null;const o={x:i.x.minus(e.x),y:i.y.minus(e.y)},s=at(o,t).div(r),a=at(o,n).div(r),l=e.x.plus(a.times(t.x)),c=i.x.plus(s.times(n.x)),h=e.y.plus(a.times(t.y)),d=i.y.plus(s.times(n.y));return{x:l.plus(c).div(2),y:h.plus(d).div(2)}})(r,this.vector(),s,e.vector());return null===u?null:ot(n,u)?rt.snap(u):null}split(t){const i=[],n=void 0!==t.events,r=new mt(t,!0),o=new mt(t,!1),s=this.rightSE;this.replaceRightSE(o),i.push(o),i.push(r);const a=new e(r,s,this.rings.slice(),this.windings.slice());return mt.comparePoints(a.leftSE.point,a.rightSE.point)>0&&a.swapEvents(),mt.comparePoints(this.leftSE.point,this.rightSE.point)>0&&this.swapEvents(),n&&(r.checkForConsuming(),o.checkForConsuming()),i}swapEvents(){const e=this.rightSE;this.rightSE=this.leftSE,this.leftSE=e,this.leftSE.isLeft=!0,this.rightSE.isLeft=!1;for(let e=0,t=this.windings.length;e<t;e++)this.windings[e]*=-1}consume(t){let i=this,n=t;for(;i.consumedBy;)i=i.consumedBy;for(;n.consumedBy;)n=n.consumedBy;const r=e.compare(i,n);if(0!==r){if(r>0){const e=i;i=n,n=e}if(i.prev===n){const e=i;i=n,n=e}for(let e=0,t=n.rings.length;e<t;e++){const t=n.rings[e],r=n.windings[e],o=i.rings.indexOf(t);-1===o?(i.rings.push(t),i.windings.push(r)):i.windings[o]+=r}n.rings=null,n.windings=null,n.consumedBy=i,n.leftSE.consumedBy=i.leftSE,n.rightSE.consumedBy=i.rightSE}}prevInResult(){return void 0!==this._prevInResult||(this.prev?this.prev.isInResult()?this._prevInResult=this.prev:this._prevInResult=this.prev.prevInResult():this._prevInResult=null),this._prevInResult}beforeState(){if(void 0!==this._beforeState)return this._beforeState;if(this.prev){const e=this.prev.consumedBy||this.prev;this._beforeState=e.afterState()}else this._beforeState={rings:[],windings:[],multiPolys:[]};return this._beforeState}afterState(){if(void 0!==this._afterState)return this._afterState;const e=this.beforeState();this._afterState={rings:e.rings.slice(0),windings:e.windings.slice(0),multiPolys:[]};const t=this._afterState.rings,i=this._afterState.windings,n=this._afterState.multiPolys;for(let e=0,n=this.rings.length;e<n;e++){const n=this.rings[e],r=this.windings[e],o=t.indexOf(n);-1===o?(t.push(n),i.push(r)):i[o]+=r}const r=[],o=[];for(let e=0,n=t.length;e<n;e++){if(0===i[e])continue;const n=t[e],s=n.poly;if(-1===o.indexOf(s))if(n.isExterior)r.push(s);else{-1===o.indexOf(s)&&o.push(s);const e=r.indexOf(n.poly);-1!==e&&r.splice(e,1)}}for(let e=0,t=r.length;e<t;e++){const t=r[e].multiPoly;-1===n.indexOf(t)&&n.push(t)}return this._afterState}isInResult(){if(this.consumedBy)return!1;if(void 0!==this._isInResult)return this._isInResult;const e=this.beforeState().multiPolys,t=this.afterState().multiPolys;switch(bt.type){case"union":{const i=0===e.length,n=0===t.length;this._isInResult=i!==n;break}case"intersection":{let i,n;e.length<t.length?(i=e.length,n=t.length):(i=t.length,n=e.length),this._isInResult=n===bt.numMultiPolys&&i<n;break}case"xor":{const i=Math.abs(e.length-t.length);this._isInResult=i%2==1;break}case"difference":{const i=e=>1===e.length&&e[0].isSubject;this._isInResult=i(e)!==i(t);break}}return this._isInResult}},xt=class{poly;isExterior;segments;bbox;constructor(e,t,i){if(!Array.isArray(e)||0===e.length)throw new Error("Input geometry is not a valid Polygon or MultiPolygon");if(this.poly=t,this.isExterior=i,this.segments=[],"number"!=typeof e[0][0]||"number"!=typeof e[0][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const n=rt.snap({x:new je(e[0][0]),y:new je(e[0][1])});this.bbox={ll:{x:n.x,y:n.y},ur:{x:n.x,y:n.y}};let r=n;for(let t=1,i=e.length;t<i;t++){if("number"!=typeof e[t][0]||"number"!=typeof e[t][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const i=rt.snap({x:new je(e[t][0]),y:new je(e[t][1])});i.x.eq(r.x)&&i.y.eq(r.y)||(this.segments.push(kt.fromRing(r,i,this)),i.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.x),i.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.y),i.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.x),i.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.y),r=i)}n.x.eq(r.x)&&n.y.eq(r.y)||this.segments.push(kt.fromRing(r,n,this))}getSweepEvents(){const e=[];for(let t=0,i=this.segments.length;t<i;t++){const i=this.segments[t];e.push(i.leftSE),e.push(i.rightSE)}return e}},$t=class{multiPoly;exteriorRing;interiorRings;bbox;constructor(e,t){if(!Array.isArray(e))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");this.exteriorRing=new xt(e[0],this,!0),this.bbox={ll:{x:this.exteriorRing.bbox.ll.x,y:this.exteriorRing.bbox.ll.y},ur:{x:this.exteriorRing.bbox.ur.x,y:this.exteriorRing.bbox.ur.y}},this.interiorRings=[];for(let t=1,i=e.length;t<i;t++){const i=new xt(e[t],this,!1);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.interiorRings.push(i)}this.multiPoly=t}getSweepEvents(){const e=this.exteriorRing.getSweepEvents();for(let t=0,i=this.interiorRings.length;t<i;t++){const i=this.interiorRings[t].getSweepEvents();for(let t=0,n=i.length;t<n;t++)e.push(i[t])}return e}},St=class{isSubject;polys;bbox;constructor(e,t){if(!Array.isArray(e))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");try{"number"==typeof e[0][0][0]&&(e=[e])}catch(e){}this.polys=[],this.bbox={ll:{x:new je(Number.POSITIVE_INFINITY),y:new je(Number.POSITIVE_INFINITY)},ur:{x:new je(Number.NEGATIVE_INFINITY),y:new je(Number.NEGATIVE_INFINITY)}};for(let t=0,i=e.length;t<i;t++){const i=new $t(e[t],this);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.polys.push(i)}this.isSubject=t}getSweepEvents(){const e=[];for(let t=0,i=this.polys.length;t<i;t++){const i=this.polys[t].getSweepEvents();for(let t=0,n=i.length;t<n;t++)e.push(i[t])}return e}},Mt=(e,...t)=>bt.run("union",e,t),Ct=(e,...t)=>bt.run("intersection",e,t),Tt=(e,...t)=>bt.run("difference",e,t);rt.set;const Rt=/^#[0-9a-fA-F]{6}$/;function Dt(e,t){return"string"==typeof e&&Rt.test(e)?e:t}const zt="(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])",At=new RegExp(`^rgb\\(${zt}, ${zt}, ${zt}\\)$`);function Pt(e){if(!Array.isArray(e)||e.length<3)return null;const t=e.slice(0,3);if(!t.every(e=>"number"==typeof e&&Number.isFinite(e)))return null;const[i,n,r]=t.map(e=>Math.round(Math.min(255,Math.max(0,e))));return`rgb(${i}, ${n}, ${r})`}function Ot(e){const t=Math.max(0,Math.min(120,(e-40)/140*120));return`hsl(${Math.round(t)}, 85%, 55%)`}function Ft(e,t){if(!(Number.isFinite(e)&&t>0))return e;const i=Math.round(e/t)*t;return Math.abs(i-e)<=1e-9*t?e:i}function It(e,t,i,n=1/0){if(!(i>0&&e?.every(Number.isFinite)&&t?.every(Number.isFinite)))return[t[0],t[1]];const r=t[0]-e[0],o=t[1]-e[1];if(Math.abs(r)+Math.abs(o)<=1e-12)return[e[0],e[1]];const s=Math.PI/4;let a=Math.atan2(o,r);a<0&&(a+=2*Math.PI);const l=Math.floor(a/s+.5)%8,[c,h]=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]][l],d=c*c+h*h;let u=Math.max(0,Math.round((r*c+o*h)/(i*d)));if(Number.isFinite(n)&&n>=0){const t=(e,t)=>{if(!t)return 1/0;const r=t>0?n-e:e+n;return Math.max(0,Math.floor((r+1e-9*i)/i))};u=Math.min(u,t(e[0],c),t(e[1],h))}return[e[0]+c*u*i,e[1]+h*u*i]}function Et(e,t){if(t){const t=e/2.54;let i=Math.floor(t/12),n=Math.round(t-12*i);return 12===n&&(i+=1,n=0),`${i}′ ${n}″`}return`${(e/100).toFixed(2)} m`}function Ht(e,t,i=1){const n=e[0].toFixed(i),r=e[1].toFixed(i),o=t[0].toFixed(i),s=t[1].toFixed(i),a=n<o||n===o&&r<=s,[l,c,h,d]=a?[n,r,o,s]:[o,s,n,r];return`${l},${c}-${h},${d}`}function Nt(e){return e?.poly?.length>=3?e.poly:e&&null!=e.x&&null!=e.y&&null!=e.w&&null!=e.h?[[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h]]:null}function Lt(e){const t=[];for(const i of e||[])i?.poly?.length>=3?t.push({poly:i.poly.map(e=>e.join(",")).join(" ")}):i&&null!=i.x&&null!=i.y&&null!=i.w&&null!=i.h&&t.push({rect:{x:i.x,y:i.y,w:i.w,h:i.h,rx:.03*Math.min(i.w,i.h)}});return t}function Bt(e){const t=[],i=new Set;for(const n of e||[]){const e=Nt(n);if(e)for(let n=0;n<e.length;n++){const r=e[n],o=e[(n+1)%e.length],s=Ht(r,o,5);i.has(s)||(i.add(s),t.push([r[0],r[1],o[0],o[1]]))}}return t}function qt(e,t,i,n={}){let r=null,o=i;for(const i of Bt(t)){const[t,s,a,l]=i,c=a-t,h=l-s,d=c*c+h*h;if(!d)continue;let u=((e[0]-t)*c+(e[1]-s)*h)/d;u=Math.max(0,Math.min(1,u));const p=[t+u*c,s+u*h],m=Math.hypot(e[0]-p[0],e[1]-p[1]);if(m<o){o=m;let e=180*Math.atan2(h,c)/Math.PI;if(e>=90?e-=180:e<-90&&(e+=180),n.step&&n.step>0){const i=Math.sqrt(d),o=Math.min(Math.max(n.length||0,0)/2,i/2);let a=Math.round(u*i/n.step)*n.step;Math.abs(u*i-i/2)<=n.step/2&&(a=i/2),a=Math.max(o,Math.min(i-o,a));const l=a/i;r={x:t+l*c,y:s+l*h,angle:e}}else r={x:p[0],y:p[1],angle:e}}}return r}function Wt(e,t,i){let n=null,r=1/0;for(let o=0;o<t.length;o++){const[s,a]=t[o],[l,c]=t[(o+1)%t.length],h=l-s,d=c-a,u=h*h+d*d;if(!u)continue;let p=((e[0]-s)*h+(e[1]-a)*d)/u;p=Math.max(0,Math.min(1,p));const m=Math.hypot(e[0]-(s+p*h),e[1]-(a+p*d));if(m>=r)continue;r=m;const _=Math.sqrt(u),f=(i>0?Math.max(0,Math.min(_,Math.round(p*_/i)*i)):p*_)/_;n=[s+f*h,a+f*d]}return n}function jt(e,t,i,n,r,o=1){const s=t*Math.PI/180,a=[Math.cos(s),Math.sin(s)];let l=null,c=o;for(const t of Bt(n)){const i=[[t[0],t[1]],[t[2],t[3]]],n=t=>Math.abs(a[0]*(t[1]-e[1])-a[1]*(t[0]-e[0]));if(n(i[0])>o||n(i[1])>o)continue;const r=(i[0][0]-e[0])*a[0]+(i[0][1]-e[1])*a[1],s=(i[1][0]-e[0])*a[0]+(i[1][1]-e[1])*a[1],h=Math.min(r,s),d=Math.max(r,s),u=h>0?h:d<0?-d:0;u<c&&(c=u,l=[h,d])}if(!l)return null;const[h,d]=l,u=i/2,p=Math.max(0,-u-h),m=Math.max(0,d-u),_=t=>[e[0]+a[0]*t,e[1]+a[1]*t],f=(h+d)/2;return{wallA:_(h),wallB:_(d),sideA:p,sideB:m,midA:_((h-u)/2),midB:_((u+d)/2),wallCenter:_(f),centered:Math.abs(f)<=r}}function Ut(e,t,i=!1,n){if("passage"===e)return 1;if(null==t||"unavailable"===t||"unknown"===t)return"window"===e?0:1;const r="string"==typeof n?n.trim()?Number(n):NaN:Number(n),o=null!=n&&Number.isFinite(r)?Math.max(0,Math.min(1,r/100)):function(e){return["on","open","home","detected","playing","cleaning"].includes(String(e))}(t)?1:0;return i?1-o:o}function Vt(e){const t=Number.isFinite(e)?Math.max(0,Math.min(1,e)):0;return Math.min(1,Math.max(0,.05*Math.round(t/.05)))}function Gt(e,t){return(Number.isFinite(e)&&e>0?e:0)*(Number.isFinite(t)?Math.max(0,Math.min(1,t)):0)}function Kt(e){return"passage"===e.type?[]:[e.contact,e.lock].filter(e=>"string"==typeof e&&e.length>0)}function Yt(e,t,i=200){const n=t.trim().toLowerCase();return(n?e.filter(e=>e.label.toLowerCase().includes(n)||e.value.toLowerCase().includes(n)):e).slice(0,Math.max(0,i))}function Xt(e,t,i=.001){return Math.abs(e[0]-t[0])<i&&Math.abs(e[1]-t[1])<i}function Zt(e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){const[o,s]=t[n],[a,l]=t[r];s>e[1]!=l>e[1]&&e[0]<(a-o)*(e[1]-s)/(l-s)+o&&(i=!i)}return i}function Jt(e,t,i){const n=i[0]-t[0],r=i[1]-t[1],o=n*n+r*r;let s=o?((e[0]-t[0])*n+(e[1]-t[1])*r)/o:0;return s=Math.max(0,Math.min(1,s)),Math.hypot(e[0]-(t[0]+s*n),e[1]-(t[1]+s*r))}function Qt(e,t){if(!t||t.length<2)return null;let i=null,n=1/0;for(let r=0;r<t.length;r++){const o=t[r],s=t[(r+1)%t.length],a=s[0]-o[0],l=s[1]-o[1],c=a*a+l*l;let h=c?((e[0]-o[0])*a+(e[1]-o[1])*l)/c:0;h=Math.max(0,Math.min(1,h));const d=[o[0]+h*a,o[1]+h*l],u=Math.hypot(e[0]-d[0],e[1]-d[1]);u<n&&(n=u,i=d)}return i}function ei(e,t,i=1e-6){if(!t||t.length<2)return!1;for(let n=0;n<t.length;n++)if(Jt(e,t[n],t[(n+1)%t.length])<=i)return!0;return!1}function ti(e,t,i=1e-6){return!(!t||t.length<3)&&(!ei(e,t,i)&&Zt(e,t))}function ii(e,t,i){return(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0])}function ni(e,t,i,n,r=1e-9){const o=ii(i,n,e),s=ii(i,n,t),a=ii(e,t,i),l=ii(e,t,n);return(o>r&&s<-r||o<-r&&s>r)&&(a>r&&l<-r||a<-r&&l>r)}function ri(e,t=24){const i=e.map(e=>e[0]),n=e.map(e=>e[1]),r=Math.min(...i),o=Math.max(...i),s=Math.min(...n),a=Math.max(...n),l=Math.max(o-r,a-s)||1;let c=0,h=0,d=0;for(let t=0;t<e.length;t++){const i=e[t],n=e[(t+1)%e.length],r=i[0]*n[1]-n[0]*i[1];c+=r,h+=(i[0]+n[0])*r,d+=(i[1]+n[1])*r}const u=Math.abs(c)>1e-9?[h/(3*c),d/(3*c)]:[(r+o)/2,(s+a)/2],p=(t,i)=>{const n=((t,i)=>{if(!Zt([t,i],e))return-1/0;let n=1/0;for(let r=0;r<e.length;r++){const o=e[r],s=e[(r+1)%e.length];n=Math.min(n,Mn([t,i],[o[0],o[1],s[0],s[1]]))}return n})(t,i);return n===-1/0?n:n-.08*Math.hypot(t-u[0],i-u[1])-1e-4*l};let m=null,_=-1/0;for(let e=1;e<t;e++)for(let i=1;i<t;i++){const n=r+(o-r)*e/t,l=s+(a-s)*i/t,c=p(n,l);c>_&&(_=c,m=[n,l])}if(m){const[e,i]=m,n=(o-r)/t,l=(a-s)/t;for(let t=-4;t<=4;t++)for(let r=-4;r<=4;r++){const o=e+n*t/4,s=i+l*r/4,a=p(o,s);a>_&&(_=a,m=[o,s])}}return m||oi(e)||e[0]}function oi(e,t=1e-6){if(!e||e.length<3)return null;const i=e.length,n=[e.reduce((e,t)=>e+t[0],0)/i,e.reduce((e,t)=>e+t[1],0)/i];if(ti(n,e,t))return n;for(let n=0;n<i;n++){const r=e[(n-1+i)%i],o=e[n],s=e[(n+1)%i],a=[(r[0]+o[0]+s[0])/3,(r[1]+o[1]+s[1])/3];if(ti(a,e,t))return a}for(let n=0;n<i;n++)for(let r=n+2;r<i;r++){const i=[(e[n][0]+e[r][0])/2,(e[n][1]+e[r][1])/2];if(ti(i,e,t))return i}return null}function si(e,t,i){let n=!0;for(const r of e){if(ti(r,t,i))return!0;ei(r,t,i)||(n=!1)}if(n){const n=oi(e,i);return!!n&&ti(n,t,i)}return!1}function ai(e,t,i=1e-6){if(!e||!t||e.length<3||t.length<3)return!1;for(let i=0;i<t.length;i++)for(let n=0;n<e.length;n++)if(ni(t[i],t[(i+1)%t.length],e[n],e[(n+1)%e.length]))return!1;for(const n of t)if(!ti(n,e,i)&&!ei(n,e,i))return!1;const n=oi(t,i);return!!n&&ti(n,e,i)&&hi(t)<hi(e)-i}function li(e,t,i=1e-6){if(!e||!t||e.length<3||t.length<3)return!1;for(let i=0;i<e.length;i++)for(let n=0;n<t.length;n++)if(ni(e[i],e[(i+1)%e.length],t[n],t[(n+1)%t.length]))return!0;return!ai(e,t,i)&&!ai(t,e,i)&&(si(e,t,i)||si(t,e,i))}function ci(e,t,i=1e-6){const n=t.filter(t=>ai(e,t,i));return n.filter(e=>!n.some(t=>t!==e&&ai(t,e,i)))}function hi(e){if(!e||e.length<3)return 0;let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return Math.abs(t)/2}function di(e){return[[...e.map(e=>[e[0],e[1]]),[e[0][0],e[0][1]]]]}function ui(e,t){if(!e||!t||e.length<3||t.length<3)return null;const i=Mt(di(e),di(t));if(1!==i.length)return null;if(1!==i[0].length)return null;const n=i[0][0].slice(0,-1).map(e=>[e[0],e[1]]);return n.length>=3?n:null}function pi(e,t,i){for(let n=0;n<e.length;n++)if(Jt(t,e[n],e[(n+1)%e.length])<=i)return n;return-1}function mi(e,t){const i=[];for(const n of e)i.length&&Xt(i[i.length-1],n,t)||i.push(n);return i.length>1&&Xt(i[0],i[i.length-1],t)&&i.pop(),i}function _i(e,t,i=1e-6){if(!e||e.length<3||!t||t.length<2)return null;const n=t[0],r=t[t.length-1];if(Xt(n,r,i))return null;const o=pi(e,n,i),s=pi(e,r,i);if(o<0||s<0)return null;const a=t.slice(1,-1);for(const t of a)if(!ti(t,e,i))return null;for(let i=0;i<t.length-1;i++)for(let n=0;n<e.length;n++)if(ni(t[i],t[i+1],e[n],e[(n+1)%e.length]))return null;for(let e=0;e<t.length-1;e++)for(let i=e+2;i<t.length-1;i++)if(ni(t[e],t[e+1],t[i],t[i+1]))return null;if(2===t.length&&!ti([(n[0]+r[0])/2,(n[1]+r[1])/2],e,i))return null;const l=(t,n,r,o)=>{const s=[t];let a=(n+1)%e.length;for(let t=0;t<=e.length&&(s.push(e[a]),a!==o);t++)a=(a+1)%e.length;return s.push(r),mi(s,i)};let c,h;if(o===s){const s=mi([...t],i);if(s.length<3||hi(s)<=i)return null;const a=[];for(let i=0;i<e.length;i++)if(a.push(e[i]),i===o){const i=(e[(o+1)%e.length][0]-e[o][0])*(r[0]-n[0])+(e[(o+1)%e.length][1]-e[o][1])*(r[1]-n[1])>=0?t:[...t].reverse();for(const e of i)a.push(e)}c=mi(a,i),h=s}else c=mi([...l(n,o,r,s),...[...a].reverse()],i),h=mi([...l(r,s,n,o),...a],i);return c.length<3||h.length<3||hi(c)<=i||hi(h)<=i||Math.abs(hi(c)+hi(h)-hi(e))>Math.max(i,1e-6*hi(e))?null:[c,h]}function fi(e,t,i){const[n,r]=e.split(":");return"device"===n?r:"entity"===n?"lg_"+r:t&&t.startsWith("v_")?t:i()}function gi(e){return e.length?Math.round(e.reduce((e,t)=>e+t,0)/e.length):null}function vi(e,t){if(t>e[2]/e[3]){const i=e[3],n=e[3]*t;return{x:e[0]-(n-e[2])/2,y:e[1],w:n,h:i}}const i=e[2],n=e[2]/t;return{x:e[0],y:e[1]-(n-e[3])/2,w:i,h:n}}function yi(e,t,i,n){if(e.length<2)return;const r=t.x+n,o=t.x+t.w-n,s=t.y+n,a=t.y+t.h-n;for(let t=0;t<60;t++){let t=!1;for(let n=0;n<e.length;n++)for(let r=n+1;r<e.length;r++){const o=e[r].x-e[n].x,s=e[r].y-e[n].y,a=Math.hypot(o,s)||.001;if(a<i){const l=(i-a)/2,c=o/a,h=s/a;e[n].x-=c*l,e[n].y-=h*l,e[r].x+=c*l,e[r].y+=h*l,t=!0}}for(const t of e)t.x=Math.max(r,Math.min(o,t.x)),t.y=Math.max(s,Math.min(a,t.y));if(!t)break}}function bi(e){if(!e)return null;const t=e.trim();return/^(https?:)?\/\//i.test(t)||t.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(t)?/^[a-z][\w+.-]*:/i.test(t)&&!/^https?:/i.test(t)?null:t:null}const wi=["badge","icon_ripple","value","static_icon"];function ki(e){return"ripple"===e?"icon_ripple":wi.includes(e)?e:"badge"}const xi=["info","more-info","toggle","run","none"],$i=["custom","lqi","light","temp"],Si=["none","lqi","light","temp","custom"],Mi=new Set(["garage","door","gate"]),Ci=["automation","script","scene"];const Ti="—",Ri="{}";function Di(e){const t=String(e??"").trim();if(!t)return null;let i=t,n="";const r=t.indexOf(":");if(r>=0)i=t.slice(0,r).trim(),n=t.slice(r+1).trim();else{const e=t.split(".");e.length>2&&(i=e.slice(0,2).join("."),n=e.slice(2).join("."))}return/^[a-z0-9_]+\.[a-z0-9_]+$/.test(i)?r>=0&&!n||n&&!/^[a-zA-Z0-9_.-]+$/.test(n)?null:n?{entity:i,attr:n}:{entity:i}:null}function zi(e,t){const i=String(e??"").trim(),n=String(t??"").trim(),r=Di(n?`${i}:${n}`:i);return r?`{${r.entity}${r.attr?`:${r.attr}`:""}}`:""}function Ai(e,t,i){const n=String(t??"").trim();if(!n)return null;const r=e?.states?.[n];if(!r)return null;const o=String(i??"").trim(),s=e=>e.slice(0,60);if(o){const t=function(e){if(null==e)return null;if(Array.isArray(e)){const t=e.map(e=>null==e?"":String(e)).join(", ");return t?t.slice(0,60):null}if("object"==typeof e)return null;const t=String(e);return""===t?null:t.slice(0,60)}(r.attributes?.[o]);if(null===t)return null;const i=e?.formatEntityAttributeValue;if("function"==typeof i)try{const t=i.call(e,r,o);if("string"==typeof t&&""!==t)return{text:s(t),formatted:!0}}catch{}return{text:t,formatted:!1}}const a=r.state;if(null==a||""===a)return null;const l=e?.formatEntityState;if("function"==typeof l)try{const t=l.call(e,r);if("string"==typeof t&&""!==t)return{text:s(t),formatted:!0}}catch{}return{text:s(String(a)),formatted:!1}}function Pi(e,t,i){const n=String(t??"").trim(),r=String(i??"").trim()||n;if(!r)return e.text;const o=e.formatted&&n?function(e,t){if(!t)return e;const i=e.replace(/\s+$/,"");return i.endsWith(t)?i.slice(0,i.length-t.length).replace(/\s+$/,""):e}(e.text,n):e.text;return`${o} ${r}`}function Oi(e,t){const i=(t?.entity||"").trim();if(!i)return"";const n=e?.states?.[i],r=n?.state;if(!n||null==r||""===r||"unavailable"===r||"unknown"===r)return Ti;const o=(t?.attr||"").trim(),s=Ai(e,i,o||null);if(null===s)return Ti;return Pi(s,o?"":String(n.attributes?.unit_of_measurement??"").trim(),t?.unit)}function Fi(e,t,i,n=()=>!0){const r=e??"";let o=!1;const s=r.replace(/\{([^{}\r\n]+)\}/g,(e,t)=>{const r=Di(t);return r?(o=!0,n(r.entity||"")?Oi(i,r):Ti):e});if(o)return s;const a=(t?.entity||"").trim();if(!a)return r;if(!n(a)){const e=r.indexOf(Ri);return e>=0?r.slice(0,e)+Ti+r.slice(e+2):r?`${r} ${Ti}`:Ti}const l=Oi(i,t),c=r.indexOf(Ri);return c>=0?r.slice(0,c)+l+r.slice(c+2):r?`${r} ${l}`:l}const Ii=20;function Ei(e){const t=Number(e?.scale);if(Number.isFinite(t)&&t>0)return Math.min(20,Math.max(.15,t));return{s:.7,m:1,l:1.5}[String(e?.size??"")]??1}function Hi(e,t){if(!t)return e;let i=e;for(const[e,n]of Object.entries(t))i=i.split("{"+e+"}").join(String(n));return i}const Ni="#55606c",Li=.55,Bi=20,qi=25,Wi={c:"#607d8b",a:.18};function ji(e,t=Wi){const i=e&&"object"==typeof e?e:null,n=i?.a;return{c:Dt(i?.c,t.c),a:"number"==typeof n&&Number.isFinite(n)?Math.min(1,Math.max(0,n)):t.a}}function Ui(e,t){const i=ji(e),n=t?.settings?.custom_fill;return n&&"object"==typeof n?ji(n,i):i}function Vi(e){const t=e?.settings||{},i=!e?.plan_url,n="glow"===t.fill_mode;return{showBorders:t.show_borders??i,showNames:t.show_names??i,color:Dt(t.room_color,Ni),opacity:"number"==typeof t.room_opacity?Math.min(1,Math.max(0,t.room_opacity)):.55,fill:["lqi","light","temp","custom"].includes(t.fill_mode)?t.fill_mode:"none",customFill:ji(t.custom_fill),glow:"boolean"==typeof t.glow_enabled?t.glow_enabled:n,tempMin:"number"==typeof t.temp_min?t.temp_min:20,tempMax:"number"==typeof t.temp_max?t.temp_max:25,showLqi:"boolean"==typeof t.show_lqi?t.show_lqi:null,cardFontScale:"number"==typeof t.card_font_scale&&t.card_font_scale>0?Math.min(3,Math.max(.5,t.card_font_scale)):1,labelTemp:!0===t.label_temp,labelHum:!0===t.label_hum,labelLqi:!0===t.label_lqi,labelLight:!0===t.label_light,bgColor:Dt(t.bg_color,null),hideDecor:!0===t.hide_decor,hideOpenings:!0===t.hide_openings}}function Gi(e,t){if(t.bgColor)return t.bgColor;const i=e?.bg_color;return Dt(i,"")}function Ki(e){return!1!==e?.show_room_tooltip}const Yi={light_on:{c:"#ffd45c",a:.18},light_off:{c:"#9aa0a6",a:.14},light_none:{c:"#6b7480",a:0},temp_cold:{c:"#4fc3f7",a:.18},temp_ok:{c:"#66d17a",a:.18},temp_hot:{c:"#ffd45c",a:.18},lqi_low:{c:"#f25a4a",a:.18},lqi_high:{c:"#4bd28f",a:.18},glow_base:{c:"#0d1b2a",a:.5},glow_light:{c:"#ffd9a0",a:.85},wall_fill:{c:"#ffffff",a:1}};function Xi(e){const t={},i=e?.fill_colors||{};for(const e of Object.keys(Yi)){const n=Yi[e],r=i[e];t[e]={c:Dt(r?.c,n.c),a:r&&"number"==typeof r.a?Math.min(1,Math.max(0,r.a)):n.a}}return t}function Zi(e,t,i){const n=Math.min(1,Math.max(0,i)),r=[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),o=[1,3,5].map(e=>parseInt(t.slice(e,e+2),16)),s=r.map((e,t)=>Math.round(e+(o[t]-e)*n));return"#"+s.map(e=>e.toString(16).padStart(2,"0")).join("")}function Ji(e,t,i,n,r,o,s,a=Wi){const l=function(e,t,i,n,r,o,s,a=Wi){if("custom"===e)return ji(a);if("lqi"===e){if(null==t)return null;const e=(t-40)/140;return{c:Zi(s.lqi_low.c,s.lqi_high.c,e),a:s.lqi_low.a+(s.lqi_high.a-s.lqi_low.a)*Math.min(1,Math.max(0,e))}}if("light"===e)return"none"===i?s.light_none.a>0?s.light_none:null:"on"===i?s.light_on:s.light_off;if("temp"===e){if(null==n)return null;const e=Math.min(r,o),t=Math.max(r,o);return n<e?s.temp_cold:n>t?s.temp_hot:s.temp_ok}return null}(e,t,i,n,r,o,s,a);return l?{color:l.c,opacity:l.a,mode:e}:null}const Qi={blind:["mdi:blinds","mdi:blinds-open"],shade:["mdi:blinds","mdi:blinds-open"],shutter:["mdi:window-shutter","mdi:window-shutter-open"],curtain:["mdi:curtains-closed","mdi:curtains"],window:["mdi:window-closed","mdi:window-open"],awning:["mdi:awning-outline","mdi:awning"],door:["mdi:door-closed","mdi:door-open"],garage:["mdi:garage","mdi:garage-open"],gate:["mdi:gate","mdi:gate-open"],damper:["mdi:circle-slice-8","mdi:circle-outline"]},en=[["mdi:roller-shade-closed","mdi:roller-shade"],["mdi:blinds-horizontal-closed","mdi:blinds-horizontal"],["mdi:garage-variant","mdi:garage-open-variant"],["mdi:door","mdi:door-open"]];function tn(e){for(const t of[...Object.values(Qi),...en])if(e===t[0]||e===t[1])return t;return null}function nn(e,t,i,n,r){if(!n||"unavailable"===n||"unknown"===n)return e;if(r){const i="cover"===t?tn(e):null;return i?"closed"===n?i[0]:i[1]:e}if("binary_sensor"===t){if("door"===i)return"on"===n?"mdi:door-open":"mdi:door-closed";if("window"===i)return"on"===n?"mdi:window-open":"mdi:window-closed";if("garage_door"===i)return"on"===n?"mdi:garage-open-variant":"mdi:garage-variant"}if("cover"===t){const t=Qi[String(i||"")];if(t)return"closed"===n?t[0]:t[1];const r=tn(e);return r?"closed"===n?r[0]:r[1]:e}return"lock"===t?"locked"===n?"mdi:lock":"mdi:lock-open-variant":"light"===t&&"mdi:lightbulb"===e&&"on"===n?"mdi:lightbulb-on":e}function rn(e){const t=Math.min(4e4,Math.max(1e3,e))/100,i=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592),n=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492),r=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307,o=e=>Math.round(Math.min(255,Math.max(0,e)));return[o(i),o(n),o(r)]}const on=1/2.2;function sn(e){const t=/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(e);return t?"#"+t.slice(1).map(e=>Math.min(255,Number(e)).toString(16).padStart(2,"0")).join(""):null}function an(e){if(!e||"object"!=typeof e||Array.isArray(e))return null;const t=e;if(Object.keys(t).some(e=>"c"!==e&&"bri"!==e))return null;const i=Dt(t.c,null);return i?void 0===t.bri||null===t.bri?{c:i}:"number"!=typeof t.bri||!Number.isFinite(t.bri)||t.bri<.01||t.bri>1?null:{c:i,bri:t.bri}:null}function ln(e,t,i){const n=an(t),r=e?.attributes||{},o=n?.bri??function(e){const t=e?.attributes?.brightness,i="number"==typeof t?t:"string"==typeof t&&""!==t.trim()?Number(t):Number.NaN;return Number.isFinite(i)?Math.max(0,Math.min(1,i/255)):1}(e);if(n)return{c:n.c,bri:o};const s=Pt(r.rgb_color);if(s)return{c:sn(s)||Dt(i,"#ffd9a0"),bri:o};const a=Number(r.color_temp_kelvin)||(Number(r.color_temp)>0?1e6/Number(r.color_temp):NaN);return Number.isFinite(a)&&a>0?{c:(l=rn(a),"#"+l.slice(0,3).map(e=>Math.min(255,Math.max(0,Math.round(Number(e)||0))).toString(16).padStart(2,"0")).join("")),bri:o}:{c:Dt(i,"#ffd9a0"),bri:o};var l}function cn(e,t,i){return"on"===e?.state?ln(e,t,i):null}function hn(e,t=1){const i=Math.max(0,Math.min(1,Number.isFinite(e)?e:1)),n=.7*Math.max(0,Math.min(1,Number.isFinite(t)?t:1))*(.4+.6*Math.pow(i,on));return Math.max(0,Math.min(1,n))}function dn(e){return e.startsWith("light.")||e.startsWith("switch.")}function un(e,t,i=1e-6){const n=[];if(!e||!t||e.length<3||t.length<3)return n;for(let r=0;r<e.length;r++){const o=e[r],s=e[(r+1)%e.length],a=s[0]-o[0],l=s[1]-o[1],c=Math.hypot(a,l);if(c<i)continue;const h=a/c,d=l/c;for(let e=0;e<t.length;e++){const r=t[e],s=t[(e+1)%t.length],a=Math.abs((r[0]-o[0])*d-(r[1]-o[1])*h),l=Math.abs((s[0]-o[0])*d-(s[1]-o[1])*h),u=Math.max(i,1e-6*c);if(a>u||l>u)continue;const p=(r[0]-o[0])*h+(r[1]-o[1])*d,m=(s[0]-o[0])*h+(s[1]-o[1])*d,_=Math.max(0,Math.min(p,m)),f=Math.min(c,Math.max(p,m));f-_>i&&n.push([o[0]+h*_,o[1]+d*_,o[0]+h*f,o[1]+d*f])}}return n}function pn(e,t,i=1e-6){const n=[];for(const r of e){const e=[r[0],r[1]],o=[r[2],r[3]],s=o[0]-e[0],a=o[1]-e[1],l=Math.hypot(s,a);if(l<i)continue;const c=s/l,h=a/l,d=[];for(const n of t){const t=Math.abs((n[0]-e[0])*h-(n[1]-e[1])*c),r=Math.abs((n[2]-e[0])*h-(n[3]-e[1])*c),o=Math.max(i,1e-6*l);if(t>o||r>o)continue;const s=(n[0]-e[0])*c+(n[1]-e[1])*h,a=(n[2]-e[0])*c+(n[3]-e[1])*h,u=Math.max(0,Math.min(s,a)),p=Math.min(l,Math.max(s,a));p-u>i&&d.push([u,p])}if(!d.length){n.push([e[0],e[1],o[0],o[1]]);continue}d.sort((e,t)=>e[0]-t[0]);let u=0;for(const[t,r]of d)t-u>i&&n.push([e[0]+c*u,e[1]+h*u,e[0]+c*t,e[1]+h*t]),u=Math.max(u,r);l-u>i&&n.push([e[0]+c*u,e[1]+h*u,o[0],o[1]])}return n}function mn(e,t,i=1e-6){const n=[];for(let t=0;t<e.length;t++){const i=e[t],r=e[(t+1)%e.length];n.push([i[0],i[1],r[0],r[1]])}return pn(n,t,i)}const _n=864e5,fn=576e5;function gn(e){const t=new Set,i=e=>{if("string"!=typeof e||!e)return;const i=vn(e);i.startsWith("/api/houseplan/content/")&&t.add(i)};for(const t of e?.spaces||[]){i(t?.plan_url);for(const e of t?.markers||[])for(const t of e?.pdfs||[])i(t?.url)}for(const t of e?.markers||[])for(const e of t?.pdfs||[])i(e?.url);return t}function vn(e){return e?e.startsWith("/houseplan_files/plans/")?"/api/houseplan/content/plans/_/"+e.slice(23):e.startsWith("/houseplan_files/files/")?"/api/houseplan/content/files/"+e.slice(23):e:""}function yn(e,t){const i=t?.settings?.fill_mode;return"none"===i||"lqi"===i||"light"===i||"temp"===i||"custom"===i?i:e}function bn(e,t){const i=t?.settings;return"boolean"==typeof i?.glow?i.glow:"glow"===i?.fill_mode||e}function wn(e,t,i,n){if(!t||!i||t===i)return e;const r="/files/"+t+"/",o="/files/"+i+"/";return e.map(e=>{if(!e.url.includes(r))return e;const t=e.url.split(r)[1]||"",[i,s]=[t.split("?")[0],t.includes("?")?"?"+t.split("?")[1]:""];if(n){const t=n[decodeURIComponent(i)]??n[i];return t?{...e,url:e.url.split(r+i)[0]+o+encodeURIComponent(t)+s}:e}return{...e,url:e.url.split(r).join(o)}})}function kn(e,t=1){const i=Number(e);return Number.isFinite(i)&&i>0?Math.min(3,Math.max(.5,i)):t}function xn(e,t,i){let n=null,r=null;for(const o of t){if(!(Math.abs(o[0]-e[0])<1e-6&&Math.abs(o[1]-e[1])<1e-6)){if(Math.abs(o[0]-e[0])<=i){const t=Math.abs(o[1]-e[1]);t>1e-6&&(!n||t<n.d)&&(n={d:t,c:o})}if(Math.abs(o[1]-e[1])<=i){const t=Math.abs(o[0]-e[0]);t>1e-6&&(!r||t<r.d)&&(r={d:t,c:o})}}}const o=[];return n&&o.push({axis:"x",at:n.c[0],from:n.c}),r&&o.push({axis:"y",at:r.c[1],from:r.c}),o}function $n(e,t){let i=180*Math.atan2(t[1]-e[1],t[0]-e[0])/Math.PI;return i<0&&(i+=360),i}function Sn(e,t=.5){const i=(e%45+45)%45;return i<=t||45-i<=t}function Mn(e,t){const i=t[2]-t[0],n=t[3]-t[1],r=i*i+n*n;if(!r)return Math.hypot(e[0]-t[0],e[1]-t[1]);let o=((e[0]-t[0])*i+(e[1]-t[1])*n)/r;return o=Math.max(0,Math.min(1,o)),Math.hypot(e[0]-(t[0]+o*i),e[1]-(t[1]+o*n))}const Cn=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);function Tn(e,t){return"alarm_control_panel"===e||"siren"===e||"binary_sensor"===e&&!!t&&Cn.has(t)}function Rn(e){if(!e)return null;const t=e.indexOf("#");if(t<=0)return null;const i=e.slice(0,t),n=e.slice(t+1);if(!n)return null;if(n.startsWith("@")){const e=n.slice(1);return e?{space:i,area:null,roomId:e}:null}return{space:i,area:n,roomId:null}}function Dn(e,t,i){const n=i/t;return hi(e)*n*n/1e4}function zn(e,t){return t?`${Math.round(10.7639*e)} ft²`:`${(Math.round(10*e)/10).toFixed(1)} m²`}function An(e){const t=e%360;return t<0?t+360:t}function Pn(e,t){const i=function(e,t){return An(e+t)}(e,t)*Math.PI/180;return[Math.sin(i),-Math.cos(i)]}const On=Object.freeze({dawn:Object.freeze({top:"#aabdd1",bottom:"#e8c8b7",horizon:"rgba(255,201,156,.56)",sun:"rgba(255,188,125,.78)",vignette:"rgba(65,72,99,.21)",outlineNear:"rgba(74,57,61,.25)",outlineMid:"rgba(255,238,224,.40)",outlineFar:"rgba(255,224,202,.18)"}),day:Object.freeze({top:"#dce9ef",bottom:"#cbdce3",horizon:"rgba(255,245,220,.45)",sun:"rgba(255,239,190,.72)",vignette:"rgba(65,91,105,.16)",outlineNear:"rgba(45,62,71,.28)",outlineMid:"rgba(255,255,255,.42)",outlineFar:"rgba(255,255,255,.20)"}),dusk:Object.freeze({top:"#48536c",bottom:"#9a7380",horizon:"rgba(242,156,114,.34)",sun:"rgba(255,167,113,.55)",vignette:"rgba(20,26,44,.39)",outlineNear:"rgba(238,219,225,.40)",outlineMid:"rgba(229,207,218,.26)",outlineFar:"rgba(215,190,205,.12)"}),night:Object.freeze({top:"#111a27",bottom:"#1f2f3e",horizon:"rgba(79,120,151,.16)",sun:"rgba(169,208,231,0)",vignette:"rgba(3,8,14,.58)",outlineNear:"rgba(218,238,249,.56)",outlineMid:"rgba(174,215,238,.30)",outlineFar:"rgba(136,194,226,.14)"})}),Fn=e=>"number"==typeof e&&Number.isFinite(e),In=(e,t,i)=>Math.min(i,Math.max(t,e));function En(e){return e.elevation<=-6?"night":e.elevation>=6?"day":e.rising?"dawn":"dusk"}function Hn(e){const t=(Math.floor(Number(e)||0)%1440+1440)%1440;return t>=300&&t<480?"dawn":t>=480&&t<1080?"day":t>=1080&&t<1260?"dusk":"night"}function Nn(e){const t=En(e),i=e.azimuth*Math.PI/180;return{sunX:50-42*Math.sin(i),sunY:78-In(e.elevation,0,90)/90*64,sunOpacity:"night"===t?0:In((e.elevation+6)/12,0,1)}}function Ln(e){const t=(Math.floor(Number(e)||0)%1440+1440)%1440;if(t<300||t>=1260)return{sunX:50,sunY:78,sunOpacity:0};const i=(t-300)/960,n=(t-300)/120,r=(1260-t)/120;return{sunX:8+84*i,sunY:78-64*Math.sin(i*Math.PI),sunOpacity:Math.max(.18,Math.min(n,r,1))}}function Bn(e,t=new Date){const i=function(e){const t=e?.states?.["sun.sun"]?.attributes;return t&&Fn(t.azimuth)&&Fn(t.elevation)&&"boolean"==typeof t.rising?{azimuth:An(t.azimuth),elevation:t.elevation,rising:t.rising}:null}(e);if(i)return{phase:En(i),source:"sun",...Nn(i)};const n="number"==typeof t?t:function(e=new Date){return 60*e.getHours()+e.getMinutes()}(t);return{phase:Hn(n),source:"clock",...Ln(n)}}function qn(e){return`${e.source}|${e.phase}|${e.sunX.toFixed(2)}|${e.sunY.toFixed(2)}|`+e.sunOpacity.toFixed(3)}const Wn=[[-90,"#070c14"],[-12,"#070c14"],[-4,"#131a28"],[0,"#4a3527"],[10,"#e8ddcf"],[30,"#ffffff"],[90,"#ffffff"]],jn=e=>Math.min(1,Math.max(0,e));function Un(e,t,i=6){const n=e.angle*Math.PI/180,r=[Math.sin(n),-Math.cos(n)],o=n=>{const o=[e.x+r[0]*i*n,e.y+r[1]*i*n];return t.find(e=>e.poly.length>=3&&Zt(o,e.poly))||null},s=o(1),a=o(-1);return s&&a?null:s||a?s?{normal:[-r[0],-r[1]],roomId:s.id}:{normal:r,roomId:a.id}:null}function Vn(e,t,i){return i>0&&e[0]*t[0]+e[1]*t[1]>.05}function Gn(e,t,i,n){return[[e[0],e[1]],[t[0],t[1]],[t[0]+i[0]*n,t[1]+i[1]*n],[e[0]+i[0]*n,e[1]+i[1]*n]]}function Kn(e,t){try{const i=Ct([[...e.map(e=>[e[0],e[1]]),[e[0][0],e[0][1]]]],[[...t.map(e=>[e[0],e[1]]),[t[0][0],t[0][1]]]]),n=[];for(const e of i){const t=e?.[0];!Array.isArray(t)||t.length<4||n.push(t.slice(0,t.length-1).map(e=>[e[0],e[1]]))}return n}catch{return[]}}function Yn(e,t,i,n,r,o,s){if(!(n>0))return[];const a=Pn(i,r),l=[-a[0],-a[1]],c=function(e){const t=Math.min(90,Math.max(0,e));return.7*(.8+1.7*Math.pow(1-t/90,1.6))}(n),h=[];for(const i of t){if(!(i.length>0))continue;const t=Un(i,e);if(!t||!Vn(t.normal,a,n))continue;const r=e.find(e=>e.id===t.roomId);if(!r)continue;const d=o&&o[t.roomId]||r.poly,u=i.angle*Math.PI/180,p=i.length/2,m=[-t.normal[0],-t.normal[1]],_=Math.max(0,s?.[i.id]||0),f=i.x+m[0]*_/2,g=i.y+m[1]*_/2,v=Math.cos(u)*p,y=Math.sin(u)*p,b=[f-v,g-y],w=[f+v,g+y],k=c*i.length,x=Kn(Gn(b,w,l,k),d);if(!x.length)continue;const $=l[0]*m[0]+l[1]*m[1];h.push({openingId:i.id,roomId:t.roomId,polys:x,a:b,b:w,dir:l,len:k,normal:m,depth:k*$})}return h}const Xn=e=>"number"==typeof e&&Number.isInteger(e)&&e>=0&&e<=359?e:null;function Zn(e,t){const i=Xn(t?.north_deg);return null!==i?i:Xn(e?.north_deg)}function Jn(e,t){const i=e=>"static"===e||"daynight"===e?e:null;return i(t?.bg_mode)??i(e?.bg_mode)??"static"}function Qn(e,t){const i=t?.sun_rays;return"boolean"==typeof i?i:!0===e?.sun_rays}function er(e){const t=e?.states?.["sun.sun"]?.attributes,i=Number(t?.azimuth),n=Number(t?.elevation);return Number.isFinite(i)&&Number.isFinite(n)?{azimuth:i,elevation:n}:null}const tr=["dawn","day","dusk","night"];function ir(e){if(!e)return"";const t=On[e.phase];return[`--hp-day-cycle-outline-near:${t.outlineNear}`,`--hp-day-cycle-outline-mid:${t.outlineMid}`,`--hp-day-cycle-outline-far:${t.outlineFar}`].join(";")}function nr(e,t=1){if(!e)return V;const i=[`--hp-day-cycle-sun-x:${e.sunX.toFixed(2)}%`,`--hp-day-cycle-sun-y:${e.sunY.toFixed(2)}%`,`--hp-day-cycle-sun-opacity:${e.sunOpacity.toFixed(3)}`,`opacity:${Math.min(1,Math.max(0,t)).toFixed(4)}`].join(";");return W`<div class="hp-day-cycle-env" aria-hidden="true"
      data-day-cycle-phase=${e.phase} data-day-cycle-source=${e.source}
      style=${i}>
    ${tr.map(t=>{const i=On[t],n=`background:radial-gradient(ellipse at 50% 88%, ${i.horizon} 0%, transparent 54%),linear-gradient(180deg, ${i.top} 0%, ${i.bottom} 100%);box-shadow:inset 0 0 90px ${i.vignette}`;return W`<div class="hp-day-cycle-bg phase-${t} ${t===e.phase?"active":""}"
          data-day-cycle-layer=${t} style=${n}>
        <div class="hp-day-cycle-sun" style="background:radial-gradient(circle, ${i.sun} 0%, transparent 67%)"></div>
      </div>`})}
  </div>`}const rr={color:"#607d8b",opacity:1,widthCm:3.6,fill:!1,fillColor:"#607d8b",fillOpacity:.25},or=(e,t=1)=>{const i=Number(e);return Number.isFinite(i)?Math.min(1,Math.max(0,i)):t},sr=e=>{let t=Number(e);return Number.isFinite(t)?(t=(t%360+360)%360,t>180?t-360:t):0};function ar(e,t,i){return sr(t)?[e.x,e.y]:i([e.x,e.y])}function lr(e,t,i,n){const r=Math.abs(i[0]-t[0]),o=Math.abs(i[1]-t[1]);return"line"===e?Math.hypot(r,o)>=n:r>=n&&o>=n}const cr=(e,t,i)=>{const n=Number(e),r=Number.isFinite(t)&&t>0?t:5;return Number.isFinite(n)&&n>0?n/r*i:0},hr=(e,t,i)=>{const n=Number(e),r=Number.isFinite(t)&&t>0?t:5;return Number.isFinite(n)&&i>0?n/i*r:0},dr=(e,t,i,n=rr.widthCm)=>{const r=Number(e?.width_cm);if(Number.isFinite(r)&&r>0)return r;const o=Number(e?.width);return Number.isFinite(o)&&o>0?hr(o,t,i):n};function ur(e){const t=rr;return e.color===t.color&&e.opacity===t.opacity&&e.widthCm===t.widthCm&&e.fill===t.fill&&e.fillColor===t.fillColor&&e.fillOpacity===t.fillOpacity?null:{color:e.color,opacity:or(e.opacity),width_cm:Math.max(.1,Math.min(100,Number(e.widthCm)||.1)),fill:!!e.fill,fill_color:e.fillColor,fill_opacity:or(e.fillOpacity,.25)}}function pr(e,t){return{color:e.color,opacity:or(e.opacity),width_cm:Math.max(.1,Math.min(100,Number(e.widthCm)||.1)),...t?{fill:e.fill,fill_color:e.fillColor,fill_opacity:or(e.fillOpacity,.25)}:{}}}function mr(e){const t=e.x+e.w/2,i=e.y+e.h/2,n=sr(e.angle)*Math.PI/180,r=Math.cos(n),o=Math.sin(n),s=(e,n)=>{const s=e-t,a=n-i;return[t+s*r-a*o,i+s*o+a*r]};return[s(e.x,e.y),s(e.x+e.w,e.y),s(e.x+e.w,e.y+e.h),s(e.x,e.y+e.h)]}function _r(e){const t=mr(e),i=(e,t)=>[(e[0]+t[0])/2,(e[1]+t[1])/2],n=[(t[0][0]+t[2][0])/2,(t[0][1]+t[2][1])/2];return{points:[...t,i(t[0],t[1]),i(t[1],t[2]),i(t[2],t[3]),i(t[3],t[0]),n],segments:t.map((e,i)=>({a:e,b:t[(i+1)%4]}))}}function fr(e,t,i,n,r,o,s,a){const l=sr(e.angle)*Math.PI/180,c=Math.cos(l),h=Math.sin(l),d=-Math.sin(l),u=Math.cos(l),p=e.x+e.w/2,m=e.y+e.h/2,_=t>0?-e.w/2:e.w/2,f=i>0?-e.h/2:e.h/2,g=p+_*c+f*d,v=m+_*h+f*u,y=n-g,b=r-v;let w=(y*c+b*h)*(t>0?1:-1),k=(y*d+b*u)*(i>0?1:-1),x=null;if(o){const t=w/Math.max(e.w,a),i=k/Math.max(e.h,a);x=Math.max(a/Math.max(e.w,a),a/Math.max(e.h,a),t,i),w=e.w*x,k=e.h*x}if(s>0)if(o){const t=Math.max(1,Math.round(e.w/s)),i=Math.max(1,Math.round(e.h/s));if(Math.abs(e.w-t*s)<1e-6&&Math.abs(e.h-i*s)<1e-6){const n=(e,t)=>{let i=Math.abs(e),n=Math.abs(t);for(;n;)[i,n]=[n,i%n];return Math.max(1,i)},r=1/n(t,i),o=Math.max(a/e.w,a/e.h),s=Math.max(o,Math.round((x??1)/r)*r);w=e.w*s,k=e.h*s}else{e.w>=e.h?(w=Math.round(w/s)*s,k=w*(e.h/Math.max(e.w,a))):(k=Math.round(k/s)*s,w=k*(e.w/Math.max(e.h,a)))}}else w=Math.round(w/s)*s,k=Math.round(k/s)*s;w=Math.max(a,w),k=Math.max(a,k);return{x:g+(t>0?w/2:-w/2)*c+(i>0?k/2:-k/2)*d-w/2,y:v+(t>0?w/2:-w/2)*h+(i>0?k/2:-k/2)*u-k/2,w:w,h:k,angle:sr(e.angle)||void 0}}const gr=(e,t,i)=>{const n=i[0]-t[0],r=i[1]-t[1],o=n*n+r*r;if(o<1e-12)return[...t];const s=Math.max(0,Math.min(1,((e[0]-t[0])*n+(e[1]-t[1])*r)/o));return[t[0]+n*s,t[1]+r*s]};function vr(e,t,i,n){const r=n(e);let o=null;for(const r of t.points){const t=n(r),s=Math.hypot(t[0]-e[0],t[1]-e[1]);s<=i&&(!o||s<o.d)&&(o={p:t,d:s,kind:"point",target:r})}for(const r of t.segments){const t=gr(e,r.a,r.b),s=n(t),a=Math.hypot(s[0]-e[0],s[1]-e[1]);a<=i&&(!o||a<o.d)&&(o={p:s,d:a,kind:"edge",target:t})}return o?{point:o.p,target:o.target,kind:o.kind}:{point:r,target:null,kind:"grid"}}function yr(e){return{points:e.flatMap(e=>e.points),segments:e.flatMap(e=>e.segments)}}const br=Math.tan(.25*Math.PI/180);function wr(e,t){const i=Math.abs(Number(t[0])-Number(e[0])),n=Math.abs(Number(t[1])-Number(e[1]));if(!([i,n].every(Number.isFinite)&&i>0&&n>0))return null;const r=i>=n?"horizontal":"vertical",o=Math.max(i,n),s=Math.min(i,n);return s/o>br?null:{axis:r,major:o,minor:s,angleDegrees:180*Math.atan2(s,o)/Math.PI}}function kr(e,t){const i=wr(e,t);return i?"horizontal"===i.axis?[Number(t[0]),Number(e[1])]:[Number(e[0]),Number(t[1])]:[Number(t[0]),Number(t[1])]}const xr=e=>`${e[0]},${e[1]}`,$r=(e,t)=>e[0]===t[0]&&e[1]===t[1],Sr=(e,t)=>{const i=xr(e),n=xr(t);return i<n?`${i}|${n}`:`${n}|${i}`},Mr=e=>{let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return t/2},Cr=e=>{if(e.length<3)return!1;for(let t=0;t<e.length;t++){if($r(e[t],e[(t+1)%e.length]))return!1;for(let i=t+1;i<e.length;i++)if(i!==t+1&&(0!==t||i!==e.length-1)&&ni(e[t],e[(t+1)%e.length],e[i],e[(i+1)%e.length]))return!1}return hi(e)>1e-12},Tr=e=>{for(let t=0;t+1<e.length;t++){if($r(e[t],e[t+1]))return!1;for(let i=t+2;i+1<e.length;i++)if(ni(e[t],e[t+1],e[i],e[i+1]))return!1}return!0},Rr=(e,t)=>$r(e,t.from)?[...t.to]:[...e],Dr=(e,t)=>e.map(e=>Array.isArray(e?.poly)?{...e,poly:e.poly.map(e=>Rr(e,t))}:e),zr=(e,t,i)=>{const n=e.flatMap((e,t)=>Nt(e)?.some(e=>$r(e,i.from))?[t]:[]);if(!n.length)return!1;for(const i of n){const n=Nt(e[i]),r=Nt(t[i]);if(!n||!r)continue;if(!Cr(r))return!1;const o=Math.sign(Mr(n)),s=Math.sign(Mr(r));if(o&&s&&o!==s)return!1}const r=new Set;for(const e of n){const i=Nt(t[e]);if(i)for(let n=0;n<t.length;n++){if(e===n)continue;const o=e<n?`${e}:${n}`:`${n}:${e}`;if(r.has(o))continue;r.add(o);const s=Nt(t[n]);if(s&&li(i,s))return!1}}return!0},Ar=(e,t)=>{let i=0;for(const n of e){const e=Nt(n);if(e)for(let n=0;n<e.length;n++){const r=e[n],o=e[(n+1)%e.length];($r(r,t)||$r(o,t))&&(r[0]!==o[0]&&r[1]!==o[1]||i++)}}return i},Pr=(e,t)=>{const{a:i,b:n,axis:r}=e,o="horizontal"===r?{from:n,to:[n[0],i[1]]}:{from:n,to:[i[0],n[1]]},s="horizontal"===r?{from:i,to:[i[0],n[1]]}:{from:i,to:[n[0],i[1]]};return[{move:o,preservedDegree:Ar(t,i)},{move:s,preservedDegree:Ar(t,n)}].sort((e,t)=>t.preservedDegree-e.preservedDegree||xr(e.move.to).localeCompare(xr(t.move.to))||xr(e.move.from).localeCompare(xr(t.move.from))).map(e=>e.move)};function Or(e){const t=JSON.parse(JSON.stringify(e||{}));let i=Array.isArray(t.rooms)?t.rooms:[];const n=new Map;for(const e of i){const t=Nt(e);if(t)for(let e=0;e<t.length;e++){const i=[...t[e]],r=[...t[(e+1)%t.length]],o=wr(i,r);if(!o)continue;const s=Sr(i,r);n.has(s)||n.set(s,{key:s,a:i,b:r,axis:o.axis})}}let r=0,o=0,s=0;const a=new Map;for(const e of[...n.values()].sort((e,t)=>e.key.localeCompare(t.key))){let t=null;for(const n of Pr(e,i)){const e=a.get(xr(n.from));if(e&&e!==xr(n.to))continue;const r=Dr(i,n);if(zr(i,r,n)){t=n,i=r;break}}t?(a.set(xr(t.from),xr(t.to)),r++,s=Math.max(s,Math.hypot(t.to[0]-t.from[0],t.to[1]-t.from[1]))):o++}t.rooms=i;for(const e of t.room_drafts||[]){if(!Array.isArray(e?.points)||e.points.length<2)continue;const t=e.points.map(e=>[...e]),i=t.slice(0,-1).flatMap((i,n)=>{const r=t[n+1],o=wr(i,r);return o?[{key:`${String(e.id||"")}:${n}`,a:[...i],b:[...r],axis:o.axis}]:[]});let n=t;for(const e of i){let t=null;for(const i of Pr(e,[{poly:n}])){const e=n.map(e=>Rr(e,i)),r=e.length>=4&&$r(e[0],e[e.length-1]),o=r?e.slice(0,-1):e;if(r?Cr(o):Tr(o)){t=i,n=e;break}}t?(r++,s=Math.max(s,Math.hypot(t.to[0]-t.from[0],t.to[1]-t.from[1]))):o++}e.points=n}for(const e of t.partitions||[]){if(!Array.isArray(e?.a)||!Array.isArray(e?.b))continue;const i=wr(e.a,e.b);if(!i)continue;const n={key:String(e.id||Sr(e.a,e.b)),a:[...e.a],b:[...e.b],axis:i.axis};let a=null;for(const i of Pr(n,[{poly:[e.a,e.b]}])){const n=Rr(e.a,i),r=Rr(e.b,i),o=Math.hypot(r[0]-n[0],r[1]-n[1]);if(!(o>0))continue;const s=(t.openings||[]).filter(t=>"partition"===t?.host?.kind&&t.host.id===e.id).every(e=>{const t=Number(e.host.t),i=Number(e.length);return Number.isFinite(t)&&t>=0&&t<=1&&Number.isFinite(i)&&i>0&&t*o-i/2>=-1e-12&&t*o+i/2<=o+1e-12});if(s){a=i,e.a=n,e.b=r;break}}a?(r++,s=Math.max(s,Math.hypot(a.to[0]-a.from[0],a.to[1]-a.from[1]))):o++}return{space:t,report:{wallsStraightened:r,wallsStraightenSkipped:o,maxStraightenShift:s},changed:r>0}}const Fr=["rect","ellipse","furniture","image"],Ir=10**9,Er=240,Hr=1e-4;function Nr(e){if(Array.isArray(e))return e.map(e=>Nr(e));if(null!==e&&"object"==typeof e){const t={};for(const[i,n]of Object.entries(e))t[i]=Nr(n);return t}return e}function Lr(e){if("number"!=typeof e||!Number.isFinite(e))return e;const t=(e<0||Object.is(e,-0)?-1:1)*(Math.floor(Math.abs(e)*Ir+.5)/Ir);return 0===t?0:t}function Br(e){if("number"!=typeof e||!Number.isFinite(e))return e;const t=e*Er,i=Math.round(t);if(Math.abs(t-i)<Hr){const e=i/Er;return 0===e?0:e}return Lr(e)}function qr(e){if(!Number.isFinite(e)||0===e)return"0";return Math.abs(e)<.001?e.toExponential(2):String(Number(e.toPrecision(3)))}function Wr(e){return null===e||"object"!=typeof e||Array.isArray(e)?null:e}function jr(e){return Array.isArray(e)?e.filter(e=>null!==Wr(e)):[]}function Ur(e){return"string"==typeof e&&Fr.includes(e)}function Vr(e,t){for(const i of t)Object.prototype.hasOwnProperty.call(e,i)&&(e[i]=Lr(e[i]))}function Gr(e,t){for(const i of t)Object.prototype.hasOwnProperty.call(e,i)&&(e[i]=Br(e[i]))}function Kr(e){if(Array.isArray(e))for(let t=0;t<Math.min(2,e.length);t++)e[t]=Br(e[t])}function Yr(e){if(Array.isArray(e))for(const t of e)Kr(t)}function Xr(e,t,i){const n=Wr(e);if(n)for(const e of jr(n.spaces)){const t=(t,n)=>{for(const r of n){const n=t[r];"number"==typeof n&&Number.isFinite(n)&&i(n,e)}},n=t=>{if(Array.isArray(t))for(let n=0;n<Math.min(2,t.length);n++){const r=t[n];"number"==typeof r&&Number.isFinite(r)&&i(r,e)}},r=e=>{if(Array.isArray(e))for(const t of e)n(t)};for(const i of jr(e.rooms))t(i,["x","y","w","h"]),r(i.poly);for(const t of jr(e.walls))n(t.a),n(t.b);for(const t of jr(e.wall_segments))n(t.a),n(t.b);for(const i of jr(e.openings))t(i,["x","y"]);for(const i of jr(e.decor))"line"===i.kind?t(i,["x1","y1","x2","y2"]):Ur(i.kind)?t(i,["x","y","w","h"]):"text"===i.kind&&t(i,["x","y"]);for(const t of jr(e.room_drafts))r(t.points);for(const t of jr(e.partitions))n(t.a),n(t.b);for(const t of jr(e.wall_columns))n(t.center);for(const t of jr(e.open_spans))n(t.a),n(t.b)}const r=Wr(t);if(!r)return;const o=new Map;if(n)for(const e of jr(n.spaces))null!=e.id&&o.set(String(e.id),e);for(const e of Object.values(r)){const t=Wr(e);if(!t)continue;const n=null!=t.s&&o.get(String(t.s))||null;for(const e of["x","y"]){const r=t[e];"number"==typeof r&&Number.isFinite(r)&&i(r,n)}}}function Zr(e){const t=Number(e?.cell_cm);return t>0?t:5}function Jr(e,t={}){const i={canonicalized:0,far:0,maxShift:0,maxShiftCm:0,spaces:[],bySpace:new Map},n=jr(Wr(e)?.spaces);let r=5;for(const e of n)r=Math.max(r,Zr(e));Xr(e,t,(e,t)=>{const n=e*Er,o=Math.abs(n-Math.round(n)),s=Br(e),a=o>0&&o<Hr;if(!a&&!(o>=Hr))return;const l=a&&"number"==typeof s?Math.abs(s-e):0;if(a?i.canonicalized++:i.far++,i.maxShift=Math.max(i.maxShift,l),i.maxShiftCm=Math.max(i.maxShiftCm,l*Er*(t?Zr(t):r)),!t?.id||!a)return;const c=String(t.id);let h=i.bySpace.get(c);h||(h={spaceId:c,space:String(t.title||c),canonicalized:0,far:0,maxShift:0,maxShiftCm:0},i.bySpace.set(c,h)),h.canonicalized++,h.maxShift=Math.max(h.maxShift,l),h.maxShiftCm=Math.max(h.maxShiftCm,l*Er*Zr(t))}),i.bySpace.size&&Xr(e,t,(e,t)=>{if(!t?.id)return;const n=i.bySpace.get(String(t.id));if(!n)return;const r=e*Er;Math.abs(r-Math.round(r))>=Hr&&n.far++}),i.spaces=[...i.bySpace.values()];const{bySpace:o,...s}=i;return s}function Qr(e){return function(e){const t=e,i=Wr(t);i&&Gr(i,["x","y"]);return t}(Nr(e))}function eo(e){const t=e,i=Wr(t);if(!i)return t;for(const e of Object.values(i)){const t=Wr(e);t&&Gr(t,["x","y"])}return t}function to(e){return io(Nr(e))}function io(e){const t=e,i=Wr(t);if(!i)return t;for(const e of jr(i.spaces)){Vr(e,["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"]);for(const t of jr(e.rooms))Gr(t,["x","y","w","h"]),Yr(t.poly);for(const t of jr(e.walls))Kr(t.a),Kr(t.b);for(const t of jr(e.wall_segments))Kr(t.a),Kr(t.b);for(const t of jr(e.openings)){Gr(t,["x","y"]),Vr(t,["angle","length"]);const e=Wr(t.host);e&&Vr(e,["t"])}for(const t of jr(e.decor))"line"===t.kind?Gr(t,["x1","y1","x2","y2"]):Ur(t.kind)?(Gr(t,["x","y","w","h"]),Vr(t,["angle"])):"text"===t.kind&&(Gr(t,["x","y"]),Vr(t,["scale","angle"]));for(const t of jr(e.room_drafts))Yr(t.points);for(const t of jr(e.partitions))Kr(t.a),Kr(t.b);for(const t of jr(e.wall_columns))Kr(t.center),"square"===t.shape&&Vr(t,["angle"]);for(const t of jr(e.open_spans))Kr(t.a),Kr(t.b)}for(const e of jr(i.markers))Vr(e,["angle"]);return t}const no=15,ro=8;function oo(e,t,i,n,r){const o=i[0]-e[0],s=i[1]-e[1],a=Math.hypot(o,s);if(!(a>0)||a<=r+1e-9)return null;const l=o/a,c=s/a,h=t=>{const n=(t[0]-e[0])*l+(t[1]-e[1])*c,o=(r-n)/(a-n);return!Number.isFinite(o)||o<-1e-9||o>1+1e-9?null:[t[0]+(i[0]-t[0])*o,t[1]+(i[1]-t[1])*o]},d=h(t),u=h(n);return d&&u?[[e[0],e[1]],t,d,u,n]:null}const so=Math.sin(.25*Math.PI/180);function ao(e,t){return Number.isFinite(e)&&e>0&&Number.isFinite(t)&&t>0&&e*t<3}function lo(e){const t=Number(e)>0?Number(e):5;if(5===t)return 8;const i=5/t*8;return Math.min(80,Math.max(.5,i))}function co(e,t){return Number.isFinite(e)&&e>0&&Number.isFinite(t)&&t>0&&e*t<2}function ho(e){return Number.isFinite(e)?Math.max(1,Math.min(100,e)):1}function uo(e,t){return!Number.isFinite(e)||e<0?"":String(t?Math.round(e/2.54*100)/100:Math.round(100*e)/100)}function po(e,t,i){if(!Number.isFinite(e)||e<=0)return 0;const n=Number(t)>0?Number(t):5;return ho(e)/n*i}function mo(e,t){return t>0&&Number.isFinite(e)?Math.round(e/t)*t:e}function _o(e){return Math.max(1e-6*Math.abs(e),1e-9)}function fo(e,t){if(!(t>0&&Number.isFinite(e)))return e;const i=mo(e,t);return Math.abs(i-e)<=_o(t)?i:e}function go(e,t){let i=t[0]-e[0],n=t[1]-e[1];const r=Math.hypot(i,n);return r<1e-12?[1,0]:(i/=r,n/=r,(i<-1e-12||Math.abs(i)<=1e-12&&n<0)&&(i=-i,n=-n),[i,n])}function vo(e,t,i){const n=[fo(e[0],i),fo(e[1],i)],r=[fo(t[0],i),fo(t[1],i)],o=mo((n[0]+r[0])/2,i),s=mo((n[1]+r[1])/2,i),[a,l]=go(n,r);let c=Math.atan2(l,a);c<0&&(c+=Math.PI);const h=Math.round(1800*c)/1800,d=i>0&&i<.01?6:i<1?4:2;return`${o.toFixed(d)},${s.toFixed(d)}@${h.toFixed(4)}`}function yo(e,t,i,n){return 1===n?vo(e,t,i):vo([e[0]/n,e[1]/n],[t[0]/n,t[1]/n],i)}function bo(e,t){if(!Array.isArray(e.a)||!Array.isArray(e.b)||e.a.length<2||e.b.length<2)return null;const i=[Number(e.a[0]),Number(e.a[1]),Number(e.b[0]),Number(e.b[1])];if(!i.every(Number.isFinite))return null;const n=t>0?t:1;return[[i[0]*n,i[1]*n],[i[2]*n,i[3]*n]]}function wo(e,t,i,n,r){const o=r>0?r:1;return{key:yo(e,t,n,o),cm:ho(i),a:[e[0]/o,e[1]/o],b:[t[0]/o,t[1]/o]}}function ko(e,t){const i=t>0?t:1,n=[];for(const t of e){const e=t.key.lastIndexOf("@");if(e<0)continue;const[r,o]=t.key.slice(0,e).split(",").map(Number),s=Number(t.key.slice(e+1));[r,o,s].every(Number.isFinite)&&n.push({w:t,x:r*i,y:o*i,ang:s})}return n}function xo(e,t){const[i,n]=go(e,t);let r=Math.atan2(n,i);return r<0&&(r+=Math.PI),r}function $o(e,t){let i=Math.abs(e-t);return i>Math.PI/2&&(i=Math.PI-i),i<.02}function So(e,t,i,n,r=1){if(!e?.length)return null;const o=yo(t,i,n,r),s=e.find(e=>e.key===o);if(s)return s;const a=r>0?r:1,l=_o(n)*a,c=(e,t)=>Math.abs(e[0]-t[0])<=l&&Math.abs(e[1]-t[1])<=l;for(const n of e){const e=bo(n,a);if(e&&(c(e[0],t)&&c(e[1],i)||c(e[0],i)&&c(e[1],t)))return n}const h=(t[0]+i[0])/2,d=(t[1]+i[1])/2,u=xo(t,i),p=Math.max(.5*n,1e-9)*a;for(const t of ko(e,a))if($o(t.ang,u)&&Math.hypot(t.x-h,t.y-d)<=p)return t.w;return null}function Mo(e,t,i,n,r=1){const o=So(e,t,i,n,r);if(o&&o.cm>0)return ho(o.cm);const s=function(e,t,i,n,r){if(!e?.length)return null;const o=r>0?r:1,s=Math.hypot(i[0]-t[0],i[1]-t[1]);if(s<1e-12)return null;const a=xo(t,i),l=Math.max(.5*n,1e-9)*o;let c=null;for(const n of e){if(!(n.cm>0))continue;const e=bo(n,o);if(!e)continue;const r=Math.hypot(e[1][0]-e[0][0],e[1][1]-e[0][1]);if(r<1e-12||!$o(xo(e[0],e[1]),a))continue;if(_s(t[0],t[1],e[0][0],e[0][1],e[1][0],e[1][1])>l||_s(i[0],i[1],e[0][0],e[0][1],e[1][0],e[1][1])>l)continue;if(r+l<s)continue;const h=Math.max(0,r-s),d=`${n.key}|${ho(n.cm)}|${e.flat().join(",")}`;(!c||h<c.extra-1e-12||Math.abs(h-c.extra)<=1e-12&&d<c.stable)&&(c={wall:n,extra:h,stable:d})}return c?.wall||null}(e,t,i,n,r);return s?ho(s.cm):0}function Co(e,t,i,n=1,r=[]){if(!e?.length)return[];const o=new Set,s=Bt(t);for(const e of s)o.add(yo([e[0],e[1]],[e[2],e[3]],i,n));const a=t||[],l=Math.max(i*n*.02,1e-9);for(let e=0;e<a.length;e++){const t=Nt(a[e]);if(t)for(let r=e+1;r<a.length;r++){const e=Nt(a[r]);if(e)for(const r of un(t,e,l))o.add(yo([r[0],r[1]],[r[2],r[3]],i,n))}}for(const t of a){if(!t?.id)continue;const s=ts(a,t.id,r,i,n,e);if(s)for(let e=0;e<s.poly.length;e++)o.add(yo(s.poly[e],s.poly[(e+1)%s.poly.length],i,n))}return e.filter(e=>(o.has(e.key)||(e=>{const t=bo(e,n);if(!t)return!1;const[i,o]=t,a=o[0]-i[0],c=o[1]-i[1],h=Math.hypot(a,c);if(h<=l)return!1;if(!s.some(e=>{const t=[e[0],e[1]],n=[e[2],e[3]];return $o(xo(i,o),xo(t,n))&&_s(i[0],i[1],t[0],t[1],n[0],n[1])<=l&&_s(o[0],o[1],t[0],t[1],n[0],n[1])<=l}))return!1;const d=(r||[]).some(e=>{const t=[e[0],e[1]],n=[e[2],e[3]];if(!$o(xo(i,o),xo(t,n)))return!1;const r=e=>Math.abs((e[0]-i[0])*c-(e[1]-i[1])*a)/h;if(r(t)>l||r(n)>l)return!1;const s=h*h,d=((t[0]-i[0])*a+(t[1]-i[1])*c)/s,u=((n[0]-i[0])*a+(n[1]-i[1])*c)/s;return Math.min(1,Math.max(d,u))-Math.max(0,Math.min(d,u))>l/h});return!d})(e))&&e.cm>=1&&e.cm<=100)}function To(e,t,i,n=8){const[r,o]=go(e,t);let s=Math.atan2(o,r);s<0&&(s+=Math.PI);let a=i*Math.PI/180%Math.PI;a<0&&(a+=Math.PI);let l=Math.abs(s-a);return l>Math.PI/2&&(l=Math.PI-l),l<=n*Math.PI/180}function Ro(e,t,i,n,r=1,o="affine",s){if(!e?.length)return[];if(t.length!==i.length)return"fixed-topology"===o&&s?.(),e.slice();const a=r>0?r:1,l=Math.max(.5*n,1e-9)*a,c=Math.max(n*a*1e-6,1e-9),h=[],d=new Map,u=new Map,p=(e,t,i)=>{const n=e.get(t)||new Set;n.add(i),e.set(t,n)};for(let e=0;e<t.length;e++){const[o,s]=t[e],[a,l]=i[e];if(![o?.[0],o?.[1],s?.[0],s?.[1],a?.[0],a?.[1],l?.[0],l?.[1]].every(Number.isFinite))continue;const m=s[0]-o[0],_=s[1]-o[1],f=m*m+_*_;if(f<1e-18)continue;if(Math.max(Math.hypot(a[0]-o[0],a[1]-o[1]),Math.hypot(l[0]-s[0],l[1]-s[1]))<=c)continue;h.push({oa:o,ob:s,na:a,nb:l,dx:m,dy:_,len2:f});const g=yo(o,s,n,r),v=yo(a,l,n,r);p(u,g,v),p(u,yo(o,s,n,1),yo(a,l,n,1)),g!==v&&p(d,g,v)}if(!h.length)return e.slice();const m=(e,t,i)=>[e[0]+(t[0]-e[0])*i,e[1]+(t[1]-e[1])*i],_=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1])<=c,f=(e,t)=>{if("fixed-topology"===o){const i=t.na[0]-t.oa[0],n=t.na[1]-t.oa[1],r=t.nb[0]-t.ob[0],o=t.nb[1]-t.ob[1];return Math.hypot(i-r,n-o)<=c?[e[0]+i,e[1]+n]:_(e,t.oa)?[...t.na]:_(e,t.ob)?[...t.nb]:[...e]}const i=Math.max(0,Math.min(1,((e[0]-t.oa[0])*t.dx+(e[1]-t.oa[1])*t.dy)/t.len2));return m(t.na,t.nb,i)},g=(e,t)=>{const[i,n]=go(e,t);return(t[0]-e[0])*i+(t[1]-e[1])*n>=0?[[...e],[...t]]:[[...t],[...e]]},v=[],y=[],b=(e,t,i)=>{if(Math.hypot(t[0]-e[0],t[1]-e[1])<=c)return;const[r,o]=g(e,t),s=ho(i);if(y.some(e=>e.entry.cm===s&&_(e.span[0],r)&&_(e.span[1],o)))return;const l=wo(r,o,s,n,a);v.push(l),y.push({entry:l,span:[r,o]})};for(const t of e){const e=bo(t,a);if(e){const[i,n]=g(e[0],e[1]),r=n[0]-i[0],s=n[1]-i[1],a=r*r+s*s,d=Math.sqrt(a);if(d<=c){v.push({...t,cm:ho(t.cm)});continue}const u=[];for(const e of h){if(!$o(xo(i,n),xo(e.oa,e.ob)))continue;const t=e=>Math.abs((e[0]-i[0])*s-(e[1]-i[1])*r)/d;if(t(e.oa)>l||t(e.ob)>l)continue;const o=((e.oa[0]-i[0])*r+(e.oa[1]-i[1])*s)/a,h=((e.ob[0]-i[0])*r+(e.ob[1]-i[1])*s)/a,p=Math.max(0,Math.min(o,h)),m=Math.min(1,Math.max(o,h));(m-p)*d>c&&u.push({lo:p,hi:m,move:e})}if(!u.length){"fixed-topology"===o?v.push({...t}):b(i,n,t.cm);continue}const p=[0,1,...u.flatMap(({lo:e,hi:t})=>[e,t])].sort((e,t)=>e-t).filter((e,t,i)=>0===t||Math.abs(e-i[t-1])*d>c),y=[];for(let e=0;e+1<p.length;e++){const t=p[e],r=p[e+1];if((r-t)*d<=c)continue;const o=m(i,n,t),s=m(i,n,r),a=(t+r)/2,l=u.filter(e=>a>=e.lo-1e-12&&a<=e.hi+1e-12);if(!l.length){y.push([o,s]);continue}const h=[f(o,l[0].move),f(s,l[0].move)],g=l.slice(1).some(e=>{const t=f(o,e.move),i=f(s,e.move);return!_(h[0],t)||!_(h[1],i)});y.push(g?[o,s]:h)}const w=(e,t)=>{const i=e[1][0]-e[0][0],n=e[1][1]-e[0][1],r=t[1][0]-t[0][0],o=t[1][1]-t[0][1],s=Math.hypot(i,n);return!(s<=c||i*r+n*o<=0)&&Math.abs(i*o-n*r)/s<=c},k=[];for(const e of y){const t=k[k.length-1];t&&_(t[1],e[0])&&w(t,e)?t[1]=e[1]:k.push([[...e[0]],[...e[1]]])}if("fixed-topology"===o&&1===k.length){const[i,n]=k[0];if(_(i,e[0])&&_(n,e[1])||_(i,e[1])&&_(n,e[0])){v.push({...t});continue}}for(const[e,i]of k)b(e,i,t.cm);continue}if("fixed-topology"===o){const e=u.get(t.key);if(1===e?.size){const i=[...e][0];v.push(i===t.key?{...t}:{...t,key:i});continue}const i=[ko([t],a)[0]];1!==a&&i.push(ko([t],1)[0]);const n=i.filter(Boolean).some(e=>h.some(t=>{if(!$o(e.ang,xo(t.oa,t.ob)))return!1;const i=((e.x-t.oa[0])*t.dx+(e.y-t.oa[1])*t.dy)/t.len2;return i>=-1e-6&&i<=1.000001&&_s(e.x,e.y,t.oa[0],t.oa[1],t.ob[0],t.ob[1])<=l}));((e?.size||0)>1||n)&&s?.(),v.push({...t});continue}let i="";const r=d.get(t.key);if(1===r?.size&&(i=[...r][0]),!i){const e=ko([t],a)[0];if(e){const t=new Set;for(const i of h){if(!$o(e.ang,xo(i.oa,i.ob)))continue;const r=((e.x-i.oa[0])*i.dx+(e.y-i.oa[1])*i.dy)/i.len2;if(r<-1e-6||r>1.000001)continue;if(_s(e.x,e.y,i.oa[0],i.oa[1],i.ob[0],i.ob[1])>l)continue;const o=f([e.x,e.y],i),[s,c]=go(i.na,i.nb),h=Math.max(n*a,1e-6);t.add(yo([o[0]-s*h,o[1]-c*h],[o[0]+s*h,o[1]+c*h],n,a))}1===t.size&&(i=[...t][0])}}v.push({...t,key:i||t.key,cm:ho(t.cm)})}return v}function Do(e,t,i,n,r=1,o="affine"){return Ro(e,t,i,n,r,o)}function zo(e,t,i,n,r=1,o="fixed-topology"){let s=!1;const a=Ro(e,t,i,n,r,o,()=>{s=!0});return{walls:s?(e||[]).map(e=>({...e})):a,rejected:s}}function Ao(e,t,i,n=1,r=[]){const o=n>0?n:1,s=Math.abs(i),a=Math.max(s*o*Hr,1e-9),l=(r||[]).flatMap(e=>{const t=bo(e,o);return t?t.map(e=>[...e]):[]}),c=e=>e.every((e,t)=>(e=>{if(!(s>0))return!0;const t=e/o/s;return Math.abs(t-Math.round(t))<Hr})(e)||l.some(i=>Math.abs(e-i[t])<=a)),h=[],d=e=>JSON.stringify([e.key,e.cm,e.a,e.b]);for(const i of e||[]){const e=bo(i,o);if(!e)continue;const[n,r]=e;if(![n[0],n[1],r[0],r[1]].every(Number.isFinite)||!c(n)||!c(r)){h.push(d(i));continue}const s=r[0]-n[0],l=r[1]-n[1],u=Math.hypot(s,l);if(u<=a){h.push(d(i));continue}const p=s/u,m=l/u,_=[];for(const e of t){const[t,i]=e;if(![t?.[0],t?.[1],i?.[0],i?.[1]].every(Number.isFinite))continue;const r=e=>Math.abs((e[0]-n[0])*m-(e[1]-n[1])*p);if(r(t)>a||r(i)>a)continue;const o=(t[0]-n[0])*p+(t[1]-n[1])*m,s=(i[0]-n[0])*p+(i[1]-n[1])*m,l=Math.max(0,Math.min(o,s)),c=Math.min(u,Math.max(o,s));c-l>a&&_.push([l,c])}_.sort((e,t)=>e[0]-t[0]||e[1]-t[1]);let f=0;for(const[e,t]of _){if(e>f+a)break;if(f=Math.max(f,t),f>=u-a)break}f<u-a&&h.push(d(i))}return h}function Po(e,t,i,n,r,o=1){const s=yo(t,i,r,o),a=(e||[]).filter(e=>e.key!==s);return null==n||n<1?a:[...a,wo(t,i,n,r,o)]}function Oo(e,t,i,n,r,o=[],s=1){let a=e?e.slice():[];for(const e of function(e,t,i,n,r=1,o=[]){const s=ts(e,t,i,n,r,o);if(!s)return[];const a=[];for(let e=0;e<s.poly.length;e++){const t=s.poly[e],o=s.poly[(e+1)%s.poly.length];jo(t,o,i,n,r)||a.push({a:t,b:o})}return a}(t,i,o,r,s,a))a=Po(a,e.a,e.b,n,r,s);return a}function Fo(e,t,i,n,r,o=[],s=1){if(null==n||n<1)return e?e.slice():[];const a=ts(t,i,o,r,s,e);if(!a)return e?e.slice():[];const l=is(e,a,r,s);let c=e?e.slice():[];for(let e=0;e<a.poly.length;e++){const t=a.poly[e],i=a.poly[(e+1)%a.poly.length];jo(t,i,o,r,s)||(l[e]>0||(c=Po(c,t,i,n,r,s)))}return c}function Io(e){const{a:t,b:i,halfDepth:n}=e;if(!Array.isArray(t)||!Array.isArray(i)||t.length<2||i.length<2||![t[0],t[1],i[0],i[1]].every(Number.isFinite))return null;const r=i[0]-t[0],o=i[1]-t[1],s=Math.hypot(r,o);if(!(s>1e-9&&n>0&&Number.isFinite(n)))return null;const a=-o/s*n,l=r/s*n;return[[t[0]+a,t[1]+l],[i[0]+a,i[1]+l],[i[0]-a,i[1]-l],[t[0]-a,t[1]-l]]}function Eo(e,t,i){return Math.hypot(e[0]-t[0],e[1]-t[1])<=i}function Ho(e,t,i){const n=t.b[0]-t.a[0],r=t.b[1]-t.a[1],o=n*n+r*r;if(!(o>i*i))return!1;const s=((e[0]-t.a[0])*n+(e[1]-t.a[1])*r)/o;if(!(s>0&&s<1))return!1;const a=[t.a[0]+n*s,t.a[1]+r*s];return Math.hypot(e[0]-a[0],e[1]-a[1])<=i}function No(e,t,i,n){const r=Math.hypot(t,i);if(!(r>1e-9&&n>0))return;const o=[t/r,i/r],s=e.find(e=>Math.abs(e.u[0]*o[1]-e.u[1]*o[0])<1e-9&&e.u[0]*o[0]+e.u[1]*o[1]>1-1e-9);s?s.halfDepth=Math.max(s.halfDepth,n):e.push({u:o,halfDepth:n})}function Lo(e,t){try{const i=Tt(vs(e),vs(t));let n=null,r=0;for(const e of i||[]){const t=e?.[0]||[],i=Math.abs(Vo(t));t.length>=4&&i>r&&(r=i,n=t.slice(0,-1).map(e=>[e[0],e[1]]))}return n}catch{return null}}function Bo(e,t=1e-6){const i=(e||[]).map((e,t)=>({segment:e,index:t})).filter(({segment:e})=>e&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length>=2&&e.b.length>=2&&e.a.every(Number.isFinite)&&e.b.every(Number.isFinite)&&Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>1e-9);if(i.length<2)return[];const n=Math.max(Number.isFinite(t)?t:0,1e-9),r=i.flatMap(({segment:e})=>[e.a,e.b]).map(e=>[e[0],e[1]]).sort((e,t)=>e[0]-t[0]||e[1]-t[1]),o=[];for(const e of r)o.some(t=>Eo(t,e,n))||o.push(e);const s=[];for(const e of o){const t=[];let r=!1;for(const{segment:o,index:s}of i){const i=Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]);Eo(e,o.a,n)?t.push({u:[(o.b[0]-o.a[0])/i,(o.b[1]-o.a[1])/i],halfDepth:o.halfDepth,length:i,index:s}):Eo(e,o.b,n)?t.push({u:[(o.a[0]-o.b[0])/i,(o.a[1]-o.b[1])/i],halfDepth:o.halfDepth,length:i,index:s}):Ho(e,o,n)&&(r=!0)}if(r||2!==t.length)continue;const[o,a]=t,l=o.u[0]*a.u[1]-o.u[1]*a.u[0];if(Math.abs(l)<1e-9)continue;const c=l<0?1:-1,h=[-o.u[1],o.u[0]],d=[-a.u[1],a.u[0]],u=[e[0]+h[0]*o.halfDepth*c,e[1]+h[1]*o.halfDepth*c],p=[e[0]-d[0]*a.halfDepth*c,e[1]-d[1]*a.halfDepth*c];if(!Yo(u,o.u,p,a.u))continue;const m=[[o,a,p,[d[0]*-c,d[1]*-c]],[a,o,u,[h[0]*c,h[1]*c]]];for(const[t,,i,r]of m){const o=Math.min(2*t.halfDepth,t.length),a=[-t.u[1]*t.halfDepth,t.u[0]*t.halfDepth],l=[[e[0]+a[0],e[1]+a[1]],[e[0]+t.u[0]*o+a[0],e[1]+t.u[1]*o+a[1]],[e[0]+t.u[0]*o-a[0],e[1]+t.u[1]*o-a[1]],[e[0]-a[0],e[1]-a[1]]],c=e=>(e[0]-i[0])*r[0]+(e[1]-i[1])*r[1],h=[];for(let e=0;e<l.length;e++){const t=l[e],i=l[(e+1)%l.length],n=c(t),r=c(i);if(n>=-1e-12&&h.push(t),n>1e-12&&r<-1e-12||n<-1e-12&&r>1e-12){const e=n/(n-r);h.push([t[0]+(i[0]-t[0])*e,t[1]+(i[1]-t[1])*e])}}h.length>=3&&Math.abs(Vo(h))>n*n&&s.push({segmentIndex:t.index,wedge:h})}}return s}function qo(e,t=1e-6){const i=(e||[]).filter(e=>e&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length>=2&&e.b.length>=2&&e.a.every(Number.isFinite)&&e.b.every(Number.isFinite)&&Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>1e-9);if(i.length<2)return[];const n=Math.max(Number.isFinite(t)?t:0,1e-9),r=i.flatMap(e=>[e.a,e.b]).map(e=>[e[0],e[1]]).sort((e,t)=>e[0]-t[0]||e[1]-t[1]),o=[];for(const e of r)o.some(t=>Eo(t,e,n))||o.push(e);const s=[],a=i.map((e,t)=>({roomId:"",a:[e.a[0],e.a[1]],b:[e.b[0],e.b[1]],key:`join-${t}`,kind:"outer",cm:0,open:!1,half:e.halfDepth})),l=ss(a,n);for(const e of as(l).fans)s.push(e);const c=e=>!!ls(l,e);for(const e of o){if(c(e))continue;const t=[];for(const r of i)Eo(e,r.a,n)?No(t,r.b[0]-r.a[0],r.b[1]-r.a[1],r.halfDepth):Eo(e,r.b,n)?No(t,r.a[0]-r.b[0],r.a[1]-r.b[1],r.halfDepth):Ho(e,r,n)&&(No(t,r.a[0]-e[0],r.a[1]-e[1],r.halfDepth),No(t,r.b[0]-e[0],r.b[1]-e[1],r.halfDepth));if(!(t.length<2)){t.sort((e,t)=>Math.atan2(e.u[1],e.u[0])-Math.atan2(t.u[1],t.u[0])||e.halfDepth-t.halfDepth);for(let i=0;i<t.length;i++)for(let r=i+1;r<t.length;r++){const o=t[i],a=t[r],l=o.u[0]*a.u[1]-o.u[1]*a.u[0];if(Math.abs(l)<1e-9)continue;const c=[-o.u[1],o.u[0]],h=[-a.u[1],a.u[0]],d=l<0?1:-1,u=[e[0]+c[0]*o.halfDepth*d,e[1]+c[1]*o.halfDepth*d],p=[e[0]-h[0]*a.halfDepth*d,e[1]-h[1]*a.halfDepth*d],m=Yo(u,o.u,p,a.u),_=m?[e.slice(),u,m,p]:[e.slice(),u,p];Math.abs(Vo(_))>n*n&&s.push(_)}}}return s}function Wo(e,t,i,n){if(!(t>0)||!e||e.length<2)return"";if(i&&e.length>=3){let i=e;const r=e[e.length-1];if(e.length>=4&&Math.hypot(e[0][0]-r[0],e[0][1]-r[1])<1e-9&&(i=e.slice(0,-1)),i.length>=3){const e=i.map((e,i)=>n?.[i]||t),r=Es(i,e),o=Jo(i,e);if(r&&o)return`${Qo(r)} ${Qo(es(o))}`}}const r=[];for(let i=0;i<e.length-1;i++){const o=e[i],s=e[i+1],a=n?.[i]||t;Math.hypot(s[0]-o[0],s[1]-o[1])>=1e-9&&a>0&&r.push({a:o,b:s,halfDepth:a})}const o=r.map(Io);for(const{segmentIndex:e,wedge:t}of Bo(r)){const i=o[e];if(!i)continue;const n=Lo(i,t);n&&(o[e]=n)}const s=[...o.filter(e=>!!e),...qo(r)],a=function(e){let t=null;try{for(const i of e){if(i.length<3)continue;const e=vs(i);t=t?Mt(t,e):[e]}return t}catch{return null}}(s);return a?Ds(a):s.map(e=>Qo(e)).join(" ")}function jo(e,t,i,n,r=1){if(!i.length)return!1;const o=Uo(n,r),s=(e[0]+t[0])/2,a=(e[1]+t[1])/2,[l,c]=go(e,t);for(const e of i){const[t,i]=go([e[0],e[1]],[e[2],e[3]]);if(!(Math.abs(l*i-c*t)>.05)&&_s(s,a,e[0],e[1],e[2],e[3])<=o)return!0}return!1}function Uo(e,t){return Math.max(e*(t>0?t:1)*.04,1e-9)}function Vo(e){let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return t/2}function Go(e,t){const i=e[t],n=e[(t+1)%e.length],r=n[0]-i[0],o=n[1]-i[1],s=Math.hypot(r,o)||1;let a=-o/s,l=r/s;const c=[(i[0]+n[0])/2,(i[1]+n[1])/2];return function(e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){const o=t[n][0],s=t[n][1],a=t[r][0],l=t[r][1];s>e[1]!=l>e[1]&&e[0]<(a-o)*(e[1]-s)/(l-s+0)+o&&(i=!i)}return i}([c[0]+.001*a,c[1]+.001*l],e)||(a=-a,l=-l),[a,l]}function Ko(e,t){const i=e[0]*t[1]-e[1]*t[0],n=e[0]*t[0]+e[1]*t[1];return Math.abs(i)<1e-9&&n>0}function Yo(e,t,i,n){const r=t[0]*n[1]-t[1]*n[0];if(Math.abs(r)<1e-12)return null;const o=[i[0]-e[0],i[1]-e[1]],s=(o[0]*n[1]-o[1]*n[0])/r;return[e[0]+s*t[0],e[1]+s*t[1]]}function Xo(e,t,i){const n=e?.length||0;if(n<3||!Array.isArray(i)||i.length!==n)return 0;const r=(Math.trunc(t)%n+n)%n,o=e[r],s=e[(r+1)%n],a=s[0]-o[0],l=s[1]-o[1],c=Math.hypot(a,l);if(!(c>0))return 0;const h=Math.max(0,Number(i[r])||0);if(!(h>0))return c;const d=[a/c,l/c],u=Go(e,r),p=[o[0]+u[0]*h,o[1]+u[1]*h],m=t=>{const r=Math.max(0,Number(i[t])||0);if(!(r>0))return null;const s=e[t],a=e[(t+1)%n],l=a[0]-s[0],c=a[1]-s[1],h=Math.hypot(l,c);if(!(h>0))return null;const u=Go(e,t),m=Yo(p,d,[s[0]+u[0]*r,s[1]+u[1]*r],[l/h,c/h]);return m?(m[0]-o[0])*d[0]+(m[1]-o[1])*d[1]:null},_=m((r-1+n)%n)??0,f=(m((r+1)%n)??c)-_;return f>0?f:0}function Zo(e,t,i,n,r,o,s,a=1){const l=(e||[]).find(e=>e?.id===t),c=Nt(l);if(!c||c.length<3)return null;const h=hs(e,t,i,n,r,o,s,a);if(!h)return c.map(()=>0);const d=4*Uo(r,a);return c.map((e,t)=>{const i=c[(t+1)%c.length],n=[(e[0]+i[0])/2,(e[1]+i[1])/2];for(let e=0;e<h.poly.length;e++){const t=h.poly[e],i=h.poly[(e+1)%h.poly.length];if(_s(n[0],n[1],t[0],t[1],i[0],i[1])<=d)return Math.max(0,h.offsets[e]||0)}return 0})}function Jo(e,t,i){const n=e?.length||0;if(n<3||t.length!==n)return null;if(t.every(e=>!(e>0)))return e.map(e=>[e[0],e[1]]);const r=[];for(let o=0;o<n;o++){const s=(o-1+n)%n,a=e[s],l=e[o],c=e[o],h=e[(o+1)%n],d=Math.max(0,t[s]),u=Math.max(0,t[o]),[p,m]=Go(e,s),[_,f]=Go(e,o),g=[l[0]-a[0],l[1]-a[1]],v=[h[0]-c[0],h[1]-c[1]],y=Math.hypot(g[0],g[1])||1,b=Math.hypot(v[0],v[1])||1,w=[g[0]/y,g[1]/y],k=[v[0]/b,v[1]/b],x=[a[0]+p*d,a[1]+m*d],$=[c[0]+_*u,c[1]+f*u];if(!(d>0||u>0)){r.push([e[o][0],e[o][1]]);continue}if(d>0!=u>0){const t=e[o],i=d>0?[t[0]+p*d,t[1]+m*d]:[t[0],t[1]],n=u>0?[t[0]+_*u,t[1]+f*u]:[t[0],t[1]];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}if(Ko(w,k)){const t=e[o],i=[t[0]+p*d,t[1]+m*d],n=[t[0]+_*u,t[1]+f*u];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}const S=Yo(x,w,$,k),M=Math.max(d,u,1e-9),C=ls(i,e[o])?.limit??4*M;if(S){const i=Math.hypot(S[0]-e[o][0],S[1]-e[o][1]);if(Number.isFinite(i)&&i<=C){r.push(S);continue}if(As(e,t,o)){r.push(S);continue}}d>0&&r.push([e[o][0]+p*d,e[o][1]+m*d]),u>0&&r.push([e[o][0]+_*u,e[o][1]+f*u]),d>0||u>0||r.push([e[o][0],e[o][1]])}return r.length>=3?r:null}function Qo(e,t=!0){if(!e.length)return"";let i=`M ${e[0][0]} ${e[0][1]}`;for(let t=1;t<e.length;t++)i+=` L ${e[t][0]} ${e[t][1]}`;return t&&(i+=" Z"),i}function es(e){return e.slice().reverse()}function ts(e,t,i,n,r=1,o=[]){const s=(e||[]).find(e=>e?.id===t),a=Nt(s);if(!a||a.length<3)return null;const l=Uo(n,r),c=[];for(const i of e||[]){if(!i||i.id===t)continue;const e=Nt(i);if(e)for(const t of un(a,e,l))c.push([t[0],t[1]],[t[2],t[3]])}for(const e of i||[])c.push([e[0],e[1]],[e[2],e[3]]);for(const e of o||[]){const t=bo(e,r);t&&c.push(t[0],t[1])}const h=[],d=[];for(let e=0;e<a.length;e++){const t=a[e],i=a[(e+1)%a.length];h.push([t[0],t[1]]),d.push(e);const n=Math.hypot(i[0]-t[0],i[1]-t[1]);if(n<2*l||!c.length)continue;const r=Math.min(.499,2*l/n),o=[];for(const e of c){if(_s(e[0],e[1],t[0],t[1],i[0],i[1])>l)continue;const s=((e[0]-t[0])*(i[0]-t[0])+(e[1]-t[1])*(i[1]-t[1]))/(n*n);s<=r||s>=1-r||(o.some(e=>Math.abs(e-s)*n<=2*l)||o.push(s))}o.sort((e,t)=>e-t);for(const n of o)h.push([t[0]+(i[0]-t[0])*n,t[1]+(i[1]-t[1])*n]),d.push(e)}return{poly:h,parent:d,orig:a}}function is(e,t,i,n){const r=t.poly.length,o=new Array(r).fill(0);if(!e?.length)return o;const s=new Set,a=[];for(let l=0;l<r;l++){const c=So(e,t.poly[l],t.poly[(l+1)%r],i,n);c&&c.cm>0?(o[l]=ho(c.cm),s.add(c.key)):a.push(l)}if(!a.length)return o;const l=n>0?n:1,c=Math.max(.5*i,1e-9)*l,h=ko(e,l).filter(e=>e.w.cm>0);for(let e=a.length-1;e>=0;e--){const i=a[e],n=t.poly[i],s=t.poly[(i+1)%r],d=xo(n,s);let u=null;for(const e of h){const t=bo(e.w,l);if(!t||!$o(xo(t[0],t[1]),d))continue;if(_s(n[0],n[1],t[0][0],t[0][1],t[1][0],t[1][1])>c||_s(s[0],s[1],t[0][0],t[0][1],t[1][0],t[1][1])>c)continue;const i=Math.hypot(s[0]-n[0],s[1]-n[1]),r=Math.hypot(t[1][0]-t[0][0],t[1][1]-t[0][1]),o=Math.max(0,r-i);(!u||o<u.extra)&&(u={cm:ho(e.w.cm),extra:o})}u&&(o[i]=u.cm,a.splice(e,1))}const d=new Map;for(const e of a){const i=t.parent[e],n=d.get(i);n?n.push(e):d.set(i,[e])}for(const[e,i]of d){const n=t.orig[e],r=t.orig[(e+1)%t.orig.length],a=xo(n,r),d=(n[0]+r[0])/2,u=(n[1]+r[1])/2;let p=null;const m=Math.hypot(r[0]-n[0],r[1]-n[1]);for(const e of h){if(s.has(e.w.key))continue;if(!$o(e.ang,a))continue;const t=bo(e.w,l);let i=!1,o=0;if(t){if(!$o(xo(t[0],t[1]),a))continue;if(_s(n[0],n[1],t[0][0],t[0][1],t[1][0],t[1][1])>c||_s(r[0],r[1],t[0][0],t[0][1],t[1][0],t[1][1])>c)continue;i=!0,o=Math.max(0,Math.hypot(t[1][0]-t[0][0],t[1][1]-t[0][1])-m)}else{if(_s(e.x,e.y,n[0],n[1],r[0],r[1])>c)continue;o=Math.hypot(e.x-d,e.y-u)}(!p||i&&!p.exact||i===p.exact&&o<p.d)&&(p={cm:ho(e.w.cm),d:o,exact:i})}if(p)for(const e of i)o[e]=p.cm}return o}function ns(e,t){return[Math.floor(e[0]/t),Math.floor(e[1]/t)]}function rs(e,t){return`${e},${t}`}function os(e,t,i){const[n,r]=ns(t,i),o=[];for(let t=-1;t<=1;t++)for(let i=-1;i<=1;i++){const s=e.get(rs(n+t,r+i));s&&o.push(...s)}return o}function ss(e,t=1e-6,i=1){const n=Math.max(Number.isFinite(t)?t:0,1e-9),r=Number.isFinite(i)&&i>0?i:1,o=(e||[]).filter(e=>e&&!e.open&&null!==e.kind&&Number.isFinite(e.half)&&e.half>0&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length>=2&&e.b.length>=2&&[e.a[0],e.a[1],e.b[0],e.b[1]].every(Number.isFinite)&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>n).sort((e,t)=>e.key.localeCompare(t.key)||e.a[0]-t.a[0]||e.a[1]-t.a[1]||e.b[0]-t.b[0]||e.b[1]-t.b[1]||e.half-t.half),s=new Map;for(const e of o){const t=s.get(e.key);t?e.half>t.half&&s.set(e.key,{...t,half:e.half}):s.set(e.key,e)}const a=[...s.values()].flatMap(e=>[{point:[e.a[0],e.a[1]],other:e.b,halfDepth:e.half,kind:e.kind,key:e.key},{point:[e.b[0],e.b[1]],other:e.a,halfDepth:e.half,kind:e.kind,key:e.key}]).sort((e,t)=>e.point[0]-t.point[0]||e.point[1]-t.point[1]||e.other[0]-t.other[0]||e.other[1]-t.other[1]||e.halfDepth-t.halfDepth),l=new Map;for(const e of a){const[t,i]=ns(e.point,n),r=rs(t,i),o=l.get(r)||[];o.push(e),l.set(r,o)}const c=[],h=new Map;for(const e of a){const t=os(h,e.point,n).filter(t=>Math.hypot(t.point[0]-e.point[0],t.point[1]-e.point[1])<=n).sort((t,i)=>Math.hypot(t.point[0]-e.point[0],t.point[1]-e.point[1])-Math.hypot(i.point[0]-e.point[0],i.point[1]-e.point[1])||t.point[0]-i.point[0]||t.point[1]-i.point[1]);let i=t[0];if(!i){i={point:[...e.point],rays:[]},c.push(i);const[t,r]=ns(i.point,n),o=rs(t,r),s=h.get(o)||[];s.push(i),h.set(o,s)}const r=e.other[0]-e.point[0],o=e.other[1]-e.point[1],s=Math.hypot(r,o);if(!(s>n))continue;const a=[r/s,o/s];let l=Math.atan2(a[1],a[0]);l<0&&(l+=2*Math.PI),i.rays.push({u:a,halfDepth:e.halfDepth,length:s,angle:l})}const d=[],u=e=>{const t=1e-9*Math.max(1,r),i=e.filter(e=>Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Number.isFinite(e.length)&&e.length>n);return i.filter((e,n)=>!i.some((i,r)=>r!==n&&i.halfDepth>=e.halfDepth-t&&i.length>=e.length-t&&(i.halfDepth>e.halfDepth+t||i.length>e.length+t||r<n))).sort((e,t)=>e.length-t.length||e.halfDepth-t.halfDepth).map(e=>({...e}))};for(const e of c){const t=e.rays.sort((e,t)=>e.angle-t.angle||e.length-t.length||e.halfDepth-t.halfDepth),i=[];for(const e of t){const t=i[i.length-1];t&&Math.abs(e.angle-t.angle)<=1e-9?t.supports.push({halfDepth:e.halfDepth,length:e.length}):i.push({u:[...e.u],angle:e.angle,supports:[{halfDepth:e.halfDepth,length:e.length}]})}if(i.length>1&&2*Math.PI-i[i.length-1].angle+i[0].angle<=1e-9){const e=i.pop();i[0].supports.push(...e.supports)}if(i.length<3)continue;const r=i.map(t=>{const i=u(t.supports),r=new Set,o=[];for(const s of i){const i=[e.point[0]+t.u[0]*s.length,e.point[1]+t.u[1]*s.length];for(const t of os(l,i,n)){if("shared"!==t.kind||Math.hypot(t.point[0]-i[0],t.point[1]-i[1])>n)continue;const s=t.other[0]-t.point[0],a=t.other[1]-t.point[1],l=Math.hypot(s,a);if(!(l>n))continue;const c=s/l,h=a/l;if(Math.hypot(t.other[0]-e.point[0],t.other[1]-e.point[1])<=n)continue;const d=`${t.key}|${t.point[0]}|${t.point[1]}|${t.other[0]}|${t.other[1]}|${t.halfDepth}`;r.has(d)||(r.add(d),o.push({start:[t.point[0],t.point[1]],u:[c,h],length:l,halfDepth:t.halfDepth}))}}return o.sort((e,t)=>e.start[0]-t.start[0]||e.start[1]-t.start[1]||e.u[0]-t.u[0]||e.u[1]-t.u[1]||e.length-t.length||e.halfDepth-t.halfDepth),{u:[...t.u],halfDepth:Math.max(...i.map(e=>e.halfDepth)),length:Math.max(...i.map(e=>e.length)),supports:i,continuations:o}}).filter(e=>Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Number.isFinite(e.length)&&e.length>n);if(r.length<3)continue;const o=Math.max(...r.map(e=>e.halfDepth));o>0&&Number.isFinite(o)&&d.push({point:[...e.point],rays:r,halfDepth:o,limit:1.25*o})}d.sort((e,t)=>e.point[0]-t.point[0]||e.point[1]-t.point[1]);const p=new Map;for(const e of d){const[t,i]=ns(e.point,n),r=rs(t,i),o=p.get(r)||[];o.push(e),p.set(r,o)}return{epsilon:n,coordinateScale:r,nodes:d,index:p}}function as(e){const t={fans:[],supports:[]};if(!e?.nodes?.length)return t;const i=Math.max(e.epsilon,1e-9)**2;for(const n of e.nodes){const e=n.rays.filter(e=>Number.isFinite(e.halfDepth)&&e.halfDepth>0).map(e=>({...e,thickLength:Math.max(...e.supports.filter(t=>t.halfDepth>=e.halfDepth-1e-12).map(e=>e.length),0),angle:(()=>{const t=Math.atan2(e.u[1],e.u[0]);return t<0?t+2*Math.PI:t})()})).sort((e,t)=>e.angle-t.angle);if(e.length<2)continue;const r=n.point;for(const i of e)for(const e of i.supports){if(!(e.halfDepth>0&&e.length>0))continue;const n=-i.u[1]*e.halfDepth,o=i.u[0]*e.halfDepth,s=[r[0]+i.u[0]*e.length,r[1]+i.u[1]*e.length];t.supports.push([[r[0]+n,r[1]+o],[s[0]+n,s[1]+o],[s[0]-n,s[1]-o],[r[0]-n,r[1]-o]])}for(let n=0;n<e.length;n++){const o=e[n],s=e[(n+1)%e.length],a=(()=>{const e=s.angle-o.angle;return e>0?e:e+2*Math.PI})();if(a<1e-9)continue;const l=a>Math.PI+1e-9,c=4*Math.max(o.halfDepth,s.halfDepth),h=[r[0]-o.u[1]*o.halfDepth,r[1]+o.u[0]*o.halfDepth],d=[r[0]+s.u[1]*s.halfDepth,r[1]-s.u[0]*s.halfDepth],u=o.u[0]*s.u[1]-o.u[1]*s.u[0],p=e=>{let t=Math.atan2(e[1]-r[1],e[0]-r[0])-o.angle;for(;t<0;)t+=2*Math.PI;return t<=a+1e-9};let m=null;if(Math.abs(u)>1e-9){const e=((d[0]-h[0])*s.u[1]-(d[1]-h[1])*s.u[0])/u,t=((d[0]-h[0])*o.u[1]-(d[1]-h[1])*o.u[0])/u,i=[h[0]+o.u[0]*e,h[1]+o.u[1]*e];(l?e<=1e-9&&t<=1e-9:e>1e-9&&e<=o.thickLength&&t<=s.thickLength)&&Math.hypot(i[0]-r[0],i[1]-r[1])<=c&&p(i)&&(m=i)}const _=e=>{Math.abs(Vo(e))>i&&t.fans.push(e)};if(m){const e=1.5*Math.max(o.halfDepth,s.halfDepth);_(oo([r[0],r[1]],h,m,d,e)??[[r[0],r[1]],h,m,d]);continue}if(l){_([[r[0],r[1]],h,d]);continue}const f=(e,t)=>Math.min(t,Math.sqrt(Math.max(c**2-e**2,0)),2*Math.max(o.halfDepth,s.halfDepth)),g=[h[0]+o.u[0]*f(o.halfDepth,o.thickLength),h[1]+o.u[1]*f(o.halfDepth,o.thickLength)],v=[d[0]+s.u[0]*f(s.halfDepth,s.thickLength),d[1]+s.u[1]*f(s.halfDepth,s.thickLength)];_([[r[0],r[1]],h,g,v,d])}}return t}function ls(e,t){return!e||!Array.isArray(t)||t.length<2||!t.slice(0,2).every(Number.isFinite)?null:os(e.index,t,e.epsilon).filter(i=>Math.hypot(i.point[0]-t[0],i.point[1]-t[1])<=e.epsilon).sort((e,i)=>Math.hypot(e.point[0]-t[0],e.point[1]-t[1])-Math.hypot(i.point[0]-t[0],i.point[1]-t[1])||e.point[0]-i.point[0]||e.point[1]-i.point[1])[0]||null}function cs(e,t,i,n,r,o,s){return ss(ds(e,t,i,n,r,o,s),4*Uo(n,s),s)}function hs(e,t,i,n,r,o,s,a=1){const l=ts(e,t,n,r,a,i);if(!l)return null;const c=function(e,t,i){const n=(e||[]).find(e=>e?.id===t),r=Nt(n);if(!r)return[];const o=[];for(const n of e||[]){if(!n||n.id===t)continue;const e=Nt(n);if(e)for(const t of un(r,e,i))o.push(t)}return o}(e,t,Uo(r,a)),h=function(e,t,i,n,r){const o=Uo(n,r),s=[];for(let a=0;a<e.length;a++){const l=e[a],c=e[(a+1)%e.length];if(jo(l,c,i,n,r)){s.push(null);continue}const h=(l[0]+c[0])/2,d=(l[1]+c[1])/2,u=t.some(e=>_s(h,d,e[0],e[1],e[2],e[3])<=o);s.push(u?"shared":"outer")}return s}(l.poly,c,n,r,a),d=is(i,l,r,a),u=d.map((e,t)=>h[t]&&e>0?po(e,o,s)/2:0);return{...l,kinds:h,cms:d,offsets:u}}function ds(e,t,i,n,r,o,s=1){const a=[];for(const l of e||[]){if(!l?.id)continue;const c=hs(e,l.id,t,i,n,r,o,s);if(c)for(let e=0;e<c.poly.length;e++){const t=c.poly[e],i=c.poly[(e+1)%c.poly.length];a.push({roomId:l.id,a:[t[0],t[1]],b:[i[0],i[1]],key:yo(t,i,n,s),kind:c.kinds[e],cm:c.kinds[e]?c.cms[e]:0,open:null===c.kinds[e],half:c.offsets[e]})}}return a}function us(e,t,i,n,r,o,s=1){let a=[];const l=ds(e,t,i,n,r,o,s);for(const e of l)!e.open&&e.cm>0&&(a=Po(a,e.a,e.b,e.cm,n,s));return a}function ps(e,t,i,n,r,o,s=1){if(!t?.length)return[];const a=ds(e,t,i,n,r,o,s),l=new Map;for(const e of a){if(e.open||!e.kind||!e.roomId)continue;const t=l.get(e.key)||new Set;t.add(e.roomId),l.set(e.key,t)}const c=e=>{const t=[...l.get(e)||[]].sort();return 1!==t.length&&2!==t.length?`ambiguous:${e}`:`${1===t.length?"outer":"shared"}:${t.join("|")}`},h=[],d=new Set;for(const e of a)!e.open&&e.cm>0&&!d.has(e.key)&&(d.add(e.key),h.push({...e,ownerSignature:c(e.key)}));const u=[];for(const a of e||[]){if(!a?.id)continue;const l=hs(e,a.id,t,i,n,r,o,s);if(l)for(let e=0;e<l.orig.length;e++){const t=[];for(let i=0;i<l.parent.length;i++)l.parent[i]===e&&t.push(i);if(t.length)for(let e=0;e<t.length;){const i=t[e],r=l.cms[i];if(!(r>0)||null===l.kinds[i]){e++;continue}const o=c(yo(l.poly[i],l.poly[(i+1)%l.poly.length],n,s));let a=e;for(;a+1<t.length;){const e=t[a+1],i=yo(l.poly[e],l.poly[(e+1)%l.poly.length],n,s);if(null===l.kinds[e]||l.cms[e]!==r||c(i)!==o)break;a++}const h=t[a],d=l.poly[i],p=l.poly[(h+1)%l.poly.length],m=Math.hypot(p[0]-d[0],p[1]-d[1]);m>0&&u.push({a:[d[0],d[1]],b:[p[0],p[1]],key:yo(d,p,n,s),cm:r,len:m,ownerSignature:o}),e=a+1}}}u.sort((e,t)=>t.len-e.len||e.key.localeCompare(t.key));const p=[],m=new Set,_=new Set,f=4*Uo(n,s);for(const e of u){const t=h.filter(t=>!_.has(t.key)&&t.cm===e.cm&&t.ownerSignature===e.ownerSignature&&$o(xo(t.a,t.b),xo(e.a,e.b))&&_s(t.a[0],t.a[1],e.a[0],e.a[1],e.b[0],e.b[1])<=f&&_s(t.b[0],t.b[1],e.a[0],e.a[1],e.b[0],e.b[1])<=f);if(t.length){for(const e of t)_.add(e.key);m.has(e.key)||(m.add(e.key),p.push(wo(e.a,e.b,e.cm,n,s)))}}for(const e of h)_.has(e.key)||m.has(e.key)||(m.add(e.key),p.push(wo(e.a,e.b,e.cm,n,s)));return p}function ms(e,t,i,n,r,o,s,a=1){const l=Uo(r,a),c=(n[0]+n[2])/2,h=(n[1]+n[3])/2,d=xo([n[0],n[1]],[n[2],n[3]]);let u=null;for(const n of ds(e,t,i,r,o,s,a)){if(!$o(xo(n.a,n.b),d))continue;const e=_s(c,h,n.a[0],n.a[1],n.b[0],n.b[1]);e>4*l||(!u||e<u.d)&&(u={cm:n.cm,d:e})}return u?.cm||0}function _s(e,t,i,n,r,o){const s=r-i,a=o-n,l=s*s+a*a;if(l<1e-18)return Math.hypot(e-i,t-n);let c=((e-i)*s+(t-n)*a)/l;return c=Math.max(0,Math.min(1,c)),Math.hypot(e-(i+s*c),t-(n+a*c))}function fs(e){let t=null,i=0;for(const n of e||[]){const e=n?.[0];if(!Array.isArray(e)||e.length<4)continue;const r=e.slice(0,-1).map(e=>[e[0],e[1]]),o=Math.abs(Vo(r));r.length>=3&&o>i&&(t=r,i=o)}return t}function gs(e,t,i,n,r,o,s,a=1,l,c){const h=(e||[]).find(e=>e?.id===t),d=Nt(h);if(!d||d.length<3)return null;if(!i?.length)return d.map(e=>[e[0],e[1]]);const u=hs(e,t,i,n,r,o,s,a);if(!u||!u.offsets.some(e=>e>0))return d.map(e=>[e[0],e[1]]);const p=c||cs(e,i,n,r,o,s,a),m=Jo(u.poly,u.offsets,p);if(!m)return d.map(e=>[e[0],e[1]]);if(!p.nodes.length)return m;const _=void 0===l?Ps(e,i,n,[],r,o,s,a):null,f=l??("ok"===_?.status||"degraded-extra"===_?.status?_.roomGeom:void 0);if(f)try{const e=fs(Tt(vs(u.poly),f));if(e)return e}catch{}return function(e,t){try{return fs(Ct(vs(e),vs(t)))}catch{return null}}(m,u.poly)||d.map(e=>[e[0],e[1]])}function vs(e){const t=e.map(e=>[e[0],e[1]]);return t.push([e[0][0],e[0][1]]),[t]}function ys(e){return!(!Array.isArray(e)||!e.length)&&e.every(e=>Array.isArray(e)&&e.length&&e.every(e=>Array.isArray(e)&&e.length>=4&&e.every(e=>Array.isArray(e)&&e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1])))&&Math.abs(hi(e[0]))>1e-9)}function bs(e,t,i,n){const r=n?new Set(n):null;let o=null;for(let n=0;n<e.rays.length;n++){if(r&&!r.has(n))continue;const s=e.rays[n],a=[-s.u[1],s.u[0]];for(const n of s.supports){const r=Math.min(i,n.length);if(!(r>t.epsilon))continue;const l=Ss([[e.point[0]+a[0]*n.halfDepth,e.point[1]+a[1]*n.halfDepth],[e.point[0]+s.u[0]*r+a[0]*n.halfDepth,e.point[1]+s.u[1]*r+a[1]*n.halfDepth],[e.point[0]+s.u[0]*r-a[0]*n.halfDepth,e.point[1]+s.u[1]*r-a[1]*n.halfDepth],[e.point[0]-a[0]*n.halfDepth,e.point[1]-a[1]*n.halfDepth]],t.coordinateScale);if(!l)continue;const c=vs(l);o=o?Mt(o,c):c}}return o}function ws(e,t,i){let n=null;for(const r of e.rays)for(const e of r.continuations){const r=[-e.u[1],e.u[0]],o=[e.start[0]+e.u[0]*e.length,e.start[1]+e.u[1]*e.length],s=Ss([[e.start[0]+r[0]*e.halfDepth,e.start[1]+r[1]*e.halfDepth],[o[0]+r[0]*e.halfDepth,o[1]+r[1]*e.halfDepth],[o[0]-r[0]*e.halfDepth,o[1]-r[1]*e.halfDepth],[e.start[0]-r[0]*e.halfDepth,e.start[1]-r[1]*e.halfDepth]],t.coordinateScale);if(!s)continue;const a=Ct(vs(s),i);Array.isArray(a)&&0!==a.length&&(n=n?Mt(n,a):a)}return n}function ks(e,t,i=2*(4*e.halfDepth+2*t.epsilon)){const n=function(e,t=so){const i=new Set,n=Number.isFinite(t)&&t>=0?t:so;for(let t=0;t<e.rays.length;t++)for(let r=t+1;r<e.rays.length;r++){const o=e.rays[t].u,s=e.rays[r].u;Math.abs(o[0]*s[0]+o[1]*s[1])<=n&&(i.add(t),i.add(r))}return[...i].sort((e,t)=>e-t)}(e);return n.length?bs(e,t,i,n):null}function xs(e,t,i,n,r){const o=function(e){let t=null;for(const i of e){const e=vs(i);try{t=t?Mt(t,e):e}catch{}}return t}(function(e,t,i=!1){if(!e)return[];const n=[];for(const r of e.nodes)for(let o=0;o<r.rays.length;o++){const s=r.rays[o],a=r.rays[(o+1)%r.rays.length],l=Math.atan2(s.u[1],s.u[0]);let c=Math.atan2(a.u[1],a.u[0]);for(;c<=l;)c+=2*Math.PI;const h=c-l;if(!(h>1e-9)||h>=Math.PI-1e-9)continue;const d=[-s.u[1],s.u[0]],u=[-a.u[1],a.u[0]],p=[r.point[0]+d[0]*s.halfDepth,r.point[1]+d[1]*s.halfDepth],m=[r.point[0]-u[0]*a.halfDepth,r.point[1]-u[1]*a.halfDepth],_=Yo(p,s.u,m,a.u);if(!_)continue;const f=Math.hypot(_[0]-r.point[0],_[1]-r.point[1]);if(!Number.isFinite(f)||f<=r.limit)continue;const g=t?Math.sqrt(Math.max(0,r.limit*r.limit-s.halfDepth*s.halfDepth)):0,v=t?Math.sqrt(Math.max(0,r.limit*r.limit-a.halfDepth*a.halfDepth)):0,y=Ss([[p[0]+s.u[0]*g,p[1]+s.u[1]*g],[m[0]+a.u[0]*v,m[1]+a.u[1]*v],_],e.coordinateScale);if(y&&n.push(y),i){const t=_[0]-r.point[0],i=_[1]-r.point[1],o=Math.hypot(t,i),s=f-r.limit;if(o>e.epsilon&&s>e.epsilon){const a=Math.min(Math.max(8*e.epsilon,.05*r.halfDepth),.25*s),l=t/o,c=i/o,h=-c,d=l,u=Ss([[_[0]-l*a+h*a,_[1]-c*a+d*a],[_[0]-l*a-h*a,_[1]-c*a-d*a],[_[0]+l*a,_[1]+c*a]],e.coordinateScale);u&&n.push(u)}}}return n}({...t,nodes:[e]},i,n));return o&&r?Tt(o,r):o}function $s(e,t,i,n){if(!e||!t.nodes.length)return e;let r=null;try{r=function(e){let t=null;for(const i of e.nodes){const n=ks(i,e);n&&(t=t?Mt(t,n):n)}return t}(t)}catch{return e}let o=e;for(const e of t.nodes){const s=4*e.halfDepth+2*t.epsilon,a=2*s,l=[[e.point[0]-s,e.point[1]-s],[e.point[0]+s,e.point[1]-s],[e.point[0]+s,e.point[1]+s],[e.point[0]-s,e.point[1]+s]];try{let s=o;const c=xs(e,t,!1,!0,r);c&&(s=Tt(s,c));let h=bs(e,t,a);const d=xs(e,t,!0,!0,r);d&&(h=Tt(h,d)),r&&(h=Mt(h,r));const u=.02*Math.min(...e.rays.map(e=>e.halfDepth));if(h=Mt(h,vs([[e.point[0]-u,e.point[1]-u],[e.point[0]+u,e.point[1]-u],[e.point[0]+u,e.point[1]+u],[e.point[0]-u,e.point[1]+u]])),!h)continue;let p=Ct(h,vs(l));n?p=Ct(p,n):i&&(p=Ct(p,i));const m=vs(l),_=Tt(s,m),f=i?Tt(Ct(s,m),i):null,g=ws(e,t,m);o=Mt(_,...f?[f]:[],...g?[g]:[],p)}catch{}}if(r)try{let e=r;n?e=Ct(e,n):i&&(e=Ct(e,i)),o=Mt(o,e)}catch{}return o}function Ss(e,t=1){if(!Array.isArray(e)||e.length<3)return null;const i=Number.isFinite(t)&&t>0?t:1,n=1e-12*Math.max(1,i),r=[];for(const t of e){if(!Array.isArray(t)||t.length<2)return null;const e=Number(t[0]),i=Number(t[1]);if(!Number.isFinite(e)||!Number.isFinite(i))return null;const o=Math.round(e/n)*n,s=Math.round(i/n)*n;if(!Number.isFinite(o)||!Number.isFinite(s))return null;r.push([Object.is(o,-0)?0:o,Object.is(s,-0)?0:s])}return Math.abs(Vo(r))>n*n?r:null}function Ms(e,t,i,n){if(_s(e[0],e[1],t[0],t[1],i[0],i[1])>n)return!1;const r=i[0]-t[0],o=i[1]-t[1],s=(e[0]-t[0])*r+(e[1]-t[1])*o,a=r*r+o*o,l=n*Math.sqrt(a);return s>=-l&&s<=a+l}function Cs(e,t,i){const n=[],r=[];for(let o=0;o<e.length;o++){const s=e[o],a=e[(o+1)%e.length],l=a[0]-s[0],c=a[1]-s[1],h=l*l+c*c;if(!(h>i*i))continue;const d=i/Math.sqrt(h),u=[0,1];for(const e of t)for(const t of[e.a,e.b]){if(!Ms(t,s,a,i))continue;const e=((t[0]-s[0])*l+(t[1]-s[1])*c)/h;e>d&&e<1-d&&u.push(e)}u.sort((e,t)=>e-t);const p=u.filter((e,t)=>0===t||Math.abs(e-u[t-1])>d);for(let e=0;e<p.length-1;e++){const o=p[e],a=p[e+1],h=[s[0]+l*o,s[1]+c*o],d=[s[0]+l*(o+a)/2,s[1]+c*(o+a)/2];let u=0;for(const e of t)Ms(d,e.a,e.b,i)&&(u=Math.max(u,e.half));n.push(h),r.push(u)}}return n.length>=3&&r.length===n.length?{poly:n,offsets:r}:null}function Ts(e,t,i,n,r,o,s,a){const l=(e||[]).map(Nt).filter(e=>!!e&&e.length>=3);if(!l.length)return null;let c=Mt(vs(l[0]));for(let e=1;e<l.length;e++)c=Mt(c,vs(l[e]));const h=ds(e,t,i,n,r,o,s),d=h.filter(e=>"outer"===e.kind&&e.half>0),u=4*Uo(n,s),p=a||ss(h,u,s);let m=null;for(const e of function(e){const t=[];for(const i of Array.isArray(e)?e:[])if(Array.isArray(i))for(const e of i){if(!Array.isArray(e)||e.length<4)continue;const i=e.slice(0,-1).map(e=>[e[0],e[1]]);i.length>=3&&t.push(i)}return t}(c)){const t=Cs(e,d,u);if(!t||!t.offsets.some(e=>e>0))continue;const i=Es(t.poly,t.offsets,p),n=Jo(t.poly,t.offsets,p);if(!i||!n)continue;const r=Tt(vs(i),vs(n));m=m?Mt(m,r):r}return{centre:c,shell:m||[]}}function Rs(e,t,i,n,r,o,s=1){try{const a=Ts(e,t,i,n,r,o,s,cs(e,t,i,n,r,o,s));if(!a)return[];return a.shell?.length?Mt(a.centre,a.shell):a.centre}catch{return null}}function Ds(e){if(!e)return"";let t="";for(const i of e)if(Array.isArray(i))for(const e of i){if(!Array.isArray(e)||e.length<4)continue;const i=e.slice(0,e.length-1);i.length<3||(t+=(t?" ":"")+Qo(i.map(e=>[e[0],e[1]])))}return t}const zs=15;function As(e,t,i){const n=e?.length||0;if(n<3||t?.length!==n)return!1;const r=e[(i-1+n)%n],o=e[i],s=e[(i+1)%n],a=[r[0]-o[0],r[1]-o[1]],l=[s[0]-o[0],s[1]-o[1]],c=Math.hypot(a[0],a[1]),h=Math.hypot(l[0],l[1]);if(!(c>1e-9&&h>1e-9))return!1;const d=Math.max(-1,Math.min(1,(a[0]*l[0]+a[1]*l[1])/(c*h))),u=Math.acos(d);if(!(u>1e-9))return!1;if(u>=zs*Math.PI/180)return!1;const p=Math.max(0,t[(i-1+n)%n]),m=Math.max(0,t[i]);if(!(p>0||m>0))return!1;const _=Math.sin(u);if(!(_>1e-12))return!1;const f=(m+p*d)/_,g=(p+m*d)/_;return Number.isFinite(f)&&Number.isFinite(g)&&f>0&&g>0&&f<c-1e-9&&g<h-1e-9}function Ps(e,t,i,n=[],r,o,s,a=1,l=[],c={}){if(!t?.length&&!l.length)return{status:"not-applicable",geom:[],components:[],roomGeom:[],paperGeom:[],roomComponents:[],depthUnits:0,openingIndex:null,multiWallNodes:null,degradedExtraCount:0};const h=[],d=cs(e,t,i,r,o,s,a);let u=0;for(const n of e||[]){if(!n?.id)continue;const l=hs(e,n.id,t,i,r,o,s,a);if(!l||l.poly.length<3||!l.offsets.some(e=>e>0))continue;for(const e of l.offsets)e>0&&(u=Math.max(u,2*e));const c=Es(l.poly,l.offsets,d),p=Jo(l.poly,l.offsets,d);c&&h.push({outset:c,inset:p})}for(const e of l){const t=e.map(e=>e[0]),i=e.map(e=>e[1]);if(t.length){const n=Math.min(Math.max(...t)-Math.min(...t),Math.max(...i)-Math.min(...i)),r=Math.min(...e.map((t,i)=>{const n=e[(i+1)%e.length];return Math.hypot(n[0]-t[0],n[1]-t[1])}));u=Math.max(u,e.length>16?n:r)}}const p=function(e,t,i,n,r,o,s,a){if(!t?.length||!i?.length)return[];const l=4*Uo(n,s),c=new Map;for(const a of ds(e,t,i,n,r,o,s))!a.open&&a.half>0&&!c.has(a.key)&&c.set(a.key,a);const h=[...c.values()];if(h.length<2)return[];const d=a||ss(h,l),u=[];for(const e of i)for(const t of[[e[0],e[1]],[e[2],e[3]]])u.some(e=>Math.hypot(e[0]-t[0],e[1]-t[1])<=l)||u.push(t);const p=[],m=(e,t)=>{let i=0,n=0;if(Math.hypot(e.a[0]-t[0],e.a[1]-t[1])<=l)i=e.b[0]-e.a[0],n=e.b[1]-e.a[1];else{if(!(Math.hypot(e.b[0]-t[0],e.b[1]-t[1])<=l))return null;i=e.a[0]-e.b[0],n=e.a[1]-e.b[1]}const r=Math.hypot(i,n);return r>l?[i/r,n/r]:null};for(const e of u){const t=h.map(t=>({iv:t,u:m(t,e)})).filter(e=>!!e.u);for(let i=0;i<t.length;i++)for(let n=i+1;n<t.length;n++){const r=t[i],o=t[n],s=r.u[0]*o.u[1]-r.u[1]*o.u[0],a=Math.abs(s);if(a<.001)continue;const c=o.iv.half/a,h=r.iv.half/a,u=[e[0]-r.u[0]*c,e[1]-r.u[1]*c],m=[e[0]-o.u[0]*h,e[1]-o.u[1]*h],_=[u[0]+m[0]-e[0],u[1]+m[1]-e[1]],f=Math.max(r.iv.half,o.iv.half,1e-9),g=ls(d,e),v=g?.limit??4*f;let y;if(Math.hypot(_[0]-e[0],_[1]-e[1])<=v)y=s>0?[e.slice(),u,_,m]:[e.slice(),m,_,u];else{if(!g)continue;{const t=[-r.u[1],r.u[0]],i=[-o.u[1],o.u[0]],n=s<0?1:-1,a=[e[0]+t[0]*r.iv.half*n,e[1]+t[1]*r.iv.half*n],l=[e[0]-i[0]*o.iv.half*n,e[1]-i[1]*o.iv.half*n];y=s>0?[e.slice(),a,l]:[e.slice(),l,a]}}Math.abs(Vo(y))>l*l&&p.push(y)}}return p}(e,t,i,r,o,s,a,d),m=n.length?Hs(e,t,i,r,o,s,a):null;let _="exterior";try{const v=Ts(e,t,i,r,o,s,a,d);_="paper";const y=v?v.shell?.length?Mt(v.centre,v.shell):v.centre:[],b=e=>{const t=vs(e.outset);if(!e.inset)return t;const i=vs(e.inset);return Tt(t,i)};_="room-rings";let w=null;for(const e of h)try{const t=b(e);w=w?Mt(w,t):t}catch{}if(_="edge-bodies",v)for(const n of Is(e,t,i,r,o,s,a))try{const e=Ct(vs(n.quad),v.centre);w=w?Mt(w,e):e}catch{}_="junctions",w=function(e,t,i=1,n=Mt){let r=e;for(const e of t||[]){const t=Ss(e,i);if(t)try{const e=vs(t);r=r?n(r,e):e}catch{}}return r}(w,p,a),_="facade-clip",w&&v&&(w=Ct(w,v.centre)),_="exterior-shell";const k=[];let x=0;if(v?.shell?.length)if(w)try{const e=Mt(w,v.shell);if(!ys(e))throw new Error("invalid shell union");w=e}catch{if(!ys(w)||!ys(v.shell))throw new Error("invalid shell");k.push({id:"exterior-shell",geom:v.shell}),x++}else w=v.shell;if(_="multi-wall-trim",w&&d.nodes.length){const e=e=>e.rays.some(e=>e.supports.some(e=>e.length<2*e.halfDepth)),t=d.nodes.filter(e);if(t.length){w=$s(w,{...d,nodes:t},v?.centre,y)}}if(_="junction-corners",d.nodes.length){const n=as(d),l=function(e,t,i,n,r,o,s,a){try{const l=Ts(e,t,i,n,r,o,s,{epsilon:a.epsilon,coordinateScale:a.coordinateScale,nodes:[],index:new Map});return l?l.shell?.length?Mt(l.centre,l.shell):l.centre:null}catch{return null}}(e,t,i,r,o,s,a,d);for(const e of n.fans)try{let t=[vs(e)];if(l&&(t=Ct(t,l)),!t?.length)continue;w=w?Mt(w,t):t}catch{}f=w,g=Math.max(d.epsilon,1e-9)**2,w=Array.isArray(f)?f.map(e=>{if(!Array.isArray(e)||!e.length)return e;const[t,...i]=e;return Math.abs(Vo(t||[]))<=g?null:[t,...i.filter(e=>Math.abs(Vo(e||[]))>g)]}).filter(e=>!!e):f}const $=w||[],S=[...ys($)?[{id:"room-primary",geom:$}]:[],...k.map((e,t)=>({id:`room-isolated-${t}`,geom:e.geom}))];_="openings";for(const e of n){if(!(e.length>0))continue;const t=Bs(m,e,!0);if(!t.negative&&!t.positive)continue;const i=e.angle*Math.PI/180,n=Math.cos(i),o=Math.sin(i),s=-o,l=n,c=e.length/2,h=1.25*Math.max(u,r*a),d=[[e.x-n*c-s*h,e.y-o*c-l*h],[e.x+n*c-s*h,e.y+o*c-l*h],[e.x+n*c+s*h,e.y+o*c+l*h],[e.x-n*c+s*h,e.y-o*c+l*h]];w&&(w=Tt(w,vs(d)));for(const e of k)e.geom=Tt(e.geom,vs(d))}_="extras";const M=[];let C=0;const T=c.mergeExtra||((e,t)=>e?Mt(e,t):t);for(let e=0;e<l.length;e++){const t=l[e];if(t.length<3||!t.every(e=>e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1]))||Math.abs(hi(t))<=1e-9){C++;continue}const i=[vs(t)];try{const t=T(w,i,e);if(!ys(t))throw new Error("invalid extra union");w=t}catch{C++,ys(i)&&M.push({id:`extra-${e}`,geom:i})}}M.push(...k),M.sort((e,t)=>Ds(e.geom).localeCompare(Ds(t.geom)));const R=w||[];return{status:C||x?"degraded-extra":"ok",geom:R,components:[...ys(R)?[{id:"primary",geom:R}]:[],...M.map((e,t)=>({...e,id:`isolated-${t}`}))],roomGeom:$,roomComponents:S,paperGeom:y,depthUnits:u,openingPadUnits:1.25*Math.max(u,r*a),openingIndex:m,multiWallNodes:d,degradedExtraCount:C+x}}catch{return c.onCoreFailure?.(_),{status:"failed-core",geom:[],components:[],roomGeom:[],paperGeom:[],roomComponents:[],depthUnits:u,openingIndex:null,multiWallNodes:d,degradedExtraCount:0}}var f,g}function Os(e,t,i,n=[],r,o,s,a=1,l=[],c={}){if(!t?.length&&!l.length)return null;return Fs(Ps(e,t,i,n,r,o,s,a,l,c))}function Fs(e){if("failed-core"===e.status||"not-applicable"===e.status)return null;const t=e.components.map(e=>({id:e.id,d:Ds(e.geom),fillRule:"evenodd"})).filter(e=>!!e.d),i=t[0]?.d||"",n=Ds(e.paperGeom);if(t.length){const r={status:e.status,d:i,paths:t,components:e.components,roomGeom:e.roomGeom,multiWallNodes:e.multiWallNodes,paperD:n,depthUnits:e.depthUnits,fillRule:"evenodd"};return Object.defineProperties(r,{roomComponents:{value:e.roomComponents||[],enumerable:!1},openingIndex:{value:e.openingIndex,enumerable:!1},openingPadUnits:{value:e.openingPadUnits,enumerable:!1}}),r}return null}function Is(e,t,i,n,r,o,s=1){if(!t?.length)return[];const a=new Set,l=[];for(const c of e||[]){if(!c?.id)continue;const h=hs(e,c.id,t,i,n,r,o,s);if(!h)continue;const d=h.poly;for(let e=0;e<d.length;e++){const t=d[e],i=d[(e+1)%d.length],c=h.kinds[e];if(!c)continue;const u=h.cms[e];if(!(u>0))continue;const p=yo(t,i,n,s);if(a.has(p))continue;a.add(p);const m=po(u,r,o),[_,f]=Go(d,e),g=-_,v=-f,y=m/2,b=[[t[0]+g*y,t[1]+v*y],[i[0]+g*y,i[1]+v*y],[i[0]+_*y,i[1]+f*y],[t[0]+_*y,t[1]+f*y]];l.push({key:p,kind:c,cm:u,quad:b,a:[t[0],t[1]],b:[i[0],i[1]],depthUnits:m})}}return l}function Es(e,t,i){const n=e?.length||0;if(n<3||t.length!==n)return null;if(t.every(e=>!(e>0)))return e.map(e=>[e[0],e[1]]);es(e),t.slice().reverse();const r=[];for(let o=0;o<n;o++){const s=(o-1+n)%n,a=Math.max(0,t[s]),l=Math.max(0,t[o]),[c,h]=Go(e,s),[d,u]=Go(e,o),p=e[s],m=e[o],_=e[o],f=e[(o+1)%n],g=[m[0]-p[0],m[1]-p[1]],v=[f[0]-_[0],f[1]-_[1]],y=Math.hypot(g[0],g[1])||1,b=Math.hypot(v[0],v[1])||1,w=[g[0]/y,g[1]/y],k=[v[0]/b,v[1]/b],x=[p[0]-c*a,p[1]-h*a],$=[_[0]-d*l,_[1]-u*l];if(!(a>0||l>0)){r.push([e[o][0],e[o][1]]);continue}if(a>0!=l>0){const t=e[o],i=a>0?[t[0]-c*a,t[1]-h*a]:[t[0],t[1]],n=l>0?[t[0]-d*l,t[1]-u*l]:[t[0],t[1]];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}if(Ko(w,k)){const t=e[o],i=[t[0]-c*a,t[1]-h*a],n=[t[0]-d*l,t[1]-u*l];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}const S=Yo(x,w,$,k),M=Math.max(a,l,1e-9),C=ls(i,e[o])?.limit??4*M;if(S){const i=Math.hypot(S[0]-e[o][0],S[1]-e[o][1]);if(Number.isFinite(i)&&i<=C){r.push(S);continue}if(As(e,t,o)){r.push([e[o][0],e[o][1]]);continue}}a>0&&r.push([e[o][0]-c*a,e[o][1]-h*a]),l>0&&r.push([e[o][0]-d*l,e[o][1]-u*l])}return r.length>=3?r:null}function Hs(e,t,i,n,r,o,s=1){const a=[];for(const l of e||[]){if(!l?.id)continue;const c=hs(e,l.id,t,i,n,r,o,s);if(!c)continue;const h=Math.abs(hi(c.poly));for(let e=0;e<c.poly.length;e++){if(!c.kinds[e])continue;const t=c.poly[e],i=c.poly[(e+1)%c.poly.length];a.push({roomId:l.id,a:t,b:i,inward:Go(c.poly,e),cm:c.cms[e],half:c.offsets[e],area:h,key:yo(t,i,n,s)})}}return{edges:a,adjacencyEps:Uo(n,s)}}function Ns(e,t,i,n){const r=e.map(e=>[Math.max(t,e.x0),Math.min(i,e.x1)]).filter(e=>e[1]-e[0]>n).sort((e,t)=>e[0]-t[0]||e[1]-t[1]);if(!r.length)return{coverage:0,full:!1};let o=r[0][0],s=r[0][1],a=0,l=o<=t+n;for(let e=1;e<r.length;e++){const[t,i]=r[e];t<=s+n?s=Math.max(s,i):(a+=s-o,l=!1,o=t,s=i)}return a+=s-o,l=l&&s>=i-n,{coverage:a,full:l}}function Ls(e,t){return Number(t.full)-Number(e.full)||e.faceDistance-t.faceDistance||e.area-t.area||e.roomId.localeCompare(t.roomId)}function Bs(e,t,i=!1){const n=Number(t?.x),r=Number(t?.y),o=Number(t?.angle),s=Number(t?.length);if(!([n,r,o,s].every(Number.isFinite)&&s>0))return{negative:null,positive:null};const a=o*Math.PI/180,l=Math.cos(a),c=Math.sin(a),h=-c,d=l,u=s/2,p=Math.max(1e-9,e.adjacencyEps),m=new Map;let _=0;for(const t of e.edges){if(i&&!(t.half>0))continue;if(!To(t.a,t.b,o))continue;const[e,s]=go(t.a,t.b);if(Math.abs((n-t.a[0])*s-(r-t.a[1])*e)>p)continue;const a=(t.a[0]-n)*l+(t.a[1]-r)*c,f=(t.b[0]-n)*l+(t.b[1]-r)*c,g=Math.max(-u,Math.min(a,f)),v=Math.min(u,Math.max(a,f));if(v-g<=p)continue;const y=t.inward[0]*h+t.inward[1]*d>=0?1:-1,b=((t.a[0]+t.b[0])/2-n)*h+((t.a[1]+t.b[1])/2-r)*d,w=Math.abs(b+y*t.half),k=`${y}|${t.roomId}`,x={x0:g,x1:v,half:t.half,cm:t.cm,key:t.key,axis:[e,s]},$=m.get(k);$?($.pieces.push(x),$.faceDistance=Math.min($.faceDistance,w)):m.set(k,{roomId:t.roomId,side:y,order:_++,pieces:[x],faceDistance:w,area:t.area,coverage:0,full:!1})}for(const e of m.values()){const t=Ns(e.pieces,-u,u,p);e.coverage=t.coverage,e.full=t.full}const f=e=>{const t=[...m.values()].filter(t=>t.side===e&&t.coverage>p);return t.sort(Ls),t[0]||null};return{negative:f(-1),positive:f(1)}}function qs(e,t){const i=Bs(e,t),n=[i.negative,i.positive].filter(e=>!!e);if(!n.length)return{ox:0,oy:0,cm:0,side:-1};const r=i.negative&&i.positive?-1:n[0].side,o=t.flip_v?-r:r,s=(-1===o?i.negative:i.positive)||n[0],a=[...s.pieces].sort((e,t)=>(e.x0<=0&&e.x1>=0?0:Math.min(Math.abs(e.x0),Math.abs(e.x1)))-(t.x0<=0&&t.x1>=0?0:Math.min(Math.abs(t.x0),Math.abs(t.x1)))||t.x1-t.x0-(e.x1-e.x0)||e.key.localeCompare(t.key))[0];if(!(a.half>0&&a.cm>0))return{ox:0,oy:0,cm:0,side:o};const l=t.angle*Math.PI/180,c=-Math.sin(l),h=Math.cos(l);return{ox:c*o*a.half,oy:h*o*a.half,cm:a.cm,side:o}}function Ws(e,t){const i=1e-9,n=t.filter(e=>Number.isFinite(e.x0)&&Number.isFinite(e.x1)&&Number.isFinite(e.half)&&e.x1>e.x0&&e.half>0);if(!n.length)return"";const r=n.flatMap(e=>[e.x0,e.x1]).sort((e,t)=>e-t),o=[];for(const e of r){const t=o[o.length-1];(void 0===t||e>t+i)&&o.push(e)}const s=[];for(let e=0;e+1<o.length;e++){const t=o[e],r=o[e+1];if(!(r>t+i))continue;const a=(t+r)/2,l=n.reduce((e,t)=>a>=t.x0-i&&a<=t.x1+i?Math.max(e,t.half):e,0);if(!(l>0))continue;const c=s[s.length-1];c&&t<=c.x1+i&&Math.abs(l-c.half)<=i?c.x1=r:s.push({x0:t,x1:r,half:l})}const a=[];for(const e of s){const t=a[a.length-1],n=t?.[t.length-1];n&&e.x0<=n.x1+i?(e.x0=n.x1,t.push(e)):a.push([e])}return a.map(t=>{const i=t[0],n=t[t.length-1],r=Math.min(.25*Math.min(...t.map(e=>e.half)),.75),o=-e*r,s=[];if(1===e){s.push(`M ${i.x0} ${o} L ${n.x1} ${o}`);for(let e=t.length-1;e>=0;e--){const i=t[e];s.push(`L ${i.x1} ${i.half} L ${i.x0} ${i.half}`)}}else{s.push(`M ${n.x1} ${o} L ${i.x0} ${o}`);for(const e of t)s.push(`L ${e.x0} ${-e.half} L ${e.x1} ${-e.half}`)}return s.push("Z"),s.join(" ")}).join(" ")}function js(e,t,i,n){if(!n)return i;const r=e.angle*Math.PI/180,o=Math.cos(r),s=Math.sin(r),a=[],l=1e-9;for(const r of i){const[i,c]=r.axis,h=o*i+s*c;if(Math.abs(h)<=l)continue;const d=e.x*i+e.y*c,u=d+h*r.x0,p=d+h*r.x1,m=Math.min(u,p),_=Math.max(u,p),f=`${r.key}|${t}`,g=n.get(f)||[];let v=[[m,_]];for(const[e,t]of g){const i=[];for(const[n,r]of v)t<=n+l||e>=r-l?i.push([n,r]):(e>n+l&&i.push([n,Math.min(r,e)]),t<r-l&&i.push([Math.max(n,t),r]));if(v=i,!v.length)break}for(const[e,t]of v){const i=(e-d)/h,n=(t-d)/h;a.push({...r,x0:Math.min(i,n),x1:Math.max(i,n)})}const y=[...g,[m,_]].sort((e,t)=>e[0]-t[0]||e[1]-t[1]),b=[];for(const e of y){const t=b[b.length-1];t&&e[0]<=t[1]+l?t[1]=Math.max(t[1],e[1]):b.push([e[0],e[1]])}n.set(f,b)}return a}function Us(e,t){const i=new Map;return t.map(t=>function(e,t,i){const n=Bs(e,t,!0),r=n.negative,o=n.positive;if(!r&&!o)return null;let s;if(r&&o)s=[{candidate:r,side:-1},{candidate:o,side:1}];else{const e=r||o;s=[{candidate:e,side:-1},{candidate:e,side:1}]}const a=s.map(({candidate:e,side:n})=>({candidate:e,side:n,pieces:js(t,n,e.pieces,i)})),l=a.map(({candidate:e,side:t,pieces:i})=>({side:t,roomId:e.roomId,d:Ws(t,i)})),c=a.flatMap(({pieces:e})=>e);if(!c.length)return null;const h=Math.max(...c.map(e=>e.half));return{faces:l,minY:-h,maxY:h,wallKey:[...new Set(c.map(e=>e.key))].sort().join("|")}}(e,t,i))}const Vs=150,Gs=1e-6;function Ks(e){return Number.isFinite(e)?Math.max(1,Math.min(Vs,e)):1}function Ys(e){return((Number.isFinite(Number(e))?Number(e):0)%90+90)%90}const Xs=e=>{const t=e.map(e=>[e[0],e[1]]);return!t.length||t[0][0]===t[t.length-1][0]&&t[0][1]===t[t.length-1][1]||t.push([...t[0]]),[t]},Zs=(e,t)=>e[0]===t[0]&&e[1]===t[1];function Js(e,t=1e-6){const i=Number.isFinite(t)&&t>0?t:Gs,n=[];for(const t of e||[]){if(!Array.isArray(t)||t.length<2)return null;const e=Number(t[0]),r=Number(t[1]);if(!Number.isFinite(e)||!Number.isFinite(r))return null;const o=Math.round(e/i)*i,s=Math.round(r/i)*i;if(!Number.isFinite(o)||!Number.isFinite(s))return null;const a=[Object.is(o,-0)?0:o,Object.is(s,-0)?0:s];n.length&&Zs(n[n.length-1],a)||n.push(a)}return n.length>1&&Zs(n[0],n[n.length-1])&&n.pop(),n.length<3||new Set(n.map(e=>`${e[0]},${e[1]}`)).size<3?null:hi(n)>i*i?n:null}function Qs(e){const t=[];for(const i of e||[])for(const e of i||[]){const i=(e||[]).filter(e=>Array.isArray(e)&&e.length>=2);i.length<4||t.push(`M ${i.slice(0,-1).map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`)}return t.join(" ")}function ea(e,t,i,n,r){return Io({a:e,b:t,halfDepth:po(i,n,r)/2})}function ta(e,t,i){const n=Number(t)>0?Number(t):5,r=Ks(e.cm)/n*i,o=e.center[0],s=e.center[1];if("circle"===e.shape){const e=r/2;return Array.from({length:96},(t,i)=>{const n=i/96*Math.PI*2;return[o+Math.cos(n)*e,s+Math.sin(n)*e]})}const a=r/2,l=Ys(e.angle)*Math.PI/180,c=Math.cos(l),h=Math.sin(l);return[[-a,-a],[a,-a],[a,a],[-a,a]].map(([e,t])=>[o+e*c-t*h,s+e*h+t*c])}function ia(e,t){const i=Number.isFinite(t)?Math.max(0,Math.min(1,t)):0,n=(e.a[0]+e.b[0])/2,r=(e.a[1]+e.b[1])/2,o=(e.b[0]-e.a[0])*i/2,s=(e.b[1]-e.a[1])*i/2;return{...e,a:[n-o,r-s],b:[n+o,r+s]}}function na(e,t,i=1e-9){if(!t.length)return[e];let n=[Xs(e)];try{for(const e of t){const t=e.b[0]-e.a[0],r=e.b[1]-e.a[1],o=Math.hypot(t,r);if(!(o>i))continue;const s=t/o,a=r/o,l=-a,c=s,h=1.25*Math.max(Number(e.depth)||0,4*i),d=Math.max(2*i,1e-9*o),u=[[e.a[0]-s*d-l*h,e.a[1]-a*d-c*h],[e.b[0]+s*d-l*h,e.b[1]+a*d-c*h],[e.b[0]+s*d+l*h,e.b[1]+a*d+c*h],[e.a[0]-s*d+l*h,e.a[1]-a*d+c*h]];n=Tt(n,Xs(u))}return pa(n)}catch{return[e]}}function ra(e,t){try{const i=Tt([[...e.map(e=>[e[0],e[1]]),[e[0][0],e[0][1]]]],[[...t.map(e=>[e[0],e[1]]),[t[0][0],t[0][1]]]]);let n=null,r=0;for(const e of i||[]){const t=e?.[0]||[],i=Math.abs(hi(t));t.length>=4&&i>r&&(r=i,n=t.slice(0,-1).map(e=>[e[0],e[1]]))}return n}catch{return null}}function oa(e,t,i,n=Math.max(2e-4*i,1e-9),r=[]){const o=[],s=[],a=new Map;for(const e of r){const t=a.get(e.hostId)||[];t.push(e),a.set(e.hostId,t)}const l=[],c=[],h=[];for(const n of e.room_drafts||[])for(let e=0;e+1<n.points.length;e++){const r=Number(n.segments[e]?.cm),s=po(Number.isFinite(r)?r:15,t,i)/2;if(!(s>0))continue;const a={a:n.points[e],b:n.points[e+1],halfDepth:s},c=Io(a);c&&(o.push(a),l.push(c))}const d=[];for(const n of e.partitions||[]){const e={a:n.a,b:n.b,halfDepth:po(n.cm,t,i)/2};if(!(e.halfDepth>0))continue;const r=Io(e);r&&(s.push(e),c.push(r),d.push({id:n.id,body:r}))}const u=[...o,...s];for(const{segmentIndex:e,wedge:t}of Bo(u,n)){const i=e<o.length?{list:l,at:e}:{list:c,at:e-o.length},n=ra(i.list[i.at],t);n&&(i.list[i.at]=n,e>=o.length&&(d[i.at].body=n))}for(const e of d)h.push(...na(e.body,a.get(e.id)||[],n));const p=(e.wall_columns||[]).map(e=>ta(e,t,i)),m=qo([...o,...s],n).flatMap(e=>na(e,r,n));return{drafts:l,partitions:c,columns:p,patches:m,all:[...l,...h,...m,...p]}}function sa(e){try{const t=e.map(e=>Js(e)).filter(e=>!!e).map(e=>Xs(e));return t.length?Mt(t[0],...t.slice(1)):null}catch{return null}}const aa=e=>`M ${e.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`;function la(e){const t=[];for(const i of e||[]){if(da([i])<=1e-6)continue;const e=[];for(const t of i||[]){const i=(t||[]).filter(e=>Array.isArray(e)&&e.length>=2);i.length<4||e.push(aa(i.slice(0,-1)))}e.length&&t.push(e.join(" "))}return t}function ca(e,t,i={}){const n=sa(e.filter(e=>e.length>=3)),r=t.some(e=>!Js(e))?null:sa(t);if(!n)return[];if(r)try{return la(Ct(n,r))}catch{}return function(e,t,i){let n=null;for(let r=0;r<t.length;r++){const o=sa([t[r]]);if(!o){i.onBoundsFailure?.({boundIndex:r,phase:"bound-union"});continue}let s;try{s=Ct(e,o)}catch{i.onBoundsFailure?.({boundIndex:r,phase:"bound-intersection"});continue}if(s?.length&&!(da(s)<=1e-12))if(n)try{n=Mt(n,s)}catch{i.onBoundsFailure?.({boundIndex:r,phase:"result-union"})}else n=s}return n?la(n):[]}(n,t,i)}function ha(e,t){if(!t.length)return[Xs(e)];try{const i=sa(t);if(i)return Tt(Xs(e),i)}catch{}let i=[Xs(e)];for(const e of t)if(!(e.length<3))try{i=Tt(i,Xs(e))}catch{}return i}function da(e){let t=0;for(const i of e||[])if(i?.length){t+=hi(i[0]||[]);for(let e=1;e<i.length;e++)t-=hi(i[e]||[])}return Math.max(0,t)}function ua(e){const t=[];for(const i of e||[])for(const e of i||[])e?.length>=4&&t.push(e.slice(0,-1).map(e=>[e[0],e[1]]));return t}function pa(e){const t=[];for(const i of e||[]){const e=i?.[0];e?.length>=4&&t.push(e.slice(0,-1).map(e=>[e[0],e[1]]))}return t}function ma(e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){const o=t[n][0],s=t[n][1],a=t[r][0],l=t[r][1];s>e[1]!=l>e[1]&&e[0]<(a-o)*(e[1]-s)/(l-s||1e-12)+o&&(i=!i)}return i}function _a(e,t,i){return function(e,t){for(const i of t||[]){const t=i?.[0];if(!t?.length||!ma(e,t))continue;let n=!1;for(let t=1;t<i.length;t++)if(i[t]?.length&&ma(e,i[t])){n=!0;break}if(!n)return!0}return!1}(e,t)||i.some(t=>ma(e,t))}function fa(e,t,i){if(Math.hypot(e.center[0]-t.center[0],e.center[1]-t.center[1])>i)return!1;if(Math.abs(Ks(e.cm)-Ks(t.cm))>1e-6)return!1;if(e.shape!==t.shape)return!0;if("circle"===e.shape||"circle"===t.shape)return!0;const n=Math.abs(Ys(e.angle)-Ys(t.angle));return Math.min(n,90-n)<=1e-6}const ga=2.54;function va(e){const t="number"==typeof e?e:NaN;return!Number.isFinite(t)||t<=0||5===t?1:5/t}function ya(e,t){return e*va(t)}function ba(e){return e?ga:1}function wa(e,t){if(!t)return String(e);const i=e/ga;return String(Math.round(1e6*i)/1e6)}function ka(e,t){return t?e*ga:e}const xa=1e3;function $a(e,t){const i=Number(e),n=Number.isFinite(i)&&i>0?i:1,r=n>=1?t:t*n,o=n>=1?t/n:t;return{x:(t-r)/2,y:(t-o)/2,w:r,h:o}}const Sa=.01,Ma=100;function Ca(e,t=1e3){const i=$a(e?.plan_aspect,t),n=Number(e?.plan_scale),r=Number.isFinite(n)&&n>0?Math.min(Ma,Math.max(Sa,n)):1,o=Number(e?.plan_scale_x),s=Number(e?.plan_scale_y),a=Number.isFinite(o)&&o>0?Math.min(Ma,Math.max(Sa,o)):r,l=Number.isFinite(s)&&s>0?Math.min(Ma,Math.max(Sa,s)):r,c=Number(e?.plan_x),h=Number(e?.plan_y),d=sr(e?.plan_angle);return{x:i.x+(Number.isFinite(c)?Ha(c):0)*t,y:i.y+(Number.isFinite(h)?Ha(h):0)*t,w:i.w*a,h:i.h*l,...d?{angle:d}:{}}}function Ta(e){if(null==e.x||null==e.y)return{x:e.x,y:e.y,w:e.w,h:e.h};const t=Number(e.w)||0,i=Number(e.h)||0;return{x:t<0?e.x+t:e.x,y:i<0?e.y+i:e.y,w:Math.abs(t),h:Math.abs(i)}}function Ra(e){return e&&Array.isArray(e.spaces)?e.spaces.map(e=>{const t=xa,i=function(e){return Array.isArray(e)&&4===e.length&&e.every(e=>Number.isFinite(e))&&e[2]>1e-6&&e[3]>1e-6?e:[0,0,1,1]}(e.view_box);return{id:e.id,title:e.title,cellCm:Number.isFinite(Number(e.cell_cm))&&Number(e.cell_cm)>0?Number(e.cell_cm):5,vb:[i[0]*xa,i[1]*t,i[2]*xa,i[3]*t],bg:e.plan_url?{href:vn(e.plan_url),...Ca(e,xa)}:null,rooms:(e.rooms||[]).map(e=>{const i={...e,...Ta(e)};return{id:i.id,name:i.name,area:i.area??null,open_to:i.open_to||void 0,settings:i.settings||void 0,x:null!=i.x?i.x*xa:void 0,y:null!=i.y?i.y*t:void 0,w:null!=i.w?i.w*xa:void 0,h:null!=i.h?i.h*t:void 0,poly:i.poly?i.poly.map(e=>[e[0]*xa,e[1]*t]):void 0,wall_ids:Array.isArray(i.wall_ids)?[...i.wall_ids]:void 0}}),wall_segments:(e.wall_segments||[]).map(e=>({...e,id:String(e.id),a:[Number(e.a?.[0])*xa,Number(e.a?.[1])*t],b:[Number(e.b?.[0])*xa,Number(e.b?.[1])*t],cm:Number(e.cm)})),room_drafts:(e.room_drafts||[]).map(e=>({id:e.id,points:(e.points||[]).map(e=>[e[0]*xa,e[1]*t]),segments:(e.segments||[]).map(e=>({..."string"==typeof e.id&&e.id?{id:e.id}:{},cm:Number(e.cm)}))})),partitions:(e.partitions||[]).map(e=>({id:e.id,a:[e.a[0]*xa,e.a[1]*t],b:[e.b[0]*xa,e.b[1]*t],cm:Number(e.cm)})),wall_columns:(e.wall_columns||[]).map(e=>({id:e.id,shape:"circle"===e.shape?"circle":"square",center:[e.center[0]*xa,e.center[1]*t],cm:Number(e.cm),..."circle"===e.shape?{}:{angle:Ys(e.angle)}}))}}):[]}const Da=5e3,za=Da*xa,Aa=240,Pa=xa/Aa,Oa=1/Aa;function Fa(e){if(!Number.isFinite(e))return e;const t=Math.round(e*Aa/xa)*xa/Aa;return Math.abs(t-e)<=1e-9*Pa?e:t}function Ia(e){return{x:Fa(e.x),y:Fa(e.y)}}function Ea(e){return Number.isFinite(e)?Math.min(za,Math.max(-za,e)):0}function Ha(e){return Number.isFinite(e)?Math.min(Da,Math.max(-Da,e)):0}const Na=1/3,La=200;function Ba(e){return"house"===e?"house":"content"}function qa(e){let t=1/0,i=1/0,n=-1/0,r=-1/0;for(const o of e){const e=Number(o[0]),s=Number(o[1]);Number.isFinite(e)&&Number.isFinite(s)&&(e<t&&(t=e),s<i&&(i=s),e>n&&(n=e),s>r&&(r=s))}return t>n?null:{minX:t,minY:i,maxX:n,maxY:r}}function Wa(e){const t=[],i=e=>{if(Array.isArray(e))if(e.length>=2&&Number.isFinite(Number(e[0]))&&Number.isFinite(Number(e[1])))t.push([Number(e[0]),Number(e[1])]);else for(const t of e)i(t)};return i(e),qa(t)}function ja(e,t){const i=Number.isFinite(t)&&t>0?t:0;return{minX:e.minX-i,minY:e.minY-i,maxX:e.maxX+i,maxY:e.maxY+i}}function Ua(e){return e.poly&&e.poly.length?qa(e.poly):null==e.x||null==e.y?null:qa([[e.x,e.y],[e.x+(e.w||0),e.y+(e.h||0)]])}function Va(e,t=1e3,i=1e3){const n=Number(e.x)*t,r=Number(e.y)*i,o=Number(e.w)*t,s=Number(e.h)*i;return![n,r,o,s].every(Number.isFinite)||o<=0||s<=0?null:qa(mr({x:n,y:r,w:o,h:s,angle:sr(e.angle)||void 0}))}function Ga(e,t){const i=[];for(const t of e.rooms||[]){const e=Ua(t);e&&i.push(e)}if(e.bg){const t=qa(mr(e.bg));t&&i.push(t)}for(const e of t||[])if(Array.isArray(e)){const t=qa([e]);t&&i.push(t)}else i.push(e);return i}const Ka=e=>{if(!e.length)return 0;const t=[...e].sort((e,t)=>e-t),i=t.length>>1;return t.length%2?t[i]:(t[i-1]+t[i])/2},Ya=e=>{let t=1/0,i=1/0,n=-1/0,r=-1/0;for(const o of e)o.minX<t&&(t=o.minX),o.minY<i&&(i=o.minY),o.maxX>n&&(n=o.maxX),o.maxY>r&&(r=o.maxY);return t>n||i>r?null:{x:t,y:i,w:n-t,h:r-i}};function Xa(e,t){let{x:i,y:n,w:r,h:o}=e;r<30&&(i=i+r/2-100,r=La),o<30&&(n=n+o/2-100,o=La);const s="number"==typeof t?{top:t,right:t,bottom:t,left:t}:t,a=Math.max(r,o),l=a*s.top,c=a*s.right,h=a*s.bottom,d=a*s.left;return{x:i-d,y:n-l,w:r+d+c,h:o+l+h}}function Za(e,t={}){const i=t.pad??.05,n=t.k??10,r=t.minSpread??50,o=e.filter(e=>Number.isFinite(e.minX)&&Number.isFinite(e.minY)&&Number.isFinite(e.maxX)&&Number.isFinite(e.maxY)&&Math.abs(e.minX)<=za&&Math.abs(e.maxX)<=za&&Math.abs(e.minY)<=za&&Math.abs(e.maxY)<=za);if(!o.length)return{core:null,all:null,outliers:0};const s=Ya(o);if(o.length<4){const e=Xa(s,i);return{core:e,all:e,outliers:0}}const a=o.map(e=>(e.minX+e.maxX)/2),l=o.map(e=>(e.minY+e.maxY)/2),c=Ka(a),h=Ka(l),d=o.map((e,t)=>Math.max(Math.abs(a[t]-c),Math.abs(l[t]-h))),u=Math.max(((e,t)=>e.length?e[Math.min(e.length-1,Math.max(0,Math.round(t*(e.length-1))))]:0)([...d].sort((e,t)=>e-t),.75),r),p=d.map(e=>e>n*u),m=p.filter(Boolean).length,_=m&&m<=o.length*Na?o.filter((e,t)=>!p[t]):o;return{core:Xa(Ya(_)||s,i),all:Xa(s,i),outliers:_===o?0:m}}function Ja(e){return Za(e,{pad:0}).all}function Qa(e,t,i=.05){const n=Za(Ga(e,t),{pad:i});if(n.core)return n.core;const r=e.vb&&4===e.vb.length&&e.vb[2]>0&&e.vb[3]>0?e.vb:[0,0,xa,xa];return{x:r[0],y:r[1],w:r[2],h:r[3]}}function el(e){const t=Qa(e);return{x:t.x+t.w/2,y:t.y+t.h/2}}function tl(e){const t=[];for(const i of e.rooms||[]){const e=Ua(i);e&&t.push(e)}const i=Za(t,{pad:0}).core,n=xa*va(e.cellCm??5);return i?Math.max(n,Math.min(za,Math.max(i.w,i.h))):n}function il(e,t,i,n=1){const r=Number(i),o=Number.isFinite(n)&&n>0?n:1;return!Number.isFinite(r)||r<=0?e*o:e*tl(t)*o/r}const nl=[1,2,5,10,20,50,100,200,500,1e3];function rl(e,t,i=7){if(!(e>0&&t>0&&Number.isFinite(t)))return null;const n=nl.find(n=>e*n*t>=i);if(void 0===n)return null;const r=nl.find(e=>e>=5*n)??5*n;return{fine:n,coarse:r}}function ol(e){if(e.poly&&e.poly.length){const t=e.poly.map(e=>e[0]),i=e.poly.map(e=>e[1]),n=Math.min(...t),r=Math.min(...i);return{x:n,y:r,w:Math.max(...t)-n,h:Math.max(...i)-r}}return{x:e.x??0,y:e.y??0,w:e.w??0,h:e.h??0}}function sl(e,t,i,n,r,o=new Set){const s=t[e.id];return!o.has(e.id)&&s&&s.s===e.space?{x:s.x*xa,y:s.y*xa}:n[e.id]?n[e.id]:Ia(el(r))}function al(e,t,i,n){const r=i["rl_"+(e.id||"")];if(r&&r.s===t)return{x:r.x*xa,y:r.y*xa};const o=function(e){if(e.poly){const t=e.poly.length;return[e.poly.reduce((e,t)=>e+t[0],0)/t,e.poly.reduce((e,t)=>e+t[1],0)/t]}return[e.x+e.w/2,e.y+.1*Math.min(e.w,e.h)]}(e);return Ia({x:o[0],y:o[1]})}const ll=["furniture","appliance","sanitary","other"],cl=[{id:"sofa",group:"furniture",category:"sofa",w:220,h:90,g:[["r",0,0,1,1],["l",.09,.26,.91,.26],["l",.09,.26,.09,1],["l",.91,.26,.91,1],["l",.5,.26,.5,1]]},{id:"armchair",group:"furniture",category:"armchair",w:90,h:85,g:[["r",0,0,1,1],["l",.14,.28,.86,.28],["l",.14,.28,.14,1],["l",.86,.28,.86,1]]},{id:"coffee_table",group:"furniture",category:"coffee_table",w:110,h:60,g:[["r",0,0,1,1],["r",.08,.14,.84,.72]]},{id:"table_dining",group:"furniture",category:"dining_table",w:140,h:80,g:[["r",0,0,1,1],["r",.06,.11,.88,.78]]},{id:"table_round",group:"furniture",category:"dining_table",w:120,h:120,g:[["e",.5,.5,.5,.5],["e",.5,.5,.41,.41]]},{id:"chair",group:"furniture",category:"chair",w:45,h:45,g:[["r",0,0,1,.18],["r",.06,.18,.88,.8]]},{id:"desk",group:"furniture",category:"work_table",w:120,h:60,g:[["r",0,0,1,1],["r",.63,.07,.31,.86],["l",.63,.5,.94,.5]]},{id:"bed_double",group:"furniture",category:"bed",w:160,h:200,g:[["r",0,0,1,1],["r",0,0,1,.07],["r",.06,.1,.4,.15],["r",.54,.1,.4,.15],["l",0,.33,1,.33]]},{id:"bed_single",group:"furniture",category:"bed",w:90,h:200,g:[["r",0,0,1,1],["r",0,0,1,.07],["r",.15,.1,.7,.15],["l",0,.33,1,.33]]},{id:"nightstand",group:"furniture",category:"nightstand",w:45,h:40,g:[["r",0,0,1,1],["r",.12,.14,.76,.33],["r",.12,.53,.76,.33]]},{id:"wardrobe",group:"furniture",category:"wardrobe",w:100,h:60,g:[["r",0,0,1,1],["l",0,.72,1,.72],["l",.5,.72,.5,1]]},{id:"bookshelf",group:"furniture",category:"wardrobe",w:80,h:30,g:[["r",0,0,1,1],["l",.34,0,.34,1],["l",.67,0,.67,1]]},{id:"fridge",group:"appliance",category:"fridge",w:60,h:65,g:[["r",0,0,1,1],["l",0,.36,1,.36],["l",.83,.44,.83,.64]]},{id:"stove",group:"appliance",category:"cooktop",w:60,h:60,g:[["r",0,0,1,1],["e",.29,.31,.15,.15],["e",.71,.31,.15,.15],["e",.29,.71,.15,.15],["e",.71,.71,.15,.15]]},{id:"dishwasher",group:"appliance",category:"dishwasher",w:60,h:60,g:[["r",0,0,1,1],["r",.1,.12,.8,.76],["e",.5,.5,.27,.27],["e",.5,.5,.13,.13]]},{id:"washer",group:"appliance",category:"washer",w:60,h:60,g:[["r",0,0,1,1],["l",.08,.17,.92,.17],["e",.5,.57,.3,.3],["e",.5,.57,.14,.14]]},{id:"dryer",group:"appliance",category:"dryer",w:60,h:60,g:[["r",0,0,1,1],["l",.08,.17,.92,.17],["e",.5,.57,.3,.3],["p",.36,.5,.5,.64,.64,.5]]},{id:"tv",group:"appliance",category:"tv",w:120,h:30,g:[["r",0,0,1,.42],["l",.5,.42,.5,.72],["l",.3,.72,.7,.72]]},{id:"ac",group:"appliance",category:"air_conditioner",w:90,h:25,g:[["r",0,0,1,1],["l",.05,.55,.95,.55],["l",.05,.79,.95,.79]]},{id:"water_heater",group:"appliance",category:"boiler",w:45,h:45,g:[["e",.5,.5,.5,.5],["e",.5,.5,.31,.31]]},{id:"toilet",group:"sanitary",category:"toilet",w:40,h:70,g:[["r",.06,0,.88,.2],["e",.5,.58,.37,.35],["e",.5,.58,.22,.2]]},{id:"bathtub",group:"sanitary",category:"bathtub",w:170,h:75,g:[["r",0,0,1,1],["r",.05,.11,.77,.78],["e",.89,.5,.045,.1]]},{id:"shower",group:"sanitary",category:"shower",w:90,h:90,g:[["r",0,0,1,1],["l",0,0,1,1],["l",1,0,0,1],["e",.5,.5,.08,.08]]},{id:"sink",group:"sanitary",category:"sink",w:60,h:45,g:[["r",0,0,1,1],["e",.5,.6,.34,.3],["e",.5,.15,.07,.07]]},{id:"kitchen_sink",group:"sanitary",category:"kitchen_sink",w:80,h:60,g:[["r",0,0,1,1],["r",.06,.24,.44,.64],["r",.54,.24,.4,.64],["e",.5,.12,.06,.06]]},{id:"bidet",group:"sanitary",category:"bidet",w:40,h:55,g:[["e",.5,.5,.44,.5],["e",.5,.5,.26,.3]]},{id:"stairs",group:"other",category:"stairs",w:100,h:280,g:[["r",0,0,1,1],["l",0,.111,1,.111],["l",0,.222,1,.222],["l",0,.333,1,.333],["l",0,.444,1,.444],["l",0,.556,1,.556],["l",0,.667,1,.667],["l",0,.778,1,.778],["l",0,.889,1,.889],["l",.5,.93,.5,.06],["p",.38,.16,.5,.06,.62,.16]]},{id:"fireplace",group:"other",category:"fireplace",w:120,h:40,g:[["r",0,0,1,1],["p",.22,1,.22,.42,.78,.42,.78,1]]},{id:"plant",group:"other",category:"plant",w:40,h:40,g:[["e",.5,.5,.22,.22],["l",.5,.28,.5,.02],["l",.5,.72,.5,.98],["l",.28,.5,.02,.5],["l",.72,.5,.98,.5],["l",.34,.34,.13,.13],["l",.66,.66,.87,.87],["l",.66,.34,.87,.13],["l",.34,.66,.13,.87]]},{id:"rug",group:"other",category:"rug",w:200,h:140,g:[["r",0,0,1,1],["r",.06,.09,.88,.82]]}],hl=new Set(["fridge","dishwasher","washer","dryer","ac","water_heater","shower","sink","stairs","fireplace","plant","rug"]),dl=[...[{id:"coffee_table",group:"furniture",category:"coffee_table",w:120,h:60,art:{d:"M3.84 5.884c0-1.21 1.048-2.192 2.34-2.192h107.64c1.293 0 2.34.981 2.34 2.192v48.23c0 1.212-1.047 2.193-2.34 2.193H6.18c-1.292 0-2.34-.981-2.34-2.192z M103.056 15.093V9.83a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m0 35.078v-5.262a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m-93.6-35.077V9.83a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m0 35.078v-5.262a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877",viewW:120,viewH:60}},{id:"coffee_table_round",group:"furniture",category:"coffee_table",w:80,h:80,art:{d:"M3.765 40a36.235 36.235 0 1 0 72.47 0 36.235 36.235 0 1 0-72.47 0 m56.26 26.96-3.843-3.843a.906.906 0 0 1 0-1.28l3.843-3.844a.906.906 0 0 1 1.281 0l3.844 3.843a.906.906 0 0 1 0 1.281l-3.844 3.844a.906.906 0 0 1-1.28 0m-.001 34.66-3.843-3.843a.906.906 0 0 1 0-1.281l3.843-3.844a.906.906 0 0 1 1.281 0l3.843 3.844a.906.906 0 0 1 0 1.28l-3.843 3.844a.906.906 0 0 1-1.281 0m-34.423-34.66-3.843-3.843a.906.906 0 0 1 0-1.281l3.843-3.844a.906.906 0 0 1 1.281 0l3.844 3.844a.906.906 0 0 1 0 1.28l-3.844 3.844a.906.906 0 0 1-1.28 0m-.001 34.66-3.843-3.843a.906.906 0 0 1 0-1.281l3.843-3.843a.906.906 0 0 1 1.281 0l3.844 3.843a.906.906 0 0 1 0 1.281l-3.844 3.843a.906.906 0 0 1-1.28 0",viewW:80,viewH:80}},{id:"coffee_table_oval",group:"furniture",category:"coffee_table",w:120,h:60,art:{d:"M3.84 30c0-14.53 12.572-26.308 28.08-26.308h56.16c15.509 0 28.08 11.778 28.08 26.308s-12.571 26.307-28.08 26.307H31.92C16.412 56.307 3.84 44.53 3.84 30 M80.592 15.093V9.83a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m0 35.077v-5.262a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877M31.92 15.093V9.83a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.876h-5.616a.936.877 0 0 1-.936-.876m0 35.077v-5.262a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.876h-5.616a.936.877 0 0 1-.936-.876",viewW:120,viewH:60}},{id:"coffee_table_rounded",group:"furniture",category:"coffee_table",w:120,h:60,art:{d:"M3.84 12.461c0-4.843 4.19-8.77 9.36-8.77h93.6c5.17 0 9.36 3.927 9.36 8.77v35.077c0 4.843-4.19 8.77-9.36 8.77H13.2c-5.17 0-9.36-3.927-9.36-8.77z M103.056 15.093V9.83a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m0 35.078v-5.262a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m-93.6-35.077V9.83a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877m0 35.078v-5.262a.936.877 0 0 1 .936-.877h5.616a.936.877 0 0 1 .936.877v5.262a.936.877 0 0 1-.936.877h-5.616a.936.877 0 0 1-.936-.877",viewW:120,viewH:60}},{id:"table_dining",group:"furniture",category:"dining_table",w:160,h:90,art:{d:"M3.879 6.08c0-1.265 1.065-2.29 2.378-2.29h147.484c1.314 0 2.38 1.025 2.38 2.29v77.84c0 1.265-1.066 2.29-2.38 2.29H6.257c-1.313 0-2.378-1.025-2.378-2.29z M138.994 19.358v-5.495a.952.916 0 0 1 .951-.915h5.71a.952.916 0 0 1 .95.915v5.495a.952.916 0 0 1-.95.916h-5.71a.952.916 0 0 1-.951-.916m-.001 56.778v-5.495a.952.916 0 0 1 .952-.915h5.709a.952.916 0 0 1 .951.915v5.495a.952.916 0 0 1-.951.916h-5.71a.952.916 0 0 1-.95-.916m-125.6-56.778v-5.495a.952.916 0 0 1 .951-.916h5.71a.952.916 0 0 1 .95.916v5.495a.952.916 0 0 1-.95.915h-5.71a.952.916 0 0 1-.951-.915m-.001 56.779v-5.495a.952.916 0 0 1 .952-.916h5.709a.952.916 0 0 1 .951.916v5.495a.952.916 0 0 1-.951.915h-5.71a.952.916 0 0 1-.95-.915",viewW:160,viewH:90}},{id:"table_round",group:"furniture",category:"dining_table",w:110,h:110,art:{d:"M3.826 55a51.174 51.174 0 1 0 102.349 0A51.174 51.174 0 1 0 3.826 55 m81.005 32.303-3.947-3.947a.93.93 0 0 1 0-1.316l3.947-3.948a.93.93 0 0 1 1.316 0l3.948 3.948a.93.93 0 0 1 0 1.316l-3.948 3.947a.93.93 0 0 1-1.316 0m0 54.897-3.947-3.948a.93.93 0 0 1 0-1.316l3.947-3.947a.93.93 0 0 1 1.316 0l3.948 3.947a.93.93 0 0 1 0 1.316L82.32 87.2a.93.93 0 0 1-1.316 0M27.04 32.304l-3.947-3.948a.93.93 0 0 1 0-1.315l3.948-3.948a.93.93 0 0 1 1.315 0l3.948 3.948a.93.93 0 0 1 0 1.315l-3.948 3.948a.93.93 0 0 1-1.315 0m-.001 54.604-3.947-3.948a.93.93 0 0 1 0-1.316l3.948-3.947a.93.93 0 0 1 1.315 0l3.948 3.947a.93.93 0 0 1 0 1.316l-3.948 3.948a.93.93 0 0 1-1.315 0",viewW:110,viewH:110}},{id:"table_dining_oval",group:"furniture",category:"dining_table",w:180,h:100,art:{d:"M3.892 50c0-25.51 21.418-46.19 47.838-46.19h76.54c26.42 0 47.839 20.68 47.839 46.19S154.69 96.19 128.27 96.19H51.73C25.31 96.19 3.892 75.51 3.892 50 M122.53 19.514V13.97a.957.924 0 0 1 .956-.924h5.74a.957.924 0 0 1 .958.924v5.543a.957.924 0 0 1-.957.924h-5.74a.957.924 0 0 1-.958-.924m.001 66.516v-5.543a.957.924 0 0 1 .957-.924h5.74a.957.924 0 0 1 .957.924v5.543a.957.924 0 0 1-.957.924h-5.74a.957.924 0 0 1-.957-.924M49.816 19.515v-5.543a.957.924 0 0 1 .957-.924h5.74a.957.924 0 0 1 .958.924v5.542a.957.924 0 0 1-.957.924h-5.74a.957.924 0 0 1-.958-.924m0 66.516v-5.543a.957.924 0 0 1 .957-.924h5.74a.957.924 0 0 1 .957.924v5.543a.957.924 0 0 1-.957.923h-5.74a.957.924 0 0 1-.957-.924",viewW:180,viewH:100}},{id:"table_dining_rounded",group:"furniture",category:"dining_table",w:160,h:90,art:{d:"M3.879 17.527c0-7.587 6.39-13.737 14.272-13.737h123.696c7.883 0 14.273 6.15 14.273 13.737v54.947c0 7.587-6.39 13.737-14.273 13.737H18.151c-7.882 0-14.272-6.15-14.272-13.737z M138.994 19.358v-5.495a.952.916 0 0 1 .951-.915h5.71a.952.916 0 0 1 .95.915v5.495a.952.916 0 0 1-.95.916h-5.71a.952.916 0 0 1-.951-.916m-.001 56.778v-5.495a.952.916 0 0 1 .952-.915h5.709a.952.916 0 0 1 .951.915v5.495a.952.916 0 0 1-.951.916h-5.71a.952.916 0 0 1-.95-.916m-125.6-56.778v-5.495a.952.916 0 0 1 .951-.916h5.71a.952.916 0 0 1 .95.916v5.495a.952.916 0 0 1-.95.915h-5.71a.952.916 0 0 1-.951-.915m-.001 56.779v-5.495a.952.916 0 0 1 .952-.916h5.709a.952.916 0 0 1 .951.916v5.495a.952.916 0 0 1-.951.915h-5.71a.952.916 0 0 1-.95-.915",viewW:160,viewH:90}},{id:"desk",group:"furniture",category:"work_table",w:140,h:70,art:{d:"M3.862 5.967c0-1.234 1.057-2.234 2.362-2.234h127.552c1.305 0 2.362 1 2.362 2.234v58.066c0 1.234-1.057 2.233-2.362 2.233H6.224c-1.305 0-2.362-1-2.362-2.233z M9.531 15.346v-5.36a.945.893 0 0 1 .945-.893h5.67a.945.893 0 0 1 .944.893v5.36a.945.893 0 0 1-.945.894h-5.669a.945.893 0 0 1-.945-.894m113.379.001v-5.36a.945.893 0 0 1 .945-.894h5.67a.945.893 0 0 1 .944.894v5.36a.945.893 0 0 1-.945.893h-5.669a.945.893 0 0 1-.945-.893M9.53 60.013v-5.36a.945.893 0 0 1 .946-.893h5.669a.945.893 0 0 1 .945.893v5.36a.945.893 0 0 1-.945.894h-5.67a.945.893 0 0 1-.944-.894m113.38.001v-5.36a.945.893 0 0 1 .945-.894h5.669a.945.893 0 0 1 .945.894v5.36a.945.893 0 0 1-.945.893h-5.67a.945.893 0 0 1-.944-.893m-97.318-2.681h88.814",viewW:140,viewH:70}},{id:"desk_corner",group:"furniture",category:"work_table",w:160,h:160,art:{d:"M156.12 66.202a2.38 2.38 0 0 1-2.379 2.38H94.272c-13.138 0-23.788 10.65-23.788 23.787v61.372a2.38 2.38 0 0 1-2.379 2.38H6.257a2.38 2.38 0 0 1-2.378-2.38V6.257A2.38 2.38 0 0 1 6.257 3.88h147.484a2.38 2.38 0 0 1 2.38 2.378z M9.588 16.249v-5.71a.95.95 0 0 1 .951-.95h5.71a.95.95 0 0 1 .95.95v5.71a.95.95 0 0 1-.95.951h-5.71a.95.95 0 0 1-.951-.951m133.212.001v-5.71a.95.95 0 0 1 .951-.951h5.71a.95.95 0 0 1 .95.951v5.71a.95.95 0 0 1-.95.951h-5.71a.95.95 0 0 1-.951-.951m0 45.672v-5.71a.95.95 0 0 1 .952-.951h5.709a.95.95 0 0 1 .951.951v5.71a.95.95 0 0 1-.951.951h-5.71a.95.95 0 0 1-.95-.951M9.587 149.46v-5.708a.95.95 0 0 1 .952-.952h5.709a.95.95 0 0 1 .951.952v5.709a.95.95 0 0 1-.951.951h-5.71a.95.95 0 0 1-.951-.951m47.576 0v-5.709a.95.95 0 0 1 .952-.951h5.709a.95.95 0 0 1 .951.951v5.71a.95.95 0 0 1-.951.95h-5.71a.95.95 0 0 1-.951-.95m51.382-90.396H95.569a34.6 34.6 0 0 0-34.6 34.6v12.976",viewW:160,viewH:160}},{id:"chair",group:"furniture",category:"chair",w:50,h:50,art:{d:"M39.452 12.433H10.548a4.398 4.398 0 1 1 0-8.796h28.904a4.398 4.398 0 0 1 0 8.796m-28.904 0H8.035a4.4 4.4 0 0 0-4.398 4.399V40.08a6.283 6.283 0 0 0 6.283 6.284h30.16a6.283 6.283 0 0 0 6.284-6.284V16.832c0-2.43-1.97-4.399-4.399-4.399h-2.513",viewW:50,viewH:50}},{id:"chair_bar",group:"furniture",category:"chair",w:45,h:48,art:{d:"M38.579 17.168c1.326 2.526 1.947 6.015 1.947 9.071 0 10.018-8.07 18.139-18.025 18.139S4.475 36.257 4.475 26.239c0-3.056.586-6.552 1.912-9.078m32.192.007a3.59 3.59 0 0 1-3.333-.976m3.333.976a3.6 3.6 0 0 0 1.765-.976m-33.827.996-.13-.027a3.6 3.6 0 0 1-1.731-.969m30.59 0a18 18 0 0 0-5.848-3.932 17.93 17.93 0 0 0-13.796 0 18 18 0 0 0-5.848 3.932 3.59 3.59 0 0 1-3.237.996m28.729-.996a3.59 3.59 0 0 0 5.098 0m-33.827.996a3.6 3.6 0 0 1-1.861-.996 3.644 3.644 0 0 1 0-5.13 25.2 25.2 0 0 1 8.187-5.505A25.1 25.1 0 0 1 22.5 3.623a25.1 25.1 0 0 1 9.657 1.934 25.2 25.2 0 0 1 8.187 5.505 3.644 3.644 0 0 1 0 5.13",viewW:45,viewH:48}},{id:"armchair",group:"furniture",category:"armchair",w:90,h:90,art:{d:"M75.702 13.011q.012-.225.012-.453c0-4.843-3.917-8.768-8.748-8.768H23.034c-4.83 0-8.747 3.925-8.747 8.768q0 .228.011.453M77.132 72.09q.59.091 1.206.092c4.348 0 7.873-3.533 7.873-7.892V20.45c0-4.359-3.525-7.892-7.873-7.892-.924 0-1.812.16-2.636.453a7.89 7.89 0 0 0-5.237 7.438v.148m0 0a8.7 8.7 0 0 1-3.499.73H23.034a8.7 8.7 0 0 1-3.499-.73m50.93 0V64.29a7.89 7.89 0 0 0 6.667 7.8M14.298 13.01a7.89 7.89 0 0 1 5.237 7.438v.148m0 0V64.29a7.89 7.89 0 0 1-6.666 7.8q-.59.091-1.206.092c-4.348 0-7.873-3.533-7.873-7.892V20.45c0-4.359 3.525-7.892 7.873-7.892.924 0 1.811.16 2.635.453M77.132 72.09c-1.585 8.05-8.667 14.12-17.164 14.12H30.032c-8.496 0-15.578-6.07-17.163-14.12",viewW:90,viewH:90}},{id:"armchair_office",group:"furniture",category:"armchair",w:65,h:65,art:{d:"M56.968 18.845q0-.368-.05-.72M49.051 13.8H15.95a5.04 5.04 0 0 1-5.038-5.043 5.04 5.04 0 0 1 5.038-5.043h33.103a5.04 5.04 0 0 1 5.038 5.043 5.04 5.04 0 0 1-5.038 5.043m-33.103 0h-2.88a5.04 5.04 0 0 0-4.986 4.323M49.052 13.8h2.879a5.04 5.04 0 0 1 4.986 4.324m.051 24.826a4.32 4.32 0 0 0 4.318-4.323v-16.18a4.32 4.32 0 0 0-4.369-4.322m.051 24.826a4.32 4.32 0 0 1-4.318-4.323V22.447a4.32 4.32 0 0 1 4.267-4.322m-11.84 37.24h4.695c.736 0 1.446-.111 2.115-.317a7.21 7.21 0 0 0 5.081-6.889v-5.208M8.084 18.124h-.051a4.32 4.32 0 0 0-4.318 4.323v16.18a4.32 4.32 0 0 0 4.318 4.324 4.32 4.32 0 0 0 4.317-4.323V22.447a4.32 4.32 0 0 0-4.266-4.323m11.935 37.24h-4.79a7.2 7.2 0 0 1-2.04-.294 7.21 7.21 0 0 1-5.156-6.91v-5.21m37.045 12.414 5.177 5.183c.969.97 2.534.987 3.524.038a2.526 2.526 0 0 0 .038-3.605l-1.93-1.932m-6.81.316H20.02m-6.83-.294-1.909 1.91c-.998 1-.98 2.627.038 3.605.99.949 2.555.932 3.524-.038l5.177-5.183",viewW:65,viewH:65}},{id:"sofa",group:"furniture",category:"sofa",w:180,h:90,art:{d:"M90 19.365v57.111m0-57.11V7.683m0 11.681c0 2.151-1.836 3.894-4.1 3.894H30.544a10.7 10.7 0 0 1-4.136-.825M90 19.365c0 2.151 1.836 3.894 4.1 3.894h55.356c1.472 0 2.871-.294 4.137-.825M90 76.476c0 5.376-4.59 9.735-10.25 9.735H30.543c-5.266 0-9.605-3.772-10.185-8.625M90 76.476c0 5.376 4.59 9.735 10.25 9.735h49.206c5.266 0 9.605-3.772 10.185-8.625M90 7.684c0-2.15-1.837-3.894-4.101-3.894H30.544c-5.661 0-10.25 4.358-10.25 9.735q0 .416.036.825M90 7.684c0-2.15 1.836-3.894 4.1-3.894h55.356c5.661 0 10.25 4.358 10.25 9.735q0 .416-.036.825m0 0a10.7 10.7 0 0 1 4.137-.825h2.05c5.662 0 10.252 4.358 10.252 9.734v45.43c0 5.376-4.59 9.734-10.251 9.734h-2.05c-1.484 0-2.894-.3-4.167-.837m0 0c-3.585-1.517-6.084-4.93-6.084-8.898V23.26q0-.417.036-.825c.32-3.622 2.728-6.68 6.077-8.084m-139.34 0c3.35 1.404 5.758 4.462 6.078 8.084q.036.408.036.825v45.43c0 3.967-2.5 7.38-6.085 8.897a10.7 10.7 0 0 1-4.166.837h-2.05c-5.662 0-10.251-4.358-10.251-9.735V23.26c0-5.376 4.59-9.734 10.25-9.734h2.05c1.473 0 2.872.294 4.138.825",viewW:180,viewH:90}},{id:"sofa_three_seat",group:"furniture",category:"sofa",w:240,h:90,art:{d:"M86.553 18.593V76.96m0-58.366V7.491m0 11.102c0 2.044-1.762 3.701-3.935 3.701H29.496c-1.413 0-2.756-.28-3.97-.784m61.027-2.917c0 2.044 1.762 3.701 3.935 3.701h59.024c2.174 0 3.935-1.657 3.935-3.7M86.553 76.958c0 5.11-4.404 9.252-9.837 9.252h-47.22c-5.054 0-9.218-3.585-9.775-8.198m66.832-1.054c0 5.11 4.404 9.252 9.837 9.252h47.22c5.433 0 9.837-4.142 9.837-9.252m0-58.366V76.96m0-58.366V7.491m0 11.102c0 2.044 1.762 3.701 3.936 3.701h53.122c1.413 0 2.756-.28 3.97-.784m-61.028 55.449c0 5.11 4.405 9.252 9.838 9.252h47.22c5.054 0 9.218-3.585 9.775-8.198M86.553 7.491c0-2.044-1.762-3.701-3.935-3.701H29.496c-5.433 0-9.838 4.142-9.838 9.252q0 .396.035.784m66.86-6.335c0-2.044 1.762-3.701 3.935-3.701h59.024c2.174 0 3.935 1.657 3.935 3.7m0 0c0-2.043 1.762-3.7 3.936-3.7h53.122c5.433 0 9.838 4.142 9.838 9.252 0 .258.022.517 0 .77m-.063 64.201c1.22.512 2.574.796 3.998.796h1.967c5.433 0 9.837-4.142 9.837-9.252V22.294c0-5.11-4.404-9.252-9.837-9.252h-1.967c-5.153 0-9.38 3.725-9.803 8.468q-.036.387-.035.784v47.263c0 3.771 2.399 7.015 5.84 8.456M19.693 13.826a10.3 10.3 0 0 0-3.97-.784h-1.967c-5.433 0-9.838 4.142-9.838 9.252v47.263c0 5.11 4.405 9.252 9.838 9.252h1.967c1.424 0 2.777-.284 3.998-.796 3.441-1.441 5.84-4.685 5.84-8.456V22.294a9 9 0 0 0-.035-.784c-.307-3.443-2.618-6.349-5.833-7.684",viewW:240,viewH:90}},{id:"sofa_corner_right",group:"furniture",category:"sofa",w:260,h:170,art:{d:"M93.673 20.687V83.69m0-63.004v-12.6m0 12.6c0 2.32-1.913 4.2-4.273 4.2H31.704a10.8 10.8 0 0 1-4.311-.89m66.28-3.31c0 2.32 1.914 4.2 4.274 4.2h64.106c2.36 0 4.274-1.88 4.274-4.2M93.673 83.692c0 5.8-4.783 10.501-10.684 10.501H31.704c-5.489 0-10.011-4.068-10.616-9.304m72.585-1.197c0 5.8 4.784 10.501 10.684 10.501h51.286c5.9 0 10.684-4.701 10.684-10.5m0-63.005V83.69m0-63.004v-12.6m0 12.6c0 2.32 1.914 4.2 4.273 4.2h57.696c1.534 0 2.993-.317 4.312-.89m-66.28 59.695v71.923c0 5.799 4.782 10.5 10.684 10.5h51.284c5.49 0 10.012-4.068 10.616-9.304V84.888M93.673 8.086c0-2.32-1.913-4.2-4.273-4.2H31.704c-5.9 0-10.684 4.7-10.684 10.5q0 .45.038.89m72.615-7.19c0-2.32 1.914-4.2 4.274-4.2h64.106c2.36 0 4.274 1.88 4.274 4.2m0 0c0-2.32 1.914-4.2 4.273-4.2h57.696c5.9 0 10.685 4.7 10.685 10.5 0 .293.024.587 0 .874m-.07 69.628c1.327.58 2.797.904 4.344.904h2.136c5.901 0 10.684-4.702 10.684-10.501V24.887c0-5.8-4.783-10.5-10.684-10.5h-2.136c-5.596 0-10.187 4.227-10.647 9.61q-.038.44-.038.89V75.29c0 4.28 2.605 7.961 6.342 9.597M21.059 15.276a10.8 10.8 0 0 0-4.312-.89H14.61c-5.9 0-10.684 4.701-10.684 10.5v50.405c0 5.8 4.783 10.5 10.684 10.5h2.137c1.546 0 3.016-.322 4.342-.903 3.737-1.636 6.342-5.317 6.342-9.597V24.887q0-.45-.037-.89c-.334-3.907-2.844-7.206-6.335-8.72",viewW:260,viewH:170}},{id:"bed_single",group:"furniture",category:"bed",w:90,h:200,art:{d:"M3.79 14.024c0 5.59 4.318 10.122 9.645 10.122h63.13c5.328 0 9.646-4.532 9.646-10.122m-22.797 46.93V46.23c0-5.082-3.926-9.201-8.769-9.201h-19.29c-4.842 0-8.768 4.12-8.768 9.201v14.723m-22.797 0h82.42m0 22.085H3.79m8.768 113.06h64.885c4.842 0 8.768-4.12 8.768-9.202V13.104c0-5.082-3.926-9.202-8.768-9.202H12.558c-4.843 0-8.768 4.12-8.768 9.202v173.792c0 5.082 3.925 9.202 8.768 9.202",viewW:90,viewH:200}},{id:"bed_double",group:"furniture",category:"bed",w:160,h:200,art:{d:"M3.879 14.073c0 5.618 4.516 10.172 10.088 10.172h132.065c5.571 0 10.088-4.554 10.088-10.172m-81.165 47.16V46.438c0-5.107-4.106-9.247-9.171-9.247H45.607c-5.065 0-9.17 4.14-9.17 9.247v14.795m89.877 0V46.438c0-5.107-4.107-9.247-9.172-9.247H96.966c-5.065 0-9.171 4.14-9.171 9.247v14.795m-83.916 0H156.12m0 22.192H3.88m9.17 112.673h133.9c5.065 0 9.171-4.14 9.171-9.247V13.15c0-5.107-4.106-9.247-9.171-9.247H13.05c-5.064 0-9.17 4.14-9.17 9.247v173.7c0 5.107 4.106 9.247 9.17 9.247",viewW:160,viewH:200}},{id:"nightstand",group:"furniture",category:"nightstand",w:50,h:40,art:{d:"M5.773 3.555h38.454a2.136 2.056 0 0 1 2.137 2.056v28.777a2.136 2.056 0 0 1-2.137 2.056H5.773a2.136 2.056 0 0 1-2.136-2.056V5.611a2.136 2.056 0 0 1 2.136-2.056",viewW:50,viewH:40}},{id:"cabinet_tv",group:"furniture",category:"nightstand",w:140,h:45,art:{d:"M56.772 17.88h5.315m0 0h5.315m-5.315 0v9.214m9.832-9.214 5.315 9.45 5.314-9.45M6.224 41.4h127.552c1.305 0 2.362-.94 2.362-2.1V5.7c0-1.16-1.057-2.1-2.362-2.1H6.224c-1.305 0-2.362.94-2.362 2.1v33.6c0 1.16 1.057 2.1 2.362 2.1",viewW:140,viewH:45}},{id:"cabinet_shoe",group:"furniture",category:"nightstand",w:80,h:35,art:{d:"m39.722 16.231 1.505-1.596m1.134 3.15 1.53-1.738M6.03 31.5h67.94c1.251 0 2.265-.895 2.265-2v-24c0-1.105-1.014-2-2.264-2H6.03c-1.251 0-2.265.895-2.265 2v24c0 1.105 1.014 2 2.265 2m41.966-14.305L46.92 17.1a3.4 3.4 0 0 1-1.813-.706l-4.583-3.62c-1.264-1-3.277-.326-3.475 1.161-.185 1.39-1.983 2.1-3.28 1.299l-1.532-.947c-.968-.513-2.2.103-2.2 1.1v3.463c0 1.559 1.43 2.823 3.196 2.823h14.51c1.404 0 2.542-1.005 2.542-2.245 0-1.153-.99-2.118-2.289-2.233",viewW:80,viewH:35}},{id:"cabinet_sink",group:"furniture",category:"nightstand",w:80,h:50,art:{d:"M3.765 5.773c0-1.18 1.014-2.136 2.265-2.136h67.94c1.251 0 2.265.956 2.265 2.136v38.454c0 1.18-1.014 2.137-2.264 2.137H6.03c-1.251 0-2.265-.957-2.265-2.137z M36.088 32.135c2.525 1.88 6.205 1.88 8.73 0s3.167-5.101 1.52-7.637l-5.879-8.043-5.893 8.043c-1.644 2.536-1.003 5.755 1.522 7.637",viewW:80,viewH:50}},{id:"bookshelf",group:"furniture",category:"wardrobe",w:100,h:35,art:{d:"M57.12 20.488H45.473c-.514 0-1.008.124-1.372.345s-.568.52-.568.832m4.076-8.236h5.434M6.119 3.5h87.762c1.276 0 2.31.895 2.31 2v24c0 1.105-1.034 2-2.31 2H6.12c-1.275 0-2.31-.895-2.31-2v-24c0-1.105 1.035-2 2.31-2m51 6.4v14.118H45.474a2.04 2.04 0 0 1-1.372-.517 1.7 1.7 0 0 1-.568-1.248V11.665c0-.468.204-.917.568-1.248a2.04 2.04 0 0 1 1.372-.517z",viewW:100,viewH:35}},{id:"wall_unit",group:"furniture",category:"wardrobe",w:240,h:45,art:{d:"M6.336 41.4h227.328a2.418 2.1 0 0 0 2.418-2.1V5.7a2.418 2.1 0 0 0-2.418-2.1H6.336a2.418 2.1 0 0 0-2.418 2.1v33.6a2.418 2.1 0 0 0 2.418 2.1m43.744-5.88V9.48m46.432 26.04V9.48m46.433 26.04V9.48m46.433 26.04V9.48",viewW:240,viewH:45}},{id:"wardrobe",group:"furniture",category:"wardrobe",w:180,h:60,art:{d:"M93.87 20.25a3.3 3.3 0 0 0-1.072-2.407 3.8 3.8 0 0 0-2.586-.997c-.97 0-1.9.358-2.587.997a3.3 3.3 0 0 0-1.071 2.407c0 2.838 1.225 5.107 3.658 6.81h-.015m0 0 14.58 7.537c.57.295 1.046.726 1.377 1.25.331.523.505 1.12.505 1.727v1.401a3.3 3.3 0 0 1-1.071 2.407 3.8 3.8 0 0 1-2.587.998H77.393a3.8 3.8 0 0 1-2.586-.998 3.3 3.3 0 0 1-1.072-2.407v-1.4c0-.608.174-1.205.505-1.728a3.55 3.55 0 0 1 1.377-1.25zM6.284 3.691h167.433c1.32 0 2.392.981 2.392 2.192v48.23c0 1.212-1.071 2.193-2.392 2.193H6.284c-1.321 0-2.392-.981-2.392-2.192V5.885c0-1.212 1.07-2.193 2.392-2.193",viewW:180,viewH:60}},{id:"kitchen_floor",group:"furniture",category:"kitchen_cabinet",w:60,h:60,art:{d:"M3.692 5.884c0-1.21.981-2.192 2.192-2.192h48.23c1.212 0 2.193.981 2.193 2.192v48.23a2.19 2.19 0 0 1-2.192 2.193H5.885a2.19 2.19 0 0 1-2.193-2.192z",viewW:60,viewH:60}},{id:"kitchen_floor_corner",group:"furniture",category:"kitchen_cabinet",w:90,h:90,art:{d:"M45.944 41.767a2.29 2.29 0 0 0 2.29 2.29H83.92a2.29 2.29 0 0 1 2.29 2.29V83.92a2.29 2.29 0 0 1-2.29 2.29H6.08a2.29 2.29 0 0 1-2.29-2.29V6.08a2.29 2.29 0 0 1 2.29-2.29h37.576a2.29 2.29 0 0 1 2.29 2.29z",viewW:90,viewH:90}},{id:"kitchen_wall",group:"furniture",category:"kitchen_cabinet",w:60,h:35,art:{d:"m4.444 31.033 50.75-27.007m-50.752-.06 50.75 27.008M5.884 31.5h48.23c1.212 0 2.193-.895 2.193-2v-24c0-1.105-.981-2-2.192-2H5.885c-1.212 0-2.193.895-2.193 2v24c0 1.105.981 2 2.192 2",viewW:60,viewH:35}},{id:"kitchen_wall_corner",group:"furniture",category:"kitchen_cabinet",w:60,h:60,art:{d:"M3.772 29.59 29.88 4.383M4.57 55.43 55.43 30M4.175 4.383l26.701 23.863m-27.184.877L55.43 55.43M28.41 3.692H5.884c-1.21 0-2.192.981-2.192 2.192v48.23c0 1.212.981 2.193 2.192 2.193h48.23a2.19 2.19 0 0 0 2.193-2.192V31.589c0-1.21-.981-2.192-2.192-2.192h-21.32a2.19 2.19 0 0 1-2.193-2.192V5.885a2.19 2.19 0 0 0-2.192-2.193",viewW:60,viewH:60}},{id:"shelf_floor",group:"furniture",category:"shelving",w:100,h:35,art:{d:"M6.12 31.5h87.76a2.31 2 0 0 0 2.31-2v-24a2.31 2 0 0 0-2.31-2H6.12a2.31 2 0 0 0-2.31 2v24a2.31 2 0 0 0 2.31 2 M9.089 25.933c-.494.112-.776.546-.63.97s.664.675 1.157.564l-.263-.767zM90.912 9.067c.493-.112.775-.546.63-.97s-.664-.675-1.158-.564l.264.767zM11.875 26.956c.493-.112.775-.546.63-.97s-.664-.676-1.158-.564l.264.767zm3.988-2.556c-.493.112-.775.546-.63.969s.664.676 1.158.564l-.264-.766zm5.045.511c.493-.112.775-.545.63-.969s-.664-.676-1.158-.564l.264.766zm3.988-2.555c-.493.111-.775.545-.63.968.146.424.664.677 1.158.565l-.264-.767zm5.044.51c.494-.111.776-.545.63-.968-.145-.424-.664-.676-1.157-.565l.263.767zm3.99-2.555c-.495.112-.777.546-.63.97.145.423.663.675 1.157.563l-.264-.766zm5.043.511c.494-.112.776-.545.63-.969s-.664-.676-1.158-.564l.264.767zm3.989-2.555c-.494.111-.776.545-.63.969s.664.676 1.157.564l-.263-.767zm5.044.51c.494-.11.776-.545.63-.968-.146-.424-.664-.676-1.158-.565l.264.767zm3.989-2.555c-.494.112-.776.546-.63.97.145.423.664.675 1.157.564l-.264-.767zm5.044.511c.493-.111.775-.545.63-.969s-.664-.676-1.158-.564l.264.767zm3.988-2.555c-.493.112-.775.545-.63.969s.664.676 1.158.564l-.264-.767zm5.045.51c.493-.11.775-.545.63-.968-.146-.424-.664-.676-1.158-.564l.264.766zm3.988-2.555c-.493.112-.775.546-.63.97s.664.675 1.158.564l-.264-.767zm5.044.511c.494-.111.776-.545.63-.968-.145-.424-.664-.677-1.157-.565l.264.767zm3.99-2.555c-.494.112-.777.545-.63.969.145.423.663.676 1.157.564l-.264-.766zm5.043.511c.494-.112.776-.546.63-.969s-.664-.676-1.157-.564l.263.766zm3.989-2.556c-.494.112-.776.546-.63.97s.664.676 1.158.564l-.264-.767zM9.353 26.7l.263.767 2.259-.511-.264-.767-.264-.767-2.258.511zm6.774-1.533.264.766 4.517-1.022-.264-.767-.264-.766-4.517 1.022zm9.033-2.045.264.767 4.516-1.022-.264-.767-.263-.767-4.517 1.023zm9.033-2.044.264.766 4.516-1.022-.264-.766-.264-.767-4.516 1.022zm9.033-2.045.263.767 4.517-1.022-.264-.767-.264-.767-4.516 1.023zm9.032-2.044.264.767 4.517-1.023-.264-.766-.264-.767-4.516 1.022zm9.033-2.045.264.767 4.517-1.022-.264-.767-.264-.766-4.517 1.022zm9.033-2.044.264.767 4.516-1.023-.263-.766-.264-.767-4.517 1.022zm9.033-2.044.264.766 4.516-1.022-.264-.767-.263-.766-4.517 1.022zM88.39 8.81l.264.767 2.258-.511-.264-.767-.264-.767-2.258.511z M9.089 9.067c-.494-.112-.776-.546-.63-.97s.664-.675 1.157-.564l-.263.767zm81.823 16.866c.493.112.775.546.63.97s-.664.675-1.158.564l.264-.767zM11.875 8.044c.493.112.775.546.63.97s-.664.676-1.158.564l.264-.767zm3.988 2.556c-.493-.112-.775-.546-.63-.969s.664-.676 1.158-.564l-.264.766zm5.045-.511c.493.112.775.545.63.969s-.664.676-1.158.564l.264-.766zm3.988 2.555c-.493-.111-.775-.545-.63-.968.146-.424.664-.677 1.158-.565l-.264.767zm5.044-.51c.494.111.776.545.63.968-.145.424-.664.676-1.157.565l.263-.767zm3.99 2.555c-.495-.112-.777-.546-.63-.97.145-.423.663-.675 1.157-.563l-.264.766zm5.043-.511c.494.112.776.545.63.969s-.664.676-1.158.564l.264-.767zm3.989 2.555c-.494-.111-.776-.545-.63-.969s.664-.676 1.157-.564l-.263.767zm5.044-.51c.494.11.776.545.63.968-.146.424-.664.676-1.158.565l.264-.767zm3.989 2.555c-.494-.112-.776-.546-.63-.97.145-.423.664-.675 1.157-.564l-.264.767zm5.044-.511c.493.111.775.545.63.969s-.664.676-1.158.564l.264-.767zm3.988 2.555c-.493-.112-.775-.545-.63-.969s.664-.676 1.158-.564l-.264.767zm5.045-.51c.493.11.775.545.63.968-.146.424-.664.676-1.158.564l.264-.766zm3.988 2.555c-.493-.112-.775-.546-.63-.97s.664-.675 1.158-.564l-.264.767zm5.044-.511c.494.111.776.545.63.968-.145.424-.664.677-1.157.565l.264-.767zm3.99 2.555c-.494-.112-.777-.545-.63-.969.145-.423.663-.676 1.157-.564l-.264.766zm5.043-.511c.494.112.776.546.63.969s-.664.676-1.157.564l.263-.766zm3.989 2.556c-.494-.112-.776-.546-.63-.97s.664-.676 1.158-.564l-.264.767zM9.353 8.3l.263-.767 2.259.511-.264.767-.264.767-2.258-.511zm6.774 1.533.264-.766 4.517 1.022-.264.767-.264.766-4.517-1.022zm9.033 2.045.264-.767 4.516 1.022-.264.767-.263.767-4.517-1.023zm9.033 2.044.264-.766 4.516 1.022-.264.766-.264.767-4.516-1.022zm9.033 2.045.263-.767 4.517 1.022-.264.767-.264.767-4.516-1.023zm9.032 2.044.264-.767 4.517 1.023-.264.766-.264.767-4.516-1.022zm9.033 2.045.264-.767 4.517 1.022-.264.767-.264.766-4.517-1.022zm9.033 2.044.264-.767 4.516 1.023-.263.766-.264.767-4.517-1.022zm9.033 2.044.264-.766 4.516 1.022-.264.767-.263.766-4.517-1.022zm9.033 2.045.264-.767 2.258.511-.264.767-.264.767-2.258-.511z",viewW:100,viewH:35}},{id:"shelf_wall",group:"furniture",category:"shelving",w:100,h:25,art:{d:"M18.36 3.15v2.567c0 1.012-1.034 1.833-2.31 1.833h-.924c-1.275 0-2.309-.82-2.309-1.833V3.15m73.905 0v2.567c0 1.012-1.034 1.833-2.31 1.833h-.924c-1.275 0-2.31-.82-2.31-1.833V3.15m-75.29 0H93.65c1.276 0 2.31.82 2.31 1.833V19.65c0 1.012-1.034 1.833-2.31 1.833H5.888c-1.275 0-2.31-.82-2.31-1.833V4.983c0-1.012 1.035-1.833 2.31-1.833",viewW:100,viewH:25}},{id:"cooktop_two",group:"appliance",category:"cooktop",w:30,h:50,art:{d:"M15 30.982v-1.71m3.086 5.128h1.542M15 39.527v-1.709M10.372 34.4h1.542M5.84 46.364h18.322c1.331 0 2.41-1.196 2.41-2.67V6.306c0-1.475-1.079-2.67-2.41-2.67H5.839c-1.331 0-2.41 1.195-2.41 2.67v37.386c0 1.475 1.079 2.67 2.41 2.67m14.56-29.91c0 3.304-2.417 5.982-5.4 5.982-2.981 0-5.4-2.678-5.4-5.981s2.419-5.982 5.4-5.982c2.983 0 5.4 2.678 5.4 5.982M18.858 34.4c0 2.36-1.727 4.273-3.857 4.273s-3.857-1.913-3.857-4.273S12.87 30.127 15 30.127s3.857 1.913 3.857 4.273",viewW:30,viewH:50}},{id:"stove",group:"appliance",category:"cooktop",w:60,h:60,art:{d:"M41.4 35.261a.877.877 0 1 0-1.754 0zm4.384 6.138a.877.877 0 1 0 0-1.753zM41.4 44.03a.877.877 0 1 0-1.753 0zm-4.384-2.63a.877.877 0 1 0 0-1.754zM5.885 3.691v.877h48.23V2.815H5.885zm50.422 2.192h-.877v48.23h1.754V5.885zm-2.192 50.423v-.877H5.885v1.754h48.23zM3.692 54.115h.877V5.885H2.815v48.23zm2.192 2.192v-.877a1.315 1.315 0 0 1-1.315-1.315H2.815a3.07 3.07 0 0 0 3.07 3.069zm50.423-2.192h-.877c0 .726-.589 1.315-1.315 1.315v1.754a3.07 3.07 0 0 0 3.069-3.07zM54.115 3.692v.877c.726 0 1.315.589 1.315 1.315h1.754a3.07 3.07 0 0 0-3.07-3.069zm-48.23 0v-.877a3.07 3.07 0 0 0-3.07 3.07h1.754c0-.727.589-1.316 1.315-1.316zm19.73 36.83h-.877a5.26 5.26 0 0 1-5.262 5.262v1.754a7.015 7.015 0 0 0 7.016-7.015zm-6.139 6.139v-.877a5.26 5.26 0 0 1-5.261-5.261h-1.754a7.015 7.015 0 0 0 7.015 7.015zm-6.138-6.138h.877a5.26 5.26 0 0 1 5.261-5.262v-1.754a7.015 7.015 0 0 0-7.015 7.016zm6.138-6.139v.877a5.26 5.26 0 0 1 5.262 5.262h1.754a7.015 7.015 0 0 0-7.016-7.016zm27.185-14.908h-.877a5.26 5.26 0 0 1-5.261 5.262v1.754a7.015 7.015 0 0 0 7.015-7.016zm-6.138 6.139v-.877a5.26 5.26 0 0 1-5.262-5.262h-1.754a7.015 7.015 0 0 0 7.016 7.016zm-6.139-6.139h.877a5.26 5.26 0 0 1 5.262-5.261v-1.754a7.015 7.015 0 0 0-7.016 7.015zm6.139-6.138v.877a5.26 5.26 0 0 1 5.261 5.261h1.754a7.015 7.015 0 0 0-7.015-7.015zm4.384 27.185h-.877a3.51 3.51 0 0 1-3.507 3.507v1.754a5.26 5.26 0 0 0 5.261-5.261zm-4.384 4.384v-.877a3.51 3.51 0 0 1-3.508-3.507H35.26a5.26 5.26 0 0 0 5.262 5.261zm-4.385-4.384h.877a3.51 3.51 0 0 1 3.508-3.508V35.26a5.26 5.26 0 0 0-5.262 5.262zm4.385-4.385v.877a3.51 3.51 0 0 1 3.507 3.508h1.754a5.26 5.26 0 0 0-5.261-5.262zm0 .877h.876V35.26h-1.753v1.754zm3.508 3.508v.876h1.753v-1.753h-1.753zm-3.508 5.261h.876V44.03h-1.753v1.754zm-5.261-5.261v.876h1.753v-1.753h-1.753zm-9.647-21.047h-.877a5.26 5.26 0 0 1-5.262 5.262v1.754a7.015 7.015 0 0 0 7.016-7.016zm-6.139 6.139v-.877a5.26 5.26 0 0 1-5.261-5.262h-1.754a7.015 7.015 0 0 0 7.015 7.016zm-6.138-6.139h.877a5.26 5.26 0 0 1 5.261-5.261v-1.754a7.015 7.015 0 0 0-7.015 7.015zm6.138-6.138v.877a5.26 5.26 0 0 1 5.262 5.261h1.754a7.015 7.015 0 0 0-7.016-7.015z",viewW:60,viewH:60}},{id:"tv",group:"appliance",category:"tv",w:120,h:28,art:{d:"M45.134 10.766H6.18c-1.292 0-2.34.848-2.34 1.894v2.68c0 1.045 1.048 1.893 2.34 1.893h38.954m0-6.467V5.288c0-1.046 1.048-1.894 2.34-1.894h26.704c1.292 0 2.34.848 2.34 1.894v5.478m-31.384 0h31.384m0 0h37.302c1.293 0 2.34.848 2.34 1.894v2.68c0 1.045-1.047 1.893-2.34 1.893H76.518m-31.384 0v5.479c0 1.046 1.048 1.894 2.34 1.894h26.704c1.292 0 2.34-.848 2.34-1.894v-5.479m-31.384 0h31.384",viewW:120,viewH:28}},{id:"tv_wall",group:"appliance",category:"tv",w:120,h:15,art:{d:"M35.664 11.4c-.517 0-.936.269-.936.6s.419.6.936.6zm49.553 1.2c.517 0 .936-.269.936-.6s-.42-.6-.936-.6zM6.18 3v.6h107.64V2.4H6.18zm109.98 1.5h-.936v1.8h1.872V4.5zm-2.34 3.3v-.6H6.18v1.2h107.64zM3.84 6.3h.936V4.5H2.904v1.8zm2.34 1.5v-.6c-.775 0-1.404-.403-1.404-.9H2.904c0 1.16 1.467 2.1 3.276 2.1zm109.98-1.5h-.936c0 .497-.629.9-1.404.9v1.2c1.81 0 3.276-.94 3.276-2.1zM113.82 3v.6c.775 0 1.404.403 1.404.9h1.872c0-1.16-1.467-2.1-3.276-2.1zM6.18 3v-.6c-1.81 0-3.276.94-3.276 2.1h1.872c0-.497.629-.9 1.404-.9zm61.308 4.2h-.936V12h1.872V7.2zM52.512 12h.936V7.2h-1.872V12zm-16.848 0v.6h49.553v-1.2H35.664z",viewW:120,viewH:15}},{id:"toilet",group:"sanitary",category:"toilet",w:40,h:70,art:{d:"M3.555 48.976c0 9.55 7.125 17.29 15.914 17.29h1.061c8.79 0 15.914-7.74 15.914-17.29V5.966c0-1.233-.92-2.233-2.056-2.233H5.611c-1.135 0-2.056 1-2.056 2.234z M7.666 49.12c0 7.003 5.225 12.68 11.67 12.68h1.327c6.445 0 11.67-5.677 11.67-12.68V31.873c0-1.233-.92-2.233-2.056-2.233H9.722c-1.135 0-2.056 1-2.056 2.233zM33.792 3.733c1.465 0 2.652 1.29 2.652 2.882v12.103c0 1.592-1.187 2.882-2.652 2.882H6.208c-1.465 0-2.653-1.29-2.653-2.882V6.615c0-1.591 1.188-2.882 2.653-2.882z M24.11 50.186c0 2.467-1.84 4.467-4.11 4.467s-4.111-2-4.111-4.467 1.84-4.466 4.11-4.466 4.112 2 4.112 4.466",viewW:40,viewH:70}},{id:"toilet_built_in",group:"sanitary",category:"toilet",w:40,h:55,art:{d:"M3.555 34.56c0 9.263 7.125 16.774 15.914 16.774h1.061c8.79 0 15.914-7.51 15.914-16.775V5.833c0-1.196-.92-2.166-2.056-2.166H5.611c-1.135 0-2.056.97-2.056 2.166z M7.666 34.7c0 6.793 5.225 12.3 11.67 12.3h1.327c6.445 0 11.67-5.507 11.67-12.3V14.5c0-1.197-.92-2.167-2.056-2.167H9.722c-1.135 0-2.056.97-2.056 2.167z M24.11 35.733c0 2.394-1.84 4.334-4.11 4.334s-4.111-1.94-4.111-4.334 1.84-4.333 4.11-4.333 4.112 1.94 4.112 4.333",viewW:40,viewH:55}},{id:"bathtub",group:"sanitary",category:"bathtub",w:170,h:75,art:{d:"M3.885 6c0-1.243 1.068-2.25 2.386-2.25h157.458c1.318 0 2.386 1.007 2.386 2.25v63c0 1.243-1.068 2.25-2.386 2.25H6.27c-1.318 0-2.386-1.007-2.386-2.25z M13.428 37.5c0-13.669 11.75-24.75 26.243-24.75h90.658c14.493 0 26.243 11.081 26.243 24.75s-11.75 24.75-26.243 24.75H39.67c-14.493 0-26.243-11.081-26.243-24.75 M31.56 37.5c0 2.237-1.923 4.05-4.295 4.05s-4.294-1.813-4.294-4.05 1.923-4.05 4.294-4.05c2.372 0 4.295 1.813 4.295 4.05",viewW:170,viewH:75}},{id:"bathtub_corner",group:"sanitary",category:"bathtub",w:140,h:140,art:{d:"M3.862 6.224a2.36 2.36 0 0 1 2.362-2.362H133.97c1.197 0 2.168.97 2.168 2.168 0 71.857-58.251 130.108-130.108 130.108a2.17 2.17 0 0 1-2.168-2.168z M13.31 32.207c0-10.437 8.46-18.897 18.897-18.897h87.628a2.13 2.13 0 0 1 2.13 2.13c0 58.833-47.692 106.526-106.524 106.526a2.13 2.13 0 0 1-2.13-2.131z M32.207 27.483a4.724 4.724 0 1 1-9.449 0 4.724 4.724 0 0 1 9.449 0",viewW:140,viewH:140}},{id:"bidet",group:"sanitary",category:"bidet",w:40,h:60,art:{d:"M22.466 3.692v10.085c0 1.21-.92 2.192-2.055 2.192h-.822c-1.136 0-2.056-.981-2.056-2.192V3.692m4.933 8.77h2.878c1.135 0 2.056-.982 2.056-2.193v-.877c0-1.21-.92-2.192-2.056-2.192h-2.878m-4.933 5.262h-2.878c-1.135 0-2.055-.982-2.055-2.193v-.877c0-1.21.92-2.192 2.055-2.192h2.878M5.611 3.692h28.777c1.136 0 2.056.981 2.056 2.192v33.45c0 9.374-7.125 16.973-15.914 16.973h-1.06c-8.79 0-15.915-7.599-15.915-16.972V5.885c0-1.212.92-2.193 2.056-2.193m4.11 15.785h20.556c1.136 0 2.056.981 2.056 2.192v17.807c0 6.874-5.225 12.447-11.67 12.447h-1.327c-6.445 0-11.67-5.573-11.67-12.447V21.67c0-1.21.92-2.192 2.056-2.192m13.567 7.892c0 1.937-1.472 3.508-3.288 3.508-1.817 0-3.29-1.57-3.29-3.508s1.473-3.507 3.29-3.507 3.288 1.57 3.288 3.507",viewW:40,viewH:60}},{id:"bidet_built_in",group:"sanitary",category:"bidet",w:40,h:50,art:{d:"M17.318 12.182h-8.06c-.88 0-1.592.74-1.592 1.654v16.126c0 6.698 5.225 12.129 11.67 12.129h1.327c6.445 0 11.67-5.43 11.67-12.13V13.837c0-.914-.713-1.654-1.591-1.654H22.68m-.215-8.545v9.827c0 1.18-.92 2.136-2.055 2.136h-.822c-1.136 0-2.056-.956-2.056-2.136V3.637m10.689 8.545V3.637m-16.445 0v8.545M5.611 3.637h28.777c1.136 0 2.056.956 2.056 2.136v24.051c0 9.135-7.125 16.54-15.914 16.54h-1.06c-8.79 0-15.915-7.405-15.915-16.54V5.773c0-1.18.92-2.136 2.056-2.136M23.289 23.29c0 1.888-1.473 3.418-3.29 3.418s-3.288-1.53-3.288-3.418 1.472-3.418 3.289-3.418c1.816 0 3.288 1.53 3.288 3.418",viewW:40,viewH:50}},{id:"kitchen_sink",group:"sanitary",category:"kitchen_sink",w:60,h:50,art:{d:"M38.188 8.7h10.598c1.211 0 2.193.956 2.193 2.136v28.2c0 1.18-.982 2.136-2.193 2.136H11.08c-1.21 0-2.192-.956-2.192-2.136v-28.2c0-1.18.981-2.136 2.192-2.136h10.599m10.885-5.128V15.11c0 1.18-.981 2.136-2.192 2.136h-.877c-1.21 0-2.192-.957-2.192-2.136V3.572m5.261 7.691h3.07c1.21 0 2.192-.956 2.192-2.136v-.855c0-1.18-.982-2.136-2.192-2.136h-3.07m-5.261 5.127h-3.07c-1.21 0-2.192-.956-2.192-2.136v-.855c0-1.18.982-2.136 2.193-2.136h3.069M5.817 46.299h48.231c1.21 0 2.192-.956 2.192-2.136V5.709c0-1.18-.981-2.137-2.192-2.137H5.818c-1.211 0-2.193.957-2.193 2.137v38.454c0 1.18.982 2.136 2.192 2.136M33.44 25.79c0 1.888-1.57 3.418-3.507 3.418s-3.508-1.53-3.508-3.418c0-1.887 1.57-3.418 3.508-3.418s3.507 1.53 3.507 3.418",viewW:60,viewH:50}},{id:"kitchen_sink_double",group:"sanitary",category:"kitchen_sink",w:90,h:50,art:{d:"M53.173 12.182c-.468 0-.847.354-.847.79s.38.79.847.79zm21.979 1.58c.467 0 .846-.353.846-.79 0-.436-.379-.79-.846-.79zM6.01 3.572v.79h77.842v-1.58H6.01zM86.14 5.71h-.847v38.454h1.694V5.709zM83.85 46.3v-.79H6.01v1.58h77.842zM3.72 44.163h.847V5.709H2.873v38.454zm2.29 2.136v-.79c-.797 0-1.443-.603-1.443-1.346H2.873c0 1.616 1.404 2.926 3.137 2.926zm80.131-2.136h-.847c0 .743-.646 1.346-1.442 1.346v1.58c1.732 0 3.136-1.31 3.136-2.926zm-2.29-40.59v.79c.797 0 1.443.602 1.443 1.346h1.694c0-1.617-1.404-2.927-3.136-2.927zm-77.841 0v-.79c-1.733 0-3.137 1.31-3.137 2.926h1.694c0-.744.646-1.347 1.443-1.347zm5.494 37.599v.79h28.39v-1.58h-28.39zm30.68-2.136h.846v-28.2h-1.694v28.2zm-32.97-28.2h-.846v28.2h1.694v-28.2zM39.895 8.7v-.79h-5.669v1.58h5.669zm-22.721 0v-.79h-5.669v1.58h5.669zm-7.958 2.136h.847c0-.744.645-1.346 1.442-1.346V7.91c-1.732 0-3.136 1.31-3.136 2.926zm32.968 0h.847c0-1.616-1.404-2.927-3.136-2.927v1.58c.797 0 1.442.603 1.442 1.347zm-2.29 30.336v.79c1.733 0 3.137-1.31 3.137-2.926h-1.694c0 .743-.645 1.346-1.442 1.346zm-28.389 0v-.79c-.797 0-1.442-.603-1.442-1.346H8.368c0 1.616 1.404 2.926 3.136 2.926zm13.737-23.927v.79h.916v-1.58h-.916zm3.205-2.136h.847V3.572H27.6V15.11zM22.952 3.572h-.847V15.11h1.693V3.572zm3.205 13.673v.79c1.732 0 3.136-1.31 3.136-2.926H27.6c0 .743-.646 1.346-1.443 1.346zm-.916 0v-.79c-.797 0-1.443-.603-1.443-1.346h-1.693c0 1.616 1.404 2.926 3.136 2.926zm3.205-5.982v.79h3.206v-1.58h-3.206zm5.495-2.136h.847v-.855h-1.694v.855zm-2.29-2.991v-.79h-3.205v1.58h3.206zm2.29 2.136h.847c0-1.616-1.404-2.926-3.136-2.926v1.58c.796 0 1.442.603 1.442 1.346zm-2.29 2.991v.79c1.733 0 3.137-1.31 3.137-2.926h-1.694c0 .743-.646 1.346-1.442 1.346zm-11.905 0v.79h3.206v-1.58h-3.206zm3.206-5.127v-.79h-3.206v1.58h3.206zm-5.495 2.136h-.847v.855h1.694v-.855zm2.29-2.136v-.79c-1.733 0-3.137 1.31-3.137 2.926h1.694c0-.743.646-1.346 1.442-1.346zm0 5.127v-.79c-.797 0-1.443-.603-1.443-1.346H16.61c0 1.616 1.404 2.926 3.136 2.926zm9.615 14.527h-.847c0 1.452-1.26 2.628-2.816 2.628v1.58c2.49 0 4.51-1.884 4.51-4.208zM25.7 29.208v-.79c-1.555 0-2.816-1.176-2.816-2.628H21.19c0 2.324 2.02 4.209 4.51 4.209zm-3.663-3.418h.847c0-1.451 1.26-2.628 2.816-2.628v-1.58c-2.49 0-4.51 1.884-4.51 4.208zm3.663-3.418v.79c1.555 0 2.816 1.177 2.816 2.628h1.694c0-2.324-2.02-4.208-4.51-4.208zm24.268 18.8v.79h28.39v-1.58h-28.39zm30.68-2.136h.846v-28.2H79.8v28.2zM78.356 8.7v-.79h-28.39v1.58h28.39zm-30.68 2.136h-.846v28.2h1.694v-28.2zm2.29-2.136v-.79c-1.732 0-3.136 1.31-3.136 2.926h1.694c0-.744.646-1.346 1.442-1.346zm30.68 2.136h.846c0-1.616-1.404-2.927-3.136-2.927v1.58c.797 0 1.443.603 1.443 1.347zm-2.29 30.336v.79c1.732 0 3.136-1.31 3.136-2.926H79.8c0 .743-.646 1.346-1.443 1.346zm-28.39 0v-.79c-.796 0-1.442-.603-1.442-1.346H46.83c0 1.616 1.404 2.926 3.136 2.926zm3.206-28.2v.79h21.979v-1.58h-21.98z",viewW:90,viewH:50}}].map(e=>({id:e.id,group:e.group,category:e.category,w:e.w,h:e.h,art:e.art})),...cl.filter(e=>hl.has(e.id))],ul=new Map(dl.map(e=>[e.id,e]));function pl(e){return e&&ul.get(e)||null}function ml(e){return dl.filter(t=>t.group===e)}function _l(e){const t=pl(e);return t?{w:t.w,h:t.h}:{w:60,h:60}}function fl(e,t,i=Pa,n=1e3){const r=Number(t)>0?Number(t):5;return(Number(e)||0)/r*i/n}const gl=5e-4,vl=Da;function yl(e){return Number.isFinite(e)?Math.max(gl,Math.min(vl,e)):gl}function bl(e){return Number.isFinite(e)?Math.max(1,Math.min(1e4,e)):1}const wl=e=>{const t=Math.round(1e3*e)/1e3;return Object.is(t,-0)?"0":String(t)};function kl(e){const t=pl(e);if(!t)return null;if(t.art)return t.art;const i=function(e,t,i){if(!e.g)return"";const n=e=>wl(e*t),r=e=>wl(e*i),o=[];for(const s of e.g)if("r"===s[0]){const[,e,t,i,a]=s;o.push(`M${n(e)} ${r(t)}H${n(e+i)}V${r(t+a)}H${n(e)}Z`)}else if("l"===s[0]){const[,e,t,i,a]=s;o.push(`M${n(e)} ${r(t)}L${n(i)} ${r(a)}`)}else if("e"===s[0]){const[,e,a,l,c]=s;o.push(`M${n(e-l)} ${r(a)}A${wl(l*t)} ${wl(c*i)} 0 0 1 ${n(e+l)} ${r(a)}A${wl(l*t)} ${wl(c*i)} 0 0 1 ${n(e-l)} ${r(a)}Z`)}else{const e=s.slice(1);if(e.length<4)continue;let t=`M${n(e[0])} ${r(e[1])}`;for(let i=2;i+1<e.length;i+=2)t+=`L${n(e[i])} ${r(e[i+1])}`;o.push(t)}return o.join("")}(t,1,1);return i?{d:i,viewW:1,viewH:1}:null}function xl(e,t,i=1){const n=Number(e),r=Number(i),o=Number.isFinite(n)&&n>0?n:Number.isFinite(r)&&r>0?r:1,s=Number(t),a=o*(Number.isFinite(s)&&s>0?s:1);return Number.isFinite(a)&&a>0?a:o}const $l=6,Sl=e=>{let t=(e%360+360)%360;return t>180&&(t-=360),t};function Ml(e,t,i,n,r,o=0){let s=null,a=r;for(const r of n){const[n,l,c,h]=r,d=c-n,u=h-l,p=d*d+u*u;if(!p)continue;const m=Math.sqrt(p);let _=((e-n)*d+(t-l)*u)/p;_=Math.max(0,Math.min(1,_));let f=n+_*d,g=l+_*u;const v=Math.hypot(e-f,t-g);if(!(v<a))continue;a=v;let y=e-f,b=t-g;const w=Math.hypot(y,b);if(w<1e-9?(y=u/m,b=-d/m):(y/=w,b/=w),o>0){const e=Math.round(_*m/o)*o;f=n+e/m*d,g=l+e/m*u}s={cx:f+y*(i/2),cy:g+b*(i/2),angle:Sl(180*Math.atan2(-y,b)/Math.PI),dist:v}}return s}function Cl(e){const{symbol:t,widthCm:i,depthCm:n,point:r,canvasW:o,canvasH:s,cellCm:a,gridPitch:l,walls:c,wallReach:h,free:d=!1}=e;if(!(kl(t)&&s>0&&Number.isFinite(r[0])&&Number.isFinite(r[1])))return null;const u=yl(fl(i,a,l,o)),p=yl(fl(n,a,l,o));let m=r[0],_=r[1],f=0;const g=d?null:Ml(m,_,p*s,c,h,l);return g&&(m=g.cx,_=g.cy,f=g.angle),{symbol:t,x:Ha(m/o-u/2),y:Ha(_/s-p/2),w:u,h:p,angle:Number(f.toFixed(2))}}function Tl(e,t,i,n,r){const o=e+i/2,s=t+n/2,a=(Number(r)||0)*Math.PI/180,l=Math.cos(a),c=Math.sin(a),h=(e,t)=>{const i=e-o,n=t-s;return[o+i*l-n*c,s+i*c+n*l]};return[h(e,t),h(e+i,t),h(e+i,t+n),h(e,t+n)]}function Rl(e,t,i,n,r,o,s){const a=Number.isFinite(s)&&s>0?s:1e-6,l=(Number(e.angle)||0)*Math.PI/180,c=Math.cos(l),h=Math.sin(l),d=-Math.sin(l),u=Math.cos(l),p=e.x+e.w/2,m=e.y+e.h/2,_=t>0?-e.w/2:t<0?e.w/2:0,f=i>0?-e.h/2:i<0?e.h/2:0,g=p+_*c+f*d,v=m+_*h+f*u,y=n-g,b=r-v,w=t?(y*c+b*h)*(t>0?1:-1):e.w,k=i?(y*d+b*u)*(i>0?1:-1):e.h;let x=t?Math.abs(w):e.w,$=i?Math.abs(k):e.h;if(o&&t&&i){const t=x/Math.max(e.w,a),i=$/Math.max(e.h,a),n=Math.abs(t-1)>=Math.abs(i-1)?t:i,r=Math.max(a/e.w,a/e.h),o=Math.max(r,Number.isFinite(n)?n:r);x=e.w*o,$=e.h*o}x=Math.max(a,Number.isFinite(x)?x:a),$=Math.max(a,Number.isFinite($)?$:a);const S=!!t&&w<0,M=!!i&&k<0,C=t?(t>0?1:-1)*(S?-1:1):0,T=i?(i>0?1:-1)*(M?-1:1):0,R=g+C*(x/2)*c+T*($/2)*d,D=v+C*(x/2)*h+T*($/2)*u,z=!!e.flip_h!==S,A=!!e.flip_v!==M;return{x:R-x/2,y:D-$/2,w:x,h:$,...Number(e.angle)?{angle:Number(e.angle)}:{},...z?{flip_h:!0}:{},...A?{flip_v:!0}:{}}}function Dl(e,t,i,n){let r=Number(e)+(Number(i)-Number(t));if([r,t,i].every(Number.isFinite)||(r=0),n){const e=r/45;r=45*(e<0?-Math.round(Math.abs(e)):Math.round(e))}return r=(r%360+360)%360,r>180?r-360:r}function zl(e,t,i,n,r){const o=e.x*t,s=e.y*i,a=e.w*t,l=e.h*i,c=o+a/2,h=s+l/2,d=o+(e.flip_h?a:0),u=s+(e.flip_v?l:0),p=(e.flip_h?-1:1)*a/n,m=(e.flip_v?-1:1)*l/r,_=Number(e.angle)||0;return(_?`rotate(${_} ${c} ${h}) `:"")+`translate(${d} ${u}) scale(${p} ${m})`}function Al(e,t,i,n=.1){if("string"==typeof e&&!e.trim())return null;const r=Number(e);if(!Number.isFinite(r)||0===r)return null;const o=r*(t?30.48:100),s=Math.abs(o);return s<n||s>i?null:o}function Pl(e,t,i){const n=Math.abs(Number(e))/(i?30.48:100),r=Number(n.toFixed(6));return String(t?-r:r)}const Ol=15e3,Fl=2e3,Il=new WeakMap;function El(e,t){let i=Il.get(e);if(!i){const t=new Set;i={hiddenAt:"hidden"===e.visibilityState?Date.now():0,token:0,subscribers:t,onVisibility:()=>{const t=Il.get(e);if(!t)return;const i=Date.now();if("hidden"===e.visibilityState){t.hiddenAt||(t.hiddenAt=i);const e={kind:"hidden",token:t.token,at:i,hiddenFor:0,long:!1};for(const i of[...t.subscribers])i(e);return}const n=t.hiddenAt?Math.max(0,i-t.hiddenAt):0;t.hiddenAt=0,t.token++;const r={kind:"visible",token:t.token,at:i,hiddenFor:n,long:n>=Ol};for(const e of[...t.subscribers])e(r)},onPageShow:t=>{const i=Il.get(e);if(!i)return;const n=Date.now();i.token++;const r={kind:"pageshow",token:i.token,at:n,hiddenFor:0,long:!!t.persisted,persisted:!!t.persisted};for(const e of[...i.subscribers])e(r)}},Il.set(e,i),e.addEventListener("visibilitychange",i.onVisibility),e.defaultView?.addEventListener("pageshow",i.onPageShow)}return i.subscribers.add(t),()=>{const i=Il.get(e);i&&(i.subscribers.delete(t),i.subscribers.size||(e.removeEventListener("visibilitychange",i.onVisibility),e.defaultView?.removeEventListener("pageshow",i.onPageShow),Il.delete(e)))}}const Hl={now:()=>Date.now(),setTimeout:(e,t)=>window.setTimeout(e,t),clearTimeout:e=>window.clearTimeout(e),requestAnimationFrame:e=>window.requestAnimationFrame(e),cancelAnimationFrame:e=>window.cancelAnimationFrame(e)};class Nl{constructor(e,t=Hl){this.onChange=e,this.clock=t,this._state="steady",this._token=0,this._frameFingerprint="",this._hasCompleteFrame=!1,this._overlayPhase="none",this._recoveryReason=null,this._overlayTimer=0,this._overlayRaf=0,this._overlayOpaqueAt=0,this._barrierRafs=new Set,this._trace=[],this._disposed=!1}get state(){return this._state}get token(){return this._token}get frameFingerprint(){return this._frameFingerprint}get hasCompleteFrame(){return this._hasCompleteFrame}get overlayPhase(){return this._overlayPhase}get overlayVisible(){return"none"!==this._overlayPhase}get overlayBlocksInteraction(){return this.overlayVisible}get recoveryReason(){return this._recoveryReason}get trace(){return this._trace.map(e=>({...e,...e.stage?{stage:[...e.stage]}:{}}))}note(e,t={}){this.record(e,void 0,t)}record(e,t,i={}){this._trace.push({at:this.clock.now(),token:this._token,event:e,state:this._state,...t?{reason:t}:{},...i}),this._trace.length>80&&this._trace.splice(0,this._trace.length-80)}changed(){this._disposed||this.onChange()}adoptCompleteFrame(e){e&&(this._hasCompleteFrame=!0,this._frameFingerprint=e,this._state="steady",this._recoveryReason=null,this.clearOverlay(),this.record("frame-adopted"),this.changed())}markCompleteFrame(e){e&&(this._hasCompleteFrame=!0,this._frameFingerprint=e,this._state="steady",this._recoveryReason=null,this.clearOverlay(),this.record("frame-complete"),this.changed())}refreshCompleteFrame(e){!this._disposed&&this._hasCompleteFrame&&"steady"===this._state&&e&&e!==this._frameFingerprint&&(this._frameFingerprint=e,this.record("frame-refreshed"))}visibility(e){return"hidden"===e.kind?(this.record("visibility-hidden"),this._token):e.long||"visible"!==e.kind&&"pageshow"!==e.kind?this.beginCandidate("pageshow"===e.kind?"pageshow":"long-resume"):(this.record("pageshow"===e.kind?"pageshow-noop":"visibility-visible-quick"),this._token)}beginCandidate(e,t="plan"){return this._token++,this._recoveryReason=t,this._hasCompleteFrame?(this._state="connection"===t?"offline-stale":"holding",this.clearOverlay()):this.overlayVisible?this._state="overlay-visible":(this._state="overlay-pending",this.scheduleOverlay(t)),this.record("candidate-start",e),this.changed(),this._token}connectionLost(){return this.beginCandidate("connection-lost","connection")}candidateReady(e){return!this._disposed&&e===this._token&&(this._state="candidate-ready",this.record("candidate-ready"),this.changed(),!0)}async commitAfterPaint(e,t){if(this._disposed||e!==this._token)return!1;let i=!0;const n=(async()=>{for(await t.updateComplete();i&&!this._disposed&&e===this._token;)if(t.stageValid()&&t.assetsReady()){if(await this.nextFrame(),e!==this._token||!t.stageValid()||!t.assetsReady())continue;if(await this.nextFrame(),e===this._token&&t.stageValid()&&t.assetsReady())return!0}else await this.nextFrame();return!1})();let r=0;const o=new Promise(e=>{r=this.clock.setTimeout(()=>e({ready:!1,timedOut:!0}),Fl)}),s=await Promise.race([n.then(e=>({ready:e,timedOut:!1})),o]);return i=!1,this.clock.clearTimeout(r),!this._disposed&&e===this._token&&(!(!s.ready&&!s.timedOut)&&(s.ready?(this._hasCompleteFrame=!0,this._frameFingerprint=t.frameFingerprint(),this.record("paint-barrier"),this.finishOverlayAfterCommit(),!0):(this.record("paint-barrier-timeout"),this._hasCompleteFrame?(this._state="connection"===this._recoveryReason?"offline-stale":"steady",this.clearOverlay()):(this._state="recovery-error","opaque"!==this._overlayPhase&&this.showOverlayNow()),this.changed(),!1)))}retry(e=this._recoveryReason||"plan"){return this.beginCandidate("retry",e)}nextFrame(){return new Promise(e=>{const t=this.clock.requestAnimationFrame(()=>{this._barrierRafs.delete(t),e()});this._barrierRafs.add(t)})}scheduleOverlay(e){this.clearOverlayTimer(),this._recoveryReason=e,this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,this._hasCompleteFrame||"overlay-pending"!==this._state&&"candidate-ready"!==this._state||(this._state="overlay-visible",this._overlayPhase="entering",this.record("overlay-enter"),this.changed(),this._overlayRaf=this.clock.requestAnimationFrame(()=>{this._overlayRaf=0,"entering"===this._overlayPhase&&(this._overlayPhase="fading-in",this.changed(),this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,"fading-in"===this._overlayPhase&&(this._overlayPhase="opaque",this._overlayOpaqueAt=this.clock.now(),this.record("overlay-opaque"),this.changed())},150))}))},150)}showOverlayNow(){this.clearOverlayTimer(),this._overlayPhase="opaque",this._overlayOpaqueAt=this.clock.now(),this.record("overlay-error")}finishOverlayAfterCommit(){if(this.clearOverlayTimer(),"none"===this._overlayPhase||"entering"===this._overlayPhase||"fading-in"===this._overlayPhase)return this.clearOverlay(),this._state="steady",this._recoveryReason=null,this.record("candidate-committed"),void this.changed();const e=Math.max(0,this._overlayOpaqueAt+250-this.clock.now());this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,this._overlayPhase="leaving",this.record("overlay-leave"),this.changed(),this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,this._overlayPhase="none",this._state="steady",this._recoveryReason=null,this.record("candidate-committed"),this.changed()},180)},e)}clearOverlayTimer(){this._overlayTimer&&this.clock.clearTimeout(this._overlayTimer),this._overlayTimer=0}clearOverlay(){this.clearOverlayTimer(),this._overlayRaf&&this.clock.cancelAnimationFrame(this._overlayRaf),this._overlayRaf=0,this._overlayPhase="none",this._overlayOpaqueAt=0}dispose(){this._disposed=!0,this._token++,this.clearOverlay();for(const e of this._barrierRafs)this.clock.cancelAnimationFrame(e);this._barrierRafs.clear()}}function Ll(e){let t=2166136261,i=2654435769;const n=new WeakSet,r=e=>{for(let n=0;n<e.length;n++){const r=e.charCodeAt(n);t^=r,t=Math.imul(t,16777619),i^=r+(i<<6>>>0)+(i>>>2)}},o=e=>{if(null===e)return void r("n");const t=typeof e;if("string"===t)return void r(`s${e.length}:${e}`);if("number"===t)return void r(`d${Number.isNaN(e)?"NaN":String(e)}`);if("boolean"===t)return void r(e?"t":"f");if("undefined"===t)return void r("u");if("object"!==t)return void r(`${t}:${String(e)}`);const i=e;if(n.has(i))r("[cycle]");else{if(n.add(i),Array.isArray(e)){r("[");for(const t of e)o(t);return r("]"),void n.delete(i)}r("{");for(const t of Object.keys(e).sort())r(t),o(e[t]);r("}"),n.delete(i)}};return o(e),`${(t>>>0).toString(16).padStart(8,"0")}${(i>>>0).toString(16).padStart(8,"0")}`}function Bl(e){return Ll(e)}const ql=new WeakMap;class Wl{constructor(e,t=()=>Date.now()){this.onUpdate=e,this.now=t,this.fallbackAuthority={},this.referenceOwner={},this.referenced=new Set,this.queued=new Set,this.disposed=!1,this.sharedUpdate=()=>{this.disposed||this.onUpdate()}}bind(e){const t=((e,t)=>{const i=e?.connection||e?.callWS||t;return!i||"object"!=typeof i&&"function"!=typeof i?t:i})(e,this.fallbackAuthority);return this.shared&&this.authority===t||(this.shared&&(this.shared.listeners.delete(this.sharedUpdate),this.shared.references.delete(this.referenceOwner)),this.authority=t,this.shared=(e=>{let t=ql.get(e);return t||(t={signed:{},queued:new Set,inFlight:new Map,retry:new Map,listeners:new Set,settlers:new Set,references:new Map},ql.set(e,t)),t})(t),this.disposed||(this.shared.listeners.add(this.sharedUpdate),this.shared.references.set(this.referenceOwner,new Set(this.referenced)))),this.shared}start(e,t){this.disposed=!1,this.referenced=new Set(t());const i=this.bind(e());i.listeners.add(this.sharedUpdate),i.references.set(this.referenceOwner,new Set(this.referenced)),this.stopTimer(),this.resignTimer=setInterval(()=>this.resign(e(),t()),288e5)}dispose(){if(this.disposed=!0,this.stopTimer(),clearTimeout(this.batchTimer),this.shared){this.shared.listeners.delete(this.sharedUpdate),this.shared.references.delete(this.referenceOwner);for(const e of this.queued)this.shared.queued.delete(e)}this.queued.clear()}invalidate(e){const t=this.bind(e);clearTimeout(this.batchTimer),this.queued.clear(),t.queued.clear(),t.inFlight.clear(),t.retry.clear(),t.signed={}}stopTimer(){void 0!==this.resignTimer&&clearInterval(this.resignTimer),this.resignTimer=void 0}display(e,t){const i=vn(t);if(!i.startsWith("/api/houseplan/content/"))return i;const n=this.bind(e);this.referenced.add(i),n.references.set(this.referenceOwner,new Set(this.referenced));const r=n.signed[i],o=r?this.now()-r.at:1/0;return o<fn?r.url:o<_n?(r.pending||this.request(e,i),r.url):(r&&delete n.signed[i],this.request(e,i),"")}request(e,t){if(!e?.callWS||this.queued.has(t))return;const i=this.bind(e),n=this.now(),r=i.inFlight.get(t);if(void 0!==r&&n-r<15e3)return;if(i.queued.has(t))return;const o=i.retry.get(t);o&&n<o.notBefore||(this.queued.add(t),i.queued.add(t),clearTimeout(this.batchTimer),this.batchTimer=setTimeout(()=>{const t=[...this.queued];this.queued.clear();for(const e of t)i.queued.delete(e);this.sign(e,t)},30))}sign(e,t){if(!t.length||!e?.callWS)return;const i=this.bind(e);for(const n of function(e,t){const i=Math.max(1,Math.floor(t)),n=[];for(let t=0;t<e.length;t+=i)n.push(e.slice(t,t+i));return n}(t,200)){const t=this.now(),r=n.filter(e=>{const n=i.inFlight.get(e);return!(void 0!==n&&t-n<15e3)&&(i.inFlight.set(e,t),!0)});r.length&&e.callWS({type:"houseplan/content/sign",paths:r}).then(e=>{const t=this.now();let n=0,o=!1;for(const s of r){const r=e?.urls?.[s];if("string"==typeof r&&r){const e=i.signed[s];e?.loaded&&e.url!==r?(e.pending={url:r,at:t},this.preloadReplacement(i,s,r,t)):(i.signed[s]={url:r,at:t,loaded:e?.url===r&&!!e.loaded},o=!0),i.retry.delete(s),n++}else this.backOff(i,s)}if(n&&(this.trimShared(i),o))for(const e of[...i.listeners])e()}).catch(()=>{for(const e of r)this.backOff(i,e)}).finally(()=>{for(const e of r)i.inFlight.get(e)===t&&i.inFlight.delete(e);for(const e of[...i.settlers])e()})}}preloadReplacement(e,t,i,n){const r=()=>{const r=e.signed[t];if(r?.pending?.url===i){e.signed[t]={url:i,at:n,loaded:!0},e.retry.delete(t),this.trimShared(e);for(const t of[...e.listeners])t()}},o=()=>{const n=e.signed[t];n?.pending?.url===i&&(delete n.pending,this.backOff(e,t))};if("undefined"==typeof Image)return void r();const s=new Image;s.onload=()=>{("function"==typeof s.decode?s.decode():Promise.resolve()).then(r).catch(o)},s.onerror=o,s.src=i}preloadCurrentImage(e,t,i){if(i.loaded)return Promise.resolve(!0);if(i.preload)return i.preload;if("undefined"==typeof Image)return i.loaded=!0,Promise.resolve(!0);const n=i.url;return i.preload=new Promise(r=>{const o=new Image;let s=!1;const a=o=>{if(s)return;s=!0,clearTimeout(l);const a=e.signed[t];if(a===i&&delete a.preload,o&&a===i&&a.url===n){a.loaded=!0;for(const t of[...e.listeners])t();r(!0)}else o||a!==i||this.backOff(e,t),r(!1)};o.onload=()=>{("function"==typeof o.decode?o.decode():Promise.resolve()).then(()=>a(!0)).catch(()=>a(!1))},o.onerror=()=>a(!1);const l=setTimeout(()=>a(!1),Fl);o.src=n}),i.preload}prepareImage(e,t){const i=vn(t);if(!i.startsWith("/api/houseplan/content/"))return Promise.resolve(!0);const n=this.bind(e),r=()=>{const t=n.signed[i];if(t&&this.now()-t.at<_n)return this.preloadCurrentImage(n,i,t);this.display(e,i);const r=n.retry.get(i);return r&&r.notBefore>this.now()&&!n.inFlight.has(i)&&!n.queued.has(i)?Promise.resolve(!1):null},o=r();return o?(s=o,new Promise(e=>{let t=!1;const i=i=>{t||(t=!0,clearTimeout(n),e(i))},n=setTimeout(()=>i(!1),Fl);s.then(i).catch(()=>i(!1))})):new Promise(e=>{let t=!1,i=null;const o=i=>{t||(t=!0,clearTimeout(a),n.settlers.delete(s),e(i))},s=()=>{t||i||(i=r(),i&&i.then(o).catch(()=>o(!1)))},a=setTimeout(()=>o(!1),Fl);n.settlers.add(s),s()});var s}backOff(e,t){const i=e.retry.get(t)?.delay||0,n=Math.min(6e4,i?2*i:2e3);e.retry.set(t,{notBefore:this.now()+n,delay:n})}trimShared(e){const t=Object.entries(e.signed);if(t.length<=512)return;const i=new Set(e.inFlight.keys());for(const t of e.references.values())for(const e of t)i.add(e);for(const[e,n]of t)(n.pending||n.preload)&&i.add(e);t.sort((e,t)=>t[1].at-e[1].at);const n=t.filter(([e])=>i.has(e));for(const e of t){if(n.length>=512)break;i.has(e[0])||n.push(e)}e.signed=Object.fromEntries(n)}resign(e,t){const i=this.bind(e);this.referenced=new Set(t),i.references.set(this.referenceOwner,new Set(this.referenced));const n=this.now(),r=new Set;for(const e of i.references.values())for(const t of e)r.add(t);const o={};for(const[e,t]of Object.entries(i.signed))r.has(e)&&n-t.at<_n&&(o[e]=t);i.signed=o,i.retry.clear(),this.sign(e,[...t].filter(e=>!!o[e]&&!o[e].pending))}markLoaded(e,t,i){const n=vn(t);if(!n.startsWith("/api/houseplan/content/"))return;const r=this.bind(e).signed[n];if(r&&(!i||r.url===i)&&!r.loaded){r.loaded=!0;for(const t of[...this.bind(e).listeners])t()}}isReady(e,t){const i=vn(t);if(!i.startsWith("/api/houseplan/content/"))return!0;const n=this.bind(e).signed[i];return!!n&&this.now()-n.at<_n&&n.loaded}get entries(){const e={};for(const[t,i]of Object.entries(this.shared?.signed||{}))e[t]={url:i.url,at:i.at};return e}get inFlightUrls(){return[...this.shared?.inFlight.keys()||[]]}}function jl(e,t){if(t)return e.find(e=>e.id===t)}var Ul="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z";function Vl(e,t,i){return[e[0]*t+e[1]*i+e[2],e[3]*t+e[4]*i+e[5]]}function Gl(e,t){let i=0;for(const[n,r]of t){const t=Vl(e,n[0],n[1]);i=Math.max(i,Math.hypot(t[0]-r[0],t[1]-r[1]))}return i}const Kl=e=>{if(null==e||""===e)return null;const t=Number(e);return Number.isFinite(t)?t:null},Yl=e=>{const t=e,i=Kl(Array.isArray(t)?t[0]:t?.x),n=Kl(Array.isArray(t)?t[1]:t?.y);return null==i||null==n?null:[i,n]};function Xl(e){if(!Array.isArray(e))return null;const t=[];for(const i of e){const e=Yl(i);if(!e)return null;t.push(e)}if(t.length>1){const e=t[0],i=t[t.length-1];e[0]===i[0]&&e[1]===i[1]&&t.pop()}if(t.length<3)return null;let i=0,n=0,r=0;for(let e=0;e<t.length;e++){const o=t[e],s=t[(e+1)%t.length],a=o[0]*s[1]-s[0]*o[1];i+=a,n+=(o[0]+s[0])*a,r+=(o[1]+s[1])*a}return Math.abs(i)<1e-12?[t.reduce((e,t)=>e+t[0],0)/t.length,t.reduce((e,t)=>e+t[1],0)/t.length]:[n/(3*i),r/(3*i)]}function Zl(e){if(!Array.isArray(e))return null;const t=[];for(const i of e){const e=Yl(i);if(!e)return null;t.push(e)}if(t.length>1){const e=t[0],i=t[t.length-1];e[0]===i[0]&&e[1]===i[1]&&t.pop()}const i=Xl(t);if(!i)return null;const n=t.map(e=>e[0]),r=t.map(e=>e[1]);return{centroid:i,bbox:[Math.min(...n),Math.min(...r),Math.max(...n),Math.max(...r)]}}function Jl(e){let t=e;if(t&&"object"==typeof t&&!Array.isArray(t)){const e=t;t=e.path??e.points??t}if(!Array.isArray(t)||!t.length)return[];let i=(t.some(e=>(e=>Array.isArray(e)?e.length>=2&&!Array.isArray(e[0])&&("object"!=typeof e[0]||null==e[0]):!!e&&"object"==typeof e&&("x"in e||"y"in e))(e))?[t]:t.filter(Array.isArray)).map(e=>e.map(Yl).filter(e=>null!=e)).filter(e=>e.length>=2);i.length>64&&(i=i.slice(-64));const n=i.reduce((e,t)=>e+t.length,0);if(n<=4e3)return i.map(e=>e.slice());const r=4e3-2*i.length,o=i.map(e=>e.length-2),s=o.reduce((e,t)=>e+t,0),a=o.map(e=>r*e/s),l=a.map(Math.floor);let c=r-l.reduce((e,t)=>e+t,0);const h=a.map((e,t)=>({index:t,fraction:e-Math.floor(e)})).sort((e,t)=>t.fraction-e.fraction||e.index-t.index);for(let e=0;e<c;e++)l[h[e].index]++;return i.map((e,t)=>function(e,t){if(t>=e.length)return e.slice();if(t<=2)return[e[0],e[e.length-1]];const i=[];for(let n=0;n<t;n++){const r=Math.round(n*(e.length-1)/(t-1));i.push(e[r])}return i}(e,2+l[t]))}function Ql(e,t,i){const n=Jl(e&&"object"==typeof e&&!Array.isArray(e)&&"path"in e?e.path:e);if(n.length)return{path:n,source:"integration"};const r=Jl(t&&"object"==typeof t&&!Array.isArray(t)&&"points"in t?t.points:t);if(r.length)return{path:r,source:"server"};const o=Jl(i);return o.length?{path:o,source:"local"}:{path:[],source:"none"}}function ec(e){const t=e.map(e=>e.slice()),i=t[t.length-1];return i?(i.length>2?i.pop():t.pop(),t):[]}const tc=e=>Number.isFinite(e[0])&&Number.isFinite(e[1]),ic=(e,t)=>e[0]===t[0]&&e[1]===t[1];function nc(e){if(!e)return null;const t=e.vacuum_position||e.robot_position||null,i=t&&null!=Kl(t.x)&&null!=Kl(t.y)?{x:Kl(t.x),y:Kl(t.y),a:Kl(t.a??t.angle??t.theta)}:null,n=Jl(e.path?.path??e.path?.points??e.path),r=[],o=e.rooms,s=Array.isArray(o)?o.map((e,t)=>[String(e?.id??t),e]):o&&"object"==typeof o?Object.entries(o):[];for(const[e,t]of s){if(!t||"object"!=typeof t)continue;const i=String(t.name??t.label??"").trim(),n=[[Kl(t.cx),Kl(t.cy)],[Kl(t.center?.x),Kl(t.center?.y)],[Kl(t.x),Kl(t.y)]].find(([e,t])=>null!=e&&null!=t);let o=n?.[0]??null,s=n?.[1]??null;const a=Zl(t.outline),l=Kl(t.x0),c=Kl(t.y0),h=Kl(t.x1),d=Kl(t.y1),u=(null!=l&&null!=c&&null!=h&&null!=d?[Math.min(l,h),Math.min(c,d),Math.max(l,h),Math.max(c,d)]:null)||a?.bbox||null;if(null!=o&&null!=s||!a||([o,s]=a.centroid),null!=o&&null!=s||!u||(o=(u[0]+u[2])/2,s=(u[1]+u[3])/2),i&&null!=o&&null!=s){const t={id:e,name:i,cx:o,cy:s};u&&([t.x0,t.y0,t.x1,t.y1]=u),r.push(t)}}const a=function(e){return String(e.map_name??e.current_map??e.map_index??e.selected_map??"default")}(e);return i||r.length||n.length?{pos:i,path:n,rooms:r,mapId:a}:null}function rc(e,t,i){return![e,t,i].every(Number.isFinite)||e<0||t<=0||i<=0?Number.POSITIVE_INFINITY:e/t*i}const oc=40;function sc(e,t,i){if(!e||!t)return null;const n=t.attributes||{},r=e.split(".")[0]||"",o=null!=i?.platform?String(i.platform):null,s=!!Yl(n.vacuum_position??n.robot_position),a=!(!n.rooms||"object"!=typeof n.rooms),l=Jl(n.path?.path??n.path?.points??n.path).length>0,c=[n.map_name,n.current_map,n.map_index,n.selected_map].some(e=>null!=e),h="xiaomi_cloud_map_extractor"===o,d=a||l||c;let u=null;if(s?u="compatible":h?u="known_xcme_incomplete":d?u="partial":"camera"===r&&(u="camera"),!u)return null;const p=s?"camera"===r?300:200:h?100:d?50:0;return{entityId:e,name:String(n.friendly_name||e),platform:o,category:u,hasPosition:s,hasRooms:a,hasPath:l,hasMapId:c,score:p}}const ac=e=>e.toLowerCase().replace(/[\s_\-.,]+/g,"");function lc(e,t){const i=new Set(t.map(ac).filter(Boolean)),n=new Set;for(const t of e){const e=ac(t.name||"");e&&i.has(e)&&n.add(e)}return n.size}function cc(e,t){const i=new Map(t.map(e=>[ac(e.name),e])),n=[],r=[];for(const t of e){const e=i.get(ac(t.name));e&&(n.push([[t.cx,t.cy],[e.cx,e.cy]]),r.push(t.name))}if(n.length<3)return null;const o=function(e){if(e.length<3)return null;let t=0,i=0,n=0,r=0,o=0,s=0,a=0,l=0,c=0,h=0,d=0,u=0;for(const[[p,m],[_,f]]of e){if(![p,m,_,f].every(Number.isFinite))return null;t+=p*p,i+=p*m,n+=p,r+=m*m,o+=m,s+=1,a+=p*_,l+=m*_,c+=_,h+=p*f,d+=m*f,u+=f}const p=[t,i,n,i,r,o,n,o,s],m=e=>{const[t,i,n,r,o,s,a,l,c]=p,h=t*(o*c-s*l)-i*(r*c-s*a)+n*(r*l-o*a);if(!Number.isFinite(h)||Math.abs(h)<1e-9)return null;const d=[(o*c-s*l)/h,(n*l-i*c)/h,(i*s-n*o)/h,(s*a-r*c)/h,(t*c-n*a)/h,(n*r-t*s)/h,(r*l-o*a)/h,(i*a-t*l)/h,(t*o-i*r)/h];return[d[0]*e[0]+d[1]*e[1]+d[2]*e[2],d[3]*e[0]+d[4]*e[1]+d[5]*e[2],d[6]*e[0]+d[7]*e[1]+d[8]*e[2]]},_=m([a,l,c]),f=m([h,d,u]);if(!_||!f)return null;const g=[_[0],_[1],_[2],f[0],f[1],f[2]];return g.every(Number.isFinite)?g:null}(n);return o?{matrix:o,matched:r,residual:Gl(o,n)}:null}function hc(e,t,i){const n=e[e.length-1];if(n&&n[0]===t[0]&&n[1]===t[1])return e;if(e.push(t),e.length<=600)return e;let r=function(e,t){if(e.length<3)return e.slice();const i=new Uint8Array(e.length);i[0]=i[e.length-1]=1;const n=[[0,e.length-1]];for(;n.length;){const[r,o]=n.pop(),[s,a]=e[r],[l,c]=e[o],h=l-s,d=c-a,u=Math.hypot(h,d)||1e-9;let p=0,m=-1;for(let t=r+1;t<o;t++){const i=Math.abs((e[t][0]-s)*d-(e[t][1]-a)*h)/u;i>p&&(p=i,m=t)}m>0&&p>t&&(i[m]=1,n.push([r,m],[m,o]))}const r=[];for(let t=0;t<e.length;t++)i[t]&&r.push(e[t]);return r}(e,i);return r.length>600&&(r=r.filter((e,t)=>t%2==0||t===r.length-1)),r}function dc(e){return"cleaning"===e||"returning"===e||"on"===e}const uc={0:[1,0],90:[0,1],180:[-1,0],270:[0,-1]};function pc(e){const[t,i]=uc[e.rot]||[1,0],n=e.mir?-1:1;return[e.s*t*n,-e.s*i,e.ox,e.s*i*n,e.s*t,e.oy]}function mc(e){const t=e[0]*e[4]-e[1]*e[3];if(!Number.isFinite(t)||Math.abs(t)<1e-12)return null;const i=t<0,n=Math.sqrt(Math.abs(t));let r=180*Math.atan2(-e[1],e[4])/Math.PI;return r=(90*Math.round(r/90)%360+360)%360,{ox:e[2],oy:e[5],s:n,rot:r,mir:i}}function _c(e,t){const i=[],n=[];for(const t of e)null!=t.x0?(i.push(t.x0,t.x1),n.push(t.y0,t.y1)):(i.push(t.cx),n.push(t.cy));if(!i.length)return{ox:t[0]+t[2]/2,oy:t[1]+t[3]/2,s:t[2]/1e4,rot:0,mir:!0};const r=Math.min(...i),o=Math.max(...i),s=Math.min(...n),a=Math.max(...n),l=Math.max(o-r,a-s)||1,c={ox:0,oy:0,s:.6*Math.min(t[2],t[3])/l,rot:0,mir:!0},h=pc(c),[d,u]=Vl(h,(r+o)/2,(s+a)/2);return c.ox=t[0]+t[2]/2-d,c.oy=t[1]+t[3]/2-u,c}function fc(e,t,i,n){const[r,o]=Vl(pc(t),i,n),s=pc({...e,ox:0,oy:0}),[a,l]=Vl(s,i,n);return{...e,ox:r-a,oy:o-l}}function gc(e){const t=e?.trail_mode;return"never"===t||"cleaning"===t||"always"===t?t:!1===e?.trail?"never":"cleaning"}const vc={availability:"available",status:"alarm",activity:"none"},yc=new Set(["motion","vibration","sound"]),bc=new Set(["occupancy","presence"]),wc=new Set(["door","window","garage_door","opening"]),kc=new Set(["running","power"]),xc=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);const $c=new Set(["running","working","washing","rinsing","spinning","drying","heating","cooling","cleaning","cooking","playing","recording","pumping","irrigating","humidifying","dehumidifying","fan","preheating","defrosting"]),Sc=new Set([...$c,"start","started","run","active","in_progress","wash","rinse","spin","dry"]),Mc=new Set(["off","idle","paused","standby","docked","finished","complete","completed","stopped","ready","sleeping","stop","end","done","inactive"]),Cc=new Set(["heat","cool","heat_cool","auto","dry","fan_only"]),Tc=e=>""===e||"unknown"===e||"unavailable"===e||"__missing__"===e,Rc=e=>String(e??"").trim().toLowerCase(),Dc=e=>Rc(e).replace(/[\s-]+/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,""),zc=new Map([["run_state",0],["job_state",0],["operation_state",0],["activity_state",0],["machine_state",1],["running_state",1],["status",2],["device_status",2],["machine_status",2]]),Ac=new Set(["wifi","connection","signal","battery"]);function Pc(e,t){const i=e?.entities?.[t]||{};if("config"===i.entity_category)return null;const n=String(t||"").split(".").slice(1).join("."),r=[i.translation_key,i.original_name,i.name],o=[...r,n];r.some(e=>Rc(e))||o.push(e?.states?.[t]?.attributes?.friendly_name);const s=o.map(Dc).filter(Boolean);if(s.some(e=>e.split("_").some(e=>Ac.has(e))))return null;let a=null;for(const e of s)for(const[t,i]of zc)(e===t||e.endsWith(`_${t}`))&&(a=null==a?i:Math.min(a,i));return a}const Oc=(e,t)=>null!=Pc(e,t);function Fc(e,t){if(!t.startsWith("switch."))return!1;const i=e?.entities?.[t]||{},n=e?.states?.[t],r=t.slice(7).toLowerCase();if(/(?:^|_)(?:main_)?power$/.test(r))return!0;if([i.translation_key,i.original_name,i.name].map(Rc).some(e=>["power","main power","power switch","питание"].includes(e)))return!0;const o=Rc(n?.attributes?.friendly_name);return/(?:^|[\s._-])(?:main[\s._-]+)?power$/.test(o)||/(?:^|[\s._-])питание$/.test(o)}function Ic(e){for(const t of["hvac_action","action","current_operation","run_state","job_state","operation","activity"]){const i=Rc(e?.[t]);if($c.has(i)||Mc.has(i))return i}return""}function Ec(e,t){const i=e?.states?.[t],n=i?Rc(i.state):"__missing__",r=String(t||"").split(".")[0],o=Rc(i?.attributes?.device_class),s={eid:t,state:n,availability:Tc(n)?"unavailable":"available",status:"neutral",activity:"none",edge:"none"};if("unavailable"===s.availability)return s;if(function(e,t,i){return"alarm_control_panel"===e?"triggered"===i:"on"===i&&Tn(e,t)}(r,o,n))return{...s,status:"alarm"};if("binary_sensor"===r)return yc.has(o)?{...s,edge:"rising"}:bc.has(o)?{...s,activity:"on"===n?"presence":"none"}:wc.has(o)?{...s,status:"on"===n?"open":"neutral",edge:"rising"}:"moving"===o?{...s,activity:"on"===n?"transition":"none"}:kc.has(o)&&"on"===n?{...s,status:"working",activity:"running"}:s;if("cover"===r)return{...s,activity:"opening"===n||"closing"===n?"transition":"none",edge:"terminal_transition"};if("lock"===r)return{...s,status:"unlocked"===n||"open"===n?"open":"neutral",activity:"locking"===n||"unlocking"===n?"transition":"none",edge:"terminal_transition"};if("valve"===r)return{...s,status:["open","opening","closing"].includes(n)?"open":"neutral",activity:"opening"===n||"closing"===n?"transition":"none",edge:"terminal_transition"};if("climate"===r){const e=Ic(i.attributes),t=Array.isArray(i.attributes?.hvac_modes)?i.attributes.hvac_modes.map(Rc):[],r=!Mc.has(n)&&(Cc.has(n)||$c.has(n)||t.includes(n));return(e?$c.has(e):r)?{...s,status:"working",activity:"running"}:s}if(["light","switch","fan","humidifier"].includes(r))return"on"===n?{...s,status:"working",activity:"running"}:s;if("media_player"===r)return"off"===n?{...s,availability:"unavailable"}:s;if("vacuum"===r)return"cleaning"===n?{...s,status:"working",activity:"running"}:"returning"===n?{...s,status:"working",activity:"transition"}:s;if("script"===r)return"on"===n?{...s,status:"working",activity:"running"}:s;if("automation"===r)return s;if("button"===r||"event"===r)return{...s,edge:"change"};const a=Ic(i.attributes);return $c.has(a)||$c.has(n)&&!Mc.has(n)?{...s,status:"working",activity:"running"}:s}function Hc(e,t,i){const n=i.filter(t=>t.startsWith("switch.")&&!e?.entities?.[t]?.entity_category),r=t.find(t=>Fc(e,t));if(!(n.length>1&&!!r))return t.map(t=>Ec(e,t));const o=t.find(t=>t!==r&&Oc(e,t)),s=Ec(e,r);return"unavailable"===s.availability||"off"===s.state?t.map(t=>({eid:t,state:e?.states?.[t]?Rc(e.states[t].state):"__missing__",availability:"unavailable",status:"neutral",activity:"none",edge:"none"})):t.map(t=>{if(t===o)return function(e,t){const i=e?.states?.[t],n=i?Rc(i.state):"__missing__",r={eid:t,state:n,availability:Tc(n)?"unavailable":"available",status:"neutral",activity:"none",edge:"none"};if("unavailable"===r.availability)return r;const o=Ic(i?.attributes);return $c.has(o)||Sc.has(n)&&!Mc.has(n)?{...r,status:"working",activity:"running"}:r}(e,t);return{...t===r?s:Ec(e,t),status:"neutral",activity:"none",edge:"none"}})}function Nc(e){if(!e.length)return{availability:"available",status:"neutral",activity:"none"};const t=e.filter(e=>"available"===e.availability);if(!t.length)return{availability:"unavailable",status:"neutral",activity:"none"};if(t.some(e=>"alarm"===e.status))return vc;const i=t.some(e=>"working"===e.status)?"working":t.some(e=>"open"===e.status)?"open":"neutral",n=t.some(e=>"transition"===e.activity)?"transition":t.some(e=>"presence"===e.activity)?"presence":t.some(e=>"running"===e.activity)?"running":"none";return{availability:"available",status:i,activity:n}}function Lc(e,t){if(!(e=>!!e&&!Tc(e))(e)||"unavailable"===t.availability||e===t.state)return null;if("rising"===t.edge)return"off"===e&&"on"===t.state?"event":null;if("change"===t.edge)return"event";if("terminal_transition"===t.edge){const i=new Set([e,t.state]);if(i.has("closed")&&i.has("open")||i.has("locked")&&i.has("unlocked"))return"transition"}return null}const Bc=(e,t=0)=>{const i=Number(e);return Number.isInteger(i)&&i>=0?i:t},qc=(e,t)=>{const i={rev:0,configRev:Bc(t),off:new Set};if(null==e)return{snapshot:i,valid:!1};const n=e.off;return!Number.isInteger(e.rev)||Number(e.rev)<0||!Number.isInteger(e.config_rev)||Number(e.config_rev)<0||!Array.isArray(n)||n.some(e=>"string"!=typeof e||!e)?{snapshot:i,valid:!1}:{snapshot:{rev:Number(e.rev),configRev:Number(e.config_rev),off:new Set(n)},valid:!0}};function Wc(e,t=0){return qc(e,t).snapshot}function jc(e,t,i,n){const r=qc(t,i);return n&&r.valid&&r.snapshot.configRev===i?e.configRev===i&&r.snapshot.rev<e.rev?e:r.snapshot:Wc(null,i)}function Uc(e){return{rev:e.rev,config_rev:e.configRev,off:[...e.off].sort()}}function Vc(e){return e?`${e.configRev}:${e.rev}:${[...e.off].sort().join(",")}`:"0:0:"}function Gc(e){return!!e&&"string"==typeof e.id&&!!e.id&&"virtual"===e.binding&&!0===e.is_light&&"toggle"===e.tap_action&&!0!==e.removed}function Kc(e,t){return!Gc(e)||!t?.off.has(e.id)}function Yc(e,t){const i="string"==typeof t?.marker_id?t.marker_id:"",n=Bc(t?.rev,-1);if(!i||"boolean"!=typeof t?.on||n<=e.rev)return e;const r=new Set(e.off);return t.on?r.delete(i):r.add(i),{...e,rev:n,off:r}}const Xc=new WeakMap,Zc=new WeakMap;let Jc=1;const Qc="houseplan.ha-binding-status.v1";let eh=null;function th(e){const t=function(e){const t=e?.connection||e;return!t||"object"!=typeof t&&"function"!=typeof t?null:t}(e);if(!t)return null;let i=Xc.get(t);return i||(i={revision:0,authoritative:!1,access:"pending",devices:{},entities:{},lastSuccess:0,listeners:new Set,refs:0},Xc.set(t,i)),i}function ih(e,t){const i=Array.isArray(e)?e:e&&"object"==typeof e&&Array.isArray(e.entries)?e.entries:null;if(!i)return null;const n={};for(const e of i){const i=e?.[t];"string"==typeof i&&i&&(n[i]=e)}return n}async function nh(e,t){return t.loading||!e?.callWS||(t.loading=(async()=>{try{const[i,n]=await Promise.all([e.callWS({type:"config/device_registry/list"}),e.callWS({type:"config/entity_registry/list"})]),r=ih(i,"id"),o=ih(n,"entity_id");if(!r||!o)throw new Error("invalid_registry_response");t.devices=r,t.entities=o,t.authoritative=!0,t.access="full",t.lastSuccess=Date.now(),t.error=void 0}catch(e){t.authoritative=!1,t.access="limited",t.error=function(e){if(e&&"object"==typeof e){const t=e;return String(t.message||t.code||t.error||"registry_unavailable")}return String(e||"registry_unavailable")}(e)}finally{t.revision++,t.loading=void 0,function(e){for(const t of[...e.listeners])try{t()}catch{}}(t)}})()),t.loading}function rh(e,t){void 0===t.reloadTimer&&(t.reloadTimer=globalThis.setTimeout(()=>{t.reloadTimer=void 0,nh(e,t)},80))}async function oh(e,t){if(t.subscribing||t.unsubDevice&&t.unsubEntity)return t.subscribing;const i=e?.connection?.subscribeEvents;return"function"==typeof i?(t.subscribing=(async()=>{try{t.unsubDevice||(t.unsubDevice=await i.call(e.connection,()=>rh(e,t),"device_registry_updated")),t.unsubEntity||(t.unsubEntity=await i.call(e.connection,()=>rh(e,t),"entity_registry_updated"))}catch{}finally{0===t.refs&&(t.unsubDevice?.(),t.unsubEntity?.(),t.unsubDevice=void 0,t.unsubEntity=void 0),t.subscribing=void 0}})(),t.subscribing):void 0}function sh(e,t){const i=th(e);if(!i)return()=>{};const n=0===i.refs;i.refs++,i.listeners.add(t),("pending"===i.access||n)&&nh(e,i),oh(e,i);let r=!1;return()=>{r||(r=!0,i.listeners.delete(t),i.refs=Math.max(0,i.refs-1),i.refs>0||(i.unsubDevice?.(),i.unsubEntity?.(),i.unsubDevice=void 0,i.unsubEntity=void 0,void 0!==i.reloadTimer&&globalThis.clearTimeout(i.reloadTimer),i.reloadTimer=void 0))}}function ah(e){const t=th(e);t&&(rh(e,t),oh(e,t))}function lh(e){const t=th(e);if(!t)return{revision:0,authoritative:!1,access:"limited",devices:e?.devices||{},entities:e?.entities||{},lastSuccess:0,error:"registry_unavailable"};let i=e?.devices||{},n=e?.entities||{};if(t.authoritative){const r=t.liveDevices!==i||t.liveEntities!==n,o=void 0!==t.liveDevices||void 0!==t.liveEntities;if(r&&(t.liveDevices=i,t.liveEntities=n,t.projectedRevision=void 0,o&&rh(e,t)),t.projectedRevision!==t.revision||!t.projectedDevices||!t.projectedEntities){const e={...t.devices},r={...t.entities};for(const[t,n]of Object.entries(i))Object.prototype.hasOwnProperty.call(e,t)||(e[t]=n);for(const[e,t]of Object.entries(n))Object.prototype.hasOwnProperty.call(r,e)||(r[e]=t);t.projectedDevices=e,t.projectedEntities=r,t.projectedRevision=t.revision}i=t.projectedDevices,n=t.projectedEntities}return{revision:t.revision,authoritative:t.authoritative,access:t.access,devices:i,entities:n,lastSuccess:t.lastSuccess,error:t.error}}function ch(e){if(!e||"object"!=typeof e&&"function"!=typeof e)return 0;let t=Zc.get(e);return t||(t=Jc++,Zc.set(e,t)),t}function hh(e,t=lh(e)){return[t.revision,t.access,ch(t.devices),ch(t.entities)].join(":")}function dh(e){return!!e&&null==e.disabled_by}function uh(e,t=lh(e)){const i={},n={},r={};for(const[e,n]of Object.entries(t.devices||{}))dh(n)&&(i[e]=n);for(const[e,i]of Object.entries(t.entities||{})){if(!dh(i))continue;const r=i.device_id?t.devices?.[i.device_id]:null;t.authoritative&&i.device_id&&!r||(r&&!dh(r)||(n[e]=i))}for(const[i,n]of Object.entries(e?.states||{})){const e=t.entities?.[i];if(e&&!dh(e))continue;const o=e?.device_id?t.devices?.[e.device_id]:null;t.authoritative&&e?.device_id&&!o||(o&&!dh(o)||(r[i]=n))}return{...e,devices:i,entities:n,states:r}}function ph(e,t=lh(e)){return{...e,devices:t.devices||{},entities:t.entities||{}}}function mh(e,t){const i=[];for(const[n,r]of Object.entries(e||{}))r?.device_id===t&&i.push(n);return i}function _h(){if(eh)return eh;if("undefined"==typeof localStorage)return{};try{const e=JSON.parse(localStorage.getItem(Qc)||"{}");if(!e||"object"!=typeof e||Array.isArray(e))return{};const t=Date.now(),i={};for(const[n,r]of Object.entries(e))!r||"active"!==r.kind&&"ha_disabled"!==r.kind||!Number.isFinite(r.ts)||t-r.ts>7776e6||(i[n]=r);return eh=i,eh}catch{return{}}}function fh(e,t,i=lh(e)){if(!t||"virtual"===t)return{kind:"active",enabledEntityIds:[],allEntityIds:[]};const n=t.indexOf(":");if(n<1)return{kind:"unverified",reason:"registry_unavailable",enabledEntityIds:[],allEntityIds:[]};const r=t.slice(0,n),o=t.slice(n+1);if("device"!==r&&"entity"!==r||!o)return{kind:"unverified",reason:"registry_unavailable",enabledEntityIds:[],allEntityIds:[]};const s=i.devices||{},a=i.entities||{};if(i.authoritative){if("device"===r){const e=s[o];if(!e)return{kind:"orphaned",reason:"device_missing",enabledEntityIds:[],allEntityIds:[]};const t=mh(a,o);if(!dh(e))return{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:t};const i=t.filter(e=>dh(a[e]));return t.length&&!i.length?{kind:"ha_disabled",reason:"all_entities",enabledEntityIds:[],allEntityIds:t}:{kind:"active",enabledEntityIds:i,allEntityIds:t}}const t=a[o];return t&&!dh(t)?{kind:"ha_disabled",reason:"entity",enabledEntityIds:[],allEntityIds:[o]}:t?.device_id&&!s[t.device_id]?{kind:"orphaned",reason:"device_missing",enabledEntityIds:[],allEntityIds:[o]}:t?.device_id&&!dh(s[t.device_id])?{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:[o]}:t||e?.states?.[o]?{kind:"active",enabledEntityIds:[o],allEntityIds:[o]}:{kind:"orphaned",reason:"entity_missing",enabledEntityIds:[],allEntityIds:[]}}const l=function(e){return _h()[e]||null}(t);if("device"===r){const t=s[o],i=mh(a,o);if(null!=t?.disabled_by)return{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:i};const n=i.filter(e=>{const t=a[e];return null==t?.disabled_by&&(!t.device_id||null==s[t.device_id]?.disabled_by)});if(i.length&&!n.length&&i.every(e=>null!=a[e]?.disabled_by))return{kind:"ha_disabled",reason:"all_entities",enabledEntityIds:[],allEntityIds:i};if("ha_disabled"===l?.kind)return{kind:"ha_disabled",reason:l.reason||"device",enabledEntityIds:[],allEntityIds:i};if(t||n.some(t=>!!e?.states?.[t]))return{kind:"active",enabledEntityIds:n,allEntityIds:i}}else{const t=a[o];if(null!=t?.disabled_by)return{kind:"ha_disabled",reason:"entity",enabledEntityIds:[],allEntityIds:[o]};if(t?.device_id&&null!=s[t.device_id]?.disabled_by)return{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:[o]};if("ha_disabled"===l?.kind)return{kind:"ha_disabled",reason:l.reason||"entity",enabledEntityIds:[],allEntityIds:[o]};if(t||e?.states?.[o])return{kind:"active",enabledEntityIds:[o],allEntityIds:[o]}}return{kind:"unverified",reason:"registry_unavailable",enabledEntityIds:[],allEntityIds:[]}}function gh(e){const t={};for(const[i,n]of Object.entries(e.entities)){if(!n?.device_id||!dh(n))continue;const r=e.devices?.[n.device_id];r&&!dh(r)||(t[n.device_id]=t[n.device_id]||[]).push(i)}return t}function vh(e,t){const i=new Map;for(const n of e){if(!0===n?.removed)continue;const e=n?.binding||"";if(!e.startsWith("entity:"))continue;const r=e.slice(7);if(!r)continue;const o=t?.entities?.[r]?.device_id;if(!o)continue;const s=i.get(o)||new Set;s.add(r),i.set(o,s)}return{byDevice:i}}function yh(e,t,i,n){const r=n.byDevice.get(t);return r?.size?{partial:!0,entityIds:i.filter(t=>!r.has(t)&&!e?.entities?.[t]?.hidden)}:{partial:!1,entityIds:[...i]}}function bh(e,t,i){if(t.identifiers?.[0]?.[0])return t.identifiers[0][0];for(const t of i){const i=e.entities[t]?.platform;if(i)return i}return""}function wh(e,t){if(/_device_temperature$/.test(t))return!1;if(e.entities?.[t]?.entity_category)return!1;const i=e.states[t];if(!i)return/_temperature$/.test(t);const n=i.attributes||{};return"temperature"===n.device_class||/°C|°F/.test(n.unit_of_measurement||"")||/_temperature$/.test(t)}const kh=["vacuum","lawn_mower","climate","media_player","light","cover","lock","valve","alarm_control_panel","water_heater","fan","humidifier","siren","camera","remote"],xh=e=>[...e.filter(e=>!e.reg?.hidden),...e.filter(e=>!!e.reg?.hidden)];function $h(e,t){const i=t.map(t=>({eid:t,reg:e?.entities?.[t]})).filter(e=>!!e.reg);if(!i.length)return[];const n=i.filter(e=>!e.reg.entity_category),r=n.length?n:i;for(const e of kh){const t=r.filter(t=>t.eid.startsWith(e+"."));if(t.length)return xh(t).map(e=>e.eid)}const o=r.filter(t=>function(e,t){if(!t.startsWith("binary_sensor."))return!1;const i=Rc(e?.states?.[t]?.attributes?.device_class||e?.entities?.[t]?.device_class||e?.entities?.[t]?.original_device_class);return yc.has(i)||bc.has(i)||wc.has(i)||kc.has(i)||"moving"===i||xc.has(i)}(e,t.eid));if(o.length)return xh(o).map(e=>e.eid);const s=r.filter(e=>e.eid.startsWith("switch."));if(s.length){const t=xh(s),n=t.find(t=>Fc(e,t.eid));if(s.length>1&&n){const t=i.filter(t=>t.eid!==n.eid&&"config"!==t.reg?.entity_category&&null!=Pc(e,t.eid)),r=t.filter(e=>!e.reg?.entity_category),o=r.length?r:t;for(const t of[0,1,2]){const i=xh(o.filter(i=>Pc(e,i.eid)===t));if(i.length)return[i[0].eid,n.eid]}}return[(n||t[0]).eid]}const a=[];for(const e of Se)a.push(...xh(r.filter(t=>t.eid.startsWith(e+"."))));return a.push(...xh(r.filter(e=>!Se.includes(e.eid.split(".")[0])))),a.map(e=>e.eid)}function Sh(e,t,i){const n=t.map(t=>({eid:t,reg:e.entities[t],st:e.states[t]})).filter(e=>e.reg),r=[n.filter(e=>!e.reg.hidden&&!e.reg.entity_category),n.filter(e=>!e.reg.entity_category),n.filter(e=>!e.reg.hidden),n];if("mdi:thermometer"===i||"mdi:air-filter"===i)for(const t of r){const i=t.find(t=>wh(e,t.eid));if(i)return i.eid}const o=$h(e,t);return o.find(dn)||o[0]}function Mh(e,t,i=[]){return[...new Set(Ch(e,t,i))].filter(e=>dn(e))}function Ch(e,t,i=[]){const n=e?.startsWith("entity:")?new Set([e.slice(7)]):new Set(i);return(t||[]).filter(e=>"string"==typeof e&&!n.has(e))}function Th(e,t){if("string"==typeof t)return e.area===t;const i=e.marker?.room_id;return i?!!t.id&&i===t.id:!!t.area&&e.area===t.area}function Rh(e){const t=e.marker?.binding?.startsWith("entity:")?e.marker.binding.slice(7):null,i=e.entities.filter(dn),n=e.primary&&dn(e.primary)?e.primary:null;return[...new Set([t,n,...i].filter(e=>!!e&&dn(e)))]}function Dh(e){const t=Rh(e),i=e.marker?.light_entity;return i&&t.includes(i)?i:t[0]||null}function zh(e,t){if(!1===t.marker?.is_light)return[];if(!0===t.marker?.is_light){return[{eid:Dh(t),via:"forced"}]}const i=t.primary||$h(e,t.entities)[0];return i&&!i.startsWith("light.")?[]:t.entities.filter(t=>t.startsWith("light.")&&!!e.states?.[t]).map(e=>({eid:e,via:"light"}))}const Ah=new WeakMap,Ph=new WeakMap;function Oh(e){return e.map(e=>[e.id||"",!0===e.hidden?1:0,e.primary||"",[...e.entities].join(","),void 0===e.controls?"<runtime-undefined>":[...e.controls].join(","),e.marker?.id||"",e.marker?.binding||"",e.marker?.is_light,e.marker?.tap_action||"",!0===e.marker?.removed?1:0,e.marker?.light_entity||"",null==e.marker?.controls?"<persisted-null>":[...e.marker.controls].join(",")].join("")).join("")}function Fh(e){const t=Oh(e),i=Ah.get(e);if(i?.fingerprint===t)return i;const n=e.filter(e=>!e.hidden),r=new Map,o=new Map;for(const t of e){o.set(t,Ch(t.marker?.binding,t.marker?.controls??t.controls,t.entities));const e=t.hidden||!0!==t.marker?.is_light?null:t.marker?.id||t.id;e&&r.set(String(e),t)}const s=new Map;for(const t of e){const e=o.get(t)||[],i=new Set(void 0===t.controls?e.filter(dn):t.controls.filter(dn)),n=Dh(t),a=i.size?[...i]:n?[n]:[];for(const i of e){if(!i.startsWith("marker:"))continue;const e=i.slice(7);if(!e||e===String(t.marker?.id||t.id||""))continue;if(!r.has(e))continue;const n=s.get(e)||{markerId:e,controllers:[],driverEids:[]};n.controllers.push({device:t,driverEids:[...a]}),n.driverEids=[...new Set([...n.driverEids,...a])],s.set(e,n)}}const a={fingerprint:t,visible:n,markerById:r,persistedByDevice:o,incomingByMarker:s};return Ah.set(e,a),a}function Ih(e){return Fh(e).incomingByMarker}function Eh(e,t){const i=Mh(t.marker?.binding,t.controls??t.marker?.controls,t.entities),n=Ch(t.marker?.binding,t.marker?.controls??t.controls,t.entities);return(null!=t.marker?.is_light||!i.length&&!n.some(e=>e.startsWith("marker:")))&&zh(e,t).length>0}function Hh(e,t){return zh(e,t).some(e=>!!e.eid)}function Nh(e,t,i,n){const r="always"===e||"auto"===e&&t,o=r&&!i;return{sourceExists:r,fromSourceEnabled:r&&i,manualEnabled:r,radiusEnabled:r,passive:o,effectiveMode:o&&"auto"===n?"fixed":n}}function Lh(e,t){const i=Mh(t.marker?.binding,t.controls??t.marker?.controls,t.entities).map(e=>({eid:e,via:"controls"})),n=Eh(e,t)?zh(e,t):[];for(const e of n)e.eid&&i.some(t=>t.eid===e.eid)||i.push(e);return i}function Bh(e,t,i,n){if(null!=i)return Bh(e,t,null,n).filter(e=>Th(e.device,i));const r=Oh(t),o=function(e,t){const i=new Set;for(const e of t){for(const t of e.entities)i.add(t);for(const t of e.controls||e.marker?.controls||[])"string"!=typeof t||t.startsWith("marker:")||i.add(t)}return[...i].sort().map(t=>`${t}:${e?.states?.[t]?.state??"<missing>"}`).join("|")}(e,t),s=Vc(n),a=Ph.get(t);if(a?.graphFingerprint===r&&a.stateFingerprint===o&&a.virtualLightFingerprint===s&&a.registry===e?.entities)return a.sources;const{visible:l,markerById:c,persistedByDevice:h,incomingByMarker:d}=Fh(t),u=null==i?l:l.filter(e=>Th(e,i)),p=new Map,m=new Map;for(const t of u){const i=Lh(e,t).filter(e=>"controls"!==e.via);for(const n of i){const i=!0===t.marker?.is_light?String(t.marker?.id||t.id||""):"",r=i?`marker:${i}`:`entity:${n.eid}`,o=n.eid?[n.eid]:[],s={key:r,eid:n.eid||"",stateEids:o,serviceEids:o,device:t,via:n.via,castsGlow:!0,passive:!n.eid,on:!n.eid||"on"===e.states?.[n.eid]?.state};p.set(t,[...p.get(t)||[],s]),n.eid&&m.set(n.eid,s)}}const _=new Map;for(const e of t){const t=h.get(e)||[],i=new Set(void 0===e.controls?t.filter(dn):e.controls);_.set(e,i)}for(const t of p.values())for(const i of t){if(!i.passive)continue;const t=i.key.slice(7),r=d.get(t);i.on=!r||r.driverEids.some(t=>"on"===e.states?.[t]?.state),!r&&Gc(i.device.marker)&&(i.on=Kc(i.device.marker,n))}const f=new Map,g=e=>{const t=f.get(e.key);(!t||e.castsGlow&&!t.castsGlow)&&f.set(e.key,e)};for(const t of l){const n=h.get(t)||[],r=null==i||Th(t,i);for(const i of n){if(i.startsWith("marker:")){const e=c.get(i.slice(7)),t=e?p.get(e):null;if(t)for(const e of t)g(e);continue}if(!dn(i)||!_.get(t)?.has(i))continue;const n=m.get(i);n?g(n):r&&g({key:`entity:${i}`,eid:i,stateEids:[i],serviceEids:[i],device:t,via:"controls",castsGlow:!1,passive:!1,on:"on"===e.states?.[i]?.state})}for(const e of p.get(t)||[])g(e)}const v=[...f.values()];return Ph.set(t,{graphFingerprint:r,stateFingerprint:o,virtualLightFingerprint:s,registry:e?.entities,sources:v}),v}function qh(e){const t=e.filter(e=>e.castsGlow);return t.find(e=>e.on)||t[0]||null}function Wh(e){return e.length?e.some(e=>e.on)?"on":"off":"none"}function jh(e,t){const i=[];for(const n of t){const t=e.states[n];if(!t)continue;const r=(t.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(n)||"lqi"===r){const e=parseFloat(t.state);isNaN(e)||i.push(e);continue}const o=t.attributes?.linkquality??t.attributes?.lqi;if(null!=o){const e=parseFloat(o);isNaN(e)||i.push(e)}}return gi(i)}function Uh(e,t){for(const i of t){if(!wh(e,i))continue;const t=e.states[i];if(!t)continue;const n=parseFloat(t.state);if(!isNaN(n))return Math.round(10*n)/10}return null}function Vh(e,t){for(const i of t){if(!i.startsWith("climate."))continue;const t=e.states[i];if(!t||"unavailable"===t.state||"unknown"===t.state)continue;const n=parseFloat(t.attributes?.current_temperature);if(Number.isFinite(n))return Math.round(10*n)/10}return null}function Gh(e,t){if(e.entities?.[t]?.entity_category)return!1;const i=e.states[t];if(!i)return/_humidity$/.test(t);const n=i.attributes||{};return"humidity"===n.device_class||"%"===n.unit_of_measurement&&/_humidity$/.test(t)||/_humidity$/.test(t)}function Kh(e,t){for(const i of t){if(!Gh(e,i))continue;const t=e.states[i];if(!t)continue;const n=parseFloat(t.state);if(!isNaN(n))return Math.round(n)}return null}function Yh(e,t){if(!t)return[];const i=[];for(const[t,n]of Object.entries(e.entities)){if(!t.startsWith("light.")||n.hidden||!dh(n))continue;let r=null;if("group"===n.platform)r=n.area_id||null;else{if(!n.device_id)continue;{const t=e.devices[n.device_id];if(!dh(t))continue;if("Group"!==t?.model)continue;r=t.area_id||n.area_id||null}}if(!r)continue;const o=e.states[t];i.push({eid:t,name:n.name||o?.attributes?.friendly_name||t,area:r})}return i}function Xh(e,t,i,n,r){const o=$e(t,i,r);if(o!==xe)return o;const s=[];for(const t of n){const i=e.states[t]?.attributes?.device_class;i&&s.push(i)}return function(e){for(const t of e){const e=ke[t];if(e)return e}return null}(s)??xe}function Zh(e,t){return e.map(e=>{if(!Array.isArray(e.controls))return e;const i=e.controls.filter(e=>!("string"==typeof e&&e.startsWith("marker:")&&t.has(e.slice(7))));return i.length===e.controls.length?e:{...e,controls:i.length?i:null}})}function Jh(e,t,i){if(!t||!i||t===i)return[...e];const n=`marker:${t}`,r=`marker:${i}`;return e.map(e=>{const t=Array.isArray(e.controls)?e.controls.map(e=>e===n?r:e):e.controls,i="derived_marker_state"===e.value_badge?.source?.kind&&e.value_badge.source.ref===n?{...e.value_badge,source:{...e.value_badge.source,ref:r}}:e.value_badge,o="derived_marker_state"===e.value_source?.kind&&e.value_source.ref===n?{...e.value_source,ref:r}:e.value_source;return t===e.controls&&i===e.value_badge&&o===e.value_source?e:{...e,controls:t,...void 0!==i?{value_badge:i}:{},...void 0!==o?{value_source:o}:{}}})}function Qh(e,t,i){if(!t||t===i)return!0;const n=new Map;for(const t of e)n.set(t.id,(t.controls||[]).filter(e=>"string"==typeof e&&e.startsWith("marker:")).map(e=>e.slice(7)));const r=new Set,o=[i];for(;o.length;){const e=o.pop();if(e===t)return!0;r.has(e)||(r.add(e),o.push(...n.get(e)||[]))}return!1}function ed(e,t,i,n){const r=new Set([t]),o=e.filter(e=>{const o=e.id===t||!n&&e.binding===i;return o&&r.add(e.id),!o});return{markers:n?o:[...o,{id:t,binding:i,removed:!0,hidden:!0}],cleanupIds:r}}function td(e){const t=new Set,i=new Set,n=new Set;for(const r of e||[]){const e=String(r.binding||"").indexOf(":");if(e<1)continue;const o=r.binding.slice(0,e),s=r.binding.slice(e+1);s&&(!0===r?.removed?"device"===o?t.add(s):"entity"===o&&i.add(s):"entity"===o&&n.add(s))}return{devices:t,entities:i,liveEntities:n}}function id(e,t,i){if(i.liveEntities.has(t))return!1;if(i.entities.has(t))return!0;const n=e?.entities?.[t]?.device_id;return!!n&&i.devices.has(n)}function nd(e,t,i,n,r){const o=Mh(t.binding,t.controls,e.entities).filter(e=>!id(i,e,n)).filter(e=>"active"===fh(i,"entity:"+e,r).kind);e.marker=t,e.controls=o,e.userHidden=!0===t.hidden,e.hidden=e.userHidden||"ha_disabled"===e.bindingStatus?.kind,t.name&&(e.name=t.name),t.icon&&(e.icon=t.icon),null!=t.model&&(e.model=t.model),e.link=t.link??null,e.description=t.description??null,e.pdfs=t.pdfs||[],e.tapAction=t.tap_action??null}function rd(e){const t=e.hass,i=e.registry||lh(t),n=uh(t,i),r=ph(t,i),{areaToSpace:o,markers:s,settings:a,excluded:l,iconRules:c}=e,h=!1!==a.group_lights,d=td(s),u=Yh(n,h).filter(e=>!id(n,e.eid,d)),p=new Set(u.map(e=>e.area)),m=gh(n),_=vh(s,r),f=new Set(s.map(e=>e.binding)),g=[];for(const e of Object.values(n.devices)){const r=e.area_id;if(!r||!o[r])continue;if("service"===e.entry_type)continue;if(f.has("device:"+e.id))continue;if("active"!==fh(t,"device:"+e.id,i).kind)continue;const s=yh(n,e.id,m[e.id]||[],_);if(s.partial&&!s.entityIds.length)continue;const a=s.entityIds,d=bh(n,e,a);let u=l.has(d)||"Group"===e.model||/scene/i.test(e.model||"")||/bridge/i.test((e.model||"")+(e.name||""))||"myheat"===d&&!!e.via_device_id;if(!u&&h&&p.has(r)){const t=(e.name_by_user||e.name||"").trim();"mdi:lightbulb"===Xh(n,t,e.model,a,c)&&(u=!0)}u&&g.push("device:"+e.id)}return g}function od(e,t,i,n){if("string"==typeof e.room_id&&e.room_id.length>0&&null===e.area)return{area:"",space:e.space||n};const r=e.area||t||"";return{area:r,space:r&&i[r]||e.space||n}}function sd(e){const t=e.hass,i=e.registry||lh(t),n=uh(t,i),r=ph(t,i),{areaToSpace:o,markers:s,settings:a,excluded:l,showAll:c,firstSpaceId:h,loc:d,iconRules:u}=e,p=!1!==a.group_lights,m=td(s),_=Yh(n,p).filter(e=>!id(n,e.eid,m)),f=new Set(_.map(e=>e.area)),g=gh(n),v=function(e){const t={};for(const[i,n]of Object.entries(e.entities||{}))n?.device_id&&(t[n.device_id]=t[n.device_id]||[]).push(i);return t}(r),y=vh(s,r),b=new Set;for(const e of s){const[t,i]=e.binding.split(":");"device"!==t&&"entity"!==t||!i||b.add(e.binding)}const w=(e,t)=>s.find(i=>i.binding===e+":"+t),k={},x=[];for(const e of Object.values(n.devices)){const r=e.area_id;if(!r||!o[r])continue;if("service"===e.entry_type)continue;if(b.has("device:"+e.id))continue;const s=fh(t,"device:"+e.id,i);if("active"!==s.kind)continue;const h=w("device",e.id);if(h&&h.hidden&&!a.filter_seeded)continue;const m=yh(n,e.id,g[e.id]||[],y);if(m.partial&&!m.entityIds.length)continue;const _=m.entityIds,v=m.partial?{kind:"active",enabledEntityIds:_,allEntityIds:_}:s,$=bh(n,e,_),S=!a.filter_seeded;if(S&&!c){if(l.has($))continue;if("Group"===e.model)continue;if(/scene/i.test(e.model||""))continue;if(/bridge/i.test((e.model||"")+(e.name||"")))continue;if("myheat"===$&&e.via_device_id)continue}const M=(e.name_by_user||e.name||d("device.unnamed")).trim(),C=M+"|"+r;let T=Xh(n,M,e.model,_,u);if(_.some(e=>e.startsWith("lock."))&&(T="mdi:lock"),S&&!c&&p&&"mdi:lightbulb"===T&&f.has(r))continue;k[C]=(k[C]||0)+1;const R=k[C]>1?M+" "+k[C]:M,D={id:e.id,name:R,model:e.model||"",area:r,space:o[r],icon:T,entities:_,allEntities:v.allEntityIds,bindingStatus:v,bindingKind:"device",bindingRef:e.id,pdfs:[]};D.primary=Sh(n,_,T),"mdi:thermometer"!==T&&"mdi:air-filter"!==T||(D.temp=Uh(n,_)),D.primary&&Gh(n,D.primary)&&(D.hum=Kh(n,_)),x.push(D)}for(const e of _)o[e.area]&&(b.has("entity:"+e.eid)||x.push({id:"lg_"+e.eid,name:e.name,model:d("device.light_group"),area:e.area,space:o[e.area],icon:"mdi:lightbulb-group",entities:[e.eid],allEntities:[e.eid],bindingStatus:{kind:"active",enabledEntityIds:[e.eid],allEntityIds:[e.eid]},primary:e.eid,bindingKind:"entity",bindingRef:e.eid,pdfs:[]}));for(const e of s){if(e.removed)continue;const[s,l]=e.binding.split(":"),c="device"===s||"entity"===s?fh(t,e.binding,i):null;if(!e.hidden||a.filter_seeded||"ha_disabled"===c?.kind)if("device"===s){const t=c;if("unverified"===t.kind)continue;const s=r.devices[l],{area:a,space:p}=od(e,s?.area_id,o,h),_="active"===t.kind?t.enabledEntityIds:[];let f=s?Xh(n,s.name_by_user||s.name||"",s.model,_,u):"mdi:help-circle";_.some(e=>e.startsWith("lock."))&&(f="mdi:lock");const g={id:e.id,name:s?.name_by_user||s?.name||d("device.fallback"),model:s?.model||"",area:a,space:p,icon:f,entities:_,allEntities:t.allEntityIds.length?t.allEntityIds:s&&v[s.id]||[],bindingStatus:t,bindingKind:"device",bindingRef:l};g.primary=Sh(n,_,f),"mdi:thermometer"!==f&&"mdi:air-filter"!==f||(g.temp=Uh(n,_)),g.primary&&Gh(n,g.primary)&&(g.hum=Kh(n,_)),nd(g,e,r,m,i),x.push(g)}else if("entity"===s){if(id(r,l,m))continue;const t=c;if("unverified"===t.kind)continue;const s=r.entities[l],a=s?.area_id||s?.device_id&&r.devices[s.device_id]?.area_id||"",{area:d,space:p}=od(e,a,o,h),_=n.states[l],f=s?.name||_?.attributes?.friendly_name||l;let g=Xh(n,f,"",[l],u);l.startsWith("lock.")&&(g="mdi:lock");const v={id:e.id,name:f,model:"",area:d,space:p,icon:g,entities:"active"===t.kind?[l]:[],allEntities:[l],bindingStatus:t,primary:"active"===t.kind?l:void 0,bindingKind:"entity",bindingRef:l};"mdi:thermometer"!==g&&"mdi:air-filter"!==g||!v.entities.length||(v.temp=Uh(n,v.entities)),v.entities.length&&Gh(n,l)&&(v.hum=Kh(n,v.entities)),nd(v,e,r,m,i),x.push(v)}else{const t=e.area||"",n=e.space||t&&o[t]||h,s={id:e.id,name:e.name||d("device.virtual"),model:e.model||"",area:t,space:n,icon:e.icon||"mdi:map-marker",entities:[],allEntities:[],bindingStatus:{kind:"active",enabledEntityIds:[],allEntityIds:[]},bindingKind:"virtual",virtual:!0};nd(s,e,r,m,i),x.push(s)}}return x}function ad(e){const{marker:t,siblingMarkers:i=[],...n}=e;return sd({...n,markers:[...i.filter(e=>e.id!==t.id),t]}).find(e=>e.id===t.id)||null}function ld(e,t,i,n){if(!t)return null;if(function(e,t,i){if(!t)return!1;const n=t.indexOf(":");if(n<1)return!1;const r=t.slice(0,n),o=t.slice(n+1),s=td(i);return"device"===r?s.devices.has(o):"entity"===r&&id(e,o,s)}(e,t,n))return null;const r=t.indexOf(":");if(r<0)return null;const o=t.slice(0,r),s=t.slice(r+1);if(!s)return null;if("entity"===o){const t=parseFloat(e.states[s]?.state);return Number.isFinite(t)?"temp"===i?Math.round(10*t)/10:Math.round(t):null}if("device"===o){const t=Object.entries(e.entities).filter(([,e])=>e.device_id===s).map(([e])=>e);return"temp"===i?Uh(e,t):Kh(e,t)}return null}const cd=new RegExp(["water","voda","coolant","flow_?temp","return_?temp","target","setpoint","chip","cpu","processor","board","core_temp","device_temp","batter","akkum","freezer","fridge","oven","kettle","boiler"].join("|"),"i");function hd(e,t){return t.area?t.area:e&&t.id?`@room/${encodeURIComponent(e)}/${encodeURIComponent(t.id)}`:null}function dd(e){return null==e.area&&e.space&&e.room_id?hd(e.space,{id:e.room_id,area:null}):e.area||null}function ud(e){const t=e?.exclude_integrations;return t?new Set(t):ge}function pd(e,t,i,n=ge){const r=new Map;if(!e?.entities)return r;const o=td(i),s=new Set,a=new Map,l=new Map;for(const e of i||[]){if(e?.removed)continue;const t=(e.binding||"").indexOf(":");if(t<=0)continue;const i=e.binding.slice(0,t),n=e.binding.slice(t+1);if(!n)continue;!0===e.use_climate_temp&&s.add(n);const r=dd(e);r&&("entity"!==i||a.has(n)?"device"!==i||l.has(n)||l.set(n,r):a.set(n,r))}const c=new Map;for(const[t,i]of Object.entries(e.entities)){if(i.device_id&&o.devices.has(i.device_id)&&!o.liveEntities.has(t)||!i.device_id&&o.entities.has(t)&&!o.liveEntities.has(t))continue;const r=i.device_id?e.devices?.[i.device_id]:null;if(!dh(i)||r&&!dh(r))continue;const h=a.get(t)||(i.device_id?l.get(i.device_id):null)||i.area_id||r?.area_id||null;if(!h)continue;if(i.entity_category)continue;if(!(s.size>0&&t.startsWith("climate.")&&(s.has(t)||i.device_id&&s.has(i.device_id)))){if(n.has(i.platform))continue;if(cd.test(t))continue}let d=c.get(h);d||(d=new Map,c.set(h,d));const u=i.device_id||t;let p=d.get(u);if(!p){const n=e.states?.[t];p={name:(r?r.name_by_user||r.name:i.name||n?.attributes?.friendly_name||t)||t,model:r?.model,ents:[]},d.set(u,p)}p.ents.push(t)}for(const[i,n]of c){const o=[],a=[];for(const[i,r]of n){const n=Xh(e,r.name,r.model,r.ents,t),l="mdi:thermometer"===n||"mdi:air-filter"===n;if(l){const t=Uh(e,r.ents);null!=t&&o.push(t)}if(s.size>0&&(s.has(i)||r.ents.some(e=>s.has(e)))){const t=Vh(e,r.ents);null!=t&&o.push(t)}if(l||"mdi:water-percent"===n){const t=Kh(e,r.ents);null!=t&&a.push(t)}}(o.length||a.length)&&r.set(i,{temp:o.length?Math.round(o.reduce((e,t)=>e+t,0)/o.length*10)/10:null,hum:a.length?Math.round(a.reduce((e,t)=>e+t,0)/a.length):null})}return r}function md(e,t,i){const n=[];for(const r of t){if(r.area!==i||r.virtual)continue;const t=jh(e,r.entities);null!=t&&n.push(t)}return gi(n)}const _d={offStates:["off"],unknownUsesToggle:!0},fd={light:_d,switch:_d,fan:_d,humidifier:_d,input_boolean:_d,automation:_d,remote:_d,group:_d,climate:{..._d,featureMasks:{turn_on:256,turn_off:128,toggle:384}},media_player:{..._d,featureMasks:{turn_on:128,turn_off:256,toggle:384}},siren:{..._d,featureMasks:{turn_on:1,turn_off:2,toggle:3}},vacuum:{..._d,featureMasks:{turn_on:1,turn_off:2,toggle:3}},water_heater:{..._d,featureMasks:{turn_on:8,turn_off:8,toggle:8}},camera:{..._d,featureMasks:{turn_on:1,turn_off:1,toggle:1}}};function gd(e){return e.slice(0,e.indexOf("."))}function vd(e,t,i){if(!e?.services||"object"!=typeof e.services)return!1;const n=e.services?.[t];return!!n&&Object.prototype.hasOwnProperty.call(n,i)}function yd(e,t,i){return vd(e,t,i)?{domain:t,service:i}:vd(e,"homeassistant",i)?{domain:"homeassistant",service:i}:null}function bd(e,t){return e?.entities?.[t]||null}function wd(e,t,i){const n=e?.states?.[i],r=bd(t,i);return n?.attributes?.friendly_name||r?.name||r?.original_name||i}function kd(e,t){const i=bd(e,t);if(null!=i?.disabled_by)return!0;const n=i?.device_id?e?.devices?.[i.device_id]:null;return null!=n?.disabled_by}function xd(e,t){const i=e?.attributes?.supported_features;if(null==i||""===i)return!1;const n=Number(i);return Number.isFinite(n)&&(n&t)===t}function $d(e,t,i){const n=gd(i);if("lock"===n||"alarm_control_panel"===n)return!0;if("cover"!==n)return!1;const r=e?.states?.[i],o=bd(t,i),s=String(r?.attributes?.device_class||o?.device_class||o?.original_device_class||"");return Mi.has(s)}function Sd(e,t,i,n,r){return{ref:i,entityId:n,name:n?wd(e,t,n):null,reason:r}}function Md(e,t,i,n,r,o=null){return{target:null,skipped:Sd(e,t,i,n,r),semantics:o,nextEffect:null,command:null}}function Cd(e,t,i,n,r=i){const o=gd(i);if("cover"!==o&&"valve"!==o)return function(e,t,i,n,r=i){const o=gd(i),s=e?.states?.[i];if(kd(t,i))return Md(e,t,r,i,"ha-disabled","power");if($d(e,t,i))return Md(e,t,r,i,"secure");if(!s)return Md(e,t,r,i,"missing","power");if("unavailable"===s.state)return Md(e,t,r,i,"unavailable","power");const a=fd[o];if(!a)return Md(e,t,r,i,"unsupported");let l,c;if("unknown"===s.state||""===s.state){if(!a.unknownUsesToggle)return Md(e,t,r,i,"unsupported","power");l="toggle",c="toggle"}else a.offStates.includes(String(s.state))?(l="turn-on",c="turn_on"):(l="turn-off",c="turn_off");const h=a.featureMasks?.[c];if(h&&!xd(s,h))return Md(e,t,r,i,"unsupported","power");const d=yd(e,o,c);return d?{target:{entityId:i,name:wd(e,t,i),state:String(s.state||""),via:n},skipped:null,semantics:"power",nextEffect:l,command:{...d,data:{entity_id:i}}}:Md(e,t,r,i,"unsupported","power")}(e,t,i,n,r);if(kd(t,i))return Md(e,t,r,i,"ha-disabled",o);if($d(e,t,i))return Md(e,t,r,i,"secure",o);const s=e?.states?.[i];if(!s)return Md(e,t,r,i,"missing",o);if("unavailable"===s.state)return Md(e,t,r,i,"unavailable",o);const a=function(e,t,i){const n=String(i?.state||""),r="closed"===n?{service:`open_${t}`,effect:"open",feature:1}:"open"===n?{service:`close_${t}`,effect:"close",feature:2}:"opening"===n||"closing"===n?{service:`stop_${t}`,effect:"stop",feature:8}:null;return r&&xd(i,r.feature)&&vd(e,t,r.service)?r:xd(i,3)&&vd(e,t,"toggle")?{service:"toggle",effect:"toggle"}:null}(e,o,s);if(!a)return Md(e,t,r,i,"unsupported",o);return{target:{entityId:i,name:wd(e,t,i),state:String(s.state||""),via:n},skipped:null,semantics:o,nextEffect:a.effect,command:{domain:o,service:a.service,data:{entity_id:i}}}}function Td(e){return"entity"===e.bindingKind?e.bindingRef&&dn(e.bindingRef)?[e.bindingRef]:[]:"virtual"===e.bindingKind?[]:Rh(e)}function Rd(e){const t=e.marker?.toggle_entity;return t&&Td(e).includes(t)?t:null}function Dd(e,t,i){const n=function(e,t){if("entity"===e.bindingKind&&e.bindingRef){const t=e.marker?.light_entity?Dh(e):null;return[...new Set([t,e.bindingRef].filter(e=>!!e))]}const i=e.entities.length?e.entities:e.allEntities||[],n=e.marker?.light_entity||e.primary&&dn(e.primary)?Dh(e):null;return[...new Set([n,...$h(t,i)].filter(e=>!!e))]}(i,t);if(!n.length)return null;const r="entity"===i.bindingKind?"binding":"device-role";if("binding"===r)return Cd(e,t,n[0],r);let o=null,s=null;for(const i of n){const n=Cd(e,t,i,r);if(n.command)return n;const a=n.skipped?.reason;if("missing"===a||"unavailable"===a||"secure"===a)return n;"ha-disabled"!==a?o||=n:s||=n}return o||s}function zd(e){const t=e.skipped?.reason;return"missing"===t?"unavailable":t||"unsupported"}function Ad(e,t){return{origin:e,kind:"none",semantics:null,targets:[],skippedTargets:[],noneReason:t,nextEffect:null,command:null}}function Pd(e,t){return"cover"===e||"toggle"===e?"toggle":"more-info"===e||"run"===e||"info"===e||"none"===e?e:(null==e||""===e)&&"light"===t?"toggle":"info"}function Od(e,t){return{origin:e,kind:"single",semantics:t.semantics,targets:t.target?[t.target]:[],skippedTargets:t.skipped?[t.skipped]:[],noneReason:t.command?null:zd(t),nextEffect:t.nextEffect,command:t.command}}function Fd(e,t,i,n=[]){const r=new Map,o=[],s=new Set,a=e=>{const t=`${e.ref}\n${e.entityId||""}\n${e.reason}`;s.has(t)||(s.add(t),o.push(e))};for(const e of n)a(e);for(const n of i){const i=Cd(e,t,n.entityId,n.via,n.ref);i.target?r.set(n.entityId,r.get(n.entityId)||i.target):i.skipped&&a(i.skipped)}const l=[...r.values()];if(!l.length)return{origin:"explicit-toggle",kind:"group",semantics:"group-power",targets:l,skippedTargets:o,noneReason:o.length&&o.every(e=>"secure"===e.reason)?"secure":"configured-targets-missing",nextEffect:null,command:null};const c=l.some(e=>"on"===e.state)?"turn_off":"turn_on",h=yd(e,"homeassistant",c);return h?{origin:"explicit-toggle",kind:"group",semantics:"group-power",targets:l,skippedTargets:o,noneReason:null,nextEffect:"turn_on"===c?"turn-on":"turn-off",command:{...h,data:{entity_id:l.map(e=>e.entityId)}}}:{origin:"explicit-toggle",kind:"group",semantics:"group-power",targets:[],skippedTargets:[...o,...l.map(i=>Sd(e,t,i.entityId,i.entityId,"unsupported"))],noneReason:"unsupported",nextEffect:null,command:null}}function Id(e){return String(e.marker?.id||e.id||"")}function Ed(e){const{hass:t,device:i}=e,n=e.registryHass||t,r=function(e){return"toggle"===e.tapAction?"explicit-toggle":"cover"===e.tapAction?"legacy-cover":!e.tapAction&&e.primary?.startsWith("light.")?"default-light":null}(i);if(!r)return null;const o=i.marker;if("explicit-toggle"===r&&Gc(o)){const t=String(o?.id||i.id||""),n=Ih(e.devices).get(t);if(n)return function(e,t){const i=e.registryHass||e.hass;return Fd(e.hass,i,t.driverEids.map(e=>({entityId:e,via:"control-marker-driver",ref:`marker:${t.markerId}`})))}(e,n);const s=Kc(o,e.virtualLights);return{origin:r,kind:"single",semantics:"power",targets:[{entityId:"",name:i.name,state:s?"on":"off",via:"virtual-light"}],skippedTargets:[],noneReason:null,nextEffect:s?"turn-off":"turn-on",command:null,operation:{kind:"virtual-light",markerId:o.id}}}if("explicit-toggle"===r){if(Ch(i.marker?.binding,i.marker?.controls??i.controls,i.entities).length)return function(e,t=null){const{hass:i,device:n,devices:r}=e,o=e.registryHass||i,s=Ch(n.marker?.binding,n.marker?.controls??n.controls,n.entities),a=e.lightSources||Bh(i,r,null,e.virtualLights),l=new Map;for(const e of a){if(!e.key.startsWith("marker:"))continue;const t=l.get(e.key)||[];t.push(e),l.set(e.key,t)}const c=Ih(r),h=new Map;for(const e of r){const t=String(e.marker?.id||e.id||"");t&&h.set(t,e)}const d=[],u=[];t&&d.push({entityId:t,via:"entity"===n.bindingKind?"binding":"device-role",ref:t});for(const e of s){if(!e.startsWith("marker:")){dn(e)?d.push({entityId:e,via:"control-entity",ref:e}):u.push(Sd(i,o,e,e.includes(".")?e:null,"unsupported"));continue}const t=l.get(e)||[];if(!t.length){const t=h.get(e.slice(7));if("ha_disabled"===t?.bindingStatus?.kind){const n=t.bindingStatus.allEntityIds[0]||null;u.push({ref:e,entityId:n,name:t.name||(n?wd(i,o,n):null),reason:"ha-disabled"})}else u.push(Sd(i,o,e,null,"missing"));continue}const r=[...new Set(t.flatMap(e=>e.serviceEids))];if(r.length){for(const t of r)d.push({entityId:t,via:"control-entity",ref:e});continue}const s=t.some(e=>e.passive),a=e.slice(7),p=Id(n),m=c.get(a)?.controllers.find(e=>Id(e.device)===p);if(s&&m?.driverEids.length)for(const t of m.driverEids)d.push({entityId:t,via:"control-marker-driver",ref:e});else u.push(Sd(i,o,e,null,s?"missing":"unsupported"))}return Fd(i,o,d,u)}(e,Rd(i))}if("legacy-cover"===r){const e=i.entities.find(e=>e.startsWith("cover."))||i.allEntities?.find(e=>e.startsWith("cover."));return e?Od(r,Cd(t,n,e,"device-role")):Ad(r,"no-actionable-entity")}const s=Rd(i),a=s?Cd(t,n,s,"entity"===i.bindingKind?"binding":"device-role"):Dd(t,n,i);return a?Od(r,a):Ad(r,i.virtual||"virtual"===i.bindingKind?"no-actionable-entity":"no-binding")}function Hd(e){if(!e)return[];const t=Array.isArray(e.data.entity_id)?e.data.entity_id:[e.data.entity_id];return[...new Set(t)].sort()}function Nd(e){return e?e.operation?e.operation:e.command?{kind:"ha-service",command:e.command}:null:null}const Ld=new Set(["missing","ha-disabled","unavailable"]);function Bd(e,t){const i=Nd(e),n=Nd(t);return!(!i||!n||i.kind!==n.kind)&&("virtual-light"===i.kind&&"virtual-light"===n.kind?i.markerId===n.markerId:"ha-service"===i.kind&&"ha-service"===n.kind&&function(e,t){const i=Hd(e),n=Hd(t);return i.length===n.length&&i.every((e,t)=>e===n[t])}(i.command,n.command))}function qd(e,t){const i=e.targets[0]||e.skippedTargets[0],n=[];return"group"===e.kind?e.targets.length&&n.push(t.group(e.targets)):i&&n.push(t.single(i)),e.nextEffect&&e.targets.length&&n.push("group"===e.kind?t.groupCurrentNext(e.targets,e.nextEffect):t.currentNext(e.targets[0],e.nextEffect)),e.skippedTargets.length&&n.push(t.skipped(e.skippedTargets)),!e.command&&e.noneReason&&n.push(t.none(e.noneReason)),n}const Wd=e=>!!e&&e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1]);function jd(e,t=5,i=5){return po(e.cm,t,i)/2}function Ud(e,t,i=1,n=5,r=5,o=0){const s=e.host;if(!s||"partition"!==s.kind||"string"!=typeof s.id||!s.id)return{resolved:null,reason:"invalid-host"};const a=t.find(e=>e.id===s.id);if(!a)return{resolved:null,reason:"missing-partition"};if(!Wd(a.a)||!Wd(a.b)||!Number.isFinite(s.t)||s.t<0||s.t>1)return{resolved:null,reason:"invalid-position"};const l=a.b[0]-a.a[0],c=a.b[1]-a.a[1],h=Math.hypot(l,c),d=Number(e.length)*i;if(!(h>1e-9&&d>0&&Number.isFinite(d)))return{resolved:null,reason:"invalid-length"};const u=s.t*h;if(u-d/2<o-1e-9||u+d/2>h-o+1e-9)return{resolved:null,reason:"does-not-fit"};const p=l/h,m=c/h;let _=180*Math.atan2(c,l)/Math.PI;return _>=90?_-=180:_<-90&&(_+=180),{reason:null,resolved:{opening:e,host:s,partition:a,center:[a.a[0]+l*s.t,a.a[1]+c*s.t],angle:_,length:d,depth:po(a.cm,n,r),t:s.t,axis:{a:[a.a[0],a.a[1]],b:[a.b[0],a.b[1]],ux:p,uy:m,length:h}}}}function Vd(e,t,i=1,n=5,r=5){return Ud(e,t,i,n,r,0)}function Gd(e,t,i=1,n=5,r=5){const o=e.host,s="partition"===o?.kind?t.find(e=>e.id===o.id):void 0;if(!s)return Vd(e,t,i,n,r);const a=Ud(e,t,i,n,r,jd(s,n,r));return"does-not-fit"===a.reason?{resolved:null,reason:"does-not-fit-jamb"}:a}function Kd(e,t){return!e||(e.length!==t.length||e.host?.kind!==t.host?.kind||e.host?.id!==t.host?.id||e.host?.t!==t.host?.t)}function Yd(e){const{center:t,length:i,axis:n,host:r}=e,o=i/2;return{hostId:r.id,a:[t[0]-n.ux*o,t[1]-n.uy*o],b:[t[0]+n.ux*o,t[1]+n.uy*o],depth:e.depth}}function Xd(e,t=!1){const i=t?1:-1,n=e.depth/2;return{ox:-e.axis.uy*i*n,oy:e.axis.ux*i*n,cm:e.partition.cm,side:i}}function Zd(e,t,i){return e.flatMap(e=>!Wd(e.a)||!Wd(e.b)||Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])<=1e-9?[]:[{roomId:"",a:[e.a[0],e.a[1]],b:[e.b[0],e.b[1]],key:`partition:${e.id}`,kind:"outer",cm:e.cm,open:!1,half:po(e.cm,t,i)/2,partitionHost:{kind:"partition",id:e.id}}])}function Jd(e,t,i){const{center:n,length:r,axis:o}=e,s=r/2,a=t.flatMap(e=>{if(!e.kind||e.open)return[];const t=e.b[0]-e.a[0],r=e.b[1]-e.a[1],a=Math.hypot(t,r);if(!(a>i))return[];const l=t/a,c=r/a;if(Math.abs(o.ux*c-o.uy*l)>1e-6)return[];if(Math.abs((n[0]-e.a[0])*c-(n[1]-e.a[1])*l)>i)return[];const h=e=>(e[0]-n[0])*o.ux+(e[1]-n[1])*o.uy,d=h(e.a),u=h(e.b),p=Math.max(-s,Math.min(d,u)),m=Math.min(s,Math.max(d,u));return m>=p-i?[[p,m]]:[]});if(!a.length)return!1;a.sort((e,t)=>e[0]-t[0]||e[1]-t[1]);let l=-s;for(const[e,t]of a){if(e>l+i)return!1;if(l=Math.max(l,t),l>=s-i)return!0}return!1}function Qd(e,t,i=1e-9){const n=e.length/(2*e.axis.length),r=e.t-n,o=e.t+n;return t.some(t=>{if(t.host.id!==e.host.id||t.opening.id===e.opening.id)return!1;const n=t.length/(2*t.axis.length);return Math.max(r,t.t-n)<Math.min(o,t.t+n)-i})}function eu(e,t,i){return{...e,x:t.center[0]/i,y:t.center[1]/i,angle:t.angle}}const tu=[o`
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
    @keyframes fixedfloor-spin {
      to { transform: rotate(360deg); }
    }
    .spacer {
      flex: 1;
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
      position: static; /* the main .zoomwrap SVG is pinned to inset:0 — not this icon */
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
    }
    @keyframes hp-pulse-short {
      0% { transform: scale(1); opacity: 0.55; }
      70% { opacity: 0.22; }
      100% { transform: scale(var(--ripple-scale, 1.5)); opacity: 0; }
    }
    /* Alternate identity: a rapid retrigger restarts the browser timeline. */
    @keyframes hp-pulse-short-b {
      0% { transform: scale(1); opacity: 0.55; }
      70% { opacity: 0.22; }
      100% { transform: scale(var(--ripple-scale, 1.5)); opacity: 0; }
    }
    @keyframes hp-pulse-continuous {
      0% { transform: scale(1); opacity: 0.55; }
      65% { opacity: 0.18; }
      100% { transform: scale(var(--ripple-scale, 1.5)); opacity: 0; }
    }
    @keyframes hp-pulse-alarm {
      0% { transform: scale(1); opacity: 0.72; }
      100% { transform: scale(1.5); opacity: 0; }
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
    @keyframes hp-sunfade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes hp-sunfade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    .sr-only {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
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
`,o`
    .fixedfloor-loading {
      animation: fixedfloor-spin 1.1s linear infinite;
    }
    .fixedfloor-error p {
      max-width: 42rem;
      margin: 0;
      overflow-wrap: anywhere;
    }
    @media (prefers-reduced-motion: reduce) {
      .fixedfloor-loading { animation: none; }
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
    .zoomwrap {
      position: absolute;
      inset: 0;
      z-index: 1;
    }
    .stage.mode-transition,
    .stage.mode-transition .zoomwrap {
      transition: none !important;
    }
    .stage.mode-transition .hp-view-only-layer,
    .stage.mode-transition .hp-editor-only-layer {
      pointer-events: none;
      will-change: opacity;
    }
    .stage.mode-transition .hp-paper {
      fill: var(--hp-mode-paper) !important;
    }
    /* Four-phase environment (#146): constant layers cross-fade because CSS
       gradients themselves are not reliably interpolated. Everything stays
       behind the plan; the plan tree is never dimmed, tinted or faded. */
    .hp-day-cycle-env {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
      isolation: isolate;
    }
    .hp-day-cycle-bg {
      position: absolute;
      inset: 0;
      opacity: 0;
      overflow: hidden;
      transition: opacity 1100ms cubic-bezier(.22, .61, .36, 1);
    }
    .hp-day-cycle-bg.active { opacity: 1; }
    .hp-day-cycle-sun {
      position: absolute;
      left: var(--hp-day-cycle-sun-x);
      top: var(--hp-day-cycle-sun-y);
      width: clamp(140px, 25cqw, 250px);
      height: clamp(140px, 25cqw, 250px);
      transform: translate(-50%, -50%);
      border-radius: 50%;
      filter: blur(10px);
      opacity: var(--hp-day-cycle-sun-opacity);
      transition:
        left 1100ms cubic-bezier(.22, .61, .36, 1),
        top 1100ms cubic-bezier(.22, .61, .36, 1),
        opacity 1100ms cubic-bezier(.22, .61, .36, 1);
    }
    .stage.mode-transition .hp-day-cycle-env { transition: none; }
    .stage.daycycle .hp-paperg,
    .hp-static-stage.daycycle .hp-paperg {
      filter:
        drop-shadow(0 0 1px var(--hp-day-cycle-outline-near))
        drop-shadow(0 0 5px var(--hp-day-cycle-outline-mid))
        drop-shadow(0 0 10px var(--hp-day-cycle-outline-far));
      transition: filter 1100ms cubic-bezier(.22, .61, .36, 1);
    }
    @media (prefers-reduced-motion: reduce) {
      .hp-day-cycle-bg,
      .hp-day-cycle-sun,
      .stage.daycycle .hp-paperg,
      .hp-static-stage.daycycle .hp-paperg {
        transition: none;
      }
    }
    .sunlayer {
      pointer-events: none;
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
    /* AUD-1552-02: post-veil grace — HA chrome landing after the cap moves
       the stage height smoothly; the viewport ResizeObserver refits the plan
       along the transition, so a late panel glides instead of jumping. */
    .stage.hpsettle {
      transition: height 0.25s ease;
    }
    @media (prefers-reduced-motion: reduce) {
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
    .projection-toggle {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      padding: var(--sp-3);
    }
    .header-action {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      padding: var(--sp-3);
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
      z-index: 12;
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
    /* Only the plan canvas owns the whole zoom wrapper. Context trays now live
       inside .stage as well, and may contain small SVG previews (furniture in
       particular); the old descendant-wide stage-SVG selector stretched every
       preview over the tray and stacked them into one blocking artefact. The
       vacuum trail/fit overlays have their own explicit geometry below. */
    .zoomwrap > svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .plan-svg { z-index: 1; }
    .iso-underlay-svg { z-index: 0; overflow: visible; }
    .iso-shadows-svg { z-index: 3; overflow: visible; }
    .iso-walls-svg {
      z-index: 4;
      overflow: visible;
    }
    .iso-underlay-svg,
    .iso-shadows-svg,
    .iso-walls-svg,
    .iso-underlay,
    .iso-shadows,
    .iso-walls,
    .iso-openings {
      pointer-events: none;
    }
    .iso-side-hi { stop-color: #b9bdbe; }
    .iso-side-lo { stop-color: #969c9f; }
    .iso-top-hi { stop-color: #fafaf7; }
    .iso-top-lo { stop-color: #e2e4e2; }
    .iso-wall-side {
      fill: url(#hp-iso-wall-side) #a8acae;
      stroke: #92989b;
      stroke-width: 0.7;
      vector-effect: non-scaling-stroke;
    }
    .iso-wall-top {
      fill: url(#hp-iso-wall-top) #f3f3f1;
      stroke: #d7d9d8;
      stroke-width: 0.8;
      vector-effect: non-scaling-stroke;
    }
    .iso-floor-side {
      fill: #858b8d;
      stroke: #71787b;
      stroke-width: 0.7;
      vector-effect: non-scaling-stroke;
    }
    .iso-opening-panel {
      fill: #d7d9d7;
      fill-opacity: 0.96;
      stroke: #7f878b;
      stroke-width: 0.9;
      vector-effect: non-scaling-stroke;
    }
    .iso-opening-panel.iso-window {
      fill: #dfeff4;
      fill-opacity: 0.72;
      stroke: #8aa7b1;
    }
    .iso-ambient-shadow {
      fill: rgba(15, 21, 25, 0.22);
      filter: url(#hp-iso-ambient-shadow);
    }
    .iso-contact-shadow {
      fill: none;
      stroke: rgba(22, 28, 31, 0.25);
      stroke-width: 3;
      filter: url(#hp-iso-contact-shadow);
      vector-effect: non-scaling-stroke;
    }
    .iso-leaf-shadow {
      fill: none;
      stroke: rgba(18, 23, 27, 0.24);
      stroke-width: 4;
      filter: url(#hp-iso-leaf-shadow);
      vector-effect: non-scaling-stroke;
    }
    @media (prefers-color-scheme: dark) {
      .iso-side-hi { stop-color: #4c555a; }
      .iso-side-lo { stop-color: #343c40; }
      .iso-top-hi { stop-color: #687176; }
      .iso-top-lo { stop-color: #50585d; }
      .iso-wall-side { stroke: #30373b; }
      .iso-wall-top { stroke: #7b858a; }
      .iso-floor-side { fill: #2d3438; stroke: #20272a; }
      .iso-opening-panel { fill: #626b70; stroke: #899399; }
      .iso-opening-panel.iso-window { fill: #75919b; stroke: #abc6ce; }
      .iso-ambient-shadow { fill: rgba(0, 0, 0, 0.34); }
      .iso-contact-shadow, .iso-leaf-shadow { stroke: rgba(0, 0, 0, 0.38); }
    }
    @media (forced-colors: active) {
      .iso-wall-side, .iso-wall-top, .iso-floor-side, .iso-opening-panel {
        fill: Canvas;
        stroke: CanvasText;
        forced-color-adjust: auto;
      }
      .iso-ambient-shadow, .iso-contact-shadow, .iso-leaf-shadow { display: none; }
    }
    @supports not (filter: blur(1px)) {
      .iso-ambient-shadow, .iso-contact-shadow, .iso-leaf-shadow { display: none; }
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
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
    }
    :host([data-pointer-hover]) .stage.mode-view .room.overlay:not(.styled):hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
    }
    :host([data-pointer-hover]) .stage.mode-view .room.yard:not(.styled):hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    .room.styled {
      stroke: var(--room-stroke, transparent);
      stroke-opacity: var(--room-stroke-op, 0);
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      fill: var(--room-fill, transparent);
      fill-opacity: var(--room-fill-op, 0);
    }
    .glow-base-layer,
    .glow-base-tunnels,
    .glow-pools-frame,
    .glow-pools,
    .glow-spot {
      pointer-events: none;
    }
    /* The parent isolates all source spots from the room data fill, Glow base,
       paper and backdrop. A spot is one circle clipped to the floor its lamp
       can see, so the whole spot screen-blends as a single primitive — there is
       no mask left to be dropped on a promoted layer. Per-stop alpha already
       contains the shared 0.7 ceiling; the spot opacity below only animates
       between 0 and 1 and is never another persistent alpha ceiling. */
    .glow-pools-frame,
    .glow-pools,
    .glow-spot {
      isolation: isolate;
    }
    .glow-pools.blend-screen .glow-spot {
      mix-blend-mode: screen;
    }
    .glow-spot {
      opacity: 1;
      transition: opacity 500ms ease;
    }
    .glow-spot.is-entering,
    .glow-spot.is-leaving {
      opacity: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .glow-spot {
        transition: none;
      }
    }
    /* The explicit late room-hover layer owns the wash and halo. Keeping CSS
       filters off room paths prevents Chromium from recompositing the sibling
       screen-blended Glow layer for one bright frame on every hover. */
    :host([data-pointer-hover]) .stage.mode-view .room.styled:hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    /* doors, windows & gates */
    .op-leaf {
      transition: transform 0.6s ease;
    }
    .op-arc {
      stroke-width: calc(1.5px * var(--hp-cell-visual-scale, 1));
      transition: stroke-dashoffset 0.6s ease;
    }
    /* hover affordance: a rounded outline hugging the wall strip + a grab cursor */
    .op-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: calc(1.5px * var(--hp-cell-visual-scale, 1));
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    :host([data-pointer-hover]) .stage.markup g.opening:hover .op-outline {
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
    .stage.markup .opening.orphan {
      pointer-events: auto;
      cursor: pointer;
      color: var(--error-color, #db4437);
    }
    .stage.markup .opening.orphan circle {
      fill: var(--hp-bg);
      stroke: currentColor;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
    }
    .stage.markup .opening.orphan text {
      fill: currentColor;
      font-weight: 800;
      font-size: calc(12px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
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
    .stage.mode-view .oplock {
      pointer-events: auto;
      cursor: pointer;
    }
    @media (prefers-reduced-motion: reduce) {
      .op-leaf, .op-arc { transition: none; }
    }
    .roomlabel {
      pointer-events: none; /* draggable only in plan mode (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: calc(var(--rl-icon-size, var(--icon-size, 2.5cqw)) * 0.5 * var(--rl-scale, 1) * var(--rl-font, 1) * var(--rl-space, 1));
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
    .zoomwrap.slide-left  { animation: hp-slide-left 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .zoomwrap.slide-right { animation: hp-slide-right 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    @media (prefers-reduced-motion: reduce) {
      .zoomwrap.slide-left,
      .zoomwrap.slide-right { animation: none; }
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
    :host([data-pointer-hover]) .rlgearbtn:hover { opacity: 1; filter: brightness(1.18); }
    .rlgearbtn ha-icon { --mdc-icon-size: calc(var(--gear-h) * 0.55); display: inline-flex; }
    .rlgear {
      --mdc-icon-size: 0.9em;
      display: inline-flex;
      margin-right: 0.2em;
      opacity: 0.6;
      cursor: pointer;
      pointer-events: auto;
    }
    :host([data-pointer-hover]) .rlgear:hover { opacity: 1; }
    .rlgo {
      --mdc-icon-size: 0.85em;
      display: inline-flex;
      opacity: 0.55;
    }
    .stage.mode-view .rlgo {
      pointer-events: auto;
      cursor: pointer;
    }
    :host([data-pointer-hover]) .stage.mode-view .rlgo:hover { opacity: 1; }
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
    :host([data-pointer-hover]) .stage.markup .roomlabel:hover .rlhandle { display: block; }
    .stage.markup .roomlabel { pointer-events: auto; }
    .roomlabel:active { cursor: grabbing; }
    .measurelayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .alignline {
      stroke: var(--hp-accent);
      stroke-width: calc(1.2px * var(--hp-cell-visual-scale, 1));
      stroke-dasharray:
        calc(4px * var(--hp-cell-visual-scale, 1))
        calc(4px * var(--hp-cell-visual-scale, 1));
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
    .measurelabel.opdimension {
      transform: translate(
        calc(-50% + var(--op-label-shift-x, 0px)),
        calc(-50% + var(--op-label-shift-y, -12px))
      );
      border: 1px solid var(--hp-open, #ff9800);
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
    .stage.mode-decor.dtool-image .decorlayer .dshape,
    .stage.mode-decor.dtool-backdrop .decorlayer .dshape { pointer-events: none; }
    /* the furniture tool is a stamp: the press must reach the stage even when
       it lands on a sofa that is already there (docs/FURNITURE.md §4) */
    .stage.mode-decor.dtool-furniture,
    .stage.mode-decor.dtool-image { cursor: copy; }
    .stage.mode-decor.dtool-select .decorlayer .dimage,
    .stage.mode-decor.dtool-erase .decorlayer .dimage,
    .stage.mode-decor.dtool-select .decorlayer .dimage-missing,
    .stage.mode-decor.dtool-erase .decorlayer .dimage-missing {
      pointer-events: bounding-box;
    }
    .decorlayer .dimage-missing rect {
      fill: rgba(127, 127, 127, 0.12);
      stroke: var(--hp-accent);
      stroke-dasharray: 8 5;
      vector-effect: non-scaling-stroke;
    }
    .decorlayer .dimage-missing path {
      fill: none;
      stroke: var(--hp-accent);
      vector-effect: non-scaling-stroke;
    }
    .decorlayer .decor-image-placement-preview { opacity: 0.65; }
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
      pointer-events: visiblePainted;
      pointer-events: bounding-box;
    }
    .stage.mode-decor.dtool-text .decorlayer .dshape.dtext {
      cursor: text;
    }
    /* Erasing a hairline must not require pixel-perfect aim. The duplicate
       geometry is invisible and exists only while Erase is active. A
       non-scaling stroke keeps the target comfortably wide at every zoom. */
    .decorlayer .derasehit {
      fill: none;
      stroke: transparent;
      stroke-width: 16px;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .stage.mode-decor.dtool-erase .decorlayer .derasehit {
      pointer-events: stroke;
    }
    /* A dashed line must remain selectable across its gaps. This proxy also
       makes the only entry to line-style properties — double click in Select —
       practical for hairlines at every zoom. */
    .decorlayer .dselecthit {
      fill: none;
      stroke: transparent;
      stroke-width: 16px;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .stage.mode-decor.dtool-select .decorlayer .dselecthit {
      pointer-events: stroke;
      cursor: move;
    }
    /* #383: furniture keeps a path-shaped target. Its per-object physical
       width is supplied by the renderer; no empty bounding-box area is hit. */
    .stage.mode-decor .decorlayer .dshape.dfurniturehit {
      fill: none;
      stroke: transparent;
      pointer-events: none;
    }
    .stage.mode-decor.dtool-select .decorlayer .dshape.dfurniturehit {
      pointer-events: stroke;
      cursor: move;
    }
    .decorlayer .dsel {
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .decorlayer .ddraft {
      stroke-dasharray:
        calc(6px * var(--hp-cell-visual-scale, 1))
        calc(5px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
    }
    .decorlayer .furniture-placement-preview {
      opacity: 0.55;
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
    :host([data-pointer-hover]) .bdframe .bdhandle:hover + .bdknob {
      fill: #fff;
      stroke: var(--hp-accent);
    }
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
    :host([data-pointer-hover]) .dtframe .dthandle:hover + .dtknob {
      fill: #fff;
      stroke: var(--hp-accent);
    }
    .dtframe .dt-nwse { cursor: nwse-resize; }
    .dtframe .dt-nesw { cursor: nesw-resize; }
    .dtframe .dtrot { cursor: grab; }
    .dtframe .dt-ew { cursor: ew-resize; }
    .dtframe .dt-ns { cursor: ns-resize; }
    .dtfurnitureframe .dtrot {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M18.4 7.2A8 8 0 1 0 20 12' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='m15.5 3.8 3.2 3.5-4.6.8' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, grab;
    }
    .dtfurnitureframe .dtrot:active { cursor: grabbing; }
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
    .stage.mode-decor .room { pointer-events: none; }
    /* Devices are landmarks in Background, never editing targets. The marker
       package deliberately re-enables pointer events on the core, its 44 px
       pseudo hit area and the visible capsule for View/Devices. A none on
       devlayer alone therefore does not make its HTML descendants inert.
       Scope the boundary to the whole subtree (including the pseudo element)
       so a Background tool receives the exact point below every visible part. */
    .stage.mode-decor .devlayer,
    .stage.mode-decor .devlayer *,
    .stage.mode-decor .dev::before {
      pointer-events: none;
    }
    /* Backdrop-editor de-emphasis is a shared mode-transition coordinate.
       It multiplies whole presentation groups and never changes Glow source
       alpha, additive blending, or the underlying resolved state. */
    .stage .room,
    .stage .devlayer,
    .stage .opening,
    .stage .room-outline,
    .stage .wallbodies,
    .stage .opening-tunnels,
    .stage .glow-base-layer,
    .stage .glow-pools-frame,
    .stage .zero-walls {
      opacity: var(--hp-mode-architecture-opacity, 1);
    }
    .opening-preview {
      opacity: 0.5;
      pointer-events: none;
    }
    .opening-preview[data-kind="passage"] {
      opacity: 1;
    }
    .passage-preview-cut {
      fill: var(--wall-fill, #ffffff);
      fill-opacity: 0.35;
      stroke: none;
      pointer-events: none;
    }
    .passage-preview-boundary {
      stroke: var(--hp-open, #ff9800);
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
    }
    .opening-preview .op-leaf,
    .opening-preview .op-arc {
      transition: none;
    }
    .opening-preview-dot {
      fill: var(--hp-open, #ff9800);
      pointer-events: none;
    }
    .opening-dimensions,
    .opening-dimension {
      pointer-events: none;
    }
    .opening-dimension-line,
    .opening-dimension-tick {
      fill: none;
      stroke: var(--hp-open, #ff9800);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .opening-dimension-tick {
      stroke-width: 2;
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
      stroke-width: calc(0.6px * var(--hp-cell-visual-scale, 1));
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
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .wallthick-hover.isopen {
      fill: var(--error-color, #f44336);
      stroke: var(--error-color, #f44336);
    }
    .zero-wall {
      stroke: var(--zero-wall-stroke, var(--hp-muted));
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-dasharray:
        calc(7px * var(--hp-cell-visual-scale, 1))
        calc(7px * var(--hp-cell-visual-scale, 1));
      stroke-linecap: butt;
      pointer-events: none;
      opacity: 0.9;
    }
    .zero-walls.solid .zero-wall {
      stroke-dasharray: none;
    }
    /* Rooms with zero/thick stretches: the polygon's own stroke is fully off.
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
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    /* Plan editor: trimmed outlines use the markup blue */
    .room-outline.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      stroke-opacity: 1;
    }
    /* The wash is rendered directly above the resolved room fill but below
       tunnels, Glow, sun and walls. Black at 22% reproduces the old
       brightness(.78) contract without filtering/promoting an SVG ancestor or
       changing the room's hue. The halo/outline are rendered again late, above
       the wall bodies. */
    .room-hover-fill {
      fill: #000;
      fill-opacity: 0.22;
      pointer-events: none;
    }
    .room-hover-halo {
      fill: none;
      stroke: var(--hp-accent);
      stroke-opacity: 0.28;
      stroke-width: calc(8px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .room-hover-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
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
    .room.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      fill: rgba(62, 166, 255, 0.06);
    }
    /* AFTER .outlined: same specificity — source order decides (gotcha x4) */
    .room.picked {
      stroke: #ffc14d;
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
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
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pathline {
      stroke: #ffc14d;
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .preview {
      stroke: #ffc14d;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
      stroke-dasharray:
        calc(6px * var(--hp-cell-visual-scale, 1))
        calc(5px * var(--hp-cell-visual-scale, 1));
      opacity: 0.7;
    }
    .active-axis {
      stroke: #ffc14d;
      stroke-width: 2;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .active-vertex {
      fill: #ffc14d;
      stroke: #171006;
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .wall-repair-preview {
      stroke: #d93025;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-dasharray: 5 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
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
      stroke-width: calc(0.5px * var(--hp-cell-visual-scale, 1));
      stroke-opacity: 0.7;
      pointer-events: none;
    }
    .drawwall-zero-preview {
      fill: none;
      stroke: var(--accent-color, #03a9f4);
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      stroke-linecap: butt;
      stroke-linejoin: round;
      opacity: 0.72;
      pointer-events: none;
    }
    .drawwall-zero-preview.dashed {
      stroke-dasharray:
        calc(7px * var(--hp-cell-visual-scale, 1))
        calc(7px * var(--hp-cell-visual-scale, 1));
    }
    .vertex {
      fill: #ffc14d;
      stroke: #4a2800;
      stroke-width: calc(1px * var(--hp-cell-visual-scale, 1));
    }
    .vertex.first {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .plan-snap-overlay,
    .plan-snap-overlay *,
    .hidden-wall-diagnostic,
    .hidden-wall-diagnostic * {
      pointer-events: none;
    }
    .plan-snap-line,
    .hidden-wall-line {
      fill: none;
      stroke: color-mix(in srgb, var(--hp-accent) 82%, white 18%);
      /* Explicit non-scaling-stroke in the SVG keeps this one screen pixel. */
      stroke-width: 1;
      stroke-linecap: round;
      opacity: 0.92;
    }
    .plan-snap-node,
    .hidden-wall-node {
      fill: var(--ha-card-background, var(--card-background-color, #fff));
      stroke: color-mix(in srgb, var(--hp-accent) 88%, #07131c 12%);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .plan-snap-node.active {
      fill: #ffc14d;
      stroke: #171006;
      stroke-width: 2;
    }
    .plan-snap-node.active.dynamic {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .plan-snap-node.conflict {
      fill: #fff;
      stroke: #d93025;
      stroke-width: 3;
    }
    @media (prefers-color-scheme: dark) {
      .plan-snap-line {
        stroke: color-mix(in srgb, var(--hp-accent) 72%, white 28%);
      }
      .hidden-wall-line {
        stroke: color-mix(in srgb, var(--hp-accent) 72%, white 28%);
      }
      .plan-snap-node,
      .hidden-wall-node {
        fill: #17242c;
        stroke: #9bdcf5;
      }
      .plan-snap-node.active {
        fill: #ffc14d;
        stroke: #fff4d6;
      }
      .plan-snap-node.active.dynamic {
        fill: #4bd28f;
        stroke: #eafff4;
      }
    }
    @media (forced-colors: active) {
      .plan-snap-line,
      .hidden-wall-line {
        stroke: CanvasText;
        opacity: 1;
        forced-color-adjust: auto;
      }
      .plan-snap-node,
      .hidden-wall-node {
        fill: Canvas;
        stroke: CanvasText;
        forced-color-adjust: auto;
      }
      .plan-snap-node.active,
      .plan-snap-node.active.dynamic {
        fill: Highlight;
        stroke: HighlightText;
        forced-color-adjust: auto;
      }
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
    @media (prefers-reduced-motion: reduce) {
      /* no fade at all: the rays are simply there or simply gone */
      .sunlayer, .sunlayer.out { animation: none; }
      .sunlayer.out { opacity: 0; }
    }
    .devlayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 6;
    }
    .stage.mode-devices .dev { cursor: grab; }
    .stage.mode-devices .dev:active { cursor: grabbing; }
    .physical-hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: none;
      cursor: grab;
    }
    .stage.tool-select .physical-hit { pointer-events: all; }
    .physical-hit:active { cursor: grabbing; }
    line.physical-hit { cursor: pointer; }
    .physical-hit.selected {
      fill: rgba(255, 193, 77, 0.24);
      stroke: transparent;
    }
    line.physical-hit.selected {
      stroke: transparent;
    }
    .physical-drag {
      fill: rgba(255, 193, 77, 0.38);
      stroke: #ffc14d;
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .physical-chrome { pointer-events: none; }
    .physical-chrome .frame,
    .physical-chrome .stem {
      fill: none;
      stroke: #ffc14d;
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }
    .physical-chrome .frame { fill: rgba(255, 193, 77, 0.22); }
    .physical-chrome polyline.frame { fill: none; }
    .physical-chrome .move-dot {
      fill: #ffc14d;
      stroke: #24262d;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .physical-chrome .rotate-handle {
      fill: #24262d;
      stroke: #ffc14d;
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
      pointer-events: all;
      cursor: crosshair;
    }
    .drawwall.invalid input { border-color: var(--error-color, #db4437); }
    .drawwall .rangehint { margin-inline-start: 4px; font-size: 0.78em; opacity: 0.72; }
    .drawwall.invalid .rangehint { color: var(--error-color, #db4437); opacity: 1; }
    .stage.markup.tool-partition,
    .stage.markup.tool-column { cursor: crosshair; }
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
    .rszhandle.disabled,
    .rszhandle.disabled:active {
      cursor: not-allowed;
    }
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
    :host([data-pointer-hover]) .rszhandle:hover + .rszicon .rszink { stroke-width: 3; }
    .rszicon.disabled { opacity: 0.38; }
    :host([data-pointer-hover]) .rszhandle.disabled:hover + .rszicon .rszink { stroke-width: 2; }
    .rszmeasurelayer,
    .rszmeasurelayer * { pointer-events: none; }
    .rszmeasurehalo,
    .rszmeasureink,
    .rszleader {
      fill: none;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .rszmeasurehalo {
      stroke: var(--hp-bg);
      stroke-width: 7px;
      opacity: 0.9;
    }
    .rszmeasureink {
      stroke: var(--hp-accent);
      stroke-width: 3px;
    }
    .rszleader {
      stroke: var(--hp-accent);
      stroke-width: 2px;
      opacity: 0.95;
    }
    /* the decor draft badge rides the MIDDLE of the shape, so it is centred
       horizontally and lifted clear of the line instead of trailing the
       cursor the way a wall badge does (owner 2026-08-04) */
    .measurelabel.dmeasure {
      transform: translate(-50%, -160%);
    }
    .measurelabel.rszarea {
      transform: translate(
        calc(-50% + var(--rsz-label-x, 0px)),
        calc(-50% + var(--rsz-label-y, 0px))
      );
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid var(--hp-accent);
    }
    /* width and depth of a piece of furniture while its corner is dragged —
       centred on the edge they measure (docs/FURNITURE.md §6) */
    .measurelabel.furnmeasure {
      transform: translate(-50%, -50%);
      border: 1px solid var(--hp-accent);
    }
    .alignmsg { margin: 0 0 8px; font-size: 13px; line-height: 1.45; }
`,o`
    /* Unified device activity: alarm, short event and continuous state all
       share this one renderer. No static rings are allowed. */
    .dev ha-icon {
      position: relative;
      z-index: 1;
    }
    .device-pulse {
      position: absolute;
      left: 50%;
      top: 50%;
      width: var(--dev-size);
      height: var(--dev-size);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    .device-pulse i {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--ripple-color, var(--hp-accent));
      opacity: 0;
    }
    /* A witnessed edge: exactly three waves over the 3.3 s runtime window. */
    .device-pulse.short i {
      animation: hp-pulse-short 1.1s cubic-bezier(.22,.61,.36,1) 1 forwards;
    }
    .device-pulse.short i:nth-child(2) { animation-delay: 1.1s; }
    .device-pulse.short i:nth-child(3) { animation-delay: 2.2s; }
    .device-pulse.short.gen2 i { animation-name: hp-pulse-short-b; }
    .device-pulse.continuous i:nth-child(n + 2),
    .device-pulse.alarm i:nth-child(n + 3) { display: none; }
    .device-pulse.continuous i:first-child {
      animation: hp-pulse-continuous 3.6s cubic-bezier(.45,.05,.55,.95) infinite;
    }
    .device-pulse.alarm i {
      border-width: 3px;
      border-color: #F0410C;
      animation: hp-pulse-alarm 2.4s cubic-bezier(.22,.61,.36,1) infinite;
    }
    .device-pulse.alarm i:nth-child(2) { animation-delay: 1.2s; }
    .activity-dot {
      position: absolute;
      right: 8%;
      bottom: 8%;
      width: 18%;
      height: 18%;
      min-width: 4px;
      min-height: 4px;
      border-radius: 50%;
      background: var(--ripple-color, var(--hp-accent));
      border: 1px solid color-mix(in srgb, var(--hp-bg) 82%, transparent);
      pointer-events: none;
      z-index: 3;
    }
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
    .dev.valonly {
      /* Saved coordinates remain the centre of a Text shell. The shell may
         expand, while the invisible anchor stays one core diameter wide. */
      width: var(--dev-size, var(--icon-size, 2.5cqw));
    }
    .dev.valonly .device-core {
      width: max-content;
      min-width: var(--dev-size, var(--icon-size, 2.5cqw));
      padding-inline: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.16);
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) / 2);
    }
    .dev .valtext {
      overflow: visible;
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * var(--value-font-scale, .45));
      font-weight: 600;
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .device-pulse { display: none; }
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
    .dev {
      position: absolute;
      /* The surface resolves compatibility icon_size units once. The shared
         face receives an effective base and only applies the per-device size. */
      --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1));
      /* 101.5/80 is the package shell/core ratio, including its stroke. */
      --device-shell-size: calc(var(--dev-size) * 1.26875);
      --device-shell-inset: calc(var(--dev-size) * 0.134375);
      --device-shell-stroke-ratio: 0.01875;
      --device-shell-border-width: max(1px, calc(var(--dev-size) * var(--device-shell-stroke-ratio)));
      --device-core-bg: var(--card-background-color, #fff);
      --device-core-fg: var(--primary-text-color, #252525);
      --device-core-bg: light-dark(#fff, #252525);
      --device-core-fg: light-dark(#252525, #fff);
      --device-face-bg: var(--device-core-bg);
      --device-face-fg: var(--device-core-fg);
      --device-shell-base-stroke: light-dark(#BCBCBC, rgb(37 37 37 / 75%));
      --device-shell-stroke: var(--device-shell-base-stroke);
      --device-shell-shadow:
        0 calc(var(--dev-size) * .025) calc(var(--dev-size) * .05) rgb(37 40 45 / 12%),
        0 calc(var(--dev-size) * .1) calc(var(--dev-size) * .175)
          calc(var(--dev-size) * -.025) rgb(37 40 45 / 18%);
      --device-core-inset-shadow: 0 0 0 0 transparent;
      --device-ring-color: transparent;
      --device-ring-width: 0px;
      /* The saved point is the exact centre of the icon core. */
      width: var(--dev-size);
      height: var(--dev-size);
      margin: calc(var(--dev-size) / -2) 0 0 calc(var(--dev-size) / -2);
      border: 0;
      background: transparent;
      display: block;
      color: var(--device-core-fg);
      cursor: pointer;
      pointer-events: auto;
      transition: opacity 0.2s;
      box-shadow: none;
      outline: none;
      z-index: 2;
    }
    .dev.theme-light {
      --device-core-bg: #fff;
      --device-core-fg: #000;
      --device-shell-base-stroke: #BCBCBC;
      --device-shell-stroke: var(--device-shell-base-stroke);
      --device-shell-shadow:
        0 calc(var(--dev-size) * .025) calc(var(--dev-size) * .05) rgb(37 40 45 / 12%),
        0 calc(var(--dev-size) * .1) calc(var(--dev-size) * .175)
          calc(var(--dev-size) * -.025) rgb(37 40 45 / 18%);
      --device-core-inset-shadow: 0 0 0 0 transparent;
    }
    .dev.theme-dark {
      --device-core-bg: #252525;
      --device-core-fg: #fff;
      --device-shell-base-stroke: rgb(37 37 37 / 75%);
      --device-shell-stroke: var(--device-shell-base-stroke);
      --device-shell-shadow:
        0 calc(var(--dev-size) * .025) calc(var(--dev-size) * .0375) rgb(37 40 45 / 12%),
        0 calc(var(--dev-size) * .1) calc(var(--dev-size) * .175)
          calc(var(--dev-size) * -.025) rgb(37 40 45 / 18%);
      --device-core-inset-shadow:
        inset 0 calc(var(--dev-size) * 0.0125) calc(var(--dev-size) * 0.0125) rgb(255 255 255 / 70%);
    }
    .dev::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: max(44px, var(--device-shell-size));
      height: max(44px, var(--device-shell-size));
      transform: translate(-50%, -50%);
      border-radius: 50%;
      pointer-events: auto;
      z-index: 3;
    }
    .device-shell {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: calc(var(--dev-size) * 0.1);
      padding: 0;
      min-width: var(--dev-size);
      min-height: var(--dev-size);
      border: 0;
      background: transparent;
      box-shadow: none;
      transition: opacity .2s;
      pointer-events: none;
    }
    .device-shell-frame {
      position: absolute;
      z-index: 0;
      box-sizing: border-box;
      inset: calc(var(--device-shell-inset) / -1);
      border: var(--device-shell-border-width) solid var(--device-shell-stroke);
      /* A saturating radius is resolved from the final border box. Using a
         second fractional length here lets border-box and radius quantise on
         different sides of a device pixel at some zoom/DPR combinations. */
      border-radius: 9999px;
      background: transparent;
      box-shadow: var(--device-shell-shadow);
      transition: border-color .15s, box-shadow .15s, opacity .2s;
      pointer-events: auto;
      /* Normative production fallback: never add a per-marker backdrop blur. */
      backdrop-filter: none;
    }
    .device-shell:not(.with-values) {
      left: 0;
      top: 0;
    }
    .device-shell:not(.with-values):not(.text-shell) .device-shell-frame {
      border-radius: 50%;
    }
    .device-shell.with-values.pos-right {
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }
    .device-shell.with-values.pos-left {
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      flex-direction: row-reverse;
    }
    .device-shell.with-values.pos-bottom {
      left: 50%;
      top: 0;
      transform: translateX(-50%);
      flex-direction: column;
    }
    .device-shell.with-values.pos-top {
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      flex-direction: column-reverse;
    }
    .device-core {
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      flex: 0 0 auto;
      width: var(--dev-size);
      height: var(--dev-size);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--device-face-bg);
      color: var(--device-face-fg);
      box-shadow:
        var(--device-core-inset-shadow),
        0 0 0 var(--device-ring-width) var(--device-ring-color);
      line-height: 0;
      transition: background .15s, color .15s, box-shadow .15s, opacity .2s;
      pointer-events: none;
    }
    .device-sections {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: calc(var(--dev-size) * .08);
      min-width: 0;
      pointer-events: none;
    }
    .device-shell.pos-top .device-sections,
    .device-shell.pos-bottom .device-sections {
      flex-direction: row;
    }
    .dev ha-icon {
      /* from --dev-size, NOT --icon-size: the per-device size multiplier must
         scale the GLYPH with its badge. Pinned to the base size, "make this
         icon bigger" grew an empty box around a default-size glyph (user
         report via the owner, 2026-07-29). */
      --mdc-icon-size: calc(var(--dev-size, var(--device-base-size, 2.25cqw)) * 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .dev.on {
      --device-face-bg: #F0A00C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0A00C;
    }
    .dev.theme-light.on { --device-face-fg: #fff; }
    .dev.theme-dark.on {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .0375;
    }
    .dev.open {
      --device-face-bg: var(--hp-open);
      --device-face-fg: light-dark(#fff, #252525);
    }
    .dev.theme-light.open { --device-face-fg: #fff; }
    .dev.theme-dark.open { --device-face-fg: #252525; }
    .dev.lock-locked {
      --device-face-bg: #66D17A;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #66D17A;
    }
    .dev.theme-light.lock-locked { --device-face-fg: #fff; }
    .dev.theme-dark.lock-locked {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .025;
    }
    .dev.lock-unlocked {
      --device-face-bg: #F0410C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0410C;
    }
    .dev.theme-light.lock-unlocked { --device-face-fg: #fff; }
    .dev.theme-dark.lock-unlocked {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .025;
    }
    /* Interaction wins ordinary state colours. Alarm keeps priority through
       the more-specific rule below. Unavailable has no visual hover. */
    :host([data-pointer-hover]) .dev:not(.unavail):hover {
      --device-face-bg: #0C82F0;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: var(--device-shell-base-stroke);
    }
    :host([data-pointer-hover]) .dev.theme-light:not(.unavail):hover { --device-face-fg: #fff; }
    :host([data-pointer-hover]) .dev.theme-dark:not(.unavail):hover { --device-face-fg: #252525; }
    :host([data-pointer-hover]) .dev:hover,
    .dev:focus-visible { z-index: 5; }
    .dev.unavail {
      opacity: 0.35;
      --device-face-bg: #B5BAC1;
      --device-shell-stroke: var(--device-shell-base-stroke);
    }
    .dev.virtual .device-shell-frame {
      border-style: dashed;
    }
    /* "hide from plan" flag, shown only in the device editor with the
       "show hidden devices" toggle on (docs/FILTERING.md). BLUE, so a hidden
       device cannot be mistaken for an unavailable one (translucent dark) —
       and no live-state paint at all: a ghost is configuration, not status
       (owner's request). */
    .dev.ghost {
      opacity: 0.6;
      color: var(--hp-accent);
    }
    .dev.ghost .device-shell-frame {
      border-style: dashed;
      border-color: var(--hp-accent);
      box-shadow: none;
    }
    .dev.ghost .device-core {
      background: rgba(62, 166, 255, 0.22); /* fallback for old WebViews */
      background: color-mix(in srgb, var(--hp-accent) 30%, var(--card-background-color, #1c2530));
      color: var(--hp-accent);
    }
    /* HA-disabled is not a user hide: neutral grey + a power-off badge keeps
       the two ghosts distinguishable without relying on colour alone. */
    .dev.ghost.ha-disabled {
      opacity: 0.62;
      color: var(--secondary-text-color, #9aa0aa);
    }
    .dev.ghost.ha-disabled .device-shell-frame {
      border-color: var(--secondary-text-color, #9aa0aa);
    }
    .dev.ghost.ha-disabled .device-core {
      background: rgba(120, 124, 134, 0.2);
      background: color-mix(in srgb, var(--secondary-text-color, #9aa0aa) 24%, var(--card-background-color, #1c2530));
      color: var(--secondary-text-color, #9aa0aa);
    }
    .dev .habadge {
      position: absolute;
      right: -18%;
      bottom: -18%;
      display: grid;
      place-items: center;
      width: 46%;
      height: 46%;
      min-width: 12px;
      min-height: 12px;
      border-radius: 50%;
      background: var(--card-background-color, #242832);
      border: 1px solid currentColor;
    }
    .dev .habadge ha-icon { width: 72%; height: 72%; }
    .dev.sel {
      --device-ring-color: #F0A00C;
      --device-ring-width: calc(var(--dev-size) * 0.0375);
    }
    .dev:focus-visible {
      --device-ring-color: #0C82F0;
      --device-ring-width: calc(var(--dev-size) * 0.0375);
    }
    .dev:not(.on):not(.open):not(.alarm):not(.lock-locked):not(.lock-unlocked):not(.unavail):focus-visible {
      --device-face-fg: #0C82F0;
    }
    /* Alert stays above focus, selection, hover and ordinary semantic paint. */
    .dev.alarm,
    :host([data-pointer-hover]) .dev.alarm:hover,
    .dev.alarm:focus-visible {
      --device-face-bg: #F0410C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0410C;
    }
    .dev.theme-light.alarm { --device-face-fg: #fff; }
    .dev.theme-dark.alarm {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .025;
    }
    .dev .value-badge {
      position: relative;
      z-index: 2;
      box-sizing: border-box;
      width: max-content;
      min-width: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * .7875);
      height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * .7875);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      background: var(--device-core-bg);
      border: 0;
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.39375);
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.14);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * var(--value-font-scale, .45));
      font-weight: 600;
      line-height: 1;
      color: var(--device-core-fg);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .value-badge.unavailable,
    .dev .value-badge.missing { opacity: 0.66; }
    .dev .lqi {
      position: absolute;
      top: calc(50% + var(--device-shell-size) / 2 + var(--dev-size) * .05);
      left: 50%;
      transform: translateX(-50%);
      margin-top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.05);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.38);
      font-weight: 600;
      line-height: 1;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .lqi.below-value-badge {
      margin-top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.8875);
    }
    .temprange {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      margin-left: auto;
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    /* live vacuum: a round puck, no badge plate, soft pulse (docs/VACUUM.md) */
    .vacpuck {
      position: absolute;
      /* the base badge, but round and 20% smaller — the owner's wording:
         «иконка похожа на иконку базы, только круглая и чуть меньше» */
      --puck-size: calc(var(--device-base-size, 2.25cqw) * 0.8);
      width: var(--puck-size);
      height: var(--puck-size);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      --vac-core-bg: light-dark(#fff, #252525);
      --vac-core-fg: light-dark(#252525, #fff);
      background: var(--vac-core-bg);
      border: 1px solid #BCBCBC;
      box-shadow:
        0 1px 2px rgb(37 40 45 / 12%),
        0 4px 8px -1.07px rgb(37 40 45 / 18%);
      color: var(--vac-core-fg);
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
    .vacpuck.theme-light { --vac-core-bg: #fff; --vac-core-fg: #252525; }
    .vacpuck.theme-dark { --vac-core-bg: #252525; --vac-core-fg: #fff; }
    .vacpuck.jump { transition: none; }
    .vacpuck.stale { opacity: 0.45; animation: none; }
    .vacpuck ha-icon {
      --mdc-icon-size: calc(var(--puck-size) * 0.68);
      color: var(--vac-core-fg);
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
    .vactrail polyline,
    .vactrail path {
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
    .devicepreview-empty {
      min-height: 82px;
      margin: 4px 0 14px;
      padding: var(--sp-4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-3);
      border: 1px dashed var(--hp-line);
      border-radius: var(--rad-m);
      color: var(--hp-muted);
      text-align: center;
    }
`,o`
    .hdr {
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
      background: var(--card-background-color, var(--hp-bg));
      border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
    }
    .tabs {
      display: flex;
      gap: var(--sp-2);
      background: rgba(127, 127, 127, 0.12);
      padding: var(--sp-2);
      border-radius: var(--rad-l);
      flex-wrap: wrap;
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
    :host([data-pointer-hover]) .tab:hover {
      color: var(--hp-txt);
    }
    .tab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
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
    .hdr.kioskhide { display: none; }
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
    /* issue #220: a tab can be dragged to a new position in the editors */
    .tab[data-reorderable] { cursor: grab; }
    .tab.dragging { cursor: grabbing; opacity: 0.55; }
    .tab.drop-before { box-shadow: inset 2px 0 0 0 var(--primary-color, #03a9f4); }
    .tab.drop-after { box-shadow: inset -2px 0 0 0 var(--primary-color, #03a9f4); }
    .modetab .closex {
      --mdc-icon-size: 13px;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      min-width: 24px;
      min-height: 24px;
      /* Keep the old 13 × 13 flex footprint (+2 px left margin) while the
         pointer target grows around it. Header width, height and wrapping do
         not move; only near-misses that used to hit the active tab reach X. */
      margin: -5.5px -5.5px -5.5px -3.5px;
      opacity: 0.75;
      cursor: pointer;
      border-radius: var(--rad-s);
    }
    :host([data-pointer-hover]) .modetab .closex:hover { opacity: 1; }
    .editbar .barclose {
      box-sizing: border-box;
      width: 40px;
      height: 40px;
      padding: 0;
      margin: 0;
      min-width: 40px;
      min-height: 40px;
      justify-content: center;
      gap: 0;
      line-height: 0;
    }
    .editbar .barclose ha-icon { flex: none; margin: 0; }
    .modetab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    @media (max-width: 720px) {
      .modetab .ml { display: none; }
    }
    .editbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: stretch;
      border-bottom: 1px solid var(--hp-line);
      font-size: var(--fs-m);
    }
    .editbar-tools {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: var(--sp-4) var(--sp-5);
      flex-wrap: wrap;
      min-width: 0;
      outline: none;
    }
    .editbar-end {
      display: flex;
      align-items: center;
      padding: var(--sp-4) var(--sp-5);
      border-inline-start: 1px solid var(--hp-line);
      background: var(--card-background-color, var(--hp-bg));
      position: relative;
      z-index: 2;
    }
    .tab .tabedit {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: var(--sp-3);
      opacity: 0.4;
    }
    :host([data-pointer-hover]) .tab:hover .tabedit {
      opacity: 0.9;
    }
    .tab.tabadd {
      padding: var(--sp-3) var(--sp-4);
    }
    .tab.tabadd ha-icon {
      --mdc-icon-size: 15px;
    }
    .rhint {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-bottom: var(--sp-3);
    }
    .togglehint {
      overflow-wrap: anywhere;
    }
    .togglehint > div + div {
      margin-top: var(--sp-1);
    }
    /* Keep the last editor bar mounted while the row collapses. This makes
       both entering and leaving an editor change the card geometry gradually;
       the header ResizeObserver keeps the stage fitted throughout. */
    .editorchrome {
      display: block;
      height: 0;
      opacity: 0;
      visibility: hidden;
      overflow: hidden;
    }
    .editorchrome:not(.open) {
      pointer-events: none;
    }
    .editorchrome.open {
      height: auto;
      opacity: 1;
      visibility: visible;
      overflow: visible;
    }
    .editorchrome.transitioning {
      overflow: hidden;
      will-change: height;
      pointer-events: none;
    }
    /* The toolbar is already visible while its height is interpolating. Its
       explicit navigation control must remain usable even though all editing
       tools stay frozen until the transition settles. */
    .editorchrome.transitioning .barclose {
      pointer-events: auto;
    }
    .editorchrome-inner {
      min-height: 0;
      transform-origin: top center;
    }
    .editorchrome.transitioning .editorchrome-inner {
      will-change: opacity;
    }
    @media (prefers-reduced-motion: reduce) {
      .modetab { transition: none; }
    }
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
    :host([data-pointer-hover]) .menu .it:hover {
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
      z-index: 60;
      max-width: 260px;
    }
    .tip .m {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      display: block;
    }
`,o`
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
    @media (max-width: 620px) {
      .head { gap: var(--sp-3); padding: var(--sp-4) 10px; }
      .head .count { display: none; }
      .head .title { font-size: var(--fs-m); }
    }
    .count {
      font-size: var(--fs-s);
      color: var(--hp-muted);
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
    :host([data-pointer-hover]) .btn:hover {
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
    .recoveryoverlay {
      position: absolute;
      inset: 0;
      /* Above the contextual editor tray (70): recovery is the one state in
         which every stage-editing surface must be inert. Dialogs live outside
         the stage and retain their own higher card-level stacking context. */
      z-index: 75;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-4);
      padding: var(--sp-6);
      box-sizing: border-box;
      /* The final solid layer guarantees an opaque recovery surface even when
         a custom HA theme exposes its card colour as rgba(). */
      background:
        linear-gradient(var(--ha-card-background, var(--card-background-color, #111)),
          var(--ha-card-background, var(--card-background-color, #111))),
        #111;
      color: var(--primary-text-color, #fff);
      text-align: center;
      pointer-events: auto;
      transition: opacity 0.15s ease;
    }
    .recoveryoverlay.phase-entering,
    .recoveryoverlay.phase-leaving {
      opacity: 0;
    }
    .recoveryoverlay.phase-fading-in,
    .recoveryoverlay.phase-opaque {
      opacity: 1;
    }
    .recoveryoverlay ha-icon {
      --mdc-icon-size: 44px;
      color: var(--hp-accent);
    }
    .editorloading {
      position: absolute;
      z-index: 74;
      left: 50%;
      top: 50%;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-5);
      border: 1px solid color-mix(in srgb, var(--hp-accent) 45%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb,
        var(--ha-card-background, var(--card-background-color, #111)) 92%, transparent);
      color: var(--primary-text-color);
      box-shadow: 0 6px 22px rgb(0 0 0 / 18%);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: editor-loading-in 0.15s ease both;
    }
    .editorloading ha-icon {
      --mdc-icon-size: 22px;
      color: var(--hp-accent);
      animation: editor-loading-spin 0.9s linear infinite;
    }
    @keyframes editor-loading-in {
      from { opacity: 0; transform: translate(-50%, calc(-50% + 4px)); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }
    @keyframes editor-loading-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .recoveryoverlay,
      .editorloading,
      .editorloading ha-icon {
        transition: none;
        animation: none;
      }
    }
    .oplock {
      --oplock-size: calc(var(--icon-size, 2.5cqw) * 0.62);
      --oplock-core-size: calc(var(--oplock-size) / 1.26875);
      --oplock-stroke-ratio: 0.01875;
      --oplock-stroke-width: max(1px, calc(var(--oplock-core-size) * var(--oplock-stroke-ratio)));
      --oplock-core-bg: light-dark(#fff, #252525);
      --oplock-core-fg: light-dark(#252525, #fff);
      --oplock-shell-stroke: light-dark(#BCBCBC, rgb(37 37 37 / 75%));
      --oplock-shell-shadow:
        0 calc(var(--oplock-core-size) * .025) calc(var(--oplock-core-size) * .05) rgb(37 40 45 / 12%),
        0 calc(var(--oplock-core-size) * .1) calc(var(--oplock-core-size) * .175)
          calc(var(--oplock-core-size) * -.025) rgb(37 40 45 / 18%);
      --oplock-core-shadow: 0 0 0 0 transparent;
      pointer-events: none; /* inert while editing; clickable in View (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      width: var(--oplock-size);
      height: var(--oplock-size);
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      z-index: 1;
    }
    .oplock.theme-light {
      --oplock-core-bg: #fff;
      --oplock-core-fg: #252525;
      --oplock-shell-stroke: #BCBCBC;
    }
    .oplock.theme-dark {
      --oplock-core-bg: #252525;
      --oplock-core-fg: #fff;
      --oplock-shell-stroke: rgb(37 37 37 / 75%);
      --oplock-core-shadow:
        inset 0 calc(var(--oplock-core-size) * .0125)
          calc(var(--oplock-core-size) * .0125) rgb(255 255 255 / 70%);
    }
    .oplock-shell {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border: var(--oplock-stroke-width) solid var(--oplock-shell-stroke);
      border-radius: 50%;
      background: transparent;
      box-shadow: var(--oplock-shell-shadow);
      display: grid;
      place-items: center;
      pointer-events: none;
      backdrop-filter: none;
    }
    .oplock-core {
      width: var(--oplock-core-size);
      height: var(--oplock-core-size);
      border-radius: 50%;
      background: var(--oplock-core-bg);
      color: var(--oplock-core-fg);
      box-shadow: var(--oplock-core-shadow);
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .oplock ha-icon {
      --mdc-icon-size: calc(var(--oplock-core-size) * 0.55);
      display: flex;
      line-height: 0;
    }
    .oplock.locked {
      --oplock-core-bg: #66D17A;
      --oplock-core-fg: light-dark(#fff, #252525);
      --oplock-shell-stroke: #66D17A;
    }
    .oplock.theme-light.locked { --oplock-core-fg: #fff; }
    .oplock.theme-dark.locked {
      --oplock-core-fg: #252525;
      --oplock-stroke-ratio: .025;
    }
    .oplock.unlocked {
      --oplock-core-bg: #F0410C;
      --oplock-core-fg: light-dark(#fff, #252525);
      --oplock-shell-stroke: #F0410C;
    }
    .oplock.theme-light.unlocked { --oplock-core-fg: #fff; }
    .oplock.theme-dark.unlocked {
      --oplock-core-fg: #252525;
      --oplock-stroke-ratio: .025;
    }
    .oplock.unknown { --oplock-core-fg: var(--hp-muted); }
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
    .bindharow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      flex-wrap: wrap;
    }
    .bindharow .entcheck { opacity: 0.9; }
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
    :host([data-pointer-hover]) .ctrlopt:hover {
      background: var(--secondary-background-color, rgba(128,128,128,0.15));
    }
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
    hp-dialog .dfill {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      cursor: pointer;
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
    .habindingbanner {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      margin-bottom: var(--sp-4);
      border: 1px solid var(--warning-color, #ff9800);
      border-radius: var(--rad-m);
      background: color-mix(in srgb, var(--warning-color, #ff9800) 12%, transparent);
      color: var(--primary-text-color, #f1f3f6);
    }
    .habindingbanner > span { flex: 1; min-width: 0; }
    .habindingbanner > ha-icon { color: var(--warning-color, #ff9800); flex: 0 0 auto; }
    .habindingbanner.limited {
      border-color: var(--secondary-text-color, #9aa0aa);
      background: color-mix(in srgb, var(--secondary-text-color, #9aa0aa) 10%, transparent);
    }
    .habindingbanner.limited > ha-icon { color: var(--secondary-text-color, #9aa0aa); }
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
    .gsrow > hp-color-opacity {
      min-width: min(100%, 210px);
      justify-content: space-between;
    }
    .ripple-colorrow > hp-color-opacity {
      width: 100%;
      justify-content: space-between;
    }
    .ripple-sizerow > .opl {
      min-width: 0;
    }
    .colorrow input[type='range'] { flex: 1; }
    .colorrow .tempin { width: 70px; flex: none; }
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
    .markerlightgroup {
      min-width: 0;
      margin: var(--sp-5) 0 0;
      padding: var(--sp-4);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
    }
    .markerlightgroup legend {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      padding: 0 var(--sp-2);
      color: var(--hp-txt);
      font-weight: 600;
    }
    .markerlightgroup legend > span { min-width: 0; overflow-wrap: anywhere; }
    .markerlightgroup[disabled] > :not(legend) { opacity: .62; }
    .markerhelpfield { margin-top: var(--sp-4); }
    .markerhelplabel {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      margin-bottom: var(--sp-1);
    }
    .markerhelplabel > label { min-width: 0; overflow-wrap: anywhere; }
    .helpfieldlabel {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
      min-width: 0;
      margin-top: var(--sp-3);
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .helpfieldlabel.compact { margin-top: 0; }
    hp-dialog .body .helpfieldlabel > label {
      min-width: 0;
      margin-top: 0;
      overflow-wrap: anywhere;
    }
    .help-inline-label {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-1);
    }
    hp-dialog .body .help-inline-label > label {
      min-width: 0;
      margin-top: 0;
      overflow-wrap: anywhere;
    }
    .markerradios { display: grid; gap: var(--sp-1); min-width: 0; }
    .markerlightgroup .srcrow > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .markerglowvalue { margin: var(--sp-3) 0; flex-wrap: wrap; }
    .markerglowvalue hp-color-opacity { flex: none; }
    .markerlightdisabled {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-top: var(--sp-2) !important;
    }
    .markerlightdisabled ha-icon { --mdc-icon-size: 18px; flex: none; }
    .markerbadgetechnical {
      min-width: 0;
      margin: var(--sp-1) 0 var(--sp-2) !important;
      overflow-wrap: anywhere;
    }
    .markerbadgetechnical code { white-space: normal; }
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
    .fileupload { display: inline-flex; min-width: 0; }
    .fileupload > input { display: none; }
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
    hp-confirm {
      display: contents;
    }
    hp-dialog .danger-confirm-body {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
    hp-dialog .danger-confirm-body p {
      margin: 0;
      line-height: 1.45;
    }
    hp-dialog .danger-confirm-object {
      overflow-wrap: anywhere;
      font-size: var(--fs-l);
      line-height: 1.3;
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
    .vacbox .vacbtns { display: flex; gap: var(--sp-4); margin: var(--sp-3) 0; flex-wrap: wrap; }
    .vacdiag { display: grid; gap: 4px; margin-bottom: var(--sp-3); }
    .vacdiag > div { display: flex; justify-content: space-between; gap: var(--sp-5); }
    .vacdiag > div > span { color: var(--secondary-text-color); }
    .vacdiag > div > b { text-align: right; overflow-wrap: anywhere; }
    .vacpicker { margin: var(--sp-3) 0; }
    .vacsource-warning { display: grid; gap: 8px; }
    .vacsource-warning .btn { justify-self: start; }
    .vacpicker > summary { display: inline-flex; width: auto; list-style: none; cursor: pointer; }
    .vacpicker > summary::-webkit-details-marker { display: none; }
    .vacsource-list { display: grid; gap: 6px; margin-top: 8px; }
    .vacsource-list details { padding: 6px 0 0; }
    .vacsource-list details > summary { cursor: pointer; font-weight: 600; }
    .vacsource { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      width: 100%; min-width: 0; padding: 9px 10px; border: 1px solid var(--divider-color);
      border-radius: 10px; color: var(--primary-text-color); background: var(--secondary-background-color);
      text-align: left; cursor: pointer; }
    .vacsource.on { border-color: var(--accent-color); box-shadow: inset 3px 0 var(--accent-color); }
    .vacsource > span:first-child { min-width: 0; display: grid; gap: 2px; }
    .vacsource small { color: var(--secondary-text-color); overflow-wrap: anywhere; }
    .vacsource-meta { color: var(--secondary-text-color); text-align: right; font-size: 0.82em; }
    .vacxcme pre { margin: 8px 0 0; white-space: pre-wrap; user-select: text; }
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
    .furnback {
      min-height: 34px;
      gap: 5px;
      margin: 2px 0 4px;
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
    :host([data-pointer-hover]) .furnitem:hover { background: rgba(127, 127, 127, 0.18); }
    .furnitem.on {
      border-color: var(--hp-accent);
      background: rgba(38, 166, 154, 0.18);
    }
    .furnprev {
      width: 40px;
      height: 40px;
      color: var(--primary-text-color, currentColor);
    }
    .furncategory { width: 92px; min-height: 76px; }
    .furncatprev { width: 48px; height: 48px; }
    .furnvariants .furnitem { min-height: 74px; }
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
    .imageupload {
      display: inline-flex;
      gap: 6px;
      margin: 4px 0 8px;
      cursor: pointer;
    }
    .imageupload.disabled { opacity: 0.55; pointer-events: none; }
    .imageupload input { display: none; }
    .imageassets { align-items: stretch; }
    .imageempty { padding: 12px 6px; }
    .imageasset { position: relative; }
    .imageasset .furnitem { width: 104px; min-height: 92px; }
    .imageasset img {
      width: 64px;
      height: 54px;
      object-fit: contain;
      border-radius: 4px;
      background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 12px 12px;
    }
    .imageasset .furnitem span {
      max-width: 96px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .imageasset .furnitem small { opacity: 0.65; font-size: 0.72em; }
    .imageassetdelete {
      position: absolute;
      top: 0;
      right: 0;
      min-width: 30px;
      width: 30px;
      min-height: 30px;
      padding: 3px;
    }
    .imagepropertypreview {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .imagepropertypreview img {
      width: 72px;
      height: 54px;
      object-fit: contain;
      border-radius: 4px;
      background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 12px 12px;
    }
    .imagepropertypreview span { overflow-wrap: anywhere; }
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
    :host([data-pointer-hover]) .cand:hover {
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
    .opening-entity-candidate {
      width: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
    }
    .opening-entity-candidate.sel {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .opening-entity-empty { cursor: default; }
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
    :host([data-pointer-hover]) .pdftag .x:hover {
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
    :host([data-pointer-hover]) .rrow .ract:hover { color: var(--hp-txt); }
    :host([data-pointer-hover]) .rrow .ract.del:hover { color: #ff7a5c; }
    .gsrow .gsl {
      min-width: 150px;
      font-size: var(--fs-m);
      color: var(--hp-muted);
    }
    .optimize-live {
      display: grid;
      justify-items: start;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
    }
    .optimize-live .alignmsg, .optimize-live .rhint { margin-bottom: 0; }
    .optimize-cleanup { min-height: 44px; }
    .optimize-selected { color: var(--hp-txt); }
    .optimize-details {
      margin-top: var(--sp-3);
      color: var(--hp-muted);
      font-size: var(--fs-s);
      overflow-wrap: anywhere;
    }
    .optimize-details > summary {
      width: fit-content;
      color: var(--hp-txt);
      cursor: pointer;
      font-weight: 600;
    }
    .optimize-details > summary:focus-visible {
      outline: 2px solid var(--hp-accent);
      outline-offset: 3px;
      border-radius: var(--rad-s);
    }
    .optimize-details ul { margin: var(--sp-3) 0; padding-inline-start: 22px; }
    .optimize-details li + li { margin-top: var(--sp-1); }
    .btn.alignall { width: 100%; justify-content: center; }
    .backupactions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }
    .backupactions .btn { justify-content: center; min-width: 0; }
    .backupupload { display: inline-flex; min-width: 0; }
    .backupupload > .btn { width: 100%; justify-content: center; }
    .backupupload input { display: none; }
    .backupbody { min-width: 0; }
    .backupplanonly { margin-inline-start: var(--sp-4) !important; align-items: flex-start !important; }
    .backupplanonly > span:first-of-type { display: grid; gap: 2px; white-space: normal; }
    .backupplanonly small { color: var(--secondary-text-color); line-height: 1.35; }
    .backupplanonlystatus { color: var(--hp-accent) !important; font-weight: 700; }
    .backupfile, .backupsummary, .backupcontent {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: var(--sp-1);
    }
    .backupfile b, .backupcontent span {
      overflow-wrap: anywhere;
    }
    .backupfile span, .backupsummary span, .backupcontent span {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .backupcounts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-2) var(--sp-4);
      font-size: var(--fs-s);
    }
    .backupwarn, .backuperror {
      border-radius: var(--rad-s);
      padding: var(--sp-3);
      font-size: var(--fs-s);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .backupwarn { background: color-mix(in srgb, var(--hp-accent) 12%, transparent); }
    .backuperror { background: rgba(179, 64, 42, .16); color: #ff7a5c; }
    .backupdetails {
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-2) var(--sp-3);
      font-size: var(--fs-s);
    }
    .backupdetails summary { cursor: pointer; font-weight: 700; }
    .backupdetails > div { display: grid; gap: var(--sp-1); padding-block-start: var(--sp-2); }
    .backupdetails code { overflow-wrap: anywhere; color: var(--hp-muted); }
    .backupchoices {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      min-width: 0;
    }
    .backupchoices label { margin: 0 !important; display: flex; gap: var(--sp-2); }
    .backupconfirm { align-items: flex-start !important; }
    .backupconfirm > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    @media (max-width: 520px) {
      .backupactions, .backupcounts { grid-template-columns: 1fr; }
    }
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
    :host([data-pointer-hover]) .aboutlink:hover { text-decoration: underline; }
    .aboutlink ha-icon { --mdc-icon-size: 18px; line-height: 1; }
    hp-dialog .supportbody {
      min-width: 0;
      overflow-x: hidden;
      gap: var(--sp-5);
    }
    .supportsection {
      display: grid;
      min-width: 0;
      gap: var(--sp-2);
    }
    .supportsection + .supportsection {
      padding-top: var(--sp-4);
      border-top: 1px solid var(--hp-line);
    }
    .supportsection h3 {
      margin: 0;
      color: var(--hp-txt);
      font-size: var(--fs-m);
    }
    .supportlinks, .supportactions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-2) var(--sp-4);
      min-width: 0;
    }
    .supportform > label:not(.srcrow) {
      margin-top: var(--sp-2);
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .supportmessage, .supportraw {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      resize: vertical;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-3);
      color: var(--hp-txt);
      background: color-mix(in srgb, var(--card-background-color, var(--hp-bg)) 92%, var(--hp-txt));
      font: inherit;
    }
    .supportmessage {
      min-height: 120px;
      background: var(--hp-bg);
    }
    .supportraw {
      min-height: 220px;
      margin-top: var(--sp-2);
      resize: none;
      white-space: pre;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
    }
    .supportattach {
      min-width: 0;
      align-items: flex-start;
      margin: var(--sp-2) 0 0 !important;
    }
    .supportattach > span:first-of-type {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .supportwarning, .supportstatus, .supportupdate {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-2);
      min-width: 0;
      margin: 0;
      padding: var(--sp-3);
      border-radius: var(--rad-s);
      background: color-mix(in srgb, var(--hp-accent) 14%, transparent);
      overflow-wrap: anywhere;
      font-size: var(--fs-s);
      line-height: 1.45;
    }
    .supportwarning ha-icon, .supportstatus ha-icon, .supportupdate ha-icon {
      flex: none;
      color: var(--hp-accent);
      --mdc-icon-size: 20px;
    }
    .supportpreview, .supportmanual, .supporterror, .supportsuccess {
      display: grid;
      min-width: 0;
      gap: var(--sp-2);
      padding: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
    }
    .supportsummary { font-weight: 600; overflow-wrap: anywhere; }
    .supporthash {
      display: grid;
      min-width: 0;
      gap: var(--sp-1);
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .supporthash code { overflow-wrap: anywhere; color: var(--hp-txt); }
    .supportpreview details { min-width: 0; }
    .supportpreview summary { cursor: pointer; color: var(--hp-accent); }
    .supportprivacy { margin: 0 !important; line-height: 1.45; }
    .supporterror {
      background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent);
      border-color: color-mix(in srgb, var(--error-color, #db4437) 45%, var(--hp-line));
    }
    .supportsuccess {
      background: color-mix(in srgb, var(--success-color, #43a047) 12%, transparent);
      border-color: color-mix(in srgb, var(--success-color, #43a047) 45%, var(--hp-line));
    }
    .supportfooter { flex-wrap: wrap; }
    @media (max-width: 520px) {
      hp-dialog .supportbody { padding-inline: var(--sp-4); }
      hp-dialog .supportfooter { padding-inline: var(--sp-4); }
      .supportactions .btn, .supportactions .aboutlink { max-width: 100%; }
    }
    hp-dialog .body {
      padding: var(--sp-5) var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    hp-dialog .tapconfirm-body {
      min-width: 0;
      overflow-x: hidden;
    }
    hp-dialog .tapconfirm-body p {
      max-width: 100%;
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    hp-dialog .tapconfirm-line {
      color: var(--hp-muted);
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
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: var(--sp-5) var(--sp-6);
      border-top: 1px solid var(--hp-line);
    }
    /* Stable destructive/commit footer contract.  A flex spacer cannot react
       when translated labels no longer fit: justify-content then overflows
       the destructive button through the left inset.  Two real groups wrap
       as units instead — destructive actions stay left, while Cancel/Save
       move together to a right-aligned second row when necessary. */
    hp-dialog .row.dialog-action-footer {
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      row-gap: var(--sp-4);
    }
    hp-dialog .dialog-action-group {
      display: flex;
      flex: 0 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-4);
      max-width: 100%;
      min-width: 0;
    }
    hp-dialog .dialog-action-group .btn {
      flex: 0 0 auto;
      min-height: 44px;
    }
    hp-dialog .dialog-action-danger {
      margin-right: auto;
    }
    hp-dialog .dialog-action-commit {
      margin-left: auto;
      justify-content: flex-end;
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
    /* Device info can have Edit + Open in HA + Close. It uses a wide dialog;
       wrapping remains as a phone fallback, but without a flex spacer (which
       used to strand Edit alone on the first line). */
    hp-dialog .row.infofooter {
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: var(--sp-3);
    }
    hp-dialog .row.infofooter .btn {
      flex-shrink: 0;
    }
    hp-dialog .row.infofooter .infofooter-close {
      margin-left: auto;
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
    .device-inbox {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      padding: var(--sp-5) var(--sp-6);
      min-width: 0;
    }
    .device-inbox-dialog { --hp-dialog-wide-width: 920px; }
    .device-inbox-head {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto;
      align-items: center;
      gap: var(--sp-4);
    }
    .device-inbox-search {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      padding: 11px 14px;
    }
    .device-inbox-tabs {
      display: flex;
      gap: var(--sp-2);
      overflow-x: auto;
      scrollbar-width: thin;
      padding-bottom: var(--sp-1);
    }
    .device-inbox-tabs button {
      flex: 0 0 auto;
      border: 1px solid var(--hp-line);
      border-radius: 999px;
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      padding: 8px 12px;
      cursor: pointer;
    }
    .device-inbox-tabs button.on {
      border-color: var(--hp-accent);
      background: color-mix(in srgb, var(--hp-accent) 18%, transparent);
    }
    .device-inbox-tabs button span { color: var(--hp-muted); margin-inline-start: 4px; }
    /* #44: discovery-filters section on the Available tab */
    .device-inbox-discovery {
      margin: 8px 0; padding: 8px 10px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
    }
    .device-inbox-discovery summary { cursor: pointer; font-weight: 600; }
    .device-inbox-discovery .srcrow { display: flex; gap: 6px; align-items: center; margin: 8px 0; }
    .device-inbox-excluded { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .device-inbox-excluded > span { font-weight: 500; }
    .device-inbox-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .device-inbox-chips .chip {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 1px 6px; border-radius: 10px;
      background: var(--secondary-background-color, #f0f0f0); font-size: 12px;
    }
    .device-inbox-chips .chip button {
      border: none; background: none; cursor: pointer; padding: 0 2px;
      color: var(--secondary-text-color, #666);
    }
    .device-inbox-excluded input[type="text"] {
      flex: 1 1 140px; min-width: 120px; padding: 4px 6px;
      border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .device-inbox-preview { margin: 8px 0 4px; font-size: 13px; opacity: 0.85; }
    .device-inbox-filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-4) var(--sp-6);
      color: var(--hp-muted);
    }
    .device-inbox-filters label {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      cursor: pointer;
    }
    .device-inbox-filter-help {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      min-width: 0;
    }
    .device-inbox-results { display: grid; gap: var(--sp-3); min-width: 0; }
    .device-inbox-row {
      display: grid;
      grid-template-columns: 42px minmax(180px, 1fr) minmax(180px, auto);
      align-items: center;
      gap: var(--sp-4);
      min-width: 0;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      padding: var(--sp-4);
      background: color-mix(in srgb, var(--hp-txt) 3%, transparent);
    }
    .device-inbox-icon { --mdc-icon-size: 28px; color: var(--hp-txt); justify-self: center; }
    .device-inbox-copy { min-width: 0; }
    .device-inbox-name { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2); }
    .device-inbox-new {
      border-radius: 999px;
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font-size: var(--fs-s);
      padding: 2px 7px;
    }
    .device-inbox-meta,
    .device-inbox-reason,
    .device-inbox-copy code {
      display: block;
      color: var(--hp-muted);
      font-size: var(--fs-s);
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .device-inbox-status { color: var(--error-color, #db4437); margin-inline-start: var(--sp-2); }
    .device-inbox-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-2);
    }
    .device-inbox-actions .btn { min-height: 36px; padding: 7px 10px; }
    .device-inbox-menu { position: relative; }
    .device-inbox-menu summary { list-style: none; cursor: pointer; }
    .device-inbox-menu summary::-webkit-details-marker { display: none; }
    .device-inbox-menu-items {
      position: absolute;
      z-index: 2;
      inset-inline-end: 0;
      top: calc(100% + var(--sp-1));
      display: grid;
      gap: var(--sp-1);
      min-width: 180px;
      padding: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: var(--hp-panel, var(--card-background-color, #fff));
      box-shadow: 0 8px 24px rgba(0, 0, 0, .22);
    }
    .device-inbox-menu-items .btn { justify-content: flex-start; width: 100%; }
    .device-inbox-empty { color: var(--hp-muted); text-align: center; padding: var(--sp-8); }
    .device-inbox-more { align-self: center; }
    @media (max-width: 680px) {
      .device-inbox { padding: var(--sp-4); }
      .device-inbox-head { grid-template-columns: minmax(0, 1fr); }
      .device-inbox-head .btn { justify-self: stretch; }
      .device-inbox-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow-x: visible;
      }
      .device-inbox-tabs button {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .device-inbox-row { grid-template-columns: 36px minmax(0, 1fr); }
      .device-inbox-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
`];var iu={"editor.context_actions":"Actions: {object}","editor.tool_options":"Tool options: {tool}","editor.palette":"Palette: {tool}","editor.open_group":"Tool group: {group}","editor.group_active":"{group} — active: {item}","editor.disabled_action":"{action} is unavailable: {reason}","editor.loading":"Loading editor…","editor.loading_aria":"The plan editor is loading","editor.load_failed":"Could not load the editor.","editor.refresh_advice":"Refresh the page and try again.","editor.retry_advice":"Check your connection and press again.","color_picker.title":"Color picker","color_picker.hue":"Hue","color_picker.saturation":"Saturation","color_picker.value":"Brightness","color_picker.hex":"Hex color","color_picker.invalid_hex":"Enter a 3- or 6-digit hex color","btn.properties":"Properties","btn.keep_as_walls":"Keep as walls","btn.delete_room_keep_walls":"Delete room, keep walls","btn.delete_room_with_walls":"Delete room and walls","title.markup_select":"Select and edit walls, columns and saved outlines","title.markup_column":"Column: click a grid point to place a square column","markup.partition":"Partition","markup.column":"Column","markup.hint_column":"click a grid point to place a square column","history.draft_segment":"Add room-draft segment","history.draft_merge":"Join unfinished room outlines","history.draft_segment_delete":"Remove room-draft segment","history.column_add":"Add column","history.physical_edit":"Change physical object","history.physical_delete":"Delete physical object","history.physical_move":"Move physical object","history.contour_to_partitions":"Convert contour to closed walls","history.wall_chain_finish":"Finish wall chain","history.wall_face_batch":"Create rooms from walls","toast.column_duplicate":"A column with the same centre and outer size already exists","confirm.delete_draft_title":"Delete unfinished contour?","confirm.delete_draft_body":"The entire unfinished room contour will be deleted. Cancelling makes no changes.","confirm.delete_draft_segment_title":"Delete contour segment?","confirm.delete_draft_segment_body":"This draft segment will be deleted. The remaining contour may split in two.","physical.partition_properties":"Partition properties","physical.column_properties":"Column properties","physical.draft_properties":"Draft segment properties","physical.shape":"Shape","physical.square":"Square","physical.circle":"Circle","physical.diameter":"Diameter","physical.side":"Side","physical.rotation":"Rotation angle","physical.length":"Length","physical.allowed_range":"Allowed: {min}–{max} {unit}","physical.delete_segment":"Delete segment","physical.delete_draft":"Delete entire outline","physical.column_size_title":"Outer side of the square column placed by the click (1–150 cm).","card.title":"House plan","count.devices":"{n} dev.","empty.no_spaces":"No spaces yet.","empty.add_first":"Add the first space and upload a floor plan.","empty.install":'Install the House Plan integration and add it in "Devices & services".',"btn.add_space":"Add space","btn.cancel":"Cancel","btn.save":"Save","btn.close":"Close","btn.delete":"Delete","btn.edit":"Edit","btn.open_in_ha":"Open in HA","btn.reset":"Reset","btn.attach":"Attach…","btn.upload":"Upload…","btn.replace":"Replace…","title.zoom_in":"Zoom in","title.zoom_out":"Zoom out","title.zoom_fit":"Fit all","title.configure_space":"Configure space","title.add_space":"Add space","title.markup_add":"Walls: draw a continuous chain; Shift locks to 45°. Changing tool or leaving the editor finishes it as independent walls","title.markup_merge":"Merge: click one room, then the neighbour it shares a wall with","title.markup_split":"Split a room: click the room, then two points on its walls","title.markup_delroom":"Delete room: click inside a room and confirm","title.need_plan":"Upload a floor-plan image","markup.add":"Walls","markup.merge":"Merge","markup.split":"Split","markup.resize":"Resize","title.markup_resize":"Resize rooms: drag an available horizontal or vertical wall handle","markup.hint_resize":"drag an available wall handle · the wall stops at the first unsafe position · Esc cancels · Ctrl+Z — undo","resize.disabled.diagonal":"This wall is angled; Resize supports only horizontal and vertical walls","resize.disabled.side-angle":"An adjoining wall is angled; Resize requires both adjoining walls to meet this wall at right angles","resize.disabled.duplicate-physical-wall":"A separate partition, unfinished outline, or column overlaps this wall; remove or move it before resizing","resize.disabled.partial-shared":"A neighbouring room uses only part of this wall, so it cannot be moved safely as one shared wall","resize.disabled.unequal-shared":"The neighbouring room uses different endpoints or wall length, so the walls cannot move together safely","resize.disabled.multiple-rooms":"Moving this wall would affect more than two rooms","resize.disabled.thickness-conflict":"The wall thickness cannot be preserved safely","resize.disabled.opening-conflict":"An opening on this wall cannot be moved safely","resize.disabled.invalid-geometry":"This wall cannot be resized without changing the plan structure","resize.limit_stopped":"Wall stopped: the next step would break a junction limit","resize.commit_failed":"Resize was cancelled because the final plan did not pass the geometry check","resize.preview_failed":"Resize stopped at the last safe position because the plan geometry could not be preserved","markup.opening":"Opening","markup.delete_room":"Delete room","history.undo":"Undo","history.redo":"Redo","history.undo_named":"Undo: {name} (Ctrl+Z)","history.redo_named":"Redo: {name} (Ctrl+Shift+Z / Ctrl+Y)","history.undo_empty":"Nothing to undo","history.redo_empty":"Nothing to redo","history.undone":"Undone: {name}","history.redone":"Redone: {name}","history.add_room":"Create room","history.split_room":"Split room","history.merge_rooms":"Merge rooms","history.resize_room":"Resize room","history.wall_thickness":"Change wall thickness","history.add_opening":"Add door or window opening","history.edit_opening":"Edit opening","history.move_opening":"Move opening","history.delete_opening":"Delete opening","history.delete_room_keep_walls":"Delete room, keep walls","history.delete_room_with_walls":"Delete room and walls","history.decor_add":"Add decor object","history.decor_edit":"Edit decor object","history.decor_move":"Move decor object","history.decor_transform":"Transform decor object","history.decor_delete":"Delete decor object","history.backdrop_transform":"Transform plan backdrop","history.device_move":"Move {name}","history.device_stale":"Device position history is no longer applicable and was cleared","opening.new":"New opening","opening.edit":"Opening","opening.door":"Door","opening.window":"Window","opening.gate":"Gate","opening.passage":"Open passage","opening.passage_binding_warning":"Saving will remove the open/close sensor and lock.","opening.invalid_passage_fields":"The open passage on plan “{room}” has unsupported settings: {fields}.","opening.type_label":"Type","opening.length_label":"Length, cm","opening.contact_label":"Open/close sensor","opening.lock_label":"Lock","opening.none":"— none —","opening.search_ph":"Search: name or entity id…","opening.invert":"Invert open/closed","opening.flip_h":"Hinge on the other jamb","opening.flip_v":"Opens to the other side","opening.open":"Open","opening.closed":"Closed","opening.locked":"Locked","opening.unlocked":"Unlocked","opening.state_unknown":"unavailable","opening.no_entities":"No sensors bound — a static symbol on the plan.","toast.opening_no_wall":"Click next to a room wall or independent wall","opening.host_partition":"Independent wall","opening.partition_orphan":"The independent wall for this opening no longer exists","opening.partition_jamb_margin":"Leave at least {distance} between the opening and the end of the wall","opening.rebind_partition":"Attach to another independent wall","confirm.delete_partition_openings_title":"Delete wall and openings?","confirm.delete_partition_openings_body":"This wall contains {count} opening(s). They will be deleted together.","confirm.delete_partition_openings_item":"• {type}, {length}","markup.hint_points":"points: {n} · Shift — 45° steps · Esc — finish chain · Ctrl+Z — undo a point · closing an area offers a room","markup.hint_start":"click a grid dot to start a wall chain","tip.lqi":"average zigbee signal:","tip.area":"area: {value}","info.device_header":"Device on the plan","info.model":"Model","info.state":"State","info.link":"Link","info.manuals":"Manuals","info.none":"No additional information","marker.new_device":"New device","marker.name_label":"Name (shown on the plan)","marker.name_ph":"Name","marker.binding_label":"Bind to an HA device","marker.binding_disabled":"disabled in Home Assistant","marker.virtual_option":"Virtual device (no binding)","marker.search_ph":"Search device / group…","marker.nothing_found":"nothing found","marker.room_label":"Room","marker.room_override":" (override placement)","marker.room_choose":"— select a room —","marker.room_auto":"— by device area (auto) —","marker.icon_label":"Icon","marker.icon_ph":"mdi:… (empty = auto)","marker.display_label":"Display","display.badge":"Icon + state","display.icon_ripple":"Icon + state and activity","display.static_icon":"Always static icon","marker.display_hint_badge":"The icon and dynamic plate show device state without the ordinary activity pulse. Red alarms remain visible.","marker.display_hint_icon_ripple":"The icon, dynamic plate and pulse show a short pulse for events and a continuous pulse for work, motion or presence. Red alarms have separate priority.","marker.display_hint_value":"A selected or automatically resolved Home Assistant value replaces the icon while the plate continues to show state. Red alarms remain visible.","marker.display_hint_static_icon":"The theme-aware shell and icon always stay the same. State, activity, unavailability and alarms do not change the face.","marker.static_alarm_warning":"This device can report alarms. Static display hides the marker's visual alarm indication.","marker.preview.title":"Display preview","marker.preview.actual":"Now","marker.preview.example":"Example","marker.preview.integration":"Provided by","marker.preview.source":"Display source","marker.preview.current_state":"Current state","marker.preview.result":"On the plan","marker.preview.details":"Source details","marker.preview.select_source":"Choose a Home Assistant device or entity to see its actual display.","marker.preview.unknown_provider":"Unknown integration","marker.preview.virtual_provider":"House Plan · virtual device","marker.preview.no_source":"No active source","marker.preview.no_state":"No current state","marker.preview.mixed_states":"Several different states","marker.preview.multiple_sources":"{n} sources","marker.preview.more_sources":"+{n} more","marker.preview.scaled":"The preview is scaled to {n}% to fit. The saved size is unchanged.","marker.preview.demo_short":"Show short activity","marker.preview.demo_continuous":"Show continuous activity","marker.preview.stop_continuous":"Stop continuous activity","marker.preview.demo_short_notice":"Short activity example; the actual device state is unchanged.","marker.preview.demo_continuous_notice":"Continuous activity example; the actual device state is unchanged.","marker.preview.demo_already_visible":"The current state already shows a real activity or alarm effect.","marker.preview.reduced_motion":"System reduced-motion is enabled, so ordinary activity is shown as a dot.","marker.preview.reason.neutral":"Neutral dark plate","marker.preview.reason.working":"Yellow plate: the device is working now","marker.preview.reason.working_activity":"Yellow plate and activity effect: the device is working now","marker.preview.reason.open":"Orange plate: physically open or unlocked","marker.preview.reason.cover_icon_state":"Neutral plate; the cover entity controls the displayed state and icon","marker.preview.reason.presence":"Activity effect while presence is detected","marker.preview.reason.event":"Short activity effect after a detected event","marker.preview.reason.transition":"Activity effect while the device is moving or changing state","marker.preview.reason.media_neutral":"Media devices stay on a neutral dark plate while available","marker.preview.reason.unavailable":"Subdued neutral plate: unavailable or off","marker.preview.reason.alarm":"Red alarm plate; alarm indication is always shown","marker.preview.reason.live_states_disabled":"Live-state styling is disabled for this card","marker.preview.reason.value_no_state":"No usable state value; the icon is shown instead","marker.preview.reason.value_ambiguous_sources":"Several possible value sources; the icon is shown instead","marker.preview.reason.value_non_scalar":"The source did not return a simple value; the icon is shown instead","marker.preview.reason.value_virtual":"A virtual device has no Home Assistant value; the icon is shown instead","marker.preview.reason.vacuum_live_plan_only":"Live vacuum position and trail are available only on the full plan","marker.preview.reason.hidden_design_preview":"The device is hidden on the plan; this design preview remains visible","marker.preview.reason.composite_power_source":"State comes from the device Power entity; auxiliary switches are ignored","marker.preview.reason.activity_display_disabled":"The selected display mode does not show ordinary activity effects","marker.preview.reason.ha_disabled":"The Home Assistant binding is disabled and will be hidden on the plan","marker.preview.reason.orphaned":"The saved Home Assistant binding can no longer be found","marker.preview.reason.static_icon":"Static mode: device state does not change the icon","marker.activity_color":"Activity pulse color","marker.ripple_size":"Activity pulse size","marker.activity_alarm_note":"Color and size affect ordinary activity only and do not change red alarms.","marker.pulse_a11y_alarm":"Alarm","marker.pulse_a11y_event":"Recent event","marker.pulse_a11y_presence":"Presence detected","marker.pulse_a11y_transition":"Changing state","marker.pulse_a11y_running":"Working","marker.state_a11y_neutral":"Default state","marker.state_a11y_working":"Working","marker.state_a11y_open":"Open","marker.state_a11y_locked":"Locked","marker.state_a11y_unlocked":"Unlocked","marker.state_a11y_alarm":"Alarm","marker.state_a11y_unavailable":"Unavailable","marker.lqi_a11y_low":"LQI {value}, low signal","marker.lqi_a11y_mid":"LQI {value}, medium signal","marker.lqi_a11y_high":"LQI {value}, high signal","marker.size_label":"Icon size / rotation","marker.angle_label":"Rotate","marker.model_label":"Model","marker.model_ph":"e.g. Aqara T&H","marker.link_label":"Link","marker.desc_label":"Description","marker.desc_ph":"Notes, specs…","marker.manuals_label":"Manuals (PDF etc.)","marker.sub_device":"device","marker.sub_z2m_group":" · Z2M group","marker.sub_group":"group","marker.sub_helper":"helper","space.new":"New space","space.header":"Space","space.title_label":"Title","space.title_ph":"e.g. Garage","space.plan_label":"Floor plan (background)","space.no_plan":"no plan image","space.plan_alt":"plan","room.new":"New room","room.name_label":"Display name","room.name_ph":"e.g. Terrace","room.area_label":"Home Assistant area (unassigned)","room.no_area_option":"— no area —","room.default_name":"Room","device.unnamed":"unnamed","device.light_group":"light group","device.fallback":"device","device.virtual":"virtual device","confirm.delete_room_title":'Delete room "{name}"?',"confirm.delete_room_body":"Choose whether the room's exclusive physical walls should remain. Walls shared with another room are always kept.","confirm.remove_marker_title":"Delete device from the plan?","confirm.remove_marker_body":"The device will disappear completely and stop contributing to plan data. You can add it again later.","confirm.erase_decor":"Erase the {kind} object? You can undo this action from the editor history.","confirm.delete_space_title":"Delete space?","confirm.delete_space_body":"The space, all its rooms and all its plan markup will be deleted.","space.delete_blocked":"This space is still used by {n} device(s). Move them to another space or delete them first.","toast.pos_save_failed":"Failed to save position: {err}","toast.no_entity":"The device has no suitable entity","toast.ha_disabled_action":"A Home Assistant object that is disabled cannot be used on the plan.","toast.ha_disabled_show_device":"A device disabled in Home Assistant cannot be shown on the plan. Enable it in Home Assistant first.","toast.ha_disabled_show_entity":"An entity disabled in Home Assistant cannot be shown on the plan. Enable it in Home Assistant first.","toast.ha_disabled_add":"A disabled Home Assistant object cannot be added to the plan. Enable it in Home Assistant first.","toast.ha_binding_unverified":"The object status could not be verified through the Home Assistant registry. Display and actions are temporarily unavailable.","toast.markup_needs_server":"Markup is available after the config is moved to the server","toast.space_order_changed":"Order changed. If any card pins its floor by number, check those panels.","toast.conflict":"Config was changed in another window — data refreshed, repeat your last action","toast.cfg_save_failed":"Failed to save config: {err}","toast.room_overlap":"The outline overlaps room “{name}” — rooms must not overlap","toast.contour_cannot_close":"The outline cannot close because it is degenerate or intersects itself","toast.merge_not_adjacent":"Only rooms that share a wall can be merged","toast.rooms_merged":"Rooms merged into “{name}”","toast.split_pick_wall":"Start the cut on the room’s wall","toast.split_bad_cut":"The cut must run wall to wall inside the room, without crossing walls or itself","merge.header":"Merge rooms","merge.hint":"The merged room keeps one name and one area. The other area is released — its devices leave the plan until another room claims it.","merge.keep":"Keep","merge.no_area":"no area","toast.room_saved":"Room saved ({n}). Devices added: {added}. Outline the next one or exit markup.","toast.room_saved_no_area":"Room saved ({n}, no area). Outline the next one or exit markup.","toast.marker_needs_server":"Device editing is available after the config is moved to the server","toast.virtual_name_required":"Enter a name for the virtual device","toast.marker_saved":"Device saved","toast.marker_removed":"Device deleted from the plan","toast.integration_missing":"The House Plan integration is not installed — management unavailable","toast.plan_formats":"Supported formats: SVG, PNG, JPG, WebP","toast.plan_required":"Upload a floor plan — it is required","toast.space_added_onboard":"Space added. Outline the rooms: click grid dots and close the contour.","toast.space_added":"Space added","toast.space_saved":"Space saved","toast.space_deleted":"Space deleted","toast.delete_failed":"Delete failed: {err}","toast.error":"Error: {err}","toast.toggle_target_unavailable":"Target “{name}” is unavailable — no action was performed","toast.toggle_targets_unavailable":"Targets are unavailable: {names}. No action was performed","toast.file_failed":'File "{name}" was not uploaded: {err}',"toast.files_attached":"Files attached: {n}","err.unknown":"unknown error","err.code":"code {code}","err.too_large":"file larger than {mb} MB","err.bad_ext":"unsupported type (PDF/image expected)","err.unauthorized":"administrator rights required","editor.title":"Title","editor.default_floor":"Initial space","editor.default_floor_missing":"Initial space “{id}” no longer exists. Choose another space.","editor.floor":"Fixed space","editor.floor_none":"— not fixed —","editor.floor_index":"YAML index {index} (preserved)","fixed_floor.loading":"Loading the fixed space…","fixed_floor.invalid_title":"The fixed space is unavailable","fixed_floor.invalid_body":"Check floor in the card configuration. The configured value is: {value}","editor.icon_size":"Icon size, % of plan width","editor.show_temperature":"Show temperature","editor.live_states":"Live states (on/off, open…)","editor.light_pools":"Light pools and wall shadows","editor.show_signal":"Show zigbee signal (LQI)","editor.language":"Interface language","editor.lang_auto":"Auto (HA profile)","title.icon_rules":"Icon rules: which MDI icon devices get by name","rules.title":"Icon rules","rules.hint":"Rules are checked top-down against “device name + model” (case-insensitive regex); the first match wins. When nothing matches, the entity device class decides, then the generic chip icon.","rules.pattern_ph":"regex, e.g. plug|socket","rules.icon_ph":"mdi:power-socket-de","rules.add":"Add rule","rules.reset":"Reset to defaults","rules.test_ph":"Try a device name…","rules.invalid":"invalid regex","rules.saved":"Icon rules saved","btn.up":"Up","btn.down":"Down","tap.info":"Device card","tap.more_info":"HA more-info dialog","tap.toggle":"Toggle state","marker.tap_label":"Tap action for this device","tap.toggle_note":"The resolved state is shown below. Secure devices are never toggled from the plan.","import.title":"Create spaces from HA floors","import.hint":"Your Home Assistant already knows these floors. Pick the ones to turn into plan spaces — you will upload a floor-plan image for each one next. Rooms are then outlined by hand on the plan.","import.start":"Create {n} space(s)","import.manual":"Start from scratch","import.progress":"Floor {i} of {n}","import.done":"Spaces created. Outline the rooms: click grid dots and close the contour.","btn.skip":"Skip","space.scale_label":"Scale (grid cell size)","space.cell_cm.help":"Links the grid to real dimensions: lengths, areas, wall thickness, opening sizes and glow radius depend on it. Changing it after drawing changes the calculated dimensions of the whole space without moving its points on the plan.","space.cell_cm.help.aria":"Help: space scale","space.scale_unit":"cm per cell","space.scale_unit_imperial":"in per cell","space.display_section":"Display","space.show_borders":"Always show room borders","space.zero_wall_style":"Zero-thickness walls","space.zero_wall_style.help":"Dashed zero-thickness walls pass Glow and sun rays, while solid ones block them as zero-area barriers. The choice affects every such wall in the space even when its line is hidden in View.","space.zero_wall_style.help.aria":"Help: zero-thickness wall style","space.zero_wall_dashed":"Dashed","space.zero_wall_solid":"Solid","space.show_names":"Show room names (drag to move)","space.room_color":"Border & name color","space.opacity":"Opacity","space.fill_label":"Room fill","space.fill_mode.help":"“Custom colour” is styling, while “Light”, “Temperature” and “LQI” use current Home Assistant data; Glow is enabled separately.","space.fill_mode.help.aria":"Help: room fill mode","fill.none":"None","fill.lqi":"Zigbee signal","fill.light":"Lights","fill.custom":"Custom color","space.custom_fill":"Fill color","space.source_file":"I have a floor-plan image","space.source_draw":"No image — I'll outline rooms by hand","fill.temp":"Temperature","tip.temp_avg":"average temperature:","tip.hum_avg":"average humidity:","space_card.button":"Open the space plan","space_card.not_found":"Space “{id}” not found","space_card.loading":"Loading…","continuity.restore_plan":"Restoring floor plan…","continuity.restore_connection":"Restoring device connection…","continuity.retry":"Try again","editor.space":"Space","editor.framing":"Framing","editor.fit_content":"All visible content","editor.fit_house":"Tight to house geometry","editor.show_button":"Show button","editor.button_label":"Button label","editor.button_target":"Target dashboard path","marker.sub_entity":"entity","title.general_settings":"General settings","gs.title":"General settings","gs.light_group":"Fill: lights","gs.light_on":"Lights on","gs.light_off":"All lights off","gs.temp_group":"Fill: temperature","gs.temp_cold":"Cold","gs.temp_ok":"Comfortable","gs.temp_hot":"Hot","gs.lqi_group":"Fill: zigbee signal","gs.lqi_low":"Weak signal","gs.lqi_high":"Strong signal","gs.reset":"Reset to defaults","gs.saved":"General settings saved","space.show_lqi":"Show zigbee signal (LQI) next to devices","space.hide_decor":"Hide the decorative layer","space.hide_decor_tip":"Lines, shapes, labels and furniture stay where they are — visible in the backdrop editor, not on the plan.","space.hide_openings":"Hide openings","space.hide_openings_tip":"Door, window and gate symbols are not drawn, but the openings keep working: light passes through, the sun comes in at a window, contact sensors still open them. The plan editor always shows them.","gs.light_none":"No light sources","mode.plan":"Plan editor","mode.devices":"Device editor","display.value":"Value + state","marker.subarea":"no area, manual","device.new":"New device — open its editor to dismiss","opening.unlock_action":"Unlock","opening.lock_action":"Lock","opening.lock_pending":"Working…","title.close_editor":"Close editor (back to view)","title.add_device":"Add a device to the plan","devbar.add":"Add","devbar.rules":"Icon rules","device_inbox.button":"Devices","device_inbox.title":"Devices on the plan","device_inbox.search":"Search devices, entities and integrations…","device_inbox.add_virtual":"Add virtual device","device_inbox.tab_on_plan":"On plan","device_inbox.tab_available":"Available","device_inbox.tab_hidden":"Hidden","device_inbox.tab_readd":"Available again","device_inbox.only_new":"New only","device_inbox.show_entities":"Show entities","device_inbox.show_hidden":"Show hidden on plan","device_inbox.show_hidden.help":"Temporarily shows hidden and disabled markers as editor-only ghosts on the plan. Saved device visibility does not change.","device_inbox.show_hidden.help.aria":"Help: show hidden devices on the plan","device_inbox.new":"New","device_inbox.find":"Find on plan","device_inbox.edit":"Edit","device_inbox.hide":"Hide","device_inbox.show":"Show","device_inbox.add":"Add","device_inbox.readd":"Add again","device_inbox.hide_available":"Hide from list","device_inbox.show_more":"Show more","device_inbox.more_actions":"More actions","device_inbox.find_hidden_hint":"Enable “Show hidden on plan” first","device_inbox.show_disabled":"Activate this binding in Home Assistant before showing it","device_inbox.empty_on_plan":"No matching devices are on the plan yet.","device_inbox.empty_available":"No devices are available to add.","device_inbox.empty_hidden":"There are no hidden devices.","device_inbox.empty_readd":"No removed devices are available to add again.","device_inbox.reason_visible_auto":"Discovered automatically","device_inbox.reason_visible_explicit":"Added explicitly","device_inbox.reason_manual_hidden":"Hidden by user","device_inbox.reason_automatic_hidden":"Hidden automatically","device_inbox.reason_service_entry":"Service-only registry entry","device_inbox.reason_excluded_integration":"Integration “{integration}” excluded by discovery filters","device_inbox.reason_excluded_domain":"Non-spatial entity type","device_inbox.reason_grouped_light":"Represented by a room light group","device_inbox.reason_represented_by_parent":"Represented by its parent device","device_inbox.reason_removed":"Previously removed from the plan","device_inbox.reason_available":"Available to add to the plan","device_inbox.reason_no_bound_room":"HA area is not linked to a plan room","device_inbox.status_ha_disabled":"Disabled in Home Assistant","device_inbox.status_orphaned":"Binding is no longer present in Home Assistant","device_inbox.status_unverified":"Home Assistant registry is temporarily unavailable","device_inbox.saved":"Device list updated","device_inbox.filters_excluded":"Excluded integrations","device_inbox.filters_group_lights":"Group room lights into one marker","device_inbox.filters_preview_appear":"will appear: {count}","device_inbox.filters_preview_hide":"will disappear: {count}","device_inbox.filters_preview_lights":"lights affected: {count}","device_inbox.filters_reset":"Restore recommended","device_inbox.filters_save":"Save filters","device_inbox.filters_search_ph":"Add an integration…","device_inbox.filters_title":"Discovery filters","space.roomcard_section":"Room card shows:","space.label_temp":"Temperature","space.label_hum":"Humidity","space.label_lqi":"Average Zigbee signal","space.label_light":"Lights on/off","roomcard.light_on":"On","roomcard.light_off":"Off","roomcard.light_partial":"{on} of {total}","toast.split_pick_inside":"Intermediate cut points must be inside the room","mode.decor":"Background editor","decor.select":"Select","decor.line":"Line","decor.rect":"Rectangle","decor.ellipse":"Oval","decor.text":"Text","decor.erase":"Erase","decor.erase_confirm_title":"Erase object?","decor.color":"Color","decor.width":"Line width","decor.line_style":"Line style","decor.line_style_solid":"Solid","decor.line_style_dashed":"Dashed","decor.fill":"Fill","decor.fill_color":"Fill color","decor.length":"Length","decor.size":"Size","decor.flip_h":"Flip horizontally","decor.flip_v":"Flip vertically","decor.angle":"Rotation angle, °","decor.text_size":"Text size","decor.backdrop_properties":"Plan backdrop properties","decor.text_title":"Text label","decor.object_title":"Edit {kind}","decor.text_label":"Text","decor.live_group":"Insert HA variable","decor.live_entity":"Entity","decor.live_entity_ph":"choose an entity","decor.live_attr":"Value","decor.live_attr_ph":"choose state or attribute","decor.live_state":"State","decor.backdrop":"Backdrop image","decor.backdrop_hint":"Drag to move; pull a corner to resize; use the top handle to rotate. Shift changes proportions or frees the angle.","decor.backdrop_reset":"Reset the picture","decor.backdrop_reset_done":"The picture is back at its original place and size","marker.icon_auto":"Auto: {icon} (by icon rules; pick one to override)","marker.icon_pin_auto":"Pin","mode.plan_tip":"Plan editor — the geometry of the home: draw and split/merge rooms, bind them to HA areas, place doors, windows and gates, move room cards, set the scale","mode.devices_tip":"Device editor — everything about icons: drag to position, click to edit binding/icon/display, add virtual devices, icon rules","mode.decor_tip":"Background editor — purely visual decor under the plan: lines, rectangles, ovals and text labels that never react to clicks","space.glow_enabled":"Light-source glow","gs.glow_group":"Light-source glow","gs.glow_base":"House darkness","gs.glow_light":"Default light color / intensity","gs.wall_group":"Walls","gs.wall_fill":"Wall fill","gs.glow_radius":"Glow radius","gs.glow_radius.help":"Sets the default glow radius in metres or feet; a device-specific radius overrides it.","gs.glow_radius.help.aria":"Help: default glow radius","gs.unit_m":"m","gs.unit_ft":"ft","marker.controls_label":"Controls other light sources","marker.controls.help":"With the “Toggle state” action, the listed sources toggle together with this marker. Their glow stays at their own markers, and the link alone does not turn the controlling marker into a light source.","marker.controls.help.aria":"Help: controlling other light sources","marker.controls_filter":"Search lights and switches…","info.controls":"Controls","marker.glow_radius_label":"Glow radius","marker.glow_radius.help":"Sets the glow radius in metres or feet; an empty value uses the radius from general settings.","marker.glow_radius.help.aria":"Help: glow radius","markup.wallthick":"Thickness","markup.select":"Select","title.markup_wallthick":"Thickness — click a wall to set its thickness from 0 to 100 cm.","markup.hint_wallthick":"click a wall · Esc closes without applying","wallthick.field":"Thickness","wallthick.unit_cm":"cm","wallthick.unit_in":"in","wallthick.apply_room":"Apply to all walls of this room","markup.draw_wall_title":"Thickness of each new wall segment (0–100 cm). Shared walls keep the existing value.","room.queue_progress":"Room {current} of {total}","toast.wall_rooms_saved":"Created rooms: {n}","toast.wall_chain_saved":"Wall chain saved","toast.wallthick_pick":"Click a wall","toast.wallthick_set":"Wall thickness set","toast.wallthick_cleared":"Wall thickness removed","toast.physical_range":"Enter a value from {min} to {max} {unit}","toast.zero_wall_opening_conflict":"Remove the opening on this wall segment first.","toast.zero_wall_ambiguous":"The wall segment is ambiguous. Simplify or adjust the junction.","toast.zero_wall_migration_blocked":"The space was not converted: {reason}. No data was changed.","toast.physical_angle":"Enter a rotation angle from 0° up to, but not including, 90°","toast.physical_limit":"The space has reached the limit for this type of geometry","toast.geometry_unsafe":"Change canceled: wall geometry could not be built safely.","junction.limit_angle":"The angle between walls is too sharp: {actual}°, minimum {limit}°.","junction.limit_valence":"Too many walls meet in one node: {actual}, maximum {limit}.","junction.limit_length":"The wall segment is too short: {actual} cm, minimum {limit} cm.","junction.limit_distance":"Walls and nodes are too close: {actual} cm, minimum {limit} cm.","junction.limit_clearance":"No room interior is left: {actual} cm², minimum {limit} cm².","junction.limit_check_failed":"The junction check could not run — the change was not saved","toast.wall_model_migration_blocked":"The wall model could not be updated: {reason}. The plan was not changed. Run “Optimize plans”; if the error repeats, fix the conflicting wall geometry.","toast.wall_model_client_outdated":"Update the card and reload the page before editing the plan.","wall_model.reason.invalid-room":"invalid room contour","wall_model.reason.zero-length":"zero-length wall segment","wall_model.reason.third-owner":"wall shared by more than two rooms","wall_model.reason.duplicate-id":"conflicting wall identifiers","wall_model.reason.thickness-conflict":"conflicting wall thickness values","wall_model.reason.opening-host":"opening cannot be assigned to one wall","toast.delete_room_pick":"Click inside the room you want to delete","toast.plan_snap_ambiguous":"Zoom in to choose the wall node","toast.wall_repair_ambiguous":"The room outline has more than one possible connection. Zoom in and connect it explicitly.","toast.wall_repair_too_large":"The gap is larger than 2 cm. Connect the walls before creating the room.","toast.wall_repair_changed":"The wall geometry changed. Try creating the room again.","toast.opening_on_zero_wall":"Openings cannot sit on a zero-thickness wall","marker.from_ha_option":"Pick from the HA list","marker.show_entities":"Show entities","marker.show_entities_tip":"Adds not only devices to the list, but all their entities too","marker.pick_ph":"Choose a device…","room.open_area":"Open the HA area","view.volumetric":"Volumetric view","view.flat":"Flat view","kiosk.title":"This screen's sizes","kiosk.hint":"Stored on this device only — every wall tablet or TV can have its own comfortable sizes.","kiosk.icon_scale":"Device icon size","kiosk.font_scale":"Room card text size","editor.kiosk":"Wall device (kiosk) mode","editor.cycle":"Auto-switch spaces every N seconds (kiosk, 0 = off)","room.settings_title":"Room settings","room.settings_section":"Room settings (override the space)","room.fill_label":"Fill in THIS room","fill.inherit":"As the space","room.custom_fill_space":"Space color","room.custom_fill_own":"Room color","room.temp_src_label":"Temperature source","room.hum_src_label":"Humidity source","room.src_average":"Average over the room's sensors (default)","room.src_pick":"A specific HA device or entity","room.src_ph":"Choose a source…","toast.room_updated":"Room updated","space.card_font":"Room-card font size (whole space)","room.sizes_section":"Font sizes","room.name_scale":"Room name size","room.label_scale":"Metrics size","preview.room_name":"Living room","toast.cfg_reload_failed":"Could not reload the plan from the server: {err}","toast.locale_load_failed":"Could not load the language pack. English is used until the page reloads.","room.settings_short":"Room settings","room.unnamed":"Unnamed room","marker.use_climate_temp":"Include the device temperature in the room","marker.use_climate_temp_tip":"Adds an air conditioner or thermostat current_temperature to the room average. Configure the external value badge separately below.","marker.value_badge_title":"Value badge","marker.value_badge.help":"Shows one selected value next to the icon. It does not affect room metrics, light, Glow or the tap action.","marker.value_badge.help.aria":"Help: device value badge","marker.value_badge_enabled":"Show a value badge","marker.value_badge_source":"Value","marker.value_badge_source.help":"Choose a specific state, supported attribute, or derived value of this device.","marker.value_badge_source.help.aria":"Help: value badge source","marker.value_badge_position":"Position","marker.value_badge_position.help":"The chosen side stays fixed and does not flip automatically at a plan edge.","marker.value_badge_position.help.aria":"Help: value badge position","marker.value_badge_right":"Right","marker.value_badge_bottom":"Below","marker.value_badge_left":"Left","marker.value_badge_top":"Above","marker.value_badge_empty":"This device has no available values","marker.value_badge_static":"A static icon does not show live values. The setting is preserved.","marker.value_badge_missing":"Source unavailable","marker.value_badge_missing_hint":"The saved source is currently unavailable. Keep it, disable the badge, or choose another value.","marker.value_badge_duplicate":"The same value is already shown inside the icon.","marker.value_badge_state":"State · {name}","marker.value_badge_marker_state":"Light-source state · {name}","marker.value_badge_lqi":"Average Zigbee signal quality","marker.value_badge_attr_current_temperature":"Current temperature · {name}","marker.value_badge_attr_temperature":"Target temperature · {name}","marker.value_badge_attr_current_humidity":"Current humidity · {name}","marker.value_badge_attr_humidity":"Humidity · {name}","marker.value_badge_attr_current_position":"Position · {name}","marker.value_badge_attr_percentage":"Speed · {name}","marker.value_badge_attr_brightness":"Brightness · {name}","marker.value_badge_attr_volume_level":"Volume · {name}","marker.value_badge_attr_battery_level":"Battery · {name}","marker.value_badge_attr_fan_speed":"Fan speed · {name}","marker.value_source":"Value source","marker.value_source.help":"Choose the value that replaces the icon. The tap action does not change.","marker.value_source.help.aria":"Help: value face source","marker.value_source_auto":"Automatic (as before)","marker.value_source_missing_hint":"The saved source is currently unavailable. The face shows — until it recovers or you choose another value.","marker.light_role_label":"Is this device a light source?","marker.light_role.help":"“Auto” uses the bound device's resolved role, “Always” forces its own source and “Never” excludes it; linked lights above remain independent.","marker.light_role.help.aria":"Help: whether this device is a light source","marker.light_role_auto_yes":"Auto (light source)","marker.light_role_auto_no":"Auto (not a light source)","marker.light_role_always":"Always a light source","marker.light_role_never":"Never a light source","marker.light_entity_label":"Leading light entity","marker.light_entity.help":"For a composite device, choose the entity whose state, colour and brightness represent this plan source. The automatic fallback remains compatible with older plans.","marker.light_entity.help.aria":"Help: leading light entity","marker.light_entity_auto":"Automatic ({entity})","marker.light_entity_none":"no controllable entity","marker.light_entity_missing":"The saved entity {entity} is unavailable. House Plan temporarily uses {fallback}; the saved choice will be restored if it returns.","marker.toggle_entity_label":"Entity to toggle","marker.toggle_entity.help":"For a composite device, choose the exact own light or switch operated by a tap. Automatic keeps the previous target rules and is independent from the leading light entity.","marker.toggle_entity.help.aria":"Help: entity to toggle","marker.toggle_entity_auto":"Automatic ({entity})","marker.toggle_entity_none":"no own controllable entity","marker.toggle_entity_missing":"The saved entity {entity} is no longer among this marker’s selectable channels. House Plan temporarily uses {fallback}; the saved choice will be restored if it returns.","marker.glow_color_label":"Glow colour and brightness","marker.glow_mode.help":"Use live source values, override only its colour, or fix both colour and brightness. The minimum is 1%; to disable the source, choose “Never”.","marker.glow_mode.help.aria":"Help: glow colour and brightness","marker.glow_mode_auto":"From source","marker.glow_mode_color":"Set colour","marker.glow_mode_fixed":"Set colour and brightness","marker.glow_color":"Glow colour","marker.glow_brightness":"Brightness","marker.glow_disabled_never":"Glow settings are unavailable because this marker is explicitly not a light source.","marker.glow_disabled_auto":"Auto mode found no spatial light source for this marker.","marker.glow_disabled_no_entity":"No active controllable Home Assistant entity is available for this spatial source.","marker.glow_passive_hint":"This source has no own Home Assistant data. Set its colour and brightness manually; its radius remains available.","marker.control_broken":"Saved source is missing or no longer marked as a light","marker.control_missing_label":"Missing plan light","marker.control_passive":"passive source","toast.marker_control_cycle":"This link would create a circular chain of light controls.","toast.marker_binding_required":"Choose a Home Assistant device before linking another light source.","confirm.unlock_title":"Unlock?","confirm.unlock_body":"House Plan will send an unlock command to this lock.","toast.files_migrate_failed":"Attachments could not be moved to the new binding, links keep pointing at the old files: {err}","space.pick_saved":"Already uploaded","space.pick_saved_hint":"Plans stored on the server, including ones you detached earlier","space.no_saved":"No plans stored on the server yet.","space.loading":"Loading…","space.used_by":"in use: {list}","space.in_use":"A space still uses this plan — detach it first","btn.use":"Use","confirm.delete_plan_title":"Delete plan file?","confirm.delete_plan_body":"The file will be deleted from the server. This action cannot be undone.","toast.plans_list_failed":"Could not list the stored plans: {err}","toast.plan_delete_failed":"Could not delete the plan: {err}","marker.hide":"Hide","marker.hide_tip":'The device will disappear from the plan after saving but will still count toward the room signal. Restore it through the "Devices" catalog in the device editor.',"marker.show":"Show","marker.show_tip":"The device will appear on the plan again after saving.","marker.hidden_ghost":"Device hidden by the user","marker.ha_disabled_device":"The device is disabled in Home Assistant and hidden from the plan.","marker.ha_disabled_entity":"The entity is disabled in Home Assistant and hidden from the plan.","marker.ha_disabled_all_entities":"The device has no active Home Assistant entities, so it is hidden from the plan.","marker.ha_registry_limited":"The full Home Assistant registry is unavailable to this user. The unverified object cannot be shown or used for now.","marker.delete_tip":"Completely delete the device from the plan and every aggregate. You can add it again later.","tap.run":"Run automation/script/scene","tap.none":"Do nothing","marker.run_target_label":"What to run","marker.run_search_ph":"Search: automation, script or scene…","marker.run_target_gone":"Target {id} not found — pick again","marker.tap_confirm":"Ask for confirmation","marker.tap_confirm_tip":"Show a confirmation dialog before acting — a guard against accidental taps.","marker.toggle_hint_single":"Target: {name} ({id}).","marker.virtual_light_target":"Virtual light: {name}.","marker.virtual_light_current":"Manual state: {state} → {effect}.","marker.virtual_light_state_on":"on","marker.virtual_light_state_off":"off","marker.toggle_hint_group":"Will toggle {count} source(s): {names}.","marker.toggle_hint_current":"Now: {state} → {effect}.","marker.toggle_hint_group_current":"Currently on: {on} of {count} → {effect}.","marker.toggle_hint_skipped":"Will be skipped ({count}): {targets}.","marker.toggle_effect_turn_on":"will turn on","marker.toggle_effect_turn_off":"will turn off","marker.toggle_effect_open":"will open","marker.toggle_effect_close":"will close","marker.toggle_effect_stop":"will stop","marker.toggle_effect_toggle":"state will toggle","marker.toggle_skip_missing":"not found","marker.toggle_skip_ha_disabled":"disabled in HA","marker.toggle_skip_unavailable":"unavailable","marker.toggle_skip_unsupported":"toggle is unsupported","marker.toggle_skip_secure":"blocked for security","marker.toggle_none_no_binding":"This device has no binding, so there is no state to toggle. Tapping will do nothing.","marker.toggle_none_no_actionable_entity":"This device has no state that can be toggled. Tapping will do nothing.","marker.toggle_none_configured_targets_missing":"The configured targets are unavailable. The device's own entity will not be substituted for them.","marker.toggle_none_ha_disabled":"The target is disabled in Home Assistant and cannot be used on the plan.","marker.toggle_none_unavailable":"The target is currently unavailable. Tapping will do nothing.","marker.toggle_none_unsupported":"Home Assistant exposes no safe toggle operation for this entity. Tapping will do nothing.","marker.toggle_none_secure":"Toggling locks, alarms and secure gates from the plan is blocked for security.","run.automation":"automation","run.script":"script","run.scene":"scene","confirm.tap_run":'Run "{name}"?',"confirm.tap_toggle":'Toggle "{name}"?',"confirm.current_state":"Current state: {state}","confirm.expected_state":"After switching: {state}","confirm.group_current":"on {on} of {total}","confirm.group_all_on":"all are on","confirm.group_all_off":"all are off","confirm.unavailable_targets":"Unavailable: {count}","confirm.expected_by_ha":"Home Assistant will determine the state","confirm.state_on":"On","confirm.state_off":"Off","confirm.state_open":"Open","confirm.state_closed":"Closed","confirm.state_opening":"Opening","confirm.state_closing":"Closing","confirm.state_stopped":"Stopped","confirm.state_unknown":"Unknown","toast.run_started":"Started: {name}","toast.run_target_missing":"Run target not found — check the device settings","toast.run_target_required":"Pick an automation, script or scene","toast.tap_target_changed":"The action target changed. Try again.","toast.virtual_light_toggle_failed":"Could not toggle the virtual light: {err}","toast.value_badge_source_required":"Choose a value for the badge","btn.run":"Run","vac.section":"Robot vacuum: live position","vac.autocal":"Set up automatically","vac.live":"Live position on the plan","vac.trail":"Show the robot's path","vac.cal_maps":"Calibrated maps: {maps}","vac.autocal_no_rooms":"The integration reports no room list — open “Fit manually”","vac.autocal_no_match":"Room names did not match (need ≥3 in common) — open “Fit manually”","vac.autocal_done":"Done: bound via {rooms} rooms. Start a cleanup and check","vac.cal_need_pos":"The robot is not reporting coordinates — start a cleanup and pause it","vac.cal_done":"Calibration saved. Start a cleanup and check","vac.cal_cancelled":"Calibration cancelled","vac.fit":"Fit manually","vac.fit_hint":"Drag the robot map into place, stretch by the corners","vac.fit_rotate":"Rotate 90°","vac.fit_mirror":"Mirror","vac.trail_never":"Never","vac.trail_cleaning":"While cleaning","vac.trail_always":"Always","gs.bg_group":"Stage background","gs.bg_color":"Background around the plan","gs.bg_default":"Theme default","gs.bg_theme":"theme default","gs.bg_mode":"Plan background","gs.bg_mode.help":"“Follows the Sun” uses sun.sun, falling back to the browser's local clock; Static always shows the selected colour.","gs.bg_mode.help.aria":"Help: general plan background","gs.bg_static":"Static color","gs.bg_daynight":"Follows the Sun","gs.sun_group":"Sun","gs.sun_missing":"The sun.sun entity was not found — the background follows your local clock; window rays are unavailable.","gs.north":"North on the plan","gs.north.help":"The angle is measured clockwise from the plan's upward vertical; north is required for window rays, not for the “Follows the Sun” background.","gs.north.help.aria":"Help: general north direction","gs.north_ph":"not set","gs.north_clear":"Clear","gs.north_letter":"N","gs.sun_rays":"Sunlight through windows","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · docs & issues","gs.about_telegram":"Telegram chat","support.title":"Help & feedback","space.bg_color":"Background around the plan","space.bg_inherit":"Inherit general","space.bg_inherited":"inherits general settings","space.bg_mode":"Plan background","space.bg_mode.help":"Inherit the general background or override this space with a static colour or “Follows the Sun”.","space.bg_mode.help.aria":"Help: space background","space.north":"North on the plan (override)","space.north.help":"Overrides general north for this space; the angle is measured clockwise from the plan's upward vertical and is used by window rays.","space.north.help.aria":"Help: north for this space","space.north_inherited":"inherited: {v}","space.sun_rays":"Sunlight through windows","space.sun_inherit":"Inherit general","space.sun_on":"On","space.sun_off":"Off","canvas.far_objects":"{n} object(s) far from the plan","canvas.show_far":"Show","canvas.home_tip":"The plan is over there — click to fit it","gs.grid_group":"Plan maintenance","gs.grid_hint":"Updates data models, aligns plan elements to the grid and merges redundant wall fragments. An exact report is shown before anything is stored.","gs.align_all":"Optimize plans","gs.align_title":"Optimize plans","gs.align_none":"All plans already use the current optimized data model.","gs.optimize_no_automatic_changes":"There are no automatic changes to apply. Review the items below.","gs.align_count":"{n} of {total} elements will move, by at most {cm} cm.","gs.align_where":"The largest shift is in “{s}”.","gs.align_turned":"Openings whose angle is corrected: {n}.","gs.align_removed_drafts":"Invalid outlines collapsed by the grid and removed: {n}.","gs.optimize_redundant_drafts":"Saved wall chains hidden by solid room walls and removed: {n}.","gs.align_preflight_failed":"Could not safely verify the geometry of the following spaces: {spaces}{more}.","gs.align_preflight_hint":"Plans were not changed. Copy the diagnostics with the button below and attach them to the bug report together with a space export.","gs.preflight_reason_prepare-exception":"Could not prepare the space geometry (exception while building the model)","gs.preflight_reason_wall-null":"The wall body did not build (the union came back empty)","gs.preflight_reason_wall-degraded-extra":"The wall body degraded with extra geometry","gs.preflight_reason_wall-failed-core":"The wall body core failed to assemble","gs.preflight_reason_wall-exception":"Wall construction threw an exception","gs.preflight_reason_floor-null":"The floor outline did not build","gs.preflight_reason_floor-exception":"Floor construction threw an exception","gs.preflight_copy":"Copy diagnostics","gs.preflight_copied":"Diagnostics copied","gs.preflight_update_hint":"The card and integration versions differ — update House Plan and retry.","gs.align_preflight_space":"Space {n}","gs.align_preflight_more":", and {n} more","gs.optimize_changes":"Model migrations: {m}; spaces updated: {c}; noisy coordinate values removed: {p}; merged real-wall fragments: {w}; merged zero-thickness wall fragments: {s}; independent walls: {i}.","gs.zero_walls_migrated":"Virtual wall spans converted: {n}.","gs.wall_segments_migrated":"Wall segments stabilised: {n}.","gs.optimize_lattice_summary":"Noisy coordinate values canonicalized: {n}; maximum movement: {cm} cm.","gs.optimize_lattice_space":"{space}: coordinate values canonicalized: {n}; off-grid values left unchanged: {far}.","gs.optimize_coincident_partitions":"Hidden independent wall sections absorbed into room walls: {n}.","gs.optimize_openings_rehosted":"Openings reattached to room walls: {n}.","gs.optimize_walls_straightened":"Walls straightened: {n}; maximum movement: {cm} cm.","gs.optimize_walls_straightened_where":"Largest wall correction: {s}.","gs.optimize_walls_straighten_skipped":"Near-axis walls left unchanged because they could not be repaired safely: {n}.","gs.optimize_glow_migration":"Legacy Glow: {spaces} spaces → no data fill + independent Glow; {rooms} rooms → inherited data fill + independent Glow.","gs.optimize_references":"References repaired: spaces — {spaces}; rooms — {rooms}; positions — {positions}; devices detached from missing spaces — {detached}.","gs.optimize_reference_more":", and {n} more","gs.optimize_orphans_removed":"Forgotten records removed: {total} — room labels: {rooms}; devices: {devices}; group markers: {groups}. They belonged to spaces deleted earlier.","gs.optimize_live_positions":"Old positions in deleted spaces belong to existing objects: {n}{names}. They will be kept.","gs.optimize_live_positions_remove":"Old positions in deleted spaces belong to existing objects: {n}{names}. They are selected for removal.","gs.optimize_live_names":": {names}{more}","gs.optimize_live_remove":"Remove old positions","gs.optimize_live_keep":"Keep old positions","gs.optimize_live_selected":"Old positions will be removed after Optimize is applied.","gs.optimize_unverified":"Could not safely verify positions: {n}. They were left unchanged.","gs.optimize_registry_limited":"Full administrator access to the Home Assistant registries is required for a safe check.","gs.optimize_vacuum_warning":"Vacuum room mappings that still need review: {n}.","gs.optimize_details":"Details","gs.optimize_details_more":"And {n} more records.","gs.optimize_detail_removed":"will be removed","gs.optimize_detail_live":"will be kept","gs.optimize_detail_unverified":"not verified","gs.optimize_detail_room_label":"room label","gs.optimize_detail_device":"device","gs.optimize_detail_group":"group marker","gs.optimize_detail_unknown":"unknown owner","gs.optimize_detail_item":"{status}: {kind} {id}; old space {space}","gs.align_warn":"Elements deliberately placed between grid nodes will move. One undo is available after the operation, only until the next plan edit.","gs.align_run":"Optimize","gs.align_done":"Plans optimized: {n} elements moved, {m} records maintained, {r} references repaired","gs.optimize_undo":"Undo last optimization","gs.optimize_undone":"The last optimization was undone","decor.furniture":"Furniture","decor.image":"Image","decor.image_title":"Custom images","decor.image_upload":"Upload image","decor.image_replace":"Replace image","decor.image_uploading":"Uploading…","decor.image_asset":"Image file","decor.image_pick_hint":"Upload an image or choose one already used in House Plan.","decor.image_place_hint":"Click on the plan to place the image.","decor.image_none":"No uploaded images yet.","decor.image_unavailable":"Image unavailable","decor.image_used":"Used in {n} objects","decor.image_upload_failed":"Could not upload the image: {err}","decor.image_error_capacity":"The custom image storage limit has been reached.","decor.image_in_use":"Remove every placed copy before deleting this image.","decor.image_delete_title":"Delete image file?","decor.image_delete_message":"Delete “{name}” from House Plan? This cannot be undone.","furn.title":"Furniture library","furn.symbol":"Symbol","furn.group_furniture":"Furniture","furn.group_appliance":"Appliances","furn.group_sanitary":"Plumbing","furn.group_other":"Other","furn.width":"Width","furn.depth":"Depth","furn.back_to_categories":"All categories","furn.pick_hint":"Choose a category, then a symbol.","furn.place_hint":"Click on the plan — the piece lands against the nearest wall. Shift places it free.","furn.cat_air_conditioner":"Air conditioners","furn.cat_armchair":"Armchairs","furn.cat_bathtub":"Bathtubs","furn.cat_bed":"Beds","furn.cat_bidet":"Bidets","furn.cat_boiler":"Water heaters","furn.cat_chair":"Chairs","furn.cat_coffee_table":"Coffee tables","furn.cat_cooktop":"Cooktops","furn.cat_dining_table":"Dining tables","furn.cat_dishwasher":"Dishwashers","furn.cat_dryer":"Dryers","furn.cat_fireplace":"Fireplaces","furn.cat_fridge":"Refrigerators","furn.cat_kitchen_cabinet":"Kitchen cabinets","furn.cat_kitchen_sink":"Kitchen sinks","furn.cat_nightstand":"Cabinets","furn.cat_plant":"Plants","furn.cat_rug":"Rugs","furn.cat_shelving":"Shelving","furn.cat_shower":"Showers","furn.cat_sink":"Sinks","furn.cat_sofa":"Sofas","furn.cat_stairs":"Stairs","furn.cat_toilet":"Toilets","furn.cat_tv":"Televisions","furn.cat_wardrobe":"Wardrobes","furn.cat_washer":"Washing machines","furn.cat_work_table":"Desks","furn.sym_sofa":"Two-seat sofa","furn.sym_sofa_three_seat":"Three-seat sofa","furn.sym_sofa_corner_right":"Right sectional sofa","furn.sym_armchair":"Soft armchair","furn.sym_armchair_office":"Office chair","furn.sym_coffee_table":"Rectangular coffee table","furn.sym_coffee_table_round":"Round coffee table","furn.sym_coffee_table_oval":"Oval coffee table","furn.sym_coffee_table_rounded":"Rounded coffee table","furn.sym_table_dining":"Rectangular dining table","furn.sym_table_round":"Round table","furn.sym_table_dining_oval":"Oval dining table","furn.sym_table_dining_rounded":"Rounded dining table","furn.sym_chair":"Chair","furn.sym_chair_bar":"Bar stool","furn.sym_desk":"Rectangular desk","furn.sym_desk_corner":"Corner desk","furn.sym_bed_double":"Double bed","furn.sym_bed_single":"Single bed","furn.sym_nightstand":"Bedside table","furn.sym_cabinet_tv":"TV cabinet","furn.sym_cabinet_shoe":"Shoe cabinet","furn.sym_cabinet_sink":"Sink cabinet","furn.sym_wardrobe":"Wardrobe","furn.sym_bookshelf":"Bookcase","furn.sym_wall_unit":"Wall unit","furn.sym_kitchen_floor":"Kitchen floor module","furn.sym_kitchen_floor_corner":"Kitchen floor corner module","furn.sym_kitchen_wall":"Kitchen wall module","furn.sym_kitchen_wall_corner":"Kitchen wall corner module","furn.sym_shelf_floor":"Floor shelving unit","furn.sym_shelf_wall":"Wall shelf","furn.sym_fridge":"Fridge","furn.sym_stove":"Four-burner cooktop","furn.sym_cooktop_two":"Two-burner cooktop","furn.sym_dishwasher":"Dishwasher","furn.sym_washer":"Washing machine","furn.sym_dryer":"Tumble dryer","furn.sym_tv":"TV on stand","furn.sym_tv_wall":"Wall-mounted TV","furn.sym_ac":"Air conditioner","furn.sym_water_heater":"Water heater","furn.sym_toilet":"Floor-standing toilet","furn.sym_toilet_built_in":"Built-in toilet","furn.sym_bathtub":"Rectangular bathtub","furn.sym_bathtub_corner":"Corner bathtub","furn.sym_shower":"Shower","furn.sym_sink":"Washbasin","furn.sym_kitchen_sink":"Single kitchen sink","furn.sym_kitchen_sink_double":"Double kitchen sink","furn.sym_bidet":"Floor-standing bidet","furn.sym_bidet_built_in":"Built-in bidet","furn.sym_stairs":"Stairs","furn.sym_fireplace":"Fireplace","furn.sym_plant":"Plant","furn.sym_rug":"Rug","common.yes":"Yes","common.no":"No","vac.diag_source":"Source","vac.diag_platform":"Integration","vac.diag_status":"Status","vac.diag_position":"Position","vac.diag_rooms":"Rooms","vac.diag_rooms_value":"{total} · {matched} names match · {readiness}","vac.autocal_ready":"auto-calibration available","vac.autocal_not_ready":"need 3 matching names","vac.diag_path":"Integration path","vac.diag_map":"Map ID","vac.source_none":"not selected","vac.source_status_ok":"Ready","vac.source_status_missing":"Missing","vac.source_status_disabled":"Disabled in Home Assistant","vac.source_status_unavailable":"Unavailable","vac.source_status_unverified":"Cannot verify with current permissions","vac.source_status_unsupported":"No position data","vac.source_status_none":"No source","vac.source_banner_missing":"The saved source no longer exists. It was not replaced automatically; choose another source or restore it in Home Assistant.","vac.source_banner_disabled":"The saved source is disabled in Home Assistant. Enable it there or choose another source.","vac.source_banner_unverified":"Current Home Assistant permissions cannot verify this saved source. It remains pinned and will not be replaced automatically.","vac.choose_source":"Choose source","vac.source_auto":"Automatic","vac.source_auto_hint":"Use a compatible entity from this device","vac.all_cameras":"All cameras","vac.all_cameras_warn":"A camera may not provide robot data. Choose one only if it is your vacuum map.","vac.all_cameras_empty":"No other camera entities found.","vac.platform_unknown":"unknown integration","vac.cap_position":"position","vac.cap_rooms_short":"rooms","vac.cap_path":"path","vac.cap_map":"map ID","vac.cap_none":"no robot data detected","vac.xcme_hint":"Enable these Xiaomi Cloud Map Extractor attributes:","vac.documentation":"Documentation","vac.residual_title":"Check automatic calibration","vac.residual_message":"The matched rooms disagree by up to {error}. Apply this approximate calibration, refine it manually, or cancel without changing the saved setup.","vac.apply_proposal":"Apply","gs.backup_group":"Backup and transfer","gs.backup_hint":"Download a portable JSON backup or preview and import a backup made by House Plan.","backup.export_open":"Export","backup.import_open":"Import","backup.export_title":"Export House Plan","backup.import_title":"Import House Plan","backup.export_hint":"Choose whether the backup should contain the whole House Plan configuration or only the current space.","backup.full":"Full backup","backup.current_space":"Current space","backup.current_space_title":"Current space: {title}","backup.no_current_space":"No current space","backup.plan_only":"Plan only","backup.plan_only_hint":"Keep rooms, walls, openings, decor and room-label positions without devices or Home Assistant bindings.","backup.plan_only_preview":"This file contains the plan only","backup.privacy_warning":"The archive keeps names, Home Assistant identifiers and exact coordinates. Internal plans and attachments are referenced, not embedded; runtime states and vacuum trails are not included.","backup.download":"Download JSON","backup.export_done":"Backup downloaded","backup.reading":"Checking the backup…","backup.revalidated":"The plan changed after this preview. The summary was refreshed; review it and confirm again.","backup.error.support_invalid_message":"Check the support message and try again.","backup.error.support_package_too_large":"The anonymized support package exceeds the 8 MiB limit.","backup.error.support_preview_expired":"The support attachment preview expired or is no longer available.","backup.error.support_rate_limited":"Too many support reports or previews were requested. Try again later.","backup.error.support_rejected":"The report did not pass support service validation.","backup.error.support_unavailable":"The private support service is temporarily unavailable.","backup.error.unauthorized":"You do not have permission to export or import this plan.","backup.error.not_ready":"House Plan is not ready yet. Try again in a moment.","backup.error.too_large":"The backup exceeds the 8 MiB limit.","backup.error.invalid_json":"The selected file is not valid JSON.","backup.error.invalid_format":"The selected file is not a House Plan backup.","backup.error.invalid_image":"The image is damaged or does not match its format.","backup.error.unsupported_export_version":"This backup format is not supported by the installed version.","backup.error.unsupported_image":"Use a supported PNG, JPEG, WebP or SVG image.","backup.error.future_model":"The backup was created by a newer House Plan data model.","backup.error.invalid_config":"The backup contains an invalid House Plan configuration.","backup.error.wall_model_migration_blocked":"The backup wall model could not be upgraded safely. Optimize the source plan first, then export it again.","backup.error.invalid_layout":"The backup contains invalid object positions.","backup.error.invalid_content":"The backup contains invalid or inconsistent content references.","backup.error.space_not_found":"The selected space no longer exists.","backup.error.capacity_exceeded":"Adding this backup would exceed the plan limits.","backup.error.preview_expired":"The preview expired. Select the backup file again.","backup.error.preview_owner_mismatch":"This preview belongs to another Home Assistant user.","backup.error.conflict":"The plan changed after the preview. Review the refreshed summary.","backup.error.content_confirmation_required":"Confirm that unavailable local content may be detached.","backup.error.commit_failed":"The backup could not be applied safely. The previous plan was restored or is pending recovery.","backup.error.missing_plan":"A referenced plan file disappeared after the preview. Review the backup again.","backup.error.missing_content":"A referenced local attachment disappeared after the preview. Review the backup again.","backup.error.marker_control_missing":"A linked plan light is missing from the backup.","backup.error.marker_control_not_light":"A linked plan target is no longer marked as a light source.","backup.error.marker_control_self":"A light source cannot control itself.","backup.error.marker_control_cycle":"The backup contains a circular chain of light controls.","backup.error.duplicate_marker_control":"The backup contains a duplicate plan-light link.","backup.error.no_backup":"There is no import or optimization snapshot to restore.","backup.error.in_use":"The item is still in use","backup.error.invalid_data":"The request carries invalid data","backup.error.invalid_light_entity":"The leading light must be a light.* or switch.* entity","backup.error.invalid_marker_control":"Invalid marker control reference","backup.error.invalid_name":"The name is invalid","backup.error.invalid_partition_opening_host":"The opening must keep its partition host","backup.error.invalid_partition_opening_jamb_margin":"The opening leaves no physical jamb at the wall end","backup.error.invalid_passage_fields":"An open passage cannot carry door-only settings","backup.error.invalid_space_id":"Unknown space","backup.error.invalid_toggle_entity":"The toggle entity must be light.* or switch.*","backup.error.invalid_value_badge":"Invalid value badge settings","backup.error.invalid_value_badge_attribute":"Invalid value badge attribute","backup.error.invalid_value_badge_position":"Invalid value badge position","backup.error.invalid_value_badge_source":"Invalid value badge source","backup.error.invalid_value_source":"Invalid value source","backup.error.invalid_value_source_attribute":"Invalid value source attribute","backup.error.io_error":"A file operation failed on the server","backup.error.not_toggleable":"This device cannot be toggled","backup.error.nothing_to_repair":"Nothing to repair","backup.error.space_in_use":"The space is still referenced","backup.error.value_badge_source_required":"The value badge needs a source","backup.error.wall_model_client_outdated":"The plan was updated elsewhere — reload the page","backup.same_source":"Created on this Home Assistant instance","backup.foreign_source":"Created on another Home Assistant instance","backup.created":"Created: {value}","backup.versions":"Card {card}; integration {integration}; data model {model}","backup.count_spaces":"Spaces: {n}","backup.count_rooms":"Rooms: {n}","backup.count_walls":"Walls: {n}","backup.count_openings":"Openings: {n}","backup.count_decor":"Decor objects: {n}","backup.count_markers":"Devices: {n}","backup.count_layout":"Positions: {n}","backup.bindings":"Bindings — devices: {device}, entities: {entity}, virtual: {virtual}; positions without a space: {legacy}","backup.binding_status":"Target status — active: {active}, disabled: {disabled}, missing: {missing}","backup.missing_areas":"Areas missing on the target: {areas}","backup.dropped_marker_links":"Plan-light links outside this transferred space were omitted: {n}.","backup.repaired_target_refs":"Existing references restored by this space import: {n}.","backup.preserved_unresolved_refs":"References that could not be restored unambiguously were preserved: {n}.","backup.preserved_unresolved_hint":"No data was guessed or deleted. After the import, run Optimize plans to inspect the remaining references.","backup.import_details":"Import reference details","backup.import_detail.incoming_remapped":"References updated inside the imported copy: {n}","backup.import_detail.target_repaired":"Existing references restored: {n}","backup.import_detail.preserved_unresolved":"Unresolved references preserved: {n}","backup.import_detail.collisions":"Destination conflicts preserved safely: {n}","backup.import_detail.dropped_links":"Incoming links omitted by transfer rules: {n}","backup.import_detail.bounded_lineages":"Overly nested identifiers left bounded: {n}","backup.replace_warning":"This replaces the current configuration and layout. Uploaded files are never deleted. One undo remains available until the next plan edit.","backup.foreign_bookkeeping":"Instance-specific known/new-device bookkeeping will not be imported.","backup.final_name":"New space name","backup.target_settings":"The target instance's global settings remain unchanged.","backup.duplicates":"Bindings already present: {n}","backup.skip":"Skip duplicate devices","backup.virtual_copy":"Add safe static virtual copies","backup.content":"Referenced content","backup.decor_images_summary":"Custom images: {objects} objects, {assets} files; missing files: {missing}.","backup.content_available":"available locally","backup.content_external":"external link","backup.content_detach_required":"will be detached","backup.confirm_detach":"I understand that unavailable internal plans and attachments will be detached from the imported configuration.","backup.confirm_missing_images":"I understand that missing custom images will remain as repair placeholders and other unavailable local files will be detached.","backup.replace":"Replace","backup.add":"Add space","backup.space_done":"Space imported: {rooms} rooms, {markers} devices, {refs} existing references restored","backup.full_done":"Backup restored: {spaces} spaces, {rooms} rooms, {markers} devices","backup.undo_import":"Undo last full import","backup.import_undone":"Full import undone","backdrop.large_title":"Large image","backdrop.large_body":"This image is {w}×{h} ({fileMb} MB file) and needs about {decodedMb} MB of memory to display. On tablets this can crash the page.","backdrop.unknown_body":"The image dimensions could not be read — the file may be damaged. Continuing may crash the page on tablets.","backdrop.reduced_dimensions":"Reduced copy: {w}×{h} px.","backdrop.use_downscaled":"Upload a reduced copy","backdrop.reducing":"Reducing…","backdrop.keep_original":"Keep the original","backdrop.too_large_title":"Image is too large","backdrop.too_large_body":"This image exceeds what browsers can display ({w}×{h}, limit {limit} px per side). Please reduce it in a desktop editor and upload again.","backdrop.downscale_failed":"Could not create the reduced copy. The original plan was not changed."};const nu=new WeakSet,ru=new WeakSet;function ou(e,t,i){const n=i?t.state(i):"ready";return i&&"pending"===n?(ru.has(e)||(e.inert=!0,e.setAttribute("aria-busy","true"),ru.add(e)),t.ensure(i).then(()=>{e.isConnected&&e.requestUpdate()}),nu.has(e)?"warm":"cold"):(ru.delete(e)&&(e.inert=!1,e.removeAttribute("aria-busy")),i&&(e.setAttribute("lang","fallback"===n?"en":i),nu.add(e)),"ready")}function su(){return W`<ha-circular-progress active role="status" aria-busy="true"></ha-circular-progress>`}const au=[{code:"en",nativeLabel:"English",dictionary:iu},{code:"ru",nativeLabel:"Русский",dictionary:{"editor.context_actions":"Действия: {object}","editor.tool_options":"Параметры инструмента: {tool}","editor.palette":"Палитра: {tool}","editor.open_group":"Группа инструментов: {group}","editor.group_active":"{group} — активно: {item}","editor.disabled_action":"{action} недоступно: {reason}","editor.loading":"Загружаем редактор…","editor.loading_aria":"Редактор плана загружается","editor.load_failed":"Не удалось загрузить редактор.","editor.refresh_advice":"Обновите страницу и повторите попытку.","editor.retry_advice":"Проверьте сеть и нажмите ещё раз.","color_picker.title":"Выбор цвета","color_picker.hue":"Оттенок","color_picker.saturation":"Насыщенность","color_picker.value":"Яркость","color_picker.hex":"Цвет HEX","color_picker.invalid_hex":"Введите цвет HEX из 3 или 6 цифр","btn.properties":"Свойства","btn.keep_as_walls":"Оставить стенами","btn.delete_room_keep_walls":"Удалить комнату, оставить стены","btn.delete_room_with_walls":"Удалить комнату и стены","title.markup_select":"Выбор и редактирование стен, колонн и сохранённых контуров","title.markup_column":"Колонна: кликните точку сетки для квадратной колонны","markup.partition":"Перегородка","markup.column":"Колонна","markup.hint_column":"кликните точку сетки, чтобы поставить квадратную колонну","history.draft_segment":"Добавление сегмента черновика комнаты","history.draft_merge":"Соединение незавершённых контуров комнаты","history.draft_segment_delete":"Удаление сегмента черновика комнаты","history.column_add":"Добавление колонны","history.physical_edit":"Изменение физического объекта","history.physical_delete":"Удаление физического объекта","history.physical_move":"Перемещение физического объекта","history.contour_to_partitions":"Преобразование контура в замкнутые стены","history.wall_chain_finish":"Завершение цепочки стен","history.wall_face_batch":"Создание комнат из стен","toast.column_duplicate":"Колонна с тем же центром и внешним размером уже существует","confirm.delete_draft_title":"Удалить незавершённый контур?","confirm.delete_draft_body":"Весь незавершённый контур комнаты будет удалён. При отмене ничего не изменится.","confirm.delete_draft_segment_title":"Удалить сегмент контура?","confirm.delete_draft_segment_body":"Этот сегмент черновика будет удалён. Оставшийся контур может разделиться на два.","physical.partition_properties":"Свойства перегородки","physical.column_properties":"Свойства колонны","physical.draft_properties":"Свойства сегмента черновика","physical.shape":"Форма","physical.square":"Квадрат","physical.circle":"Круг","physical.diameter":"Диаметр","physical.side":"Сторона","physical.rotation":"Угол поворота","physical.length":"Длина","physical.allowed_range":"Допустимо: {min}–{max} {unit}","physical.delete_segment":"Удалить сегмент","physical.delete_draft":"Удалить весь контур","physical.column_size_title":"Внешняя сторона квадратной колонны, создаваемой кликом (1–150 см).","card.title":"План дома","count.devices":"{n} устр.","empty.no_spaces":"Пространств пока нет.","empty.add_first":"Добавьте первое пространство и загрузите план этажа.","empty.install":"Установите интеграцию House Plan и добавьте запись в «Устройства и службы».","btn.add_space":"Добавить пространство","btn.cancel":"Отмена","btn.save":"Сохранить","btn.close":"Закрыть","btn.delete":"Удалить","btn.edit":"Редактировать","btn.open_in_ha":"Открыть в HA","btn.reset":"Сброс","btn.attach":"Прикрепить…","btn.upload":"Загрузить…","btn.replace":"Заменить…","title.zoom_in":"Приблизить","title.zoom_out":"Отдалить","title.zoom_fit":"Вписать всё","title.configure_space":"Настроить пространство","title.add_space":"Добавить пространство","title.markup_add":"Стены: рисуйте непрерывную цепочку; Shift фиксирует 45°. Смена инструмента или выход завершает её как независимые стены","title.markup_merge":"Объединить: клик по одной комнате, затем по соседней с общей стеной","title.markup_split":"Разделить комнату: клик по комнате, затем две точки на её стенах","title.markup_delroom":"Удалить комнату: кликните внутри комнаты и подтвердите удаление","title.need_plan":"Загрузите подложку (план этажа)","markup.add":"Стены","markup.merge":"Объединить","markup.split":"Разделить","markup.resize":"Размер","title.markup_resize":"Изменение размера комнат: тяните доступную ручку горизонтальной или вертикальной стены","markup.hint_resize":"тяните доступную ручку стены · стена упирается в первую небезопасную позицию · Esc — отмена · Ctrl+Z — отмена шага","resize.disabled.diagonal":"Стена расположена под углом: Resize поддерживает только горизонтальные и вертикальные стены","resize.disabled.side-angle":"Примыкающая стена расположена под углом: для Resize обе примыкающие стены должны образовывать прямой угол","resize.disabled.duplicate-physical-wall":"Стену перекрывает отдельная перегородка, незавершённый контур или колонна; удалите или переместите её перед изменением размера","resize.disabled.partial-shared":"Соседняя комната использует только часть этой стены, поэтому её нельзя безопасно двигать как одну общую стену","resize.disabled.unequal-shared":"У соседней комнаты другие конечные точки или длина стены, поэтому стены нельзя безопасно двигать вместе","resize.disabled.multiple-rooms":"Перемещение затронуло бы больше двух комнат","resize.disabled.thickness-conflict":"Толщину стены нельзя безопасно сохранить","resize.disabled.opening-conflict":"Проём на этой стене нельзя безопасно переместить","resize.disabled.invalid-geometry":"Эту стену нельзя переместить без изменения структуры плана","resize.limit_stopped":"Стена остановлена: дальше нарушается ограничение стыков","resize.commit_failed":"Изменение размера отменено: итоговый план не прошёл проверку геометрии","resize.preview_failed":"Стена остановлена в последней безопасной позиции: геометрию плана нельзя сохранить без потерь","markup.opening":"Проём","markup.delete_room":"Удалить комнату","history.undo":"Отменить","history.redo":"Повторить","history.undo_named":"Отменить: {name} (Ctrl+Z)","history.redo_named":"Повторить: {name} (Ctrl+Shift+Z / Ctrl+Y)","history.undo_empty":"Нет операций для отмены","history.redo_empty":"Нет операций для повтора","history.undone":"Отменено: {name}","history.redone":"Повторено: {name}","history.add_room":"Создание комнаты","history.split_room":"Разделение комнаты","history.merge_rooms":"Объединение комнат","history.resize_room":"Изменение размера комнаты","history.wall_thickness":"Изменение толщины стены","history.add_opening":"Добавление дверного или оконного проёма","history.edit_opening":"Изменение проёма","history.move_opening":"Перемещение проёма","history.delete_opening":"Удаление проёма","history.delete_room_keep_walls":"Удаление комнаты с сохранением стен","history.delete_room_with_walls":"Удаление комнаты и её стен","history.decor_add":"Добавление объекта декора","history.decor_edit":"Изменение объекта декора","history.decor_move":"Перемещение объекта декора","history.decor_transform":"Трансформация объекта декора","history.decor_delete":"Удаление объекта декора","history.backdrop_transform":"Трансформация подложки плана","history.device_move":"Перемещение: {name}","history.device_stale":"История позиций больше неприменима и была очищена","opening.new":"Новый проём","opening.edit":"Проём","opening.door":"Дверь","opening.window":"Окно","opening.gate":"Ворота","opening.passage":"Открытый проём","opening.passage_binding_warning":"При сохранении датчик открытия и замок будут удалены.","opening.invalid_passage_fields":"У открытого проёма на плане «{room}» есть недопустимые параметры: {fields}.","opening.type_label":"Тип","opening.length_label":"Длина, см","opening.contact_label":"Датчик открытия","opening.lock_label":"Замок","opening.none":"— нет —","opening.search_ph":"Поиск: имя или entity_id…","opening.invert":"Инвертировать открыто/закрыто","opening.flip_h":"Петли с другой стороны","opening.flip_v":"Открывается в другую сторону","opening.open":"Открыто","opening.closed":"Закрыто","opening.locked":"Заперто","opening.unlocked":"Не заперто","opening.state_unknown":"недоступно","opening.no_entities":"Датчики не привязаны — статичный символ на плане.","toast.opening_no_wall":"Кликните рядом со стеной комнаты или независимой стеной","opening.host_partition":"Независимая стена","opening.partition_orphan":"Независимая стена этого проёма больше не существует","opening.partition_jamb_margin":"Оставьте от края проёма до торца стены минимум {distance}","opening.rebind_partition":"Привязать к другой независимой стене","confirm.delete_partition_openings_title":"Удалить стену и проёмы?","confirm.delete_partition_openings_body":"В стене есть проёмы: {count}. Они будут удалены вместе со стеной.","confirm.delete_partition_openings_item":"• {type}, {length}","markup.hint_points":"точек: {n} · Shift — шаг 45° · Esc — завершить цепочку · Ctrl+Z — убрать точку · при замыкании будет предложена комната","markup.hint_start":"кликните точку сетки, чтобы начать цепочку стен","tip.lqi":"средний сигнал zigbee:","tip.area":"площадь: {value}","info.device_header":"Устройство на плане","info.model":"Модель","info.state":"Состояние","info.link":"Ссылка","info.manuals":"Инструкции","info.none":"Нет дополнительной информации","marker.new_device":"Новое устройство","marker.name_label":"Имя (отображается на плане)","marker.name_ph":"Название","marker.binding_label":"Привязка к устройству HA","marker.binding_disabled":"деактивировано в Home Assistant","marker.virtual_option":"Виртуальное устройство (без привязки)","marker.search_ph":"Поиск устройства / группы…","marker.nothing_found":"ничего не найдено","marker.room_label":"Комната","marker.room_override":" (переопределить размещение)","marker.room_choose":"— выберите комнату —","marker.room_auto":"— по зоне устройства (авто) —","marker.icon_label":"Иконка","marker.icon_ph":"mdi:… (пусто = авто)","marker.display_label":"Отображение","display.badge":"Значок + состояние","display.icon_ripple":"Значок + состояние и активность","display.static_icon":"Всегда статичный значок","marker.display_hint_badge":"Значок и динамическая подложка показывают состояние устройства без обычной пульсации активности. Красная тревога сохраняется.","marker.display_hint_icon_ripple":"Значок, динамическая подложка и пульсация: короткая — для событий, постоянная — для работы, движения или присутствия. Красная тревога имеет отдельный приоритет.","marker.display_hint_value":"Значок заменяется выбранным или автоматически найденным значением Home Assistant; подложка продолжает показывать состояние. Красная тревога сохраняется.","marker.display_hint_static_icon":"Подложка в цветах темы и значок всегда остаются одинаковыми. Состояния, активность, недоступность и тревоги не меняют отображение.","marker.static_alarm_warning":"Это устройство может сообщать о тревогах. Статичный режим скрывает визуальную тревогу маркера.","marker.preview.title":"Предпросмотр отображения","marker.preview.actual":"Сейчас","marker.preview.example":"Пример","marker.preview.integration":"Интеграция","marker.preview.source":"Источник отображения","marker.preview.current_state":"Текущее состояние","marker.preview.result":"На плане","marker.preview.details":"Подробнее об источниках","marker.preview.select_source":"Выберите устройство или сущность Home Assistant, чтобы увидеть фактическое отображение.","marker.preview.unknown_provider":"Интеграция неизвестна","marker.preview.virtual_provider":"House Plan · виртуальное устройство","marker.preview.no_source":"Нет активного источника","marker.preview.no_state":"Нет текущего состояния","marker.preview.mixed_states":"Несколько разных состояний","marker.preview.multiple_sources":"Источников: {n}","marker.preview.more_sources":"ещё {n}","marker.preview.scaled":"Предпросмотр уменьшен до {n}%, чтобы поместиться. Сохранённый размер не изменится.","marker.preview.demo_short":"Показать краткую активность","marker.preview.demo_continuous":"Показать постоянную активность","marker.preview.stop_continuous":"Остановить постоянную активность","marker.preview.demo_short_notice":"Пример краткой активности; фактическое состояние устройства не меняется.","marker.preview.demo_continuous_notice":"Пример постоянной активности; фактическое состояние устройства не меняется.","marker.preview.demo_already_visible":"Текущее состояние уже показывает реальную активность или тревогу.","marker.preview.reduced_motion":"В системе включено уменьшение движения, поэтому обычная активность показана точкой.","marker.preview.reason.neutral":"Нейтральная тёмная подложка","marker.preview.reason.working":"Жёлтая подложка: устройство сейчас работает","marker.preview.reason.working_activity":"Жёлтая подложка и эффект активности: устройство сейчас работает","marker.preview.reason.open":"Оранжевая подложка: физически открыто или разблокировано","marker.preview.reason.cover_icon_state":"Нейтральная подложка; состояние и значок определяет сущность шторы или заслонки","marker.preview.reason.presence":"Эффект активности, пока обнаружено присутствие","marker.preview.reason.event":"Короткий эффект активности после события","marker.preview.reason.transition":"Эффект активности во время движения или смены состояния","marker.preview.reason.media_neutral":"Медиаустройство остаётся на нейтральной тёмной подложке, пока доступно","marker.preview.reason.unavailable":"Приглушённая нейтральная подложка: отключено или недоступно","marker.preview.reason.alarm":"Красная тревожная подложка; тревога отображается всегда","marker.preview.reason.live_states_disabled":"Оформление по живым состояниям отключено в настройках карточки","marker.preview.reason.value_no_state":"Нет подходящего значения состояния — вместо него показан значок","marker.preview.reason.value_ambiguous_sources":"Подходит несколько источников значения — вместо него показан значок","marker.preview.reason.value_non_scalar":"Источник вернул не простое значение — вместо него показан значок","marker.preview.reason.value_virtual":"У виртуального устройства нет значения HA — вместо него показан значок","marker.preview.reason.vacuum_live_plan_only":"Живая позиция и след пылесоса доступны только на полном плане","marker.preview.reason.hidden_design_preview":"Устройство скрыто на плане, но его оформление видно в предпросмотре","marker.preview.reason.composite_power_source":"Состояние берётся из сущности питания устройства; вспомогательные переключатели не учитываются","marker.preview.reason.activity_display_disabled":"Выбранный режим отображения не показывает обычные эффекты активности","marker.preview.reason.ha_disabled":"Привязка отключена в Home Assistant, поэтому устройство будет скрыто на плане","marker.preview.reason.orphaned":"Сохранённая привязка Home Assistant больше не найдена","marker.preview.reason.static_icon":"Статичный режим: состояние устройства не меняет значок","marker.activity_color":"Цвет пульсации активности","marker.ripple_size":"Размер пульсации активности","marker.activity_alarm_note":"Цвет и размер относятся только к обычной активности и не влияют на красную тревогу.","marker.pulse_a11y_alarm":"Тревога","marker.pulse_a11y_event":"Недавнее событие","marker.pulse_a11y_presence":"Обнаружено присутствие","marker.pulse_a11y_transition":"Изменение состояния","marker.pulse_a11y_running":"Работает","marker.state_a11y_neutral":"Обычное состояние","marker.state_a11y_working":"Работает","marker.state_a11y_open":"Открыто","marker.state_a11y_locked":"Заблокировано","marker.state_a11y_unlocked":"Разблокировано","marker.state_a11y_alarm":"Тревога","marker.state_a11y_unavailable":"Недоступно","marker.lqi_a11y_low":"LQI {value}, слабый сигнал","marker.lqi_a11y_mid":"LQI {value}, средний сигнал","marker.lqi_a11y_high":"LQI {value}, сильный сигнал","marker.size_label":"Размер / поворот значка","marker.angle_label":"Поворот","marker.model_label":"Модель","marker.model_ph":"напр. Aqara T&H","marker.link_label":"Ссылка","marker.desc_label":"Описание","marker.desc_ph":"Заметки, характеристики…","marker.manuals_label":"Инструкции (PDF и т.п.)","marker.sub_device":"устройство","marker.sub_z2m_group":" · Z2M-группа","marker.sub_group":"группа","marker.sub_helper":"хелпер","space.new":"Новое пространство","space.header":"Пространство","space.title_label":"Название","space.title_ph":"Например: Гараж","space.plan_label":"Подложка (план)","space.no_plan":"нет подложки","space.plan_alt":"план","room.new":"Новая комната","room.name_label":"Отображаемое имя","room.name_ph":"Например: Терраса","room.area_label":"Зона Home Assistant (свободные)","room.no_area_option":"— без зоны —","room.default_name":"Комната","device.unnamed":"без имени","device.light_group":"группа света","device.fallback":"устройство","device.virtual":"виртуальное устройство","confirm.delete_room_title":"Удалить комнату «{name}»?","confirm.delete_room_body":"Выберите, нужно ли оставить физические стены, принадлежащие только этой комнате. Общие с другой комнатой стены сохраняются всегда.","confirm.remove_marker_title":"Удалить устройство с плана?","confirm.remove_marker_body":"Устройство исчезнет полностью и перестанет участвовать в данных плана. Позже его можно будет добавить заново.","confirm.erase_decor":"Стереть объект «{kind}»? Действие можно отменить из истории редактора.","confirm.delete_space_title":"Удалить пространство?","confirm.delete_space_body":"Пространство, все его комнаты и вся разметка плана будут удалены.","space.delete_blocked":"Это пространство всё ещё используется устройствами: {n}. Сначала перенесите их в другое пространство или удалите.","toast.pos_save_failed":"Не удалось сохранить позицию: {err}","toast.no_entity":"У устройства нет подходящей сущности","toast.ha_disabled_action":"Деактивированный объект Home Assistant нельзя использовать на плане.","toast.ha_disabled_show_device":"Деактивированное в Home Assistant устройство нельзя показать на плане. Сначала активируйте его в Home Assistant.","toast.ha_disabled_show_entity":"Деактивированную в Home Assistant сущность нельзя показать на плане. Сначала активируйте её в Home Assistant.","toast.ha_disabled_add":"Деактивированный объект Home Assistant нельзя добавить на план. Сначала активируйте его в Home Assistant.","toast.ha_binding_unverified":"Статус объекта не удалось подтвердить по реестру Home Assistant. Отображение и действия временно недоступны.","toast.markup_needs_server":"Разметка доступна после переноса конфига на сервер","toast.space_order_changed":"Порядок изменён. Если где-то этаж карточки задан номером, проверьте такие панели.","toast.conflict":"Конфиг изменён в другом окне — данные обновлены, повторите последнее действие","toast.cfg_save_failed":"Не удалось сохранить конфиг: {err}","toast.room_overlap":"Контур накладывается на комнату «{name}» — комнаты не должны накладываться","toast.contour_cannot_close":"Контур нельзя замкнуть: он вырожден или пересекает сам себя","toast.merge_not_adjacent":"Объединять можно только комнаты с общей стеной","toast.rooms_merged":"Комнаты объединены в «{name}»","toast.split_pick_wall":"Начните разрез на стене комнаты","toast.split_bad_cut":"Разрез — от стены до стены внутри комнаты, без пересечения стен и самого себя","merge.header":"Объединение комнат","merge.hint":"У объединённой комнаты одно имя и одна зона. Вторая зона освобождается — её устройства уйдут с плана, пока их не заберёт другая комната.","merge.keep":"Оставить","merge.no_area":"без зоны","toast.room_saved":"Комната сохранена ({n}). Устройств добавлено: {added}. Обведите следующую или выйдите из разметки.","toast.room_saved_no_area":"Комната сохранена ({n}, без зоны). Обведите следующую или выйдите из разметки.","toast.marker_needs_server":"Редактирование устройств доступно после переноса конфига на сервер","toast.virtual_name_required":"Укажите имя виртуального устройства","toast.marker_saved":"Устройство сохранено","toast.marker_removed":"Устройство удалено с плана","toast.integration_missing":"Интеграция House Plan не установлена — управление недоступно","toast.plan_formats":"Поддерживаются SVG, PNG, JPG, WebP","toast.plan_required":"Загрузите подложку — план этажа обязателен","toast.space_added_onboard":"Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.","toast.space_added":"Пространство добавлено","toast.space_saved":"Пространство сохранено","toast.space_deleted":"Пространство удалено","toast.delete_failed":"Ошибка удаления: {err}","toast.error":"Ошибка: {err}","toast.toggle_target_unavailable":"Цель «{name}» недоступна — действие не выполнено","toast.toggle_targets_unavailable":"Цели недоступны: {names}. Действие не выполнено","toast.file_failed":"Файл «{name}» не загружен: {err}","toast.files_attached":"Прикреплено файлов: {n}","err.unknown":"неизвестная ошибка","err.code":"код {code}","err.too_large":"файл больше {mb} МБ","err.bad_ext":"недопустимый тип (нужен PDF/изображение)","err.unauthorized":"нужны права администратора","editor.title":"Заголовок","editor.default_floor":"Стартовое пространство","editor.default_floor_missing":"Стартовое пространство «{id}» больше не существует. Выберите другое.","editor.floor":"Закреплённое пространство","editor.floor_none":"— не закреплять —","editor.floor_index":"YAML-индекс {index} (сохранён)","fixed_floor.loading":"Загружаем закреплённое пространство…","fixed_floor.invalid_title":"Закреплённое пространство недоступно","fixed_floor.invalid_body":"Проверьте floor в конфигурации карточки. Настроенное значение: {value}","editor.icon_size":"Размер иконок, % ширины плана","editor.show_temperature":"Показывать температуру","editor.live_states":"Живые состояния (вкл/выкл, открыто…)","editor.light_pools":"Световые пулы и тени от стен","editor.show_signal":"Показывать сигнал zigbee (LQI)","editor.language":"Язык интерфейса","editor.lang_auto":"Авто (профиль HA)","title.icon_rules":"Правила иконок: какая MDI-иконка достаётся устройству по имени","rules.title":"Правила иконок","rules.hint":"Правила проверяются сверху вниз по строке «имя устройства + модель» (regex без учёта регистра); срабатывает первое совпадение. Если ничего не подошло — решает device class сущности, затем — иконка-заглушка.","rules.pattern_ph":"regex, напр. розетк|plug","rules.icon_ph":"mdi:power-socket-de","rules.add":"Добавить правило","rules.reset":"Сбросить к умолчаниям","rules.test_ph":"Проверьте имя устройства…","rules.invalid":"некорректный regex","rules.saved":"Правила иконок сохранены","btn.up":"Вверх","btn.down":"Вниз","tap.info":"Карточка устройства","tap.more_info":"Диалог HA (more-info)","tap.toggle":"Переключить состояние","marker.tap_label":"Действие по нажатию для этого устройства","tap.toggle_note":"Под селектором показано, какое состояние изменится. Защищённые устройства не переключаются с плана.","import.title":"Создать пространства из этажей HA","import.hint":"Home Assistant уже знает эти этажи. Отметьте, какие превратить в пространства плана — далее для каждого попросим картинку плана. Комнаты затем обводятся вручную по плану.","import.start":"Создать: {n}","import.manual":"Начать с нуля","import.progress":"Этаж {i} из {n}","import.done":"Пространства созданы. Обведите комнаты: кликайте по точкам сетки и замкните контур.","btn.skip":"Пропустить","space.scale_label":"Масштаб (размер клетки сетки)","space.cell_cm.help":"Связывает сетку с реальными размерами: от значения зависят длины и площади, толщина стен, размеры проёмов и радиус свечения. Изменение после разметки меняет расчётные размеры всего пространства, но не двигает его точки на плане.","space.cell_cm.help.aria":"Подсказка: масштаб пространства","space.scale_unit":"см на клетку","space.scale_unit_imperial":"дюйм на клетку","space.display_section":"Отображение","space.show_borders":"Всегда отображать границы комнат","space.zero_wall_style":"Стены нулевой толщины","space.zero_wall_style.help":"Пунктирные стены нулевой толщины пропускают Glow и солнечные лучи, сплошные блокируют их как барьер нулевой площади. Выбор меняет все такие стены пространства, даже когда их линии скрыты в просмотре.","space.zero_wall_style.help.aria":"Подсказка: вид стен нулевой толщины","space.zero_wall_dashed":"Пунктирные","space.zero_wall_solid":"Сплошные","space.show_names":"Отображать названия комнат (перетаскиваются)","space.room_color":"Цвет границ и названий","space.opacity":"Прозрачность","space.fill_label":"Заливка комнат","space.fill_mode.help":"«Свой цвет» задаёт оформление, а «Свет», «Температура» и «LQI» используют текущие данные Home Assistant; Glow включается отдельно.","space.fill_mode.help.aria":"Подсказка: режим заливки комнат","fill.none":"Нет","fill.lqi":"По силе зигби-сигнала","fill.light":"По освещению","fill.custom":"Свой цвет","space.custom_fill":"Цвет заливки","space.source_file":"У меня есть картинка плана","space.source_draw":"Нет подложки — нарисую комнаты вручную","fill.temp":"По температуре","tip.temp_avg":"средняя температура:","tip.hum_avg":"средняя влажность:","space_card.button":"Перейти к пространству","space_card.not_found":"Пространство «{id}» не найдено","space_card.loading":"Загрузка…","continuity.restore_plan":"Восстанавливаем план…","continuity.restore_connection":"Восстанавливаем подключение к устройствам…","continuity.retry":"Повторить","editor.space":"Пространство","editor.framing":"Кадрирование","editor.fit_content":"Всё видимое содержимое","editor.fit_house":"Плотно по геометрии дома","editor.show_button":"Показывать кнопку","editor.button_label":"Текст кнопки","editor.button_target":"Путь дашборда (куда вести)","marker.sub_entity":"сущность","title.general_settings":"Общие настройки","gs.title":"Общие настройки","gs.light_group":"Заливка: освещение","gs.light_on":"Свет включён","gs.light_off":"Весь свет выключен","gs.temp_group":"Заливка: температура","gs.temp_cold":"Холодно","gs.temp_ok":"Комфорт","gs.temp_hot":"Жарко","gs.lqi_group":"Заливка: зигби-сигнал","gs.lqi_low":"Слабый сигнал","gs.lqi_high":"Сильный сигнал","gs.reset":"Сбросить к умолчаниям","gs.saved":"Общие настройки сохранены","space.show_lqi":"Показывать зигби-сигнал (LQI) у устройств","space.hide_decor":"Скрыть декоративный слой","space.hide_decor_tip":"Линии, фигуры, надписи и мебель остаются на месте — их видно в редакторе подложки, но не на плане.","space.hide_openings":"Скрыть проёмы","space.hide_openings_tip":"Двери, окна и ворота не рисуются, но продолжают работать: свет проходит, солнце светит в окна, датчики открытия срабатывают. В редакторе плана проёмы видно всегда.","gs.light_none":"Нет источников света","mode.plan":"Редактор плана","mode.devices":"Редактор устройств","display.value":"Значение + состояние","marker.subarea":"без зоны, вручную","device.new":"Новое устройство — откройте его редактор, чтобы снять отметку","opening.unlock_action":"Открыть замок","opening.lock_action":"Закрыть замок","opening.lock_pending":"Выполняется…","title.close_editor":"Закрыть редактор (вернуться к просмотру)","title.add_device":"Добавить устройство на план","devbar.add":"Добавить","devbar.rules":"Правила иконок","device_inbox.button":"Устройства","device_inbox.title":"Устройства на плане","device_inbox.search":"Поиск по устройствам, сущностям и интеграциям…","device_inbox.add_virtual":"Добавить виртуальное устройство","device_inbox.tab_on_plan":"На плане","device_inbox.tab_available":"Доступны","device_inbox.tab_hidden":"Скрытые","device_inbox.tab_readd":"Доступны снова","device_inbox.only_new":"Только новые","device_inbox.show_entities":"Показывать сущности","device_inbox.show_hidden":"Показывать скрытые на плане","device_inbox.show_hidden.help":"Временно показывает на плане скрытые и деактивированные маркеры служебными призраками только в редакторе устройств. Сохранённая видимость устройств не меняется.","device_inbox.show_hidden.help.aria":"Подсказка: показывать скрытые устройства на плане","device_inbox.new":"Новое","device_inbox.find":"Найти на плане","device_inbox.edit":"Настроить","device_inbox.hide":"Скрыть","device_inbox.show":"Показать","device_inbox.add":"Добавить","device_inbox.readd":"Добавить заново","device_inbox.hide_available":"Скрыть из списка","device_inbox.show_more":"Показать ещё","device_inbox.more_actions":"Другие действия","device_inbox.find_hidden_hint":"Сначала включите «Показывать скрытые на плане»","device_inbox.show_disabled":"Перед показом активируйте эту привязку в Home Assistant","device_inbox.empty_on_plan":"На плане пока нет подходящих устройств.","device_inbox.empty_available":"Нет доступных устройств для добавления.","device_inbox.empty_hidden":"Скрытых устройств нет.","device_inbox.empty_readd":"Нет удалённых устройств, доступных для повторного добавления.","device_inbox.reason_visible_auto":"Найдено автоматически","device_inbox.reason_visible_explicit":"Добавлено явно","device_inbox.reason_manual_hidden":"Скрыто пользователем","device_inbox.reason_automatic_hidden":"Скрыто автоматически","device_inbox.reason_service_entry":"Служебная запись реестра","device_inbox.reason_excluded_integration":"Исключена интеграция «{integration}»","device_inbox.reason_excluded_domain":"Непространственный тип сущности","device_inbox.reason_grouped_light":"Представлено группой света комнаты","device_inbox.reason_represented_by_parent":"Представлено родительским устройством","device_inbox.reason_removed":"Ранее удалено с плана","device_inbox.reason_available":"Можно добавить на план","device_inbox.reason_no_bound_room":"Зона HA не связана с комнатой плана","device_inbox.status_ha_disabled":"Отключено в Home Assistant","device_inbox.status_orphaned":"Привязка больше не найдена в Home Assistant","device_inbox.status_unverified":"Реестр Home Assistant временно недоступен","device_inbox.saved":"Список устройств обновлён","device_inbox.filters_excluded":"Исключённые интеграции","device_inbox.filters_group_lights":"Объединять светильники комнаты в один маркер","device_inbox.filters_preview_appear":"появится: {count}","device_inbox.filters_preview_hide":"скроется: {count}","device_inbox.filters_preview_lights":"затронет светильников: {count}","device_inbox.filters_reset":"Вернуть рекомендуемые","device_inbox.filters_save":"Сохранить фильтры","device_inbox.filters_search_ph":"Добавить интеграцию…","device_inbox.filters_title":"Фильтры обнаружения","space.roomcard_section":"В карточке комнаты:","space.label_temp":"Температура","space.label_hum":"Влажность","space.label_lqi":"Средний Zigbee-сигнал","space.label_light":"Свет вкл/выкл","roomcard.light_on":"Вкл","roomcard.light_off":"Выкл","roomcard.light_partial":"{on} из {total}","toast.split_pick_inside":"Промежуточные точки разреза — внутри комнаты","mode.decor":"Редактор подложки","decor.select":"Выбрать","decor.line":"Линия","decor.rect":"Прямоугольник","decor.ellipse":"Овал","decor.text":"Надпись","decor.erase":"Стереть","decor.erase_confirm_title":"Стереть объект?","decor.color":"Цвет","decor.width":"Толщина линии","decor.line_style":"Стиль линии","decor.line_style_solid":"Сплошная","decor.line_style_dashed":"Пунктирная","decor.fill":"Заливка","decor.fill_color":"Цвет заливки","decor.length":"Длина","decor.size":"Размер","decor.flip_h":"Отзеркалить по горизонтали","decor.flip_v":"Отзеркалить по вертикали","decor.angle":"Угол поворота, °","decor.text_size":"Размер текста","decor.backdrop_properties":"Свойства картинки-подложки","decor.text_title":"Надпись","decor.object_title":"Редактирование: {kind}","decor.text_label":"Текст","decor.live_group":"Вставить переменную HA","decor.live_entity":"Сущность","decor.live_entity_ph":"выберите сущность","decor.live_attr":"Значение","decor.live_attr_ph":"выберите состояние или атрибут","decor.live_state":"Состояние","decor.backdrop":"Картинка-подложка","decor.backdrop_hint":"Тяните картинку — перемещение; угол — размер; верхнюю ручку — поворот. Shift меняет пропорции или снимает шаг угла.","decor.backdrop_reset":"Вернуть картинку","decor.backdrop_reset_done":"Картинка вернулась на своё место и в свой размер","marker.icon_auto":"Авто: {icon} (по правилам иконок; выберите свою, чтобы заменить)","marker.icon_pin_auto":"Закрепить","mode.plan_tip":"Редактор плана — геометрия дома: рисование и объединение/разделение комнат, привязка к зонам HA, двери, окна и ворота, карточки комнат, масштаб","mode.devices_tip":"Редактор устройств — всё про значки: перетаскивание, клик — настройка привязки/иконки/отображения, виртуальные устройства, правила иконок","mode.decor_tip":"Редактор подложки — чисто визуальный декор под планом: линии, прямоугольники, овалы и надписи, не реагирующие на клики","space.glow_enabled":"Свечение источников света","gs.glow_group":"Свечение источников света","gs.glow_base":"Темнота дома","gs.glow_light":"Цвет света по умолчанию / интенсивность","gs.wall_group":"Стены","gs.wall_fill":"Цвет заливки стен","gs.glow_radius":"Радиус свечения","gs.glow_radius.help":"Задаёт общий радиус светового пятна в метрах или футах; персональный радиус устройства заменяет это значение.","gs.glow_radius.help.aria":"Подсказка: общий радиус свечения","gs.unit_m":"м","gs.unit_ft":"фут","marker.controls_label":"Управляет другими источниками света","marker.controls.help":"При действии «Переключить состояние» перечисленные источники переключаются вместе с этим маркером. Их световые пятна остаются у собственных маркеров, а эта связь сама по себе не делает управляющий маркер источником света.","marker.controls.help.aria":"Подсказка: управление другими источниками света","marker.controls_filter":"Поиск ламп и выключателей…","info.controls":"Управляет","marker.glow_radius_label":"Радиус свечения","marker.glow_radius.help":"Задаёт радиус свечения в метрах или футах; пустое значение использует радиус из общих настроек.","marker.glow_radius.help.aria":"Подсказка: радиус свечения","markup.wallthick":"Толщина","markup.select":"Выбрать","title.markup_wallthick":"Толщина — клик по стене задаёт толщину от 0 до 100 см.","markup.hint_wallthick":"клик по стене · Esc закрывает без применения","wallthick.field":"Толщина","wallthick.unit_cm":"см","wallthick.unit_in":"дюйм","wallthick.apply_room":"Применить ко всем стенам комнаты","markup.draw_wall_title":"Толщина каждого нового сегмента стены (0–100 см). Общие стены сохраняют существующее значение.","room.queue_progress":"Комната {current} из {total}","toast.wall_rooms_saved":"Создано комнат: {n}","toast.wall_chain_saved":"Цепочка стен сохранена","toast.wallthick_pick":"Кликните по стене","toast.wallthick_set":"Толщина стены задана","toast.wallthick_cleared":"Толщина стены убрана","toast.physical_range":"Введите значение от {min} до {max} {unit}","toast.zero_wall_opening_conflict":"Сначала удалите проём на этом участке стены.","toast.zero_wall_ambiguous":"Не удалось однозначно выбрать участок стены. Уточните геометрию узла.","toast.zero_wall_migration_blocked":"Пространство не преобразовано: {reason}. Данные не изменены.","toast.physical_angle":"Введите угол поворота от 0° до 90°, не включая 90°","toast.physical_limit":"В пространстве достигнут лимит объектов этого типа","toast.geometry_unsafe":"Изменение отменено: геометрию стен нельзя безопасно построить.","junction.limit_angle":"Слишком острый угол между стенами: {actual}°, минимум {limit}°.","junction.limit_valence":"Слишком много стен в одном узле: {actual}, максимум {limit}.","junction.limit_length":"Слишком короткий участок стены: {actual} см, минимум {limit} см.","junction.limit_distance":"Стены и узлы слишком близко: {actual} см, минимум {limit} см.","junction.limit_clearance":"Внутри комнаты не остаётся места: {actual} см², минимум {limit} см².","junction.limit_check_failed":"Проверку стыков выполнить не удалось — изменение не сохранено","toast.wall_model_migration_blocked":"Не удалось обновить модель стен: {reason}. План не изменён. Запустите «Оптимизировать планы»; если ошибка повторится, исправьте конфликтующую геометрию стен.","toast.wall_model_client_outdated":"Обновите карточку и перезагрузите страницу перед редактированием плана.","wall_model.reason.invalid-room":"некорректный контур комнаты","wall_model.reason.zero-length":"отрезок стены нулевой длины","wall_model.reason.third-owner":"стена принадлежит более чем двум комнатам","wall_model.reason.duplicate-id":"конфликт идентификаторов стен","wall_model.reason.thickness-conflict":"конфликт значений толщины стены","wall_model.reason.opening-host":"проём нельзя однозначно привязать к стене","toast.delete_room_pick":"Кликните внутри комнаты, которую нужно удалить","toast.plan_snap_ambiguous":"Увеличьте масштаб, чтобы выбрать узел стены","toast.wall_repair_ambiguous":"У контура несколько возможных соединений. Увеличьте масштаб и соедините стены явно.","toast.wall_repair_too_large":"Разрыв больше 2 см. Соедините стены перед созданием комнаты.","toast.wall_repair_changed":"Геометрия стен изменилась. Попробуйте создать комнату ещё раз.","toast.opening_on_zero_wall":"Проёмы на стене нулевой толщины запрещены","marker.from_ha_option":"Выбрать из списка HA","marker.show_entities":"Показывать сущности","marker.show_entities_tip":"Добавляет в список не только устройства, но и все их сущности","marker.pick_ph":"Выберите устройство…","room.open_area":"Открыть зону в HA","view.volumetric":"Объёмный вид","view.flat":"Плоский вид","kiosk.title":"Размеры на этом экране","kiosk.hint":"Хранится только на этом устройстве — у каждого настенного планшета или ТВ свои удобные размеры.","kiosk.icon_scale":"Размер значков устройств","kiosk.font_scale":"Размер текста карточек комнат","editor.kiosk":"Режим настенного устройства (киоск)","editor.cycle":"Автосмена пространств каждые N секунд (киоск, 0 = выкл)","room.settings_title":"Настройки комнаты","room.settings_section":"Настройки комнаты (переопределяют пространство)","room.fill_label":"Заливка в ЭТОЙ комнате","fill.inherit":"Как у пространства","room.custom_fill_space":"Цвет пространства","room.custom_fill_own":"Цвет комнаты","room.temp_src_label":"Источник температуры","room.hum_src_label":"Источник влажности","room.src_average":"Средняя по датчикам комнаты (по умолчанию)","room.src_pick":"Конкретное устройство или сущность HA","room.src_ph":"Выберите источник…","toast.room_updated":"Комната обновлена","space.card_font":"Размер шрифта карточек комнат (всё пространство)","room.sizes_section":"Размеры шрифтов","room.name_scale":"Размер названия","room.label_scale":"Размер подписей","preview.room_name":"Гостиная","toast.cfg_reload_failed":"Не удалось перечитать план с сервера: {err}","toast.locale_load_failed":"Не удалось загрузить языковой пакет. До перезагрузки страницы используется английский.","room.settings_short":"Настройки комнаты","room.unnamed":"Комната без имени","marker.use_climate_temp":"Учитывать температуру устройства в комнате","marker.use_climate_temp_tip":"Добавляет current_temperature кондиционера или термостата в среднюю температуру комнаты. Внешний бейдж со значением настраивается отдельно ниже.","marker.value_badge_title":"Бейдж со значением","marker.value_badge.help":"Показывает одно выбранное значение рядом со значком. Не влияет на комнатные показатели, свет, Glow и действие по нажатию.","marker.value_badge.help.aria":"Подсказка: бейдж со значением устройства","marker.value_badge_enabled":"Отображать бейдж со значением","marker.value_badge_source":"Значение","marker.value_badge_source.help":"Выберите конкретное состояние, поддерживаемый атрибут или производное значение этого устройства.","marker.value_badge_source.help.aria":"Подсказка: источник значения бейджа","marker.value_badge_position":"Расположение","marker.value_badge_position.help":"Выбранная сторона сохраняется постоянно и не переворачивается автоматически у края плана.","marker.value_badge_position.help.aria":"Подсказка: расположение бейджа","marker.value_badge_right":"Справа","marker.value_badge_bottom":"Снизу","marker.value_badge_left":"Слева","marker.value_badge_top":"Сверху","marker.value_badge_empty":"У этого устройства нет доступных значений","marker.value_badge_static":"Статичный значок не показывает живые значения. Настройка сохранится.","marker.value_badge_missing":"Источник недоступен","marker.value_badge_missing_hint":"Сохранённый источник сейчас недоступен. Можно сохранить его, отключить бейдж или выбрать другой.","marker.value_badge_duplicate":"То же значение уже показано внутри значка.","marker.value_badge_state":"Состояние · {name}","marker.value_badge_marker_state":"Состояние источника света · {name}","marker.value_badge_lqi":"Качество Zigbee-сигнала (среднее)","marker.value_badge_attr_current_temperature":"Текущая температура · {name}","marker.value_badge_attr_temperature":"Целевая температура · {name}","marker.value_badge_attr_current_humidity":"Текущая влажность · {name}","marker.value_badge_attr_humidity":"Влажность · {name}","marker.value_badge_attr_current_position":"Положение · {name}","marker.value_badge_attr_percentage":"Скорость · {name}","marker.value_badge_attr_brightness":"Яркость · {name}","marker.value_badge_attr_volume_level":"Громкость · {name}","marker.value_badge_attr_battery_level":"Заряд батареи · {name}","marker.value_badge_attr_fan_speed":"Скорость вентилятора · {name}","marker.value_source":"Источник значения","marker.value_source.help":"Выберите, что заменит значок. Действие по нажатию не изменится.","marker.value_source.help.aria":"Подсказка: источник значения внутри значка","marker.value_source_auto":"Автоматически (как раньше)","marker.value_source_missing_hint":"Сохранённый источник сейчас недоступен. До его восстановления или выбора другого значения внутри будет показано —.","marker.light_role_label":"Является источником света","marker.light_role.help":"«Авто» использует фактическую роль привязанного устройства, «Всегда» принудительно создаёт собственный источник, а «Никогда» исключает его; связанные лампы выше остаются независимыми.","marker.light_role.help.aria":"Подсказка: является ли устройство источником света","marker.light_role_auto_yes":"Автоматически (источник света)","marker.light_role_auto_no":"Автоматически (не источник света)","marker.light_role_always":"Всегда источник света","marker.light_role_never":"Никогда не источник света","marker.light_entity_label":"Ведущая сущность света","marker.light_entity.help":"Для составного устройства выберите сущность, состояние, цвет и яркость которой представляют этот источник на плане. Автоматический вариант сохраняет совместимость со старыми планами.","marker.light_entity.help.aria":"Подсказка: ведущая сущность света","marker.light_entity_auto":"Автоматически ({entity})","marker.light_entity_none":"нет управляемой сущности","marker.light_entity_missing":"Сохранённая сущность {entity} недоступна. Временно используется {fallback}; выбор восстановится, если сущность вернётся.","marker.toggle_entity_label":"Переключаемая сущность","marker.toggle_entity.help":"Для составного устройства выберите собственную лампу или переключатель, которой управляет нажатие. Автоматический вариант сохраняет прежние правила цели и не зависит от ведущей сущности света.","marker.toggle_entity.help.aria":"Подсказка: переключаемая сущность","marker.toggle_entity_auto":"Автоматически ({entity})","marker.toggle_entity_none":"нет собственной управляемой сущности","marker.toggle_entity_missing":"Сохранённой сущности {entity} больше нет среди выбираемых каналов этого маркера. Временно используется {fallback}; выбор восстановится, если сущность вернётся.","marker.glow_color_label":"Цвет и яркость свечения","marker.glow_mode.help":"Используйте данные источника, задайте только цвет или зафиксируйте цвет и яркость. Минимум — 1%; чтобы отключить источник, выберите «Никогда».","marker.glow_mode.help.aria":"Подсказка: цвет и яркость свечения","marker.glow_mode_auto":"Из источника","marker.glow_mode_color":"Задать цвет","marker.glow_mode_fixed":"Задать цвет и яркость","marker.glow_color":"Цвет свечения","marker.glow_brightness":"Яркость","marker.glow_disabled_never":"Настройки свечения недоступны: маркер явно исключён из источников света.","marker.glow_disabled_auto":"В автоматическом режиме у этого маркера не найден пространственный источник света.","marker.glow_disabled_no_entity":"Для пространственного источника нет активной управляемой сущности Home Assistant.","marker.glow_passive_hint":"У источника нет собственных данных Home Assistant. Задайте цвет и яркость вручную; радиус остаётся доступным.","marker.control_broken":"Сохранённый источник отсутствует или больше не отмечен как источник света","marker.control_missing_label":"Отсутствующий источник на плане","marker.control_passive":"пассивный источник","toast.marker_control_cycle":"Такая связь создаст циклическую цепочку управления светом.","toast.marker_binding_required":"Сначала выберите устройство Home Assistant, затем добавьте управляемый источник света.","confirm.unlock_title":"Открыть замок?","confirm.unlock_body":"House Plan отправит этому замку команду открытия.","toast.files_migrate_failed":"Не удалось перенести вложения к новой привязке, ссылки остались на старые файлы: {err}","space.pick_saved":"Уже загруженные","space.pick_saved_hint":"Планы, сохранённые на сервере, включая отцеплённые ранее","space.no_saved":"На сервере пока нет сохранённых планов.","space.loading":"Загрузка…","space.used_by":"используется: {list}","space.in_use":"План используется пространством — сначала отцепите его","btn.use":"Выбрать","confirm.delete_plan_title":"Удалить файл плана?","confirm.delete_plan_body":"Файл будет удалён с сервера. Это действие нельзя отменить.","toast.plans_list_failed":"Не удалось получить список планов: {err}","toast.plan_delete_failed":"Не удалось удалить план: {err}","marker.hide":"Скрыть","marker.hide_tip":"Устройство исчезнет с плана после сохранения, но продолжит участвовать в расчёте сигнала комнаты. Вернуть его можно через каталог «Устройства» в редакторе устройств.","marker.show":"Показать","marker.show_tip":"Устройство снова появится на плане после сохранения.","marker.hidden_ghost":"Устройство скрыто пользователем","marker.ha_disabled_device":"Устройство деактивировано в Home Assistant и скрыто с плана.","marker.ha_disabled_entity":"Сущность деактивирована в Home Assistant и скрыта с плана.","marker.ha_disabled_all_entities":"У устройства нет активных сущностей Home Assistant, поэтому оно скрыто с плана.","marker.ha_registry_limited":"Полный реестр Home Assistant недоступен этому пользователю. Неподтверждённый объект временно нельзя показывать или использовать.","marker.delete_tip":"Полностью удалить устройство с плана и из всех расчётов. Позже его можно добавить заново.","tap.run":"Запустить автоматизацию/скрипт/сцену","tap.none":"Ничего не делать","marker.run_target_label":"Что запускать","marker.run_search_ph":"Поиск: автоматизация, скрипт или сцена…","marker.run_target_gone":"Цель {id} не найдена — выберите заново","marker.tap_confirm":"Спрашивать подтверждение","marker.tap_confirm_tip":"Перед выполнением показать диалог подтверждения — защита от случайных нажатий.","marker.toggle_hint_single":"Цель: {name} ({id}).","marker.virtual_light_target":"Виртуальный свет: {name}.","marker.virtual_light_current":"Ручное состояние: {state} → {effect}.","marker.virtual_light_state_on":"включён","marker.virtual_light_state_off":"выключен","marker.toggle_hint_group":"Переключатся источники ({count}): {names}.","marker.toggle_hint_current":"Сейчас: {state} → {effect}.","marker.toggle_hint_group_current":"Сейчас включено {on} из {count} → {effect}.","marker.toggle_hint_skipped":"Не будут затронуты ({count}): {targets}.","marker.toggle_effect_turn_on":"включится","marker.toggle_effect_turn_off":"выключится","marker.toggle_effect_open":"откроется","marker.toggle_effect_close":"закроется","marker.toggle_effect_stop":"остановится","marker.toggle_effect_toggle":"состояние переключится","marker.toggle_skip_missing":"не найдено","marker.toggle_skip_ha_disabled":"деактивировано в HA","marker.toggle_skip_unavailable":"недоступно","marker.toggle_skip_unsupported":"переключение не поддерживается","marker.toggle_skip_secure":"заблокировано из соображений безопасности","marker.toggle_none_no_binding":"У устройства нет привязки, состояние переключать нечем. По нажатию ничего не произойдёт.","marker.toggle_none_no_actionable_entity":"У устройства нет состояния, которое можно переключить. По нажатию ничего не произойдёт.","marker.toggle_none_configured_targets_missing":"Настроенные цели сейчас недоступны. Собственная сущность устройства не будет подставлена вместо них.","marker.toggle_none_ha_disabled":"Цель деактивирована в Home Assistant и не может использоваться на плане.","marker.toggle_none_unavailable":"Цель сейчас недоступна. По нажатию ничего не произойдёт.","marker.toggle_none_unsupported":"Для этой сущности Home Assistant не предоставляет безопасного переключения. По нажатию ничего не произойдёт.","marker.toggle_none_secure":"Переключение замков, сигнализации и защитных ворот с плана заблокировано из соображений безопасности.","run.automation":"автоматизация","run.script":"скрипт","run.scene":"сцена","confirm.tap_run":"Запустить «{name}»?","confirm.tap_toggle":"Переключить «{name}»?","confirm.current_state":"Текущее состояние: {state}","confirm.expected_state":"После переключения: {state}","confirm.group_current":"включено {on} из {total}","confirm.group_all_on":"все включены","confirm.group_all_off":"все выключены","confirm.unavailable_targets":"Недоступно: {count}","confirm.expected_by_ha":"Состояние определит Home Assistant","confirm.state_on":"Включено","confirm.state_off":"Выключено","confirm.state_open":"Открыто","confirm.state_closed":"Закрыто","confirm.state_opening":"Открывается","confirm.state_closing":"Закрывается","confirm.state_stopped":"Остановлено","confirm.state_unknown":"Неизвестно","toast.run_started":"Запущено: {name}","toast.run_target_missing":"Цель запуска не найдена — проверьте настройки устройства","toast.run_target_required":"Выберите автоматизацию, скрипт или сцену","toast.tap_target_changed":"Цель действия изменилась. Повторите попытку.","toast.virtual_light_toggle_failed":"Не удалось переключить виртуальный свет: {err}","toast.value_badge_source_required":"Выберите значение для бейджа","btn.run":"Выполнить","vac.section":"Робот-пылесос: живая позиция","vac.autocal":"Настроить автоматически","vac.live":"Живая позиция на плане","vac.trail":"Показывать путь робота","vac.cal_maps":"Откалиброваны карты: {maps}","vac.autocal_no_rooms":"Интеграция не отдаёт список комнат — откройте «Подогнать вручную»","vac.autocal_no_match":"Не совпали имена комнат (нужно ≥3 общих) — откройте «Подогнать вручную»","vac.autocal_done":"Готово: привязка по {rooms} комнатам. Запустите уборку и проверьте","vac.cal_need_pos":"Робот сейчас не отдаёт координаты — запустите уборку и поставьте на паузу","vac.cal_done":"Калибровка сохранена. Запустите уборку и проверьте","vac.cal_cancelled":"Калибровка отменена","vac.fit":"Подогнать вручную","vac.fit_hint":"Перетащите карту робота на место, растяните за уголки","vac.fit_rotate":"Повернуть 90°","vac.fit_mirror":"Отразить","vac.trail_never":"Не показывать никогда","vac.trail_cleaning":"Во время уборки","vac.trail_always":"Показывать всегда","gs.bg_group":"Фон сцены","gs.bg_color":"Цвет фона вокруг плана","gs.bg_default":"Как в теме","gs.bg_theme":"по умолчанию — из темы","gs.bg_mode":"Фон плана","gs.bg_mode.help":"«Следует за Солнцем» использует sun.sun, а при недоступности — локальные часы браузера; статичный режим всегда показывает выбранный цвет.","gs.bg_mode.help.aria":"Подсказка: общий фон плана","gs.bg_static":"Статичный цвет","gs.bg_daynight":"Следует за Солнцем","gs.sun_group":"Солнце","gs.sun_missing":"Сущность sun.sun не найдена — фон следует локальным часам, а оконные лучи недоступны.","gs.north":"Север на плане","gs.north.help":"Угол отсчитывается по часовой стрелке от верхней вертикали плана; север нужен для оконных лучей, а не для фона «Следует за Солнцем».","gs.north.help.aria":"Подсказка: общее направление севера","gs.north_ph":"не задан","gs.north_clear":"Сбросить","gs.north_letter":"С","gs.sun_rays":"Солнце в окнах","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · документация и issues","gs.about_telegram":"Чат в Telegram","support.title":"Помощь и обратная связь","space.bg_color":"Цвет фона вокруг плана","space.bg_inherit":"Наследовать общий","space.bg_inherited":"наследуется из общих настроек","space.bg_mode":"Фон плана","space.bg_mode.help":"Выберите наследование общего фона либо переопределите это пространство статичным цветом или режимом «Следует за Солнцем».","space.bg_mode.help.aria":"Подсказка: фон пространства","space.north":"Север на плане (переопределение)","space.north.help":"Переопределяет общий север для этого пространства; угол отсчитывается по часовой стрелке от верхней вертикали плана и используется оконными лучами.","space.north.help.aria":"Подсказка: север для пространства","space.north_inherited":"наследуется: {v}","space.sun_rays":"Солнце в окнах","space.sun_inherit":"Наследовать общий","space.sun_on":"Вкл","space.sun_off":"Выкл","canvas.far_objects":"Объектов далеко от плана: {n}","canvas.show_far":"Показать","canvas.home_tip":"План там — нажмите, чтобы вписать","gs.grid_group":"Обслуживание планов","gs.grid_hint":"Обновляет модели данных, выравнивает элементы по сетке и объединяет лишние фрагменты стен. Перед записью будет показан точный отчёт.","gs.align_all":"Оптимизировать планы","gs.align_title":"Оптимизировать планы","gs.align_none":"Все планы уже используют актуальную и оптимальную модель данных.","gs.optimize_no_automatic_changes":"Автоматических изменений нет. Проверьте пункты ниже.","gs.align_count":"Сдвинется элементов: {n} из {total}, максимум на {cm} см.","gs.align_where":"Наибольший сдвиг — в пространстве «{s}».","gs.align_turned":"Проёмов с исправлением угла: {n}.","gs.align_removed_drafts":"Схлопнувшиеся на сетке некорректные контуры удалены: {n}.","gs.optimize_redundant_drafts":"Сохранённые цепочки стен, полностью скрытые стенами комнат, удалены: {n}.","gs.align_preflight_failed":"Не удалось безопасно проверить геометрию следующих пространств: {spaces}{more}.","gs.align_preflight_hint":"Планы не изменены. Скопируйте диагностику кнопкой ниже и приложите её к отчёту об ошибке вместе с экспортом пространства.","gs.preflight_reason_prepare-exception":"Не удалось подготовить геометрию пространства (исключение при сборке модели)","gs.preflight_reason_wall-null":"Тело стен не построилось (объединение вернуло пустоту)","gs.preflight_reason_wall-degraded-extra":"Тело стен деградировало с лишней геометрией","gs.preflight_reason_wall-failed-core":"Ядро тела стен не собралось","gs.preflight_reason_wall-exception":"Построение стен упало с исключением","gs.preflight_reason_floor-null":"Контур пола не построился","gs.preflight_reason_floor-exception":"Построение пола упало с исключением","gs.preflight_copy":"Скопировать диагностику","gs.preflight_copied":"Диагностика скопирована","gs.preflight_update_hint":"Версии карточки и интеграции различаются — обновите House Plan и повторите.","gs.align_preflight_space":"Пространство {n}","gs.align_preflight_more":" и ещё {n}","gs.optimize_changes":"Миграций модели: {m}; обновлено пространств: {c}; устранён шум координат: {p}; объединено отрезков реальных стен: {w}; объединено отрезков стен нулевой толщины: {s}; независимых: {i}.","gs.zero_walls_migrated":"Преобразовано виртуальных участков: {n}.","gs.wall_segments_migrated":"Стабилизировано сегментов стен: {n}.","gs.optimize_lattice_summary":"Канонизировано шумовых значений координат: {n}; максимальный сдвиг: {cm} см.","gs.optimize_lattice_space":"{space}: канонизировано значений координат: {n}; оставлено значений вне сетки: {far}.","gs.optimize_coincident_partitions":"Скрытые участки независимых стен поглощены стенами комнат: {n}.","gs.optimize_openings_rehosted":"Проёмы перепривязаны к стенам комнат: {n}.","gs.optimize_walls_straightened":"Выпрямлено стен: {n}; максимальное перемещение: {cm} см.","gs.optimize_walls_straightened_where":"Максимальная правка стены: {s}.","gs.optimize_walls_straighten_skipped":"Оставлено почти осевых стен, которые нельзя безопасно выпрямить: {n}.","gs.optimize_glow_migration":"Старый Glow: пространств — {spaces} → без заливки данных + независимый Glow; комнат — {rooms} → наследуемая заливка + независимый Glow.","gs.optimize_references":"Исправлено ссылок: пространства — {spaces}; комнаты — {rooms}; позиции — {positions}; устройств отвязано от отсутствующих пространств — {detached}.","gs.optimize_reference_more":", и ещё {n}","gs.optimize_orphans_removed":"Убрано забытых записей: {total} — подписи комнат: {rooms}; устройства: {devices}; групповые метки: {groups}. Все они принадлежали пространствам, удалённым ранее.","gs.optimize_live_positions":"Старые позиции в удалённых пространствах принадлежат существующим объектам: {n}{names}. Они будут сохранены.","gs.optimize_live_positions_remove":"Старые позиции в удалённых пространствах принадлежат существующим объектам: {n}{names}. Они выбраны для удаления.","gs.optimize_live_names":": {names}{more}","gs.optimize_live_remove":"Убрать старые позиции","gs.optimize_live_keep":"Сохранить старые позиции","gs.optimize_live_selected":"Старые позиции будут убраны после применения оптимизации.","gs.optimize_unverified":"Не удалось безопасно проверить позиций: {n}. Они оставлены без изменений.","gs.optimize_registry_limited":"Для безопасной проверки нужен полный доступ администратора к реестрам Home Assistant.","gs.optimize_vacuum_warning":"Сопоставления комнат пылесоса требуют проверки: {n}.","gs.optimize_details":"Подробности","gs.optimize_details_more":"И ещё записей: {n}.","gs.optimize_detail_removed":"будет удалено","gs.optimize_detail_live":"будет сохранено","gs.optimize_detail_unverified":"не проверено","gs.optimize_detail_room_label":"подпись комнаты","gs.optimize_detail_device":"устройство","gs.optimize_detail_group":"групповая метка","gs.optimize_detail_unknown":"неизвестный владелец","gs.optimize_detail_item":"{status}: {kind} {id}; прежнее пространство {space}","gs.align_warn":"Элементы, намеренно поставленные между узлами, будут сдвинуты. После операции доступна одна отмена — только до следующего изменения плана.","gs.align_run":"Оптимизировать","gs.align_done":"Планы оптимизированы: сдвинуто элементов — {n}, обслужено записей — {m}, исправлено ссылок — {r}","gs.optimize_undo":"Отменить последнюю оптимизацию","gs.optimize_undone":"Последняя оптимизация отменена","decor.furniture":"Мебель","decor.image":"Изображение","decor.image_title":"Свои изображения","decor.image_upload":"Загрузить изображение","decor.image_replace":"Заменить изображение","decor.image_uploading":"Загрузка…","decor.image_asset":"Файл изображения","decor.image_pick_hint":"Загрузите изображение или выберите уже используемое в House Plan.","decor.image_place_hint":"Кликните по плану, чтобы разместить изображение.","decor.image_none":"Загруженных изображений пока нет.","decor.image_unavailable":"Изображение недоступно","decor.image_used":"Используется в объектах: {n}","decor.image_upload_failed":"Не удалось загрузить изображение: {err}","decor.image_error_capacity":"Хранилище пользовательских изображений заполнено.","decor.image_in_use":"Перед удалением файла удалите все размещённые копии.","decor.image_delete_title":"Удалить файл изображения?","decor.image_delete_message":"Удалить «{name}» из House Plan? Это действие нельзя отменить.","furn.title":"Библиотека мебели","furn.symbol":"Символ","furn.group_furniture":"Мебель","furn.group_appliance":"Техника","furn.group_sanitary":"Сантехника","furn.group_other":"Прочее","furn.width":"Ширина","furn.depth":"Глубина","furn.back_to_categories":"Все категории","furn.pick_hint":"Выберите категорию, затем символ.","furn.place_hint":"Кликните по плану — предмет встанет к ближайшей стене. Shift — свободно.","furn.cat_air_conditioner":"Кондиционеры","furn.cat_armchair":"Кресла","furn.cat_bathtub":"Ванны","furn.cat_bed":"Кровати","furn.cat_bidet":"Биде","furn.cat_boiler":"Бойлеры","furn.cat_chair":"Стулья","furn.cat_coffee_table":"Журнальные столы","furn.cat_cooktop":"Варочные панели","furn.cat_dining_table":"Обеденные столы","furn.cat_dishwasher":"Посудомоечные машины","furn.cat_dryer":"Сушильные машины","furn.cat_fireplace":"Камины","furn.cat_fridge":"Холодильники","furn.cat_kitchen_cabinet":"Кухонные шкафы","furn.cat_kitchen_sink":"Кухонные мойки","furn.cat_nightstand":"Тумбы","furn.cat_plant":"Растения","furn.cat_rug":"Ковры","furn.cat_shelving":"Стеллажи","furn.cat_shower":"Душевые","furn.cat_sink":"Раковины","furn.cat_sofa":"Диваны","furn.cat_stairs":"Лестницы","furn.cat_toilet":"Унитазы","furn.cat_tv":"Телевизоры","furn.cat_wardrobe":"Шкафы","furn.cat_washer":"Стиральные машины","furn.cat_work_table":"Рабочие столы","furn.sym_sofa":"Диван двухместный","furn.sym_sofa_three_seat":"Диван трёхместный","furn.sym_sofa_corner_right":"Угловой диван, правый","furn.sym_armchair":"Кресло мягкое","furn.sym_armchair_office":"Кресло офисное","furn.sym_coffee_table":"Журнальный стол, прямоугольный","furn.sym_coffee_table_round":"Журнальный стол, круглый","furn.sym_coffee_table_oval":"Журнальный стол, овальный","furn.sym_coffee_table_rounded":"Журнальный стол, скруглённый","furn.sym_table_dining":"Обеденный стол, прямоугольный","furn.sym_table_round":"Круглый стол","furn.sym_table_dining_oval":"Обеденный стол, овальный","furn.sym_table_dining_rounded":"Обеденный стол, скруглённый","furn.sym_chair":"Стул","furn.sym_chair_bar":"Барный стул","furn.sym_desk":"Рабочий стол, прямоугольный","furn.sym_desk_corner":"Рабочий стол, угловой","furn.sym_bed_double":"Двуспальная кровать","furn.sym_bed_single":"Односпальная кровать","furn.sym_nightstand":"Тумба прикроватная","furn.sym_cabinet_tv":"Тумба под телевизор","furn.sym_cabinet_shoe":"Тумба для обуви","furn.sym_cabinet_sink":"Тумба под раковину","furn.sym_wardrobe":"Шкаф гардеробный","furn.sym_bookshelf":"Шкаф книжный","furn.sym_wall_unit":"Шкаф-стенка","furn.sym_kitchen_floor":"Кухонный напольный модуль","furn.sym_kitchen_floor_corner":"Кухонный напольный угловой модуль","furn.sym_kitchen_wall":"Кухонный навесной модуль","furn.sym_kitchen_wall_corner":"Кухонный навесной угловой модуль","furn.sym_shelf_floor":"Стеллаж напольный","furn.sym_shelf_wall":"Полка настенная","furn.sym_fridge":"Холодильник","furn.sym_stove":"Варочная панель, 4 конфорки","furn.sym_cooktop_two":"Варочная панель, 2 конфорки","furn.sym_dishwasher":"Посудомоечная машина","furn.sym_washer":"Стиральная машина","furn.sym_dryer":"Сушильная машина","furn.sym_tv":"Телевизор на подставке","furn.sym_tv_wall":"Телевизор на кронштейне","furn.sym_ac":"Кондиционер","furn.sym_water_heater":"Бойлер","furn.sym_toilet":"Унитаз напольный","furn.sym_toilet_built_in":"Унитаз встроенный","furn.sym_bathtub":"Ванна прямоугольная","furn.sym_bathtub_corner":"Ванна угловая","furn.sym_shower":"Душ","furn.sym_sink":"Раковина","furn.sym_kitchen_sink":"Кухонная мойка одинарная","furn.sym_kitchen_sink_double":"Кухонная мойка двойная","furn.sym_bidet":"Биде напольное","furn.sym_bidet_built_in":"Биде встроенное","furn.sym_stairs":"Лестница","furn.sym_fireplace":"Камин","furn.sym_plant":"Растение","furn.sym_rug":"Ковёр","common.yes":"Да","common.no":"Нет","vac.diag_source":"Источник","vac.diag_platform":"Интеграция","vac.diag_status":"Статус","vac.diag_position":"Позиция","vac.diag_rooms":"Комнаты","vac.diag_rooms_value":"{total} · совпало имён: {matched} · {readiness}","vac.autocal_ready":"автокалибровка доступна","vac.autocal_not_ready":"нужно 3 совпавших имени","vac.diag_path":"Путь интеграции","vac.diag_map":"ID карты","vac.source_none":"не выбран","vac.source_status_ok":"Готов","vac.source_status_missing":"Не найден","vac.source_status_disabled":"Деактивирован в Home Assistant","vac.source_status_unavailable":"Недоступен","vac.source_status_unverified":"Нельзя проверить с текущими правами","vac.source_status_unsupported":"Нет данных позиции","vac.source_status_none":"Нет источника","vac.source_banner_missing":"Сохранённый источник больше не существует. Он не заменён автоматически: выберите другой или восстановите его в Home Assistant.","vac.source_banner_disabled":"Сохранённый источник деактивирован в Home Assistant. Активируйте его там или выберите другой.","vac.source_banner_unverified":"Текущих прав Home Assistant недостаточно для проверки источника. Привязка сохранена и не будет заменена автоматически.","vac.choose_source":"Выбрать источник","vac.source_auto":"Автоматически","vac.source_auto_hint":"Использовать совместимую сущность этого устройства","vac.all_cameras":"Все камеры","vac.all_cameras_warn":"Камера может не отдавать данные робота. Выбирайте её только если это карта вашего пылесоса.","vac.all_cameras_empty":"Других сущностей камеры не найдено.","vac.platform_unknown":"интеграция неизвестна","vac.cap_position":"позиция","vac.cap_rooms_short":"комнаты","vac.cap_path":"путь","vac.cap_map":"ID карты","vac.cap_none":"данные робота не обнаружены","vac.xcme_hint":"Включите атрибуты Xiaomi Cloud Map Extractor:","vac.documentation":"Документация","vac.residual_title":"Проверьте автокалибровку","vac.residual_message":"Совпавшие комнаты расходятся максимум на {error}. Примените приблизительную калибровку, подгоните её вручную либо отмените без изменения сохранённых настроек.","vac.apply_proposal":"Применить","gs.backup_group":"Резервная копия и перенос","gs.backup_hint":"Скачайте переносимую JSON-копию или проверьте и импортируйте копию, созданную House Plan.","backup.export_open":"Экспорт","backup.import_open":"Импорт","backup.export_title":"Экспорт House Plan","backup.import_title":"Импорт House Plan","backup.export_hint":"Выберите, должна ли копия содержать всю конфигурацию House Plan или только текущее пространство.","backup.full":"Полная копия","backup.current_space":"Текущее пространство","backup.current_space_title":"Текущее пространство: {title}","backup.no_current_space":"Нет текущего пространства","backup.plan_only":"Только планировка","backup.plan_only_hint":"Сохранить комнаты, стены, проёмы, декор и позиции подписей комнат без устройств и привязок Home Assistant.","backup.plan_only_preview":"Файл содержит только планировку","backup.privacy_warning":"Архив сохраняет названия, идентификаторы Home Assistant и точные координаты. Внутренние планы и вложения указываются ссылками, но не вкладываются; текущие состояния и маршруты пылесосов не включаются.","backup.download":"Скачать JSON","backup.export_done":"Резервная копия скачана","backup.reading":"Проверяем резервную копию…","backup.revalidated":"После предпросмотра план изменился. Сводка обновлена — проверьте её и подтвердите ещё раз.","backup.error.support_invalid_message":"Проверьте сообщение для поддержки и повторите попытку.","backup.error.support_package_too_large":"Обезличенный пакет для поддержки превышает лимит 8 МиБ.","backup.error.support_preview_expired":"Предпросмотр вложения для поддержки истёк или больше недоступен.","backup.error.support_rate_limited":"Запрошено слишком много репортов или предпросмотров. Повторите позже.","backup.error.support_rejected":"Репорт не прошёл проверку службы поддержки.","backup.error.support_unavailable":"Закрытая служба поддержки временно недоступна.","backup.error.unauthorized":"У вас нет прав на экспорт или импорт этого плана.","backup.error.not_ready":"House Plan ещё не готов. Повторите попытку через несколько секунд.","backup.error.too_large":"Размер резервной копии превышает 8 МиБ.","backup.error.invalid_json":"Выбранный файл не является корректным JSON.","backup.error.invalid_format":"Выбранный файл не является резервной копией House Plan.","backup.error.invalid_image":"Изображение повреждено или не соответствует своему формату.","backup.error.unsupported_export_version":"Эта версия формата резервной копии не поддерживается установленной версией.","backup.error.unsupported_image":"Используйте поддерживаемое изображение PNG, JPEG, WebP или SVG.","backup.error.future_model":"Резервная копия создана в более новой версии модели данных House Plan.","backup.error.invalid_config":"Резервная копия содержит некорректную конфигурацию House Plan.","backup.error.wall_model_migration_blocked":"Не удалось безопасно обновить модель стен из резервной копии. Сначала оптимизируйте исходный план и повторите экспорт.","backup.error.invalid_layout":"Резервная копия содержит некорректные позиции объектов.","backup.error.invalid_content":"Резервная копия содержит некорректные или несогласованные ссылки на файлы.","backup.error.space_not_found":"Выбранное пространство больше не существует.","backup.error.capacity_exceeded":"Добавление этой копии превысит ограничения размера плана.","backup.error.preview_expired":"Время предпросмотра истекло. Выберите файл резервной копии заново.","backup.error.preview_owner_mismatch":"Этот предпросмотр принадлежит другому пользователю Home Assistant.","backup.error.conflict":"После предпросмотра план изменился. Проверьте обновлённую сводку.","backup.error.content_confirmation_required":"Подтвердите отсоединение недоступных локальных файлов.","backup.error.commit_failed":"Не удалось безопасно применить копию. Предыдущий план восстановлен или ожидает восстановления.","backup.error.missing_plan":"После предпросмотра исчез связанный файл плана. Проверьте копию ещё раз.","backup.error.missing_content":"После предпросмотра исчез связанный локальный файл. Проверьте копию ещё раз.","backup.error.marker_control_missing":"В резервной копии отсутствует связанный источник света на плане.","backup.error.marker_control_not_light":"Связанная цель больше не отмечена как источник света.","backup.error.marker_control_self":"Источник света не может управлять самим собой.","backup.error.marker_control_cycle":"Резервная копия содержит циклическую цепочку управления светом.","backup.error.duplicate_marker_control":"Резервная копия содержит повторяющуюся связь с источником света.","backup.error.no_backup":"Нет снимка импорта или оптимизации, который можно восстановить.","backup.error.in_use":"Элемент ещё используется","backup.error.invalid_data":"Запрос содержит некорректные данные","backup.error.invalid_light_entity":"Ведущий свет должен быть сущностью light.* или switch.*","backup.error.invalid_marker_control":"Некорректная ссылка управления маркером","backup.error.invalid_name":"Некорректное имя","backup.error.invalid_partition_opening_host":"Проём должен сохранить свою перегородку-носитель","backup.error.invalid_partition_opening_jamb_margin":"Проём не оставляет физического простенка у края стены","backup.error.invalid_passage_fields":"Открытый проход не может нести настройки двери","backup.error.invalid_space_id":"Неизвестное пространство","backup.error.invalid_toggle_entity":"Сущность переключения должна быть light.* или switch.*","backup.error.invalid_value_badge":"Некорректные настройки бейджа значения","backup.error.invalid_value_badge_attribute":"Некорректный атрибут бейджа значения","backup.error.invalid_value_badge_position":"Некорректная позиция бейджа значения","backup.error.invalid_value_badge_source":"Некорректный источник бейджа значения","backup.error.invalid_value_source":"Некорректный источник значения","backup.error.invalid_value_source_attribute":"Некорректный атрибут источника значения","backup.error.io_error":"Файловая операция на сервере не удалась","backup.error.not_toggleable":"Это устройство нельзя переключить","backup.error.nothing_to_repair":"Нечего чинить","backup.error.space_in_use":"На пространство ещё есть ссылки","backup.error.value_badge_source_required":"Бейджу значения нужен источник","backup.error.wall_model_client_outdated":"План обновлён в другом месте — перезагрузите страницу","backup.same_source":"Создано на этом экземпляре Home Assistant","backup.foreign_source":"Создано на другом экземпляре Home Assistant","backup.created":"Создано: {value}","backup.versions":"Карточка {card}; интеграция {integration}; модель данных {model}","backup.count_spaces":"Пространств: {n}","backup.count_rooms":"Комнат: {n}","backup.count_walls":"Стен: {n}","backup.count_openings":"Проёмов: {n}","backup.count_decor":"Объектов декора: {n}","backup.count_markers":"Устройств: {n}","backup.count_layout":"Позиций: {n}","backup.bindings":"Привязки — устройства: {device}, сущности: {entity}, виртуальные: {virtual}; позиций без пространства: {legacy}","backup.binding_status":"Статус на целевом экземпляре — активных: {active}, деактивированных: {disabled}, отсутствующих: {missing}","backup.missing_areas":"На целевом экземпляре отсутствуют зоны: {areas}","backup.dropped_marker_links":"Связи с источниками света вне переносимого пространства пропущены: {n}.","backup.repaired_target_refs":"Существующих ссылок восстановлено этим импортом: {n}.","backup.preserved_unresolved_refs":"Неоднозначные ссылки сохранены без изменений: {n}.","backup.preserved_unresolved_hint":"House Plan ничего не угадывал и не удалял. После импорта запустите «Оптимизировать планы», чтобы проверить оставшиеся ссылки.","backup.import_details":"Подробности восстановления ссылок","backup.import_detail.incoming_remapped":"Ссылок обновлено внутри импортируемой копии: {n}","backup.import_detail.target_repaired":"Существующих ссылок восстановлено: {n}","backup.import_detail.preserved_unresolved":"Неразрешимых ссылок сохранено: {n}","backup.import_detail.collisions":"Конфликтов назначения безопасно сохранено: {n}","backup.import_detail.dropped_links":"Входящих связей пропущено по правилам переноса: {n}","backup.import_detail.bounded_lineages":"Чрезмерно вложенных идентификаторов ограничено: {n}","backup.replace_warning":"Текущая конфигурация и расположение будут заменены. Загруженные файлы не удаляются. Одну отмену можно выполнить до следующего изменения плана.","backup.foreign_bookkeeping":"Служебные списки известных и новых устройств другого экземпляра импортированы не будут.","backup.final_name":"Название нового пространства","backup.target_settings":"Глобальные настройки целевого экземпляра не изменятся.","backup.duplicates":"Уже существующих привязок: {n}","backup.skip":"Пропустить повторяющиеся устройства","backup.virtual_copy":"Добавить безопасные статичные виртуальные копии","backup.content":"Связанное содержимое","backup.decor_images_summary":"Свои изображения: объектов — {objects}, файлов — {assets}; отсутствует файлов — {missing}.","backup.content_available":"доступно локально","backup.content_external":"внешняя ссылка","backup.content_detach_required":"будет отвязано","backup.confirm_detach":"Я понимаю, что недоступные внутренние планы и вложения будут отвязаны от импортируемой конфигурации.","backup.confirm_missing_images":"Я понимаю, что отсутствующие свои изображения останутся восстанавливаемыми заглушками, а остальные недоступные локальные файлы будут отвязаны.","backup.replace":"Заменить","backup.add":"Добавить пространство","backup.space_done":"Пространство импортировано: комнат — {rooms}, устройств — {markers}, существующих ссылок восстановлено — {refs}","backup.full_done":"Копия восстановлена: пространств — {spaces}, комнат — {rooms}, устройств — {markers}","backup.undo_import":"Отменить последний полный импорт","backup.import_undone":"Полный импорт отменён","backdrop.large_title":"Большое изображение","backdrop.large_body":"Изображение {w}×{h} ({fileMb} МБ), для показа потребуется около {decodedMb} МБ памяти. На планшетах это может привести к падению страницы.","backdrop.unknown_body":"Не удалось прочитать размеры изображения — файл может быть повреждён. Продолжение может привести к падению страницы на планшете.","backdrop.reduced_dimensions":"Уменьшенная копия: {w}×{h} px.","backdrop.use_downscaled":"Загрузить уменьшенную копию","backdrop.reducing":"Уменьшаем…","backdrop.keep_original":"Оставить оригинал","backdrop.too_large_title":"Изображение слишком большое","backdrop.too_large_body":"Изображение превышает возможности браузера ({w}×{h}, предел {limit} px по стороне). Уменьшите его в редакторе на компьютере и загрузите снова.","backdrop.downscale_failed":"Не удалось создать уменьшенную копию. Текущий план не изменён."}},{code:"de",nativeLabel:"Deutsch",loadDictionary:async function(e){const t=0===e?await import("./de-BkROu8Tw.js"):await import(new URL("./de-BkROu8Tw.js?retry",import.meta.url).href);return{dictionary:t.dictionary,fingerprint:t.fingerprint}}},{code:"fr",nativeLabel:"Français",loadDictionary:async function(e){const t=0===e?await import("./fr-C03DhXy5.js"):await import(new URL("./fr-C03DhXy5.js?retry",import.meta.url).href);return{dictionary:t.dictionary,fingerprint:t.fingerprint}}}],lu=iu,cu=new Set;const hu=new class{constructor(e,t,i=console.warn,n){this.entries=e,this.expectedFingerprint=t,this.warn=i,this.loadFailed=n,this.dictionaries=new Map,this.pending=new Map,this.failed=new Set;for(const t of e)t.dictionary&&this.dictionaries.set(t.code,t.dictionary)}state(e){return this.dictionaries.has(e)?"ready":this.failed.has(e)?"fallback":"pending"}dictionary(e){return this.dictionaries.get(e)}ensure(e){if("pending"!==this.state(e))return Promise.resolve();const t=this.pending.get(e);if(t)return t;const i=this.entries.find(t=>t.code===e),n=this.load(i).finally(()=>this.pending.delete(e));return this.pending.set(e,n),n}async load(e){if(!e?.loadDictionary)return void(e&&this.failed.add(e.code));let t;for(const i of[0,1])try{const t=await e.loadDictionary(i);if(t.fingerprint!==this.expectedFingerprint)throw new Error(`locale fingerprint mismatch for ${e.code}`);return this.dictionaries.set(e.code,t.dictionary),void this.failed.delete(e.code)}catch(e){t=e}this.failed.add(e.code),this.warn(`[houseplan] unable to load ${e.code} locale; using English`,t),this.loadFailed?.(e.code)}}(au,"0aa082f67d7e4e87ee87e11227a79f9f754d47a470f79cea2084b6001cf18246",console.warn,function(e){for(const t of cu)t(e)});function du(e){const t=mu(e)?.code??"en";return hu.dictionary(t)??lu}function uu(e){return"string"==typeof e?e.trim().replaceAll("_","-").toLowerCase():""}const pu=new Map(au.map(e=>[uu(e.code),e]));function mu(e){return pu.get(uu(e))}function _u(e,t){const i=[{value:"",label:e},...au.map(({code:e,nativeLabel:t})=>({value:e,label:t}))],n="string"==typeof t?t:"";return n&&!i.some(e=>e.value===n)&&i.push({value:n,label:mu(n)?.nativeLabel??n}),i}function fu(e,t){return function(e,t,i,n){const r=new Map(i.map(e=>[uu(e),e])),o=r.get(uu(e));if(o)return o;const s=uu(t),a=r.get(s);return a||(r.get(s.split("-")[0]||"")??n)}(t,e?.locale?.language||e?.language,au.map(({code:e})=>e),"en")}function gu(e,t,i){return Hi(du(e)[t]??lu[t]??t,i)}function vu(e,t){const i=du(e)[t]??lu[t];return"string"==typeof i&&i.trim().length>0}function yu(e){const t=e.length/2,i=e.face.cm>0?e.face.cm/e.cellCm*e.gridPitch/2:ya(4,e.cellCm),n="gate"===e.type?Math.sin(10*Math.PI/180)*t:0;return{half:t,jambHalf:i,gateDepth:n,outlineHalf:Math.max(ya(16,e.cellCm),i+ya(8,e.cellCm),n+ya(8,e.cellCm)),hitHalf:Math.max(ya(20,e.cellCm),i+ya(10,e.cellCm),n+ya(12,e.cellCm))}}function bu(e,t,i){e.minX=Math.min(e.minX,t),e.minY=Math.min(e.minY,i),e.maxX=Math.max(e.maxX,t),e.maxY=Math.max(e.maxY,i)}function wu(e,t,i,n,r,o,s,a){const l=Math.min(s,a)*Math.PI/180,c=Math.max(s,a)*Math.PI/180,h=(e,t)=>{const i=Math.atan2(t,e),n=[l,c];for(let e=-3;e<=3;e++){const t=e*Math.PI-i,r=Math.PI/2+e*Math.PI-i;t>l&&t<c&&n.push(t),r>l&&r<c&&n.push(r)}return n};for(const s of[i,n])for(const i of[r,o])for(const n of h(s,i)){const r=Math.cos(n),o=Math.sin(n);bu(e,t+s*r-i*o,s*o+i*r)}}function ku(e){return e.type,e.flipV,e.angle,e.face,[0,0]}function xu(e,t=[0,0]){if(!("passage"!==e.type&&e.length>0&&[e.length,e.angle,t[0],t[1]].every(Number.isFinite)))return null;const{half:i,jambHalf:n}=yu(e),r=va(e.cellCm),o=1.75*r,s=1.25*r,a=.75*r,l={minX:-i-s,minY:-n-s,maxX:i+s,maxY:n+s},c={minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0};if("window"===e.type)wu(c,-i,0,i,-o,o,-90,0),wu(c,i,-i,0,-o,o,0,90),bu(c,-i-a,-i-a),bu(c,i+a,a);else if("gate"===e.type){const t=10*e.face.side;wu(c,-i,0,i,-o,o,0,t),wu(c,i,-i,0,-o,o,-t,0)}else wu(c,-i,0,e.length,-o,o,-90,0),bu(c,-i-a,-e.length-a),bu(c,i+a,a);const[h,d]=ku(e),u={...l};bu(u,c.minX+h,c.minY+d),bu(u,c.maxX+h,c.maxY+d);const p=e.flipH?-1:1,m="gate"===e.type?1:e.flipV?-1:1,_=e.angle*Math.PI/180,f=Math.cos(_),g=Math.sin(_),v={minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0};for(const e of[u.minX,u.maxX])for(const i of[u.minY,u.maxY]){const n=e*p,r=i*m;bu(v,t[0]+n*f-r*g,t[1]+n*g+r*f)}return v}function $u(e){if("passage"===e.type)return j``;const t=Math.max(0,Math.min(1,e.amount)),{half:i,jambHalf:n}=yu(e),r=va(e.cellCm),o=1.75*r,s=e.flipH?-1:1,a=e.flipV?-1:1,l="gate"===e.type?1:a,[c,h]=ku(e);let d;if("window"===e.type){const o=Math.PI/2*i,s=e.face.cm>0?j`<line class="op-glass" x1="0" y1="${-n}" x2="0" y2="${n}"
          stroke="${e.tone}" stroke-width="${1.5*r}"></line>`:j``;d=j`
      <g transform="translate(${c} ${h})">
      <path class="op-arc" d="M 0 0 A ${i} ${i} 0 0 0 ${-i} ${-i}" fill="none"
        stroke="${e.tone}" stroke-dasharray="${o}" stroke-dashoffset="${o*(1-t)}"></path>
      <path class="op-arc" d="M 0 0 A ${i} ${i} 0 0 1 ${i} ${-i}" fill="none"
        stroke="${e.tone}" stroke-dasharray="${o}" stroke-dashoffset="${o*(1-t)}"></path>
      <g transform="translate(${-i} 0)">
        <g class="op-leaf" style="transform:rotate(${-90*t}deg)">
          <rect x="0" y="${-1.5*r}" width="${i}" height="${3*r}" fill="${e.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${i} 0)">
        <g class="op-leaf" style="transform:rotate(${90*t}deg)">
          <rect x="${-i}" y="${-1.5*r}" width="${i}" height="${3*r}" fill="${e.tone}"></rect>
        </g>
      </g>
      ${s}
      </g>`}else if("gate"===e.type){const n=10*e.face.side*t;d=j`
      <g transform="translate(${c} ${h})">
      <g transform="translate(${-i} 0)">
        <g class="op-leaf" style="transform:rotate(${n}deg)">
          <rect x="0" y="${-o}" width="${i}" height="${2*o}" fill="${e.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${i} 0)">
        <g class="op-leaf" style="transform:rotate(${-n}deg)">
          <rect x="${-i}" y="${-o}" width="${i}" height="${2*o}" fill="${e.tone}"></rect>
        </g>
      </g>
      </g>`}else{const n=Math.PI/2*e.length;d=j`
      <g transform="translate(${c} ${h})">
      <path class="op-arc" d="M ${i} 0 A ${e.length} ${e.length} 0 0 0 ${-i} ${-e.length}" fill="none"
        stroke="${e.tone}" stroke-dasharray="${n}" stroke-dashoffset="${n*(1-t)}"></path>
      <g transform="translate(${-i} 0)">
        <g class="op-leaf" style="transform:rotate(${-90*t}deg)">
          <rect x="0" y="${-o}" width="${e.length}" height="${2*o}" fill="${e.tone}"></rect>
        </g>
      </g>
      </g>`}return j`<g transform="scale(${s} ${l})">
    <line x1="${-i}" y1="${-n}" x2="${-i}" y2="${n}"
      stroke="${e.base}" stroke-width="${2.5*r}"></line>
    <line x1="${i}" y1="${-n}" x2="${i}" y2="${n}"
      stroke="${e.base}" stroke-width="${2.5*r}"></line>
    ${d}
  </g>`}const Su={climate:["current_temperature","temperature","current_humidity","humidity"],water_heater:["current_temperature","temperature"],cover:["current_position"],valve:["current_position"],fan:["percentage"],humidifier:["current_humidity","humidity"],light:["brightness"],media_player:["volume_level"],vacuum:["battery_level","fan_speed"],lawn_mower:["battery_level","fan_speed"]};function Mu(e){return e?e.sourceLabel?`${e.sourceLabel}: ${e.fullText}`:e.fullText:""}const Cu=new WeakMap;function Tu(e){return e?"entity_state"===e.kind?`state:${e.entity_id}`:"entity_attribute"===e.kind?`attr:${e.entity_id}:${e.attribute}`:"derived_marker_state"===e.kind?`marker:${e.ref}`:"derived_lqi"===e.kind?"derived:lqi":"":""}function Ru(e){if("derived:lqi"===e)return{kind:"derived_lqi"};if(e.startsWith("state:"))return{kind:"entity_state",entity_id:e.slice(6)};if(e.startsWith("attr:")){const t=e.slice(5),i=t.lastIndexOf(":");if(i>0)return{kind:"entity_attribute",entity_id:t.slice(0,i),attribute:t.slice(i+1)}}return e.startsWith("marker:marker:")?{kind:"derived_marker_state",ref:e.slice(7)}:null}function Du(e,t){const i=e?.entities?.[t],n=e?.states?.[t];return String(i?.name||i?.original_name||n?.attributes?.friendly_name||t)}function zu(e){return e.replaceAll("_"," ")}function Au(e,t=1){const i=Number(e);return Number.isFinite(i)?`${Math.round(i*t)} %`:null}function Pu(e){if("derived_lqi"===e.kind)return"lqi";if("entity_attribute"===e.kind){if(e.attribute.includes("temperature"))return"temperature";if(e.attribute.includes("humidity"))return"humidity"}return"default"}function Ou(e,t,i,n=[]){let r=null,o="",s="available",a=null;if("entity_state"===i.kind){o=Du(e,i.entity_id);const t=e?.states?.[i.entity_id];if(t)if(Iu(e,i.entity_id))if(["string","number","boolean"].includes(typeof t.state))if(["unknown","unavailable"].includes(String(t.state).toLowerCase()))s="unavailable",a="missing";else{const n=Ai(e,i.entity_id);r=n?Pi(n,String(t.attributes?.unit_of_measurement||"")):null,r||(s="unavailable",a="missing")}else s="unavailable",a="non_scalar";else s="unavailable",a="missing";else s="missing",a="missing"}else if("entity_attribute"===i.kind){o=`${zu(i.attribute)} · ${Du(e,i.entity_id)}`;const t=e?.states?.[i.entity_id],n=!!t&&i.attribute in(t.attributes||{}),l=n?t.attributes?.[i.attribute]:void 0;t?Iu(e,i.entity_id)?["unknown","unavailable"].includes(String(t.state).toLowerCase())?(s="unavailable",a="missing"):n?["string","number","boolean"].includes(typeof l)?(r=function(e,t,i){const n=e?.states?.[t];if(!n||!(i in(n.attributes||{})))return null;const r=Ai(e,t,i);if(r?.formatted)return r.text;const o=n.attributes?.[i];if("brightness"===i)return Au(o,100/255);if("volume_level"===i)return Au(o,100);if(["current_position","percentage","current_humidity","humidity","battery_level"].includes(i))return Au(o);if("current_temperature"===i||"temperature"===i){const t=Number(o);if(!Number.isFinite(t))return null;const i=String(e?.config?.unit_system?.temperature||"°C");return`${Math.round(10*t)/10} ${i}`}return r?.text||(["string","number","boolean"].includes(typeof o)?String(o):null)}(e,i.entity_id,i.attribute),null==r&&(s="unavailable",a="missing")):(s="unavailable",a="non_scalar"):(s="unavailable",a="missing"):(s="unavailable",a="missing"):(s="missing",a="missing")}else if("derived_lqi"===i.kind){o="LQI";const i=jh(e,t.entities);null==i?(s="unavailable",a="missing"):r=String(i)}else{o="Light state";const t=n.find(e=>e.ref===i.ref);if(t){const i=t.on?"on":"off",n=e?.localize?.(`state.default.${i}`);r="string"==typeof n&&n?n:i,o=t.name||o}else s="missing",a="missing"}const l=e?.localize?.("state.default.unavailable")||"Unavailable";return{source:i,sourceLabel:o,text:r??"—",fullText:r??l,availability:s,isLqi:"derived_lqi"===i.kind,tone:Pu(i),failure:a}}function Fu(e,t){if(!0===t.marker?.use_climate_temp){const i=t.entities.find(t=>t.startsWith("climate.")&&Number.isFinite(Number(e?.states?.[t]?.attributes?.current_temperature)));return i?{kind:"entity_attribute",entity_id:i,attribute:"current_temperature"}:null}if("mdi:thermometer"===t.icon||"mdi:air-filter"===t.icon){const i=t.entities.find(t=>wh(e,t)&&Number.isFinite(Number(e?.states?.[t]?.state)));if(i)return{kind:"entity_state",entity_id:i}}return t.primary&&Gh(e,t.primary)&&Number.isFinite(Number(e?.states?.[t.primary]?.state))?{kind:"entity_state",entity_id:t.primary}:null}function Iu(e,t){const i=e?.entities?.[t];if(i&&!dh(i))return!1;const n=i?.device_id?e?.devices?.[i.device_id]:null;return!n||dh(n)}function Eu(e,t){return Iu(e,t)&&!!e?.states?.[t]}function Hu(e,t,i=[t]){const n=function(e,t){const i=e=>[e.id,e.primary,e.hidden?1:0,e.userHidden?1:0,e.entities.join(","),(e.controls||[]).join(","),e.marker?.binding||"",!0===e.marker?.is_light?1:0,e.marker?.light_entity||"",(e.marker?.controls||[]).join(",")].join("|");return`${i(e)}\n${t.map(i).join("\n")}`}(t,i),r=Cu.get(t);if(r&&r.states===(e?.states||null)&&r.entities===(e?.entities||null)&&r.devices===(e?.devices||null)&&r.signature===n)return r.result;const o=new Set(t.entities);for(const e of t.controls||[])e.startsWith("marker:")||o.add(e);const s=[],a=Bh(e,i),l=a.filter(e=>e.key.startsWith("marker:")).map(e=>({ref:e.key,on:e.on,name:e.device?.name||e.key})),c=i=>{const n=Tu(i);if(s.some(e=>e.key===n))return;const r=Ou(e,t,i,l),o="entity_attribute"===i.kind?`${i.entity_id} · ${i.attribute}`:"entity_state"===i.kind?i.entity_id:"derived_marker_state"===i.kind?i.ref:"LQI";s.push({key:n,source:i,label:r.sourceLabel,technical:o,value:r.text,available:"available"===r.availability})};for(const t of[...o].sort()){if(!Eu(e,t))continue;const i=t.split(".")[0],n=e?.entities?.[t];if("button"===i||"event"===i||"config"===n?.entity_category)continue;c({kind:"entity_state",entity_id:t});const r=e?.states?.[t];for(const e of Su[i]||[])e in(r?.attributes||{})&&c({kind:"entity_attribute",entity_id:t,attribute:e})}const h=new Set((t.marker?.controls||t.controls||[]).filter(e=>e.startsWith("marker:")));!0===t.marker?.is_light&&t.marker.id&&h.add(`marker:${t.marker.id}`);const d=new Set(a.map(e=>e.key));for(const e of[...h].sort())d.has(e)&&c({kind:"derived_marker_state",ref:e});return t.virtual||null==jh(e,t.entities)||c({kind:"derived_lqi"}),Cu.set(t,{states:e?.states||null,entities:e?.entities||null,devices:e?.devices||null,signature:n,result:s}),s}function Nu(e,t,i){const n=Fu(e,t);if(n&&i.some(e=>e.key===Tu(n)))return n;const r=t.primary&&i.find(e=>e.key===`state:${t.primary}`);if(r)return r.source;const o=[e=>e.technical.includes("temperature"),e=>e.technical.includes("humidity"),e=>e.technical.includes("battery")];for(const e of o){const t=i.find(e);if(t)return t.source}return i.find(e=>"derived_lqi"!==e.source.kind)?.source||i[0]?.source||null}function Lu(e){return e.touched?{value_badge:{enabled:e.enabled,source:e.source,position:e.position}}:e.originalHas?{value_badge:e.original}:{}}function Bu(e){return e.touched?e.source?{value_source:e.source}:{}:e.originalHas?{value_source:e.original}:{}}function qu(e,t,i){return{kind:"none",reason:"none",generation:e,expiresAt:null,color:t,diameterScale:i,animated:!1,reducedMotionIndicator:"none"}}function Wu(e,t,i,n,r=null){return{kind:t,reason:"short"===t?"event":"running",generation:Math.max(1,Math.trunc(i)),expiresAt:"short"===t?r:null,color:e.color,diameterScale:n?1:e.diameterScale,animated:!n,reducedMotionIndicator:n?"dot":"none"}}const ju={availability:"available",status:"neutral",activity:"none"};function Uu(e){return e<=40?"low":e<180?"mid":"high"}function Vu(e){return Ot(e)}function Gu(e){return"static_icon"===e.display?"neutral":"alarm"===e.visual.status?"alarm":"unavailable"===e.visual.availability?"unavailable":e.lockState?e.lockState:"working"===e.visual.status?"working":"open"===e.visual.status?"open":"neutral"}const Ku={sourceKind:"none",decisionIds:["source.skipped_static_fast_path"],visualSources:[],criticalSources:[],samples:[]};function Yu(e,t){const i=e?.entities?.[t],n=e?.states?.[t];return String(i?.name||i?.original_name||n?.attributes?.friendly_name||t)}function Xu(e,t){const i=e?.states?.[t];if(!i)return"";if("function"==typeof e?.formatEntityState)try{const t=e.formatEntityState(i);if("string"==typeof t&&t)return t}catch{}return String(i.state??"")}function Zu(e,t){if(t.virtual||"virtual"===t.bindingKind||"virtual"===t.marker?.binding)return"available";const i=t.entities||[],n="ha_disabled"===t.bindingStatus?.kind||(t.bindingStatus?.allEntityIds?.length??0)>0;if(0===i.length&&!n&&("device"===t.bindingKind||t.marker?.binding?.startsWith("device:"))&&"active"===t.bindingStatus?.kind)return"available";return i.some(t=>{const i=String(e?.states?.[t]?.state??"").trim().toLowerCase();return""!==i&&"unknown"!==i&&"unavailable"!==i})?"available":"unavailable"}function Ju(e,t,i,n){return{eid:t,role:i,name:Yu(e,t),state:String(e?.states?.[t]?.state??""),stateText:Xu(e,t),integrationDomain:e?.entities?.[t]?.platform||null,sample:n||Ec(e,t)}}function Qu(e,t,i=[t],n,r=e){const o=t.hidden&&t.userHidden?{...t,hidden:!1}:t;let s="none",a=[];const l=[],c=[...o.entities,...o.allEntities||[]].some(e=>e.startsWith("cover."))?{...o,tapAction:"cover"}:o,h=(d=Ed({hass:e,devices:i,device:c,lightSources:n,registryHass:r}),"cover"!==d?.semantics?null:d.targets[0]?.entityId||d.skippedTargets[0]?.entityId||null);var d;const u=Bh(e,[o]),p=Ch(o.marker?.binding,o.marker?.controls??o.controls,o.entities),m=new Set(p.filter(e=>e.startsWith("marker:"))),_=!0===o.marker?.is_light||m.size>0?n||Bh(e,i):u,f=_.filter(e=>e.device.id===o.id&&"controls"!==e.via),g=u.filter(e=>"controls"!==e.via),v=f.length?f:g,y=Gc(o.marker),b=y?[...v]:[...u.filter(e=>"controls"===e.via),...v];if(m.size)for(const e of _){if(!m.has(e.key))continue;e.stateEids.length>0&&b.some(t=>t.stateEids.some(t=>e.stateEids.includes(t)))||b.some(t=>t.key===e.key)||b.push({...e,via:"controls",castsGlow:!1})}const w=$h(r,o.entities),k=!!h&&("cover"===o.tapAction||o.primary?.startsWith("cover.")||w.some(e=>e.startsWith("cover.")));if(h&&!k&&l.push("source.cover_capability_bypassed"),k)s="cover",l.push("source.cover"),a=[Ju(e,h,"cover")];else if(b.length)s=!y&&b.some(e=>"controls"===e.via)?"controls":"light",y?l.push("source.manual_virtual_light"):l.push("controls"===s?"source.controls":"source.owned_light"),"controls"!==s||!o.virtual&&"virtual"!==o.bindingKind||l.push("source.virtual_controller"),a=b.map(i=>{const n="controls"===i.via?"control":"forced"===i.via?"forced_light":"light";if(!i.passive)return Ju(e,i.eid,n);const r=i.on?"on":"off";return{eid:i.key,role:n,name:t.name,state:r,stateText:r,integrationDomain:null,sample:{eid:i.key,state:r,availability:"available",status:i.on?"working":"neutral",activity:"none",edge:"none"}}});else{const t=$h(r,o.entities),i=t.length?t:o.entities.filter(t=>!!e?.states?.[t]);if(i.length){s="device_role",l.push("source.device_role");const t=Hc(r===e?e:{...r,states:e?.states||{}},i,o.entities),n=i.some(e=>Oc(r,e));a=t.map(t=>{const i=n?Fc(r,t.eid)?"power_gate":Oc(r,t.eid)?"lifecycle":"device_role":"device_role";return Ju(e,t.eid,i,t)})}else o.primary?(s="primary",l.push("source.primary_fallback"),a=[Ju(e,o.primary,"primary")]):l.push("source.none")}p.length>0&&"controls"!==s&&"light"!==s&&"cover"!==s&&l.push("source.filtered_saved_controls");const x=[];for(const t of o.entities||[]){const i=Ec(e,t);"alarm"!==i.status||a.some(e=>e.eid===t)||x.push(Ju(e,t,"critical",i))}return x.length&&l.push("source.critical_sibling"),{sourceKind:s,decisionIds:l,visualSources:a,criticalSources:x,samples:[...a,...x].map(e=>e.sample)}}function ep(e,t,i,n,r=[]){if(t.virtual)return{source:null,text:null,fullText:null,fallback:"value_virtual",explicit:!1};const o=t.marker?.value_source;if(o){const i=Ou(e,t,o,r);return{source:{kind:"derived_lqi"===o.kind?"derived_lqi":"derived_marker_state"===o.kind?"derived_marker_state":"entity_attribute"===o.kind&&o.attribute.includes("temperature")?"temperature":"entity_attribute"===o.kind&&o.attribute.includes("humidity")?"humidity":"entity",eid:"entity_state"===o.kind||"entity_attribute"===o.kind?o.entity_id:"derived_marker_state"===o.kind?o.ref:"derived:lqi",attribute:"entity_attribute"===o.kind?o.attribute:void 0,text:i.text,sourceKey:Tu(o)},text:i.text,fullText:i.fullText,fallback:"non_scalar"===i.failure?"value_non_scalar":"missing"===i.failure?"value_no_state":null,explicit:!0}}if(n){const i=function(e,t){if(!0!==t.marker?.use_climate_temp)return null;for(const i of t.entities){if(!i.startsWith("climate."))continue;const t=Number(e?.states?.[i]?.attributes?.current_temperature);if(Number.isFinite(t))return{eid:i,text:Math.round(10*t)/10+"°"}}return null}(e,t);if(i)return{source:{kind:"temperature",eid:i.eid,attribute:"current_temperature",text:i.text,sourceKey:`attr:${i.eid}:current_temperature`},text:i.text,fullText:i.text,fallback:null,explicit:!1};const n=function(e,t){if("mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon)return null;for(const i of t.entities){if(!wh(e,i))continue;const t=Number(e?.states?.[i]?.state);if(Number.isFinite(t))return{eid:i,text:Math.round(10*t)/10+"°"}}return null}(e,t);if(n)return{source:{kind:"temperature",eid:n.eid,text:n.text,sourceKey:`state:${n.eid}`},text:n.text,fullText:n.text,fallback:null,explicit:!1};const r=function(e,t){if(!t.primary||!Gh(e,t.primary))return null;const i=Number(e?.states?.[t.primary]?.state);return Number.isFinite(i)?{eid:t.primary,text:`${Math.round(i)}%`}:null}(e,t);if(r)return{source:{kind:"humidity",eid:r.eid,text:r.text,sourceKey:`state:${r.eid}`},text:r.text,fullText:r.text,fallback:null,explicit:!1}}const s=i.visualSources.filter(e=>!e.eid.startsWith("marker:"));let a=s.map(e=>e.eid);const l=s.find(e=>"power_gate"===e.role);if(l&&(a=[l.eid]),!a.length&&i.visualSources.some(e=>e.eid.startsWith("marker:"))&&(a=$h(e,t.entities),!a.length&&t.primary&&e?.states?.[t.primary]&&(a=[t.primary])),a=[...new Set(a)],1!==a.length)return{source:null,text:null,fullText:null,fallback:a.length?"value_ambiguous_sources":"value_no_state",explicit:!1};const c=a[0],h=function(e,t){const i=e?.states?.[t];if(!i||null==i.state||""===String(i.state).trim())return{text:"",fallback:"value_no_state"};const n=i.state;if(!["string","number","boolean"].includes(typeof n))return{text:"",fallback:"value_non_scalar"};const r=String(n).trim().toLowerCase();if("unknown"===r||"unavailable"===r)return{text:"",fallback:"value_no_state"};const o=Ai(e,t);return o?{text:Pi(o,String(i.attributes?.unit_of_measurement||"")),fallback:null}:{text:"",fallback:"value_no_state"}}(e,c);return h.fallback?{source:null,text:null,fullText:null,fallback:h.fallback,explicit:!1}:{source:{kind:"entity",eid:c,text:h.text,sourceKey:`state:${c}`},text:h.text,fullText:h.text,fallback:null,explicit:!1}}function tp(e,t,i){const n=e.marker?.binding||(e.bindingKind&&e.bindingRef?`${e.bindingKind}:${e.bindingRef}`:e.virtual?"virtual":""),r=[...t.visualSources.map(e=>`${e.role}:${e.eid}`),...t.criticalSources.map(e=>`critical:${e.eid}`)].sort(),o=i?`${i.kind}:${i.sourceKey}:${i.eid}:${i.attribute||""}`:"none";return[n,t.sourceKind,...r,`value:${o}`].join("\n")}function ip(e,t,i){return tp(t,i||Qu(e,t),null).replace(/\nvalue:none$/,"")}function np(e){if(e.effectiveHidden)return[];if("static_icon"===e.display)return["static-icon"];const t=[],{visual:i}=e;return"alarm"===e.pulse.kind?t.push("alarm"):"unavailable"===i.availability?t.push("unavail"):"working"===i.status?t.push("on"):"open"===i.status&&t.push("open"),e.lockState&&t.push(`lock-${e.lockState}`),"none"!==e.pulse.reason&&"alarm"!==e.pulse.reason&&t.push("activity-"+e.pulse.reason),e.pulse.generation%2==0&&(t.push("pulse-gen2"),"short"===e.pulse.kind&&t.push("activity-gen2")),t}function rp(e,t,i){const n=ki(t.marker?.display),r="static_icon"===n,o=r&&!1===i.sourceDetails?Ku:Qu(e,t,i.lightDevices||[t],i.lightSources,i.registryHass||e),s="derived_marker_state"===t.marker?.value_source?.kind||"derived_marker_state"===t.marker?.value_badge?.source?.kind,a=(i.lightSources||(s?Bh(e,i.lightDevices||[t]):[])).filter(e=>e.key.startsWith("marker:")).map(e=>({ref:e.key,on:e.on,name:e.device.name})),l=t.bindingStatus,c="ha_disabled"===l?.kind,h="orphaned"===l?.kind,d=c?"ha_disabled":h?"orphaned":"active",u=!0===t.userHidden||!0===t.marker?.hidden,p=Nc(o.samples),m=o.visualSources.find(e=>e.eid.startsWith("lock.")),_=m?["unlocked","open"].includes(m.state.toLowerCase())?"unlocked":"locked"===m.state.toLowerCase()?"locked":null:null,f=!Gc(t.marker)&&Ch(t.marker?.binding,t.marker?.controls??t.controls,t.entities).length>0,g="controls"===o.sourceKind||f&&"light"!==o.sourceKind&&"cover"!==o.sourceKind,v=r&&!1===i.sourceDetails?{source:null,text:null,fullText:null,fallback:null}:ep(e,t,o,i.showTemperature,a),y=tp(t,o,v.source),b=ip(e,t,o),w=i.activityRuntime,k=i.now??Date.now(),x=w?.expiresAt||(w?.flashTs?w.flashTs+3300:0),$=w?.sources===b&&w.flashTs&&w.flashKind&&x>k?w.flashKind:null,S=function(e){const t=[],i="ha_disabled"===e.bindingLifecycle||"orphaned"===e.bindingLifecycle;let n=!1;"ha_disabled"===e.bindingLifecycle?(n=!0,t.push("lifecycle.ha_disabled_hidden")):e.userHidden&&!e.designPreview?(n=!0,t.push("lifecycle.user_hidden")):e.userHidden?t.push("lifecycle.user_hidden_preview"):"orphaned"===e.bindingLifecycle?t.push("lifecycle.orphaned_diagnostic"):t.push("lifecycle.active");const r="static_icon"===e.display;let o=e.controllerFace?{...e.sourceVisual,availability:e.controllerAvailability}:e.sourceVisual;t.push(e.controllerFace?"available"===e.controllerAvailability?"availability.controller_available":"availability.controller_unavailable":"availability.source"),n?(o=ju,t.push("face.hidden")):r?(o=ju,t.push("face.static")):"alarm"===e.sourceVisual.status||e.liveStates?t.push("face.dynamic"):(o=ju,t.push("face.live_states_disabled")),!r&&!n&&e.liveStates&&"alarm"!==e.sourceVisual.status&&e.shortActivity&&(o={...o,activity:e.shortActivity},t.push(`activity.short_${e.shortActivity}`)),"alarm"===o.status?t.push("status.alarm"):"unavailable"===o.availability?t.push("status.unavailable"):"working"===o.status?t.push("status.working"):"open"===o.status?t.push("status.open"):t.push("status.neutral");const s="value"===e.display&&!n&&e.valueAvailable?"value":"icon";t.push("value"===s?"content.value":"value"===e.display?"content.value_fallback_icon":"content.icon"),"value"===e.display&&!e.valueAvailable&&e.valueFallback&&t.push(`content.${e.valueFallback}`);const a=e.liveStates&&!r&&!n,l=!r&&!n,c=!n&&!i&&!r&&"available"===o.availability&&("alarm"===o.status||e.liveStates&&"icon_ripple"===e.display),h=l&&e.vacuumLiveRequested;return t.push(a?"diagnostics.dynamic_icon":"diagnostics.base_icon"),t.push(l?"diagnostics.metrics_enabled":"diagnostics.metrics_suppressed"),t.push(c?"activity.pulse_eligible":"activity.pulse_suppressed"),t.push(h?"diagnostics.vacuum_live":"diagnostics.vacuum_static"),{effectiveHidden:n,bindingUnavailable:i,visual:o,face:s,dynamicIcon:a,metrics:l,liveColor:a,pulseEligible:c,vacuumLive:h,decisionIds:t}}({bindingLifecycle:d,userHidden:u,designPreview:!0===i.designPreview,display:n,liveStates:i.liveStates,sourceVisual:p,controllerFace:g,controllerAvailability:g?Zu(e,t):"available",shortActivity:$,valueAvailable:null!=v.text,valueFallback:v.fallback,vacuumLiveRequested:!0===t.marker?.vacuum?.live}),{effectiveHidden:M,visual:C}=S,T="icon_ripple"===n&&!M&&i.liveStates&&"alarm"!==C.status?C.activity:"none",R=S.metrics&&i.showTemperature?!0===t.marker?.use_climate_temp?Vh(e,t.entities):"mdi:thermometer"===t.icon||"mdi:air-filter"===t.icon?Uh(e,t.entities):null:null,D=S.metrics&&i.showTemperature&&t.primary&&Gh(e,t.primary)?Kh(e,t.entities):null,z=S.metrics&&i.showSignal&&!t.virtual?jh(e,t.entities):null,A=function(e,t,i){const n=null!=t.marker?.value_badge;if(i.effectiveHidden||"static_icon"===i.display)return null;const r=t.marker?.value_badge;if(n)return r?.enabled?r.source?{configured:!0,enabled:!0,position:r.position||"right",...Ou(e,t,r.source,i.markerStates)}:{configured:!0,enabled:!0,source:null,sourceLabel:"",text:"—",fullText:e?.localize?.("state.default.unavailable")||"Unavailable",position:r.position||"right",availability:"missing",isLqi:!1,tone:"default",failure:"missing"}:null;if(!i.showTemperature||"value"===i.display)return null;const o=Fu(e,t);if(!o)return null;let s=null,a="default";if("entity_attribute"===o.kind&&"current_temperature"===o.attribute){const i=Vh(e,t.entities);null!=i&&(s=`${i}°`),a="temperature"}else if("mdi:thermometer"===t.icon||"mdi:air-filter"===t.icon){const i=Uh(e,t.entities);null!=i&&(s=`${i}°`),a="temperature"}else{const i=Kh(e,t.entities);null!=i&&(s=`${i}%`),a="humidity"}return null==s?null:{configured:!1,enabled:!0,source:o,position:"right",sourceLabel:"entity_attribute"===o.kind?`${zu(o.attribute)} · ${Du(e,o.entity_id)}`:"entity_state"===o.kind?Du(e,o.entity_id):"",text:s,fullText:s,availability:"available",isLqi:!1,tone:a,failure:null}}(e,t,{showTemperature:i.showTemperature,showSignal:i.showSignal,display:n,effectiveHidden:M,markerStates:a}),P=o.visualSources.find(e=>!e.eid.startsWith("marker:")),O="cover"===o.sourceKind?P?.eid:t.primary||P?.eid,F=O?e?.states?.[O]:null,I=S.dynamicIcon?nn(t.icon,O?.split(".")[0],F?.attributes?.device_class,F?.state,!!t.marker?.icon):t.icon,E=S.liveColor&&o.visualSources.filter(e=>!e.eid.startsWith("marker:")).map(t=>function(e){return e&&"on"===e.state?Pt(e.attributes?.rgb_color):null}(e?.states?.[t.eid])).find(e=>!!e)||null,H=Number(t.marker?.size)>0?Number(t.marker.size):1,N=Number(t.marker?.angle)||0,L=Number(t.marker?.ripple_size)>0?Number(t.marker.ripple_size):1.5,B=Dt(t.marker?.ripple_color,null),q=r?null:B||E||null,W=function(e){const{display:t,visual:i,semanticActivity:n,liveStates:r,effectiveHidden:o,bindingUnavailable:s=!1,reducedMotion:a=!1}=e,l=Math.max(1,Math.trunc(e.shortGeneration||1)),c=Number.isFinite(e.diameterScale)?Math.max(1,Number(e.diameterScale)):1.5,h=e.color||function(e,t){return"presence"===t?"#1DC21D":"running"===t||"working"===e.status||"open"===e.status?"#F0A00C":"#0C82F0"}(i,n);if(o||s||"unavailable"===i.availability||"static_icon"===t)return qu(l,h,c);if("alarm"===i.status)return{kind:"alarm",reason:"alarm",generation:l,expiresAt:null,color:"#F0410C",diameterScale:1.5,animated:!a,reducedMotionIndicator:"none"};if(!r||"icon_ripple"!==t)return qu(l,h,c);const d=e.now??Date.now(),u=e.shortExpiresAt||null;return e.shortReason&&null!=u&&u>d?{kind:"short",reason:e.shortReason,generation:l,expiresAt:u,color:h,diameterScale:a?1:c,animated:!a,reducedMotionIndicator:a?"dot":"none"}:"presence"===n||"transition"===n||"running"===n?{kind:"continuous",reason:n,generation:l,expiresAt:null,color:h,diameterScale:a?1:c,animated:!a,reducedMotionIndicator:a?"dot":"none"}:qu(l,h,c)}({display:n,visual:C,semanticActivity:p.activity,shortReason:w?.sources===b?w?.flashKind:null,shortGeneration:w?.gen,shortExpiresAt:w?.sources===b?x:null,now:k,liveStates:i.liveStates,effectiveHidden:M,bindingUnavailable:S.bindingUnavailable,reducedMotion:i.reducedMotion,color:q,diameterScale:L}),j="value"===S.face?v.text:null,U="ha_disabled"===l?.kind?l.reason:null,V="ha_disabled"===(G={lifecycle:d,display:n,liveStates:i.liveStates,sourceKind:o.sourceKind,primaryDomain:(t.primary||"").split(".")[0],visual:C,activity:T}).lifecycle?"ha_disabled":"orphaned"===G.lifecycle?"orphaned":"static_icon"===G.display?"static_icon":"alarm"===G.visual.status?"alarm":G.liveStates?"unavailable"===G.visual.availability?"unavailable":"cover"===G.sourceKind?"cover_icon_state":"presence"===G.activity?"presence":"event"===G.activity?"event":"transition"===G.activity?"transition":"working"===G.visual.status?"icon_ripple"===G.display&&"none"!==G.activity?"working_activity":"working":"open"===G.visual.status?"open":"media_player"===G.primaryDomain?"media_neutral":"neutral":"live_states_disabled";var G;const K=[];i.designPreview&&u&&K.push("hidden_design_preview"),r||!0!==t.marker?.vacuum?.live||K.push("vacuum_live_plan_only");const Y=o.visualSources.some(t=>"power_gate"===t.role||Fc(e,t.eid)),X=t.entities.filter(t=>t.startsWith("switch.")&&!e?.entities?.[t]?.entity_category).length;Y&&X>1&&K.push("composite_power_source"),"icon_ripple"!==n&&"static_icon"!==n&&"alarm"!==p.status&&"none"!==p.activity&&K.push("activity_display_disabled");const Z={binding:t.marker?.binding||(t.bindingKind&&t.bindingRef?`${t.bindingKind}:${t.bindingRef}`:t.virtual?"virtual":""),sourceKind:o.sourceKind,visualSources:o.visualSources,criticalSources:o.criticalSources,valueSource:v.source,sourceSignature:y,decisionIds:[...o.decisionIds,...S.decisionIds,...A?["diagnostics.value_badge"]:[],...null==z?[]:[`diagnostics.lqi_${Uu(z)}`],`pulse.${W.kind}_${W.reason}`],visual:C,lockState:_,display:n,icon:I,valueText:j,valueFullText:"value"===S.face?v.fullText:null,fallbackReason:"value"===n?v.fallback:null,activity:T,activityGeneration:w?.gen||1,pulse:W,classes:[],tempText:null==R?null:String(R),humText:null==D?null:String(D),valueBadge:A,lqiText:null==z||A?.isLqi||"derived_lqi"===v.source?.kind?null:String(z),lqiColor:null==z?null:Vu(z),lqiBand:null==z?null:Uu(z),lightColor:E,scale:H,angle:N,rippleScale:L,rippleColor:q,userHidden:u,effectiveHidden:M,haDisabled:c,disabledReason:U,orphaned:h,vacuumLive:S.vacuumLive,explanation:{reason:V,notices:K}};return{...Z,classes:np(Z)}}function op(e,t=new WeakMap){if(null===e||"object"!=typeof e)return e;const i=e,n=t.get(i);if(n)return n;if(Array.isArray(e)){const n=[];t.set(i,n);for(const i of e)n.push(op(i,t));return Object.freeze(n)}const r={};t.set(i,r);for(const[i,n]of Object.entries(e))"function"!=typeof n&&(r[i]=op(n,t));return Object.freeze(r)}function sp(e){const t=new Map(e);let i;return i=Object.freeze({get size(){return t.size},get:e=>t.get(e),has:e=>t.has(e),entries:()=>t.entries(),keys:()=>t.keys(),values:()=>t.values(),forEach:(e,n)=>t.forEach((t,r)=>e.call(n,t,r,i)),[Symbol.iterator]:()=>t[Symbol.iterator]()}),i}function ap(e){const t=new Set(e.entityIds||[]),i=new Set(e.deviceIds||[]),n=new Set(e.areaIds||[]);for(const n of e.devices){for(const e of n.entities||[])t.add(e);n.primary&&t.add(n.primary);for(const e of n.controls||[])t.add(e);n.marker?.vacuum?.source&&t.add(n.marker.vacuum.source),"device"===n.bindingKind&&n.bindingRef&&i.add(n.bindingRef),"entity"===n.bindingKind&&n.bindingRef&&t.add(n.bindingRef)}const r={},o={};for(const[o,s]of Object.entries(e.hass?.entities||{})){const a=s?.device_id?e.hass?.devices?.[s.device_id]:null;(t.has(o)||s?.device_id&&i.has(s.device_id)||n.has(s?.area_id)||n.has(a?.area_id))&&(t.add(o),r[o]=s,s?.device_id&&i.add(s.device_id))}for(const t of i){const i=e.hass?.devices?.[t];i&&(o[t]=i)}const s={};for(const i of t){const t=e.hass?.states?.[i];t&&(s[i]=t)}const a=Object.freeze({states:op(s),entities:op(r),devices:op(o),config:op(e.hass?.config),locale:op(e.hass?.locale),themes:op(e.hass?.themes)});return Object.freeze({sourceSequence:e.sourceSequence,capturedAt:e.capturedAt??Date.now(),hass:a,devices:op([...e.devices]),positions:sp([...e.positions||[]].map(([e,t])=>[e,Object.freeze({x:t.x,y:t.y})])),presentations:sp([...e.presentations].map(([e,t])=>[e,op(t)])),facts:sp([...e.facts||[]].map(([e,t])=>[e,op(t)]))})}const lp=(e,t)=>`${e}:${t?1:0}`;function cp(e){return"boolean"==typeof e?.themes?.darkMode?e.themes.darkMode?"theme-dark":"theme-light":""}function hp(e){const t=[];if(1!==e.scale&&t.push(`--dev-scale:${e.scale}`),"none"!==e.pulse.kind){t.push(`--ripple-scale:${e.pulse.diameterScale}`);const r=(i=e.pulse.color,n=null,"string"==typeof i&&(Rt.test(i)||At.test(i))?i:n);r&&t.push(`--ripple-color:${r}`)}var i,n;return t}function dp(e){const t=[...String(e)].reduce((e,t)=>/\s/.test(t)?e+.35:e+(t.codePointAt(0)>255?1:.62),0);return t<=8?.45:Math.max(.25,Math.round(3.6/t*1e3)/1e3)}function up(e,t){const i=e.pulse,n=i.generation%2==0,r=function(e){const t=e.valueBadge;if(!t||!1!==t.configured)return[];const i=[];return null!=e.tempText&&"temperature"!==t.tone&&i.push({kind:"temperature",text:e.tempText,suffix:"°"}),null!=e.humText&&"humidity"!==t.tone&&i.push({kind:"humidity",text:e.humText,suffix:"%"}),i}(e),o=e.valueBadge,s=o?.position||"right",a=!!o||r.length>0,l=["device-shell",null!=e.valueText?"text-shell":"",a?`with-values pos-${s}`:"",r.length?"with-legacy":""].filter(Boolean).join(" ");return W`
    ${"none"!==i.kind&&"dot"!==i.reducedMotionIndicator?W`<span class="device-pulse activity-ring ${i.kind} ${i.reason} reason-${i.reason} ${n?"gen2":""}"
          aria-hidden="true"><i></i><i></i><i></i></span>`:V}
    ${"dot"===i.reducedMotionIndicator?W`<span class="activity-dot" aria-hidden="true"></span>`:V}
    ${t.newDevice?W`<span class="newdot" title=${t.newDeviceTitle||""} aria-hidden="true"></span>`:V}
    ${e.haDisabled?W`<span class="habadge" title=${t.disabledTitle||""} aria-hidden="true"><ha-icon icon="mdi:power-plug-off-outline"></ha-icon></span>`:V}
    <span class=${l} aria-hidden="true">
      <span class="device-shell-frame"></span>
      <span class="device-core">
        ${null!=e.valueText?W`<span class="valtext" title=${e.valueFullText||e.valueText}
              style=${`--value-font-scale:${dp(e.valueFullText||e.valueText)}`}
            >${e.valueText}</span>`:W`<ha-icon icon=${e.icon}
              style=${e.angle?`transform:rotate(${e.angle}deg)`:V}></ha-icon>`}
      </span>
      ${a?W`<span class="device-sections">
        ${o?W`<span
              class=${function(e){return`value-badge pos-${e.position} ${e.availability} tone-${e.tone}`}(o)}
              title=${Mu(o)}
              style=${`--value-font-scale:${dp(o.fullText||o.text)}`}
            >${o.text}</span>`:V}
        ${r.map(e=>W`<span
          class="value-badge legacy-secondary available tone-${e.kind}"
          title=${e.text+e.suffix}
          style=${`--value-font-scale:${dp(e.text+e.suffix)}`}
        >${e.text}${e.suffix}</span>`)}
      </span>`:V}
    </span>
    ${null!=e.lqiText?W`<span class="${function(e){return"lqi"+("bottom"===e?.position?" below-value-badge":"")}(e.valueBadge)}${e.lqiBand?` band-${e.lqiBand}`:""}"
          style=${e.lqiColor?`color:${e.lqiColor}`:V}>${e.lqiText}</span>`:V}
  `}function pp(e){return!Number.isFinite(e)||e<=0?2.25:e/2.5*2.25}function mp({openings:e,geometries:t,fillsByRoomId:i,idPrefix:n="data",groupClass:r="opening-tunnels",dataLayer:o="data"}){const s=e.map((e,r)=>{const o=t[r];if(!o)return V;const s=o.faces.find(e=>-1===e.side),a=o.faces.find(e=>1===e.side);if(!s||!a)return V;const l=i.get(s.roomId)||null,c=i.get(a.roomId)||null;if(!l&&!c)return V;const h=`${s.d} ${a.d}`,d=!!l&&!!c&&l.color===c.color&&l.opacity===c.opacity,u=`translate(${e.rx} ${e.ry}) rotate(${e.angle})`;if(d)return j`<path class="opening-tunnel" data-hp="opening-tunnel" data-id=${e.id} data-kind=${e.type}
        data-wall-key=${o.wallKey} aria-hidden="true" pointer-events="none"
        transform=${u} d=${h} fill=${l.color}
        fill-opacity=${l.opacity} fill-rule="nonzero"></path>`;const p=o.maxY-o.minY;if(!(p>0))return V;const m=`${(100*Math.max(0,Math.min(1,-o.minY/p))).toFixed(6)}%`,_=l||{color:"#000000",opacity:0},f=c||{color:"#000000",opacity:0},g=`hp-opening-tunnel-${n.replace(/[^a-zA-Z0-9_-]/g,"-")}-${r}`;return j`<g class="opening-tunnel" data-hp="opening-tunnel" data-id=${e.id} data-kind=${e.type}
      data-wall-key=${o.wallKey} aria-hidden="true" pointer-events="none"
      transform=${u}>
      <defs><linearGradient id=${g} gradientUnits="userSpaceOnUse"
        x1="0" y1=${o.minY} x2="0" y2=${o.maxY}>
        <stop offset="0%" stop-color=${_.color} stop-opacity=${_.opacity}></stop>
        <stop offset=${m} stop-color=${_.color} stop-opacity=${_.opacity}></stop>
        <stop offset=${m} stop-color=${f.color} stop-opacity=${f.opacity}></stop>
        <stop offset="100%" stop-color=${f.color} stop-opacity=${f.opacity}></stop>
      </linearGradient></defs>
      <path d=${h} fill=${`url(#${g})`} fill-rule="nonzero"></path>
    </g>`});return j`<g class=${r} data-layer=${o} aria-hidden="true" pointer-events="none">${s}</g>`}function _p(e,t,i){const n=i>0?i:1;return{a:[e[0]/n,e[1]/n],b:[t[0]/n,t[1]/n]}}function fp(e,t){const i=t>0?t:1;return[e.a[0]*i,e.a[1]*i,e.b[0]*i,e.b[1]*i]}function gp(e){return Array.isArray(e)&&e.length>=2&&Number.isFinite(Number(e[0]))&&Number.isFinite(Number(e[1]))}function vp(e){if(!Array.isArray(e))return[];const t=[];for(const i of e){if(!i||"object"!=typeof i)continue;const e=i;if(!gp(e.a)||!gp(e.b))continue;const n=[Number(e.a[0]),Number(e.a[1])],r=[Number(e.b[0]),Number(e.b[1])];Math.hypot(r[0]-n[0],r[1]-n[1])<.001||t.push({a:n,b:r})}return t}function yp(e,t,i,n,r=!0){const o=(e||[]).filter(e=>e?.id),s=vp(t);if(s.length)return function(e,t,i,n){const r=vp(e);if(!r.length)return[];const o=function(e,t){const i=[],n=(e||[]).filter(e=>e?.id);for(let e=0;e<n.length;e++){const r=Nt(n[e]);if(r)for(let o=e+1;o<n.length;o++){const s=Nt(n[o]);if(s)for(const a of un(r,s,t))i.push({seg:a,pair:`${n[e].id}:${n[o].id}`,a:n[e],b:n[o]})}}return i}(t,n);if(!o.length)return[];const s=[],a=Math.max(4*n,1e-6);for(const e of r){const t=fp(e,i),r=t[0],l=t[1],c=t[2]-r,h=t[3]-l,d=Math.hypot(c,h);if(d<a)continue;const u=c/d,p=h/d,m=new Map;for(const{seg:e,pair:t}of o){const i=Math.abs((e[0]-r)*p-(e[1]-l)*u),o=Math.abs((e[2]-r)*p-(e[3]-l)*u);if(i>4*n||o>4*n)continue;const s=(e[0]-r)*u+(e[1]-l)*p,c=(e[2]-r)*u+(e[3]-l)*p,h=Math.max(0,Math.min(s,c)),_=Math.min(d,Math.max(s,c));if(_-h<a)continue;const f=m.get(t)||[];f.push({lo:h,hi:_}),m.set(t,f)}for(const[e,t]of m){t.sort((e,t)=>e.lo-t.lo||e.hi-t.hi);const i=[];for(const e of t){const t=i[i.length-1];t&&e.lo<=t.hi+a?t.hi=Math.max(t.hi,e.hi):i.push({...e})}for(const t of i){const i=[r+u*t.lo,l+p*t.lo],n=[r+u*t.hi,l+p*t.hi];Math.hypot(n[0]-i[0],n[1]-i[1])<a||s.push({pair:e,seg:[i[0],i[1],n[0],n[1]]})}}}const l=[],c=Math.max(4*n,1e-6);for(const{pair:e,seg:t}of s){const i=t[2]-t[0],n=t[3]-t[1],r=Math.hypot(i,n);if(r<a)continue;let o=i/r,s=n/r;(o<-1e-12||Math.abs(o)<=1e-12&&s<0)&&(o=-o,s=-s);let h=l.find(i=>i.pair===e&&Math.abs(i.ux*s-i.uy*o)<=1e-6&&Math.abs((t[0]-i.origin[0])*i.uy-(t[1]-i.origin[1])*i.ux)<=c&&Math.abs((t[2]-i.origin[0])*i.uy-(t[3]-i.origin[1])*i.ux)<=c);h||(h={pair:e,origin:[t[0],t[1]],ux:o,uy:s,ranges:[]},l.push(h));const d=(t[0]-h.origin[0])*h.ux+(t[1]-h.origin[1])*h.uy,u=(t[2]-h.origin[0])*h.ux+(t[3]-h.origin[1])*h.uy;h.ranges.push({lo:Math.min(d,u),hi:Math.max(d,u)})}const h=[];for(const e of l){e.ranges.sort((e,t)=>e.lo-t.lo||e.hi-t.hi);const t=[];for(const i of e.ranges){const e=t[t.length-1];e&&i.lo<=e.hi+a?e.hi=Math.max(e.hi,i.hi):t.push({...i})}for(const n of t){const t=[e.origin[0]+e.ux*n.lo,e.origin[1]+e.uy*n.lo],r=[e.origin[0]+e.ux*n.hi,e.origin[1]+e.uy*n.hi];Math.hypot(r[0]-t[0],r[1]-t[1])>=a&&h.push(_p(t,r,i))}}return h}(s,e,i,n).map(e=>fp(e,i));if(!r)return[];const a=[],l=(e,t)=>(e.open_to||[]).includes(t.id)||(t.open_to||[]).includes(e.id);for(let e=0;e<o.length;e++)for(let t=e+1;t<o.length;t++){if(!l(o[e],o[t]))continue;const i=Nt(o[e]),r=Nt(o[t]);if(i&&r)for(const e of un(i,r,n))a.push(e)}return a}function bp(e,t,i,n,r){for(const o of n)if(!(Mn([e,t],o)>r)&&To([o[0],o[1]],[o[2],o[3]],i))return!0;return!1}const wp=e=>Array.isArray(e)&&e.length>=2&&Number.isFinite(Number(e[0]))&&Number.isFinite(Number(e[1])),kp=(e,t,i)=>[Number(e[0])*i,Number(e[1])*i,Number(t[0])*i,Number(t[1])*i],xp=e=>{const t=`${Number(e[0]).toFixed(9)},${Number(e[1]).toFixed(9)}`,i=`${Number(e[2]).toFixed(9)},${Number(e[3]).toFixed(9)}`;return t<=i?`${t}|${i}`:`${i}|${t}`},$p=e=>{const t=new Map;for(const i of e.flat())!Array.isArray(i)||i.length<4||!i.every(Number.isFinite)||Math.hypot(i[2]-i[0],i[3]-i[1])<=1e-9||t.set(xp(i),[...i]);return[...t.values()]};function Sp(e){return"solid"===e?.zero_wall_style?"solid":"dashed"}function Mp(e,t=1,i){const n=[];for(const r of Array.isArray(e?.wall_segments)?e.wall_segments:[])0===Number(r?.cm)&&wp(r?.a)&&wp(r?.b)&&(i&&!i.has(String(r.id||""))||n.push(kp(r.a,r.b,t)));return $p([n])}function Cp(e,t=1){const i=[];for(const n of Array.isArray(e?.partitions)?e.partitions:[])0===Number(n?.cm)&&wp(n?.a)&&wp(n?.b)&&i.push(kp(n.a,n.b,t));for(const n of Array.isArray(e?.room_drafts)?e.room_drafts:[]){const e=Array.isArray(n?.points)?n.points:[];for(let r=0;r+1<e.length;r++)0===Number(n?.segments?.[r]?.cm)&&wp(e[r])&&wp(e[r+1])&&i.push(kp(e[r],e[r+1],t))}return $p([i])}function Tp(e,t,i,n){if(!e)return[];const r=vp(e.open_spans);return yp(t,r.length?r:null,i,n,!0)}function Rp(e,t,i,n){const r=Sp(e),o=new Set;for(const e of t.rooms||[])for(const t of Array.isArray(e.wall_ids)?e.wall_ids:[])"string"==typeof t&&t&&o.add(t);const s=$p([Mp(t,1,o.size?o:void 0),Tp(e,t.rooms,i,n)]),a=$p([s,Cp(t,1)]);return{style:r,lines:a,contour:s,barriers:"solid"===r?a:[],transmissive:"dashed"===r?s:[]}}function Dp(e,t){return(e||[]).some(e=>e?.host?.kind===t.kind&&e.host.id===t.id)}function zp(e){return e instanceof Error?e.name||"Error":typeof e}function Ap(e){return Ll({id:e?.id??"",cell_cm:e?.cell_cm,rooms:e?.rooms||[],walls:e?.walls||[],wall_segments:e?.wall_segments||[],open_spans:e?.open_spans||[],openings:e?.openings||[],partitions:e?.partitions||[],room_drafts:e?.room_drafts||[],wall_columns:e?.wall_columns||[]})}function Pp(e,t,i={}){const n=(Array.isArray(e?.spaces)?e.spaces:[]).find(e=>String(e?.id||"")===String(t||"")),r=Ap(n);if(!n)return{spaceId:String(t||""),displayName:"",status:"failed",reason:"prepare-exception",fingerprint:r,ok:!1};const o=Np({...e,spaces:[n]},{...i,fingerprint:()=>r}).spaces[0]||{spaceId:String(t||""),displayName:"",status:"failed",reason:"prepare-exception"};return{...o,fingerprint:r,ok:"failed"!==o.status}}function Op(e,t,i,n=Pa,r=1e3){return(Array.isArray(e?.openings)?e.openings:[]).flatMap(e=>{const o={...e,rx:Number(e.x)*r,ry:Number(e.y)*r,rlen:Number(e.length)*r};if(!e.host||"wall"===e.host.kind)return[o];const s=Vd(e,t.partitions,r,i,n);return s.resolved?[{...e,rx:s.resolved.center[0],ry:s.resolved.center[1],rlen:s.resolved.length,angle:s.resolved.angle,partitionHost:s.resolved}]:[]})}function Fp(e,t=()=>!0){return e.flatMap(e=>e.host&&e.partitionHost&&t(e)?[Yd(e.partitionHost)]:[])}function Ip(e,t,i,n,r,o,s=Pa,a=1e3){const l=ds(t.rooms,[...i],n,r,o,s,a);return e.flatMap(e=>{const t={x:e.rx,y:e.ry,angle:Number(e.angle)||0,length:e.rlen};return e.host&&"wall"!==e.host.kind?e.partitionHost&&Jd(e.partitionHost,l,2e-4*s)?[t]:[]:[t]})}function Ep(e,t){const i=Oa,n=Pa,r=xa,o=Number.isFinite(Number(t.cellCm))&&Number(t.cellCm)>0?Number(t.cellCm):5,s=Array.isArray(e?.walls)?e.walls:[],a=function(e,t,i=Pa,n=1e3){return yp(t.rooms,e?.open_spans,n,.02*i)}(e,t,n,r),l=function(e,t,i=Pa){if(!t.length)return[];const n=e.filter(e=>e?.id),r=.02*i,o=[];for(let e=0;e<n.length;e++)for(let i=e+1;i<n.length;i++){const s=n[e],a=n[i],l=Nt(s),c=Nt(a);if(!l||!c)continue;const h=un(l,c,r);if(!h.length)continue;const d=t.filter(e=>{const t=[(e[0]+e[2])/2,(e[1]+e[3])/2];return h.some(e=>Mn(t,e)<4*r)}).map(e=>[...e]);d.length&&o.push({a:s,b:a,segs:d})}return o}(t.rooms,a,n).flatMap(e=>e.segs),c=Op(e,t,o,n,r),h=Fp(c),d=oa(t,o,n,2e-4*n,h).all;return{space:t,walls:s,openCuts:l,openings:c,roomOpenings:Ip(c,t,s,l,i,o,n,r),partitionCuts:h,physicalBodies:d,wallKeyPitch:i,cellCm:o,gridPitch:n,coordScale:r}}function Hp(e,t,i){const n="string"==typeof e?.title?e.title.trim():"",r=null==e?.id?"":String(e.id).trim();return{spaceId:r,displayName:n||r||i(t+1)}}function Np(e,t={}){const i=(t.fingerprint||Ll)(e),n=Array.isArray(e?.spaces)?e.spaces:[],r=t.fallbackSpaceName||(e=>`Space ${e}`),o=t.prepareSpace||Ep,s=t.wallPass||Ps,a=t.floorPass||Rs,l=[];for(let i=0;i<n.length;i++){const c=n[i],h=Hp(c,i,r);let d;try{const t=Ra({...e,spaces:[c]})[0];if(!t)throw new Error("missing space model");d=o(c,t)}catch(e){l.push({...h,status:"failed",reason:"prepare-exception",detail:zp(e)});continue}const u=d.walls.length>0||d.physicalBodies.length>0;if(!d.space.rooms.length&&!u){l.push({...h,status:"not-applicable"});continue}let p=null;if(u){try{p=s(d.space.rooms,d.walls,d.openCuts,d.roomOpenings,d.wallKeyPitch,d.cellCm,d.gridPitch,d.coordScale,d.physicalBodies)}catch(e){l.push({...h,status:"failed",reason:"wall-exception",detail:zp(e)});continue}if(null==p){l.push({...h,status:"failed",reason:"wall-null"});continue}if("degraded-extra"===p.status){l.push({...h,status:"failed",reason:"wall-degraded-extra"});continue}if("failed-core"===p.status){l.push({...h,status:"failed",reason:"wall-failed-core"});continue}t.captureWallGeometry?.(d,p)}if(d.space.rooms.length&&null==p?.paperGeom){let e;try{e=a(d.space.rooms,d.walls,d.openCuts,d.wallKeyPitch,d.cellCm,d.gridPitch,d.coordScale)}catch(e){l.push({...h,status:"failed",reason:"floor-exception",detail:zp(e)});continue}if(null==e){l.push({...h,status:"failed",reason:"floor-null"});continue}}l.push({...h,status:"ok"})}const c=l.filter(e=>"failed"===e.status);return{fingerprint:i,spaces:l,failures:c,ok:0===c.length}}const Lp=e=>"string"==typeof e&&e.length>0&&e.length<=500;function Bp(e){return Lp(e)&&(e.startsWith("device:")||e.startsWith("entity:"))&&e.indexOf(":")<e.length-1}function qp(e){if(!e||"object"!=typeof e||Array.isArray(e))return{};const t={};for(const[i,n]of Object.entries(e).slice(-2e4)){if(!Lp(i)||!n||"object"!=typeof n||Array.isArray(n))continue;const e=n.binding,r=n.area;Bp(e)&&Lp(r)&&(t[i]={binding:e,area:r})}return t}function Wp(e,t){const i=qp(e);for(const e of t)delete i[e];return i}function jp(e){if(e.virtual||"unverified"===e.bindingStatus?.kind)return null;if("device"!==e.bindingKind&&"entity"!==e.bindingKind||!Lp(e.bindingRef))return null;const t=`${e.bindingKind}:${e.bindingRef}`,i=e.marker;return i?.removed||function(e){return!!e&&("string"==typeof e.area&&e.area.length>0||null===e.area&&"string"==typeof e.space&&e.space.length>0&&"string"==typeof e.room_id&&e.room_id.length>0)}(i)||i&&i.binding!==t?null:"entity"!==e.bindingKind||i?t:null}function Up(e,t){return e.rooms.filter(e=>{const i=function(e){if(Array.isArray(e.poly)&&e.poly.length>=3)return e.poly;const{x:t,y:i,w:n,h:r}=e;return![t,i,n,r].every(Number.isFinite)||Number(n)<=0||Number(r)<=0?null:[[t,i],[t+n,i],[t+n,i+r],[t,i+r]]}(e);return!!i&&ti(t,i)})}function Vp(e,t){return{id:e,binding:null,area:null,relocate:!1,updateSnapshot:!1,removeSnapshot:!1,reason:t}}function Gp(e){const t=e.indexOf(":");return[e.slice(0,t),e.slice(t+1)]}function Kp(e){const t=[],i=new Set;if(!e.authoritative)return{decisions:t,relocateIds:i};const n=qp(e.snapshot);for(const i of e.cleanupSnapshotIds||[])n[i]&&t.push({...Vp(i,"registry-unverified"),removeSnapshot:!0});const r=Number.isFinite(e.coordinateScale)&&Number(e.coordinateScale)>0?Number(e.coordinateScale):1e3,o=new Map;for(const t of e.model)for(const e of t.rooms){if(!e.area)continue;const i=o.get(e.area)||[];i.push({space:t,room:e}),o.set(e.area,i)}for(const s of e.devices){const a=n[s.id],l=jp(s);if(!l){a&&t.push({...Vp(s.id,"registry-unverified"),removeSnapshot:!0});continue}const c=Lp(s.area)?s.area:null;if(!c){t.push({id:s.id,binding:l,area:null,relocate:!1,updateSnapshot:!1,removeSnapshot:!1,reason:"registry-unverified"});continue}const h=o.get(c);if(!h||1!==h.length){t.push({id:s.id,binding:l,area:c,relocate:!1,updateSnapshot:!1,removeSnapshot:!1,reason:"target-unresolved"});continue}if(a?.binding===l){const e=a.area!==c;e&&i.add(s.id),t.push({id:s.id,binding:l,area:c,relocate:e,updateSnapshot:e,removeSnapshot:!1,reason:e?"area-changed":"unchanged"});continue}const d=e.layout[s.id];if(!d){t.push({id:s.id,binding:l,area:c,relocate:!1,updateSnapshot:!0,removeSnapshot:!1,reason:"new-without-layout"});continue}const[{space:u,room:p}]=h;if(d.s&&d.s!==u.id){i.add(s.id),t.push({id:s.id,binding:l,area:c,relocate:!0,updateSnapshot:!0,removeSnapshot:!1,reason:"backfill-cross-space"});continue}if(d.s!==u.id||!Number.isFinite(d.x)||!Number.isFinite(d.y)){t.push({id:s.id,binding:l,area:c,relocate:!1,updateSnapshot:!0,removeSnapshot:!1,reason:"backfill-ambiguous"});continue}const m=Up(u,[d.x*r,d.y*r]),_=1===m.length?m[0]:null,f=_===p||!!_?.id&&!!p.id&&_.id===p.id,g=!!_?.area&&_.area!==c,v=!f&&g;v&&i.add(s.id),t.push({id:s.id,binding:l,area:c,relocate:v,updateSnapshot:!0,removeSnapshot:!1,reason:v?"backfill-stale-room":f?"backfill-same-room":"backfill-ambiguous"})}return{decisions:t,relocateIds:i}}const Yp=1,Xp=/^[0-9a-f]{64}$/,Zp=new WeakMap;function Jp(e){const t=new Set;for(const i of e?.spaces||[])for(const e of i?.decor||[])"image"===e?.kind&&Xp.test(e.asset_id)&&t.add(e.asset_id);return[...t]}function Qp(e,t,i){const n=Number(e.x)*t,r=Number(e.y)*i,o=Number(e.w)*t,s=Number(e.h)*i;if(![n,r,o,s].every(Number.isFinite)||o<=0||s<=0)return null;const a=n+o/2,l=r+s/2,c=sr(e.angle);return[n,r,o,s,or(e.opacity,1),`translate(${a} ${l}) rotate(${c}) scale(${e.flip_h?-1:1} ${e.flip_v?-1:1}) translate(${-a} ${-l})`]}function em(e){const t=new Map,i=e?.assets;if(!Array.isArray(i))return t;for(const e of i){const i=e,n="image/png"===i.mime?"png":"image/jpeg"===i.mime?"jpg":"image/webp"===i.mime?"webp":"image/svg+xml"===i.mime?"svg":"",r=`/api/houseplan/content/assets/_/${i.asset_id}.${n}`;!Xp.test(String(i.asset_id||""))||i.url!==r||"string"!=typeof i.name||!Number.isFinite(i.bytes)||Number(i.bytes)<1||!Number.isFinite(i.width)||!Number.isFinite(i.height)||Number(i.width)<=0||Number(i.height)<=0||t.set(i.asset_id,i)}return t}async function tm(e,t,i){const n=[...new Set(t.filter(e=>Xp.test(e)))].sort(),r=e.connection||e,o=JSON.stringify([i,n]),s=Zp.get(r);if(s?.[0]===o)return s[1];const a=new Map;for(let t=0;t<n.length;t+=200){const i=await e.callWS({type:"houseplan/assets/resolve",asset_ids:n.slice(t,t+200)});for(const[e,t]of em(i))a.set(e,t)}return Zp.set(r,[o,a]),a}function im(e,t){const i=Number.isFinite(e)&&Number.isFinite(t)&&e>0&&t>0?e/t:1;let n=100,r=n/i;return r>200&&(r=200,n=r*i),{w:n,h:r}}const nm=2,rm=e=>(...t)=>({_$litDirective$:e,values:t});let om=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,i){this._$Ct=e,this._$AM=t,this._$Ci=i}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};const{I:sm}=se,am=e=>e,lm=()=>document.createComment(""),cm=(e,t,i)=>{const n=e._$AA.parentNode,r=void 0===t?e._$AB:t._$AA;if(void 0===i){const t=n.insertBefore(lm(),r),o=n.insertBefore(lm(),r);i=new sm(t,o,e,e.options)}else{const t=i._$AB.nextSibling,o=i._$AM,s=o!==e;if(s){let t;i._$AQ?.(e),i._$AM=e,void 0!==i._$AP&&(t=e._$AU)!==o._$AU&&i._$AP(t)}if(t!==r||s){let e=i._$AA;for(;e!==t;){const t=am(e).nextSibling;am(n).insertBefore(e,r),e=t}}}return i},hm=(e,t,i=e)=>(e._$AI(t,i),e),dm={},um=(e,t=dm)=>e._$AH=t,pm=e=>{e._$AR(),e._$AA.remove()},mm=(e,t,i)=>{const n=new Map;for(let r=t;r<=i;r++)n.set(e[r],r);return n},_m=rm(class extends om{constructor(e){if(super(e),e.type!==nm)throw Error("repeat() can only be used in text expressions")}dt(e,t,i){let n;void 0===i?i=t:void 0!==t&&(n=t);const r=[],o=[];let s=0;for(const t of e)r[s]=n?n(t,s):s,o[s]=i(t,s),s++;return{values:o,keys:r}}render(e,t,i){return this.dt(e,t,i).values}update(e,[t,i,n]){const r=(e=>e._$AH)(e),{values:o,keys:s}=this.dt(t,i,n);if(!Array.isArray(r))return this.ut=s,o;const a=this.ut??=[],l=[];let c,h,d=0,u=r.length-1,p=0,m=o.length-1;for(;d<=u&&p<=m;)if(null===r[d])d++;else if(null===r[u])u--;else if(a[d]===s[p])l[p]=hm(r[d],o[p]),d++,p++;else if(a[u]===s[m])l[m]=hm(r[u],o[m]),u--,m--;else if(a[d]===s[m])l[m]=hm(r[d],o[m]),cm(e,l[m+1],r[d]),d++,m--;else if(a[u]===s[p])l[p]=hm(r[u],o[p]),cm(e,r[d],r[u]),u--,p++;else if(void 0===c&&(c=mm(s,p,m),h=mm(a,d,u)),c.has(a[d]))if(c.has(a[u])){const t=h.get(s[p]),i=void 0!==t?r[t]:null;if(null===i){const t=cm(e,r[d]);hm(t,o[p]),l[p]=t}else l[p]=hm(i,o[p]),cm(e,r[d],i),r[t]=null;p++}else pm(r[u]),u--;else pm(r[d]),d++;for(;p<=m;){const t=cm(e,l[m+1]);hm(t,o[p]),l[p++]=t}for(;d<=u;){const e=r[d++];null!==e&&pm(e)}return this.ut=s,um(e,l),U}}),fm=1e-5;function gm(e){const t=e.map(()=>[]);for(let i=0;i<e.length;i++){const n=e[i],r=n[2]-n[0],o=n[3]-n[1];for(let s=i+1;s<e.length;s++){const a=e[s],l=r*(a[3]-a[1])-o*(a[2]-a[0]);if(Math.abs(l)<1e-12)continue;const c=a[0]-n[0],h=a[1]-n[1],d=(c*(a[3]-a[1])-h*(a[2]-a[0]))/l,u=(c*o-h*r)/l;d<=1e-9||d>=1-1e-9||u<=1e-9||u>=1-1e-9||(t[i].push(d),t[s].push(u))}}const i=[];for(let n=0;n<e.length;n++){const r=e[n];if(!t[n].length){i.push(r);continue}const o=[0,...t[n].sort((e,t)=>e-t),1];for(let e=1;e<o.length;e++)o[e]-o[e-1]<1e-9||i.push([r[0]+(r[2]-r[0])*o[e-1],r[1]+(r[3]-r[1])*o[e-1],r[0]+(r[2]-r[0])*o[e],r[1]+(r[3]-r[1])*o[e]])}return i}function vm(e){const t=[];for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];n&&r&&(Math.hypot(r[0]-n[0],r[1]-n[1])<1e-9||t.push([n[0],n[1],r[0],r[1]]))}return t}const ym=(e,t)=>{const i=t[2]-t[0],n=t[3]-t[1],r=i*i+n*n;if(!(r>0))return Math.hypot(e[0]-t[0],e[1]-t[1]);const o=Math.max(0,Math.min(1,((e[0]-t[0])*i+(e[1]-t[1])*n)/r));return Math.hypot(e[0]-(t[0]+o*i),e[1]-(t[1]+o*n))},bm=(e,t,i,n)=>{const r=n[2]-n[0],o=n[3]-n[1],s=t*o-i*r;if(Math.abs(s)<1e-12)return 1/0;const a=n[0]-e[0],l=n[1]-e[1],c=(a*o-l*r)/s;if(!(c>1e-9))return 1/0;const h=(a*i-l*t)/s;return h<-1e-9||h>1+1e-9?1/0:c};const wm=[[0,1],[45,.88],[70,.62],[86,.32],[100,0]];function km(){return{clipCache:new Map,geometryWarnings:new Set,featherUnits:null,renderedSources:new Map,lastAppearance:new Map,enteringSources:new Set,enterRafs:new Map,fadeTimers:new Map,featherSuspendUntil:0,featherResumeTimer:0,sourceSeq:0}}function xm(e,t){if(!e.clipCache.has(t))return{hit:!1,value:null};const i=e.clipCache.get(t)??null;return e.clipCache.delete(t),e.clipCache.set(t,i),{hit:!0,value:i}}function $m(e,t,i,n=256){for(e.clipCache.delete(t),e.clipCache.set(t,i);e.clipCache.size>n;){const t=e.clipCache.keys().next().value;if(void 0===t)break;e.clipCache.delete(t)}}function Sm(e){const t=Bh(e.hass,e.devices,null,e.virtualLights).filter(t=>t.device.space===e.spaceId),i=new Map;for(const e of t){if(!e.device.id)continue;const t=i.get(e.device.id)||[];t.push(e),i.set(e.device.id,t)}const n=[];for(const t of e.devices){if(!t.id||t.space!==e.spaceId)continue;const r=qh(i.get(t.id)||[]);if(!r)continue;const o=cn(r.passive?{state:r.on?"on":"off",attributes:{}}:e.hass.states[r.eid],t.marker?.glow_color,e.defaultColor),s=Number(t.marker?.glow_radius_cm),a=Number.isFinite(s)&&s>0?s/e.cellCm*e.gridPitch:e.defaultRadiusUnits;n.push({key:`${e.spaceId}|${t.id}`,sourceEid:r.eid,pos:e.position(t),radius:a,appearance:o?{c:o.c,alpha:hn(o.bri,e.paletteAlpha)}:null})}return n}function Mm(e){const t=Ll([e.rawSpaceConfig,e.cellCm,e.gridPitch]),i=e.space.rooms.flatMap(e=>{const t=Nt(e);return t?[{room:e,poly:t}]:[]}),n=Math.max(10/e.cellCm*e.gridPitch,.5*e.gridPitch),r=e=>i.some(({poly:t})=>Zt(e,t)),o=e.openings.flatMap(t=>{if("door"!==(i=String(t.type))&&"gate"!==i&&"passage"!==i)return[];var i;const o=t.angle*Math.PI/180,s=-Math.sin(o),a=Math.cos(o);return r([t.rx+s*n,t.ry+a*n])&&r([t.rx-s*n,t.ry-a*n])?[{opening:t,amount:Vt(e.openingAmount(t))}]:[]});return{geometryFingerprint:t,fingerprint:Ll([t,o.map(({opening:e,amount:t})=>({id:e.id,type:e.type,contact:e.contact,amount:t})).filter(e=>!!e.contact&&("door"===e.type||"gate"===e.type)).map(e=>{const t=Math.max(0,Math.min(1,Number(e.amount)||0));return`${e.id}:${t.toFixed(3)}`}).sort().join("|")]),polygons:i,passageStates:o}}function Cm(e){const{revision:t}=e,i=`${e.space.id}|${t.fingerprint}`,n=[...e.zeroWalls.transmissive],r=Ip(t.passageStates.filter(({amount:e})=>e>0).map(({opening:e,amount:t})=>({...e,rlen:Gt(e.rlen,t)})),e.space,[...e.walls],e.zeroWalls.contour,e.wallKeyPitch,e.cellCm,e.gridPitch,e.coordScale);for(const e of r){const t=e.angle*Math.PI/180,i=Math.cos(t)*e.length/2,r=Math.sin(t)*e.length/2;n.push([e.x-i,e.y-r,e.x+i,e.y+r])}const o=t.passageStates.flatMap(({opening:e,amount:t})=>t>0&&e.partitionHost?[ia(Yd(e.partitionHost),t)]:[]),s=e.physicalBodies(o,i),a=[],l=e.sharedWallGeometry?.sourceFingerprint,c=e.sharedWallGeometry&&l===t.geometryFingerprint?function(e,t=[],i=[],n={}){if("failed-core"===e.status||"not-applicable"===e.status)return null;const r=e.roomComponents?.length?e.roomComponents:ys(e.roomGeom)?[{id:"room-primary",geom:e.roomGeom}]:[];let o=r[0]?.geom||null;const s=r.slice(1).map(e=>({...e}));try{for(const i of t){if(!(i.length>0&&e.openingIndex))continue;const t=Bs(e.openingIndex,i,!0);if(!t.negative&&!t.positive)continue;const n=i.angle*Math.PI/180,r=Math.cos(n),a=Math.sin(n),l=-a,c=r,h=i.length/2,d=e.openingPadUnits??1.25*Math.max(e.depthUnits,1),u=vs([[i.x-r*h-l*d,i.y-a*h-c*d],[i.x+r*h-l*d,i.y+a*h-c*d],[i.x+r*h+l*d,i.y+a*h+c*d],[i.x-r*h+l*d,i.y-a*h+c*d]]);o&&(o=Tt(o,u));for(const e of s)e.geom=Tt(e.geom,u)}const r=[...s];let a=s.length;const l=n.mergeExtra||((e,t)=>e?Mt(e,t):t);for(let e=0;e<i.length;e++){const t=i[e];if(t.length<3||!t.every(e=>e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1]))||Math.abs(hi(t))<=1e-9){a++;continue}const n=[vs(t)];try{const t=l(o,n,e);if(!ys(t))throw new Error("invalid extra union");o=t}catch{a++,ys(n)&&r.push({id:`policy-extra-${e}`,geom:n})}}r.sort((e,t)=>Ds(e.geom).localeCompare(Ds(t.geom)));const c=o||[];return{status:a?"degraded-extra":"ok",geom:c,components:[...ys(c)?[{id:"primary",geom:c}]:[],...r.map((e,t)=>({...e,id:`isolated-${t}`}))]}}catch{return null}}(e.sharedWallGeometry,r,s):null,h=c||(e.walls.length||s.length?Ps(e.space.rooms,[...e.walls],e.zeroWalls.contour,r,e.wallKeyPitch,e.cellCm,e.gridPitch,e.coordScale,s):null);if(!h||"ok"!==h.status&&"degraded-extra"!==h.status)for(const e of s)a.push(...vm(e));else for(const e of h.components)for(const t of ua(e.geom))a.push(...vm(t));const d=.02*e.gridPitch;for(const{poly:e}of t.polygons){const t=n.length?mn(e,n,d):vm(e);for(const e of t)a.push(e)}for(const t of e.zeroWalls.barriers)a.push(t);return{occluders:gm(a),floor:t.polygons.map(({poly:e})=>e),fingerprint:t.fingerprint,masonryGeometry:!h||"ok"!==h.status&&"degraded-extra"!==h.status?[]:h.components.flatMap(e=>e.geom),opaqueBodies:s}}function Tm(e){const t=function(e,t,i,n=96){if(!(t>0&&Number.isFinite(e[0])&&Number.isFinite(e[1])))return[];const r=[];for(const n of i){if(!n||n.length<4)continue;if(![n[0],n[1],n[2],n[3]].every(Number.isFinite))continue;const i=ym(e,n);if(i<1e-7)return[];i>t||r.push(n)}const o=[],s=Math.max(12,Math.round(n));for(let e=0;e<s;e++)o.push(e/s*Math.PI*2-Math.PI);for(const t of r)for(const i of[[t[0],t[1]],[t[2],t[3]]]){const t=Math.atan2(i[1]-e[1],i[0]-e[0]);o.push(t-fm,t,t+fm)}const a=2*Math.PI;for(let e=0;e<o.length;e++)o[e]=(o[e]%a+a)%a;o.sort((e,t)=>e-t);const l=[];let c=Number.NEGATIVE_INFINITY;for(const i of o){if(i-c<1e-9)continue;c=i;const n=Math.cos(i),o=Math.sin(i);let s=t;for(const t of r){const i=bm(e,n,o,t);i<s&&(s=i)}l.push([e[0]+n*s,e[1]+o*s])}return l.length>=3?l:[]}([e.source.x,e.source.y],e.radius,e.scene.occluders,96);return{lit:t.length>=3?ca([t],e.scene.floor,{onBoundsFailure:({boundIndex:t,phase:i})=>{const n=e.polygons[t]?.room;e.onBoundsFailure?.(n?.id||`#${t}`,i)}}):[]}}function Rm(e,t){return _a([e.x,e.y],t.masonryGeometry,t.opaqueBodies)}function Dm(e,t){if(t.reducedMotion())return;const i=t.window();e.featherSuspendUntil=Math.max(e.featherSuspendUntil,Date.now()+500),i.clearTimeout(e.featherResumeTimer);const n=()=>{e.featherResumeTimer=0,Date.now()<e.featherSuspendUntil?e.featherResumeTimer=i.setTimeout(n,e.featherSuspendUntil-Date.now()+17):(e.featherSuspendUntil=0,t.isConnected()&&t.requestUpdate())},r=Math.max(0,e.featherSuspendUntil-Date.now())+17;e.featherResumeTimer=i.setTimeout(n,r)}function zm(e,t,i,n){const r=t.window();let o=e.renderedSources.get(i);if(n){const n=e.fadeTimers.get(i);if(null!=n&&(r.clearTimeout(n),e.fadeTimers.delete(i)),null==o){Dm(e,t),o=++e.sourceSeq,e.renderedSources.set(i,o),e.enteringSources.add(i);const n=r.requestAnimationFrame(()=>{e.enterRafs.get(i)===n&&(e.enterRafs.delete(i),e.enteringSources.delete(i),t.isConnected()&&t.requestUpdate())});e.enterRafs.set(i,n)}return{domId:o,entering:e.enteringSources.has(i),leaving:!1}}if(null==o)return null;const s=e.enterRafs.get(i);if(null!=s&&r.cancelAnimationFrame(s),e.enterRafs.delete(i),e.enteringSources.delete(i),!e.fadeTimers.has(i)){Dm(e,t);const n=r.setTimeout(()=>{e.fadeTimers.get(i)===n&&(e.fadeTimers.delete(i),e.renderedSources.delete(i),e.lastAppearance.delete(i),t.isConnected()&&t.requestUpdate())},534);e.fadeTimers.set(i,n)}return{domId:o,entering:!1,leaving:!0}}function Am(e,t,i){const n=t.window(),r=e.fadeTimers.get(i),o=e.enterRafs.get(i);null!=r&&n.clearTimeout(r),null!=o&&n.cancelAnimationFrame(o),e.fadeTimers.delete(i),e.enterRafs.delete(i),e.enteringSources.delete(i),e.renderedSources.delete(i),e.lastAppearance.delete(i)}function Pm(e,t,i){const n=`${i}|`;for(const i of[...e.renderedSources.keys()])i.startsWith(n)&&Am(e,t,i)}function Om(e,t,i,n){const r=`${i}|`;for(const i of[...e.renderedSources.keys()])i.startsWith(r)&&!n.has(i)&&Am(e,t,i)}function Fm(e,t){const i=t.window();for(const t of e.fadeTimers.values())i.clearTimeout(t);for(const t of e.enterRafs.values())i.cancelAnimationFrame(t);i.clearTimeout(e.featherResumeTimer),e.clipCache.clear(),e.geometryWarnings.clear(),e.fadeTimers.clear(),e.enterRafs.clear(),e.enteringSources.clear(),e.renderedSources.clear(),e.lastAppearance.clear(),e.featherUnits=null,e.featherSuspendUntil=0,e.featherResumeTimer=0,e.sourceSeq=0}function Im(e,t,i,n,r){const o=`${t}|${i}|${n}`;if(!e.geometryWarnings.has(o)){if(e.geometryWarnings.size>=128){const t=e.geometryWarnings.values().next().value;t&&e.geometryWarnings.delete(t)}e.geometryWarnings.add(o),console.warn(`HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${t}, room ${n}, phase ${r}`)}}function Em(e,t,i){const n=1/(t>0?t:1),r=i&&Date.now()>=e.featherSuspendUntil;return(null==e.featherUnits||r)&&(e.featherUnits=n),{feather:e.featherUnits??n,enabled:r}}function Hm(e){if(!e.spots.length)return j``;const t=4*e.feather,i=e.spots.reduce((e,i)=>({x:Math.min(e.x,i.pos.x-i.r-t),y:Math.min(e.y,i.pos.y-i.r-t),maxX:Math.max(e.maxX,i.pos.x+i.r+t),maxY:Math.max(e.maxY,i.pos.y+i.r+t),w:0,h:0}),{x:1/0,y:1/0,maxX:-1/0,maxY:-1/0,w:0,h:0});i.w=i.maxX-i.x,i.h=i.maxY-i.y;const n=e.enabledClip?.length?e.enabledClip:null;return j`<defs>
      ${_m(e.spots,e=>e.key,e=>{const t=e.domId;return j`
          <radialGradient id="hp-glow-${t}" gradientUnits="userSpaceOnUse"
            cx="${e.pos.x}" cy="${e.pos.y}" r="${e.r}">
            ${wm.map(([t,i])=>j`
              <stop offset="${t}%" stop-color="${e.c}"
                stop-opacity="${(e.alpha*i).toFixed(4)}"></stop>`)}
          </radialGradient>
          ${e.geometry?j`
            <clipPath id="hp-glowclip-${t}">
              <path class="glow-lit" d="${e.geometry.lit.join(" ")}"
                clip-rule="evenodd" fill-rule="evenodd"></path>
            </clipPath>`:V}`})}
      ${n?j`<clipPath id="hp-glow-enabled">${n.map(e=>j`
        <path d=${e} clip-rule="evenodd" fill-rule="evenodd"></path>`)}
      </clipPath>`:V}
      <filter id="hp-glowfeather" filterUnits="userSpaceOnUse"
        x="${i.x}" y="${i.y}"
        width="${i.w}" height="${i.h}"
        color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="${e.feather.toFixed(4)}" edgeMode="none"></feGaussianBlur>
      </filter>
    </defs>
    <g class="glowlayer glow-pools-frame" pointer-events="none" aria-hidden="true"
      filter=${e.featherEnabled?"url(#hp-glowfeather)":V}>
      <g class="glow-pools ${e.screenBlend?"blend-screen":"blend-normal"}"
        data-blend=${e.screenBlend?"screen":"normal"}
        data-feather-px="${2}"
        clip-path=${n?"url(#hp-glow-enabled)":V}>
        ${_m(e.spots,e=>e.key,e=>j`
          <g class="glow-spot ${e.entering?"is-entering":""} ${e.leaving?"is-leaving":""}"
            data-glow-spot="${e.domId}" data-glow-source="${e.sourceEid}">
            <circle class="glow-pool"
              cx="${e.pos.x}" cy="${e.pos.y}" r="${e.r}"
              data-lit-parts="${e.geometry?.lit.length||0}"
              data-feather-px="${2}"
              fill="url(#hp-glow-${e.domId})"
              clip-path=${e.geometry?`url(#hp-glowclip-${e.domId})`:V}></circle>
          </g>`)}
      </g>
    </g>`}const Nm=new WeakMap,Lm=new WeakMap,Bm=new WeakMap,qm=new WeakMap;function Wm(e,t){const i=e.get(t);return void 0!==i&&(e.delete(t),e.set(t,i)),i}function jm(e,t,i,n){for(e.delete(t),e.set(t,i);e.size>n;)e.delete(e.keys().next().value)}function Um(e){const t=Ra(e.cfg),i={};for(const t of e.cfg.spaces||[])for(const e of t.rooms||[])e.area&&(i[e.area]=t.id);const n=ud(e.cfg.settings),r=ye(e.cfg.settings?.icon_rules?.length?e.cfg.settings.icon_rules:ve);return sd({hass:e.hass,registry:e.registry,areaToSpace:i,markers:e.cfg.markers||[],settings:e.cfg.settings||{},excluded:n,showAll:!!e.cfg.settings?.show_all,firstSpaceId:t[0]?.id||"",loc:t=>gu(e.lang,t),iconRules:r})}function Vm(e){const t=Ra(e.cfg),i=t.find(t=>t.id===e.spaceId);if(!i)return null;const n=Vi(e.cfg.spaces.find(t=>t.id===e.spaceId)),r=Xi(e.cfg.settings),o=e.iconSize??2.5,s=o>8?2.5:o,a=pp(s),l=e.registry?uh(e.hass,e.registry):e.hass,c=e.registry?ph(e.hass,e.registry):e.hass,h=e.devices||Um(e),d=e.areaRelocationIds||Kp({devices:h,model:t,layout:e.layout,snapshot:e.cfg.settings?.marker_area_snapshot,authoritative:!0===e.registry?.authoritative,coordinateScale:xa}).relocateIds,u=h.filter(t=>t.space===e.spaceId),p=u.filter(e=>!e.hidden),m=function(e,t,i){const n={},r=i/100*tl(t)*1.3;for(const i of t.rooms){if(!i.area)continue;const t=e.filter(e=>e.area===i.area);if(!t.length)continue;const o=ol(i),s=.1*Math.min(o.w,o.h),a=o.w-2*s,l=o.h-2*s,c=Math.max(1,Math.round(Math.sqrt(t.length*a/Math.max(l,1)))),h=a/c,d=l/Math.max(Math.ceil(t.length/c),1),u=t.map((e,t)=>({x:o.x+s+h*(t%c+.5),y:o.y+s+d*(Math.floor(t/c)+.5)}));yi(u,o,r,.5*s),t.forEach((e,t)=>n[e.id]=Ia(u[t]))}return n}(u,i,s),_=ye(e.cfg.settings?.icon_rules?.length?e.cfg.settings.icon_rules:ve),f=pd(l,_,e.cfg.markers||[],ud(e.cfg.settings)),g=t=>{const n=t.settings?.temp_source;if(n)return ld(l,n,"temp",e.cfg.markers||[]);const r=hd(i.id,t);return r?f.get(r)?.temp??null:null},v=[];for(const t of p){const i=e.layout[t.id];if(i&&i.s===e.spaceId){const e=i.x*xa,t=i.y*xa;v.push({minX:e,minY:t,maxX:e,maxY:t})}}const y=e.cfg.spaces.find(t=>t.id===e.spaceId)||{};if(!n.hideDecor)for(const t of y.decor||[]){if("image"!==t?.kind||!e.decorAssetUrl?.(String(t.asset_id||"")))continue;const i=Va(t);i&&v.push(i)}const b=Array.isArray(y.walls)?y.walls:[],w=Number(y.cell_cm)>0?Number(y.cell_cm):5,k=Rp(y,i,xa,.02*Pa),x=(y.openings||[]).flatMap(e=>{if("partition"!==e.host?.kind)return[];const t=Vd(e,i.partitions,xa,w,Pa).resolved;return t?[t]:[]}),$=Ll({partitions:i.partitions,roomDrafts:i.room_drafts,columns:i.wall_columns,cellCm:w,hostedOpenings:x.map(e=>({id:e.opening.id,host:e.host,length:e.length,type:e.opening.type}))}),S=function(e,t,i,n){let r=Lm.get(e);r||(r=new Map,Lm.set(e,r));const o=r.get(t);if(o?.fingerprint===i)return o.value;const s=n();return r.set(t,{fingerprint:i,value:s}),s}(e.cfg,i.id,$,()=>oa(i,w,Pa,2e-4*Pa,x.map(Yd)).all);for(const e of S){const t=e.map(e=>e[0]),i=e.map(e=>e[1]);t.length&&v.push({minX:Math.min(...t),minY:Math.min(...i),maxX:Math.max(...t),maxY:Math.max(...i)})}for(const e of k.lines)v.push({minX:Math.min(e[0],e[2]),minY:Math.min(e[1],e[3]),maxX:Math.max(e[0],e[2]),maxY:Math.max(e[1],e[3])});const M=function(e,t=1e3){const i=[];for(const[n,r]of(e||[]).entries()){if("passage"!==r?.type)continue;const e={...r,id:String(r.id||`passage-${n}`),type:"passage",rx:Number(r.x)*t,ry:Number(r.y)*t,rlen:Number(r.length)*t};[e.rx,e.ry,e.rlen,e.angle].every(Number.isFinite)&&e.rlen>0&&i.push(e)}return i}((y.openings||[]).flatMap(e=>{if(!e.host||"wall"===e.host.kind)return[e];const t=x.find(t=>t.opening.id===e.id);return t?[eu(e,t,xa)]:[]}),xa),C=ds(i.rooms,b,k.contour,Oa,w,Pa,xa),T=x.filter(e=>Jd(e,C,2e-4*Pa)).map(e=>({x:e.center[0],y:e.center[1],angle:e.angle,length:e.length})),R=Ba(e.fit),D=!!(b.length||S.length&&n.showBorders),z=D?Ll(M.length?{rooms:i.rooms,walls:b,extras:S,cellCm:w,zero:k.contour,passages:M.map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),hostedCompositeOpenings:T}:{rooms:i.rooms,walls:b,extras:S,cellCm:w,zero:k.contour}):"",A=D?function(e,t,i,n){let r=Nm.get(e);r||(r=new Map,Nm.set(e,r));const o=r.get(t);if(o?.fingerprint===i)return o.value;const s=n();return r.set(t,{fingerprint:i,value:s}),s}(e.cfg,i.id,z,()=>{const e=Os(i.rooms,b,k.contour,[...M.filter(e=>"partition"!==e.host?.kind).map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),...T],Oa,w,Pa,xa,S);return e&&Object.defineProperty(e,"sourceFingerprint",{value:Ll([y,w,Pa]),enumerable:!1}),e}):null;let P=Qa(i,v,e.compactTopFrame?{top:0,right:.05,bottom:.05,left:.05}:.05);if("house"===R){const e=[],t=ya(2.5,w)/2,r=ya(.6,w)/2;for(const n of i.rooms){const i=Ua(n);i&&e.push(ja(i,t))}if(n.showBorders)for(const t of A?.components||[]){const i=Wa(t.geom);i&&e.push(ja(i,r))}if(n.showBorders)for(const t of S){const i=Wa(t);i&&e.push(ja(i,r))}if(n.showBorders)for(const i of k.lines){const n={minX:Math.min(i[0],i[2]),minY:Math.min(i[1],i[3]),maxX:Math.max(i[0],i[2]),maxY:Math.max(i[1],i[3])};e.push(ja(n,t))}if(!n.hideOpenings)for(const t of x){const i=t.opening,n="gate"===i.type?!i.flip_v:!!i.flip_v,r=xu({type:i.type,length:t.length,angle:t.angle,flipH:!!i.flip_h,flipV:!!i.flip_v,cellCm:w,gridPitch:Pa,face:Xd(t,n)},t.center);r&&e.push(r)}P=Ja(e)||P}const O=[P.x,P.y,P.w,P.h],F=new Map(i.rooms.map(t=>{const i=yn(n.fill,t);return[t,Ji(i,"lqi"===i&&t.area?md(l,u,t.area):null,"light"===i?Wh(Bh(l,u,t,e.virtualLights)):"none","temp"===i?g(t):null,n.tempMin,n.tempMax,r,Ui(n.customFill,t))]})),I=new Map;for(const e of i.rooms)e.id&&I.set(e.id,F.get(e)||null);const E=i.rooms.filter(e=>e.area||n.showBorders||"none"!==yn(n.fill,e)).map(e=>{let t="room "+(i.bg?"overlay":"yard"),r="";const o=yn(n.fill,e);if(n.showBorders||"none"!==o){t+=" styled";const i=[`--room-stroke:${n.color}`,`--room-stroke-op:${n.showBorders&&!k.contour.length?n.opacity:0}`],o=F.get(e)||null;o?(t+=" filled",i.push(`--room-fill:${o.color}`,`--room-fill-op:${o.opacity.toFixed(3)}`)):i.push("--room-fill:transparent","--room-fill-op:0"),r=i.join(";")}const s=e.id||V,a=e.area||V,l=e.poly?j`<polygon class="${t}" style="${r}" data-hp="room" data-id=${s} data-area=${a}
            points="${e.poly.map(e=>e.join(",")).join(" ")}"></polygon>`:j`<rect class="${t}" style="${r}" data-hp="room" data-id=${s} data-area=${a}
            x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${.03*Math.min(e.w,e.h)}"></rect>`;return l}),H=i.rooms.filter(e=>bn(n.glow,e)),N=H.filter(e=>{const t=F.get(e);return!t||t.opacity<=0}).map(e=>e.poly?j`<polygon class="glow-base" aria-hidden="true" pointer-events="none"
          data-room-id=${e.id||V}
          points="${e.poly.map(e=>e.join(",")).join(" ")}"
          fill=${r.glow_base.c} fill-opacity=${r.glow_base.a}></polygon>`:j`<rect class="glow-base" aria-hidden="true" pointer-events="none"
          data-room-id=${e.id||V}
          x=${e.x} y=${e.y} width=${e.w} height=${e.h}
          rx=${.03*Math.min(e.w,e.h)}
          fill=${r.glow_base.c} fill-opacity=${r.glow_base.a}></rect>`),L=new Map;for(const e of i.rooms)if(e.id){const t=F.get(e)||null;L.set(e.id,bn(n.glow,e)&&(!t||t.opacity<=0)?{color:r.glow_base.c,opacity:r.glow_base.a,mode:"glow"}:null)}const B=Bh(l,p,null,e.virtualLights),q=p.map(t=>{const r=sl(t,e.layout,e.cfg,m,i,d),o=(r.x-O[0])/O[2]*100,s=(r.y-O[1])/O[3]*100,a=n.showLqi??!1!==e.showSignal,h=e.presentations?.get(lp(t.id,a))||rp(l,t,{liveStates:!1!==e.liveStates,showTemperature:!1!==e.showTemperature,showSignal:a,activityRuntime:e.activityRuntime?.get(t.id),sourceDetails:!1,lightDevices:p,lightSources:B,registryHass:c,reducedMotion:e.reducedMotion}),u=[`left:${o}%`,`top:${s}%`,...hp(h)],_=Gu(h),f=[t.name,gu(e.lang,`marker.state_a11y_${_}`),"none"!==h.pulse.kind?gu(e.lang,`marker.pulse_a11y_${h.pulse.reason}`):"",h.valueFullText||h.valueText||"",Mu(h.valueBadge),null!=h.lqiText&&h.lqiBand?gu(e.lang,`marker.lqi_a11y_${h.lqiBand}`,{value:h.lqiText}):""].filter(Boolean).join(", ");return W`<div class="dev ${cp(l)} ${h.classes.join(" ")} ${t.virtual?"virtual":""} ${null!=h.valueText?"valonly":""}"
      data-hp="device" data-id="${t.id}" data-entity=${t.primary||V} data-area=${t.area||V}
      role="img" aria-label=${f}
      data-state=${_}
      data-lqi-band=${null!=h.lqiText&&h.lqiBand||V}
      data-binding-status=${"ha_disabled"===t.bindingStatus?.kind?"ha-disabled":t.bindingStatus?.kind||"active"}
      data-disabled-reason=${h.disabledReason?h.disabledReason.replace("_","-"):V}
      style="${u.join(";")}">
      ${up(h,{newDevice:d.has(t.id)||!!e.cfg.settings?.new_device_ids?.includes(t.id),newDeviceTitle:gu(e.lang,"device.new")})}
    </div>`}),U=n.showNames?i.rooms.filter(e=>e.name).map(t=>{const r=al(t,i.id,e.layout,e.cfg),o=(r.x-O[0])/O[2]*100,s=(r.y-O[1])/O[3]*100,a=Math.min(1,n.opacity+.25);return W`<div class="roomlabel"
            data-hp="room-label" data-id=${t.id||V} data-area=${t.area||V}
            style="left:${o}%;top:${s}%;color:${n.color};opacity:${a}">${t.name}</div>`}):[],G=i.bg?e.displayUrl?e.displayUrl(i.bg.href):i.bg.href:"",K=(y.decor||[]).flatMap(t=>{if("image"!==t?.kind||n.hideDecor)return[];const i=e.decorAssetUrl?.(String(t.asset_id||""))||"",r=i&&e.displayUrl?e.displayUrl(i):i;if(!r)return[];const o=Qp(t,xa,xa);if(!o)return[];const[s,a,l,c,h,d]=o;return[j`<image class="dimage" data-hp="decor"
      href=${r} x=${s} y=${a} width=${l} height=${c}
      opacity=${h}
      @load=${()=>e.assetLoaded?.(i,r)}
      preserveAspectRatio="none" transform=${d} pointer-events="none"></image>`]}),Y=e.cfg.spaces.find(t=>t.id===e.spaceId)?.settings||{},X="daynight"===Jn(e.cfg?.settings,Y)?Bn(l,e.dayCycleNow??new Date):null,Z=Gi(e.cfg?.settings,n),J=M.length&&b.length?function(e,t,i,n,r,o,s,a=1){return[r,o,s,a].every(Number.isFinite)&&o>0&&a>0&&i?.length?Us(Hs(e,i,n,r,o,s,a),t):t.map(()=>null)}(i.rooms,M.map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),b,k.contour,Oa,w,Pa,xa):M.map(()=>null),Q=M.length?mp({openings:M,geometries:J,fillsByRoomId:I,idPrefix:`${i.id}-static-data`,groupClass:"opening-tunnels static-opening-tunnels",dataLayer:"data"}):V,ee=M.length?mp({openings:M,geometries:J,fillsByRoomId:L,idPrefix:`${i.id}-static-glow`,groupClass:"opening-tunnels glow-base-tunnels static-opening-tunnels",dataLayer:"glow-base"}):V,te=b.length&&A?.paperD?[{path:A.paperD}]:Lt(i.rooms),ie=n.showBorders?A:null,ne=e.stageWidth&&O[2]?e.stageWidth/O[2]:1,re=lo(w),oe=!!ie&&(ao(ie.depthUnits,ne)||co(re,ne)),se=n.color||"#607d8b";let ae=V;const le=e.glowRuntime;if(e.lightPools&&le&&H.length){const t=Op(y,i,w,Pa,xa),n=Mm({rawSpaceConfig:y,space:i,openings:t,cellCm:w,gridPitch:Pa,openingAmount:e=>{const t=e.contact?l.states?.[e.contact]:null;return Ut(e.type,t?.state,!!e.invert,t?.attributes?.current_position)}}),o=function(e,t,i,n){let r=Bm.get(e);r||(r=new Map,Bm.set(e,r));let o=r.get(t);o||(o=new Map,r.set(t,o));const s=Wm(o,i);if(s)return s;const a=n();return jm(o,i,a,8),a}(e.cfg,i.id,n.fingerprint,()=>Cm({space:i,revision:n,walls:b,zeroWalls:k,wallKeyPitch:Oa,cellCm:w,gridPitch:Pa,coordScale:xa,sharedWallGeometry:A,physicalBodies:e=>oa(i,w,Pa,2e-4*Pa,e).all})),s=Number(e.cfg.settings.glow_radius_cm),a=Number.isFinite(s)&&s>0?s:300,c=Sm({hass:l,devices:p,virtualLights:e.virtualLights,spaceId:i.id,defaultColor:r.glow_light.c,paletteAlpha:r.glow_light.a,defaultRadiusUnits:a/w*Pa,cellCm:w,gridPitch:Pa,position:t=>sl(t,e.layout,e.cfg,m,i,d)}),h=new Set,u=[];for(const e of c){if(h.add(e.key),Rm(e.pos,o)){Am(le.state,le.host,e.key);continue}const t=zm(le.state,le.host,e.key,!!e.appearance);if(!t)continue;e.appearance&&le.state.lastAppearance.set(e.key,e.appearance);const r=le.state.lastAppearance.get(e.key);if(!r)continue;const s=`${i.id}|${o.fingerprint}|${e.pos.x.toFixed(4)},${e.pos.y.toFixed(4)}|${e.radius.toFixed(4)}`,a=xm(le.state,s),l=a.hit?a.value:Tm({spaceId:i.id,source:e.pos,radius:e.radius,scene:o,polygons:n.polygons,onBoundsFailure:(e,t)=>Im(le.state,i.id,o.fingerprint,e,t)});a.hit||$m(le.state,s,l),u.push({key:e.key,sourceEid:e.sourceEid,domId:t.domId,entering:t.entering,leaving:t.leaving,pos:e.pos,c:r.c,alpha:r.alpha,geometry:l,r:e.radius})}if(Om(le.state,le.host,i.id,h),u.length){const t=H.length===n.polygons.length,r=`${n.geometryFingerprint}|${i.rooms.filter(e=>!H.includes(e)).map(e=>e.id||`#${i.rooms.indexOf(e)}`).sort().join(",")}`,o=t?null:function(e,t,i,n){let r=qm.get(e);r||(r=new Map,qm.set(e,r));let o=r.get(t);o||(o=new Map,r.set(t,o));const s=Wm(o,i);if(s)return s;const a=n();return jm(o,i,a,8),a}(e.cfg,i.id,r,()=>H.flatMap(e=>{const t=Nt(e);if(!t)return[];const r=b.length&&e.id&&gs(i.rooms,e.id,b,k.contour,Oa,w,Pa,xa,A?.roomGeom,A?.multiWallNodes)||t,o=r.map(e=>e[0]),s=r.map(e=>e[1]),a=[Math.min(...o),Math.min(...s),Math.max(...o),Math.max(...s)],l=S.filter(e=>{const t=e.map(e=>e[0]),i=e.map(e=>e[1]);return Math.max(...t)>=a[0]&&Math.min(...t)<=a[2]&&Math.max(...i)>=a[1]&&Math.min(...i)<=a[3]}),c=l.length?ha(r,l):null,h=c?Qs(c):"",d=ci(r,n.polygons.filter(({room:t})=>t!==e).map(({poly:e})=>e)),u=e=>`M ${e.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`;return[[h||u(r),...d.map(u)].join(" ")]})),s=Em(le.state,e.stageWidth&&O[2]?e.stageWidth/O[2]:1,!0);ae=Hm({spots:u,enabledClip:o,feather:s.feather,featherEnabled:s.enabled,screenBlend:le.screenBlend})}}else le&&Pm(le.state,le.host,i.id);const ce=n.hideOpenings?[]:x.map(e=>{const t=e.opening,i="passage"!==t.type&&t.contact?l.states?.[t.contact]:null,n=Ut(t.type,i?.state,!!t.invert,i?.attributes?.current_position),r=n>0&&!!t.contact,o="gate"===t.type?!t.flip_v:!!t.flip_v,s={type:t.type,length:e.length,angle:e.angle,amount:n,flipH:!!t.flip_h,flipV:!!t.flip_v,base:se,tone:r?"var(--hp-open)":se,cellCm:w,gridPitch:Pa,face:Xd(e,o)};return j`<g class="opening static-opening" data-hp="opening"
      data-id=${t.id} data-kind=${t.type} pointer-events="none"
      transform="translate(${e.center[0]} ${e.center[1]}) rotate(${e.angle})">
      ${$u(s)}
    </g>`});return W`
    <div class="hp-static-stage${X?` daycycle phase-${X.phase}`:""}"
      ?inert=${!!e.inert}
      style="aspect-ratio:${O[2]}/${O[3]}${Z?";background:"+Z:""};--hp-cell-visual-scale:${va(w)};--wall-fill:${r.wall_fill.c};--wall-fill-op:${r.wall_fill.a}${X?`;${ir(X)}`:""}">
      ${nr(X)}
      <svg viewBox="${O[0]} ${O[1]} ${O[2]} ${O[3]}" preserveAspectRatio="xMidYMid meet">
        ${ie?j`<defs>
          <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
            width="${re}" height="${re}" patternTransform="rotate(45)">
            <path d="M0 0 L0 ${re}" stroke="${se}"
              stroke-width="${re/8*2}"></path>
          </pattern>
        </defs>`:V}
        <g class="hp-paperg">${te.map(e=>"path"in e?j`<path class="hp-paper" d="${e.path}" fill-rule="evenodd"></path>`:"poly"in e?j`<polygon class="hp-paper" points="${e.poly}"></polygon>`:j`<rect class="hp-paper" x="${e.rect.x}" y="${e.rect.y}" width="${e.rect.w}" height="${e.rect.h}" rx="${e.rect.rx}"></rect>`)}</g>
        ${G?j`<image href="${G}" x="${i.bg.x}" y="${i.bg.y}" width="${i.bg.w}" height="${i.bg.h}"
              @load=${()=>e.assetLoaded?.(i.bg.href,G)}
              transform=${i.bg.angle?`rotate(${i.bg.angle} ${i.bg.x+i.bg.w/2} ${i.bg.y+i.bg.h/2})`:V}
              preserveAspectRatio="none" />`:V}
        ${E}
        ${n.showBorders&&k.contour.length?j`<g class="room-outlines" aria-hidden="true" pointer-events="none">
              ${i.rooms.map(e=>{const t=Nt(e);if(!t)return V;const i=mn(t,k.contour,.02*Pa);return j`<path class="room-outline" fill="none" stroke=${n.color}
                  stroke-opacity=${n.opacity}
                  stroke-width=${ya(2.5,w)}
                  d=${i.map(e=>`M ${e[0]} ${e[1]} L ${e[2]} ${e[3]}`).join(" ")}></path>`})}
            </g>`:V}
        ${Q}
        ${N.length?j`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${N}</g>`:V}
        ${ee}
        <g class="decorlayer" pointer-events="none">${K}</g>
        ${ae}
        ${ie?j`<g class="wallbodies" style="--room-stroke:${se}">
              ${ie.paths.map(e=>j`
                <path class="wallbody-fill" data-component=${e.id} d="${e.d}"
                  fill="${r.wall_fill.c}" fill-opacity="${r.wall_fill.a}"
                  fill-rule=${e.fillRule} stroke="none" pointer-events="none"></path>
                <path class="wallbody ${oe?"solid":""}"
                  data-hp="wall" data-id="union" data-kind="union" data-component=${e.id}
                  d="${e.d}" fill="${oe?"none":"url(#hp-wall-hatch)"}"
                  fill-rule=${e.fillRule} stroke="${se}"
                  stroke-width="${ya(.6,w)}" pointer-events="none"></path>`)}
            </g>`:V}
        ${n.showBorders&&k.lines.length?j`<g class="zero-walls ${k.style}"
              data-zero-wall-style=${k.style} aria-hidden="true" pointer-events="none">
              ${k.lines.map(e=>j`<line class="zero-wall"
                x1=${e[0]} y1=${e[1]} x2=${e[2]} y2=${e[3]}
                stroke=${se} stroke-width=${ya(2.5,w)}
                stroke-dasharray=${"dashed"===k.style?`${ya(7,w)} ${ya(7,w)}`:V}></line>`)}
            </g>`:V}
        ${ce}
      </svg>
      ${""}
      <div class="devlayer" style="--icon-size:${il(s,i,O[2]).toFixed(3)}cqw;--device-base-size:${il(a,i,O[2]).toFixed(3)}cqw">${q}${U}</div>
    </div>
  `}let Gm=null,Km=null,Ym=0,Xm=-1,Zm=null,Jm=[];const Qm=new Set,e_=(e,t)=>{"function"==typeof e&&t.push(e)};function t_(){if(Gm)return Gm;try{const e=JSON.parse(localStorage.getItem("houseplan_card_cfg_v1")||"null");if(e&&e.config&&Array.isArray(e.config.spaces)){const t=e.layout||{};return{config:e.config,rev:e.rev||0,decorAssetsApi:null,configFingerprint:e.config_fingerprint||Ll(e.config),layout:t,layoutRev:e.layout_rev||0,layoutFingerprint:e.layout_fingerprint||Ll(t),virtualLights:Wc(e.virtual_lights,e.rev||0)}}}catch{}return null}function i_(e,t=!1){if(t&&(Gm=null,Ym++,Km))return Km.catch(()=>null).then(()=>i_(e,!1));if(Gm)return Promise.resolve(Gm);if(Km)return Xm!==Ym?Km.catch(()=>null).then(()=>i_(e,!1)):Km;return Xm=Ym,Km=async function(e,t){const[i,n]=await Promise.all([e.callWS({type:"houseplan/config/get"}),e.callWS({type:"houseplan/layout/get"})]),r=i?.rev??0,o=Gm?jc(Gm.virtualLights,i?.virtual_lights,r,!!i&&"virtual_lights"in i):Wc(i?.virtual_lights,r),s={config:i?.config??null,rev:r,decorAssetsApi:1===i?.decor_assets_api?1:null,configFingerprint:Ll(i?.config??null),layout:n?.layout??{},layoutRev:n?.rev??0,layoutFingerprint:Ll(n?.layout??{}),virtualLights:o};t===Ym&&(Gm=s);const a=e.connection;if(a?.subscribeEvents&&Zm!==a){for(const e of Jm)e();Jm=[],Zm=a;const e=()=>{Gm=null,Ym++,Qm.forEach(e=>e())},t=[];try{if(e_(await a.subscribeEvents(e,"houseplan_config_updated"),t),e_(await a.subscribeEvents(e,"houseplan_layout_updated"),t),e_(await a.subscribeEvents(e=>{if(Gm){const t=Yc(Gm.virtualLights,e?.data);if(t===Gm.virtualLights)return;Gm={...Gm,virtualLights:t}}else Ym++;Qm.forEach(e=>e())},"houseplan_virtual_light_updated"),t),Zm===a)Jm=t;else for(const e of t)e()}catch{for(const e of t)e();Zm===a&&(Zm=null)}}return s}(e,Ym).finally(()=>{Km=null,Xm=-1}),Km}const n_=3300;function r_(e,t){return{sources:e,last:Object.fromEntries(t.map(e=>[e.eid,e.state])),flashTs:0,flashKind:null,timer:0,gen:0,expiresAt:0,alarmActive:"alarm"===Nc(t).status}}function o_(e,t,i,n){n(e.timer);const r=r_(t,i);Object.assign(e,r)}function s_(e,t,i,n,r){e.flashTs&&i-e.flashTs<n_&&"event"===e.flashKind&&"transition"===t||(e.flashTs=i,e.expiresAt=i+n_,e.flashKind=t,e.gen++,n(e.timer),e.timer=r(3360))}function a_(e,t,i){"transition"===e.flashKind&&t.some(e=>"transition"===e.activity)&&(i(e.timer),e.flashTs=0,e.flashKind=null,e.expiresAt=0);if("alarm"===Nc(t).status){e.alarmActive||(i(e.timer),e.flashTs=0,e.flashKind=null,e.expiresAt=0);for(const i of t)e.last[i.eid]=i.state;return e.alarmActive=!0,null}if(e.alarmActive){for(const i of t)e.last[i.eid]=i.state;return e.alarmActive=!1,null}let n=null;for(const i of t){const t=Lc(e.last[i.eid],i);("event"===t||!n&&t)&&(n=t),e.last[i.eid]=i.state}return n}class l_{constructor(e,t=()=>{}){this._host=e,this._onGateChange=t,this._modality="unknown",this._gate=!1,this._media=null,this._connected=!1,this._onMediaChange=()=>this._syncGate()}get modality(){return this._modality}get hoverEnabled(){return this._gate}connect(e=globalThis.window){this._connected||(this._connected=!0,this._modality="unknown",this._media="function"==typeof e?.matchMedia?e.matchMedia("(any-hover: hover) and (any-pointer: fine)"):null,this._media?.addEventListener?.("change",this._onMediaChange),this._setGate(!1))}disconnect(){this._media?.removeEventListener?.("change",this._onMediaChange),this._media=null,this._connected=!1,this._modality="unknown",this._setGate(!1)}note(e){return this._modality=function(e,t){const i="mouse"===(n=t.pointerType)||"touch"===n||"pen"===n?n:null;var n;return i?"mouse"===i&&t.sourceCapabilities?.firesTouchEvents?e:i:e}(this._modality,e),this._syncGate(),this._modality}suspend(){this._setGate(!1)}_syncGate(){var e,t;this._setGate((e=this._modality,t=!!this._media?.matches,"mouse"===e&&t))}_setGate(e){this._gate!==e&&(this._gate=e,this._host.toggleAttribute("data-pointer-hover",e),this._onGateChange(e))}}const c_=new WeakMap;const h_=(e,t,i)=>255===e[i+3]&&t.every((t,n)=>Math.abs(e[i+n]-t)<=2);async function d_(e){const t=e.defaultView;if(!t||!t.CSS?.supports?.("mix-blend-mode","screen"))return!1;const i=[128,32,16],n=[16,64,128],r=[9,19,29],o=`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="1" viewBox="0 0 4 1">\n    <rect width="4" height="1" fill="rgb(${r.join(",")})"/>\n    <g style="isolation:isolate">\n      <rect x="0" width="2" height="1" fill="rgb(${i.join(",")})"/>\n      <rect x="1" width="2" height="1" fill="rgb(${n.join(",")})" style="mix-blend-mode:screen"/>\n    </g>\n  </svg>`,s=t.URL.createObjectURL(new Blob([o],{type:"image/svg+xml"}));try{const o=await new Promise((e,i)=>{const n=new t.Image,r=t.setTimeout(()=>i(new Error("SVG blend probe timeout")),1e3);n.onload=()=>{t.clearTimeout(r),e(n)},n.onerror=()=>{t.clearTimeout(r),i(new Error("SVG blend probe failed"))},n.src=s}),a=e.createElement("canvas");a.width=4,a.height=1;const l=a.getContext("2d",{willReadFrequently:!0});if(!l)return!1;l.drawImage(o,0,0,4,1);const c=l.getImageData(0,0,4,1).data;return h_(c,i,0)&&h_(c,function(e,t){return[0,1,2].map(i=>Math.round(255-(255-e[i])*(255-t[i])/255))}(i,n),4)&&h_(c,n,8)&&h_(c,r,12)}catch{return!1}finally{t.URL.revokeObjectURL(s)}}function u_(e){const t=c_.get(e);if(t)return t.promise;const i={promise:Promise.resolve(!1)};return i.promise=d_(e).catch(()=>!1).then(e=>(i.resolved=e,e)),c_.set(e,i),i.promise}function p_(e){return c_.get(e)?.resolved}class m_ extends he{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(e){this._config=e}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const e=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(e?.config?.spaces||[]).map(e=>({value:e.id,label:e.title||e.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return fu(this.hass,this._config?.language)}get _schema(){const e=this._spaces||[];return[e.length?{name:"space",selector:{select:{mode:"dropdown",options:e}}}:{name:"space",selector:{text:{}}},{name:"title",selector:{text:{}}},{name:"fit",selector:{select:{mode:"dropdown",options:[{value:"content",label:gu(this._lang,"editor.fit_content")},{value:"house",label:gu(this._lang,"editor.fit_house")}]}}},{name:"show_button",selector:{boolean:{}}},{name:"button_label",selector:{text:{}}},{name:"button_target",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"light_pools",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}}]}render(){if(!this.hass||!this._config)return V;const e=ou(this,hu,fu(this.hass,this._config.language));if("cold"===e)return su();if("warm"===e)return U;this._loadSpaces();const t=this._lang,i={space:gu(t,"editor.space"),title:gu(t,"editor.title"),fit:gu(t,"editor.framing"),show_button:gu(t,"editor.show_button"),button_label:gu(t,"editor.button_label"),button_target:gu(t,"editor.button_target"),icon_size:gu(t,"editor.icon_size"),show_temperature:gu(t,"editor.show_temperature"),live_states:gu(t,"editor.live_states"),light_pools:gu(t,"editor.light_pools"),show_signal:gu(t,"editor.show_signal")};return W`<ha-form
      .hass=${this.hass}
      .data=${{...this._config,fit:Ba(this._config.fit)}}
      .schema=${this._schema}
      .computeLabel=${e=>i[e.name]||e.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(e){const t={...this._config||{},...e.detail.value};delete t.aspect_ratio;const i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:t},this.dispatchEvent(i)}}m_.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-space-card-editor")||customElements.define("houseplan-space-card-editor",m_);const __=e=>{history.pushState(null,"",e),((e,t,i)=>{const n=new Event(t,{bubbles:!0,composed:!0});n.detail=i??{},e.dispatchEvent(n)})(window,"location-changed",{replace:!1})};class f_ extends he{constructor(){super(...arguments),this._snap=null,this._loading=!1,this._reloadQueued=!1,this._forceReloadQueued=!1,this._reloadRetryTimer=0,this._dayCycleTimer=0,this._dayCycleClockKey="",this._stageWidth=0,this._pendingStageWidth=0,this._stageWidthRaf=0,this._haRegistryConnection=null,this._haRegistryRevision=-1,this._devices=[],this._areaRelocationIds=new Set,this._decorAssets=new Map,this._continuity=this._newContinuityController(),this._continuityHistory=[],this._continuityEpoch=0,this._continuityDataReady=!0,this._continuityPaintToken=-1,this._continuityDisposed=!1,this._renderSnapshotAt=Date.now(),this._hassSequence=0,this._connHooked=null,this._connectionWasLost=!1,this._visibleDeviceSnapshot=null,this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1,this._capturedSnapshotSequence=-1,this._capturedSnapshotDevices=null,this._capturedSnapshotActivity="",this._capturedSnapshotVirtual="",this._activityRuntime=new Map,this._glowRuntimeState=km(),this._glowRuntimeHost={window:()=>this.ownerDocument.defaultView||window,isConnected:()=>this.isConnected,requestUpdate:()=>this.requestUpdate(),reducedMotion:()=>this._reducedMotion},this._glowScreenBlend=!1,this._reducedMotion=!1,this._pointerModality=new l_(this),this._onMotionChange=e=>{this._reducedMotion=e.matches,this._capturedSnapshotSequence=-1,this.requestUpdate()},this._onHaRegistryUpdate=()=>{const e=lh(this.hass).revision;e!==this._haRegistryRevision&&(this._haRegistryRevision=e,this._refreshDevices(),this._capturedSnapshotSequence=-1,this.requestUpdate())},this._dayCycleTick=()=>{if(!this.isConnected||"hidden"===this.ownerDocument.visibilityState)return;const e=this._dayCycleState();if(!e)return this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),void(this._dayCycleClockKey="");const t=qn(e);t!==this._dayCycleClockKey&&(this._dayCycleClockKey=t,this.requestUpdate())},this._pageVisibility=e=>{if(this._continuity.visibility(e),this._dayCycleVisibility(e),"hidden"!==e.kind){if(!e.long){const e=Date.now();let t=!1;for(const i of this._activityRuntime.values())!i.flashKind||(i.expiresAt||i.flashTs+3300)>e||(i.flashTs=0,i.flashKind=null,i.expiresAt=0,t=!0);return void(t&&(this._capturedSnapshotSequence=-1,this.requestUpdate()))}Date.now()-this._renderSnapshotAt>1e3&&this._continuity.note("device-snapshot-stale"),this._continuityDataReady=!1,this._continuityPaintToken=-1,this._load(!0)}else this._pointerModality.suspend()},this._onConnLost=()=>{this._connectionWasLost=!0,this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.connectionLost()},this._onConnReady=()=>{!this._connectionWasLost&&this._continuity.hasCompleteFrame?this._beginContinuityCandidate("connection-ready",!1,"plan"):(this._continuityDataReady=!1,this._continuityPaintToken=-1),this._load(!0)},this._onAssetLoaded=(e,t)=>{this._signer.markLoaded(this.hass,e,t),this._continuity.note("asset-ready"),this._continuityPaintToken=-1,"steady"!==this._continuity.state&&this.requestUpdate()},this._loadedOnce=!1,this._signer=new Wl(()=>this.requestUpdate()),this._retryContinuity=()=>{this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.retry(this._continuity.recoveryReason||"plan"),this._load(!0)},this._goToSpace=()=>{const e=(this._config?.button_target||"/plan-doma").replace(/#.*$/,"");__(`${e}#space=${encodeURIComponent(this._config.space)}`)}}_ensureHaRegistryAuthority(){const e=this.hass?.connection||null;e&&e!==this._haRegistryConnection&&(this._haRegistryRelease?.(),this._haRegistryConnection=e,this._haRegistryRevision=-1,this._haRegistryRelease=sh(this.hass,this._onHaRegistryUpdate),this._onHaRegistryUpdate())}_newContinuityController(){return new Nl(()=>{this._continuityEpoch++,this.isConnected&&this.requestUpdate()})}_dayCycleState(e=new Date){const t=this._snap?.config;if(!t||!this._config)return null;const i=t.spaces?.find(e=>e.id===this._config?.space)?.settings||{};return"daynight"!==Jn(t.settings,i)?null:Bn(this._renderDeviceSnapshot?.hass||this.hass,e)}_syncDayCycleClock(){const e=this._dayCycleState();this._dayCycleClockKey=e?qn(e):"";const t="clock"===e?.source&&"hidden"!==this.ownerDocument.visibilityState&&this.isConnected;t&&!this._dayCycleTimer?this._dayCycleTimer=window.setInterval(this._dayCycleTick,3e4):!t&&this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_dayCycleVisibility(e){"hidden"!==e.kind?(this._dayCycleTick(),this._syncDayCycleClock()):this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_hookConnection(){const e=this.hass?.connection;e&&e!==this._connHooked&&(this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),e.addEventListener?.("ready",this._onConnReady),e.addEventListener?.("disconnected",this._onConnLost),e.addEventListener?.("reconnect-error",this._onConnLost),this._connHooked=e)}static getConfigElement(){return document.createElement("houseplan-space-card-editor")}static getStubConfig(e){const t=t_();return{type:"custom:houseplan-space-card",space:Ra(t?.config||null)[0]?.id||"",show_button:!0,fit:"content",live_states:!0,show_temperature:!0,show_signal:!0,light_pools:!1}}setConfig(e){if(!e||!e.space)throw new Error('houseplan-space-card: "space" is required');this._config={show_button:!0,button_target:"/plan-doma",live_states:!0,show_temperature:!0,show_signal:!0,light_pools:!1,...e,fit:Ba(e.fit)},!0!==this._config.light_pools?Fm(this._glowRuntimeState,this._glowRuntimeHost):this.isConnected&&this._resolveGlowBlend(),this._snap=this._snap||t_()}connectedCallback(){var e;this._continuityDisposed&&(this._continuity=this._newContinuityController(),this._continuityDisposed=!1,this._continuityPaintToken=-1),super.connectedCallback(),this._pointerModality.connect(this.ownerDocument.defaultView),this._motionMedia=window.matchMedia?.("(prefers-reduced-motion: reduce)"),this._reducedMotion=!!this._motionMedia?.matches,this._motionMedia?.addEventListener?.("change",this._onMotionChange),this._resolveGlowBlend(),this.hass&&this._ensureHaRegistryAuthority(),this._continuityUnsub?.(),this._continuityUnsub=El(this.ownerDocument,this._pageVisibility),this._unsub=(e=()=>{this._beginContinuityCandidate("config-event",!1),this._reloadQueued=!0,this._load()},Qm.add(e),()=>Qm.delete(e)),this._signer.start(()=>this.hass,()=>this._referenced())}disconnectedCallback(){this._pointerModality.disconnect(),this._continuityUnsub?.(),this._continuityUnsub=void 0,this._motionMedia?.removeEventListener?.("change",this._onMotionChange),this._motionMedia=void 0,this._unsub?.(),this._unsub=void 0,window.clearTimeout(this._reloadRetryTimer),this._reloadRetryTimer=0,this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),this._dayCycleClockKey="",this._stageObserver?.disconnect(),this._stageObserver=void 0,this._observedStage=void 0,this._stageWidthRaf&&cancelAnimationFrame(this._stageWidthRaf),this._stageWidthRaf=0,this._pendingStageWidth=0,this._signer.dispose(),this._haRegistryRelease?.(),this._haRegistryRelease=void 0,this._haRegistryConnection=null,this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),this._connHooked=null;for(const e of this._activityRuntime.values())window.clearTimeout(e.timer);this._activityRuntime.clear(),Fm(this._glowRuntimeState,this._glowRuntimeHost),this._continuityHistory=[...this._continuityHistory,...this._continuity.trace].slice(-80),this._continuity.dispose(),this._continuityDisposed=!0,super.disconnectedCallback()}_resolveGlowBlend(){if(!this._config?.light_pools)return;const e=p_(this.ownerDocument);void 0!==e&&(this._glowScreenBlend=e),u_(this.ownerDocument).then(e=>{e!==this._glowScreenBlend&&(this._glowScreenBlend=e,this.isConnected&&this.requestUpdate())})}willUpdate(e){e.has("hass")&&this.hass&&(this._hassSequence++,this._renderSnapshotAt=Date.now(),this._continuity.note("hass-snapshot"),this._ensureHaRegistryAuthority(),this._hookConnection()),!this.hass||this._loading||this._snap&&!e.has("hass")||this._snap&&this._loadedOnce||this._load(),(e.has("hass")||e.has("_snap")||e.has("_config")||!this._devices.length)&&this._refreshDevices(),this._captureRenderDeviceSnapshot(),this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._continuity.refreshCompleteFrame(this._frameFingerprint())}_stampActivity(e,t){s_(e,t,Date.now(),window.clearTimeout.bind(window),e=>window.setTimeout(()=>this.requestUpdate(),e))}_syncActivity(e,t,i=this.hass){if(!1===this._config?.live_states){for(const e of this._activityRuntime.values())window.clearTimeout(e.timer);return void this._activityRuntime.clear()}const n=new Set,r=Bh(t,e,null,this._snap?.virtualLights);for(const o of e){if(o.hidden)continue;if("icon_ripple"!==ki(o.marker?.display))continue;n.add(o.id);const s=Qu(t,o,e,r,i),a=s.samples,l=ip(t,o,s);let c=this._activityRuntime.get(o.id);if(!c||c.sources!==l){c&&window.clearTimeout(c.timer),c=r_(l,a),this._activityRuntime.set(o.id,c);continue}const h=a_(c,a,window.clearTimeout.bind(window));h&&this._stampActivity(c,h)}for(const[e,t]of this._activityRuntime)n.has(e)||(window.clearTimeout(t.timer),this._activityRuntime.delete(e))}_refreshDevices(){if(!this.hass||!this._snap?.config||!this._config)return;const e=lh(this.hass),t=Um({hass:this.hass,registry:e,cfg:this._snap.config,lang:this._lang});e.authoritative&&(this._areaRelocationIds=Kp({devices:t,model:Ra(this._snap.config),layout:this._snap.layout||{},snapshot:this._snap.config.settings?.marker_area_snapshot,authoritative:!0}).relocateIds),this._syncActivity(t,uh(this.hass,e),this.hass),this._devices=t}_captureRenderDeviceSnapshot(){if(!this.hass)return;const e=Date.now(),t=[...this._activityRuntime.entries()].map(([t,i])=>`${t}:${i.gen}:${i.flashTs}:`+(i.flashKind&&(i.expiresAt||i.flashTs+3300)>e?1:0)).join("|"),i=this._snap?.virtualLights?`${this._snap.virtualLights.configRev}:${this._snap.virtualLights.rev}`:"";if(this._capturedSnapshotSequence===this._hassSequence&&this._capturedSnapshotDevices===this._devices&&this._capturedSnapshotActivity===t&&this._capturedSnapshotVirtual===i)return;const n=uh(this.hass,lh(this.hass)),r=new Map,o=new Set(["sun.sun"]),s=new Set,a=new Set,l=e=>{if(!e)return;const t=e.indexOf(":");if(t<0)return void o.add(e);const i=e.slice(0,t),n=e.slice(t+1);"device"===i?s.add(n):"entity"===i&&o.add(n)},c=Ra(this._snap?.config||null).find(e=>e.id===this._config?.space);for(const e of c?.rooms||[])e.area&&a.add(e.area),l(e.settings?.temp_source),l(e.settings?.hum_source);const h=this._snap?.config?.spaces?.find(e=>e.id===this._config?.space);for(const e of h?.openings||[])for(const t of Kt(e))o.add(t);const d=Bh(n,this._devices,null,this._snap?.virtualLights);for(const e of this._devices)for(const t of[!1,!0])r.set(lp(e.id,t),rp(n,e,{liveStates:!1!==this._config?.live_states,showTemperature:!1!==this._config?.show_temperature,showSignal:t,activityRuntime:this._activityRuntime.get(e.id),sourceDetails:!1,lightDevices:this._devices,lightSources:d,registryHass:this.hass,reducedMotion:this._reducedMotion}));const u=ap({sourceSequence:this._hassSequence,hass:n,devices:this._devices,presentations:r,entityIds:o,deviceIds:s,areaIds:a});this._capturedSnapshotSequence=this._hassSequence,this._capturedSnapshotDevices=this._devices,this._capturedSnapshotActivity=t,this._capturedSnapshotVirtual=i,this._visibleDeviceSnapshot&&"steady"!==this._continuity.state?this._candidateDeviceSnapshot=u:(this._visibleDeviceSnapshot=u,this._candidateDeviceSnapshot=null)}get _renderDeviceSnapshot(){return this._stagedDeviceSnapshotToken===this._continuity.token?this._candidateDeviceSnapshot||this._visibleDeviceSnapshot:this._visibleDeviceSnapshot||this._candidateDeviceSnapshot}_beginContinuityCandidate(e,t,i="plan"){return this._continuityDataReady=t,this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._continuity.beginCandidate(e,i)}_backdropRaw(){return this._snap?.config&&this._config&&Ra(this._snap.config).find(e=>e.id===this._config.space)?.bg?.href||""}_candidateBackdrop(e){return e&&this._config&&Ra(e).find(e=>e.id===this._config.space)?.bg?.href||""}_assetsReady(){const e=this._backdropRaw();return!e||this._signer.isReady(this.hass,e)}_frameFingerprint(){const e=this._snap;return Bl([e?.rev||0,e?.configFingerprint||Ll(e?.config),e?.layoutRev||0,e?.layoutFingerprint||Ll(e?.layout),e?.virtualLights?`${e.virtualLights.configRev}:${e.virtualLights.rev}`:"",this._config?.space||"",!0===this._config?.light_pools,this._stageWidth,this.hass?.themes?.darkMode??this.hass?.themes?.default_theme??""])}_stageValid(){const e=this._observedStage;return!!e&&e.clientWidth>0&&e.clientHeight>0}_settleContinuityFrame(){if(!this._stageValid())return;if(!this._continuity.hasCompleteFrame&&"steady"===this._continuity.state){if(this._assetsReady())return this._renderSnapshotAt=Date.now(),void this._continuity.markCompleteFrame(this._frameFingerprint());this._beginContinuityCandidate("asset-wait",!0,"asset")}if(!this._continuityDataReady)return;if(!["holding","offline-stale","overlay-pending","overlay-visible","candidate-ready"].includes(this._continuity.state))return;const e=this._continuity.token;if(this._candidateDeviceSnapshot&&this._candidateDeviceSnapshot!==this._visibleDeviceSnapshot&&this._stagedDeviceSnapshotToken!==e)return this._stagedDeviceSnapshotToken=e,void this.requestUpdate();this._continuityPaintToken!==e&&(this._continuityPaintToken=e,this._continuity.candidateReady(e)&&this._continuity.commitAfterPaint(e,{updateComplete:()=>this.updateComplete,stageValid:()=>this.isConnected&&this._stageValid(),assetsReady:()=>this._assetsReady(),frameFingerprint:()=>this._frameFingerprint()}).then(t=>{t&&e===this._continuity.token?(this._renderSnapshotAt=Date.now(),this._candidateDeviceSnapshot&&(this._visibleDeviceSnapshot=this._candidateDeviceSnapshot),this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1):e===this._continuity.token&&(this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._candidateDeviceSnapshot=null,this.requestUpdate())}))}updated(){const e=this.renderRoot.querySelector(".hp-static-stage")||void 0;if(e!==this._observedStage)if(this._stageObserver?.disconnect(),this._observedStage=e,e){const t=()=>{const i=e.clientWidth;if(!(i<=0||Math.abs(i-this._stageWidth)<=.5)){if(this._stageWidth<=0)return this._stageWidth=i,void this.requestUpdate();this._pendingStageWidth=i,this._stageWidthRaf||(this._stageWidthRaf=requestAnimationFrame(()=>{this._stageWidthRaf=0;const e=this._pendingStageWidth;this._pendingStageWidth=0,!e||!this._observedStage||this._observedStage.clientWidth<=0||(Math.abs(this._observedStage.clientWidth-e)>.5?t():Math.abs(e-this._stageWidth)<=.5||(this._continuity.hasCompleteFrame&&this._beginContinuityCandidate("stage-resize",!0,"stage-size"),this._stageWidth=e,this.requestUpdate()))}))}};this._stageObserver=new ResizeObserver(t),this._stageObserver.observe(e),t()}else this._stageObserver=void 0;this._syncDayCycleClock(),this._settleContinuityFrame()}async _load(e=!1){if(this.hass){if(this._loading)return this._reloadQueued=!0,void(this._forceReloadQueued||=e);this._loading=!0,this._reloadQueued=!1;try{const t=await i_(this.hass,e),i=!this._snap||this._snap.configFingerprint!==t.configFingerprint,n=!this._snap||this._snap.layoutFingerprint!==t.layoutFingerprint,r=!this._snap||this._snap.virtualLights!==t.virtualLights,o=!this._snap||this._snap.decorAssetsApi!==t.decorAssetsApi;if(1!==t.decorAssetsApi&&(this._decorAssets=new Map),i&&!await this._signer.prepareImage(this.hass,this._candidateBackdrop(t.config)))return this._continuity.note("asset-failed"),window.clearTimeout(this._reloadRetryTimer),void(this._reloadRetryTimer=window.setTimeout(()=>{this._load(!0)},1e3));if(window.clearTimeout(this._reloadRetryTimer),this._reloadRetryTimer=0,(i||n)&&this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._beginContinuityCandidate("structural-response",!0),i||n||r||o?this._snap=t:this._snap&&(this._snap.rev=t.rev,this._snap.layoutRev=t.layoutRev),i&&this._continuity.note("config-candidate",{configRev:t.rev}),1===t.decorAssetsApi)try{this._decorAssets=await tm(this.hass,Jp(t.config),t.rev)}catch{}n&&this._continuity.note("layout-candidate",{layoutRev:t.layoutRev}),r&&(this._capturedSnapshotSequence=-1),this._loadedOnce=!0,this._connectionWasLost=!1,this._continuityDataReady=!0,this._refreshDevices()}catch{}finally{if(this._loading=!1,this._continuityDataReady=!0,this.requestUpdate(),this._reloadQueued){const e=this._forceReloadQueued;this._reloadQueued=!1,this._forceReloadQueued=!1,this._load(e)}}}}get _lang(){return fu(this.hass,this._config?.language)}getCardSize(){const e=Ra(this._snap?.config||null).find(e=>e.id===this._config?.space);if(e){const t=e.vb[3]/e.vb[2];return Math.max(3,Math.round(8*t))+(!1===this._config?.show_button?0:1)}return 6}_errorCard(e){return W`<ha-card
      data-continuity-state=${this._continuity.state}
      data-continuity-token=${this._continuity.token}
      data-frame-fingerprint=${this._continuity.frameFingerprint||V}
      data-recovery-reason=${(this._continuity.overlayVisible||"recovery-error"===this._continuity.state)&&this._continuity.recoveryReason||V}>
        <div class="hp-static-error">${e}</div>
      </ha-card>`}_referenced(){const e=gn(this._snap?.config);for(const t of this._decorAssets.values())e.add(t.url);return e}_renderRecoveryOverlay(){if(!this._continuity.overlayVisible&&"recovery-error"!==this._continuity.state)return V;const e="connection"===this._continuity.recoveryReason;return W`<div class="recoveryoverlay phase-${this._continuity.overlayPhase}"
      role="status" aria-live="polite" aria-atomic="true">
        <ha-icon icon="mdi:home-sync-outline"></ha-icon>
        <span>${gu(this._lang,e?"continuity.restore_connection":"continuity.restore_plan")}</span>
        ${"recovery-error"===this._continuity.state?W`<button class="btn on" @click=${this._retryContinuity}>${gu(this._lang,"continuity.retry")}</button>`:V}
      </div>`}houseplanContinuityTrace(){return[...this._continuityHistory,...this._continuity.trace].slice(-80).map(e=>({...e,...e.stage?{stage:[...e.stage]}:{}}))}render(){if(!this._config||!this.hass)return V;const e=ou(this,hu,fu(this.hass,this._config.language));if("cold"===e)return su();if("warm"===e)return U;const t=this._snap?.config;if(!t)return this._errorCard(gu(this._lang,"space_card.loading"));const i=this._config.space,n=Ra(t).find(e=>e.id===i),r=void 0!==this._config.title?this._config.title:n?.title||"",o=this._renderDeviceSnapshot,s=Vm({hass:o?.hass||this.hass,cfg:t,layout:this._snap?.layout||{},spaceId:i,iconSize:this._config.icon_size,fit:this._config.fit,compactTopFrame:""===this._config.title||null===this._config.title,stageWidth:this._stageWidth,lang:this._lang,displayUrl:e=>this._signer.display(this.hass,e),decorAssetUrl:e=>this._decorAssets.get(e)?.url||"",assetLoaded:this._onAssetLoaded,registry:o?{revision:o.sourceSequence,authoritative:!1,access:"limited",entities:{...o.hass.entities},devices:{...o.hass.devices},lastSuccess:o.capturedAt}:lh(this.hass),devices:[...o?.devices||this._devices],areaRelocationIds:this._areaRelocationIds,presentations:o?.presentations,activityRuntime:this._activityRuntime,reducedMotion:this._reducedMotion,virtualLights:this._snap?.virtualLights,lightPools:!0===this._config.light_pools,glowRuntime:{state:this._glowRuntimeState,host:this._glowRuntimeHost,screenBlend:this._glowScreenBlend},liveStates:!1!==this._config.live_states,showTemperature:!1!==this._config.show_temperature,showSignal:!1!==this._config.show_signal,inert:this._continuity.overlayBlocksInteraction});if(!s)return this._errorCard(gu(this._lang,"space_card.not_found",{id:i}));const a=!1!==this._config.show_button,l=this._config.button_label||gu(this._lang,"space_card.button"),c=this._continuity.overlayVisible||"recovery-error"===this._continuity.state?this._continuity.recoveryReason:null;return W`
      <ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint||V}
        data-device-snapshot-sequence=${o?.sourceSequence??V}
        data-recovery-reason=${c||V}
        @pointerover=${e=>this._pointerModality.note(e)}
        @pointerdown=${e=>this._pointerModality.note(e)}
        @pointermove=${e=>this._pointerModality.note(e)}>
        ${r?W`<div class="hp-static-title">${r}</div>`:V}
        <div class="hp-static-body">
          ${s}
          ${this._renderRecoveryOverlay()}
        </div>
        ${a?W`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${l}</button>
            </div>`:V}
      </ha-card>
    `}}f_.properties={hass:{attribute:!1},_config:{state:!0},_snap:{state:!0},_continuityEpoch:{state:!0}},f_.styles=[tu,o`
      .hp-static-title {
        font-weight: 700;
        padding: 10px 14px 6px;
        font-size: 16px;
        color: var(--primary-text-color);
      }
      .hp-static-body {
        position: relative;
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
        z-index: 1;
      }
      /* Opaque plan paper — the scene bg_color/day-cycle environment shows only AROUND
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
        stroke-width: calc(0.6px * var(--hp-cell-visual-scale, 1));
        pointer-events: none;
      }
      .wallbody.solid {
        fill: none;
      }
      .hp-static-stage .devlayer {
        position: absolute;
        inset: 0;
        z-index: 2;
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
      :host([data-pointer-hover]) .hp-static-btn:hover {
        filter: brightness(1.08);
      }
      .hp-static-error {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color, #9aa4ad);
      }
    `],customElements.get("houseplan-space-card")||customElements.define("houseplan-space-card",f_),window.customCards=window.customCards||[],window.customCards.find(e=>"houseplan-space-card"===e.type)||window.customCards.push({type:"houseplan-space-card",name:"House Plan — Space (static)",description:"Read-only live schematic of a single houseplan space, with a deep-link button.",preview:!1,documentation:"https://github.com/Matysh/houseplan-card"});const g_=o`
  :host {
    --hp-editor-tray-bg-fallback: color-mix(in srgb, var(--card-background-color, var(--hp-bg)) 94%, var(--hp-line));
    --hp-editor-tray-bg: color-mix(in srgb, var(--card-background-color, var(--hp-bg)) 86%, transparent);
    --hp-editor-tray-border: color-mix(in srgb, var(--hp-line) 82%, var(--hp-accent));
    --hp-editor-tray-blur: 8px;
    --hp-editor-tray-shadow: var(--shadow-2);
  }

  /* Contextual editor controls float over the stage. Their appearance must
     never alter stage height, viewport fitting or the pinned close action. */
  .editor-secondary-host {
    position: absolute;
    inset: var(--sp-2) var(--sp-4) auto;
    z-index: 70;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
  }
  .editor-secondary-host.kind-palette,
  .editor-secondary-host.kind-group {
    justify-content: flex-start;
  }
  .editor-secondary {
    pointer-events: none;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    color: var(--hp-txt);
    background: var(--card-background-color, var(--hp-bg));
    background: var(--hp-editor-tray-bg-fallback);
    border: 1px solid var(--hp-line);
    border-color: var(--hp-editor-tray-border);
    border-radius: var(--rad-l);
    box-shadow: var(--hp-editor-tray-shadow);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition:
      opacity 0.1s ease,
      transform 0.1s cubic-bezier(0.2, 0.7, 0.2, 1),
      visibility 0s linear 0.1s;
    touch-action: auto;
  }
  .editor-secondary-host.open .editor-secondary {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition-duration: 0.14s, 0.14s, 0s;
    transition-delay: 0s;
  }
  .editor-secondary-host.blocked .editor-secondary { pointer-events: none; }
  @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .editor-secondary {
      background: var(--hp-editor-tray-bg);
      -webkit-backdrop-filter: blur(var(--hp-editor-tray-blur));
      backdrop-filter: blur(var(--hp-editor-tray-blur));
    }
  }
  .editor-secondary-content,
  .editor-group-items {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }
  .editor-context-label {
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-inline-end: var(--sp-4);
    border-inline-end: 1px solid var(--hp-line);
    color: var(--hp-muted);
    font-size: var(--fs-s);
  }
  .editor-secondary.kind-palette {
    width: min(760px, 100%);
    align-items: stretch;
    padding: 0;
    overflow: hidden;
  }
  .editor-secondary.kind-palette .editor-secondary-content,
  .editor-secondary.kind-palette .furnpalette {
    width: 100%;
  }
  .editor-secondary.kind-palette .furnpalette {
    max-height: 38vh;
    border: 0;
    background: transparent;
  }
  .editor-group-launcher .group-chevron {
    --mdc-icon-size: 16px;
    transition: transform 0.14s ease;
  }
  .editor-group-launcher[aria-expanded="true"] .group-chevron { transform: rotate(180deg); }

  .editor-secondary .bdhint {
    font-size: var(--fs-s);
    color: var(--hp-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .editor-secondary .dfill {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-s);
    cursor: pointer;
  }
  .editor-secondary .dfill input[type="checkbox"] {
    width: 16px;
    height: 16px;
    flex: none;
    margin: 0;
    padding: 0;
  }
  .editor-secondary hp-color-opacity { flex: 0 0 auto; }
  .editor-secondary input {
    width: 74px;
    background: transparent;
    border: 1px solid var(--hp-line);
    color: var(--hp-txt);
    border-radius: var(--rad-s);
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--fs-m);
  }
  .editor-secondary label,
  .editor-secondary .hint {
    color: var(--hp-muted);
    font-size: var(--fs-s);
  }
  .editor-secondary .drawwall {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    white-space: nowrap;
  }
  .editor-secondary .drawwall input { width: 4.2em; }
  .editor-secondary .drawwall .opl {
    color: var(--hp-muted);
    font-size: var(--fs-s);
  }

  @container (min-width: 560px) and (max-width: 899px) {
    .editor-secondary-content,
    .editor-group-items {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
  @container (max-width: 559px) {
    .editor-secondary-host { inset-inline: var(--sp-4); }
    .editor-secondary { max-width: 100%; }
    .editor-secondary-content,
    .editor-group-items {
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .editor-secondary-content > *,
    .editor-group-items > * { flex: none; }
    .editor-context-label { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .editor-secondary { transition: none; }
    .editor-group-launcher .group-chevron { transition: none; }
  }
`;function v_(e,t){return e.catch(()=>{}).then(t)}function y_(e,t,i,n,r){return{previous:JSON.parse(JSON.stringify(e)),previousFingerprint:i,revision:n,attempted:t,attemptedFingerprint:r(t)}}function b_(e,t,i){const n=e._serverCfg;return!(!n||e._cfgRev!==t.revision||n!==t.attempted&&i(n)!==t.attemptedFingerprint)&&(e._serverCfg=t.previous,e._cfgContentFingerprint=t.previousFingerprint,e.requestUpdate(),!0)}class w_{constructor(e=50){this._undo=[],this._redo=[],this._limit=Math.max(30,Math.floor(e))}get canUndo(){return this._undo.length>0}get canRedo(){return this._redo.length>0}get undoName(){return this._undo[this._undo.length-1]?.name??null}get redoName(){return this._redo[this._redo.length-1]?.name??null}get size(){return this._undo.length}push(e){this._undo.push(e),this._undo.length>this._limit&&this._undo.splice(0,this._undo.length-this._limit),this._redo=[]}undo(){const e=this._undo.pop()??null;return e&&this._redo.push(e),e}redo(){const e=this._redo.pop()??null;return e&&this._undo.push(e),e}removeWhere(e){const t=this._undo.length,i=this._redo.length;return this._undo=this._undo.filter(t=>!e(t)),this._redo=this._redo.filter(t=>!e(t)),t+i-this._undo.length-this._redo.length}clear(){this._undo=[],this._redo=[]}}function k_(e,t){const i=e[t];return i&&Number.isFinite(i.x)&&Number.isFinite(i.y)?{x:i.x,y:i.y,..."string"==typeof i.s?{s:i.s}:{}}:null}function x_(e,t,i){if(null===i){if(!(t in e))return e;const i={...e};return delete i[t],i}const n={...e[t]||{}};delete n.x,delete n.y,delete n.s;const r={...n,x:i.x,y:i.y,...void 0!==i.s?{s:i.s}:{}};return{...e,[t]:r}}const $_={now:()=>performance.now(),requestFrame:e=>requestAnimationFrame(e),cancelFrame:e=>cancelAnimationFrame(e)},S_=e=>Math.max(0,Math.min(1,e)),M_=(e,t,i)=>e+(t-e)*i,C_=(e,t,i)=>{const n=1-e;return 3*n*n*e*t+3*n*e*e*i+e*e*e},T_=e=>{const t=S_(e);if(0===t||1===t)return t;let i=0,n=1,r=t;for(let e=0;e<12;e++)r=(i+n)/2,C_(r,.2,.2)<t?i=r:n=r;return C_(r,.7,1)};function R_(e,t){return{centerX:e.x+e.w/2,centerY:e.y+e.h/2,pixelsPerUnit:t>0&&e.w>0?t/e.w:1,viewBox:{...e}}}function D_(e,t,i){const n=Math.max(1e-9,e.pixelsPerUnit),r=Math.max(1e-9,t/n),o=Math.max(1e-9,i/n);return{x:e.centerX-r/2,y:e.centerY-o/2,w:r,h:o}}function z_(e){const t=e.trim(),i=/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(t);if(i)return[Number(i[1]),Number(i[2]),Number(i[3]),null==i[4]?1:Number(i[4])];const n=/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t)?.[1];return n?[parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16),8===n.length?parseInt(n.slice(6,8),16)/255:1]:null}function A_(e,t,i){const n=z_(e),r=z_(t);if(!n||!r)return i<.5?e:t;const o=S_(i);return`rgba(${Math.round(M_(n[0],r[0],o))}, ${Math.round(M_(n[1],r[1],o))}, ${Math.round(M_(n[2],r[2],o))}, ${M_(n[3],r[3],o).toFixed(3)})`}class P_{constructor(e,t=$_){this._hooks=e,this._clock=t,this._token=0,this._raf=0,this._state=null}get state(){return this._state}get active(){return"running"===this._state?.phase||"preparing"===this._state?.phase}get presented(){return this._state?.presented||null}start(e,t,i,n=220){this.cancel(!1);const r=++this._token,o=this._clock.now();if(this._state={token:r,phase:n<=0?"settling":"running",from:e,to:t,presented:n<=0?t:e,startedAt:o,duration:Math.max(0,n),targetMode:i},n<=0)return this._hooks.frame(this._state),this._hooks.settled(this._state),this._state=null,r;this._hooks.frame(this._state);const s=e=>{const t=this._state;if(!t||t.token!==r)return;const i=S_((e-t.startedAt)/t.duration);t.presented=i>=1?t.to:function(e,t,i){const n=T_(i),r=M_(e.stageWidth,t.stageWidth,n),o=M_(e.stageHeight,t.stageHeight,n),s=Math.max(1e-9,e.viewport.pixelsPerUnit),a=Math.max(1e-9,t.viewport.pixelsPerUnit),l={centerX:M_(e.viewport.centerX,t.viewport.centerX,n),centerY:M_(e.viewport.centerY,t.viewport.centerY,n),pixelsPerUnit:Math.exp(M_(Math.log(s),Math.log(a),n))};return{presentedMode:n<.5?e.presentedMode:t.presentedMode,editorChromeHeight:M_(e.editorChromeHeight,t.editorChromeHeight,n),stageWidth:r,stageHeight:o,viewport:{...l,viewBox:D_(l,r,o)},stageColor:A_(e.stageColor,t.stageColor,n),paperColor:A_(e.paperColor,t.paperColor,n),sceneBrightness:M_(e.sceneBrightness,t.sceneBrightness,n),architectureOpacity:M_(e.architectureOpacity,t.architectureOpacity,n),backdropOpacity:M_(e.backdropOpacity,t.backdropOpacity,n),viewWeight:M_(e.viewWeight,t.viewWeight,n),editorWeight:M_(e.editorWeight,t.editorWeight,n),toolbarContentOpacity:M_(e.toolbarContentOpacity,t.toolbarContentOpacity,n)}}(t.from,t.to,i),t.phase=i>=1?"settling":"running",this._hooks.frame(t),i<1?this._raf=this._clock.requestFrame(s):(this._raf=0,this._hooks.settled(t),this._state?.token===r&&(this._state=null))};return this._raf=this._clock.requestFrame(s),r}cancel(e=!0){this._raf&&this._clock.cancelFrame(this._raf),this._raf=0;const t=this._state;this._state=null,this._token++,t&&e&&(t.phase="settling",t.presented=t.to,this._hooks.frame(t),this._hooks.settled(t))}dispose(){this.cancel(!1)}}const O_={now:()=>"undefined"!=typeof performance?performance.now():Date.now(),requestFrame:e=>"function"==typeof requestAnimationFrame?requestAnimationFrame(e):null,cancelFrame:e=>{"function"==typeof cancelAnimationFrame&&cancelAnimationFrame(e)}},F_=e=>Number.isFinite(e);function I_(e){return!!e&&F_(e.zoom)&&e.zoom>0&&F_(e.viewBox.x)&&F_(e.viewBox.y)&&F_(e.viewBox.w)&&e.viewBox.w>0&&F_(e.viewBox.h)&&e.viewBox.h>0}function E_(e){return{zoom:e.zoom,viewBox:{...e.viewBox}}}function H_(e,t){return Math.abs(e.zoom-t.zoom)<1e-9&&Math.abs(e.viewBox.x-t.viewBox.x)<1e-6&&Math.abs(e.viewBox.y-t.viewBox.y)<1e-6&&Math.abs(e.viewBox.w-t.viewBox.w)<1e-6&&Math.abs(e.viewBox.h-t.viewBox.h)<1e-6}const N_=(e,t,i)=>e+(t-e)*i,L_=(e,t,i)=>Math.exp(N_(Math.log(e),Math.log(t),i));class B_{constructor(e,t=O_){this._hooks=e,this._clock=t,this._token=0,this._raf=null,this._state=null}get state(){return this._state}get active(){return"running"===this._state?.phase}get presented(){return this._state?.presented||null}get target(){return this._state?.to||null}start(e,t,i,n){this.cancel(!1);const r=++this._token,o=E_(e),s=E_(t),a=n>0&&I_(o)&&I_(s),l=this._clock.now(),c={token:r,phase:a?"running":"settling",from:o,to:s,presented:E_(a?o:s),startedAt:l,duration:a?n:0,reason:i};if(this._state=c,this._hooks.frame(c),!a)return this._settle(r),r;const h=e=>{const t=this._state;if(!t||t.token!==r)return;const i=Math.max(0,Math.min(1,(e-t.startedAt)/t.duration));if(t.presented=i>=1?E_(t.to):function(e,t,i){if(!I_(e))return E_(t);if(!I_(t))return E_(e);const n=T_(i);if(n<=0)return E_(e);if(n>=1)return E_(t);const r=e.viewBox.x+e.viewBox.w/2,o=e.viewBox.y+e.viewBox.h/2,s=t.viewBox.x+t.viewBox.w/2,a=t.viewBox.y+t.viewBox.h/2,l=L_(e.viewBox.w,t.viewBox.w,n),c=L_(e.viewBox.h,t.viewBox.h,n),h=N_(r,s,n),d=N_(o,a,n);return{zoom:L_(e.zoom,t.zoom,n),viewBox:{x:h-l/2,y:d-c/2,w:l,h:c}}}(t.from,t.to,i),t.phase=i>=1?"settling":"running",this._hooks.frame(t),i>=1)return this._raf=null,void this._settle(r);this._raf=this._clock.requestFrame(h),null===this._raf&&this._settle(r)};return this._raf=this._clock.requestFrame(h),null===this._raf&&(c.phase="settling",c.presented=E_(s),this._hooks.frame(c),this._settle(r)),r}cancel(e=!0){null!==this._raf&&this._clock.cancelFrame(this._raf),this._raf=null;const t=this._state;this._state=null,this._token++,t&&e&&(t.phase="settling",t.presented=E_(t.to),this._hooks.frame(t),this._hooks.settled(t))}dispose(){this.cancel(!1)}_settle(e){const t=this._state;t&&t.token===e&&(t.phase="settling",t.presented=E_(t.to),this._hooks.settled(t),this._state?.token===e&&(this._state=null))}}function q_(e,t){return`${e("editor.load_failed")} ${e(t.terminal?"editor.refresh_advice":"editor.retry_advice")}`}class W_ extends Error{}class j_{constructor(e){this.options=e,this._state="idle",this._inFlight=null}get state(){return this._state}ensure(){return"ready"===this._state?Promise.resolve(!0):"failed"===this._state?Promise.resolve(!1):(this._inFlight||(this._setState("loading"),this._inFlight=this._loadWithRetry().finally(()=>{this._inFlight=null})),this._inFlight)}async _loadWithRetry(){let e=new Error("Editor runtime did not load"),t=!1;for(const i of[0,1])try{const e=await this.options.load(i);if(e.fingerprint!==this.options.expectedFingerprint)throw new W_(`Editor runtime fingerprint mismatch: expected ${this.options.expectedFingerprint}, got ${e.fingerprint}`);const t=e.create();return this.options.install(t),this._setState("ready"),!0}catch(i){e=i,i instanceof W_&&(t=!0)}return this._setState(t?"failed":"idle"),this.options.failed?.(e,{terminal:t}),!1}_setState(e){e!==this._state&&(this._state=e,this.options.stateChanged?.(e))}}const U_="houseplan_card_labs_v1",V_=Object.freeze([Object.freeze({id:"iso",issue:89,since:"1.62.0",expires:"1.65.0",summary:"Volumetric plan renderer"})]);function G_(e){const t=/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(String(e||"").trim());if(!t)return null;const i=t.slice(1).map(Number);return i.every(e=>Number.isSafeInteger(e))?i:null}function K_(e,t){for(let i=0;i<3;i++)if(e[i]!==t[i])return e[i]<t[i]?-1:1;return 0}function Y_(e){if(!/^[a-z][a-z0-9-]*$/.test(e.id)||!Number.isInteger(e.issue)||e.issue<=0||!e.summary.trim())return!1;const t=G_(e.since),i=G_(e.expires);return!!t&&!!i&&K_(t,i)<0}function X_(e){const t=new Set;for(const i of e){if(!Y_(i)||t.has(i.id))return!1;t.add(i.id)}return!0}function Z_(e){const t=String(e||"").replace(/^#/,"");return new URLSearchParams(t)}function J_(e){return Z_(e).get("space")||""}function Q_(e){return e.getAll("hp-labs").flatMap(e=>e.split(",")).map(e=>e.trim()).filter(Boolean)}function ef(e,t,i,n=V_){const r=function(e,t=V_){const i=G_(e),n=new Map;if(!i||!X_(t))return n;for(const e of t){const t=G_(e.since),r=G_(e.expires);K_(i,t)>=0&&K_(i,r)<0&&n.set(e.id,e)}return n}(i,n),o=new Set(X_(n)?n.map(e=>e.id):[]),s=new Set(function(e){if(!e)return[];try{const t=JSON.parse(e);return Array.isArray(t)?t.filter(e=>"string"==typeof e):[]}catch{return[]}}(t).filter(e=>r.has(e)));let a=!1;const l=e=>{if("off"===e)return s.clear(),void(a=!0);const t=e.startsWith("-"),i=t?e.slice(1):e;o.has(i)&&(a=!0,t||!r.has(i)?s.delete(i):s.add(i))};for(const t of Q_(new URLSearchParams(String(e.search||"").replace(/^\?/,""))))l(t);for(const t of Q_(Z_(e.hash)))l(t);const c=Object.freeze([...s].sort());return{active:c,space:J_(e.hash),persist:a?JSON.stringify(c):void 0,knownUrlOperation:a}}let tf={active:Object.freeze([]),space:""},nf="",rf=!1,of="";const sf=new Set;function af(){if("undefined"==typeof window)return tf;const e=ef(window.location,function(){try{return window.localStorage.getItem(U_)}catch{return null}}(),nf);void 0!==e.persist&&function(e){try{window.localStorage.setItem(U_,e)}catch{}}(e.persist),tf={active:e.active,space:e.space},window.__hpLabs=e.active;for(const e of sf)e(tf);return tf}function lf(){af()}function cf(e){if(nf=e,"undefined"==typeof window)return tf;if(!rf){rf=!0,window.__hpLabsListenerCleanup?.(),window.addEventListener("hashchange",lf),window.addEventListener("popstate",lf);const e=()=>{window.removeEventListener("hashchange",lf),window.removeEventListener("popstate",lf),window.__hpLabsListenerCleanup===e&&delete window.__hpLabsListenerCleanup};window.__hpLabsListenerCleanup=e}return af()}const hf=Object.freeze({rotDeg:0,tiltDeg:20,xyScale:1,zScale:1,origin:Object.freeze([500,500])});function df(e){return[e.rotDeg,e.tiltDeg,e.xyScale,e.zScale,e.origin[0],e.origin[1]].every(Number.isFinite)&&Math.abs(e.xyScale)>1e-12&&Math.abs(Math.cos(e.tiltDeg*Math.PI/180))>1e-12}function uf(e,t,i=hf){if(!(df(i)&&Number.isFinite(e[0])&&Number.isFinite(e[1])&&Number.isFinite(t)))throw new Error("invalid isometric projection input");const n=i.rotDeg*Math.PI/180,r=i.tiltDeg*Math.PI/180,o=e[0]-i.origin[0],s=e[1]-i.origin[1],a=(o*Math.cos(n)-s*Math.sin(n))*i.xyScale,l=(o*Math.sin(n)+s*Math.cos(n))*i.xyScale;return[i.origin[0]+a,i.origin[1]+l*Math.cos(r)-t*i.zScale*Math.sin(r)]}function pf(e,t=hf){if(!df(t)||!Number.isFinite(e[0])||!Number.isFinite(e[1]))throw new Error("invalid isometric projection input");const i=t.rotDeg*Math.PI/180,n=t.tiltDeg*Math.PI/180,r=(e[0]-t.origin[0])/t.xyScale,o=(e[1]-t.origin[1])/(t.xyScale*Math.cos(n));return[t.origin[0]+r*Math.cos(i)+o*Math.sin(i),t.origin[1]-r*Math.sin(i)+o*Math.cos(i)]}function mf(e=hf){return`matrix(${function(e=hf){if(!df(e))throw new Error("invalid isometric camera");const t=e.rotDeg*Math.PI/180,i=e.tiltDeg*Math.PI/180,n=e.xyScale*Math.cos(t),r=-e.xyScale*Math.sin(t),o=e.xyScale*Math.sin(t)*Math.cos(i),s=e.xyScale*Math.cos(t)*Math.cos(i);return[n,o,r,s,e.origin[0]-n*e.origin[0]-r*e.origin[1],e.origin[1]-o*e.origin[0]-s*e.origin[1]]}(e).map(e=>Number(e.toFixed(12))).join(" ")})`}function _f(e,t=hf){const{rect:i,wallHeight:n}=e,r=e.openingHeight??n,o=e.floorDepth??0;if(!(i.w>=0)||!(i.h>=0)||!Number.isFinite(n)||!Number.isFinite(r)||!Number.isFinite(o)||n<0||r<0||o<0)throw new Error("invalid isometric frame");const s=[[i.x,i.y],[i.x+i.w,i.y],[i.x+i.w,i.y+i.h],[i.x,i.y+i.h]],a=Math.max(n,r),l=s.flatMap(e=>[uf(e,-o,t),uf(e,a,t)]),c=l.map(e=>e[0]),h=l.map(e=>e[1]),d=Math.min(...c),u=Math.min(...h);return{x:d,y:u,w:Math.max(...c)-d,h:Math.max(...h)-u}}const ff=e=>`${Number(e[0].toFixed(4))} ${Number(e[1].toFixed(4))}`;function gf(e){let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return t/2}function vf(e,t){const i=function(e){const t=(Array.isArray(e)?e:[]).filter(e=>Array.isArray(e)&&Number.isFinite(e[0])&&Number.isFinite(e[1])).map(e=>[Number(e[0]),Number(e[1])]),i=t[t.length-1];return t.length>1&&t[0][0]===i[0]&&t[0][1]===i[1]&&t.pop(),t}(e);if(i.length<3)return[];const n=!t;return gf(i)>0===n?i:[...i].reverse()}function yf(e,t,i){return e.length?`M ${e.map(e=>ff(uf(e,i,t))).join(" L ")} Z`:""}function bf(e,t,i){const n=t[1]-e[1],r=-(t[0]-e[0]),o=i.rotDeg*Math.PI/180;return n*Math.sin(o)+r*Math.cos(o)}function wf(e,t,i=hf){if(!Number.isFinite(t)||t<0)throw new Error("invalid floor edge height");const n=(e||[]).map(e=>(e||[]).map((e,t)=>function(e,t){const i=vf(e,t);if(!i.length)return i;let n=0;for(let e=1;e<i.length;e++)(i[e][0]<i[n][0]||i[e][0]===i[n][0]&&i[e][1]<i[n][1])&&(n=e);return[...i.slice(n),...i.slice(0,n)]}(e,t>0)).filter(e=>e.length>=3&&Math.abs(gf(e))>=1e-9)).filter(e=>e.length&&gf(e[0])>0);n.sort((e,t)=>{const i=e[0][0],n=t[0][0];return i[0]-n[0]||i[1]-n[1]||Math.abs(gf(t[0]))-Math.abs(gf(e[0]))});const r=[],o=[];let s=0;for(let e=0;e<n.length;e++){const a=n[e];for(const e of a)r.push(yf(e,i,0));const l=a[0];s+=l.length;for(let n=0;n<l.length;n++){const r=l[n],s=l[(n+1)%l.length];if(bf(r,s,i)<=1e-9)continue;const a=uf(r,0,i),c=uf(s,0,i),h=uf(s,-t,i),d=uf(r,-t,i);o.push({d:`M ${ff(a)} L ${ff(c)} L ${ff(h)} L ${ff(d)} Z`,depth:Math.max(d[1],h[1]),component:e,edge:n,planEdge:[r,s]})}}return o.sort((e,t)=>e.depth-t.depth||e.component-t.component||e.edge-t.edge),{footprintPath:r.join(" "),sides:o,componentCount:n.length,edgeCount:s}}function kf(e,t){return e^=Math.round(64*(Number.isFinite(t)?t:0)),Math.imul(e,16777619)>>>0}const xf=e=>e.every(Number.isFinite);function $f(e,t,i,n){const r=e[0]*i,o=e[1]*n,s=t*Math.PI/180;return[r*Math.cos(s)-o*Math.sin(s),r*Math.sin(s)+o*Math.cos(s)]}function Sf(e,t,i,n,r,o,s){const a=e.flipH?-1:1,l="gate"===e.type?1:e.flipV?-1:1,c=(e.type,e.flipV,e.angle,e.face,{ox:0,oy:0}),h=function(e,t){return[e[0]+t[0],e[1]+t[1]]}([e.x+c.ox,e.y+c.oy],$f(i,e.angle,a,l));return{leaf:t,hinge:h,closedVector:$f(n,e.angle,a,l),quarterVector:$f([-n[1],n[0]],e.angle,a,l),turnDeg:r,bottom:o,top:s}}const Mf=e=>`${Number(e[0].toFixed(4))} ${Number(e[1].toFixed(4))}`;function Cf(e,t,i=hf){const n=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));return e.leaves.map(t=>{const r=function(e,t){const i=e.turnDeg*t*Math.PI/180;return[e.hinge[0]+e.closedVector[0]*Math.cos(i)+e.quarterVector[0]*Math.sin(i),e.hinge[1]+e.closedVector[1]*Math.cos(i)+e.quarterVector[1]*Math.sin(i)]}(t,n),o=uf(t.hinge,t.bottom,i),s=uf(r,t.bottom,i),a=uf(r,t.top,i),l=uf(t.hinge,t.top,i);return{id:e.id,sourceIndex:e.sourceIndex,type:e.type,leaf:t.leaf,d:`M ${Mf(o)} L ${Mf(s)} L ${Mf(a)} L ${Mf(l)} Z`,shadowD:`M ${Mf(uf(t.hinge,0,i))} L ${Mf(uf(r,0,i))}`,depth:Math.max(o[1],s[1])}})}const Tf={window:120,door:90,passage:90,gate:300};function Rf(e){return Tf[e]}function Df(e,t){return{type:e,lengthCm:Rf(e),flipH:!1,flipV:!1,revision:t}}function zf(e,t){const i=Math.max(0,e.renderedLength)/2,n=Math.max(0,e.target.physicalHalfWidth),r=n+.18*Math.max(0,t),o=e=>({x1:e,y1:-r,x2:e,y2:r});return{rect:{x:-i,y:n?-n:0,width:2*i,height:2*n},boundaries:[o(-i),o(i)]}}function Af(e,t){const i=[e[0],e[1]],n=[t[0],t[1]];return function(e,t){return e[0]-t[0]||e[1]-t[1]}(i,n)<=0?{a:i,b:n}:{a:n,b:i}}function Pf(e){const t=new Map;return e.forEach((e,i)=>{if(!e.kind||e.open)return;const n=Af(e.a,e.b);if(Math.hypot(n.b[0]-n.a[0],n.b[1]-n.a[1])<=1e-9)return;const r=function(e,t){const i=e=>(Math.abs(e)<=5e-10?0:Math.round(1e6*e)/1e6).toFixed(6);return`${i(e[0])},${i(e[1])}>${i(t[0])},${i(t[1])}`}(n.a,n.b),o=t.get(r);if(o)return o.physicalHalfWidth=Math.max(o.physicalHalfWidth,e.half||0),o.sourceOrder=Math.min(o.sourceOrder,i),void(e.partitionHost&&(o.partitionHost&&o.partitionHost.id!==e.partitionHost.id?o.ambiguousPartitionHost=!0:o.partitionHost=e.partitionHost));t.set(r,{segmentKey:r,a:n.a,b:n.b,physicalHalfWidth:Math.max(0,e.half||0),sourceOrder:i,...e.partitionHost?{partitionHost:e.partitionHost}:{}})}),[...t.values()]}function Of(e,t){if(Math.abs(e.distance-t.distance)>1e-9)return e.distance-t.distance;if(Math.abs(e.perpendicular-t.perpendicular)>1e-9)return e.perpendicular-t.perpendicular;return(e.target.segmentKey<t.target.segmentKey?-1:e.target.segmentKey>t.target.segmentKey?1:0)||e.target.sourceOrder-t.target.sourceOrder}function Ff(e){const t=Pf(e.intervals).map(t=>{const i=function(e,t){const i=t.b[0]-t.a[0],n=t.b[1]-t.a[1],r=Math.hypot(i,n),o=i/r,s=n/r,a=(e[0]-t.a[0])*o+(e[1]-t.a[1])*s,l=Math.max(0,Math.min(r,a)),c=t.a[0]+l*o,h=t.a[1]+l*s;return{along:l,length:r,x:c,y:h,distance:Math.hypot(e[0]-c,e[1]-h),perpendicular:Math.abs((e[0]-t.a[0])*s-(e[1]-t.a[1])*o)}}(e.pointer,t);return{target:t,...i,envelope:Math.max(e.baseTolerance,t.physicalHalfWidth+e.bodyPointerPadding)}}).filter(e=>e.distance<=e.envelope+1e-9).filter(t=>!function(e,t,i,n,r){const o=t.b[0]-t.a[0],s=t.b[1]-t.a[1],a=Math.hypot(o,s);if(!(a>1e-9))return!1;const l=o/a,c=s/a;for(const o of i){if(!o.open&&o.kind)continue;const i=Af(o.a,o.b),s=i.b[0]-i.a[0],a=i.b[1]-i.a[1],h=Math.hypot(s,a);if(!(h>1e-9))continue;const d=s/h,u=a/h;if(Math.abs(l*u-c*d)>1e-6)continue;if(Math.abs((i.a[0]-t.a[0])*c-(i.a[1]-t.a[1])*l)>r)continue;const p=(e[0]-i.a[0])*d+(e[1]-i.a[1])*u,m=1e-9;if(!(p<=m||p>=h-m)&&Math.abs((e[0]-i.a[0])*u-(e[1]-i.a[1])*d)<=n+1e-9)return!0}return!1}(e.pointer,t.target,e.intervals,t.envelope,Math.max(1e-9,Math.min(e.baseTolerance,.04*e.gridStep)))),i=t.filter(t=>!!t.target.partitionHost&&e.renderedLength+2*t.target.physicalHalfWidth>t.length+1e-9).sort(Of),n=t.filter(t=>!t.target.partitionHost||e.renderedLength+2*t.target.physicalHalfWidth<=t.length+1e-9).sort(Of);let r=n[0];if(!r)return{candidate:null,jambBlockedTarget:i[0]?.target||null};const o=n.filter(e=>Math.abs(e.distance-r.distance)<=1e-9&&Math.abs(e.perpendicular-r.perpendicular)<=1e-9),s=o.filter(e=>e.target.partitionHost);if(s.length){if(1!==new Set(s.map(e=>e.target.partitionHost.id)).size||s.some(e=>e.target.ambiguousPartitionHost))return{candidate:null,jambBlockedTarget:null};const e=s[0],t=e.target.b[0]-e.target.a[0],i=e.target.b[1]-e.target.a[1],n=Math.hypot(t,i),a=t/n,l=i/n;if(!o.every(t=>{const i=t.target.b[0]-t.target.a[0],n=t.target.b[1]-t.target.a[1],r=Math.hypot(i,n),o=i/r,s=n/r,c=Math.abs(a*s-l*o)<=1e-6,h=Math.abs((t.target.a[0]-e.target.a[0])*l-(t.target.a[1]-e.target.a[1])*a);return c&&h<=1e-9}))return{candidate:null,jambBlockedTarget:null};r=e}if(r.target.ambiguousPartitionHost)return{candidate:null,jambBlockedTarget:null};const{target:a,length:l}=r,c=a.b[0]-a.a[0],h=a.b[1]-a.a[1],d=c/l,u=h/l,p=a.partitionHost?a.physicalHalfWidth:0,m=Math.min(Math.max(0,e.renderedLength)/2+p,l/2);let _=r.along;const f=Math.max(e.gridStep,1e-9),g=l/2;_=Math.abs(_-g)<=f/2?g:Math.round(_/f)*f,_=Math.max(m,Math.min(l-m,_));const v=a.a[0]+d*_,y=a.a[1]+u*_,b=Math.max(0,e.renderedLength)/2,w=_-b,k=_+b,x=Math.max(0,w),$=Math.max(0,l-k),S=[a.a[0]+d*(w-x/2),a.a[1]+u*(w-x/2)],M=[a.a[0]+d*(k+$/2),a.a[1]+u*(k+$/2)];let C=180*Math.atan2(h,c)/Math.PI;C>=90?C-=180:C<-90&&(C+=180);const T=Math.abs(_-g)<=1e-9;return{candidate:{presetRevision:e.preset.revision,geometryRevision:e.geometryRevision,pointer:[e.pointer[0],e.pointer[1]],type:e.preset.type,lengthCm:e.preset.lengthCm,flipH:e.preset.flipH,flipV:e.preset.flipV,x:v,y:y,angle:C,renderedLength:e.renderedLength,target:a,...a.partitionHost?{host:{...a.partitionHost,t:l>0?_/l:0}}:{},measure:{labels:[{distance:x,midpoint:S},{distance:$,midpoint:M}],guide:T?{x:v,y:y,angle:C}:null}},jambBlockedTarget:null}}function If(e,t,i,n,r=1e-6){return e.presetRevision===i&&e.geometryRevision===n&&Math.hypot(e.pointer[0]-t[0],e.pointer[1]-t[1])<=r}function Ef(e){return!(!e.canEdit||e.kiosk||e.fixedFloor)&&("view"!==e.mode&&("mouse"===e.pointerType&&e.spaceCount>1))}let Hf=0;const Nf="1.71.0-beta.2",Lf="0aa082f67d7e4e87ee87e11227a79f9f754d47a470f79cea2084b6001cf18246",Bf=1500,qf=(e,t)=>{if(!e.has(t))return{hit:!1};const i=e.get(t);return e.delete(t),e.set(t,i),{hit:!0,value:i}},Wf=(e,t,i,n)=>{for(e.delete(t),e.set(t,i);e.size>n;){const t=e.keys().next().value;if(void 0===t)break;e.delete(t)}},jf=new Map;let Uf=0;const Vf=e=>`${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(e??{})}`;let Gf=1e4;const Kf="houseplan_card_layout_v1",Yf="houseplan_card_cfg_v1",Xf="houseplan_card_zoom_v1",Zf="houseplan_card_nav_v1",Jf="houseplan_card_kiosk_v1",Qf="houseplan_card_view_v1",eg="hp-dialog, hp-help, hp-color-opacity, hp-device-preview",tg=1e3,ig=(e,t)=>{const i=Math.min(e.x,t.x),n=Math.min(e.y,t.y);return{x:i,y:n,w:Math.max(e.x+e.w,t.x+t.w)-i,h:Math.max(e.y+e.h,t.y+t.h)-n}},ng=new Set(["select","draw","column","merge","split","resize","opening","wallthick","delroom"]),rg=(e,t,i)=>{const n=new Event(t,{bubbles:!0,composed:!0});n.detail=i??{},e.dispatchEvent(n)},og=e=>{history.pushState(null,"",e),rg(window,"location-changed",{replace:!1})},sg=(e,t)=>{let i,n=null;const r=(...r)=>{clearTimeout(i),n=r,i=window.setTimeout(()=>{i=void 0;const t=n;n=null,t&&e(...t)},t)};return r.flush=()=>{if(void 0===i)return;clearTimeout(i),i=void 0;const t=n;n=null,t&&e(...t)},r.cancel=()=>{clearTimeout(i),i=void 0,n=null},r.pending=()=>void 0!==i,r},ag=e=>{try{e.target?.setPointerCapture?.(e.pointerId)}catch{}},lg=["edges","corners"];class cg extends he{constructor(){super(...arguments),this._editorRuntime=null,this._onboardingRuntime=null,this._editorRuntimeLoadingVisible=!1,this._backdropGuard=null,this._editorModeRequest=0,this._warmModeRequest=0,this._editorRuntimeLoader=new j_({expectedFingerprint:Lf,load:async e=>{const t=0===e?await import("./houseplan-editor-runtime-CvmR2VuV.js"):await import((()=>{const e=new URL("./houseplan-editor-runtime-CvmR2VuV.js",import.meta.url);return e.searchParams.set("hp_retry",`${Nf}-${++Hf}`),e.href})());return{fingerprint:t.EDITOR_RUNTIME_FINGERPRINT,create:()=>new t.HouseplanEditorRuntime(this)}},install:e=>{this._editorRuntime=e},stateChanged:e=>this._editorRuntimeStateChanged(e),failed:(e,t)=>{console.error("[houseplan] unable to load editor runtime",e),this._showToast(q_(e=>this._t(e),t))}}),this._onboardingRuntimeLoader=new j_({expectedFingerprint:Lf,load:async e=>{const t=0===e?await import("./houseplan-onboarding-runtime-BVA5mIBD.js"):await import((()=>{const e=new URL("./houseplan-onboarding-runtime-BVA5mIBD.js",import.meta.url);return e.searchParams.set("hp_retry",`${Nf}-${++Hf}`),e.href})());return{fingerprint:t.ONBOARDING_RUNTIME_FINGERPRINT,create:()=>new t.HouseplanOnboardingRuntime(this)}},install:e=>{this._onboardingRuntime=e},failed:(e,t)=>{console.error("[houseplan] unable to load onboarding runtime",e),this._showToast(q_(e=>this._t(e),t))}}),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._serverCanWrite=null,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._cfgContentFingerprint="",this._unsubCfg=null,this._unsubLayout=null,this._unsubVirtual=null,this._liveSyncAttempt=null,this._liveSyncGeneration=0,this._liveSyncConnection=null,this._layoutRev=0,this._layoutContentFingerprint="",this._virtualLights=Wc(null),this._canOptimizeUndo=!1,this._undoKind=null,this._devices=[],this._regSignature="",this._defPos={},this._newSyncKey="",this._areaRelocationIds=new Set,this._areaSnapshotCleanupCandidates=new Map,this._areaRelocationSyncKey="",this._areaRelocationWrite=Promise.resolve(),this._tip=null,this._hoverRoom=null,this._pointerModality=new l_(this,()=>this._syncPointerHoverTargets()),this._devicePressAnimations=new Map,this._selId=null,this._toast="",this._mode="view",this._pendingNavMode=null,this._decorTool="select",this._decorStyle={...rr},this._decorStyleSeeded=!1,this._decorDraft=null,this._decorMove=null,this._decorSel=null,this._decorEraseConfirm=null,this._decorTextDialog=null,this._decorShapeDialog=null,this._backdropDialog=null,this._decorTextSelection={start:0,end:0},this._furnPalette=null,this._decorImagePalette=null,this._decorAssetCatalog=[],this._decorAssets=new Map,this._decorAssetBusy=!1,this._furnCategory=null,this._furnPreviewInput=null,this._furnTouchPending=null,this._dtBox=null,this._dtDrag=null,this._bdDrag=null,this._slide="",this._reducedMotion=!1,this._onMotionChange=e=>{this._reducedMotion=e.matches,this._cancelDevicePressFeedback(),e.matches&&this._cancelCameraTransition(!0),e.matches&&this._modeTransitionPreparing?this._modeTransitionForceAtomic=!0:e.matches&&this._modeTransition.active&&this._cancelModeTransition(!0),this.requestUpdate()},this._editorChromeMode="plan",this._modeTransitionVisual=null,this._modeTransitionPreparing=!1,this._modeTransitionForceAtomic=!1,this._modeTransitionRequest=0,this._modeTransitionTargetZoom=1,this._modeTransitionEditorCamera=null,this._modeTransition=new P_({frame:e=>this._applyModeTransitionFrame(e),settled:e=>this._settleModeTransition(e)}),this._cameraTransitionFit=null,this._cameraTransition=new B_({frame:e=>this._applyCameraTransitionFrame(e),settled:e=>this._settleCameraTransition(e)}),this._editorSecondaryCopy={groupActive:(e,t)=>this._t("editor.group_active",{group:e,item:t}),openGroup:e=>this._t("editor.open_group",{group:e}),disabledAction:(e,t)=>this._t("editor.disabled_action",{action:e,reason:t})},this._tool="draw",this._geometryHistory=new w_(50),this._devicePositionHistory=new w_(50),this._devicePositionBusy=!1,this._wallDialog=null,this._drawWallField=null,this._activeDraftId=null,this._resumeDraftBySpace={},this._physicalSel=null,this._physicalDialog=null,this._partitionDeleteDialog=null,this._roomDeleteDialog=null,this._physicalDrag=null,this._physicalRotate=null,this._physicalLastTap=null,this._physicalPickCycle=null,this._wallUnionCacheValue=null,this._wallUnionPool=new Map,this._isoGeometryCache=new Map,this._isoFallback=new Set,this._openingTunnelCache=null,this._openingWallIndexCache=new Map,this._openingPlacementIntervalsCache=null,this._openingDimensionContextCache=null,this._planSnapGeometryCache=null,this._planStructuralGeometryCache=null,this._hiddenWallDiagnosticCache=null,this._physicalBodiesCache=null,this._lightPhysicalBodiesCache=null,this._cleanFloorCache=new Map,this._innerContourCache=new Map,this._glowRuntimeState=km(),this._glowRuntimeHost={window:()=>this.ownerDocument.defaultView||window,isConnected:()=>this.isConnected,requestUpdate:()=>this.requestUpdate(),reducedMotion:()=>this._reducedMotion},this._lightBarrierCache=null,this._lightBarrierPool=new Map,this._glowScreenBlend=!1,this._duplicateColumnId=null,this._duplicateColumnTimer=0,this._rszLimitViolation=null,this._path=[],this._cursorPt=null,this._planSnapHover=null,this._mergeSel=null,this._openingPreset=null,this._openingRebindId=null,this._openingPresetRevision=0,this._openingHoverCandidate=null,this._openingJambBlockCm=null,this._openingDialog=null,this._openingInfo=null,this._opDrag=null,this._opMeasure=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._wallFaceBatch=null,this._wallRepairDiagnostic=null,this._wallFaceGraphCache=[],this._areaSel="",this._nameSel="",this._roomDialog=!1,this._roomEditId=null,this._roomFill="",this._roomCustomFill=null,this._roomTempSrc="",this._roomHumSrc="",this._roomSrcOpen=null,this._roomSrcFilter="",this._roomNameScale=1,this._roomLabelScale=1,this._zoom=1,this._view=null,this._zoomBySpace={},this._viewModeSnap=null,this._pointers=new Map,this._panStart=null,this._panLock=null,this._pinchStart=null,this._suppressClick=!1,this._touchContacts=new Map,this._touchSequenceMultitouch=!1,this._touchClickBlockUntil=0,this._connectedPath="",this._routeDepartureHandled=!1,this._onLocationChanged=()=>{this._connectedPath&&location.pathname!==this._connectedPath?this._leaveCardRoute():location.pathname===this._connectedPath&&(this._routeDepartureHandled=!1)},this._touchGestureGuard={capture:!0,handleEvent:e=>this._guardTouchGesture(e)},this._hdrH=118,this._booting=!0,this._bootFading=!1,this._bootSettling=!1,this._bootSettleRaf=0,this._bootLastH=-1,this._bootStart=0,this._bootLastChange=0,this._bootSoft=!1,this._tapConfirm=null,this._dangerConfirm=null,this._dangerConfirmController=new fe(e=>{this._dangerConfirm=e}),this._confirmDanger=e=>this._config&&this.hass?"warm"===this._syncDangerConfirmLocaleGate()||this._dangerConfirmMissingSpace()?Promise.resolve(!1):this._dangerConfirmController.confirm(e):Promise.resolve(!1),this._cancelDangerConfirm=()=>{this._dangerConfirmController.cancel()},this._onDangerConfirmDecision=e=>{this._dangerConfirmController.resolve(e.detail.token,e.detail.accepted)},this._onboardingShown=!1,this._rulesDialog=null,this._preflightClipboardFallback=null,this._haIntegrationVersion=null,this._haSupportApi=null,this._haDecorAssetsApi=null,this._decorAssetSyncToken=0,this._alignDialog=null,this._settingsDialog=null,this._supportDialog=null,this._backupExportDialog=null,this._backupImportDialog=null,this._sunRaysCache=null,this._dayCycleTimer=0,this._dayCycleClockKey="",this._compassDrag=!1,this._importDialog=null,this._importQueue=[],this._importTotal=0,this._rulesCompiledSrc="",this._infoCard=null,this._nativeMoreInfoEntity=null,this._deviceInbox=null,this._deviceInboxReturn=null,this._deviceInboxMemo=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=e=>this._onKey(e),this._warmVp=null,this._warmVpArmed=!1,this._warmLongReturn=!1,this._warmRevivePending=!1,this._warmGen=++Uf,this._warmKey=null,this._warmSlot=null,this._hashApplied=!1,this._navApplied=!1,this._labs={active:Object.freeze([]),space:""},this._viewPreference={},this._renderProjection="flat",this._kioskScale={icon:1,font:1},this._kioskDialog=!1,this._activityRt=new Map,this._vacRt=new Map,this._vacViewKey="",this._vacLastView=null,this._vacRaf=0,this._vacSrvTrails={},this._vacJumpOnce=!1,this._continuity=this._newContinuityController(),this._continuityHistory=[],this._continuityEpoch=0,this._continuityDataReady=!0,this._continuityPaintToken=-1,this._continuityDisposed=!1,this._renderSnapshotAt=Date.now(),this._hassSequence=0,this._visibleDeviceSnapshot=null,this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1,this._capturedSnapshotSequence=-1,this._capturedSnapshotDevices=null,this._capturedSnapshotLayout=null,this._capturedSnapshotActivity="",this._capturedSnapshotConfigEpoch=-1,this._capturedSnapshotVirtual="",this._lastValidStageSize=null,this._pendingRefitSize=null,this._refitRaf=0,this._pageVisibility=e=>{if(this._continuity.visibility(e),this._dayCycleVisibility(e),"hidden"===e.kind)return this._clearTransientHover(!0),this._cancelDevicePressFeedback(),this._cancelCameraTransition(!0),void(this._modeTransitionPreparing?this._modeTransitionForceAtomic=!0:this._cancelModeTransition(!0));if(this._vacJumpOnce=!0,!e.long){const e=Date.now();let t=!1;for(const i of this._activityRt.values())!i.flashKind||(i.expiresAt||i.flashTs+n_)>e||(i.flashTs=0,i.flashKind=null,i.expiresAt=0,t=!0);return void(t&&this.requestUpdate())}Date.now()-this._renderSnapshotAt>1e3&&this._continuity.note("device-snapshot-stale"),this._continuityDataReady=!1,this._continuityPaintToken=-1,this._resumeSettling=!0,this._loading?this.requestUpdate():this._loadFromServer()},this._resumeSettling=!1,this._viewportInvalidAt=0,this._vacFit=null,this._vacAllCamerasFor=null,this._vacAllCameraCache=null,this._vacCalConfirm=null,this._kioskDots=!1,this._cyclePausedUntil=0,this._swipeStart=null,this._tabDrag=null,this._tabDragRelease=null,this._tabSuppressClick=!1,this._tabOrderWarned=!1,this._lastTap=0,this._onLabsSnapshot=e=>{const t=this._effectiveProjection();this._labs=e;const i=this._effectiveProjection();this._convertProjectionView(t,i),this.requestUpdate()},this._onHashChange=()=>{if(this._hasFixedFloor)return;const e=this._hashSpace();if(e&&this._model.find(t=>t.id===e)&&e!==this._space){if(this._wallFaceBatch&&this._roomDialogCancel(),"plan"===this._mode&&"draw"===this._tool&&!this._finishWallChain())return;this._activeDraftId&&(this._resumeDraftBySpace[this._space]=this._activeDraftId),this._commitSpace(e),this._selId=null,this._path=[],this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this._tool="draw",this._activeDraftId=null,this._draftSegmentCms=[],this._closingWallCm=null,"plan"===this._mode&&"draw"===this._tool&&this._resumeLastDraft(),this._restoreZoom(),this.requestUpdate()}},this._drag=null,this._deviceDrag=null,this._rlResize=null,this._holdFired=!1,this._retryContinuity=()=>{this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.retry(this._continuity.recoveryReason||"plan"),this._loading||this._loadFromServer()},this._cfgEpoch=0,this._cfgEpochPreservedConfig=null,this._modelCache=null,this._emptySpaceStateActive=!1,this._decorSnapCache=null,this._markerPreviewMemo=null,this._markerPreviewDevicesMemo=null,this._showHidden=!1,this._connHooked=null,this._connectionWasLost=!1,this._haRegistryConnection=null,this._haRegistryRev=-1,this._haBindingCacheKey="",this._planHassMemo=null,this._onHaRegistryUpdate=()=>{const e=lh(this.hass);e.revision===this._haRegistryRev&&this._devices.length||(this._haRegistryRev=e.revision,this._planHassMemo=null,this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate())},this._onConnReady=()=>{if(this._loadTries=0,clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,ah(this.hass),this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),this._cfgWriting)return clearTimeout(this._reloadRetry),void(this._reloadRetry=window.setTimeout(this._onConnReady,400));!this._connectionWasLost&&this._continuity.hasCompleteFrame?this._beginContinuityCandidate("connection-ready",!1,"plan"):(this._continuityDataReady=!1,this._continuityPaintToken=-1),this._loading||this._loadFromServer()},this._onConnLost=()=>{this._booting&&!this._continuity.hasCompleteFrame||(this._connectionWasLost=!0,this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.connectionLost())},this._signer=new Wl(()=>this.requestUpdate()),this._dirtyPos=new Set,this._sentPos=new Map,this._persistLayout=sg(()=>{if(this._serverStorage){const e=[...this._dirtyPos];this._dirtyPos.clear();for(const t of e){const e=Qr(this._layout[t]);e&&(this._layout={...this._layout,[t]:e},this._sentPos.set(t,e),this.hass.callWS({type:"houseplan/layout/update",device_id:t,pos:e}).then(e=>this._noteLayoutRev(e)).catch(e=>this._showToast(this._t("toast.pos_save_failed",{err:this._errText(e)}))).finally(()=>{this._sentPos.get(t)===e&&this._sentPos.delete(t)}))}this._cacheSnapshot()}else this._persistLocalLayout()},600),this._frame=null,this._showFar=!1,this._writesPending=0,this._writeChain=Promise.resolve(),this._pendingPhysicalWrites=new Map,this._undoGeometry=()=>this._editorRuntimeOrThrow()._undoGeometry(),this._redoGeometry=()=>this._editorRuntimeOrThrow()._redoGeometry(),this._saveConfigDebounced=sg(()=>{this._serverCfg&&this._writeConfig().catch(e=>{const t=!0===e?.physicalGeometryRolledBack;"geometry-unsafe"!==e?.code&&("wall_model_client_outdated"===e?.code?this._showToast(this._t("toast.wall_model_client_outdated")):"conflict"===e?.code?(this._showToast(this._t("toast.conflict")),t||(this._cancelPath(),this._reloadConfigOnly(!0))):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(e)})),t&&this._reloadRejectedPhysicalWrite())})},500),this._draftSegmentCms=[],this._closingWallCm=null,this._savePhysicalDialog=()=>this._editorRuntimeOrThrow()._savePhysicalDialog(),this._deletePhysicalSelection=()=>this._editorRuntimeOrThrow()._deletePhysicalSelection(),this._confirmPartitionDelete=()=>this._editorRuntimeOrThrow()._confirmPartitionDelete(),this._deleteDraftWhole=()=>this._editorRuntimeOrThrow()._deleteDraftWhole(),this._deleteDraftSegment=()=>this._editorRuntimeOrThrow()._deleteDraftSegment(),this._confirmRoomDelete=e=>this._editorRuntimeOrThrow()._confirmRoomDelete(e),this._rebindPartitionOpening=()=>this._editorRuntimeOrThrow()._rebindPartitionOpening(),this._keepClosedAsPartitions=()=>this._editorRuntimeOrThrow()._keepClosedAsPartitions(),this._toggleServerPlans=async()=>this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._toggleServerPlans():this._editorRuntimeOrThrow()._toggleServerPlans(),this._aspectJob=null,this._dayCycleTick=()=>{if(!this.isConnected||"hidden"===this.ownerDocument.visibilityState)return;const e=this._dayCycleState();if(!e)return this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),void(this._dayCycleClockKey="");const t=qn(e);t!==this._dayCycleClockKey&&(this._dayCycleClockKey=t,this.requestUpdate())},this._sunShown=!1,this._sunOut=!1,this._sunOutTimer=0,this._openSettingsDialog=()=>{if(this._editorRuntime)return this._editorRuntime._openSettingsDialog();this._ensureEditorRuntime().then(e=>{e&&this._openSettingsDialog()})},this._openSupportDialog=()=>{this._editorRuntime?this._editorRuntime._openSupportDialog():this._ensureEditorRuntime().then(e=>{e&&this._openSupportDialog()})},this._reportedPreflightFingerprint=null,this._openAlignDialog=()=>this._editorRuntimeOrThrow()._openAlignDialog(),this._toggleOptimizeLivePositions=()=>this._editorRuntimeOrThrow()._toggleOptimizeLivePositions(),this._optimizeUndoBusy=!1,this._openBackupExport=()=>this._editorRuntimeOrThrow()._openBackupExport(),this._openRulesDialog=()=>this._editorRuntimeOrThrow()._openRulesDialog(),this._climateCache=null,this._gearPtCache=new WeakMap}_editorRuntimeOrThrow(){if(!this._editorRuntime)throw new Error("Houseplan editor runtime is not loaded");return this._editorRuntime}async _ensureEditorRuntime(){return this._editorRuntimeLoader.ensure()}async _ensureOnboardingRuntime(){return this._onboardingRuntimeLoader.ensure()}_editorRuntimeStateChanged(e){clearTimeout(this._editorRuntimeLoadingTimer),this._editorRuntimeLoadingTimer=void 0,"loading"!==e?(this._editorRuntimeLoadingVisible=!1,this.requestUpdate()):this._editorRuntimeLoadingTimer=window.setTimeout(()=>{this._editorRuntimeLoadingVisible=!0,this.requestUpdate()},150)}async _requestMode(e,t=!0,i=!1){const n=++this._editorModeRequest;if(i&&(this._warmModeRequest=n,this._refitRaf&&(cancelAnimationFrame(this._refitRaf),this._refitRaf=0),this._pendingRefitSize=null),"view"===e||await this._ensureEditorRuntime()){if(n===this._editorModeRequest&&this.isConnected)return i?(this._adoptMode(e),this._warmRevivePending&&(clearTimeout(this._warmReviveTimer),this._warmReviveTimer=void 0,this._warmReviveDialog()),this.requestUpdate(),void this.updateComplete.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(this._warmModeRequest!==n||n!==this._editorModeRequest)return;const e=this._stageEl;this._lastValidStageSize=e&&e.clientWidth>0&&e.clientHeight>0?[e.clientWidth,e.clientHeight]:null,this._pendingRefitSize=null,this._warmModeRequest=0})))):void this._setMode(e,t);this._warmModeRequest===n&&(this._warmModeRequest=0)}else this._warmModeRequest===n&&(this._warmModeRequest=0)}_seedDecorStyle(e){if(this._decorStyleSeeded||!e)return;this._decorStyleSeeded=!0;const t=e.settings?.decor_default_style;t&&(this._decorStyle=function(e,t){if(!e||"object"!=typeof e)return{...t};const i=e,n="string"==typeof i.color&&i.color?i.color:t.color,r="string"==typeof i.fill_color&&i.fill_color?i.fill_color:t.fillColor,o=Number(i.width_cm);return{color:n,opacity:or(i.opacity,t.opacity),widthCm:Number.isFinite(o)&&o>0?Math.max(.1,Math.min(100,o)):t.widthCm,fill:"boolean"==typeof i.fill?i.fill:t.fill,fillColor:r,fillOpacity:or(i.fill_opacity,t.fillOpacity)}}(t,rr))}get _canEdit(){return!!this._norm&&(!0===this._serverCanWrite||!1!==this._serverCanWrite&&!0===this.hass?.user?.is_admin)}get _kiosk(){return!!this._config?.kiosk}_showKioskDots(){this._kioskDots=!0,clearTimeout(this._kioskDotsTimer),this._kioskDotsTimer=window.setTimeout(()=>this._kioskDots=!1,2500)}get _modeTransitionBusy(){return this._modeTransitionPreparing||this._modeTransition.active}_cameraState(){const e=this._viewOr(this._baseVb());return{zoom:this._zoom,viewBox:{...e}}}_normalizeCameraState(e){const t=this._cameraTransitionFit||vi(this._baseVb(),this._stageAspect());return{zoom:Math.min(cg.ZOOM_MAX,Math.max(cg.ZOOM_MIN,e.zoom)),viewBox:this._clampView({...e.viewBox},t)}}_applyCameraTransitionFrame(e){const t=this._normalizeCameraState(e.presented);e.presented=t,this._zoom=t.zoom,this._view={...t.viewBox},this.requestUpdate()}_settleCameraTransition(e){const t=this._normalizeCameraState(e.to);this._zoom=t.zoom,this._view={...t.viewBox},this._cameraTransitionFit=null,this._saveZoom(),this.requestUpdate()}_cancelCameraTransition(e=!1,t=!1){const i=t&&this._cameraTransition.active?this._cameraTransition.presented?.zoom:void 0;this._cameraTransition.cancel(e),this._cameraTransitionFit=null,void 0!==i&&this._saveZoom()}_prepareCameraCommand(){this._modeTransitionBusy&&this._cancelModeTransition(!0),"opening"===this._tool&&(this._cursorPt=null,this._clearOpeningPlacement(!1))}_startCameraTransition(e,t,i,n){const r=this._cameraState(),o=this._cameraTransition.target;return(!o||!H_(o,e))&&(H_(r,e)?(this._cancelCameraTransition(!1),!1):(this._cameraTransitionFit={...t},this._cameraTransition.start(r,e,i,this._reducedMotion?0:n),!0))}_cssColor(e,t){const i=String(e||"").trim();if(!i)return t;const n=document.createElement("span");n.style.cssText=`position:absolute;visibility:hidden;color:${i}`,this.renderRoot.append(n);const r=getComputedStyle(n).color||t;return n.remove(),r}_currentModeVisual(e=this._mode){const t=this._modeTransition.presented||this._modeTransitionVisual;if(t)return{...t,viewport:{...t.viewport,viewBox:{...t.viewport.viewBox}}};const i=this._stageEl;if(!i||i.clientWidth<=0||i.clientHeight<=0)return null;const n=this.renderRoot.querySelector(".editorchrome"),r=this._viewOr(this._baseVb()),o=this.renderRoot.querySelector(".hp-paper"),s=this.renderRoot.querySelector(".hp-backdrop"),a=this.renderRoot.querySelector(".zoomwrap"),l=a?getComputedStyle(a).filter:"",c=Number(/brightness\(([^)]+)\)/.exec(l)?.[1]);return{presentedMode:e,editorChromeHeight:"view"===e?0:n?.getBoundingClientRect().height||0,stageWidth:i.clientWidth,stageHeight:i.clientHeight,viewport:R_(r,i.clientWidth),stageColor:getComputedStyle(i).backgroundColor||"rgb(255, 255, 255)",paperColor:o?getComputedStyle(o).fill:"rgb(255, 255, 255)",sceneBrightness:Number.isFinite(c)?c:1,architectureOpacity:"decor"===e?.35:1,backdropOpacity:s&&Number(getComputedStyle(s).opacity)||1,viewWeight:"view"===e?1:0,editorWeight:"view"===e?0:1,toolbarContentOpacity:"view"===e?0:1}}_viewForModeTarget(e,t,i,n,r){const o=vi(this._baseVb(),n/Math.max(1,r)),s=Math.min(cg.ZOOM_MAX,Math.max(cg.ZOOM_MIN,e)),a=o.w/s,l=o.h/s,c=t??o.x+o.w/2,h=i??o.y+o.h/2;return this._clampView({x:c-a/2,y:h-l/2,w:a,h:l},o)}_targetStageColor(e){return"view"!==e?"rgb(255, 255, 255)":this._cssColor(this._stageBg(this._spaceDisplayForRender()),this._cssColor("var(--ha-card-background, var(--card-background-color, #111))","rgb(17, 17, 17)"))}_targetPaperColor(e){return"view"===e&&this._spaceModel()?.bg?this._cssColor("var(--ha-card-background, var(--card-background-color, #111))","rgb(17, 17, 17)"):"rgb(255, 255, 255)"}_targetBrightness(e){return 1}_applyModeTransitionFrame(e){e.targetMode===this._mode&&(this._modeTransitionVisual=e.presented,this._view={...e.presented.viewport.viewBox},this.requestUpdate())}_settleModeTransition(e){if(e.targetMode!==this._mode)return;const t=this._modeTransitionRequest;this._view={...e.to.viewport.viewBox},this._zoom=this._modeTransitionTargetZoom,this._modeTransitionVisual=null,this._modeTransitionPreparing=!1,this._lastValidStageSize=[e.to.stageWidth,e.to.stageHeight],"view"===this._mode&&(this._saveZoom(),this._viewModeSnap=null,this._modeTransitionEditorCamera=null),this.requestUpdate(),this.updateComplete.then(()=>{if(!this.isConnected||t!==this._modeTransitionRequest||this._modeTransitionBusy||e.targetMode!==this._mode)return;const i=this._stageEl;if(i&&i.clientWidth>0&&i.clientHeight>0&&(Math.abs(i.clientWidth-e.to.stageWidth)>.5||Math.abs(i.clientHeight-e.to.stageHeight)>.5)){const e=this._view;this._lastValidStageSize=[i.clientWidth,i.clientHeight],this._applyView(this._zoom,e?e.x+e.w/2:void 0,e?e.y+e.h/2:void 0),this.requestUpdate()}const n=this.renderRoot.activeElement;(!n||!n.isConnected||!!n.closest?.(".editorchrome, .stage"))&&this.renderRoot.querySelector(".modetab.active")?.focus?.({preventScroll:!0})})}_cancelModeTransition(e=!0){this._cancelCameraTransition(!1);const t=!!this._modeTransition.state;this._modeTransitionRequest++,this._modeTransitionPreparing=!1,this._modeTransitionForceAtomic=!1,this._modeTransition.cancel(e),e&&t||(this._modeTransitionVisual=null)}_adoptMode(e){this._cancelModeTransition(!1),this._mode=e,"view"!==e&&(this._editorChromeMode=e)}_commitViewModeAtomic(e,t,i,n){if(this._modeTransitionPreparing=!1,this._modeTransitionVisual=null,this._modeTransitionForceAtomic=!1,this._zoom=t,e){const r=this._stageEl?.clientWidth||e.stageWidth,o=Math.max(1,e.stageHeight+e.editorChromeHeight);this._view=this._viewForModeTarget(t,i,n,r,o),this._lastValidStageSize=[r,o]}else this._view=null;this._viewModeSnap=null,this._modeTransitionEditorCamera=null,this._saveZoom(),this.requestUpdate()}_prepareModeTransition(e,t,i,n,r,o){this.updateComplete.then(()=>{if(!this.isConnected||e!==this._modeTransitionRequest||this._mode!==i)return void(e===this._modeTransitionRequest&&(this._modeTransitionPreparing=!1,this._modeTransitionVisual=null,this._modeTransitionForceAtomic=!1,this.requestUpdate()));const s=this.renderRoot.querySelector(".editorchrome"),a=s?.querySelector(".editorchrome-inner"),l="view"===i?0:a?.scrollHeight||a?.getBoundingClientRect().height||0,c=Math.max(1,t.stageHeight+t.editorChromeHeight),h=Math.max(1,c-l),d=this._stageEl?.clientWidth||t.stageWidth;if(d<=0||h<=0)return this._modeTransitionPreparing=!1,this._modeTransitionVisual=null,this._applyView(n,r,o),void this.requestUpdate();const u=this._viewForModeTarget(n,r,o,d,h),p={presentedMode:i,editorChromeHeight:l,stageWidth:d,stageHeight:h,viewport:R_(u,d),stageColor:this._targetStageColor(i),paperColor:this._targetPaperColor(i),sceneBrightness:this._targetBrightness(i),architectureOpacity:"decor"===i?.35:1,backdropOpacity:"decor"===i&&"backdrop"!==this._decorTool?.5:1,viewWeight:"view"===i?1:0,editorWeight:"view"===i?0:1,toolbarContentOpacity:"view"===i?0:1};this._modeTransitionPreparing=!1;const m=this._modeTransitionForceAtomic;this._modeTransitionForceAtomic=!1,this._modeTransition.start(t,p,i,this._reducedMotion||m?0:220)})}get _hasFixedFloor(){return!!this._config&&Object.prototype.hasOwnProperty.call(this._config,"floor")}_fixedFloorState(e=this._model,t=this._loadOk){const i=this._config?.floor,n=function(e){if(!e.hasFloor)return{kind:"absent"};const t=e.floor;if("string"==typeof t)return t.length?e.spaceIds.includes(t)?{kind:"valid",id:t,source:"id"}:{kind:"invalid",reason:"unknown-id",value:t}:{kind:"invalid",reason:"empty-id",value:t};if("number"==typeof t){if(!Number.isFinite(t))return{kind:"invalid",reason:"non-finite-index",value:t};if(!Number.isInteger(t))return{kind:"invalid",reason:"fractional-index",value:t};if(t<0)return{kind:"invalid",reason:"negative-index",value:t};const i=e.spaceIds[t];return void 0===i?{kind:"invalid",reason:"out-of-range-index",value:t}:{kind:"valid",id:i,source:"index"}}return{kind:"invalid",reason:"invalid-type",value:t}}({spaceIds:e.map(e=>e.id),hasFloor:this._hasFixedFloor,floor:i});return!this._hasFixedFloor||t?n:"number"==typeof i?"valid"===n.kind||"invalid"===n.kind&&"out-of-range-index"===n.reason?{kind:"pending",value:i}:n:"valid"===n.kind||"invalid"===n.kind&&"unknown-id"!==n.reason?n:{kind:"pending",value:i}}_canCommitSpace(e,t=!1){if(t||!this._hasFixedFloor)return!0;const i=this._fixedFloorState();return"valid"===i.kind&&i.id===e}_commitSpace(e,t=!1){return!!this._canCommitSpace(e,t)&&(e!==this._space&&(this._cancelDangerConfirm(),this._cancelCameraTransition(!1),this._clearTransientHover(!0),this._cancelDevicePressFeedback(),this._editorRuntime?._clearFurniturePreview()),this._space=e,!0)}_slideTo(e,t){if(e===this._space)return!0;if(!this._canCommitSpace(e))return!1;if(this._wallFaceBatch&&this._roomDialogCancel(),"plan"===this._mode&&"draw"===this._tool&&!this._finishWallChain())return!1;this._cancelModeTransition(!0);const i=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;return this._activeDraftId&&(this._resumeDraftBySpace[this._space]=this._activeDraftId),this._commitSpace(e),this._path=[],this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this._tool="draw",this._activeDraftId=null,this._draftSegmentCms=[],this._closingWallCm=null,this._selId=null,this._physicalSel=null,this._editorSecondary?.closeForNavigation(),this._physicalDialog=null,this._physicalDrag=null,"plan"===this._mode&&"draw"===this._tool&&this._resumeLastDraft(),this._restoreZoom(),i||(this._slide=t,clearTimeout(this._slideTimer),this._slideTimer=window.setTimeout(()=>{this._slideTimer=void 0,this._slide="",this.requestUpdate()},190),this.requestUpdate()),!0}get _canReorderTabs(){return Ef({canEdit:this._canEdit,kiosk:this._kiosk,mode:this._mode,pointerType:"mouse",spaceCount:this._model.length,fixedFloor:this._hasFixedFloor})}_tabPointerDown(e,t){Ef({canEdit:this._canEdit,kiosk:this._kiosk,mode:this._mode,pointerType:e.pointerType,spaceCount:this._model.length,fixedFloor:this._hasFixedFloor})&&(ag(e),this._tabDragRelease=e=>this._tabPointerUp(e),window.addEventListener("pointerup",this._tabDragRelease),window.addEventListener("pointercancel",this._tabDragRelease),this._tabDrag={id:t,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:!1,targetId:null,placement:null})}_tabDropTargetAt(e,t,i){const n=this._model.map(e=>e.id),r=n.indexOf(i);if(r<0)return null;const o=this.renderRoot.querySelectorAll('[data-hp="space-tab"]');for(const s of o){const o=s.dataset.id||"";if(!o||o===i)continue;const a=s.getBoundingClientRect();if(e<a.left||e>a.right||t<a.top||t>a.bottom)continue;const l=n.indexOf(o);return l<0?null:{targetId:o,placement:l<r?"before":"after"}}return null}_tabPointerMove(e){const t=this._tabDrag;if(!t||t.pointerId!==e.pointerId)return;if(!(t.moved||(i=e.clientX-t.x,n=e.clientY-t.y,Math.hypot(i,n)>=4)))return;var i,n;const r=this._tabDropTargetAt(e.clientX,e.clientY,t.id);t.moved&&t.targetId===r?.targetId&&t.placement===r?.placement||(this._tabDrag={...t,moved:!0,targetId:r?.targetId||null,placement:r?.placement||null})}_tabPointerUp(e){const t=this._tabDrag;if(t&&t.pointerId!==e.pointerId)return;const i="pointerup"===e.type&&t?.moved?this._tabDropTargetAt(e.clientX,e.clientY,t.id):null;"pointerup"===e.type&&t?.moved&&this._suppressNextTabClick(),this._endTabDrag(),t?.moved&&i&&this._commitTabOrder(t.id,i.targetId)}_endTabDrag(){this._tabDrag=null,this._tabDragRelease&&(window.removeEventListener("pointerup",this._tabDragRelease),window.removeEventListener("pointercancel",this._tabDragRelease),this._tabDragRelease=null)}_tabClick(e){if(this._tabSuppressClick)return this._tabSuppressClick=!1,clearTimeout(this._tabSuppressClickTimer),void(this._tabSuppressClickTimer=void 0);this._pickSpace(e)}_suppressNextTabClick(){this._tabSuppressClick=!0,clearTimeout(this._tabSuppressClickTimer),this._tabSuppressClickTimer=window.setTimeout(()=>{this._tabSuppressClick=!1,this._tabSuppressClickTimer=void 0},0)}_commitTabOrder(e,t){const i=this._serverCfg;if(!i||!this._canReorderTabs)return;const n=this._model.map(e=>e.id),r=function(e,t,i){const n=e.indexOf(t),r=e.indexOf(i);if(n<0||r<0||n===r)return e;const o=e.slice();return o.splice(n,1),o.splice(r,0,t),o}(n,e,t);if(r===n)return;const o=new Map(this._devices.map(e=>[String(e.id),String(e.area||"")])),s=function(e,t,i,n=()=>""){if(!i)return[];const r=[];for(const o of e){if(!o||!0===o.removed)continue;const e="string"==typeof o.id?o.id:"";if(!e)continue;if("string"==typeof o.space&&o.space)continue;const s=("string"==typeof o.area?o.area:"")||n(e)||"";s&&t[s]||r.push({id:e,space:i})}return r}(i.markers||[],Object.fromEntries(Object.entries(this._areaToSpace).map(([e,t])=>[e,t.space])),n[0]||"",e=>o.get(e)||"");if(s.length){const e=new Map(s.map(e=>[e.id,e.space]));for(const t of i.markers||[]){const i=e.get(String(t.id));i&&(t.space=i)}}i.spaces=function(e,t){const i=new Map(t.map((e,t)=>[e,t]));return e.map((e,t)=>({space:e,index:t})).sort((e,t)=>(i.get(String(e.space?.id))??Number.MAX_SAFE_INTEGER)-(i.get(String(t.space?.id))??Number.MAX_SAFE_INTEGER)||e.index-t.index).map(e=>e.space)}(i.spaces||[],r),this._saveConfig(),this._tabOrderWarned||(this._tabOrderWarned=!0,this._showToast(this._t("toast.space_order_changed")))}_pickSpace(e){if(this._endTabDrag(),e===this._space)return;const t=this._model.map(e=>e.id),i=t.indexOf(this._space),n=t.indexOf(e);this._navApplied=!0,this._showFar=!1,this._frame=null,this._slideTo(e,i>=0&&n<i?"right":"left")&&this._saveNav()}_cycleTick(){if(!this._hasFixedFloor&&this._kiosk&&Number(this._config?.cycle)>0&&Date.now()>=this._cyclePausedUntil&&this._model.length>1&&this._zoom<=1.001){const e=this._model.map(e=>e.id),t=e.indexOf(this._space);this._slideTo(e[(t+1)%e.length],"left"),this._showKioskDots()}}_syncCycleTimer(){clearInterval(this._cycleTimer),this._cycleTimer=void 0,this.isConnected&&!this._hasFixedFloor&&this._config?.kiosk&&Number(this._config.cycle)>0&&(this._cycleTimer=window.setInterval(()=>this._cycleTick(),1e3*Number(this._config.cycle)))}get _editing(){return"plan"===this._mode||"devices"===this._mode||"decor"===this._mode}get _markup(){return"plan"===this._mode}get _wallUnionCache(){return this._wallUnionCacheValue}set _wallUnionCache(e){this._wallUnionCacheValue=e,null===e&&this._wallUnionPool.clear()}get _glowClipCache(){return this._glowRuntimeState.clipCache}get _glowGeometryWarnings(){return this._glowRuntimeState.geometryWarnings}get _glowFeatherUnits(){return this._glowRuntimeState.featherUnits}set _glowFeatherUnits(e){this._glowRuntimeState.featherUnits=e}get _glowRenderedSources(){return this._glowRuntimeState.renderedSources}get _glowLastAppearance(){return this._glowRuntimeState.lastAppearance}get _glowFeatherSuspendUntil(){return this._glowRuntimeState.featherSuspendUntil}set _glowFeatherSuspendUntil(e){this._glowRuntimeState.featherSuspendUntil=e}get _glowFeatherResumeTimer(){return this._glowRuntimeState.featherResumeTimer}set _glowFeatherResumeTimer(e){this._glowRuntimeState.featherResumeTimer=e}get _glowSourceSeq(){return this._glowRuntimeState.sourceSeq}set _glowSourceSeq(e){this._glowRuntimeState.sourceSeq=e}_syncDangerConfirmLocaleGate(){return this._config&&this.hass?ou(this,hu,fu(this.hass,this._config.language)):"ready"}_dangerConfirmMissingSpace(){const e=this._model;if(!e.length)return!1;const t=this._fixedFloorState(e);return"pending"!==t.kind&&"invalid"!==t.kind&&!this._spaceModel()}_newContinuityController(){return new Nl(()=>{this._resumeSettling="steady"!==this._continuity.state,this._continuityEpoch++,this.isConnected&&this.requestUpdate()})}get _labsIso(){return this._labs.active.includes("iso")}get _desiredProjection(){return"view"===this._mode&&this._labsIso&&"iso"===this._viewPreference[this._space]?"iso":"flat"}_saveViewPreference(){try{localStorage.setItem(Qf,JSON.stringify(this._viewPreference))}catch{}}_logicalViewCenter(e){const t=this._view;if(!t)return null;const i=[t.x+t.w/2,t.y+t.h/2],n="iso"===e?pf(i):i;return{x:n[0],y:n[1]}}_convertProjectionView(e,t){if(e===t)return;const i=this._logicalViewCenter(e);this._view=null;const n=i?"iso"===t?uf([i.x,i.y],0):[i.x,i.y]:null;this._applyView(this._zoom,n?.[0],n?.[1]),this._warmPatch({vp:this._warmViewportState()}),this.requestUpdate()}_setProjection(e){if(!this._labsIso||"view"!==this._mode)return;const t=this._effectiveProjection();if(this._viewPreference={...this._viewPreference,[this._space]:e},"iso"===e){const e=this._isoSceneKey();e&&this._isoFallback.delete(e)}this._saveViewPreference();const i=this._effectiveProjection();this._convertProjectionView(t,i)}_hashSpace(){return J_(window.location.hash||"")}connectedCallback(){this._connectedPath=location.pathname,this._routeDepartureHandled=!1,window.addEventListener("location-changed",this._onLocationChanged),window.addEventListener("popstate",this._onLocationChanged),this._continuityDisposed&&(this._continuity=this._newContinuityController(),this._continuityDisposed=!1,this._continuityPaintToken=-1);const e=p_(this.ownerDocument);var t;void 0!==e&&(this._glowScreenBlend=e),this._continuityUnsub?.(),this._continuityUnsub=El(this.ownerDocument,this._pageVisibility),this._languageFailureUnsub?.(),this._languageFailureUnsub=(t=()=>{this._showToast(this._t("toast.locale_load_failed"))},cu.add(t),()=>cu.delete(t)),super.connectedCallback(),this._pointerModality.connect(this.ownerDocument.defaultView);const i=this.ownerDocument.defaultView?.MutationObserver;i&&(this._pointerHoverObserver=new i(e=>{for(const t of e)for(const e of t.addedNodes)this._syncPointerHoverSubtree(e)}),this._pointerHoverObserver.observe(this.renderRoot,{childList:!0,subtree:!0})),this._motionMedia=window.matchMedia?.("(prefers-reduced-motion: reduce)"),this._reducedMotion=!!this._motionMedia?.matches,this._motionMedia?.addEventListener?.("change",this._onMotionChange),u_(this.ownerDocument).then(e=>{e!==this._glowScreenBlend&&(this._glowScreenBlend=e,this.isConnected&&this.requestUpdate())}),this.hass&&this._ensureHaRegistryAuthority(),window.addEventListener("keydown",this._keyHandler),this._signer.start(()=>this.hass,()=>this._referencedContentUrls()),this._syncCycleTimer(),window.addEventListener("hashchange",this._onHashChange),this._labsUnsub?.(),this._labsUnsub=function(e,t){sf.add(t);const i=cf(e);return"undefined"==typeof window&&t(i),()=>{sf.delete(t)}}(Nf,this._onLabsSnapshot),this._booting?this._bootWatch():this._bootFading&&(clearTimeout(this._bootTimer),this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220)),this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},Bf)),!this._loadOk&&this._serverCfg&&this.hass&&this._scheduleLoadRetry(),!this._warmSlot&&this._config&&this._warmAdopt(),this._loadOk&&this._ensureLiveSyncSubscriptions(),this._warmVp&&!this._warmRevivePending&&void 0===this._warmReviveTimer&&(this._warmRevivePending=!0,this._warmReviveTimer=window.setTimeout(()=>this._warmReviveDialog(),0)),this._warmLongReturn&&this._beginResumeSettle(),this._warmLongReturn=!1,this.requestUpdate()}disconnectedCallback(){this._cancelDangerConfirm(),this._connectedPath&&location.pathname!==this._connectedPath&&this._leaveCardRoute(),window.removeEventListener("location-changed",this._onLocationChanged),window.removeEventListener("popstate",this._onLocationChanged),this._continuityUnsub?.(),this._continuityUnsub=void 0,this._languageFailureUnsub?.(),this._languageFailureUnsub=void 0,this._motionMedia?.removeEventListener?.("change",this._onMotionChange),this._motionMedia=void 0,this._vacRaf&&(cancelAnimationFrame(this._vacRaf),this._vacRaf=0),this._refitRaf&&(cancelAnimationFrame(this._refitRaf),this._refitRaf=0),this._warmModeRequest=0,this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),this._dayCycleClockKey="",this._bootSettleRaf&&(cancelAnimationFrame(this._bootSettleRaf),this._bootSettleRaf=0),this._bootSettling=!1;for(const e of this._activityRt.values())clearTimeout(e.timer);window.removeEventListener("keydown",this._keyHandler),this._endTabDrag(),clearTimeout(this._tabSuppressClickTimer),this._tabSuppressClickTimer=void 0,this._tabSuppressClick=!1,clearInterval(this._cycleTimer),clearTimeout(this._kioskDotsTimer),clearTimeout(this._kioskHoldTimer),clearTimeout(this._reloadRetry),clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),this._connHooked=null,this._haRegistryRelease?.(),this._haRegistryRelease=void 0,this._haRegistryConnection=null,this._signer.dispose(),clearTimeout(this._toastTimer),clearTimeout(this._slideTimer),clearTimeout(this._editorRuntimeLoadingTimer),this._editorRuntimeLoadingTimer=void 0,this._editorRuntimeLoadingVisible=!1,this._modeTransition.dispose(),this._cameraTransition.dispose(),this._cameraTransitionFit=null,this._modeTransitionVisual=null,this._modeTransitionPreparing=!1,this._modeTransitionForceAtomic=!1,this._modeTransitionRequest++,this._slideTimer=void 0,this._slide="",clearTimeout(this._bootTimer),this._bootTimer=void 0,clearTimeout(this._bootSoftTimer),this._saveConfigDebounced.flush(),this._cancelDeviceDrag(),window.removeEventListener("hashchange",this._onHashChange),this._labsUnsub?.(),this._labsUnsub=void 0,clearTimeout(this._holdTimer),this._roViewport?.disconnect(),this._roViewport=void 0,this._roHdr?.disconnect(),this._roHdr=void 0,this._onWinResize&&(window.removeEventListener("resize",this._onWinResize),this._onWinResize=void 0),this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),this._unsubLayout&&(this._unsubLayout(),this._unsubLayout=null),this._unsubVirtual&&(this._unsubVirtual(),this._unsubVirtual=null),this._unsubTrail&&(this._unsubTrail(),this._unsubTrail=void 0),this._liveSyncGeneration++,this._liveSyncAttempt=null,this._liveSyncConnection=null,clearTimeout(this._layoutSyncTimer),clearTimeout(this._duplicateColumnTimer),Fm(this._glowRuntimeState,this._glowRuntimeHost),this._warmSnapshot(),this._warmRevivePending=!1,clearTimeout(this._warmReviveTimer),this._warmReviveTimer=void 0,this._warmRelease(),this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this._editorRuntime?._clearFurniturePreview(),this._editorRuntime?._furnShiftDetach(),this._touchContacts.clear(),this._touchSequenceMultitouch=!1,this._touchClickBlockUntil=0,this._clearTransientHover(!0),this._cancelDevicePressFeedback(),this._pointerHoverObserver?.disconnect(),this._pointerHoverObserver=void 0,this._pointerModality.disconnect(),this._editorSecondary?.reset(),this._resumeSettling=!1,this._continuityHistory=[...this._continuityHistory,...this._continuity.trace].slice(-80),this._continuity.dispose(),this._continuityDisposed=!0,super.disconnectedCallback()}_onKey(e){if("Escape"===e.key&&this._vacFit)return this._vacFit=null,this._showToast(this._t("vac.cal_cancelled")),void e.stopPropagation();if("Escape"===e.key){if(this._tapConfirm)return void(this._tapConfirm=null);if(this._vacCalConfirm)return void(this._vacCalConfirm=null);if(this._decorEraseConfirm)return void(this._decorEraseConfirm=null);if(this._openingInfo)return void(this._openingInfo=null);if(this._infoCard)return void this._closeInfoCard();if(this._rulesDialog)return void(this._rulesDialog=null);if(this._alignDialog)return this._alignDialog=null,void(this._preflightClipboardFallback=null);if(this._backupImportDialog)return void(this._backupImportDialog=null);if(this._backupExportDialog)return void(this._backupExportDialog=null);if(this._supportDialog)return void this._editorRuntime?._closeSupportDialog();if(this._settingsDialog)return void(this._settingsDialog=null);if(this._markerDialog)return void this._closeMarkerDialog();if(this._deviceInbox)return void(this._deviceInbox=null);if(this._openingDialog)return void(this._openingDialog=null);if(this._physicalDialog)return void(this._physicalDialog=null);if(this._backdropDialog)return void(this._backdropDialog=null);if(this._decorShapeDialog)return void(this._decorShapeDialog=null);if(this._decorTextDialog)return void(this._decorTextDialog=null);if(this._spaceDialog&&!this._roomDialog)return this._spaceDialog=null,this._importQueue=[],void(this._importTotal=0);if(this._editorSecondary?.hasOpenGroup)return e.preventDefault(),void this._editorSecondary?.closeGroup(!0)}const t=e.composedPath?.()||[e.target],i=t.some(e=>e?.matches?.('input, textarea, select, [contenteditable="true"]')),n=t.some(e=>e?.classList?.contains?.("editor-secondary")),r=e.ctrlKey||e.metaKey,o=e.key.toLowerCase(),s=/^[a-z]$/.test(o),a="z"===o||!s&&"KeyZ"===e.code,l="y"===o||!s&&"KeyY"===e.code,c=r&&(a&&e.shiftKey||l),h=r&&a&&!e.shiftKey;if("decor"===this._mode){if((h||c)&&i)return;return c?(e.preventDefault(),void this._redoGeometry()):h?(e.preventDefault(),this._decorDraft?void(this._decorDraft=null):this._decorMove||this._dtDrag||this._bdDrag?void this._cancelDecorGesture():void this._undoGeometry()):"Delete"!==e.key&&"Backspace"!==e.key||!this._decorSel||i||n?void("Escape"===e.key&&(e.preventDefault(),this._decorDraft?this._decorDraft=null:this._decorMove||this._dtDrag||this._bdDrag?this._cancelDecorGesture():"furniture"===this._decorTool?(this._editorRuntime?._clearFurniturePreview(),this._editorRuntime?._furnShiftDetach(),this._furnPalette=null,this._furnCategory=null,this._decorTool="select"):this._decorSel?this._decorSel=null:"select"!==this._decorTool?this._decorTool="select":this._setMode("view"))):(e.preventDefault(),void this._decorDeleteSel())}if("devices"===this._mode){if((h||c)&&i)return;return c?(e.preventDefault(),void this._redoDevicePosition()):h?(e.preventDefault(),void this._undoDevicePosition()):void("Escape"===e.key&&this._deviceDrag&&(e.preventDefault(),this._cancelDeviceDrag()))}if(this._markup&&(!h&&!c||!i)){if(("Delete"===e.key||"Backspace"===e.key)&&this._physicalSel&&!i&&!n)return e.preventDefault(),void this._deletePhysicalSelection();if(c)return e.preventDefault(),void this._redoGeometry();if(h)return e.preventDefault(),this._resize?.dragging?void this._rszCancelDrag():this._wallFaceBatch?(this._roomDialogCancel(),void(this._activeDraftId&&this._path.length>1?this._undoActiveDraftPoint():this._undoPoint())):"draw"===this._tool&&this._path.length?void(this._activeDraftId&&this._path.length>1?this._undoActiveDraftPoint():this._undoPoint()):"split"===this._tool&&this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},void(this._splitSel.pts.length||(this._cursorPt=null))):void this._undoGeometry();if("Escape"===e.key)return this._physicalDrag||this._physicalRotate?(e.preventDefault(),void this._cancelPhysicalGesture()):this._roomDialog?(e.preventDefault(),void this._roomDialogCancel()):"draw"===this._tool&&this._path.length?(e.preventDefault(),void this._finishWallChain()):this._physicalSel?(e.preventDefault(),void(this._physicalSel=null)):"resize"===this._tool?(e.preventDefault(),this._resize?.dragging?void this._rszCancelDrag():("exit-tool"===this._resize?.escapeIdle()&&(this._tool="draw"),void this.requestUpdate())):"split"===this._tool?(e.preventDefault(),void(this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},this._splitSel.pts.length||(this._cursorPt=null)):this._splitSel?this._splitSel=null:this._tool="draw")):"merge"===this._tool?(e.preventDefault(),void(this._mergeSel?this._mergeSel=null:this._tool="draw")):this._wallDialog?(e.preventDefault(),void(this._wallDialog=null)):void("opening"!==this._tool&&"wallthick"!==this._tool&&"delroom"!==this._tool&&"column"!==this._tool||(e.preventDefault(),"opening"===this._tool&&this._clearOpeningPlacement(!0),this._tool="draw"))}}_undoPoint(){if(this._path.length){if(this._contourClosed)return this._path=this._path.slice(0,-1),void(this._closingWallCm=null);if(this._activeDraftId&&this._path.length>1&&this._curSpaceCfg){const e=this._geometrySnapshot();this._path=this._path.slice(0,-1),this._draftSegmentCms=this._draftSegmentCms.slice(0,-1);const t=this._curSpaceCfg,i=(t.room_drafts||[]).findIndex(e=>e.id===this._activeDraftId);if(i>=0){const n=Array.isArray(t.room_drafts[i]?.segments)?t.room_drafts[i].segments:[];this._path.length<2?(t.room_drafts.splice(i,1),t.room_drafts.length||delete t.room_drafts,this._activeDraftId=null):t.room_drafts[i]={id:this._activeDraftId,points:this._path.map(e=>[e[0]/tg,e[1]/tg]),segments:this._draftSegmentCms.map((e,t)=>({...n[t]||{},cm:e}))},this._commitPhysicalGeometry(this._t("history.draft_segment_delete"),e)}return}this._path=this._path.slice(0,-1)}}_undoActiveDraftPoint(){const e=this._activeDraftId,t=this._path[0]?[...this._path[0]]:null,i=this._geometryHistory.undo();if(!i)return void this._undoPoint();if(!this._applyGeometryState(i.before,!0))return void this._geometryHistory.clear();const n=e?this._spaceModel()?.room_drafts.find(t=>t.id===e):null;n?(this._activeDraftId=n.id,this._path=n.points.map(e=>[...e]),this._draftSegmentCms=this._adoptDraftCms(this._path,n.segments.map(e=>e.cm),n.id),this._resumeDraftBySpace[this._space]=n.id):(this._activeDraftId=null,this._path=t?[t]:[],this._draftSegmentCms=[],e&&this._resumeDraftBySpace[this._space]===e&&delete this._resumeDraftBySpace[this._space]),this._clearPlanSnapHover(),this._showToast(this._t("history.undone",{name:i.name}))}static async getConfigElement(){return await import("./editor-GNX-fEXr.js"),document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card"}}static _warmBootReset(e){for(const e of jf.values())for(const t of e)clearTimeout(t.evict);jf.clear(),Gf=e&&e>0?e:1e4}static _warmBootStats(){let e=0,t=0;const i=[];for(const n of jf.values())for(const r of n)e++,r.dlg&&(t++,i.push(r.dlg.kind));return{keys:jf.size,slots:e,dlgs:t,drafts:i}}setConfig(e){const t=this._config,i=!!t&&Object.prototype.hasOwnProperty.call(t,"floor");this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...e};(i!==this._hasFixedFloor||t?.floor!==this._config.floor)&&(this._hashApplied=!1,this._navApplied=!1,this._warmVpArmed=!1),this._config.kiosk&&(this._booting=!1,this._bootFading=!1),!this._hasFixedFloor&&e.default_floor&&this._commitSpace(e.default_floor,!0);try{this._zoomBySpace=JSON.parse(localStorage.getItem(Xf)||"{}")||{}}catch{this._zoomBySpace={}}try{const e=JSON.parse(localStorage.getItem(Qf)||"{}")||{};this._viewPreference=Object.fromEntries(Object.entries(e).filter(e=>"flat"===e[1]||"iso"===e[1]))}catch{this._viewPreference={}}this._labs=cf(Nf);try{const e=JSON.parse(localStorage.getItem(Jf)||"null");this._kioskScale={icon:kn(e?.icon),font:kn(e?.font)}}catch{}try{const e=JSON.parse(localStorage.getItem(Yf)||"null");e&&e.config&&Array.isArray(e.config.spaces)&&(this._serverCfg=e.config,this._seedDecorStyle(this._serverCfg),this._cfgEpoch++,this._cfgRev=e.rev||0,this._cfgContentFingerprint=e.config_fingerprint||Ll(e.config),this._layout=e.layout||{},this._layoutRev=e.layout_rev||0,this._layoutContentFingerprint=e.layout_fingerprint||Ll(this._layout),this._virtualLights=Wc(e.virtual_lights,this._cfgRev),this._serverStorage=!0)}catch{}this._adoptInitialSpace(this._model,this._loadOk),"view"!==this._mode||this._view||(this._zoom=this._zoomBySpace[this._space]||1),this.isConnected&&(this._syncCycleTimer(),this._warmAdopt(),this._warmLongReturn&&this._beginResumeSettle(),this._warmLongReturn=!1)}_warmAdopt(){if(this._config?.kiosk)return;const e=Vf(this._config);if(this._warmKey===e&&this._warmSlot)return;this._warmSlot&&this._warmRelease();const t=this.parentNode,i=this._warmIdx(t),n=jf.get(e);if(!n||!n.length)return;const r=n.find(e=>e.owner===this._warmGen);if(r)return this._warmLongReturn=!!r.freed&&Date.now()-r.freed>=Ol,clearTimeout(r.evict),r.evict=0,r.freed=0,r.live=!0,this._warmSlot=r,this._warmKey=e,r.frameFingerprint&&this._continuity.adoptCompleteFrame(r.frameFingerprint),void(!this._devices.length&&r.devices?.length&&(this._devices=[...r.devices]));const{slot:o,sure:s}=((e,t,i,n)=>{const r=e=>{const t=!!i&&e.place?.deref()===i;return t&&e.idx===n?4:e.live?0:t?3:2};let o=null,s=0,a=0,l=null;for(const i of e){if(i.owner===t)continue;l=i;const e=r(i);e<=0||(e>s?(o=i,s=e,a=1):e===s&&a++)}return!o||a>1?{slot:o||l,sure:!1}:{slot:o,sure:!0}})(n,this._warmGen,t,i);o&&(this._warmLongReturn=!!o.freed&&Date.now()-o.freed>=Ol,this._booting=!1,this._bootFading=!1,this._hdrH=o.hdrH,this._bootSoft=!0,this.isConnected&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},Bf)),this._warmKey=e,s?(clearTimeout(o.evict),o.evict=0,o.owner=this._warmGen,o.place=t?new WeakRef(t):null,o.idx=i,o.live=!0,this._warmSlot=o,this._warmVp=o.vp,o.frameFingerprint&&this._continuity.adoptCompleteFrame(o.frameFingerprint),!this._devices.length&&o.devices?.length&&(this._devices=[...o.devices]),this._warmAdoptViewport(this._config)):(this._warmSlot={owner:this._warmGen,path:location.pathname,place:t?new WeakRef(t):null,idx:i,live:!0,hdrH:o.hdrH,stageH:o.stageH,vp:null,frameFingerprint:"",devices:null,dlg:null,freed:0,evict:0},n.push(this._warmSlot),this._warmTrim(n)))}_warmIdx(e){const t=e?.children;if(!t)return-1;for(let e=0;e<t.length;e++)if(t[e]===this)return e;return-1}_warmRelease(){const e=this._warmSlot,t=this._warmKey;this._warmSlot=null,this._warmKey=null,e&&t&&(e.freed=Date.now(),e.owner===this._warmGen&&(e.live=!1),this._warmScheduleEvict(e,t))}_warmTrim(e){for(;e.length>4;){const t=e.findIndex(e=>!e.live);if(t<0)break;clearTimeout(e[t].evict),e.splice(t,1)}}_warmScheduleEvict(e,t){if(clearTimeout(e.evict),!(e.dlg||e.vp&&"view"!==e.vp.mode))return;const i=e.freed,n=e.owner;e.evict=window.setTimeout(()=>{if(e.evict=0,e.freed!==i||e.owner!==n)return;var r;e.dlg=null,e.vp=(r=e.vp)&&"view"!==r.mode?{...r,mode:"view",zoom:r.snap?.space===r.space?r.snap.zoom:r.zoom,view:null,snap:null,tool:"draw",decorTool:"select",showHidden:!1,selId:null,rszSel:null,decorSel:null}:r,e.frameFingerprint="";const o=jf.get(t);if(!e.live&&o&&o.length>1){const t=o.indexOf(e);t>=0&&o.splice(t,1)}},Gf+250)}_warmAdoptViewport(e){const t=this._warmVp;if(!t||this._warmSlot?.path!==location.pathname)return void(this._warmVp=null);const i=this._fixedFloorState();if(this._hashApplied||!this._model.find(e=>e.id===t.space)||"valid"===i.kind&&i.id!==t.space||this._hasFixedFloor&&"valid"!==i.kind)return void(this._warmVp=null);this._commitSpace(t.space,!0),this._navApplied=!0;const n="view"!==t.mode&&this._canEdit&&!e.kiosk?t.mode:"view";this._adoptMode("view"),this._pendingNavMode="view"===t.mode||this._canEdit||e.kiosk?null:t.mode,this._zoom=t.zoom;const r=this._effectiveProjection(),o=r===t.projection&&this._labsIso===t.activeLabsIso;if(this._view=o&&t.view?{...t.view}:null,this._viewModeSnap=o&&t.snap?{...t.snap}:null,!o&&t.logicalCenter){const e="iso"===r?uf([t.logicalCenter.x,t.logicalCenter.y],0):[t.logicalCenter.x,t.logicalCenter.y];this._applyView(t.zoom,e[0],e[1])}var s;this._tool="opening"===(s=function(e){return"partition"===e?"draw":e}(s=t.tool))?"draw":"string"==typeof s&&ng.has(s)?s:"draw",this._decorTool=t.decorTool,this._showHidden=t.showHidden,this._showFar!==t.showFar&&(this._showFar=t.showFar,this._frame=null),this._selId=t.selId,this._resize?.restoreSelection(t.rszSel),this._decorSel=t.decorSel,this._warmVpArmed=!0,"view"!==n&&this._requestMode(n,!1,!0)}_warmPatch(e,t=!1){if(this._config?.kiosk)return;const i=Vf(this._config);if(!this._warmSlot||this._warmKey===i){if(!this._warmSlot){if(!t)return;const e=this.parentNode;this._warmKey=i,this._warmSlot={owner:this._warmGen,path:location.pathname,place:e?new WeakRef(e):null,idx:this._warmIdx(e),live:!0,hdrH:this._hdrH,stageH:0,vp:null,frameFingerprint:"",devices:null,dlg:null,freed:0,evict:0};const n=jf.get(i)||[];for(n.push(this._warmSlot),jf.set(i,n),this._warmTrim(n);jf.size>8;){const e=jf.keys().next().value;if(void 0===e||e===i)break;for(const t of jf.get(e)||[])clearTimeout(t.evict);jf.delete(e)}}Object.assign(this._warmSlot,e)}}_warmViewportState(){const e=this._effectiveProjection();return{space:this._space,mode:this._mode,projection:e,activeLabsIso:this._labsIso,logicalCenter:this._logicalViewCenter(e),zoom:this._zoom,view:this._view?{...this._view}:null,snap:this._viewModeSnap?{...this._viewModeSnap}:null,tool:this._tool,decorTool:this._decorTool,showHidden:this._showHidden,showFar:this._showFar,selId:this._selId,rszSel:this._resize?.selectedRoomId,decorSel:this._decorSel}}_warmDialogState(){const e=(e,t)=>({kind:e,space:this._space,mode:this._mode,data:t});return this._tapConfirm||this._alignDialog||this._mergeDialog||this._importDialog||this._backupExportDialog||this._backupImportDialog?null:this._openingInfo?e("openingInfo",this._openingInfo.id):this._infoCard?e("info",this._infoCard.id):this._rulesDialog?this._rulesDialog.busy?null:e("rules",this._rulesDialog):this._settingsDialog?this._settingsDialog.busy?null:e("settings",this._settingsDialog):this._markerDialog?this._markerDialog.busy?null:e("marker",this._markerDialog):this._openingDialog?e("opening",this._openingDialog):this._backdropDialog?e("backdrop",this._backdropDialog):this._decorShapeDialog?e("decorShape",this._decorShapeDialog):this._decorTextDialog?e("decorText",this._decorTextDialog):this._roomDialog?e("room",{editId:this._roomEditId,fill:this._roomFill,customFill:this._roomCustomFill,tempSrc:this._roomTempSrc,humSrc:this._roomHumSrc,srcOpen:this._roomSrcOpen,srcFilter:this._roomSrcFilter,nameScale:this._roomNameScale,labelScale:this._roomLabelScale,areaSel:this._areaSel,nameSel:this._nameSel,pendingSplit:this._pendingSplit,wallFaceBatch:this._wallFaceBatch,path:this._path}):this._spaceDialog?this._spaceDialog.busy?null:e("space",this._spaceDialog):null}_warmSnapshot(){if(this._booting||this._config?.kiosk||"steady"!==this._continuity.state)return;const e={vp:this._warmViewportState(),frameFingerprint:this._continuity.frameFingerprint,devices:this._devices};if(this._warmRevivePending||(e.dlg=this._warmDialogState()),this.isConnected&&this._warmSlot?.owner===this._warmGen){const t=this.parentNode;e.place=t?new WeakRef(t):null,e.idx=this._warmIdx(t)}this._warmPatch(e)}_warmReviveDialog(){const e=this._warmSlot;if(this._warmReviveTimer=void 0,!e||!e.dlg)return void(this._warmRevivePending=!1);const t=e.dlg,i=e.freed;if(t.mode===this._mode||"view"===t.mode||this._warmVp?.mode!==t.mode||this._editorRuntime){if(this._warmRevivePending=!1,e.dlg=null,e.freed=0,clearTimeout(e.evict),e.evict=0,i&&!(Date.now()-i>Gf)&&t.space===this._space&&t.mode===this._mode){switch(t.kind){case"space":this._spaceDialog={...t.data,busy:!1,savedBusy:!1};break;case"marker":this._markerDialog={...t.data,busy:!1};break;case"settings":this._settingsDialog={...t.data,busy:!1};break;case"rules":this._rulesDialog={...t.data,busy:!1};break;case"opening":this._openingDialog={...t.data};break;case"backdrop":this._backdropDialog={...t.data};break;case"decorShape":this._decorShapeDialog={...t.data};break;case"decorText":{this._decorTextDialog={...t.data};const e=String(this._decorTextDialog?.text??"").length;this._decorTextSelection={start:e,end:e};break}case"room":{const e=t.data;this._roomEditId=e.editId,this._roomFill=e.fill,this._roomCustomFill=e.customFill||null,this._roomTempSrc=e.tempSrc,this._roomHumSrc=e.humSrc,this._roomSrcOpen=e.srcOpen,this._roomSrcFilter=e.srcFilter,this._roomNameScale=e.nameScale,this._roomLabelScale=e.labelScale,this._areaSel=e.areaSel,this._nameSel=e.nameSel,this._pendingSplit=e.pendingSplit,this._wallFaceBatch=e.wallFaceBatch||null,this._path=e.path,this._wallFaceBatch&&(this._activeDraftId=this._wallFaceBatch.activeDraftId,this._draftSegmentCms=[...this._wallFaceBatch.activeCms]),this._roomDialog=!0;break}case"info":{const e=this._devices.find(e=>e.id===t.data);e&&(this._infoCard=e);break}case"openingInfo":{const e=(this._curSpaceCfg?.openings||[]).find(e=>e.id===t.data);e&&(this._openingInfo=e);break}}this.requestUpdate()}}else this._warmRevivePending=!0}_cacheSnapshot(){if(this._serverCfg)try{this._cfgContentFingerprint=Ll(this._serverCfg),this._layoutContentFingerprint=Ll(this._layout),this._virtualLights=function(e,t,i){if(e.configRev===i)return e;const n=new Set((Array.isArray(t?.markers)?t.markers:[]).filter(Gc).map(e=>e.id));return{...e,configRev:i,off:new Set([...e.off].filter(e=>n.has(e)))}}(this._virtualLights,this._serverCfg,this._cfgRev),localStorage.setItem(Yf,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,config_fingerprint:this._cfgContentFingerprint,layout:this._layout,layout_rev:this._layoutRev,layout_fingerprint:this._layoutContentFingerprint,virtual_lights:Uc(this._virtualLights)}))}catch{}}_beginContinuityCandidate(e,t,i="plan"){return this._booting&&!this._continuity.hasCompleteFrame?this._continuity.token:(this._continuityDataReady=t,this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._resumeSettling=!0,this._continuity.beginCandidate(e,i))}_continuityStageValid(){const e=this._stageEl;return!!e&&e.clientWidth>0&&e.clientHeight>0}_continuityAssetsReady(){if(!this._model.length)return!1;const e=this._model.length?this._spaceModel():null;return!e?.bg?.href||this._signer.isReady(this.hass,e.bg.href)}_initialSpaceSelection(e,t=this._loadOk){const i=this._fixedFloorState(e,t);return"valid"===i.kind?{id:i.id,source:"fixed"}:this._hasFixedFloor?{id:null,source:"none"}:function(e){const t=new Set(e.spaceIds.filter(e=>!!e));if(!t.size)return{id:null,source:"none"};const i=[["hash",!1===e.acceptHash?null:e.hashSpace],["current",e.preserveCurrent?e.currentSpace:null],["saved",e.savedSpace],["default",e.defaultSpace],["first",e.spaceIds[0]]];for(const[e,n]of i)if(n&&t.has(n))return{id:n,source:e};return{id:null,source:"none"}}({spaceIds:e.map(e=>e.id),hashSpace:this._hashSpace(),acceptHash:!this._hashApplied,currentSpace:this._space,preserveCurrent:this._hashApplied||this._navApplied||this._warmVpArmed,savedSpace:this._savedNav()?.space,defaultSpace:this._config?.default_floor})}_adoptInitialSpace(e,t=this._loadOk){const i=this._initialSpaceSelection(e,t);return i.id?(this._commitSpace(i.id,!0),"hash"===i.source&&(this._hashApplied=!0),"saved"===i.source&&(this._navApplied=!0),i):i}_candidateBackdrop(e,t=this._space){const i=Ra(e),n=this._fixedFloorState(i,!0);if(this._hasFixedFloor&&"valid"!==n.kind)return"";const r=this._initialSpaceSelection(i,!0).id||(i.some(e=>e.id===t)?t:i[0]?.id);return i.find(e=>e.id===r)?.bg?.href||""}_visualFrameFingerprint(){const e=this._stageEl,t=e?[e.clientWidth,e.clientHeight]:[0,0];return Bl([this._cfgRev,this._cfgContentFingerprint||Ll(this._serverCfg),this._layoutRev,this._layoutContentFingerprint||Ll(this._layout),this._space,this._mode,this._view,t,this._glowScreenBlend?"screen":"normal",this.hass?.themes?.darkMode??this.hass?.themes?.default_theme??""])}_settleContinuityFrame(){if(this._booting||!this._continuityStageValid())return;if(!this._continuity.hasCompleteFrame&&"steady"===this._continuity.state)return void(this._continuityAssetsReady()&&(this._renderSnapshotAt=Date.now(),this._continuity.markCompleteFrame(this._visualFrameFingerprint())));if(!this._continuityDataReady)return;if(!["holding","offline-stale","overlay-pending","overlay-visible","candidate-ready"].includes(this._continuity.state))return;const e=this._continuity.token;if(this._candidateDeviceSnapshot&&this._candidateDeviceSnapshot!==this._visibleDeviceSnapshot&&this._stagedDeviceSnapshotToken!==e)return this._stagedDeviceSnapshotToken=e,void this.requestUpdate();this._continuityPaintToken!==e&&(this._continuityPaintToken=e,this._continuity.candidateReady(e)&&this._continuity.commitAfterPaint(e,{updateComplete:()=>this.updateComplete,stageValid:()=>this.isConnected&&this._continuityStageValid(),assetsReady:()=>this._continuityAssetsReady(),frameFingerprint:()=>this._visualFrameFingerprint()}).then(t=>{t&&e===this._continuity.token?(this._resumeSettling=!1,this._renderSnapshotAt=Date.now(),this._candidateDeviceSnapshot&&(this._visibleDeviceSnapshot=this._candidateDeviceSnapshot),this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1,this._warmSnapshot()):e===this._continuity.token&&(this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._candidateDeviceSnapshot=null,this.requestUpdate())}))}_onBackdropLoaded(e,t){this._signer.markLoaded(this.hass,e,t),this._continuity.note("asset-ready"),this._continuityPaintToken=-1,"steady"!==this._continuity.state&&this.requestUpdate()}_renderRecoveryOverlay(){if(!this._continuity.overlayVisible&&"recovery-error"!==this._continuity.state)return V;const e="connection"===this._continuity.recoveryReason;return W`<div class="recoveryoverlay phase-${this._continuity.overlayPhase}"
      role="status" aria-live="polite" aria-atomic="true"
      @pointerdown=${e=>e.stopPropagation()}
      @click=${e=>e.stopPropagation()}
      @wheel=${e=>e.stopPropagation()}>
        <ha-icon icon="mdi:home-sync-outline"></ha-icon>
        <span>${this._t(e?"continuity.restore_connection":"continuity.restore_plan")}</span>
        ${"recovery-error"===this._continuity.state?W`<button class="btn on" @click=${this._retryContinuity}>${this._t("continuity.retry")}</button>`:V}
      </div>`}_renderEditorRuntimeLoading(){return this._editorRuntimeLoadingVisible?W`<div class="editorloading" role="status" aria-live="polite"
      aria-label=${this._t("editor.loading_aria")}>
        <ha-icon icon="mdi:loading"></ha-icon>
        <span>${this._t("editor.loading")}</span>
      </div>`:V}houseplanContinuityTrace(){return[...this._continuityHistory,...this._continuity.trace].slice(-80).map(e=>({...e,...e.stage?{stage:[...e.stage]}:{}}))}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}_cfgFingerprint(){const e=this._serverCfg?.spaces||[];let t=e.length+":";for(const i of e){t+=(i.id||"")+","+(i.plan_aspect||"")+","+(i.plan_url||"").length+","+(i.plan_x??"")+","+(i.plan_y??"")+","+(i.plan_scale??"")+","+(i.plan_scale_x??"")+","+(i.plan_scale_y??"")+","+(i.plan_angle??"")+","+(i.rooms?.length||0)+","+(i.openings?.length||0)+","+(i.decor?.length||0)+";";for(const e of i.rooms||[]){const i=e.poly?.[0],n=e.poly?.[e.poly.length-1];t+=(e.poly?.length||0)+"."+(e.id||"")+"."+(e.open_to||[]).join("+")+"."+(e.area||"")+"."+JSON.stringify(e.settings||0)+"."+(e.x??"")+","+(e.y??"")+","+(e.w??"")+","+(e.h??"")+","+(i?i[0]+"/"+i[1]:"")+","+(n?n[0]+"/"+n[1]:"")+";"}}return t}get _model(){if(!this._serverCfg)return[];const e=this._cfgEpoch+"|"+this._cfgFingerprint();if(this._modelCache&&this._modelCache.key===e)return this._modelCache.model;const t=this._buildModel();return this._modelCache={key:e,model:t},t}_buildModel(){if(!this._serverCfg)return[];const e=this._renderCfg;return Ra(e).map((t,i)=>{const n=e.spaces[i]?.plan_url;return t.bg&&n?{...t,bg:{...t.bg,href:n}}:t})}_spaceModel(){return this._hasFixedFloor?jl(this._model,this._space):(e=this._model,t=this._space,e.find(e=>e.id===t)??e[0]);var e,t}_spaceModelById(e){return jl(this._model,e)}_syncEmptySpaceState(){if(!!this._serverCfg&&0===this._serverCfg.spaces.length){if(!this._emptySpaceStateActive){this._emptySpaceStateActive=!0;for(const e of this._pointers.keys())for(const t of this.renderRoot.querySelectorAll("*"))try{t.hasPointerCapture?.(e)&&t.releasePointerCapture(e)}catch{}this._pointers.clear(),this._panStart=null,this._panLock=null,this._pinchStart=null,this._swipeStart=null,this._drag=null,this._deviceDrag=null,this._rlResize=null,this._vacFit=null,this._compassDrag=!1,this._cancelModeTransition(!1),this._mode="view",this._clearGeometryGesture(),this._geometryHistory.clear(),this._devicePositionHistory.clear(),this._resumeDraftBySpace={},this._tip=null,this._hoverRoom=null,this._openingInfo=null,this._closeInfoCard(),this._deviceInbox=null,this._deviceInboxReturn=null,this._markerDialog=null,this._physicalDialog=null,this._backdropDialog=null,this._decorShapeDialog=null,this._decorTextDialog=null,this._roomDialog=!1,"edit"===this._spaceDialog?.mode&&(this._spaceDialog=null),this._editorSecondary?.closeForNavigation(),this._saveConfigDebounced.cancel(),this._frame=null,this._planSnapGeometryCache=null,this._hiddenWallDiagnosticCache=null,this._decorSnapCache=null,this._commitSpace("",!0)}}else this._emptySpaceStateActive=!1}get _areaToSpace(){const e={};for(const t of this._model)for(const i of t.rooms)i.area&&(e[i.area]={space:t.id,room:i});return e}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return this._showHidden||!this._settings.filter_seeded&&!!this._settings.show_all}_seedHiddenDevices(){if(!this._serverCfg||!this._norm||!this._canEdit)return;const e=this._serverCfg,t=rd({hass:this.hass,registry:this._haRegistry,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([e,t])=>[e,t.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,firstSpaceId:this._model[0]?.id||"",iconRules:this._iconRules});if(!t.length&&e.settings?.filter_seeded)return;e.markers=e.markers||[];const i=[];for(const n of t){const t="h"+n.slice(n.indexOf(":")+1);e.markers.push({id:t,binding:n,hidden:!0}),i.push(n.slice(n.indexOf(":")+1))}const n={...e.settings||{},filter_seeded:!0};delete n.show_all,i.length&&Array.isArray(n.new_device_ids)&&(n.new_device_ids=n.new_device_ids.filter(e=>!i.includes(e))),e.settings=n,this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate()}get _iconRules(){const e=this._settings.icon_rules;if(!e||!Array.isArray(e)||!e.length)return;const t=JSON.stringify(e);return t!==this._rulesCompiledSrc&&(this._rulesCompiledSrc=t,this._rulesCompiled=ye(e)),this._rulesCompiled}get _fillColors(){return Xi(this._settings)}get _excluded(){return ud(this._settings)}_setAreaLifecycleConfig(e){this._cfgEpochPreservedConfig=e,this._serverCfg=e}willUpdate(e){if(e.has("_serverCfg")){const e=this._cfgEpochPreservedConfig===this._serverCfg;this._cfgEpochPreservedConfig=null,e||this._cfgEpoch++}this._syncEmptySpaceState(),this._dangerConfirm&&(this._dangerConfirmMissingSpace()||"warm"===this._syncDangerConfirmLocaleGate())&&this._cancelDangerConfirm(),e.has("hass")&&this.hass&&(this._hassSequence++,this._renderSnapshotAt=Date.now(),this._continuity.note("hass-snapshot"),this._ensureHaRegistryAuthority(),this._planHassMemo=null,this._hookConnection(),!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices(),this._vacTick(),this._activityTick()),this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._continuity.refreshCompleteFrame(this._visualFrameFingerprint()),this._captureRenderDeviceSnapshot()}updated(){this._pruneDevicePressFeedback(),this._syncDayCycleClock(),this._warmSnapshot(),this._editorRuntime&&this._dtMeasure();const e=this._stageEl;e&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(e)),e&&this._booting&&!this._bootTimer&&this._bootWatch();const t=this.renderRoot.querySelector(".hdr");if(t&&e&&!this._roHdr){const i=()=>{const t=this.renderRoot.querySelector("ha-card");if(!t)return;const i=e.getBoundingClientRect().top-t.getBoundingClientRect().top,n=Math.min(Math.max(t.getBoundingClientRect().top,0),120),r=Math.round(i+n);r>=0&&r!==this._hdrH&&(this._hdrH=r),r>=0&&!this._booting&&!this._config?.kiosk&&e.clientHeight>0&&this._warmPatch({hdrH:r,stageH:e.clientHeight})};this._roHdr=new ResizeObserver(()=>requestAnimationFrame(i)),this._roHdr.observe(t),this._onWinResize=()=>requestAnimationFrame(i),window.addEventListener("resize",this._onWinResize),i()}if(e&&!this._view&&this._refitView(),this._editorSecondary?.afterRender(),this._settleContinuityFrame(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._importDialog&&!this._onboardingShown){this._onboardingShown=!0;const e=function(e){const t=e?.floors;if(!t||"object"!=typeof t)return[];const i=[];for(const e of Object.values(t))e&&e.floor_id&&i.push({id:e.floor_id,name:e.name||e.floor_id,level:e.level??null});return i.sort((e,t)=>{const i=e.level??1e9,n=t.level??1e9;return i!==n?i-n:e.name.localeCompare(t.name)}),i}(this.hass);e.length?this._importDialog={floors:e.map(e=>({...e,checked:!0}))}:this._openSpaceDialog("create")}}_adoptConfigCapabilities(e){const t=e&&"object"==typeof e?e:{};this._haIntegrationVersion="string"==typeof t.integration_version?t.integration_version:this._haIntegrationVersion;const i=t.support_api;this._haSupportApi="number"==typeof i&&Number.isSafeInteger(i)?i:null,this._haDecorAssetsApi=1===t.decor_assets_api?1:null}async _syncDecorAssets(e){const t=++this._decorAssetSyncToken;if(1!==this._haDecorAssetsApi||!this.hass)return void(this._decorAssets=new Map);const i=await tm(this.hass,Jp(e),this._cfgRev);t===this._decorAssetSyncToken&&(this._decorAssets=i,this._resign(),this.requestUpdate())}_adoptStructuralResponses(e,t,i){const n=e?.config,r=n&&Array.isArray(n.spaces)?n:null,o=Ll(r),s=o!==(this._cfgContentFingerprint||Ll(this._serverCfg));if(s&&(this._geometryHistory.clear(),this._devicePositionHistory.clear(),this._cancelDeviceDrag(),this._pendingPhysicalWrites.clear(),this._cancelCameraTransition(!1),this._serverCfg&&this._clearGeometryGesture(),this._serverCfg=r,this._seedDecorStyle(this._serverCfg),this._cfgContentFingerprint=o),this._cfgRev=e?.rev??this._cfgRev,e&&("virtual_lights"in e||"config"in e)){const t=jc(this._virtualLights,e.virtual_lights,this._cfgRev,"virtual_lights"in e);Vc(t)!==Vc(this._virtualLights)&&(this._virtualLights=t,this._capturedSnapshotVirtual="")}let a=!1;if(void 0!==t||void 0!==i){const e=i??t?.layout??{},n=Ll(e);a=n!==(this._layoutContentFingerprint||Ll(this._layout)),a&&(this._cancelCameraTransition(!1),this._devicePositionHistory.clear(),this._cancelDeviceDrag(),this._layout=e,this._layoutContentFingerprint=n),this._layoutRev=t?.rev??this._layoutRev}return this._canOptimizeUndo=!(!e?.can_optimize_undo&&!t?.can_optimize_undo),this._adoptConfigCapabilities(e),this._undoKind=e?.undo_kind||t?.undo_kind||null,"boolean"==typeof e?.can_write&&(this._serverCanWrite=e.can_write),s&&this._continuity.note("config-candidate",{configRev:this._cfgRev}),a&&this._continuity.note("layout-candidate",{layoutRev:this._layoutRev}),{configChanged:s,layoutChanged:a}}_resumePendingNavMode(){if(!this._pendingNavMode||!this._canEdit||this._config?.kiosk)return!1;const e=this._pendingNavMode;return this._pendingNavMode=null,this._setMode(e,!1),!0}async _loadFromServer(){this._loading=!0,this._loadTries++;const e=this._space,t=!!this._view;try{const[i,n]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]),r=i?.config&&Array.isArray(i.config.spaces)?i.config:null,o=Ll(r)!==(this._cfgContentFingerprint||Ll(this._serverCfg))||Ll(n?.layout??{})!==(this._layoutContentFingerprint||Ll(this._layout));if(o){if(!await this._signer.prepareImage(this.hass,this._candidateBackdrop(r)))return this._continuity.note("asset-failed"),void this._scheduleLoadRetry(!0)}o&&this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._beginContinuityCandidate("structural-response",!0),this._connectionWasLost=!1,this._serverStorage=!0,"boolean"==typeof i?.can_write&&(this._serverCanWrite=i.can_write),this._canOptimizeUndo=!(!i?.can_optimize_undo&&!n?.can_optimize_undo),this._adoptStructuralResponses(i,n),this._syncDecorAssets(r).catch(()=>{}),this._adoptInitialSpace(this._model,!0),this._resumePendingNavMode(),this._cacheSnapshot(),this._warmVpArmed&&this._space===this._warmVp?.space?this._warmVpArmed=!1:t&&this._space===e||this._restoreZoom(),this._loadOk=!0,this.hass.callWS({type:"houseplan/trail/get"}).then(e=>{this._vacSrvTrails=e?.trails||{},this.requestUpdate()}).catch(()=>{}),this._ensureLiveSyncSubscriptions()}catch(e){if(this._serverCfg)this._scheduleLoadRetry(!0);else if(this._loadTries>=8){this._serverStorage=!1;try{this._layout=JSON.parse(localStorage.getItem(Kf)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1,this._continuityDataReady=!0,this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}}_ensureLiveSyncSubscriptions(){const e=this.hass?.connection;if(!e)return;if(e!==this._liveSyncConnection&&(this._unsubCfg?.(),this._unsubCfg=null,this._unsubLayout?.(),this._unsubLayout=null,this._unsubTrail?.(),this._unsubTrail=void 0,this._unsubVirtual?.(),this._unsubVirtual=null,this._liveSyncGeneration++,this._liveSyncAttempt=null,this._liveSyncConnection=e),this._liveSyncAttempt)return;const t=this._liveSyncGeneration,i=[],n=(n,r,o,s)=>{n()||i.push(async()=>{const i=await e.subscribeEvents(s,o);t===this._liveSyncGeneration&&this.isConnected&&this.hass?.connection===e&&!n()?r(i):i?.()})};if(n(()=>this._unsubCfg,e=>{this._unsubCfg=e},"houseplan_config_updated",e=>{const t=Number(e?.data?.rev??-1);t!==this._cfgRev&&this._reloadConfigOnly(!1,t)}),n(()=>this._unsubTrail,e=>{this._unsubTrail=e},"houseplan_trail_updated",async()=>{try{const e=await this.hass.callWS({type:"houseplan/trail/get"});this._vacSrvTrails=e?.trails||{},this.requestUpdate()}catch{}}),n(()=>this._unsubLayout,e=>{this._unsubLayout=e},"houseplan_layout_updated",e=>this._onLayoutEvent(Number(e?.data?.rev??-1))),n(()=>this._unsubVirtual,e=>{this._unsubVirtual=e},"houseplan_virtual_light_updated",e=>{const t=Yc(this._virtualLights,e?.data);t!==this._virtualLights&&(this._virtualLights=t,this._capturedSnapshotVirtual="",this._cacheSnapshot(),this.requestUpdate())}),!i.length)return;const r=function(e){return Promise.allSettled(e.map(e=>Promise.resolve().then(e)))}(i).then(()=>{});this._liveSyncAttempt=r,r.finally(()=>{this._liveSyncAttempt===r&&(this._liveSyncAttempt=null)})}async _reloadConfigOnly(e=!1,t){if(!e){if(void 0!==t&&t<=this._cfgRev)return;if(this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),this._cfgWriting)return clearTimeout(this._reloadRetry),void(this._reloadRetry=window.setTimeout(()=>this._reloadConfigOnly(!1,t),400))}this._beginContinuityCandidate("config-reload",!1);try{const e=await this.hass.callWS({type:"houseplan/config/get"}),t=e?.config&&Array.isArray(e.config.spaces)?e.config:null;if(Ll(t)!==(this._cfgContentFingerprint||Ll(this._serverCfg))&&!await this._signer.prepareImage(this.hass,this._candidateBackdrop(t)))return this._continuity.note("asset-failed"),void this._scheduleLoadRetry(!0);const i=this._space;this._adoptStructuralResponses(e),this._syncDecorAssets(t).catch(()=>{}),this._adoptInitialSpace(this._model,!0),this._resumePendingNavMode(),this._cacheSnapshot(),this._space!==i&&this._restoreZoom(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch(e){this._showToast(this._t("toast.cfg_reload_failed",{err:this._errText(e)}))}finally{this._continuityDataReady=!0,this.requestUpdate()}}_scheduleLoadRetry(e=!1){if(void 0!==this._loadRetryTimer)return;const t=Math.min(8e3,500*2**Math.min(4,Math.max(1,this._loadTries-7)));this._loadRetryTimer=window.setTimeout(()=>{this._loadRetryTimer=void 0,!e&&this._loadOk||this._loading||!this.hass||this._loadFromServer()},t)}_ensureHaRegistryAuthority(){const e=this.hass?.connection||null;e&&e!==this._haRegistryConnection&&(this._haRegistryRelease?.(),this._haRegistryConnection=e,this._haRegistryRev=-1,this._haBindingCacheKey="",this._areaSnapshotCleanupCandidates.clear(),this._planHassMemo=null,this._haRegistryRelease=sh(this.hass,this._onHaRegistryUpdate),this._onHaRegistryUpdate())}get _haRegistry(){return lh(this.hass)}get _planHass(){const e=this._haRegistry,t=hh(this.hass,e),i=this._planHassMemo;if(i&&i.hass===this.hass&&i.sig===t)return i.active;const n=uh(this.hass,e),r=ph(this.hass,e);return this._planHassMemo={hass:this.hass,sig:t,active:n,full:r},n}_captureRenderDeviceSnapshot(){if(!this.hass)return;const e=Date.now(),t=[...this._activityRt.entries()].map(([t,i])=>`${t}:${i.gen}:${i.flashTs}:`+(i.flashKind&&(i.expiresAt||i.flashTs+n_)>e?1:0)).join("|"),i=Vc(this._virtualLights);if(this._capturedSnapshotSequence===this._hassSequence&&this._capturedSnapshotDevices===this._devices&&this._capturedSnapshotLayout===this._layout&&this._capturedSnapshotConfigEpoch===this._cfgEpoch&&this._capturedSnapshotVirtual===i&&this._capturedSnapshotActivity===t)return;const n=this._planHass,r=new Map,o=new Map,s=new Set(["sun.sun"]);this._vacFit?.source&&s.add(this._vacFit.source);const a=new Set,l=new Set,c=e=>{if(!e)return;const t=e.indexOf(":");if(t<0)return void s.add(e);const i=e.slice(0,t),n=e.slice(t+1);"device"===i?a.add(n):"entity"===i&&s.add(n)};for(const e of this._model)for(const t of e.rooms)t.area&&l.add(t.area),c(t.settings?.temp_source),c(t.settings?.hum_source);for(const e of this._serverCfg?.spaces||[])for(const t of e.openings||[])for(const e of Kt(t))s.add(e);for(const e of this._serverCfg?.spaces||[])for(const t of e.decor||[])if("text"===t.kind){for(const e of String(t.text||"").matchAll(/\{([^{}\r\n]+)\}/g)){const t=Di(e[1]);t?.entity&&s.add(t.entity)}t.entity&&s.add(t.entity),o.set(`decor:${e.id}:${t.id}`,Fi(t.text,t,n,e=>!!n.entities?.[e]&&!!n.states?.[e]&&!id(n,e,td(this._markers))))}const h=Bh(n,this._devices,null,this._virtualLights);for(const e of this._devices){for(const t of[!1,!0])r.set(lp(e.id,t),rp(n,e,{liveStates:!1!==this._config?.live_states,showTemperature:!1!==this._config?.show_temperature,showSignal:t,activityRuntime:this._activityRt.get(e.id),sourceDetails:!1,lightDevices:this._devices,lightSources:h,registryHass:this._fullRegistryHass,reducedMotion:this._reducedMotion}));if(this._isVacDev(e)){const t=this._vacSource(e,n),i=t?nc(n?.states?.[t]?.attributes):null,r=this._vacRt.get(e.id);o.set(`vacuum:${e.id}`,{source:t,telemetry:i,mapId:i?this._vacMapId(e,i,n):null,runtime:r?{trail:r.trail,lastTs:r.lastTs,moving:r.moving,jump:r.jump}:null,server:this._vacSrvTrails[e.id]||null})}}const d=ap({sourceSequence:this._hassSequence,hass:n,devices:this._devices,presentations:r,positions:(u=this._model.length>0,p=this._devices,m=e=>this._livePos(e),u?new Map(p.map(e=>[e.id,m(e)])):new Map),facts:o,entityIds:s,deviceIds:a,areaIds:l});var u,p,m;this._capturedSnapshotSequence=this._hassSequence,this._capturedSnapshotDevices=this._devices,this._capturedSnapshotLayout=this._layout,this._capturedSnapshotActivity=t,this._capturedSnapshotConfigEpoch=this._cfgEpoch,this._capturedSnapshotVirtual=i,this._visibleDeviceSnapshot&&"steady"!==this._continuity.state?this._candidateDeviceSnapshot=d:(this._visibleDeviceSnapshot=d,this._candidateDeviceSnapshot=null)}get _renderDeviceSnapshot(){return this._stagedDeviceSnapshotToken===this._continuity.token?this._candidateDeviceSnapshot||this._visibleDeviceSnapshot:this._visibleDeviceSnapshot||this._candidateDeviceSnapshot}get _renderPlanHass(){return this._renderDeviceSnapshot?.hass||this._planHass}get _renderDevices(){return this._renderDeviceSnapshot?.devices||this._devices}get _fullRegistryHass(){return this._planHass,this._planHassMemo?.full||this.hass}_bindingStatus(e){return fh(this.hass,e,this._haRegistry)}houseplanDiagnostics(){const e=function(e){const t=lh(e);return{access:t.access,authoritative:t.authoritative,revision:t.revision,lastSuccess:t.lastSuccess,error:t.error}}(this.hass),t={active:0,ha_disabled:0,orphaned:0,unverified:0};for(const e of this._markers)e.removed||"virtual"===e.binding||t[this._bindingStatus(e.binding).kind]++;return{registry:{...e,lastSuccessAgeMs:e.lastSuccess?Math.max(0,Date.now()-e.lastSuccess):null},bindings:t}}_openBindingInHa(e){const[t,i]=e.split(":");if(i)if("device"!==t){if("entity"===t){const e=this._fullRegistryHass.entities?.[i];e?.device_id&&og("/config/devices/device/"+encodeURIComponent(e.device_id))}}else og("/config/devices/device/"+encodeURIComponent(i))}_bindingHasHaPage(e){const[t,i]=e.split(":");return!!i&&("device"===t||"entity"===t&&!!this._fullRegistryHass.entities?.[i]?.device_id)}_toggleMarkerDialogVisibility(){const e=this._markerDialog;if(!e)return;const t="ha"===e.bindingMode?this._bindingStatus(e.binding):null,i=e.hideFromPlan||"ha_disabled"===t?.kind;i&&"ha_disabled"===t?.kind?this._showToast(this._t("entity"===t.reason?"toast.ha_disabled_show_entity":"toast.ha_disabled_show_device")):i&&"unverified"===t?.kind?this._showToast(this._t("toast.ha_binding_unverified")):this._markerDialog={...e,hideFromPlan:!i}}_hookConnection(){const e=this.hass?.connection;e&&e!==this._connHooked&&(this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),e.addEventListener?.("ready",this._onConnReady),e.addEventListener?.("disconnected",this._onConnLost),e.addEventListener?.("reconnect-error",this._onConnLost),this._connHooked=e)}_display(e){return this._signer.display(this.hass,e)}_referencedContentUrls(){const e=gn(this._serverCfg);for(const t of this._decorAssets.values())e.add(t.url);return e}_resign(){this._signer.resign(this.hass,this._referencedContentUrls())}_onLayoutEvent(e){e<=this._layoutRev||(clearTimeout(this._layoutSyncTimer),this._layoutSyncTimer=window.setTimeout(()=>{e<=this._layoutRev||this._reloadLayoutOnly()},200))}_noteLayoutRev(e){const t=e?.rev;"number"==typeof t&&t>this._layoutRev&&(this._layoutRev=t)}async _reloadLayoutOnly(){if(!this._serverStorage||!this.hass?.callWS)return;this._beginContinuityCandidate("layout-reload",!1);const e=new Map;for(const t of this._dirtyPos)this._layout[t]&&e.set(t,this._layout[t]);this._persistLayout.pending()&&this._persistLayout.flush();for(const[t,i]of this._sentPos)e.set(t,i);try{const t=await this.hass.callWS({type:"houseplan/layout/get"}),i={...t?.layout||{}};for(const[t,n]of e)null===n?delete i[t]:i[t]=n;const n=Ll(i);n!==Ll(this._layout)&&(this._cancelDeviceDrag(),this._devicePositionHistory.clear(),this._layout=i),this._layoutContentFingerprint=n,this._layoutRev=t?.rev??this._layoutRev,this._canOptimizeUndo=!!t?.can_optimize_undo,this._haIntegrationVersion="string"==typeof t?.integration_version?t.integration_version:this._haIntegrationVersion,this._undoKind=t?.undo_kind||null,this._cacheSnapshot(),this.requestUpdate()}catch{}finally{this._continuityDataReady=!0,this.requestUpdate()}}_persistLocalLayout(){this._layout=eo(Nr(this._layout)),localStorage.setItem(Kf,JSON.stringify(this._layout))}_maybeRebuildDevices(){const e=this.hass;if(!e?.devices||!e?.entities||!e?.areas)return;const t=this._haRegistry,i=hh(e,t)+":"+Object.keys(e.areas).length+":"+(this._norm?"n":"l")+":"+fu(e,this._config?.language);if(i===this._regSignature&&this._devices.length)return;this._regSignature=i;const n=new Map(this._devices.map(e=>[e.id,e.bindingStatus?.kind||"active"]));this._devices=sd({hass:e,registry:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([e,t])=>[e,t.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||"",loc:e=>this._t(e),iconRules:this._iconRules});const r=this._markers.filter(e=>!e.removed&&"virtual"!==e.binding).map(e=>e.binding).sort(),o=t.revision+":"+r.join("|");if(t.authoritative&&o!==this._haBindingCacheKey){const i=new Map;for(const n of r)i.set(n,fh(e,n,t));!function(e){if("undefined"==typeof localStorage||!e.size)return;const t=_h(),i=Date.now();for(const[n,r]of e)"active"===r.kind?t[n]={kind:"active",ts:i}:"ha_disabled"===r.kind&&(t[n]={kind:"ha_disabled",reason:r.reason,ts:i});const n=Object.fromEntries(Object.entries(t).sort((e,t)=>t[1].ts-e[1].ts).slice(0,1500));eh=n;try{localStorage.setItem(Qc,JSON.stringify(n))}catch{}}(i),this._haBindingCacheKey=o}let s=null;if(t.authoritative&&(s=this._resolveAreaRelocations(t),this._areaRelocationIds=new Set(s.relocateIds),this._areaRelocationIds.size)){this._cancelDeviceDrag();const e=this._areaRelocationIds;this._devicePositionHistory.removeWhere(({before:t,after:i})=>e.has(t.deviceId)||e.has(i.deviceId));const t=this._markerDialog;if(t?.devId&&!t.roomTouched&&this._areaRelocationIds.has(t.devId)){const e=this._devices.find(e=>e.id===t.devId);e&&(this._markerDialog={...t,room:e.marker?.room_id?`${e.space}#@${e.marker.room_id}`:e.space&&e.area?`${e.space}#${e.area}`:""})}}this._defPos=this._defaultPositions(),this._syncNewDevices(),this._seedHiddenDevices(),s&&this._syncAreaRelocations(s),this._syncActivityRuntime();const a=new Set(this._devices.filter(e=>!e.hidden).map(e=>e.id));for(const e of this._vacRt.keys())a.has(e)||this._vacRt.delete(e);if(this._infoCard){const e=this._devices.find(e=>e.id===this._infoCard.id);this._infoCard=e&&"ha_disabled"!==e.bindingStatus?.kind?e:null}const l=this._devices.some(e=>"ha_disabled"===e.bindingStatus?.kind&&"ha_disabled"!==n.get(e.id));l&&("ha_disabled"!==this._infoCard?.bindingStatus?.kind&&"ha_disabled"!==this._devices.find(e=>e.id===this._infoCard?.id)?.bindingStatus?.kind||this._closeInfoCard(),this._deviceDrag&&"ha_disabled"===this._devices.find(e=>e.id===this._deviceDrag.id)?.bindingStatus?.kind&&(this._cancelDeviceDrag(),this._devicePositionHistory.clear()),clearTimeout(this._holdTimer),this._holdFired=!1,this._tip=null,this._tapConfirm=null),this._nativeMoreInfoEntity&&!this._planEntityAvailable(this._nativeMoreInfoEntity)&&(rg(this,"hass-more-info",{entityId:null}),this._nativeMoreInfoEntity=null)}_resolveAreaRelocations(e=this._haRegistry){const t=function(e){const t=qp(e.snapshot),i=new Set(Object.values(t).map(e=>e.binding)),n=new Map;for(const[t,r]of e.previousCandidates||[])Bp(t)&&Number.isFinite(r)&&i.has(t)&&n.set(t,r);const r=new Set,o=new Set;for(const t of e.markers||[])t.removed||(Lp(t.id)&&r.add(t.id),Bp(t.binding)&&o.add(t.binding));const s=new Set(Object.keys(e.registryDevices||{})),a=new Set(Object.keys(e.registryEntities||{})),l=new Set(Object.keys(e.liveStates||{})),c=new Map;for(const[e,i]of Object.entries(t)){const t=c.get(i.binding)||[];t.push(e),c.set(i.binding,t)}const h=new Set;let d=!1;for(const[t,i]of c){const[c,u]=Gp(t);if(o.has(t)||i.some(e=>r.has(e))||("device"===c?s.has(u):a.has(u)||l.has(u))){n.delete(t);continue}const p="device"===c?s.size>0:a.size>0;if(!e.authoritative||!p)continue;const m=n.get(t);if(void 0!==m){if(m!==e.revision)for(const e of i)h.add(e)}else n.set(t,e.revision),d=!0}return{removeIds:h,candidates:n,needsConfirmationRefresh:d}}({snapshot:this._settings.marker_area_snapshot,authoritative:e.authoritative,revision:e.revision,registryDevices:e.devices,registryEntities:e.entities,liveStates:this.hass?.states,markers:this._markers,previousCandidates:this._areaSnapshotCleanupCandidates});return this._areaSnapshotCleanupCandidates=t.candidates,t.needsConfirmationRefresh&&this._canEdit&&ah(this.hass),Kp({devices:this._devices,model:this._model,layout:this._layout,snapshot:this._settings.marker_area_snapshot,authoritative:e.authoritative,cleanupSnapshotIds:t.removeIds,coordinateScale:tg})}_syncNewDevices(){if(!this._norm||!this._loadOk||!this._serverCfg)return;const e=this._devices.filter(e=>!e.marker&&!e.virtual).map(e=>e.id).sort(),t=e.join(",");if(t===this._newSyncKey)return;this._newSyncKey=t;const i=this._settings,{fresh:n,known:r}=function(e,t){if(!Array.isArray(t))return{fresh:[],known:[...e]};const i=new Set(t),n=e.filter(e=>!i.has(e));return{fresh:n,known:n.length?[...t,...n]:t}}(e,i.known_devices);if(!Array.isArray(i.known_devices)||n.length){const e=[...new Set([...i.new_device_ids||[],...n])];this._serverCfg={...this._serverCfg,settings:{...i,known_devices:r,new_device_ids:e}},this._saveConfig()}}_syncAreaRelocations(e){if(!(this._serverCfg&&this._norm&&this._canEdit&&this._haRegistry.authoritative))return;const t=e.decisions.filter(e=>e.updateSnapshot||e.removeSnapshot);if(!t.length)return;const i=Ll({snapshot:qp(this._settings.marker_area_snapshot),decisions:t});i!==this._areaRelocationSyncKey&&(this._areaRelocationSyncKey=i,this._areaRelocationWrite=this._areaRelocationWrite.catch(()=>{}).then(async()=>{if(!this._serverCfg||!this._haRegistry.authoritative)return;const e=this._resolveAreaRelocations();this._areaRelocationIds=new Set(e.relocateIds);const t=new Set,i=new Map;let n=!1;for(const r of e.decisions){if(!r.relocate)continue;const e=k_(this._layout,r.id);try{await this._persistDevicePlacement(r.id,null),t.add(r.id),e&&i.set(r.id,e),this._areaRelocationIds.delete(r.id)}catch(t){n=!0,this._layout=x_(this._layout,r.id,e),this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)}))}}const r=this._settings,o=function(e,t,i=new Set){const n=qp(e);for(const e of t.decisions)e.removeSnapshot?delete n[e.id]:e.updateSnapshot&&e.binding&&e.area&&(e.relocate&&!i.has(e.id)||(n[e.id]={binding:e.binding,area:e.area}));return n}(r.marker_area_snapshot,e,t),s=[...new Set([...Array.isArray(r.new_device_ids)?r.new_device_ids:[],...t])],a=Ll(o)!==Ll(qp(r.marker_area_snapshot)),l=Ll(s)!==Ll(Array.isArray(r.new_device_ids)?r.new_device_ids:[]);if(a||l){const e=r.marker_area_snapshot,n=r.new_device_ids,a={...this._serverCfg,settings:{...r,marker_area_snapshot:o,...l?{new_device_ids:s}:{}}};this._setAreaLifecycleConfig(a);try{this._saveConfigDebounced.pending()&&this._saveConfigDebounced.cancel(),await this._writeConfig()}catch(r){const a=this._settings;if(Ll(a.marker_area_snapshot)===Ll(o)&&Ll(a.new_device_ids)===Ll(l?s:n)){const t={...a};void 0===e?delete t.marker_area_snapshot:t.marker_area_snapshot=e,void 0===n?delete t.new_device_ids:t.new_device_ids=n;const i={...this._serverCfg,settings:t};this._setAreaLifecycleConfig(i),this._cfgContentFingerprint=Ll(this._serverCfg)}for(const e of t)this._areaRelocationIds.add(e);const c=new Set;for(const[e,t]of i)try{await this._persistDevicePlacement(e,t)}catch(t){c.add(e),this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)}))}this._areaRelocationSyncKey="",this._regSignature="";if("conflict"===(r&&"object"==typeof r&&"code"in r?r.code:void 0)?(this._showToast(this._t("toast.conflict")),await this._reloadConfigOnly(!0)):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(r)})),c.size&&this._serverCfg){const e=this._settings,t=[...new Set([...Array.isArray(e.new_device_ids)?e.new_device_ids:[],...c])],i={...this._serverCfg,settings:{...e,new_device_ids:t}};this._setAreaLifecycleConfig(i);try{await this._writeConfig()}catch(e){this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(e)}))}}}}n&&(this._areaRelocationSyncKey=""),this.requestUpdate()}))}get _newIds(){const e=this._settings.new_device_ids;return new Set([...Array.isArray(e)?e:[],...this._areaRelocationIds])}_ackNewDevice(e){if(!this._newIds.has(e)||!this._serverCfg)return;const t=this._settings;this._serverCfg={...this._serverCfg,settings:{...t,new_device_ids:(t.new_device_ids||[]).filter(t=>t!==e)}},this._saveConfig(),this.requestUpdate()}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(e){if(!e)return null;const t=[];for(const i of this._renderDevices){if(i.area!==e||i.virtual)continue;const n=jh(this._renderPlanHass,i.entities);null!=n&&t.push(n)}return gi(t)}_roomBounds(e){if(e.poly&&e.poly.length){const t=e.poly.map(e=>e[0]),i=e.poly.map(e=>e[1]),n=Math.min(...t),r=Math.min(...i);return{x:n,y:r,w:Math.max(...t)-n,h:Math.max(...i)-r}}return{x:e.x??0,y:e.y??0,w:e.w??0,h:e.h??0}}_defaultPositions(){const e={},t=this._config?.icon_size??2.5;for(const i of this._model){const n=t/100*tl(i)*1.3;for(const t of i.rooms){if(!t.area)continue;const r=this._devices.filter(e=>e.area===t.area&&e.space===i.id);if(!r.length)continue;const o=this._roomBounds(t),s=.1*Math.min(o.w,o.h),a=o.w-2*s,l=o.h-2*s,c=Math.max(1,Math.round(Math.sqrt(r.length*a/Math.max(l,1)))),h=Math.ceil(r.length/c),d=a/c,u=l/Math.max(h,1),p=r.map((e,t)=>({x:o.x+s+d*(t%c+.5),y:o.y+s+u*(Math.floor(t/c)+.5)}));yi(p,o,n,.5*s),r.forEach((t,i)=>e[t.id]=Ia(p[i]))}}return e}_pos(e){const t=this._renderDeviceSnapshot?.positions.get(e.id);return t?{x:t.x,y:t.y}:this._livePos(e)}_livePos(e){const t=this._spaceModelById(e.space),i=this._areaRelocationIds.has(e.id)?void 0:this._layout[e.id];if(i)if(this._norm){if(i.s===e.space)return{x:i.x*tg,y:i.y*tg}}else if(void 0===i.s)return{x:i.x,y:i.y};return this._defPos[e.id]?this._defPos[e.id]:t?Ia(el(t)):{x:500,y:500}}_devicePlacementForCanvas(e,t,i){if(!this._norm)return{x:Math.round(t),y:Math.round(i)};const n=this._gridPitch,r=Math.round(t/n)*n,o=Math.round(i/n)*n;return{s:e.space,x:Ha(r/tg),y:Ha(o/tg)}}_previewDevicePlacement(e,t){this._layout=x_(this._layout,e,t),this.requestUpdate()}_cancelDeviceDrag(){const e=this._deviceDrag;if(!e)return!1;this._deviceDrag=null;try{e.source?.hasPointerCapture?.(e.pointerId)&&e.source.releasePointerCapture(e.pointerId)}catch{}return this._previewDevicePlacement(e.id,e.before),!0}async _persistDevicePlacement(e,t){if(this._layout=x_(this._layout,e,t),this._serverStorage){let i=null,n=!1;try{let r;if(null===t)i=null,this._sentPos.set(e,i),n=!0,r=await this.hass.callWS({type:"houseplan/layout/delete",device_id:e});else{const t=Qr(this._layout[e]);Ll(t)!==Ll(this._layout[e])&&(this._layout={...this._layout,[e]:t}),i=t,this._sentPos.set(e,i),n=!0,r=await this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t})}this._noteLayoutRev(r),this._layoutContentFingerprint=Ll(this._layout),this._cacheSnapshot()}finally{n&&this._sentPos.get(e)===i&&this._sentPos.delete(e)}return}this._persistLocalLayout()}_devicePositionStateValid(e){const t=this._devices.find(t=>t.id===e.deviceId);return!!t&&t.space===e.spaceId&&"ha_disabled"!==t.bindingStatus?.kind&&!!this._spaceModelById(e.spaceId)}async _runDevicePositionHistory(e){if(this._cancelDeviceDrag()||this._devicePositionBusy)return;const t="undo"===e?this._devicePositionHistory.undo():this._devicePositionHistory.redo();if(!t)return;const i="undo"===e?t.before:t.after;if(!this._devicePositionStateValid(i))return this._devicePositionHistory.clear(),this._showToast(this._t("history.device_stale")),void this.requestUpdate();const n=k_(this._layout,i.deviceId);i.spaceId!==this._space&&(this._commitSpace(i.spaceId),this._restoreZoom()),this._devicePositionBusy=!0,this._previewDevicePlacement(i.deviceId,i.placement);try{await this._persistDevicePlacement(i.deviceId,i.placement),this._showToast(this._t("undo"===e?"history.undone":"history.redone",{name:t.name}))}catch(t){this._previewDevicePlacement(i.deviceId,n),"undo"===e?this._devicePositionHistory.redo():this._devicePositionHistory.undo(),this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)}))}finally{this._devicePositionBusy=!1,this.requestUpdate()}}_undoDevicePosition(){this._runDevicePositionHistory("undo")}_redoDevicePosition(){this._runDevicePositionHistory("redo")}_savePos(e,t,i){this._spaceModelById(e.space)&&(this._layout=x_(this._layout,e.id,this._devicePlacementForCanvas(e,t,i)),this._dirtyPos.add(e.id),this._persistLayout())}_devicePresentation(e,t=!1!==this._config?.show_signal,i=!1){const n=i?null:this._renderDeviceSnapshot?.presentations.get(lp(e.id,t));return n||rp(this._renderPlanHass,e,{liveStates:!1!==this._config?.live_states,showTemperature:!1!==this._config?.show_temperature,showSignal:t,designPreview:i,activityRuntime:this._activityRt.get(e.id),sourceDetails:!1,lightDevices:this._renderDevices,registryHass:this._fullRegistryHass,reducedMotion:this._reducedMotion})}_deviceVisual(e){return this._devicePresentation(e).visual}_stateClass(e,t=this._deviceVisual(e)){const i=this._devicePresentation(e);return i.effectiveHidden?"":("icon_ripple"!==i.display||!1===this._config?.live_states||"alarm"===t.status||t.activity,np({...i,visual:t}).join(" "))}_liveTemp(e){if(!this._config?.show_temperature)return null;if(!0===e.marker?.use_climate_temp){const t=Vh(this._renderPlanHass,e.entities);if(null!=t)return t}return"mdi:thermometer"!==e.icon&&"mdi:air-filter"!==e.icon?null:Uh(this._renderPlanHass,e.entities)}_bindingEntities(e){if("virtual"===e||!e)return[];const t=this._bindingStatus(e);return"active"===t.kind?t.enabledEntityIds:t.allEntityIds}_bindingHasClimate(e){return this._bindingEntities(e).some(e=>e.startsWith("climate."))}_bindingHasAlarm(e){return this._bindingEntities(e).some(e=>{const t=this._planHass?.states?.[e]||this.hass?.states?.[e],i=this._fullRegistryHass.entities[e]||this.hass?.entities?.[e];return Tn(e.split(".")[0],t?.attributes?.device_class||i?.device_class||i?.original_device_class)})}_deviceBindingActive(e,t=!0){if(e.virtual||"virtual"===e.bindingKind)return!0;if(!e.bindingKind||!e.bindingRef)return!1;const i=this._bindingStatus(`${e.bindingKind}:${e.bindingRef}`);return"active"===i.kind||(t&&this._showToast(this._t("ha_disabled"===i.kind?"toast.ha_disabled_action":"toast.ha_binding_unverified")),!1)}_openMoreInfo(e){e?this._planEntityAvailable(e)?(this._nativeMoreInfoEntity=e,rg(this,"hass-more-info",{entityId:e})):this._showToast(this._t("toast.ha_disabled_action")):this._showToast(this._t("toast.no_entity"))}_interruptViewGesture(e,t){if(clearTimeout(this._holdTimer),clearTimeout(this._kioskHoldTimer),void 0!==e)for(const i of[t,this._stageEl])try{i?.hasPointerCapture?.(e)&&i.releasePointerCapture(e)}catch{}this._pointers.clear(),this._panStart=null,this._panLock=null,this._pinchStart=null,this._swipeStart=null}_closeInfoCard(){this._interruptViewGesture(),this._holdFired=!1,this._infoCard=null}_ctxDevice(e,t){"view"===this._mode&&(e.preventDefault(),e.stopPropagation(),this._deviceBindingActive(t)&&(t.primary?this._openMoreInfo(t.primary):this._infoCard=t))}_clickDevice(e,t){if("view"!==this._mode&&"devices"!==this._mode)return;if(e.stopPropagation(),this._deviceDrag?.moved||this._suppressClick||this._holdFired)return;if("devices"===this._mode)return void this._openMarkerDialog(t);const i=this._devices.find(e=>e.id===t.id);if(!i)return;const n=Pd(i.tapAction,i.primary?.split(".")[0]);if("none"===n)return;const r=(e,t)=>{i.marker?.tap_confirm?this._tapConfirm={kind:"run",text:e,exec:t}:t()};if("toggle"===n){const e=this._toggleIntent(i);if(!e)return;if(!Nd(e))return void this._showUnavailableToggleTargets(e);const t=e=>{const t=Nd(e);if(!t)return;if("virtual-light"===t.kind)return this._startDevicePressFeedback(i.id),void this.hass.callWS({type:"houseplan/virtual_light/toggle",marker_id:t.markerId}).then(e=>{const t=Yc(this._virtualLights,e);t!==this._virtualLights&&(this._virtualLights=t,this._capturedSnapshotVirtual="",this._cacheSnapshot(),this.requestUpdate())}).catch(e=>this._showToast(this._t("toast.virtual_light_toggle_failed",{err:this._errText(e)})));const{command:n}=t;this._startDevicePressFeedback(i.id),this.hass.callService(n.domain,n.service,n.data).catch(e=>this._showToast(this._t("toast.error",{err:this._errText(e)})))},n=((o=e).targets.length?o.targets:o.skippedTargets).map(e=>e.name||e.entityId||e.ref).join(", ")||i.name;if(i.marker?.tap_confirm){const r=this._toggleConfirmationLines(e);if(!r.length)return;this._tapConfirm={kind:"toggle",text:this._t("confirm.tap_toggle",{name:n}),lines:r,initialIntent:e,deviceId:i.id,exec:()=>{const n=this._devices.find(e=>e.id===i.id),r=n?this._toggleIntent(n):null;r&&!Nd(r)&&this._showUnavailableToggleTargets(r)||(r&&Bd(e,r)?t(r):this._showToast(this._t("toast.tap_target_changed")))}}}else t(e);return}var o;if("info"===n)return this._interruptViewGesture(),void(this._infoCard=i);if(this._deviceBindingActive(i)){if("run"===n){const e=i.marker?.tap_target||"",t=function(e){const t=String(e||"").split(".")[0];return"automation"===t?{domain:"automation",service:"trigger"}:"script"===t?{domain:"script",service:"turn_on"}:"scene"===t?{domain:"scene",service:"turn_on"}:null}(e),n=this.hass.states[e];if(!t||!n)return void this._showToast(this._t("toast.run_target_missing"));const o=n.attributes?.friendly_name||e;return void r(this._t("confirm.tap_run",{name:o}),()=>{this._deviceBindingActive(i)&&this._planEntityAvailable(e)&&(this._startDevicePressFeedback(i.id),this.hass.callService(t.domain,t.service,{entity_id:e}).then(()=>{this._stampActivity(i.id,"event",this._activitySourceKey(i)),this.requestUpdate(),this._showToast(this._t("toast.run_started",{name:o}))}).catch(e=>this._showToast(this._t("toast.error",{err:this._errText(e)}))))})}"more-info"===n&&i.primary?this._openMoreInfo(i.primary):this._infoCard=i}}_showUnavailableToggleTargets(e){const t=function(e){if(!e||"group"!==e.kind||Nd(e)||"configured-targets-missing"!==e.noneReason)return[];if(!e.skippedTargets.length||e.skippedTargets.some(e=>!Ld.has(e.reason)&&"secure"!==e.reason))return[];const t=[],i=new Set;for(const n of e.skippedTargets){if(!Ld.has(n.reason))continue;const e=String(n.name||n.entityId||n.ref||"").trim();e&&!i.has(e)&&(i.add(e),t.push(e))}return t}(e);return!!t.length&&(this._showToast(1===t.length?this._t("toast.toggle_target_unavailable",{name:t[0]}):this._t("toast.toggle_targets_unavailable",{names:t.join(", ")})),!0)}_keyDevice(e,t){"Enter"!==e.key&&" "!==e.key||"view"!==this._mode&&"devices"!==this._mode||(e.preventDefault(),this._clickDevice(e,t))}_startDevicePressFeedback(e){const t=[...this.renderRoot.querySelectorAll(".dev[data-id]")].find(t=>t.dataset.id===e),i=t?.querySelector(".device-shell");if(!i||"function"!=typeof i.animate)return;const n=Number.parseFloat(this.ownerDocument.defaultView?.getComputedStyle(i).scale||""),r=Number.isFinite(n)?Math.max(.95,Math.min(1,n)):1;this._devicePressAnimations.get(e)?.cancel();const o=this._reducedMotion?[{outlineColor:"transparent",outlineStyle:"solid",outlineWidth:"0px"},{outlineColor:"var(--hp-accent, #3ea6ff)",outlineStyle:"solid",outlineWidth:"2px",outlineOffset:"2px",offset:.5},{outlineColor:"transparent",outlineStyle:"solid",outlineWidth:"0px"}]:[{scale:String(r)},{scale:"0.95",offset:.5},{scale:"1"}],s=i.animate(o,{duration:200,easing:"cubic-bezier(.22,.61,.36,1)"});this._devicePressAnimations.set(e,s);const a=()=>{this._devicePressAnimations.get(e)===s&&this._devicePressAnimations.delete(e)};s.addEventListener("finish",a,{once:!0}),s.addEventListener("cancel",a,{once:!0})}_cancelDevicePressFeedback(){for(const e of this._devicePressAnimations.values())e.cancel();this._devicePressAnimations.clear()}_pruneDevicePressFeedback(){if(!this._devicePressAnimations.size)return;const e=new Set([...this.renderRoot.querySelectorAll(".dev[data-id]")].map(e=>e.dataset.id||""));for(const[t,i]of this._devicePressAnimations)e.has(t)||(i.cancel(),this._devicePressAnimations.delete(t))}_t(e,t){return gu(fu(this.hass,this._config?.language),e,t)}get _colorPickerLabels(){return{title:this._t("color_picker.title"),hue:this._t("color_picker.hue"),saturation:this._t("color_picker.saturation"),value:this._t("color_picker.value"),hex:this._t("color_picker.hex"),invalidHex:this._t("color_picker.invalid_hex")}}_help(e){return this._editorRuntimeOrThrow()._help(e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_contentItems(e){const t=[];for(const i of this._devices){if(i.space!==e.id||i.hidden)continue;const n=this._pos(i);t.push({minX:n.x,minY:n.y,maxX:n.x,maxY:n.y})}if(e.id===this._space){for(const e of this._openingsR){const i=Number(e.angle)*Math.PI/180,n=Math.cos(i)*e.rlen/2,r=Math.sin(i)*e.rlen/2,o=qa([[e.rx-n,e.ry-r],[e.rx+n,e.ry+r]]);o&&t.push(o)}const i=this._decorH;for(const e of this._decorList){if("image"===e.kind&&!this._decorAssets.has(e.asset_id)&&"decor"!==this._mode)continue;const n=qa("line"===e.kind?[[e.x1*tg,e.y1*i],[e.x2*tg,e.y2*i]]:"text"===e.kind?[[e.x*tg,e.y*i]]:mr({x:e.x*tg,y:e.y*i,w:e.w*tg,h:e.h*i,angle:e.angle}));n&&t.push(n)}for(const i of this._physicalBodiesR(e)){const e=qa(i);e&&t.push(e)}}return Ga(e,t)}_frameOf(){const e=this._spaceModel();if(!e){this._frame=null;const e={x:0,y:0,w:tg,h:tg};return{rect:e,all:e,outliers:0}}const t=this._frame,i="view"!==this._mode;if(t&&t.id===e.id&&this._bdDrag)return t;if(t&&t.id===e.id&&t.model===e&&t.layout===this._layout&&t.devs===this._devices&&t.far===this._showFar&&t.grow===i)return t;const n=Za(this._contentItems(e));let r=n.all||Qa(e),o=this._showFar?r:n.core||Qa(e);return t&&t.id===e.id&&i&&t.grow&&(o=ig(t.rect,o),r=ig(t.all,r)),this._frame={id:e.id,model:e,layout:this._layout,devs:this._devices,far:this._showFar,grow:i,rect:o,all:r,outliers:n.outliers},this._frame}_isoSource(){const e=this._spaceModel();if(!e)return null;const t=this._spaceWalls,i=this._openCuts(),n=this._openingsR.map((e,t)=>({id:String(e.id||t),sourceIndex:t,type:e.type,x:e.rx,y:e.ry,angle:Number(e.angle)||0,length:e.rlen>0?e.rlen:900,flipH:!!e.flip_h,flipV:!!e.flip_v})),r=ya(64,this._cellCm),o=ya(10,this._cellCm),s=`${e.id}|${function(e){let t=2166136261;const i=e=>{if("number"!=typeof e)if("string"!=typeof e)if("boolean"!=typeof e)if(Array.isArray(e)){t=kf(t,e.length);for(const t of e)i(t)}else{if(e&&"object"==typeof e){const t=e;for(const e of Object.keys(t).sort())i(e),i(t[e]);return}t=kf(t,-1)}else t=kf(t,e?1:0);else for(const i of e)t=kf(t,i.codePointAt(0)||0);else t=kf(t,e)};return i(e),t.toString(36)}({rooms:e.rooms,walls:t,openCuts:i,openings:n,partitions:e.partitions,roomDrafts:e.room_drafts,columns:e.wall_columns,cellCm:this._cellCm,gridPitch:this._gridPitch,wallKeyPitch:this._wallKeyPitch,camera:hf,wallHeight:r,floorEdgeHeight:o,algorithm:3})}`;return{key:s,build:()=>{const o=oa(e,this._cellCm,this._gridPitch,2e-4*this._gridPitch,this._partitionOpeningCuts(e)).all,s=this._roomWallOpeningInputs(this._openingsR,e),a=t.length||o.length?Ps(e.rooms,t,i,s,this._wallKeyPitch,this._cellCm,this._gridPitch,tg,o):null;if(a&&("failed-core"===a.status||"not-applicable"===a.status))throw new Error("wall boolean geometry failed");const l=a?.paperGeom??Rs(e.rooms,t,i,this._wallKeyPitch,this._cellCm,this._gridPitch,tg);if(!l)throw new Error("floor boolean geometry failed");const c=a?.openingIndex||Hs(e.rooms,t,i,this._wallKeyPitch,this._cellCm,this._gridPitch,tg),h=n.map(e=>{const i=this._openingsR[e.sourceIndex],n="gate"===e.type?!e.flipV:e.flipV,o=i?.partitionHost?Xd(i.partitionHost,n):t.length||"gate"===e.type?qs(c,{x:e.x,y:e.y,angle:e.angle,length:e.length,flip_v:n}):{ox:0,oy:0,cm:0,side:-1};return function(e,t=64){if(!(xf([e.x,e.y,e.angle,e.length,e.face.ox,e.face.oy,t])&&e.length>0&&t>0))throw new Error("invalid isometric opening input");const i=e.length/2;let n;if("passage"===e.type)n=[];else if("gate"===e.type){const r=10*e.face.side;n=[Sf(e,0,[-i,0],[i,0],r,0,.88*t),Sf(e,1,[i,0],[-i,0],-r,0,.88*t)]}else n="window"===e.type?[Sf(e,0,[-i,0],[i,0],-90,.27*t,.78*t),Sf(e,1,[i,0],[-i,0],90,.27*t,.78*t)]:[Sf(e,0,[-i,0],[e.length,0],-90,0,.92*t)];return{id:e.id,sourceIndex:e.sourceIndex,type:e.type,leaves:Object.freeze(n.map(e=>Object.freeze(e)))}}({...e,face:o},r)});return{walls:a?.components.flatMap(e=>e.geom)||[],floor:l,openings:Object.freeze(h)}}}}_isoSceneKey(){if(!this._labsIso||"view"!==this._mode)return null;try{return this._isoSource()?.key??null}catch{return`${this._space}|invalid`}}_isoScene(){const e=this._isoSource();if(!e)return null;const t=this._isoGeometryCache.get(e.key);if(t)return{key:e.key,...t};const i=this._frameOf().rect,n=e.build(),r=ya(64,this._cellCm),o=ya(10,this._cellCm),s=function(e){let t=1/0,i=1/0,n=-1/0,r=-1/0;for(const o of e)for(const e of o.leaves){const o=Math.hypot(e.closedVector[0],e.closedVector[1]);t=Math.min(t,e.hinge[0]-o),i=Math.min(i,e.hinge[1]-o),n=Math.max(n,e.hinge[0]+o),r=Math.max(r,e.hinge[1]+o)}return xf([t,i,n,r])?{x:t,y:i,w:n-t,h:r-i}:null}(n.openings),a=_f({rect:s?ig(i,s):i,wallHeight:r,openingHeight:r,floorDepth:o}),l=function(e,t=hf,i=64){if(!Number.isFinite(i)||i<0)throw new Error("invalid wall height");const n=[],r=[],o=[];let s=0;for(let a=0;a<(e||[]).length;a++){const l=e[a];for(let e=0;e<(l||[]).length;e++){const c=vf(l[e],e>0);if(!(c.length<3||Math.abs(gf(c))<1e-9)){n.push(yf(c,t,i)),s+=c.length;for(let n=0;n<c.length;n++){const s=c[n],l=c[(n+1)%c.length],h=uf(s,0,t),d=uf(l,0,t);if(o.push(`M ${ff(h)} L ${ff(d)}`),bf(s,l,t)<=1e-9)continue;const u=uf(l,i,t),p=uf(s,i,t);r.push({d:`M ${ff(h)} L ${ff(d)} L ${ff(u)} L ${ff(p)} Z`,depth:Math.max(h[1],d[1]),polygon:a,ring:e,edge:n})}}}}return r.sort((e,t)=>e.depth-t.depth||e.polygon-t.polygon||e.ring-t.ring||e.edge-t.edge),{topPath:n.join(" "),sides:r,contactPath:o.join(" "),edgeCount:s}}(n.walls,hf,r),c={geometry:l,floor:wf(n.floor,o),openings:n.openings,frame:a};return Wf(this._isoGeometryCache,e.key,c,8),{key:e.key,...c}}_effectiveProjection(){if("iso"!==this._desiredProjection||!this._model.length)return"flat";const e=this._isoSceneKey()||`${this._space}|invalid`;if(this._isoFallback.has(e))return"flat";try{const e=this._isoScene();return e?(t="iso",i=e.key,n=this._isoFallback,"iso"===t&&i&&!n.has(i)?"iso":"flat"):"flat"}catch(t){if(!this._isoFallback.has(e)){this._isoFallback.add(e);const i=e.split("|");console.warn(`HOUSEPLAN ISO FALLBACK: #89, space ${this._space}, fingerprint ${i[i.length-1]}, ${t instanceof Error?t.message:"renderer error"}`)}return"flat"}var t,i,n}_scenePoint(e){return"iso"===this._renderProjection?uf(e,0):e}_floorView(e){if("iso"!==this._renderProjection)return e;const t=pf([e.x,e.y]),i=pf([e.x+e.w,e.y+e.h]);return{x:t[0],y:t[1],w:i[0]-t[0],h:i[1]-t[1]}}_baseVb(){if("iso"===this._effectiveProjection()){if(!this._spaceDisplayForRender().showBorders){const e=_f({rect:this._frameOf().rect,wallHeight:ya(64,this._cellCm)});return[e.x,e.y,e.w,e.h]}const e=this._isoScene()?.frame??this._frameOf().rect;return[e.x,e.y,e.w,e.h]}const e=this._frameOf().rect;return[e.x,e.y,e.w,e.h]}get _outliers(){return this._showFar?0:this._frameOf().outliers}_fitFar(){this._showFar=!0,this._frame=null,this.requestUpdate(),this._resetZoom()}_fitAll(e="fit"){this._showFar=!0,this._frame=null,this.requestUpdate(),this._resetZoom(e)}_renderFarHint(){return this._kiosk||"view"!==this._mode||this._booting||!this._outliers?V:W`<div class="farhint">
      <ha-icon icon="mdi:map-marker-alert-outline"></ha-icon>
      <span>${this._t("canvas.far_objects",{n:this._outliers})}</span>
      <button class="btn ghostbtn" @click=${()=>this._fitFar()}>${this._t("canvas.show_far")}</button>
    </div>`}_renderHomeArrow(){if(this._booting)return V;const e=this._view;if(!e||!e.w||!e.h)return V;const t=this._baseVb(),i=t[0],n=t[1],r=t[2],o=t[3];if(!(i+r<=e.x||i>=e.x+e.w||n+o<=e.y||n>=e.y+e.h))return V;const s=Math.atan2(n+o/2-(e.y+e.h/2),i+r/2-(e.x+e.w/2)),a=50+38*Math.cos(s),l=50+38*Math.sin(s);return W`<button class="homearrow" title=${this._t("canvas.home_tip")}
      style="left:${a.toFixed(1)}%;top:${l.toFixed(1)}%"
      @click=${e=>{e.stopPropagation(),this._fitAll("home")}}>
      <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${(180*s/Math.PI).toFixed(1)}deg)"></ha-icon>
    </button>`}_stageAspect(){const e=this._stageEl,t=this._baseVb();return e&&e.clientHeight?e.clientWidth/e.clientHeight:t[2]/t[3]}_viewOr(e){return this._view&&this._view.w?this._view:vi(e,this._stageAspect())}_roomLabelReferenceViewWidth(e){if(!this._markup)return e.w;const t=this._stageEl,i=this.renderRoot.querySelector(".editorchrome");if(!t||t.clientWidth<=0||t.clientHeight<=0)return e.w;const n=t.clientHeight+(i?.getBoundingClientRect().height||0);return n<=0?e.w:this._viewForModeTarget(this._zoom,void 0,void 0,t.clientWidth,n).w}_screenToVb(e,t){const i=this._stageEl,n=this._viewOr(this._baseVb()),r=i?.clientWidth||1,o=i?.clientHeight||1;return[n.x+e/r*n.w,n.y+t/o*n.h]}_clampView(e,t){const i=(e,t,i,n)=>{const r=1*Math.max(t,n),o=i-r,s=i+n-t+r;return Math.max(Math.min(o,s),Math.min(Math.max(o,s),e))};return{w:e.w,h:e.h,x:i(e.x,e.w,t.x,t.w),y:i(e.y,e.h,t.y,t.h)}}_applyView(e,t,i){this._cancelCameraTransition(!1);const n=this._baseVb(),r=vi(n,this._stageAspect()),o=Math.min(cg.ZOOM_MAX,Math.max(cg.ZOOM_MIN,e)),s=r.w/o,a=r.h/o,l=this._viewOr(n),c=t??l.x+l.w/2,h=i??l.y+l.h/2,d=this._clampView({x:c-s/2,y:h-a/2,w:s,h:a},r);return!(this._view&&Math.abs(this._zoom-o)<1e-9&&Math.abs(this._view.x-d.x)<1e-6&&Math.abs(this._view.y-d.y)<1e-6&&Math.abs(this._view.w-d.w)<1e-6&&Math.abs(this._view.h-d.h)<1e-6)&&("opening"===this._tool&&(this._cursorPt=null,this._clearOpeningPlacement(!1)),this._zoom=o,this._view=d,!0)}_bootWatch(){clearTimeout(this._bootTimer),this._bootStart=Date.now(),this._bootLastH=-1,this._bootLastChange=this._bootStart;const e=()=>{if(!this._booting)return;const t=Date.now(),i=this._stageEl?this._stageEl.clientHeight:0;i!==this._bootLastH&&(this._bootLastH=i,this._bootLastChange=t);const n=t-this._bootStart;n>=1200||n>=700&&i>0&&t-this._bootLastChange>=250?this._bootSettled():this._bootTimer=window.setTimeout(e,100)};this._bootTimer=window.setTimeout(e,100)}_bootSettled(){this._booting&&!this._bootSettling&&(this._bootSettling=!0,this._refitView(),this._bootSettleRaf=requestAnimationFrame(()=>{this._bootSettleRaf=0,this._finishBootSettled()}))}_finishBootSettled(){if(!this._booting)return;this._refitView(),this._booting=!1,this._bootSettling=!1;const e=this._stageEl?.clientHeight??0;!this._config?.kiosk&&e>0&&this._warmPatch({hdrH:this._hdrH,stageH:e,vp:this._warmViewportState()},!0),this._bootFading=!0,this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220),this._bootSoft=!0,clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},Bf)}_bootSoftCancel(){this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoft=!1)}_beginResumeSettle(){this._booting||this._resumeSettling||(this._modeTransitionPreparing?this._modeTransitionForceAtomic=!0:this._cancelModeTransition(!0),this._viewportInvalidAt=0,this._beginContinuityCandidate("warm-resume",!1),this._loading?this.requestUpdate():this._loadFromServer())}_refitView(){if(this._modeTransitionBusy||this._warmModeRequest)return;this._cancelCameraTransition(!1);const e=this._stageEl;if(!e||"visible"!==document.visibilityState||e.clientWidth<=0||e.clientHeight<=0)return void(this._viewportInvalidAt||(this._viewportInvalidAt=Date.now()));const t=[e.clientWidth,e.clientHeight],i=this._lastValidStageSize,n=!!i&&Math.abs(i[0]-t[0])<=.5&&Math.abs(i[1]-t[1])<=.5,r=this._viewportInvalidAt?Date.now()-this._viewportInvalidAt:0;if(this._viewportInvalidAt=0,!i)return this._lastValidStageSize=t,void(this._view||this._applyView(this._zoom));n?this._pendingRefitSize=null:(this._pendingRefitSize=t,this._refitRaf||(this._refitRaf=requestAnimationFrame(()=>{this._refitRaf=0;const e=this._pendingRefitSize;this._pendingRefitSize=null;const t=this._stageEl;if(!e||!t||t.clientWidth<=0||t.clientHeight<=0)return;if(Math.abs(t.clientWidth-e[0])>.5||Math.abs(t.clientHeight-e[1])>.5)return void this._refitView();const i=this._lastValidStageSize;if(i&&Math.abs(i[0]-e[0])<=.5&&Math.abs(i[1]-e[1])<=.5)return;this._lastValidStageSize=e;const n=this._view;r>=Ol?this._beginContinuityCandidate("stage-size-restored",!0,"stage-size"):this._continuity.hasCompleteFrame&&this._beginContinuityCandidate("stage-resize",!0,"stage-size"),this._applyView(this._zoom,n?n.x+n.w/2:void 0,n?n.y+n.h/2:void 0)})))}_cameraTargetAt(e,t,i,n=!1){const r=this._stageEl;if(!r||r.clientWidth<=0||r.clientHeight<=0)return null;const o=vi(this._baseVb(),this._stageAspect()),s=Math.min(cg.ZOOM_MAX,Math.max(cg.ZOOM_MIN,i)),a=function(e,t,i,n,r,o,s){if(!I_(e)||!I_({zoom:t,viewBox:i})||!F_(n)||n<=0||!F_(r)||r<=0||!F_(o)||!F_(s))return null;const a=o/n,l=s/r,c=e.viewBox.x+a*e.viewBox.w,h=e.viewBox.y+l*e.viewBox.h,d=i.w/t,u=i.h/t;return{zoom:t,viewBox:{x:c-a*d,y:h-l*u,w:d,h:u}}}(n&&this._cameraTransition.target||this._cameraState(),s,o,r.clientWidth,r.clientHeight,e,t);return a?(a.viewBox=this._clampView(a.viewBox,o),{target:a,fit:o}):null}_zoomAt(e,t,i){this._cancelCameraTransition(!1);const n=this._cameraTargetAt(e,t,i);n&&("opening"===this._tool&&(this._cursorPt=null,this._clearOpeningPlacement(!1)),this._zoom=n.target.zoom,this._view={...n.target.viewBox})}_onWheel(e){this._prepareCameraCommand();const t=this._stageEl;if(!t)return;e.preventDefault();const i=t.getBoundingClientRect(),n=e.deltaY<0?1.15:1/1.15,r=this._cameraTransition.target?.zoom??this._zoom,o=this._cameraTargetAt(e.clientX-i.left,e.clientY-i.top,r*n,!0);o&&this._startCameraTransition(o.target,o.fit,"wheel",160)}_stepZoom(e){this._prepareCameraCommand();const t=this._stageEl;if(!t)return;const i=this._cameraTransition.target?.zoom??this._zoom,n=this._cameraTargetAt(t.clientWidth/2,t.clientHeight/2,i*(e>0?1.4:1/1.4),!0);n&&this._startCameraTransition(n.target,n.fit,"button",180)}_resetZoom(e="fit"){this._prepareCameraCommand();const t=vi(this._baseVb(),this._stageAspect());this._startCameraTransition({zoom:1,viewBox:{...t}},t,e,220)}_saveZoom(){if("view"===this._mode){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(Xf,JSON.stringify(this._zoomBySpace))}catch{}}}_restoreZoom(){this._cancelCameraTransition(!1);const e=this._zoomBySpace[this._space]||1;this._zoom=e;const t=this._stageEl;if(t&&t.clientHeight){const t=this._baseVb();return this._applyView(e,t[0]+t[2]/2,t[1]+t[3]/2),void this.requestUpdate()}this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const t=this._baseVb();this._applyView(e,t[0]+t[2]/2,t[1]+t[3]/2),this.requestUpdate()})}_stagePointerDown(e){if(this._cancelCameraTransition(!1,!0),this._vacFit)return;if(this._kiosk&&(this._cyclePausedUntil=Date.now()+6e4,0===this._pointers.size?(this._swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId},e.target.closest?.(".dev, .roomlabel, .oplock")||(clearTimeout(this._kioskHoldTimer),this._kioskHoldTimer=window.setTimeout(()=>{this._kioskDialog=!0,this._swipeStart=null},3e3))):(this._swipeStart=null,clearTimeout(this._kioskHoldTimer))),this._drag||this._deviceDrag)return;if(this._markup&&e.target.closest?.(".roomlabel, .rlhandle, .rszhandle, .dev, .oplock, .op-hit, button"))return;if("devices"===this._mode&&e.target.closest(".dev"))return;if("decor"===this._mode&&this._decorPointerDown(e))return;this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const t=this._viewOr(this._baseVb());if(1===this._pointers.size)this._panStart={sx:e.clientX,sy:e.clientY,vx:t.x,vy:t.y},this._panLock=null,this._suppressClick=!1;else if(2===this._pointers.size){"opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover();const e=[...this._pointers.values()],t=Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y);this._pinchStart={dist:t,zoom:this._zoom},this._panStart=null,this._panLock=null}}get _swipeZone(){return!this._hasFixedFloor&&this._kiosk&&this._zoom<=1.001&&this._model.length>1}_stagePointerMove(e){if(this._physicalRotate?.pid!==e.pointerId)if(this._physicalDrag?.pid!==e.pointerId)if(this._dtDrag?.pid!==e.pointerId)if(this._bdDrag?.pid!==e.pointerId){if(this._decorDraft?.pid===e.pointerId){const t=this._decorDraft;let i=this._decorSnap(this._svgPoint(e),e.pointerType);if(e.shiftKey&&("rect"===t.kind||"ellipse"===t.kind)){const e=i[0]-t.a[0],n=i[1]-t.a[1],r=Math.max(Math.abs(e),Math.abs(n));i=this._snap([t.a[0]+(e<0?-r:r),t.a[1]+(n<0?-r:r)])}return void(this._decorDraft={...t,b:i})}if(this._decorMove?.pid!==e.pointerId){if("decor"!==this._mode||"furniture"!==this._decorTool&&"image"!==this._decorTool||!this._editorRuntime||(this._notePointer(e),!this._editorRuntime._furnPointerMove(e,this._pointerModality.hoverEnabled)))if(this._pointers.has(e.pointerId)){if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._markup&&1===this._pointers.size&&this._markupMove(e),this._pinchStart&&this._pointers.size>=2){"opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover();const e=[...this._pointers.values()],t=Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),n=(e[0].x+e[1].x)/2-i.left,r=(e[0].y+e[1].y)/2-i.top;this._zoomAt(n,r,this._pinchStart.zoom*t),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const t=e.clientX-this._panStart.sx,i=e.clientY-this._panStart.sy;Math.abs(t)+Math.abs(i)>4&&(this._suppressClick=!0,clearTimeout(this._holdTimer),"opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover()),null===this._panLock&&Math.abs(t)+Math.abs(i)>8&&(this._panLock=this._swipeZone&&Math.abs(t)>1.5*Math.abs(i)?"swipe":"pan");const n=this._stageEl;if("pan"===this._panLock&&n){const e=this._baseVb(),r=this._viewOr(e),o=vi(e,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-t/(n.clientWidth||1)*r.w,y:this._panStart.vy-i/(n.clientHeight||1)*r.h,w:r.w,h:r.h},o)}}}else this._markupMove(e)}else this._decorMoveUpdate(e)}else this._bdMove(e);else this._dtMove(e);else this._physicalMove(e);else this._physicalRotateMove(e)}_stagePointerLeave(e){"decor"===this._mode&&this._editorRuntime?._furnPointerLeave(e),this._markup&&("opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover())}_stagePointerUp(e){if(this._kiosk){clearTimeout(this._kioskHoldTimer);const t=this._swipeStart;if(this._swipeStart=null,t&&t.id===e.pointerId){const i=e.clientX-t.x,n=e.clientY-t.y;if(Math.abs(i)+Math.abs(n)<8){const e=Date.now();e-this._lastTap<350&&this._resetZoom("double-tap"),this._lastTap=e}const r="pan"===this._panLock?null:function(e,t,i,n,r,o=60){if(i>1.001||n.length<2)return null;if(Math.abs(e)<o||Math.abs(e)<1.5*Math.abs(t))return null;const s=n.indexOf(r);if(s<0)return null;const a=n.length;return e<0?n[(s+1)%a]:n[(s-1+a)%a]}(i,n,this._zoom,this._model.map(e=>e.id),this._space);r&&this._slideTo(r,i<0?"left":"right")&&(this._saveNav(),this._suppressClick=!0,setTimeout(()=>this._suppressClick=!1,0),this._showKioskDots())}}if(this._physicalDrag?.pid===e.pointerId)return void this._physicalUp(e);if(this._physicalRotate?.pid===e.pointerId)return void this._physicalRotateUp(e);if(this._dtDrag?.pid===e.pointerId)return void this._dtUp();if(this._bdDrag?.pid===e.pointerId)return void this._bdUp();if(this._decorDraft?.pid===e.pointerId)return void this._decorCommitDraft();if(this._decorMove?.pid===e.pointerId)return this._decorMove.moved&&(this._recordGeometry(this._t("history.decor_move"),this._decorMove.before),this._saveConfig()),void(this._decorMove=null);if(this._editorRuntime?._furnPointerUp(e))return;const t=!!this._pinchStart||!!this._panStart;this._pointers.delete(e.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,this._panLock=null,setTimeout(()=>this._suppressClick=!1,0)),t&&0===this._pointers.size&&this.requestUpdate()}_clickRoom(e){!this._suppressClick&&e.area&&og("/config/areas/area/"+e.area)}_pointerDown(e,t){if("view"!==this._mode&&"devices"!==this._mode)return;if("view"===this._mode){this._holdFired=!1,clearTimeout(this._holdTimer);const i=e.pointerId,n=e.currentTarget;return void(this._holdTimer=window.setTimeout(()=>{this._holdFired=!0,this._interruptViewGesture(i,n),this._infoCard=t},600))}if("ha_disabled"===t.bindingStatus?.kind||this._devicePositionBusy)return;if(this._deviceDrag)return void(this._deviceDrag.pointerId!==e.pointerId&&this._cancelDeviceDrag());e.preventDefault();const i=this._pos(t);this._deviceDrag={id:t.id,spaceId:t.space,displayName:t.name,pointerId:e.pointerId,source:e.currentTarget,sx:e.clientX,sy:e.clientY,ox:i.x,oy:i.y,moved:!1,before:k_(this._layout,t.id),start:this._devicePlacementForCanvas(t,i.x,i.y)},ag(e),this._tip=null}_pointerMove(e,t){if("devices"!==this._mode)return;const i=this._deviceDrag;if(!i||i.id!==t.id||i.pointerId!==e.pointerId)return;const n=this.renderRoot.querySelector(".stage");if(!n)return;const r=this._baseVb(),o=n.getBoundingClientRect(),s=this._viewOr(r),a=(e.clientX-i.sx)/o.width*s.w,l=(e.clientY-i.sy)/o.height*s.h;Math.abs(e.clientX-i.sx)+Math.abs(e.clientY-i.sy)>3&&(i.moved=!0,clearTimeout(this._holdTimer));const c=Ea(i.ox+a),h=Ea(i.oy+l);this._previewDevicePlacement(t.id,this._devicePlacementForCanvas(t,c,h))}_pointerUp(e,t){if(clearTimeout(this._holdTimer),"devices"!==this._mode)return;const i=this._deviceDrag;if(!i||i.id!==t.id||i.pointerId!==e.pointerId)return;this._deviceDrag=null;const n=k_(this._layout,t.id);var r,o;i.moved&&null!==n&&(r=n,o=i.start,null===r||null===o?r!==o:r.x!==o.x||r.y!==o.y||r.s!==o.s)?(this._selId=t.id,this._suppressClick=!0,window.setTimeout(()=>{this._suppressClick=!1},0),this._devicePositionBusy=!0,this.requestUpdate(),this._persistDevicePlacement(t.id,n).then(()=>{const e=this._t("history.device_move",{name:i.displayName});this._devicePositionHistory.push({name:e,before:{deviceId:i.id,spaceId:i.spaceId,placement:i.before},after:{deviceId:i.id,spaceId:i.spaceId,placement:n}})}).catch(e=>{this._previewDevicePlacement(t.id,i.before),this._showToast(this._t("toast.pos_save_failed",{err:this._errText(e)}))}).finally(()=>{this._devicePositionBusy=!1,this.requestUpdate()})):this._previewDevicePlacement(t.id,i.before)}_pointerCancel(e,t){this._deviceDrag?.id===t.id&&this._deviceDrag.pointerId===e.pointerId&&this._cancelDeviceDrag()}_showToast(e){for(const e of this.renderRoot.querySelectorAll("hp-dialog"))e.closeTransientOverlays("toast");this._toast=e,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}_syncPointerHoverTargets(){const e=this._pointerModality.hoverEnabled;for(const t of this.renderRoot.querySelectorAll(eg))t.toggleAttribute("data-pointer-hover",e)}_syncPointerHoverSubtree(e){if(e.nodeType!==Node.ELEMENT_NODE)return;const t=e,i=this._pointerModality.hoverEnabled;t.matches(eg)&&t.toggleAttribute("data-pointer-hover",i);for(const e of t.querySelectorAll(eg))e.toggleAttribute("data-pointer-hover",i)}_clearTransientHover(e=!1){e&&this._pointerModality.suspend(),this._tip&&(this._tip=null),this._hoverRoom&&(this._hoverRoom=null)}_notePointer(e){const t=this._pointerModality.modality,i=this._pointerModality.note(e);"touch"!==i&&"pen"!==i||t===i&&!this._tip&&!this._hoverRoom||this._clearTransientHover()}_guardTouchGesture(e){if(this._editorSecondary?.handleOutsideDismiss(e))return;if("click"===e.type){if(!this._suppressClick&&!this._touchSequenceMultitouch&&Date.now()>this._touchClickBlockUntil)return;return e.preventDefault(),void e.stopImmediatePropagation()}const t=e;if(this._notePointer(t),"touch"===t.pointerType)if("pointerdown"!==e.type){if("pointermove"===e.type){const e=this._touchContacts.get(t.pointerId);if(!e)return;const i={...e,x:t.clientX,y:t.clientY};if(this._touchContacts.set(t.pointerId,i),this._touchSequenceMultitouch&&"view"===this._mode&&!this._vacFit&&this._pinchStart&&[...this._touchContacts.values()].every(e=>e.inStage)){this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=[...this._touchContacts.values()];if(e.length>=2&&this._stageEl){const[t,i]=e,n=Math.hypot(t.x-i.x,t.y-i.y)/(this._pinchStart.dist||1),r=this._stageEl.getBoundingClientRect();this._zoomAt((t.x+i.x)/2-r.left,(t.y+i.y)/2-r.top,this._pinchStart.zoom*n),this._saveZoom()}}return}if("pointerup"===e.type||"pointercancel"===e.type||"lostpointercapture"===e.type){if(this._clearTransientHover(),this._touchContacts.delete(t.pointerId),this._touchSequenceMultitouch){if(this._touchClickBlockUntil=Date.now()+500,this._pointers.delete(t.pointerId),!this._vacFit&&this._pointers.size>=2){const[e,t]=[...this._pointers.values()];this._pinchStart={dist:Math.hypot(e.x-t.x,e.y-t.y),zoom:this._zoom}}else this._pinchStart=null;0===this._pointers.size&&(this._panStart=null,this._panLock=null)}0===this._touchContacts.size&&(this._touchSequenceMultitouch=!1)}}else if(this._touchContacts.set(t.pointerId,{x:t.clientX,y:t.clientY,inStage:!!t.target?.closest?.(".stage")}),this._touchContacts.size>=2){this._clearTransientHover(),this._touchSequenceMultitouch=!0,this._touchClickBlockUntil=Number.POSITIVE_INFINITY,clearTimeout(this._holdTimer),clearTimeout(this._kioskHoldTimer),this._swipeStart=null;const e=[...this._touchContacts.values()];if("view"===this._mode&&!this._vacFit&&e.every(e=>e.inStage)){this._pointers=new Map([...this._touchContacts].map(([e,t])=>[e,{x:t.x,y:t.y}]));const[t,i]=e;this._pinchStart={dist:Math.hypot(t.x-i.x,t.y-i.y),zoom:this._zoom},this._panStart=null,this._panLock=null}else this._vacFit&&(this._pointers.clear(),this._pinchStart=null,this._panStart=null,this._panLock=null)}}_showTip(e,t,i,n,r,o,s=!1){this._notePointer(e),this._pointerModality.hoverEnabled&&(this._drag||this._deviceDrag||(this._tip={x:e.clientX,y:e.clientY,title:t,meta:i,lqi:n,temp:r,hum:o,room:s}))}_roomTipEnabledForPointer(e){return"view"===this._mode&&(this._notePointer(e),!!Ki(this._settings)||(this._tip?.room&&(this._tip=null),!1))}get _gridPitch(){return Pa}get _cellCm(){const e=Number(this._curSpaceCfg?.cell_cm);return Number.isFinite(e)&&e>0?e:5}_fmtLen(e,t){const i=function(e,t,i,n){return Math.hypot(t[0]-e[0],t[1]-e[1])/i*n}(e,t,this._gridPitch,this._cellCm);return Et(i,"mi"===this.hass?.config?.unit_system?.length)}get _curSpaceCfg(){const e=this._resize?.preview;return e&&e.space===this._space?e.sp:this._serverCfg?.spaces.find(e=>e.id===this._space)}get _renderCfg(){const e=this._resize?.preview;return e&&this._serverCfg?{...this._serverCfg,spaces:this._serverCfg.spaces.map(t=>t.id===e.space?e.sp:t)}:this._serverCfg}get _spaceH(){return this._curSpaceCfg,tg}get _segments(){const e=this._curSpaceCfg,t=this._spaceH;return Bt(e?.rooms||[]).map(e=>[e[0]*tg,e[1]*t,e[2]*tg,e[3]*t])}_savedNav(){if(this._hasFixedFloor)return null;try{return JSON.parse(localStorage.getItem(Zf)||"null")}catch{return null}}_saveNav(){if(!this._hasFixedFloor)try{localStorage.setItem(Zf,JSON.stringify({space:this._space}))}catch{}}_leaveCardRoute(){if(this._routeDepartureHandled)return;this._routeDepartureHandled=!0,this._cancelDangerConfirm(),"view"!==this._mode&&this._setMode("view",!1),this._pendingNavMode=null,this._geometryHistory.clear(),this._activeDraftId=null,this._resumeDraftBySpace={},this._draftSegmentCms=[],this._closingWallCm=null,this._drawWallField=null,this._showHidden=!1,this._tapConfirm=null,this._vacCalConfirm=null,this._decorEraseConfirm=null,this._openingInfo=null,this._closeInfoCard(),this._rulesDialog=null,this._alignDialog=null,this._preflightClipboardFallback=null,this._backupImportDialog=null,this._backupExportDialog=null,this._supportDialog?.preview?.token&&this._editorRuntime?._discardSupportPreview(this._supportDialog.preview.token),this._supportDialog=null,this._settingsDialog=null,this._deviceInbox=null,this._deviceInboxReturn=null,this._markerDialog=null,this._openingDialog=null,this._physicalDialog=null,this._wallDialog=null,this._backdropDialog=null,this._decorShapeDialog=null,this._decorTextDialog=null,this._mergeDialog=null,this._roomDialog=!1,this._spaceDialog=null,this._importDialog=null;const e=this._warmSlot;e?.owner===this._warmGen&&(e.vp=this._warmViewportState(),e.dlg=null,e.frameFingerprint="",clearTimeout(e.evict),e.evict=0),this._saveNav()}_setMode(e,t=!0){return e!==this._mode&&this._cancelDangerConfirm(),this._warmModeRequest=0,this._editorRuntime?this._editorRuntime._setMode(e,t):"view"===e?void this._editorModeRequest++:void this._requestMode(e,t)}_primeDrawWallField(){return this._editorRuntimeOrThrow()._primeDrawWallField()}get _drawWallFieldValue(){return null===this._drawWallField?uo(15,this._imperial):this._drawWallField}get _drawWallCm(){const e=(e=>{const t=String(e??"").trim().replace(",",".");if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t))return null;const i=Number(t);return Number.isFinite(i)?i:null})(this._drawWallFieldValue);if(null==e||e<0)return null;const t=this._imperial?2.54*e:e,i="column"===this._tool?Vs:100;return t>=("column"===this._tool?1:0)&&t<=i?t:null}get _drawWallMaxCm(){return"column"===this._tool?Vs:100}_showPhysicalRange(e=this._drawWallMaxCm,t=0){return this._editorRuntimeOrThrow()._showPhysicalRange(e,t)}_draftSegmentCount(e=this._curSpaceCfg){return this._editorRuntimeOrThrow()._draftSegmentCount(e)}_mergeSpacePartitions(e,t){return this._editorRuntimeOrThrow()._mergeSpacePartitions(e,t)}_finishWallChain(){return this._editorRuntimeOrThrow()._finishWallChain()}_activateMarkupTool(e){return this._editorRuntimeOrThrow()._activateMarkupTool(e)}_limitReached(e){return this._editorRuntimeOrThrow()._limitReached(e)}_svgPoint(e){return this._editorRuntimeOrThrow()._svgPoint(e)}_snap(e){return this._editorRuntimeOrThrow()._snap(e)}_snapDrawPoint(e,t=!1){return this._editorRuntimeOrThrow()._snapDrawPoint(e,t)}_planSnapOpeningCuts(e,t){return this._editorRuntimeOrThrow()._planSnapOpeningCuts(e,t)}_planSnapGeometrySnapshot(){return this._editorRuntimeOrThrow()._planSnapGeometrySnapshot()}_hiddenWallDiagnosticSnapshot(){return this._editorRuntimeOrThrow()._hiddenWallDiagnosticSnapshot()}_planStructuralGeometrySnapshot(){return this._editorRuntimeOrThrow()._planStructuralGeometrySnapshot()}_planSnapContextKey(e){return this._editorRuntimeOrThrow()._planSnapContextKey(e)}_resolvePlanDrawPoint(e,t){return this._editorRuntimeOrThrow()._resolvePlanDrawPoint(e,t)}get _activePlanSnapCandidate(){if(!this._markup||"draw"!==this._tool)return null;const e=this._planSnapHover;if(!e)return null;const t=this._planSnapGeometrySnapshot();return e.contextKey===this._planSnapContextKey(t.key)?e.candidate:null}get _activePlanSnapConflicts(){if(!this._markup||"draw"!==this._tool)return[];const e=this._planSnapHover;if(!e)return[];const t=this._planSnapGeometrySnapshot();return e.contextKey===this._planSnapContextKey(t.key)?e.conflicts:[]}_clearPlanSnapHover(e=!0){return this._editorRuntime?this._editorRuntimeOrThrow()._clearPlanSnapHover(e):(this._planSnapHover=null,void(e&&(this._cursorPt=null)))}_samePt(e,t){return Xt(e,t)}_dropLegacySegments(){return this._editorRuntimeOrThrow()._dropLegacySegments()}_rollbackRejectedPhysicalWrites(e){return this._editorRuntimeOrThrow()._rollbackRejectedPhysicalWrites(e)}async _reloadRejectedPhysicalWrite(){return this._editorRuntimeOrThrow()._reloadRejectedPhysicalWrite()}get _cfgWriting(){return this._writesPending>0}async _sendConfigCandidate(e){const t=to(e),i=await this.hass.callWS({type:"houseplan/config/set",config:t,expected_rev:this._cfgRev});this._cfgRev=i?.rev??this._cfgRev+1}_writeConfig(){if(this._editorRuntime)return this._editorRuntime._writeConfig();this._writesPending++,this._writeChain=v_(this._writeChain,async()=>{if(!this._serverCfg)return;const e=to(this._serverCfg),t=Ll(e);t!==Ll(this._serverCfg)&&(this._serverCfg=e),this._cfgContentFingerprint=t,await this._sendConfigCandidate(e)});return this._writeChain.finally(()=>{this._writesPending--})}_saveConfig(){this._cfgEpoch++,this._saveConfigDebounced()}_geometrySnapshotFromConfig(e,t){return this._editorRuntimeOrThrow()._geometrySnapshotFromConfig(e,t)}_geometrySnapshot(e=this._space){return this._editorRuntimeOrThrow()._geometrySnapshot(e)}_recordGeometry(e,t){return this._editorRuntimeOrThrow()._recordGeometry(e,t)}_restoreGeometryStateInConfig(e,t,i=!1){return this._editorRuntimeOrThrow()._restoreGeometryStateInConfig(e,t,i)}_restoreGeometryStateLocal(e){return this._editorRuntimeOrThrow()._restoreGeometryStateLocal(e)}_wallModelBlockerLabel(e){return this._editorRuntimeOrThrow()._wallModelBlockerLabel(e)}_hasLegacyZeroWallFields(e=this._serverCfg){return this._editorRuntimeOrThrow()._hasLegacyZeroWallFields(e)}_showWallModelMigrationBlocked(e){return this._editorRuntimeOrThrow()._showWallModelMigrationBlocked(e)}_limitSegmentsOf(e){return this._editorRuntimeOrThrow()._limitSegmentsOf(e)}_junctionLimitViolations(e,t,i){return this._editorRuntimeOrThrow()._junctionLimitViolations(e,t,i)}_junctionLimitLabel(e){return this._editorRuntimeOrThrow()._junctionLimitLabel(e)}_junctionLimitsIntroduced(e,t,i){return this._editorRuntimeOrThrow()._junctionLimitsIntroduced(e,t,i)}_commitPhysicalGeometry(e,t,i=[]){return this._editorRuntimeOrThrow()._commitPhysicalGeometry(e,t,i)}_clearGeometryGesture(){return this._editorRuntime?this._editorRuntimeOrThrow()._clearGeometryGesture():(this._path=[],this._planSnapHover=null,this._cursorPt=null,this._openingHoverCandidate=null,this._openingJambBlockCm=null,this._openingPreset=null,this._openingRebindId=null,this._mergeSel=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._wallFaceBatch=null,this._wallRepairDiagnostic=null,this._roomDeleteDialog=null,this._wallDialog=null,this._physicalDialog=null,this._physicalSel=null,this._physicalDrag=null,this._physicalRotate=null,this._activeDraftId=null,this._draftSegmentCms=[],this._closingWallCm=null,this._openingDialog=null,this._resize?.reset(),this._decorDraft=null,this._decorMove=null,this._dtDrag=null,void(this._bdDrag=null))}_stagePointerCancel(e){if(this._editorRuntime)return this._editorRuntime._stagePointerCancel(e)}_applyGeometryState(e,t=!1){return this._editorRuntimeOrThrow()._applyGeometryState(e,t)}_roomAt(e){return this._editorRuntimeOrThrow()._roomAt(e)}_overlapRoom(e){return this._editorRuntimeOrThrow()._overlapRoom(e)}_pointInRoom(e,t){return t.poly?Zt(e,t.poly):null!=t.x&&e[0]>=t.x&&e[0]<=t.x+t.w&&e[1]>=t.y&&e[1]<=t.y+t.h}_contourSelfIntersects(e){return this._editorRuntimeOrThrow()._contourSelfIntersects(e)}_canAppendRoomDraftPoint(){return this._editorRuntimeOrThrow()._canAppendRoomDraftPoint()}_markupClick(e){if(this._editorRuntime)return this._editorRuntime._markupClick(e)}_draftEndAt(e,t){return this._editorRuntimeOrThrow()._draftEndAt(e,t)}_mergeDraftEndpoint(e){return this._editorRuntimeOrThrow()._mergeDraftEndpoint(e)}_adoptDraftCms(e,t,i){return this._editorRuntimeOrThrow()._adoptDraftCms(e,t,i)}_draftSegmentsForPath(e,t,i){return this._editorRuntimeOrThrow()._draftSegmentsForPath(e,t,i)}_persistActiveDraftSegment(){return this._editorRuntimeOrThrow()._persistActiveDraftSegment()}_activeWallSourceKey(e){return this._editorRuntimeOrThrow()._activeWallSourceKey(e)}_wallGraphSources(e){return this._editorRuntimeOrThrow()._wallGraphSources(e)}_wallFaceGraph(e,t){return this._editorRuntimeOrThrow()._wallFaceGraph(e,t)}_offerWallFaces(e,t=this._path.length-2,i){return this._editorRuntimeOrThrow()._offerWallFaces(e,t,i)}_beginWallFaceBatch(e){return this._editorRuntimeOrThrow()._beginWallFaceBatch(e)}_offerExistingWallFace(e){return this._editorRuntimeOrThrow()._offerExistingWallFace(e)}_columnClick(e){return this._editorRuntimeOrThrow()._columnClick(e)}_openPhysicalDialog(e,t,i){return this._editorRuntimeOrThrow()._openPhysicalDialog(e,t,i)}_physicalDown(e,t,i){return this._editorRuntimeOrThrow()._physicalDown(e,t,i)}_clampPhysicalDelta(e,t,i){return this._editorRuntimeOrThrow()._clampPhysicalDelta(e,t,i)}_physicalMove(e){return this._editorRuntimeOrThrow()._physicalMove(e)}_physicalUp(e){return this._editorRuntimeOrThrow()._physicalUp(e)}_registerPhysicalTap(e,t,i){return this._editorRuntimeOrThrow()._registerPhysicalTap(e,t,i)}_cancelPhysicalGesture(){return this._editorRuntimeOrThrow()._cancelPhysicalGesture()}_physicalRotateDown(e,t){return this._editorRuntimeOrThrow()._physicalRotateDown(e,t)}_physicalRotateMove(e){return this._editorRuntimeOrThrow()._physicalRotateMove(e)}_physicalRotateUp(e){return this._editorRuntimeOrThrow()._physicalRotateUp(e)}_rszRooms(){return this._editorRuntimeOrThrow()._rszRooms()}_rszOpenings(){return this._editorRuntimeOrThrow()._rszOpenings()}_rszObstacles(){return this._editorRuntimeOrThrow()._rszObstacles()}_rszOptsFor(e,t){return this._editorRuntimeOrThrow()._rszOptsFor(e,t)}_rszResolution(e,t,i){return this._editorRuntimeOrThrow()._rszResolution(e,t,i)}_rszSnapshot(){return this._editorRuntimeOrThrow()._rszSnapshot()}_rszResetController(){return this._editorRuntimeOrThrow()._rszResetController()}_rszProjectPreview(e,t,i,n,r){return this._editorRuntimeOrThrow()._rszProjectPreview(e,t,i,n,r)}_rszAcceptPreview(e,t){return this._editorRuntimeOrThrow()._rszAcceptPreview(e,t)}_rszSpaceCandidateGeometry(e,t){return this._editorRuntimeOrThrow()._rszSpaceCandidateGeometry(e,t)}_rszSpaceCandidateRenderable(e,t){return this._editorRuntimeOrThrow()._rszSpaceCandidateRenderable(e,t)}_rszCandidateRenderable(e){return this._editorRuntimeOrThrow()._rszCandidateRenderable(e)}_rszEdgeDown(e,t,i){return this._editorRuntimeOrThrow()._rszEdgeDown(e,t,i)}_rszReasonText(e){return this._editorRuntimeOrThrow()._rszReasonText(e)}_rszDisabledActivate(e,t){return this._editorRuntimeOrThrow()._rszDisabledActivate(e,t)}_rszDisabledKey(e,t){return this._editorRuntimeOrThrow()._rszDisabledKey(e,t)}_rszMove(e){return this._editorRuntimeOrThrow()._rszMove(e)}_rszUp(e){return this._editorRuntimeOrThrow()._rszUp(e)}_rszCancelDrag(e){return this._editorRuntimeOrThrow()._rszCancelDrag(e)}_rszPointerCancel(e){return this._editorRuntimeOrThrow()._rszPointerCancel(e)}_rszEdgeLabels(e,t,i=this._resize?.rooms){return this._editorRuntimeOrThrow()._rszEdgeLabels(e,t,i)}_rszInnerSpanCms(e,t,i){return this._editorRuntimeOrThrow()._rszInnerSpanCms(e,t,i)}_renderResizeMeasurements(){return this._editorRuntimeOrThrow()._renderResizeMeasurements()}_renderResizeLayer(e){return this._editorRuntimeOrThrow()._renderResizeLayer(e)}get _openingsR(){const e=this._curSpaceCfg,t=this._spaceH,i=this._spaceModel();return i?(e?.openings||[]).flatMap(e=>{const n={...e,rx:e.x*tg,ry:e.y*t,rlen:e.length*tg};if(!e.host||"wall"===e.host.kind)return[n];const r=Vd(e,i.partitions,tg,this._cellCm,this._gridPitch);if(!r.resolved)return"plan"===this._mode?[{...n,orphanReason:r.reason||"invalid-host"}]:[];let[o,s]=r.resolved.center;const a=this._physicalDrag;return a?.moved&&"partition"===a.kind&&a.id===e.host.id&&(o+=a.delta[0],s+=a.delta[1]),[{...e,rx:o,ry:s,rlen:r.resolved.length,angle:r.resolved.angle,partitionHost:r.resolved}]}):[]}_partitionOpeningCuts(e=this._spaceModel(),t=()=>!0){if(!e)return[];return Fp(Op(this._curSpaceCfg?.id===e.id?this._curSpaceCfg:null,e,this._cellCm,this._gridPitch,tg),t)}_roomWallOpeningInputs(e=this._openingsR,t=this._spaceModel()){if(!t)return[];const i=this._openCuts();return Ip(e,t,this._spaceWalls,i,this._wallKeyPitch,this._cellCm,this._gridPitch,tg)}_openingFace(e,t,i){return e.partitionHost?Xd(e.partitionHost,i):qs(t,{x:e.rx,y:e.ry,angle:e.angle,length:e.rlen,flip_v:i})}_cmToUnits(e){return e/this._cellCm*this._gridPitch}get _decorList(){const e=this._curSpaceCfg;return Array.isArray(e?.decor)?e.decor:[]}get _decorH(){return tg}_decorResolvedStyle(e){return function(e,t,i,n=rr){const r="rect"===e?.kind||"ellipse"===e?.kind,o=e,s=Dt(o?.color,n.color);return{color:s,opacity:or(o?.opacity,n.opacity),widthCm:dr(e,t,i,n.widthCm),fill:!!r&&!0===o?.fill,fillColor:Dt(o?.fill_color,o?.fill?s:n.fillColor),fillOpacity:r&&o?.fill?or(o?.fill_opacity,.25):n.fillOpacity}}(e,this._cellCm,this._gridPitch,rr)}_decorWidthUnits(e){return((e,t,i,n=rr.widthCm)=>{const r=Number(e?.width_cm);if(Number.isFinite(r)&&r>0)return cr(r,t,i);const o=Number(e?.width);return Number.isFinite(o)&&o>0?o:cr(n,t,i)})(e,this._cellCm,this._gridPitch,rr.widthCm)}_decorTextSizeCm(e){if("text"===e?.kind){const t=Number(e.size_cm);return Number.isFinite(t)&&t>0?t:hr(20*Ei(e),this._cellCm,this._gridPitch)}return hr(20,this._cellCm,this._gridPitch)}_decorTextUnits(e){if("text"!==e.kind)return 20;const t=Number(e.size_cm);return Number.isFinite(t)&&t>0?cr(t,this._cellCm,this._gridPitch):20*Ei(e)}_decorSmallField(e){return Math.round(100*(this._imperial?e/2.54:e))/100}_decorSmallCm(e){const t=this._imperial?2.54*e:e;return Number.isFinite(t)?Math.max(.1,Math.min(100,t)):.1}_decorTextCm(e){const t=this._imperial?2.54*e:e;return Number.isFinite(t)?Math.max(.1,Math.min(2e3,t)):.1}_decorLargeField(e){return Math.round(100*(this._imperial?e/30.48:e/100))/100}_decorLargeCm(e){const t=this._imperial?30.48*e:100*e;return Number.isFinite(t)?Math.max(.1,Math.min(Da*this._cellCm,t)):.1}_angleField(e){const t=Number(e);return Number.isFinite(t)?String(Number(t.toFixed(3))):"0"}_decorBoxOf(e){return"rect"!==e.kind&&"ellipse"!==e.kind&&"furniture"!==e.kind&&"image"!==e.kind?null:{x:e.x*tg,y:e.y*this._decorH,w:e.w*tg,h:e.h*this._decorH,angle:sr(e.angle)||void 0}}_decorSnapGeometry(e){return this._editorRuntimeOrThrow()._decorSnapGeometry(e)}_decorSnap(e,t="mouse",i){return this._editorRuntimeOrThrow()._decorSnap(e,t,i)}_replaceDecor(e,t){return this._editorRuntimeOrThrow()._replaceDecor(e,t)}_cancelDecorGesture(){return this._editorRuntimeOrThrow()._cancelDecorGesture()}_decorPointerDown(e){return this._editorRuntimeOrThrow()._decorPointerDown(e)}_decorCommitDraft(){return this._editorRuntimeOrThrow()._decorCommitDraft()}_decorShapeDown(e,t){if(this._editorRuntime)return this._editorRuntime._decorShapeDown(e,t)}_decorMoveUpdate(e){return this._editorRuntimeOrThrow()._decorMoveUpdate(e)}_decorShapeDbl(e,t){if(this._editorRuntime)return this._editorRuntime._decorShapeDbl(e,t)}_openDecorProperties(e){return this._editorRuntimeOrThrow()._openDecorProperties(e)}_decorOpenText(e){return this._editorRuntimeOrThrow()._decorOpenText(e)}_decorRememberTextSelection(e){return this._editorRuntimeOrThrow()._decorRememberTextSelection(e)}_decorInsertLiveVariable(e){return this._editorRuntimeOrThrow()._decorInsertLiveVariable(e)}_decorSaveText(){return this._editorRuntimeOrThrow()._decorSaveText()}_decorSaveShape(){return this._editorRuntimeOrThrow()._decorSaveShape()}get _dtSel(){return"decor"===this._mode&&"select"===this._decorTool&&this._decorSel&&this._decorList.find(e=>e.id===this._decorSel)||null}_dtPivot(e){return this._editorRuntimeOrThrow()._dtPivot(e)}_dtApply(e,t){return this._editorRuntimeOrThrow()._dtApply(e,t)}_dtStart(e,t,i,n){return this._editorRuntimeOrThrow()._dtStart(e,t,i,n)}_dtMove(e){return this._editorRuntimeOrThrow()._dtMove(e)}_dtUp(){return this._editorRuntimeOrThrow()._dtUp()}_dtMeasure(){return this._editorRuntimeOrThrow()._dtMeasure()}_deleteDecor(e){return this._editorRuntimeOrThrow()._deleteDecor(e)}_decorDeleteSel(){return this._editorRuntimeOrThrow()._decorDeleteSel()}_confirmDecorErase(){return this._editorRuntimeOrThrow()._confirmDecorErase()}get _bdBase(){const e=this._curSpaceCfg;return e?.plan_url?{...$a(e.plan_aspect,tg)}:null}get _bdRect(){const e=this._curSpaceCfg;return e?.plan_url?Ca(e,tg):null}get _bdParams(){const e=this._curSpaceCfg,t=Number(e?.plan_x),i=Number(e?.plan_y),n=Number(e?.plan_scale),r=Number(e?.plan_scale_x),o=Number(e?.plan_scale_y),s=Number.isFinite(n)&&n>0?n:1;return{dx:Number.isFinite(t)?t:0,dy:Number.isFinite(i)?i:0,sx:Number.isFinite(r)&&r>0?r:s,sy:Number.isFinite(o)&&o>0?o:s,angle:sr(e?.plan_angle)}}_openBackdropDialog(e){if(this._editorRuntime)return this._editorRuntime._openBackdropDialog(e)}_saveBackdropDialog(){return this._editorRuntimeOrThrow()._saveBackdropDialog()}get _bdActive(){return"decor"===this._mode&&!!this._bdRect&&"backdrop"===this._decorTool}get _bdMovable(){return"decor"===this._mode&&"backdrop"===this._decorTool&&!!this._bdRect}_bdApply(e,t,i,n,r){return this._editorRuntimeOrThrow()._bdApply(e,t,i,n,r)}_bdStart(e,t,i=!1){return this._editorRuntimeOrThrow()._bdStart(e,t,i)}_bdMove(e){return this._editorRuntimeOrThrow()._bdMove(e)}get _bdMoved(){if("decor"!==this._mode||!this._bdRect)return!1;const e=this._bdParams;return 0!==e.dx||0!==e.dy||1!==e.sx||1!==e.sy||0!==e.angle}_bdReset(){return this._editorRuntimeOrThrow()._bdReset()}_bdUp(){return this._editorRuntimeOrThrow()._bdUp()}get _bdLive(){if(!this._bdDrag)return null;const e=this._bdRect;return e?{x:e.x+e.w/2,y:e.y+e.h/2,text:`${this._fmtLen([0,0],[e.w,0])} × ${this._fmtLen([0,0],[0,e.h])}`}:null}_renderBackdropFrame(e){return this._editorRuntime?this._editorRuntimeOrThrow()._renderBackdropFrame(e):V}_renderTextFrame(e){const t=this._dtSel,i=this._dtBox;if(!t||!i||i.id!==t.id)return V;const n=.018*Math.max(e.w,e.h),r=n/4;if("line"===t.kind){const e=[t.x1*tg,t.y1*this._decorH],i=[t.x2*tg,t.y2*this._decorH];return j`<g class="dtframe dtlineframe">
        <line class="dtbox" x1="${e[0]}" y1="${e[1]}" x2="${i[0]}" y2="${i[1]}"></line>
        ${[e,i].map((e,t)=>j`<circle class="dthandle dtendpoint" cx="${e[0]}" cy="${e[1]}"
          r="${n.toFixed(1)}" @pointerdown=${e=>this._dtStart(e,"scale",void 0,t)}></circle>
          <circle class="dtknob" cx="${e[0]}" cy="${e[1]}" r="${r.toFixed(2)}"></circle>`)}
      </g>`}const[o,s]=this._dtPivot(t),a=Number(t.angle)||0,l=[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]],c=2.2*n,h="furniture"===t.kind||"image"===t.kind,d=h?[[0,-1,"ns"],[1,0,"ew"],[0,1,"ns"],[-1,0,"ew"]]:[];return j`<g class="dtframe${h?" dtfurnitureframe":""}" transform=${a?`rotate(${a} ${o} ${s})`:V}>
      <rect class="dtbox" x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}"></rect>
      <line class="dtstem" x1="${i.x+i.w/2}" y1="${i.y}" x2="${i.x+i.w/2}" y2="${i.y-c}"></line>
      <circle class="dthandle dtrot" cx="${i.x+i.w/2}" cy="${i.y-c}" r="${n.toFixed(1)}"
        @pointerdown=${e=>this._dtStart(e,"rotate")}></circle>
      <circle class="dtknob" cx="${i.x+i.w/2}" cy="${i.y-c}" r="${r.toFixed(2)}"></circle>
      ${lg.map(e=>"edges"===e?d.map(([e,t,o])=>{const s=e<0?i.x:e>0?i.x+i.w:i.x+i.w/2,a=t<0?i.y:t>0?i.y+i.h:i.y+i.h/2;return j`<circle class="dthandle dtedge dt-${o}" cx="${s}" cy="${a}"
            r="${n.toFixed(1)}" @pointerdown=${i=>this._dtStart(i,"scale",[e,t])}></circle>
            <circle class="dtknob dtedgeknob" cx="${s}" cy="${a}" r="${r.toFixed(2)}"></circle>`}):l.map(([e,t,o])=>j`<circle class="dthandle dt-${o}"
          cx="${e<0?i.x:i.x+i.w}" cy="${t<0?i.y:i.y+i.h}" r="${n.toFixed(1)}"
          @pointerdown=${i=>this._dtStart(i,"scale",[e,t])}></circle><circle class="dtknob"
          cx="${e<0?i.x:i.x+i.w}" cy="${t<0?i.y:i.y+i.h}" r="${r.toFixed(2)}"></circle>`))}
    </g>`}_renderDecorLayer(){const e=tg,t=this._decorH,i="decor"===this._mode,n=i&&"erase"===this._decorTool,r=this._stageEl,o=this._viewOr(this._baseVb()),s="iso"===this._renderProjection?1:function(e,t,i,n){const r=Number(e),o=Number(t),s=Number(i),a=Number(n);if(![r,o,s,a].every(e=>Number.isFinite(e)&&e>0))return 1;const l=Math.min(r/s,o/a);return Number.isFinite(l)&&l>0?l:1}(r?.clientWidth,r?.clientHeight,o.w,o.h),a=this._decorList.map(r=>{const o="dshape"+(i&&this._decorSel===r.id?" dsel":""),a=this._decorResolvedStyle(r),l=this._decorWidthUnits(r),c=e=>this._decorShapeDown(e,r),h=e=>this._decorShapeDbl(e,r);if("line"===r.kind)return j`<line class="${o}" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          x1="${r.x1*e}" y1="${r.y1*t}" x2="${r.x2*e}" y2="${r.y2*t}"
          stroke="${a.color}" stroke-opacity="${a.opacity}" stroke-width="${l}"
          stroke-dasharray=${"dashed"===r.line_style?`${4*l} ${3*l}`:V}
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${c} @dblclick=${h}></line>
          ${i&&"select"===this._decorTool?j`<line class="dshape dselecthit"
            data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            x1="${r.x1*e}" y1="${r.y1*t}" x2="${r.x2*e}" y2="${r.y2*t}"
            @pointerdown=${c} @dblclick=${h}></line>`:V}
          ${n?j`<line class="dshape derasehit" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            x1="${r.x1*e}" y1="${r.y1*t}" x2="${r.x2*e}" y2="${r.y2*t}"
            @pointerdown=${c}></line>`:V}`;if("rect"===r.kind){const i=(r.x+r.w/2)*e,s=(r.y+r.h/2)*t,d=sr(r.angle);return j`<rect class="${o}" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          x="${r.x*e}" y="${r.y*t}" width="${r.w*e}" height="${r.h*t}"
          stroke="${a.color}" stroke-opacity="${a.opacity}" stroke-width="${l}"
          fill="${a.fill?a.fillColor:"none"}" fill-opacity="${a.fill?a.fillOpacity:0}"
          transform=${d?`rotate(${d} ${i} ${s})`:V}
          @pointerdown=${c} @dblclick=${h}></rect>
          ${n?j`<rect class="dshape derasehit" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            x="${r.x*e}" y="${r.y*t}" width="${r.w*e}" height="${r.h*t}"
            transform=${d?`rotate(${d} ${i} ${s})`:V} @pointerdown=${c}></rect>`:V}`}if("ellipse"===r.kind){const i=(r.x+r.w/2)*e,s=(r.y+r.h/2)*t,d=sr(r.angle);return j`<ellipse class="${o}" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          cx="${i}" cy="${s}"
          rx="${r.w/2*e}" ry="${r.h/2*t}" stroke="${a.color}" stroke-opacity="${a.opacity}" stroke-width="${l}"
          fill="${a.fill?a.fillColor:"none"}" fill-opacity="${a.fill?a.fillOpacity:0}"
          transform=${d?`rotate(${d} ${i} ${s})`:V}
          @pointerdown=${c} @dblclick=${h}></ellipse>
          ${n?j`<ellipse class="dshape derasehit" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            cx="${i}" cy="${s}" rx="${r.w/2*e}" ry="${r.h/2*t}"
            transform=${d?`rotate(${d} ${i} ${s})`:V} @pointerdown=${c}></ellipse>`:V}`}if("image"===r.kind){const s=Qp(r,e,t);if(!s)return V;const[a,l,d,u,p,m]=s,_=this._decorAssets.get(r.asset_id);if(!_)return i&&this._editorRuntime?this._editorRuntime._renderMissingDecorImage(r,o,m,a,l,d,u,c,h):V;const f=this._display(_.url);return f?j`<image class="${o} dimage" data-hp="decor" data-id=${r.id}
          data-kind="image" href=${f} x=${a} y=${l} width=${d} height=${u}
          opacity=${p} preserveAspectRatio="none" transform=${m}
          @load=${()=>this._signer.markLoaded(this._renderPlanHass,_.url,f)}
          @pointerdown=${c} @dblclick=${h}></image>
          ${n?j`<rect class="dshape derasehit" data-hp="decor" data-id=${r.id}
            data-kind="image" x=${a} y=${l} width=${d} height=${u} transform=${m}
            @pointerdown=${c}></rect>`:V}`:V}if("furniture"===r.kind){const d=kl(r.symbol);if(!d)return V;const u=zl(r,e,t,d.viewW,d.viewH),p=xl(l,s),m=xl(l+cr(20,this._cellCm,this._gridPitch),s);return j`<path class="${o} dfurn" data-hp="decor" data-id="${r.id}"
          data-kind="${r.kind}" data-symbol="${r.symbol}" d="${d.d}" transform=${u}
          stroke="${a.color}" stroke-opacity="${a.opacity}"
          stroke-width="${p}" fill="none"
          stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
          @pointerdown=${c} @dblclick=${h}></path>
          ${i&&"select"===this._decorTool?j`<path
            class="dshape dfurniturehit" data-hp="decor" data-id="${r.id}"
            data-kind="${r.kind}" data-symbol="${r.symbol}" d="${d.d}" transform=${u}
            stroke-width="${m}" fill="none" stroke-linecap="round"
            stroke-linejoin="round" vector-effect="non-scaling-stroke"
            @pointerdown=${c} @dblclick=${h}></path>`:V}
          ${n?j`<path class="dshape derasehit" data-hp="decor" data-id="${r.id}"
            data-kind="${r.kind}" data-symbol="${r.symbol}" d="${d.d}" transform=${u}
            vector-effect="non-scaling-stroke"
            @pointerdown=${c}></path>`:V}`}if("text"===r.kind){const i=this._decorTextUnits(r),n=this._renderDeviceSnapshot?.facts.get(`decor:${this._space}:${r.id}`),s=function(e){return String(e??"").replace(/\r\n?/g,"\n").split("\n")}("string"==typeof n?n:Fi(r.text,r,this._renderPlanHass,e=>this._renderEntityAvailable(e))),l=r.x*e,d=r.y*t,u=Number(r.angle)||0,p=d-(s.length-1)*i*1.2/2;return j`<text class="${o} dtext" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          x="${l}" y="${d}" fill="${a.color}" fill-opacity="${a.opacity}"
          font-size="${i}" transform=${u?`rotate(${u} ${l} ${d})`:V}
          @pointerdown=${c} @dblclick=${h}>${s.map((e,t)=>j`<tspan x="${l}" y="${p+t*i*1.2}">${e}</tspan>`)}</text>`}return V});let l=V;const c=this._decorDraft;if(c){const e=this._decorStyle,t=cr(e.widthCm,this._cellCm,this._gridPitch);if("line"===c.kind)l=j`<line class="ddraft" x1="${c.a[0]}" y1="${c.a[1]}" x2="${c.b[0]}" y2="${c.b[1]}"
          stroke="${e.color}" stroke-opacity="${e.opacity}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"></line>`;else{const i=Math.min(c.a[0],c.b[0]),n=Math.min(c.a[1],c.b[1]),r=Math.abs(c.b[0]-c.a[0]),o=Math.abs(c.b[1]-c.a[1]);l="rect"===c.kind?j`<rect class="ddraft" x="${i}" y="${n}" width="${r}" height="${o}" stroke="${e.color}"
              stroke-opacity="${e.opacity}" stroke-width="${t}" fill="${e.fill?e.fillColor:"none"}" fill-opacity="${e.fill?e.fillOpacity:0}"></rect>`:j`<ellipse class="ddraft" cx="${i+r/2}" cy="${n+o/2}" rx="${r/2}" ry="${o/2}"
              stroke="${e.color}" stroke-opacity="${e.opacity}" stroke-width="${t}" fill="${e.fill?e.fillColor:"none"}" fill-opacity="${e.fill?e.fillOpacity:0}"></ellipse>`}}return j`<g class="decorlayer">${a}${l}${this._editorRuntime?._renderFurniturePlacementPreview(s)??V}${this._editorRuntime?._renderDecorImagePlacementPreview()??V}</g>`}get _editorToolbarGroups(){return"plan"!==this._mode?[]:[{id:"opening",label:this._t("markup.opening"),icon:"mdi:door",activeItemId:"opening"===this._tool?this._openingPreset?.type:void 0,items:[{id:"window",label:this._t("opening.window"),icon:"mdi:window-closed-variant",role:"tool",invoke:()=>this._activateOpeningPlacement("window")},{id:"door",label:this._t("opening.door"),icon:"mdi:door-open",role:"tool",invoke:()=>this._activateOpeningPlacement("door")},{id:"passage",label:this._t("opening.passage"),icon:"mdi:arch",role:"tool",invoke:()=>this._activateOpeningPlacement("passage")},{id:"gate",label:this._t("opening.gate"),icon:"mdi:gate",role:"tool",invoke:()=>this._activateOpeningPlacement("gate")}]}]}_renderEditorGroupLauncher(e){return this._editorRuntimeOrThrow()._renderEditorGroupLauncher(e)}get _editorSecondaryContextId(){const e=`editor:${this._mode}:${this._space}:${this._cfgEpoch}`,t=this._editorSecondary?.activeGroup(this._editorToolbarGroups);if(t)return`${e}:group:${t.id}:${this._editorSecondary?.groupGeneration}`;if("plan"===this._mode){const t=this._physicalSel;return t?`${e}:selection:${t.kind}:${t.id}:${t.segment??""}`:`${e}:tool:${this._tool}:${this._path.length}`}return"decor"===this._mode?"furniture"===this._decorTool?`${e}:palette:furniture:${this._furnPalette?.symbol||"none"}`:"image"===this._decorTool?`${e}:palette:image:${this._decorImagePalette?.asset_id||"none"}`:"select"===this._decorTool&&this._decorSel?`${e}:selection:decor:${this._decorSel}`:`${e}:tool:${this._decorTool}:${this._bdMoved?1:0}:${this._bdDrag?1:0}`:`${e}:none`}_runEditorContext(e,t){return this._editorRuntimeOrThrow()._runEditorContext(e,t)}_renderEditorGroupModel(e){return this._editorRuntimeOrThrow()._renderEditorGroupModel(e)}_renderDrawWallControl(){return this._editorRuntimeOrThrow()._renderDrawWallControl()}_renderPlanSecondary(){return this._editorRuntimeOrThrow()._renderPlanSecondary()}_renderDecorSecondary(){return this._editorRuntimeOrThrow()._renderDecorSecondary()}_withBackdropReset(e){return this._editorRuntimeOrThrow()._withBackdropReset(e)}get _editorSecondaryDialogBlocked(){return!!(this._dangerConfirm||this._tapConfirm||this._vacCalConfirm||this._roomDialog||this._mergeDialog||this._openingDialog||this._physicalDialog||this._openingInfo||this._decorTextDialog||this._decorShapeDialog||this._backdropDialog||this._decorEraseConfirm||this._spaceDialog||this._markerDialog||this._deviceInbox||this._infoCard||this._rulesDialog||this._settingsDialog||this._supportDialog||this._alignDialog||this._importDialog||this._kioskDialog||this._backupExportDialog||this._backupImportDialog||this._wallDialog)}_renderEditorSecondary(){return this._editorRuntimeOrThrow()._renderEditorSecondary()}_renderDecorBar(){return this._editorRuntimeOrThrow()._renderDecorBar()}_renderDecorEraseConfirm(){return this._editorRuntimeOrThrow()._renderDecorEraseConfirm()}_renderDecorTextDialog(){return this._editorRuntimeOrThrow()._renderDecorTextDialog()}_renderDecorShapeDialog(){return this._editorRuntimeOrThrow()._renderDecorShapeDialog()}_renderBackdropDialog(){return this._editorRuntimeOrThrow()._renderBackdropDialog()}_cssPxToRender(e){return this._editorRuntimeOrThrow()._cssPxToRender(e)}_renderZeroWalls(e){if(e&&!e.showBorders&&!this._editing)return j``;const t=this._zeroWalls();if(!t.lines.length)return j``;const i=e?.color||"var(--hp-muted)";return j`<g class="zero-walls ${t.style}"
      data-zero-wall-style=${t.style} style="--zero-wall-stroke:${i}">
      ${t.lines.map(e=>j`<line class="zero-wall"
        x1="${e[0]}" y1="${e[1]}" x2="${e[2]}" y2="${e[3]}"></line>`)}
    </g>`}_zeroWalls(){const e=this._spaceModel();return e?Rp(this._curSpaceCfg,e,tg,.02*this._gridPitch):{style:Sp(this._curSpaceCfg),lines:[],contour:[],barriers:[],transmissive:[]}}_openCuts(){return this._zeroWalls().contour}_deleteRoomClick(e){return this._editorRuntimeOrThrow()._deleteRoomClick(e)}get _wallKeyPitch(){return Oa}get _spaceWalls(){const e=this._curSpaceCfg?.walls;return Array.isArray(e)?e:[]}_intervalCm(e){const t=this._spaceModel();return t?ms(t.rooms,this._spaceWalls,this._openCuts(),e,this._wallKeyPitch,this._cellCm,this._gridPitch,tg):0}_normalizeWalls(e,t){const i=this._spaceModel();if(!i)return[];return Co(ps(i.rooms,e,t,this._wallKeyPitch,this._cellCm,this._gridPitch,tg),this._curSpaceCfg?.rooms||[],Oa,1,t.map(e=>[e[0]/tg,e[1]/tg,e[2]/tg,e[3]/tg]))}_paperShapes(e){if(!this._spaceWalls.length)return Lt(e);const t=this._wallUnionGeometry();return t?.paperD?[{path:t.paperD}]:Lt(e)}_wallUnionGeometry(){const e=this._spaceModel();if(!e)return null;const t=this._spaceWalls,i=this._physicalBodiesR();if(!t.length&&!i.length)return null;const n=`${this._space}|${this._cfgEpoch}|${e.rooms.length}`;if(!this._wallUnionCache||this._wallUnionCache.key!==n){const r=qf(this._wallUnionPool,n);if(r.hit)this._wallUnionCache=r.value;else{const r=this._openCuts(),o=this._roomWallOpeningInputs(),s=Os(e.rooms,t,r,o,this._wallKeyPitch,this._cellCm,this._gridPitch,tg,i);s&&Object.defineProperty(s,"sourceFingerprint",{value:Ll([this._curSpaceCfg,this._cellCm,this._gridPitch]),enumerable:!1});const a={key:n,value:s};Wf(this._wallUnionPool,n,a,8),this._wallUnionCache=a}}return this._wallUnionCache.value}_thickWallCuts(){const e=this._spaceModel();if(!e)return[];const t=this._spaceWalls;if(!t.length)return[];const i=this._openCuts();return Is(e.rooms,t,i,this._wallKeyPitch,this._cellCm,this._gridPitch,tg).map(e=>[e.a[0],e.a[1],e.b[0],e.b[1]])}_innerRoomContour(e,t,i=this._openCuts(),n=this._wallUnionGeometry()?.roomGeom,r=this._wallUnionGeometry()?.multiWallNodes){const o=i.map(e=>e.join(",")).join(";"),s=`${e.id}|${this._cfgEpoch}|${t}|${o}`,a=qf(this._innerContourCache,s);if(a.hit)return a.value;const l=gs(e.rooms,t,this._spaceWalls,i,this._wallKeyPitch,this._cellCm,this._gridPitch,tg,n,r);return Wf(this._innerContourCache,s,l,600),l}_wallThickHit(e){return this._editorRuntimeOrThrow()._wallThickHit(e)}get _wallThickHover(){if(!this._markup||"wallthick"!==this._tool||!this._cursorPt||this._wallDialog)return null;const e=this._wallThickHit(this._cursorPt);if(!e)return null;const t=function(e,t,i){const n=Number.isFinite(e)&&e>0?e:0,r=Number.isFinite(t)&&t>0?t:5,o=Number.isFinite(i)&&i>0?i:0;return n>0?po(n,r,o)/2:ya(1.5*o,r)}(e.cm,this._cellCm,this._gridPitch);let i="";for(const n of e.segs)i+=(i?" ":"")+Wo([[n[0],n[1]],[n[2],n[3]]],t,!1);return{segs:e.segs,open:e.open,d:i}}_wallThickClick(e){return this._editorRuntimeOrThrow()._wallThickClick(e)}_wallThickApply(e){return this._editorRuntimeOrThrow()._wallThickApply(e)}_wallHatchDefs(e){const t=lo(this._cellCm);return j`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
        width="${t}" height="${t}" patternTransform="rotate(45)">
        <path d="M0 0 L0 ${t}" stroke="${e||"#607d8b"}" stroke-width="${t/8*2}"></path>
      </pattern>
    </defs>`}_resolvedRoomFills(e,t){const i=new Map,n=new Map;for(const r of e.rooms){const e=this._roomDialog&&r.id===this._roomEditId?this._roomFill||t.fill:yn(t.fill,r),o=this._roomDialog&&r.id===this._roomEditId?this._roomCustomFill||t.customFill:Ui(t.customFill,r),s=Ji(e,"lqi"===e&&r.area?this._roomLqi(r.area):null,"light"===e?Wh(Bh(this._renderPlanHass,this._renderDevices,r,this._virtualLights)):"none","temp"===e?this._roomTemp(r):null,t.tempMin,t.tempMax,this._fillColors,o);i.set(r,s),r.id&&n.set(r.id,s)}return{byRoom:i,byId:n}}_spaceDisplayForRender(){const e=Vi(this._curSpaceCfg),t=this._spaceDialog;return t&&"edit"===t.mode&&t.spaceId===this._space?{...e,showBorders:t.showBorders,showNames:t.showNames,hideDecor:t.hideDecor,hideOpenings:t.hideOpenings,color:t.roomColor,opacity:t.roomOpacity,fill:t.fillMode,customFill:t.customFill?ji(t.customFill):Wi,glow:t.glowEnabled,tempMin:t.tempMin,tempMax:t.tempMax,showLqi:t.showLqi,cardFontScale:t.cardFontScale,labelTemp:t.labelTemp,labelHum:t.labelHum,labelLqi:t.labelLqi,labelLight:t.labelLight}:e}_openingWallIndexFor(e,t){const i=e.rooms.map(e=>`${e.id}:${e.poly?.map(e=>e.join(",")).join("/")||`${e.x},${e.y},${e.w},${e.h}`}`).join(";"),n=this._spaceWalls.map(e=>`${e.key}:${e.a?.join(",")||""}:${e.b?.join(",")||""}:${e.cm}`).join(";"),r=t.map(e=>e.join(",")).join(";"),o=[e.id,this._cfgEpoch,this._wallKeyPitch,this._cellCm,this._gridPitch,i,n,r].join("|");let s=this._openingWallIndexCache.get(o);return s||(s=Hs(e.rooms,this._spaceWalls,t,this._wallKeyPitch,this._cellCm,this._gridPitch,tg)),Wf(this._openingWallIndexCache,o,s,4),{key:o,value:s}}_renderOpeningTunnelFills(e,t,i="data"){if(this._markup||!this._spaceWalls.length||!this._openingsR.length)return j``;if("glow-base"===i&&![...t.byRoom.values()].some(Boolean))return j``;const n=this._openCuts(),r=this._openingsR.map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),o=r.map(e=>`${e.x},${e.y},${e.angle},${e.length}`).join(";"),s=this._openingWallIndexFor(e,n),a=`${s.key}|${o}`;return this._openingTunnelCache&&this._openingTunnelCache.key===a||(this._openingTunnelCache={key:a,value:Us(s.value,r)}),mp({openings:this._openingsR,geometries:this._openingTunnelCache.value,fillsByRoomId:t.byId,idPrefix:`${e.id}-${i}`,groupClass:"data"===i?"opening-tunnels":"opening-tunnels glow-base-tunnels",dataLayer:i})}_resolvedGlowBase(e,t,i){const n=new Map,r=new Map,o=this._fillColors.glow_base;for(const s of e.rooms){const e=i.byRoom.get(s),a=bn(t.glow,s)&&(!e||e.opacity<=0)?{color:o.c,opacity:o.a,mode:"glow"}:null;n.set(s,a),s.id&&r.set(s.id,a)}return{byRoom:n,byId:r}}_renderGlowBaseRooms(e,t){if(this._markup||![...t.byRoom.values()].some(Boolean))return j``;const i=new Map(e.rooms.map(e=>[e,Nt(e)])),n=this._openCuts(),r=this._wallUnionGeometry()?.roomGeom,o=e=>"M "+e.map(e=>e[0]+" "+e[1]).join(" L ")+" Z",s=e.rooms.map(s=>{const a=t.byRoom.get(s)||null,l=i.get(s)||null;if(!a||!l)return V;const c=this._spaceWalls.length&&s.id&&this._innerRoomContour(e,s.id,n,r)||l,h=ci(c,e.rooms.filter(e=>e!==s).map(e=>i.get(e)).filter(e=>!!e)),d=this._cleanFloor(s,c,e).path;return d||h.length?j`<path class="glow-base" data-room-id=${s.id||V}
          d="${[d||o(c),...h.map(o)].join(" ")}"
          fill=${a.color} fill-opacity=${a.opacity} fill-rule="evenodd"
          pointer-events="none"></path>`:s.poly||c!==l?j`<polygon class="glow-base" data-room-id=${s.id||V}
          points="${c.map(e=>e.join(",")).join(" ")}"
          fill=${a.color} fill-opacity=${a.opacity} pointer-events="none"></polygon>`:j`<rect class="glow-base" data-room-id=${s.id||V}
        x=${s.x} y=${s.y} width=${s.w} height=${s.h}
        rx=${.03*Math.min(s.w,s.h)}
        fill=${a.color} fill-opacity=${a.opacity} pointer-events="none"></rect>`});return j`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${s}</g>`}_renderWallBodies(e){if("iso"===this._renderProjection)return j``;if(e&&!e.showBorders&&("view"===this._mode||"devices"===this._mode))return j``;const t=this._wallUnionGeometry();if(!t)return j``;const i=this._stageEl,n=this._viewOr(this._baseVb()),r=i&&i.clientWidth&&n.w?i.clientWidth/n.w:1,o=e?.color||"#607d8b",s=ao(t.depthUnits,r)||co(lo(this._cellCm),r),a=this._fillColors.wall_fill;return j`<g class="wallbodies" style="--room-stroke:${o};--wall-fill:${a.c};--wall-fill-op:${a.a}">
      ${t.paths.map(e=>j`
        <path class="wallbody-fill" data-component=${e.id} d="${e.d}"
          fill="${a.c}" fill-opacity="${a.a}" fill-rule=${e.fillRule}
          stroke="none" pointer-events="none"></path>
        <path class="wallbody ${s?"solid":""}"
          data-hp="wall" data-id="union" data-kind="union" data-component=${e.id}
          d="${e.d}" fill="${s?"none":"url(#hp-wall-hatch)"}"
          fill-rule=${e.fillRule}
          stroke="${o}" stroke-width="${ya(.6,this._cellCm)}"
          pointer-events="none"></path>`)}
    </g>`}_isoDecorationLayers(e){const t="undefined"==typeof CSS||"function"!=typeof CSS.supports||CSS.supports("filter","blur(1px)"),i="function"==typeof matchMedia&&matchMedia("(forced-colors: active)").matches;return function(e){const t=!!e.showBorders;return{structural:t,panels:t&&!e.hideOpenings,shadows:t&&e.filtersSupported&&!e.forcedColors,materialNuance:t&&!e.forcedColors,floorSymbols:!e.hideOpenings&&!t}}({showBorders:e.showBorders,hideOpenings:e.hideOpenings,filtersSupported:t,forcedColors:i})}_isoOpeningPanels(e){if(!e.panels)return[];const t=this._isoScene();if(!t)return[];return t.openings.flatMap(e=>{const t=this._openingsR[e.sourceIndex];return t?Cf(e,this._openingAmt(t)):[]}).sort((e,t)=>e.depth-t.depth||e.sourceIndex-t.sourceIndex||e.leaf-t.leaf)}_renderIsoDefs(e,t){const i=va(this._cellCm);return j`<defs>
      ${"walls"===t&&e.materialNuance?j`
        <linearGradient id="hp-iso-wall-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="iso-side-hi"></stop><stop offset="1" class="iso-side-lo"></stop>
        </linearGradient>
        <linearGradient id="hp-iso-wall-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" class="iso-top-hi"></stop><stop offset="1" class="iso-top-lo"></stop>
        </linearGradient>`:V}
      ${"underlay"===t&&e.shadows?j`
        <filter id="hp-iso-ambient-shadow" x="-12%" y="-12%" width="124%" height="130%">
          <feGaussianBlur stdDeviation="${7*i}"></feGaussianBlur>
        </filter>`:V}
      ${"shadows"===t&&e.shadows?j`
        <filter id="hp-iso-contact-shadow" x="-8%" y="-20%" width="116%" height="140%">
          <feGaussianBlur stdDeviation="${2.5*i}"></feGaussianBlur>
        </filter>
        <filter id="hp-iso-leaf-shadow" x="-12%" y="-30%" width="124%" height="160%">
          <feGaussianBlur stdDeviation="${2*i}"></feGaussianBlur>
        </filter>`:V}
    </defs>`}_renderIsoUnderlay(e){if(!e.structural)return j``;const t=this._isoScene()?.floor;return t?j`<g class="iso-underlay" data-hp="iso-underlay" aria-hidden="true" pointer-events="none">
      ${this._renderIsoDefs(e,"underlay")}
      ${e.shadows&&t.footprintPath?j`<path class="iso-ambient-shadow" d=${t.footprintPath}
            transform="translate(0 ${ya(8,this._cellCm)})"></path>`:V}
      <g class="iso-floor-edge">${t.sides.map(e=>j`<path class="iso-floor-side" d=${e.d} data-component=${e.component}
          data-edge=${e.edge}></path>`)}</g>
    </g>`:j``}_renderIsoShadows(e,t){if(!e.shadows)return j``;const i=this._isoScene()?.geometry;return i?j`<g class="iso-shadows" data-hp="iso-shadows" aria-hidden="true" pointer-events="none">
      ${this._renderIsoDefs(e,"shadows")}
      <path class="iso-contact-shadow" d=${i.contactPath}></path>
      <g class="iso-leaf-shadows">${t.map(e=>j`<path class="iso-leaf-shadow" d=${e.shadowD}
          data-id=${e.id} data-leaf=${e.leaf}></path>`)}</g>
    </g>`:j``}_renderIsoWalls(e,t){if("iso"!==this._renderProjection)return j``;if(!e.structural)return j``;const i=this._isoScene();return i?j`<g class="iso-walls" data-hp="iso-walls" data-fingerprint=${i.key}>
      ${this._renderIsoDefs(e,"walls")}
      <g class="iso-wall-sides">${i.geometry.sides.map(e=>j`<path class="iso-wall-side" d=${e.d} data-edge=${e.edge}></path>`)}</g>
      <path class="iso-wall-top" d=${i.geometry.topPath} fill-rule="evenodd"></path>
      ${e.panels?j`<g class="iso-openings" data-hp="iso-openings"
          aria-hidden="true" pointer-events="none">${t.map(e=>j`<path class="iso-opening-panel iso-${e.type}" d=${e.d}
            data-id=${e.id} data-kind=${e.type} data-leaf=${e.leaf}></path>`)}</g>`:V}
    </g>`:j``}_roomHoverPaths(e){const t=this._hoverRoom;if("view"!==this._mode||!t||t.space!==e.id)return null;const i=e.rooms.find(e=>e===t.room||!!e.id&&e.id===t.room.id);if(!i)return null;const n=Nt(i);if(!n)return null;const r=e.rooms.filter(e=>e!==i).map(e=>({room:e,poly:Nt(e)})).filter(e=>!!e.poly),o=ci(n,r.map(e=>e.poly)),s=this._openCuts(),a=.02*this._gridPitch,l=s.filter(e=>{const t=[(e[0]+e[2])/2,(e[1]+e[3])/2];return n.some((e,i)=>Mn(t,[e[0],e[1],...n[(i+1)%n.length]])<=4*a)}),c=this._spaceWalls,h=this._wallUnionGeometry()?.roomGeom,d=c.length&&i.id&&this._innerRoomContour(e,i.id,s,h)||n,u=[{axis:n,face:d}];for(const t of o){const i=r.find(e=>e.poly===t)?.room;let n=t;if(c.length&&i?.id){const r=hs(e.rooms,i.id,c,s,this._wallKeyPitch,this._cellCm,this._gridPitch,tg);r&&(n=Es(r.poly,r.offsets)||t)}u.push({axis:t,face:n})}const p=this._roomWallOpeningInputs(this._openingsR,e).map(e=>{const t=e.angle*Math.PI/180,i=Math.cos(t)*e.length/2,n=Math.sin(t)*e.length/2;return[e.x-i,e.y-n,e.x+i,e.y+n]}),m=l.concat(p),_=u.map(({axis:e,face:t})=>{const i=m.map(i=>((e,t,i)=>{const n=e[2]-e[0],r=e[3]-e[1],o=Math.hypot(n,r);if(o<a)return null;const s=n/o,l=r/o,c=(e[0]+e[2])/2,h=(e[1]+e[3])/2;let d=!1;for(let e=0;e<t.length;e++){const i=t[e],n=t[(e+1)%t.length],r=n[0]-i[0],o=n[1]-i[1],u=Math.hypot(r,o);if(!(u<a||Math.abs(s*(o/u)-l*(r/u))>.05)&&Mn([c,h],[i[0],i[1],n[0],n[1]])<=4*a){d=!0;break}}if(!d)return null;let u=null;for(let e=0;e<i.length;e++){const t=i[e],n=i[(e+1)%i.length],r=n[0]-t[0],o=n[1]-t[1],d=Math.hypot(r,o);if(d<a||Math.abs(s*(o/d)-l*(r/d))>.05)continue;const p=Mn([c,h],[t[0],t[1],n[0],n[1]]);(!u||p<u.d)&&(u={a:t,b:n,d:p})}if(!u)return null;const p=u.b[0]-u.a[0],m=u.b[1]-u.a[1],_=Math.hypot(p,m)||1,f=-m/_,g=p/_,v=(u.a[0]-c)*f+(u.a[1]-h)*g;return[e[0]+f*v,e[1]+g*v,e[2]+f*v,e[3]+g*v]})(i,e,t)).filter(e=>!!e);return i.length?mn(t,i,a).map(e=>`M ${e[0]} ${e[1]} L ${e[2]} ${e[3]}`).join(" "):`M ${t.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`}).filter(Boolean).join(" ");if(!_)return null;const f=e=>`M ${e.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`;return{fillD:[this._cleanFloor(i,d,e).path||f(d),...o.map(f)].join(" "),outlineD:_}}_renderRoomHoverFill(e){return e?j`<g class="room-hover room-hover-fill-layer" pointer-events="none">
      <path class="room-hover-fill" d="${e.fillD}" fill-rule="evenodd"></path>
    </g>`:j``}_renderRoomHoverOutline(e){return e?j`<g class="room-hover room-hover-outline-layer" pointer-events="none">
      <path class="room-hover-halo" d="${e.outlineD}"></path>
      <path class="room-hover-outline" d="${e.outlineD}"></path>
    </g>`:j``}_renderWallThickUi(){return this._editorRuntime?this._editorRuntimeOrThrow()._renderWallThickUi():j``}_renderWallThickDialog(){return this._editorRuntimeOrThrow()._renderWallThickDialog()}_openingAt(e){return this._editorRuntimeOrThrow()._openingAt(e)}_resolveOpeningPlacement(e){return this._editorRuntimeOrThrow()._resolveOpeningPlacement(e)}_activateOpeningPlacement(e){return this._editorRuntimeOrThrow()._activateOpeningPlacement(e)}_clearOpeningPlacement(e){return this._editorRuntime?this._editorRuntimeOrThrow()._clearOpeningPlacement(e):(this._openingHoverCandidate=null,this._openingJambBlockCm=null,void(e&&(this._openingPreset=null,this._openingRebindId=null)))}_openingClick(e){return this._editorRuntimeOrThrow()._openingClick(e)}_editOpening(e){if(this._editorRuntime)return this._editorRuntimeOrThrow()._editOpening(e)}_opPointerDown(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opPointerDown(e,t)}_opPointerMove(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opPointerMove(e,t)}_opRuler(e,t){return this._editorRuntimeOrThrow()._opRuler(e,t)}_opPointerUp(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opPointerUp(e,t)}_opClick(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opClick(e,t)}_saveOpening(){return this._editorRuntimeOrThrow()._saveOpening()}_deleteOpening(){return this._editorRuntimeOrThrow()._deleteOpening()}_contactCandidates(){return this._editorRuntimeOrThrow()._contactCandidates()}_lockCandidates(){return this._editorRuntimeOrThrow()._lockCandidates()}_toggleOpeningEntityPicker(e){return this._editorRuntimeOrThrow()._toggleOpeningEntityPicker(e)}_filterOpeningEntities(e,t){return this._editorRuntimeOrThrow()._filterOpeningEntities(e,t)}_selectOpeningEntity(e,t){return this._editorRuntimeOrThrow()._selectOpeningEntity(e,t)}_mergeClick(e){return this._editorRuntimeOrThrow()._mergeClick(e)}_commitMerge(){return this._editorRuntimeOrThrow()._commitMerge()}_splitClick(e){return this._editorRuntimeOrThrow()._splitClick(e)}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])&&(null!=this._closingWallCm||!this._activeDraftId)}_markupMove(e){if(this._markup&&this._editorRuntime)return this._editorRuntime._markupMove(e)}get _openingPreview(){const e=this._openingPreset;if("opening"!==this._tool||!e||!this._cursorPt)return null;const t=this._cursorPt,i=this._openingHoverCandidate;if(i&&If(i,[t[0],t[1]],e.revision,this._cfgEpoch))return i;if(this._openingAt(t))return this._openingHoverCandidate=null,null;const n=this._resolveOpeningPlacement(t);return this._openingHoverCandidate=n,n}get _opMeasureView(){return this._opMeasure||this._openingPreview?.measure||null}_saveRoom(){return this._editorRuntimeOrThrow()._saveRoom()}_decideWallFace(e){return this._editorRuntimeOrThrow()._decideWallFace(e)}_wallSourceCmAt(e,t,i){return this._editorRuntimeOrThrow()._wallSourceCmAt(e,t,i)}_activePathWithRepair(e,t){return this._editorRuntimeOrThrow()._activePathWithRepair(e,t)}_validateWallRepair(e,t){return this._editorRuntimeOrThrow()._validateWallRepair(e,t)}_applyWallRepair(e,t){return this._editorRuntimeOrThrow()._applyWallRepair(e,t)}_applyWallFaceBatch(){return this._editorRuntimeOrThrow()._applyWallFaceBatch()}_commitRoom(){return this._editorRuntimeOrThrow()._commitRoom()}_cancelPath(){return this._editorRuntimeOrThrow()._cancelPath()}_resumeLastDraft(){return this._editorRuntimeOrThrow()._resumeLastDraft()}_roomDialogCancel(){return this._editorRuntimeOrThrow()._roomDialogCancel()}get _freeAreas(){const e=new Set;for(const t of this._serverCfg?.spaces||[])for(const i of t.rooms||[])i.area&&e.add(i.area);for(const t of this._wallFaceBatch?.decisions||[])t.create&&t.area&&e.add(t.area);return Object.values(this.hass?.areas||{}).filter(t=>!e.has(t.area_id)).sort((e,t)=>(e.name||"").localeCompare(t.name||""))}_openDeviceInbox(){return this._editorRuntimeOrThrow()._openDeviceInbox()}_closeMarkerDialog(){return this._editorRuntimeOrThrow()._closeMarkerDialog()}_deviceInboxCandidates(e){return this._editorRuntimeOrThrow()._deviceInboxCandidates(e)}_deviceInboxRows(){return this._editorRuntimeOrThrow()._deviceInboxRows()}_deviceForInboxRow(e){return this._editorRuntimeOrThrow()._deviceForInboxRow(e)}_openInboxMarker(e,t=!1){return this._editorRuntimeOrThrow()._openInboxMarker(e,t)}async _setInboxHidden(e,t){return this._editorRuntimeOrThrow()._setInboxHidden(e,t)}_findInboxDevice(e){return this._editorRuntimeOrThrow()._findInboxDevice(e)}_deviceInboxTabKey(e){return this._editorRuntimeOrThrow()._deviceInboxTabKey(e)}_openMarkerDialog(e){if(this._editorRuntime)return this._editorRuntime._openMarkerDialog(e);this._ensureEditorRuntime().then(t=>{t&&this._openMarkerDialog(e)})}_runCandidates(){return this._editorRuntimeOrThrow()._runCandidates()}_bindingCandidates(){return this._editorRuntimeOrThrow()._bindingCandidates()}_physicalBodiesR(e=this._spaceModel()){if(!e)return[];const t=`${e.id}|${this._cfgEpoch}|${this._cellCm}|${this._gridPitch}`;if(this._physicalBodiesCache?.key===t)return this._physicalBodiesCache.all;const i=oa(e,this._cellCm,this._gridPitch,2e-4*this._gridPitch,this._partitionOpeningCuts(e));return this._physicalBodiesCache={key:t,...i},i.all}_rawPhysicalBodiesR(e=this._spaceModel()){if(!e)return[];this._physicalBodiesR(e);const t=this._physicalBodiesCache;return t?[...t.drafts,...t.partitions,...t.columns]:[]}_cleanFloor(e,t,i=this._spaceModel()){if(!i)return{floor:t,geom:null,path:"",area:da([[[...t,t[0]]]])};const n=e.id||`#${i.rooms.indexOf(e)}`,r=`${i.id}|${this._cfgEpoch}|${n}`;if(!this._resize?.preview){const e=qf(this._cleanFloorCache,r);if(e.hit)return e.value}const o=t.map(e=>e[0]),s=t.map(e=>e[1]),a=[Math.min(...o),Math.min(...s),Math.max(...o),Math.max(...s)],l=this._physicalBodiesR(i).filter(e=>{const t=e.map(e=>e[0]),i=e.map(e=>e[1]);return Math.max(...t)>=a[0]&&Math.min(...t)<=a[2]&&Math.max(...i)>=a[1]&&Math.min(...i)<=a[3]}),c=l.length?ha(t,l):null,h={floor:t,geom:c,path:c?Qs(c):"",area:da(c||[[[...t,t[0]]]])};return this._resize?.preview||Wf(this._cleanFloorCache,r,h,600),h}_autoIconForBinding(e){if("virtual"===e)return"mdi:map-marker";const[t,i]=e.split(":");if(!i)return"";const n=this._fullRegistryHass,r=this._bindingStatus(e),o="active"===r.kind?r.enabledEntityIds:r.allEntityIds;if("device"===t){const e=n.devices?.[i];if(!e)return"mdi:help-circle";const t=o;return t.some(e=>e.startsWith("lock."))?"mdi:lock":Xh(n,e.name_by_user||e.name||"",e.model,t,this._iconRules)}if("entity"===t){const e=n.entities?.[i],t=this.hass.states?.[i],r=e?.name||t?.attributes?.friendly_name||i;return i.startsWith("lock.")?"mdi:lock":Xh(n,r,"",[i],this._iconRules)}return""}_allRoomsFlat(){const e=[];for(const t of this._serverCfg?.spaces||[])for(const i of t.rooms||[])i.area?e.push({value:t.id+"#"+i.area,label:(t.title||t.id)+" · "+i.name}):i.id&&e.push({value:t.id+"#@"+i.id,label:(t.title||t.id)+" · "+i.name+" · "+this._t("marker.subarea")});return e}_errText(e){if(!e)return this._t("err.unknown");if("string"==typeof e)return e;if("invalid_passage_fields"===e.code){const t=String(e.message||e.error||"");let i="",n=[];try{const e=JSON.parse(t);i=String(e.space??""),n=Array.isArray(e.fields)?e.fields.map(String):[]}catch{const e=t.match(/space=([^;]*);\s*opening=([^;]*);\s*fields=([^;]*)/);e&&(i=e[1],n=e[3].split(",").filter(Boolean))}if(i||n.length){const e=this._serverCfg?.spaces?.find(e=>String(e.id)===i),t={contact:"opening.contact_label",lock:"opening.lock_label",invert:"opening.invert",flip_h:"opening.flip_h",flip_v:"opening.flip_v"},r=n.map(e=>t[e]?this._t(t[e]):e).join(", ");return this._t("opening.invalid_passage_fields",{room:e?.title||i,fields:r})}}if("invalid_partition_opening_jamb_margin"===e.code){const t=String(e.message||e.error||"");let i=NaN;try{i=Number(JSON.parse(t).margin_cm)}catch{const e=t.match(/margin_cm=([^;}"]*)/);i=e?Number(e[1]):NaN}if(Number.isFinite(i))return this._t("opening.partition_jamb_margin",{distance:Et(i,this._imperial)})}if(null!=e.code){const t=`backup.error.${e.code}`,i=this._t(t);return e.message&&console.warn("[houseplan] backend error",e.code,e.message),i!==t?i:this._t("err.code",{code:e.code})}if(e.message)return e.message;if(e.error)return e.error;try{return JSON.stringify(e)}catch{return String(e)}}_backupErrorText(e){return this._editorRuntimeOrThrow()._backupErrorText(e)}async _pickMarkerFiles(e){return this._editorRuntimeOrThrow()._pickMarkerFiles(e)}_removeMarkerPdf(e){return this._editorRuntimeOrThrow()._removeMarkerPdf(e)}_markerLightFields(e){return this._editorRuntimeOrThrow()._markerLightFields(e)}_markerTapActionFields(e){return this._editorRuntimeOrThrow()._markerTapActionFields(e)}_markerToggleEntityFields(e){return this._editorRuntimeOrThrow()._markerToggleEntityFields(e)}async _saveMarker(){return this._editorRuntimeOrThrow()._saveMarker()}async _deleteMarker(){return this._editorRuntimeOrThrow()._deleteMarker()}_normPos(e,t,i){return{s:e,x:t/tg,y:i/tg}}_spaceDialogUsesOnboardingRuntime(e){return"create"===e&&!this._editorRuntime&&(!!this._onboardingRuntime||0===(this._serverCfg?.spaces.length||0)||this._importTotal>0||this._importQueue.length>0)}_spaceRuntimeOrThrow(){if(!this._onboardingRuntime)throw new Error("Houseplan onboarding runtime is not loaded");return this._onboardingRuntime}_openSpaceDialog(e,t){return this._spaceDialogUsesOnboardingRuntime(e)?this._onboardingRuntime?void this._onboardingRuntime._openSpaceDialog(e,t):void this._ensureOnboardingRuntime().then(i=>{i&&this._spaceRuntimeOrThrow()._openSpaceDialog(e,t)}):this._editorRuntime?this._editorRuntime._openSpaceDialog(e,t):void this._ensureEditorRuntime().then(i=>{i&&this._openSpaceDialog(e,t)})}async _pickPlanFile(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._pickPlanFile(e):this._editorRuntimeOrThrow()._pickPlanFile(e)}_useServerPlan(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._useServerPlan(e):this._editorRuntimeOrThrow()._useServerPlan(e)}async _readPlanAspect(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._readPlanAspect(e):this._editorRuntimeOrThrow()._readPlanAspect(e)}async _deleteServerPlan(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._deleteServerPlan(e):this._editorRuntimeOrThrow()._deleteServerPlan(e)}_renderServerPlans(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime(e.mode)?this._onboardingRuntime._renderServerPlans(e):this._editorRuntimeOrThrow()._renderServerPlans(e)}async _saveSpaceDialog(){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._saveSpaceDialog():this._editorRuntimeOrThrow()._saveSpaceDialog()}async _deleteSpace(){return this._editorRuntimeOrThrow()._deleteSpace()}async _saveConfigNow(){return this._editorRuntimeOrThrow()._saveConfigNow()}_startImport(){return this._onboardingRuntime?this._onboardingRuntime._startImport():this._editorRuntimeOrThrow()._startImport()}_openNextImport(){return this._onboardingRuntime?this._onboardingRuntime._openNextImport():this._editorRuntimeOrThrow()._openNextImport()}_skipImport(){return this._onboardingRuntime?this._onboardingRuntime._skipImport():this._editorRuntimeOrThrow()._skipImport()}_renderImportDialog(){return this._onboardingRuntime?this._onboardingRuntime._renderImportDialog():this._editorRuntimeOrThrow()._renderImportDialog()}_sunGlobal(){const e=this._settingsDialog;return e?{...this._settings,north_deg:e.northDeg??void 0,bg_mode:e.bgMode,sun_rays:e.sunRays}:this._settings}_sunSpace(){const e=this._spaceDialog,t=this._curSpaceCfg?.settings||{};return e&&"edit"===e.mode&&e.spaceId===this._space?{...t,north_deg:e.northDeg??void 0,bg_mode:e.bgMode??void 0,sun_rays:e.sunRays??void 0}:t}_effNorth(){return Zn(this._sunGlobal(),this._sunSpace())}_effBgMode(){return Jn(this._sunGlobal(),this._sunSpace())}_dayCycleState(e=new Date){return(this._modeTransitionVisual?.viewWeight??("view"===this._mode?1:0))<=0||"daynight"!==this._effBgMode()?null:Bn(this._renderPlanHass,e)}_syncDayCycleClock(){const e=this._dayCycleState();this._dayCycleClockKey=e?qn(e):"";const t="clock"===e?.source&&"hidden"!==this.ownerDocument.visibilityState&&this.isConnected;t&&!this._dayCycleTimer?this._dayCycleTimer=window.setInterval(this._dayCycleTick,3e4):!t&&this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_dayCycleVisibility(e){"hidden"!==e.kind?(this._dayCycleTick(),this._syncDayCycleClock()):this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_effSunRays(){return Qn(this._sunGlobal(),this._sunSpace())}_sunNow(){return null!==this._effNorth()?er(this._renderPlanHass):null}_renderSunRays(e){const t=j``,i=this._modeTransitionVisual?.viewWeight??0;if(this._editing&&i<=0||!this._effSunRays())return this._sunFadeReset(),t;const n=this._effNorth(),r=null!==n?er(this._renderPlanHass):null;if(!r||r.elevation<=0)return this._sunFadeReset(),t;if(o=r.elevation,Number(o)>=3)this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunOut=!1,this._sunShown=!0;else{if(!this._sunShown)return t;this._sunOut||(this._sunOut=!0,this._sunOutTimer=window.setTimeout(()=>{this._sunOutTimer=0,this._sunShown=!1,this._sunOut=!1,this.requestUpdate()},2e3))}var o;const s=this._zeroWalls(),a=s.barriers.map(e=>e.join(",")).join(";"),l=`${e.id}|${r.azimuth}|${r.elevation}|${n}|${this._cfgEpoch}|${s.style}|${a}`;if(!this._sunRaysCache||this._sunRaysCache.key!==l){const t=e.rooms.map(e=>({id:e.id||"",poly:Nt(e)})).filter(e=>!!e.id&&!!e.poly),i=this._openingsR.filter(e=>"window"===e.type&&"partition"!==e.host?.kind).map(e=>({id:e.id,x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),o=this._spaceWalls,a=this._openCuts(),c=this._openingWallIndexFor(e,a).value,h={},d={},u=this._wallUnionGeometry()?.roomGeom;if(o.length){for(const i of t){const t=this._innerRoomContour(e,i.id,a,u);t&&(h[i.id]=t)}for(const e of i){const t=qs(c,{x:e.x,y:e.y,angle:e.angle,length:e.length});t.cm>0&&(d[e.id]=po(t.cm,this._cellCm,this._gridPitch))}}let p=Yn(t,i,r.azimuth,r.elevation,n,o.length?h:void 0,o.length?d:void 0);const m=[...this._physicalBodiesR(e),...s.barriers.map(e=>[[e[0],e[1]],[e[2],e[3]]])];m.length&&(p=p.map(e=>{const t=function(e,t,i){return i>0?e.map(e=>function(e){const t=[...e].sort((e,t)=>e[0]-t[0]||e[1]-t[1]);if(t.length<=2)return t;const i=(e,t,i)=>(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0]),n=[];for(const e of t){for(;n.length>=2&&i(n[n.length-2],n[n.length-1],e)<=0;)n.pop();n.push(e)}const r=[];for(let e=t.length-1;e>=0;e--){const n=t[e];for(;r.length>=2&&i(r[r.length-2],r[r.length-1],n)<=0;)r.pop();r.push(n)}return n.slice(0,-1).concat(r.slice(0,-1))}([...e,...e.map(e=>[e[0]+t[0]*i,e[1]+t[1]*i])])).filter(e=>e.length>=3):e}(m,e.dir,e.len),i=e.polys.map(e=>ha(e,t));return{...e,paths:i.map(Qs).filter(Boolean),polys:i.flatMap(pa)}}).filter(e=>e.paths?.length||e.polys.length)),this._sunRaysCache={key:l,rays:p,rims:p.map(e=>function(e,t=1e-4){const[i,n]=e.dir,r=-n,o=i,s=[];for(const a of[e.a,e.b]){const l=[];for(const s of e.polys)for(let e=0;e<s.length;e++){const c=s[e],h=s[(e+1)%s.length];if(Math.abs((c[0]-a[0])*r+(c[1]-a[1])*o)>t)continue;if(Math.abs((h[0]-a[0])*r+(h[1]-a[1])*o)>t)continue;const d=(c[0]-a[0])*i+(c[1]-a[1])*n,u=(h[0]-a[0])*i+(h[1]-a[1])*n;Math.abs(u-d)<=t||l.push(d<u?[d,u]:[u,d])}l.sort((e,t)=>e[0]-t[0]);const c=[];for(const e of l){const i=c[c.length-1];i&&e[0]<=i[1]+t?i[1]=Math.max(i[1],e[1]):c.push([e[0],e[1]])}for(const[e,t]of c)s.push([[a[0]+i*e,a[1]+n*e],[a[0]+i*t,a[1]+n*t]])}return s}(e))}}const c=this._sunRaysCache.rays,h=this._sunRaysCache.rims;if(!c.length)return t;const d=(u=function(e){const t=Math.min(90,Math.max(-90,Number(e)||0));let i=Wn[Wn.length-1][1];for(let e=1;e<Wn.length;e++){const[n,r]=Wn[e-1],[o,s]=Wn[e];if(t<=o){i=Zi(r,s,(t-n)/(o-n));break}}return{bg:i,planDim:.1*jn((10-t)/16),warmth:t<0?1:jn(1-t/10)}}(r.elevation).warmth,Zi("#ffe9c2","#ff9a45",jn(u)));var u;const p=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]],m=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]];return j`<defs>
        ${c.map((e,t)=>{const i=(e.a[0]+e.b[0])/2,n=(e.a[1]+e.b[1])/2,r=i+e.normal[0]*e.depth,o=n+e.normal[1]*e.depth;return j`<linearGradient id="hp-sun-${t}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${n}" x2="${r}" y2="${o}">
            ${p.map(([e,t])=>j`<stop offset="${(100*e).toFixed(1)}%"
              stop-color="${d}" stop-opacity="${(.3*t).toFixed(4)}"></stop>`)}
          </linearGradient>
          <linearGradient id="hp-sunrim-${t}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${n}" x2="${r}" y2="${o}">
            ${m.map(([e,t])=>j`<stop offset="${(100*e).toFixed(1)}%"
              stop-color="${"#000000"}" stop-opacity="${(.42*t).toFixed(4)}"></stop>`)}
          </linearGradient>`})}
      </defs>
      <g class="sunlayer hp-view-only-layer ${this._sunOut?"out":""}"
        opacity="${this._modeTransitionVisual?.viewWeight??1}">
        ${c.map((e,t)=>e.paths?.length?e.paths.map(e=>j`<path d=${e} fill-rule="evenodd" fill="url(#hp-sun-${t})"></path>`):e.polys.map(e=>j`<polygon
              points="${e.map(e=>e[0]+","+e[1]).join(" ")}" fill="url(#hp-sun-${t})"></polygon>`))}
        ${c.map((e,t)=>(h[t]||[]).map(e=>j`<line class="sunrim"
          x1="${e[0][0]}" y1="${e[0][1]}" x2="${e[1][0]}" y2="${e[1][1]}"
          stroke="url(#hp-sunrim-${t})" stroke-width="1"
          vector-effect="non-scaling-stroke"></line>`))}
      </g>`}_sunFadeReset(){this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunShown=!1,this._sunOut=!1}_compassPoint(e){const t=e.currentTarget.getBoundingClientRect(),i=e.clientX-(t.left+t.width/2),n=e.clientY-(t.top+t.height/2);if(Math.hypot(i,n)<5)return;let r=Math.round(180*Math.atan2(i,-n)/Math.PI);e.shiftKey&&(r=15*Math.round(r/15)),r=(r%360+360)%360,this._settingsDialog={...this._settingsDialog,northDeg:r}}_renderCompass(){const e=this._settingsDialog.northDeg;return W`<svg class="compass ${null===e?"unset":""}" viewBox="-60 -60 120 120"
      @pointerdown=${e=>{e.currentTarget.setPointerCapture(e.pointerId),this._compassDrag=!0,this._compassPoint(e)}}
      @pointermove=${e=>{this._compassDrag&&this._compassPoint(e)}}
      @pointerup=${()=>this._compassDrag=!1}
      @pointercancel=${()=>this._compassDrag=!1}>
      <circle class="cring" r="50"></circle>
      ${[0,45,90,135,180,225,270,315].map(e=>j`<line class="ctick ${e%90?"minor":""}" x1="0" y1="-50" x2="0" y2="${e%90?-46:-43}"
          transform="rotate(${e})"></line>`)}
      <g class="cneedle" transform="rotate(${e??0})">
        <line x1="0" y1="34" x2="0" y2="-28"></line>
        <path d="M -7 -24 L 0 -42 L 7 -24 Z"></path>
        <text x="0" y="-12" text-anchor="middle">${this._t("gs.north_letter")}</text>
      </g>
      <text class="cdeg" x="0" y="26" text-anchor="middle">${null===e?"—":e+"°"}</text>
    </svg>`}_stageBg(e){const t=this._settingsDialog,i=this._spaceDialog,n=t?t.bgColor||"":Gi(this._settings,{bgColor:null});return(i&&"edit"===i.mode&&i.spaceId===this._space?i.bgColor||"":e.bgColor||"")||n}_stageBgHex(){const e=this._stageEl;if(e){const t=getComputedStyle(e).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(t)return"#"+t.slice(1,4).map(e=>(+e).toString(16).padStart(2,"0")).join("")}return"#111111"}_preflightDiagnostics(e,t){return this._editorRuntimeOrThrow()._preflightDiagnostics(e,t)}_reportPreflightFailure(e,t){return this._editorRuntimeOrThrow()._reportPreflightFailure(e,t)}_preflightVersionsDiffer(){return this._editorRuntimeOrThrow()._preflightVersionsDiffer()}async _copyPreflightDiagnostics(){return this._editorRuntimeOrThrow()._copyPreflightDiagnostics()}_checkOptimizeGeometry(e){return this._editorRuntimeOrThrow()._checkOptimizeGeometryImpl(e)}_checkSpacePhysicalGeometry(e,t,i){return this._editorRuntimeOrThrow()._checkSpacePhysicalGeometryImpl(e,t,i)}_optimizeReferenceContext(e){return this._editorRuntimeOrThrow()._optimizeReferenceContext(e)}_previewAlignDialog(e){return this._editorRuntimeOrThrow()._previewAlignDialog(e)}async _runAlignToGrid(){return this._editorRuntimeOrThrow()._runAlignToGrid()}async _undoPlanOptimization(){return this._editorRuntimeOrThrow()._undoPlanOptimization()}async _runBackupExport(){return this._editorRuntimeOrThrow()._runBackupExport()}async _pickBackupImport(e){return this._editorRuntimeOrThrow()._pickBackupImport(e)}async _setBackupDuplicatePolicy(e){return this._editorRuntimeOrThrow()._setBackupDuplicatePolicy(e)}async _applyBackupImport(){return this._editorRuntimeOrThrow()._applyBackupImport()}_renderBackupExportDialog(){return this._editorRuntimeOrThrow()._renderBackupExportDialog()}_renderBackupImportDialog(){return this._editorRuntimeOrThrow()._renderBackupImportDialog()}_setFillColor(e,t){return this._editorRuntimeOrThrow()._setFillColor(e,t)}async _saveSettingsDialog(){return this._editorRuntimeOrThrow()._saveSettingsDialog()}_boolInput(e,t,i=!1){return this._editorRuntimeOrThrow()._boolInput(e,t,i)}_rangeInput(e,t,i,n,r,o=!1,s){return this._editorRuntimeOrThrow()._rangeInput(e,t,i,n,r,o,s)}_renderColorRow(e,t){return this._editorRuntimeOrThrow()._renderColorRow(e,t)}get _glowRadiusCm(){const e=Number(this._settings.glow_radius_cm);return Number.isFinite(e)&&e>0?e:300}get _imperial(){return"mi"===this.hass?.config?.unit_system?.length}get _glowRadiusPlaceholder(){const e=this._glowRadiusCm;return this._imperial?String(Math.round(e/30.48*10)/10):String(e/100)}_glowTransition(e,t){return zm(this._glowRuntimeState,this._glowRuntimeHost,e,t)}_forgetGlowSource(e){Am(this._glowRuntimeState,this._glowRuntimeHost,e)}_forgetGlowSpace(e){Pm(this._glowRuntimeState,this._glowRuntimeHost,e)}_warnGlowGeometryFallback(e,t,i,n){Im(this._glowRuntimeState,e,t,i,n)}_lightBarriers(e,t){const i=Mm({rawSpaceConfig:this._curSpaceCfg,space:e,openings:this._openingsR,cellCm:this._cellCm,gridPitch:this._gridPitch,openingAmount:e=>this._openingAmt(e)}),n=`${e.id}|${i.fingerprint}`,r=qf(this._lightBarrierPool,n);if(r.hit)return this._lightBarrierCache=r.value,r.value.value;const o=Cm({space:e,revision:i,walls:this._spaceWalls,zeroWalls:this._zeroWalls(),wallKeyPitch:this._wallKeyPitch,cellCm:this._cellCm,gridPitch:this._gridPitch,coordScale:tg,sharedWallGeometry:this._wallUnionGeometry(),physicalBodies:(t,i)=>(this._lightPhysicalBodiesCache?.key!==i&&(this._lightPhysicalBodiesCache={key:i,all:oa(e,this._cellCm,this._gridPitch,2e-4*this._gridPitch,t).all}),this._lightPhysicalBodiesCache.all)}),s={key:n,value:o};return Wf(this._lightBarrierPool,n,s,8),this._lightBarrierCache=s,o}_renderGlowLayer(e,t){const i=this._fillColors,n=this._glowRadiusCm/this._cellCm*this._gridPitch,r=e.rooms.map(e=>({r:e,poly:Nt(e)})).filter(e=>!!e.poly),o=r.filter(({r:e})=>bn(t.glow,e));if(!o.length)return this._forgetGlowSpace(e.id),j``;const s=this._lightBarriers(e,r),a=Sm({hass:this._renderPlanHass,devices:this._renderDevices,virtualLights:this._virtualLights,spaceId:e.id,defaultColor:i.glow_light.c,paletteAlpha:i.glow_light.a,defaultRadiusUnits:n,cellCm:this._cellCm,gridPitch:this._gridPitch,position:e=>this._pos(e)}),l=[],c=new Set;for(const t of a){const{key:i,pos:n}=t;if(c.add(i),Rm(n,s)){this._forgetGlowSource(i);continue}const o=this._glowTransition(i,!!t.appearance);if(!o)continue;t.appearance&&this._glowLastAppearance.set(i,t.appearance);const a=this._glowLastAppearance.get(i);if(!a)continue;let h=null;const d=`${e.id}|${s.fingerprint}|${n.x.toFixed(4)},${n.y.toFixed(4)}|${t.radius.toFixed(4)}`,u=xm(this._glowRuntimeState,d);u.hit?h=u.value:(h=Tm({spaceId:e.id,source:n,radius:t.radius,scene:s,polygons:r.map(({r:e,poly:t})=>({room:e,poly:t})),onBoundsFailure:(t,i)=>this._warnGlowGeometryFallback(e.id,s.fingerprint,t,i)}),$m(this._glowRuntimeState,d,h)),l.push({key:i,sourceEid:t.sourceEid,domId:o.domId,entering:o.entering,leaving:o.leaving,pos:n,c:a.c,alpha:a.alpha,geometry:h,r:t.radius})}if(Om(this._glowRuntimeState,this._glowRuntimeHost,e.id,c),!l.length)return j``;const h=this._spaceWalls,d=o.length===r.length?[]:this._openCuts(),u=this._wallUnionGeometry()?.roomGeom,p=o.length===r.length?null:o.map(({r:t,poly:i})=>{const n=h.length&&t.id&&this._innerRoomContour(e,t.id,d,u)||i,o=this._cleanFloor(t,n,e).path,s=ci(n,r.filter(e=>e.r!==t).map(e=>e.poly)),a=e=>"M "+e.map(e=>e[0]+" "+e[1]).join(" L ")+" Z";return[o||a(n),...s.map(a)].join(" ")}),m=this._viewOr(this._baseVb()),_=this._stageEl?.clientWidth&&m.w?this._stageEl.clientWidth/m.w:1,f=!this._pinchStart&&!this._panStart&&!this._cameraTransition.active,g=Em(this._glowRuntimeState,_,f);return Hm({spots:l,enabledClip:p,feather:g.feather,featherEnabled:g.enabled,screenBlend:this._glowScreenBlend})}_renderAlignDialog(){return this._editorRuntimeOrThrow()._renderAlignDialog()}_renderSettingsDialog(){return this._editorRuntimeOrThrow()._renderSettingsDialog()}_renderSupportDialog(){return this._editorRuntimeOrThrow()._renderSupportDialog()}_rulesSet(e){return this._editorRuntimeOrThrow()._rulesSet(e)}async _saveRules(){return this._editorRuntimeOrThrow()._saveRules()}_renderRulesDialog(){return this._editorRuntimeOrThrow()._renderRulesDialog()}_saveKioskScale(e){this._kioskScale={...this._kioskScale,...e};try{localStorage.setItem(Jf,JSON.stringify(this._kioskScale))}catch{}this.requestUpdate()}_renderKioskDialog(){const e=this._kioskScale,t=(t,i)=>{const n=Math.round(100*e[t]);return W`<label>${i}</label>
        <div class="colorrow">
          <input type="range" min="50" max="300" step="5" .value=${String(n)}
            @input=${e=>{const i=Number(e.target.value);Number.isFinite(i)&&this._saveKioskScale({[t]:i/100})}} aria-label=${i} />
          <span class="opv">${n}%</span>
        </div>`};return W`<hp-dialog .hass=${this.hass} .title=${this._t("kiosk.title")} icon="mdi:tablet"
      dismiss-on-scrim @hp-close=${()=>this._kioskDialog=!1}>
        <div class="body">
          <div class="rhint">${this._t("kiosk.hint")}</div>
          ${t("icon",this._t("kiosk.icon_scale"))}
          ${t("font",this._t("kiosk.font_scale"))}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>this._saveKioskScale({icon:1,font:1})}>${this._t("gs.reset")}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._kioskDialog=!1}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_fixedFloorValue(e){if("string"==typeof e)return e||"''";try{const t=JSON.stringify(e);return(void 0===t?String(e):t).slice(0,160)}catch{return String(e).slice(0,160)}}_renderDangerConfirm(){return this._dangerConfirm?W`<hp-confirm .hass=${this.hass}
        .request=${this._dangerConfirm.request}
        .token=${this._dangerConfirm.token}
        @hp-confirm-decision=${this._onDangerConfirmDecision}>
      </hp-confirm>`:V}_renderRoot(e){return W`${e}${this._renderDangerConfirm()}`}render(){const e=this._renderBody();return e===V?e:this._renderRoot(e)}_renderBody(){if(!this._config||!this.hass)return V;const e=this._syncDangerConfirmLocaleGate();if("cold"===e)return su();if("warm"===e)return U;const t=!!this._importDialog||!(!this._spaceDialog||!this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)),i="view"!==this._mode||!!(this._roomDialog||this._mergeDialog||this._openingDialog||this._physicalDialog||this._partitionDeleteDialog||this._roomDeleteDialog||this._decorTextDialog||this._decorShapeDialog||this._backdropDialog||this._decorEraseConfirm||this._spaceDialog&&!this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)||this._deviceInbox||this._markerDialog||this._rulesDialog||this._settingsDialog||this._supportDialog||this._alignDialog||this._backupExportDialog||this._backupImportDialog||this._kioskDialog||this._vacFit||this._vacCalConfirm);t&&!this._onboardingRuntime&&this._ensureOnboardingRuntime(),i&&!this._editorRuntime&&this._ensureEditorRuntime();const n=this._model,r=this.houseplanDiagnostics(),o=this._fixedFloorState(n);if("pending"===o.kind)return W`<ha-card data-fixed-floor-state="pending">
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty" role="status" aria-live="polite">
          <ha-icon icon="mdi:loading" class="big fixedfloor-loading"></ha-icon>
          <p>${this._t("fixed_floor.loading")}</p>
        </div>
      </ha-card>`;if("invalid"===o.kind)return W`<ha-card
        data-fixed-floor-state="invalid"
        data-fixed-floor-reason=${o.reason}>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty fixedfloor-error" role="alert" aria-live="assertive">
          <ha-icon icon="mdi:alert-circle-outline" class="big"></ha-icon>
          <p><b>${this._t("fixed_floor.invalid_title")}</b></p>
          <p>${this._t("fixed_floor.invalid_body",{value:this._fixedFloorValue(o.value)})}</p>
        </div>
      </ha-card>`;if(!n.length)return W`<ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint||V}
        data-recovery-reason=${(this._continuity.overlayVisible||"recovery-error"===this._continuity.state)&&this._continuity.recoveryReason||V}
        data-ha-registry-access=${r.registry.access}
        data-ha-disabled-bindings=${r.bindings.ha_disabled}
        data-ha-unverified-bindings=${r.bindings.unverified}>
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
        ${this._spaceDialog&&(this._onboardingRuntime||this._editorRuntime)?this._renderSpaceDialog():V}
        ${this._importDialog&&this._onboardingRuntime?this._renderImportDialog():V}
        ${this._toast?W`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>`:V}
      </ha-card>`;const s=this._spaceModel();if(!s)return V;const a="valid"===o.kind?[s]:n,l=s.vb,c=this._effectiveProjection();this._renderProjection=c,this._labs.active.length&&function(e){nf||cf(e);const t=tf,i=t.active.join(",");if(!i||i===of)return;of=i;const n=new Map(V_.map(e=>[e.id,e])),r=t.active.map(e=>{const t=n.get(e);return`${e} (#${t.issue}, expires ${t.expires})`}).join(", ");console.info(`HOUSEPLAN LABS: ${r}`)}(Nf);const h="iso"===c,d="devices"===this._mode&&this._showAll,u=this._renderDevices.filter(e=>e.space===s.id&&(!e.hidden||d)),p=this._renderDeviceSnapshot,m=this._spaceDisplayForRender(),_=h?this._isoDecorationLayers(m):null,f=_?this._isoOpeningPanels(_):[],g=this._resolvedRoomFills(s,m),v=this._resolvedGlowBase(s,m,g),y=m.showLqi??this._config.show_signal??!0,b=this._config.icon_size??2.5,w=b>8?2.5:b,k=pp(w),x=this._viewOr(this._baseVb()),$=this._floorView(x),S=this._editing?"":this._stageBg(m),M=this._opMeasureView,C=this._decorMeasure,T=this._bdLive,R=this._editorRuntime?._furnLive()??null,D="view"===this._mode?this._editorChromeMode:this._mode,z=this._roomHoverPaths(s),A=s.bg?this._display(s.bg.href):"",P=this._continuity.overlayVisible||"recovery-error"===this._continuity.state?this._continuity.recoveryReason:null,O=this._modeTransitionVisual,F=this._dayCycleState(),I=O?.viewWeight??("view"===this._mode?1:0),E=this._modeTransition.state?.from.presentedMode,H=!this._markup||!!O&&("view"===O.presentedMode||"devices"===O.presentedMode||"view"===E||"devices"===E),N=O?.stageColor||S,L=O?.sceneBrightness??1;return W`
      <ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint||V}
        data-device-snapshot-sequence=${p?.sourceSequence??V}
        data-recovery-reason=${P||V}
        data-ha-registry-access=${r.registry.access}
        data-ha-disabled-bindings=${r.bindings.ha_disabled}
        data-ha-unverified-bindings=${r.bindings.unverified}
        @pointerover=${e=>this._notePointer(e)}
        @pointerdown=${this._touchGestureGuard}
        @pointermove=${this._touchGestureGuard}
        @pointerup=${this._touchGestureGuard}
        @pointercancel=${this._touchGestureGuard}
        @lostpointercapture=${this._touchGestureGuard}
        @click=${this._touchGestureGuard}>
        <div class="hdr ${this._kiosk?"kioskhide":""}">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title||this._t("card.title")}
          </div>
          <div class="tabs" @pointermove=${e=>this._tabPointerMove(e)}>
            ${a.map(e=>W`<button
                data-hp="space-tab" data-id="${e.id}"
                class="tab ${this._space===e.id?"active":""}${this._tabDrag?.moved&&this._tabDrag.id===e.id?" dragging":""}${this._tabDrag?.moved&&this._tabDrag.targetId===e.id?` drop-${this._tabDrag.placement}`:""}"
                ?data-reorderable=${this._canReorderTabs}
                @pointerdown=${t=>this._tabPointerDown(t,e.id)}
                @pointerup=${e=>this._tabPointerUp(e)}
                @pointercancel=${()=>this._endTabDrag()}
                @click=${()=>this._tabClick(e.id)}
              >
                ${e.title}${this._norm&&this._canEdit?W`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t("title.configure_space")}
                      @click=${t=>{t.stopPropagation(),this._openSpaceDialog("edit",e.id)}}></ha-icon>`:V}
              </button>`)}
            ${""}
            ${!this._canEdit||this._kiosk||this._hasFixedFloor?V:W`<button class="tab tabadd" title=${this._t("title.add_space")}
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`}
          </div>
          ${this._canEdit?W`<div class="modes">
                ${[["plan","mdi:floor-plan"],["devices","mdi:tune-variant"],["decor","mdi:draw"]].map(([e,t])=>W`<button class="modetab ${this._mode===e?"active":""}"
                    data-editor-navigation=${e}
                    title=${this._t("mode."+e+"_tip")}
                    @click=${()=>this._setMode(e)}>
                    <ha-icon icon=${t}></ha-icon><span class="ml">${this._t("mode."+e)}</span>
                    ${this._mode===e?W`<ha-icon class="closex" icon="mdi:close" title=${this._t("title.close_editor")}
                          data-editor-navigation="view"
                          @click=${e=>{e.stopPropagation(),this._setMode("view")}}></ha-icon>`:V}
                  </button>`)}
              </div>`:V}
          <span class="count">${this._t("count.devices",{n:u.filter(e=>!e.hidden).length})}</span>
          <span class="spacer"></span>
          ${this._labsIso&&"view"===this._mode&&!this._kiosk?W`<button class="btn projection-toggle ${h?"on":""}"
                data-hp="projection-toggle" aria-pressed=${h?"true":"false"}
                aria-label=${this._t("view.volumetric")}
                title=${this._t(h?"view.flat":"view.volumetric")}
                @click=${()=>this._setProjection(h?"flat":"iso")}>
                <ha-icon icon=${h?"mdi:view-grid-outline":"mdi:cube-outline"}></ha-icon>
              </button>`:V}
          <div class="zoomctl">
            <button class="btn zb" @click=${()=>this._stepZoom(-1)} title=${this._t("title.zoom_out")}><ha-icon icon="mdi:minus"></ha-icon></button>
            ${""}
            <button class="btn zb" @click=${()=>this._fitAll()}
              title=${this._t("title.zoom_fit")}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._stepZoom(1)} title=${this._t("title.zoom_in")}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm&&this._canEdit?W`<button class="btn header-action" @click=${this._openSettingsDialog} title=${this._t("title.general_settings")}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>
              <button class="btn header-action support-button" @click=${this._openSupportDialog}
                title=${this._t("support.title")} aria-label=${this._t("support.title")}>
                <ha-icon icon="mdi:help-circle-outline"></ha-icon>
              </button>`:V}
        </div>
        ${this._canEdit&&!this._kiosk?W`<div class="editorchrome ${this._editing||this._modeTransitionBusy?"open":""}${this._modeTransitionBusy?" transitioning":""}"
              style=${O?`height:${O.editorChromeHeight}px;opacity:${O.editorWeight}`:V}
              aria-hidden=${this._editing?"false":"true"}
              ?inert=${!this._editing}>
              <div class="editorchrome-inner"
                style=${O?`opacity:${O.toolbarContentOpacity}`:V}>
                ${this._editorRuntime?"plan"===D?this._renderMarkupBar():"devices"===D?this._renderDevicesBar():this._renderDecorBar():V}
              </div>
            </div>`:V}
        </div>

        <div class="stage ${this._markup?"markup tool-"+this._tool+("split"!==this._tool||this._splitSel?"":" pickstage")+("wallthick"===this._tool&&this._wallThickHover?" wallhot":""):""} ${"decor"===this._mode?"dtool-"+this._decorTool:""} ${s.bg?"":"noplan"} mode-${this._mode}${this._bdMovable?" bdgrab":""}${this._bdDrag?" bdgrabbing":""}${F?` daycycle phase-${F.phase}`:""}${this._booting?" hpboot":""}${this._bootSoft?" hpsettle":""}${this._modeTransitionBusy?" mode-transition":""}"
          ?inert=${this._modeTransitionBusy}
          style="height:${O?`${O.stageHeight}px`:this._kiosk?"100dvh":`calc(100dvh - ${this._hdrH}px)`}${N?`;background:${N}`:""};--hp-cell-visual-scale:${va(this._cellCm)};--wall-fill:${this._fillColors.wall_fill.c};--wall-fill-op:${this._fillColors.wall_fill.a};--hp-mode-architecture-opacity:${O?O.architectureOpacity:"decor"===this._mode?.35:1};--hp-mode-view-weight:${O?.viewWeight??("view"===this._mode?1:0)};--hp-mode-editor-weight:${O?.editorWeight??("view"===this._mode?0:1)}${O?`;--hp-mode-paper:${O.paperColor}`:""}${F?`;${ir(F)}`:""}"
          @click=${e=>this._markupClick(e)}
          @wheel=${e=>this._onWheel(e)}
          @pointerdown=${e=>{this._notePointer(e),this._stagePointerDown(e)}}
          @pointermove=${e=>this._stagePointerMove(e)}
          @pointerleave=${e=>this._stagePointerLeave(e)}
          @pointerup=${e=>this._stagePointerUp(e)}
          @pointercancel=${e=>this._stagePointerCancel(e)}>
          ${nr(F,I)}
          ${this._editorRuntime?this._renderEditorSecondary():V}
          <div class="zoomwrap ${this._slide?"slide-"+this._slide:""}"
            ?inert=${this._continuity.overlayBlocksInteraction||this._modeTransitionBusy}
            style="${1!==L?`filter:brightness(${L.toFixed(3)})`:""}">
          ${h&&_?.structural?j`<svg class="iso-underlay-svg"
              viewBox="${x.x} ${x.y} ${x.w} ${x.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoUnderlay(_)}
            </svg>`:V}
          <svg class=${_?.structural?"plan-svg":V}
            viewBox=${_?.structural?`${x.x} ${x.y} ${x.w} ${x.h}`:`${$.x} ${$.y} ${$.w} ${$.h}`}
            preserveAspectRatio=${_?.structural||!h?"xMidYMid meet":"none"}>
            <g class=${_?.structural?"iso-floor-scene":V}
              transform=${_?.structural?mf():V}>
            ${""}
            ${this._wallHatchDefs(m.color)}${j`<g class="hp-paperg">${this._paperShapes(s.rooms).map(e=>"path"in e?j`<path class="hp-paper" d="${e.path}" fill-rule="evenodd" pointer-events="none"></path>`:"poly"in e?j`<polygon class="hp-paper" points="${e.poly}" pointer-events="none"></polygon>`:j`<rect class="hp-paper" x="${e.rect.x}" y="${e.rect.y}" width="${e.rect.w}" height="${e.rect.h}" rx="${e.rect.rx}" pointer-events="none"></rect>`)}</g>`}
            ${this._editing?this._renderMarkupDefs(l):V}
            ${""}
            ${this._editing&&!this._markup&&this._gridLevels()?j`<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:V}
            ${s.bg&&A?j`<image class="hp-backdrop" href="${A}" x="${s.bg.x}" y="${s.bg.y}" width="${s.bg.w}" height="${s.bg.h}"
                  opacity="${O?.backdropOpacity??("decor"===this._mode&&"backdrop"!==this._decorTool?.5:1)}"
                  @load=${()=>this._onBackdropLoaded(s.bg.href,A)}
                  transform=${s.bg.angle?`rotate(${s.bg.angle} ${s.bg.x+s.bg.w/2} ${s.bg.y+s.bg.h/2})`:V}
                  @dblclick=${e=>this._openBackdropDialog(e)}
                  preserveAspectRatio="none" />`:V}
            ${(()=>{const e=this._openCuts(),t=this._thickWallCuts(),i=this._wallUnionGeometry()?.roomGeom,n=new Map,r=e=>(n.has(e)||n.set(e,Nt(e)),n.get(e));return s.rooms.filter(e=>e.area||"view"===this._mode||this._markup||m.showBorders).map(n=>{let o="room "+(s.bg?"overlay":"yard")+(this._markup?" outlined":"");!this._markup||n.id!==this._mergeSel&&n.id!==this._splitSel?.roomId||(o+=" picked");let a="";const l=yn(m.fill,n);if(!this._markup&&(m.showBorders||"none"!==l)){o+=" styled";const e=[];e.push(`--room-stroke:${m.color}`,`--room-stroke-op:${m.showBorders?m.opacity:0}`);const t=g.byRoom.get(n)||null;t?(o+=" filled",e.push(`--room-fill:${t.color}`,`--room-fill-op:${t.opacity}`)):e.push("--room-fill:transparent","--room-fill-op:0"),a=e.join(";")}let c;const h=e=>{this._roomTipEnabledForPointer(e)&&(void 0===c&&(c=this._roomArea(n)),this._showTip(e,n.name||this._t("room.unnamed"),c?this._t("tip.area",{value:c}):"",y?this._roomLqi(n.area):null,this._roomTemp(n),this._roomHum(n),!0))},d=e=>{this._notePointer(e),this._pointerModality.hoverEnabled&&(this._hoverRoom={space:s.id,room:n})},u=r(n),p=this._markup&&(n.id===this._mergeSel||n.id===this._splitSel?.roomId),_=u&&!p?e.filter(e=>{const t=[(e[0]+e[2])/2,(e[1]+e[3])/2];return u.some((e,i)=>Mn(t,[e[0],e[1],...u[(i+1)%u.length]])<=.08*this._gridPitch)}):[],f=p?[]:t,v=_.concat(f);v.length&&(o+=" noedge");const b=this._spaceWalls.length&&n.id&&u&&this._innerRoomContour(s,n.id,e,i)||u,w=b?ci(b,(k=n,s.rooms.filter(e=>e!==k).map(r).filter(Boolean))):[];var k;const x=e=>"M "+e.map(e=>e[0]+" "+e[1]).join(" L ")+" Z",$=b?this._cleanFloor(n,b,s).path:"",S=n.id||V,M=n.area||V,C=$&&b?j`<path class="${o}" style="${a}" fill-rule="evenodd"
                    data-hp="room" data-id=${S} data-area=${M}
                    d="${[$,...w.map(x)].join(" ")}"
                    @pointerenter=${d}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></path>`:w.length&&b?j`<path class="${o}" style="${a}" fill-rule="evenodd"
                    data-hp="room" data-id=${S} data-area=${M}
                    d="${[b,...w].map(x).join(" ")}"
                    @pointerenter=${d}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></path>`:b&&b!==u?j`<polygon class="${o}" style="${a}" points="${b.map(e=>e.join(",")).join(" ")}"
                     data-hp="room" data-id=${S} data-area=${M}
                    @pointerenter=${d}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></polygon>`:n.poly?j`<polygon class="${o}" style="${a}" points="${n.poly.map(e=>e.join(",")).join(" ")}"
                     data-hp="room" data-id=${S} data-area=${M}
                    @pointerenter=${d}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></polygon>`:j`<rect class="${o}" style="${a}"
                     data-hp="room" data-id=${S} data-area=${M}
                     x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${.03*Math.min(n.w,n.h)}"
                    @pointerenter=${d}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></rect>`,T=v.length&&u?mn(u,v,.02*this._gridPitch):null,R=T?j`<path class="room-outline ${this._markup?"outlined":""}"
                    d="${T.map(e=>`M ${e[0]} ${e[1]} L ${e[2]} ${e[3]}`).join(" ")}"
                    style=${this._markup?V:`stroke:${m.color};stroke-opacity:${m.showBorders?m.opacity:0}`}></path>`:V;return j`${C}${R}`})})()}
            ${this._renderRoomHoverFill(z)}
            ${this._renderOpeningTunnelFills(s,g)}
            ${this._renderGlowBaseRooms(s,v)}
            ${this._renderOpeningTunnelFills(s,v,"glow-base")}
            ${""}
            ${m.hideDecor&&"decor"!==this._mode?V:this._renderDecorLayer()}
            ${H?this._renderGlowLayer(s,m):V}
            ${this._renderSunRays(s)}
            ${this._editing?j`<g class="hp-editor-only-layer"
              opacity="${O?.editorWeight??1}">${this._renderAlignGuides()}</g>`:V}
            ${this._markup?j`<g class="hp-editor-only-layer"
              opacity="${O?.editorWeight??1}">${this._renderMarkupLayer(l)}</g>`:V}
            ${""}
            ${""}
            ${this._editing?V:this._renderZeroWalls(m)}
            ${this._renderWallBodies(m)}
            ${this._markup&&"resize"===this._tool?this._renderResizeMeasurements():V}
            ${this._renderRoomHoverOutline(z)}
            ${""}
            ${this._editing?this._renderZeroWalls(m):V}
            ${this._markup?j`<g class="hp-editor-only-layer"
              opacity="${O?.editorWeight??1}">${this._renderHiddenWallDiagnosticOverlay()}</g>`:V}
            ${this._markup?j`<g class="hp-editor-only-layer"
              opacity="${O?.editorWeight??1}">${this._renderOpeningPlacementPreview()}</g>`:V}
            ${M?this._renderOpeningDimensionGuides(M):V}
            ${M?.guide?this._renderOpeningCenterTick(M.guide):V}
            ${""}
            ${""}
            ${this._markup?j`<g class="hp-editor-only-layer"
              opacity="${O?.editorWeight??1}">${this._renderActiveChainInk()}</g>`:V}
            ${this._markup?j`<g class="hp-editor-only-layer"
              opacity="${O?.editorWeight??1}">${this._renderPlanSnapOverlay()}</g>`:V}
            ${m.hideOpenings&&!this._markup||_&&!_.floorSymbols?V:this._renderOpenings(m)}
            ${this._renderWallThickUi()}
            ${this._markup&&"resize"===this._tool?this._renderResizeLayer(x):V}
            ${""}
            ${this._renderBackdropFrame(x)}
            ${this._renderTextFrame(x)}
            </g>
          </svg>
          ${h&&_?.structural?j`<svg class="iso-shadows-svg"
              viewBox="${x.x} ${x.y} ${x.w} ${x.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoShadows(_,f)}
            </svg>
            <svg class="iso-walls-svg" viewBox="${x.x} ${x.y} ${x.w} ${x.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoWalls(_,f)}
            </svg>`:V}
          ${""}
          <div class="devlayer" style="--icon-size:${il(w,s,x.w,this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--device-base-size:${il(k,s,x.w,this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--rl-icon-size:${il(w,s,this._roomLabelReferenceViewWidth(x),this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--rl-font:${this._kiosk?this._kioskScale.font:1}">
            ${u.map(e=>this._renderDevice(e,x,y))}
            ${this._renderVacuums(u,x)}
            ${this._renderVacFit(x)}
            ${this._renderOpeningLocks(x)}
            ${m.showNames||this._markup?s.rooms.map(e=>this._renderRoomLabel(e,s,x,m)):V}
            ${this._markup?s.rooms.map(e=>this._renderRoomGear(e,s,x)):V}
          </div>
          ${this._measureAnchor?W`<div class="measurelayer">${this._renderMeasureLabel(x)}</div>`:V}
          ${this._resize?.liveLabels?W`<div class="measurelayer">${this._resize?.liveLabels?.map(e=>W`<div
                class="measurelabel ${"area"===e.kind?"rszarea":"rszlength"}"
                data-hp=${"area"===e.kind?"resize-area-label":"resize-length-label"}
                data-room=${"area"===e.kind?e.roomId:V}
                data-side=${"area"===e.kind?e.placement.side:V}
                style="left:${((e.x-x.x)/x.w*100).toFixed(2)}%;top:${((e.y-x.y)/x.h*100).toFixed(2)}%;${"area"===e.kind?`--rsz-label-x:${e.placement.offsetXPx.toFixed(2)}px;--rsz-label-y:${e.placement.offsetYPx.toFixed(2)}px;--rsz-label-tangent:${e.placement.tangentOffsetPx.toFixed(2)}px`:""}">${e.text}</div>`)}</div>`:V}
          ${M?W`<div class="measurelayer">${M.labels.map(e=>W`<div
                class="measurelabel opshoulder ${e.dimension?"opdimension":""}"
                data-dimension-source=${e.dimension?.source||V}
                data-dimension-room=${e.dimension?.roomId||V}
                style="left:${((e.x-x.x)/x.w*100).toFixed(2)}%;top:${((e.y-x.y)/x.h*100).toFixed(2)}%;${e.dimension?`--op-label-shift-x:${(12*e.dimension.labelNormal[0]).toFixed(2)}px;--op-label-shift-y:${(12*e.dimension.labelNormal[1]).toFixed(2)}px`:""}">${e.text}</div>`)}</div>`:V}
          ${this._wallDialog?W`<div class="measurelayer">${this._renderWallThickDialog()}</div>`:V}
          ${C?W`<div class="measurelayer"><div
                class="measurelabel dmeasure ${C.on45?"on45":""}"
                style="left:${((C.x-x.x)/x.w*100).toFixed(2)}%;top:${((C.y-x.y)/x.h*100).toFixed(2)}%">${C.text}</div></div>`:V}
          ${R?W`<div class="measurelayer">${R.map(e=>W`<div
                class="measurelabel furnmeasure"
                style="left:${((e.x-x.x)/x.w*100).toFixed(2)}%;top:${((e.y-x.y)/x.h*100).toFixed(2)}%">${e.text}</div>`)}</div>`:V}
          ${T?W`<div class="measurelayer"><div
                class="measurelabel bdmeasure"
                style="left:${((T.x-x.x)/x.w*100).toFixed(2)}%;top:${((T.y-x.y)/x.h*100).toFixed(2)}%">${T.text}</div></div>`:V}
          </div>
          ${this._zoom>1?W`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:V}
          ${this._renderFarHint()}
          ${this._renderHomeArrow()}
          ${this._renderEditorRuntimeLoading()}
          ${this._renderRecoveryOverlay()}
          ${this._booting||this._bootFading?W`<div class="bootveil ${this._booting?"":"off"}" aria-hidden="true">
                <svg class="boothouse" viewBox="0 0 24 24"><path d="${"M10,2V4.26L12,5.59V4H22V19H17V21H24V2H10M7.5,5L0,10V21H15V10L7.5,5M14,6V6.93L15.61,8H16V6H14M18,6V8H20V6H18M7.5,7.5L13,11V19H10V13H5V19H2V11L7.5,7.5M18,10V12H20V10H18M18,14V16H20V14H18Z"}"></path></svg>
              </div>`:V}
        </div>

        ${this._roomDialog&&this._editorRuntime?this._renderRoomDialog():V}
        ${this._mergeDialog&&this._editorRuntime?this._renderMergeDialog():V}
        ${this._openingDialog&&this._editorRuntime?this._renderOpeningDialog():V}
        ${this._physicalDialog&&this._editorRuntime?this._renderPhysicalDialog():V}
        ${this._partitionDeleteDialog&&this._editorRuntime?this._renderPartitionDeleteDialog():V}
        ${this._roomDeleteDialog&&this._editorRuntime?this._renderRoomDeleteDialog():V}
        ${this._openingInfo?this._renderOpeningInfoCard():V}
        ${this._decorTextDialog&&this._editorRuntime?this._renderDecorTextDialog():V}
        ${this._decorShapeDialog&&this._editorRuntime?this._renderDecorShapeDialog():V}
        ${this._backdropDialog&&this._editorRuntime?this._renderBackdropDialog():V}
        ${this._decorEraseConfirm&&this._editorRuntime?this._renderDecorEraseConfirm():V}
        ${this._spaceDialog&&(this._onboardingRuntime||this._editorRuntime)?this._renderSpaceDialog():V}
        ${this._deviceInbox&&this._editorRuntime?this._renderDeviceInbox():V}
        ${this._markerDialog&&this._editorRuntime?this._renderMarkerDialog():V}
        ${this._backdropGuard?this._editorRuntime?this._editorRuntime._renderBackdropGuard():this._onboardingRuntime?._renderBackdropGuard()??V:V}
        ${this._vacCalConfirm&&this._editorRuntime?W`<hp-dialog .hass=${this.hass}
          .title=${this._t("vac.residual_title")} icon="mdi:map-marker-alert-outline"
          dismiss-on-scrim @hp-close=${()=>this._vacCalConfirm=null}>
            <div class="body">
              <p>${this._t("vac.residual_message",{error:this._vacCalConfirm.error})}</p>
            </div>
            <div class="row" slot="footer">
              <button class="btn ghost" @click=${()=>this._vacCalConfirm=null}>${this._t("btn.cancel")}</button>
              <span class="spacer"></span>
              <button class="btn ghost" @click=${()=>this._vacApplyCalibrationProposal(!0)}>${this._t("vac.fit")}</button>
              <button class="btn on" @click=${()=>this._vacApplyCalibrationProposal(!1)}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t("vac.apply_proposal")}
              </button>
            </div>
        </hp-dialog>`:V}
        ${this._infoCard?this._renderInfoCard():V}
        ${this._rulesDialog&&this._editorRuntime?this._renderRulesDialog():V}
        ${this._settingsDialog&&this._editorRuntime?this._renderSettingsDialog():V}
        ${this._supportDialog&&this._editorRuntime?this._renderSupportDialog():V}
        ${this._alignDialog&&this._editorRuntime?this._renderAlignDialog():V}
        ${this._backupExportDialog&&this._editorRuntime?this._renderBackupExportDialog():V}
        ${this._backupImportDialog&&this._editorRuntime?this._renderBackupImportDialog():V}
        ${this._importDialog&&this._onboardingRuntime?this._renderImportDialog():V}
        ${this._tip?W`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?W`<span class="m">${this._tip.meta}</span>`:V}
              ${null!=this._tip.temp?W`<span class="m">${this._t("tip.temp_avg")} <b>${this._tip.temp}°</b></span>`:V}
              ${null!=this._tip.hum?W`<span class="m">${this._t("tip.hum_avg")} <b>${this._tip.hum}%</b></span>`:V}
              ${null!=this._tip.lqi?W`<span class="m">${this._t("tip.lqi")}
                    <b style="color:${Ot(this._tip.lqi)}">${this._tip.lqi}</b></span>`:V}
            </div>`:V}
        ${this._kiosk&&!this._hasFixedFloor&&this._kioskDots&&this._model.length>1?W`<div class="kioskdots">
              ${this._model.map(e=>W`<span class="kdot ${e.id===this._space?"on":""}"></span>`)}
            </div>`:V}
        ${this._kioskDialog?this._renderKioskDialog():V}
        ${this._vacFit?W`<div class="vaccalbar">
          <span>${this._t("vac.fit_hint")}</span>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({rot:(this._vacFit.p.rot+90)%360})}>${this._t("vac.fit_rotate")}</button>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({mir:!this._vacFit.p.mir})}>${this._t("vac.fit_mirror")}</button>
          <button class="btn" @click=${()=>this._vacFitSave()}>${this._t("btn.save")}</button>
          <button class="btn ghostbtn" @click=${()=>{this._vacFit=null}}>${this._t("btn.cancel")}</button>
        </div>`:V}
        ${this._tapConfirm?W`<hp-dialog .hass=${this.hass}
              .title=${"toggle"===this._tapConfirm.kind?this._tapConfirm.text:this._t("btn.run")}
              icon="mdi:alert-outline"
              dismiss-on-scrim @hp-close=${()=>this._tapConfirm=null}>
                <div class="body ${"toggle"===this._tapConfirm.kind?"tapconfirm-body":""}">
                  ${"run"===this._tapConfirm.kind?W`<p>${this._tapConfirm.text}</p>`:this._tapConfirm.lines.map((e,t)=>W`
                        <p class="tapconfirm-line" data-line=${t}>${e}</p>`)}
                </div>
                <div class="row" slot="footer">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${()=>this._tapConfirm=null}>${this._t("btn.cancel")}</button>
                  <button class="btn on" @click=${()=>{const e=this._tapConfirm;this._tapConfirm=null,e.exec()}}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.run")}
                  </button>
                </div>
            </hp-dialog>`:V}
        ${this._toast?W`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>`:V}
      </ha-card>
    `}_vacCandidateStatus(e,t,i=this._planHass){const n=this._bindingStatus("entity:"+e);if("ha_disabled"===n.kind)return"disabled";if("orphaned"===n.kind)return"missing";if("unverified"===n.kind)return"unverified";const r=i?.states?.[e];return"unavailable"===r?.state?"unavailable":t?.hasPosition?"ok":"unsupported"}_vacOpenAllCameras(e){const t=this._haRegistry.entities||{},i=[];for(const[e,n]of Object.entries(this.hass?.states||{})){if(!e.startsWith("camera."))continue;const r=sc(e,n,t[e]);r&&i.push(r)}this._vacAllCameraCache={devId:e.id,candidates:i},this._vacAllCamerasFor=e.id}_vacSourceResolution(e,t=!1,i=this._planHass){const n=e.marker?.vacuum,r="string"==typeof n?.source&&!!n.source,o=new Set(e.entities||[]),s=new Set(o);r&&s.add(n.source);const a=i?.entities||{},l=[];for(const e of s){const t=i?.states?.[e],o=sc(e,t,a[e]);o?l.push(o):r&&e===n.source&&l.push({entityId:e,name:String(t?.attributes?.friendly_name||e),platform:a[e]?.platform?String(a[e].platform):null,category:e.startsWith("camera.")?"camera":"partial",hasPosition:!1,hasRooms:!1,hasPath:!1,hasMapId:!1,score:0})}if(t&&this._vacAllCameraCache?.devId===e.id){const e=new Set(l.map(e=>e.entityId));for(const t of this._vacAllCameraCache.candidates)e.has(t.entityId)||l.push(t)}const c={};for(const e of l)c[e.entityId]=this._vacCandidateStatus(e.entityId,e,i);return function(e,t,i,n){const r="string"==typeof e&&e.length>0,o=new Set(t),s=Array.from(i).sort((t,i)=>r&&t.entityId===e?-1:r&&i.entityId===e?1:i.score-t.score||t.entityId.localeCompare(i.entityId));if(r){const t=s.find(t=>t.entityId===e);return{entityId:e,status:n[e]||(t?.hasPosition?"ok":"unverified"),pinned:!0,candidates:s}}const a=s.find(e=>o.has(e.entityId)&&e.hasPosition&&"ok"===n[e.entityId]);return a?{entityId:a.entityId,status:"ok",pinned:!1,candidates:s}:{entityId:null,status:"none",pinned:!1,candidates:s}}(n?.source,o,l,c)}_vacSource(e,t=this._planHass){if(!1===e.marker?.vacuum?.live)return null;const i=this._vacSourceResolution(e,!1,t);return"ok"===i.status||"unsupported"===i.status?i.entityId:null}_vacEntity(e){return e.primary?.startsWith("vacuum.")?e.primary:(e.entities||[]).find(e=>e.startsWith("vacuum."))||null}_isVacDev(e){return!!this._vacEntity(e)}_activitySourceKey(e){return this._activitySnapshot(e).sourceKey}_activitySnapshot(e,t=Bh(this._planHass,this._devices,null,this._virtualLights)){const i=Qu(this._planHass,e,this._devices,t,this._fullRegistryHass);return{samples:i.samples,sourceKey:ip(this._planHass,e,i)}}_stampActivity(e,t,i){let n=this._activityRt.get(e);n||(n=r_(i||"",[]),this._activityRt.set(e,n)),null!=i&&(n.sources=i),s_(n,t,Date.now(),window.clearTimeout.bind(window),e=>window.setTimeout(()=>this.requestUpdate(),e))}_syncActivityRuntime(){const e=new Map;if(!this.hass)return e;if(!1===this._config?.live_states){for(const e of this._activityRt.values())clearTimeout(e.timer);return this._activityRt.clear(),e}const t=new Set,i=Bh(this._planHass,this._devices,null,this._virtualLights);for(const n of this._devices){if(n.hidden)continue;if("icon_ripple"!==ki(n.marker?.display))continue;t.add(n.id);const r=this._activitySnapshot(n,i);e.set(n.id,r);const{samples:o,sourceKey:s}=r;let a=this._activityRt.get(n.id);a?a.sources!==s&&o_(a,s,o,window.clearTimeout.bind(window)):(a=r_(s,o),this._activityRt.set(n.id,a))}for(const[e,i]of this._activityRt)t.has(e)||(clearTimeout(i.timer),this._activityRt.delete(e));return e}_activityTick(){if(!this.hass)return;const e=this._syncActivityRuntime();for(const t of this._devices){if(t.hidden)continue;if("icon_ripple"!==ki(t.marker?.display))continue;const i=e.get(t.id)||this._activitySnapshot(t),{samples:n,sourceKey:r}=i,o=this._activityRt.get(t.id);if(!o||o.sources!==r)continue;const s=a_(o,n,window.clearTimeout.bind(window));s&&this._stampActivity(t.id,s,r)}}_vacTick(){if(this.hass)for(const e of this._devices){if(e.hidden||!this._isVacDev(e))continue;if("static_icon"===ki(e.marker?.display)){this._vacRt.delete(e.id);continue}const t=this._vacSource(e);if(!t)continue;const i=this._vacEntity(e),n=dc(this.hass.states[i||""]?.state),r=nc(this.hass.states[t]?.attributes);let o=this._vacRt.get(e.id);o||(o={trail:[],lastKey:"",lastTs:0,moving:!1,jump:!1,endedTs:0,lastPos:null},this._vacRt.set(e.id,o)),n&&!o.moving&&(o.trail=[],o.lastPos=null);const s="never"!==gc(e.marker?.vacuum)&&!r?.path.length;!n&&o.moving&&(o.endedTs=Date.now(),s&&o.lastPos&&(o.trail=hc(o.trail,o.lastPos,40)),o.lastPos=null),o.moving=n;const a=r?.pos;if(n&&a){const e=a.x+":"+a.y;if(e!==o.lastKey){const t=Date.now();o.jump=o.lastTs>0&&t-o.lastTs>1e4,o.lastKey=e,o.lastTs=t,s&&o.lastPos&&(o.trail=hc(o.trail,o.lastPos,40)),o.lastPos=[a.x,a.y]}}}}_vacEnsureMarker(e){const t=this._serverCfg;if(!t)return null;t.markers=t.markers||[];const i=t.markers.find(t=>t.id===e.id);if(i)return i;if("device"!==e.bindingKind&&"entity"!==e.bindingKind||!e.bindingRef)return null;const n={id:e.id,binding:e.bindingKind+":"+e.bindingRef,space:e.space||null,area:e.area||null,hidden:!!e.hidden};return t.markers.push(n),n}_renderVacSection(e){return this._editorRuntimeOrThrow()._renderVacSection(e)}_vacMapId(e,t,i=this._planHass){const n=this._vacEntity(e),r=n?i?.states?.[n]?.attributes?.selected_map:null;return o=t.mapId,s=r,"default"!==o?o:null!=s?String(s):"default";var o,s}_vacSaveMatrix(e,t,i,n){return this._editorRuntimeOrThrow()._vacSaveMatrix(e,t,i,n)}_vacPlanRoomAnchors(e){return this._editorRuntimeOrThrow()._vacPlanRoomAnchors(e)}_vacAutoCalibrate(e){return this._editorRuntimeOrThrow()._vacAutoCalibrate(e)}_vacApplyCalibrationProposal(e){return this._editorRuntimeOrThrow()._vacApplyCalibrationProposal(e)}_vacStartFit(e){return this._editorRuntimeOrThrow()._vacStartFit(e)}_vacFitSave(){return this._editorRuntimeOrThrow()._vacFitSave()}_vacFitTurn(e){return this._editorRuntimeOrThrow()._vacFitTurn(e)}_vacGhostCentre(e){return this._editorRuntimeOrThrow()._vacGhostCentre(e)}_vacDelta(e,t,i){return this._editorRuntimeOrThrow()._vacDelta(e,t,i)}_vacFitPointer(e,t){return this._editorRuntimeOrThrow()._vacFitPointer(e,t)}_renderVacFit(e){return this._editorRuntime?this._editorRuntimeOrThrow()._renderVacFit(e):V}_vacRafLoop(){this._vacRaf=requestAnimationFrame(()=>{const e=this.renderRoot,t=this._stageEl,i=this._vacLastView,n=e?.querySelectorAll?.(".vacpuck")||[];if(!t||!i||!n.length)return void(this._vacRaf=0);const r=t.getBoundingClientRect();for(const t of n){const n=t.getAttribute("data-mid"),o=t.getBoundingClientRect(),s=i.x+(o.left+o.width/2-r.left)/r.width*i.w,a=i.y+(o.top+o.height/2-r.top)/r.height*i.h;for(const t of e.querySelectorAll(`line.tip[data-mid="${n}"]`))t.setAttribute("x2",s.toFixed(1)),t.setAttribute("y2",a.toFixed(1))}this._vacRafLoop()})}_vacTrailPathD(e,t){const i=e.map(e=>e.map(([e,i])=>Vl(t,e,i))),n=function(e,t,i=console.warn){if(!Number.isFinite(t)||t<=0)return[];const n=[];let r=0;for(const i of e){if(!i.every(tc)){r++;continue}const e=i.filter((e,t)=>0===t||!ic(e,i[t-1]));if(e.length<2)continue;const o=[{kind:"move",point:e[0]}];if(2!==e.length){for(let i=1;i<e.length-1;i++){const n=e[i-1],r=e[i],s=e[i+1],a=r[0]-n[0],l=r[1]-n[1],c=s[0]-r[0],h=s[1]-r[1],d=Math.hypot(a,l),u=Math.hypot(c,h),p=(a*c+l*h)/(d*u);if(!Number.isFinite(p)||p<=-.999){o.push({kind:"line",point:r});continue}const m=Math.min(t,d/2,u/2);if(!Number.isFinite(m)||m<=0){o.push({kind:"line",point:r});continue}const _=[r[0]-a*m/d,r[1]-l*m/d],f=[r[0]+c*m/u,r[1]+h*m/u];o.push({kind:"line",point:_}),o.push({kind:"quadratic",control:r,point:f})}o.push({kind:"line",point:e[e.length-1]}),n.push(o)}else o.push({kind:"line",point:e[1]}),n.push(o)}return r>0&&i(`[houseplan] vacuum trail: ${r} segment(s) dropped — non-finite point (check map calibration)`),n}(i,this._cmToUnits(17.5)),r=e=>{const t=this._scenePoint(e);return`${t[0].toFixed(1)} ${t[1].toFixed(1)}`};return n.map(e=>e.map(e=>"move"===e.kind?`M ${r(e.point)}`:"line"===e.kind?`L ${r(e.point)}`:`Q ${r(e.control)} ${r(e.point)}`).join(" ")).join(" ")}_renderVacuums(e,t){if(this._markup||"decor"===this._mode)return V;const i=this._space+"|"+t.x+"|"+t.y+"|"+t.w+"|"+t.h,n=this._vacJumpOnce||i!==this._vacViewKey;this._vacViewKey=i,this._vacJumpOnce=!1;const r=[],o=[];for(const i of e){if(i.hidden||!this._isVacDev(i))continue;if("static_icon"===ki(i.marker?.display))continue;const e=this._renderDeviceSnapshot?.facts.get(`vacuum:${i.id}`),s=e?.source??this._vacSource(i,this._renderPlanHass);if(!s)continue;const a=e?.telemetry??nc(this._renderPlanHass?.states[s]?.attributes);if(!a)continue;const l=String(e?.mapId??this._vacMapId(i,a,this._renderPlanHass)),c=i.marker?.vacuum?.calibration?.[l];if(!c||6!==c.length)continue;const h=e?.runtime??this._vacRt.get(i.id),d=h?.moving??!1,u=gc(i.marker?.vacuum),p="always"===u||"cleaning"===u&&d,m=e?.server??this._vacSrvTrails[i.id],_=m?.current?.map_id===l&&Array.isArray(m.current.points)?m.current:null,f=m?.previous?.map_id===l&&Array.isArray(m.previous.points)?m.previous:null;if("always"===u&&f){const e=Jl(f.points),t=this._vacTrailPathD(e,c);t&&o.push(j`<g class="prev"><path class="case" d="${t}"></path><path class="core" d="${t}"></path></g>`)}if(p){const e=Ql(a,_,h?.trail||[]),t=!d||"integration"!==e.source&&"server"!==e.source?e.path:ec(e.path);if(t.length){const e=this._vacTrailPathD(t,c);e&&o.push(j`<path class="case" d="${e}"></path><path class="core" d="${e}"></path>`);const n=t[t.length-1];if(d&&n?.length>=2){const e=n[n.length-1],[t,r]=Vl(c,e[0],e[1]),s=this._scenePoint([t,r]),a=s[0].toFixed(1),l=s[1].toFixed(1);o.push(j`<line class="case tip" data-mid="${i.id}" x1="${a}" y1="${l}" x2="${a}" y2="${l}"></line><line class="core tip" data-mid="${i.id}" x1="${a}" y1="${l}" x2="${a}" y2="${l}"></line>`)}}}if(!d||!a.pos)continue;const[g,v]=Vl(c,a.pos.x,a.pos.y),y=this._scenePoint([g,v]),b=(y[0]-t.x)/t.w*100,w=(y[1]-t.y)/t.h*100,k=h&&h.lastTs>0&&Date.now()-h.lastTs>6e4,x=i.marker?.icon||i.icon||"mdi:robot-vacuum";r.push(W`<div
        data-mid="${i.id}"
        class="vacpuck ${cp(this._renderPlanHass)} ${h?.jump||n?"jump":""} ${k?"stale":""}"
        style="left:${b}%;top:${w}%"
        title=${i.name}
        @click=${e=>{e.stopPropagation();const t=this._vacEntity(i);t&&this._openMoreInfo(t)}}>
        <ha-icon .icon=${x}></ha-icon>
      </div>`)}return this._vacLastView=t,r.length&&!this._vacRaf&&this._vacRafLoop(),r.length||o.length?W`
      ${o.length?j`<svg class="vactrail" viewBox="${t.x} ${t.y} ${t.w} ${t.h}" preserveAspectRatio="none">${o}</svg>`:V}
      ${r}`:V}_renderDevice(e,t,i=!0){const n=this._pos(e),r=this._scenePoint([n.x,n.y]),o=(r[0]-t.x)/t.w*100,s=(r[1]-t.y)/t.h*100,a=this._devicePresentation(e,i),l=[`left:${o}%`,`top:${s}%`,...hp(a)],c=a.disabledReason,h=a.haDisabled?this._t(`marker.ha_disabled_${c}`):e.userHidden?this._t("marker.hidden_ghost"):e.name,d=Gu(a),u="view"===this._mode||"devices"===this._mode,p=[h,a.haDisabled?"":this._t(`marker.state_a11y_${d}`),"none"!==a.pulse.kind?this._t(`marker.pulse_a11y_${a.pulse.reason}`):"",a.valueFullText||a.valueText||"",Mu(a.valueBadge),null!=a.lqiText&&a.lqiBand?this._t(`marker.lqi_a11y_${a.lqiBand}`,{value:a.lqiText}):""].filter(Boolean).join(", "),m=[e.model,a.valueBadge?.fullText||"",null!=a.lqiText?"LQI "+a.lqiText:""].filter(Boolean).join(" · ");return W`<div
      ${""}
      data-hp="device"
      data-id="${e.id}"
      data-entity=${e.primary||V}
      data-area=${e.area||V}
      data-binding-status=${a.haDisabled?"ha-disabled":e.bindingStatus?.kind||"active"}
      data-disabled-reason=${c?c.replace("_","-"):V}
      data-state=${d}
      data-lqi-band=${null!=a.lqiText&&a.lqiBand||V}
      role=${u?"button":V}
      tabindex=${u?"0":V}
      aria-label=${p}
      class="dev ${cp(this._renderPlanHass)} ${a.classes.join(" ")} ${this._selId===e.id?"sel":""} ${e.virtual?"virtual":""} ${e.hidden?"ghost":""} ${a.haDisabled?"ha-disabled":""} ${null!=a.valueText?"valonly":""}"
      style="${l.join(";")}"
      @click=${t=>this._clickDevice(t,e)}
      @keydown=${t=>this._keyDevice(t,e)}
      @contextmenu=${t=>this._ctxDevice(t,e)}
      @pointerover=${t=>{"view"!==this._mode&&"devices"!==this._mode||this._showTip(t,e.name,a.haDisabled?h:m)}}
      @pointerleave=${()=>this._clearTransientHover()}
      @pointerdown=${t=>this._pointerDown(t,e)}
      @pointermove=${t=>{"view"!==this._mode&&"devices"!==this._mode||(this._pointerMove(t,e),this._showTip(t,e.name,a.haDisabled?h:m))}}
      @pointerup=${t=>this._pointerUp(t,e)}
      @pointercancel=${t=>this._pointerCancel(t,e)}
      @lostpointercapture=${t=>this._pointerCancel(t,e)}
    >
      ${up(a,{newDevice:this._newIds.has(e.id),newDeviceTitle:this._t("device.new"),disabledTitle:a.haDisabled?h:""})}
    </div>`}_roomArea(e){const t=Nt(e);if(!t)return null;const i=this._spaceModel();if(!i)return null;const n=this._spaceWalls.length&&e.id&&this._innerRoomContour(i,e.id)||t,r=this._cleanFloor(e,n),o=this._cellCm/this._gridPitch;return zn(r.area*o*o/1e4,"mi"===this._renderPlanHass?.config?.unit_system?.length)}_roomTemp(e){const t=e.settings?.temp_source;if(t)return ld(this._renderPlanHass,t,"temp",this._markers);const i=hd(this._spaceModel()?.id,e);return i?this._climate().get(i)?.temp??null:null}_roomHum(e){const t=e.settings?.hum_source;if(t)return ld(this._renderPlanHass,t,"hum",this._markers);const i=hd(this._spaceModel()?.id,e);return i?this._climate().get(i)?.hum??null:null}_climate(){const e=this._serverCfg?.markers,t=this._renderPlanHass,i=this._climateCache,n=this._settings.exclude_integrations;if(i&&i.h===t&&i.r===this._iconRules&&i.mk===e&&i.ex===n)return i.m;const r=pd(t,this._iconRules,e,this._excluded);return this._climateCache={h:t,r:this._iconRules,mk:e,ex:n,m:r},r}_resetRoomDialogFields(){return this._editorRuntimeOrThrow()._resetRoomDialogFields()}_openRoomEdit(e){return this._editorRuntimeOrThrow()._openRoomEdit(e)}_roomSettingsFromDialog(){return this._editorRuntimeOrThrow()._roomSettingsFromDialog()}_saveRoomEdit(){return this._editorRuntimeOrThrow()._saveRoomEdit()}_roomSrcCandidates(){return this._editorRuntimeOrThrow()._roomSrcCandidates()}_roomSrcLabel(e){return this._editorRuntimeOrThrow()._roomSrcLabel(e)}_labelPos(e,t){const i=this._layout["rl_"+(e.id||"")];if(i&&i.s===t)return{x:i.x*tg,y:i.y*tg};const n=this._roomCenter(e),r=this._gridPitch;return{x:Ea(Ft(n[0],r)),y:Ea(Ft(n[1],r))}}_labelDown(e,t,i){if(this._editorRuntime)return this._editorRuntimeOrThrow()._labelDown(e,t,i)}_labelMove(e,t,i){if(this._editorRuntime)return this._editorRuntimeOrThrow()._labelMove(e,t,i)}_labelUp(e){if(this._editorRuntime)return this._editorRuntimeOrThrow()._labelUp(e)}_labelScale(e){const t=this._layout["rl_"+(e.id||"")]?.k;return"number"==typeof t&&Number.isFinite(t)?Math.min(3,Math.max(.5,t)):1}_rlResizeDown(e,t,i){return this._editorRuntimeOrThrow()._rlResizeDown(e,t,i)}_rlResizeMove(e){return this._editorRuntimeOrThrow()._rlResizeMove(e)}_rlResizeUp(){return this._editorRuntimeOrThrow()._rlResizeUp()}_renderRoomGear(e,t,i){return this._editorRuntimeOrThrow()._renderRoomGear(e,t,i)}_renderRoomLabel(e,t,i,n){if(!e.name&&!this._markup)return V;const r=this._labelPos(e,t.id),o=this._scenePoint([r.x,r.y]),s=(o[0]-i.x)/i.w*100,a=(o[1]-i.y)/i.h*100,l=Math.min(1,n.opacity+.25),c=this._labelScale(e),h=[];if(n.labelTemp||n.labelHum||n.labelLqi&&e.area||n.labelLight){if(n.labelTemp){const t=this._roomTemp(e);null!=t&&h.push(W`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${t}°</span>`)}if(n.labelHum){const t=this._roomHum(e);null!=t&&h.push(W`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${t}%</span>`)}if(n.labelLqi&&e.area){const t=this._roomLqi(e.area);null!=t&&h.push(W`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${t}</span>`)}if(n.labelLight){const t=(d=Bh(this._renderPlanHass,this._renderDevices,e,this._virtualLights)).length?{on:d.filter(e=>e.on).length,total:d.length}:null;if(t){const e=0===t.on?this._t("roomcard.light_off"):t.on===t.total?this._t("roomcard.light_on"):this._t("roomcard.light_partial",{on:t.on,total:t.total});h.push(W`<span class="rlm ${t.on?"lit":""}"><ha-icon icon=${t.on?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>${e}</span>`)}}}var d;const u=!!e.area,p=!this._markup;return W`<div class="roomlabel ${h.length?"card":""}"
      data-hp="room-label" data-id=${e.id||V} data-area=${e.area||V}
      style="left:${s}%;top:${a}%;color:${n.color};opacity:${l};--rl-scale:${c};--rl-space:${n.cardFontScale};--rl-name:${kn(e.settings?.name_scale)};--rl-meta:${kn(e.settings?.label_scale)}"
      @pointerdown=${i=>this._labelDown(i,e,t.id)}
      @pointermove=${i=>this._labelMove(i,e,t.id)}
      @pointerup=${()=>this._labelUp(e)}
      @pointercancel=${()=>this._labelUp(e)}
    ><span class="rlname">${e.name||(this._markup?this._t("room.unnamed"):"")}${u?W`<ha-icon class="rlgo" icon="mdi:open-in-new"
            title=${p?this._t("room.open_area"):V}
            @click=${p?t=>{t.stopPropagation(),this._clickRoom(e)}:V}
            @pointerdown=${p?e=>e.stopPropagation():V}></ha-icon>`:V}</span>
      ${h.length?W`<span class="rlmetrics">${h}</span>`:V}
      ${"plan"===this._mode?["tl","tr","bl","br"].map(i=>W`<span class="rlhandle ${i}"
              @pointerdown=${i=>this._rlResizeDown(i,e,t.id)}
              @pointermove=${e=>this._rlResizeMove(e)}
              @pointerup=${()=>this._rlResizeUp()}
              @pointercancel=${()=>this._rlResizeUp()}></span>`):V}
    </div>`}get _measureAnchor(){return this._markup&&this._cursorPt?"draw"===this._tool&&this._path.length&&!this._contourClosed?this._path[this._path.length-1]:"split"===this._tool&&this._splitSel?.pts?.length?this._splitSel.pts[this._splitSel.pts.length-1]:null:null}_renderMeasureLabel(e){const t=this._measureAnchor,i=this._cursorPt,n=(i[0]-e.x)/e.w*100,r=(i[1]-e.y)/e.h*100,o=$n(t,i),s=Math.round(10*o)/10,a=function(e,t,i=.001){if(e.length<2||t.length<2)return!1;const n=Math.abs(t[0]-e[0]),r=Math.abs(t[1]-e[1]);if(!Number.isFinite(n)||!Number.isFinite(r)||Math.hypot(n,r)<=i)return!1;const o=Math.max(n,r,1);return n<=i*o||r<=i*o||Math.abs(n-r)<=i*o}(t,i,2e-4*this._gridPitch);return W`<div class="measurelabel ${a?"on45":""}" style="left:${n}%;top:${r}%">
      ${this._fmtLen(t,i)} · ${s}°</div>`}get _decorMeasure(){const e=this._decorDraft;if(!e||"decor"!==this._mode)return null;const[t,i]=e.a,[n,r]=e.b;if(Math.abs(t-n)<1e-6&&Math.abs(i-r)<1e-6)return null;const o=(t+n)/2,s=(i+r)/2;if("line"===e.kind){const t=$n(e.a,e.b);return{x:o,y:s,on45:Sn(t),text:`${this._fmtLen(e.a,e.b)} · ${Math.round(10*t)/10}°`}}const a=this._fmtLen([t,i],[n,i]),l=this._fmtLen([n,i],[n,r]);if("ellipse"===e.kind){const e=this._fmtLen([0,0],[Math.abs(n-t)/2,0]),a=this._fmtLen([0,0],[0,Math.abs(r-i)/2]);return{x:o,y:s,on45:!1,text:Math.abs(Math.abs(n-t)-Math.abs(r-i))<1e-6?`R ${e}`:`Rx ${e} × Ry ${a}`}}return{x:o,y:s,on45:!1,text:`${a} × ${l} · ${zn(hr(Math.abs(n-t),this._cellCm,this._gridPitch)*hr(Math.abs(r-i),this._cellCm,this._gridPitch)/1e4,this._imperial)}`}}get _alignPoint(){if(this._markup){if("draw"===this._tool&&this._path.length&&!this._contourClosed&&this._cursorPt)return this._cursorPt;if("split"===this._tool&&this._splitSel?.pts?.length&&this._cursorPt)return this._cursorPt;if(this._drag?.id.startsWith("rl_")&&this._drag.moved){const e=this._drag.id.slice(3),t=this._spaceModel()?.rooms.find(t=>t.id===e);return t?(()=>{const e=this._labelPos(t,this._space);return[e.x,e.y]})():null}return null}if("devices"===this._mode&&this._deviceDrag?.moved){const e=this._devices.find(e=>e.id===this._deviceDrag.id);return e?(()=>{const t=this._pos(e);return[t.x,t.y]})():null}if("decor"===this._mode){if(this._decorDraft)return this._decorDraft.b;if(this._decorMove){const e=this._decorList.find(e=>e.id===this._decorMove.id);if(!e)return null;const t=tg,i=this._decorH;return"line"===e.kind?[e.x1*t,e.y1*i]:[e.x*t,e.y*i]}return null}return null}_alignCandidates(){return this._editorRuntimeOrThrow()._alignCandidates()}_renderAlignGuides(){return this._editorRuntimeOrThrow()._renderAlignGuides()}_renderOpeningCenterTick(e){return this._editorRuntimeOrThrow()._renderOpeningCenterTick(e)}_renderOpeningDimensionGuides(e){return this._editorRuntimeOrThrow()._renderOpeningDimensionGuides(e)}_roomCenter(e){if(e.poly){const t=e.poly.length;return[e.poly.reduce((e,t)=>e+t[0],0)/t,e.poly.reduce((e,t)=>e+t[1],0)/t]}return[e.x+e.w/2,e.y+.1*Math.min(e.w,e.h)]}_openingAmt(e){const t=e.contact&&this._renderOpeningEntityAvailable(e.contact)?this._renderPlanHass.states[e.contact]:null;return Ut(e.type,t?.state,!!e.invert,t?.attributes?.current_position)}_planEntityAvailable(e){return!!e&&(!id(this._fullRegistryHass,e,td(this._markers))&&"active"===this._bindingStatus("entity:"+e).kind)}_renderEntityAvailable(e){return!!e&&(!id(this._renderPlanHass,e,td(this._markers))&&(!!this._renderPlanHass.entities?.[e]&&!!this._renderPlanHass.states?.[e]))}_openingEntityAvailable(e){return function(e,t,i=lh(e)){return!!t&&"active"===fh(e,`entity:${t}`,i).kind}(this.hass,e,this._haRegistry)}_renderOpeningEntityAvailable(e){return t=this._renderPlanHass,!!(i=e)&&!!t?.states?.[i];var t,i}_renderOpeningPlacementPreview(){return this._editorRuntimeOrThrow()._renderOpeningPlacementPreview()}_renderOpenings(e){const t=this._openingsR;if(!t.length)return j``;const i=this._spaceModel();if(!i)return j``;const n=e.color,r=this._spaceWalls,o=this._openCuts(),s=this._openingWallIndexFor(i,o).value;return j`${t.map(e=>{if(e.orphanReason)return j`<g class="opening orphan" data-hp="opening-orphan"
        data-id=${e.id} role="button" tabindex="0"
        aria-label=${this._t("opening.partition_orphan")}
        transform="translate(${e.rx} ${e.ry})"
        @click=${t=>{t.stopPropagation(),this._editOpening(e)}}>
        <circle r=${ya(.55*this._gridPitch,this._cellCm)}></circle>
        <text text-anchor="middle" dominant-baseline="central">!</text>
      </g>`;const t=this._openingAmt(e),i=t>0&&!!e.contact&&this._renderOpeningEntityAvailable(e.contact)?"var(--hp-open)":n,o="gate"===e.type?!e.flip_v:e.flip_v,a=e.partitionHost||r.length||"gate"===e.type?this._openingFace(e,s,!!o):{ox:0,oy:0,cm:0,side:-1},l={type:e.type,length:e.rlen,angle:e.angle,amount:t,flipH:!!e.flip_h,flipV:!!e.flip_v,base:n,tone:i,cellCm:this._cellCm,gridPitch:this._gridPitch,face:a},{half:c,outlineHalf:h,hitHalf:d}=yu(l),u=ya(10,this._cellCm),p=ya(12,this._cellCm);return j`<g class="opening" data-hp="opening" data-id="${e.id}" data-kind="${e.type}"
        transform="translate(${e.rx} ${e.ry}) rotate(${e.angle})">
        ${$u(l)}
        <rect class="op-outline" x="${-c-u}" y="${-h}"
          width="${e.rlen+2*u}" height="${2*h}"
          rx="${ya(6,this._cellCm)}"></rect>
        <rect class="op-hit" x="${-c-p}" y="${-d}"
          width="${e.rlen+2*p}" height="${2*d}"
          @click=${t=>this._opClick(t,e)}
          @pointerdown=${t=>this._opPointerDown(t,e)}
          @pointermove=${t=>this._opPointerMove(t,e)}
          @pointerup=${t=>this._opPointerUp(t,e)}
          @pointercancel=${t=>this._opPointerUp(t,e)}></rect>
      </g>`})}`}_renderOpeningLocks(e){const t=this._openingsR.filter(e=>!e.orphanReason&&("door"===e.type||"gate"===e.type)&&e.lock&&this._renderOpeningEntityAvailable(e.lock));if(!t.length)return W``;const i=this._spaceModel();if(!i)return W``;const n=this._openCuts(),r=this._openingWallIndexFor(i,n).value;return W`${t.map(t=>{const i=this._renderPlanHass.states[t.lock]?.state,n="locked"===i,o=n||["unlocked","open","opening","unlocking","locking"].includes(String(i)),s=(t.angle+90)*Math.PI/180,a="gate"===t.type?this._openingFace(t,r,!t.flip_v):null,l=ya(16,this._cellCm),c=a?-l*a.side:l*(t.flip_v?-1:1),h=t.rx+Math.cos(s)*c,d=t.ry+Math.sin(s)*c,u=this._scenePoint([h,d]),p=(u[0]-e.x)/e.w*100,m=(u[1]-e.y)/e.h*100;return W`<div class="oplock ${cp(this._renderPlanHass)} ${n?"locked":o?"unlocked":"unknown"}"
        style="left:${p}%;top:${m}%"
        @click=${e=>{"view"===this._mode&&(e.stopPropagation(),this._openingInfo=t)}}>
        <span class="oplock-shell" aria-hidden="true">
          <span class="oplock-core">
            <ha-icon icon="${n?"mdi:lock":o?"mdi:lock-open-variant":"mdi:lock-question"}"></ha-icon>
          </span>
        </span>
      </div>`})}`}async _lockAction(e,t){if(this._openingEntityAvailable(e)){if("unlock"===t){const t=this.hass?.states?.[e]?.attributes?.friendly_name||e,i=await this._confirmDanger({key:"unlock",kind:"warning",title:this._t("confirm.unlock_title"),message:this._t("confirm.unlock_body"),objectName:t,confirmLabel:this._t("opening.unlock_action"),cancelLabel:this._t("btn.cancel")}),n=this._openingInfo;if(!i||!this._openingEntityAvailable(e)||!n||"door"!==n.type&&"gate"!==n.type||n.lock!==e||"locked"!==this.hass?.states?.[e]?.state)return}this.hass?.callService?.("lock",t,{entity_id:e})}}_renderOpeningInfoCard(){const e=this._openingInfo,t="passage"!==e.type&&e.contact&&this._openingEntityAvailable(e.contact)?e.contact:null,i=("door"===e.type||"gate"===e.type)&&e.lock&&this._openingEntityAvailable(e.lock)?e.lock:null,n=t?this.hass.states[t]?.state:null,r=this._openingAmt(e),o=i?this.hass.states[i]?.state:null,s="door"===e.type?"opening.door":"gate"===e.type?"opening.gate":"passage"===e.type?"opening.passage":"opening.window",a="door"===e.type?"mdi:door":"gate"===e.type?"mdi:gate":"passage"===e.type?"mdi:arch":"mdi:window-closed-variant",l="gate"===e.type?r>0?"mdi:gate-open":"mdi:gate":r>0?"mdi:door-open":"mdi:door-closed",c=(e,t,i,n="")=>W`<div class="oprow ${n}"><ha-icon icon=${e}></ha-icon><span>${t}</span><b>${i}</b></div>`;return W`<hp-dialog .hass=${this.hass}
      .title=${this._t(s)} icon=${a} dismiss-on-scrim
      @hp-close=${()=>this._openingInfo=null}>
        <div class="body">
          ${t?c(l,this._t("opening.contact_label"),"unavailable"===n||null==n?this._t("opening.state_unknown"):this._t(r>0?"opening.open":"opening.closed"),r>0?"warn":"ok"):V}
          ${i?c("locked"===o?"mdi:lock":"mdi:lock-open-variant",this._t("opening.lock_label"),"locked"===o?this._t("opening.locked"):["unlocked","open"].includes(String(o))?this._t("opening.unlocked"):this._t("opening.state_unknown"),"locked"===o?"ok":"warn"):V}
          ${i&&("locked"===o||["unlocked","open"].includes(String(o)))?W`<button
                class="btn lockact ${"locked"===o?"warn":""}"
                @click=${()=>this._lockAction(i,"locked"===o?"unlock":"lock")}>
                <ha-icon icon=${"locked"===o?"mdi:lock-open-variant":"mdi:lock"}></ha-icon>
                ${this._t("locked"===o?"opening.unlock_action":"opening.lock_action")}
              </button>`:i&&["locking","unlocking"].includes(String(o))?W`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("opening.lock_pending")}
                </button>`:V}
          ${t||i?V:W`<p class="muted">${this._t("opening.no_entities")}</p>`}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingInfo=null}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_renderOpeningDialog(){return this._editorRuntimeOrThrow()._renderOpeningDialog()}_gridLevels(){return this._editorRuntimeOrThrow()._gridLevels()}_renderMarkupDefs(e){return this._editorRuntimeOrThrow()._renderMarkupDefs(e)}_renderPhysicalEditorLayer(){return this._editorRuntimeOrThrow()._renderPhysicalEditorLayer()}_renderHiddenWallDiagnosticOverlay(){return this._editorRuntimeOrThrow()._renderHiddenWallDiagnosticOverlay()}_renderPlanSnapOverlay(){return this._editorRuntimeOrThrow()._renderPlanSnapOverlay()}_syncPlanSnapActiveMarker(e){return this._editorRuntimeOrThrow()._syncPlanSnapActiveMarker(e)}_syncPlanSnapConflictMarkers(e){return this._editorRuntimeOrThrow()._syncPlanSnapConflictMarkers(e)}_planSnapPhysicalSegment(e){return this._editorRuntimeOrThrow()._planSnapPhysicalSegment(e)}_drawPreviewJoinPatchD(e,t){return this._editorRuntimeOrThrow()._drawPreviewJoinPatchD(e,t)}_renderMarkupLayer(e){return this._editorRuntimeOrThrow()._renderMarkupLayer(e)}_renderActiveChainInk(){return this._editorRuntimeOrThrow()._renderActiveChainInk()}_renderPartitionDeleteDialog(){return this._editorRuntimeOrThrow()._renderPartitionDeleteDialog()}_renderRoomDeleteDialog(){return this._editorRuntimeOrThrow()._renderRoomDeleteDialog()}_renderPhysicalDialog(){return this._editorRuntimeOrThrow()._renderPhysicalDialog()}_renderMarkupBar(){return this._editorRuntimeOrThrow()._renderMarkupBar()}_renderDevicesBar(){return this._editorRuntimeOrThrow()._renderDevicesBar()}_renderDeviceInbox(){return this._editorRuntimeOrThrow()._renderDeviceInbox()}_cardEntities(e){const t=this._planHass,i=[],n=new Set,r=e=>{if(!e||n.has(e)||!t.states[e])return;const r=t.entities[e];if("config"===r?.entity_category||"diagnostic"===r?.entity_category)return;n.add(e);const o=e.split(".")[0];["light","switch","fan","humidifier","siren","input_boolean"].includes(o)?i.push({eid:e,kind:"toggle"}):["cover","valve","lock","climate","media_player","vacuum","water_heater"].includes(o)?i.push({eid:e,kind:"open"}):["sensor","binary_sensor","number","select"].includes(o)&&i.push({eid:e,kind:"value"})};for(const i of Bh(t,this._devices,null,this._virtualLights))if(i.device.id===e.id)for(const e of[...i.serviceEids,...i.stateEids])r(e);e.primary&&r(e.primary);for(const t of e.entities)r(t);return i.slice(0,12)}_cardToggle(e){const t=e.split(".")[0];"lock"!==t&&"alarm_control_panel"!==t&&this._planEntityAvailable(e)&&this.hass.callService("homeassistant","toggle",{entity_id:e}).catch(e=>this._showToast(this._t("toast.error",{err:this._errText(e)})))}_renderInfoCard(){const e=this._infoCard,t=e.primary?this.hass.states[e.primary]:void 0,i=t?Ai(this.hass,e.primary)?.text??t.state:null,n=(e.controls??e.marker?.controls??[]).filter(dn).filter(e=>this._planEntityAvailable(e));return W`<hp-dialog .hass=${this.hass} .title=${e.name} .icon=${e.icon} wide
      dismiss-on-scrim @hp-close=${this._closeInfoCard}>
        <div class="body">
          ${(()=>{const t=this._cardEntities(e);return t.length?W`<div class="entlist">
              ${t.map(({eid:e,kind:t})=>{const i=this.hass.states[e],n=this.hass.entities[e]?.name||i?.attributes?.friendly_name||e,r=i?Ai(this.hass,e)?.text??i.state:"",o="on"===i?.state||["open","unlocked","playing","cleaning"].includes(i?.state);return W`<div class="entrow ${o?"on":""}">
                  <ha-icon icon=${nn($e(n,"",this._iconRules),e.split(".")[0],i?.attributes?.device_class,i?.state,!1)}></ha-icon>
                  <span class="en">${n}</span>
                  ${"toggle"===t?W`<button class="entbtn ${o?"on":""}"
                        @click=${()=>this._cardToggle(e)}>${r}</button>`:"open"===t?W`<button class="entbtn"
                          @click=${()=>{this._closeInfoCard(),this._openMoreInfo(e)}}>${r}</button>`:W`<span class="ev">${r}</span>`}
                </div>`})}
            </div>`:V})()}
          ${e.model?W`<div class="inforow"><span class="k">${this._t("info.model")}</span><span>${e.model}</span></div>`:V}
          ${i&&!this._cardEntities(e).length?W`<div class="inforow"><span class="k">${this._t("info.state")}</span><span>${i}</span></div>`:V}
          ${bi(e.link)?W`<div class="inforow"><span class="k">${this._t("info.link")}</span>
                <a href="${bi(e.link)}" target="_blank" rel="noreferrer noopener">${e.link}</a></div>`:V}
          ${e.description?W`<div class="infodesc">${e.description}</div>`:V}
          ${e.pdfs&&e.pdfs.length?W`<div class="inforow"><span class="k">${this._t("info.manuals")}</span><span class="pdflist">
                ${e.pdfs.map(e=>W`<a class="pdf" href="${bi(this._display(e.url))||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${e.name}</a>`)}</span></div>`:V}
          ${n.length?W`<div class="inforow"><span class="k">${this._t("info.controls")}</span>
                <span class="ctrlstates">
                  ${n.map(e=>{const t=this.hass.states[e],i="on"===t?.state;return W`<span class="ctrlstate ${i?"on":""}">
                      <ha-icon icon=${i?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>
                      ${t?.attributes?.friendly_name||e}</span>`})}
                </span></div>`:V}
          ${e.model||i||e.link||e.description||e.pdfs&&e.pdfs.length||n.length?V:W`<div class="infodesc muted">${this._t("info.none")}</div>`}
        </div>
        <div class="row infofooter" slot="footer">
          <button class="btn" @click=${()=>{const t=e;this._closeInfoCard(),this._openMarkerDialog(t)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t("btn.edit")}
          </button>
          ${e.primary?W`<button class="btn" @click=${()=>{const t=e.primary;this._closeInfoCard(),this._openMoreInfo(t)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("btn.open_in_ha")}
              </button>`:V}
          <button class="btn ghost infofooter-close" @click=${this._closeInfoCard}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_markerValueBadgeFields(e){return this._editorRuntimeOrThrow()._markerValueBadgeFields(e)}_markerDraft(e){return this._editorRuntimeOrThrow()._markerDraft(e)}_markerPreviewDevice(e){return this._editorRuntimeOrThrow()._markerPreviewDevice(e)}_markerPreviewDevices(e){return this._editorRuntimeOrThrow()._markerPreviewDevices(e)}_toggleIntent(e,t=this._devices){return Ed({hass:this._planHass,registryHass:this._fullRegistryHass,devices:t,device:e,virtualLights:this._virtualLights})}_toggleIntentForDialog(e){return this._editorRuntimeOrThrow()._toggleIntentForDialog(e)}_toggleStateText(e,t){const i=this._planHass?.states?.[e]||this.hass?.states?.[e];try{return i&&"function"==typeof this.hass?.formatEntityState?this.hass.formatEntityState(i):t}catch{return t}}_toggleConfirmationStateText(e){const t=String(e.state||"unknown"),i=e.entityId?this._toggleStateText(e.entityId,t):t;if(i.trim().toLocaleLowerCase()!==t.trim().toLocaleLowerCase())return i;const n={on:"confirm.state_on",off:"confirm.state_off",open:"confirm.state_open",closed:"confirm.state_closed",opening:"confirm.state_opening",closing:"confirm.state_closing",unknown:"confirm.state_unknown"}[t];return n?this._t(n):t.replaceAll("_"," ").replaceAll("-"," ")}_toggleConfirmationLines(e){const t={"turn-on":"confirm.state_on","turn-off":"confirm.state_off",open:"confirm.state_open",close:"confirm.state_closed",stop:"confirm.state_stopped"};return function(e,t){if(!Nd(e)||!e.nextEffect||!e.targets.length)return[];const i="group"===e.kind,n=i?e.targets.filter(e=>"on"===e.state).length:0,r=i?0===n?t.groupAllOff():t.groupCurrent(n,e.targets.length):t.state(e.targets[0]);let o;return o="toggle"===e.nextEffect?t.expectedByHa():i&&"turn-on"===e.nextEffect?t.groupAllOn():i&&"turn-off"===e.nextEffect?t.groupAllOff():t.effect(e.nextEffect),[t.current(r),t.expected(o),...e.skippedTargets.length?[t.unavailable(e.skippedTargets.length)]:[]]}(e,{state:e=>this._toggleConfirmationStateText(e),current:e=>this._t("confirm.current_state",{state:e}),expected:e=>this._t("confirm.expected_state",{state:e}),groupCurrent:(e,t)=>this._t("confirm.group_current",{on:e,total:t}),groupAllOn:()=>this._t("confirm.group_all_on"),groupAllOff:()=>this._t("confirm.group_all_off"),unavailable:e=>this._t("confirm.unavailable_targets",{count:e}),effect:e=>this._t(t[e]),expectedByHa:()=>this._t("confirm.expected_by_ha")})}_toggleHintLines(e){return this._editorRuntimeOrThrow()._toggleHintLines(e)}_effectiveStoredTapAction(e,t){return this._editorRuntimeOrThrow()._effectiveStoredTapAction(e,t)}_effectiveMarkerTapAction(e,t=this._markerPreviewDevice(e)){return this._editorRuntimeOrThrow()._effectiveMarkerTapAction(e,t)}_announceToggleDraft(e){return this._editorRuntimeOrThrow()._announceToggleDraft(e)}_valueBadgeForBinding(e,t){return this._editorRuntimeOrThrow()._valueBadgeForBinding(e,t)}_markerSpatialSource(e){return this._editorRuntimeOrThrow()._markerSpatialSource(e)}_markerAutoHasSpatialSource(e){return this._editorRuntimeOrThrow()._markerAutoHasSpatialSource(e)}_setMarkerLightRole(e){return this._editorRuntimeOrThrow()._setMarkerLightRole(e)}_controlRefInfo(e){return this._editorRuntimeOrThrow()._controlRefInfo(e)}_valueBadgeCandidateLabel(e){return this._editorRuntimeOrThrow()._valueBadgeCandidateLabel(e)}_controlCandidates(e){return this._editorRuntimeOrThrow()._controlCandidates(e)}_addControlRef(e,t){return this._editorRuntimeOrThrow()._addControlRef(e,t)}_setMarkerGlowMode(e){return this._editorRuntimeOrThrow()._setMarkerGlowMode(e)}_renderMarkerDialog(){return this._editorRuntimeOrThrow()._renderMarkerDialog()}_renderSpaceDialog(){return this._onboardingRuntime&&this._spaceDialog&&this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)?this._onboardingRuntime._renderSpaceDialog():this._editorRuntimeOrThrow()._renderSpaceDialog()}_renderMergeDialog(){return this._editorRuntimeOrThrow()._renderMergeDialog()}_renderCardPreview(e,t,i){const n=18*e;return W`<div class="cardpreview">
      <span class="cpname" style="font-size:${(n*t).toFixed(1)}px">
        ${this._t("preview.room_name")}</span>
      <span class="cpmeta" style="font-size:${(.62*n*i).toFixed(1)}px">
        <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
        <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
        <ha-icon icon="mdi:lightbulb-on"></ha-icon>${this._t("roomcard.light_partial",{on:1,total:3})}
      </span>
    </div>`}_renderRoomSource(e){return this._editorRuntimeOrThrow()._renderRoomSource(e)}_renderRoomDialog(){return this._editorRuntimeOrThrow()._renderRoomDialog()}}cg.properties={_tabDrag:{state:!0},_hdrH:{state:!0},_booting:{state:!0},_bootFading:{state:!0},_bootSoft:{state:!0},_continuityEpoch:{state:!0},_editorRuntimeLoadingVisible:{state:!0},_backdropGuard:{state:!0},_tapConfirm:{state:!0},_dangerConfirm:{state:!0},hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_hoverRoom:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_mode:{state:!0},_tool:{state:!0},_wallDialog:{state:!0},_drawWallField:{state:!0},_activeDraftId:{state:!0},_physicalSel:{state:!0},_physicalDialog:{state:!0},_partitionDeleteDialog:{state:!0},_roomDeleteDialog:{state:!0},_physicalDrag:{state:!0},_physicalRotate:{state:!0},_duplicateColumnId:{state:!0},_opMeasure:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_mergeSel:{state:!0},_openingPreset:{state:!0},_openingDialog:{state:!0},_openingInfo:{state:!0},_mergeDialog:{state:!0},_splitSel:{state:!0},_decorTool:{state:!0},_decorStyle:{state:!0},_decorDraft:{state:!0},_decorSel:{state:!0},_decorEraseConfirm:{state:!0},_decorTextDialog:{state:!0},_decorShapeDialog:{state:!0},_backdropDialog:{state:!0},_furnPalette:{state:!0},_decorImagePalette:{state:!0},_decorAssetCatalog:{state:!0},_decorAssetBusy:{state:!0},_furnCategory:{state:!0},_furnPreviewInput:{state:!0},_bdDrag:{state:!0},_dtBox:{state:!0},_dtDrag:{state:!0},_kioskDialog:{state:!0},_vacFit:{state:!0},_vacAllCamerasFor:{state:!0},_vacCalConfirm:{state:!0},_kioskDots:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_roomEditId:{state:!0},_roomFill:{state:!0},_roomCustomFill:{state:!0},_roomTempSrc:{state:!0},_roomHumSrc:{state:!0},_roomSrcOpen:{state:!0},_roomSrcFilter:{state:!0},_roomNameScale:{state:!0},_roomLabelScale:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_deviceInbox:{state:!0},_rulesDialog:{state:!0},_settingsDialog:{state:!0},_supportDialog:{state:!0},_alignDialog:{state:!0},_preflightClipboardFallback:{state:!0},_backupExportDialog:{state:!0},_backupImportDialog:{state:!0},_importDialog:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},cg.ZOOM_MAX=8,cg.ZOOM_MIN=1/3,cg.styles=[tu,g_],customElements.get("houseplan-card")||customElements.define("houseplan-card",cg),window.customCards=window.customCards||[],window.customCards.find(e=>"houseplan-card"===e.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Interactive house plan: spaces, rooms and devices with live states and drag layout."}),console.info(`%c HOUSEPLAN-CARD %c v${Nf} `,"background:#3ea6ff;color:#04121f;font-weight:700","");export{eo as $,V as A,Aa as B,Nt as C,Vd as D,U as E,eu as F,Oa as G,ds as H,no as I,Jd as J,jd as K,Po as L,ps as M,Gd as N,Hs as O,Bs as P,po as Q,Xt as R,io as S,vo as T,vp as U,yp as V,ts as W,Hr as X,To as Y,Mo as Z,Jr as _,o as a,Ao as a$,Or as a0,Tp as a1,xa as a2,Do as a3,Pa as a4,Co as a5,Sa as a6,Ma as a7,Ii as a8,Ei as a9,Jn as aA,Zn as aB,Gi as aC,ve as aD,vu as aE,uf as aF,uo as aG,Ea as aH,Ft as aI,It as aJ,kr as aK,Ys as aL,jl as aM,Rp as aN,Ll as aO,v_ as aP,cs as aQ,Ps as aR,gs as aS,Ap as aT,ti as aU,Zt as aV,_i as aW,ma as aX,ta as aY,ea as aZ,zo as a_,Di as aa,zi as ab,Ra as ac,hs as ad,Hi as ae,im as af,cr as ag,Ha as ah,j as ai,em as aj,ll as ak,ml as al,Al as am,Da as an,Pl as ao,kl as ap,Jo as aq,Is as ar,Io as as,Vs as at,fa as au,Dp as av,Ks as aw,us as ax,Ki as ay,Qn as az,he as b,Jh as b$,Fs as b0,Et as b1,il as b2,da as b3,ha as b4,Dn as b5,zn as b6,ri as b7,Zo as b8,Xo as b9,ya as bA,yu as bB,Zd as bC,Ff as bD,Xd as bE,qs as bF,Df as bG,If as bH,bp as bI,jt as bJ,Kd as bK,Qd as bL,ui as bM,Qt as bN,Wt as bO,ei as bP,Fo as bQ,fi as bR,an as bS,Hu as bT,Nu as bU,Ch as bV,Pd as bW,ki as bX,Ci as bY,Rn as bZ,wn as b_,Op as ba,Fp as bb,_r as bc,yr as bd,vr as be,hr as bf,sr as bg,lr as bh,pr as bi,$n as bj,or as bk,ar as bl,Rl as bm,fr as bn,Dl as bo,bl as bp,_l as bq,Cl as br,$l as bs,zl as bt,xl as bu,Tl as bv,Ml as bw,Yp as bx,Oo as by,lo as bz,W as c,Hh as c$,Wp as c0,Qr as c1,ed as c2,Zh as c3,Vi as c4,ji as c5,Wi as c6,wa as c7,Sp as c8,qi as c9,Vl as cA,kn as cB,xn as cC,Ut as cD,zf as cE,$u as cF,Rf as cG,rl as cH,ms as cI,qo as cJ,Wo as cK,ge as cL,ud as cM,Lu as cN,Bu as cO,ad as cP,qd as cQ,qh as cR,Bh as cS,Eh as cT,Rh as cU,dn as cV,Mh as cW,Qh as cX,ln as cY,rp as cZ,Tu as c_,Bi as ca,Li as cb,Ni as cc,ba as cd,Np as ce,Pp as cf,ur as cg,Yi as ch,y_ as ci,b_ as cj,qr as ck,er as cl,ye as cm,$e as cn,be as co,nc as cp,lc as cq,gc as cr,Xl as cs,cc as ct,rc as cu,oc as cv,mc as cw,_c as cx,pc as cy,fc as cz,tu as d,Nh as d0,Dh as d1,Td as d2,xi as d3,wi as d4,Ru as d5,bi as d6,ka as d7,$i as d8,Si as d9,to as da,ro as db,Yt as dc,rd as dd,sd as de,za as df,le as dg,Ul as dh,_u as di,ou as dj,hu as dk,su as dl,cg as dm,rm as e,cp as f,hp as g,ni as h,om as i,wr as j,li as k,fu as l,Ct as m,hi as n,td as o,ai as p,id as q,up as r,Dt as s,gu as t,Bt as u,Mu as v,Wu as w,pn as x,Mn as y,qt as z};
