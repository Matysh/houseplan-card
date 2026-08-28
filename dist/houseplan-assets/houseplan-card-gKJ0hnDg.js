globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="b0932d9ea32229294c30d94b645a3699799d106ba4e7bcc204be2a152c72ece9";const e=globalThis,t=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),n=new WeakMap;let r=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const i=this.t;if(t&&void 0===e){const t=void 0!==i&&1===i.length;t&&(e=n.get(i)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&n.set(i,e))}return e}toString(){return this.cssText}};const o=(e,...t)=>{const n=1===e.length?e[0]:t.reduce((t,i,n)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[n+1],e[0]);return new r(n,e,i)},s=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const i of e.cssRules)t+=i.cssText;return(e=>new r("string"==typeof e?e:e+"",void 0,i))(t)})(e):e,{is:a,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:h,getOwnPropertySymbols:d,getPrototypeOf:u}=Object,p=globalThis,_=p.trustedTypes,m=_?_.emptyScript:"",g=p.reactiveElementPolyfillSupport,f=(e,t)=>e,v={toAttribute(e,t){switch(t){case Boolean:e=e?m:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let i=e;switch(t){case Boolean:i=null!==e;break;case Number:i=null===e?null:Number(e);break;case Object:case Array:try{i=JSON.parse(e)}catch(e){i=null}}return i}},y=(e,t)=>!a(e,t),b={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:y};Symbol.metadata??=Symbol("metadata"),p.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=b){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const i=Symbol(),n=this.getPropertyDescriptor(e,i,t);void 0!==n&&l(this.prototype,e,n)}}static getPropertyDescriptor(e,t,i){const{get:n,set:r}=c(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:n,set(t){const o=n?.call(this);r?.call(this,t),this.requestUpdate(e,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??b}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const e=u(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const e=this.properties,t=[...h(e),...d(e)];for(const i of t)this.createProperty(i,e[i])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,i]of t)this.elementProperties.set(e,i)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const i=this._$Eu(e,t);void 0!==i&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const e of i)t.unshift(s(e))}else void 0!==e&&t.push(s(e));return t}static _$Eu(e,t){const i=t.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,n)=>{if(t)i.adoptedStyleSheets=n.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const t of n){const n=document.createElement("style"),r=e.litNonce;void 0!==r&&n.setAttribute("nonce",r),n.textContent=t.cssText,i.appendChild(n)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){const i=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,i);if(void 0!==n&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(t,i.type);this._$Em=e,null==r?this.removeAttribute(n):this.setAttribute(n,r),this._$Em=null}}_$AK(e,t){const i=this.constructor,n=i._$Eh.get(e);if(void 0!==n&&this._$Em!==n){const e=i.getPropertyOptions(n),r="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:v;this._$Em=n;const o=r.fromAttribute(t,e.type);this[n]=o??this._$Ej?.get(n)??o,this._$Em=null}}requestUpdate(e,t,i,n=!1,r){if(void 0!==e){const o=this.constructor;if(!1===n&&(r=this[e]),i??=o.getPropertyOptions(e),!((i.hasChanged??y)(r,t)||i.useDefault&&i.reflect&&r===this._$Ej?.get(e)&&!this.hasAttribute(o._$Eu(e,i))))return;this.C(e,t,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:n,wrapped:r},o){i&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),!0!==r||void 0!==o)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),!0===n&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,i]of e){const{wrapped:e}=i,n=this[t];!0!==e||this._$AL.has(t)||void 0===n||this.C(t,void 0,i,n)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[f("elementProperties")]=new Map,w[f("finalized")]=new Map,g?.({ReactiveElement:w}),(p.reactiveElementVersions??=[]).push("2.1.2");const k=globalThis,x=e=>e,$=k.trustedTypes,S=$?$.createPolicy("lit-html",{createHTML:e=>e}):void 0,M="$lit$",R=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+R,C=`<${T}>`,D=document,A=()=>D.createComment(""),O=e=>null===e||"object"!=typeof e&&"function"!=typeof e,z=Array.isArray,P="[ \t\n\f\r]",F=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,I=/-->/g,E=/>/g,N=RegExp(`>|${P}(?:([^\\s"'>=/]+)(${P}*=${P}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),H=/'/g,L=/"/g,q=/^(?:script|style|textarea|title)$/i,j=e=>(t,...i)=>({_$litType$:e,strings:t,values:i}),B=j(1),W=j(2),U=Symbol.for("lit-noChange"),G=Symbol.for("lit-nothing"),V=new WeakMap,K=D.createTreeWalker(D,129);function Y(e,t){if(!z(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(t):t}const Z=(e,t)=>{const i=e.length-1,n=[];let r,o=2===t?"<svg>":3===t?"<math>":"",s=F;for(let t=0;t<i;t++){const i=e[t];let a,l,c=-1,h=0;for(;h<i.length&&(s.lastIndex=h,l=s.exec(i),null!==l);)h=s.lastIndex,s===F?"!--"===l[1]?s=I:void 0!==l[1]?s=E:void 0!==l[2]?(q.test(l[2])&&(r=RegExp("</"+l[2],"g")),s=N):void 0!==l[3]&&(s=N):s===N?">"===l[0]?(s=r??F,c=-1):void 0===l[1]?c=-2:(c=s.lastIndex-l[2].length,a=l[1],s=void 0===l[3]?N:'"'===l[3]?L:H):s===L||s===H?s=N:s===I||s===E?s=F:(s=N,r=void 0);const d=s===N&&e[t+1].startsWith("/>")?" ":"";o+=s===F?i+C:c>=0?(n.push(a),i.slice(0,c)+M+i.slice(c)+R+d):i+R+(-2===c?t:d)}return[Y(e,o+(e[i]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),n]};class X{constructor({strings:e,_$litType$:t},i){let n;this.parts=[];let r=0,o=0;const s=e.length-1,a=this.parts,[l,c]=Z(e,t);if(this.el=X.createElement(l,i),K.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(n=K.nextNode())&&a.length<s;){if(1===n.nodeType){if(n.hasAttributes())for(const e of n.getAttributeNames())if(e.endsWith(M)){const t=c[o++],i=n.getAttribute(e).split(R),s=/([.?@])?(.*)/.exec(t);a.push({type:1,index:r,name:s[2],strings:i,ctor:"."===s[1]?ie:"?"===s[1]?ne:"@"===s[1]?re:te}),n.removeAttribute(e)}else e.startsWith(R)&&(a.push({type:6,index:r}),n.removeAttribute(e));if(q.test(n.tagName)){const e=n.textContent.split(R),t=e.length-1;if(t>0){n.textContent=$?$.emptyScript:"";for(let i=0;i<t;i++)n.append(e[i],A()),K.nextNode(),a.push({type:2,index:++r});n.append(e[t],A())}}}else if(8===n.nodeType)if(n.data===T)a.push({type:2,index:r});else{let e=-1;for(;-1!==(e=n.data.indexOf(R,e+1));)a.push({type:7,index:r}),e+=R.length-1}r++}}static createElement(e,t){const i=D.createElement("template");return i.innerHTML=e,i}}function J(e,t,i=e,n){if(t===U)return t;let r=void 0!==n?i._$Co?.[n]:i._$Cl;const o=O(t)?void 0:t._$litDirective$;return r?.constructor!==o&&(r?._$AO?.(!1),void 0===o?r=void 0:(r=new o(e),r._$AT(e,i,n)),void 0!==n?(i._$Co??=[])[n]=r:i._$Cl=r),void 0!==r&&(t=J(e,r._$AS(e,t.values),r,n)),t}class Q{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:i}=this._$AD,n=(e?.creationScope??D).importNode(t,!0);K.currentNode=n;let r=K.nextNode(),o=0,s=0,a=i[0];for(;void 0!==a;){if(o===a.index){let t;2===a.type?t=new ee(r,r.nextSibling,this,e):1===a.type?t=new a.ctor(r,a.name,a.strings,this,e):6===a.type&&(t=new oe(r,this,e)),this._$AV.push(t),a=i[++s]}o!==a?.index&&(r=K.nextNode(),o++)}return K.currentNode=D,n}p(e){let t=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}}class ee{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,n){this.type=2,this._$AH=G,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=J(this,e,t),O(e)?e===G||null==e||""===e?(this._$AH!==G&&this._$AR(),this._$AH=G):e!==this._$AH&&e!==U&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>z(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==G&&O(this._$AH)?this._$AA.nextSibling.data=e:this.T(D.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:i}=e,n="number"==typeof i?this._$AC(e):(void 0===i.el&&(i.el=X.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===n)this._$AH.p(t);else{const e=new Q(n,this),i=e.u(this.options);e.p(t),this.T(i),this._$AH=e}}_$AC(e){let t=V.get(e.strings);return void 0===t&&V.set(e.strings,t=new X(e)),t}k(e){z(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let i,n=0;for(const r of e)n===t.length?t.push(i=new ee(this.O(A()),this.O(A()),this,this.options)):i=t[n],i._$AI(r),n++;n<t.length&&(this._$AR(i&&i._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=x(e).nextSibling;x(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class te{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,n,r){this.type=1,this._$AH=G,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=G}_$AI(e,t=this,i,n){const r=this.strings;let o=!1;if(void 0===r)e=J(this,e,t,0),o=!O(e)||e!==this._$AH&&e!==U,o&&(this._$AH=e);else{const n=e;let s,a;for(e=r[0],s=0;s<r.length-1;s++)a=J(this,n[i+s],t,s),a===U&&(a=this._$AH[s]),o||=!O(a)||a!==this._$AH[s],a===G?e=G:e!==G&&(e+=(a??"")+r[s+1]),this._$AH[s]=a}o&&!n&&this.j(e)}j(e){e===G?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class ie extends te{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===G?void 0:e}}class ne extends te{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==G)}}class re extends te{constructor(e,t,i,n,r){super(e,t,i,n,r),this.type=5}_$AI(e,t=this){if((e=J(this,e,t,0)??G)===U)return;const i=this._$AH,n=e===G&&i!==G||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,r=e!==G&&(i===G||n);n&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class oe{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){J(this,e)}}const se={I:ee},ae=k.litHtmlPolyfillSupport;ae?.(X,ee),(k.litHtmlVersions??=[]).push("3.3.3");const le=(e,t,i)=>{const n=i?.renderBefore??t;let r=n._$litPart$;if(void 0===r){const e=i?.renderBefore??null;n._$litPart$=r=new ee(t.insertBefore(A(),e),e,void 0,i??{})}return r._$AI(e),r},ce=globalThis;let he=class extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=le(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return U}};he._$litElement$=!0,he.finalized=!0,ce.litElementHydrateSupport?.({LitElement:he});const de=ce.litElementPolyfillSupport;de?.({LitElement:he}),(ce.litElementVersions??=[]).push("4.2.2");const ue=2,pe=e=>(...t)=>({_$litDirective$:e,values:t});let _e=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,i){this._$Ct=e,this._$AM=t,this._$Ci=i}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};const{I:me}=se,ge=e=>e,fe=()=>document.createComment(""),ve=(e,t,i)=>{const n=e._$AA.parentNode,r=void 0===t?e._$AB:t._$AA;if(void 0===i){const t=n.insertBefore(fe(),r),o=n.insertBefore(fe(),r);i=new me(t,o,e,e.options)}else{const t=i._$AB.nextSibling,o=i._$AM,s=o!==e;if(s){let t;i._$AQ?.(e),i._$AM=e,void 0!==i._$AP&&(t=e._$AU)!==o._$AU&&i._$AP(t)}if(t!==r||s){let e=i._$AA;for(;e!==t;){const t=ge(e).nextSibling;ge(n).insertBefore(e,r),e=t}}}return i},ye=(e,t,i=e)=>(e._$AI(t,i),e),be={},we=(e,t=be)=>e._$AH=t,ke=e=>{e._$AR(),e._$AA.remove()},xe=(e,t,i)=>{const n=new Map;for(let r=t;r<=i;r++)n.set(e[r],r);return n},$e=pe(class extends _e{constructor(e){if(super(e),e.type!==ue)throw Error("repeat() can only be used in text expressions")}dt(e,t,i){let n;void 0===i?i=t:void 0!==t&&(n=t);const r=[],o=[];let s=0;for(const t of e)r[s]=n?n(t,s):s,o[s]=i(t,s),s++;return{values:o,keys:r}}render(e,t,i){return this.dt(e,t,i).values}update(e,[t,i,n]){const r=(e=>e._$AH)(e),{values:o,keys:s}=this.dt(t,i,n);if(!Array.isArray(r))return this.ut=s,o;const a=this.ut??=[],l=[];let c,h,d=0,u=r.length-1,p=0,_=o.length-1;for(;d<=u&&p<=_;)if(null===r[d])d++;else if(null===r[u])u--;else if(a[d]===s[p])l[p]=ye(r[d],o[p]),d++,p++;else if(a[u]===s[_])l[_]=ye(r[u],o[_]),u--,_--;else if(a[d]===s[_])l[_]=ye(r[d],o[_]),ve(e,l[_+1],r[d]),d++,_--;else if(a[u]===s[p])l[p]=ye(r[u],o[p]),ve(e,r[d],r[u]),u--,p++;else if(void 0===c&&(c=xe(s,p,_),h=xe(a,d,u)),c.has(a[d]))if(c.has(a[u])){const t=h.get(s[p]),i=void 0!==t?r[t]:null;if(null===i){const t=ve(e,r[d]);ye(t,o[p]),l[p]=t}else l[p]=ye(i,o[p]),ve(e,r[d],i),r[t]=null;p++}else ke(r[u]),u--;else ke(r[d]),d++;for(;p<=_;){const t=ve(e,l[_+1]);ye(t,o[p]),l[p++]=t}for(;d<=u;){const e=r[d++];null!==e&&ke(e)}return this.ut=s,we(e,l),U}}),Se=new WeakMap;let Me=0;class Re extends he{constructor(){super(...arguments),this.title="",this.icon="",this.wide=!1,this.dismissOnScrim=!1,this.hass=null,this._opener=null,this._focusRoot=null,this._useHaDialog=!1,this._closing=!1,this._overlays=[],this._titleId="hp-dialog-title-"+ ++Me,this._focusInitial=()=>{const e=this._focusableElements(),t=e.find(e=>e.hasAttribute("autofocus"))||e[0]||(this._useHaDialog?null:this.renderRoot.querySelector(".close"))||this.renderRoot.querySelector(".surface")||this.renderRoot.querySelector("ha-dialog");t?.focus({preventScroll:!0})},this._requestClose=()=>{this._closing||(this._closing=!0,this.dispatchEvent(new CustomEvent("hp-close",{bubbles:!0,composed:!0})))},this._onKeyDown=e=>{if("Escape"===e.key){e.preventDefault(),e.stopImmediatePropagation(),this._pruneOverlays();const t=this._overlays[this._overlays.length-1];return t?void this._closeOverlay(t,"escape"):void this._requestClose()}if("Tab"!==e.key||this._useHaDialog)return;const t=this.renderRoot.querySelector(".close"),i=t?[t,...this._focusableElements()]:this._focusableElements();if(!i.length)return e.preventDefault(),void this.renderRoot.querySelector(".surface")?.focus({preventScroll:!0});const n=this._deepActiveElement(),r=i[0],o=i[i.length-1];!e.shiftKey||n!==r&&i.includes(n)?e.shiftKey||n!==o||(e.preventDefault(),r.focus()):(e.preventDefault(),o.focus())},this._onFallbackCancel=e=>{e.preventDefault(),this._requestClose()},this._onFallbackClick=e=>{this.dismissOnScrim&&e.target===e.currentTarget&&this._requestClose()}}connectedCallback(){super.connectedCallback(),this._opener=this._deepActiveElement();const e=this.getRootNode();this._focusRoot=e;const t=Se.get(e)||{dialogs:new Set,opener:this._opener};t.dialogs.add(this),Se.set(e,t),this._useHaDialog=!!customElements.get("ha-dialog"),this.addEventListener("keydown",this._onKeyDown,!0)}disconnectedCallback(){this.removeEventListener("keydown",this._onKeyDown,!0);const e=[...this._overlays];this._overlays=[];for(const t of e.reverse())t.close("disconnect");const t=this._focusRoot,i=this._opener;this._opener=null,this._focusRoot=null;const n=t?Se.get(t):void 0;n?.dialogs.delete(this),super.disconnectedCallback(),t&&n&&requestAnimationFrame(()=>{const e=Se.get(t);if(!e)return;if(!e.dialogs.size)return e.opener?.isConnected&&e.opener.focus({preventScroll:!0}),void Se.delete(t);const n=i?.closest("hp-dialog");i?.isConnected&&n&&e.dialogs.has(n)&&i.focus({preventScroll:!0})})}firstUpdated(e){if(super.firstUpdated(e),!this._useHaDialog){const e=this.renderRoot.querySelector("dialog");e&&!e.open&&e.showModal()}queueMicrotask(()=>this._focusInitial())}_deepActiveElement(){let e=document.activeElement;for(;e?.shadowRoot?.activeElement;)e=e.shadowRoot.activeElement;return e&&e!==document.body?e:null}_focusableElements(){const e=["[autofocus]","a[href]","button:not([disabled])",'input:not([disabled]):not([type="hidden"])',"select:not([disabled])","textarea:not([disabled])",'[contenteditable="true"]','[tabindex]:not([tabindex="-1"])'].join(","),t=[],i=new Set,n=r=>{if(!i.has(r)){if(i.add(r),r instanceof HTMLElement){if(r.matches(e)&&t.push(r),r instanceof HTMLSlotElement){for(const e of r.assignedNodes({flatten:!0}))n(e);return}if(r.shadowRoot){for(const e of r.shadowRoot.childNodes)n(e);return}}for(const e of r.childNodes)n(e)}};for(const e of this.childNodes)n(e);const r=this.overlayPortal();return r&&n(r),t.filter(e=>{let t=e;for(;t;){const e=getComputedStyle(t);if(t.hidden||t.inert||"true"===t.getAttribute("aria-hidden")||"none"===e.display||"hidden"===e.visibility)return!1;if(t=t.assignedSlot||t.parentElement||(t.getRootNode()instanceof ShadowRoot?t.getRootNode().host:null),t===this)break}return!0})}_pruneOverlays(){this._overlays=this._overlays.filter(e=>e.owner.isConnected)}_closeOverlay(e,t){const i=this._overlays.findIndex(t=>t.token===e.token);i>=0&&this._overlays.splice(i,1),e.close(t)}registerOverlay(e){this._pruneOverlays();const t=this._overlays.find(t=>t.owner===e.owner);t&&this._overlays.splice(this._overlays.indexOf(t),1);const i=e.group||"transient";for(const e of[...this._overlays].reverse())e.group===i&&this._closeOverlay(e,"exclusive");const n={...e,group:i,token:Symbol("hp-overlay")};this._overlays.push(n);let r=!1;return()=>{if(r)return;r=!0;const e=this._overlays.findIndex(e=>e.token===n.token);e>=0&&this._overlays.splice(e,1)}}closeTransientOverlays(e="outside"){this._pruneOverlays();const t=[...this._overlays].filter(e=>"transient"===(e.group||"transient"));for(const i of t.reverse())this._closeOverlay(i,e);return t.length>0}overlayPortal(){return this.renderRoot.querySelector(".overlay-portal")}render(){const e=B`<span class="title" id=${this._titleId}>
      ${this.icon?B`<ha-icon icon=${this.icon}></ha-icon>`:G}
      <span class="title-text">${this.title}</span>
    </span>`;return this._useHaDialog?B`<ha-dialog
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
      </ha-dialog><div class="overlay-portal"></div>`:B`<dialog
      role="dialog"
      aria-modal="true"
      aria-labelledby=${this._titleId}
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
    </dialog>`}}Re.properties={title:{type:String},icon:{type:String},wide:{type:Boolean,reflect:!0},dismissOnScrim:{type:Boolean,attribute:"dismiss-on-scrim"},hass:{attribute:!1}},Re.styles=o`
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
  `,customElements.get("hp-dialog")||customElements.define("hp-dialog",Re);const Te=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),Ce=[{pattern:"протечк|leak|water sensor",icon:"mdi:water-alert"},{pattern:"клапан|valve",icon:"mdi:pipe-valve"},{pattern:"дым|smoke",icon:"mdi:smoke-detector"},{pattern:"термоголов|trv|radiator",icon:"mdi:radiator"},{pattern:"чайник|kettle|термопот",icon:"mdi:kettle"},{pattern:"сауна|sauna|harvia|парная|парилк",icon:"mdi:hot-tub"},{pattern:"температ|temperature|thermometer|climate sensor",icon:"mdi:thermometer"},{pattern:"qingping|air monitor|молекул|air quality",icon:"mdi:air-filter"},{pattern:"штор|curtain|blind|shade",icon:"mdi:roller-shade"},{pattern:"розетк|plug|socket|outlet",icon:"mdi:power-socket-de"},{pattern:"выключат|switch",icon:"mdi:light-switch"},{pattern:"лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip",icon:"mdi:lightbulb"},{pattern:"камер|camera",icon:"mdi:cctv"},{pattern:"замок|ttlock|lock|sn609|sn9161",icon:"mdi:lock"},{pattern:"ворота|garage|gate",icon:"mdi:garage-variant"},{pattern:"калитк|door|открыт|contact",icon:"mdi:door"},{pattern:"счётчик|счетчик|kws|meter",icon:"mdi:meter-electric"},{pattern:"вводный автомат|breaker|wifimcbn",icon:"mdi:electric-switch"},{pattern:"myheat|котёл|котел|boiler|отоплен|heating",icon:"mdi:water-boiler"},{pattern:"холодильник|fridge",icon:"mdi:fridge"},{pattern:"стиральн|washer|washing",icon:"mdi:washing-machine"},{pattern:"сушилк|dryer",icon:"mdi:tumble-dryer"},{pattern:"пылесос|vacuum|dreame|roborock",icon:"mdi:robot-vacuum"},{pattern:"soundbar",icon:"mdi:soundbar"},{pattern:"колонк|станц|speaker|яндекс|yandex|алиса|alice",icon:"mdi:speaker"},{pattern:"tv|телевизор|hyundaitv|mitv|television",icon:"mdi:television"},{pattern:"keenetic|роутер|router|mesh|access point",icon:"mdi:router-wireless"},{pattern:"ибп|ups|kirpich",icon:"mdi:battery-charging-high"},{pattern:"slzb|координат|zigbee|coordinator",icon:"mdi:zigbee"},{pattern:"motion|движен|presence|присутств",icon:"mdi:motion-sensor"},{pattern:"humidity|влажн",icon:"mdi:water-percent"}];function De(e){const t=[];for(const i of e)if(i&&"string"==typeof i.pattern&&i.icon)try{t.push({re:new RegExp(i.pattern,"i"),icon:i.icon})}catch{}return t}function Ae(e){try{return new RegExp(e,"i"),!0}catch{return!1}}const Oe=De(Ce),ze={temperature:"mdi:thermometer",humidity:"mdi:water-percent",motion:"mdi:motion-sensor",occupancy:"mdi:motion-sensor",presence:"mdi:motion-sensor",door:"mdi:door",window:"mdi:window-closed",garage_door:"mdi:garage-variant",smoke:"mdi:smoke-detector",moisture:"mdi:water-alert",gas:"mdi:gas-cylinder",power:"mdi:meter-electric",energy:"mdi:meter-electric",illuminance:"mdi:brightness-5",co2:"mdi:molecule-co2",pm25:"mdi:air-filter",battery:"mdi:battery"},Pe="mdi:chip";function Fe(e,t,i){const n=((e||"")+" "+(t||"")).toLowerCase();for(const{re:e,icon:t}of i??Oe)if(e.test(n))return t;return Pe}const Ie=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];var Ee=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,Ne=Math.ceil,He=Math.floor,Le="[BigNumber Error] ",qe=Le+"Number primitive has more than 15 significant digits: ",je=1e14,Be=14,We=9007199254740991,Ue=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],Ge=1e7,Ve=1e9;function Ke(e){var t=0|e;return e>0||e===t?t:t-1}function Ye(e){for(var t,i,n=1,r=e.length,o=e[0]+"";n<r;){for(t=e[n++]+"",i=Be-t.length;i--;t="0"+t);o+=t}for(r=o.length;48===o.charCodeAt(--r););return o.slice(0,r+1||1)}function Ze(e,t){var i,n,r=e.c,o=t.c,s=e.s,a=t.s,l=e.e,c=t.e;if(!s||!a)return null;if(i=r&&!r[0],n=o&&!o[0],i||n)return i?n?0:-a:s;if(s!=a)return s;if(i=s<0,n=l==c,!r||!o)return n?0:!r^i?1:-1;if(!n)return l>c^i?1:-1;for(a=(l=r.length)<(c=o.length)?l:c,s=0;s<a;s++)if(r[s]!=o[s])return r[s]>o[s]^i?1:-1;return l==c?0:l>c^i?1:-1}function Xe(e,t,i,n){if(e<t||e>i||e!==He(e))throw Error(Le+(n||"Argument")+("number"==typeof e?e<t||e>i?" out of range: ":" not an integer: ":" not a primitive number: ")+String(e))}function Je(e){var t=e.c.length-1;return Ke(e.e/Be)==t&&e.c[t]%2!=0}function Qe(e,t){return(e.length>1?e.charAt(0)+"."+e.slice(1):e)+(t<0?"e":"e+")+t}function et(e,t,i){var n,r;if(t<0){for(r=i+".";++t;r+=i);e=r+e}else if(++t>(n=e.length)){for(r=i,t-=n;--t;r+=i);e+=r}else t<n&&(e=e.slice(0,t)+"."+e.slice(t));return e}var tt=function e(t){var i,n,r,o,s,a,l,c,h,d,u=M.prototype={constructor:M,toString:null,valueOf:null},p=new M(1),_=20,m=4,g=-7,f=21,v=-1e7,y=1e7,b=!1,w=1,k=0,x={prefix:"",groupSize:3,secondaryGroupSize:0,groupSeparator:",",decimalSeparator:".",fractionGroupSize:0,fractionGroupSeparator:" ",suffix:""},$="0123456789abcdefghijklmnopqrstuvwxyz",S=!0;function M(e,t){var i,o,s,a,l,c,h,d,u=this;if(!(u instanceof M))return new M(e,t);if(null==t){if(e&&!0===e._isBigNumber)return u.s=e.s,void(!e.c||e.e>y?u.c=u.e=null:e.e<v?u.c=[u.e=0]:(u.e=e.e,u.c=e.c.slice()));if((c="number"==typeof e)&&0*e==0){if(u.s=1/e<0?(e=-e,-1):1,e===~~e){for(a=0,l=e;l>=10;l/=10,a++);return void(a>y?u.c=u.e=null:(u.e=a,u.c=[e]))}d=String(e)}else{if(!Ee.test(d=String(e)))return r(u,d,c);u.s=45==d.charCodeAt(0)?(d=d.slice(1),-1):1}(a=d.indexOf("."))>-1&&(d=d.replace(".","")),(l=d.search(/e/i))>0?(a<0&&(a=l),a+=+d.slice(l+1),d=d.substring(0,l)):a<0&&(a=d.length)}else{if(Xe(t,2,$.length,"Base"),10==t&&S)return D(u=new M(e),_+u.e+1,m);if(d=String(e),c="number"==typeof e){if(0*e!=0)return r(u,d,c,t);if(u.s=1/e<0?(d=d.slice(1),-1):1,M.DEBUG&&d.replace(/^0\.0*|\./,"").length>15)throw Error(qe+e)}else u.s=45===d.charCodeAt(0)?(d=d.slice(1),-1):1;for(i=$.slice(0,t),a=l=0,h=d.length;l<h;l++)if(i.indexOf(o=d.charAt(l))<0){if("."==o){if(l>a){a=h;continue}}else if(!s&&(d==d.toUpperCase()&&(d=d.toLowerCase())||d==d.toLowerCase()&&(d=d.toUpperCase()))){s=!0,l=-1,a=0;continue}return r(u,String(e),c,t)}c=!1,(a=(d=n(d,t,10,u.s)).indexOf("."))>-1?d=d.replace(".",""):a=d.length}for(l=0;48===d.charCodeAt(l);l++);for(h=d.length;48===d.charCodeAt(--h););if(d=d.slice(l,++h)){if(h-=l,c&&M.DEBUG&&h>15&&(e>We||e!==He(e)))throw Error(qe+u.s*e);if((a=a-l-1)>y)u.c=u.e=null;else if(a<v)u.c=[u.e=0];else{if(u.e=a,u.c=[],l=(a+1)%Be,a<0&&(l+=Be),l<h){for(l&&u.c.push(+d.slice(0,l)),h-=Be;l<h;)u.c.push(+d.slice(l,l+=Be));l=Be-(d=d.slice(l)).length}else l-=h;for(;l--;d+="0");u.c.push(+d)}}else u.c=[u.e=0]}function R(e,t,i,n){var r,o,s,a,l;if(null==i?i=m:Xe(i,0,8),!e.c)return e.toString();if(r=e.c[0],s=e.e,null==t)l=Ye(e.c),l=1==n||2==n&&(s<=g||s>=f)?Qe(l,s):et(l,s,"0");else if(o=(e=D(new M(e),t,i)).e,a=(l=Ye(e.c)).length,1==n||2==n&&(t<=o||o<=g)){for(;a<t;l+="0",a++);l=Qe(l,o)}else if(t-=s+(2===n&&o>s),l=et(l,o,"0"),o+1>a){if(--t>0)for(l+=".";t--;l+="0");}else if((t+=o-a)>0)for(o+1==a&&(l+=".");t--;l+="0");return e.s<0&&r?"-"+l:l}function T(e,t){for(var i,n,r=1,o=new M(e[0]);r<e.length;r++)(!(n=new M(e[r])).s||(i=Ze(o,n))===t||0===i&&o.s===t)&&(o=n);return o}function C(e,t,i){for(var n=1,r=t.length;!t[--r];t.pop());for(r=t[0];r>=10;r/=10,n++);return(i=n+i*Be-1)>y?e.c=e.e=null:i<v?e.c=[e.e=0]:(e.e=i,e.c=t),e}function D(e,t,i,n){var r,o,s,a,l,c,h,d=e.c,u=Ue;if(d){e:{for(r=1,a=d[0];a>=10;a/=10,r++);if((o=t-r)<0)o+=Be,s=t,l=d[c=0],h=He(l/u[r-s-1]%10);else if((c=Ne((o+1)/Be))>=d.length){if(!n)break e;for(;d.length<=c;d.push(0));l=h=0,r=1,s=(o%=Be)-Be+1}else{for(l=a=d[c],r=1;a>=10;a/=10,r++);h=(s=(o%=Be)-Be+r)<0?0:He(l/u[r-s-1]%10)}if(n=n||t<0||null!=d[c+1]||(s<0?l:l%u[r-s-1]),n=i<4?(h||n)&&(0==i||i==(e.s<0?3:2)):h>5||5==h&&(4==i||n||6==i&&(o>0?s>0?l/u[r-s]:0:d[c-1])%10&1||i==(e.s<0?8:7)),t<1||!d[0])return d.length=0,n?(t-=e.e+1,d[0]=u[(Be-t%Be)%Be],e.e=-t||0):d[0]=e.e=0,e;if(0==o?(d.length=c,a=1,c--):(d.length=c+1,a=u[Be-o],d[c]=s>0?He(l/u[r-s]%u[s])*a:0),n)for(;;){if(0==c){for(o=1,s=d[0];s>=10;s/=10,o++);for(s=d[0]+=a,a=1;s>=10;s/=10,a++);o!=a&&(e.e++,d[0]==je&&(d[0]=1));break}if(d[c]+=a,d[c]!=je)break;d[c--]=0,a=1}for(o=d.length;0===d[--o];d.pop());}e.e>y?e.c=e.e=null:e.e<v&&(e.c=[e.e=0])}return e}function A(e){var t,i=e.e;return null===i?e.toString():(t=Ye(e.c),t=i<=g||i>=f?Qe(t,i):et(t,i,"0"),e.s<0?"-"+t:t)}return M.clone=e,M.ROUND_UP=0,M.ROUND_DOWN=1,M.ROUND_CEIL=2,M.ROUND_FLOOR=3,M.ROUND_HALF_UP=4,M.ROUND_HALF_DOWN=5,M.ROUND_HALF_EVEN=6,M.ROUND_HALF_CEIL=7,M.ROUND_HALF_FLOOR=8,M.EUCLID=9,M.config=M.set=function(e){var t,i;if(null!=e){if("object"!=typeof e)throw Error(Le+"Object expected: "+e);if(e.hasOwnProperty(t="DECIMAL_PLACES")&&(Xe(i=e[t],0,Ve,t),_=i),e.hasOwnProperty(t="ROUNDING_MODE")&&(Xe(i=e[t],0,8,t),m=i),e.hasOwnProperty(t="EXPONENTIAL_AT")&&((i=e[t])&&i.pop?(Xe(i[0],-Ve,0,t),Xe(i[1],0,Ve,t),g=i[0],f=i[1]):(Xe(i,-Ve,Ve,t),g=-(f=i<0?-i:i))),e.hasOwnProperty(t="RANGE"))if((i=e[t])&&i.pop)Xe(i[0],-Ve,-1,t),Xe(i[1],1,Ve,t),v=i[0],y=i[1];else{if(Xe(i,-Ve,Ve,t),!i)throw Error(Le+t+" cannot be zero: "+i);v=-(y=i<0?-i:i)}if(e.hasOwnProperty(t="CRYPTO")){if((i=e[t])!==!!i)throw Error(Le+t+" not true or false: "+i);if(i){if("undefined"==typeof crypto||!crypto||!crypto.getRandomValues&&!crypto.randomBytes)throw b=!i,Error(Le+"crypto unavailable");b=i}else b=i}if(e.hasOwnProperty(t="MODULO_MODE")&&(Xe(i=e[t],0,9,t),w=i),e.hasOwnProperty(t="POW_PRECISION")&&(Xe(i=e[t],0,Ve,t),k=i),e.hasOwnProperty(t="FORMAT")){if("object"!=typeof(i=e[t]))throw Error(Le+t+" not an object: "+i);x=i}if(e.hasOwnProperty(t="ALPHABET")){if("string"!=typeof(i=e[t])||/^.?$|[+\-.\s]|(.).*\1/.test(i))throw Error(Le+t+" invalid: "+i);S="0123456789"==i.slice(0,10),$=i}}return{DECIMAL_PLACES:_,ROUNDING_MODE:m,EXPONENTIAL_AT:[g,f],RANGE:[v,y],CRYPTO:b,MODULO_MODE:w,POW_PRECISION:k,FORMAT:x,ALPHABET:$}},M.isBigNumber=function(e){if(!e||!0!==e._isBigNumber)return!1;if(!M.DEBUG)return!0;var t,i,n=e.c,r=e.e,o=e.s;e:if("[object Array]"=={}.toString.call(n)){if((1===o||-1===o)&&r>=-Ve&&r<=Ve&&r===He(r)){if(0===n[0]){if(0===r&&1===n.length)return!0;break e}if((t=(r+1)%Be)<1&&(t+=Be),String(n[0]).length==t){for(t=0;t<n.length;t++)if((i=n[t])<0||i>=je||i!==He(i))break e;if(0!==i)return!0}}}else if(null===n&&null===r&&(null===o||1===o||-1===o))return!0;throw Error(Le+"Invalid BigNumber: "+e)},M.maximum=M.max=function(){return T(arguments,-1)},M.minimum=M.min=function(){return T(arguments,1)},M.random=(o=9007199254740992,s=Math.random()*o&2097151?function(){return He(Math.random()*o)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(e){var t,i,n,r,o,a=0,l=[],c=new M(p);if(null==e?e=_:Xe(e,0,Ve),r=Ne(e/Be),b)if(crypto.getRandomValues){for(t=crypto.getRandomValues(new Uint32Array(r*=2));a<r;)(o=131072*t[a]+(t[a+1]>>>11))>=9e15?(i=crypto.getRandomValues(new Uint32Array(2)),t[a]=i[0],t[a+1]=i[1]):(l.push(o%1e14),a+=2);a=r/2}else{if(!crypto.randomBytes)throw b=!1,Error(Le+"crypto unavailable");for(t=crypto.randomBytes(r*=7);a<r;)(o=281474976710656*(31&t[a])+1099511627776*t[a+1]+4294967296*t[a+2]+16777216*t[a+3]+(t[a+4]<<16)+(t[a+5]<<8)+t[a+6])>=9e15?crypto.randomBytes(7).copy(t,a):(l.push(o%1e14),a+=7);a=r/7}if(!b)for(;a<r;)(o=s())<9e15&&(l[a++]=o%1e14);for(r=l[--a],e%=Be,r&&e&&(o=Ue[Be-e],l[a]=He(r/o)*o);0===l[a];l.pop(),a--);if(a<0)l=[n=0];else{for(n=-1;0===l[0];l.splice(0,1),n-=Be);for(a=1,o=l[0];o>=10;o/=10,a++);a<Be&&(n-=Be-a)}return c.e=n,c.c=l,c}),M.sum=function(){for(var e=1,t=arguments,i=new M(t[0]);e<t.length;)i=i.plus(t[e++]);return i},n=function(){var e="0123456789";function t(e,t,i,n){for(var r,o,s=[0],a=0,l=e.length;a<l;){for(o=s.length;o--;s[o]*=t);for(s[0]+=n.indexOf(e.charAt(a++)),r=0;r<s.length;r++)s[r]>i-1&&(null==s[r+1]&&(s[r+1]=0),s[r+1]+=s[r]/i|0,s[r]%=i)}return s.reverse()}return function(n,r,o,s,a){var l,c,h,d,u,p,g,f,v=n.indexOf("."),y=_,b=m;for(v>=0&&(d=k,k=0,n=n.replace(".",""),p=(f=new M(r)).pow(n.length-v),k=d,f.c=t(et(Ye(p.c),p.e,"0"),10,o,e),f.e=f.c.length),h=d=(g=t(n,r,o,a?(l=$,e):(l=e,$))).length;0==g[--d];g.pop());if(!g[0])return l.charAt(0);if(v<0?--h:(p.c=g,p.e=h,p.s=s,g=(p=i(p,f,y,b,o)).c,u=p.r,h=p.e),v=g[c=h+y+1],d=o/2,u=u||c<0||null!=g[c+1],u=b<4?(null!=v||u)&&(0==b||b==(p.s<0?3:2)):v>d||v==d&&(4==b||u||6==b&&1&g[c-1]||b==(p.s<0?8:7)),c<1||!g[0])n=u?et(l.charAt(1),-y,l.charAt(0)):l.charAt(0);else{if(g.length=c,u)for(--o;++g[--c]>o;)g[c]=0,c||(++h,g=[1].concat(g));for(d=g.length;!g[--d];);for(v=0,n="";v<=d;n+=l.charAt(g[v++]));n=et(n,h,l.charAt(0))}return n}}(),i=function(){function e(e,t,i){var n,r,o,s,a=0,l=e.length,c=t%Ge,h=t/Ge|0;for(e=e.slice();l--;)a=((r=c*(o=e[l]%Ge)+(n=h*o+(s=e[l]/Ge|0)*c)%Ge*Ge+a)/i|0)+(n/Ge|0)+h*s,e[l]=r%i;return a&&(e=[a].concat(e)),e}function t(e,t,i,n){var r,o;if(i!=n)o=i>n?1:-1;else for(r=o=0;r<i;r++)if(e[r]!=t[r]){o=e[r]>t[r]?1:-1;break}return o}function i(e,t,i,n){for(var r=0;i--;)e[i]-=r,r=e[i]<t[i]?1:0,e[i]=r*n+e[i]-t[i];for(;!e[0]&&e.length>1;e.splice(0,1));}return function(n,r,o,s,a){var l,c,h,d,u,p,_,m,g,f,v,y,b,w,k,x,$,S=n.s==r.s?1:-1,R=n.c,T=r.c;if(!(R&&R[0]&&T&&T[0]))return new M(n.s&&r.s&&(R?!T||R[0]!=T[0]:T)?R&&0==R[0]||!T?0*S:S/0:NaN);for(g=(m=new M(S)).c=[],S=o+(c=n.e-r.e)+1,a||(a=je,c=Ke(n.e/Be)-Ke(r.e/Be),S=S/Be|0),h=0;T[h]==(R[h]||0);h++);if(T[h]>(R[h]||0)&&c--,S<0)g.push(1),d=!0;else{for(w=R.length,x=T.length,h=0,S+=2,(u=He(a/(T[0]+1)))>1&&(T=e(T,u,a),R=e(R,u,a),x=T.length,w=R.length),b=x,v=(f=R.slice(0,x)).length;v<x;f[v++]=0);$=T.slice(),$=[0].concat($),k=T[0],T[1]>=a/2&&k++;do{if(u=0,(l=t(T,f,x,v))<0){if(y=f[0],x!=v&&(y=y*a+(f[1]||0)),(u=He(y/k))>1)for(u>=a&&(u=a-1),_=(p=e(T,u,a)).length,v=f.length;1==t(p,f,_,v);)u--,i(p,x<_?$:T,_,a),_=p.length,l=1;else 0==u&&(l=u=1),_=(p=T.slice()).length;if(_<v&&(p=[0].concat(p)),i(f,p,v,a),v=f.length,-1==l)for(;t(T,f,x,v)<1;)u++,i(f,x<v?$:T,v,a),v=f.length}else 0===l&&(u++,f=[0]);g[h++]=u,f[0]?f[v++]=R[b]||0:(f=[R[b]],v=1)}while((b++<w||null!=f[0])&&S--);d=null!=f[0],g[0]||g.splice(0,1)}if(a==je){for(h=1,S=g[0];S>=10;S/=10,h++);D(m,o+(m.e=h+c*Be-1)+1,s,d)}else m.e=c,m.r=+d;return m}}(),a=/^(-?)0([xbo])(?=\w[\w.]*$)/i,l=/^([^.]+)\.$/,c=/^\.([^.]+)$/,h=/^-?(Infinity|NaN)$/,d=/^\s*\+(?=[\w.])|^\s+|\s+$/g,r=function(e,t,i,n){var r,o=i?t:t.replace(d,"");if(h.test(o))e.s=isNaN(o)?null:o<0?-1:1;else{if(!i&&(o=o.replace(a,function(e,t,i){return r="x"==(i=i.toLowerCase())?16:"b"==i?2:8,n&&n!=r?e:t}),n&&(r=n,o=o.replace(l,"$1").replace(c,"0.$1")),t!=o))return new M(o,r);if(M.DEBUG)throw Error(Le+"Not a"+(n?" base "+n:"")+" number: "+t);e.s=null}e.c=e.e=null},u.absoluteValue=u.abs=function(){var e=new M(this);return e.s<0&&(e.s=1),e},u.comparedTo=function(e,t){return Ze(this,new M(e,t))},u.decimalPlaces=u.dp=function(e,t){var i,n,r,o=this;if(null!=e)return Xe(e,0,Ve),null==t?t=m:Xe(t,0,8),D(new M(o),e+o.e+1,t);if(!(i=o.c))return null;if(n=((r=i.length-1)-Ke(this.e/Be))*Be,r=i[r])for(;r%10==0;r/=10,n--);return n<0&&(n=0),n},u.dividedBy=u.div=function(e,t){return i(this,new M(e,t),_,m)},u.dividedToIntegerBy=u.idiv=function(e,t){return i(this,new M(e,t),0,1)},u.exponentiatedBy=u.pow=function(e,t){var i,n,r,o,s,a,l,c,h=this;if((e=new M(e)).c&&!e.isInteger())throw Error(Le+"Exponent not an integer: "+A(e));if(null!=t&&(t=new M(t)),s=e.e>14,!h.c||!h.c[0]||1==h.c[0]&&!h.e&&1==h.c.length||!e.c||!e.c[0])return c=new M(Math.pow(+A(h),s?e.s*(2-Je(e)):+A(e))),t?c.mod(t):c;if(a=e.s<0,t){if(t.c?!t.c[0]:!t.s)return new M(NaN);(n=!a&&h.isInteger()&&t.isInteger())&&(h=h.mod(t))}else{if(e.e>9&&(h.e>0||h.e<-1||(0==h.e?h.c[0]>1||s&&h.c[1]>=24e7:h.c[0]<8e13||s&&h.c[0]<=9999975e7)))return o=h.s<0&&Je(e)?-0:0,h.e>-1&&(o=1/o),new M(a?1/o:o);k&&(o=Ne(k/Be+2))}for(s?(i=new M(.5),a&&(e.s=1),l=Je(e)):l=(r=Math.abs(+A(e)))%2,c=new M(p);;){if(l){if(!(c=c.times(h)).c)break;o?c.c.length>o&&(c.c.length=o):n&&(c=c.mod(t))}if(r){if(0===(r=He(r/2)))break;l=r%2}else if(D(e=e.times(i),e.e+1,1),e.e>14)l=Je(e);else{if(0===(r=+A(e)))break;l=r%2}h=h.times(h),o?h.c&&h.c.length>o&&(h.c.length=o):n&&(h=h.mod(t))}return n?c:(a&&(c=p.div(c)),t?c.mod(t):o?D(c,k,m,void 0):c)},u.integerValue=function(e){var t=new M(this);return null==e?e=m:Xe(e,0,8),D(t,t.e+1,e)},u.isEqualTo=u.eq=function(e,t){return 0===Ze(this,new M(e,t))},u.isFinite=function(){return!!this.c},u.isGreaterThan=u.gt=function(e,t){return Ze(this,new M(e,t))>0},u.isGreaterThanOrEqualTo=u.gte=function(e,t){return 1===(t=Ze(this,new M(e,t)))||0===t},u.isInteger=function(){return!!this.c&&Ke(this.e/Be)>this.c.length-2},u.isLessThan=u.lt=function(e,t){return Ze(this,new M(e,t))<0},u.isLessThanOrEqualTo=u.lte=function(e,t){return-1===(t=Ze(this,new M(e,t)))||0===t},u.isNaN=function(){return!this.s},u.isNegative=function(){return this.s<0},u.isPositive=function(){return this.s>0},u.isZero=function(){return!!this.c&&0==this.c[0]},u.minus=function(e,t){var i,n,r,o,s=this,a=s.s;if(t=(e=new M(e,t)).s,!a||!t)return new M(NaN);if(a!=t)return e.s=-t,s.plus(e);var l=s.e/Be,c=e.e/Be,h=s.c,d=e.c;if(!l||!c){if(!h||!d)return h?(e.s=-t,e):new M(d?s:NaN);if(!h[0]||!d[0])return d[0]?(e.s=-t,e):new M(h[0]?s:3==m?-0:0)}if(l=Ke(l),c=Ke(c),h=h.slice(),a=l-c){for((o=a<0)?(a=-a,r=h):(c=l,r=d),r.reverse(),t=a;t--;r.push(0));r.reverse()}else for(n=(o=(a=h.length)<(t=d.length))?a:t,a=t=0;t<n;t++)if(h[t]!=d[t]){o=h[t]<d[t];break}if(o&&(r=h,h=d,d=r,e.s=-e.s),(t=(n=d.length)-(i=h.length))>0)for(;t--;h[i++]=0);for(t=je-1;n>a;){if(h[--n]<d[n]){for(i=n;i&&!h[--i];h[i]=t);--h[i],h[n]+=je}h[n]-=d[n]}for(;0==h[0];h.splice(0,1),--c);return h[0]?C(e,h,c):(e.s=3==m?-1:1,e.c=[e.e=0],e)},u.modulo=u.mod=function(e,t){var n,r,o=this;return e=new M(e,t),!o.c||!e.s||e.c&&!e.c[0]?new M(NaN):!e.c||o.c&&!o.c[0]?new M(o):(9==w?(r=e.s,e.s=1,n=i(o,e,0,3),e.s=r,n.s*=r):n=i(o,e,0,w),(e=o.minus(n.times(e))).c[0]||1!=w||(e.s=o.s),e)},u.multipliedBy=u.times=function(e,t){var i,n,r,o,s,a,l,c,h,d,u,p,_,m,g,f=this,v=f.c,y=(e=new M(e,t)).c;if(!(v&&y&&v[0]&&y[0]))return!f.s||!e.s||v&&!v[0]&&!y||y&&!y[0]&&!v?e.c=e.e=e.s=null:(e.s*=f.s,v&&y?(e.c=[0],e.e=0):e.c=e.e=null),e;for(n=Ke(f.e/Be)+Ke(e.e/Be),e.s*=f.s,(l=v.length)<(d=y.length)&&(_=v,v=y,y=_,r=l,l=d,d=r),r=l+d,_=[];r--;_.push(0));for(m=je,g=Ge,r=d;--r>=0;){for(i=0,u=y[r]%g,p=y[r]/g|0,o=r+(s=l);o>r;)i=((c=u*(c=v[--s]%g)+(a=p*c+(h=v[s]/g|0)*u)%g*g+_[o]+i)/m|0)+(a/g|0)+p*h,_[o--]=c%m;_[o]=i}return i?++n:_.splice(0,1),C(e,_,n)},u.negated=function(){var e=new M(this);return e.s=-e.s||null,e},u.plus=function(e,t){var i,n=this,r=n.s;if(t=(e=new M(e,t)).s,!r||!t)return new M(NaN);if(r!=t)return e.s=-t,n.minus(e);var o=n.e/Be,s=e.e/Be,a=n.c,l=e.c;if(!o||!s){if(!a||!l)return new M(r/0);if(!a[0]||!l[0])return l[0]?e:new M(a[0]?n:0*r)}if(o=Ke(o),s=Ke(s),a=a.slice(),r=o-s){for(r>0?(s=o,i=l):(r=-r,i=a),i.reverse();r--;i.push(0));i.reverse()}for((r=a.length)-(t=l.length)<0&&(i=l,l=a,a=i,t=r),r=0;t;)r=(a[--t]=a[t]+l[t]+r)/je|0,a[t]=je===a[t]?0:a[t]%je;return r&&(a=[r].concat(a),++s),C(e,a,s)},u.precision=u.sd=function(e,t){var i,n,r,o=this;if(null!=e&&e!==!!e)return Xe(e,1,Ve),null==t?t=m:Xe(t,0,8),D(new M(o),e,t);if(!(i=o.c))return null;if(n=(r=i.length-1)*Be+1,r=i[r]){for(;r%10==0;r/=10,n--);for(r=i[0];r>=10;r/=10,n++);}return e&&o.e+1>n&&(n=o.e+1),n},u.shiftedBy=function(e){return Xe(e,-9007199254740991,We),this.times("1e"+e)},u.squareRoot=u.sqrt=function(){var e,t,n,r,o,s=this,a=s.c,l=s.s,c=s.e,h=_+4,d=new M("0.5");if(1!==l||!a||!a[0])return new M(!l||l<0&&(!a||a[0])?NaN:a?s:1/0);if(0==(l=Math.sqrt(+A(s)))||l==1/0?(((t=Ye(a)).length+c)%2==0&&(t+="0"),l=Math.sqrt(+t),c=Ke((c+1)/2)-(c<0||c%2),n=new M(t=l==1/0?"5e"+c:(t=l.toExponential()).slice(0,t.indexOf("e")+1)+c)):n=new M(l+""),n.c[0])for((l=(c=n.e)+h)<3&&(l=0);;)if(o=n,n=d.times(o.plus(i(s,o,h,1))),Ye(o.c).slice(0,l)===(t=Ye(n.c)).slice(0,l)){if(n.e<c&&--l,"9999"!=(t=t.slice(l-3,l+1))&&(r||"4999"!=t)){+t&&(+t.slice(1)||"5"!=t.charAt(0))||(D(n,n.e+_+2,1),e=!n.times(n).eq(s));break}if(!r&&(D(o,o.e+_+2,0),o.times(o).eq(s))){n=o;break}h+=4,l+=4,r=1}return D(n,n.e+_+1,m,e)},u.toExponential=function(e,t){return null!=e&&(Xe(e,0,Ve),e++),R(this,e,t,1)},u.toFixed=function(e,t){return null!=e&&(Xe(e,0,Ve),e=e+this.e+1),R(this,e,t)},u.toFormat=function(e,t,i){var n,r=this;if(null==i)null!=e&&t&&"object"==typeof t?(i=t,t=null):e&&"object"==typeof e?(i=e,e=t=null):i=x;else if("object"!=typeof i)throw Error(Le+"Argument not an object: "+i);if(n=r.toFixed(e,t),r.c){var o,s=n.split("."),a=+i.groupSize,l=+i.secondaryGroupSize,c=i.groupSeparator||"",h=s[0],d=s[1],u=r.s<0,p=u?h.slice(1):h,_=p.length;if(l&&(o=a,a=l,l=o,_-=o),a>0&&_>0){for(o=_%a||a,h=p.substr(0,o);o<_;o+=a)h+=c+p.substr(o,a);l>0&&(h+=c+p.slice(o)),u&&(h="-"+h)}n=d?h+(i.decimalSeparator||"")+((l=+i.fractionGroupSize)?d.replace(new RegExp("\\d{"+l+"}\\B","g"),"$&"+(i.fractionGroupSeparator||"")):d):h}return(i.prefix||"")+n+(i.suffix||"")},u.toFraction=function(e){var t,n,r,o,s,a,l,c,h,d,u,_,g=this,f=g.c;if(null!=e&&(!(l=new M(e)).isInteger()&&(l.c||1!==l.s)||l.lt(p)))throw Error(Le+"Argument "+(l.isInteger()?"out of range: ":"not an integer: ")+A(l));if(!f)return new M(g);for(t=new M(p),h=n=new M(p),r=c=new M(p),_=Ye(f),s=t.e=_.length-g.e-1,t.c[0]=Ue[(a=s%Be)<0?Be+a:a],e=!e||l.comparedTo(t)>0?s>0?t:h:l,a=y,y=1/0,l=new M(_),c.c[0]=0;d=i(l,t,0,1),1!=(o=n.plus(d.times(r))).comparedTo(e);)n=r,r=o,h=c.plus(d.times(o=h)),c=o,t=l.minus(d.times(o=t)),l=o;return o=i(e.minus(n),r,0,1),c=c.plus(o.times(h)),n=n.plus(o.times(r)),c.s=h.s=g.s,u=i(h,r,s*=2,m).minus(g).abs().comparedTo(i(c,n,s,m).minus(g).abs())<1?[h,r]:[c,n],y=a,u},u.toNumber=function(){return+A(this)},u.toPrecision=function(e,t){return null!=e&&Xe(e,1,Ve),R(this,e,t,2)},u.toString=function(e){var t,i=this,r=i.s,o=i.e;return null===o?r?(t="Infinity",r<0&&(t="-"+t)):t="NaN":(null==e?t=o<=g||o>=f?Qe(Ye(i.c),o):et(Ye(i.c),o,"0"):10===e&&S?t=et(Ye((i=D(new M(i),_+o+1,m)).c),i.e,"0"):(Xe(e,2,$.length,"Base"),t=n(et(Ye(i.c),o,"0"),10,e,r,!0)),r<0&&i.c[0]&&(t="-"+t)),t},u.valueOf=u.toJSON=function(){return A(this)},u._isBigNumber=!0,u[Symbol.toStringTag]="BigNumber",u[Symbol.for("nodejs.util.inspect.custom")]=u.valueOf,null!=t&&M.set(t),M}(),it=class{key;left=null;right=null;constructor(e){this.key=e}},nt=class extends it{constructor(e){super(e)}},rt=class{size=0;modificationCount=0;splayCount=0;splay(e){const t=this.root;if(null==t)return this.compare(e,e),-1;let i=null,n=null,r=null,o=null,s=t;const a=this.compare;let l;for(;;)if(l=a(s.key,e),l>0){let t=s.left;if(null==t)break;if(l=a(t.key,e),l>0&&(s.left=t.right,t.right=s,s=t,t=s.left,null==t))break;null==i?n=s:i.left=s,i=s,s=t}else{if(!(l<0))break;{let t=s.right;if(null==t)break;if(l=a(t.key,e),l<0&&(s.right=t.left,t.left=s,s=t,t=s.right,null==t))break;null==r?o=s:r.right=s,r=s,s=t}}return null!=r&&(r.right=s.left,s.left=o),null!=i&&(i.left=s.right,s.right=n),this.root!==s&&(this.root=s,this.splayCount++),l}splayMin(e){let t=e,i=t.left;for(;null!=i;){const e=i;t.left=e.right,e.right=t,t=e,i=t.left}return t}splayMax(e){let t=e,i=t.right;for(;null!=i;){const e=i;t.right=e.left,e.left=t,t=e,i=t.right}return t}_delete(e){if(null==this.root)return null;if(0!=this.splay(e))return null;let t=this.root;const i=t,n=t.left;if(this.size--,null==n)this.root=t.right;else{const e=t.right;t=this.splayMax(n),t.right=e,this.root=t}return this.modificationCount++,i}addNewRoot(e,t){this.size++,this.modificationCount++;const i=this.root;null!=i?(t<0?(e.left=i,e.right=i.right,i.right=null):(e.right=i,e.left=i.left,i.left=null),this.root=e):this.root=e}_first(){const e=this.root;return null==e?null:(this.root=this.splayMin(e),this.root)}_last(){const e=this.root;return null==e?null:(this.root=this.splayMax(e),this.root)}clear(){this.root=null,this.size=0,this.modificationCount++}has(e){return this.validKey(e)&&0==this.splay(e)}defaultCompare(){return(e,t)=>e<t?-1:e>t?1:0}wrap(){return{getRoot:()=>this.root,setRoot:e=>{this.root=e},getSize:()=>this.size,getModificationCount:()=>this.modificationCount,getSplayCount:()=>this.splayCount,setSplayCount:e=>{this.splayCount=e},splay:e=>this.splay(e),has:e=>this.has(e)}}},ot=class e extends rt{root=null;compare;validKey;constructor(e,t){super(),this.compare=e??this.defaultCompare(),this.validKey=t??(e=>null!=e&&null!=e)}delete(e){return!!this.validKey(e)&&null!=this._delete(e)}deleteAll(e){for(const t of e)this.delete(t)}forEach(e){const t=this[Symbol.iterator]();let i;for(;i=t.next(),!i.done;)e(i.value,i.value,this)}add(e){const t=this.splay(e);return 0!=t&&this.addNewRoot(new nt(e),t),this}addAndReturn(e){const t=this.splay(e);return 0!=t&&this.addNewRoot(new nt(e),t),this.root.key}addAll(e){for(const t of e)this.add(t)}isEmpty(){return null==this.root}isNotEmpty(){return null!=this.root}single(){if(0==this.size)throw"Bad state: No element";if(this.size>1)throw"Bad state: Too many element";return this.root.key}first(){if(0==this.size)throw"Bad state: No element";return this._first().key}last(){if(0==this.size)throw"Bad state: No element";return this._last().key}lastBefore(e){if(null==e)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(e)<0)return this.root.key;let t=this.root.left;if(null==t)return null;let i=t.right;for(;null!=i;)t=i,i=t.right;return t.key}firstAfter(e){if(null==e)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(e)>0)return this.root.key;let t=this.root.right;if(null==t)return null;let i=t.left;for(;null!=i;)t=i,i=t.left;return t.key}retainAll(t){const i=new e(this.compare,this.validKey),n=this.modificationCount;for(const e of t){if(n!=this.modificationCount)throw"Concurrent modification during iteration.";this.validKey(e)&&0==this.splay(e)&&i.add(this.root.key)}i.size!=this.size&&(this.root=i.root,this.size=i.size,this.modificationCount++)}lookup(e){if(!this.validKey(e))return null;return 0!=this.splay(e)?null:this.root.key}intersection(t){const i=new e(this.compare,this.validKey);for(const e of this)t.has(e)&&i.add(e);return i}difference(t){const i=new e(this.compare,this.validKey);for(const e of this)t.has(e)||i.add(e);return i}union(e){const t=this.clone();return t.addAll(e),t}clone(){const t=new e(this.compare,this.validKey);return t.size=this.size,t.root=this.copyNode(this.root),t}copyNode(e){if(null==e)return null;const t=new nt(e.key);return function e(t,i){let n,r;do{if(n=t.left,r=t.right,null!=n){const t=new nt(n.key);i.left=t,e(n,t)}if(null!=r){const e=new nt(r.key);i.right=e,t=r,i=e}}while(null!=r)}(e,t),t}toSet(){return this.clone()}entries(){return new lt(this.wrap())}keys(){return this[Symbol.iterator]()}values(){return this[Symbol.iterator]()}[Symbol.iterator](){return new at(this.wrap())}[Symbol.toStringTag]="[object Set]"},st=class{tree;path=new Array;modificationCount=null;splayCount;constructor(e){this.tree=e,this.splayCount=e.getSplayCount()}[Symbol.iterator](){return this}next(){return this.moveNext()?{done:!1,value:this.current()}:{done:!0,value:null}}current(){if(!this.path.length)return null;const e=this.path[this.path.length-1];return this.getValue(e)}rebuildPath(e){this.path.splice(0,this.path.length),this.tree.splay(e),this.path.push(this.tree.getRoot()),this.splayCount=this.tree.getSplayCount()}findLeftMostDescendent(e){for(;null!=e;)this.path.push(e),e=e.left}moveNext(){if(this.modificationCount!=this.tree.getModificationCount()){if(null==this.modificationCount){this.modificationCount=this.tree.getModificationCount();let e=this.tree.getRoot();for(;null!=e;)this.path.push(e),e=e.left;return this.path.length>0}throw"Concurrent modification during iteration."}if(!this.path.length)return!1;this.splayCount!=this.tree.getSplayCount()&&this.rebuildPath(this.path[this.path.length-1].key);let e=this.path[this.path.length-1],t=e.right;if(null!=t){for(;null!=t;)this.path.push(t),t=t.left;return!0}for(this.path.pop();this.path.length&&this.path[this.path.length-1].right===e;)e=this.path.pop();return this.path.length>0}},at=class extends st{getValue(e){return e.key}},lt=class extends st{getValue(e){return[e.key,e.key]}},ct=e=>()=>e,ht=e=>{const t=e?(t,i)=>i.minus(t).abs().isLessThanOrEqualTo(e):ct(!1);return(e,i)=>t(e,i)?0:e.comparedTo(i)};function dt(e){const t=e?(t,i,n,r,o)=>t.exponentiatedBy(2).isLessThanOrEqualTo(r.minus(i).exponentiatedBy(2).plus(o.minus(n).exponentiatedBy(2)).times(e)):ct(!1);return(e,i,n)=>{const r=e.x,o=e.y,s=n.x,a=n.y,l=o.minus(a).times(i.x.minus(s)).minus(r.minus(s).times(i.y.minus(a)));return t(l,r,o,s,a)?0:l.comparedTo(0)}}var ut=e=>e,pt=e=>{if(e){const t=new ot(ht(e)),i=new ot(ht(e)),n=(e,t)=>t.addAndReturn(e),r=e=>({x:n(e.x,t),y:n(e.y,i)});return r({x:new tt(0),y:new tt(0)}),r}return ut},_t=e=>({set:e=>{mt=_t(e)},reset:()=>_t(e),compare:ht(e),snap:pt(e),orient:dt(e)}),mt=_t(),gt=(e,t)=>e.ll.x.isLessThanOrEqualTo(t.x)&&t.x.isLessThanOrEqualTo(e.ur.x)&&e.ll.y.isLessThanOrEqualTo(t.y)&&t.y.isLessThanOrEqualTo(e.ur.y),ft=(e,t)=>{if(t.ur.x.isLessThan(e.ll.x)||e.ur.x.isLessThan(t.ll.x)||t.ur.y.isLessThan(e.ll.y)||e.ur.y.isLessThan(t.ll.y))return null;const i=e.ll.x.isLessThan(t.ll.x)?t.ll.x:e.ll.x,n=e.ur.x.isLessThan(t.ur.x)?e.ur.x:t.ur.x;return{ll:{x:i,y:e.ll.y.isLessThan(t.ll.y)?t.ll.y:e.ll.y},ur:{x:n,y:e.ur.y.isLessThan(t.ur.y)?e.ur.y:t.ur.y}}},vt=(e,t)=>e.x.times(t.y).minus(e.y.times(t.x)),yt=(e,t)=>e.x.times(t.x).plus(e.y.times(t.y)),bt=e=>yt(e,e).sqrt(),wt=(e,t,i)=>{const n={x:t.x.minus(e.x),y:t.y.minus(e.y)},r={x:i.x.minus(e.x),y:i.y.minus(e.y)};return vt(r,n).div(bt(r)).div(bt(n))},kt=(e,t,i)=>{const n={x:t.x.minus(e.x),y:t.y.minus(e.y)},r={x:i.x.minus(e.x),y:i.y.minus(e.y)};return yt(r,n).div(bt(r)).div(bt(n))},xt=(e,t,i)=>t.y.isZero()?null:{x:e.x.plus(t.x.div(t.y).times(i.minus(e.y))),y:i},$t=(e,t,i)=>t.x.isZero()?null:{x:i,y:e.y.plus(t.y.div(t.x).times(i.minus(e.x)))},St=class e{point;isLeft;segment;otherSE;consumedBy;static compare(t,i){const n=e.comparePoints(t.point,i.point);return 0!==n?n:(t.point!==i.point&&t.link(i),t.isLeft!==i.isLeft?t.isLeft?1:-1:zt.compare(t.segment,i.segment))}static comparePoints(e,t){return e.x.isLessThan(t.x)?-1:e.x.isGreaterThan(t.x)?1:e.y.isLessThan(t.y)?-1:e.y.isGreaterThan(t.y)?1:0}constructor(e,t){void 0===e.events?e.events=[this]:e.events.push(this),this.point=e,this.isLeft=t}link(e){if(e.point===this.point)throw new Error("Tried to link already linked events");const t=e.point.events;for(let e=0,i=t.length;e<i;e++){const i=t[e];this.point.events.push(i),i.point=this.point}this.checkForConsuming()}checkForConsuming(){const e=this.point.events.length;for(let t=0;t<e;t++){const i=this.point.events[t];if(void 0===i.segment.consumedBy)for(let n=t+1;n<e;n++){const e=this.point.events[n];void 0===e.consumedBy&&(i.otherSE.point.events===e.otherSE.point.events&&i.segment.consume(e.segment))}}}getAvailableLinkedEvents(){const e=[];for(let t=0,i=this.point.events.length;t<i;t++){const i=this.point.events[t];i!==this&&!i.segment.ringOut&&i.segment.isInResult()&&e.push(i)}return e}getLeftmostComparator(e){const t=new Map,i=i=>{const n=i.otherSE;t.set(i,{sine:wt(this.point,e.point,n.point),cosine:kt(this.point,e.point,n.point)})};return(e,n)=>{t.has(e)||i(e),t.has(n)||i(n);const{sine:r,cosine:o}=t.get(e),{sine:s,cosine:a}=t.get(n);return r.isGreaterThanOrEqualTo(0)&&s.isGreaterThanOrEqualTo(0)?o.isLessThan(a)?1:o.isGreaterThan(a)?-1:0:r.isLessThan(0)&&s.isLessThan(0)?o.isLessThan(a)?-1:o.isGreaterThan(a)?1:0:s.isLessThan(r)?-1:s.isGreaterThan(r)?1:0}}},Mt=class e{events;poly;_isExteriorRing;_enclosingRing;static factory(t){const i=[];for(let n=0,r=t.length;n<r;n++){const r=t[n];if(!r.isInResult()||r.ringOut)continue;let o=null,s=r.leftSE,a=r.rightSE;const l=[s],c=s.point,h=[];for(;o=s,s=a,l.push(s),s.point!==c;)for(;;){const t=s.getAvailableLinkedEvents();if(0===t.length){const e=l[0].point,t=l[l.length-1].point;throw new Error(`Unable to complete output ring starting at [${e.x}, ${e.y}]. Last matching segment found ends at [${t.x}, ${t.y}].`)}if(1===t.length){a=t[0].otherSE;break}let n=null;for(let e=0,t=h.length;e<t;e++)if(h[e].point===s.point){n=e;break}if(null!==n){const t=h.splice(n)[0],r=l.splice(t.index);r.unshift(r[0].otherSE),i.push(new e(r.reverse()));continue}h.push({index:l.length,point:s.point});const r=s.getLeftmostComparator(o);a=t.sort(r)[0].otherSE;break}i.push(new e(l))}return i}constructor(e){this.events=e;for(let t=0,i=e.length;t<i;t++)e[t].segment.ringOut=this;this.poly=null}getGeom(){let e=this.events[0].point;const t=[e];for(let i=1,n=this.events.length-1;i<n;i++){const n=this.events[i].point,r=this.events[i+1].point;0!==mt.orient(n,e,r)&&(t.push(n),e=n)}if(1===t.length)return null;const i=t[0],n=t[1];0===mt.orient(i,e,n)&&t.shift(),t.push(t[0]);const r=this.isExteriorRing()?1:-1,o=this.isExteriorRing()?0:t.length-1,s=this.isExteriorRing()?t.length:-1,a=[];for(let e=o;e!=s;e+=r)a.push([t[e].x.toNumber(),t[e].y.toNumber()]);return a}isExteriorRing(){if(void 0===this._isExteriorRing){const e=this.enclosingRing();this._isExteriorRing=!e||!e.isExteriorRing()}return this._isExteriorRing}enclosingRing(){return void 0===this._enclosingRing&&(this._enclosingRing=this._calcEnclosingRing()),this._enclosingRing}_calcEnclosingRing(){let e=this.events[0];for(let t=1,i=this.events.length;t<i;t++){const i=this.events[t];St.compare(e,i)>0&&(e=i)}let t=e.segment.prevInResult(),i=t?t.prevInResult():null;for(;;){if(!t)return null;if(!i)return t.ringOut;if(i.ringOut!==t.ringOut)return i.ringOut?.enclosingRing()!==t.ringOut?t.ringOut:t.ringOut?.enclosingRing();t=i.prevInResult(),i=t?t.prevInResult():null}}},Rt=class{exteriorRing;interiorRings;constructor(e){this.exteriorRing=e,e.poly=this,this.interiorRings=[]}addInterior(e){this.interiorRings.push(e),e.poly=this}getGeom(){const e=this.exteriorRing.getGeom();if(null===e)return null;const t=[e];for(let e=0,i=this.interiorRings.length;e<i;e++){const i=this.interiorRings[e].getGeom();null!==i&&t.push(i)}return t}},Tt=class{rings;polys;constructor(e){this.rings=e,this.polys=this._composePolys(e)}getGeom(){const e=[];for(let t=0,i=this.polys.length;t<i;t++){const i=this.polys[t].getGeom();null!==i&&e.push(i)}return e}_composePolys(e){const t=[];for(let i=0,n=e.length;i<n;i++){const n=e[i];if(!n.poly)if(n.isExteriorRing())t.push(new Rt(n));else{const e=n.enclosingRing();e?.poly||t.push(new Rt(e)),e?.poly?.addInterior(n)}}return t}},Ct=class{queue;tree;segments;constructor(e,t=zt.compare){this.queue=e,this.tree=new ot(t),this.segments=[]}process(e){const t=e.segment,i=[];if(e.consumedBy)return e.isLeft?this.queue.delete(e.otherSE):this.tree.delete(t),i;e.isLeft&&this.tree.add(t);let n=t,r=t;do{n=this.tree.lastBefore(n)}while(null!=n&&null!=n.consumedBy);do{r=this.tree.firstAfter(r)}while(null!=r&&null!=r.consumedBy);if(e.isLeft){let o=null;if(n){const e=n.getIntersection(t);if(null!==e&&(t.isAnEndpoint(e)||(o=e),!n.isAnEndpoint(e))){const t=this._splitSafely(n,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}}let s=null;if(r){const e=r.getIntersection(t);if(null!==e&&(t.isAnEndpoint(e)||(s=e),!r.isAnEndpoint(e))){const t=this._splitSafely(r,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}}if(null!==o||null!==s){let e=null;if(null===o)e=s;else if(null===s)e=o;else{e=St.comparePoints(o,s)<=0?o:s}this.queue.delete(t.rightSE),i.push(t.rightSE);const n=t.split(e);for(let e=0,t=n.length;e<t;e++)i.push(n[e])}i.length>0?(this.tree.delete(t),i.push(e)):(this.segments.push(t),t.prev=n)}else{if(n&&r){const e=n.getIntersection(r);if(null!==e){if(!n.isAnEndpoint(e)){const t=this._splitSafely(n,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}if(!r.isAnEndpoint(e)){const t=this._splitSafely(r,e);for(let e=0,n=t.length;e<n;e++)i.push(t[e])}}}this.tree.delete(t)}return i}_splitSafely(e,t){this.tree.delete(e);const i=e.rightSE;this.queue.delete(i);const n=e.split(t);return n.push(i),void 0===e.consumedBy&&this.tree.add(e),n}},Dt=new class{type;numMultiPolys;run(e,t,i){Dt.type=e;const n=[new It(t,!0)];for(let e=0,t=i.length;e<t;e++)n.push(new It(i[e],!1));if(Dt.numMultiPolys=n.length,"difference"===Dt.type){const e=n[0];let t=1;for(;t<n.length;)null!==ft(n[t].bbox,e.bbox)?t++:n.splice(t,1)}if("intersection"===Dt.type)for(let e=0,t=n.length;e<t;e++){const t=n[e];for(let i=e+1,r=n.length;i<r;i++)if(null===ft(t.bbox,n[i].bbox))return[]}const r=new ot(St.compare);for(let e=0,t=n.length;e<t;e++){const t=n[e].getSweepEvents();for(let e=0,i=t.length;e<i;e++)r.add(t[e])}const o=new Ct(r);let s=null;for(0!=r.size&&(s=r.first(),r.delete(s));s;){const e=o.process(s);for(let t=0,i=e.length;t<i;t++){const i=e[t];void 0===i.consumedBy&&r.add(i)}0!=r.size?(s=r.first(),r.delete(s)):s=null}mt.reset();const a=Mt.factory(o.segments);return new Tt(a).getGeom()}},At=Dt,Ot=0,zt=class e{id;leftSE;rightSE;rings;windings;ringOut;consumedBy;prev;_prevInResult;_beforeState;_afterState;_isInResult;static compare(e,t){const i=e.leftSE.point.x,n=t.leftSE.point.x,r=e.rightSE.point.x,o=t.rightSE.point.x;if(o.isLessThan(i))return 1;if(r.isLessThan(n))return-1;const s=e.leftSE.point.y,a=t.leftSE.point.y,l=e.rightSE.point.y,c=t.rightSE.point.y;if(i.isLessThan(n)){if(a.isLessThan(s)&&a.isLessThan(l))return 1;if(a.isGreaterThan(s)&&a.isGreaterThan(l))return-1;const i=e.comparePoint(t.leftSE.point);if(i<0)return 1;if(i>0)return-1;const n=t.comparePoint(e.rightSE.point);return 0!==n?n:-1}if(i.isGreaterThan(n)){if(s.isLessThan(a)&&s.isLessThan(c))return-1;if(s.isGreaterThan(a)&&s.isGreaterThan(c))return 1;const i=t.comparePoint(e.leftSE.point);if(0!==i)return i;const n=e.comparePoint(t.rightSE.point);return n<0?1:n>0?-1:1}if(s.isLessThan(a))return-1;if(s.isGreaterThan(a))return 1;if(r.isLessThan(o)){const i=t.comparePoint(e.rightSE.point);if(0!==i)return i}if(r.isGreaterThan(o)){const i=e.comparePoint(t.rightSE.point);if(i<0)return 1;if(i>0)return-1}if(!r.eq(o)){const e=l.minus(s),t=r.minus(i),h=c.minus(a),d=o.minus(n);if(e.isGreaterThan(t)&&h.isLessThan(d))return 1;if(e.isLessThan(t)&&h.isGreaterThan(d))return-1}return r.isGreaterThan(o)?1:r.isLessThan(o)||l.isLessThan(c)?-1:l.isGreaterThan(c)?1:e.id<t.id?-1:e.id>t.id?1:0}constructor(e,t,i,n){this.id=++Ot,this.leftSE=e,e.segment=this,e.otherSE=t,this.rightSE=t,t.segment=this,t.otherSE=e,this.rings=i,this.windings=n}static fromRing(t,i,n){let r,o,s;const a=St.comparePoints(t,i);if(a<0)r=t,o=i,s=1;else{if(!(a>0))throw new Error(`Tried to create degenerate segment at [${t.x}, ${t.y}]`);r=i,o=t,s=-1}const l=new St(r,!0),c=new St(o,!1);return new e(l,c,[n],[s])}replaceRightSE(e){this.rightSE=e,this.rightSE.segment=this,this.rightSE.otherSE=this.leftSE,this.leftSE.otherSE=this.rightSE}bbox(){const e=this.leftSE.point.y,t=this.rightSE.point.y;return{ll:{x:this.leftSE.point.x,y:e.isLessThan(t)?e:t},ur:{x:this.rightSE.point.x,y:e.isGreaterThan(t)?e:t}}}vector(){return{x:this.rightSE.point.x.minus(this.leftSE.point.x),y:this.rightSE.point.y.minus(this.leftSE.point.y)}}isAnEndpoint(e){return e.x.eq(this.leftSE.point.x)&&e.y.eq(this.leftSE.point.y)||e.x.eq(this.rightSE.point.x)&&e.y.eq(this.rightSE.point.y)}comparePoint(e){return mt.orient(this.leftSE.point,e,this.rightSE.point)}getIntersection(e){const t=this.bbox(),i=e.bbox(),n=ft(t,i);if(null===n)return null;const r=this.leftSE.point,o=this.rightSE.point,s=e.leftSE.point,a=e.rightSE.point,l=gt(t,s)&&0===this.comparePoint(s),c=gt(i,r)&&0===e.comparePoint(r),h=gt(t,a)&&0===this.comparePoint(a),d=gt(i,o)&&0===e.comparePoint(o);if(c&&l)return d&&!h?o:!d&&h?a:null;if(c)return h&&r.x.eq(a.x)&&r.y.eq(a.y)?null:r;if(l)return d&&o.x.eq(s.x)&&o.y.eq(s.y)?null:s;if(d&&h)return null;if(d)return o;if(h)return a;const u=((e,t,i,n)=>{if(t.x.isZero())return $t(i,n,e.x);if(n.x.isZero())return $t(e,t,i.x);if(t.y.isZero())return xt(i,n,e.y);if(n.y.isZero())return xt(e,t,i.y);const r=vt(t,n);if(r.isZero())return null;const o={x:i.x.minus(e.x),y:i.y.minus(e.y)},s=vt(o,t).div(r),a=vt(o,n).div(r),l=e.x.plus(a.times(t.x)),c=i.x.plus(s.times(n.x)),h=e.y.plus(a.times(t.y)),d=i.y.plus(s.times(n.y));return{x:l.plus(c).div(2),y:h.plus(d).div(2)}})(r,this.vector(),s,e.vector());return null===u?null:gt(n,u)?mt.snap(u):null}split(t){const i=[],n=void 0!==t.events,r=new St(t,!0),o=new St(t,!1),s=this.rightSE;this.replaceRightSE(o),i.push(o),i.push(r);const a=new e(r,s,this.rings.slice(),this.windings.slice());return St.comparePoints(a.leftSE.point,a.rightSE.point)>0&&a.swapEvents(),St.comparePoints(this.leftSE.point,this.rightSE.point)>0&&this.swapEvents(),n&&(r.checkForConsuming(),o.checkForConsuming()),i}swapEvents(){const e=this.rightSE;this.rightSE=this.leftSE,this.leftSE=e,this.leftSE.isLeft=!0,this.rightSE.isLeft=!1;for(let e=0,t=this.windings.length;e<t;e++)this.windings[e]*=-1}consume(t){let i=this,n=t;for(;i.consumedBy;)i=i.consumedBy;for(;n.consumedBy;)n=n.consumedBy;const r=e.compare(i,n);if(0!==r){if(r>0){const e=i;i=n,n=e}if(i.prev===n){const e=i;i=n,n=e}for(let e=0,t=n.rings.length;e<t;e++){const t=n.rings[e],r=n.windings[e],o=i.rings.indexOf(t);-1===o?(i.rings.push(t),i.windings.push(r)):i.windings[o]+=r}n.rings=null,n.windings=null,n.consumedBy=i,n.leftSE.consumedBy=i.leftSE,n.rightSE.consumedBy=i.rightSE}}prevInResult(){return void 0!==this._prevInResult||(this.prev?this.prev.isInResult()?this._prevInResult=this.prev:this._prevInResult=this.prev.prevInResult():this._prevInResult=null),this._prevInResult}beforeState(){if(void 0!==this._beforeState)return this._beforeState;if(this.prev){const e=this.prev.consumedBy||this.prev;this._beforeState=e.afterState()}else this._beforeState={rings:[],windings:[],multiPolys:[]};return this._beforeState}afterState(){if(void 0!==this._afterState)return this._afterState;const e=this.beforeState();this._afterState={rings:e.rings.slice(0),windings:e.windings.slice(0),multiPolys:[]};const t=this._afterState.rings,i=this._afterState.windings,n=this._afterState.multiPolys;for(let e=0,n=this.rings.length;e<n;e++){const n=this.rings[e],r=this.windings[e],o=t.indexOf(n);-1===o?(t.push(n),i.push(r)):i[o]+=r}const r=[],o=[];for(let e=0,n=t.length;e<n;e++){if(0===i[e])continue;const n=t[e],s=n.poly;if(-1===o.indexOf(s))if(n.isExterior)r.push(s);else{-1===o.indexOf(s)&&o.push(s);const e=r.indexOf(n.poly);-1!==e&&r.splice(e,1)}}for(let e=0,t=r.length;e<t;e++){const t=r[e].multiPoly;-1===n.indexOf(t)&&n.push(t)}return this._afterState}isInResult(){if(this.consumedBy)return!1;if(void 0!==this._isInResult)return this._isInResult;const e=this.beforeState().multiPolys,t=this.afterState().multiPolys;switch(At.type){case"union":{const i=0===e.length,n=0===t.length;this._isInResult=i!==n;break}case"intersection":{let i,n;e.length<t.length?(i=e.length,n=t.length):(i=t.length,n=e.length),this._isInResult=n===At.numMultiPolys&&i<n;break}case"xor":{const i=Math.abs(e.length-t.length);this._isInResult=i%2==1;break}case"difference":{const i=e=>1===e.length&&e[0].isSubject;this._isInResult=i(e)!==i(t);break}}return this._isInResult}},Pt=class{poly;isExterior;segments;bbox;constructor(e,t,i){if(!Array.isArray(e)||0===e.length)throw new Error("Input geometry is not a valid Polygon or MultiPolygon");if(this.poly=t,this.isExterior=i,this.segments=[],"number"!=typeof e[0][0]||"number"!=typeof e[0][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const n=mt.snap({x:new tt(e[0][0]),y:new tt(e[0][1])});this.bbox={ll:{x:n.x,y:n.y},ur:{x:n.x,y:n.y}};let r=n;for(let t=1,i=e.length;t<i;t++){if("number"!=typeof e[t][0]||"number"!=typeof e[t][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const i=mt.snap({x:new tt(e[t][0]),y:new tt(e[t][1])});i.x.eq(r.x)&&i.y.eq(r.y)||(this.segments.push(zt.fromRing(r,i,this)),i.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.x),i.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.y),i.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.x),i.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.y),r=i)}n.x.eq(r.x)&&n.y.eq(r.y)||this.segments.push(zt.fromRing(r,n,this))}getSweepEvents(){const e=[];for(let t=0,i=this.segments.length;t<i;t++){const i=this.segments[t];e.push(i.leftSE),e.push(i.rightSE)}return e}},Ft=class{multiPoly;exteriorRing;interiorRings;bbox;constructor(e,t){if(!Array.isArray(e))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");this.exteriorRing=new Pt(e[0],this,!0),this.bbox={ll:{x:this.exteriorRing.bbox.ll.x,y:this.exteriorRing.bbox.ll.y},ur:{x:this.exteriorRing.bbox.ur.x,y:this.exteriorRing.bbox.ur.y}},this.interiorRings=[];for(let t=1,i=e.length;t<i;t++){const i=new Pt(e[t],this,!1);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.interiorRings.push(i)}this.multiPoly=t}getSweepEvents(){const e=this.exteriorRing.getSweepEvents();for(let t=0,i=this.interiorRings.length;t<i;t++){const i=this.interiorRings[t].getSweepEvents();for(let t=0,n=i.length;t<n;t++)e.push(i[t])}return e}},It=class{isSubject;polys;bbox;constructor(e,t){if(!Array.isArray(e))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");try{"number"==typeof e[0][0][0]&&(e=[e])}catch(e){}this.polys=[],this.bbox={ll:{x:new tt(Number.POSITIVE_INFINITY),y:new tt(Number.POSITIVE_INFINITY)},ur:{x:new tt(Number.NEGATIVE_INFINITY),y:new tt(Number.NEGATIVE_INFINITY)}};for(let t=0,i=e.length;t<i;t++){const i=new Ft(e[t],this);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.polys.push(i)}this.isSubject=t}getSweepEvents(){const e=[];for(let t=0,i=this.polys.length;t<i;t++){const i=this.polys[t].getSweepEvents();for(let t=0,n=i.length;t<n;t++)e.push(i[t])}return e}},Et=(e,...t)=>At.run("union",e,t),Nt=(e,...t)=>At.run("intersection",e,t),Ht=(e,...t)=>At.run("difference",e,t);mt.set;const Lt=/^#[0-9a-fA-F]{6}$/;function qt(e,t){return"string"==typeof e&&Lt.test(e)?e:t}const jt="(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])",Bt=new RegExp(`^rgb\\(${jt}, ${jt}, ${jt}\\)$`);function Wt(e){if(!Array.isArray(e)||e.length<3)return null;const t=e.slice(0,3);if(!t.every(e=>"number"==typeof e&&Number.isFinite(e)))return null;const[i,n,r]=t.map(e=>Math.round(Math.min(255,Math.max(0,e))));return`rgb(${i}, ${n}, ${r})`}function Ut(e){const t=Math.max(0,Math.min(120,(e-40)/140*120));return`hsl(${Math.round(t)}, 85%, 55%)`}function Gt(e,t){if(!(Number.isFinite(e)&&t>0))return e;const i=Math.round(e/t)*t;return Math.abs(i-e)<=1e-9*t?e:i}function Vt(e,t,i,n=1/0){if(!(i>0&&e?.every(Number.isFinite)&&t?.every(Number.isFinite)))return[t[0],t[1]];const r=t[0]-e[0],o=t[1]-e[1];if(Math.abs(r)+Math.abs(o)<=1e-12)return[e[0],e[1]];const s=Math.PI/4;let a=Math.atan2(o,r);a<0&&(a+=2*Math.PI);const l=Math.floor(a/s+.5)%8,[c,h]=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]][l],d=c*c+h*h;let u=Math.max(0,Math.round((r*c+o*h)/(i*d)));if(Number.isFinite(n)&&n>=0){const t=(e,t)=>{if(!t)return 1/0;const r=t>0?n-e:e+n;return Math.max(0,Math.floor((r+1e-9*i)/i))};u=Math.min(u,t(e[0],c),t(e[1],h))}return[e[0]+c*u*i,e[1]+h*u*i]}function Kt(e,t){if(t){const t=e/2.54;let i=Math.floor(t/12),n=Math.round(t-12*i);return 12===n&&(i+=1,n=0),`${i}′ ${n}″`}return`${(e/100).toFixed(2)} m`}function Yt(e,t,i=1){const n=e[0].toFixed(i),r=e[1].toFixed(i),o=t[0].toFixed(i),s=t[1].toFixed(i),a=n<o||n===o&&r<=s,[l,c,h,d]=a?[n,r,o,s]:[o,s,n,r];return`${l},${c}-${h},${d}`}function Zt(e){return e?.poly?.length>=3?e.poly:e&&null!=e.x&&null!=e.y&&null!=e.w&&null!=e.h?[[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h]]:null}function Xt(e){const t=[];for(const i of e||[])i?.poly?.length>=3?t.push({poly:i.poly.map(e=>e.join(",")).join(" ")}):i&&null!=i.x&&null!=i.y&&null!=i.w&&null!=i.h&&t.push({rect:{x:i.x,y:i.y,w:i.w,h:i.h,rx:.03*Math.min(i.w,i.h)}});return t}function Jt(e){const t=[],i=new Set;for(const n of e||[]){const e=Zt(n);if(e)for(let n=0;n<e.length;n++){const r=e[n],o=e[(n+1)%e.length],s=Yt(r,o,5);i.has(s)||(i.add(s),t.push([r[0],r[1],o[0],o[1]]))}}return t}function Qt(e,t,i,n={}){let r=null,o=i;for(const i of Jt(t)){const[t,s,a,l]=i,c=a-t,h=l-s,d=c*c+h*h;if(!d)continue;let u=((e[0]-t)*c+(e[1]-s)*h)/d;u=Math.max(0,Math.min(1,u));const p=[t+u*c,s+u*h],_=Math.hypot(e[0]-p[0],e[1]-p[1]);if(_<o){o=_;let e=180*Math.atan2(h,c)/Math.PI;if(e>=90?e-=180:e<-90&&(e+=180),n.step&&n.step>0){const i=Math.sqrt(d),o=Math.min(Math.max(n.length||0,0)/2,i/2);let a=Math.round(u*i/n.step)*n.step;Math.abs(u*i-i/2)<=n.step/2&&(a=i/2),a=Math.max(o,Math.min(i-o,a));const l=a/i;r={x:t+l*c,y:s+l*h,angle:e}}else r={x:p[0],y:p[1],angle:e}}}return r}function ei(e,t,i){let n=null,r=1/0;for(let o=0;o<t.length;o++){const[s,a]=t[o],[l,c]=t[(o+1)%t.length],h=l-s,d=c-a,u=h*h+d*d;if(!u)continue;let p=((e[0]-s)*h+(e[1]-a)*d)/u;p=Math.max(0,Math.min(1,p));const _=Math.hypot(e[0]-(s+p*h),e[1]-(a+p*d));if(_>=r)continue;r=_;const m=Math.sqrt(u),g=(i>0?Math.max(0,Math.min(m,Math.round(p*m/i)*i)):p*m)/m;n=[s+g*h,a+g*d]}return n}function ti(e,t,i,n,r,o=1){const s=t*Math.PI/180,a=[Math.cos(s),Math.sin(s)];let l=null,c=o;for(const t of Jt(n)){const i=[[t[0],t[1]],[t[2],t[3]]],n=t=>Math.abs(a[0]*(t[1]-e[1])-a[1]*(t[0]-e[0]));if(n(i[0])>o||n(i[1])>o)continue;const r=(i[0][0]-e[0])*a[0]+(i[0][1]-e[1])*a[1],s=(i[1][0]-e[0])*a[0]+(i[1][1]-e[1])*a[1],h=Math.min(r,s),d=Math.max(r,s),u=h>0?h:d<0?-d:0;u<c&&(c=u,l=[h,d])}if(!l)return null;const[h,d]=l,u=i/2,p=Math.max(0,-u-h),_=Math.max(0,d-u),m=t=>[e[0]+a[0]*t,e[1]+a[1]*t],g=(h+d)/2;return{wallA:m(h),wallB:m(d),sideA:p,sideB:_,midA:m((h-u)/2),midB:m((u+d)/2),wallCenter:m(g),centered:Math.abs(g)<=r}}function ii(e,t,i=!1){if("passage"===e)return 1;if(null==t||"unavailable"===t||"unknown"===t)return"window"===e?0:1;const n=function(e){return["on","open","home","detected","playing","cleaning"].includes(String(e))}(t)!==!!i;return n?1:0}function ni(e){return"passage"===e.type?[]:[e.contact,e.lock].filter(e=>"string"==typeof e&&e.length>0)}function ri(e,t,i=200){const n=t.trim().toLowerCase();return(n?e.filter(e=>e.label.toLowerCase().includes(n)||e.value.toLowerCase().includes(n)):e).slice(0,Math.max(0,i))}function oi(e,t,i=.001){return Math.abs(e[0]-t[0])<i&&Math.abs(e[1]-t[1])<i}function si(e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){const[o,s]=t[n],[a,l]=t[r];s>e[1]!=l>e[1]&&e[0]<(a-o)*(e[1]-s)/(l-s)+o&&(i=!i)}return i}function ai(e,t,i){const n=i[0]-t[0],r=i[1]-t[1],o=n*n+r*r;let s=o?((e[0]-t[0])*n+(e[1]-t[1])*r)/o:0;return s=Math.max(0,Math.min(1,s)),Math.hypot(e[0]-(t[0]+s*n),e[1]-(t[1]+s*r))}function li(e,t){if(!t||t.length<2)return null;let i=null,n=1/0;for(let r=0;r<t.length;r++){const o=t[r],s=t[(r+1)%t.length],a=s[0]-o[0],l=s[1]-o[1],c=a*a+l*l;let h=c?((e[0]-o[0])*a+(e[1]-o[1])*l)/c:0;h=Math.max(0,Math.min(1,h));const d=[o[0]+h*a,o[1]+h*l],u=Math.hypot(e[0]-d[0],e[1]-d[1]);u<n&&(n=u,i=d)}return i}function ci(e,t,i=1e-6){if(!t||t.length<2)return!1;for(let n=0;n<t.length;n++)if(ai(e,t[n],t[(n+1)%t.length])<=i)return!0;return!1}function hi(e,t,i=1e-6){return!(!t||t.length<3)&&(!ci(e,t,i)&&si(e,t))}function di(e,t,i){return(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0])}function ui(e,t,i,n,r=1e-9){const o=di(i,n,e),s=di(i,n,t),a=di(e,t,i),l=di(e,t,n);return(o>r&&s<-r||o<-r&&s>r)&&(a>r&&l<-r||a<-r&&l>r)}function pi(e,t=24){const i=e.map(e=>e[0]),n=e.map(e=>e[1]),r=Math.min(...i),o=Math.max(...i),s=Math.min(...n),a=Math.max(...n),l=Math.max(o-r,a-s)||1;let c=0,h=0,d=0;for(let t=0;t<e.length;t++){const i=e[t],n=e[(t+1)%e.length],r=i[0]*n[1]-n[0]*i[1];c+=r,h+=(i[0]+n[0])*r,d+=(i[1]+n[1])*r}const u=Math.abs(c)>1e-9?[h/(3*c),d/(3*c)]:[(r+o)/2,(s+a)/2],p=(t,i)=>{const n=((t,i)=>{if(!si([t,i],e))return-1/0;let n=1/0;for(let r=0;r<e.length;r++){const o=e[r],s=e[(r+1)%e.length];n=Math.min(n,Pn([t,i],[o[0],o[1],s[0],s[1]]))}return n})(t,i);return n===-1/0?n:n-.08*Math.hypot(t-u[0],i-u[1])-1e-4*l};let _=null,m=-1/0;for(let e=1;e<t;e++)for(let i=1;i<t;i++){const n=r+(o-r)*e/t,l=s+(a-s)*i/t,c=p(n,l);c>m&&(m=c,_=[n,l])}if(_){const[e,i]=_,n=(o-r)/t,l=(a-s)/t;for(let t=-4;t<=4;t++)for(let r=-4;r<=4;r++){const o=e+n*t/4,s=i+l*r/4,a=p(o,s);a>m&&(m=a,_=[o,s])}}return _||_i(e)||e[0]}function _i(e,t=1e-6){if(!e||e.length<3)return null;const i=e.length,n=[e.reduce((e,t)=>e+t[0],0)/i,e.reduce((e,t)=>e+t[1],0)/i];if(hi(n,e,t))return n;for(let n=0;n<i;n++){const r=e[(n-1+i)%i],o=e[n],s=e[(n+1)%i],a=[(r[0]+o[0]+s[0])/3,(r[1]+o[1]+s[1])/3];if(hi(a,e,t))return a}for(let n=0;n<i;n++)for(let r=n+2;r<i;r++){const i=[(e[n][0]+e[r][0])/2,(e[n][1]+e[r][1])/2];if(hi(i,e,t))return i}return null}function mi(e,t,i){let n=!0;for(const r of e){if(hi(r,t,i))return!0;ci(r,t,i)||(n=!1)}if(n){const n=_i(e,i);return!!n&&hi(n,t,i)}return!1}function gi(e,t,i=1e-6){if(!e||!t||e.length<3||t.length<3)return!1;for(let i=0;i<t.length;i++)for(let n=0;n<e.length;n++)if(ui(t[i],t[(i+1)%t.length],e[n],e[(n+1)%e.length]))return!1;for(const n of t)if(!hi(n,e,i)&&!ci(n,e,i))return!1;const n=_i(t,i);return!!n&&hi(n,e,i)&&yi(t)<yi(e)-i}function fi(e,t,i=1e-6){if(!e||!t||e.length<3||t.length<3)return!1;for(let i=0;i<e.length;i++)for(let n=0;n<t.length;n++)if(ui(e[i],e[(i+1)%e.length],t[n],t[(n+1)%t.length]))return!0;return!gi(e,t,i)&&!gi(t,e,i)&&(mi(e,t,i)||mi(t,e,i))}function vi(e,t,i=1e-6){const n=t.filter(t=>gi(e,t,i));return n.filter(e=>!n.some(t=>t!==e&&gi(t,e,i)))}function yi(e){if(!e||e.length<3)return 0;let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return Math.abs(t)/2}function bi(e){return[[...e.map(e=>[e[0],e[1]]),[e[0][0],e[0][1]]]]}function wi(e,t){if(!e||!t||e.length<3||t.length<3)return null;const i=Et(bi(e),bi(t));if(1!==i.length)return null;if(1!==i[0].length)return null;const n=i[0][0].slice(0,-1).map(e=>[e[0],e[1]]);return n.length>=3?n:null}function ki(e,t,i){for(let n=0;n<e.length;n++)if(ai(t,e[n],e[(n+1)%e.length])<=i)return n;return-1}function xi(e,t){const i=[];for(const n of e)i.length&&oi(i[i.length-1],n,t)||i.push(n);return i.length>1&&oi(i[0],i[i.length-1],t)&&i.pop(),i}function $i(e,t,i=1e-6){if(!e||e.length<3||!t||t.length<2)return null;const n=t[0],r=t[t.length-1];if(oi(n,r,i))return null;const o=ki(e,n,i),s=ki(e,r,i);if(o<0||s<0)return null;const a=t.slice(1,-1);for(const t of a)if(!hi(t,e,i))return null;for(let i=0;i<t.length-1;i++)for(let n=0;n<e.length;n++)if(ui(t[i],t[i+1],e[n],e[(n+1)%e.length]))return null;for(let e=0;e<t.length-1;e++)for(let i=e+2;i<t.length-1;i++)if(ui(t[e],t[e+1],t[i],t[i+1]))return null;if(2===t.length&&!hi([(n[0]+r[0])/2,(n[1]+r[1])/2],e,i))return null;const l=(t,n,r,o)=>{const s=[t];let a=(n+1)%e.length;for(let t=0;t<=e.length&&(s.push(e[a]),a!==o);t++)a=(a+1)%e.length;return s.push(r),xi(s,i)};let c,h;if(o===s){const s=xi([...t],i);if(s.length<3||yi(s)<=i)return null;const a=[];for(let i=0;i<e.length;i++)if(a.push(e[i]),i===o){const i=(e[(o+1)%e.length][0]-e[o][0])*(r[0]-n[0])+(e[(o+1)%e.length][1]-e[o][1])*(r[1]-n[1])>=0?t:[...t].reverse();for(const e of i)a.push(e)}c=xi(a,i),h=s}else c=xi([...l(n,o,r,s),...[...a].reverse()],i),h=xi([...l(r,s,n,o),...a],i);return c.length<3||h.length<3||yi(c)<=i||yi(h)<=i||Math.abs(yi(c)+yi(h)-yi(e))>Math.max(i,1e-6*yi(e))?null:[c,h]}function Si(e,t,i){const[n,r]=e.split(":");return"device"===n?r:"entity"===n?"lg_"+r:t&&t.startsWith("v_")?t:i()}function Mi(e){return e.length?Math.round(e.reduce((e,t)=>e+t,0)/e.length):null}function Ri(e,t){if(t>e[2]/e[3]){const i=e[3],n=e[3]*t;return{x:e[0]-(n-e[2])/2,y:e[1],w:n,h:i}}const i=e[2],n=e[2]/t;return{x:e[0],y:e[1]-(n-e[3])/2,w:i,h:n}}function Ti(e,t,i,n){if(e.length<2)return;const r=t.x+n,o=t.x+t.w-n,s=t.y+n,a=t.y+t.h-n;for(let t=0;t<60;t++){let t=!1;for(let n=0;n<e.length;n++)for(let r=n+1;r<e.length;r++){const o=e[r].x-e[n].x,s=e[r].y-e[n].y,a=Math.hypot(o,s)||.001;if(a<i){const l=(i-a)/2,c=o/a,h=s/a;e[n].x-=c*l,e[n].y-=h*l,e[r].x+=c*l,e[r].y+=h*l,t=!0}}for(const t of e)t.x=Math.max(r,Math.min(o,t.x)),t.y=Math.max(s,Math.min(a,t.y));if(!t)break}}function Ci(e){if(!e)return null;const t=e.trim();return/^(https?:)?\/\//i.test(t)||t.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(t)?/^[a-z][\w+.-]*:/i.test(t)&&!/^https?:/i.test(t)?null:t:null}const Di=["badge","icon_ripple","value","static_icon"];function Ai(e){return"ripple"===e?"icon_ripple":Di.includes(e)?e:"badge"}const Oi=["info","more-info","toggle","run"],zi=["custom","lqi","light","temp"],Pi=["none","lqi","light","temp","custom"],Fi=new Set(["garage","door","gate"]),Ii=["automation","script","scene"];const Ei="—",Ni="{}";function Hi(e){const t=String(e??"").trim();if(!t)return null;let i=t,n="";const r=t.indexOf(":");if(r>=0)i=t.slice(0,r).trim(),n=t.slice(r+1).trim();else{const e=t.split(".");e.length>2&&(i=e.slice(0,2).join("."),n=e.slice(2).join("."))}return/^[a-z0-9_]+\.[a-z0-9_]+$/.test(i)?r>=0&&!n||n&&!/^[a-zA-Z0-9_.-]+$/.test(n)?null:n?{entity:i,attr:n}:{entity:i}:null}function Li(e,t){const i=String(e??"").trim(),n=String(t??"").trim(),r=Hi(n?`${i}:${n}`:i);return r?`{${r.entity}${r.attr?`:${r.attr}`:""}}`:""}function qi(e,t,i){const n=String(t??"").trim();if(!n)return null;const r=e?.states?.[n];if(!r)return null;const o=String(i??"").trim(),s=e=>e.slice(0,60);if(o){const t=function(e){if(null==e)return null;if(Array.isArray(e)){const t=e.map(e=>null==e?"":String(e)).join(", ");return t?t.slice(0,60):null}if("object"==typeof e)return null;const t=String(e);return""===t?null:t.slice(0,60)}(r.attributes?.[o]);if(null===t)return null;const i=e?.formatEntityAttributeValue;if("function"==typeof i)try{const t=i.call(e,r,o);if("string"==typeof t&&""!==t)return{text:s(t),formatted:!0}}catch{}return{text:t,formatted:!1}}const a=r.state;if(null==a||""===a)return null;const l=e?.formatEntityState;if("function"==typeof l)try{const t=l.call(e,r);if("string"==typeof t&&""!==t)return{text:s(t),formatted:!0}}catch{}return{text:s(String(a)),formatted:!1}}function ji(e,t,i){const n=String(t??"").trim(),r=String(i??"").trim()||n;if(!r)return e.text;const o=e.formatted&&n?function(e,t){if(!t)return e;const i=e.replace(/\s+$/,"");return i.endsWith(t)?i.slice(0,i.length-t.length).replace(/\s+$/,""):e}(e.text,n):e.text;return`${o} ${r}`}function Bi(e,t){const i=(t?.entity||"").trim();if(!i)return"";const n=e?.states?.[i],r=n?.state;if(!n||null==r||""===r||"unavailable"===r||"unknown"===r)return Ei;const o=(t?.attr||"").trim(),s=qi(e,i,o||null);if(null===s)return Ei;return ji(s,o?"":String(n.attributes?.unit_of_measurement??"").trim(),t?.unit)}function Wi(e,t,i,n=()=>!0){const r=e??"";let o=!1;const s=r.replace(/\{([^{}\r\n]+)\}/g,(e,t)=>{const r=Hi(t);return r?(o=!0,n(r.entity||"")?Bi(i,r):Ei):e});if(o)return s;const a=(t?.entity||"").trim();if(!a)return r;if(!n(a)){const e=r.indexOf(Ni);return e>=0?r.slice(0,e)+Ei+r.slice(e+2):r?`${r} ${Ei}`:Ei}const l=Bi(i,t),c=r.indexOf(Ni);return c>=0?r.slice(0,c)+l+r.slice(c+2):r?`${r} ${l}`:l}const Ui=20;function Gi(e){const t=Number(e?.scale);if(Number.isFinite(t)&&t>0)return Math.min(20,Math.max(.15,t));return{s:.7,m:1,l:1.5}[String(e?.size??"")]??1}function Vi(e,t){if(!t)return e;let i=e;for(const[e,n]of Object.entries(t))i=i.split("{"+e+"}").join(String(n));return i}const Ki="#55606c",Yi=.55,Zi=20,Xi=25,Ji={c:"#607d8b",a:.18};function Qi(e,t=Ji){const i=e&&"object"==typeof e?e:null,n=i?.a;return{c:qt(i?.c,t.c),a:"number"==typeof n&&Number.isFinite(n)?Math.min(1,Math.max(0,n)):t.a}}function en(e,t){const i=Qi(e),n=t?.settings?.custom_fill;return n&&"object"==typeof n?Qi(n,i):i}function tn(e){const t=e?.settings||{},i=!e?.plan_url,n="glow"===t.fill_mode;return{showBorders:t.show_borders??i,showNames:t.show_names??i,color:qt(t.room_color,Ki),opacity:"number"==typeof t.room_opacity?Math.min(1,Math.max(0,t.room_opacity)):.55,fill:["lqi","light","temp","custom"].includes(t.fill_mode)?t.fill_mode:"none",customFill:Qi(t.custom_fill),glow:"boolean"==typeof t.glow_enabled?t.glow_enabled:n,tempMin:"number"==typeof t.temp_min?t.temp_min:20,tempMax:"number"==typeof t.temp_max?t.temp_max:25,showLqi:"boolean"==typeof t.show_lqi?t.show_lqi:null,cardFontScale:"number"==typeof t.card_font_scale&&t.card_font_scale>0?Math.min(3,Math.max(.5,t.card_font_scale)):1,labelTemp:!0===t.label_temp,labelHum:!0===t.label_hum,labelLqi:!0===t.label_lqi,labelLight:!0===t.label_light,bgColor:qt(t.bg_color,null),hideDecor:!0===t.hide_decor,hideOpenings:!0===t.hide_openings}}function nn(e,t){if(t.bgColor)return t.bgColor;const i=e?.bg_color;return qt(i,"")}const rn={light_on:{c:"#ffd45c",a:.18},light_off:{c:"#9aa0a6",a:.14},light_none:{c:"#6b7480",a:0},temp_cold:{c:"#4fc3f7",a:.18},temp_ok:{c:"#66d17a",a:.18},temp_hot:{c:"#ffd45c",a:.18},lqi_low:{c:"#f25a4a",a:.18},lqi_high:{c:"#4bd28f",a:.18},glow_base:{c:"#0d1b2a",a:.5},glow_light:{c:"#ffd9a0",a:.85},wall_fill:{c:"#ffffff",a:1}};function on(e){const t={},i=e?.fill_colors||{};for(const e of Object.keys(rn)){const n=rn[e],r=i[e];t[e]={c:qt(r?.c,n.c),a:r&&"number"==typeof r.a?Math.min(1,Math.max(0,r.a)):n.a}}return t}function sn(e,t,i){const n=Math.min(1,Math.max(0,i)),r=[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),o=[1,3,5].map(e=>parseInt(t.slice(e,e+2),16)),s=r.map((e,t)=>Math.round(e+(o[t]-e)*n));return"#"+s.map(e=>e.toString(16).padStart(2,"0")).join("")}function an(e,t,i,n,r,o,s,a=Ji){const l=function(e,t,i,n,r,o,s,a=Ji){if("custom"===e)return Qi(a);if("lqi"===e){if(null==t)return null;const e=(t-40)/140;return{c:sn(s.lqi_low.c,s.lqi_high.c,e),a:s.lqi_low.a+(s.lqi_high.a-s.lqi_low.a)*Math.min(1,Math.max(0,e))}}if("light"===e)return"none"===i?s.light_none.a>0?s.light_none:null:"on"===i?s.light_on:s.light_off;if("temp"===e){if(null==n)return null;const e=Math.min(r,o),t=Math.max(r,o);return n<e?s.temp_cold:n>t?s.temp_hot:s.temp_ok}return null}(e,t,i,n,r,o,s,a);return l?{color:l.c,opacity:l.a,mode:e}:null}const ln={blind:["mdi:blinds","mdi:blinds-open"],shade:["mdi:blinds","mdi:blinds-open"],shutter:["mdi:window-shutter","mdi:window-shutter-open"],curtain:["mdi:curtains-closed","mdi:curtains"],window:["mdi:window-closed","mdi:window-open"],awning:["mdi:awning-outline","mdi:awning"],door:["mdi:door-closed","mdi:door-open"],garage:["mdi:garage","mdi:garage-open"],gate:["mdi:gate","mdi:gate-open"],damper:["mdi:circle-slice-8","mdi:circle-outline"]},cn=[["mdi:roller-shade-closed","mdi:roller-shade"],["mdi:blinds-horizontal-closed","mdi:blinds-horizontal"],["mdi:garage-variant","mdi:garage-open-variant"],["mdi:door","mdi:door-open"]];function hn(e){for(const t of[...Object.values(ln),...cn])if(e===t[0]||e===t[1])return t;return null}function dn(e,t,i,n,r){if(!n||"unavailable"===n||"unknown"===n)return e;if(r){const i="cover"===t?hn(e):null;return i?"closed"===n?i[0]:i[1]:e}if("binary_sensor"===t){if("door"===i)return"on"===n?"mdi:door-open":"mdi:door-closed";if("window"===i)return"on"===n?"mdi:window-open":"mdi:window-closed";if("garage_door"===i)return"on"===n?"mdi:garage-open-variant":"mdi:garage-variant"}if("cover"===t){const t=ln[String(i||"")];if(t)return"closed"===n?t[0]:t[1];const r=hn(e);return r?"closed"===n?r[0]:r[1]:e}return"lock"===t?"locked"===n?"mdi:lock":"mdi:lock-open-variant":"light"===t&&"mdi:lightbulb"===e&&"on"===n?"mdi:lightbulb-on":e}function un(e){const t=Math.min(4e4,Math.max(1e3,e))/100,i=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592),n=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492),r=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307,o=e=>Math.round(Math.min(255,Math.max(0,e)));return[o(i),o(n),o(r)]}const pn=1/2.2;function _n(e){const t=/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(e);return t?"#"+t.slice(1).map(e=>Math.min(255,Number(e)).toString(16).padStart(2,"0")).join(""):null}function mn(e){if(!e||"object"!=typeof e||Array.isArray(e))return null;const t=e;if(Object.keys(t).some(e=>"c"!==e&&"bri"!==e))return null;const i=qt(t.c,null);return i?void 0===t.bri||null===t.bri?{c:i}:"number"!=typeof t.bri||!Number.isFinite(t.bri)||t.bri<.01||t.bri>1?null:{c:i,bri:t.bri}:null}function gn(e,t,i){const n=mn(t),r=e?.attributes||{},o=n?.bri??function(e){const t=e?.attributes?.brightness,i="number"==typeof t?t:"string"==typeof t&&""!==t.trim()?Number(t):Number.NaN;return Number.isFinite(i)?Math.max(0,Math.min(1,i/255)):1}(e);if(n)return{c:n.c,bri:o};const s=Wt(r.rgb_color);if(s)return{c:_n(s)||qt(i,"#ffd9a0"),bri:o};const a=Number(r.color_temp_kelvin)||(Number(r.color_temp)>0?1e6/Number(r.color_temp):NaN);return Number.isFinite(a)&&a>0?{c:(l=un(a),"#"+l.slice(0,3).map(e=>Math.min(255,Math.max(0,Math.round(Number(e)||0))).toString(16).padStart(2,"0")).join("")),bri:o}:{c:qt(i,"#ffd9a0"),bri:o};var l}function fn(e,t,i){return"on"===e?.state?gn(e,t,i):null}function vn(e,t=1){const i=Math.max(0,Math.min(1,Number.isFinite(e)?e:1)),n=.7*Math.max(0,Math.min(1,Number.isFinite(t)?t:1))*(.4+.6*Math.pow(i,pn));return Math.max(0,Math.min(1,n))}function yn(e){return e.startsWith("light.")||e.startsWith("switch.")}function bn(e,t,i=1e-6){const n=[];if(!e||!t||e.length<3||t.length<3)return n;for(let r=0;r<e.length;r++){const o=e[r],s=e[(r+1)%e.length],a=s[0]-o[0],l=s[1]-o[1],c=Math.hypot(a,l);if(c<i)continue;const h=a/c,d=l/c;for(let e=0;e<t.length;e++){const r=t[e],s=t[(e+1)%t.length],a=Math.abs((r[0]-o[0])*d-(r[1]-o[1])*h),l=Math.abs((s[0]-o[0])*d-(s[1]-o[1])*h),u=Math.max(i,1e-6*c);if(a>u||l>u)continue;const p=(r[0]-o[0])*h+(r[1]-o[1])*d,_=(s[0]-o[0])*h+(s[1]-o[1])*d,m=Math.max(0,Math.min(p,_)),g=Math.min(c,Math.max(p,_));g-m>i&&n.push([o[0]+h*m,o[1]+d*m,o[0]+h*g,o[1]+d*g])}}return n}function wn(e,t,i=1e-6){const n=[];for(const r of e){const e=[r[0],r[1]],o=[r[2],r[3]],s=o[0]-e[0],a=o[1]-e[1],l=Math.hypot(s,a);if(l<i)continue;const c=s/l,h=a/l,d=[];for(const n of t){const t=Math.abs((n[0]-e[0])*h-(n[1]-e[1])*c),r=Math.abs((n[2]-e[0])*h-(n[3]-e[1])*c),o=Math.max(i,1e-6*l);if(t>o||r>o)continue;const s=(n[0]-e[0])*c+(n[1]-e[1])*h,a=(n[2]-e[0])*c+(n[3]-e[1])*h,u=Math.max(0,Math.min(s,a)),p=Math.min(l,Math.max(s,a));p-u>i&&d.push([u,p])}if(!d.length){n.push([e[0],e[1],o[0],o[1]]);continue}d.sort((e,t)=>e[0]-t[0]);let u=0;for(const[t,r]of d)t-u>i&&n.push([e[0]+c*u,e[1]+h*u,e[0]+c*t,e[1]+h*t]),u=Math.max(u,r);l-u>i&&n.push([e[0]+c*u,e[1]+h*u,o[0],o[1]])}return n}function kn(e,t,i=1e-6){const n=[];for(let t=0;t<e.length;t++){const i=e[t],r=e[(t+1)%e.length];n.push([i[0],i[1],r[0],r[1]])}return wn(n,t,i)}const xn=864e5,$n=576e5;function Sn(e){const t=new Set,i=e=>{if("string"!=typeof e||!e)return;const i=Mn(e);i.startsWith("/api/houseplan/content/")&&t.add(i)};for(const t of e?.spaces||[]){i(t?.plan_url);for(const e of t?.markers||[])for(const t of e?.pdfs||[])i(t?.url)}for(const t of e?.markers||[])for(const e of t?.pdfs||[])i(e?.url);return t}function Mn(e){return e?e.startsWith("/houseplan_files/plans/")?"/api/houseplan/content/plans/_/"+e.slice(23):e.startsWith("/houseplan_files/files/")?"/api/houseplan/content/files/"+e.slice(23):e:""}function Rn(e,t){const i=t?.settings?.fill_mode;return"none"===i||"lqi"===i||"light"===i||"temp"===i||"custom"===i?i:e}function Tn(e,t){const i=t?.settings;return"boolean"==typeof i?.glow?i.glow:"glow"===i?.fill_mode||e}function Cn(e,t,i,n){if(!t||!i||t===i)return e;const r="/files/"+t+"/",o="/files/"+i+"/";return e.map(e=>{if(!e.url.includes(r))return e;const t=e.url.split(r)[1]||"",[i,s]=[t.split("?")[0],t.includes("?")?"?"+t.split("?")[1]:""];if(n){const t=n[decodeURIComponent(i)]??n[i];return t?{...e,url:e.url.split(r+i)[0]+o+encodeURIComponent(t)+s}:e}return{...e,url:e.url.split(r).join(o)}})}function Dn(e,t=1){const i=Number(e);return Number.isFinite(i)&&i>0?Math.min(3,Math.max(.5,i)):t}function An(e,t,i){let n=null,r=null;for(const o of t){if(!(Math.abs(o[0]-e[0])<1e-6&&Math.abs(o[1]-e[1])<1e-6)){if(Math.abs(o[0]-e[0])<=i){const t=Math.abs(o[1]-e[1]);t>1e-6&&(!n||t<n.d)&&(n={d:t,c:o})}if(Math.abs(o[1]-e[1])<=i){const t=Math.abs(o[0]-e[0]);t>1e-6&&(!r||t<r.d)&&(r={d:t,c:o})}}}const o=[];return n&&o.push({axis:"x",at:n.c[0],from:n.c}),r&&o.push({axis:"y",at:r.c[1],from:r.c}),o}function On(e,t){let i=180*Math.atan2(t[1]-e[1],t[0]-e[0])/Math.PI;return i<0&&(i+=360),i}function zn(e,t=.5){const i=(e%45+45)%45;return i<=t||45-i<=t}function Pn(e,t){const i=t[2]-t[0],n=t[3]-t[1],r=i*i+n*n;if(!r)return Math.hypot(e[0]-t[0],e[1]-t[1]);let o=((e[0]-t[0])*i+(e[1]-t[1])*n)/r;return o=Math.max(0,Math.min(1,o)),Math.hypot(e[0]-(t[0]+o*i),e[1]-(t[1]+o*n))}const Fn=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);function In(e,t){return"alarm_control_panel"===e||"siren"===e||"binary_sensor"===e&&!!t&&Fn.has(t)}function En(e){if(!e)return null;const t=e.indexOf("#");if(t<=0)return null;const i=e.slice(0,t),n=e.slice(t+1);if(!n)return null;if(n.startsWith("@")){const e=n.slice(1);return e?{space:i,area:null,roomId:e}:null}return{space:i,area:n,roomId:null}}function Nn(e,t,i){const n=i/t;return yi(e)*n*n/1e4}function Hn(e,t){return t?`${Math.round(10.7639*e)} ft²`:`${(Math.round(10*e)/10).toFixed(1)} m²`}function Ln(e){const t=e%360;return t<0?t+360:t}function qn(e,t){const i=function(e,t){return Ln(e+t)}(e,t)*Math.PI/180;return[Math.sin(i),-Math.cos(i)]}const jn=Object.freeze({dawn:Object.freeze({top:"#aabdd1",bottom:"#e8c8b7",horizon:"rgba(255,201,156,.56)",sun:"rgba(255,188,125,.78)",vignette:"rgba(65,72,99,.21)",outlineNear:"rgba(74,57,61,.25)",outlineMid:"rgba(255,238,224,.40)",outlineFar:"rgba(255,224,202,.18)"}),day:Object.freeze({top:"#dce9ef",bottom:"#cbdce3",horizon:"rgba(255,245,220,.45)",sun:"rgba(255,239,190,.72)",vignette:"rgba(65,91,105,.16)",outlineNear:"rgba(45,62,71,.28)",outlineMid:"rgba(255,255,255,.42)",outlineFar:"rgba(255,255,255,.20)"}),dusk:Object.freeze({top:"#48536c",bottom:"#9a7380",horizon:"rgba(242,156,114,.34)",sun:"rgba(255,167,113,.55)",vignette:"rgba(20,26,44,.39)",outlineNear:"rgba(238,219,225,.40)",outlineMid:"rgba(229,207,218,.26)",outlineFar:"rgba(215,190,205,.12)"}),night:Object.freeze({top:"#111a27",bottom:"#1f2f3e",horizon:"rgba(79,120,151,.16)",sun:"rgba(169,208,231,0)",vignette:"rgba(3,8,14,.58)",outlineNear:"rgba(218,238,249,.56)",outlineMid:"rgba(174,215,238,.30)",outlineFar:"rgba(136,194,226,.14)"})}),Bn=e=>"number"==typeof e&&Number.isFinite(e),Wn=(e,t,i)=>Math.min(i,Math.max(t,e));function Un(e){return e.elevation<=-6?"night":e.elevation>=6?"day":e.rising?"dawn":"dusk"}function Gn(e){const t=(Math.floor(Number(e)||0)%1440+1440)%1440;return t>=300&&t<480?"dawn":t>=480&&t<1080?"day":t>=1080&&t<1260?"dusk":"night"}function Vn(e){const t=Un(e),i=e.azimuth*Math.PI/180;return{sunX:50-42*Math.sin(i),sunY:78-Wn(e.elevation,0,90)/90*64,sunOpacity:"night"===t?0:Wn((e.elevation+6)/12,0,1)}}function Kn(e){const t=(Math.floor(Number(e)||0)%1440+1440)%1440;if(t<300||t>=1260)return{sunX:50,sunY:78,sunOpacity:0};const i=(t-300)/960,n=(t-300)/120,r=(1260-t)/120;return{sunX:8+84*i,sunY:78-64*Math.sin(i*Math.PI),sunOpacity:Math.max(.18,Math.min(n,r,1))}}function Yn(e,t=new Date){const i=function(e){const t=e?.states?.["sun.sun"]?.attributes;return t&&Bn(t.azimuth)&&Bn(t.elevation)&&"boolean"==typeof t.rising?{azimuth:Ln(t.azimuth),elevation:t.elevation,rising:t.rising}:null}(e);if(i)return{phase:Un(i),source:"sun",...Vn(i)};const n="number"==typeof t?t:function(e=new Date){return 60*e.getHours()+e.getMinutes()}(t);return{phase:Gn(n),source:"clock",...Kn(n)}}function Zn(e){return`${e.source}|${e.phase}|${e.sunX.toFixed(2)}|${e.sunY.toFixed(2)}|`+e.sunOpacity.toFixed(3)}const Xn=[[-90,"#070c14"],[-12,"#070c14"],[-4,"#131a28"],[0,"#4a3527"],[10,"#e8ddcf"],[30,"#ffffff"],[90,"#ffffff"]],Jn=e=>Math.min(1,Math.max(0,e));function Qn(e,t,i=6){const n=e.angle*Math.PI/180,r=[Math.sin(n),-Math.cos(n)],o=n=>{const o=[e.x+r[0]*i*n,e.y+r[1]*i*n];return t.find(e=>e.poly.length>=3&&si(o,e.poly))||null},s=o(1),a=o(-1);return s&&a?null:s||a?s?{normal:[-r[0],-r[1]],roomId:s.id}:{normal:r,roomId:a.id}:null}function er(e,t,i){return i>0&&e[0]*t[0]+e[1]*t[1]>.05}function tr(e,t,i,n){return[[e[0],e[1]],[t[0],t[1]],[t[0]+i[0]*n,t[1]+i[1]*n],[e[0]+i[0]*n,e[1]+i[1]*n]]}function ir(e,t){try{const i=Nt([[...e.map(e=>[e[0],e[1]]),[e[0][0],e[0][1]]]],[[...t.map(e=>[e[0],e[1]]),[t[0][0],t[0][1]]]]),n=[];for(const e of i){const t=e?.[0];!Array.isArray(t)||t.length<4||n.push(t.slice(0,t.length-1).map(e=>[e[0],e[1]]))}return n}catch{return[]}}function nr(e,t,i,n,r,o,s){if(!(n>0))return[];const a=qn(i,r),l=[-a[0],-a[1]],c=function(e){const t=Math.min(90,Math.max(0,e));return.7*(.8+1.7*Math.pow(1-t/90,1.6))}(n),h=[];for(const i of t){if(!(i.length>0))continue;const t=Qn(i,e);if(!t||!er(t.normal,a,n))continue;const r=e.find(e=>e.id===t.roomId);if(!r)continue;const d=o&&o[t.roomId]||r.poly,u=i.angle*Math.PI/180,p=i.length/2,_=[-t.normal[0],-t.normal[1]],m=Math.max(0,s?.[i.id]||0),g=i.x+_[0]*m/2,f=i.y+_[1]*m/2,v=Math.cos(u)*p,y=Math.sin(u)*p,b=[g-v,f-y],w=[g+v,f+y],k=c*i.length,x=ir(tr(b,w,l,k),d);if(!x.length)continue;const $=l[0]*_[0]+l[1]*_[1];h.push({openingId:i.id,roomId:t.roomId,polys:x,a:b,b:w,dir:l,len:k,normal:_,depth:k*$})}return h}const rr=e=>"number"==typeof e&&Number.isInteger(e)&&e>=0&&e<=359?e:null;function or(e,t){const i=rr(t?.north_deg);return null!==i?i:rr(e?.north_deg)}function sr(e,t){const i=e=>"static"===e||"daynight"===e?e:null;return i(t?.bg_mode)??i(e?.bg_mode)??"static"}function ar(e,t){const i=t?.sun_rays;return"boolean"==typeof i?i:!0===e?.sun_rays}function lr(e){const t=e?.states?.["sun.sun"]?.attributes,i=Number(t?.azimuth),n=Number(t?.elevation);return Number.isFinite(i)&&Number.isFinite(n)?{azimuth:i,elevation:n}:null}const cr=["dawn","day","dusk","night"];function hr(e){if(!e)return"";const t=jn[e.phase];return[`--hp-day-cycle-outline-near:${t.outlineNear}`,`--hp-day-cycle-outline-mid:${t.outlineMid}`,`--hp-day-cycle-outline-far:${t.outlineFar}`].join(";")}function dr(e,t=1){if(!e)return G;const i=[`--hp-day-cycle-sun-x:${e.sunX.toFixed(2)}%`,`--hp-day-cycle-sun-y:${e.sunY.toFixed(2)}%`,`--hp-day-cycle-sun-opacity:${e.sunOpacity.toFixed(3)}`,`opacity:${Math.min(1,Math.max(0,t)).toFixed(4)}`].join(";");return B`<div class="hp-day-cycle-env" aria-hidden="true"
      data-day-cycle-phase=${e.phase} data-day-cycle-source=${e.source}
      style=${i}>
    ${cr.map(t=>{const i=jn[t],n=`background:radial-gradient(ellipse at 50% 88%, ${i.horizon} 0%, transparent 54%),linear-gradient(180deg, ${i.top} 0%, ${i.bottom} 100%);box-shadow:inset 0 0 90px ${i.vignette}`;return B`<div class="hp-day-cycle-bg phase-${t} ${t===e.phase?"active":""}"
          data-day-cycle-layer=${t} style=${n}>
        <div class="hp-day-cycle-sun" style="background:radial-gradient(circle, ${i.sun} 0%, transparent 67%)"></div>
      </div>`})}
  </div>`}const ur={color:"#607d8b",opacity:1,widthCm:3.6,fill:!1,fillColor:"#607d8b",fillOpacity:.25},pr=(e,t=1)=>{const i=Number(e);return Number.isFinite(i)?Math.min(1,Math.max(0,i)):t},_r=e=>{let t=Number(e);return Number.isFinite(t)?(t=(t%360+360)%360,t>180?t-360:t):0};function mr(e,t,i){return _r(t)?[e.x,e.y]:i([e.x,e.y])}function gr(e,t,i,n){const r=Math.abs(i[0]-t[0]),o=Math.abs(i[1]-t[1]);return"line"===e?Math.hypot(r,o)>=n:r>=n&&o>=n}const fr=(e,t,i)=>{const n=Number(e),r=Number.isFinite(t)&&t>0?t:5;return Number.isFinite(n)&&n>0?n/r*i:0},vr=(e,t,i)=>{const n=Number(e),r=Number.isFinite(t)&&t>0?t:5;return Number.isFinite(n)&&i>0?n/i*r:0},yr=(e,t,i,n=ur.widthCm)=>{const r=Number(e?.width_cm);if(Number.isFinite(r)&&r>0)return r;const o=Number(e?.width);return Number.isFinite(o)&&o>0?vr(o,t,i):n};function br(e,t){return{color:e.color,opacity:pr(e.opacity),width_cm:Math.max(.1,Math.min(100,Number(e.widthCm)||.1)),...t?{fill:e.fill,fill_color:e.fillColor,fill_opacity:pr(e.fillOpacity,.25)}:{}}}function wr(e){const t=e.x+e.w/2,i=e.y+e.h/2,n=_r(e.angle)*Math.PI/180,r=Math.cos(n),o=Math.sin(n),s=(e,n)=>{const s=e-t,a=n-i;return[t+s*r-a*o,i+s*o+a*r]};return[s(e.x,e.y),s(e.x+e.w,e.y),s(e.x+e.w,e.y+e.h),s(e.x,e.y+e.h)]}function kr(e){const t=wr(e),i=(e,t)=>[(e[0]+t[0])/2,(e[1]+t[1])/2],n=[(t[0][0]+t[2][0])/2,(t[0][1]+t[2][1])/2];return{points:[...t,i(t[0],t[1]),i(t[1],t[2]),i(t[2],t[3]),i(t[3],t[0]),n],segments:t.map((e,i)=>({a:e,b:t[(i+1)%4]}))}}function xr(e,t,i,n,r,o,s,a){const l=_r(e.angle)*Math.PI/180,c=Math.cos(l),h=Math.sin(l),d=-Math.sin(l),u=Math.cos(l),p=e.x+e.w/2,_=e.y+e.h/2,m=t>0?-e.w/2:e.w/2,g=i>0?-e.h/2:e.h/2,f=p+m*c+g*d,v=_+m*h+g*u,y=n-f,b=r-v;let w=(y*c+b*h)*(t>0?1:-1),k=(y*d+b*u)*(i>0?1:-1),x=null;if(o){const t=w/Math.max(e.w,a),i=k/Math.max(e.h,a);x=Math.max(a/Math.max(e.w,a),a/Math.max(e.h,a),t,i),w=e.w*x,k=e.h*x}if(s>0)if(o){const t=Math.max(1,Math.round(e.w/s)),i=Math.max(1,Math.round(e.h/s));if(Math.abs(e.w-t*s)<1e-6&&Math.abs(e.h-i*s)<1e-6){const n=(e,t)=>{let i=Math.abs(e),n=Math.abs(t);for(;n;)[i,n]=[n,i%n];return Math.max(1,i)},r=1/n(t,i),o=Math.max(a/e.w,a/e.h),s=Math.max(o,Math.round((x??1)/r)*r);w=e.w*s,k=e.h*s}else{e.w>=e.h?(w=Math.round(w/s)*s,k=w*(e.h/Math.max(e.w,a))):(k=Math.round(k/s)*s,w=k*(e.w/Math.max(e.h,a)))}}else w=Math.round(w/s)*s,k=Math.round(k/s)*s;w=Math.max(a,w),k=Math.max(a,k);return{x:f+(t>0?w/2:-w/2)*c+(i>0?k/2:-k/2)*d-w/2,y:v+(t>0?w/2:-w/2)*h+(i>0?k/2:-k/2)*u-k/2,w:w,h:k,angle:_r(e.angle)||void 0}}const $r=(e,t,i)=>{const n=i[0]-t[0],r=i[1]-t[1],o=n*n+r*r;if(o<1e-12)return[...t];const s=Math.max(0,Math.min(1,((e[0]-t[0])*n+(e[1]-t[1])*r)/o));return[t[0]+n*s,t[1]+r*s]};function Sr(e,t,i,n){const r=n(e);let o=null;for(const r of t.points){const t=n(r),s=Math.hypot(t[0]-e[0],t[1]-e[1]);s<=i&&(!o||s<o.d)&&(o={p:t,d:s,kind:"point",target:r})}for(const r of t.segments){const t=$r(e,r.a,r.b),s=n(t),a=Math.hypot(s[0]-e[0],s[1]-e[1]);a<=i&&(!o||a<o.d)&&(o={p:s,d:a,kind:"edge",target:t})}return o?{point:o.p,target:o.target,kind:o.kind}:{point:r,target:null,kind:"grid"}}function Mr(e){return{points:e.flatMap(e=>e.points),segments:e.flatMap(e=>e.segments)}}const Rr=Math.tan(.25*Math.PI/180);function Tr(e,t){const i=Math.abs(Number(t[0])-Number(e[0])),n=Math.abs(Number(t[1])-Number(e[1]));if(!([i,n].every(Number.isFinite)&&i>0&&n>0))return null;const r=i>=n?"horizontal":"vertical",o=Math.max(i,n),s=Math.min(i,n);return s/o>Rr?null:{axis:r,major:o,minor:s,angleDegrees:180*Math.atan2(s,o)/Math.PI}}function Cr(e,t){const i=Tr(e,t);return i?"horizontal"===i.axis?[Number(t[0]),Number(e[1])]:[Number(e[0]),Number(t[1])]:[Number(t[0]),Number(t[1])]}const Dr=e=>`${e[0]},${e[1]}`,Ar=(e,t)=>e[0]===t[0]&&e[1]===t[1],Or=(e,t)=>{const i=Dr(e),n=Dr(t);return i<n?`${i}|${n}`:`${n}|${i}`},zr=e=>{let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return t/2},Pr=e=>{if(e.length<3)return!1;for(let t=0;t<e.length;t++){if(Ar(e[t],e[(t+1)%e.length]))return!1;for(let i=t+1;i<e.length;i++)if(i!==t+1&&(0!==t||i!==e.length-1)&&ui(e[t],e[(t+1)%e.length],e[i],e[(i+1)%e.length]))return!1}return yi(e)>1e-12},Fr=e=>{for(let t=0;t+1<e.length;t++){if(Ar(e[t],e[t+1]))return!1;for(let i=t+2;i+1<e.length;i++)if(ui(e[t],e[t+1],e[i],e[i+1]))return!1}return!0},Ir=(e,t)=>Ar(e,t.from)?[...t.to]:[...e],Er=(e,t)=>e.map(e=>Array.isArray(e?.poly)?{...e,poly:e.poly.map(e=>Ir(e,t))}:e),Nr=(e,t,i)=>{const n=e.flatMap((e,t)=>Zt(e)?.some(e=>Ar(e,i.from))?[t]:[]);if(!n.length)return!1;for(const i of n){const n=Zt(e[i]),r=Zt(t[i]);if(!n||!r)continue;if(!Pr(r))return!1;const o=Math.sign(zr(n)),s=Math.sign(zr(r));if(o&&s&&o!==s)return!1}const r=new Set;for(const e of n){const i=Zt(t[e]);if(i)for(let n=0;n<t.length;n++){if(e===n)continue;const o=e<n?`${e}:${n}`:`${n}:${e}`;if(r.has(o))continue;r.add(o);const s=Zt(t[n]);if(s&&fi(i,s))return!1}}return!0},Hr=(e,t)=>{let i=0;for(const n of e){const e=Zt(n);if(e)for(let n=0;n<e.length;n++){const r=e[n],o=e[(n+1)%e.length];(Ar(r,t)||Ar(o,t))&&(r[0]!==o[0]&&r[1]!==o[1]||i++)}}return i},Lr=(e,t)=>{const{a:i,b:n,axis:r}=e,o="horizontal"===r?{from:n,to:[n[0],i[1]]}:{from:n,to:[i[0],n[1]]},s="horizontal"===r?{from:i,to:[i[0],n[1]]}:{from:i,to:[n[0],i[1]]};return[{move:o,preservedDegree:Hr(t,i)},{move:s,preservedDegree:Hr(t,n)}].sort((e,t)=>t.preservedDegree-e.preservedDegree||Dr(e.move.to).localeCompare(Dr(t.move.to))||Dr(e.move.from).localeCompare(Dr(t.move.from))).map(e=>e.move)};function qr(e){const t=JSON.parse(JSON.stringify(e||{}));let i=Array.isArray(t.rooms)?t.rooms:[];const n=new Map;for(const e of i){const t=Zt(e);if(t)for(let e=0;e<t.length;e++){const i=[...t[e]],r=[...t[(e+1)%t.length]],o=Tr(i,r);if(!o)continue;const s=Or(i,r);n.has(s)||n.set(s,{key:s,a:i,b:r,axis:o.axis})}}let r=0,o=0,s=0;const a=new Map;for(const e of[...n.values()].sort((e,t)=>e.key.localeCompare(t.key))){let t=null;for(const n of Lr(e,i)){const e=a.get(Dr(n.from));if(e&&e!==Dr(n.to))continue;const r=Er(i,n);if(Nr(i,r,n)){t=n,i=r;break}}t?(a.set(Dr(t.from),Dr(t.to)),r++,s=Math.max(s,Math.hypot(t.to[0]-t.from[0],t.to[1]-t.from[1]))):o++}t.rooms=i;for(const e of t.room_drafts||[]){if(!Array.isArray(e?.points)||e.points.length<2)continue;const t=e.points.map(e=>[...e]),i=t.slice(0,-1).flatMap((i,n)=>{const r=t[n+1],o=Tr(i,r);return o?[{key:`${String(e.id||"")}:${n}`,a:[...i],b:[...r],axis:o.axis}]:[]});let n=t;for(const e of i){let t=null;for(const i of Lr(e,[{poly:n}])){const e=n.map(e=>Ir(e,i)),r=e.length>=4&&Ar(e[0],e[e.length-1]),o=r?e.slice(0,-1):e;if(r?Pr(o):Fr(o)){t=i,n=e;break}}t?(r++,s=Math.max(s,Math.hypot(t.to[0]-t.from[0],t.to[1]-t.from[1]))):o++}e.points=n}for(const e of t.partitions||[]){if(!Array.isArray(e?.a)||!Array.isArray(e?.b))continue;const i=Tr(e.a,e.b);if(!i)continue;const n={key:String(e.id||Or(e.a,e.b)),a:[...e.a],b:[...e.b],axis:i.axis};let a=null;for(const i of Lr(n,[{poly:[e.a,e.b]}])){const n=Ir(e.a,i),r=Ir(e.b,i),o=Math.hypot(r[0]-n[0],r[1]-n[1]);if(!(o>0))continue;const s=(t.openings||[]).filter(t=>"partition"===t?.host?.kind&&t.host.id===e.id).every(e=>{const t=Number(e.host.t),i=Number(e.length);return Number.isFinite(t)&&t>=0&&t<=1&&Number.isFinite(i)&&i>0&&t*o-i/2>=-1e-12&&t*o+i/2<=o+1e-12});if(s){a=i,e.a=n,e.b=r;break}}a?(r++,s=Math.max(s,Math.hypot(a.to[0]-a.from[0],a.to[1]-a.from[1]))):o++}return{space:t,report:{wallsStraightened:r,wallsStraightenSkipped:o,maxStraightenShift:s},changed:r>0}}const jr=10**9,Br=240,Wr=1e-4;function Ur(e){if(Array.isArray(e))return e.map(e=>Ur(e));if(null!==e&&"object"==typeof e){const t={};for(const[i,n]of Object.entries(e))t[i]=Ur(n);return t}return e}function Gr(e){if("number"!=typeof e||!Number.isFinite(e))return e;const t=(e<0||Object.is(e,-0)?-1:1)*(Math.floor(Math.abs(e)*jr+.5)/jr);return 0===t?0:t}function Vr(e){if("number"!=typeof e||!Number.isFinite(e))return e;const t=e*Br,i=Math.round(t);if(Math.abs(t-i)<Wr){const e=i/Br;return 0===e?0:e}return Gr(e)}function Kr(e){if(!Number.isFinite(e)||0===e)return"0";return Math.abs(e)<.001?e.toExponential(2):String(Number(e.toPrecision(3)))}function Yr(e){return null===e||"object"!=typeof e||Array.isArray(e)?null:e}function Zr(e){return Array.isArray(e)?e.filter(e=>null!==Yr(e)):[]}function Xr(e,t){for(const i of t)Object.prototype.hasOwnProperty.call(e,i)&&(e[i]=Gr(e[i]))}function Jr(e,t){for(const i of t)Object.prototype.hasOwnProperty.call(e,i)&&(e[i]=Vr(e[i]))}function Qr(e){if(Array.isArray(e))for(let t=0;t<Math.min(2,e.length);t++)e[t]=Vr(e[t])}function eo(e){if(Array.isArray(e))for(const t of e)Qr(t)}function to(e,t,i){const n=Yr(e);if(n)for(const e of Zr(n.spaces)){const t=(t,n)=>{for(const r of n){const n=t[r];"number"==typeof n&&Number.isFinite(n)&&i(n,e)}},n=t=>{if(Array.isArray(t))for(let n=0;n<Math.min(2,t.length);n++){const r=t[n];"number"==typeof r&&Number.isFinite(r)&&i(r,e)}},r=e=>{if(Array.isArray(e))for(const t of e)n(t)};for(const i of Zr(e.rooms))t(i,["x","y","w","h"]),r(i.poly);for(const t of Zr(e.walls))n(t.a),n(t.b);for(const t of Zr(e.wall_segments))n(t.a),n(t.b);for(const i of Zr(e.openings))t(i,["x","y"]);for(const i of Zr(e.decor))"line"===i.kind?t(i,["x1","y1","x2","y2"]):"rect"===i.kind||"ellipse"===i.kind||"furniture"===i.kind?t(i,["x","y","w","h"]):"text"===i.kind&&t(i,["x","y"]);for(const t of Zr(e.room_drafts))r(t.points);for(const t of Zr(e.partitions))n(t.a),n(t.b);for(const t of Zr(e.wall_columns))n(t.center);for(const t of Zr(e.open_spans))n(t.a),n(t.b)}const r=Yr(t);if(!r)return;const o=new Map;if(n)for(const e of Zr(n.spaces))null!=e.id&&o.set(String(e.id),e);for(const e of Object.values(r)){const t=Yr(e);if(!t)continue;const n=null!=t.s&&o.get(String(t.s))||null;for(const e of["x","y"]){const r=t[e];"number"==typeof r&&Number.isFinite(r)&&i(r,n)}}}function io(e){const t=Number(e?.cell_cm);return t>0?t:5}function no(e,t={}){const i={canonicalized:0,far:0,maxShift:0,maxShiftCm:0,spaces:[],bySpace:new Map},n=Zr(Yr(e)?.spaces);let r=5;for(const e of n)r=Math.max(r,io(e));to(e,t,(e,t)=>{const n=e*Br,o=Math.abs(n-Math.round(n)),s=Vr(e),a=o>0&&o<Wr;if(!a&&!(o>=Wr))return;const l=a&&"number"==typeof s?Math.abs(s-e):0;if(a?i.canonicalized++:i.far++,i.maxShift=Math.max(i.maxShift,l),i.maxShiftCm=Math.max(i.maxShiftCm,l*Br*(t?io(t):r)),!t?.id||!a)return;const c=String(t.id);let h=i.bySpace.get(c);h||(h={spaceId:c,space:String(t.title||c),canonicalized:0,far:0,maxShift:0,maxShiftCm:0},i.bySpace.set(c,h)),h.canonicalized++,h.maxShift=Math.max(h.maxShift,l),h.maxShiftCm=Math.max(h.maxShiftCm,l*Br*io(t))}),i.bySpace.size&&to(e,t,(e,t)=>{if(!t?.id)return;const n=i.bySpace.get(String(t.id));if(!n)return;const r=e*Br;Math.abs(r-Math.round(r))>=Wr&&n.far++}),i.spaces=[...i.bySpace.values()];const{bySpace:o,...s}=i;return s}function ro(e){return function(e){const t=e,i=Yr(t);i&&Jr(i,["x","y"]);return t}(Ur(e))}function oo(e){const t=e,i=Yr(t);if(!i)return t;for(const e of Object.values(i)){const t=Yr(e);t&&Jr(t,["x","y"])}return t}function so(e){return ao(Ur(e))}function ao(e){const t=e,i=Yr(t);if(!i)return t;for(const e of Zr(i.spaces)){Xr(e,["plan_x","plan_y","plan_scale","plan_scale_x","plan_scale_y","plan_angle"]);for(const t of Zr(e.rooms))Jr(t,["x","y","w","h"]),eo(t.poly);for(const t of Zr(e.walls))Qr(t.a),Qr(t.b);for(const t of Zr(e.wall_segments))Qr(t.a),Qr(t.b);for(const t of Zr(e.openings)){Jr(t,["x","y"]),Xr(t,["angle","length"]);const e=Yr(t.host);e&&Xr(e,["t"])}for(const t of Zr(e.decor))"line"===t.kind?Jr(t,["x1","y1","x2","y2"]):"rect"===t.kind||"ellipse"===t.kind||"furniture"===t.kind?(Jr(t,["x","y","w","h"]),Xr(t,["angle"])):"text"===t.kind&&(Jr(t,["x","y"]),Xr(t,["scale","angle"]));for(const t of Zr(e.room_drafts))eo(t.points);for(const t of Zr(e.partitions))Qr(t.a),Qr(t.b);for(const t of Zr(e.wall_columns))Qr(t.center),"square"===t.shape&&Xr(t,["angle"]);for(const t of Zr(e.open_spans))Qr(t.a),Qr(t.b)}for(const e of Zr(i.markers))Xr(e,["angle"]);return t}const lo=15,co=8;function ho(e,t,i,n,r){const o=i[0]-e[0],s=i[1]-e[1],a=Math.hypot(o,s);if(!(a>0)||a<=r+1e-9)return null;const l=o/a,c=s/a,h=t=>{const n=(t[0]-e[0])*l+(t[1]-e[1])*c,o=(r-n)/(a-n);return!Number.isFinite(o)||o<-1e-9||o>1+1e-9?null:[t[0]+(i[0]-t[0])*o,t[1]+(i[1]-t[1])*o]},d=h(t),u=h(n);return d&&u?[[e[0],e[1]],t,d,u,n]:null}const uo=Math.sin(.25*Math.PI/180);function po(e,t){return Number.isFinite(e)&&e>0&&Number.isFinite(t)&&t>0&&e*t<3}function _o(e){const t=Number(e)>0?Number(e):5;if(5===t)return 8;const i=5/t*8;return Math.min(80,Math.max(.5,i))}function mo(e,t){return Number.isFinite(e)&&e>0&&Number.isFinite(t)&&t>0&&e*t<2}function go(e){return Number.isFinite(e)?Math.max(1,Math.min(100,e)):1}function fo(e,t){return!Number.isFinite(e)||e<0?"":String(t?Math.round(e/2.54*100)/100:Math.round(100*e)/100)}function vo(e,t,i){if(!Number.isFinite(e)||e<=0)return 0;const n=Number(t)>0?Number(t):5;return go(e)/n*i}function yo(e,t){return t>0&&Number.isFinite(e)?Math.round(e/t)*t:e}function bo(e){return Math.max(1e-6*Math.abs(e),1e-9)}function wo(e,t){if(!(t>0&&Number.isFinite(e)))return e;const i=yo(e,t);return Math.abs(i-e)<=bo(t)?i:e}function ko(e,t){let i=t[0]-e[0],n=t[1]-e[1];const r=Math.hypot(i,n);return r<1e-12?[1,0]:(i/=r,n/=r,(i<-1e-12||Math.abs(i)<=1e-12&&n<0)&&(i=-i,n=-n),[i,n])}function xo(e,t,i){const n=[wo(e[0],i),wo(e[1],i)],r=[wo(t[0],i),wo(t[1],i)],o=yo((n[0]+r[0])/2,i),s=yo((n[1]+r[1])/2,i),[a,l]=ko(n,r);let c=Math.atan2(l,a);c<0&&(c+=Math.PI);const h=Math.round(1800*c)/1800,d=i>0&&i<.01?6:i<1?4:2;return`${o.toFixed(d)},${s.toFixed(d)}@${h.toFixed(4)}`}function $o(e,t,i,n){return 1===n?xo(e,t,i):xo([e[0]/n,e[1]/n],[t[0]/n,t[1]/n],i)}function So(e,t){if(!Array.isArray(e.a)||!Array.isArray(e.b)||e.a.length<2||e.b.length<2)return null;const i=[Number(e.a[0]),Number(e.a[1]),Number(e.b[0]),Number(e.b[1])];if(!i.every(Number.isFinite))return null;const n=t>0?t:1;return[[i[0]*n,i[1]*n],[i[2]*n,i[3]*n]]}function Mo(e,t,i,n,r){const o=r>0?r:1;return{key:$o(e,t,n,o),cm:go(i),a:[e[0]/o,e[1]/o],b:[t[0]/o,t[1]/o]}}function Ro(e,t){const i=t>0?t:1,n=[];for(const t of e){const e=t.key.lastIndexOf("@");if(e<0)continue;const[r,o]=t.key.slice(0,e).split(",").map(Number),s=Number(t.key.slice(e+1));[r,o,s].every(Number.isFinite)&&n.push({w:t,x:r*i,y:o*i,ang:s})}return n}function To(e,t){const[i,n]=ko(e,t);let r=Math.atan2(n,i);return r<0&&(r+=Math.PI),r}function Co(e,t){let i=Math.abs(e-t);return i>Math.PI/2&&(i=Math.PI-i),i<.02}function Do(e,t,i,n,r=1){if(!e?.length)return null;const o=$o(t,i,n,r),s=e.find(e=>e.key===o);if(s)return s;const a=r>0?r:1,l=bo(n)*a,c=(e,t)=>Math.abs(e[0]-t[0])<=l&&Math.abs(e[1]-t[1])<=l;for(const n of e){const e=So(n,a);if(e&&(c(e[0],t)&&c(e[1],i)||c(e[0],i)&&c(e[1],t)))return n}const h=(t[0]+i[0])/2,d=(t[1]+i[1])/2,u=To(t,i),p=Math.max(.5*n,1e-9)*a;for(const t of Ro(e,a))if(Co(t.ang,u)&&Math.hypot(t.x-h,t.y-d)<=p)return t.w;return null}function Ao(e,t,i,n,r=1){const o=Do(e,t,i,n,r);if(o&&o.cm>0)return go(o.cm);const s=function(e,t,i,n,r){if(!e?.length)return null;const o=r>0?r:1,s=Math.hypot(i[0]-t[0],i[1]-t[1]);if(s<1e-12)return null;const a=To(t,i),l=Math.max(.5*n,1e-9)*o;let c=null;for(const n of e){if(!(n.cm>0))continue;const e=So(n,o);if(!e)continue;const r=Math.hypot(e[1][0]-e[0][0],e[1][1]-e[0][1]);if(r<1e-12||!Co(To(e[0],e[1]),a))continue;if(bs(t[0],t[1],e[0][0],e[0][1],e[1][0],e[1][1])>l||bs(i[0],i[1],e[0][0],e[0][1],e[1][0],e[1][1])>l)continue;if(r+l<s)continue;const h=Math.max(0,r-s),d=`${n.key}|${go(n.cm)}|${e.flat().join(",")}`;(!c||h<c.extra-1e-12||Math.abs(h-c.extra)<=1e-12&&d<c.stable)&&(c={wall:n,extra:h,stable:d})}return c?.wall||null}(e,t,i,n,r);return s?go(s.cm):0}function Oo(e,t,i,n=1,r=[]){if(!e?.length)return[];const o=new Set,s=Jt(t);for(const e of s)o.add($o([e[0],e[1]],[e[2],e[3]],i,n));const a=t||[],l=Math.max(i*n*.02,1e-9);for(let e=0;e<a.length;e++){const t=Zt(a[e]);if(t)for(let r=e+1;r<a.length;r++){const e=Zt(a[r]);if(e)for(const r of bn(t,e,l))o.add($o([r[0],r[1]],[r[2],r[3]],i,n))}}for(const t of a){if(!t?.id)continue;const s=ss(a,t.id,r,i,n,e);if(s)for(let e=0;e<s.poly.length;e++)o.add($o(s.poly[e],s.poly[(e+1)%s.poly.length],i,n))}return e.filter(e=>(o.has(e.key)||(e=>{const t=So(e,n);if(!t)return!1;const[i,o]=t,a=o[0]-i[0],c=o[1]-i[1],h=Math.hypot(a,c);if(h<=l)return!1;if(!s.some(e=>{const t=[e[0],e[1]],n=[e[2],e[3]];return Co(To(i,o),To(t,n))&&bs(i[0],i[1],t[0],t[1],n[0],n[1])<=l&&bs(o[0],o[1],t[0],t[1],n[0],n[1])<=l}))return!1;const d=(r||[]).some(e=>{const t=[e[0],e[1]],n=[e[2],e[3]];if(!Co(To(i,o),To(t,n)))return!1;const r=e=>Math.abs((e[0]-i[0])*c-(e[1]-i[1])*a)/h;if(r(t)>l||r(n)>l)return!1;const s=h*h,d=((t[0]-i[0])*a+(t[1]-i[1])*c)/s,u=((n[0]-i[0])*a+(n[1]-i[1])*c)/s;return Math.min(1,Math.max(d,u))-Math.max(0,Math.min(d,u))>l/h});return!d})(e))&&e.cm>=1&&e.cm<=100)}function zo(e,t,i,n=8){const[r,o]=ko(e,t);let s=Math.atan2(o,r);s<0&&(s+=Math.PI);let a=i*Math.PI/180%Math.PI;a<0&&(a+=Math.PI);let l=Math.abs(s-a);return l>Math.PI/2&&(l=Math.PI-l),l<=n*Math.PI/180}function Po(e,t,i,n,r=1,o="affine",s){if(!e?.length)return[];if(t.length!==i.length)return"fixed-topology"===o&&s?.(),e.slice();const a=r>0?r:1,l=Math.max(.5*n,1e-9)*a,c=Math.max(n*a*1e-6,1e-9),h=[],d=new Map,u=new Map,p=(e,t,i)=>{const n=e.get(t)||new Set;n.add(i),e.set(t,n)};for(let e=0;e<t.length;e++){const[o,s]=t[e],[a,l]=i[e];if(![o?.[0],o?.[1],s?.[0],s?.[1],a?.[0],a?.[1],l?.[0],l?.[1]].every(Number.isFinite))continue;const _=s[0]-o[0],m=s[1]-o[1],g=_*_+m*m;if(g<1e-18)continue;if(Math.max(Math.hypot(a[0]-o[0],a[1]-o[1]),Math.hypot(l[0]-s[0],l[1]-s[1]))<=c)continue;h.push({oa:o,ob:s,na:a,nb:l,dx:_,dy:m,len2:g});const f=$o(o,s,n,r),v=$o(a,l,n,r);p(u,f,v),p(u,$o(o,s,n,1),$o(a,l,n,1)),f!==v&&p(d,f,v)}if(!h.length)return e.slice();const _=(e,t,i)=>[e[0]+(t[0]-e[0])*i,e[1]+(t[1]-e[1])*i],m=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1])<=c,g=(e,t)=>{if("fixed-topology"===o){const i=t.na[0]-t.oa[0],n=t.na[1]-t.oa[1],r=t.nb[0]-t.ob[0],o=t.nb[1]-t.ob[1];return Math.hypot(i-r,n-o)<=c?[e[0]+i,e[1]+n]:m(e,t.oa)?[...t.na]:m(e,t.ob)?[...t.nb]:[...e]}const i=Math.max(0,Math.min(1,((e[0]-t.oa[0])*t.dx+(e[1]-t.oa[1])*t.dy)/t.len2));return _(t.na,t.nb,i)},f=(e,t)=>{const[i,n]=ko(e,t);return(t[0]-e[0])*i+(t[1]-e[1])*n>=0?[[...e],[...t]]:[[...t],[...e]]},v=[],y=[],b=(e,t,i)=>{if(Math.hypot(t[0]-e[0],t[1]-e[1])<=c)return;const[r,o]=f(e,t),s=go(i);if(y.some(e=>e.entry.cm===s&&m(e.span[0],r)&&m(e.span[1],o)))return;const l=Mo(r,o,s,n,a);v.push(l),y.push({entry:l,span:[r,o]})};for(const t of e){const e=So(t,a);if(e){const[i,n]=f(e[0],e[1]),r=n[0]-i[0],s=n[1]-i[1],a=r*r+s*s,d=Math.sqrt(a);if(d<=c){v.push({...t,cm:go(t.cm)});continue}const u=[];for(const e of h){if(!Co(To(i,n),To(e.oa,e.ob)))continue;const t=e=>Math.abs((e[0]-i[0])*s-(e[1]-i[1])*r)/d;if(t(e.oa)>l||t(e.ob)>l)continue;const o=((e.oa[0]-i[0])*r+(e.oa[1]-i[1])*s)/a,h=((e.ob[0]-i[0])*r+(e.ob[1]-i[1])*s)/a,p=Math.max(0,Math.min(o,h)),_=Math.min(1,Math.max(o,h));(_-p)*d>c&&u.push({lo:p,hi:_,move:e})}if(!u.length){"fixed-topology"===o?v.push({...t}):b(i,n,t.cm);continue}const p=[0,1,...u.flatMap(({lo:e,hi:t})=>[e,t])].sort((e,t)=>e-t).filter((e,t,i)=>0===t||Math.abs(e-i[t-1])*d>c),y=[];for(let e=0;e+1<p.length;e++){const t=p[e],r=p[e+1];if((r-t)*d<=c)continue;const o=_(i,n,t),s=_(i,n,r),a=(t+r)/2,l=u.filter(e=>a>=e.lo-1e-12&&a<=e.hi+1e-12);if(!l.length){y.push([o,s]);continue}const h=[g(o,l[0].move),g(s,l[0].move)],f=l.slice(1).some(e=>{const t=g(o,e.move),i=g(s,e.move);return!m(h[0],t)||!m(h[1],i)});y.push(f?[o,s]:h)}const w=(e,t)=>{const i=e[1][0]-e[0][0],n=e[1][1]-e[0][1],r=t[1][0]-t[0][0],o=t[1][1]-t[0][1],s=Math.hypot(i,n);return!(s<=c||i*r+n*o<=0)&&Math.abs(i*o-n*r)/s<=c},k=[];for(const e of y){const t=k[k.length-1];t&&m(t[1],e[0])&&w(t,e)?t[1]=e[1]:k.push([[...e[0]],[...e[1]]])}if("fixed-topology"===o&&1===k.length){const[i,n]=k[0];if(m(i,e[0])&&m(n,e[1])||m(i,e[1])&&m(n,e[0])){v.push({...t});continue}}for(const[e,i]of k)b(e,i,t.cm);continue}if("fixed-topology"===o){const e=u.get(t.key);if(1===e?.size){const i=[...e][0];v.push(i===t.key?{...t}:{...t,key:i});continue}const i=[Ro([t],a)[0]];1!==a&&i.push(Ro([t],1)[0]);const n=i.filter(Boolean).some(e=>h.some(t=>{if(!Co(e.ang,To(t.oa,t.ob)))return!1;const i=((e.x-t.oa[0])*t.dx+(e.y-t.oa[1])*t.dy)/t.len2;return i>=-1e-6&&i<=1.000001&&bs(e.x,e.y,t.oa[0],t.oa[1],t.ob[0],t.ob[1])<=l}));((e?.size||0)>1||n)&&s?.(),v.push({...t});continue}let i="";const r=d.get(t.key);if(1===r?.size&&(i=[...r][0]),!i){const e=Ro([t],a)[0];if(e){const t=new Set;for(const i of h){if(!Co(e.ang,To(i.oa,i.ob)))continue;const r=((e.x-i.oa[0])*i.dx+(e.y-i.oa[1])*i.dy)/i.len2;if(r<-1e-6||r>1.000001)continue;if(bs(e.x,e.y,i.oa[0],i.oa[1],i.ob[0],i.ob[1])>l)continue;const o=g([e.x,e.y],i),[s,c]=ko(i.na,i.nb),h=Math.max(n*a,1e-6);t.add($o([o[0]-s*h,o[1]-c*h],[o[0]+s*h,o[1]+c*h],n,a))}1===t.size&&(i=[...t][0])}}v.push({...t,key:i||t.key,cm:go(t.cm)})}return v}function Fo(e,t,i,n,r=1,o="affine"){return Po(e,t,i,n,r,o)}function Io(e,t,i,n,r=1,o="fixed-topology"){let s=!1;const a=Po(e,t,i,n,r,o,()=>{s=!0});return{walls:s?(e||[]).map(e=>({...e})):a,rejected:s}}function Eo(e,t,i,n=1,r=[]){const o=n>0?n:1,s=Math.abs(i),a=Math.max(s*o*Wr,1e-9),l=(r||[]).flatMap(e=>{const t=So(e,o);return t?t.map(e=>[...e]):[]}),c=e=>e.every((e,t)=>(e=>{if(!(s>0))return!0;const t=e/o/s;return Math.abs(t-Math.round(t))<Wr})(e)||l.some(i=>Math.abs(e-i[t])<=a)),h=[],d=e=>JSON.stringify([e.key,e.cm,e.a,e.b]);for(const i of e||[]){const e=So(i,o);if(!e)continue;const[n,r]=e;if(![n[0],n[1],r[0],r[1]].every(Number.isFinite)||!c(n)||!c(r)){h.push(d(i));continue}const s=r[0]-n[0],l=r[1]-n[1],u=Math.hypot(s,l);if(u<=a){h.push(d(i));continue}const p=s/u,_=l/u,m=[];for(const e of t){const[t,i]=e;if(![t?.[0],t?.[1],i?.[0],i?.[1]].every(Number.isFinite))continue;const r=e=>Math.abs((e[0]-n[0])*_-(e[1]-n[1])*p);if(r(t)>a||r(i)>a)continue;const o=(t[0]-n[0])*p+(t[1]-n[1])*_,s=(i[0]-n[0])*p+(i[1]-n[1])*_,l=Math.max(0,Math.min(o,s)),c=Math.min(u,Math.max(o,s));c-l>a&&m.push([l,c])}m.sort((e,t)=>e[0]-t[0]||e[1]-t[1]);let g=0;for(const[e,t]of m){if(e>g+a)break;if(g=Math.max(g,t),g>=u-a)break}g<u-a&&h.push(d(i))}return h}function No(e,t,i,n,r,o=1){const s=$o(t,i,r,o),a=(e||[]).filter(e=>e.key!==s);return null==n||n<1?a:[...a,Mo(t,i,n,r,o)]}function Ho(e,t,i,n,r,o=[],s=1){let a=e?e.slice():[];for(const e of function(e,t,i,n,r=1,o=[]){const s=ss(e,t,i,n,r,o);if(!s)return[];const a=[];for(let e=0;e<s.poly.length;e++){const t=s.poly[e],o=s.poly[(e+1)%s.poly.length];Yo(t,o,i,n,r)||a.push({a:t,b:o})}return a}(t,i,o,r,s,a))a=No(a,e.a,e.b,n,r,s);return a}function Lo(e,t,i,n,r,o=[],s=1){if(null==n||n<1)return e?e.slice():[];const a=ss(t,i,o,r,s,e);if(!a)return e?e.slice():[];const l=as(e,a,r,s);let c=e?e.slice():[];for(let e=0;e<a.poly.length;e++){const t=a.poly[e],i=a.poly[(e+1)%a.poly.length];Yo(t,i,o,r,s)||(l[e]>0||(c=No(c,t,i,n,r,s)))}return c}function qo(e){const{a:t,b:i,halfDepth:n}=e;if(!Array.isArray(t)||!Array.isArray(i)||t.length<2||i.length<2||![t[0],t[1],i[0],i[1]].every(Number.isFinite))return null;const r=i[0]-t[0],o=i[1]-t[1],s=Math.hypot(r,o);if(!(s>1e-9&&n>0&&Number.isFinite(n)))return null;const a=-o/s*n,l=r/s*n;return[[t[0]+a,t[1]+l],[i[0]+a,i[1]+l],[i[0]-a,i[1]-l],[t[0]-a,t[1]-l]]}function jo(e,t,i){return Math.hypot(e[0]-t[0],e[1]-t[1])<=i}function Bo(e,t,i){const n=t.b[0]-t.a[0],r=t.b[1]-t.a[1],o=n*n+r*r;if(!(o>i*i))return!1;const s=((e[0]-t.a[0])*n+(e[1]-t.a[1])*r)/o;if(!(s>0&&s<1))return!1;const a=[t.a[0]+n*s,t.a[1]+r*s];return Math.hypot(e[0]-a[0],e[1]-a[1])<=i}function Wo(e,t,i,n){const r=Math.hypot(t,i);if(!(r>1e-9&&n>0))return;const o=[t/r,i/r],s=e.find(e=>Math.abs(e.u[0]*o[1]-e.u[1]*o[0])<1e-9&&e.u[0]*o[0]+e.u[1]*o[1]>1-1e-9);s?s.halfDepth=Math.max(s.halfDepth,n):e.push({u:o,halfDepth:n})}function Uo(e,t){try{const i=Ht(xs(e),xs(t));let n=null,r=0;for(const e of i||[]){const t=e?.[0]||[],i=Math.abs(Xo(t));t.length>=4&&i>r&&(r=i,n=t.slice(0,-1).map(e=>[e[0],e[1]]))}return n}catch{return null}}function Go(e,t=1e-6){const i=(e||[]).map((e,t)=>({segment:e,index:t})).filter(({segment:e})=>e&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length>=2&&e.b.length>=2&&e.a.every(Number.isFinite)&&e.b.every(Number.isFinite)&&Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>1e-9);if(i.length<2)return[];const n=Math.max(Number.isFinite(t)?t:0,1e-9),r=i.flatMap(({segment:e})=>[e.a,e.b]).map(e=>[e[0],e[1]]).sort((e,t)=>e[0]-t[0]||e[1]-t[1]),o=[];for(const e of r)o.some(t=>jo(t,e,n))||o.push(e);const s=[];for(const e of o){const t=[];let r=!1;for(const{segment:o,index:s}of i){const i=Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]);jo(e,o.a,n)?t.push({u:[(o.b[0]-o.a[0])/i,(o.b[1]-o.a[1])/i],halfDepth:o.halfDepth,length:i,index:s}):jo(e,o.b,n)?t.push({u:[(o.a[0]-o.b[0])/i,(o.a[1]-o.b[1])/i],halfDepth:o.halfDepth,length:i,index:s}):Bo(e,o,n)&&(r=!0)}if(r||2!==t.length)continue;const[o,a]=t,l=o.u[0]*a.u[1]-o.u[1]*a.u[0];if(Math.abs(l)<1e-9)continue;const c=l<0?1:-1,h=[-o.u[1],o.u[0]],d=[-a.u[1],a.u[0]],u=[e[0]+h[0]*o.halfDepth*c,e[1]+h[1]*o.halfDepth*c],p=[e[0]-d[0]*a.halfDepth*c,e[1]-d[1]*a.halfDepth*c];if(!es(u,o.u,p,a.u))continue;const _=[[o,a,p,[d[0]*-c,d[1]*-c]],[a,o,u,[h[0]*c,h[1]*c]]];for(const[t,,i,r]of _){const o=Math.min(2*t.halfDepth,t.length),a=[-t.u[1]*t.halfDepth,t.u[0]*t.halfDepth],l=[[e[0]+a[0],e[1]+a[1]],[e[0]+t.u[0]*o+a[0],e[1]+t.u[1]*o+a[1]],[e[0]+t.u[0]*o-a[0],e[1]+t.u[1]*o-a[1]],[e[0]-a[0],e[1]-a[1]]],c=e=>(e[0]-i[0])*r[0]+(e[1]-i[1])*r[1],h=[];for(let e=0;e<l.length;e++){const t=l[e],i=l[(e+1)%l.length],n=c(t),r=c(i);if(n>=-1e-12&&h.push(t),n>1e-12&&r<-1e-12||n<-1e-12&&r>1e-12){const e=n/(n-r);h.push([t[0]+(i[0]-t[0])*e,t[1]+(i[1]-t[1])*e])}}h.length>=3&&Math.abs(Xo(h))>n*n&&s.push({segmentIndex:t.index,wedge:h})}}return s}function Vo(e,t=1e-6){const i=(e||[]).filter(e=>e&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length>=2&&e.b.length>=2&&e.a.every(Number.isFinite)&&e.b.every(Number.isFinite)&&Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>1e-9);if(i.length<2)return[];const n=Math.max(Number.isFinite(t)?t:0,1e-9),r=i.flatMap(e=>[e.a,e.b]).map(e=>[e[0],e[1]]).sort((e,t)=>e[0]-t[0]||e[1]-t[1]),o=[];for(const e of r)o.some(t=>jo(t,e,n))||o.push(e);const s=[],a=i.map((e,t)=>({roomId:"",a:[e.a[0],e.a[1]],b:[e.b[0],e.b[1]],key:`join-${t}`,kind:"outer",cm:0,open:!1,half:e.halfDepth})),l=ds(a,n);for(const e of us(l).fans)s.push(e);const c=e=>!!ps(l,e);for(const e of o){if(c(e))continue;const t=[];for(const r of i)jo(e,r.a,n)?Wo(t,r.b[0]-r.a[0],r.b[1]-r.a[1],r.halfDepth):jo(e,r.b,n)?Wo(t,r.a[0]-r.b[0],r.a[1]-r.b[1],r.halfDepth):Bo(e,r,n)&&(Wo(t,r.a[0]-e[0],r.a[1]-e[1],r.halfDepth),Wo(t,r.b[0]-e[0],r.b[1]-e[1],r.halfDepth));if(!(t.length<2)){t.sort((e,t)=>Math.atan2(e.u[1],e.u[0])-Math.atan2(t.u[1],t.u[0])||e.halfDepth-t.halfDepth);for(let i=0;i<t.length;i++)for(let r=i+1;r<t.length;r++){const o=t[i],a=t[r],l=o.u[0]*a.u[1]-o.u[1]*a.u[0];if(Math.abs(l)<1e-9)continue;const c=[-o.u[1],o.u[0]],h=[-a.u[1],a.u[0]],d=l<0?1:-1,u=[e[0]+c[0]*o.halfDepth*d,e[1]+c[1]*o.halfDepth*d],p=[e[0]-h[0]*a.halfDepth*d,e[1]-h[1]*a.halfDepth*d],_=es(u,o.u,p,a.u),m=_?[e.slice(),u,_,p]:[e.slice(),u,p];Math.abs(Xo(m))>n*n&&s.push(m)}}}return s}function Ko(e,t,i,n){if(!(t>0)||!e||e.length<2)return"";if(i&&e.length>=3){let i=e;const r=e[e.length-1];if(e.length>=4&&Math.hypot(e[0][0]-r[0],e[0][1]-r[1])<1e-9&&(i=e.slice(0,-1)),i.length>=3){const e=i.map((e,i)=>n?.[i]||t),r=js(i,e),o=ns(i,e);if(r&&o)return`${rs(r)} ${rs(os(o))}`}}const r=[];for(let i=0;i<e.length-1;i++){const o=e[i],s=e[i+1],a=n?.[i]||t;Math.hypot(s[0]-o[0],s[1]-o[1])>=1e-9&&a>0&&r.push({a:o,b:s,halfDepth:a})}const o=r.map(qo);for(const{segmentIndex:e,wedge:t}of Go(r)){const i=o[e];if(!i)continue;const n=Uo(i,t);n&&(o[e]=n)}const s=[...o.filter(e=>!!e),...Vo(r)],a=function(e){let t=null;try{for(const i of e){if(i.length<3)continue;const e=xs(i);t=t?Et(t,e):[e]}return t}catch{return null}}(s);return a?Fs(a):s.map(e=>rs(e)).join(" ")}function Yo(e,t,i,n,r=1){if(!i.length)return!1;const o=Zo(n,r),s=(e[0]+t[0])/2,a=(e[1]+t[1])/2,[l,c]=ko(e,t);for(const e of i){const[t,i]=ko([e[0],e[1]],[e[2],e[3]]);if(!(Math.abs(l*i-c*t)>.05)&&bs(s,a,e[0],e[1],e[2],e[3])<=o)return!0}return!1}function Zo(e,t){return Math.max(e*(t>0?t:1)*.04,1e-9)}function Xo(e){let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return t/2}function Jo(e,t){const i=e[t],n=e[(t+1)%e.length],r=n[0]-i[0],o=n[1]-i[1],s=Math.hypot(r,o)||1;let a=-o/s,l=r/s;const c=[(i[0]+n[0])/2,(i[1]+n[1])/2];return function(e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){const o=t[n][0],s=t[n][1],a=t[r][0],l=t[r][1];s>e[1]!=l>e[1]&&e[0]<(a-o)*(e[1]-s)/(l-s+0)+o&&(i=!i)}return i}([c[0]+.001*a,c[1]+.001*l],e)||(a=-a,l=-l),[a,l]}function Qo(e,t){const i=e[0]*t[1]-e[1]*t[0],n=e[0]*t[0]+e[1]*t[1];return Math.abs(i)<1e-9&&n>0}function es(e,t,i,n){const r=t[0]*n[1]-t[1]*n[0];if(Math.abs(r)<1e-12)return null;const o=[i[0]-e[0],i[1]-e[1]],s=(o[0]*n[1]-o[1]*n[0])/r;return[e[0]+s*t[0],e[1]+s*t[1]]}function ts(e,t,i){const n=e?.length||0;if(n<3||!Array.isArray(i)||i.length!==n)return 0;const r=(Math.trunc(t)%n+n)%n,o=e[r],s=e[(r+1)%n],a=s[0]-o[0],l=s[1]-o[1],c=Math.hypot(a,l);if(!(c>0))return 0;const h=Math.max(0,Number(i[r])||0);if(!(h>0))return c;const d=[a/c,l/c],u=Jo(e,r),p=[o[0]+u[0]*h,o[1]+u[1]*h],_=t=>{const r=Math.max(0,Number(i[t])||0);if(!(r>0))return null;const s=e[t],a=e[(t+1)%n],l=a[0]-s[0],c=a[1]-s[1],h=Math.hypot(l,c);if(!(h>0))return null;const u=Jo(e,t),_=es(p,d,[s[0]+u[0]*r,s[1]+u[1]*r],[l/h,c/h]);return _?(_[0]-o[0])*d[0]+(_[1]-o[1])*d[1]:null},m=_((r-1+n)%n)??0,g=(_((r+1)%n)??c)-m;return g>0?g:0}function is(e,t,i,n,r,o,s,a=1){const l=(e||[]).find(e=>e?.id===t),c=Zt(l);if(!c||c.length<3)return null;const h=ms(e,t,i,n,r,o,s,a);if(!h)return c.map(()=>0);const d=4*Zo(r,a);return c.map((e,t)=>{const i=c[(t+1)%c.length],n=[(e[0]+i[0])/2,(e[1]+i[1])/2];for(let e=0;e<h.poly.length;e++){const t=h.poly[e],i=h.poly[(e+1)%h.poly.length];if(bs(n[0],n[1],t[0],t[1],i[0],i[1])<=d)return Math.max(0,h.offsets[e]||0)}return 0})}function ns(e,t,i){const n=e?.length||0;if(n<3||t.length!==n)return null;if(t.every(e=>!(e>0)))return e.map(e=>[e[0],e[1]]);const r=[];for(let o=0;o<n;o++){const s=(o-1+n)%n,a=e[s],l=e[o],c=e[o],h=e[(o+1)%n],d=Math.max(0,t[s]),u=Math.max(0,t[o]),[p,_]=Jo(e,s),[m,g]=Jo(e,o),f=[l[0]-a[0],l[1]-a[1]],v=[h[0]-c[0],h[1]-c[1]],y=Math.hypot(f[0],f[1])||1,b=Math.hypot(v[0],v[1])||1,w=[f[0]/y,f[1]/y],k=[v[0]/b,v[1]/b],x=[a[0]+p*d,a[1]+_*d],$=[c[0]+m*u,c[1]+g*u];if(!(d>0||u>0)){r.push([e[o][0],e[o][1]]);continue}if(d>0!=u>0){const t=e[o],i=d>0?[t[0]+p*d,t[1]+_*d]:[t[0],t[1]],n=u>0?[t[0]+m*u,t[1]+g*u]:[t[0],t[1]];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}if(Qo(w,k)){const t=e[o],i=[t[0]+p*d,t[1]+_*d],n=[t[0]+m*u,t[1]+g*u];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}const S=es(x,w,$,k),M=Math.max(d,u,1e-9),R=ps(i,e[o])?.limit??4*M;if(S){const i=Math.hypot(S[0]-e[o][0],S[1]-e[o][1]);if(Number.isFinite(i)&&i<=R){r.push(S);continue}if(Es(e,t,o)){r.push(S);continue}}d>0&&r.push([e[o][0]+p*d,e[o][1]+_*d]),u>0&&r.push([e[o][0]+m*u,e[o][1]+g*u]),d>0||u>0||r.push([e[o][0],e[o][1]])}return r.length>=3?r:null}function rs(e,t=!0){if(!e.length)return"";let i=`M ${e[0][0]} ${e[0][1]}`;for(let t=1;t<e.length;t++)i+=` L ${e[t][0]} ${e[t][1]}`;return t&&(i+=" Z"),i}function os(e){return e.slice().reverse()}function ss(e,t,i,n,r=1,o=[]){const s=(e||[]).find(e=>e?.id===t),a=Zt(s);if(!a||a.length<3)return null;const l=Zo(n,r),c=[];for(const i of e||[]){if(!i||i.id===t)continue;const e=Zt(i);if(e)for(const t of bn(a,e,l))c.push([t[0],t[1]],[t[2],t[3]])}for(const e of i||[])c.push([e[0],e[1]],[e[2],e[3]]);for(const e of o||[]){const t=So(e,r);t&&c.push(t[0],t[1])}const h=[],d=[];for(let e=0;e<a.length;e++){const t=a[e],i=a[(e+1)%a.length];h.push([t[0],t[1]]),d.push(e);const n=Math.hypot(i[0]-t[0],i[1]-t[1]);if(n<2*l||!c.length)continue;const r=Math.min(.499,2*l/n),o=[];for(const e of c){if(bs(e[0],e[1],t[0],t[1],i[0],i[1])>l)continue;const s=((e[0]-t[0])*(i[0]-t[0])+(e[1]-t[1])*(i[1]-t[1]))/(n*n);s<=r||s>=1-r||(o.some(e=>Math.abs(e-s)*n<=2*l)||o.push(s))}o.sort((e,t)=>e-t);for(const n of o)h.push([t[0]+(i[0]-t[0])*n,t[1]+(i[1]-t[1])*n]),d.push(e)}return{poly:h,parent:d,orig:a}}function as(e,t,i,n){const r=t.poly.length,o=new Array(r).fill(0);if(!e?.length)return o;const s=new Set,a=[];for(let l=0;l<r;l++){const c=Do(e,t.poly[l],t.poly[(l+1)%r],i,n);c&&c.cm>0?(o[l]=go(c.cm),s.add(c.key)):a.push(l)}if(!a.length)return o;const l=n>0?n:1,c=Math.max(.5*i,1e-9)*l,h=Ro(e,l).filter(e=>e.w.cm>0);for(let e=a.length-1;e>=0;e--){const i=a[e],n=t.poly[i],s=t.poly[(i+1)%r],d=To(n,s);let u=null;for(const e of h){const t=So(e.w,l);if(!t||!Co(To(t[0],t[1]),d))continue;if(bs(n[0],n[1],t[0][0],t[0][1],t[1][0],t[1][1])>c||bs(s[0],s[1],t[0][0],t[0][1],t[1][0],t[1][1])>c)continue;const i=Math.hypot(s[0]-n[0],s[1]-n[1]),r=Math.hypot(t[1][0]-t[0][0],t[1][1]-t[0][1]),o=Math.max(0,r-i);(!u||o<u.extra)&&(u={cm:go(e.w.cm),extra:o})}u&&(o[i]=u.cm,a.splice(e,1))}const d=new Map;for(const e of a){const i=t.parent[e],n=d.get(i);n?n.push(e):d.set(i,[e])}for(const[e,i]of d){const n=t.orig[e],r=t.orig[(e+1)%t.orig.length],a=To(n,r),d=(n[0]+r[0])/2,u=(n[1]+r[1])/2;let p=null;const _=Math.hypot(r[0]-n[0],r[1]-n[1]);for(const e of h){if(s.has(e.w.key))continue;if(!Co(e.ang,a))continue;const t=So(e.w,l);let i=!1,o=0;if(t){if(!Co(To(t[0],t[1]),a))continue;if(bs(n[0],n[1],t[0][0],t[0][1],t[1][0],t[1][1])>c||bs(r[0],r[1],t[0][0],t[0][1],t[1][0],t[1][1])>c)continue;i=!0,o=Math.max(0,Math.hypot(t[1][0]-t[0][0],t[1][1]-t[0][1])-_)}else{if(bs(e.x,e.y,n[0],n[1],r[0],r[1])>c)continue;o=Math.hypot(e.x-d,e.y-u)}(!p||i&&!p.exact||i===p.exact&&o<p.d)&&(p={cm:go(e.w.cm),d:o,exact:i})}if(p)for(const e of i)o[e]=p.cm}return o}function ls(e,t){return[Math.floor(e[0]/t),Math.floor(e[1]/t)]}function cs(e,t){return`${e},${t}`}function hs(e,t,i){const[n,r]=ls(t,i),o=[];for(let t=-1;t<=1;t++)for(let i=-1;i<=1;i++){const s=e.get(cs(n+t,r+i));s&&o.push(...s)}return o}function ds(e,t=1e-6,i=1){const n=Math.max(Number.isFinite(t)?t:0,1e-9),r=Number.isFinite(i)&&i>0?i:1,o=(e||[]).filter(e=>e&&!e.open&&null!==e.kind&&Number.isFinite(e.half)&&e.half>0&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length>=2&&e.b.length>=2&&[e.a[0],e.a[1],e.b[0],e.b[1]].every(Number.isFinite)&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>n).sort((e,t)=>e.key.localeCompare(t.key)||e.a[0]-t.a[0]||e.a[1]-t.a[1]||e.b[0]-t.b[0]||e.b[1]-t.b[1]||e.half-t.half),s=new Map;for(const e of o){const t=s.get(e.key);t?e.half>t.half&&s.set(e.key,{...t,half:e.half}):s.set(e.key,e)}const a=[...s.values()].flatMap(e=>[{point:[e.a[0],e.a[1]],other:e.b,halfDepth:e.half,kind:e.kind,key:e.key},{point:[e.b[0],e.b[1]],other:e.a,halfDepth:e.half,kind:e.kind,key:e.key}]).sort((e,t)=>e.point[0]-t.point[0]||e.point[1]-t.point[1]||e.other[0]-t.other[0]||e.other[1]-t.other[1]||e.halfDepth-t.halfDepth),l=new Map;for(const e of a){const[t,i]=ls(e.point,n),r=cs(t,i),o=l.get(r)||[];o.push(e),l.set(r,o)}const c=[],h=new Map;for(const e of a){const t=hs(h,e.point,n).filter(t=>Math.hypot(t.point[0]-e.point[0],t.point[1]-e.point[1])<=n).sort((t,i)=>Math.hypot(t.point[0]-e.point[0],t.point[1]-e.point[1])-Math.hypot(i.point[0]-e.point[0],i.point[1]-e.point[1])||t.point[0]-i.point[0]||t.point[1]-i.point[1]);let i=t[0];if(!i){i={point:[...e.point],rays:[]},c.push(i);const[t,r]=ls(i.point,n),o=cs(t,r),s=h.get(o)||[];s.push(i),h.set(o,s)}const r=e.other[0]-e.point[0],o=e.other[1]-e.point[1],s=Math.hypot(r,o);if(!(s>n))continue;const a=[r/s,o/s];let l=Math.atan2(a[1],a[0]);l<0&&(l+=2*Math.PI),i.rays.push({u:a,halfDepth:e.halfDepth,length:s,angle:l})}const d=[],u=e=>{const t=1e-9*Math.max(1,r),i=e.filter(e=>Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Number.isFinite(e.length)&&e.length>n);return i.filter((e,n)=>!i.some((i,r)=>r!==n&&i.halfDepth>=e.halfDepth-t&&i.length>=e.length-t&&(i.halfDepth>e.halfDepth+t||i.length>e.length+t||r<n))).sort((e,t)=>e.length-t.length||e.halfDepth-t.halfDepth).map(e=>({...e}))};for(const e of c){const t=e.rays.sort((e,t)=>e.angle-t.angle||e.length-t.length||e.halfDepth-t.halfDepth),i=[];for(const e of t){const t=i[i.length-1];t&&Math.abs(e.angle-t.angle)<=1e-9?t.supports.push({halfDepth:e.halfDepth,length:e.length}):i.push({u:[...e.u],angle:e.angle,supports:[{halfDepth:e.halfDepth,length:e.length}]})}if(i.length>1&&2*Math.PI-i[i.length-1].angle+i[0].angle<=1e-9){const e=i.pop();i[0].supports.push(...e.supports)}if(i.length<3)continue;const r=i.map(t=>{const i=u(t.supports),r=new Set,o=[];for(const s of i){const i=[e.point[0]+t.u[0]*s.length,e.point[1]+t.u[1]*s.length];for(const t of hs(l,i,n)){if("shared"!==t.kind||Math.hypot(t.point[0]-i[0],t.point[1]-i[1])>n)continue;const s=t.other[0]-t.point[0],a=t.other[1]-t.point[1],l=Math.hypot(s,a);if(!(l>n))continue;const c=s/l,h=a/l;if(Math.hypot(t.other[0]-e.point[0],t.other[1]-e.point[1])<=n)continue;const d=`${t.key}|${t.point[0]}|${t.point[1]}|${t.other[0]}|${t.other[1]}|${t.halfDepth}`;r.has(d)||(r.add(d),o.push({start:[t.point[0],t.point[1]],u:[c,h],length:l,halfDepth:t.halfDepth}))}}return o.sort((e,t)=>e.start[0]-t.start[0]||e.start[1]-t.start[1]||e.u[0]-t.u[0]||e.u[1]-t.u[1]||e.length-t.length||e.halfDepth-t.halfDepth),{u:[...t.u],halfDepth:Math.max(...i.map(e=>e.halfDepth)),length:Math.max(...i.map(e=>e.length)),supports:i,continuations:o}}).filter(e=>Number.isFinite(e.halfDepth)&&e.halfDepth>0&&Number.isFinite(e.length)&&e.length>n);if(r.length<3)continue;const o=Math.max(...r.map(e=>e.halfDepth));o>0&&Number.isFinite(o)&&d.push({point:[...e.point],rays:r,halfDepth:o,limit:1.25*o})}d.sort((e,t)=>e.point[0]-t.point[0]||e.point[1]-t.point[1]);const p=new Map;for(const e of d){const[t,i]=ls(e.point,n),r=cs(t,i),o=p.get(r)||[];o.push(e),p.set(r,o)}return{epsilon:n,coordinateScale:r,nodes:d,index:p}}function us(e){const t={fans:[],supports:[]};if(!e?.nodes?.length)return t;const i=Math.max(e.epsilon,1e-9)**2;for(const n of e.nodes){const e=n.rays.filter(e=>Number.isFinite(e.halfDepth)&&e.halfDepth>0).map(e=>({...e,thickLength:Math.max(...e.supports.filter(t=>t.halfDepth>=e.halfDepth-1e-12).map(e=>e.length),0),angle:(()=>{const t=Math.atan2(e.u[1],e.u[0]);return t<0?t+2*Math.PI:t})()})).sort((e,t)=>e.angle-t.angle);if(e.length<2)continue;const r=n.point;for(const i of e)for(const e of i.supports){if(!(e.halfDepth>0&&e.length>0))continue;const n=-i.u[1]*e.halfDepth,o=i.u[0]*e.halfDepth,s=[r[0]+i.u[0]*e.length,r[1]+i.u[1]*e.length];t.supports.push([[r[0]+n,r[1]+o],[s[0]+n,s[1]+o],[s[0]-n,s[1]-o],[r[0]-n,r[1]-o]])}for(let n=0;n<e.length;n++){const o=e[n],s=e[(n+1)%e.length],a=(()=>{const e=s.angle-o.angle;return e>0?e:e+2*Math.PI})();if(a<1e-9)continue;const l=a>Math.PI+1e-9,c=4*Math.max(o.halfDepth,s.halfDepth),h=[r[0]-o.u[1]*o.halfDepth,r[1]+o.u[0]*o.halfDepth],d=[r[0]+s.u[1]*s.halfDepth,r[1]-s.u[0]*s.halfDepth],u=o.u[0]*s.u[1]-o.u[1]*s.u[0],p=e=>{let t=Math.atan2(e[1]-r[1],e[0]-r[0])-o.angle;for(;t<0;)t+=2*Math.PI;return t<=a+1e-9};let _=null;if(Math.abs(u)>1e-9){const e=((d[0]-h[0])*s.u[1]-(d[1]-h[1])*s.u[0])/u,t=((d[0]-h[0])*o.u[1]-(d[1]-h[1])*o.u[0])/u,i=[h[0]+o.u[0]*e,h[1]+o.u[1]*e];(l?e<=1e-9&&t<=1e-9:e>1e-9&&e<=o.thickLength&&t<=s.thickLength)&&Math.hypot(i[0]-r[0],i[1]-r[1])<=c&&p(i)&&(_=i)}const m=e=>{Math.abs(Xo(e))>i&&t.fans.push(e)};if(_){const e=1.5*Math.max(o.halfDepth,s.halfDepth);m(ho([r[0],r[1]],h,_,d,e)??[[r[0],r[1]],h,_,d]);continue}if(l){m([[r[0],r[1]],h,d]);continue}const g=(e,t)=>Math.min(t,Math.sqrt(Math.max(c**2-e**2,0)),2*Math.max(o.halfDepth,s.halfDepth)),f=[h[0]+o.u[0]*g(o.halfDepth,o.thickLength),h[1]+o.u[1]*g(o.halfDepth,o.thickLength)],v=[d[0]+s.u[0]*g(s.halfDepth,s.thickLength),d[1]+s.u[1]*g(s.halfDepth,s.thickLength)];m([[r[0],r[1]],h,f,v,d])}}return t}function ps(e,t){return!e||!Array.isArray(t)||t.length<2||!t.slice(0,2).every(Number.isFinite)?null:hs(e.index,t,e.epsilon).filter(i=>Math.hypot(i.point[0]-t[0],i.point[1]-t[1])<=e.epsilon).sort((e,i)=>Math.hypot(e.point[0]-t[0],e.point[1]-t[1])-Math.hypot(i.point[0]-t[0],i.point[1]-t[1])||e.point[0]-i.point[0]||e.point[1]-i.point[1])[0]||null}function _s(e,t,i,n,r,o,s){return ds(gs(e,t,i,n,r,o,s),4*Zo(n,s),s)}function ms(e,t,i,n,r,o,s,a=1){const l=ss(e,t,n,r,a,i);if(!l)return null;const c=function(e,t,i){const n=(e||[]).find(e=>e?.id===t),r=Zt(n);if(!r)return[];const o=[];for(const n of e||[]){if(!n||n.id===t)continue;const e=Zt(n);if(e)for(const t of bn(r,e,i))o.push(t)}return o}(e,t,Zo(r,a)),h=function(e,t,i,n,r){const o=Zo(n,r),s=[];for(let a=0;a<e.length;a++){const l=e[a],c=e[(a+1)%e.length];if(Yo(l,c,i,n,r)){s.push(null);continue}const h=(l[0]+c[0])/2,d=(l[1]+c[1])/2,u=t.some(e=>bs(h,d,e[0],e[1],e[2],e[3])<=o);s.push(u?"shared":"outer")}return s}(l.poly,c,n,r,a),d=as(i,l,r,a),u=d.map((e,t)=>h[t]&&e>0?vo(e,o,s)/2:0);return{...l,kinds:h,cms:d,offsets:u}}function gs(e,t,i,n,r,o,s=1){const a=[];for(const l of e||[]){if(!l?.id)continue;const c=ms(e,l.id,t,i,n,r,o,s);if(c)for(let e=0;e<c.poly.length;e++){const t=c.poly[e],i=c.poly[(e+1)%c.poly.length];a.push({roomId:l.id,a:[t[0],t[1]],b:[i[0],i[1]],key:$o(t,i,n,s),kind:c.kinds[e],cm:c.kinds[e]?c.cms[e]:0,open:null===c.kinds[e],half:c.offsets[e]})}}return a}function fs(e,t,i,n,r,o,s=1){let a=[];const l=gs(e,t,i,n,r,o,s);for(const e of l)!e.open&&e.cm>0&&(a=No(a,e.a,e.b,e.cm,n,s));return a}function vs(e,t,i,n,r,o,s=1){if(!t?.length)return[];const a=gs(e,t,i,n,r,o,s),l=new Map;for(const e of a){if(e.open||!e.kind||!e.roomId)continue;const t=l.get(e.key)||new Set;t.add(e.roomId),l.set(e.key,t)}const c=e=>{const t=[...l.get(e)||[]].sort();return 1!==t.length&&2!==t.length?`ambiguous:${e}`:`${1===t.length?"outer":"shared"}:${t.join("|")}`},h=[],d=new Set;for(const e of a)!e.open&&e.cm>0&&!d.has(e.key)&&(d.add(e.key),h.push({...e,ownerSignature:c(e.key)}));const u=[];for(const a of e||[]){if(!a?.id)continue;const l=ms(e,a.id,t,i,n,r,o,s);if(l)for(let e=0;e<l.orig.length;e++){const t=[];for(let i=0;i<l.parent.length;i++)l.parent[i]===e&&t.push(i);if(t.length)for(let e=0;e<t.length;){const i=t[e],r=l.cms[i];if(!(r>0)||null===l.kinds[i]){e++;continue}const o=c($o(l.poly[i],l.poly[(i+1)%l.poly.length],n,s));let a=e;for(;a+1<t.length;){const e=t[a+1],i=$o(l.poly[e],l.poly[(e+1)%l.poly.length],n,s);if(null===l.kinds[e]||l.cms[e]!==r||c(i)!==o)break;a++}const h=t[a],d=l.poly[i],p=l.poly[(h+1)%l.poly.length],_=Math.hypot(p[0]-d[0],p[1]-d[1]);_>0&&u.push({a:[d[0],d[1]],b:[p[0],p[1]],key:$o(d,p,n,s),cm:r,len:_,ownerSignature:o}),e=a+1}}}u.sort((e,t)=>t.len-e.len||e.key.localeCompare(t.key));const p=[],_=new Set,m=new Set,g=4*Zo(n,s);for(const e of u){const t=h.filter(t=>!m.has(t.key)&&t.cm===e.cm&&t.ownerSignature===e.ownerSignature&&Co(To(t.a,t.b),To(e.a,e.b))&&bs(t.a[0],t.a[1],e.a[0],e.a[1],e.b[0],e.b[1])<=g&&bs(t.b[0],t.b[1],e.a[0],e.a[1],e.b[0],e.b[1])<=g);if(t.length){for(const e of t)m.add(e.key);_.has(e.key)||(_.add(e.key),p.push(Mo(e.a,e.b,e.cm,n,s)))}}for(const e of h)m.has(e.key)||_.has(e.key)||(_.add(e.key),p.push(Mo(e.a,e.b,e.cm,n,s)));return p}function ys(e,t,i,n,r,o,s,a=1){const l=Zo(r,a),c=(n[0]+n[2])/2,h=(n[1]+n[3])/2,d=To([n[0],n[1]],[n[2],n[3]]);let u=null;for(const n of gs(e,t,i,r,o,s,a)){if(!Co(To(n.a,n.b),d))continue;const e=bs(c,h,n.a[0],n.a[1],n.b[0],n.b[1]);e>4*l||(!u||e<u.d)&&(u={cm:n.cm,d:e})}return u?.cm||0}function bs(e,t,i,n,r,o){const s=r-i,a=o-n,l=s*s+a*a;if(l<1e-18)return Math.hypot(e-i,t-n);let c=((e-i)*s+(t-n)*a)/l;return c=Math.max(0,Math.min(1,c)),Math.hypot(e-(i+s*c),t-(n+a*c))}function ws(e){let t=null,i=0;for(const n of e||[]){const e=n?.[0];if(!Array.isArray(e)||e.length<4)continue;const r=e.slice(0,-1).map(e=>[e[0],e[1]]),o=Math.abs(Xo(r));r.length>=3&&o>i&&(t=r,i=o)}return t}function ks(e,t,i,n,r,o,s,a=1,l,c){const h=(e||[]).find(e=>e?.id===t),d=Zt(h);if(!d||d.length<3)return null;if(!i?.length)return d.map(e=>[e[0],e[1]]);const u=ms(e,t,i,n,r,o,s,a);if(!u||!u.offsets.some(e=>e>0))return d.map(e=>[e[0],e[1]]);const p=c||_s(e,i,n,r,o,s,a),_=ns(u.poly,u.offsets,p);if(!_)return d.map(e=>[e[0],e[1]]);if(!p.nodes.length)return _;const m=void 0===l?Ns(e,i,n,[],r,o,s,a):null,g=l??("ok"===m?.status||"degraded-extra"===m?.status?m.roomGeom:void 0);if(g)try{const e=ws(Ht(xs(u.poly),g));if(e)return e}catch{}return function(e,t){try{return ws(Nt(xs(e),xs(t)))}catch{return null}}(_,u.poly)||d.map(e=>[e[0],e[1]])}function xs(e){const t=e.map(e=>[e[0],e[1]]);return t.push([e[0][0],e[0][1]]),[t]}function $s(e){return!(!Array.isArray(e)||!e.length)&&e.every(e=>Array.isArray(e)&&e.length&&e.every(e=>Array.isArray(e)&&e.length>=4&&e.every(e=>Array.isArray(e)&&e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1])))&&Math.abs(yi(e[0]))>1e-9)}function Ss(e,t,i,n){const r=n?new Set(n):null;let o=null;for(let n=0;n<e.rays.length;n++){if(r&&!r.has(n))continue;const s=e.rays[n],a=[-s.u[1],s.u[0]];for(const n of s.supports){const r=Math.min(i,n.length);if(!(r>t.epsilon))continue;const l=Ds([[e.point[0]+a[0]*n.halfDepth,e.point[1]+a[1]*n.halfDepth],[e.point[0]+s.u[0]*r+a[0]*n.halfDepth,e.point[1]+s.u[1]*r+a[1]*n.halfDepth],[e.point[0]+s.u[0]*r-a[0]*n.halfDepth,e.point[1]+s.u[1]*r-a[1]*n.halfDepth],[e.point[0]-a[0]*n.halfDepth,e.point[1]-a[1]*n.halfDepth]],t.coordinateScale);if(!l)continue;const c=xs(l);o=o?Et(o,c):c}}return o}function Ms(e,t,i){let n=null;for(const r of e.rays)for(const e of r.continuations){const r=[-e.u[1],e.u[0]],o=[e.start[0]+e.u[0]*e.length,e.start[1]+e.u[1]*e.length],s=Ds([[e.start[0]+r[0]*e.halfDepth,e.start[1]+r[1]*e.halfDepth],[o[0]+r[0]*e.halfDepth,o[1]+r[1]*e.halfDepth],[o[0]-r[0]*e.halfDepth,o[1]-r[1]*e.halfDepth],[e.start[0]-r[0]*e.halfDepth,e.start[1]-r[1]*e.halfDepth]],t.coordinateScale);if(!s)continue;const a=Nt(xs(s),i);Array.isArray(a)&&0!==a.length&&(n=n?Et(n,a):a)}return n}function Rs(e,t,i=2*(4*e.halfDepth+2*t.epsilon)){const n=function(e,t=uo){const i=new Set,n=Number.isFinite(t)&&t>=0?t:uo;for(let t=0;t<e.rays.length;t++)for(let r=t+1;r<e.rays.length;r++){const o=e.rays[t].u,s=e.rays[r].u;Math.abs(o[0]*s[0]+o[1]*s[1])<=n&&(i.add(t),i.add(r))}return[...i].sort((e,t)=>e-t)}(e);return n.length?Ss(e,t,i,n):null}function Ts(e,t,i,n,r){const o=function(e){let t=null;for(const i of e){const e=xs(i);try{t=t?Et(t,e):e}catch{}}return t}(function(e,t,i=!1){if(!e)return[];const n=[];for(const r of e.nodes)for(let o=0;o<r.rays.length;o++){const s=r.rays[o],a=r.rays[(o+1)%r.rays.length],l=Math.atan2(s.u[1],s.u[0]);let c=Math.atan2(a.u[1],a.u[0]);for(;c<=l;)c+=2*Math.PI;const h=c-l;if(!(h>1e-9)||h>=Math.PI-1e-9)continue;const d=[-s.u[1],s.u[0]],u=[-a.u[1],a.u[0]],p=[r.point[0]+d[0]*s.halfDepth,r.point[1]+d[1]*s.halfDepth],_=[r.point[0]-u[0]*a.halfDepth,r.point[1]-u[1]*a.halfDepth],m=es(p,s.u,_,a.u);if(!m)continue;const g=Math.hypot(m[0]-r.point[0],m[1]-r.point[1]);if(!Number.isFinite(g)||g<=r.limit)continue;const f=t?Math.sqrt(Math.max(0,r.limit*r.limit-s.halfDepth*s.halfDepth)):0,v=t?Math.sqrt(Math.max(0,r.limit*r.limit-a.halfDepth*a.halfDepth)):0,y=Ds([[p[0]+s.u[0]*f,p[1]+s.u[1]*f],[_[0]+a.u[0]*v,_[1]+a.u[1]*v],m],e.coordinateScale);if(y&&n.push(y),i){const t=m[0]-r.point[0],i=m[1]-r.point[1],o=Math.hypot(t,i),s=g-r.limit;if(o>e.epsilon&&s>e.epsilon){const a=Math.min(Math.max(8*e.epsilon,.05*r.halfDepth),.25*s),l=t/o,c=i/o,h=-c,d=l,u=Ds([[m[0]-l*a+h*a,m[1]-c*a+d*a],[m[0]-l*a-h*a,m[1]-c*a-d*a],[m[0]+l*a,m[1]+c*a]],e.coordinateScale);u&&n.push(u)}}}return n}({...t,nodes:[e]},i,n));return o&&r?Ht(o,r):o}function Cs(e,t,i,n){if(!e||!t.nodes.length)return e;let r=null;try{r=function(e){let t=null;for(const i of e.nodes){const n=Rs(i,e);n&&(t=t?Et(t,n):n)}return t}(t)}catch{return e}let o=e;for(const e of t.nodes){const s=4*e.halfDepth+2*t.epsilon,a=2*s,l=[[e.point[0]-s,e.point[1]-s],[e.point[0]+s,e.point[1]-s],[e.point[0]+s,e.point[1]+s],[e.point[0]-s,e.point[1]+s]];try{let s=o;const c=Ts(e,t,!1,!0,r);c&&(s=Ht(s,c));let h=Ss(e,t,a);const d=Ts(e,t,!0,!0,r);d&&(h=Ht(h,d)),r&&(h=Et(h,r));const u=.02*Math.min(...e.rays.map(e=>e.halfDepth));if(h=Et(h,xs([[e.point[0]-u,e.point[1]-u],[e.point[0]+u,e.point[1]-u],[e.point[0]+u,e.point[1]+u],[e.point[0]-u,e.point[1]+u]])),!h)continue;let p=Nt(h,xs(l));n?p=Nt(p,n):i&&(p=Nt(p,i));const _=xs(l),m=Ht(s,_),g=i?Ht(Nt(s,_),i):null,f=Ms(e,t,_);o=Et(m,...g?[g]:[],...f?[f]:[],p)}catch{}}if(r)try{let e=r;n?e=Nt(e,n):i&&(e=Nt(e,i)),o=Et(o,e)}catch{}return o}function Ds(e,t=1){if(!Array.isArray(e)||e.length<3)return null;const i=Number.isFinite(t)&&t>0?t:1,n=1e-12*Math.max(1,i),r=[];for(const t of e){if(!Array.isArray(t)||t.length<2)return null;const e=Number(t[0]),i=Number(t[1]);if(!Number.isFinite(e)||!Number.isFinite(i))return null;const o=Math.round(e/n)*n,s=Math.round(i/n)*n;if(!Number.isFinite(o)||!Number.isFinite(s))return null;r.push([Object.is(o,-0)?0:o,Object.is(s,-0)?0:s])}return Math.abs(Xo(r))>n*n?r:null}function As(e,t,i,n){if(bs(e[0],e[1],t[0],t[1],i[0],i[1])>n)return!1;const r=i[0]-t[0],o=i[1]-t[1],s=(e[0]-t[0])*r+(e[1]-t[1])*o,a=r*r+o*o,l=n*Math.sqrt(a);return s>=-l&&s<=a+l}function Os(e,t,i){const n=[],r=[];for(let o=0;o<e.length;o++){const s=e[o],a=e[(o+1)%e.length],l=a[0]-s[0],c=a[1]-s[1],h=l*l+c*c;if(!(h>i*i))continue;const d=i/Math.sqrt(h),u=[0,1];for(const e of t)for(const t of[e.a,e.b]){if(!As(t,s,a,i))continue;const e=((t[0]-s[0])*l+(t[1]-s[1])*c)/h;e>d&&e<1-d&&u.push(e)}u.sort((e,t)=>e-t);const p=u.filter((e,t)=>0===t||Math.abs(e-u[t-1])>d);for(let e=0;e<p.length-1;e++){const o=p[e],a=p[e+1],h=[s[0]+l*o,s[1]+c*o],d=[s[0]+l*(o+a)/2,s[1]+c*(o+a)/2];let u=0;for(const e of t)As(d,e.a,e.b,i)&&(u=Math.max(u,e.half));n.push(h),r.push(u)}}return n.length>=3&&r.length===n.length?{poly:n,offsets:r}:null}function zs(e,t,i,n,r,o,s,a){const l=(e||[]).map(Zt).filter(e=>!!e&&e.length>=3);if(!l.length)return null;let c=Et(xs(l[0]));for(let e=1;e<l.length;e++)c=Et(c,xs(l[e]));const h=gs(e,t,i,n,r,o,s),d=h.filter(e=>"outer"===e.kind&&e.half>0),u=4*Zo(n,s),p=a||ds(h,u,s);let _=null;for(const e of function(e){const t=[];for(const i of Array.isArray(e)?e:[])if(Array.isArray(i))for(const e of i){if(!Array.isArray(e)||e.length<4)continue;const i=e.slice(0,-1).map(e=>[e[0],e[1]]);i.length>=3&&t.push(i)}return t}(c)){const t=Os(e,d,u);if(!t||!t.offsets.some(e=>e>0))continue;const i=js(t.poly,t.offsets,p),n=ns(t.poly,t.offsets,p);if(!i||!n)continue;const r=Ht(xs(i),xs(n));_=_?Et(_,r):r}return{centre:c,shell:_||[]}}function Ps(e,t,i,n,r,o,s=1){try{const a=zs(e,t,i,n,r,o,s,_s(e,t,i,n,r,o,s));if(!a)return[];return a.shell?.length?Et(a.centre,a.shell):a.centre}catch{return null}}function Fs(e){if(!e)return"";let t="";for(const i of e)if(Array.isArray(i))for(const e of i){if(!Array.isArray(e)||e.length<4)continue;const i=e.slice(0,e.length-1);i.length<3||(t+=(t?" ":"")+rs(i.map(e=>[e[0],e[1]])))}return t}const Is=15;function Es(e,t,i){const n=e?.length||0;if(n<3||t?.length!==n)return!1;const r=e[(i-1+n)%n],o=e[i],s=e[(i+1)%n],a=[r[0]-o[0],r[1]-o[1]],l=[s[0]-o[0],s[1]-o[1]],c=Math.hypot(a[0],a[1]),h=Math.hypot(l[0],l[1]);if(!(c>1e-9&&h>1e-9))return!1;const d=Math.max(-1,Math.min(1,(a[0]*l[0]+a[1]*l[1])/(c*h))),u=Math.acos(d);if(!(u>1e-9))return!1;if(u>=Is*Math.PI/180)return!1;const p=Math.max(Math.max(0,t[(i-1+n)%n]),Math.max(0,t[i]));if(!(p>0))return!1;const _=p/Math.tan(u/2);return Number.isFinite(_)&&_>0&&_<c-1e-9&&_<h-1e-9}function Ns(e,t,i,n=[],r,o,s,a=1,l=[],c={}){if(!t?.length&&!l.length)return{status:"not-applicable",geom:[],components:[],roomGeom:[],paperGeom:[],roomComponents:[],depthUnits:0,openingIndex:null,multiWallNodes:null,degradedExtraCount:0};const h=[],d=_s(e,t,i,r,o,s,a);let u=0;for(const n of e||[]){if(!n?.id)continue;const l=ms(e,n.id,t,i,r,o,s,a);if(!l||l.poly.length<3||!l.offsets.some(e=>e>0))continue;for(const e of l.offsets)e>0&&(u=Math.max(u,2*e));const c=js(l.poly,l.offsets,d),p=ns(l.poly,l.offsets,d);c&&h.push({outset:c,inset:p})}for(const e of l){const t=e.map(e=>e[0]),i=e.map(e=>e[1]);if(t.length){const n=Math.min(Math.max(...t)-Math.min(...t),Math.max(...i)-Math.min(...i)),r=Math.min(...e.map((t,i)=>{const n=e[(i+1)%e.length];return Math.hypot(n[0]-t[0],n[1]-t[1])}));u=Math.max(u,e.length>16?n:r)}}const p=function(e,t,i,n,r,o,s,a){if(!t?.length||!i?.length)return[];const l=4*Zo(n,s),c=new Map;for(const a of gs(e,t,i,n,r,o,s))!a.open&&a.half>0&&!c.has(a.key)&&c.set(a.key,a);const h=[...c.values()];if(h.length<2)return[];const d=a||ds(h,l),u=[];for(const e of i)for(const t of[[e[0],e[1]],[e[2],e[3]]])u.some(e=>Math.hypot(e[0]-t[0],e[1]-t[1])<=l)||u.push(t);const p=[],_=(e,t)=>{let i=0,n=0;if(Math.hypot(e.a[0]-t[0],e.a[1]-t[1])<=l)i=e.b[0]-e.a[0],n=e.b[1]-e.a[1];else{if(!(Math.hypot(e.b[0]-t[0],e.b[1]-t[1])<=l))return null;i=e.a[0]-e.b[0],n=e.a[1]-e.b[1]}const r=Math.hypot(i,n);return r>l?[i/r,n/r]:null};for(const e of u){const t=h.map(t=>({iv:t,u:_(t,e)})).filter(e=>!!e.u);for(let i=0;i<t.length;i++)for(let n=i+1;n<t.length;n++){const r=t[i],o=t[n],s=r.u[0]*o.u[1]-r.u[1]*o.u[0],a=Math.abs(s);if(a<.001)continue;const c=o.iv.half/a,h=r.iv.half/a,u=[e[0]-r.u[0]*c,e[1]-r.u[1]*c],_=[e[0]-o.u[0]*h,e[1]-o.u[1]*h],m=[u[0]+_[0]-e[0],u[1]+_[1]-e[1]],g=Math.max(r.iv.half,o.iv.half,1e-9),f=ps(d,e),v=f?.limit??4*g;let y;if(Math.hypot(m[0]-e[0],m[1]-e[1])<=v)y=s>0?[e.slice(),u,m,_]:[e.slice(),_,m,u];else{if(!f)continue;{const t=[-r.u[1],r.u[0]],i=[-o.u[1],o.u[0]],n=s<0?1:-1,a=[e[0]+t[0]*r.iv.half*n,e[1]+t[1]*r.iv.half*n],l=[e[0]-i[0]*o.iv.half*n,e[1]-i[1]*o.iv.half*n];y=s>0?[e.slice(),a,l]:[e.slice(),l,a]}}Math.abs(Xo(y))>l*l&&p.push(y)}}return p}(e,t,i,r,o,s,a,d),_=n.length?Bs(e,t,i,r,o,s,a):null;let m="exterior";try{const v=zs(e,t,i,r,o,s,a,d);m="paper";const y=v?v.shell?.length?Et(v.centre,v.shell):v.centre:[],b=e=>{const t=xs(e.outset);if(!e.inset)return t;const i=xs(e.inset);return Ht(t,i)};m="room-rings";let w=null;for(const e of h)try{const t=b(e);w=w?Et(w,t):t}catch{}if(m="edge-bodies",v)for(const n of qs(e,t,i,r,o,s,a))try{const e=Nt(xs(n.quad),v.centre);w=w?Et(w,e):e}catch{}m="junctions",w=function(e,t,i=1,n=Et){let r=e;for(const e of t||[]){const t=Ds(e,i);if(t)try{const e=xs(t);r=r?n(r,e):e}catch{}}return r}(w,p,a),m="facade-clip",w&&v&&(w=Nt(w,v.centre)),m="exterior-shell";const k=[];let x=0;if(v?.shell?.length)if(w)try{const e=Et(w,v.shell);if(!$s(e))throw new Error("invalid shell union");w=e}catch{if(!$s(w)||!$s(v.shell))throw new Error("invalid shell");k.push({id:"exterior-shell",geom:v.shell}),x++}else w=v.shell;if(m="multi-wall-trim",w&&d.nodes.length){const e=e=>e.rays.some(e=>e.supports.some(e=>e.length<2*e.halfDepth)),t=d.nodes.filter(e);if(t.length){w=Cs(w,{...d,nodes:t},v?.centre,y)}}if(m="junction-corners",d.nodes.length){const n=us(d),l=function(e,t,i,n,r,o,s,a){try{const l=zs(e,t,i,n,r,o,s,{epsilon:a.epsilon,coordinateScale:a.coordinateScale,nodes:[],index:new Map});return l?l.shell?.length?Et(l.centre,l.shell):l.centre:null}catch{return null}}(e,t,i,r,o,s,a,d);for(const e of n.fans)try{let t=[xs(e)];if(l&&(t=Nt(t,l)),!t?.length)continue;w=w?Et(w,t):t}catch{}g=w,f=Math.max(d.epsilon,1e-9)**2,w=Array.isArray(g)?g.map(e=>{if(!Array.isArray(e)||!e.length)return e;const[t,...i]=e;return Math.abs(Xo(t||[]))<=f?null:[t,...i.filter(e=>Math.abs(Xo(e||[]))>f)]}).filter(e=>!!e):g}const $=w||[],S=[...$s($)?[{id:"room-primary",geom:$}]:[],...k.map((e,t)=>({id:`room-isolated-${t}`,geom:e.geom}))];m="openings";for(const e of n){if(!(e.length>0))continue;const t=Gs(_,e,!0);if(!t.negative&&!t.positive)continue;const i=e.angle*Math.PI/180,n=Math.cos(i),o=Math.sin(i),s=-o,l=n,c=e.length/2,h=1.25*Math.max(u,r*a),d=[[e.x-n*c-s*h,e.y-o*c-l*h],[e.x+n*c-s*h,e.y+o*c-l*h],[e.x+n*c+s*h,e.y+o*c+l*h],[e.x-n*c+s*h,e.y-o*c+l*h]];w&&(w=Ht(w,xs(d)));for(const e of k)e.geom=Ht(e.geom,xs(d))}m="extras";const M=[];let R=0;const T=c.mergeExtra||((e,t)=>e?Et(e,t):t);for(let e=0;e<l.length;e++){const t=l[e];if(t.length<3||!t.every(e=>e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1]))||Math.abs(yi(t))<=1e-9){R++;continue}const i=[xs(t)];try{const t=T(w,i,e);if(!$s(t))throw new Error("invalid extra union");w=t}catch{R++,$s(i)&&M.push({id:`extra-${e}`,geom:i})}}M.push(...k),M.sort((e,t)=>Fs(e.geom).localeCompare(Fs(t.geom)));const C=w||[];return{status:R||x?"degraded-extra":"ok",geom:C,components:[...$s(C)?[{id:"primary",geom:C}]:[],...M.map((e,t)=>({...e,id:`isolated-${t}`}))],roomGeom:$,roomComponents:S,paperGeom:y,depthUnits:u,openingPadUnits:1.25*Math.max(u,r*a),openingIndex:_,multiWallNodes:d,degradedExtraCount:R+x}}catch{return c.onCoreFailure?.(m),{status:"failed-core",geom:[],components:[],roomGeom:[],paperGeom:[],roomComponents:[],depthUnits:u,openingIndex:null,multiWallNodes:d,degradedExtraCount:0}}var g,f}function Hs(e,t,i,n=[],r,o,s,a=1,l=[],c={}){if(!t?.length&&!l.length)return null;return Ls(Ns(e,t,i,n,r,o,s,a,l,c))}function Ls(e){if("failed-core"===e.status||"not-applicable"===e.status)return null;const t=e.components.map(e=>({id:e.id,d:Fs(e.geom),fillRule:"evenodd"})).filter(e=>!!e.d),i=t[0]?.d||"",n=Fs(e.paperGeom);if(t.length){const r={status:e.status,d:i,paths:t,components:e.components,roomGeom:e.roomGeom,multiWallNodes:e.multiWallNodes,paperD:n,depthUnits:e.depthUnits,fillRule:"evenodd"};return Object.defineProperties(r,{roomComponents:{value:e.roomComponents||[],enumerable:!1},openingIndex:{value:e.openingIndex,enumerable:!1},openingPadUnits:{value:e.openingPadUnits,enumerable:!1}}),r}return null}function qs(e,t,i,n,r,o,s=1){if(!t?.length)return[];const a=new Set,l=[];for(const c of e||[]){if(!c?.id)continue;const h=ms(e,c.id,t,i,n,r,o,s);if(!h)continue;const d=h.poly;for(let e=0;e<d.length;e++){const t=d[e],i=d[(e+1)%d.length],c=h.kinds[e];if(!c)continue;const u=h.cms[e];if(!(u>0))continue;const p=$o(t,i,n,s);if(a.has(p))continue;a.add(p);const _=vo(u,r,o),[m,g]=Jo(d,e),f=-m,v=-g,y=_/2,b=[[t[0]+f*y,t[1]+v*y],[i[0]+f*y,i[1]+v*y],[i[0]+m*y,i[1]+g*y],[t[0]+m*y,t[1]+g*y]];l.push({key:p,kind:c,cm:u,quad:b,a:[t[0],t[1]],b:[i[0],i[1]],depthUnits:_})}}return l}function js(e,t,i){const n=e?.length||0;if(n<3||t.length!==n)return null;if(t.every(e=>!(e>0)))return e.map(e=>[e[0],e[1]]);os(e),t.slice().reverse();const r=[];for(let o=0;o<n;o++){const s=(o-1+n)%n,a=Math.max(0,t[s]),l=Math.max(0,t[o]),[c,h]=Jo(e,s),[d,u]=Jo(e,o),p=e[s],_=e[o],m=e[o],g=e[(o+1)%n],f=[_[0]-p[0],_[1]-p[1]],v=[g[0]-m[0],g[1]-m[1]],y=Math.hypot(f[0],f[1])||1,b=Math.hypot(v[0],v[1])||1,w=[f[0]/y,f[1]/y],k=[v[0]/b,v[1]/b],x=[p[0]-c*a,p[1]-h*a],$=[m[0]-d*l,m[1]-u*l];if(!(a>0||l>0)){r.push([e[o][0],e[o][1]]);continue}if(a>0!=l>0){const t=e[o],i=a>0?[t[0]-c*a,t[1]-h*a]:[t[0],t[1]],n=l>0?[t[0]-d*l,t[1]-u*l]:[t[0],t[1]];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}if(Qo(w,k)){const t=e[o],i=[t[0]-c*a,t[1]-h*a],n=[t[0]-d*l,t[1]-u*l];r.push(i),Math.hypot(n[0]-i[0],n[1]-i[1])>1e-9&&r.push(n);continue}const S=es(x,w,$,k),M=Math.max(a,l,1e-9),R=ps(i,e[o])?.limit??4*M;if(S){const i=Math.hypot(S[0]-e[o][0],S[1]-e[o][1]);if(Number.isFinite(i)&&i<=R){r.push(S);continue}if(Es(e,t,o)){r.push([e[o][0],e[o][1]]);continue}}a>0&&r.push([e[o][0]-c*a,e[o][1]-h*a]),l>0&&r.push([e[o][0]-d*l,e[o][1]-u*l])}return r.length>=3?r:null}function Bs(e,t,i,n,r,o,s=1){const a=[];for(const l of e||[]){if(!l?.id)continue;const c=ms(e,l.id,t,i,n,r,o,s);if(!c)continue;const h=Math.abs(yi(c.poly));for(let e=0;e<c.poly.length;e++){if(!c.kinds[e])continue;const t=c.poly[e],i=c.poly[(e+1)%c.poly.length];a.push({roomId:l.id,a:t,b:i,inward:Jo(c.poly,e),cm:c.cms[e],half:c.offsets[e],area:h,key:$o(t,i,n,s)})}}return{edges:a,adjacencyEps:Zo(n,s)}}function Ws(e,t,i,n){const r=e.map(e=>[Math.max(t,e.x0),Math.min(i,e.x1)]).filter(e=>e[1]-e[0]>n).sort((e,t)=>e[0]-t[0]||e[1]-t[1]);if(!r.length)return{coverage:0,full:!1};let o=r[0][0],s=r[0][1],a=0,l=o<=t+n;for(let e=1;e<r.length;e++){const[t,i]=r[e];t<=s+n?s=Math.max(s,i):(a+=s-o,l=!1,o=t,s=i)}return a+=s-o,l=l&&s>=i-n,{coverage:a,full:l}}function Us(e,t){return Number(t.full)-Number(e.full)||e.faceDistance-t.faceDistance||e.area-t.area||e.roomId.localeCompare(t.roomId)}function Gs(e,t,i=!1){const n=Number(t?.x),r=Number(t?.y),o=Number(t?.angle),s=Number(t?.length);if(!([n,r,o,s].every(Number.isFinite)&&s>0))return{negative:null,positive:null};const a=o*Math.PI/180,l=Math.cos(a),c=Math.sin(a),h=-c,d=l,u=s/2,p=Math.max(1e-9,e.adjacencyEps),_=new Map;let m=0;for(const t of e.edges){if(i&&!(t.half>0))continue;if(!zo(t.a,t.b,o))continue;const[e,s]=ko(t.a,t.b);if(Math.abs((n-t.a[0])*s-(r-t.a[1])*e)>p)continue;const a=(t.a[0]-n)*l+(t.a[1]-r)*c,g=(t.b[0]-n)*l+(t.b[1]-r)*c,f=Math.max(-u,Math.min(a,g)),v=Math.min(u,Math.max(a,g));if(v-f<=p)continue;const y=t.inward[0]*h+t.inward[1]*d>=0?1:-1,b=((t.a[0]+t.b[0])/2-n)*h+((t.a[1]+t.b[1])/2-r)*d,w=Math.abs(b+y*t.half),k=`${y}|${t.roomId}`,x={x0:f,x1:v,half:t.half,cm:t.cm,key:t.key,axis:[e,s]},$=_.get(k);$?($.pieces.push(x),$.faceDistance=Math.min($.faceDistance,w)):_.set(k,{roomId:t.roomId,side:y,order:m++,pieces:[x],faceDistance:w,area:t.area,coverage:0,full:!1})}for(const e of _.values()){const t=Ws(e.pieces,-u,u,p);e.coverage=t.coverage,e.full=t.full}const g=e=>{const t=[..._.values()].filter(t=>t.side===e&&t.coverage>p);return t.sort(Us),t[0]||null};return{negative:g(-1),positive:g(1)}}function Vs(e,t){const i=Gs(e,t),n=[i.negative,i.positive].filter(e=>!!e);if(!n.length)return{ox:0,oy:0,cm:0,side:-1};const r=i.negative&&i.positive?-1:n[0].side,o=t.flip_v?-r:r,s=(-1===o?i.negative:i.positive)||n[0],a=[...s.pieces].sort((e,t)=>(e.x0<=0&&e.x1>=0?0:Math.min(Math.abs(e.x0),Math.abs(e.x1)))-(t.x0<=0&&t.x1>=0?0:Math.min(Math.abs(t.x0),Math.abs(t.x1)))||t.x1-t.x0-(e.x1-e.x0)||e.key.localeCompare(t.key))[0];if(!(a.half>0&&a.cm>0))return{ox:0,oy:0,cm:0,side:o};const l=t.angle*Math.PI/180,c=-Math.sin(l),h=Math.cos(l);return{ox:c*o*a.half,oy:h*o*a.half,cm:a.cm,side:o}}function Ks(e,t){const i=1e-9,n=t.filter(e=>Number.isFinite(e.x0)&&Number.isFinite(e.x1)&&Number.isFinite(e.half)&&e.x1>e.x0&&e.half>0);if(!n.length)return"";const r=n.flatMap(e=>[e.x0,e.x1]).sort((e,t)=>e-t),o=[];for(const e of r){const t=o[o.length-1];(void 0===t||e>t+i)&&o.push(e)}const s=[];for(let e=0;e+1<o.length;e++){const t=o[e],r=o[e+1];if(!(r>t+i))continue;const a=(t+r)/2,l=n.reduce((e,t)=>a>=t.x0-i&&a<=t.x1+i?Math.max(e,t.half):e,0);if(!(l>0))continue;const c=s[s.length-1];c&&t<=c.x1+i&&Math.abs(l-c.half)<=i?c.x1=r:s.push({x0:t,x1:r,half:l})}const a=[];for(const e of s){const t=a[a.length-1],n=t?.[t.length-1];n&&e.x0<=n.x1+i?(e.x0=n.x1,t.push(e)):a.push([e])}return a.map(t=>{const i=t[0],n=t[t.length-1],r=Math.min(.25*Math.min(...t.map(e=>e.half)),.75),o=-e*r,s=[];if(1===e){s.push(`M ${i.x0} ${o} L ${n.x1} ${o}`);for(let e=t.length-1;e>=0;e--){const i=t[e];s.push(`L ${i.x1} ${i.half} L ${i.x0} ${i.half}`)}}else{s.push(`M ${n.x1} ${o} L ${i.x0} ${o}`);for(const e of t)s.push(`L ${e.x0} ${-e.half} L ${e.x1} ${-e.half}`)}return s.push("Z"),s.join(" ")}).join(" ")}function Ys(e,t,i,n){if(!n)return i;const r=e.angle*Math.PI/180,o=Math.cos(r),s=Math.sin(r),a=[],l=1e-9;for(const r of i){const[i,c]=r.axis,h=o*i+s*c;if(Math.abs(h)<=l)continue;const d=e.x*i+e.y*c,u=d+h*r.x0,p=d+h*r.x1,_=Math.min(u,p),m=Math.max(u,p),g=`${r.key}|${t}`,f=n.get(g)||[];let v=[[_,m]];for(const[e,t]of f){const i=[];for(const[n,r]of v)t<=n+l||e>=r-l?i.push([n,r]):(e>n+l&&i.push([n,Math.min(r,e)]),t<r-l&&i.push([Math.max(n,t),r]));if(v=i,!v.length)break}for(const[e,t]of v){const i=(e-d)/h,n=(t-d)/h;a.push({...r,x0:Math.min(i,n),x1:Math.max(i,n)})}const y=[...f,[_,m]].sort((e,t)=>e[0]-t[0]||e[1]-t[1]),b=[];for(const e of y){const t=b[b.length-1];t&&e[0]<=t[1]+l?t[1]=Math.max(t[1],e[1]):b.push([e[0],e[1]])}n.set(g,b)}return a}function Zs(e,t){const i=new Map;return t.map(t=>function(e,t,i){const n=Gs(e,t,!0),r=n.negative,o=n.positive;if(!r&&!o)return null;let s;if(r&&o)s=[{candidate:r,side:-1},{candidate:o,side:1}];else{const e=r||o;s=[{candidate:e,side:-1},{candidate:e,side:1}]}const a=s.map(({candidate:e,side:n})=>({candidate:e,side:n,pieces:Ys(t,n,e.pieces,i)})),l=a.map(({candidate:e,side:t,pieces:i})=>({side:t,roomId:e.roomId,d:Ks(t,i)})),c=a.flatMap(({pieces:e})=>e);if(!c.length)return null;const h=Math.max(...c.map(e=>e.half));return{faces:l,minY:-h,maxY:h,wallKey:[...new Set(c.map(e=>e.key))].sort().join("|")}}(e,t,i))}const Xs=150,Js=1e-6;function Qs(e){return Number.isFinite(e)?Math.max(1,Math.min(Xs,e)):1}function ea(e){return((Number.isFinite(Number(e))?Number(e):0)%90+90)%90}const ta=e=>{const t=e.map(e=>[e[0],e[1]]);return!t.length||t[0][0]===t[t.length-1][0]&&t[0][1]===t[t.length-1][1]||t.push([...t[0]]),[t]},ia=(e,t)=>e[0]===t[0]&&e[1]===t[1];function na(e,t=1e-6){const i=Number.isFinite(t)&&t>0?t:Js,n=[];for(const t of e||[]){if(!Array.isArray(t)||t.length<2)return null;const e=Number(t[0]),r=Number(t[1]);if(!Number.isFinite(e)||!Number.isFinite(r))return null;const o=Math.round(e/i)*i,s=Math.round(r/i)*i;if(!Number.isFinite(o)||!Number.isFinite(s))return null;const a=[Object.is(o,-0)?0:o,Object.is(s,-0)?0:s];n.length&&ia(n[n.length-1],a)||n.push(a)}return n.length>1&&ia(n[0],n[n.length-1])&&n.pop(),n.length<3||new Set(n.map(e=>`${e[0]},${e[1]}`)).size<3?null:yi(n)>i*i?n:null}function ra(e){const t=[];for(const i of e||[])for(const e of i||[]){const i=(e||[]).filter(e=>Array.isArray(e)&&e.length>=2);i.length<4||t.push(`M ${i.slice(0,-1).map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`)}return t.join(" ")}function oa(e,t,i,n,r){return qo({a:e,b:t,halfDepth:vo(i,n,r)/2})}function sa(e,t,i){const n=Number(t)>0?Number(t):5,r=Qs(e.cm)/n*i,o=e.center[0],s=e.center[1];if("circle"===e.shape){const e=r/2;return Array.from({length:96},(t,i)=>{const n=i/96*Math.PI*2;return[o+Math.cos(n)*e,s+Math.sin(n)*e]})}const a=r/2,l=ea(e.angle)*Math.PI/180,c=Math.cos(l),h=Math.sin(l);return[[-a,-a],[a,-a],[a,a],[-a,a]].map(([e,t])=>[o+e*c-t*h,s+e*h+t*c])}function aa(e,t,i=1e-9){if(!t.length)return[e];let n=[ta(e)];try{for(const e of t){const t=e.b[0]-e.a[0],r=e.b[1]-e.a[1],o=Math.hypot(t,r);if(!(o>i))continue;const s=t/o,a=r/o,l=-a,c=s,h=1.25*Math.max(Number(e.depth)||0,4*i),d=Math.max(2*i,1e-9*o),u=[[e.a[0]-s*d-l*h,e.a[1]-a*d-c*h],[e.b[0]+s*d-l*h,e.b[1]+a*d-c*h],[e.b[0]+s*d+l*h,e.b[1]+a*d+c*h],[e.a[0]-s*d+l*h,e.a[1]-a*d+c*h]];n=Ht(n,ta(u))}return fa(n)}catch{return[e]}}function la(e,t){try{const i=Ht([[...e.map(e=>[e[0],e[1]]),[e[0][0],e[0][1]]]],[[...t.map(e=>[e[0],e[1]]),[t[0][0],t[0][1]]]]);let n=null,r=0;for(const e of i||[]){const t=e?.[0]||[],i=Math.abs(yi(t));t.length>=4&&i>r&&(r=i,n=t.slice(0,-1).map(e=>[e[0],e[1]]))}return n}catch{return null}}function ca(e,t,i,n=Math.max(2e-4*i,1e-9),r=[]){const o=[],s=[],a=new Map;for(const e of r){const t=a.get(e.hostId)||[];t.push(e),a.set(e.hostId,t)}const l=[],c=[],h=[];for(const n of e.room_drafts||[])for(let e=0;e+1<n.points.length;e++){const r=Number(n.segments[e]?.cm),s=vo(Number.isFinite(r)?r:15,t,i)/2;if(!(s>0))continue;const a={a:n.points[e],b:n.points[e+1],halfDepth:s},c=qo(a);c&&(o.push(a),l.push(c))}const d=[];for(const n of e.partitions||[]){const e={a:n.a,b:n.b,halfDepth:vo(n.cm,t,i)/2};if(!(e.halfDepth>0))continue;const r=qo(e);r&&(s.push(e),c.push(r),d.push({id:n.id,body:r}))}const u=[...o,...s];for(const{segmentIndex:e,wedge:t}of Go(u,n)){const i=e<o.length?{list:l,at:e}:{list:c,at:e-o.length},n=la(i.list[i.at],t);n&&(i.list[i.at]=n,e>=o.length&&(d[i.at].body=n))}for(const e of d)h.push(...aa(e.body,a.get(e.id)||[],n));const p=(e.wall_columns||[]).map(e=>sa(e,t,i)),_=Vo([...o,...s],n).flatMap(e=>aa(e,r,n));return{drafts:l,partitions:c,columns:p,patches:_,all:[...l,...h,..._,...p]}}function ha(e){try{const t=e.map(e=>na(e)).filter(e=>!!e).map(e=>ta(e));return t.length?Et(t[0],...t.slice(1)):null}catch{return null}}const da=e=>`M ${e.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`;function ua(e){const t=[];for(const i of e||[]){if(ma([i])<=1e-6)continue;const e=[];for(const t of i||[]){const i=(t||[]).filter(e=>Array.isArray(e)&&e.length>=2);i.length<4||e.push(da(i.slice(0,-1)))}e.length&&t.push(e.join(" "))}return t}function pa(e,t,i={}){const n=ha(e.filter(e=>e.length>=3)),r=t.some(e=>!na(e))?null:ha(t);if(!n)return[];if(r)try{return ua(Nt(n,r))}catch{}return function(e,t,i){let n=null;for(let r=0;r<t.length;r++){const o=ha([t[r]]);if(!o){i.onBoundsFailure?.({boundIndex:r,phase:"bound-union"});continue}let s;try{s=Nt(e,o)}catch{i.onBoundsFailure?.({boundIndex:r,phase:"bound-intersection"});continue}if(s?.length&&!(ma(s)<=1e-12))if(n)try{n=Et(n,s)}catch{i.onBoundsFailure?.({boundIndex:r,phase:"result-union"})}else n=s}return n?ua(n):[]}(n,t,i)}function _a(e,t){if(!t.length)return[ta(e)];try{const i=ha(t);if(i)return Ht(ta(e),i)}catch{}let i=[ta(e)];for(const e of t)if(!(e.length<3))try{i=Ht(i,ta(e))}catch{}return i}function ma(e){let t=0;for(const i of e||[])if(i?.length){t+=yi(i[0]||[]);for(let e=1;e<i.length;e++)t-=yi(i[e]||[])}return Math.max(0,t)}function ga(e){const t=[];for(const i of e||[])for(const e of i||[])e?.length>=4&&t.push(e.slice(0,-1).map(e=>[e[0],e[1]]));return t}function fa(e){const t=[];for(const i of e||[]){const e=i?.[0];e?.length>=4&&t.push(e.slice(0,-1).map(e=>[e[0],e[1]]))}return t}function va(e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){const o=t[n][0],s=t[n][1],a=t[r][0],l=t[r][1];s>e[1]!=l>e[1]&&e[0]<(a-o)*(e[1]-s)/(l-s||1e-12)+o&&(i=!i)}return i}function ya(e,t,i){return function(e,t){for(const i of t||[]){const t=i?.[0];if(!t?.length||!va(e,t))continue;let n=!1;for(let t=1;t<i.length;t++)if(i[t]?.length&&va(e,i[t])){n=!0;break}if(!n)return!0}return!1}(e,t)||i.some(t=>va(e,t))}function ba(e,t,i){if(Math.hypot(e.center[0]-t.center[0],e.center[1]-t.center[1])>i)return!1;if(Math.abs(Qs(e.cm)-Qs(t.cm))>1e-6)return!1;if(e.shape!==t.shape)return!0;if("circle"===e.shape||"circle"===t.shape)return!0;const n=Math.abs(ea(e.angle)-ea(t.angle));return Math.min(n,90-n)<=1e-6}const wa=2.54;function ka(e){const t="number"==typeof e?e:NaN;return!Number.isFinite(t)||t<=0||5===t?1:5/t}function xa(e,t){return e*ka(t)}function $a(e){return e?wa:1}function Sa(e,t){if(!t)return String(e);const i=e/wa;return String(Math.round(1e6*i)/1e6)}function Ma(e,t){return t?e*wa:e}const Ra=1e3;function Ta(e,t){const i=Number(e),n=Number.isFinite(i)&&i>0?i:1,r=n>=1?t:t*n,o=n>=1?t/n:t;return{x:(t-r)/2,y:(t-o)/2,w:r,h:o}}const Ca=.01,Da=100;function Aa(e,t=1e3){const i=Ta(e?.plan_aspect,t),n=Number(e?.plan_scale),r=Number.isFinite(n)&&n>0?Math.min(Da,Math.max(Ca,n)):1,o=Number(e?.plan_scale_x),s=Number(e?.plan_scale_y),a=Number.isFinite(o)&&o>0?Math.min(Da,Math.max(Ca,o)):r,l=Number.isFinite(s)&&s>0?Math.min(Da,Math.max(Ca,s)):r,c=Number(e?.plan_x),h=Number(e?.plan_y),d=_r(e?.plan_angle);return{x:i.x+(Number.isFinite(c)?ja(c):0)*t,y:i.y+(Number.isFinite(h)?ja(h):0)*t,w:i.w*a,h:i.h*l,...d?{angle:d}:{}}}function Oa(e){if(null==e.x||null==e.y)return{x:e.x,y:e.y,w:e.w,h:e.h};const t=Number(e.w)||0,i=Number(e.h)||0;return{x:t<0?e.x+t:e.x,y:i<0?e.y+i:e.y,w:Math.abs(t),h:Math.abs(i)}}function za(e){return e&&Array.isArray(e.spaces)?e.spaces.map(e=>{const t=Ra,i=function(e){return Array.isArray(e)&&4===e.length&&e.every(e=>Number.isFinite(e))&&e[2]>1e-6&&e[3]>1e-6?e:[0,0,1,1]}(e.view_box);return{id:e.id,title:e.title,cellCm:Number.isFinite(Number(e.cell_cm))&&Number(e.cell_cm)>0?Number(e.cell_cm):5,vb:[i[0]*Ra,i[1]*t,i[2]*Ra,i[3]*t],bg:e.plan_url?{href:Mn(e.plan_url),...Aa(e,Ra)}:null,rooms:(e.rooms||[]).map(e=>{const i={...e,...Oa(e)};return{id:i.id,name:i.name,area:i.area??null,open_to:i.open_to||void 0,settings:i.settings||void 0,x:null!=i.x?i.x*Ra:void 0,y:null!=i.y?i.y*t:void 0,w:null!=i.w?i.w*Ra:void 0,h:null!=i.h?i.h*t:void 0,poly:i.poly?i.poly.map(e=>[e[0]*Ra,e[1]*t]):void 0,wall_ids:Array.isArray(i.wall_ids)?[...i.wall_ids]:void 0}}),wall_segments:(e.wall_segments||[]).map(e=>({...e,id:String(e.id),a:[Number(e.a?.[0])*Ra,Number(e.a?.[1])*t],b:[Number(e.b?.[0])*Ra,Number(e.b?.[1])*t],cm:Number(e.cm)})),room_drafts:(e.room_drafts||[]).map(e=>({id:e.id,points:(e.points||[]).map(e=>[e[0]*Ra,e[1]*t]),segments:(e.segments||[]).map(e=>({..."string"==typeof e.id&&e.id?{id:e.id}:{},cm:Number(e.cm)}))})),partitions:(e.partitions||[]).map(e=>({id:e.id,a:[e.a[0]*Ra,e.a[1]*t],b:[e.b[0]*Ra,e.b[1]*t],cm:Number(e.cm)})),wall_columns:(e.wall_columns||[]).map(e=>({id:e.id,shape:"circle"===e.shape?"circle":"square",center:[e.center[0]*Ra,e.center[1]*t],cm:Number(e.cm),..."circle"===e.shape?{}:{angle:ea(e.angle)}}))}}):[]}const Pa=5e3,Fa=Pa*Ra,Ia=240,Ea=Ra/Ia,Na=1/Ia;function Ha(e){if(!Number.isFinite(e))return e;const t=Math.round(e*Ia/Ra)*Ra/Ia;return Math.abs(t-e)<=1e-9*Ea?e:t}function La(e){return{x:Ha(e.x),y:Ha(e.y)}}function qa(e){return Number.isFinite(e)?Math.min(Fa,Math.max(-Fa,e)):0}function ja(e){return Number.isFinite(e)?Math.min(Pa,Math.max(-Pa,e)):0}const Ba=1/3,Wa=200;function Ua(e){let t=1/0,i=1/0,n=-1/0,r=-1/0;for(const o of e){const e=Number(o[0]),s=Number(o[1]);Number.isFinite(e)&&Number.isFinite(s)&&(e<t&&(t=e),s<i&&(i=s),e>n&&(n=e),s>r&&(r=s))}return t>n?null:{minX:t,minY:i,maxX:n,maxY:r}}function Ga(e){return e.poly&&e.poly.length?Ua(e.poly):null==e.x||null==e.y?null:Ua([[e.x,e.y],[e.x+(e.w||0),e.y+(e.h||0)]])}function Va(e,t){const i=[];for(const t of e.rooms||[]){const e=Ga(t);e&&i.push(e)}if(e.bg){const t=Ua(wr(e.bg));t&&i.push(t)}for(const e of t||[])if(Array.isArray(e)){const t=Ua([e]);t&&i.push(t)}else i.push(e);return i}const Ka=e=>{if(!e.length)return 0;const t=[...e].sort((e,t)=>e-t),i=t.length>>1;return t.length%2?t[i]:(t[i-1]+t[i])/2},Ya=e=>{let t=1/0,i=1/0,n=-1/0,r=-1/0;for(const o of e)o.minX<t&&(t=o.minX),o.minY<i&&(i=o.minY),o.maxX>n&&(n=o.maxX),o.maxY>r&&(r=o.maxY);return t>n||i>r?null:{x:t,y:i,w:n-t,h:r-i}};function Za(e,t){let{x:i,y:n,w:r,h:o}=e;r<30&&(i=i+r/2-100,r=Wa),o<30&&(n=n+o/2-100,o=Wa);const s=Math.max(r,o)*t;return{x:i-s,y:n-s,w:r+2*s,h:o+2*s}}function Xa(e,t={}){const i=t.pad??.05,n=t.k??10,r=t.minSpread??50,o=e.filter(e=>Number.isFinite(e.minX)&&Number.isFinite(e.minY)&&Number.isFinite(e.maxX)&&Number.isFinite(e.maxY)&&Math.abs(e.minX)<=Fa&&Math.abs(e.maxX)<=Fa&&Math.abs(e.minY)<=Fa&&Math.abs(e.maxY)<=Fa);if(!o.length)return{core:null,all:null,outliers:0};const s=Ya(o);if(o.length<4){const e=Za(s,i);return{core:e,all:e,outliers:0}}const a=o.map(e=>(e.minX+e.maxX)/2),l=o.map(e=>(e.minY+e.maxY)/2),c=Ka(a),h=Ka(l),d=o.map((e,t)=>Math.max(Math.abs(a[t]-c),Math.abs(l[t]-h))),u=Math.max(((e,t)=>e.length?e[Math.min(e.length-1,Math.max(0,Math.round(t*(e.length-1))))]:0)([...d].sort((e,t)=>e-t),.75),r),p=d.map(e=>e>n*u),_=p.filter(Boolean).length,m=_&&_<=o.length*Ba?o.filter((e,t)=>!p[t]):o;return{core:Za(Ya(m)||s,i),all:Za(s,i),outliers:m===o?0:_}}function Ja(e,t,i=.05){const n=Xa(Va(e,t),{pad:i});if(n.core)return n.core;const r=e.vb&&4===e.vb.length&&e.vb[2]>0&&e.vb[3]>0?e.vb:[0,0,Ra,Ra];return{x:r[0],y:r[1],w:r[2],h:r[3]}}function Qa(e){const t=Ja(e);return{x:t.x+t.w/2,y:t.y+t.h/2}}function el(e){const t=[];for(const i of e.rooms||[]){const e=Ga(i);e&&t.push(e)}const i=Xa(t,{pad:0}).core,n=Ra*ka(e.cellCm??5);return i?Math.max(n,Math.min(Fa,Math.max(i.w,i.h))):n}function tl(e,t,i,n=1){const r=Number(i),o=Number.isFinite(n)&&n>0?n:1;return!Number.isFinite(r)||r<=0?e*o:e*el(t)*o/r}const il=[1,2,5,10,20,50,100,200,500,1e3];function nl(e,t,i=7){if(!(e>0&&t>0&&Number.isFinite(t)))return null;const n=il.find(n=>e*n*t>=i);if(void 0===n)return null;const r=il.find(e=>e>=5*n)??5*n;return{fine:n,coarse:r}}function rl(e){if(e.poly&&e.poly.length){const t=e.poly.map(e=>e[0]),i=e.poly.map(e=>e[1]),n=Math.min(...t),r=Math.min(...i);return{x:n,y:r,w:Math.max(...t)-n,h:Math.max(...i)-r}}return{x:e.x??0,y:e.y??0,w:e.w??0,h:e.h??0}}function ol(e,t,i,n){const r=i["rl_"+(e.id||"")];if(r&&r.s===t)return{x:r.x*Ra,y:r.y*Ra};const o=function(e){if(e.poly){const t=e.poly.length;return[e.poly.reduce((e,t)=>e+t[0],0)/t,e.poly.reduce((e,t)=>e+t[1],0)/t]}return[e.x+e.w/2,e.y+.1*Math.min(e.w,e.h)]}(e);return La({x:o[0],y:o[1]})}const sl=["furniture","appliance","sanitary","other"],al=[{id:"sofa",group:"furniture",w:220,h:90,g:[["r",0,0,1,1],["l",.09,.26,.91,.26],["l",.09,.26,.09,1],["l",.91,.26,.91,1],["l",.5,.26,.5,1]]},{id:"armchair",group:"furniture",w:90,h:85,g:[["r",0,0,1,1],["l",.14,.28,.86,.28],["l",.14,.28,.14,1],["l",.86,.28,.86,1]]},{id:"coffee_table",group:"furniture",w:110,h:60,g:[["r",0,0,1,1],["r",.08,.14,.84,.72]]},{id:"table_dining",group:"furniture",w:140,h:80,g:[["r",0,0,1,1],["r",.06,.11,.88,.78]]},{id:"table_round",group:"furniture",w:120,h:120,g:[["e",.5,.5,.5,.5],["e",.5,.5,.41,.41]]},{id:"chair",group:"furniture",w:45,h:45,g:[["r",0,0,1,.18],["r",.06,.18,.88,.8]]},{id:"desk",group:"furniture",w:120,h:60,g:[["r",0,0,1,1],["r",.63,.07,.31,.86],["l",.63,.5,.94,.5]]},{id:"bed_double",group:"furniture",w:160,h:200,g:[["r",0,0,1,1],["r",0,0,1,.07],["r",.06,.1,.4,.15],["r",.54,.1,.4,.15],["l",0,.33,1,.33]]},{id:"bed_single",group:"furniture",w:90,h:200,g:[["r",0,0,1,1],["r",0,0,1,.07],["r",.15,.1,.7,.15],["l",0,.33,1,.33]]},{id:"nightstand",group:"furniture",w:45,h:40,g:[["r",0,0,1,1],["r",.12,.14,.76,.33],["r",.12,.53,.76,.33]]},{id:"wardrobe",group:"furniture",w:100,h:60,g:[["r",0,0,1,1],["l",0,.72,1,.72],["l",.5,.72,.5,1]]},{id:"bookshelf",group:"furniture",w:80,h:30,g:[["r",0,0,1,1],["l",.34,0,.34,1],["l",.67,0,.67,1]]},{id:"fridge",group:"appliance",w:60,h:65,g:[["r",0,0,1,1],["l",0,.36,1,.36],["l",.83,.44,.83,.64]]},{id:"stove",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["e",.29,.31,.15,.15],["e",.71,.31,.15,.15],["e",.29,.71,.15,.15],["e",.71,.71,.15,.15]]},{id:"dishwasher",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["r",.1,.12,.8,.76],["e",.5,.5,.27,.27],["e",.5,.5,.13,.13]]},{id:"washer",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["l",.08,.17,.92,.17],["e",.5,.57,.3,.3],["e",.5,.57,.14,.14]]},{id:"dryer",group:"appliance",w:60,h:60,g:[["r",0,0,1,1],["l",.08,.17,.92,.17],["e",.5,.57,.3,.3],["p",.36,.5,.5,.64,.64,.5]]},{id:"tv",group:"appliance",w:120,h:30,g:[["r",0,0,1,.42],["l",.5,.42,.5,.72],["l",.3,.72,.7,.72]]},{id:"ac",group:"appliance",w:90,h:25,g:[["r",0,0,1,1],["l",.05,.55,.95,.55],["l",.05,.79,.95,.79]]},{id:"water_heater",group:"appliance",w:45,h:45,g:[["e",.5,.5,.5,.5],["e",.5,.5,.31,.31]]},{id:"toilet",group:"sanitary",w:40,h:70,g:[["r",.06,0,.88,.2],["e",.5,.58,.37,.35],["e",.5,.58,.22,.2]]},{id:"bathtub",group:"sanitary",w:170,h:75,g:[["r",0,0,1,1],["r",.05,.11,.77,.78],["e",.89,.5,.045,.1]]},{id:"shower",group:"sanitary",w:90,h:90,g:[["r",0,0,1,1],["l",0,0,1,1],["l",1,0,0,1],["e",.5,.5,.08,.08]]},{id:"sink",group:"sanitary",w:60,h:45,g:[["r",0,0,1,1],["e",.5,.6,.34,.3],["e",.5,.15,.07,.07]]},{id:"kitchen_sink",group:"sanitary",w:80,h:60,g:[["r",0,0,1,1],["r",.06,.24,.44,.64],["r",.54,.24,.4,.64],["e",.5,.12,.06,.06]]},{id:"bidet",group:"sanitary",w:40,h:55,g:[["e",.5,.5,.44,.5],["e",.5,.5,.26,.3]]},{id:"stairs",group:"other",w:100,h:280,g:[["r",0,0,1,1],["l",0,.111,1,.111],["l",0,.222,1,.222],["l",0,.333,1,.333],["l",0,.444,1,.444],["l",0,.556,1,.556],["l",0,.667,1,.667],["l",0,.778,1,.778],["l",0,.889,1,.889],["l",.5,.93,.5,.06],["p",.38,.16,.5,.06,.62,.16]]},{id:"fireplace",group:"other",w:120,h:40,g:[["r",0,0,1,1],["p",.22,1,.22,.42,.78,.42,.78,1]]},{id:"plant",group:"other",w:40,h:40,g:[["e",.5,.5,.22,.22],["l",.5,.28,.5,.02],["l",.5,.72,.5,.98],["l",.28,.5,.02,.5],["l",.72,.5,.98,.5],["l",.34,.34,.13,.13],["l",.66,.66,.87,.87],["l",.66,.34,.87,.13],["l",.34,.66,.13,.87]]},{id:"rug",group:"other",w:200,h:140,g:[["r",0,0,1,1],["r",.06,.09,.88,.82]]}],ll=new Map(al.map(e=>[e.id,e]));function cl(e){return e&&ll.get(e)||null}function hl(e){return al.filter(t=>t.group===e)}function dl(e){const t=cl(e);return t?{w:t.w,h:t.h}:{w:60,h:60}}function ul(e,t,i=Ea,n=1e3){const r=Number(t)>0?Number(t):5;return(Number(e)||0)/r*i/n}const pl=5e-4,_l=Pa;function ml(e){return Number.isFinite(e)?Math.max(pl,Math.min(_l,e)):pl}function gl(e){return Number.isFinite(e)?Math.max(1,Math.min(1e4,e)):1}const fl=e=>{const t=Math.round(1e3*e)/1e3;return Object.is(t,-0)?"0":String(t)};function vl(e,t,i){const n=cl(e);if(!(n&&t>0&&i>0))return"";const r=e=>fl(e*t),o=e=>fl(e*i),s=[];for(const e of n.g)if("r"===e[0]){const[,t,i,n,a]=e;s.push(`M${r(t)} ${o(i)}H${r(t+n)}V${o(i+a)}H${r(t)}Z`)}else if("l"===e[0]){const[,t,i,n,a]=e;s.push(`M${r(t)} ${o(i)}L${r(n)} ${o(a)}`)}else if("e"===e[0]){const[,n,a,l,c]=e;s.push(`M${r(n-l)} ${o(a)}A${fl(l*t)} ${fl(c*i)} 0 0 1 ${r(n+l)} ${o(a)}A${fl(l*t)} ${fl(c*i)} 0 0 1 ${r(n-l)} ${o(a)}Z`)}else{const t=e.slice(1);if(t.length<4)continue;let i=`M${r(t[0])} ${o(t[1])}`;for(let e=2;e+1<t.length;e+=2)i+=`L${r(t[e])} ${o(t[e+1])}`;s.push(i)}return s.join("")}const yl=e=>{let t=(e%360+360)%360;return t>180&&(t-=360),t};function bl(e,t,i,n,r,o=0){let s=null,a=r;for(const r of n){const[n,l,c,h]=r,d=c-n,u=h-l,p=d*d+u*u;if(!p)continue;const _=Math.sqrt(p);let m=((e-n)*d+(t-l)*u)/p;m=Math.max(0,Math.min(1,m));let g=n+m*d,f=l+m*u;const v=Math.hypot(e-g,t-f);if(!(v<a))continue;a=v;let y=e-g,b=t-f;const w=Math.hypot(y,b);if(w<1e-9?(y=u/_,b=-d/_):(y/=w,b/=w),o>0){const e=Math.round(m*_/o)*o;g=n+e/_*d,f=l+e/_*u}s={cx:g+y*(i/2),cy:f+b*(i/2),angle:yl(180*Math.atan2(-y,b)/Math.PI),dist:v}}return s}const wl=15e3,kl=2e3,xl=new WeakMap;function $l(e,t){let i=xl.get(e);if(!i){const t=new Set;i={hiddenAt:"hidden"===e.visibilityState?Date.now():0,token:0,subscribers:t,onVisibility:()=>{const t=xl.get(e);if(!t)return;const i=Date.now();if("hidden"===e.visibilityState){t.hiddenAt||(t.hiddenAt=i);const e={kind:"hidden",token:t.token,at:i,hiddenFor:0,long:!1};for(const i of[...t.subscribers])i(e);return}const n=t.hiddenAt?Math.max(0,i-t.hiddenAt):0;t.hiddenAt=0,t.token++;const r={kind:"visible",token:t.token,at:i,hiddenFor:n,long:n>=wl};for(const e of[...t.subscribers])e(r)},onPageShow:t=>{const i=xl.get(e);if(!i)return;const n=Date.now();i.token++;const r={kind:"pageshow",token:i.token,at:n,hiddenFor:0,long:!!t.persisted,persisted:!!t.persisted};for(const e of[...i.subscribers])e(r)}},xl.set(e,i),e.addEventListener("visibilitychange",i.onVisibility),e.defaultView?.addEventListener("pageshow",i.onPageShow)}return i.subscribers.add(t),()=>{const i=xl.get(e);i&&(i.subscribers.delete(t),i.subscribers.size||(e.removeEventListener("visibilitychange",i.onVisibility),e.defaultView?.removeEventListener("pageshow",i.onPageShow),xl.delete(e)))}}const Sl={now:()=>Date.now(),setTimeout:(e,t)=>window.setTimeout(e,t),clearTimeout:e=>window.clearTimeout(e),requestAnimationFrame:e=>window.requestAnimationFrame(e),cancelAnimationFrame:e=>window.cancelAnimationFrame(e)};class Ml{constructor(e,t=Sl){this.onChange=e,this.clock=t,this._state="steady",this._token=0,this._frameFingerprint="",this._hasCompleteFrame=!1,this._overlayPhase="none",this._recoveryReason=null,this._overlayTimer=0,this._overlayRaf=0,this._overlayOpaqueAt=0,this._barrierRafs=new Set,this._trace=[],this._disposed=!1}get state(){return this._state}get token(){return this._token}get frameFingerprint(){return this._frameFingerprint}get hasCompleteFrame(){return this._hasCompleteFrame}get overlayPhase(){return this._overlayPhase}get overlayVisible(){return"none"!==this._overlayPhase}get overlayBlocksInteraction(){return this.overlayVisible}get recoveryReason(){return this._recoveryReason}get trace(){return this._trace.map(e=>({...e,...e.stage?{stage:[...e.stage]}:{}}))}note(e,t={}){this.record(e,void 0,t)}record(e,t,i={}){this._trace.push({at:this.clock.now(),token:this._token,event:e,state:this._state,...t?{reason:t}:{},...i}),this._trace.length>80&&this._trace.splice(0,this._trace.length-80)}changed(){this._disposed||this.onChange()}adoptCompleteFrame(e){e&&(this._hasCompleteFrame=!0,this._frameFingerprint=e,this._state="steady",this._recoveryReason=null,this.clearOverlay(),this.record("frame-adopted"),this.changed())}markCompleteFrame(e){e&&(this._hasCompleteFrame=!0,this._frameFingerprint=e,this._state="steady",this._recoveryReason=null,this.clearOverlay(),this.record("frame-complete"),this.changed())}refreshCompleteFrame(e){!this._disposed&&this._hasCompleteFrame&&"steady"===this._state&&e&&e!==this._frameFingerprint&&(this._frameFingerprint=e,this.record("frame-refreshed"))}visibility(e){return"hidden"===e.kind?(this.record("visibility-hidden"),this._token):e.long||"visible"!==e.kind&&"pageshow"!==e.kind?this.beginCandidate("pageshow"===e.kind?"pageshow":"long-resume"):(this.record("pageshow"===e.kind?"pageshow-noop":"visibility-visible-quick"),this._token)}beginCandidate(e,t="plan"){return this._token++,this._recoveryReason=t,this._hasCompleteFrame?(this._state="connection"===t?"offline-stale":"holding",this.clearOverlay()):this.overlayVisible?this._state="overlay-visible":(this._state="overlay-pending",this.scheduleOverlay(t)),this.record("candidate-start",e),this.changed(),this._token}connectionLost(){return this.beginCandidate("connection-lost","connection")}candidateReady(e){return!this._disposed&&e===this._token&&(this._state="candidate-ready",this.record("candidate-ready"),this.changed(),!0)}async commitAfterPaint(e,t){if(this._disposed||e!==this._token)return!1;let i=!0;const n=(async()=>{for(await t.updateComplete();i&&!this._disposed&&e===this._token;)if(t.stageValid()&&t.assetsReady()){if(await this.nextFrame(),e!==this._token||!t.stageValid()||!t.assetsReady())continue;if(await this.nextFrame(),e===this._token&&t.stageValid()&&t.assetsReady())return!0}else await this.nextFrame();return!1})();let r=0;const o=new Promise(e=>{r=this.clock.setTimeout(()=>e({ready:!1,timedOut:!0}),kl)}),s=await Promise.race([n.then(e=>({ready:e,timedOut:!1})),o]);return i=!1,this.clock.clearTimeout(r),!this._disposed&&e===this._token&&(!(!s.ready&&!s.timedOut)&&(s.ready?(this._hasCompleteFrame=!0,this._frameFingerprint=t.frameFingerprint(),this.record("paint-barrier"),this.finishOverlayAfterCommit(),!0):(this.record("paint-barrier-timeout"),this._hasCompleteFrame?(this._state="connection"===this._recoveryReason?"offline-stale":"steady",this.clearOverlay()):(this._state="recovery-error","opaque"!==this._overlayPhase&&this.showOverlayNow()),this.changed(),!1)))}retry(e=this._recoveryReason||"plan"){return this.beginCandidate("retry",e)}nextFrame(){return new Promise(e=>{const t=this.clock.requestAnimationFrame(()=>{this._barrierRafs.delete(t),e()});this._barrierRafs.add(t)})}scheduleOverlay(e){this.clearOverlayTimer(),this._recoveryReason=e,this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,this._hasCompleteFrame||"overlay-pending"!==this._state&&"candidate-ready"!==this._state||(this._state="overlay-visible",this._overlayPhase="entering",this.record("overlay-enter"),this.changed(),this._overlayRaf=this.clock.requestAnimationFrame(()=>{this._overlayRaf=0,"entering"===this._overlayPhase&&(this._overlayPhase="fading-in",this.changed(),this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,"fading-in"===this._overlayPhase&&(this._overlayPhase="opaque",this._overlayOpaqueAt=this.clock.now(),this.record("overlay-opaque"),this.changed())},150))}))},150)}showOverlayNow(){this.clearOverlayTimer(),this._overlayPhase="opaque",this._overlayOpaqueAt=this.clock.now(),this.record("overlay-error")}finishOverlayAfterCommit(){if(this.clearOverlayTimer(),"none"===this._overlayPhase||"entering"===this._overlayPhase||"fading-in"===this._overlayPhase)return this.clearOverlay(),this._state="steady",this._recoveryReason=null,this.record("candidate-committed"),void this.changed();const e=Math.max(0,this._overlayOpaqueAt+250-this.clock.now());this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,this._overlayPhase="leaving",this.record("overlay-leave"),this.changed(),this._overlayTimer=this.clock.setTimeout(()=>{this._overlayTimer=0,this._overlayPhase="none",this._state="steady",this._recoveryReason=null,this.record("candidate-committed"),this.changed()},180)},e)}clearOverlayTimer(){this._overlayTimer&&this.clock.clearTimeout(this._overlayTimer),this._overlayTimer=0}clearOverlay(){this.clearOverlayTimer(),this._overlayRaf&&this.clock.cancelAnimationFrame(this._overlayRaf),this._overlayRaf=0,this._overlayPhase="none",this._overlayOpaqueAt=0}dispose(){this._disposed=!0,this._token++,this.clearOverlay();for(const e of this._barrierRafs)this.clock.cancelAnimationFrame(e);this._barrierRafs.clear()}}function Rl(e){let t=2166136261,i=2654435769;const n=new WeakSet,r=e=>{for(let n=0;n<e.length;n++){const r=e.charCodeAt(n);t^=r,t=Math.imul(t,16777619),i^=r+(i<<6>>>0)+(i>>>2)}},o=e=>{if(null===e)return void r("n");const t=typeof e;if("string"===t)return void r(`s${e.length}:${e}`);if("number"===t)return void r(`d${Number.isNaN(e)?"NaN":String(e)}`);if("boolean"===t)return void r(e?"t":"f");if("undefined"===t)return void r("u");if("object"!==t)return void r(`${t}:${String(e)}`);const i=e;if(n.has(i))r("[cycle]");else{if(n.add(i),Array.isArray(e)){r("[");for(const t of e)o(t);return r("]"),void n.delete(i)}r("{");for(const t of Object.keys(e).sort())r(t),o(e[t]);r("}"),n.delete(i)}};return o(e),`${(t>>>0).toString(16).padStart(8,"0")}${(i>>>0).toString(16).padStart(8,"0")}`}function Tl(e){return Rl(e)}const Cl=new WeakMap;class Dl{constructor(e,t=()=>Date.now()){this.onUpdate=e,this.now=t,this.fallbackAuthority={},this.referenceOwner={},this.referenced=new Set,this.queued=new Set,this.disposed=!1,this.sharedUpdate=()=>{this.disposed||this.onUpdate()}}bind(e){const t=((e,t)=>{const i=e?.connection||e?.callWS||t;return!i||"object"!=typeof i&&"function"!=typeof i?t:i})(e,this.fallbackAuthority);return this.shared&&this.authority===t||(this.shared&&(this.shared.listeners.delete(this.sharedUpdate),this.shared.references.delete(this.referenceOwner)),this.authority=t,this.shared=(e=>{let t=Cl.get(e);return t||(t={signed:{},queued:new Set,inFlight:new Map,retry:new Map,listeners:new Set,settlers:new Set,references:new Map},Cl.set(e,t)),t})(t),this.disposed||(this.shared.listeners.add(this.sharedUpdate),this.shared.references.set(this.referenceOwner,new Set(this.referenced)))),this.shared}start(e,t){this.disposed=!1,this.referenced=new Set(t());const i=this.bind(e());i.listeners.add(this.sharedUpdate),i.references.set(this.referenceOwner,new Set(this.referenced)),this.stopTimer(),this.resignTimer=setInterval(()=>this.resign(e(),t()),288e5)}dispose(){if(this.disposed=!0,this.stopTimer(),clearTimeout(this.batchTimer),this.shared){this.shared.listeners.delete(this.sharedUpdate),this.shared.references.delete(this.referenceOwner);for(const e of this.queued)this.shared.queued.delete(e)}this.queued.clear()}invalidate(e){const t=this.bind(e);clearTimeout(this.batchTimer),this.queued.clear(),t.queued.clear(),t.inFlight.clear(),t.retry.clear(),t.signed={}}stopTimer(){void 0!==this.resignTimer&&clearInterval(this.resignTimer),this.resignTimer=void 0}display(e,t){const i=Mn(t);if(!i.startsWith("/api/houseplan/content/"))return i;const n=this.bind(e);this.referenced.add(i),n.references.set(this.referenceOwner,new Set(this.referenced));const r=n.signed[i],o=r?this.now()-r.at:1/0;return o<$n?r.url:o<xn?(r.pending||this.request(e,i),r.url):(r&&delete n.signed[i],this.request(e,i),"")}request(e,t){if(!e?.callWS||this.queued.has(t))return;const i=this.bind(e),n=this.now(),r=i.inFlight.get(t);if(void 0!==r&&n-r<15e3)return;if(i.queued.has(t))return;const o=i.retry.get(t);o&&n<o.notBefore||(this.queued.add(t),i.queued.add(t),clearTimeout(this.batchTimer),this.batchTimer=setTimeout(()=>{const t=[...this.queued];this.queued.clear();for(const e of t)i.queued.delete(e);this.sign(e,t)},30))}sign(e,t){if(!t.length||!e?.callWS)return;const i=this.bind(e);for(const n of function(e,t){const i=Math.max(1,Math.floor(t)),n=[];for(let t=0;t<e.length;t+=i)n.push(e.slice(t,t+i));return n}(t,200)){const t=this.now(),r=n.filter(e=>{const n=i.inFlight.get(e);return!(void 0!==n&&t-n<15e3)&&(i.inFlight.set(e,t),!0)});r.length&&e.callWS({type:"houseplan/content/sign",paths:r}).then(e=>{const t=this.now();let n=0,o=!1;for(const s of r){const r=e?.urls?.[s];if("string"==typeof r&&r){const e=i.signed[s];e?.loaded&&e.url!==r?(e.pending={url:r,at:t},this.preloadReplacement(i,s,r,t)):(i.signed[s]={url:r,at:t,loaded:e?.url===r&&!!e.loaded},o=!0),i.retry.delete(s),n++}else this.backOff(i,s)}if(n&&(this.trimShared(i),o))for(const e of[...i.listeners])e()}).catch(()=>{for(const e of r)this.backOff(i,e)}).finally(()=>{for(const e of r)i.inFlight.get(e)===t&&i.inFlight.delete(e);for(const e of[...i.settlers])e()})}}preloadReplacement(e,t,i,n){const r=()=>{const r=e.signed[t];if(r?.pending?.url===i){e.signed[t]={url:i,at:n,loaded:!0},e.retry.delete(t),this.trimShared(e);for(const t of[...e.listeners])t()}},o=()=>{const n=e.signed[t];n?.pending?.url===i&&(delete n.pending,this.backOff(e,t))};if("undefined"==typeof Image)return void r();const s=new Image;s.onload=()=>{("function"==typeof s.decode?s.decode():Promise.resolve()).then(r).catch(o)},s.onerror=o,s.src=i}preloadCurrentImage(e,t,i){if(i.loaded)return Promise.resolve(!0);if(i.preload)return i.preload;if("undefined"==typeof Image)return i.loaded=!0,Promise.resolve(!0);const n=i.url;return i.preload=new Promise(r=>{const o=new Image;let s=!1;const a=o=>{if(s)return;s=!0,clearTimeout(l);const a=e.signed[t];if(a===i&&delete a.preload,o&&a===i&&a.url===n){a.loaded=!0;for(const t of[...e.listeners])t();r(!0)}else o||a!==i||this.backOff(e,t),r(!1)};o.onload=()=>{("function"==typeof o.decode?o.decode():Promise.resolve()).then(()=>a(!0)).catch(()=>a(!1))},o.onerror=()=>a(!1);const l=setTimeout(()=>a(!1),kl);o.src=n}),i.preload}prepareImage(e,t){const i=Mn(t);if(!i.startsWith("/api/houseplan/content/"))return Promise.resolve(!0);const n=this.bind(e),r=()=>{const t=n.signed[i];if(t&&this.now()-t.at<xn)return this.preloadCurrentImage(n,i,t);this.display(e,i);const r=n.retry.get(i);return r&&r.notBefore>this.now()&&!n.inFlight.has(i)&&!n.queued.has(i)?Promise.resolve(!1):null},o=r();return o?(s=o,new Promise(e=>{let t=!1;const i=i=>{t||(t=!0,clearTimeout(n),e(i))},n=setTimeout(()=>i(!1),kl);s.then(i).catch(()=>i(!1))})):new Promise(e=>{let t=!1,i=null;const o=i=>{t||(t=!0,clearTimeout(a),n.settlers.delete(s),e(i))},s=()=>{t||i||(i=r(),i&&i.then(o).catch(()=>o(!1)))},a=setTimeout(()=>o(!1),kl);n.settlers.add(s),s()});var s}backOff(e,t){const i=e.retry.get(t)?.delay||0,n=Math.min(6e4,i?2*i:2e3);e.retry.set(t,{notBefore:this.now()+n,delay:n})}trimShared(e){const t=Object.entries(e.signed);if(t.length<=512)return;const i=new Set(e.inFlight.keys());for(const t of e.references.values())for(const e of t)i.add(e);for(const[e,n]of t)(n.pending||n.preload)&&i.add(e);t.sort((e,t)=>t[1].at-e[1].at);const n=t.filter(([e])=>i.has(e));for(const e of t){if(n.length>=512)break;i.has(e[0])||n.push(e)}e.signed=Object.fromEntries(n)}resign(e,t){const i=this.bind(e);this.referenced=new Set(t),i.references.set(this.referenceOwner,new Set(this.referenced));const n=this.now(),r=new Set;for(const e of i.references.values())for(const t of e)r.add(t);const o={};for(const[e,t]of Object.entries(i.signed))r.has(e)&&n-t.at<xn&&(o[e]=t);i.signed=o,i.retry.clear(),this.sign(e,[...t].filter(e=>!!o[e]&&!o[e].pending))}markLoaded(e,t,i){const n=Mn(t);if(!n.startsWith("/api/houseplan/content/"))return;const r=this.bind(e).signed[n];if(r&&(!i||r.url===i)&&!r.loaded){r.loaded=!0;for(const t of[...this.bind(e).listeners])t()}}isReady(e,t){const i=Mn(t);if(!i.startsWith("/api/houseplan/content/"))return!0;const n=this.bind(e).signed[i];return!!n&&this.now()-n.at<xn&&n.loaded}get entries(){const e={};for(const[t,i]of Object.entries(this.shared?.signed||{}))e[t]={url:i.url,at:i.at};return e}get inFlightUrls(){return[...this.shared?.inFlight.keys()||[]]}}function Al(e,t){if(t)return e.find(e=>e.id===t)}var Ol="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z";function zl(e,t,i){return[e[0]*t+e[1]*i+e[2],e[3]*t+e[4]*i+e[5]]}function Pl(e,t){let i=0;for(const[n,r]of t){const t=zl(e,n[0],n[1]);i=Math.max(i,Math.hypot(t[0]-r[0],t[1]-r[1]))}return i}const Fl=e=>{if(null==e||""===e)return null;const t=Number(e);return Number.isFinite(t)?t:null},Il=e=>{const t=e,i=Fl(Array.isArray(t)?t[0]:t?.x),n=Fl(Array.isArray(t)?t[1]:t?.y);return null==i||null==n?null:[i,n]};function El(e){if(!Array.isArray(e))return null;const t=[];for(const i of e){const e=Il(i);if(!e)return null;t.push(e)}if(t.length>1){const e=t[0],i=t[t.length-1];e[0]===i[0]&&e[1]===i[1]&&t.pop()}if(t.length<3)return null;let i=0,n=0,r=0;for(let e=0;e<t.length;e++){const o=t[e],s=t[(e+1)%t.length],a=o[0]*s[1]-s[0]*o[1];i+=a,n+=(o[0]+s[0])*a,r+=(o[1]+s[1])*a}return Math.abs(i)<1e-12?[t.reduce((e,t)=>e+t[0],0)/t.length,t.reduce((e,t)=>e+t[1],0)/t.length]:[n/(3*i),r/(3*i)]}function Nl(e){if(!Array.isArray(e))return null;const t=[];for(const i of e){const e=Il(i);if(!e)return null;t.push(e)}if(t.length>1){const e=t[0],i=t[t.length-1];e[0]===i[0]&&e[1]===i[1]&&t.pop()}const i=El(t);if(!i)return null;const n=t.map(e=>e[0]),r=t.map(e=>e[1]);return{centroid:i,bbox:[Math.min(...n),Math.min(...r),Math.max(...n),Math.max(...r)]}}function Hl(e){let t=e;if(t&&"object"==typeof t&&!Array.isArray(t)){const e=t;t=e.path??e.points??t}if(!Array.isArray(t)||!t.length)return[];let i=(t.some(e=>(e=>Array.isArray(e)?e.length>=2&&!Array.isArray(e[0])&&("object"!=typeof e[0]||null==e[0]):!!e&&"object"==typeof e&&("x"in e||"y"in e))(e))?[t]:t.filter(Array.isArray)).map(e=>e.map(Il).filter(e=>null!=e)).filter(e=>e.length>=2);i.length>64&&(i=i.slice(-64));const n=i.reduce((e,t)=>e+t.length,0);if(n<=4e3)return i.map(e=>e.slice());const r=4e3-2*i.length,o=i.map(e=>e.length-2),s=o.reduce((e,t)=>e+t,0),a=o.map(e=>r*e/s),l=a.map(Math.floor);let c=r-l.reduce((e,t)=>e+t,0);const h=a.map((e,t)=>({index:t,fraction:e-Math.floor(e)})).sort((e,t)=>t.fraction-e.fraction||e.index-t.index);for(let e=0;e<c;e++)l[h[e].index]++;return i.map((e,t)=>function(e,t){if(t>=e.length)return e.slice();if(t<=2)return[e[0],e[e.length-1]];const i=[];for(let n=0;n<t;n++){const r=Math.round(n*(e.length-1)/(t-1));i.push(e[r])}return i}(e,2+l[t]))}function Ll(e,t,i){const n=Hl(e&&"object"==typeof e&&!Array.isArray(e)&&"path"in e?e.path:e);if(n.length)return{path:n,source:"integration"};const r=Hl(t&&"object"==typeof t&&!Array.isArray(t)&&"points"in t?t.points:t);if(r.length)return{path:r,source:"server"};const o=Hl(i);return o.length?{path:o,source:"local"}:{path:[],source:"none"}}function ql(e){const t=e.map(e=>e.slice()),i=t[t.length-1];return i?(i.length>2?i.pop():t.pop(),t):[]}function jl(e,t){return"default"!==e?e:null!=t?String(t):"default"}function Bl(e){if(!e)return null;const t=e.vacuum_position||e.robot_position||null,i=t&&null!=Fl(t.x)&&null!=Fl(t.y)?{x:Fl(t.x),y:Fl(t.y),a:Fl(t.a??t.angle??t.theta)}:null,n=Hl(e.path?.path??e.path?.points??e.path),r=[],o=e.rooms,s=Array.isArray(o)?o.map((e,t)=>[String(e?.id??t),e]):o&&"object"==typeof o?Object.entries(o):[];for(const[e,t]of s){if(!t||"object"!=typeof t)continue;const i=String(t.name??t.label??"").trim(),n=[[Fl(t.cx),Fl(t.cy)],[Fl(t.center?.x),Fl(t.center?.y)],[Fl(t.x),Fl(t.y)]].find(([e,t])=>null!=e&&null!=t);let o=n?.[0]??null,s=n?.[1]??null;const a=Nl(t.outline),l=Fl(t.x0),c=Fl(t.y0),h=Fl(t.x1),d=Fl(t.y1),u=(null!=l&&null!=c&&null!=h&&null!=d?[Math.min(l,h),Math.min(c,d),Math.max(l,h),Math.max(c,d)]:null)||a?.bbox||null;if(null!=o&&null!=s||!a||([o,s]=a.centroid),null!=o&&null!=s||!u||(o=(u[0]+u[2])/2,s=(u[1]+u[3])/2),i&&null!=o&&null!=s){const t={id:e,name:i,cx:o,cy:s};u&&([t.x0,t.y0,t.x1,t.y1]=u),r.push(t)}}const a=function(e){return String(e.map_name??e.current_map??e.map_index??e.selected_map??"default")}(e);return i||r.length||n.length?{pos:i,path:n,rooms:r,mapId:a}:null}function Wl(e,t,i){return![e,t,i].every(Number.isFinite)||e<0||t<=0||i<=0?Number.POSITIVE_INFINITY:e/t*i}const Ul=40;function Gl(e,t,i){if(!e||!t)return null;const n=t.attributes||{},r=e.split(".")[0]||"",o=null!=i?.platform?String(i.platform):null,s=!!Il(n.vacuum_position??n.robot_position),a=!(!n.rooms||"object"!=typeof n.rooms),l=Hl(n.path?.path??n.path?.points??n.path).length>0,c=[n.map_name,n.current_map,n.map_index,n.selected_map].some(e=>null!=e),h="xiaomi_cloud_map_extractor"===o,d=a||l||c;let u=null;if(s?u="compatible":h?u="known_xcme_incomplete":d?u="partial":"camera"===r&&(u="camera"),!u)return null;const p=s?"camera"===r?300:200:h?100:d?50:0;return{entityId:e,name:String(n.friendly_name||e),platform:o,category:u,hasPosition:s,hasRooms:a,hasPath:l,hasMapId:c,score:p}}const Vl=e=>e.toLowerCase().replace(/[\s_\-.,]+/g,"");function Kl(e,t){const i=new Set(t.map(Vl).filter(Boolean)),n=new Set;for(const t of e){const e=Vl(t.name||"");e&&i.has(e)&&n.add(e)}return n.size}function Yl(e,t){const i=new Map(t.map(e=>[Vl(e.name),e])),n=[],r=[];for(const t of e){const e=i.get(Vl(t.name));e&&(n.push([[t.cx,t.cy],[e.cx,e.cy]]),r.push(t.name))}if(n.length<3)return null;const o=function(e){if(e.length<3)return null;let t=0,i=0,n=0,r=0,o=0,s=0,a=0,l=0,c=0,h=0,d=0,u=0;for(const[[p,_],[m,g]]of e){if(![p,_,m,g].every(Number.isFinite))return null;t+=p*p,i+=p*_,n+=p,r+=_*_,o+=_,s+=1,a+=p*m,l+=_*m,c+=m,h+=p*g,d+=_*g,u+=g}const p=[t,i,n,i,r,o,n,o,s],_=e=>{const[t,i,n,r,o,s,a,l,c]=p,h=t*(o*c-s*l)-i*(r*c-s*a)+n*(r*l-o*a);if(!Number.isFinite(h)||Math.abs(h)<1e-9)return null;const d=[(o*c-s*l)/h,(n*l-i*c)/h,(i*s-n*o)/h,(s*a-r*c)/h,(t*c-n*a)/h,(n*r-t*s)/h,(r*l-o*a)/h,(i*a-t*l)/h,(t*o-i*r)/h];return[d[0]*e[0]+d[1]*e[1]+d[2]*e[2],d[3]*e[0]+d[4]*e[1]+d[5]*e[2],d[6]*e[0]+d[7]*e[1]+d[8]*e[2]]},m=_([a,l,c]),g=_([h,d,u]);if(!m||!g)return null;const f=[m[0],m[1],m[2],g[0],g[1],g[2]];return f.every(Number.isFinite)?f:null}(n);return o?{matrix:o,matched:r,residual:Pl(o,n)}:null}function Zl(e,t,i){const n=e[e.length-1];if(n&&n[0]===t[0]&&n[1]===t[1])return e;if(e.push(t),e.length<=600)return e;let r=function(e,t){if(e.length<3)return e.slice();const i=new Uint8Array(e.length);i[0]=i[e.length-1]=1;const n=[[0,e.length-1]];for(;n.length;){const[r,o]=n.pop(),[s,a]=e[r],[l,c]=e[o],h=l-s,d=c-a,u=Math.hypot(h,d)||1e-9;let p=0,_=-1;for(let t=r+1;t<o;t++){const i=Math.abs((e[t][0]-s)*d-(e[t][1]-a)*h)/u;i>p&&(p=i,_=t)}_>0&&p>t&&(i[_]=1,n.push([r,_],[_,o]))}const r=[];for(let t=0;t<e.length;t++)i[t]&&r.push(e[t]);return r}(e,i);return r.length>600&&(r=r.filter((e,t)=>t%2==0||t===r.length-1)),r}function Xl(e){return"cleaning"===e||"returning"===e||"on"===e}const Jl={0:[1,0],90:[0,1],180:[-1,0],270:[0,-1]};function Ql(e){const[t,i]=Jl[e.rot]||[1,0],n=e.mir?-1:1;return[e.s*t*n,-e.s*i,e.ox,e.s*i*n,e.s*t,e.oy]}function ec(e){const t=e[0]*e[4]-e[1]*e[3];if(!Number.isFinite(t)||Math.abs(t)<1e-12)return null;const i=t<0,n=Math.sqrt(Math.abs(t));let r=180*Math.atan2(-e[1],e[4])/Math.PI;return r=(90*Math.round(r/90)%360+360)%360,{ox:e[2],oy:e[5],s:n,rot:r,mir:i}}function tc(e,t){const i=[],n=[];for(const t of e)null!=t.x0?(i.push(t.x0,t.x1),n.push(t.y0,t.y1)):(i.push(t.cx),n.push(t.cy));if(!i.length)return{ox:t[0]+t[2]/2,oy:t[1]+t[3]/2,s:t[2]/1e4,rot:0,mir:!0};const r=Math.min(...i),o=Math.max(...i),s=Math.min(...n),a=Math.max(...n),l=Math.max(o-r,a-s)||1,c={ox:0,oy:0,s:.6*Math.min(t[2],t[3])/l,rot:0,mir:!0},h=Ql(c),[d,u]=zl(h,(r+o)/2,(s+a)/2);return c.ox=t[0]+t[2]/2-d,c.oy=t[1]+t[3]/2-u,c}function ic(e,t,i,n){const[r,o]=zl(Ql(t),i,n),s=Ql({...e,ox:0,oy:0}),[a,l]=zl(s,i,n);return{...e,ox:r-a,oy:o-l}}function nc(e){const t=e?.trail_mode;return"never"===t||"cleaning"===t||"always"===t?t:!1===e?.trail?"never":"cleaning"}const rc={availability:"available",status:"alarm",activity:"none"},oc=new Set(["motion","vibration","sound"]),sc=new Set(["occupancy","presence"]),ac=new Set(["door","window","garage_door","opening"]),lc=new Set(["running","power"]),cc=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);const hc=new Set(["running","working","washing","rinsing","spinning","drying","heating","cooling","cleaning","cooking","playing","recording","pumping","irrigating","humidifying","dehumidifying","fan","preheating","defrosting"]),dc=new Set([...hc,"start","started","run","active","in_progress","wash","rinse","spin","dry"]),uc=new Set(["off","idle","paused","standby","docked","finished","complete","completed","stopped","ready","sleeping","stop","end","done","inactive"]),pc=new Set(["heat","cool","heat_cool","auto","dry","fan_only"]),_c=e=>""===e||"unknown"===e||"unavailable"===e||"__missing__"===e,mc=e=>String(e??"").trim().toLowerCase(),gc=e=>mc(e).replace(/[\s-]+/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,""),fc=new Map([["run_state",0],["job_state",0],["operation_state",0],["activity_state",0],["machine_state",1],["running_state",1],["status",2],["device_status",2],["machine_status",2]]),vc=new Set(["wifi","connection","signal","battery"]);function yc(e,t){const i=e?.entities?.[t]||{};if("config"===i.entity_category)return null;const n=String(t||"").split(".").slice(1).join("."),r=[i.translation_key,i.original_name,i.name],o=[...r,n];r.some(e=>mc(e))||o.push(e?.states?.[t]?.attributes?.friendly_name);const s=o.map(gc).filter(Boolean);if(s.some(e=>e.split("_").some(e=>vc.has(e))))return null;let a=null;for(const e of s)for(const[t,i]of fc)(e===t||e.endsWith(`_${t}`))&&(a=null==a?i:Math.min(a,i));return a}const bc=(e,t)=>null!=yc(e,t);function wc(e,t){if(!t.startsWith("switch."))return!1;const i=e?.entities?.[t]||{},n=e?.states?.[t],r=t.slice(7).toLowerCase();if(/(?:^|_)(?:main_)?power$/.test(r))return!0;if([i.translation_key,i.original_name,i.name].map(mc).some(e=>["power","main power","power switch","питание"].includes(e)))return!0;const o=mc(n?.attributes?.friendly_name);return/(?:^|[\s._-])(?:main[\s._-]+)?power$/.test(o)||/(?:^|[\s._-])питание$/.test(o)}function kc(e){for(const t of["hvac_action","action","current_operation","run_state","job_state","operation","activity"]){const i=mc(e?.[t]);if(hc.has(i)||uc.has(i))return i}return""}function xc(e,t){const i=e?.states?.[t],n=i?mc(i.state):"__missing__",r=String(t||"").split(".")[0],o=mc(i?.attributes?.device_class),s={eid:t,state:n,availability:_c(n)?"unavailable":"available",status:"neutral",activity:"none",edge:"none"};if("unavailable"===s.availability)return s;if(function(e,t,i){return"alarm_control_panel"===e?"triggered"===i:"on"===i&&In(e,t)}(r,o,n))return{...s,status:"alarm"};if("binary_sensor"===r)return oc.has(o)?{...s,edge:"rising"}:sc.has(o)?{...s,activity:"on"===n?"presence":"none"}:ac.has(o)?{...s,status:"on"===n?"open":"neutral",edge:"rising"}:"moving"===o?{...s,activity:"on"===n?"transition":"none"}:lc.has(o)&&"on"===n?{...s,status:"working",activity:"running"}:s;if("cover"===r)return{...s,activity:"opening"===n||"closing"===n?"transition":"none",edge:"terminal_transition"};if("lock"===r)return{...s,status:"unlocked"===n||"open"===n?"open":"neutral",activity:"locking"===n||"unlocking"===n?"transition":"none",edge:"terminal_transition"};if("valve"===r)return{...s,status:["open","opening","closing"].includes(n)?"open":"neutral",activity:"opening"===n||"closing"===n?"transition":"none",edge:"terminal_transition"};if("climate"===r){const e=kc(i.attributes),t=Array.isArray(i.attributes?.hvac_modes)?i.attributes.hvac_modes.map(mc):[],r=!uc.has(n)&&(pc.has(n)||hc.has(n)||t.includes(n));return(e?hc.has(e):r)?{...s,status:"working",activity:"running"}:s}if(["light","switch","fan","humidifier"].includes(r))return"on"===n?{...s,status:"working",activity:"running"}:s;if("media_player"===r)return"off"===n?{...s,availability:"unavailable"}:s;if("vacuum"===r)return"cleaning"===n?{...s,status:"working",activity:"running"}:"returning"===n?{...s,status:"working",activity:"transition"}:s;if("script"===r)return"on"===n?{...s,status:"working",activity:"running"}:s;if("automation"===r)return s;if("button"===r||"event"===r)return{...s,edge:"change"};const a=kc(i.attributes);return hc.has(a)||hc.has(n)&&!uc.has(n)?{...s,status:"working",activity:"running"}:s}function $c(e,t,i){const n=i.filter(t=>t.startsWith("switch.")&&!e?.entities?.[t]?.entity_category),r=t.find(t=>wc(e,t));if(!(n.length>1&&!!r))return t.map(t=>xc(e,t));const o=t.find(t=>t!==r&&bc(e,t)),s=xc(e,r);return"unavailable"===s.availability||"off"===s.state?t.map(t=>({eid:t,state:e?.states?.[t]?mc(e.states[t].state):"__missing__",availability:"unavailable",status:"neutral",activity:"none",edge:"none"})):t.map(t=>{if(t===o)return function(e,t){const i=e?.states?.[t],n=i?mc(i.state):"__missing__",r={eid:t,state:n,availability:_c(n)?"unavailable":"available",status:"neutral",activity:"none",edge:"none"};if("unavailable"===r.availability)return r;const o=kc(i?.attributes);return hc.has(o)||dc.has(n)&&!uc.has(n)?{...r,status:"working",activity:"running"}:r}(e,t);return{...t===r?s:xc(e,t),status:"neutral",activity:"none",edge:"none"}})}function Sc(e){if(!e.length)return{availability:"available",status:"neutral",activity:"none"};const t=e.filter(e=>"available"===e.availability);if(!t.length)return{availability:"unavailable",status:"neutral",activity:"none"};if(t.some(e=>"alarm"===e.status))return rc;const i=t.some(e=>"working"===e.status)?"working":t.some(e=>"open"===e.status)?"open":"neutral",n=t.some(e=>"transition"===e.activity)?"transition":t.some(e=>"presence"===e.activity)?"presence":t.some(e=>"running"===e.activity)?"running":"none";return{availability:"available",status:i,activity:n}}function Mc(e,t){if(!(e=>!!e&&!_c(e))(e)||"unavailable"===t.availability||e===t.state)return null;if("rising"===t.edge)return"off"===e&&"on"===t.state?"event":null;if("change"===t.edge)return"event";if("terminal_transition"===t.edge){const i=new Set([e,t.state]);if(i.has("closed")&&i.has("open")||i.has("locked")&&i.has("unlocked"))return"transition"}return null}const Rc=(e,t=0)=>{const i=Number(e);return Number.isInteger(i)&&i>=0?i:t},Tc=(e,t)=>{const i={rev:0,configRev:Rc(t),off:new Set};if(null==e)return{snapshot:i,valid:!1};const n=e.off;return!Number.isInteger(e.rev)||Number(e.rev)<0||!Number.isInteger(e.config_rev)||Number(e.config_rev)<0||!Array.isArray(n)||n.some(e=>"string"!=typeof e||!e)?{snapshot:i,valid:!1}:{snapshot:{rev:Number(e.rev),configRev:Number(e.config_rev),off:new Set(n)},valid:!0}};function Cc(e,t=0){return Tc(e,t).snapshot}function Dc(e,t,i,n){const r=Tc(t,i);return n&&r.valid&&r.snapshot.configRev===i?e.configRev===i&&r.snapshot.rev<e.rev?e:r.snapshot:Cc(null,i)}function Ac(e){return{rev:e.rev,config_rev:e.configRev,off:[...e.off].sort()}}function Oc(e){return e?`${e.configRev}:${e.rev}:${[...e.off].sort().join(",")}`:"0:0:"}function zc(e){return!!e&&"string"==typeof e.id&&!!e.id&&"virtual"===e.binding&&!0===e.is_light&&"toggle"===e.tap_action&&!0!==e.removed}function Pc(e,t){return!zc(e)||!t?.off.has(e.id)}function Fc(e,t){const i="string"==typeof t?.marker_id?t.marker_id:"",n=Rc(t?.rev,-1);if(!i||"boolean"!=typeof t?.on||n<=e.rev)return e;const r=new Set(e.off);return t.on?r.delete(i):r.add(i),{...e,rev:n,off:r}}const Ic=new WeakMap,Ec=new WeakMap;let Nc=1;const Hc="houseplan.ha-binding-status.v1";let Lc=null;function qc(e){const t=function(e){const t=e?.connection||e;return!t||"object"!=typeof t&&"function"!=typeof t?null:t}(e);if(!t)return null;let i=Ic.get(t);return i||(i={revision:0,authoritative:!1,access:"pending",devices:{},entities:{},lastSuccess:0,listeners:new Set,refs:0},Ic.set(t,i)),i}function jc(e,t){const i=Array.isArray(e)?e:e&&"object"==typeof e&&Array.isArray(e.entries)?e.entries:null;if(!i)return null;const n={};for(const e of i){const i=e?.[t];"string"==typeof i&&i&&(n[i]=e)}return n}async function Bc(e,t){return t.loading||!e?.callWS||(t.loading=(async()=>{try{const[i,n]=await Promise.all([e.callWS({type:"config/device_registry/list"}),e.callWS({type:"config/entity_registry/list"})]),r=jc(i,"id"),o=jc(n,"entity_id");if(!r||!o)throw new Error("invalid_registry_response");t.devices=r,t.entities=o,t.authoritative=!0,t.access="full",t.lastSuccess=Date.now(),t.error=void 0}catch(e){t.authoritative=!1,t.access="limited",t.error=function(e){if(e&&"object"==typeof e){const t=e;return String(t.message||t.code||t.error||"registry_unavailable")}return String(e||"registry_unavailable")}(e)}finally{t.revision++,t.loading=void 0,function(e){for(const t of[...e.listeners])try{t()}catch{}}(t)}})()),t.loading}function Wc(e,t){void 0===t.reloadTimer&&(t.reloadTimer=globalThis.setTimeout(()=>{t.reloadTimer=void 0,Bc(e,t)},80))}async function Uc(e,t){if(t.subscribing||t.unsubDevice&&t.unsubEntity)return t.subscribing;const i=e?.connection?.subscribeEvents;return"function"==typeof i?(t.subscribing=(async()=>{try{t.unsubDevice||(t.unsubDevice=await i.call(e.connection,()=>Wc(e,t),"device_registry_updated")),t.unsubEntity||(t.unsubEntity=await i.call(e.connection,()=>Wc(e,t),"entity_registry_updated"))}catch{}finally{0===t.refs&&(t.unsubDevice?.(),t.unsubEntity?.(),t.unsubDevice=void 0,t.unsubEntity=void 0),t.subscribing=void 0}})(),t.subscribing):void 0}function Gc(e,t){const i=qc(e);if(!i)return()=>{};const n=0===i.refs;i.refs++,i.listeners.add(t),("pending"===i.access||n)&&Bc(e,i),Uc(e,i);let r=!1;return()=>{r||(r=!0,i.listeners.delete(t),i.refs=Math.max(0,i.refs-1),i.refs>0||(i.unsubDevice?.(),i.unsubEntity?.(),i.unsubDevice=void 0,i.unsubEntity=void 0,void 0!==i.reloadTimer&&globalThis.clearTimeout(i.reloadTimer),i.reloadTimer=void 0))}}function Vc(e){const t=qc(e);if(!t)return{revision:0,authoritative:!1,access:"limited",devices:e?.devices||{},entities:e?.entities||{},lastSuccess:0,error:"registry_unavailable"};let i=e?.devices||{},n=e?.entities||{};if(t.authoritative){const r=t.liveDevices!==i||t.liveEntities!==n,o=void 0!==t.liveDevices||void 0!==t.liveEntities;if(r&&(t.liveDevices=i,t.liveEntities=n,t.projectedRevision=void 0,o&&Wc(e,t)),t.projectedRevision!==t.revision||!t.projectedDevices||!t.projectedEntities){const e={...t.devices},r={...t.entities};for(const[t,n]of Object.entries(i))Object.prototype.hasOwnProperty.call(e,t)||(e[t]=n);for(const[e,t]of Object.entries(n))Object.prototype.hasOwnProperty.call(r,e)||(r[e]=t);t.projectedDevices=e,t.projectedEntities=r,t.projectedRevision=t.revision}i=t.projectedDevices,n=t.projectedEntities}return{revision:t.revision,authoritative:t.authoritative,access:t.access,devices:i,entities:n,lastSuccess:t.lastSuccess,error:t.error}}function Kc(e){if(!e||"object"!=typeof e&&"function"!=typeof e)return 0;let t=Ec.get(e);return t||(t=Nc++,Ec.set(e,t)),t}function Yc(e,t=Vc(e)){return[t.revision,t.access,Kc(t.devices),Kc(t.entities)].join(":")}function Zc(e){return!!e&&null==e.disabled_by}function Xc(e,t=Vc(e)){const i={},n={},r={};for(const[e,n]of Object.entries(t.devices||{}))Zc(n)&&(i[e]=n);for(const[e,i]of Object.entries(t.entities||{})){if(!Zc(i))continue;const r=i.device_id?t.devices?.[i.device_id]:null;t.authoritative&&i.device_id&&!r||(r&&!Zc(r)||(n[e]=i))}for(const[i,n]of Object.entries(e?.states||{})){const e=t.entities?.[i];if(e&&!Zc(e))continue;const o=e?.device_id?t.devices?.[e.device_id]:null;t.authoritative&&e?.device_id&&!o||(o&&!Zc(o)||(r[i]=n))}return{...e,devices:i,entities:n,states:r}}function Jc(e,t=Vc(e)){return{...e,devices:t.devices||{},entities:t.entities||{}}}function Qc(e,t){const i=[];for(const[n,r]of Object.entries(e||{}))r?.device_id===t&&i.push(n);return i}function eh(){if(Lc)return Lc;if("undefined"==typeof localStorage)return{};try{const e=JSON.parse(localStorage.getItem(Hc)||"{}");if(!e||"object"!=typeof e||Array.isArray(e))return{};const t=Date.now(),i={};for(const[n,r]of Object.entries(e))!r||"active"!==r.kind&&"ha_disabled"!==r.kind||!Number.isFinite(r.ts)||t-r.ts>7776e6||(i[n]=r);return Lc=i,Lc}catch{return{}}}function th(e,t,i=Vc(e)){if(!t||"virtual"===t)return{kind:"active",enabledEntityIds:[],allEntityIds:[]};const n=t.indexOf(":");if(n<1)return{kind:"unverified",reason:"registry_unavailable",enabledEntityIds:[],allEntityIds:[]};const r=t.slice(0,n),o=t.slice(n+1);if("device"!==r&&"entity"!==r||!o)return{kind:"unverified",reason:"registry_unavailable",enabledEntityIds:[],allEntityIds:[]};const s=i.devices||{},a=i.entities||{};if(i.authoritative){if("device"===r){const e=s[o];if(!e)return{kind:"orphaned",reason:"device_missing",enabledEntityIds:[],allEntityIds:[]};const t=Qc(a,o);if(!Zc(e))return{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:t};const i=t.filter(e=>Zc(a[e]));return t.length&&!i.length?{kind:"ha_disabled",reason:"all_entities",enabledEntityIds:[],allEntityIds:t}:{kind:"active",enabledEntityIds:i,allEntityIds:t}}const t=a[o];return t&&!Zc(t)?{kind:"ha_disabled",reason:"entity",enabledEntityIds:[],allEntityIds:[o]}:t?.device_id&&!s[t.device_id]?{kind:"orphaned",reason:"device_missing",enabledEntityIds:[],allEntityIds:[o]}:t?.device_id&&!Zc(s[t.device_id])?{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:[o]}:t||e?.states?.[o]?{kind:"active",enabledEntityIds:[o],allEntityIds:[o]}:{kind:"orphaned",reason:"entity_missing",enabledEntityIds:[],allEntityIds:[]}}const l=function(e){return eh()[e]||null}(t);if("device"===r){const t=s[o],i=Qc(a,o);if(null!=t?.disabled_by)return{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:i};const n=i.filter(e=>{const t=a[e];return null==t?.disabled_by&&(!t.device_id||null==s[t.device_id]?.disabled_by)});if(i.length&&!n.length&&i.every(e=>null!=a[e]?.disabled_by))return{kind:"ha_disabled",reason:"all_entities",enabledEntityIds:[],allEntityIds:i};if("ha_disabled"===l?.kind)return{kind:"ha_disabled",reason:l.reason||"device",enabledEntityIds:[],allEntityIds:i};if(t||n.some(t=>!!e?.states?.[t]))return{kind:"active",enabledEntityIds:n,allEntityIds:i}}else{const t=a[o];if(null!=t?.disabled_by)return{kind:"ha_disabled",reason:"entity",enabledEntityIds:[],allEntityIds:[o]};if(t?.device_id&&null!=s[t.device_id]?.disabled_by)return{kind:"ha_disabled",reason:"device",enabledEntityIds:[],allEntityIds:[o]};if("ha_disabled"===l?.kind)return{kind:"ha_disabled",reason:l.reason||"entity",enabledEntityIds:[],allEntityIds:[o]};if(t||e?.states?.[o])return{kind:"active",enabledEntityIds:[o],allEntityIds:[o]}}return{kind:"unverified",reason:"registry_unavailable",enabledEntityIds:[],allEntityIds:[]}}function ih(e){const t={};for(const[i,n]of Object.entries(e.entities)){if(!n?.device_id||!Zc(n))continue;const r=e.devices?.[n.device_id];r&&!Zc(r)||(t[n.device_id]=t[n.device_id]||[]).push(i)}return t}function nh(e,t){const i=new Map;for(const n of e){if(!0===n?.removed)continue;const e=n?.binding||"";if(!e.startsWith("entity:"))continue;const r=e.slice(7);if(!r)continue;const o=t?.entities?.[r]?.device_id;if(!o)continue;const s=i.get(o)||new Set;s.add(r),i.set(o,s)}return{byDevice:i}}function rh(e,t,i,n){const r=n.byDevice.get(t);return r?.size?{partial:!0,entityIds:i.filter(t=>!r.has(t)&&!e?.entities?.[t]?.hidden)}:{partial:!1,entityIds:[...i]}}function oh(e,t,i){if(t.identifiers?.[0]?.[0])return t.identifiers[0][0];for(const t of i){const i=e.entities[t]?.platform;if(i)return i}return""}function sh(e,t){if(/_device_temperature$/.test(t))return!1;if(e.entities?.[t]?.entity_category)return!1;const i=e.states[t];if(!i)return/_temperature$/.test(t);const n=i.attributes||{};return"temperature"===n.device_class||/°C|°F/.test(n.unit_of_measurement||"")||/_temperature$/.test(t)}const ah=["vacuum","lawn_mower","climate","media_player","light","cover","lock","valve","alarm_control_panel","water_heater","fan","humidifier","siren","camera","remote"],lh=e=>[...e.filter(e=>!e.reg?.hidden),...e.filter(e=>!!e.reg?.hidden)];function ch(e,t){const i=t.map(t=>({eid:t,reg:e?.entities?.[t]})).filter(e=>!!e.reg);if(!i.length)return[];const n=i.filter(e=>!e.reg.entity_category),r=n.length?n:i;for(const e of ah){const t=r.filter(t=>t.eid.startsWith(e+"."));if(t.length)return lh(t).map(e=>e.eid)}const o=r.filter(t=>function(e,t){if(!t.startsWith("binary_sensor."))return!1;const i=mc(e?.states?.[t]?.attributes?.device_class||e?.entities?.[t]?.device_class||e?.entities?.[t]?.original_device_class);return oc.has(i)||sc.has(i)||ac.has(i)||lc.has(i)||"moving"===i||cc.has(i)}(e,t.eid));if(o.length)return lh(o).map(e=>e.eid);const s=r.filter(e=>e.eid.startsWith("switch."));if(s.length){const t=lh(s),n=t.find(t=>wc(e,t.eid));if(s.length>1&&n){const t=i.filter(t=>t.eid!==n.eid&&"config"!==t.reg?.entity_category&&null!=yc(e,t.eid)),r=t.filter(e=>!e.reg?.entity_category),o=r.length?r:t;for(const t of[0,1,2]){const i=lh(o.filter(i=>yc(e,i.eid)===t));if(i.length)return[i[0].eid,n.eid]}}return[(n||t[0]).eid]}const a=[];for(const e of Ie)a.push(...lh(r.filter(t=>t.eid.startsWith(e+"."))));return a.push(...lh(r.filter(e=>!Ie.includes(e.eid.split(".")[0])))),a.map(e=>e.eid)}function hh(e,t,i){const n=t.map(t=>({eid:t,reg:e.entities[t],st:e.states[t]})).filter(e=>e.reg),r=[n.filter(e=>!e.reg.hidden&&!e.reg.entity_category),n.filter(e=>!e.reg.entity_category),n.filter(e=>!e.reg.hidden),n];if("mdi:thermometer"===i||"mdi:air-filter"===i)for(const t of r){const i=t.find(t=>sh(e,t.eid));if(i)return i.eid}const o=ch(e,t);return o.find(yn)||o[0]}function dh(e,t,i=[]){return[...new Set(uh(e,t,i))].filter(e=>yn(e))}function uh(e,t,i=[]){const n=e?.startsWith("entity:")?new Set([e.slice(7)]):new Set(i);return(t||[]).filter(e=>"string"==typeof e&&!n.has(e))}function ph(e,t){if("string"==typeof t)return e.area===t;const i=e.marker?.room_id;return i?!!t.id&&i===t.id:!!t.area&&e.area===t.area}function _h(e){const t=e.marker?.binding?.startsWith("entity:")?e.marker.binding.slice(7):null,i=e.entities.filter(yn),n=e.primary&&yn(e.primary)?e.primary:null;return[...new Set([t,n,...i].filter(e=>!!e&&yn(e)))]}function mh(e){const t=_h(e),i=e.marker?.light_entity;return i&&t.includes(i)?i:t[0]||null}function gh(e,t){if(!1===t.marker?.is_light)return[];if(!0===t.marker?.is_light){return[{eid:mh(t),via:"forced"}]}const i=t.primary||ch(e,t.entities)[0];return i&&!i.startsWith("light.")?[]:t.entities.filter(t=>t.startsWith("light.")&&!!e.states?.[t]).map(e=>({eid:e,via:"light"}))}const fh=new WeakMap,vh=new WeakMap;function yh(e){return e.map(e=>[e.id||"",!0===e.hidden?1:0,e.primary||"",[...e.entities].join(","),void 0===e.controls?"<runtime-undefined>":[...e.controls].join(","),e.marker?.id||"",e.marker?.binding||"",e.marker?.is_light,e.marker?.tap_action||"",!0===e.marker?.removed?1:0,e.marker?.light_entity||"",null==e.marker?.controls?"<persisted-null>":[...e.marker.controls].join(",")].join("")).join("")}function bh(e){const t=yh(e),i=fh.get(e);if(i?.fingerprint===t)return i;const n=e.filter(e=>!e.hidden),r=new Map,o=new Map;for(const t of e){o.set(t,uh(t.marker?.binding,t.marker?.controls??t.controls,t.entities));const e=t.hidden||!0!==t.marker?.is_light?null:t.marker?.id||t.id;e&&r.set(String(e),t)}const s=new Map;for(const t of e){const e=o.get(t)||[],i=new Set(void 0===t.controls?e.filter(yn):t.controls.filter(yn)),n=mh(t),a=i.size?[...i]:n?[n]:[];for(const i of e){if(!i.startsWith("marker:"))continue;const e=i.slice(7);if(!e||e===String(t.marker?.id||t.id||""))continue;if(!r.has(e))continue;const n=s.get(e)||{markerId:e,controllers:[],driverEids:[]};n.controllers.push({device:t,driverEids:[...a]}),n.driverEids=[...new Set([...n.driverEids,...a])],s.set(e,n)}}const a={fingerprint:t,visible:n,markerById:r,persistedByDevice:o,incomingByMarker:s};return fh.set(e,a),a}function wh(e){return bh(e).incomingByMarker}function kh(e,t){const i=dh(t.marker?.binding,t.controls??t.marker?.controls,t.entities),n=uh(t.marker?.binding,t.marker?.controls??t.controls,t.entities);return(null!=t.marker?.is_light||!i.length&&!n.some(e=>e.startsWith("marker:")))&&gh(e,t).length>0}function xh(e,t){return gh(e,t).some(e=>!!e.eid)}function $h(e,t,i,n){const r="always"===e||"auto"===e&&t,o=r&&!i;return{sourceExists:r,fromSourceEnabled:r&&i,manualEnabled:r,radiusEnabled:r,passive:o,effectiveMode:o&&"auto"===n?"fixed":n}}function Sh(e,t){const i=dh(t.marker?.binding,t.controls??t.marker?.controls,t.entities).map(e=>({eid:e,via:"controls"})),n=kh(e,t)?gh(e,t):[];for(const e of n)e.eid&&i.some(t=>t.eid===e.eid)||i.push(e);return i}function Mh(e,t,i,n){if(null!=i)return Mh(e,t,null,n).filter(e=>ph(e.device,i));const r=yh(t),o=function(e,t){const i=new Set;for(const e of t){for(const t of e.entities)i.add(t);for(const t of e.controls||e.marker?.controls||[])"string"!=typeof t||t.startsWith("marker:")||i.add(t)}return[...i].sort().map(t=>`${t}:${e?.states?.[t]?.state??"<missing>"}`).join("|")}(e,t),s=Oc(n),a=vh.get(t);if(a?.graphFingerprint===r&&a.stateFingerprint===o&&a.virtualLightFingerprint===s&&a.registry===e?.entities)return a.sources;const{visible:l,markerById:c,persistedByDevice:h,incomingByMarker:d}=bh(t),u=null==i?l:l.filter(e=>ph(e,i)),p=new Map,_=new Map;for(const t of u){const i=Sh(e,t).filter(e=>"controls"!==e.via);for(const n of i){const i=!0===t.marker?.is_light?String(t.marker?.id||t.id||""):"",r=i?`marker:${i}`:`entity:${n.eid}`,o=n.eid?[n.eid]:[],s={key:r,eid:n.eid||"",stateEids:o,serviceEids:o,device:t,via:n.via,castsGlow:!0,passive:!n.eid,on:!n.eid||"on"===e.states?.[n.eid]?.state};p.set(t,[...p.get(t)||[],s]),n.eid&&_.set(n.eid,s)}}const m=new Map;for(const e of t){const t=h.get(e)||[],i=new Set(void 0===e.controls?t.filter(yn):e.controls);m.set(e,i)}for(const t of p.values())for(const i of t){if(!i.passive)continue;const t=i.key.slice(7),r=d.get(t);i.on=!r||r.driverEids.some(t=>"on"===e.states?.[t]?.state),!r&&zc(i.device.marker)&&(i.on=Pc(i.device.marker,n))}const g=new Map,f=e=>{const t=g.get(e.key);(!t||e.castsGlow&&!t.castsGlow)&&g.set(e.key,e)};for(const t of l){const n=h.get(t)||[],r=null==i||ph(t,i);for(const i of n){if(i.startsWith("marker:")){const e=c.get(i.slice(7)),t=e?p.get(e):null;if(t)for(const e of t)f(e);continue}if(!yn(i)||!m.get(t)?.has(i))continue;const n=_.get(i);n?f(n):r&&f({key:`entity:${i}`,eid:i,stateEids:[i],serviceEids:[i],device:t,via:"controls",castsGlow:!1,passive:!1,on:"on"===e.states?.[i]?.state})}for(const e of p.get(t)||[])f(e)}const v=[...g.values()];return vh.set(t,{graphFingerprint:r,stateFingerprint:o,virtualLightFingerprint:s,registry:e?.entities,sources:v}),v}function Rh(e){const t=e.filter(e=>e.castsGlow);return t.find(e=>e.on)||t[0]||null}function Th(e){return e.length?e.some(e=>e.on)?"on":"off":"none"}function Ch(e,t){const i=[];for(const n of t){const t=e.states[n];if(!t)continue;const r=(t.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(n)||"lqi"===r){const e=parseFloat(t.state);isNaN(e)||i.push(e);continue}const o=t.attributes?.linkquality??t.attributes?.lqi;if(null!=o){const e=parseFloat(o);isNaN(e)||i.push(e)}}return Mi(i)}function Dh(e,t){for(const i of t){if(!sh(e,i))continue;const t=e.states[i];if(!t)continue;const n=parseFloat(t.state);if(!isNaN(n))return Math.round(10*n)/10}return null}function Ah(e,t){for(const i of t){if(!i.startsWith("climate."))continue;const t=e.states[i];if(!t||"unavailable"===t.state||"unknown"===t.state)continue;const n=parseFloat(t.attributes?.current_temperature);if(Number.isFinite(n))return Math.round(10*n)/10}return null}function Oh(e,t){if(e.entities?.[t]?.entity_category)return!1;const i=e.states[t];if(!i)return/_humidity$/.test(t);const n=i.attributes||{};return"humidity"===n.device_class||"%"===n.unit_of_measurement&&/_humidity$/.test(t)||/_humidity$/.test(t)}function zh(e,t){for(const i of t){if(!Oh(e,i))continue;const t=e.states[i];if(!t)continue;const n=parseFloat(t.state);if(!isNaN(n))return Math.round(n)}return null}function Ph(e,t){if(!t)return[];const i=[];for(const[t,n]of Object.entries(e.entities)){if(!t.startsWith("light.")||n.hidden||!Zc(n))continue;let r=null;if("group"===n.platform)r=n.area_id||null;else{if(!n.device_id)continue;{const t=e.devices[n.device_id];if(!Zc(t))continue;if("Group"!==t?.model)continue;r=t.area_id||n.area_id||null}}if(!r)continue;const o=e.states[t];i.push({eid:t,name:n.name||o?.attributes?.friendly_name||t,area:r})}return i}function Fh(e,t,i,n,r){const o=Fe(t,i,r);if(o!==Pe)return o;const s=[];for(const t of n){const i=e.states[t]?.attributes?.device_class;i&&s.push(i)}return function(e){for(const t of e){const e=ze[t];if(e)return e}return null}(s)??Pe}function Ih(e,t){return e.map(e=>{if(!Array.isArray(e.controls))return e;const i=e.controls.filter(e=>!("string"==typeof e&&e.startsWith("marker:")&&t.has(e.slice(7))));return i.length===e.controls.length?e:{...e,controls:i.length?i:null}})}function Eh(e,t,i){if(!t||!i||t===i)return[...e];const n=`marker:${t}`,r=`marker:${i}`;return e.map(e=>{const t=Array.isArray(e.controls)?e.controls.map(e=>e===n?r:e):e.controls,i="derived_marker_state"===e.value_badge?.source?.kind&&e.value_badge.source.ref===n?{...e.value_badge,source:{...e.value_badge.source,ref:r}}:e.value_badge;return t===e.controls&&i===e.value_badge?e:{...e,controls:t,value_badge:i}})}function Nh(e,t,i){if(!t||t===i)return!0;const n=new Map;for(const t of e)n.set(t.id,(t.controls||[]).filter(e=>"string"==typeof e&&e.startsWith("marker:")).map(e=>e.slice(7)));const r=new Set,o=[i];for(;o.length;){const e=o.pop();if(e===t)return!0;r.has(e)||(r.add(e),o.push(...n.get(e)||[]))}return!1}function Hh(e,t,i,n){const r=new Set([t]),o=e.filter(e=>{const o=e.id===t||!n&&e.binding===i;return o&&r.add(e.id),!o});return{markers:n?o:[...o,{id:t,binding:i,removed:!0,hidden:!0}],cleanupIds:r}}function Lh(e){const t=new Set,i=new Set,n=new Set;for(const r of e||[]){const e=String(r.binding||"").indexOf(":");if(e<1)continue;const o=r.binding.slice(0,e),s=r.binding.slice(e+1);s&&(!0===r?.removed?"device"===o?t.add(s):"entity"===o&&i.add(s):"entity"===o&&n.add(s))}return{devices:t,entities:i,liveEntities:n}}function qh(e,t,i){if(i.liveEntities.has(t))return!1;if(i.entities.has(t))return!0;const n=e?.entities?.[t]?.device_id;return!!n&&i.devices.has(n)}function jh(e,t,i,n,r){const o=dh(t.binding,t.controls,e.entities).filter(e=>!qh(i,e,n)).filter(e=>"active"===th(i,"entity:"+e,r).kind);e.marker=t,e.controls=o,e.userHidden=!0===t.hidden,e.hidden=e.userHidden||"ha_disabled"===e.bindingStatus?.kind,t.name&&(e.name=t.name),t.icon&&(e.icon=t.icon),null!=t.model&&(e.model=t.model),e.link=t.link??null,e.description=t.description??null,e.pdfs=t.pdfs||[],e.tapAction=t.tap_action??null}function Bh(e,t,i,n){if("string"==typeof e.room_id&&e.room_id.length>0&&null===e.area)return{area:"",space:e.space||n};const r=e.area||t||"";return{area:r,space:r&&i[r]||e.space||n}}function Wh(e){const t=e.hass,i=e.registry||Vc(t),n=Xc(t,i),r=Jc(t,i),{areaToSpace:o,markers:s,settings:a,excluded:l,showAll:c,firstSpaceId:h,loc:d,iconRules:u}=e,p=!1!==a.group_lights,_=Lh(s),m=Ph(n,p).filter(e=>!qh(n,e.eid,_)),g=new Set(m.map(e=>e.area)),f=ih(n),v=function(e){const t={};for(const[i,n]of Object.entries(e.entities||{}))n?.device_id&&(t[n.device_id]=t[n.device_id]||[]).push(i);return t}(r),y=nh(s,r),b=new Set;for(const e of s){const[t,i]=e.binding.split(":");"device"!==t&&"entity"!==t||!i||b.add(e.binding)}const w=(e,t)=>s.find(i=>i.binding===e+":"+t),k={},x=[];for(const e of Object.values(n.devices)){const r=e.area_id;if(!r||!o[r])continue;if("service"===e.entry_type)continue;if(b.has("device:"+e.id))continue;const s=th(t,"device:"+e.id,i);if("active"!==s.kind)continue;const h=w("device",e.id);if(h&&h.hidden&&!a.filter_seeded)continue;const _=rh(n,e.id,f[e.id]||[],y);if(_.partial&&!_.entityIds.length)continue;const m=_.entityIds,v=_.partial?{kind:"active",enabledEntityIds:m,allEntityIds:m}:s,$=oh(n,e,m),S=!a.filter_seeded;if(S&&!c){if(l.has($))continue;if("Group"===e.model)continue;if(/scene/i.test(e.model||""))continue;if(/bridge/i.test((e.model||"")+(e.name||"")))continue;if("myheat"===$&&e.via_device_id)continue}const M=(e.name_by_user||e.name||d("device.unnamed")).trim(),R=M+"|"+r;let T=Fh(n,M,e.model,m,u);if(m.some(e=>e.startsWith("lock."))&&(T="mdi:lock"),S&&!c&&p&&"mdi:lightbulb"===T&&g.has(r))continue;k[R]=(k[R]||0)+1;const C=k[R]>1?M+" "+k[R]:M,D={id:e.id,name:C,model:e.model||"",area:r,space:o[r],icon:T,entities:m,allEntities:v.allEntityIds,bindingStatus:v,bindingKind:"device",bindingRef:e.id,pdfs:[]};D.primary=hh(n,m,T),"mdi:thermometer"!==T&&"mdi:air-filter"!==T||(D.temp=Dh(n,m)),D.primary&&Oh(n,D.primary)&&(D.hum=zh(n,m)),x.push(D)}for(const e of m)o[e.area]&&(b.has("entity:"+e.eid)||x.push({id:"lg_"+e.eid,name:e.name,model:d("device.light_group"),area:e.area,space:o[e.area],icon:"mdi:lightbulb-group",entities:[e.eid],allEntities:[e.eid],bindingStatus:{kind:"active",enabledEntityIds:[e.eid],allEntityIds:[e.eid]},primary:e.eid,bindingKind:"entity",bindingRef:e.eid,pdfs:[]}));for(const e of s){if(e.removed)continue;const[s,l]=e.binding.split(":"),c="device"===s||"entity"===s?th(t,e.binding,i):null;if(!e.hidden||a.filter_seeded||"ha_disabled"===c?.kind)if("device"===s){const t=c;if("unverified"===t.kind)continue;const s=r.devices[l],{area:a,space:p}=Bh(e,s?.area_id,o,h),m="active"===t.kind?t.enabledEntityIds:[];let g=s?Fh(n,s.name_by_user||s.name||"",s.model,m,u):"mdi:help-circle";m.some(e=>e.startsWith("lock."))&&(g="mdi:lock");const f={id:e.id,name:s?.name_by_user||s?.name||d("device.fallback"),model:s?.model||"",area:a,space:p,icon:g,entities:m,allEntities:t.allEntityIds.length?t.allEntityIds:s&&v[s.id]||[],bindingStatus:t,bindingKind:"device",bindingRef:l};f.primary=hh(n,m,g),"mdi:thermometer"!==g&&"mdi:air-filter"!==g||(f.temp=Dh(n,m)),f.primary&&Oh(n,f.primary)&&(f.hum=zh(n,m)),jh(f,e,r,_,i),x.push(f)}else if("entity"===s){if(qh(r,l,_))continue;const t=c;if("unverified"===t.kind)continue;const s=r.entities[l],a=s?.area_id||s?.device_id&&r.devices[s.device_id]?.area_id||"",{area:d,space:p}=Bh(e,a,o,h),m=n.states[l],g=s?.name||m?.attributes?.friendly_name||l;let f=Fh(n,g,"",[l],u);l.startsWith("lock.")&&(f="mdi:lock");const v={id:e.id,name:g,model:"",area:d,space:p,icon:f,entities:"active"===t.kind?[l]:[],allEntities:[l],bindingStatus:t,primary:"active"===t.kind?l:void 0,bindingKind:"entity",bindingRef:l};"mdi:thermometer"!==f&&"mdi:air-filter"!==f||!v.entities.length||(v.temp=Dh(n,v.entities)),v.entities.length&&Oh(n,l)&&(v.hum=zh(n,v.entities)),jh(v,e,r,_,i),x.push(v)}else{const t=e.area||"",n=e.space||t&&o[t]||h,s={id:e.id,name:e.name||d("device.virtual"),model:e.model||"",area:t,space:n,icon:e.icon||"mdi:map-marker",entities:[],allEntities:[],bindingStatus:{kind:"active",enabledEntityIds:[],allEntityIds:[]},bindingKind:"virtual",virtual:!0};jh(s,e,r,_,i),x.push(s)}}return x}function Uh(e){const{marker:t,siblingMarkers:i=[],...n}=e;return Wh({...n,markers:[...i.filter(e=>e.id!==t.id),t]}).find(e=>e.id===t.id)||null}function Gh(e,t,i,n){if(!t)return null;if(function(e,t,i){if(!t)return!1;const n=t.indexOf(":");if(n<1)return!1;const r=t.slice(0,n),o=t.slice(n+1),s=Lh(i);return"device"===r?s.devices.has(o):"entity"===r&&qh(e,o,s)}(e,t,n))return null;const r=t.indexOf(":");if(r<0)return null;const o=t.slice(0,r),s=t.slice(r+1);if(!s)return null;if("entity"===o){const t=parseFloat(e.states[s]?.state);return Number.isFinite(t)?"temp"===i?Math.round(10*t)/10:Math.round(t):null}if("device"===o){const t=Object.entries(e.entities).filter(([,e])=>e.device_id===s).map(([e])=>e);return"temp"===i?Dh(e,t):zh(e,t)}return null}const Vh=new RegExp(["water","voda","coolant","flow_?temp","return_?temp","target","setpoint","chip","cpu","processor","board","core_temp","device_temp","batter","akkum","freezer","fridge","oven","kettle","boiler"].join("|"),"i");function Kh(e,t,i){const n=[];for(const r of t){if(r.area!==i||r.virtual)continue;const t=Ch(e,r.entities);null!=t&&n.push(t)}return Mi(n)}function Yh(e,t,i){const n=[];for(const r of t){if(r.area!==i)continue;if("mdi:thermometer"!==r.icon&&"mdi:air-filter"!==r.icon)continue;const t=Dh(e,r.entities);null!=t&&n.push(t)}return n.length?Math.round(n.reduce((e,t)=>e+t,0)/n.length*10)/10:null}const Zh={offStates:["off"],unknownUsesToggle:!0},Xh={light:Zh,switch:Zh,fan:Zh,humidifier:Zh,input_boolean:Zh,automation:Zh,remote:Zh,group:Zh,climate:{...Zh,featureMasks:{turn_on:256,turn_off:128,toggle:384}},media_player:{...Zh,featureMasks:{turn_on:128,turn_off:256,toggle:384}},siren:{...Zh,featureMasks:{turn_on:1,turn_off:2,toggle:3}},vacuum:{...Zh,featureMasks:{turn_on:1,turn_off:2,toggle:3}},water_heater:{...Zh,featureMasks:{turn_on:8,turn_off:8,toggle:8}},camera:{...Zh,featureMasks:{turn_on:1,turn_off:1,toggle:1}}};function Jh(e){return e.slice(0,e.indexOf("."))}function Qh(e,t,i){if(!e?.services||"object"!=typeof e.services)return!1;const n=e.services?.[t];return!!n&&Object.prototype.hasOwnProperty.call(n,i)}function ed(e,t,i){return Qh(e,t,i)?{domain:t,service:i}:Qh(e,"homeassistant",i)?{domain:"homeassistant",service:i}:null}function td(e,t){return e?.entities?.[t]||null}function id(e,t,i){const n=e?.states?.[i],r=td(t,i);return n?.attributes?.friendly_name||r?.name||r?.original_name||i}function nd(e,t){const i=td(e,t);if(null!=i?.disabled_by)return!0;const n=i?.device_id?e?.devices?.[i.device_id]:null;return null!=n?.disabled_by}function rd(e,t){const i=e?.attributes?.supported_features;if(null==i||""===i)return!1;const n=Number(i);return Number.isFinite(n)&&(n&t)===t}function od(e,t,i){const n=Jh(i);if("lock"===n||"alarm_control_panel"===n)return!0;if("cover"!==n)return!1;const r=e?.states?.[i],o=td(t,i),s=String(r?.attributes?.device_class||o?.device_class||o?.original_device_class||"");return Fi.has(s)}function sd(e,t,i,n,r){return{ref:i,entityId:n,name:n?id(e,t,n):null,reason:r}}function ad(e,t,i,n,r,o=null){return{target:null,skipped:sd(e,t,i,n,r),semantics:o,nextEffect:null,command:null}}function ld(e,t,i,n,r=i){const o=Jh(i);if("cover"!==o&&"valve"!==o)return function(e,t,i,n,r=i){const o=Jh(i),s=e?.states?.[i];if(nd(t,i))return ad(e,t,r,i,"ha-disabled","power");if(od(e,t,i))return ad(e,t,r,i,"secure");if(!s)return ad(e,t,r,i,"missing","power");if("unavailable"===s.state)return ad(e,t,r,i,"unavailable","power");const a=Xh[o];if(!a)return ad(e,t,r,i,"unsupported");let l,c;if("unknown"===s.state||""===s.state){if(!a.unknownUsesToggle)return ad(e,t,r,i,"unsupported","power");l="toggle",c="toggle"}else a.offStates.includes(String(s.state))?(l="turn-on",c="turn_on"):(l="turn-off",c="turn_off");const h=a.featureMasks?.[c];if(h&&!rd(s,h))return ad(e,t,r,i,"unsupported","power");const d=ed(e,o,c);return d?{target:{entityId:i,name:id(e,t,i),state:String(s.state||""),via:n},skipped:null,semantics:"power",nextEffect:l,command:{...d,data:{entity_id:i}}}:ad(e,t,r,i,"unsupported","power")}(e,t,i,n,r);if(nd(t,i))return ad(e,t,r,i,"ha-disabled",o);if(od(e,t,i))return ad(e,t,r,i,"secure",o);const s=e?.states?.[i];if(!s)return ad(e,t,r,i,"missing",o);if("unavailable"===s.state)return ad(e,t,r,i,"unavailable",o);const a=function(e,t,i){const n=String(i?.state||""),r="closed"===n?{service:`open_${t}`,effect:"open",feature:1}:"open"===n?{service:`close_${t}`,effect:"close",feature:2}:"opening"===n||"closing"===n?{service:`stop_${t}`,effect:"stop",feature:8}:null;return r&&rd(i,r.feature)&&Qh(e,t,r.service)?r:rd(i,3)&&Qh(e,t,"toggle")?{service:"toggle",effect:"toggle"}:null}(e,o,s);if(!a)return ad(e,t,r,i,"unsupported",o);return{target:{entityId:i,name:id(e,t,i),state:String(s.state||""),via:n},skipped:null,semantics:o,nextEffect:a.effect,command:{domain:o,service:a.service,data:{entity_id:i}}}}function cd(e){return"entity"===e.bindingKind?e.bindingRef&&yn(e.bindingRef)?[e.bindingRef]:[]:"virtual"===e.bindingKind?[]:_h(e)}function hd(e){const t=e.marker?.toggle_entity;return t&&cd(e).includes(t)?t:null}function dd(e,t,i){const n=function(e,t){if("entity"===e.bindingKind&&e.bindingRef){const t=e.marker?.light_entity?mh(e):null;return[...new Set([t,e.bindingRef].filter(e=>!!e))]}const i=e.entities.length?e.entities:e.allEntities||[],n=e.marker?.light_entity||e.primary&&yn(e.primary)?mh(e):null;return[...new Set([n,...ch(t,i)].filter(e=>!!e))]}(i,t);if(!n.length)return null;const r="entity"===i.bindingKind?"binding":"device-role";if("binding"===r)return ld(e,t,n[0],r);let o=null,s=null;for(const i of n){const n=ld(e,t,i,r);if(n.command)return n;const a=n.skipped?.reason;if("missing"===a||"unavailable"===a||"secure"===a)return n;"ha-disabled"!==a?o||=n:s||=n}return o||s}function ud(e){const t=e.skipped?.reason;return"missing"===t?"unavailable":t||"unsupported"}function pd(e,t){return{origin:e,kind:"none",semantics:null,targets:[],skippedTargets:[],noneReason:t,nextEffect:null,command:null}}function _d(e,t){return"cover"===e||"toggle"===e?"toggle":"more-info"===e||"run"===e||"info"===e?e:(null==e||""===e)&&"light"===t?"toggle":"info"}function md(e,t){return{origin:e,kind:"single",semantics:t.semantics,targets:t.target?[t.target]:[],skippedTargets:t.skipped?[t.skipped]:[],noneReason:t.command?null:ud(t),nextEffect:t.nextEffect,command:t.command}}function gd(e,t,i,n=[]){const r=new Map,o=[],s=new Set,a=e=>{const t=`${e.ref}\n${e.entityId||""}\n${e.reason}`;s.has(t)||(s.add(t),o.push(e))};for(const e of n)a(e);for(const n of i){const i=ld(e,t,n.entityId,n.via,n.ref);i.target?r.set(n.entityId,r.get(n.entityId)||i.target):i.skipped&&a(i.skipped)}const l=[...r.values()];if(!l.length)return{origin:"explicit-toggle",kind:"group",semantics:"group-power",targets:l,skippedTargets:o,noneReason:o.length&&o.every(e=>"secure"===e.reason)?"secure":"configured-targets-missing",nextEffect:null,command:null};const c=l.some(e=>"on"===e.state)?"turn_off":"turn_on",h=ed(e,"homeassistant",c);return h?{origin:"explicit-toggle",kind:"group",semantics:"group-power",targets:l,skippedTargets:o,noneReason:null,nextEffect:"turn_on"===c?"turn-on":"turn-off",command:{...h,data:{entity_id:l.map(e=>e.entityId)}}}:{origin:"explicit-toggle",kind:"group",semantics:"group-power",targets:[],skippedTargets:[...o,...l.map(i=>sd(e,t,i.entityId,i.entityId,"unsupported"))],noneReason:"unsupported",nextEffect:null,command:null}}function fd(e){return String(e.marker?.id||e.id||"")}function vd(e){const{hass:t,device:i}=e,n=e.registryHass||t,r=function(e){return"toggle"===e.tapAction?"explicit-toggle":"cover"===e.tapAction?"legacy-cover":!e.tapAction&&e.primary?.startsWith("light.")?"default-light":null}(i);if(!r)return null;const o=i.marker;if("explicit-toggle"===r&&zc(o)){const t=String(o?.id||i.id||""),n=wh(e.devices).get(t);if(n)return function(e,t){const i=e.registryHass||e.hass;return gd(e.hass,i,t.driverEids.map(e=>({entityId:e,via:"control-marker-driver",ref:`marker:${t.markerId}`})))}(e,n);const s=Pc(o,e.virtualLights);return{origin:r,kind:"single",semantics:"power",targets:[{entityId:"",name:i.name,state:s?"on":"off",via:"virtual-light"}],skippedTargets:[],noneReason:null,nextEffect:s?"turn-off":"turn-on",command:null,operation:{kind:"virtual-light",markerId:o.id}}}if("explicit-toggle"===r){if(uh(i.marker?.binding,i.marker?.controls??i.controls,i.entities).length)return function(e,t=null){const{hass:i,device:n,devices:r}=e,o=e.registryHass||i,s=uh(n.marker?.binding,n.marker?.controls??n.controls,n.entities),a=e.lightSources||Mh(i,r,null,e.virtualLights),l=new Map;for(const e of a){if(!e.key.startsWith("marker:"))continue;const t=l.get(e.key)||[];t.push(e),l.set(e.key,t)}const c=wh(r),h=new Map;for(const e of r){const t=String(e.marker?.id||e.id||"");t&&h.set(t,e)}const d=[],u=[];t&&d.push({entityId:t,via:"entity"===n.bindingKind?"binding":"device-role",ref:t});for(const e of s){if(!e.startsWith("marker:")){yn(e)?d.push({entityId:e,via:"control-entity",ref:e}):u.push(sd(i,o,e,e.includes(".")?e:null,"unsupported"));continue}const t=l.get(e)||[];if(!t.length){const t=h.get(e.slice(7));if("ha_disabled"===t?.bindingStatus?.kind){const n=t.bindingStatus.allEntityIds[0]||null;u.push({ref:e,entityId:n,name:t.name||(n?id(i,o,n):null),reason:"ha-disabled"})}else u.push(sd(i,o,e,null,"missing"));continue}const r=[...new Set(t.flatMap(e=>e.serviceEids))];if(r.length){for(const t of r)d.push({entityId:t,via:"control-entity",ref:e});continue}const s=t.some(e=>e.passive),a=e.slice(7),p=fd(n),_=c.get(a)?.controllers.find(e=>fd(e.device)===p);if(s&&_?.driverEids.length)for(const t of _.driverEids)d.push({entityId:t,via:"control-marker-driver",ref:e});else u.push(sd(i,o,e,null,s?"missing":"unsupported"))}return gd(i,o,d,u)}(e,hd(i))}if("legacy-cover"===r){const e=i.entities.find(e=>e.startsWith("cover."))||i.allEntities?.find(e=>e.startsWith("cover."));return e?md(r,ld(t,n,e,"device-role")):pd(r,"no-actionable-entity")}const s=hd(i),a=s?ld(t,n,s,"entity"===i.bindingKind?"binding":"device-role"):dd(t,n,i);return a?md(r,a):pd(r,i.virtual||"virtual"===i.bindingKind?"no-actionable-entity":"no-binding")}function yd(e){if(!e)return[];const t=Array.isArray(e.data.entity_id)?e.data.entity_id:[e.data.entity_id];return[...new Set(t)].sort()}function bd(e){return e?e.operation?e.operation:e.command?{kind:"ha-service",command:e.command}:null:null}const wd=new Set(["missing","ha-disabled","unavailable"]);function kd(e,t){if(!bd(e)||!e.nextEffect||!e.targets.length)return[];const i="group"===e.kind,n=i?e.targets.filter(e=>"on"===e.state).length:0,r=i?0===n?t.groupAllOff():t.groupCurrent(n,e.targets.length):t.state(e.targets[0]);let o;return o="toggle"===e.nextEffect?t.expectedByHa():i&&"turn-on"===e.nextEffect?t.groupAllOn():i&&"turn-off"===e.nextEffect?t.groupAllOff():t.effect(e.nextEffect),[t.current(r),t.expected(o),...e.skippedTargets.length?[t.unavailable(e.skippedTargets.length)]:[]]}function xd(e,t){const i=bd(e),n=bd(t);return!(!i||!n||i.kind!==n.kind)&&("virtual-light"===i.kind&&"virtual-light"===n.kind?i.markerId===n.markerId:"ha-service"===i.kind&&"ha-service"===n.kind&&function(e,t){const i=yd(e),n=yd(t);return i.length===n.length&&i.every((e,t)=>e===n[t])}(i.command,n.command))}function $d(e,t){const i=e.targets[0]||e.skippedTargets[0],n=[];return"group"===e.kind?e.targets.length&&n.push(t.group(e.targets)):i&&n.push(t.single(i)),e.nextEffect&&e.targets.length&&n.push("group"===e.kind?t.groupCurrentNext(e.targets,e.nextEffect):t.currentNext(e.targets[0],e.nextEffect)),e.skippedTargets.length&&n.push(t.skipped(e.skippedTargets)),!e.command&&e.noneReason&&n.push(t.none(e.noneReason)),n}const Sd=e=>!!e&&e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1]);function Md(e,t=5,i=5){return vo(e.cm,t,i)/2}function Rd(e,t,i=1,n=5,r=5,o=0){const s=e.host;if(!s||"partition"!==s.kind||"string"!=typeof s.id||!s.id)return{resolved:null,reason:"invalid-host"};const a=t.find(e=>e.id===s.id);if(!a)return{resolved:null,reason:"missing-partition"};if(!Sd(a.a)||!Sd(a.b)||!Number.isFinite(s.t)||s.t<0||s.t>1)return{resolved:null,reason:"invalid-position"};const l=a.b[0]-a.a[0],c=a.b[1]-a.a[1],h=Math.hypot(l,c),d=Number(e.length)*i;if(!(h>1e-9&&d>0&&Number.isFinite(d)))return{resolved:null,reason:"invalid-length"};const u=s.t*h;if(u-d/2<o-1e-9||u+d/2>h-o+1e-9)return{resolved:null,reason:"does-not-fit"};const p=l/h,_=c/h;let m=180*Math.atan2(c,l)/Math.PI;return m>=90?m-=180:m<-90&&(m+=180),{reason:null,resolved:{opening:e,host:s,partition:a,center:[a.a[0]+l*s.t,a.a[1]+c*s.t],angle:m,length:d,depth:vo(a.cm,n,r),t:s.t,axis:{a:[a.a[0],a.a[1]],b:[a.b[0],a.b[1]],ux:p,uy:_,length:h}}}}function Td(e,t,i=1,n=5,r=5){return Rd(e,t,i,n,r,0)}function Cd(e,t,i=1,n=5,r=5){const o=e.host,s="partition"===o?.kind?t.find(e=>e.id===o.id):void 0;if(!s)return Td(e,t,i,n,r);const a=Rd(e,t,i,n,r,Md(s,n,r));return"does-not-fit"===a.reason?{resolved:null,reason:"does-not-fit-jamb"}:a}function Dd(e,t){return!e||(e.length!==t.length||e.host?.kind!==t.host?.kind||e.host?.id!==t.host?.id||e.host?.t!==t.host?.t)}function Ad(e){const{center:t,length:i,axis:n,host:r}=e,o=i/2;return{hostId:r.id,a:[t[0]-n.ux*o,t[1]-n.uy*o],b:[t[0]+n.ux*o,t[1]+n.uy*o],depth:e.depth}}function Od(e,t=!1){const i=t?1:-1,n=e.depth/2;return{ox:-e.axis.uy*i*n,oy:e.axis.ux*i*n,cm:e.partition.cm,side:i}}function zd(e,t,i){return e.flatMap(e=>!Sd(e.a)||!Sd(e.b)||Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])<=1e-9?[]:[{roomId:"",a:[e.a[0],e.a[1]],b:[e.b[0],e.b[1]],key:`partition:${e.id}`,kind:"outer",cm:e.cm,open:!1,half:vo(e.cm,t,i)/2,partitionHost:{kind:"partition",id:e.id}}])}function Pd(e,t,i){const{center:n,length:r,axis:o}=e,s=r/2,a=t.flatMap(e=>{if(!e.kind||e.open)return[];const t=e.b[0]-e.a[0],r=e.b[1]-e.a[1],a=Math.hypot(t,r);if(!(a>i))return[];const l=t/a,c=r/a;if(Math.abs(o.ux*c-o.uy*l)>1e-6)return[];if(Math.abs((n[0]-e.a[0])*c-(n[1]-e.a[1])*l)>i)return[];const h=e=>(e[0]-n[0])*o.ux+(e[1]-n[1])*o.uy,d=h(e.a),u=h(e.b),p=Math.max(-s,Math.min(d,u)),_=Math.min(s,Math.max(d,u));return _>=p-i?[[p,_]]:[]});if(!a.length)return!1;a.sort((e,t)=>e[0]-t[0]||e[1]-t[1]);let l=-s;for(const[e,t]of a){if(e>l+i)return!1;if(l=Math.max(l,t),l>=s-i)return!0}return!1}function Fd(e,t,i=1e-9){const n=e.length/(2*e.axis.length),r=e.t-n,o=e.t+n;return t.some(t=>{if(t.host.id!==e.host.id||t.opening.id===e.opening.id)return!1;const n=t.length/(2*t.axis.length);return Math.max(r,t.t-n)<Math.min(o,t.t+n)-i})}function Id(e,t,i){return{...e,x:t.center[0]/i,y:t.center[1]/i,angle:t.angle}}const Ed=1e-5;function Nd(e){const t=e.map(()=>[]);for(let i=0;i<e.length;i++){const n=e[i],r=n[2]-n[0],o=n[3]-n[1];for(let s=i+1;s<e.length;s++){const a=e[s],l=r*(a[3]-a[1])-o*(a[2]-a[0]);if(Math.abs(l)<1e-12)continue;const c=a[0]-n[0],h=a[1]-n[1],d=(c*(a[3]-a[1])-h*(a[2]-a[0]))/l,u=(c*o-h*r)/l;d<=1e-9||d>=1-1e-9||u<=1e-9||u>=1-1e-9||(t[i].push(d),t[s].push(u))}}const i=[];for(let n=0;n<e.length;n++){const r=e[n];if(!t[n].length){i.push(r);continue}const o=[0,...t[n].sort((e,t)=>e-t),1];for(let e=1;e<o.length;e++)o[e]-o[e-1]<1e-9||i.push([r[0]+(r[2]-r[0])*o[e-1],r[1]+(r[3]-r[1])*o[e-1],r[0]+(r[2]-r[0])*o[e],r[1]+(r[3]-r[1])*o[e]])}return i}function Hd(e){const t=[];for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];n&&r&&(Math.hypot(r[0]-n[0],r[1]-n[1])<1e-9||t.push([n[0],n[1],r[0],r[1]]))}return t}const Ld=(e,t)=>{const i=t[2]-t[0],n=t[3]-t[1],r=i*i+n*n;if(!(r>0))return Math.hypot(e[0]-t[0],e[1]-t[1]);const o=Math.max(0,Math.min(1,((e[0]-t[0])*i+(e[1]-t[1])*n)/r));return Math.hypot(e[0]-(t[0]+o*i),e[1]-(t[1]+o*n))},qd=(e,t,i,n)=>{const r=n[2]-n[0],o=n[3]-n[1],s=t*o-i*r;if(Math.abs(s)<1e-12)return 1/0;const a=n[0]-e[0],l=n[1]-e[1],c=(a*o-l*r)/s;if(!(c>1e-9))return 1/0;const h=(a*i-l*t)/s;return h<-1e-9||h>1+1e-9?1/0:c};function jd(e,t,i,n=96){if(!(t>0&&Number.isFinite(e[0])&&Number.isFinite(e[1])))return[];const r=[];for(const n of i){if(!n||n.length<4)continue;if(![n[0],n[1],n[2],n[3]].every(Number.isFinite))continue;const i=Ld(e,n);if(i<1e-7)return[];i>t||r.push(n)}const o=[],s=Math.max(12,Math.round(n));for(let e=0;e<s;e++)o.push(e/s*Math.PI*2-Math.PI);for(const t of r)for(const i of[[t[0],t[1]],[t[2],t[3]]]){const t=Math.atan2(i[1]-e[1],i[0]-e[0]);o.push(t-Ed,t,t+Ed)}const a=2*Math.PI;for(let e=0;e<o.length;e++)o[e]=(o[e]%a+a)%a;o.sort((e,t)=>e-t);const l=[];let c=Number.NEGATIVE_INFINITY;for(const i of o){if(i-c<1e-9)continue;c=i;const n=Math.cos(i),o=Math.sin(i);let s=t;for(const t of r){const i=qd(e,n,o,t);i<s&&(s=i)}l.push([e[0]+n*s,e[1]+o*s])}return l.length>=3?l:[]}const Bd=[o`
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
    .decorlayer .dsel {
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .decorlayer .ddraft {
      stroke-dasharray:
        calc(6px * var(--hp-cell-visual-scale, 1))
        calc(5px * var(--hp-cell-visual-scale, 1));
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
`];var Wd={"editor.context_actions":"Actions: {object}","editor.tool_options":"Tool options: {tool}","editor.palette":"Palette: {tool}","editor.open_group":"Tool group: {group}","editor.group_active":"{group} — active: {item}","editor.disabled_action":"{action} is unavailable: {reason}","editor.loading":"Loading editor…","editor.loading_aria":"The plan editor is loading","editor.load_failed":"Could not load the editor.","editor.refresh_advice":"Refresh the page and try again.","color_picker.title":"Color picker","color_picker.hue":"Hue","color_picker.saturation":"Saturation","color_picker.value":"Brightness","color_picker.hex":"Hex color","color_picker.invalid_hex":"Enter a 3- or 6-digit hex color","btn.properties":"Properties","btn.keep_as_walls":"Keep as walls","btn.delete_room_keep_walls":"Delete room, keep walls","btn.delete_room_with_walls":"Delete room and walls","title.markup_select":"Select and edit walls, columns and saved outlines","title.markup_column":"Column: click a grid point to place a square column","markup.partition":"Partition","markup.column":"Column","markup.hint_column":"click a grid point to place a square column","history.draft_segment":"Add room-draft segment","history.draft_merge":"Join unfinished room outlines","history.draft_segment_delete":"Remove room-draft segment","history.partition_add":"Add partition","history.column_add":"Add column","history.physical_edit":"Change physical object","history.physical_delete":"Delete physical object","history.physical_move":"Move physical object","history.contour_to_partitions":"Convert contour to closed walls","history.wall_chain_finish":"Finish wall chain","history.wall_face_batch":"Create rooms from walls","toast.column_duplicate":"A column with the same centre and outer size already exists","confirm.delete_draft":"Delete the whole unfinished room contour?","confirm.delete_draft_segment":"Delete this draft segment? The remaining contour may split in two.","physical.partition_properties":"Partition properties","physical.column_properties":"Column properties","physical.draft_properties":"Draft segment properties","physical.shape":"Shape","physical.square":"Square","physical.circle":"Circle","physical.diameter":"Diameter","physical.side":"Side","physical.rotation":"Rotation angle","physical.length":"Length","physical.allowed_range":"Allowed: {min}–{max} {unit}","physical.delete_segment":"Delete segment","physical.delete_draft":"Delete entire outline","physical.column_size_title":"Outer side of the square column placed by the click (1–150 cm).","card.title":"House plan","count.devices":"{n} dev.","empty.no_spaces":"No spaces yet.","empty.add_first":"Add the first space and upload a floor plan.","empty.install":'Install the House Plan integration and add it in "Devices & services".',"btn.add_space":"Add space","btn.cancel":"Cancel","btn.save":"Save","btn.close":"Close","btn.delete":"Delete","btn.edit":"Edit","btn.open_in_ha":"Open in HA","btn.reset":"Reset","btn.attach":"Attach…","btn.upload":"Upload…","btn.replace":"Replace…","title.zoom_in":"Zoom in","title.zoom_out":"Zoom out","title.zoom_fit":"Fit all","title.markup":"Room markup: grid, lines, outlines","title.configure_space":"Configure space","title.add_space":"Add space","title.markup_add":"Walls: draw a continuous chain; Shift locks to 45°. Changing tool or leaving the editor finishes it as independent walls","title.markup_merge":"Merge: click one room, then the neighbour it shares a wall with","title.markup_split":"Split a room: click the room, then two points on its walls","title.markup_delroom":"Delete room: click inside a room and confirm","title.need_plan":"Upload a floor-plan image","markup.add":"Walls","markup.merge":"Merge","markup.split":"Split","markup.resize":"Resize","title.markup_resize":"Resize rooms: drag an available horizontal or vertical wall handle","markup.hint_resize":"drag an available wall handle · the wall stops at the first unsafe position · Esc cancels · Ctrl+Z — undo","resize.disabled.diagonal":"This wall is angled; Resize supports only horizontal and vertical walls","resize.disabled.side-angle":"An adjoining wall is angled; Resize requires both adjoining walls to meet this wall at right angles","resize.disabled.duplicate-physical-wall":"A separate partition, unfinished outline, or column overlaps this wall; remove or move it before resizing","resize.disabled.partial-shared":"A neighbouring room uses only part of this wall, so it cannot be moved safely as one shared wall","resize.disabled.unequal-shared":"The neighbouring room uses different endpoints or wall length, so the walls cannot move together safely","resize.disabled.multiple-rooms":"Moving this wall would affect more than two rooms","resize.disabled.thickness-conflict":"The wall thickness cannot be preserved safely","resize.disabled.opening-conflict":"An opening on this wall cannot be moved safely","resize.disabled.invalid-geometry":"This wall cannot be resized without changing the plan structure","resize.limit_stopped":"Wall stopped: the next step would break a junction limit","resize.commit_failed":"Resize was cancelled because the final plan did not pass the geometry check","resize.preview_failed":"Resize stopped at the last safe position because the plan geometry could not be preserved","markup.opening":"Opening","markup.delete_room":"Delete room","history.undo":"Undo","history.redo":"Redo","history.undo_named":"Undo: {name} (Ctrl+Z)","history.redo_named":"Redo: {name} (Ctrl+Shift+Z / Ctrl+Y)","history.undo_empty":"Nothing to undo","history.redo_empty":"Nothing to redo","history.undone":"Undone: {name}","history.redone":"Redone: {name}","history.add_room":"Create room","history.split_room":"Split room","history.merge_rooms":"Merge rooms","history.resize_room":"Resize room","history.wall_thickness":"Change wall thickness","history.add_opening":"Add door or window opening","history.edit_opening":"Edit opening","history.move_opening":"Move opening","history.delete_opening":"Delete opening","history.delete_room":"Delete room","history.delete_room_keep_walls":"Delete room, keep walls","history.delete_room_with_walls":"Delete room and walls","history.decor_add":"Add decor object","history.decor_edit":"Edit decor object","history.decor_move":"Move decor object","history.decor_transform":"Transform decor object","history.decor_delete":"Delete decor object","history.backdrop_transform":"Transform plan backdrop","opening.new":"New opening","opening.edit":"Opening","opening.door":"Door","opening.window":"Window","opening.gate":"Gate","opening.passage":"Open passage","opening.passage_binding_warning":"Saving will remove the open/close sensor and lock.","opening.invalid_passage_fields":"The open passage on plan “{room}” has unsupported settings: {fields}.","opening.type_label":"Type","opening.length_label":"Length, cm","opening.contact_label":"Open/close sensor","opening.lock_label":"Lock","opening.none":"— none —","opening.search_ph":"Search: name or entity id…","opening.invert":"Invert open/closed","opening.flip_h":"Hinge on the other jamb","opening.flip_v":"Opens to the other side","opening.open":"Open","opening.closed":"Closed","opening.locked":"Locked","opening.unlocked":"Unlocked","opening.state_unknown":"unavailable","opening.no_entities":"No sensors bound — a static symbol on the plan.","toast.opening_no_wall":"Click next to a room wall or independent wall","opening.host_partition":"Independent wall","opening.partition_orphan":"The independent wall for this opening no longer exists","opening.partition_jamb_margin":"Leave at least {distance} between the opening and the end of the wall","opening.rebind_partition":"Attach to another independent wall","confirm.delete_partition_openings_title":"Delete wall and openings?","confirm.delete_partition_openings_body":"This wall contains {count} opening(s). They will be deleted together.","confirm.delete_partition_openings_item":"• {type}, {length}","markup.delete":"Delete","markup.hint_points":"points: {n} · Shift — 45° steps · Esc — finish chain · Ctrl+Z — undo a point · closing an area offers a room","markup.hint_start":"click a grid dot to start a wall chain","tip.lqi":"average zigbee signal:","tip.area":"area: {value}","info.device_header":"Device on the plan","info.model":"Model","info.state":"State","info.link":"Link","info.manuals":"Manuals","info.none":"No additional information","marker.new_device":"New device","marker.name_label":"Name (shown on the plan)","marker.name_ph":"Name","marker.binding_label":"Bind to an HA device","marker.binding_disabled":"disabled in Home Assistant","marker.virtual_option":"Virtual device (no binding)","marker.search_ph":"Search device / group…","marker.nothing_found":"nothing found","marker.room_label":"Room","marker.room_override":" (override placement)","marker.room_choose":"— select a room —","marker.room_auto":"— by device area (auto) —","marker.icon_label":"Icon","marker.icon_ph":"mdi:… (empty = auto)","marker.display_label":"Display","display.badge":"Icon + state","display.icon_ripple":"Icon + state and activity","display.static_icon":"Always static icon","marker.display_hint":"Icon + state changes the plate for work, open, alarm and unavailable states. Icon + state and activity additionally shows a short pulse for events and a continuous pulse for ongoing work, movement or presence. Value + state replaces the icon with one unambiguous HA value. A static icon never reacts to device states.","marker.display_hint_badge":"The icon and dynamic plate show device state without the ordinary activity pulse. Red alarms remain visible.","marker.display_hint_icon":"The icon and dynamic plate show device state without the ordinary activity pulse. Red alarms remain visible.","marker.display_hint_icon_ripple":"The icon, dynamic plate and pulse show a short pulse for events and a continuous pulse for work, motion or presence. Red alarms have separate priority.","marker.display_hint_value":"One unambiguous Home Assistant value replaces the icon while the plate continues to show state. Red alarms remain visible.","marker.display_hint_static_icon":"The theme-aware shell and icon always stay the same. State, activity, unavailability and alarms do not change the face.","marker.static_alarm_warning":"This device can report alarms. Static display hides the marker's visual alarm indication.","marker.preview.title":"Display preview","marker.preview.actual":"Now","marker.preview.example":"Example","marker.preview.integration":"Provided by","marker.preview.source":"Display source","marker.preview.current_state":"Current state","marker.preview.result":"On the plan","marker.preview.details":"Source details","marker.preview.select_source":"Choose a Home Assistant device or entity to see its actual display.","marker.preview.unknown_provider":"Unknown integration","marker.preview.virtual_provider":"House Plan · virtual device","marker.preview.no_source":"No active source","marker.preview.no_state":"No current state","marker.preview.mixed_states":"Several different states","marker.preview.multiple_sources":"{n} sources","marker.preview.more_sources":"+{n} more","marker.preview.scaled":"The preview is scaled to {n}% to fit. The saved size is unchanged.","marker.preview.demo_short":"Show short activity","marker.preview.demo_continuous":"Show continuous activity","marker.preview.stop_continuous":"Stop continuous activity","marker.preview.demo_short_notice":"Short activity example; the actual device state is unchanged.","marker.preview.demo_continuous_notice":"Continuous activity example; the actual device state is unchanged.","marker.preview.demo_already_visible":"The current state already shows a real activity or alarm effect.","marker.preview.reduced_motion":"System reduced-motion is enabled, so ordinary activity is shown as a dot.","marker.preview.reason.neutral":"Neutral dark plate","marker.preview.reason.working":"Yellow plate: the device is working now","marker.preview.reason.working_activity":"Yellow plate and activity effect: the device is working now","marker.preview.reason.open":"Orange plate: physically open or unlocked","marker.preview.reason.cover_icon_state":"Neutral plate; the cover entity controls the displayed state and icon","marker.preview.reason.presence":"Activity effect while presence is detected","marker.preview.reason.event":"Short activity effect after a detected event","marker.preview.reason.transition":"Activity effect while the device is moving or changing state","marker.preview.reason.media_neutral":"Media devices stay on a neutral dark plate while available","marker.preview.reason.unavailable":"Subdued neutral plate: unavailable or off","marker.preview.reason.alarm":"Red alarm plate; alarm indication is always shown","marker.preview.reason.live_states_disabled":"Live-state styling is disabled for this card","marker.preview.reason.value_no_state":"No usable state value; the icon is shown instead","marker.preview.reason.value_ambiguous_sources":"Several possible value sources; the icon is shown instead","marker.preview.reason.value_non_scalar":"The source did not return a simple value; the icon is shown instead","marker.preview.reason.value_virtual":"A virtual device has no Home Assistant value; the icon is shown instead","marker.preview.reason.vacuum_live_plan_only":"Live vacuum position and trail are available only on the full plan","marker.preview.reason.hidden_design_preview":"The device is hidden on the plan; this design preview remains visible","marker.preview.reason.composite_power_source":"State comes from the device Power entity; auxiliary switches are ignored","marker.preview.reason.activity_display_disabled":"The selected display mode does not show ordinary activity effects","marker.preview.reason.ha_disabled":"The Home Assistant binding is disabled and will be hidden on the plan","marker.preview.reason.orphaned":"The saved Home Assistant binding can no longer be found","marker.preview.reason.static_icon":"Static mode: device state does not change the icon","marker.activity_color":"Activity pulse color","marker.ripple_size":"Activity pulse size","marker.activity_alarm_note":"Color and size affect ordinary activity only and do not change red alarms.","marker.pulse_a11y_alarm":"Alarm","marker.pulse_a11y_event":"Recent event","marker.pulse_a11y_presence":"Presence detected","marker.pulse_a11y_transition":"Changing state","marker.pulse_a11y_running":"Working","marker.state_a11y_neutral":"Default state","marker.state_a11y_working":"Working","marker.state_a11y_open":"Open","marker.state_a11y_locked":"Locked","marker.state_a11y_unlocked":"Unlocked","marker.state_a11y_alarm":"Alarm","marker.state_a11y_unavailable":"Unavailable","marker.lqi_a11y_low":"LQI {value}, low signal","marker.lqi_a11y_mid":"LQI {value}, medium signal","marker.lqi_a11y_high":"LQI {value}, high signal","marker.size_label":"Icon size / rotation","marker.angle_label":"Rotate","marker.model_label":"Model","marker.model_ph":"e.g. Aqara T&H","marker.link_label":"Link","marker.desc_label":"Description","marker.desc_ph":"Notes, specs…","marker.manuals_label":"Manuals (PDF etc.)","marker.sub_device":"device","marker.sub_z2m_group":" · Z2M group","marker.sub_group":"group","marker.sub_helper":"helper","space.new":"New space","space.header":"Space","space.title_label":"Title","space.title_ph":"e.g. Garage","space.plan_label":"Floor plan (background)","space.no_plan":"no plan image","space.plan_alt":"plan","room.new":"New room","room.name_label":"Display name","room.name_ph":"e.g. Terrace","room.area_label":"Home Assistant area (unassigned)","room.no_area_option":"— no area —","room.default_name":"Room","device.unnamed":"unnamed","device.light_group":"light group","device.fallback":"device","device.virtual":"virtual device","confirm.delete_room":'Delete room "{name}"?',"confirm.delete_room_title":'Delete room "{name}"?',"confirm.delete_room_body":"Choose whether the room's exclusive physical walls should remain. Walls shared with another room are always kept.","confirm.remove_marker":'Delete "{name}" from the plan? The device will disappear completely and stop contributing to plan data. You can add it again later.',"confirm.erase_decor":"Erase the {kind} object? You can undo this action from the editor history.","confirm.delete_space":'Delete space "{title}" with all its rooms and markup?',"space.delete_blocked":"This space is still used by {n} device(s). Move them to another space or delete them first.","toast.pos_save_failed":"Failed to save position: {err}","toast.no_entity":"The device has no suitable entity","toast.ha_disabled_action":"A Home Assistant object that is disabled cannot be used on the plan.","toast.ha_disabled_show_device":"A device disabled in Home Assistant cannot be shown on the plan. Enable it in Home Assistant first.","toast.ha_disabled_show_entity":"An entity disabled in Home Assistant cannot be shown on the plan. Enable it in Home Assistant first.","toast.ha_disabled_add":"A disabled Home Assistant object cannot be added to the plan. Enable it in Home Assistant first.","toast.ha_binding_unverified":"The object status could not be verified through the Home Assistant registry. Display and actions are temporarily unavailable.","toast.markup_needs_server":"Markup is available after the config is moved to the server","toast.space_order_changed":"Order changed. If any card pins its floor by number, check those panels.","toast.conflict":"Config was changed in another window — data refreshed, repeat your last action","toast.cfg_save_failed":"Failed to save config: {err}","toast.room_overlap":"The outline overlaps room “{name}” — rooms must not overlap","toast.contour_cannot_close":"The outline cannot close because it is degenerate or intersects itself","toast.merge_not_adjacent":"Only rooms that share a wall can be merged","toast.rooms_merged":"Rooms merged into “{name}”","toast.split_pick_wall":"Start the cut on the room’s wall","toast.split_bad_cut":"The cut must run wall to wall inside the room, without crossing walls or itself","merge.header":"Merge rooms","merge.hint":"The merged room keeps one name and one area. The other area is released — its devices leave the plan until another room claims it.","merge.keep":"Keep","merge.no_area":"no area","toast.room_saved":"Room saved ({n}). Devices added: {added}. Outline the next one or exit markup.","toast.room_saved_no_area":"Room saved ({n}, no area). Outline the next one or exit markup.","toast.marker_needs_server":"Device editing is available after the config is moved to the server","toast.virtual_name_required":"Enter a name for the virtual device","toast.marker_saved":"Device saved","toast.marker_removed":"Device deleted from the plan","toast.integration_missing":"The House Plan integration is not installed — management unavailable","toast.plan_formats":"Supported formats: SVG, PNG, JPG, WebP","toast.plan_required":"Upload a floor plan — it is required","toast.space_added_onboard":"Space added. Outline the rooms: click grid dots and close the contour.","toast.space_added":"Space added","toast.space_saved":"Space saved","toast.space_deleted":"Space deleted","toast.delete_failed":"Delete failed: {err}","toast.error":"Error: {err}","toast.toggle_target_unavailable":"Target “{name}” is unavailable — no action was performed","toast.toggle_targets_unavailable":"Targets are unavailable: {names}. No action was performed","toast.file_failed":'File "{name}" was not uploaded: {err}',"toast.files_attached":"Files attached: {n}","err.unknown":"unknown error","err.code":"code {code}","err.too_large":"file larger than {mb} MB","err.bad_ext":"unsupported type (PDF/image expected)","err.unauthorized":"administrator rights required","editor.title":"Title","editor.default_floor":"Initial space","editor.default_floor_missing":"Initial space “{id}” no longer exists. Choose another space.","editor.floor":"Fixed space","editor.floor_none":"— not fixed —","editor.floor_index":"YAML index {index} (preserved)","fixed_floor.loading":"Loading the fixed space…","fixed_floor.invalid_title":"The fixed space is unavailable","fixed_floor.invalid_body":"Check floor in the card configuration. The configured value is: {value}","editor.icon_size":"Icon size, % of plan width","editor.show_temperature":"Show temperature","editor.live_states":"Live states (on/off, open…)","editor.show_signal":"Show zigbee signal (LQI)","editor.language":"Interface language","editor.lang_auto":"Auto (HA profile)","title.icon_rules":"Icon rules: which MDI icon devices get by name","rules.title":"Icon rules","rules.hint":"Rules are checked top-down against “device name + model” (case-insensitive regex); the first match wins. When nothing matches, the entity device class decides, then the generic chip icon.","rules.pattern_ph":"regex, e.g. plug|socket","rules.icon_ph":"mdi:power-socket-de","rules.add":"Add rule","rules.reset":"Reset to defaults","rules.test_ph":"Try a device name…","rules.invalid":"invalid regex","rules.saved":"Icon rules saved","btn.up":"Up","btn.down":"Down","tap.info":"Device card","tap.more_info":"HA more-info dialog","tap.toggle":"Toggle state","marker.tap_label":"Tap action for this device","tap.toggle_note":"The resolved state is shown below. Secure devices are never toggled from the plan.","import.title":"Create spaces from HA floors","import.hint":"Your Home Assistant already knows these floors. Pick the ones to turn into plan spaces — you will upload a floor-plan image for each one next. Rooms are then outlined by hand on the plan.","import.start":"Create {n} space(s)","import.manual":"Start from scratch","import.progress":"Floor {i} of {n}","import.done":"Spaces created. Outline the rooms: click grid dots and close the contour.","btn.skip":"Skip","space.scale_label":"Scale (grid cell size)","space.scale_unit":"cm per cell","space.scale_unit_imperial":"in per cell","space.display_section":"Display","space.show_borders":"Always show room borders","space.zero_wall_style":"Zero-thickness walls","space.zero_wall_dashed":"Dashed","space.zero_wall_solid":"Solid","space.zero_wall_help":"Dashed walls let light through. Solid walls block light even at zero thickness.","space.show_names":"Show room names (drag to move)","space.room_color":"Border & name color","space.opacity":"Opacity","space.fill_label":"Room fill","fill.none":"None","fill.lqi":"Zigbee signal","fill.light":"Lights","fill.custom":"Custom color","space.custom_fill":"Fill color","space.source_file":"I have a floor-plan image","space.source_draw":"No image — I'll outline rooms by hand","fill.temp":"Temperature","tip.temp_avg":"average temperature:","tip.hum_avg":"average humidity:","space_card.button":"Open the space plan","space_card.not_found":"Space “{id}” not found","space_card.loading":"Loading…","continuity.restore_plan":"Restoring floor plan…","continuity.restore_connection":"Restoring device connection…","continuity.retry":"Try again","editor.space":"Space","editor.show_button":"Show button","editor.button_label":"Button label","editor.button_target":"Target dashboard path","marker.sub_entity":"entity","title.general_settings":"General settings","gs.title":"General settings","gs.hint":"Fill colors apply to every space; each color has its own opacity. Which fill mode a space uses is set in that space's dialog.","gs.light_group":"Fill: lights","gs.light_on":"Lights on","gs.light_off":"All lights off","gs.temp_group":"Fill: temperature","gs.temp_cold":"Cold","gs.temp_ok":"Comfortable","gs.temp_hot":"Hot","gs.lqi_group":"Fill: zigbee signal","gs.lqi_low":"Weak signal","gs.lqi_high":"Strong signal","gs.reset":"Reset to defaults","gs.saved":"General settings saved","space.show_lqi":"Show zigbee signal (LQI) next to devices","space.hide_decor":"Hide the decorative layer","space.hide_decor_tip":"Lines, shapes, labels and furniture stay where they are — visible in the backdrop editor, not on the plan.","space.hide_openings":"Hide openings","space.hide_openings_tip":"Door, window and gate symbols are not drawn, but the openings keep working: light passes through, the sun comes in at a window, contact sensors still open them. The plan editor always shows them.","gs.light_none":"No light sources","mode.plan":"Plan editor","mode.devices":"Device editor","display.value":"Value + state","marker.subarea":"no area, manual","device.new":"New device — open its editor to dismiss","opening.unlock_action":"Unlock","opening.lock_action":"Lock","opening.lock_pending":"Working…","title.close_editor":"Close editor (back to view)","devbar.rules":"Icon rules","device_inbox.button":"Devices","device_inbox.title":"Devices on the plan","device_inbox.search":"Search devices, entities and integrations…","device_inbox.add_virtual":"Add virtual device","device_inbox.tab_on_plan":"On plan","device_inbox.tab_available":"Available","device_inbox.tab_hidden":"Hidden","device_inbox.tab_readd":"Available again","device_inbox.only_new":"New only","device_inbox.show_entities":"Show entities","device_inbox.show_hidden":"Show hidden on plan","device_inbox.new":"New","device_inbox.find":"Find on plan","device_inbox.edit":"Edit","device_inbox.hide":"Hide","device_inbox.show":"Show","device_inbox.add":"Add","device_inbox.readd":"Add again","device_inbox.hide_available":"Hide from list","device_inbox.show_more":"Show more","device_inbox.more_actions":"More actions","device_inbox.find_hidden_hint":"Enable “Show hidden on plan” first","device_inbox.show_disabled":"Activate this binding in Home Assistant before showing it","device_inbox.empty_on_plan":"No matching devices are on the plan yet.","device_inbox.empty_available":"No devices are available to add.","device_inbox.empty_hidden":"There are no hidden devices.","device_inbox.empty_readd":"No removed devices are available to add again.","device_inbox.reason_visible_auto":"Discovered automatically","device_inbox.reason_visible_explicit":"Added explicitly","device_inbox.reason_manual_hidden":"Hidden by user","device_inbox.reason_automatic_hidden":"Hidden automatically","device_inbox.reason_service_entry":"Service-only registry entry","device_inbox.reason_excluded_integration":"Integration excluded by device filters","device_inbox.reason_excluded_domain":"Non-spatial entity type","device_inbox.reason_grouped_light":"Represented by a room light group","device_inbox.reason_represented_by_parent":"Represented by its parent device","device_inbox.reason_removed":"Previously removed from the plan","device_inbox.reason_available":"Available to add to the plan","device_inbox.reason_no_bound_room":"HA area is not linked to a plan room","device_inbox.status_ha_disabled":"Disabled in Home Assistant","device_inbox.status_orphaned":"Binding is no longer present in Home Assistant","device_inbox.status_unverified":"Home Assistant registry is temporarily unavailable","device_inbox.saved":"Device list updated","space.roomcard_section":"Room card shows:","space.label_temp":"Temperature","space.label_hum":"Humidity","space.label_lqi":"Average Zigbee signal","space.label_light":"Lights on/off","roomcard.light_on":"On","roomcard.light_off":"Off","roomcard.light_partial":"{on} of {total}","toast.split_pick_inside":"Intermediate cut points must be inside the room","mode.decor":"Background editor","decor.select":"Select","decor.line":"Line","decor.rect":"Rectangle","decor.ellipse":"Oval","decor.text":"Text","decor.erase":"Erase","decor.erase_confirm_title":"Erase object?","decor.color":"Color","decor.width":"Line width","decor.line_style":"Line style","decor.line_style_solid":"Solid","decor.line_style_dashed":"Dashed","decor.fill":"Fill","decor.fill_color":"Fill color","decor.length":"Length","decor.size":"Size","decor.angle":"Rotation angle, °","decor.text_size":"Text size","decor.backdrop_properties":"Plan backdrop properties","decor.text_title":"Text label","decor.object_title":"Edit {kind}","decor.text_label":"Text","decor.live_group":"Insert HA variable","decor.live_entity":"Entity","decor.live_entity_ph":"choose an entity","decor.live_attr":"Value","decor.live_attr_ph":"choose state or attribute","decor.live_state":"State","decor.backdrop":"Backdrop image","decor.backdrop_hint":"Drag to move; pull a corner to resize; use the top handle to rotate. Shift changes proportions or frees the angle.","decor.backdrop_reset":"Reset the picture","decor.backdrop_reset_done":"The picture is back at its original place and size","marker.icon_auto":"Auto: {icon} (by icon rules; pick one to override)","marker.icon_pin_auto":"Pin","mode.plan_tip":"Plan editor — the geometry of the home: draw and split/merge rooms, bind them to HA areas, place doors, windows and gates, move room cards, set the scale","mode.devices_tip":"Device editor — everything about icons: drag to position, click to edit binding/icon/display, add virtual devices, icon rules","mode.decor_tip":"Background editor — purely visual decor under the plan: lines, rectangles, ovals and text labels that never react to clicks","space.glow_enabled":"Light-source glow","gs.glow_group":"Light-source glow","gs.glow_base":"House darkness","gs.glow_light":"Default light color / intensity","gs.wall_group":"Walls","gs.wall_fill":"Wall fill","gs.glow_radius":"Glow radius","gs.unit_m":"m","gs.unit_ft":"ft","marker.controls_label":"Controls other light sources","marker.controls_hint":"With tap action “Toggle”, a click flips every source added here. The marker’s own bound entity is controlled directly and cannot be added; use the switch below to classify it as a light.","marker.controls_filter":"Search lights and switches…","info.controls":"Controls","marker.glow_radius_label":"Glow radius","marker.glow_radius.help":"Sets the glow radius in metres or feet; an empty value uses the radius from general settings.","marker.glow_radius.help.aria":"Help: glow radius","markup.wallthick":"Thickness","markup.select":"Select","title.markup_wallthick":"Thickness — click a wall to set its thickness from 0 to 100 cm.","markup.hint_wallthick":"click a wall · Esc closes without applying","wallthick.field":"Thickness","wallthick.unit_cm":"cm","wallthick.unit_in":"in","wallthick.apply_room":"Apply to all walls of this room","markup.draw_wall_title":"Thickness of each new wall segment (0–100 cm). Shared walls keep the existing value.","room.queue_progress":"Room {current} of {total}","toast.wall_rooms_saved":"Created rooms: {n}","toast.wall_chain_saved":"Wall chain saved","toast.wallthick_pick":"Click a wall","toast.wallthick_set":"Wall thickness set","toast.wallthick_cleared":"Wall thickness removed","toast.physical_range":"Enter a value from {min} to {max} {unit}","toast.zero_wall_opening_conflict":"Remove the opening on this wall segment first.","toast.zero_wall_ambiguous":"The wall segment is ambiguous. Simplify or adjust the junction.","toast.zero_wall_migration_blocked":"The space was not converted: {reason}. No data was changed.","toast.physical_angle":"Enter a rotation angle from 0° up to, but not including, 90°","toast.physical_limit":"The space has reached the limit for this type of geometry","toast.geometry_unsafe":"Change canceled: wall geometry could not be built safely.","junction.limit_angle":"The angle between walls is too sharp: {actual}°, minimum {limit}°.","junction.limit_valence":"Too many walls meet in one node: {actual}, maximum {limit}.","junction.limit_length":"The wall segment is too short: {actual} cm, minimum {limit} cm.","junction.limit_distance":"Walls and nodes are too close: {actual} cm, minimum {limit} cm.","junction.limit_clearance":"No room interior is left: {actual} cm², minimum {limit} cm².","junction.limit_check_failed":"The junction check could not run — the change was not saved","toast.wall_model_migration_blocked":"The wall model could not be updated: {reason}. The plan was not changed. Run “Optimize plans”; if the error repeats, fix the conflicting wall geometry.","toast.wall_model_client_outdated":"Update the card and reload the page before editing the plan.","wall_model.reason.invalid-room":"invalid room contour","wall_model.reason.zero-length":"zero-length wall segment","wall_model.reason.third-owner":"wall shared by more than two rooms","wall_model.reason.duplicate-id":"conflicting wall identifiers","wall_model.reason.thickness-conflict":"conflicting wall thickness values","wall_model.reason.opening-host":"opening cannot be assigned to one wall","toast.delete_room_pick":"Click inside the room you want to delete","toast.plan_snap_ambiguous":"Zoom in to choose the wall node","toast.wall_repair_ambiguous":"The room outline has more than one possible connection. Zoom in and connect it explicitly.","toast.wall_repair_too_large":"The gap is larger than 2 cm. Connect the walls before creating the room.","toast.wall_repair_changed":"The wall geometry changed. Try creating the room again.","toast.opening_on_zero_wall":"Openings cannot sit on a zero-thickness wall","marker.from_ha_option":"Pick from the HA list","marker.show_entities":"Show entities","marker.show_entities_tip":"Adds not only devices to the list, but all their entities too","marker.pick_ph":"Choose a device…","room.open_area":"Open the HA area","view.volumetric":"Volumetric view","view.flat":"Flat view","kiosk.title":"This screen's sizes","kiosk.hint":"Stored on this device only — every wall tablet or TV can have its own comfortable sizes.","kiosk.icon_scale":"Device icon size","kiosk.font_scale":"Room card text size","editor.kiosk":"Wall device (kiosk) mode","editor.cycle":"Auto-switch spaces every N seconds (kiosk, 0 = off)","room.settings_title":"Room settings","room.settings_section":"Room settings (override the space)","room.fill_label":"Fill in THIS room","fill.inherit":"As the space","room.custom_fill_space":"Space color","room.custom_fill_own":"Room color","room.temp_src_label":"Temperature source","room.hum_src_label":"Humidity source","room.src_average":"Average over the room's sensors (default)","room.src_pick":"A specific HA device or entity","room.src_ph":"Choose a source…","toast.room_updated":"Room updated","space.card_font":"Room-card font size (whole space)","room.sizes_section":"Font sizes","room.name_scale":"Room name size","room.label_scale":"Metrics size","preview.room_name":"Living room","toast.cfg_reload_failed":"Could not reload the plan from the server: {err}","room.settings_short":"Room settings","room.unnamed":"Unnamed room","marker.use_climate_temp":"Include the device temperature in the room","marker.use_climate_temp_tip":"Adds an air conditioner or thermostat current_temperature to the room average. Configure the external value badge separately below.","marker.value_badge_title":"Value badge","marker.value_badge.help":"Shows one selected value next to the icon. It does not affect room metrics, light, Glow or the tap action.","marker.value_badge.help.aria":"Help: device value badge","marker.value_badge_enabled":"Show a value badge","marker.value_badge_source":"Value","marker.value_badge_source.help":"Choose a specific state, supported attribute, or derived value of this device.","marker.value_badge_source.help.aria":"Help: value badge source","marker.value_badge_position":"Position","marker.value_badge_position.help":"The chosen side stays fixed and does not flip automatically at a plan edge.","marker.value_badge_position.help.aria":"Help: value badge position","marker.value_badge_right":"Right","marker.value_badge_bottom":"Below","marker.value_badge_left":"Left","marker.value_badge_top":"Above","marker.value_badge_empty":"This device has no available values","marker.value_badge_static":"A static icon does not show live values. The setting is preserved.","marker.value_badge_missing":"Source unavailable","marker.value_badge_missing_hint":"The saved source is currently unavailable. Keep it, disable the badge, or choose another value.","marker.value_badge_duplicate":"The same value is already shown inside the icon.","marker.value_badge_state":"State · {name}","marker.value_badge_marker_state":"Light-source state · {name}","marker.value_badge_lqi":"Average Zigbee signal quality","marker.value_badge_attr_current_temperature":"Current temperature · {name}","marker.value_badge_attr_temperature":"Target temperature · {name}","marker.value_badge_attr_current_humidity":"Current humidity · {name}","marker.value_badge_attr_humidity":"Humidity · {name}","marker.value_badge_attr_current_position":"Position · {name}","marker.value_badge_attr_percentage":"Speed · {name}","marker.value_badge_attr_brightness":"Brightness · {name}","marker.value_badge_attr_volume_level":"Volume · {name}","marker.value_badge_attr_battery_level":"Battery · {name}","marker.value_badge_attr_fan_speed":"Fan speed · {name}","marker.light_role_label":"Is this device a light source?","marker.light_role.help":"Controls whether this marker itself is a spatial light source. Linked lights above remain independent room-light controls.","marker.light_role.help.aria":"Help: whether this device is a light source","marker.light_role_auto_yes":"Auto (light source)","marker.light_role_auto_no":"Auto (not a light source)","marker.light_role_always":"Always a light source","marker.light_role_never":"Never a light source","marker.light_entity_label":"Leading light entity","marker.light_entity.help":"For a composite device, choose the entity whose state, colour and brightness represent this plan source. The automatic fallback remains compatible with older plans.","marker.light_entity.help.aria":"Help: leading light entity","marker.light_entity_auto":"Automatic ({entity})","marker.light_entity_none":"no controllable entity","marker.light_entity_missing":"The saved entity {entity} is unavailable. House Plan temporarily uses {fallback}; the saved choice will be restored if it returns.","marker.toggle_entity_label":"Entity to toggle","marker.toggle_entity.help":"For a composite device, choose the exact own light or switch operated by a tap. Automatic keeps the previous target rules and is independent from the leading light entity.","marker.toggle_entity.help.aria":"Help: entity to toggle","marker.toggle_entity_auto":"Automatic ({entity})","marker.toggle_entity_none":"no own controllable entity","marker.toggle_entity_missing":"The saved entity {entity} is no longer among this marker’s selectable channels. House Plan temporarily uses {fallback}; the saved choice will be restored if it returns.","marker.glow_color_label":"Glow colour and brightness","marker.glow_mode.help":"Use live source values, override only its colour, or fix both colour and brightness. The minimum is 1%; to disable the source, choose “Never”.","marker.glow_mode.help.aria":"Help: glow colour and brightness","marker.glow_mode_auto":"From source","marker.glow_mode_color":"Set colour","marker.glow_mode_fixed":"Set colour and brightness","marker.glow_color":"Glow colour","marker.glow_brightness":"Brightness","marker.glow_disabled_never":"Glow settings are unavailable because this marker is explicitly not a light source.","marker.glow_disabled_auto":"Auto mode found no spatial light source for this marker.","marker.glow_disabled_no_entity":"No active controllable Home Assistant entity is available for this spatial source.","marker.glow_passive_hint":"This source has no own Home Assistant data. Set its colour and brightness manually; its radius remains available.","marker.control_broken":"Saved source is missing or no longer marked as a light","marker.control_missing_label":"Missing plan light","marker.control_passive":"passive source","toast.marker_control_cycle":"This link would create a circular chain of light controls.","toast.marker_binding_required":"Choose a Home Assistant device before linking another light source.","confirm.unlock":"Unlock “{name}”?","toast.files_migrate_failed":"Attachments could not be moved to the new binding, links keep pointing at the old files: {err}","space.pick_saved":"Already uploaded","space.pick_saved_hint":"Plans stored on the server, including ones you detached earlier","space.no_saved":"No plans stored on the server yet.","space.loading":"Loading…","space.used_by":"in use: {list}","space.in_use":"A space still uses this plan — detach it first","btn.use":"Use","confirm.delete_plan":'Delete the plan file "{name}" from the server? This cannot be undone.',"toast.plans_list_failed":"Could not list the stored plans: {err}","toast.plan_delete_failed":"Could not delete the plan: {err}","marker.hide":"Hide","marker.hide_tip":'The device will disappear from the plan after saving but will still count toward the room signal. Restore it through the "Devices" catalog in the device editor.',"marker.show":"Show","marker.show_tip":"The device will appear on the plan again after saving.","marker.hidden_ghost":"Device hidden by the user","marker.ha_disabled_device":"The device is disabled in Home Assistant and hidden from the plan.","marker.ha_disabled_entity":"The entity is disabled in Home Assistant and hidden from the plan.","marker.ha_disabled_all_entities":"The device has no active Home Assistant entities, so it is hidden from the plan.","marker.ha_registry_limited":"The full Home Assistant registry is unavailable to this user. The unverified object cannot be shown or used for now.","marker.delete_tip":"Completely delete the device from the plan and every aggregate. You can add it again later.","tap.run":"Run automation/script/scene","marker.run_target_label":"What to run","marker.run_search_ph":"Search: automation, script or scene…","marker.run_target_gone":"Target {id} not found — pick again","marker.tap_confirm":"Ask for confirmation","marker.tap_confirm_tip":"Show a confirmation dialog before acting — a guard against accidental taps.","marker.toggle_hint_single":"Target: {name} ({id}).","marker.virtual_light_target":"Virtual light: {name}.","marker.virtual_light_current":"Manual state: {state} → {effect}.","marker.virtual_light_state_on":"on","marker.virtual_light_state_off":"off","marker.toggle_hint_group":"Will toggle {count} source(s): {names}.","marker.toggle_hint_current":"Now: {state} → {effect}.","marker.toggle_hint_group_current":"Currently on: {on} of {count} → {effect}.","marker.toggle_hint_skipped":"Will be skipped ({count}): {targets}.","marker.toggle_effect_turn_on":"will turn on","marker.toggle_effect_turn_off":"will turn off","marker.toggle_effect_open":"will open","marker.toggle_effect_close":"will close","marker.toggle_effect_stop":"will stop","marker.toggle_effect_toggle":"state will toggle","marker.toggle_skip_missing":"not found","marker.toggle_skip_ha_disabled":"disabled in HA","marker.toggle_skip_unavailable":"unavailable","marker.toggle_skip_unsupported":"toggle is unsupported","marker.toggle_skip_secure":"blocked for security","marker.toggle_none_no_binding":"This device has no binding, so there is no state to toggle. Tapping will do nothing.","marker.toggle_none_no_actionable_entity":"This device has no state that can be toggled. Tapping will do nothing.","marker.toggle_none_configured_targets_missing":"The configured targets are unavailable. The device's own entity will not be substituted for them.","marker.toggle_none_ha_disabled":"The target is disabled in Home Assistant and cannot be used on the plan.","marker.toggle_none_unavailable":"The target is currently unavailable. Tapping will do nothing.","marker.toggle_none_unsupported":"Home Assistant exposes no safe toggle operation for this entity. Tapping will do nothing.","marker.toggle_none_secure":"Toggling locks, alarms and secure gates from the plan is blocked for security.","run.automation":"automation","run.script":"script","run.scene":"scene","confirm.tap_run":'Run "{name}"?',"confirm.tap_toggle":'Toggle "{name}"?',"confirm.current_state":"Current state: {state}","confirm.expected_state":"After switching: {state}","confirm.group_current":"on {on} of {total}","confirm.group_all_on":"all are on","confirm.group_all_off":"all are off","confirm.unavailable_targets":"Unavailable: {count}","confirm.expected_by_ha":"Home Assistant will determine the state","confirm.state_on":"On","confirm.state_off":"Off","confirm.state_open":"Open","confirm.state_closed":"Closed","confirm.state_opening":"Opening","confirm.state_closing":"Closing","confirm.state_stopped":"Stopped","confirm.state_unknown":"Unknown","toast.run_started":"Started: {name}","toast.run_target_missing":"Run target not found — check the device settings","toast.run_target_required":"Pick an automation, script or scene","toast.tap_target_changed":"The action target changed. Try again.","toast.virtual_light_toggle_failed":"Could not toggle the virtual light: {err}","toast.value_badge_source_required":"Choose a value for the badge","btn.run":"Run","vac.section":"Robot vacuum: live position","vac.autocal":"Set up automatically","vac.live":"Live position on the plan","vac.trail":"Show the robot's path","vac.cal_maps":"Calibrated maps: {maps}","vac.autocal_no_rooms":"The integration reports no room list — open “Fit manually”","vac.autocal_no_match":"Room names did not match (need ≥3 in common) — open “Fit manually”","vac.autocal_done":"Done: bound via {rooms} rooms. Start a cleanup and check","vac.cal_need_pos":"The robot is not reporting coordinates — start a cleanup and pause it","vac.cal_done":"Calibration saved. Start a cleanup and check","vac.cal_cancelled":"Calibration cancelled","vac.fit":"Fit manually","vac.fit_hint":"Drag the robot map into place, stretch by the corners","vac.fit_rotate":"Rotate 90°","vac.fit_mirror":"Mirror","vac.trail_never":"Never","vac.trail_cleaning":"While cleaning","vac.trail_always":"Always","gs.bg_group":"Stage background","gs.bg_color":"Background around the plan","gs.bg_default":"Theme default","gs.bg_theme":"theme default","gs.bg_mode":"Plan background","gs.bg_static":"Static color","gs.bg_daynight":"Follows the Sun","gs.bg_daynight_hint":"The background moves through dawn, day, dusk and night using sun.sun, or your local clock when sun data is unavailable. No compass is needed for the background.","gs.sun_group":"Sun","gs.sun_missing":"The sun.sun entity was not found — the background follows your local clock; window rays are unavailable.","gs.north":"North on the plan","gs.north_ph":"not set","gs.north_hint":"Set north only for window rays (1° steps, 15° with Shift); the Sun background works without it.","gs.north_clear":"Clear","gs.north_letter":"N","gs.sun_rays":"Sunlight through windows","gs.about_group":"About","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · docs & issues","gs.about_telegram":"Telegram chat","space.bg_color":"Background around the plan","space.bg_inherit":"Inherit general","space.bg_inherited":"inherits general settings","space.bg_mode":"Plan background","space.north":"North on the plan (override)","space.north_inherited":"inherited: {v}","space.sun_rays":"Sunlight through windows","space.sun_inherit":"Inherit general","space.sun_on":"On","space.sun_off":"Off","canvas.far_objects":"{n} object(s) far from the plan","canvas.show_far":"Show","canvas.home_tip":"The plan is over there — click to fit it","gs.grid_group":"Plan maintenance","gs.grid_hint":"Updates data models, aligns plan elements to the grid and merges redundant wall fragments. An exact report is shown before anything is stored.","gs.align_all":"Optimize plans","gs.align_title":"Optimize plans","gs.align_none":"All plans already use the current optimized data model.","gs.optimize_no_automatic_changes":"There are no automatic changes to apply. Review the items below.","gs.align_count":"{n} of {total} elements will move, by at most {cm} cm.","gs.align_where":"The largest shift is in “{s}”.","gs.align_turned":"Openings whose angle is corrected: {n}.","gs.align_removed_drafts":"Invalid outlines collapsed by the grid and removed: {n}.","gs.optimize_redundant_drafts":"Saved wall chains hidden by solid room walls and removed: {n}.","gs.align_preflight_failed":"Could not safely verify the geometry of the following spaces: {spaces}{more}.","gs.align_preflight_hint":"Plans were not changed. Copy the diagnostics with the button below and attach them to the bug report together with a space export.","gs.preflight_reason_prepare-exception":"Could not prepare the space geometry (exception while building the model)","gs.preflight_reason_wall-null":"The wall body did not build (the union came back empty)","gs.preflight_reason_wall-degraded-extra":"The wall body degraded with extra geometry","gs.preflight_reason_wall-failed-core":"The wall body core failed to assemble","gs.preflight_reason_wall-exception":"Wall construction threw an exception","gs.preflight_reason_floor-null":"The floor outline did not build","gs.preflight_reason_floor-exception":"Floor construction threw an exception","gs.preflight_copy":"Copy diagnostics","gs.preflight_copied":"Diagnostics copied","gs.preflight_update_hint":"The card and integration versions differ — update House Plan and retry.","gs.align_preflight_space":"Space {n}","gs.align_preflight_more":", and {n} more","gs.optimize_changes":"Model migrations: {m}; spaces updated: {c}; noisy coordinate values removed: {p}; merged real-wall fragments: {w}; merged zero-thickness wall fragments: {s}; independent walls: {i}.","gs.zero_walls_migrated":"Virtual wall spans converted: {n}.","gs.wall_segments_migrated":"Wall segments stabilised: {n}.","gs.optimize_lattice_summary":"Noisy coordinate values canonicalized: {n}; maximum movement: {cm} cm.","gs.optimize_lattice_space":"{space}: coordinate values canonicalized: {n}; off-grid values left unchanged: {far}.","gs.optimize_coincident_partitions":"Hidden independent wall sections absorbed into room walls: {n}.","gs.optimize_openings_rehosted":"Openings reattached to room walls: {n}.","gs.optimize_walls_straightened":"Walls straightened: {n}; maximum movement: {cm} cm.","gs.optimize_walls_straightened_where":"Largest wall correction: {s}.","gs.optimize_walls_straighten_skipped":"Near-axis walls left unchanged because they could not be repaired safely: {n}.","gs.optimize_glow_migration":"Legacy Glow: {spaces} spaces → no data fill + independent Glow; {rooms} rooms → inherited data fill + independent Glow.","gs.optimize_references":"References repaired: spaces — {spaces}; rooms — {rooms}; positions — {positions}; devices detached from missing spaces — {detached}.","gs.optimize_reference_more":", and {n} more","gs.optimize_orphans_removed":"Forgotten records removed: {total} — room labels: {rooms}; devices: {devices}; group markers: {groups}. They belonged to spaces deleted earlier.","gs.optimize_live_positions":"Old positions in deleted spaces belong to existing objects: {n}{names}. They will be kept.","gs.optimize_live_positions_remove":"Old positions in deleted spaces belong to existing objects: {n}{names}. They are selected for removal.","gs.optimize_live_names":": {names}{more}","gs.optimize_live_remove":"Remove old positions","gs.optimize_live_keep":"Keep old positions","gs.optimize_live_selected":"Old positions will be removed after Optimize is applied.","gs.optimize_unverified":"Could not safely verify positions: {n}. They were left unchanged.","gs.optimize_registry_limited":"Full administrator access to the Home Assistant registries is required for a safe check.","gs.optimize_vacuum_warning":"Vacuum room mappings that still need review: {n}.","gs.optimize_details":"Details","gs.optimize_details_more":"And {n} more records.","gs.optimize_detail_removed":"will be removed","gs.optimize_detail_live":"will be kept","gs.optimize_detail_unverified":"not verified","gs.optimize_detail_room_label":"room label","gs.optimize_detail_device":"device","gs.optimize_detail_group":"group marker","gs.optimize_detail_unknown":"unknown owner","gs.optimize_detail_item":"{status}: {kind} {id}; old space {space}","gs.align_warn":"Elements deliberately placed between grid nodes will move. One undo is available after the operation, only until the next plan edit.","gs.align_run":"Optimize","gs.align_done":"Plans optimized: {n} elements moved, {m} records maintained, {r} references repaired","gs.optimize_undo":"Undo last optimization","gs.optimize_undone":"The last optimization was undone","decor.furniture":"Furniture","furn.title":"Furniture library","furn.symbol":"Symbol","furn.group_furniture":"Furniture","furn.group_appliance":"Appliances","furn.group_sanitary":"Plumbing","furn.group_other":"Other","furn.width":"Width","furn.depth":"Depth","furn.pick_hint":"Pick a symbol, then click on the plan.","furn.place_hint":"Click on the plan — the piece lands against the nearest wall. Shift places it free.","furn.sym_sofa":"Sofa","furn.sym_armchair":"Armchair","furn.sym_coffee_table":"Coffee table","furn.sym_table_dining":"Dining table","furn.sym_table_round":"Round table","furn.sym_chair":"Chair","furn.sym_desk":"Desk","furn.sym_bed_double":"Double bed","furn.sym_bed_single":"Single bed","furn.sym_nightstand":"Nightstand","furn.sym_wardrobe":"Wardrobe","furn.sym_bookshelf":"Bookshelf","furn.sym_fridge":"Fridge","furn.sym_stove":"Cooker","furn.sym_dishwasher":"Dishwasher","furn.sym_washer":"Washing machine","furn.sym_dryer":"Tumble dryer","furn.sym_tv":"TV","furn.sym_ac":"Air conditioner","furn.sym_water_heater":"Water heater","furn.sym_toilet":"Toilet","furn.sym_bathtub":"Bathtub","furn.sym_shower":"Shower","furn.sym_sink":"Washbasin","furn.sym_kitchen_sink":"Kitchen sink","furn.sym_bidet":"Bidet","furn.sym_stairs":"Stairs","furn.sym_fireplace":"Fireplace","furn.sym_plant":"Plant","furn.sym_rug":"Rug","common.yes":"Yes","common.no":"No","vac.diag_source":"Source","vac.diag_platform":"Integration","vac.diag_status":"Status","vac.diag_position":"Position","vac.diag_rooms":"Rooms","vac.diag_rooms_value":"{total} · {matched} names match · {readiness}","vac.autocal_ready":"auto-calibration available","vac.autocal_not_ready":"need 3 matching names","vac.diag_path":"Integration path","vac.diag_map":"Map ID","vac.source_none":"not selected","vac.source_status_ok":"Ready","vac.source_status_missing":"Missing","vac.source_status_disabled":"Disabled in Home Assistant","vac.source_status_unavailable":"Unavailable","vac.source_status_unverified":"Cannot verify with current permissions","vac.source_status_unsupported":"No position data","vac.source_status_none":"No source","vac.source_banner_missing":"The saved source no longer exists. It was not replaced automatically; choose another source or restore it in Home Assistant.","vac.source_banner_disabled":"The saved source is disabled in Home Assistant. Enable it there or choose another source.","vac.source_banner_unverified":"Current Home Assistant permissions cannot verify this saved source. It remains pinned and will not be replaced automatically.","vac.choose_source":"Choose source","vac.source_auto":"Automatic","vac.source_auto_hint":"Use a compatible entity from this device","vac.all_cameras":"All cameras","vac.all_cameras_warn":"A camera may not provide robot data. Choose one only if it is your vacuum map.","vac.all_cameras_empty":"No other camera entities found.","vac.platform_unknown":"unknown integration","vac.cap_position":"position","vac.cap_rooms_short":"rooms","vac.cap_path":"path","vac.cap_map":"map ID","vac.cap_none":"no robot data detected","vac.xcme_hint":"Enable these Xiaomi Cloud Map Extractor attributes:","vac.documentation":"Documentation","vac.residual_title":"Check automatic calibration","vac.residual_message":"The matched rooms disagree by up to {error}. Apply this approximate calibration, refine it manually, or cancel without changing the saved setup.","vac.apply_proposal":"Apply","gs.backup_group":"Backup and transfer","gs.backup_hint":"Download a portable JSON backup or preview and import a backup made by House Plan.","backup.export_open":"Export","backup.import_open":"Import","backup.export_title":"Export House Plan","backup.import_title":"Import House Plan","backup.export_hint":"Choose whether the backup should contain the whole House Plan configuration or only the current space.","backup.full":"Full backup","backup.current_space":"Current space","backup.current_space_title":"Current space: {title}","backup.no_current_space":"No current space","backup.plan_only":"Plan only","backup.plan_only_hint":"Keep rooms, walls, openings, decor and room-label positions without devices or Home Assistant bindings.","backup.plan_only_preview":"This file contains the plan only","backup.privacy_warning":"The archive keeps names, Home Assistant identifiers and exact coordinates. Internal plans and attachments are referenced, not embedded; runtime states and vacuum trails are not included.","backup.download":"Download JSON","backup.export_done":"Backup downloaded","backup.reading":"Checking the backup…","backup.revalidated":"The plan changed after this preview. The summary was refreshed; review it and confirm again.","backup.error.unauthorized":"You do not have permission to export or import this plan.","backup.error.not_ready":"House Plan is not ready yet. Try again in a moment.","backup.error.too_large":"The backup exceeds the 8 MiB limit.","backup.error.invalid_json":"The selected file is not valid JSON.","backup.error.invalid_format":"The selected file is not a House Plan backup.","backup.error.unsupported_export_version":"This backup format is not supported by the installed version.","backup.error.future_model":"The backup was created by a newer House Plan data model.","backup.error.invalid_config":"The backup contains an invalid House Plan configuration.","backup.error.wall_model_migration_blocked":"The backup wall model could not be upgraded safely. Optimize the source plan first, then export it again.","backup.error.invalid_layout":"The backup contains invalid object positions.","backup.error.invalid_content":"The backup contains invalid or inconsistent content references.","backup.error.space_not_found":"The selected space no longer exists.","backup.error.capacity_exceeded":"Adding this backup would exceed the plan limits.","backup.error.preview_expired":"The preview expired. Select the backup file again.","backup.error.preview_owner_mismatch":"This preview belongs to another Home Assistant user.","backup.error.conflict":"The plan changed after the preview. Review the refreshed summary.","backup.error.content_confirmation_required":"Confirm that unavailable local content may be detached.","backup.error.commit_failed":"The backup could not be applied safely. The previous plan was restored or is pending recovery.","backup.error.missing_plan":"A referenced plan file disappeared after the preview. Review the backup again.","backup.error.missing_content":"A referenced local attachment disappeared after the preview. Review the backup again.","backup.error.marker_control_missing":"A linked plan light is missing from the backup.","backup.error.marker_control_not_light":"A linked plan target is no longer marked as a light source.","backup.error.marker_control_self":"A light source cannot control itself.","backup.error.marker_control_cycle":"The backup contains a circular chain of light controls.","backup.error.duplicate_marker_control":"The backup contains a duplicate plan-light link.","backup.error.no_backup":"There is no import or optimization snapshot to restore.","backup.same_source":"Created on this Home Assistant instance","backup.foreign_source":"Created on another Home Assistant instance","backup.created":"Created: {value}","backup.versions":"Card {card}; integration {integration}; data model {model}","backup.count_spaces":"Spaces: {n}","backup.count_rooms":"Rooms: {n}","backup.count_walls":"Walls: {n}","backup.count_openings":"Openings: {n}","backup.count_decor":"Decor objects: {n}","backup.count_markers":"Devices: {n}","backup.count_layout":"Positions: {n}","backup.bindings":"Bindings — devices: {device}, entities: {entity}, virtual: {virtual}; positions without a space: {legacy}","backup.binding_status":"Target status — active: {active}, disabled: {disabled}, missing: {missing}","backup.missing_areas":"Areas missing on the target: {areas}","backup.dropped_marker_links":"Plan-light links outside this transferred space were omitted: {n}.","backup.repaired_target_refs":"Existing references restored by this space import: {n}.","backup.preserved_unresolved_refs":"References that could not be restored unambiguously were preserved: {n}.","backup.preserved_unresolved_hint":"No data was guessed or deleted. After the import, run Optimize plans to inspect the remaining references.","backup.import_details":"Import reference details","backup.import_detail.incoming_remapped":"References updated inside the imported copy: {n}","backup.import_detail.target_repaired":"Existing references restored: {n}","backup.import_detail.preserved_unresolved":"Unresolved references preserved: {n}","backup.import_detail.collisions":"Destination conflicts preserved safely: {n}","backup.import_detail.dropped_links":"Incoming links omitted by transfer rules: {n}","backup.import_detail.bounded_lineages":"Overly nested identifiers left bounded: {n}","backup.replace_warning":"This replaces the current configuration and layout. Uploaded files are never deleted. One undo remains available until the next plan edit.","backup.foreign_bookkeeping":"Instance-specific known/new-device bookkeeping will not be imported.","backup.final_name":"New space name","backup.target_settings":"The target instance's global settings remain unchanged.","backup.duplicates":"Bindings already present: {n}","backup.skip":"Skip duplicate devices","backup.virtual_copy":"Add safe static virtual copies","backup.content":"Referenced content","backup.content_available":"available locally","backup.content_external":"external link","backup.content_detach_required":"will be detached","backup.confirm_detach":"I understand that unavailable internal plans and attachments will be detached from the imported configuration.","backup.replace":"Replace","backup.add":"Add space","backup.space_done":"Space imported: {rooms} rooms, {markers} devices, {refs} existing references restored","backup.full_done":"Backup restored: {spaces} spaces, {rooms} rooms, {markers} devices","backup.undo_import":"Undo last full import","backup.import_undone":"Full import undone"},Ud={"editor.context_actions":"Действия: {object}","editor.tool_options":"Параметры инструмента: {tool}","editor.palette":"Палитра: {tool}","editor.open_group":"Группа инструментов: {group}","editor.group_active":"{group} — активно: {item}","editor.disabled_action":"{action} недоступно: {reason}","editor.loading":"Загружаем редактор…","editor.loading_aria":"Редактор плана загружается","editor.load_failed":"Не удалось загрузить редактор.","editor.refresh_advice":"Обновите страницу и повторите попытку.","color_picker.title":"Выбор цвета","color_picker.hue":"Оттенок","color_picker.saturation":"Насыщенность","color_picker.value":"Яркость","color_picker.hex":"Цвет HEX","color_picker.invalid_hex":"Введите цвет HEX из 3 или 6 цифр","btn.properties":"Свойства","btn.keep_as_walls":"Оставить стенами","btn.delete_room_keep_walls":"Удалить комнату, оставить стены","btn.delete_room_with_walls":"Удалить комнату и стены","title.markup_select":"Выбор и редактирование стен, колонн и сохранённых контуров","title.markup_column":"Колонна: кликните точку сетки для квадратной колонны","markup.partition":"Перегородка","markup.column":"Колонна","markup.hint_column":"кликните точку сетки, чтобы поставить квадратную колонну","history.draft_segment":"Добавление сегмента черновика комнаты","history.draft_merge":"Соединение незавершённых контуров комнаты","history.draft_segment_delete":"Удаление сегмента черновика комнаты","history.partition_add":"Добавление перегородки","history.column_add":"Добавление колонны","history.physical_edit":"Изменение физического объекта","history.physical_delete":"Удаление физического объекта","history.physical_move":"Перемещение физического объекта","history.contour_to_partitions":"Преобразование контура в замкнутые стены","history.wall_chain_finish":"Завершение цепочки стен","history.wall_face_batch":"Создание комнат из стен","toast.column_duplicate":"Колонна с тем же центром и внешним размером уже существует","confirm.delete_draft":"Удалить весь незавершённый контур комнаты?","confirm.delete_draft_segment":"Удалить этот сегмент черновика? Оставшийся контур может разделиться на два.","physical.partition_properties":"Свойства перегородки","physical.column_properties":"Свойства колонны","physical.draft_properties":"Свойства сегмента черновика","physical.shape":"Форма","physical.square":"Квадрат","physical.circle":"Круг","physical.diameter":"Диаметр","physical.side":"Сторона","physical.rotation":"Угол поворота","physical.length":"Длина","physical.allowed_range":"Допустимо: {min}–{max} {unit}","physical.delete_segment":"Удалить сегмент","physical.delete_draft":"Удалить весь контур","physical.column_size_title":"Внешняя сторона квадратной колонны, создаваемой кликом (1–150 см).","card.title":"План дома","count.devices":"{n} устр.","empty.no_spaces":"Пространств пока нет.","empty.add_first":"Добавьте первое пространство и загрузите план этажа.","empty.install":"Установите интеграцию House Plan и добавьте запись в «Устройства и службы».","btn.add_space":"Добавить пространство","btn.cancel":"Отмена","btn.save":"Сохранить","btn.close":"Закрыть","btn.delete":"Удалить","btn.edit":"Редактировать","btn.open_in_ha":"Открыть в HA","btn.reset":"Сброс","btn.attach":"Прикрепить…","btn.upload":"Загрузить…","btn.replace":"Заменить…","title.zoom_in":"Приблизить","title.zoom_out":"Отдалить","title.zoom_fit":"Вписать всё","title.markup":"Разметка комнат: сетка, линии, контуры","title.configure_space":"Настроить пространство","title.add_space":"Добавить пространство","title.markup_add":"Стены: рисуйте непрерывную цепочку; Shift фиксирует 45°. Смена инструмента или выход завершает её как независимые стены","title.markup_merge":"Объединить: клик по одной комнате, затем по соседней с общей стеной","title.markup_split":"Разделить комнату: клик по комнате, затем две точки на её стенах","title.markup_delroom":"Удалить комнату: кликните внутри комнаты и подтвердите удаление","title.need_plan":"Загрузите подложку (план этажа)","markup.add":"Стены","markup.merge":"Объединить","markup.split":"Разделить","markup.resize":"Размер","title.markup_resize":"Изменение размера комнат: тяните доступную ручку горизонтальной или вертикальной стены","markup.hint_resize":"тяните доступную ручку стены · стена упирается в первую небезопасную позицию · Esc — отмена · Ctrl+Z — отмена шага","resize.disabled.diagonal":"Стена расположена под углом: Resize поддерживает только горизонтальные и вертикальные стены","resize.disabled.side-angle":"Примыкающая стена расположена под углом: для Resize обе примыкающие стены должны образовывать прямой угол","resize.disabled.duplicate-physical-wall":"Стену перекрывает отдельная перегородка, незавершённый контур или колонна; удалите или переместите её перед изменением размера","resize.disabled.partial-shared":"Соседняя комната использует только часть этой стены, поэтому её нельзя безопасно двигать как одну общую стену","resize.disabled.unequal-shared":"У соседней комнаты другие конечные точки или длина стены, поэтому стены нельзя безопасно двигать вместе","resize.disabled.multiple-rooms":"Перемещение затронуло бы больше двух комнат","resize.disabled.thickness-conflict":"Толщину стены нельзя безопасно сохранить","resize.disabled.opening-conflict":"Проём на этой стене нельзя безопасно переместить","resize.disabled.invalid-geometry":"Эту стену нельзя переместить без изменения структуры плана","resize.limit_stopped":"Стена остановлена: дальше нарушается ограничение стыков","resize.commit_failed":"Изменение размера отменено: итоговый план не прошёл проверку геометрии","resize.preview_failed":"Стена остановлена в последней безопасной позиции: геометрию плана нельзя сохранить без потерь","markup.opening":"Проём","markup.delete_room":"Удалить комнату","history.undo":"Отменить","history.redo":"Повторить","history.undo_named":"Отменить: {name} (Ctrl+Z)","history.redo_named":"Повторить: {name} (Ctrl+Shift+Z / Ctrl+Y)","history.undo_empty":"Нет операций для отмены","history.redo_empty":"Нет операций для повтора","history.undone":"Отменено: {name}","history.redone":"Повторено: {name}","history.add_room":"Создание комнаты","history.split_room":"Разделение комнаты","history.merge_rooms":"Объединение комнат","history.resize_room":"Изменение размера комнаты","history.wall_thickness":"Изменение толщины стены","history.add_opening":"Добавление дверного или оконного проёма","history.edit_opening":"Изменение проёма","history.move_opening":"Перемещение проёма","history.delete_opening":"Удаление проёма","history.delete_room":"Удаление комнаты","history.delete_room_keep_walls":"Удаление комнаты с сохранением стен","history.delete_room_with_walls":"Удаление комнаты и её стен","history.decor_add":"Добавление объекта декора","history.decor_edit":"Изменение объекта декора","history.decor_move":"Перемещение объекта декора","history.decor_transform":"Трансформация объекта декора","history.decor_delete":"Удаление объекта декора","history.backdrop_transform":"Трансформация подложки плана","opening.new":"Новый проём","opening.edit":"Проём","opening.door":"Дверь","opening.window":"Окно","opening.gate":"Ворота","opening.passage":"Открытый проём","opening.passage_binding_warning":"При сохранении датчик открытия и замок будут удалены.","opening.invalid_passage_fields":"У открытого проёма на плане «{room}» есть недопустимые параметры: {fields}.","opening.type_label":"Тип","opening.length_label":"Длина, см","opening.contact_label":"Датчик открытия","opening.lock_label":"Замок","opening.none":"— нет —","opening.search_ph":"Поиск: имя или entity_id…","opening.invert":"Инвертировать открыто/закрыто","opening.flip_h":"Петли с другой стороны","opening.flip_v":"Открывается в другую сторону","opening.open":"Открыто","opening.closed":"Закрыто","opening.locked":"Заперто","opening.unlocked":"Не заперто","opening.state_unknown":"недоступно","opening.no_entities":"Датчики не привязаны — статичный символ на плане.","toast.opening_no_wall":"Кликните рядом со стеной комнаты или независимой стеной","opening.host_partition":"Независимая стена","opening.partition_orphan":"Независимая стена этого проёма больше не существует","opening.partition_jamb_margin":"Оставьте от края проёма до торца стены минимум {distance}","opening.rebind_partition":"Привязать к другой независимой стене","confirm.delete_partition_openings_title":"Удалить стену и проёмы?","confirm.delete_partition_openings_body":"В стене есть проёмы: {count}. Они будут удалены вместе со стеной.","confirm.delete_partition_openings_item":"• {type}, {length}","markup.delete":"Удалить","markup.hint_points":"точек: {n} · Shift — шаг 45° · Esc — завершить цепочку · Ctrl+Z — убрать точку · при замыкании будет предложена комната","markup.hint_start":"кликните точку сетки, чтобы начать цепочку стен","tip.lqi":"средний сигнал zigbee:","tip.area":"площадь: {value}","info.device_header":"Устройство на плане","info.model":"Модель","info.state":"Состояние","info.link":"Ссылка","info.manuals":"Инструкции","info.none":"Нет дополнительной информации","marker.new_device":"Новое устройство","marker.name_label":"Имя (отображается на плане)","marker.name_ph":"Название","marker.binding_label":"Привязка к устройству HA","marker.binding_disabled":"деактивировано в Home Assistant","marker.virtual_option":"Виртуальное устройство (без привязки)","marker.search_ph":"Поиск устройства / группы…","marker.nothing_found":"ничего не найдено","marker.room_label":"Комната","marker.room_override":" (переопределить размещение)","marker.room_choose":"— выберите комнату —","marker.room_auto":"— по зоне устройства (авто) —","marker.icon_label":"Иконка","marker.icon_ph":"mdi:… (пусто = авто)","marker.display_label":"Отображение","display.badge":"Значок + состояние","display.icon_ripple":"Значок + состояние и активность","display.static_icon":"Всегда статичный значок","marker.display_hint":"Значок + состояние меняет подложку при работе, открытии, тревоге и недоступности. Значок + состояние и активность дополнительно показывает короткую пульсацию для событий и постоянную — для работы, движения или присутствия. Значение + состояние заменяет значок одним однозначным значением HA. Статичный значок не реагирует на состояния устройства.","marker.display_hint_badge":"Значок и динамическая подложка показывают состояние устройства без обычной пульсации активности. Красная тревога сохраняется.","marker.display_hint_icon":"Значок и динамическая подложка показывают состояние устройства без обычной пульсации активности. Красная тревога сохраняется.","marker.display_hint_icon_ripple":"Значок, динамическая подложка и пульсация: короткая — для событий, постоянная — для работы, движения или присутствия. Красная тревога имеет отдельный приоритет.","marker.display_hint_value":"Значок заменяется одним однозначным значением Home Assistant; подложка продолжает показывать состояние. Красная тревога сохраняется.","marker.display_hint_static_icon":"Подложка в цветах темы и значок всегда остаются одинаковыми. Состояния, активность, недоступность и тревоги не меняют отображение.","marker.static_alarm_warning":"Это устройство может сообщать о тревогах. Статичный режим скрывает визуальную тревогу маркера.","marker.preview.title":"Предпросмотр отображения","marker.preview.actual":"Сейчас","marker.preview.example":"Пример","marker.preview.integration":"Интеграция","marker.preview.source":"Источник отображения","marker.preview.current_state":"Текущее состояние","marker.preview.result":"На плане","marker.preview.details":"Подробнее об источниках","marker.preview.select_source":"Выберите устройство или сущность Home Assistant, чтобы увидеть фактическое отображение.","marker.preview.unknown_provider":"Интеграция неизвестна","marker.preview.virtual_provider":"House Plan · виртуальное устройство","marker.preview.no_source":"Нет активного источника","marker.preview.no_state":"Нет текущего состояния","marker.preview.mixed_states":"Несколько разных состояний","marker.preview.multiple_sources":"Источников: {n}","marker.preview.more_sources":"ещё {n}","marker.preview.scaled":"Предпросмотр уменьшен до {n}%, чтобы поместиться. Сохранённый размер не изменится.","marker.preview.demo_short":"Показать краткую активность","marker.preview.demo_continuous":"Показать постоянную активность","marker.preview.stop_continuous":"Остановить постоянную активность","marker.preview.demo_short_notice":"Пример краткой активности; фактическое состояние устройства не меняется.","marker.preview.demo_continuous_notice":"Пример постоянной активности; фактическое состояние устройства не меняется.","marker.preview.demo_already_visible":"Текущее состояние уже показывает реальную активность или тревогу.","marker.preview.reduced_motion":"В системе включено уменьшение движения, поэтому обычная активность показана точкой.","marker.preview.reason.neutral":"Нейтральная тёмная подложка","marker.preview.reason.working":"Жёлтая подложка: устройство сейчас работает","marker.preview.reason.working_activity":"Жёлтая подложка и эффект активности: устройство сейчас работает","marker.preview.reason.open":"Оранжевая подложка: физически открыто или разблокировано","marker.preview.reason.cover_icon_state":"Нейтральная подложка; состояние и значок определяет сущность шторы или заслонки","marker.preview.reason.presence":"Эффект активности, пока обнаружено присутствие","marker.preview.reason.event":"Короткий эффект активности после события","marker.preview.reason.transition":"Эффект активности во время движения или смены состояния","marker.preview.reason.media_neutral":"Медиаустройство остаётся на нейтральной тёмной подложке, пока доступно","marker.preview.reason.unavailable":"Приглушённая нейтральная подложка: отключено или недоступно","marker.preview.reason.alarm":"Красная тревожная подложка; тревога отображается всегда","marker.preview.reason.live_states_disabled":"Оформление по живым состояниям отключено в настройках карточки","marker.preview.reason.value_no_state":"Нет подходящего значения состояния — вместо него показан значок","marker.preview.reason.value_ambiguous_sources":"Подходит несколько источников значения — вместо него показан значок","marker.preview.reason.value_non_scalar":"Источник вернул не простое значение — вместо него показан значок","marker.preview.reason.value_virtual":"У виртуального устройства нет значения HA — вместо него показан значок","marker.preview.reason.vacuum_live_plan_only":"Живая позиция и след пылесоса доступны только на полном плане","marker.preview.reason.hidden_design_preview":"Устройство скрыто на плане, но его оформление видно в предпросмотре","marker.preview.reason.composite_power_source":"Состояние берётся из сущности питания устройства; вспомогательные переключатели не учитываются","marker.preview.reason.activity_display_disabled":"Выбранный режим отображения не показывает обычные эффекты активности","marker.preview.reason.ha_disabled":"Привязка отключена в Home Assistant, поэтому устройство будет скрыто на плане","marker.preview.reason.orphaned":"Сохранённая привязка Home Assistant больше не найдена","marker.preview.reason.static_icon":"Статичный режим: состояние устройства не меняет значок","marker.activity_color":"Цвет пульсации активности","marker.ripple_size":"Размер пульсации активности","marker.activity_alarm_note":"Цвет и размер относятся только к обычной активности и не влияют на красную тревогу.","marker.pulse_a11y_alarm":"Тревога","marker.pulse_a11y_event":"Недавнее событие","marker.pulse_a11y_presence":"Обнаружено присутствие","marker.pulse_a11y_transition":"Изменение состояния","marker.pulse_a11y_running":"Работает","marker.state_a11y_neutral":"Обычное состояние","marker.state_a11y_working":"Работает","marker.state_a11y_open":"Открыто","marker.state_a11y_locked":"Заблокировано","marker.state_a11y_unlocked":"Разблокировано","marker.state_a11y_alarm":"Тревога","marker.state_a11y_unavailable":"Недоступно","marker.lqi_a11y_low":"LQI {value}, слабый сигнал","marker.lqi_a11y_mid":"LQI {value}, средний сигнал","marker.lqi_a11y_high":"LQI {value}, сильный сигнал","marker.size_label":"Размер / поворот значка","marker.angle_label":"Поворот","marker.model_label":"Модель","marker.model_ph":"напр. Aqara T&H","marker.link_label":"Ссылка","marker.desc_label":"Описание","marker.desc_ph":"Заметки, характеристики…","marker.manuals_label":"Инструкции (PDF и т.п.)","marker.sub_device":"устройство","marker.sub_z2m_group":" · Z2M-группа","marker.sub_group":"группа","marker.sub_helper":"хелпер","space.new":"Новое пространство","space.header":"Пространство","space.title_label":"Название","space.title_ph":"Например: Гараж","space.plan_label":"Подложка (план)","space.no_plan":"нет подложки","space.plan_alt":"план","room.new":"Новая комната","room.name_label":"Отображаемое имя","room.name_ph":"Например: Терраса","room.area_label":"Зона Home Assistant (свободные)","room.no_area_option":"— без зоны —","room.default_name":"Комната","device.unnamed":"без имени","device.light_group":"группа света","device.fallback":"устройство","device.virtual":"виртуальное устройство","confirm.delete_room":"Удалить комнату «{name}»?","confirm.delete_room_title":"Удалить комнату «{name}»?","confirm.delete_room_body":"Выберите, нужно ли оставить физические стены, принадлежащие только этой комнате. Общие с другой комнатой стены сохраняются всегда.","confirm.remove_marker":"Удалить «{name}» с плана? Устройство исчезнет полностью и перестанет участвовать в данных плана. Позже его можно будет добавить заново.","confirm.erase_decor":"Стереть объект «{kind}»? Действие можно отменить из истории редактора.","confirm.delete_space":"Удалить пространство «{title}» со всеми комнатами и разметкой?","space.delete_blocked":"Это пространство всё ещё используется устройствами: {n}. Сначала перенесите их в другое пространство или удалите.","toast.pos_save_failed":"Не удалось сохранить позицию: {err}","toast.no_entity":"У устройства нет подходящей сущности","toast.ha_disabled_action":"Деактивированный объект Home Assistant нельзя использовать на плане.","toast.ha_disabled_show_device":"Деактивированное в Home Assistant устройство нельзя показать на плане. Сначала активируйте его в Home Assistant.","toast.ha_disabled_show_entity":"Деактивированную в Home Assistant сущность нельзя показать на плане. Сначала активируйте её в Home Assistant.","toast.ha_disabled_add":"Деактивированный объект Home Assistant нельзя добавить на план. Сначала активируйте его в Home Assistant.","toast.ha_binding_unverified":"Статус объекта не удалось подтвердить по реестру Home Assistant. Отображение и действия временно недоступны.","toast.markup_needs_server":"Разметка доступна после переноса конфига на сервер","toast.space_order_changed":"Порядок изменён. Если где-то этаж карточки задан номером, проверьте такие панели.","toast.conflict":"Конфиг изменён в другом окне — данные обновлены, повторите последнее действие","toast.cfg_save_failed":"Не удалось сохранить конфиг: {err}","toast.room_overlap":"Контур накладывается на комнату «{name}» — комнаты не должны накладываться","toast.contour_cannot_close":"Контур нельзя замкнуть: он вырожден или пересекает сам себя","toast.merge_not_adjacent":"Объединять можно только комнаты с общей стеной","toast.rooms_merged":"Комнаты объединены в «{name}»","toast.split_pick_wall":"Начните разрез на стене комнаты","toast.split_bad_cut":"Разрез — от стены до стены внутри комнаты, без пересечения стен и самого себя","merge.header":"Объединение комнат","merge.hint":"У объединённой комнаты одно имя и одна зона. Вторая зона освобождается — её устройства уйдут с плана, пока их не заберёт другая комната.","merge.keep":"Оставить","merge.no_area":"без зоны","toast.room_saved":"Комната сохранена ({n}). Устройств добавлено: {added}. Обведите следующую или выйдите из разметки.","toast.room_saved_no_area":"Комната сохранена ({n}, без зоны). Обведите следующую или выйдите из разметки.","toast.marker_needs_server":"Редактирование устройств доступно после переноса конфига на сервер","toast.virtual_name_required":"Укажите имя виртуального устройства","toast.marker_saved":"Устройство сохранено","toast.marker_removed":"Устройство удалено с плана","toast.integration_missing":"Интеграция House Plan не установлена — управление недоступно","toast.plan_formats":"Поддерживаются SVG, PNG, JPG, WebP","toast.plan_required":"Загрузите подложку — план этажа обязателен","toast.space_added_onboard":"Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.","toast.space_added":"Пространство добавлено","toast.space_saved":"Пространство сохранено","toast.space_deleted":"Пространство удалено","toast.delete_failed":"Ошибка удаления: {err}","toast.error":"Ошибка: {err}","toast.toggle_target_unavailable":"Цель «{name}» недоступна — действие не выполнено","toast.toggle_targets_unavailable":"Цели недоступны: {names}. Действие не выполнено","toast.file_failed":"Файл «{name}» не загружен: {err}","toast.files_attached":"Прикреплено файлов: {n}","err.unknown":"неизвестная ошибка","err.code":"код {code}","err.too_large":"файл больше {mb} МБ","err.bad_ext":"недопустимый тип (нужен PDF/изображение)","err.unauthorized":"нужны права администратора","editor.title":"Заголовок","editor.default_floor":"Стартовое пространство","editor.default_floor_missing":"Стартовое пространство «{id}» больше не существует. Выберите другое.","editor.floor":"Закреплённое пространство","editor.floor_none":"— не закреплять —","editor.floor_index":"YAML-индекс {index} (сохранён)","fixed_floor.loading":"Загружаем закреплённое пространство…","fixed_floor.invalid_title":"Закреплённое пространство недоступно","fixed_floor.invalid_body":"Проверьте floor в конфигурации карточки. Настроенное значение: {value}","editor.icon_size":"Размер иконок, % ширины плана","editor.show_temperature":"Показывать температуру","editor.live_states":"Живые состояния (вкл/выкл, открыто…)","editor.show_signal":"Показывать сигнал zigbee (LQI)","editor.language":"Язык интерфейса","editor.lang_auto":"Авто (профиль HA)","title.icon_rules":"Правила иконок: какая MDI-иконка достаётся устройству по имени","rules.title":"Правила иконок","rules.hint":"Правила проверяются сверху вниз по строке «имя устройства + модель» (regex без учёта регистра); срабатывает первое совпадение. Если ничего не подошло — решает device class сущности, затем — иконка-заглушка.","rules.pattern_ph":"regex, напр. розетк|plug","rules.icon_ph":"mdi:power-socket-de","rules.add":"Добавить правило","rules.reset":"Сбросить к умолчаниям","rules.test_ph":"Проверьте имя устройства…","rules.invalid":"некорректный regex","rules.saved":"Правила иконок сохранены","btn.up":"Вверх","btn.down":"Вниз","tap.info":"Карточка устройства","tap.more_info":"Диалог HA (more-info)","tap.toggle":"Переключить состояние","marker.tap_label":"Действие по нажатию для этого устройства","tap.toggle_note":"Под селектором показано, какое состояние изменится. Защищённые устройства не переключаются с плана.","import.title":"Создать пространства из этажей HA","import.hint":"Home Assistant уже знает эти этажи. Отметьте, какие превратить в пространства плана — далее для каждого попросим картинку плана. Комнаты затем обводятся вручную по плану.","import.start":"Создать: {n}","import.manual":"Начать с нуля","import.progress":"Этаж {i} из {n}","import.done":"Пространства созданы. Обведите комнаты: кликайте по точкам сетки и замкните контур.","btn.skip":"Пропустить","space.scale_label":"Масштаб (размер клетки сетки)","space.scale_unit":"см на клетку","space.scale_unit_imperial":"дюйм на клетку","space.display_section":"Отображение","space.show_borders":"Всегда отображать границы комнат","space.zero_wall_style":"Стены нулевой толщины","space.zero_wall_dashed":"Пунктирные","space.zero_wall_solid":"Сплошные","space.zero_wall_help":"Пунктирные стены пропускают свет. Сплошные стены блокируют свет, даже при нулевой толщине.","space.show_names":"Отображать названия комнат (перетаскиваются)","space.room_color":"Цвет границ и названий","space.opacity":"Прозрачность","space.fill_label":"Заливка комнат","fill.none":"Нет","fill.lqi":"По силе зигби-сигнала","fill.light":"По освещению","fill.custom":"Свой цвет","space.custom_fill":"Цвет заливки","space.source_file":"У меня есть картинка плана","space.source_draw":"Нет подложки — нарисую комнаты вручную","fill.temp":"По температуре","tip.temp_avg":"средняя температура:","tip.hum_avg":"средняя влажность:","space_card.button":"Перейти к пространству","space_card.not_found":"Пространство «{id}» не найдено","space_card.loading":"Загрузка…","continuity.restore_plan":"Восстанавливаем план…","continuity.restore_connection":"Восстанавливаем подключение к устройствам…","continuity.retry":"Повторить","editor.space":"Пространство","editor.show_button":"Показывать кнопку","editor.button_label":"Текст кнопки","editor.button_target":"Путь дашборда (куда вести)","marker.sub_entity":"сущность","title.general_settings":"Общие настройки","gs.title":"Общие настройки","gs.hint":"Цвета заливок действуют на все пространства; у каждого цвета своя прозрачность. Какой режим заливки использует пространство — задаётся в его диалоге.","gs.light_group":"Заливка: освещение","gs.light_on":"Свет включён","gs.light_off":"Весь свет выключен","gs.temp_group":"Заливка: температура","gs.temp_cold":"Холодно","gs.temp_ok":"Комфорт","gs.temp_hot":"Жарко","gs.lqi_group":"Заливка: зигби-сигнал","gs.lqi_low":"Слабый сигнал","gs.lqi_high":"Сильный сигнал","gs.reset":"Сбросить к умолчаниям","gs.saved":"Общие настройки сохранены","space.show_lqi":"Показывать зигби-сигнал (LQI) у устройств","space.hide_decor":"Скрыть декоративный слой","space.hide_decor_tip":"Линии, фигуры, надписи и мебель остаются на месте — их видно в редакторе подложки, но не на плане.","space.hide_openings":"Скрыть проёмы","space.hide_openings_tip":"Двери, окна и ворота не рисуются, но продолжают работать: свет проходит, солнце светит в окна, датчики открытия срабатывают. В редакторе плана проёмы видно всегда.","gs.light_none":"Нет источников света","mode.plan":"Редактор плана","mode.devices":"Редактор устройств","display.value":"Значение + состояние","marker.subarea":"без зоны, вручную","device.new":"Новое устройство — откройте его редактор, чтобы снять отметку","opening.unlock_action":"Открыть замок","opening.lock_action":"Закрыть замок","opening.lock_pending":"Выполняется…","title.close_editor":"Закрыть редактор (вернуться к просмотру)","devbar.rules":"Правила иконок","device_inbox.button":"Устройства","device_inbox.title":"Устройства на плане","device_inbox.search":"Поиск по устройствам, сущностям и интеграциям…","device_inbox.add_virtual":"Добавить виртуальное устройство","device_inbox.tab_on_plan":"На плане","device_inbox.tab_available":"Доступны","device_inbox.tab_hidden":"Скрытые","device_inbox.tab_readd":"Доступны снова","device_inbox.only_new":"Только новые","device_inbox.show_entities":"Показывать сущности","device_inbox.show_hidden":"Показывать скрытые на плане","device_inbox.new":"Новое","device_inbox.find":"Найти на плане","device_inbox.edit":"Настроить","device_inbox.hide":"Скрыть","device_inbox.show":"Показать","device_inbox.add":"Добавить","device_inbox.readd":"Добавить заново","device_inbox.hide_available":"Скрыть из списка","device_inbox.show_more":"Показать ещё","device_inbox.more_actions":"Другие действия","device_inbox.find_hidden_hint":"Сначала включите «Показывать скрытые на плане»","device_inbox.show_disabled":"Перед показом активируйте эту привязку в Home Assistant","device_inbox.empty_on_plan":"На плане пока нет подходящих устройств.","device_inbox.empty_available":"Нет доступных устройств для добавления.","device_inbox.empty_hidden":"Скрытых устройств нет.","device_inbox.empty_readd":"Нет удалённых устройств, доступных для повторного добавления.","device_inbox.reason_visible_auto":"Найдено автоматически","device_inbox.reason_visible_explicit":"Добавлено явно","device_inbox.reason_manual_hidden":"Скрыто пользователем","device_inbox.reason_automatic_hidden":"Скрыто автоматически","device_inbox.reason_service_entry":"Служебная запись реестра","device_inbox.reason_excluded_integration":"Интеграция исключена фильтрами устройств","device_inbox.reason_excluded_domain":"Непространственный тип сущности","device_inbox.reason_grouped_light":"Представлено группой света комнаты","device_inbox.reason_represented_by_parent":"Представлено родительским устройством","device_inbox.reason_removed":"Ранее удалено с плана","device_inbox.reason_available":"Можно добавить на план","device_inbox.reason_no_bound_room":"Зона HA не связана с комнатой плана","device_inbox.status_ha_disabled":"Отключено в Home Assistant","device_inbox.status_orphaned":"Привязка больше не найдена в Home Assistant","device_inbox.status_unverified":"Реестр Home Assistant временно недоступен","device_inbox.saved":"Список устройств обновлён","space.roomcard_section":"В карточке комнаты:","space.label_temp":"Температура","space.label_hum":"Влажность","space.label_lqi":"Средний Zigbee-сигнал","space.label_light":"Свет вкл/выкл","roomcard.light_on":"Вкл","roomcard.light_off":"Выкл","roomcard.light_partial":"{on} из {total}","toast.split_pick_inside":"Промежуточные точки разреза — внутри комнаты","mode.decor":"Редактор подложки","decor.select":"Выбрать","decor.line":"Линия","decor.rect":"Прямоугольник","decor.ellipse":"Овал","decor.text":"Надпись","decor.erase":"Стереть","decor.erase_confirm_title":"Стереть объект?","decor.color":"Цвет","decor.width":"Толщина линии","decor.line_style":"Стиль линии","decor.line_style_solid":"Сплошная","decor.line_style_dashed":"Пунктирная","decor.fill":"Заливка","decor.fill_color":"Цвет заливки","decor.length":"Длина","decor.size":"Размер","decor.angle":"Угол поворота, °","decor.text_size":"Размер текста","decor.backdrop_properties":"Свойства картинки-подложки","decor.text_title":"Надпись","decor.object_title":"Редактирование: {kind}","decor.text_label":"Текст","decor.live_group":"Вставить переменную HA","decor.live_entity":"Сущность","decor.live_entity_ph":"выберите сущность","decor.live_attr":"Значение","decor.live_attr_ph":"выберите состояние или атрибут","decor.live_state":"Состояние","decor.backdrop":"Картинка-подложка","decor.backdrop_hint":"Тяните картинку — перемещение; угол — размер; верхнюю ручку — поворот. Shift меняет пропорции или снимает шаг угла.","decor.backdrop_reset":"Вернуть картинку","decor.backdrop_reset_done":"Картинка вернулась на своё место и в свой размер","marker.icon_auto":"Авто: {icon} (по правилам иконок; выберите свою, чтобы заменить)","marker.icon_pin_auto":"Закрепить","mode.plan_tip":"Редактор плана — геометрия дома: рисование и объединение/разделение комнат, привязка к зонам HA, двери, окна и ворота, карточки комнат, масштаб","mode.devices_tip":"Редактор устройств — всё про значки: перетаскивание, клик — настройка привязки/иконки/отображения, виртуальные устройства, правила иконок","mode.decor_tip":"Редактор подложки — чисто визуальный декор под планом: линии, прямоугольники, овалы и надписи, не реагирующие на клики","space.glow_enabled":"Свечение источников света","gs.glow_group":"Свечение источников света","gs.glow_base":"Темнота дома","gs.glow_light":"Цвет света по умолчанию / интенсивность","gs.wall_group":"Стены","gs.wall_fill":"Цвет заливки стен","gs.glow_radius":"Радиус свечения","gs.unit_m":"м","gs.unit_ft":"фут","marker.controls_label":"Управляет другими источниками света","marker.controls_hint":"При действии «Переключить» клик разом переключает все добавленные здесь источники. Собственная сущность маркера управляется напрямую и сюда не добавляется; чтобы считать её светом, включите флаг ниже.","marker.controls_filter":"Поиск ламп и выключателей…","info.controls":"Управляет","marker.glow_radius_label":"Радиус свечения","marker.glow_radius.help":"Задаёт радиус свечения в метрах или футах; пустое значение использует радиус из общих настроек.","marker.glow_radius.help.aria":"Подсказка: радиус свечения","markup.wallthick":"Толщина","markup.select":"Выбрать","title.markup_wallthick":"Толщина — клик по стене задаёт толщину от 0 до 100 см.","markup.hint_wallthick":"клик по стене · Esc закрывает без применения","wallthick.field":"Толщина","wallthick.unit_cm":"см","wallthick.unit_in":"дюйм","wallthick.apply_room":"Применить ко всем стенам комнаты","markup.draw_wall_title":"Толщина каждого нового сегмента стены (0–100 см). Общие стены сохраняют существующее значение.","room.queue_progress":"Комната {current} из {total}","toast.wall_rooms_saved":"Создано комнат: {n}","toast.wall_chain_saved":"Цепочка стен сохранена","toast.wallthick_pick":"Кликните по стене","toast.wallthick_set":"Толщина стены задана","toast.wallthick_cleared":"Толщина стены убрана","toast.physical_range":"Введите значение от {min} до {max} {unit}","toast.zero_wall_opening_conflict":"Сначала удалите проём на этом участке стены.","toast.zero_wall_ambiguous":"Не удалось однозначно выбрать участок стены. Уточните геометрию узла.","toast.zero_wall_migration_blocked":"Пространство не преобразовано: {reason}. Данные не изменены.","toast.physical_angle":"Введите угол поворота от 0° до 90°, не включая 90°","toast.physical_limit":"В пространстве достигнут лимит объектов этого типа","toast.geometry_unsafe":"Изменение отменено: геометрию стен нельзя безопасно построить.","junction.limit_angle":"Слишком острый угол между стенами: {actual}°, минимум {limit}°.","junction.limit_valence":"Слишком много стен в одном узле: {actual}, максимум {limit}.","junction.limit_length":"Слишком короткий участок стены: {actual} см, минимум {limit} см.","junction.limit_distance":"Стены и узлы слишком близко: {actual} см, минимум {limit} см.","junction.limit_clearance":"Внутри комнаты не остаётся места: {actual} см², минимум {limit} см².","junction.limit_check_failed":"Проверку стыков выполнить не удалось — изменение не сохранено","toast.wall_model_migration_blocked":"Не удалось обновить модель стен: {reason}. План не изменён. Запустите «Оптимизировать планы»; если ошибка повторится, исправьте конфликтующую геометрию стен.","toast.wall_model_client_outdated":"Обновите карточку и перезагрузите страницу перед редактированием плана.","wall_model.reason.invalid-room":"некорректный контур комнаты","wall_model.reason.zero-length":"отрезок стены нулевой длины","wall_model.reason.third-owner":"стена принадлежит более чем двум комнатам","wall_model.reason.duplicate-id":"конфликт идентификаторов стен","wall_model.reason.thickness-conflict":"конфликт значений толщины стены","wall_model.reason.opening-host":"проём нельзя однозначно привязать к стене","toast.delete_room_pick":"Кликните внутри комнаты, которую нужно удалить","toast.plan_snap_ambiguous":"Увеличьте масштаб, чтобы выбрать узел стены","toast.wall_repair_ambiguous":"У контура несколько возможных соединений. Увеличьте масштаб и соедините стены явно.","toast.wall_repair_too_large":"Разрыв больше 2 см. Соедините стены перед созданием комнаты.","toast.wall_repair_changed":"Геометрия стен изменилась. Попробуйте создать комнату ещё раз.","toast.opening_on_zero_wall":"Проёмы на стене нулевой толщины запрещены","marker.from_ha_option":"Выбрать из списка HA","marker.show_entities":"Показывать сущности","marker.show_entities_tip":"Добавляет в список не только устройства, но и все их сущности","marker.pick_ph":"Выберите устройство…","room.open_area":"Открыть зону в HA","view.volumetric":"Объёмный вид","view.flat":"Плоский вид","kiosk.title":"Размеры на этом экране","kiosk.hint":"Хранится только на этом устройстве — у каждого настенного планшета или ТВ свои удобные размеры.","kiosk.icon_scale":"Размер значков устройств","kiosk.font_scale":"Размер текста карточек комнат","editor.kiosk":"Режим настенного устройства (киоск)","editor.cycle":"Автосмена пространств каждые N секунд (киоск, 0 = выкл)","room.settings_title":"Настройки комнаты","room.settings_section":"Настройки комнаты (переопределяют пространство)","room.fill_label":"Заливка в ЭТОЙ комнате","fill.inherit":"Как у пространства","room.custom_fill_space":"Цвет пространства","room.custom_fill_own":"Цвет комнаты","room.temp_src_label":"Источник температуры","room.hum_src_label":"Источник влажности","room.src_average":"Средняя по датчикам комнаты (по умолчанию)","room.src_pick":"Конкретное устройство или сущность HA","room.src_ph":"Выберите источник…","toast.room_updated":"Комната обновлена","space.card_font":"Размер шрифта карточек комнат (всё пространство)","room.sizes_section":"Размеры шрифтов","room.name_scale":"Размер названия","room.label_scale":"Размер подписей","preview.room_name":"Гостиная","toast.cfg_reload_failed":"Не удалось перечитать план с сервера: {err}","room.settings_short":"Настройки комнаты","room.unnamed":"Комната без имени","marker.use_climate_temp":"Учитывать температуру устройства в комнате","marker.use_climate_temp_tip":"Добавляет current_temperature кондиционера или термостата в среднюю температуру комнаты. Внешний бейдж со значением настраивается отдельно ниже.","marker.value_badge_title":"Бейдж со значением","marker.value_badge.help":"Показывает одно выбранное значение рядом со значком. Не влияет на комнатные показатели, свет, Glow и действие по нажатию.","marker.value_badge.help.aria":"Подсказка: бейдж со значением устройства","marker.value_badge_enabled":"Отображать бейдж со значением","marker.value_badge_source":"Значение","marker.value_badge_source.help":"Выберите конкретное состояние, поддерживаемый атрибут или производное значение этого устройства.","marker.value_badge_source.help.aria":"Подсказка: источник значения бейджа","marker.value_badge_position":"Расположение","marker.value_badge_position.help":"Выбранная сторона сохраняется постоянно и не переворачивается автоматически у края плана.","marker.value_badge_position.help.aria":"Подсказка: расположение бейджа","marker.value_badge_right":"Справа","marker.value_badge_bottom":"Снизу","marker.value_badge_left":"Слева","marker.value_badge_top":"Сверху","marker.value_badge_empty":"У этого устройства нет доступных значений","marker.value_badge_static":"Статичный значок не показывает живые значения. Настройка сохранится.","marker.value_badge_missing":"Источник недоступен","marker.value_badge_missing_hint":"Сохранённый источник сейчас недоступен. Можно сохранить его, отключить бейдж или выбрать другой.","marker.value_badge_duplicate":"То же значение уже показано внутри значка.","marker.value_badge_state":"Состояние · {name}","marker.value_badge_marker_state":"Состояние источника света · {name}","marker.value_badge_lqi":"Качество Zigbee-сигнала (среднее)","marker.value_badge_attr_current_temperature":"Текущая температура · {name}","marker.value_badge_attr_temperature":"Целевая температура · {name}","marker.value_badge_attr_current_humidity":"Текущая влажность · {name}","marker.value_badge_attr_humidity":"Влажность · {name}","marker.value_badge_attr_current_position":"Положение · {name}","marker.value_badge_attr_percentage":"Скорость · {name}","marker.value_badge_attr_brightness":"Яркость · {name}","marker.value_badge_attr_volume_level":"Громкость · {name}","marker.value_badge_attr_battery_level":"Заряд батареи · {name}","marker.value_badge_attr_fan_speed":"Скорость вентилятора · {name}","marker.light_role_label":"Является источником света","marker.light_role.help":"Определяет, является ли сам маркер пространственным источником света. Привязанные выше лампы остаются независимыми источниками для комнаты.","marker.light_role.help.aria":"Подсказка: является ли устройство источником света","marker.light_role_auto_yes":"Автоматически (источник света)","marker.light_role_auto_no":"Автоматически (не источник света)","marker.light_role_always":"Всегда источник света","marker.light_role_never":"Никогда не источник света","marker.light_entity_label":"Ведущая сущность света","marker.light_entity.help":"Для составного устройства выберите сущность, состояние, цвет и яркость которой представляют этот источник на плане. Автоматический вариант сохраняет совместимость со старыми планами.","marker.light_entity.help.aria":"Подсказка: ведущая сущность света","marker.light_entity_auto":"Автоматически ({entity})","marker.light_entity_none":"нет управляемой сущности","marker.light_entity_missing":"Сохранённая сущность {entity} недоступна. Временно используется {fallback}; выбор восстановится, если сущность вернётся.","marker.toggle_entity_label":"Переключаемая сущность","marker.toggle_entity.help":"Для составного устройства выберите собственную лампу или переключатель, которой управляет нажатие. Автоматический вариант сохраняет прежние правила цели и не зависит от ведущей сущности света.","marker.toggle_entity.help.aria":"Подсказка: переключаемая сущность","marker.toggle_entity_auto":"Автоматически ({entity})","marker.toggle_entity_none":"нет собственной управляемой сущности","marker.toggle_entity_missing":"Сохранённой сущности {entity} больше нет среди выбираемых каналов этого маркера. Временно используется {fallback}; выбор восстановится, если сущность вернётся.","marker.glow_color_label":"Цвет и яркость свечения","marker.glow_mode.help":"Используйте данные источника, задайте только цвет или зафиксируйте цвет и яркость. Минимум — 1%; чтобы отключить источник, выберите «Никогда».","marker.glow_mode.help.aria":"Подсказка: цвет и яркость свечения","marker.glow_mode_auto":"Из источника","marker.glow_mode_color":"Задать цвет","marker.glow_mode_fixed":"Задать цвет и яркость","marker.glow_color":"Цвет свечения","marker.glow_brightness":"Яркость","marker.glow_disabled_never":"Настройки свечения недоступны: маркер явно исключён из источников света.","marker.glow_disabled_auto":"В автоматическом режиме у этого маркера не найден пространственный источник света.","marker.glow_disabled_no_entity":"Для пространственного источника нет активной управляемой сущности Home Assistant.","marker.glow_passive_hint":"У источника нет собственных данных Home Assistant. Задайте цвет и яркость вручную; радиус остаётся доступным.","marker.control_broken":"Сохранённый источник отсутствует или больше не отмечен как источник света","marker.control_missing_label":"Отсутствующий источник на плане","marker.control_passive":"пассивный источник","toast.marker_control_cycle":"Такая связь создаст циклическую цепочку управления светом.","toast.marker_binding_required":"Сначала выберите устройство Home Assistant, затем добавьте управляемый источник света.","confirm.unlock":"Открыть замок «{name}»?","toast.files_migrate_failed":"Не удалось перенести вложения к новой привязке, ссылки остались на старые файлы: {err}","space.pick_saved":"Уже загруженные","space.pick_saved_hint":"Планы, сохранённые на сервере, включая отцеплённые ранее","space.no_saved":"На сервере пока нет сохранённых планов.","space.loading":"Загрузка…","space.used_by":"используется: {list}","space.in_use":"План используется пространством — сначала отцепите его","btn.use":"Выбрать","confirm.delete_plan":"Удалить файл плана «{name}» с сервера? Действие необратимо.","toast.plans_list_failed":"Не удалось получить список планов: {err}","toast.plan_delete_failed":"Не удалось удалить план: {err}","marker.hide":"Скрыть","marker.hide_tip":"Устройство исчезнет с плана после сохранения, но продолжит участвовать в расчёте сигнала комнаты. Вернуть его можно через каталог «Устройства» в редакторе устройств.","marker.show":"Показать","marker.show_tip":"Устройство снова появится на плане после сохранения.","marker.hidden_ghost":"Устройство скрыто пользователем","marker.ha_disabled_device":"Устройство деактивировано в Home Assistant и скрыто с плана.","marker.ha_disabled_entity":"Сущность деактивирована в Home Assistant и скрыта с плана.","marker.ha_disabled_all_entities":"У устройства нет активных сущностей Home Assistant, поэтому оно скрыто с плана.","marker.ha_registry_limited":"Полный реестр Home Assistant недоступен этому пользователю. Неподтверждённый объект временно нельзя показывать или использовать.","marker.delete_tip":"Полностью удалить устройство с плана и из всех расчётов. Позже его можно добавить заново.","tap.run":"Запустить автоматизацию/скрипт/сцену","marker.run_target_label":"Что запускать","marker.run_search_ph":"Поиск: автоматизация, скрипт или сцена…","marker.run_target_gone":"Цель {id} не найдена — выберите заново","marker.tap_confirm":"Спрашивать подтверждение","marker.tap_confirm_tip":"Перед выполнением показать диалог подтверждения — защита от случайных нажатий.","marker.toggle_hint_single":"Цель: {name} ({id}).","marker.virtual_light_target":"Виртуальный свет: {name}.","marker.virtual_light_current":"Ручное состояние: {state} → {effect}.","marker.virtual_light_state_on":"включён","marker.virtual_light_state_off":"выключен","marker.toggle_hint_group":"Переключатся источники ({count}): {names}.","marker.toggle_hint_current":"Сейчас: {state} → {effect}.","marker.toggle_hint_group_current":"Сейчас включено {on} из {count} → {effect}.","marker.toggle_hint_skipped":"Не будут затронуты ({count}): {targets}.","marker.toggle_effect_turn_on":"включится","marker.toggle_effect_turn_off":"выключится","marker.toggle_effect_open":"откроется","marker.toggle_effect_close":"закроется","marker.toggle_effect_stop":"остановится","marker.toggle_effect_toggle":"состояние переключится","marker.toggle_skip_missing":"не найдено","marker.toggle_skip_ha_disabled":"деактивировано в HA","marker.toggle_skip_unavailable":"недоступно","marker.toggle_skip_unsupported":"переключение не поддерживается","marker.toggle_skip_secure":"заблокировано из соображений безопасности","marker.toggle_none_no_binding":"У устройства нет привязки, состояние переключать нечем. По нажатию ничего не произойдёт.","marker.toggle_none_no_actionable_entity":"У устройства нет состояния, которое можно переключить. По нажатию ничего не произойдёт.","marker.toggle_none_configured_targets_missing":"Настроенные цели сейчас недоступны. Собственная сущность устройства не будет подставлена вместо них.","marker.toggle_none_ha_disabled":"Цель деактивирована в Home Assistant и не может использоваться на плане.","marker.toggle_none_unavailable":"Цель сейчас недоступна. По нажатию ничего не произойдёт.","marker.toggle_none_unsupported":"Для этой сущности Home Assistant не предоставляет безопасного переключения. По нажатию ничего не произойдёт.","marker.toggle_none_secure":"Переключение замков, сигнализации и защитных ворот с плана заблокировано из соображений безопасности.","run.automation":"автоматизация","run.script":"скрипт","run.scene":"сцена","confirm.tap_run":"Запустить «{name}»?","confirm.tap_toggle":"Переключить «{name}»?","confirm.current_state":"Текущее состояние: {state}","confirm.expected_state":"После переключения: {state}","confirm.group_current":"включено {on} из {total}","confirm.group_all_on":"все включены","confirm.group_all_off":"все выключены","confirm.unavailable_targets":"Недоступно: {count}","confirm.expected_by_ha":"Состояние определит Home Assistant","confirm.state_on":"Включено","confirm.state_off":"Выключено","confirm.state_open":"Открыто","confirm.state_closed":"Закрыто","confirm.state_opening":"Открывается","confirm.state_closing":"Закрывается","confirm.state_stopped":"Остановлено","confirm.state_unknown":"Неизвестно","toast.run_started":"Запущено: {name}","toast.run_target_missing":"Цель запуска не найдена — проверьте настройки устройства","toast.run_target_required":"Выберите автоматизацию, скрипт или сцену","toast.tap_target_changed":"Цель действия изменилась. Повторите попытку.","toast.virtual_light_toggle_failed":"Не удалось переключить виртуальный свет: {err}","toast.value_badge_source_required":"Выберите значение для бейджа","btn.run":"Выполнить","vac.section":"Робот-пылесос: живая позиция","vac.autocal":"Настроить автоматически","vac.live":"Живая позиция на плане","vac.trail":"Показывать путь робота","vac.cal_maps":"Откалиброваны карты: {maps}","vac.autocal_no_rooms":"Интеграция не отдаёт список комнат — откройте «Подогнать вручную»","vac.autocal_no_match":"Не совпали имена комнат (нужно ≥3 общих) — откройте «Подогнать вручную»","vac.autocal_done":"Готово: привязка по {rooms} комнатам. Запустите уборку и проверьте","vac.cal_need_pos":"Робот сейчас не отдаёт координаты — запустите уборку и поставьте на паузу","vac.cal_done":"Калибровка сохранена. Запустите уборку и проверьте","vac.cal_cancelled":"Калибровка отменена","vac.fit":"Подогнать вручную","vac.fit_hint":"Перетащите карту робота на место, растяните за уголки","vac.fit_rotate":"Повернуть 90°","vac.fit_mirror":"Отразить","vac.trail_never":"Не показывать никогда","vac.trail_cleaning":"Во время уборки","vac.trail_always":"Показывать всегда","gs.bg_group":"Фон сцены","gs.bg_color":"Цвет фона вокруг плана","gs.bg_default":"Как в теме","gs.bg_theme":"по умолчанию — из темы","gs.bg_mode":"Фон плана","gs.bg_static":"Статичный цвет","gs.bg_daynight":"Следует за Солнцем","gs.bg_daynight_hint":"Фон проходит рассвет, день, закат и ночь по данным sun.sun, а при их недоступности — по локальным часам. Компас для фона не нужен.","gs.sun_group":"Солнце","gs.sun_missing":"Сущность sun.sun не найдена — фон следует локальным часам, а оконные лучи недоступны.","gs.north":"Север на плане","gs.north_ph":"не задан","gs.north_hint":"Север нужен только для оконных лучей (шаг 1°, с Shift 15°); солнечный фон работает без него.","gs.north_clear":"Сбросить","gs.north_letter":"С","gs.sun_rays":"Солнце в окнах","gs.about_group":"О карточке","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · документация и issues","gs.about_telegram":"Чат в Telegram","space.bg_color":"Цвет фона вокруг плана","space.bg_inherit":"Наследовать общий","space.bg_inherited":"наследуется из общих настроек","space.bg_mode":"Фон плана","space.north":"Север на плане (переопределение)","space.north_inherited":"наследуется: {v}","space.sun_rays":"Солнце в окнах","space.sun_inherit":"Наследовать общий","space.sun_on":"Вкл","space.sun_off":"Выкл","canvas.far_objects":"Объектов далеко от плана: {n}","canvas.show_far":"Показать","canvas.home_tip":"План там — нажмите, чтобы вписать","gs.grid_group":"Обслуживание планов","gs.grid_hint":"Обновляет модели данных, выравнивает элементы по сетке и объединяет лишние фрагменты стен. Перед записью будет показан точный отчёт.","gs.align_all":"Оптимизировать планы","gs.align_title":"Оптимизировать планы","gs.align_none":"Все планы уже используют актуальную и оптимальную модель данных.","gs.optimize_no_automatic_changes":"Автоматических изменений нет. Проверьте пункты ниже.","gs.align_count":"Сдвинется элементов: {n} из {total}, максимум на {cm} см.","gs.align_where":"Наибольший сдвиг — в пространстве «{s}».","gs.align_turned":"Проёмов с исправлением угла: {n}.","gs.align_removed_drafts":"Схлопнувшиеся на сетке некорректные контуры удалены: {n}.","gs.optimize_redundant_drafts":"Сохранённые цепочки стен, полностью скрытые стенами комнат, удалены: {n}.","gs.align_preflight_failed":"Не удалось безопасно проверить геометрию следующих пространств: {spaces}{more}.","gs.align_preflight_hint":"Планы не изменены. Скопируйте диагностику кнопкой ниже и приложите её к отчёту об ошибке вместе с экспортом пространства.","gs.preflight_reason_prepare-exception":"Не удалось подготовить геометрию пространства (исключение при сборке модели)","gs.preflight_reason_wall-null":"Тело стен не построилось (объединение вернуло пустоту)","gs.preflight_reason_wall-degraded-extra":"Тело стен деградировало с лишней геометрией","gs.preflight_reason_wall-failed-core":"Ядро тела стен не собралось","gs.preflight_reason_wall-exception":"Построение стен упало с исключением","gs.preflight_reason_floor-null":"Контур пола не построился","gs.preflight_reason_floor-exception":"Построение пола упало с исключением","gs.preflight_copy":"Скопировать диагностику","gs.preflight_copied":"Диагностика скопирована","gs.preflight_update_hint":"Версии карточки и интеграции различаются — обновите House Plan и повторите.","gs.align_preflight_space":"Пространство {n}","gs.align_preflight_more":" и ещё {n}","gs.optimize_changes":"Миграций модели: {m}; обновлено пространств: {c}; устранён шум координат: {p}; объединено отрезков реальных стен: {w}; объединено отрезков стен нулевой толщины: {s}; независимых: {i}.","gs.zero_walls_migrated":"Преобразовано виртуальных участков: {n}.","gs.wall_segments_migrated":"Стабилизировано сегментов стен: {n}.","gs.optimize_lattice_summary":"Канонизировано шумовых значений координат: {n}; максимальный сдвиг: {cm} см.","gs.optimize_lattice_space":"{space}: канонизировано значений координат: {n}; оставлено значений вне сетки: {far}.","gs.optimize_coincident_partitions":"Скрытые участки независимых стен поглощены стенами комнат: {n}.","gs.optimize_openings_rehosted":"Проёмы перепривязаны к стенам комнат: {n}.","gs.optimize_walls_straightened":"Выпрямлено стен: {n}; максимальное перемещение: {cm} см.","gs.optimize_walls_straightened_where":"Максимальная правка стены: {s}.","gs.optimize_walls_straighten_skipped":"Оставлено почти осевых стен, которые нельзя безопасно выпрямить: {n}.","gs.optimize_glow_migration":"Старый Glow: пространств — {spaces} → без заливки данных + независимый Glow; комнат — {rooms} → наследуемая заливка + независимый Glow.","gs.optimize_references":"Исправлено ссылок: пространства — {spaces}; комнаты — {rooms}; позиции — {positions}; устройств отвязано от отсутствующих пространств — {detached}.","gs.optimize_reference_more":", и ещё {n}","gs.optimize_orphans_removed":"Убрано забытых записей: {total} — подписи комнат: {rooms}; устройства: {devices}; групповые метки: {groups}. Все они принадлежали пространствам, удалённым ранее.","gs.optimize_live_positions":"Старые позиции в удалённых пространствах принадлежат существующим объектам: {n}{names}. Они будут сохранены.","gs.optimize_live_positions_remove":"Старые позиции в удалённых пространствах принадлежат существующим объектам: {n}{names}. Они выбраны для удаления.","gs.optimize_live_names":": {names}{more}","gs.optimize_live_remove":"Убрать старые позиции","gs.optimize_live_keep":"Сохранить старые позиции","gs.optimize_live_selected":"Старые позиции будут убраны после применения оптимизации.","gs.optimize_unverified":"Не удалось безопасно проверить позиций: {n}. Они оставлены без изменений.","gs.optimize_registry_limited":"Для безопасной проверки нужен полный доступ администратора к реестрам Home Assistant.","gs.optimize_vacuum_warning":"Сопоставления комнат пылесоса требуют проверки: {n}.","gs.optimize_details":"Подробности","gs.optimize_details_more":"И ещё записей: {n}.","gs.optimize_detail_removed":"будет удалено","gs.optimize_detail_live":"будет сохранено","gs.optimize_detail_unverified":"не проверено","gs.optimize_detail_room_label":"подпись комнаты","gs.optimize_detail_device":"устройство","gs.optimize_detail_group":"групповая метка","gs.optimize_detail_unknown":"неизвестный владелец","gs.optimize_detail_item":"{status}: {kind} {id}; прежнее пространство {space}","gs.align_warn":"Элементы, намеренно поставленные между узлами, будут сдвинуты. После операции доступна одна отмена — только до следующего изменения плана.","gs.align_run":"Оптимизировать","gs.align_done":"Планы оптимизированы: сдвинуто элементов — {n}, обслужено записей — {m}, исправлено ссылок — {r}","gs.optimize_undo":"Отменить последнюю оптимизацию","gs.optimize_undone":"Последняя оптимизация отменена","decor.furniture":"Мебель","furn.title":"Библиотека мебели","furn.symbol":"Символ","furn.group_furniture":"Мебель","furn.group_appliance":"Техника","furn.group_sanitary":"Сантехника","furn.group_other":"Прочее","furn.width":"Ширина","furn.depth":"Глубина","furn.pick_hint":"Выберите символ и кликните по плану.","furn.place_hint":"Кликните по плану — предмет встанет к ближайшей стене. Shift — свободно.","furn.sym_sofa":"Диван","furn.sym_armchair":"Кресло","furn.sym_coffee_table":"Журнальный столик","furn.sym_table_dining":"Обеденный стол","furn.sym_table_round":"Круглый стол","furn.sym_chair":"Стул","furn.sym_desk":"Письменный стол","furn.sym_bed_double":"Двуспальная кровать","furn.sym_bed_single":"Односпальная кровать","furn.sym_nightstand":"Тумбочка","furn.sym_wardrobe":"Шкаф","furn.sym_bookshelf":"Стеллаж","furn.sym_fridge":"Холодильник","furn.sym_stove":"Плита","furn.sym_dishwasher":"Посудомоечная машина","furn.sym_washer":"Стиральная машина","furn.sym_dryer":"Сушильная машина","furn.sym_tv":"Телевизор","furn.sym_ac":"Кондиционер","furn.sym_water_heater":"Бойлер","furn.sym_toilet":"Унитаз","furn.sym_bathtub":"Ванна","furn.sym_shower":"Душ","furn.sym_sink":"Раковина","furn.sym_kitchen_sink":"Кухонная мойка","furn.sym_bidet":"Биде","furn.sym_stairs":"Лестница","furn.sym_fireplace":"Камин","furn.sym_plant":"Растение","furn.sym_rug":"Ковёр","common.yes":"Да","common.no":"Нет","vac.diag_source":"Источник","vac.diag_platform":"Интеграция","vac.diag_status":"Статус","vac.diag_position":"Позиция","vac.diag_rooms":"Комнаты","vac.diag_rooms_value":"{total} · совпало имён: {matched} · {readiness}","vac.autocal_ready":"автокалибровка доступна","vac.autocal_not_ready":"нужно 3 совпавших имени","vac.diag_path":"Путь интеграции","vac.diag_map":"ID карты","vac.source_none":"не выбран","vac.source_status_ok":"Готов","vac.source_status_missing":"Не найден","vac.source_status_disabled":"Деактивирован в Home Assistant","vac.source_status_unavailable":"Недоступен","vac.source_status_unverified":"Нельзя проверить с текущими правами","vac.source_status_unsupported":"Нет данных позиции","vac.source_status_none":"Нет источника","vac.source_banner_missing":"Сохранённый источник больше не существует. Он не заменён автоматически: выберите другой или восстановите его в Home Assistant.","vac.source_banner_disabled":"Сохранённый источник деактивирован в Home Assistant. Активируйте его там или выберите другой.","vac.source_banner_unverified":"Текущих прав Home Assistant недостаточно для проверки источника. Привязка сохранена и не будет заменена автоматически.","vac.choose_source":"Выбрать источник","vac.source_auto":"Автоматически","vac.source_auto_hint":"Использовать совместимую сущность этого устройства","vac.all_cameras":"Все камеры","vac.all_cameras_warn":"Камера может не отдавать данные робота. Выбирайте её только если это карта вашего пылесоса.","vac.all_cameras_empty":"Других сущностей камеры не найдено.","vac.platform_unknown":"интеграция неизвестна","vac.cap_position":"позиция","vac.cap_rooms_short":"комнаты","vac.cap_path":"путь","vac.cap_map":"ID карты","vac.cap_none":"данные робота не обнаружены","vac.xcme_hint":"Включите атрибуты Xiaomi Cloud Map Extractor:","vac.documentation":"Документация","vac.residual_title":"Проверьте автокалибровку","vac.residual_message":"Совпавшие комнаты расходятся максимум на {error}. Примените приблизительную калибровку, подгоните её вручную либо отмените без изменения сохранённых настроек.","vac.apply_proposal":"Применить","gs.backup_group":"Резервная копия и перенос","gs.backup_hint":"Скачайте переносимую JSON-копию или проверьте и импортируйте копию, созданную House Plan.","backup.export_open":"Экспорт","backup.import_open":"Импорт","backup.export_title":"Экспорт House Plan","backup.import_title":"Импорт House Plan","backup.export_hint":"Выберите, должна ли копия содержать всю конфигурацию House Plan или только текущее пространство.","backup.full":"Полная копия","backup.current_space":"Текущее пространство","backup.current_space_title":"Текущее пространство: {title}","backup.no_current_space":"Нет текущего пространства","backup.plan_only":"Только планировка","backup.plan_only_hint":"Сохранить комнаты, стены, проёмы, декор и позиции подписей комнат без устройств и привязок Home Assistant.","backup.plan_only_preview":"Файл содержит только планировку","backup.privacy_warning":"Архив сохраняет названия, идентификаторы Home Assistant и точные координаты. Внутренние планы и вложения указываются ссылками, но не вкладываются; текущие состояния и маршруты пылесосов не включаются.","backup.download":"Скачать JSON","backup.export_done":"Резервная копия скачана","backup.reading":"Проверяем резервную копию…","backup.revalidated":"После предпросмотра план изменился. Сводка обновлена — проверьте её и подтвердите ещё раз.","backup.error.unauthorized":"У вас нет прав на экспорт или импорт этого плана.","backup.error.not_ready":"House Plan ещё не готов. Повторите попытку через несколько секунд.","backup.error.too_large":"Размер резервной копии превышает 8 МиБ.","backup.error.invalid_json":"Выбранный файл не является корректным JSON.","backup.error.invalid_format":"Выбранный файл не является резервной копией House Plan.","backup.error.unsupported_export_version":"Эта версия формата резервной копии не поддерживается установленной версией.","backup.error.future_model":"Резервная копия создана в более новой версии модели данных House Plan.","backup.error.invalid_config":"Резервная копия содержит некорректную конфигурацию House Plan.","backup.error.wall_model_migration_blocked":"Не удалось безопасно обновить модель стен из резервной копии. Сначала оптимизируйте исходный план и повторите экспорт.","backup.error.invalid_layout":"Резервная копия содержит некорректные позиции объектов.","backup.error.invalid_content":"Резервная копия содержит некорректные или несогласованные ссылки на файлы.","backup.error.space_not_found":"Выбранное пространство больше не существует.","backup.error.capacity_exceeded":"Добавление этой копии превысит ограничения размера плана.","backup.error.preview_expired":"Время предпросмотра истекло. Выберите файл резервной копии заново.","backup.error.preview_owner_mismatch":"Этот предпросмотр принадлежит другому пользователю Home Assistant.","backup.error.conflict":"После предпросмотра план изменился. Проверьте обновлённую сводку.","backup.error.content_confirmation_required":"Подтвердите отсоединение недоступных локальных файлов.","backup.error.commit_failed":"Не удалось безопасно применить копию. Предыдущий план восстановлен или ожидает восстановления.","backup.error.missing_plan":"После предпросмотра исчез связанный файл плана. Проверьте копию ещё раз.","backup.error.missing_content":"После предпросмотра исчез связанный локальный файл. Проверьте копию ещё раз.","backup.error.marker_control_missing":"В резервной копии отсутствует связанный источник света на плане.","backup.error.marker_control_not_light":"Связанная цель больше не отмечена как источник света.","backup.error.marker_control_self":"Источник света не может управлять самим собой.","backup.error.marker_control_cycle":"Резервная копия содержит циклическую цепочку управления светом.","backup.error.duplicate_marker_control":"Резервная копия содержит повторяющуюся связь с источником света.","backup.error.no_backup":"Нет снимка импорта или оптимизации, который можно восстановить.","backup.same_source":"Создано на этом экземпляре Home Assistant","backup.foreign_source":"Создано на другом экземпляре Home Assistant","backup.created":"Создано: {value}","backup.versions":"Карточка {card}; интеграция {integration}; модель данных {model}","backup.count_spaces":"Пространств: {n}","backup.count_rooms":"Комнат: {n}","backup.count_walls":"Стен: {n}","backup.count_openings":"Проёмов: {n}","backup.count_decor":"Объектов декора: {n}","backup.count_markers":"Устройств: {n}","backup.count_layout":"Позиций: {n}","backup.bindings":"Привязки — устройства: {device}, сущности: {entity}, виртуальные: {virtual}; позиций без пространства: {legacy}","backup.binding_status":"Статус на целевом экземпляре — активных: {active}, деактивированных: {disabled}, отсутствующих: {missing}","backup.missing_areas":"На целевом экземпляре отсутствуют зоны: {areas}","backup.dropped_marker_links":"Связи с источниками света вне переносимого пространства пропущены: {n}.","backup.repaired_target_refs":"Существующих ссылок восстановлено этим импортом: {n}.","backup.preserved_unresolved_refs":"Неоднозначные ссылки сохранены без изменений: {n}.","backup.preserved_unresolved_hint":"House Plan ничего не угадывал и не удалял. После импорта запустите «Оптимизировать планы», чтобы проверить оставшиеся ссылки.","backup.import_details":"Подробности восстановления ссылок","backup.import_detail.incoming_remapped":"Ссылок обновлено внутри импортируемой копии: {n}","backup.import_detail.target_repaired":"Существующих ссылок восстановлено: {n}","backup.import_detail.preserved_unresolved":"Неразрешимых ссылок сохранено: {n}","backup.import_detail.collisions":"Конфликтов назначения безопасно сохранено: {n}","backup.import_detail.dropped_links":"Входящих связей пропущено по правилам переноса: {n}","backup.import_detail.bounded_lineages":"Чрезмерно вложенных идентификаторов ограничено: {n}","backup.replace_warning":"Текущая конфигурация и расположение будут заменены. Загруженные файлы не удаляются. Одну отмену можно выполнить до следующего изменения плана.","backup.foreign_bookkeeping":"Служебные списки известных и новых устройств другого экземпляра импортированы не будут.","backup.final_name":"Название нового пространства","backup.target_settings":"Глобальные настройки целевого экземпляра не изменятся.","backup.duplicates":"Уже существующих привязок: {n}","backup.skip":"Пропустить повторяющиеся устройства","backup.virtual_copy":"Добавить безопасные статичные виртуальные копии","backup.content":"Связанное содержимое","backup.content_available":"доступно локально","backup.content_external":"внешняя ссылка","backup.content_detach_required":"будет отвязано","backup.confirm_detach":"Я понимаю, что недоступные внутренние планы и вложения будут отвязаны от импортируемой конфигурации.","backup.replace":"Заменить","backup.add":"Добавить пространство","backup.space_done":"Пространство импортировано: комнат — {rooms}, устройств — {markers}, существующих ссылок восстановлено — {refs}","backup.full_done":"Копия восстановлена: пространств — {spaces}, комнат — {rooms}, устройств — {markers}","backup.undo_import":"Отменить последний полный импорт","backup.import_undone":"Полный импорт отменён"};async function Gd(e){const t=0===e?await import("./de-CznTQbzh.js"):await import(new URL("./de-CznTQbzh.js?retry",import.meta.url).href);return{dictionary:t.dictionary,fingerprint:t.fingerprint}}const Vd=[{code:"en",nativeLabel:"English",dictionary:Wd},{code:"ru",nativeLabel:"Русский",dictionary:Ud},{code:"de",nativeLabel:"Deutsch",loadDictionary:Gd}],Kd=Wd;let Yd,Zd,Xd=!1;const Jd={state:e=>"de"!==e||Yd?"ready":Xd?"fallback":"pending",dictionary:e=>"de"===e?Yd:"ru"===e?Ud:"en"===e?Wd:void 0,ensure:e=>"de"!==e||Yd||Xd?Promise.resolve():Zd??=async function(){let e;for(const t of[0,1])try{const e=await Gd(t);if("b0932d9ea32229294c30d94b645a3699799d106ba4e7bcc204be2a152c72ece9"!==e.fingerprint)throw new Error("locale fingerprint mismatch");return void(Yd=e.dictionary)}catch(t){e=t}Xd=!0,console.warn("[houseplan] unable to load de locale; using English",e)}().finally(()=>{Zd=void 0})};function Qd(e){const t=iu(e)?.code??"en";return Jd.dictionary(t)??Kd}function eu(e){return"string"==typeof e?e.trim().replaceAll("_","-").toLowerCase():""}const tu=new Map(Vd.map(e=>[eu(e.code),e]));function iu(e){return tu.get(eu(e))}function nu(e,t){const i=[{value:"",label:e},...Vd.map(({code:e,nativeLabel:t})=>({value:e,label:t}))],n="string"==typeof t?t:"";return n&&!i.some(e=>e.value===n)&&i.push({value:n,label:iu(n)?.nativeLabel??n}),i}function ru(e,t){return function(e,t,i,n){const r=new Map(i.map(e=>[eu(e),e])),o=r.get(eu(e));if(o)return o;const s=eu(t),a=r.get(s);return a||(r.get(s.split("-")[0]||"")??n)}(t,e?.locale?.language||e?.language,Vd.map(({code:e})=>e),"en")}function ou(e,t,i){return Vi(Qd(e)[t]??Kd[t]??t,i)}function su(e,t){const i=Qd(e)[t]??Kd[t];return"string"==typeof i&&i.trim().length>0}function au(e){const t=e.length/2,i=e.face.cm>0?e.face.cm/e.cellCm*e.gridPitch/2:xa(4,e.cellCm),n="gate"===e.type?Math.sin(10*Math.PI/180)*t:0;return{half:t,jambHalf:i,gateDepth:n,outlineHalf:Math.max(xa(16,e.cellCm),i+xa(8,e.cellCm),n+xa(8,e.cellCm)),hitHalf:Math.max(xa(20,e.cellCm),i+xa(10,e.cellCm),n+xa(12,e.cellCm))}}function lu(e){if("passage"===e.type)return W``;const t=Math.max(0,Math.min(1,e.amount)),{half:i,jambHalf:n}=au(e),r=ka(e.cellCm),o=1.75*r,s=e.flipH?-1:1,a=e.flipV?-1:1,l="gate"===e.type?1:a;e.type,e.flipV,e.angle,e.face;let c;if("window"===e.type){const o=Math.PI/2*i,s=e.face.cm>0?W`<line class="op-glass" x1="0" y1="${-n}" x2="0" y2="${n}"
          stroke="${e.tone}" stroke-width="${1.5*r}"></line>`:W``;c=W`
      <g transform="translate(${0} ${0})">
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
      </g>`}else if("gate"===e.type){const n=10*e.face.side*t;c=W`
      <g transform="translate(${0} ${0})">
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
      </g>`}else{const n=Math.PI/2*e.length;c=W`
      <g transform="translate(${0} ${0})">
      <path class="op-arc" d="M ${i} 0 A ${e.length} ${e.length} 0 0 0 ${-i} ${-e.length}" fill="none"
        stroke="${e.tone}" stroke-dasharray="${n}" stroke-dashoffset="${n*(1-t)}"></path>
      <g transform="translate(${-i} 0)">
        <g class="op-leaf" style="transform:rotate(${-90*t}deg)">
          <rect x="0" y="${-o}" width="${e.length}" height="${2*o}" fill="${e.tone}"></rect>
        </g>
      </g>
      </g>`}return W`<g transform="scale(${s} ${l})">
    <line x1="${-i}" y1="${-n}" x2="${-i}" y2="${n}"
      stroke="${e.base}" stroke-width="${2.5*r}"></line>
    <line x1="${i}" y1="${-n}" x2="${i}" y2="${n}"
      stroke="${e.base}" stroke-width="${2.5*r}"></line>
    ${c}
  </g>`}const cu={climate:["current_temperature","temperature","current_humidity","humidity"],water_heater:["current_temperature","temperature"],cover:["current_position"],valve:["current_position"],fan:["percentage"],humidifier:["current_humidity","humidity"],light:["brightness"],media_player:["volume_level"],vacuum:["battery_level","fan_speed"],lawn_mower:["battery_level","fan_speed"]};function hu(e){return e?e.sourceLabel?`${e.sourceLabel}: ${e.fullText}`:e.fullText:""}const du=new WeakMap;function uu(e){return e?"entity_state"===e.kind?`state:${e.entity_id}`:"entity_attribute"===e.kind?`attr:${e.entity_id}:${e.attribute}`:"derived_marker_state"===e.kind?`marker:${e.ref}`:"derived:lqi":""}function pu(e){if("derived:lqi"===e)return{kind:"derived_lqi"};if(e.startsWith("state:"))return{kind:"entity_state",entity_id:e.slice(6)};if(e.startsWith("attr:")){const t=e.slice(5),i=t.lastIndexOf(":");if(i>0)return{kind:"entity_attribute",entity_id:t.slice(0,i),attribute:t.slice(i+1)}}return e.startsWith("marker:marker:")?{kind:"derived_marker_state",ref:e.slice(7)}:null}function _u(e,t){const i=e?.entities?.[t],n=e?.states?.[t];return String(i?.name||i?.original_name||n?.attributes?.friendly_name||t)}function mu(e){return e.replaceAll("_"," ")}function gu(e,t=1){const i=Number(e);return Number.isFinite(i)?`${Math.round(i*t)} %`:null}function fu(e){if("derived_lqi"===e.kind)return"lqi";if("entity_attribute"===e.kind){if(e.attribute.includes("temperature"))return"temperature";if(e.attribute.includes("humidity"))return"humidity"}return"default"}function vu(e,t,i,n=[]){let r=null,o="",s="available";if("entity_state"===i.kind){o=_u(e,i.entity_id);const t=e?.states?.[i.entity_id];if(t)if(bu(e,i.entity_id))if(["unknown","unavailable"].includes(String(t.state).toLowerCase()))s="unavailable";else{const n=qi(e,i.entity_id);r=n?ji(n,String(t.attributes?.unit_of_measurement||"")):null,r||(s="unavailable")}else s="unavailable";else s="missing"}else if("entity_attribute"===i.kind){o=`${mu(i.attribute)} · ${_u(e,i.entity_id)}`;const t=e?.states?.[i.entity_id];t?bu(e,i.entity_id)?(r=function(e,t,i){const n=e?.states?.[t];if(!n||!(i in(n.attributes||{})))return null;const r=qi(e,t,i);if(r?.formatted)return r.text;const o=n.attributes?.[i];if("brightness"===i)return gu(o,100/255);if("volume_level"===i)return gu(o,100);if(["current_position","percentage","current_humidity","humidity","battery_level"].includes(i))return gu(o);if("current_temperature"===i||"temperature"===i){const t=Number(o);if(!Number.isFinite(t))return null;const i=String(e?.config?.unit_system?.temperature||"°C");return`${Math.round(10*t)/10} ${i}`}return r?.text||(["string","number","boolean"].includes(typeof o)?String(o):null)}(e,i.entity_id,i.attribute),null==r&&(s="unavailable")):s="unavailable":s="missing"}else if("derived_lqi"===i.kind){o="LQI";const i=Ch(e,t.entities);null==i?s="unavailable":r=String(i)}else{o="Light state";const t=n.find(e=>e.ref===i.ref);if(t){const i=t.on?"on":"off",n=e?.localize?.(`state.default.${i}`);r="string"==typeof n&&n?n:i,o=t.name||o}else s="missing"}const a=e?.localize?.("state.default.unavailable")||"Unavailable";return{source:i,sourceLabel:o,text:r??"—",fullText:r??a,availability:s,isLqi:"derived_lqi"===i.kind,tone:fu(i)}}function yu(e,t){if(!0===t.marker?.use_climate_temp){const i=t.entities.find(t=>t.startsWith("climate.")&&Number.isFinite(Number(e?.states?.[t]?.attributes?.current_temperature)));return i?{kind:"entity_attribute",entity_id:i,attribute:"current_temperature"}:null}if("mdi:thermometer"===t.icon||"mdi:air-filter"===t.icon){const i=t.entities.find(t=>sh(e,t)&&Number.isFinite(Number(e?.states?.[t]?.state)));if(i)return{kind:"entity_state",entity_id:i}}return t.primary&&Oh(e,t.primary)&&Number.isFinite(Number(e?.states?.[t.primary]?.state))?{kind:"entity_state",entity_id:t.primary}:null}function bu(e,t){const i=e?.entities?.[t];if(i&&!Zc(i))return!1;const n=i?.device_id?e?.devices?.[i.device_id]:null;return!n||Zc(n)}function wu(e,t){return bu(e,t)&&!!e?.states?.[t]}function ku(e,t,i=[t]){const n=function(e,t){const i=e=>[e.id,e.primary,e.hidden?1:0,e.userHidden?1:0,e.entities.join(","),(e.controls||[]).join(","),e.marker?.binding||"",!0===e.marker?.is_light?1:0,e.marker?.light_entity||"",(e.marker?.controls||[]).join(",")].join("|");return`${i(e)}\n${t.map(i).join("\n")}`}(t,i),r=du.get(t);if(r&&r.states===(e?.states||null)&&r.entities===(e?.entities||null)&&r.devices===(e?.devices||null)&&r.signature===n)return r.result;const o=new Set(t.entities);for(const e of t.controls||[])e.startsWith("marker:")||o.add(e);const s=[],a=Mh(e,i),l=a.filter(e=>e.key.startsWith("marker:")).map(e=>({ref:e.key,on:e.on,name:e.device?.name||e.key})),c=i=>{const n=uu(i);if(s.some(e=>e.key===n))return;const r=vu(e,t,i,l),o="entity_attribute"===i.kind?`${i.entity_id} · ${i.attribute}`:"entity_state"===i.kind?i.entity_id:"derived_marker_state"===i.kind?i.ref:"LQI";s.push({key:n,source:i,label:r.sourceLabel,technical:o,value:r.text,available:"available"===r.availability})};for(const t of[...o].sort()){if(!wu(e,t))continue;const i=t.split(".")[0],n=e?.entities?.[t];if("button"===i||"event"===i||"config"===n?.entity_category)continue;c({kind:"entity_state",entity_id:t});const r=e?.states?.[t];for(const e of cu[i]||[])e in(r?.attributes||{})&&c({kind:"entity_attribute",entity_id:t,attribute:e})}const h=new Set((t.marker?.controls||t.controls||[]).filter(e=>e.startsWith("marker:")));!0===t.marker?.is_light&&t.marker.id&&h.add(`marker:${t.marker.id}`);const d=new Set(a.map(e=>e.key));for(const e of[...h].sort())d.has(e)&&c({kind:"derived_marker_state",ref:e});return t.virtual||null==Ch(e,t.entities)||c({kind:"derived_lqi"}),du.set(t,{states:e?.states||null,entities:e?.entities||null,devices:e?.devices||null,signature:n,result:s}),s}function xu(e,t,i){const n=yu(e,t);if(n&&i.some(e=>e.key===uu(n)))return n;const r=t.primary&&i.find(e=>e.key===`state:${t.primary}`);if(r)return r.source;const o=[e=>e.technical.includes("temperature"),e=>e.technical.includes("humidity"),e=>e.technical.includes("battery")];for(const e of o){const t=i.find(e);if(t)return t.source}return i.find(e=>"derived_lqi"!==e.source.kind)?.source||i[0]?.source||null}function $u(e){return e.touched?{value_badge:{enabled:e.enabled,source:e.source,position:e.position}}:e.originalHas?{value_badge:e.original}:{}}function Su(e,t,i){return{kind:"none",reason:"none",generation:e,expiresAt:null,color:t,diameterScale:i,animated:!1,reducedMotionIndicator:"none"}}function Mu(e,t,i,n,r=null){return{kind:t,reason:"short"===t?"event":"running",generation:Math.max(1,Math.trunc(i)),expiresAt:"short"===t?r:null,color:e.color,diameterScale:n?1:e.diameterScale,animated:!n,reducedMotionIndicator:n?"dot":"none"}}const Ru={availability:"available",status:"neutral",activity:"none"};function Tu(e){return e<=40?"low":e<180?"mid":"high"}function Cu(e){return Ut(e)}function Du(e){return"static_icon"===e.display?"neutral":"alarm"===e.visual.status?"alarm":"unavailable"===e.visual.availability?"unavailable":e.lockState?e.lockState:"working"===e.visual.status?"working":"open"===e.visual.status?"open":"neutral"}const Au={sourceKind:"none",decisionIds:["source.skipped_static_fast_path"],visualSources:[],criticalSources:[],samples:[]};function Ou(e,t){const i=e?.entities?.[t],n=e?.states?.[t];return String(i?.name||i?.original_name||n?.attributes?.friendly_name||t)}function zu(e,t){const i=e?.states?.[t];if(!i)return"";if("function"==typeof e?.formatEntityState)try{const t=e.formatEntityState(i);if("string"==typeof t&&t)return t}catch{}return String(i.state??"")}function Pu(e,t){if(t.virtual||"virtual"===t.bindingKind||"virtual"===t.marker?.binding)return"available";return(t.entities||[]).some(t=>{const i=String(e?.states?.[t]?.state??"").trim().toLowerCase();return""!==i&&"unknown"!==i&&"unavailable"!==i})?"available":"unavailable"}function Fu(e,t,i,n){return{eid:t,role:i,name:Ou(e,t),state:String(e?.states?.[t]?.state??""),stateText:zu(e,t),integrationDomain:e?.entities?.[t]?.platform||null,sample:n||xc(e,t)}}function Iu(e,t,i=[t],n,r=e){const o=t.hidden&&t.userHidden?{...t,hidden:!1}:t;let s="none",a=[];const l=[],c=[...o.entities,...o.allEntities||[]].some(e=>e.startsWith("cover."))?{...o,tapAction:"cover"}:o,h=(d=vd({hass:e,devices:i,device:c,lightSources:n,registryHass:r}),"cover"!==d?.semantics?null:d.targets[0]?.entityId||d.skippedTargets[0]?.entityId||null);var d;const u=Mh(e,[o]),p=uh(o.marker?.binding,o.marker?.controls??o.controls,o.entities),_=new Set(p.filter(e=>e.startsWith("marker:"))),m=!0===o.marker?.is_light||_.size>0?n||Mh(e,i):u,g=m.filter(e=>e.device.id===o.id&&"controls"!==e.via),f=u.filter(e=>"controls"!==e.via),v=g.length?g:f,y=zc(o.marker),b=y?[...v]:[...u.filter(e=>"controls"===e.via),...v];if(_.size)for(const e of m){if(!_.has(e.key))continue;e.stateEids.length>0&&b.some(t=>t.stateEids.some(t=>e.stateEids.includes(t)))||b.some(t=>t.key===e.key)||b.push({...e,via:"controls",castsGlow:!1})}const w=ch(r,o.entities),k=!!h&&("cover"===o.tapAction||o.primary?.startsWith("cover.")||w.some(e=>e.startsWith("cover.")));if(h&&!k&&l.push("source.cover_capability_bypassed"),k)s="cover",l.push("source.cover"),a=[Fu(e,h,"cover")];else if(b.length)s=!y&&b.some(e=>"controls"===e.via)?"controls":"light",y?l.push("source.manual_virtual_light"):l.push("controls"===s?"source.controls":"source.owned_light"),"controls"!==s||!o.virtual&&"virtual"!==o.bindingKind||l.push("source.virtual_controller"),a=b.map(i=>{const n="controls"===i.via?"control":"forced"===i.via?"forced_light":"light";if(!i.passive)return Fu(e,i.eid,n);const r=i.on?"on":"off";return{eid:i.key,role:n,name:t.name,state:r,stateText:r,integrationDomain:null,sample:{eid:i.key,state:r,availability:"available",status:i.on?"working":"neutral",activity:"none",edge:"none"}}});else{const t=ch(r,o.entities),i=t.length?t:o.entities.filter(t=>!!e?.states?.[t]);if(i.length){s="device_role",l.push("source.device_role");const t=$c(r===e?e:{...r,states:e?.states||{}},i,o.entities),n=i.some(e=>bc(r,e));a=t.map(t=>{const i=n?wc(r,t.eid)?"power_gate":bc(r,t.eid)?"lifecycle":"device_role":"device_role";return Fu(e,t.eid,i,t)})}else o.primary?(s="primary",l.push("source.primary_fallback"),a=[Fu(e,o.primary,"primary")]):l.push("source.none")}p.length>0&&"controls"!==s&&"light"!==s&&"cover"!==s&&l.push("source.filtered_saved_controls");const x=[];for(const t of o.entities||[]){const i=xc(e,t);"alarm"!==i.status||a.some(e=>e.eid===t)||x.push(Fu(e,t,"critical",i))}return x.length&&l.push("source.critical_sibling"),{sourceKind:s,decisionIds:l,visualSources:a,criticalSources:x,samples:[...a,...x].map(e=>e.sample)}}function Eu(e,t,i,n){if(t.virtual)return{source:null,text:null,fallback:"value_virtual"};if(n){const i=function(e,t){if(!0!==t.marker?.use_climate_temp)return null;for(const i of t.entities){if(!i.startsWith("climate."))continue;const t=Number(e?.states?.[i]?.attributes?.current_temperature);if(Number.isFinite(t))return{eid:i,text:Math.round(10*t)/10+"°"}}return null}(e,t);if(i)return{source:{kind:"temperature",eid:i.eid,attribute:"current_temperature",text:i.text},text:i.text,fallback:null};const n=function(e,t){if("mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon)return null;for(const i of t.entities){if(!sh(e,i))continue;const t=Number(e?.states?.[i]?.state);if(Number.isFinite(t))return{eid:i,text:Math.round(10*t)/10+"°"}}return null}(e,t);if(n)return{source:{kind:"temperature",eid:n.eid,text:n.text},text:n.text,fallback:null};const r=function(e,t){if(!t.primary||!Oh(e,t.primary))return null;const i=Number(e?.states?.[t.primary]?.state);return Number.isFinite(i)?{eid:t.primary,text:`${Math.round(i)}%`}:null}(e,t);if(r)return{source:{kind:"humidity",eid:r.eid,text:r.text},text:r.text,fallback:null}}const r=i.visualSources.filter(e=>!e.eid.startsWith("marker:"));let o=r.map(e=>e.eid);const s=r.find(e=>"power_gate"===e.role);if(s&&(o=[s.eid]),!o.length&&i.visualSources.some(e=>e.eid.startsWith("marker:"))&&(o=ch(e,t.entities),!o.length&&t.primary&&e?.states?.[t.primary]&&(o=[t.primary])),o=[...new Set(o)],1!==o.length)return{source:null,text:null,fallback:o.length?"value_ambiguous_sources":"value_no_state"};const a=o[0],l=function(e,t){const i=e?.states?.[t];if(!i||null==i.state||""===String(i.state).trim())return{text:"",fallback:"value_no_state"};const n=i.state;if(!["string","number","boolean"].includes(typeof n))return{text:"",fallback:"value_non_scalar"};const r=String(n).trim().toLowerCase();if("unknown"===r||"unavailable"===r)return{text:"",fallback:"value_no_state"};const o=qi(e,t);return o?{text:ji(o,String(i.attributes?.unit_of_measurement||"")),fallback:null}:{text:"",fallback:"value_no_state"}}(e,a);return l.fallback?{source:null,text:null,fallback:l.fallback}:{source:{kind:"entity",eid:a,text:l.text},text:l.text,fallback:null}}function Nu(e,t,i){const n=e.marker?.binding||(e.bindingKind&&e.bindingRef?`${e.bindingKind}:${e.bindingRef}`:e.virtual?"virtual":""),r=[...t.visualSources.map(e=>`${e.role}:${e.eid}`),...t.criticalSources.map(e=>`critical:${e.eid}`)].sort(),o=i?`${i.kind}:${i.eid}:${i.attribute||""}`:"none";return[n,t.sourceKind,...r,`value:${o}`].join("\n")}function Hu(e,t,i){return Nu(t,i||Iu(e,t),null).replace(/\nvalue:none$/,"")}function Lu(e){if(e.effectiveHidden)return[];if("static_icon"===e.display)return["static-icon"];const t=[],{visual:i}=e;return"alarm"===e.pulse.kind?t.push("alarm"):"unavailable"===i.availability?t.push("unavail"):"working"===i.status?t.push("on"):"open"===i.status&&t.push("open"),e.lockState&&t.push(`lock-${e.lockState}`),"none"!==e.pulse.reason&&"alarm"!==e.pulse.reason&&t.push("activity-"+e.pulse.reason),e.pulse.generation%2==0&&(t.push("pulse-gen2"),"short"===e.pulse.kind&&t.push("activity-gen2")),t}function qu(e,t,i){const n=Ai(t.marker?.display),r="static_icon"===n,o=r&&!1===i.sourceDetails?Au:Iu(e,t,i.lightDevices||[t],i.lightSources,i.registryHass||e),s=t.bindingStatus,a="ha_disabled"===s?.kind,l="orphaned"===s?.kind,c=a?"ha_disabled":l?"orphaned":"active",h=!0===t.userHidden||!0===t.marker?.hidden,d=Sc(o.samples),u=o.visualSources.find(e=>e.eid.startsWith("lock.")),p=u?["unlocked","open"].includes(u.state.toLowerCase())?"unlocked":"locked"===u.state.toLowerCase()?"locked":null:null,_=!zc(t.marker)&&uh(t.marker?.binding,t.marker?.controls??t.controls,t.entities).length>0,m="controls"===o.sourceKind||_&&"light"!==o.sourceKind&&"cover"!==o.sourceKind,g=r&&!1===i.sourceDetails?{source:null,text:null,fallback:null}:Eu(e,t,o,i.showTemperature),f=Nu(t,o,g.source),v=Hu(e,t,o),y=i.activityRuntime,b=i.now??Date.now(),w=y?.expiresAt||(y?.flashTs?y.flashTs+3300:0),k=y?.sources===v&&y.flashTs&&y.flashKind&&w>b?y.flashKind:null,x=function(e){const t=[],i="ha_disabled"===e.bindingLifecycle||"orphaned"===e.bindingLifecycle;let n=!1;"ha_disabled"===e.bindingLifecycle?(n=!0,t.push("lifecycle.ha_disabled_hidden")):e.userHidden&&!e.designPreview?(n=!0,t.push("lifecycle.user_hidden")):e.userHidden?t.push("lifecycle.user_hidden_preview"):"orphaned"===e.bindingLifecycle?t.push("lifecycle.orphaned_diagnostic"):t.push("lifecycle.active");const r="static_icon"===e.display;let o=e.controllerFace?{...e.sourceVisual,availability:e.controllerAvailability}:e.sourceVisual;t.push(e.controllerFace?"available"===e.controllerAvailability?"availability.controller_available":"availability.controller_unavailable":"availability.source"),n?(o=Ru,t.push("face.hidden")):r?(o=Ru,t.push("face.static")):"alarm"===e.sourceVisual.status||e.liveStates?t.push("face.dynamic"):(o=Ru,t.push("face.live_states_disabled")),!r&&!n&&e.liveStates&&"alarm"!==e.sourceVisual.status&&e.shortActivity&&(o={...o,activity:e.shortActivity},t.push(`activity.short_${e.shortActivity}`)),"alarm"===o.status?t.push("status.alarm"):"unavailable"===o.availability?t.push("status.unavailable"):"working"===o.status?t.push("status.working"):"open"===o.status?t.push("status.open"):t.push("status.neutral");const s="value"===e.display&&!n&&e.valueAvailable?"value":"icon";t.push("value"===s?"content.value":"value"===e.display?"content.value_fallback_icon":"content.icon"),"value"===e.display&&!e.valueAvailable&&e.valueFallback&&t.push(`content.${e.valueFallback}`);const a=e.liveStates&&!r&&!n,l=!r&&!n,c=!n&&!i&&!r&&"available"===o.availability&&("alarm"===o.status||e.liveStates&&"icon_ripple"===e.display),h=l&&e.vacuumLiveRequested;return t.push(a?"diagnostics.dynamic_icon":"diagnostics.base_icon"),t.push(l?"diagnostics.metrics_enabled":"diagnostics.metrics_suppressed"),t.push(c?"activity.pulse_eligible":"activity.pulse_suppressed"),t.push(h?"diagnostics.vacuum_live":"diagnostics.vacuum_static"),{effectiveHidden:n,bindingUnavailable:i,visual:o,face:s,dynamicIcon:a,metrics:l,liveColor:a,pulseEligible:c,vacuumLive:h,decisionIds:t}}({bindingLifecycle:c,userHidden:h,designPreview:!0===i.designPreview,display:n,liveStates:i.liveStates,sourceVisual:d,controllerFace:m,controllerAvailability:m?Pu(e,t):"available",shortActivity:k,valueAvailable:null!=g.text,valueFallback:g.fallback,vacuumLiveRequested:!0===t.marker?.vacuum?.live}),{effectiveHidden:$,visual:S}=x,M="icon_ripple"===n&&!$&&i.liveStates&&"alarm"!==S.status?S.activity:"none",R=x.metrics&&i.showTemperature?!0===t.marker?.use_climate_temp?Ah(e,t.entities):"mdi:thermometer"===t.icon||"mdi:air-filter"===t.icon?Dh(e,t.entities):null:null,T=x.metrics&&i.showTemperature&&t.primary&&Oh(e,t.primary)?zh(e,t.entities):null,C=x.metrics&&i.showSignal&&!t.virtual?Ch(e,t.entities):null,D=i.lightSources||("derived_marker_state"===t.marker?.value_badge?.source?.kind?Mh(e,i.lightDevices||[t]):[]),A=function(e,t,i){const n=null!=t.marker?.value_badge;if(i.effectiveHidden||"static_icon"===i.display)return null;const r=t.marker?.value_badge;if(n)return r?.enabled?r.source?{configured:!0,enabled:!0,position:r.position||"right",...vu(e,t,r.source,i.markerStates)}:{configured:!0,enabled:!0,source:null,sourceLabel:"",text:"—",fullText:e?.localize?.("state.default.unavailable")||"Unavailable",position:r.position||"right",availability:"missing",isLqi:!1,tone:"default"}:null;if(!i.showTemperature||"value"===i.display)return null;const o=yu(e,t);if(!o)return null;let s=null,a="default";if("entity_attribute"===o.kind&&"current_temperature"===o.attribute){const i=Ah(e,t.entities);null!=i&&(s=`${i}°`),a="temperature"}else if("mdi:thermometer"===t.icon||"mdi:air-filter"===t.icon){const i=Dh(e,t.entities);null!=i&&(s=`${i}°`),a="temperature"}else{const i=zh(e,t.entities);null!=i&&(s=`${i}%`),a="humidity"}return null==s?null:{configured:!1,enabled:!0,source:o,position:"right",sourceLabel:"entity_attribute"===o.kind?`${mu(o.attribute)} · ${_u(e,o.entity_id)}`:"entity_state"===o.kind?_u(e,o.entity_id):"",text:s,fullText:s,availability:"available",isLqi:!1,tone:a}}(e,t,{showTemperature:i.showTemperature,showSignal:i.showSignal,display:n,effectiveHidden:$,markerStates:D.filter(e=>e.key.startsWith("marker:")).map(e=>({ref:e.key,on:e.on,name:e.device.name}))}),O=o.visualSources.find(e=>!e.eid.startsWith("marker:")),z="cover"===o.sourceKind?O?.eid:t.primary||O?.eid,P=z?e?.states?.[z]:null,F=x.dynamicIcon?dn(t.icon,z?.split(".")[0],P?.attributes?.device_class,P?.state,!!t.marker?.icon):t.icon,I=x.liveColor&&o.visualSources.filter(e=>!e.eid.startsWith("marker:")).map(t=>function(e){return e&&"on"===e.state?Wt(e.attributes?.rgb_color):null}(e?.states?.[t.eid])).find(e=>!!e)||null,E=Number(t.marker?.size)>0?Number(t.marker.size):1,N=Number(t.marker?.angle)||0,H=Number(t.marker?.ripple_size)>0?Number(t.marker.ripple_size):1.5,L=qt(t.marker?.ripple_color,null),q=r?null:L||I||null,j=function(e){const{display:t,visual:i,semanticActivity:n,liveStates:r,effectiveHidden:o,bindingUnavailable:s=!1,reducedMotion:a=!1}=e,l=Math.max(1,Math.trunc(e.shortGeneration||1)),c=Number.isFinite(e.diameterScale)?Math.max(1,Number(e.diameterScale)):1.5,h=e.color||function(e,t){return"presence"===t?"#1DC21D":"running"===t||"working"===e.status||"open"===e.status?"#F0A00C":"#0C82F0"}(i,n);if(o||s||"unavailable"===i.availability||"static_icon"===t)return Su(l,h,c);if("alarm"===i.status)return{kind:"alarm",reason:"alarm",generation:l,expiresAt:null,color:"#F0410C",diameterScale:1.5,animated:!a,reducedMotionIndicator:"none"};if(!r||"icon_ripple"!==t)return Su(l,h,c);const d=e.now??Date.now(),u=e.shortExpiresAt||null;return e.shortReason&&null!=u&&u>d?{kind:"short",reason:e.shortReason,generation:l,expiresAt:u,color:h,diameterScale:a?1:c,animated:!a,reducedMotionIndicator:a?"dot":"none"}:"presence"===n||"transition"===n||"running"===n?{kind:"continuous",reason:n,generation:l,expiresAt:null,color:h,diameterScale:a?1:c,animated:!a,reducedMotionIndicator:a?"dot":"none"}:Su(l,h,c)}({display:n,visual:S,semanticActivity:d.activity,shortReason:y?.sources===v?y?.flashKind:null,shortGeneration:y?.gen,shortExpiresAt:y?.sources===v?w:null,now:b,liveStates:i.liveStates,effectiveHidden:$,bindingUnavailable:x.bindingUnavailable,reducedMotion:i.reducedMotion,color:q,diameterScale:H}),B="value"===x.face?g.text:null,W="ha_disabled"===s?.kind?s.reason:null,U="ha_disabled"===(G={lifecycle:c,display:n,liveStates:i.liveStates,sourceKind:o.sourceKind,primaryDomain:(t.primary||"").split(".")[0],visual:S,activity:M}).lifecycle?"ha_disabled":"orphaned"===G.lifecycle?"orphaned":"static_icon"===G.display?"static_icon":"alarm"===G.visual.status?"alarm":G.liveStates?"unavailable"===G.visual.availability?"unavailable":"cover"===G.sourceKind?"cover_icon_state":"presence"===G.activity?"presence":"event"===G.activity?"event":"transition"===G.activity?"transition":"working"===G.visual.status?"icon_ripple"===G.display&&"none"!==G.activity?"working_activity":"working":"open"===G.visual.status?"open":"media_player"===G.primaryDomain?"media_neutral":"neutral":"live_states_disabled";var G;const V=[];i.designPreview&&h&&V.push("hidden_design_preview"),r||!0!==t.marker?.vacuum?.live||V.push("vacuum_live_plan_only");const K=o.visualSources.some(t=>"power_gate"===t.role||wc(e,t.eid)),Y=t.entities.filter(t=>t.startsWith("switch.")&&!e?.entities?.[t]?.entity_category).length;K&&Y>1&&V.push("composite_power_source"),"icon_ripple"!==n&&"static_icon"!==n&&"alarm"!==d.status&&"none"!==d.activity&&V.push("activity_display_disabled");const Z={binding:t.marker?.binding||(t.bindingKind&&t.bindingRef?`${t.bindingKind}:${t.bindingRef}`:t.virtual?"virtual":""),sourceKind:o.sourceKind,visualSources:o.visualSources,criticalSources:o.criticalSources,valueSource:g.source,sourceSignature:f,decisionIds:[...o.decisionIds,...x.decisionIds,...A?["diagnostics.value_badge"]:[],...null==C?[]:[`diagnostics.lqi_${Tu(C)}`],`pulse.${j.kind}_${j.reason}`],visual:S,lockState:p,display:n,icon:F,valueText:B,valueFullText:B,fallbackReason:"value"!==n||B?null:g.fallback,activity:M,activityGeneration:y?.gen||1,pulse:j,classes:[],tempText:null==R?null:String(R),humText:null==T?null:String(T),valueBadge:A,lqiText:null==C||A?.isLqi?null:String(C),lqiColor:null==C?null:Cu(C),lqiBand:null==C?null:Tu(C),lightColor:I,scale:E,angle:N,rippleScale:H,rippleColor:q,userHidden:h,effectiveHidden:$,haDisabled:a,disabledReason:W,orphaned:l,vacuumLive:x.vacuumLive,explanation:{reason:U,notices:V}};return{...Z,classes:Lu(Z)}}function ju(e,t=new WeakMap){if(null===e||"object"!=typeof e)return e;const i=e,n=t.get(i);if(n)return n;if(Array.isArray(e)){const n=[];t.set(i,n);for(const i of e)n.push(ju(i,t));return Object.freeze(n)}const r={};t.set(i,r);for(const[i,n]of Object.entries(e))"function"!=typeof n&&(r[i]=ju(n,t));return Object.freeze(r)}function Bu(e){const t=new Map(e);let i;return i=Object.freeze({get size(){return t.size},get:e=>t.get(e),has:e=>t.has(e),entries:()=>t.entries(),keys:()=>t.keys(),values:()=>t.values(),forEach:(e,n)=>t.forEach((t,r)=>e.call(n,t,r,i)),[Symbol.iterator]:()=>t[Symbol.iterator]()}),i}function Wu(e){const t=new Set(e.entityIds||[]),i=new Set(e.deviceIds||[]),n=new Set(e.areaIds||[]);for(const n of e.devices){for(const e of n.entities||[])t.add(e);n.primary&&t.add(n.primary);for(const e of n.controls||[])t.add(e);n.marker?.vacuum?.source&&t.add(n.marker.vacuum.source),"device"===n.bindingKind&&n.bindingRef&&i.add(n.bindingRef),"entity"===n.bindingKind&&n.bindingRef&&t.add(n.bindingRef)}const r={},o={};for(const[o,s]of Object.entries(e.hass?.entities||{})){const a=s?.device_id?e.hass?.devices?.[s.device_id]:null;(t.has(o)||s?.device_id&&i.has(s.device_id)||n.has(s?.area_id)||n.has(a?.area_id))&&(t.add(o),r[o]=s,s?.device_id&&i.add(s.device_id))}for(const t of i){const i=e.hass?.devices?.[t];i&&(o[t]=i)}const s={};for(const i of t){const t=e.hass?.states?.[i];t&&(s[i]=t)}const a=Object.freeze({states:ju(s),entities:ju(r),devices:ju(o),config:ju(e.hass?.config),locale:ju(e.hass?.locale),themes:ju(e.hass?.themes)});return Object.freeze({sourceSequence:e.sourceSequence,capturedAt:e.capturedAt??Date.now(),hass:a,devices:ju([...e.devices]),positions:Bu([...e.positions||[]].map(([e,t])=>[e,Object.freeze({x:t.x,y:t.y})])),presentations:Bu([...e.presentations].map(([e,t])=>[e,ju(t)])),facts:Bu([...e.facts||[]].map(([e,t])=>[e,ju(t)]))})}const Uu=(e,t)=>`${e}:${t?1:0}`;function Gu(e){return"boolean"==typeof e?.themes?.darkMode?e.themes.darkMode?"theme-dark":"theme-light":""}function Vu(e){const t=[];if(1!==e.scale&&t.push(`--dev-scale:${e.scale}`),"none"!==e.pulse.kind){t.push(`--ripple-scale:${e.pulse.diameterScale}`);const r=(i=e.pulse.color,n=null,"string"==typeof i&&(Lt.test(i)||Bt.test(i))?i:n);r&&t.push(`--ripple-color:${r}`)}var i,n;return t}function Ku(e){const t=[...String(e)].reduce((e,t)=>/\s/.test(t)?e+.35:e+(t.codePointAt(0)>255?1:.62),0);return t<=8?.45:Math.max(.25,Math.round(3.6/t*1e3)/1e3)}function Yu(e,t){const i=e.pulse,n=i.generation%2==0,r=function(e){const t=e.valueBadge;if(!t||!1!==t.configured)return[];const i=[];return null!=e.tempText&&"temperature"!==t.tone&&i.push({kind:"temperature",text:e.tempText,suffix:"°"}),null!=e.humText&&"humidity"!==t.tone&&i.push({kind:"humidity",text:e.humText,suffix:"%"}),i}(e),o=e.valueBadge,s=o?.position||"right",a=!!o||r.length>0,l=["device-shell",null!=e.valueText?"text-shell":"",a?`with-values pos-${s}`:"",r.length?"with-legacy":""].filter(Boolean).join(" ");return B`
    ${"none"!==i.kind&&"dot"!==i.reducedMotionIndicator?B`<span class="device-pulse activity-ring ${i.kind} ${i.reason} reason-${i.reason} ${n?"gen2":""}"
          aria-hidden="true"><i></i><i></i><i></i></span>`:G}
    ${"dot"===i.reducedMotionIndicator?B`<span class="activity-dot" aria-hidden="true"></span>`:G}
    ${t.newDevice?B`<span class="newdot" title=${t.newDeviceTitle||""} aria-hidden="true"></span>`:G}
    ${e.haDisabled?B`<span class="habadge" title=${t.disabledTitle||""} aria-hidden="true"><ha-icon icon="mdi:power-plug-off-outline"></ha-icon></span>`:G}
    <span class=${l} aria-hidden="true">
      <span class="device-shell-frame"></span>
      <span class="device-core">
        ${null!=e.valueText?B`<span class="valtext" title=${e.valueFullText||e.valueText}
              style=${`--value-font-scale:${Ku(e.valueFullText||e.valueText)}`}
            >${e.valueText}</span>`:B`<ha-icon icon=${e.icon}
              style=${e.angle?`transform:rotate(${e.angle}deg)`:G}></ha-icon>`}
      </span>
      ${a?B`<span class="device-sections">
        ${o?B`<span
              class=${function(e){return`value-badge pos-${e.position} ${e.availability} tone-${e.tone}`}(o)}
              title=${hu(o)}
              style=${`--value-font-scale:${Ku(o.fullText||o.text)}`}
            >${o.text}</span>`:G}
        ${r.map(e=>B`<span
          class="value-badge legacy-secondary available tone-${e.kind}"
          title=${e.text+e.suffix}
          style=${`--value-font-scale:${Ku(e.text+e.suffix)}`}
        >${e.text}${e.suffix}</span>`)}
      </span>`:G}
    </span>
    ${null!=e.lqiText?B`<span class="${function(e){return"lqi"+("bottom"===e?.position?" below-value-badge":"")}(e.valueBadge)}${e.lqiBand?` band-${e.lqiBand}`:""}"
          style=${e.lqiColor?`color:${e.lqiColor}`:G}>${e.lqiText}</span>`:G}
  `}function Zu(e){return!Number.isFinite(e)||e<=0?2.25:e/2.5*2.25}function Xu({openings:e,geometries:t,fillsByRoomId:i,idPrefix:n="data",groupClass:r="opening-tunnels",dataLayer:o="data"}){const s=e.map((e,r)=>{const o=t[r];if(!o)return G;const s=o.faces.find(e=>-1===e.side),a=o.faces.find(e=>1===e.side);if(!s||!a)return G;const l=i.get(s.roomId)||null,c=i.get(a.roomId)||null;if(!l&&!c)return G;const h=`${s.d} ${a.d}`,d=!!l&&!!c&&l.color===c.color&&l.opacity===c.opacity,u=`translate(${e.rx} ${e.ry}) rotate(${e.angle})`;if(d)return W`<path class="opening-tunnel" data-hp="opening-tunnel" data-id=${e.id} data-kind=${e.type}
        data-wall-key=${o.wallKey} aria-hidden="true" pointer-events="none"
        transform=${u} d=${h} fill=${l.color}
        fill-opacity=${l.opacity} fill-rule="nonzero"></path>`;const p=o.maxY-o.minY;if(!(p>0))return G;const _=`${(100*Math.max(0,Math.min(1,-o.minY/p))).toFixed(6)}%`,m=l||{color:"#000000",opacity:0},g=c||{color:"#000000",opacity:0},f=`hp-opening-tunnel-${n.replace(/[^a-zA-Z0-9_-]/g,"-")}-${r}`;return W`<g class="opening-tunnel" data-hp="opening-tunnel" data-id=${e.id} data-kind=${e.type}
      data-wall-key=${o.wallKey} aria-hidden="true" pointer-events="none"
      transform=${u}>
      <defs><linearGradient id=${f} gradientUnits="userSpaceOnUse"
        x1="0" y1=${o.minY} x2="0" y2=${o.maxY}>
        <stop offset="0%" stop-color=${m.color} stop-opacity=${m.opacity}></stop>
        <stop offset=${_} stop-color=${m.color} stop-opacity=${m.opacity}></stop>
        <stop offset=${_} stop-color=${g.color} stop-opacity=${g.opacity}></stop>
        <stop offset="100%" stop-color=${g.color} stop-opacity=${g.opacity}></stop>
      </linearGradient></defs>
      <path d=${h} fill=${`url(#${f})`} fill-rule="nonzero"></path>
    </g>`});return W`<g class=${r} data-layer=${o} aria-hidden="true" pointer-events="none">${s}</g>`}function Ju(e,t,i){const n=i>0?i:1;return{a:[e[0]/n,e[1]/n],b:[t[0]/n,t[1]/n]}}function Qu(e,t){const i=t>0?t:1;return[e.a[0]*i,e.a[1]*i,e.b[0]*i,e.b[1]*i]}function ep(e){return Array.isArray(e)&&e.length>=2&&Number.isFinite(Number(e[0]))&&Number.isFinite(Number(e[1]))}function tp(e){if(!Array.isArray(e))return[];const t=[];for(const i of e){if(!i||"object"!=typeof i)continue;const e=i;if(!ep(e.a)||!ep(e.b))continue;const n=[Number(e.a[0]),Number(e.a[1])],r=[Number(e.b[0]),Number(e.b[1])];Math.hypot(r[0]-n[0],r[1]-n[1])<.001||t.push({a:n,b:r})}return t}function ip(e,t,i,n,r=!0){const o=(e||[]).filter(e=>e?.id),s=tp(t);if(s.length)return function(e,t,i,n){const r=tp(e);if(!r.length)return[];const o=function(e,t){const i=[],n=(e||[]).filter(e=>e?.id);for(let e=0;e<n.length;e++){const r=Zt(n[e]);if(r)for(let o=e+1;o<n.length;o++){const s=Zt(n[o]);if(s)for(const a of bn(r,s,t))i.push({seg:a,pair:`${n[e].id}:${n[o].id}`,a:n[e],b:n[o]})}}return i}(t,n);if(!o.length)return[];const s=[],a=Math.max(4*n,1e-6);for(const e of r){const t=Qu(e,i),r=t[0],l=t[1],c=t[2]-r,h=t[3]-l,d=Math.hypot(c,h);if(d<a)continue;const u=c/d,p=h/d,_=new Map;for(const{seg:e,pair:t}of o){const i=Math.abs((e[0]-r)*p-(e[1]-l)*u),o=Math.abs((e[2]-r)*p-(e[3]-l)*u);if(i>4*n||o>4*n)continue;const s=(e[0]-r)*u+(e[1]-l)*p,c=(e[2]-r)*u+(e[3]-l)*p,h=Math.max(0,Math.min(s,c)),m=Math.min(d,Math.max(s,c));if(m-h<a)continue;const g=_.get(t)||[];g.push({lo:h,hi:m}),_.set(t,g)}for(const[e,t]of _){t.sort((e,t)=>e.lo-t.lo||e.hi-t.hi);const i=[];for(const e of t){const t=i[i.length-1];t&&e.lo<=t.hi+a?t.hi=Math.max(t.hi,e.hi):i.push({...e})}for(const t of i){const i=[r+u*t.lo,l+p*t.lo],n=[r+u*t.hi,l+p*t.hi];Math.hypot(n[0]-i[0],n[1]-i[1])<a||s.push({pair:e,seg:[i[0],i[1],n[0],n[1]]})}}}const l=[],c=Math.max(4*n,1e-6);for(const{pair:e,seg:t}of s){const i=t[2]-t[0],n=t[3]-t[1],r=Math.hypot(i,n);if(r<a)continue;let o=i/r,s=n/r;(o<-1e-12||Math.abs(o)<=1e-12&&s<0)&&(o=-o,s=-s);let h=l.find(i=>i.pair===e&&Math.abs(i.ux*s-i.uy*o)<=1e-6&&Math.abs((t[0]-i.origin[0])*i.uy-(t[1]-i.origin[1])*i.ux)<=c&&Math.abs((t[2]-i.origin[0])*i.uy-(t[3]-i.origin[1])*i.ux)<=c);h||(h={pair:e,origin:[t[0],t[1]],ux:o,uy:s,ranges:[]},l.push(h));const d=(t[0]-h.origin[0])*h.ux+(t[1]-h.origin[1])*h.uy,u=(t[2]-h.origin[0])*h.ux+(t[3]-h.origin[1])*h.uy;h.ranges.push({lo:Math.min(d,u),hi:Math.max(d,u)})}const h=[];for(const e of l){e.ranges.sort((e,t)=>e.lo-t.lo||e.hi-t.hi);const t=[];for(const i of e.ranges){const e=t[t.length-1];e&&i.lo<=e.hi+a?e.hi=Math.max(e.hi,i.hi):t.push({...i})}for(const n of t){const t=[e.origin[0]+e.ux*n.lo,e.origin[1]+e.uy*n.lo],r=[e.origin[0]+e.ux*n.hi,e.origin[1]+e.uy*n.hi];Math.hypot(r[0]-t[0],r[1]-t[1])>=a&&h.push(Ju(t,r,i))}}return h}(s,e,i,n).map(e=>Qu(e,i));if(!r)return[];const a=[],l=(e,t)=>(e.open_to||[]).includes(t.id)||(t.open_to||[]).includes(e.id);for(let e=0;e<o.length;e++)for(let t=e+1;t<o.length;t++){if(!l(o[e],o[t]))continue;const i=Zt(o[e]),r=Zt(o[t]);if(i&&r)for(const e of bn(i,r,n))a.push(e)}return a}function np(e,t,i,n,r){for(const o of n)if(!(Pn([e,t],o)>r)&&zo([o[0],o[1]],[o[2],o[3]],i))return!0;return!1}const rp=e=>Array.isArray(e)&&e.length>=2&&Number.isFinite(Number(e[0]))&&Number.isFinite(Number(e[1])),op=(e,t,i)=>[Number(e[0])*i,Number(e[1])*i,Number(t[0])*i,Number(t[1])*i],sp=e=>{const t=`${Number(e[0]).toFixed(9)},${Number(e[1]).toFixed(9)}`,i=`${Number(e[2]).toFixed(9)},${Number(e[3]).toFixed(9)}`;return t<=i?`${t}|${i}`:`${i}|${t}`},ap=e=>{const t=new Map;for(const i of e.flat())!Array.isArray(i)||i.length<4||!i.every(Number.isFinite)||Math.hypot(i[2]-i[0],i[3]-i[1])<=1e-9||t.set(sp(i),[...i]);return[...t.values()]};function lp(e){return"solid"===e?.zero_wall_style?"solid":"dashed"}function cp(e,t=1,i){const n=[];for(const r of Array.isArray(e?.wall_segments)?e.wall_segments:[])0===Number(r?.cm)&&rp(r?.a)&&rp(r?.b)&&(i&&!i.has(String(r.id||""))||n.push(op(r.a,r.b,t)));return ap([n])}function hp(e,t=1){const i=[];for(const n of Array.isArray(e?.partitions)?e.partitions:[])0===Number(n?.cm)&&rp(n?.a)&&rp(n?.b)&&i.push(op(n.a,n.b,t));for(const n of Array.isArray(e?.room_drafts)?e.room_drafts:[]){const e=Array.isArray(n?.points)?n.points:[];for(let r=0;r+1<e.length;r++)0===Number(n?.segments?.[r]?.cm)&&rp(e[r])&&rp(e[r+1])&&i.push(op(e[r],e[r+1],t))}return ap([i])}function dp(e,t,i,n){if(!e)return[];const r=tp(e.open_spans);return ip(t,r.length?r:null,i,n,!0)}function up(e,t,i,n){const r=lp(e),o=new Set;for(const e of t.rooms||[])for(const t of Array.isArray(e.wall_ids)?e.wall_ids:[])"string"==typeof t&&t&&o.add(t);const s=ap([cp(t,1,o.size?o:void 0),dp(e,t.rooms,i,n)]),a=ap([s,hp(t,1)]);return{style:r,lines:a,contour:s,barriers:"solid"===r?a:[],transmissive:"dashed"===r?s:[]}}function pp(e,t){return(e||[]).some(e=>e?.host?.kind===t.kind&&e.host.id===t.id)}const _p=new WeakMap,mp=new WeakMap;function gp(e){const t=za(e.cfg),i={};for(const t of e.cfg.spaces||[])for(const e of t.rooms||[])e.area&&(i[e.area]=t.id);const n=e.cfg.settings?.exclude_integrations?new Set(e.cfg.settings.exclude_integrations):Te,r=De(e.cfg.settings?.icon_rules?.length?e.cfg.settings.icon_rules:Ce);return Wh({hass:e.hass,registry:e.registry,areaToSpace:i,markers:e.cfg.markers||[],settings:e.cfg.settings||{},excluded:n,showAll:!!e.cfg.settings?.show_all,firstSpaceId:t[0]?.id||"",loc:t=>ou(e.lang,t),iconRules:r})}function fp(e){const t=za(e.cfg).find(t=>t.id===e.spaceId);if(!t)return null;const i=tn(e.cfg.spaces.find(t=>t.id===e.spaceId)),n=on(e.cfg.settings),r=e.iconSize??2.5,o=r>8?2.5:r,s=Zu(o),a=e.registry?Xc(e.hass,e.registry):e.hass,l=e.registry?Jc(e.hass,e.registry):e.hass,c=(e.devices||gp(e)).filter(t=>t.space===e.spaceId),h=c.filter(e=>!e.hidden),d=function(e,t,i){const n={},r=i/100*el(t)*1.3;for(const i of t.rooms){if(!i.area)continue;const t=e.filter(e=>e.area===i.area);if(!t.length)continue;const o=rl(i),s=.1*Math.min(o.w,o.h),a=o.w-2*s,l=o.h-2*s,c=Math.max(1,Math.round(Math.sqrt(t.length*a/Math.max(l,1)))),h=a/c,d=l/Math.max(Math.ceil(t.length/c),1),u=t.map((e,t)=>({x:o.x+s+h*(t%c+.5),y:o.y+s+d*(Math.floor(t/c)+.5)}));Ti(u,o,r,.5*s),t.forEach((e,t)=>n[e.id]=La(u[t]))}return n}(c,t,o),u=[];for(const t of h){const i=e.layout[t.id];if(i&&i.s===e.spaceId){const e=i.x*Ra,t=i.y*Ra;u.push({minX:e,minY:t,maxX:e,maxY:t})}}const p=e.cfg.spaces.find(t=>t.id===e.spaceId)||{},_=Array.isArray(p.walls)?p.walls:[],m=Number(p.cell_cm)>0?Number(p.cell_cm):5,g=up(p,t,Ra,.02*Ea),f=(p.openings||[]).flatMap(e=>{if("partition"!==e.host?.kind)return[];const i=Td(e,t.partitions,Ra,m,Ea).resolved;return i?[i]:[]}),v=Rl({partitions:t.partitions,roomDrafts:t.room_drafts,columns:t.wall_columns,cellCm:m,hostedOpenings:f.map(e=>({id:e.opening.id,host:e.host,length:e.length,type:e.opening.type}))}),y=function(e,t,i,n){let r=mp.get(e);r||(r=new Map,mp.set(e,r));const o=r.get(t);if(o?.fingerprint===i)return o.value;const s=n();return r.set(t,{fingerprint:i,value:s}),s}(e.cfg,t.id,v,()=>ca(t,m,Ea,2e-4*Ea,f.map(Ad)).all);for(const e of y){const t=e.map(e=>e[0]),i=e.map(e=>e[1]);t.length&&u.push({minX:Math.min(...t),minY:Math.min(...i),maxX:Math.max(...t),maxY:Math.max(...i)})}for(const e of g.lines)u.push({minX:Math.min(e[0],e[2]),minY:Math.min(e[1],e[3]),maxX:Math.max(e[0],e[2]),maxY:Math.max(e[1],e[3])});const b=Ja(t,u),w=[b.x,b.y,b.w,b.h],k=new Map(t.rooms.map(t=>{const r=Rn(i.fill,t);return[t,an(r,"lqi"===r&&t.area?Kh(a,c,t.area):null,"light"===r?Th(Mh(a,c,t,e.virtualLights)):"none","temp"===r&&t.area?Yh(a,c,t.area):null,i.tempMin,i.tempMax,n,en(i.customFill,t))]})),x=new Map;for(const e of t.rooms)e.id&&x.set(e.id,k.get(e)||null);const $=function(e,t=1e3){const i=[];for(const[n,r]of(e||[]).entries()){if("passage"!==r?.type)continue;const e={...r,id:String(r.id||`passage-${n}`),type:"passage",rx:Number(r.x)*t,ry:Number(r.y)*t,rlen:Number(r.length)*t};[e.rx,e.ry,e.rlen,e.angle].every(Number.isFinite)&&e.rlen>0&&i.push(e)}return i}((p.openings||[]).flatMap(e=>{if(!e.host||"wall"===e.host.kind)return[e];const t=f.find(t=>t.opening.id===e.id);return t?[Id(e,t,Ra)]:[]}),Ra),S=gs(t.rooms,_,g.contour,Na,m,Ea,Ra),M=f.filter(e=>Pd(e,S,2e-4*Ea)).map(e=>({x:e.center[0],y:e.center[1],angle:e.angle,length:e.length})),R=t.rooms.filter(e=>e.area||i.showBorders||"none"!==Rn(i.fill,e)).map(e=>{let n="room "+(t.bg?"overlay":"yard"),r="";const o=Rn(i.fill,e);if(i.showBorders||"none"!==o){n+=" styled";const t=[`--room-stroke:${i.color}`,`--room-stroke-op:${i.showBorders&&!g.contour.length?i.opacity:0}`],o=k.get(e)||null;o?(n+=" filled",t.push(`--room-fill:${o.color}`,`--room-fill-op:${o.opacity.toFixed(3)}`)):t.push("--room-fill:transparent","--room-fill-op:0"),r=t.join(";")}const s=e.id||G,a=e.area||G,l=e.poly?W`<polygon class="${n}" style="${r}" data-hp="room" data-id=${s} data-area=${a}
            points="${e.poly.map(e=>e.join(",")).join(" ")}"></polygon>`:W`<rect class="${n}" style="${r}" data-hp="room" data-id=${s} data-area=${a}
            x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${.03*Math.min(e.w,e.h)}"></rect>`;return l}),T=t.rooms.filter(e=>{const t=k.get(e);return Tn(i.glow,e)&&(!t||t.opacity<=0)}).map(e=>e.poly?W`<polygon class="glow-base" aria-hidden="true" pointer-events="none"
          data-room-id=${e.id||G}
          points="${e.poly.map(e=>e.join(",")).join(" ")}"
          fill=${n.glow_base.c} fill-opacity=${n.glow_base.a}></polygon>`:W`<rect class="glow-base" aria-hidden="true" pointer-events="none"
          data-room-id=${e.id||G}
          x=${e.x} y=${e.y} width=${e.w} height=${e.h}
          rx=${.03*Math.min(e.w,e.h)}
          fill=${n.glow_base.c} fill-opacity=${n.glow_base.a}></rect>`),C=new Map;for(const e of t.rooms)if(e.id){const t=k.get(e)||null;C.set(e.id,Tn(i.glow,e)&&(!t||t.opacity<=0)?{color:n.glow_base.c,opacity:n.glow_base.a,mode:"glow"}:null)}const D=Mh(a,h,null,e.virtualLights),A=h.map(n=>{const r=function(e,t,i,n,r){const o=t[e.id];return o&&o.s===e.space?{x:o.x*Ra,y:o.y*Ra}:n[e.id]?n[e.id]:La(Qa(r))}(n,e.layout,e.cfg,d,t),o=(r.x-w[0])/w[2]*100,s=(r.y-w[1])/w[3]*100,c=i.showLqi??!1!==e.showSignal,u=e.presentations?.get(Uu(n.id,c))||qu(a,n,{liveStates:!1!==e.liveStates,showTemperature:!1!==e.showTemperature,showSignal:c,activityRuntime:e.activityRuntime?.get(n.id),sourceDetails:!1,lightDevices:h,lightSources:D,registryHass:l,reducedMotion:e.reducedMotion}),p=[`left:${o}%`,`top:${s}%`,...Vu(u)],_=Du(u),m=[n.name,ou(e.lang,`marker.state_a11y_${_}`),"none"!==u.pulse.kind?ou(e.lang,`marker.pulse_a11y_${u.pulse.reason}`):"",u.valueFullText||u.valueText||"",hu(u.valueBadge),null!=u.lqiText&&u.lqiBand?ou(e.lang,`marker.lqi_a11y_${u.lqiBand}`,{value:u.lqiText}):""].filter(Boolean).join(", ");return B`<div class="dev ${Gu(a)} ${u.classes.join(" ")} ${n.virtual?"virtual":""} ${null!=u.valueText?"valonly":""}"
      data-hp="device" data-id="${n.id}" data-entity=${n.primary||G} data-area=${n.area||G}
      role="img" aria-label=${m}
      data-state=${_}
      data-lqi-band=${null!=u.lqiText&&u.lqiBand||G}
      data-binding-status=${"ha_disabled"===n.bindingStatus?.kind?"ha-disabled":n.bindingStatus?.kind||"active"}
      data-disabled-reason=${u.disabledReason?u.disabledReason.replace("_","-"):G}
      style="${p.join(";")}">
      ${Yu(u,{})}
    </div>`}),O=i.showNames?t.rooms.filter(e=>e.name).map(n=>{const r=ol(n,t.id,e.layout,e.cfg),o=(r.x-w[0])/w[2]*100,s=(r.y-w[1])/w[3]*100,a=Math.min(1,i.opacity+.25);return B`<div class="roomlabel"
            data-hp="room-label" data-id=${n.id||G} data-area=${n.area||G}
            style="left:${o}%;top:${s}%;color:${i.color};opacity:${a}">${n.name}</div>`}):[],z=t.bg?e.displayUrl?e.displayUrl(t.bg.href):t.bg.href:"",P=e.cfg.spaces.find(t=>t.id===e.spaceId)?.settings||{},F="daynight"===sr(e.cfg?.settings,P)?Yn(a,e.dayCycleNow??new Date):null,I=nn(e.cfg?.settings,i),E=!!(_.length||y.length&&i.showBorders),N=E?Rl($.length?{rooms:t.rooms,walls:_,extras:y,cellCm:m,zero:g.contour,passages:$.map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),hostedCompositeOpenings:M}:{rooms:t.rooms,walls:_,extras:y,cellCm:m,zero:g.contour}):"",H=E?function(e,t,i,n){let r=_p.get(e);r||(r=new Map,_p.set(e,r));const o=r.get(t);if(o?.fingerprint===i)return o.value;const s=n();return r.set(t,{fingerprint:i,value:s}),s}(e.cfg,t.id,N,()=>Hs(t.rooms,_,g.contour,[...$.filter(e=>"partition"!==e.host?.kind).map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),...M],Na,m,Ea,Ra,y)):null,L=$.length&&_.length?function(e,t,i,n,r,o,s,a=1){return[r,o,s,a].every(Number.isFinite)&&o>0&&a>0&&i?.length?Zs(Bs(e,i,n,r,o,s,a),t):t.map(()=>null)}(t.rooms,$.map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),_,g.contour,Na,m,Ea,Ra):$.map(()=>null),q=$.length?Xu({openings:$,geometries:L,fillsByRoomId:x,idPrefix:`${t.id}-static-data`,groupClass:"opening-tunnels static-opening-tunnels",dataLayer:"data"}):G,j=$.length?Xu({openings:$,geometries:L,fillsByRoomId:C,idPrefix:`${t.id}-static-glow`,groupClass:"opening-tunnels glow-base-tunnels static-opening-tunnels",dataLayer:"glow-base"}):G,U=_.length&&H?.paperD?[{path:H.paperD}]:Xt(t.rooms),V=i.showBorders?H:null,K=e.stageWidth&&w[2]?e.stageWidth/w[2]:1,Y=_o(m),Z=!!V&&(po(V.depthUnits,K)||mo(Y,K)),X=i.color||"#607d8b",J=i.hideOpenings?[]:f.map(e=>{const t=e.opening,i="passage"!==t.type&&t.contact?a.states?.[t.contact]?.state:null,n=ii(t.type,i,!!t.invert),r=n>0&&!!t.contact,o="gate"===t.type?!t.flip_v:!!t.flip_v,s={type:t.type,length:e.length,angle:e.angle,amount:n,flipH:!!t.flip_h,flipV:!!t.flip_v,base:X,tone:r?"var(--hp-open)":X,cellCm:m,gridPitch:Ea,face:Od(e,o)};return W`<g class="opening static-opening" data-hp="opening"
      data-id=${t.id} data-kind=${t.type} pointer-events="none"
      transform="translate(${e.center[0]} ${e.center[1]}) rotate(${e.angle})">
      ${lu(s)}
    </g>`});return B`
    <div class="hp-static-stage${F?` daycycle phase-${F.phase}`:""}"
      ?inert=${!!e.inert}
      style="aspect-ratio:${w[2]}/${w[3]}${I?";background:"+I:""};--hp-cell-visual-scale:${ka(m)};--wall-fill:${n.wall_fill.c};--wall-fill-op:${n.wall_fill.a}${F?`;${hr(F)}`:""}">
      ${dr(F)}
      <svg viewBox="${w[0]} ${w[1]} ${w[2]} ${w[3]}" preserveAspectRatio="xMidYMid meet">
        ${V?W`<defs>
          <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
            width="${Y}" height="${Y}" patternTransform="rotate(45)">
            <path d="M0 0 L0 ${Y}" stroke="${X}"
              stroke-width="${Y/8*2}"></path>
          </pattern>
        </defs>`:G}
        <g class="hp-paperg">${U.map(e=>"path"in e?W`<path class="hp-paper" d="${e.path}" fill-rule="evenodd"></path>`:"poly"in e?W`<polygon class="hp-paper" points="${e.poly}"></polygon>`:W`<rect class="hp-paper" x="${e.rect.x}" y="${e.rect.y}" width="${e.rect.w}" height="${e.rect.h}" rx="${e.rect.rx}"></rect>`)}</g>
        ${z?W`<image href="${z}" x="${t.bg.x}" y="${t.bg.y}" width="${t.bg.w}" height="${t.bg.h}"
              @load=${()=>e.assetLoaded?.(t.bg.href,z)}
              transform=${t.bg.angle?`rotate(${t.bg.angle} ${t.bg.x+t.bg.w/2} ${t.bg.y+t.bg.h/2})`:G}
              preserveAspectRatio="none" />`:G}
        ${R}
        ${i.showBorders&&g.contour.length?W`<g class="room-outlines" aria-hidden="true" pointer-events="none">
              ${t.rooms.map(e=>{const t=Zt(e);if(!t)return G;const n=kn(t,g.contour,.02*Ea);return W`<path class="room-outline" fill="none" stroke=${i.color}
                  stroke-opacity=${i.opacity}
                  stroke-width=${xa(2.5,m)}
                  d=${n.map(e=>`M ${e[0]} ${e[1]} L ${e[2]} ${e[3]}`).join(" ")}></path>`})}
            </g>`:G}
        ${q}
        ${T.length?W`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${T}</g>`:G}
        ${j}
        ${V?W`<g class="wallbodies" style="--room-stroke:${X}">
              ${V.paths.map(e=>W`
                <path class="wallbody-fill" data-component=${e.id} d="${e.d}"
                  fill="${n.wall_fill.c}" fill-opacity="${n.wall_fill.a}"
                  fill-rule=${e.fillRule} stroke="none" pointer-events="none"></path>
                <path class="wallbody ${Z?"solid":""}"
                  data-hp="wall" data-id="union" data-kind="union" data-component=${e.id}
                  d="${e.d}" fill="${Z?"none":"url(#hp-wall-hatch)"}"
                  fill-rule=${e.fillRule} stroke="${X}"
                  stroke-width="${xa(.6,m)}" pointer-events="none"></path>`)}
            </g>`:G}
        ${i.showBorders&&g.lines.length?W`<g class="zero-walls ${g.style}"
              data-zero-wall-style=${g.style} aria-hidden="true" pointer-events="none">
              ${g.lines.map(e=>W`<line class="zero-wall"
                x1=${e[0]} y1=${e[1]} x2=${e[2]} y2=${e[3]}
                stroke=${X} stroke-width=${xa(2.5,m)}
                stroke-dasharray=${"dashed"===g.style?`${xa(7,m)} ${xa(7,m)}`:G}></line>`)}
            </g>`:G}
        ${J}
      </svg>
      ${""}
      <div class="devlayer" style="--icon-size:${tl(o,t,w[2]).toFixed(3)}cqw;--device-base-size:${tl(s,t,w[2]).toFixed(3)}cqw">${A}${O}</div>
    </div>
  `}let vp=null,yp=null,bp=0,wp=-1,kp=null,xp=[];const $p=new Set,Sp=(e,t)=>{"function"==typeof e&&t.push(e)};function Mp(){if(vp)return vp;try{const e=JSON.parse(localStorage.getItem("houseplan_card_cfg_v1")||"null");if(e&&e.config&&Array.isArray(e.config.spaces)){const t=e.layout||{};return{config:e.config,rev:e.rev||0,configFingerprint:e.config_fingerprint||Rl(e.config),layout:t,layoutRev:e.layout_rev||0,layoutFingerprint:e.layout_fingerprint||Rl(t),virtualLights:Cc(e.virtual_lights,e.rev||0)}}}catch{}return null}function Rp(e,t=!1){if(t&&(vp=null,bp++,yp))return yp.catch(()=>null).then(()=>Rp(e,!1));if(vp)return Promise.resolve(vp);if(yp)return wp!==bp?yp.catch(()=>null).then(()=>Rp(e,!1)):yp;return wp=bp,yp=async function(e,t){const[i,n]=await Promise.all([e.callWS({type:"houseplan/config/get"}),e.callWS({type:"houseplan/layout/get"})]),r=i?.rev??0,o=vp?Dc(vp.virtualLights,i?.virtual_lights,r,!!i&&"virtual_lights"in i):Cc(i?.virtual_lights,r),s={config:i?.config??null,rev:r,configFingerprint:Rl(i?.config??null),layout:n?.layout??{},layoutRev:n?.rev??0,layoutFingerprint:Rl(n?.layout??{}),virtualLights:o};t===bp&&(vp=s);const a=e.connection;if(a?.subscribeEvents&&kp!==a){for(const e of xp)e();xp=[],kp=a;const e=()=>{vp=null,bp++,$p.forEach(e=>e())},t=[];try{if(Sp(await a.subscribeEvents(e,"houseplan_config_updated"),t),Sp(await a.subscribeEvents(e,"houseplan_layout_updated"),t),Sp(await a.subscribeEvents(e=>{if(vp){const t=Fc(vp.virtualLights,e?.data);if(t===vp.virtualLights)return;vp={...vp,virtualLights:t}}else bp++;$p.forEach(e=>e())},"houseplan_virtual_light_updated"),t),kp===a)xp=t;else for(const e of t)e()}catch{for(const e of t)e();kp===a&&(kp=null)}}return s}(e,bp).finally(()=>{yp=null,wp=-1}),yp}const Tp=new WeakSet,Cp=new WeakSet;function Dp(e,t,i){const n=i?t.state(i):"ready";return i&&"pending"===n?(Cp.has(e)||(e.inert=!0,e.setAttribute("aria-busy","true"),Cp.add(e)),t.ensure(i).then(()=>{e.isConnected&&e.requestUpdate()}),Tp.has(e)?"warm":"cold"):(Cp.delete(e)&&(e.inert=!1,e.removeAttribute("aria-busy")),i&&(e.setAttribute("lang","fallback"===n?"en":i),Tp.add(e)),"ready")}function Ap(){return B`<ha-circular-progress active role="status" aria-busy="true"></ha-circular-progress>`}const Op=3300;function zp(e,t){return{sources:e,last:Object.fromEntries(t.map(e=>[e.eid,e.state])),flashTs:0,flashKind:null,timer:0,gen:0,expiresAt:0,alarmActive:"alarm"===Sc(t).status}}function Pp(e,t,i,n){n(e.timer);const r=zp(t,i);Object.assign(e,r)}function Fp(e,t,i,n,r){e.flashTs&&i-e.flashTs<Op&&"event"===e.flashKind&&"transition"===t||(e.flashTs=i,e.expiresAt=i+Op,e.flashKind=t,e.gen++,n(e.timer),e.timer=r(3360))}function Ip(e,t,i){"transition"===e.flashKind&&t.some(e=>"transition"===e.activity)&&(i(e.timer),e.flashTs=0,e.flashKind=null,e.expiresAt=0);if("alarm"===Sc(t).status){e.alarmActive||(i(e.timer),e.flashTs=0,e.flashKind=null,e.expiresAt=0);for(const i of t)e.last[i.eid]=i.state;return e.alarmActive=!0,null}if(e.alarmActive){for(const i of t)e.last[i.eid]=i.state;return e.alarmActive=!1,null}let n=null;for(const i of t){const t=Mc(e.last[i.eid],i);("event"===t||!n&&t)&&(n=t),e.last[i.eid]=i.state}return n}class Ep{constructor(e,t=()=>{}){this._host=e,this._onGateChange=t,this._modality="unknown",this._gate=!1,this._media=null,this._connected=!1,this._onMediaChange=()=>this._syncGate()}get modality(){return this._modality}get hoverEnabled(){return this._gate}connect(e=globalThis.window){this._connected||(this._connected=!0,this._modality="unknown",this._media="function"==typeof e?.matchMedia?e.matchMedia("(any-hover: hover) and (any-pointer: fine)"):null,this._media?.addEventListener?.("change",this._onMediaChange),this._setGate(!1))}disconnect(){this._media?.removeEventListener?.("change",this._onMediaChange),this._media=null,this._connected=!1,this._modality="unknown",this._setGate(!1)}note(e){return this._modality=function(e,t){const i="mouse"===(n=t.pointerType)||"touch"===n||"pen"===n?n:null;var n;return i?"mouse"===i&&t.sourceCapabilities?.firesTouchEvents?e:i:e}(this._modality,e),this._syncGate(),this._modality}suspend(){this._setGate(!1)}_syncGate(){var e,t;this._setGate((e=this._modality,t=!!this._media?.matches,"mouse"===e&&t))}_setGate(e){this._gate!==e&&(this._gate=e,this._host.toggleAttribute("data-pointer-hover",e),this._onGateChange(e))}}class Np extends he{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(e){this._config=e}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const e=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(e?.config?.spaces||[]).map(e=>({value:e.id,label:e.title||e.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return ru(this.hass,this._config?.language)}get _schema(){const e=this._spaces||[];return[e.length?{name:"space",selector:{select:{mode:"dropdown",options:e}}}:{name:"space",selector:{text:{}}},{name:"title",selector:{text:{}}},{name:"show_button",selector:{boolean:{}}},{name:"button_label",selector:{text:{}}},{name:"button_target",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}}]}render(){if(!this.hass||!this._config)return G;const e=Dp(this,Jd,ru(this.hass,this._config.language));if("cold"===e)return Ap();if("warm"===e)return U;this._loadSpaces();const t=this._lang,i={space:ou(t,"editor.space"),title:ou(t,"editor.title"),show_button:ou(t,"editor.show_button"),button_label:ou(t,"editor.button_label"),button_target:ou(t,"editor.button_target"),icon_size:ou(t,"editor.icon_size"),show_temperature:ou(t,"editor.show_temperature"),live_states:ou(t,"editor.live_states"),show_signal:ou(t,"editor.show_signal")};return B`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${e=>i[e.name]||e.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(e){const t={...this._config||{},...e.detail.value};delete t.aspect_ratio;const i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:t},this.dispatchEvent(i)}}Np.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-space-card-editor")||customElements.define("houseplan-space-card-editor",Np);const Hp=e=>{history.pushState(null,"",e),((e,t,i)=>{const n=new Event(t,{bubbles:!0,composed:!0});n.detail=i??{},e.dispatchEvent(n)})(window,"location-changed",{replace:!1})};class Lp extends he{constructor(){super(...arguments),this._snap=null,this._loading=!1,this._reloadQueued=!1,this._forceReloadQueued=!1,this._reloadRetryTimer=0,this._dayCycleTimer=0,this._dayCycleClockKey="",this._stageWidth=0,this._pendingStageWidth=0,this._stageWidthRaf=0,this._haRegistryConnection=null,this._haRegistryRevision=-1,this._devices=[],this._continuity=this._newContinuityController(),this._continuityHistory=[],this._continuityEpoch=0,this._continuityDataReady=!0,this._continuityPaintToken=-1,this._continuityDisposed=!1,this._renderSnapshotAt=Date.now(),this._hassSequence=0,this._connHooked=null,this._connectionWasLost=!1,this._visibleDeviceSnapshot=null,this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1,this._capturedSnapshotSequence=-1,this._capturedSnapshotDevices=null,this._capturedSnapshotActivity="",this._capturedSnapshotVirtual="",this._activityRuntime=new Map,this._reducedMotion=!1,this._pointerModality=new Ep(this),this._onMotionChange=e=>{this._reducedMotion=e.matches,this._capturedSnapshotSequence=-1,this.requestUpdate()},this._onHaRegistryUpdate=()=>{const e=Vc(this.hass).revision;e!==this._haRegistryRevision&&(this._haRegistryRevision=e,this._refreshDevices(),this._capturedSnapshotSequence=-1,this.requestUpdate())},this._dayCycleTick=()=>{if(!this.isConnected||"hidden"===this.ownerDocument.visibilityState)return;const e=this._dayCycleState();if(!e)return this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),void(this._dayCycleClockKey="");const t=Zn(e);t!==this._dayCycleClockKey&&(this._dayCycleClockKey=t,this.requestUpdate())},this._pageVisibility=e=>{if(this._continuity.visibility(e),this._dayCycleVisibility(e),"hidden"!==e.kind){if(!e.long){const e=Date.now();let t=!1;for(const i of this._activityRuntime.values())!i.flashKind||(i.expiresAt||i.flashTs+3300)>e||(i.flashTs=0,i.flashKind=null,i.expiresAt=0,t=!0);return void(t&&(this._capturedSnapshotSequence=-1,this.requestUpdate()))}Date.now()-this._renderSnapshotAt>1e3&&this._continuity.note("device-snapshot-stale"),this._continuityDataReady=!1,this._continuityPaintToken=-1,this._load(!0)}else this._pointerModality.suspend()},this._onConnLost=()=>{this._connectionWasLost=!0,this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.connectionLost()},this._onConnReady=()=>{!this._connectionWasLost&&this._continuity.hasCompleteFrame?this._beginContinuityCandidate("connection-ready",!1,"plan"):(this._continuityDataReady=!1,this._continuityPaintToken=-1),this._load(!0)},this._onAssetLoaded=(e,t)=>{this._signer.markLoaded(this.hass,e,t),this._continuity.note("asset-ready"),this._continuityPaintToken=-1,"steady"!==this._continuity.state&&this.requestUpdate()},this._loadedOnce=!1,this._signer=new Dl(()=>this.requestUpdate()),this._retryContinuity=()=>{this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.retry(this._continuity.recoveryReason||"plan"),this._load(!0)},this._goToSpace=()=>{const e=(this._config?.button_target||"/plan-doma").replace(/#.*$/,"");Hp(`${e}#space=${encodeURIComponent(this._config.space)}`)}}_ensureHaRegistryAuthority(){const e=this.hass?.connection||null;e&&e!==this._haRegistryConnection&&(this._haRegistryRelease?.(),this._haRegistryConnection=e,this._haRegistryRevision=-1,this._haRegistryRelease=Gc(this.hass,this._onHaRegistryUpdate),this._onHaRegistryUpdate())}_newContinuityController(){return new Ml(()=>{this._continuityEpoch++,this.isConnected&&this.requestUpdate()})}_dayCycleState(e=new Date){const t=this._snap?.config;if(!t||!this._config)return null;const i=t.spaces?.find(e=>e.id===this._config?.space)?.settings||{};return"daynight"!==sr(t.settings,i)?null:Yn(this._renderDeviceSnapshot?.hass||this.hass,e)}_syncDayCycleClock(){const e=this._dayCycleState();this._dayCycleClockKey=e?Zn(e):"";const t="clock"===e?.source&&"hidden"!==this.ownerDocument.visibilityState&&this.isConnected;t&&!this._dayCycleTimer?this._dayCycleTimer=window.setInterval(this._dayCycleTick,3e4):!t&&this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_dayCycleVisibility(e){"hidden"!==e.kind?(this._dayCycleTick(),this._syncDayCycleClock()):this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_hookConnection(){const e=this.hass?.connection;e&&e!==this._connHooked&&(this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),e.addEventListener?.("ready",this._onConnReady),e.addEventListener?.("disconnected",this._onConnLost),e.addEventListener?.("reconnect-error",this._onConnLost),this._connHooked=e)}static getConfigElement(){return document.createElement("houseplan-space-card-editor")}static getStubConfig(e){const t=Mp();return{type:"custom:houseplan-space-card",space:za(t?.config||null)[0]?.id||"",show_button:!0,live_states:!0,show_temperature:!0,show_signal:!0}}setConfig(e){if(!e||!e.space)throw new Error('houseplan-space-card: "space" is required');this._config={show_button:!0,button_target:"/plan-doma",live_states:!0,show_temperature:!0,show_signal:!0,...e},this._snap=this._snap||Mp()}connectedCallback(){var e;this._continuityDisposed&&(this._continuity=this._newContinuityController(),this._continuityDisposed=!1,this._continuityPaintToken=-1),super.connectedCallback(),this._pointerModality.connect(this.ownerDocument.defaultView),this._motionMedia=window.matchMedia?.("(prefers-reduced-motion: reduce)"),this._reducedMotion=!!this._motionMedia?.matches,this._motionMedia?.addEventListener?.("change",this._onMotionChange),this.hass&&this._ensureHaRegistryAuthority(),this._continuityUnsub?.(),this._continuityUnsub=$l(this.ownerDocument,this._pageVisibility),this._unsub=(e=()=>{this._beginContinuityCandidate("config-event",!1),this._reloadQueued=!0,this._load()},$p.add(e),()=>$p.delete(e)),this._signer.start(()=>this.hass,()=>this._referenced())}disconnectedCallback(){this._pointerModality.disconnect(),this._continuityUnsub?.(),this._continuityUnsub=void 0,this._motionMedia?.removeEventListener?.("change",this._onMotionChange),this._motionMedia=void 0,this._unsub?.(),this._unsub=void 0,window.clearTimeout(this._reloadRetryTimer),this._reloadRetryTimer=0,this._dayCycleTimer&&(window.clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),this._dayCycleClockKey="",this._stageObserver?.disconnect(),this._stageObserver=void 0,this._observedStage=void 0,this._stageWidthRaf&&cancelAnimationFrame(this._stageWidthRaf),this._stageWidthRaf=0,this._pendingStageWidth=0,this._signer.dispose(),this._haRegistryRelease?.(),this._haRegistryRelease=void 0,this._haRegistryConnection=null,this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),this._connHooked=null;for(const e of this._activityRuntime.values())window.clearTimeout(e.timer);this._activityRuntime.clear(),this._continuityHistory=[...this._continuityHistory,...this._continuity.trace].slice(-80),this._continuity.dispose(),this._continuityDisposed=!0,super.disconnectedCallback()}willUpdate(e){e.has("hass")&&this.hass&&(this._hassSequence++,this._renderSnapshotAt=Date.now(),this._continuity.note("hass-snapshot"),this._ensureHaRegistryAuthority(),this._hookConnection()),!this.hass||this._loading||this._snap&&!e.has("hass")||this._snap&&this._loadedOnce||this._load(),(e.has("hass")||e.has("_snap")||e.has("_config")||!this._devices.length)&&this._refreshDevices(),this._captureRenderDeviceSnapshot(),this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._continuity.refreshCompleteFrame(this._frameFingerprint())}_stampActivity(e,t){Fp(e,t,Date.now(),window.clearTimeout.bind(window),e=>window.setTimeout(()=>this.requestUpdate(),e))}_syncActivity(e,t,i=this.hass){if(!1===this._config?.live_states){for(const e of this._activityRuntime.values())window.clearTimeout(e.timer);return void this._activityRuntime.clear()}const n=new Set,r=Mh(t,e,null,this._snap?.virtualLights);for(const o of e){if(o.hidden)continue;if("icon_ripple"!==Ai(o.marker?.display))continue;n.add(o.id);const s=Iu(t,o,e,r,i),a=s.samples,l=Hu(t,o,s);let c=this._activityRuntime.get(o.id);if(!c||c.sources!==l){c&&window.clearTimeout(c.timer),c=zp(l,a),this._activityRuntime.set(o.id,c);continue}const h=Ip(c,a,window.clearTimeout.bind(window));h&&this._stampActivity(c,h)}for(const[e,t]of this._activityRuntime)n.has(e)||(window.clearTimeout(t.timer),this._activityRuntime.delete(e))}_refreshDevices(){if(!this.hass||!this._snap?.config||!this._config)return;const e=Vc(this.hass),t=gp({hass:this.hass,registry:e,cfg:this._snap.config,lang:this._lang});this._syncActivity(t,Xc(this.hass,e),this.hass),this._devices=t}_captureRenderDeviceSnapshot(){if(!this.hass)return;const e=Date.now(),t=[...this._activityRuntime.entries()].map(([t,i])=>`${t}:${i.gen}:${i.flashTs}:`+(i.flashKind&&(i.expiresAt||i.flashTs+3300)>e?1:0)).join("|"),i=this._snap?.virtualLights?`${this._snap.virtualLights.configRev}:${this._snap.virtualLights.rev}`:"";if(this._capturedSnapshotSequence===this._hassSequence&&this._capturedSnapshotDevices===this._devices&&this._capturedSnapshotActivity===t&&this._capturedSnapshotVirtual===i)return;const n=Xc(this.hass,Vc(this.hass)),r=new Map,o=new Set(["sun.sun"]),s=new Set,a=new Set,l=e=>{if(!e)return;const t=e.indexOf(":");if(t<0)return void o.add(e);const i=e.slice(0,t),n=e.slice(t+1);"device"===i?s.add(n):"entity"===i&&o.add(n)},c=za(this._snap?.config||null).find(e=>e.id===this._config?.space);for(const e of c?.rooms||[])e.area&&a.add(e.area),l(e.settings?.temp_source),l(e.settings?.hum_source);const h=this._snap?.config?.spaces?.find(e=>e.id===this._config?.space);for(const e of h?.openings||[])for(const t of ni(e))o.add(t);const d=Mh(n,this._devices,null,this._snap?.virtualLights);for(const e of this._devices)for(const t of[!1,!0])r.set(Uu(e.id,t),qu(n,e,{liveStates:!1!==this._config?.live_states,showTemperature:!1!==this._config?.show_temperature,showSignal:t,activityRuntime:this._activityRuntime.get(e.id),sourceDetails:!1,lightDevices:this._devices,lightSources:d,registryHass:this.hass,reducedMotion:this._reducedMotion}));const u=Wu({sourceSequence:this._hassSequence,hass:n,devices:this._devices,presentations:r,entityIds:o,deviceIds:s,areaIds:a});this._capturedSnapshotSequence=this._hassSequence,this._capturedSnapshotDevices=this._devices,this._capturedSnapshotActivity=t,this._capturedSnapshotVirtual=i,this._visibleDeviceSnapshot&&"steady"!==this._continuity.state?this._candidateDeviceSnapshot=u:(this._visibleDeviceSnapshot=u,this._candidateDeviceSnapshot=null)}get _renderDeviceSnapshot(){return this._stagedDeviceSnapshotToken===this._continuity.token?this._candidateDeviceSnapshot||this._visibleDeviceSnapshot:this._visibleDeviceSnapshot||this._candidateDeviceSnapshot}_beginContinuityCandidate(e,t,i="plan"){return this._continuityDataReady=t,this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._continuity.beginCandidate(e,i)}_backdropRaw(){return this._snap?.config&&this._config&&za(this._snap.config).find(e=>e.id===this._config.space)?.bg?.href||""}_candidateBackdrop(e){return e&&this._config&&za(e).find(e=>e.id===this._config.space)?.bg?.href||""}_assetsReady(){const e=this._backdropRaw();return!e||this._signer.isReady(this.hass,e)}_frameFingerprint(){const e=this._snap;return Tl([e?.rev||0,e?.configFingerprint||Rl(e?.config),e?.layoutRev||0,e?.layoutFingerprint||Rl(e?.layout),e?.virtualLights?`${e.virtualLights.configRev}:${e.virtualLights.rev}`:"",this._config?.space||"",this._stageWidth,this.hass?.themes?.darkMode??this.hass?.themes?.default_theme??""])}_stageValid(){const e=this._observedStage;return!!e&&e.clientWidth>0&&e.clientHeight>0}_settleContinuityFrame(){if(!this._stageValid())return;if(!this._continuity.hasCompleteFrame&&"steady"===this._continuity.state){if(this._assetsReady())return this._renderSnapshotAt=Date.now(),void this._continuity.markCompleteFrame(this._frameFingerprint());this._beginContinuityCandidate("asset-wait",!0,"asset")}if(!this._continuityDataReady)return;if(!["holding","offline-stale","overlay-pending","overlay-visible","candidate-ready"].includes(this._continuity.state))return;const e=this._continuity.token;if(this._candidateDeviceSnapshot&&this._candidateDeviceSnapshot!==this._visibleDeviceSnapshot&&this._stagedDeviceSnapshotToken!==e)return this._stagedDeviceSnapshotToken=e,void this.requestUpdate();this._continuityPaintToken!==e&&(this._continuityPaintToken=e,this._continuity.candidateReady(e)&&this._continuity.commitAfterPaint(e,{updateComplete:()=>this.updateComplete,stageValid:()=>this.isConnected&&this._stageValid(),assetsReady:()=>this._assetsReady(),frameFingerprint:()=>this._frameFingerprint()}).then(t=>{t&&e===this._continuity.token?(this._renderSnapshotAt=Date.now(),this._candidateDeviceSnapshot&&(this._visibleDeviceSnapshot=this._candidateDeviceSnapshot),this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1):e===this._continuity.token&&(this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._candidateDeviceSnapshot=null,this.requestUpdate())}))}updated(){const e=this.renderRoot.querySelector(".hp-static-stage")||void 0;if(e!==this._observedStage)if(this._stageObserver?.disconnect(),this._observedStage=e,e){const t=()=>{const i=e.clientWidth;if(!(i<=0||Math.abs(i-this._stageWidth)<=.5)){if(this._stageWidth<=0)return this._stageWidth=i,void this.requestUpdate();this._pendingStageWidth=i,this._stageWidthRaf||(this._stageWidthRaf=requestAnimationFrame(()=>{this._stageWidthRaf=0;const e=this._pendingStageWidth;this._pendingStageWidth=0,!e||!this._observedStage||this._observedStage.clientWidth<=0||(Math.abs(this._observedStage.clientWidth-e)>.5?t():Math.abs(e-this._stageWidth)<=.5||(this._continuity.hasCompleteFrame&&this._beginContinuityCandidate("stage-resize",!0,"stage-size"),this._stageWidth=e,this.requestUpdate()))}))}};this._stageObserver=new ResizeObserver(t),this._stageObserver.observe(e),t()}else this._stageObserver=void 0;this._syncDayCycleClock(),this._settleContinuityFrame()}async _load(e=!1){if(this.hass){if(this._loading)return this._reloadQueued=!0,void(this._forceReloadQueued||=e);this._loading=!0,this._reloadQueued=!1;try{const t=await Rp(this.hass,e),i=!this._snap||this._snap.configFingerprint!==t.configFingerprint,n=!this._snap||this._snap.layoutFingerprint!==t.layoutFingerprint,r=!this._snap||this._snap.virtualLights!==t.virtualLights;if(i&&!await this._signer.prepareImage(this.hass,this._candidateBackdrop(t.config)))return this._continuity.note("asset-failed"),window.clearTimeout(this._reloadRetryTimer),void(this._reloadRetryTimer=window.setTimeout(()=>{this._load(!0)},1e3));window.clearTimeout(this._reloadRetryTimer),this._reloadRetryTimer=0,(i||n)&&this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._beginContinuityCandidate("structural-response",!0),i||n||r?this._snap=t:this._snap&&(this._snap.rev=t.rev,this._snap.layoutRev=t.layoutRev),i&&this._continuity.note("config-candidate",{configRev:t.rev}),n&&this._continuity.note("layout-candidate",{layoutRev:t.layoutRev}),r&&(this._capturedSnapshotSequence=-1),this._loadedOnce=!0,this._connectionWasLost=!1,this._continuityDataReady=!0,this._refreshDevices()}catch{}finally{if(this._loading=!1,this._continuityDataReady=!0,this.requestUpdate(),this._reloadQueued){const e=this._forceReloadQueued;this._reloadQueued=!1,this._forceReloadQueued=!1,this._load(e)}}}}get _lang(){return ru(this.hass,this._config?.language)}getCardSize(){const e=za(this._snap?.config||null).find(e=>e.id===this._config?.space);if(e){const t=e.vb[3]/e.vb[2];return Math.max(3,Math.round(8*t))+(!1===this._config?.show_button?0:1)}return 6}_errorCard(e){return B`<ha-card
      data-continuity-state=${this._continuity.state}
      data-continuity-token=${this._continuity.token}
      data-frame-fingerprint=${this._continuity.frameFingerprint||G}
      data-recovery-reason=${(this._continuity.overlayVisible||"recovery-error"===this._continuity.state)&&this._continuity.recoveryReason||G}>
        <div class="hp-static-error">${e}</div>
      </ha-card>`}_referenced(){return Sn(this._snap?.config)}_renderRecoveryOverlay(){if(!this._continuity.overlayVisible&&"recovery-error"!==this._continuity.state)return G;const e="connection"===this._continuity.recoveryReason;return B`<div class="recoveryoverlay phase-${this._continuity.overlayPhase}"
      role="status" aria-live="polite" aria-atomic="true">
        <ha-icon icon="mdi:home-sync-outline"></ha-icon>
        <span>${ou(this._lang,e?"continuity.restore_connection":"continuity.restore_plan")}</span>
        ${"recovery-error"===this._continuity.state?B`<button class="btn on" @click=${this._retryContinuity}>${ou(this._lang,"continuity.retry")}</button>`:G}
      </div>`}houseplanContinuityTrace(){return[...this._continuityHistory,...this._continuity.trace].slice(-80).map(e=>({...e,...e.stage?{stage:[...e.stage]}:{}}))}render(){if(!this._config||!this.hass)return G;const e=Dp(this,Jd,ru(this.hass,this._config.language));if("cold"===e)return Ap();if("warm"===e)return U;const t=this._snap?.config;if(!t)return this._errorCard(ou(this._lang,"space_card.loading"));const i=this._config.space,n=this._renderDeviceSnapshot,r=fp({hass:n?.hass||this.hass,cfg:t,layout:this._snap?.layout||{},spaceId:i,iconSize:this._config.icon_size,stageWidth:this._stageWidth,lang:this._lang,displayUrl:e=>this._signer.display(this.hass,e),assetLoaded:this._onAssetLoaded,registry:n?{revision:n.sourceSequence,authoritative:!1,access:"limited",entities:{...n.hass.entities},devices:{...n.hass.devices},lastSuccess:n.capturedAt}:Vc(this.hass),devices:[...n?.devices||this._devices],presentations:n?.presentations,activityRuntime:this._activityRuntime,reducedMotion:this._reducedMotion,virtualLights:this._snap?.virtualLights,liveStates:!1!==this._config.live_states,showTemperature:!1!==this._config.show_temperature,showSignal:!1!==this._config.show_signal,inert:this._continuity.overlayBlocksInteraction});if(!r)return this._errorCard(ou(this._lang,"space_card.not_found",{id:i}));const o=za(t).find(e=>e.id===i),s=void 0!==this._config.title?this._config.title:o?.title||"",a=!1!==this._config.show_button,l=this._config.button_label||ou(this._lang,"space_card.button"),c=this._continuity.overlayVisible||"recovery-error"===this._continuity.state?this._continuity.recoveryReason:null;return B`
      <ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint||G}
        data-device-snapshot-sequence=${n?.sourceSequence??G}
        data-recovery-reason=${c||G}
        @pointerover=${e=>this._pointerModality.note(e)}
        @pointerdown=${e=>this._pointerModality.note(e)}
        @pointermove=${e=>this._pointerModality.note(e)}>
        ${s?B`<div class="hp-static-title">${s}</div>`:G}
        <div class="hp-static-body">
          ${r}
          ${this._renderRecoveryOverlay()}
        </div>
        ${a?B`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${l}</button>
            </div>`:G}
      </ha-card>
    `}}Lp.properties={hass:{attribute:!1},_config:{state:!0},_snap:{state:!0},_continuityEpoch:{state:!0}},Lp.styles=[Bd,o`
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
    `],customElements.get("houseplan-space-card")||customElements.define("houseplan-space-card",Lp),window.customCards=window.customCards||[],window.customCards.find(e=>"houseplan-space-card"===e.type)||window.customCards.push({type:"houseplan-space-card",name:"House Plan — Space (static)",description:"Read-only live schematic of a single houseplan space, with a deep-link button.",preview:!1,documentation:"https://github.com/Matysh/houseplan-card"});const qp=o`
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
`;function jp(e){return e instanceof Error?e.name||"Error":typeof e}function Bp(e){return Rl({id:e?.id??"",cell_cm:e?.cell_cm,rooms:e?.rooms||[],walls:e?.walls||[],wall_segments:e?.wall_segments||[],open_spans:e?.open_spans||[],openings:e?.openings||[],partitions:e?.partitions||[],room_drafts:e?.room_drafts||[],wall_columns:e?.wall_columns||[]})}function Wp(e,t,i={}){const n=(Array.isArray(e?.spaces)?e.spaces:[]).find(e=>String(e?.id||"")===String(t||"")),r=Bp(n);if(!n)return{spaceId:String(t||""),displayName:"",status:"failed",reason:"prepare-exception",fingerprint:r,ok:!1};const o=Zp({...e,spaces:[n]},{...i,fingerprint:()=>r}).spaces[0]||{spaceId:String(t||""),displayName:"",status:"failed",reason:"prepare-exception"};return{...o,fingerprint:r,ok:"failed"!==o.status}}function Up(e,t,i,n=Ea,r=1e3){return(Array.isArray(e?.openings)?e.openings:[]).flatMap(e=>{const o={...e,rx:Number(e.x)*r,ry:Number(e.y)*r,rlen:Number(e.length)*r};if(!e.host||"wall"===e.host.kind)return[o];const s=Td(e,t.partitions,r,i,n);return s.resolved?[{...e,rx:s.resolved.center[0],ry:s.resolved.center[1],rlen:s.resolved.length,angle:s.resolved.angle,partitionHost:s.resolved}]:[]})}function Gp(e,t=()=>!0){return e.flatMap(e=>e.host&&e.partitionHost&&t(e)?[Ad(e.partitionHost)]:[])}function Vp(e,t,i,n,r,o,s=Ea,a=1e3){const l=gs(t.rooms,[...i],n,r,o,s,a);return e.flatMap(e=>{const t={x:e.rx,y:e.ry,angle:Number(e.angle)||0,length:e.rlen};return e.host&&"wall"!==e.host.kind?e.partitionHost&&Pd(e.partitionHost,l,2e-4*s)?[t]:[]:[t]})}function Kp(e,t){const i=Na,n=Ea,r=Ra,o=Number.isFinite(Number(t.cellCm))&&Number(t.cellCm)>0?Number(t.cellCm):5,s=Array.isArray(e?.walls)?e.walls:[],a=function(e,t,i=Ea,n=1e3){return ip(t.rooms,e?.open_spans,n,.02*i)}(e,t,n,r),l=function(e,t,i=Ea){if(!t.length)return[];const n=e.filter(e=>e?.id),r=.02*i,o=[];for(let e=0;e<n.length;e++)for(let i=e+1;i<n.length;i++){const s=n[e],a=n[i],l=Zt(s),c=Zt(a);if(!l||!c)continue;const h=bn(l,c,r);if(!h.length)continue;const d=t.filter(e=>{const t=[(e[0]+e[2])/2,(e[1]+e[3])/2];return h.some(e=>Pn(t,e)<4*r)}).map(e=>[...e]);d.length&&o.push({a:s,b:a,segs:d})}return o}(t.rooms,a,n).flatMap(e=>e.segs),c=Up(e,t,o,n,r),h=Gp(c),d=ca(t,o,n,2e-4*n,h).all;return{space:t,walls:s,openCuts:l,openings:c,roomOpenings:Vp(c,t,s,l,i,o,n,r),partitionCuts:h,physicalBodies:d,wallKeyPitch:i,cellCm:o,gridPitch:n,coordScale:r}}function Yp(e,t,i){const n="string"==typeof e?.title?e.title.trim():"",r=null==e?.id?"":String(e.id).trim();return{spaceId:r,displayName:n||r||i(t+1)}}function Zp(e,t={}){const i=(t.fingerprint||Rl)(e),n=Array.isArray(e?.spaces)?e.spaces:[],r=t.fallbackSpaceName||(e=>`Space ${e}`),o=t.prepareSpace||Kp,s=t.wallPass||Ns,a=t.floorPass||Ps,l=[];for(let i=0;i<n.length;i++){const c=n[i],h=Yp(c,i,r);let d;try{const t=za({...e,spaces:[c]})[0];if(!t)throw new Error("missing space model");d=o(c,t)}catch(e){l.push({...h,status:"failed",reason:"prepare-exception",detail:jp(e)});continue}const u=d.walls.length>0||d.physicalBodies.length>0;if(!d.space.rooms.length&&!u){l.push({...h,status:"not-applicable"});continue}let p=null;if(u){try{p=s(d.space.rooms,d.walls,d.openCuts,d.roomOpenings,d.wallKeyPitch,d.cellCm,d.gridPitch,d.coordScale,d.physicalBodies)}catch(e){l.push({...h,status:"failed",reason:"wall-exception",detail:jp(e)});continue}if(null==p){l.push({...h,status:"failed",reason:"wall-null"});continue}if("degraded-extra"===p.status){l.push({...h,status:"failed",reason:"wall-degraded-extra"});continue}if("failed-core"===p.status){l.push({...h,status:"failed",reason:"wall-failed-core"});continue}t.captureWallGeometry?.(d,p)}if(d.space.rooms.length&&null==p?.paperGeom){let e;try{e=a(d.space.rooms,d.walls,d.openCuts,d.wallKeyPitch,d.cellCm,d.gridPitch,d.coordScale)}catch(e){l.push({...h,status:"failed",reason:"floor-exception",detail:jp(e)});continue}if(null==e){l.push({...h,status:"failed",reason:"floor-null"});continue}}l.push({...h,status:"ok"})}const c=l.filter(e=>"failed"===e.status);return{fingerprint:i,spaces:l,failures:c,ok:0===c.length}}function Xp(e,t){return e.catch(()=>{}).then(t)}class Jp{constructor(e=50){this._undo=[],this._redo=[],this._limit=Math.max(30,Math.floor(e))}get canUndo(){return this._undo.length>0}get canRedo(){return this._redo.length>0}get undoName(){return this._undo[this._undo.length-1]?.name??null}get redoName(){return this._redo[this._redo.length-1]?.name??null}get size(){return this._undo.length}push(e){this._undo.push(e),this._undo.length>this._limit&&this._undo.splice(0,this._undo.length-this._limit),this._redo=[]}undo(){const e=this._undo.pop()??null;return e&&this._redo.push(e),e}redo(){const e=this._redo.pop()??null;return e&&this._undo.push(e),e}clear(){this._undo=[],this._redo=[]}}const Qp=new WeakMap;const e_=(e,t,i)=>255===e[i+3]&&t.every((t,n)=>Math.abs(e[i+n]-t)<=2);async function t_(e){const t=e.defaultView;if(!t||!t.CSS?.supports?.("mix-blend-mode","screen"))return!1;const i=[128,32,16],n=[16,64,128],r=[9,19,29],o=`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="1" viewBox="0 0 4 1">\n    <rect width="4" height="1" fill="rgb(${r.join(",")})"/>\n    <g style="isolation:isolate">\n      <rect x="0" width="2" height="1" fill="rgb(${i.join(",")})"/>\n      <rect x="1" width="2" height="1" fill="rgb(${n.join(",")})" style="mix-blend-mode:screen"/>\n    </g>\n  </svg>`,s=t.URL.createObjectURL(new Blob([o],{type:"image/svg+xml"}));try{const o=await new Promise((e,i)=>{const n=new t.Image,r=t.setTimeout(()=>i(new Error("SVG blend probe timeout")),1e3);n.onload=()=>{t.clearTimeout(r),e(n)},n.onerror=()=>{t.clearTimeout(r),i(new Error("SVG blend probe failed"))},n.src=s}),a=e.createElement("canvas");a.width=4,a.height=1;const l=a.getContext("2d",{willReadFrequently:!0});if(!l)return!1;l.drawImage(o,0,0,4,1);const c=l.getImageData(0,0,4,1).data;return e_(c,i,0)&&e_(c,function(e,t){return[0,1,2].map(i=>Math.round(255-(255-e[i])*(255-t[i])/255))}(i,n),4)&&e_(c,n,8)&&e_(c,r,12)}catch{return!1}finally{t.URL.revokeObjectURL(s)}}const i_={now:()=>performance.now(),requestFrame:e=>requestAnimationFrame(e),cancelFrame:e=>cancelAnimationFrame(e)},n_=e=>Math.max(0,Math.min(1,e)),r_=(e,t,i)=>e+(t-e)*i,o_=(e,t,i)=>{const n=1-e;return 3*n*n*e*t+3*n*e*e*i+e*e*e};function s_(e,t){return{centerX:e.x+e.w/2,centerY:e.y+e.h/2,pixelsPerUnit:t>0&&e.w>0?t/e.w:1,viewBox:{...e}}}function a_(e,t,i){const n=Math.max(1e-9,e.pixelsPerUnit),r=Math.max(1e-9,t/n),o=Math.max(1e-9,i/n);return{x:e.centerX-r/2,y:e.centerY-o/2,w:r,h:o}}function l_(e){const t=e.trim(),i=/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(t);if(i)return[Number(i[1]),Number(i[2]),Number(i[3]),null==i[4]?1:Number(i[4])];const n=/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(t)?.[1];return n?[parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16),8===n.length?parseInt(n.slice(6,8),16)/255:1]:null}function c_(e,t,i){const n=l_(e),r=l_(t);if(!n||!r)return i<.5?e:t;const o=n_(i);return`rgba(${Math.round(r_(n[0],r[0],o))}, ${Math.round(r_(n[1],r[1],o))}, ${Math.round(r_(n[2],r[2],o))}, ${r_(n[3],r[3],o).toFixed(3)})`}function h_(e,t,i){const n=(e=>{const t=n_(e);if(0===t||1===t)return t;let i=0,n=1,r=t;for(let e=0;e<12;e++)r=(i+n)/2,o_(r,.2,.2)<t?i=r:n=r;return o_(r,.7,1)})(i),r=r_(e.stageWidth,t.stageWidth,n),o=r_(e.stageHeight,t.stageHeight,n),s=Math.max(1e-9,e.viewport.pixelsPerUnit),a=Math.max(1e-9,t.viewport.pixelsPerUnit),l={centerX:r_(e.viewport.centerX,t.viewport.centerX,n),centerY:r_(e.viewport.centerY,t.viewport.centerY,n),pixelsPerUnit:Math.exp(r_(Math.log(s),Math.log(a),n))};return{presentedMode:n<.5?e.presentedMode:t.presentedMode,editorChromeHeight:r_(e.editorChromeHeight,t.editorChromeHeight,n),stageWidth:r,stageHeight:o,viewport:{...l,viewBox:a_(l,r,o)},stageColor:c_(e.stageColor,t.stageColor,n),paperColor:c_(e.paperColor,t.paperColor,n),sceneBrightness:r_(e.sceneBrightness,t.sceneBrightness,n),architectureOpacity:r_(e.architectureOpacity,t.architectureOpacity,n),backdropOpacity:r_(e.backdropOpacity,t.backdropOpacity,n),viewWeight:r_(e.viewWeight,t.viewWeight,n),editorWeight:r_(e.editorWeight,t.editorWeight,n),toolbarContentOpacity:r_(e.toolbarContentOpacity,t.toolbarContentOpacity,n)}}class d_{constructor(e,t=i_){this._hooks=e,this._clock=t,this._token=0,this._raf=0,this._state=null}get state(){return this._state}get active(){return"running"===this._state?.phase||"preparing"===this._state?.phase}get presented(){return this._state?.presented||null}start(e,t,i,n=220){this.cancel(!1);const r=++this._token,o=this._clock.now();if(this._state={token:r,phase:n<=0?"settling":"running",from:e,to:t,presented:n<=0?t:e,startedAt:o,duration:Math.max(0,n),targetMode:i},n<=0)return this._hooks.frame(this._state),this._hooks.settled(this._state),this._state=null,r;this._hooks.frame(this._state);const s=e=>{const t=this._state;if(!t||t.token!==r)return;const i=n_((e-t.startedAt)/t.duration);t.presented=i>=1?t.to:h_(t.from,t.to,i),t.phase=i>=1?"settling":"running",this._hooks.frame(t),i<1?this._raf=this._clock.requestFrame(s):(this._raf=0,this._hooks.settled(t),this._state?.token===r&&(this._state=null))};return this._raf=this._clock.requestFrame(s),r}cancel(e=!0){this._raf&&this._clock.cancelFrame(this._raf),this._raf=0;const t=this._state;this._state=null,this._token++,t&&e&&(t.phase="settling",t.presented=t.to,this._hooks.frame(t),this._hooks.settled(t))}dispose(){this.cancel(!1)}}class u_{constructor(e){this.options=e,this._state="idle",this._inFlight=null}get state(){return this._state}ensure(){return"ready"===this._state?Promise.resolve(!0):"failed"===this._state?Promise.resolve(!1):(this._inFlight||(this._setState("loading"),this._inFlight=this._loadWithRetry().finally(()=>{this._inFlight=null})),this._inFlight)}async _loadWithRetry(){let e=new Error("Editor runtime did not load");for(const t of[0,1])try{const e=await this.options.load(t);if(e.fingerprint!==this.options.expectedFingerprint)throw new Error(`Editor runtime fingerprint mismatch: expected ${this.options.expectedFingerprint}, got ${e.fingerprint}`);const i=e.create();return this.options.install(i),this._setState("ready"),!0}catch(t){e=t}return this._setState("failed"),this.options.failed?.(e),!1}_setState(e){e!==this._state&&(this._state=e,this.options.stateChanged?.(e))}}const p_="houseplan_card_labs_v1",__=Object.freeze([Object.freeze({id:"iso",issue:89,since:"1.62.0",expires:"1.65.0",summary:"Volumetric plan renderer"})]);function m_(e){const t=/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(String(e||"").trim());if(!t)return null;const i=t.slice(1).map(Number);return i.every(e=>Number.isSafeInteger(e))?i:null}function g_(e,t){for(let i=0;i<3;i++)if(e[i]!==t[i])return e[i]<t[i]?-1:1;return 0}function f_(e){if(!/^[a-z][a-z0-9-]*$/.test(e.id)||!Number.isInteger(e.issue)||e.issue<=0||!e.summary.trim())return!1;const t=m_(e.since),i=m_(e.expires);return!!t&&!!i&&g_(t,i)<0}function v_(e){const t=new Set;for(const i of e){if(!f_(i)||t.has(i.id))return!1;t.add(i.id)}return!0}function y_(e){const t=String(e||"").replace(/^#/,"");return new URLSearchParams(t)}function b_(e){return y_(e).get("space")||""}function w_(e){return e.getAll("hp-labs").flatMap(e=>e.split(",")).map(e=>e.trim()).filter(Boolean)}function k_(e,t,i,n=__){const r=function(e,t=__){const i=m_(e),n=new Map;if(!i||!v_(t))return n;for(const e of t){const t=m_(e.since),r=m_(e.expires);g_(i,t)>=0&&g_(i,r)<0&&n.set(e.id,e)}return n}(i,n),o=new Set(v_(n)?n.map(e=>e.id):[]),s=new Set(function(e){if(!e)return[];try{const t=JSON.parse(e);return Array.isArray(t)?t.filter(e=>"string"==typeof e):[]}catch{return[]}}(t).filter(e=>r.has(e)));let a=!1;const l=e=>{if("off"===e)return s.clear(),void(a=!0);const t=e.startsWith("-"),i=t?e.slice(1):e;o.has(i)&&(a=!0,t||!r.has(i)?s.delete(i):s.add(i))};for(const t of w_(new URLSearchParams(String(e.search||"").replace(/^\?/,""))))l(t);for(const t of w_(y_(e.hash)))l(t);const c=Object.freeze([...s].sort());return{active:c,space:b_(e.hash),persist:a?JSON.stringify(c):void 0,knownUrlOperation:a}}let x_={active:Object.freeze([]),space:""},$_="",S_=!1,M_="";const R_=new Set;function T_(){if("undefined"==typeof window)return x_;const e=k_(window.location,function(){try{return window.localStorage.getItem(p_)}catch{return null}}(),$_);void 0!==e.persist&&function(e){try{window.localStorage.setItem(p_,e)}catch{}}(e.persist),x_={active:e.active,space:e.space},window.__hpLabs=e.active;for(const e of R_)e(x_);return x_}function C_(){T_()}function D_(e){return $_=e,"undefined"==typeof window?x_:(S_||(S_=!0,window.addEventListener("hashchange",C_),window.addEventListener("popstate",C_)),T_())}const A_=Object.freeze({rotDeg:0,tiltDeg:20,xyScale:1,zScale:1,origin:Object.freeze([500,500])});function O_(e){return[e.rotDeg,e.tiltDeg,e.xyScale,e.zScale,e.origin[0],e.origin[1]].every(Number.isFinite)&&Math.abs(e.xyScale)>1e-12&&Math.abs(Math.cos(e.tiltDeg*Math.PI/180))>1e-12}function z_(e,t,i=A_){if(!(O_(i)&&Number.isFinite(e[0])&&Number.isFinite(e[1])&&Number.isFinite(t)))throw new Error("invalid isometric projection input");const n=i.rotDeg*Math.PI/180,r=i.tiltDeg*Math.PI/180,o=e[0]-i.origin[0],s=e[1]-i.origin[1],a=(o*Math.cos(n)-s*Math.sin(n))*i.xyScale,l=(o*Math.sin(n)+s*Math.cos(n))*i.xyScale;return[i.origin[0]+a,i.origin[1]+l*Math.cos(r)-t*i.zScale*Math.sin(r)]}function P_(e,t=A_){if(!O_(t)||!Number.isFinite(e[0])||!Number.isFinite(e[1]))throw new Error("invalid isometric projection input");const i=t.rotDeg*Math.PI/180,n=t.tiltDeg*Math.PI/180,r=(e[0]-t.origin[0])/t.xyScale,o=(e[1]-t.origin[1])/(t.xyScale*Math.cos(n));return[t.origin[0]+r*Math.cos(i)+o*Math.sin(i),t.origin[1]-r*Math.sin(i)+o*Math.cos(i)]}function F_(e=A_){return`matrix(${function(e=A_){if(!O_(e))throw new Error("invalid isometric camera");const t=e.rotDeg*Math.PI/180,i=e.tiltDeg*Math.PI/180,n=e.xyScale*Math.cos(t),r=-e.xyScale*Math.sin(t),o=e.xyScale*Math.sin(t)*Math.cos(i),s=e.xyScale*Math.cos(t)*Math.cos(i);return[n,o,r,s,e.origin[0]-n*e.origin[0]-r*e.origin[1],e.origin[1]-o*e.origin[0]-s*e.origin[1]]}(e).map(e=>Number(e.toFixed(12))).join(" ")})`}function I_(e,t=A_){const{rect:i,wallHeight:n}=e,r=e.openingHeight??n,o=e.floorDepth??0;if(!(i.w>=0)||!(i.h>=0)||!Number.isFinite(n)||!Number.isFinite(r)||!Number.isFinite(o)||n<0||r<0||o<0)throw new Error("invalid isometric frame");const s=[[i.x,i.y],[i.x+i.w,i.y],[i.x+i.w,i.y+i.h],[i.x,i.y+i.h]],a=Math.max(n,r),l=s.flatMap(e=>[z_(e,-o,t),z_(e,a,t)]),c=l.map(e=>e[0]),h=l.map(e=>e[1]),d=Math.min(...c),u=Math.min(...h);return{x:d,y:u,w:Math.max(...c)-d,h:Math.max(...h)-u}}const E_=e=>`${Number(e[0].toFixed(4))} ${Number(e[1].toFixed(4))}`;function N_(e){let t=0;for(let i=0;i<e.length;i++){const n=e[i],r=e[(i+1)%e.length];t+=n[0]*r[1]-r[0]*n[1]}return t/2}function H_(e,t){const i=function(e){const t=(Array.isArray(e)?e:[]).filter(e=>Array.isArray(e)&&Number.isFinite(e[0])&&Number.isFinite(e[1])).map(e=>[Number(e[0]),Number(e[1])]),i=t[t.length-1];return t.length>1&&t[0][0]===i[0]&&t[0][1]===i[1]&&t.pop(),t}(e);if(i.length<3)return[];const n=!t;return N_(i)>0===n?i:[...i].reverse()}function L_(e,t,i){return e.length?`M ${e.map(e=>E_(z_(e,i,t))).join(" L ")} Z`:""}function q_(e,t,i){const n=t[1]-e[1],r=-(t[0]-e[0]),o=i.rotDeg*Math.PI/180;return n*Math.sin(o)+r*Math.cos(o)}function j_(e,t,i=A_){if(!Number.isFinite(t)||t<0)throw new Error("invalid floor edge height");const n=(e||[]).map(e=>(e||[]).map((e,t)=>function(e,t){const i=H_(e,t);if(!i.length)return i;let n=0;for(let e=1;e<i.length;e++)(i[e][0]<i[n][0]||i[e][0]===i[n][0]&&i[e][1]<i[n][1])&&(n=e);return[...i.slice(n),...i.slice(0,n)]}(e,t>0)).filter(e=>e.length>=3&&Math.abs(N_(e))>=1e-9)).filter(e=>e.length&&N_(e[0])>0);n.sort((e,t)=>{const i=e[0][0],n=t[0][0];return i[0]-n[0]||i[1]-n[1]||Math.abs(N_(t[0]))-Math.abs(N_(e[0]))});const r=[],o=[];let s=0;for(let e=0;e<n.length;e++){const a=n[e];for(const e of a)r.push(L_(e,i,0));const l=a[0];s+=l.length;for(let n=0;n<l.length;n++){const r=l[n],s=l[(n+1)%l.length];if(q_(r,s,i)<=1e-9)continue;const a=z_(r,0,i),c=z_(s,0,i),h=z_(s,-t,i),d=z_(r,-t,i);o.push({d:`M ${E_(a)} L ${E_(c)} L ${E_(h)} L ${E_(d)} Z`,depth:Math.max(d[1],h[1]),component:e,edge:n,planEdge:[r,s]})}}return o.sort((e,t)=>e.depth-t.depth||e.component-t.component||e.edge-t.edge),{footprintPath:r.join(" "),sides:o,componentCount:n.length,edgeCount:s}}function B_(e,t){return e^=Math.round(64*(Number.isFinite(t)?t:0)),Math.imul(e,16777619)>>>0}const W_=e=>e.every(Number.isFinite);function U_(e,t,i,n){const r=e[0]*i,o=e[1]*n,s=t*Math.PI/180;return[r*Math.cos(s)-o*Math.sin(s),r*Math.sin(s)+o*Math.cos(s)]}function G_(e,t,i,n,r,o,s){const a=e.flipH?-1:1,l="gate"===e.type?1:e.flipV?-1:1,c=(e.type,e.flipV,e.angle,e.face,{ox:0,oy:0}),h=function(e,t){return[e[0]+t[0],e[1]+t[1]]}([e.x+c.ox,e.y+c.oy],U_(i,e.angle,a,l));return{leaf:t,hinge:h,closedVector:U_(n,e.angle,a,l),quarterVector:U_([-n[1],n[0]],e.angle,a,l),turnDeg:r,bottom:o,top:s}}const V_=e=>`${Number(e[0].toFixed(4))} ${Number(e[1].toFixed(4))}`;function K_(e,t,i=A_){const n=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));return e.leaves.map(t=>{const r=function(e,t){const i=e.turnDeg*t*Math.PI/180;return[e.hinge[0]+e.closedVector[0]*Math.cos(i)+e.quarterVector[0]*Math.sin(i),e.hinge[1]+e.closedVector[1]*Math.cos(i)+e.quarterVector[1]*Math.sin(i)]}(t,n),o=z_(t.hinge,t.bottom,i),s=z_(r,t.bottom,i),a=z_(r,t.top,i),l=z_(t.hinge,t.top,i);return{id:e.id,sourceIndex:e.sourceIndex,type:e.type,leaf:t.leaf,d:`M ${V_(o)} L ${V_(s)} L ${V_(a)} L ${V_(l)} Z`,shadowD:`M ${V_(z_(t.hinge,0,i))} L ${V_(z_(r,0,i))}`,depth:Math.max(o[1],s[1])}})}const Y_={window:120,door:90,passage:90,gate:300};function Z_(e){return Y_[e]}function X_(e,t){return{type:e,lengthCm:Z_(e),flipH:!1,flipV:!1,revision:t}}function J_(e,t){const i=Math.max(0,e.renderedLength)/2,n=Math.max(0,e.target.physicalHalfWidth),r=n+.18*Math.max(0,t),o=e=>({x1:e,y1:-r,x2:e,y2:r});return{rect:{x:-i,y:n?-n:0,width:2*i,height:2*n},boundaries:[o(-i),o(i)]}}function Q_(e,t){const i=[e[0],e[1]],n=[t[0],t[1]];return function(e,t){return e[0]-t[0]||e[1]-t[1]}(i,n)<=0?{a:i,b:n}:{a:n,b:i}}function em(e){const t=new Map;return e.forEach((e,i)=>{if(!e.kind||e.open)return;const n=Q_(e.a,e.b);if(Math.hypot(n.b[0]-n.a[0],n.b[1]-n.a[1])<=1e-9)return;const r=function(e,t){const i=e=>(Math.abs(e)<=5e-10?0:Math.round(1e6*e)/1e6).toFixed(6);return`${i(e[0])},${i(e[1])}>${i(t[0])},${i(t[1])}`}(n.a,n.b),o=t.get(r);if(o)return o.physicalHalfWidth=Math.max(o.physicalHalfWidth,e.half||0),o.sourceOrder=Math.min(o.sourceOrder,i),void(e.partitionHost&&(o.partitionHost&&o.partitionHost.id!==e.partitionHost.id?o.ambiguousPartitionHost=!0:o.partitionHost=e.partitionHost));t.set(r,{segmentKey:r,a:n.a,b:n.b,physicalHalfWidth:Math.max(0,e.half||0),sourceOrder:i,...e.partitionHost?{partitionHost:e.partitionHost}:{}})}),[...t.values()]}function tm(e,t){if(Math.abs(e.distance-t.distance)>1e-9)return e.distance-t.distance;if(Math.abs(e.perpendicular-t.perpendicular)>1e-9)return e.perpendicular-t.perpendicular;return(e.target.segmentKey<t.target.segmentKey?-1:e.target.segmentKey>t.target.segmentKey?1:0)||e.target.sourceOrder-t.target.sourceOrder}function im(e){const t=em(e.intervals).map(t=>{const i=function(e,t){const i=t.b[0]-t.a[0],n=t.b[1]-t.a[1],r=Math.hypot(i,n),o=i/r,s=n/r,a=(e[0]-t.a[0])*o+(e[1]-t.a[1])*s,l=Math.max(0,Math.min(r,a)),c=t.a[0]+l*o,h=t.a[1]+l*s;return{along:l,length:r,x:c,y:h,distance:Math.hypot(e[0]-c,e[1]-h),perpendicular:Math.abs((e[0]-t.a[0])*s-(e[1]-t.a[1])*o)}}(e.pointer,t);return{target:t,...i,envelope:Math.max(e.baseTolerance,t.physicalHalfWidth+e.bodyPointerPadding)}}).filter(e=>e.distance<=e.envelope+1e-9).filter(t=>!function(e,t,i,n,r){const o=t.b[0]-t.a[0],s=t.b[1]-t.a[1],a=Math.hypot(o,s);if(!(a>1e-9))return!1;const l=o/a,c=s/a;for(const o of i){if(!o.open&&o.kind)continue;const i=Q_(o.a,o.b),s=i.b[0]-i.a[0],a=i.b[1]-i.a[1],h=Math.hypot(s,a);if(!(h>1e-9))continue;const d=s/h,u=a/h;if(Math.abs(l*u-c*d)>1e-6)continue;if(Math.abs((i.a[0]-t.a[0])*c-(i.a[1]-t.a[1])*l)>r)continue;const p=(e[0]-i.a[0])*d+(e[1]-i.a[1])*u,_=1e-9;if(!(p<=_||p>=h-_)&&Math.abs((e[0]-i.a[0])*u-(e[1]-i.a[1])*d)<=n+1e-9)return!0}return!1}(e.pointer,t.target,e.intervals,t.envelope,Math.max(1e-9,Math.min(e.baseTolerance,.04*e.gridStep)))),i=t.filter(t=>!!t.target.partitionHost&&e.renderedLength+2*t.target.physicalHalfWidth>t.length+1e-9).sort(tm),n=t.filter(t=>!t.target.partitionHost||e.renderedLength+2*t.target.physicalHalfWidth<=t.length+1e-9).sort(tm);let r=n[0];if(!r)return{candidate:null,jambBlockedTarget:i[0]?.target||null};const o=n.filter(e=>Math.abs(e.distance-r.distance)<=1e-9&&Math.abs(e.perpendicular-r.perpendicular)<=1e-9),s=o.filter(e=>e.target.partitionHost);if(s.length){if(1!==new Set(s.map(e=>e.target.partitionHost.id)).size||s.some(e=>e.target.ambiguousPartitionHost))return{candidate:null,jambBlockedTarget:null};const e=s[0],t=e.target.b[0]-e.target.a[0],i=e.target.b[1]-e.target.a[1],n=Math.hypot(t,i),a=t/n,l=i/n;if(!o.every(t=>{const i=t.target.b[0]-t.target.a[0],n=t.target.b[1]-t.target.a[1],r=Math.hypot(i,n),o=i/r,s=n/r,c=Math.abs(a*s-l*o)<=1e-6,h=Math.abs((t.target.a[0]-e.target.a[0])*l-(t.target.a[1]-e.target.a[1])*a);return c&&h<=1e-9}))return{candidate:null,jambBlockedTarget:null};r=e}if(r.target.ambiguousPartitionHost)return{candidate:null,jambBlockedTarget:null};const{target:a,length:l}=r,c=a.b[0]-a.a[0],h=a.b[1]-a.a[1],d=c/l,u=h/l,p=a.partitionHost?a.physicalHalfWidth:0,_=Math.min(Math.max(0,e.renderedLength)/2+p,l/2);let m=r.along;const g=Math.max(e.gridStep,1e-9),f=l/2;m=Math.abs(m-f)<=g/2?f:Math.round(m/g)*g,m=Math.max(_,Math.min(l-_,m));const v=a.a[0]+d*m,y=a.a[1]+u*m,b=Math.max(0,e.renderedLength)/2,w=m-b,k=m+b,x=Math.max(0,w),$=Math.max(0,l-k),S=[a.a[0]+d*(w-x/2),a.a[1]+u*(w-x/2)],M=[a.a[0]+d*(k+$/2),a.a[1]+u*(k+$/2)];let R=180*Math.atan2(h,c)/Math.PI;R>=90?R-=180:R<-90&&(R+=180);const T=Math.abs(m-f)<=1e-9;return{candidate:{presetRevision:e.preset.revision,geometryRevision:e.geometryRevision,pointer:[e.pointer[0],e.pointer[1]],type:e.preset.type,lengthCm:e.preset.lengthCm,flipH:e.preset.flipH,flipV:e.preset.flipV,x:v,y:y,angle:R,renderedLength:e.renderedLength,target:a,...a.partitionHost?{host:{...a.partitionHost,t:l>0?m/l:0}}:{},measure:{labels:[{distance:x,midpoint:S},{distance:$,midpoint:M}],guide:T?{x:v,y:y,angle:R}:null}},jambBlockedTarget:null}}function nm(e,t,i,n,r=1e-6){return e.presetRevision===i&&e.geometryRevision===n&&Math.hypot(e.pointer[0]-t[0],e.pointer[1]-t[1])<=r}function rm(e){return!(!e.canEdit||e.kiosk||e.fixedFloor)&&("view"!==e.mode&&("mouse"===e.pointerType&&e.spaceCount>1))}const om="1.68.1",sm="b0932d9ea32229294c30d94b645a3699799d106ba4e7bcc204be2a152c72ece9",am=1500,lm=(e,t)=>{if(!e.has(t))return{hit:!1};const i=e.get(t);return e.delete(t),e.set(t,i),{hit:!0,value:i}},cm=(e,t,i,n)=>{for(e.delete(t),e.set(t,i);e.size>n;){const t=e.keys().next().value;if(void 0===t)break;e.delete(t)}},hm=new Map;let dm=0;const um=e=>`${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(e??{})}`;let pm=1e4;const _m="houseplan_card_layout_v1",mm="houseplan_card_cfg_v1",gm="houseplan_card_zoom_v1",fm="houseplan_card_nav_v1",vm="houseplan_card_kiosk_v1",ym="houseplan_card_view_v1",bm="hp-dialog, hp-help, hp-color-opacity, hp-device-preview",wm=1e3,km=[[0,1],[45,.88],[70,.62],[86,.32],[100,0]],xm=(e,t)=>{const i=Math.min(e.x,t.x),n=Math.min(e.y,t.y);return{x:i,y:n,w:Math.max(e.x+e.w,t.x+t.w)-i,h:Math.max(e.y+e.h,t.y+t.h)-n}},$m=new Set(["select","draw","column","merge","split","resize","opening","wallthick","delroom"]),Sm=(e,t,i)=>{const n=new Event(t,{bubbles:!0,composed:!0});n.detail=i??{},e.dispatchEvent(n)},Mm=e=>{history.pushState(null,"",e),Sm(window,"location-changed",{replace:!1})},Rm=(e,t)=>{let i,n=null;const r=(...r)=>{clearTimeout(i),n=r,i=window.setTimeout(()=>{i=void 0;const t=n;n=null,t&&e(...t)},t)};return r.flush=()=>{if(void 0===i)return;clearTimeout(i),i=void 0;const t=n;n=null,t&&e(...t)},r.cancel=()=>{clearTimeout(i),i=void 0,n=null},r.pending=()=>void 0!==i,r},Tm=e=>{try{e.target?.setPointerCapture?.(e.pointerId)}catch{}};class Cm extends he{constructor(){super(...arguments),this._editorRuntime=null,this._onboardingRuntime=null,this._editorRuntimeLoadingVisible=!1,this._editorModeRequest=0,this._warmModeRequest=0,this._editorRuntimeLoader=new u_({expectedFingerprint:sm,load:async e=>{const t=0===e?await import("./houseplan-editor-runtime-DrDVEMpg.js"):await import((()=>{const e=new URL("./houseplan-editor-runtime-DrDVEMpg.js",import.meta.url);return e.searchParams.set("hp_retry",om),e.href})());return{fingerprint:t.EDITOR_RUNTIME_FINGERPRINT,create:()=>new t.HouseplanEditorRuntime(this)}},install:e=>{this._editorRuntime=e},stateChanged:e=>this._editorRuntimeStateChanged(e),failed:e=>{console.error("[houseplan] unable to load editor runtime",e),this._showToast(`${this._t("editor.load_failed")} ${this._t("editor.refresh_advice")}`)}}),this._onboardingRuntimeLoader=new u_({expectedFingerprint:sm,load:async e=>{const t=0===e?await import("./houseplan-onboarding-runtime-C0W2ru6W.js"):await import((()=>{const e=new URL("./houseplan-onboarding-runtime-C0W2ru6W.js",import.meta.url);return e.searchParams.set("hp_retry",om),e.href})());return{fingerprint:t.ONBOARDING_RUNTIME_FINGERPRINT,create:()=>new t.HouseplanOnboardingRuntime(this)}},install:e=>{this._onboardingRuntime=e},failed:e=>{console.error("[houseplan] unable to load onboarding runtime",e),this._showToast(`${this._t("editor.load_failed")} ${this._t("editor.refresh_advice")}`)}}),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._serverCanWrite=null,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._cfgContentFingerprint="",this._unsubCfg=null,this._unsubLayout=null,this._unsubVirtual=null,this._liveSyncAttempt=null,this._liveSyncGeneration=0,this._liveSyncConnection=null,this._layoutRev=0,this._layoutContentFingerprint="",this._virtualLights=Cc(null),this._canOptimizeUndo=!1,this._undoKind=null,this._devices=[],this._regSignature="",this._defPos={},this._newSyncKey="",this._tip=null,this._hoverRoom=null,this._pointerModality=new Ep(this,()=>this._syncPointerHoverTargets()),this._devicePressAnimations=new Map,this._selId=null,this._toast="",this._mode="view",this._pendingNavMode=null,this._decorTool="select",this._decorStyle={...ur},this._decorDraft=null,this._decorMove=null,this._decorSel=null,this._decorEraseConfirm=null,this._decorTextDialog=null,this._decorShapeDialog=null,this._backdropDialog=null,this._decorTextSelection={start:0,end:0},this._furnPalette=null,this._dtBox=null,this._dtDrag=null,this._bdDrag=null,this._slide="",this._reducedMotion=!1,this._onMotionChange=e=>{this._reducedMotion=e.matches,this._cancelDevicePressFeedback(),e.matches&&this._modeTransitionPreparing?this._modeTransitionForceAtomic=!0:e.matches&&this._modeTransition.active&&this._cancelModeTransition(!0),this.requestUpdate()},this._editorChromeMode="plan",this._modeTransitionVisual=null,this._modeTransitionPreparing=!1,this._modeTransitionForceAtomic=!1,this._modeTransitionRequest=0,this._modeTransitionTargetZoom=1,this._modeTransitionEditorCamera=null,this._modeTransition=new d_({frame:e=>this._applyModeTransitionFrame(e),settled:e=>this._settleModeTransition(e)}),this._editorSecondaryCopy={groupActive:(e,t)=>this._t("editor.group_active",{group:e,item:t}),openGroup:e=>this._t("editor.open_group",{group:e}),disabledAction:(e,t)=>this._t("editor.disabled_action",{action:e,reason:t})},this._tool="draw",this._geometryHistory=new Jp(50),this._wallDialog=null,this._drawWallField=null,this._activeDraftId=null,this._resumeDraftBySpace={},this._physicalSel=null,this._physicalDialog=null,this._partitionDeleteDialog=null,this._roomDeleteDialog=null,this._physicalDrag=null,this._physicalRotate=null,this._physicalLastTap=null,this._physicalPickCycle=null,this._wallUnionCacheValue=null,this._wallUnionPool=new Map,this._isoGeometryCache=new Map,this._isoFallback=new Set,this._openingTunnelCache=null,this._openingWallIndexCache=new Map,this._openingPlacementIntervalsCache=null,this._openingDimensionContextCache=null,this._planSnapGeometryCache=null,this._planStructuralGeometryCache=null,this._hiddenWallDiagnosticCache=null,this._physicalBodiesCache=null,this._lightPhysicalBodiesCache=null,this._cleanFloorCache=new Map,this._innerContourCache=new Map,this._glowClipCache=new Map,this._glowGeometryWarnings=new Set,this._lightBarrierCache=null,this._lightBarrierPool=new Map,this._glowFeatherUnits=null,this._glowRenderedSources=new Map,this._glowLastAppearance=new Map,this._glowEnteringSources=new Set,this._glowEnterRafs=new Map,this._glowFadeTimers=new Map,this._glowFeatherSuspendUntil=0,this._glowFeatherResumeTimer=0,this._glowSourceSeq=0,this._glowScreenBlend=!1,this._duplicateColumnId=null,this._duplicateColumnTimer=0,this._rszLimitViolation=null,this._path=[],this._cursorPt=null,this._planSnapHover=null,this._mergeSel=null,this._openingPreset=null,this._openingRebindId=null,this._openingPresetRevision=0,this._openingHoverCandidate=null,this._openingJambBlockCm=null,this._openingDialog=null,this._openingInfo=null,this._opDrag=null,this._opMeasure=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._wallFaceBatch=null,this._wallRepairDiagnostic=null,this._wallFaceGraphCache=[],this._areaSel="",this._nameSel="",this._roomDialog=!1,this._roomEditId=null,this._roomFill="",this._roomCustomFill=null,this._roomTempSrc="",this._roomHumSrc="",this._roomSrcOpen=null,this._roomSrcFilter="",this._roomNameScale=1,this._roomLabelScale=1,this._zoom=1,this._view=null,this._zoomBySpace={},this._viewModeSnap=null,this._pointers=new Map,this._panStart=null,this._panLock=null,this._pinchStart=null,this._suppressClick=!1,this._touchContacts=new Map,this._touchSequenceMultitouch=!1,this._touchClickBlockUntil=0,this._connectedPath="",this._routeDepartureHandled=!1,this._onLocationChanged=()=>{this._connectedPath&&location.pathname!==this._connectedPath?this._leaveCardRoute():location.pathname===this._connectedPath&&(this._routeDepartureHandled=!1)},this._touchGestureGuard={capture:!0,handleEvent:e=>this._guardTouchGesture(e)},this._hdrH=118,this._booting=!0,this._bootFading=!1,this._bootSettling=!1,this._bootSettleRaf=0,this._bootLastH=-1,this._bootStart=0,this._bootLastChange=0,this._bootSoft=!1,this._tapConfirm=null,this._onboardingShown=!1,this._rulesDialog=null,this._preflightClipboardFallback=null,this._haIntegrationVersion=null,this._alignDialog=null,this._settingsDialog=null,this._backupExportDialog=null,this._backupImportDialog=null,this._sunRaysCache=null,this._dayCycleTimer=0,this._dayCycleClockKey="",this._compassDrag=!1,this._importDialog=null,this._importQueue=[],this._importTotal=0,this._rulesCompiledSrc="",this._infoCard=null,this._nativeMoreInfoEntity=null,this._deviceInbox=null,this._deviceInboxReturn=null,this._deviceInboxMemo=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=e=>this._onKey(e),this._warmVp=null,this._warmVpArmed=!1,this._warmLongReturn=!1,this._warmRevivePending=!1,this._warmGen=++dm,this._warmKey=null,this._warmSlot=null,this._hashApplied=!1,this._navApplied=!1,this._labs={active:Object.freeze([]),space:""},this._viewPreference={},this._renderProjection="flat",this._kioskScale={icon:1,font:1},this._kioskDialog=!1,this._activityRt=new Map,this._vacRt=new Map,this._vacViewKey="",this._vacLastView=null,this._vacRaf=0,this._vacSrvTrails={},this._vacJumpOnce=!1,this._continuity=this._newContinuityController(),this._continuityHistory=[],this._continuityEpoch=0,this._continuityDataReady=!0,this._continuityPaintToken=-1,this._continuityDisposed=!1,this._renderSnapshotAt=Date.now(),this._hassSequence=0,this._visibleDeviceSnapshot=null,this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1,this._capturedSnapshotSequence=-1,this._capturedSnapshotDevices=null,this._capturedSnapshotLayout=null,this._capturedSnapshotActivity="",this._capturedSnapshotConfigEpoch=-1,this._capturedSnapshotVirtual="",this._lastValidStageSize=null,this._pendingRefitSize=null,this._refitRaf=0,this._pageVisibility=e=>{if(this._continuity.visibility(e),this._dayCycleVisibility(e),"hidden"===e.kind)return this._clearTransientHover(!0),this._cancelDevicePressFeedback(),void(this._modeTransitionPreparing?this._modeTransitionForceAtomic=!0:this._cancelModeTransition(!0));if(this._vacJumpOnce=!0,!e.long){const e=Date.now();let t=!1;for(const i of this._activityRt.values())!i.flashKind||(i.expiresAt||i.flashTs+Op)>e||(i.flashTs=0,i.flashKind=null,i.expiresAt=0,t=!0);return void(t&&this.requestUpdate())}Date.now()-this._renderSnapshotAt>1e3&&this._continuity.note("device-snapshot-stale"),this._continuityDataReady=!1,this._continuityPaintToken=-1,this._resumeSettling=!0,this._loading?this.requestUpdate():this._loadFromServer()},this._resumeSettling=!1,this._viewportInvalidAt=0,this._vacFit=null,this._vacAllCamerasFor=null,this._vacAllCameraCache=null,this._vacCalConfirm=null,this._kioskDots=!1,this._cyclePausedUntil=0,this._swipeStart=null,this._tabDrag=null,this._tabDragRelease=null,this._tabSuppressClick=!1,this._tabOrderWarned=!1,this._lastTap=0,this._onLabsSnapshot=e=>{const t=this._effectiveProjection();this._labs=e;const i=this._effectiveProjection();this._convertProjectionView(t,i),this.requestUpdate()},this._onHashChange=()=>{if(this._hasFixedFloor)return;const e=this._hashSpace();if(e&&this._model.find(t=>t.id===e)&&e!==this._space){if(this._wallFaceBatch&&this._roomDialogCancel(),"plan"===this._mode&&"draw"===this._tool&&!this._finishWallChain())return;this._activeDraftId&&(this._resumeDraftBySpace[this._space]=this._activeDraftId),this._commitSpace(e),this._selId=null,this._path=[],this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this._tool="draw",this._activeDraftId=null,this._draftSegmentCms=[],this._closingWallCm=null,"plan"===this._mode&&"draw"===this._tool&&this._resumeLastDraft(),this._restoreZoom(),this.requestUpdate()}},this._drag=null,this._rlResize=null,this._holdFired=!1,this._retryContinuity=()=>{this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.retry(this._continuity.recoveryReason||"plan"),this._loading||this._loadFromServer()},this._cfgEpoch=0,this._modelCache=null,this._emptySpaceStateActive=!1,this._decorSnapCache=null,this._markerPreviewMemo=null,this._markerPreviewDevicesMemo=null,this._showHidden=!1,this._connHooked=null,this._connectionWasLost=!1,this._haRegistryConnection=null,this._haRegistryRev=-1,this._haBindingCacheKey="",this._planHassMemo=null,this._onHaRegistryUpdate=()=>{const e=Vc(this.hass);e.revision===this._haRegistryRev&&this._devices.length||(this._haRegistryRev=e.revision,this._planHassMemo=null,this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate())},this._onConnReady=()=>{if(this._loadTries=0,clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,function(e){const t=qc(e);t&&(Wc(e,t),Uc(e,t))}(this.hass),this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),this._cfgWriting)return clearTimeout(this._reloadRetry),void(this._reloadRetry=window.setTimeout(this._onConnReady,400));!this._connectionWasLost&&this._continuity.hasCompleteFrame?this._beginContinuityCandidate("connection-ready",!1,"plan"):(this._continuityDataReady=!1,this._continuityPaintToken=-1),this._loading||this._loadFromServer()},this._onConnLost=()=>{this._booting&&!this._continuity.hasCompleteFrame||(this._connectionWasLost=!0,this._continuityDataReady=!1,this._continuityPaintToken=-1,this._continuity.connectionLost())},this._signer=new Dl(()=>this.requestUpdate()),this._dirtyPos=new Set,this._sentPos=new Map,this._persistLayout=Rm(()=>{if(this._serverStorage){const e=[...this._dirtyPos];this._dirtyPos.clear();for(const t of e){const e=ro(this._layout[t]);e&&(this._layout={...this._layout,[t]:e},this._sentPos.set(t,e),this.hass.callWS({type:"houseplan/layout/update",device_id:t,pos:e}).then(e=>this._noteLayoutRev(e)).catch(e=>this._showToast(this._t("toast.pos_save_failed",{err:this._errText(e)}))).finally(()=>{this._sentPos.get(t)===e&&this._sentPos.delete(t)}))}this._cacheSnapshot()}else this._layout=oo(Ur(this._layout)),localStorage.setItem(_m,JSON.stringify(this._layout))},600),this._frame=null,this._showFar=!1,this._writesPending=0,this._writeChain=Promise.resolve(),this._pendingPhysicalWrites=new Map,this._undoGeometry=()=>this._editorRuntimeOrThrow()._undoGeometry(),this._redoGeometry=()=>this._editorRuntimeOrThrow()._redoGeometry(),this._saveConfigDebounced=Rm(()=>{this._serverCfg&&this._writeConfig().catch(e=>{const t=!0===e?.physicalGeometryRolledBack;"geometry-unsafe"!==e?.code&&("wall_model_client_outdated"===e?.code?this._showToast(this._t("toast.wall_model_client_outdated")):"conflict"===e?.code?(this._showToast(this._t("toast.conflict")),t||(this._cancelPath(),this._reloadConfigOnly(!0))):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(e)})),t&&this._reloadRejectedPhysicalWrite())})},500),this._draftSegmentCms=[],this._closingWallCm=null,this._savePhysicalDialog=()=>this._editorRuntimeOrThrow()._savePhysicalDialog(),this._deletePhysicalSelection=()=>this._editorRuntimeOrThrow()._deletePhysicalSelection(),this._confirmPartitionDelete=()=>this._editorRuntimeOrThrow()._confirmPartitionDelete(),this._deleteDraftWhole=()=>this._editorRuntimeOrThrow()._deleteDraftWhole(),this._deleteDraftSegment=()=>this._editorRuntimeOrThrow()._deleteDraftSegment(),this._confirmRoomDelete=e=>this._editorRuntimeOrThrow()._confirmRoomDelete(e),this._rebindPartitionOpening=()=>this._editorRuntimeOrThrow()._rebindPartitionOpening(),this._keepClosedAsPartitions=()=>this._editorRuntimeOrThrow()._keepClosedAsPartitions(),this._toggleServerPlans=async()=>this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._toggleServerPlans():this._editorRuntimeOrThrow()._toggleServerPlans(),this._aspectJob=null,this._dayCycleTick=()=>{if(!this.isConnected||"hidden"===this.ownerDocument.visibilityState)return;const e=this._dayCycleState();if(!e)return this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),void(this._dayCycleClockKey="");const t=Zn(e);t!==this._dayCycleClockKey&&(this._dayCycleClockKey=t,this.requestUpdate())},this._sunShown=!1,this._sunOut=!1,this._sunOutTimer=0,this._openSettingsDialog=()=>{if(this._editorRuntime)return this._editorRuntime._openSettingsDialog();this._ensureEditorRuntime().then(e=>{e&&this._openSettingsDialog()})},this._reportedPreflightFingerprint=null,this._openAlignDialog=()=>this._editorRuntimeOrThrow()._openAlignDialog(),this._toggleOptimizeLivePositions=()=>this._editorRuntimeOrThrow()._toggleOptimizeLivePositions(),this._optimizeUndoBusy=!1,this._openBackupExport=()=>this._editorRuntimeOrThrow()._openBackupExport(),this._openRulesDialog=()=>this._editorRuntimeOrThrow()._openRulesDialog(),this._climateCache=null,this._gearPtCache=new WeakMap}_editorRuntimeOrThrow(){if(!this._editorRuntime)throw new Error("Houseplan editor runtime is not loaded");return this._editorRuntime}async _ensureEditorRuntime(){return this._editorRuntimeLoader.ensure()}async _ensureOnboardingRuntime(){return this._onboardingRuntimeLoader.ensure()}_editorRuntimeStateChanged(e){clearTimeout(this._editorRuntimeLoadingTimer),this._editorRuntimeLoadingTimer=void 0,"loading"!==e?(this._editorRuntimeLoadingVisible=!1,this.requestUpdate()):this._editorRuntimeLoadingTimer=window.setTimeout(()=>{this._editorRuntimeLoadingVisible=!0,this.requestUpdate()},150)}async _requestMode(e,t=!0,i=!1){const n=++this._editorModeRequest;if(i&&(this._warmModeRequest=n,this._refitRaf&&(cancelAnimationFrame(this._refitRaf),this._refitRaf=0),this._pendingRefitSize=null),"view"===e||await this._ensureEditorRuntime()){if(n===this._editorModeRequest&&this.isConnected)return i?(this._adoptMode(e),this._warmRevivePending&&(clearTimeout(this._warmReviveTimer),this._warmReviveTimer=void 0,this._warmReviveDialog()),this.requestUpdate(),void this.updateComplete.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(this._warmModeRequest!==n||n!==this._editorModeRequest)return;const e=this._stageEl;this._lastValidStageSize=e&&e.clientWidth>0&&e.clientHeight>0?[e.clientWidth,e.clientHeight]:null,this._pendingRefitSize=null,this._warmModeRequest=0})))):void this._setMode(e,t);this._warmModeRequest===n&&(this._warmModeRequest=0)}else this._warmModeRequest===n&&(this._warmModeRequest=0)}get _canEdit(){return!!this._norm&&(!0===this._serverCanWrite||!1!==this._serverCanWrite&&!0===this.hass?.user?.is_admin)}get _kiosk(){return!!this._config?.kiosk}_showKioskDots(){this._kioskDots=!0,clearTimeout(this._kioskDotsTimer),this._kioskDotsTimer=window.setTimeout(()=>this._kioskDots=!1,2500)}get _modeTransitionBusy(){return this._modeTransitionPreparing||this._modeTransition.active}_cssColor(e,t){const i=String(e||"").trim();if(!i)return t;const n=document.createElement("span");n.style.cssText=`position:absolute;visibility:hidden;color:${i}`,this.renderRoot.append(n);const r=getComputedStyle(n).color||t;return n.remove(),r}_currentModeVisual(e=this._mode){const t=this._modeTransition.presented||this._modeTransitionVisual;if(t)return{...t,viewport:{...t.viewport,viewBox:{...t.viewport.viewBox}}};const i=this._stageEl;if(!i||i.clientWidth<=0||i.clientHeight<=0)return null;const n=this.renderRoot.querySelector(".editorchrome"),r=this._viewOr(this._baseVb()),o=this.renderRoot.querySelector(".hp-paper"),s=this.renderRoot.querySelector(".hp-backdrop"),a=this.renderRoot.querySelector(".zoomwrap"),l=a?getComputedStyle(a).filter:"",c=Number(/brightness\(([^)]+)\)/.exec(l)?.[1]);return{presentedMode:e,editorChromeHeight:"view"===e?0:n?.getBoundingClientRect().height||0,stageWidth:i.clientWidth,stageHeight:i.clientHeight,viewport:s_(r,i.clientWidth),stageColor:getComputedStyle(i).backgroundColor||"rgb(255, 255, 255)",paperColor:o?getComputedStyle(o).fill:"rgb(255, 255, 255)",sceneBrightness:Number.isFinite(c)?c:1,architectureOpacity:"decor"===e?.35:1,backdropOpacity:s&&Number(getComputedStyle(s).opacity)||1,viewWeight:"view"===e?1:0,editorWeight:"view"===e?0:1,toolbarContentOpacity:"view"===e?0:1}}_viewForModeTarget(e,t,i,n,r){const o=Ri(this._baseVb(),n/Math.max(1,r)),s=Math.min(Cm.ZOOM_MAX,Math.max(Cm.ZOOM_MIN,e)),a=o.w/s,l=o.h/s,c=t??o.x+o.w/2,h=i??o.y+o.h/2;return this._clampView({x:c-a/2,y:h-l/2,w:a,h:l},o)}_targetStageColor(e){return"view"!==e?"rgb(255, 255, 255)":this._cssColor(this._stageBg(this._spaceDisplayForRender()),this._cssColor("var(--ha-card-background, var(--card-background-color, #111))","rgb(17, 17, 17)"))}_targetPaperColor(e){return"view"===e&&this._spaceModel()?.bg?this._cssColor("var(--ha-card-background, var(--card-background-color, #111))","rgb(17, 17, 17)"):"rgb(255, 255, 255)"}_targetBrightness(e){return 1}_applyModeTransitionFrame(e){e.targetMode===this._mode&&(this._modeTransitionVisual=e.presented,this._view={...e.presented.viewport.viewBox},this.requestUpdate())}_settleModeTransition(e){if(e.targetMode!==this._mode)return;const t=this._modeTransitionRequest;this._view={...e.to.viewport.viewBox},this._zoom=this._modeTransitionTargetZoom,this._modeTransitionVisual=null,this._modeTransitionPreparing=!1,this._lastValidStageSize=[e.to.stageWidth,e.to.stageHeight],"view"===this._mode&&(this._saveZoom(),this._viewModeSnap=null,this._modeTransitionEditorCamera=null),this.requestUpdate(),this.updateComplete.then(()=>{if(!this.isConnected||t!==this._modeTransitionRequest||this._modeTransitionBusy||e.targetMode!==this._mode)return;const i=this._stageEl;if(i&&i.clientWidth>0&&i.clientHeight>0&&(Math.abs(i.clientWidth-e.to.stageWidth)>.5||Math.abs(i.clientHeight-e.to.stageHeight)>.5)){const e=this._view;this._lastValidStageSize=[i.clientWidth,i.clientHeight],this._applyView(this._zoom,e?e.x+e.w/2:void 0,e?e.y+e.h/2:void 0),this.requestUpdate()}const n=this.renderRoot.activeElement;(!n||!n.isConnected||!!n.closest?.(".editorchrome, .stage"))&&this.renderRoot.querySelector(".modetab.active")?.focus?.({preventScroll:!0})})}_cancelModeTransition(e=!0){const t=!!this._modeTransition.state;this._modeTransitionRequest++,this._modeTransitionPreparing=!1,this._modeTransitionForceAtomic=!1,this._modeTransition.cancel(e),e&&t||(this._modeTransitionVisual=null)}_adoptMode(e){this._cancelModeTransition(!1),this._mode=e,"view"!==e&&(this._editorChromeMode=e)}_commitViewModeAtomic(e,t,i,n){if(this._modeTransitionPreparing=!1,this._modeTransitionVisual=null,this._modeTransitionForceAtomic=!1,this._zoom=t,e){const r=this._stageEl?.clientWidth||e.stageWidth,o=Math.max(1,e.stageHeight+e.editorChromeHeight);this._view=this._viewForModeTarget(t,i,n,r,o),this._lastValidStageSize=[r,o]}else this._view=null;this._viewModeSnap=null,this._modeTransitionEditorCamera=null,this._saveZoom(),this.requestUpdate()}_prepareModeTransition(e,t,i,n,r,o){this.updateComplete.then(()=>{if(!this.isConnected||e!==this._modeTransitionRequest||this._mode!==i)return void(e===this._modeTransitionRequest&&(this._modeTransitionPreparing=!1,this._modeTransitionVisual=null,this._modeTransitionForceAtomic=!1,this.requestUpdate()));const s=this.renderRoot.querySelector(".editorchrome"),a=s?.querySelector(".editorchrome-inner"),l="view"===i?0:a?.scrollHeight||a?.getBoundingClientRect().height||0,c=Math.max(1,t.stageHeight+t.editorChromeHeight),h=Math.max(1,c-l),d=this._stageEl?.clientWidth||t.stageWidth;if(d<=0||h<=0)return this._modeTransitionPreparing=!1,this._modeTransitionVisual=null,this._applyView(n,r,o),void this.requestUpdate();const u=this._viewForModeTarget(n,r,o,d,h),p={presentedMode:i,editorChromeHeight:l,stageWidth:d,stageHeight:h,viewport:s_(u,d),stageColor:this._targetStageColor(i),paperColor:this._targetPaperColor(i),sceneBrightness:this._targetBrightness(i),architectureOpacity:"decor"===i?.35:1,backdropOpacity:"decor"===i&&"backdrop"!==this._decorTool?.5:1,viewWeight:"view"===i?1:0,editorWeight:"view"===i?0:1,toolbarContentOpacity:"view"===i?0:1};this._modeTransitionPreparing=!1;const _=this._modeTransitionForceAtomic;this._modeTransitionForceAtomic=!1,this._modeTransition.start(t,p,i,this._reducedMotion||_?0:220)})}get _hasFixedFloor(){return!!this._config&&Object.prototype.hasOwnProperty.call(this._config,"floor")}_fixedFloorState(e=this._model,t=this._loadOk){const i=this._config?.floor,n=function(e){if(!e.hasFloor)return{kind:"absent"};const t=e.floor;if("string"==typeof t)return t.length?e.spaceIds.includes(t)?{kind:"valid",id:t,source:"id"}:{kind:"invalid",reason:"unknown-id",value:t}:{kind:"invalid",reason:"empty-id",value:t};if("number"==typeof t){if(!Number.isFinite(t))return{kind:"invalid",reason:"non-finite-index",value:t};if(!Number.isInteger(t))return{kind:"invalid",reason:"fractional-index",value:t};if(t<0)return{kind:"invalid",reason:"negative-index",value:t};const i=e.spaceIds[t];return void 0===i?{kind:"invalid",reason:"out-of-range-index",value:t}:{kind:"valid",id:i,source:"index"}}return{kind:"invalid",reason:"invalid-type",value:t}}({spaceIds:e.map(e=>e.id),hasFloor:this._hasFixedFloor,floor:i});return!this._hasFixedFloor||t?n:"number"==typeof i?"valid"===n.kind||"invalid"===n.kind&&"out-of-range-index"===n.reason?{kind:"pending",value:i}:n:"valid"===n.kind||"invalid"===n.kind&&"unknown-id"!==n.reason?n:{kind:"pending",value:i}}_canCommitSpace(e,t=!1){if(t||!this._hasFixedFloor)return!0;const i=this._fixedFloorState();return"valid"===i.kind&&i.id===e}_commitSpace(e,t=!1){return!!this._canCommitSpace(e,t)&&(e!==this._space&&(this._clearTransientHover(!0),this._cancelDevicePressFeedback()),this._space=e,!0)}_slideTo(e,t){if(e===this._space)return!0;if(!this._canCommitSpace(e))return!1;if(this._wallFaceBatch&&this._roomDialogCancel(),"plan"===this._mode&&"draw"===this._tool&&!this._finishWallChain())return!1;this._cancelModeTransition(!0);const i=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;return this._activeDraftId&&(this._resumeDraftBySpace[this._space]=this._activeDraftId),this._commitSpace(e),this._path=[],this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this._tool="draw",this._activeDraftId=null,this._draftSegmentCms=[],this._closingWallCm=null,this._selId=null,this._physicalSel=null,this._editorSecondary?.closeForNavigation(),this._physicalDialog=null,this._physicalDrag=null,"plan"===this._mode&&"draw"===this._tool&&this._resumeLastDraft(),this._restoreZoom(),i||(this._slide=t,clearTimeout(this._slideTimer),this._slideTimer=window.setTimeout(()=>{this._slideTimer=void 0,this._slide="",this.requestUpdate()},190),this.requestUpdate()),!0}get _canReorderTabs(){return rm({canEdit:this._canEdit,kiosk:this._kiosk,mode:this._mode,pointerType:"mouse",spaceCount:this._model.length,fixedFloor:this._hasFixedFloor})}_tabPointerDown(e,t){rm({canEdit:this._canEdit,kiosk:this._kiosk,mode:this._mode,pointerType:e.pointerType,spaceCount:this._model.length,fixedFloor:this._hasFixedFloor})&&(Tm(e),this._tabDragRelease=e=>this._tabPointerUp(e),window.addEventListener("pointerup",this._tabDragRelease),window.addEventListener("pointercancel",this._tabDragRelease),this._tabDrag={id:t,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:!1,targetId:null,placement:null})}_tabDropTargetAt(e,t,i){const n=this._model.map(e=>e.id),r=n.indexOf(i);if(r<0)return null;const o=this.renderRoot.querySelectorAll('[data-hp="space-tab"]');for(const s of o){const o=s.dataset.id||"";if(!o||o===i)continue;const a=s.getBoundingClientRect();if(e<a.left||e>a.right||t<a.top||t>a.bottom)continue;const l=n.indexOf(o);return l<0?null:{targetId:o,placement:l<r?"before":"after"}}return null}_tabPointerMove(e){const t=this._tabDrag;if(!t||t.pointerId!==e.pointerId)return;if(!(t.moved||(i=e.clientX-t.x,n=e.clientY-t.y,Math.hypot(i,n)>=4)))return;var i,n;const r=this._tabDropTargetAt(e.clientX,e.clientY,t.id);t.moved&&t.targetId===r?.targetId&&t.placement===r?.placement||(this._tabDrag={...t,moved:!0,targetId:r?.targetId||null,placement:r?.placement||null})}_tabPointerUp(e){const t=this._tabDrag;if(t&&t.pointerId!==e.pointerId)return;const i="pointerup"===e.type&&t?.moved?this._tabDropTargetAt(e.clientX,e.clientY,t.id):null;"pointerup"===e.type&&t?.moved&&this._suppressNextTabClick(),this._endTabDrag(),t?.moved&&i&&this._commitTabOrder(t.id,i.targetId)}_endTabDrag(){this._tabDrag=null,this._tabDragRelease&&(window.removeEventListener("pointerup",this._tabDragRelease),window.removeEventListener("pointercancel",this._tabDragRelease),this._tabDragRelease=null)}_tabClick(e){if(this._tabSuppressClick)return this._tabSuppressClick=!1,clearTimeout(this._tabSuppressClickTimer),void(this._tabSuppressClickTimer=void 0);this._pickSpace(e)}_suppressNextTabClick(){this._tabSuppressClick=!0,clearTimeout(this._tabSuppressClickTimer),this._tabSuppressClickTimer=window.setTimeout(()=>{this._tabSuppressClick=!1,this._tabSuppressClickTimer=void 0},0)}_commitTabOrder(e,t){const i=this._serverCfg;if(!i||!this._canReorderTabs)return;const n=this._model.map(e=>e.id),r=function(e,t,i){const n=e.indexOf(t),r=e.indexOf(i);if(n<0||r<0||n===r)return e;const o=e.slice();return o.splice(n,1),o.splice(r,0,t),o}(n,e,t);if(r===n)return;const o=new Map(this._devices.map(e=>[String(e.id),String(e.area||"")])),s=function(e,t,i,n=()=>""){if(!i)return[];const r=[];for(const o of e){if(!o||!0===o.removed)continue;const e="string"==typeof o.id?o.id:"";if(!e)continue;if("string"==typeof o.space&&o.space)continue;const s=("string"==typeof o.area?o.area:"")||n(e)||"";s&&t[s]||r.push({id:e,space:i})}return r}(i.markers||[],Object.fromEntries(Object.entries(this._areaToSpace).map(([e,t])=>[e,t.space])),n[0]||"",e=>o.get(e)||"");if(s.length){const e=new Map(s.map(e=>[e.id,e.space]));for(const t of i.markers||[]){const i=e.get(String(t.id));i&&(t.space=i)}}i.spaces=function(e,t){const i=new Map(t.map((e,t)=>[e,t]));return e.map((e,t)=>({space:e,index:t})).sort((e,t)=>(i.get(String(e.space?.id))??Number.MAX_SAFE_INTEGER)-(i.get(String(t.space?.id))??Number.MAX_SAFE_INTEGER)||e.index-t.index).map(e=>e.space)}(i.spaces||[],r),this._saveConfig(),this._tabOrderWarned||(this._tabOrderWarned=!0,this._showToast(this._t("toast.space_order_changed")))}_pickSpace(e){if(this._endTabDrag(),e===this._space)return;const t=this._model.map(e=>e.id),i=t.indexOf(this._space),n=t.indexOf(e);this._navApplied=!0,this._showFar=!1,this._frame=null,this._slideTo(e,i>=0&&n<i?"right":"left")&&this._saveNav()}_cycleTick(){if(!this._hasFixedFloor&&this._kiosk&&Number(this._config?.cycle)>0&&Date.now()>=this._cyclePausedUntil&&this._model.length>1&&this._zoom<=1.001){const e=this._model.map(e=>e.id),t=e.indexOf(this._space);this._slideTo(e[(t+1)%e.length],"left"),this._showKioskDots()}}_syncCycleTimer(){clearInterval(this._cycleTimer),this._cycleTimer=void 0,this.isConnected&&!this._hasFixedFloor&&this._config?.kiosk&&Number(this._config.cycle)>0&&(this._cycleTimer=window.setInterval(()=>this._cycleTick(),1e3*Number(this._config.cycle)))}get _editing(){return"plan"===this._mode||"devices"===this._mode||"decor"===this._mode}get _markup(){return"plan"===this._mode}get _wallUnionCache(){return this._wallUnionCacheValue}set _wallUnionCache(e){this._wallUnionCacheValue=e,null===e&&this._wallUnionPool.clear()}_newContinuityController(){return new Ml(()=>{this._resumeSettling="steady"!==this._continuity.state,this._continuityEpoch++,this.isConnected&&this.requestUpdate()})}get _labsIso(){return this._labs.active.includes("iso")}get _desiredProjection(){return"view"===this._mode&&this._labsIso&&"iso"===this._viewPreference[this._space]?"iso":"flat"}_saveViewPreference(){try{localStorage.setItem(ym,JSON.stringify(this._viewPreference))}catch{}}_logicalViewCenter(e){const t=this._view;if(!t)return null;const i=[t.x+t.w/2,t.y+t.h/2],n="iso"===e?P_(i):i;return{x:n[0],y:n[1]}}_convertProjectionView(e,t){if(e===t)return;const i=this._logicalViewCenter(e);this._view=null;const n=i?"iso"===t?z_([i.x,i.y],0):[i.x,i.y]:null;this._applyView(this._zoom,n?.[0],n?.[1]),this._warmPatch({vp:this._warmViewportState()}),this.requestUpdate()}_setProjection(e){if(!this._labsIso||"view"!==this._mode)return;const t=this._effectiveProjection();if(this._viewPreference={...this._viewPreference,[this._space]:e},"iso"===e){const e=this._isoSceneKey();e&&this._isoFallback.delete(e)}this._saveViewPreference();const i=this._effectiveProjection();this._convertProjectionView(t,i)}_hashSpace(){return b_(window.location.hash||"")}connectedCallback(){this._connectedPath=location.pathname,this._routeDepartureHandled=!1,window.addEventListener("location-changed",this._onLocationChanged),window.addEventListener("popstate",this._onLocationChanged),this._continuityDisposed&&(this._continuity=this._newContinuityController(),this._continuityDisposed=!1,this._continuityPaintToken=-1);const e=(t=this.ownerDocument,Qp.get(t)?.resolved);var t;void 0!==e&&(this._glowScreenBlend=e),this._continuityUnsub?.(),this._continuityUnsub=$l(this.ownerDocument,this._pageVisibility),super.connectedCallback(),this._pointerModality.connect(this.ownerDocument.defaultView);const i=this.ownerDocument.defaultView?.MutationObserver;i&&(this._pointerHoverObserver=new i(e=>{for(const t of e)for(const e of t.addedNodes)this._syncPointerHoverSubtree(e)}),this._pointerHoverObserver.observe(this.renderRoot,{childList:!0,subtree:!0})),this._motionMedia=window.matchMedia?.("(prefers-reduced-motion: reduce)"),this._reducedMotion=!!this._motionMedia?.matches,this._motionMedia?.addEventListener?.("change",this._onMotionChange),function(e){const t=Qp.get(e);if(t)return t.promise;const i={promise:Promise.resolve(!1)};return i.promise=t_(e).catch(()=>!1).then(e=>(i.resolved=e,e)),Qp.set(e,i),i.promise}(this.ownerDocument).then(e=>{e!==this._glowScreenBlend&&(this._glowScreenBlend=e,this.isConnected&&this.requestUpdate())}),this.hass&&this._ensureHaRegistryAuthority(),window.addEventListener("keydown",this._keyHandler),this._signer.start(()=>this.hass,()=>Sn(this._serverCfg)),this._syncCycleTimer(),window.addEventListener("hashchange",this._onHashChange),this._labsUnsub?.(),this._labsUnsub=function(e,t){R_.add(t);const i=D_(e);return"undefined"==typeof window&&t(i),()=>{R_.delete(t)}}(om,this._onLabsSnapshot),this._booting?this._bootWatch():this._bootFading&&(clearTimeout(this._bootTimer),this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220)),this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},am)),!this._loadOk&&this._serverCfg&&this.hass&&this._scheduleLoadRetry(),!this._warmSlot&&this._config&&this._warmAdopt(),this._loadOk&&this._ensureLiveSyncSubscriptions(),this._warmVp&&!this._warmRevivePending&&void 0===this._warmReviveTimer&&(this._warmRevivePending=!0,this._warmReviveTimer=window.setTimeout(()=>this._warmReviveDialog(),0)),this._warmLongReturn&&this._beginResumeSettle(),this._warmLongReturn=!1,this.requestUpdate()}disconnectedCallback(){this._connectedPath&&location.pathname!==this._connectedPath&&this._leaveCardRoute(),window.removeEventListener("location-changed",this._onLocationChanged),window.removeEventListener("popstate",this._onLocationChanged),this._continuityUnsub?.(),this._continuityUnsub=void 0,this._motionMedia?.removeEventListener?.("change",this._onMotionChange),this._motionMedia=void 0,this._vacRaf&&(cancelAnimationFrame(this._vacRaf),this._vacRaf=0),this._refitRaf&&(cancelAnimationFrame(this._refitRaf),this._refitRaf=0),this._warmModeRequest=0,this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0),this._dayCycleClockKey="",this._bootSettleRaf&&(cancelAnimationFrame(this._bootSettleRaf),this._bootSettleRaf=0),this._bootSettling=!1;for(const e of this._activityRt.values())clearTimeout(e.timer);window.removeEventListener("keydown",this._keyHandler),this._endTabDrag(),clearTimeout(this._tabSuppressClickTimer),this._tabSuppressClickTimer=void 0,this._tabSuppressClick=!1,clearInterval(this._cycleTimer),clearTimeout(this._kioskDotsTimer),clearTimeout(this._kioskHoldTimer),clearTimeout(this._reloadRetry),clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),this._connHooked=null,this._haRegistryRelease?.(),this._haRegistryRelease=void 0,this._haRegistryConnection=null,this._signer.dispose(),clearTimeout(this._toastTimer),clearTimeout(this._slideTimer),clearTimeout(this._editorRuntimeLoadingTimer),this._editorRuntimeLoadingTimer=void 0,this._editorRuntimeLoadingVisible=!1,this._modeTransition.dispose(),this._modeTransitionVisual=null,this._modeTransitionPreparing=!1,this._modeTransitionForceAtomic=!1,this._modeTransitionRequest++,this._slideTimer=void 0,this._slide="",clearTimeout(this._bootTimer),this._bootTimer=void 0,clearTimeout(this._bootSoftTimer),this._saveConfigDebounced.flush(),window.removeEventListener("hashchange",this._onHashChange),this._labsUnsub?.(),this._labsUnsub=void 0,clearTimeout(this._holdTimer),this._roViewport?.disconnect(),this._roViewport=void 0,this._roHdr?.disconnect(),this._roHdr=void 0,this._onWinResize&&(window.removeEventListener("resize",this._onWinResize),this._onWinResize=void 0),this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),this._unsubLayout&&(this._unsubLayout(),this._unsubLayout=null),this._unsubVirtual&&(this._unsubVirtual(),this._unsubVirtual=null),this._unsubTrail&&(this._unsubTrail(),this._unsubTrail=void 0),this._liveSyncGeneration++,this._liveSyncAttempt=null,this._liveSyncConnection=null,clearTimeout(this._layoutSyncTimer),clearTimeout(this._duplicateColumnTimer);for(const e of this._glowFadeTimers.values())clearTimeout(e);for(const e of this._glowEnterRafs.values())cancelAnimationFrame(e);clearTimeout(this._glowFeatherResumeTimer),this._glowFeatherResumeTimer=0,this._glowFeatherSuspendUntil=0,this._glowFadeTimers.clear(),this._glowEnterRafs.clear(),this._glowEnteringSources.clear(),this._glowRenderedSources.clear(),this._glowLastAppearance.clear(),this._glowSourceSeq=0,this._warmSnapshot(),this._warmRevivePending=!1,clearTimeout(this._warmReviveTimer),this._warmReviveTimer=void 0,this._warmRelease(),this._clearPlanSnapHover(),this._clearOpeningPlacement(!0),this._touchContacts.clear(),this._touchSequenceMultitouch=!1,this._touchClickBlockUntil=0,this._clearTransientHover(!0),this._cancelDevicePressFeedback(),this._pointerHoverObserver?.disconnect(),this._pointerHoverObserver=void 0,this._pointerModality.disconnect(),this._editorSecondary?.reset(),this._resumeSettling=!1,this._continuityHistory=[...this._continuityHistory,...this._continuity.trace].slice(-80),this._continuity.dispose(),this._continuityDisposed=!0,super.disconnectedCallback()}_onKey(e){if("Escape"===e.key&&this._vacFit)return this._vacFit=null,this._showToast(this._t("vac.cal_cancelled")),void e.stopPropagation();if("Escape"===e.key){if(this._tapConfirm)return void(this._tapConfirm=null);if(this._vacCalConfirm)return void(this._vacCalConfirm=null);if(this._decorEraseConfirm)return void(this._decorEraseConfirm=null);if(this._openingInfo)return void(this._openingInfo=null);if(this._infoCard)return void this._closeInfoCard();if(this._rulesDialog)return void(this._rulesDialog=null);if(this._alignDialog)return this._alignDialog=null,void(this._preflightClipboardFallback=null);if(this._backupImportDialog)return void(this._backupImportDialog=null);if(this._backupExportDialog)return void(this._backupExportDialog=null);if(this._settingsDialog)return void(this._settingsDialog=null);if(this._markerDialog)return void this._closeMarkerDialog();if(this._deviceInbox)return void(this._deviceInbox=null);if(this._openingDialog)return void(this._openingDialog=null);if(this._physicalDialog)return void(this._physicalDialog=null);if(this._backdropDialog)return void(this._backdropDialog=null);if(this._decorShapeDialog)return void(this._decorShapeDialog=null);if(this._decorTextDialog)return void(this._decorTextDialog=null);if(this._spaceDialog&&!this._roomDialog)return this._spaceDialog=null,this._importQueue=[],void(this._importTotal=0);if(this._editorSecondary?.hasOpenGroup)return e.preventDefault(),void this._editorSecondary?.closeGroup(!0)}const t=e.composedPath?.()||[e.target],i=t.some(e=>e?.matches?.('input, textarea, select, [contenteditable="true"]')),n=t.some(e=>e?.classList?.contains?.("editor-secondary")),r=e.ctrlKey||e.metaKey,o=e.key.toLowerCase(),s=/^[a-z]$/.test(o),a="z"===o||!s&&"KeyZ"===e.code,l="y"===o||!s&&"KeyY"===e.code,c=r&&(a&&e.shiftKey||l),h=r&&a&&!e.shiftKey;if("decor"===this._mode){if((h||c)&&i)return;return c?(e.preventDefault(),void this._redoGeometry()):h?(e.preventDefault(),this._decorDraft?void(this._decorDraft=null):this._decorMove||this._dtDrag||this._bdDrag?void this._cancelDecorGesture():void this._undoGeometry()):"Delete"!==e.key&&"Backspace"!==e.key||!this._decorSel||i||n?void("Escape"===e.key&&(e.preventDefault(),this._decorDraft?this._decorDraft=null:this._decorMove||this._dtDrag||this._bdDrag?this._cancelDecorGesture():"furniture"===this._decorTool?(this._furnPalette=null,this._decorTool="select"):this._decorSel?this._decorSel=null:"select"!==this._decorTool?this._decorTool="select":this._setMode("view"))):(e.preventDefault(),void this._decorDeleteSel())}if(this._markup&&(!h&&!c||!i)){if(("Delete"===e.key||"Backspace"===e.key)&&this._physicalSel&&!i&&!n)return e.preventDefault(),void this._deletePhysicalSelection();if(c)return e.preventDefault(),void this._redoGeometry();if(h)return e.preventDefault(),this._resize?.dragging?void this._rszCancelDrag():this._wallFaceBatch?(this._roomDialogCancel(),void(this._activeDraftId&&this._path.length>1?this._undoActiveDraftPoint():this._undoPoint())):"draw"===this._tool&&this._path.length?void(this._activeDraftId&&this._path.length>1?this._undoActiveDraftPoint():this._undoPoint()):"split"===this._tool&&this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},void(this._splitSel.pts.length||(this._cursorPt=null))):void this._undoGeometry();if("Escape"===e.key)return this._physicalDrag||this._physicalRotate?(e.preventDefault(),void this._cancelPhysicalGesture()):this._roomDialog?(e.preventDefault(),void this._roomDialogCancel()):"draw"===this._tool&&this._path.length?(e.preventDefault(),void this._finishWallChain()):this._physicalSel?(e.preventDefault(),void(this._physicalSel=null)):"resize"===this._tool?(e.preventDefault(),this._resize?.dragging?void this._rszCancelDrag():("exit-tool"===this._resize?.escapeIdle()&&(this._tool="draw"),void this.requestUpdate())):"split"===this._tool?(e.preventDefault(),void(this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},this._splitSel.pts.length||(this._cursorPt=null)):this._splitSel?this._splitSel=null:this._tool="draw")):"merge"===this._tool?(e.preventDefault(),void(this._mergeSel?this._mergeSel=null:this._tool="draw")):this._wallDialog?(e.preventDefault(),void(this._wallDialog=null)):void("opening"!==this._tool&&"wallthick"!==this._tool&&"delroom"!==this._tool&&"column"!==this._tool||(e.preventDefault(),"opening"===this._tool&&this._clearOpeningPlacement(!0),this._tool="draw"))}}_undoPoint(){if(this._path.length){if(this._contourClosed)return this._path=this._path.slice(0,-1),void(this._closingWallCm=null);if(this._activeDraftId&&this._path.length>1&&this._curSpaceCfg){const e=this._geometrySnapshot();this._path=this._path.slice(0,-1),this._draftSegmentCms=this._draftSegmentCms.slice(0,-1);const t=this._curSpaceCfg,i=(t.room_drafts||[]).findIndex(e=>e.id===this._activeDraftId);if(i>=0){const n=Array.isArray(t.room_drafts[i]?.segments)?t.room_drafts[i].segments:[];this._path.length<2?(t.room_drafts.splice(i,1),t.room_drafts.length||delete t.room_drafts,this._activeDraftId=null):t.room_drafts[i]={id:this._activeDraftId,points:this._path.map(e=>[e[0]/wm,e[1]/wm]),segments:this._draftSegmentCms.map((e,t)=>({...n[t]||{},cm:e}))},this._commitPhysicalGeometry(this._t("history.draft_segment_delete"),e)}return}this._path=this._path.slice(0,-1)}}_undoActiveDraftPoint(){const e=this._activeDraftId,t=this._path[0]?[...this._path[0]]:null,i=this._geometryHistory.undo();if(!i)return void this._undoPoint();if(!this._applyGeometryState(i.before,!0))return void this._geometryHistory.clear();const n=e?this._spaceModel()?.room_drafts.find(t=>t.id===e):null;n?(this._activeDraftId=n.id,this._path=n.points.map(e=>[...e]),this._draftSegmentCms=this._adoptDraftCms(this._path,n.segments.map(e=>e.cm),n.id),this._resumeDraftBySpace[this._space]=n.id):(this._activeDraftId=null,this._path=t?[t]:[],this._draftSegmentCms=[],e&&this._resumeDraftBySpace[this._space]===e&&delete this._resumeDraftBySpace[this._space]),this._clearPlanSnapHover(),this._showToast(this._t("history.undone",{name:i.name}))}static async getConfigElement(){return await import("./editor-CuIzAluZ.js"),document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card"}}static _warmBootReset(e){for(const e of hm.values())for(const t of e)clearTimeout(t.evict);hm.clear(),pm=e&&e>0?e:1e4}static _warmBootStats(){let e=0,t=0;const i=[];for(const n of hm.values())for(const r of n)e++,r.dlg&&(t++,i.push(r.dlg.kind));return{keys:hm.size,slots:e,dlgs:t,drafts:i}}setConfig(e){const t=this._config,i=!!t&&Object.prototype.hasOwnProperty.call(t,"floor");this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...e};(i!==this._hasFixedFloor||t?.floor!==this._config.floor)&&(this._hashApplied=!1,this._navApplied=!1,this._warmVpArmed=!1),this._config.kiosk&&(this._booting=!1,this._bootFading=!1),!this._hasFixedFloor&&e.default_floor&&this._commitSpace(e.default_floor,!0);try{this._zoomBySpace=JSON.parse(localStorage.getItem(gm)||"{}")||{}}catch{this._zoomBySpace={}}try{const e=JSON.parse(localStorage.getItem(ym)||"{}")||{};this._viewPreference=Object.fromEntries(Object.entries(e).filter(e=>"flat"===e[1]||"iso"===e[1]))}catch{this._viewPreference={}}this._labs=D_(om);try{const e=JSON.parse(localStorage.getItem(vm)||"null");this._kioskScale={icon:Dn(e?.icon),font:Dn(e?.font)}}catch{}try{const e=JSON.parse(localStorage.getItem(mm)||"null");e&&e.config&&Array.isArray(e.config.spaces)&&(this._serverCfg=e.config,this._cfgEpoch++,this._cfgRev=e.rev||0,this._cfgContentFingerprint=e.config_fingerprint||Rl(e.config),this._layout=e.layout||{},this._layoutRev=e.layout_rev||0,this._layoutContentFingerprint=e.layout_fingerprint||Rl(this._layout),this._virtualLights=Cc(e.virtual_lights,this._cfgRev),this._serverStorage=!0)}catch{}this._adoptInitialSpace(this._model,this._loadOk),"view"!==this._mode||this._view||(this._zoom=this._zoomBySpace[this._space]||1),this.isConnected&&(this._syncCycleTimer(),this._warmAdopt(),this._warmLongReturn&&this._beginResumeSettle(),this._warmLongReturn=!1)}_warmAdopt(){if(this._config?.kiosk)return;const e=um(this._config);if(this._warmKey===e&&this._warmSlot)return;this._warmSlot&&this._warmRelease();const t=this.parentNode,i=this._warmIdx(t),n=hm.get(e);if(!n||!n.length)return;const r=n.find(e=>e.owner===this._warmGen);if(r)return this._warmLongReturn=!!r.freed&&Date.now()-r.freed>=wl,clearTimeout(r.evict),r.evict=0,r.freed=0,r.live=!0,this._warmSlot=r,this._warmKey=e,r.frameFingerprint&&this._continuity.adoptCompleteFrame(r.frameFingerprint),void(!this._devices.length&&r.devices?.length&&(this._devices=[...r.devices]));const{slot:o,sure:s}=((e,t,i,n)=>{const r=e=>{const t=!!i&&e.place?.deref()===i;return t&&e.idx===n?4:e.live?0:t?3:2};let o=null,s=0,a=0,l=null;for(const i of e){if(i.owner===t)continue;l=i;const e=r(i);e<=0||(e>s?(o=i,s=e,a=1):e===s&&a++)}return!o||a>1?{slot:o||l,sure:!1}:{slot:o,sure:!0}})(n,this._warmGen,t,i);o&&(this._warmLongReturn=!!o.freed&&Date.now()-o.freed>=wl,this._booting=!1,this._bootFading=!1,this._hdrH=o.hdrH,this._bootSoft=!0,this.isConnected&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},am)),this._warmKey=e,s?(clearTimeout(o.evict),o.evict=0,o.owner=this._warmGen,o.place=t?new WeakRef(t):null,o.idx=i,o.live=!0,this._warmSlot=o,this._warmVp=o.vp,o.frameFingerprint&&this._continuity.adoptCompleteFrame(o.frameFingerprint),!this._devices.length&&o.devices?.length&&(this._devices=[...o.devices]),this._warmAdoptViewport(this._config)):(this._warmSlot={owner:this._warmGen,path:location.pathname,place:t?new WeakRef(t):null,idx:i,live:!0,hdrH:o.hdrH,stageH:o.stageH,vp:null,frameFingerprint:"",devices:null,dlg:null,freed:0,evict:0},n.push(this._warmSlot),this._warmTrim(n)))}_warmIdx(e){const t=e?.children;if(!t)return-1;for(let e=0;e<t.length;e++)if(t[e]===this)return e;return-1}_warmRelease(){const e=this._warmSlot,t=this._warmKey;this._warmSlot=null,this._warmKey=null,e&&t&&(e.freed=Date.now(),e.owner===this._warmGen&&(e.live=!1),this._warmScheduleEvict(e,t))}_warmTrim(e){for(;e.length>4;){const t=e.findIndex(e=>!e.live);if(t<0)break;clearTimeout(e[t].evict),e.splice(t,1)}}_warmScheduleEvict(e,t){if(clearTimeout(e.evict),!(e.dlg||e.vp&&"view"!==e.vp.mode))return;const i=e.freed,n=e.owner;e.evict=window.setTimeout(()=>{if(e.evict=0,e.freed!==i||e.owner!==n)return;var r;e.dlg=null,e.vp=(r=e.vp)&&"view"!==r.mode?{...r,mode:"view",zoom:r.snap?.space===r.space?r.snap.zoom:r.zoom,view:null,snap:null,tool:"draw",decorTool:"select",showHidden:!1,selId:null,rszSel:null,decorSel:null}:r,e.frameFingerprint="";const o=hm.get(t);if(!e.live&&o&&o.length>1){const t=o.indexOf(e);t>=0&&o.splice(t,1)}},pm+250)}_warmAdoptViewport(e){const t=this._warmVp;if(!t||this._warmSlot?.path!==location.pathname)return void(this._warmVp=null);const i=this._fixedFloorState();if(this._hashApplied||!this._model.find(e=>e.id===t.space)||"valid"===i.kind&&i.id!==t.space||this._hasFixedFloor&&"valid"!==i.kind)return void(this._warmVp=null);this._commitSpace(t.space,!0),this._navApplied=!0;const n="view"!==t.mode&&this._canEdit&&!e.kiosk?t.mode:"view";this._adoptMode("view"),this._pendingNavMode="view"===t.mode||this._canEdit||e.kiosk?null:t.mode,this._zoom=t.zoom;const r=this._effectiveProjection(),o=r===t.projection&&this._labsIso===t.activeLabsIso;if(this._view=o&&t.view?{...t.view}:null,this._viewModeSnap=o&&t.snap?{...t.snap}:null,!o&&t.logicalCenter){const e="iso"===r?z_([t.logicalCenter.x,t.logicalCenter.y],0):[t.logicalCenter.x,t.logicalCenter.y];this._applyView(t.zoom,e[0],e[1])}var s;this._tool="opening"===(s=function(e){return"partition"===e?"draw":e}(s=t.tool))?"draw":"string"==typeof s&&$m.has(s)?s:"draw",this._decorTool=t.decorTool,this._showHidden=t.showHidden,this._showFar!==t.showFar&&(this._showFar=t.showFar,this._frame=null),this._selId=t.selId,this._resize?.restoreSelection(t.rszSel),this._decorSel=t.decorSel,this._warmVpArmed=!0,"view"!==n&&this._requestMode(n,!1,!0)}_warmPatch(e,t=!1){if(this._config?.kiosk)return;const i=um(this._config);if(!this._warmSlot||this._warmKey===i){if(!this._warmSlot){if(!t)return;const e=this.parentNode;this._warmKey=i,this._warmSlot={owner:this._warmGen,path:location.pathname,place:e?new WeakRef(e):null,idx:this._warmIdx(e),live:!0,hdrH:this._hdrH,stageH:0,vp:null,frameFingerprint:"",devices:null,dlg:null,freed:0,evict:0};const n=hm.get(i)||[];for(n.push(this._warmSlot),hm.set(i,n),this._warmTrim(n);hm.size>8;){const e=hm.keys().next().value;if(void 0===e||e===i)break;for(const t of hm.get(e)||[])clearTimeout(t.evict);hm.delete(e)}}Object.assign(this._warmSlot,e)}}_warmViewportState(){const e=this._effectiveProjection();return{space:this._space,mode:this._mode,projection:e,activeLabsIso:this._labsIso,logicalCenter:this._logicalViewCenter(e),zoom:this._zoom,view:this._view?{...this._view}:null,snap:this._viewModeSnap?{...this._viewModeSnap}:null,tool:this._tool,decorTool:this._decorTool,showHidden:this._showHidden,showFar:this._showFar,selId:this._selId,rszSel:this._resize?.selectedRoomId,decorSel:this._decorSel}}_warmDialogState(){const e=(e,t)=>({kind:e,space:this._space,mode:this._mode,data:t});return this._tapConfirm||this._alignDialog||this._mergeDialog||this._importDialog||this._backupExportDialog||this._backupImportDialog?null:this._openingInfo?e("openingInfo",this._openingInfo.id):this._infoCard?e("info",this._infoCard.id):this._rulesDialog?this._rulesDialog.busy?null:e("rules",this._rulesDialog):this._settingsDialog?this._settingsDialog.busy?null:e("settings",this._settingsDialog):this._markerDialog?this._markerDialog.busy?null:e("marker",this._markerDialog):this._openingDialog?e("opening",this._openingDialog):this._backdropDialog?e("backdrop",this._backdropDialog):this._decorShapeDialog?e("decorShape",this._decorShapeDialog):this._decorTextDialog?e("decorText",this._decorTextDialog):this._roomDialog?e("room",{editId:this._roomEditId,fill:this._roomFill,customFill:this._roomCustomFill,tempSrc:this._roomTempSrc,humSrc:this._roomHumSrc,srcOpen:this._roomSrcOpen,srcFilter:this._roomSrcFilter,nameScale:this._roomNameScale,labelScale:this._roomLabelScale,areaSel:this._areaSel,nameSel:this._nameSel,pendingSplit:this._pendingSplit,wallFaceBatch:this._wallFaceBatch,path:this._path}):this._spaceDialog?this._spaceDialog.busy?null:e("space",this._spaceDialog):null}_warmSnapshot(){if(this._booting||this._config?.kiosk||"steady"!==this._continuity.state)return;const e={vp:this._warmViewportState(),frameFingerprint:this._continuity.frameFingerprint,devices:this._devices};if(this._warmRevivePending||(e.dlg=this._warmDialogState()),this.isConnected&&this._warmSlot?.owner===this._warmGen){const t=this.parentNode;e.place=t?new WeakRef(t):null,e.idx=this._warmIdx(t)}this._warmPatch(e)}_warmReviveDialog(){const e=this._warmSlot;if(this._warmReviveTimer=void 0,!e||!e.dlg)return void(this._warmRevivePending=!1);const t=e.dlg,i=e.freed;if(t.mode===this._mode||"view"===t.mode||this._warmVp?.mode!==t.mode||this._editorRuntime){if(this._warmRevivePending=!1,e.dlg=null,e.freed=0,clearTimeout(e.evict),e.evict=0,i&&!(Date.now()-i>pm)&&t.space===this._space&&t.mode===this._mode){switch(t.kind){case"space":this._spaceDialog={...t.data,busy:!1,savedBusy:!1};break;case"marker":this._markerDialog={...t.data,busy:!1};break;case"settings":this._settingsDialog={...t.data,busy:!1};break;case"rules":this._rulesDialog={...t.data,busy:!1};break;case"opening":this._openingDialog={...t.data};break;case"backdrop":this._backdropDialog={...t.data};break;case"decorShape":this._decorShapeDialog={...t.data};break;case"decorText":{this._decorTextDialog={...t.data};const e=String(this._decorTextDialog?.text??"").length;this._decorTextSelection={start:e,end:e};break}case"room":{const e=t.data;this._roomEditId=e.editId,this._roomFill=e.fill,this._roomCustomFill=e.customFill||null,this._roomTempSrc=e.tempSrc,this._roomHumSrc=e.humSrc,this._roomSrcOpen=e.srcOpen,this._roomSrcFilter=e.srcFilter,this._roomNameScale=e.nameScale,this._roomLabelScale=e.labelScale,this._areaSel=e.areaSel,this._nameSel=e.nameSel,this._pendingSplit=e.pendingSplit,this._wallFaceBatch=e.wallFaceBatch||null,this._path=e.path,this._wallFaceBatch&&(this._activeDraftId=this._wallFaceBatch.activeDraftId,this._draftSegmentCms=[...this._wallFaceBatch.activeCms]),this._roomDialog=!0;break}case"info":{const e=this._devices.find(e=>e.id===t.data);e&&(this._infoCard=e);break}case"openingInfo":{const e=(this._curSpaceCfg?.openings||[]).find(e=>e.id===t.data);e&&(this._openingInfo=e);break}}this.requestUpdate()}}else this._warmRevivePending=!0}_cacheSnapshot(){if(this._serverCfg)try{this._cfgContentFingerprint=Rl(this._serverCfg),this._layoutContentFingerprint=Rl(this._layout),this._virtualLights=function(e,t,i){if(e.configRev===i)return e;const n=new Set((Array.isArray(t?.markers)?t.markers:[]).filter(zc).map(e=>e.id));return{...e,configRev:i,off:new Set([...e.off].filter(e=>n.has(e)))}}(this._virtualLights,this._serverCfg,this._cfgRev),localStorage.setItem(mm,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,config_fingerprint:this._cfgContentFingerprint,layout:this._layout,layout_rev:this._layoutRev,layout_fingerprint:this._layoutContentFingerprint,virtual_lights:Ac(this._virtualLights)}))}catch{}}_beginContinuityCandidate(e,t,i="plan"){return this._booting&&!this._continuity.hasCompleteFrame?this._continuity.token:(this._continuityDataReady=t,this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._resumeSettling=!0,this._continuity.beginCandidate(e,i))}_continuityStageValid(){const e=this._stageEl;return!!e&&e.clientWidth>0&&e.clientHeight>0}_continuityAssetsReady(){if(!this._model.length)return!1;const e=this._model.length?this._spaceModel():null;return!e?.bg?.href||this._signer.isReady(this.hass,e.bg.href)}_initialSpaceSelection(e,t=this._loadOk){const i=this._fixedFloorState(e,t);return"valid"===i.kind?{id:i.id,source:"fixed"}:this._hasFixedFloor?{id:null,source:"none"}:function(e){const t=new Set(e.spaceIds.filter(e=>!!e));if(!t.size)return{id:null,source:"none"};const i=[["hash",!1===e.acceptHash?null:e.hashSpace],["current",e.preserveCurrent?e.currentSpace:null],["saved",e.savedSpace],["default",e.defaultSpace],["first",e.spaceIds[0]]];for(const[e,n]of i)if(n&&t.has(n))return{id:n,source:e};return{id:null,source:"none"}}({spaceIds:e.map(e=>e.id),hashSpace:this._hashSpace(),acceptHash:!this._hashApplied,currentSpace:this._space,preserveCurrent:this._hashApplied||this._navApplied||this._warmVpArmed,savedSpace:this._savedNav()?.space,defaultSpace:this._config?.default_floor})}_adoptInitialSpace(e,t=this._loadOk){const i=this._initialSpaceSelection(e,t);return i.id?(this._commitSpace(i.id,!0),"hash"===i.source&&(this._hashApplied=!0),"saved"===i.source&&(this._navApplied=!0),i):i}_candidateBackdrop(e,t=this._space){const i=za(e),n=this._fixedFloorState(i,!0);if(this._hasFixedFloor&&"valid"!==n.kind)return"";const r=this._initialSpaceSelection(i,!0).id||(i.some(e=>e.id===t)?t:i[0]?.id);return i.find(e=>e.id===r)?.bg?.href||""}_visualFrameFingerprint(){const e=this._stageEl,t=e?[e.clientWidth,e.clientHeight]:[0,0];return Tl([this._cfgRev,this._cfgContentFingerprint||Rl(this._serverCfg),this._layoutRev,this._layoutContentFingerprint||Rl(this._layout),this._space,this._mode,this._view,t,this._glowScreenBlend?"screen":"normal",this.hass?.themes?.darkMode??this.hass?.themes?.default_theme??""])}_settleContinuityFrame(){if(this._booting||!this._continuityStageValid())return;if(!this._continuity.hasCompleteFrame&&"steady"===this._continuity.state)return void(this._continuityAssetsReady()&&(this._renderSnapshotAt=Date.now(),this._continuity.markCompleteFrame(this._visualFrameFingerprint())));if(!this._continuityDataReady)return;if(!["holding","offline-stale","overlay-pending","overlay-visible","candidate-ready"].includes(this._continuity.state))return;const e=this._continuity.token;if(this._candidateDeviceSnapshot&&this._candidateDeviceSnapshot!==this._visibleDeviceSnapshot&&this._stagedDeviceSnapshotToken!==e)return this._stagedDeviceSnapshotToken=e,void this.requestUpdate();this._continuityPaintToken!==e&&(this._continuityPaintToken=e,this._continuity.candidateReady(e)&&this._continuity.commitAfterPaint(e,{updateComplete:()=>this.updateComplete,stageValid:()=>this.isConnected&&this._continuityStageValid(),assetsReady:()=>this._continuityAssetsReady(),frameFingerprint:()=>this._visualFrameFingerprint()}).then(t=>{t&&e===this._continuity.token?(this._resumeSettling=!1,this._renderSnapshotAt=Date.now(),this._candidateDeviceSnapshot&&(this._visibleDeviceSnapshot=this._candidateDeviceSnapshot),this._candidateDeviceSnapshot=null,this._stagedDeviceSnapshotToken=-1,this._warmSnapshot()):e===this._continuity.token&&(this._continuityPaintToken=-1,this._stagedDeviceSnapshotToken=-1,this._candidateDeviceSnapshot=null,this.requestUpdate())}))}_onBackdropLoaded(e,t){this._signer.markLoaded(this.hass,e,t),this._continuity.note("asset-ready"),this._continuityPaintToken=-1,"steady"!==this._continuity.state&&this.requestUpdate()}_renderRecoveryOverlay(){if(!this._continuity.overlayVisible&&"recovery-error"!==this._continuity.state)return G;const e="connection"===this._continuity.recoveryReason;return B`<div class="recoveryoverlay phase-${this._continuity.overlayPhase}"
      role="status" aria-live="polite" aria-atomic="true"
      @pointerdown=${e=>e.stopPropagation()}
      @click=${e=>e.stopPropagation()}
      @wheel=${e=>e.stopPropagation()}>
        <ha-icon icon="mdi:home-sync-outline"></ha-icon>
        <span>${this._t(e?"continuity.restore_connection":"continuity.restore_plan")}</span>
        ${"recovery-error"===this._continuity.state?B`<button class="btn on" @click=${this._retryContinuity}>${this._t("continuity.retry")}</button>`:G}
      </div>`}_renderEditorRuntimeLoading(){return this._editorRuntimeLoadingVisible?B`<div class="editorloading" role="status" aria-live="polite"
      aria-label=${this._t("editor.loading_aria")}>
        <ha-icon icon="mdi:loading"></ha-icon>
        <span>${this._t("editor.loading")}</span>
      </div>`:G}houseplanContinuityTrace(){return[...this._continuityHistory,...this._continuity.trace].slice(-80).map(e=>({...e,...e.stage?{stage:[...e.stage]}:{}}))}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}_cfgFingerprint(){const e=this._serverCfg?.spaces||[];let t=e.length+":";for(const i of e){t+=(i.id||"")+","+(i.plan_aspect||"")+","+(i.plan_url||"").length+","+(i.plan_x??"")+","+(i.plan_y??"")+","+(i.plan_scale??"")+","+(i.plan_scale_x??"")+","+(i.plan_scale_y??"")+","+(i.plan_angle??"")+","+(i.rooms?.length||0)+","+(i.openings?.length||0)+","+(i.decor?.length||0)+";";for(const e of i.rooms||[]){const i=e.poly?.[0],n=e.poly?.[e.poly.length-1];t+=(e.poly?.length||0)+"."+(e.id||"")+"."+(e.open_to||[]).join("+")+"."+(e.area||"")+"."+JSON.stringify(e.settings||0)+"."+(e.x??"")+","+(e.y??"")+","+(e.w??"")+","+(e.h??"")+","+(i?i[0]+"/"+i[1]:"")+","+(n?n[0]+"/"+n[1]:"")+";"}}return t}get _model(){if(!this._serverCfg)return[];const e=this._cfgEpoch+"|"+this._cfgFingerprint();if(this._modelCache&&this._modelCache.key===e)return this._modelCache.model;const t=this._buildModel();return this._modelCache={key:e,model:t},t}_buildModel(){if(!this._serverCfg)return[];const e=this._renderCfg;return za(e).map((t,i)=>{const n=e.spaces[i]?.plan_url;return t.bg&&n?{...t,bg:{...t.bg,href:n}}:t})}_spaceModel(){return this._hasFixedFloor?Al(this._model,this._space):(e=this._model,t=this._space,e.find(e=>e.id===t)??e[0]);var e,t}_spaceModelById(e){return Al(this._model,e)}_syncEmptySpaceState(){if(!!this._serverCfg&&0===this._serverCfg.spaces.length){if(!this._emptySpaceStateActive){this._emptySpaceStateActive=!0;for(const e of this._pointers.keys())for(const t of this.renderRoot.querySelectorAll("*"))try{t.hasPointerCapture?.(e)&&t.releasePointerCapture(e)}catch{}this._pointers.clear(),this._panStart=null,this._panLock=null,this._pinchStart=null,this._swipeStart=null,this._drag=null,this._rlResize=null,this._vacFit=null,this._compassDrag=!1,this._cancelModeTransition(!1),this._mode="view",this._clearGeometryGesture(),this._geometryHistory.clear(),this._resumeDraftBySpace={},this._tip=null,this._hoverRoom=null,this._openingInfo=null,this._closeInfoCard(),this._deviceInbox=null,this._deviceInboxReturn=null,this._markerDialog=null,this._physicalDialog=null,this._backdropDialog=null,this._decorShapeDialog=null,this._decorTextDialog=null,this._roomDialog=!1,"edit"===this._spaceDialog?.mode&&(this._spaceDialog=null),this._editorSecondary?.closeForNavigation(),this._saveConfigDebounced.cancel(),this._frame=null,this._planSnapGeometryCache=null,this._hiddenWallDiagnosticCache=null,this._decorSnapCache=null,this._commitSpace("",!0)}}else this._emptySpaceStateActive=!1}get _areaToSpace(){const e={};for(const t of this._model)for(const i of t.rooms)i.area&&(e[i.area]={space:t.id,room:i});return e}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return this._showHidden||!this._settings.filter_seeded&&!!this._settings.show_all}_seedHiddenDevices(){if(!this._serverCfg||!this._norm||!this._canEdit)return;const e=this._serverCfg,t=function(e){const t=e.hass,i=e.registry||Vc(t),n=Xc(t,i),r=Jc(t,i),{areaToSpace:o,markers:s,settings:a,excluded:l,iconRules:c}=e,h=!1!==a.group_lights,d=Lh(s),u=Ph(n,h).filter(e=>!qh(n,e.eid,d)),p=new Set(u.map(e=>e.area)),_=ih(n),m=nh(s,r),g=new Set(s.map(e=>e.binding)),f=[];for(const e of Object.values(n.devices)){const r=e.area_id;if(!r||!o[r])continue;if("service"===e.entry_type)continue;if(g.has("device:"+e.id))continue;if("active"!==th(t,"device:"+e.id,i).kind)continue;const s=rh(n,e.id,_[e.id]||[],m);if(s.partial&&!s.entityIds.length)continue;const a=s.entityIds,d=oh(n,e,a);let u=l.has(d)||"Group"===e.model||/scene/i.test(e.model||"")||/bridge/i.test((e.model||"")+(e.name||""))||"myheat"===d&&!!e.via_device_id;if(!u&&h&&p.has(r)){const t=(e.name_by_user||e.name||"").trim();"mdi:lightbulb"===Fh(n,t,e.model,a,c)&&(u=!0)}u&&f.push("device:"+e.id)}return f}({hass:this.hass,registry:this._haRegistry,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([e,t])=>[e,t.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,firstSpaceId:this._model[0]?.id||"",iconRules:this._iconRules});if(!t.length&&e.settings?.filter_seeded)return;e.markers=e.markers||[];const i=[];for(const n of t){const t="h"+n.slice(n.indexOf(":")+1);e.markers.push({id:t,binding:n,hidden:!0}),i.push(n.slice(n.indexOf(":")+1))}const n={...e.settings||{},filter_seeded:!0};delete n.show_all,i.length&&Array.isArray(n.new_device_ids)&&(n.new_device_ids=n.new_device_ids.filter(e=>!i.includes(e))),e.settings=n,this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate()}get _iconRules(){const e=this._settings.icon_rules;if(!e||!Array.isArray(e)||!e.length)return;const t=JSON.stringify(e);return t!==this._rulesCompiledSrc&&(this._rulesCompiledSrc=t,this._rulesCompiled=De(e)),this._rulesCompiled}get _fillColors(){return on(this._settings)}get _excluded(){const e=this._settings.exclude_integrations;return e?new Set(e):Te}willUpdate(e){e.has("_serverCfg")&&this._cfgEpoch++,this._syncEmptySpaceState(),e.has("hass")&&this.hass&&(this._hassSequence++,this._renderSnapshotAt=Date.now(),this._continuity.note("hass-snapshot"),this._ensureHaRegistryAuthority(),this._planHassMemo=null,this._hookConnection(),!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices(),this._vacTick(),this._activityTick()),this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._continuity.refreshCompleteFrame(this._visualFrameFingerprint()),this._captureRenderDeviceSnapshot()}updated(){this._pruneDevicePressFeedback(),this._syncDayCycleClock(),this._warmSnapshot(),this._editorRuntime&&this._dtMeasure();const e=this._stageEl;e&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(e)),e&&this._booting&&!this._bootTimer&&this._bootWatch();const t=this.renderRoot.querySelector(".hdr");if(t&&e&&!this._roHdr){const i=()=>{const t=this.renderRoot.querySelector("ha-card");if(!t)return;const i=e.getBoundingClientRect().top-t.getBoundingClientRect().top,n=Math.min(Math.max(t.getBoundingClientRect().top,0),120),r=Math.round(i+n);r>=0&&r!==this._hdrH&&(this._hdrH=r),r>=0&&!this._booting&&!this._config?.kiosk&&e.clientHeight>0&&this._warmPatch({hdrH:r,stageH:e.clientHeight})};this._roHdr=new ResizeObserver(()=>requestAnimationFrame(i)),this._roHdr.observe(t),this._onWinResize=()=>requestAnimationFrame(i),window.addEventListener("resize",this._onWinResize),i()}if(e&&!this._view&&this._refitView(),this._editorSecondary?.afterRender(),this._settleContinuityFrame(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._importDialog&&!this._onboardingShown){this._onboardingShown=!0;const e=function(e){const t=e?.floors;if(!t||"object"!=typeof t)return[];const i=[];for(const e of Object.values(t))e&&e.floor_id&&i.push({id:e.floor_id,name:e.name||e.floor_id,level:e.level??null});return i.sort((e,t)=>{const i=e.level??1e9,n=t.level??1e9;return i!==n?i-n:e.name.localeCompare(t.name)}),i}(this.hass);e.length?this._importDialog={floors:e.map(e=>({...e,checked:!0}))}:this._openSpaceDialog("create")}}_adoptStructuralResponses(e,t,i){const n=e?.config,r=n&&Array.isArray(n.spaces)?n:null,o=Rl(r),s=o!==(this._cfgContentFingerprint||Rl(this._serverCfg));if(s&&(this._geometryHistory.clear(),this._pendingPhysicalWrites.clear(),this._serverCfg&&this._clearGeometryGesture(),this._serverCfg=r,this._cfgContentFingerprint=o),this._cfgRev=e?.rev??this._cfgRev,e&&("virtual_lights"in e||"config"in e)){const t=Dc(this._virtualLights,e.virtual_lights,this._cfgRev,"virtual_lights"in e);Oc(t)!==Oc(this._virtualLights)&&(this._virtualLights=t,this._capturedSnapshotVirtual="")}let a=!1;if(void 0!==t||void 0!==i){const e=i??t?.layout??{},n=Rl(e);a=n!==(this._layoutContentFingerprint||Rl(this._layout)),a&&(this._layout=e,this._layoutContentFingerprint=n),this._layoutRev=t?.rev??this._layoutRev}return this._canOptimizeUndo=!(!e?.can_optimize_undo&&!t?.can_optimize_undo),this._haIntegrationVersion="string"==typeof e?.integration_version?e.integration_version:this._haIntegrationVersion,this._undoKind=e?.undo_kind||t?.undo_kind||null,"boolean"==typeof e?.can_write&&(this._serverCanWrite=e.can_write),s&&this._continuity.note("config-candidate",{configRev:this._cfgRev}),a&&this._continuity.note("layout-candidate",{layoutRev:this._layoutRev}),{configChanged:s,layoutChanged:a}}_resumePendingNavMode(){if(!this._pendingNavMode||!this._canEdit||this._config?.kiosk)return!1;const e=this._pendingNavMode;return this._pendingNavMode=null,this._setMode(e,!1),!0}async _loadFromServer(){this._loading=!0,this._loadTries++;const e=this._space,t=!!this._view;try{const[i,n]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]),r=i?.config&&Array.isArray(i.config.spaces)?i.config:null,o=Rl(r)!==(this._cfgContentFingerprint||Rl(this._serverCfg))||Rl(n?.layout??{})!==(this._layoutContentFingerprint||Rl(this._layout));if(o){if(!await this._signer.prepareImage(this.hass,this._candidateBackdrop(r)))return this._continuity.note("asset-failed"),void this._scheduleLoadRetry(!0)}o&&this._continuity.hasCompleteFrame&&"steady"===this._continuity.state&&this._beginContinuityCandidate("structural-response",!0),this._connectionWasLost=!1,this._serverStorage=!0,"boolean"==typeof i?.can_write&&(this._serverCanWrite=i.can_write),this._canOptimizeUndo=!(!i?.can_optimize_undo&&!n?.can_optimize_undo),this._haIntegrationVersion="string"==typeof i?.integration_version?i.integration_version:this._haIntegrationVersion,this._adoptStructuralResponses(i,n),this._adoptInitialSpace(this._model,!0),this._resumePendingNavMode(),this._cacheSnapshot(),this._warmVpArmed&&this._space===this._warmVp?.space?this._warmVpArmed=!1:t&&this._space===e||this._restoreZoom(),this._loadOk=!0,this.hass.callWS({type:"houseplan/trail/get"}).then(e=>{this._vacSrvTrails=e?.trails||{},this.requestUpdate()}).catch(()=>{}),this._ensureLiveSyncSubscriptions()}catch(e){if(this._serverCfg)this._scheduleLoadRetry(!0);else if(this._loadTries>=8){this._serverStorage=!1;try{this._layout=JSON.parse(localStorage.getItem(_m)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1,this._continuityDataReady=!0,this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}}_ensureLiveSyncSubscriptions(){const e=this.hass?.connection;if(!e)return;if(e!==this._liveSyncConnection&&(this._unsubCfg?.(),this._unsubCfg=null,this._unsubLayout?.(),this._unsubLayout=null,this._unsubTrail?.(),this._unsubTrail=void 0,this._unsubVirtual?.(),this._unsubVirtual=null,this._liveSyncGeneration++,this._liveSyncAttempt=null,this._liveSyncConnection=e),this._liveSyncAttempt)return;const t=this._liveSyncGeneration,i=[],n=(n,r,o,s)=>{n()||i.push(async()=>{const i=await e.subscribeEvents(s,o);t===this._liveSyncGeneration&&this.isConnected&&this.hass?.connection===e&&!n()?r(i):i?.()})};if(n(()=>this._unsubCfg,e=>{this._unsubCfg=e},"houseplan_config_updated",e=>{const t=Number(e?.data?.rev??-1);t!==this._cfgRev&&this._reloadConfigOnly(!1,t)}),n(()=>this._unsubTrail,e=>{this._unsubTrail=e},"houseplan_trail_updated",async()=>{try{const e=await this.hass.callWS({type:"houseplan/trail/get"});this._vacSrvTrails=e?.trails||{},this.requestUpdate()}catch{}}),n(()=>this._unsubLayout,e=>{this._unsubLayout=e},"houseplan_layout_updated",e=>this._onLayoutEvent(Number(e?.data?.rev??-1))),n(()=>this._unsubVirtual,e=>{this._unsubVirtual=e},"houseplan_virtual_light_updated",e=>{const t=Fc(this._virtualLights,e?.data);t!==this._virtualLights&&(this._virtualLights=t,this._capturedSnapshotVirtual="",this._cacheSnapshot(),this.requestUpdate())}),!i.length)return;const r=function(e){return Promise.allSettled(e.map(e=>Promise.resolve().then(e)))}(i).then(()=>{});this._liveSyncAttempt=r,r.finally(()=>{this._liveSyncAttempt===r&&(this._liveSyncAttempt=null)})}async _reloadConfigOnly(e=!1,t){if(!e){if(void 0!==t&&t<=this._cfgRev)return;if(this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),this._cfgWriting)return clearTimeout(this._reloadRetry),void(this._reloadRetry=window.setTimeout(()=>this._reloadConfigOnly(!1,t),400))}this._beginContinuityCandidate("config-reload",!1);try{const e=await this.hass.callWS({type:"houseplan/config/get"}),t=e?.config&&Array.isArray(e.config.spaces)?e.config:null;if(Rl(t)!==(this._cfgContentFingerprint||Rl(this._serverCfg))&&!await this._signer.prepareImage(this.hass,this._candidateBackdrop(t)))return this._continuity.note("asset-failed"),void this._scheduleLoadRetry(!0);const i=this._space;this._adoptStructuralResponses(e),this._adoptInitialSpace(this._model,!0),this._resumePendingNavMode(),this._cacheSnapshot(),this._space!==i&&this._restoreZoom(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch(e){this._showToast(this._t("toast.cfg_reload_failed",{err:this._errText(e)}))}finally{this._continuityDataReady=!0,this.requestUpdate()}}_scheduleLoadRetry(e=!1){if(void 0!==this._loadRetryTimer)return;const t=Math.min(8e3,500*2**Math.min(4,Math.max(1,this._loadTries-7)));this._loadRetryTimer=window.setTimeout(()=>{this._loadRetryTimer=void 0,!e&&this._loadOk||this._loading||!this.hass||this._loadFromServer()},t)}_ensureHaRegistryAuthority(){const e=this.hass?.connection||null;e&&e!==this._haRegistryConnection&&(this._haRegistryRelease?.(),this._haRegistryConnection=e,this._haRegistryRev=-1,this._haBindingCacheKey="",this._planHassMemo=null,this._haRegistryRelease=Gc(this.hass,this._onHaRegistryUpdate),this._onHaRegistryUpdate())}get _haRegistry(){return Vc(this.hass)}get _planHass(){const e=this._haRegistry,t=Yc(this.hass,e),i=this._planHassMemo;if(i&&i.hass===this.hass&&i.sig===t)return i.active;const n=Xc(this.hass,e),r=Jc(this.hass,e);return this._planHassMemo={hass:this.hass,sig:t,active:n,full:r},n}_captureRenderDeviceSnapshot(){if(!this.hass)return;const e=Date.now(),t=[...this._activityRt.entries()].map(([t,i])=>`${t}:${i.gen}:${i.flashTs}:`+(i.flashKind&&(i.expiresAt||i.flashTs+Op)>e?1:0)).join("|"),i=Oc(this._virtualLights);if(this._capturedSnapshotSequence===this._hassSequence&&this._capturedSnapshotDevices===this._devices&&this._capturedSnapshotLayout===this._layout&&this._capturedSnapshotConfigEpoch===this._cfgEpoch&&this._capturedSnapshotVirtual===i&&this._capturedSnapshotActivity===t)return;const n=this._planHass,r=new Map,o=new Map,s=new Set(["sun.sun"]);this._vacFit?.source&&s.add(this._vacFit.source);const a=new Set,l=new Set,c=e=>{if(!e)return;const t=e.indexOf(":");if(t<0)return void s.add(e);const i=e.slice(0,t),n=e.slice(t+1);"device"===i?a.add(n):"entity"===i&&s.add(n)};for(const e of this._model)for(const t of e.rooms)t.area&&l.add(t.area),c(t.settings?.temp_source),c(t.settings?.hum_source);for(const e of this._serverCfg?.spaces||[])for(const t of e.openings||[])for(const e of ni(t))s.add(e);for(const e of this._serverCfg?.spaces||[])for(const t of e.decor||[])if("text"===t.kind){for(const e of String(t.text||"").matchAll(/\{([^{}\r\n]+)\}/g)){const t=Hi(e[1]);t?.entity&&s.add(t.entity)}t.entity&&s.add(t.entity),o.set(`decor:${e.id}:${t.id}`,Wi(t.text,t,n,e=>!!n.entities?.[e]&&!!n.states?.[e]&&!qh(n,e,Lh(this._markers))))}const h=Mh(n,this._devices,null,this._virtualLights);for(const e of this._devices){for(const t of[!1,!0])r.set(Uu(e.id,t),qu(n,e,{liveStates:!1!==this._config?.live_states,showTemperature:!1!==this._config?.show_temperature,showSignal:t,activityRuntime:this._activityRt.get(e.id),sourceDetails:!1,lightDevices:this._devices,lightSources:h,registryHass:this._fullRegistryHass,reducedMotion:this._reducedMotion}));if(this._isVacDev(e)){const t=this._vacSource(e,n),i=t?Bl(n?.states?.[t]?.attributes):null,r=this._vacRt.get(e.id);o.set(`vacuum:${e.id}`,{source:t,telemetry:i,mapId:i?this._vacMapId(e,i,n):null,runtime:r?{trail:r.trail,lastTs:r.lastTs,moving:r.moving,jump:r.jump}:null,server:this._vacSrvTrails[e.id]||null})}}const d=Wu({sourceSequence:this._hassSequence,hass:n,devices:this._devices,presentations:r,positions:(u=this._model.length>0,p=this._devices,_=e=>this._livePos(e),u?new Map(p.map(e=>[e.id,_(e)])):new Map),facts:o,entityIds:s,deviceIds:a,areaIds:l});var u,p,_;this._capturedSnapshotSequence=this._hassSequence,this._capturedSnapshotDevices=this._devices,this._capturedSnapshotLayout=this._layout,this._capturedSnapshotActivity=t,this._capturedSnapshotConfigEpoch=this._cfgEpoch,this._capturedSnapshotVirtual=i,this._visibleDeviceSnapshot&&"steady"!==this._continuity.state?this._candidateDeviceSnapshot=d:(this._visibleDeviceSnapshot=d,this._candidateDeviceSnapshot=null)}get _renderDeviceSnapshot(){return this._stagedDeviceSnapshotToken===this._continuity.token?this._candidateDeviceSnapshot||this._visibleDeviceSnapshot:this._visibleDeviceSnapshot||this._candidateDeviceSnapshot}get _renderPlanHass(){return this._renderDeviceSnapshot?.hass||this._planHass}get _renderDevices(){return this._renderDeviceSnapshot?.devices||this._devices}get _fullRegistryHass(){return this._planHass,this._planHassMemo?.full||this.hass}_bindingStatus(e){return th(this.hass,e,this._haRegistry)}houseplanDiagnostics(){const e=function(e){const t=Vc(e);return{access:t.access,authoritative:t.authoritative,revision:t.revision,lastSuccess:t.lastSuccess,error:t.error}}(this.hass),t={active:0,ha_disabled:0,orphaned:0,unverified:0};for(const e of this._markers)e.removed||"virtual"===e.binding||t[this._bindingStatus(e.binding).kind]++;return{registry:{...e,lastSuccessAgeMs:e.lastSuccess?Math.max(0,Date.now()-e.lastSuccess):null},bindings:t}}_openBindingInHa(e){const[t,i]=e.split(":");if(i)if("device"!==t){if("entity"===t){const e=this._fullRegistryHass.entities?.[i];e?.device_id&&Mm("/config/devices/device/"+encodeURIComponent(e.device_id))}}else Mm("/config/devices/device/"+encodeURIComponent(i))}_bindingHasHaPage(e){const[t,i]=e.split(":");return!!i&&("device"===t||"entity"===t&&!!this._fullRegistryHass.entities?.[i]?.device_id)}_toggleMarkerDialogVisibility(){const e=this._markerDialog;if(!e)return;const t="ha"===e.bindingMode?this._bindingStatus(e.binding):null,i=e.hideFromPlan||"ha_disabled"===t?.kind;i&&"ha_disabled"===t?.kind?this._showToast(this._t("entity"===t.reason?"toast.ha_disabled_show_entity":"toast.ha_disabled_show_device")):i&&"unverified"===t?.kind?this._showToast(this._t("toast.ha_binding_unverified")):this._markerDialog={...e,hideFromPlan:!i}}_hookConnection(){const e=this.hass?.connection;e&&e!==this._connHooked&&(this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked?.removeEventListener?.("disconnected",this._onConnLost),this._connHooked?.removeEventListener?.("reconnect-error",this._onConnLost),e.addEventListener?.("ready",this._onConnReady),e.addEventListener?.("disconnected",this._onConnLost),e.addEventListener?.("reconnect-error",this._onConnLost),this._connHooked=e)}_display(e){return this._signer.display(this.hass,e)}_resign(){this._signer.resign(this.hass,Sn(this._serverCfg))}_onLayoutEvent(e){e<=this._layoutRev||(clearTimeout(this._layoutSyncTimer),this._layoutSyncTimer=window.setTimeout(()=>{e<=this._layoutRev||this._reloadLayoutOnly()},200))}_noteLayoutRev(e){const t=e?.rev;"number"==typeof t&&t>this._layoutRev&&(this._layoutRev=t)}async _reloadLayoutOnly(){if(!this._serverStorage||!this.hass?.callWS)return;this._beginContinuityCandidate("layout-reload",!1);const e=new Map;for(const t of this._dirtyPos)this._layout[t]&&e.set(t,this._layout[t]);this._persistLayout.pending()&&this._persistLayout.flush();for(const[t,i]of this._sentPos)e.set(t,i);try{const t=await this.hass.callWS({type:"houseplan/layout/get"}),i={...t?.layout||{}};for(const[t,n]of e)i[t]=n;const n=Rl(i);n!==(this._layoutContentFingerprint||Rl(this._layout))&&(this._layout=i,this._layoutContentFingerprint=n),this._layoutRev=t?.rev??this._layoutRev,this._canOptimizeUndo=!!t?.can_optimize_undo,this._haIntegrationVersion="string"==typeof t?.integration_version?t.integration_version:this._haIntegrationVersion,this._undoKind=t?.undo_kind||null,this._cacheSnapshot(),this.requestUpdate()}catch{}finally{this._continuityDataReady=!0,this.requestUpdate()}}_maybeRebuildDevices(){const e=this.hass;if(!e?.devices||!e?.entities||!e?.areas)return;const t=this._haRegistry,i=Yc(e,t)+":"+Object.keys(e.areas).length+":"+(this._norm?"n":"l")+":"+ru(e,this._config?.language);if(i===this._regSignature&&this._devices.length)return;this._regSignature=i;const n=new Map(this._devices.map(e=>[e.id,e.bindingStatus?.kind||"active"]));this._devices=Wh({hass:e,registry:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([e,t])=>[e,t.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||"",loc:e=>this._t(e),iconRules:this._iconRules});const r=this._markers.filter(e=>!e.removed&&"virtual"!==e.binding).map(e=>e.binding).sort(),o=t.revision+":"+r.join("|");if(t.authoritative&&o!==this._haBindingCacheKey){const i=new Map;for(const n of r)i.set(n,th(e,n,t));!function(e){if("undefined"==typeof localStorage||!e.size)return;const t=eh(),i=Date.now();for(const[n,r]of e)"active"===r.kind?t[n]={kind:"active",ts:i}:"ha_disabled"===r.kind&&(t[n]={kind:"ha_disabled",reason:r.reason,ts:i});const n=Object.fromEntries(Object.entries(t).sort((e,t)=>t[1].ts-e[1].ts).slice(0,1500));Lc=n;try{localStorage.setItem(Hc,JSON.stringify(n))}catch{}}(i),this._haBindingCacheKey=o}this._defPos=this._defaultPositions(),this._syncNewDevices(),this._seedHiddenDevices(),this._syncActivityRuntime();const s=new Set(this._devices.filter(e=>!e.hidden).map(e=>e.id));for(const e of this._vacRt.keys())s.has(e)||this._vacRt.delete(e);if(this._infoCard){const e=this._devices.find(e=>e.id===this._infoCard.id);this._infoCard=e&&"ha_disabled"!==e.bindingStatus?.kind?e:null}const a=this._devices.some(e=>"ha_disabled"===e.bindingStatus?.kind&&"ha_disabled"!==n.get(e.id));a&&("ha_disabled"!==this._infoCard?.bindingStatus?.kind&&"ha_disabled"!==this._devices.find(e=>e.id===this._infoCard?.id)?.bindingStatus?.kind||this._closeInfoCard(),this._drag&&"ha_disabled"===this._devices.find(e=>e.id===this._drag.id)?.bindingStatus?.kind&&(this._drag=null),clearTimeout(this._holdTimer),this._holdFired=!1,this._tip=null,this._tapConfirm=null),this._nativeMoreInfoEntity&&!this._planEntityAvailable(this._nativeMoreInfoEntity)&&(Sm(this,"hass-more-info",{entityId:null}),this._nativeMoreInfoEntity=null)}_syncNewDevices(){if(!this._norm||!this._loadOk||!this._serverCfg)return;const e=this._devices.filter(e=>!e.marker&&!e.virtual).map(e=>e.id).sort(),t=e.join(",");if(t===this._newSyncKey)return;this._newSyncKey=t;const i=this._settings,{fresh:n,known:r}=function(e,t){if(!Array.isArray(t))return{fresh:[],known:[...e]};const i=new Set(t),n=e.filter(e=>!i.has(e));return{fresh:n,known:n.length?[...t,...n]:t}}(e,i.known_devices);if(!Array.isArray(i.known_devices)||n.length){const e=[...new Set([...i.new_device_ids||[],...n])];this._serverCfg={...this._serverCfg,settings:{...i,known_devices:r,new_device_ids:e}},this._saveConfig()}}get _newIds(){const e=this._settings.new_device_ids;return new Set(Array.isArray(e)?e:[])}_ackNewDevice(e){if(!this._newIds.has(e)||!this._serverCfg)return;const t=this._settings;this._serverCfg={...this._serverCfg,settings:{...t,new_device_ids:(t.new_device_ids||[]).filter(t=>t!==e)}},this._saveConfig(),this.requestUpdate()}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(e){if(!e)return null;const t=[];for(const i of this._renderDevices){if(i.area!==e||i.virtual)continue;const n=Ch(this._renderPlanHass,i.entities);null!=n&&t.push(n)}return Mi(t)}_roomBounds(e){if(e.poly&&e.poly.length){const t=e.poly.map(e=>e[0]),i=e.poly.map(e=>e[1]),n=Math.min(...t),r=Math.min(...i);return{x:n,y:r,w:Math.max(...t)-n,h:Math.max(...i)-r}}return{x:e.x??0,y:e.y??0,w:e.w??0,h:e.h??0}}_defaultPositions(){const e={},t=this._config?.icon_size??2.5;for(const i of this._model){const n=t/100*el(i)*1.3;for(const t of i.rooms){if(!t.area)continue;const r=this._devices.filter(e=>e.area===t.area&&e.space===i.id);if(!r.length)continue;const o=this._roomBounds(t),s=.1*Math.min(o.w,o.h),a=o.w-2*s,l=o.h-2*s,c=Math.max(1,Math.round(Math.sqrt(r.length*a/Math.max(l,1)))),h=Math.ceil(r.length/c),d=a/c,u=l/Math.max(h,1),p=r.map((e,t)=>({x:o.x+s+d*(t%c+.5),y:o.y+s+u*(Math.floor(t/c)+.5)}));Ti(p,o,n,.5*s),r.forEach((t,i)=>e[t.id]=La(p[i]))}}return e}_pos(e){const t=this._renderDeviceSnapshot?.positions.get(e.id);return t?{x:t.x,y:t.y}:this._livePos(e)}_livePos(e){const t=this._spaceModelById(e.space),i=this._layout[e.id];if(i)if(this._norm){if(i.s===e.space)return{x:i.x*wm,y:i.y*wm}}else if(void 0===i.s)return{x:i.x,y:i.y};return this._defPos[e.id]?this._defPos[e.id]:t?La(Qa(t)):{x:500,y:500}}_savePos(e,t,i){if(this._spaceModelById(e.space)){if(this._norm){const n=this._gridPitch,r=Math.round(t/n)*n,o=Math.round(i/n)*n,s=this._layout[e.id]?.k;this._layout={...this._layout,[e.id]:{s:e.space,x:ja(r/wm),y:ja(o/wm),...s?{k:s}:{}}}}else this._layout={...this._layout,[e.id]:{x:Math.round(t),y:Math.round(i)}};this._dirtyPos.add(e.id),this._persistLayout()}}_visualSamples(e){return Iu(this._renderPlanHass,e,this._renderDevices,void 0,this._fullRegistryHass).samples}_devicePresentation(e,t=!1!==this._config?.show_signal,i=!1){const n=i?null:this._renderDeviceSnapshot?.presentations.get(Uu(e.id,t));return n||qu(this._renderPlanHass,e,{liveStates:!1!==this._config?.live_states,showTemperature:!1!==this._config?.show_temperature,showSignal:t,designPreview:i,activityRuntime:this._activityRt.get(e.id),sourceDetails:!1,lightDevices:this._renderDevices,registryHass:this._fullRegistryHass,reducedMotion:this._reducedMotion})}_deviceVisual(e){return this._devicePresentation(e).visual}_stateClass(e,t=this._deviceVisual(e)){const i=this._devicePresentation(e);return i.effectiveHidden?"":("icon_ripple"!==i.display||!1===this._config?.live_states||"alarm"===t.status||t.activity,Lu({...i,visual:t}).join(" "))}_liveTemp(e){if(!this._config?.show_temperature)return null;if(!0===e.marker?.use_climate_temp){const t=Ah(this._renderPlanHass,e.entities);if(null!=t)return t}return"mdi:thermometer"!==e.icon&&"mdi:air-filter"!==e.icon?null:Dh(this._renderPlanHass,e.entities)}_bindingEntities(e){if("virtual"===e||!e)return[];const t=this._bindingStatus(e);return"active"===t.kind?t.enabledEntityIds:t.allEntityIds}_bindingHasClimate(e){return this._bindingEntities(e).some(e=>e.startsWith("climate."))}_bindingHasAlarm(e){return this._bindingEntities(e).some(e=>{const t=this._planHass?.states?.[e]||this.hass?.states?.[e],i=this._fullRegistryHass.entities[e]||this.hass?.entities?.[e];return In(e.split(".")[0],t?.attributes?.device_class||i?.device_class||i?.original_device_class)})}_liveHum(e){return this._config?.show_temperature&&e.primary&&Oh(this.hass,e.primary)?zh(this.hass,e.entities):null}_deviceBindingActive(e,t=!0){if(e.virtual||"virtual"===e.bindingKind)return!0;if(!e.bindingKind||!e.bindingRef)return!1;const i=this._bindingStatus(`${e.bindingKind}:${e.bindingRef}`);return"active"===i.kind||(t&&this._showToast(this._t("ha_disabled"===i.kind?"toast.ha_disabled_action":"toast.ha_binding_unverified")),!1)}_openMoreInfo(e){e?this._planEntityAvailable(e)?(this._nativeMoreInfoEntity=e,Sm(this,"hass-more-info",{entityId:e})):this._showToast(this._t("toast.ha_disabled_action")):this._showToast(this._t("toast.no_entity"))}_interruptViewGesture(e,t){if(clearTimeout(this._holdTimer),clearTimeout(this._kioskHoldTimer),void 0!==e)for(const i of[t,this._stageEl])try{i?.hasPointerCapture?.(e)&&i.releasePointerCapture(e)}catch{}this._pointers.clear(),this._panStart=null,this._panLock=null,this._pinchStart=null,this._swipeStart=null}_closeInfoCard(){this._interruptViewGesture(),this._holdFired=!1,this._infoCard=null}_ctxDevice(e,t){"view"===this._mode&&(e.preventDefault(),e.stopPropagation(),this._deviceBindingActive(t)&&(t.primary?this._openMoreInfo(t.primary):this._infoCard=t))}_clickDevice(e,t){if(e.stopPropagation(),this._drag?.moved||this._suppressClick||this._holdFired)return;if("plan"===this._mode)return;if("devices"===this._mode)return void this._openMarkerDialog(t);const i=this._devices.find(e=>e.id===t.id);if(!i)return;const n=_d(i.tapAction,i.primary?.split(".")[0]),r=(e,t)=>{i.marker?.tap_confirm?this._tapConfirm={kind:"run",text:e,exec:t}:t()};if("toggle"===n){const e=this._toggleIntent(i);if(!e)return;if(!bd(e))return void this._showUnavailableToggleTargets(e);const t=e=>{const t=bd(e);if(!t)return;if("virtual-light"===t.kind)return this._startDevicePressFeedback(i.id),void this.hass.callWS({type:"houseplan/virtual_light/toggle",marker_id:t.markerId}).then(e=>{const t=Fc(this._virtualLights,e);t!==this._virtualLights&&(this._virtualLights=t,this._capturedSnapshotVirtual="",this._cacheSnapshot(),this.requestUpdate())}).catch(e=>this._showToast(this._t("toast.virtual_light_toggle_failed",{err:this._errText(e)})));const{command:n}=t;this._startDevicePressFeedback(i.id),this.hass.callService(n.domain,n.service,n.data).catch(e=>this._showToast(this._t("toast.error",{err:this._errText(e)})))},n=((o=e).targets.length?o.targets:o.skippedTargets).map(e=>e.name||e.entityId||e.ref).join(", ")||i.name;if(i.marker?.tap_confirm){const r=this._toggleConfirmationLines(e);if(!r.length)return;this._tapConfirm={kind:"toggle",text:this._t("confirm.tap_toggle",{name:n}),lines:r,initialIntent:e,deviceId:i.id,exec:()=>{const n=this._devices.find(e=>e.id===i.id),r=n?this._toggleIntent(n):null;r&&!bd(r)&&this._showUnavailableToggleTargets(r)||(r&&xd(e,r)?t(r):this._showToast(this._t("toast.tap_target_changed")))}}}else t(e);return}var o;if("info"===n)return this._interruptViewGesture(),void(this._infoCard=i);if(this._deviceBindingActive(i)){if("run"===n){const e=i.marker?.tap_target||"",t=function(e){const t=String(e||"").split(".")[0];return"automation"===t?{domain:"automation",service:"trigger"}:"script"===t?{domain:"script",service:"turn_on"}:"scene"===t?{domain:"scene",service:"turn_on"}:null}(e),n=this.hass.states[e];if(!t||!n)return void this._showToast(this._t("toast.run_target_missing"));const o=n.attributes?.friendly_name||e;return void r(this._t("confirm.tap_run",{name:o}),()=>{this._deviceBindingActive(i)&&this._planEntityAvailable(e)&&(this._startDevicePressFeedback(i.id),this.hass.callService(t.domain,t.service,{entity_id:e}).then(()=>{this._stampActivity(i.id,"event",this._activitySourceKey(i)),this.requestUpdate(),this._showToast(this._t("toast.run_started",{name:o}))}).catch(e=>this._showToast(this._t("toast.error",{err:this._errText(e)}))))})}"more-info"===n&&i.primary?this._openMoreInfo(i.primary):this._infoCard=i}}_showUnavailableToggleTargets(e){const t=function(e){if(!e||"group"!==e.kind||bd(e)||"configured-targets-missing"!==e.noneReason)return[];if(!e.skippedTargets.length||e.skippedTargets.some(e=>!wd.has(e.reason)&&"secure"!==e.reason))return[];const t=[],i=new Set;for(const n of e.skippedTargets){if(!wd.has(n.reason))continue;const e=String(n.name||n.entityId||n.ref||"").trim();e&&!i.has(e)&&(i.add(e),t.push(e))}return t}(e);return!!t.length&&(this._showToast(1===t.length?this._t("toast.toggle_target_unavailable",{name:t[0]}):this._t("toast.toggle_targets_unavailable",{names:t.join(", ")})),!0)}_keyDevice(e,t){"Enter"!==e.key&&" "!==e.key||"view"!==this._mode&&"devices"!==this._mode||(e.preventDefault(),this._clickDevice(e,t))}_startDevicePressFeedback(e){const t=[...this.renderRoot.querySelectorAll(".dev[data-id]")].find(t=>t.dataset.id===e),i=t?.querySelector(".device-shell");if(!i||"function"!=typeof i.animate)return;const n=Number.parseFloat(this.ownerDocument.defaultView?.getComputedStyle(i).scale||""),r=Number.isFinite(n)?Math.max(.95,Math.min(1,n)):1;this._devicePressAnimations.get(e)?.cancel();const o=this._reducedMotion?[{outlineColor:"transparent",outlineStyle:"solid",outlineWidth:"0px"},{outlineColor:"var(--hp-accent, #3ea6ff)",outlineStyle:"solid",outlineWidth:"2px",outlineOffset:"2px",offset:.5},{outlineColor:"transparent",outlineStyle:"solid",outlineWidth:"0px"}]:[{scale:String(r)},{scale:"0.95",offset:.5},{scale:"1"}],s=i.animate(o,{duration:200,easing:"cubic-bezier(.22,.61,.36,1)"});this._devicePressAnimations.set(e,s);const a=()=>{this._devicePressAnimations.get(e)===s&&this._devicePressAnimations.delete(e)};s.addEventListener("finish",a,{once:!0}),s.addEventListener("cancel",a,{once:!0})}_cancelDevicePressFeedback(){for(const e of this._devicePressAnimations.values())e.cancel();this._devicePressAnimations.clear()}_pruneDevicePressFeedback(){if(!this._devicePressAnimations.size)return;const e=new Set([...this.renderRoot.querySelectorAll(".dev[data-id]")].map(e=>e.dataset.id||""));for(const[t,i]of this._devicePressAnimations)e.has(t)||(i.cancel(),this._devicePressAnimations.delete(t))}_t(e,t){return ou(ru(this.hass,this._config?.language),e,t)}get _colorPickerLabels(){return{title:this._t("color_picker.title"),hue:this._t("color_picker.hue"),saturation:this._t("color_picker.saturation"),value:this._t("color_picker.value"),hex:this._t("color_picker.hex"),invalidHex:this._t("color_picker.invalid_hex")}}_help(e){return this._editorRuntimeOrThrow()._help(e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_contentItems(e){const t=[];for(const i of this._devices){if(i.space!==e.id||i.hidden)continue;const n=this._pos(i);t.push({minX:n.x,minY:n.y,maxX:n.x,maxY:n.y})}if(e.id===this._space){for(const e of this._openingsR){const i=Number(e.angle)*Math.PI/180,n=Math.cos(i)*e.rlen/2,r=Math.sin(i)*e.rlen/2,o=Ua([[e.rx-n,e.ry-r],[e.rx+n,e.ry+r]]);o&&t.push(o)}const i=this._decorH;for(const e of this._decorList){const n=Ua("line"===e.kind?[[e.x1*wm,e.y1*i],[e.x2*wm,e.y2*i]]:"text"===e.kind?[[e.x*wm,e.y*i]]:wr({x:e.x*wm,y:e.y*i,w:e.w*wm,h:e.h*i,angle:e.angle}));n&&t.push(n)}for(const i of this._physicalBodiesR(e)){const e=Ua(i);e&&t.push(e)}}return Va(e,t)}_frameOf(){const e=this._spaceModel();if(!e){this._frame=null;const e={x:0,y:0,w:wm,h:wm};return{rect:e,all:e,outliers:0}}const t=this._frame,i="view"!==this._mode;if(t&&t.id===e.id&&this._bdDrag)return t;if(t&&t.id===e.id&&t.model===e&&t.layout===this._layout&&t.devs===this._devices&&t.far===this._showFar&&t.grow===i)return t;const n=Xa(this._contentItems(e));let r=n.all||Ja(e),o=this._showFar?r:n.core||Ja(e);return t&&t.id===e.id&&i&&t.grow&&(o=xm(t.rect,o),r=xm(t.all,r)),this._frame={id:e.id,model:e,layout:this._layout,devs:this._devices,far:this._showFar,grow:i,rect:o,all:r,outliers:n.outliers},this._frame}_isoSource(){const e=this._spaceModel();if(!e)return null;const t=this._spaceWalls,i=this._openCuts(),n=this._openingsR.map((e,t)=>({id:String(e.id||t),sourceIndex:t,type:e.type,x:e.rx,y:e.ry,angle:Number(e.angle)||0,length:e.rlen>0?e.rlen:900,flipH:!!e.flip_h,flipV:!!e.flip_v})),r=xa(64,this._cellCm),o=xa(10,this._cellCm),s=`${e.id}|${function(e){let t=2166136261;const i=e=>{if("number"!=typeof e)if("string"!=typeof e)if("boolean"!=typeof e)if(Array.isArray(e)){t=B_(t,e.length);for(const t of e)i(t)}else{if(e&&"object"==typeof e){const t=e;for(const e of Object.keys(t).sort())i(e),i(t[e]);return}t=B_(t,-1)}else t=B_(t,e?1:0);else for(const i of e)t=B_(t,i.codePointAt(0)||0);else t=B_(t,e)};return i(e),t.toString(36)}({rooms:e.rooms,walls:t,openCuts:i,openings:n,partitions:e.partitions,roomDrafts:e.room_drafts,columns:e.wall_columns,cellCm:this._cellCm,gridPitch:this._gridPitch,wallKeyPitch:this._wallKeyPitch,camera:A_,wallHeight:r,floorEdgeHeight:o,algorithm:3})}`;return{key:s,build:()=>{const o=ca(e,this._cellCm,this._gridPitch,2e-4*this._gridPitch,this._partitionOpeningCuts(e)).all,s=this._roomWallOpeningInputs(this._openingsR,e),a=t.length||o.length?Ns(e.rooms,t,i,s,this._wallKeyPitch,this._cellCm,this._gridPitch,wm,o):null;if(a&&("failed-core"===a.status||"not-applicable"===a.status))throw new Error("wall boolean geometry failed");const l=a?.paperGeom??Ps(e.rooms,t,i,this._wallKeyPitch,this._cellCm,this._gridPitch,wm);if(!l)throw new Error("floor boolean geometry failed");const c=a?.openingIndex||Bs(e.rooms,t,i,this._wallKeyPitch,this._cellCm,this._gridPitch,wm),h=n.map(e=>{const i=this._openingsR[e.sourceIndex],n="gate"===e.type?!e.flipV:e.flipV,o=i?.partitionHost?Od(i.partitionHost,n):t.length||"gate"===e.type?Vs(c,{x:e.x,y:e.y,angle:e.angle,length:e.length,flip_v:n}):{ox:0,oy:0,cm:0,side:-1};return function(e,t=64){if(!(W_([e.x,e.y,e.angle,e.length,e.face.ox,e.face.oy,t])&&e.length>0&&t>0))throw new Error("invalid isometric opening input");const i=e.length/2;let n;if("passage"===e.type)n=[];else if("gate"===e.type){const r=10*e.face.side;n=[G_(e,0,[-i,0],[i,0],r,0,.88*t),G_(e,1,[i,0],[-i,0],-r,0,.88*t)]}else n="window"===e.type?[G_(e,0,[-i,0],[i,0],-90,.27*t,.78*t),G_(e,1,[i,0],[-i,0],90,.27*t,.78*t)]:[G_(e,0,[-i,0],[e.length,0],-90,0,.92*t)];return{id:e.id,sourceIndex:e.sourceIndex,type:e.type,leaves:Object.freeze(n.map(e=>Object.freeze(e)))}}({...e,face:o},r)});return{walls:a?.components.flatMap(e=>e.geom)||[],floor:l,openings:Object.freeze(h)}}}}_isoSceneKey(){if(!this._labsIso||"view"!==this._mode)return null;try{return this._isoSource()?.key??null}catch{return`${this._space}|invalid`}}_isoScene(){const e=this._isoSource();if(!e)return null;const t=this._isoGeometryCache.get(e.key);if(t)return{key:e.key,...t};const i=this._frameOf().rect,n=e.build(),r=xa(64,this._cellCm),o=xa(10,this._cellCm),s=function(e){let t=1/0,i=1/0,n=-1/0,r=-1/0;for(const o of e)for(const e of o.leaves){const o=Math.hypot(e.closedVector[0],e.closedVector[1]);t=Math.min(t,e.hinge[0]-o),i=Math.min(i,e.hinge[1]-o),n=Math.max(n,e.hinge[0]+o),r=Math.max(r,e.hinge[1]+o)}return W_([t,i,n,r])?{x:t,y:i,w:n-t,h:r-i}:null}(n.openings),a=I_({rect:s?xm(i,s):i,wallHeight:r,openingHeight:r,floorDepth:o}),l=function(e,t=A_,i=64){if(!Number.isFinite(i)||i<0)throw new Error("invalid wall height");const n=[],r=[],o=[];let s=0;for(let a=0;a<(e||[]).length;a++){const l=e[a];for(let e=0;e<(l||[]).length;e++){const c=H_(l[e],e>0);if(!(c.length<3||Math.abs(N_(c))<1e-9)){n.push(L_(c,t,i)),s+=c.length;for(let n=0;n<c.length;n++){const s=c[n],l=c[(n+1)%c.length],h=z_(s,0,t),d=z_(l,0,t);if(o.push(`M ${E_(h)} L ${E_(d)}`),q_(s,l,t)<=1e-9)continue;const u=z_(l,i,t),p=z_(s,i,t);r.push({d:`M ${E_(h)} L ${E_(d)} L ${E_(u)} L ${E_(p)} Z`,depth:Math.max(h[1],d[1]),polygon:a,ring:e,edge:n})}}}}return r.sort((e,t)=>e.depth-t.depth||e.polygon-t.polygon||e.ring-t.ring||e.edge-t.edge),{topPath:n.join(" "),sides:r,contactPath:o.join(" "),edgeCount:s}}(n.walls,A_,r),c={geometry:l,floor:j_(n.floor,o),openings:n.openings,frame:a};return cm(this._isoGeometryCache,e.key,c,8),{key:e.key,...c}}_effectiveProjection(){if("iso"!==this._desiredProjection||!this._model.length)return"flat";const e=this._isoSceneKey()||`${this._space}|invalid`;if(this._isoFallback.has(e))return"flat";try{const e=this._isoScene();return e?(t="iso",i=e.key,n=this._isoFallback,"iso"===t&&i&&!n.has(i)?"iso":"flat"):"flat"}catch(t){if(!this._isoFallback.has(e)){this._isoFallback.add(e);const i=e.split("|");console.warn(`HOUSEPLAN ISO FALLBACK: #89, space ${this._space}, fingerprint ${i[i.length-1]}, ${t instanceof Error?t.message:"renderer error"}`)}return"flat"}var t,i,n}_scenePoint(e){return"iso"===this._renderProjection?z_(e,0):e}_floorView(e){if("iso"!==this._renderProjection)return e;const t=P_([e.x,e.y]),i=P_([e.x+e.w,e.y+e.h]);return{x:t[0],y:t[1],w:i[0]-t[0],h:i[1]-t[1]}}_baseVb(){if("iso"===this._effectiveProjection()){if(!this._spaceDisplayForRender().showBorders){const e=I_({rect:this._frameOf().rect,wallHeight:xa(64,this._cellCm)});return[e.x,e.y,e.w,e.h]}const e=this._isoScene()?.frame??this._frameOf().rect;return[e.x,e.y,e.w,e.h]}const e=this._frameOf().rect;return[e.x,e.y,e.w,e.h]}get _outliers(){return this._showFar?0:this._frameOf().outliers}_fitFar(){this._showFar=!0,this._frame=null,this._resetZoom()}_fitAll(){this._showFar=!0,this._frame=null,this._resetZoom()}_renderFarHint(){return this._kiosk||"view"!==this._mode||this._booting||!this._outliers?G:B`<div class="farhint">
      <ha-icon icon="mdi:map-marker-alert-outline"></ha-icon>
      <span>${this._t("canvas.far_objects",{n:this._outliers})}</span>
      <button class="btn ghostbtn" @click=${()=>this._fitFar()}>${this._t("canvas.show_far")}</button>
    </div>`}_renderHomeArrow(){if(this._booting)return G;const e=this._view;if(!e||!e.w||!e.h)return G;const t=this._baseVb(),i=t[0],n=t[1],r=t[2],o=t[3];if(!(i+r<=e.x||i>=e.x+e.w||n+o<=e.y||n>=e.y+e.h))return G;const s=Math.atan2(n+o/2-(e.y+e.h/2),i+r/2-(e.x+e.w/2)),a=50+38*Math.cos(s),l=50+38*Math.sin(s);return B`<button class="homearrow" title=${this._t("canvas.home_tip")}
      style="left:${a.toFixed(1)}%;top:${l.toFixed(1)}%"
      @click=${e=>{e.stopPropagation(),this._fitAll()}}>
      <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${(180*s/Math.PI).toFixed(1)}deg)"></ha-icon>
    </button>`}_stageAspect(){const e=this._stageEl,t=this._baseVb();return e&&e.clientHeight?e.clientWidth/e.clientHeight:t[2]/t[3]}_viewOr(e){return this._view&&this._view.w?this._view:Ri(e,this._stageAspect())}_roomLabelReferenceViewWidth(e){if(!this._markup)return e.w;const t=this._stageEl,i=this.renderRoot.querySelector(".editorchrome");if(!t||t.clientWidth<=0||t.clientHeight<=0)return e.w;const n=t.clientHeight+(i?.getBoundingClientRect().height||0);return n<=0?e.w:this._viewForModeTarget(this._zoom,void 0,void 0,t.clientWidth,n).w}_screenToVb(e,t){const i=this._stageEl,n=this._viewOr(this._baseVb()),r=i?.clientWidth||1,o=i?.clientHeight||1;return[n.x+e/r*n.w,n.y+t/o*n.h]}_clampView(e,t){const i=(e,t,i,n)=>{const r=1*Math.max(t,n),o=i-r,s=i+n-t+r;return Math.max(Math.min(o,s),Math.min(Math.max(o,s),e))};return{w:e.w,h:e.h,x:i(e.x,e.w,t.x,t.w),y:i(e.y,e.h,t.y,t.h)}}_applyView(e,t,i){const n=this._baseVb(),r=Ri(n,this._stageAspect()),o=Math.min(Cm.ZOOM_MAX,Math.max(Cm.ZOOM_MIN,e)),s=r.w/o,a=r.h/o,l=this._viewOr(n),c=t??l.x+l.w/2,h=i??l.y+l.h/2,d=this._clampView({x:c-s/2,y:h-a/2,w:s,h:a},r);return!(this._view&&Math.abs(this._zoom-o)<1e-9&&Math.abs(this._view.x-d.x)<1e-6&&Math.abs(this._view.y-d.y)<1e-6&&Math.abs(this._view.w-d.w)<1e-6&&Math.abs(this._view.h-d.h)<1e-6)&&("opening"===this._tool&&(this._cursorPt=null,this._clearOpeningPlacement(!1)),this._zoom=o,this._view=d,!0)}_bootWatch(){clearTimeout(this._bootTimer),this._bootStart=Date.now(),this._bootLastH=-1,this._bootLastChange=this._bootStart;const e=()=>{if(!this._booting)return;const t=Date.now(),i=this._stageEl?this._stageEl.clientHeight:0;i!==this._bootLastH&&(this._bootLastH=i,this._bootLastChange=t);const n=t-this._bootStart;n>=1200||n>=700&&i>0&&t-this._bootLastChange>=250?this._bootSettled():this._bootTimer=window.setTimeout(e,100)};this._bootTimer=window.setTimeout(e,100)}_bootSettled(){this._booting&&!this._bootSettling&&(this._bootSettling=!0,this._refitView(),this._bootSettleRaf=requestAnimationFrame(()=>{this._bootSettleRaf=0,this._finishBootSettled()}))}_finishBootSettled(){if(!this._booting)return;this._refitView(),this._booting=!1,this._bootSettling=!1;const e=this._stageEl?.clientHeight??0;!this._config?.kiosk&&e>0&&this._warmPatch({hdrH:this._hdrH,stageH:e,vp:this._warmViewportState()},!0),this._bootFading=!0,this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220),this._bootSoft=!0,clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},am)}_bootSoftCancel(){this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoft=!1)}_beginResumeSettle(){this._booting||this._resumeSettling||(this._modeTransitionPreparing?this._modeTransitionForceAtomic=!0:this._cancelModeTransition(!0),this._viewportInvalidAt=0,this._beginContinuityCandidate("warm-resume",!1),this._loading?this.requestUpdate():this._loadFromServer())}_refitView(){if(this._modeTransitionBusy||this._warmModeRequest)return;const e=this._stageEl;if(!e||"visible"!==document.visibilityState||e.clientWidth<=0||e.clientHeight<=0)return void(this._viewportInvalidAt||(this._viewportInvalidAt=Date.now()));const t=[e.clientWidth,e.clientHeight],i=this._lastValidStageSize,n=!!i&&Math.abs(i[0]-t[0])<=.5&&Math.abs(i[1]-t[1])<=.5,r=this._viewportInvalidAt?Date.now()-this._viewportInvalidAt:0;if(this._viewportInvalidAt=0,!i)return this._lastValidStageSize=t,void(this._view||this._applyView(this._zoom));n?this._pendingRefitSize=null:(this._pendingRefitSize=t,this._refitRaf||(this._refitRaf=requestAnimationFrame(()=>{this._refitRaf=0;const e=this._pendingRefitSize;this._pendingRefitSize=null;const t=this._stageEl;if(!e||!t||t.clientWidth<=0||t.clientHeight<=0)return;if(Math.abs(t.clientWidth-e[0])>.5||Math.abs(t.clientHeight-e[1])>.5)return void this._refitView();const i=this._lastValidStageSize;if(i&&Math.abs(i[0]-e[0])<=.5&&Math.abs(i[1]-e[1])<=.5)return;this._lastValidStageSize=e;const n=this._view;r>=wl?this._beginContinuityCandidate("stage-size-restored",!0,"stage-size"):this._continuity.hasCompleteFrame&&this._beginContinuityCandidate("stage-resize",!0,"stage-size"),this._applyView(this._zoom,n?n.x+n.w/2:void 0,n?n.y+n.h/2:void 0)})))}_zoomAt(e,t,i){const n=this._stageEl;if(!n)return;const r=Ri(this._baseVb(),this._stageAspect()),o=Math.min(Cm.ZOOM_MAX,Math.max(Cm.ZOOM_MIN,i));"opening"===this._tool&&(this._cursorPt=null,this._clearOpeningPlacement(!1));const s=n.clientWidth,a=n.clientHeight,l=this._screenToVb(e,t),c=r.w/o,h=r.h/o;this._zoom=o,this._view=this._clampView({x:l[0]-e/s*c,y:l[1]-t/a*h,w:c,h:h},r)}_onWheel(e){const t=this._stageEl;if(!t)return;e.preventDefault();const i=t.getBoundingClientRect(),n=e.deltaY<0?1.15:1/1.15;this._zoomAt(e.clientX-i.left,e.clientY-i.top,this._zoom*n),this._saveZoom()}_stepZoom(e){const t=this._stageEl;t&&(this._zoomAt(t.clientWidth/2,t.clientHeight/2,this._zoom*(e>0?1.4:1/1.4)),this._saveZoom())}_resetZoom(){const e=this._baseVb();"opening"===this._tool&&(this._cursorPt=null,this._clearOpeningPlacement(!1)),this._zoom=1,this._view=Ri(e,this._stageAspect()),this._saveZoom()}_saveZoom(){if("view"===this._mode){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(gm,JSON.stringify(this._zoomBySpace))}catch{}}}_restoreZoom(){const e=this._zoomBySpace[this._space]||1;this._zoom=e;const t=this._stageEl;if(t&&t.clientHeight){const t=this._baseVb();return this._applyView(e,t[0]+t[2]/2,t[1]+t[3]/2),void this.requestUpdate()}this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const t=this._baseVb();this._applyView(e,t[0]+t[2]/2,t[1]+t[3]/2),this.requestUpdate()})}_stagePointerDown(e){if(this._vacFit)return;if(this._kiosk&&(this._cyclePausedUntil=Date.now()+6e4,0===this._pointers.size?(this._swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId},e.target.closest?.(".dev, .roomlabel, .oplock")||(clearTimeout(this._kioskHoldTimer),this._kioskHoldTimer=window.setTimeout(()=>{this._kioskDialog=!0,this._swipeStart=null},3e3))):(this._swipeStart=null,clearTimeout(this._kioskHoldTimer))),this._drag)return;if(this._markup&&e.target.closest?.(".roomlabel, .rlhandle, .rszhandle, .dev, .oplock, .op-hit, button"))return;if("devices"===this._mode&&e.target.closest(".dev"))return;if("decor"===this._mode&&this._decorPointerDown(e))return;this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const t=this._viewOr(this._baseVb());if(1===this._pointers.size)this._panStart={sx:e.clientX,sy:e.clientY,vx:t.x,vy:t.y},this._panLock=null,this._suppressClick=!1;else if(2===this._pointers.size){"opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover();const e=[...this._pointers.values()],t=Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y);this._pinchStart={dist:t,zoom:this._zoom},this._panStart=null,this._panLock=null}}get _swipeZone(){return!this._hasFixedFloor&&this._kiosk&&this._zoom<=1.001&&this._model.length>1}_stagePointerMove(e){if(this._physicalRotate?.pid!==e.pointerId)if(this._physicalDrag?.pid!==e.pointerId)if(this._dtDrag?.pid!==e.pointerId)if(this._bdDrag?.pid!==e.pointerId){if(this._decorDraft?.pid===e.pointerId){const t=this._decorDraft;let i=this._decorSnap(this._svgPoint(e),e.pointerType);if(e.shiftKey&&("rect"===t.kind||"ellipse"===t.kind)){const e=i[0]-t.a[0],n=i[1]-t.a[1],r=Math.max(Math.abs(e),Math.abs(n));i=this._snap([t.a[0]+(e<0?-r:r),t.a[1]+(n<0?-r:r)])}return void(this._decorDraft={...t,b:i})}if(this._decorMove?.pid!==e.pointerId)if(this._pointers.has(e.pointerId)){if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._markup&&1===this._pointers.size&&this._markupMove(e),this._pinchStart&&this._pointers.size>=2){"opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover();const e=[...this._pointers.values()],t=Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),n=(e[0].x+e[1].x)/2-i.left,r=(e[0].y+e[1].y)/2-i.top;this._zoomAt(n,r,this._pinchStart.zoom*t),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const t=e.clientX-this._panStart.sx,i=e.clientY-this._panStart.sy;Math.abs(t)+Math.abs(i)>4&&(this._suppressClick=!0,clearTimeout(this._holdTimer),"opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover()),null===this._panLock&&Math.abs(t)+Math.abs(i)>8&&(this._panLock=this._swipeZone&&Math.abs(t)>1.5*Math.abs(i)?"swipe":"pan");const n=this._stageEl;if("pan"===this._panLock&&n){const e=this._baseVb(),r=this._viewOr(e),o=Ri(e,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-t/(n.clientWidth||1)*r.w,y:this._panStart.vy-i/(n.clientHeight||1)*r.h,w:r.w,h:r.h},o)}}}else this._markupMove(e);else this._decorMoveUpdate(e)}else this._bdMove(e);else this._dtMove(e);else this._physicalMove(e);else this._physicalRotateMove(e)}_stagePointerLeave(e){this._markup&&("opening"===this._tool?(this._cursorPt=null,this._clearOpeningPlacement(!1)):"draw"===this._tool&&this._clearPlanSnapHover())}_stagePointerUp(e){if(this._kiosk){clearTimeout(this._kioskHoldTimer);const t=this._swipeStart;if(this._swipeStart=null,t&&t.id===e.pointerId){const i=e.clientX-t.x,n=e.clientY-t.y;if(Math.abs(i)+Math.abs(n)<8){const e=Date.now();e-this._lastTap<350&&this._resetZoom(),this._lastTap=e}const r="pan"===this._panLock?null:function(e,t,i,n,r,o=60){if(i>1.001||n.length<2)return null;if(Math.abs(e)<o||Math.abs(e)<1.5*Math.abs(t))return null;const s=n.indexOf(r);if(s<0)return null;const a=n.length;return e<0?n[(s+1)%a]:n[(s-1+a)%a]}(i,n,this._zoom,this._model.map(e=>e.id),this._space);r&&this._slideTo(r,i<0?"left":"right")&&(this._saveNav(),this._suppressClick=!0,setTimeout(()=>this._suppressClick=!1,0),this._showKioskDots())}}if(this._physicalDrag?.pid===e.pointerId)return void this._physicalUp(e);if(this._physicalRotate?.pid===e.pointerId)return void this._physicalRotateUp(e);if(this._dtDrag?.pid===e.pointerId)return void this._dtUp();if(this._bdDrag?.pid===e.pointerId)return void this._bdUp();if(this._decorDraft?.pid===e.pointerId)return void this._decorCommitDraft();if(this._decorMove?.pid===e.pointerId)return this._decorMove.moved&&(this._recordGeometry(this._t("history.decor_move"),this._decorMove.before),this._saveConfig()),void(this._decorMove=null);const t=!!this._pinchStart||!!this._panStart;this._pointers.delete(e.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,this._panLock=null,setTimeout(()=>this._suppressClick=!1,0)),t&&0===this._pointers.size&&this.requestUpdate()}_clickRoom(e){!this._suppressClick&&e.area&&Mm("/config/areas/area/"+e.area)}_pointerDown(e,t){if("plan"===this._mode)return;if("view"===this._mode){this._holdFired=!1,clearTimeout(this._holdTimer);const i=e.pointerId,n=e.currentTarget;return void(this._holdTimer=window.setTimeout(()=>{this._holdFired=!0,this._interruptViewGesture(i,n),this._infoCard=t},600))}if("ha_disabled"===t.bindingStatus?.kind)return;e.preventDefault();const i=this._pos(t);this._drag={id:t.id,sx:e.clientX,sy:e.clientY,ox:i.x,oy:i.y,moved:!1},Tm(e),this._tip=null}_pointerMove(e,t){if(!this._drag||this._drag.id!==t.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const n=this._baseVb(),r=i.getBoundingClientRect(),o=this._viewOr(n),s=(e.clientX-this._drag.sx)/r.width*o.w,a=(e.clientY-this._drag.sy)/r.height*o.h;Math.abs(e.clientX-this._drag.sx)+Math.abs(e.clientY-this._drag.sy)>3&&(this._drag.moved=!0,clearTimeout(this._holdTimer));const l=qa(this._drag.ox+s),c=qa(this._drag.oy+a);this._savePos(t,l,c)}_pointerUp(e,t){if(clearTimeout(this._holdTimer),!this._drag||this._drag.id!==t.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=t.id,window.setTimeout(()=>this._drag=null,0))}_showToast(e){for(const e of this.renderRoot.querySelectorAll("hp-dialog"))e.closeTransientOverlays("toast");this._toast=e,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}_syncPointerHoverTargets(){const e=this._pointerModality.hoverEnabled;for(const t of this.renderRoot.querySelectorAll(bm))t.toggleAttribute("data-pointer-hover",e)}_syncPointerHoverSubtree(e){if(e.nodeType!==Node.ELEMENT_NODE)return;const t=e,i=this._pointerModality.hoverEnabled;t.matches(bm)&&t.toggleAttribute("data-pointer-hover",i);for(const e of t.querySelectorAll(bm))e.toggleAttribute("data-pointer-hover",i)}_clearTransientHover(e=!1){e&&this._pointerModality.suspend(),this._tip&&(this._tip=null),this._hoverRoom&&(this._hoverRoom=null)}_notePointer(e){const t=this._pointerModality.modality,i=this._pointerModality.note(e);"touch"!==i&&"pen"!==i||t===i&&!this._tip&&!this._hoverRoom||this._clearTransientHover()}_guardTouchGesture(e){if(this._editorSecondary?.handleOutsideDismiss(e))return;if("click"===e.type){if(!this._suppressClick&&!this._touchSequenceMultitouch&&Date.now()>this._touchClickBlockUntil)return;return e.preventDefault(),void e.stopImmediatePropagation()}const t=e;if(this._notePointer(t),"touch"===t.pointerType)if("pointerdown"!==e.type){if("pointermove"===e.type){const e=this._touchContacts.get(t.pointerId);if(!e)return;const i={...e,x:t.clientX,y:t.clientY};if(this._touchContacts.set(t.pointerId,i),this._touchSequenceMultitouch&&"view"===this._mode&&!this._vacFit&&this._pinchStart&&[...this._touchContacts.values()].every(e=>e.inStage)){this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=[...this._touchContacts.values()];if(e.length>=2&&this._stageEl){const[t,i]=e,n=Math.hypot(t.x-i.x,t.y-i.y)/(this._pinchStart.dist||1),r=this._stageEl.getBoundingClientRect();this._zoomAt((t.x+i.x)/2-r.left,(t.y+i.y)/2-r.top,this._pinchStart.zoom*n),this._saveZoom()}}return}if("pointerup"===e.type||"pointercancel"===e.type||"lostpointercapture"===e.type){if(this._clearTransientHover(),this._touchContacts.delete(t.pointerId),this._touchSequenceMultitouch){if(this._touchClickBlockUntil=Date.now()+500,this._pointers.delete(t.pointerId),!this._vacFit&&this._pointers.size>=2){const[e,t]=[...this._pointers.values()];this._pinchStart={dist:Math.hypot(e.x-t.x,e.y-t.y),zoom:this._zoom}}else this._pinchStart=null;0===this._pointers.size&&(this._panStart=null,this._panLock=null)}0===this._touchContacts.size&&(this._touchSequenceMultitouch=!1)}}else if(this._touchContacts.set(t.pointerId,{x:t.clientX,y:t.clientY,inStage:!!t.target?.closest?.(".stage")}),this._touchContacts.size>=2){this._clearTransientHover(),this._touchSequenceMultitouch=!0,this._touchClickBlockUntil=Number.POSITIVE_INFINITY,clearTimeout(this._holdTimer),clearTimeout(this._kioskHoldTimer),this._swipeStart=null;const e=[...this._touchContacts.values()];if("view"===this._mode&&!this._vacFit&&e.every(e=>e.inStage)){this._pointers=new Map([...this._touchContacts].map(([e,t])=>[e,{x:t.x,y:t.y}]));const[t,i]=e;this._pinchStart={dist:Math.hypot(t.x-i.x,t.y-i.y),zoom:this._zoom},this._panStart=null,this._panLock=null}else this._vacFit&&(this._pointers.clear(),this._pinchStart=null,this._panStart=null,this._panLock=null)}}_showTip(e,t,i,n,r,o){this._notePointer(e),this._pointerModality.hoverEnabled&&(this._drag||(this._tip={x:e.clientX,y:e.clientY,title:t,meta:i,lqi:n,temp:r,hum:o}))}get _gridPitch(){return Ea}get _cellCm(){const e=Number(this._curSpaceCfg?.cell_cm);return Number.isFinite(e)&&e>0?e:5}_fmtLen(e,t){const i=function(e,t,i,n){return Math.hypot(t[0]-e[0],t[1]-e[1])/i*n}(e,t,this._gridPitch,this._cellCm);return Kt(i,"mi"===this.hass?.config?.unit_system?.length)}get _curSpaceCfg(){const e=this._resize?.preview;return e&&e.space===this._space?e.sp:this._serverCfg?.spaces.find(e=>e.id===this._space)}get _renderCfg(){const e=this._resize?.preview;return e&&this._serverCfg?{...this._serverCfg,spaces:this._serverCfg.spaces.map(t=>t.id===e.space?e.sp:t)}:this._serverCfg}get _spaceH(){return this._curSpaceCfg,wm}get _segments(){const e=this._curSpaceCfg,t=this._spaceH;return Jt(e?.rooms||[]).map(e=>[e[0]*wm,e[1]*t,e[2]*wm,e[3]*t])}_savedNav(){if(this._hasFixedFloor)return null;try{return JSON.parse(localStorage.getItem(fm)||"null")}catch{return null}}_saveNav(){if(!this._hasFixedFloor)try{localStorage.setItem(fm,JSON.stringify({space:this._space}))}catch{}}_leaveCardRoute(){if(this._routeDepartureHandled)return;this._routeDepartureHandled=!0,"view"!==this._mode&&this._setMode("view",!1),this._pendingNavMode=null,this._geometryHistory.clear(),this._activeDraftId=null,this._resumeDraftBySpace={},this._draftSegmentCms=[],this._closingWallCm=null,this._drawWallField=null,this._showHidden=!1,this._tapConfirm=null,this._vacCalConfirm=null,this._decorEraseConfirm=null,this._openingInfo=null,this._closeInfoCard(),this._rulesDialog=null,this._alignDialog=null,this._preflightClipboardFallback=null,this._backupImportDialog=null,this._backupExportDialog=null,this._settingsDialog=null,this._deviceInbox=null,this._deviceInboxReturn=null,this._markerDialog=null,this._openingDialog=null,this._physicalDialog=null,this._wallDialog=null,this._backdropDialog=null,this._decorShapeDialog=null,this._decorTextDialog=null,this._mergeDialog=null,this._roomDialog=!1,this._spaceDialog=null,this._importDialog=null;const e=this._warmSlot;e?.owner===this._warmGen&&(e.vp=this._warmViewportState(),e.dlg=null,e.frameFingerprint="",clearTimeout(e.evict),e.evict=0),this._saveNav()}_setMode(e,t=!0){return this._warmModeRequest=0,this._editorRuntime?this._editorRuntime._setMode(e,t):"view"===e?void this._editorModeRequest++:void this._requestMode(e,t)}_primeDrawWallField(){return this._editorRuntimeOrThrow()._primeDrawWallField()}get _drawWallFieldValue(){return null===this._drawWallField?fo(15,this._imperial):this._drawWallField}get _drawWallCm(){const e=(e=>{const t=String(e??"").trim().replace(",",".");if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t))return null;const i=Number(t);return Number.isFinite(i)?i:null})(this._drawWallFieldValue);if(null==e||e<0)return null;const t=this._imperial?2.54*e:e,i="column"===this._tool?Xs:100;return t>=("column"===this._tool?1:0)&&t<=i?t:null}get _drawWallMaxCm(){return"column"===this._tool?Xs:100}_showPhysicalRange(e=this._drawWallMaxCm,t=0){return this._editorRuntimeOrThrow()._showPhysicalRange(e,t)}_draftSegmentCount(e=this._curSpaceCfg){return this._editorRuntimeOrThrow()._draftSegmentCount(e)}_mergeSpacePartitions(e,t){return this._editorRuntimeOrThrow()._mergeSpacePartitions(e,t)}_finishWallChain(){return this._editorRuntimeOrThrow()._finishWallChain()}_activateMarkupTool(e){return this._editorRuntimeOrThrow()._activateMarkupTool(e)}_limitReached(e){return this._editorRuntimeOrThrow()._limitReached(e)}_svgPoint(e){return this._editorRuntimeOrThrow()._svgPoint(e)}_snap(e){return this._editorRuntimeOrThrow()._snap(e)}_snapDrawPoint(e,t=!1){return this._editorRuntimeOrThrow()._snapDrawPoint(e,t)}_planSnapOpeningCuts(e,t){return this._editorRuntimeOrThrow()._planSnapOpeningCuts(e,t)}_planSnapGeometrySnapshot(){return this._editorRuntimeOrThrow()._planSnapGeometrySnapshot()}_hiddenWallDiagnosticSnapshot(){return this._editorRuntimeOrThrow()._hiddenWallDiagnosticSnapshot()}_planStructuralGeometrySnapshot(){return this._editorRuntimeOrThrow()._planStructuralGeometrySnapshot()}_planSnapContextKey(e){return this._editorRuntimeOrThrow()._planSnapContextKey(e)}_resolvePlanDrawPoint(e,t){return this._editorRuntimeOrThrow()._resolvePlanDrawPoint(e,t)}get _activePlanSnapCandidate(){if(!this._markup||"draw"!==this._tool)return null;const e=this._planSnapHover;if(!e)return null;const t=this._planSnapGeometrySnapshot();return e.contextKey===this._planSnapContextKey(t.key)?e.candidate:null}get _activePlanSnapConflicts(){if(!this._markup||"draw"!==this._tool)return[];const e=this._planSnapHover;if(!e)return[];const t=this._planSnapGeometrySnapshot();return e.contextKey===this._planSnapContextKey(t.key)?e.conflicts:[]}_clearPlanSnapHover(e=!0){return this._editorRuntime?this._editorRuntimeOrThrow()._clearPlanSnapHover(e):(this._planSnapHover=null,void(e&&(this._cursorPt=null)))}_samePt(e,t){return oi(e,t)}_dropLegacySegments(){return this._editorRuntimeOrThrow()._dropLegacySegments()}_rollbackRejectedPhysicalWrites(e){return this._editorRuntimeOrThrow()._rollbackRejectedPhysicalWrites(e)}async _reloadRejectedPhysicalWrite(){return this._editorRuntimeOrThrow()._reloadRejectedPhysicalWrite()}get _cfgWriting(){return this._writesPending>0}async _sendConfigCandidate(e){const t=so(e),i=await this.hass.callWS({type:"houseplan/config/set",config:t,expected_rev:this._cfgRev});this._cfgRev=i?.rev??this._cfgRev+1}_writeConfig(){if(this._editorRuntime)return this._editorRuntime._writeConfig();this._writesPending++,this._writeChain=Xp(this._writeChain,async()=>{if(!this._serverCfg)return;const e=so(this._serverCfg),t=Rl(e);t!==Rl(this._serverCfg)&&(this._serverCfg=e),this._cfgContentFingerprint=t,await this._sendConfigCandidate(e)});return this._writeChain.finally(()=>{this._writesPending--})}_saveConfig(){this._cfgEpoch++,this._saveConfigDebounced()}_geometrySnapshotFromConfig(e,t){return this._editorRuntimeOrThrow()._geometrySnapshotFromConfig(e,t)}_geometrySnapshot(e=this._space){return this._editorRuntimeOrThrow()._geometrySnapshot(e)}_recordGeometry(e,t){return this._editorRuntimeOrThrow()._recordGeometry(e,t)}_restoreGeometryStateInConfig(e,t,i=!1){return this._editorRuntimeOrThrow()._restoreGeometryStateInConfig(e,t,i)}_restoreGeometryStateLocal(e){return this._editorRuntimeOrThrow()._restoreGeometryStateLocal(e)}_wallModelBlockerLabel(e){return this._editorRuntimeOrThrow()._wallModelBlockerLabel(e)}_hasLegacyZeroWallFields(e=this._serverCfg){return this._editorRuntimeOrThrow()._hasLegacyZeroWallFields(e)}_showWallModelMigrationBlocked(e){return this._editorRuntimeOrThrow()._showWallModelMigrationBlocked(e)}_limitSegmentsOf(e){return this._editorRuntimeOrThrow()._limitSegmentsOf(e)}_junctionLimitViolations(e,t,i){return this._editorRuntimeOrThrow()._junctionLimitViolations(e,t,i)}_junctionLimitLabel(e){return this._editorRuntimeOrThrow()._junctionLimitLabel(e)}_junctionLimitsIntroduced(e,t,i){return this._editorRuntimeOrThrow()._junctionLimitsIntroduced(e,t,i)}_commitPhysicalGeometry(e,t,i=[]){return this._editorRuntimeOrThrow()._commitPhysicalGeometry(e,t,i)}_clearGeometryGesture(){return this._editorRuntime?this._editorRuntimeOrThrow()._clearGeometryGesture():(this._path=[],this._planSnapHover=null,this._cursorPt=null,this._openingHoverCandidate=null,this._openingJambBlockCm=null,this._openingPreset=null,this._openingRebindId=null,this._mergeSel=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._wallFaceBatch=null,this._wallRepairDiagnostic=null,this._roomDeleteDialog=null,this._wallDialog=null,this._physicalDialog=null,this._physicalSel=null,this._physicalDrag=null,this._physicalRotate=null,this._activeDraftId=null,this._draftSegmentCms=[],this._closingWallCm=null,this._openingDialog=null,this._resize?.reset(),this._decorDraft=null,this._decorMove=null,this._dtDrag=null,void(this._bdDrag=null))}_stagePointerCancel(e){if(this._editorRuntime)return this._editorRuntime._stagePointerCancel(e)}_applyGeometryState(e,t=!1){return this._editorRuntimeOrThrow()._applyGeometryState(e,t)}_roomAt(e){return this._editorRuntimeOrThrow()._roomAt(e)}_overlapRoom(e){return this._editorRuntimeOrThrow()._overlapRoom(e)}_pointInRoom(e,t){return t.poly?si(e,t.poly):null!=t.x&&e[0]>=t.x&&e[0]<=t.x+t.w&&e[1]>=t.y&&e[1]<=t.y+t.h}_contourSelfIntersects(e){return this._editorRuntimeOrThrow()._contourSelfIntersects(e)}_canAppendRoomDraftPoint(){return this._editorRuntimeOrThrow()._canAppendRoomDraftPoint()}_markupClick(e){if(this._editorRuntime)return this._editorRuntime._markupClick(e)}_draftEndAt(e,t){return this._editorRuntimeOrThrow()._draftEndAt(e,t)}_mergeDraftEndpoint(e){return this._editorRuntimeOrThrow()._mergeDraftEndpoint(e)}_adoptDraftCms(e,t,i){return this._editorRuntimeOrThrow()._adoptDraftCms(e,t,i)}_draftSegmentsForPath(e,t,i){return this._editorRuntimeOrThrow()._draftSegmentsForPath(e,t,i)}_persistActiveDraftSegment(){return this._editorRuntimeOrThrow()._persistActiveDraftSegment()}_activeWallSourceKey(e){return this._editorRuntimeOrThrow()._activeWallSourceKey(e)}_wallGraphSources(e){return this._editorRuntimeOrThrow()._wallGraphSources(e)}_wallFaceGraph(e,t){return this._editorRuntimeOrThrow()._wallFaceGraph(e,t)}_offerWallFaces(e,t=this._path.length-2,i){return this._editorRuntimeOrThrow()._offerWallFaces(e,t,i)}_beginWallFaceBatch(e){return this._editorRuntimeOrThrow()._beginWallFaceBatch(e)}_offerExistingWallFace(e){return this._editorRuntimeOrThrow()._offerExistingWallFace(e)}_columnClick(e){return this._editorRuntimeOrThrow()._columnClick(e)}_openPhysicalDialog(e,t,i){return this._editorRuntimeOrThrow()._openPhysicalDialog(e,t,i)}_physicalDown(e,t,i){return this._editorRuntimeOrThrow()._physicalDown(e,t,i)}_clampPhysicalDelta(e,t,i){return this._editorRuntimeOrThrow()._clampPhysicalDelta(e,t,i)}_physicalMove(e){return this._editorRuntimeOrThrow()._physicalMove(e)}_physicalUp(e){return this._editorRuntimeOrThrow()._physicalUp(e)}_registerPhysicalTap(e,t,i){return this._editorRuntimeOrThrow()._registerPhysicalTap(e,t,i)}_cancelPhysicalGesture(){return this._editorRuntimeOrThrow()._cancelPhysicalGesture()}_physicalRotateDown(e,t){return this._editorRuntimeOrThrow()._physicalRotateDown(e,t)}_physicalRotateMove(e){return this._editorRuntimeOrThrow()._physicalRotateMove(e)}_physicalRotateUp(e){return this._editorRuntimeOrThrow()._physicalRotateUp(e)}_rszRooms(){return this._editorRuntimeOrThrow()._rszRooms()}_rszOpenings(){return this._editorRuntimeOrThrow()._rszOpenings()}_rszObstacles(){return this._editorRuntimeOrThrow()._rszObstacles()}_rszOptsFor(e,t){return this._editorRuntimeOrThrow()._rszOptsFor(e,t)}_rszResolution(e,t,i){return this._editorRuntimeOrThrow()._rszResolution(e,t,i)}_rszSnapshot(){return this._editorRuntimeOrThrow()._rszSnapshot()}_rszResetController(){return this._editorRuntimeOrThrow()._rszResetController()}_rszProjectPreview(e,t,i,n,r){return this._editorRuntimeOrThrow()._rszProjectPreview(e,t,i,n,r)}_rszAcceptPreview(e,t){return this._editorRuntimeOrThrow()._rszAcceptPreview(e,t)}_rszSpaceCandidateGeometry(e,t){return this._editorRuntimeOrThrow()._rszSpaceCandidateGeometry(e,t)}_rszSpaceCandidateRenderable(e,t){return this._editorRuntimeOrThrow()._rszSpaceCandidateRenderable(e,t)}_rszCandidateRenderable(e){return this._editorRuntimeOrThrow()._rszCandidateRenderable(e)}_rszEdgeDown(e,t,i){return this._editorRuntimeOrThrow()._rszEdgeDown(e,t,i)}_rszReasonText(e){return this._editorRuntimeOrThrow()._rszReasonText(e)}_rszDisabledActivate(e,t){return this._editorRuntimeOrThrow()._rszDisabledActivate(e,t)}_rszDisabledKey(e,t){return this._editorRuntimeOrThrow()._rszDisabledKey(e,t)}_rszMove(e){return this._editorRuntimeOrThrow()._rszMove(e)}_rszUp(e){return this._editorRuntimeOrThrow()._rszUp(e)}_rszCancelDrag(e){return this._editorRuntimeOrThrow()._rszCancelDrag(e)}_rszPointerCancel(e){return this._editorRuntimeOrThrow()._rszPointerCancel(e)}_rszEdgeLabels(e,t,i=this._resize?.rooms){return this._editorRuntimeOrThrow()._rszEdgeLabels(e,t,i)}_rszInnerSpanCms(e,t,i){return this._editorRuntimeOrThrow()._rszInnerSpanCms(e,t,i)}_renderResizeMeasurements(){return this._editorRuntimeOrThrow()._renderResizeMeasurements()}_renderResizeLayer(e){return this._editorRuntimeOrThrow()._renderResizeLayer(e)}get _openingsR(){const e=this._curSpaceCfg,t=this._spaceH,i=this._spaceModel();return i?(e?.openings||[]).flatMap(e=>{const n={...e,rx:e.x*wm,ry:e.y*t,rlen:e.length*wm};if(!e.host||"wall"===e.host.kind)return[n];const r=Td(e,i.partitions,wm,this._cellCm,this._gridPitch);if(!r.resolved)return"plan"===this._mode?[{...n,orphanReason:r.reason||"invalid-host"}]:[];let[o,s]=r.resolved.center;const a=this._physicalDrag;return a?.moved&&"partition"===a.kind&&a.id===e.host.id&&(o+=a.delta[0],s+=a.delta[1]),[{...e,rx:o,ry:s,rlen:r.resolved.length,angle:r.resolved.angle,partitionHost:r.resolved}]}):[]}_partitionOpeningCuts(e=this._spaceModel(),t=()=>!0){if(!e)return[];return Gp(Up(this._curSpaceCfg?.id===e.id?this._curSpaceCfg:null,e,this._cellCm,this._gridPitch,wm),t)}_roomWallOpeningInputs(e=this._openingsR,t=this._spaceModel()){if(!t)return[];const i=this._openCuts();return Vp(e,t,this._spaceWalls,i,this._wallKeyPitch,this._cellCm,this._gridPitch,wm)}_openingFace(e,t,i){return e.partitionHost?Od(e.partitionHost,i):Vs(t,{x:e.rx,y:e.ry,angle:e.angle,length:e.rlen,flip_v:i})}_cmToUnits(e){return e/this._cellCm*this._gridPitch}get _decorList(){const e=this._curSpaceCfg;return Array.isArray(e?.decor)?e.decor:[]}get _decorH(){return wm}_decorResolvedStyle(e){return function(e,t,i,n=ur){const r="rect"===e?.kind||"ellipse"===e?.kind,o=e,s=qt(o?.color,n.color);return{color:s,opacity:pr(o?.opacity,n.opacity),widthCm:yr(e,t,i,n.widthCm),fill:!!r&&!0===o?.fill,fillColor:qt(o?.fill_color,o?.fill?s:n.fillColor),fillOpacity:r&&o?.fill?pr(o?.fill_opacity,.25):n.fillOpacity}}(e,this._cellCm,this._gridPitch,ur)}_decorWidthUnits(e){return((e,t,i,n=ur.widthCm)=>{const r=Number(e?.width_cm);if(Number.isFinite(r)&&r>0)return fr(r,t,i);const o=Number(e?.width);return Number.isFinite(o)&&o>0?o:fr(n,t,i)})(e,this._cellCm,this._gridPitch,ur.widthCm)}_decorTextSizeCm(e){if("text"===e?.kind){const t=Number(e.size_cm);return Number.isFinite(t)&&t>0?t:vr(20*Gi(e),this._cellCm,this._gridPitch)}return vr(20,this._cellCm,this._gridPitch)}_decorTextUnits(e){if("text"!==e.kind)return 20;const t=Number(e.size_cm);return Number.isFinite(t)&&t>0?fr(t,this._cellCm,this._gridPitch):20*Gi(e)}_decorSmallField(e){return Math.round(100*(this._imperial?e/2.54:e))/100}_decorSmallCm(e){const t=this._imperial?2.54*e:e;return Number.isFinite(t)?Math.max(.1,Math.min(100,t)):.1}_decorTextCm(e){const t=this._imperial?2.54*e:e;return Number.isFinite(t)?Math.max(.1,Math.min(2e3,t)):.1}_decorLargeField(e){return Math.round(100*(this._imperial?e/30.48:e/100))/100}_decorLargeCm(e){const t=this._imperial?30.48*e:100*e;return Number.isFinite(t)?Math.max(.1,Math.min(Pa*this._cellCm,t)):.1}_angleField(e){const t=Number(e);return Number.isFinite(t)?String(Number(t.toFixed(3))):"0"}_decorBoxOf(e){return"rect"!==e.kind&&"ellipse"!==e.kind&&"furniture"!==e.kind?null:{x:e.x*wm,y:e.y*this._decorH,w:e.w*wm,h:e.h*this._decorH,angle:_r(e.angle)||void 0}}_decorSnapGeometry(e){return this._editorRuntimeOrThrow()._decorSnapGeometry(e)}_decorSnap(e,t="mouse",i){return this._editorRuntimeOrThrow()._decorSnap(e,t,i)}_replaceDecor(e,t){return this._editorRuntimeOrThrow()._replaceDecor(e,t)}_cancelDecorGesture(){return this._editorRuntimeOrThrow()._cancelDecorGesture()}_decorPointerDown(e){return this._editorRuntimeOrThrow()._decorPointerDown(e)}_decorCommitDraft(){return this._editorRuntimeOrThrow()._decorCommitDraft()}_decorShapeDown(e,t){return this._editorRuntimeOrThrow()._decorShapeDown(e,t)}_decorMoveUpdate(e){return this._editorRuntimeOrThrow()._decorMoveUpdate(e)}_decorShapeDbl(e,t){if(this._editorRuntime)return this._editorRuntime._decorShapeDbl(e,t)}_openDecorProperties(e){return this._editorRuntimeOrThrow()._openDecorProperties(e)}_decorOpenText(e){return this._editorRuntimeOrThrow()._decorOpenText(e)}_decorRememberTextSelection(e){return this._editorRuntimeOrThrow()._decorRememberTextSelection(e)}_decorInsertLiveVariable(e){return this._editorRuntimeOrThrow()._decorInsertLiveVariable(e)}_decorSaveText(){return this._editorRuntimeOrThrow()._decorSaveText()}_decorSaveShape(){return this._editorRuntimeOrThrow()._decorSaveShape()}get _dtSel(){return"decor"===this._mode&&"select"===this._decorTool&&this._decorSel&&this._decorList.find(e=>e.id===this._decorSel)||null}_dtPivot(e){return this._editorRuntimeOrThrow()._dtPivot(e)}_dtApply(e,t){return this._editorRuntimeOrThrow()._dtApply(e,t)}_dtStart(e,t,i,n){return this._editorRuntimeOrThrow()._dtStart(e,t,i,n)}_dtMove(e){return this._editorRuntimeOrThrow()._dtMove(e)}_dtUp(){return this._editorRuntimeOrThrow()._dtUp()}_dtMeasure(){return this._editorRuntimeOrThrow()._dtMeasure()}_deleteDecor(e){return this._editorRuntimeOrThrow()._deleteDecor(e)}_decorDeleteSel(){return this._editorRuntimeOrThrow()._decorDeleteSel()}_confirmDecorErase(){return this._editorRuntimeOrThrow()._confirmDecorErase()}get _furnWalls(){const e=this._rawPhysicalBodiesR().flatMap(e=>e.map((t,i)=>{const n=e[(i+1)%e.length];return[t[0],t[1],n[0],n[1]]}));return[...this._segments,...e]}get _furnWallReach(){return 6*this._gridPitch}_furnFieldValue(e){return this._editorRuntimeOrThrow()._furnFieldValue(e)}_furnFieldToCm(e){return this._editorRuntimeOrThrow()._furnFieldToCm(e)}_furnPick(e){return this._editorRuntimeOrThrow()._furnPick(e)}_furnPlace(e,t=!1){return this._editorRuntimeOrThrow()._furnPlace(e,t)}_furnMoveUpdate(e){return this._editorRuntimeOrThrow()._furnMoveUpdate(e)}_decorApplyBox(e,t){return this._editorRuntimeOrThrow()._decorApplyBox(e,t)}get _furnLive(){const e=this._dtDrag;if(!e||"scale"!==e.kind||!e.orig)return null;const t=this._decorList.find(t=>t.id===e.id);if(!t||"furniture"!==t.kind)return null;const i=wm,n=this._decorH,r=t.w*i,o=t.h*n,s=function(e,t,i,n,r){const o=e+i/2,s=t+n/2,a=(Number(r)||0)*Math.PI/180,l=Math.cos(a),c=Math.sin(a),h=(e,t)=>{const i=e-o,n=t-s;return[o+i*l-n*c,s+i*c+n*l]};return[h(e,t),h(e+i,t),h(e+i,t+n),h(e,t+n)]}(t.x*i,t.y*n,r,o,Number(t.angle)||0),a=(e,t)=>[(e[0]+t[0])/2,(e[1]+t[1])/2],l=a(s[0],s[1]),c=a(s[0],s[3]);return[{x:l[0],y:l[1],text:this._fmtLen([0,0],[r,0])},{x:c[0],y:c[1],text:this._fmtLen([0,0],[0,o])}]}_renderFurnPalette(){return this._editorRuntimeOrThrow()._renderFurnPalette()}get _bdBase(){const e=this._curSpaceCfg;return e?.plan_url?{...Ta(e.plan_aspect,wm)}:null}get _bdRect(){const e=this._curSpaceCfg;return e?.plan_url?Aa(e,wm):null}get _bdParams(){const e=this._curSpaceCfg,t=Number(e?.plan_x),i=Number(e?.plan_y),n=Number(e?.plan_scale),r=Number(e?.plan_scale_x),o=Number(e?.plan_scale_y),s=Number.isFinite(n)&&n>0?n:1;return{dx:Number.isFinite(t)?t:0,dy:Number.isFinite(i)?i:0,sx:Number.isFinite(r)&&r>0?r:s,sy:Number.isFinite(o)&&o>0?o:s,angle:_r(e?.plan_angle)}}_openBackdropDialog(e){if(this._editorRuntime)return this._editorRuntime._openBackdropDialog(e)}_saveBackdropDialog(){return this._editorRuntimeOrThrow()._saveBackdropDialog()}get _bdActive(){return"decor"===this._mode&&!!this._bdRect&&"backdrop"===this._decorTool}get _bdMovable(){return"decor"===this._mode&&"backdrop"===this._decorTool&&!!this._bdRect}_bdApply(e,t,i,n,r){return this._editorRuntimeOrThrow()._bdApply(e,t,i,n,r)}_bdStart(e,t,i=!1){return this._editorRuntimeOrThrow()._bdStart(e,t,i)}_bdMove(e){return this._editorRuntimeOrThrow()._bdMove(e)}get _bdMoved(){if("decor"!==this._mode||!this._bdRect)return!1;const e=this._bdParams;return 0!==e.dx||0!==e.dy||1!==e.sx||1!==e.sy||0!==e.angle}_bdReset(){return this._editorRuntimeOrThrow()._bdReset()}_bdUp(){return this._editorRuntimeOrThrow()._bdUp()}get _bdLive(){if(!this._bdDrag)return null;const e=this._bdRect;return e?{x:e.x+e.w/2,y:e.y+e.h/2,text:`${this._fmtLen([0,0],[e.w,0])} × ${this._fmtLen([0,0],[0,e.h])}`}:null}_renderBackdropFrame(e){return this._editorRuntime?this._editorRuntimeOrThrow()._renderBackdropFrame(e):G}_renderTextFrame(e){const t=this._dtSel,i=this._dtBox;if(!t||!i||i.id!==t.id)return G;const n=.018*Math.max(e.w,e.h),r=n/4;if("line"===t.kind){const e=[t.x1*wm,t.y1*this._decorH],i=[t.x2*wm,t.y2*this._decorH];return W`<g class="dtframe dtlineframe">
        <line class="dtbox" x1="${e[0]}" y1="${e[1]}" x2="${i[0]}" y2="${i[1]}"></line>
        ${[e,i].map((e,t)=>W`<circle class="dthandle dtendpoint" cx="${e[0]}" cy="${e[1]}"
          r="${n.toFixed(1)}" @pointerdown=${e=>this._dtStart(e,"scale",void 0,t)}></circle>
          <circle class="dtknob" cx="${e[0]}" cy="${e[1]}" r="${r.toFixed(2)}"></circle>`)}
      </g>`}const[o,s]=this._dtPivot(t),a=Number(t.angle)||0,l=2.2*n;return W`<g class="dtframe" transform=${a?`rotate(${a} ${o} ${s})`:G}>
      <rect class="dtbox" x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}"></rect>
      <line class="dtstem" x1="${i.x+i.w/2}" y1="${i.y}" x2="${i.x+i.w/2}" y2="${i.y-l}"></line>
      <circle class="dthandle dtrot" cx="${i.x+i.w/2}" cy="${i.y-l}" r="${n.toFixed(1)}"
        @pointerdown=${e=>this._dtStart(e,"rotate")}></circle>
      <circle class="dtknob" cx="${i.x+i.w/2}" cy="${i.y-l}" r="${r.toFixed(2)}"></circle>
      ${[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]].map(([e,t,o])=>W`<circle class="dthandle dt-${o}"
        cx="${e<0?i.x:i.x+i.w}" cy="${t<0?i.y:i.y+i.h}" r="${n.toFixed(1)}"
        @pointerdown=${i=>this._dtStart(i,"scale",[e,t])}></circle><circle class="dtknob"
        cx="${e<0?i.x:i.x+i.w}" cy="${t<0?i.y:i.y+i.h}" r="${r.toFixed(2)}"></circle>`)}
    </g>`}_renderDecorLayer(){const e=wm,t=this._decorH,i="decor"===this._mode,n=i&&"erase"===this._decorTool,r=this._decorList.map(r=>{const o="dshape"+(i&&this._decorSel===r.id?" dsel":""),s=this._decorResolvedStyle(r),a=this._decorWidthUnits(r),l=e=>this._decorShapeDown(e,r),c=e=>this._decorShapeDbl(e,r);if("line"===r.kind)return W`<line class="${o}" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          x1="${r.x1*e}" y1="${r.y1*t}" x2="${r.x2*e}" y2="${r.y2*t}"
          stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${a}"
          stroke-dasharray=${"dashed"===r.line_style?`${4*a} ${3*a}`:G}
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${l} @dblclick=${c}></line>
          ${i&&"select"===this._decorTool?W`<line class="dshape dselecthit"
            data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            x1="${r.x1*e}" y1="${r.y1*t}" x2="${r.x2*e}" y2="${r.y2*t}"
            @pointerdown=${l} @dblclick=${c}></line>`:G}
          ${n?W`<line class="dshape derasehit" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            x1="${r.x1*e}" y1="${r.y1*t}" x2="${r.x2*e}" y2="${r.y2*t}"
            @pointerdown=${l}></line>`:G}`;if("rect"===r.kind){const i=(r.x+r.w/2)*e,h=(r.y+r.h/2)*t,d=_r(r.angle);return W`<rect class="${o}" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          x="${r.x*e}" y="${r.y*t}" width="${r.w*e}" height="${r.h*t}"
          stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${a}"
          fill="${s.fill?s.fillColor:"none"}" fill-opacity="${s.fill?s.fillOpacity:0}"
          transform=${d?`rotate(${d} ${i} ${h})`:G}
          @pointerdown=${l} @dblclick=${c}></rect>
          ${n?W`<rect class="dshape derasehit" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            x="${r.x*e}" y="${r.y*t}" width="${r.w*e}" height="${r.h*t}"
            transform=${d?`rotate(${d} ${i} ${h})`:G} @pointerdown=${l}></rect>`:G}`}if("ellipse"===r.kind){const i=(r.x+r.w/2)*e,h=(r.y+r.h/2)*t,d=_r(r.angle);return W`<ellipse class="${o}" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          cx="${i}" cy="${h}"
          rx="${r.w/2*e}" ry="${r.h/2*t}" stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${a}"
          fill="${s.fill?s.fillColor:"none"}" fill-opacity="${s.fill?s.fillOpacity:0}"
          transform=${d?`rotate(${d} ${i} ${h})`:G}
          @pointerdown=${l} @dblclick=${c}></ellipse>
          ${n?W`<ellipse class="dshape derasehit" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
            cx="${i}" cy="${h}" rx="${r.w/2*e}" ry="${r.h/2*t}"
            transform=${d?`rotate(${d} ${i} ${h})`:G} @pointerdown=${l}></ellipse>`:G}`}if("furniture"===r.kind){const i=r.w*e,h=r.h*t,d=vl(r.symbol,i,h);if(!d)return G;const u=Number(r.angle)||0,p=r.x*e+i/2,_=r.y*t+h/2,m=`${u?`rotate(${u} ${p} ${_}) `:""}translate(${r.x*e} ${r.y*t})`;return W`<path class="${o} dfurn" data-hp="decor" data-id="${r.id}"
          data-kind="${r.kind}" data-symbol="${r.symbol}" d="${d}" transform=${m}
          stroke="${s.color}" stroke-opacity="${s.opacity}" stroke-width="${a}" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${l} @dblclick=${c}></path>
          ${n?W`<path class="dshape derasehit" data-hp="decor" data-id="${r.id}"
            data-kind="${r.kind}" data-symbol="${r.symbol}" d="${d}" transform=${m}
            @pointerdown=${l}></path>`:G}`}if("text"===r.kind){const i=this._decorTextUnits(r),n=this._renderDeviceSnapshot?.facts.get(`decor:${this._space}:${r.id}`),a=function(e){return String(e??"").replace(/\r\n?/g,"\n").split("\n")}("string"==typeof n?n:Wi(r.text,r,this._renderPlanHass,e=>this._renderEntityAvailable(e))),h=r.x*e,d=r.y*t,u=Number(r.angle)||0,p=d-(a.length-1)*i*1.2/2;return W`<text class="${o} dtext" data-hp="decor" data-id="${r.id}" data-kind="${r.kind}"
          x="${h}" y="${d}" fill="${s.color}" fill-opacity="${s.opacity}"
          font-size="${i}" transform=${u?`rotate(${u} ${h} ${d})`:G}
          @pointerdown=${l} @dblclick=${c}>${a.map((e,t)=>W`<tspan x="${h}" y="${p+t*i*1.2}">${e}</tspan>`)}</text>`}return G});let o=G;const s=this._decorDraft;if(s){const e=this._decorStyle,t=fr(e.widthCm,this._cellCm,this._gridPitch);if("line"===s.kind)o=W`<line class="ddraft" x1="${s.a[0]}" y1="${s.a[1]}" x2="${s.b[0]}" y2="${s.b[1]}"
          stroke="${e.color}" stroke-opacity="${e.opacity}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"></line>`;else{const i=Math.min(s.a[0],s.b[0]),n=Math.min(s.a[1],s.b[1]),r=Math.abs(s.b[0]-s.a[0]),a=Math.abs(s.b[1]-s.a[1]);o="rect"===s.kind?W`<rect class="ddraft" x="${i}" y="${n}" width="${r}" height="${a}" stroke="${e.color}"
              stroke-opacity="${e.opacity}" stroke-width="${t}" fill="${e.fill?e.fillColor:"none"}" fill-opacity="${e.fill?e.fillOpacity:0}"></rect>`:W`<ellipse class="ddraft" cx="${i+r/2}" cy="${n+a/2}" rx="${r/2}" ry="${a/2}"
              stroke="${e.color}" stroke-opacity="${e.opacity}" stroke-width="${t}" fill="${e.fill?e.fillColor:"none"}" fill-opacity="${e.fill?e.fillOpacity:0}"></ellipse>`}}return W`<g class="decorlayer">${r}${o}</g>`}get _editorToolbarGroups(){return"plan"!==this._mode?[]:[{id:"opening",label:this._t("markup.opening"),icon:"mdi:door",activeItemId:"opening"===this._tool?this._openingPreset?.type:void 0,items:[{id:"window",label:this._t("opening.window"),icon:"mdi:window-closed-variant",role:"tool",invoke:()=>this._activateOpeningPlacement("window")},{id:"door",label:this._t("opening.door"),icon:"mdi:door-open",role:"tool",invoke:()=>this._activateOpeningPlacement("door")},{id:"passage",label:this._t("opening.passage"),icon:"mdi:arch",role:"tool",invoke:()=>this._activateOpeningPlacement("passage")},{id:"gate",label:this._t("opening.gate"),icon:"mdi:gate",role:"tool",invoke:()=>this._activateOpeningPlacement("gate")}]}]}_renderEditorGroupLauncher(e){return this._editorRuntimeOrThrow()._renderEditorGroupLauncher(e)}get _editorSecondaryContextId(){const e=`editor:${this._mode}:${this._space}:${this._cfgEpoch}`,t=this._editorSecondary?.activeGroup(this._editorToolbarGroups);if(t)return`${e}:group:${t.id}:${this._editorSecondary?.groupGeneration}`;if("plan"===this._mode){const t=this._physicalSel;return t?`${e}:selection:${t.kind}:${t.id}:${t.segment??""}`:`${e}:tool:${this._tool}:${this._path.length}`}return"decor"===this._mode?"furniture"===this._decorTool?`${e}:palette:furniture:${this._furnPalette?.symbol||"none"}`:"select"===this._decorTool&&this._decorSel?`${e}:selection:decor:${this._decorSel}`:`${e}:tool:${this._decorTool}:${this._bdMoved?1:0}:${this._bdDrag?1:0}`:`${e}:none`}_runEditorContext(e,t){return this._editorRuntimeOrThrow()._runEditorContext(e,t)}_renderEditorGroupModel(e){return this._editorRuntimeOrThrow()._renderEditorGroupModel(e)}_renderDrawWallControl(){return this._editorRuntimeOrThrow()._renderDrawWallControl()}_renderPlanSecondary(){return this._editorRuntimeOrThrow()._renderPlanSecondary()}_renderDecorSecondary(){return this._editorRuntimeOrThrow()._renderDecorSecondary()}_withBackdropReset(e){return this._editorRuntimeOrThrow()._withBackdropReset(e)}get _editorSecondaryDialogBlocked(){return!!(this._tapConfirm||this._vacCalConfirm||this._roomDialog||this._mergeDialog||this._openingDialog||this._physicalDialog||this._openingInfo||this._decorTextDialog||this._decorShapeDialog||this._backdropDialog||this._decorEraseConfirm||this._spaceDialog||this._markerDialog||this._deviceInbox||this._infoCard||this._rulesDialog||this._settingsDialog||this._alignDialog||this._importDialog||this._kioskDialog||this._backupExportDialog||this._backupImportDialog||this._wallDialog)}_renderEditorSecondary(){return this._editorRuntimeOrThrow()._renderEditorSecondary()}_renderDecorBar(){return this._editorRuntimeOrThrow()._renderDecorBar()}_renderDecorEraseConfirm(){return this._editorRuntimeOrThrow()._renderDecorEraseConfirm()}_renderDecorTextDialog(){return this._editorRuntimeOrThrow()._renderDecorTextDialog()}_renderDecorShapeDialog(){return this._editorRuntimeOrThrow()._renderDecorShapeDialog()}_renderBackdropDialog(){return this._editorRuntimeOrThrow()._renderBackdropDialog()}_cssPxToRender(e){return this._editorRuntimeOrThrow()._cssPxToRender(e)}_renderZeroWalls(e){if(e&&!e.showBorders&&!this._editing)return W``;const t=this._zeroWalls();if(!t.lines.length)return W``;const i=e?.color||"var(--hp-muted)";return W`<g class="zero-walls ${t.style}"
      data-zero-wall-style=${t.style} style="--zero-wall-stroke:${i}">
      ${t.lines.map(e=>W`<line class="zero-wall"
        x1="${e[0]}" y1="${e[1]}" x2="${e[2]}" y2="${e[3]}"></line>`)}
    </g>`}_zeroWalls(){const e=this._spaceModel();return e?up(this._curSpaceCfg,e,wm,.02*this._gridPitch):{style:lp(this._curSpaceCfg),lines:[],contour:[],barriers:[],transmissive:[]}}_openCuts(){return this._zeroWalls().contour}_deleteRoomClick(e){return this._editorRuntimeOrThrow()._deleteRoomClick(e)}get _wallKeyPitch(){return Na}get _spaceWalls(){const e=this._curSpaceCfg?.walls;return Array.isArray(e)?e:[]}_cfgOpenCuts(){const e=this._curSpaceCfg,t=this._spaceModel();if(!e||!t)return[];const i=cp(e,1),n=dp(e,t.rooms,wm,.02*this._gridPitch).map(e=>e.map(e=>e/wm)),r=new Set;return[...i,...n].filter(e=>{const t=e.map(e=>Number(e).toFixed(9)).join(","),i=[e[2],e[3],e[0],e[1]].map(e=>Number(e).toFixed(9)).join(","),n=t<i?t:i;return!r.has(n)&&(r.add(n),!0)})}_intervalCm(e){const t=this._spaceModel();return t?ys(t.rooms,this._spaceWalls,this._openCuts(),e,this._wallKeyPitch,this._cellCm,this._gridPitch,wm):0}_normalizeWalls(e,t){const i=this._spaceModel();if(!i)return[];return Oo(vs(i.rooms,e,t,this._wallKeyPitch,this._cellCm,this._gridPitch,wm),this._curSpaceCfg?.rooms||[],Na,1,t.map(e=>[e[0]/wm,e[1]/wm,e[2]/wm,e[3]/wm]))}_paperShapes(e){if(!this._spaceWalls.length)return Xt(e);const t=this._wallUnionGeometry();return t?.paperD?[{path:t.paperD}]:Xt(e)}_wallUnionGeometry(){const e=this._spaceModel();if(!e)return null;const t=this._spaceWalls,i=this._physicalBodiesR();if(!t.length&&!i.length)return null;const n=`${this._space}|${this._cfgEpoch}|${e.rooms.length}`;if(!this._wallUnionCache||this._wallUnionCache.key!==n){const r=lm(this._wallUnionPool,n);if(r.hit)this._wallUnionCache=r.value;else{const r=this._openCuts(),o=this._roomWallOpeningInputs(),s=Hs(e.rooms,t,r,o,this._wallKeyPitch,this._cellCm,this._gridPitch,wm,i);s&&Object.defineProperty(s,"sourceFingerprint",{value:Rl([this._curSpaceCfg,this._cellCm,this._gridPitch]),enumerable:!1});const a={key:n,value:s};cm(this._wallUnionPool,n,a,8),this._wallUnionCache=a}}return this._wallUnionCache.value}_thickWallCuts(){const e=this._spaceModel();if(!e)return[];const t=this._spaceWalls;if(!t.length)return[];const i=this._openCuts();return qs(e.rooms,t,i,this._wallKeyPitch,this._cellCm,this._gridPitch,wm).map(e=>[e.a[0],e.a[1],e.b[0],e.b[1]])}_innerRoomContour(e,t,i=this._openCuts(),n=this._wallUnionGeometry()?.roomGeom,r=this._wallUnionGeometry()?.multiWallNodes){const o=i.map(e=>e.join(",")).join(";"),s=`${e.id}|${this._cfgEpoch}|${t}|${o}`,a=lm(this._innerContourCache,s);if(a.hit)return a.value;const l=ks(e.rooms,t,this._spaceWalls,i,this._wallKeyPitch,this._cellCm,this._gridPitch,wm,n,r);return cm(this._innerContourCache,s,l,600),l}_wallThickHit(e){return this._editorRuntimeOrThrow()._wallThickHit(e)}get _wallThickHover(){if(!this._markup||"wallthick"!==this._tool||!this._cursorPt||this._wallDialog)return null;const e=this._wallThickHit(this._cursorPt);if(!e)return null;const t=function(e,t,i){const n=Number.isFinite(e)&&e>0?e:0,r=Number.isFinite(t)&&t>0?t:5,o=Number.isFinite(i)&&i>0?i:0;return n>0?vo(n,r,o)/2:xa(1.5*o,r)}(e.cm,this._cellCm,this._gridPitch);let i="";for(const n of e.segs)i+=(i?" ":"")+Ko([[n[0],n[1]],[n[2],n[3]]],t,!1);return{segs:e.segs,open:e.open,d:i}}_wallThickClick(e){return this._editorRuntimeOrThrow()._wallThickClick(e)}_wallThickApply(e){return this._editorRuntimeOrThrow()._wallThickApply(e)}_wallHatchDefs(e){const t=_o(this._cellCm);return W`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
        width="${t}" height="${t}" patternTransform="rotate(45)">
        <path d="M0 0 L0 ${t}" stroke="${e||"#607d8b"}" stroke-width="${t/8*2}"></path>
      </pattern>
    </defs>`}_resolvedRoomFills(e,t){const i=new Map,n=new Map;for(const r of e.rooms){const e=this._roomDialog&&r.id===this._roomEditId?this._roomFill||t.fill:Rn(t.fill,r),o=this._roomDialog&&r.id===this._roomEditId?this._roomCustomFill||t.customFill:en(t.customFill,r),s=an(e,"lqi"===e&&r.area?this._roomLqi(r.area):null,"light"===e?Th(Mh(this._renderPlanHass,this._renderDevices,r,this._virtualLights)):"none","temp"===e?this._roomTemp(r):null,t.tempMin,t.tempMax,this._fillColors,o);i.set(r,s),r.id&&n.set(r.id,s)}return{byRoom:i,byId:n}}_spaceDisplayForRender(){const e=tn(this._curSpaceCfg),t=this._spaceDialog;return t&&"edit"===t.mode&&t.spaceId===this._space?{...e,showBorders:t.showBorders,showNames:t.showNames,hideDecor:t.hideDecor,hideOpenings:t.hideOpenings,color:t.roomColor,opacity:t.roomOpacity,fill:t.fillMode,customFill:t.customFill?Qi(t.customFill):Ji,glow:t.glowEnabled,tempMin:t.tempMin,tempMax:t.tempMax,showLqi:t.showLqi,cardFontScale:t.cardFontScale,labelTemp:t.labelTemp,labelHum:t.labelHum,labelLqi:t.labelLqi,labelLight:t.labelLight}:e}_openingWallIndexFor(e,t){const i=e.rooms.map(e=>`${e.id}:${e.poly?.map(e=>e.join(",")).join("/")||`${e.x},${e.y},${e.w},${e.h}`}`).join(";"),n=this._spaceWalls.map(e=>`${e.key}:${e.a?.join(",")||""}:${e.b?.join(",")||""}:${e.cm}`).join(";"),r=t.map(e=>e.join(",")).join(";"),o=[e.id,this._cfgEpoch,this._wallKeyPitch,this._cellCm,this._gridPitch,i,n,r].join("|");let s=this._openingWallIndexCache.get(o);return s||(s=Bs(e.rooms,this._spaceWalls,t,this._wallKeyPitch,this._cellCm,this._gridPitch,wm)),cm(this._openingWallIndexCache,o,s,4),{key:o,value:s}}_renderOpeningTunnelFills(e,t,i="data"){if(this._markup||!this._spaceWalls.length||!this._openingsR.length)return W``;if("glow-base"===i&&![...t.byRoom.values()].some(Boolean))return W``;const n=this._openCuts(),r=this._openingsR.map(e=>({x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),o=r.map(e=>`${e.x},${e.y},${e.angle},${e.length}`).join(";"),s=this._openingWallIndexFor(e,n),a=`${s.key}|${o}`;return this._openingTunnelCache&&this._openingTunnelCache.key===a||(this._openingTunnelCache={key:a,value:Zs(s.value,r)}),Xu({openings:this._openingsR,geometries:this._openingTunnelCache.value,fillsByRoomId:t.byId,idPrefix:`${e.id}-${i}`,groupClass:"data"===i?"opening-tunnels":"opening-tunnels glow-base-tunnels",dataLayer:i})}_resolvedGlowBase(e,t,i){const n=new Map,r=new Map,o=this._fillColors.glow_base;for(const s of e.rooms){const e=i.byRoom.get(s),a=Tn(t.glow,s)&&(!e||e.opacity<=0)?{color:o.c,opacity:o.a,mode:"glow"}:null;n.set(s,a),s.id&&r.set(s.id,a)}return{byRoom:n,byId:r}}_renderGlowBaseRooms(e,t){if(this._markup||![...t.byRoom.values()].some(Boolean))return W``;const i=new Map(e.rooms.map(e=>[e,Zt(e)])),n=this._openCuts(),r=this._wallUnionGeometry()?.roomGeom,o=e=>"M "+e.map(e=>e[0]+" "+e[1]).join(" L ")+" Z",s=e.rooms.map(s=>{const a=t.byRoom.get(s)||null,l=i.get(s)||null;if(!a||!l)return G;const c=this._spaceWalls.length&&s.id&&this._innerRoomContour(e,s.id,n,r)||l,h=vi(c,e.rooms.filter(e=>e!==s).map(e=>i.get(e)).filter(e=>!!e)),d=this._cleanFloor(s,c,e).path;return d||h.length?W`<path class="glow-base" data-room-id=${s.id||G}
          d="${[d||o(c),...h.map(o)].join(" ")}"
          fill=${a.color} fill-opacity=${a.opacity} fill-rule="evenodd"
          pointer-events="none"></path>`:s.poly||c!==l?W`<polygon class="glow-base" data-room-id=${s.id||G}
          points="${c.map(e=>e.join(",")).join(" ")}"
          fill=${a.color} fill-opacity=${a.opacity} pointer-events="none"></polygon>`:W`<rect class="glow-base" data-room-id=${s.id||G}
        x=${s.x} y=${s.y} width=${s.w} height=${s.h}
        rx=${.03*Math.min(s.w,s.h)}
        fill=${a.color} fill-opacity=${a.opacity} pointer-events="none"></rect>`});return W`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${s}</g>`}_renderWallBodies(e){if("iso"===this._renderProjection)return W``;if(e&&!e.showBorders&&("view"===this._mode||"devices"===this._mode))return W``;const t=this._wallUnionGeometry();if(!t)return W``;const i=this._stageEl,n=this._viewOr(this._baseVb()),r=i&&i.clientWidth&&n.w?i.clientWidth/n.w:1,o=e?.color||"#607d8b",s=po(t.depthUnits,r)||mo(_o(this._cellCm),r),a=this._fillColors.wall_fill;return W`<g class="wallbodies" style="--room-stroke:${o};--wall-fill:${a.c};--wall-fill-op:${a.a}">
      ${t.paths.map(e=>W`
        <path class="wallbody-fill" data-component=${e.id} d="${e.d}"
          fill="${a.c}" fill-opacity="${a.a}" fill-rule=${e.fillRule}
          stroke="none" pointer-events="none"></path>
        <path class="wallbody ${s?"solid":""}"
          data-hp="wall" data-id="union" data-kind="union" data-component=${e.id}
          d="${e.d}" fill="${s?"none":"url(#hp-wall-hatch)"}"
          fill-rule=${e.fillRule}
          stroke="${o}" stroke-width="${xa(.6,this._cellCm)}"
          pointer-events="none"></path>`)}
    </g>`}_isoDecorationLayers(e){const t="undefined"==typeof CSS||"function"!=typeof CSS.supports||CSS.supports("filter","blur(1px)"),i="function"==typeof matchMedia&&matchMedia("(forced-colors: active)").matches;return function(e){const t=!!e.showBorders;return{structural:t,panels:t&&!e.hideOpenings,shadows:t&&e.filtersSupported&&!e.forcedColors,materialNuance:t&&!e.forcedColors,floorSymbols:!e.hideOpenings&&!t}}({showBorders:e.showBorders,hideOpenings:e.hideOpenings,filtersSupported:t,forcedColors:i})}_isoOpeningPanels(e){if(!e.panels)return[];const t=this._isoScene();if(!t)return[];return t.openings.flatMap(e=>{const t=this._openingsR[e.sourceIndex];return t?K_(e,this._openingAmt(t)):[]}).sort((e,t)=>e.depth-t.depth||e.sourceIndex-t.sourceIndex||e.leaf-t.leaf)}_renderIsoDefs(e,t){const i=ka(this._cellCm);return W`<defs>
      ${"walls"===t&&e.materialNuance?W`
        <linearGradient id="hp-iso-wall-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="iso-side-hi"></stop><stop offset="1" class="iso-side-lo"></stop>
        </linearGradient>
        <linearGradient id="hp-iso-wall-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" class="iso-top-hi"></stop><stop offset="1" class="iso-top-lo"></stop>
        </linearGradient>`:G}
      ${"underlay"===t&&e.shadows?W`
        <filter id="hp-iso-ambient-shadow" x="-12%" y="-12%" width="124%" height="130%">
          <feGaussianBlur stdDeviation="${7*i}"></feGaussianBlur>
        </filter>`:G}
      ${"shadows"===t&&e.shadows?W`
        <filter id="hp-iso-contact-shadow" x="-8%" y="-20%" width="116%" height="140%">
          <feGaussianBlur stdDeviation="${2.5*i}"></feGaussianBlur>
        </filter>
        <filter id="hp-iso-leaf-shadow" x="-12%" y="-30%" width="124%" height="160%">
          <feGaussianBlur stdDeviation="${2*i}"></feGaussianBlur>
        </filter>`:G}
    </defs>`}_renderIsoUnderlay(e){if(!e.structural)return W``;const t=this._isoScene()?.floor;return t?W`<g class="iso-underlay" data-hp="iso-underlay" aria-hidden="true" pointer-events="none">
      ${this._renderIsoDefs(e,"underlay")}
      ${e.shadows&&t.footprintPath?W`<path class="iso-ambient-shadow" d=${t.footprintPath}
            transform="translate(0 ${xa(8,this._cellCm)})"></path>`:G}
      <g class="iso-floor-edge">${t.sides.map(e=>W`<path class="iso-floor-side" d=${e.d} data-component=${e.component}
          data-edge=${e.edge}></path>`)}</g>
    </g>`:W``}_renderIsoShadows(e,t){if(!e.shadows)return W``;const i=this._isoScene()?.geometry;return i?W`<g class="iso-shadows" data-hp="iso-shadows" aria-hidden="true" pointer-events="none">
      ${this._renderIsoDefs(e,"shadows")}
      <path class="iso-contact-shadow" d=${i.contactPath}></path>
      <g class="iso-leaf-shadows">${t.map(e=>W`<path class="iso-leaf-shadow" d=${e.shadowD}
          data-id=${e.id} data-leaf=${e.leaf}></path>`)}</g>
    </g>`:W``}_renderIsoWalls(e,t){if("iso"!==this._renderProjection)return W``;if(!e.structural)return W``;const i=this._isoScene();return i?W`<g class="iso-walls" data-hp="iso-walls" data-fingerprint=${i.key}>
      ${this._renderIsoDefs(e,"walls")}
      <g class="iso-wall-sides">${i.geometry.sides.map(e=>W`<path class="iso-wall-side" d=${e.d} data-edge=${e.edge}></path>`)}</g>
      <path class="iso-wall-top" d=${i.geometry.topPath} fill-rule="evenodd"></path>
      ${e.panels?W`<g class="iso-openings" data-hp="iso-openings"
          aria-hidden="true" pointer-events="none">${t.map(e=>W`<path class="iso-opening-panel iso-${e.type}" d=${e.d}
            data-id=${e.id} data-kind=${e.type} data-leaf=${e.leaf}></path>`)}</g>`:G}
    </g>`:W``}_roomHoverPaths(e){const t=this._hoverRoom;if("view"!==this._mode||!t||t.space!==e.id)return null;const i=e.rooms.find(e=>e===t.room||!!e.id&&e.id===t.room.id);if(!i)return null;const n=Zt(i);if(!n)return null;const r=e.rooms.filter(e=>e!==i).map(e=>({room:e,poly:Zt(e)})).filter(e=>!!e.poly),o=vi(n,r.map(e=>e.poly)),s=this._openCuts(),a=.02*this._gridPitch,l=s.filter(e=>{const t=[(e[0]+e[2])/2,(e[1]+e[3])/2];return n.some((e,i)=>Pn(t,[e[0],e[1],...n[(i+1)%n.length]])<=4*a)}),c=this._spaceWalls,h=this._wallUnionGeometry()?.roomGeom,d=c.length&&i.id&&this._innerRoomContour(e,i.id,s,h)||n,u=[{axis:n,face:d}];for(const t of o){const i=r.find(e=>e.poly===t)?.room;let n=t;if(c.length&&i?.id){const r=ms(e.rooms,i.id,c,s,this._wallKeyPitch,this._cellCm,this._gridPitch,wm);r&&(n=js(r.poly,r.offsets)||t)}u.push({axis:t,face:n})}const p=this._roomWallOpeningInputs(this._openingsR,e).map(e=>{const t=e.angle*Math.PI/180,i=Math.cos(t)*e.length/2,n=Math.sin(t)*e.length/2;return[e.x-i,e.y-n,e.x+i,e.y+n]}),_=l.concat(p),m=u.map(({axis:e,face:t})=>{const i=_.map(i=>((e,t,i)=>{const n=e[2]-e[0],r=e[3]-e[1],o=Math.hypot(n,r);if(o<a)return null;const s=n/o,l=r/o,c=(e[0]+e[2])/2,h=(e[1]+e[3])/2;let d=!1;for(let e=0;e<t.length;e++){const i=t[e],n=t[(e+1)%t.length],r=n[0]-i[0],o=n[1]-i[1],u=Math.hypot(r,o);if(!(u<a||Math.abs(s*(o/u)-l*(r/u))>.05)&&Pn([c,h],[i[0],i[1],n[0],n[1]])<=4*a){d=!0;break}}if(!d)return null;let u=null;for(let e=0;e<i.length;e++){const t=i[e],n=i[(e+1)%i.length],r=n[0]-t[0],o=n[1]-t[1],d=Math.hypot(r,o);if(d<a||Math.abs(s*(o/d)-l*(r/d))>.05)continue;const p=Pn([c,h],[t[0],t[1],n[0],n[1]]);(!u||p<u.d)&&(u={a:t,b:n,d:p})}if(!u)return null;const p=u.b[0]-u.a[0],_=u.b[1]-u.a[1],m=Math.hypot(p,_)||1,g=-_/m,f=p/m,v=(u.a[0]-c)*g+(u.a[1]-h)*f;return[e[0]+g*v,e[1]+f*v,e[2]+g*v,e[3]+f*v]})(i,e,t)).filter(e=>!!e);return i.length?kn(t,i,a).map(e=>`M ${e[0]} ${e[1]} L ${e[2]} ${e[3]}`).join(" "):`M ${t.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`}).filter(Boolean).join(" ");if(!m)return null;const g=e=>`M ${e.map(e=>`${e[0]} ${e[1]}`).join(" L ")} Z`;return{fillD:[this._cleanFloor(i,d,e).path||g(d),...o.map(g)].join(" "),outlineD:m}}_renderRoomHoverFill(e){return e?W`<g class="room-hover room-hover-fill-layer" pointer-events="none">
      <path class="room-hover-fill" d="${e.fillD}" fill-rule="evenodd"></path>
    </g>`:W``}_renderRoomHoverOutline(e){return e?W`<g class="room-hover room-hover-outline-layer" pointer-events="none">
      <path class="room-hover-halo" d="${e.outlineD}"></path>
      <path class="room-hover-outline" d="${e.outlineD}"></path>
    </g>`:W``}_renderWallThickUi(){return this._editorRuntime?this._editorRuntimeOrThrow()._renderWallThickUi():W``}_renderWallThickDialog(){return this._editorRuntimeOrThrow()._renderWallThickDialog()}_openingAt(e){return this._editorRuntimeOrThrow()._openingAt(e)}_resolveOpeningPlacement(e){return this._editorRuntimeOrThrow()._resolveOpeningPlacement(e)}_activateOpeningPlacement(e){return this._editorRuntimeOrThrow()._activateOpeningPlacement(e)}_clearOpeningPlacement(e){return this._editorRuntime?this._editorRuntimeOrThrow()._clearOpeningPlacement(e):(this._openingHoverCandidate=null,this._openingJambBlockCm=null,void(e&&(this._openingPreset=null,this._openingRebindId=null)))}_openingClick(e){return this._editorRuntimeOrThrow()._openingClick(e)}_editOpening(e){if(this._editorRuntime)return this._editorRuntimeOrThrow()._editOpening(e)}_opPointerDown(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opPointerDown(e,t)}_opPointerMove(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opPointerMove(e,t)}_opRuler(e,t){return this._editorRuntimeOrThrow()._opRuler(e,t)}_opPointerUp(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opPointerUp(e,t)}_opClick(e,t){if(this._editorRuntime)return this._editorRuntimeOrThrow()._opClick(e,t)}_saveOpening(){return this._editorRuntimeOrThrow()._saveOpening()}_deleteOpening(){return this._editorRuntimeOrThrow()._deleteOpening()}_contactCandidates(){return this._editorRuntimeOrThrow()._contactCandidates()}_lockCandidates(){return this._editorRuntimeOrThrow()._lockCandidates()}_toggleOpeningEntityPicker(e){return this._editorRuntimeOrThrow()._toggleOpeningEntityPicker(e)}_filterOpeningEntities(e,t){return this._editorRuntimeOrThrow()._filterOpeningEntities(e,t)}_selectOpeningEntity(e,t){return this._editorRuntimeOrThrow()._selectOpeningEntity(e,t)}_mergeClick(e){return this._editorRuntimeOrThrow()._mergeClick(e)}_commitMerge(){return this._editorRuntimeOrThrow()._commitMerge()}_splitClick(e){return this._editorRuntimeOrThrow()._splitClick(e)}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])&&(null!=this._closingWallCm||!this._activeDraftId)}_markupMove(e){if(this._markup&&this._editorRuntime)return this._editorRuntime._markupMove(e)}get _openingPreview(){const e=this._openingPreset;if("opening"!==this._tool||!e||!this._cursorPt)return null;const t=this._cursorPt,i=this._openingHoverCandidate;if(i&&nm(i,[t[0],t[1]],e.revision,this._cfgEpoch))return i;if(this._openingAt(t))return this._openingHoverCandidate=null,null;const n=this._resolveOpeningPlacement(t);return this._openingHoverCandidate=n,n}get _opMeasureView(){return this._opMeasure||this._openingPreview?.measure||null}_saveRoom(){return this._editorRuntimeOrThrow()._saveRoom()}_decideWallFace(e){return this._editorRuntimeOrThrow()._decideWallFace(e)}_wallSourceCmAt(e,t,i){return this._editorRuntimeOrThrow()._wallSourceCmAt(e,t,i)}_activePathWithRepair(e,t){return this._editorRuntimeOrThrow()._activePathWithRepair(e,t)}_validateWallRepair(e,t){return this._editorRuntimeOrThrow()._validateWallRepair(e,t)}_applyWallRepair(e,t){return this._editorRuntimeOrThrow()._applyWallRepair(e,t)}_applyWallFaceBatch(){return this._editorRuntimeOrThrow()._applyWallFaceBatch()}_commitRoom(){return this._editorRuntimeOrThrow()._commitRoom()}_cancelPath(){return this._editorRuntimeOrThrow()._cancelPath()}_resumeLastDraft(){return this._editorRuntimeOrThrow()._resumeLastDraft()}_roomDialogCancel(){return this._editorRuntimeOrThrow()._roomDialogCancel()}get _freeAreas(){const e=new Set;for(const t of this._serverCfg?.spaces||[])for(const i of t.rooms||[])i.area&&e.add(i.area);for(const t of this._wallFaceBatch?.decisions||[])t.create&&t.area&&e.add(t.area);return Object.values(this.hass?.areas||{}).filter(t=>!e.has(t.area_id)).sort((e,t)=>(e.name||"").localeCompare(t.name||""))}_openDeviceInbox(){return this._editorRuntimeOrThrow()._openDeviceInbox()}_closeMarkerDialog(){return this._editorRuntimeOrThrow()._closeMarkerDialog()}_deviceInboxCandidates(e){return this._editorRuntimeOrThrow()._deviceInboxCandidates(e)}_deviceInboxRows(){return this._editorRuntimeOrThrow()._deviceInboxRows()}_deviceForInboxRow(e){return this._editorRuntimeOrThrow()._deviceForInboxRow(e)}_openInboxMarker(e,t=!1){return this._editorRuntimeOrThrow()._openInboxMarker(e,t)}async _setInboxHidden(e,t){return this._editorRuntimeOrThrow()._setInboxHidden(e,t)}_findInboxDevice(e){return this._editorRuntimeOrThrow()._findInboxDevice(e)}_deviceInboxTabKey(e){return this._editorRuntimeOrThrow()._deviceInboxTabKey(e)}_openMarkerDialog(e){if(this._editorRuntime)return this._editorRuntime._openMarkerDialog(e);this._ensureEditorRuntime().then(t=>{t&&this._openMarkerDialog(e)})}_runCandidates(){return this._editorRuntimeOrThrow()._runCandidates()}_bindingCandidates(){return this._editorRuntimeOrThrow()._bindingCandidates()}_physicalBodiesR(e=this._spaceModel()){if(!e)return[];const t=`${e.id}|${this._cfgEpoch}|${this._cellCm}|${this._gridPitch}`;if(this._physicalBodiesCache?.key===t)return this._physicalBodiesCache.all;const i=ca(e,this._cellCm,this._gridPitch,2e-4*this._gridPitch,this._partitionOpeningCuts(e));return this._physicalBodiesCache={key:t,...i},i.all}_rawPhysicalBodiesR(e=this._spaceModel()){if(!e)return[];this._physicalBodiesR(e);const t=this._physicalBodiesCache;return t?[...t.drafts,...t.partitions,...t.columns]:[]}_cleanFloor(e,t,i=this._spaceModel()){if(!i)return{floor:t,geom:null,path:"",area:ma([[[...t,t[0]]]])};const n=e.id||`#${i.rooms.indexOf(e)}`,r=`${i.id}|${this._cfgEpoch}|${n}`;if(!this._resize?.preview){const e=lm(this._cleanFloorCache,r);if(e.hit)return e.value}const o=t.map(e=>e[0]),s=t.map(e=>e[1]),a=[Math.min(...o),Math.min(...s),Math.max(...o),Math.max(...s)],l=this._physicalBodiesR(i).filter(e=>{const t=e.map(e=>e[0]),i=e.map(e=>e[1]);return Math.max(...t)>=a[0]&&Math.min(...t)<=a[2]&&Math.max(...i)>=a[1]&&Math.min(...i)<=a[3]}),c=l.length?_a(t,l):null,h={floor:t,geom:c,path:c?ra(c):"",area:ma(c||[[[...t,t[0]]]])};return this._resize?.preview||cm(this._cleanFloorCache,r,h,600),h}_autoIconForBinding(e){if("virtual"===e)return"mdi:map-marker";const[t,i]=e.split(":");if(!i)return"";const n=this._fullRegistryHass,r=this._bindingStatus(e),o="active"===r.kind?r.enabledEntityIds:r.allEntityIds;if("device"===t){const e=n.devices?.[i];if(!e)return"mdi:help-circle";const t=o;return t.some(e=>e.startsWith("lock."))?"mdi:lock":Fh(n,e.name_by_user||e.name||"",e.model,t,this._iconRules)}if("entity"===t){const e=n.entities?.[i],t=this.hass.states?.[i],r=e?.name||t?.attributes?.friendly_name||i;return i.startsWith("lock.")?"mdi:lock":Fh(n,r,"",[i],this._iconRules)}return""}_allRoomsFlat(){const e=[];for(const t of this._serverCfg?.spaces||[])for(const i of t.rooms||[])i.area?e.push({value:t.id+"#"+i.area,label:(t.title||t.id)+" · "+i.name}):i.id&&e.push({value:t.id+"#@"+i.id,label:(t.title||t.id)+" · "+i.name+" · "+this._t("marker.subarea")});return e}_errText(e){if(!e)return this._t("err.unknown");if("string"==typeof e)return e;if("invalid_passage_fields"===e.code){const t=String(e.message||e.error||"").match(/space=([^;]*);\s*opening=([^;]*);\s*fields=([^;]*)/);if(t){const e=this._serverCfg?.spaces?.find(e=>String(e.id)===t[1]),i={contact:"opening.contact_label",lock:"opening.lock_label",invert:"opening.invert",flip_h:"opening.flip_h",flip_v:"opening.flip_v"},n=t[3].split(",").filter(Boolean).map(e=>i[e]?this._t(i[e]):e).join(", ");return this._t("opening.invalid_passage_fields",{room:e?.title||t[1],fields:n})}}if("invalid_partition_opening_jamb_margin"===e.code){const t=String(e.message||e.error||"").match(/margin_cm=([^;]*)/),i=t?Number(t[1]):NaN;if(Number.isFinite(i))return this._t("opening.partition_jamb_margin",{distance:Kt(i,this._imperial)})}if(e.message)return e.message;if(e.error)return e.error;if(null!=e.code)return this._t("err.code",{code:e.code});try{return JSON.stringify(e)}catch{return String(e)}}_backupErrorText(e){return this._editorRuntimeOrThrow()._backupErrorText(e)}async _pickMarkerFiles(e){return this._editorRuntimeOrThrow()._pickMarkerFiles(e)}_removeMarkerPdf(e){return this._editorRuntimeOrThrow()._removeMarkerPdf(e)}_markerLightFields(e){return this._editorRuntimeOrThrow()._markerLightFields(e)}_markerTapActionFields(e){return this._editorRuntimeOrThrow()._markerTapActionFields(e)}_markerToggleEntityFields(e){return this._editorRuntimeOrThrow()._markerToggleEntityFields(e)}async _saveMarker(){return this._editorRuntimeOrThrow()._saveMarker()}async _deleteMarker(){return this._editorRuntimeOrThrow()._deleteMarker()}_normPos(e,t,i){return{s:e,x:t/wm,y:i/wm}}_spaceDialogUsesOnboardingRuntime(e){return"create"===e&&!this._editorRuntime&&(!!this._onboardingRuntime||0===(this._serverCfg?.spaces.length||0)||this._importTotal>0||this._importQueue.length>0)}_spaceRuntimeOrThrow(){if(!this._onboardingRuntime)throw new Error("Houseplan onboarding runtime is not loaded");return this._onboardingRuntime}_openSpaceDialog(e,t){return this._spaceDialogUsesOnboardingRuntime(e)?this._onboardingRuntime?void this._onboardingRuntime._openSpaceDialog(e,t):void this._ensureOnboardingRuntime().then(i=>{i&&this._spaceRuntimeOrThrow()._openSpaceDialog(e,t)}):this._editorRuntime?this._editorRuntime._openSpaceDialog(e,t):void this._ensureEditorRuntime().then(i=>{i&&this._openSpaceDialog(e,t)})}async _pickPlanFile(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._pickPlanFile(e):this._editorRuntimeOrThrow()._pickPlanFile(e)}_useServerPlan(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._useServerPlan(e):this._editorRuntimeOrThrow()._useServerPlan(e)}async _readPlanAspect(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._readPlanAspect(e):this._editorRuntimeOrThrow()._readPlanAspect(e)}async _deleteServerPlan(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._deleteServerPlan(e):this._editorRuntimeOrThrow()._deleteServerPlan(e)}_renderServerPlans(e){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime(e.mode)?this._onboardingRuntime._renderServerPlans(e):this._editorRuntimeOrThrow()._renderServerPlans(e)}async _saveSpaceDialog(){return this._onboardingRuntime&&this._spaceDialogUsesOnboardingRuntime("create")?this._onboardingRuntime._saveSpaceDialog():this._editorRuntimeOrThrow()._saveSpaceDialog()}async _deleteSpace(){return this._editorRuntimeOrThrow()._deleteSpace()}async _saveConfigNow(){return this._editorRuntimeOrThrow()._saveConfigNow()}_startImport(){return this._onboardingRuntime?this._onboardingRuntime._startImport():this._editorRuntimeOrThrow()._startImport()}_openNextImport(){return this._onboardingRuntime?this._onboardingRuntime._openNextImport():this._editorRuntimeOrThrow()._openNextImport()}_skipImport(){return this._onboardingRuntime?this._onboardingRuntime._skipImport():this._editorRuntimeOrThrow()._skipImport()}_renderImportDialog(){return this._onboardingRuntime?this._onboardingRuntime._renderImportDialog():this._editorRuntimeOrThrow()._renderImportDialog()}_sunGlobal(){const e=this._settingsDialog;return e?{...this._settings,north_deg:e.northDeg??void 0,bg_mode:e.bgMode,sun_rays:e.sunRays}:this._settings}_sunSpace(){const e=this._spaceDialog,t=this._curSpaceCfg?.settings||{};return e&&"edit"===e.mode&&e.spaceId===this._space?{...t,north_deg:e.northDeg??void 0,bg_mode:e.bgMode??void 0,sun_rays:e.sunRays??void 0}:t}_effNorth(){return or(this._sunGlobal(),this._sunSpace())}_effBgMode(){return sr(this._sunGlobal(),this._sunSpace())}_dayCycleState(e=new Date){return(this._modeTransitionVisual?.viewWeight??("view"===this._mode?1:0))<=0||"daynight"!==this._effBgMode()?null:Yn(this._renderPlanHass,e)}_syncDayCycleClock(){const e=this._dayCycleState();this._dayCycleClockKey=e?Zn(e):"";const t="clock"===e?.source&&"hidden"!==this.ownerDocument.visibilityState&&this.isConnected;t&&!this._dayCycleTimer?this._dayCycleTimer=window.setInterval(this._dayCycleTick,3e4):!t&&this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_dayCycleVisibility(e){"hidden"!==e.kind?(this._dayCycleTick(),this._syncDayCycleClock()):this._dayCycleTimer&&(clearInterval(this._dayCycleTimer),this._dayCycleTimer=0)}_effSunRays(){return ar(this._sunGlobal(),this._sunSpace())}_sunNow(){return null!==this._effNorth()?lr(this._renderPlanHass):null}_renderSunRays(e){const t=W``,i=this._modeTransitionVisual?.viewWeight??0;if(this._editing&&i<=0||!this._effSunRays())return this._sunFadeReset(),t;const n=this._effNorth(),r=null!==n?lr(this._renderPlanHass):null;if(!r||r.elevation<=0)return this._sunFadeReset(),t;if(o=r.elevation,Number(o)>=3)this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunOut=!1,this._sunShown=!0;else{if(!this._sunShown)return t;this._sunOut||(this._sunOut=!0,this._sunOutTimer=window.setTimeout(()=>{this._sunOutTimer=0,this._sunShown=!1,this._sunOut=!1,this.requestUpdate()},2e3))}var o;const s=this._zeroWalls(),a=s.barriers.map(e=>e.join(",")).join(";"),l=`${e.id}|${r.azimuth}|${r.elevation}|${n}|${this._cfgEpoch}|${s.style}|${a}`;if(!this._sunRaysCache||this._sunRaysCache.key!==l){const t=e.rooms.map(e=>({id:e.id||"",poly:Zt(e)})).filter(e=>!!e.id&&!!e.poly),i=this._openingsR.filter(e=>"window"===e.type&&"partition"!==e.host?.kind).map(e=>({id:e.id,x:e.rx,y:e.ry,angle:e.angle,length:e.rlen})),o=this._spaceWalls,a=this._openCuts(),c=this._openingWallIndexFor(e,a).value,h={},d={},u=this._wallUnionGeometry()?.roomGeom;if(o.length){for(const i of t){const t=this._innerRoomContour(e,i.id,a,u);t&&(h[i.id]=t)}for(const e of i){const t=Vs(c,{x:e.x,y:e.y,angle:e.angle,length:e.length});t.cm>0&&(d[e.id]=vo(t.cm,this._cellCm,this._gridPitch))}}let p=nr(t,i,r.azimuth,r.elevation,n,o.length?h:void 0,o.length?d:void 0);const _=[...this._physicalBodiesR(e),...s.barriers.map(e=>[[e[0],e[1]],[e[2],e[3]]])];_.length&&(p=p.map(e=>{const t=function(e,t,i){return i>0?e.map(e=>function(e){const t=[...e].sort((e,t)=>e[0]-t[0]||e[1]-t[1]);if(t.length<=2)return t;const i=(e,t,i)=>(t[0]-e[0])*(i[1]-e[1])-(t[1]-e[1])*(i[0]-e[0]),n=[];for(const e of t){for(;n.length>=2&&i(n[n.length-2],n[n.length-1],e)<=0;)n.pop();n.push(e)}const r=[];for(let e=t.length-1;e>=0;e--){const n=t[e];for(;r.length>=2&&i(r[r.length-2],r[r.length-1],n)<=0;)r.pop();r.push(n)}return n.slice(0,-1).concat(r.slice(0,-1))}([...e,...e.map(e=>[e[0]+t[0]*i,e[1]+t[1]*i])])).filter(e=>e.length>=3):e}(_,e.dir,e.len),i=e.polys.map(e=>_a(e,t));return{...e,paths:i.map(ra).filter(Boolean),polys:i.flatMap(fa)}}).filter(e=>e.paths?.length||e.polys.length)),this._sunRaysCache={key:l,rays:p,rims:p.map(e=>function(e,t=1e-4){const[i,n]=e.dir,r=-n,o=i,s=[];for(const a of[e.a,e.b]){const l=[];for(const s of e.polys)for(let e=0;e<s.length;e++){const c=s[e],h=s[(e+1)%s.length];if(Math.abs((c[0]-a[0])*r+(c[1]-a[1])*o)>t)continue;if(Math.abs((h[0]-a[0])*r+(h[1]-a[1])*o)>t)continue;const d=(c[0]-a[0])*i+(c[1]-a[1])*n,u=(h[0]-a[0])*i+(h[1]-a[1])*n;Math.abs(u-d)<=t||l.push(d<u?[d,u]:[u,d])}l.sort((e,t)=>e[0]-t[0]);const c=[];for(const e of l){const i=c[c.length-1];i&&e[0]<=i[1]+t?i[1]=Math.max(i[1],e[1]):c.push([e[0],e[1]])}for(const[e,t]of c)s.push([[a[0]+i*e,a[1]+n*e],[a[0]+i*t,a[1]+n*t]])}return s}(e))}}const c=this._sunRaysCache.rays,h=this._sunRaysCache.rims;if(!c.length)return t;const d=(u=function(e){const t=Math.min(90,Math.max(-90,Number(e)||0));let i=Xn[Xn.length-1][1];for(let e=1;e<Xn.length;e++){const[n,r]=Xn[e-1],[o,s]=Xn[e];if(t<=o){i=sn(r,s,(t-n)/(o-n));break}}return{bg:i,planDim:.1*Jn((10-t)/16),warmth:t<0?1:Jn(1-t/10)}}(r.elevation).warmth,sn("#ffe9c2","#ff9a45",Jn(u)));var u;const p=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]],_=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]];return W`<defs>
        ${c.map((e,t)=>{const i=(e.a[0]+e.b[0])/2,n=(e.a[1]+e.b[1])/2,r=i+e.normal[0]*e.depth,o=n+e.normal[1]*e.depth;return W`<linearGradient id="hp-sun-${t}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${n}" x2="${r}" y2="${o}">
            ${p.map(([e,t])=>W`<stop offset="${(100*e).toFixed(1)}%"
              stop-color="${d}" stop-opacity="${(.3*t).toFixed(4)}"></stop>`)}
          </linearGradient>
          <linearGradient id="hp-sunrim-${t}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${n}" x2="${r}" y2="${o}">
            ${_.map(([e,t])=>W`<stop offset="${(100*e).toFixed(1)}%"
              stop-color="${"#000000"}" stop-opacity="${(.42*t).toFixed(4)}"></stop>`)}
          </linearGradient>`})}
      </defs>
      <g class="sunlayer hp-view-only-layer ${this._sunOut?"out":""}"
        opacity="${this._modeTransitionVisual?.viewWeight??1}">
        ${c.map((e,t)=>e.paths?.length?e.paths.map(e=>W`<path d=${e} fill-rule="evenodd" fill="url(#hp-sun-${t})"></path>`):e.polys.map(e=>W`<polygon
              points="${e.map(e=>e[0]+","+e[1]).join(" ")}" fill="url(#hp-sun-${t})"></polygon>`))}
        ${c.map((e,t)=>(h[t]||[]).map(e=>W`<line class="sunrim"
          x1="${e[0][0]}" y1="${e[0][1]}" x2="${e[1][0]}" y2="${e[1][1]}"
          stroke="url(#hp-sunrim-${t})" stroke-width="1"
          vector-effect="non-scaling-stroke"></line>`))}
      </g>`}_sunFadeReset(){this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunShown=!1,this._sunOut=!1}_compassPoint(e){const t=e.currentTarget.getBoundingClientRect(),i=e.clientX-(t.left+t.width/2),n=e.clientY-(t.top+t.height/2);if(Math.hypot(i,n)<5)return;let r=Math.round(180*Math.atan2(i,-n)/Math.PI);e.shiftKey&&(r=15*Math.round(r/15)),r=(r%360+360)%360,this._settingsDialog={...this._settingsDialog,northDeg:r}}_renderCompass(){const e=this._settingsDialog.northDeg;return B`<svg class="compass ${null===e?"unset":""}" viewBox="-60 -60 120 120"
      @pointerdown=${e=>{e.currentTarget.setPointerCapture(e.pointerId),this._compassDrag=!0,this._compassPoint(e)}}
      @pointermove=${e=>{this._compassDrag&&this._compassPoint(e)}}
      @pointerup=${()=>this._compassDrag=!1}
      @pointercancel=${()=>this._compassDrag=!1}>
      <circle class="cring" r="50"></circle>
      ${[0,45,90,135,180,225,270,315].map(e=>W`<line class="ctick ${e%90?"minor":""}" x1="0" y1="-50" x2="0" y2="${e%90?-46:-43}"
          transform="rotate(${e})"></line>`)}
      <g class="cneedle" transform="rotate(${e??0})">
        <line x1="0" y1="34" x2="0" y2="-28"></line>
        <path d="M -7 -24 L 0 -42 L 7 -24 Z"></path>
        <text x="0" y="-12" text-anchor="middle">${this._t("gs.north_letter")}</text>
      </g>
      <text class="cdeg" x="0" y="26" text-anchor="middle">${null===e?"—":e+"°"}</text>
    </svg>`}_stageBg(e){const t=this._settingsDialog,i=this._spaceDialog,n=t?t.bgColor||"":nn(this._settings,{bgColor:null});return(i&&"edit"===i.mode&&i.spaceId===this._space?i.bgColor||"":e.bgColor||"")||n}_stageBgHex(){const e=this._stageEl;if(e){const t=getComputedStyle(e).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(t)return"#"+t.slice(1,4).map(e=>(+e).toString(16).padStart(2,"0")).join("")}return"#111111"}_preflightDiagnostics(e,t){return this._editorRuntimeOrThrow()._preflightDiagnostics(e,t)}_reportPreflightFailure(e,t){return this._editorRuntimeOrThrow()._reportPreflightFailure(e,t)}_preflightVersionsDiffer(){return this._editorRuntimeOrThrow()._preflightVersionsDiffer()}async _copyPreflightDiagnostics(){return this._editorRuntimeOrThrow()._copyPreflightDiagnostics()}_checkOptimizeGeometry(e){return this._editorRuntimeOrThrow()._checkOptimizeGeometryImpl(e)}_checkSpacePhysicalGeometry(e,t,i){return this._editorRuntimeOrThrow()._checkSpacePhysicalGeometryImpl(e,t,i)}_optimizeReferenceContext(e){return this._editorRuntimeOrThrow()._optimizeReferenceContext(e)}_previewAlignDialog(e){return this._editorRuntimeOrThrow()._previewAlignDialog(e)}async _runAlignToGrid(){return this._editorRuntimeOrThrow()._runAlignToGrid()}async _undoPlanOptimization(){return this._editorRuntimeOrThrow()._undoPlanOptimization()}async _runBackupExport(){return this._editorRuntimeOrThrow()._runBackupExport()}async _pickBackupImport(e){return this._editorRuntimeOrThrow()._pickBackupImport(e)}async _setBackupDuplicatePolicy(e){return this._editorRuntimeOrThrow()._setBackupDuplicatePolicy(e)}async _applyBackupImport(){return this._editorRuntimeOrThrow()._applyBackupImport()}_renderBackupExportDialog(){return this._editorRuntimeOrThrow()._renderBackupExportDialog()}_renderBackupImportDialog(){return this._editorRuntimeOrThrow()._renderBackupImportDialog()}_setFillColor(e,t){return this._editorRuntimeOrThrow()._setFillColor(e,t)}async _saveSettingsDialog(){return this._editorRuntimeOrThrow()._saveSettingsDialog()}_boolInput(e,t,i=!1){return this._editorRuntimeOrThrow()._boolInput(e,t,i)}_rangeInput(e,t,i,n,r,o=!1,s){return this._editorRuntimeOrThrow()._rangeInput(e,t,i,n,r,o,s)}_renderColorRow(e,t){return this._editorRuntimeOrThrow()._renderColorRow(e,t)}get _glowRadiusCm(){const e=Number(this._settings.glow_radius_cm);return Number.isFinite(e)&&e>0?e:300}get _imperial(){return"mi"===this.hass?.config?.unit_system?.length}get _glowRadiusPlaceholder(){const e=this._glowRadiusCm;return this._imperial?String(Math.round(e/30.48*10)/10):String(e/100)}_glowTransition(e,t){let i=this._glowRenderedSources.get(e);if(t){const t=this._glowFadeTimers.get(e);if(null!=t&&(clearTimeout(t),this._glowFadeTimers.delete(e)),null==i){this._suspendGlowFeatherForTransition(),i=++this._glowSourceSeq,this._glowRenderedSources.set(e,i),this._glowEnteringSources.add(e);const t=requestAnimationFrame(()=>{this._glowEnterRafs.get(e)===t&&(this._glowEnterRafs.delete(e),this._glowEnteringSources.delete(e),this.isConnected&&this.requestUpdate())});this._glowEnterRafs.set(e,t)}return{domId:i,entering:this._glowEnteringSources.has(e),leaving:!1}}if(null==i)return null;const n=this._glowEnterRafs.get(e);if(null!=n&&cancelAnimationFrame(n),this._glowEnterRafs.delete(e),this._glowEnteringSources.delete(e),!this._glowFadeTimers.has(e)){this._suspendGlowFeatherForTransition();const t=window.setTimeout(()=>{this._glowFadeTimers.get(e)===t&&(this._glowFadeTimers.delete(e),this._glowRenderedSources.delete(e),this._glowLastAppearance.delete(e),this.isConnected&&this.requestUpdate())},534);this._glowFadeTimers.set(e,t)}return{domId:i,entering:!1,leaving:!0}}_suspendGlowFeatherForTransition(){if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;this._glowFeatherSuspendUntil=Math.max(this._glowFeatherSuspendUntil,Date.now()+500),clearTimeout(this._glowFeatherResumeTimer);const e=Math.max(0,this._glowFeatherSuspendUntil-Date.now())+17,t=()=>{this._glowFeatherResumeTimer=0,Date.now()<this._glowFeatherSuspendUntil?this._glowFeatherResumeTimer=window.setTimeout(t,this._glowFeatherSuspendUntil-Date.now()+17):(this._glowFeatherSuspendUntil=0,this.isConnected&&this.requestUpdate())};this._glowFeatherResumeTimer=window.setTimeout(t,e)}_forgetGlowSource(e){const t=this._glowFadeTimers.get(e);null!=t&&clearTimeout(t);const i=this._glowEnterRafs.get(e);null!=i&&cancelAnimationFrame(i),this._glowFadeTimers.delete(e),this._glowEnterRafs.delete(e),this._glowEnteringSources.delete(e),this._glowRenderedSources.delete(e),this._glowLastAppearance.delete(e)}_forgetGlowSpace(e){const t=`${e}|`;for(const e of this._glowRenderedSources.keys())e.startsWith(t)&&this._forgetGlowSource(e)}_warnGlowGeometryFallback(e,t,i,n){const r=`${e}|${t}|${i}`;if(!this._glowGeometryWarnings.has(r)){if(this._glowGeometryWarnings.size>=128){const e=this._glowGeometryWarnings.values().next().value;e&&this._glowGeometryWarnings.delete(e)}this._glowGeometryWarnings.add(r),console.warn(`HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${e}, room ${i}, phase ${n}`)}}_lightBarriers(e,t){const i=Rl([this._curSpaceCfg,this._cellCm,this._gridPitch]),n=`${e.id}|${i}`,r=lm(this._lightBarrierPool,n);if(r.hit)return this._lightBarrierCache=r.value,r.value.value;const o=this._zeroWalls(),s=this._openCuts(),a=[...o.transmissive],l=Math.max(this._cmToUnits(10),.5*this._gridPitch),c=e=>t.some(t=>this._pointInRoom(e,t.r)),h=this._openingsR.filter(e=>{if("door"!==(t=String(e.type))&&"gate"!==t&&"passage"!==t)return!1;var t;const i=e.angle*Math.PI/180,n=-Math.sin(i),r=Math.cos(i);return c([e.rx+n*l,e.ry+r*l])&&c([e.rx-n*l,e.ry-r*l])}),d=this._roomWallOpeningInputs(h,e);for(const e of d){const t=e.angle*Math.PI/180,i=Math.cos(t)*e.length/2,n=Math.sin(t)*e.length/2;a.push([e.x-i,e.y-n,e.x+i,e.y+n])}const u=new Set(h.filter(e=>e.partitionHost).map(e=>e.id)),p=[e.id,this._cfgEpoch,this._cellCm,this._gridPitch,[...u].sort().join(",")].join("|");this._lightPhysicalBodiesCache?.key!==p&&(this._lightPhysicalBodiesCache={key:p,all:ca(e,this._cellCm,this._gridPitch,2e-4*this._gridPitch,this._partitionOpeningCuts(e,e=>u.has(e.id))).all});const _=this._lightPhysicalBodiesCache.all,m=this._spaceWalls,g=.02*this._gridPitch,f=[],v=this._wallUnionGeometry(),y=v?.sourceFingerprint,b=v&&y===i?function(e,t=[],i=[],n={}){if("failed-core"===e.status||"not-applicable"===e.status)return null;const r=e.roomComponents?.length?e.roomComponents:$s(e.roomGeom)?[{id:"room-primary",geom:e.roomGeom}]:[];let o=r[0]?.geom||null;const s=r.slice(1).map(e=>({...e}));try{for(const i of t){if(!(i.length>0&&e.openingIndex))continue;const t=Gs(e.openingIndex,i,!0);if(!t.negative&&!t.positive)continue;const n=i.angle*Math.PI/180,r=Math.cos(n),a=Math.sin(n),l=-a,c=r,h=i.length/2,d=e.openingPadUnits??1.25*Math.max(e.depthUnits,1),u=xs([[i.x-r*h-l*d,i.y-a*h-c*d],[i.x+r*h-l*d,i.y+a*h-c*d],[i.x+r*h+l*d,i.y+a*h+c*d],[i.x-r*h+l*d,i.y-a*h+c*d]]);o&&(o=Ht(o,u));for(const e of s)e.geom=Ht(e.geom,u)}const r=[...s];let a=s.length;const l=n.mergeExtra||((e,t)=>e?Et(e,t):t);for(let e=0;e<i.length;e++){const t=i[e];if(t.length<3||!t.every(e=>e.length>=2&&Number.isFinite(e[0])&&Number.isFinite(e[1]))||Math.abs(yi(t))<=1e-9){a++;continue}const n=[xs(t)];try{const t=l(o,n,e);if(!$s(t))throw new Error("invalid extra union");o=t}catch{a++,$s(n)&&r.push({id:`policy-extra-${e}`,geom:n})}}r.sort((e,t)=>Fs(e.geom).localeCompare(Fs(t.geom)));const c=o||[];return{status:a?"degraded-extra":"ok",geom:c,components:[...$s(c)?[{id:"primary",geom:c}]:[],...r.map((e,t)=>({...e,id:`isolated-${t}`}))]}}catch{return null}}(v,d,_):null,w=b||(m.length||_.length?Ns(e.rooms,m,s,d,this._wallKeyPitch,this._cellCm,this._gridPitch,wm,_):null);if(!w||"ok"!==w.status&&"degraded-extra"!==w.status)for(const e of _)f.push(...Hd(e));else for(const e of w.components)for(const t of ga(e.geom))f.push(...Hd(t));for(const{poly:e}of t)for(const t of a.length?kn(e,a,g):Hd(e))f.push(t);for(const e of o.barriers)f.push(e);const k={occluders:Nd(f),floor:t.map(e=>e.poly),fingerprint:i,masonryGeometry:!w||"ok"!==w.status&&"degraded-extra"!==w.status?[]:w.components.flatMap(e=>e.geom),opaqueBodies:_},x={key:n,value:k};return cm(this._lightBarrierPool,n,x,8),this._lightBarrierCache=x,k}_renderGlowLayer(e,t){const i=this._fillColors,n=this._glowRadiusCm/this._cellCm*this._gridPitch,r=e.rooms.map(e=>({r:e,poly:Zt(e)})).filter(e=>!!e.poly),o=r.filter(({r:e})=>Tn(t.glow,e));if(!o.length)return this._forgetGlowSpace(e.id),W``;const{occluders:s,floor:a,fingerprint:l,masonryGeometry:c,opaqueBodies:h}=this._lightBarriers(e,r),d=Mh(this._renderPlanHass,this._renderDevices,null,this._virtualLights).filter(t=>t.device.space===e.id),u=new Map;for(const e of d){if(!e.device.id)continue;const t=u.get(e.device.id)||[];t.push(e),u.set(e.device.id,t)}const p=[],_=new Set;for(const t of this._renderDevices){if(t.space!==e.id)continue;const o=Rh(u.get(t.id)||[]);if(!o)continue;const d=`${e.id}|${t.id}`;_.add(d);const m=fn(o.passive?{state:o.on?"on":"off",attributes:{}}:this._renderPlanHass.states[o.eid],t.marker?.glow_color,i.glow_light.c),g=Number(t.marker?.glow_radius_cm),f=Number.isFinite(g)&&g>0?g/this._cellCm*this._gridPitch:n,v=this._pos(t);if(ya([v.x,v.y],c,h)){this._forgetGlowSource(d);continue}const y=this._glowTransition(d,!!m);if(!y)continue;m&&this._glowLastAppearance.set(d,{c:m.c,alpha:vn(m.bri,i.glow_light.a)});const b=this._glowLastAppearance.get(d);if(!b)continue;let w=null;const k=`${e.id}|${l}|${v.x.toFixed(4)},${v.y.toFixed(4)}|${f.toFixed(4)}`,x=lm(this._glowClipCache,k);if(x.hit)w=x.value;else{const t=jd([v.x,v.y],f,s,96);w={lit:t.length>=3?pa([t],a,{onBoundsFailure:({boundIndex:t,phase:i})=>{const n=r[t]?.r;this._warnGlowGeometryFallback(e.id,l,n?.id||`#${t}`,i)}}):[]},cm(this._glowClipCache,k,w,256)}p.push({key:d,sourceEid:o.eid,domId:y.domId,entering:y.entering,leaving:y.leaving,pos:v,c:b.c,alpha:b.alpha,geometry:w,r:f})}const m=`${e.id}|`;for(const e of this._glowRenderedSources.keys())e.startsWith(m)&&!_.has(e)&&this._forgetGlowSource(e);if(!p.length)return W``;const g=this._spaceWalls,f=o.length===r.length?[]:this._openCuts(),v=this._wallUnionGeometry()?.roomGeom,y=o.length===r.length?null:o.map(({r:t,poly:i})=>{const n=g.length&&t.id&&this._innerRoomContour(e,t.id,f,v)||i,o=this._cleanFloor(t,n,e).path,s=vi(n,r.filter(e=>e.r!==t).map(e=>e.poly)),a=e=>"M "+e.map(e=>e[0]+" "+e[1]).join(" L ")+" Z";return[o||a(n),...s.map(a)].join(" ")}),b=this._viewOr(this._baseVb()),w=this._stageEl?.clientWidth&&b.w?this._stageEl.clientWidth/b.w:1,k=1/(w>0?w:1),x=!this._pinchStart&&!this._panStart&&Date.now()>=this._glowFeatherSuspendUntil;(null==this._glowFeatherUnits||x)&&(this._glowFeatherUnits=k);const $=this._glowFeatherUnits??k,S=4*$,M=p.reduce((e,t)=>({x:Math.min(e.x,t.pos.x-t.r-S),y:Math.min(e.y,t.pos.y-t.r-S),maxX:Math.max(e.maxX,t.pos.x+t.r+S),maxY:Math.max(e.maxY,t.pos.y+t.r+S),w:0,h:0}),{x:1/0,y:1/0,maxX:-1/0,maxY:-1/0,w:0,h:0});return M.w=M.maxX-M.x,M.h=M.maxY-M.y,W`<defs>
        ${$e(p,e=>e.key,e=>{const t=e.domId,i=e.geometry;return W`
            ${""}
            <radialGradient id="hp-glow-${t}" gradientUnits="userSpaceOnUse"
              cx="${e.pos.x}" cy="${e.pos.y}" r="${e.r}">
              ${km.map(([t,i])=>W`
                <stop offset="${t}%" stop-color="${e.c}"
                  stop-opacity="${(e.alpha*i).toFixed(4)}"></stop>`)}
            </radialGradient>
            ${""}
            ${i?W`
              <clipPath id="hp-glowclip-${t}">
                <path class="glow-lit" d="${i.lit.join(" ")}"
                  clip-rule="evenodd" fill-rule="evenodd"></path>
              </clipPath>`:G}`})}
        ${y?W`<clipPath id="hp-glow-enabled">${y.map(e=>W`<path d=${e} clip-rule="evenodd" fill-rule="evenodd"></path>`)}</clipPath>`:G}
        ${""}
        <filter id="hp-glowfeather" filterUnits="userSpaceOnUse"
          x="${M.x}" y="${M.y}"
          width="${M.w}" height="${M.h}"
          color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="${$.toFixed(4)}" edgeMode="none"></feGaussianBlur>
        </filter>
      </defs>
      ${""}
      <g class="glowlayer glow-pools-frame" pointer-events="none"
        filter=${x?"url(#hp-glowfeather)":G}>
        <g class="glow-pools ${this._glowScreenBlend?"blend-screen":"blend-normal"}"
          data-blend=${this._glowScreenBlend?"screen":"normal"}
          data-feather-px="${2}"
          clip-path=${y?"url(#hp-glow-enabled)":G}>
          ${$e(p,e=>e.key,e=>{const t=e.domId;return W`
              <g class="glow-spot ${e.entering?"is-entering":""} ${e.leaving?"is-leaving":""}"
                data-glow-spot="${t}" data-glow-source="${e.sourceEid}">
                <circle class="glow-pool"
                  cx="${e.pos.x}" cy="${e.pos.y}" r="${e.r}"
                  data-lit-parts="${e.geometry?.lit.length||0}"
                  data-feather-px="${2}"
                  fill="url(#hp-glow-${t})"
                  clip-path=${e.geometry?`url(#hp-glowclip-${t})`:G}></circle>
              </g>`})}
        </g>
      </g>`}_renderAlignDialog(){return this._editorRuntimeOrThrow()._renderAlignDialog()}_renderSettingsDialog(){return this._editorRuntimeOrThrow()._renderSettingsDialog()}_rulesSet(e){return this._editorRuntimeOrThrow()._rulesSet(e)}async _saveRules(){return this._editorRuntimeOrThrow()._saveRules()}_renderRulesDialog(){return this._editorRuntimeOrThrow()._renderRulesDialog()}_saveKioskScale(e){this._kioskScale={...this._kioskScale,...e};try{localStorage.setItem(vm,JSON.stringify(this._kioskScale))}catch{}this.requestUpdate()}_renderKioskDialog(){const e=this._kioskScale,t=(t,i)=>{const n=Math.round(100*e[t]);return B`<label>${i}</label>
        <div class="colorrow">
          <input type="range" min="50" max="300" step="5" .value=${String(n)}
            @input=${e=>{const i=Number(e.target.value);Number.isFinite(i)&&this._saveKioskScale({[t]:i/100})}} aria-label=${i} />
          <span class="opv">${n}%</span>
        </div>`};return B`<hp-dialog .hass=${this.hass} .title=${this._t("kiosk.title")} icon="mdi:tablet"
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
    </hp-dialog>`}_fixedFloorValue(e){if("string"==typeof e)return e||"''";try{const t=JSON.stringify(e);return(void 0===t?String(e):t).slice(0,160)}catch{return String(e).slice(0,160)}}render(){if(!this._config||!this.hass)return G;const e=Dp(this,Jd,ru(this.hass,this._config.language));if("cold"===e)return Ap();if("warm"===e)return U;const t=!!this._importDialog||!(!this._spaceDialog||!this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)),i="view"!==this._mode||!!(this._roomDialog||this._mergeDialog||this._openingDialog||this._physicalDialog||this._partitionDeleteDialog||this._roomDeleteDialog||this._decorTextDialog||this._decorShapeDialog||this._backdropDialog||this._decorEraseConfirm||this._spaceDialog&&!this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)||this._deviceInbox||this._markerDialog||this._rulesDialog||this._settingsDialog||this._alignDialog||this._backupExportDialog||this._backupImportDialog||this._kioskDialog||this._vacFit||this._vacCalConfirm);t&&!this._onboardingRuntime&&this._ensureOnboardingRuntime(),i&&!this._editorRuntime&&this._ensureEditorRuntime();const n=this._model,r=this.houseplanDiagnostics(),o=this._fixedFloorState(n);if("pending"===o.kind)return B`<ha-card data-fixed-floor-state="pending">
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty" role="status" aria-live="polite">
          <ha-icon icon="mdi:loading" class="big fixedfloor-loading"></ha-icon>
          <p>${this._t("fixed_floor.loading")}</p>
        </div>
      </ha-card>`;if("invalid"===o.kind)return B`<ha-card
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
      </ha-card>`;if(!n.length)return B`<ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint||G}
        data-recovery-reason=${(this._continuity.overlayVisible||"recovery-error"===this._continuity.state)&&this._continuity.recoveryReason||G}
        data-ha-registry-access=${r.registry.access}
        data-ha-disabled-bindings=${r.bindings.ha_disabled}
        data-ha-unverified-bindings=${r.bindings.unverified}>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>${this._t("empty.no_spaces")}</p>
          ${this._serverStorage?B`<p class="muted">${this._t("empty.add_first")}</p>
                <button class="btn on" @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>${this._t("btn.add_space")}
                </button>`:B`<p class="muted">${this._t("empty.install")}</p>`}
        </div>
        ${this._spaceDialog&&(this._onboardingRuntime||this._editorRuntime)?this._renderSpaceDialog():G}
        ${this._importDialog&&this._onboardingRuntime?this._renderImportDialog():G}
        ${this._toast?B`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>`:G}
      </ha-card>`;const s=this._spaceModel();if(!s)return G;const a="valid"===o.kind?[s]:n,l=s.vb,c=this._effectiveProjection();this._renderProjection=c,this._labs.active.length&&function(e){$_||D_(e);const t=x_,i=t.active.join(",");if(!i||i===M_)return;M_=i;const n=new Map(__.map(e=>[e.id,e])),r=t.active.map(e=>{const t=n.get(e);return`${e} (#${t.issue}, expires ${t.expires})`}).join(", ");console.info(`HOUSEPLAN LABS: ${r}`)}(om);const h="iso"===c,d="devices"===this._mode&&this._showAll,u=this._renderDevices.filter(e=>e.space===s.id&&(!e.hidden||d)),p=this._renderDeviceSnapshot,_=this._spaceDisplayForRender(),m=h?this._isoDecorationLayers(_):null,g=m?this._isoOpeningPanels(m):[],f=this._resolvedRoomFills(s,_),v=this._resolvedGlowBase(s,_,f),y=_.showLqi??this._config.show_signal??!0,b=this._config.icon_size??2.5,w=b>8?2.5:b,k=Zu(w),x=this._viewOr(this._baseVb()),$=this._floorView(x),S=this._editing?"":this._stageBg(_),M=this._opMeasureView,R=this._decorMeasure,T=this._bdLive,C=this._furnLive,D="view"===this._mode?this._editorChromeMode:this._mode,A=this._roomHoverPaths(s),O=s.bg?this._display(s.bg.href):"",z=this._continuity.overlayVisible||"recovery-error"===this._continuity.state?this._continuity.recoveryReason:null,P=this._modeTransitionVisual,F=this._dayCycleState(),I=P?.viewWeight??("view"===this._mode?1:0),E=this._modeTransition.state?.from.presentedMode,N=!this._markup||!!P&&("view"===P.presentedMode||"devices"===P.presentedMode||"view"===E||"devices"===E),H=P?.stageColor||S,L=P?.sceneBrightness??1;return B`
      <ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint||G}
        data-device-snapshot-sequence=${p?.sourceSequence??G}
        data-recovery-reason=${z||G}
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
            ${a.map(e=>B`<button
                data-hp="space-tab" data-id="${e.id}"
                class="tab ${this._space===e.id?"active":""}${this._tabDrag?.moved&&this._tabDrag.id===e.id?" dragging":""}${this._tabDrag?.moved&&this._tabDrag.targetId===e.id?` drop-${this._tabDrag.placement}`:""}"
                ?data-reorderable=${this._canReorderTabs}
                @pointerdown=${t=>this._tabPointerDown(t,e.id)}
                @pointerup=${e=>this._tabPointerUp(e)}
                @pointercancel=${()=>this._endTabDrag()}
                @click=${()=>this._tabClick(e.id)}
              >
                ${e.title}${this._norm&&this._canEdit?B`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t("title.configure_space")}
                      @click=${t=>{t.stopPropagation(),this._openSpaceDialog("edit",e.id)}}></ha-icon>`:G}
              </button>`)}
            ${""}
            ${!this._canEdit||this._kiosk||this._hasFixedFloor?G:B`<button class="tab tabadd" title=${this._t("title.add_space")}
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`}
          </div>
          ${this._canEdit?B`<div class="modes">
                ${[["plan","mdi:floor-plan"],["devices","mdi:tune-variant"],["decor","mdi:draw"]].map(([e,t])=>B`<button class="modetab ${this._mode===e?"active":""}"
                    data-editor-navigation=${e}
                    title=${this._t("mode."+e+"_tip")}
                    @click=${()=>this._setMode(e)}>
                    <ha-icon icon=${t}></ha-icon><span class="ml">${this._t("mode."+e)}</span>
                    ${this._mode===e?B`<ha-icon class="closex" icon="mdi:close" title=${this._t("title.close_editor")}
                          data-editor-navigation="view"
                          @click=${e=>{e.stopPropagation(),this._setMode("view")}}></ha-icon>`:G}
                  </button>`)}
              </div>`:G}
          <span class="count">${this._t("count.devices",{n:u.filter(e=>!e.hidden).length})}</span>
          <span class="spacer"></span>
          ${this._labsIso&&"view"===this._mode&&!this._kiosk?B`<button class="btn projection-toggle ${h?"on":""}"
                data-hp="projection-toggle" aria-pressed=${h?"true":"false"}
                aria-label=${this._t("view.volumetric")}
                title=${this._t(h?"view.flat":"view.volumetric")}
                @click=${()=>this._setProjection(h?"flat":"iso")}>
                <ha-icon icon=${h?"mdi:view-grid-outline":"mdi:cube-outline"}></ha-icon>
              </button>`:G}
          <div class="zoomctl">
            <button class="btn zb" @click=${()=>this._stepZoom(-1)} title=${this._t("title.zoom_out")}><ha-icon icon="mdi:minus"></ha-icon></button>
            ${""}
            <button class="btn zb" @click=${()=>this._fitAll()}
              title=${this._t("title.zoom_fit")}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._stepZoom(1)} title=${this._t("title.zoom_in")}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm&&this._canEdit?B`<button class="btn" @click=${this._openSettingsDialog} title=${this._t("title.general_settings")}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>`:G}
        </div>
        ${this._canEdit&&!this._kiosk?B`<div class="editorchrome ${this._editing||this._modeTransitionBusy?"open":""}${this._modeTransitionBusy?" transitioning":""}"
              style=${P?`height:${P.editorChromeHeight}px;opacity:${P.editorWeight}`:G}
              aria-hidden=${this._editing?"false":"true"}
              ?inert=${!this._editing}>
              <div class="editorchrome-inner"
                style=${P?`opacity:${P.toolbarContentOpacity}`:G}>
                ${this._editorRuntime?"plan"===D?this._renderMarkupBar():"devices"===D?this._renderDevicesBar():this._renderDecorBar():G}
              </div>
            </div>`:G}
        </div>

        <div class="stage ${this._markup?"markup tool-"+this._tool+("split"!==this._tool||this._splitSel?"":" pickstage")+("wallthick"===this._tool&&this._wallThickHover?" wallhot":""):""} ${"decor"===this._mode?"dtool-"+this._decorTool:""} ${s.bg?"":"noplan"} mode-${this._mode}${this._bdMovable?" bdgrab":""}${this._bdDrag?" bdgrabbing":""}${F?` daycycle phase-${F.phase}`:""}${this._booting?" hpboot":""}${this._bootSoft?" hpsettle":""}${this._modeTransitionBusy?" mode-transition":""}"
          ?inert=${this._modeTransitionBusy}
          style="height:${P?`${P.stageHeight}px`:this._kiosk?"100dvh":`calc(100dvh - ${this._hdrH}px)`}${H?`;background:${H}`:""};--hp-cell-visual-scale:${ka(this._cellCm)};--wall-fill:${this._fillColors.wall_fill.c};--wall-fill-op:${this._fillColors.wall_fill.a};--hp-mode-architecture-opacity:${P?P.architectureOpacity:"decor"===this._mode?.35:1};--hp-mode-view-weight:${P?.viewWeight??("view"===this._mode?1:0)};--hp-mode-editor-weight:${P?.editorWeight??("view"===this._mode?0:1)}${P?`;--hp-mode-paper:${P.paperColor}`:""}${F?`;${hr(F)}`:""}"
          @click=${e=>this._markupClick(e)}
          @wheel=${e=>this._onWheel(e)}
          @pointerdown=${e=>{this._notePointer(e),this._stagePointerDown(e)}}
          @pointermove=${e=>this._stagePointerMove(e)}
          @pointerleave=${e=>this._stagePointerLeave(e)}
          @pointerup=${e=>this._stagePointerUp(e)}
          @pointercancel=${e=>this._stagePointerCancel(e)}>
          ${dr(F,I)}
          ${this._editorRuntime?this._renderEditorSecondary():G}
          <div class="zoomwrap ${this._slide?"slide-"+this._slide:""}"
            ?inert=${this._continuity.overlayBlocksInteraction||this._modeTransitionBusy}
            style="${1!==L?`filter:brightness(${L.toFixed(3)})`:""}">
          ${h&&m?.structural?W`<svg class="iso-underlay-svg"
              viewBox="${x.x} ${x.y} ${x.w} ${x.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoUnderlay(m)}
            </svg>`:G}
          <svg class=${m?.structural?"plan-svg":G}
            viewBox=${m?.structural?`${x.x} ${x.y} ${x.w} ${x.h}`:`${$.x} ${$.y} ${$.w} ${$.h}`}
            preserveAspectRatio=${m?.structural||!h?"xMidYMid meet":"none"}>
            <g class=${m?.structural?"iso-floor-scene":G}
              transform=${m?.structural?F_():G}>
            ${""}
            ${this._wallHatchDefs(_.color)}${W`<g class="hp-paperg">${this._paperShapes(s.rooms).map(e=>"path"in e?W`<path class="hp-paper" d="${e.path}" fill-rule="evenodd" pointer-events="none"></path>`:"poly"in e?W`<polygon class="hp-paper" points="${e.poly}" pointer-events="none"></polygon>`:W`<rect class="hp-paper" x="${e.rect.x}" y="${e.rect.y}" width="${e.rect.w}" height="${e.rect.h}" rx="${e.rect.rx}" pointer-events="none"></rect>`)}</g>`}
            ${this._editing?this._renderMarkupDefs(l):G}
            ${""}
            ${this._editing&&!this._markup&&this._gridLevels()?W`<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:G}
            ${s.bg&&O?W`<image class="hp-backdrop" href="${O}" x="${s.bg.x}" y="${s.bg.y}" width="${s.bg.w}" height="${s.bg.h}"
                  opacity="${P?.backdropOpacity??("decor"===this._mode&&"backdrop"!==this._decorTool?.5:1)}"
                  @load=${()=>this._onBackdropLoaded(s.bg.href,O)}
                  transform=${s.bg.angle?`rotate(${s.bg.angle} ${s.bg.x+s.bg.w/2} ${s.bg.y+s.bg.h/2})`:G}
                  @dblclick=${e=>this._openBackdropDialog(e)}
                  preserveAspectRatio="none" />`:G}
            ${(()=>{const e=this._openCuts(),t=this._thickWallCuts(),i=this._wallUnionGeometry()?.roomGeom,n=new Map,r=e=>(n.has(e)||n.set(e,Zt(e)),n.get(e));return s.rooms.filter(e=>e.area||"view"===this._mode||this._markup||_.showBorders).map(n=>{let o="room "+(s.bg?"overlay":"yard")+(this._markup?" outlined":"");!this._markup||n.id!==this._mergeSel&&n.id!==this._splitSel?.roomId||(o+=" picked");let a="";const l=Rn(_.fill,n);if(!this._markup&&(_.showBorders||"none"!==l)){o+=" styled";const e=[];e.push(`--room-stroke:${_.color}`,`--room-stroke-op:${_.showBorders?_.opacity:0}`);const t=f.byRoom.get(n)||null;t?(o+=" filled",e.push(`--room-fill:${t.color}`,`--room-fill-op:${t.opacity}`)):e.push("--room-fill:transparent","--room-fill-op:0"),a=e.join(";")}let c;const h=e=>{"view"===this._mode&&(void 0===c&&(c=this._roomArea(n)),this._showTip(e,n.name||this._t("room.unnamed"),c?this._t("tip.area",{value:c}):"",y?this._roomLqi(n.area):null,this._roomTemp(n),this._roomHum(n)))},d=r(n),u=this._markup&&(n.id===this._mergeSel||n.id===this._splitSel?.roomId),p=d&&!u?e.filter(e=>{const t=[(e[0]+e[2])/2,(e[1]+e[3])/2];return d.some((e,i)=>Pn(t,[e[0],e[1],...d[(i+1)%d.length]])<=.08*this._gridPitch)}):[],m=u?[]:t,g=p.concat(m);g.length&&(o+=" noedge");const v=this._spaceWalls.length&&n.id&&d&&this._innerRoomContour(s,n.id,e,i)||d,b=v?vi(v,(w=n,s.rooms.filter(e=>e!==w).map(r).filter(Boolean))):[];var w;const k=e=>"M "+e.map(e=>e[0]+" "+e[1]).join(" L ")+" Z",x=v?this._cleanFloor(n,v,s).path:"",$=n.id||G,S=n.area||G,M=x&&v?W`<path class="${o}" style="${a}" fill-rule="evenodd"
                    data-hp="room" data-id=${$} data-area=${S}
                    d="${[x,...b.map(k)].join(" ")}"
                    @pointerenter=${e=>{this._notePointer(e),this._pointerModality.hoverEnabled&&(this._hoverRoom={space:s.id,room:n})}}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></path>`:b.length&&v?W`<path class="${o}" style="${a}" fill-rule="evenodd"
                    data-hp="room" data-id=${$} data-area=${S}
                    d="${[v,...b].map(k).join(" ")}"
                    @pointerenter=${e=>{this._notePointer(e),this._pointerModality.hoverEnabled&&(this._hoverRoom={space:s.id,room:n})}}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></path>`:v&&v!==d?W`<polygon class="${o}" style="${a}" points="${v.map(e=>e.join(",")).join(" ")}"
                     data-hp="room" data-id=${$} data-area=${S}
                    @pointerenter=${e=>{this._notePointer(e),this._pointerModality.hoverEnabled&&(this._hoverRoom={space:s.id,room:n})}}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></polygon>`:n.poly?W`<polygon class="${o}" style="${a}" points="${n.poly.map(e=>e.join(",")).join(" ")}"
                     data-hp="room" data-id=${$} data-area=${S}
                    @pointerenter=${e=>{this._notePointer(e),this._pointerModality.hoverEnabled&&(this._hoverRoom={space:s.id,room:n})}}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></polygon>`:W`<rect class="${o}" style="${a}"
                     data-hp="room" data-id=${$} data-area=${S}
                     x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${.03*Math.min(n.w,n.h)}"
                    @pointerenter=${e=>{this._notePointer(e),this._pointerModality.hoverEnabled&&(this._hoverRoom={space:s.id,room:n})}}
                    @pointermove=${h}
                    @pointerleave=${()=>this._clearTransientHover()}></rect>`,R=g.length&&d?kn(d,g,.02*this._gridPitch):null,T=R?W`<path class="room-outline ${this._markup?"outlined":""}"
                    d="${R.map(e=>`M ${e[0]} ${e[1]} L ${e[2]} ${e[3]}`).join(" ")}"
                    style=${this._markup?G:`stroke:${_.color};stroke-opacity:${_.showBorders?_.opacity:0}`}></path>`:G;return W`${M}${T}`})})()}
            ${this._renderRoomHoverFill(A)}
            ${this._renderOpeningTunnelFills(s,f)}
            ${this._renderGlowBaseRooms(s,v)}
            ${this._renderOpeningTunnelFills(s,v,"glow-base")}
            ${""}
            ${_.hideDecor&&"decor"!==this._mode?G:this._renderDecorLayer()}
            ${N?this._renderGlowLayer(s,_):G}
            ${this._renderSunRays(s)}
            ${this._editing?W`<g class="hp-editor-only-layer"
              opacity="${P?.editorWeight??1}">${this._renderAlignGuides()}</g>`:G}
            ${this._markup?W`<g class="hp-editor-only-layer"
              opacity="${P?.editorWeight??1}">${this._renderMarkupLayer(l)}</g>`:G}
            ${""}
            ${""}
            ${this._editing?G:this._renderZeroWalls(_)}
            ${this._renderWallBodies(_)}
            ${this._markup&&"resize"===this._tool?this._renderResizeMeasurements():G}
            ${this._renderRoomHoverOutline(A)}
            ${""}
            ${this._editing?this._renderZeroWalls(_):G}
            ${this._markup?W`<g class="hp-editor-only-layer"
              opacity="${P?.editorWeight??1}">${this._renderHiddenWallDiagnosticOverlay()}</g>`:G}
            ${this._markup?W`<g class="hp-editor-only-layer"
              opacity="${P?.editorWeight??1}">${this._renderOpeningPlacementPreview()}</g>`:G}
            ${M?this._renderOpeningDimensionGuides(M):G}
            ${M?.guide?this._renderOpeningCenterTick(M.guide):G}
            ${""}
            ${""}
            ${this._markup?W`<g class="hp-editor-only-layer"
              opacity="${P?.editorWeight??1}">${this._renderActiveChainInk()}</g>`:G}
            ${this._markup?W`<g class="hp-editor-only-layer"
              opacity="${P?.editorWeight??1}">${this._renderPlanSnapOverlay()}</g>`:G}
            ${_.hideOpenings&&!this._markup||m&&!m.floorSymbols?G:this._renderOpenings(_)}
            ${this._renderWallThickUi()}
            ${this._markup&&"resize"===this._tool?this._renderResizeLayer(x):G}
            ${""}
            ${this._renderBackdropFrame(x)}
            ${this._renderTextFrame(x)}
            </g>
          </svg>
          ${h&&m?.structural?W`<svg class="iso-shadows-svg"
              viewBox="${x.x} ${x.y} ${x.w} ${x.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoShadows(m,g)}
            </svg>
            <svg class="iso-walls-svg" viewBox="${x.x} ${x.y} ${x.w} ${x.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoWalls(m,g)}
            </svg>`:G}
          ${""}
          <div class="devlayer" style="--icon-size:${tl(w,s,x.w,this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--device-base-size:${tl(k,s,x.w,this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--rl-icon-size:${tl(w,s,this._roomLabelReferenceViewWidth(x),this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--rl-font:${this._kiosk?this._kioskScale.font:1}">
            ${u.map(e=>this._renderDevice(e,x,y))}
            ${this._renderVacuums(u,x)}
            ${this._renderVacFit(x)}
            ${this._renderOpeningLocks(x)}
            ${_.showNames||this._markup?s.rooms.map(e=>this._renderRoomLabel(e,s,x,_)):G}
            ${this._markup?s.rooms.map(e=>this._renderRoomGear(e,s,x)):G}
          </div>
          ${this._measureAnchor?B`<div class="measurelayer">${this._renderMeasureLabel(x)}</div>`:G}
          ${this._resize?.liveLabels?B`<div class="measurelayer">${this._resize?.liveLabels?.map(e=>B`<div
                class="measurelabel ${"area"===e.kind?"rszarea":"rszlength"}"
                data-hp=${"area"===e.kind?"resize-area-label":"resize-length-label"}
                data-room=${"area"===e.kind?e.roomId:G}
                data-side=${"area"===e.kind?e.placement.side:G}
                style="left:${((e.x-x.x)/x.w*100).toFixed(2)}%;top:${((e.y-x.y)/x.h*100).toFixed(2)}%;${"area"===e.kind?`--rsz-label-x:${e.placement.offsetXPx.toFixed(2)}px;--rsz-label-y:${e.placement.offsetYPx.toFixed(2)}px;--rsz-label-tangent:${e.placement.tangentOffsetPx.toFixed(2)}px`:""}">${e.text}</div>`)}</div>`:G}
          ${M?B`<div class="measurelayer">${M.labels.map(e=>B`<div
                class="measurelabel opshoulder ${e.dimension?"opdimension":""}"
                data-dimension-source=${e.dimension?.source||G}
                data-dimension-room=${e.dimension?.roomId||G}
                style="left:${((e.x-x.x)/x.w*100).toFixed(2)}%;top:${((e.y-x.y)/x.h*100).toFixed(2)}%;${e.dimension?`--op-label-shift-x:${(12*e.dimension.labelNormal[0]).toFixed(2)}px;--op-label-shift-y:${(12*e.dimension.labelNormal[1]).toFixed(2)}px`:""}">${e.text}</div>`)}</div>`:G}
          ${this._wallDialog?B`<div class="measurelayer">${this._renderWallThickDialog()}</div>`:G}
          ${R?B`<div class="measurelayer"><div
                class="measurelabel dmeasure ${R.on45?"on45":""}"
                style="left:${((R.x-x.x)/x.w*100).toFixed(2)}%;top:${((R.y-x.y)/x.h*100).toFixed(2)}%">${R.text}</div></div>`:G}
          ${C?B`<div class="measurelayer">${C.map(e=>B`<div
                class="measurelabel furnmeasure"
                style="left:${((e.x-x.x)/x.w*100).toFixed(2)}%;top:${((e.y-x.y)/x.h*100).toFixed(2)}%">${e.text}</div>`)}</div>`:G}
          ${T?B`<div class="measurelayer"><div
                class="measurelabel bdmeasure"
                style="left:${((T.x-x.x)/x.w*100).toFixed(2)}%;top:${((T.y-x.y)/x.h*100).toFixed(2)}%">${T.text}</div></div>`:G}
          </div>
          ${this._zoom>1?B`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:G}
          ${this._renderFarHint()}
          ${this._renderHomeArrow()}
          ${this._renderEditorRuntimeLoading()}
          ${this._renderRecoveryOverlay()}
          ${this._booting||this._bootFading?B`<div class="bootveil ${this._booting?"":"off"}" aria-hidden="true">
                <svg class="boothouse" viewBox="0 0 24 24"><path d="${"M10,2V4.26L12,5.59V4H22V19H17V21H24V2H10M7.5,5L0,10V21H15V10L7.5,5M14,6V6.93L15.61,8H16V6H14M18,6V8H20V6H18M7.5,7.5L13,11V19H10V13H5V19H2V11L7.5,7.5M18,10V12H20V10H18M18,14V16H20V14H18Z"}"></path></svg>
              </div>`:G}
        </div>

        ${this._roomDialog&&this._editorRuntime?this._renderRoomDialog():G}
        ${this._mergeDialog&&this._editorRuntime?this._renderMergeDialog():G}
        ${this._openingDialog&&this._editorRuntime?this._renderOpeningDialog():G}
        ${this._physicalDialog&&this._editorRuntime?this._renderPhysicalDialog():G}
        ${this._partitionDeleteDialog&&this._editorRuntime?this._renderPartitionDeleteDialog():G}
        ${this._roomDeleteDialog&&this._editorRuntime?this._renderRoomDeleteDialog():G}
        ${this._openingInfo?this._renderOpeningInfoCard():G}
        ${this._decorTextDialog&&this._editorRuntime?this._renderDecorTextDialog():G}
        ${this._decorShapeDialog&&this._editorRuntime?this._renderDecorShapeDialog():G}
        ${this._backdropDialog&&this._editorRuntime?this._renderBackdropDialog():G}
        ${this._decorEraseConfirm&&this._editorRuntime?this._renderDecorEraseConfirm():G}
        ${this._spaceDialog&&(this._onboardingRuntime||this._editorRuntime)?this._renderSpaceDialog():G}
        ${this._deviceInbox&&this._editorRuntime?this._renderDeviceInbox():G}
        ${this._markerDialog&&this._editorRuntime?this._renderMarkerDialog():G}
        ${this._vacCalConfirm?B`<hp-dialog .hass=${this.hass}
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
        </hp-dialog>`:G}
        ${this._infoCard?this._renderInfoCard():G}
        ${this._rulesDialog&&this._editorRuntime?this._renderRulesDialog():G}
        ${this._settingsDialog&&this._editorRuntime?this._renderSettingsDialog():G}
        ${this._alignDialog&&this._editorRuntime?this._renderAlignDialog():G}
        ${this._backupExportDialog&&this._editorRuntime?this._renderBackupExportDialog():G}
        ${this._backupImportDialog&&this._editorRuntime?this._renderBackupImportDialog():G}
        ${this._importDialog&&this._onboardingRuntime?this._renderImportDialog():G}
        ${this._tip?B`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?B`<span class="m">${this._tip.meta}</span>`:G}
              ${null!=this._tip.temp?B`<span class="m">${this._t("tip.temp_avg")} <b>${this._tip.temp}°</b></span>`:G}
              ${null!=this._tip.hum?B`<span class="m">${this._t("tip.hum_avg")} <b>${this._tip.hum}%</b></span>`:G}
              ${null!=this._tip.lqi?B`<span class="m">${this._t("tip.lqi")}
                    <b style="color:${Ut(this._tip.lqi)}">${this._tip.lqi}</b></span>`:G}
            </div>`:G}
        ${this._kiosk&&!this._hasFixedFloor&&this._kioskDots&&this._model.length>1?B`<div class="kioskdots">
              ${this._model.map(e=>B`<span class="kdot ${e.id===this._space?"on":""}"></span>`)}
            </div>`:G}
        ${this._kioskDialog?this._renderKioskDialog():G}
        ${this._vacFit?B`<div class="vaccalbar">
          <span>${this._t("vac.fit_hint")}</span>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({rot:(this._vacFit.p.rot+90)%360})}>${this._t("vac.fit_rotate")}</button>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({mir:!this._vacFit.p.mir})}>${this._t("vac.fit_mirror")}</button>
          <button class="btn" @click=${()=>this._vacFitSave()}>${this._t("btn.save")}</button>
          <button class="btn ghostbtn" @click=${()=>{this._vacFit=null}}>${this._t("btn.cancel")}</button>
        </div>`:G}
        ${this._tapConfirm?B`<hp-dialog .hass=${this.hass}
              .title=${"toggle"===this._tapConfirm.kind?this._tapConfirm.text:this._t("btn.run")}
              icon="mdi:alert-outline"
              dismiss-on-scrim @hp-close=${()=>this._tapConfirm=null}>
                <div class="body ${"toggle"===this._tapConfirm.kind?"tapconfirm-body":""}">
                  ${"run"===this._tapConfirm.kind?B`<p>${this._tapConfirm.text}</p>`:this._tapConfirm.lines.map((e,t)=>B`
                        <p class="tapconfirm-line" data-line=${t}>${e}</p>`)}
                </div>
                <div class="row" slot="footer">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${()=>this._tapConfirm=null}>${this._t("btn.cancel")}</button>
                  <button class="btn on" @click=${()=>{const e=this._tapConfirm;this._tapConfirm=null,e.exec()}}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.run")}
                  </button>
                </div>
            </hp-dialog>`:G}
        ${this._toast?B`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>`:G}
      </ha-card>
    `}_vacCandidateStatus(e,t,i=this._planHass){const n=this._bindingStatus("entity:"+e);if("ha_disabled"===n.kind)return"disabled";if("orphaned"===n.kind)return"missing";if("unverified"===n.kind)return"unverified";const r=i?.states?.[e];return"unavailable"===r?.state?"unavailable":t?.hasPosition?"ok":"unsupported"}_vacOpenAllCameras(e){const t=this._haRegistry.entities||{},i=[];for(const[e,n]of Object.entries(this.hass?.states||{})){if(!e.startsWith("camera."))continue;const r=Gl(e,n,t[e]);r&&i.push(r)}this._vacAllCameraCache={devId:e.id,candidates:i},this._vacAllCamerasFor=e.id}_vacSourceResolution(e,t=!1,i=this._planHass){const n=e.marker?.vacuum,r="string"==typeof n?.source&&!!n.source,o=new Set(e.entities||[]),s=new Set(o);r&&s.add(n.source);const a=i?.entities||{},l=[];for(const e of s){const t=i?.states?.[e],o=Gl(e,t,a[e]);o?l.push(o):r&&e===n.source&&l.push({entityId:e,name:String(t?.attributes?.friendly_name||e),platform:a[e]?.platform?String(a[e].platform):null,category:e.startsWith("camera.")?"camera":"partial",hasPosition:!1,hasRooms:!1,hasPath:!1,hasMapId:!1,score:0})}if(t&&this._vacAllCameraCache?.devId===e.id){const e=new Set(l.map(e=>e.entityId));for(const t of this._vacAllCameraCache.candidates)e.has(t.entityId)||l.push(t)}const c={};for(const e of l)c[e.entityId]=this._vacCandidateStatus(e.entityId,e,i);return function(e,t,i,n){const r="string"==typeof e&&e.length>0,o=new Set(t),s=Array.from(i).sort((t,i)=>r&&t.entityId===e?-1:r&&i.entityId===e?1:i.score-t.score||t.entityId.localeCompare(i.entityId));if(r){const t=s.find(t=>t.entityId===e);return{entityId:e,status:n[e]||(t?.hasPosition?"ok":"unverified"),pinned:!0,candidates:s}}const a=s.find(e=>o.has(e.entityId)&&e.hasPosition&&"ok"===n[e.entityId]);return a?{entityId:a.entityId,status:"ok",pinned:!1,candidates:s}:{entityId:null,status:"none",pinned:!1,candidates:s}}(n?.source,o,l,c)}_vacSource(e,t=this._planHass){if(!1===e.marker?.vacuum?.live)return null;const i=this._vacSourceResolution(e,!1,t);return"ok"===i.status||"unsupported"===i.status?i.entityId:null}_vacEntity(e){return e.primary?.startsWith("vacuum.")?e.primary:(e.entities||[]).find(e=>e.startsWith("vacuum."))||null}_isVacDev(e){return!!this._vacEntity(e)}_activitySourceKey(e){return this._activitySnapshot(e).sourceKey}_activitySnapshot(e,t=Mh(this._planHass,this._devices,null,this._virtualLights)){const i=Iu(this._planHass,e,this._devices,t,this._fullRegistryHass);return{samples:i.samples,sourceKey:Hu(this._planHass,e,i)}}_stampActivity(e,t,i){let n=this._activityRt.get(e);n||(n=zp(i||"",[]),this._activityRt.set(e,n)),null!=i&&(n.sources=i),Fp(n,t,Date.now(),window.clearTimeout.bind(window),e=>window.setTimeout(()=>this.requestUpdate(),e))}_syncActivityRuntime(){const e=new Map;if(!this.hass)return e;if(!1===this._config?.live_states){for(const e of this._activityRt.values())clearTimeout(e.timer);return this._activityRt.clear(),e}const t=new Set,i=Mh(this._planHass,this._devices,null,this._virtualLights);for(const n of this._devices){if(n.hidden)continue;if("icon_ripple"!==Ai(n.marker?.display))continue;t.add(n.id);const r=this._activitySnapshot(n,i);e.set(n.id,r);const{samples:o,sourceKey:s}=r;let a=this._activityRt.get(n.id);a?a.sources!==s&&Pp(a,s,o,window.clearTimeout.bind(window)):(a=zp(s,o),this._activityRt.set(n.id,a))}for(const[e,i]of this._activityRt)t.has(e)||(clearTimeout(i.timer),this._activityRt.delete(e));return e}_activityTick(){if(!this.hass)return;const e=this._syncActivityRuntime();for(const t of this._devices){if(t.hidden)continue;if("icon_ripple"!==Ai(t.marker?.display))continue;const i=e.get(t.id)||this._activitySnapshot(t),{samples:n,sourceKey:r}=i,o=this._activityRt.get(t.id);if(!o||o.sources!==r)continue;const s=Ip(o,n,window.clearTimeout.bind(window));s&&this._stampActivity(t.id,s,r)}}_vacTick(){if(this.hass)for(const e of this._devices){if(e.hidden||!this._isVacDev(e))continue;if("static_icon"===Ai(e.marker?.display)){this._vacRt.delete(e.id);continue}const t=this._vacSource(e);if(!t)continue;const i=this._vacEntity(e),n=Xl(this.hass.states[i||""]?.state),r=Bl(this.hass.states[t]?.attributes);let o=this._vacRt.get(e.id);o||(o={trail:[],lastKey:"",lastTs:0,moving:!1,jump:!1,endedTs:0,lastPos:null},this._vacRt.set(e.id,o)),n&&!o.moving&&(o.trail=[],o.lastPos=null);const s="never"!==nc(e.marker?.vacuum)&&!r?.path.length;!n&&o.moving&&(o.endedTs=Date.now(),s&&o.lastPos&&(o.trail=Zl(o.trail,o.lastPos,40)),o.lastPos=null),o.moving=n;const a=r?.pos;if(n&&a){const e=a.x+":"+a.y;if(e!==o.lastKey){const t=Date.now();o.jump=o.lastTs>0&&t-o.lastTs>1e4,o.lastKey=e,o.lastTs=t,s&&o.lastPos&&(o.trail=Zl(o.trail,o.lastPos,40)),o.lastPos=[a.x,a.y]}}}}_vacEnsureMarker(e){const t=this._serverCfg;if(!t)return null;t.markers=t.markers||[];const i=t.markers.find(t=>t.id===e.id);if(i)return i;if("device"!==e.bindingKind&&"entity"!==e.bindingKind||!e.bindingRef)return null;const n={id:e.id,binding:e.bindingKind+":"+e.bindingRef,space:e.space||null,area:e.area||null,hidden:!!e.hidden};return t.markers.push(n),n}_renderVacSection(e){return this._editorRuntimeOrThrow()._renderVacSection(e)}_vacMapId(e,t,i=this._planHass){return this._editorRuntimeOrThrow()._vacMapId(e,t,i)}_vacSaveMatrix(e,t,i,n){return this._editorRuntimeOrThrow()._vacSaveMatrix(e,t,i,n)}_vacPlanRoomAnchors(e){return this._editorRuntimeOrThrow()._vacPlanRoomAnchors(e)}_vacAutoCalibrate(e){return this._editorRuntimeOrThrow()._vacAutoCalibrate(e)}_vacApplyCalibrationProposal(e){return this._editorRuntimeOrThrow()._vacApplyCalibrationProposal(e)}_vacStartFit(e){return this._editorRuntimeOrThrow()._vacStartFit(e)}_vacFitSave(){return this._editorRuntimeOrThrow()._vacFitSave()}_vacFitTurn(e){return this._editorRuntimeOrThrow()._vacFitTurn(e)}_vacGhostCentre(e){return this._editorRuntimeOrThrow()._vacGhostCentre(e)}_vacDelta(e,t,i){return this._editorRuntimeOrThrow()._vacDelta(e,t,i)}_vacFitPointer(e,t){return this._editorRuntimeOrThrow()._vacFitPointer(e,t)}_renderVacFit(e){return this._editorRuntime?this._editorRuntimeOrThrow()._renderVacFit(e):G}_vacRafLoop(){this._vacRaf=requestAnimationFrame(()=>{const e=this.renderRoot,t=this._stageEl,i=this._vacLastView,n=e?.querySelectorAll?.(".vacpuck")||[];if(!t||!i||!n.length)return void(this._vacRaf=0);const r=t.getBoundingClientRect();for(const t of n){const n=t.getAttribute("data-mid"),o=t.getBoundingClientRect(),s=i.x+(o.left+o.width/2-r.left)/r.width*i.w,a=i.y+(o.top+o.height/2-r.top)/r.height*i.h;for(const t of e.querySelectorAll(`line.tip[data-mid="${n}"]`))t.setAttribute("x2",s.toFixed(1)),t.setAttribute("y2",a.toFixed(1))}this._vacRafLoop()})}_renderVacuums(e,t){if(this._markup||"decor"===this._mode)return G;const i=this._space+"|"+t.x+"|"+t.y+"|"+t.w+"|"+t.h,n=this._vacJumpOnce||i!==this._vacViewKey;this._vacViewKey=i,this._vacJumpOnce=!1;const r=[],o=[];for(const i of e){if(i.hidden||!this._isVacDev(i))continue;if("static_icon"===Ai(i.marker?.display))continue;const e=this._renderDeviceSnapshot?.facts.get(`vacuum:${i.id}`),s=e?.source??this._vacSource(i,this._renderPlanHass);if(!s)continue;const a=e?.telemetry??Bl(this._renderPlanHass?.states[s]?.attributes);if(!a)continue;const l=String(e?.mapId??this._vacMapId(i,a,this._renderPlanHass)),c=i.marker?.vacuum?.calibration?.[l];if(!c||6!==c.length)continue;const h=e?.runtime??this._vacRt.get(i.id),d=h?.moving??!1,u=nc(i.marker?.vacuum),p="always"===u||"cleaning"===u&&d,_=e?.server??this._vacSrvTrails[i.id],m=_?.current?.map_id===l&&Array.isArray(_.current.points)?_.current:null,g=_?.previous?.map_id===l&&Array.isArray(_.previous.points)?_.previous:null;if("always"===u&&g&&g.points.length>1){const e=g.points.map(([e,t])=>{const[i,n]=zl(c,e,t),r=this._scenePoint([i,n]);return r[0].toFixed(1)+","+r[1].toFixed(1)}).join(" ");o.push(W`<g class="prev"><polyline class="case" points="${e}"></polyline><polyline class="core" points="${e}"></polyline></g>`)}if(p){const e=Ll(a,m,h?.trail||[]),t=!d||"integration"!==e.source&&"server"!==e.source?e.path:ql(e.path);if(t.length){const e=t.map(e=>e.map(([e,t],i)=>{const[n,r]=zl(c,e,t),o=this._scenePoint([n,r]);return`${i?"L":"M"} ${o[0].toFixed(1)} ${o[1].toFixed(1)}`}).join(" ")).join(" ");o.push(W`<path class="case" d="${e}"></path><path class="core" d="${e}"></path>`);const n=t[t.length-1];if(d&&n?.length>=2){const e=n[n.length-1],[t,r]=zl(c,e[0],e[1]),s=this._scenePoint([t,r]),a=s[0].toFixed(1),l=s[1].toFixed(1);o.push(W`<line class="case tip" data-mid="${i.id}" x1="${a}" y1="${l}" x2="${a}" y2="${l}"></line><line class="core tip" data-mid="${i.id}" x1="${a}" y1="${l}" x2="${a}" y2="${l}"></line>`)}}}if(!d||!a.pos)continue;const[f,v]=zl(c,a.pos.x,a.pos.y),y=this._scenePoint([f,v]),b=(y[0]-t.x)/t.w*100,w=(y[1]-t.y)/t.h*100,k=h&&h.lastTs>0&&Date.now()-h.lastTs>6e4,x=i.marker?.icon||i.icon||"mdi:robot-vacuum";r.push(B`<div
        data-mid="${i.id}"
        class="vacpuck ${Gu(this._renderPlanHass)} ${h?.jump||n?"jump":""} ${k?"stale":""}"
        style="left:${b}%;top:${w}%"
        title=${i.name}
        @click=${e=>{e.stopPropagation();const t=this._vacEntity(i);t&&this._openMoreInfo(t)}}>
        <ha-icon .icon=${x}></ha-icon>
      </div>`)}return this._vacLastView=t,r.length&&!this._vacRaf&&this._vacRafLoop(),r.length||o.length?B`
      ${o.length?W`<svg class="vactrail" viewBox="${t.x} ${t.y} ${t.w} ${t.h}" preserveAspectRatio="none">${o}</svg>`:G}
      ${r}`:G}_renderDevice(e,t,i=!0){const n=this._pos(e),r=this._scenePoint([n.x,n.y]),o=(r[0]-t.x)/t.w*100,s=(r[1]-t.y)/t.h*100,a=this._devicePresentation(e,i),l=[`left:${o}%`,`top:${s}%`,...Vu(a)],c=a.disabledReason,h=a.haDisabled?this._t(`marker.ha_disabled_${c}`):e.userHidden?this._t("marker.hidden_ghost"):e.name,d=Du(a),u="view"===this._mode||"devices"===this._mode,p=[h,a.haDisabled?"":this._t(`marker.state_a11y_${d}`),"none"!==a.pulse.kind?this._t(`marker.pulse_a11y_${a.pulse.reason}`):"",a.valueFullText||a.valueText||"",hu(a.valueBadge),null!=a.lqiText&&a.lqiBand?this._t(`marker.lqi_a11y_${a.lqiBand}`,{value:a.lqiText}):""].filter(Boolean).join(", "),_=[e.model,a.valueBadge?.fullText||"",null!=a.lqiText?"LQI "+a.lqiText:""].filter(Boolean).join(" · ");return B`<div
      ${""}
      data-hp="device"
      data-id="${e.id}"
      data-entity=${e.primary||G}
      data-area=${e.area||G}
      data-binding-status=${a.haDisabled?"ha-disabled":e.bindingStatus?.kind||"active"}
      data-disabled-reason=${c?c.replace("_","-"):G}
      data-state=${d}
      data-lqi-band=${null!=a.lqiText&&a.lqiBand||G}
      role=${u?"button":G}
      tabindex=${u?"0":G}
      aria-label=${p}
      class="dev ${Gu(this._renderPlanHass)} ${a.classes.join(" ")} ${this._selId===e.id?"sel":""} ${e.virtual?"virtual":""} ${e.hidden?"ghost":""} ${a.haDisabled?"ha-disabled":""} ${null!=a.valueText?"valonly":""}"
      style="${l.join(";")}"
      @click=${t=>this._clickDevice(t,e)}
      @keydown=${t=>this._keyDevice(t,e)}
      @contextmenu=${t=>this._ctxDevice(t,e)}
      @pointerover=${t=>this._showTip(t,e.name,a.haDisabled?h:_)}
      @pointerleave=${()=>this._clearTransientHover()}
      @pointerdown=${t=>this._pointerDown(t,e)}
      @pointermove=${t=>{this._pointerMove(t,e),this._showTip(t,e.name,a.haDisabled?h:_)}}
      @pointerup=${t=>this._pointerUp(t,e)}
      @pointercancel=${t=>this._pointerUp(t,e)}
    >
      ${Yu(a,{newDevice:this._newIds.has(e.id),newDeviceTitle:this._t("device.new"),disabledTitle:a.haDisabled?h:""})}
    </div>`}_roomArea(e){const t=Zt(e);if(!t)return null;const i=this._spaceModel();if(!i)return null;const n=this._spaceWalls.length&&e.id&&this._innerRoomContour(i,e.id)||t,r=this._cleanFloor(e,n),o=this._cellCm/this._gridPitch;return Hn(r.area*o*o/1e4,"mi"===this._renderPlanHass?.config?.unit_system?.length)}_roomTemp(e){const t=e.settings?.temp_source;return t?Gh(this._renderPlanHass,t,"temp",this._markers):e.area?this._climate().get(e.area)?.temp??null:null}_roomHum(e){const t=e.settings?.hum_source;return t?Gh(this._renderPlanHass,t,"hum",this._markers):e.area?this._climate().get(e.area)?.hum??null:null}_climate(){const e=this._serverCfg?.markers,t=this._renderPlanHass,i=this._climateCache;if(i&&i.h===t&&i.r===this._iconRules&&i.mk===e)return i.m;const n=function(e,t,i){const n=new Map;if(!e?.entities)return n;const r=Lh(i),o=new Set;for(const e of i||[]){if(e?.removed||!0!==e?.use_climate_temp)continue;const t=(e.binding||"").indexOf(":");t>0&&o.add(e.binding.slice(t+1))}const s=new Map;for(const[t,i]of Object.entries(e.entities)){if(i.device_id&&r.devices.has(i.device_id)&&!r.liveEntities.has(t)||!i.device_id&&r.entities.has(t)&&!r.liveEntities.has(t))continue;const n=i.device_id?e.devices?.[i.device_id]:null,a=i.area_id||n?.area_id||null;if(!a)continue;if(i.entity_category)continue;if(!(o.size>0&&t.startsWith("climate.")&&(o.has(t)||i.device_id&&o.has(i.device_id)))){if(Te.has(i.platform))continue;if(Vh.test(t))continue}let l=s.get(a);l||(l=new Map,s.set(a,l));const c=i.device_id||t;let h=l.get(c);if(!h){const r=e.states?.[t];h={name:(n?n.name_by_user||n.name:i.name||r?.attributes?.friendly_name||t)||t,model:n?.model,ents:[]},l.set(c,h)}h.ents.push(t)}for(const[i,r]of s){const s=[],a=[];for(const[i,n]of r){const r=Fh(e,n.name,n.model,n.ents,t),l="mdi:thermometer"===r||"mdi:air-filter"===r;if(l){const t=Dh(e,n.ents);null!=t&&s.push(t)}if(o.size>0&&(o.has(i)||n.ents.some(e=>o.has(e)))){const t=Ah(e,n.ents);null!=t&&s.push(t)}if(l||"mdi:water-percent"===r){const t=zh(e,n.ents);null!=t&&a.push(t)}}(s.length||a.length)&&n.set(i,{temp:s.length?Math.round(s.reduce((e,t)=>e+t,0)/s.length*10)/10:null,hum:a.length?Math.round(a.reduce((e,t)=>e+t,0)/a.length):null})}return n}(t,this._iconRules,e);return this._climateCache={h:t,r:this._iconRules,mk:e,m:n},n}_resetRoomDialogFields(){return this._editorRuntimeOrThrow()._resetRoomDialogFields()}_openRoomEdit(e){return this._editorRuntimeOrThrow()._openRoomEdit(e)}_roomSettingsFromDialog(){return this._editorRuntimeOrThrow()._roomSettingsFromDialog()}_saveRoomEdit(){return this._editorRuntimeOrThrow()._saveRoomEdit()}_roomSrcCandidates(){return this._editorRuntimeOrThrow()._roomSrcCandidates()}_roomSrcLabel(e){return this._editorRuntimeOrThrow()._roomSrcLabel(e)}_labelPos(e,t){const i=this._layout["rl_"+(e.id||"")];if(i&&i.s===t)return{x:i.x*wm,y:i.y*wm};const n=this._roomCenter(e),r=this._gridPitch;return{x:qa(Gt(n[0],r)),y:qa(Gt(n[1],r))}}_labelDown(e,t,i){if(this._editorRuntime)return this._editorRuntimeOrThrow()._labelDown(e,t,i)}_labelMove(e,t,i){if(this._editorRuntime)return this._editorRuntimeOrThrow()._labelMove(e,t,i)}_labelUp(e){if(this._editorRuntime)return this._editorRuntimeOrThrow()._labelUp(e)}_labelScale(e){const t=this._layout["rl_"+(e.id||"")]?.k;return"number"==typeof t&&Number.isFinite(t)?Math.min(3,Math.max(.5,t)):1}_rlResizeDown(e,t,i){return this._editorRuntimeOrThrow()._rlResizeDown(e,t,i)}_rlResizeMove(e){return this._editorRuntimeOrThrow()._rlResizeMove(e)}_rlResizeUp(){return this._editorRuntimeOrThrow()._rlResizeUp()}_renderRoomGear(e,t,i){return this._editorRuntimeOrThrow()._renderRoomGear(e,t,i)}_renderRoomLabel(e,t,i,n){if(!e.name&&!this._markup)return G;const r=this._labelPos(e,t.id),o=this._scenePoint([r.x,r.y]),s=(o[0]-i.x)/i.w*100,a=(o[1]-i.y)/i.h*100,l=Math.min(1,n.opacity+.25),c=this._labelScale(e),h=[];if(e.area||e.settings?.temp_source||e.settings?.hum_source||n.labelLight){if(n.labelTemp){const t=this._roomTemp(e);null!=t&&h.push(B`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${t}°</span>`)}if(n.labelHum){const t=this._roomHum(e);null!=t&&h.push(B`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${t}%</span>`)}if(n.labelLqi&&e.area){const t=this._roomLqi(e.area);null!=t&&h.push(B`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${t}</span>`)}if(n.labelLight){const t=(d=Mh(this._renderPlanHass,this._renderDevices,e,this._virtualLights)).length?{on:d.filter(e=>e.on).length,total:d.length}:null;if(t){const e=0===t.on?this._t("roomcard.light_off"):t.on===t.total?this._t("roomcard.light_on"):this._t("roomcard.light_partial",{on:t.on,total:t.total});h.push(B`<span class="rlm ${t.on?"lit":""}"><ha-icon icon=${t.on?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>${e}</span>`)}}}var d;const u=!!e.area,p=!this._markup;return B`<div class="roomlabel ${h.length?"card":""}"
      data-hp="room-label" data-id=${e.id||G} data-area=${e.area||G}
      style="left:${s}%;top:${a}%;color:${n.color};opacity:${l};--rl-scale:${c};--rl-space:${n.cardFontScale};--rl-name:${Dn(e.settings?.name_scale)};--rl-meta:${Dn(e.settings?.label_scale)}"
      @pointerdown=${i=>this._labelDown(i,e,t.id)}
      @pointermove=${i=>this._labelMove(i,e,t.id)}
      @pointerup=${()=>this._labelUp(e)}
      @pointercancel=${()=>this._labelUp(e)}
    ><span class="rlname">${e.name||(this._markup?this._t("room.unnamed"):"")}${u?B`<ha-icon class="rlgo" icon="mdi:open-in-new"
            title=${p?this._t("room.open_area"):G}
            @click=${p?t=>{t.stopPropagation(),this._clickRoom(e)}:G}
            @pointerdown=${p?e=>e.stopPropagation():G}></ha-icon>`:G}</span>
      ${h.length?B`<span class="rlmetrics">${h}</span>`:G}
      ${"plan"===this._mode?["tl","tr","bl","br"].map(i=>B`<span class="rlhandle ${i}"
              @pointerdown=${i=>this._rlResizeDown(i,e,t.id)}
              @pointermove=${e=>this._rlResizeMove(e)}
              @pointerup=${()=>this._rlResizeUp()}
              @pointercancel=${()=>this._rlResizeUp()}></span>`):G}
    </div>`}get _measureAnchor(){return this._markup&&this._cursorPt?"draw"===this._tool&&this._path.length&&!this._contourClosed?this._path[this._path.length-1]:"split"===this._tool&&this._splitSel?.pts?.length?this._splitSel.pts[this._splitSel.pts.length-1]:null:null}_renderMeasureLabel(e){const t=this._measureAnchor,i=this._cursorPt,n=(i[0]-e.x)/e.w*100,r=(i[1]-e.y)/e.h*100,o=On(t,i),s=Math.round(10*o)/10,a=function(e,t,i=.001){if(e.length<2||t.length<2)return!1;const n=Math.abs(t[0]-e[0]),r=Math.abs(t[1]-e[1]);if(!Number.isFinite(n)||!Number.isFinite(r)||Math.hypot(n,r)<=i)return!1;const o=Math.max(n,r,1);return n<=i*o||r<=i*o||Math.abs(n-r)<=i*o}(t,i,2e-4*this._gridPitch);return B`<div class="measurelabel ${a?"on45":""}" style="left:${n}%;top:${r}%">
      ${this._fmtLen(t,i)} · ${s}°</div>`}get _decorMeasure(){const e=this._decorDraft;if(!e||"decor"!==this._mode)return null;const[t,i]=e.a,[n,r]=e.b;if(Math.abs(t-n)<1e-6&&Math.abs(i-r)<1e-6)return null;const o=(t+n)/2,s=(i+r)/2;if("line"===e.kind){const t=On(e.a,e.b);return{x:o,y:s,on45:zn(t),text:`${this._fmtLen(e.a,e.b)} · ${Math.round(10*t)/10}°`}}const a=this._fmtLen([t,i],[n,i]),l=this._fmtLen([n,i],[n,r]);if("ellipse"===e.kind){const e=this._fmtLen([0,0],[Math.abs(n-t)/2,0]),a=this._fmtLen([0,0],[0,Math.abs(r-i)/2]);return{x:o,y:s,on45:!1,text:Math.abs(Math.abs(n-t)-Math.abs(r-i))<1e-6?`R ${e}`:`Rx ${e} × Ry ${a}`}}return{x:o,y:s,on45:!1,text:`${a} × ${l} · ${Hn(vr(Math.abs(n-t),this._cellCm,this._gridPitch)*vr(Math.abs(r-i),this._cellCm,this._gridPitch)/1e4,this._imperial)}`}}get _alignPoint(){if(this._markup){if("draw"===this._tool&&this._path.length&&!this._contourClosed&&this._cursorPt)return this._cursorPt;if("split"===this._tool&&this._splitSel?.pts?.length&&this._cursorPt)return this._cursorPt;if(this._drag?.id.startsWith("rl_")&&this._drag.moved){const e=this._drag.id.slice(3),t=this._spaceModel()?.rooms.find(t=>t.id===e);return t?(()=>{const e=this._labelPos(t,this._space);return[e.x,e.y]})():null}return null}if("devices"===this._mode&&this._drag?.moved){const e=this._devices.find(e=>e.id===this._drag.id);return e?(()=>{const t=this._pos(e);return[t.x,t.y]})():null}if("decor"===this._mode){if(this._decorDraft)return this._decorDraft.b;if(this._decorMove){const e=this._decorList.find(e=>e.id===this._decorMove.id);if(!e)return null;const t=wm,i=this._decorH;return"line"===e.kind?[e.x1*t,e.y1*i]:[e.x*t,e.y*i]}return null}return null}_alignCandidates(){return this._editorRuntimeOrThrow()._alignCandidates()}_renderAlignGuides(){return this._editorRuntimeOrThrow()._renderAlignGuides()}_renderOpeningCenterTick(e){return this._editorRuntimeOrThrow()._renderOpeningCenterTick(e)}_renderOpeningDimensionGuides(e){return this._editorRuntimeOrThrow()._renderOpeningDimensionGuides(e)}_roomCenter(e){if(e.poly){const t=e.poly.length;return[e.poly.reduce((e,t)=>e+t[0],0)/t,e.poly.reduce((e,t)=>e+t[1],0)/t]}return[e.x+e.w/2,e.y+.1*Math.min(e.w,e.h)]}_openingAmt(e){const t=e.contact&&this._renderOpeningEntityAvailable(e.contact)?this._renderPlanHass.states[e.contact]?.state:null;return ii(e.type,t,!!e.invert)}_planEntityAvailable(e){return!!e&&(!qh(this._fullRegistryHass,e,Lh(this._markers))&&"active"===this._bindingStatus("entity:"+e).kind)}_renderEntityAvailable(e){return!!e&&(!qh(this._renderPlanHass,e,Lh(this._markers))&&(!!this._renderPlanHass.entities?.[e]&&!!this._renderPlanHass.states?.[e]))}_openingEntityAvailable(e){return function(e,t,i=Vc(e)){return!!t&&"active"===th(e,`entity:${t}`,i).kind}(this.hass,e,this._haRegistry)}_renderOpeningEntityAvailable(e){return t=this._renderPlanHass,!!(i=e)&&!!t?.states?.[i];var t,i}_renderOpeningPlacementPreview(){return this._editorRuntimeOrThrow()._renderOpeningPlacementPreview()}_renderOpenings(e){const t=this._openingsR;if(!t.length)return W``;const i=this._spaceModel();if(!i)return W``;const n=e.color,r=this._spaceWalls,o=this._openCuts(),s=this._openingWallIndexFor(i,o).value;return W`${t.map(e=>{if(e.orphanReason)return W`<g class="opening orphan" data-hp="opening-orphan"
        data-id=${e.id} role="button" tabindex="0"
        aria-label=${this._t("opening.partition_orphan")}
        transform="translate(${e.rx} ${e.ry})"
        @click=${t=>{t.stopPropagation(),this._editOpening(e)}}>
        <circle r=${xa(.55*this._gridPitch,this._cellCm)}></circle>
        <text text-anchor="middle" dominant-baseline="central">!</text>
      </g>`;const t=this._openingAmt(e),i=t>0&&!!e.contact&&this._renderOpeningEntityAvailable(e.contact)?"var(--hp-open)":n,o="gate"===e.type?!e.flip_v:e.flip_v,a=e.partitionHost||r.length||"gate"===e.type?this._openingFace(e,s,!!o):{ox:0,oy:0,cm:0,side:-1},l={type:e.type,length:e.rlen,angle:e.angle,amount:t,flipH:!!e.flip_h,flipV:!!e.flip_v,base:n,tone:i,cellCm:this._cellCm,gridPitch:this._gridPitch,face:a},{half:c,outlineHalf:h,hitHalf:d}=au(l),u=xa(10,this._cellCm),p=xa(12,this._cellCm);return W`<g class="opening" data-hp="opening" data-id="${e.id}" data-kind="${e.type}"
        transform="translate(${e.rx} ${e.ry}) rotate(${e.angle})">
        ${lu(l)}
        <rect class="op-outline" x="${-c-u}" y="${-h}"
          width="${e.rlen+2*u}" height="${2*h}"
          rx="${xa(6,this._cellCm)}"></rect>
        <rect class="op-hit" x="${-c-p}" y="${-d}"
          width="${e.rlen+2*p}" height="${2*d}"
          @click=${t=>this._opClick(t,e)}
          @pointerdown=${t=>this._opPointerDown(t,e)}
          @pointermove=${t=>this._opPointerMove(t,e)}
          @pointerup=${t=>this._opPointerUp(t,e)}
          @pointercancel=${t=>this._opPointerUp(t,e)}></rect>
      </g>`})}`}_renderOpeningLocks(e){const t=this._openingsR.filter(e=>!e.orphanReason&&("door"===e.type||"gate"===e.type)&&e.lock&&this._renderOpeningEntityAvailable(e.lock));if(!t.length)return B``;const i=this._spaceModel();if(!i)return B``;const n=this._openCuts(),r=this._openingWallIndexFor(i,n).value;return B`${t.map(t=>{const i=this._renderPlanHass.states[t.lock]?.state,n="locked"===i,o=n||["unlocked","open","opening","unlocking","locking"].includes(String(i)),s=(t.angle+90)*Math.PI/180,a="gate"===t.type?this._openingFace(t,r,!t.flip_v):null,l=xa(16,this._cellCm),c=a?-l*a.side:l*(t.flip_v?-1:1),h=t.rx+Math.cos(s)*c,d=t.ry+Math.sin(s)*c,u=this._scenePoint([h,d]),p=(u[0]-e.x)/e.w*100,_=(u[1]-e.y)/e.h*100;return B`<div class="oplock ${Gu(this._renderPlanHass)} ${n?"locked":o?"unlocked":"unknown"}"
        style="left:${p}%;top:${_}%"
        @click=${e=>{e.stopPropagation(),"view"===this._mode&&(this._openingInfo=t)}}>
        <span class="oplock-shell" aria-hidden="true">
          <span class="oplock-core">
            <ha-icon icon="${n?"mdi:lock":o?"mdi:lock-open-variant":"mdi:lock-question"}"></ha-icon>
          </span>
        </span>
      </div>`})}`}_lockAction(e,t){if(this._openingEntityAvailable(e)){if("unlock"===t){const t=this.hass?.states?.[e]?.attributes?.friendly_name||e;if(!confirm(this._t("confirm.unlock",{name:t})))return}this.hass?.callService?.("lock",t,{entity_id:e})}}_renderOpeningInfoCard(){const e=this._openingInfo,t="passage"!==e.type&&e.contact&&this._openingEntityAvailable(e.contact)?e.contact:null,i=("door"===e.type||"gate"===e.type)&&e.lock&&this._openingEntityAvailable(e.lock)?e.lock:null,n=t?this.hass.states[t]?.state:null,r=this._openingAmt(e),o=i?this.hass.states[i]?.state:null,s="door"===e.type?"opening.door":"gate"===e.type?"opening.gate":"passage"===e.type?"opening.passage":"opening.window",a="door"===e.type?"mdi:door":"gate"===e.type?"mdi:gate":"passage"===e.type?"mdi:arch":"mdi:window-closed-variant",l="gate"===e.type?r>0?"mdi:gate-open":"mdi:gate":r>0?"mdi:door-open":"mdi:door-closed",c=(e,t,i,n="")=>B`<div class="oprow ${n}"><ha-icon icon=${e}></ha-icon><span>${t}</span><b>${i}</b></div>`;return B`<hp-dialog .hass=${this.hass}
      .title=${this._t(s)} icon=${a} dismiss-on-scrim
      @hp-close=${()=>this._openingInfo=null}>
        <div class="body">
          ${t?c(l,this._t("opening.contact_label"),"unavailable"===n||null==n?this._t("opening.state_unknown"):this._t(r>0?"opening.open":"opening.closed"),r>0?"warn":"ok"):G}
          ${i?c("locked"===o?"mdi:lock":"mdi:lock-open-variant",this._t("opening.lock_label"),"locked"===o?this._t("opening.locked"):["unlocked","open"].includes(String(o))?this._t("opening.unlocked"):this._t("opening.state_unknown"),"locked"===o?"ok":"warn"):G}
          ${i&&("locked"===o||["unlocked","open"].includes(String(o)))?B`<button
                class="btn lockact ${"locked"===o?"warn":""}"
                @click=${()=>this._lockAction(i,"locked"===o?"unlock":"lock")}>
                <ha-icon icon=${"locked"===o?"mdi:lock-open-variant":"mdi:lock"}></ha-icon>
                ${this._t("locked"===o?"opening.unlock_action":"opening.lock_action")}
              </button>`:i&&["locking","unlocking"].includes(String(o))?B`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("opening.lock_pending")}
                </button>`:G}
          ${t||i?G:B`<p class="muted">${this._t("opening.no_entities")}</p>`}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingInfo=null}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_renderOpeningDialog(){return this._editorRuntimeOrThrow()._renderOpeningDialog()}_gridLevels(){return this._editorRuntimeOrThrow()._gridLevels()}_renderMarkupDefs(e){return this._editorRuntimeOrThrow()._renderMarkupDefs(e)}_renderPhysicalEditorLayer(){return this._editorRuntimeOrThrow()._renderPhysicalEditorLayer()}_renderHiddenWallDiagnosticOverlay(){return this._editorRuntimeOrThrow()._renderHiddenWallDiagnosticOverlay()}_renderPlanSnapOverlay(){return this._editorRuntimeOrThrow()._renderPlanSnapOverlay()}_syncPlanSnapActiveMarker(e){return this._editorRuntimeOrThrow()._syncPlanSnapActiveMarker(e)}_syncPlanSnapConflictMarkers(e){return this._editorRuntimeOrThrow()._syncPlanSnapConflictMarkers(e)}_planSnapPhysicalSegment(e){return this._editorRuntimeOrThrow()._planSnapPhysicalSegment(e)}_drawPreviewJoinPatchD(e,t){return this._editorRuntimeOrThrow()._drawPreviewJoinPatchD(e,t)}_renderMarkupLayer(e){return this._editorRuntimeOrThrow()._renderMarkupLayer(e)}_renderActiveChainInk(){return this._editorRuntimeOrThrow()._renderActiveChainInk()}_renderPartitionDeleteDialog(){return this._editorRuntimeOrThrow()._renderPartitionDeleteDialog()}_renderRoomDeleteDialog(){return this._editorRuntimeOrThrow()._renderRoomDeleteDialog()}_renderPhysicalDialog(){return this._editorRuntimeOrThrow()._renderPhysicalDialog()}_renderMarkupBar(){return this._editorRuntimeOrThrow()._renderMarkupBar()}_renderDevicesBar(){return this._editorRuntimeOrThrow()._renderDevicesBar()}_renderDeviceInbox(){return this._editorRuntimeOrThrow()._renderDeviceInbox()}_cardEntities(e){const t=this._planHass,i=[],n=new Set,r=e=>{if(!e||n.has(e)||!t.states[e])return;const r=t.entities[e];if("config"===r?.entity_category||"diagnostic"===r?.entity_category)return;n.add(e);const o=e.split(".")[0];["light","switch","fan","humidifier","siren","input_boolean"].includes(o)?i.push({eid:e,kind:"toggle"}):["cover","valve","lock","climate","media_player","vacuum","water_heater"].includes(o)?i.push({eid:e,kind:"open"}):["sensor","binary_sensor","number","select"].includes(o)&&i.push({eid:e,kind:"value"})};for(const i of Mh(t,this._devices,null,this._virtualLights))if(i.device.id===e.id)for(const e of[...i.serviceEids,...i.stateEids])r(e);e.primary&&r(e.primary);for(const t of e.entities)r(t);return i.slice(0,12)}_cardToggle(e){const t=e.split(".")[0];"lock"!==t&&"alarm_control_panel"!==t&&this._planEntityAvailable(e)&&this.hass.callService("homeassistant","toggle",{entity_id:e}).catch(e=>this._showToast(this._t("toast.error",{err:this._errText(e)})))}_renderInfoCard(){const e=this._infoCard,t=e.primary?this.hass.states[e.primary]:void 0,i=t?qi(this.hass,e.primary)?.text??t.state:null,n=(e.controls??e.marker?.controls??[]).filter(yn).filter(e=>this._planEntityAvailable(e));return B`<hp-dialog .hass=${this.hass} .title=${e.name} .icon=${e.icon} wide
      dismiss-on-scrim @hp-close=${this._closeInfoCard}>
        <div class="body">
          ${(()=>{const t=this._cardEntities(e);return t.length?B`<div class="entlist">
              ${t.map(({eid:e,kind:t})=>{const i=this.hass.states[e],n=this.hass.entities[e]?.name||i?.attributes?.friendly_name||e,r=i?qi(this.hass,e)?.text??i.state:"",o="on"===i?.state||["open","unlocked","playing","cleaning"].includes(i?.state);return B`<div class="entrow ${o?"on":""}">
                  <ha-icon icon=${dn(Fe(n,"",this._iconRules),e.split(".")[0],i?.attributes?.device_class,i?.state,!1)}></ha-icon>
                  <span class="en">${n}</span>
                  ${"toggle"===t?B`<button class="entbtn ${o?"on":""}"
                        @click=${()=>this._cardToggle(e)}>${r}</button>`:"open"===t?B`<button class="entbtn"
                          @click=${()=>{this._closeInfoCard(),this._openMoreInfo(e)}}>${r}</button>`:B`<span class="ev">${r}</span>`}
                </div>`})}
            </div>`:G})()}
          ${e.model?B`<div class="inforow"><span class="k">${this._t("info.model")}</span><span>${e.model}</span></div>`:G}
          ${i&&!this._cardEntities(e).length?B`<div class="inforow"><span class="k">${this._t("info.state")}</span><span>${i}</span></div>`:G}
          ${Ci(e.link)?B`<div class="inforow"><span class="k">${this._t("info.link")}</span>
                <a href="${Ci(e.link)}" target="_blank" rel="noreferrer noopener">${e.link}</a></div>`:G}
          ${e.description?B`<div class="infodesc">${e.description}</div>`:G}
          ${e.pdfs&&e.pdfs.length?B`<div class="inforow"><span class="k">${this._t("info.manuals")}</span><span class="pdflist">
                ${e.pdfs.map(e=>B`<a class="pdf" href="${Ci(this._display(e.url))||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${e.name}</a>`)}</span></div>`:G}
          ${n.length?B`<div class="inforow"><span class="k">${this._t("info.controls")}</span>
                <span class="ctrlstates">
                  ${n.map(e=>{const t=this.hass.states[e],i="on"===t?.state;return B`<span class="ctrlstate ${i?"on":""}">
                      <ha-icon icon=${i?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>
                      ${t?.attributes?.friendly_name||e}</span>`})}
                </span></div>`:G}
          ${e.model||i||e.link||e.description||e.pdfs&&e.pdfs.length||n.length?G:B`<div class="infodesc muted">${this._t("info.none")}</div>`}
        </div>
        <div class="row infofooter" slot="footer">
          <button class="btn" @click=${()=>{const t=e;this._closeInfoCard(),this._openMarkerDialog(t)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t("btn.edit")}
          </button>
          ${e.primary?B`<button class="btn" @click=${()=>{const t=e.primary;this._closeInfoCard(),this._openMoreInfo(t)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("btn.open_in_ha")}
              </button>`:G}
          <button class="btn ghost infofooter-close" @click=${this._closeInfoCard}>${this._t("btn.close")}</button>
        </div>
    </hp-dialog>`}_markerValueBadgeFields(e){return this._editorRuntimeOrThrow()._markerValueBadgeFields(e)}_markerDraft(e){return this._editorRuntimeOrThrow()._markerDraft(e)}_markerPreviewDevice(e){return this._editorRuntimeOrThrow()._markerPreviewDevice(e)}_markerPreviewDevices(e){return this._editorRuntimeOrThrow()._markerPreviewDevices(e)}_toggleIntent(e,t=this._devices){return this._editorRuntimeOrThrow()._toggleIntent(e,t)}_toggleIntentForDialog(e){return this._editorRuntimeOrThrow()._toggleIntentForDialog(e)}_toggleStateText(e,t){return this._editorRuntimeOrThrow()._toggleStateText(e,t)}_toggleConfirmationStateText(e){return this._editorRuntimeOrThrow()._toggleConfirmationStateText(e)}_toggleConfirmationLines(e){return this._editorRuntimeOrThrow()._toggleConfirmationLines(e)}_toggleHintLines(e){return this._editorRuntimeOrThrow()._toggleHintLines(e)}_effectiveStoredTapAction(e,t){return this._editorRuntimeOrThrow()._effectiveStoredTapAction(e,t)}_effectiveMarkerTapAction(e,t=this._markerPreviewDevice(e)){return this._editorRuntimeOrThrow()._effectiveMarkerTapAction(e,t)}_announceToggleDraft(e){return this._editorRuntimeOrThrow()._announceToggleDraft(e)}_valueBadgeForBinding(e,t){return this._editorRuntimeOrThrow()._valueBadgeForBinding(e,t)}_markerSpatialSource(e){return this._editorRuntimeOrThrow()._markerSpatialSource(e)}_markerAutoHasSpatialSource(e){return this._editorRuntimeOrThrow()._markerAutoHasSpatialSource(e)}_setMarkerLightRole(e){return this._editorRuntimeOrThrow()._setMarkerLightRole(e)}_controlRefInfo(e){return this._editorRuntimeOrThrow()._controlRefInfo(e)}_valueBadgeCandidateLabel(e){return this._editorRuntimeOrThrow()._valueBadgeCandidateLabel(e)}_controlCandidates(e){return this._editorRuntimeOrThrow()._controlCandidates(e)}_addControlRef(e,t){return this._editorRuntimeOrThrow()._addControlRef(e,t)}_setMarkerGlowMode(e){return this._editorRuntimeOrThrow()._setMarkerGlowMode(e)}_renderMarkerDialog(){return this._editorRuntimeOrThrow()._renderMarkerDialog()}_renderSpaceDialog(){return this._onboardingRuntime&&this._spaceDialog&&this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)?this._onboardingRuntime._renderSpaceDialog():this._editorRuntimeOrThrow()._renderSpaceDialog()}_renderMergeDialog(){return this._editorRuntimeOrThrow()._renderMergeDialog()}_renderCardPreview(e,t,i){const n=18*e;return B`<div class="cardpreview">
      <span class="cpname" style="font-size:${(n*t).toFixed(1)}px">
        ${this._t("preview.room_name")}</span>
      <span class="cpmeta" style="font-size:${(.62*n*i).toFixed(1)}px">
        <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
        <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
        <ha-icon icon="mdi:lightbulb-on"></ha-icon>${this._t("roomcard.light_partial",{on:1,total:3})}
      </span>
    </div>`}_renderRoomSource(e){return this._editorRuntimeOrThrow()._renderRoomSource(e)}_renderRoomDialog(){return this._editorRuntimeOrThrow()._renderRoomDialog()}}Cm.properties={_tabDrag:{state:!0},_hdrH:{state:!0},_booting:{state:!0},_bootFading:{state:!0},_bootSoft:{state:!0},_continuityEpoch:{state:!0},_editorRuntimeLoadingVisible:{state:!0},_tapConfirm:{state:!0},hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_hoverRoom:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_mode:{state:!0},_tool:{state:!0},_wallDialog:{state:!0},_drawWallField:{state:!0},_activeDraftId:{state:!0},_physicalSel:{state:!0},_physicalDialog:{state:!0},_partitionDeleteDialog:{state:!0},_roomDeleteDialog:{state:!0},_physicalDrag:{state:!0},_physicalRotate:{state:!0},_duplicateColumnId:{state:!0},_opMeasure:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_mergeSel:{state:!0},_openingPreset:{state:!0},_openingDialog:{state:!0},_openingInfo:{state:!0},_mergeDialog:{state:!0},_splitSel:{state:!0},_decorTool:{state:!0},_decorStyle:{state:!0},_decorDraft:{state:!0},_decorSel:{state:!0},_decorEraseConfirm:{state:!0},_decorTextDialog:{state:!0},_decorShapeDialog:{state:!0},_backdropDialog:{state:!0},_furnPalette:{state:!0},_bdDrag:{state:!0},_dtBox:{state:!0},_dtDrag:{state:!0},_kioskDialog:{state:!0},_vacFit:{state:!0},_vacAllCamerasFor:{state:!0},_vacCalConfirm:{state:!0},_kioskDots:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_roomEditId:{state:!0},_roomFill:{state:!0},_roomCustomFill:{state:!0},_roomTempSrc:{state:!0},_roomHumSrc:{state:!0},_roomSrcOpen:{state:!0},_roomSrcFilter:{state:!0},_roomNameScale:{state:!0},_roomLabelScale:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_deviceInbox:{state:!0},_rulesDialog:{state:!0},_settingsDialog:{state:!0},_alignDialog:{state:!0},_preflightClipboardFallback:{state:!0},_backupExportDialog:{state:!0},_backupImportDialog:{state:!0},_importDialog:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},Cm.ZOOM_MAX=8,Cm.ZOOM_MIN=1/3,Cm.styles=[Bd,qp],customElements.get("houseplan-card")||customElements.define("houseplan-card",Cm),window.customCards=window.customCards||[],window.customCards.find(e=>"houseplan-card"===e.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Interactive house plan: spaces, rooms and devices with live states and drag layout."}),console.info(`%c HOUSEPLAN-CARD %c v${om} `,"background:#3ea6ff;color:#04121f;font-weight:700","");export{Ao as $,G as A,Qt as B,Ia as C,le as D,U as E,Zt as F,Na as G,Td as H,Id as I,gs as J,lo as K,Pd as L,Md as M,No as N,vs as O,Cd as P,Bs as Q,Gs as R,vo as S,oi as T,ao as U,xo as V,tp as W,ip as X,ss as Y,Wr as Z,zo as _,o as a,ts as a$,no as a0,oo as a1,qr as a2,dp as a3,Ra as a4,Fo as a5,Ea as a6,Oo as a7,Ca as a8,Da as a9,ea as aA,Al as aB,up as aC,Rl as aD,Xp as aE,_s as aF,Ns as aG,ks as aH,Bp as aI,hi as aJ,si as aK,$i as aL,va as aM,sa as aN,oa as aO,Pa as aP,Io as aQ,Eo as aR,Ls as aS,Kt as aT,tl as aU,ma as aV,_a as aW,Nn as aX,Hn as aY,pi as aZ,is as a_,Ui as aa,Gi as ab,Hi as ac,Li as ad,za as ae,ms as af,ns as ag,qs as ah,qo as ai,Xs as aj,ba as ak,pp as al,Qs as am,fs as an,ar as ao,sr as ap,or as aq,nn as ar,Ce as as,su as at,z_ as au,fo as av,qa as aw,Gt as ax,Vt as ay,Cr as az,B as b,Yi as b$,W as b0,Up as b1,Gp as b2,kr as b3,Mr as b4,Sr as b5,vr as b6,ja as b7,_r as b8,gr as b9,Fd as bA,wi as bB,li as bC,ei as bD,ci as bE,Lo as bF,Si as bG,mn as bH,ku as bI,xu as bJ,uh as bK,_d as bL,Ai as bM,Ii as bN,En as bO,Cn as bP,Eh as bQ,ro as bR,Hh as bS,Ih as bT,tn as bU,Qi as bV,Ji as bW,Sa as bX,lp as bY,Xi as bZ,Zi as b_,br as ba,On as bb,pr as bc,fr as bd,mr as be,xr as bf,gl as bg,dl as bh,ml as bi,ul as bj,bl as bk,sl as bl,hl as bm,Ho as bn,_o as bo,xa as bp,au as bq,zd as br,im as bs,Od as bt,Vs as bu,X_ as bv,nm as bw,np as bx,ti as by,Dd as bz,he as c,co as c$,Ki as c0,$a as c1,Zp as c2,Wp as c3,rn as c4,Kr as c5,lr as c6,De as c7,Fe as c8,Ae as c9,vd as cA,kd as cB,$d as cC,Rh as cD,Mh as cE,kh as cF,_h as cG,yn as cH,dh as cI,Nh as cJ,gn as cK,qu as cL,uu as cM,xh as cN,$h as cO,mh as cP,cd as cQ,Oi as cR,Di as cS,pu as cT,Ci as cU,Ma as cV,zi as cW,Pi as cX,so as cY,cl as cZ,vl as c_,Bl as ca,Kl as cb,Vi as cc,nc as cd,jl as ce,El as cf,Yl as cg,Wl as ch,Ul as ci,ec as cj,tc as ck,Ql as cl,ic as cm,zl as cn,Dn as co,An as cp,ii as cq,J_ as cr,lu as cs,Z_ as ct,nl as cu,ys as cv,Vo as cw,Ko as cx,$u as cy,Uh as cz,Bd as d,ri as d0,Fa as d1,nu as d2,Dp as d3,Jd as d4,Ap as d5,Cm as d6,pe as e,Gu as f,Vu as g,ui as h,_e as i,Tr as j,fi as k,ru as l,Ol as m,Nt as n,yi as o,gi as p,Lh as q,Yu as r,qt as s,ou as t,qh as u,hu as v,Mu as w,Jt as x,wn as y,Pn as z};
