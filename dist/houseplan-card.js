const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let o=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const a=(t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(s,t,i)},r=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:n,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:h,getOwnPropertySymbols:d,getPrototypeOf:p}=Object,u=globalThis,_=u.trustedTypes,m=_?_.emptyScript:"",g=u.reactiveElementPolyfillSupport,f=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?m:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!n(t,e),y={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),u.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=y){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:o}=c(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const a=s?.call(this);o?.call(this,e),this.requestUpdate(t,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??y}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...h(t),...d(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(r(t))}else void 0!==t&&e.push(r(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),o=t.litNonce;void 0!==o&&s.setAttribute("nonce",o),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==o?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const a=o.fromAttribute(e,t.type);this[s]=a??this._$Ej?.get(s)??a,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(void 0!==t){const a=this.constructor;if(!1===s&&(o=this[t]),i??=a.getPropertyOptions(t),!((i.hasChanged??b)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(a._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},a){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,a??e??this[t]),!0!==o||void 0!==a)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[f("elementProperties")]=new Map,w[f("finalized")]=new Map,g?.({ReactiveElement:w}),(u.reactiveElementVersions??=[]).push("2.1.2");const $=globalThis,x=t=>t,k=$.trustedTypes,S=k?k.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",A=`lit$${Math.random().toFixed(9).slice(2)}$`,M="?"+A,D=`<${M}>`,z=document,P=()=>z.createComment(""),E=t=>null===t||"object"!=typeof t&&"function"!=typeof t,T=Array.isArray,R="[ \t\n\f\r]",O=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,N=/-->/g,I=/>/g,q=RegExp(`>|${R}(?:([^\\s"'>=/]+)(${R}*=${R}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),U=/'/g,H=/"/g,L=/^(?:script|style|textarea|title)$/i,F=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),j=F(1),B=F(2),W=Symbol.for("lit-noChange"),V=Symbol.for("lit-nothing"),Z=new WeakMap,K=z.createTreeWalker(z,129);function Y(t,e){if(!T(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const J=(t,e)=>{const i=t.length-1,s=[];let o,a=2===e?"<svg>":3===e?"<math>":"",r=O;for(let e=0;e<i;e++){const i=t[e];let n,l,c=-1,h=0;for(;h<i.length&&(r.lastIndex=h,l=r.exec(i),null!==l);)h=r.lastIndex,r===O?"!--"===l[1]?r=N:void 0!==l[1]?r=I:void 0!==l[2]?(L.test(l[2])&&(o=RegExp("</"+l[2],"g")),r=q):void 0!==l[3]&&(r=q):r===q?">"===l[0]?(r=o??O,c=-1):void 0===l[1]?c=-2:(c=r.lastIndex-l[2].length,n=l[1],r=void 0===l[3]?q:'"'===l[3]?H:U):r===H||r===U?r=q:r===N||r===I?r=O:(r=q,o=void 0);const d=r===q&&t[e+1].startsWith("/>")?" ":"";a+=r===O?i+D:c>=0?(s.push(n),i.slice(0,c)+C+i.slice(c)+A+d):i+A+(-2===c?e:d)}return[Y(t,a+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class X{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,a=0;const r=t.length-1,n=this.parts,[l,c]=J(t,e);if(this.el=X.createElement(l,i),K.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=K.nextNode())&&n.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=c[a++],i=s.getAttribute(t).split(A),r=/([.?@])?(.*)/.exec(e);n.push({type:1,index:o,name:r[2],strings:i,ctor:"."===r[1]?it:"?"===r[1]?st:"@"===r[1]?ot:et}),s.removeAttribute(t)}else t.startsWith(A)&&(n.push({type:6,index:o}),s.removeAttribute(t));if(L.test(s.tagName)){const t=s.textContent.split(A),e=t.length-1;if(e>0){s.textContent=k?k.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],P()),K.nextNode(),n.push({type:2,index:++o});s.append(t[e],P())}}}else if(8===s.nodeType)if(s.data===M)n.push({type:2,index:o});else{let t=-1;for(;-1!==(t=s.data.indexOf(A,t+1));)n.push({type:7,index:o}),t+=A.length-1}o++}}static createElement(t,e){const i=z.createElement("template");return i.innerHTML=t,i}}function G(t,e,i=t,s){if(e===W)return e;let o=void 0!==s?i._$Co?.[s]:i._$Cl;const a=E(e)?void 0:e._$litDirective$;return o?.constructor!==a&&(o?._$AO?.(!1),void 0===a?o=void 0:(o=new a(t),o._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=o:i._$Cl=o),void 0!==o&&(e=G(t,o._$AS(t,e.values),o,s)),e}class Q{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??z).importNode(e,!0);K.currentNode=s;let o=K.nextNode(),a=0,r=0,n=i[0];for(;void 0!==n;){if(a===n.index){let e;2===n.type?e=new tt(o,o.nextSibling,this,t):1===n.type?e=new n.ctor(o,n.name,n.strings,this,t):6===n.type&&(e=new at(o,this,t)),this._$AV.push(e),n=i[++r]}a!==n?.index&&(o=K.nextNode(),a++)}return K.currentNode=z,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=V,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=G(this,t,e),E(t)?t===V||null==t||""===t?(this._$AH!==V&&this._$AR(),this._$AH=V):t!==this._$AH&&t!==W&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>T(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==V&&E(this._$AH)?this._$AA.nextSibling.data=t:this.T(z.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=X.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new Q(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=Z.get(t.strings);return void 0===e&&Z.set(t.strings,e=new X(t)),e}k(t){T(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new tt(this.O(P()),this.O(P()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=x(t).nextSibling;x(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=V,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=V}_$AI(t,e=this,i,s){const o=this.strings;let a=!1;if(void 0===o)t=G(this,t,e,0),a=!E(t)||t!==this._$AH&&t!==W,a&&(this._$AH=t);else{const s=t;let r,n;for(t=o[0],r=0;r<o.length-1;r++)n=G(this,s[i+r],e,r),n===W&&(n=this._$AH[r]),a||=!E(n)||n!==this._$AH[r],n===V?t=V:t!==V&&(t+=(n??"")+o[r+1]),this._$AH[r]=n}a&&!s&&this.j(t)}j(t){t===V?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class it extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===V?void 0:t}}class st extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==V)}}class ot extends et{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=G(this,t,e,0)??V)===W)return;const i=this._$AH,s=t===V&&i!==V||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==V&&(i===V||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class at{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){G(this,t)}}const rt=$.litHtmlPolyfillSupport;rt?.(X,tt),($.litHtmlVersions??=[]).push("3.3.3");const nt=globalThis;class lt extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let o=s._$litPart$;if(void 0===o){const t=i?.renderBefore??null;s._$litPart$=o=new tt(e.insertBefore(P(),t),t,void 0,i??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return W}}lt._$litElement$=!0,lt.finalized=!0,nt.litElementHydrateSupport?.({LitElement:lt});const ct=nt.litElementPolyfillSupport;ct?.({LitElement:lt}),(nt.litElementVersions??=[]).push("4.2.2");const ht=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),dt=[{pattern:"протечк|leak|water sensor",icon:"mdi:water-alert"},{pattern:"клапан|valve",icon:"mdi:pipe-valve"},{pattern:"дым|smoke",icon:"mdi:smoke-detector"},{pattern:"термоголов|trv|radiator",icon:"mdi:radiator"},{pattern:"температ|temperature|climate sensor",icon:"mdi:thermometer"},{pattern:"qingping|air monitor|молекул|air quality",icon:"mdi:air-filter"},{pattern:"штор|curtain|blind|shade",icon:"mdi:roller-shade"},{pattern:"розетк|plug|socket|outlet",icon:"mdi:power-socket-de"},{pattern:"выключат|switch",icon:"mdi:light-switch"},{pattern:"лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip",icon:"mdi:lightbulb"},{pattern:"камер|camera",icon:"mdi:cctv"},{pattern:"замок|ttlock|lock|sn609|sn9161",icon:"mdi:lock"},{pattern:"ворота|garage|gate",icon:"mdi:garage-variant"},{pattern:"калитк|door|открыт|contact",icon:"mdi:door"},{pattern:"счётчик|счетчик|kws|meter",icon:"mdi:meter-electric"},{pattern:"вводный автомат|breaker|wifimcbn",icon:"mdi:electric-switch"},{pattern:"myheat|котёл|котел|boiler|отоплен|heating",icon:"mdi:water-boiler"},{pattern:"холодильник|fridge",icon:"mdi:fridge"},{pattern:"стиральн|washer|washing",icon:"mdi:washing-machine"},{pattern:"сушилк|dryer",icon:"mdi:tumble-dryer"},{pattern:"пылесос|vacuum|dreame|roborock",icon:"mdi:robot-vacuum"},{pattern:"soundbar|колонк|станц|speaker",icon:"mdi:soundbar"},{pattern:"tv|телевизор|hyundaitv|mitv|television",icon:"mdi:television"},{pattern:"keenetic|роутер|router|mesh|access point",icon:"mdi:router-wireless"},{pattern:"ибп|ups|kirpich",icon:"mdi:battery-charging-high"},{pattern:"slzb|координат|zigbee|coordinator",icon:"mdi:zigbee"},{pattern:"motion|движен|presence|присутств",icon:"mdi:motion-sensor"},{pattern:"humidity|влажн",icon:"mdi:water-percent"}];function pt(t){const e=[];for(const i of t)if(i&&"string"==typeof i.pattern&&i.icon)try{e.push({re:new RegExp(i.pattern,"i"),icon:i.icon})}catch{}return e}const ut=pt(dt),_t={temperature:"mdi:thermometer",humidity:"mdi:water-percent",motion:"mdi:motion-sensor",occupancy:"mdi:motion-sensor",door:"mdi:door",window:"mdi:window-closed",garage_door:"mdi:garage-variant",smoke:"mdi:smoke-detector",moisture:"mdi:water-alert",gas:"mdi:gas-cylinder",power:"mdi:meter-electric",energy:"mdi:meter-electric",illuminance:"mdi:brightness-5",co2:"mdi:molecule-co2",pm25:"mdi:air-filter",battery:"mdi:battery"},mt="mdi:chip";function gt(t,e,i){const s=((t||"")+" "+(e||"")).toLowerCase();for(const{re:t,icon:e}of i??ut)if(t.test(s))return e;return mt}const ft=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];function vt(t){const e=Math.max(0,Math.min(120,(t-40)/140*120));return`hsl(${Math.round(e)}, 85%, 55%)`}function bt(t,e){return Math.round(t/e)*e}function yt(t,e,i=1){const[s,o]=t[0]<e[0]||t[0]===e[0]&&t[1]<=e[1]?[t,e]:[e,t];return`${s[0].toFixed(i)},${s[1].toFixed(i)}-${o[0].toFixed(i)},${o[1].toFixed(i)}`}function wt(t){return t?.poly?.length>=3?t.poly:t&&null!=t.x&&null!=t.y&&null!=t.w&&null!=t.h?[[t.x,t.y],[t.x+t.w,t.y],[t.x+t.w,t.y+t.h],[t.x,t.y+t.h]]:null}function $t(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const[a,r]=e[s],[n,l]=e[o];r>t[1]!=l>t[1]&&t[0]<(n-a)*(t[1]-r)/(l-r)+a&&(i=!i)}return i}function xt(t,e,i){const s=i[0]-e[0],o=i[1]-e[1],a=s*s+o*o;let r=a?((t[0]-e[0])*s+(t[1]-e[1])*o)/a:0;return r=Math.max(0,Math.min(1,r)),Math.hypot(t[0]-(e[0]+r*s),t[1]-(e[1]+r*o))}function kt(t,e,i=1e-6){if(!e||e.length<2)return!1;for(let s=0;s<e.length;s++)if(xt(t,e[s],e[(s+1)%e.length])<=i)return!0;return!1}function St(t,e,i=1e-6){return!(!e||e.length<3)&&(!kt(t,e,i)&&$t(t,e))}function Ct(t,e,i){return(e[0]-t[0])*(i[1]-t[1])-(e[1]-t[1])*(i[0]-t[0])}function At(t,e,i,s,o=1e-9){const a=Ct(i,s,t),r=Ct(i,s,e),n=Ct(t,e,i),l=Ct(t,e,s);return(a>o&&r<-o||a<-o&&r>o)&&(n>o&&l<-o||n<-o&&l>o)}function Mt(t,e,i){let s=!0;for(const o of t){if(St(o,e,i))return!0;kt(o,e,i)||(s=!1)}if(s){const s=[t.reduce((t,e)=>t+e[0],0)/t.length,t.reduce((t,e)=>t+e[1],0)/t.length];return St(s,e,i)}return!1}function Dt(t){return t.length?Math.round(t.reduce((t,e)=>t+e,0)/t.length):null}function zt(t,e){if(e>t[2]/t[3]){const i=t[3],s=t[3]*e;return{x:t[0]-(s-t[2])/2,y:t[1],w:s,h:i}}const i=t[2],s=t[2]/e;return{x:t[0],y:t[1]-(s-t[3])/2,w:i,h:s}}function Pt(t,e,i,s){if(t.length<2)return;const o=e.x+s,a=e.x+e.w-s,r=e.y+s,n=e.y+e.h-s;for(let e=0;e<60;e++){let e=!1;for(let s=0;s<t.length;s++)for(let o=s+1;o<t.length;o++){const a=t[o].x-t[s].x,r=t[o].y-t[s].y,n=Math.hypot(a,r)||.001;if(n<i){const l=(i-n)/2,c=a/n,h=r/n;t[s].x-=c*l,t[s].y-=h*l,t[o].x+=c*l,t[o].y+=h*l,e=!0}}for(const e of t)e.x=Math.max(o,Math.min(a,e.x)),e.y=Math.max(r,Math.min(n,e.y));if(!e)break}}function Et(t){if(!t)return null;const e=t.trim();return/^(https?:)?\/\//i.test(e)||e.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(e)?/^[a-z][\w+.-]*:/i.test(e)&&!/^https?:/i.test(e)?null:e:null}const Tt=new Set(["light","switch","fan","humidifier"]),Rt=new Set(["lock","alarm_control_panel"]);const Ot="#3ea6ff",Nt=.55;function It(t){const e=t?.settings||{},i=!t?.plan_url;return{showBorders:e.show_borders??i,showNames:e.show_names??i,color:"string"==typeof e.room_color&&/^#[0-9a-f]{6}$/i.test(e.room_color)?e.room_color:Ot,opacity:"number"==typeof e.room_opacity?Math.min(1,Math.max(0,e.room_opacity)):Nt,fill:["lqi","light","temp"].includes(e.fill_mode)?e.fill_mode:"none",tempMin:"number"==typeof e.temp_min?e.temp_min:20,tempMax:"number"==typeof e.temp_max?e.temp_max:25}}function qt(t,e,i,s,o=20,a=25){if("lqi"===t)return null==e?null:vt(e);if("light"===t)return"none"===i?null:"on"===i?"#ffd45c":"#9aa0a6";if("temp"===t){if(null==s)return null;const t=Math.min(o,a),e=Math.max(o,a);return s<t?"#4fc3f7":s>e?"#ffd45c":"#66d17a"}return null}function Ut(t,e,i){if(e.identifiers?.[0]?.[0])return e.identifiers[0][0];for(const e of i){const i=t.entities[e]?.platform;if(i)return i}return""}function Ht(t,e){if(/_device_temperature$/.test(e))return!1;if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_temperature$/.test(e);const s=i.attributes||{};return"temperature"===s.device_class||/°C|°F/.test(s.unit_of_measurement||"")||/_temperature$/.test(e)}function Lt(t,e,i){const s=e.map(e=>({eid:e,reg:t.entities[e],st:t.states[e]})).filter(t=>t.reg&&!t.reg.hidden),o=s.filter(t=>!t.reg.entity_category),a=o.length?o:s;if("mdi:thermometer"===i||"mdi:air-filter"===i){const e=a.find(e=>Ht(t,e.eid));if(e)return e.eid}for(const t of ft){const e=a.find(e=>e.eid.split(".")[0]===t);if(e)return e.eid}return a[0]?.eid}function Ft(t,e){const i=[];for(const s of e){const e=t.states[s];if(!e)continue;const o=(e.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(s)||"lqi"===o){const t=parseFloat(e.state);isNaN(t)||i.push(t);continue}const a=e.attributes?.linkquality??e.attributes?.lqi;if(null!=a){const t=parseFloat(a);isNaN(t)||i.push(t)}}return Dt(i)}function jt(t,e){for(const i of e){if(!Ht(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(10*s)/10}return null}function Bt(t,e){if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_humidity$/.test(e);const s=i.attributes||{};return"humidity"===s.device_class||"%"===s.unit_of_measurement&&/_humidity$/.test(e)||/_humidity$/.test(e)}function Wt(t,e){for(const i of e){if(!Bt(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(s)}return null}function Vt(t,e,i,s,o){const a=gt(e,i,o);if(a!==mt)return a;const r=[];for(const e of s){const i=t.states[e]?.attributes?.device_class;i&&r.push(i)}return function(t){for(const e of t){const t=_t[e];if(t)return t}return null}(r)??mt}function Zt(t,e){t.marker=e,e.name&&(t.name=e.name),e.icon&&(t.icon=e.icon),null!=e.model&&(t.model=e.model),t.link=e.link??null,t.description=e.description??null,t.pdfs=e.pdfs||[],t.tapAction=e.tap_action??null}function Kt(t){const{hass:e,areaToSpace:i,markers:s,settings:o,excluded:a,showAll:r,firstSpaceId:n,loc:l,iconRules:c}=t,h=!1!==o.group_lights,d=function(t,e){if(!e)return[];const i=[];for(const[e,s]of Object.entries(t.entities)){if(!e.startsWith("light.")||s.hidden)continue;let o=null;if("group"===s.platform)o=s.area_id||null;else{if(!s.device_id)continue;{const e=t.devices[s.device_id];if("Group"!==e?.model)continue;o=e.area_id||s.area_id||null}}if(!o)continue;const a=t.states[e];i.push({eid:e,name:s.name||a?.attributes?.friendly_name||e,area:o})}return i}(e,h),p=new Set(d.map(t=>t.area)),u=function(t){const e={};for(const[i,s]of Object.entries(t.entities))s?.device_id&&(e[s.device_id]=e[s.device_id]||[]).push(i);return e}(e),_=new Set;for(const t of s){const[e,i]=t.binding.split(":");"device"!==e&&"entity"!==e||!i||_.add(t.binding)}const m=(t,e)=>s.find(i=>i.binding===t+":"+e),g={},f=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(_.has("device:"+t.id))continue;const o=m("device",t.id);if(o&&o.hidden)continue;const n=u[t.id]||[],d=Ut(e,t,n);if(!r){if(a.has(d))continue;if("Group"===t.model)continue;if(/scene/i.test(t.model||""))continue;if(/bridge/i.test((t.model||"")+(t.name||"")))continue;if("myheat"===d&&t.via_device_id)continue}const v=(t.name_by_user||t.name||l("device.unnamed")).trim(),b=v+"|"+s;let y=Vt(e,v,t.model,n,c);if(n.some(t=>t.startsWith("lock."))&&(y="mdi:lock"),!r&&h&&"mdi:lightbulb"===y&&p.has(s))continue;g[b]=(g[b]||0)+1;const w=g[b]>1?v+" "+g[b]:v,$={id:t.id,name:w,model:t.model||"",area:s,space:i[s],icon:y,entities:n,bindingKind:"device",bindingRef:t.id,pdfs:[]};$.primary=Lt(e,n,y),"mdi:thermometer"!==y&&"mdi:air-filter"!==y||($.temp=jt(e,n)),$.primary&&Bt(e,$.primary)&&($.hum=Wt(e,n)),f.push($)}for(const t of d)i[t.area]&&(_.has("entity:"+t.eid)||f.push({id:"lg_"+t.eid,name:t.name,model:l("device.light_group"),area:t.area,space:i[t.area],icon:"mdi:lightbulb-group",entities:[t.eid],primary:t.eid,bindingKind:"entity",bindingRef:t.eid,pdfs:[]}));for(const t of s){if(t.hidden)continue;const[s,o]=t.binding.split(":");if("device"===s){const s=e.devices[o],a=t.area||s?.area_id||"",r=a&&i[a]||t.space||n,h=s&&u[s.id]||[];let d=s?Vt(e,s.name_by_user||s.name||"",s.model,h,c):"mdi:help-circle";h.some(t=>t.startsWith("lock."))&&(d="mdi:lock");const p={id:t.id,name:s?.name_by_user||s?.name||l("device.fallback"),model:s?.model||"",area:a,space:r,icon:d,entities:h,bindingKind:"device",bindingRef:o};p.primary=Lt(e,h,d),"mdi:thermometer"!==d&&"mdi:air-filter"!==d||(p.temp=jt(e,h)),p.primary&&Bt(e,p.primary)&&(p.hum=Wt(e,h)),p.primary&&Bt(e,p.primary)&&(p.hum=Wt(e,h)),Zt(p,t),f.push(p)}else if("entity"===s){const s=e.entities[o],a=t.area||s?.area_id||s?.device_id&&e.devices[s.device_id]?.area_id||"",r=a&&i[a]||t.space||n,l=e.states[o],h=s?.name||l?.attributes?.friendly_name||o;let d=Vt(e,h,"",[o],c);o.startsWith("lock.")&&(d="mdi:lock");const p={id:t.id,name:h,model:"",area:a,space:r,icon:d,entities:[o],primary:o,bindingKind:"entity",bindingRef:o};"mdi:thermometer"!==d&&"mdi:air-filter"!==d||(p.temp=jt(e,[o])),Bt(e,o)&&(p.hum=Wt(e,[o])),Zt(p,t),f.push(p)}else{const e=t.area||"",s=t.space||e&&i[e]||n,o={id:t.id,name:t.name||l("device.virtual"),model:t.model||"",area:e,space:s,icon:t.icon||"mdi:map-marker",entities:[],bindingKind:"virtual",virtual:!0};Zt(o,t),f.push(o)}}return f}function Yt(t,e,i){let s=!1;for(const o of e)if(o.area===i)for(const e of o.entities)if(e.startsWith("light.")&&(s=!0,"on"===t.states[e]?.state))return"on";return s?"off":"none"}function Jt(t,e,i){const s=[];for(const o of e){if(o.area!==i)continue;if("mdi:thermometer"!==o.icon&&"mdi:air-filter"!==o.icon)continue;const e=jt(t,o.entities);null!=e&&s.push(e)}return s.length?Math.round(s.reduce((t,e)=>t+e,0)/s.length*10)/10:null}var Xt={"card.title":"House plan","count.devices":"{n} dev.","empty.no_spaces":"No spaces yet.","empty.add_first":"Add the first space and upload a floor plan.","empty.install":'Install the House Plan integration and add it in "Devices & services".',"btn.add_space":"Add space","btn.cancel":"Cancel","btn.save":"Save","btn.close":"Close","btn.delete":"Delete","btn.remove":"Remove","btn.edit":"Edit","btn.open_in_ha":"Open in HA","btn.reset":"Reset","btn.attach":"Attach…","btn.upload":"Upload…","btn.replace":"Replace…","btn.no_area":"No area","title.zoom_in":"Zoom in","title.zoom_out":"Zoom out","title.zoom_reset":"Reset zoom","title.add_device":"Add a device to the plan","title.show_all":"Show all area devices (no curation)","title.reset_layout":"Reset icon positions to auto layout","title.markup":"Room markup: grid, lines, outlines","title.configure_space":"Configure space","title.add_space":"Add space","title.markup_add":"Add a room: connect grid dots with lines until the outline closes","title.markup_delroom":"Delete a room: click inside the room","title.no_area_room":"Decorative room without an HA area (e.g. a hallway)","title.choose_area":"Select a Home Assistant area","title.need_plan":"Upload a floor-plan image","markup.add":"Add","markup.delete":"Delete","markup.hint_points":"points: {n} · Esc/Ctrl+Z — undo a dot · close the outline by clicking the first one","markup.hint_start":"click a grid dot to start the outline","tip.room":"room — open the area","tip.lqi":"average zigbee signal:","info.device_header":"Device on the plan","info.model":"Model","info.state":"State","info.link":"Link","info.manuals":"Manuals","info.none":"No additional information","marker.new_device":"New device","marker.name_label":"Name (shown on the plan)","marker.name_ph":"Name","marker.binding_label":"Bind to an HA device","marker.virtual_option":"Virtual device (no binding)","marker.search_ph":"Search device / group…","marker.nothing_found":"nothing found","marker.room_label":"Room","marker.room_override":" (override placement)","marker.room_choose":"— select a room —","marker.room_auto":"— by device area (auto) —","marker.icon_label":"Icon","marker.icon_ph":"mdi:… (empty = auto)","marker.model_label":"Model","marker.model_ph":"e.g. Aqara T&H","marker.link_label":"Link","marker.desc_label":"Description","marker.desc_ph":"Notes, specs…","marker.manuals_label":"Manuals (PDF etc.)","marker.sub_device":"device","marker.sub_z2m_group":" · Z2M group","marker.sub_group":"group","marker.sub_helper":"helper","space.new":"New space","space.header":"Space","space.title_label":"Title","space.title_ph":"e.g. Garage","space.plan_label":"Floor plan (background)","space.no_plan":"no plan image","space.plan_alt":"plan","room.new":"New room","room.name_label":"Display name","room.name_ph":"e.g. Terrace","room.area_label":"Home Assistant area (unassigned)","room.no_area_option":"— no area —","room.default_name":"Room","device.unnamed":"unnamed","device.light_group":"light group","device.fallback":"device","device.virtual":"virtual device","confirm.reset_layout":"Reset all icon positions to the auto layout?","confirm.delete_room":'Delete room "{name}"?',"confirm.remove_marker":'Remove "{name}" from the plan?',"confirm.delete_space":'Delete space "{title}" with all its rooms and markup?',"toast.pos_save_failed":"Failed to save position: {err}","toast.no_entity":"The device has no suitable entity","toast.markup_needs_server":"Markup is available after the config is moved to the server","toast.conflict":"Config was changed in another window — data refreshed, repeat your last action","toast.cfg_save_failed":"Failed to save config: {err}","toast.point_in_room":"That point is inside room “{name}” — rooms must not overlap","toast.room_overlap":"The outline overlaps room “{name}” — rooms must not overlap","toast.room_saved":"Room saved ({n}). Devices added: {added}. Outline the next one or exit markup.","toast.room_saved_no_area":"Room saved ({n}, no area). Outline the next one or exit markup.","toast.marker_needs_server":"Device editing is available after the config is moved to the server","toast.virtual_name_required":"Enter a name for the virtual device","toast.marker_saved":"Device saved","toast.marker_removed":"Device removed from the plan","toast.integration_missing":"The House Plan integration is not installed — management unavailable","toast.plan_formats":"Supported formats: SVG, PNG, JPG, WebP","toast.plan_required":"Upload a floor plan — it is required","toast.space_added_onboard":"Space added. Outline the rooms: click grid dots and close the contour.","toast.space_added":"Space added","toast.space_saved":"Space saved","toast.space_deleted":"Space deleted","toast.delete_failed":"Delete failed: {err}","toast.error":"Error: {err}","toast.file_failed":'File "{name}" was not uploaded: {err}',"toast.files_attached":"Files attached: {n}","err.unknown":"unknown error","err.code":"code {code}","err.too_large":"file larger than {mb} MB","err.bad_ext":"unsupported type (PDF/image expected)","err.unauthorized":"administrator rights required","editor.title":"Title","editor.default_floor":"Default space","editor.icon_size":"Icon size, % of plan width","editor.show_temperature":"Show temperature","editor.live_states":"Live states (on/off, open…)","editor.show_signal":"Show zigbee signal (LQI)","editor.language":"Interface language","editor.lang_auto":"Auto (HA profile)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Icon rules: which MDI icon devices get by name","rules.title":"Icon rules","rules.hint":"Rules are checked top-down against “device name + model” (case-insensitive regex); the first match wins. When nothing matches, the entity device class decides, then the generic chip icon.","rules.pattern_ph":"regex, e.g. plug|socket","rules.icon_ph":"mdi:power-socket-de","rules.add":"Add rule","rules.reset":"Reset to defaults","rules.test_ph":"Try a device name…","rules.invalid":"invalid regex","rules.saved":"Icon rules saved","btn.up":"Up","btn.down":"Down","editor.tap_action":"Tap on a device","tap.info":"Info card","tap.more_info":"HA more-info dialog","tap.toggle":"Toggle (lights/switches)","tap.auto":"As the card default","marker.tap_label":"Tap action for this device","tap.toggle_note":"Toggle never applies to locks and alarms; hold the icon to open the info card.","import.title":"Create spaces from HA floors","import.hint":"Your Home Assistant already knows these floors. Pick the ones to turn into plan spaces — you will upload a floor-plan image for each one next. Rooms are then outlined by hand on the plan.","import.start":"Create {n} space(s)","import.manual":"Start from scratch","import.progress":"Floor {i} of {n}","import.done":"Spaces created. Outline the rooms: click grid dots and close the contour.","btn.skip":"Skip","space.scale_label":"Scale (grid cell size)","space.scale_unit":"cm per cell","space.display_section":"Display","space.show_borders":"Always show room borders","space.show_names":"Show room names (drag to move)","space.room_color":"Border & name color","space.opacity":"Opacity","space.fill_label":"Room fill","fill.none":"None","fill.lqi":"Zigbee signal","fill.light":"Lights","space.source_file":"I have a floor-plan image","space.source_draw":"No image — I'll outline rooms by hand","space.orientation":"Canvas","orient.landscape":"Landscape","orient.portrait":"Portrait","orient.square":"Square","fill.temp":"Temperature","space.temp_min":"Comfort from","space.temp_max":"to","tip.temp_avg":"average temperature:","space_card.button":"Open the space plan","space_card.not_found":"Space “{id}” not found","space_card.loading":"Loading…","editor.space":"Space","editor.show_button":"Show button","editor.button_label":"Button label","editor.button_target":"Target dashboard path","editor.aspect_ratio":"Aspect ratio (e.g. 16:9 or auto)","marker.sub_entity":"entity"};const Gt={en:Xt,ru:{"card.title":"План дома","count.devices":"{n} устр.","empty.no_spaces":"Пространств пока нет.","empty.add_first":"Добавьте первое пространство и загрузите план этажа.","empty.install":"Установите интеграцию House Plan и добавьте запись в «Устройства и службы».","btn.add_space":"Добавить пространство","btn.cancel":"Отмена","btn.save":"Сохранить","btn.close":"Закрыть","btn.delete":"Удалить","btn.remove":"Убрать","btn.edit":"Редактировать","btn.open_in_ha":"Открыть в HA","btn.reset":"Сброс","btn.attach":"Прикрепить…","btn.upload":"Загрузить…","btn.replace":"Заменить…","btn.no_area":"Без зоны","title.zoom_in":"Приблизить","title.zoom_out":"Отдалить","title.zoom_reset":"Сбросить масштаб","title.add_device":"Добавить устройство на план","title.show_all":"Показывать все устройства зоны (без курирования)","title.reset_layout":"Сбросить позиции значков к авто-раскладке","title.markup":"Разметка комнат: сетка, линии, контуры","title.configure_space":"Настроить пространство","title.add_space":"Добавить пространство","title.markup_add":"Добавить комнату: соединяйте точки сетки линиями до замкнутого контура","title.markup_delroom":"Удалить комнату: клик внутри комнаты","title.no_area_room":"Декоративная комната без привязки к зоне (например, холл)","title.choose_area":"Выберите зону Home Assistant","title.need_plan":"Загрузите подложку (план этажа)","markup.add":"Добавить","markup.delete":"Удалить","markup.hint_points":"точек: {n} · Esc/Ctrl+Z — убрать точку · замкните контур кликом по первой","markup.hint_start":"кликните точку сетки, чтобы начать контур","tip.room":"комната — открыть зону","tip.lqi":"средний сигнал zigbee:","info.device_header":"Устройство на плане","info.model":"Модель","info.state":"Состояние","info.link":"Ссылка","info.manuals":"Инструкции","info.none":"Нет дополнительной информации","marker.new_device":"Новое устройство","marker.name_label":"Имя (отображается на плане)","marker.name_ph":"Название","marker.binding_label":"Привязка к устройству HA","marker.virtual_option":"Виртуальное устройство (без привязки)","marker.search_ph":"Поиск устройства / группы…","marker.nothing_found":"ничего не найдено","marker.room_label":"Комната","marker.room_override":" (переопределить размещение)","marker.room_choose":"— выберите комнату —","marker.room_auto":"— по зоне устройства (авто) —","marker.icon_label":"Иконка","marker.icon_ph":"mdi:… (пусто = авто)","marker.model_label":"Модель","marker.model_ph":"напр. Aqara T&H","marker.link_label":"Ссылка","marker.desc_label":"Описание","marker.desc_ph":"Заметки, характеристики…","marker.manuals_label":"Инструкции (PDF и т.п.)","marker.sub_device":"устройство","marker.sub_z2m_group":" · Z2M-группа","marker.sub_group":"группа","marker.sub_helper":"хелпер","space.new":"Новое пространство","space.header":"Пространство","space.title_label":"Название","space.title_ph":"Например: Гараж","space.plan_label":"Подложка (план)","space.no_plan":"нет подложки","space.plan_alt":"план","room.new":"Новая комната","room.name_label":"Отображаемое имя","room.name_ph":"Например: Терраса","room.area_label":"Зона Home Assistant (свободные)","room.no_area_option":"— без зоны —","room.default_name":"Комната","device.unnamed":"без имени","device.light_group":"группа света","device.fallback":"устройство","device.virtual":"виртуальное устройство","confirm.reset_layout":"Сбросить позиции всех иконок к авто-раскладке?","confirm.delete_room":"Удалить комнату «{name}»?","confirm.remove_marker":"Убрать «{name}» с плана?","confirm.delete_space":"Удалить пространство «{title}» со всеми комнатами и разметкой?","toast.pos_save_failed":"Не удалось сохранить позицию: {err}","toast.no_entity":"У устройства нет подходящей сущности","toast.markup_needs_server":"Разметка доступна после переноса конфига на сервер","toast.conflict":"Конфиг изменён в другом окне — данные обновлены, повторите последнее действие","toast.cfg_save_failed":"Не удалось сохранить конфиг: {err}","toast.point_in_room":"Точка внутри комнаты «{name}» — комнаты не должны накладываться","toast.room_overlap":"Контур накладывается на комнату «{name}» — комнаты не должны накладываться","toast.room_saved":"Комната сохранена ({n}). Устройств добавлено: {added}. Обведите следующую или выйдите из разметки.","toast.room_saved_no_area":"Комната сохранена ({n}, без зоны). Обведите следующую или выйдите из разметки.","toast.marker_needs_server":"Редактирование устройств доступно после переноса конфига на сервер","toast.virtual_name_required":"Укажите имя виртуального устройства","toast.marker_saved":"Устройство сохранено","toast.marker_removed":"Устройство убрано с плана","toast.integration_missing":"Интеграция House Plan не установлена — управление недоступно","toast.plan_formats":"Поддерживаются SVG, PNG, JPG, WebP","toast.plan_required":"Загрузите подложку — план этажа обязателен","toast.space_added_onboard":"Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.","toast.space_added":"Пространство добавлено","toast.space_saved":"Пространство сохранено","toast.space_deleted":"Пространство удалено","toast.delete_failed":"Ошибка удаления: {err}","toast.error":"Ошибка: {err}","toast.file_failed":"Файл «{name}» не загружен: {err}","toast.files_attached":"Прикреплено файлов: {n}","err.unknown":"неизвестная ошибка","err.code":"код {code}","err.too_large":"файл больше {mb} МБ","err.bad_ext":"недопустимый тип (нужен PDF/изображение)","err.unauthorized":"нужны права администратора","editor.title":"Заголовок","editor.default_floor":"Пространство по умолчанию","editor.icon_size":"Размер иконок, % ширины плана","editor.show_temperature":"Показывать температуру","editor.live_states":"Живые состояния (вкл/выкл, открыто…)","editor.show_signal":"Показывать сигнал zigbee (LQI)","editor.language":"Язык интерфейса","editor.lang_auto":"Авто (профиль HA)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Правила иконок: какая MDI-иконка достаётся устройству по имени","rules.title":"Правила иконок","rules.hint":"Правила проверяются сверху вниз по строке «имя устройства + модель» (regex без учёта регистра); срабатывает первое совпадение. Если ничего не подошло — решает device class сущности, затем — иконка-заглушка.","rules.pattern_ph":"regex, напр. розетк|plug","rules.icon_ph":"mdi:power-socket-de","rules.add":"Добавить правило","rules.reset":"Сбросить к умолчаниям","rules.test_ph":"Проверьте имя устройства…","rules.invalid":"некорректный regex","rules.saved":"Правила иконок сохранены","btn.up":"Вверх","btn.down":"Вниз","editor.tap_action":"Тап по устройству","tap.info":"Инфо-карточка","tap.more_info":"Диалог HA (more-info)","tap.toggle":"Переключить (свет/розетки)","tap.auto":"Как в настройках карточки","marker.tap_label":"Действие по тапу для этого устройства","tap.toggle_note":"Toggle никогда не применяется к замкам и сигнализациям; долгое нажатие всегда открывает инфо-карточку.","import.title":"Создать пространства из этажей HA","import.hint":"Home Assistant уже знает эти этажи. Отметьте, какие превратить в пространства плана — далее для каждого попросим картинку плана. Комнаты затем обводятся вручную по плану.","import.start":"Создать: {n}","import.manual":"Начать с нуля","import.progress":"Этаж {i} из {n}","import.done":"Пространства созданы. Обведите комнаты: кликайте по точкам сетки и замкните контур.","btn.skip":"Пропустить","space.scale_label":"Масштаб (размер клетки сетки)","space.scale_unit":"см на клетку","space.display_section":"Отображение","space.show_borders":"Всегда отображать границы комнат","space.show_names":"Отображать названия комнат (перетаскиваются)","space.room_color":"Цвет границ и названий","space.opacity":"Прозрачность","space.fill_label":"Заливка комнат","fill.none":"Нет","fill.lqi":"По силе зигби-сигнала","fill.light":"По освещению","space.source_file":"У меня есть картинка плана","space.source_draw":"Нет подложки — нарисую комнаты вручную","space.orientation":"Холст","orient.landscape":"Альбомный","orient.portrait":"Портретный","orient.square":"Квадрат","fill.temp":"По температуре","space.temp_min":"Комфорт от","space.temp_max":"до","tip.temp_avg":"средняя температура:","space_card.button":"Перейти к пространству","space_card.not_found":"Пространство «{id}» не найдено","space_card.loading":"Загрузка…","editor.space":"Пространство","editor.show_button":"Показывать кнопку","editor.button_label":"Текст кнопки","editor.button_target":"Путь дашборда (куда вести)","editor.aspect_ratio":"Соотношение сторон (напр. 16:9 или auto)","marker.sub_entity":"сущность"}};function Qt(t,e){if(e&&e in Gt)return e;return(t?.locale?.language||t?.language||"en").toLowerCase().startsWith("ru")?"ru":"en"}function te(t,e,i){return function(t,e){if(!e)return t;let i=t;for(const[t,s]of Object.entries(e))i=i.split("{"+t+"}").join(String(s));return i}(Gt[t][e]??Xt[e]??e,i)}class ee extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return Qt(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[],e=this._lang;return[{name:"title",selector:{text:{}}},t.length?{name:"default_floor",selector:{select:{mode:"dropdown",options:t}}}:{name:"default_floor",selector:{text:{}}},{name:"language",selector:{select:{mode:"dropdown",options:[{value:"",label:te(e,"editor.lang_auto")},{value:"en",label:te(e,"editor.lang_en")},{value:"ru",label:te(e,"editor.lang_ru")}]}}},{name:"tap_action",selector:{select:{mode:"dropdown",options:[{value:"info",label:te(e,"tap.info")},{value:"more-info",label:te(e,"tap.more_info")},{value:"toggle",label:te(e,"tap.toggle")}]}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}}]}render(){if(!this.hass||!this._config)return V;this._loadSpaces();const t=this._lang,e={title:te(t,"editor.title"),default_floor:te(t,"editor.default_floor"),language:te(t,"editor.language"),tap_action:te(t,"editor.tap_action"),icon_size:te(t,"editor.icon_size"),show_temperature:te(t,"editor.show_temperature"),live_states:te(t,"editor.live_states"),show_signal:te(t,"editor.show_signal")};return j`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}ee.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-card-editor")||customElements.define("houseplan-card-editor",ee);const ie=a`
    :host {
      --hp-bg: var(--card-background-color, #16212e);
      --hp-line: var(--divider-color, #2b3d4f);
      --hp-txt: var(--primary-text-color, #e6edf3);
      --hp-muted: var(--secondary-text-color, #8aa0b3);
      --hp-accent: var(--primary-color, #3ea6ff);
      --hp-on: #ffd45c;
      --hp-open: #ff9f43;
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
      gap: 8px;
    }
    .empty .big {
      --mdc-icon-size: 56px;
      color: var(--hp-accent);
      opacity: 0.7;
    }
    .empty .muted {
      color: var(--hp-muted);
      font-size: 13px;
      margin: 0;
    }
    .empty .btn {
      margin-top: 8px;
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
      padding: 10px 14px;
      border-bottom: 1px solid var(--hp-line);
      flex-wrap: wrap;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .title ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 18px;
    }
    .tabs {
      display: flex;
      gap: 4px;
      background: rgba(127, 127, 127, 0.12);
      padding: 3px;
      border-radius: 10px;
      flex-wrap: wrap;
    }
    @media (max-width: 620px) {
      .head { gap: 6px; padding: 8px 10px; }
      .head .count { display: none; }
      .head .title { font-size: 14px; }
    }
    .tab {
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      padding: 6px 13px;
      border-radius: 8px;
      font-size: 13px;
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
      font-size: 12px;
      color: var(--hp-muted);
    }
    .spacer {
      flex: 1;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
      font-size: 12.5px;
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
    }
    .zoomctl {
      display: inline-flex;
      gap: 2px;
      background: rgba(127, 127, 127, 0.12);
      border-radius: 8px;
      padding: 2px;
    }
    .zoomctl .zb {
      border: none;
      padding: 5px 7px;
    }
    .zoomctl .zb[disabled] {
      opacity: 0.4;
      pointer-events: none;
    }
    .zoombadge {
      position: absolute;
      left: 8px;
      bottom: 8px;
      background: var(--card-background-color, var(--hp-bg));
      opacity: 0.92;
      color: var(--hp-txt);
      border: 1px solid var(--hp-accent);
      border-radius: 8px;
      padding: 2px 8px;
      font-size: 12px;
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
    .room {
      transition: 0.12s;
      cursor: pointer;
    }
    .room.overlay {
      fill: transparent;
      stroke: transparent;
      stroke-width: 2;
    }
    .room.overlay:not(.styled):hover {
      fill: #9aa0a6;
      fill-opacity: 0.22;
      stroke: var(--hp-muted);
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: 2;
    }
    .room.yard:not(.styled):hover {
      fill: rgba(75, 140, 90, 0.24);
      stroke: #6fbf86;
    }
    .room.styled {
      stroke: var(--room-stroke, transparent);
      stroke-opacity: var(--room-stroke-op, 0);
      stroke-width: 2.5;
      fill: var(--room-fill, transparent);
      fill-opacity: var(--room-fill-op, 0);
    }
    /* hover: darken the current fill instead of recoloring; grey when unfilled */
    .room.styled.filled:hover {
      filter: brightness(0.78);
      stroke-opacity: 1;
    }
    .room.styled:not(.filled):hover {
      fill: #9aa0a6;
      fill-opacity: 0.22;
      stroke-opacity: 1;
    }
    .roomlabel {
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.5);
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
      cursor: grab;
      pointer-events: auto;
      user-select: none;
      text-shadow: 0 0 4px var(--card-background-color, rgba(0, 0, 0, 0.6));
      z-index: 1;
    }
    .roomlabel:active { cursor: grabbing; }
    .measurelayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .measurelabel {
      position: absolute;
      transform: translate(12px, -150%);
      font-size: 12px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      z-index: 3;
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
    .stage.markup .room {
      pointer-events: none;
    }
    .stage.markup .devlayer {
      display: none; /* in markup mode icons must not get in the way */
    }
    .room.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      fill: rgba(62, 166, 255, 0.06);
    }
    .griddot {
      fill: var(--hp-accent);
      opacity: 0.75;
      stroke: rgba(0, 0, 0, 0.35);
      stroke-width: 0.4;
    }
    .seg {
      stroke: var(--hp-accent);
      stroke-width: 2.5;
      stroke-linecap: round;
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
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 13px;
      font-family: inherit;
    }
    .namein {
      width: 130px;
    }
    .devlayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .dev {
      position: absolute;
      /* центр квадрата (включая рамку 1px) точно на точке привязки: -(size/2 + border) */
      width: var(--icon-size, 2.5cqw);
      height: var(--icon-size, 2.5cqw);
      margin: calc(var(--icon-size, 2.5cqw) / -2 - 1px) 0 0 calc(var(--icon-size, 2.5cqw) / -2 - 1px);
      border-radius: 22%;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--hp-txt);
      cursor: grab;
      pointer-events: auto;
      transition: background 0.15s, border-color 0.15s, opacity 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      z-index: 2;
    }
    .dev ha-icon {
      --mdc-icon-size: calc(var(--icon-size, 2.5cqw) * 0.62);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .dev:active {
      cursor: grabbing;
    }
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
    .dev.sel {
      border-color: #ffc14d;
      box-shadow: 0 0 0 3px rgba(255, 193, 77, 0.35);
    }

    .dev .tval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--icon-size, 2.5cqw) * 0.1);
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid var(--hp-accent);
      border-radius: calc(var(--icon-size, 2.5cqw) * 0.18);
      padding: 0 calc(var(--icon-size, 2.5cqw) * 0.14);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.45);
      font-weight: 700;
      line-height: calc(var(--icon-size, 2.5cqw) * 0.68);
      color: var(--hp-txt);
      white-space: nowrap;
      pointer-events: none;
    }
.dev .hval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--icon-size, 2.5cqw) * 0.1);
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid #4fc3f7;
      border-radius: calc(var(--icon-size, 2.5cqw) * 0.18);
      padding: 0 calc(var(--icon-size, 2.5cqw) * 0.14);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.45);
      font-weight: 700;
      line-height: calc(var(--icon-size, 2.5cqw) * 0.68);
      color: var(--hp-txt);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .lqi {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: calc(var(--icon-size, 2.5cqw) * 0.05);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.38);
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
      padding: 9px 14px;
      border-bottom: 1px solid var(--hp-line);
      font-size: 13px;
      flex-wrap: wrap;
    }
    .tab .tabedit {
      --mdc-icon-size: 13px;
      margin-left: 6px;
      opacity: 0.4;
      vertical-align: middle;
    }
    .tab:hover .tabedit {
      opacity: 0.9;
    }
    .tab.tabadd {
      padding: 6px 8px;
    }
    .tab.tabadd ha-icon {
      --mdc-icon-size: 15px;
    }
    .srcrow {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      cursor: pointer;
      padding: 2px 0;
    }
    .dispsection {
      margin-top: 12px !important;
      padding-top: 8px;
      border-top: 1px solid var(--hp-line);
      font-weight: 600;
      color: var(--hp-txt) !important;
    }
    .colorrow {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .colorrow input[type='color'] {
      width: 42px;
      height: 28px;
      border: 1px solid var(--hp-line);
      border-radius: 6px;
      background: transparent;
      padding: 1px;
      cursor: pointer;
    }
    .colorrow input[type='range'] { flex: 1; }
    .colorrow .tempin { width: 70px; flex: none; }
    .temprange {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: auto;
      color: var(--hp-muted);
      font-size: 12px;
    }
    /* beat the generic .dialog .body .namein { width:100% } rule */
    .dialog .body .temprange .tempin { width: 56px; flex: none; padding: 3px 6px; }
    .srcrow { flex-wrap: nowrap; }
    .srcrow > span:first-of-type { white-space: nowrap; }
    .colorrow .opl { color: var(--hp-muted); font-size: 12px; }
    .colorrow .opv { font-size: 12px; min-width: 34px; text-align: right; }
    .planrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .planprev {
      max-width: 120px;
      max-height: 70px;
      border: 1px solid var(--hp-line);
      border-radius: 6px;
      background: #fff;
    }
    .planname {
      font-size: 12.5px;
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
    .dialog .row .spacer {
      flex: 1;
    }
    .dialog.wide {
      width: min(500px, 94vw);
    }
    .dialog .body {
      max-height: 66vh;
      overflow-y: auto;
    }
    .descin {
      width: 100%;
      box-sizing: border-box;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 13px;
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
      gap: 6px;
      border: 1px solid var(--hp-line);
      border-radius: 8px;
      padding: 8px;
    }
    .bindsel .opt {
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      font-size: 12.5px;
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
      gap: 6px;
      font-size: 12.5px;
      color: var(--hp-txt);
      flex-wrap: wrap;
    }
    .curbind .ref {
      color: var(--hp-muted);
      font-size: 11px;
    }
    .candlist {
      max-height: 160px;
      overflow-y: auto;
      border-top: 1px solid var(--hp-line);
    }
    .cand {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      cursor: pointer;
      border-radius: 6px;
      font-size: 12.5px;
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
      font-size: 11px;
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
      gap: 6px;
      align-items: center;
    }
    .pdftag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--hp-line);
      border-radius: 6px;
      padding: 3px 6px;
      font-size: 12px;
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
    .inforow {
      display: flex;
      gap: 10px;
      font-size: 13px;
      margin: 3px 0;
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
      font-size: 13px;
      white-space: pre-wrap;
      margin-top: 6px;
    }
    .infodesc.muted {
      color: var(--hp-muted);
    }
    .pdflist {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pdf {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--hp-accent);
      text-decoration: none;
    }
    ha-icon-picker {
      display: block;
    }
    .floorrow {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 4px;
      font-size: 13.5px;
      cursor: pointer;
    }
    .floorrow .floorlvl {
      color: var(--hp-muted);
      font-size: 11px;
      border: 1px solid var(--hp-line);
      border-radius: 5px;
      padding: 0 5px;
    }
    .importprog {
      margin-left: auto;
      color: var(--hp-muted);
      font-size: 12px;
      font-weight: 400;
    }
    .rhint {
      font-size: 12px;
      color: var(--hp-muted);
      margin-bottom: 6px;
    }
    .rtest {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .rtest .namein { flex: 1; }
    .rtest ha-icon { color: var(--hp-accent); }
    .rtesticon { font-size: 11px; color: var(--hp-muted); }
    .rrow {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 2px 0;
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

    .dialogwrap {
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 90;
    }
    .dialog {
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid var(--hp-accent);
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
      width: min(360px, 92vw);
      overflow: hidden;
    }
    .dialog .hd {
      padding: 12px 16px;
      font-weight: 600;
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dialog .hd ha-icon {
      color: var(--hp-accent);
    }
    .dialog .body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dialog .body label {
      font-size: 12px;
      color: var(--hp-muted);
      margin-top: 6px;
    }
    .dialog .body .namein,
    .dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    .dialog .row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--hp-line);
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
      border-radius: 6px;
      padding: 5px 7px;
      font-size: 13px;
    }
    .editbar label,
    .editbar .hint {
      color: var(--hp-muted);
      font-size: 12px;
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
      border-radius: 10px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
      min-width: 210px;
      max-width: 300px;
      overflow: hidden;
      transform: translate(0, 8px);
    }
    .menu .hd {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 12.5px;
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .menu .hd ha-icon,
    .menu .it.all ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 16px;
    }
    .menu .it {
      padding: 8px 12px;
      font-size: 12.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
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
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12.5px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
      z-index: 99;
      max-width: 260px;
    }
    .tip .m {
      color: var(--hp-muted);
      font-size: 11px;
      display: block;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
      z-index: 120;
      max-width: 90vw;
    }
  `,se=1e3;function oe(t){return t&&Array.isArray(t.spaces)?t.spaces.map(t=>{const e=se/t.aspect;return{id:t.id,title:t.title,vb:[t.view_box[0]*se,t.view_box[1]*e,t.view_box[2]*se,t.view_box[3]*e],bg:t.plan_url?{href:t.plan_url,x:0,y:0,w:se,h:e}:null,rooms:(t.rooms||[]).map(t=>({id:t.id,name:t.name,area:t.area??null,x:null!=t.x?t.x*se:void 0,y:null!=t.y?t.y*e:void 0,w:null!=t.w?t.w*se:void 0,h:null!=t.h?t.h*e:void 0,poly:t.poly?t.poly.map(t=>[t[0]*se,t[1]*e]):void 0}))}}):[]}function ae(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}function re(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}function ne(t){const e=oe(t.cfg),i=e.find(e=>e.id===t.spaceId);if(!i)return null;const s=i.vb,o=It(t.cfg.spaces.find(e=>e.id===t.spaceId)),a=t.iconSize??2.5,r=a>8?2.5:a,n={};for(const e of t.cfg.spaces||[])for(const t of e.rooms||[])t.area&&(n[t.area]=e.id);const l=t.cfg.settings?.exclude_integrations?new Set(t.cfg.settings.exclude_integrations):ht,c=pt(t.cfg.settings?.icon_rules?.length?t.cfg.settings.icon_rules:dt),h=Kt({hass:t.hass,areaToSpace:n,markers:t.cfg.markers||[],settings:t.cfg.settings||{},excluded:l,showAll:!!t.cfg.settings?.show_all,firstSpaceId:e[0]?.id||"",loc:e=>te(t.lang,e),iconRules:c}),d=h.filter(e=>e.space===t.spaceId),p=function(t,e,i){const s={},o=i/100*se*1.3;for(const i of e.rooms){if(!i.area)continue;const e=t.filter(t=>t.area===i.area);if(!e.length)continue;const a=ae(i),r=.1*Math.min(a.w,a.h),n=a.w-2*r,l=a.h-2*r,c=Math.max(1,Math.round(Math.sqrt(e.length*n/Math.max(l,1)))),h=n/c,d=l/Math.max(Math.ceil(e.length/c),1),p=e.map((t,e)=>({x:a.x+r+h*(e%c+.5),y:a.y+r+d*(Math.floor(e/c)+.5)}));Pt(p,a,o,.5*r),e.forEach((t,e)=>s[t.id]=p[e])}return s}(d,i,r),u=i.rooms.filter(t=>t.area||o.showBorders).map(e=>{let s="room "+(i.bg?"overlay":"yard"),a="";if(o.showBorders||"none"!==o.fill){s+=" styled";const i=[`--room-stroke:${o.color}`,`--room-stroke-op:${o.showBorders?o.opacity:0}`],r=e.area?qt(o.fill,"lqi"===o.fill?function(t,e,i){const s=[];for(const o of e){if(o.area!==i||o.virtual)continue;const e=Ft(t,o.entities);null!=e&&s.push(e)}return Dt(s)}(t.hass,d,e.area):null,"light"===o.fill?Yt(t.hass,d,e.area):"none","temp"===o.fill?Jt(t.hass,d,e.area):null,o.tempMin,o.tempMax):null;r?(s+=" filled",i.push(`--room-fill:${r}`,`--room-fill-op:${(.3*o.opacity).toFixed(3)}`)):i.push("--room-fill:transparent","--room-fill-op:0"),a=i.join(";")}const r=!i.bg&&!o.showNames,n=re(e),l=e.poly?B`<polygon class="${s}" style="${a}" points="${e.poly.map(t=>t.join(",")).join(" ")}"></polygon>`:B`<rect class="${s}" style="${a}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${.03*Math.min(e.w,e.h)}"></rect>`;return B`${l}${r?B`<text class="rlabel" x="${n[0]}" y="${n[1]}">${e.name}</text>`:V}`}),_=d.map(e=>{const o=function(t,e,i,s,o){const a=e[t.id];if(a&&a.s===t.space){const e=i.spaces.find(e=>e.id===t.space)?.aspect||1;return{x:a.x*se,y:a.y*(se/e)}}if(s[t.id])return s[t.id];const r=o.vb;return{x:r[0]+r[2]/2,y:r[1]+r[3]/2}}(e,t.layout,t.cfg,p,i),a=(o.x-s[0])/s[2]*100,r=(o.y-s[1])/s[3]*100;return j`<div class="dev ${e.virtual?"virtual":""}" style="left:${a}%;top:${r}%">
      <ha-icon icon="${e.icon}"></ha-icon>
    </div>`}),m=o.showNames?i.rooms.filter(t=>t.name).map(e=>{const a=function(t,e,i,s){const o=i["rl_"+(t.id||"")];if(o&&o.s===e){const t=s.spaces.find(t=>t.id===e)?.aspect||1;return{x:o.x*se,y:o.y*(se/t)}}const a=re(t);return{x:a[0],y:a[1]}}(e,i.id,t.layout,t.cfg),r=(a.x-s[0])/s[2]*100,n=(a.y-s[1])/s[3]*100,l=Math.min(1,o.opacity+.25);return j`<div class="roomlabel" style="left:${r}%;top:${n}%;color:${o.color};opacity:${l}">${e.name}</div>`}):[];return j`
    <div class="hp-static-stage" style="aspect-ratio:${s[2]}/${s[3]}">
      <svg viewBox="${s[0]} ${s[1]} ${s[2]} ${s[3]}" preserveAspectRatio="xMidYMid meet">
        ${i.bg?B`<image href="${i.bg.href}" x="${i.bg.x}" y="${i.bg.y}" width="${i.bg.w}" height="${i.bg.h}" preserveAspectRatio="none" />`:V}
        ${u}
      </svg>
      <div class="devlayer" style="--icon-size:${r}cqw">${_}${m}</div>
    </div>
  `}let le=null,ce=null,he=!1;const de=new Set;function pe(){if(le)return le;try{const t=JSON.parse(localStorage.getItem("houseplan_card_cfg_v1")||"null");if(t&&t.config&&Array.isArray(t.config.spaces))return{config:t.config,rev:t.rev||0,layout:t.layout||{}}}catch{}return null}function ue(t){return le?Promise.resolve(le):ce||(ce=async function(t){const[e,i]=await Promise.all([t.callWS({type:"houseplan/config/get"}),t.callWS({type:"houseplan/layout/get"})]);if(le={config:e?.config??null,rev:e?.rev??0,layout:i?.layout??{}},!he&&t.connection?.subscribeEvents){he=!0;try{await t.connection.subscribeEvents(()=>{le=null,de.forEach(t=>t())},"houseplan_config_updated")}catch{he=!1}}return le}(t).finally(()=>{ce=null}),ce)}class _e extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return Qt(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[];return[t.length?{name:"space",selector:{select:{mode:"dropdown",options:t}}}:{name:"space",selector:{text:{}}},{name:"title",selector:{text:{}}},{name:"show_button",selector:{boolean:{}}},{name:"button_label",selector:{text:{}}},{name:"button_target",selector:{text:{}}},{name:"aspect_ratio",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}}]}render(){if(!this.hass||!this._config)return V;this._loadSpaces();const t=this._lang,e={space:te(t,"editor.space"),title:te(t,"editor.title"),show_button:te(t,"editor.show_button"),button_label:te(t,"editor.button_label"),button_target:te(t,"editor.button_target"),aspect_ratio:te(t,"editor.aspect_ratio"),icon_size:te(t,"editor.icon_size")};return j`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}_e.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-space-card-editor")||customElements.define("houseplan-space-card-editor",_e);const me=t=>{history.pushState(null,"",t),((t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)})(window,"location-changed",{replace:!1})};class ge extends lt{constructor(){super(...arguments),this._snap=null,this._loading=!1,this._loadedOnce=!1,this._goToSpace=()=>{const t=(this._config?.button_target||"/plan-doma").replace(/#.*$/,"");me(`${t}#space=${encodeURIComponent(this._config.space)}`)}}static getConfigElement(){return document.createElement("houseplan-space-card-editor")}static getStubConfig(t){const e=pe();return{type:"custom:houseplan-space-card",space:oe(e?.config||null)[0]?.id||"",show_button:!0}}setConfig(t){if(!t||!t.space)throw new Error('houseplan-space-card: "space" is required');this._config={show_button:!0,button_target:"/plan-doma",...t},this._snap=this._snap||pe()}connectedCallback(){var t;super.connectedCallback(),this._unsub=(t=()=>{this._loading=!1,this._snap=null,this.requestUpdate()},de.add(t),()=>de.delete(t))}disconnectedCallback(){this._unsub?.(),this._unsub=void 0,super.disconnectedCallback()}willUpdate(t){!this.hass||this._loading||this._snap&&!t.has("hass")||this._snap&&this._loadedOnce||this._load()}async _load(){if(this.hass&&!this._loading){this._loading=!0;try{const t=await ue(this.hass);this._snap=t,this._loadedOnce=!0}catch{}finally{this._loading=!1,this.requestUpdate()}}}get _lang(){return Qt(this.hass,this._config?.language)}getCardSize(){const t=oe(this._snap?.config||null).find(t=>t.id===this._config?.space);if(t){const e=t.vb[3]/t.vb[2];return Math.max(3,Math.round(8*e))+(!1===this._config?.show_button?0:1)}return 6}_errorCard(t){return j`<ha-card><div class="hp-static-error">${t}</div></ha-card>`}render(){if(!this._config)return V;const t=this._snap?.config;if(!t)return j`<ha-card><div class="hp-static-error">${te(this._lang,"space_card.loading")}</div></ha-card>`;const e=this._config.space,i=ne({hass:this.hass,cfg:t,layout:this._snap?.layout||{},spaceId:e,iconSize:this._config.icon_size,lang:this._lang});if(!i)return this._errorCard(te(this._lang,"space_card.not_found",{id:e}));const s=oe(t).find(t=>t.id===e),o=void 0!==this._config.title?this._config.title:s?.title||"",a=!1!==this._config.show_button,r=this._config.button_label||te(this._lang,"space_card.button");return j`
      <ha-card>
        ${o?j`<div class="hp-static-title">${o}</div>`:V}
        ${i}
        ${a?j`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${r}</button>
            </div>`:V}
      </ha-card>
    `}}ge.properties={hass:{attribute:!1},_config:{state:!0},_snap:{state:!0}},ge.styles=[ie,a`
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
    `],customElements.get("houseplan-space-card")||customElements.define("houseplan-space-card",ge),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-space-card"===t.type)||window.customCards.push({type:"houseplan-space-card",name:"House Plan — Space (static)",description:"Read-only static schematic of a single houseplan space, with a deep-link button.",preview:!1,documentation:"https://github.com/Matysh/houseplan-card"});const fe="houseplan_card_layout_v1",ve="houseplan_card_cfg_v1",be="houseplan_card_zoom_v1",ye=1e3,we=(t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)},$e=(t,e)=>{let i;return(...s)=>{clearTimeout(i),i=window.setTimeout(()=>t(...s),e)}};class xe extends lt{constructor(){super(...arguments),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._unsubCfg=null,this._devices=[],this._regSignature="",this._defPos={},this._tip=null,this._selId=null,this._toast="",this._markup=!1,this._tool="draw",this._path=[],this._cursorPt=null,this._areaSel="",this._nameSel="",this._roomDialog=!1,this._zoom=1,this._view=null,this._zoomBySpace={},this._pointers=new Map,this._panStart=null,this._pinchStart=null,this._suppressClick=!1,this._onboardingShown=!1,this._rulesDialog=null,this._importDialog=null,this._importQueue=[],this._importTotal=0,this._rulesCompiledSrc="",this._infoCard=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=t=>this._onKey(t),this._hashApplied=!1,this._onHashChange=()=>{const t=this._hashSpace();t&&this._model.find(e=>e.id===t)&&t!==this._space&&(this._space=t,this._selId=null,this._restoreZoom(),this.requestUpdate())},this._drag=null,this._holdFired=!1,this._dirtyPos=new Set,this._persistLayout=$e(()=>{if(this._serverStorage){const t=[...this._dirtyPos];this._dirtyPos.clear();for(const e of t){const t=this._layout[e];t&&this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t}).catch(t=>this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)})))}this._cacheSnapshot()}else localStorage.setItem(fe,JSON.stringify(this._layout))},600),this._saveConfig=$e(()=>{this._serverCfg&&(this._dropLegacySegments(),this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev}).then(t=>{this._cfgRev=t?.rev??this._cfgRev+1}).catch(t=>{"conflict"===t?.code?(this._showToast(this._t("toast.conflict")),this._cancelPath(),this._reloadConfigOnly()):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(t)}))}))},500),this._openRulesDialog=()=>{if(!this._norm)return;const t=this._settings.icon_rules,e=(t&&t.length?t:dt).map(t=>({...t}));this._rulesDialog={rules:e,test:"",busy:!1}}}_hashSpace(){const t=/(?:^|[#&])space=([^&]+)/.exec(window.location.hash||"");return t?decodeURIComponent(t[1]):""}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this._keyHandler),window.addEventListener("hashchange",this._onHashChange)}disconnectedCallback(){window.removeEventListener("keydown",this._keyHandler),window.removeEventListener("hashchange",this._onHashChange),clearTimeout(this._holdTimer),this._roViewport?.disconnect(),this._roViewport=void 0,this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),super.disconnectedCallback()}_onKey(t){if("Escape"===t.key){if(this._infoCard)return void(this._infoCard=null);if(this._markerDialog)return void(this._markerDialog=null)}if(!this._markup)return;return"Escape"===t.key||(t.ctrlKey||t.metaKey)&&"z"===t.key.toLowerCase()?this._roomDialog?(t.preventDefault(),void this._roomDialogCancel()):void("draw"===this._tool&&this._path.length&&(t.preventDefault(),this._undoPoint())):void 0}_undoPoint(){this._path.length&&(this._path=this._path.slice(0,-1))}static getConfigElement(){return document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card"}}setConfig(t){this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...t},t.default_floor&&(this._space=t.default_floor);try{this._zoomBySpace=JSON.parse(localStorage.getItem(be)||"{}")||{}}catch{this._zoomBySpace={}}try{const e=JSON.parse(localStorage.getItem(ve)||"null");if(e&&e.config&&Array.isArray(e.config.spaces)){this._serverCfg=e.config,this._cfgRev=e.rev||0,this._layout=e.layout||{},this._serverStorage=!0;const i=this._hashSpace();i&&this._model.find(t=>t.id===i)?(this._space=i,this._hashApplied=!0):t.default_floor?this._space=t.default_floor:this._model.find(t=>t.id===this._space)||(this._space=this._model[0]?.id||this._space)}}catch{}}_cacheSnapshot(){if(this._serverCfg)try{localStorage.setItem(ve,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,layout:this._layout}))}catch{}}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}get _model(){return this._serverCfg?this._serverCfg.spaces.map(t=>{const e=ye/t.aspect;return{id:t.id,title:t.title,vb:[t.view_box[0]*ye,t.view_box[1]*e,t.view_box[2]*ye,t.view_box[3]*e],bg:t.plan_url?{href:t.plan_url,x:0,y:0,w:ye,h:e}:null,rooms:t.rooms.map(t=>({id:t.id,name:t.name,area:t.area??null,x:null!=t.x?t.x*ye:void 0,y:null!=t.y?t.y*e:void 0,w:null!=t.w?t.w*ye:void 0,h:null!=t.h?t.h*e:void 0,poly:t.poly?t.poly.map(t=>[t[0]*ye,t[1]*e]):void 0}))}}):[]}_spaceModel(t){const e=this._model;return e.find(e=>e.id===(t??this._space))||e[0]}get _areaToSpace(){const t={};for(const e of this._model)for(const i of e.rooms)i.area&&(t[i.area]={space:e.id,room:i});return t}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return!!this._settings.show_all}_toggleShowAll(){this._serverCfg&&(this._serverCfg={...this._serverCfg,settings:{...this._serverCfg.settings,show_all:!this._showAll}},this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate())}get _iconRules(){const t=this._settings.icon_rules;if(!t||!Array.isArray(t)||!t.length)return;const e=JSON.stringify(t);return e!==this._rulesCompiledSrc&&(this._rulesCompiledSrc=e,this._rulesCompiled=pt(t)),this._rulesCompiled}get _excluded(){const t=this._settings.exclude_integrations;return t?new Set(t):ht}willUpdate(t){t.has("hass")&&this.hass&&(!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices())}updated(){const t=this._stageEl;if(t&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(t)),t&&!this._view&&this._refitView(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._importDialog&&!this._onboardingShown){this._onboardingShown=!0;const t=function(t){const e=t?.floors;if(!e||"object"!=typeof e)return[];const i=[];for(const t of Object.values(e))t&&t.floor_id&&i.push({id:t.floor_id,name:t.name||t.floor_id,level:t.level??null});return i.sort((t,e)=>{const i=t.level??1e9,s=e.level??1e9;return i!==s?i-s:t.name.localeCompare(e.name)}),i}(this.hass);t.length?this._importDialog={floors:t.map(t=>({...t,checked:!0}))}:this._openSpaceDialog("create")}}async _loadFromServer(){this._loading=!0,this._loadTries++;try{const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._loadOk=!0,this._serverStorage=!0;const i=t?.config;this._serverCfg=i&&Array.isArray(i.spaces)?i:null,this._cfgRev=t?.rev||0,this._layout=e?.layout||{},this._unsubCfg||(this._unsubCfg=await this.hass.connection.subscribeEvents(t=>{(t?.data?.rev??-1)!==this._cfgRev&&this._reloadConfigOnly()},"houseplan_config_updated"));const s=this._hashSpace();!this._hashApplied&&s&&this._model.find(t=>t.id===s)?(this._space=s,this._hashApplied=!0):this._norm&&!this._model.find(t=>t.id===this._space)&&(this._space=this._model[0]?.id||this._space),this._cacheSnapshot(),this._restoreZoom()}catch(t){if(this._loadTries>=8){this._serverStorage=!1,this._serverCfg=null;try{this._layout=JSON.parse(localStorage.getItem(fe)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1}this._regSignature="",this.requestUpdate()}async _reloadConfigOnly(){try{const t=await this.hass.callWS({type:"houseplan/config/get"}),e=t?.config;this._serverCfg=e&&Array.isArray(e.spaces)?e:null,this._cfgRev=t?.rev||0,this._cacheSnapshot(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch{}}_maybeRebuildDevices(){const t=this.hass;if(!t?.devices||!t?.entities||!t?.areas)return;const e=Object.keys(t.devices).length+":"+Object.keys(t.entities).length+":"+Object.keys(t.areas).length+":"+(this._norm?"n":"l")+":"+Qt(t,this._config?.language);e===this._regSignature&&this._devices.length||(this._regSignature=e,this._devices=Kt({hass:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||"",loc:t=>this._t(t),iconRules:this._iconRules}),this._defPos=this._defaultPositions())}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(t){if(!t)return null;const e=[];for(const i of this._devices){if(i.area!==t||i.virtual)continue;const s=Ft(this.hass,i.entities);null!=s&&e.push(s)}return Dt(e)}_roomBounds(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}_defaultPositions(){const t={},e=(this._config?.icon_size??2.5)/100*ye*1.3;for(const i of this._model)for(const s of i.rooms){if(!s.area)continue;const o=this._devices.filter(t=>t.area===s.area&&t.space===i.id);if(!o.length)continue;const a=this._roomBounds(s),r=.1*Math.min(a.w,a.h),n=a.w-2*r,l=a.h-2*r,c=Math.max(1,Math.round(Math.sqrt(o.length*n/Math.max(l,1)))),h=Math.ceil(o.length/c),d=n/c,p=l/Math.max(h,1),u=o.map((t,e)=>({x:a.x+r+d*(e%c+.5),y:a.y+r+p*(Math.floor(e/c)+.5)}));Pt(u,a,e,.5*r),o.forEach((e,i)=>t[e.id]=u[i])}return t}_pos(t){const e=this._spaceModel(t.space),i=this._layout[t.id];if(i)if(this._norm){if(i.s===t.space){const e=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;return{x:i.x*ye,y:i.y*(ye/e)}}}else if(void 0===i.s)return{x:i.x,y:i.y};if(this._defPos[t.id])return this._defPos[t.id];const s=e.vb;return{x:s[0]+s[2]/2,y:s[1]+s[3]/2}}_savePos(t,e,i){if(this._norm){const s=this._gridPitch,o=Math.round(e/s)*s,a=Math.round(i/s)*s,r=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;this._layout={...this._layout,[t.id]:{s:t.space,x:o/ye,y:a/(ye/r)}}}else this._layout={...this._layout,[t.id]:{x:Math.round(e),y:Math.round(i)}};this._dirtyPos.add(t.id),this._persistLayout()}_stateClass(t){if(!this._config?.live_states)return"";const e=t.primary?this.hass.states[t.primary]:void 0;if(!e)return"";if("unavailable"===e.state)return"unavail";const i=t.primary.split(".")[0];if(["light","switch","fan","humidifier"].includes(i))return"on"===e.state?"on":"";if("cover"===i||"valve"===i)return["open","opening"].includes(e.state)?"open":"";if("lock"===i)return["unlocked","open"].includes(e.state)?"open":"";if("binary_sensor"===i){const t=e.attributes?.device_class;if(["door","window","garage_door","opening","gas","smoke","moisture","problem"].includes(t))return"on"===e.state?"open":""}return"media_player"===i?["playing","on"].includes(e.state)?"on":"":"vacuum"===i&&["cleaning","returning"].includes(e.state)?"on":""}_liveTemp(t){return this._config?.show_temperature?"mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon?null:jt(this.hass,t.entities):null}_liveHum(t){return this._config?.show_temperature&&t.primary&&Bt(this.hass,t.primary)?Wt(this.hass,t.entities):null}_openMoreInfo(t){t?we(this,"hass-more-info",{entityId:t}):this._showToast(this._t("toast.no_entity"))}_clickDevice(t,e){if(t.stopPropagation(),this._drag?.moved||this._suppressClick||this._holdFired)return;if(this._markup)return;const i=e.primary?e.primary.split(".")[0]:null,s=function(t,e,i){const s=t||e||"info";return"more-info"===s?"more-info":"toggle"!==s||!i||Rt.has(i)?"info":"toggle"===t||Tt.has(i)?"toggle":"info"}(e.tapAction,this._config?.tap_action,i);"toggle"===s&&e.primary?this.hass.callService("homeassistant","toggle",{entity_id:e.primary}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)}))):"more-info"===s&&e.primary?this._openMoreInfo(e.primary):this._infoCard=e}_t(t,e){return te(Qt(this.hass,this._config?.language),t,e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_stageAspect(){const t=this._stageEl,e=this._spaceModel().vb;return t&&t.clientHeight?t.clientWidth/t.clientHeight:e[2]/e[3]}_viewOr(t){return this._view&&this._view.w?this._view:zt(t,this._stageAspect())}_screenToVb(t,e){const i=this._stageEl,s=this._viewOr(this._spaceModel().vb),o=i?.clientWidth||1,a=i?.clientHeight||1;return[s.x+t/o*s.w,s.y+e/a*s.h]}_clampView(t,e){return{w:t.w,h:t.h,x:Math.max(e.x,Math.min(e.x+e.w-t.w,t.x)),y:Math.max(e.y,Math.min(e.y+e.h-t.h,t.y))}}_applyView(t,e,i){const s=this._spaceModel().vb,o=zt(s,this._stageAspect()),a=Math.min(8,Math.max(1,t)),r=o.w/a,n=o.h/a,l=this._viewOr(s),c=e??l.x+l.w/2,h=i??l.y+l.h/2;this._zoom=a,this._view=this._clampView({x:c-r/2,y:h-n/2,w:r,h:n},o)}_refitView(){if(!this._stageEl)return;const t=this._view;this._applyView(this._zoom,t?t.x+t.w/2:void 0,t?t.y+t.h/2:void 0),this.requestUpdate()}_zoomAt(t,e,i){const s=this._stageEl;if(!s)return;const o=zt(this._spaceModel().vb,this._stageAspect()),a=Math.min(8,Math.max(1,i)),r=s.clientWidth,n=s.clientHeight,l=this._screenToVb(t,e),c=o.w/a,h=o.h/a;this._zoom=a,this._view=this._clampView({x:l[0]-t/r*c,y:l[1]-e/n*h,w:c,h:h},o)}_onWheel(t){const e=this._stageEl;if(!e)return;t.preventDefault();const i=e.getBoundingClientRect(),s=t.deltaY<0?1.15:1/1.15;this._zoomAt(t.clientX-i.left,t.clientY-i.top,this._zoom*s),this._saveZoom()}_stepZoom(t){const e=this._stageEl;e&&(this._zoomAt(e.clientWidth/2,e.clientHeight/2,this._zoom*(t>0?1.4:1/1.4)),this._saveZoom())}_resetZoom(){const t=this._spaceModel().vb;this._zoom=1,this._view=zt(t,this._stageAspect()),this._saveZoom()}_saveZoom(){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(be,JSON.stringify(this._zoomBySpace))}catch{}}_restoreZoom(){const t=this._zoomBySpace[this._space]||1;this._zoom=t,this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const e=this._spaceModel().vb;this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),this.requestUpdate()})}_stagePointerDown(t){if(this._drag||this._markup)return;if(t.target.closest(".dev"))return;this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=this._viewOr(this._spaceModel().vb);if(1===this._pointers.size)this._panStart={sx:t.clientX,sy:t.clientY,vx:e.x,vy:e.y},this._suppressClick=!1;else if(2===this._pointers.size){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y);this._pinchStart={dist:e,zoom:this._zoom},this._panStart=null}}_stagePointerMove(t){if(this._pointers.has(t.pointerId)){if(this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this._pinchStart&&this._pointers.size>=2){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),s=(t[0].x+t[1].x)/2-i.left,o=(t[0].y+t[1].y)/2-i.top;this._zoomAt(s,o,this._pinchStart.zoom*e),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const e=t.clientX-this._panStart.sx,i=t.clientY-this._panStart.sy;if(Math.abs(e)+Math.abs(i)>4&&(this._suppressClick=!0),this._zoom>1&&this._view){const t=this._stageEl,s=this._view,o=zt(this._spaceModel().vb,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-e/t.clientWidth*s.w,y:this._panStart.vy-i/t.clientHeight*s.h,w:s.w,h:s.h},o)}}}else this._markupMove(t)}_stagePointerUp(t){this._pointers.delete(t.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,setTimeout(()=>this._suppressClick=!1,0))}_clickRoom(t){var e;!this._suppressClick&&t.area&&(e="/config/areas/area/"+t.area,history.pushState(null,"",e),we(window,"location-changed",{replace:!1}))}_pointerDown(t,e){if(this._markup)return;t.preventDefault();const i=this._pos(e);this._drag={id:e.id,sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},t.target.setPointerCapture(t.pointerId),this._tip=null,this._holdFired=!1,clearTimeout(this._holdTimer),this._holdTimer=window.setTimeout(()=>{this._drag&&this._drag.id===e.id&&!this._drag.moved&&(this._holdFired=!0,this._drag=null,this._infoCard=e)},600)}_pointerMove(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const s=this._spaceModel().vb,o=i.getBoundingClientRect(),a=this._viewOr(s),r=(t.clientX-this._drag.sx)/o.width*a.w,n=(t.clientY-this._drag.sy)/o.height*a.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0,clearTimeout(this._holdTimer));const l=.008*Math.min(s[2],s[3]),c=Math.max(s[0]+l,Math.min(s[0]+s[2]-l,this._drag.ox+r)),h=Math.max(s[1]+l,Math.min(s[1]+s[3]-l,this._drag.oy+n));this._savePos(e,c,h)}_pointerUp(t,e){if(clearTimeout(this._holdTimer),!this._drag||this._drag.id!==e.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=e.id,window.setTimeout(()=>this._drag=null,0))}_resetLayout(){confirm(this._t("confirm.reset_layout"))&&(this._layout={},this._persistLayout())}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}_showTip(t,e,i,s,o){this._drag||(this._tip={x:t.clientX,y:t.clientY,title:e,meta:i,lqi:s,temp:o})}get _gridPitch(){return ye/240}get _cellCm(){const t=Number(this._curSpaceCfg?.cell_cm);return Number.isFinite(t)&&t>0?t:5}_fmtLen(t,e){const i=function(t,e,i,s){return Math.hypot(e[0]-t[0],e[1]-t[1])/i*s}(t,e,this._gridPitch,this._cellCm);return function(t,e){if(e){const e=t/2.54;let i=Math.floor(e/12),s=Math.round(e-12*i);return 12===s&&(i+=1,s=0),`${i}′ ${s}″`}return`${(t/100).toFixed(2)} m`}(i,"mi"===this.hass?.config?.unit_system?.length)}get _curSpaceCfg(){return this._serverCfg?.spaces.find(t=>t.id===this._space)}get _spaceH(){const t=this._curSpaceCfg;return t?ye/t.aspect:ye}get _segments(){const t=this._curSpaceCfg,e=this._spaceH;return function(t){const e=[],i=new Set;for(const s of t||[]){const t=wt(s);if(t)for(let s=0;s<t.length;s++){const o=t[s],a=t[(s+1)%t.length],r=yt(o,a,5);i.has(r)||(i.add(r),e.push([o[0],o[1],a[0],a[1]]))}}return e}(t?.rooms||[]).map(t=>[t[0]*ye,t[1]*e,t[2]*ye,t[3]*e])}_toggleMarkup(){this._norm?(this._markup=!this._markup,this._path=[],this._cursorPt=null,this._tool="draw"):this._showToast(this._t("toast.markup_needs_server"))}_svgPoint(t){const e=this.renderRoot.querySelector(".stage").getBoundingClientRect();return this._screenToVb(t.clientX-e.left,t.clientY-e.top)}_snap(t){const e=this._gridPitch;return[bt(t[0],e),bt(t[1],e)]}_samePt(t,e){return function(t,e,i=.001){return Math.abs(t[0]-e[0])<i&&Math.abs(t[1]-e[1])<i}(t,e)}_dropLegacySegments(){for(const t of this._serverCfg?.spaces||[])delete t.segments}_roomAt(t){return this._spaceModel().rooms.find(e=>{const i=wt(e);return!!i&&St(t,i)})}_overlapRoom(t){return this._spaceModel().rooms.find(e=>{const i=wt(e);return!!i&&function(t,e,i=1e-6){if(!t||!e||t.length<3||e.length<3)return!1;for(let i=0;i<t.length;i++)for(let s=0;s<e.length;s++)if(At(t[i],t[(i+1)%t.length],e[s],e[(s+1)%e.length]))return!0;return Mt(t,e,i)||Mt(e,t,i)}(t,i)})}_pointInRoom(t,e){return e.poly?$t(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_markupClick(t){if(!this._markup)return;const e=this._svgPoint(t);if("delroom"===this._tool){const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(e,t));if(!t)return;if(!confirm(this._t("confirm.delete_room",{name:t.name})))return;const i=this._curSpaceCfg;return i.rooms=i.rooms.filter(e=>e.id!==t.id),this._saveConfig(),this._regSignature="",this._maybeRebuildDevices(),void this.requestUpdate()}const i=this._snap(e),s=this._path.length>=3&&this._samePt(i,this._path[0]);if(!s){const t=this._roomAt(i);if(t)return void this._showToast(this._t("toast.point_in_room",{name:t.name||""}))}if(!this._path.length)return void(this._path=[i]);const o=this._path[this._path.length-1];if(!this._samePt(i,o)){if(s){const t=this._overlapRoom(this._path);return t?void this._showToast(this._t("toast.room_overlap",{name:t.name||""})):(this._path=[...this._path,i],this._cursorPt=null,this._nameSel="",this._areaSel="",void(this._roomDialog=!0))}this._path=[...this._path,i]}}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])}_markupMove(t){this._markup&&"draw"===this._tool&&this._path.length&&!this._contourClosed&&(this._cursorPt=this._snap(this._svgPoint(t)))}_saveRoom(){this._areaSel&&this._commitRoom()}_saveRoomNoArea(){this._nameSel.trim()&&(this._areaSel="",this._commitRoom())}_commitRoom(){if(!this._contourClosed)return;const t=this._curSpaceCfg;if(!t)return;const e=this._spaceH,i=this._path.slice(0,-1),s=this._areaSel?this.hass.areas[this._areaSel]?.name:"";t.rooms.push({id:"r"+Date.now().toString(36),name:this._nameSel||s||this._t("room.default_name"),area:this._areaSel||null,poly:i.map(t=>[t[0]/ye,t[1]/e])}),this._saveConfig(),this._path=[];const o=this._areaSel;this._areaSel="",this._nameSel="",this._roomDialog=!1,this._regSignature="",this._maybeRebuildDevices();let a=0;if(o){const t=this._serverCfg?.spaces.find(t=>t.id===this._space)?.aspect||1,e=ye/t,i={...this._layout};for(const t of this._devices){if(t.area!==o||t.space!==this._space)continue;if(a++,this._layout[t.id])continue;const s=this._defPos[t.id];s&&(i[t.id]={s:this._space,x:s.x/ye,y:s.y/e},this._dirtyPos.add(t.id))}this._layout=i,this._persistLayout()}const r=this._model.find(t=>t.id===this._space)?.rooms.length||0;this._showToast(o?this._t("toast.room_saved",{n:r,added:a}):this._t("toast.room_saved_no_area",{n:r}))}_cancelPath(){this._path=[],this._cursorPt=null,this._roomDialog=!1}_roomDialogCancel(){this._roomDialog=!1,this._undoPoint()}get _freeAreas(){const t=new Set;for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.add(i.area);return Object.values(this.hass?.areas||{}).filter(e=>!t.has(e.area_id)).sort((t,e)=>(t.name||"").localeCompare(e.name||""))}_openMarkerDialog(t){this._norm?this._markerDialog=t?{devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingFilter:"",icon:t.marker?.icon||"",tapAction:t.marker?.tap_action||"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.space&&t.area?t.space+"#"+t.area:"",busy:!1}:{name:"",binding:"virtual",bindingFilter:"",icon:"",tapAction:"",model:"",link:"",description:"",pdfs:[],room:"",busy:!1}:this._showToast(this._t("toast.marker_needs_server"))}_bindingCandidates(){const t=this.hass,e=new Set;for(const t of this._devices)t.id!==this._markerDialog?.devId&&("device"===t.bindingKind&&t.bindingRef&&e.add("device:"+t.bindingRef),"entity"===t.bindingKind&&t.bindingRef&&e.add("entity:"+t.bindingRef));const i=new Set;for(const t of this._devices)"device"===t.bindingKind&&t.name&&i.add(t.name.trim()+"|"+(t.area||""));const s=[];for(const o of Object.values(t.devices)){if("service"===o.entry_type)continue;const t="device:"+o.id;if(e.has(t))continue;const a=(o.name_by_user||o.name||o.id).trim();t!==this._markerDialog?.binding&&i.has(a+"|"+(o.area_id||""))||s.push({value:t,label:a,sub:(o.model||this._t("marker.sub_device"))+("Group"===o.model?this._t("marker.sub_z2m_group"):"")})}const o=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);for(const[i,a]of Object.entries(t.entities)){const r="entity:"+i;if(e.has(r))continue;const n=o.has(a.platform),l="group"===a.platform;if(!n&&!l)continue;if(a.hidden)continue;const c=t.states[i];s.push({value:r,label:a.name||c?.attributes?.friendly_name||i,sub:i.split(".")[0]+" · "+("group"===a.platform?this._t("marker.sub_group"):this._t("marker.sub_helper"))})}const a=(this._markerDialog?.bindingFilter||"").toLowerCase().trim();if(a){const i=new Set(s.map(t=>t.value));for(const[o,r]of Object.entries(t.entities)){const n="entity:"+o;if(e.has(n)||i.has(n)||r.hidden)continue;const l=t.states[o],c=r.name||l?.attributes?.friendly_name||o,h=r.device_id?t.devices[r.device_id]:null,d=h&&(h.name_by_user||h.name)||"";(c+" "+o+" "+d).toLowerCase().includes(a)&&s.push({value:n,label:c,sub:o.split(".")[0]+" · "+this._t("marker.sub_entity")+(d?" · "+d:"")})}}const r=(this._markerDialog?.bindingFilter||"").toLowerCase().trim(),n=r?s.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(r)):s;return n.sort((t,e)=>t.label.localeCompare(e.label)),n.slice(0,200)}_allRoomsFlat(){const t=[];for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.push({value:e.id+"#"+i.area,label:(e.title||e.id)+" · "+i.name});return t}_errText(t){if(!t)return this._t("err.unknown");if("string"==typeof t)return t;if(t.message)return t.message;if(t.error)return t.error;if(null!=t.code)return this._t("err.code",{code:t.code});try{return JSON.stringify(t)}catch{return String(t)}}async _pickMarkerFiles(t){const e=t.target,i=e.files?[...e.files]:[];if(e.value="",!i.length||!this._markerDialog)return;const s=this._markerDialog.devId||"new",o=[];for(const t of i)try{const e=new FormData;e.append("marker_id",s),e.append("file",t,t.name);const i=this.hass?.fetchWithAuth?await this.hass.fetchWithAuth("/api/houseplan/upload",{method:"POST",body:e}):await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:this.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.hass.auth.data.access_token}`}:{}}),a=await i.json().catch(()=>({}));if(!i.ok||a.error){const t={too_large:this._t("err.too_large",{mb:a.max_mb||25}),bad_ext:this._t("err.bad_ext"),unauthorized:this._t("err.unauthorized")};throw new Error(t[a.error]||a.error||"HTTP "+i.status)}o.push({name:a.name||t.name,url:a.url})}catch(e){this._showToast(this._t("toast.file_failed",{name:t.name,err:this._errText(e)}))}o.length&&this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:[...this._markerDialog.pdfs,...o]},this._showToast(this._t("toast.files_attached",{n:o.length})))}_removeMarkerPdf(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:this._markerDialog.pdfs.filter(e=>e.url!==t)})}async _saveMarker(){const t=this._markerDialog;if(t&&!t.busy)if("virtual"!==t.binding||t.name.trim()){this._markerDialog={...t,busy:!0};try{const e=this._serverCfg;let i;e.markers=e.markers||[];const[s,o]=t.room?t.room.split("#"):["",""];let a=s||null,r=o||null;"virtual"!==t.binding||a||(a=this._space),i=function(t,e,i){const[s,o]=t.split(":");return"device"===s?o:"entity"===s?"lg_"+o:e&&e.startsWith("v_")?e:i()}(t.binding,t.devId,()=>"v_"+Date.now().toString(36));const n=t.devId,l={id:i,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,tap_action:t.tapAction||null,model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs};("virtual"===t.binding||t.room)&&(l.space=a,l.area=r);const c=n?this._devices.find(t=>t.id===n):null,h=!!t.room&&null!=c&&(c.space!==a||c.area!==r);e.markers=e.markers.filter(t=>t.id!==i&&t.id!==n),e.markers.push(l);let d=null;if(!this._layout[i]||h){const t=this._spaceModel(a||void 0);let e=t.vb[0]+t.vb[2]/2,s=t.vb[1]+t.vb[3]/2;if(r){const i=t.rooms.find(t=>t.area===r);i&&([e,s]=this._roomCenter(i))}d=this._normPos(a||this._space,e,s),this._layout={...this._layout,[i]:d}}await this._saveConfigNow(),d&&await this.hass.callWS({type:"houseplan/layout/update",device_id:i,pos:d}),n&&n!==i&&(delete this._layout[n],await this.hass.callWS({type:"houseplan/layout/delete",device_id:n}).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_saved"))}catch(t){this._markerDialog={...this._markerDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}else this._showToast(this._t("toast.virtual_name_required"))}async _deleteMarker(){const t=this._markerDialog;if(!t)return;const e=t.devId?this._devices.find(e=>e.id===t.devId):null,i=t.name||this._t("device.fallback");if(!confirm(this._t("confirm.remove_marker",{name:i})))return;const s=this._serverCfg;s.markers=s.markers||[],e&&"virtual"===e.bindingKind?s.markers=s.markers.filter(t=>t.id!==e.id):e&&e.marker?(s.markers=s.markers.filter(t=>t.id!==e.id),"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0})):e&&"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):e&&"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0});try{await this._saveConfigNow(),e&&"virtual"===e.bindingKind&&this._layout[e.id]&&(delete this._layout[e.id],await this.hass.callWS({type:"houseplan/layout/delete",device_id:e.id}).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_removed"))}catch(t){this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_normPos(t,e,i){const s=this._serverCfg.spaces.find(e=>e.id===t)?.aspect||1;return{s:t,x:e/ye,y:i/(ye/s)}}_openSpaceDialog(t,e){if(this._serverStorage&&this._serverCfg)if("edit"===t){const i=this._serverCfg.spaces.find(t=>t.id===e);if(!i)return;const s=It(i);this._spaceDialog={mode:t,spaceId:e,title:i.title,planUrl:i.plan_url||null,planFile:null,source:i.plan_url?"file":"draw",orientation:"landscape",showBorders:s.showBorders,showNames:s.showNames,roomColor:s.color,roomOpacity:s.opacity,fillMode:s.fill,tempMin:s.tempMin,tempMax:s.tempMax,cellCm:Number(i.cell_cm)>0?Number(i.cell_cm):5,busy:!1}}else this._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,source:"file",orientation:"landscape",showBorders:!1,showNames:!1,roomColor:Ot,roomOpacity:Nt,fillMode:"none",tempMin:20,tempMax:25,cellCm:5,busy:!1};else this._showToast(this._t("toast.integration_missing"))}async _pickPlanFile(t){const e=t.target,i=e.files?.[0];if(!i||!this._spaceDialog)return;const s={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[i.type]||(i.name.toLowerCase().endsWith(".svg")?"svg":"");if(!s)return void this._showToast(this._t("toast.plan_formats"));const o=new Uint8Array(await i.arrayBuffer());let a="";for(let t=0;t<o.length;t+=32768)a+=String.fromCharCode(...o.subarray(t,t+32768));const r=btoa(a),n=URL.createObjectURL(i),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=n});URL.revokeObjectURL(n),this._spaceDialog={...this._spaceDialog,planFile:{ext:s,b64:r,aspect:l,name:i.name}}}async _saveSpaceDialog(){const t=this._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this._showToast(this._t("toast.plan_required"));const e="create"===t.mode&&0===(this._serverCfg?.spaces.length||0);this._spaceDialog={...t,busy:!0};try{const i=this._serverCfg;let s;const o="portrait"===t.orientation?.707:"square"===t.orientation?1:1.414;if("create"===t.mode?(s={id:"s"+Date.now().toString(36),title:t.title.trim(),plan_url:null,aspect:"draw"===t.source?o:1.414,view_box:[0,0,1,1],rooms:[]},i.spaces.push(s)):(s=i.spaces.find(e=>e.id===t.spaceId),s.title=t.title.trim()),"file"===t.source&&t.planFile){const e=await this.hass.callWS({type:"houseplan/plan/set",space_id:s.id,ext:t.planFile.ext,data:t.planFile.b64});s.plan_url=e.url,s.aspect=t.planFile.aspect}"draw"===t.source&&(s.plan_url=null);const a="draw"===t.source;s.settings={...s.settings||{},show_borders:!(!a||"create"!==t.mode)||t.showBorders,show_names:!(!a||"create"!==t.mode)||t.showNames,room_color:t.roomColor,room_opacity:t.roomOpacity,fill_mode:t.fillMode,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):20,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):25},s.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?t.cellCm:5,await this._saveConfigNow(),this._spaceDialog=null,"create"===t.mode&&(this._space=s.id),this._regSignature="",this._maybeRebuildDevices(),this._importQueue.length?this._openNextImport():e||this._importTotal>0?(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._markup=!0,this._tool="draw",this._path=[],this._cursorPt=null,this._showToast(this._t(e&&!this._importTotal?"toast.space_added_onboard":"import.done"))):this._showToast("create"===t.mode?this._t("toast.space_added"):this._t("toast.space_saved"))}catch(t){this._spaceDialog={...this._spaceDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}async _deleteSpace(){const t=this._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this._serverCfg.spaces.find(e=>e.id===t.spaceId);if(confirm(this._t("confirm.delete_space",{title:e.title}))){this._serverCfg.spaces=this._serverCfg.spaces.filter(e=>e.id!==t.spaceId);try{await this._saveConfigNow(),this._spaceDialog=null,this._space===t.spaceId&&(this._space=this._serverCfg.spaces[0]?.id||""),this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.space_deleted"))}catch(t){this._showToast(this._t("toast.delete_failed",{err:this._errText(t)}))}}}async _saveConfigNow(){this._dropLegacySegments();try{const t=await this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev});this._cfgRev=t?.rev??this._cfgRev+1}catch(t){throw"conflict"===t?.code&&await this._reloadConfigOnly(),t}}_startImport(){const t=this._importDialog;if(!t)return;const e=t.floors.filter(t=>t.checked).map(t=>t.name);this._importDialog=null,e.length?(this._importQueue=e,this._importTotal=e.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this._importQueue.shift();void 0!==t&&(this._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,source:"file",orientation:"landscape",showBorders:!1,showNames:!1,roomColor:Ot,roomOpacity:Nt,fillMode:"none",tempMin:20,tempMax:25,cellCm:5,busy:!1})}_skipImport(){this._spaceDialog=null,this._importQueue.length?this._openNextImport():this._importTotal>0&&this._model.length&&(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._markup=!0,this._showToast(this._t("import.done")))}_renderImportDialog(){const t=this._importDialog,e=t.floors.filter(t=>t.checked).length;return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:home-floor-1"></ha-icon>${this._t("import.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("import.hint")}</div>
          ${t.floors.map((e,i)=>j`<label class="floorrow">
              <input type="checkbox" .checked=${e.checked}
                @change=${s=>{const o=[...t.floors];o[i]={...e,checked:s.target.checked},this._importDialog={floors:o}}} />
              <span>${e.name}</span>
              ${null!=e.level?j`<span class="floorlvl">L${e.level}</span>`:V}
            </label>`)}
        </div>
        <div class="row">
          <button class="btn ghost" @click=${()=>{this._importDialog=null,this._openSpaceDialog("create")}}>
            ${this._t("import.manual")}
          </button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._startImport()} ?disabled=${!e}>
            <ha-icon icon="mdi:import"></ha-icon>${this._t("import.start",{n:e})}
          </button>
        </div>
      </div>
    </div>`}_rulesSet(t){this._rulesDialog={...this._rulesDialog,rules:t}}async _saveRules(){const t=this._rulesDialog;if(!t||t.busy)return;const e=t.rules.filter(t=>t.pattern.trim()&&t.icon.trim());this._rulesDialog={...t,busy:!0};try{const t=this._serverCfg,i=JSON.stringify(e)===JSON.stringify(dt),s={...t.settings};i?delete s.icon_rules:s.icon_rules=e,this._serverCfg={...t,settings:s},await this._saveConfigNow(),this._rulesDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("rules.saved"))}catch(t){this._rulesDialog={...this._rulesDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_renderRulesDialog(){const t=this._rulesDialog,e=pt(t.rules),i=t.test.trim()?gt(t.test,"",e):null,s=(e,i)=>{const s=[...t.rules],o=e+i;o<0||o>=s.length||([s[e],s[o]]=[s[o],s[e]],this._rulesSet(s))};return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t("rules.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("rules.hint")}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this._t("rules.test_ph")}
              .value=${t.test}
              @input=${e=>this._rulesDialog={...t,test:e.target.value}} />
            ${i?j`<ha-icon icon=${i}></ha-icon><span class="rtesticon">${i}</span>`:V}
          </div>
          ${t.rules.map((e,i)=>{const o=""!==e.pattern.trim()&&!function(t){try{return new RegExp(t,"i"),!0}catch{return!1}}(e.pattern);return j`<div class="rrow">
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
        <div class="row">
          <button class="btn ghost" @click=${()=>this._rulesSet(dt.map(t=>({...t})))}>
            ${this._t("rules.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._rulesDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveRules} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}render(){if(!this._config||!this.hass)return V;const t=this._model;if(!t.length)return j`<ha-card>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>${this._t("empty.no_spaces")}</p>
          ${this._serverStorage?j`<p class="muted">${this._t("empty.add_first")}</p>
                <button class="btn on" @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>${this._t("btn.add_space")}
                </button>`:j`<p class="muted">${this._t("empty.install")}</p>`}
        </div>
        ${this._spaceDialog?this._renderSpaceDialog():V}
        ${this._importDialog?this._renderImportDialog():V}
        ${this._toast?j`<div class="toast">${this._toast}</div>`:V}
      </ha-card>`;const e=this._spaceModel(),i=e.vb,s=this._devices.filter(t=>t.space===e.id),o=It(this._curSpaceCfg),a=this._config.icon_size??2.5,r=a>8?2.5:a,n=this._viewOr(i);return j`
      <ha-card>
        <div class="hdr">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title||this._t("card.title")}
          </div>
          <div class="tabs">
            ${t.map(t=>j`<button
                class="tab ${this._space===t.id?"active":""}"
                @click=${()=>{this._space=t.id,this._selId=null,this._restoreZoom()}}
              >
                ${t.title}${this._norm?j`<ha-icon class="tabedit" icon="mdi:pencil"
                      title=${this._t("title.configure_space")}
                      @click=${e=>{e.stopPropagation(),this._openSpaceDialog("edit",t.id)}}></ha-icon>`:V}
              </button>`)}
            ${this._norm?j`<button class="tab tabadd" title=${this._t("title.add_space")}
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`:V}
          </div>
          <span class="count">${this._t("count.devices",{n:s.length})}</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${()=>this._stepZoom(-1)} title=${this._t("title.zoom_out")}><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._resetZoom()} ?disabled=${1===this._zoom}
              title=${this._t("title.zoom_reset")}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._stepZoom(1)} title=${this._t("title.zoom_in")}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm?j`<button class="btn" @click=${()=>this._openMarkerDialog()}
                title=${this._t("title.add_device")}>
                <ha-icon icon="mdi:plus-box-outline"></ha-icon>
              </button>`:V}
          ${this._norm?j`<button class="btn ${this._showAll?"on":""}" @click=${this._toggleShowAll}
                title=${this._t("title.show_all")}>
                <ha-icon icon="${this._showAll?"mdi:eye":"mdi:eye-off-outline"}"></ha-icon>
              </button>
              <button class="btn" @click=${this._resetLayout} title=${this._t("title.reset_layout")}>
                <ha-icon icon="mdi:backup-restore"></ha-icon>
              </button>
              <button class="btn" @click=${this._openRulesDialog} title=${this._t("title.icon_rules")}>
                <ha-icon icon="mdi:shape-plus-outline"></ha-icon>
              </button>`:V}
          <button class="btn ${this._markup?"on":""}" @click=${this._toggleMarkup}
            title=${this._t("title.markup")}>
            <ha-icon icon="mdi:vector-square-edit"></ha-icon>
          </button>
        </div>
        ${this._markup?this._renderMarkupBar():V}
        </div>

        <div class="stage ${this._markup?"markup":""}"
          style="height:calc(100dvh - 118px)"
          @click=${t=>this._markupClick(t)}
          @wheel=${t=>this._onWheel(t)}
          @pointerdown=${t=>this._stagePointerDown(t)}
          @pointermove=${t=>this._stagePointerMove(t)}
          @pointerup=${t=>this._stagePointerUp(t)}
          @pointercancel=${t=>this._stagePointerUp(t)}>
          <div class="zoomwrap">
          <svg viewBox="${n.x} ${n.y} ${n.w} ${n.h}" preserveAspectRatio="xMidYMid meet">
            ${this._markup?this._renderMarkupDefs(i):V}
            ${e.bg?B`<image href="${e.bg.href}" x="${e.bg.x}" y="${e.bg.y}" width="${e.bg.w}" height="${e.bg.h}" preserveAspectRatio="none" />`:V}
            ${e.rooms.filter(t=>t.area||this._markup||o.showBorders).map(t=>{let i="room "+(e.bg?"overlay":"yard")+(this._markup?" outlined":""),s="";if(!this._markup&&(o.showBorders||"none"!==o.fill)){i+=" styled";const e=[];e.push(`--room-stroke:${o.color}`,`--room-stroke-op:${o.showBorders?o.opacity:0}`);const a=t.area?qt(o.fill,"lqi"===o.fill?this._roomLqi(t.area):null,"light"===o.fill?Yt(this.hass,this._devices,t.area):"none","temp"===o.fill?Jt(this.hass,this._devices,t.area):null,o.tempMin,o.tempMax):null;a?(i+=" filled",e.push(`--room-fill:${a}`,`--room-fill-op:${(.3*o.opacity).toFixed(3)}`)):e.push("--room-fill:transparent","--room-fill-op:0"),s=e.join(";")}const a=e=>this._showTip(e,t.name,this._t("tip.room"),this._config?.show_signal?this._roomLqi(t.area):null,t.area?Jt(this.hass,this._devices,t.area):null),r=!e.bg&&!o.showNames||this._markup,n=this._roomCenter(t),l=t.poly?B`<polygon class="${i}" style="${s}" points="${t.poly.map(t=>t.join(",")).join(" ")}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${a}
                    @mouseleave=${()=>this._tip=null}></polygon>`:B`<rect class="${i}" style="${s}"
                    x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${.03*Math.min(t.w,t.h)}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${a}
                    @mouseleave=${()=>this._tip=null}></rect>`;return B`${l}${r?B`<text class="rlabel" x="${n[0]}" y="${n[1]}">${t.name}</text>`:V}`})}
            ${this._markup?this._renderMarkupLayer(i):V}
          </svg>
          <div class="devlayer" style="--icon-size:${(r*i[2]/n.w).toFixed(3)}cqw">
            ${s.map(t=>this._renderDevice(t,n))}
            ${o.showNames&&!this._markup?e.rooms.map(t=>this._renderRoomLabel(t,e,n,o)):V}
          </div>
          ${this._markup&&"draw"===this._tool&&this._path.length&&this._cursorPt&&!this._contourClosed?j`<div class="measurelayer">${this._renderMeasureLabel(n)}</div>`:V}
          </div>
          ${this._zoom>1?j`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:V}
        </div>

        ${this._roomDialog?this._renderRoomDialog():V}
        ${this._spaceDialog?this._renderSpaceDialog():V}
        ${this._markerDialog?this._renderMarkerDialog():V}
        ${this._infoCard?this._renderInfoCard():V}
        ${this._rulesDialog?this._renderRulesDialog():V}
        ${this._importDialog?this._renderImportDialog():V}
        ${this._tip?j`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?j`<span class="m">${this._tip.meta}</span>`:V}
              ${null!=this._tip.temp?j`<span class="m">${this._t("tip.temp_avg")} <b>${this._tip.temp}°</b></span>`:V}
              ${null!=this._tip.lqi?j`<span class="m">${this._t("tip.lqi")}
                    <b style="color:${vt(this._tip.lqi)}">${this._tip.lqi}</b></span>`:V}
            </div>`:V}
        ${this._toast?j`<div class="toast">${this._toast}</div>`:V}
      </ha-card>
    `}_renderDevice(t,e){const i=this._pos(t),s=(i.x-e.x)/e.w*100,o=(i.y-e.y)/e.h*100,a=this._stateClass(t),r=this._liveTemp(t),n=this._liveHum(t),l=this._config?.show_signal&&!t.virtual?Ft(this.hass,t.entities):null;return j`<div
      class="dev ${a} ${this._selId===t.id?"sel":""} ${t.virtual?"virtual":""}"
      style="left:${s}%;top:${o}%"
      @click=${e=>this._clickDevice(e,t)}
      @mousemove=${e=>this._showTip(e,t.name,t.model+(null!=r?" · "+r+"°":"")+(null!=n?" · "+n+"%":"")+(null!=l?" · LQI "+l:""))}
      @mouseleave=${()=>this._tip=null}
      @pointerdown=${e=>this._pointerDown(e,t)}
      @pointermove=${e=>this._pointerMove(e,t)}
      @pointerup=${e=>this._pointerUp(e,t)}
      @pointercancel=${e=>this._pointerUp(e,t)}
    >
      <ha-icon icon="${t.icon}"></ha-icon>
      ${null!=r?j`<span class="tval">${r}°</span>`:V}
      ${null!=n?j`<span class="hval">${n}%</span>`:V}
      ${null!=l?j`<span class="lqi" style="color:${vt(l)}">${l}</span>`:V}
    </div>`}_labelPos(t,e){const i=this._layout["rl_"+(t.id||"")];if(i&&i.s===e){const t=this._serverCfg.spaces.find(t=>t.id===e)?.aspect||1;return{x:i.x*ye,y:i.y*(ye/t)}}const s=this._roomCenter(t);return{x:s[0],y:s[1]}}_labelDown(t,e,i){if(this._markup)return;t.preventDefault(),t.stopPropagation();const s=this._labelPos(e,i);this._drag={id:"rl_"+(e.id||""),sx:t.clientX,sy:t.clientY,ox:s.x,oy:s.y,moved:!1},t.target.setPointerCapture(t.pointerId),this._tip=null}_labelMove(t,e,i){const s="rl_"+(e.id||"");if(!this._drag||this._drag.id!==s)return;const o=this._stageEl;if(!o)return;const a=this._spaceModel(i).vb,r=o.getBoundingClientRect(),n=this._viewOr(a),l=(t.clientX-this._drag.sx)/r.width*n.w,c=(t.clientY-this._drag.sy)/r.height*n.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0);const h=.008*Math.min(a[2],a[3]),d=Math.max(a[0]+h,Math.min(a[0]+a[2]-h,this._drag.ox+l)),p=Math.max(a[1]+h,Math.min(a[1]+a[3]-h,this._drag.oy+c));this._savePos({id:s,space:i},d,p)}_labelUp(t){const e="rl_"+(t.id||"");if(!this._drag||this._drag.id!==e)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&window.setTimeout(()=>this._drag=null,0)}_renderRoomLabel(t,e,i,s){if(!t.name)return V;const o=this._labelPos(t,e.id),a=(o.x-i.x)/i.w*100,r=(o.y-i.y)/i.h*100,n=Math.min(1,s.opacity+.25);return j`<div class="roomlabel" style="left:${a}%;top:${r}%;color:${s.color};opacity:${n}"
      @pointerdown=${i=>this._labelDown(i,t,e.id)}
      @pointermove=${i=>this._labelMove(i,t,e.id)}
      @pointerup=${()=>this._labelUp(t)}
      @pointercancel=${()=>this._labelUp(t)}
    >${t.name}</div>`}_renderMeasureLabel(t){const e=this._path[this._path.length-1],i=this._cursorPt,s=(i[0]-t.x)/t.w*100,o=(i[1]-t.y)/t.h*100;return j`<div class="measurelabel" style="left:${s}%;top:${o}%">${this._fmtLen(e,i)}</div>`}_roomCenter(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}_renderMarkupDefs(t){const e=this._gridPitch,i=.14*e;return B`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${e}" height="${e}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="0" cy="${e}" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="${e}" r="${i}" class="griddot"></circle>
        </pattern>
      </defs>`}_renderMarkupLayer(t){const e=this._segments,i=this._path,s=this._gridPitch;return B`
      <rect x="${t[0]}" y="${t[1]}" width="${t[2]}" height="${t[3]}" fill="url(#hp-grid)" pointer-events="none"></rect>
      ${e.map(t=>B`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${i.length>1?B`<polyline class="pathline" points="${i.map(t=>t.join(",")).join(" ")}"></polyline>`:V}
      ${i.length&&this._cursorPt&&"draw"===this._tool&&!this._contourClosed?B`<line class="preview" x1="${i[i.length-1][0]}" y1="${i[i.length-1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:V}
      ${i.map((t,e)=>B`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*s}"></circle>`)}
    `}_renderMarkupBar(){return j`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <button class="btn ${"draw"===this._tool?"on":""}" @click=${()=>this._tool="draw"}
        title=${this._t("title.markup_add")}>
        <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this._t("markup.add")}
      </button>
      <button class="btn ${"delroom"===this._tool?"on":""}" @click=${()=>this._tool="delroom"}
        title=${this._t("title.markup_delroom")}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("markup.delete")}
      </button>
      <span class="spacer"></span>
      ${"draw"===this._tool?j`<span class="hint">${this._path.length?this._t("markup.hint_points",{n:this._path.length}):this._t("markup.hint_start")}</span>
            ${this._path.length?j`<button class="btn ghost" @click=${this._cancelPath}>${this._t("btn.reset")}</button>`:V}`:V}
    </div>`}_renderInfoCard(){const t=this._infoCard,e=t.primary?this.hass.states[t.primary]:void 0,i=e?this.hass.formatEntityState?.(e)??e.state:null;return j`<div class="menuwrap dialogwrap" @click=${()=>this._infoCard=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="${t.icon}"></ha-icon>${t.name}</div>
        <div class="body">
          ${t.model?j`<div class="inforow"><span class="k">${this._t("info.model")}</span><span>${t.model}</span></div>`:V}
          ${i?j`<div class="inforow"><span class="k">${this._t("info.state")}</span><span>${i}</span></div>`:V}
          ${Et(t.link)?j`<div class="inforow"><span class="k">${this._t("info.link")}</span>
                <a href="${Et(t.link)}" target="_blank" rel="noreferrer noopener">${t.link}</a></div>`:V}
          ${t.description?j`<div class="infodesc">${t.description}</div>`:V}
          ${t.pdfs&&t.pdfs.length?j`<div class="inforow"><span class="k">${this._t("info.manuals")}</span><span class="pdflist">
                ${t.pdfs.map(t=>j`<a class="pdf" href="${Et(t.url)||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${t.name}</a>`)}</span></div>`:V}
          ${t.model||i||t.link||t.description||t.pdfs&&t.pdfs.length?V:j`<div class="infodesc muted">${this._t("info.none")}</div>`}
        </div>
        <div class="row">
          <button class="btn" @click=${()=>{const e=t;this._infoCard=null,this._openMarkerDialog(e)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t("btn.edit")}
          </button>
          ${t.primary?j`<button class="btn" @click=${()=>{const e=t.primary;this._infoCard=null,this._openMoreInfo(e)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("btn.open_in_ha")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._infoCard=null}>${this._t("btn.close")}</button>
        </div>
      </div>
    </div>`}_renderMarkerDialog(){const t=this._markerDialog,e="virtual"===t.binding,i=this._bindingCandidates(),s=(()=>{if(e)return null;const s=i.find(e=>e.value===t.binding);if(s)return s.label;const[o,a]=t.binding.split(":");return"device"===o?this.hass.devices[a]?.name_by_user||this.hass.devices[a]?.name||a:this.hass.states[a]?.attributes?.friendly_name||a})();return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus"></ha-icon>
          ${t.devId?this._t("info.device_header"):this._t("marker.new_device")}</div>
        <div class="body">
          <label>${this._t("marker.name_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("marker.name_ph")}
            .value=${t.name}
            @input=${e=>this._markerDialog={...t,name:e.target.value}} />

          <label>${this._t("marker.binding_label")}</label>
          <div class="bindsel ${e?"virt":""}">
            <button class="opt ${e?"on":""}"
              @click=${()=>this._markerDialog={...t,binding:"virtual"}}>
              <ha-icon icon="mdi:map-marker-outline"></ha-icon>${this._t("marker.virtual_option")}
            </button>
            ${e?V:j`<div class="curbind"><ha-icon icon="mdi:link-variant"></ha-icon>
                  <b>${s}</b><span class="ref">${t.binding}</span></div>`}
            <input class="namein" type="text" placeholder=${this._t("marker.search_ph")}
              .value=${t.bindingFilter}
              @input=${e=>this._markerDialog={...t,bindingFilter:e.target.value}} />
            <div class="candlist">
              ${i.map(e=>j`<div class="cand ${e.value===t.binding?"sel":""}"
                  @click=${()=>this._markerDialog={...t,binding:e.value}}>
                  <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                </div>`)}
              ${i.length?V:j`<div class="cand muted">${this._t("marker.nothing_found")}</div>`}
            </div>
          </div>

          <label>${this._t("marker.room_label")}${e?"":this._t("marker.room_override")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,room:e.target.value}}>
            <option value="">${e?this._t("marker.room_choose"):this._t("marker.room_auto")}</option>
            ${this._allRoomsFlat().map(e=>j`<option value=${e.value} ?selected=${e.value===t.room}>${e.label}</option>`)}
          </select>

          <label>${this._t("marker.tap_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,tapAction:e.target.value}}>
            ${[["","tap.auto"],["info","tap.info"],["more-info","tap.more_info"],["toggle","tap.toggle"]].map(([e,i])=>j`<option value=${e} ?selected=${(t.tapAction||"")===e}>${this._t(i)}</option>`)}
          </select>

          <label>${this._t("marker.icon_label")}</label>
          ${customElements.get("ha-icon-picker")?j`<ha-icon-picker .hass=${this.hass} .value=${t.icon}
                @value-changed=${e=>this._markerDialog={...t,icon:e.detail.value||""}}></ha-icon-picker>`:j`<input class="namein" type="text" placeholder=${this._t("marker.icon_ph")}
                .value=${t.icon}
                @input=${e=>this._markerDialog={...t,icon:e.target.value}} />`}

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
            ${t.pdfs.map(t=>j`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${Et(t.url)||"#"}" target="_blank" rel="noreferrer noopener">${t.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${()=>this._removeMarkerPdf(t.url)}></ha-icon></span>`)}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>${this._t("btn.attach")}
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${t=>this._pickMarkerFiles(t)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${t.devId?j`<button class="btn danger" @click=${this._deleteMarker}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.remove")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._markerDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveMarker} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderSpaceDialog(){const t=this._spaceDialog;return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>
          ${"create"===t.mode?this._t("space.new"):this._t("space.header")}
          ${this._importTotal>0&&"create"===t.mode?j`<span class="importprog">${this._t("import.progress",{i:this._importTotal-this._importQueue.length,n:this._importTotal})}</span>`:V}</div>
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
          ${"file"===t.source?j`<div class="planrow">
                ${t.planFile?j`<span class="planname">${t.planFile.name}</span>`:t.planUrl?j`<img class="planprev" src=${t.planUrl} alt=${this._t("space.plan_alt")} />`:j`<span class="planname muted">${this._t("space.no_plan")}</span>`}
                <label class="btn filebtn">
                  <ha-icon icon="mdi:upload"></ha-icon>${t.planUrl||t.planFile?this._t("btn.replace"):this._t("btn.upload")}
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${t=>this._pickPlanFile(t)} />
                </label>
              </div>`:V}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"draw"===t.source}
              @change=${()=>this._spaceDialog={...t,source:"draw"}} />
            <span>${this._t("space.source_draw")}</span>
          </label>
          ${"draw"===t.source&&"create"===t.mode?j`<label>${this._t("space.orientation")}</label>
              <select class="areasel"
                @change=${e=>this._spaceDialog={...t,orientation:e.target.value}}>
                ${[["landscape","orient.landscape"],["portrait","orient.portrait"],["square","orient.square"]].map(([e,i])=>j`<option value=${e} ?selected=${t.orientation===e}>${this._t(i)}</option>`)}
              </select>`:V}

          <label>${this._t("space.scale_label")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min="0.1" step="0.1" .value=${String(t.cellCm)}
              @input=${e=>{const i=parseFloat(e.target.value);this._spaceDialog={...t,cellCm:Number.isFinite(i)&&i>0?i:t.cellCm}}} />
            <span class="opl">${this._t("space.scale_unit")}</span>
          </div>

          <label class="dispsection">${this._t("space.display_section")}</label>
          <label class="srcrow">
            <input type="checkbox" .checked=${t.showBorders}
              @change=${e=>this._spaceDialog={...t,showBorders:e.target.checked}} />
            <span>${this._t("space.show_borders")}</span>
          </label>
          <label class="srcrow">
            <input type="checkbox" .checked=${t.showNames}
              @change=${e=>this._spaceDialog={...t,showNames:e.target.checked}} />
            <span>${this._t("space.show_names")}</span>
          </label>
          <label>${this._t("space.room_color")}</label>
          <div class="colorrow">
            <input type="color" .value=${t.roomColor}
              @input=${e=>this._spaceDialog={...t,roomColor:e.target.value}} />
            <span class="opl">${this._t("space.opacity")}</span>
            <input type="range" min="0" max="100" .value=${String(Math.round(100*t.roomOpacity))}
              @input=${e=>this._spaceDialog={...t,roomOpacity:Number(e.target.value)/100}} />
            <span class="opv">${Math.round(100*t.roomOpacity)}%</span>
          </div>
          <label>${this._t("space.fill_label")}</label>
          ${[["none","fill.none"],["lqi","fill.lqi"],["light","fill.light"],["temp","fill.temp"]].map(([e,i])=>j`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===e}
                @change=${()=>this._spaceDialog={...t,fillMode:e}} />
              <span>${this._t(i)}</span>
              ${"temp"===e&&"temp"===t.fillMode?j`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMin)}
                      @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._spaceDialog={...t,tempMin:i})}} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMax)}
                      @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._spaceDialog={...t,tempMax:i})}} />
                    °C
                  </span>`:V}
            </label>`)}
        </div>
        <div class="row">
          ${"edit"===t.mode?j`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:V}
          <span class="spacer"></span>
          ${this._importTotal>0&&"create"===t.mode?j`<button class="btn ghost" @click=${()=>this._skipImport()}>${this._t("btn.skip")}</button>`:V}
          <button class="btn ghost" @click=${()=>{this._spaceDialog=null,this._importQueue=[],this._importTotal=0}}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
            title=${"file"!==t.source||t.planFile||t.planUrl?"":this._t("title.need_plan")}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderRoomDialog(){const t=this._freeAreas;return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>${this._t("room.new")}</div>
        <div class="body">
          <label>${this._t("room.name_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("room.name_ph")}
            .value=${this._nameSel}
            @input=${t=>this._nameSel=t.target.value} />
          <label>${this._t("room.area_label")}</label>
          <select class="areasel"
            @change=${t=>{this._areaSel=t.target.value,!this._nameSel&&this._areaSel&&(this._nameSel=this.hass.areas[this._areaSel]?.name||""),this.requestUpdate()}}>
            <option value="">${this._t("room.no_area_option")}</option>
            ${t.map(t=>j`<option value=${t.area_id} ?selected=${t.area_id===this._areaSel}>${t.name}</option>`)}
          </select>
        </div>
        <div class="row">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this._t("btn.cancel")}</button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
            title=${this._t("title.no_area_room")}>
            ${this._t("btn.no_area")}
          </button>
          <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
            title=${this._areaSel?"":this._t("title.choose_area")}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}}xe.properties={hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_markup:{state:!0},_tool:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_rulesDialog:{state:!0},_importDialog:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},xe.styles=ie,customElements.get("houseplan-card")||customElements.define("houseplan-card",xe),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-card"===t.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Interactive house plan: spaces, rooms and devices with live states and drag layout."}),console.info("%c HOUSEPLAN-CARD %c v1.20.0 ","background:#3ea6ff;color:#04121f;font-weight:700","");
