const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let o=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const n=(t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(s,t,i)},r=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:a,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:h,getOwnPropertySymbols:p,getPrototypeOf:d}=Object,u=globalThis,g=u.trustedTypes,_=g?g.emptyScript:"",m=u.reactiveElementPolyfillSupport,f=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!a(t,e),y={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),u.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=y){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:o}=c(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);o?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??y}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=d(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...h(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(r(t))}else void 0!==t&&e.push(r(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),o=t.litNonce;void 0!==o&&s.setAttribute("nonce",o),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==o?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const n=o.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(void 0!==t){const n=this.constructor;if(!1===s&&(o=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==o||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[f("elementProperties")]=new Map,w[f("finalized")]=new Map,m?.({ReactiveElement:w}),(u.reactiveElementVersions??=[]).push("2.1.2");const x=globalThis,$=t=>t,k=x.trustedTypes,S=k?k.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",E=`lit$${Math.random().toFixed(9).slice(2)}$`,D="?"+E,A=`<${D}>`,M=document,z=()=>M.createComment(""),T=t=>null===t||"object"!=typeof t&&"function"!=typeof t,R=Array.isArray,P="[ \t\n\f\r]",N=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,O=/-->/g,I=/>/g,L=RegExp(`>|${P}(?:([^\\s"'>=/]+)(${P}*=${P}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),q=/'/g,U=/"/g,B=/^(?:script|style|textarea|title)$/i,F=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),H=F(1),j=F(2),G=Symbol.for("lit-noChange"),W=Symbol.for("lit-nothing"),V=new WeakMap,K=M.createTreeWalker(M,129);function Z(t,e){if(!R(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const Y=(t,e)=>{const i=t.length-1,s=[];let o,n=2===e?"<svg>":3===e?"<math>":"",r=N;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,h=0;for(;h<i.length&&(r.lastIndex=h,l=r.exec(i),null!==l);)h=r.lastIndex,r===N?"!--"===l[1]?r=O:void 0!==l[1]?r=I:void 0!==l[2]?(B.test(l[2])&&(o=RegExp("</"+l[2],"g")),r=L):void 0!==l[3]&&(r=L):r===L?">"===l[0]?(r=o??N,c=-1):void 0===l[1]?c=-2:(c=r.lastIndex-l[2].length,a=l[1],r=void 0===l[3]?L:'"'===l[3]?U:q):r===U||r===q?r=L:r===O||r===I?r=N:(r=L,o=void 0);const p=r===L&&t[e+1].startsWith("/>")?" ":"";n+=r===N?i+A:c>=0?(s.push(a),i.slice(0,c)+C+i.slice(c)+E+p):i+E+(-2===c?e:p)}return[Z(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class J{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,n=0;const r=t.length-1,a=this.parts,[l,c]=Y(t,e);if(this.el=J.createElement(l,i),K.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=K.nextNode())&&a.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=c[n++],i=s.getAttribute(t).split(E),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:o,name:r[2],strings:i,ctor:"."===r[1]?it:"?"===r[1]?st:"@"===r[1]?ot:et}),s.removeAttribute(t)}else t.startsWith(E)&&(a.push({type:6,index:o}),s.removeAttribute(t));if(B.test(s.tagName)){const t=s.textContent.split(E),e=t.length-1;if(e>0){s.textContent=k?k.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],z()),K.nextNode(),a.push({type:2,index:++o});s.append(t[e],z())}}}else if(8===s.nodeType)if(s.data===D)a.push({type:2,index:o});else{let t=-1;for(;-1!==(t=s.data.indexOf(E,t+1));)a.push({type:7,index:o}),t+=E.length-1}o++}}static createElement(t,e){const i=M.createElement("template");return i.innerHTML=t,i}}function X(t,e,i=t,s){if(e===G)return e;let o=void 0!==s?i._$Co?.[s]:i._$Cl;const n=T(e)?void 0:e._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),void 0===n?o=void 0:(o=new n(t),o._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=o:i._$Cl=o),void 0!==o&&(e=X(t,o._$AS(t,e.values),o,s)),e}class Q{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??M).importNode(e,!0);K.currentNode=s;let o=K.nextNode(),n=0,r=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new tt(o,o.nextSibling,this,t):1===a.type?e=new a.ctor(o,a.name,a.strings,this,t):6===a.type&&(e=new nt(o,this,t)),this._$AV.push(e),a=i[++r]}n!==a?.index&&(o=K.nextNode(),n++)}return K.currentNode=M,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=W,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=X(this,t,e),T(t)?t===W||null==t||""===t?(this._$AH!==W&&this._$AR(),this._$AH=W):t!==this._$AH&&t!==G&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>R(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==W&&T(this._$AH)?this._$AA.nextSibling.data=t:this.T(M.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=J.createElement(Z(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new Q(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=V.get(t.strings);return void 0===e&&V.set(t.strings,e=new J(t)),e}k(t){R(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new tt(this.O(z()),this.O(z()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=$(t).nextSibling;$(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=W,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=W}_$AI(t,e=this,i,s){const o=this.strings;let n=!1;if(void 0===o)t=X(this,t,e,0),n=!T(t)||t!==this._$AH&&t!==G,n&&(this._$AH=t);else{const s=t;let r,a;for(t=o[0],r=0;r<o.length-1;r++)a=X(this,s[i+r],e,r),a===G&&(a=this._$AH[r]),n||=!T(a)||a!==this._$AH[r],a===W?t=W:t!==W&&(t+=(a??"")+o[r+1]),this._$AH[r]=a}n&&!s&&this.j(t)}j(t){t===W?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class it extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===W?void 0:t}}class st extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==W)}}class ot extends et{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=X(this,t,e,0)??W)===G)return;const i=this._$AH,s=t===W&&i!==W||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==W&&(i===W||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class nt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){X(this,t)}}const rt=x.litHtmlPolyfillSupport;rt?.(J,tt),(x.litHtmlVersions??=[]).push("3.3.3");const at=globalThis;class lt extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let o=s._$litPart$;if(void 0===o){const t=i?.renderBefore??null;s._$litPart$=o=new tt(e.insertBefore(z(),t),t,void 0,i??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return G}}lt._$litElement$=!0,lt.finalized=!0,at.litElementHydrateSupport?.({LitElement:lt});const ct=at.litElementPolyfillSupport;ct?.({LitElement:lt}),(at.litElementVersions??=[]).push("4.2.2");const ht=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),pt=[{pattern:"протечк|leak|water sensor",icon:"mdi:water-alert"},{pattern:"клапан|valve",icon:"mdi:pipe-valve"},{pattern:"дым|smoke",icon:"mdi:smoke-detector"},{pattern:"термоголов|trv|radiator",icon:"mdi:radiator"},{pattern:"температ|temperature|climate sensor",icon:"mdi:thermometer"},{pattern:"qingping|air monitor|молекул|air quality",icon:"mdi:air-filter"},{pattern:"штор|curtain|blind|shade",icon:"mdi:roller-shade"},{pattern:"розетк|plug|socket|outlet",icon:"mdi:power-socket-de"},{pattern:"выключат|switch",icon:"mdi:light-switch"},{pattern:"лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip",icon:"mdi:lightbulb"},{pattern:"камер|camera",icon:"mdi:cctv"},{pattern:"замок|ttlock|lock|sn609|sn9161",icon:"mdi:lock"},{pattern:"ворота|garage|gate",icon:"mdi:garage-variant"},{pattern:"калитк|door|открыт|contact",icon:"mdi:door"},{pattern:"счётчик|счетчик|kws|meter",icon:"mdi:meter-electric"},{pattern:"вводный автомат|breaker|wifimcbn",icon:"mdi:electric-switch"},{pattern:"myheat|котёл|котел|boiler|отоплен|heating",icon:"mdi:water-boiler"},{pattern:"холодильник|fridge",icon:"mdi:fridge"},{pattern:"стиральн|washer|washing",icon:"mdi:washing-machine"},{pattern:"сушилк|dryer",icon:"mdi:tumble-dryer"},{pattern:"пылесос|vacuum|dreame|roborock",icon:"mdi:robot-vacuum"},{pattern:"soundbar|колонк|станц|speaker",icon:"mdi:soundbar"},{pattern:"tv|телевизор|hyundaitv|mitv|television",icon:"mdi:television"},{pattern:"keenetic|роутер|router|mesh|access point",icon:"mdi:router-wireless"},{pattern:"ибп|ups|kirpich",icon:"mdi:battery-charging-high"},{pattern:"slzb|координат|zigbee|coordinator",icon:"mdi:zigbee"},{pattern:"motion|движен|presence|присутств",icon:"mdi:motion-sensor"},{pattern:"humidity|влажн",icon:"mdi:water-percent"}];function dt(t){const e=[];for(const i of t)if(i&&"string"==typeof i.pattern&&i.icon)try{e.push({re:new RegExp(i.pattern,"i"),icon:i.icon})}catch{}return e}const ut=dt(pt),gt={temperature:"mdi:thermometer",humidity:"mdi:water-percent",motion:"mdi:motion-sensor",occupancy:"mdi:motion-sensor",door:"mdi:door",window:"mdi:window-closed",garage_door:"mdi:garage-variant",smoke:"mdi:smoke-detector",moisture:"mdi:water-alert",gas:"mdi:gas-cylinder",power:"mdi:meter-electric",energy:"mdi:meter-electric",illuminance:"mdi:brightness-5",co2:"mdi:molecule-co2",pm25:"mdi:air-filter",battery:"mdi:battery"},_t="mdi:chip";function mt(t,e,i){const s=((t||"")+" "+(e||"")).toLowerCase();for(const{re:t,icon:e}of i??ut)if(t.test(s))return e;return _t}const ft=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];var vt=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,bt=Math.ceil,yt=Math.floor,wt="[BigNumber Error] ",xt=wt+"Number primitive has more than 15 significant digits: ",$t=1e14,kt=14,St=9007199254740991,Ct=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],Et=1e7,Dt=1e9;function At(t){var e=0|t;return t>0||t===e?e:e-1}function Mt(t){for(var e,i,s=1,o=t.length,n=t[0]+"";s<o;){for(e=t[s++]+"",i=kt-e.length;i--;e="0"+e);n+=e}for(o=n.length;48===n.charCodeAt(--o););return n.slice(0,o+1||1)}function zt(t,e){var i,s,o=t.c,n=e.c,r=t.s,a=e.s,l=t.e,c=e.e;if(!r||!a)return null;if(i=o&&!o[0],s=n&&!n[0],i||s)return i?s?0:-a:r;if(r!=a)return r;if(i=r<0,s=l==c,!o||!n)return s?0:!o^i?1:-1;if(!s)return l>c^i?1:-1;for(a=(l=o.length)<(c=n.length)?l:c,r=0;r<a;r++)if(o[r]!=n[r])return o[r]>n[r]^i?1:-1;return l==c?0:l>c^i?1:-1}function Tt(t,e,i,s){if(t<e||t>i||t!==yt(t))throw Error(wt+(s||"Argument")+("number"==typeof t?t<e||t>i?" out of range: ":" not an integer: ":" not a primitive number: ")+String(t))}function Rt(t){var e=t.c.length-1;return At(t.e/kt)==e&&t.c[e]%2!=0}function Pt(t,e){return(t.length>1?t.charAt(0)+"."+t.slice(1):t)+(e<0?"e":"e+")+e}function Nt(t,e,i){var s,o;if(e<0){for(o=i+".";++e;o+=i);t=o+t}else if(++e>(s=t.length)){for(o=i,e-=s;--e;o+=i);t+=o}else e<s&&(t=t.slice(0,e)+"."+t.slice(e));return t}var Ot=function t(e){var i,s,o,n,r,a,l,c,h,p,d=C.prototype={constructor:C,toString:null,valueOf:null},u=new C(1),g=20,_=4,m=-7,f=21,v=-1e7,b=1e7,y=!1,w=1,x=0,$={prefix:"",groupSize:3,secondaryGroupSize:0,groupSeparator:",",decimalSeparator:".",fractionGroupSize:0,fractionGroupSeparator:" ",suffix:""},k="0123456789abcdefghijklmnopqrstuvwxyz",S=!0;function C(t,e){var i,n,r,a,l,c,h,p,d=this;if(!(d instanceof C))return new C(t,e);if(null==e){if(t&&!0===t._isBigNumber)return d.s=t.s,void(!t.c||t.e>b?d.c=d.e=null:t.e<v?d.c=[d.e=0]:(d.e=t.e,d.c=t.c.slice()));if((c="number"==typeof t)&&0*t==0){if(d.s=1/t<0?(t=-t,-1):1,t===~~t){for(a=0,l=t;l>=10;l/=10,a++);return void(a>b?d.c=d.e=null:(d.e=a,d.c=[t]))}p=String(t)}else{if(!vt.test(p=String(t)))return o(d,p,c);d.s=45==p.charCodeAt(0)?(p=p.slice(1),-1):1}(a=p.indexOf("."))>-1&&(p=p.replace(".","")),(l=p.search(/e/i))>0?(a<0&&(a=l),a+=+p.slice(l+1),p=p.substring(0,l)):a<0&&(a=p.length)}else{if(Tt(e,2,k.length,"Base"),10==e&&S)return M(d=new C(t),g+d.e+1,_);if(p=String(t),c="number"==typeof t){if(0*t!=0)return o(d,p,c,e);if(d.s=1/t<0?(p=p.slice(1),-1):1,C.DEBUG&&p.replace(/^0\.0*|\./,"").length>15)throw Error(xt+t)}else d.s=45===p.charCodeAt(0)?(p=p.slice(1),-1):1;for(i=k.slice(0,e),a=l=0,h=p.length;l<h;l++)if(i.indexOf(n=p.charAt(l))<0){if("."==n){if(l>a){a=h;continue}}else if(!r&&(p==p.toUpperCase()&&(p=p.toLowerCase())||p==p.toLowerCase()&&(p=p.toUpperCase()))){r=!0,l=-1,a=0;continue}return o(d,String(t),c,e)}c=!1,(a=(p=s(p,e,10,d.s)).indexOf("."))>-1?p=p.replace(".",""):a=p.length}for(l=0;48===p.charCodeAt(l);l++);for(h=p.length;48===p.charCodeAt(--h););if(p=p.slice(l,++h)){if(h-=l,c&&C.DEBUG&&h>15&&(t>St||t!==yt(t)))throw Error(xt+d.s*t);if((a=a-l-1)>b)d.c=d.e=null;else if(a<v)d.c=[d.e=0];else{if(d.e=a,d.c=[],l=(a+1)%kt,a<0&&(l+=kt),l<h){for(l&&d.c.push(+p.slice(0,l)),h-=kt;l<h;)d.c.push(+p.slice(l,l+=kt));l=kt-(p=p.slice(l)).length}else l-=h;for(;l--;p+="0");d.c.push(+p)}}else d.c=[d.e=0]}function E(t,e,i,s){var o,n,r,a,l;if(null==i?i=_:Tt(i,0,8),!t.c)return t.toString();if(o=t.c[0],r=t.e,null==e)l=Mt(t.c),l=1==s||2==s&&(r<=m||r>=f)?Pt(l,r):Nt(l,r,"0");else if(n=(t=M(new C(t),e,i)).e,a=(l=Mt(t.c)).length,1==s||2==s&&(e<=n||n<=m)){for(;a<e;l+="0",a++);l=Pt(l,n)}else if(e-=r+(2===s&&n>r),l=Nt(l,n,"0"),n+1>a){if(--e>0)for(l+=".";e--;l+="0");}else if((e+=n-a)>0)for(n+1==a&&(l+=".");e--;l+="0");return t.s<0&&o?"-"+l:l}function D(t,e){for(var i,s,o=1,n=new C(t[0]);o<t.length;o++)(!(s=new C(t[o])).s||(i=zt(n,s))===e||0===i&&n.s===e)&&(n=s);return n}function A(t,e,i){for(var s=1,o=e.length;!e[--o];e.pop());for(o=e[0];o>=10;o/=10,s++);return(i=s+i*kt-1)>b?t.c=t.e=null:i<v?t.c=[t.e=0]:(t.e=i,t.c=e),t}function M(t,e,i,s){var o,n,r,a,l,c,h,p=t.c,d=Ct;if(p){t:{for(o=1,a=p[0];a>=10;a/=10,o++);if((n=e-o)<0)n+=kt,r=e,l=p[c=0],h=yt(l/d[o-r-1]%10);else if((c=bt((n+1)/kt))>=p.length){if(!s)break t;for(;p.length<=c;p.push(0));l=h=0,o=1,r=(n%=kt)-kt+1}else{for(l=a=p[c],o=1;a>=10;a/=10,o++);h=(r=(n%=kt)-kt+o)<0?0:yt(l/d[o-r-1]%10)}if(s=s||e<0||null!=p[c+1]||(r<0?l:l%d[o-r-1]),s=i<4?(h||s)&&(0==i||i==(t.s<0?3:2)):h>5||5==h&&(4==i||s||6==i&&(n>0?r>0?l/d[o-r]:0:p[c-1])%10&1||i==(t.s<0?8:7)),e<1||!p[0])return p.length=0,s?(e-=t.e+1,p[0]=d[(kt-e%kt)%kt],t.e=-e||0):p[0]=t.e=0,t;if(0==n?(p.length=c,a=1,c--):(p.length=c+1,a=d[kt-n],p[c]=r>0?yt(l/d[o-r]%d[r])*a:0),s)for(;;){if(0==c){for(n=1,r=p[0];r>=10;r/=10,n++);for(r=p[0]+=a,a=1;r>=10;r/=10,a++);n!=a&&(t.e++,p[0]==$t&&(p[0]=1));break}if(p[c]+=a,p[c]!=$t)break;p[c--]=0,a=1}for(n=p.length;0===p[--n];p.pop());}t.e>b?t.c=t.e=null:t.e<v&&(t.c=[t.e=0])}return t}function z(t){var e,i=t.e;return null===i?t.toString():(e=Mt(t.c),e=i<=m||i>=f?Pt(e,i):Nt(e,i,"0"),t.s<0?"-"+e:e)}return C.clone=t,C.ROUND_UP=0,C.ROUND_DOWN=1,C.ROUND_CEIL=2,C.ROUND_FLOOR=3,C.ROUND_HALF_UP=4,C.ROUND_HALF_DOWN=5,C.ROUND_HALF_EVEN=6,C.ROUND_HALF_CEIL=7,C.ROUND_HALF_FLOOR=8,C.EUCLID=9,C.config=C.set=function(t){var e,i;if(null!=t){if("object"!=typeof t)throw Error(wt+"Object expected: "+t);if(t.hasOwnProperty(e="DECIMAL_PLACES")&&(Tt(i=t[e],0,Dt,e),g=i),t.hasOwnProperty(e="ROUNDING_MODE")&&(Tt(i=t[e],0,8,e),_=i),t.hasOwnProperty(e="EXPONENTIAL_AT")&&((i=t[e])&&i.pop?(Tt(i[0],-Dt,0,e),Tt(i[1],0,Dt,e),m=i[0],f=i[1]):(Tt(i,-Dt,Dt,e),m=-(f=i<0?-i:i))),t.hasOwnProperty(e="RANGE"))if((i=t[e])&&i.pop)Tt(i[0],-Dt,-1,e),Tt(i[1],1,Dt,e),v=i[0],b=i[1];else{if(Tt(i,-Dt,Dt,e),!i)throw Error(wt+e+" cannot be zero: "+i);v=-(b=i<0?-i:i)}if(t.hasOwnProperty(e="CRYPTO")){if((i=t[e])!==!!i)throw Error(wt+e+" not true or false: "+i);if(i){if("undefined"==typeof crypto||!crypto||!crypto.getRandomValues&&!crypto.randomBytes)throw y=!i,Error(wt+"crypto unavailable");y=i}else y=i}if(t.hasOwnProperty(e="MODULO_MODE")&&(Tt(i=t[e],0,9,e),w=i),t.hasOwnProperty(e="POW_PRECISION")&&(Tt(i=t[e],0,Dt,e),x=i),t.hasOwnProperty(e="FORMAT")){if("object"!=typeof(i=t[e]))throw Error(wt+e+" not an object: "+i);$=i}if(t.hasOwnProperty(e="ALPHABET")){if("string"!=typeof(i=t[e])||/^.?$|[+\-.\s]|(.).*\1/.test(i))throw Error(wt+e+" invalid: "+i);S="0123456789"==i.slice(0,10),k=i}}return{DECIMAL_PLACES:g,ROUNDING_MODE:_,EXPONENTIAL_AT:[m,f],RANGE:[v,b],CRYPTO:y,MODULO_MODE:w,POW_PRECISION:x,FORMAT:$,ALPHABET:k}},C.isBigNumber=function(t){if(!t||!0!==t._isBigNumber)return!1;if(!C.DEBUG)return!0;var e,i,s=t.c,o=t.e,n=t.s;t:if("[object Array]"=={}.toString.call(s)){if((1===n||-1===n)&&o>=-Dt&&o<=Dt&&o===yt(o)){if(0===s[0]){if(0===o&&1===s.length)return!0;break t}if((e=(o+1)%kt)<1&&(e+=kt),String(s[0]).length==e){for(e=0;e<s.length;e++)if((i=s[e])<0||i>=$t||i!==yt(i))break t;if(0!==i)return!0}}}else if(null===s&&null===o&&(null===n||1===n||-1===n))return!0;throw Error(wt+"Invalid BigNumber: "+t)},C.maximum=C.max=function(){return D(arguments,-1)},C.minimum=C.min=function(){return D(arguments,1)},C.random=(n=9007199254740992,r=Math.random()*n&2097151?function(){return yt(Math.random()*n)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(t){var e,i,s,o,n,a=0,l=[],c=new C(u);if(null==t?t=g:Tt(t,0,Dt),o=bt(t/kt),y)if(crypto.getRandomValues){for(e=crypto.getRandomValues(new Uint32Array(o*=2));a<o;)(n=131072*e[a]+(e[a+1]>>>11))>=9e15?(i=crypto.getRandomValues(new Uint32Array(2)),e[a]=i[0],e[a+1]=i[1]):(l.push(n%1e14),a+=2);a=o/2}else{if(!crypto.randomBytes)throw y=!1,Error(wt+"crypto unavailable");for(e=crypto.randomBytes(o*=7);a<o;)(n=281474976710656*(31&e[a])+1099511627776*e[a+1]+4294967296*e[a+2]+16777216*e[a+3]+(e[a+4]<<16)+(e[a+5]<<8)+e[a+6])>=9e15?crypto.randomBytes(7).copy(e,a):(l.push(n%1e14),a+=7);a=o/7}if(!y)for(;a<o;)(n=r())<9e15&&(l[a++]=n%1e14);for(o=l[--a],t%=kt,o&&t&&(n=Ct[kt-t],l[a]=yt(o/n)*n);0===l[a];l.pop(),a--);if(a<0)l=[s=0];else{for(s=-1;0===l[0];l.splice(0,1),s-=kt);for(a=1,n=l[0];n>=10;n/=10,a++);a<kt&&(s-=kt-a)}return c.e=s,c.c=l,c}),C.sum=function(){for(var t=1,e=arguments,i=new C(e[0]);t<e.length;)i=i.plus(e[t++]);return i},s=function(){var t="0123456789";function e(t,e,i,s){for(var o,n,r=[0],a=0,l=t.length;a<l;){for(n=r.length;n--;r[n]*=e);for(r[0]+=s.indexOf(t.charAt(a++)),o=0;o<r.length;o++)r[o]>i-1&&(null==r[o+1]&&(r[o+1]=0),r[o+1]+=r[o]/i|0,r[o]%=i)}return r.reverse()}return function(s,o,n,r,a){var l,c,h,p,d,u,m,f,v=s.indexOf("."),b=g,y=_;for(v>=0&&(p=x,x=0,s=s.replace(".",""),u=(f=new C(o)).pow(s.length-v),x=p,f.c=e(Nt(Mt(u.c),u.e,"0"),10,n,t),f.e=f.c.length),h=p=(m=e(s,o,n,a?(l=k,t):(l=t,k))).length;0==m[--p];m.pop());if(!m[0])return l.charAt(0);if(v<0?--h:(u.c=m,u.e=h,u.s=r,m=(u=i(u,f,b,y,n)).c,d=u.r,h=u.e),v=m[c=h+b+1],p=n/2,d=d||c<0||null!=m[c+1],d=y<4?(null!=v||d)&&(0==y||y==(u.s<0?3:2)):v>p||v==p&&(4==y||d||6==y&&1&m[c-1]||y==(u.s<0?8:7)),c<1||!m[0])s=d?Nt(l.charAt(1),-b,l.charAt(0)):l.charAt(0);else{if(m.length=c,d)for(--n;++m[--c]>n;)m[c]=0,c||(++h,m=[1].concat(m));for(p=m.length;!m[--p];);for(v=0,s="";v<=p;s+=l.charAt(m[v++]));s=Nt(s,h,l.charAt(0))}return s}}(),i=function(){function t(t,e,i){var s,o,n,r,a=0,l=t.length,c=e%Et,h=e/Et|0;for(t=t.slice();l--;)a=((o=c*(n=t[l]%Et)+(s=h*n+(r=t[l]/Et|0)*c)%Et*Et+a)/i|0)+(s/Et|0)+h*r,t[l]=o%i;return a&&(t=[a].concat(t)),t}function e(t,e,i,s){var o,n;if(i!=s)n=i>s?1:-1;else for(o=n=0;o<i;o++)if(t[o]!=e[o]){n=t[o]>e[o]?1:-1;break}return n}function i(t,e,i,s){for(var o=0;i--;)t[i]-=o,o=t[i]<e[i]?1:0,t[i]=o*s+t[i]-e[i];for(;!t[0]&&t.length>1;t.splice(0,1));}return function(s,o,n,r,a){var l,c,h,p,d,u,g,_,m,f,v,b,y,w,x,$,k,S=s.s==o.s?1:-1,E=s.c,D=o.c;if(!(E&&E[0]&&D&&D[0]))return new C(s.s&&o.s&&(E?!D||E[0]!=D[0]:D)?E&&0==E[0]||!D?0*S:S/0:NaN);for(m=(_=new C(S)).c=[],S=n+(c=s.e-o.e)+1,a||(a=$t,c=At(s.e/kt)-At(o.e/kt),S=S/kt|0),h=0;D[h]==(E[h]||0);h++);if(D[h]>(E[h]||0)&&c--,S<0)m.push(1),p=!0;else{for(w=E.length,$=D.length,h=0,S+=2,(d=yt(a/(D[0]+1)))>1&&(D=t(D,d,a),E=t(E,d,a),$=D.length,w=E.length),y=$,v=(f=E.slice(0,$)).length;v<$;f[v++]=0);k=D.slice(),k=[0].concat(k),x=D[0],D[1]>=a/2&&x++;do{if(d=0,(l=e(D,f,$,v))<0){if(b=f[0],$!=v&&(b=b*a+(f[1]||0)),(d=yt(b/x))>1)for(d>=a&&(d=a-1),g=(u=t(D,d,a)).length,v=f.length;1==e(u,f,g,v);)d--,i(u,$<g?k:D,g,a),g=u.length,l=1;else 0==d&&(l=d=1),g=(u=D.slice()).length;if(g<v&&(u=[0].concat(u)),i(f,u,v,a),v=f.length,-1==l)for(;e(D,f,$,v)<1;)d++,i(f,$<v?k:D,v,a),v=f.length}else 0===l&&(d++,f=[0]);m[h++]=d,f[0]?f[v++]=E[y]||0:(f=[E[y]],v=1)}while((y++<w||null!=f[0])&&S--);p=null!=f[0],m[0]||m.splice(0,1)}if(a==$t){for(h=1,S=m[0];S>=10;S/=10,h++);M(_,n+(_.e=h+c*kt-1)+1,r,p)}else _.e=c,_.r=+p;return _}}(),a=/^(-?)0([xbo])(?=\w[\w.]*$)/i,l=/^([^.]+)\.$/,c=/^\.([^.]+)$/,h=/^-?(Infinity|NaN)$/,p=/^\s*\+(?=[\w.])|^\s+|\s+$/g,o=function(t,e,i,s){var o,n=i?e:e.replace(p,"");if(h.test(n))t.s=isNaN(n)?null:n<0?-1:1;else{if(!i&&(n=n.replace(a,function(t,e,i){return o="x"==(i=i.toLowerCase())?16:"b"==i?2:8,s&&s!=o?t:e}),s&&(o=s,n=n.replace(l,"$1").replace(c,"0.$1")),e!=n))return new C(n,o);if(C.DEBUG)throw Error(wt+"Not a"+(s?" base "+s:"")+" number: "+e);t.s=null}t.c=t.e=null},d.absoluteValue=d.abs=function(){var t=new C(this);return t.s<0&&(t.s=1),t},d.comparedTo=function(t,e){return zt(this,new C(t,e))},d.decimalPlaces=d.dp=function(t,e){var i,s,o,n=this;if(null!=t)return Tt(t,0,Dt),null==e?e=_:Tt(e,0,8),M(new C(n),t+n.e+1,e);if(!(i=n.c))return null;if(s=((o=i.length-1)-At(this.e/kt))*kt,o=i[o])for(;o%10==0;o/=10,s--);return s<0&&(s=0),s},d.dividedBy=d.div=function(t,e){return i(this,new C(t,e),g,_)},d.dividedToIntegerBy=d.idiv=function(t,e){return i(this,new C(t,e),0,1)},d.exponentiatedBy=d.pow=function(t,e){var i,s,o,n,r,a,l,c,h=this;if((t=new C(t)).c&&!t.isInteger())throw Error(wt+"Exponent not an integer: "+z(t));if(null!=e&&(e=new C(e)),r=t.e>14,!h.c||!h.c[0]||1==h.c[0]&&!h.e&&1==h.c.length||!t.c||!t.c[0])return c=new C(Math.pow(+z(h),r?t.s*(2-Rt(t)):+z(t))),e?c.mod(e):c;if(a=t.s<0,e){if(e.c?!e.c[0]:!e.s)return new C(NaN);(s=!a&&h.isInteger()&&e.isInteger())&&(h=h.mod(e))}else{if(t.e>9&&(h.e>0||h.e<-1||(0==h.e?h.c[0]>1||r&&h.c[1]>=24e7:h.c[0]<8e13||r&&h.c[0]<=9999975e7)))return n=h.s<0&&Rt(t)?-0:0,h.e>-1&&(n=1/n),new C(a?1/n:n);x&&(n=bt(x/kt+2))}for(r?(i=new C(.5),a&&(t.s=1),l=Rt(t)):l=(o=Math.abs(+z(t)))%2,c=new C(u);;){if(l){if(!(c=c.times(h)).c)break;n?c.c.length>n&&(c.c.length=n):s&&(c=c.mod(e))}if(o){if(0===(o=yt(o/2)))break;l=o%2}else if(M(t=t.times(i),t.e+1,1),t.e>14)l=Rt(t);else{if(0===(o=+z(t)))break;l=o%2}h=h.times(h),n?h.c&&h.c.length>n&&(h.c.length=n):s&&(h=h.mod(e))}return s?c:(a&&(c=u.div(c)),e?c.mod(e):n?M(c,x,_,void 0):c)},d.integerValue=function(t){var e=new C(this);return null==t?t=_:Tt(t,0,8),M(e,e.e+1,t)},d.isEqualTo=d.eq=function(t,e){return 0===zt(this,new C(t,e))},d.isFinite=function(){return!!this.c},d.isGreaterThan=d.gt=function(t,e){return zt(this,new C(t,e))>0},d.isGreaterThanOrEqualTo=d.gte=function(t,e){return 1===(e=zt(this,new C(t,e)))||0===e},d.isInteger=function(){return!!this.c&&At(this.e/kt)>this.c.length-2},d.isLessThan=d.lt=function(t,e){return zt(this,new C(t,e))<0},d.isLessThanOrEqualTo=d.lte=function(t,e){return-1===(e=zt(this,new C(t,e)))||0===e},d.isNaN=function(){return!this.s},d.isNegative=function(){return this.s<0},d.isPositive=function(){return this.s>0},d.isZero=function(){return!!this.c&&0==this.c[0]},d.minus=function(t,e){var i,s,o,n,r=this,a=r.s;if(e=(t=new C(t,e)).s,!a||!e)return new C(NaN);if(a!=e)return t.s=-e,r.plus(t);var l=r.e/kt,c=t.e/kt,h=r.c,p=t.c;if(!l||!c){if(!h||!p)return h?(t.s=-e,t):new C(p?r:NaN);if(!h[0]||!p[0])return p[0]?(t.s=-e,t):new C(h[0]?r:3==_?-0:0)}if(l=At(l),c=At(c),h=h.slice(),a=l-c){for((n=a<0)?(a=-a,o=h):(c=l,o=p),o.reverse(),e=a;e--;o.push(0));o.reverse()}else for(s=(n=(a=h.length)<(e=p.length))?a:e,a=e=0;e<s;e++)if(h[e]!=p[e]){n=h[e]<p[e];break}if(n&&(o=h,h=p,p=o,t.s=-t.s),(e=(s=p.length)-(i=h.length))>0)for(;e--;h[i++]=0);for(e=$t-1;s>a;){if(h[--s]<p[s]){for(i=s;i&&!h[--i];h[i]=e);--h[i],h[s]+=$t}h[s]-=p[s]}for(;0==h[0];h.splice(0,1),--c);return h[0]?A(t,h,c):(t.s=3==_?-1:1,t.c=[t.e=0],t)},d.modulo=d.mod=function(t,e){var s,o,n=this;return t=new C(t,e),!n.c||!t.s||t.c&&!t.c[0]?new C(NaN):!t.c||n.c&&!n.c[0]?new C(n):(9==w?(o=t.s,t.s=1,s=i(n,t,0,3),t.s=o,s.s*=o):s=i(n,t,0,w),(t=n.minus(s.times(t))).c[0]||1!=w||(t.s=n.s),t)},d.multipliedBy=d.times=function(t,e){var i,s,o,n,r,a,l,c,h,p,d,u,g,_,m,f=this,v=f.c,b=(t=new C(t,e)).c;if(!(v&&b&&v[0]&&b[0]))return!f.s||!t.s||v&&!v[0]&&!b||b&&!b[0]&&!v?t.c=t.e=t.s=null:(t.s*=f.s,v&&b?(t.c=[0],t.e=0):t.c=t.e=null),t;for(s=At(f.e/kt)+At(t.e/kt),t.s*=f.s,(l=v.length)<(p=b.length)&&(g=v,v=b,b=g,o=l,l=p,p=o),o=l+p,g=[];o--;g.push(0));for(_=$t,m=Et,o=p;--o>=0;){for(i=0,d=b[o]%m,u=b[o]/m|0,n=o+(r=l);n>o;)i=((c=d*(c=v[--r]%m)+(a=u*c+(h=v[r]/m|0)*d)%m*m+g[n]+i)/_|0)+(a/m|0)+u*h,g[n--]=c%_;g[n]=i}return i?++s:g.splice(0,1),A(t,g,s)},d.negated=function(){var t=new C(this);return t.s=-t.s||null,t},d.plus=function(t,e){var i,s=this,o=s.s;if(e=(t=new C(t,e)).s,!o||!e)return new C(NaN);if(o!=e)return t.s=-e,s.minus(t);var n=s.e/kt,r=t.e/kt,a=s.c,l=t.c;if(!n||!r){if(!a||!l)return new C(o/0);if(!a[0]||!l[0])return l[0]?t:new C(a[0]?s:0*o)}if(n=At(n),r=At(r),a=a.slice(),o=n-r){for(o>0?(r=n,i=l):(o=-o,i=a),i.reverse();o--;i.push(0));i.reverse()}for((o=a.length)-(e=l.length)<0&&(i=l,l=a,a=i,e=o),o=0;e;)o=(a[--e]=a[e]+l[e]+o)/$t|0,a[e]=$t===a[e]?0:a[e]%$t;return o&&(a=[o].concat(a),++r),A(t,a,r)},d.precision=d.sd=function(t,e){var i,s,o,n=this;if(null!=t&&t!==!!t)return Tt(t,1,Dt),null==e?e=_:Tt(e,0,8),M(new C(n),t,e);if(!(i=n.c))return null;if(s=(o=i.length-1)*kt+1,o=i[o]){for(;o%10==0;o/=10,s--);for(o=i[0];o>=10;o/=10,s++);}return t&&n.e+1>s&&(s=n.e+1),s},d.shiftedBy=function(t){return Tt(t,-9007199254740991,St),this.times("1e"+t)},d.squareRoot=d.sqrt=function(){var t,e,s,o,n,r=this,a=r.c,l=r.s,c=r.e,h=g+4,p=new C("0.5");if(1!==l||!a||!a[0])return new C(!l||l<0&&(!a||a[0])?NaN:a?r:1/0);if(0==(l=Math.sqrt(+z(r)))||l==1/0?(((e=Mt(a)).length+c)%2==0&&(e+="0"),l=Math.sqrt(+e),c=At((c+1)/2)-(c<0||c%2),s=new C(e=l==1/0?"5e"+c:(e=l.toExponential()).slice(0,e.indexOf("e")+1)+c)):s=new C(l+""),s.c[0])for((l=(c=s.e)+h)<3&&(l=0);;)if(n=s,s=p.times(n.plus(i(r,n,h,1))),Mt(n.c).slice(0,l)===(e=Mt(s.c)).slice(0,l)){if(s.e<c&&--l,"9999"!=(e=e.slice(l-3,l+1))&&(o||"4999"!=e)){+e&&(+e.slice(1)||"5"!=e.charAt(0))||(M(s,s.e+g+2,1),t=!s.times(s).eq(r));break}if(!o&&(M(n,n.e+g+2,0),n.times(n).eq(r))){s=n;break}h+=4,l+=4,o=1}return M(s,s.e+g+1,_,t)},d.toExponential=function(t,e){return null!=t&&(Tt(t,0,Dt),t++),E(this,t,e,1)},d.toFixed=function(t,e){return null!=t&&(Tt(t,0,Dt),t=t+this.e+1),E(this,t,e)},d.toFormat=function(t,e,i){var s,o=this;if(null==i)null!=t&&e&&"object"==typeof e?(i=e,e=null):t&&"object"==typeof t?(i=t,t=e=null):i=$;else if("object"!=typeof i)throw Error(wt+"Argument not an object: "+i);if(s=o.toFixed(t,e),o.c){var n,r=s.split("."),a=+i.groupSize,l=+i.secondaryGroupSize,c=i.groupSeparator||"",h=r[0],p=r[1],d=o.s<0,u=d?h.slice(1):h,g=u.length;if(l&&(n=a,a=l,l=n,g-=n),a>0&&g>0){for(n=g%a||a,h=u.substr(0,n);n<g;n+=a)h+=c+u.substr(n,a);l>0&&(h+=c+u.slice(n)),d&&(h="-"+h)}s=p?h+(i.decimalSeparator||"")+((l=+i.fractionGroupSize)?p.replace(new RegExp("\\d{"+l+"}\\B","g"),"$&"+(i.fractionGroupSeparator||"")):p):h}return(i.prefix||"")+s+(i.suffix||"")},d.toFraction=function(t){var e,s,o,n,r,a,l,c,h,p,d,g,m=this,f=m.c;if(null!=t&&(!(l=new C(t)).isInteger()&&(l.c||1!==l.s)||l.lt(u)))throw Error(wt+"Argument "+(l.isInteger()?"out of range: ":"not an integer: ")+z(l));if(!f)return new C(m);for(e=new C(u),h=s=new C(u),o=c=new C(u),g=Mt(f),r=e.e=g.length-m.e-1,e.c[0]=Ct[(a=r%kt)<0?kt+a:a],t=!t||l.comparedTo(e)>0?r>0?e:h:l,a=b,b=1/0,l=new C(g),c.c[0]=0;p=i(l,e,0,1),1!=(n=s.plus(p.times(o))).comparedTo(t);)s=o,o=n,h=c.plus(p.times(n=h)),c=n,e=l.minus(p.times(n=e)),l=n;return n=i(t.minus(s),o,0,1),c=c.plus(n.times(h)),s=s.plus(n.times(o)),c.s=h.s=m.s,d=i(h,o,r*=2,_).minus(m).abs().comparedTo(i(c,s,r,_).minus(m).abs())<1?[h,o]:[c,s],b=a,d},d.toNumber=function(){return+z(this)},d.toPrecision=function(t,e){return null!=t&&Tt(t,1,Dt),E(this,t,e,2)},d.toString=function(t){var e,i=this,o=i.s,n=i.e;return null===n?o?(e="Infinity",o<0&&(e="-"+e)):e="NaN":(null==t?e=n<=m||n>=f?Pt(Mt(i.c),n):Nt(Mt(i.c),n,"0"):10===t&&S?e=Nt(Mt((i=M(new C(i),g+n+1,_)).c),i.e,"0"):(Tt(t,2,k.length,"Base"),e=s(Nt(Mt(i.c),n,"0"),10,t,o,!0)),o<0&&i.c[0]&&(e="-"+e)),e},d.valueOf=d.toJSON=function(){return z(this)},d._isBigNumber=!0,d[Symbol.toStringTag]="BigNumber",d[Symbol.for("nodejs.util.inspect.custom")]=d.valueOf,null!=e&&C.set(e),C}(),It=class{key;left=null;right=null;constructor(t){this.key=t}},Lt=class extends It{constructor(t){super(t)}},qt=class{size=0;modificationCount=0;splayCount=0;splay(t){const e=this.root;if(null==e)return this.compare(t,t),-1;let i=null,s=null,o=null,n=null,r=e;const a=this.compare;let l;for(;;)if(l=a(r.key,t),l>0){let e=r.left;if(null==e)break;if(l=a(e.key,t),l>0&&(r.left=e.right,e.right=r,r=e,e=r.left,null==e))break;null==i?s=r:i.left=r,i=r,r=e}else{if(!(l<0))break;{let e=r.right;if(null==e)break;if(l=a(e.key,t),l<0&&(r.right=e.left,e.left=r,r=e,e=r.right,null==e))break;null==o?n=r:o.right=r,o=r,r=e}}return null!=o&&(o.right=r.left,r.left=n),null!=i&&(i.left=r.right,r.right=s),this.root!==r&&(this.root=r,this.splayCount++),l}splayMin(t){let e=t,i=e.left;for(;null!=i;){const t=i;e.left=t.right,t.right=e,e=t,i=e.left}return e}splayMax(t){let e=t,i=e.right;for(;null!=i;){const t=i;e.right=t.left,t.left=e,e=t,i=e.right}return e}_delete(t){if(null==this.root)return null;if(0!=this.splay(t))return null;let e=this.root;const i=e,s=e.left;if(this.size--,null==s)this.root=e.right;else{const t=e.right;e=this.splayMax(s),e.right=t,this.root=e}return this.modificationCount++,i}addNewRoot(t,e){this.size++,this.modificationCount++;const i=this.root;null!=i?(e<0?(t.left=i,t.right=i.right,i.right=null):(t.right=i,t.left=i.left,i.left=null),this.root=t):this.root=t}_first(){const t=this.root;return null==t?null:(this.root=this.splayMin(t),this.root)}_last(){const t=this.root;return null==t?null:(this.root=this.splayMax(t),this.root)}clear(){this.root=null,this.size=0,this.modificationCount++}has(t){return this.validKey(t)&&0==this.splay(t)}defaultCompare(){return(t,e)=>t<e?-1:t>e?1:0}wrap(){return{getRoot:()=>this.root,setRoot:t=>{this.root=t},getSize:()=>this.size,getModificationCount:()=>this.modificationCount,getSplayCount:()=>this.splayCount,setSplayCount:t=>{this.splayCount=t},splay:t=>this.splay(t),has:t=>this.has(t)}}},Ut=class t extends qt{root=null;compare;validKey;constructor(t,e){super(),this.compare=t??this.defaultCompare(),this.validKey=e??(t=>null!=t&&null!=t)}delete(t){return!!this.validKey(t)&&null!=this._delete(t)}deleteAll(t){for(const e of t)this.delete(e)}forEach(t){const e=this[Symbol.iterator]();let i;for(;i=e.next(),!i.done;)t(i.value,i.value,this)}add(t){const e=this.splay(t);return 0!=e&&this.addNewRoot(new Lt(t),e),this}addAndReturn(t){const e=this.splay(t);return 0!=e&&this.addNewRoot(new Lt(t),e),this.root.key}addAll(t){for(const e of t)this.add(e)}isEmpty(){return null==this.root}isNotEmpty(){return null!=this.root}single(){if(0==this.size)throw"Bad state: No element";if(this.size>1)throw"Bad state: Too many element";return this.root.key}first(){if(0==this.size)throw"Bad state: No element";return this._first().key}last(){if(0==this.size)throw"Bad state: No element";return this._last().key}lastBefore(t){if(null==t)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(t)<0)return this.root.key;let e=this.root.left;if(null==e)return null;let i=e.right;for(;null!=i;)e=i,i=e.right;return e.key}firstAfter(t){if(null==t)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(t)>0)return this.root.key;let e=this.root.right;if(null==e)return null;let i=e.left;for(;null!=i;)e=i,i=e.left;return e.key}retainAll(e){const i=new t(this.compare,this.validKey),s=this.modificationCount;for(const t of e){if(s!=this.modificationCount)throw"Concurrent modification during iteration.";this.validKey(t)&&0==this.splay(t)&&i.add(this.root.key)}i.size!=this.size&&(this.root=i.root,this.size=i.size,this.modificationCount++)}lookup(t){if(!this.validKey(t))return null;return 0!=this.splay(t)?null:this.root.key}intersection(e){const i=new t(this.compare,this.validKey);for(const t of this)e.has(t)&&i.add(t);return i}difference(e){const i=new t(this.compare,this.validKey);for(const t of this)e.has(t)||i.add(t);return i}union(t){const e=this.clone();return e.addAll(t),e}clone(){const e=new t(this.compare,this.validKey);return e.size=this.size,e.root=this.copyNode(this.root),e}copyNode(t){if(null==t)return null;const e=new Lt(t.key);return function t(e,i){let s,o;do{if(s=e.left,o=e.right,null!=s){const e=new Lt(s.key);i.left=e,t(s,e)}if(null!=o){const t=new Lt(o.key);i.right=t,e=o,i=t}}while(null!=o)}(t,e),e}toSet(){return this.clone()}entries(){return new Ht(this.wrap())}keys(){return this[Symbol.iterator]()}values(){return this[Symbol.iterator]()}[Symbol.iterator](){return new Ft(this.wrap())}[Symbol.toStringTag]="[object Set]"},Bt=class{tree;path=new Array;modificationCount=null;splayCount;constructor(t){this.tree=t,this.splayCount=t.getSplayCount()}[Symbol.iterator](){return this}next(){return this.moveNext()?{done:!1,value:this.current()}:{done:!0,value:null}}current(){if(!this.path.length)return null;const t=this.path[this.path.length-1];return this.getValue(t)}rebuildPath(t){this.path.splice(0,this.path.length),this.tree.splay(t),this.path.push(this.tree.getRoot()),this.splayCount=this.tree.getSplayCount()}findLeftMostDescendent(t){for(;null!=t;)this.path.push(t),t=t.left}moveNext(){if(this.modificationCount!=this.tree.getModificationCount()){if(null==this.modificationCount){this.modificationCount=this.tree.getModificationCount();let t=this.tree.getRoot();for(;null!=t;)this.path.push(t),t=t.left;return this.path.length>0}throw"Concurrent modification during iteration."}if(!this.path.length)return!1;this.splayCount!=this.tree.getSplayCount()&&this.rebuildPath(this.path[this.path.length-1].key);let t=this.path[this.path.length-1],e=t.right;if(null!=e){for(;null!=e;)this.path.push(e),e=e.left;return!0}for(this.path.pop();this.path.length&&this.path[this.path.length-1].right===t;)t=this.path.pop();return this.path.length>0}},Ft=class extends Bt{getValue(t){return t.key}},Ht=class extends Bt{getValue(t){return[t.key,t.key]}},jt=t=>()=>t,Gt=t=>{const e=t?(e,i)=>i.minus(e).abs().isLessThanOrEqualTo(t):jt(!1);return(t,i)=>e(t,i)?0:t.comparedTo(i)};function Wt(t){const e=t?(e,i,s,o,n)=>e.exponentiatedBy(2).isLessThanOrEqualTo(o.minus(i).exponentiatedBy(2).plus(n.minus(s).exponentiatedBy(2)).times(t)):jt(!1);return(t,i,s)=>{const o=t.x,n=t.y,r=s.x,a=s.y,l=n.minus(a).times(i.x.minus(r)).minus(o.minus(r).times(i.y.minus(a)));return e(l,o,n,r,a)?0:l.comparedTo(0)}}var Vt=t=>t,Kt=t=>{if(t){const e=new Ut(Gt(t)),i=new Ut(Gt(t)),s=(t,e)=>e.addAndReturn(t),o=t=>({x:s(t.x,e),y:s(t.y,i)});return o({x:new Ot(0),y:new Ot(0)}),o}return Vt},Zt=t=>({set:t=>{Yt=Zt(t)},reset:()=>Zt(t),compare:Gt(t),snap:Kt(t),orient:Wt(t)}),Yt=Zt(),Jt=(t,e)=>t.ll.x.isLessThanOrEqualTo(e.x)&&e.x.isLessThanOrEqualTo(t.ur.x)&&t.ll.y.isLessThanOrEqualTo(e.y)&&e.y.isLessThanOrEqualTo(t.ur.y),Xt=(t,e)=>{if(e.ur.x.isLessThan(t.ll.x)||t.ur.x.isLessThan(e.ll.x)||e.ur.y.isLessThan(t.ll.y)||t.ur.y.isLessThan(e.ll.y))return null;const i=t.ll.x.isLessThan(e.ll.x)?e.ll.x:t.ll.x,s=t.ur.x.isLessThan(e.ur.x)?t.ur.x:e.ur.x;return{ll:{x:i,y:t.ll.y.isLessThan(e.ll.y)?e.ll.y:t.ll.y},ur:{x:s,y:t.ur.y.isLessThan(e.ur.y)?t.ur.y:e.ur.y}}},Qt=(t,e)=>t.x.times(e.y).minus(t.y.times(e.x)),te=(t,e)=>t.x.times(e.x).plus(t.y.times(e.y)),ee=t=>te(t,t).sqrt(),ie=(t,e,i)=>{const s={x:e.x.minus(t.x),y:e.y.minus(t.y)},o={x:i.x.minus(t.x),y:i.y.minus(t.y)};return Qt(o,s).div(ee(o)).div(ee(s))},se=(t,e,i)=>{const s={x:e.x.minus(t.x),y:e.y.minus(t.y)},o={x:i.x.minus(t.x),y:i.y.minus(t.y)};return te(o,s).div(ee(o)).div(ee(s))},oe=(t,e,i)=>e.y.isZero()?null:{x:t.x.plus(e.x.div(e.y).times(i.minus(t.y))),y:i},ne=(t,e,i)=>e.x.isZero()?null:{x:i,y:t.y.plus(e.y.div(e.x).times(i.minus(t.x)))},re=class t{point;isLeft;segment;otherSE;consumedBy;static compare(e,i){const s=t.comparePoints(e.point,i.point);return 0!==s?s:(e.point!==i.point&&e.link(i),e.isLeft!==i.isLeft?e.isLeft?1:-1:ge.compare(e.segment,i.segment))}static comparePoints(t,e){return t.x.isLessThan(e.x)?-1:t.x.isGreaterThan(e.x)?1:t.y.isLessThan(e.y)?-1:t.y.isGreaterThan(e.y)?1:0}constructor(t,e){void 0===t.events?t.events=[this]:t.events.push(this),this.point=t,this.isLeft=e}link(t){if(t.point===this.point)throw new Error("Tried to link already linked events");const e=t.point.events;for(let t=0,i=e.length;t<i;t++){const i=e[t];this.point.events.push(i),i.point=this.point}this.checkForConsuming()}checkForConsuming(){const t=this.point.events.length;for(let e=0;e<t;e++){const i=this.point.events[e];if(void 0===i.segment.consumedBy)for(let s=e+1;s<t;s++){const t=this.point.events[s];void 0===t.consumedBy&&(i.otherSE.point.events===t.otherSE.point.events&&i.segment.consume(t.segment))}}}getAvailableLinkedEvents(){const t=[];for(let e=0,i=this.point.events.length;e<i;e++){const i=this.point.events[e];i!==this&&!i.segment.ringOut&&i.segment.isInResult()&&t.push(i)}return t}getLeftmostComparator(t){const e=new Map,i=i=>{const s=i.otherSE;e.set(i,{sine:ie(this.point,t.point,s.point),cosine:se(this.point,t.point,s.point)})};return(t,s)=>{e.has(t)||i(t),e.has(s)||i(s);const{sine:o,cosine:n}=e.get(t),{sine:r,cosine:a}=e.get(s);return o.isGreaterThanOrEqualTo(0)&&r.isGreaterThanOrEqualTo(0)?n.isLessThan(a)?1:n.isGreaterThan(a)?-1:0:o.isLessThan(0)&&r.isLessThan(0)?n.isLessThan(a)?-1:n.isGreaterThan(a)?1:0:r.isLessThan(o)?-1:r.isGreaterThan(o)?1:0}}},ae=class t{events;poly;_isExteriorRing;_enclosingRing;static factory(e){const i=[];for(let s=0,o=e.length;s<o;s++){const o=e[s];if(!o.isInResult()||o.ringOut)continue;let n=null,r=o.leftSE,a=o.rightSE;const l=[r],c=r.point,h=[];for(;n=r,r=a,l.push(r),r.point!==c;)for(;;){const e=r.getAvailableLinkedEvents();if(0===e.length){const t=l[0].point,e=l[l.length-1].point;throw new Error(`Unable to complete output ring starting at [${t.x}, ${t.y}]. Last matching segment found ends at [${e.x}, ${e.y}].`)}if(1===e.length){a=e[0].otherSE;break}let s=null;for(let t=0,e=h.length;t<e;t++)if(h[t].point===r.point){s=t;break}if(null!==s){const e=h.splice(s)[0],o=l.splice(e.index);o.unshift(o[0].otherSE),i.push(new t(o.reverse()));continue}h.push({index:l.length,point:r.point});const o=r.getLeftmostComparator(n);a=e.sort(o)[0].otherSE;break}i.push(new t(l))}return i}constructor(t){this.events=t;for(let e=0,i=t.length;e<i;e++)t[e].segment.ringOut=this;this.poly=null}getGeom(){let t=this.events[0].point;const e=[t];for(let i=1,s=this.events.length-1;i<s;i++){const s=this.events[i].point,o=this.events[i+1].point;0!==Yt.orient(s,t,o)&&(e.push(s),t=s)}if(1===e.length)return null;const i=e[0],s=e[1];0===Yt.orient(i,t,s)&&e.shift(),e.push(e[0]);const o=this.isExteriorRing()?1:-1,n=this.isExteriorRing()?0:e.length-1,r=this.isExteriorRing()?e.length:-1,a=[];for(let t=n;t!=r;t+=o)a.push([e[t].x.toNumber(),e[t].y.toNumber()]);return a}isExteriorRing(){if(void 0===this._isExteriorRing){const t=this.enclosingRing();this._isExteriorRing=!t||!t.isExteriorRing()}return this._isExteriorRing}enclosingRing(){return void 0===this._enclosingRing&&(this._enclosingRing=this._calcEnclosingRing()),this._enclosingRing}_calcEnclosingRing(){let t=this.events[0];for(let e=1,i=this.events.length;e<i;e++){const i=this.events[e];re.compare(t,i)>0&&(t=i)}let e=t.segment.prevInResult(),i=e?e.prevInResult():null;for(;;){if(!e)return null;if(!i)return e.ringOut;if(i.ringOut!==e.ringOut)return i.ringOut?.enclosingRing()!==e.ringOut?e.ringOut:e.ringOut?.enclosingRing();e=i.prevInResult(),i=e?e.prevInResult():null}}},le=class{exteriorRing;interiorRings;constructor(t){this.exteriorRing=t,t.poly=this,this.interiorRings=[]}addInterior(t){this.interiorRings.push(t),t.poly=this}getGeom(){const t=this.exteriorRing.getGeom();if(null===t)return null;const e=[t];for(let t=0,i=this.interiorRings.length;t<i;t++){const i=this.interiorRings[t].getGeom();null!==i&&e.push(i)}return e}},ce=class{rings;polys;constructor(t){this.rings=t,this.polys=this._composePolys(t)}getGeom(){const t=[];for(let e=0,i=this.polys.length;e<i;e++){const i=this.polys[e].getGeom();null!==i&&t.push(i)}return t}_composePolys(t){const e=[];for(let i=0,s=t.length;i<s;i++){const s=t[i];if(!s.poly)if(s.isExteriorRing())e.push(new le(s));else{const t=s.enclosingRing();t?.poly||e.push(new le(t)),t?.poly?.addInterior(s)}}return e}},he=class{queue;tree;segments;constructor(t,e=ge.compare){this.queue=t,this.tree=new Ut(e),this.segments=[]}process(t){const e=t.segment,i=[];if(t.consumedBy)return t.isLeft?this.queue.delete(t.otherSE):this.tree.delete(e),i;t.isLeft&&this.tree.add(e);let s=e,o=e;do{s=this.tree.lastBefore(s)}while(null!=s&&null!=s.consumedBy);do{o=this.tree.firstAfter(o)}while(null!=o&&null!=o.consumedBy);if(t.isLeft){let n=null;if(s){const t=s.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(n=t),!s.isAnEndpoint(t))){const e=this._splitSafely(s,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}let r=null;if(o){const t=o.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(r=t),!o.isAnEndpoint(t))){const e=this._splitSafely(o,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}if(null!==n||null!==r){let t=null;if(null===n)t=r;else if(null===r)t=n;else{t=re.comparePoints(n,r)<=0?n:r}this.queue.delete(e.rightSE),i.push(e.rightSE);const s=e.split(t);for(let t=0,e=s.length;t<e;t++)i.push(s[t])}i.length>0?(this.tree.delete(e),i.push(t)):(this.segments.push(e),e.prev=s)}else{if(s&&o){const t=s.getIntersection(o);if(null!==t){if(!s.isAnEndpoint(t)){const e=this._splitSafely(s,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}if(!o.isAnEndpoint(t)){const e=this._splitSafely(o,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}}this.tree.delete(e)}return i}_splitSafely(t,e){this.tree.delete(t);const i=t.rightSE;this.queue.delete(i);const s=t.split(e);return s.push(i),void 0===t.consumedBy&&this.tree.add(t),s}},pe=new class{type;numMultiPolys;run(t,e,i){pe.type=t;const s=[new fe(e,!0)];for(let t=0,e=i.length;t<e;t++)s.push(new fe(i[t],!1));if(pe.numMultiPolys=s.length,"difference"===pe.type){const t=s[0];let e=1;for(;e<s.length;)null!==Xt(s[e].bbox,t.bbox)?e++:s.splice(e,1)}if("intersection"===pe.type)for(let t=0,e=s.length;t<e;t++){const e=s[t];for(let i=t+1,o=s.length;i<o;i++)if(null===Xt(e.bbox,s[i].bbox))return[]}const o=new Ut(re.compare);for(let t=0,e=s.length;t<e;t++){const e=s[t].getSweepEvents();for(let t=0,i=e.length;t<i;t++)o.add(e[t])}const n=new he(o);let r=null;for(0!=o.size&&(r=o.first(),o.delete(r));r;){const t=n.process(r);for(let e=0,i=t.length;e<i;e++){const i=t[e];void 0===i.consumedBy&&o.add(i)}0!=o.size?(r=o.first(),o.delete(r)):r=null}Yt.reset();const a=ae.factory(n.segments);return new ce(a).getGeom()}},de=pe,ue=0,ge=class t{id;leftSE;rightSE;rings;windings;ringOut;consumedBy;prev;_prevInResult;_beforeState;_afterState;_isInResult;static compare(t,e){const i=t.leftSE.point.x,s=e.leftSE.point.x,o=t.rightSE.point.x,n=e.rightSE.point.x;if(n.isLessThan(i))return 1;if(o.isLessThan(s))return-1;const r=t.leftSE.point.y,a=e.leftSE.point.y,l=t.rightSE.point.y,c=e.rightSE.point.y;if(i.isLessThan(s)){if(a.isLessThan(r)&&a.isLessThan(l))return 1;if(a.isGreaterThan(r)&&a.isGreaterThan(l))return-1;const i=t.comparePoint(e.leftSE.point);if(i<0)return 1;if(i>0)return-1;const s=e.comparePoint(t.rightSE.point);return 0!==s?s:-1}if(i.isGreaterThan(s)){if(r.isLessThan(a)&&r.isLessThan(c))return-1;if(r.isGreaterThan(a)&&r.isGreaterThan(c))return 1;const i=e.comparePoint(t.leftSE.point);if(0!==i)return i;const s=t.comparePoint(e.rightSE.point);return s<0?1:s>0?-1:1}if(r.isLessThan(a))return-1;if(r.isGreaterThan(a))return 1;if(o.isLessThan(n)){const i=e.comparePoint(t.rightSE.point);if(0!==i)return i}if(o.isGreaterThan(n)){const i=t.comparePoint(e.rightSE.point);if(i<0)return 1;if(i>0)return-1}if(!o.eq(n)){const t=l.minus(r),e=o.minus(i),h=c.minus(a),p=n.minus(s);if(t.isGreaterThan(e)&&h.isLessThan(p))return 1;if(t.isLessThan(e)&&h.isGreaterThan(p))return-1}return o.isGreaterThan(n)?1:o.isLessThan(n)||l.isLessThan(c)?-1:l.isGreaterThan(c)?1:t.id<e.id?-1:t.id>e.id?1:0}constructor(t,e,i,s){this.id=++ue,this.leftSE=t,t.segment=this,t.otherSE=e,this.rightSE=e,e.segment=this,e.otherSE=t,this.rings=i,this.windings=s}static fromRing(e,i,s){let o,n,r;const a=re.comparePoints(e,i);if(a<0)o=e,n=i,r=1;else{if(!(a>0))throw new Error(`Tried to create degenerate segment at [${e.x}, ${e.y}]`);o=i,n=e,r=-1}const l=new re(o,!0),c=new re(n,!1);return new t(l,c,[s],[r])}replaceRightSE(t){this.rightSE=t,this.rightSE.segment=this,this.rightSE.otherSE=this.leftSE,this.leftSE.otherSE=this.rightSE}bbox(){const t=this.leftSE.point.y,e=this.rightSE.point.y;return{ll:{x:this.leftSE.point.x,y:t.isLessThan(e)?t:e},ur:{x:this.rightSE.point.x,y:t.isGreaterThan(e)?t:e}}}vector(){return{x:this.rightSE.point.x.minus(this.leftSE.point.x),y:this.rightSE.point.y.minus(this.leftSE.point.y)}}isAnEndpoint(t){return t.x.eq(this.leftSE.point.x)&&t.y.eq(this.leftSE.point.y)||t.x.eq(this.rightSE.point.x)&&t.y.eq(this.rightSE.point.y)}comparePoint(t){return Yt.orient(this.leftSE.point,t,this.rightSE.point)}getIntersection(t){const e=this.bbox(),i=t.bbox(),s=Xt(e,i);if(null===s)return null;const o=this.leftSE.point,n=this.rightSE.point,r=t.leftSE.point,a=t.rightSE.point,l=Jt(e,r)&&0===this.comparePoint(r),c=Jt(i,o)&&0===t.comparePoint(o),h=Jt(e,a)&&0===this.comparePoint(a),p=Jt(i,n)&&0===t.comparePoint(n);if(c&&l)return p&&!h?n:!p&&h?a:null;if(c)return h&&o.x.eq(a.x)&&o.y.eq(a.y)?null:o;if(l)return p&&n.x.eq(r.x)&&n.y.eq(r.y)?null:r;if(p&&h)return null;if(p)return n;if(h)return a;const d=((t,e,i,s)=>{if(e.x.isZero())return ne(i,s,t.x);if(s.x.isZero())return ne(t,e,i.x);if(e.y.isZero())return oe(i,s,t.y);if(s.y.isZero())return oe(t,e,i.y);const o=Qt(e,s);if(o.isZero())return null;const n={x:i.x.minus(t.x),y:i.y.minus(t.y)},r=Qt(n,e).div(o),a=Qt(n,s).div(o),l=t.x.plus(a.times(e.x)),c=i.x.plus(r.times(s.x)),h=t.y.plus(a.times(e.y)),p=i.y.plus(r.times(s.y));return{x:l.plus(c).div(2),y:h.plus(p).div(2)}})(o,this.vector(),r,t.vector());return null===d?null:Jt(s,d)?Yt.snap(d):null}split(e){const i=[],s=void 0!==e.events,o=new re(e,!0),n=new re(e,!1),r=this.rightSE;this.replaceRightSE(n),i.push(n),i.push(o);const a=new t(o,r,this.rings.slice(),this.windings.slice());return re.comparePoints(a.leftSE.point,a.rightSE.point)>0&&a.swapEvents(),re.comparePoints(this.leftSE.point,this.rightSE.point)>0&&this.swapEvents(),s&&(o.checkForConsuming(),n.checkForConsuming()),i}swapEvents(){const t=this.rightSE;this.rightSE=this.leftSE,this.leftSE=t,this.leftSE.isLeft=!0,this.rightSE.isLeft=!1;for(let t=0,e=this.windings.length;t<e;t++)this.windings[t]*=-1}consume(e){let i=this,s=e;for(;i.consumedBy;)i=i.consumedBy;for(;s.consumedBy;)s=s.consumedBy;const o=t.compare(i,s);if(0!==o){if(o>0){const t=i;i=s,s=t}if(i.prev===s){const t=i;i=s,s=t}for(let t=0,e=s.rings.length;t<e;t++){const e=s.rings[t],o=s.windings[t],n=i.rings.indexOf(e);-1===n?(i.rings.push(e),i.windings.push(o)):i.windings[n]+=o}s.rings=null,s.windings=null,s.consumedBy=i,s.leftSE.consumedBy=i.leftSE,s.rightSE.consumedBy=i.rightSE}}prevInResult(){return void 0!==this._prevInResult||(this.prev?this.prev.isInResult()?this._prevInResult=this.prev:this._prevInResult=this.prev.prevInResult():this._prevInResult=null),this._prevInResult}beforeState(){if(void 0!==this._beforeState)return this._beforeState;if(this.prev){const t=this.prev.consumedBy||this.prev;this._beforeState=t.afterState()}else this._beforeState={rings:[],windings:[],multiPolys:[]};return this._beforeState}afterState(){if(void 0!==this._afterState)return this._afterState;const t=this.beforeState();this._afterState={rings:t.rings.slice(0),windings:t.windings.slice(0),multiPolys:[]};const e=this._afterState.rings,i=this._afterState.windings,s=this._afterState.multiPolys;for(let t=0,s=this.rings.length;t<s;t++){const s=this.rings[t],o=this.windings[t],n=e.indexOf(s);-1===n?(e.push(s),i.push(o)):i[n]+=o}const o=[],n=[];for(let t=0,s=e.length;t<s;t++){if(0===i[t])continue;const s=e[t],r=s.poly;if(-1===n.indexOf(r))if(s.isExterior)o.push(r);else{-1===n.indexOf(r)&&n.push(r);const t=o.indexOf(s.poly);-1!==t&&o.splice(t,1)}}for(let t=0,e=o.length;t<e;t++){const e=o[t].multiPoly;-1===s.indexOf(e)&&s.push(e)}return this._afterState}isInResult(){if(this.consumedBy)return!1;if(void 0!==this._isInResult)return this._isInResult;const t=this.beforeState().multiPolys,e=this.afterState().multiPolys;switch(de.type){case"union":{const i=0===t.length,s=0===e.length;this._isInResult=i!==s;break}case"intersection":{let i,s;t.length<e.length?(i=t.length,s=e.length):(i=e.length,s=t.length),this._isInResult=s===de.numMultiPolys&&i<s;break}case"xor":{const i=Math.abs(t.length-e.length);this._isInResult=i%2==1;break}case"difference":{const i=t=>1===t.length&&t[0].isSubject;this._isInResult=i(t)!==i(e);break}}return this._isInResult}},_e=class{poly;isExterior;segments;bbox;constructor(t,e,i){if(!Array.isArray(t)||0===t.length)throw new Error("Input geometry is not a valid Polygon or MultiPolygon");if(this.poly=e,this.isExterior=i,this.segments=[],"number"!=typeof t[0][0]||"number"!=typeof t[0][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const s=Yt.snap({x:new Ot(t[0][0]),y:new Ot(t[0][1])});this.bbox={ll:{x:s.x,y:s.y},ur:{x:s.x,y:s.y}};let o=s;for(let e=1,i=t.length;e<i;e++){if("number"!=typeof t[e][0]||"number"!=typeof t[e][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const i=Yt.snap({x:new Ot(t[e][0]),y:new Ot(t[e][1])});i.x.eq(o.x)&&i.y.eq(o.y)||(this.segments.push(ge.fromRing(o,i,this)),i.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.x),i.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.y),i.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.x),i.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.y),o=i)}s.x.eq(o.x)&&s.y.eq(o.y)||this.segments.push(ge.fromRing(o,s,this))}getSweepEvents(){const t=[];for(let e=0,i=this.segments.length;e<i;e++){const i=this.segments[e];t.push(i.leftSE),t.push(i.rightSE)}return t}},me=class{multiPoly;exteriorRing;interiorRings;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");this.exteriorRing=new _e(t[0],this,!0),this.bbox={ll:{x:this.exteriorRing.bbox.ll.x,y:this.exteriorRing.bbox.ll.y},ur:{x:this.exteriorRing.bbox.ur.x,y:this.exteriorRing.bbox.ur.y}},this.interiorRings=[];for(let e=1,i=t.length;e<i;e++){const i=new _e(t[e],this,!1);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.interiorRings.push(i)}this.multiPoly=e}getSweepEvents(){const t=this.exteriorRing.getSweepEvents();for(let e=0,i=this.interiorRings.length;e<i;e++){const i=this.interiorRings[e].getSweepEvents();for(let e=0,s=i.length;e<s;e++)t.push(i[e])}return t}},fe=class{isSubject;polys;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");try{"number"==typeof t[0][0][0]&&(t=[t])}catch(t){}this.polys=[],this.bbox={ll:{x:new Ot(Number.POSITIVE_INFINITY),y:new Ot(Number.POSITIVE_INFINITY)},ur:{x:new Ot(Number.NEGATIVE_INFINITY),y:new Ot(Number.NEGATIVE_INFINITY)}};for(let e=0,i=t.length;e<i;e++){const i=new me(t[e],this);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.polys.push(i)}this.isSubject=e}getSweepEvents(){const t=[];for(let e=0,i=this.polys.length;e<i;e++){const i=this.polys[e].getSweepEvents();for(let e=0,s=i.length;e<s;e++)t.push(i[e])}return t}};function ve(t){const e=Math.max(0,Math.min(120,(t-40)/140*120));return`hsl(${Math.round(e)}, 85%, 55%)`}function be(t,e){return Math.round(t/e)*e}function ye(t,e,i=1){const[s,o]=t[0]<e[0]||t[0]===e[0]&&t[1]<=e[1]?[t,e]:[e,t];return`${s[0].toFixed(i)},${s[1].toFixed(i)}-${o[0].toFixed(i)},${o[1].toFixed(i)}`}function we(t){return t?.poly?.length>=3?t.poly:t&&null!=t.x&&null!=t.y&&null!=t.w&&null!=t.h?[[t.x,t.y],[t.x+t.w,t.y],[t.x+t.w,t.y+t.h],[t.x,t.y+t.h]]:null}function xe(t){const e=[],i=new Set;for(const s of t||[]){const t=we(s);if(t)for(let s=0;s<t.length;s++){const o=t[s],n=t[(s+1)%t.length],r=ye(o,n,5);i.has(r)||(i.add(r),e.push([o[0],o[1],n[0],n[1]]))}}return e}function $e(t,e,i){let s=null,o=i;for(const i of xe(e)){const[e,n,r,a]=i,l=r-e,c=a-n,h=l*l+c*c;if(!h)continue;let p=((t[0]-e)*l+(t[1]-n)*c)/h;p=Math.max(0,Math.min(1,p));const d=[e+p*l,n+p*c],u=Math.hypot(t[0]-d[0],t[1]-d[1]);if(u<o){o=u;let t=180*Math.atan2(c,l)/Math.PI;t>=90?t-=180:t<-90&&(t+=180),s={x:d[0],y:d[1],angle:t}}}return s}function ke(t){return["on","open","home","detected","playing","cleaning"].includes(String(t))}function Se(t,e,i=.001){return Math.abs(t[0]-e[0])<i&&Math.abs(t[1]-e[1])<i}function Ce(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const[n,r]=e[s],[a,l]=e[o];r>t[1]!=l>t[1]&&t[0]<(a-n)*(t[1]-r)/(l-r)+n&&(i=!i)}return i}function Ee(t,e,i){const s=i[0]-e[0],o=i[1]-e[1],n=s*s+o*o;let r=n?((t[0]-e[0])*s+(t[1]-e[1])*o)/n:0;return r=Math.max(0,Math.min(1,r)),Math.hypot(t[0]-(e[0]+r*s),t[1]-(e[1]+r*o))}function De(t,e,i=1e-6){if(!e||e.length<2)return!1;for(let s=0;s<e.length;s++)if(Ee(t,e[s],e[(s+1)%e.length])<=i)return!0;return!1}function Ae(t,e,i=1e-6){return!(!e||e.length<3)&&(!De(t,e,i)&&Ce(t,e))}function Me(t,e,i){return(e[0]-t[0])*(i[1]-t[1])-(e[1]-t[1])*(i[0]-t[0])}function ze(t,e,i,s,o=1e-9){const n=Me(i,s,t),r=Me(i,s,e),a=Me(t,e,i),l=Me(t,e,s);return(n>o&&r<-o||n<-o&&r>o)&&(a>o&&l<-o||a<-o&&l>o)}function Te(t,e,i){let s=!0;for(const o of t){if(Ae(o,e,i))return!0;De(o,e,i)||(s=!1)}if(s){const s=[t.reduce((t,e)=>t+e[0],0)/t.length,t.reduce((t,e)=>t+e[1],0)/t.length];return Ae(s,e,i)}return!1}function Re(t){if(!t||t.length<3)return 0;let e=0;for(let i=0;i<t.length;i++){const s=t[i],o=t[(i+1)%t.length];e+=s[0]*o[1]-o[0]*s[1]}return Math.abs(e)/2}function Pe(t){return[[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]]}function Ne(t,e){if(!t||!e||t.length<3||e.length<3)return null;const i=((t,...e)=>de.run("union",t,e))(Pe(t),Pe(e));if(1!==i.length)return null;if(1!==i[0].length)return null;const s=i[0][0].slice(0,-1).map(t=>[t[0],t[1]]);return s.length>=3?s:null}function Oe(t,e,i){for(let s=0;s<t.length;s++)if(Ee(e,t[s],t[(s+1)%t.length])<=i)return s;return-1}function Ie(t,e,i,s=1e-6){if(!t||t.length<3||Se(e,i,s))return null;const o=Oe(t,e,s),n=Oe(t,i,s);if(o<0||n<0)return null;for(let s=0;s<t.length;s++)if(ze(e,i,t[s],t[(s+1)%t.length]))return null;if(!Ae([(e[0]+i[0])/2,(e[1]+i[1])/2],t,s))return null;const r=(e,i,o,n)=>{const r=[e];let a=(i+1)%t.length;for(let e=0;e<=t.length&&(r.push(t[a]),a!==n);e++)a=(a+1)%t.length;return r.push(o),function(t,e){const i=[];for(const s of t)i.length&&Se(i[i.length-1],s,e)||i.push(s);return i.length>1&&Se(i[0],i[i.length-1],e)&&i.pop(),i}(r,s)},a=r(e,o,i,n),l=r(i,n,e,o);return a.length<3||l.length<3||Re(a)<=s||Re(l)<=s?null:[a,l]}function Le(t){return t.length?Math.round(t.reduce((t,e)=>t+e,0)/t.length):null}function qe(t,e){if(e>t[2]/t[3]){const i=t[3],s=t[3]*e;return{x:t[0]-(s-t[2])/2,y:t[1],w:s,h:i}}const i=t[2],s=t[2]/e;return{x:t[0],y:t[1]-(s-t[3])/2,w:i,h:s}}function Ue(t,e,i,s){if(t.length<2)return;const o=e.x+s,n=e.x+e.w-s,r=e.y+s,a=e.y+e.h-s;for(let e=0;e<60;e++){let e=!1;for(let s=0;s<t.length;s++)for(let o=s+1;o<t.length;o++){const n=t[o].x-t[s].x,r=t[o].y-t[s].y,a=Math.hypot(n,r)||.001;if(a<i){const l=(i-a)/2,c=n/a,h=r/a;t[s].x-=c*l,t[s].y-=h*l,t[o].x+=c*l,t[o].y+=h*l,e=!0}}for(const e of t)e.x=Math.max(o,Math.min(n,e.x)),e.y=Math.max(r,Math.min(a,e.y));if(!e)break}}function Be(t){if(!t)return null;const e=t.trim();return/^(https?:)?\/\//i.test(e)||e.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(e)?/^[a-z][\w+.-]*:/i.test(e)&&!/^https?:/i.test(e)?null:e:null}Yt.set;const Fe=new Set(["light","switch","fan","humidifier"]),He=new Set(["lock","alarm_control_panel"]);const je="#3ea6ff",Ge=.55;function We(t){const e=t?.settings||{},i=!t?.plan_url;return{showBorders:e.show_borders??i,showNames:e.show_names??i,color:"string"==typeof e.room_color&&/^#[0-9a-f]{6}$/i.test(e.room_color)?e.room_color:je,opacity:"number"==typeof e.room_opacity?Math.min(1,Math.max(0,e.room_opacity)):Ge,fill:["lqi","light","temp"].includes(e.fill_mode)?e.fill_mode:"none",tempMin:"number"==typeof e.temp_min?e.temp_min:20,tempMax:"number"==typeof e.temp_max?e.temp_max:25,showLqi:"boolean"==typeof e.show_lqi?e.show_lqi:null}}const Ve={light_on:{c:"#ffd45c",a:.18},light_off:{c:"#9aa0a6",a:.14},light_none:{c:"#6b7480",a:0},temp_cold:{c:"#4fc3f7",a:.18},temp_ok:{c:"#66d17a",a:.18},temp_hot:{c:"#ffd45c",a:.18},lqi_low:{c:"#f25a4a",a:.18},lqi_high:{c:"#4bd28f",a:.18}},Ke=/^#[0-9a-f]{6}$/i;function Ze(t){const e={},i=t?.fill_colors||{};for(const t of Object.keys(Ve)){const s=Ve[t],o=i[t];e[t]={c:o&&"string"==typeof o.c&&Ke.test(o.c)?o.c:s.c,a:o&&"number"==typeof o.a?Math.min(1,Math.max(0,o.a)):s.a}}return e}function Ye(t,e,i){const s=Math.min(1,Math.max(0,i)),o=[1,3,5].map(e=>parseInt(t.slice(e,e+2),16)),n=[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),r=o.map((t,e)=>Math.round(t+(n[e]-t)*s));return"#"+r.map(t=>t.toString(16).padStart(2,"0")).join("")}function Je(t,e,i,s,o,n,r){if("lqi"===t){if(null==e)return null;const t=(e-40)/140;return{c:Ye(r.lqi_low.c,r.lqi_high.c,t),a:r.lqi_low.a+(r.lqi_high.a-r.lqi_low.a)*Math.min(1,Math.max(0,t))}}if("light"===t)return"none"===i?r.light_none.a>0?r.light_none:null:"on"===i?r.light_on:r.light_off;if("temp"===t){if(null==s)return null;const t=Math.min(o,n),e=Math.max(o,n);return s<t?r.temp_cold:s>e?r.temp_hot:r.temp_ok}return null}const Xe=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);function Qe(t,e,i){if(e.identifiers?.[0]?.[0])return e.identifiers[0][0];for(const e of i){const i=t.entities[e]?.platform;if(i)return i}return""}function ti(t,e){if(/_device_temperature$/.test(e))return!1;if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_temperature$/.test(e);const s=i.attributes||{};return"temperature"===s.device_class||/°C|°F/.test(s.unit_of_measurement||"")||/_temperature$/.test(e)}function ei(t,e,i){const s=e.map(e=>({eid:e,reg:t.entities[e],st:t.states[e]})).filter(t=>t.reg&&!t.reg.hidden),o=s.filter(t=>!t.reg.entity_category),n=o.length?o:s;if("mdi:thermometer"===i||"mdi:air-filter"===i){const e=n.find(e=>ti(t,e.eid));if(e)return e.eid}for(const t of ft){const e=n.find(e=>e.eid.split(".")[0]===t);if(e)return e.eid}return n[0]?.eid}function ii(t,e){const i=[];for(const s of e){const e=t.states[s];if(!e)continue;const o=(e.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(s)||"lqi"===o){const t=parseFloat(e.state);isNaN(t)||i.push(t);continue}const n=e.attributes?.linkquality??e.attributes?.lqi;if(null!=n){const t=parseFloat(n);isNaN(t)||i.push(t)}}return Le(i)}function si(t,e){for(const i of e){if(!ti(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(10*s)/10}return null}function oi(t,e){if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_humidity$/.test(e);const s=i.attributes||{};return"humidity"===s.device_class||"%"===s.unit_of_measurement&&/_humidity$/.test(e)||/_humidity$/.test(e)}function ni(t,e){for(const i of e){if(!oi(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(s)}return null}function ri(t,e,i,s,o){const n=mt(e,i,o);if(n!==_t)return n;const r=[];for(const e of s){const i=t.states[e]?.attributes?.device_class;i&&r.push(i)}return function(t){for(const e of t){const t=gt[e];if(t)return t}return null}(r)??_t}function ai(t,e){t.marker=e,e.name&&(t.name=e.name),e.icon&&(t.icon=e.icon),null!=e.model&&(t.model=e.model),t.link=e.link??null,t.description=e.description??null,t.pdfs=e.pdfs||[],t.tapAction=e.tap_action??null}function li(t){const{hass:e,areaToSpace:i,markers:s,settings:o,excluded:n,showAll:r,firstSpaceId:a,loc:l,iconRules:c}=t,h=!1!==o.group_lights,p=function(t,e){if(!e)return[];const i=[];for(const[e,s]of Object.entries(t.entities)){if(!e.startsWith("light.")||s.hidden)continue;let o=null;if("group"===s.platform)o=s.area_id||null;else{if(!s.device_id)continue;{const e=t.devices[s.device_id];if("Group"!==e?.model)continue;o=e.area_id||s.area_id||null}}if(!o)continue;const n=t.states[e];i.push({eid:e,name:s.name||n?.attributes?.friendly_name||e,area:o})}return i}(e,h),d=new Set(p.map(t=>t.area)),u=function(t){const e={};for(const[i,s]of Object.entries(t.entities))s?.device_id&&(e[s.device_id]=e[s.device_id]||[]).push(i);return e}(e),g=new Set;for(const t of s){const[e,i]=t.binding.split(":");"device"!==e&&"entity"!==e||!i||g.add(t.binding)}const _=(t,e)=>s.find(i=>i.binding===t+":"+e),m={},f=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(g.has("device:"+t.id))continue;const o=_("device",t.id);if(o&&o.hidden)continue;const a=u[t.id]||[],p=Qe(e,t,a);if(!r){if(n.has(p))continue;if("Group"===t.model)continue;if(/scene/i.test(t.model||""))continue;if(/bridge/i.test((t.model||"")+(t.name||"")))continue;if("myheat"===p&&t.via_device_id)continue}const v=(t.name_by_user||t.name||l("device.unnamed")).trim(),b=v+"|"+s;let y=ri(e,v,t.model,a,c);if(a.some(t=>t.startsWith("lock."))&&(y="mdi:lock"),!r&&h&&"mdi:lightbulb"===y&&d.has(s))continue;m[b]=(m[b]||0)+1;const w=m[b]>1?v+" "+m[b]:v,x={id:t.id,name:w,model:t.model||"",area:s,space:i[s],icon:y,entities:a,bindingKind:"device",bindingRef:t.id,pdfs:[]};x.primary=ei(e,a,y),"mdi:thermometer"!==y&&"mdi:air-filter"!==y||(x.temp=si(e,a)),x.primary&&oi(e,x.primary)&&(x.hum=ni(e,a)),f.push(x)}for(const t of p)i[t.area]&&(g.has("entity:"+t.eid)||f.push({id:"lg_"+t.eid,name:t.name,model:l("device.light_group"),area:t.area,space:i[t.area],icon:"mdi:lightbulb-group",entities:[t.eid],primary:t.eid,bindingKind:"entity",bindingRef:t.eid,pdfs:[]}));for(const t of s){if(t.hidden)continue;const[s,o]=t.binding.split(":");if("device"===s){const s=e.devices[o],n=t.area||s?.area_id||"",r=n&&i[n]||t.space||a,h=s&&u[s.id]||[];let p=s?ri(e,s.name_by_user||s.name||"",s.model,h,c):"mdi:help-circle";h.some(t=>t.startsWith("lock."))&&(p="mdi:lock");const d={id:t.id,name:s?.name_by_user||s?.name||l("device.fallback"),model:s?.model||"",area:n,space:r,icon:p,entities:h,bindingKind:"device",bindingRef:o};d.primary=ei(e,h,p),"mdi:thermometer"!==p&&"mdi:air-filter"!==p||(d.temp=si(e,h)),d.primary&&oi(e,d.primary)&&(d.hum=ni(e,h)),d.primary&&oi(e,d.primary)&&(d.hum=ni(e,h)),ai(d,t),f.push(d)}else if("entity"===s){const s=e.entities[o],n=t.area||s?.area_id||s?.device_id&&e.devices[s.device_id]?.area_id||"",r=n&&i[n]||t.space||a,l=e.states[o],h=s?.name||l?.attributes?.friendly_name||o;let p=ri(e,h,"",[o],c);o.startsWith("lock.")&&(p="mdi:lock");const d={id:t.id,name:h,model:"",area:n,space:r,icon:p,entities:[o],primary:o,bindingKind:"entity",bindingRef:o};"mdi:thermometer"!==p&&"mdi:air-filter"!==p||(d.temp=si(e,[o])),oi(e,o)&&(d.hum=ni(e,[o])),ai(d,t),f.push(d)}else{const e=t.area||"",s=t.space||e&&i[e]||a,o={id:t.id,name:t.name||l("device.virtual"),model:t.model||"",area:e,space:s,icon:t.icon||"mdi:map-marker",entities:[],bindingKind:"virtual",virtual:!0};ai(o,t),f.push(o)}}return f}function ci(t,e,i){let s=!1;for(const o of e)if(o.area===i)for(const e of o.entities)if(e.startsWith("light.")&&(s=!0,"on"===t.states[e]?.state))return"on";return s?"off":"none"}function hi(t,e,i){const s=[];for(const o of e){if(o.area!==i)continue;if("mdi:thermometer"!==o.icon&&"mdi:air-filter"!==o.icon)continue;const e=si(t,o.entities);null!=e&&s.push(e)}return s.length?Math.round(s.reduce((t,e)=>t+e,0)/s.length*10)/10:null}var pi={"card.title":"House plan","count.devices":"{n} dev.","empty.no_spaces":"No spaces yet.","empty.add_first":"Add the first space and upload a floor plan.","empty.install":'Install the House Plan integration and add it in "Devices & services".',"btn.add_space":"Add space","btn.cancel":"Cancel","btn.save":"Save","btn.close":"Close","btn.delete":"Delete","btn.remove":"Remove","btn.edit":"Edit","btn.open_in_ha":"Open in HA","btn.reset":"Reset","btn.attach":"Attach…","btn.upload":"Upload…","btn.replace":"Replace…","btn.no_area":"No area","title.zoom_in":"Zoom in","title.zoom_out":"Zoom out","title.zoom_reset":"Reset zoom","title.add_device":"Add a device to the plan","title.show_all":"Show all area devices (no curation)","title.reset_layout":"Reset icon positions to auto layout","title.markup":"Room markup: grid, lines, outlines","title.configure_space":"Configure space","title.add_space":"Add space","title.markup_add":"Add a room: connect grid dots with lines until the outline closes","title.markup_merge":"Merge rooms: click one room, then the neighbour it shares a wall with","title.markup_split":"Split a room: click the room, then two points on its walls","title.markup_delroom":"Delete a room: click inside the room","title.no_area_room":"Decorative room without an HA area (e.g. a hallway)","title.choose_area":"Select a Home Assistant area","title.need_plan":"Upload a floor-plan image","markup.add":"Add","markup.merge":"Merge","markup.split":"Split","markup.opening":"Opening","title.markup_opening":"Doors & windows: click a wall to place, click an opening to edit","opening.new":"New opening","opening.edit":"Door / window","opening.door":"Door","opening.window":"Window","opening.type_label":"Type","opening.length_label":"Length, cm","opening.contact_label":"Open/close sensor","opening.lock_label":"Lock","opening.none":"— none —","opening.invert":"Invert open/closed","opening.flip_h":"Hinge on the other jamb","opening.flip_v":"Opens to the other side","opening.open":"Open","opening.closed":"Closed","opening.locked":"Locked","opening.unlocked":"Unlocked","opening.state_unknown":"unavailable","opening.no_entities":"No sensors bound — a static symbol on the plan.","toast.opening_no_wall":"Click next to a room wall — openings sit on walls","markup.delete":"Delete","markup.hint_points":"points: {n} · Esc/Ctrl+Z — undo a dot · close the outline by clicking the first one","markup.hint_start":"click a grid dot to start the outline","tip.room":"room — open the area","tip.lqi":"average zigbee signal:","info.device_header":"Device on the plan","info.model":"Model","info.state":"State","info.link":"Link","info.manuals":"Manuals","info.none":"No additional information","marker.new_device":"New device","marker.name_label":"Name (shown on the plan)","marker.name_ph":"Name","marker.binding_label":"Bind to an HA device","marker.virtual_option":"Virtual device (no binding)","marker.search_ph":"Search device / group…","marker.nothing_found":"nothing found","marker.room_label":"Room","marker.room_override":" (override placement)","marker.room_choose":"— select a room —","marker.room_auto":"— by device area (auto) —","marker.icon_label":"Icon","marker.icon_ph":"mdi:… (empty = auto)","marker.display_label":"Display","display.badge":"Icon badge","display.ripple":"Ripple only","display.icon_ripple":"Icon + ripple","marker.ripple_size":"Ripple size","marker.size_label":"Icon size / rotation","marker.angle_label":"Rotate","marker.model_label":"Model","marker.model_ph":"e.g. Aqara T&H","marker.link_label":"Link","marker.desc_label":"Description","marker.desc_ph":"Notes, specs…","marker.manuals_label":"Manuals (PDF etc.)","marker.sub_device":"device","marker.sub_z2m_group":" · Z2M group","marker.sub_group":"group","marker.sub_helper":"helper","space.new":"New space","space.header":"Space","space.title_label":"Title","space.title_ph":"e.g. Garage","space.plan_label":"Floor plan (background)","space.no_plan":"no plan image","space.plan_alt":"plan","room.new":"New room","room.name_label":"Display name","room.name_ph":"e.g. Terrace","room.area_label":"Home Assistant area (unassigned)","room.no_area_option":"— no area —","room.default_name":"Room","device.unnamed":"unnamed","device.light_group":"light group","device.fallback":"device","device.virtual":"virtual device","confirm.reset_layout":"Reset all icon positions to the auto layout?","confirm.delete_room":'Delete room "{name}"?',"confirm.remove_marker":'Remove "{name}" from the plan?',"confirm.delete_space":'Delete space "{title}" with all its rooms and markup?',"toast.pos_save_failed":"Failed to save position: {err}","toast.no_entity":"The device has no suitable entity","toast.markup_needs_server":"Markup is available after the config is moved to the server","toast.conflict":"Config was changed in another window — data refreshed, repeat your last action","toast.cfg_save_failed":"Failed to save config: {err}","toast.point_in_room":"That point is inside room “{name}” — rooms must not overlap","toast.room_overlap":"The outline overlaps room “{name}” — rooms must not overlap","toast.merge_not_adjacent":"Only rooms that share a wall can be merged","toast.rooms_merged":"Rooms merged into “{name}”","toast.split_pick_wall":"Click a grid dot on the room’s wall","toast.split_bad_cut":"The cut must be a straight line from wall to wall, inside the room","merge.header":"Merge rooms","merge.hint":"The merged room keeps one name and one area. The other area is released — its devices leave the plan until another room claims it.","merge.keep":"Keep","merge.no_area":"no area","room.split_header":"New room from the split","toast.room_saved":"Room saved ({n}). Devices added: {added}. Outline the next one or exit markup.","toast.room_saved_no_area":"Room saved ({n}, no area). Outline the next one or exit markup.","toast.marker_needs_server":"Device editing is available after the config is moved to the server","toast.virtual_name_required":"Enter a name for the virtual device","toast.marker_saved":"Device saved","toast.marker_removed":"Device removed from the plan","toast.integration_missing":"The House Plan integration is not installed — management unavailable","toast.plan_formats":"Supported formats: SVG, PNG, JPG, WebP","toast.plan_required":"Upload a floor plan — it is required","toast.space_added_onboard":"Space added. Outline the rooms: click grid dots and close the contour.","toast.space_added":"Space added","toast.space_saved":"Space saved","toast.space_deleted":"Space deleted","toast.delete_failed":"Delete failed: {err}","toast.error":"Error: {err}","toast.file_failed":'File "{name}" was not uploaded: {err}',"toast.files_attached":"Files attached: {n}","err.unknown":"unknown error","err.code":"code {code}","err.too_large":"file larger than {mb} MB","err.bad_ext":"unsupported type (PDF/image expected)","err.unauthorized":"administrator rights required","editor.title":"Title","editor.default_floor":"Default space","editor.icon_size":"Icon size, % of plan width","editor.show_temperature":"Show temperature","editor.live_states":"Live states (on/off, open…)","editor.show_signal":"Show zigbee signal (LQI)","editor.language":"Interface language","editor.lang_auto":"Auto (HA profile)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Icon rules: which MDI icon devices get by name","rules.title":"Icon rules","rules.hint":"Rules are checked top-down against “device name + model” (case-insensitive regex); the first match wins. When nothing matches, the entity device class decides, then the generic chip icon.","rules.pattern_ph":"regex, e.g. plug|socket","rules.icon_ph":"mdi:power-socket-de","rules.add":"Add rule","rules.reset":"Reset to defaults","rules.test_ph":"Try a device name…","rules.invalid":"invalid regex","rules.saved":"Icon rules saved","btn.up":"Up","btn.down":"Down","editor.tap_action":"Tap on a device","tap.info":"Info card","tap.more_info":"HA more-info dialog","tap.toggle":"Toggle (lights/switches)","tap.auto":"As the card default","marker.tap_label":"Tap action for this device","tap.toggle_note":"Toggle never applies to locks and alarms; hold the icon to open the info card.","import.title":"Create spaces from HA floors","import.hint":"Your Home Assistant already knows these floors. Pick the ones to turn into plan spaces — you will upload a floor-plan image for each one next. Rooms are then outlined by hand on the plan.","import.start":"Create {n} space(s)","import.manual":"Start from scratch","import.progress":"Floor {i} of {n}","import.done":"Spaces created. Outline the rooms: click grid dots and close the contour.","btn.skip":"Skip","space.scale_label":"Scale (grid cell size)","space.scale_unit":"cm per cell","space.display_section":"Display","space.show_borders":"Always show room borders","space.show_names":"Show room names (drag to move)","space.room_color":"Border & name color","space.opacity":"Opacity","space.fill_label":"Room fill","fill.none":"None","fill.lqi":"Zigbee signal","fill.light":"Lights","space.source_file":"I have a floor-plan image","space.source_draw":"No image — I'll outline rooms by hand","space.orientation":"Canvas","orient.landscape":"Landscape","orient.portrait":"Portrait","orient.square":"Square","fill.temp":"Temperature","space.temp_min":"Comfort from","space.temp_max":"to","tip.temp_avg":"average temperature:","space_card.button":"Open the space plan","space_card.not_found":"Space “{id}” not found","space_card.loading":"Loading…","editor.space":"Space","editor.show_button":"Show button","editor.button_label":"Button label","editor.button_target":"Target dashboard path","editor.aspect_ratio":"Aspect ratio (e.g. 16:9 or auto)","marker.sub_entity":"entity","title.general_settings":"General settings","gs.title":"General settings","gs.hint":"Fill colors apply to every space; each color has its own opacity. Which fill mode a space uses is set in that space's dialog.","gs.light_group":"Fill: lights","gs.light_on":"Lights on","gs.light_off":"All lights off","gs.temp_group":"Fill: temperature","gs.temp_cold":"Cold","gs.temp_ok":"Comfortable","gs.temp_hot":"Hot","gs.lqi_group":"Fill: zigbee signal","gs.lqi_low":"Weak signal","gs.lqi_high":"Strong signal","gs.reset":"Reset to defaults","gs.saved":"General settings saved","space.show_lqi":"Show zigbee signal (LQI) next to devices","gs.light_none":"No light sources","mode.plan":"Plan editor","mode.devices":"Device editor","display.value":"Value instead of an icon","marker.subarea":"no area, manual","device.new":"New device — open its editor to dismiss","opening.unlock_action":"Unlock","opening.lock_action":"Lock","opening.lock_pending":"Working…","title.close_editor":"Close editor (back to view)","devbar.add":"Add","devbar.show_all":"Show all","devbar.reset":"Reset","devbar.rules":"Icon rules"};const di={en:pi,ru:{"card.title":"План дома","count.devices":"{n} устр.","empty.no_spaces":"Пространств пока нет.","empty.add_first":"Добавьте первое пространство и загрузите план этажа.","empty.install":"Установите интеграцию House Plan и добавьте запись в «Устройства и службы».","btn.add_space":"Добавить пространство","btn.cancel":"Отмена","btn.save":"Сохранить","btn.close":"Закрыть","btn.delete":"Удалить","btn.remove":"Убрать","btn.edit":"Редактировать","btn.open_in_ha":"Открыть в HA","btn.reset":"Сброс","btn.attach":"Прикрепить…","btn.upload":"Загрузить…","btn.replace":"Заменить…","btn.no_area":"Без зоны","title.zoom_in":"Приблизить","title.zoom_out":"Отдалить","title.zoom_reset":"Сбросить масштаб","title.add_device":"Добавить устройство на план","title.show_all":"Показывать все устройства зоны (без курирования)","title.reset_layout":"Сбросить позиции значков к авто-раскладке","title.markup":"Разметка комнат: сетка, линии, контуры","title.configure_space":"Настроить пространство","title.add_space":"Добавить пространство","title.markup_add":"Добавить комнату: соединяйте точки сетки линиями до замкнутого контура","title.markup_merge":"Объединить комнаты: клик по одной, затем по соседней с общей стеной","title.markup_split":"Разделить комнату: клик по комнате, затем две точки на её стенах","title.markup_delroom":"Удалить комнату: клик внутри комнаты","title.no_area_room":"Декоративная комната без привязки к зоне (например, холл)","title.choose_area":"Выберите зону Home Assistant","title.need_plan":"Загрузите подложку (план этажа)","markup.add":"Добавить","markup.merge":"Объединить","markup.split":"Разделить","markup.opening":"Проём","title.markup_opening":"Двери и окна: клик по стене — добавить, клик по проёму — редактировать","opening.new":"Новый проём","opening.edit":"Дверь / окно","opening.door":"Дверь","opening.window":"Окно","opening.type_label":"Тип","opening.length_label":"Длина, см","opening.contact_label":"Датчик открытия","opening.lock_label":"Замок","opening.none":"— нет —","opening.invert":"Инвертировать открыто/закрыто","opening.flip_h":"Петли с другой стороны","opening.flip_v":"Открывается в другую сторону","opening.open":"Открыто","opening.closed":"Закрыто","opening.locked":"Заперто","opening.unlocked":"Не заперто","opening.state_unknown":"недоступно","opening.no_entities":"Датчики не привязаны — статичный символ на плане.","toast.opening_no_wall":"Кликните рядом со стеной комнаты — проёмы ставятся на стены","markup.delete":"Удалить","markup.hint_points":"точек: {n} · Esc/Ctrl+Z — убрать точку · замкните контур кликом по первой","markup.hint_start":"кликните точку сетки, чтобы начать контур","tip.room":"комната — открыть зону","tip.lqi":"средний сигнал zigbee:","info.device_header":"Устройство на плане","info.model":"Модель","info.state":"Состояние","info.link":"Ссылка","info.manuals":"Инструкции","info.none":"Нет дополнительной информации","marker.new_device":"Новое устройство","marker.name_label":"Имя (отображается на плане)","marker.name_ph":"Название","marker.binding_label":"Привязка к устройству HA","marker.virtual_option":"Виртуальное устройство (без привязки)","marker.search_ph":"Поиск устройства / группы…","marker.nothing_found":"ничего не найдено","marker.room_label":"Комната","marker.room_override":" (переопределить размещение)","marker.room_choose":"— выберите комнату —","marker.room_auto":"— по зоне устройства (авто) —","marker.icon_label":"Иконка","marker.icon_ph":"mdi:… (пусто = авто)","marker.display_label":"Отображение","display.badge":"Значок","display.ripple":"Только пульсация","display.icon_ripple":"Значок + пульсация","marker.ripple_size":"Размер пульсации","marker.size_label":"Размер / поворот значка","marker.angle_label":"Поворот","marker.model_label":"Модель","marker.model_ph":"напр. Aqara T&H","marker.link_label":"Ссылка","marker.desc_label":"Описание","marker.desc_ph":"Заметки, характеристики…","marker.manuals_label":"Инструкции (PDF и т.п.)","marker.sub_device":"устройство","marker.sub_z2m_group":" · Z2M-группа","marker.sub_group":"группа","marker.sub_helper":"хелпер","space.new":"Новое пространство","space.header":"Пространство","space.title_label":"Название","space.title_ph":"Например: Гараж","space.plan_label":"Подложка (план)","space.no_plan":"нет подложки","space.plan_alt":"план","room.new":"Новая комната","room.name_label":"Отображаемое имя","room.name_ph":"Например: Терраса","room.area_label":"Зона Home Assistant (свободные)","room.no_area_option":"— без зоны —","room.default_name":"Комната","device.unnamed":"без имени","device.light_group":"группа света","device.fallback":"устройство","device.virtual":"виртуальное устройство","confirm.reset_layout":"Сбросить позиции всех иконок к авто-раскладке?","confirm.delete_room":"Удалить комнату «{name}»?","confirm.remove_marker":"Убрать «{name}» с плана?","confirm.delete_space":"Удалить пространство «{title}» со всеми комнатами и разметкой?","toast.pos_save_failed":"Не удалось сохранить позицию: {err}","toast.no_entity":"У устройства нет подходящей сущности","toast.markup_needs_server":"Разметка доступна после переноса конфига на сервер","toast.conflict":"Конфиг изменён в другом окне — данные обновлены, повторите последнее действие","toast.cfg_save_failed":"Не удалось сохранить конфиг: {err}","toast.point_in_room":"Точка внутри комнаты «{name}» — комнаты не должны накладываться","toast.room_overlap":"Контур накладывается на комнату «{name}» — комнаты не должны накладываться","toast.merge_not_adjacent":"Объединять можно только комнаты с общей стеной","toast.rooms_merged":"Комнаты объединены в «{name}»","toast.split_pick_wall":"Кликните по узлу сетки на стене комнаты","toast.split_bad_cut":"Разрез — прямая от стены до стены внутри комнаты","merge.header":"Объединение комнат","merge.hint":"У объединённой комнаты одно имя и одна зона. Вторая зона освобождается — её устройства уйдут с плана, пока их не заберёт другая комната.","merge.keep":"Оставить","merge.no_area":"без зоны","room.split_header":"Новая комната после разделения","toast.room_saved":"Комната сохранена ({n}). Устройств добавлено: {added}. Обведите следующую или выйдите из разметки.","toast.room_saved_no_area":"Комната сохранена ({n}, без зоны). Обведите следующую или выйдите из разметки.","toast.marker_needs_server":"Редактирование устройств доступно после переноса конфига на сервер","toast.virtual_name_required":"Укажите имя виртуального устройства","toast.marker_saved":"Устройство сохранено","toast.marker_removed":"Устройство убрано с плана","toast.integration_missing":"Интеграция House Plan не установлена — управление недоступно","toast.plan_formats":"Поддерживаются SVG, PNG, JPG, WebP","toast.plan_required":"Загрузите подложку — план этажа обязателен","toast.space_added_onboard":"Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.","toast.space_added":"Пространство добавлено","toast.space_saved":"Пространство сохранено","toast.space_deleted":"Пространство удалено","toast.delete_failed":"Ошибка удаления: {err}","toast.error":"Ошибка: {err}","toast.file_failed":"Файл «{name}» не загружен: {err}","toast.files_attached":"Прикреплено файлов: {n}","err.unknown":"неизвестная ошибка","err.code":"код {code}","err.too_large":"файл больше {mb} МБ","err.bad_ext":"недопустимый тип (нужен PDF/изображение)","err.unauthorized":"нужны права администратора","editor.title":"Заголовок","editor.default_floor":"Пространство по умолчанию","editor.icon_size":"Размер иконок, % ширины плана","editor.show_temperature":"Показывать температуру","editor.live_states":"Живые состояния (вкл/выкл, открыто…)","editor.show_signal":"Показывать сигнал zigbee (LQI)","editor.language":"Язык интерфейса","editor.lang_auto":"Авто (профиль HA)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Правила иконок: какая MDI-иконка достаётся устройству по имени","rules.title":"Правила иконок","rules.hint":"Правила проверяются сверху вниз по строке «имя устройства + модель» (regex без учёта регистра); срабатывает первое совпадение. Если ничего не подошло — решает device class сущности, затем — иконка-заглушка.","rules.pattern_ph":"regex, напр. розетк|plug","rules.icon_ph":"mdi:power-socket-de","rules.add":"Добавить правило","rules.reset":"Сбросить к умолчаниям","rules.test_ph":"Проверьте имя устройства…","rules.invalid":"некорректный regex","rules.saved":"Правила иконок сохранены","btn.up":"Вверх","btn.down":"Вниз","editor.tap_action":"Тап по устройству","tap.info":"Инфо-карточка","tap.more_info":"Диалог HA (more-info)","tap.toggle":"Переключить (свет/розетки)","tap.auto":"Как в настройках карточки","marker.tap_label":"Действие по тапу для этого устройства","tap.toggle_note":"Toggle никогда не применяется к замкам и сигнализациям; долгое нажатие всегда открывает инфо-карточку.","import.title":"Создать пространства из этажей HA","import.hint":"Home Assistant уже знает эти этажи. Отметьте, какие превратить в пространства плана — далее для каждого попросим картинку плана. Комнаты затем обводятся вручную по плану.","import.start":"Создать: {n}","import.manual":"Начать с нуля","import.progress":"Этаж {i} из {n}","import.done":"Пространства созданы. Обведите комнаты: кликайте по точкам сетки и замкните контур.","btn.skip":"Пропустить","space.scale_label":"Масштаб (размер клетки сетки)","space.scale_unit":"см на клетку","space.display_section":"Отображение","space.show_borders":"Всегда отображать границы комнат","space.show_names":"Отображать названия комнат (перетаскиваются)","space.room_color":"Цвет границ и названий","space.opacity":"Прозрачность","space.fill_label":"Заливка комнат","fill.none":"Нет","fill.lqi":"По силе зигби-сигнала","fill.light":"По освещению","space.source_file":"У меня есть картинка плана","space.source_draw":"Нет подложки — нарисую комнаты вручную","space.orientation":"Холст","orient.landscape":"Альбомный","orient.portrait":"Портретный","orient.square":"Квадрат","fill.temp":"По температуре","space.temp_min":"Комфорт от","space.temp_max":"до","tip.temp_avg":"средняя температура:","space_card.button":"Перейти к пространству","space_card.not_found":"Пространство «{id}» не найдено","space_card.loading":"Загрузка…","editor.space":"Пространство","editor.show_button":"Показывать кнопку","editor.button_label":"Текст кнопки","editor.button_target":"Путь дашборда (куда вести)","editor.aspect_ratio":"Соотношение сторон (напр. 16:9 или auto)","marker.sub_entity":"сущность","title.general_settings":"Общие настройки","gs.title":"Общие настройки","gs.hint":"Цвета заливок действуют на все пространства; у каждого цвета своя прозрачность. Какой режим заливки использует пространство — задаётся в его диалоге.","gs.light_group":"Заливка: освещение","gs.light_on":"Свет включён","gs.light_off":"Весь свет выключен","gs.temp_group":"Заливка: температура","gs.temp_cold":"Холодно","gs.temp_ok":"Комфорт","gs.temp_hot":"Жарко","gs.lqi_group":"Заливка: зигби-сигнал","gs.lqi_low":"Слабый сигнал","gs.lqi_high":"Сильный сигнал","gs.reset":"Сбросить к умолчаниям","gs.saved":"Общие настройки сохранены","space.show_lqi":"Показывать зигби-сигнал (LQI) у устройств","gs.light_none":"Нет источников света","mode.plan":"Редактор плана","mode.devices":"Редактор устройств","display.value":"Значение вместо иконки","marker.subarea":"без зоны, вручную","device.new":"Новое устройство — откройте его редактор, чтобы снять отметку","opening.unlock_action":"Открыть замок","opening.lock_action":"Закрыть замок","opening.lock_pending":"Выполняется…","title.close_editor":"Закрыть редактор (вернуться к просмотру)","devbar.add":"Добавить","devbar.show_all":"Показать все","devbar.reset":"Сброс","devbar.rules":"Правила иконок"}};function ui(t,e){if(e&&e in di)return e;return(t?.locale?.language||t?.language||"en").toLowerCase().startsWith("ru")?"ru":"en"}function gi(t,e,i){return function(t,e){if(!e)return t;let i=t;for(const[t,s]of Object.entries(e))i=i.split("{"+t+"}").join(String(s));return i}(di[t][e]??pi[e]??e,i)}class _i extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return ui(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[],e=this._lang;return[{name:"title",selector:{text:{}}},t.length?{name:"default_floor",selector:{select:{mode:"dropdown",options:t}}}:{name:"default_floor",selector:{text:{}}},{name:"language",selector:{select:{mode:"dropdown",options:[{value:"",label:gi(e,"editor.lang_auto")},{value:"en",label:gi(e,"editor.lang_en")},{value:"ru",label:gi(e,"editor.lang_ru")}]}}},{name:"tap_action",selector:{select:{mode:"dropdown",options:[{value:"info",label:gi(e,"tap.info")},{value:"more-info",label:gi(e,"tap.more_info")},{value:"toggle",label:gi(e,"tap.toggle")}]}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}}]}render(){if(!this.hass||!this._config)return W;this._loadSpaces();const t=this._lang,e={title:gi(t,"editor.title"),default_floor:gi(t,"editor.default_floor"),language:gi(t,"editor.language"),tap_action:gi(t,"editor.tap_action"),icon_size:gi(t,"editor.icon_size"),show_temperature:gi(t,"editor.show_temperature"),live_states:gi(t,"editor.live_states"),show_signal:gi(t,"editor.show_signal")};return H`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}_i.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-card-editor")||customElements.define("houseplan-card-editor",_i);const mi=n`
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
      display: inline-flex;
      align-items: center;
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
    .stage.noplan {
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
      gap: 6px;
      margin-top: 8px;
    }
    .btn.lockact.warn {
      color: var(--error-color, #d33);
      border-color: var(--error-color, #d33);
    }
    .oprow {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
    }
    .oprow b { margin-left: auto; }
    .oprow.ok b { color: #66d17a; }
    .oprow.warn b { color: var(--hp-open); }
    @media (prefers-reduced-motion: reduce) {
      .op-leaf, .op-arc { transition: none; }
    }
    /* presence ripples: opted into per device, drawn around the anchor point */
    .dev.noicon {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .dev ha-icon {
      position: relative;
      z-index: 1;
    }
    .ripple {
      position: absolute;
      left: 50%;
      top: 50%;
      width: calc(var(--dev-size) * var(--ripple-scale, 3));
      height: calc(var(--dev-size) * var(--ripple-scale, 3));
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    .ripple i {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--ripple-color, var(--hp-accent));
      opacity: 0;
    }
    .ripple.active i {
      animation: hp-ripple 2.4s ease-out infinite;
    }
    .ripple.active i:nth-child(2) { animation-delay: 0.8s; }
    .ripple.active i:nth-child(3) { animation-delay: 1.6s; }
    /* idle: a faint dot keeps the spot marked without pulling the eye */
    .ripple:not(.active) i:nth-child(n + 2) { display: none; }
    .ripple:not(.active) i {
      inset: calc(50% - 0.15 * var(--dev-size));
      opacity: 0.3;
      animation: none;
    }
    @keyframes hp-ripple {
      0% { transform: scale(0.18); opacity: 0.7; }
      70% { opacity: 0.22; }
      100% { transform: scale(1); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ripple.active i { animation: none; opacity: 0.3; }
      .ripple.active i:nth-child(n + 2) { display: none; }
    }
    .roomlabel {
      pointer-events: none; /* draggable only in plan mode (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.5);
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
      z-index: 1;
    }
    .stage.markup .roomlabel { pointer-events: auto; }
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
      gap: 2px;
      background: rgba(127, 127, 127, 0.12);
      border-radius: 10px;
      padding: 3px;
    }
    .modetab {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .modetab ha-icon { --mdc-icon-size: 15px; }
    .modetab .closex {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: 2px;
      opacity: 0.75;
      cursor: pointer;
      border-radius: 4px;
    }
    .modetab .closex:hover { opacity: 1; }
    .editbar .barclose {
      padding: 4px 6px;
      margin-left: 6px;
    }
    .modetab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    @media (max-width: 720px) {
      .modetab .ml { display: none; }
    }
    .room.picked {
      stroke: #ffc14d;
      stroke-width: 3;
      fill: rgba(255, 193, 77, 0.25);
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
    .dev.valonly {
      width: auto;
      min-width: var(--dev-size, var(--icon-size, 2.5cqw));
      padding: 0 calc(var(--icon-size, 2.5cqw) * 0.16);
    }
    .dev.valonly .valtext {
      font-size: calc(var(--icon-size, 2.5cqw) * 0.45);
      font-weight: 700;
      white-space: nowrap;
    }
    /* RGB lights: the bulb takes the light's actual color */
    .dev.rgb ha-icon { color: var(--light-color); }
    .dev.rgb.on {
      box-shadow: 0 0 10px var(--light-color);
      border-color: var(--light-color);
      background: var(--hp-bg);
      color: var(--light-color);
    }
    /* alarms pulse red over everything */
    .dev.alarm::after {
      content: '';
      position: absolute;
      inset: calc(var(--icon-size, 2.5cqw) * -0.35);
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
      top: calc(var(--icon-size, 2.5cqw) * -0.12);
      right: calc(var(--icon-size, 2.5cqw) * -0.12);
      width: calc(var(--icon-size, 2.5cqw) * 0.34);
      height: calc(var(--icon-size, 2.5cqw) * 0.34);
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
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
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
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
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
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      opacity: 0.4;
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
    .dialog .body .colorrow .tempin { width: 72px; flex: none; }
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

    .gsrow .gsl {
      min-width: 150px;
      font-size: 12.5px;
      color: var(--hp-muted);
    }
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
  `,fi=1e3;function vi(t){return t&&Array.isArray(t.spaces)?t.spaces.map(t=>{const e=fi/t.aspect;return{id:t.id,title:t.title,vb:[t.view_box[0]*fi,t.view_box[1]*e,t.view_box[2]*fi,t.view_box[3]*e],bg:t.plan_url?{href:t.plan_url,x:0,y:0,w:fi,h:e}:null,rooms:(t.rooms||[]).map(t=>({id:t.id,name:t.name,area:t.area??null,x:null!=t.x?t.x*fi:void 0,y:null!=t.y?t.y*e:void 0,w:null!=t.w?t.w*fi:void 0,h:null!=t.h?t.h*e:void 0,poly:t.poly?t.poly.map(t=>[t[0]*fi,t[1]*e]):void 0}))}}):[]}function bi(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}function yi(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}function wi(t){const e=vi(t.cfg),i=e.find(e=>e.id===t.spaceId);if(!i)return null;const s=i.vb,o=We(t.cfg.spaces.find(e=>e.id===t.spaceId)),n=t.iconSize??2.5,r=n>8?2.5:n,a={};for(const e of t.cfg.spaces||[])for(const t of e.rooms||[])t.area&&(a[t.area]=e.id);const l=t.cfg.settings?.exclude_integrations?new Set(t.cfg.settings.exclude_integrations):ht,c=dt(t.cfg.settings?.icon_rules?.length?t.cfg.settings.icon_rules:pt),h=li({hass:t.hass,areaToSpace:a,markers:t.cfg.markers||[],settings:t.cfg.settings||{},excluded:l,showAll:!!t.cfg.settings?.show_all,firstSpaceId:e[0]?.id||"",loc:e=>gi(t.lang,e),iconRules:c}),p=h.filter(e=>e.space===t.spaceId),d=function(t,e,i){const s={},o=i/100*fi*1.3;for(const i of e.rooms){if(!i.area)continue;const e=t.filter(t=>t.area===i.area);if(!e.length)continue;const n=bi(i),r=.1*Math.min(n.w,n.h),a=n.w-2*r,l=n.h-2*r,c=Math.max(1,Math.round(Math.sqrt(e.length*a/Math.max(l,1)))),h=a/c,p=l/Math.max(Math.ceil(e.length/c),1),d=e.map((t,e)=>({x:n.x+r+h*(e%c+.5),y:n.y+r+p*(Math.floor(e/c)+.5)}));Ue(d,n,o,.5*r),e.forEach((t,e)=>s[t.id]=d[e])}return s}(p,i,r),u=i.rooms.filter(t=>t.area||o.showBorders).map(e=>{let s="room "+(i.bg?"overlay":"yard"),n="";if(o.showBorders||"none"!==o.fill){s+=" styled";const i=[`--room-stroke:${o.color}`,`--room-stroke-op:${o.showBorders?o.opacity:0}`],r=e.area?Je(o.fill,"lqi"===o.fill?function(t,e,i){const s=[];for(const o of e){if(o.area!==i||o.virtual)continue;const e=ii(t,o.entities);null!=e&&s.push(e)}return Le(s)}(t.hass,p,e.area):null,"light"===o.fill?ci(t.hass,p,e.area):"none","temp"===o.fill?hi(t.hass,p,e.area):null,o.tempMin,o.tempMax,Ze(t.cfg?.settings)):null;r?(s+=" filled",i.push(`--room-fill:${r.c}`,`--room-fill-op:${r.a.toFixed(3)}`)):i.push("--room-fill:transparent","--room-fill-op:0"),n=i.join(";")}const r=!i.bg&&!o.showNames,a=yi(e),l=e.poly?j`<polygon class="${s}" style="${n}" points="${e.poly.map(t=>t.join(",")).join(" ")}"></polygon>`:j`<rect class="${s}" style="${n}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${.03*Math.min(e.w,e.h)}"></rect>`;return j`${l}${r?j`<text class="rlabel" x="${a[0]}" y="${a[1]}">${e.name}</text>`:W}`}),g=p.map(e=>{const o=function(t,e,i,s,o){const n=e[t.id];if(n&&n.s===t.space){const e=i.spaces.find(e=>e.id===t.space)?.aspect||1;return{x:n.x*fi,y:n.y*(fi/e)}}if(s[t.id])return s[t.id];const r=o.vb;return{x:r[0]+r[2]/2,y:r[1]+r[3]/2}}(e,t.layout,t.cfg,d,i),n=(o.x-s[0])/s[2]*100,r=(o.y-s[1])/s[3]*100;return H`<div class="dev ${e.virtual?"virtual":""}" style="left:${n}%;top:${r}%">
      <ha-icon icon="${e.icon}"></ha-icon>
    </div>`}),_=o.showNames?i.rooms.filter(t=>t.name).map(e=>{const n=function(t,e,i,s){const o=i["rl_"+(t.id||"")];if(o&&o.s===e){const t=s.spaces.find(t=>t.id===e)?.aspect||1;return{x:o.x*fi,y:o.y*(fi/t)}}const n=yi(t);return{x:n[0],y:n[1]}}(e,i.id,t.layout,t.cfg),r=(n.x-s[0])/s[2]*100,a=(n.y-s[1])/s[3]*100,l=Math.min(1,o.opacity+.25);return H`<div class="roomlabel" style="left:${r}%;top:${a}%;color:${o.color};opacity:${l}">${e.name}</div>`}):[];return H`
    <div class="hp-static-stage" style="aspect-ratio:${s[2]}/${s[3]}">
      <svg viewBox="${s[0]} ${s[1]} ${s[2]} ${s[3]}" preserveAspectRatio="xMidYMid meet">
        ${i.bg?j`<image href="${i.bg.href}" x="${i.bg.x}" y="${i.bg.y}" width="${i.bg.w}" height="${i.bg.h}" preserveAspectRatio="none" />`:W}
        ${u}
      </svg>
      <div class="devlayer" style="--icon-size:${r}cqw">${g}${_}</div>
    </div>
  `}let xi=null,$i=null,ki=!1;const Si=new Set;function Ci(){if(xi)return xi;try{const t=JSON.parse(localStorage.getItem("houseplan_card_cfg_v1")||"null");if(t&&t.config&&Array.isArray(t.config.spaces))return{config:t.config,rev:t.rev||0,layout:t.layout||{}}}catch{}return null}function Ei(t){return xi?Promise.resolve(xi):$i||($i=async function(t){const[e,i]=await Promise.all([t.callWS({type:"houseplan/config/get"}),t.callWS({type:"houseplan/layout/get"})]);if(xi={config:e?.config??null,rev:e?.rev??0,layout:i?.layout??{}},!ki&&t.connection?.subscribeEvents){ki=!0;try{await t.connection.subscribeEvents(()=>{xi=null,Si.forEach(t=>t())},"houseplan_config_updated")}catch{ki=!1}}return xi}(t).finally(()=>{$i=null}),$i)}class Di extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return ui(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[];return[t.length?{name:"space",selector:{select:{mode:"dropdown",options:t}}}:{name:"space",selector:{text:{}}},{name:"title",selector:{text:{}}},{name:"show_button",selector:{boolean:{}}},{name:"button_label",selector:{text:{}}},{name:"button_target",selector:{text:{}}},{name:"aspect_ratio",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}}]}render(){if(!this.hass||!this._config)return W;this._loadSpaces();const t=this._lang,e={space:gi(t,"editor.space"),title:gi(t,"editor.title"),show_button:gi(t,"editor.show_button"),button_label:gi(t,"editor.button_label"),button_target:gi(t,"editor.button_target"),aspect_ratio:gi(t,"editor.aspect_ratio"),icon_size:gi(t,"editor.icon_size")};return H`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}Di.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-space-card-editor")||customElements.define("houseplan-space-card-editor",Di);const Ai=t=>{history.pushState(null,"",t),((t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)})(window,"location-changed",{replace:!1})};class Mi extends lt{constructor(){super(...arguments),this._snap=null,this._loading=!1,this._loadedOnce=!1,this._goToSpace=()=>{const t=(this._config?.button_target||"/plan-doma").replace(/#.*$/,"");Ai(`${t}#space=${encodeURIComponent(this._config.space)}`)}}static getConfigElement(){return document.createElement("houseplan-space-card-editor")}static getStubConfig(t){const e=Ci();return{type:"custom:houseplan-space-card",space:vi(e?.config||null)[0]?.id||"",show_button:!0}}setConfig(t){if(!t||!t.space)throw new Error('houseplan-space-card: "space" is required');this._config={show_button:!0,button_target:"/plan-doma",...t},this._snap=this._snap||Ci()}connectedCallback(){var t;super.connectedCallback(),this._unsub=(t=()=>{this._loading=!1,this._snap=null,this.requestUpdate()},Si.add(t),()=>Si.delete(t))}disconnectedCallback(){this._unsub?.(),this._unsub=void 0,super.disconnectedCallback()}willUpdate(t){!this.hass||this._loading||this._snap&&!t.has("hass")||this._snap&&this._loadedOnce||this._load()}async _load(){if(this.hass&&!this._loading){this._loading=!0;try{const t=await Ei(this.hass);this._snap=t,this._loadedOnce=!0}catch{}finally{this._loading=!1,this.requestUpdate()}}}get _lang(){return ui(this.hass,this._config?.language)}getCardSize(){const t=vi(this._snap?.config||null).find(t=>t.id===this._config?.space);if(t){const e=t.vb[3]/t.vb[2];return Math.max(3,Math.round(8*e))+(!1===this._config?.show_button?0:1)}return 6}_errorCard(t){return H`<ha-card><div class="hp-static-error">${t}</div></ha-card>`}render(){if(!this._config)return W;const t=this._snap?.config;if(!t)return H`<ha-card><div class="hp-static-error">${gi(this._lang,"space_card.loading")}</div></ha-card>`;const e=this._config.space,i=wi({hass:this.hass,cfg:t,layout:this._snap?.layout||{},spaceId:e,iconSize:this._config.icon_size,lang:this._lang});if(!i)return this._errorCard(gi(this._lang,"space_card.not_found",{id:e}));const s=vi(t).find(t=>t.id===e),o=void 0!==this._config.title?this._config.title:s?.title||"",n=!1!==this._config.show_button,r=this._config.button_label||gi(this._lang,"space_card.button");return H`
      <ha-card>
        ${o?H`<div class="hp-static-title">${o}</div>`:W}
        ${i}
        ${n?H`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${r}</button>
            </div>`:W}
      </ha-card>
    `}}Mi.properties={hass:{attribute:!1},_config:{state:!0},_snap:{state:!0}},Mi.styles=[mi,n`
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
    `],customElements.get("houseplan-space-card")||customElements.define("houseplan-space-card",Mi),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-space-card"===t.type)||window.customCards.push({type:"houseplan-space-card",name:"House Plan — Space (static)",description:"Read-only static schematic of a single houseplan space, with a deep-link button.",preview:!1,documentation:"https://github.com/Matysh/houseplan-card"});const zi="houseplan_card_layout_v1",Ti="houseplan_card_cfg_v1",Ri="houseplan_card_zoom_v1",Pi=1e3,Ni=(t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)},Oi=(t,e)=>{let i;return(...s)=>{clearTimeout(i),i=window.setTimeout(()=>t(...s),e)}};class Ii extends lt{constructor(){super(...arguments),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._unsubCfg=null,this._devices=[],this._regSignature="",this._defPos={},this._newSyncKey="",this._tip=null,this._selId=null,this._toast="",this._mode="view",this._tool="draw",this._path=[],this._cursorPt=null,this._mergeSel=null,this._openingDialog=null,this._openingInfo=null,this._opDrag=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._areaSel="",this._nameSel="",this._roomDialog=!1,this._zoom=1,this._view=null,this._zoomBySpace={},this._pointers=new Map,this._panStart=null,this._pinchStart=null,this._suppressClick=!1,this._onboardingShown=!1,this._rulesDialog=null,this._settingsDialog=null,this._importDialog=null,this._importQueue=[],this._importTotal=0,this._rulesCompiledSrc="",this._infoCard=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=t=>this._onKey(t),this._hashApplied=!1,this._onHashChange=()=>{const t=this._hashSpace();t&&this._model.find(e=>e.id===t)&&t!==this._space&&(this._space=t,this._selId=null,this._restoreZoom(),this.requestUpdate())},this._drag=null,this._holdFired=!1,this._dirtyPos=new Set,this._persistLayout=Oi(()=>{if(this._serverStorage){const t=[...this._dirtyPos];this._dirtyPos.clear();for(const e of t){const t=this._layout[e];t&&this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t}).catch(t=>this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)})))}this._cacheSnapshot()}else localStorage.setItem(zi,JSON.stringify(this._layout))},600),this._saveConfig=Oi(()=>{this._serverCfg&&(this._dropLegacySegments(),this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev}).then(t=>{this._cfgRev=t?.rev??this._cfgRev+1}).catch(t=>{"conflict"===t?.code?(this._showToast(this._t("toast.conflict")),this._cancelPath(),this._reloadConfigOnly()):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(t)}))}))},500),this._openSettingsDialog=()=>{this._norm&&(this._settingsDialog={colors:JSON.parse(JSON.stringify(this._fillColors)),busy:!1})},this._openRulesDialog=()=>{if(!this._norm)return;const t=this._settings.icon_rules,e=(t&&t.length?t:pt).map(t=>({...t}));this._rulesDialog={rules:e,test:"",busy:!1}}}get _canEdit(){return this._norm&&!1!==this.hass?.user?.is_admin}get _markup(){return"plan"===this._mode}_hashSpace(){const t=/(?:^|[#&])space=([^&]+)/.exec(window.location.hash||"");return t?decodeURIComponent(t[1]):""}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this._keyHandler),window.addEventListener("hashchange",this._onHashChange)}disconnectedCallback(){window.removeEventListener("keydown",this._keyHandler),window.removeEventListener("hashchange",this._onHashChange),clearTimeout(this._holdTimer),this._roViewport?.disconnect(),this._roViewport=void 0,this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),super.disconnectedCallback()}_onKey(t){if("Escape"===t.key){if(this._infoCard)return void(this._infoCard=null);if(this._markerDialog)return void(this._markerDialog=null)}if(!this._markup)return;return"Escape"===t.key||(t.ctrlKey||t.metaKey)&&"z"===t.key.toLowerCase()?this._roomDialog?(t.preventDefault(),void this._roomDialogCancel()):void("draw"===this._tool&&this._path.length&&(t.preventDefault(),this._undoPoint())):void 0}_undoPoint(){this._path.length&&(this._path=this._path.slice(0,-1))}static getConfigElement(){return document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card"}}setConfig(t){this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...t},t.default_floor&&(this._space=t.default_floor);try{this._zoomBySpace=JSON.parse(localStorage.getItem(Ri)||"{}")||{}}catch{this._zoomBySpace={}}try{const e=JSON.parse(localStorage.getItem(Ti)||"null");if(e&&e.config&&Array.isArray(e.config.spaces)){this._serverCfg=e.config,this._cfgRev=e.rev||0,this._layout=e.layout||{},this._serverStorage=!0;const i=this._hashSpace();i&&this._model.find(t=>t.id===i)?(this._space=i,this._hashApplied=!0):t.default_floor?this._space=t.default_floor:this._model.find(t=>t.id===this._space)||(this._space=this._model[0]?.id||this._space)}}catch{}}_cacheSnapshot(){if(this._serverCfg)try{localStorage.setItem(Ti,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,layout:this._layout}))}catch{}}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}get _model(){return this._serverCfg?this._serverCfg.spaces.map(t=>{const e=Pi/t.aspect;return{id:t.id,title:t.title,vb:[t.view_box[0]*Pi,t.view_box[1]*e,t.view_box[2]*Pi,t.view_box[3]*e],bg:t.plan_url?{href:t.plan_url,x:0,y:0,w:Pi,h:e}:null,rooms:t.rooms.map(t=>({id:t.id,name:t.name,area:t.area??null,x:null!=t.x?t.x*Pi:void 0,y:null!=t.y?t.y*e:void 0,w:null!=t.w?t.w*Pi:void 0,h:null!=t.h?t.h*e:void 0,poly:t.poly?t.poly.map(t=>[t[0]*Pi,t[1]*e]):void 0}))}}):[]}_spaceModel(t){const e=this._model;return e.find(e=>e.id===(t??this._space))||e[0]}get _areaToSpace(){const t={};for(const e of this._model)for(const i of e.rooms)i.area&&(t[i.area]={space:e.id,room:i});return t}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return!!this._settings.show_all}_toggleShowAll(){this._serverCfg&&(this._serverCfg={...this._serverCfg,settings:{...this._serverCfg.settings,show_all:!this._showAll}},this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate())}get _iconRules(){const t=this._settings.icon_rules;if(!t||!Array.isArray(t)||!t.length)return;const e=JSON.stringify(t);return e!==this._rulesCompiledSrc&&(this._rulesCompiledSrc=e,this._rulesCompiled=dt(t)),this._rulesCompiled}get _fillColors(){return Ze(this._settings)}get _excluded(){const t=this._settings.exclude_integrations;return t?new Set(t):ht}willUpdate(t){t.has("hass")&&this.hass&&(!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices())}updated(){const t=this._stageEl;if(t&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(t)),t&&!this._view&&this._refitView(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._importDialog&&!this._onboardingShown){this._onboardingShown=!0;const t=function(t){const e=t?.floors;if(!e||"object"!=typeof e)return[];const i=[];for(const t of Object.values(e))t&&t.floor_id&&i.push({id:t.floor_id,name:t.name||t.floor_id,level:t.level??null});return i.sort((t,e)=>{const i=t.level??1e9,s=e.level??1e9;return i!==s?i-s:t.name.localeCompare(e.name)}),i}(this.hass);t.length?this._importDialog={floors:t.map(t=>({...t,checked:!0}))}:this._openSpaceDialog("create")}}async _loadFromServer(){this._loading=!0,this._loadTries++;try{const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._loadOk=!0,this._serverStorage=!0;const i=t?.config;this._serverCfg=i&&Array.isArray(i.spaces)?i:null,this._cfgRev=t?.rev||0,this._layout=e?.layout||{},this._unsubCfg||(this._unsubCfg=await this.hass.connection.subscribeEvents(t=>{(t?.data?.rev??-1)!==this._cfgRev&&this._reloadConfigOnly()},"houseplan_config_updated"));const s=this._hashSpace();!this._hashApplied&&s&&this._model.find(t=>t.id===s)?(this._space=s,this._hashApplied=!0):this._norm&&!this._model.find(t=>t.id===this._space)&&(this._space=this._model[0]?.id||this._space),this._cacheSnapshot(),this._restoreZoom()}catch(t){if(this._loadTries>=8){this._serverStorage=!1,this._serverCfg=null;try{this._layout=JSON.parse(localStorage.getItem(zi)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1}this._regSignature="",this.requestUpdate()}async _reloadConfigOnly(){try{const t=await this.hass.callWS({type:"houseplan/config/get"}),e=t?.config;this._serverCfg=e&&Array.isArray(e.spaces)?e:null,this._cfgRev=t?.rev||0,this._cacheSnapshot(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch{}}_maybeRebuildDevices(){const t=this.hass;if(!t?.devices||!t?.entities||!t?.areas)return;const e=Object.keys(t.devices).length+":"+Object.keys(t.entities).length+":"+Object.keys(t.areas).length+":"+(this._norm?"n":"l")+":"+ui(t,this._config?.language);e===this._regSignature&&this._devices.length||(this._regSignature=e,this._devices=li({hass:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||"",loc:t=>this._t(t),iconRules:this._iconRules}),this._defPos=this._defaultPositions(),this._syncNewDevices())}_syncNewDevices(){if(!this._norm||!this._loadOk||!this._serverCfg)return;const t=this._devices.filter(t=>!t.marker&&!t.virtual).map(t=>t.id).sort(),e=t.join(",");if(e===this._newSyncKey)return;this._newSyncKey=e;const i=this._settings,{fresh:s,known:o}=function(t,e){if(!Array.isArray(e))return{fresh:[],known:[...t]};const i=new Set(e),s=t.filter(t=>!i.has(t));return{fresh:s,known:s.length?[...e,...s]:e}}(t,i.known_devices);if(!Array.isArray(i.known_devices)||s.length){const t=[...new Set([...i.new_device_ids||[],...s])];this._serverCfg={...this._serverCfg,settings:{...i,known_devices:o,new_device_ids:t}},this._saveConfig()}}get _newIds(){const t=this._settings.new_device_ids;return new Set(Array.isArray(t)?t:[])}_ackNewDevice(t){if(!this._newIds.has(t)||!this._serverCfg)return;const e=this._settings;this._serverCfg={...this._serverCfg,settings:{...e,new_device_ids:(e.new_device_ids||[]).filter(e=>e!==t)}},this._saveConfig(),this.requestUpdate()}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(t){if(!t)return null;const e=[];for(const i of this._devices){if(i.area!==t||i.virtual)continue;const s=ii(this.hass,i.entities);null!=s&&e.push(s)}return Le(e)}_roomBounds(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}_defaultPositions(){const t={},e=(this._config?.icon_size??2.5)/100*Pi*1.3;for(const i of this._model)for(const s of i.rooms){if(!s.area)continue;const o=this._devices.filter(t=>t.area===s.area&&t.space===i.id);if(!o.length)continue;const n=this._roomBounds(s),r=.1*Math.min(n.w,n.h),a=n.w-2*r,l=n.h-2*r,c=Math.max(1,Math.round(Math.sqrt(o.length*a/Math.max(l,1)))),h=Math.ceil(o.length/c),p=a/c,d=l/Math.max(h,1),u=o.map((t,e)=>({x:n.x+r+p*(e%c+.5),y:n.y+r+d*(Math.floor(e/c)+.5)}));Ue(u,n,e,.5*r),o.forEach((e,i)=>t[e.id]=u[i])}return t}_pos(t){const e=this._spaceModel(t.space),i=this._layout[t.id];if(i)if(this._norm){if(i.s===t.space){const e=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;return{x:i.x*Pi,y:i.y*(Pi/e)}}}else if(void 0===i.s)return{x:i.x,y:i.y};if(this._defPos[t.id])return this._defPos[t.id];const s=e.vb;return{x:s[0]+s[2]/2,y:s[1]+s[3]/2}}_savePos(t,e,i){if(this._norm){const s=this._gridPitch,o=Math.round(e/s)*s,n=Math.round(i/s)*s,r=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;this._layout={...this._layout,[t.id]:{s:t.space,x:o/Pi,y:n/(Pi/r)}}}else this._layout={...this._layout,[t.id]:{x:Math.round(e),y:Math.round(i)}};this._dirtyPos.add(t.id),this._persistLayout()}_stateClass(t){if(!this._config?.live_states)return"";const e=t.primary?this.hass.states[t.primary]:void 0;if(!e)return"";if("unavailable"===e.state)return"unavail";const i=t.primary.split(".")[0];if(["light","switch","fan","humidifier"].includes(i))return"on"===e.state?"on":"";if("cover"===i||"valve"===i)return["open","opening"].includes(e.state)?"open":"";if("lock"===i)return["unlocked","open"].includes(e.state)?"open":"";if("binary_sensor"===i){const t=e.attributes?.device_class;if(["door","window","garage_door","opening","gas","smoke","moisture","problem"].includes(t))return"on"===e.state?"open":""}return"media_player"===i?["playing","on"].includes(e.state)?"on":"":"vacuum"===i&&["cleaning","returning"].includes(e.state)?"on":""}_liveTemp(t){return this._config?.show_temperature?"mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon?null:si(this.hass,t.entities):null}_liveHum(t){return this._config?.show_temperature&&t.primary&&oi(this.hass,t.primary)?ni(this.hass,t.entities):null}_openMoreInfo(t){t?Ni(this,"hass-more-info",{entityId:t}):this._showToast(this._t("toast.no_entity"))}_clickDevice(t,e){if(t.stopPropagation(),this._drag?.moved||this._suppressClick||this._holdFired)return;if("plan"===this._mode)return;if("devices"===this._mode)return void this._openMarkerDialog(e);const i=e.primary?e.primary.split(".")[0]:null,s=function(t,e,i){const s=t||e||"info";return"more-info"===s?"more-info":"toggle"!==s||!i||He.has(i)?"info":"toggle"===t||Fe.has(i)?"toggle":"info"}(e.tapAction,this._config?.tap_action,i);"toggle"===s&&e.primary?this.hass.callService("homeassistant","toggle",{entity_id:e.primary}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)}))):"more-info"===s&&e.primary?this._openMoreInfo(e.primary):this._infoCard=e}_t(t,e){return gi(ui(this.hass,this._config?.language),t,e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_stageAspect(){const t=this._stageEl,e=this._spaceModel().vb;return t&&t.clientHeight?t.clientWidth/t.clientHeight:e[2]/e[3]}_viewOr(t){return this._view&&this._view.w?this._view:qe(t,this._stageAspect())}_screenToVb(t,e){const i=this._stageEl,s=this._viewOr(this._spaceModel().vb),o=i?.clientWidth||1,n=i?.clientHeight||1;return[s.x+t/o*s.w,s.y+e/n*s.h]}_clampView(t,e){return{w:t.w,h:t.h,x:Math.max(e.x,Math.min(e.x+e.w-t.w,t.x)),y:Math.max(e.y,Math.min(e.y+e.h-t.h,t.y))}}_applyView(t,e,i){const s=this._spaceModel().vb,o=qe(s,this._stageAspect()),n=Math.min(8,Math.max(1,t)),r=o.w/n,a=o.h/n,l=this._viewOr(s),c=e??l.x+l.w/2,h=i??l.y+l.h/2;this._zoom=n,this._view=this._clampView({x:c-r/2,y:h-a/2,w:r,h:a},o)}_refitView(){if(!this._stageEl)return;const t=this._view;this._applyView(this._zoom,t?t.x+t.w/2:void 0,t?t.y+t.h/2:void 0),this.requestUpdate()}_zoomAt(t,e,i){const s=this._stageEl;if(!s)return;const o=qe(this._spaceModel().vb,this._stageAspect()),n=Math.min(8,Math.max(1,i)),r=s.clientWidth,a=s.clientHeight,l=this._screenToVb(t,e),c=o.w/n,h=o.h/n;this._zoom=n,this._view=this._clampView({x:l[0]-t/r*c,y:l[1]-e/a*h,w:c,h:h},o)}_onWheel(t){const e=this._stageEl;if(!e)return;t.preventDefault();const i=e.getBoundingClientRect(),s=t.deltaY<0?1.15:1/1.15;this._zoomAt(t.clientX-i.left,t.clientY-i.top,this._zoom*s),this._saveZoom()}_stepZoom(t){const e=this._stageEl;e&&(this._zoomAt(e.clientWidth/2,e.clientHeight/2,this._zoom*(t>0?1.4:1/1.4)),this._saveZoom())}_resetZoom(){const t=this._spaceModel().vb;this._zoom=1,this._view=qe(t,this._stageAspect()),this._saveZoom()}_saveZoom(){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(Ri,JSON.stringify(this._zoomBySpace))}catch{}}_restoreZoom(){const t=this._zoomBySpace[this._space]||1;this._zoom=t,this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const e=this._spaceModel().vb;this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),this.requestUpdate()})}_stagePointerDown(t){if(this._drag||this._markup)return;if("devices"===this._mode&&t.target.closest(".dev"))return;this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=this._viewOr(this._spaceModel().vb);if(1===this._pointers.size)this._panStart={sx:t.clientX,sy:t.clientY,vx:e.x,vy:e.y},this._suppressClick=!1;else if(2===this._pointers.size){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y);this._pinchStart={dist:e,zoom:this._zoom},this._panStart=null}}_stagePointerMove(t){if(this._pointers.has(t.pointerId)){if(this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this._pinchStart&&this._pointers.size>=2){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),s=(t[0].x+t[1].x)/2-i.left,o=(t[0].y+t[1].y)/2-i.top;this._zoomAt(s,o,this._pinchStart.zoom*e),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const e=t.clientX-this._panStart.sx,i=t.clientY-this._panStart.sy;if(Math.abs(e)+Math.abs(i)>4&&(this._suppressClick=!0,clearTimeout(this._holdTimer)),this._zoom>1&&this._view){const t=this._stageEl,s=this._view,o=qe(this._spaceModel().vb,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-e/t.clientWidth*s.w,y:this._panStart.vy-i/t.clientHeight*s.h,w:s.w,h:s.h},o)}}}else this._markupMove(t)}_stagePointerUp(t){this._pointers.delete(t.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,setTimeout(()=>this._suppressClick=!1,0))}_clickRoom(t){var e;!this._suppressClick&&t.area&&(e="/config/areas/area/"+t.area,history.pushState(null,"",e),Ni(window,"location-changed",{replace:!1}))}_pointerDown(t,e){if("plan"===this._mode)return;if("view"===this._mode)return this._holdFired=!1,clearTimeout(this._holdTimer),void(this._holdTimer=window.setTimeout(()=>{this._holdFired=!0,this._infoCard=e},600));t.preventDefault();const i=this._pos(e);this._drag={id:e.id,sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},t.target.setPointerCapture(t.pointerId),this._tip=null}_pointerMove(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const s=this._spaceModel().vb,o=i.getBoundingClientRect(),n=this._viewOr(s),r=(t.clientX-this._drag.sx)/o.width*n.w,a=(t.clientY-this._drag.sy)/o.height*n.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0,clearTimeout(this._holdTimer));const l=.008*Math.min(s[2],s[3]),c=Math.max(s[0]+l,Math.min(s[0]+s[2]-l,this._drag.ox+r)),h=Math.max(s[1]+l,Math.min(s[1]+s[3]-l,this._drag.oy+a));this._savePos(e,c,h)}_pointerUp(t,e){if(clearTimeout(this._holdTimer),!this._drag||this._drag.id!==e.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=e.id,window.setTimeout(()=>this._drag=null,0))}_resetLayout(){confirm(this._t("confirm.reset_layout"))&&(this._layout={},this._persistLayout())}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}_showTip(t,e,i,s,o){this._drag||(this._tip={x:t.clientX,y:t.clientY,title:e,meta:i,lqi:s,temp:o})}get _gridPitch(){return Pi/240}get _cellCm(){const t=Number(this._curSpaceCfg?.cell_cm);return Number.isFinite(t)&&t>0?t:5}_fmtLen(t,e){const i=function(t,e,i,s){return Math.hypot(e[0]-t[0],e[1]-t[1])/i*s}(t,e,this._gridPitch,this._cellCm);return function(t,e){if(e){const e=t/2.54;let i=Math.floor(e/12),s=Math.round(e-12*i);return 12===s&&(i+=1,s=0),`${i}′ ${s}″`}return`${(t/100).toFixed(2)} m`}(i,"mi"===this.hass?.config?.unit_system?.length)}get _curSpaceCfg(){return this._serverCfg?.spaces.find(t=>t.id===this._space)}get _spaceH(){const t=this._curSpaceCfg;return t?Pi/t.aspect:Pi}get _segments(){const t=this._curSpaceCfg,e=this._spaceH;return xe(t?.rooms||[]).map(t=>[t[0]*Pi,t[1]*e,t[2]*Pi,t[3]*e])}_setMode(t){this._mode!==t&&("plan"!==t||this._norm?(this._mode=t,this._path=[],this._cursorPt=null,this._tool="draw",this._mergeSel=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._selId=null,this._tip=null):this._showToast(this._t("toast.markup_needs_server")))}_svgPoint(t){const e=this.renderRoot.querySelector(".stage").getBoundingClientRect();return this._screenToVb(t.clientX-e.left,t.clientY-e.top)}_snap(t){const e=this._gridPitch;return[be(t[0],e),be(t[1],e)]}_samePt(t,e){return Se(t,e)}_dropLegacySegments(){for(const t of this._serverCfg?.spaces||[])delete t.segments}_roomAt(t){return this._spaceModel().rooms.find(e=>{const i=we(e);return!!i&&Ae(t,i)})}_overlapRoom(t){return this._spaceModel().rooms.find(e=>{const i=we(e);return!!i&&function(t,e,i=1e-6){if(!t||!e||t.length<3||e.length<3)return!1;for(let i=0;i<t.length;i++)for(let s=0;s<e.length;s++)if(ze(t[i],t[(i+1)%t.length],e[s],e[(s+1)%e.length]))return!0;return Te(t,e,i)||Te(e,t,i)}(t,i)})}_pointInRoom(t,e){return e.poly?Ce(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_markupClick(t){if(!this._markup)return;const e=this._svgPoint(t);if("delroom"===this._tool){const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(e,t));if(!t)return;if(!confirm(this._t("confirm.delete_room",{name:t.name})))return;const i=this._curSpaceCfg;return i.rooms=i.rooms.filter(e=>e.id!==t.id),this._saveConfig(),this._regSignature="",this._maybeRebuildDevices(),void this.requestUpdate()}if("opening"===this._tool)return void this._openingClick(e);if("merge"===this._tool)return void this._mergeClick(e);if("split"===this._tool)return void this._splitClick(e);const i=this._snap(e),s=this._path.length>=3&&this._samePt(i,this._path[0]);if(!s){const t=this._roomAt(i);if(t)return void this._showToast(this._t("toast.point_in_room",{name:t.name||""}))}if(!this._path.length)return void(this._path=[i]);const o=this._path[this._path.length-1];if(!this._samePt(i,o)){if(s){const t=this._overlapRoom(this._path);return t?void this._showToast(this._t("toast.room_overlap",{name:t.name||""})):(this._path=[...this._path,i],this._cursorPt=null,this._nameSel="",this._areaSel="",void(this._roomDialog=!0))}this._path=[...this._path,i]}}get _openingsR(){const t=this._curSpaceCfg,e=this._spaceH;return(t?.openings||[]).map(t=>({...t,rx:t.x*Pi,ry:t.y*e,rlen:t.length*Pi}))}_cmToUnits(t){return t/this._cellCm*this._gridPitch}_openingClick(t){const e=1.5*this._gridPitch,i=this._openingsR.find(i=>Math.hypot(t[0]-i.rx,t[1]-i.ry)<=Math.max(i.rlen/2,e));if(i)return void this._editOpening(i);const s=$e(t,this._spaceModel().rooms,e);s?this._openingDialog={type:"door",lengthCm:90,contact:"",lock:"",invert:!1,flipH:!1,flipV:!1,x:s.x,y:s.y,angle:s.angle}:this._showToast(this._t("toast.opening_no_wall"))}_editOpening(t){this._openingDialog={id:t.id,type:t.type,lengthCm:Math.round(t.rlen/this._gridPitch*this._cellCm),contact:t.contact||"",lock:t.lock||"",invert:!!t.invert,flipH:!!t.flip_h,flipV:!!t.flip_v,x:t.rx,y:t.ry,angle:t.angle}}_opPointerDown(t,e){if("plan"===this._mode){t.preventDefault(),t.stopPropagation();try{t.target.setPointerCapture?.(t.pointerId)}catch{}this._opDrag={id:e.id,moved:!1}}}_opPointerMove(t,e){if(!this._opDrag||this._opDrag.id!==e.id)return;const i=$e(this._svgPoint(t),this._spaceModel().rooms,4*this._gridPitch);if(!i)return;this._opDrag.moved=!0;const s=this._curSpaceCfg,o=s?.openings?.find(t=>t.id===e.id);o&&(o.x=i.x/Pi,o.y=i.y/this._spaceH,o.angle=i.angle,this.requestUpdate())}_opPointerUp(t,e){if(!this._opDrag||this._opDrag.id!==e.id)return;const i=this._opDrag.moved;i&&this._saveConfig(),i?window.setTimeout(()=>this._opDrag=null,0):this._opDrag=null}_opClick(t,e){t.stopPropagation(),this._opDrag?.moved||"plan"===this._mode&&this._editOpening(e)}_saveOpening(){const t=this._openingDialog,e=this._curSpaceCfg;if(!t||!e)return;const i=this._spaceH,s={id:t.id||"o"+Date.now().toString(36),type:t.type,x:t.x/Pi,y:t.y/i,angle:t.angle,length:this._cmToUnits(Math.max(20,t.lengthCm))/Pi,contact:t.contact||null,lock:"door"===t.type&&t.lock||null,invert:t.invert||void 0,flip_h:t.flipH||void 0,flip_v:t.flipV||void 0};e.openings=e.openings||[];const o=e.openings.findIndex(t=>t.id===s.id);o>=0?e.openings[o]=s:e.openings.push(s),this._saveConfig(),this._openingDialog=null,this.requestUpdate()}_deleteOpening(){const t=this._openingDialog,e=this._curSpaceCfg;t?.id&&e?.openings&&(e.openings=e.openings.filter(e=>e.id!==t.id),this._saveConfig(),this._openingDialog=null,this.requestUpdate())}_contactCandidates(){const t=[];for(const e of Object.keys(this.hass.states)){const i=e.split(".")[0];if("binary_sensor"!==i&&"cover"!==i)continue;const s=this.hass.states[e],o=["door","window","opening","garage_door","garage"].includes(s?.attributes?.device_class||"");("cover"!==i||o)&&t.push([e,s?.attributes?.friendly_name||e,o?0:1])}return t.sort((t,e)=>t[2]-e[2]||t[1].localeCompare(e[1])).map(([t,e])=>({value:t,label:e}))}_lockCandidates(){return Object.keys(this.hass.states).filter(t=>t.startsWith("lock.")).map(t=>({value:t,label:this.hass.states[t]?.attributes?.friendly_name||t})).sort((t,e)=>t.label.localeCompare(e.label))}_mergeClick(t){const e=this._spaceModel().rooms,i=[...e].reverse().find(e=>this._pointInRoom(t,e));if(!i?.id)return;const s=i.id;if(!this._mergeSel||this._mergeSel===s)return void(this._mergeSel=this._mergeSel===s?null:s);const o=e.find(t=>t.id===this._mergeSel),n=o?we(o):null,r=we(i),a=n&&r?Ne(n,r):null;if(!a)return this._showToast(this._t("toast.merge_not_adjacent")),void(this._mergeSel=null);this._mergeDialog={aId:this._mergeSel,bId:s,poly:a,pick:"a"},this._mergeSel=null}_commitMerge(){const t=this._mergeDialog,e=this._curSpaceCfg;if(!t||!e)return;const i=this._spaceH,s="a"===t.pick?t.aId:t.bId,o="a"===t.pick?t.bId:t.aId,n=e.rooms.find(t=>t.id===s);n?(n.poly=t.poly.map(t=>[t[0]/Pi,t[1]/i]),delete n.x,delete n.y,delete n.w,delete n.h,e.rooms=e.rooms.filter(t=>t.id!==o),this._saveConfig(),this._mergeDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.rooms_merged",{name:n.name||""}))):this._mergeDialog=null}_splitClick(t){const e=this._spaceModel().rooms;if(!this._splitSel){const i=[...e].reverse().find(e=>this._pointInRoom(t,e));if(!i?.id)return;return void(this._splitSel={roomId:i.id,a:null})}const i=e.find(t=>t.id===this._splitSel.roomId),s=i?we(i):null;if(!i||!s)return void(this._splitSel=null);const o=.02*this._gridPitch,n=6*this._gridPitch,r=function(t,e){if(!e||e.length<2)return null;let i=null,s=1/0;for(let o=0;o<e.length;o++){const n=e[o],r=e[(o+1)%e.length],a=r[0]-n[0],l=r[1]-n[1],c=a*a+l*l;let h=c?((t[0]-n[0])*a+(t[1]-n[1])*l)/c:0;h=Math.max(0,Math.min(1,h));const p=[n[0]+h*a,n[1]+h*l],d=Math.hypot(t[0]-p[0],t[1]-p[1]);d<s&&(s=d,i=p)}return i}(t,s),a=r&&Math.hypot(r[0]-t[0],r[1]-t[1])<=n?r:null;if(!a||!De(a,s,o))return void this._showToast(this._t("toast.split_pick_wall"));if(!this._splitSel.a)return void(this._splitSel={...this._splitSel,a:a});const l=Ie(s,this._splitSel.a,a,o);if(!l)return void this._showToast(this._t("toast.split_bad_cut"));const[c,h]=l,p=Re(c)>=Re(h)?c:h,d=p===c?h:c;this._pendingSplit={roomId:i.id,mainPoly:p,newPoly:d},this._cursorPt=null,this._nameSel="",this._areaSel="",this._roomDialog=!0}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])}_markupMove(t){if(!this._markup)return;const e="draw"===this._tool&&this._path.length&&!this._contourClosed,i="split"===this._tool&&!!this._splitSel?.a;(e||i)&&(this._cursorPt=this._snap(this._svgPoint(t)))}_saveRoom(){this._areaSel&&this._commitRoom()}_saveRoomNoArea(){this._nameSel.trim()&&(this._areaSel="",this._commitRoom())}_commitRoom(){const t=this._curSpaceCfg;if(!t)return;const e=this._spaceH;let i;if(this._pendingSplit){const s=t.rooms.find(t=>t.id===this._pendingSplit.roomId);if(!s)return this._pendingSplit=null,this._splitSel=null,void(this._roomDialog=!1);s.poly=this._pendingSplit.mainPoly.map(t=>[t[0]/Pi,t[1]/e]),delete s.x,delete s.y,delete s.w,delete s.h,i=this._pendingSplit.newPoly}else{if(!this._contourClosed)return;i=this._path.slice(0,-1)}const s=this._areaSel?this.hass.areas[this._areaSel]?.name:"";t.rooms.push({id:"r"+Date.now().toString(36),name:this._nameSel||s||this._t("room.default_name"),area:this._areaSel||null,poly:i.map(t=>[t[0]/Pi,t[1]/e])}),this._saveConfig(),this._path=[],this._pendingSplit=null,this._splitSel=null;const o=this._areaSel;this._areaSel="",this._nameSel="",this._roomDialog=!1,this._regSignature="",this._maybeRebuildDevices();let n=0;if(o){const t=this._serverCfg?.spaces.find(t=>t.id===this._space)?.aspect||1,e=Pi/t,i={...this._layout};for(const t of this._devices){if(t.area!==o||t.space!==this._space)continue;if(n++,this._layout[t.id])continue;const s=this._defPos[t.id];s&&(i[t.id]={s:this._space,x:s.x/Pi,y:s.y/e},this._dirtyPos.add(t.id))}this._layout=i,this._persistLayout()}const r=this._model.find(t=>t.id===this._space)?.rooms.length||0;this._showToast(o?this._t("toast.room_saved",{n:r,added:n}):this._t("toast.room_saved_no_area",{n:r}))}_cancelPath(){this._path=[],this._cursorPt=null,this._roomDialog=!1,this._pendingSplit=null,this._splitSel=null,this._mergeSel=null,this._mergeDialog=null}_roomDialogCancel(){if(this._roomDialog=!1,this._pendingSplit)return this._pendingSplit=null,void(this._splitSel=null);this._undoPoint()}get _freeAreas(){const t=new Set;for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.add(i.area);return Object.values(this.hass?.areas||{}).filter(e=>!t.has(e.area_id)).sort((t,e)=>(t.name||"").localeCompare(e.name||""))}_openMarkerDialog(t){t&&this._ackNewDevice(t.id),this._norm?this._markerDialog=t?{devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingFilter:"",icon:t.marker?.icon||"",display:t.marker?.display||"badge",rippleColor:t.marker?.ripple_color||"",rippleSize:Number(t.marker?.ripple_size)>0?Number(t.marker.ripple_size):3,size:Number(t.marker?.size)>0?Number(t.marker.size):1,angle:Number(t.marker?.angle)||0,tapAction:t.marker?.tap_action||"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.marker?.room_id?t.space+"#@"+t.marker.room_id:t.space&&t.area?t.space+"#"+t.area:"",busy:!1}:{name:"",binding:"virtual",bindingFilter:"",icon:"",display:"badge",rippleColor:"",rippleSize:3,size:1,angle:0,tapAction:"",model:"",link:"",description:"",pdfs:[],room:"",busy:!1}:this._showToast(this._t("toast.marker_needs_server"))}_bindingCandidates(){const t=this.hass,e=new Set;for(const t of this._devices)t.id!==this._markerDialog?.devId&&("device"===t.bindingKind&&t.bindingRef&&e.add("device:"+t.bindingRef),"entity"===t.bindingKind&&t.bindingRef&&e.add("entity:"+t.bindingRef));const i=new Set;for(const t of this._devices)"device"===t.bindingKind&&t.name&&i.add(t.name.trim()+"|"+(t.area||""));const s=[];for(const o of Object.values(t.devices)){if("service"===o.entry_type)continue;const t="device:"+o.id;if(e.has(t))continue;const n=(o.name_by_user||o.name||o.id).trim();t!==this._markerDialog?.binding&&i.has(n+"|"+(o.area_id||""))||s.push({value:t,label:n,sub:(o.model||this._t("marker.sub_device"))+("Group"===o.model?this._t("marker.sub_z2m_group"):"")})}const o=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);for(const[i,n]of Object.entries(t.entities)){const r="entity:"+i;if(e.has(r))continue;const a=o.has(n.platform),l="group"===n.platform;if(!a&&!l)continue;if(n.hidden)continue;const c=t.states[i];s.push({value:r,label:n.name||c?.attributes?.friendly_name||i,sub:i.split(".")[0]+" · "+("group"===n.platform?this._t("marker.sub_group"):this._t("marker.sub_helper"))})}const n=(this._markerDialog?.bindingFilter||"").toLowerCase().trim();if(n){const i=new Set(s.map(t=>t.value));for(const[o,r]of Object.entries(t.entities)){const a="entity:"+o;if(e.has(a)||i.has(a)||r.hidden)continue;const l=t.states[o],c=r.name||l?.attributes?.friendly_name||o,h=r.device_id?t.devices[r.device_id]:null,p=h&&(h.name_by_user||h.name)||"";(c+" "+o+" "+p).toLowerCase().includes(n)&&s.push({value:a,label:c,sub:o.split(".")[0]+" · "+this._t("marker.sub_entity")+(p?" · "+p:"")})}}const r=(this._markerDialog?.bindingFilter||"").toLowerCase().trim(),a=r?s.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(r)):s;return a.sort((t,e)=>t.label.localeCompare(e.label)),a.slice(0,200)}_allRoomsFlat(){const t=[];for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area?t.push({value:e.id+"#"+i.area,label:(e.title||e.id)+" · "+i.name}):i.id&&t.push({value:e.id+"#@"+i.id,label:(e.title||e.id)+" · "+i.name+" · "+this._t("marker.subarea")});return t}_errText(t){if(!t)return this._t("err.unknown");if("string"==typeof t)return t;if(t.message)return t.message;if(t.error)return t.error;if(null!=t.code)return this._t("err.code",{code:t.code});try{return JSON.stringify(t)}catch{return String(t)}}async _pickMarkerFiles(t){const e=t.target,i=e.files?[...e.files]:[];if(e.value="",!i.length||!this._markerDialog)return;const s=this._markerDialog.devId||"new",o=[];for(const t of i)try{const e=new FormData;e.append("marker_id",s),e.append("file",t,t.name);const i=this.hass?.fetchWithAuth?await this.hass.fetchWithAuth("/api/houseplan/upload",{method:"POST",body:e}):await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:this.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.hass.auth.data.access_token}`}:{}}),n=await i.json().catch(()=>({}));if(!i.ok||n.error){const t={too_large:this._t("err.too_large",{mb:n.max_mb||50}),bad_ext:this._t("err.bad_ext"),unauthorized:this._t("err.unauthorized")};throw new Error(t[n.error]||n.error||"HTTP "+i.status)}o.push({name:n.name||t.name,url:n.url})}catch(e){this._showToast(this._t("toast.file_failed",{name:t.name,err:this._errText(e)}))}o.length&&this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:[...this._markerDialog.pdfs,...o]},this._showToast(this._t("toast.files_attached",{n:o.length})))}_removeMarkerPdf(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:this._markerDialog.pdfs.filter(e=>e.url!==t)})}async _saveMarker(){const t=this._markerDialog;if(t&&!t.busy)if("virtual"!==t.binding||t.name.trim()){this._markerDialog={...t,busy:!0};try{const e=this._serverCfg;let i;e.markers=e.markers||[];const s=function(t){if(!t)return null;const e=t.indexOf("#");if(e<=0)return null;const i=t.slice(0,e),s=t.slice(e+1);if(!s)return null;if(s.startsWith("@")){const t=s.slice(1);return t?{space:i,area:null,roomId:t}:null}return{space:i,area:s,roomId:null}}(t.room);let o=s?.space||null,n=s?.area||null;const r=s?.roomId||null;"virtual"!==t.binding||o||(o=this._space),i=function(t,e,i){const[s,o]=t.split(":");return"device"===s?o:"entity"===s?"lg_"+o:e&&e.startsWith("v_")?e:i()}(t.binding,t.devId,()=>"v_"+Date.now().toString(36));const a=t.devId,l={id:i,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,display:"badge"!==t.display?t.display:null,ripple_color:"badge"!==t.display&&t.rippleColor?t.rippleColor:null,ripple_size:"badge"!==t.display&&3!==t.rippleSize?t.rippleSize:null,size:1!==t.size?t.size:null,angle:t.angle?t.angle:null,tap_action:t.tapAction||null,model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs};("virtual"===t.binding||t.room)&&(l.space=o,l.area=n,l.room_id=r);const c=a?this._devices.find(t=>t.id===a):null,h=c?.marker?.room_id??null,p=!!t.room&&null!=c&&(c.space!==o||c.area!==n||h!==r);e.markers=e.markers.filter(t=>t.id!==i&&t.id!==a),e.markers.push(l);let d=null;if(!this._layout[i]||p){const t=this._spaceModel(o||void 0);let e=t.vb[0]+t.vb[2]/2,s=t.vb[1]+t.vb[3]/2;const a=r?t.rooms.find(t=>t.id===r):n?t.rooms.find(t=>t.area===n):void 0;a&&([e,s]=this._roomCenter(a)),d=this._normPos(o||this._space,e,s),this._layout={...this._layout,[i]:d}}await this._saveConfigNow(),d&&await this.hass.callWS({type:"houseplan/layout/update",device_id:i,pos:d}),a&&a!==i&&(delete this._layout[a],await this.hass.callWS({type:"houseplan/layout/delete",device_id:a}).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_saved"))}catch(t){this._markerDialog={...this._markerDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}else this._showToast(this._t("toast.virtual_name_required"))}async _deleteMarker(){const t=this._markerDialog;if(!t)return;const e=t.devId?this._devices.find(e=>e.id===t.devId):null,i=t.name||this._t("device.fallback");if(!confirm(this._t("confirm.remove_marker",{name:i})))return;const s=this._serverCfg;s.markers=s.markers||[],e&&"virtual"===e.bindingKind?s.markers=s.markers.filter(t=>t.id!==e.id):e&&e.marker?(s.markers=s.markers.filter(t=>t.id!==e.id),"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0})):e&&"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):e&&"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0});try{await this._saveConfigNow(),e&&"virtual"===e.bindingKind&&this._layout[e.id]&&(delete this._layout[e.id],await this.hass.callWS({type:"houseplan/layout/delete",device_id:e.id}).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_removed"))}catch(t){this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_normPos(t,e,i){const s=this._serverCfg.spaces.find(e=>e.id===t)?.aspect||1;return{s:t,x:e/Pi,y:i/(Pi/s)}}_openSpaceDialog(t,e){if(this._serverStorage&&this._serverCfg)if("edit"===t){const i=this._serverCfg.spaces.find(t=>t.id===e);if(!i)return;const s=We(i);this._spaceDialog={mode:t,spaceId:e,title:i.title,planUrl:i.plan_url||null,planFile:null,source:i.plan_url?"file":"draw",orientation:"landscape",showBorders:s.showBorders,showNames:s.showNames,roomColor:s.color,roomOpacity:s.opacity,fillMode:s.fill,tempMin:s.tempMin,tempMax:s.tempMax,showLqi:s.showLqi??this._config?.show_signal??!0,cellCm:Number(i.cell_cm)>0?Number(i.cell_cm):5,busy:!1}}else this._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,source:"file",orientation:"landscape",showBorders:!1,showNames:!1,roomColor:je,roomOpacity:Ge,fillMode:"none",tempMin:20,tempMax:25,showLqi:this._config?.show_signal??!0,cellCm:5,busy:!1};else this._showToast(this._t("toast.integration_missing"))}async _pickPlanFile(t){const e=t.target,i=e.files?.[0];if(!i||!this._spaceDialog)return;const s={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[i.type]||(i.name.toLowerCase().endsWith(".svg")?"svg":"");if(!s)return void this._showToast(this._t("toast.plan_formats"));const o=new Uint8Array(await i.arrayBuffer());let n="";for(let t=0;t<o.length;t+=32768)n+=String.fromCharCode(...o.subarray(t,t+32768));const r=btoa(n),a=URL.createObjectURL(i),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=a});URL.revokeObjectURL(a),this._spaceDialog={...this._spaceDialog,planFile:{ext:s,b64:r,aspect:l,name:i.name}}}async _saveSpaceDialog(){const t=this._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this._showToast(this._t("toast.plan_required"));const e="create"===t.mode&&0===(this._serverCfg?.spaces.length||0);this._spaceDialog={...t,busy:!0};try{const i=this._serverCfg;let s;const o="portrait"===t.orientation?.707:"square"===t.orientation?1:1.414;if("create"===t.mode?(s={id:"s"+Date.now().toString(36),title:t.title.trim(),plan_url:null,aspect:"draw"===t.source?o:1.414,view_box:[0,0,1,1],rooms:[]},i.spaces.push(s)):(s=i.spaces.find(e=>e.id===t.spaceId),s.title=t.title.trim()),"file"===t.source&&t.planFile){const e=await this.hass.callWS({type:"houseplan/plan/set",space_id:s.id,ext:t.planFile.ext,data:t.planFile.b64});s.plan_url=e.url,s.aspect=t.planFile.aspect}"draw"===t.source&&(s.plan_url=null);const n="draw"===t.source;s.settings={...s.settings||{},show_borders:!(!n||"create"!==t.mode)||t.showBorders,show_names:!(!n||"create"!==t.mode)||t.showNames,room_color:t.roomColor,room_opacity:t.roomOpacity,fill_mode:t.fillMode,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):20,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):25,show_lqi:t.showLqi},s.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?t.cellCm:5,await this._saveConfigNow(),this._spaceDialog=null,"create"===t.mode&&(this._space=s.id),this._regSignature="",this._maybeRebuildDevices(),this._importQueue.length?this._openNextImport():e||this._importTotal>0?(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._mode="plan",this._tool="draw",this._path=[],this._cursorPt=null,this._showToast(this._t(e&&!this._importTotal?"toast.space_added_onboard":"import.done"))):this._showToast("create"===t.mode?this._t("toast.space_added"):this._t("toast.space_saved"))}catch(t){this._spaceDialog={...this._spaceDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}async _deleteSpace(){const t=this._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this._serverCfg.spaces.find(e=>e.id===t.spaceId);if(confirm(this._t("confirm.delete_space",{title:e.title}))){this._serverCfg.spaces=this._serverCfg.spaces.filter(e=>e.id!==t.spaceId);try{await this._saveConfigNow(),this._spaceDialog=null,this._space===t.spaceId&&(this._space=this._serverCfg.spaces[0]?.id||""),this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.space_deleted"))}catch(t){this._showToast(this._t("toast.delete_failed",{err:this._errText(t)}))}}}async _saveConfigNow(){this._dropLegacySegments();try{const t=await this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev});this._cfgRev=t?.rev??this._cfgRev+1}catch(t){throw"conflict"===t?.code&&await this._reloadConfigOnly(),t}}_startImport(){const t=this._importDialog;if(!t)return;const e=t.floors.filter(t=>t.checked).map(t=>t.name);this._importDialog=null,e.length?(this._importQueue=e,this._importTotal=e.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this._importQueue.shift();void 0!==t&&(this._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,source:"file",orientation:"landscape",showBorders:!1,showNames:!1,roomColor:je,roomOpacity:Ge,fillMode:"none",tempMin:20,tempMax:25,showLqi:this._config?.show_signal??!0,cellCm:5,busy:!1})}_skipImport(){this._spaceDialog=null,this._importQueue.length?this._openNextImport():this._importTotal>0&&this._model.length&&(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._mode="plan",this._showToast(this._t("import.done")))}_renderImportDialog(){const t=this._importDialog,e=t.floors.filter(t=>t.checked).length;return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:home-floor-1"></ha-icon>${this._t("import.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("import.hint")}</div>
          ${t.floors.map((e,i)=>H`<label class="floorrow">
              <input type="checkbox" .checked=${e.checked}
                @change=${s=>{const o=[...t.floors];o[i]={...e,checked:s.target.checked},this._importDialog={floors:o}}} />
              <span>${e.name}</span>
              ${null!=e.level?H`<span class="floorlvl">L${e.level}</span>`:W}
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
    </div>`}_setFillColor(t,e){const i=this._settingsDialog;this._settingsDialog={...i,colors:{...i.colors,[t]:{...i.colors[t],...e}}}}async _saveSettingsDialog(){const t=this._settingsDialog;if(t&&!t.busy){this._settingsDialog={...t,busy:!0};try{const e=this._serverCfg,i=JSON.stringify(t.colors)===JSON.stringify(Ve),s={...e.settings};i?delete s.fill_colors:s.fill_colors=t.colors,this._serverCfg={...e,settings:s},await this._saveConfigNow(),this._settingsDialog=null,this.requestUpdate(),this._showToast(this._t("gs.saved"))}catch(t){this._settingsDialog={...this._settingsDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}}_renderColorRow(t,e){const i=this._settingsDialog.colors[t];return H`<div class="colorrow gsrow">
      <span class="gsl">${this._t(e)}</span>
      <input type="color" .value=${i.c}
        @input=${e=>this._setFillColor(t,{c:e.target.value})} />
      <input type="range" min="0" max="100" .value=${String(Math.round(100*i.a))}
        @input=${e=>this._setFillColor(t,{a:Number(e.target.value)/100})} />
      <span class="opv">${Math.round(100*i.a)}%</span>
    </div>`}_renderSettingsDialog(){return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:cog-outline"></ha-icon>${this._t("gs.title")}</div>
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
        </div>
        <div class="row">
          <button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,colors:JSON.parse(JSON.stringify(Ve))}}>
            ${this._t("gs.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._settingsDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSettingsDialog} ?disabled=${this._settingsDialog.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this._settingsDialog.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_rulesSet(t){this._rulesDialog={...this._rulesDialog,rules:t}}async _saveRules(){const t=this._rulesDialog;if(!t||t.busy)return;const e=t.rules.filter(t=>t.pattern.trim()&&t.icon.trim());this._rulesDialog={...t,busy:!0};try{const t=this._serverCfg,i=JSON.stringify(e)===JSON.stringify(pt),s={...t.settings};i?delete s.icon_rules:s.icon_rules=e,this._serverCfg={...t,settings:s},await this._saveConfigNow(),this._rulesDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("rules.saved"))}catch(t){this._rulesDialog={...this._rulesDialog,busy:!1},this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_renderRulesDialog(){const t=this._rulesDialog,e=dt(t.rules),i=t.test.trim()?mt(t.test,"",e):null,s=(e,i)=>{const s=[...t.rules],o=e+i;o<0||o>=s.length||([s[e],s[o]]=[s[o],s[e]],this._rulesSet(s))};return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t("rules.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("rules.hint")}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this._t("rules.test_ph")}
              .value=${t.test}
              @input=${e=>this._rulesDialog={...t,test:e.target.value}} />
            ${i?H`<ha-icon icon=${i}></ha-icon><span class="rtesticon">${i}</span>`:W}
          </div>
          ${t.rules.map((e,i)=>{const o=""!==e.pattern.trim()&&!function(t){try{return new RegExp(t,"i"),!0}catch{return!1}}(e.pattern);return H`<div class="rrow">
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
          <button class="btn ghost" @click=${()=>this._rulesSet(pt.map(t=>({...t})))}>
            ${this._t("rules.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._rulesDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveRules} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}render(){if(!this._config||!this.hass)return W;const t=this._model;if(!t.length)return H`<ha-card>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||this._t("card.title")}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>${this._t("empty.no_spaces")}</p>
          ${this._serverStorage?H`<p class="muted">${this._t("empty.add_first")}</p>
                <button class="btn on" @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>${this._t("btn.add_space")}
                </button>`:H`<p class="muted">${this._t("empty.install")}</p>`}
        </div>
        ${this._spaceDialog?this._renderSpaceDialog():W}
        ${this._importDialog?this._renderImportDialog():W}
        ${this._toast?H`<div class="toast">${this._toast}</div>`:W}
      </ha-card>`;const e=this._spaceModel(),i=e.vb,s=this._devices.filter(t=>t.space===e.id),o=We(this._curSpaceCfg),n=o.showLqi??this._config.show_signal??!0,r=this._config.icon_size??2.5,a=r>8?2.5:r,l=this._viewOr(i);return H`
      <ha-card>
        <div class="hdr">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title||this._t("card.title")}
          </div>
          <div class="tabs">
            ${t.map(t=>H`<button
                class="tab ${this._space===t.id?"active":""}"
                @click=${()=>{this._space=t.id,this._selId=null,this._restoreZoom()}}
              >
                ${t.title}${this._norm&&this._canEdit?H`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t("title.configure_space")}
                      @click=${e=>{e.stopPropagation(),this._openSpaceDialog("edit",t.id)}}></ha-icon>`:W}
              </button>`)}
            ${this._norm&&"plan"===this._mode?H`<button class="tab tabadd" title=${this._t("title.add_space")}
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`:W}
          </div>
          ${this._canEdit?H`<div class="modes">
                ${[["plan","mdi:floor-plan"],["devices","mdi:tune-variant"]].map(([t,e])=>H`<button class="modetab ${this._mode===t?"active":""}"
                    title=${this._t("mode."+t)}
                    @click=${()=>{this._mode!==t&&this._setMode(t)}}>
                    <ha-icon icon=${e}></ha-icon><span class="ml">${this._t("mode."+t)}</span>
                    ${this._mode===t?H`<ha-icon class="closex" icon="mdi:close" title=${this._t("title.close_editor")}
                          @click=${t=>{t.stopPropagation(),this._setMode("view")}}></ha-icon>`:W}
                  </button>`)}
              </div>`:W}
          <span class="count">${this._t("count.devices",{n:s.length})}</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${()=>this._stepZoom(-1)} title=${this._t("title.zoom_out")}><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._resetZoom()} ?disabled=${1===this._zoom}
              title=${this._t("title.zoom_reset")}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._stepZoom(1)} title=${this._t("title.zoom_in")}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm&&this._canEdit?H`<button class="btn" @click=${this._openSettingsDialog} title=${this._t("title.general_settings")}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>`:W}
        </div>
        ${this._markup?this._renderMarkupBar():"devices"===this._mode?this._renderDevicesBar():W}
        </div>

        <div class="stage ${this._markup?"markup":""} ${e.bg?"":"noplan"} mode-${this._mode}"
          style="height:calc(100dvh - 118px)"
          @click=${t=>this._markupClick(t)}
          @wheel=${t=>this._onWheel(t)}
          @pointerdown=${t=>this._stagePointerDown(t)}
          @pointermove=${t=>this._stagePointerMove(t)}
          @pointerup=${t=>this._stagePointerUp(t)}
          @pointercancel=${t=>this._stagePointerUp(t)}>
          <div class="zoomwrap">
          <svg viewBox="${l.x} ${l.y} ${l.w} ${l.h}" preserveAspectRatio="xMidYMid meet">
            ${this._markup?this._renderMarkupDefs(i):W}
            ${e.bg?j`<image href="${e.bg.href}" x="${e.bg.x}" y="${e.bg.y}" width="${e.bg.w}" height="${e.bg.h}" preserveAspectRatio="none" />`:W}
            ${e.rooms.filter(t=>t.area||this._markup||o.showBorders).map(t=>{let i="room "+(e.bg?"overlay":"yard")+(this._markup?" outlined":"");!this._markup||t.id!==this._mergeSel&&t.id!==this._splitSel?.roomId||(i+=" picked");let s="";if(!this._markup&&(o.showBorders||"none"!==o.fill)){i+=" styled";const e=[];e.push(`--room-stroke:${o.color}`,`--room-stroke-op:${o.showBorders?o.opacity:0}`);const n=t.area?Je(o.fill,"lqi"===o.fill?this._roomLqi(t.area):null,"light"===o.fill?ci(this.hass,this._devices,t.area):"none","temp"===o.fill?hi(this.hass,this._devices,t.area):null,o.tempMin,o.tempMax,this._fillColors):null;n?(i+=" filled",e.push(`--room-fill:${n.c}`,`--room-fill-op:${n.a.toFixed(3)}`)):e.push("--room-fill:transparent","--room-fill-op:0"),s=e.join(";")}const r=e=>this._showTip(e,t.name,this._t("tip.room"),n?this._roomLqi(t.area):null,t.area?hi(this.hass,this._devices,t.area):null),a=!e.bg&&!o.showNames||this._markup,l=this._roomCenter(t),c=t.poly?j`<polygon class="${i}" style="${s}" points="${t.poly.map(t=>t.join(",")).join(" ")}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${r}
                    @mouseleave=${()=>this._tip=null}></polygon>`:j`<rect class="${i}" style="${s}"
                    x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${.03*Math.min(t.w,t.h)}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${r}
                    @mouseleave=${()=>this._tip=null}></rect>`;return j`${c}${a?j`<text class="rlabel" x="${l[0]}" y="${l[1]}">${t.name}</text>`:W}`})}
            ${this._markup?this._renderMarkupLayer(i):W}
            ${this._renderOpenings(o)}
          </svg>
          <div class="devlayer" style="--icon-size:${(a*i[2]/l.w).toFixed(3)}cqw">
            ${s.map(t=>this._renderDevice(t,l,n))}
            ${this._renderOpeningLocks(l)}
            ${o.showNames&&!this._markup?e.rooms.map(t=>this._renderRoomLabel(t,e,l,o)):W}
          </div>
          ${this._measureAnchor?H`<div class="measurelayer">${this._renderMeasureLabel(l)}</div>`:W}
          </div>
          ${this._zoom>1?H`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:W}
        </div>

        ${this._roomDialog?this._renderRoomDialog():W}
        ${this._mergeDialog?this._renderMergeDialog():W}
        ${this._openingDialog?this._renderOpeningDialog():W}
        ${this._openingInfo?this._renderOpeningInfoCard():W}
        ${this._spaceDialog?this._renderSpaceDialog():W}
        ${this._markerDialog?this._renderMarkerDialog():W}
        ${this._infoCard?this._renderInfoCard():W}
        ${this._rulesDialog?this._renderRulesDialog():W}
        ${this._settingsDialog?this._renderSettingsDialog():W}
        ${this._importDialog?this._renderImportDialog():W}
        ${this._tip?H`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?H`<span class="m">${this._tip.meta}</span>`:W}
              ${null!=this._tip.temp?H`<span class="m">${this._t("tip.temp_avg")} <b>${this._tip.temp}°</b></span>`:W}
              ${null!=this._tip.lqi?H`<span class="m">${this._t("tip.lqi")}
                    <b style="color:${ve(this._tip.lqi)}">${this._tip.lqi}</b></span>`:W}
            </div>`:W}
        ${this._toast?H`<div class="toast">${this._toast}</div>`:W}
      </ha-card>
    `}_renderDevice(t,e,i=!0){const s=this._pos(t),o=(s.x-e.x)/e.w*100,n=(s.y-e.y)/e.h*100,r=this._stateClass(t),a=this._liveTemp(t),l=this._liveHum(t),c=i&&!t.virtual?ii(this.hass,t.entities):null,h=t.marker,p=h?.display||"badge",d="ripple"===p||"icon_ripple"===p,u=t.primary?this.hass.states[t.primary]:void 0,g="value"===p?null!=a?a+"°":null!=l?l+"%":u&&!isNaN(parseFloat(u.state))?parseFloat(u.state)+(u.attributes?.unit_of_measurement?" "+u.attributes.unit_of_measurement:""):null:null,_=t.primary?t.primary.split(".")[0]:null,m=this._config?.live_states?function(t,e,i,s,o){if(o||!s||"unavailable"===s||"unknown"===s)return t;if("binary_sensor"===e){if("door"===i)return"on"===s?"mdi:door-open":"mdi:door-closed";if("window"===i)return"on"===s?"mdi:window-open":"mdi:window-closed";if("garage_door"===i)return"on"===s?"mdi:garage-open-variant":"mdi:garage-variant"}return"lock"===e?"locked"===s?"mdi:lock":"mdi:lock-open-variant":"light"===e&&"mdi:lightbulb"===t&&"on"===s?"mdi:lightbulb-on":t}(t.icon,_,u?.attributes?.device_class,u?.state,!!h?.icon):t.icon,f=this._config?.live_states&&"light"===_?function(t){if(!t||"on"!==t.state)return null;const e=t.attributes?.rgb_color;return Array.isArray(e)&&e.length>=3&&e.every(t=>Number.isFinite(t))?`rgb(${e[0]}, ${e[1]}, ${e[2]})`:null}(u):null,v=this._config?.live_states&&function(t,e,i){return"on"===i&&("siren"===t||"binary_sensor"===t&&!!e&&Xe.has(e))}(_,u?.attributes?.device_class,u?.state),b=d&&!!t.primary&&ke(this.hass.states[t.primary]?.state),y=Number(h?.size)>0?Number(h.size):1,w=Number(h?.angle)||0,x=Number(h?.ripple_size)>0?Number(h.ripple_size):3,$=[`left:${o}%`,`top:${n}%`];return 1!==y&&$.push(`--dev-scale:${y}`),d&&($.push(`--ripple-scale:${x}`),h?.ripple_color?$.push(`--ripple-color:${h.ripple_color}`):f&&$.push(`--ripple-color:${f}`)),f&&$.push(`--light-color:${f}`),H`<div
      class="dev ${r} ${this._selId===t.id?"sel":""} ${t.virtual?"virtual":""} ${"ripple"===p?"noicon":""} ${null!=g?"valonly":""} ${f?"rgb":""} ${v?"alarm":""}"
      style="${$.join(";")}"
      @click=${e=>this._clickDevice(e,t)}
      @mousemove=${e=>this._showTip(e,t.name,t.model+(null!=a?" · "+a+"°":"")+(null!=l?" · "+l+"%":"")+(null!=c?" · LQI "+c:""))}
      @mouseleave=${()=>this._tip=null}
      @pointerdown=${e=>this._pointerDown(e,t)}
      @pointermove=${e=>this._pointerMove(e,t)}
      @pointerup=${e=>this._pointerUp(e,t)}
      @pointercancel=${e=>this._pointerUp(e,t)}
    >
      ${d?H`<span class="ripple ${b?"active":""}"><i></i><i></i><i></i></span>`:W}
      ${this._newIds.has(t.id)?H`<span class="newdot" title=${this._t("device.new")}></span>`:W}
      ${null!=g?H`<span class="valtext">${g}</span>`:"ripple"!==p?H`<ha-icon icon="${m}" style=${w?`transform:rotate(${w}deg)`:W}></ha-icon>`:W}
      ${null!=a&&null==g?H`<span class="tval">${a}°</span>`:W}
      ${null!=l&&null==g?H`<span class="hval">${l}%</span>`:W}
      ${null!=c?H`<span class="lqi" style="color:${ve(c)}">${c}</span>`:W}
    </div>`}_labelPos(t,e){const i=this._layout["rl_"+(t.id||"")];if(i&&i.s===e){const t=this._serverCfg.spaces.find(t=>t.id===e)?.aspect||1;return{x:i.x*Pi,y:i.y*(Pi/t)}}const s=this._roomCenter(t);return{x:s[0],y:s[1]}}_labelDown(t,e,i){if("plan"!==this._mode)return;t.preventDefault(),t.stopPropagation();const s=this._labelPos(e,i);this._drag={id:"rl_"+(e.id||""),sx:t.clientX,sy:t.clientY,ox:s.x,oy:s.y,moved:!1},t.target.setPointerCapture(t.pointerId),this._tip=null}_labelMove(t,e,i){const s="rl_"+(e.id||"");if(!this._drag||this._drag.id!==s)return;const o=this._stageEl;if(!o)return;const n=this._spaceModel(i).vb,r=o.getBoundingClientRect(),a=this._viewOr(n),l=(t.clientX-this._drag.sx)/r.width*a.w,c=(t.clientY-this._drag.sy)/r.height*a.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0);const h=.008*Math.min(n[2],n[3]),p=Math.max(n[0]+h,Math.min(n[0]+n[2]-h,this._drag.ox+l)),d=Math.max(n[1]+h,Math.min(n[1]+n[3]-h,this._drag.oy+c));this._savePos({id:s,space:i},p,d)}_labelUp(t){const e="rl_"+(t.id||"");if(!this._drag||this._drag.id!==e)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&window.setTimeout(()=>this._drag=null,0)}_renderRoomLabel(t,e,i,s){if(!t.name)return W;const o=this._labelPos(t,e.id),n=(o.x-i.x)/i.w*100,r=(o.y-i.y)/i.h*100,a=Math.min(1,s.opacity+.25);return H`<div class="roomlabel" style="left:${n}%;top:${r}%;color:${s.color};opacity:${a}"
      @pointerdown=${i=>this._labelDown(i,t,e.id)}
      @pointermove=${i=>this._labelMove(i,t,e.id)}
      @pointerup=${()=>this._labelUp(t)}
      @pointercancel=${()=>this._labelUp(t)}
    >${t.name}</div>`}get _measureAnchor(){return this._markup&&this._cursorPt?"draw"===this._tool&&this._path.length&&!this._contourClosed?this._path[this._path.length-1]:"split"===this._tool&&this._splitSel?.a?this._splitSel.a:null:null}_renderMeasureLabel(t){const e=this._measureAnchor,i=this._cursorPt,s=(i[0]-t.x)/t.w*100,o=(i[1]-t.y)/t.h*100;return H`<div class="measurelabel" style="left:${s}%;top:${o}%">${this._fmtLen(e,i)}</div>`}_roomCenter(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}_openingAmt(t){const e=t.contact?this.hass.states[t.contact]?.state:null;return function(t,e,i=!1){return null==e||"unavailable"===e||"unknown"===e?"door"===t?1:0:ke(e)!==!!i?1:0}(t.type,e,!!t.invert)}_renderOpenings(t){const e=this._openingsR;if(!e.length)return j``;const i=t.color;return j`${e.map(t=>{const e=t.rlen/2,s=this._openingAmt(t),o=s>0&&!!t.contact?"var(--hp-open)":i,n=t.flip_h?-1:1,r=t.flip_v?-1:1;let a;if("window"===t.type){const t=Math.PI/2*e;a=j`
          <path class="op-arc" d="M 0 0 A ${e} ${e} 0 0 0 ${-e} ${-e}" fill="none"
            stroke="${o}" stroke-dasharray="${t}" stroke-dashoffset="${t*(1-s)}"></path>
          <path class="op-arc" d="M 0 0 A ${e} ${e} 0 0 1 ${e} ${-e}" fill="none"
            stroke="${o}" stroke-dasharray="${t}" stroke-dashoffset="${t*(1-s)}"></path>
          <g transform="translate(${-e} 0)">
            <g class="op-leaf" style="transform:rotate(${-90*s}deg)">
              <rect x="0" y="-1.5" width="${e}" height="3" fill="${o}"></rect>
            </g>
          </g>
          <g transform="translate(${e} 0)">
            <g class="op-leaf" style="transform:rotate(${90*s}deg)">
              <rect x="${-e}" y="-1.5" width="${e}" height="3" fill="${o}"></rect>
            </g>
          </g>`}else{const i=t.rlen,n=Math.PI/2*i;a=j`
          <path class="op-arc" d="M ${e} 0 A ${i} ${i} 0 0 0 ${-e} ${-i}" fill="none"
            stroke="${o}" stroke-dasharray="${n}" stroke-dashoffset="${n*(1-s)}"></path>
          <g transform="translate(${-e} 0)">
            <g class="op-leaf" style="transform:rotate(${-90*s}deg)">
              <rect x="0" y="-1.75" width="${i}" height="3.5" fill="${o}"></rect>
            </g>
          </g>`}return j`<g class="opening" transform="translate(${t.rx} ${t.ry}) rotate(${t.angle})">
        <g transform="scale(${n} ${r})">
          <line x1="${-e}" y1="${-4}" x2="${-e}" y2="${4}" stroke="${i}" stroke-width="2.5"></line>
          <line x1="${e}" y1="${-4}" x2="${e}" y2="${4}" stroke="${i}" stroke-width="2.5"></line>
          ${a}
        </g>
        <rect class="op-outline" x="${-e-10}" y="-16" width="${t.rlen+20}" height="32" rx="6"></rect>
        <rect class="op-hit" x="${-e-12}" y="-20" width="${t.rlen+24}" height="40"
          @click=${e=>this._opClick(e,t)}
          @pointerdown=${e=>this._opPointerDown(e,t)}
          @pointermove=${e=>this._opPointerMove(e,t)}
          @pointerup=${e=>this._opPointerUp(e,t)}
          @pointercancel=${e=>this._opPointerUp(e,t)}></rect>
      </g>`})}`}_renderOpeningLocks(t){const e=this._openingsR.filter(t=>"door"===t.type&&t.lock);return e.length?H`${e.map(e=>{const i=this.hass.states[e.lock]?.state,s="locked"===i,o=s||["unlocked","open","opening","unlocking","locking"].includes(String(i)),n=(e.angle+90)*Math.PI/180,r=16*(e.flip_v?-1:1),a=e.rx+Math.cos(n)*r,l=e.ry+Math.sin(n)*r,c=(a-t.x)/t.w*100,h=(l-t.y)/t.h*100;return H`<div class="oplock ${s?"locked":o?"unlocked":"unknown"}"
        style="left:${c}%;top:${h}%"
        @click=${t=>{t.stopPropagation(),"view"===this._mode&&(this._openingInfo=e)}}>
        <ha-icon icon="${s?"mdi:lock":o?"mdi:lock-open-variant":"mdi:lock-question"}"></ha-icon>
      </div>`})}`:H``}_lockAction(t,e){this.hass?.callService?.("lock",e,{entity_id:t})}_renderOpeningInfoCard(){const t=this._openingInfo,e=t.contact?this.hass.states[t.contact]?.state:null,i=this._openingAmt(t),s=t.lock?this.hass.states[t.lock]?.state:null,o=(t,e,i,s="")=>H`<div class="oprow ${s}"><ha-icon icon=${t}></ha-icon><span>${e}</span><b>${i}</b></div>`;return H`<div class="menuwrap dialogwrap" @click=${()=>this._openingInfo=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon=${"door"===t.type?"mdi:door":"mdi:window-closed-variant"}></ha-icon>
          ${this._t("door"===t.type?"opening.door":"opening.window")}</div>
        <div class="body">
          ${t.contact?o(i>0?"mdi:door-open":"mdi:door-closed",this._t("opening.contact_label"),"unavailable"===e||null==e?this._t("opening.state_unknown"):this._t(i>0?"opening.open":"opening.closed"),i>0?"warn":"ok"):W}
          ${t.lock?o("locked"===s?"mdi:lock":"mdi:lock-open-variant",this._t("opening.lock_label"),"locked"===s?this._t("opening.locked"):["unlocked","open"].includes(String(s))?this._t("opening.unlocked"):this._t("opening.state_unknown"),"locked"===s?"ok":"warn"):W}
          ${t.lock&&("locked"===s||["unlocked","open"].includes(String(s)))?H`<button
                class="btn lockact ${"locked"===s?"warn":""}"
                @click=${()=>this._lockAction(t.lock,"locked"===s?"unlock":"lock")}>
                <ha-icon icon=${"locked"===s?"mdi:lock-open-variant":"mdi:lock"}></ha-icon>
                ${this._t("locked"===s?"opening.unlock_action":"opening.lock_action")}
              </button>`:t.lock&&["locking","unlocking"].includes(String(s))?H`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("opening.lock_pending")}
                </button>`:W}
          ${t.contact||t.lock?W:H`<p class="muted">${this._t("opening.no_entities")}</p>`}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingInfo=null}>${this._t("btn.close")}</button>
        </div>
      </div>
    </div>`}_renderOpeningDialog(){const t=this._openingDialog,e=(t,e,i)=>H`<select class="areasel" @change=${t=>i(t.target.value)}>
        <option value="" ?selected=${!e}>${this._t("opening.none")}</option>
        ${t.map(t=>H`<option value=${t.value} ?selected=${t.value===e}>${t.label}</option>`)}
      </select>`;return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:door"></ha-icon>
          ${t.id?this._t("opening.edit"):this._t("opening.new")}</div>
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
          ${t.contact?H`<label class="srcrow"><input type="checkbox" .checked=${t.invert}
                @change=${e=>this._openingDialog={...t,invert:e.target.checked}} />
                <span>${this._t("opening.invert")}</span></label>`:W}

          ${"door"===t.type?H`<label>${this._t("opening.lock_label")}</label>
                ${e(this._lockCandidates(),t.lock,e=>this._openingDialog={...t,lock:e})}`:W}

          <label class="srcrow"><input type="checkbox" .checked=${t.flipH}
            @change=${e=>this._openingDialog={...t,flipH:e.target.checked}} />
            <span>${this._t("opening.flip_h")}</span></label>
          <label class="srcrow"><input type="checkbox" .checked=${t.flipV}
            @change=${e=>this._openingDialog={...t,flipV:e.target.checked}} />
            <span>${this._t("opening.flip_v")}</span></label>
        </div>
        <div class="row">
          ${t.id?H`<button class="btn danger" @click=${this._deleteOpening}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:W}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveOpening}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderMarkupDefs(t){const e=this._gridPitch,i=.14*e;return j`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${e}" height="${e}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="0" cy="${e}" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="${e}" r="${i}" class="griddot"></circle>
        </pattern>
      </defs>`}_renderMarkupLayer(t){const e=this._segments,i=this._path,s=this._gridPitch;return j`
      <rect x="${t[0]}" y="${t[1]}" width="${t[2]}" height="${t[3]}" fill="url(#hp-grid)" pointer-events="none"></rect>
      ${e.map(t=>j`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${i.length>1?j`<polyline class="pathline" points="${i.map(t=>t.join(",")).join(" ")}"></polyline>`:W}
      ${i.length&&this._cursorPt&&"draw"===this._tool&&!this._contourClosed?j`<line class="preview" x1="${i[i.length-1][0]}" y1="${i[i.length-1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:W}
      ${i.map((t,e)=>j`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*s}"></circle>`)}
      ${"split"===this._tool&&this._splitSel?.a?j`<circle class="vertex first" cx="${this._splitSel.a[0]}" cy="${this._splitSel.a[1]}" r="${.22*s}"></circle>
            ${this._cursorPt?j`<line class="preview" x1="${this._splitSel.a[0]}" y1="${this._splitSel.a[1]}"
                  x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:W}`:W}
    `}_renderMarkupBar(){return H`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <button class="btn ${"draw"===this._tool?"on":""}" @click=${()=>this._tool="draw"}
        title=${this._t("title.markup_add")}>
        <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this._t("markup.add")}
      </button>
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
      <button class="btn ${"opening"===this._tool?"on":""}"
        @click=${()=>{this._cancelPath(),this._tool="opening"}}
        title=${this._t("title.markup_opening")}>
        <ha-icon icon="mdi:door"></ha-icon>${this._t("markup.opening")}
      </button>
      <button class="btn ${"delroom"===this._tool?"on":""}" @click=${()=>this._tool="delroom"}
        title=${this._t("title.markup_delroom")}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("markup.delete")}
      </button>
      <span class="spacer"></span>
      ${"draw"===this._tool?H`<span class="hint">${this._path.length?this._t("markup.hint_points",{n:this._path.length}):this._t("markup.hint_start")}</span>
            ${this._path.length?H`<button class="btn ghost" @click=${this._cancelPath}>${this._t("btn.reset")}</button>`:W}`:W}
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_renderDevicesBar(){return H`<div class="editbar devbar">
      <ha-icon icon="mdi:tune-variant" class="warn"></ha-icon>
      <button class="btn" @click=${()=>this._openMarkerDialog()} title=${this._t("title.add_device")}>
        <ha-icon icon="mdi:plus-box-outline"></ha-icon>${this._t("devbar.add")}
      </button>
      <button class="btn ${this._showAll?"on":""}" @click=${this._toggleShowAll}
        title=${this._t("title.show_all")}>
        <ha-icon icon="${this._showAll?"mdi:eye":"mdi:eye-off-outline"}"></ha-icon>${this._t("devbar.show_all")}
      </button>
      <button class="btn" @click=${this._resetLayout} title=${this._t("title.reset_layout")}>
        <ha-icon icon="mdi:backup-restore"></ha-icon>${this._t("devbar.reset")}
      </button>
      <button class="btn" @click=${this._openRulesDialog} title=${this._t("title.icon_rules")}>
        <ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t("devbar.rules")}
      </button>
      <span class="spacer"></span>
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_renderInfoCard(){const t=this._infoCard,e=t.primary?this.hass.states[t.primary]:void 0,i=e?this.hass.formatEntityState?.(e)??e.state:null;return H`<div class="menuwrap dialogwrap" @click=${()=>this._infoCard=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="${t.icon}"></ha-icon>${t.name}</div>
        <div class="body">
          ${t.model?H`<div class="inforow"><span class="k">${this._t("info.model")}</span><span>${t.model}</span></div>`:W}
          ${i?H`<div class="inforow"><span class="k">${this._t("info.state")}</span><span>${i}</span></div>`:W}
          ${Be(t.link)?H`<div class="inforow"><span class="k">${this._t("info.link")}</span>
                <a href="${Be(t.link)}" target="_blank" rel="noreferrer noopener">${t.link}</a></div>`:W}
          ${t.description?H`<div class="infodesc">${t.description}</div>`:W}
          ${t.pdfs&&t.pdfs.length?H`<div class="inforow"><span class="k">${this._t("info.manuals")}</span><span class="pdflist">
                ${t.pdfs.map(t=>H`<a class="pdf" href="${Be(t.url)||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${t.name}</a>`)}</span></div>`:W}
          ${t.model||i||t.link||t.description||t.pdfs&&t.pdfs.length?W:H`<div class="infodesc muted">${this._t("info.none")}</div>`}
        </div>
        <div class="row">
          <button class="btn" @click=${()=>{const e=t;this._infoCard=null,this._openMarkerDialog(e)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t("btn.edit")}
          </button>
          ${t.primary?H`<button class="btn" @click=${()=>{const e=t.primary;this._infoCard=null,this._openMoreInfo(e)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("btn.open_in_ha")}
              </button>`:W}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._infoCard=null}>${this._t("btn.close")}</button>
        </div>
      </div>
    </div>`}_renderMarkerDialog(){const t=this._markerDialog,e="virtual"===t.binding,i=this._bindingCandidates(),s=(()=>{if(e)return null;const s=i.find(e=>e.value===t.binding);if(s)return s.label;const[o,n]=t.binding.split(":");return"device"===o?this.hass.devices[n]?.name_by_user||this.hass.devices[n]?.name||n:this.hass.states[n]?.attributes?.friendly_name||n})();return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
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
            ${e?W:H`<div class="curbind"><ha-icon icon="mdi:link-variant"></ha-icon>
                  <b>${s}</b><span class="ref">${t.binding}</span></div>`}
            <input class="namein" type="text" placeholder=${this._t("marker.search_ph")}
              .value=${t.bindingFilter}
              @input=${e=>this._markerDialog={...t,bindingFilter:e.target.value}} />
            <div class="candlist">
              ${i.map(e=>H`<div class="cand ${e.value===t.binding?"sel":""}"
                  @click=${()=>this._markerDialog={...t,binding:e.value}}>
                  <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                </div>`)}
              ${i.length?W:H`<div class="cand muted">${this._t("marker.nothing_found")}</div>`}
            </div>
          </div>

          <label>${this._t("marker.room_label")}${e?"":this._t("marker.room_override")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,room:e.target.value}}>
            <option value="">${e?this._t("marker.room_choose"):this._t("marker.room_auto")}</option>
            ${this._allRoomsFlat().map(e=>H`<option value=${e.value} ?selected=${e.value===t.room}>${e.label}</option>`)}
          </select>

          <label>${this._t("marker.tap_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,tapAction:e.target.value}}>
            ${[["","tap.auto"],["info","tap.info"],["more-info","tap.more_info"],["toggle","tap.toggle"]].map(([e,i])=>H`<option value=${e} ?selected=${(t.tapAction||"")===e}>${this._t(i)}</option>`)}
          </select>

          <label>${this._t("marker.icon_label")}</label>
          ${customElements.get("ha-icon-picker")?H`<ha-icon-picker .hass=${this.hass} .value=${t.icon}
                @value-changed=${e=>this._markerDialog={...t,icon:e.detail.value||""}}></ha-icon-picker>`:H`<input class="namein" type="text" placeholder=${this._t("marker.icon_ph")}
                .value=${t.icon}
                @input=${e=>this._markerDialog={...t,icon:e.target.value}} />`}

          <label>${this._t("marker.display_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,display:e.target.value}}>
            ${[["badge","display.badge"],["ripple","display.ripple"],["icon_ripple","display.icon_ripple"],["value","display.value"]].map(([e,i])=>H`<option value=${e} ?selected=${t.display===e}>${this._t(i)}</option>`)}
          </select>
          ${"ripple"===t.display||"icon_ripple"===t.display?H`<div class="colorrow">
                <input type="color" .value=${t.rippleColor||"#3ea6ff"}
                  @input=${e=>this._markerDialog={...t,rippleColor:e.target.value}} />
                <span class="opl">${this._t("marker.ripple_size")}</span>
                <input type="range" min="2" max="8" step="0.5" .value=${String(t.rippleSize)}
                  @input=${e=>this._markerDialog={...t,rippleSize:Number(e.target.value)}} />
                <span class="opv">×${t.rippleSize}</span>
              </div>`:W}

          <label>${this._t("marker.size_label")}</label>
          <div class="colorrow">
            <input type="range" min="0.5" max="3" step="0.1" .value=${String(t.size)}
              @input=${e=>this._markerDialog={...t,size:Number(e.target.value)}} />
            <span class="opv">×${t.size.toFixed(1)}</span>
            <span class="opl">${this._t("marker.angle_label")}</span>
            <input type="range" min="0" max="350" step="10" .value=${String(t.angle)}
              @input=${e=>this._markerDialog={...t,angle:Number(e.target.value)}} />
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
            ${t.pdfs.map(t=>H`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${Be(t.url)||"#"}" target="_blank" rel="noreferrer noopener">${t.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${()=>this._removeMarkerPdf(t.url)}></ha-icon></span>`)}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>${this._t("btn.attach")}
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${t=>this._pickMarkerFiles(t)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${t.devId?H`<button class="btn danger" @click=${this._deleteMarker}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.remove")}
              </button>`:W}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._markerDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveMarker} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderSpaceDialog(){const t=this._spaceDialog;return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>
          ${"create"===t.mode?this._t("space.new"):this._t("space.header")}
          ${this._importTotal>0&&"create"===t.mode?H`<span class="importprog">${this._t("import.progress",{i:this._importTotal-this._importQueue.length,n:this._importTotal})}</span>`:W}</div>
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
          ${"file"===t.source?H`<div class="planrow">
                ${t.planFile?H`<span class="planname">${t.planFile.name}</span>`:t.planUrl?H`<img class="planprev" src=${t.planUrl} alt=${this._t("space.plan_alt")} />`:H`<span class="planname muted">${this._t("space.no_plan")}</span>`}
                <label class="btn filebtn">
                  <ha-icon icon="mdi:upload"></ha-icon>${t.planUrl||t.planFile?this._t("btn.replace"):this._t("btn.upload")}
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${t=>this._pickPlanFile(t)} />
                </label>
              </div>`:W}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"draw"===t.source}
              @change=${()=>this._spaceDialog={...t,source:"draw"}} />
            <span>${this._t("space.source_draw")}</span>
          </label>
          ${"draw"===t.source&&"create"===t.mode?H`<label>${this._t("space.orientation")}</label>
              <select class="areasel"
                @change=${e=>this._spaceDialog={...t,orientation:e.target.value}}>
                ${[["landscape","orient.landscape"],["portrait","orient.portrait"],["square","orient.square"]].map(([e,i])=>H`<option value=${e} ?selected=${t.orientation===e}>${this._t(i)}</option>`)}
              </select>`:W}

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
          <label class="srcrow">
            <input type="checkbox" .checked=${t.showLqi}
              @change=${e=>this._spaceDialog={...t,showLqi:e.target.checked}} />
            <span>${this._t("space.show_lqi")}</span>
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
          ${[["none","fill.none"],["lqi","fill.lqi"],["light","fill.light"],["temp","fill.temp"]].map(([e,i])=>H`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===e}
                @change=${()=>this._spaceDialog={...t,fillMode:e}} />
              <span>${this._t(i)}</span>
              ${"temp"===e&&"temp"===t.fillMode?H`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMin)}
                      @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._spaceDialog={...t,tempMin:i})}} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMax)}
                      @input=${e=>{const i=parseFloat(e.target.value);Number.isFinite(i)&&(this._spaceDialog={...t,tempMax:i})}} />
                    °C
                  </span>`:W}
            </label>`)}
        </div>
        <div class="row">
          ${"edit"===t.mode?H`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:W}
          <span class="spacer"></span>
          ${this._importTotal>0&&"create"===t.mode?H`<button class="btn ghost" @click=${()=>this._skipImport()}>${this._t("btn.skip")}</button>`:W}
          <button class="btn ghost" @click=${()=>{this._spaceDialog=null,this._importQueue=[],this._importTotal=0}}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
            title=${"file"!==t.source||t.planFile||t.planUrl?"":this._t("title.need_plan")}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderMergeDialog(){const t=this._mergeDialog,e=this._spaceModel().rooms,i=(i,s)=>{const o=e.find(t=>t.id===i),n=o?.area?this.hass.areas[o.area]?.name:null;return H`<label class="srcrow">
        <input type="radio" name="mergekeep" .checked=${t.pick===s}
          @change=${()=>this._mergeDialog={...t,pick:s}} />
        <span>${o?.name||""} <span class="muted">· ${n||this._t("merge.no_area")}</span></span>
      </label>`};return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:vector-union"></ha-icon>${this._t("merge.header")}</div>
        <div class="body">
          <p class="muted">${this._t("merge.hint")}</p>
          <label>${this._t("merge.keep")}</label>
          ${i(t.aId,"a")}
          ${i(t.bId,"b")}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._mergeDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._commitMerge}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderRoomDialog(){const t=this._freeAreas;return H`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
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
            ${t.map(t=>H`<option value=${t.area_id} ?selected=${t.area_id===this._areaSel}>${t.name}</option>`)}
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
    </div>`}}Ii.properties={hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_mode:{state:!0},_tool:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_mergeSel:{state:!0},_openingDialog:{state:!0},_openingInfo:{state:!0},_mergeDialog:{state:!0},_splitSel:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_rulesDialog:{state:!0},_settingsDialog:{state:!0},_importDialog:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},Ii.styles=mi,customElements.get("houseplan-card")||customElements.define("houseplan-card",Ii),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-card"===t.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Interactive house plan: spaces, rooms and devices with live states and drag layout."}),console.info("%c HOUSEPLAN-CARD %c v1.30.3 ","background:#3ea6ff;color:#04121f;font-weight:700","");
