globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="f4645d446a428dbca2b0c52dd0af193ab85d8561d072cda5a8a0d9201dd8ae11";import{v as t,l as e,A as i,dx as r,w as o,c as s,u as a}from"./houseplan-card-B34Dj2Wv.js";import{t as n,a as h,r as p}from"./zigbee-topology-C2VfSKkl.js";import{zigbeeTopologyRuntimeSnapshot as d,subscribeZigbeeTopology as l}from"./zigbee-topology-runtime-Cm3YvxF_.js";function c(t,e,i,r,o,s=9,a=4.5){const n=e.x-t.x,h=e.y-t.y,p=Math.hypot(n,h),d=p-Math.max(0,i)-Math.max(0,r);if(!Number.isFinite(p)||p<=0||d<4)return null;const l=n/p,c=h/p,u="toward-neighbor"===o,v=u?{x:e.x-l*Math.max(0,r),y:e.y-c*Math.max(0,r)}:{x:t.x+l*Math.max(0,i),y:t.y+c*Math.max(0,i)},g=Math.min(s,Math.max(4,.45*d)),_=Math.min(a,.5*g),b=u?-1:1,m=v.x+l*g*b,x=v.y+c*g*b,y=-c;return{tip:v,points:[v,{x:m+y*_,y:x+l*_},{x:m-y*_,y:x-l*_}]}}const u={revision:0,topologies:[],states:{}};class v extends t{constructor(){super(...arguments),this.devices=[],this.currentSpace="",this._runtime=u,this._hovered="",this._pointerOver=t=>{if(!this._mouseAllowed(t))return void this._clear();const e=this._deviceFromEvent(t),i=e?.dataset.id||"";i&&i!==this._hovered&&(this._hovered=i,this.requestUpdate())},this._pointerOut=t=>{const e=this._deviceFromEvent(t);if(!e||e.dataset.id!==this._hovered)return;const i=t.relatedTarget instanceof Element?t.relatedTarget.closest('[data-hp="device"]'):null;i?.dataset.id!==this._hovered&&this._clear()},this._pointerDown=t=>{"mouse"!==t.pointerType&&this._clear()}}connectedCallback(){super.connectedCallback();const t=this.getRootNode();t.host&&"undefined"!=typeof MutationObserver&&(this._hoverGateObserver=new MutationObserver(()=>{t.host.hasAttribute("data-pointer-hover")||this._clear()}),this._hoverGateObserver.observe(t.host,{attributes:!0,attributeFilter:["data-pointer-hover"]})),queueMicrotask(()=>this._connectParent())}disconnectedCallback(){this._release?.(),this._release=void 0,this._disconnectParent(),this._hoverGateObserver?.disconnect(),this._hoverGateObserver=void 0,this._hovered="",super.disconnectedCallback()}updated(t){t.has("hass")&&(this._release?.(),this._runtime=d(this.hass),this._mappedMemo=void 0,this._release=l(this.hass,()=>{this._runtime=d(this.hass),this._mappedMemo=void 0,this.requestUpdate()})),(t.has("currentSpace")||t.has("devices")||t.has("registry"))&&(this._mappedMemo=void 0,this.devices.some(t=>t.id===this._hovered&&t.space===this.currentSpace)||(this._hovered=""))}_connectParent(){const t=this.parentElement;t&&t!==this._parent&&(this._disconnectParent(),this._parent=t,t.addEventListener("pointerover",this._pointerOver),t.addEventListener("pointerout",this._pointerOut),t.addEventListener("pointerdown",this._pointerDown,!0))}_disconnectParent(){this._parent?.removeEventListener("pointerover",this._pointerOver),this._parent?.removeEventListener("pointerout",this._pointerOut),this._parent?.removeEventListener("pointerdown",this._pointerDown,!0),this._parent=void 0}_deviceFromEvent(t){for(const e of t.composedPath())if(e instanceof HTMLElement&&"device"===e.dataset.hp)return e;return null}_mouseAllowed(t){const e=this.getRootNode();return"mouse"===t.pointerType&&e.host?.hasAttribute?.("data-pointer-hover")}_clear(){this._hovered&&(this._hovered="",this.requestUpdate())}_position(t,e,i){const r=[...this._parent?.querySelectorAll(".dev[data-id]")||[]].find(e=>e.dataset.id===t);if(!r)return null;const o=Number.parseFloat(r.style.left),s=Number.parseFloat(r.style.top),a=r.getBoundingClientRect();return Number.isFinite(o)&&Number.isFinite(s)?{x:o*e/100,y:s*i/100,width:a.width,height:a.height}:null}_targetText(t){if("remote-space"===t.kind){const i=this.spaces?.find(e=>e.id===t.spaceId)?.title;return"string"==typeof i&&i.trim()||n(e(this.hass),"route_other_space")}return n(e(this.hass),"unplaced-coordinator"===t.kind?"route_coordinator_not_on_plan":"route_device_not_on_plan")}_markerClearance(t){return.61*Math.max(t.width,t.height)+3}_points(t){return t.map(t=>`${t.x.toFixed(2)},${t.y.toFixed(2)}`).join(" ")}render(){if(!this._hovered||!this.registry||!this._runtime.topologies.length)return i;const t=this._mappedMemo,a=t&&t.runtime===this._runtime&&t.devices===this.devices&&t.registry===this.registry?t.mapped:h(this._runtime.topologies,this.devices,this.registry);t&&a===t.mapped||(this._mappedMemo={runtime:this._runtime,devices:this.devices,registry:this.registry,mapped:a});const d=p(a,this.currentSpace,this._hovered),l=this.clientWidth||this._parent?.clientWidth||1,u=this.clientHeight||this._parent?.clientHeight||1,v=this._position(this._hovered,l,u);if(!v)return i;const g=d.lines.map(t=>({...t,point:this._position(t.neighborMarkerId,l,u)})).filter(t=>!!t.point).map(t=>{const e=void 0===t.lqi?"rgba(145,155,165,.85)":r(t.lqi),i=t.routeDirection?c(v,t.point,this._markerClearance(v),this._markerClearance(t.point),t.routeDirection):null;return{...t,color:e,arrow:i}}),_=v.x>l/2,b=this._markerClearance(v)+18,m=d.parentTargets.map((t,e)=>{const i=30*(e-(d.parentTargets.length-1)/2),r={x:v.x+(_?-b:b),y:Math.max(14,Math.min(u-14,v.y+i))};return{target:t,point:r,arrow:c(v,r,this._markerClearance(v),0,"toward-neighbor")}});return s`
      ${g.length||m.length?o`<svg viewBox="0 0 ${l} ${u}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${g.map(t=>o`<line x1=${v.x} y1=${v.y}
          x2=${t.point.x} y2=${t.point.y}
          stroke=${t.color} data-direction=${t.routeDirection||"none"}
          stroke-width=${void 0===t.lqi?2:2.2}
          stroke-dasharray=${void 0===t.lqi?"5 5":i} opacity=".9"></line>
          ${t.arrow?o`<polygon class="route-arrow" data-hp="zigbee-topology-arrow"
            data-direction=${t.routeDirection} points=${this._points(t.arrow.points)}
            fill=${t.color}></polygon>`:i}`)}
        ${m.map(t=>o`<line class="parent-route" x1=${v.x} y1=${v.y}
          x2=${t.point.x} y2=${t.point.y} stroke="rgba(145,155,165,.92)"
          stroke-width="2" opacity=".9"></line>
          ${t.arrow?o`<polygon class="route-arrow" data-hp="zigbee-topology-parent-arrow"
            data-direction="toward-neighbor" points=${this._points(t.arrow.points)}
            fill="rgba(145,155,165,.92)"></polygon>`:i}`)}
      </svg>`:i}
      ${g.map(t=>s`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${t.neighborMarkerId} style="left:${t.point.x}px;top:${t.point.y}px;width:${1.22*t.point.width}px;height:${1.22*t.point.height}px"></div>`)}
      ${m.map(t=>s`<div class="parent-bubble ${_?"left":"right"}"
        data-hp="zigbee-topology-parent-bubble" data-kind=${t.target.kind}
        style="left:${t.point.x}px;top:${t.point.y}px">${this._targetText(t.target)}</div>`)}
      ${d.remoteCount?s`<div class="remote" data-hp="zigbee-topology-remote"
        style="left:${v.x}px;top:${v.y}px">${n(e(this.hass),"remote_count",{n:d.remoteCount})}</div>`:i}
    `}}v.properties={hass:{attribute:!1},devices:{attribute:!1},registry:{attribute:!1},currentSpace:{type:String,attribute:"current-space"},spaces:{attribute:!1},viewKey:{attribute:!1}},v.styles=a`
    :host { position: absolute; inset: 0; z-index: 5; display: block; pointer-events: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    line { vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .route-arrow { vector-effect: non-scaling-stroke; }
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
  `,customElements.get("hp-zigbee-topology-overlay")||customElements.define("hp-zigbee-topology-overlay",v);export{v as HpZigbeeTopologyOverlay};
