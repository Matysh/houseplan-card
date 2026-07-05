const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let a=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const o=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new a("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:n,defineProperty:r,getOwnPropertyDescriptor:l,getOwnPropertyNames:c,getOwnPropertySymbols:h,getPrototypeOf:d}=Object,p=globalThis,u=p.trustedTypes,_=u?u.emptyScript:"",g=p.reactiveElementPolyfillSupport,m=(t,e)=>t,f={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},v=(t,e)=>!n(t,e),b={attribute:!0,type:String,converter:f,reflect:!1,useDefault:!1,hasChanged:v};Symbol.metadata??=Symbol("metadata"),p.litPropertyMetadata??=new WeakMap;let y=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&r(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:a}=l(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const o=s?.call(this);a?.call(this,e),this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(m("elementProperties")))return;const t=d(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(m("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(m("properties"))){const t=this.properties,e=[...c(t),...h(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(o(t))}else void 0!==t&&e.push(o(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),a=t.litNonce;void 0!==a&&s.setAttribute("nonce",a),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const a=(void 0!==i.converter?.toAttribute?i.converter:f).toAttribute(e,i.type);this._$Em=t,null==a?this.removeAttribute(s):this.setAttribute(s,a),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),a="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:f;this._$Em=s;const o=a.fromAttribute(e,t.type);this[s]=o??this._$Ej?.get(s)??o,this._$Em=null}}requestUpdate(t,e,i,s=!1,a){if(void 0!==t){const o=this.constructor;if(!1===s&&(a=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??v)(a,e)||i.useDefault&&i.reflect&&a===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:a},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==a||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[m("elementProperties")]=new Map,y[m("finalized")]=new Map,g?.({ReactiveElement:y}),(p.reactiveElementVersions??=[]).push("2.1.2");const x=globalThis,$=t=>t,w=x.trustedTypes,k=w?w.createPolicy("lit-html",{createHTML:t=>t}):void 0,S="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,A="?"+C,z=`<${A}>`,M=document,D=()=>M.createComment(""),P=t=>null===t||"object"!=typeof t&&"function"!=typeof t,E=Array.isArray,R="[ \t\n\f\r]",T=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,O=/-->/g,U=/>/g,H=RegExp(`>|${R}(?:([^\\s"'>=/]+)(${R}*=${R}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),I=/'/g,N=/"/g,q=/^(?:script|style|textarea|title)$/i,L=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),j=L(1),F=L(2),W=Symbol.for("lit-noChange"),B=Symbol.for("lit-nothing"),K=new WeakMap,V=M.createTreeWalker(M,129);function Z(t,e){if(!E(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==k?k.createHTML(e):e}const Y=(t,e)=>{const i=t.length-1,s=[];let a,o=2===e?"<svg>":3===e?"<math>":"",n=T;for(let e=0;e<i;e++){const i=t[e];let r,l,c=-1,h=0;for(;h<i.length&&(n.lastIndex=h,l=n.exec(i),null!==l);)h=n.lastIndex,n===T?"!--"===l[1]?n=O:void 0!==l[1]?n=U:void 0!==l[2]?(q.test(l[2])&&(a=RegExp("</"+l[2],"g")),n=H):void 0!==l[3]&&(n=H):n===H?">"===l[0]?(n=a??T,c=-1):void 0===l[1]?c=-2:(c=n.lastIndex-l[2].length,r=l[1],n=void 0===l[3]?H:'"'===l[3]?N:I):n===N||n===I?n=H:n===O||n===U?n=T:(n=H,a=void 0);const d=n===H&&t[e+1].startsWith("/>")?" ":"";o+=n===T?i+z:c>=0?(s.push(r),i.slice(0,c)+S+i.slice(c)+C+d):i+C+(-2===c?e:d)}return[Z(t,o+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class X{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let a=0,o=0;const n=t.length-1,r=this.parts,[l,c]=Y(t,e);if(this.el=X.createElement(l,i),V.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=V.nextNode())&&r.length<n;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(S)){const e=c[o++],i=s.getAttribute(t).split(C),n=/([.?@])?(.*)/.exec(e);r.push({type:1,index:a,name:n[2],strings:i,ctor:"."===n[1]?et:"?"===n[1]?it:"@"===n[1]?st:tt}),s.removeAttribute(t)}else t.startsWith(C)&&(r.push({type:6,index:a}),s.removeAttribute(t));if(q.test(s.tagName)){const t=s.textContent.split(C),e=t.length-1;if(e>0){s.textContent=w?w.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],D()),V.nextNode(),r.push({type:2,index:++a});s.append(t[e],D())}}}else if(8===s.nodeType)if(s.data===A)r.push({type:2,index:a});else{let t=-1;for(;-1!==(t=s.data.indexOf(C,t+1));)r.push({type:7,index:a}),t+=C.length-1}a++}}static createElement(t,e){const i=M.createElement("template");return i.innerHTML=t,i}}function J(t,e,i=t,s){if(e===W)return e;let a=void 0!==s?i._$Co?.[s]:i._$Cl;const o=P(e)?void 0:e._$litDirective$;return a?.constructor!==o&&(a?._$AO?.(!1),void 0===o?a=void 0:(a=new o(t),a._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=a:i._$Cl=a),void 0!==a&&(e=J(t,a._$AS(t,e.values),a,s)),e}class G{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??M).importNode(e,!0);V.currentNode=s;let a=V.nextNode(),o=0,n=0,r=i[0];for(;void 0!==r;){if(o===r.index){let e;2===r.type?e=new Q(a,a.nextSibling,this,t):1===r.type?e=new r.ctor(a,r.name,r.strings,this,t):6===r.type&&(e=new at(a,this,t)),this._$AV.push(e),r=i[++n]}o!==r?.index&&(a=V.nextNode(),o++)}return V.currentNode=M,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Q{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=B,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=J(this,t,e),P(t)?t===B||null==t||""===t?(this._$AH!==B&&this._$AR(),this._$AH=B):t!==this._$AH&&t!==W&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>E(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==B&&P(this._$AH)?this._$AA.nextSibling.data=t:this.T(M.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=X.createElement(Z(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new G(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=K.get(t.strings);return void 0===e&&K.set(t.strings,e=new X(t)),e}k(t){E(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const a of t)s===e.length?e.push(i=new Q(this.O(D()),this.O(D()),this,this.options)):i=e[s],i._$AI(a),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=$(t).nextSibling;$(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,a){this.type=1,this._$AH=B,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=a,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=B}_$AI(t,e=this,i,s){const a=this.strings;let o=!1;if(void 0===a)t=J(this,t,e,0),o=!P(t)||t!==this._$AH&&t!==W,o&&(this._$AH=t);else{const s=t;let n,r;for(t=a[0],n=0;n<a.length-1;n++)r=J(this,s[i+n],e,n),r===W&&(r=this._$AH[n]),o||=!P(r)||r!==this._$AH[n],r===B?t=B:t!==B&&(t+=(r??"")+a[n+1]),this._$AH[n]=r}o&&!s&&this.j(t)}j(t){t===B?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===B?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==B)}}class st extends tt{constructor(t,e,i,s,a){super(t,e,i,s,a),this.type=5}_$AI(t,e=this){if((t=J(this,t,e,0)??B)===W)return;const i=this._$AH,s=t===B&&i!==B||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,a=t!==B&&(i===B||s);s&&this.element.removeEventListener(this.name,this,i),a&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class at{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){J(this,t)}}const ot=x.litHtmlPolyfillSupport;ot?.(X,Q),(x.litHtmlVersions??=[]).push("3.3.3");const nt=globalThis;class rt extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let a=s._$litPart$;if(void 0===a){const t=i?.renderBefore??null;s._$litPart$=a=new Q(e.insertBefore(D(),t),t,void 0,i??{})}return a._$AI(t),a})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return W}}rt._$litElement$=!0,rt.finalized=!0,nt.litElementHydrateSupport?.({LitElement:rt});const lt=nt.litElementPolyfillSupport;lt?.({LitElement:rt}),(nt.litElementVersions??=[]).push("4.2.2");const ct=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),ht=[[/протечк/,"mdi:water-alert"],[/клапан/,"mdi:pipe-valve"],[/дым/,"mdi:smoke-detector"],[/термоголов/,"mdi:radiator"],[/температ/,"mdi:thermometer"],[/qingping|air monitor|молекул/,"mdi:air-filter"],[/штор/,"mdi:roller-shade"],[/розетк|plug/,"mdi:power-socket-de"],[/выключат|switch/,"mdi:light-switch"],[/лампа|лампочк|bulb|gx53|светильник|rgb/,"mdi:lightbulb"],[/камер|camera/,"mdi:cctv"],[/замок|ttlock|lock|sn609|sn9161/,"mdi:lock"],[/ворота|garage/,"mdi:garage-variant"],[/калитк|door|открыт/,"mdi:door"],[/счётчик|счетчик|kws|meter/,"mdi:meter-electric"],[/вводный автомат|breaker|wifimcbn/,"mdi:electric-switch"],[/myheat|котёл|котел|boiler|отоплен/,"mdi:water-boiler"],[/холодильник|fridge/,"mdi:fridge"],[/стиральн|washer/,"mdi:washing-machine"],[/сушилк|dryer/,"mdi:tumble-dryer"],[/пылесос|vacuum|dreame/,"mdi:robot-vacuum"],[/soundbar|колонк|станц/,"mdi:soundbar"],[/tv|телевизор|hyundaitv|mitv/,"mdi:television"],[/keenetic|роутер|router/,"mdi:router-wireless"],[/ибп|ups|kirpich/,"mdi:battery-charging-high"],[/slzb|координат|zigbee/,"mdi:zigbee"]];function dt(t,e){const i=((t||"")+" "+(e||"")).toLowerCase();for(const[t,e]of ht)if(t.test(i))return e;return"mdi:chip"}const pt=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];function ut(t){const e=Math.max(0,Math.min(120,(t-40)/140*120));return`hsl(${Math.round(e)}, 85%, 55%)`}function _t(t,e){return Math.round(t/e)*e}function gt(t){return t.length?Math.round(t.reduce((t,e)=>t+e,0)/t.length):null}function mt(t,e){if(e>t[2]/t[3]){const i=t[3],s=t[3]*e;return{x:t[0]-(s-t[2])/2,y:t[1],w:s,h:i}}const i=t[2],s=t[2]/e;return{x:t[0],y:t[1]-(s-t[3])/2,w:i,h:s}}function ft(t,e,i,s){if(t.length<2)return;const a=e.x+s,o=e.x+e.w-s,n=e.y+s,r=e.y+e.h-s;for(let e=0;e<60;e++){let e=!1;for(let s=0;s<t.length;s++)for(let a=s+1;a<t.length;a++){const o=t[a].x-t[s].x,n=t[a].y-t[s].y,r=Math.hypot(o,n)||.001;if(r<i){const l=(i-r)/2,c=o/r,h=n/r;t[s].x-=c*l,t[s].y-=h*l,t[a].x+=c*l,t[a].y+=h*l,e=!0}}for(const e of t)e.x=Math.max(a,Math.min(o,e.x)),e.y=Math.max(n,Math.min(r,e.y));if(!e)break}}function vt(t){if(!t)return null;const e=t.trim();return/^(https?:)?\/\//i.test(e)||e.startsWith("/")||/^[\w./#?=&%~-]+$/i.test(e)?/^[a-z][\w+.-]*:/i.test(e)&&!/^https?:/i.test(e)?null:e:null}function bt(t,e,i){if(e.identifiers?.[0]?.[0])return e.identifiers[0][0];for(const e of i){const i=t.entities[e]?.platform;if(i)return i}return""}function yt(t,e){const i=t.states[e];if(!i)return/_temperature$/.test(e);const s=i.attributes||{};return"temperature"===s.device_class||/°C|°F/.test(s.unit_of_measurement||"")||/_temperature$/.test(e)}function xt(t,e,i){const s=e.map(e=>({eid:e,reg:t.entities[e],st:t.states[e]})).filter(t=>t.reg&&!t.reg.hidden),a=s.filter(t=>!t.reg.entity_category),o=a.length?a:s;if("mdi:thermometer"===i||"mdi:air-filter"===i){const e=o.find(e=>yt(t,e.eid));if(e)return e.eid}for(const t of pt){const e=o.find(e=>e.eid.split(".")[0]===t);if(e)return e.eid}return o[0]?.eid}function $t(t,e){const i=[];for(const s of e){const e=t.states[s];if(!e)continue;const a=(e.attributes?.unit_of_measurement||"").toLowerCase();if(/_(linkquality|lqi)$/.test(s)||"lqi"===a){const t=parseFloat(e.state);isNaN(t)||i.push(t);continue}const o=e.attributes?.linkquality??e.attributes?.lqi;if(null!=o){const t=parseFloat(o);isNaN(t)||i.push(t)}}return gt(i)}function wt(t,e){for(const i of e){if(!yt(t,i))continue;const e=t.states[i];if(!e)continue;const s=parseFloat(e.state);if(!isNaN(s))return Math.round(10*s)/10}return null}function kt(t,e){t.marker=e,e.name&&(t.name=e.name),e.icon&&(t.icon=e.icon),null!=e.model&&(t.model=e.model),t.link=e.link??null,t.description=e.description??null,t.pdfs=e.pdfs||[]}function St(t){const{hass:e,areaToSpace:i,markers:s,settings:a,excluded:o,showAll:n,firstSpaceId:r}=t,l=!1!==a.group_lights,c=function(t,e){if(!e)return[];const i=[];for(const[e,s]of Object.entries(t.entities)){if(!e.startsWith("light.")||s.hidden)continue;let a=null;if("group"===s.platform)a=s.area_id||null;else{if(!s.device_id)continue;{const e=t.devices[s.device_id];if("Group"!==e?.model)continue;a=e.area_id||s.area_id||null}}if(!a)continue;const o=t.states[e];i.push({eid:e,name:s.name||o?.attributes?.friendly_name||e,area:a})}return i}(e,l),h=new Set(c.map(t=>t.area)),d=function(t){const e={};for(const[i,s]of Object.entries(t.entities))s?.device_id&&(e[s.device_id]=e[s.device_id]||[]).push(i);return e}(e),p=new Set;for(const t of s){const[e,i]=t.binding.split(":");"device"!==e&&"entity"!==e||!i||p.add(t.binding)}const u=(t,e)=>s.find(i=>i.binding===t+":"+e),_={},g=[];for(const t of Object.values(e.devices)){const s=t.area_id;if(!s||!i[s])continue;if("service"===t.entry_type)continue;if(p.has("device:"+t.id))continue;const a=u("device",t.id);if(a&&a.hidden)continue;const r=d[t.id]||[],c=bt(e,t,r);if(!n){if(o.has(c))continue;if("Group"===t.model)continue;if(/scene/i.test(t.model||""))continue;if(/bridge/i.test((t.model||"")+(t.name||"")))continue;if("myheat"===c&&t.via_device_id)continue}const m=(t.name_by_user||t.name||"без имени").trim(),f=m+"|"+s;let v=dt(m,t.model);if(r.some(t=>t.startsWith("lock."))&&(v="mdi:lock"),!n&&l&&"mdi:lightbulb"===v&&h.has(s))continue;_[f]=(_[f]||0)+1;const b=_[f]>1?m+" "+_[f]:m,y={id:t.id,name:b,model:t.model||"",area:s,space:i[s],icon:v,entities:r,bindingKind:"device",bindingRef:t.id,pdfs:[]};y.primary=xt(e,r,v),"mdi:thermometer"!==v&&"mdi:air-filter"!==v||(y.temp=wt(e,r)),g.push(y)}for(const t of c)i[t.area]&&(p.has("entity:"+t.eid)||g.push({id:"lg_"+t.eid,name:t.name,model:"группа света",area:t.area,space:i[t.area],icon:"mdi:lightbulb-group",entities:[t.eid],primary:t.eid,bindingKind:"entity",bindingRef:t.eid,pdfs:[]}));for(const t of s){if(t.hidden)continue;const[s,a]=t.binding.split(":");if("device"===s){const s=e.devices[a],o=t.area||s?.area_id||"",n=o&&i[o]||t.space||r,l=s&&d[s.id]||[];let c=s?dt(s.name_by_user||s.name||"",s.model):"mdi:help-circle";l.some(t=>t.startsWith("lock."))&&(c="mdi:lock");const h={id:t.id,name:s?.name_by_user||s?.name||"устройство",model:s?.model||"",area:o,space:n,icon:c,entities:l,bindingKind:"device",bindingRef:a};h.primary=xt(e,l,c),"mdi:thermometer"!==c&&"mdi:air-filter"!==c||(h.temp=wt(e,l)),kt(h,t),g.push(h)}else if("entity"===s){const s=e.entities[a],o=t.area||s?.area_id||s?.device_id&&e.devices[s.device_id]?.area_id||"",n=o&&i[o]||t.space||r,l=e.states[a],c={id:t.id,name:s?.name||l?.attributes?.friendly_name||a,model:"",area:o,space:n,icon:"mdi:shape-outline",entities:[a],primary:a,bindingKind:"entity",bindingRef:a};kt(c,t),g.push(c)}else{const e=t.area||"",s=t.space||e&&i[e]||r,a={id:t.id,name:t.name||"виртуальное устройство",model:t.model||"",area:e,space:s,icon:t.icon||"mdi:map-marker",entities:[],bindingKind:"virtual",virtual:!0};kt(a,t),g.push(a)}}return g}const Ct={title:"Заголовок",default_floor:"Пространство по умолчанию",icon_size:"Размер иконок, % ширины плана",show_temperature:"Показывать температуру",live_states:"Живые состояния (вкл/выкл, открыто…)",show_signal:"Показывать сигнал zigbee (LQI)"};class At extends rt{constructor(){super(...arguments),this._spaces=null,this._spacesLoading=!1}setConfig(t){this._config=t}async _loadSpaces(){if(!this._spaces&&!this._spacesLoading&&this.hass){this._spacesLoading=!0;try{const t=await this.hass.callWS({type:"houseplan/config/get"});this._spaces=(t?.config?.spaces||[]).map(t=>({value:t.id,label:t.title||t.id}))}catch{this._spaces=[]}finally{this._spacesLoading=!1}}}get _schema(){const t=this._spaces||[];return[{name:"title",selector:{text:{}}},t.length?{name:"default_floor",selector:{select:{mode:"dropdown",options:t}}}:{name:"default_floor",selector:{text:{}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}}]}render(){return this.hass&&this._config?(this._loadSpaces(),j`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${t=>Ct[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`):B}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}At.properties={hass:{attribute:!1},_config:{state:!0},_spaces:{state:!0}},customElements.get("houseplan-card-editor")||customElements.define("houseplan-card-editor",At);const zt=((t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new a(s,t,i)})`
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
      overflow: visible; /* overflow:hidden ломает position:sticky у шапки */
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
      touch-action: none; /* свои жесты pinch/pan */
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
      background: rgba(4, 18, 31, 0.8);
      color: #dff1ff;
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
    .room.overlay:hover {
      fill: rgba(62, 166, 255, 0.18);
      stroke: var(--hp-accent);
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: 2;
    }
    .room.yard:hover {
      fill: rgba(75, 140, 90, 0.24);
      stroke: #6fbf86;
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
      display: none; /* в разметке иконки не мешают */
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
      width: var(--icon-size, 2.5cqw);
      height: var(--icon-size, 2.5cqw);
      margin: calc(var(--icon-size, 2.5cqw) / -2) 0 0 calc(var(--icon-size, 2.5cqw) / -2);
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
      background: rgba(4, 18, 31, 0.9);
      border: 1px solid var(--hp-accent);
      border-radius: calc(var(--icon-size, 2.5cqw) * 0.18);
      padding: 0 calc(var(--icon-size, 2.5cqw) * 0.14);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.45);
      font-weight: 700;
      line-height: calc(var(--icon-size, 2.5cqw) * 0.68);
      color: #dff1ff;
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
      width: min(440px, 94vw);
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
  `,Mt="houseplan_card_layout_v1",Dt="houseplan_card_cfg_v1",Pt="houseplan_card_zoom_v1",Et=1e3,Rt=(t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)},Tt=(t,e)=>{let i;return(...s)=>{clearTimeout(i),i=window.setTimeout(()=>t(...s),e)}};class Ot extends rt{constructor(){super(...arguments),this._space="f1",this._layout={},this._serverStorage=!1,this._loadOk=!1,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._unsubCfg=null,this._devices=[],this._regSignature="",this._defPos={},this._tip=null,this._selId=null,this._toast="",this._markup=!1,this._tool="draw",this._path=[],this._pathSegs=[],this._cursorPt=null,this._areaSel="",this._nameSel="",this._roomDialog=!1,this._zoom=1,this._view=null,this._zoomBySpace={},this._pointers=new Map,this._panStart=null,this._pinchStart=null,this._suppressClick=!1,this._onboardingShown=!1,this._infoCard=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=t=>this._onKey(t),this._drag=null,this._dirtyPos=new Set,this._persistLayout=Tt(()=>{if(this._serverStorage){const t=[...this._dirtyPos];this._dirtyPos.clear();for(const e of t){const t=this._layout[e];t&&this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t}).catch(t=>this._showToast("Не удалось сохранить позицию: "+(t?.message||t)))}this._cacheSnapshot()}else localStorage.setItem(Mt,JSON.stringify(this._layout))},600),this._saveConfig=Tt(()=>{this._serverCfg&&this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev}).then(t=>{this._cfgRev=t?.rev??this._cfgRev+1}).catch(t=>{"conflict"===t?.code?(this._showToast("Конфиг изменён в другом окне — данные обновлены, повторите последнее действие"),this._cancelPath(),this._reloadConfigOnly()):this._showToast("Не удалось сохранить конфиг: "+(t?.message||t))})},500)}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this._keyHandler)}disconnectedCallback(){window.removeEventListener("keydown",this._keyHandler),this._roViewport?.disconnect(),this._roViewport=void 0,this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),super.disconnectedCallback()}_onKey(t){if("Escape"===t.key){if(this._infoCard)return void(this._infoCard=null);if(this._markerDialog)return void(this._markerDialog=null)}if(!this._markup)return;return"Escape"===t.key||(t.ctrlKey||t.metaKey)&&"z"===t.key.toLowerCase()?this._roomDialog?(t.preventDefault(),void this._roomDialogCancel()):void("draw"===this._tool&&this._path.length&&(t.preventDefault(),this._undoPoint())):void 0}_undoPoint(){if(!this._path.length)return;if(1===this._path.length)return this._path=[],void(this._pathSegs=[]);const t=this._pathSegs[this._pathSegs.length-1];this._pathSegs=this._pathSegs.slice(0,-1),t&&this._removeSegmentByKey(t),this._path=this._path.slice(0,-1)}_removeSegmentByKey(t){const e=this._curSpaceCfg;if(!e?.segments)return;const i=this._segments.findIndex(e=>this._segKey([e[0],e[1]],[e[2],e[3]])===t);i>=0&&(e.segments.splice(i,1),this._saveConfig())}static getConfigElement(){return document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card",title:"План дома"}}setConfig(t){this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...t},t.default_floor&&(this._space=t.default_floor);try{this._zoomBySpace=JSON.parse(localStorage.getItem(Pt)||"{}")||{}}catch{this._zoomBySpace={}}try{const e=JSON.parse(localStorage.getItem(Dt)||"null");e&&e.config&&Array.isArray(e.config.spaces)&&(this._serverCfg=e.config,this._cfgRev=e.rev||0,this._layout=e.layout||{},this._serverStorage=!0,t.default_floor?this._space=t.default_floor:this._model.find(t=>t.id===this._space)||(this._space=this._model[0]?.id||this._space))}catch{}}_cacheSnapshot(){if(this._serverCfg)try{localStorage.setItem(Dt,JSON.stringify({config:this._serverCfg,rev:this._cfgRev,layout:this._layout}))}catch{}}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}get _model(){return this._serverCfg?this._serverCfg.spaces.map(t=>{const e=Et/t.aspect;return{id:t.id,title:t.title,vb:[t.view_box[0]*Et,t.view_box[1]*e,t.view_box[2]*Et,t.view_box[3]*e],bg:t.plan_url?{href:t.plan_url,x:0,y:0,w:Et,h:e}:null,rooms:t.rooms.map(t=>({id:t.id,name:t.name,area:t.area??null,x:null!=t.x?t.x*Et:void 0,y:null!=t.y?t.y*e:void 0,w:null!=t.w?t.w*Et:void 0,h:null!=t.h?t.h*e:void 0,poly:t.poly?t.poly.map(t=>[t[0]*Et,t[1]*e]):void 0}))}}):[]}_spaceModel(t){const e=this._model;return e.find(e=>e.id===(t??this._space))||e[0]}get _areaToSpace(){const t={};for(const e of this._model)for(const i of e.rooms)i.area&&(t[i.area]={space:e.id,room:i});return t}get _settings(){return this._serverCfg?.settings||{}}get _showAll(){return!!this._settings.show_all}_toggleShowAll(){this._serverCfg&&(this._serverCfg={...this._serverCfg,settings:{...this._serverCfg.settings,show_all:!this._showAll}},this._regSignature="",this._maybeRebuildDevices(),this._saveConfig(),this.requestUpdate())}get _excluded(){const t=this._settings.exclude_integrations;return t?new Set(t):ct}willUpdate(t){t.has("hass")&&this.hass&&(!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices())}updated(){const t=this._stageEl;t&&!this._roViewport&&(this._roViewport=new ResizeObserver(()=>this._refitView()),this._roViewport.observe(t)),t&&!this._view&&this._refitView(),this._serverStorage&&this._loadOk&&0===this._model.length&&!this._spaceDialog&&!this._onboardingShown&&(this._onboardingShown=!0,this._openSpaceDialog("create"))}async _loadFromServer(){this._loading=!0,this._loadTries++;try{const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._loadOk=!0,this._serverStorage=!0;const i=t?.config;this._serverCfg=i&&Array.isArray(i.spaces)?i:null,this._cfgRev=t?.rev||0,this._layout=e?.layout||{},this._unsubCfg||(this._unsubCfg=await this.hass.connection.subscribeEvents(t=>{(t?.data?.rev??-1)!==this._cfgRev&&this._reloadConfigOnly()},"houseplan_config_updated")),this._norm&&!this._model.find(t=>t.id===this._space)&&(this._space=this._model[0]?.id||this._space),this._cacheSnapshot(),this._restoreZoom()}catch(t){if(this._loadTries>=8){this._serverStorage=!1,this._serverCfg=null;try{this._layout=JSON.parse(localStorage.getItem(Mt)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1}this._regSignature="",this.requestUpdate()}async _reloadConfigOnly(){try{const t=await this.hass.callWS({type:"houseplan/config/get"}),e=t?.config;this._serverCfg=e&&Array.isArray(e.spaces)?e:null,this._cfgRev=t?.rev||0,this._cacheSnapshot(),this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch{}}_maybeRebuildDevices(){const t=this.hass;if(!t?.devices||!t?.entities||!t?.areas)return;const e=Object.keys(t.devices).length+":"+Object.keys(t.entities).length+":"+Object.keys(t.areas).length+":"+(this._norm?"n":"l");e===this._regSignature&&this._devices.length||(this._regSignature=e,this._devices=St({hass:t,areaToSpace:Object.fromEntries(Object.entries(this._areaToSpace).map(([t,e])=>[t,e.space])),markers:this._markers,settings:this._settings,excluded:this._excluded,showAll:this._showAll,firstSpaceId:this._model[0]?.id||""}),this._defPos=this._defaultPositions())}get _markers(){return this._serverCfg?.markers||[]}_roomLqi(t){if(!t)return null;const e=[];for(const i of this._devices){if(i.area!==t||i.virtual)continue;const s=$t(this.hass,i.entities);null!=s&&e.push(s)}return gt(e)}_roomBounds(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),a=Math.min(...i);return{x:s,y:a,w:Math.max(...e)-s,h:Math.max(...i)-a}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}_defaultPositions(){const t={},e=(this._config?.icon_size??2.5)/100*Et*1.3;for(const i of this._model)for(const s of i.rooms){if(!s.area)continue;const a=this._devices.filter(t=>t.area===s.area&&t.space===i.id);if(!a.length)continue;const o=this._roomBounds(s),n=.1*Math.min(o.w,o.h),r=o.w-2*n,l=o.h-2*n,c=Math.max(1,Math.round(Math.sqrt(a.length*r/Math.max(l,1)))),h=Math.ceil(a.length/c),d=r/c,p=l/Math.max(h,1),u=a.map((t,e)=>({x:o.x+n+d*(e%c+.5),y:o.y+n+p*(Math.floor(e/c)+.5)}));ft(u,o,e,.5*n),a.forEach((e,i)=>t[e.id]=u[i])}return t}_pos(t){const e=this._spaceModel(t.space),i=this._layout[t.id];if(i)if(this._norm){if(i.s===t.space){const e=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;return{x:i.x*Et,y:i.y*(Et/e)}}}else if(void 0===i.s)return{x:i.x,y:i.y};if(this._defPos[t.id])return this._defPos[t.id];const s=e.vb;return{x:s[0]+s[2]/2,y:s[1]+s[3]/2}}_savePos(t,e,i){if(this._norm){const s=this._gridPitch,a=Math.round(e/s)*s,o=Math.round(i/s)*s,n=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;this._layout={...this._layout,[t.id]:{s:t.space,x:a/Et,y:o/(Et/n)}}}else this._layout={...this._layout,[t.id]:{x:Math.round(e),y:Math.round(i)}};this._dirtyPos.add(t.id),this._persistLayout()}_stateClass(t){if(!this._config?.live_states)return"";const e=t.primary?this.hass.states[t.primary]:void 0;if(!e)return"";if("unavailable"===e.state)return"unavail";const i=e.entity_id.split(".")[0];if(["light","switch","fan","humidifier"].includes(i))return"on"===e.state?"on":"";if("cover"===i||"valve"===i)return["open","opening"].includes(e.state)?"open":"";if("lock"===i)return["unlocked","open"].includes(e.state)?"open":"";if("binary_sensor"===i){const t=e.attributes?.device_class;if(["door","window","garage_door","opening","gas","smoke","moisture","problem"].includes(t))return"on"===e.state?"open":""}return"media_player"===i?["playing","on"].includes(e.state)?"on":"":"vacuum"===i&&["cleaning","returning"].includes(e.state)?"on":""}_liveTemp(t){return this._config?.show_temperature?"mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon?null:wt(this.hass,t.entities):null}_openMoreInfo(t){t?Rt(this,"hass-more-info",{entityId:t}):this._showToast("У устройства нет подходящей сущности")}_clickDevice(t,e){t.stopPropagation(),this._drag?.moved||this._suppressClick||this._markup||(this._infoCard=e)}get _stageEl(){return this.renderRoot.querySelector(".stage")}_stageAspect(){const t=this._stageEl,e=this._spaceModel().vb;return t&&t.clientHeight?t.clientWidth/t.clientHeight:e[2]/e[3]}_viewOr(t){return this._view&&this._view.w?this._view:mt(t,this._stageAspect())}_screenToVb(t,e){const i=this._stageEl,s=this._viewOr(this._spaceModel().vb),a=i?.clientWidth||1,o=i?.clientHeight||1;return[s.x+t/a*s.w,s.y+e/o*s.h]}_clampView(t,e){return{w:t.w,h:t.h,x:Math.max(e.x,Math.min(e.x+e.w-t.w,t.x)),y:Math.max(e.y,Math.min(e.y+e.h-t.h,t.y))}}_applyView(t,e,i){const s=this._spaceModel().vb,a=mt(s,this._stageAspect()),o=Math.min(8,Math.max(1,t)),n=a.w/o,r=a.h/o,l=this._viewOr(s),c=e??l.x+l.w/2,h=i??l.y+l.h/2;this._zoom=o,this._view=this._clampView({x:c-n/2,y:h-r/2,w:n,h:r},a)}_refitView(){if(!this._stageEl)return;const t=this._view;this._applyView(this._zoom,t?t.x+t.w/2:void 0,t?t.y+t.h/2:void 0),this.requestUpdate()}_zoomAt(t,e,i){const s=this._stageEl;if(!s)return;const a=mt(this._spaceModel().vb,this._stageAspect()),o=Math.min(8,Math.max(1,i)),n=s.clientWidth,r=s.clientHeight,l=this._screenToVb(t,e),c=a.w/o,h=a.h/o;this._zoom=o,this._view=this._clampView({x:l[0]-t/n*c,y:l[1]-e/r*h,w:c,h:h},a)}_onWheel(t){const e=this._stageEl;if(!e)return;t.preventDefault();const i=e.getBoundingClientRect(),s=t.deltaY<0?1.15:1/1.15;this._zoomAt(t.clientX-i.left,t.clientY-i.top,this._zoom*s),this._saveZoom()}_stepZoom(t){const e=this._stageEl;e&&(this._zoomAt(e.clientWidth/2,e.clientHeight/2,this._zoom*(t>0?1.4:1/1.4)),this._saveZoom())}_resetZoom(){const t=this._spaceModel().vb;this._zoom=1,this._view=mt(t,this._stageAspect()),this._saveZoom()}_saveZoom(){this._zoomBySpace={...this._zoomBySpace,[this._space]:this._zoom};try{localStorage.setItem(Pt,JSON.stringify(this._zoomBySpace))}catch{}}_restoreZoom(){const t=this._zoomBySpace[this._space]||1;this._zoom=t,this._view=null,requestAnimationFrame(()=>{if(!this._stageEl)return;const e=this._spaceModel().vb;this._applyView(t,e[0]+e[2]/2,e[1]+e[3]/2),this.requestUpdate()})}_stagePointerDown(t){if(this._drag||this._markup)return;if(t.target.closest(".dev"))return;this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY});const e=this._viewOr(this._spaceModel().vb);if(1===this._pointers.size)this._panStart={sx:t.clientX,sy:t.clientY,vx:e.x,vy:e.y},this._suppressClick=!1;else if(2===this._pointers.size){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y);this._pinchStart={dist:e,zoom:this._zoom},this._panStart=null}}_stagePointerMove(t){if(this._pointers.has(t.pointerId)){if(this._pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this._pinchStart&&this._pointers.size>=2){const t=[...this._pointers.values()],e=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)/(this._pinchStart.dist||1),i=this._stageEl.getBoundingClientRect(),s=(t[0].x+t[1].x)/2-i.left,a=(t[0].y+t[1].y)/2-i.top;this._zoomAt(s,a,this._pinchStart.zoom*e),this._suppressClick=!0,this._saveZoom()}else if(this._panStart){const e=t.clientX-this._panStart.sx,i=t.clientY-this._panStart.sy;if(Math.abs(e)+Math.abs(i)>4&&(this._suppressClick=!0),this._zoom>1&&this._view){const t=this._stageEl,s=this._view,a=mt(this._spaceModel().vb,this._stageAspect());this._view=this._clampView({x:this._panStart.vx-e/t.clientWidth*s.w,y:this._panStart.vy-i/t.clientHeight*s.h,w:s.w,h:s.h},a)}}}else this._markupMove(t)}_stagePointerUp(t){this._pointers.delete(t.pointerId),this._pointers.size<2&&(this._pinchStart=null),0===this._pointers.size&&(this._panStart=null,setTimeout(()=>this._suppressClick=!1,0))}_clickRoom(t){var e;!this._suppressClick&&t.area&&(e="/config/areas/area/"+t.area,history.pushState(null,"",e),Rt(window,"location-changed",{replace:!1}))}_pointerDown(t,e){if(this._markup)return;t.preventDefault();const i=this._pos(e);this._drag={id:e.id,sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},t.target.setPointerCapture(t.pointerId),this._tip=null}_pointerMove(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const s=this._spaceModel().vb,a=i.getBoundingClientRect(),o=this._viewOr(s),n=(t.clientX-this._drag.sx)/a.width*o.w,r=(t.clientY-this._drag.sy)/a.height*o.h;Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0);const l=.008*Math.min(s[2],s[3]),c=Math.max(s[0]+l,Math.min(s[0]+s[2]-l,this._drag.ox+n)),h=Math.max(s[1]+l,Math.min(s[1]+s[3]-l,this._drag.oy+r));this._savePos(e,c,h)}_pointerUp(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=e.id,window.setTimeout(()=>this._drag=null,0))}_resetLayout(){confirm("Сбросить позиции всех иконок к авто-раскладке?")&&(this._layout={},this._persistLayout())}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}_showTip(t,e,i,s){this._drag||(this._tip={x:t.clientX,y:t.clientY,title:e,meta:i,lqi:s})}get _gridPitch(){return Et/240}get _curSpaceCfg(){return this._serverCfg?.spaces.find(t=>t.id===this._space)}get _spaceH(){const t=this._curSpaceCfg;return t?Et/t.aspect:Et}get _segments(){const t=this._curSpaceCfg,e=this._spaceH;return(t?.segments||[]).map(t=>[t[0]*Et,t[1]*e,t[2]*Et,t[3]*e])}_toggleMarkup(){this._norm?(this._markup=!this._markup,this._path=[],this._cursorPt=null,this._tool="draw"):this._showToast("Разметка доступна после переноса конфига на сервер (режим правки → «На сервер»)")}_svgPoint(t){const e=this.renderRoot.querySelector(".stage").getBoundingClientRect();return this._screenToVb(t.clientX-e.left,t.clientY-e.top)}_snap(t){const e=this._gridPitch;return[_t(t[0],e),_t(t[1],e)]}_samePt(t,e){return function(t,e,i=.001){return Math.abs(t[0]-e[0])<i&&Math.abs(t[1]-e[1])<i}(t,e)}_segKey(t,e){return function(t,e){const[i,s]=t[0]<e[0]||t[0]===e[0]&&t[1]<=e[1]?[t,e]:[e,t];return`${i[0].toFixed(1)},${i[1].toFixed(1)}-${s[0].toFixed(1)},${s[1].toFixed(1)}`}(t,e)}_addSegment(t,e){const i=this._curSpaceCfg;if(!i)return!1;const s=this._spaceH,a=this._segKey(t,e),o=this._segments.some(t=>this._segKey([t[0],t[1]],[t[2],t[3]])===a);return!o&&(i.segments=i.segments||[],i.segments.push([t[0]/Et,t[1]/s,e[0]/Et,e[1]/s]),this._saveConfig(),!0)}_distToSeg(t,e){const[i,s]=t,[a,o,n,r]=e,l=n-a,c=r-o;let h=((i-a)*l+(s-o)*c)/(l*l+c*c||1);h=Math.max(0,Math.min(1,h));const d=a+h*l,p=o+h*c;return Math.hypot(i-d,s-p)}_pointInRoom(t,e){return e.poly?function(t,e){let i=!1;for(let s=0,a=e.length-1;s<e.length;a=s++){const[o,n]=e[s],[r,l]=e[a];n>t[1]!=l>t[1]&&t[0]<(r-o)*(t[1]-n)/(l-n)+o&&(i=!i)}return i}(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_markupClick(t){if(!this._markup)return;const e=this._svgPoint(t);if("erase"===this._tool){const t=this._curSpaceCfg;if(!t?.segments?.length)return;const i=this._segments;let s=-1,a=.5*this._gridPitch;return i.forEach((t,i)=>{const o=this._distToSeg(e,t);o<a&&(a=o,s=i)}),void(s>=0&&(t.segments.splice(s,1),this._saveConfig(),this.requestUpdate()))}if("delroom"===this._tool){const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(e,t));if(!t)return;if(!confirm(`Удалить комнату «${t.name}»?`))return;const i=this._curSpaceCfg;return i.rooms=i.rooms.filter(e=>e.id!==t.id),this._saveConfig(),this._regSignature="",this._maybeRebuildDevices(),void this.requestUpdate()}const i=this._snap(e);if(!this._path.length)return this._path=[i],void(this._pathSegs=[]);const s=this._path[this._path.length-1];if(this._samePt(i,s))return;const a=this._addSegment(s,i);this._pathSegs=[...this._pathSegs,a?this._segKey(s,i):null],this._path=[...this._path,i],this._path.length>=4&&this._samePt(i,this._path[0])&&(this._cursorPt=null,this._nameSel="",this._areaSel="",this._roomDialog=!0)}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])}_markupMove(t){this._markup&&"draw"===this._tool&&this._path.length&&!this._contourClosed&&(this._cursorPt=this._snap(this._svgPoint(t)))}_saveRoom(){this._areaSel&&this._commitRoom()}_saveRoomNoArea(){this._nameSel.trim()&&(this._areaSel="",this._commitRoom())}_commitRoom(){if(!this._contourClosed)return;const t=this._curSpaceCfg;if(!t)return;const e=this._spaceH,i=this._path.slice(0,-1),s=this._areaSel?this.hass.areas[this._areaSel]?.name:"";t.rooms.push({id:"r"+Date.now().toString(36),name:this._nameSel||s||"Комната",area:this._areaSel||null,poly:i.map(t=>[t[0]/Et,t[1]/e])}),this._saveConfig(),this._path=[],this._pathSegs=[];const a=this._areaSel;this._areaSel="",this._nameSel="",this._roomDialog=!1,this._regSignature="",this._maybeRebuildDevices();let o=0;if(a){const t=this._serverCfg?.spaces.find(t=>t.id===this._space)?.aspect||1,e=Et/t,i={...this._layout};for(const t of this._devices){if(t.area!==a||t.space!==this._space)continue;if(o++,this._layout[t.id])continue;const s=this._defPos[t.id];s&&(i[t.id]={s:this._space,x:s.x/Et,y:s.y/e},this._dirtyPos.add(t.id))}this._layout=i,this._persistLayout()}const n=this._model.find(t=>t.id===this._space)?.rooms.length||0;this._showToast(a?`Комната сохранена (${n}). Устройств добавлено: ${o}. Обведите следующую или выйдите из разметки.`:`Комната сохранена (${n}, без зоны). Обведите следующую или выйдите из разметки.`)}_cancelPath(){this._path=[],this._pathSegs=[],this._cursorPt=null,this._roomDialog=!1}_roomDialogCancel(){this._roomDialog=!1,this._undoPoint()}get _freeAreas(){const t=new Set;for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.add(i.area);return Object.values(this.hass?.areas||{}).filter(e=>!t.has(e.area_id)).sort((t,e)=>(t.name||"").localeCompare(e.name||""))}_openMarkerDialog(t){this._norm?this._markerDialog=t?{devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingFilter:"",icon:t.marker?.icon||"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.space&&t.area?t.space+"#"+t.area:"",busy:!1}:{name:"",binding:"virtual",bindingFilter:"",icon:"",model:"",link:"",description:"",pdfs:[],room:"",busy:!1}:this._showToast("Редактирование устройств доступно после переноса конфига на сервер")}_bindingCandidates(){const t=this.hass,e=new Set;for(const t of this._devices)t.id!==this._markerDialog?.devId&&("device"===t.bindingKind&&t.bindingRef&&e.add("device:"+t.bindingRef),"entity"===t.bindingKind&&t.bindingRef&&e.add("entity:"+t.bindingRef));const i=new Set;for(const t of this._devices)"device"===t.bindingKind&&t.name&&i.add(t.name.trim()+"|"+(t.area||""));const s=[];for(const a of Object.values(t.devices)){if("service"===a.entry_type)continue;const t="device:"+a.id;if(e.has(t))continue;const o=(a.name_by_user||a.name||a.id).trim();t!==this._markerDialog?.binding&&i.has(o+"|"+(a.area_id||""))||s.push({value:t,label:o,sub:(a.model||"устройство")+("Group"===a.model?" · Z2M-группа":"")})}const a=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);for(const[i,o]of Object.entries(t.entities)){const n="entity:"+i;if(e.has(n))continue;const r=a.has(o.platform),l="group"===o.platform;if(!r&&!l)continue;if(o.hidden)continue;const c=t.states[i];s.push({value:n,label:o.name||c?.attributes?.friendly_name||i,sub:i.split(".")[0]+" · "+("group"===o.platform?"группа":"хелпер")})}const o=(this._markerDialog?.bindingFilter||"").toLowerCase().trim(),n=o?s.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(o)):s;return n.sort((t,e)=>t.label.localeCompare(e.label)),n.slice(0,200)}_allRoomsFlat(){const t=[];for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.push({value:e.id+"#"+i.area,label:(e.title||e.id)+" · "+i.name});return t}_errText(t){if(!t)return"неизвестная ошибка";if("string"==typeof t)return t;if(t.message)return t.message;if(t.error)return t.error;if(null!=t.code)return"код "+t.code;try{return JSON.stringify(t)}catch{return String(t)}}async _pickMarkerFiles(t){const e=t.target,i=e.files?[...e.files]:[];if(e.value="",!i.length||!this._markerDialog)return;const s=this._markerDialog.devId||"new",a=[];for(const t of i)try{const e=new FormData;e.append("marker_id",s),e.append("file",t,t.name);const i=this.hass?.fetchWithAuth?await this.hass.fetchWithAuth("/api/houseplan/upload",{method:"POST",body:e}):await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:this.hass?.auth?.data?.access_token?{authorization:`Bearer ${this.hass.auth.data.access_token}`}:{}}),o=await i.json().catch(()=>({}));if(!i.ok||o.error){const t={too_large:"файл больше "+(o.max_mb||25)+" МБ",bad_ext:"недопустимый тип (нужен PDF/изображение)",unauthorized:"нужны права администратора"};throw new Error(t[o.error]||o.error||"HTTP "+i.status)}a.push({name:o.name||t.name,url:o.url})}catch(e){this._showToast("Файл «"+t.name+"» не загружен: "+this._errText(e))}a.length&&this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:[...this._markerDialog.pdfs,...a]},this._showToast("Прикреплено файлов: "+a.length))}_removeMarkerPdf(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:this._markerDialog.pdfs.filter(e=>e.url!==t)})}async _saveMarker(){const t=this._markerDialog;if(t&&!t.busy)if("virtual"!==t.binding||t.name.trim()){this._markerDialog={...t,busy:!0};try{const e=this._serverCfg;let i;e.markers=e.markers||[];const[s,a]=t.room?t.room.split("#"):["",""];let o=s||null,n=a||null;"virtual"!==t.binding||o||(o=this._space),i=function(t,e,i){const[s,a]=t.split(":");return"device"===s?a:"entity"===s?"lg_"+a:e&&e.startsWith("v_")?e:i()}(t.binding,t.devId,()=>"v_"+Date.now().toString(36));const r=t.devId,l={id:i,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs};("virtual"===t.binding||t.room)&&(l.space=o,l.area=n);const c=r?this._devices.find(t=>t.id===r):null,h=!!t.room&&null!=c&&(c.space!==o||c.area!==n);e.markers=e.markers.filter(t=>t.id!==i&&t.id!==r),e.markers.push(l);let d=null;if(!this._layout[i]||h){const t=this._spaceModel(o||void 0);let e=t.vb[0]+t.vb[2]/2,s=t.vb[1]+t.vb[3]/2;if(n){const i=t.rooms.find(t=>t.area===n);i&&([e,s]=this._roomCenter(i))}d=this._normPos(o||this._space,e,s),this._layout={...this._layout,[i]:d}}await this._saveConfigNow(),d&&await this.hass.callWS({type:"houseplan/layout/update",device_id:i,pos:d}),r&&r!==i&&(delete this._layout[r],await this.hass.callWS({type:"houseplan/layout/delete",device_id:r}).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast("Устройство сохранено")}catch(t){this._markerDialog={...this._markerDialog,busy:!1},this._showToast("Ошибка: "+this._errText(t))}}else this._showToast("Укажите имя виртуального устройства")}async _deleteMarker(){const t=this._markerDialog;if(!t)return;const e=t.devId?this._devices.find(e=>e.id===t.devId):null,i=t.name||"устройство";if(!confirm(`Убрать «${i}» с плана?`))return;const s=this._serverCfg;s.markers=s.markers||[],e&&"virtual"===e.bindingKind?s.markers=s.markers.filter(t=>t.id!==e.id):e&&e.marker?(s.markers=s.markers.filter(t=>t.id!==e.id),"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0})):e&&"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):e&&"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0});try{await this._saveConfigNow(),e&&"virtual"===e.bindingKind&&this._layout[e.id]&&(delete this._layout[e.id],await this.hass.callWS({type:"houseplan/layout/delete",device_id:e.id}).catch(()=>{})),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast("Устройство убрано с плана")}catch(t){this._showToast("Ошибка: "+this._errText(t))}}_normPos(t,e,i){const s=this._serverCfg.spaces.find(e=>e.id===t)?.aspect||1;return{s:t,x:e/Et,y:i/(Et/s)}}_openSpaceDialog(t,e){if(this._serverStorage&&this._serverCfg)if("edit"===t){const i=this._serverCfg.spaces.find(t=>t.id===e);if(!i)return;this._spaceDialog={mode:t,spaceId:e,title:i.title,planUrl:i.plan_url||null,planFile:null,busy:!1}}else this._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,busy:!1};else this._showToast("Интеграция House Plan не установлена — управление недоступно")}async _pickPlanFile(t){const e=t.target,i=e.files?.[0];if(!i||!this._spaceDialog)return;const s={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[i.type]||(i.name.toLowerCase().endsWith(".svg")?"svg":"");if(!s)return void this._showToast("Поддерживаются SVG, PNG, JPG, WebP");const a=new Uint8Array(await i.arrayBuffer());let o="";for(let t=0;t<a.length;t+=32768)o+=String.fromCharCode(...a.subarray(t,t+32768));const n=btoa(o),r=URL.createObjectURL(i),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=r});URL.revokeObjectURL(r),this._spaceDialog={...this._spaceDialog,planFile:{ext:s,b64:n,aspect:l,name:i.name}}}async _saveSpaceDialog(){const t=this._spaceDialog;if(!t||t.busy||!t.title.trim())return;if(!t.planFile&&!t.planUrl)return void this._showToast("Загрузите подложку — план этажа обязателен");const e="create"===t.mode&&0===(this._serverCfg?.spaces.length||0);this._spaceDialog={...t,busy:!0};try{const i=this._serverCfg;let s;if("create"===t.mode?(s={id:"s"+Date.now().toString(36),title:t.title.trim(),plan_url:null,aspect:1.414,view_box:[0,0,1,1],rooms:[],segments:[]},i.spaces.push(s)):(s=i.spaces.find(e=>e.id===t.spaceId),s.title=t.title.trim()),t.planFile){const e=await this.hass.callWS({type:"houseplan/plan/set",space_id:s.id,ext:t.planFile.ext,data:t.planFile.b64});s.plan_url=e.url,s.aspect=t.planFile.aspect}await this._saveConfigNow(),this._spaceDialog=null,"create"===t.mode&&(this._space=s.id),this._regSignature="",this._maybeRebuildDevices(),e?(this._markup=!0,this._tool="draw",this._path=[],this._cursorPt=null,this._showToast("Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.")):this._showToast("create"===t.mode?"Пространство добавлено":"Пространство сохранено")}catch(t){this._spaceDialog={...this._spaceDialog,busy:!1},this._showToast("Ошибка: "+this._errText(t))}}async _deleteSpace(){const t=this._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this._serverCfg.spaces.find(e=>e.id===t.spaceId);if(confirm(`Удалить пространство «${e.title}» со всеми комнатами и разметкой?`)){this._serverCfg.spaces=this._serverCfg.spaces.filter(e=>e.id!==t.spaceId);try{await this._saveConfigNow(),this._spaceDialog=null,this._space===t.spaceId&&(this._space=this._serverCfg.spaces[0]?.id||""),this._regSignature="",this._maybeRebuildDevices(),this._showToast("Пространство удалено")}catch(t){this._showToast("Ошибка удаления: "+this._errText(t))}}}async _saveConfigNow(){const t=await this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev});this._cfgRev=t?.rev??this._cfgRev+1}render(){if(!this._config||!this.hass)return B;const t=this._model;if(!t.length)return j`<ha-card>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title||"План дома"}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>Пространств пока нет.</p>
          ${this._serverStorage?j`<p class="muted">Добавьте первое пространство и загрузите план этажа.</p>
                <button class="btn on" @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>Добавить пространство
                </button>`:j`<p class="muted">Установите интеграцию House Plan и добавьте запись в «Устройства и службы».</p>`}
        </div>
        ${this._spaceDialog?this._renderSpaceDialog():B}
        ${this._toast?j`<div class="toast">${this._toast}</div>`:B}
      </ha-card>`;const e=this._spaceModel(),i=e.vb,s=this._devices.filter(t=>t.space===e.id),a=this._config.icon_size??2.5,o=a>8?2.5:a,n=this._viewOr(i);return j`
      <ha-card>
        <div class="hdr">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title||"План дома"}
          </div>
          <div class="tabs">
            ${t.map(t=>j`<button
                class="tab ${this._space===t.id?"active":""}"
                @click=${()=>{this._space=t.id,this._selId=null,this._restoreZoom()}}
              >
                ${t.title}${this._norm?j`<ha-icon class="tabedit" icon="mdi:pencil"
                      title="Настроить пространство"
                      @click=${e=>{e.stopPropagation(),this._openSpaceDialog("edit",t.id)}}></ha-icon>`:B}
              </button>`)}
            ${this._norm?j`<button class="tab tabadd" title="Добавить пространство"
                  @click=${()=>this._openSpaceDialog("create")}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`:B}
          </div>
          <span class="count">${s.length} устр.</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${()=>this._stepZoom(-1)} title="Отдалить"><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._resetZoom()} ?disabled=${1===this._zoom}
              title="Сбросить масштаб"><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${()=>this._stepZoom(1)} title="Приблизить"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm?j`<button class="btn" @click=${()=>this._openMarkerDialog()}
                title="Добавить устройство на план">
                <ha-icon icon="mdi:plus-box-outline"></ha-icon>
              </button>`:B}
          ${this._norm?j`<button class="btn ${this._showAll?"on":""}" @click=${this._toggleShowAll}
                title="Показывать все устройства зоны (без курирования)">
                <ha-icon icon="${this._showAll?"mdi:eye":"mdi:eye-off-outline"}"></ha-icon>
              </button>
              <button class="btn" @click=${this._resetLayout} title="Сбросить позиции значков к авто-раскладке">
                <ha-icon icon="mdi:backup-restore"></ha-icon>
              </button>`:B}
          <button class="btn ${this._markup?"on":""}" @click=${this._toggleMarkup}
            title="Разметка комнат: сетка, линии, контуры">
            <ha-icon icon="mdi:vector-square-edit"></ha-icon>
          </button>
        </div>
        ${this._markup?this._renderMarkupBar():B}
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
            ${this._markup?this._renderMarkupDefs(i):B}
            ${e.bg?F`<image href="${e.bg.href}" x="${e.bg.x}" y="${e.bg.y}" width="${e.bg.w}" height="${e.bg.h}" preserveAspectRatio="none" />`:B}
            ${e.rooms.filter(t=>t.area||this._markup).map(t=>{const i="room "+(e.bg?"overlay":"yard")+(this._markup?" outlined":""),s=e=>this._showTip(e,t.name,"комната — открыть зону",this._config?.show_signal?this._roomLqi(t.area):null),a=!e.bg||this._markup,o=this._roomCenter(t),n=t.poly?F`<polygon class="${i}" points="${t.poly.map(t=>t.join(",")).join(" ")}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${s}
                    @mouseleave=${()=>this._tip=null}></polygon>`:F`<rect class="${i}"
                    x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${.03*Math.min(t.w,t.h)}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${s}
                    @mouseleave=${()=>this._tip=null}></rect>`;return F`${n}${a?F`<text class="rlabel" x="${o[0]}" y="${o[1]}">${t.name}</text>`:B}`})}
            ${this._markup?this._renderMarkupLayer(i):B}
          </svg>
          <div class="devlayer" style="--icon-size:${(o*i[2]/n.w).toFixed(3)}cqw">
            ${s.map(t=>this._renderDevice(t,n))}
          </div>
          </div>
          ${this._zoom>1?j`<div class="zoombadge">${Math.round(100*this._zoom)}%</div>`:B}
        </div>

        ${this._roomDialog?this._renderRoomDialog():B}
        ${this._spaceDialog?this._renderSpaceDialog():B}
        ${this._markerDialog?this._renderMarkerDialog():B}
        ${this._infoCard?this._renderInfoCard():B}
        ${this._tip?j`<div class="tip" style="left:${this._tip.x+12}px;top:${this._tip.y+12}px">
              <b>${this._tip.title}</b>${this._tip.meta?j`<span class="m">${this._tip.meta}</span>`:B}
              ${null!=this._tip.lqi?j`<span class="m">средний сигнал zigbee:
                    <b style="color:${ut(this._tip.lqi)}">${this._tip.lqi}</b></span>`:B}
            </div>`:B}
        ${this._toast?j`<div class="toast">${this._toast}</div>`:B}
      </ha-card>
    `}_renderDevice(t,e){const i=this._pos(t),s=(i.x-e.x)/e.w*100,a=(i.y-e.y)/e.h*100,o=this._stateClass(t),n=this._liveTemp(t),r=this._config?.show_signal&&!t.virtual?$t(this.hass,t.entities):null;return j`<div
      class="dev ${o} ${this._selId===t.id?"sel":""} ${t.virtual?"virtual":""}"
      style="left:${s}%;top:${a}%"
      @click=${e=>this._clickDevice(e,t)}
      @mousemove=${e=>this._showTip(e,t.name,t.model+(null!=n?" · "+n+"°":"")+(null!=r?" · LQI "+r:""))}
      @mouseleave=${()=>this._tip=null}
      @pointerdown=${e=>this._pointerDown(e,t)}
      @pointermove=${e=>this._pointerMove(e,t)}
      @pointerup=${e=>this._pointerUp(e,t)}
    >
      <ha-icon icon="${t.icon}"></ha-icon>
      ${null!=n?j`<span class="tval">${n}°</span>`:B}
      ${null!=r?j`<span class="lqi" style="color:${ut(r)}">${r}</span>`:B}
    </div>`}_roomCenter(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}_renderMarkupDefs(t){const e=this._gridPitch,i=.14*e;return F`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${e}" height="${e}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="0" cy="${e}" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="${e}" r="${i}" class="griddot"></circle>
        </pattern>
      </defs>`}_renderMarkupLayer(t){const e=this._segments,i=this._path,s=this._gridPitch;return F`
      <rect x="${t[0]}" y="${t[1]}" width="${t[2]}" height="${t[3]}" fill="url(#hp-grid)" pointer-events="none"></rect>
      ${e.map(t=>F`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${i.length>1?F`<polyline class="pathline" points="${i.map(t=>t.join(",")).join(" ")}"></polyline>`:B}
      ${i.length&&this._cursorPt&&"draw"===this._tool&&!this._contourClosed?F`<line class="preview" x1="${i[i.length-1][0]}" y1="${i[i.length-1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:B}
      ${i.map((t,e)=>F`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*s}"></circle>`)}
    `}_renderMarkupBar(){return j`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <button class="btn ${"draw"===this._tool?"on":""}" @click=${()=>this._tool="draw"}
        title="Добавить комнату: соединяйте точки сетки линиями до замкнутого контура">
        <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>Добавить
      </button>
      <button class="btn ${"erase"===this._tool?"on":""}" @click=${()=>this._tool="erase"}
        title="Стереть линию: клик по линии">
        <ha-icon icon="mdi:eraser"></ha-icon>Стереть
      </button>
      <button class="btn ${"delroom"===this._tool?"on":""}" @click=${()=>this._tool="delroom"}
        title="Удалить комнату: клик внутри комнаты">
        <ha-icon icon="mdi:delete-outline"></ha-icon>Удалить
      </button>
      <span class="spacer"></span>
      ${"draw"===this._tool?j`<span class="hint">${this._path.length?"точек: "+this._path.length+" · Esc/Ctrl+Z — убрать точку · замкните контур кликом по первой":"кликните точку сетки, чтобы начать контур"}</span>
            ${this._path.length?j`<button class="btn ghost" @click=${this._cancelPath}>Сброс</button>`:B}`:B}
    </div>`}_renderInfoCard(){const t=this._infoCard,e=t.primary?this.hass.states[t.primary]:void 0,i=e?this.hass.formatEntityState?.(e)??e.state:null;return j`<div class="menuwrap dialogwrap" @click=${()=>this._infoCard=null}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="${t.icon}"></ha-icon>${t.name}</div>
        <div class="body">
          ${t.model?j`<div class="inforow"><span class="k">Модель</span><span>${t.model}</span></div>`:B}
          ${i?j`<div class="inforow"><span class="k">Состояние</span><span>${i}</span></div>`:B}
          ${vt(t.link)?j`<div class="inforow"><span class="k">Ссылка</span>
                <a href="${vt(t.link)}" target="_blank" rel="noreferrer noopener">${t.link}</a></div>`:B}
          ${t.description?j`<div class="infodesc">${t.description}</div>`:B}
          ${t.pdfs&&t.pdfs.length?j`<div class="inforow"><span class="k">Инструкции</span><span class="pdflist">
                ${t.pdfs.map(t=>j`<a class="pdf" href="${vt(t.url)||"#"}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${t.name}</a>`)}</span></div>`:B}
          ${t.model||i||t.link||t.description||t.pdfs&&t.pdfs.length?B:j`<div class="infodesc muted">Нет дополнительной информации</div>`}
        </div>
        <div class="row">
          <button class="btn" @click=${()=>{const e=t;this._infoCard=null,this._openMarkerDialog(e)}}>
            <ha-icon icon="mdi:pencil"></ha-icon>Редактировать
          </button>
          ${t.primary?j`<button class="btn" @click=${()=>{const e=t.primary;this._infoCard=null,this._openMoreInfo(e)}}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>Открыть в HA
              </button>`:B}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._infoCard=null}>Закрыть</button>
        </div>
      </div>
    </div>`}_renderMarkerDialog(){const t=this._markerDialog,e="virtual"===t.binding,i=this._bindingCandidates(),s=(()=>{if(e)return null;const s=i.find(e=>e.value===t.binding);if(s)return s.label;const[a,o]=t.binding.split(":");return"device"===a?this.hass.devices[o]?.name_by_user||this.hass.devices[o]?.name||o:this.hass.states[o]?.attributes?.friendly_name||o})();return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog wide" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus"></ha-icon>
          ${t.devId?"Устройство на плане":"Новое устройство"}</div>
        <div class="body">
          <label>Имя (отображается на плане)</label>
          <input class="namein" type="text" placeholder="Название"
            .value=${t.name}
            @input=${e=>this._markerDialog={...t,name:e.target.value}} />

          <label>Привязка к устройству HA</label>
          <div class="bindsel ${e?"virt":""}">
            <button class="opt ${e?"on":""}"
              @click=${()=>this._markerDialog={...t,binding:"virtual"}}>
              <ha-icon icon="mdi:map-marker-outline"></ha-icon>Виртуальное устройство (без привязки)
            </button>
            ${e?B:j`<div class="curbind"><ha-icon icon="mdi:link-variant"></ha-icon>
                  <b>${s}</b><span class="ref">${t.binding}</span></div>`}
            <input class="namein" type="text" placeholder="Поиск устройства / группы…"
              .value=${t.bindingFilter}
              @input=${e=>this._markerDialog={...t,bindingFilter:e.target.value}} />
            <div class="candlist">
              ${i.map(e=>j`<div class="cand ${e.value===t.binding?"sel":""}"
                  @click=${()=>this._markerDialog={...t,binding:e.value}}>
                  <span class="cl">${e.label}</span><span class="cs">${e.sub}</span>
                </div>`)}
              ${i.length?B:j`<div class="cand muted">ничего не найдено</div>`}
            </div>
          </div>

          <label>Комната${e?"":" (переопределить размещение)"}</label>
          <select class="areasel"
            @change=${e=>this._markerDialog={...t,room:e.target.value}}>
            <option value="">${e?"— выберите комнату —":"— по зоне устройства (авто) —"}</option>
            ${this._allRoomsFlat().map(e=>j`<option value=${e.value} ?selected=${e.value===t.room}>${e.label}</option>`)}
          </select>

          <label>Иконка</label>
          ${customElements.get("ha-icon-picker")?j`<ha-icon-picker .hass=${this.hass} .value=${t.icon}
                @value-changed=${e=>this._markerDialog={...t,icon:e.detail.value||""}}></ha-icon-picker>`:j`<input class="namein" type="text" placeholder="mdi:… (пусто = авто)"
                .value=${t.icon}
                @input=${e=>this._markerDialog={...t,icon:e.target.value}} />`}

          <label>Модель</label>
          <input class="namein" type="text" placeholder="напр. Aqara T&amp;H"
            .value=${t.model}
            @input=${e=>this._markerDialog={...t,model:e.target.value}} />

          <label>Ссылка</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${t.link}
            @input=${e=>this._markerDialog={...t,link:e.target.value}} />

          <label>Описание</label>
          <textarea class="descin" rows="3" placeholder="Заметки, характеристики…"
            .value=${t.description}
            @input=${e=>this._markerDialog={...t,description:e.target.value}}></textarea>

          <label>Инструкции (PDF и т.п.)</label>
          <div class="pdfedit">
            ${t.pdfs.map(t=>j`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${vt(t.url)||"#"}" target="_blank" rel="noreferrer noopener">${t.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${()=>this._removeMarkerPdf(t.url)}></ha-icon></span>`)}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>Прикрепить…
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${t=>this._pickMarkerFiles(t)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${t.devId?j`<button class="btn danger" @click=${this._deleteMarker}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>Убрать
              </button>`:B}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._markerDialog=null}>Отмена</button>
          <button class="btn on" @click=${this._saveMarker} ?disabled=${t.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":"Сохранить"}
          </button>
        </div>
      </div>
    </div>`}_renderSpaceDialog(){const t=this._spaceDialog;return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>
          ${"create"===t.mode?"Новое пространство":"Пространство"}</div>
        <div class="body">
          <label>Название</label>
          <input class="namein" type="text" placeholder="Например: Гараж"
            .value=${t.title}
            @input=${e=>this._spaceDialog={...t,title:e.target.value}} />
          <label>Подложка (план)</label>
          <div class="planrow">
            ${t.planFile?j`<span class="planname">${t.planFile.name}</span>`:t.planUrl?j`<img class="planprev" src=${t.planUrl} alt="план" />`:j`<span class="planname muted">нет подложки</span>`}
            <label class="btn filebtn">
              <ha-icon icon="mdi:upload"></ha-icon>${t.planUrl||t.planFile?"Заменить…":"Загрузить…"}
              <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                @change=${t=>this._pickPlanFile(t)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${"edit"===t.mode?j`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>Удалить
              </button>`:B}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${()=>this._spaceDialog=null}>Отмена</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!t.title.trim()||!(t.planFile||t.planUrl)||t.busy}
            title=${t.planFile||t.planUrl?"":"Загрузите подложку (план этажа)"}>
            <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":"Сохранить"}
          </button>
        </div>
      </div>
    </div>`}_renderRoomDialog(){const t=this._freeAreas;return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
      <div class="dialog" @click=${t=>t.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>Новая комната</div>
        <div class="body">
          <label>Отображаемое имя</label>
          <input class="namein" type="text" placeholder="Например: Терраса"
            .value=${this._nameSel}
            @input=${t=>this._nameSel=t.target.value} />
          <label>Зона Home Assistant (свободные)</label>
          <select class="areasel"
            @change=${t=>{this._areaSel=t.target.value,!this._nameSel&&this._areaSel&&(this._nameSel=this.hass.areas[this._areaSel]?.name||""),this.requestUpdate()}}>
            <option value="">— без зоны —</option>
            ${t.map(t=>j`<option value=${t.area_id} ?selected=${t.area_id===this._areaSel}>${t.name}</option>`)}
          </select>
        </div>
        <div class="row">
          <button class="btn ghost" @click=${this._roomDialogCancel}>Отмена</button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
            title="Декоративная комната без привязки к зоне (например, холл)">
            Без зоны
          </button>
          <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
            title=${this._areaSel?"":"Выберите зону Home Assistant"}>
            <ha-icon icon="mdi:check"></ha-icon>Сохранить
          </button>
        </div>
      </div>
    </div>`}}Ot.properties={hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_markup:{state:!0},_tool:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_markerDialog:{state:!0},_zoom:{state:!0},_view:{state:!0}},Ot.styles=zt,customElements.get("houseplan-card")||customElements.define("houseplan-card",Ot),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-card"===t.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Интерактивный план дома: пространства, комнаты, устройства с живыми состояниями и drag-раскладкой."}),console.info("%c HOUSEPLAN-CARD %c v1.10.0 ","background:#3ea6ff;color:#04121f;font-weight:700","");
