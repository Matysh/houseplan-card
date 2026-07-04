const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let a=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const n=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new a("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:r,defineProperty:o,getOwnPropertyDescriptor:l,getOwnPropertyNames:c,getOwnPropertySymbols:h,getPrototypeOf:d}=Object,p=globalThis,u=p.trustedTypes,_=u?u.emptyScript:"",g=p.reactiveElementPolyfillSupport,m=(t,e)=>t,f={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},v=(t,e)=>!r(t,e),b={attribute:!0,type:String,converter:f,reflect:!1,useDefault:!1,hasChanged:v};Symbol.metadata??=Symbol("metadata"),p.litPropertyMetadata??=new WeakMap;let y=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&o(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:a}=l(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);a?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(m("elementProperties")))return;const t=d(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(m("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(m("properties"))){const t=this.properties,e=[...c(t),...h(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(n(t))}else void 0!==t&&e.push(n(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),a=t.litNonce;void 0!==a&&s.setAttribute("nonce",a),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const a=(void 0!==i.converter?.toAttribute?i.converter:f).toAttribute(e,i.type);this._$Em=t,null==a?this.removeAttribute(s):this.setAttribute(s,a),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),a="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:f;this._$Em=s;const n=a.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,a){if(void 0!==t){const n=this.constructor;if(!1===s&&(a=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??v)(a,e)||i.useDefault&&i.reflect&&a===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:a},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==a||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[m("elementProperties")]=new Map,y[m("finalized")]=new Map,g?.({ReactiveElement:y}),(p.reactiveElementVersions??=[]).push("2.1.2");const $=globalThis,x=t=>t,w=$.trustedTypes,k=w?w.createPolicy("lit-html",{createHTML:t=>t}):void 0,S="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,A="?"+C,D=`<${A}>`,P=document,E=()=>P.createComment(""),M=t=>null===t||"object"!=typeof t&&"function"!=typeof t,R=Array.isArray,z="[ \t\n\f\r]",T=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,U=/-->/g,O=/>/g,H=RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),I=/'/g,N=/"/g,q=/^(?:script|style|textarea|title)$/i,F=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),j=F(1),L=F(2),K=Symbol.for("lit-noChange"),B=Symbol.for("lit-nothing"),W=new WeakMap,X=P.createTreeWalker(P,129);function Y(t,e){if(!R(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==k?k.createHTML(e):e}const G=(t,e)=>{const i=t.length-1,s=[];let a,n=2===e?"<svg>":3===e?"<math>":"",r=T;for(let e=0;e<i;e++){const i=t[e];let o,l,c=-1,h=0;for(;h<i.length&&(r.lastIndex=h,l=r.exec(i),null!==l);)h=r.lastIndex,r===T?"!--"===l[1]?r=U:void 0!==l[1]?r=O:void 0!==l[2]?(q.test(l[2])&&(a=RegExp("</"+l[2],"g")),r=H):void 0!==l[3]&&(r=H):r===H?">"===l[0]?(r=a??T,c=-1):void 0===l[1]?c=-2:(c=r.lastIndex-l[2].length,o=l[1],r=void 0===l[3]?H:'"'===l[3]?N:I):r===N||r===I?r=H:r===U||r===O?r=T:(r=H,a=void 0);const d=r===H&&t[e+1].startsWith("/>")?" ":"";n+=r===T?i+D:c>=0?(s.push(o),i.slice(0,c)+S+i.slice(c)+C+d):i+C+(-2===c?e:d)}return[Y(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class V{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let a=0,n=0;const r=t.length-1,o=this.parts,[l,c]=G(t,e);if(this.el=V.createElement(l,i),X.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=X.nextNode())&&o.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(S)){const e=c[n++],i=s.getAttribute(t).split(C),r=/([.?@])?(.*)/.exec(e);o.push({type:1,index:a,name:r[2],strings:i,ctor:"."===r[1]?et:"?"===r[1]?it:"@"===r[1]?st:tt}),s.removeAttribute(t)}else t.startsWith(C)&&(o.push({type:6,index:a}),s.removeAttribute(t));if(q.test(s.tagName)){const t=s.textContent.split(C),e=t.length-1;if(e>0){s.textContent=w?w.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],E()),X.nextNode(),o.push({type:2,index:++a});s.append(t[e],E())}}}else if(8===s.nodeType)if(s.data===A)o.push({type:2,index:a});else{let t=-1;for(;-1!==(t=s.data.indexOf(C,t+1));)o.push({type:7,index:a}),t+=C.length-1}a++}}static createElement(t,e){const i=P.createElement("template");return i.innerHTML=t,i}}function J(t,e,i=t,s){if(e===K)return e;let a=void 0!==s?i._$Co?.[s]:i._$Cl;const n=M(e)?void 0:e._$litDirective$;return a?.constructor!==n&&(a?._$AO?.(!1),void 0===n?a=void 0:(a=new n(t),a._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=a:i._$Cl=a),void 0!==a&&(e=J(t,a._$AS(t,e.values),a,s)),e}class Z{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??P).importNode(e,!0);X.currentNode=s;let a=X.nextNode(),n=0,r=0,o=i[0];for(;void 0!==o;){if(n===o.index){let e;2===o.type?e=new Q(a,a.nextSibling,this,t):1===o.type?e=new o.ctor(a,o.name,o.strings,this,t):6===o.type&&(e=new at(a,this,t)),this._$AV.push(e),o=i[++r]}n!==o?.index&&(a=X.nextNode(),n++)}return X.currentNode=P,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Q{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=B,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=J(this,t,e),M(t)?t===B||null==t||""===t?(this._$AH!==B&&this._$AR(),this._$AH=B):t!==this._$AH&&t!==K&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>R(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==B&&M(this._$AH)?this._$AA.nextSibling.data=t:this.T(P.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=V.createElement(Y(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new Z(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=W.get(t.strings);return void 0===e&&W.set(t.strings,e=new V(t)),e}k(t){R(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const a of t)s===e.length?e.push(i=new Q(this.O(E()),this.O(E()),this,this.options)):i=e[s],i._$AI(a),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=x(t).nextSibling;x(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,a){this.type=1,this._$AH=B,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=a,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=B}_$AI(t,e=this,i,s){const a=this.strings;let n=!1;if(void 0===a)t=J(this,t,e,0),n=!M(t)||t!==this._$AH&&t!==K,n&&(this._$AH=t);else{const s=t;let r,o;for(t=a[0],r=0;r<a.length-1;r++)o=J(this,s[i+r],e,r),o===K&&(o=this._$AH[r]),n||=!M(o)||o!==this._$AH[r],o===B?t=B:t!==B&&(t+=(o??"")+a[r+1]),this._$AH[r]=o}n&&!s&&this.j(t)}j(t){t===B?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===B?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==B)}}class st extends tt{constructor(t,e,i,s,a){super(t,e,i,s,a),this.type=5}_$AI(t,e=this){if((t=J(this,t,e,0)??B)===K)return;const i=this._$AH,s=t===B&&i!==B||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,a=t!==B&&(i===B||s);s&&this.element.removeEventListener(this.name,this,i),a&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class at{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){J(this,t)}}const nt=$.litHtmlPolyfillSupport;nt?.(V,Q),($.litHtmlVersions??=[]).push("3.3.3");const rt=globalThis;class ot extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let a=s._$litPart$;if(void 0===a){const t=i?.renderBefore??null;s._$litPart$=a=new Q(e.insertBefore(E(),t),t,void 0,i??{})}return a._$AI(t),a})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}}ot._$litElement$=!0,ot.finalized=!0,rt.litElementHydrateSupport?.({LitElement:ot});const lt=rt.litElementPolyfillSupport;lt?.({LitElement:ot}),(rt.litElementVersions??=[]).push("4.2.2");const ct=new Set(["hacs","sun","backup","hassio","met","telegram_bot","mobile_app","systemmonitor","better_thermostat","adaptive_lighting","yandex_pogoda","upnp_serial_number"]),ht=[["протечк","mdi:water-alert"],["клапан","mdi:pipe-valve"],["дым","mdi:smoke-detector"],["термоголов","mdi:radiator"],["температ","mdi:thermometer"],["qingping|air monitor|молекул","mdi:air-filter"],["штор","mdi:roller-shade"],["розетк|plug","mdi:power-socket-de"],["выключат|switch","mdi:light-switch"],["лампа|лампочк|bulb|gx53|светильник|rgb","mdi:lightbulb"],["камер|camera","mdi:cctv"],["замок|ttlock|lock|sn609|sn9161","mdi:lock"],["ворота|garage","mdi:garage-variant"],["калитк|door|открыт","mdi:door"],["счётчик|счетчик|kws|meter","mdi:meter-electric"],["вводный автомат|breaker|wifimcbn","mdi:electric-switch"],["myheat|котёл|котел|boiler|отоплен","mdi:water-boiler"],["холодильник|fridge","mdi:fridge"],["стиральн|washer","mdi:washing-machine"],["сушилк|dryer","mdi:tumble-dryer"],["пылесос|vacuum|dreame","mdi:robot-vacuum"],["soundbar|колонк|станц","mdi:soundbar"],["tv|телевизор|hyundaitv|mitv","mdi:television"],["keenetic|роутер|router","mdi:router-wireless"],["ибп|ups|kirpich","mdi:battery-charging-high"],["slzb|координат|zigbee","mdi:zigbee"]];function dt(t,e){const i=((t||"")+" "+(e||"")).toLowerCase();for(const[t,e]of ht)if(new RegExp(t).test(i))return e;return"mdi:chip"}const pt=["light","switch","cover","valve","lock","climate","fan","media_player","camera","vacuum","humidifier","water_heater","alarm_control_panel","sensor","binary_sensor","event","button","number","select","update"];function ut(t){const e=Math.max(0,Math.min(120,(t-40)/140*120));return`hsl(${Math.round(e)}, 85%, 55%)`}function _t(t,e){return Math.round(t/e)*e}const gt=[{name:"title",selector:{text:{}}},{name:"default_floor",selector:{select:{mode:"dropdown",options:[{value:"f1",label:"1 этаж"},{value:"f2",label:"2 этаж"},{value:"yard",label:"Двор"}]}}},{name:"icon_size",selector:{number:{min:1,max:6,step:.1,mode:"box"}}},{name:"show_temperature",selector:{boolean:{}}},{name:"live_states",selector:{boolean:{}}},{name:"show_signal",selector:{boolean:{}}}],mt={title:"Заголовок",default_floor:"Этаж по умолчанию",icon_size:"Размер иконок, % ширины плана",show_temperature:"Показывать температуру",live_states:"Живые состояния (вкл/выкл, открыто…)",show_signal:"Показывать сигнал zigbee (LQI)"};class ft extends ot{setConfig(t){this._config=t}render(){return this.hass&&this._config?j`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${gt}
      .computeLabel=${t=>mt[t.name]||t.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`:B}_valueChanged(t){const e={...this._config,...t.detail.value},i=new Event("config-changed",{bubbles:!0,composed:!0});i.detail={config:e},this.dispatchEvent(i)}}ft.properties={hass:{attribute:!1},_config:{state:!0}},customElements.get("houseplan-card-editor")||customElements.define("houseplan-card-editor",ft);const vt="houseplan_card_layout_v1",bt=1e3,yt=(t,e,i)=>{const s=new Event(e,{bubbles:!0,composed:!0});s.detail=i??{},t.dispatchEvent(s)},$t=(t,e)=>{let i;return(...s)=>{clearTimeout(i),i=window.setTimeout(()=>t(...s),e)}};class xt extends ot{constructor(){super(...arguments),this._space="f1",this._edit=!1,this._layout={},this._serverStorage=!1,this._loadOk=!1,this._loading=!1,this._loadTries=0,this._serverCfg=null,this._cfgRev=0,this._unsubCfg=null,this._devices=[],this._regSignature="",this._defPos={},this._tip=null,this._selId=null,this._toast="",this._markup=!1,this._tool="draw",this._path=[],this._pathSegs=[],this._cursorPt=null,this._areaSel="",this._nameSel="",this._roomDialog=!1,this._infoCard=null,this._markerDialog=null,this._spaceDialog=null,this._keyHandler=t=>this._onKey(t),this._drag=null,this._dirtyPos=new Set,this._persistLayout=$t(()=>{if(this._serverStorage){const t=[...this._dirtyPos];this._dirtyPos.clear();for(const e of t){const t=this._layout[e];t&&this.hass.callWS({type:"houseplan/layout/update",device_id:e,pos:t}).catch(t=>this._showToast("Не удалось сохранить позицию: "+(t?.message||t)))}}else localStorage.setItem(vt,JSON.stringify(this._layout))},600),this._saveConfig=$t(()=>{this._serverCfg&&this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev}).then(t=>{this._cfgRev=t?.rev??this._cfgRev+1}).catch(t=>{"conflict"===t?.code?(this._showToast("Конфиг изменён в другом окне — данные обновлены, повторите последнее действие"),this._cancelPath(),this._reloadConfigOnly()):this._showToast("Не удалось сохранить конфиг: "+(t?.message||t))})},500)}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this._keyHandler)}disconnectedCallback(){window.removeEventListener("keydown",this._keyHandler),this._unsubCfg&&(this._unsubCfg(),this._unsubCfg=null),super.disconnectedCallback()}_onKey(t){if("Escape"===t.key){if(this._infoCard)return void(this._infoCard=null);if(this._markerDialog)return void(this._markerDialog=null)}if(!this._markup)return;return"Escape"===t.key||(t.ctrlKey||t.metaKey)&&"z"===t.key.toLowerCase()?this._roomDialog?(t.preventDefault(),void this._roomDialogCancel()):void("draw"===this._tool&&this._path.length&&(t.preventDefault(),this._undoPoint())):void 0}_undoPoint(){if(!this._path.length)return;if(1===this._path.length)return this._path=[],void(this._pathSegs=[]);const t=this._pathSegs[this._pathSegs.length-1];this._pathSegs=this._pathSegs.slice(0,-1),t&&this._removeSegmentByKey(t),this._path=this._path.slice(0,-1)}_removeSegmentByKey(t){const e=this._curSpaceCfg;if(!e?.segments)return;const i=this._segments.findIndex(e=>this._segKey([e[0],e[1]],[e[2],e[3]])===t);i>=0&&(e.segments.splice(i,1),this._saveConfig())}static getConfigElement(){return document.createElement("houseplan-card-editor")}static getStubConfig(){return{type:"custom:houseplan-card",title:"План дома"}}setConfig(t){this._config={icon_size:2.5,show_temperature:!0,live_states:!0,show_signal:!0,...t},t.default_floor&&(this._space=t.default_floor)}getCardSize(){return 12}get _norm(){return!(!this._serverCfg||!this._serverCfg.spaces.length)}get _model(){return this._serverCfg?this._serverCfg.spaces.map(t=>{const e=bt/t.aspect;return{id:t.id,title:t.title,vb:[t.view_box[0]*bt,t.view_box[1]*e,t.view_box[2]*bt,t.view_box[3]*e],bg:t.plan_url?{href:t.plan_url,x:0,y:0,w:bt,h:e}:null,rooms:t.rooms.map(t=>({id:t.id,name:t.name,area:t.area??null,x:null!=t.x?t.x*bt:void 0,y:null!=t.y?t.y*e:void 0,w:null!=t.w?t.w*bt:void 0,h:null!=t.h?t.h*e:void 0,poly:t.poly?t.poly.map(t=>[t[0]*bt,t[1]*e]):void 0}))}}):[]}_spaceModel(t){const e=this._model;return e.find(e=>e.id===(t??this._space))||e[0]}get _areaToSpace(){const t={};for(const e of this._model)for(const i of e.rooms)i.area&&(t[i.area]={space:e.id,room:i});return t}get _settings(){return this._serverCfg?.settings||{}}get _excluded(){const t=this._settings.exclude_integrations;return t?new Set(t):ct}willUpdate(t){t.has("hass")&&this.hass&&(!this._loadOk&&!this._loading&&this._loadTries<8&&this._loadFromServer(),this._maybeRebuildDevices())}async _loadFromServer(){this._loading=!0,this._loadTries++;try{const[t,e]=await Promise.all([this.hass.callWS({type:"houseplan/config/get"}),this.hass.callWS({type:"houseplan/layout/get"})]);this._loadOk=!0,this._serverStorage=!0;const i=t?.config;this._serverCfg=i&&Array.isArray(i.spaces)?i:null,this._cfgRev=t?.rev||0,this._layout=e?.layout||{},this._unsubCfg||(this._unsubCfg=await this.hass.connection.subscribeEvents(t=>{(t?.data?.rev??-1)!==this._cfgRev&&this._reloadConfigOnly()},"houseplan_config_updated")),this._norm&&!this._model.find(t=>t.id===this._space)&&(this._space=this._model[0]?.id||this._space)}catch(t){if(this._loadTries>=8){this._serverStorage=!1,this._serverCfg=null;try{this._layout=JSON.parse(localStorage.getItem(vt)||"{}")||{}}catch{this._layout={}}}}finally{this._loading=!1}this._regSignature="",this.requestUpdate()}async _reloadConfigOnly(){try{const t=await this.hass.callWS({type:"houseplan/config/get"}),e=t?.config;this._serverCfg=e&&Array.isArray(e.spaces)?e:null,this._cfgRev=t?.rev||0,this._regSignature="",this._maybeRebuildDevices(),this.requestUpdate()}catch{}}_maybeRebuildDevices(){const t=this.hass;if(!t?.devices||!t?.entities||!t?.areas)return;const e=Object.keys(t.devices).length+":"+Object.keys(t.entities).length+":"+Object.keys(t.areas).length+":"+(this._norm?"n":"l");e===this._regSignature&&this._devices.length||(this._regSignature=e,this._devices=this._buildDevices(),this._defPos=this._defaultPositions())}_entitiesByDevice(){const t={};for(const[e,i]of Object.entries(this.hass.entities))i?.device_id&&(t[i.device_id]=t[i.device_id]||[]).push(e);return t}_domainOfDevice(t,e){if(t.identifiers?.[0]?.[0])return t.identifiers[0][0];for(const t of e){const e=this.hass.entities[t]?.platform;if(e)return e}return""}_primaryEntity(t,e){const i=t.map(t=>({eid:t,reg:this.hass.entities[t],st:this.hass.states[t]})).filter(t=>t.reg&&!t.reg.hidden),s=i.filter(t=>!t.reg.entity_category),a=s.length?s:i;if("mdi:thermometer"===e||"mdi:air-filter"===e){const t=a.find(t=>this._isTempEntity(t.eid));if(t)return t.eid}for(const t of pt){const e=a.find(e=>e.eid.split(".")[0]===t);if(e)return e.eid}return a[0]?.eid}_isTempEntity(t){const e=this.hass.states[t];if(!e)return/_temperature$/.test(t);const i=e.attributes||{};return"temperature"===i.device_class||/°C|°F/.test(i.unit_of_measurement||"")||/_temperature$/.test(t)}_lqiFor(t){const e=[];for(const i of t){const t=this.hass.states[i];if(!(/_linkquality$/.test(i)||"lqi"===(t?.attributes?.unit_of_measurement||""))||!t)continue;const s=parseFloat(t.state);isNaN(s)||e.push(s)}return e.length?Math.round(e.reduce((t,e)=>t+e,0)/e.length):null}_roomLqi(t){if(!t)return null;const e=[];for(const i of this._devices){if(i.area!==t||i.virtual)continue;const s=this._lqiFor(i.entities);null!=s&&e.push(s)}return e.length?Math.round(e.reduce((t,e)=>t+e,0)/e.length):null}_tempFor(t){for(const e of t){if(!this._isTempEntity(e))continue;const t=this.hass.states[e];if(!t)continue;const i=parseFloat(t.state);if(!isNaN(i))return Math.round(10*i)/10}return null}_lightGroups(){if(!1===this._settings.group_lights)return[];const t=this.hass,e=[];for(const[i,s]of Object.entries(t.entities)){if(!i.startsWith("light.")||s.hidden)continue;let a=null;if("group"===s.platform)a=s.area_id||null;else{if(!s.device_id)continue;{const e=t.devices[s.device_id];if("Group"!==e?.model)continue;a=e.area_id||s.area_id||null}}if(!a)continue;const n=t.states[i];e.push({eid:i,name:s.name||n?.attributes?.friendly_name||i,area:a})}return e}_groupedLightAreas(){return new Set(this._lightGroups().map(t=>t.area))}get _markers(){return this._serverCfg?.markers||[]}_markerFor(t,e){return this._markers.find(i=>i.binding===t+":"+e)}get _claimed(){const t=new Set;for(const e of this._markers){const[i,s]=e.binding.split(":");"device"!==i&&"entity"!==i||!s||t.add(e.binding)}return t}_applyMarker(t,e){t.marker=e,e.name&&(t.name=e.name),e.icon&&(t.icon=e.icon),null!=e.model&&(t.model=e.model),t.link=e.link??null,t.description=e.description??null,t.pdfs=e.pdfs||[]}_buildDevices(){const t=this.hass,e=this._areaToSpace,i=!1!==this._settings.group_lights,s=this._groupedLightAreas(),a=this._excluded,n=this._entitiesByDevice(),r=this._claimed,o={},l=[];for(const c of Object.values(t.devices)){const t=c.area_id;if(!t||!e[t])continue;if("service"===c.entry_type)continue;if(r.has("device:"+c.id))continue;const h=this._markerFor("device",c.id);if(h&&h.hidden)continue;const d=n[c.id]||[],p=this._domainOfDevice(c,d);if(a.has(p))continue;if("Group"===c.model)continue;if(/scene/i.test(c.model||""))continue;if(/bridge/i.test((c.model||"")+(c.name||"")))continue;if("myheat"===p&&c.via_device_id)continue;const u=(c.name_by_user||c.name||"без имени").trim(),_=u+"|"+t;if(o[_])continue;o[_]=1;let g=dt(u,c.model);if(d.some(t=>t.startsWith("lock."))&&(g="mdi:lock"),i&&"mdi:lightbulb"===g&&s.has(t))continue;const m={id:c.id,name:u,model:c.model||"",area:t,space:e[t].space,icon:g,entities:d,bindingKind:"device",bindingRef:c.id,pdfs:[]};m.primary=this._primaryEntity(d,g),"mdi:thermometer"!==g&&"mdi:air-filter"!==g||(m.temp=this._tempFor(d)),l.push(m)}for(const t of this._lightGroups())e[t.area]&&(r.has("entity:"+t.eid)||l.push({id:"lg_"+t.eid,name:t.name,model:"группа света",area:t.area,space:e[t.area].space,icon:"mdi:lightbulb-group",entities:[t.eid],primary:t.eid,bindingKind:"entity",bindingRef:t.eid,pdfs:[]}));for(const i of this._markers){if(i.hidden)continue;const[s,a]=i.binding.split(":");if("device"===s){const s=t.devices[a],r=i.area||s?.area_id||"",o=r&&e[r]?.space||i.space||this._model[0]?.id||"",c=s&&n[s.id]||[];let h=s?dt(s.name_by_user||s.name||"",s.model):"mdi:help-circle";c.some(t=>t.startsWith("lock."))&&(h="mdi:lock");const d={id:i.id,name:s?.name_by_user||s?.name||"устройство",model:s?.model||"",area:r,space:o,icon:h,entities:c,bindingKind:"device",bindingRef:a};d.primary=this._primaryEntity(c,h),"mdi:thermometer"!==h&&"mdi:air-filter"!==h||(d.temp=this._tempFor(c)),this._applyMarker(d,i),l.push(d)}else if("entity"===s){const s=t.entities[a],n=i.area||s?.area_id||s?.device_id&&t.devices[s.device_id]?.area_id||"",r=n&&e[n]?.space||i.space||this._model[0]?.id||"",o=t.states[a],c={id:i.id,name:s?.name||o?.attributes?.friendly_name||a,model:"",area:n,space:r,icon:"mdi:shape-outline",entities:[a],primary:a,bindingKind:"entity",bindingRef:a};this._applyMarker(c,i),l.push(c)}else{const t=i.area||"",s=i.space||t&&e[t]?.space||this._model[0]?.id||"",a={id:i.id,name:i.name||"виртуальное устройство",model:i.model||"",area:t,space:s,icon:i.icon||"mdi:map-marker",entities:[],bindingKind:"virtual",virtual:!0};this._applyMarker(a,i),l.push(a)}}return l}_roomBounds(t){if(t.poly&&t.poly.length){const e=t.poly.map(t=>t[0]),i=t.poly.map(t=>t[1]),s=Math.min(...e),a=Math.min(...i);return{x:s,y:a,w:Math.max(...e)-s,h:Math.max(...i)-a}}return{x:t.x??0,y:t.y??0,w:t.w??0,h:t.h??0}}_defaultPositions(){const t={};for(const e of this._model)for(const i of e.rooms){if(!i.area)continue;const s=this._devices.filter(t=>t.area===i.area&&t.space===e.id);if(!s.length)continue;const a=this._roomBounds(i),n=.12*Math.min(a.w,a.h),r=a.w-2*n,o=a.h-2*n,l=Math.max(1,Math.round(Math.sqrt(s.length*r/Math.max(o,1)))),c=Math.ceil(s.length/l),h=r/l,d=o/Math.max(c,1);s.forEach((e,i)=>{const s=i%l,r=Math.floor(i/l);t[e.id]={x:a.x+n+h*(s+.5),y:a.y+n+d*(r+.5)}})}return t}_pos(t){const e=this._spaceModel(t.space),i=this._layout[t.id];if(i)if(this._norm){if(i.s===t.space){const e=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;return{x:i.x*bt,y:i.y*(bt/e)}}}else if(void 0===i.s)return{x:i.x,y:i.y};if(this._defPos[t.id])return this._defPos[t.id];const s=e.vb;return{x:s[0]+s[2]/2,y:s[1]+s[3]/2}}_savePos(t,e,i){if(this._norm){const s=this._gridPitch,a=Math.round(e/s)*s,n=Math.round(i/s)*s,r=this._serverCfg.spaces.find(e=>e.id===t.space)?.aspect||1;this._layout={...this._layout,[t.id]:{s:t.space,x:a/bt,y:n/(bt/r)}}}else this._layout={...this._layout,[t.id]:{x:Math.round(e),y:Math.round(i)}};this._dirtyPos.add(t.id),this._persistLayout()}_stateClass(t){if(!this._config?.live_states)return"";const e=t.primary?this.hass.states[t.primary]:void 0;if(!e)return"";if("unavailable"===e.state)return"unavail";const i=e.entity_id.split(".")[0];if(["light","switch","fan","humidifier"].includes(i))return"on"===e.state?"on":"";if("cover"===i||"valve"===i)return["open","opening"].includes(e.state)?"open":"";if("lock"===i)return["unlocked","open"].includes(e.state)?"open":"";if("binary_sensor"===i){const t=e.attributes?.device_class;if(["door","window","garage_door","opening","gas","smoke","moisture","problem"].includes(t))return"on"===e.state?"open":""}return"media_player"===i?["playing","on"].includes(e.state)?"on":"":"vacuum"===i&&["cleaning","returning"].includes(e.state)?"on":""}_liveTemp(t){return this._config?.show_temperature?"mdi:thermometer"!==t.icon&&"mdi:air-filter"!==t.icon?null:this._tempFor(t.entities):null}_openMoreInfo(t){t?yt(this,"hass-more-info",{entityId:t}):this._showToast("У устройства нет подходящей сущности")}_clickDevice(t,e){if(t.stopPropagation(),!this._drag?.moved&&!this._markup)return this._edit?(this._selId=e.id,void this._openMarkerDialog(e)):void(this._infoCard=e)}_clickRoom(t){var e;!this._edit&&t.area&&(e="/config/areas/area/"+t.area,history.pushState(null,"",e),yt(window,"location-changed",{replace:!1}))}_pointerDown(t,e){if(!this._edit)return;t.preventDefault();const i=this._pos(e);this._drag={id:e.id,sx:t.clientX,sy:t.clientY,ox:i.x,oy:i.y,moved:!1},t.target.setPointerCapture(t.pointerId),this._tip=null}_pointerMove(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this.renderRoot.querySelector(".stage");if(!i)return;const s=this._spaceModel().vb,a=i.getBoundingClientRect(),n=(t.clientX-this._drag.sx)/a.width*s[2],r=(t.clientY-this._drag.sy)/a.height*s[3];Math.abs(t.clientX-this._drag.sx)+Math.abs(t.clientY-this._drag.sy)>3&&(this._drag.moved=!0);const o=.008*Math.min(s[2],s[3]),l=Math.max(s[0]+o,Math.min(s[0]+s[2]-o,this._drag.ox+n)),c=Math.max(s[1]+o,Math.min(s[1]+s[3]-o,this._drag.oy+r));this._savePos(e,l,c)}_pointerUp(t,e){if(!this._drag||this._drag.id!==e.id)return;const i=this._drag.moved;this._drag=i?this._drag:null,i&&(this._selId=e.id,window.setTimeout(()=>this._drag=null,0))}_applyXY(t,e){if(!this._selId)return;const i=parseFloat(e);if(isNaN(i))return;const s=this._devices.find(t=>t.id===this._selId);if(!s||s.virtual)return;const a={...this._pos(s)};a[t]=i,this._savePos(s,a.x,a.y)}_resetLayout(){confirm("Сбросить позиции всех иконок к авто-раскладке?")&&(this._layout={},this._persistLayout())}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=""},3500)}_showTip(t,e,i,s){this._drag||(this._tip={x:t.clientX,y:t.clientY,title:e,meta:i,lqi:s})}get _gridPitch(){return bt/120}get _curSpaceCfg(){return this._serverCfg?.spaces.find(t=>t.id===this._space)}get _spaceH(){const t=this._curSpaceCfg;return t?bt/t.aspect:bt}get _segments(){const t=this._curSpaceCfg,e=this._spaceH;return(t?.segments||[]).map(t=>[t[0]*bt,t[1]*e,t[2]*bt,t[3]*e])}_toggleMarkup(){this._norm?(this._markup=!this._markup,this._edit=!1,this._path=[],this._cursorPt=null,this._tool="draw"):this._showToast("Разметка доступна после переноса конфига на сервер (режим правки → «На сервер»)")}_svgPoint(t){const e=this.renderRoot.querySelector(".stage"),i=this._spaceModel().vb,s=e.getBoundingClientRect();return[i[0]+(t.clientX-s.left)/s.width*i[2],i[1]+(t.clientY-s.top)/s.height*i[3]]}_snap(t){const e=this._gridPitch;return[_t(t[0],e),_t(t[1],e)]}_samePt(t,e){return function(t,e,i=.001){return Math.abs(t[0]-e[0])<i&&Math.abs(t[1]-e[1])<i}(t,e)}_segKey(t,e){return function(t,e){const[i,s]=t[0]<e[0]||t[0]===e[0]&&t[1]<=e[1]?[t,e]:[e,t];return`${i[0].toFixed(1)},${i[1].toFixed(1)}-${s[0].toFixed(1)},${s[1].toFixed(1)}`}(t,e)}_addSegment(t,e){const i=this._curSpaceCfg;if(!i)return!1;const s=this._spaceH,a=this._segKey(t,e),n=this._segments.some(t=>this._segKey([t[0],t[1]],[t[2],t[3]])===a);return!n&&(i.segments=i.segments||[],i.segments.push([t[0]/bt,t[1]/s,e[0]/bt,e[1]/s]),this._saveConfig(),!0)}_distToSeg(t,e){const[i,s]=t,[a,n,r,o]=e,l=r-a,c=o-n;let h=((i-a)*l+(s-n)*c)/(l*l+c*c||1);h=Math.max(0,Math.min(1,h));const d=a+h*l,p=n+h*c;return Math.hypot(i-d,s-p)}_pointInRoom(t,e){return e.poly?function(t,e){let i=!1;for(let s=0,a=e.length-1;s<e.length;a=s++){const[n,r]=e[s],[o,l]=e[a];r>t[1]!=l>t[1]&&t[0]<(o-n)*(t[1]-r)/(l-r)+n&&(i=!i)}return i}(t,e.poly):null!=e.x&&t[0]>=e.x&&t[0]<=e.x+e.w&&t[1]>=e.y&&t[1]<=e.y+e.h}_markupClick(t){if(!this._markup)return;const e=this._svgPoint(t);if("erase"===this._tool){const t=this._curSpaceCfg;if(!t?.segments?.length)return;const i=this._segments;let s=-1,a=.5*this._gridPitch;return i.forEach((t,i)=>{const n=this._distToSeg(e,t);n<a&&(a=n,s=i)}),void(s>=0&&(t.segments.splice(s,1),this._saveConfig(),this.requestUpdate()))}if("delroom"===this._tool){const t=[...this._spaceModel().rooms].reverse().find(t=>this._pointInRoom(e,t));if(!t)return;if(!confirm(`Удалить комнату «${t.name}»?`))return;const i=this._curSpaceCfg;return i.rooms=i.rooms.filter(e=>e.id!==t.id),this._saveConfig(),this._regSignature="",this._maybeRebuildDevices(),void this.requestUpdate()}const i=this._snap(e);if(!this._path.length)return this._path=[i],void(this._pathSegs=[]);const s=this._path[this._path.length-1];if(this._samePt(i,s))return;const a=this._addSegment(s,i);this._pathSegs=[...this._pathSegs,a?this._segKey(s,i):null],this._path=[...this._path,i],this._path.length>=4&&this._samePt(i,this._path[0])&&(this._cursorPt=null,this._nameSel="",this._areaSel="",this._roomDialog=!0)}get _contourClosed(){return this._path.length>=4&&this._samePt(this._path[0],this._path[this._path.length-1])}_markupMove(t){this._markup&&"draw"===this._tool&&this._path.length&&!this._contourClosed&&(this._cursorPt=this._snap(this._svgPoint(t)))}_saveRoom(){if(!this._contourClosed||!this._areaSel&&!this._nameSel)return;const t=this._curSpaceCfg;if(!t)return;const e=this._spaceH,i=this._path.slice(0,-1),s=this._areaSel?this.hass.areas[this._areaSel]?.name:"";t.rooms.push({id:"r"+Date.now().toString(36),name:this._nameSel||s||"Комната",area:this._areaSel||null,poly:i.map(t=>[t[0]/bt,t[1]/e])}),this._saveConfig(),this._path=[],this._pathSegs=[],this._areaSel="",this._nameSel="",this._roomDialog=!1,this._regSignature="",this._maybeRebuildDevices(),this._showToast("Комната сохранена")}_cancelPath(){this._path=[],this._pathSegs=[],this._cursorPt=null,this._roomDialog=!1}_roomDialogCancel(){this._roomDialog=!1,this._undoPoint()}get _freeAreas(){const t=new Set;for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.add(i.area);return Object.values(this.hass?.areas||{}).filter(e=>!t.has(e.area_id)).sort((t,e)=>(t.name||"").localeCompare(e.name||""))}_openMarkerDialog(t){this._norm?this._markerDialog=t?{devId:t.id,name:t.name,binding:"virtual"===t.bindingKind?"virtual":t.bindingKind+":"+t.bindingRef,bindingFilter:"",icon:t.marker?.icon||"",model:t.model||"",link:t.link||"",description:t.description||"",pdfs:[...t.pdfs||[]],room:t.space&&t.area?t.space+"#"+t.area:"",busy:!1}:{name:"",binding:"virtual",bindingFilter:"",icon:"",model:"",link:"",description:"",pdfs:[],room:"",busy:!1}:this._showToast("Редактирование устройств доступно после переноса конфига на сервер")}_bindingCandidates(){const t=this.hass,e=new Set;for(const t of this._devices)t.id!==this._markerDialog?.devId&&("device"===t.bindingKind&&t.bindingRef&&e.add("device:"+t.bindingRef),"entity"===t.bindingKind&&t.bindingRef&&e.add("entity:"+t.bindingRef));const i=new Set;for(const t of this._devices)"device"===t.bindingKind&&t.name&&i.add(t.name.trim()+"|"+(t.area||""));const s=[];for(const a of Object.values(t.devices)){if("service"===a.entry_type)continue;const t="device:"+a.id;if(e.has(t))continue;const n=(a.name_by_user||a.name||a.id).trim();t!==this._markerDialog?.binding&&i.has(n+"|"+(a.area_id||""))||s.push({value:t,label:n,sub:(a.model||"устройство")+("Group"===a.model?" · Z2M-группа":"")})}const a=new Set(["group","template","derivative","min_max","threshold","integration","statistics","trend","utility_meter","tod","switch_as_x","schedule"]);for(const[i,n]of Object.entries(t.entities)){const r="entity:"+i;if(e.has(r))continue;const o=a.has(n.platform),l="group"===n.platform;if(!o&&!l)continue;if(n.hidden)continue;const c=t.states[i];s.push({value:r,label:n.name||c?.attributes?.friendly_name||i,sub:i.split(".")[0]+" · "+("group"===n.platform?"группа":"хелпер")})}const n=(this._markerDialog?.bindingFilter||"").toLowerCase().trim(),r=n?s.filter(t=>(t.label+" "+t.sub+" "+t.value).toLowerCase().includes(n)):s;return r.sort((t,e)=>t.label.localeCompare(e.label)),r.slice(0,200)}_allRoomsFlat(){const t=[];for(const e of this._serverCfg?.spaces||[])for(const i of e.rooms||[])i.area&&t.push({value:e.id+"#"+i.area,label:(e.title||e.id)+" · "+i.name});return t}_errText(t){if(!t)return"неизвестная ошибка";if("string"==typeof t)return t;if(t.message)return t.message;if(t.error)return t.error;if(null!=t.code)return"код "+t.code;try{return JSON.stringify(t)}catch{return String(t)}}async _pickMarkerFiles(t){const e=t.target,i=e.files?[...e.files]:[];if(e.value="",!i.length||!this._markerDialog)return;const s=this._markerDialog.devId||"new",a=this.hass?.auth?.data?.access_token,n=[];for(const t of i)try{const e=new FormData;e.append("marker_id",s),e.append("file",t,t.name);const i=await fetch("/api/houseplan/upload",{method:"POST",body:e,headers:a?{authorization:`Bearer ${a}`}:{}}),r=await i.json().catch(()=>({}));if(!i.ok||r.error){const t={too_large:"файл больше "+(r.max_mb||25)+" МБ",bad_ext:"недопустимый тип (нужен PDF/изображение)",unauthorized:"нужны права администратора"};throw new Error(t[r.error]||r.error||"HTTP "+i.status)}n.push({name:r.name||t.name,url:r.url})}catch(e){this._showToast("Файл «"+t.name+"» не загружен: "+this._errText(e))}n.length&&this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:[...this._markerDialog.pdfs,...n]},this._showToast("Прикреплено файлов: "+n.length))}_removeMarkerPdf(t){this._markerDialog&&(this._markerDialog={...this._markerDialog,pdfs:this._markerDialog.pdfs.filter(e=>e.url!==t)})}async _saveMarker(){const t=this._markerDialog;if(t&&!t.busy)if("virtual"!==t.binding||t.name.trim()){this._markerDialog={...t,busy:!0};try{const e=this._serverCfg;let i;e.markers=e.markers||[];const[s,a]=t.room?t.room.split("#"):["",""];let n=s||null,r=a||null;"virtual"!==t.binding||n||(n=this._space),i=function(t,e,i){const[s,a]=t.split(":");return"device"===s?a:"entity"===s?"lg_"+a:e&&e.startsWith("v_")?e:i()}(t.binding,t.devId,()=>"v_"+Date.now().toString(36));const o=t.devId,l={id:i,binding:t.binding,name:t.name.trim()||null,icon:t.icon||null,model:t.model.trim()||null,link:t.link.trim()||null,description:t.description.trim()||null,pdfs:t.pdfs};("virtual"===t.binding||t.room)&&(l.space=n,l.area=r);const c=o?this._devices.find(t=>t.id===o):null,h=!!t.room&&null!=c&&(c.space!==n||c.area!==r);if(e.markers=e.markers.filter(t=>t.id!==i&&t.id!==o),e.markers.push(l),!this._layout[i]||h){const t=this._spaceModel(n||void 0);let e=t.vb[0]+t.vb[2]/2,s=t.vb[1]+t.vb[3]/2;if(r){const i=t.rooms.find(t=>t.area===r);i&&([e,s]=this._roomCenter(i))}this._layout[i]=this._normPos(n||this._space,e,s)}await this._saveConfigNow(),await this.hass.callWS({type:"houseplan/layout/set",layout:this._layout}),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast("Устройство сохранено")}catch(t){this._markerDialog={...this._markerDialog,busy:!1},this._showToast("Ошибка: "+(t?.message||t))}}else this._showToast("Укажите имя виртуального устройства")}async _deleteMarker(){const t=this._markerDialog;if(!t)return;const e=t.devId?this._devices.find(e=>e.id===t.devId):null,i=t.name||"устройство";if(!confirm(`Убрать «${i}» с плана?`))return;const s=this._serverCfg;s.markers=s.markers||[],e&&"virtual"===e.bindingKind?s.markers=s.markers.filter(t=>t.id!==e.id):e&&e.marker?(s.markers=s.markers.filter(t=>t.id!==e.id),"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0})):e&&"device"===e.bindingKind&&e.bindingRef?s.markers.push({id:e.id,binding:"device:"+e.bindingRef,hidden:!0}):e&&"entity"===e.bindingKind&&e.bindingRef&&s.markers.push({id:e.id,binding:"entity:"+e.bindingRef,hidden:!0});try{await this._saveConfigNow(),this._markerDialog=null,this._regSignature="",this._maybeRebuildDevices(),this._showToast("Устройство убрано с плана")}catch(t){this._showToast("Ошибка: "+(t?.message||t))}}_normPos(t,e,i){const s=this._serverCfg.spaces.find(e=>e.id===t)?.aspect||1;return{s:t,x:e/bt,y:i/(bt/s)}}_openSpaceDialog(t,e){if(this._serverStorage&&this._serverCfg)if("edit"===t){const i=this._serverCfg.spaces.find(t=>t.id===e);if(!i)return;this._spaceDialog={mode:t,spaceId:e,title:i.title,planUrl:i.plan_url||null,planFile:null,busy:!1}}else this._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,busy:!1};else this._showToast("Интеграция House Plan не установлена — управление недоступно")}async _pickPlanFile(t){const e=t.target,i=e.files?.[0];if(!i||!this._spaceDialog)return;const s={"image/svg+xml":"svg","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[i.type]||(i.name.toLowerCase().endsWith(".svg")?"svg":"");if(!s)return void this._showToast("Поддерживаются SVG, PNG, JPG, WebP");const a=new Uint8Array(await i.arrayBuffer());let n="";for(let t=0;t<a.length;t+=32768)n+=String.fromCharCode(...a.subarray(t,t+32768));const r=btoa(n),o=URL.createObjectURL(i),l=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:1.414),e.onerror=()=>t(1.414),e.src=o});URL.revokeObjectURL(o),this._spaceDialog={...this._spaceDialog,planFile:{ext:s,b64:r,aspect:l,name:i.name}}}async _saveSpaceDialog(){const t=this._spaceDialog;if(t&&!t.busy&&t.title.trim()){this._spaceDialog={...t,busy:!0};try{const e=this._serverCfg;let i;if("create"===t.mode?(i={id:"s"+Date.now().toString(36),title:t.title.trim(),plan_url:null,aspect:1.414,view_box:[0,0,1,1],rooms:[],segments:[]},e.spaces.push(i)):(i=e.spaces.find(e=>e.id===t.spaceId),i.title=t.title.trim()),t.planFile){const e=await this.hass.callWS({type:"houseplan/plan/set",space_id:i.id,ext:t.planFile.ext,data:t.planFile.b64});i.plan_url=e.url,i.aspect=t.planFile.aspect}await this._saveConfigNow(),this._spaceDialog=null,"create"===t.mode&&(this._space=i.id),this._regSignature="",this._maybeRebuildDevices(),this._showToast("create"===t.mode?"Пространство добавлено":"Пространство сохранено")}catch(t){this._spaceDialog={...this._spaceDialog,busy:!1},this._showToast("Ошибка: "+(t?.message||t))}}}async _deleteSpace(){const t=this._spaceDialog;if(!t||"edit"!==t.mode)return;const e=this._serverCfg.spaces.find(e=>e.id===t.spaceId);if(confirm(`Удалить пространство «${e.title}» со всеми комнатами и разметкой?`)){this._serverCfg.spaces=this._serverCfg.spaces.filter(e=>e.id!==t.spaceId);try{await this._saveConfigNow(),this._spaceDialog=null,this._space===t.spaceId&&(this._space=this._serverCfg.spaces[0]?.id||""),this._regSignature="",this._maybeRebuildDevices(),this._showToast("Пространство удалено")}catch(t){this._showToast("Ошибка удаления: "+(t?.message||t))}}}async _saveConfigNow(){const t=await this.hass.callWS({type:"houseplan/config/set",config:this._serverCfg,expected_rev:this._cfgRev});this._cfgRev=t?.rev??this._cfgRev+1}render(){if(!this._config||!this.hass)return B;const t=this._model;if(!t.length)return j`<ha-card>
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
      </ha-card>`;const e=this._spaceModel(),i=e.vb,s=this._devices.filter(t=>t.space===e.id),a=this._config.icon_size??2.5,n=a>8?2.5:a;return j`
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
                @click=${()=>{this._space=t.id,this._selId=null}}
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
          ${this._norm?j`<button class="btn" @click=${()=>this._openMarkerDialog()}
                title="Добавить устройство на план">
                <ha-icon icon="mdi:plus"></ha-icon>
              </button>`:B}
          <button class="btn ${this._edit?"on":""}" @click=${()=>{this._edit=!this._edit,this._markup=!1,this._selId=null}} title="Режим правки: клик по значку — карточка, перетаскивание — двигать">
            <ha-icon icon="mdi:cursor-move"></ha-icon>
          </button>
          <button class="btn ${this._markup?"on":""}" @click=${this._toggleMarkup}
            title="Разметка комнат: сетка, линии, контуры">
            <ha-icon icon="mdi:vector-square-edit"></ha-icon>
          </button>
        </div>
        ${this._edit?this._renderEditbar():B}
        ${this._markup?this._renderMarkupBar():B}
        </div>

        <div class="stage ${this._edit?"edit":""} ${this._markup?"markup":""}"
          style="aspect-ratio:${i[2]}/${i[3]}"
          @click=${t=>this._markupClick(t)}
          @mousemove=${t=>this._markupMove(t)}>
          <svg viewBox="${i.join(" ")}" preserveAspectRatio="xMidYMid meet">
            ${this._markup?this._renderMarkupDefs(i):B}
            ${e.bg?L`<image href="${e.bg.href}" x="${e.bg.x}" y="${e.bg.y}" width="${e.bg.w}" height="${e.bg.h}" preserveAspectRatio="none" />`:B}
            ${e.rooms.filter(t=>t.area||this._markup).map(t=>{const i="room "+(e.bg?"overlay":"yard")+(this._markup?" outlined":""),s=e=>this._showTip(e,t.name,"комната — открыть зону",this._config?.show_signal?this._roomLqi(t.area):null),a=!e.bg||this._markup,n=this._roomCenter(t),r=t.poly?L`<polygon class="${i}" points="${t.poly.map(t=>t.join(",")).join(" ")}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${s}
                    @mouseleave=${()=>this._tip=null}></polygon>`:L`<rect class="${i}"
                    x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${.03*Math.min(t.w,t.h)}"
                    @click=${()=>this._clickRoom(t)} @mousemove=${s}
                    @mouseleave=${()=>this._tip=null}></rect>`;return L`${r}${a?L`<text class="rlabel" x="${n[0]}" y="${n[1]}">${t.name}</text>`:B}`})}
            ${this._markup?this._renderMarkupLayer(i):B}
          </svg>
          <div class="devlayer" style="--icon-size:${n}cqw">
            ${s.map(t=>this._renderDevice(t,i))}
          </div>
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
    `}_renderDevice(t,e){const i=this._pos(t),s=(i.x-e[0])/e[2]*100,a=(i.y-e[1])/e[3]*100,n=this._stateClass(t),r=this._liveTemp(t),o=this._config?.show_signal&&!t.virtual?this._lqiFor(t.entities):null;return j`<div
      class="dev ${n} ${this._selId===t.id?"sel":""} ${t.virtual?"virtual":""}"
      style="left:${s}%;top:${a}%"
      @click=${e=>this._clickDevice(e,t)}
      @mousemove=${e=>this._showTip(e,t.name,t.model+(null!=r?" · "+r+"°":"")+(null!=o?" · LQI "+o:""))}
      @mouseleave=${()=>this._tip=null}
      @pointerdown=${e=>this._pointerDown(e,t)}
      @pointermove=${e=>this._pointerMove(e,t)}
      @pointerup=${e=>this._pointerUp(e,t)}
    >
      <ha-icon icon="${t.icon}"></ha-icon>
      ${null!=r?j`<span class="tval">${r}°</span>`:B}
      ${null!=o?j`<span class="lqi" style="color:${ut(o)}">${o}</span>`:B}
    </div>`}_roomCenter(t){if(t.poly){const e=t.poly.length;return[t.poly.reduce((t,e)=>t+e[0],0)/e,t.poly.reduce((t,e)=>t+e[1],0)/e]}return[t.x+t.w/2,t.y+.1*Math.min(t.w,t.h)]}_renderMarkupDefs(t){const e=this._gridPitch,i=.14*e;return L`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${e}" height="${e}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="0" r="${i}" class="griddot"></circle>
          <circle cx="0" cy="${e}" r="${i}" class="griddot"></circle>
          <circle cx="${e}" cy="${e}" r="${i}" class="griddot"></circle>
        </pattern>
      </defs>`}_renderMarkupLayer(t){const e=this._segments,i=this._path,s=this._gridPitch;return L`
      <rect x="${t[0]}" y="${t[1]}" width="${t[2]}" height="${t[3]}" fill="url(#hp-grid)" pointer-events="none"></rect>
      ${e.map(t=>L`<line class="seg" x1="${t[0]}" y1="${t[1]}" x2="${t[2]}" y2="${t[3]}"></line>`)}
      ${i.length>1?L`<polyline class="pathline" points="${i.map(t=>t.join(",")).join(" ")}"></polyline>`:B}
      ${i.length&&this._cursorPt&&"draw"===this._tool&&!this._contourClosed?L`<line class="preview" x1="${i[i.length-1][0]}" y1="${i[i.length-1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`:B}
      ${i.map((t,e)=>L`<circle class="vertex ${0===e?"first":""}" cx="${t[0]}" cy="${t[1]}" r="${.22*s}"></circle>`)}
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
          ${t.link?j`<div class="inforow"><span class="k">Ссылка</span>
                <a href="${t.link}" target="_blank" rel="noreferrer noopener">${t.link}</a></div>`:B}
          ${t.description?j`<div class="infodesc">${t.description}</div>`:B}
          ${t.pdfs&&t.pdfs.length?j`<div class="inforow"><span class="k">Инструкции</span><span class="pdflist">
                ${t.pdfs.map(t=>j`<a class="pdf" href="${t.url}" target="_blank" rel="noreferrer noopener">
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
    </div>`}_renderMarkerDialog(){const t=this._markerDialog,e="virtual"===t.binding,i=this._bindingCandidates(),s=(()=>{if(e)return null;const s=i.find(e=>e.value===t.binding);if(s)return s.label;const[a,n]=t.binding.split(":");return"device"===a?this.hass.devices[n]?.name_by_user||this.hass.devices[n]?.name||n:this.hass.states[n]?.attributes?.friendly_name||n})();return j`<div class="menuwrap dialogwrap" @click=${t=>t.stopPropagation()}>
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
                <a href="${t.url}" target="_blank" rel="noreferrer noopener">${t.name}</a>
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
          <button class="btn on" @click=${this._saveSpaceDialog} ?disabled=${!t.title.trim()||t.busy}>
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
          <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel&&!this._nameSel}>
            <ha-icon icon="mdi:check"></ha-icon>Сохранить
          </button>
        </div>
      </div>
    </div>`}_renderEditbar(){const t=this._selId?this._devices.find(t=>t.id===this._selId):null,e=t?this._pos(t):null;return j`<div class="editbar">
      <ha-icon icon="mdi:cursor-move" class="warn"></ha-icon>
      <span class="sname">${t?t.name:"Режим правки — тащите иконки мышью"}</span>
      ${t&&e?j`<label>X</label><input type="number" .value=${String(Math.round(e.x))}
              @change=${t=>this._applyXY("x",t.target.value)} />
            <label>Y</label><input type="number" .value=${String(Math.round(e.y))}
              @change=${t=>this._applyXY("y",t.target.value)} />`:B}
      <span class="spacer"></span>
      <span class="hint">
        ${this._serverStorage?this._norm?"конфиг и раскладка: сервер":"раскладка: сервер · конфиг: встроенный":"сохранение: этот браузер"}
      </span>
      <button class="btn ghost" @click=${this._resetLayout} title="Сбросить всё">
        <ha-icon icon="mdi:backup-restore"></ha-icon>
      </button>
    </div>`}}xt.properties={hass:{attribute:!1},_config:{state:!0},_space:{state:!0},_edit:{state:!0},_layout:{state:!0},_devices:{state:!0},_tip:{state:!0},_selId:{state:!0},_toast:{state:!0},_serverCfg:{state:!0},_markup:{state:!0},_tool:{state:!0},_path:{state:!0},_cursorPt:{state:!0},_areaSel:{state:!0},_nameSel:{state:!0},_roomDialog:{state:!0},_spaceDialog:{state:!0},_infoCard:{state:!0},_markerDialog:{state:!0}},xt.styles=((t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new a(s,t,i)})`
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
      cursor: pointer;
      pointer-events: auto;
      transition: background 0.15s, border-color 0.15s, opacity 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      z-index: 2;
    }
    .dev ha-icon {
      --mdc-icon-size: calc(var(--icon-size, 2.5cqw) * 0.62);
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
    .stage.edit .dev {
      cursor: grab;
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
  `,customElements.get("houseplan-card")||customElements.define("houseplan-card",xt),window.customCards=window.customCards||[],window.customCards.find(t=>"houseplan-card"===t.type)||window.customCards.push({type:"houseplan-card",name:"House Plan Card",description:"Интерактивный план дома: пространства, комнаты, устройства с живыми состояниями и drag-раскладкой."}),console.info("%c HOUSEPLAN-CARD %c v1.7.4 ","background:#3ea6ff;color:#04121f;font-weight:700","");
