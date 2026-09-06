globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="6aa7e85aead059c4d286b3b943bfaf6a4b128ecf5e0a3be2860b34e0069d829a";import{t as e,l as t,A as i,dR as r,w as o,b as s,q as n}from"./houseplan-card-DPsHeJqW.js";import{t as a,a as h,r as d}from"./zigbee-topology-5lWJidfb.js";import{zigbeeTopologyRuntimeSnapshot as p,subscribeZigbeeTopology as l}from"./zigbee-topology-runtime-D_luJHXO.js";function c(e,t,i,r,o,s=9,n=4.5){const a=t.x-e.x,h=t.y-e.y,d=Math.hypot(a,h),p=d-Math.max(0,i)-Math.max(0,r);if(!Number.isFinite(d)||d<=0||p<4)return null;const l=a/d,c=h/d,_="toward-neighbor"===o,u=_?{x:t.x-l*Math.max(0,r),y:t.y-c*Math.max(0,r)}:{x:e.x+l*Math.max(0,i),y:e.y+c*Math.max(0,i)},b=Math.min(s,Math.max(4,.45*p)),m=Math.min(n,.5*b),v=_?-1:1,g=u.x+l*b*v,y=u.y+c*b*v,x=-c;return{tip:u,points:[u,{x:g+x*m,y:y+l*m},{x:g-x*m,y:y-l*m}]}}const _={revision:0,topologies:[],states:{}},u="data-hp-zigbee-topology-endpoint";class b extends e{constructor(){super(...arguments),this.devices=[],this.currentSpace="",this._runtime=_,this._hovered="",this._desiredEndpointIds=new Set,this._endpointSetDirty=!1,this._endpointElements=new Set,this._pointerOver=e=>{if(!this._mouseAllowed(e))return void this._clear();const t=this._deviceFromEvent(e),i=t?.dataset.id||"";i&&i!==this._hovered&&(this._hovered=i,this.requestUpdate())},this._pointerOut=e=>{const t=this._deviceFromEvent(e);if(!t||t.dataset.id!==this._hovered)return;const i=e.relatedTarget instanceof Element?e.relatedTarget.closest('[data-hp="device"]'):null;i?.dataset.id!==this._hovered&&this._clear()},this._pointerDown=e=>{"mouse"!==e.pointerType&&this._clear()}}connectedCallback(){super.connectedCallback();const e=this.getRootNode();e.host&&"undefined"!=typeof MutationObserver&&(this._hoverGateObserver=new MutationObserver(()=>{e.host.hasAttribute("data-pointer-hover")||this._clear()}),this._hoverGateObserver.observe(e.host,{attributes:!0,attributeFilter:["data-pointer-hover"]})),queueMicrotask(()=>this._connectParent())}disconnectedCallback(){this._release?.(),this._release=void 0,this._disconnectParent(),this._hoverGateObserver?.disconnect(),this._hoverGateObserver=void 0,this._hovered="",this._desiredEndpointIds.clear(),super.disconnectedCallback()}updated(e){e.has("hass")&&(this._release?.(),this._acceptRuntime(p(this.hass)),this._release=l(this.hass,()=>{this._acceptRuntime(p(this.hass))}));const t=e.has("currentSpace")||e.has("devices")||e.has("registry");t&&(this._mappedMemo=void 0,this.devices.some(e=>e.id===this._hovered&&e.space===this.currentSpace)||this._clear()),this._connectParent(),(this._endpointSetDirty||t)&&this._syncEndpointOwnership()}_acceptRuntime(e){e.revision===this._runtime.revision&&e.topologies===this._runtime.topologies&&e.states===this._runtime.states||(this._setDesiredEndpointIds([]),this._clearEndpointOwnership(),this._endpointSetDirty=!1,this._runtime=e,this._mappedMemo=void 0,this.requestUpdate())}_connectParent(){const e=this.parentElement;e&&e!==this._parent&&(this._disconnectParent(),this._parent=e,e.addEventListener("pointerover",this._pointerOver),e.addEventListener("pointerout",this._pointerOut),e.addEventListener("pointerdown",this._pointerDown,!0),"undefined"!=typeof MutationObserver&&(this._markerObserver=new MutationObserver(()=>this._syncEndpointOwnership()),this._markerObserver.observe(e,{childList:!0})),this._syncEndpointOwnership())}_disconnectParent(){this._parent?.removeEventListener("pointerover",this._pointerOver),this._parent?.removeEventListener("pointerout",this._pointerOut),this._parent?.removeEventListener("pointerdown",this._pointerDown,!0),this._markerObserver?.disconnect(),this._markerObserver=void 0,this._clearEndpointOwnership(),this._parent=void 0}_deviceFromEvent(e){for(const t of e.composedPath())if(t instanceof HTMLElement&&"device"===t.dataset.hp)return t;return null}_mouseAllowed(e){const t=this.getRootNode();return"mouse"===e.pointerType&&t.host?.hasAttribute?.("data-pointer-hover")}_clear(){this._setDesiredEndpointIds([]),this._clearEndpointOwnership(),this._endpointSetDirty=!1,this._hovered&&(this._hovered="",this.requestUpdate())}_setDesiredEndpointIds(e){const t=new Set(e);t.size===this._desiredEndpointIds.size&&[...t].every(e=>this._desiredEndpointIds.has(e))||(this._desiredEndpointIds=t,this._endpointSetDirty=!0)}_marker(e){return[...this._parent?.querySelectorAll('.dev[data-hp="device"][data-id]')||[]].find(t=>t.dataset.id===e)||null}_clearEndpointOwnership(){for(const e of this._endpointElements)e.removeAttribute(u);for(const e of this._parent?.querySelectorAll(`[${u}]`)||[])e.removeAttribute(u);this._endpointElements.clear()}_syncEndpointOwnership(){const e=new Set;for(const t of this._desiredEndpointIds){const i=this._marker(t);i&&e.add(i)}for(const t of this._endpointElements)e.has(t)||t.removeAttribute(u);for(const t of this._parent?.querySelectorAll(`[${u}]`)||[])e.has(t)||t.removeAttribute(u);for(const t of e)this._endpointElements.has(t)&&t.hasAttribute(u)||t.setAttribute(u,"");this._endpointElements=e,this._endpointSetDirty=!1}_position(e,t,i){const r=this._marker(e);if(!r)return null;const o=Number.parseFloat(r.style.left),s=Number.parseFloat(r.style.top),n=r.getBoundingClientRect();return Number.isFinite(o)&&Number.isFinite(s)?{x:o*t/100,y:s*i/100,width:n.width,height:n.height}:null}_targetText(e){if("remote-space"===e.kind){const i=this.spaces?.find(t=>t.id===e.spaceId)?.title;return"string"==typeof i&&i.trim()||a(t(this.hass),"route_other_space")}return a(t(this.hass),"unplaced-coordinator"===e.kind?"route_coordinator_not_on_plan":"route_device_not_on_plan")}_markerClearance(e){return.61*Math.max(e.width,e.height)+3}_points(e){return e.map(e=>`${e.x.toFixed(2)},${e.y.toFixed(2)}`).join(" ")}render(){if(!this._hovered||!this.registry||!this._runtime.topologies.length)return this._setDesiredEndpointIds([]),i;const e=this._mappedMemo,n=e&&e.runtime===this._runtime&&e.devices===this.devices&&e.registry===this.registry?e.mapped:h(this._runtime.topologies,this.devices,this.registry);e&&n===e.mapped||(this._mappedMemo={runtime:this._runtime,devices:this.devices,registry:this.registry,mapped:n});const p=d(n,this.currentSpace,this._hovered),l=this.clientWidth||this._parent?.clientWidth||1,_=this.clientHeight||this._parent?.clientHeight||1,u=this._position(this._hovered,l,_);if(!u)return this._setDesiredEndpointIds([]),i;const b=p.lines.map(e=>({...e,point:this._position(e.neighborMarkerId,l,_)})).filter(e=>!!e.point).map(e=>{const t=void 0===e.lqi?"rgba(145,155,165,.85)":r(e.lqi),i=e.routeDirection?c(u,e.point,this._markerClearance(u),this._markerClearance(e.point),e.routeDirection):null;return{...e,color:t,arrow:i}}),m=u.x>l/2,v=this._markerClearance(u)+18,g=p.parentTargets.map((e,t)=>{const i=30*(t-(p.parentTargets.length-1)/2),r={x:u.x+(m?-v:v),y:Math.max(14,Math.min(_-14,u.y+i))};return{target:e,point:r,arrow:c(u,r,this._markerClearance(u),0,"toward-neighbor")}});return this._setDesiredEndpointIds(b.length||g.length||p.remoteCount?[this._hovered,...b.map(e=>e.neighborMarkerId)]:[]),s`
      ${b.length||g.length?o`<svg viewBox="0 0 ${l} ${_}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${b.map(e=>o`${void 0===e.lqi?o`<line
          class="link-casing" data-hp="zigbee-topology-line-casing"
          x1=${u.x} y1=${u.y} x2=${e.point.x} y2=${e.point.y}
          stroke="#2e2e2e" data-direction=${e.routeDirection||"none"}
          stroke-width="4" stroke-dasharray="5 5" stroke-dashoffset="0" opacity=".9"></line>`:i}
        <line class="link-core" data-hp="zigbee-topology-line"
          x1=${u.x} y1=${u.y}
          x2=${e.point.x} y2=${e.point.y}
          stroke=${e.color} data-direction=${e.routeDirection||"none"}
          stroke-width=${void 0===e.lqi?2:2.2}
          stroke-dasharray=${void 0===e.lqi?"5 5":i}
          stroke-dashoffset=${void 0===e.lqi?"0":i} opacity=".9"></line>
          ${e.arrow?o`<polygon class="route-arrow" data-hp="zigbee-topology-arrow"
            data-direction=${e.routeDirection} points=${this._points(e.arrow.points)}
            fill=${e.color}></polygon>`:i}`)}
        ${g.map(e=>o`<line class="parent-route" x1=${u.x} y1=${u.y}
          x2=${e.point.x} y2=${e.point.y} stroke="rgba(145,155,165,.92)"
          stroke-width="2" opacity=".9"></line>
          ${e.arrow?o`<polygon class="route-arrow" data-hp="zigbee-topology-parent-arrow"
            data-direction="toward-neighbor" points=${this._points(e.arrow.points)}
            fill="rgba(145,155,165,.92)"></polygon>`:i}`)}
      </svg>`:i}
      ${b.map(e=>s`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${e.neighborMarkerId} style="left:${e.point.x}px;top:${e.point.y}px;width:${1.22*e.point.width}px;height:${1.22*e.point.height}px"></div>`)}
      ${g.map(e=>s`<div class="parent-bubble ${m?"left":"right"}"
        data-hp="zigbee-topology-parent-bubble" data-kind=${e.target.kind}
        style="left:${e.point.x}px;top:${e.point.y}px">${this._targetText(e.target)}</div>`)}
      ${p.remoteCount?s`<div class="remote" data-hp="zigbee-topology-remote"
        style="left:${u.x}px;top:${u.y}px">${a(t(this.hass),"remote_count",{n:p.remoteCount})}</div>`:i}
    `}}b.properties={hass:{attribute:!1},devices:{attribute:!1},registry:{attribute:!1},currentSpace:{type:String,attribute:"current-space"},spaces:{attribute:!1},viewKey:{attribute:!1}},b.styles=n`
    :host { position: absolute; inset: 0; z-index: 7; display: block; pointer-events: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    line { vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .route-arrow { vector-effect: non-scaling-stroke; }
    svg, line, polygon, .halo, .remote, .parent-bubble { pointer-events: none; }
    .halo {
      position: absolute; width: calc(var(--device-base-size, 4cqw) * 1.22);
      height: calc(var(--device-base-size, 4cqw) * 1.22); transform: translate(-50%, -50%);
      box-sizing: border-box; border: 2px solid rgba(120, 190, 220, .82); border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(120, 190, 220, .16);
    }
    .remote, .parent-bubble {
      position: absolute; transform: translate(12px, calc(-100% - 12px));
      border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
      padding: 3px 7px; color: #fff; background: rgba(28,31,36,.88);
      box-shadow: 0 2px 7px rgba(0,0,0,.28); white-space: nowrap;
      font: 600 11px/1.2 system-ui, sans-serif;
    }
    .parent-bubble.right { transform: translate(0, -50%); }
    .parent-bubble.left { transform: translate(-100%, -50%); }
    @media (forced-colors: active) {
      line { stroke: Highlight !important; }
      .route-arrow { fill: Highlight !important; }
      .halo { border-color: Highlight; box-shadow: none; }
      .remote, .parent-bubble { color: CanvasText; background: Canvas; border-color: CanvasText; }
    }
  `,customElements.get("hp-zigbee-topology-overlay")||customElements.define("hp-zigbee-topology-overlay",b);export{b as HpZigbeeTopologyOverlay};
