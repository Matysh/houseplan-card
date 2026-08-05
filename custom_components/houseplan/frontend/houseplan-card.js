const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let o=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const n=(t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(s,t,i)},r=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:a,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:h,getOwnPropertySymbols:d,getPrototypeOf:p}=Object,u=globalThis,_=u.trustedTypes,g=_?_.emptyScript:"",m=u.reactiveElementPolyfillSupport,f=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?g:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!a(t,e),y={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),u.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=y){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:o}=c(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);o?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??y}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...h(t),...d(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(r(t))}else void 0!==t&&e.push(r(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),o=t.litNonce;void 0!==o&&s.setAttribute("nonce",o),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==o?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const n=o.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(void 0!==t){const n=this.constructor;if(!1===s&&(o=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==o||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[f("elementProperties")]=new Map,w[f("finalized")]=new Map,m?.({ReactiveElement:w}),(u.reactiveElementVersions??=[]).push("2.1.2");const $=globalThis,x=t=>t,k=$.trustedTypes,S=k?k.createPolicy("lit-html",{createHTML:t=>t}):void 0,M="$lit$",D=`lit$${Math.random().toFixed(9).slice(2)}$`,C="?"+D,T=`<${C}>`,z=document,P=()=>z.createComment(""),R=t=>null===t||"object"!=typeof t&&"function"!=typeof t,A=Array.isArray,E="[ \t\n\f\r]",N=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,O=/-->/g,I=/>/g,F=RegExp(`>|${E}(?:([^\\s"'>=/]+)(${E}*=${E}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),L=/'/g,q=/"/g,H=/^(?:script|style|textarea|title)$/i,U=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),B=U(1),j=U(2),W=Symbol.for("lit-noChange"),V=Symbol.for("lit-nothing"),G=new WeakMap,K=z.createTreeWalker(z,129);function Y(t,e){if(!A(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const X=(t,e)=>{const i=t.length-1,s=[];let o,n=2===e?"<svg>":3===e?"<math>":"",r=N;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,h=0;for(;h<i.length&&(r.lastIndex=h,l=r.exec(i),null!==l);)h=r.lastIndex,r===N?"!--"===l[1]?r=O:void 0!==l[1]?r=I:void 0!==l[2]?(H.test(l[2])&&(o=RegExp("</"+l[2],"g")),r=F):void 0!==l[3]&&(r=F):r===F?">"===l[0]?(r=o??N,c=-1):void 0===l[1]?c=-2:(c=r.lastIndex-l[2].length,a=l[1],r=void 0===l[3]?F:'"'===l[3]?q:L):r===q||r===L?r=F:r===O||r===I?r=N:(r=F,o=void 0);const d=r===F&&t[e+1].startsWith("/>")?" ":"";n+=r===N?i+T:c>=0?(s.push(a),i.slice(0,c)+M+i.slice(c)+D+d):i+D+(-2===c?e:d)}return[Y(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Z{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,n=0;const r=t.length-1,a=this.parts,[l,c]=X(t,e);if(this.el=Z.createElement(l,i),K.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=K.nextNode())&&a.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(M)){const e=c[n++],i=s.getAttribute(t).split(D),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:o,name:r[2],strings:i,ctor:"."===r[1]?it:"?"===r[1]?st:"@"===r[1]?ot:et}),s.removeAttribute(t)}else t.startsWith(D)&&(a.push({type:6,index:o}),s.removeAttribute(t));if(H.test(s.tagName)){const t=s.textContent.split(D),e=t.length-1;if(e>0){s.textContent=k?k.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],P()),K.nextNode(),a.push({type:2,index:++o});s.append(t[e],P())}}}else if(8===s.nodeType)if(s.data===C)a.push({type:2,index:o});else{let t=-1;for(;-1!==(t=s.data.indexOf(D,t+1));)a.push({type:7,index:o}),t+=D.length-1}o++}}static createElement(t,e){const i=z.createElement("template");return i.innerHTML=t,i}}function J(t,e,i=t,s){if(e===W)return e;let o=void 0!==s?i._$Co?.[s]:i._$Cl;const n=R(e)?void 0:e._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),void 0===n?o=void 0:(o=new n(t),o._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=o:i._$Cl=o),void 0!==o&&(e=J(t,o._$AS(t,e.values),o,s)),e}class Q{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??z).importNode(e,!0);K.currentNode=s;let o=K.nextNode(),n=0,r=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new tt(o,o.nextSibling,this,t):1===a.type?e=new a.ctor(o,a.name,a.strings,this,t):6===a.type&&(e=new nt(o,this,t)),this._$AV.push(e),a=i[++r]}n!==a?.index&&(o=K.nextNode(),n++)}return K.currentNode=z,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=V,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=J(this,t,e),R(t)?t===V||null==t||""===t?(this._$AH!==V&&this._$AR(),this._$AH=V):t!==this._$AH&&t!==W&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>A(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==V&&R(this._$AH)?this._$AA.nextSibling.data=t:this.T(z.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Z.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new Q(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=G.get(t.strings);return void 0===e&&G.set(t.strings,e=new Z(t)),e}k(t){A(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new tt(this.O(P()),this.O(P()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=x(t).nextSibling;x(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=V,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=V}_$AI(t,e=this,i,s){const o=this.strings;let n=!1;if(void 0===o)t=J(this,t,e,0),n=!R(t)||t!==this._$AH&&t!==W,n&&(this._$AH=t);else{const s=t;let r,a;for(t=o[0],r=0;r<o.length-1;r++)a=J(this,s[i+r],e,r),a===W&&(a=this._$AH[r]),n||=!R(a)||a!==this._$AH[r],a===V?t=V:t!==V&&(t+=(a??"")+o[r+1]),this._$AH[r]=a}n&&!s&&this.j(t)}j(t){t===V?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class it extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===V?void 0:t}}class st extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==V)}}class ot extends et{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=J(this,t,e,0)??V)===W)return;const i=this._$AH,s=t===V&&i!==V||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==V&&(i===V||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class nt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){J(this,t)}}const rt=$.litHtmlPolyfillSupport;rt?.(Z,tt),($.litHtmlVersions??=[]).push("3.3.3");const at=globalThis;class lt extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let o=s._$litPart$;if(void 0===o){const t=i?.renderBefore??null;s._$litPart$=o=new tt(e.insertBefore(P(),t),t,void 0,i??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return W}}lt._$litElement$=!0,lt.finalized=!0,at.litElementHydrateSupport?.({LitElement:lt});const ct=at.litElementPolyfillSupport;ct?.({LitElement:lt}),(at.litElementVersions??=[]).push("4.2.2");const ht=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),dt=[{pattern:"протечк|leak|water sensor",icon:"mdi:water-alert"},{pattern:"клапан|valve",icon:"mdi:pipe-valve"},{pattern:"дым|smoke",icon:"mdi:smoke-detector"},{pattern:"термоголов|trv|radiator",icon:"mdi:radiator"},{pattern:"чайник|kettle|термопот",icon:"mdi:kettle"},{pattern:"сауна|sauna|harvia|парная|парилк",icon:"mdi:hot-tub"},{pattern:"температ|temperature|climate sensor",icon:"mdi:thermometer"},{pattern:"qingping|air monitor|молекул|air quality",icon:"mdi:air-filter"},{pattern:"штор|curtain|blind|shade",icon:"mdi:roller-shade"},{pattern:"розетк|plug|socket|outlet",icon:"mdi:power-socket-de"},{pattern:"выключат|switch",icon:"mdi:light-switch"},{pattern:"лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip",icon:"mdi:lightbulb"},{pattern:"камер|camera",icon:"mdi:cctv"},{pattern:"замок|ttlock|lock|sn609|sn9161",icon:"mdi:lock"},{pattern:"ворота|garage|gate",icon:"mdi:garage-variant"},{pattern:"калитк|door|открыт|contact",icon:"mdi:door"},{pattern:"счётчик|счетчик|kws|meter",icon:"mdi:meter-electric"},{pattern:"вводный автомат|breaker|wifimcbn",icon:"mdi:electric-switch"},{pattern:"myheat|котёл|котел|boiler|отоплен|heating",icon:"mdi:water-boiler"},{pattern:"холодильник|fridge",icon:"mdi:fridge"},{pattern:"стиральн|washer|washing",icon:"mdi:washing-machine"},{pattern:"сушилк|dryer",icon:"mdi:tumble-dryer"},{pattern:"пылесос|vacuum|dreame|roborock",icon:"mdi:robot-vacuum"},{pattern:"soundbar",icon:"mdi:soundbar"},{pattern:"колонк|станц|speaker|яндекс|yandex|алиса|alice",icon:"mdi:speaker"},{pattern:"tv|телевизор|hyundaitv|mitv|television",icon:"mdi:television"},{pattern:"keenetic|роутер|router|mesh|access point",icon:"mdi:router-wireless"},{pattern:"ибп|ups|kirpich",icon:"mdi:battery-charging-high"},{pattern:"slzb|координат|zigbee|coordinator",icon:"mdi:zigbee"},{pattern:"motion|движен|presence|присутств",icon:"mdi:motion-sensor"},{pattern:"humidity|влажн",icon:"mdi:water-percent"}];function pt(t){const e=[];for(const i of t)if(i&&"string"==typeof i.pattern&&i.icon)try{e.push({re:new RegExp(i.pattern,"i"),icon:i.icon})}catch{}return e}const ut=pt(dt),_t={temperature:"mdi:thermometer",humidity:"mdi:water-percent",motion:"mdi:motion-sensor",occupancy:"mdi:motion-sensor",door:"mdi:door",window:"mdi:window-closed",garage_door:"mdi:garage-variant",smoke:"mdi:smoke-detector",moisture:"mdi:water-alert",gas:"mdi:gas-cylinder",power:"mdi:meter-electric",energy:"mdi:meter-electric",illuminance:"mdi:brightness-5",co2:"mdi:molecule-co2",pm25:"mdi:air-filter",battery:"mdi:battery"},gt="mdi:chip";function mt(t,e,i){const s=((t||"")+" "+(e||"")).toLowerCase();for(const{re:t,icon:e}of i??ut)if(t.test(s))return e;return gt}const ft=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];var vt=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,bt=Math.ceil,yt=Math.floor,wt="[BigNumber Error] ",$t=wt+"Number primitive has more than 15 significant digits: ",xt=1e14,kt=14,St=9007199254740991,Mt=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],Dt=1e7,Ct=1e9;function Tt(t){var e=0|t;return t>0||t===e?e:e-1}function zt(t){for(var e,i,s=1,o=t.length,n=t[0]+"";s<o;){for(e=t[s++]+"",i=kt-e.length;i--;e="0"+e);n+=e}for(o=n.length;48===n.charCodeAt(--o););return n.slice(0,o+1||1)}function Pt(t,e){var i,s,o=t.c,n=e.c,r=t.s,a=e.s,l=t.e,c=e.e;if(!r||!a)return null;if(i=o&&!o[0],s=n&&!n[0],i||s)return i?s?0:-a:r;if(r!=a)return r;if(i=r<0,s=l==c,!o||!n)return s?0:!o^i?1:-1;if(!s)return l>c^i?1:-1;for(a=(l=o.length)<(c=n.length)?l:c,r=0;r<a;r++)if(o[r]!=n[r])return o[r]>n[r]^i?1:-1;return l==c?0:l>c^i?1:-1}function Rt(t,e,i,s){if(t<e||t>i||t!==yt(t))throw Error(wt+(s||"Argument")+("number"==typeof t?t<e||t>i?" out of range: ":" not an integer: ":" not a primitive number: ")+String(t))}function At(t){var e=t.c.length-1;return Tt(t.e/kt)==e&&t.c[e]%2!=0}function Et(t,e){return(t.length>1?t.charAt(0)+"."+t.slice(1):t)+(e<0?"e":"e+")+e}function Nt(t,e,i){var s,o;if(e<0){for(o=i+".";++e;o+=i);t=o+t}else if(++e>(s=t.length)){for(o=i,e-=s;--e;o+=i);t+=o}else e<s&&(t=t.slice(0,e)+"."+t.slice(e));return t}var Ot=function t(e){var i,s,o,n,r,a,l,c,h,d,p=M.prototype={constructor:M,toString:null,valueOf:null},u=new M(1),_=20,g=4,m=-7,f=21,v=-1e7,b=1e7,y=!1,w=1,$=0,x={prefix:"",groupSize:3,secondaryGroupSize:0,groupSeparator:",",decimalSeparator:".",fractionGroupSize:0,fractionGroupSeparator:" ",suffix:""},k="0123456789abcdefghijklmnopqrstuvwxyz",S=!0;function M(t,e){var i,n,r,a,l,c,h,d,p=this;if(!(p instanceof M))return new M(t,e);if(null==e){if(t&&!0===t._isBigNumber)return p.s=t.s,void(!t.c||t.e>b?p.c=p.e=null:t.e<v?p.c=[p.e=0]:(p.e=t.e,p.c=t.c.slice()));if((c="number"==typeof t)&&0*t==0){if(p.s=1/t<0?(t=-t,-1):1,t===~~t){for(a=0,l=t;l>=10;l/=10,a++);return void(a>b?p.c=p.e=null:(p.e=a,p.c=[t]))}d=String(t)}else{if(!vt.test(d=String(t)))return o(p,d,c);p.s=45==d.charCodeAt(0)?(d=d.slice(1),-1):1}(a=d.indexOf("."))>-1&&(d=d.replace(".","")),(l=d.search(/e/i))>0?(a<0&&(a=l),a+=+d.slice(l+1),d=d.substring(0,l)):a<0&&(a=d.length)}else{if(Rt(e,2,k.length,"Base"),10==e&&S)return z(p=new M(t),_+p.e+1,g);if(d=String(t),c="number"==typeof t){if(0*t!=0)return o(p,d,c,e);if(p.s=1/t<0?(d=d.slice(1),-1):1,M.DEBUG&&d.replace(/^0\.0*|\./,"").length>15)throw Error($t+t)}else p.s=45===d.charCodeAt(0)?(d=d.slice(1),-1):1;for(i=k.slice(0,e),a=l=0,h=d.length;l<h;l++)if(i.indexOf(n=d.charAt(l))<0){if("."==n){if(l>a){a=h;continue}}else if(!r&&(d==d.toUpperCase()&&(d=d.toLowerCase())||d==d.toLowerCase()&&(d=d.toUpperCase()))){r=!0,l=-1,a=0;continue}return o(p,String(t),c,e)}c=!1,(a=(d=s(d,e,10,p.s)).indexOf("."))>-1?d=d.replace(".",""):a=d.length}for(l=0;48===d.charCodeAt(l);l++);for(h=d.length;48===d.charCodeAt(--h););if(d=d.slice(l,++h)){if(h-=l,c&&M.DEBUG&&h>15&&(t>St||t!==yt(t)))throw Error($t+p.s*t);if((a=a-l-1)>b)p.c=p.e=null;else if(a<v)p.c=[p.e=0];else{if(p.e=a,p.c=[],l=(a+1)%kt,a<0&&(l+=kt),l<h){for(l&&p.c.push(+d.slice(0,l)),h-=kt;l<h;)p.c.push(+d.slice(l,l+=kt));l=kt-(d=d.slice(l)).length}else l-=h;for(;l--;d+="0");p.c.push(+d)}}else p.c=[p.e=0]}function D(t,e,i,s){var o,n,r,a,l;if(null==i?i=g:Rt(i,0,8),!t.c)return t.toString();if(o=t.c[0],r=t.e,null==e)l=zt(t.c),l=1==s||2==s&&(r<=m||r>=f)?Et(l,r):Nt(l,r,"0");else if(n=(t=z(new M(t),e,i)).e,a=(l=zt(t.c)).length,1==s||2==s&&(e<=n||n<=m)){for(;a<e;l+="0",a++);l=Et(l,n)}else if(e-=r+(2===s&&n>r),l=Nt(l,n,"0"),n+1>a){if(--e>0)for(l+=".";e--;l+="0");}else if((e+=n-a)>0)for(n+1==a&&(l+=".");e--;l+="0");return t.s<0&&o?"-"+l:l}function C(t,e){for(var i,s,o=1,n=new M(t[0]);o<t.length;o++)(!(s=new M(t[o])).s||(i=Pt(n,s))===e||0===i&&n.s===e)&&(n=s);return n}function T(t,e,i){for(var s=1,o=e.length;!e[--o];e.pop());for(o=e[0];o>=10;o/=10,s++);return(i=s+i*kt-1)>b?t.c=t.e=null:i<v?t.c=[t.e=0]:(t.e=i,t.c=e),t}function z(t,e,i,s){var o,n,r,a,l,c,h,d=t.c,p=Mt;if(d){t:{for(o=1,a=d[0];a>=10;a/=10,o++);if((n=e-o)<0)n+=kt,r=e,l=d[c=0],h=yt(l/p[o-r-1]%10);else if((c=bt((n+1)/kt))>=d.length){if(!s)break t;for(;d.length<=c;d.push(0));l=h=0,o=1,r=(n%=kt)-kt+1}else{for(l=a=d[c],o=1;a>=10;a/=10,o++);h=(r=(n%=kt)-kt+o)<0?0:yt(l/p[o-r-1]%10)}if(s=s||e<0||null!=d[c+1]||(r<0?l:l%p[o-r-1]),s=i<4?(h||s)&&(0==i||i==(t.s<0?3:2)):h>5||5==h&&(4==i||s||6==i&&(n>0?r>0?l/p[o-r]:0:d[c-1])%10&1||i==(t.s<0?8:7)),e<1||!d[0])return d.length=0,s?(e-=t.e+1,d[0]=p[(kt-e%kt)%kt],t.e=-e||0):d[0]=t.e=0,t;if(0==n?(d.length=c,a=1,c--):(d.length=c+1,a=p[kt-n],d[c]=r>0?yt(l/p[o-r]%p[r])*a:0),s)for(;;){if(0==c){for(n=1,r=d[0];r>=10;r/=10,n++);for(r=d[0]+=a,a=1;r>=10;r/=10,a++);n!=a&&(t.e++,d[0]==xt&&(d[0]=1));break}if(d[c]+=a,d[c]!=xt)break;d[c--]=0,a=1}for(n=d.length;0===d[--n];d.pop());}t.e>b?t.c=t.e=null:t.e<v&&(t.c=[t.e=0])}return t}function P(t){var e,i=t.e;return null===i?t.toString():(e=zt(t.c),e=i<=m||i>=f?Et(e,i):Nt(e,i,"0"),t.s<0?"-"+e:e)}return M.clone=t,M.ROUND_UP=0,M.ROUND_DOWN=1,M.ROUND_CEIL=2,M.ROUND_FLOOR=3,M.ROUND_HALF_UP=4,M.ROUND_HALF_DOWN=5,M.ROUND_HALF_EVEN=6,M.ROUND_HALF_CEIL=7,M.ROUND_HALF_FLOOR=8,M.EUCLID=9,M.config=M.set=function(t){var e,i;if(null!=t){if("object"!=typeof t)throw Error(wt+"Object expected: "+t);if(t.hasOwnProperty(e="DECIMAL_PLACES")&&(Rt(i=t[e],0,Ct,e),_=i),t.hasOwnProperty(e="ROUNDING_MODE")&&(Rt(i=t[e],0,8,e),g=i),t.hasOwnProperty(e="EXPONENTIAL_AT")&&((i=t[e])&&i.pop?(Rt(i[0],-Ct,0,e),Rt(i[1],0,Ct,e),m=i[0],f=i[1]):(Rt(i,-Ct,Ct,e),m=-(f=i<0?-i:i))),t.hasOwnProperty(e="RANGE"))if((i=t[e])&&i.pop)Rt(i[0],-Ct,-1,e),Rt(i[1],1,Ct,e),v=i[0],b=i[1];else{if(Rt(i,-Ct,Ct,e),!i)throw Error(wt+e+" cannot be zero: "+i);v=-(b=i<0?-i:i)}if(t.hasOwnProperty(e="CRYPTO")){if((i=t[e])!==!!i)throw Error(wt+e+" not true or false: "+i);if(i){if("undefined"==typeof crypto||!crypto||!crypto.getRandomValues&&!crypto.randomBytes)throw y=!i,Error(wt+"crypto unavailable");y=i}else y=i}if(t.hasOwnProperty(e="MODULO_MODE")&&(Rt(i=t[e],0,9,e),w=i),t.hasOwnProperty(e="POW_PRECISION")&&(Rt(i=t[e],0,Ct,e),$=i),t.hasOwnProperty(e="FORMAT")){if("object"!=typeof(i=t[e]))throw Error(wt+e+" not an object: "+i);x=i}if(t.hasOwnProperty(e="ALPHABET")){if("string"!=typeof(i=t[e])||/^.?$|[+\-.\s]|(.).*\1/.test(i))throw Error(wt+e+" invalid: "+i);S="0123456789"==i.slice(0,10),k=i}}return{DECIMAL_PLACES:_,ROUNDING_MODE:g,EXPONENTIAL_AT:[m,f],RANGE:[v,b],CRYPTO:y,MODULO_MODE:w,POW_PRECISION:$,FORMAT:x,ALPHABET:k}},M.isBigNumber=function(t){if(!t||!0!==t._isBigNumber)return!1;if(!M.DEBUG)return!0;var e,i,s=t.c,o=t.e,n=t.s;t:if("[object Array]"=={}.toString.call(s)){if((1===n||-1===n)&&o>=-Ct&&o<=Ct&&o===yt(o)){if(0===s[0]){if(0===o&&1===s.length)return!0;break t}if((e=(o+1)%kt)<1&&(e+=kt),String(s[0]).length==e){for(e=0;e<s.length;e++)if((i=s[e])<0||i>=xt||i!==yt(i))break t;if(0!==i)return!0}}}else if(null===s&&null===o&&(null===n||1===n||-1===n))return!0;throw Error(wt+"Invalid BigNumber: "+t)},M.maximum=M.max=function(){return C(arguments,-1)},M.minimum=M.min=function(){return C(arguments,1)},M.random=(n=9007199254740992,r=Math.random()*n&2097151?function(){return yt(Math.random()*n)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(t){var e,i,s,o,n,a=0,l=[],c=new M(u);if(null==t?t=_:Rt(t,0,Ct),o=bt(t/kt),y)if(crypto.getRandomValues){for(e=crypto.getRandomValues(new Uint32Array(o*=2));a<o;)(n=131072*e[a]+(e[a+1]>>>11))>=9e15?(i=crypto.getRandomValues(new Uint32Array(2)),e[a]=i[0],e[a+1]=i[1]):(l.push(n%1e14),a+=2);a=o/2}else{if(!crypto.randomBytes)throw y=!1,Error(wt+"crypto unavailable");for(e=crypto.randomBytes(o*=7);a<o;)(n=281474976710656*(31&e[a])+1099511627776*e[a+1]+4294967296*e[a+2]+16777216*e[a+3]+(e[a+4]<<16)+(e[a+5]<<8)+e[a+6])>=9e15?crypto.randomBytes(7).copy(e,a):(l.push(n%1e14),a+=7);a=o/7}if(!y)for(;a<o;)(n=r())<9e15&&(l[a++]=n%1e14);for(o=l[--a],t%=kt,o&&t&&(n=Mt[kt-t],l[a]=yt(o/n)*n);0===l[a];l.pop(),a--);if(a<0)l=[s=0];else{for(s=-1;0===l[0];l.splice(0,1),s-=kt);for(a=1,n=l[0];n>=10;n/=10,a++);a<kt&&(s-=kt-a)}return c.e=s,c.c=l,c}),M.sum=function(){for(var t=1,e=arguments,i=new M(e[0]);t<e.length;)i=i.plus(e[t++]);return i},s=function(){var t="0123456789";function e(t,e,i,s){for(var o,n,r=[0],a=0,l=t.length;a<l;){for(n=r.length;n--;r[n]*=e);for(r[0]+=s.indexOf(t.charAt(a++)),o=0;o<r.length;o++)r[o]>i-1&&(null==r[o+1]&&(r[o+1]=0),r[o+1]+=r[o]/i|0,r[o]%=i)}return r.reverse()}return function(s,o,n,r,a){var l,c,h,d,p,u,m,f,v=s.indexOf("."),b=_,y=g;for(v>=0&&(d=$,$=0,s=s.replace(".",""),u=(f=new M(o)).pow(s.length-v),$=d,f.c=e(Nt(zt(u.c),u.e,"0"),10,n,t),f.e=f.c.length),h=d=(m=e(s,o,n,a?(l=k,t):(l=t,k))).length;0==m[--d];m.pop());if(!m[0])return l.charAt(0);if(v<0?--h:(u.c=m,u.e=h,u.s=r,m=(u=i(u,f,b,y,n)).c,p=u.r,h=u.e),v=m[c=h+b+1],d=n/2,p=p||c<0||null!=m[c+1],p=y<4?(null!=v||p)&&(0==y||y==(u.s<0?3:2)):v>d||v==d&&(4==y||p||6==y&&1&m[c-1]||y==(u.s<0?8:7)),c<1||!m[0])s=p?Nt(l.charAt(1),-b,l.charAt(0)):l.charAt(0);else{if(m.length=c,p)for(--n;++m[--c]>n;)m[c]=0,c||(++h,m=[1].concat(m));for(d=m.length;!m[--d];);for(v=0,s="";v<=d;s+=l.charAt(m[v++]));s=Nt(s,h,l.charAt(0))}return s}}(),i=function(){function t(t,e,i){var s,o,n,r,a=0,l=t.length,c=e%Dt,h=e/Dt|0;for(t=t.slice();l--;)a=((o=c*(n=t[l]%Dt)+(s=h*n+(r=t[l]/Dt|0)*c)%Dt*Dt+a)/i|0)+(s/Dt|0)+h*r,t[l]=o%i;return a&&(t=[a].concat(t)),t}function e(t,e,i,s){var o,n;if(i!=s)n=i>s?1:-1;else for(o=n=0;o<i;o++)if(t[o]!=e[o]){n=t[o]>e[o]?1:-1;break}return n}function i(t,e,i,s){for(var o=0;i--;)t[i]-=o,o=t[i]<e[i]?1:0,t[i]=o*s+t[i]-e[i];for(;!t[0]&&t.length>1;t.splice(0,1));}return function(s,o,n,r,a){var l,c,h,d,p,u,_,g,m,f,v,b,y,w,$,x,k,S=s.s==o.s?1:-1,D=s.c,C=o.c;if(!(D&&D[0]&&C&&C[0]))return new M(s.s&&o.s&&(D?!C||D[0]!=C[0]:C)?D&&0==D[0]||!C?0*S:S/0:NaN);for(m=(g=new M(S)).c=[],S=n+(c=s.e-o.e)+1,a||(a=xt,c=Tt(s.e/kt)-Tt(o.e/kt),S=S/kt|0),h=0;C[h]==(D[h]||0);h++);if(C[h]>(D[h]||0)&&c--,S<0)m.push(1),d=!0;else{for(w=D.length,x=C.length,h=0,S+=2,(p=yt(a/(C[0]+1)))>1&&(C=t(C,p,a),D=t(D,p,a),x=C.length,w=D.length),y=x,v=(f=D.slice(0,x)).length;v<x;f[v++]=0);k=C.slice(),k=[0].concat(k),$=C[0],C[1]>=a/2&&$++;do{if(p=0,(l=e(C,f,x,v))<0){if(b=f[0],x!=v&&(b=b*a+(f[1]||0)),(p=yt(b/$))>1)for(p>=a&&(p=a-1),_=(u=t(C,p,a)).length,v=f.length;1==e(u,f,_,v);)p--,i(u,x<_?k:C,_,a),_=u.length,l=1;else 0==p&&(l=p=1),_=(u=C.slice()).length;if(_<v&&(u=[0].concat(u)),i(f,u,v,a),v=f.length,-1==l)for(;e(C,f,x,v)<1;)p++,i(f,x<v?k:C,v,a),v=f.length}else 0===l&&(p++,f=[0]);m[h++]=p,f[0]?f[v++]=D[y]||0:(f=[D[y]],v=1)}while((y++<w||null!=f[0])&&S--);d=null!=f[0],m[0]||m.splice(0,1)}if(a==xt){for(h=1,S=m[0];S>=10;S/=10,h++);z(g,n+(g.e=h+c*kt-1)+1,r,d)}else g.e=c,g.r=+d;return g}}(),a=/^(-?)0([xbo])(?=\w[\w.]*$)/i,l=/^([^.]+)\.$/,c=/^\.([^.]+)$/,h=/^-?(Infinity|NaN)$/,d=/^\s*\+(?=[\w.])|^\s+|\s+$/g,o=function(t,e,i,s){var o,n=i?e:e.replace(d,"");if(h.test(n))t.s=isNaN(n)?null:n<0?-1:1;else{if(!i&&(n=n.replace(a,function(t,e,i){return o="x"==(i=i.toLowerCase())?16:"b"==i?2:8,s&&s!=o?t:e}),s&&(o=s,n=n.replace(l,"$1").replace(c,"0.$1")),e!=n))return new M(n,o);if(M.DEBUG)throw Error(wt+"Not a"+(s?" base "+s:"")+" number: "+e);t.s=null}t.c=t.e=null},p.absoluteValue=p.abs=function(){var t=new M(this);return t.s<0&&(t.s=1),t},p.comparedTo=function(t,e){return Pt(this,new M(t,e))},p.decimalPlaces=p.dp=function(t,e){var i,s,o,n=this;if(null!=t)return Rt(t,0,Ct),null==e?e=g:Rt(e,0,8),z(new M(n),t+n.e+1,e);if(!(i=n.c))return null;if(s=((o=i.length-1)-Tt(this.e/kt))*kt,o=i[o])for(;o%10==0;o/=10,s--);return s<0&&(s=0),s},p.dividedBy=p.div=function(t,e){return i(this,new M(t,e),_,g)},p.dividedToIntegerBy=p.idiv=function(t,e){return i(this,new M(t,e),0,1)},p.exponentiatedBy=p.pow=function(t,e){var i,s,o,n,r,a,l,c,h=this;if((t=new M(t)).c&&!t.isInteger())throw Error(wt+"Exponent not an integer: "+P(t));if(null!=e&&(e=new M(e)),r=t.e>14,!h.c||!h.c[0]||1==h.c[0]&&!h.e&&1==h.c.length||!t.c||!t.c[0])return c=new M(Math.pow(+P(h),r?t.s*(2-At(t)):+P(t))),e?c.mod(e):c;if(a=t.s<0,e){if(e.c?!e.c[0]:!e.s)return new M(NaN);(s=!a&&h.isInteger()&&e.isInteger())&&(h=h.mod(e))}else{if(t.e>9&&(h.e>0||h.e<-1||(0==h.e?h.c[0]>1||r&&h.c[1]>=24e7:h.c[0]<8e13||r&&h.c[0]<=9999975e7)))return n=h.s<0&&At(t)?-0:0,h.e>-1&&(n=1/n),new M(a?1/n:n);$&&(n=bt($/kt+2))}for(r?(i=new M(.5),a&&(t.s=1),l=At(t)):l=(o=Math.abs(+P(t)))%2,c=new M(u);;){if(l){if(!(c=c.times(h)).c)break;n?c.c.length>n&&(c.c.length=n):s&&(c=c.mod(e))}if(o){if(0===(o=yt(o/2)))break;l=o%2}else if(z(t=t.times(i),t.e+1,1),t.e>14)l=At(t);else{if(0===(o=+P(t)))break;l=o%2}h=h.times(h),n?h.c&&h.c.length>n&&(h.c.length=n):s&&(h=h.mod(e))}return s?c:(a&&(c=u.div(c)),e?c.mod(e):n?z(c,$,g,void 0):c)},p.integerValue=function(t){var e=new M(this);return null==t?t=g:Rt(t,0,8),z(e,e.e+1,t)},p.isEqualTo=p.eq=function(t,e){return 0===Pt(this,new M(t,e))},p.isFinite=function(){return!!this.c},p.isGreaterThan=p.gt=function(t,e){return Pt(this,new M(t,e))>0},p.isGreaterThanOrEqualTo=p.gte=function(t,e){return 1===(e=Pt(this,new M(t,e)))||0===e},p.isInteger=function(){return!!this.c&&Tt(this.e/kt)>this.c.length-2},p.isLessThan=p.lt=function(t,e){return Pt(this,new M(t,e))<0},p.isLessThanOrEqualTo=p.lte=function(t,e){return-1===(e=Pt(this,new M(t,e)))||0===e},p.isNaN=function(){return!this.s},p.isNegative=function(){return this.s<0},p.isPositive=function(){return this.s>0},p.isZero=function(){return!!this.c&&0==this.c[0]},p.minus=function(t,e){var i,s,o,n,r=this,a=r.s;if(e=(t=new M(t,e)).s,!a||!e)return new M(NaN);if(a!=e)return t.s=-e,r.plus(t);var l=r.e/kt,c=t.e/kt,h=r.c,d=t.c;if(!l||!c){if(!h||!d)return h?(t.s=-e,t):new M(d?r:NaN);if(!h[0]||!d[0])return d[0]?(t.s=-e,t):new M(h[0]?r:3==g?-0:0)}if(l=Tt(l),c=Tt(c),h=h.slice(),a=l-c){for((n=a<0)?(a=-a,o=h):(c=l,o=d),o.reverse(),e=a;e--;o.push(0));o.reverse()}else for(s=(n=(a=h.length)<(e=d.length))?a:e,a=e=0;e<s;e++)if(h[e]!=d[e]){n=h[e]<d[e];break}if(n&&(o=h,h=d,d=o,t.s=-t.s),(e=(s=d.length)-(i=h.length))>0)for(;e--;h[i++]=0);for(e=xt-1;s>a;){if(h[--s]<d[s]){for(i=s;i&&!h[--i];h[i]=e);--h[i],h[s]+=xt}h[s]-=d[s]}for(;0==h[0];h.splice(0,1),--c);return h[0]?T(t,h,c):(t.s=3==g?-1:1,t.c=[t.e=0],t)},p.modulo=p.mod=function(t,e){var s,o,n=this;return t=new M(t,e),!n.c||!t.s||t.c&&!t.c[0]?new M(NaN):!t.c||n.c&&!n.c[0]?new M(n):(9==w?(o=t.s,t.s=1,s=i(n,t,0,3),t.s=o,s.s*=o):s=i(n,t,0,w),(t=n.minus(s.times(t))).c[0]||1!=w||(t.s=n.s),t)},p.multipliedBy=p.times=function(t,e){var i,s,o,n,r,a,l,c,h,d,p,u,_,g,m,f=this,v=f.c,b=(t=new M(t,e)).c;if(!(v&&b&&v[0]&&b[0]))return!f.s||!t.s||v&&!v[0]&&!b||b&&!b[0]&&!v?t.c=t.e=t.s=null:(t.s*=f.s,v&&b?(t.c=[0],t.e=0):t.c=t.e=null),t;for(s=Tt(f.e/kt)+Tt(t.e/kt),t.s*=f.s,(l=v.length)<(d=b.length)&&(_=v,v=b,b=_,o=l,l=d,d=o),o=l+d,_=[];o--;_.push(0));for(g=xt,m=Dt,o=d;--o>=0;){for(i=0,p=b[o]%m,u=b[o]/m|0,n=o+(r=l);n>o;)i=((c=p*(c=v[--r]%m)+(a=u*c+(h=v[r]/m|0)*p)%m*m+_[n]+i)/g|0)+(a/m|0)+u*h,_[n--]=c%g;_[n]=i}return i?++s:_.splice(0,1),T(t,_,s)},p.negated=function(){var t=new M(this);return t.s=-t.s||null,t},p.plus=function(t,e){var i,s=this,o=s.s;if(e=(t=new M(t,e)).s,!o||!e)return new M(NaN);if(o!=e)return t.s=-e,s.minus(t);var n=s.e/kt,r=t.e/kt,a=s.c,l=t.c;if(!n||!r){if(!a||!l)return new M(o/0);if(!a[0]||!l[0])return l[0]?t:new M(a[0]?s:0*o)}if(n=Tt(n),r=Tt(r),a=a.slice(),o=n-r){for(o>0?(r=n,i=l):(o=-o,i=a),i.reverse();o--;i.push(0));i.reverse()}for((o=a.length)-(e=l.length)<0&&(i=l,l=a,a=i,e=o),o=0;e;)o=(a[--e]=a[e]+l[e]+o)/xt|0,a[e]=xt===a[e]?0:a[e]%xt;return o&&(a=[o].concat(a),++r),T(t,a,r)},p.precision=p.sd=function(t,e){var i,s,o,n=this;if(null!=t&&t!==!!t)return Rt(t,1,Ct),null==e?e=g:Rt(e,0,8),z(new M(n),t,e);if(!(i=n.c))return null;if(s=(o=i.length-1)*kt+1,o=i[o]){for(;o%10==0;o/=10,s--);for(o=i[0];o>=10;o/=10,s++);}return t&&n.e+1>s&&(s=n.e+1),s},p.shiftedBy=function(t){return Rt(t,-9007199254740991,St),this.times("1e"+t)},p.squareRoot=p.sqrt=function(){var t,e,s,o,n,r=this,a=r.c,l=r.s,c=r.e,h=_+4,d=new M("0.5");if(1!==l||!a||!a[0])return new M(!l||l<0&&(!a||a[0])?NaN:a?r:1/0);if(0==(l=Math.sqrt(+P(r)))||l==1/0?(((e=zt(a)).length+c)%2==0&&(e+="0"),l=Math.sqrt(+e),c=Tt((c+1)/2)-(c<0||c%2),s=new M(e=l==1/0?"5e"+c:(e=l.toExponential()).slice(0,e.indexOf("e")+1)+c)):s=new M(l+""),s.c[0])for((l=(c=s.e)+h)<3&&(l=0);;)if(n=s,s=d.times(n.plus(i(r,n,h,1))),zt(n.c).slice(0,l)===(e=zt(s.c)).slice(0,l)){if(s.e<c&&--l,"9999"!=(e=e.slice(l-3,l+1))&&(o||"4999"!=e)){+e&&(+e.slice(1)||"5"!=e.charAt(0))||(z(s,s.e+_+2,1),t=!s.times(s).eq(r));break}if(!o&&(z(n,n.e+_+2,0),n.times(n).eq(r))){s=n;break}h+=4,l+=4,o=1}return z(s,s.e+_+1,g,t)},p.toExponential=function(t,e){return null!=t&&(Rt(t,0,Ct),t++),D(this,t,e,1)},p.toFixed=function(t,e){return null!=t&&(Rt(t,0,Ct),t=t+this.e+1),D(this,t,e)},p.toFormat=function(t,e,i){var s,o=this;if(null==i)null!=t&&e&&"object"==typeof e?(i=e,e=null):t&&"object"==typeof t?(i=t,t=e=null):i=x;else if("object"!=typeof i)throw Error(wt+"Argument not an object: "+i);if(s=o.toFixed(t,e),o.c){var n,r=s.split("."),a=+i.groupSize,l=+i.secondaryGroupSize,c=i.groupSeparator||"",h=r[0],d=r[1],p=o.s<0,u=p?h.slice(1):h,_=u.length;if(l&&(n=a,a=l,l=n,_-=n),a>0&&_>0){for(n=_%a||a,h=u.substr(0,n);n<_;n+=a)h+=c+u.substr(n,a);l>0&&(h+=c+u.slice(n)),p&&(h="-"+h)}s=d?h+(i.decimalSeparator||"")+((l=+i.fractionGroupSize)?d.replace(new RegExp("\\d{"+l+"}\\B","g"),"$&"+(i.fractionGroupSeparator||"")):d):h}return(i.prefix||"")+s+(i.suffix||"")},p.toFraction=function(t){var e,s,o,n,r,a,l,c,h,d,p,_,m=this,f=m.c;if(null!=t&&(!(l=new M(t)).isInteger()&&(l.c||1!==l.s)||l.lt(u)))throw Error(wt+"Argument "+(l.isInteger()?"out of range: ":"not an integer: ")+P(l));if(!f)return new M(m);for(e=new M(u),h=s=new M(u),o=c=new M(u),_=zt(f),r=e.e=_.length-m.e-1,e.c[0]=Mt[(a=r%kt)<0?kt+a:a],t=!t||l.comparedTo(e)>0?r>0?e:h:l,a=b,b=1/0,l=new M(_),c.c[0]=0;d=i(l,e,0,1),1!=(n=s.plus(d.times(o))).comparedTo(t);)s=o,o=n,h=c.plus(d.times(n=h)),c=n,e=l.minus(d.times(n=e)),l=n;return n=i(t.minus(s),o,0,1),c=c.plus(n.times(h)),s=s.plus(n.times(o)),c.s=h.s=m.s,p=i(h,o,r*=2,g).minus(m).abs().comparedTo(i(c,s,r,g).minus(m).abs())<1?[h,o]:[c,s],b=a,p},p.toNumber=function(){return+P(this)},p.toPrecision=function(t,e){return null!=t&&Rt(t,1,Ct),D(this,t,e,2)},p.toString=function(t){var e,i=this,o=i.s,n=i.e;return null===n?o?(e="Infinity",o<0&&(e="-"+e)):e="NaN":(null==t?e=n<=m||n>=f?Et(zt(i.c),n):Nt(zt(i.c),n,"0"):10===t&&S?e=Nt(zt((i=z(new M(i),_+n+1,g)).c),i.e,"0"):(Rt(t,2,k.length,"Base"),e=s(Nt(zt(i.c),n,"0"),10,t,o,!0)),o<0&&i.c[0]&&(e="-"+e)),e},p.valueOf=p.toJSON=function(){return P(this)},p._isBigNumber=!0,p[Symbol.toStringTag]="BigNumber",p[Symbol.for("nodejs.util.inspect.custom")]=p.valueOf,null!=e&&M.set(e),M}(),It=class{key;left=null;right=null;constructor(t){this.key=t}},Ft=class extends It{constructor(t){super(t)}},Lt=class{size=0;modificationCount=0;splayCount=0;splay(t){const e=this.root;if(null==e)return this.compare(t,t),-1;let i=null,s=null,o=null,n=null,r=e;const a=this.compare;let l;for(;;)if(l=a(r.key,t),l>0){let e=r.left;if(null==e)break;if(l=a(e.key,t),l>0&&(r.left=e.right,e.right=r,r=e,e=r.left,null==e))break;null==i?s=r:i.left=r,i=r,r=e}else{if(!(l<0))break;{let e=r.right;if(null==e)break;if(l=a(e.key,t),l<0&&(r.right=e.left,e.left=r,r=e,e=r.right,null==e))break;null==o?n=r:o.right=r,o=r,r=e}}return null!=o&&(o.right=r.left,r.left=n),null!=i&&(i.left=r.right,r.right=s),this.root!==r&&(this.root=r,this.splayCount++),l}splayMin(t){let e=t,i=e.left;for(;null!=i;){const t=i;e.left=t.right,t.right=e,e=t,i=e.left}return e}splayMax(t){let e=t,i=e.right;for(;null!=i;){const t=i;e.right=t.left,t.left=e,e=t,i=e.right}return e}_delete(t){if(null==this.root)return null;if(0!=this.splay(t))return null;let e=this.root;const i=e,s=e.left;if(this.size--,null==s)this.root=e.right;else{const t=e.right;e=this.splayMax(s),e.right=t,this.root=e}return this.modificationCount++,i}addNewRoot(t,e){this.size++,this.modificationCount++;const i=this.root;null!=i?(e<0?(t.left=i,t.right=i.right,i.right=null):(t.right=i,t.left=i.left,i.left=null),this.root=t):this.root=t}_first(){const t=this.root;return null==t?null:(this.root=this.splayMin(t),this.root)}_last(){const t=this.root;return null==t?null:(this.root=this.splayMax(t),this.root)}clear(){this.root=null,this.size=0,this.modificationCount++}has(t){return this.validKey(t)&&0==this.splay(t)}defaultCompare(){return(t,e)=>t<e?-1:t>e?1:0}wrap(){return{getRoot:()=>this.root,setRoot:t=>{this.root=t},getSize:()=>this.size,getModificationCount:()=>this.modificationCount,getSplayCount:()=>this.splayCount,setSplayCount:t=>{this.splayCount=t},splay:t=>this.splay(t),has:t=>this.has(t)}}},qt=class t extends Lt{root=null;compare;validKey;constructor(t,e){super(),this.compare=t??this.defaultCompare(),this.validKey=e??(t=>null!=t&&null!=t)}delete(t){return!!this.validKey(t)&&null!=this._delete(t)}deleteAll(t){for(const e of t)this.delete(e)}forEach(t){const e=this[Symbol.iterator]();let i;for(;i=e.next(),!i.done;)t(i.value,i.value,this)}add(t){const e=this.splay(t);return 0!=e&&this.addNewRoot(new Ft(t),e),this}addAndReturn(t){const e=this.splay(t);return 0!=e&&this.addNewRoot(new Ft(t),e),this.root.key}addAll(t){for(const e of t)this.add(e)}isEmpty(){return null==this.root}isNotEmpty(){return null!=this.root}single(){if(0==this.size)throw"Bad state: No element";if(this.size>1)throw"Bad state: Too many element";return this.root.key}first(){if(0==this.size)throw"Bad state: No element";return this._first().key}last(){if(0==this.size)throw"Bad state: No element";return this._last().key}lastBefore(t){if(null==t)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(t)<0)return this.root.key;let e=this.root.left;if(null==e)return null;let i=e.right;for(;null!=i;)e=i,i=e.right;return e.key}firstAfter(t){if(null==t)throw"Invalid arguments(s)";if(null==this.root)return null;if(this.splay(t)>0)return this.root.key;let e=this.root.right;if(null==e)return null;let i=e.left;for(;null!=i;)e=i,i=e.left;return e.key}retainAll(e){const i=new t(this.compare,this.validKey),s=this.modificationCount;for(const t of e){if(s!=this.modificationCount)throw"Concurrent modification during iteration.";this.validKey(t)&&0==this.splay(t)&&i.add(this.root.key)}i.size!=this.size&&(this.root=i.root,this.size=i.size,this.modificationCount++)}lookup(t){if(!this.validKey(t))return null;return 0!=this.splay(t)?null:this.root.key}intersection(e){const i=new t(this.compare,this.validKey);for(const t of this)e.has(t)&&i.add(t);return i}difference(e){const i=new t(this.compare,this.validKey);for(const t of this)e.has(t)||i.add(t);return i}union(t){const e=this.clone();return e.addAll(t),e}clone(){const e=new t(this.compare,this.validKey);return e.size=this.size,e.root=this.copyNode(this.root),e}copyNode(t){if(null==t)return null;const e=new Ft(t.key);return function t(e,i){let s,o;do{if(s=e.left,o=e.right,null!=s){const e=new Ft(s.key);i.left=e,t(s,e)}if(null!=o){const t=new Ft(o.key);i.right=t,e=o,i=t}}while(null!=o)}(t,e),e}toSet(){return this.clone()}entries(){return new Bt(this.wrap())}keys(){return this[Symbol.iterator]()}values(){return this[Symbol.iterator]()}[Symbol.iterator](){return new Ut(this.wrap())}[Symbol.toStringTag]="[object Set]"},Ht=class{tree;path=new Array;modificationCount=null;splayCount;constructor(t){this.tree=t,this.splayCount=t.getSplayCount()}[Symbol.iterator](){return this}next(){return this.moveNext()?{done:!1,value:this.current()}:{done:!0,value:null}}current(){if(!this.path.length)return null;const t=this.path[this.path.length-1];return this.getValue(t)}rebuildPath(t){this.path.splice(0,this.path.length),this.tree.splay(t),this.path.push(this.tree.getRoot()),this.splayCount=this.tree.getSplayCount()}findLeftMostDescendent(t){for(;null!=t;)this.path.push(t),t=t.left}moveNext(){if(this.modificationCount!=this.tree.getModificationCount()){if(null==this.modificationCount){this.modificationCount=this.tree.getModificationCount();let t=this.tree.getRoot();for(;null!=t;)this.path.push(t),t=t.left;return this.path.length>0}throw"Concurrent modification during iteration."}if(!this.path.length)return!1;this.splayCount!=this.tree.getSplayCount()&&this.rebuildPath(this.path[this.path.length-1].key);let t=this.path[this.path.length-1],e=t.right;if(null!=e){for(;null!=e;)this.path.push(e),e=e.left;return!0}for(this.path.pop();this.path.length&&this.path[this.path.length-1].right===t;)t=this.path.pop();return this.path.length>0}},Ut=class extends Ht{getValue(t){return t.key}},Bt=class extends Ht{getValue(t){return[t.key,t.key]}},jt=t=>()=>t,Wt=t=>{const e=t?(e,i)=>i.minus(e).abs().isLessThanOrEqualTo(t):jt(!1);return(t,i)=>e(t,i)?0:t.comparedTo(i)};function Vt(t){const e=t?(e,i,s,o,n)=>e.exponentiatedBy(2).isLessThanOrEqualTo(o.minus(i).exponentiatedBy(2).plus(n.minus(s).exponentiatedBy(2)).times(t)):jt(!1);return(t,i,s)=>{const o=t.x,n=t.y,r=s.x,a=s.y,l=n.minus(a).times(i.x.minus(r)).minus(o.minus(r).times(i.y.minus(a)));return e(l,o,n,r,a)?0:l.comparedTo(0)}}var Gt=t=>t,Kt=t=>{if(t){const e=new qt(Wt(t)),i=new qt(Wt(t)),s=(t,e)=>e.addAndReturn(t),o=t=>({x:s(t.x,e),y:s(t.y,i)});return o({x:new Ot(0),y:new Ot(0)}),o}return Gt},Yt=t=>({set:t=>{Xt=Yt(t)},reset:()=>Yt(t),compare:Wt(t),snap:Kt(t),orient:Vt(t)}),Xt=Yt(),Zt=(t,e)=>t.ll.x.isLessThanOrEqualTo(e.x)&&e.x.isLessThanOrEqualTo(t.ur.x)&&t.ll.y.isLessThanOrEqualTo(e.y)&&e.y.isLessThanOrEqualTo(t.ur.y),Jt=(t,e)=>{if(e.ur.x.isLessThan(t.ll.x)||t.ur.x.isLessThan(e.ll.x)||e.ur.y.isLessThan(t.ll.y)||t.ur.y.isLessThan(e.ll.y))return null;const i=t.ll.x.isLessThan(e.ll.x)?e.ll.x:t.ll.x,s=t.ur.x.isLessThan(e.ur.x)?t.ur.x:e.ur.x;return{ll:{x:i,y:t.ll.y.isLessThan(e.ll.y)?e.ll.y:t.ll.y},ur:{x:s,y:t.ur.y.isLessThan(e.ur.y)?t.ur.y:e.ur.y}}},Qt=(t,e)=>t.x.times(e.y).minus(t.y.times(e.x)),te=(t,e)=>t.x.times(e.x).plus(t.y.times(e.y)),ee=t=>te(t,t).sqrt(),ie=(t,e,i)=>{const s={x:e.x.minus(t.x),y:e.y.minus(t.y)},o={x:i.x.minus(t.x),y:i.y.minus(t.y)};return Qt(o,s).div(ee(o)).div(ee(s))},se=(t,e,i)=>{const s={x:e.x.minus(t.x),y:e.y.minus(t.y)},o={x:i.x.minus(t.x),y:i.y.minus(t.y)};return te(o,s).div(ee(o)).div(ee(s))},oe=(t,e,i)=>e.y.isZero()?null:{x:t.x.plus(e.x.div(e.y).times(i.minus(t.y))),y:i},ne=(t,e,i)=>e.x.isZero()?null:{x:i,y:t.y.plus(e.y.div(e.x).times(i.minus(t.x)))},re=class t{point;isLeft;segment;otherSE;consumedBy;static compare(e,i){const s=t.comparePoints(e.point,i.point);return 0!==s?s:(e.point!==i.point&&e.link(i),e.isLeft!==i.isLeft?e.isLeft?1:-1:_e.compare(e.segment,i.segment))}static comparePoints(t,e){return t.x.isLessThan(e.x)?-1:t.x.isGreaterThan(e.x)?1:t.y.isLessThan(e.y)?-1:t.y.isGreaterThan(e.y)?1:0}constructor(t,e){void 0===t.events?t.events=[this]:t.events.push(this),this.point=t,this.isLeft=e}link(t){if(t.point===this.point)throw new Error("Tried to link already linked events");const e=t.point.events;for(let t=0,i=e.length;t<i;t++){const i=e[t];this.point.events.push(i),i.point=this.point}this.checkForConsuming()}checkForConsuming(){const t=this.point.events.length;for(let e=0;e<t;e++){const i=this.point.events[e];if(void 0===i.segment.consumedBy)for(let s=e+1;s<t;s++){const t=this.point.events[s];void 0===t.consumedBy&&(i.otherSE.point.events===t.otherSE.point.events&&i.segment.consume(t.segment))}}}getAvailableLinkedEvents(){const t=[];for(let e=0,i=this.point.events.length;e<i;e++){const i=this.point.events[e];i!==this&&!i.segment.ringOut&&i.segment.isInResult()&&t.push(i)}return t}getLeftmostComparator(t){const e=new Map,i=i=>{const s=i.otherSE;e.set(i,{sine:ie(this.point,t.point,s.point),cosine:se(this.point,t.point,s.point)})};return(t,s)=>{e.has(t)||i(t),e.has(s)||i(s);const{sine:o,cosine:n}=e.get(t),{sine:r,cosine:a}=e.get(s);return o.isGreaterThanOrEqualTo(0)&&r.isGreaterThanOrEqualTo(0)?n.isLessThan(a)?1:n.isGreaterThan(a)?-1:0:o.isLessThan(0)&&r.isLessThan(0)?n.isLessThan(a)?-1:n.isGreaterThan(a)?1:0:r.isLessThan(o)?-1:r.isGreaterThan(o)?1:0}}},ae=class t{events;poly;_isExteriorRing;_enclosingRing;static factory(e){const i=[];for(let s=0,o=e.length;s<o;s++){const o=e[s];if(!o.isInResult()||o.ringOut)continue;let n=null,r=o.leftSE,a=o.rightSE;const l=[r],c=r.point,h=[];for(;n=r,r=a,l.push(r),r.point!==c;)for(;;){const e=r.getAvailableLinkedEvents();if(0===e.length){const t=l[0].point,e=l[l.length-1].point;throw new Error(`Unable to complete output ring starting at [${t.x}, ${t.y}]. Last matching segment found ends at [${e.x}, ${e.y}].`)}if(1===e.length){a=e[0].otherSE;break}let s=null;for(let t=0,e=h.length;t<e;t++)if(h[t].point===r.point){s=t;break}if(null!==s){const e=h.splice(s)[0],o=l.splice(e.index);o.unshift(o[0].otherSE),i.push(new t(o.reverse()));continue}h.push({index:l.length,point:r.point});const o=r.getLeftmostComparator(n);a=e.sort(o)[0].otherSE;break}i.push(new t(l))}return i}constructor(t){this.events=t;for(let e=0,i=t.length;e<i;e++)t[e].segment.ringOut=this;this.poly=null}getGeom(){let t=this.events[0].point;const e=[t];for(let i=1,s=this.events.length-1;i<s;i++){const s=this.events[i].point,o=this.events[i+1].point;0!==Xt.orient(s,t,o)&&(e.push(s),t=s)}if(1===e.length)return null;const i=e[0],s=e[1];0===Xt.orient(i,t,s)&&e.shift(),e.push(e[0]);const o=this.isExteriorRing()?1:-1,n=this.isExteriorRing()?0:e.length-1,r=this.isExteriorRing()?e.length:-1,a=[];for(let t=n;t!=r;t+=o)a.push([e[t].x.toNumber(),e[t].y.toNumber()]);return a}isExteriorRing(){if(void 0===this._isExteriorRing){const t=this.enclosingRing();this._isExteriorRing=!t||!t.isExteriorRing()}return this._isExteriorRing}enclosingRing(){return void 0===this._enclosingRing&&(this._enclosingRing=this._calcEnclosingRing()),this._enclosingRing}_calcEnclosingRing(){let t=this.events[0];for(let e=1,i=this.events.length;e<i;e++){const i=this.events[e];re.compare(t,i)>0&&(t=i)}let e=t.segment.prevInResult(),i=e?e.prevInResult():null;for(;;){if(!e)return null;if(!i)return e.ringOut;if(i.ringOut!==e.ringOut)return i.ringOut?.enclosingRing()!==e.ringOut?e.ringOut:e.ringOut?.enclosingRing();e=i.prevInResult(),i=e?e.prevInResult():null}}},le=class{exteriorRing;interiorRings;constructor(t){this.exteriorRing=t,t.poly=this,this.interiorRings=[]}addInterior(t){this.interiorRings.push(t),t.poly=this}getGeom(){const t=this.exteriorRing.getGeom();if(null===t)return null;const e=[t];for(let t=0,i=this.interiorRings.length;t<i;t++){const i=this.interiorRings[t].getGeom();null!==i&&e.push(i)}return e}},ce=class{rings;polys;constructor(t){this.rings=t,this.polys=this._composePolys(t)}getGeom(){const t=[];for(let e=0,i=this.polys.length;e<i;e++){const i=this.polys[e].getGeom();null!==i&&t.push(i)}return t}_composePolys(t){const e=[];for(let i=0,s=t.length;i<s;i++){const s=t[i];if(!s.poly)if(s.isExteriorRing())e.push(new le(s));else{const t=s.enclosingRing();t?.poly||e.push(new le(t)),t?.poly?.addInterior(s)}}return e}},he=class{queue;tree;segments;constructor(t,e=_e.compare){this.queue=t,this.tree=new qt(e),this.segments=[]}process(t){const e=t.segment,i=[];if(t.consumedBy)return t.isLeft?this.queue.delete(t.otherSE):this.tree.delete(e),i;t.isLeft&&this.tree.add(e);let s=e,o=e;do{s=this.tree.lastBefore(s)}while(null!=s&&null!=s.consumedBy);do{o=this.tree.firstAfter(o)}while(null!=o&&null!=o.consumedBy);if(t.isLeft){let n=null;if(s){const t=s.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(n=t),!s.isAnEndpoint(t))){const e=this._splitSafely(s,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}let r=null;if(o){const t=o.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(r=t),!o.isAnEndpoint(t))){const e=this._splitSafely(o,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}if(null!==n||null!==r){let t=null;if(null===n)t=r;else if(null===r)t=n;else{t=re.comparePoints(n,r)<=0?n:r}this.queue.delete(e.rightSE),i.push(e.rightSE);const s=e.split(t);for(let t=0,e=s.length;t<e;t++)i.push(s[t])}i.length>0?(this.tree.delete(e),i.push(t)):(this.segments.push(e),e.prev=s)}else{if(s&&o){const t=s.getIntersection(o);if(null!==t){if(!s.isAnEndpoint(t)){const e=this._splitSafely(s,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}if(!o.isAnEndpoint(t)){const e=this._splitSafely(o,t);for(let t=0,s=e.length;t<s;t++)i.push(e[t])}}}this.tree.delete(e)}return i}_splitSafely(t,e){this.tree.delete(t);const i=t.rightSE;this.queue.delete(i);const s=t.split(e);return s.push(i),void 0===t.consumedBy&&this.tree.add(t),s}},de=new class{type;numMultiPolys;run(t,e,i){de.type=t;const s=[new fe(e,!0)];for(let t=0,e=i.length;t<e;t++)s.push(new fe(i[t],!1));if(de.numMultiPolys=s.length,"difference"===de.type){const t=s[0];let e=1;for(;e<s.length;)null!==Jt(s[e].bbox,t.bbox)?e++:s.splice(e,1)}if("intersection"===de.type)for(let t=0,e=s.length;t<e;t++){const e=s[t];for(let i=t+1,o=s.length;i<o;i++)if(null===Jt(e.bbox,s[i].bbox))return[]}const o=new qt(re.compare);for(let t=0,e=s.length;t<e;t++){const e=s[t].getSweepEvents();for(let t=0,i=e.length;t<i;t++)o.add(e[t])}const n=new he(o);let r=null;for(0!=o.size&&(r=o.first(),o.delete(r));r;){const t=n.process(r);for(let e=0,i=t.length;e<i;e++){const i=t[e];void 0===i.consumedBy&&o.add(i)}0!=o.size?(r=o.first(),o.delete(r)):r=null}Xt.reset();const a=ae.factory(n.segments);return new ce(a).getGeom()}},pe=de,ue=0,_e=class t{id;leftSE;rightSE;rings;windings;ringOut;consumedBy;prev;_prevInResult;_beforeState;_afterState;_isInResult;static compare(t,e){const i=t.leftSE.point.x,s=e.leftSE.point.x,o=t.rightSE.point.x,n=e.rightSE.point.x;if(n.isLessThan(i))return 1;if(o.isLessThan(s))return-1;const r=t.leftSE.point.y,a=e.leftSE.point.y,l=t.rightSE.point.y,c=e.rightSE.point.y;if(i.isLessThan(s)){if(a.isLessThan(r)&&a.isLessThan(l))return 1;if(a.isGreaterThan(r)&&a.isGreaterThan(l))return-1;const i=t.comparePoint(e.leftSE.point);if(i<0)return 1;if(i>0)return-1;const s=e.comparePoint(t.rightSE.point);return 0!==s?s:-1}if(i.isGreaterThan(s)){if(r.isLessThan(a)&&r.isLessThan(c))return-1;if(r.isGreaterThan(a)&&r.isGreaterThan(c))return 1;const i=e.comparePoint(t.leftSE.point);if(0!==i)return i;const s=t.comparePoint(e.rightSE.point);return s<0?1:s>0?-1:1}if(r.isLessThan(a))return-1;if(r.isGreaterThan(a))return 1;if(o.isLessThan(n)){const i=e.comparePoint(t.rightSE.point);if(0!==i)return i}if(o.isGreaterThan(n)){const i=t.comparePoint(e.rightSE.point);if(i<0)return 1;if(i>0)return-1}if(!o.eq(n)){const t=l.minus(r),e=o.minus(i),h=c.minus(a),d=n.minus(s);if(t.isGreaterThan(e)&&h.isLessThan(d))return 1;if(t.isLessThan(e)&&h.isGreaterThan(d))return-1}return o.isGreaterThan(n)?1:o.isLessThan(n)||l.isLessThan(c)?-1:l.isGreaterThan(c)?1:t.id<e.id?-1:t.id>e.id?1:0}constructor(t,e,i,s){this.id=++ue,this.leftSE=t,t.segment=this,t.otherSE=e,this.rightSE=e,e.segment=this,e.otherSE=t,this.rings=i,this.windings=s}static fromRing(e,i,s){let o,n,r;const a=re.comparePoints(e,i);if(a<0)o=e,n=i,r=1;else{if(!(a>0))throw new Error(`Tried to create degenerate segment at [${e.x}, ${e.y}]`);o=i,n=e,r=-1}const l=new re(o,!0),c=new re(n,!1);return new t(l,c,[s],[r])}replaceRightSE(t){this.rightSE=t,this.rightSE.segment=this,this.rightSE.otherSE=this.leftSE,this.leftSE.otherSE=this.rightSE}bbox(){const t=this.leftSE.point.y,e=this.rightSE.point.y;return{ll:{x:this.leftSE.point.x,y:t.isLessThan(e)?t:e},ur:{x:this.rightSE.point.x,y:t.isGreaterThan(e)?t:e}}}vector(){return{x:this.rightSE.point.x.minus(this.leftSE.point.x),y:this.rightSE.point.y.minus(this.leftSE.point.y)}}isAnEndpoint(t){return t.x.eq(this.leftSE.point.x)&&t.y.eq(this.leftSE.point.y)||t.x.eq(this.rightSE.point.x)&&t.y.eq(this.rightSE.point.y)}comparePoint(t){return Xt.orient(this.leftSE.point,t,this.rightSE.point)}getIntersection(t){const e=this.bbox(),i=t.bbox(),s=Jt(e,i);if(null===s)return null;const o=this.leftSE.point,n=this.rightSE.point,r=t.leftSE.point,a=t.rightSE.point,l=Zt(e,r)&&0===this.comparePoint(r),c=Zt(i,o)&&0===t.comparePoint(o),h=Zt(e,a)&&0===this.comparePoint(a),d=Zt(i,n)&&0===t.comparePoint(n);if(c&&l)return d&&!h?n:!d&&h?a:null;if(c)return h&&o.x.eq(a.x)&&o.y.eq(a.y)?null:o;if(l)return d&&n.x.eq(r.x)&&n.y.eq(r.y)?null:r;if(d&&h)return null;if(d)return n;if(h)return a;const p=((t,e,i,s)=>{if(e.x.isZero())return ne(i,s,t.x);if(s.x.isZero())return ne(t,e,i.x);if(e.y.isZero())return oe(i,s,t.y);if(s.y.isZero())return oe(t,e,i.y);const o=Qt(e,s);if(o.isZero())return null;const n={x:i.x.minus(t.x),y:i.y.minus(t.y)},r=Qt(n,e).div(o),a=Qt(n,s).div(o),l=t.x.plus(a.times(e.x)),c=i.x.plus(r.times(s.x)),h=t.y.plus(a.times(e.y)),d=i.y.plus(r.times(s.y));return{x:l.plus(c).div(2),y:h.plus(d).div(2)}})(o,this.vector(),r,t.vector());return null===p?null:Zt(s,p)?Xt.snap(p):null}split(e){const i=[],s=void 0!==e.events,o=new re(e,!0),n=new re(e,!1),r=this.rightSE;this.replaceRightSE(n),i.push(n),i.push(o);const a=new t(o,r,this.rings.slice(),this.windings.slice());return re.comparePoints(a.leftSE.point,a.rightSE.point)>0&&a.swapEvents(),re.comparePoints(this.leftSE.point,this.rightSE.point)>0&&this.swapEvents(),s&&(o.checkForConsuming(),n.checkForConsuming()),i}swapEvents(){const t=this.rightSE;this.rightSE=this.leftSE,this.leftSE=t,this.leftSE.isLeft=!0,this.rightSE.isLeft=!1;for(let t=0,e=this.windings.length;t<e;t++)this.windings[t]*=-1}consume(e){let i=this,s=e;for(;i.consumedBy;)i=i.consumedBy;for(;s.consumedBy;)s=s.consumedBy;const o=t.compare(i,s);if(0!==o){if(o>0){const t=i;i=s,s=t}if(i.prev===s){const t=i;i=s,s=t}for(let t=0,e=s.rings.length;t<e;t++){const e=s.rings[t],o=s.windings[t],n=i.rings.indexOf(e);-1===n?(i.rings.push(e),i.windings.push(o)):i.windings[n]+=o}s.rings=null,s.windings=null,s.consumedBy=i,s.leftSE.consumedBy=i.leftSE,s.rightSE.consumedBy=i.rightSE}}prevInResult(){return void 0!==this._prevInResult||(this.prev?this.prev.isInResult()?this._prevInResult=this.prev:this._prevInResult=this.prev.prevInResult():this._prevInResult=null),this._prevInResult}beforeState(){if(void 0!==this._beforeState)return this._beforeState;if(this.prev){const t=this.prev.consumedBy||this.prev;this._beforeState=t.afterState()}else this._beforeState={rings:[],windings:[],multiPolys:[]};return this._beforeState}afterState(){if(void 0!==this._afterState)return this._afterState;const t=this.beforeState();this._afterState={rings:t.rings.slice(0),windings:t.windings.slice(0),multiPolys:[]};const e=this._afterState.rings,i=this._afterState.windings,s=this._afterState.multiPolys;for(let t=0,s=this.rings.length;t<s;t++){const s=this.rings[t],o=this.windings[t],n=e.indexOf(s);-1===n?(e.push(s),i.push(o)):i[n]+=o}const o=[],n=[];for(let t=0,s=e.length;t<s;t++){if(0===i[t])continue;const s=e[t],r=s.poly;if(-1===n.indexOf(r))if(s.isExterior)o.push(r);else{-1===n.indexOf(r)&&n.push(r);const t=o.indexOf(s.poly);-1!==t&&o.splice(t,1)}}for(let t=0,e=o.length;t<e;t++){const e=o[t].multiPoly;-1===s.indexOf(e)&&s.push(e)}return this._afterState}isInResult(){if(this.consumedBy)return!1;if(void 0!==this._isInResult)return this._isInResult;const t=this.beforeState().multiPolys,e=this.afterState().multiPolys;switch(pe.type){case"union":{const i=0===t.length,s=0===e.length;this._isInResult=i!==s;break}case"intersection":{let i,s;t.length<e.length?(i=t.length,s=e.length):(i=e.length,s=t.length),this._isInResult=s===pe.numMultiPolys&&i<s;break}case"xor":{const i=Math.abs(t.length-e.length);this._isInResult=i%2==1;break}case"difference":{const i=t=>1===t.length&&t[0].isSubject;this._isInResult=i(t)!==i(e);break}}return this._isInResult}},ge=class{poly;isExterior;segments;bbox;constructor(t,e,i){if(!Array.isArray(t)||0===t.length)throw new Error("Input geometry is not a valid Polygon or MultiPolygon");if(this.poly=e,this.isExterior=i,this.segments=[],"number"!=typeof t[0][0]||"number"!=typeof t[0][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const s=Xt.snap({x:new Ot(t[0][0]),y:new Ot(t[0][1])});this.bbox={ll:{x:s.x,y:s.y},ur:{x:s.x,y:s.y}};let o=s;for(let e=1,i=t.length;e<i;e++){if("number"!=typeof t[e][0]||"number"!=typeof t[e][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const i=Xt.snap({x:new Ot(t[e][0]),y:new Ot(t[e][1])});i.x.eq(o.x)&&i.y.eq(o.y)||(this.segments.push(_e.fromRing(o,i,this)),i.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.x),i.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.y),i.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.x),i.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.y),o=i)}s.x.eq(o.x)&&s.y.eq(o.y)||this.segments.push(_e.fromRing(o,s,this))}getSweepEvents(){const t=[];for(let e=0,i=this.segments.length;e<i;e++){const i=this.segments[e];t.push(i.leftSE),t.push(i.rightSE)}return t}},me=class{multiPoly;exteriorRing;interiorRings;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");this.exteriorRing=new ge(t[0],this,!0),this.bbox={ll:{x:this.exteriorRing.bbox.ll.x,y:this.exteriorRing.bbox.ll.y},ur:{x:this.exteriorRing.bbox.ur.x,y:this.exteriorRing.bbox.ur.y}},this.interiorRings=[];for(let e=1,i=t.length;e<i;e++){const i=new ge(t[e],this,!1);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.interiorRings.push(i)}this.multiPoly=e}getSweepEvents(){const t=this.exteriorRing.getSweepEvents();for(let e=0,i=this.interiorRings.length;e<i;e++){const i=this.interiorRings[e].getSweepEvents();for(let e=0,s=i.length;e<s;e++)t.push(i[e])}return t}},fe=class{isSubject;polys;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");try{"number"==typeof t[0][0][0]&&(t=[t])}catch(t){}this.polys=[],this.bbox={ll:{x:new Ot(Number.POSITIVE_INFINITY),y:new Ot(Number.POSITIVE_INFINITY)},ur:{x:new Ot(Number.NEGATIVE_INFINITY),y:new Ot(Number.NEGATIVE_INFINITY)}};for(let e=0,i=t.length;e<i;e++){const i=new me(t[e],this);i.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=i.bbox.ll.x),i.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=i.bbox.ll.y),i.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=i.bbox.ur.x),i.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=i.bbox.ur.y),this.polys.push(i)}this.isSubject=e}getSweepEvents(){const t=[];for(let e=0,i=this.polys.length;e<i;e++){const i=this.polys[e].getSweepEvents();for(let e=0,s=i.length;e<s;e++)t.push(i[e])}return t}},ve=(t,...e)=>pe.run("intersection",t,e);function be(t){const e=Math.max(0,Math.min(120,(t-40)/140*120));return`hsl(${Math.round(e)}, 85%, 55%)`}function ye(t,e){if(!(Number.isFinite(t)&&e>0))return t;const i=Math.round(t/e)*e;return Math.abs(i-t)<=1e-9*e?t:i}function we(t,e){if(e){const e=t/2.54;let i=Math.floor(e/12),s=Math.round(e-12*i);return 12===s&&(i+=1,s=0),`${i}′ ${s}″`}return`${(t/100).toFixed(2)} m`}function $e(t,e,i=1){const s=t[0].toFixed(i),o=t[1].toFixed(i),n=e[0].toFixed(i),r=e[1].toFixed(i),a=s<n||s===n&&o<=r,[l,c,h,d]=a?[s,o,n,r]:[n,r,s,o];return`${l},${c}-${h},${d}`}function xe(t){return t?.poly?.length>=3?t.poly:t&&null!=t.x&&null!=t.y&&null!=t.w&&null!=t.h?[[t.x,t.y],[t.x+t.w,t.y],[t.x+t.w,t.y+t.h],[t.x,t.y+t.h]]:null}function ke(t){const e=[];for(const i of t||[])i?.poly?.length>=3?e.push({poly:i.poly.map(t=>t.join(",")).join(" ")}):i&&null!=i.x&&null!=i.y&&null!=i.w&&null!=i.h&&e.push({rect:{x:i.x,y:i.y,w:i.w,h:i.h,rx:.03*Math.min(i.w,i.h)}});return e}function Se(t){const e=[],i=new Set;for(const s of t||[]){const t=xe(s);if(t)for(let s=0;s<t.length;s++){const o=t[s],n=t[(s+1)%t.length],r=$e(o,n,5);i.has(r)||(i.add(r),e.push([o[0],o[1],n[0],n[1]]))}}return e}function Me(t,e,i,s={}){let o=null,n=i;for(const i of Se(e)){const[e,r,a,l]=i,c=a-e,h=l-r,d=c*c+h*h;if(!d)continue;let p=((t[0]-e)*c+(t[1]-r)*h)/d;p=Math.max(0,Math.min(1,p));const u=[e+p*c,r+p*h],_=Math.hypot(t[0]-u[0],t[1]-u[1]);if(_<n){n=_;let t=180*Math.atan2(h,c)/Math.PI;if(t>=90?t-=180:t<-90&&(t+=180),s.step&&s.step>0){const i=Math.sqrt(d),n=Math.min(Math.max(s.length||0,0)/2,i/2);let a=Math.round(p*i/s.step)*s.step;Math.abs(p*i-i/2)<=s.step/2&&(a=i/2),a=Math.max(n,Math.min(i-n,a));const l=a/i;o={x:e+l*c,y:r+l*h,angle:t}}else o={x:u[0],y:u[1],angle:t}}}return o}function De(t,e,i,s,o,n=1){const r=e*Math.PI/180,a=[Math.cos(r),Math.sin(r)];let l=null,c=n;for(const e of Se(s)){const i=[[e[0],e[1]],[e[2],e[3]]],s=e=>Math.abs(a[0]*(e[1]-t[1])-a[1]*(e[0]-t[0]));if(s(i[0])>n||s(i[1])>n)continue;const o=(i[0][0]-t[0])*a[0]+(i[0][1]-t[1])*a[1],r=(i[1][0]-t[0])*a[0]+(i[1][1]-t[1])*a[1],h=Math.min(o,r),d=Math.max(o,r),p=h>0?h:d<0?-d:0;p<c&&(c=p,l=[h,d])}if(!l)return null;const[h,d]=l,p=i/2,u=Math.max(0,-p-h),_=Math.max(0,d-p),g=e=>[t[0]+a[0]*e,t[1]+a[1]*e],m=(h+d)/2;return{wallA:g(h),wallB:g(d),sideA:u,sideB:_,midA:g((h-p)/2),midB:g((p+d)/2),wallCenter:g(m),centered:Math.abs(m)<=o}}function Ce(t){return["on","open","home","detected","playing","cleaning"].includes(String(t))}function Te(t,e,i=.001){return Math.abs(t[0]-e[0])<i&&Math.abs(t[1]-e[1])<i}function ze(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const[n,r]=e[s],[a,l]=e[o];r>t[1]!=l>t[1]&&t[0]<(a-n)*(t[1]-r)/(l-r)+n&&(i=!i)}return i}function Pe(t,e,i){const s=i[0]-e[0],o=i[1]-e[1],n=s*s+o*o;let r=n?((t[0]-e[0])*s+(t[1]-e[1])*o)/n:0;return r=Math.max(0,Math.min(1,r)),Math.hypot(t[0]-(e[0]+r*s),t[1]-(e[1]+r*o))}function Re(t,e){if(!e||e.length<2)return null;let i=null,s=1/0;for(let o=0;o<e.length;o++){const n=e[o],r=e[(o+1)%e.length],a=r[0]-n[0],l=r[1]-n[1],c=a*a+l*l;let h=c?((t[0]-n[0])*a+(t[1]-n[1])*l)/c:0;h=Math.max(0,Math.min(1,h));const d=[n[0]+h*a,n[1]+h*l],p=Math.hypot(t[0]-d[0],t[1]-d[1]);p<s&&(s=p,i=d)}return i}function Ae(t,e,i=1e-6){if(!e||e.length<2)return!1;for(let s=0;s<e.length;s++)if(Pe(t,e[s],e[(s+1)%e.length])<=i)return!0;return!1}function Ee(t,e,i=1e-6){return!(!e||e.length<3)&&(!Ae(t,e,i)&&ze(t,e))}function Ne(t,e,i){return(e[0]-t[0])*(i[1]-t[1])-(e[1]-t[1])*(i[0]-t[0])}function Oe(t,e,i,s,o=1e-9){const n=Ne(i,s,t),r=Ne(i,s,e),a=Ne(t,e,i),l=Ne(t,e,s);return(n>o&&r<-o||n<-o&&r>o)&&(a>o&&l<-o||a<-o&&l>o)}function Ie(t,e=24){const i=t.map(t=>t[0]),s=t.map(t=>t[1]),o=Math.min(...i),n=Math.max(...i),r=Math.min(...s),a=Math.max(...s),l=Math.max(n-o,a-r)||1;let c=0,h=0,d=0;for(let e=0;e<t.length;e++){const i=t[e],s=t[(e+1)%t.length],o=i[0]*s[1]-s[0]*i[1];c+=o,h+=(i[0]+s[0])*o,d+=(i[1]+s[1])*o}const p=Math.abs(c)>1e-9?[h/(3*c),d/(3*c)]:[(o+n)/2,(r+a)/2],u=(e,i)=>{const s=((e,i)=>{if(!ze([e,i],t))return-1/0;let s=1/0;for(let o=0;o<t.length;o++){const n=t[o],r=t[(o+1)%t.length];s=Math.min(s,Hi([e,i],[n[0],n[1],r[0],r[1]]))}return s})(e,i);return s===-1/0?s:s-.08*Math.hypot(e-p[0],i-p[1])-1e-4*l};let _=null,g=-1/0;for(let t=1;t<e;t++)for(let i=1;i<e;i++){const s=o+(n-o)*t/e,l=r+(a-r)*i/e,c=u(s,l);c>g&&(g=c,_=[s,l])}if(_){const[t,i]=_,s=(n-o)/e,l=(a-r)/e;for(let e=-4;e<=4;e++)for(let o=-4;o<=4;o++){const n=t+s*e/4,r=i+l*o/4,a=u(n,r);a>g&&(g=a,_=[n,r])}}return _||Fe(t)||t[0]}function Fe(t,e=1e-6){if(!t||t.length<3)return null;const i=t.length,s=[t.reduce((t,e)=>t+e[0],0)/i,t.reduce((t,e)=>t+e[1],0)/i];if(Ee(s,t,e))return s;for(let s=0;s<i;s++){const o=t[(s-1+i)%i],n=t[s],r=t[(s+1)%i],a=[(o[0]+n[0]+r[0])/3,(o[1]+n[1]+r[1])/3];if(Ee(a,t,e))return a}for(let s=0;s<i;s++)for(let o=s+2;o<i;o++){const i=[(t[s][0]+t[o][0])/2,(t[s][1]+t[o][1])/2];if(Ee(i,t,e))return i}return null}function Le(t,e,i){let s=!0;for(const o of t){if(Ee(o,e,i))return!0;Ae(o,e,i)||(s=!1)}if(s){const s=Fe(t,i);return!!s&&Ee(s,e,i)}return!1}function qe(t,e,i=1e-6){if(!t||!e||t.length<3||e.length<3)return!1;for(let i=0;i<e.length;i++)for(let s=0;s<t.length;s++)if(Oe(e[i],e[(i+1)%e.length],t[s],t[(s+1)%t.length]))return!1;for(const s of e)if(!Ee(s,t,i)&&!Ae(s,t,i))return!1;const s=Fe(e,i);return!!s&&Ee(s,t,i)&&Ue(e)<Ue(t)-i}function He(t,e,i=1e-6){if(!t||!e||t.length<3||e.length<3)return!1;for(let i=0;i<t.length;i++)for(let s=0;s<e.length;s++)if(Oe(t[i],t[(i+1)%t.length],e[s],e[(s+1)%e.length]))return!0;return!qe(t,e,i)&&!qe(e,t,i)&&(Le(t,e,i)||Le(e,t,i))}function Ue(t){if(!t||t.length<3)return 0;let e=0;for(let i=0;i<t.length;i++){const s=t[i],o=t[(i+1)%t.length];e+=s[0]*o[1]-o[0]*s[1]}return Math.abs(e)/2}function Be(t){return[[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]]}function je(t,e){if(!t||!e||t.length<3||e.length<3)return null;const i=((t,...e)=>pe.run("union",t,e))(Be(t),Be(e));if(1!==i.length)return null;if(1!==i[0].length)return null;const s=i[0][0].slice(0,-1).map(t=>[t[0],t[1]]);return s.length>=3?s:null}function We(t,e,i){for(let s=0;s<t.length;s++)if(Pe(e,t[s],t[(s+1)%t.length])<=i)return s;return-1}function Ve(t,e){const i=[];for(const s of t)i.length&&Te(i[i.length-1],s,e)||i.push(s);return i.length>1&&Te(i[0],i[i.length-1],e)&&i.pop(),i}function Ge(t){return t.length?Math.round(t.reduce((t,e)=>t+e,0)/t.length):null}function Ke(t,e){if(e>t[2]/t[3]){const i=t[3],s=t[3]*e;return{x:t[0]-(s-t[2])/2,y:t[1],w:s,h:i}}const i=t[2],s=t[2]/e;return{x:t[0],y:t[1]-(s-t[3])/2,w:i,h:s}}function Ye(t,e,i,s){if(t.length<2)return;const o=e.x+s,n=e.x+e.w-s,r=e.y+s,a=e.y+e.h-s;for(let e=0;e<60;e++){let e=!1;for(let s=0;s<t.length;s++)for(let o=s+1;o<t.length;o++){const n=t[o].x-t[s].x,r=t[o].y-t[s].y,a=Math.hypot(n,r)||.001;if(a<i){const l=(i-a)/2,c=n/a,h=r/a;t[s].x-=c*l,t[s].y-=h*l,t[o].x+=c*l,t[o].y+=h*l,e=!0}}for(const e of t)e.x=Math.max(o,Math.min(n,e.x)),e.y=Math.max(r,Math.min(a,e.y));if(!e)break}}function Xe(t){if(!t)return null;const e=t.trim();return/^(https?:)?\/\//i.test(e)||e.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(e)?/^[a-z][\w+.-]*:/i.test(e)&&!/^https?:/i.test(e)?null:e:null}Xt.set;const Ze=["badge","ripple","icon_ripple","value"],Je=["info","more-info","toggle","run","cover"],Qe=["glow","none","lqi","light","temp"],ti=["none","lqi","light","temp"],ei=new Set(["light","switch","fan","humidifier","cover","valve"]),ii=new Set(["lock","alarm_control_panel"]),si=new Set(["garage","door","gate"]);function oi(t){return(t||[]).find(t=>t.startsWith("cover."))||null}function ni(t){return"opening"===t||"closing"===t}const ri=["automation","script","scene"];function ai(t,e){const i=(e?.entity||"").trim();if(!i)return"";const s=t?.states?.[i],o=s?.state;if(!s||null==o||""===o||"unavailable"===o||"unknown"===o)return"—";const n=(e?.attr||"").trim(),r=function(t){if(null==t)return null;if(Array.isArray(t)){const e=t.map(t=>null==t?"":String(t)).join(", ");return e?e.slice(0,60):null}if("object"==typeof t)return null;const e=String(t);return""===e?null:e.slice(0,60)}(n?s.attributes?.[n]:o);if(null===r)return"—";const a=n?"":String(s.attributes?.unit_of_measurement??"").trim(),l=String(e?.unit??"").trim()||a;return l?`${r} ${l}`:r}function li(t,e,i){const s=t??"";if(!(e?.entity||"").trim())return s;const o=ai(i,e),n=s.indexOf("{}");return n>=0?s.slice(0,n)+o+s.slice(n+2):s?`${s} ${o}`:o}function ci(t){const e=Number(t?.scale);if(Number.isFinite(e)&&e>0)return Math.min(20,Math.max(.15,e));return{s:.7,m:1,l:1.5}[String(t?.size??"")]??1}function hi(t){return String(t??"").replace(/\r\n?/g,"\n").split("\n")}function di(t,e){if(!e)return t;let i=t;for(const[t,s]of Object.entries(e))i=i.split("{"+t+"}").join(String(s));return i}const pi="#55606c",ui=.55;function _i(t){const e=t?.settings||{},i=!t?.plan_url;return{showBorders:e.show_borders??i,showNames:e.show_names??i,color:"string"==typeof e.room_color&&/^#[0-9a-f]{6}$/i.test(e.room_color)?e.room_color:pi,opacity:"number"==typeof e.room_opacity?Math.min(1,Math.max(0,e.room_opacity)):ui,fill:["lqi","light","temp","glow"].includes(e.fill_mode)?e.fill_mode:"none",tempMin:"number"==typeof e.temp_min?e.temp_min:20,tempMax:"number"==typeof e.temp_max?e.temp_max:25,showLqi:"boolean"==typeof e.show_lqi?e.show_lqi:null,cardFontScale:"number"==typeof e.card_font_scale&&e.card_font_scale>0?Math.min(3,Math.max(.5,e.card_font_scale)):1,labelTemp:!0===e.label_temp,labelHum:!0===e.label_hum,labelLqi:!0===e.label_lqi,labelLight:!0===e.label_light,bgColor:"string"==typeof e.bg_color&&/^#[0-9a-f]{6}$/i.test(e.bg_color)?e.bg_color:null}}function gi(t,e){if(e.bgColor)return e.bgColor;const i=t?.bg_color;return"string"==typeof i&&/^#[0-9a-f]{6}$/i.test(i)?i:""}const mi={light_on:{c:"#ffd45c",a:.18},light_off:{c:"#9aa0a6",a:.14},light_none:{c:"#6b7480",a:0},temp_cold:{c:"#4fc3f7",a:.18},temp_ok:{c:"#66d17a",a:.18},temp_hot:{c:"#ffd45c",a:.18},lqi_low:{c:"#f25a4a",a:.18},lqi_high:{c:"#4bd28f",a:.18},glow_base:{c:"#0d1b2a",a:.5},glow_light:{c:"#ffd9a0",a:.85}},fi=/^#[0-9a-f]{6}$/i;function vi(t){const e={},i=t?.fill_colors||{};for(const t of Object.keys(mi)){const s=mi[t],o=i[t];e[t]={c:o&&"string"==typeof o.c&&fi.test(o.c)?o.c:s.c,a:o&&"number"==typeof o.a?Math.min(1,Math.max(0,o.a)):s.a}}return e}function bi(t,e,i){const s=Math.min(1,Math.max(0,i)),o=[1,3,5].map(e=>parseInt(t.slice(e,e+2),16)),n=[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)),r=o.map((t,e)=>Math.round(t+(n[e]-t)*s));return"#"+r.map(t=>t.toString(16).padStart(2,"0")).join("")}function yi(t,e,i,s,o,n,r){if("lqi"===t){if(null==e)return null;const t=(e-40)/140;return{c:bi(r.lqi_low.c,r.lqi_high.c,t),a:r.lqi_low.a+(r.lqi_high.a-r.lqi_low.a)*Math.min(1,Math.max(0,t))}}if("light"===t)return"none"===i?r.light_none.a>0?r.light_none:null:"on"===i?r.light_on:r.light_off;if("temp"===t){if(null==s)return null;const t=Math.min(o,n),e=Math.max(o,n);return s<t?r.temp_cold:s>e?r.temp_hot:r.temp_ok}return null}const wi={blind:["mdi:blinds","mdi:blinds-open"],shade:["mdi:blinds","mdi:blinds-open"],shutter:["mdi:window-shutter","mdi:window-shutter-open"],curtain:["mdi:curtains-closed","mdi:curtains"],window:["mdi:window-closed","mdi:window-open"],awning:["mdi:awning-outline","mdi:awning"],door:["mdi:door-closed","mdi:door-open"],garage:["mdi:garage","mdi:garage-open"],gate:["mdi:gate","mdi:gate-open"],damper:["mdi:circle-slice-8","mdi:circle-outline"]},$i=[["mdi:roller-shade-closed","mdi:roller-shade"],["mdi:blinds-horizontal-closed","mdi:blinds-horizontal"],["mdi:garage-variant","mdi:garage-open-variant"],["mdi:door","mdi:door-open"]];function xi(t){for(const e of[...Object.values(wi),...$i])if(t===e[0]||t===e[1])return e;return null}function ki(t,e,i,s,o){if(!s||"unavailable"===s||"unknown"===s)return t;if(o){const i="cover"===e?xi(t):null;return i?"closed"===s?i[0]:i[1]:t}if("binary_sensor"===e){if("door"===i)return"on"===s?"mdi:door-open":"mdi:door-closed";if("window"===i)return"on"===s?"mdi:window-open":"mdi:window-closed";if("garage_door"===i)return"on"===s?"mdi:garage-open-variant":"mdi:garage-variant"}if("cover"===e){const e=wi[String(i||"")];if(e)return"closed"===s?e[0]:e[1];const o=xi(t);return o?"closed"===s?o[0]:o[1]:t}return"lock"===e?"locked"===s?"mdi:lock":"mdi:lock-open-variant":"light"===e&&"mdi:lightbulb"===t&&"on"===s?"mdi:lightbulb-on":t}function Si(t){if(!t||"on"!==t.state)return null;const e=t.attributes?.rgb_color;return Array.isArray(e)&&e.length>=3&&e.every(t=>Number.isFinite(t))?`rgb(${e[0]}, ${e[1]}, ${e[2]})`:null}function Mi(t,e){if(!t||"on"!==t.state)return null;const i=t.attributes||{},s=Number(i.brightness),o=Number.isFinite(s)&&s>0?Math.max(.15,Math.min(1,s/255)):1,n=i.rgb_color;if(Array.isArray(n)&&n.length>=3&&n.every(t=>Number.isFinite(t)))return{c:`rgb(${n[0]}, ${n[1]}, ${n[2]})`,bri:o};const r=Number(i.color_temp_kelvin)||(Number(i.color_temp)>0?1e6/Number(i.color_temp):NaN);if(Number.isFinite(r)&&r>0){const[t,e,i]=function(t){const e=Math.min(4e4,Math.max(1e3,t))/100,i=e<=66?255:329.698727446*Math.pow(e-60,-.1332047592),s=e<=66?99.4708025861*Math.log(e)-161.1195681661:288.1221695283*Math.pow(e-60,-.0755148492),o=e>=66?255:e<=19?0:138.5177312231*Math.log(e-10)-305.0447927307,n=t=>Math.round(Math.min(255,Math.max(0,t)));return[n(i),n(s),n(o)]}(r);return{c:`rgb(${t}, ${e}, ${i})`,bri:o}}return{c:e,bri:o}}function Di(t,e,i,s,o=170){const n=Math.hypot(e[0]-t[0],e[1]-t[1]),r=Math.hypot(i[0]-t[0],i[1]-t[1]);if(n<1e-6||r<1e-6||Math.min(n,r)>=s)return null;let a=Math.atan2(e[1]-t[1],e[0]-t[0]),l=Math.atan2(i[1]-t[1],i[0]-t[0])-a;for(;l>Math.PI;)l-=2*Math.PI;for(;l<-Math.PI;)l+=2*Math.PI;const c=o*Math.PI/180;if(Math.abs(l)>c){const t=a+l/2;l=c*Math.sign(l),a=t-l/2}const h=[[t[0],t[1]]];for(let e=0;e<=8;e++){const i=a+l*e/8;h.push([t[0]+Math.cos(i)*s,t[1]+Math.sin(i)*s])}return h}function Ci(t,e,i,s,o){const n=e*Math.PI/180,r=[-Math.sin(n),Math.cos(n)],a=(i[0]-t[0])*r[0]+(i[1]-t[1])*r[1]>0?-1:1,l=[t[0]+r[0]*o*a,t[1]+r[1]*o*a];return s.some(t=>Ee(l,t,1e-9))}function Ti(t){return t.startsWith("light.")||t.startsWith("switch.")}function zi(t,e,i=1e-6){const s=[];if(!t||!e||t.length<3||e.length<3)return s;for(let o=0;o<t.length;o++){const n=t[o],r=t[(o+1)%t.length],a=r[0]-n[0],l=r[1]-n[1],c=Math.hypot(a,l);if(c<i)continue;const h=a/c,d=l/c;for(let t=0;t<e.length;t++){const o=e[t],r=e[(t+1)%e.length],a=Math.abs((o[0]-n[0])*d-(o[1]-n[1])*h),l=Math.abs((r[0]-n[0])*d-(r[1]-n[1])*h),p=Math.max(i,1e-6*c);if(a>p||l>p)continue;const u=(o[0]-n[0])*h+(o[1]-n[1])*d,_=(r[0]-n[0])*h+(r[1]-n[1])*d,g=Math.max(0,Math.min(u,_)),m=Math.min(c,Math.max(u,_));m-g>i&&s.push([n[0]+h*g,n[1]+d*g,n[0]+h*m,n[1]+d*m])}}return s}function Pi(t,e){const i=new Set([t]),s=(t,e)=>(t.open_to||[]).includes(e.id)||(e.open_to||[]).includes(t.id);let o=!0;for(;o;){o=!1;for(const t of e)if(t.id&&!i.has(t.id))for(const n of e)if(n.id&&i.has(n.id)&&s(t,n)){i.add(t.id),o=!0;break}}return i}function Ri(t,e,i=1e-6){const s=[];for(const o of t){const t=[o[0],o[1]],n=[o[2],o[3]],r=n[0]-t[0],a=n[1]-t[1],l=Math.hypot(r,a);if(l<i)continue;const c=r/l,h=a/l,d=[];for(const s of e){const e=Math.abs((s[0]-t[0])*h-(s[1]-t[1])*c),o=Math.abs((s[2]-t[0])*h-(s[3]-t[1])*c),n=Math.max(i,1e-6*l);if(e>n||o>n)continue;const r=(s[0]-t[0])*c+(s[1]-t[1])*h,a=(s[2]-t[0])*c+(s[3]-t[1])*h,p=Math.max(0,Math.min(r,a)),u=Math.min(l,Math.max(r,a));u-p>i&&d.push([p,u])}if(!d.length){s.push([t[0],t[1],n[0],n[1]]);continue}d.sort((t,e)=>t[0]-e[0]);let p=0;for(const[e,o]of d)e-p>i&&s.push([t[0]+c*p,t[1]+h*p,t[0]+c*e,t[1]+h*e]),p=Math.max(p,o);l-p>i&&s.push([t[0]+c*p,t[1]+h*p,n[0],n[1]])}return s}const Ai=864e5,Ei=576e5;function Ni(t){const e=new Set,i=t=>{if("string"!=typeof t||!t)return;const i=Oi(t);i.startsWith("/api/houseplan/content/")&&e.add(i)};for(const e of t?.spaces||[]){i(e?.plan_url);for(const t of e?.markers||[])for(const e of t?.pdfs||[])i(e?.url)}for(const e of t?.markers||[])for(const t of e?.pdfs||[])i(t?.url);return e}function Oi(t){return t?t.startsWith("/houseplan_files/plans/")?"/api/houseplan/content/plans/_/"+t.slice(23):t.startsWith("/houseplan_files/files/")?"/api/houseplan/content/files/"+t.slice(23):t:""}function Ii(t,e){const i=e?.settings?.fill_mode;return"none"===i||"lqi"===i||"light"===i||"temp"===i?i:t}function Fi(t,e=1){const i=Number(t);return Number.isFinite(i)&&i>0?Math.min(3,Math.max(.5,i)):e}function Li(t,e){let i=180*Math.atan2(e[1]-t[1],e[0]-t[0])/Math.PI;return i<0&&(i+=360),i}function qi(t,e=.5){const i=(t%45+45)%45;return i<=e||45-i<=e}function Hi(t,e){const i=e[2]-e[0],s=e[3]-e[1],o=i*i+s*s;if(!o)return Math.hypot(t[0]-e[0],t[1]-e[1]);let n=((t[0]-e[0])*i+(t[1]-e[1])*s)/o;return n=Math.max(0,Math.min(1,n)),Math.hypot(t[0]-(e[0]+n*i),t[1]-(e[1]+n*s))}const Ui=new Set(["smoke","gas","carbon_monoxide","moisture","safety","tamper","problem"]);const Bi=(t,e)=>[t[0]-e[0],t[1]-e[1]],ji=(t,e)=>[t[0]+e[0],t[1]+e[1]],Wi=(t,e)=>t[0]*e[0]+t[1]*e[1],Vi=t=>Math.hypot(t[0],t[1]);function Gi(t){let e=0;for(let i=0;i<t.length;i++){const s=t[i],o=t[(i+1)%t.length];e+=s[0]*o[1]-o[0]*s[1]}return e/2}function Ki(t,e,i){const s=Bi(i,e),o=Wi(s,s);if(o<1e-12)return Vi(Bi(t,e));let n=Wi(Bi(t,e),s)/o;return n=Math.max(0,Math.min(1,n)),Vi(Bi(t,[e[0]+s[0]*n,e[1]+s[1]*n]))}function Yi(t,e){const i=t[e],s=t[(e+1)%t.length],o=Bi(s,i),n=Vi(o)||1;let r=[o[1]/n,-o[0]/n];const a=[(i[0]+s[0])/2,(i[1]+s[1])/2],l=Math.max(.01*n,1e-4);return function(t,e){let i=!1;for(let s=0,o=e.length-1;s<e.length;o=s++){const n=e[s][0],r=e[s][1],a=e[o][0],l=e[o][1];r>t[1]!=l>t[1]&&t[0]<(a-n)*(t[1]-r)/(l-r)+n&&(i=!i)}return i}([a[0]+r[0]*l,a[1]+r[1]*l],t)&&(r=[-r[0],-r[1]]),r}function Xi(t,e,i,s){const o=s||Yi(t,e),n=(e+1)%t.length;return t.map((t,s)=>s===e||s===n?[t[0]+o[0]*i,t[1]+o[1]*i]:[...t])}function Zi(t,e,i,s){const o=[],n=Bi(i,e),r=Vi(n);if(r<s)return o;const a=[n[0]/r,n[1]/r];for(let i=0;i<t.length;i++){const n=t[i],l=t[(i+1)%t.length],c=Math.abs((n[0]-e[0])*a[1]-(n[1]-e[1])*a[0]),h=Math.abs((l[0]-e[0])*a[1]-(l[1]-e[1])*a[0]);if(c>s||h>s)continue;const d=Wi(Bi(n,e),a),p=Wi(Bi(l,e),a),u=Math.max(0,Math.min(d,p)),_=Math.min(r,Math.max(d,p));_-u>s&&o.push([[e[0]+a[0]*u,e[1]+a[1]*u],[e[0]+a[0]*_,e[1]+a[1]*_]])}return o}function Ji(t,e,i,s,o){const n=Zi(t,e,i,o);if(!n.length)return null;const r=t=>n.some(([e,i])=>Ki(t,e,i)<=o),a=t.length,l=[];for(let n=0;n<a;n++){const c=t[n],h=t[(n+1)%a];l.push(r(c)?ji(c,s):[...c]);const d=Bi(h,c),p=Vi(d);if(p<o)continue;const u=[d[0]/p,d[1]/p],_=Vi(Bi(i,e))||1,g=[(i[0]-e[0])/_,(i[1]-e[1])/_],m=Math.abs((c[0]-e[0])*g[1]-(c[1]-e[1])*g[0]),f=Math.abs((h[0]-e[0])*g[1]-(h[1]-e[1])*g[0]);if(m>o||f>o)continue;const v=Wi(Bi(e,c),u),b=Wi(Bi(i,c),u),y=Math.max(0,Math.min(v,b)),w=Math.min(p,Math.max(v,b));if(!(w-y<=o)){if(y>o&&y<p-o){const t=[c[0]+u[0]*y,c[1]+u[1]*y];l.push([...t],ji(t,s))}if(w>o&&w<p-o){const t=[c[0]+u[0]*w,c[1]+u[1]*w];l.push(ji(t,s),[...t])}}}return l}function Qi(t,e=1e-6){let i=t.filter((i,s)=>Vi(Bi(i,t[(s+1)%t.length]))>e);for(let t=0;t<2;t++)i=i.filter((t,s)=>{const o=i[(s-1+i.length)%i.length],n=i[(s+1)%i.length],r=(t[0]-o[0])*(n[1]-o[1])-(t[1]-o[1])*(n[0]-o[0]),a=Vi(Bi(n,o))||1;return Math.abs(r)/a>e});return i.length>=3?i:t}function ts(t){const e=t.length;if(e<3)return!1;for(let i=0;i<e;i++)for(let s=i+1;s<e;s++)if(s!==i&&(s+1)%e!==i&&(i+1)%e!==s&&Oe(t[i],t[(i+1)%e],t[s],t[(s+1)%e]))return!1;return!0}function es(t,e,i=1e-6){let s=1/0;for(const[o,n]of e){const e=Bi(n,o),r=Vi(e);if(r<i)continue;const a=[e[0]/r,e[1]/r],l=t=>(t[0]-o[0])*a[1]-(t[1]-o[1])*a[0],c=t=>(t[0]-o[0])*a[0]+(t[1]-o[1])*a[1],h=i,d=r-i;for(const e of t){const t=Math.abs(l(e));if(t<=i)continue;const o=c(e);o<=h||o>=d||t<s&&(s=t)}for(let e=0;e<t.length;e++){const o=t[e],n=t[(e+1)%t.length],r=l(o),a=l(n);if(Math.abs(r)<=i||Math.abs(a)<=i)continue;const p=c(o),u=c(n),_=Math.max(h,Math.min(p,u)),g=Math.min(d,Math.max(p,u));if(g-_<=i)continue;const m=u-p;if(Math.abs(m)<i){s=Math.min(s,Math.abs(r),Math.abs(a));continue}const f=t=>Math.abs(r+(t-p)/m*(a-r));s=Math.min(s,f(_),f(g))}}return s}function is(t,e,i){if(He(t,e,i))return!0;if(qe(t,e,i)||qe(e,t,i))return!1;let s=0;try{const i=ve([[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]],[[...e.map(t=>[t[0],t[1]]),[e[0][0],e[0][1]]]]);for(const t of i)t?.[0]&&(s+=Ue(t[0]))}catch{return!1}return s>Math.max(1e-7,i*i)}function ss(t,e,i,s,o){const n=[i.n[0]*s,i.n[1]*s],r={polys:{},openings:{},movedSpans:{}};if(Math.abs(s)<1e-9)return r;for(const e of t){if(e.id===i.roomId){r.polys[e.id]=Xi(e.poly,i.edge,s,i.n),r.movedSpans[e.id]=[[ji(i.a,n),ji(i.b,n)]];continue}const t=Zi(e.poly,i.a,i.b,o);if(!t.length)continue;const a=Ji(e.poly,i.a,i.b,n,o);a&&(r.polys[e.id]=a,r.movedSpans[e.id]=t.map(([t,e])=>[ji(t,n),ji(e,n)]))}for(const t of e)Ki([t.x,t.y],i.a,i.b)<=o&&(r.openings[t.id]=[t.x+n[0],t.y+n[1]]);return r}function os(t,e,i){for(const s of e)for(let e=0;e<s.length;e++){const o=s[e],n=s[(e+1)%s.length],r=Bi(n,o),a=Vi(r);if(a<i)continue;const l=[r[0]/a,r[1]/a];if(Math.abs((t.x-o[0])*l[1]-(t.y-o[1])*l[0])>i)continue;const c=(t.x-o[0])*l[0]+(t.y-o[1])*l[1];if(c-t.length/2>=-i&&c+t.length/2<=a+i)return!0}return!1}function ns(t,e,i){return t.filter(t=>e.some(e=>{for(let s=0;s<e.length;s++)if(Ki([t.x,t.y],e[s],e[(s+1)%e.length])<=i)return!0;return!1}))}function rs(t,e,i,s,o){const{minDim:n,eps:r}=o;if(!Number.isFinite(s))return!1;if(Math.abs(s)<1e-9)return!0;const a=ss(t,e,i,s,r),l=Object.keys(a.polys),c=t=>a.polys[t.id]||t.poly;for(const e of l){const s=t.find(t=>t.id===e),o=a.polys[e];if(!ts(o))return!1;const l=Gi(s.poly),h=Gi(o);if(Math.abs(h)<r||l*h<=0)return!1;const d=e===i.roomId?[[i.a,i.b]]:Zi(s.poly,i.a,i.b,r),p=es(s.poly,d,r);if(es(o,a.movedSpans[e]||[],r)<Math.min(n,p)-r)return!1;for(const i of t){if(i.id===e)continue;const t=c(i);if(qe(s.poly,i.poly,r)){if(!qe(o,t,r))return!1}else if(qe(i.poly,s.poly,r)){if(!qe(t,o,r))return!1}else{if(qe(o,t,r)||qe(t,o,r))return!1;if(is(o,t,r))return!1}}}const h=l.map(e=>t.find(t=>t.id===e).poly),d=t.map(c);for(const t of ns(e,h,2*r)){const e=a.openings[t.id];if(!os(e?{...t,x:e[0],y:e[1]}:t,d,2*r))return!1}return!0}function as(t,e,i,s,o,n){const r=t=>[s[0]+(t[0]-s[0])*o,s[1]+(t[1]-s[1])*o],a={poly:t.poly.map(r),openings:{}};for(const s of e){let e=!1;for(let i=0;i<t.poly.length;i++)if(Ki([s.x,s.y],t.poly[i],t.poly[(i+1)%t.poly.length])<=n){e=!0;break}if(!e)continue;if(!i.some(t=>{for(let e=0;e<t.length;e++)if(Ki([s.x,s.y],t[e],t[(e+1)%t.length])<=n)return!0;return!1})){const t=r([s.x,s.y]);a.openings[s.id]=[t[0],t[1]]}}return a}function ls(t,e,i,s,o,n){const{minDim:r,eps:a}=n;if(!Number.isFinite(o)||o<=0)return!1;if(Math.abs(o-1)<1e-9)return!0;const l=t.find(t=>t.id===i);if(!l)return!1;const c=t.filter(t=>t.id!==i).map(t=>t.poly),h=as(l,e,c,s,o,2*a),d=h.poly,p=function(t){const e=function(t){const e=[...t].sort((t,e)=>t[0]-e[0]||t[1]-e[1]);if(e.length<3)return e;const i=(t,e,i)=>(e[0]-t[0])*(i[1]-t[1])-(e[1]-t[1])*(i[0]-t[0]),s=[];for(const t of e){for(;s.length>=2&&i(s[s.length-2],s[s.length-1],t)<=0;)s.pop();s.push(t)}const o=[];for(let t=e.length-1;t>=0;t--){const s=e[t];for(;o.length>=2&&i(o[o.length-2],o[o.length-1],s)<=0;)o.pop();o.push(s)}return s.pop(),o.pop(),s.concat(o)}(t);if(e.length<3)return 0;let i=1/0;for(let t=0;t<e.length;t++){const s=e[t],o=e[(t+1)%e.length],n=Bi(o,s),r=Vi(n);if(r<1e-12)continue;const a=[n[0]/r,n[1]/r];let l=0;for(const t of e)l=Math.max(l,Math.abs((t[0]-s[0])*a[1]-(t[1]-s[1])*a[0]));l<i&&(i=l)}return Number.isFinite(i)?i:0}(l.poly);if(p*o<Math.min(r,p)-a)return!1;for(const e of t)if(e.id!==i)if(qe(l.poly,e.poly,a)){if(!qe(d,e.poly,a))return!1}else if(qe(e.poly,l.poly,a)){if(!qe(e.poly,d,a))return!1}else{if(qe(d,e.poly,a)||qe(e.poly,d,a))return!1;if(is(d,e.poly,a))return!1}const u=t.map(t=>t.id===i?d:t.poly);for(const t of ns(e,[l.poly],2*a)){const e=h.openings[t.id];if(!os(e?{...t,x:e[0],y:e[1]}:t,u,2*a))return!1}return!0}function cs(t,e,i){const s=i/e;return Ue(t)*s*s/1e4}function hs(t,e){return e?`${Math.round(10.7639*t)} ft²`:`${(Math.round(10*t)/10).toFixed(1)} m²`}const ds=[[-90,"#070c14"],[-12,"#070c14"],[-4,"#131a28"],[0,"#4a3527"],[10,"#e8ddcf"],[30,"#ffffff"],[90,"#ffffff"]],ps=t=>Math.min(1,Math.max(0,t));function us(t){const e=Math.min(90,Math.max(-90,Number(t)||0));let i=ds[ds.length-1][1];for(let t=1;t<ds.length;t++){const[s,o]=ds[t-1],[n,r]=ds[t];if(e<=n){i=bi(o,r,(e-s)/(n-s));break}}return{bg:i,planDim:.1*ps((10-e)/16),warmth:e<0?1:ps(1-e/10)}}function _s(t,e,i=6){const s=t.angle*Math.PI/180,o=[Math.sin(s),-Math.cos(s)],n=s=>{const n=[t.x+o[0]*i*s,t.y+o[1]*i*s];return e.find(t=>t.poly.length>=3&&ze(n,t.poly))||null},r=n(1),a=n(-1);return r&&a?null:r||a?r?{normal:[-o[0],-o[1]],roomId:r.id}:{normal:o,roomId:a.id}:null}function gs(t,e,i){return i>0&&t[0]*e[0]+t[1]*e[1]>.05}function ms(t,e,i,s){return[[t[0],t[1]],[e[0],e[1]],[e[0]+i[0]*s,e[1]+i[1]*s],[t[0]+i[0]*s,t[1]+i[1]*s]]}function fs(t,e){try{const i=ve([[...t.map(t=>[t[0],t[1]]),[t[0][0],t[0][1]]]],[[...e.map(t=>[t[0],t[1]]),[e[0][0],e[0][1]]]]),s=[];for(const t of i){const e=t?.[0];!Array.isArray(e)||e.length<4||s.push(e.slice(0,e.length-1).map(t=>[t[0],t[1]]))}return s}catch{return[]}}function vs(t,e,i,s,o){if(!(s>0))return[];const n=function(t,e){const i=function(t,e){return function(t){const e=t%360;return e<0?e+360:e}(t-e)}(t,e)*Math.PI/180;return[Math.sin(i),-Math.cos(i)]}(i,o),r=[-n[0],-n[1]],a=function(t){const e=Math.min(90,Math.max(0,t));return.7*(.8+1.7*Math.pow(1-e/90,1.6))}(s),l=[];for(const i of e){if(!(i.length>0))continue;const e=_s(i,t);if(!e||!gs(e.normal,n,s))continue;const o=t.find(t=>t.id===e.roomId);if(!o)continue;const c=i.angle*Math.PI/180,h=Math.cos(c)*i.length/2,d=Math.sin(c)*i.length/2,p=[i.x-h,i.y-d],u=[i.x+h,i.y+d],_=a*i.length,g=fs(ms(p,u,r,_),o.poly);if(!g.length)continue;const m=[-e.normal[0],-e.normal[1]],f=r[0]*m[0]+r[1]*m[1];l.push({openingId:i.id,roomId:e.roomId,polys:g,a:p,b:u,dir:r,len:_,normal:m,depth:_*f})}return l}function bs(t){return Math.round(10*(Number(t)||0))/10}const ys={clear:1,sunny:1,"clear-night":1,windy:1,exceptional:1,partlycloudy:.7,"windy-variant":.7,cloudy:.4,overcast:.25,fog:.25,rainy:0,pouring:0,snowy:0,"snowy-rainy":0,hail:0,lightning:0,"lightning-rainy":0};const ws=t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=359?t:null;function $s(t,e){const i=ws(e?.north_deg);return null!==i?i:ws(t?.north_deg)}function xs(t,e){const i=t=>"static"===t||"daynight"===t?t:null;return i(e?.bg_mode)??i(t?.bg_mode)??"static"}function ks(t,e){const i=e?.sun_rays;return"boolean"==typeof i?i:!0===t?.sun_rays}function Ss(t){const e=t?.weather_entity;return"string"==typeof e&&e.trim()?e.trim():null}function Ms(t){const e=t?.states?.["sun.sun"]?.attributes,i=Number(e?.azimuth),s=Number(e?.elevation);return Number.isFinite(i)&&Number.isFinite(s)?{azimuth:i,elevation:s}:null}class Ds{constructor(t,e=()=>Date.now()){this.onUpdate=t,this.now=e,this.signed={},this.queued=new Set,this.inFlight=new Map,this.retry=new Map,this.disposed=!1}start(t,e){this.disposed=!1,this.stopTimer(),this.resignTimer=setInterval(()=>this.resign(t(),e()),288e5)}dispose(){this.disposed=!0,this.stopTimer(),clearTimeout(this.batchTimer),this.queued.clear(),this.inFlight.clear()}stopTimer(){void 0!==this.resignTimer&&clearInterval(this.resignTimer),this.resignTimer=void 0}display(t,e){const i=Oi(e);if(!i.startsWith("/api/houseplan/content/"))return i;const s=this.signed[i],o=s?this.now()-s.at:1/0;return o<Ei?s.url:o<Ai?(this.request(t,i),s.url):(s&&delete this.signed[i],this.request(t,i),"")}request(t,e){if(!t?.callWS||this.queued.has(e))return;const i=this.now(),s=this.inFlight.get(e);if(void 0!==s&&i-s<15e3)return;const o=this.retry.get(e);o&&i<o.notBefore||(this.queued.add(e),clearTimeout(this.batchTimer),this.batchTimer=setTimeout(()=>{const e=[...this.queued];this.queued.clear(),this.sign(t,e)},30))}sign(t,e){if(e.length&&t?.callWS)for(const i of function(t,e){const i=Math.max(1,Math.floor(e)),s=[];for(let e=0;e<t.length;e+=i)s.push(t.slice(e,e+i));return s}(e,200)){const e=this.now();for(const t of i)this.inFlight.set(t,e);t.callWS({type:"houseplan/content/sign",paths:i}).then(t=>{if(this.disposed)return;const e=this.now(),s={...this.signed};let o=0;for(const n of i){const i=t?.urls?.[n];"string"==typeof i&&i?(s[n]={url:i,at:e},this.retry.delete(n),o++):this.backOff(n)}o&&(this.signed=s,this.onUpdate())}).catch(()=>{for(const t of i)this.backOff(t)}).finally(()=>{for(const t of i)this.inFlight.get(t)===e&&this.inFlight.delete(t)})}}backOff(t){const e=this.retry.get(t)?.delay||0,i=Math.min(6e4,e?2*e:2e3);this.retry.set(t,{notBefore:this.now()+i,delay:i})}resign(t,e){const i=this.now(),s={};for(const[t,o]of Object.entries(this.signed))e.has(t)&&i-o.at<Ai&&(s[t]=o);this.signed=s,this.retry.clear(),this.sign(t,Object.keys(s))}get entries(){return this.signed}get inFlightUrls(){return[...this.inFlight.keys()]}}function Cs(t,e,i){return[t[0]*e+t[1]*i+t[2],t[3]*e+t[4]*i+t[5]]}function Ts(t,e){let i=0;for(const[s,o]of e){const e=Cs(t,s[0],s[1]);i=Math.max(i,Math.hypot(e[0]-o[0],e[1]-o[1]))}return i}const zs=t=>{const e=Number(t);return Number.isFinite(e)?e:null};function Ps(t){if(!t)return null;const e=t.vacuum_position||t.robot_position||null,i=e&&null!=zs(e.x)&&null!=zs(e.y)?{x:zs(e.x),y:zs(e.y),a:zs(e.a??e.angle??e.theta)}:null;let s=null;const o=t.path?.points??t.path;if(Array.isArray(o)&&o.length){s=[];for(const t of o){const e=zs(Array.isArray(t)?t[0]:t?.x),i=zs(Array.isArray(t)?t[1]:t?.y);null!=e&&null!=i&&s.push([e,i])}s.length||(s=null)}const n=[],r=t.rooms,a=Array.isArray(r)?r.map((t,e)=>[String(t?.id??e),t]):r&&"object"==typeof r?Object.entries(r):[];for(const[t,e]of a){if(!e||"object"!=typeof e)continue;const i=String(e.name??e.label??"").trim();let s=zs(e.cx??e.center?.x),o=zs(e.cy??e.center?.y);if(null==s||null==o){const t=zs(e.x0),i=zs(e.y0),n=zs(e.x1),r=zs(e.y1);null!=t&&null!=i&&null!=n&&null!=r&&(s=(t+n)/2,o=(i+r)/2)}if(null!=s&&null!=o||(s=zs(e.x),o=zs(e.y)),i&&null!=s&&null!=o){const r={id:t,name:i,cx:s,cy:o},a=zs(e.x0),l=zs(e.y0),c=zs(e.x1),h=zs(e.y1);null!=a&&null!=l&&null!=c&&null!=h&&(r.x0=Math.min(a,c),r.y0=Math.min(l,h),r.x1=Math.max(a,c),r.y1=Math.max(l,h)),n.push(r)}}const l=function(t){return String(t.map_name??t.current_map??t.map_index??t.selected_map??"default")}(t);return i||n.length||s?{pos:i,path:s,rooms:n,mapId:l}:null}function Rs(t){const e=t?.attributes;return!(!e||!e.vacuum_position&&!e.robot_position)}const As=t=>t.toLowerCase().replace(/[\s_\-.,]+/g,"");function Es(t,e){const i=new Map(e.map(t=>[As(t.name),t])),s=[],o=[];for(const e of t){const t=i.get(As(e.name));t&&(s.push([[e.cx,e.cy],[t.cx,t.cy]]),o.push(e.name))}if(s.length<3)return null;const n=function(t){if(t.length<3)return null;let e=0,i=0,s=0,o=0,n=0,r=0,a=0,l=0,c=0,h=0,d=0,p=0;for(const[[u,_],[g,m]]of t){if(![u,_,g,m].every(Number.isFinite))return null;e+=u*u,i+=u*_,s+=u,o+=_*_,n+=_,r+=1,a+=u*g,l+=_*g,c+=g,h+=u*m,d+=_*m,p+=m}const u=[e,i,s,i,o,n,s,n,r],_=t=>{const[e,i,s,o,n,r,a,l,c]=u,h=e*(n*c-r*l)-i*(o*c-r*a)+s*(o*l-n*a);if(!Number.isFinite(h)||Math.abs(h)<1e-9)return null;const d=[(n*c-r*l)/h,(s*l-i*c)/h,(i*r-s*n)/h,(r*a-o*c)/h,(e*c-s*a)/h,(s*o-e*r)/h,(o*l-n*a)/h,(i*a-e*l)/h,(e*n-i*o)/h];return[d[0]*t[0]+d[1]*t[1]+d[2]*t[2],d[3]*t[0]+d[4]*t[1]+d[5]*t[2],d[6]*t[0]+d[7]*t[1]+d[8]*t[2]]},g=_([a,l,c]),m=_([h,d,p]);if(!g||!m)return null;const f=[g[0],g[1],g[2],m[0],m[1],m[2]];return f.every(Number.isFinite)?f:null}(s);return n?{matrix:n,matched:o,residual:Ts(n,s)}:null}function Ns(t,e,i){const s=t[t.length-1];if(s&&s[0]===e[0]&&s[1]===e[1])return t;if(t.push(e),t.length<=600)return t;let o=function(t,e){if(t.length<3)return t.slice();const i=new Uint8Array(t.length);i[0]=i[t.length-1]=1;const s=[[0,t.length-1]];for(;s.length;){const[o,n]=s.pop(),[r,a]=t[o],[l,c]=t[n],h=l-r,d=c-a,p=Math.hypot(h,d)||1e-9;let u=0,_=-1;for(let e=o+1;e<n;e++){const i=Math.abs((t[e][0]-r)*d-(t[e][1]-a)*h)/p;i>u&&(u=i,_=e)}_>0&&u>e&&(i[_]=1,s.push([o,_],[_,n]))}const o=[];for(let e=0;e<t.length;e++)i[e]&&o.push(t[e]);return o}(t,i);return o.length>600&&(o=o.filter((t,e)=>e%2==0||e===o.length-1)),o}function Os(t){return"cleaning"===t||"returning"===t||"on"===t}const Is={0:[1,0],90:[0,1],180:[-1,0],270:[0,-1]};function Fs(t){const[e,i]=Is[t.rot]||[1,0],s=t.mir?-1:1;return[t.s*e*s,-t.s*i,t.ox,t.s*i*s,t.s*e,t.oy]}function Ls(t,e,i,s){const[o,n]=Cs(Fs(e),i,s),r=Fs({...t,ox:0,oy:0}),[a,l]=Cs(r,i,s);return{...t,ox:o-a,oy:n-l}}function qs(t){const e=t?.trail_mode;return"never"===e||"cleaning"===e||"always"===e?e:!1===t?.trail?"never":"cleaning"}function Hs(t){const e={};for(const[i,s]of Object.entries(t.entities))s?.device_id&&(e[s.device_id]=e[s.device_id]||[]).push(i);return e}function Us(t,e,i){if(e.identifiers?.[0]?.[0])return e.identifiers[0][0];for(const e of i){const i=t.entities[e]?.platform;if(i)return i}return""}function Bs(t,e){if(/_device_temperature$/.test(e))return!1;if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_temperature$/.test(e);const s=i.attributes||{};return"temperature"===s.device_class||/°C|°F/.test(s.unit_of_measurement||"")||/_temperature$/.test(e)}function js(t,e,i){const s=e.map(e=>({eid:e,reg:t.entities[e],st:t.states[e]})).filter(t=>t.reg),o=[s.filter(t=>!t.reg.hidden&&!t.reg.entity_category),s.filter(t=>!t.reg.entity_category),s.filter(t=>!t.reg.hidden),s];if("mdi:thermometer"===i||"mdi:air-filter"===i)for(const e of o){const i=e.find(e=>Bs(t,e.eid));if(i)return i.eid}for(const t of o)for(const e of ft){const i=t.find(t=>t.eid.split(".")[0]===e);if(i)return i.eid}for(const t of o)if(t.length)return t[0].eid}function Ws(t,e){const i=!0===e.marker?.is_light?[...e.marker?.controls||[],...e.entities]:e.entities.filter(t=>t.startsWith("light."));return i.find(e=>"on"===t.states[e]?.state)||null}function Vs(t,e){const i=[];for(const s of e){const e=t.states[s];if(!e)continue;const o=(e.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(s)||"lqi"===o){const t=parseFloat(e.state);isNaN(t)||i.push(t);continue}const n=e.attributes?.linkquality??e.attributes?.lqi;if(null!=n){const t=parseFloat(n);isNaN(t)||i.push(t)}}return Ge(i)}function Gs(t,e){for(const i of e){if(!Bs(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(10*s)/10}return null}function Ks(t,e){for(const i of e){if(!i.startsWith("climate."))continue;const e=t.states[i];if(!e||"unavailable"===e.state||"unknown"===e.state)continue;const s=parseFloat(e.attributes?.current_temperature);if(Number.isFinite(s))return Math.round(10*s)/10}return null}function Ys(t,e){if(t.entities?.[e]?.entity_category)return!1;const i=t.states[e];if(!i)return/_humidity$/.test(e);const s=i.attributes||{};return"humidity"===s.device_class||"%"===s.unit_of_measurement&&/_humidity$/.test(e)||/_humidity$/.test(e)}function Xs(t,e){for(const i of e){if(!Ys(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(s)}return null}function Zs(t,e){if(!e)return[];const i=[];for(const[e,s]of Object.entries(t.entities)){if(!e.startsWith("light.")||s.hidden)continue;let o=null;if("group"===s.platform)o=s.area_id||null;else{if(!s.device_id)continue;{const e=t.devices[s.device_id];if("Group"!==e?.model)continue;o=e.area_id||s.area_id||null}}if(!o)continue;const n=t.states[e];i.push({eid:e,name:s.name||n?.attributes?.friendly_name||e,area:o})}return i}function Js(t,e,i,s,o){const n=mt(e,i,o);if(n!==gt)return n;const r=[];for(const e of s){const i=t.states[e]?.attributes?.device_class;i&&r.push(i)}return function(t){for(const e of t){const t=_t[e];if(t)return t}return null}(r)??gt}function Qs(t,e){t.marker=e,e.hidden&&(t.hidden=!0),e.name&&(t.name=e.name),e.icon&&(t.icon=e.icon),null!=e.model&&(t.model=e.model),t.link=e.link??null,t.description=e.description??null,t.pdfs=e.pdfs||[],t.tapAction=e.tap_action??null}function to(t){const{hass:e,areaToSpace:i,markers:s,settings:o,excluded:n,showAll:r,firstSpaceId:a,loc:l,iconRules:c}=t,h=!1!==o.group_lights,d=Zs(e,h),p=new Set(d.map(t=>t.area)),u=Hs(e),_=new Set;for(const t of s){const[e,i]=t.binding.split(":");"device"!==e&&"entity"!==e||!i||_.add(t.binding)}const g=(t,e)=>s.find(i=>i.binding===t+":"+e),m={},f=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(_.has("device:"+t.id))continue;const a=g("device",t.id);if(a&&a.hidden&&!o.filter_seeded)continue;const d=u[t.id]||[],v=Us(e,t,d),b=!o.filter_seeded;if(b&&!r){if(n.has(v))continue;if("Group"===t.model)continue;if(/scene/i.test(t.model||""))continue;if(/bridge/i.test((t.model||"")+(t.name||"")))continue;if("myheat"===v&&t.via_device_id)continue}const y=(t.name_by_user||t.name||l("device.unnamed")).trim(),w=y+"|"+s;let $=Js(e,y,t.model,d,c);if(d.some(t=>t.startsWith("lock."))&&($="mdi:lock"),b&&!r&&h&&"mdi:lightbulb"===$&&p.has(s))continue;m[w]=(m[w]||0)+1;const x=m[w]>1?y+" "+m[w]:y,k={id:t.id,name:x,model:t.model||"",area:s,space:i[s],icon:$,entities:d,bindingKind:"device",bindingRef:t.id,pdfs:[]};k.primary=js(e,d,$),"mdi:thermometer"!==$&&"mdi:air-filter"!==$||(k.temp=Gs(e,d)),k.primary&&Ys(e,k.primary)&&(k.hum=Xs(e,d)),f.push(k)}for(const t of d)i[t.area]&&(_.has("entity:"+t.eid)||f.push({id:"lg_"+t.eid,name:t.name,model:l("device.light_group"),area:t.area,space:i[t.area],icon:"mdi:lightbulb-group",entities:[t.eid],primary:t.eid,bindingKind:"entity",bindingRef:t.eid,pdfs:[]}));for(const t of s){if(t.hidden&&!o.filter_seeded)continue;const[s,n]=t.binding.split(":");if("device"===s){const s=e.devices[n],o=t.area||s?.area_id||"",r=o&&i[o]||t.space||a,h=s&&u[s.id]||[];let d=s?Js(e,s.name_by_user||s.name||"",s.model,h,c):"mdi:help-circle";h.some(t=>t.startsWith("lock."))&&(d="mdi:lock");const p={id:t.id,name:s?.name_by_user||s?.name||l("device.fallback"),model:s?.model||"",area:o,space:r,icon:d,entities:h,bindingKind:"device",bindingRef:n};p.primary=js(e,h,d),"mdi:thermometer"!==d&&"mdi:air-filter"!==d||(p.temp=Gs(e,h)),p.primary&&Ys(e,p.primary)&&(p.hum=Xs(e,h)),p.primary&&Ys(e,p.primary)&&(p.hum=Xs(e,h)),Qs(p,t),f.push(p)}else if("entity"===s){const s=e.entities[n],o=t.area||s?.area_id||s?.device_id&&e.devices[s.device_id]?.area_id||"",r=o&&i[o]||t.space||a,l=e.states[n],h=s?.name||l?.attributes?.friendly_name||n;let d=Js(e,h,"",[n],c);n.startsWith("lock.")&&(d="mdi:lock");const p={id:t.id,name:h,model:"",area:o,space:r,icon:d,entities:[n],primary:n,bindingKind:"entity",bindingRef:n};"mdi:thermometer"!==d&&"mdi:air-filter"!==d||(p.temp=Gs(e,[n])),Ys(e,n)&&(p.hum=Xs(e,[n])),Qs(p,t),f.push(p)}else{const e=t.area||"",s=t.space||e&&i[e]||a,o={id:t.id,name:t.name||l("device.virtual"),model:t.model||"",area:e,space:s,icon:t.icon||"mdi:map-marker",entities:[],bindingKind:"virtual",virtual:!0};Qs(o,t),f.push(o)}}return f}function eo(t,e,i){let s=!1;for(const o of e)if(o.area===i&&!o.hidden)for(const e of o.entities)if(e.startsWith("light.")&&(s=!0,"on"===t.states[e]?.state))return"on";return s?"off":"none"}function io(t,e,i){if(!e)return null;const s=e.indexOf(":");if(s<0)return null;const o=e.slice(0,s),n=e.slice(s+1);if(!n)return null;if("entity"===o){const e=parseFloat(t.states[n]?.state);return Number.isFinite(e)?"temp"===i?Math.round(10*e)/10:Math.round(e):null}if("device"===o){const e=Object.entries(t.entities).filter(([,t])=>t.device_id===n).map(([t])=>t);return"temp"===i?Gs(t,e):Xs(t,e)}return null}const so=new RegExp(["water","voda","coolant","flow_?temp","return_?temp","target","setpoint","chip","cpu","processor","board","core_temp","device_temp","batter","akkum","freezer","fridge","oven","kettle","boiler"].join("|"),"i");var oo={"card.title":"House plan","count.devices":"{n} dev.","empty.no_spaces":"No spaces yet.","empty.add_first":"Add the first space and upload a floor plan.","empty.install":'Install the House Plan integration and add it in "Devices & services".',"btn.add_space":"Add space","btn.cancel":"Cancel","btn.save":"Save","btn.close":"Close","btn.delete":"Delete","btn.remove":"Remove","btn.edit":"Edit","btn.open_in_ha":"Open in HA","btn.reset":"Reset","btn.attach":"Attach…","btn.upload":"Upload…","btn.replace":"Replace…","btn.no_area":"No area","title.zoom_in":"Zoom in","title.zoom_out":"Zoom out","title.zoom_fit":"Fit all","title.add_device":"Add a device to the plan","title.show_all":"Show hidden devices (ghosted, this tab only)","title.markup":"Room markup: grid, lines, outlines","title.configure_space":"Configure space","title.add_space":"Add space","title.markup_add":"Add a room: connect grid dots with lines until the outline closes","title.markup_merge":"Merge rooms: click one room, then the neighbour it shares a wall with","title.markup_split":"Split a room: click the room, then two points on its walls","title.markup_delroom":"Delete a room: click inside the room","title.no_area_room":"Decorative room without an HA area (e.g. a hallway)","title.choose_area":"Select a Home Assistant area","title.need_plan":"Upload a floor-plan image","markup.add":"Add","markup.merge":"Merge","markup.split":"Split","markup.resize":"Resize","title.markup_resize":"Resize rooms: drag a wall handle; click a room for a corner scale frame","markup.hint_resize":"drag a wall handle · click a room — corner frame · Esc cancels a drag · Ctrl+Z — undo a step","markup.opening":"Opening","title.markup_opening":"Doors & windows: click a wall to place, click an opening to edit","opening.new":"New opening","opening.edit":"Door / window","opening.door":"Door","opening.window":"Window","opening.type_label":"Type","opening.length_label":"Length, cm","opening.contact_label":"Open/close sensor","opening.lock_label":"Lock","opening.none":"— none —","opening.invert":"Invert open/closed","opening.flip_h":"Hinge on the other jamb","opening.flip_v":"Opens to the other side","opening.open":"Open","opening.closed":"Closed","opening.locked":"Locked","opening.unlocked":"Unlocked","opening.state_unknown":"unavailable","opening.no_entities":"No sensors bound — a static symbol on the plan.","toast.opening_no_wall":"Click next to a room wall — openings sit on walls","markup.delete":"Delete","markup.hint_points":"points: {n} · Esc/Ctrl+Z — undo a dot · close the outline by clicking the first one","markup.hint_start":"click a grid dot to start the outline","tip.lqi":"average zigbee signal:","info.device_header":"Device on the plan","info.model":"Model","info.state":"State","info.link":"Link","info.manuals":"Manuals","info.none":"No additional information","marker.new_device":"New device","marker.name_label":"Name (shown on the plan)","marker.name_ph":"Name","marker.binding_label":"Bind to an HA device","marker.virtual_option":"Virtual device (no binding)","marker.search_ph":"Search device / group…","marker.nothing_found":"nothing found","marker.room_label":"Room","marker.room_override":" (override placement)","marker.room_choose":"— select a room —","marker.room_auto":"— by device area (auto) —","marker.icon_label":"Icon","marker.icon_ph":"mdi:… (empty = auto)","marker.display_label":"Display","display.badge":"Icon badge","display.ripple":"Ripple only","display.icon_ripple":"Icon + ripple","marker.ripple_size":"Ripple size","marker.size_label":"Icon size / rotation","marker.angle_label":"Rotate","marker.model_label":"Model","marker.model_ph":"e.g. Aqara T&H","marker.link_label":"Link","marker.desc_label":"Description","marker.desc_ph":"Notes, specs…","marker.manuals_label":"Manuals (PDF etc.)","marker.sub_device":"device","marker.sub_z2m_group":" · Z2M group","marker.sub_group":"group","marker.sub_helper":"helper","space.new":"New space","space.header":"Space","space.title_label":"Title","space.title_ph":"e.g. Garage","space.plan_label":"Floor plan (background)","space.no_plan":"no plan image","space.plan_alt":"plan","room.new":"New room","room.name_label":"Display name","room.name_ph":"e.g. Terrace","room.area_label":"Home Assistant area (unassigned)","room.no_area_option":"— no area —","room.default_name":"Room","device.unnamed":"unnamed","device.light_group":"light group","device.fallback":"device","device.virtual":"virtual device","confirm.delete_room":'Delete room "{name}"?',"confirm.remove_marker":'Remove "{name}" from the plan?',"confirm.delete_space":'Delete space "{title}" with all its rooms and markup?',"toast.pos_save_failed":"Failed to save position: {err}","toast.no_entity":"The device has no suitable entity","toast.markup_needs_server":"Markup is available after the config is moved to the server","toast.conflict":"Config was changed in another window — data refreshed, repeat your last action","toast.cfg_save_failed":"Failed to save config: {err}","toast.room_overlap":"The outline overlaps room “{name}” — rooms must not overlap","toast.merge_not_adjacent":"Only rooms that share a wall can be merged","toast.rooms_merged":"Rooms merged into “{name}”","toast.split_pick_wall":"Start the cut on the room’s wall","toast.split_bad_cut":"The cut must run wall to wall inside the room, without crossing walls or itself","merge.header":"Merge rooms","merge.hint":"The merged room keeps one name and one area. The other area is released — its devices leave the plan until another room claims it.","merge.keep":"Keep","merge.no_area":"no area","room.split_header":"New room from the split","toast.room_saved":"Room saved ({n}). Devices added: {added}. Outline the next one or exit markup.","toast.room_saved_no_area":"Room saved ({n}, no area). Outline the next one or exit markup.","toast.marker_needs_server":"Device editing is available after the config is moved to the server","toast.virtual_name_required":"Enter a name for the virtual device","toast.marker_saved":"Device saved","toast.marker_removed":"Device removed from the plan","toast.integration_missing":"The House Plan integration is not installed — management unavailable","toast.plan_formats":"Supported formats: SVG, PNG, JPG, WebP","toast.plan_required":"Upload a floor plan — it is required","toast.space_added_onboard":"Space added. Outline the rooms: click grid dots and close the contour.","toast.space_added":"Space added","toast.space_saved":"Space saved","toast.space_deleted":"Space deleted","toast.delete_failed":"Delete failed: {err}","toast.error":"Error: {err}","toast.file_failed":'File "{name}" was not uploaded: {err}',"toast.files_attached":"Files attached: {n}","err.unknown":"unknown error","err.code":"code {code}","err.too_large":"file larger than {mb} MB","err.bad_ext":"unsupported type (PDF/image expected)","err.unauthorized":"administrator rights required","editor.title":"Title","editor.default_floor":"Default space","editor.icon_size":"Icon size, % of plan width","editor.show_temperature":"Show temperature","editor.live_states":"Live states (on/off, open…)","editor.show_signal":"Show zigbee signal (LQI)","editor.language":"Interface language","editor.lang_auto":"Auto (HA profile)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Icon rules: which MDI icon devices get by name","rules.title":"Icon rules","rules.hint":"Rules are checked top-down against “device name + model” (case-insensitive regex); the first match wins. When nothing matches, the entity device class decides, then the generic chip icon.","rules.pattern_ph":"regex, e.g. plug|socket","rules.icon_ph":"mdi:power-socket-de","rules.add":"Add rule","rules.reset":"Reset to defaults","rules.test_ph":"Try a device name…","rules.invalid":"invalid regex","rules.saved":"Icon rules saved","btn.up":"Up","btn.down":"Down","tap.info":"Device card","tap.more_info":"HA more-info dialog","tap.toggle":"Toggle (lights/switches)","marker.tap_label":"Tap action for this device","tap.toggle_note":"Toggle never applies to locks and alarms; hold the icon to open the info card.","import.title":"Create spaces from HA floors","import.hint":"Your Home Assistant already knows these floors. Pick the ones to turn into plan spaces — you will upload a floor-plan image for each one next. Rooms are then outlined by hand on the plan.","import.start":"Create {n} space(s)","import.manual":"Start from scratch","import.progress":"Floor {i} of {n}","import.done":"Spaces created. Outline the rooms: click grid dots and close the contour.","btn.skip":"Skip","space.scale_label":"Scale (grid cell size)","space.scale_unit":"cm per cell","space.display_section":"Display","space.show_borders":"Always show room borders","space.show_names":"Show room names (drag to move)","space.room_color":"Border & name color","space.opacity":"Opacity","space.fill_label":"Room fill","fill.none":"None","fill.lqi":"Zigbee signal","fill.light":"Lights","space.source_file":"I have a floor-plan image","space.source_draw":"No image — I'll outline rooms by hand","space.orientation":"Canvas","orient.landscape":"Landscape","orient.portrait":"Portrait","orient.square":"Square","fill.temp":"Temperature","space.temp_min":"Comfort from","space.temp_max":"to","tip.temp_avg":"average temperature:","space_card.button":"Open the space plan","space_card.not_found":"Space “{id}” not found","space_card.loading":"Loading…","editor.space":"Space","editor.show_button":"Show button","editor.button_label":"Button label","editor.button_target":"Target dashboard path","editor.aspect_ratio":"Aspect ratio (e.g. 16:9 or auto)","marker.sub_entity":"entity","title.general_settings":"General settings","gs.title":"General settings","gs.hint":"Fill colors apply to every space; each color has its own opacity. Which fill mode a space uses is set in that space's dialog.","gs.light_group":"Fill: lights","gs.light_on":"Lights on","gs.light_off":"All lights off","gs.temp_group":"Fill: temperature","gs.temp_cold":"Cold","gs.temp_ok":"Comfortable","gs.temp_hot":"Hot","gs.lqi_group":"Fill: zigbee signal","gs.lqi_low":"Weak signal","gs.lqi_high":"Strong signal","gs.reset":"Reset to defaults","gs.saved":"General settings saved","space.show_lqi":"Show zigbee signal (LQI) next to devices","gs.light_none":"No light sources","mode.plan":"Plan editor","mode.devices":"Device editor","display.value":"Value instead of an icon","marker.subarea":"no area, manual","device.new":"New device — open its editor to dismiss","opening.unlock_action":"Unlock","opening.lock_action":"Lock","opening.lock_pending":"Working…","title.close_editor":"Close editor (back to view)","devbar.add":"Add","devbar.show_all":"Show hidden","devbar.rules":"Icon rules","space.roomcard_section":"Room card shows:","space.label_temp":"Temperature","space.label_hum":"Humidity","space.label_lqi":"Average Zigbee signal","space.label_light":"Lights on/off","roomcard.light_on":"On","roomcard.light_off":"Off","roomcard.light_partial":"{on} of {total}","toast.split_pick_inside":"Intermediate cut points must be inside the room","mode.decor":"Background editor","decor.select":"Select","decor.line":"Line","decor.rect":"Rectangle","decor.ellipse":"Oval","decor.text":"Text","decor.erase":"Erase","decor.color":"Color","decor.width":"Line width","decor.w_thin":"Thin","decor.w_mid":"Medium","decor.w_thick":"Thick","decor.fill":"Fill","decor.text_title":"Text label","decor.text_label":"Text","decor.text_hint":"A new line here is a new line on the plan; the block is centred. Drag a corner to resize it, the handle above it to turn it.","decor.text_hint_live":"{} is where the value lands. Without it the value is added at the end. A new line here is a new line on the plan.","decor.live_group":"Live value","decor.live_hint":"The label may show one entity's value — as Home Assistant reports it, with no rounding. A dead entity shows a dash.","decor.live_entity":"Entity","decor.live_entity_ph":"none — a plain label","decor.live_attr":"Attribute","decor.live_attr_ph":"the state","decor.live_unit":"Unit","decor.live_preview":"Preview","decor.backdrop":"Backdrop image","decor.backdrop_hint":"Drag the picture to move it, pull a corner to resize it. Shift — off the grid.","decor.backdrop_reset":"Reset the picture","decor.backdrop_reset_done":"The picture is back at its original place and size","marker.icon_auto":"Auto: {icon} (by icon rules; pick one to override)","mode.plan_tip":"Plan editor — the geometry of the home: draw and split/merge rooms, bind them to HA areas, place doors and windows, move room cards, set the scale","mode.devices_tip":"Device editor — everything about icons: drag to position, click to edit binding/icon/display, add virtual devices, icon rules","mode.decor_tip":"Background editor — purely visual decor under the plan: lines, rectangles, ovals and text labels that never react to clicks","fill.glow":"Light sources (dark house, glowing lamps)","gs.glow_group":"Light-sources fill","gs.glow_base":"House darkness","gs.glow_light":"Default light color / intensity","gs.glow_radius":"Glow radius","gs.unit_m":"m","gs.unit_ft":"ft","marker.controls_label":"Controls light sources","marker.controls_hint":"With tap action “Toggle”, a click flips all bound lights at once (any on → all off). The icon mirrors their state.","marker.controls_filter":"Search lights and switches…","info.controls":"Controls","marker.glow_radius_label":"Glow radius (light-sources fill)","marker.glow_radius_hint":"empty = default from general settings","markup.openwall":"Open boundary","title.markup_openwall":"Open boundary — click a wall shared by two rooms to make it virtual: light flows through, the line turns dashed. Click again to close it.","toast.openwall_pick":"Click a wall shared by two rooms","toast.openwall_opened":"Boundary “{a}” ↔ “{b}” is now open","toast.openwall_closed":"Boundary “{a}” ↔ “{b}” is closed again","marker.from_ha_option":"Pick from the HA list","marker.show_entities":"Show entities","marker.show_entities_tip":"Adds not only devices to the list, but all their entities too","marker.pick_ph":"Choose a device…","room.open_area":"Open the HA area","kiosk.title":"This screen's sizes","kiosk.hint":"Stored on this device only — every wall tablet or TV can have its own comfortable sizes.","kiosk.icon_scale":"Device icon size","kiosk.font_scale":"Room card text size","editor.kiosk":"Wall device (kiosk) mode","editor.cycle":"Auto-switch spaces every N seconds (kiosk, 0 = off)","room.settings_title":"Room settings","room.settings_section":"Room settings (override the space)","room.fill_label":"Fill in THIS room","fill.inherit":"As the space","room.temp_src_label":"Temperature source","room.hum_src_label":"Humidity source","room.src_average":"Average over the room's sensors (default)","room.src_pick":"A specific HA device or entity","room.src_ph":"Choose a source…","toast.room_updated":"Room updated","space.card_font":"Room-card font size (whole space)","room.sizes_section":"Font sizes","room.name_scale":"Room name size","room.label_scale":"Metrics size","preview.room_name":"Living room","toast.cfg_reload_failed":"Could not reload the plan from the server: {err}","room.settings_short":"Room settings","room.unnamed":"Unnamed room","marker.use_climate_temp":"Use the device's temperature sensor","marker.use_climate_temp_tip":"Air conditioners and thermostats know the room temperature (current_temperature). Shows it as a badge next to the icon and counts it in the room average — like a regular thermometer.","marker.is_light":"This device is a light source","marker.is_light_tip":"Makes the icon glow in the “Light sources” fill even without a light entity — for a smart switch driving ordinary fixtures. The glow follows the switch (or the lights bound above).","confirm.unlock":"Unlock “{name}”?","toast.files_migrate_failed":"Attachments could not be moved to the new binding, links keep pointing at the old files: {err}","space.pick_saved":"Already uploaded","space.pick_saved_hint":"Plans stored on the server, including ones you detached earlier","space.no_saved":"No plans stored on the server yet.","space.loading":"Loading…","space.used_by":"in use: {list}","space.in_use":"A space still uses this plan — detach it first","btn.use":"Use","confirm.delete_plan":'Delete the plan file "{name}" from the server? This cannot be undone.',"toast.plans_list_failed":"Could not list the stored plans: {err}","toast.plan_delete_failed":"Could not delete the plan: {err}","marker.hide":"Hide device from plan","marker.hide_tip":'The device is not drawn on the plan but still counts toward the room signal. To see it: the "Show hidden" button in the device editor.',"tap.run":"Run automation/script/scene","tap.cover":"Open/close (curtains/blinds)","marker.run_target_label":"What to run","marker.run_search_ph":"Search: automation, script or scene…","marker.run_target_gone":"Target {id} not found — pick again","marker.tap_confirm":"Ask for confirmation","marker.tap_confirm_tip":"Show a confirmation dialog before acting — a guard against accidental taps.","run.automation":"automation","run.script":"script","run.scene":"scene","confirm.tap_run":'Run "{name}"?',"confirm.tap_toggle":'Toggle "{name}"?',"confirm.tap_cover":'Open/close "{name}"?',"toast.run_started":"Started: {name}","toast.run_target_missing":"Run target not found — check the device settings","toast.run_target_required":"Pick an automation, script or scene","btn.run":"Run","vac.section":"Robot vacuum: live position","vac.status_found":"Position source found: {name}","vac.status_none":"The integration reports no coordinates — the robot will only be shown at its base","vac.autocal":"Set up automatically","vac.live":"Live position on the plan","vac.trail":"Show the robot's path","vac.cal_maps":"Calibrated maps: {maps}","vac.autocal_no_rooms":"The integration reports no room list — open “Fit manually”","vac.autocal_no_match":"Room names did not match (need ≥3 in common) — open “Fit manually”","vac.autocal_res_warn":"Matched {rooms} rooms but the fit is rough — verify and refine via “Fit manually” if needed","vac.autocal_done":"Done: bound via {rooms} rooms. Start a cleanup and check","vac.cal_need_pos":"The robot is not reporting coordinates — start a cleanup and pause it","vac.cal_done":"Calibration saved. Start a cleanup and check","vac.cal_cancelled":"Calibration cancelled","vac.fit":"Fit manually","vac.fit_hint":"Drag the robot map into place, stretch by the corners","vac.fit_rotate":"Rotate 90°","vac.fit_mirror":"Mirror","vac.trail_never":"Never","vac.trail_cleaning":"While cleaning","vac.trail_always":"Always","gs.bg_group":"Stage background","gs.bg_color":"Background around the plan","gs.bg_default":"Theme default","gs.bg_theme":"theme default","gs.bg_mode":"Plan background","gs.bg_static":"Static color","gs.bg_daynight":"Follows the sun (day/night)","gs.bg_daynight_hint":"The stage follows the sun: neutral day, warm golden hour, deep night. Needs the compass below.","gs.sun_group":"Sun","gs.sun_missing":"The sun.sun entity was not found — the sun features stay off.","gs.north":"North on the plan","gs.north_ph":"not set","gs.north_hint":"Point the arrow at north (1° steps, 15° with Shift) or type the degrees — until then the sun features stay off.","gs.north_clear":"Clear","gs.north_letter":"N","gs.sun_rays":"Sunlight through windows","gs.weather":"Weather entity","gs.weather_ph":"weather.home (optional)","gs.about_group":"About","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · docs & issues","gs.about_telegram":"Telegram chat","space.bg_color":"Background around the plan","space.bg_inherit":"Inherit general","space.bg_inherited":"inherits general settings","space.bg_mode":"Plan background","space.north":"North on the plan (override)","space.north_inherited":"inherited: {v}","space.sun_rays":"Sunlight through windows","space.sun_inherit":"Inherit general","space.sun_on":"On","space.sun_off":"Off","canvas.far_objects":"{n} object(s) far from the plan","canvas.show_far":"Show","canvas.home_tip":"The plan is over there — click to fit it","gs.grid_group":"Grid","gs.grid_hint":"Everything you draw or drag now lands on the grid. Hold Shift to place something between the nodes on purpose.","gs.align_all":"Align everything to the grid","gs.align_title":"Align everything to the grid","gs.align_none":"Everything is already on the grid — nothing to move.","gs.align_count":"{n} of {total} elements will move, by at most {cm} cm.","gs.align_where":"The largest shift is in “{s}”.","gs.align_turned":"Openings whose angle is corrected: {n}.","gs.align_warn":"This rewrites the plan and the device positions in one go. There is no undo: the only way back is to move things by hand. If some elements are deliberately between the nodes, cancel.","gs.align_run":"Align","gs.align_done":"Aligned to the grid: {n} elements moved"};const no={en:oo,ru:{"card.title":"План дома","count.devices":"{n} устр.","empty.no_spaces":"Пространств пока нет.","empty.add_first":"Добавьте первое пространство и загрузите план этажа.","empty.install":"Установите интеграцию House Plan и добавьте запись в «Устройства и службы».","btn.add_space":"Добавить пространство","btn.cancel":"Отмена","btn.save":"Сохранить","btn.close":"Закрыть","btn.delete":"Удалить","btn.remove":"Убрать","btn.edit":"Редактировать","btn.open_in_ha":"Открыть в HA","btn.reset":"Сброс","btn.attach":"Прикрепить…","btn.upload":"Загрузить…","btn.replace":"Заменить…","btn.no_area":"Без зоны","title.zoom_in":"Приблизить","title.zoom_out":"Отдалить","title.zoom_fit":"Вписать всё","title.add_device":"Добавить устройство на план","title.show_all":"Показать скрытые устройства (полупрозрачными, только в этой вкладке)","title.markup":"Разметка комнат: сетка, линии, контуры","title.configure_space":"Настроить пространство","title.add_space":"Добавить пространство","title.markup_add":"Добавить комнату: соединяйте точки сетки линиями до замкнутого контура","title.markup_merge":"Объединить комнаты: клик по одной, затем по соседней с общей стеной","title.markup_split":"Разделить комнату: клик по комнате, затем две точки на её стенах","title.markup_delroom":"Удалить комнату: клик внутри комнаты","title.no_area_room":"Декоративная комната без привязки к зоне (например, холл)","title.choose_area":"Выберите зону Home Assistant","title.need_plan":"Загрузите подложку (план этажа)","markup.add":"Добавить","markup.merge":"Объединить","markup.split":"Разделить","markup.resize":"Размер","title.markup_resize":"Изменение размера комнат: тяните ручку стены; клик по комнате — угловая рамка масштаба","markup.hint_resize":"тяните ручку стены · клик по комнате — угловая рамка · Esc отменяет перетаскивание · Ctrl+Z — отмена шага","markup.opening":"Проём","title.markup_opening":"Двери и окна: клик по стене — добавить, клик по проёму — редактировать","opening.new":"Новый проём","opening.edit":"Дверь / окно","opening.door":"Дверь","opening.window":"Окно","opening.type_label":"Тип","opening.length_label":"Длина, см","opening.contact_label":"Датчик открытия","opening.lock_label":"Замок","opening.none":"— нет —","opening.invert":"Инвертировать открыто/закрыто","opening.flip_h":"Петли с другой стороны","opening.flip_v":"Открывается в другую сторону","opening.open":"Открыто","opening.closed":"Закрыто","opening.locked":"Заперто","opening.unlocked":"Не заперто","opening.state_unknown":"недоступно","opening.no_entities":"Датчики не привязаны — статичный символ на плане.","toast.opening_no_wall":"Кликните рядом со стеной комнаты — проёмы ставятся на стены","markup.delete":"Удалить","markup.hint_points":"точек: {n} · Esc/Ctrl+Z — убрать точку · замкните контур кликом по первой","markup.hint_start":"кликните точку сетки, чтобы начать контур","tip.lqi":"средний сигнал zigbee:","info.device_header":"Устройство на плане","info.model":"Модель","info.state":"Состояние","info.link":"Ссылка","info.manuals":"Инструкции","info.none":"Нет дополнительной информации","marker.new_device":"Новое устройство","marker.name_label":"Имя (отображается на плане)","marker.name_ph":"Название","marker.binding_label":"Привязка к устройству HA","marker.virtual_option":"Виртуальное устройство (без привязки)","marker.search_ph":"Поиск устройства / группы…","marker.nothing_found":"ничего не найдено","marker.room_label":"Комната","marker.room_override":" (переопределить размещение)","marker.room_choose":"— выберите комнату —","marker.room_auto":"— по зоне устройства (авто) —","marker.icon_label":"Иконка","marker.icon_ph":"mdi:… (пусто = авто)","marker.display_label":"Отображение","display.badge":"Значок","display.ripple":"Только пульсация","display.icon_ripple":"Значок + пульсация","marker.ripple_size":"Размер пульсации","marker.size_label":"Размер / поворот значка","marker.angle_label":"Поворот","marker.model_label":"Модель","marker.model_ph":"напр. Aqara T&H","marker.link_label":"Ссылка","marker.desc_label":"Описание","marker.desc_ph":"Заметки, характеристики…","marker.manuals_label":"Инструкции (PDF и т.п.)","marker.sub_device":"устройство","marker.sub_z2m_group":" · Z2M-группа","marker.sub_group":"группа","marker.sub_helper":"хелпер","space.new":"Новое пространство","space.header":"Пространство","space.title_label":"Название","space.title_ph":"Например: Гараж","space.plan_label":"Подложка (план)","space.no_plan":"нет подложки","space.plan_alt":"план","room.new":"Новая комната","room.name_label":"Отображаемое имя","room.name_ph":"Например: Терраса","room.area_label":"Зона Home Assistant (свободные)","room.no_area_option":"— без зоны —","room.default_name":"Комната","device.unnamed":"без имени","device.light_group":"группа света","device.fallback":"устройство","device.virtual":"виртуальное устройство","confirm.delete_room":"Удалить комнату «{name}»?","confirm.remove_marker":"Убрать «{name}» с плана?","confirm.delete_space":"Удалить пространство «{title}» со всеми комнатами и разметкой?","toast.pos_save_failed":"Не удалось сохранить позицию: {err}","toast.no_entity":"У устройства нет подходящей сущности","toast.markup_needs_server":"Разметка доступна после переноса конфига на сервер","toast.conflict":"Конфиг изменён в другом окне — данные обновлены, повторите последнее действие","toast.cfg_save_failed":"Не удалось сохранить конфиг: {err}","toast.room_overlap":"Контур накладывается на комнату «{name}» — комнаты не должны накладываться","toast.merge_not_adjacent":"Объединять можно только комнаты с общей стеной","toast.rooms_merged":"Комнаты объединены в «{name}»","toast.split_pick_wall":"Начните разрез на стене комнаты","toast.split_bad_cut":"Разрез — от стены до стены внутри комнаты, без пересечения стен и самого себя","merge.header":"Объединение комнат","merge.hint":"У объединённой комнаты одно имя и одна зона. Вторая зона освобождается — её устройства уйдут с плана, пока их не заберёт другая комната.","merge.keep":"Оставить","merge.no_area":"без зоны","room.split_header":"Новая комната после разделения","toast.room_saved":"Комната сохранена ({n}). Устройств добавлено: {added}. Обведите следующую или выйдите из разметки.","toast.room_saved_no_area":"Комната сохранена ({n}, без зоны). Обведите следующую или выйдите из разметки.","toast.marker_needs_server":"Редактирование устройств доступно после переноса конфига на сервер","toast.virtual_name_required":"Укажите имя виртуального устройства","toast.marker_saved":"Устройство сохранено","toast.marker_removed":"Устройство убрано с плана","toast.integration_missing":"Интеграция House Plan не установлена — управление недоступно","toast.plan_formats":"Поддерживаются SVG, PNG, JPG, WebP","toast.plan_required":"Загрузите подложку — план этажа обязателен","toast.space_added_onboard":"Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.","toast.space_added":"Пространство добавлено","toast.space_saved":"Пространство сохранено","toast.space_deleted":"Пространство удалено","toast.delete_failed":"Ошибка удаления: {err}","toast.error":"Ошибка: {err}","toast.file_failed":"Файл «{name}» не загружен: {err}","toast.files_attached":"Прикреплено файлов: {n}","err.unknown":"неизвестная ошибка","err.code":"код {code}","err.too_large":"файл больше {mb} МБ","err.bad_ext":"недопустимый тип (нужен PDF/изображение)","err.unauthorized":"нужны права администратора","editor.title":"Заголовок","editor.default_floor":"Пространство по умолчанию","editor.icon_size":"Размер иконок, % ширины плана","editor.show_temperature":"Показывать температуру","editor.live_states":"Живые состояния (вкл/выкл, открыто…)","editor.show_signal":"Показывать сигнал zigbee (LQI)","editor.language":"Язык интерфейса","editor.lang_auto":"Авто (профиль HA)","editor.lang_en":"English","editor.lang_ru":"Русский","title.icon_rules":"Правила иконок: какая MDI-иконка достаётся устройству по имени","rules.title":"Правила иконок","rules.hint":"Правила проверяются сверху вниз по строке «имя устройства + модель» (regex без учёта регистра); срабатывает первое совпадение. Если ничего не подошло — решает device class сущности, затем — иконка-заглушка.","rules.pattern_ph":"regex, напр. розетк|plug","rules.icon_ph":"mdi:power-socket-de","rules.add":"Добавить правило","rules.reset":"Сбросить к умолчаниям","rules.test_ph":"Проверьте имя устройства…","rules.invalid":"некорректный regex","rules.saved":"Правила иконок сохранены","btn.up":"Вверх","btn.down":"Вниз","tap.info":"Карточка устройства","tap.more_info":"Диалог HA (more-info)","tap.toggle":"Переключить (свет/розетки)","marker.tap_label":"Действие по нажатию для этого устройства","tap.toggle_note":"Toggle никогда не применяется к замкам и сигнализациям; долгое нажатие всегда открывает инфо-карточку.","import.title":"Создать пространства из этажей HA","import.hint":"Home Assistant уже знает эти этажи. Отметьте, какие превратить в пространства плана — далее для каждого попросим картинку плана. Комнаты затем обводятся вручную по плану.","import.start":"Создать: {n}","import.manual":"Начать с нуля","import.progress":"Этаж {i} из {n}","import.done":"Пространства созданы. Обведите комнаты: кликайте по точкам сетки и замкните контур.","btn.skip":"Пропустить","space.scale_label":"Масштаб (размер клетки сетки)","space.scale_unit":"см на клетку","space.display_section":"Отображение","space.show_borders":"Всегда отображать границы комнат","space.show_names":"Отображать названия комнат (перетаскиваются)","space.room_color":"Цвет границ и названий","space.opacity":"Прозрачность","space.fill_label":"Заливка комнат","fill.none":"Нет","fill.lqi":"По силе зигби-сигнала","fill.light":"По освещению","space.source_file":"У меня есть картинка плана","space.source_draw":"Нет подложки — нарисую комнаты вручную","space.orientation":"Холст","orient.landscape":"Альбомный","orient.portrait":"Портретный","orient.square":"Квадрат","fill.temp":"По температуре","space.temp_min":"Комфорт от","space.temp_max":"до","tip.temp_avg":"средняя температура:","space_card.button":"Перейти к пространству","space_card.not_found":"Пространство «{id}» не найдено","space_card.loading":"Загрузка…","editor.space":"Пространство","editor.show_button":"Показывать кнопку","editor.button_label":"Текст кнопки","editor.button_target":"Путь дашборда (куда вести)","editor.aspect_ratio":"Соотношение сторон (напр. 16:9 или auto)","marker.sub_entity":"сущность","title.general_settings":"Общие настройки","gs.title":"Общие настройки","gs.hint":"Цвета заливок действуют на все пространства; у каждого цвета своя прозрачность. Какой режим заливки использует пространство — задаётся в его диалоге.","gs.light_group":"Заливка: освещение","gs.light_on":"Свет включён","gs.light_off":"Весь свет выключен","gs.temp_group":"Заливка: температура","gs.temp_cold":"Холодно","gs.temp_ok":"Комфорт","gs.temp_hot":"Жарко","gs.lqi_group":"Заливка: зигби-сигнал","gs.lqi_low":"Слабый сигнал","gs.lqi_high":"Сильный сигнал","gs.reset":"Сбросить к умолчаниям","gs.saved":"Общие настройки сохранены","space.show_lqi":"Показывать зигби-сигнал (LQI) у устройств","gs.light_none":"Нет источников света","mode.plan":"Редактор плана","mode.devices":"Редактор устройств","display.value":"Значение вместо иконки","marker.subarea":"без зоны, вручную","device.new":"Новое устройство — откройте его редактор, чтобы снять отметку","opening.unlock_action":"Открыть замок","opening.lock_action":"Закрыть замок","opening.lock_pending":"Выполняется…","title.close_editor":"Закрыть редактор (вернуться к просмотру)","devbar.add":"Добавить","devbar.show_all":"Показать скрытые","devbar.rules":"Правила иконок","space.roomcard_section":"В карточке комнаты:","space.label_temp":"Температура","space.label_hum":"Влажность","space.label_lqi":"Средний Zigbee-сигнал","space.label_light":"Свет вкл/выкл","roomcard.light_on":"Вкл","roomcard.light_off":"Выкл","roomcard.light_partial":"{on} из {total}","toast.split_pick_inside":"Промежуточные точки разреза — внутри комнаты","mode.decor":"Редактор подложки","decor.select":"Выбрать","decor.line":"Линия","decor.rect":"Прямоугольник","decor.ellipse":"Овал","decor.text":"Надпись","decor.erase":"Стереть","decor.color":"Цвет","decor.width":"Толщина линии","decor.w_thin":"Тонкая","decor.w_mid":"Средняя","decor.w_thick":"Толстая","decor.fill":"Залить","decor.text_title":"Надпись","decor.text_label":"Текст","decor.text_hint":"Перевод строки здесь — перевод строки на плане; блок выравнивается по центру. Тяните угол — меняет размер, ручка сверху — поворот.","decor.text_hint_live":"{} — место, куда встанет значение. Без него значение добавится в конец. Перевод строки здесь — перевод строки на плане.","decor.live_group":"Живое значение","decor.live_hint":"Надпись может показывать значение одной сущности — так, как его отдаёт Home Assistant, без округления. Мёртвая сущность — прочерк.","decor.live_entity":"Сущность","decor.live_entity_ph":"нет — обычная надпись","decor.live_attr":"Атрибут","decor.live_attr_ph":"состояние","decor.live_unit":"Единица","decor.live_preview":"Предпросмотр","decor.backdrop":"Картинка-подложка","decor.backdrop_hint":"Тяните картинку — двигается, тяните угол — меняет размер. Shift — мимо сетки.","decor.backdrop_reset":"Вернуть картинку","decor.backdrop_reset_done":"Картинка вернулась на своё место и в свой размер","marker.icon_auto":"Авто: {icon} (по правилам иконок; выберите свою, чтобы заменить)","mode.plan_tip":"Редактор плана — геометрия дома: рисование и объединение/разделение комнат, привязка к зонам HA, двери и окна, карточки комнат, масштаб","mode.devices_tip":"Редактор устройств — всё про значки: перетаскивание, клик — настройка привязки/иконки/отображения, виртуальные устройства, правила иконок","mode.decor_tip":"Редактор подложки — чисто визуальный декор под планом: линии, прямоугольники, овалы и надписи, не реагирующие на клики","fill.glow":"Свет по источникам (тёмный дом, пятна света)","gs.glow_group":"Заливка «Свет по источникам»","gs.glow_base":"Темнота дома","gs.glow_light":"Цвет света по умолчанию / интенсивность","gs.glow_radius":"Радиус свечения","gs.unit_m":"м","gs.unit_ft":"фут","marker.controls_label":"Управляет источниками света","marker.controls_hint":"При действии «Переключить» клик разом переключает все привязанные источники (горит хоть один → выключить все). Значок отражает их состояние.","marker.controls_filter":"Поиск ламп и выключателей…","info.controls":"Управляет","marker.glow_radius_label":"Радиус свечения (заливка «Свет по источникам»)","marker.glow_radius_hint":"пусто = по умолчанию из общих настроек","markup.openwall":"Открытая граница","title.markup_openwall":"Открытая граница — клик по общей стене двух комнат делает её условной: свет проходит насквозь, линия становится пунктирной. Повторный клик закрывает.","toast.openwall_pick":"Кликните по стене, разделяющей две комнаты","toast.openwall_opened":"Граница «{a}» ↔ «{b}» теперь открыта","toast.openwall_closed":"Граница «{a}» ↔ «{b}» снова закрыта","marker.from_ha_option":"Выбрать из списка HA","marker.show_entities":"Отображать сущности","marker.show_entities_tip":"Добавляет в список не только устройства, но и все их сущности","marker.pick_ph":"Выберите устройство…","room.open_area":"Открыть зону в HA","kiosk.title":"Размеры на этом экране","kiosk.hint":"Хранится только на этом устройстве — у каждого настенного планшета или ТВ свои удобные размеры.","kiosk.icon_scale":"Размер значков устройств","kiosk.font_scale":"Размер текста карточек комнат","editor.kiosk":"Режим настенного устройства (киоск)","editor.cycle":"Автосмена пространств каждые N секунд (киоск, 0 = выкл)","room.settings_title":"Настройки комнаты","room.settings_section":"Настройки комнаты (переопределяют пространство)","room.fill_label":"Заливка в ЭТОЙ комнате","fill.inherit":"Как у пространства","room.temp_src_label":"Источник температуры","room.hum_src_label":"Источник влажности","room.src_average":"Средняя по датчикам комнаты (по умолчанию)","room.src_pick":"Конкретное устройство или сущность HA","room.src_ph":"Выберите источник…","toast.room_updated":"Комната обновлена","space.card_font":"Размер шрифта карточек комнат (всё пространство)","room.sizes_section":"Размеры шрифтов","room.name_scale":"Размер названия","room.label_scale":"Размер подписей","preview.room_name":"Гостиная","toast.cfg_reload_failed":"Не удалось перечитать план с сервера: {err}","room.settings_short":"Настройки комнаты","room.unnamed":"Комната без имени","marker.use_climate_temp":"Использовать датчик температуры устройства","marker.use_climate_temp_tip":"Кондиционеры и термостаты знают температуру комнаты (current_temperature). Показывает её плашкой у значка и учитывает в средней температуре комнаты — как обычный термометр.","marker.is_light":"Это устройство — источник света","marker.is_light_tip":"Даёт ореол в заливке «Свет по источникам» даже без light-сущности — для умного выключателя с обычными светильниками. Ореол следует за выключателем (или за привязанными выше лампами).","confirm.unlock":"Открыть замок «{name}»?","toast.files_migrate_failed":"Не удалось перенести вложения к новой привязке, ссылки остались на старые файлы: {err}","space.pick_saved":"Уже загруженные","space.pick_saved_hint":"Планы, сохранённые на сервере, включая отцеплённые ранее","space.no_saved":"На сервере пока нет сохранённых планов.","space.loading":"Загрузка…","space.used_by":"используется: {list}","space.in_use":"План используется пространством — сначала отцепите его","btn.use":"Выбрать","confirm.delete_plan":"Удалить файл плана «{name}» с сервера? Действие необратимо.","toast.plans_list_failed":"Не удалось получить список планов: {err}","toast.plan_delete_failed":"Не удалось удалить план: {err}","marker.hide":"Скрыть устройство с плана","marker.hide_tip":"Устройство не отображается на плане, но участвует в расчёте сигнала комнаты. Показать: кнопка «Показать скрытые» в редакторе устройств.","tap.run":"Запустить автоматизацию/скрипт/сцену","tap.cover":"Открыть/закрыть (шторы/жалюзи)","marker.run_target_label":"Что запускать","marker.run_search_ph":"Поиск: автоматизация, скрипт или сцена…","marker.run_target_gone":"Цель {id} не найдена — выберите заново","marker.tap_confirm":"Спрашивать подтверждение","marker.tap_confirm_tip":"Перед выполнением показать диалог подтверждения — защита от случайных нажатий.","run.automation":"автоматизация","run.script":"скрипт","run.scene":"сцена","confirm.tap_run":"Запустить «{name}»?","confirm.tap_toggle":"Переключить «{name}»?","confirm.tap_cover":"Открыть/закрыть «{name}»?","toast.run_started":"Запущено: {name}","toast.run_target_missing":"Цель запуска не найдена — проверьте настройки устройства","toast.run_target_required":"Выберите автоматизацию, скрипт или сцену","btn.run":"Выполнить","vac.section":"Робот-пылесос: живая позиция","vac.status_found":"Источник координат найден: {name}","vac.status_none":"Интеграция не отдаёт координаты — робот будет показан только на базе","vac.autocal":"Настроить автоматически","vac.live":"Живая позиция на плане","vac.trail":"Показывать путь робота","vac.cal_maps":"Откалиброваны карты: {maps}","vac.autocal_no_rooms":"Интеграция не отдаёт список комнат — откройте «Подогнать вручную»","vac.autocal_no_match":"Не совпали имена комнат (нужно ≥3 общих) — откройте «Подогнать вручную»","vac.autocal_res_warn":"Совпало комнат: {rooms}, но привязка грубовата — проверьте и при необходимости откройте «Подогнать вручную»","vac.autocal_done":"Готово: привязка по {rooms} комнатам. Запустите уборку и проверьте","vac.cal_need_pos":"Робот сейчас не отдаёт координаты — запустите уборку и поставьте на паузу","vac.cal_done":"Калибровка сохранена. Запустите уборку и проверьте","vac.cal_cancelled":"Калибровка отменена","vac.fit":"Подогнать вручную","vac.fit_hint":"Перетащите карту робота на место, растяните за уголки","vac.fit_rotate":"Повернуть 90°","vac.fit_mirror":"Отразить","vac.trail_never":"Не показывать никогда","vac.trail_cleaning":"Во время уборки","vac.trail_always":"Показывать всегда","gs.bg_group":"Фон сцены","gs.bg_color":"Цвет фона вокруг плана","gs.bg_default":"Как в теме","gs.bg_theme":"по умолчанию — из темы","gs.bg_mode":"Фон плана","gs.bg_static":"Статичный цвет","gs.bg_daynight":"Следует за солнцем (день/ночь)","gs.bg_daynight_hint":"Фон следует за солнцем: нейтральный день, тёплый золотой час, глубокая ночь. Нужен компас ниже.","gs.sun_group":"Солнце","gs.sun_missing":"Сущность sun.sun не найдена — солнечные функции выключены.","gs.north":"Север на плане","gs.north_ph":"не задан","gs.north_hint":"Направьте стрелку на север (шаг 1°, с Shift 15°) или введите градусы — до этого солнечные функции молчат.","gs.north_clear":"Сбросить","gs.north_letter":"С","gs.sun_rays":"Солнце в окнах","gs.weather":"Сущность погоды","gs.weather_ph":"weather.home (необязательно)","gs.about_group":"О карточке","gs.about_version":"Houseplan Card v{v}","gs.about_github":"GitHub · документация и issues","gs.about_telegram":"Чат в Telegram","space.bg_color":"Цвет фона вокруг плана","space.bg_inherit":"Наследовать общий","space.bg_inherited":"наследуется из общих настроек","space.bg_mode":"Фон плана","space.north":"Север на плане (переопределение)","space.north_inherited":"наследуется: {v}","space.sun_rays":"Солнце в окнах","space.sun_inherit":"Наследовать общий","space.sun_on":"Вкл","space.sun_off":"Выкл","canvas.far_objects":"Объектов далеко от плана: {n}","canvas.show_far":"Показать","canvas.home_tip":"План там — нажмите, чтобы вписать","gs.grid_group":"Сетка","gs.grid_hint":"Всё, что вы рисуете и перетаскиваете, ложится строго на сетку. Shift — временно поставить элемент между узлами.","gs.align_all":"Выровнять всё по сетке","gs.align_title":"Выровнять всё по сетке","gs.align_none":"Всё уже на сетке — двигать нечего.","gs.align_count":"Сдвинется элементов: {n} из {total}, максимум на {cm} см.","gs.align_where":"Наибольший сдвиг — в пространстве «{s}».","gs.align_turned":"Проёмов с исправлением угла: {n}.","gs.align_warn":"Действие разом перезапишет план и позиции устройств. Отмены нет: вернуть можно только руками. Если какие-то элементы стоят между узлами намеренно — отмените.","gs.align_run":"Выровнять","gs.align_done":"Выровнено по сетке: сдвинуто элементов — {n}"}};function ro(t,e){if(e&&e in no)return e;return(t?.locale?.language||t?.language||"en").toLowerCase().startsWith("ru")?"ru":"en"}function ao(t,e,i){return di(no[t][e]??oo[e]??e,i)}class lo extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return ro(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[],e=this._lang;return[{name:"title",selector:{text:{}}},t.length?{name:"default_floor",selector:{select:{mode:"dropdown",options:t}}}:{name:"default_floor",selector:{text:{}}},{name:"language",selector:{select:{mode:"dropdown",options:[{value:"",label:ao(e,"editor.lang_auto")},{value:"en",label:ao(e,"editor.lang_en")},{value:"ru",label:ao(e,"editor.lang_ru")}]}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}},{name:"kiosk",selector:{boolean:{}}},{name:"cycle",selector:{number:{min:0,max:3600,step:5,mode:"box"}}}]}render(){if(!this.hass||!this._config)return V;this._loadSpaces();const t=this._lang,e={title:ao(t,"editor.title"),default_floor:ao(t,"editor.default_floor"),language:ao(t,"editor.language"),icon_size:ao(t,"editor.icon_size"),show_temperature:ao(t,"editor.show_temperature"),live_states:ao(t,"editor.live_states"),show_signal:ao(t,"editor.show_signal"),kiosk:ao(t,"editor.kiosk"),cycle:ao(t,"editor.cycle")};return B`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}lo.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-card-editor")||customElements.define("houseplan-card-editor",lo);const co=n`
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
    .stage.noplan .hp-paper {
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
    /* Switching spaces by swipe or on the kiosk carousel: the plan flies out
       the way the finger went and the next one arrives from the other side. */
    @keyframes hp-slide-left {
      0%   { transform: translateX(22%); opacity: 0; }
      100% { transform: translateX(0);   opacity: 1; }
    }
    @keyframes hp-slide-right {
      0%   { transform: translateX(-22%); opacity: 0; }
      100% { transform: translateX(0);    opacity: 1; }
    }
    .zoomwrap.slide-left  { animation: hp-slide-left 0.26s cubic-bezier(0.22, 0.61, 0.36, 1); }
    .zoomwrap.slide-right { animation: hp-slide-right 0.26s cubic-bezier(0.22, 0.61, 0.36, 1); }
    @media (prefers-reduced-motion: reduce) {
      .zoomwrap.slide-left, .zoomwrap.slide-right { animation: none; }
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
    .stage.mode-decor.dtool-backdrop .decorlayer .dshape { pointer-events: none; }
    /* ONE exception (owner, 2026-08-04): under the TEXT tool an existing LABEL
       is a target again — pressing it opens its editor instead of starting a
       new label on top of the old one. Only labels: a line or a rectangle
       under the text tool stays inert, so the press reaches the stage and a
       new label is created there. */
    .stage.mode-decor.dtool-text .decorlayer .dshape.dtext {
      pointer-events: visiblePainted;
      cursor: text;
    }
    .decorlayer .dsel {
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .decorlayer .ddraft {
      opacity: 0.75;
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
    .bdframe .bdhandle {
      fill: var(--hp-accent);
      stroke: #fff;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: all;
      touch-action: none;
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
    /* the selected text block's frame — same chrome rules as the backdrop's:
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
    .dtframe .dtstem {
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.85;
    }
    .dtframe .dthandle {
      fill: var(--hp-accent);
      stroke: #fff;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: all;
      touch-action: none;
    }
    .dtframe .dt-nwse { cursor: nwse-resize; }
    .dtframe .dt-nesw { cursor: nesw-resize; }
    .dtframe .dtrot { cursor: grab; }
    .dtarea {
      resize: vertical;
      min-height: 3.4em;
      font: inherit;
      line-height: 1.35;
    }
    .dtpreview {
      padding: 6px 8px;
      border-radius: 8px;
      background: rgba(127, 127, 127, 0.12);
      text-align: center;
      white-space: pre-wrap;
      word-break: break-word;
      font-weight: 600;
    }
    .stage.mode-decor.dtool-line, .stage.mode-decor.dtool-rect,
    .stage.mode-decor.dtool-ellipse, .stage.mode-decor.dtool-text {
      cursor: crosshair;
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
    .stage.markup.tool-openwall { cursor: default; }
    .stage.markup.tool-openwall.wallhot { cursor: pointer; }
    .openwall {
      stroke: var(--ow-stroke, var(--hp-muted));
      stroke-width: 2.5;
      stroke-dasharray: 7 7;
      stroke-linecap: butt;
      pointer-events: none;
      opacity: 0.9;
    }
    /* rooms with open stretches: the polygon's own stroke is fully off
       (hover included) — the trimmed .room-outline path draws the walls */
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
    }
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
    /* Owner's rule (2026-08-01, вариант «б»): «движение = разовая вспышка
       в момент обнаружения; cool-down не пульсирует; присутствие =
       статичное кольцо пока обитаемо». The yellow FILL stays reserved for
       «включено» — both sense states keep the neutral badge. Both rings
       are declared BEFORE .dev.alarm on purpose: equal specificity on the
       shared ::after means the later alarm rule wins if a device ever
       carries both — red beats yellow. */
    /* MOTION tripped: a short ONE-SHOT flash — three beats of the yellow
       ring (3 × 1.1s), then silence, even while the entity still reports
       'on' (that tail is the sensor's cool-down, not motion). The
       iteration count is FINITE, and the card itself drops the class
       ~3.3s after the off→on transition (_senseTick/_stateClass in
       houseplan-card.ts); base opacity 0 keeps the ring invisible should
       the class outlive the animation by a frame. */
    .dev.senseflash::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 2px solid var(--hp-on);
      border-radius: 50%;
      opacity: 0;
      animation: hp-sense 1.1s ease-in-out 3;
      pointer-events: none;
    }
    /* HP-1543-02: a rapid off→on retrip must RESTART the flash. The card
       flips the .sf2 marker on every trip (_senseTick generation parity);
       hp-sense-b duplicates hp-sense exactly — switching the animation-name
       is what makes the browser abandon the old timeline and start a fresh
       one on the same pseudo-element (a same-name animation never restarts
       while the class stays on). */
    .dev.senseflash.sf2::after { animation-name: hp-sense-b; }
    /* OCCUPANCY/PRESENCE while 'on': a calm STATIC ring, no animation —
       «комната обитаема» is a state, not an event, so it must not blink.
       Brightness matches the reduced-motion variant of the flash. */
    .dev.sensehold::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 2px solid var(--hp-on);
      border-radius: 50%;
      opacity: 0.4;
      pointer-events: none;
    }
    /* COVER ON THE MOVE (owner 2026-08-03): «не жёлтая подложка, а лёгкая
       пульсация вокруг значка в стиле шайбы пылесоса». Same yellow as the
       sense rings, the vacuum puck's 2.2s period, and a moderate opacity so
       two curtains travelling at once never turn into a strobe. The plate
       itself stays neutral — yellow means «включено», nothing else. */
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
    .dev.covermove::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 2px solid var(--hp-on);
      border-radius: 50%;
      opacity: 0.45;
      animation: hp-covermove 2.2s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes hp-covermove {
      0% { transform: scale(0.92); opacity: 0.16; }
      50% { transform: scale(1.12); opacity: 0.5; }
      100% { transform: scale(0.92); opacity: 0.16; }
    }
    @keyframes hp-sense {
      0% { transform: scale(0.9); opacity: 0.5; }
      60% { transform: scale(1.12); opacity: 0.12; }
      100% { transform: scale(1.12); opacity: 0; }
    }
    /* identical twin of hp-sense — exists ONLY as the alternate animation
       identity for the retrip restart (HP-1543-02), keep the two in sync */
    @keyframes hp-sense-b {
      0% { transform: scale(0.9); opacity: 0.5; }
      60% { transform: scale(1.12); opacity: 0.12; }
      100% { transform: scale(1.12); opacity: 0; }
    }
    /* alarms pulse red over everything */
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
      /* the motion flash becomes a static ring for the same ~3.3s class
         window — consistent with alarm's treatment; sensehold is static
         by design already */
      .dev.senseflash::after,
      .dev.senseflash.sf2::after { animation: none; opacity: 0.4; } /* HP-1543-02: retrip re-arms the window, ring stays static */
      /* a travelling cover keeps a STATIC ring — the movement is still shown,
         it just stops breathing */
      .dev.covermove::after { animation: none; opacity: 0.4; }
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
    /* beat the generic .dialog .body .namein { width:100% } rule */
    .dialog .body .temprange .tempin { width: 56px; flex: none; padding: var(--sp-2) var(--sp-3); }
    .dialog .body .colorrow .tempin { width: 72px; flex: none; }
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
         so inside .dialog .body — a flex column taller than its 66vh cap —
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
    /* corner (scale-frame) handles keep the classic filled circle */
    .rszcorner {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: nwse-resize;
    }
    .rszcorner:hover { fill: var(--hp-accent); }
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
    .vacfitdot { fill: var(--hp-accent); pointer-events: none; }
    .vacfithandle {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: nwse-resize;
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
    .importprog {
      margin-left: auto;
      color: var(--hp-muted);
      font-size: var(--fs-s);
      font-weight: 400;
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
      border-radius: var(--rad-l);
      box-shadow: var(--shadow-3);
      width: min(360px, 92vw);
      overflow: hidden;
    }
    .dialog .hd {
      padding: var(--sp-5) var(--sp-6);
      font-weight: 600;
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .dialog .hd ha-icon {
      color: var(--hp-accent);
    }
    .dialog .body {
      padding: var(--sp-5) var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .dialog .body label {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-top: var(--sp-3);
    }
    .dialog .body .namein,
    .dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    .dialog .row {
      display: flex;
      justify-content: flex-end;
      gap: var(--sp-4);
      padding: var(--sp-5) var(--sp-6);
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
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
    }
    .editbar label,
    .editbar .hint {
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
  `,ho=1e3;function po(t,e){const i=Number(t),s=Number.isFinite(i)&&i>0?i:1,o=s>=1?e:e*s,n=s>=1?e/s:e;return{x:(e-o)/2,y:(e-n)/2,w:o,h:n}}const uo=.01;function _o(t,e=1e3){const i=po(t?.plan_aspect,e),s=Number(t?.plan_scale),o=Number.isFinite(s)&&s>0?Math.min(100,Math.max(uo,s)):1,n=Number(t?.plan_x),r=Number(t?.plan_y);return{x:i.x+(Number.isFinite(n)?So(n):0)*e,y:i.y+(Number.isFinite(r)?So(r):0)*e,w:i.w*o,h:i.h*o}}function go(t){if(null==t.x||null==t.y)return{x:t.x,y:t.y,w:t.w,h:t.h};const e=Number(t.w)||0,i=Number(t.h)||0;return{x:e<0?t.x+e:t.x,y:i<0?t.y+i:t.y,w:Math.abs(e),h:Math.abs(i)}}function mo(t){return t&&Array.isArray(t.spaces)?t.spaces.map(t=>{const e=ho,i=function(t){return Array.isArray(t)&&4===t.length&&t.every(t=>Number.isFinite(t))&&t[2]>1e-6&&t[3]>1e-6?t:[0,0,1,1]}(t.view_box);return{id:t.id,title:t.title,vb:[i[0]*ho,i[1]*e,i[2]*ho,i[3]*e],bg:t.plan_url?{href:Oi(t.plan_url),..._o(t,ho)}:null,rooms:(t.rooms||[]).map(t=>{const i={...t,...go(t)};return{id:i.id,name:i.name,area:i.area??null,open_to:i.open_to||void 0,settings:i.settings||void 0,x:null!=i.x?i.x*ho:void 0,y:null!=i.y?i.y*e:void 0,w:null!=i.w?i.w*ho:void 0,h:null!=i.h?i.h*e:void 0,poly:i.poly?i.poly.map(t=>[t[0]*ho,t[1]*e]):void 0}})}}):[]}const fo=5e3,vo=fo*ho,bo=240,yo=ho/bo,wo=1/bo;function $o(t){if(!Number.isFinite(t))return t;const e=Math.round(t*bo/ho)*ho/bo;return Math.abs(e-t)<=1e-9*yo?t:e}function xo(t){return{x:$o(t.x),y:$o(t.y)}}function ko(t){return Number.isFinite(t)?Math.min(vo,Math.max(-vo,t)):0}function So(t){return Number.isFinite(t)?Math.min(fo,Math.max(-fo,t)):0}const Mo=1/3,Do=200;function Co(t){let e=1/0,i=1/0,s=-1/0,o=-1/0;for(const n of t){const t=Number(n[0]),r=Number(n[1]);Number.isFinite(t)&&Number.isFinite(r)&&(t<e&&(e=t),r<i&&(i=r),t>s&&(s=t),r>o&&(o=r))}return e>s?null:{minX:e,minY:i,maxX:s,maxY:o}}function To(t){return t.poly&&t.poly.length?Co(t.poly):null==t.x||null==t.y?null:Co([[t.x,t.y],[t.x+(t.w||0),t.y+(t.h||0)]])}function zo(t,e){const i=[];for(const e of t.rooms||[]){const t=To(e);t&&i.push(t)}t.bg&&i.push({minX:t.bg.x,minY:t.bg.y,maxX:t.bg.x+t.bg.w,maxY:t.bg.y+t.bg.h});for(const t of e||[])if(Array.isArray(t)){const e=Co([t]);e&&i.push(e)}else i.push(t);return i}const Po=t=>{if(!t.length)return 0;const e=[...t].sort((t,e)=>t-e),i=e.length>>1;return e.length%2?e[i]:(e[i-1]+e[i])/2},Ro=t=>{let e=1/0,i=1/0,s=-1/0,o=-1/0;for(const n of t)n.minX<e&&(e=n.minX),n.minY<i&&(i=n.minY),n.maxX>s&&(s=n.maxX),n.maxY>o&&(o=n.maxY);return e>s||i>o?null:{x:e,y:i,w:s-e,h:o-i}};function Ao(t,e){let{x:i,y:s,w:o,h:n}=t;o<30&&(i=i+o/2-100,o=Do),n<30&&(s=s+n/2-100,n=Do);const r=Math.max(o,n)*e;return{x:i-r,y:s-r,w:o+2*r,h:n+2*r}}function Eo(t,e={}){const i=e.pad??.05,s=e.k??10,o=e.minSpread??50,n=t.filter(t=>Number.isFinite(t.minX)&&Number.isFinite(t.minY)&&Number.isFinite(t.maxX)&&Number.isFinite(t.maxY)&&Math.abs(t.minX)<=vo&&Math.abs(t.maxX)<=vo&&Math.abs(t.minY)<=vo&&Math.abs(t.maxY)<=vo);if(!n.length)return{core:null,all:null,outliers:0};const r=Ro(n);if(n.length<4){const t=Ao(r,i);return{core:t,all:t,outliers:0}}const a=n.map(t=>(t.minX+t.maxX)/2),l=n.map(t=>(t.minY+t.maxY)/2),c=Po(a),h=Po(l),d=n.map((t,e)=>Math.max(Math.abs(a[e]-c),Math.abs(l[e]-h))),p=Math.max((u=[...d].sort((t,e)=>t-e),_=.75,u.length?u[Math.min(u.length-1,Math.max(0,Math.round(_*(u.length-1))))]:0),o);var u,_;const g=d.map(t=>t>s*p),m=g.filter(Boolean).length,f=m&&m<=n.length*Mo?n.filter((t,e)=>!g[e]):n;return{core:Ao(Ro(f)||r,i),all:Ao(r,i),outliers:f===n?0:m}}function No(t,e,i=.05){const s=Eo(zo(t,e),{pad:i});if(s.core)return s.core;const o=t.vb&&4===t.vb.length&&t.vb[2]>0&&t.vb[3]>0?t.vb:[0,0,ho,ho];return{x:o[0],y:o[1],w:o[2],h:o[3]}}function Oo(t){const e=No(t);return{x:e.x+e.w/2,y:e.y+e.h/2}}function Io(t){const e=[];for(const i of t.rooms||[]){const t=To(i);t&&e.push(t)}const i=Eo(e,{pad:0}).core;return i?Math.max(ho,Math.min(vo,Math.max(i.w,i.h))):ho}function Fo(t,e,i,s=1){const o=Number(i),n=Number.isFinite(s)&&s>0?s:1;return!Number.isFinite(o)||o<=0?t*n:t*Io(e)*n/o}const Lo=[1,2,5,10,20,50,100,200,500,1e3];function qo(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}function Ho(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}function Uo(t){const e=mo(t.cfg),i=e.find(e=>e.id===t.spaceId);if(!i)return null;const s=_i(t.cfg.spaces.find(e=>e.id===t.spaceId)),o=t.iconSize??2.5,n=o>8?2.5:o,r={};for(const e of t.cfg.spaces||[])for(const t of e.rooms||[])t.area&&(r[t.area]=e.id);const a=t.cfg.settings?.exclude_integrations?new Set(t.cfg.settings.exclude_integrations):ht,l=pt(t.cfg.settings?.icon_rules?.length?t.cfg.settings.icon_rules:dt),c=to({hass:t.hass,areaToSpace:r,markers:t.cfg.markers||[],settings:t.cfg.settings||{},excluded:a,showAll:!!t.cfg.settings?.show_all,firstSpaceId:e[0]?.id||"",loc:e=>ao(t.lang,e),iconRules:l}),h=c.filter(e=>e.space===t.spaceId),d=h.filter(t=>!t.hidden),p=function(t,e,i){const s={},o=i/100*Io(e)*1.3;for(const i of e.rooms){if(!i.area)continue;const e=t.filter(t=>t.area===i.area);if(!e.length)continue;const n=qo(i),r=.1*Math.min(n.w,n.h),a=n.w-2*r,l=n.h-2*r,c=Math.max(1,Math.round(Math.sqrt(e.length*a/Math.max(l,1)))),h=a/c,d=l/Math.max(Math.ceil(e.length/c),1),p=e.map((t,e)=>({x:n.x+r+h*(e%c+.5),y:n.y+r+d*(Math.floor(e/c)+.5)}));Ye(p,n,o,.5*r),e.forEach((t,e)=>s[t.id]=xo(p[e]))}return s}(h,i,n),u=[];for(const e of d){const i=t.layout[e.id];if(i&&i.s===t.spaceId){const t=i.x*ho,e=i.y*ho;u.push({minX:t,minY:e,maxX:t,maxY:e})}}const _=No(i,u),g=[_.x,_.y,_.w,_.h],m=i.rooms.filter(t=>t.area||s.showBorders).map(e=>{let o="room "+(i.bg?"overlay":"yard"),n="";const r=Ii(s.fill,e);if(s.showBorders||"none"!==r){o+=" styled";const i=[`--room-stroke:${s.color}`,`--room-stroke-op:${s.showBorders?s.opacity:0}`],a=e.area?yi(r,"lqi"===r?function(t,e,i){const s=[];for(const o of e){if(o.area!==i||o.virtual)continue;const e=Vs(t,o.entities);null!=e&&s.push(e)}return Ge(s)}(t.hass,h,e.area):null,"light"===r?eo(t.hass,h,e.area):"none","temp"===r?function(t,e,i){const s=[];for(const o of e){if(o.area!==i)continue;if("mdi:thermometer"!==o.icon&&"mdi:air-filter"!==o.icon)continue;const e=Gs(t,o.entities);null!=e&&s.push(e)}return s.length?Math.round(s.reduce((t,e)=>t+e,0)/s.length*10)/10:null}(t.hass,h,e.area):null,s.tempMin,s.tempMax,vi(t.cfg?.settings)):null;a?(o+=" filled",i.push(`--room-fill:${a.c}`,`--room-fill-op:${a.a.toFixed(3)}`)):i.push("--room-fill:transparent","--room-fill-op:0"),n=i.join(";")}const a=!i.bg&&!s.showNames,l=Ho(e),c=e.poly?j`<polygon class="${o}" style="${n}" points="${e.poly.map(t=>t.join(",")).join(" ")}"></polygon>`:j`<rect class="${o}" style="${n}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${.03*Math.min(e.w,e.h)}"></rect>`;return j`${c}${a?j`<text class="rlabel" x="${l[0]}" y="${l[1]}">${e.name}</text>`:V}`}),f=d.map(e=>{const s=function(t,e,i,s,o){const n=e[t.id];return n&&n.s===t.space?{x:n.x*ho,y:n.y*ho}:s[t.id]?s[t.id]:xo(Oo(o))}(e,t.layout,t.cfg,p,i),o=(s.x-g[0])/g[2]*100,n=(s.y-g[1])/g[3]*100,r=Number(e.marker?.size)>0?Number(e.marker.size):1,a=Number(e.marker?.angle)||0,l=[`left:${o}%`,`top:${n}%`];return 1!==r&&l.push(`--dev-scale:${r}`),B`<div class="dev ${e.virtual?"virtual":""}" style="${l.join(";")}">
      <ha-icon icon="${e.icon}" style=${a?`transform:rotate(${a}deg)`:V}></ha-icon>
    </div>`}),v=s.showNames?i.rooms.filter(t=>t.name).map(e=>{const o=function(t,e,i){const s=i["rl_"+(t.id||"")];if(s&&s.s===e)return{x:s.x*ho,y:s.y*ho};const o=Ho(t);return xo({x:o[0],y:o[1]})}(e,i.id,t.layout,t.cfg),n=(o.x-g[0])/g[2]*100,r=(o.y-g[1])/g[3]*100,a=Math.min(1,s.opacity+.25);return B`<div class="roomlabel" style="left:${n}%;top:${r}%;color:${s.color};opacity:${a}">${e.name}</div>`}):[],b=i.bg?t.displayUrl?t.displayUrl(i.bg.href):i.bg.href:"",y=t.cfg.spaces.find(e=>e.id===t.spaceId)?.settings||{};let w="";if("daynight"===xs(t.cfg?.settings,y)&&null!==$s(t.cfg?.settings,y)){const e=Ms(t.hass);e&&(w=us(e.elevation).bg)}const $=w||gi(t.cfg?.settings,s);return B`
    <div class="hp-static-stage" style="aspect-ratio:${g[2]}/${g[3]}${$?";background:"+$:""}">
      <svg viewBox="${g[0]} ${g[1]} ${g[2]} ${g[3]}" preserveAspectRatio="xMidYMid meet">
        ${ke(i.rooms).map(t=>"poly"in t?j`<polygon class="hp-paper" points="${t.poly}"></polygon>`:j`<rect class="hp-paper" x="${t.rect.x}" y="${t.rect.y}" width="${t.rect.w}" height="${t.rect.h}" rx="${t.rect.rx}"></rect>`)}
        ${b?j`<image href="${b}" x="${i.bg.x}" y="${i.bg.y}" width="${i.bg.w}" height="${i.bg.h}" preserveAspectRatio="none" />`:V}
        ${m}
      </svg>
      ${""}
      <div class="devlayer" style="--icon-size:${Fo(n,i,g[2]).toFixed(3)}cqw">${f}${v}</div>
    </div>
  `}let Bo=null,jo=null,Wo=!1;const Vo=new Set;function Go(){if(Bo)return Bo;try{const t=JSON.parse(localStorage.getItem("houseplan_card_cfg_v1")||"null");if(t&&t.config&&Array.isArray(t.config.spaces))return{config:t.config,rev:t.rev||0,layout:t.layout||{}}}catch{}return null}function Ko(t){return Bo?Promise.resolve(Bo):jo||(jo=async function(t){const[e,i]=await Promise.all([t.callWS({type:"houseplan/config/get"}),t.callWS({type:"houseplan/layout/get"})]);if(Bo={config:e?.config??null,rev:e?.rev??0,layout:i?.layout??{}},!Wo&&t.connection?.subscribeEvents){Wo=!0;const e=()=>{Bo=null,Vo.forEach(t=>t())};try{await t.connection.subscribeEvents(e,"houseplan_config_updated"),await t.connection.subscribeEvents(e,"houseplan_layout_updated")}catch{Wo=!1}}return Bo}(t).finally(()=>{jo=null}),jo)}class Yo extends lt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _lang(){return ro(this.hass,this._config?.language)}get _schema(){const t=this._spaces||[];return[t.length?{name:"space",selector:{select:{mode:"dropdown",options:t}}}:{name:"space",selector:{text:{}}},{name:"title",selector:{text:{}}},{name:"show_button",selector:{boolean:{}}},{name:"button_label",selector:{text:{}}},{name:"button_target",selector:{text:{}}},{name:"aspect_ratio",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}}]}render(){if(!this.hass||!this._config)return V;this._loadSpaces();const t=this._lang,e={space:ao(t,"editor.space"),title:ao(t,"editor.title"),show_button:ao(t,"editor.show_button"),button_label:ao(t,"editor.button_label"),button_target:ao(t,"editor.button_target"),aspect_ratio:ao(t,"editor.aspect_ratio"),icon_size:ao(t,"editor.icon_size")};return B`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>e[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}Yo.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-space-card-editor")||customElements.define("houseplan-space-card-editor",Yo);const Xo=t=>{history.pushState(null,"",t),((t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)})(window,"location-changed",{replace:!1})};class Zo extends lt{constructor(){super(...arguments),this._snap=null,this._loading=!1,this._loadedOnce=!1,this._signer=new Ds(()=>this.requestUpdate()),this._goToSpace=()=>{const t=(this._config?.button_target||"/plan-doma").replace(/#.*$/,"");Xo(`${t}#space=${encodeURIComponent(this._config.space)}`)}}static getConfigElement(){return document.createElement("houseplan-space-card-editor")}static getStubConfig(t){const e=Go();return{type:"custom:houseplan-space-card",space:mo(e?.config||null)[0]?.id||"",show_button:!0}}setConfig(t){if(!t||!t.space)throw new Error('houseplan-space-card: "space" is required');this._config={show_button:!0,button_target:"/plan-doma",...t},this._snap=this._snap||Go()}connectedCallback(){var t;super.connectedCallback(),this._unsub=(t=()=>{this._loading=!1,this._snap=null,this.requestUpdate()},Vo.add(t),()=>Vo.delete(t)),this._signer.start(()=>this.hass,()=>this._referenced())}disconnectedCallback(){this._unsub?.(),this._unsub=void 0,this._signer.dispose(),super.disconnectedCallback()}willUpdate(t){!this.hass||this._loading||this._snap&&!t.has("hass")||this._snap&&this._loadedOnce||this._load()}async _load(){if(this.hass&&!this._loading){this._loading=!0;try{const t=await Ko(this.hass);this._snap=t,this._loadedOnce=!0}catch{}finally{this._loading=!1,this.requestUpdate()}}}get _lang(){return ro(this.hass,this._config?.language)}getCardSize(){const t=mo(this._snap?.config||null).find(t=>t.id===this._config?.space);if(t){const e=t.vb[3]/t.vb[2];return Math.max(3,Math.round(8*e))+(!1===this._config?.show_button?0:1)}return 6}_errorCard(t){return B`<ha-card><div class="hp-static-error">${t}</div></ha-card>`}_referenced(){return Ni(this._snap?.config)}render(){if(!this._config)return V;const t=this._snap?.config;if(!t)return B`<ha-card><div class="hp-static-error">${ao(this._lang,"space_card.loading")}</div></ha-card>`;const e=this._config.space,i=Uo({hass:this.hass,cfg:t,layout:this._snap?.layout||{},spaceId:e,iconSize:this._config.icon_size,lang:this._lang,displayUrl:t=>this._signer.display(this.hass,t)});if(!i)return this._errorCard(ao(this._lang,"space_card.not_found",{id:e}));const s=mo(t).find(t=>t.id===e),o=void 0!==this._config.title?this._config.title:s?.title||"",n=!1!==this._config.show_button,r=this._config.button_label||ao(this._lang,"space_card.button");return B`
      <ha-card>
        ${o?B`<div class="hp-static-title">${o}</div>`:V}
        ${i}
        ${n?B`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${r}</button>
            </div>`:V}
      </ha-card>
    `}}Zo.properties={hass:{attribute:!1},_config:{state:!0},_snap:{state:!0}},Zo.styles=[co,n`
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
    `],customElements.get("houseplan-space-card")||customElements.define("houseplan-space-card",Zo),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-space-card"===t.type)||window.customCards.push({type:"houseplan-space-card",name:"House Plan — Space (static)",description:"Read-only static schematic of a single houseplan space, with a deep-link button.",preview:!1,documentation:"https://github.com/Matysh/houseplan-card"});const Jo=4.166666666666667e-9;function Qo(t){if(!Number.isFinite(t))return t;const e=Math.round(t/wo)*wo;return Math.abs(e-t)<=Jo?t:e}const tn=(t,e,i,s)=>Math.hypot(i-t,s-e),en=(t,e,i,s,o,n,r,a)=>Math.hypot(Math.max(Math.abs(o-t),Math.abs(o+r-(t+i))),Math.max(Math.abs(n-e),Math.abs(n+a-(e+s)))),sn=(t,e,i,s,o,n,r)=>{const a=Math.max(Number(s)||0,0)/2,l=Math.PI/180,c=Math.cos(i*l)*a,h=Math.sin(i*l)*a,d=Math.cos(r*l)*a,p=Math.sin(r*l)*a,u=Math.max(tn(t+c,e+h,o+d,n+p),tn(t-c,e-h,o-d,n-p)),_=Math.max(tn(t+c,e+h,o-d,n-p),tn(t-c,e-h,o+d,n+p));return Math.min(u,_)},on=t=>{const e=Number(t?.cell_cm);return e>0?e:5};const nn="1.59.0-beta.2",rn=1500,an=new Map;let ln=0;const cn=t=>`${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(t??{})}`;let hn=1e4;const dn="houseplan_card_layout_v1",pn="houseplan_card_cfg_v1",un="houseplan_card_zoom_v1",_n="houseplan_card_nav_v1",gn="houseplan_card_kiosk_v1",mn=1e3,fn=(t,e)=>{const i=Math.min(t.x,e.x),s=Math.min(t.y,e.y);return{x:i,y:s,w:Math.max(t.x+t.w,e.x+e.w)-i,h:Math.max(t.y+t.h,e.y+e.h)-s}},vn=(t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)},bn=(t,e)=>{let i,s=null;const o=(...o)=>{clearTimeout(i),s=o,i=window.setTimeout(()=>{i=void 0;const e=s;s=null,e&&t(...e)},e)};return o.flush=()=>{if(void 0===i)return;clearTimeout(i),i=void 0;const e=s;s=null,e&&t(...e)},o.pending=()=>void 0!==i,o},yn=t=>{try{t.target?.setPointerCapture?.(t.pointerId)}catch{}};class wn extends lt{constructor(){super(...arguments),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._serverCanWrite=null,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._unsubCfg=null,this._unsubLayout=null,this._layoutRev=0,this._devices=[],this._regSignature="",this._defPos={},this._newSyncKey="",this._tip=null,this._selId=null,this._toast="",this._mode="view",this._decorTool="select",this._decorStyle={color:"#607d8b",width:3,fill:!1},this._decorDraft=null,this._decorMove=null,this._decorSel=null,this._decorTextDialog=null,this._dtBox=null,this._dtDrag=null,this._bdDrag=null,this._slide="",this._tool="draw",this._rszSel=null,this._rszDrag=null,this._rszUndo=[],this._rszPreview=null,this._rszLive=null,this._path=[],this._cursorPt=null,this._mergeSel=null,this._openingDialog=null,this._openingInfo=null,this._opDrag=null,this._opMeasure=null,this._opShift=!1,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._areaSel="",this._nameSel="",this._roomDialog=!1,this._roomEditId=null,this._roomFill="",this._roomTempSrc="",this._roomHumSrc="",this._roomSrcOpen=null,this._roomSrcFilter="",this._roomNameScale=1,this._roomLabelScale=1,this._zoom=1,this._view=null,this._zoomBySpace={},this._viewModeSnap=null,this._pointers=new Map,this._panStart=null,this._panLock=null,this._pinchStart=null,this._suppressClick=!1,this._hdrH=118,this._booting=!0,this._bootFading=!1,this._bootLastH=-1,this._bootStart=0,this._bootLastChange=0,this._bootSoft=!1,this._tapConfirm=null,this._onboardingShown=!1,this._rulesDialog=null,this._alignDialog=null,this._settingsDialog=null,this._sunRaysCache=null,this._skyElev=null,this._skySnap=!1,this._skySnapRaf=0,this._compassDrag=!1,this._importDialog=null,this._importQueue=[],this._importTotal=0,this._rulesCompiledSrc="",this._infoCard=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=t=>this._onKey(t),this._warmVp=null,this._warmVpArmed=!1,this._warmRevivePending=!1,this._warmGen=++ln,this._warmKey=null,this._warmSlot=null,this._hashApplied=!1,this._navApplied=!1,this._kioskScale={icon:1,font:1},this._kioskDialog=!1,this._senseRt=new Map,this._vacRt=new Map,this._vacViewKey="",this._vacLastView=null,this._vacRaf=0,this._vacSrvTrails={},this._vacJumpOnce=!1,this._vacVisHandler=()=>{"visible"===document.visibilityState&&(this._vacJumpOnce=!0,this._skyElev=null,this.requestUpdate())},this._vacFit=null,this._kioskDots=!1,this._cyclePausedUntil=0,this._swipeStart=null,this._lastTap=0,this._onHashChange=()=>{const t=this._hashSpace();t&&this._model.find(e=>e.id===t)&&t!==this._space&&(this._space=t,this._selId=null,this._restoreZoom(),this.requestUpdate())},this._drag=null,this._rlResize=null,this._holdFired=!1,this._cfgEpoch=0,this._modelCache=null,this._showHidden=!1,this._connHooked=null,this._onConnReady=()=>{this._loadTries=0,clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,this._loading||(this._loadOk&&this._unsubCfg?this._reloadConfigOnly():this._loadFromServer())},this._signer=new Ds(()=>this.requestUpdate()),this._dirtyPos=new Set,this._sentPos=new Map,this._persistLayout=bn(()=>{if(this._serverStorage){const t=[...this._dirtyPos];this._dirtyPos.clear();for(const e of t){const t=this._layout[e];t&&(this._sentPos.set(e,t),this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t}).then(t=>this._noteLayoutRev(t)).catch(t=>this._showToast(this._t("toast.pos_save_failed",{err:this._errText(t)}))).finally(()=>{this._sentPos.get(e)===t&&this._sentPos.delete(e)}))}this._cacheSnapshot()}else localStorage.setItem(dn,JSON.stringify(this._layout))},600),this._frame=null,this._showFar=!1,this._writesPending=0,this._writeChain=Promise.resolve(),this._saveConfigDebounced=bn(()=>{this._serverCfg&&this._writeConfig().catch(t=>{"conflict"===t?.code?(this._showToast(this._t("toast.conflict")),this._cancelPath(),this._reloadConfigOnly(!0)):this._showToast(this._t("toast.cfg_save_failed",{err:this._errText(t)}))})},500),this._openPairsCache=null,this._toggleServerPlans=async()=>{const t=this._spaceDialog;if(t)if(t.pickSaved)this._spaceDialog={...t,pickSaved:!1};else{this._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.hass.callWS({type:"houseplan/plans/list"}),e=this._spaceDialog;e&&(this._spaceDialog={...e,saved:t?.plans||[],savedBusy:!1})}catch(t){const e=this._spaceDialog;e&&(this._spaceDialog={...e,saved:[],savedBusy:!1}),this._showToast(this._t("toast.plans_list_failed",{err:this._errText(t)}))}}},this._aspectJob=null,this._sunShown=!1,this._sunOut=!1,this._sunOutTimer=0,this._openSettingsDialog=()=>{if(!this._norm)return;const t=this._glowRadiusCm,e=this._imperial?Math.round(t/30.48*10)/10:Math.round(t)/100;this._settingsDialog={colors:JSON.parse(JSON.stringify(this._fillColors)),glowRadius:e,bgColor:gi(this._settings,{bgColor:null})||null,northDeg:$s(this._settings,{}),bgMode:xs(this._settings,{}),sunRays:ks(this._settings,{}),weatherEntity:Ss(this._settings)||"",busy:!1}},this._openAlignDialog=()=>{if(!this._norm||!this._serverCfg)return;const t=this._serverCfg.spaces||[],e=function(t,e){const i=JSON.parse(JSON.stringify(t||[])),s=JSON.parse(JSON.stringify(e||{}));let o=0,n=0,r=0,a=0,l="",c=0;const h={};let d=5;for(const t of i){const e=on(t);null!=t?.id&&(h[String(t.id)]=e),e>d&&(d=e)}const p=(t,e,i,s=!1)=>{if(!(t>Jo||s))return;o++,t>r&&(r=t);const n=t*bo*e;n>a&&(a=n,l=i)};for(const t of i){const e=on(t),i=null!=t?.id?String(t.id):"";for(const s of t.rooms||[]){n++;let t=0;if(s.poly?.length)s.poly=s.poly.map(e=>{const i=[Qo(e[0]),Qo(e[1])];return t=Math.max(t,tn(e[0],e[1],i[0],i[1])),i});else if(null!=s.x&&null!=s.y){const e=s.x,i=s.y,o=s.w||0,n=s.h||0,r=Qo(e+o),a=Qo(i+n),l=Qo(e),c=Qo(i),h=Math.max(wo,r-l),d=Math.max(wo,a-c);t=en(e,i,o,n,l,c,h,d),s.x=l,s.y=c,s.w=h,s.h=d}p(t,e,i)}for(const s of t.decor||[]){n++;let t=0;if("line"===s.kind){const e=[Qo(s.x1),Qo(s.y1)],i=[Qo(s.x2),Qo(s.y2)];t=Math.max(tn(s.x1,s.y1,e[0],e[1]),tn(s.x2,s.y2,i[0],i[1])),s.x1=e[0],s.y1=e[1],s.x2=i[0],s.y2=i[1]}else{const e=Qo(s.x),i=Qo(s.y);if(null!=s.w&&null!=s.h){const o=Qo(s.x+s.w),n=Qo(s.y+s.h),r=Math.max(wo,o-e),a=Math.max(wo,n-i);t=en(s.x,s.y,s.w,s.h,e,i,r,a),s.w=r,s.h=a}else t=tn(s.x,s.y,e,i);s.x=e,s.y=i}p(t,e,i)}for(const s of t.openings||[]){n++;const o=Me([s.x,s.y],t.rooms||[],.025,{step:wo,length:Number(s.length)||0});if(!o)continue;const r=Number(s.angle),a=!(Number.isFinite(r)&&r===o.angle),l=sn(s.x,s.y,Number.isFinite(r)?r:o.angle,Number(s.length)||0,o.x,o.y,o.angle);s.x=o.x,s.y=o.y,s.angle=o.angle,a&&c++,p(l,e,i,a)}}for(const[t,e]of Object.entries(s)){if(!e||"object"!=typeof e)continue;const i=e;if("number"!=typeof i.x||"number"!=typeof i.y)continue;n++;const o=Qo(i.x),r=Qo(i.y),a=tn(i.x,i.y,o,r);s[t]={...i,x:o,y:r};const l="string"==typeof i.s?i.s:"";p(a,h[l]??d,l)}return{spaces:i,layout:s,report:{moved:o,total:n,maxShift:r,maxShiftCm:a,maxSpace:l,rotated:c},changed:o>0}}(t,this._layout||{}),i=Math.ceil(10*e.report.maxShiftCm)/10,s=t.find(t=>null!=t?.id&&String(t.id)===e.report.maxSpace),o=t.length>1&&s?String(s.title||s.id):"";this._alignDialog={report:e.report,spaces:e.spaces,layout:e.layout,cm:i,where:o,busy:!1}},this._openRulesDialog=()=>{if(!this._norm)return;const t=this._settings.icon_rules,e=(t&&t.length?t:dt).map(t=>({...t}));this._rulesDialog={rules:e,test:"",busy:!1}},this._climateCache=null,this._gearPtCache=new WeakMap}get _canEdit(){return!!this._norm&&(!0===this._serverCanWrite||!1!==this._serverCanWrite&&!0===this.hass?.user?.is_admin)}get _kiosk(){return!!this._config?.kiosk}_showKioskDots(){this._kioskDots=!0,clearTimeout(this._kioskDotsTimer),this._kioskDotsTimer=window.setTimeout(()=>this._kioskDots=!1,2500)}_slideTo(t,e){if(t===this._space)return;const i=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;this._space=t,this._selId=null,this._restoreZoom(),i||(this._slide=e,clearTimeout(this._slideTimer),this._slideTimer=window.setTimeout(()=>{this._slide="",this.requestUpdate()},260),this.requestUpdate())}_cycleTick(){if(this._kiosk&&Number(this._config?.cycle)>0&&Date.now()>=this._cyclePausedUntil&&this._model.length>1&&this._zoom<=1.001){const t=this._model.map(t=>t.id),e=t.indexOf(this._space);this._slideTo(t[(e+1)%t.length],"left"),this._showKioskDots()}}get _editing(){return"plan"===this._mode||"devices"===this._mode||"decor"===this._mode}get _markup(){return"plan"===this._mode}_hashSpace(){const t=/(?:^|[#&])space=([^&]+)/.exec(window.location.hash||"");return t?decodeURIComponent(t[1]):""}connectedCallback(){document.addEventListener("visibilitychange",this._vacVisHandler),super.connectedCallback(),window.addEventListener("keydown",this._keyHandler),this._signer.start(()=>this.hass,()=>Ni(this._serverCfg)),this._config?.kiosk&&Number(this._config?.cycle)>0&&(clearInterval(this._cycleTimer),this._cycleTimer=window.setInterval(()=>this._cycleTick(),1e3*Number(this._config.cycle))),window.addEventListener("hashchange",this._onHashChange),this._booting?this._bootWatch():this._bootFading&&(clearTimeout(this._bootTimer),this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220)),this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},rn)),!this._loadOk&&this._serverCfg&&this.hass&&this._scheduleLoadRetry(),!this._warmSlot&&this._config&&this._warmAdopt(),this._warmVp&&!this._warmRevivePending&&void 0===this._warmReviveTimer&&(this._warmRevivePending=!0,this._warmReviveTimer=window.setTimeout(()=>this._warmReviveDialog(),0))}disconnectedCallback(){document.removeEventListener("visibilitychange",this._vacVisHandler),this._vacRaf&&(cancelAnimationFrame(this._vacRaf),this._vacRaf=0),this._skySnapRaf&&(cancelAnimationFrame(this._skySnapRaf),this._skySnapRaf=0);for(const t of this._senseRt.values())clearTimeout(t.timer);window.removeEventListener("keydown",this._keyHandler),clearInterval(this._cycleTimer),clearTimeout(this._kioskDotsTimer),clearTimeout(this._kioskHoldTimer),clearTimeout(this._reloadRetry),clearTimeout(this._loadRetryTimer),this._loadRetryTimer=void 0,this._connHooked?.removeEventListener?.("ready",this._onConnReady),this._connHooked=null,this._signer.dispose(),clearTimeout(this._toastTimer),clearTimeout(this._slideTimer),clearTimeout(this._bootTimer),this._bootTimer=void 0,clearTimeout(this._bootSoftTimer),this._saveConfigDebounced.flush(),window.removeEventListener("hashchange",this._onHashChange),clearTimeout(this._holdTimer),this._roViewport?.disconnect(),this._roViewport=void 0,this._roHdr?.disconnect(),this._roHdr=void 0,this._onWinResize&&(window.removeEventListener("resize",this._onWinResize),this._onWinResize=void 0),this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),this._unsubLayout&&(this._unsubLayout(),this._unsubLayout=null),clearTimeout(this._layoutSyncTimer),this._warmSnapshot(),this._warmRevivePending=!1,clearTimeout(this._warmReviveTimer),this._warmReviveTimer=void 0,this._warmRelease(),super.disconnectedCallback()}_onKey(t){if("Escape"===t.key&&this._vacFit)return this._vacFit=null,this._showToast(this._t("vac.cal_cancelled")),void t.stopPropagation();if("Escape"===t.key){if(this._tapConfirm)return void(this._tapConfirm=null);if(this._openingInfo)return void(this._openingInfo=null);if(this._infoCard)return void(this._infoCard=null);if(this._rulesDialog)return void(this._rulesDialog=null);if(this._alignDialog)return void(this._alignDialog=null);if(this._settingsDialog)return void(this._settingsDialog=null);if(this._markerDialog)return void(this._markerDialog=null);if(this._openingDialog)return void(this._openingDialog=null);if(this._decorTextDialog)return void(this._decorTextDialog=null);if(this._spaceDialog&&!this._roomDialog)return this._spaceDialog=null,this._importQueue=[],void(this._importTotal=0)}if("decor"===this._mode)return"Delete"!==t.key&&"Backspace"!==t.key||!this._decorSel||t.target?.closest?.("input, textarea, select")?void("Escape"===t.key&&(t.preventDefault(),this._decorDraft?this._decorDraft=null:this._decorSel?this._decorSel=null:"select"!==this._decorTool?this._decorTool="select":this._setMode("view"))):(t.preventDefault(),void this._decorDeleteSel());if(!this._markup)return;const e="Escape"===t.key||(t.ctrlKey||t.metaKey)&&"z"===t.key.toLowerCase();if(e){if(this._roomDialog)return t.preventDefault(),void this._roomDialogCancel();if("draw"===this._tool&&this._path.length)return t.preventDefault(),void this._undoPoint();if(e)return"resize"===this._tool?(t.preventDefault(),this._rszDrag?void this._rszCancelDrag():(t.ctrlKey||t.metaKey)&&"z"===t.key.toLowerCase()?void this._rszUndoPop():void(this._rszSel?this._rszSel=null:this._tool="draw")):"split"===this._tool?(t.preventDefault(),void(this._splitSel?.pts?.length?(this._splitSel={...this._splitSel,pts:this._splitSel.pts.slice(0,-1)},this._splitSel.pts.length||(this._cursorPt=null)):this._splitSel?this._splitSel=null:this._tool="draw")):"merge"===this._tool?(t.preventDefault(),void(this._mergeSel?this._mergeSel=null:this._tool="draw")):void("openwall"!==this._tool&&"opening"!==this._tool&&"delroom"!==this._tool||(t.preventDefault(),this._tool="draw"))}}_undoPoint(){this._path.length&&(this._path=this._path.slice(0,-1))}static getConfigElement(){return document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card"}}static _warmBootReset(t){for(const t of an.values())for(const e of t)clearTimeout(e.evict);an.clear(),hn=t&&t>0?t:1e4}static _warmBootStats(){let t=0,e=0;const i=[];for(const s of an.values())for(const o of s)t++,o.dlg&&(e++,i.push(o.dlg.kind));return{keys:an.size,slots:t,dlgs:e,drafts:i}}setConfig(t){this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...t},this._config.kiosk&&(this._booting=!1,this._bootFading=!1),t.default_floor&&(this._space=t.default_floor);try{this._zoomBySpace=JSON.parse(localStorage.getItem(un)||"{}")||{}}catch{this._zoomBySpace={}}try{const t=JSON.parse(localStorage.getItem(gn)||"null");this._kioskScale={icon:Fi(t?.icon),font:Fi(t?.font)}}catch{}try{const e=JSON.parse(localStorage.getItem(pn)||"null");if(e&&e.config&&Array.isArray(e.config.spaces)){this._serverCfg=e.config,this._cfgEpoch++,this._cfgRev=e.rev||0,this._layout=e.layout||{},this._serverStorage=!0;const i=this._hashSpace(),s=this._savedNav();i&&this._model.find(t=>t.id===i)?(this._space=i,this._hashApplied=!0):s?.space&&this._model.find(t=>t.id===s.space)?(this._space=s.space,this._navApplied=!0):t.default_floor?this._space=t.default_floor:this._model.find(t=>t.id===this._space)||(this._space=this._model[0]?.id||this._space),s?.mode&&"view"!==s.mode&&this._canEdit&&!t.kiosk&&(this._mode=s.mode)}}catch{}"view"!==this._mode||this._view||(this._zoom=this._zoomBySpace[this._space]||1),this.isConnected&&this._warmAdopt()}_warmAdopt(){if(this._config?.kiosk)return;const t=cn(this._config);if(this._warmKey===t&&this._warmSlot)return;this._warmSlot&&this._warmRelease();const e=this.parentNode,i=this._warmIdx(e),s=an.get(t);if(!s||!s.length)return;const o=s.find(t=>t.owner===this._warmGen);if(o)return clearTimeout(o.evict),o.evict=0,o.freed=0,o.live=!0,this._warmSlot=o,void(this._warmKey=t);const{slot:n,sure:r}=((t,e,i,s)=>{const o=t=>{const e=!!i&&t.place?.deref()===i;return e&&t.idx===s?4:t.live?0:e?3:2};let n=null,r=0,a=0,l=null;for(const i of t){if(i.owner===e)continue;l=i;const t=o(i);t<=0||(t>r?(n=i,r=t,a=1):t===r&&a++)}return!n||a>1?{slot:n||l,sure:!1}:{slot:n,sure:!0}})(s,this._warmGen,e,i);n&&(this._booting=!1,this._bootFading=!1,this._hdrH=n.hdrH,this._bootSoft=!0,this.isConnected&&(clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},rn)),this._warmKey=t,r?(clearTimeout(n.evict),n.evict=0,n.owner=this._warmGen,n.place=e?new WeakRef(e):null,n.idx=i,n.live=!0,this._warmSlot=n,this._warmVp=n.vp,this._warmAdoptViewport(this._config)):(this._warmSlot={owner:this._warmGen,place:e?new WeakRef(e):null,idx:i,live:!0,hdrH:n.hdrH,stageH:n.stageH,vp:null,dlg:null,freed:0,evict:0},s.push(this._warmSlot),this._warmTrim(s)))}_warmIdx(t){const e=t?.children;if(!e)return-1;for(let t=0;t<e.length;t++)if(e[t]===this)return t;return-1}_warmRelease(){const t=this._warmSlot,e=this._warmKey;this._warmSlot=null,this._warmKey=null,t&&e&&(t.freed=Date.now(),t.owner===this._warmGen&&(t.live=!1),this._warmScheduleEvict(t,e))}_warmTrim(t){for(;t.length>4;){const e=t.findIndex(t=>!t.live);if(e<0)break;clearTimeout(t[e].evict),t.splice(e,1)}}_warmScheduleEvict(t,e){if(clearTimeout(t.evict),!t.dlg)return;const i=t.freed,s=t.owner;t.evict=window.setTimeout(()=>{if(t.evict=0,t.freed!==i||t.owner!==s)return;t.dlg=null;const o=an.get(e);if(!t.live&&o&&o.length>1){const e=o.indexOf(t);e>=0&&o.splice(e,1)}},hn+250)}_warmAdoptViewport(t){const e=this._warmVp;e&&(!this._hashApplied&&this._model.find(t=>t.id===e.space)?(this._space=e.space,this._navApplied=!0,this._mode="view"!==e.mode&&this._canEdit&&!t.kiosk?e.mode:"view",this._zoom=e.zoom,this._view=e.view?{...e.view}:null,this._viewModeSnap=e.snap?{...e.snap}:null,this._tool=e.tool,this._decorTool=e.decorTool,this._showHidden=e.showHidden,this._showFar!==e.showFar&&(this._showFar=e.showFar,this._frame=null),this._selId=e.selId,this._rszSel=e.rszSel,this._decorSel=e.decorSel,this._warmVpArmed=!0):this._warmVp=null)}_warmPatch(t,e=!1){if(this._config?.kiosk)return;const i=cn(this._config);if(!this._warmSlot||this._warmKey===i){if(!this._warmSlot){if(!e)return;const t=this.parentNode;this._warmKey=i,this._warmSlot={owner:this._warmGen,place:t?new WeakRef(t):null,idx:this._warmIdx(t),live:!0,hdrH:this._hdrH,stageH:0,vp:null,dlg:null,freed:0,evict:0};const s=an.get(i)||[];for(s.push(this._warmSlot),an.set(i,s),this._warmTrim(s);an.size>8;){const t=an.keys().next().value;if(void 0===t||t===i)break;for(const e of an.get(t)||[])clearTimeout(e.evict);an.delete(t)}}Object.assign(this._warmSlot,t)}}_warmViewportState(){return{space:this._space,mode:this._mode,zoom:this._zoom,view:this._view?{...this._view}:null,snap:this._viewModeSnap?{...this._viewModeSnap}:null,tool:this._tool,decorTool:this._decorTool,showHidden:this._showHidden,showFar:this._showFar,selId:this._selId,rszSel:this._rszSel,decorSel:this._decorSel}}_warmDialogState(){const t=(t,e)=>({kind:t,space:this._space,mode:this._mode,data:e});return this._tapConfirm||this._alignDialog||this._mergeDialog||this._importDialog?null:this._openingInfo?t("openingInfo",this._openingInfo.id):this._infoCard?t("info",this._infoCard.id):this._rulesDialog?this._rulesDialog.busy?null:t("rules",this._rulesDialog):this._settingsDialog?this._settingsDialog.busy?null:t("settings",this._settingsDialog):this._markerDialog?this._markerDialog.busy?null:t("marker",this._markerDialog):this._openingDialog?t("opening",this._openingDialog):this._decorTextDialog?t("decorText",this._decorTextDialog):this._roomDialog?t("room",{editId:this._roomEditId,fill:this._roomFill,tempSrc:this._roomTempSrc,humSrc:this._roomHumSrc,srcOpen:this._roomSrcOpen,srcFilter:this._roomSrcFilter,nameScale:this._roomNameScale,labelScale:this._roomLabelScale,areaSel:this._areaSel,nameSel:this._nameSel,pendingSplit:this._pendingSplit,path:this._path}):this._spaceDialog?this._spaceDialog.busy?null:t("space",this._spaceDialog):null}_warmSnapshot(){if(this._booting||this._config?.kiosk)return;const t={vp:this._warmViewportState()};if(this._warmRevivePending||(t.dlg=this._warmDialogState()),this.isConnected&&this._warmSlot?.owner===this._warmGen){const e=this.parentNode;t.place=e?new WeakRef(e):null,t.idx=this._warmIdx(e)}this._warmPatch(t)}_warmReviveDialog(){this._warmRevivePending=!1;const t=this._warmSlot;if(this._warmReviveTimer=void 0,!t||!t.dlg)return;const e=t.dlg,i=t.freed;if(t.dlg=null,t.freed=0,clearTimeout(t.evict),t.evict=0,i&&!(Date.now()-i>hn)&&e.space===this._space&&e.mode===this._mode){switch(e.kind){case"space":this._spaceDialog={...e.data,busy:!1,savedBusy:!1};break;case"marker":this._markerDialog={...e.data,busy:!1};break;case"settings":this._settingsDialog={...e.data,busy:!1};break;case"rules":this._rulesDialog={...e.data,busy:!1};break;case"opening":this._openingDialog={...e.data};break;case"decorText":this._decorTextDialog={...e.data};break;case"room":{const t=e.data;this._roomEditId=t.editId,this._roomFill=t.fill,this._roomTempSrc=t.tempSrc,this._roomHumSrc=t.humSrc,this._roomSrcOpen=t.srcOpen,this._roomSrcFilter=t.srcFilter,this._roomNameScale=t.nameScale,this._roomLabelScale=t.labelScale,this._areaSel=t.areaSel,this._nameSel=t.nameSel,this._pendingSplit=t.pendingSplit,this._path=t.path,this._roomDialog=!0;break}case"info":{const t=this._devices.find(t=>t.id===e.data);t&&(this._infoCard=t);break}case"openingInfo":{const t=(this._curSpaceCfg?.openings||[]).find(t=>t.id===e.data);t&&(this._openingInfo=t);break}}this.requestUpdate()}}_cacheSnapshot(){if(this._serverCfg)try{localStorage.setItem(pn,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,layout:this._layout}))}catch{}}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}_cfgFingerprint(){const t=this._serverCfg?.spaces||[];let e=t.length+":";for(const i of t){e+=(i.id||"")+","+(i.plan_aspect||"")+","+(i.plan_url||"").length+","+(i.plan_x??"")+","+(i.plan_y??"")+","+(i.plan_scale??"")+","+(i.rooms?.length||0)+","+(i.openings?.length||0)+","+(i.decor?.length||0)+";";for(const t of i.rooms||[]){const i=t.poly?.[0],s=t.poly?.[t.poly.length-1];e+=(t.poly?.length||0)+"."+(t.id||"")+"."+(t.open_to||[]).join("+")+"."+(t.area||"")+"."+JSON.stringify(t.settings||0)+"."+(t.x??"")+","+(t.y??"")+","+(t.w??"")+","+(t.h??"")+","+(i?i[0]+"/"+i[1]:"")+","+(s?s[0]+"/"+s[1]:"")+";"}}return e}get _model(){if(!this._serverCfg)return[];const t=this._cfgEpoch+"|"+this._cfgFingerprint();if(this._modelCache&&this._modelCache.key===t)return this._modelCache.model;const e=this._buildModel();return this._modelCache={key:t,model:e},e}_buildModel(){if(!this._serverCfg)return[];const t=this._renderCfg;return mo(t).map((e,i)=>{const s=t.spaces[i]?.plan_url;return e.bg&&s?{...e,bg:{...e.bg,href:s}}:e})}_spaceModel(t){const e=this._model;return e.find(e=>e.id===(t??this._space))||e[0]}get _areaToSpace(){const t={};for(const e of this._model)for(const i of e.rooms)i.area&&(t[i.area]={space:e.id,room:i});return t}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return this._settings.filter_seeded?this._showHidden:!!this._settings.show_all}_toggleShowAll(){if(this._serverCfg){if(this._settings.filter_seeded)return this._showHidden=!this._showHidden,void this.requestUpdate();this._serverCfg={...this._serverCfg,settings:{...this._serverCfg.settings,show_all:!this._settings.show_all}},this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate()}}_seedHiddenDevices(){if(!this._serverCfg||!this._norm||!this._canEdit)return;const t=this._serverCfg,e=function(t){const{hass:e,areaToSpace:i,markers:s,settings:o,excluded:n,iconRules:r}=t,a=!1!==o.group_lights,l=Zs(e,a),c=new Set(l.map(t=>t.area)),h=Hs(e),d=new Set(s.map(t=>t.binding)),p=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(d.has("device:"+t.id))continue;const o=h[t.id]||[],l=Us(e,t,o);let u=n.has(l)||"Group"===t.model||/scene/i.test(t.model||"")||/bridge/i.test((t.model||"")+(t.name||""))||"myheat"===l&&!!t.via_device_id;!u&&a&&c.has(s)&&"mdi:lightbulb"===Js(e,(t.name_by_user||t.name||"").trim(),t.model,o,r)&&(u=!0),u&&p.push("device:"+t.id)}return p}({hass:this.hass,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,firstSpaceId:this._model[0]?.id||"",iconRules:this._iconRules});if(!e.length&&t.settings?.filter_seeded)return;t.markers=t.markers||[];const i=[];for(const s of e){const e="h"+s.slice(s.indexOf(":")+1);t.markers.push({id:e,binding:s,hidden:!0}),i.push(s.slice(s.indexOf(":")+1))}const s={...t.settings||{},filter_seeded:!0};delete s.show_all,i.length&&Array.isArray(s.new_device_ids)&&(s.new_device_ids=s.new_device_ids.filter(t=>!i.includes(t))),t.settings=s,this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate()}get _iconRules(){const t=this._settings.icon_rules;if(!t||!Array.isArray(t)||!t.length)return;const e=JSON.stringify(t);return e!==this._rulesCompiledSrc&&(this._rulesCompiledSrc=e,this._rulesCompiled=pt(t)),this._rulesCompiled}get _fillColors(){return vi(this._settings)}get _excluded(){const t=this._settings.exclude_integrations;return t?new Set(t):ht}willUpdate(t){t?.has?.("hass")&&(this._vacTick(),this._senseTick()),this._skyPlan(),t.has("hass")&&this.hass&&(this._hookConnection(),!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices())}updated(){this._skyRelease(),this._warmSnapshot(),this._dtMeasure();const t=this._stageEl;t&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(t)),t&&this._booting&&!this._bootTimer&&this._bootWatch();const e=this.renderRoot.querySelector(".hdr");if(e&&t&&!this._roHdr){const i=()=>{const e=this.renderRoot.querySelector("ha-card");if(!e)return;const i=t.getBoundingClientRect().top-e.getBoundingClientRect().top,s=Math.min(Math.max(e.getBoundingClientRect().top,0),120),o=Math.round(i+s);o>=0&&Math.abs(o-this._hdrH)>1&&(this._hdrH=o),o>=0&&!this._booting&&!this._config?.kiosk&&t.clientHeight>0&&this._warmPatch({hdrH:o,stageH:t.clientHeight})};this._roHdr=new ResizeObserver(()=>requestAnimationFrame(i)),this._roHdr.observe(e),this._onWinResize=()=>requestAnimationFrame(i),window.addEventListener("resize",this._onWinResize),i()}if(t&&!this._view&&this._refitView(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._importDialog&&!this._onboardingShown){this._onboardingShown=!0;const t=function(t){const e=t?.floors;if(!e||"object"!=typeof e)return[];const i=[];for(const t of Object.values(e))t&&t.floor_id&&i.push({id:t.floor_id,name:t.name||t.floor_id,level:t.level??null});return i.sort((t,e)=>{const i=t.level??1e9,s=e.level??1e9;return i!==s?i-s:t.name.localeCompare(e.name)}),i}(this.hass);t.length?this._importDialog={floors:t.map(t=>({...t,checked:!0}))}:this._openSpaceDialog("create")}}async _loadFromServer(){this._loading=!0,this._loadTries++;try{const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._loadOk=!0,this._serverStorage=!0,"boolean"==typeof t?.can_write&&(this._serverCanWrite=t.can_write);const i=t?.config;this._serverCfg=i&&Array.isArray(i.spaces)?i:null,this._cfgEpoch++,this._cfgRev=t?.rev||0,this._layout=e?.layout||{},this._layoutRev=e?.rev??0,this._unsubCfg||(this._unsubCfg=await this.hass.connection.subscribeEvents(t=>{(t?.data?.rev??-1)!==this._cfgRev&&this._reloadConfigOnly()},"houseplan_config_updated")),this.hass.callWS({type:"houseplan/trail/get"}).then(t=>{this._vacSrvTrails=t?.trails||{},this.requestUpdate()}).catch(()=>{}),this._unsubTrail||(this._unsubTrail=await this.hass.connection.subscribeEvents(async()=>{try{const t=await this.hass.callWS({type:"houseplan/trail/get"});this._vacSrvTrails=t?.trails||{},this.requestUpdate()}catch{}},"houseplan_trail_updated")),this._unsubLayout||(this._unsubLayout=await this.hass.connection.subscribeEvents(t=>this._onLayoutEvent(Number(t?.data?.rev??-1)),"houseplan_layout_updated"));const s=this._hashSpace(),o=this._savedNav();!this._hashApplied&&s&&this._model.find(t=>t.id===s)?(this._space=s,this._hashApplied=!0):o?.space&&!this._navApplied&&!this._hashApplied&&this._model.find(t=>t.id===o.space)?(this._space=o.space,this._navApplied=!0):this._norm&&!this._model.find(t=>t.id===this._space)&&(this._space=this._model[0]?.id||this._space),this._cacheSnapshot(),this._warmVpArmed&&this._space===this._warmVp?.space?this._warmVpArmed=!1:this._restoreZoom()}catch(t){if(this._serverCfg)this._scheduleLoadRetry();else if(this._loadTries>=8){this._serverStorage=!1;try{this._layout=JSON.parse(localStorage.getItem(dn)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1}this._regSignature="",this.requestUpdate()}async _reloadConfigOnly(t=!1){if(!t&&(this._saveConfigDebounced.pending()&&this._saveConfigDebounced.flush(),this._cfgWriting))return clearTimeout(this._reloadRetry),void(this._reloadRetry=window.setTimeout(()=>this._reloadConfigOnly(),400));try{const t=await this.hass.callWS({type:"houseplan/config/get"}),e=t?.config;this._serverCfg=e&&Array.isArray(e.spaces)?e:null,this._cfgEpoch++,this._cfgRev=t?.rev||0,"boolean"==typeof t?.can_write&&(this._serverCanWrite=t.can_write),this._cacheSnapshot(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch(t){this._showToast(this._t("toast.cfg_reload_failed",{err:this._errText(t)}))}}_scheduleLoadRetry(){if(void 0!==this._loadRetryTimer)return;const t=Math.min(8e3,500*2**Math.min(4,Math.max(1,this._loadTries-7)));this._loadRetryTimer=window.setTimeout(()=>{this._loadRetryTimer=void 0,this._loadOk||this._loading||!this.hass||this._loadFromServer()},t)}_hookConnection(){const t=this.hass?.connection;t&&t!==this._connHooked&&(this._connHooked?.removeEventListener?.("ready",this._onConnReady),t.addEventListener?.("ready",this._onConnReady),this._connHooked=t)}_display(t){return this._signer.display(this.hass,t)}_resign(){this._signer.resign(this.hass,Ni(this._serverCfg))}_onLayoutEvent(t){t<=this._layoutRev||(clearTimeout(this._layoutSyncTimer),this._layoutSyncTimer=window.setTimeout(()=>{t<=this._layoutRev||this._reloadLayoutOnly()},200))}_noteLayoutRev(t){const e=t?.rev;"number"==typeof e&&e>this._layoutRev&&(this._layoutRev=e)}async _reloadLayoutOnly(){if(!this._serverStorage||!this.hass?.callWS)return;const t=new Map;for(const e of this._dirtyPos)this._layout[e]&&t.set(e,this._layout[e]);this._persistLayout.pending()&&this._persistLayout.flush();for(const[e,i]of this._sentPos)t.set(e,i);try{const e=await this.hass.callWS({type:"houseplan/layout/get"}),i={...e?.layout||{}};for(const[e,s]of t)i[e]=s;this._layout=i,this._layoutRev=e?.rev??this._layoutRev,this._cacheSnapshot(),this.requestUpdate()}catch{}}_maybeRebuildDevices(){const t=this.hass;if(!t?.devices||!t?.entities||!t?.areas)return;const e=Object.keys(t.devices).length+":"+Object.keys(t.entities).length+":"+Object.keys(t.areas).length+":"+(this._norm?"n":"l")+":"+ro(t,this._config?.language);e===this._regSignature&&this._devices.length||(this._regSignature=e,this._devices=to({hass:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||"",loc:t=>this._t(t),iconRules:this._iconRules}),this._defPos=this._defaultPositions(),this._syncNewDevices(),this._seedHiddenDevices())}_syncNewDevices(){if(!this._norm||!this._loadOk||!this._serverCfg)return;const t=this._devices.filter(t=>!t.marker&&!t.virtual).map(t=>t.id).sort(),e=t.join(",");if(e===this._newSyncKey)return;this._newSyncKey=e;const i=this._settings,{fresh:s,known:o}=function(t,e){if(!Array.isArray(e))return{fresh:[],known:[...t]};const i=new Set(e),s=t.filter(t=>!i.has(t));return{fresh:s,known:s.length?[...e,...s]:e}}(t,i.known_devices);if(!Array.isArray(i.known_devices)||s.length){const t=[...new Set([...i.new_device_ids||[],...s])];this._serverCfg={...this._serverCfg,settings:{...i,known_devices:o,new_device_ids:t}},this._saveConfig()}}get _newIds(){const t=this._settings.new_device_ids;return new Set(Array.isArray(t)?t:[])}_ackNewDevice(t){if(!this._newIds.has(t)||!this._serverCfg)return;const e=this._settings;this._serverCfg={...this._serverCfg,settings:{...e,new_device_ids:(e.new_device_ids||[]).filter(e=>e!==t)}},this._saveConfig(),this.requestUpdate()}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(t){if(!t)return null;const e=[];for(const i of this._devices){if(i.area!==t||i.virtual)continue;const s=Vs(this.hass,i.entities);null!=s&&e.push(s)}return Ge(e)}_roomBounds(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),o=Math.min(...i);return{x:s,y:o,w:Math.max(...e)-s,h:Math.max(...i)-o}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}_defaultPositions(){const t={},e=this._config?.icon_size??2.5;for(const i of this._model){const s=e/100*Io(i)*1.3;for(const e of i.rooms){if(!e.area)continue;const o=this._devices.filter(t=>t.area===e.area&&t.space===i.id);if(!o.length)continue;const n=this._roomBounds(e),r=.1*Math.min(n.w,n.h),a=n.w-2*r,l=n.h-2*r,c=Math.max(1,Math.round(Math.sqrt(o.length*a/Math.max(l,1)))),h=Math.ceil(o.length/c),d=a/c,p=l/Math.max(h,1),u=o.map((t,e)=>({x:n.x+r+d*(e%c+.5),y:n.y+r+p*(Math.floor(e/c)+.5)}));Ye(u,n,s,.5*r),o.forEach((e,i)=>t[e.id]=xo(u[i]))}}return t}_pos(t){const e=this._spaceModel(t.space),i=this._layout[t.id];if(i)if(this._norm){if(i.s===t.space)return{x:i.x*mn,y:i.y*mn}}else if(void 0===i.s)return{x:i.x,y:i.y};return this._defPos[t.id]?this._defPos[t.id]:xo(Oo(e))}_savePos(t,e,i,s=!1){if(this._norm){const o=this._gridPitch,n=s?e:Math.round(e/o)*o,r=s?i:Math.round(i/o)*o,a=this._layout[t.id]?.k;this._layout={...this._layout,[t.id]:{s:t.space,x:So(n/mn),y:So(r/mn),...a?{k:a}:{}}}}else this._layout={...this._layout,[t.id]:{x:Math.round(e),y:Math.round(i)}};this._dirtyPos.add(t.id),this._persistLayout()}_coverIndicator(t){return"cover"===t.tapAction?oi(t.entities):null}_actEntity(t){return this._coverIndicator(t)||t.primary}_stateClass(t){if(!this._config?.live_states)return"";const e=this._coverIndicator(t);if(e){const t=this.hass.states[e];return t?"unavailable"===t.state?"unavail":ni(t.state)?"covermove":"":""}const i=(t.marker?.controls||[]).filter(Ti);if(i.length)return i.some(t=>"on"===this.hass.states[t]?.state)?"on":"";if(Ws(this.hass,t))return"on";const s=this._actEntity(t),o=s?this.hass.states[s]:void 0;if(!o)return"";if("unavailable"===o.state)return"unavail";const n=s.split(".")[0];if(["light","switch","fan","humidifier"].includes(n))return"on"===o.state?"on":"";if("climate"===n){const t=o.attributes?.hvac_action;return null!=t?["heating","cooling","drying","fan"].includes(t)?"on":"":["off","unknown"].includes(o.state)?"":"on"}if("cover"===n)return ni(o.state)?"covermove":"";if("valve"===n)return["open","opening"].includes(o.state)?"open":"";if("lock"===n)return["unlocked","open"].includes(o.state)?"open":"";if("binary_sensor"===n){const e=o.attributes?.device_class;if(["door","window","garage_door","opening","gas","smoke","moisture","problem"].includes(e))return"on"===o.state?"open":"";if("motion"===e){const e=this._senseRt.get(t.id);return e&&e.flashTs&&Date.now()-e.flashTs<3300?e.gen%2==0?"senseflash sf2":"senseflash":""}if(["occupancy","presence"].includes(e))return"on"===o.state?"sensehold":""}return"media_player"===n?["playing","on"].includes(o.state)?"on":"":"vacuum"===n&&["cleaning","returning"].includes(o.state)?"on":""}_liveTemp(t){if(!this._config?.show_temperature)return null;if(!0===t.marker?.use_climate_temp){const e=Ks(this.hass,t.entities);if(null!=e)return e}return"mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon?null:Gs(this.hass,t.entities)}_bindingHasClimate(t){if(t.startsWith("entity:"))return t.slice(7).startsWith("climate.");if(t.startsWith("device:")){const e=t.slice(7);for(const[t,i]of Object.entries(this.hass?.entities||{}))if(i?.device_id===e&&t.startsWith("climate."))return!0}return!1}_bindingCoverEntity(t){if(t.startsWith("entity:"))return oi([t.slice(7)]);if(t.startsWith("device:")){const e=t.slice(7);return oi(Object.entries(this.hass?.entities||{}).filter(([,t])=>t?.device_id===e).map(([t])=>t))}return null}_bindingCoverTap(t){const e=this._bindingCoverEntity(t);if(!e)return!1;const i=String(this.hass?.states?.[e]?.attributes?.device_class||"");return!si.has(i)}_liveHum(t){return this._config?.show_temperature&&t.primary&&Ys(this.hass,t.primary)?Xs(this.hass,t.entities):null}_openMoreInfo(t){t?vn(this,"hass-more-info",{entityId:t}):this._showToast(this._t("toast.no_entity"))}_ctxDevice(t,e){"view"===this._mode&&(t.preventDefault(),t.stopPropagation(),e.primary?this._openMoreInfo(e.primary):this._infoCard=e)}_clickDevice(t,e){if(t.stopPropagation(),this._drag?.moved||this._suppressClick||this._holdFired)return;if("plan"===this._mode)return;if("devices"===this._mode)return void this._openMarkerDialog(e);const i=this._coverIndicator(e),s=this._actEntity(e),o=s?s.split(".")[0]:null,n=(t,i)=>{e.marker?.tap_confirm?this._tapConfirm={text:t,exec:i}:i()},r=(e.marker?.controls||[]).filter(Ti);if("toggle"===e.tapAction&&r.length){const t=(a=r.map(t=>this.hass.states[t]?.state),a.some(t=>"on"===t)?"turn_off":"turn_on");return void n(this._t("confirm.tap_toggle",{name:e.name}),()=>{this.hass.callService("homeassistant",t,{entity_id:r}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))})}var a;const l=function(t,e,i,s){const o=t||e||("light"===i?"toggle":"info");return"more-info"===o?"more-info":"run"===o?"run"===t?"run":"info":"cover"===o?"cover"!==t||"cover"!==i||si.has(String(s||""))?"info":"cover":"toggle"!==o||!i||ii.has(i)?"info":"toggle"===t?"toggle":ei.has(i)?"cover"===i&&si.has(String(s||""))?"info":"toggle":"info"}(e.tapAction,void 0,o,s?this.hass.states[s]?.attributes?.device_class:null);if("run"===l){const t=e.marker?.tap_target||"",i=function(t){const e=String(t||"").split(".")[0];return"automation"===e?{domain:"automation",service:"trigger"}:"script"===e?{domain:"script",service:"turn_on"}:"scene"===e?{domain:"scene",service:"turn_on"}:null}(t),s=this.hass.states[t];if(!i||!s)return void this._showToast(this._t("toast.run_target_missing"));const o=s.attributes?.friendly_name||t;return void n(this._t("confirm.tap_run",{name:o}),()=>{this.hass.callService(i.domain,i.service,{entity_id:t}).then(()=>this._showToast(this._t("toast.run_started",{name:o}))).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))})}if("cover"===l&&i){const t=function(t){const e=String(t||"");return"closed"===e?"open_cover":"open"===e?"close_cover":"opening"===e||"closing"===e?"stop_cover":"toggle"}(this.hass.states[i]?.state);return void n(this._t("confirm.tap_cover",{name:e.name}),()=>{this.hass.callService("cover",t,{entity_id:i}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))})}"toggle"===l&&e.primary?n(this._t("confirm.tap_toggle",{name:e.name}),()=>{this.hass.callService("homeassistant","toggle",{entity_id:e.primary}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))}):"more-info"===l&&e.primary?this._openMoreInfo(e.primary):this._infoCard=e}_t(t,e){return ao(ro(this.hass,this._config?.language),t,e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_contentItems(t){const e=[];for(const i of this._devices){if(i.space!==t.id||i.hidden)continue;const s=this._pos(i);e.push({minX:s.x,minY:s.y,maxX:s.x,maxY:s.y})}if(t.id===this._space){for(const t of this._openingsR){const i=Number(t.angle)*Math.PI/180,s=Math.cos(i)*t.rlen/2,o=Math.sin(i)*t.rlen/2,n=Co([[t.rx-s,t.ry-o],[t.rx+s,t.ry+o]]);n&&e.push(n)}const t=this._decorH;for(const i of this._decorList){const s=Co("line"===i.kind?[[i.x1*mn,i.y1*t],[i.x2*mn,i.y2*t]]:[[i.x*mn,i.y*t],[(i.x+(i.w||0))*mn,(i.y+(i.h||0))*t]]);s&&e.push(s)}}return zo(t,e)}_frameOf(){const t=this._spaceModel(),e=this._frame,i="view"!==this._mode;if(e&&e.id===t.id&&this._bdDrag)return e;if(e&&e.id===t.id&&e.model===t&&e.layout===this._layout&&e.devs===this._devices&&e.far===this._showFar&&e.grow===i)return e;const s=Eo(this._contentItems(t));let o=s.all||No(t),n=this._showFar?o:s.core||No(t);return e&&e.id===t.id&&i&&e.grow&&(n=fn(e.rect,n),o=fn(e.all,o)),this._frame={id:t.id,model:t,layout:this._layout,devs:this._devices,far:this._showFar,grow:i,rect:n,all:o,outliers:s.outliers},this._frame}_baseVb(){const t=this._frameOf().rect;return[t.x,t.y,t.w,t.h]}get _outliers(){return this._showFar?0:this._frameOf().outliers}_fitFar(){this._showFar=!0,this._frame=null,this._resetZoom()}_fitAll(){this._resetZoom()}_renderFarHint(){return this._kiosk||"view"!==this._mode||this._booting||!this._outliers?V:B`<div class="farhint">
      <ha-icon icon="mdi:map-marker-alert-outline"></ha-icon>
      <span>${this._t("canvas.far_objects",{n:this._outliers})}</span>
      <button class="btn ghostbtn" @click=${()=>this._fitFar()}>${this._t("canvas.show_far")}</button>
    </div>`}_renderHomeArrow(){if(this._booting)return V;const t=this._view;if(!t||!t.w||!t.h)return V;const e=this._frameOf().rect;if(!(e.x+e.w<=t.x||e.x>=t.x+t.w||e.y+e.h<=t.y||e.y>=t.y+t.h))return V;const i=Math.atan2(e.y+e.h/2-(t.y+t.h/2),e.x+e.w/2-(t.x+t.w/2)),s=50+38*Math.cos(i),o=50+38*Math.sin(i);return B`<button class="homearrow" title=${this._t("canvas.home_tip")}
      style="left:${s.toFixed(1)}%;top:${o.toFixed(1)}%"
      @click=${t=>{t.stopPropagation(),this._fitAll()}}>
      <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${(180*i/Math.PI).toFixed(1)}deg)"></ha-icon>
    </button>`}_stageAspect(){const t=this._stageEl,e=this._baseVb();return t&&t.clientHeight?t.clientWidth/t.clientHeight:e[2]/e[3]}_viewOr(t){return this._view&&this._view.w?this._view:Ke(t,this._stageAspect())}_screenToVb(t,e){const i=this._stageEl,s=this._viewOr(this._baseVb()),o=i?.clientWidth||1,n=i?.clientHeight||1;return[s.x+t/o*s.w,s.y+e/n*s.h]}_clampView(t,e){const i=(t,e,i,s)=>{const o=1*Math.max(e,s),n=i-o,r=i+s-e+o;return Math.max(Math.min(n,r),Math.min(Math.max(n,r),t))};return{w:t.w,h:t.h,x:i(t.x,t.w,e.x,e.w),y:i(t.y,t.h,e.y,e.h)}}_applyView(t,e,i){const s=this._baseVb(),o=Ke(s,this._stageAspect()),n=Math.min(wn.ZOOM_MAX,Math.max(wn.ZOOM_MIN,t)),r=o.w/n,a=o.h/n,l=this._viewOr(s),c=e??l.x+l.w/2,h=i??l.y+l.h/2;this._zoom=n,this._view=this._clampView({x:c-r/2,y:h-a/2,w:r,h:a},o)}_bootWatch(){clearTimeout(this._bootTimer),this._bootStart=Date.now(),this._bootLastH=-1,this._bootLastChange=this._bootStart;const t=()=>{if(!this._booting)return;const e=Date.now(),i=this._stageEl?this._stageEl.clientHeight:0;i!==this._bootLastH&&(this._bootLastH=i,this._bootLastChange=e);const s=e-this._bootStart;s>=1200||s>=700&&i>0&&e-this._bootLastChange>=250?this._bootSettled():this._bootTimer=window.setTimeout(t,100)};this._bootTimer=window.setTimeout(t,100)}_bootSettled(){if(!this._booting)return;this._refitView(),this._booting=!1;const t=this._stageEl?.clientHeight??0;!this._config?.kiosk&&t>0&&this._warmPatch({hdrH:this._hdrH,stageH:t,vp:this._warmViewportState()},!0),this._bootFading=!0,this._bootTimer=window.setTimeout(()=>{this._bootFading=!1},220),this._bootSoft=!0,clearTimeout(this._bootSoftTimer),this._bootSoftTimer=window.setTimeout(()=>{this._bootSoft=!1},rn)}_bootSoftCancel(){this._bootSoft&&(clearTimeout(this._bootSoftTimer),this._bootSoft=!1)}_refitView(){if(!this._stageEl)return;const t=this._view;this._applyView(this._zoom,t?t.x+t.w/2:void 0,t?t.y+t.h/2:void 0),this.requestUpdate()}_zoomAt(t,e,i){const s=this._stageEl;if(!s)return;const o=Ke(this._baseVb(),this._stageAspect()),n=Math.min(wn.ZOOM_MAX,Math.max(wn.ZOOM_MIN,i)),r=s.clientWidth,a=s.clientHeight,l=this._screenToVb(t,e),c=o.w/n,h=o.h/n;this._zoom=n,this._view=this._clampView({x:l[0]-t/r*c,y:l[1]-e/a*h,w:c,h:h},o)}_onWheel(t){const e=this._stageEl;if(!e)return;t.preventDefault();const i=e.getBoundingClientRect(),s=t.deltaY<0?1.15:1/1.15;this._zoomAt(t.clientX-i.left,t.clientY-i.top,this._zoom*s),this._saveZoom()}_stepZoom(t){const e=this._stageEl;e&&(this._zoomAt(e.clientWidth/2,e.clientHeight/2,this._zoom*(t>0?1.4:1/1.4)),this._saveZoom())}_resetZoom(){const t=this._baseVb();this._zoom=1,this._view=Ke(t,this._stageAspect()),this._saveZoom()}_saveZoom(){if("view"===this._mode){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(un,JSON.stringify(this._zoomBySpace))}catch{}}}_restoreZoom(){const t=this._zoomBySpace[this._space]||1;this._zoom=t;const e=this._stageEl;if(e&&e.clientHeight){const e=this._baseVb();return this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),void this.requestUpdate()}this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const e=this._baseVb();this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),this.requestUpdate()})}_stagePointerDown(t){if(this._vacFit)return;if(this._kiosk&&(this._cyclePausedUntil=Date.now()+6e4,0===this._pointers.size?(this._swipeStart={x:t.clientX,y:t.clientY,id:t.pointerId},t.target.closest?.(".dev, .roomlabel, .oplock")||(clearTimeout(this._kioskHoldTimer),this._kioskHoldTimer=window.setTimeout(()=>{this._kioskDialog=!0,this._swipeStart=null},3e3))):(this._swipeStart=null,clearTimeout(this._kioskHoldTimer))),this._drag)return;if(this._markup&&t.target.closest?.(".roomlabel, .rlhandle, .rszhandle, .dev, .oplock, .op-hit, button"))return;if("devices"===this._mode&&t.target.closest(".dev"))return;if("decor"===this._mode&&this._decorPointerDown(t))return;this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=this._viewOr(this._baseVb());if(1===this._pointers.size)this._panStart={sx:t.clientX,sy:t.clientY,vx:e.x,vy:e.y},this._panLock=null,this._suppressClick=!1;else if(2===this._pointers.size){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y);this._pinchStart={dist:e,zoom:this._zoom},this._panStart=null,this._panLock=null}}get _swipeZone(){return this._kiosk&&this._zoom<=1.001&&this._model.length>1}_stagePointerMove(t){if(this._dtDrag?.pid!==t.pointerId)if(this._bdDrag?.pid!==t.pointerId)if(this._decorDraft?.pid!==t.pointerId)if(this._decorMove?.pid!==t.pointerId)if(this._pointers.has(t.pointerId)){if(this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this._markup&&1===this._pointers.size&&this._markupMove(t),this._pinchStart&&this._pointers.size>=2){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),s=(t[0].x+t[1].x)/2-i.left,o=(t[0].y+t[1].y)/2-i.top;this._zoomAt(s,o,this._pinchStart.zoom*e),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const e=t.clientX-this._panStart.sx,i=t.clientY-this._panStart.sy;Math.abs(e)+Math.abs(i)>4&&(this._suppressClick=!0,clearTimeout(this._holdTimer)),null===this._panLock&&Math.abs(e)+Math.abs(i)>8&&(this._panLock=this._swipeZone&&Math.abs(e)>1.5*Math.abs(i)?"swipe":"pan");const s=this._stageEl;if("pan"===this._panLock&&s){const t=this._baseVb(),o=this._viewOr(t),n=Ke(t,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-e/(s.clientWidth||1)*o.w,y:this._panStart.vy-i/(s.clientHeight||1)*o.h,w:o.w,h:o.h},n)}}}else this._markupMove(t);else this._decorMoveUpdate(t);else this._decorDraft={...this._decorDraft,b:this._snap(this._svgPoint(t),t)};else this._bdMove(t);else this._dtMove(t)}_stagePointerUp(t){if(this._kiosk){clearTimeout(this._kioskHoldTimer);const e=this._swipeStart;if(this._swipeStart=null,e&&e.id===t.pointerId){const i=t.clientX-e.x,s=t.clientY-e.y;if(Math.abs(i)+Math.abs(s)<8){const t=Date.now();t-this._lastTap<350&&this._resetZoom(),this._lastTap=t}const o="pan"===this._panLock?null:function(t,e,i,s,o,n=60){if(i>1.001||s.length<2)return null;if(Math.abs(t)<n||Math.abs(t)<1.5*Math.abs(e))return null;const r=s.indexOf(o);if(r<0)return null;const a=s.length;return t<0?s[(r+1)%a]:s[(r-1+a)%a]}(i,s,this._zoom,this._model.map(t=>t.id),this._space);o&&(this._slideTo(o,i<0?"left":"right"),this._saveNav(),this._suppressClick=!0,setTimeout(()=>this._suppressClick=!1,0),this._showKioskDots())}}if(this._dtDrag?.pid!==t.pointerId)if(this._bdDrag?.pid!==t.pointerId)if(this._decorDraft?.pid!==t.pointerId){if(this._decorMove?.pid===t.pointerId)return this._decorMove.moved&&this._saveConfig(),void(this._decorMove=null);this._pointers.delete(t.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,this._panLock=null,setTimeout(()=>this._suppressClick=!1,0))}else this._decorCommitDraft();else this._bdUp();else this._dtUp()}_clickRoom(t){var e;!this._suppressClick&&t.area&&(e="/config/areas/area/"+t.area,history.pushState(null,"",e),vn(window,"location-changed",{replace:!1}))}_pointerDown(t,e){if("plan"===this._mode)return;if("view"===this._mode)return this._holdFired=!1,clearTimeout(this._holdTimer),void(this._holdTimer=window.setTimeout(()=>{this._holdFired=!0,this._infoCard=e},600));t.preventDefault();const i=this._pos(e);this._drag={id:e.id,sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},yn(t),this._tip=null}_pointerMove(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const s=this._baseVb(),o=i.getBoundingClientRect(),n=this._viewOr(s),r=(t.clientX-this._drag.sx)/o.width*n.w,a=(t.clientY-this._drag.sy)/o.height*n.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0,clearTimeout(this._holdTimer));const l=ko(this._drag.ox+r),c=ko(this._drag.oy+a);this._savePos(e,l,c,t.shiftKey)}_pointerUp(t,e){if(clearTimeout(this._holdTimer),!this._drag||this._drag.id!==e.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=e.id,window.setTimeout(()=>this._drag=null,0))}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}get _noHover(){return wn._noHoverMq||wn._touchSeen}_notePointer(t){"touch"!==t.pointerType&&"pen"!==t.pointerType||(wn._touchSeen=!0,this._tip&&(this._tip=null))}_showTip(t,e,i,s,o){this._noHover||this._drag||(this._tip={x:t.clientX,y:t.clientY,title:e,meta:i,lqi:s,temp:o})}get _gridPitch(){return yo}get _cellCm(){const t=Number(this._curSpaceCfg?.cell_cm);return Number.isFinite(t)&&t>0?t:5}_fmtLen(t,e){const i=function(t,e,i,s){return Math.hypot(e[0]-t[0],e[1]-t[1])/i*s}(t,e,this._gridPitch,this._cellCm);return we(i,"mi"===this.hass?.config?.unit_system?.length)}get _curSpaceCfg(){const t=this._rszPreview;return t&&t.space===this._space?t.sp:this._serverCfg?.spaces.find(t=>t.id===this._space)}get _renderCfg(){const t=this._rszPreview;return t&&this._serverCfg?{...this._serverCfg,spaces:this._serverCfg.spaces.map(e=>e.id===t.space?t.sp:e)}:this._serverCfg}get _spaceH(){return this._curSpaceCfg,mn}get _segments(){const t=this._curSpaceCfg,e=this._spaceH;return Se(t?.rooms||[]).map(t=>[t[0]*mn,t[1]*e,t[2]*mn,t[3]*e])}_savedNav(){try{return JSON.parse(localStorage.getItem(_n)||"null")}catch{return null}}_saveNav(){try{localStorage.setItem(_n,JSON.stringify({space:this._space,mode:this._mode}))}catch{}}_setMode(t){if(this._kiosk&&"view"!==t)return;if(this._mode===t)return;if(this._bootSoftCancel(),("plan"===t||"decor"===t)&&!this._norm)return void this._showToast(this._t("toast.markup_needs_server"));const e=!this._spaceModel().bg&&"view"===t!=("view"===this._mode);if("view"===this._mode&&"view"!==t){const t=this._view;this._viewModeSnap={space:this._space,zoom:this._zoom,cx:t?t.x+t.w/2:void 0,cy:t?t.y+t.h/2:void 0}}if(this._mode=t,e&&(this._zoom=1,this._view=null),"view"===t){const t=this._viewModeSnap;this._viewModeSnap=null,t&&t.space===this._space?(this._zoom=t.zoom,this._view=null,requestAnimationFrame(()=>{this._stageEl&&"view"===this._mode&&this._space===t.space&&(this._applyView(t.zoom,t.cx,t.cy),this._saveZoom(),this.requestUpdate())})):t&&this._restoreZoom()}this._path=[],this._cursorPt=null,this._tool="draw",this._mergeSel=null,this._mergeDialog=null,this._splitSel=null,this._pendingSplit=null,this._selId=null,this._rszSel=null,this._rszDrag=null,this._rszLive=null,this._rszPreview=null,this._rszUndo=[],this._tip=null,this._decorDraft=null,this._decorSel=null,this._decorTool="select",this._bdDrag=null,this._dtDrag=null,this._dtBox=null,this._saveNav()}_svgPoint(t){const e=this.renderRoot.querySelector(".stage").getBoundingClientRect();return this._screenToVb(t.clientX-e.left,t.clientY-e.top)}_snap(t,e=!1){const i="boolean"==typeof e?e:!!e?.shiftKey,s=this._gridPitch;return i?[ko(t[0]),ko(t[1])]:[ko(ye(t[0],s)),ko(ye(t[1],s))]}_samePt(t,e){return Te(t,e)}_dropLegacySegments(){for(const t of this._serverCfg?.spaces||[])delete t.segments}get _cfgWriting(){return this._writesPending>0}_writeConfig(){this._writesPending++,this._writeChain=this._writeChain.catch(()=>{}).then(async()=>{if(!this._serverCfg)return;this._dropLegacySegments();const t=await this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev});this._cfgRev=t?.rev??this._cfgRev+1});return this._writeChain.finally(()=>{this._writesPending--})}_saveConfig(){this._cfgEpoch++,this._saveConfigDebounced()}_roomAt(t){return this._spaceModel().rooms.find(e=>{const i=xe(e);return!!i&&Ee(t,i)})}_overlapRoom(t){return this._spaceModel().rooms.find(e=>{const i=xe(e);return!!i&&He(t,i)})}_pointInRoom(t,e){return e.poly?ze(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_markupClick(t){if(this._vacFit)return;if(!this._markup)return;if(this._suppressClick)return;if(this._drag||this._rlResize)return;const e=t.composedPath?.()||[];if(e.some(t=>t?.classList?.contains?.("roomlabel")||t?.classList?.contains?.("rlhandle")))return;const i=this._svgPoint(t);if("resize"===this._tool){if(this._rszDrag||e.some(t=>t?.classList?.contains?.("rszhandle")))return;const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(i,t));return void(this._rszSel=t?.id||null)}if("delroom"===this._tool){const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(i,t));if(!t)return;if(!confirm(this._t("confirm.delete_room",{name:t.name})))return;const e=this._curSpaceCfg;return e.rooms=e.rooms.filter(e=>e.id!==t.id),this._saveConfig(),this._regSignature="",this._maybeRebuildDevices(),void this.requestUpdate()}if("opening"===this._tool)return void this._openingClick(i,t.shiftKey);if("merge"===this._tool)return void this._mergeClick(i);if("openwall"===this._tool)return void this._openWallClick(i);if("split"===this._tool)return void this._splitClick(i,t.shiftKey);const s=this._snap(i,t),o=this._path.length>=3&&this._samePt(s,this._path[0]);if(!this._path.length)return void(this._path=[s]);const n=this._path[this._path.length-1];if(!this._samePt(s,n)){if(o){const t=this._overlapRoom(this._path);return t?void this._showToast(this._t("toast.room_overlap",{name:t.name||""})):(this._path=[...this._path,s],this._cursorPt=null,this._nameSel="",this._areaSel="",this._resetRoomDialogFields(),void(this._roomDialog=!0))}this._path=[...this._path,s]}}_rszRooms(){const t=[];for(const e of this._spaceModel().rooms){const i=e.id?xe(e):null;i&&t.push({id:e.id,poly:i})}return t}_rszOpenings(){return this._openingsR.map(t=>({id:t.id,x:t.rx,y:t.ry,length:t.rlen}))}_rszOpts(){return{minDim:this._cmToUnits(30),eps:.05*this._gridPitch}}_rszSnapshot(){const t=this._curSpaceCfg;return JSON.stringify({rooms:t?.rooms||[],openings:t?.openings||[]})}_rszRestore(t){const e=this._serverCfg?.spaces.find(t=>t.id===this._space);if(!e)return;const i=JSON.parse(t);e.rooms=i.rooms,e.openings=i.openings,this._cfgEpoch++,this.requestUpdate()}_rszApplyPreview(t,e){const i=this._rszDrag,s=this._serverCfg?.spaces.find(t=>t.id===this._space);if(!i||!s)return;const o=JSON.parse(i.snap),n={...s,rooms:o.rooms,openings:o.openings},r=this._spaceH;for(const[e,i]of Object.entries(t)){const t=n.rooms.find(t=>t.id===e);t&&(t.poly=i.map(t=>[t[0]/mn,t[1]/r]),delete t.x,delete t.y,delete t.w,delete t.h)}for(const[t,i]of Object.entries(e)){const e=(n.openings||[]).find(e=>e.id===t);e&&(e.x=i[0]/mn,e.y=i[1]/r)}this._rszPreview={space:this._space,sp:n},this._cfgEpoch++}_rszEdgeDown(t,e,i){if("resize"!==this._tool||this._rszDrag)return;t.stopPropagation(),t.preventDefault(),yn(t);const s=this._rszRooms(),o=function(t,e,i){const s=t.find(t=>t.id===e);if(!s||!s.poly||s.poly.length<3)return null;if(i<0||i>=s.poly.length)return null;const o=[...s.poly[i]],n=[...s.poly[(i+1)%s.poly.length]];return{roomId:e,edge:i,a:o,b:n,n:Yi(s.poly,i)}}(s,e,i);o&&(this._rszDrag={kind:"edge",pid:t.pointerId,roomId:e,plan:o,rooms:s,openings:this._rszOpenings(),snap:this._rszSnapshot(),moved:!1,d:0,k:1,changed:[]})}_rszCornerDown(t,e,i,s){"resize"!==this._tool||this._rszDrag||(t.stopPropagation(),t.preventDefault(),yn(t),this._rszDrag={kind:"scale",pid:t.pointerId,roomId:e,fixed:s,span0:Math.hypot(i[0]-s[0],i[1]-s[1])||1,rooms:this._rszRooms(),openings:this._rszOpenings(),snap:this._rszSnapshot(),moved:!1,d:0,k:1,changed:[]})}_rszMove(t){const e=this._rszDrag;if(!e||e.pid!==t.pointerId)return;t.stopPropagation();const i=this._svgPoint(t);if("edge"===e.kind){const s=e.plan,o=(i[0]-s.a[0])*s.n[0]+(i[1]-s.a[1])*s.n[1],n=this._snap([s.a[0]+s.n[0]*o,s.a[1]+s.n[1]*o],t);let r=(n[0]-s.a[0])*s.n[0]+(n[1]-s.a[1])*s.n[1];if(r=function(t,e,i,s,o,n){if(!Number.isFinite(s)||Math.abs(s)<1e-9)return 0;const r=Math.sign(s);let a=Math.abs(s);const l=Math.max(o,1e-6);for(let s=0;s<4096&&a>1e-9;s++,a-=l){const s=r*a;if(rs(t,e,i,s,n))return s}return 0}(e.rooms,e.openings,s,r,this._gridPitch,this._rszOpts()),r===e.d&&e.moved)return;e.d=r,e.moved=!0;const a=ss(e.rooms,e.openings,s,r,this._rszOpts().eps);e.changed=Object.keys(a.polys),this._rszApplyPreview(a.polys,a.openings),this._rszLive=this._rszEdgeLabels(a,s)}else{const s=e.fixed,o=this._snap(i,t);let n=Math.hypot(o[0]-s[0],o[1]-s[1])/(e.span0||1);if(n=Math.max(.05,Math.min(20,n)),n=function(t,e,i,s,o,n){if(!Number.isFinite(o)||o<=0)return 1;if(ls(t,e,i,s,o,n))return o;let r=1,a=o;for(let o=0;o<28;o++){const o=(r+a)/2;ls(t,e,i,s,o,n)?r=o:a=o}return r}(e.rooms,e.openings,e.roomId,s,n,this._rszOpts()),n===e.k&&e.moved)return;e.k=n,e.moved=!0;const r=e.rooms.find(t=>t.id===e.roomId),a=e.rooms.filter(t=>t.id!==e.roomId).map(t=>t.poly),l=as(r,e.openings,a,s,n,2*this._rszOpts().eps);e.changed=[e.roomId],this._rszApplyPreview({[e.roomId]:l.poly},l.openings),this._rszLive=this._rszScaleLabels(l.poly)}this.requestUpdate()}_rszUp(t){const e=this._rszDrag;if(!e||e.pid!==t.pointerId)return;t.stopPropagation();const i=this._rszPreview;this._rszDrag=null,this._rszLive=null,this._rszPreview=null;if(!(e.moved&&("edge"===e.kind?Math.abs(e.d)>1e-9:Math.abs(e.k-1)>1e-9))||!i)return this._cfgEpoch++,void this.requestUpdate();const s=this._curSpaceCfg;if(s){s.rooms=i.sp.rooms,s.openings=i.sp.openings;for(const t of e.changed){const e=s.rooms.find(e=>e.id===t);e?.poly&&(e.poly=Qi(e.poly,1e-9))}}this._rszUndo.push({space:this._space,snap:e.snap}),this._rszUndo.length>30&&this._rszUndo.shift(),this._suppressClick=!0,setTimeout(()=>this._suppressClick=!1,0),this._saveConfig(),this.requestUpdate()}_rszCancelDrag(){this._rszDrag&&(this._rszDrag=null,this._rszLive=null,this._rszPreview=null,this._cfgEpoch++,this.requestUpdate())}_rszPointerCancel(t){const e=this._rszDrag;e&&e.pid===t.pointerId&&(t.stopPropagation(),this._rszCancelDrag())}_rszUndoPop(){for(let t=this._rszUndo.length-1;t>=0;t--){if(this._rszUndo[t].space!==this._space)continue;const[e]=this._rszUndo.splice(t,1);return this._rszRestore(e.snap),void this._saveConfig()}}_rszEdgeLabels(t,e){const i=this._rszDrag,s=[],o=t.polys[e.roomId]||i.rooms.find(t=>t.id===e.roomId).poly,n=o.length,r=e.edge,a=(r+1)%n;for(const[t,e]of[[o[(r-1+n)%n],o[r]],[o[r],o[a]],[o[a],o[(a+1)%n]]])s.push({x:(t[0]+e[0])/2,y:(t[1]+e[1])/2,text:this._fmtLen(t,e)});const l="mi"===this.hass?.config?.unit_system?.length,c=Object.keys(t.polys).length?Object.keys(t.polys):[e.roomId];for(const e of c){const o=t.polys[e]||i.rooms.find(t=>t.id===e).poly,n=Ie(o);s.push({x:n[0],y:n[1],text:hs(cs(o,this._gridPitch,this._cellCm),l),area:!0})}return s}_rszScaleLabels(t){const e="mi"===this.hass?.config?.unit_system?.length,i=t.map(t=>t[0]),s=t.map(t=>t[1]),o=Math.max(...i)-Math.min(...i),n=Math.max(...s)-Math.min(...s),r=Ie(t);return[{x:Math.min(...i),y:Math.min(...s),text:`${this._fmtLen([0,0],[o,0])} × ${this._fmtLen([0,0],[n,0])}`},{x:r[0],y:r[1],text:hs(cs(t,this._gridPitch,this._cellCm),e),area:!0}]}_renderResizeLayer(t){const e=Math.max(.013*t.w,5),i=e/2,s=t=>t.toFixed(1),o=`M ${s(-.7*i)} 0 H ${s(.7*i)} M 0 ${s(-.22*i)} V ${s(-i)} M ${s(-.32*i)} ${s(-.6*i)} L 0 ${s(-i)} L ${s(.32*i)} ${s(-.6*i)} M 0 ${s(.22*i)} V ${s(i)} M ${s(-.32*i)} ${s(.6*i)} L 0 ${s(i)} L ${s(.32*i)} ${s(.6*i)}`,n=[],r=this._rszRooms();for(const t of r)for(let i=0;i<t.poly.length;i++){const r=t.poly[i],a=t.poly[(i+1)%t.poly.length];if(Math.hypot(a[0]-r[0],a[1]-r[1])<this._gridPitch)continue;const l=s((r[0]+a[0])/2),c=s((r[1]+a[1])/2),h=s(180*Math.atan2(a[1]-r[1],a[0]-r[0])/Math.PI);n.push(j`<circle class="rszhandle" cx="${l}" cy="${c}" r="${s(e)}"
          @pointerdown=${e=>this._rszEdgeDown(e,t.id,i)}
          @pointermove=${t=>this._rszMove(t)}
          @pointerup=${t=>this._rszUp(t)}
          @pointercancel=${t=>this._rszPointerCancel(t)}
          @lostpointercapture=${t=>this._rszPointerCancel(t)}></circle>`),n.push(j`<g class="rszicon" transform="translate(${l} ${c}) rotate(${h})"><path class="rszhalo" d="${o}"></path><path class="rszink" d="${o}"></path></g>`)}const a=this._rszSel?r.find(t=>t.id===this._rszSel):null;if(a){const t=a.poly.map(t=>t[0]),i=a.poly.map(t=>t[1]),s=Math.min(...t),o=Math.max(...t),r=Math.min(...i),l=Math.max(...i);n.push(j`<rect class="rszframe" x="${s}" y="${r}" width="${o-s}" height="${l-r}"></rect>`);for(const[t,i,c,h]of[[s,r,o,l],[o,r,s,l],[o,l,s,r],[s,l,o,r]])n.push(j`<circle class="rszhandle rszcorner" cx="${t}" cy="${i}" r="${(1.15*e).toFixed(1)}"
          @pointerdown=${e=>this._rszCornerDown(e,a.id,[t,i],[c,h])}
          @pointermove=${t=>this._rszMove(t)}
          @pointerup=${t=>this._rszUp(t)}
          @pointercancel=${t=>this._rszPointerCancel(t)}
          @lostpointercapture=${t=>this._rszPointerCancel(t)}></circle>`)}return j`${n}`}get _openingsR(){const t=this._curSpaceCfg,e=this._spaceH;return(t?.openings||[]).map(t=>({...t,rx:t.x*mn,ry:t.y*e,rlen:t.length*mn}))}_cmToUnits(t){return t/this._cellCm*this._gridPitch}get _decorList(){const t=this._curSpaceCfg;return Array.isArray(t?.decor)?t.decor:[]}get _decorH(){return mn}_decorPointerDown(t){const e=this._decorTool;if("select"===e||"erase"===e?t.target.closest?.(".dshape"):null)return!0;if("line"===e||"rect"===e||"ellipse"===e){t.preventDefault();const i=this._snap(this._svgPoint(t),t);return this._decorDraft={kind:e,a:i,b:i,pid:t.pointerId},yn(t),!0}if("text"===e){const e=this._snap(this._svgPoint(t),t);return this._decorTextDialog={x:So(e[0]/mn),y:So(e[1]/this._decorH),text:"",color:this._decorStyle.color},!0}if(this._decorSel=null,this._bdMovable){const e=this._bdRect,i=this._svgPoint(t);if(i[0]>=e.x&&i[0]<=e.x+e.w&&i[1]>=e.y&&i[1]<=e.y+e.h)return t.preventDefault(),this._bdStart(t)}return!1}_decorCommitDraft(){const t=this._decorDraft;if(this._decorDraft=null,!t)return;const e=.5*this._gridPitch;if(Math.hypot(t.b[0]-t.a[0],t.b[1]-t.a[1])<e)return;const i=mn,s=this._decorH,o=this._decorStyle,n="dc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),r=So;let a;if("line"===t.kind)a={id:n,kind:"line",x1:r(t.a[0]/i),y1:r(t.a[1]/s),x2:r(t.b[0]/i),y2:r(t.b[1]/s),color:o.color,width:o.width};else{const e=r(Math.min(t.a[0],t.b[0])/i),l=r(Math.min(t.a[1],t.b[1])/s),c=Math.abs(t.b[0]-t.a[0])/i,h=Math.abs(t.b[1]-t.a[1])/s;a={id:n,kind:t.kind,x:e,y:l,w:c,h:h,color:o.color,width:o.width,fill:o.fill}}this._curSpaceCfg.decor=[...this._decorList,a],this._decorSel=n,this._saveConfig(),this.requestUpdate()}_decorShapeDown(t,e){if("decor"!==this._mode)return;const i=this._decorTool;if("text"===i){if("text"!==e.kind)return;return t.stopPropagation(),t.preventDefault(),void this._decorOpenText(e)}if("select"===i||"erase"===i){if(t.stopPropagation(),t.preventDefault(),"erase"===i){return this._curSpaceCfg.decor=this._decorList.filter(t=>t.id!==e.id),this._decorSel===e.id&&(this._decorSel=null),this._saveConfig(),void this.requestUpdate()}this._decorSel=e.id,this._decorMove={id:e.id,start:this._svgPoint(t),orig:JSON.parse(JSON.stringify(e)),pid:t.pointerId,moved:!1},yn(t)}}_decorMoveUpdate(t){const e=this._decorMove,i=this._svgPoint(t),s=e.orig,o=("line"===s.kind?s.x1:s.x)*mn,n=("line"===s.kind?s.y1:s.y)*this._decorH,r=this._snap([o+(i[0]-e.start[0]),n+(i[1]-e.start[1])],t);let a=(r[0]-o)/mn,l=(r[1]-n)/this._decorH;const c=e.orig,h="line"===c.kind?Math.min(c.x1,c.x2):c.x,d="line"===c.kind?Math.min(c.y1,c.y2):c.y,p="line"===c.kind?Math.abs(c.x2-c.x1):c.w||0,u="line"===c.kind?Math.abs(c.y2-c.y1):c.h||0,_=fo;a=Math.max(-_-h,Math.min(_-h-p,a)),l=Math.max(-_-d,Math.min(_-d-u,l)),(a||l)&&(e.moved=!0);this._curSpaceCfg.decor=this._decorList.map(t=>{if(t.id!==e.id)return t;const i=e.orig;return"line"===t.kind?{...t,x1:i.x1+a,y1:i.y1+l,x2:i.x2+a,y2:i.y2+l}:{...t,x:i.x+a,y:i.y+l}}),this.requestUpdate()}_decorShapeDbl(t){"decor"===this._mode&&"select"===this._decorTool&&"text"===t.kind&&this._decorOpenText(t)}_decorOpenText(t){this._decorTextDialog={id:t.id,x:t.x,y:t.y,text:t.text,color:t.color,entity:t.entity||"",attr:t.attr||"",unit:t.unit||""}}_decorTextLink(t){const e={},i=(t.entity||"").trim();if(!i)return e;e.entity=i;const s=(t.attr||"").trim();s&&(e.attr=s);const o=(t.unit||"").trim();return o&&(e.unit=o),e}_decorSaveText(){const t=this._decorTextDialog,e=String(t?.text??"").replace(/\r\n?/g,"\n").trim();if(!t||!e)return void(this._decorTextDialog=null);const i=this._curSpaceCfg,s=this._decorTextLink(t);if(t.id)i.decor=this._decorList.map(i=>{if(i.id!==t.id)return i;const{entity:o,attr:n,unit:r,...a}=i;return{...a,text:e,color:t.color,...s}});else{const o="dc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);i.decor=[...this._decorList,{id:o,kind:"text",x:t.x,y:t.y,text:e,color:t.color,...s}],this._decorSel=o}this._decorTextDialog=null,this._saveConfig(),this.requestUpdate()}get _dtSel(){if("decor"!==this._mode||"select"!==this._decorTool||!this._decorSel)return null;const t=this._decorList.find(t=>t.id===this._decorSel);return t&&"text"===t.kind?t:null}_dtApply(t,e){const i=this._curSpaceCfg;i&&(i.decor=this._decorList.map(i=>{if(i.id!==t)return i;const{size:s,...o}=i,n={...o};return void 0!==e.scale?n.scale=Number(e.scale.toFixed(4)):void 0===i.scale&&void 0!==s&&(n.scale=ci(i)),void 0!==e.angle&&(e.angle?n.angle=Number(e.angle.toFixed(2)):delete n.angle),n}),this._cfgEpoch++,this.requestUpdate())}_dtStart(t,e){const i=this._dtSel;if(!i)return;t.stopPropagation(),t.preventDefault();const s=i.x*mn,o=i.y*this._decorH,n=this._svgPoint(t);this._dtDrag={id:i.id,kind:e,pid:t.pointerId,ax:s,ay:o,r0:Math.hypot(n[0]-s,n[1]-o),a0:180*Math.atan2(n[1]-o,n[0]-s)/Math.PI,scale0:ci(i),angle0:Number(i.angle)||0,moved:!1},yn(t)}_dtMove(t){const e=this._dtDrag;if(!e)return;const i=this._svgPoint(t);if("scale"===e.kind){const t=Math.hypot(i[0]-e.ax,i[1]-e.ay);if(e.r0<1e-6)return;const s=Math.min(20,Math.max(.15,e.scale0*(t/e.r0)));return Math.abs(s-e.scale0)>1e-6&&(e.moved=!0),void this._dtApply(e.id,{scale:s})}const s=180*Math.atan2(i[1]-e.ay,i[0]-e.ax)/Math.PI;let o=e.angle0+(s-e.a0);t.shiftKey||(o=5*Math.round(o/5)),o=(o%360+360)%360,o>180&&(o-=360),Math.abs(o-e.angle0)>1e-6&&(e.moved=!0),this._dtApply(e.id,{angle:o})}_dtUp(){const t=this._dtDrag;this._dtDrag=null,t?.moved&&this._saveConfig(),this.requestUpdate()}_dtMeasure(){const t=this._dtSel;if(!t)return void(this._dtBox&&(this._dtBox=null,this.requestUpdate()));const e=this.renderRoot.querySelector(`text.dtext[data-id="${t.id}"]`);if(!e||"function"!=typeof e.getBBox)return;let i;try{i=e.getBBox()}catch{return}if(!i||!i.width&&!i.height)return;const s={id:t.id,x:i.x,y:i.y,w:i.width,h:i.height},o=this._dtBox;o&&o.id===s.id&&Math.abs(o.x-s.x)<.01&&Math.abs(o.y-s.y)<.01&&Math.abs(o.w-s.w)<.01&&Math.abs(o.h-s.h)<.01||(this._dtBox=s,this.requestUpdate())}_decorDeleteSel(){if(!this._decorSel)return;this._curSpaceCfg.decor=this._decorList.filter(t=>t.id!==this._decorSel),this._decorSel=null,this._saveConfig(),this.requestUpdate()}get _bdBase(){const t=this._curSpaceCfg;return t?.plan_url?{...po(t.plan_aspect,mn)}:null}get _bdRect(){const t=this._curSpaceCfg;return t?.plan_url?_o(t,mn):null}get _bdParams(){const t=this._curSpaceCfg,e=Number(t?.plan_x),i=Number(t?.plan_y),s=Number(t?.plan_scale);return{dx:Number.isFinite(e)?e:0,dy:Number.isFinite(i)?i:0,k:Number.isFinite(s)&&s>0?s:1}}get _bdActive(){return"decor"===this._mode&&!!this._bdRect&&("select"===this._decorTool||"backdrop"===this._decorTool)}get _bdMovable(){return"decor"===this._mode&&"backdrop"===this._decorTool&&!!this._bdRect}_bdApply(t,e,i){const s=this._curSpaceCfg;s&&(s.plan_x=Number(So(t).toFixed(6)),s.plan_y=Number(So(e).toFixed(6)),s.plan_scale=Number(Math.min(100,Math.max(uo,i)).toFixed(6)),this._cfgEpoch++,this.requestUpdate())}_bdStart(t,e){const i=this._bdBase,s=this._bdRect;if(!i||!s)return!1;const o=this._svgPoint(t),n=e?e[0]:0,r=e?e[1]:0,a=n>0?s.x:s.x+s.w,l=r>0?s.y:s.y+s.h;return this._bdDrag={kind:e?"scale":"move",pid:t.pointerId,sx:o[0],sy:o[1],base:i,p0:this._bdParams,fx:a,fy:l,sgx:n,sgy:r,moved:!1},yn(t),!0}_bdMove(t){const e=this._bdDrag;if(!e)return;const i=this._svgPoint(t),s=e.base;if("move"===e.kind){const o=s.x+e.p0.dx*mn,n=s.y+e.p0.dy*mn,r=this._snap([o+(i[0]-e.sx),n+(i[1]-e.sy)],t);return(Math.abs(r[0]-o)>1e-9||Math.abs(r[1]-n)>1e-9)&&(e.moved=!0),void this._bdApply((r[0]-s.x)/mn,(r[1]-s.y)/mn,e.p0.k)}const o=s.w||1,n=s.h||1;let r=Math.max(Math.abs(i[0]-e.fx)/o,Math.abs(i[1]-e.fy)/n);if(!t.shiftKey){const t=o>=n,i=ye(t?e.fx+e.sgx*r*o:e.fy+e.sgy*r*n,this._gridPitch),s=Math.abs(i-(t?e.fx:e.fy))/(t?o:n);s>0&&(r=s)}r=Math.min(100,Math.max(uo,r)),Math.abs(r-e.p0.k)>1e-9&&(e.moved=!0);const a=e.sgx>0?e.fx:e.fx-r*o,l=e.sgy>0?e.fy:e.fy-r*n;this._bdApply((a-s.x)/mn,(l-s.y)/mn,r)}get _bdMoved(){if("decor"!==this._mode||!this._bdRect)return!1;const t=this._bdParams;return 0!==t.dx||0!==t.dy||1!==t.k}_bdReset(){const t=this._curSpaceCfg;t&&(delete t.plan_x,delete t.plan_y,delete t.plan_scale,this._bdDrag=null,this._saveConfig(),this._showToast(this._t("decor.backdrop_reset_done")),this.requestUpdate())}_bdUp(){const t=this._bdDrag;this._bdDrag=null,t?.moved&&this._saveConfig(),this.requestUpdate()}get _bdLive(){if(!this._bdDrag)return null;const t=this._bdRect;return t?{x:t.x+t.w/2,y:t.y+t.h/2,text:`${this._fmtLen([0,0],[t.w,0])} × ${this._fmtLen([0,0],[0,t.h])}`}:null}_renderBackdropFrame(t){const e=this._bdRect;if(!this._bdActive||!e)return V;const i=.02*Math.max(t.w,t.h);return j`<g class="bdframe">
      <rect class="bdbox" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}"></rect>
      ${[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]].map(([t,s,o])=>j`<circle
        class="bdhandle bd-${o}" data-corner="${t+","+s}"
        cx="${t<0?e.x:e.x+e.w}" cy="${s<0?e.y:e.y+e.h}" r="${i.toFixed(1)}"
        @pointerdown=${e=>{e.stopPropagation(),e.preventDefault(),this._bdStart(e,[t,s])}}></circle>`)}
    </g>`}_renderTextFrame(t){const e=this._dtSel,i=this._dtBox;if(!e||!i||i.id!==e.id)return V;const s=.018*Math.max(t.w,t.h),o=e.x*mn,n=e.y*this._decorH,r=Number(e.angle)||0,a=2.2*s;return j`<g class="dtframe" transform=${r?`rotate(${r} ${o} ${n})`:V}>
      <rect class="dtbox" x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}"></rect>
      <line class="dtstem" x1="${i.x+i.w/2}" y1="${i.y}" x2="${i.x+i.w/2}" y2="${i.y-a}"></line>
      <circle class="dthandle dtrot" cx="${i.x+i.w/2}" cy="${i.y-a}" r="${s.toFixed(1)}"
        @pointerdown=${t=>this._dtStart(t,"rotate")}></circle>
      ${[[-1,-1,"nwse"],[1,-1,"nesw"],[1,1,"nwse"],[-1,1,"nesw"]].map(([t,e,o])=>j`<circle class="dthandle dt-${o}"
        cx="${t<0?i.x:i.x+i.w}" cy="${e<0?i.y:i.y+i.h}" r="${s.toFixed(1)}"
        @pointerdown=${t=>this._dtStart(t,"scale")}></circle>`)}
    </g>`}_renderDecorLayer(){const t=mn,e=this._decorH,i="decor"===this._mode,s=this._decorList.map(s=>{const o="dshape"+(i&&this._decorSel===s.id?" dsel":""),n=t=>this._decorShapeDown(t,s),r=()=>this._decorShapeDbl(s);if("line"===s.kind)return j`<line class="${o}" x1="${s.x1*t}" y1="${s.y1*e}" x2="${s.x2*t}" y2="${s.y2*e}"
          stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" @pointerdown=${n}></line>`;if("rect"===s.kind)return j`<rect class="${o}" x="${s.x*t}" y="${s.y*e}" width="${s.w*t}" height="${s.h*e}"
          stroke="${s.color}" stroke-width="${s.width}"
          fill="${s.fill?s.color:"none"}" fill-opacity="${s.fill?.25:0}" @pointerdown=${n}></rect>`;if("ellipse"===s.kind)return j`<ellipse class="${o}" cx="${(s.x+s.w/2)*t}" cy="${(s.y+s.h/2)*e}"
          rx="${s.w/2*t}" ry="${s.h/2*e}" stroke="${s.color}" stroke-width="${s.width}"
          fill="${s.fill?s.color:"none"}" fill-opacity="${s.fill?.25:0}" @pointerdown=${n}></ellipse>`;if("text"===s.kind){const i=20*ci(s),a=hi(li(s.text,s,this.hass)),l=s.x*t,c=s.y*e,h=Number(s.angle)||0,d=c-(a.length-1)*i*1.2/2;return j`<text class="${o} dtext" data-id="${s.id}" x="${l}" y="${c}" fill="${s.color}"
          font-size="${i}" transform=${h?`rotate(${h} ${l} ${c})`:V}
          @pointerdown=${n} @dblclick=${r}>${a.map((t,e)=>j`<tspan x="${l}" y="${d+e*i*1.2}">${t}</tspan>`)}</text>`}return V});let o=V;const n=this._decorDraft;if(n){const t=this._decorStyle;if("line"===n.kind)o=j`<line class="ddraft" x1="${n.a[0]}" y1="${n.a[1]}" x2="${n.b[0]}" y2="${n.b[1]}"
          stroke="${t.color}" stroke-width="${t.width}" stroke-linecap="round" stroke-linejoin="round"></line>`;else{const e=Math.min(n.a[0],n.b[0]),i=Math.min(n.a[1],n.b[1]),s=Math.abs(n.b[0]-n.a[0]),r=Math.abs(n.b[1]-n.a[1]);o="rect"===n.kind?j`<rect class="ddraft" x="${e}" y="${i}" width="${s}" height="${r}" stroke="${t.color}"
              stroke-width="${t.width}" fill="${t.fill?t.color:"none"}" fill-opacity="${t.fill?.15:0}"></rect>`:j`<ellipse class="ddraft" cx="${e+s/2}" cy="${i+r/2}" rx="${s/2}" ry="${r/2}"
              stroke="${t.color}" stroke-width="${t.width}" fill="${t.fill?t.color:"none"}" fill-opacity="${t.fill?.15:0}"></ellipse>`}}return j`<g class="decorlayer">${s}${o}</g>`}_renderDecorBar(){const t=[["select","mdi:cursor-default-outline","decor.select"],...this._bdRect?[["backdrop","mdi:image-move","decor.backdrop"]]:[],["line","mdi:vector-line","decor.line"],["rect","mdi:rectangle-outline","decor.rect"],["ellipse","mdi:ellipse-outline","decor.ellipse"],["text","mdi:format-text","decor.text"],["erase","mdi:eraser","decor.erase"]];return B`<div class="editbar decorbar">
      <ha-icon icon="mdi:draw" class="warn"></ha-icon>
      ${t.map(([t,e,i])=>B`<button class="btn dtool ${this._decorTool===t?"on":""}"
          @click=${()=>{this._decorTool=t,this._decorDraft=null}}
          title=${this._t(i)}>
          <ha-icon icon=${e}></ha-icon><span class="ml">${this._t(i)}</span>
        </button>`)}
      <input type="color" class="dcolor" .value=${this._decorStyle.color}
        title=${this._t("decor.color")}
        @input=${t=>this._decorStyle={...this._decorStyle,color:t.target.value}} />
      <select class="dwidth" title=${this._t("decor.width")}
        @change=${t=>this._decorStyle={...this._decorStyle,width:Number(t.target.value)}}>
        ${[[1.5,"decor.w_thin"],[3,"decor.w_mid"],[6,"decor.w_thick"]].map(([t,e])=>B`<option value=${t} ?selected=${this._decorStyle.width===t}>${this._t(e)}</option>`)}
      </select>
      <label class="dfill"><input type="checkbox" .checked=${this._decorStyle.fill}
        @change=${t=>this._decorStyle={...this._decorStyle,fill:t.target.checked}} />
        ${this._t("decor.fill")}</label>
      ${""}
      ${this._bdMoved&&!this._bdDrag?B`<button class="btn bdreset" title=${this._t("decor.backdrop_reset")}
            @click=${()=>this._bdReset()}>
            <ha-icon icon="mdi:image-refresh-outline"></ha-icon><span class="ml">${this._t("decor.backdrop_reset")}</span>
          </button>`:V}
      <span class="spacer"></span>
      ${this._bdMovable?B`<span class="bdhint">${this._t("decor.backdrop_hint")}</span>`:V}
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_renderDecorTextDialog(){const t=this._decorTextDialog,e=(t.entity||"").trim(),i=e?this.hass?.states?.[e]:null,s=String(i?.attributes?.unit_of_measurement??""),o=li(t.text,t,this.hass);return B`<div class="menuwrap dialogwrap" @click=${()=>this._decorTextDialog=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:format-text"></ha-icon>${this._t("decor.text_title")}</div>
        <div class="body">
          <label>${this._t("decor.text_label")}</label>
          ${""}
          <textarea class="namein dtarea" rows="3" maxlength="200" .value=${t.text} autofocus
            @input=${e=>this._decorTextDialog={...t,text:e.target.value}}
            @keydown=${t=>{t.stopPropagation(),"Enter"===t.key&&(t.ctrlKey||t.metaKey)&&this._decorSaveText()}}></textarea>
          <div class="rhint">${this._t(e?"decor.text_hint_live":"decor.text_hint")}</div>
          <label>${this._t("decor.color")}</label>
          <input type="color" .value=${t.color}
            @input=${e=>this._decorTextDialog={...t,color:e.target.value}} />
          <label class="dispsection">${this._t("decor.live_group")}</label>
          <div class="rhint">${this._t("decor.live_hint")}</div>
          <label>${this._t("decor.live_entity")}</label>
          <input class="namein" type="text" list="hp-dtext-ents" placeholder=${this._t("decor.live_entity_ph")}
            .value=${t.entity||""}
            @input=${e=>this._decorTextDialog={...t,entity:e.target.value}} />
          <datalist id="hp-dtext-ents">
            ${Object.keys(this.hass?.states||{}).map(t=>B`<option value=${t}></option>`)}
          </datalist>
          ${e?B`
            <label>${this._t("decor.live_attr")}</label>
            <input class="namein" type="text" list="hp-dtext-attrs" placeholder=${this._t("decor.live_attr_ph")}
              .value=${t.attr||""}
              @input=${e=>this._decorTextDialog={...t,attr:e.target.value}} />
            <datalist id="hp-dtext-attrs">
              ${Object.keys(i?.attributes||{}).map(t=>B`<option value=${t}></option>`)}
            </datalist>
            <label>${this._t("decor.live_unit")}</label>
            <input class="namein" type="text" .value=${t.unit||""}
              placeholder=${(t.attr||"").trim()?"":s}
              @input=${e=>this._decorTextDialog={...t,unit:e.target.value}} />
            <label>${this._t("decor.live_preview")}</label>
            <div class="dtpreview">${hi(o).map(t=>B`<div>${t}</div>`)}</div>
          `:V}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._decorTextDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn primary" ?disabled=${!t.text.trim()} @click=${()=>this._decorSaveText()}>${this._t("btn.save")}</button>
        </div>
      </div>
    </div>`}get _openWallHover(){if(!this._markup||"openwall"!==this._tool||!this._cursorPt)return null;const t=this._openWallHit(this._cursorPt);return t?{segs:t.segs,open:t.open}:null}_renderOpenWalls(t){const e=this._openPairs(),i=this._openWallHover;if(!e.length&&!i)return j``;const s=this._markup&&"openwall"===this._tool;return j`<g class="openwalls ${s?"hot":""}" style="--ow-stroke:${t?.color||"var(--hp-muted)"}">
      ${e.flatMap(t=>t.segs.map(t=>j`<line class="openwall"
        x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`))}
      ${i?i.segs.map(t=>j`<line class="openwall-preview ${i.open?"willclose":""}"
            x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`):V}
    </g>`}_openPairs(){const t=this._spaceModel();if(this._openPairsCache&&this._openPairsCache.model===t)return this._openPairsCache.pairs;const e=this._computeOpenPairs();return this._openPairsCache={model:t,pairs:e},e}_computeOpenPairs(){const t=this._spaceModel().rooms.filter(t=>t.id),e=[];for(let i=0;i<t.length;i++)for(let s=i+1;s<t.length;s++){const o=t[i],n=t[s];if(!((o.open_to||[]).includes(n.id)||(n.open_to||[]).includes(o.id)))continue;const r=xe(o),a=xe(n);if(!r||!a)continue;const l=zi(r,a,.02*this._gridPitch);l.length&&e.push({a:o,b:n,segs:l})}return e}_openWallHit(t){const e=this._spaceModel().rooms.filter(t=>t.id),i=6*this._gridPitch;let s=null;for(let o=0;o<e.length;o++)for(let n=o+1;n<e.length;n++){const r=xe(e[o]),a=xe(e[n]);if(!r||!a)continue;const l=zi(r,a,.02*this._gridPitch);for(const r of l){const a=Hi(t,r);a<=i&&(!s||a<s.d)&&(s={a:e[o],b:e[n],segs:l,d:a})}}if(!s)return null;const o=(s.a.open_to||[]).includes(s.b.id)||(s.b.open_to||[]).includes(s.a.id);return{a:s.a,b:s.b,segs:s.segs,open:o}}_openWallClick(t){const e=this._openWallHit(t);if(!e)return void this._showToast(this._t("toast.openwall_pick"));const i=this._curSpaceCfg,s=i.rooms.find(t=>t.id===e.a.id),o=i.rooms.find(t=>t.id===e.b.id);if(!s||!o)return;(s.open_to||[]).includes(o.id)||(o.open_to||[]).includes(s.id)?(s.open_to=(s.open_to||[]).filter(t=>t!==o.id),o.open_to=(o.open_to||[]).filter(t=>t!==s.id),s.open_to.length||delete s.open_to,o.open_to.length||delete o.open_to,this._showToast(this._t("toast.openwall_closed",{a:s.name||"",b:o.name||""}))):(s.open_to=[...s.open_to||[],o.id],o.open_to=[...o.open_to||[],s.id],this._showToast(this._t("toast.openwall_opened",{a:s.name||"",b:o.name||""}))),this._saveConfig(),this.requestUpdate()}_openingClick(t,e=!1){const i=1.5*this._gridPitch,s=this._openingsR.find(e=>Math.hypot(t[0]-e.rx,t[1]-e.ry)<=Math.max(e.rlen/2,i));if(s)return void this._editOpening(s);const o=Me(t,this._spaceModel().rooms,i);if(!o)return void this._showToast(this._t("toast.opening_no_wall"));const n=this._opRuler(o,this._cmToUnits(90),e);this._openingDialog={type:"door",lengthCm:90,contact:"",lock:"",invert:!1,flipH:!1,flipV:!1,x:n.x,y:n.y,angle:n.angle},this._cursorPt=null}_editOpening(t){this._openingDialog={id:t.id,type:t.type,lengthCm:Math.round(t.rlen/this._gridPitch*this._cellCm),contact:t.contact||"",lock:t.lock||"",invert:!!t.invert,flipH:!!t.flip_h,flipV:!!t.flip_v,x:t.rx,y:t.ry,angle:t.angle}}_opPointerDown(t,e){if("plan"===this._mode&&"resize"!==this._tool){t.preventDefault(),t.stopPropagation();try{yn(t)}catch{}this._opDrag={id:e.id,moved:!1,sx:t.clientX,sy:t.clientY,dirty:!1}}}_opPointerMove(t,e){if(!this._opDrag||this._opDrag.id!==e.id)return;if(Math.abs(t.clientX-this._opDrag.sx)+Math.abs(t.clientY-this._opDrag.sy)<=3)return;const i=Me(this._svgPoint(t),this._spaceModel().rooms,4*this._gridPitch);if(!i)return;this._opDrag.moved=!0;const s=this._curSpaceCfg,o=s?.openings?.find(t=>t.id===e.id);if(!o)return;const n=this._opRuler(i,o.length*mn,t.shiftKey);this._opMeasure=n.measure;const r=n.x/mn,a=n.y/this._spaceH;o.x===r&&o.y===a&&o.angle===i.angle||(this._opDrag.dirty=!0),o.x=r,o.y=a,o.angle=i.angle,this.requestUpdate()}_opRuler(t,e,i){const s=this._spaceModel().rooms,o=this._gridPitch/2;let n=t.x,r=t.y,a=De([n,r],t.angle,e,s,o);if(!a||!a.centered||i||n===a.wallCenter[0]&&r===a.wallCenter[1]){if(a&&!i){const[i,l]=a.wallA,[c,h]=a.wallB,d=c-i,p=h-l,u=Math.hypot(d,p);if(u>0){const c=this._gridPitch,h=Math.min(e/2,u/2);let _=Math.round(((n-i)*d+(r-l)*p)/u/c)*c;_=Math.max(h,Math.min(u-h,_)),n=i+_/u*d,r=l+_/u*p,a=De([n,r],t.angle,e,s,o)||a}}}else[n,r]=a.wallCenter,a=De([n,r],t.angle,e,s,o);if(!a)return{x:n,y:r,angle:t.angle,measure:null};const l="mi"===this.hass?.config?.unit_system?.length,c=(t,e)=>({x:e[0],y:e[1],text:we(t/this._gridPitch*this._cellCm,l)});return{x:n,y:r,angle:t.angle,measure:{labels:[c(a.sideA,a.midA),c(a.sideB,a.midB)],guide:a.centered&&!i?{x:a.wallCenter[0],y:a.wallCenter[1],angle:t.angle}:null}}}_opPointerUp(t,e){if(!this._opDrag||this._opDrag.id!==e.id)return;const i=this._opDrag.moved;this._opMeasure=null,i&&this._opDrag.dirty&&this._saveConfig(),i?window.setTimeout(()=>this._opDrag=null,0):this._opDrag=null}_opClick(t,e){"plan"===this._mode&&"resize"===this._tool||(t.stopPropagation(),this._opDrag?.moved||"plan"===this._mode&&this._editOpening(e))}_saveOpening(){const t=this._openingDialog,e=this._curSpaceCfg;if(!t||!e)return;const i=this._spaceH,s={id:t.id||"o"+Date.now().toString(36),type:t.type,x:t.x/mn,y:t.y/i,angle:t.angle,length:this._cmToUnits(Math.max(20,t.lengthCm))/mn,contact:t.contact||null,lock:"door"===t.type&&t.lock||null,invert:t.invert||void 0,flip_h:t.flipH||void 0,flip_v:t.flipV||void 0};e.openings=e.openings||[];const o=e.openings.findIndex(t=>t.id===s.id);o>=0?e.openings[o]=s:e.openings.push(s),this._saveConfig(),this._openingDialog=null,this.requestUpdate()}_deleteOpening(){const t=this._openingDialog,e=this._curSpaceCfg;t?.id&&e?.openings&&(e.openings=e.openings.filter(e=>e.id!==t.id),this._saveConfig(),this._openingDialog=null,this.requestUpdate())}_contactCandidates(){const t=[];for(const e of Object.keys(this.hass.states)){const i=e.split(".")[0];if("binary_sensor"!==i&&"cover"!==i)continue;const s=this.hass.states[e],o=["door","window","opening","garage_door","garage"].includes(s?.attributes?.device_class||"");("cover"!==i||o)&&t.push([e,s?.attributes?.friendly_name||e,o?0:1])}return t.sort((t,e)=>t[2]-e[2]||t[1].localeCompare(e[1])).map(([t,e])=>({value:t,label:e}))}_lockCandidates(){return Object.keys(this.hass.states).filter(t=>t.startsWith("lock.")).map(t=>({value:t,label:this.hass.states[t]?.attributes?.friendly_name||t})).sort((t,e)=>t.label.localeCompare(e.label))}_mergeClick(t){const e=this._spaceModel().rooms,i=[...e].reverse().find(e=>this._pointInRoom(t,e));if(!i?.id)return;const s=i.id;if(!this._mergeSel||this._mergeSel===s)return void(this._mergeSel=this._mergeSel===s?null:s);const o=e.find(t=>t.id===this._mergeSel),n=o?xe(o):null,r=xe(i),a=n&&r?je(n,r):null;if(!a)return this._showToast(this._t("toast.merge_not_adjacent")),void(this._mergeSel=null);this._mergeDialog={aId:this._mergeSel,bId:s,poly:a,pick:"a"},this._mergeSel=null}_commitMerge(){const t=this._mergeDialog,e=this._curSpaceCfg;if(!t||!e)return;const i=this._spaceH,s="a"===t.pick?t.aId:t.bId,o="a"===t.pick?t.bId:t.aId,n=e.rooms.find(t=>t.id===s);n?(n.poly=t.poly.map(t=>[t[0]/mn,t[1]/i]),delete n.x,delete n.y,delete n.w,delete n.h,e.rooms=e.rooms.filter(t=>t.id!==o),this._saveConfig(),this._mergeDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.rooms_merged",{name:n.name||""}))):this._mergeDialog=null}_splitClick(t,e=!1){const i=this._spaceModel().rooms;if(!this._splitSel){const e=[...i].reverse().find(e=>this._pointInRoom(t,e));if(!e?.id)return;return void(this._splitSel={roomId:e.id,pts:[]})}const s=i.find(t=>t.id===this._splitSel.roomId),o=s?xe(s):null;if(!s||!o)return void(this._splitSel=null);const n=.02*this._gridPitch,r=6*this._gridPitch,a=Re(t,o),l=a&&!e&&function(t,e,i){let s=null,o=1/0;for(let n=0;n<e.length;n++){const[r,a]=e[n],[l,c]=e[(n+1)%e.length],h=l-r,d=c-a,p=h*h+d*d;if(!p)continue;let u=((t[0]-r)*h+(t[1]-a)*d)/p;u=Math.max(0,Math.min(1,u));const _=Math.hypot(t[0]-(r+u*h),t[1]-(a+u*d));if(_>=o)continue;o=_;const g=Math.sqrt(p),m=(i>0?Math.max(0,Math.min(g,Math.round(u*g/i)*i)):u*g)/g;s=[r+m*h,a+m*d]}return s}(a,o,this._gridPitch)||a,c=a&&l&&Math.hypot(a[0]-t[0],a[1]-t[1])<=r?l:null,h=!!c&&Ae(c,o,n),d=this._splitSel.pts;if(!d.length)return h?void(this._splitSel={...this._splitSel,pts:[c]}):void this._showToast(this._t("toast.split_pick_wall"));if(!h){const i=this._snap(t,e);return Ee(i,o,n)?void(this._splitSel={...this._splitSel,pts:[...d,i]}):void this._showToast(this._t("toast.split_pick_inside"))}const p=function(t,e,i=1e-6){if(!t||t.length<3||!e||e.length<2)return null;const s=e[0],o=e[e.length-1];if(Te(s,o,i))return null;const n=We(t,s,i),r=We(t,o,i);if(n<0||r<0)return null;const a=e.slice(1,-1);for(const e of a)if(!Ee(e,t,i))return null;for(let i=0;i<e.length-1;i++)for(let s=0;s<t.length;s++)if(Oe(e[i],e[i+1],t[s],t[(s+1)%t.length]))return null;for(let t=0;t<e.length-1;t++)for(let i=t+2;i<e.length-1;i++)if(Oe(e[t],e[t+1],e[i],e[i+1]))return null;if(2===e.length&&!Ee([(s[0]+o[0])/2,(s[1]+o[1])/2],t,i))return null;const l=(e,s,o,n)=>{const r=[e];let a=(s+1)%t.length;for(let e=0;e<=t.length&&(r.push(t[a]),a!==n);e++)a=(a+1)%t.length;return r.push(o),Ve(r,i)};let c,h;if(n===r){const r=Ve([...e],i);if(r.length<3||Ue(r)<=i)return null;const a=[];for(let i=0;i<t.length;i++)if(a.push(t[i]),i===n){const i=(t[(n+1)%t.length][0]-t[n][0])*(o[0]-s[0])+(t[(n+1)%t.length][1]-t[n][1])*(o[1]-s[1])>=0?e:[...e].reverse();for(const t of i)a.push(t)}c=Ve(a,i),h=r}else c=Ve([...l(s,n,o,r),...[...a].reverse()],i),h=Ve([...l(o,r,s,n),...a],i);return c.length<3||h.length<3||Ue(c)<=i||Ue(h)<=i||Math.abs(Ue(c)+Ue(h)-Ue(t))>Math.max(i,1e-6*Ue(t))?null:[c,h]}(o,[...d,c],n);if(!p)return void this._showToast(this._t("toast.split_bad_cut"));this._resetRoomDialogFields();const[u,_]=p,g=Ue(u)>=Ue(_)?u:_,m=g===u?_:u;this._pendingSplit={roomId:s.id,mainPoly:g,newPoly:m},this._cursorPt=null,this._nameSel="",this._areaSel="",this._roomDialog=!0}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])}_markupMove(t){if(!this._markup)return;if("opening"===this._tool||"openwall"===this._tool)return this._opShift=!!t.shiftKey,void(this._cursorPt=this._svgPoint(t));const e="draw"===this._tool&&this._path.length&&!this._contourClosed,i="split"===this._tool&&!!this._splitSel?.pts?.length;(e||i)&&(this._cursorPt=this._snap(this._svgPoint(t),t))}get _openingPreview(){if("opening"!==this._tool||!this._cursorPt)return null;const t=this._cursorPt,e=1.5*this._gridPitch,i=this._openingsR.find(i=>Math.hypot(t[0]-i.rx,t[1]-i.ry)<=Math.max(i.rlen/2,e));if(i)return null;const s=this._cmToUnits(90),o=Me(t,this._spaceModel().rooms,e);if(!o)return null;const n=this._opRuler(o,s,this._opShift);return{x:n.x,y:n.y,angle:n.angle,rlen:s,measure:n.measure}}get _opMeasureView(){return this._opMeasure||this._openingPreview?.measure||null}_saveRoom(){this._areaSel&&this._commitRoom()}_saveRoomNoArea(){this._nameSel.trim()&&(this._areaSel="",this._commitRoom())}_commitRoom(){const t=this._curSpaceCfg;if(!t)return;const e=this._spaceH;let i;if(this._pendingSplit){const s=t.rooms.find(t=>t.id===this._pendingSplit.roomId);if(!s)return this._pendingSplit=null,this._splitSel=null,void(this._roomDialog=!1);s.poly=this._pendingSplit.mainPoly.map(t=>[t[0]/mn,t[1]/e]),delete s.x,delete s.y,delete s.w,delete s.h,i=this._pendingSplit.newPoly}else{if(!this._contourClosed)return;i=this._path.slice(0,-1)}const s=this._areaSel?this.hass.areas[this._areaSel]?.name:"";t.rooms.push({id:"r"+Date.now().toString(36),name:this._nameSel||s||this._t("room.default_name"),area:this._areaSel||null,poly:i.map(t=>[t[0]/mn,t[1]/e]),...this._roomSettingsFromDialog()?{settings:this._roomSettingsFromDialog()}:{}}),this._saveConfig(),this._path=[],this._pendingSplit=null,this._splitSel=null;const o=this._areaSel;this._areaSel="",this._nameSel="",this._roomDialog=!1,this._regSignature="",this._maybeRebuildDevices();let n=0;if(o){const t=mn,e={...this._layout};for(const i of this._devices){if(i.area!==o||i.space!==this._space)continue;if(n++,this._layout[i.id])continue;const s=this._defPos[i.id];s&&(e[i.id]={s:this._space,x:s.x/mn,y:s.y/t},this._dirtyPos.add(i.id))}this._layout=e,this._persistLayout()}const r=this._model.find(t=>t.id===this._space)?.rooms.length||0;this._showToast(o?this._t("toast.room_saved",{n:r,added:n}):this._t("toast.room_saved_no_area",{n:r}))}_cancelPath(){this._path=[],this._cursorPt=null,this._roomDialog=!1,this._pendingSplit=null,this._splitSel=null,this._mergeSel=null,this._mergeDialog=null}_roomDialogCancel(){return this._roomDialog=!1,this._roomEditId?(this._roomEditId=null,this._nameSel="",void(this._areaSel="")):this._pendingSplit?(this._pendingSplit=null,void(this._splitSel=null)):void this._undoPoint()}get _freeAreas(){const t=new Set;for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.add(i.area);return Object.values(this.hass?.areas||{}).filter(e=>!t.has(e.area_id)).sort((t,e)=>(t.name||"").localeCompare(e.name||""))}_openMarkerDialog(t){t&&this._ackNewDevice(t.id),this._norm?this._markerDialog=t?{devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingMode:"virtual"===t.bindingKind?"virtual":"ha",bindingOpen:!1,showEntities:"entity"===t.bindingKind&&!!this.hass.entities[t.bindingRef||""]?.device_id,bindingFilter:"",icon:t.marker?.icon||"",autoIcon:t.icon||"",display:t.marker?.display||"badge",rippleColor:t.marker?.ripple_color||"",rippleSize:Number(t.marker?.ripple_size)>0?Number(t.marker.ripple_size):3,size:Number(t.marker?.size)>0?Number(t.marker.size):1,angle:Number(t.marker?.angle)||0,tapAction:t.marker?.tap_action||"",tapTarget:t.marker?.tap_target||"",tapConfirm:!0===t.marker?.tap_confirm,runFilter:"",defaultTap:"light"===t.primary?.split(".")[0]?"toggle":"info",controls:[...t.marker?.controls||[]],controlsFilter:"",isLight:!0===t.marker?.is_light,useClimateTemp:!0===t.marker?.use_climate_temp,glowRadius:Number(t.marker?.glow_radius_cm)>0?String(this._imperial?Math.round(Number(t.marker.glow_radius_cm)/30.48*10)/10:Math.round(Number(t.marker.glow_radius_cm))/100):"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.marker?.room_id?t.space+"#@"+t.marker.room_id:t.space&&t.area?t.space+"#"+t.area:"",hideFromPlan:!0===t.marker?.hidden,busy:!1}:{name:"",binding:"virtual",bindingMode:"virtual",bindingOpen:!1,showEntities:!1,bindingFilter:"",icon:"",autoIcon:"",display:"badge",rippleColor:"",rippleSize:3,size:1,angle:0,tapAction:"",tapTarget:"",tapConfirm:!1,runFilter:"",defaultTap:"info",controls:[],controlsFilter:"",isLight:!1,useClimateTemp:!1,glowRadius:"",model:"",link:"",description:"",pdfs:[],room:"",hideFromPlan:!1,busy:!1,uploadId:"up_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}:this._showToast(this._t("toast.marker_needs_server"))}_runCandidates(){const t=[];for(const e of ri)for(const[i,s]of Object.entries(this.hass.states))i.startsWith(e+".")&&t.push({value:i,label:s?.attributes?.friendly_name||i,sub:this._t("run."+e)});return t.sort((t,e)=>t.sub.localeCompare(e.sub)||t.label.localeCompare(e.label))}_bindingCandidates(){const t=this.hass,e=new Set;for(const t of this._devices)t.id!==this._markerDialog?.devId&&("device"===t.bindingKind&&t.bindingRef&&e.add("device:"+t.bindingRef),"entity"===t.bindingKind&&t.bindingRef&&e.add("entity:"+t.bindingRef));const i=new Set;for(const t of this._devices)"device"===t.bindingKind&&t.name&&i.add(t.name.trim()+"|"+(t.area||""));const s=[];for(const o of Object.values(t.devices)){if("service"===o.entry_type)continue;const t="device:"+o.id;if(e.has(t))continue;const n=(o.name_by_user||o.name||o.id).trim();t!==this._markerDialog?.binding&&i.has(n+"|"+(o.area_id||""))||s.push({value:t,label:n,sub:(o.model||this._t("marker.sub_device"))+("Group"===o.model?this._t("marker.sub_z2m_group"):"")})}const o=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);for(const[i,n]of Object.entries(t.entities)){const r="entity:"+i;if(e.has(r))continue;const a=o.has(n.platform),l="group"===n.platform;if(!a&&!l)continue;if(n.hidden)continue;const c=t.states[i];s.push({value:r,label:n.name||c?.attributes?.friendly_name||i,sub:i.split(".")[0]+" · "+("group"===n.platform?this._t("marker.sub_group"):this._t("marker.sub_helper"))})}if(this._markerDialog?.showEntities){const i=new Set(s.map(t=>t.value));for(const[o,n]of Object.entries(t.entities)){const r="entity:"+o;if(e.has(r)||i.has(r)||n.hidden)continue;const a=t.states[o],l=n.name||a?.attributes?.friendly_name||o,c=n.device_id?t.devices[n.device_id]:null,h=c&&(c.name_by_user||c.name)||"";s.push({value:r,label:l,sub:o.split(".")[0]+" · "+this._t("marker.sub_entity")+(h?" · "+h:"")})}}const n=(this._markerDialog?.bindingFilter||"").toLowerCase().trim(),r=n?s.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(n)):s;return r.sort((t,e)=>t.label.localeCompare(e.label)),r.slice(0,200)}_allRoomsFlat(){const t=[];for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area?t.push({value:e.id+"#"+i.area,label:(e.title||e.id)+" · "+i.name}):i.id&&t.push({value:e.id+"#@"+i.id,label:(e.title||e.id)+" · "+i.name+" · "+this._t("marker.subarea")});return t}_errText(t){if(!t)return this._t("err.unknown");if("string"==typeof t)return t;if(t.message)return t.message;if(t.error)return t.error;if(null!=t.code)return this._t("err.code",{code:t.code});try{return JSON.stringify(t)}catch{return String(t)}}async _pickMarkerFiles(t){const e=t.target,i=e.files?[...e.files]:[];if(e.value="",!i.length||!this._markerDialog)return;const s=this._markerDialog.uploadId||this._markerDialog.devId||"new",o=[];for(const t of i)try{const e=new FormData;e.append("marker_id",s),e.append("file",t,t.name);const i=this.hass?.fetchWithAuth?await this.hass.fetchWithAuth("/api/houseplan/upload",{method:"POST",body:e}):await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:this.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.hass.auth.data.access_token}`}:{}}),n=await i.json().catch(()=>({}));if(!i.ok||n.error){const t={too_large:this._t("err.too_large",{mb:n.max_mb||50}),bad_ext:this._t("err.bad_ext"),unauthorized:this._t("err.unauthorized")};throw new Error(t[n.error]||n.error||"HTTP "+i.status)}o.push({name:n.name||t.name,url:n.url})}catch(e){this._showToast(this._t("toast.file_failed",{name:t.name,err:this._errText(e)}))}o.length&&this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:[...this._markerDialog.pdfs,...o]},this._showToast(this._t("toast.files_attached",{n:o.length})))}_removeMarkerPdf(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:this._markerDialog.pdfs.filter(e=>e.url!==t)})}async _saveMarker(){const t=this._markerDialog;if(t&&!t.busy&&("ha"!==t.bindingMode||t.binding&&"virtual"!==t.binding))if("virtual"!==t.binding||t.name.trim())if("run"!==t.tapAction||t.tapTarget){this._markerDialog={...t,busy:!0};try{const e=this._serverCfg;let i;e.markers=e.markers||[];const s=function(t){if(!t)return null;const e=t.indexOf("#");if(e<=0)return null;const i=t.slice(0,e),s=t.slice(e+1);if(!s)return null;if(s.startsWith("@")){const t=s.slice(1);return t?{space:i,area:null,roomId:t}:null}return{space:i,area:s,roomId:null}}(t.room);let o=s?.space||null,n=s?.area||null;const r=s?.roomId||null;"virtual"!==t.binding||o||(o=this._space),i=function(t,e,i){const[s,o]=t.split(":");return"device"===s?o:"entity"===s?"lg_"+o:e&&e.startsWith("v_")?e:i()}(t.binding,t.devId,()=>"v_"+Date.now().toString(36));const a=t.devId,l=e.markers.find(t=>t.id===i||t.id===a)?.vacuum||null,c={id:i,vacuum:l,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,display:"badge"!==t.display?t.display:null,ripple_color:"badge"!==t.display&&t.rippleColor?t.rippleColor:null,ripple_size:"badge"!==t.display&&3!==t.rippleSize?t.rippleSize:null,size:1!==t.size?t.size:null,angle:t.angle?t.angle:null,tap_action:t.tapAction||null,tap_target:"run"===t.tapAction&&t.tapTarget||null,tap_confirm:!!t.tapConfirm||null,controls:t.controls.length?t.controls:null,is_light:!!t.isLight||null,use_climate_temp:!!t.useClimateTemp||null,glow_radius_cm:(()=>{const e=parseFloat(t.glowRadius);return!Number.isFinite(e)||e<=0?null:Math.round(this._imperial?30.48*e:100*e)})(),model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs,hidden:!!t.hideFromPlan};("virtual"===t.binding||t.room)&&(c.space=o,c.area=n,c.room_id=r);const h=a?this._devices.find(t=>t.id===a):null,d=h?.marker?.room_id??null,p=!!t.room&&null!=h&&(h.space!==o||h.area!==n||d!==r);let u=!1;const _=t.uploadId||a;if(_&&_!==i&&c.pdfs?.length)try{const t=await this.hass.callWS({type:"houseplan/files/migrate",from_id:_,to_id:i}),e=t?.mapping||{};c.pdfs=function(t,e,i,s){if(!e||!i||e===i)return t;const o="/files/"+e+"/",n="/files/"+i+"/";return t.map(t=>{if(!t.url.includes(o))return t;const e=t.url.split(o)[1]||"",[i,r]=[e.split("?")[0],e.includes("?")?"?"+e.split("?")[1]:""];if(s){const e=s[decodeURIComponent(i)]??s[i];return e?{...t,url:t.url.split(o+i)[0]+n+encodeURIComponent(e)+r}:t}return{...t,url:t.url.split(o).join(n)}})}(c.pdfs,_,i,e),u=Object.keys(e).length>0}catch(t){this._showToast(this._t("toast.files_migrate_failed",{err:this._errText(t)}))}e.markers=e.markers.filter(t=>t.id!==i&&t.id!==a),e.markers.push(c);let g=null;const m=o||h?.space||this._space,f=a?this._layout[a]:null,v=f?{s:f.s||h?.space||this._space,x:f.x,y:f.y}:a&&h&&this._defPos[a]?this._normPos(h.space,this._defPos[a].x,this._defPos[a].y):null;if(v&&v.s===m)i===a&&this._layout[i]&&!p||(g={s:v.s,x:v.x,y:v.y},this._layout={...this._layout,[i]:g});else if(!this._layout[i]||p){const t=this._spaceModel(o||void 0);let e=t.vb[0]+t.vb[2]/2,s=t.vb[1]+t.vb[3]/2;const a=r?t.rooms.find(t=>t.id===r):n?t.rooms.find(t=>t.area===n):void 0;a&&([e,s]=this._roomCenter(a)),g=this._normPos(o||this._space,e,s),this._layout={...this._layout,[i]:g}}await this._saveConfigNow(),g&&this._noteLayoutRev(await this.hass.callWS({type:"houseplan/layout/update",device_id:i,pos:g})),a&&a!==i&&(delete this._layout[a],await this.hass.callWS({type:"houseplan/layout/delete",device_id:a}).then(t=>this._noteLayoutRev(t)).catch(()=>{})),u&&_&&await this.hass.callWS({type:"houseplan/files/cleanup",marker_id:_}).catch(()=>{}),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_saved"))}catch(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}else this._showToast(this._t("toast.run_target_required"));else this._showToast(this._t("toast.virtual_name_required"))}async _deleteMarker(){const t=this._markerDialog;if(!t)return;const e=t.devId?this._devices.find(e=>e.id===t.devId):null,i=t.name||this._t("device.fallback");if(!confirm(this._t("confirm.remove_marker",{name:i})))return;const s=this._serverCfg;s.markers=s.markers||[],e&&"virtual"===e.bindingKind?s.markers=s.markers.filter(t=>t.id!==e.id):e&&e.marker?(s.markers=s.markers.filter(t=>t.id!==e.id),"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0})):e&&"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):e&&"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0});try{await this._saveConfigNow(),e&&"virtual"===e.bindingKind&&this._layout[e.id]&&(delete this._layout[e.id],await this.hass.callWS({type:"houseplan/layout/delete",device_id:e.id}).then(t=>this._noteLayoutRev(t)).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.marker_removed"))}catch(t){this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_normPos(t,e,i){return{s:t,x:e/mn,y:i/mn}}_openSpaceDialog(t,e){if(this._serverStorage&&this._serverCfg)if("edit"===t){const i=this._serverCfg.spaces.find(t=>t.id===e);if(!i)return;const s=_i(i);this._spaceDialog={mode:t,spaceId:e,title:i.title,planUrl:i.plan_url||null,planFile:null,source:i.plan_url?"file":"draw",showBorders:s.showBorders,showNames:s.showNames,roomColor:s.color,roomOpacity:s.opacity,fillMode:s.fill,bgColor:s.bgColor,bgMode:"static"===i.settings?.bg_mode||"daynight"===i.settings?.bg_mode?i.settings.bg_mode:null,northDeg:$s({},i.settings),sunRays:"boolean"==typeof i.settings?.sun_rays?i.settings.sun_rays:null,tempMin:s.tempMin,tempMax:s.tempMax,showLqi:s.showLqi??this._config?.show_signal??!0,cardFontScale:s.cardFontScale,labelTemp:s.labelTemp,labelHum:s.labelHum,labelLqi:s.labelLqi,labelLight:s.labelLight,cellCm:Number(i.cell_cm)>0?Number(i.cell_cm):5,busy:!1}}else this._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,source:"file",showBorders:!1,showNames:!1,roomColor:pi,roomOpacity:ui,fillMode:"glow",bgColor:null,bgMode:null,northDeg:null,sunRays:null,tempMin:20,tempMax:25,showLqi:this._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:5,busy:!1};else this._showToast(this._t("toast.integration_missing"))}async _pickPlanFile(t){const e=t.target,i=e.files?.[0];if(!i||!this._spaceDialog)return;const s={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[i.type]||(i.name.toLowerCase().endsWith(".svg")?"svg":"");if(!s)return void this._showToast(this._t("toast.plan_formats"));const o=new Uint8Array(await i.arrayBuffer());let n="";for(let t=0;t<o.length;t+=32768)n+=String.fromCharCode(...o.subarray(t,t+32768));const r=btoa(n),a=URL.createObjectURL(i),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=a});URL.revokeObjectURL(a),this._spaceDialog={...this._spaceDialog,planFile:{ext:s,b64:r,aspect:l,name:i.name}}}_useServerPlan(t){const e=this._spaceDialog;e&&(this._spaceDialog={...e,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let e=0;e<40;e++){const e=this._display(t);if(e){const i=await new Promise(t=>{const i=new Image;i.onload=()=>t(i.naturalWidth&&i.naturalHeight?i.naturalWidth/i.naturalHeight:0),i.onerror=()=>t(0),i.src=e}),s=this._spaceDialog;return s&&s.planUrl===t&&Number.isFinite(i)&&i>0?(this._spaceDialog={...s,savedAspect:i},i):0}if(await new Promise(t=>setTimeout(t,150)),this._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){if(confirm(this._t("confirm.delete_plan",{name:t})))try{await this.hass.callWS({type:"houseplan/plans/delete",name:t});const e=this._spaceDialog;e?.saved&&(this._spaceDialog={...e,saved:e.saved.filter(e=>e.name!==t)})}catch(t){this._showToast(this._t("toast.plan_delete_failed",{err:this._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return B`<div class="savedplans muted">${this._t("space.loading")}</div>`;const e=t.saved||[];if(!e.length)return B`<div class="savedplans muted">${this._t("space.no_saved")}</div>`;return B`<div class="savedplans">
      ${e.map(e=>B`
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
    </div>`}async _saveSpaceDialog(){const t=this._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this._showToast(this._t("toast.plan_required"));const e="create"===t.mode&&0===(this._serverCfg?.spaces.length||0);this._spaceDialog={...t,busy:!0};try{const i="create"===t.mode?"s"+Date.now().toString(36):t.spaceId;let s=null;if("file"===t.source&&t.planFile){s={url:(await this.hass.callWS({type:"houseplan/plan/set",space_id:i,ext:t.planFile.ext,data:t.planFile.b64})).url,aspect:t.planFile.aspect}}let o=t.savedAspect||null;!s&&"file"===t.source&&t.planUrl&&!o&&this._aspectJob&&(o=await this._aspectJob||null);const n=this._serverCfg;let r;if("create"===t.mode)r={id:i,title:t.title.trim(),plan_url:null,view_box:[0,0,1,1],rooms:[]},n.spaces.push(r);else{if(r=n.spaces.find(t=>t.id===i),!r)throw new Error("space "+i+" is gone from the config");r.title=t.title.trim()}s?(r.plan_url=s.url,r.plan_aspect=s.aspect):"file"===t.source&&t.planUrl&&t.planUrl!==r.plan_url&&(r.plan_url=t.planUrl,r.plan_aspect=o),"draw"===t.source&&(r.plan_url=null,r.plan_aspect=null,delete r.plan_x,delete r.plan_y,delete r.plan_scale);const a="draw"===t.source;r.settings={...r.settings||{},show_borders:!(!a||"create"!==t.mode)||t.showBorders,show_names:!(!a||"create"!==t.mode)||t.showNames,room_color:t.roomColor,room_opacity:t.roomOpacity,bg_color:t.bgColor||void 0,bg_mode:t.bgMode||void 0,north_deg:t.northDeg??void 0,sun_rays:t.sunRays??void 0,fill_mode:t.fillMode,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):20,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):25,show_lqi:t.showLqi,card_font_scale:1!==t.cardFontScale?t.cardFontScale:void 0,label_temp:t.labelTemp,label_hum:t.labelHum,label_lqi:t.labelLqi,label_light:t.labelLight},r.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?t.cellCm:5,await this._saveConfigNow(),this._spaceDialog=null,"create"===t.mode&&(this._space=r.id),this._regSignature="",this._maybeRebuildDevices(),this._importQueue.length?this._openNextImport():e||this._importTotal>0?(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._mode="plan",this._tool="draw",this._path=[],this._cursorPt=null,this._showToast(this._t(e&&!this._importTotal?"toast.space_added_onboard":"import.done"))):this._showToast("create"===t.mode?this._t("toast.space_added"):this._t("toast.space_saved"))}catch(t){this._spaceDialog&&(this._spaceDialog={...this._spaceDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}async _deleteSpace(){const t=this._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this._serverCfg.spaces.find(e=>e.id===t.spaceId);if(confirm(this._t("confirm.delete_space",{title:e.title}))){this._serverCfg.spaces=this._serverCfg.spaces.filter(e=>e.id!==t.spaceId);try{await this._saveConfigNow(),this._spaceDialog=null,this._space===t.spaceId&&(this._space=this._serverCfg.spaces[0]?.id||""),this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("toast.space_deleted"))}catch(t){this._showToast(this._t("toast.delete_failed",{err:this._errText(t)}))}}}async _saveConfigNow(){this._cfgEpoch++;try{await this._writeConfig()}catch(t){throw"conflict"===t?.code&&await this._reloadConfigOnly(),t}}_startImport(){const t=this._importDialog;if(!t)return;const e=t.floors.filter(t=>t.checked).map(t=>t.name);this._importDialog=null,e.length?(this._importQueue=e,this._importTotal=e.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this._importQueue.shift();void 0!==t&&(this._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,source:"file",showBorders:!1,showNames:!1,roomColor:pi,roomOpacity:ui,fillMode:"glow",bgColor:null,bgMode:null,northDeg:null,sunRays:null,tempMin:20,tempMax:25,showLqi:this._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:5,busy:!1})}_skipImport(){this._spaceDialog=null,this._importQueue.length?this._openNextImport():this._importTotal>0&&this._model.length&&(this._importTotal=0,this._space=this._serverCfg.spaces[0]?.id||this._space,this._mode="plan",this._showToast(this._t("import.done")))}_renderImportDialog(){const t=this._importDialog,e=t.floors.filter(t=>t.checked).length;return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:home-floor-1"></ha-icon>${this._t("import.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("import.hint")}</div>
          ${t.floors.map((e,i)=>B`<label class="floorrow">
              <input type="checkbox" .checked=${e.checked}
                @change=${s=>{const o=[...t.floors];o[i]={...e,checked:s.target.checked},this._importDialog={floors:o}}} />
              <span>${e.name}</span>
              ${null!=e.level?B`<span class="floorlvl">L${e.level}</span>`:V}
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
    </div>`}_sunGlobal(){const t=this._settingsDialog;return t?{...this._settings,north_deg:t.northDeg??void 0,bg_mode:t.bgMode,sun_rays:t.sunRays,weather_entity:(t.weatherEntity||"").trim()||void 0}:this._settings}_sunSpace(){const t=this._spaceDialog,e=this._curSpaceCfg?.settings||{};return t&&"edit"===t.mode&&t.spaceId===this._space?{...e,north_deg:t.northDeg??void 0,bg_mode:t.bgMode??void 0,sun_rays:t.sunRays??void 0}:e}_effNorth(){return $s(this._sunGlobal(),this._sunSpace())}_effBgMode(){return xs(this._sunGlobal(),this._sunSpace())}_effSunRays(){return ks(this._sunGlobal(),this._sunSpace())}_sunNow(){return null!==this._effNorth()?Ms(this.hass):null}_renderSunRays(t){const e=j``;if(this._editing||!this._effSunRays())return this._sunFadeReset(),e;const i=this._effNorth(),s=null!==i?Ms(this.hass):null;if(!s||s.elevation<=0)return this._sunFadeReset(),e;const o=Ss(this._sunGlobal()),n=function(t){if(!t)return 1;const e=ys[String(t).toLowerCase()];return void 0===e?1:e}(o?this.hass?.states?.[o]?.state:null),r=function(t=1){return.3*ps(t)}(n);if(r<=0)return this._sunFadeReset(),e;if(a=s.elevation,Number(a)>=3)this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunOut=!1,this._sunShown=!0;else{if(!this._sunShown)return e;this._sunOut||(this._sunOut=!0,this._sunOutTimer=window.setTimeout(()=>{this._sunOutTimer=0,this._sunShown=!1,this._sunOut=!1,this.requestUpdate()},2e3))}var a;const l=`${t.id}|${s.azimuth}|${s.elevation}|${i}|${this._cfgEpoch}`;if(!this._sunRaysCache||this._sunRaysCache.key!==l){const e=t.rooms.map(t=>({id:t.id||"",poly:xe(t)})).filter(t=>!!t.id&&!!t.poly),o=this._openingsR.filter(t=>"window"===t.type).map(t=>({id:t.id,x:t.rx,y:t.ry,angle:t.angle,length:t.rlen})),n=vs(e,o,s.azimuth,s.elevation,i);this._sunRaysCache={key:l,rays:n,rims:n.map(t=>function(t,e=1e-4){const[i,s]=t.dir,o=-s,n=i,r=[];for(const a of[t.a,t.b]){const l=[];for(const r of t.polys)for(let t=0;t<r.length;t++){const c=r[t],h=r[(t+1)%r.length];if(Math.abs((c[0]-a[0])*o+(c[1]-a[1])*n)>e)continue;if(Math.abs((h[0]-a[0])*o+(h[1]-a[1])*n)>e)continue;const d=(c[0]-a[0])*i+(c[1]-a[1])*s,p=(h[0]-a[0])*i+(h[1]-a[1])*s;Math.abs(p-d)<=e||l.push(d<p?[d,p]:[p,d])}l.sort((t,e)=>t[0]-e[0]);const c=[];for(const t of l){const i=c[c.length-1];i&&t[0]<=i[1]+e?i[1]=Math.max(i[1],t[1]):c.push([t[0],t[1]])}for(const[t,e]of c)r.push([[a[0]+i*t,a[1]+s*t],[a[0]+i*e,a[1]+s*e]])}return r}(t))}}const c=this._sunRaysCache.rays,h=this._sunRaysCache.rims;if(!c.length)return e;const d=(p=us(s.elevation).warmth,bi("#ffe9c2","#ff9a45",ps(p)));var p;const u=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]],_=function(t=1){return.42*ps(t)}(n),g=[[0,1],[.26,.86],[.46,.6],[.64,.32],[.77,.1],[.85,0],[1,0]];return j`<defs>
        ${c.map((t,e)=>{const i=(t.a[0]+t.b[0])/2,s=(t.a[1]+t.b[1])/2,o=i+t.normal[0]*t.depth,n=s+t.normal[1]*t.depth;return j`<linearGradient id="hp-sun-${e}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${s}" x2="${o}" y2="${n}">
            ${u.map(([t,e])=>j`<stop offset="${(100*t).toFixed(1)}%"
              stop-color="${d}" stop-opacity="${(r*e).toFixed(4)}"></stop>`)}
          </linearGradient>
          <linearGradient id="hp-sunrim-${e}" gradientUnits="userSpaceOnUse"
            x1="${i}" y1="${s}" x2="${o}" y2="${n}">
            ${g.map(([t,e])=>j`<stop offset="${(100*t).toFixed(1)}%"
              stop-color="${"#000000"}" stop-opacity="${(_*e).toFixed(4)}"></stop>`)}
          </linearGradient>`})}
      </defs>
      <g class="sunlayer ${this._sunOut?"out":""}">
        ${c.map((t,e)=>t.polys.map(t=>j`<polygon
          points="${t.map(t=>t[0]+","+t[1]).join(" ")}" fill="url(#hp-sun-${e})"></polygon>`))}
        ${c.map((t,e)=>(h[e]||[]).map(t=>j`<line class="sunrim"
          x1="${t[0][0]}" y1="${t[0][1]}" x2="${t[1][0]}" y2="${t[1][1]}"
          stroke="url(#hp-sunrim-${e})" stroke-width="1"
          vector-effect="non-scaling-stroke"></line>`))}
      </g>`}_skyPlan(){const t=this._editing||"daynight"!==this._effBgMode()?null:this._sunNow();if(!t)return this._skyElev=null,void(this._skySnap=!1);const e=bs(t.elevation);var i,s;i=this._skyElev,s=e,(null===i||!Number.isFinite(i)||Math.abs(s-i)>=3)&&(this._skySnap=!0),this._skyElev=e}_skyRelease(){this._skySnap&&!this._skySnapRaf&&(this._skySnapRaf=requestAnimationFrame(()=>{this._skySnapRaf=requestAnimationFrame(()=>{this._skySnapRaf=0,this._skySnap=!1,this.requestUpdate()})}))}_sunFadeReset(){this._sunOutTimer&&(clearTimeout(this._sunOutTimer),this._sunOutTimer=0),this._sunShown=!1,this._sunOut=!1}_compassPoint(t){const e=t.currentTarget.getBoundingClientRect(),i=t.clientX-(e.left+e.width/2),s=t.clientY-(e.top+e.height/2);if(Math.hypot(i,s)<5)return;let o=Math.round(180*Math.atan2(i,-s)/Math.PI);t.shiftKey&&(o=15*Math.round(o/15)),o=(o%360+360)%360,this._settingsDialog={...this._settingsDialog,northDeg:o}}_renderCompass(){const t=this._settingsDialog.northDeg;return B`<svg class="compass ${null===t?"unset":""}" viewBox="-60 -60 120 120"
      @pointerdown=${t=>{t.currentTarget.setPointerCapture(t.pointerId),this._compassDrag=!0,this._compassPoint(t)}}
      @pointermove=${t=>{this._compassDrag&&this._compassPoint(t)}}
      @pointerup=${()=>this._compassDrag=!1}
      @pointercancel=${()=>this._compassDrag=!1}>
      <circle class="cring" r="50"></circle>
      ${[0,45,90,135,180,225,270,315].map(t=>j`<line class="ctick ${t%90?"minor":""}" x1="0" y1="-50" x2="0" y2="${t%90?-46:-43}"
          transform="rotate(${t})"></line>`)}
      <g class="cneedle" transform="rotate(${t??0})">
        <line x1="0" y1="34" x2="0" y2="-28"></line>
        <path d="M -7 -24 L 0 -42 L 7 -24 Z"></path>
        <text x="0" y="-12" text-anchor="middle">${this._t("gs.north_letter")}</text>
      </g>
      <text class="cdeg" x="0" y="26" text-anchor="middle">${null===t?"—":t+"°"}</text>
    </svg>`}_stageBg(t){if("daynight"===this._effBgMode()){const t=this._sunNow();if(t)return us(bs(t.elevation)).bg}const e=this._settingsDialog,i=this._spaceDialog,s=e?e.bgColor||"":gi(this._settings,{bgColor:null});return(i&&"edit"===i.mode&&i.spaceId===this._space?i.bgColor||"":t.bgColor||"")||s}_stageBgHex(){const t=this._stageEl;if(t){const e=getComputedStyle(t).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(e)return"#"+e.slice(1,4).map(t=>(+t).toString(16).padStart(2,"0")).join("")}return"#111111"}async _runAlignToGrid(){const t=this._alignDialog;if(t&&!t.busy&&this._serverCfg){this._alignDialog={...t,busy:!0};try{this._serverCfg={...this._serverCfg,spaces:t.spaces},this._layout=t.layout;for(const e of Object.keys(t.layout))this._dirtyPos.add(e);this._modelCache=null,this._frame=null,await this._saveConfigNow(),await this._persistLayoutNow(),this._alignDialog=null,this.requestUpdate(),this._showToast(this._t("gs.align_done",{n:String(t.report.moved)}))}catch(t){this._alignDialog&&(this._alignDialog={...this._alignDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}}async _persistLayoutNow(){if(!this._serverStorage)return localStorage.setItem(dn,JSON.stringify(this._layout)),void this._dirtyPos.clear();const t=[...this._dirtyPos];this._dirtyPos.clear(),await Promise.all(t.map(t=>{const e=this._layout[t];return e?(this._sentPos.set(t,e),this.hass.callWS({type:"houseplan/layout/update",device_id:t,pos:e}).then(t=>this._noteLayoutRev(t)).finally(()=>{this._sentPos.get(t)===e&&this._sentPos.delete(t)})):Promise.resolve()})),this._cacheSnapshot()}_setFillColor(t,e){const i=this._settingsDialog;this._settingsDialog={...i,colors:{...i.colors,[t]:{...i.colors[t],...e}}}}async _saveSettingsDialog(){const t=this._settingsDialog;if(t&&!t.busy){this._settingsDialog={...t,busy:!0};try{const e=this._serverCfg,i=JSON.stringify(t.colors)===JSON.stringify(mi),s={...e.settings};i?delete s.fill_colors:s.fill_colors=t.colors;const o=this._imperial?30.48*t.glowRadius:100*t.glowRadius;Number.isFinite(o)&&o>0&&300!==Math.round(o)?s.glow_radius_cm=Math.round(o):delete s.glow_radius_cm,t.bgColor?s.bg_color=t.bgColor:delete s.bg_color,null!==t.northDeg&&Number.isInteger(t.northDeg)&&t.northDeg>=0&&t.northDeg<=359?s.north_deg=t.northDeg:delete s.north_deg,"daynight"===t.bgMode?s.bg_mode="daynight":delete s.bg_mode,t.sunRays?s.sun_rays=!0:delete s.sun_rays;const n=(t.weatherEntity||"").trim();n?s.weather_entity=n:delete s.weather_entity,this._serverCfg={...e,settings:s},await this._saveConfigNow(),this._settingsDialog=null,this.requestUpdate(),this._showToast(this._t("gs.saved"))}catch(t){this._settingsDialog&&(this._settingsDialog={...this._settingsDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}}_boolInput(t,e,i=!1){const s=t=>e(!!t.target.checked);return customElements.get("ha-switch")?B`<ha-switch .checked=${t} .disabled=${i} @change=${s}></ha-switch>`:B`<input type="checkbox" .checked=${t} ?disabled=${i} @change=${s} />`}_rangeInput(t,e,i,s,o){const n=t=>{const e=Number(t.target.value);Number.isFinite(e)&&o(e)};return customElements.get("ha-slider")?B`<ha-slider .min=${t} .max=${e} .step=${i} .value=${s} @input=${n} @change=${n}></ha-slider>`:B`<input type="range" min=${t} max=${e} step=${i} .value=${String(s)} @input=${n} />`}_renderColorRow(t,e){const i=this._settingsDialog.colors[t];return B`<div class="colorrow gsrow">
      <span class="gsl">${this._t(e)}</span>
      <input type="color" .value=${i.c}
        @input=${e=>this._setFillColor(t,{c:e.target.value})} />
      ${this._rangeInput(0,100,1,Math.round(100*i.a),e=>this._setFillColor(t,{a:e/100}))}
      <span class="opv">${Math.round(100*i.a)}%</span>
    </div>`}get _glowRadiusCm(){const t=Number(this._settings.glow_radius_cm);return Number.isFinite(t)&&t>0?t:300}get _imperial(){return"mi"===this.hass?.config?.unit_system?.length}get _glowRadiusPlaceholder(){const t=this._glowRadiusCm;return this._imperial?String(Math.round(t/30.48*10)/10):String(t/100)}_renderGlowLayer(t){const e=this._fillColors,i=this._glowRadiusCm/this._cellCm*this._gridPitch,s=this._gridPitch,o=t.rooms.map(t=>({r:t,poly:xe(t)})).filter(t=>!!t.poly),n=this._openingsR.filter(t=>"door"===t.type),r=[];for(const a of this._devices){if(a.space!==t.id)continue;if(a.hidden)continue;const l=Ws(this.hass,a);if(!l)continue;const c=Mi(this.hass.states[l],e.glow_light.c);if(!c)continue;const h=Number(a.marker?.glow_radius_cm),d=Number.isFinite(h)&&h>0?h/this._cellCm*this._gridPitch:i,p=this._pos(a),u=[...o].reverse().find(t=>this._pointInRoom([p.x,p.y],t.r));let _=null;if(u){const e=u.r.id?Pi(u.r.id,t.rooms):new Set([u.r.id]),i=o.filter(t=>t.r.id&&e.has(t.r.id)),r=i.length?i:[u],a=r.map(t=>"M "+t.poly.map(t=>t[0]+" "+t[1]).join(" L ")+" Z"),l=o.filter(t=>!r.includes(t)).map(t=>t.poly);for(const t of n){const e=r.some(e=>{const i=Re([t.rx,t.ry],e.poly);return i&&Math.hypot(i[0]-t.rx,i[1]-t.ry)<=.75*s});if(!e)continue;const i=t.angle*Math.PI/180,o=Math.cos(i)*t.rlen/2,n=Math.sin(i)*t.rlen/2;if(!Ci([t.rx,t.ry],t.angle,[p.x,p.y],l,.6*s))continue;const c=Di([p.x,p.y],[t.rx-o,t.ry-n],[t.rx+o,t.ry+n],d);c&&a.push("M "+c.map(t=>t[0]+" "+t[1]).join(" L ")+" Z")}_=a}r.push({pos:p,c:c.c,alpha:e.glow_light.a*c.bri,clip:_,r:d})}return r.length?j`<defs>
        ${r.map((t,e)=>j`
          <radialGradient id="hp-glow-${e}">
            <stop offset="0%" stop-color="${t.c}" stop-opacity="${t.alpha.toFixed(3)}"></stop>
            <stop offset="70%" stop-color="${t.c}" stop-opacity="${t.alpha.toFixed(3)}"></stop>
            <stop offset="100%" stop-color="${t.c}" stop-opacity="0"></stop>
          </radialGradient>
          ${t.clip?j`<clipPath id="hp-glowclip-${e}">${t.clip.map(t=>j`<path d="${t}"></path>`)}</clipPath>`:V}`)}
      </defs>
      <g class="glowlayer">
        ${r.map((t,e)=>j`<circle cx="${t.pos.x}" cy="${t.pos.y}" r="${t.r}"
          fill="url(#hp-glow-${e})" ${""}
          clip-path=${t.clip?`url(#hp-glowclip-${e})`:V}></circle>`)}
      </g>`:j``}_renderAlignDialog(){const t=this._alignDialog,e=t.report;return B`<div class="menuwrap dialogwrap" @click=${()=>this._alignDialog=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:grid"></ha-icon>${this._t("gs.align_title")}</div>
        <div class="body">
          ${0===e.moved?B`<p class="alignmsg">${this._t("gs.align_none")}</p>`:B`
              <p class="alignmsg">${this._t("gs.align_count",{n:String(e.moved),total:String(e.total),cm:String(t.cm)})}</p>
              ${t.where?B`<p class="alignmsg">${this._t("gs.align_where",{s:t.where})}</p>`:V}
              ${e.rotated?B`<p class="alignmsg">${this._t("gs.align_turned",{n:String(e.rotated)})}</p>`:V}
              <div class="rhint">${this._t("gs.align_warn")}</div>`}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._alignDialog=null}>${this._t("btn.cancel")}</button>
          ${0===e.moved?V:B`
            <button class="btn on" @click=${this._runAlignToGrid} ?disabled=${t.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("gs.align_run")}
            </button>`}
        </div>
      </div>
    </div>`}_renderSettingsDialog(){return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
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
          <label class="dispsection">${this._t("gs.glow_group")}</label>
          ${this._renderColorRow("glow_base","gs.glow_base")}
          ${this._renderColorRow("glow_light","gs.glow_light")}
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
          ${"static"===this._settingsDialog.bgMode?B`<div class="colorrow gsrow">
                <span class="gsl">${this._t("gs.bg_color")}</span>
                <input type="color" .value=${this._settingsDialog.bgColor||this._stageBgHex()}
                  @input=${t=>this._settingsDialog={...this._settingsDialog,bgColor:t.target.value}} />
                ${this._settingsDialog.bgColor?B`<button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,bgColor:null}}>${this._t("gs.bg_default")}</button>`:B`<span class="opl">${this._t("gs.bg_theme")}</span>`}
              </div>`:B`<div class="rhint">${this._t("gs.bg_daynight_hint")}</div>`}
          <label class="dispsection">${this._t("gs.sun_group")}</label>
          ${Ms(this.hass)?V:B`<div class="rhint">${this._t("gs.sun_missing")}</div>`}
          <div class="sunrow">
            ${this._renderCompass()}
            <div class="suncol">
              <span class="gsl">${this._t("gs.north")}</span>
              <div class="colorrow">
                <input class="namein tempin" type="number" min="0" max="359" step="1"
                  placeholder=${this._t("gs.north_ph")}
                  .value=${null===this._settingsDialog.northDeg?"":String(this._settingsDialog.northDeg)}
                  @input=${t=>{const e=t.target.value.trim(),i=""===e?null:Math.round(Number(e));this._settingsDialog={...this._settingsDialog,northDeg:null!==i&&Number.isFinite(i)?Math.min(359,Math.max(0,i)):null}}} />
                ${null!==this._settingsDialog.northDeg?B`<button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,northDeg:null}}>${this._t("gs.north_clear")}</button>`:V}
              </div>
              ${null===this._settingsDialog.northDeg?B`<div class="rhint">${this._t("gs.north_hint")}</div>`:V}
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
              ${Object.keys(this.hass?.states||{}).filter(t=>t.startsWith("weather.")).map(t=>B`<option value=${t}></option>`)}
            </datalist>
          </div>
          <label class="dispsection">${this._t("gs.grid_group")}</label>
          <div class="rhint">${this._t("gs.grid_hint")}</div>
          <div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._openAlignDialog}>
              <ha-icon icon="mdi:grid"></ha-icon>${this._t("gs.align_all")}
            </button>
          </div>
          <label class="dispsection">${this._t("gs.about_group")}</label>
          <div class="aboutver">${this._t("gs.about_version",{v:nn})}</div>
          <a class="aboutlink" href="https://github.com/Matysh/houseplan-card" target="_blank" rel="noopener">
            <ha-icon icon="mdi:github"></ha-icon>${this._t("gs.about_github")}</a>
          <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener">
            <ha-icon icon="mdi:send"></ha-icon>${this._t("gs.about_telegram")}</a>
        </div>
        <div class="row">
          <button class="btn ghost" @click=${()=>this._settingsDialog={...this._settingsDialog,colors:JSON.parse(JSON.stringify(mi)),glowRadius:this._imperial?9.8:3,bgColor:null,northDeg:null,bgMode:"static",sunRays:!1,weatherEntity:""}}>
            ${this._t("gs.reset")}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._settingsDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSettingsDialog} ?disabled=${this._settingsDialog.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this._settingsDialog.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_rulesSet(t){this._rulesDialog={...this._rulesDialog,rules:t}}async _saveRules(){const t=this._rulesDialog;if(!t||t.busy)return;const e=t.rules.filter(t=>t.pattern.trim()&&t.icon.trim());this._rulesDialog={...t,busy:!0};try{const t=this._serverCfg,i=JSON.stringify(e)===JSON.stringify(dt),s={...t.settings};i?delete s.icon_rules:s.icon_rules=e,this._serverCfg={...t,settings:s},await this._saveConfigNow(),this._rulesDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast(this._t("rules.saved"))}catch(t){this._rulesDialog&&(this._rulesDialog={...this._rulesDialog,busy:!1}),this._showToast(this._t("toast.error",{err:this._errText(t)}))}}_renderRulesDialog(){const t=this._rulesDialog,e=pt(t.rules),i=t.test.trim()?mt(t.test,"",e):null,s=(e,i)=>{const s=[...t.rules],o=e+i;o<0||o>=s.length||([s[e],s[o]]=[s[o],s[e]],this._rulesSet(s))};return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t("rules.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("rules.hint")}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this._t("rules.test_ph")}
              .value=${t.test}
              @input=${e=>this._rulesDialog={...t,test:e.target.value}} />
            ${i?B`<ha-icon icon=${i}></ha-icon><span class="rtesticon">${i}</span>`:V}
          </div>
          ${t.rules.map((e,i)=>{const o=""!==e.pattern.trim()&&!function(t){try{return new RegExp(t,"i"),!0}catch{return!1}}(e.pattern);return B`<div class="rrow">
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
    </div>`}_saveKioskScale(t){this._kioskScale={...this._kioskScale,...t};try{localStorage.setItem(gn,JSON.stringify(this._kioskScale))}catch{}this.requestUpdate()}_renderKioskDialog(){const t=this._kioskScale,e=(e,i)=>B`<label>${i}</label>
      <div class="colorrow">
        ${this._rangeInput(50,300,5,Math.round(100*t[e]),t=>this._saveKioskScale({[e]:t/100}))}
        <span class="opv">${Math.round(100*t[e])}%</span>
      </div>`;return B`<div class="menuwrap dialogwrap" @click=${()=>this._kioskDialog=!1}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:tablet"></ha-icon>${this._t("kiosk.title")}</div>
        <div class="body">
          <div class="rhint">${this._t("kiosk.hint")}</div>
          ${e("icon",this._t("kiosk.icon_scale"))}
          ${e("font",this._t("kiosk.font_scale"))}
        </div>
        <div class="row">
          <button class="btn ghost" @click=${()=>this._saveKioskScale({icon:1,font:1})}>${this._t("gs.reset")}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._kioskDialog=!1}>${this._t("btn.close")}</button>
        </div>
      </div>
    </div>`}render(){if(!this._config||!this.hass)return V;const t=this._model;if(!t.length)return B`<ha-card>
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
        ${this._spaceDialog?this._renderSpaceDialog():V}
        ${this._importDialog?this._renderImportDialog():V}
        ${this._toast?B`<div class="toast">${this._toast}</div>`:V}
      </ha-card>`;const e=this._spaceModel(),i=e.vb,s="devices"===this._mode&&this._showAll,o=this._devices.filter(t=>t.space===e.id&&(!t.hidden||s)),n=_i(this._curSpaceCfg),r=n.showLqi??this._config.show_signal??!0,a=this._config.icon_size??2.5,l=a>8?2.5:a,c=this._viewOr(i),h=this._editing?"":this._stageBg(n),d=this._editing||"daynight"!==this._effBgMode()?null:this._sunNow(),p=d?us(bs(d.elevation)).planDim:0,u=this._opMeasureView,_=this._decorMeasure,g=this._bdLive;return B`
      <ha-card>
        <div class="hdr ${this._kiosk?"kioskhide":""}">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title||this._t("card.title")}
          </div>
          <div class="tabs">
            ${t.map(t=>B`<button
                class="tab ${this._space===t.id?"active":""}"
                @click=${()=>{this._space=t.id,this._selId=null,this._navApplied=!0,this._showFar=!1,this._frame=null,this._restoreZoom(),this._saveNav()}}
              >
                ${t.title}${this._norm&&this._canEdit?B`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t("title.configure_space")}
                      @click=${e=>{e.stopPropagation(),this._openSpaceDialog("edit",t.id)}}></ha-icon>`:V}
              </button>`)}
            ${""}
            ${this._canEdit&&!this._kiosk?B`<button class="tab tabadd" title=${this._t("title.add_space")}
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`:V}
          </div>
          ${this._canEdit?B`<div class="modes">
                ${[["plan","mdi:floor-plan"],["devices","mdi:tune-variant"],["decor","mdi:draw"]].map(([t,e])=>B`<button class="modetab ${this._mode===t?"active":""}"
                    title=${this._t("mode."+t+"_tip")}
                    @click=${()=>{this._mode!==t&&this._setMode(t)}}>
                    <ha-icon icon=${e}></ha-icon><span class="ml">${this._t("mode."+t)}</span>
                    ${this._mode===t?B`<ha-icon class="closex" icon="mdi:close" title=${this._t("title.close_editor")}
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
          ${this._norm&&this._canEdit?B`<button class="btn" @click=${this._openSettingsDialog} title=${this._t("title.general_settings")}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>`:V}
        </div>
        ${this._markup?this._renderMarkupBar():"devices"===this._mode?this._renderDevicesBar():"decor"===this._mode?this._renderDecorBar():V}
        </div>

        <div class="stage ${this._markup?"markup tool-"+this._tool+("split"!==this._tool||this._splitSel?"":" pickstage")+("openwall"===this._tool&&this._openWallHover?" wallhot":""):""} ${"decor"===this._mode?"dtool-"+this._decorTool:""} ${e.bg?"":"noplan"} mode-${this._mode}${this._bdMovable?" bdgrab":""}${this._bdDrag?" bdgrabbing":""}${d?" daynight":""}${d&&this._skySnap?" skysnap":""}${this._booting?" hpboot":""}${this._bootSoft?" hpsettle":""}"
          style="height:${this._kiosk?"100dvh":`calc(100dvh - ${this._hdrH}px)`}${h?`;background:${h}`:""}"
          @click=${t=>this._markupClick(t)}
          @wheel=${t=>this._onWheel(t)}
          @pointerdown=${t=>{this._notePointer(t),this._stagePointerDown(t)}}
          @pointermove=${t=>this._stagePointerMove(t)}
          @pointerup=${t=>this._stagePointerUp(t)}
          @pointercancel=${t=>this._stagePointerUp(t)}>
          <div class="zoomwrap ${this._slide?"slide-"+this._slide:""}"
            style="${d?`filter:brightness(${(1-p).toFixed(3)})`:""}">
          <svg viewBox="${c.x} ${c.y} ${c.w} ${c.h}" preserveAspectRatio="xMidYMid meet">
            ${""}
            ${j`<g class="hp-paperg">${ke(e.rooms).map(t=>"poly"in t?j`<polygon class="hp-paper" points="${t.poly}" pointer-events="none"></polygon>`:j`<rect class="hp-paper" x="${t.rect.x}" y="${t.rect.y}" width="${t.rect.w}" height="${t.rect.h}" rx="${t.rect.rx}" pointer-events="none"></rect>`)}</g>`}
            ${this._editing?this._renderMarkupDefs(i):V}
            ${""}
            ${this._editing&&!this._markup&&this._gridLevels()?j`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:V}
            ${e.bg&&this._display(e.bg.href)?j`<image href="${this._display(e.bg.href)}" x="${e.bg.x}" y="${e.bg.y}" width="${e.bg.w}" height="${e.bg.h}" preserveAspectRatio="none" />`:V}
            ${this._renderDecorLayer()}
            ${(()=>{const t=this._openPairs(),i=new Map,s=t=>(i.has(t)||i.set(t,xe(t)),i.get(t));return e.rooms.filter(t=>t.area||this._markup||n.showBorders).map(i=>{let o="room "+(e.bg?"overlay":"yard")+(this._markup?" outlined":"");!this._markup||i.id!==this._mergeSel&&i.id!==this._splitSel?.roomId||(o+=" picked");let a="";const l=Ii(n.fill,i);if(!this._markup&&(n.showBorders||"none"!==l)){o+=" styled";const t=[];t.push(`--room-stroke:${n.color}`,`--room-stroke-op:${n.showBorders?n.opacity:0}`);const e="glow"===l?this._fillColors.glow_base:"temp"===l?yi("temp",null,"none",this._roomTemp(i),n.tempMin,n.tempMax,this._fillColors):i.area?yi(l,"lqi"===l?this._roomLqi(i.area):null,"light"===l?eo(this.hass,this._devices,i.area):"none",null,n.tempMin,n.tempMax,this._fillColors):null;e?(o+=" filled",t.push(`--room-fill:${e.c}`,`--room-fill-op:${e.a.toFixed(3)}`)):t.push("--room-fill:transparent","--room-fill-op:0"),a=t.join(";")}const c=t=>this._showTip(t,i.name,"",r?this._roomLqi(i.area):null,this._roomTemp(i)),h=!e.bg&&!n.showNames&&!this._markup,d=this._roomCenter(i),p=this._markup&&(i.id===this._mergeSel||i.id===this._splitSel?.roomId),u=i.id&&!p?t.filter(t=>t.a.id===i.id||t.b.id===i.id).flatMap(t=>t.segs):[];u.length&&(o+=" noedge");const _=s(i),g=_?function(t,e,i=1e-6){const s=e.filter(e=>qe(t,e,i));return s.filter(t=>!s.some(e=>e!==t&&qe(e,t,i)))}(_,(m=i,e.rooms.filter(t=>t!==m).map(s).filter(Boolean))):[];var m;const f=g.length&&_?j`<path class="${o}" style="${a}" fill-rule="evenodd"
                    d="${[_,...g].map(t=>"M "+t.map(t=>t[0]+" "+t[1]).join(" L ")+" Z").join(" ")}"
                    @mousemove=${c}
                    @mouseleave=${()=>this._tip=null}></path>`:i.poly?j`<polygon class="${o}" style="${a}" points="${i.poly.map(t=>t.join(",")).join(" ")}"
                    @mousemove=${c}
                    @mouseleave=${()=>this._tip=null}></polygon>`:j`<rect class="${o}" style="${a}"
                    x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="${.03*Math.min(i.w,i.h)}"
                    @mousemove=${c}
                    @mouseleave=${()=>this._tip=null}></rect>`,v=u.length&&_?function(t,e,i=1e-6){const s=[];for(let e=0;e<t.length;e++){const i=t[e],o=t[(e+1)%t.length];s.push([i[0],i[1],o[0],o[1]])}return Ri(s,e,i)}(_,u,.02*this._gridPitch):null,b=v?j`<path class="room-outline ${this._markup?"outlined":""}"
                    d="${v.map(t=>`M ${t[0]} ${t[1]} L ${t[2]} ${t[3]}`).join(" ")}"
                    style=${this._markup?V:`stroke:${n.color};stroke-opacity:${n.showBorders?n.opacity:0}`}></path>`:V;return j`${f}${b}${h?j`<text class="rlabel" x="${d[0]}" y="${d[1]}">${i.name}</text>`:V}`})})()}
            ${"glow"!==n.fill||this._markup?V:this._renderGlowLayer(e)}
            ${this._renderSunRays(e)}
            ${this._renderOpenWalls(n)}
            ${this._editing?this._renderAlignGuides():V}
            ${u?.guide?this._renderOpeningCenterTick(u.guide):V}
            ${this._markup?this._renderMarkupLayer(i):V}
            ${this._renderOpenings(n)}
            ${this._markup&&"resize"===this._tool?this._renderResizeLayer(c):V}
            ${""}
            ${this._renderBackdropFrame(c)}
            ${this._renderTextFrame(c)}
          </svg>
          ${""}
          <div class="devlayer" style="--icon-size:${Fo(l,e,c.w,this._kiosk?this._kioskScale.icon:1).toFixed(3)}cqw;--rl-font:${this._kiosk?this._kioskScale.font:1}">
            ${o.map(t=>this._renderDevice(t,c,r,"glow"===n.fill&&!this._markup))}
            ${this._renderVacuums(o,c)}
            ${this._renderVacFit(c)}
            ${this._renderOpeningLocks(c)}
            ${n.showNames||this._markup?e.rooms.map(t=>this._renderRoomLabel(t,e,c,n)):V}
            ${this._markup?e.rooms.map(t=>this._renderRoomGear(t,e,c)):V}
          </div>
          ${this._measureAnchor?B`<div class="measurelayer">${this._renderMeasureLabel(c)}</div>`:V}
          ${this._rszLive?B`<div class="measurelayer">${this._rszLive.map(t=>B`<div
                class="measurelabel ${t.area?"rszarea":""}"
                style="left:${((t.x-c.x)/c.w*100).toFixed(2)}%;top:${((t.y-c.y)/c.h*100).toFixed(2)}%">${t.text}</div>`)}</div>`:V}
          ${u?B`<div class="measurelayer">${u.labels.map(t=>B`<div
                class="measurelabel opshoulder"
                style="left:${((t.x-c.x)/c.w*100).toFixed(2)}%;top:${((t.y-c.y)/c.h*100).toFixed(2)}%">${t.text}</div>`)}</div>`:V}
          ${_?B`<div class="measurelayer"><div
                class="measurelabel dmeasure ${_.on45?"on45":""}"
                style="left:${((_.x-c.x)/c.w*100).toFixed(2)}%;top:${((_.y-c.y)/c.h*100).toFixed(2)}%">${_.text}</div></div>`:V}
          ${g?B`<div class="measurelayer"><div
                class="measurelabel bdmeasure"
                style="left:${((g.x-c.x)/c.w*100).toFixed(2)}%;top:${((g.y-c.y)/c.h*100).toFixed(2)}%">${g.text}</div></div>`:V}
          </div>
          ${this._zoom>1?B`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:V}
          ${this._renderFarHint()}
          ${this._renderHomeArrow()}
          ${this._booting||this._bootFading?B`<div class="bootveil ${this._booting?"":"off"}" aria-hidden="true">
                <svg class="boothouse" viewBox="0 0 24 24"><path d="${"M10,2V4.26L12,5.59V4H22V19H17V21H24V2H10M7.5,5L0,10V21H15V10L7.5,5M14,6V6.93L15.61,8H16V6H14M18,6V8H20V6H18M7.5,7.5L13,11V19H10V13H5V19H2V11L7.5,7.5M18,10V12H20V10H18M18,14V16H20V14H18Z"}"></path></svg>
              </div>`:V}
        </div>

        ${this._roomDialog?this._renderRoomDialog():V}
        ${this._mergeDialog?this._renderMergeDialog():V}
        ${this._openingDialog?this._renderOpeningDialog():V}
        ${this._openingInfo?this._renderOpeningInfoCard():V}
        ${this._decorTextDialog?this._renderDecorTextDialog():V}
        ${this._spaceDialog?this._renderSpaceDialog():V}
        ${this._markerDialog?this._renderMarkerDialog():V}
        ${this._infoCard?this._renderInfoCard():V}
        ${this._rulesDialog?this._renderRulesDialog():V}
        ${this._settingsDialog?this._renderSettingsDialog():V}
        ${this._alignDialog?this._renderAlignDialog():V}
        ${this._importDialog?this._renderImportDialog():V}
        ${this._tip?B`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?B`<span class="m">${this._tip.meta}</span>`:V}
              ${null!=this._tip.temp?B`<span class="m">${this._t("tip.temp_avg")} <b>${this._tip.temp}°</b></span>`:V}
              ${null!=this._tip.lqi?B`<span class="m">${this._t("tip.lqi")}
                    <b style="color:${be(this._tip.lqi)}">${this._tip.lqi}</b></span>`:V}
            </div>`:V}
        ${this._kiosk&&this._kioskDots&&this._model.length>1?B`<div class="kioskdots">
              ${this._model.map(t=>B`<span class="kdot ${t.id===this._space?"on":""}"></span>`)}
            </div>`:V}
        ${this._kioskDialog?this._renderKioskDialog():V}
        ${this._vacFit?B`<div class="vaccalbar">
          <span>${this._t("vac.fit_hint")}</span>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({rot:(this._vacFit.p.rot+90)%360})}>${this._t("vac.fit_rotate")}</button>
          <button class="btn ghostbtn" @click=${()=>this._vacFitTurn({mir:!this._vacFit.p.mir})}>${this._t("vac.fit_mirror")}</button>
          <button class="btn" @click=${()=>this._vacFitSave()}>${this._t("btn.save")}</button>
          <button class="btn ghostbtn" @click=${()=>{this._vacFit=null}}>${this._t("btn.cancel")}</button>
        </div>`:V}
        ${this._tapConfirm?B`<div class="menuwrap dialogwrap" @click=${()=>this._tapConfirm=null}>
              <div class="dialog" @click=${t=>t.stopPropagation()}>
                <div class="body"><p>${this._tapConfirm.text}</p></div>
                <div class="row">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${()=>this._tapConfirm=null}>${this._t("btn.cancel")}</button>
                  <button class="btn on" @click=${()=>{const t=this._tapConfirm;this._tapConfirm=null,t.exec()}}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.run")}
                  </button>
                </div>
              </div>
            </div>`:V}
        ${this._toast?B`<div class="toast">${this._toast}</div>`:V}
      </ha-card>
    `}_vacSource(t){const e=t.marker?.vacuum;if(!1===e?.live)return null;if(e?.source&&this.hass?.states[e.source])return e.source;for(const e of t.entities||[])if(Rs(this.hass?.states[e]))return e;return null}_vacEntity(t){return t.primary?.startsWith("vacuum.")?t.primary:(t.entities||[]).find(t=>t.startsWith("vacuum."))||null}_isVacDev(t){return!!this._vacEntity(t)}_senseTick(){if(this.hass)for(const t of this._devices){if(t.hidden||!t.primary||!t.primary.startsWith("binary_sensor."))continue;const e=this.hass.states[t.primary];if("motion"!==e?.attributes?.device_class)continue;const i=this._senseRt.get(t.id);i?("on"===e.state&&"off"===i.last&&(i.flashTs=Date.now(),i.gen++,clearTimeout(i.timer),i.timer=window.setTimeout(()=>this.requestUpdate(),3360)),i.last=e.state):this._senseRt.set(t.id,{last:e.state,flashTs:0,timer:0,gen:0})}}_vacTick(){if(this.hass)for(const t of this._devices){if(t.hidden||!this._isVacDev(t))continue;const e=this._vacSource(t);if(!e)continue;const i=this._vacEntity(t),s=Os(this.hass.states[i||""]?.state),o=Ps(this.hass.states[e]?.attributes);let n=this._vacRt.get(t.id);n||(n={trail:[],lastKey:"",lastTs:0,moving:!1,jump:!1,endedTs:0,lastPos:null},this._vacRt.set(t.id,n)),s&&!n.moving&&(n.trail=[],n.lastPos=null);const r="never"!==qs(t.marker?.vacuum)&&!o?.path;!s&&n.moving&&(n.endedTs=Date.now(),r&&n.lastPos&&(n.trail=Ns(n.trail,n.lastPos,40)),n.lastPos=null),n.moving=s;const a=o?.pos;if(s&&a){const t=a.x+":"+a.y;if(t!==n.lastKey){const e=Date.now();n.jump=n.lastTs>0&&e-n.lastTs>1e4,n.lastKey=t,n.lastTs=e,r&&n.lastPos&&(n.trail=Ns(n.trail,n.lastPos,40)),n.lastPos=[a.x,a.y]}}}}_vacEnsureMarker(t){const e=this._serverCfg;if(!e)return null;e.markers=e.markers||[];const i=e.markers.find(e=>e.id===t.id);if(i)return i;if("device"!==t.bindingKind&&"entity"!==t.bindingKind||!t.bindingRef)return null;const s={id:t.id,binding:t.bindingKind+":"+t.bindingRef,space:t.space||null,area:t.area||null,hidden:!!t.hidden};return e.markers.push(s),s}_renderVacSection(t){const e=this._devices.find(e=>e.id===t.devId);if(!e||!this._isVacDev(e))return V;const i=e.marker?.vacuum||{},s=this._vacSource(e),o=s?Ps(this.hass?.states[s]?.attributes):null,n=!!(o&&o.rooms.length>=3),r=o?.pos?di(this._t("vac.status_found"),{name:s||""}):this._t("vac.status_none"),a=Object.keys(i.calibration||{}),l=t=>{const i=this._vacEnsureMarker(e);i&&(i.vacuum={...i.vacuum||{},...t},this._regSignature="",this._saveConfig(),this.requestUpdate())};return B`
      <label>${this._t("vac.section")}</label>
      <div class="bindbox vacbox">
        <div class="rhint">${r}</div>
        ${o?B`
          <div class="vacbtns">
            ${n?B`<button class="btn" @click=${()=>this._vacAutoCalibrate(e)}>${this._t("vac.autocal")}</button>`:V}
            <button class="btn ghostbtn" @click=${()=>this._vacStartFit(e)}>${this._t("vac.fit")}</button>
          </div>
          <label class="srcrow">
            ${this._boolInput(!1!==i.live,t=>l({live:!!t&&null}))}
            <span>${this._t("vac.live")}</span>
          </label>
          <label>${this._t("vac.trail")}</label>
          <select class="areasel"
            @change=${t=>l({trail_mode:t.target.value,trail:null})}>
            ${["never","cleaning","always"].map(t=>B`
              <option value=${t} ?selected=${qs(i)===t}>${this._t("vac.trail_"+t)}</option>`)}
          </select>
          ${a.length?B`<div class="rhint">${di(this._t("vac.cal_maps"),{maps:a.join(", ")})}</div>`:V}
        `:V}
      </div>`}_vacMapId(t,e){const i=this._vacEntity(t),s=i?this.hass?.states[i]?.attributes?.selected_map:null;return o=e.mapId,n=s,"default"!==o?o:null!=n?String(n):"default";var o,n}_vacSaveMatrix(t,e,i,s){const o=this._devices.find(e=>e.id===t),n=o?this._vacEnsureMarker(o):this._serverCfg?.markers?.find(e=>e.id===t);if(!n)return!1;const r={...n.vacuum||{}};return r.source=e,r.calibration={...r.calibration||{},[i]:s.map(t=>Number(t.toFixed(6)))},n.vacuum=r,this._regSignature="",this._saveConfig(),this.requestUpdate(),!0}_vacAutoCalibrate(t){const e=this._vacSource(t),i=e?Ps(this.hass?.states[e]?.attributes):null;if(!e||!i||i.rooms.length<3)return void this._showToast(this._t("vac.autocal_no_rooms"));const s=this._spaceModel(t.space),o=(s?.rooms||[]).map(t=>({r:t,poly:xe(t)})).filter(({r:t,poly:e})=>t.name&&e).map(({r:t,poly:e})=>{const i=Ie(e);return{name:t.name,cx:i[0],cy:i[1]}}),n=Es(i.rooms,o);n?this._vacSaveMatrix(t.id,e,this._vacMapId(t,i),n.matrix)&&(n.residual>50&&this._showToast(di(this._t("vac.autocal_res_warn"),{rooms:String(n.matched.length)})),this._showToast(di(this._t("vac.autocal_done"),{rooms:String(n.matched.length)}))):this._showToast(this._t("vac.autocal_no_match"))}_vacStartFit(t){const e=this._vacSource(t),i=e?Ps(this.hass?.states[e]?.attributes):null;if(!e||!i)return void this._showToast(this._t("vac.cal_need_pos"));const s=this._vacMapId(t,i),o=t.marker?.vacuum?.calibration?.[s],n=this._spaceModel(t.space),r=n?.vb||[0,0,mn,mn],a=o&&6===o.length&&function(t){const e=t[0]*t[4]-t[1]*t[3];if(!Number.isFinite(e)||Math.abs(e)<1e-12)return null;const i=e<0,s=Math.sqrt(Math.abs(e));let o=180*Math.atan2(-t[1],t[4])/Math.PI;return o=(90*Math.round(o/90)%360+360)%360,{ox:t[2],oy:t[5],s:s,rot:o,mir:i}}(o)||function(t,e){const i=[],s=[];for(const e of t)null!=e.x0?(i.push(e.x0,e.x1),s.push(e.y0,e.y1)):(i.push(e.cx),s.push(e.cy));if(!i.length)return{ox:e[0]+e[2]/2,oy:e[1]+e[3]/2,s:e[2]/1e4,rot:0,mir:!0};const o=Math.min(...i),n=Math.max(...i),r=Math.min(...s),a=Math.max(...s),l=Math.max(n-o,a-r)||1,c={ox:0,oy:0,s:.6*Math.min(e[2],e[3])/l,rot:0,mir:!0},h=Fs(c),[d,p]=Cs(h,(o+n)/2,(r+a)/2);return c.ox=e[0]+e[2]/2-d,c.oy=e[1]+e[3]/2-p,c}(i.rooms,r);this._markerDialog=null,t.space!==this._space&&(this._space=t.space),this._vacFit={markerId:t.id,source:e,mapId:s,p:a,drag:null}}_vacFitSave(){const t=this._vacFit;if(!t)return;const e=this._vacSaveMatrix(t.markerId,t.source,t.mapId,Fs(t.p));this._vacFit=null,e&&this._showToast(this._t("vac.cal_done"))}_vacFitTurn(t){const e=this._vacFit;if(!e)return;const i=Ps(this.hass?.states[e.source]?.attributes),s=this._vacGhostCentre(i?.rooms||[]),o={...e.p,...t};this._vacFit={...e,p:Ls(o,e.p,s[0],s[1])}}_vacGhostCentre(t){const e=[],i=[];for(const s of t)e.push(s.x0??s.cx,s.x1??s.cx),i.push(s.y0??s.cy,s.y1??s.cy);return e.length?[(Math.min(...e)+Math.max(...e))/2,(Math.min(...i)+Math.max(...i))/2]:[0,0]}_vacDelta(t,e,i){const s=this._stageEl,o=s?.clientWidth||1,n=s?.clientHeight||1;return[e/o*t.w,i/n*t.h]}_vacFitPointer(t,e){const i=this._vacFit;if(!i)return;if(t.stopPropagation(),"pointerdown"===t.type){const e=t.target,s=e.getAttribute?.("data-corner");try{t.currentTarget.setPointerCapture?.(t.pointerId)}catch{}return void(this._vacFit={...i,drag:s?{kind:"scale",sx:t.clientX,sy:t.clientY,p0:{...i.p},fx:Number(s.split(",")[0]),fy:Number(s.split(",")[1])}:{kind:"move",sx:t.clientX,sy:t.clientY,p0:{...i.p},fx:0,fy:0}})}const s=i.drag;if(s){if("pointermove"===t.type){const[o,n]=this._vacDelta(e,t.clientX-s.sx,t.clientY-s.sy);if("move"===s.kind)this._vacFit={...i,p:{...s.p0,ox:s.p0.ox+o,oy:s.p0.oy+n}};else{const t=Ps(this.hass?.states[i.source]?.attributes),e=this._vacGhostCentre(t?.rooms||[]),r=Fs(s.p0),[a,l]=Cs(r,e[0],e[1]),[c,h]=Cs(r,s.fx,s.fy),d=Math.hypot(a-c,l-h)||1,[p,u]=[2*a-c,2*l-h],_=Math.hypot(p+2*o-c,u+2*n-h)/2,g=Math.max(.05,_/d),m={...s.p0,s:s.p0.s*g};this._vacFit={...i,p:Ls(m,s.p0,s.fx,s.fy)}}return}"pointerup"!==t.type&&"pointercancel"!==t.type||(this._vacFit={...i,drag:null})}}_renderVacFit(t){const e=this._vacFit;if(!e)return V;const i=Ps(this.hass?.states[e.source]?.attributes);if(!i)return V;const s=Fs(e.p),o=[],n=[],r=[];for(const t of i.rooms){if(null==t.x0)continue;const e=[[t.x0,t.y0],[t.x1,t.y0],[t.x1,t.y1],[t.x0,t.y1]].map(([t,e])=>Cs(s,t,e));e.forEach(([t,e])=>{n.push(t),r.push(e)});const[i,a]=Cs(s,t.cx,t.cy);o.push(j`<polygon points="${e.map(t=>t[0].toFixed(1)+","+t[1].toFixed(1)).join(" ")}"></polygon>
        <text x="${i.toFixed(1)}" y="${a.toFixed(1)}">${t.name}</text>`)}let a=V;if(i.pos){const[e,o]=Cs(s,i.pos.x,i.pos.y);a=j`<circle class="vacfitdot" cx="${e.toFixed(1)}" cy="${o.toFixed(1)}" r="${(.012*t.w).toFixed(1)}"></circle>`}const l=[];if(n.length){const e=(()=>{const t=s[0]*s[4]-s[1]*s[3];return(e,i)=>[(s[4]*(e-s[2])-s[1]*(i-s[5]))/t,(-s[3]*(e-s[2])+s[0]*(i-s[5]))/t]})(),i=Math.min(...n),o=Math.max(...n),a=Math.min(...r),c=Math.max(...r),h=.022*t.w;for(const[t,s,n,r]of[[i,a,o,c],[o,a,i,c],[o,c,i,a],[i,c,o,a]]){const i=e(n,r);l.push(j`<circle class="vacfithandle" data-corner="${i[0]+","+i[1]}"
          cx="${t.toFixed(1)}" cy="${s.toFixed(1)}" r="${h.toFixed(1)}"></circle>`)}}return B`<svg class="vacfit" viewBox="${t.x} ${t.y} ${t.w} ${t.h}"
        preserveAspectRatio="none"
        @pointerdown=${e=>this._vacFitPointer(e,t)}
        @pointermove=${e=>this._vacFitPointer(e,t)}
        @pointerup=${e=>this._vacFitPointer(e,t)}
        @pointercancel=${e=>this._vacFitPointer(e,t)}>${o}${a}${l}</svg>`}_vacRafLoop(){this._vacRaf=requestAnimationFrame(()=>{const t=this.renderRoot,e=this._stageEl,i=this._vacLastView,s=t?.querySelectorAll?.(".vacpuck")||[];if(!e||!i||!s.length)return void(this._vacRaf=0);const o=e.getBoundingClientRect();for(const e of s){const s=e.getAttribute("data-mid"),n=e.getBoundingClientRect(),r=i.x+(n.left+n.width/2-o.left)/o.width*i.w,a=i.y+(n.top+n.height/2-o.top)/o.height*i.h;for(const e of t.querySelectorAll(`line.tip[data-mid="${s}"]`))e.setAttribute("x2",r.toFixed(1)),e.setAttribute("y2",a.toFixed(1))}this._vacRafLoop()})}_renderVacuums(t,e){if(this._markup||"decor"===this._mode)return V;const i=this._space+"|"+e.x+"|"+e.y+"|"+e.w+"|"+e.h,s=this._vacJumpOnce||i!==this._vacViewKey;this._vacViewKey=i,this._vacJumpOnce=!1;const o=[],n=[];for(const i of t){if(i.hidden||!this._isVacDev(i))continue;const t=this._vacSource(i);if(!t)continue;const r=Ps(this.hass?.states[t]?.attributes);if(!r)continue;const a=i.marker?.vacuum?.calibration?.[this._vacMapId(i,r)];if(!a||6!==a.length)continue;const l=this._vacRt.get(i.id),c=l?.moving??!1,h=qs(i.marker?.vacuum),d="always"===h||"cleaning"===h&&c,p=this._vacSrvTrails[i.id],u=this._vacMapId(i,r),_=p?.current?.map_id===u&&Array.isArray(p.current.points)?p.current:null,g=p?.previous?.map_id===u&&Array.isArray(p.previous.points)?p.previous:null;if("always"===h&&g&&g.points.length>1){const t=g.points.map(([t,e])=>{const[i,s]=Cs(a,t,e);return i.toFixed(1)+","+s.toFixed(1)}).join(" ");n.push(j`<g class="prev"><polyline class="case" points="${t}"></polyline><polyline class="core" points="${t}"></polyline></g>`)}if(d&&(c||_)){const t=_?.points||r.path||l?.trail||[],e=c&&(_||r.path)&&t.length>1?t.slice(0,-1):t;if(e.length>1){const t=e.map(([t,e])=>{const[i,s]=Cs(a,t,e);return i.toFixed(1)+","+s.toFixed(1)}).join(" ");if(n.push(j`<polyline class="case" points="${t}"></polyline><polyline class="core" points="${t}"></polyline>`),c){const[t,s]=Cs(a,e[e.length-1][0],e[e.length-1][1]),o=t.toFixed(1),r=s.toFixed(1);n.push(j`<line class="case tip" data-mid="${i.id}" x1="${o}" y1="${r}" x2="${o}" y2="${r}"></line><line class="core tip" data-mid="${i.id}" x1="${o}" y1="${r}" x2="${o}" y2="${r}"></line>`)}}}if(!c||!r.pos)continue;const[m,f]=Cs(a,r.pos.x,r.pos.y),v=(m-e.x)/e.w*100,b=(f-e.y)/e.h*100,y=l&&l.lastTs>0&&Date.now()-l.lastTs>6e4,w=i.marker?.icon||i.icon||"mdi:robot-vacuum";o.push(B`<div
        data-mid="${i.id}"
        class="vacpuck ${l?.jump||s?"jump":""} ${y?"stale":""}"
        style="left:${v}%;top:${b}%"
        title=${i.name}
        @click=${t=>{t.stopPropagation();const e=this._vacEntity(i);e&&this._openMoreInfo(e)}}>
        <ha-icon .icon=${w}></ha-icon>
      </div>`)}return this._vacLastView=e,o.length&&!this._vacRaf&&this._vacRafLoop(),o.length||n.length?B`
      ${n.length?j`<svg class="vactrail" viewBox="${e.x} ${e.y} ${e.w} ${e.h}" preserveAspectRatio="none">${n}</svg>`:V}
      ${o}`:V}_renderDevice(t,e,i=!0,s=!1){const o=this._pos(t),n=(o.x-e.x)/e.w*100,r=(o.y-e.y)/e.h*100;let a=t.hidden?"":this._stateClass(t);s&&"on"===a&&Ws(this.hass,t)&&(a="");const l=t.hidden?null:this._liveTemp(t),c=t.hidden?null:this._liveHum(t),h=!i||t.virtual||t.hidden?null:Vs(this.hass,t.entities),d=t.marker,p=d?.display||"badge",u=("ripple"===p||"icon_ripple"===p)&&!t.hidden,_=this._actEntity(t),g=_?this.hass.states[_]:void 0,m="value"!==p||t.hidden?null:null!=l?l+"°":null!=c?c+"%":g&&!isNaN(parseFloat(g.state))?parseFloat(g.state)+(g.attributes?.unit_of_measurement?" "+g.attributes.unit_of_measurement:""):null,f=_?_.split(".")[0]:null,v=this._config?.live_states&&!t.hidden?ki(t.icon,f,g?.attributes?.device_class,g?.state,!!d?.icon):t.icon,b=(d?.controls||[]).filter(Ti),y=this._config?.live_states&&!t.hidden?b.length?b.map(t=>Si(this.hass.states[t])).find(t=>t)||null:"light"===f?Si(g):null:null,w=this._config?.live_states&&!t.hidden&&function(t,e,i){return"on"===i&&("siren"===t||"binary_sensor"===t&&!!e&&Ui.has(e))}(f,g?.attributes?.device_class,g?.state),$=u&&!t.hidden&&!!_&&Ce(this.hass.states[_]?.state),x=Number(d?.size)>0?Number(d.size):1,k=Number(d?.angle)||0,S=Number(d?.ripple_size)>0?Number(d.ripple_size):3,M=[`left:${n}%`,`top:${r}%`];return 1!==x&&M.push(`--dev-scale:${x}`),u&&(M.push(`--ripple-scale:${S}`),d?.ripple_color?M.push(`--ripple-color:${d.ripple_color}`):y&&M.push(`--ripple-color:${y}`)),B`<div
      class="dev ${a} ${this._selId===t.id?"sel":""} ${t.virtual?"virtual":""} ${t.hidden?"ghost":""} ${"ripple"!==p||t.hidden?"":"noicon"} ${null!=m?"valonly":""} ${w?"alarm":""}"
      style="${M.join(";")}"
      @click=${e=>this._clickDevice(e,t)}
      @contextmenu=${e=>this._ctxDevice(e,t)}
      @mousemove=${e=>this._showTip(e,t.name,t.model+(null!=l?" · "+l+"°":"")+(null!=c?" · "+c+"%":"")+(null!=h?" · LQI "+h:""))}
      @mouseleave=${()=>this._tip=null}
      @pointerdown=${e=>this._pointerDown(e,t)}
      @pointermove=${e=>this._pointerMove(e,t)}
      @pointerup=${e=>this._pointerUp(e,t)}
      @pointercancel=${e=>this._pointerUp(e,t)}
    >
      ${u?B`<span class="ripple ${$?"active":""}"><i></i><i></i><i></i></span>`:V}
      ${this._newIds.has(t.id)?B`<span class="newdot" title=${this._t("device.new")}></span>`:V}
      ${null!=m?B`<span class="valtext">${m}</span>`:"ripple"!==p||t.hidden?B`<ha-icon icon="${v}" style=${k?`transform:rotate(${k}deg)`:V}></ha-icon>`:V}
      ${null!=l&&null==m?B`<span class="tval">${l}°</span>`:V}
      ${null!=c&&null==m?B`<span class="hval">${c}%</span>`:V}
      ${null!=h?B`<span class="lqi" style="color:${be(h)}">${h}</span>`:V}
    </div>`}_roomTemp(t){const e=t.settings?.temp_source;return e?io(this.hass,e,"temp"):t.area?this._climate().get(t.area)?.temp??null:null}_roomHum(t){const e=t.settings?.hum_source;return e?io(this.hass,e,"hum"):t.area?this._climate().get(t.area)?.hum??null:null}_climate(){const t=this._serverCfg?.markers,e=this._climateCache;if(e&&e.h===this.hass&&e.r===this._iconRules&&e.mk===t)return e.m;const i=function(t,e,i){const s=new Map;if(!t?.entities)return s;const o=new Set;for(const t of i||[]){if(!0!==t?.use_climate_temp)continue;const e=(t.binding||"").indexOf(":");e>0&&o.add(t.binding.slice(e+1))}const n=new Map;for(const[e,i]of Object.entries(t.entities)){const s=i.device_id?t.devices?.[i.device_id]:null,r=i.area_id||s?.area_id||null;if(!r)continue;if(i.entity_category)continue;if(!(o.size>0&&e.startsWith("climate.")&&(o.has(e)||i.device_id&&o.has(i.device_id)))){if(ht.has(i.platform))continue;if(so.test(e))continue}let a=n.get(r);a||(a=new Map,n.set(r,a));const l=i.device_id||e;let c=a.get(l);if(!c){const o=t.states?.[e];c={name:(s?s.name_by_user||s.name:i.name||o?.attributes?.friendly_name||e)||e,model:s?.model,ents:[]},a.set(l,c)}c.ents.push(e)}for(const[i,r]of n){const n=[],a=[];for(const[i,s]of r){const r=Js(t,s.name,s.model,s.ents,e),l="mdi:thermometer"===r||"mdi:air-filter"===r;if(l){const e=Gs(t,s.ents);null!=e&&n.push(e)}if(o.size>0&&(o.has(i)||s.ents.some(t=>o.has(t)))){const e=Ks(t,s.ents);null!=e&&n.push(e)}if(l||"mdi:water-percent"===r){const e=Xs(t,s.ents);null!=e&&a.push(e)}}(n.length||a.length)&&s.set(i,{temp:n.length?Math.round(n.reduce((t,e)=>t+e,0)/n.length*10)/10:null,hum:a.length?Math.round(a.reduce((t,e)=>t+e,0)/a.length):null})}return s}(this.hass,this._iconRules,t);return this._climateCache={h:this.hass,r:this._iconRules,mk:t,m:i},i}_resetRoomDialogFields(){this._roomEditId=null,this._roomFill="",this._roomTempSrc="",this._roomHumSrc="",this._roomSrcOpen=null,this._roomSrcFilter="",this._roomNameScale=1,this._roomLabelScale=1}_openRoomEdit(t){t.id&&(this._roomEditId=t.id,this._nameSel=t.name||"",this._areaSel=t.area||"",this._roomFill=t.settings?.fill_mode||"",this._roomTempSrc=t.settings?.temp_source||"",this._roomHumSrc=t.settings?.hum_source||"",this._roomNameScale=Fi(t.settings?.name_scale),this._roomLabelScale=Fi(t.settings?.label_scale),this._roomSrcOpen=null,this._roomSrcFilter="",this._roomDialog=!0)}_roomSettingsFromDialog(){const t={};return this._roomFill&&(t.fill_mode=this._roomFill),this._roomTempSrc&&(t.temp_source=this._roomTempSrc),this._roomHumSrc&&(t.hum_source=this._roomHumSrc),1!==this._roomNameScale&&(t.name_scale=this._roomNameScale),1!==this._roomLabelScale&&(t.label_scale=this._roomLabelScale),Object.keys(t).length?t:null}_saveRoomEdit(){const t=this._curSpaceCfg,e=t?.rooms.find(t=>t.id===this._roomEditId);if(!e)return this._roomDialog=!1,void(this._roomEditId=null);e.name=this._nameSel.trim()||e.name,e.area=this._areaSel||null;const i=this._roomSettingsFromDialog();i?e.settings=i:delete e.settings,this._saveConfig(),this._roomDialog=!1,this._roomEditId=null,this._nameSel="",this._areaSel="",this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate(),this._showToast(this._t("toast.room_updated"))}_roomSrcCandidates(){const t=this.hass,e=this._roomSrcFilter.trim().toLowerCase(),i=[];for(const s of Object.values(t.devices)){if("service"===s.entry_type)continue;const t=(s.name_by_user||s.name||s.id).trim();e&&!t.toLowerCase().includes(e)||i.push({value:"device:"+s.id,label:t,sub:s.model||this._t("marker.sub_device")})}for(const[s,o]of Object.entries(t.entities)){if(!s.startsWith("sensor.")||o.hidden)continue;const n=o.name||t.states[s]?.attributes?.friendly_name||s;e&&!(n+" "+s).toLowerCase().includes(e)||i.push({value:"entity:"+s,label:n,sub:s})}return i.sort((t,e)=>t.label.localeCompare(e.label)),i.slice(0,200)}_roomSrcLabel(t){const e=t.indexOf(":"),i=t.slice(0,e),s=t.slice(e+1);return"device"===i?this.hass.devices[s]?.name_by_user||this.hass.devices[s]?.name||s:this.hass.entities[s]?.name||this.hass.states[s]?.attributes?.friendly_name||s}_labelPos(t,e){const i=this._layout["rl_"+(t.id||"")];if(i&&i.s===e)return{x:i.x*mn,y:i.y*mn};const s=this._snap(this._roomCenter(t));return{x:s[0],y:s[1]}}_labelDown(t,e,i){if("plan"!==this._mode)return;t.preventDefault(),t.stopPropagation();const s=this._labelPos(e,i);this._drag={id:"rl_"+(e.id||""),sx:t.clientX,sy:t.clientY,ox:s.x,oy:s.y,moved:!1},yn(t),this._tip=null}_labelMove(t,e,i){const s="rl_"+(e.id||"");if(!this._drag||this._drag.id!==s)return;const o=this._stageEl;if(!o)return;const n=this._spaceModel(i).vb,r=o.getBoundingClientRect(),a=this._viewOr(n),l=(t.clientX-this._drag.sx)/r.width*a.w,c=(t.clientY-this._drag.sy)/r.height*a.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0);const h=ko(this._drag.ox+l),d=ko(this._drag.oy+c);this._savePos({id:s,space:i},h,d,t.shiftKey)}_labelUp(t){const e="rl_"+(t.id||"");if(!this._drag||this._drag.id!==e)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&window.setTimeout(()=>this._drag=null,0)}_labelScale(t){const e=this._layout["rl_"+(t.id||"")]?.k;return"number"==typeof e&&Number.isFinite(e)?Math.min(3,Math.max(.5,e)):1}_rlResizeDown(t,e,i){if("plan"!==this._mode)return;t.preventDefault(),t.stopPropagation();const s=t.target.closest(".roomlabel");if(!s)return;const o=s.getBoundingClientRect(),n=o.left+o.width/2,r=o.top+o.height/2,a=Math.max(8,Math.hypot(t.clientX-n,t.clientY-r));this._rlResize={id:"rl_"+(e.id||""),space:i,k0:this._labelScale(e),cx:n,cy:r,d0:a},yn(t)}_rlResizeMove(t){const e=this._rlResize;if(!e)return;t.stopPropagation();const i=Math.max(8,Math.hypot(t.clientX-e.cx,t.clientY-e.cy)),s=Math.min(3,Math.max(.5,e.k0*(i/e.d0))),o=this._layout[e.id];if(o)this._layout={...this._layout,[e.id]:{...o,k:s}};else{const t=e.id.slice(3),i=this._spaceModel(e.space).rooms.find(e=>e.id===t);if(!i)return;const o=this._labelPos(i,e.space);this._layout={...this._layout,[e.id]:{s:e.space,x:o.x/mn,y:o.y/mn,k:s}}}this._dirtyPos.add(e.id)}_rlResizeUp(){this._rlResize&&(this._rlResize=null,this._persistLayout())}_renderRoomGear(t,e,i){if(!t.id)return V;let s=null;if(t.poly?(s=this._gearPtCache.get(t.poly)||null,s||(s=Ie(t.poly),this._gearPtCache.set(t.poly,s))):null!=t.x&&null!=t.y&&(s=[t.x+(t.w||0)/2,t.y+(t.h||0)/2]),!s)return V;const o=(s[0]-i.x)/i.w*100,n=(s[1]-i.y)/i.h*100;return B`<button class="rlgearbtn" style="left:${o}%;top:${n}%"
      title=${this._t("room.settings_title")}
      @pointerdown=${t=>t.stopPropagation()}
      @click=${e=>{e.stopPropagation(),this._openRoomEdit(t)}}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
      <span class="rlgeartext">${this._t("room.settings_short")}</span>
    </button>`}_renderRoomLabel(t,e,i,s){if(!t.name&&!this._markup)return V;const o=this._labelPos(t,e.id),n=(o.x-i.x)/i.w*100,r=(o.y-i.y)/i.h*100,a=Math.min(1,s.opacity+.25),l=this._labelScale(t),c=[];if(t.area||t.settings?.temp_source||t.settings?.hum_source){if(s.labelTemp){const e=this._roomTemp(t);null!=e&&c.push(B`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${e}°</span>`)}if(s.labelHum){const e=this._roomHum(t);null!=e&&c.push(B`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${e}%</span>`)}if(s.labelLqi&&t.area){const e=this._roomLqi(t.area);null!=e&&c.push(B`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${e}</span>`)}if(s.labelLight&&t.area){const e=function(t,e,i){const s=new Set;let o=0;for(const n of e)if(n.area===i&&!n.hidden)for(const e of n.entities)e.startsWith("light.")&&!s.has(e)&&(s.add(e),"on"===t.states[e]?.state&&o++);return s.size?{on:o,total:s.size}:null}(this.hass,this._devices,t.area);if(e){const t=0===e.on?this._t("roomcard.light_off"):e.on===e.total?this._t("roomcard.light_on"):this._t("roomcard.light_partial",{on:e.on,total:e.total});c.push(B`<span class="rlm ${e.on?"lit":""}"><ha-icon icon=${e.on?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>${t}</span>`)}}}return B`<div class="roomlabel ${c.length?"card":""}"
      style="left:${n}%;top:${r}%;color:${s.color};opacity:${a};--rl-scale:${l};--rl-space:${s.cardFontScale};--rl-name:${Fi(t.settings?.name_scale)};--rl-meta:${Fi(t.settings?.label_scale)}"
      @pointerdown=${i=>this._labelDown(i,t,e.id)}
      @pointermove=${i=>this._labelMove(i,t,e.id)}
      @pointerup=${()=>this._labelUp(t)}
      @pointercancel=${()=>this._labelUp(t)}
    ><span class="rlname">${t.name||(this._markup?this._t("room.unnamed"):"")}${!this._markup&&t.area?B`<ha-icon class="rlgo" icon="mdi:open-in-new"
            title=${this._t("room.open_area")}
            @click=${e=>{e.stopPropagation(),this._clickRoom(t)}}
            @pointerdown=${t=>t.stopPropagation()}></ha-icon>`:V}</span>
      ${c.length?B`<span class="rlmetrics">${c}</span>`:V}
      ${"plan"===this._mode?["tl","tr","bl","br"].map(i=>B`<span class="rlhandle ${i}"
              @pointerdown=${i=>this._rlResizeDown(i,t,e.id)}
              @pointermove=${t=>this._rlResizeMove(t)}
              @pointerup=${()=>this._rlResizeUp()}
              @pointercancel=${()=>this._rlResizeUp()}></span>`):V}
    </div>`}get _measureAnchor(){return this._markup&&this._cursorPt?"draw"===this._tool&&this._path.length&&!this._contourClosed?this._path[this._path.length-1]:"split"===this._tool&&this._splitSel?.pts?.length?this._splitSel.pts[this._splitSel.pts.length-1]:null:null}_renderMeasureLabel(t){const e=this._measureAnchor,i=this._cursorPt,s=(i[0]-t.x)/t.w*100,o=(i[1]-t.y)/t.h*100,n=Li(e,i),r=Math.round(10*n)/10,a=qi(n);return B`<div class="measurelabel ${a?"on45":""}" style="left:${s}%;top:${o}%">
      ${this._fmtLen(e,i)} · ${r}°</div>`}get _decorMeasure(){const t=this._decorDraft;if(!t||"decor"!==this._mode)return null;const[e,i]=t.a,[s,o]=t.b;if(Math.abs(e-s)<1e-6&&Math.abs(i-o)<1e-6)return null;const n=(e+s)/2,r=(i+o)/2;if("line"===t.kind){const e=Li(t.a,t.b);return{x:n,y:r,on45:qi(e),text:`${this._fmtLen(t.a,t.b)} · ${Math.round(10*e)/10}°`}}return{x:n,y:r,on45:!1,text:`${this._fmtLen([e,i],[s,i])} × ${this._fmtLen([s,i],[s,o])}`}}get _alignPoint(){if(this._markup){if("draw"===this._tool&&this._path.length&&!this._contourClosed&&this._cursorPt)return this._cursorPt;if("split"===this._tool&&this._splitSel?.pts?.length&&this._cursorPt)return this._cursorPt;if(this._drag?.id.startsWith("rl_")&&this._drag.moved){const t=this._drag.id.slice(3),e=this._spaceModel().rooms.find(e=>e.id===t);return e?(()=>{const t=this._labelPos(e,this._space);return[t.x,t.y]})():null}return null}if("devices"===this._mode&&this._drag?.moved){const t=this._devices.find(t=>t.id===this._drag.id);return t?(()=>{const e=this._pos(t);return[e.x,e.y]})():null}if("decor"===this._mode){if(this._decorDraft)return this._decorDraft.b;if(this._decorMove){const t=this._decorList.find(t=>t.id===this._decorMove.id);if(!t)return null;const e=mn,i=this._decorH;return"line"===t.kind?[t.x1*e,t.y1*i]:[t.x*e,t.y*i]}return null}return null}_alignCandidates(){const t=[],e=this._spaceModel();if(this._markup){if(this._drag?.id.startsWith("rl_")){const i=this._drag.id.slice(3);for(const s of e.rooms){if(!s.name||s.id===i)continue;const e=this._labelPos(s,this._space);t.push([e.x,e.y])}return t}for(const i of e.rooms){const e=xe(i);if(e)for(const i of e)t.push(i)}if("draw"===this._tool)for(const e of this._path)t.push(e);if("split"===this._tool&&this._splitSel?.pts)for(const e of this._splitSel.pts)t.push(e);return t}if("devices"===this._mode){for(const e of this._devices){if(e.space!==this._space||e.id===this._drag?.id)continue;const i=this._pos(e);t.push([i.x,i.y])}return t}if("decor"===this._mode){const i=mn,s=this._decorH,o=this._decorMove?.id;for(const e of this._decorList)e.id!==o&&("line"===e.kind?t.push([e.x1*i,e.y1*s],[e.x2*i,e.y2*s]):"text"===e.kind?t.push([e.x*i,e.y*s]):t.push([e.x*i,e.y*s],[(e.x+e.w)*i,e.y*s],[e.x*i,(e.y+e.h)*s],[(e.x+e.w)*i,(e.y+e.h)*s]));this._decorDraft&&t.push(this._decorDraft.a);for(const i of e.rooms){const e=xe(i);if(e)for(const i of e)t.push(i)}return t}return t}_renderAlignGuides(){const t=this._alignPoint;if(!t)return j``;const e=this._drag?.id.startsWith("rl_")?.5*this._gridPitch:.05*this._gridPitch,i=function(t,e,i){let s=null,o=null;for(const n of e)if(!(Math.abs(n[0]-t[0])<1e-6&&Math.abs(n[1]-t[1])<1e-6)){if(Math.abs(n[0]-t[0])<=i){const e=Math.abs(n[1]-t[1]);e>1e-6&&(!s||e<s.d)&&(s={d:e,c:n})}if(Math.abs(n[1]-t[1])<=i){const e=Math.abs(n[0]-t[0]);e>1e-6&&(!o||e<o.d)&&(o={d:e,c:n})}}const n=[];return s&&n.push({axis:"x",at:s.c[0],from:s.c}),o&&n.push({axis:"y",at:o.c[1],from:o.c}),n}(t,this._alignCandidates(),e);if(!i.length)return j``;const s=this._gridPitch,o=1.5*s;return j`<g class="alignguides">
      ${i.map(e=>{const[i,n,r,a]="x"===e.axis?[e.at,e.from[1],e.at,t[1]+Math.sign(t[1]-e.from[1])*o]:[e.from[0],e.at,t[0]+Math.sign(t[0]-e.from[0])*o,e.at];return j`<line class="alignline" x1="${i}" y1="${n}" x2="${r}" y2="${a}"></line>
          <circle class="aligndot" cx="${e.from[0]}" cy="${e.from[1]}" r="${.18*s}"></circle>`})}
    </g>`}_renderOpeningCenterTick(t){const e=(t.angle+90)*Math.PI/180;return j`<line class="alignline opcentertick"
      x1="${t.x-15*Math.cos(e)}" y1="${t.y-15*Math.sin(e)}"
      x2="${t.x+15*Math.cos(e)}" y2="${t.y+15*Math.sin(e)}"></line>`}_roomCenter(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}_openingAmt(t){const e=t.contact?this.hass.states[t.contact]?.state:null;return function(t,e,i=!1){return null==e||"unavailable"===e||"unknown"===e?"door"===t?1:0:Ce(e)!==!!i?1:0}(t.type,e,!!t.invert)}_renderOpenings(t){const e=this._openingsR;if(!e.length)return j``;const i=t.color;return j`${e.map(t=>{const e=t.rlen/2,s=this._openingAmt(t),o=s>0&&!!t.contact?"var(--hp-open)":i,n=t.flip_h?-1:1,r=t.flip_v?-1:1;let a;if("window"===t.type){const t=Math.PI/2*e;a=j`
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
      </g>`})}`}_renderOpeningLocks(t){const e=this._openingsR.filter(t=>"door"===t.type&&t.lock);return e.length?B`${e.map(e=>{const i=this.hass.states[e.lock]?.state,s="locked"===i,o=s||["unlocked","open","opening","unlocking","locking"].includes(String(i)),n=(e.angle+90)*Math.PI/180,r=16*(e.flip_v?-1:1),a=e.rx+Math.cos(n)*r,l=e.ry+Math.sin(n)*r,c=(a-t.x)/t.w*100,h=(l-t.y)/t.h*100;return B`<div class="oplock ${s?"locked":o?"unlocked":"unknown"}"
        style="left:${c}%;top:${h}%"
        @click=${t=>{t.stopPropagation(),"view"===this._mode&&(this._openingInfo=e)}}>
        <ha-icon icon="${s?"mdi:lock":o?"mdi:lock-open-variant":"mdi:lock-question"}"></ha-icon>
      </div>`})}`:B``}_lockAction(t,e){if("unlock"===e){const e=this.hass?.states?.[t]?.attributes?.friendly_name||t;if(!confirm(this._t("confirm.unlock",{name:e})))return}this.hass?.callService?.("lock",e,{entity_id:t})}_renderOpeningInfoCard(){const t=this._openingInfo,e=t.contact?this.hass.states[t.contact]?.state:null,i=this._openingAmt(t),s=t.lock?this.hass.states[t.lock]?.state:null,o=(t,e,i,s="")=>B`<div class="oprow ${s}"><ha-icon icon=${t}></ha-icon><span>${e}</span><b>${i}</b></div>`;return B`<div class="menuwrap dialogwrap" @click=${()=>this._openingInfo=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon=${"door"===t.type?"mdi:door":"mdi:window-closed-variant"}></ha-icon>
          ${this._t("door"===t.type?"opening.door":"opening.window")}</div>
        <div class="body">
          ${t.contact?o(i>0?"mdi:door-open":"mdi:door-closed",this._t("opening.contact_label"),"unavailable"===e||null==e?this._t("opening.state_unknown"):this._t(i>0?"opening.open":"opening.closed"),i>0?"warn":"ok"):V}
          ${t.lock?o("locked"===s?"mdi:lock":"mdi:lock-open-variant",this._t("opening.lock_label"),"locked"===s?this._t("opening.locked"):["unlocked","open"].includes(String(s))?this._t("opening.unlocked"):this._t("opening.state_unknown"),"locked"===s?"ok":"warn"):V}
          ${t.lock&&("locked"===s||["unlocked","open"].includes(String(s)))?B`<button
                class="btn lockact ${"locked"===s?"warn":""}"
                @click=${()=>this._lockAction(t.lock,"locked"===s?"unlock":"lock")}>
                <ha-icon icon=${"locked"===s?"mdi:lock-open-variant":"mdi:lock"}></ha-icon>
                ${this._t("locked"===s?"opening.unlock_action":"opening.lock_action")}
              </button>`:t.lock&&["locking","unlocking"].includes(String(s))?B`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("opening.lock_pending")}
                </button>`:V}
          ${t.contact||t.lock?V:B`<p class="muted">${this._t("opening.no_entities")}</p>`}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingInfo=null}>${this._t("btn.close")}</button>
        </div>
      </div>
    </div>`}_renderOpeningDialog(){const t=this._openingDialog,e=(t,e,i)=>B`<select class="areasel" @change=${t=>i(t.target.value)}>
        <option value="" ?selected=${!e}>${this._t("opening.none")}</option>
        ${t.map(t=>B`<option value=${t.value} ?selected=${t.value===e}>${t.label}</option>`)}
      </select>`;return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
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
          ${t.contact?B`<label class="srcrow">${this._boolInput(t.invert,e=>this._openingDialog={...t,invert:e})}
                <span>${this._t("opening.invert")}</span></label>`:V}

          ${"door"===t.type?B`<label>${this._t("opening.lock_label")}</label>
                ${e(this._lockCandidates(),t.lock,e=>this._openingDialog={...t,lock:e})}`:V}

          <label class="srcrow">${this._boolInput(t.flipH,e=>this._openingDialog={...t,flipH:e})}
            <span>${this._t("opening.flip_h")}</span></label>
          <label class="srcrow">${this._boolInput(t.flipV,e=>this._openingDialog={...t,flipV:e})}
            <span>${this._t("opening.flip_v")}</span></label>
        </div>
        <div class="row">
          ${t.id?B`<button class="btn danger" @click=${this._deleteOpening}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._openingDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveOpening}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_gridLevels(){const t=this._stageEl,e=this._viewOr(this._baseVb()),i=t&&t.clientWidth&&e.w?t.clientWidth/e.w:1;return function(t,e,i=7){if(!(t>0&&e>0&&Number.isFinite(e)))return null;const s=Lo.find(s=>t*s*e>=i);if(void 0===s)return null;const o=Lo.find(t=>t>=5*s)??5*s;return{fine:s,coarse:o}}(this._gridPitch,i)}_renderMarkupDefs(t){const e=this._gridLevels();if(!e)return j`<defs></defs>`;const i=this._gridPitch*e.fine,s=this._gridPitch*e.coarse,o=this._gridPitch*e.fine*.14;return j`<defs>
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
      </defs>`}_renderMarkupLayer(t){const e=this._openPairs().flatMap(t=>t.segs),i=e.length?Ri(this._segments,e,.02*this._gridPitch):this._segments,s=this._path,o=this._gridPitch,n=this._viewOr(this._baseVb());return j`
      ${this._gridLevels()?j`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`:V}
      ${i.map(t=>j`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${s.length>1?j`<polyline class="pathline" points="${s.map(t=>t.join(",")).join(" ")}"></polyline>`:V}
      ${s.length&&this._cursorPt&&"draw"===this._tool&&!this._contourClosed?j`<line class="preview" x1="${s[s.length-1][0]}" y1="${s[s.length-1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:V}
      ${s.map((t,e)=>j`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*o}"></circle>`)}
      ${(()=>{const t=this._openingPreview;if(!t)return V;const e=t.angle*Math.PI/180,i=Math.cos(e)*t.rlen/2,s=Math.sin(e)*t.rlen/2;return j`<line class="opghost" x1="${t.x-i}" y1="${t.y-s}"
          x2="${t.x+i}" y2="${t.y+s}"></line>
          <circle class="opghost-dot" cx="${t.x}" cy="${t.y}" r="${.18*o}"></circle>`})()}
      ${"split"===this._tool&&this._splitSel?.pts?.length?j`${this._splitSel.pts.length>1?j`<polyline class="pathline" points="${this._splitSel.pts.map(t=>t.join(",")).join(" ")}"></polyline>`:V}
            ${this._splitSel.pts.map((t,e)=>j`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*o}"></circle>`)}
            ${this._cursorPt?j`<line class="preview" x1="${this._splitSel.pts[this._splitSel.pts.length-1][0]}" y1="${this._splitSel.pts[this._splitSel.pts.length-1][1]}"
                  x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:V}`:V}
    `}_renderMarkupBar(){return B`<div class="editbar">
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
        @click=${()=>{this._cancelPath(),this._tool="openwall"}}
        title=${this._t("title.markup_openwall")}>
        <ha-icon icon="mdi:border-none-variant"></ha-icon>${this._t("markup.openwall")}
      </button>
      <button class="btn ${"delroom"===this._tool?"on":""}" @click=${()=>this._tool="delroom"}
        title=${this._t("title.markup_delroom")}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("markup.delete")}
      </button>
      <span class="spacer"></span>
      ${"draw"===this._tool?B`<span class="hint">${this._path.length?this._t("markup.hint_points",{n:this._path.length}):this._t("markup.hint_start")}</span>
            ${this._path.length?B`<button class="btn ghost" @click=${this._cancelPath}>${this._t("btn.reset")}</button>`:V}`:V}
      ${"resize"===this._tool?B`<span class="hint">${this._t("markup.hint_resize")}</span>`:V}
      <button class="btn barclose" title=${this._t("title.close_editor")}
        @click=${()=>this._setMode("view")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`}_renderDevicesBar(){return B`<div class="editbar devbar">
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
    </div>`}_cardEntities(t){const e=this.hass,i=[],s=new Set,o=t=>{if(!t||s.has(t)||!e.states[t])return;const o=e.entities[t];if("config"===o?.entity_category||"diagnostic"===o?.entity_category)return;s.add(t);const n=t.split(".")[0];["light","switch","fan","humidifier","siren","input_boolean"].includes(n)?i.push({eid:t,kind:"toggle"}):["cover","valve","lock","climate","media_player","vacuum","water_heater"].includes(n)?i.push({eid:t,kind:"open"}):["sensor","binary_sensor","number","select"].includes(n)&&i.push({eid:t,kind:"value"})};for(const e of t.marker?.controls||[])o(e);t.primary&&o(t.primary);for(const e of t.entities)o(e);return i.slice(0,12)}_cardToggle(t){const e=t.split(".")[0];"lock"!==e&&"alarm_control_panel"!==e&&this.hass.callService("homeassistant","toggle",{entity_id:t}).catch(t=>this._showToast(this._t("toast.error",{err:this._errText(t)})))}_renderInfoCard(){const t=this._infoCard,e=t.primary?this.hass.states[t.primary]:void 0,i=e?this.hass.formatEntityState?.(e)??e.state:null,s=(t.marker?.controls||[]).filter(Ti);return B`<div class="menuwrap dialogwrap" @click=${()=>this._infoCard=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="${t.icon}"></ha-icon>${t.name}</div>
        <div class="body">
          ${(()=>{const e=this._cardEntities(t);return e.length?B`<div class="entlist">
              ${e.map(({eid:t,kind:e})=>{const i=this.hass.states[t],s=this.hass.entities[t]?.name||i?.attributes?.friendly_name||t,o=i?this.hass.formatEntityState?.(i)??i.state:"",n="on"===i?.state||["open","unlocked","playing","cleaning"].includes(i?.state);return B`<div class="entrow ${n?"on":""}">
                  <ha-icon icon=${ki(mt(s,"",this._iconRules),t.split(".")[0],i?.attributes?.device_class,i?.state,!1)}></ha-icon>
                  <span class="en">${s}</span>
                  ${"toggle"===e?B`<button class="entbtn ${n?"on":""}"
                        @click=${()=>this._cardToggle(t)}>${o}</button>`:"open"===e?B`<button class="entbtn"
                          @click=${()=>{this._infoCard=null,this._openMoreInfo(t)}}>${o}</button>`:B`<span class="ev">${o}</span>`}
                </div>`})}
            </div>`:V})()}
          ${t.model?B`<div class="inforow"><span class="k">${this._t("info.model")}</span><span>${t.model}</span></div>`:V}
          ${i&&!this._cardEntities(t).length?B`<div class="inforow"><span class="k">${this._t("info.state")}</span><span>${i}</span></div>`:V}
          ${Xe(t.link)?B`<div class="inforow"><span class="k">${this._t("info.link")}</span>
                <a href="${Xe(t.link)}" target="_blank" rel="noreferrer noopener">${t.link}</a></div>`:V}
          ${t.description?B`<div class="infodesc">${t.description}</div>`:V}
          ${t.pdfs&&t.pdfs.length?B`<div class="inforow"><span class="k">${this._t("info.manuals")}</span><span class="pdflist">
                ${t.pdfs.map(t=>B`<a class="pdf" href="${Xe(this._display(t.url))||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${t.name}</a>`)}</span></div>`:V}
          ${s.length?B`<div class="inforow"><span class="k">${this._t("info.controls")}</span>
                <span class="ctrlstates">
                  ${s.map(t=>{const e=this.hass.states[t],i="on"===e?.state;return B`<span class="ctrlstate ${i?"on":""}">
                      <ha-icon icon=${i?"mdi:lightbulb-on":"mdi:lightbulb-outline"}></ha-icon>
                      ${e?.attributes?.friendly_name||t}</span>`})}
                </span></div>`:V}
          ${t.model||i||t.link||t.description||t.pdfs&&t.pdfs.length||s.length?V:B`<div class="infodesc muted">${this._t("info.none")}</div>`}
        </div>
        <div class="row">
          <button class="btn" @click=${()=>{const e=t;this._infoCard=null,this._openMarkerDialog(e)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t("btn.edit")}
          </button>
          ${t.primary?B`<button class="btn" @click=${()=>{const e=t.primary;this._infoCard=null,this._openMoreInfo(e)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("btn.open_in_ha")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._infoCard=null}>${this._t("btn.close")}</button>
        </div>
      </div>
    </div>`}_renderMarkerDialog(){const t=this._markerDialog,e="virtual"===t.bindingMode,i=this._bindingCandidates(),s=(()=>{if(e)return null;const s=i.find(e=>e.value===t.binding);if(s)return s.label;const[o,n]=t.binding.split(":");return"device"===o?this.hass.devices[n]?.name_by_user||this.hass.devices[n]?.name||n:this.hass.states[n]?.attributes?.friendly_name||n})();return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus"></ha-icon>
          ${t.devId?this._t("info.device_header"):this._t("marker.new_device")}</div>
        <div class="body">
          <label>${this._t("marker.name_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("marker.name_ph")}
            .value=${t.name}
            @input=${e=>this._markerDialog={...t,name:e.target.value}} />

          <label>${this._t("marker.binding_label")}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${"virtual"===t.bindingMode}
                @change=${()=>this._markerDialog={...t,bindingMode:"virtual",binding:"virtual",bindingOpen:!1}} />
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
            ${"ha"===t.bindingMode?B`<button class="dropbtn ${t.bindingOpen?"open":""}"
                    @click=${()=>this._markerDialog={...t,bindingOpen:!t.bindingOpen}}>
                    ${s?B`<b>${s}</b><span class="ref">${t.binding}</span>`:B`<span class="muted">${this._t("marker.pick_ph")}</span>`}
                    <ha-icon icon=${t.bindingOpen?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
                  </button>
                  ${t.bindingOpen?B`<div class="droppanel">
                        <input class="namein" type="text" placeholder=${this._t("marker.search_ph")}
                          .value=${t.bindingFilter}
                          @input=${e=>this._markerDialog={...t,bindingFilter:e.target.value}} />
                        <div class="candlist">
                          ${i.map(e=>B`<div class="cand ${e.value===t.binding?"sel":""}"
                              @click=${()=>this._markerDialog={...t,binding:e.value,bindingOpen:!1}}>
                              <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                            </div>`)}
                          ${i.length?V:B`<div class="cand muted">${this._t("marker.nothing_found")}</div>`}
                        </div>
                      </div>`:V}`:V}
          </div>

          <label>${this._t("marker.room_label")}${e?"":this._t("marker.room_override")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,room:e.target.value}}>
            <option value="">${e?this._t("marker.room_choose"):this._t("marker.room_auto")}</option>
            ${this._allRoomsFlat().map(e=>B`<option value=${e.value} ?selected=${e.value===t.room}>${e.label}</option>`)}
          </select>

          ${this._renderVacSection(t)}

          <label>${this._t("marker.tap_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,tapAction:e.target.value}}>
            ${Je.filter(e=>"cover"!==e||this._bindingCoverTap(t.binding)).map(t=>[t,"tap."+t.replace("-","_")]).map(([e,i])=>B`<option value=${e} ?selected=${(t.tapAction||t.defaultTap)===e}>${this._t(i)}</option>`)}
          </select>
          ${"run"===t.tapAction?(()=>{const e=t.runFilter.trim().toLowerCase(),i=this._runCandidates().filter(t=>!e||t.label.toLowerCase().includes(e)||t.value.includes(e)),s=t.tapTarget?this._runCandidates().find(e=>e.value===t.tapTarget):null;return B`
                  <label>${this._t("marker.run_target_label")}</label>
                  ${t.tapTarget&&!s?B`<div class="rhint">${this._t("marker.run_target_gone",{id:t.tapTarget})}</div>`:V}
                  <input class="namein" type="text" placeholder=${this._t("marker.run_search_ph")}
                    .value=${s?s.label:t.runFilter}
                    @focus=${t=>{t.target.select()}}
                    @input=${e=>this._markerDialog={...t,runFilter:e.target.value,tapTarget:""}} />
                  ${s?V:B`<div class="candlist">
                        ${i.slice(0,40).map(e=>B`<div class="cand ${e.value===t.tapTarget?"sel":""}"
                            @click=${()=>this._markerDialog={...t,tapTarget:e.value,runFilter:""}}>
                            <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                          </div>`)}
                        ${i.length?V:B`<div class="cand muted">${this._t("marker.nothing_found")}</div>`}
                      </div>`}`})():V}
          ${"run"===t.tapAction||"toggle"===t.tapAction||"cover"===t.tapAction||!t.tapAction&&"toggle"===t.defaultTap?B`<label class="srcrow" title=${this._t("marker.tap_confirm_tip")}>
                ${this._boolInput(t.tapConfirm,e=>this._markerDialog={...t,tapConfirm:e})}
                <span>${this._t("marker.tap_confirm")}</span>
              </label>`:V}

          <label>${this._t("marker.controls_label")}</label>
          <div class="rhint">${this._t("marker.controls_hint")}</div>
          ${t.controls.length?B`<div class="ctrlchips">
                ${t.controls.map(e=>B`<span class="ctrlchip">
                  ${this.hass.states[e]?.attributes?.friendly_name||e}
                  <ha-icon icon="mdi:close" @click=${()=>this._markerDialog={...t,controls:t.controls.filter(t=>t!==e)}}></ha-icon>
                </span>`)}
              </div>`:V}
          <input class="namein" type="text" placeholder=${this._t("marker.controls_filter")}
            .value=${t.controlsFilter}
            @input=${e=>this._markerDialog={...t,controlsFilter:e.target.value}} />
          ${t.controlsFilter.trim()?B`<div class="ctrllist">
                ${Object.keys(this.hass.states).filter(e=>Ti(e)&&!t.controls.includes(e)).filter(e=>{const i=t.controlsFilter.trim().toLowerCase(),s=String(this.hass.states[e]?.attributes?.friendly_name||"");return e.toLowerCase().includes(i)||s.toLowerCase().includes(i)}).slice(0,8).map(e=>B`<button class="ctrlopt"
                    @click=${()=>this._markerDialog={...t,controls:[...t.controls,e],controlsFilter:""}}>
                    <ha-icon icon=${e.startsWith("light.")?"mdi:lightbulb":"mdi:toggle-switch"}></ha-icon>
                    ${this.hass.states[e]?.attributes?.friendly_name||e}
                    <span class="sub">${e}</span>
                  </button>`)}
              </div>`:V}

          ${this._bindingHasClimate(t.binding)?B`<label class="srcrow climrow" title=${this._t("marker.use_climate_temp_tip")}>
                ${this._boolInput(t.useClimateTemp,e=>this._markerDialog={...t,useClimateTemp:e})}
                <span>${this._t("marker.use_climate_temp")}</span>
              </label>`:V}
          <label class="srcrow" title=${this._t("marker.is_light_tip")}>
            ${this._boolInput(t.isLight,e=>this._markerDialog={...t,isLight:e})}
            <span>${this._t("marker.is_light")}</span>
          </label>
          <label class="srcrow" title=${this._t("marker.hide_tip")}>
            ${this._boolInput(t.hideFromPlan,e=>this._markerDialog={...t,hideFromPlan:e})}
            <span>${this._t("marker.hide")}</span>
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
          ${customElements.get("ha-icon-picker")?B`<ha-icon-picker .hass=${this.hass} .value=${t.icon}
                .placeholder=${t.autoIcon||void 0}
                .fallbackPath=${void 0}
                @value-changed=${e=>this._markerDialog={...t,icon:e.detail.value||""}}></ha-icon-picker>`:B`<input class="namein" type="text"
                placeholder=${t.autoIcon||this._t("marker.icon_ph")}
                .value=${t.icon}
                @input=${e=>this._markerDialog={...t,icon:e.target.value}} />`}
          ${!t.icon&&t.autoIcon?B`<p class="muted iconauto"><ha-icon icon=${t.autoIcon}></ha-icon>
                ${this._t("marker.icon_auto",{icon:t.autoIcon})}</p>`:V}

          <label>${this._t("marker.display_label")}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,display:e.target.value}}>
            ${Ze.map(t=>[t,"display."+t]).map(([e,i])=>B`<option value=${e} ?selected=${t.display===e}>${this._t(i)}</option>`)}
          </select>
          ${"ripple"===t.display||"icon_ripple"===t.display?B`<div class="colorrow">
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
            ${t.pdfs.map(t=>B`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${Xe(this._display(t.url))||"#"}" target="_blank" rel="noreferrer noopener">${t.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${()=>this._removeMarkerPdf(t.url)}></ha-icon></span>`)}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>${this._t("btn.attach")}
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${t=>this._pickMarkerFiles(t)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${t.devId&&"virtual"===t.binding?B`<button class="btn danger" @click=${this._deleteMarker}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.remove")}
              </button>`:V}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._markerDialog=null}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveMarker}
            ?disabled=${t.busy||"ha"===t.bindingMode&&(!t.binding||"virtual"===t.binding)}
            title=${"ha"!==t.bindingMode||t.binding&&"virtual"!==t.binding?"":this._t("marker.pick_ph")}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderSpaceDialog(){const t=this._spaceDialog;return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>
          ${"create"===t.mode?this._t("space.new"):this._t("space.header")}
          ${this._importTotal>0&&"create"===t.mode?B`<span class="importprog">${this._t("import.progress",{i:this._importTotal-this._importQueue.length,n:this._importTotal})}</span>`:V}</div>
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
          ${"file"===t.source?B`<div class="planrow">
                ${t.planFile?B`<span class="planname">${t.planFile.name}</span>`:t.planUrl?B`<img class="planprev" src=${this._display(t.planUrl)} alt=${this._t("space.plan_alt")} />`:B`<span class="planname muted">${this._t("space.no_plan")}</span>`}
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
            <input class="namein tempin" type="number" min="0.1" step="0.1" .value=${String(t.cellCm)}
              @input=${e=>{const i=parseFloat(e.target.value);this._spaceDialog={...t,cellCm:Number.isFinite(i)&&i>0?i:t.cellCm}}} />
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
          <label class="dispsection">${this._t("space.roomcard_section")}</label>
          ${[["labelTemp","space.label_temp"],["labelHum","space.label_hum"],["labelLqi","space.label_lqi"],["labelLight","space.label_light"]].map(([e,i])=>B`<label class="srcrow">
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
          ${"static"===(t.bgMode??xs(this._settings,{}))?B`<label>${this._t("space.bg_color")}</label>
              <div class="colorrow">
                <input type="color" .value=${t.bgColor||gi(this._settings,{bgColor:null})||this._stageBgHex()}
                  @input=${e=>this._spaceDialog={...t,bgColor:e.target.value}} />
                ${t.bgColor?B`<button class="btn ghost" @click=${()=>this._spaceDialog={...t,bgColor:null}}>
                      ${this._t("space.bg_inherit")}</button>`:B`<span class="opl">${this._t("space.bg_inherited")}</span>`}
              </div>`:V}
          <label>${this._t("space.north")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this._t("space.sun_inherit")}
              .value=${null===t.northDeg?"":String(t.northDeg)}
              @input=${e=>{const i=e.target.value.trim(),s=""===i?null:Math.round(Number(i));this._spaceDialog={...t,northDeg:null!==s&&Number.isFinite(s)?Math.min(359,Math.max(0,s)):null}}} />
            <span class="opl">${null===t.northDeg?this._t("space.north_inherited",{v:null===$s(this._settings,{})?"—":String($s(this._settings,{}))+"°"}):"°"}</span>
          </div>
          <label>${this._t("space.sun_rays")}</label>
          <select class="areasel"
            @change=${e=>{const i=e.target.value;this._spaceDialog={...t,sunRays:""===i?null:"1"===i}}}>
            <option value="" ?selected=${null===t.sunRays}>${this._t("space.sun_inherit")}</option>
            <option value="1" ?selected=${!0===t.sunRays}>${this._t("space.sun_on")}</option>
            <option value="0" ?selected=${!1===t.sunRays}>${this._t("space.sun_off")}</option>
          </select>
          <label>${this._t("space.fill_label")}</label>
          ${Qe.map(t=>[t,"fill."+t]).map(([e,i])=>B`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===e}
                @change=${()=>this._spaceDialog={...t,fillMode:e}} />
              <span>${this._t(i)}</span>
              ${"temp"===e&&"temp"===t.fillMode?B`<span class="temprange">
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
          ${"edit"===t.mode?B`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t("btn.delete")}
              </button>`:V}
          <span class="spacer"></span>
          ${this._importTotal>0&&"create"===t.mode?B`<button class="btn ghost" @click=${()=>this._skipImport()}>${this._t("btn.skip")}</button>`:V}
          <button class="btn ghost" @click=${()=>{this._spaceDialog=null,this._importQueue=[],this._importTotal=0}}>${this._t("btn.cancel")}</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
            title=${"file"!==t.source||t.planFile||t.planUrl?"":this._t("title.need_plan")}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this._t("btn.save")}
          </button>
        </div>
      </div>
    </div>`}_renderMergeDialog(){const t=this._mergeDialog,e=this._spaceModel().rooms,i=(i,s)=>{const o=e.find(t=>t.id===i),n=o?.area?this.hass.areas[o.area]?.name:null;return B`<label class="srcrow">
        <input type="radio" name="mergekeep" .checked=${t.pick===s}
          @change=${()=>this._mergeDialog={...t,pick:s}} />
        <span>${o?.name||""} <span class="muted">· ${n||this._t("merge.no_area")}</span></span>
      </label>`};return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
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
    </div>`}_renderCardPreview(t,e,i){const s=18*t;return B`<div class="cardpreview">
      <span class="cpname" style="font-size:${(s*e).toFixed(1)}px">
        ${this._t("preview.room_name")}</span>
      <span class="cpmeta" style="font-size:${(.62*s*i).toFixed(1)}px">
        <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
        <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
        <ha-icon icon="mdi:lightbulb-on"></ha-icon>${this._t("roomcard.light_partial",{on:1,total:3})}
      </span>
    </div>`}_renderRoomSource(t){const e="temp"===t?this._roomTempSrc:this._roomHumSrc,i=e=>{"temp"===t?this._roomTempSrc=e:this._roomHumSrc=e,this.requestUpdate()},s=this._roomSrcOpen===t;return B`
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
      ${e||s?B`<button class="dropbtn ${s?"open":""}"
              @click=${()=>{this._roomSrcOpen=s?null:t,this._roomSrcFilter=""}}>
              ${e?B`<b>${this._roomSrcLabel(e)}</b><span class="ref">${e}</span>`:B`<span class="muted">${this._t("room.src_ph")}</span>`}
              <ha-icon icon=${s?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
            </button>
            ${s?B`<div class="droppanel">
                  <input class="namein" type="text" placeholder=${this._t("marker.search_ph")}
                    .value=${this._roomSrcFilter}
                    @input=${t=>{this._roomSrcFilter=t.target.value,this.requestUpdate()}} />
                  <div class="candlist">
                    ${this._roomSrcCandidates().map(t=>B`<div class="cand ${t.value===e?"sel":""}"
                        @click=${()=>{i(t.value),this._roomSrcOpen=null}}>
                        <span class="cl">${t.label}</span><span class="cs">${t.sub}</span>
                      </div>`)}
                  </div>
                </div>`:V}`:V}`}_renderRoomDialog(){const t=!!this._roomEditId,e=[...this._freeAreas];if(t&&this._areaSel&&!e.some(t=>t.area_id===this._areaSel)){const t=this.hass.areas[this._areaSel];t&&e.unshift(t)}return B`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon=${t?"mdi:cog-outline":"mdi:floor-plan"}></ha-icon>
          ${t?this._t("room.settings_title"):this._t("room.new")}</div>
        <div class="body">
          <label>${this._t("room.name_label")}</label>
          <input class="namein" type="text" placeholder=${this._t("room.name_ph")}
            .value=${this._nameSel}
            @input=${t=>this._nameSel=t.target.value} />
          <label>${this._t("room.area_label")}</label>
          <select class="areasel"
            @change=${t=>{this._areaSel=t.target.value,!this._nameSel&&this._areaSel&&(this._nameSel=this.hass.areas[this._areaSel]?.name||""),this.requestUpdate()}}>
            <option value="">${this._t("room.no_area_option")}</option>
            ${e.map(t=>B`<option value=${t.area_id} ?selected=${t.area_id===this._areaSel}>${t.name}</option>`)}
          </select>

          <label class="dispsection">${this._t("room.settings_section")}</label>
          <label>${this._t("room.fill_label")}</label>
          ${[["","fill.inherit"],...ti.map(t=>[t,"fill."+t])].map(([t,e])=>B`<label class="srcrow inline">
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
          ${this._renderCardPreview(_i(this._curSpaceCfg).cardFontScale,this._roomNameScale,this._roomLabelScale)}
        </div>
        <div class="row">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this._t("btn.cancel")}</button>
          <span class="spacer"></span>
          ${t?B`<button class="btn on" @click=${()=>this._saveRoomEdit()} ?disabled=${!this._nameSel.trim()}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
              </button>`:B`<button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
                title=${this._t("title.no_area_room")}>
                ${this._t("btn.no_area")}
              </button>
              <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
                title=${this._areaSel?"":this._t("title.choose_area")}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t("btn.save")}
              </button>`}
        </div>
      </div>
    </div>`}}wn.properties={_hdrH:{state:!0},_booting:{state:!0},_bootFading:{state:!0},_bootSoft:{state:!0},_tapConfirm:{state:!0},hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_mode:{state:!0},_tool:{state:!0},_rszSel:{state:!0},_rszLive:{state:!0},_opMeasure:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_mergeSel:{state:!0},_openingDialog:{state:!0},_openingInfo:{state:!0},_mergeDialog:{state:!0},_splitSel:{state:!0},_decorTool:{state:!0},_decorStyle:{state:!0},_decorDraft:{state:!0},_decorSel:{state:!0},_decorTextDialog:{state:!0},_bdDrag:{state:!0},_dtBox:{state:!0},_dtDrag:{state:!0},_kioskDialog:{state:!0},_vacFit:{state:!0},_kioskDots:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_roomEditId:{state:!0},_roomFill:{state:!0},_roomTempSrc:{state:!0},_roomHumSrc:{state:!0},_roomSrcOpen:{state:!0},_roomSrcFilter:{state:!0},_roomNameScale:{state:!0},_roomLabelScale:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_rulesDialog:{state:!0},_settingsDialog:{state:!0},_alignDialog:{state:!0},_importDialog:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},wn.ZOOM_MAX=8,wn.ZOOM_MIN=1/3,wn._touchSeen=!1,wn._noHoverMq="undefined"!=typeof window&&"function"==typeof window.matchMedia&&window.matchMedia("(hover: none)").matches,wn.styles=co,customElements.get("houseplan-card")||customElements.define("houseplan-card",wn),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-card"===t.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Interactive house plan: spaces, rooms and devices with live states and drag layout."}),console.info(`%c HOUSEPLAN-CARD %c v${nn} `,"background:#3ea6ff;color:#04121f;font-weight:700","");
