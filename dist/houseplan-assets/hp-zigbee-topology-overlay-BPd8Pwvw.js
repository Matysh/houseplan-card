globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="450863830ad6931b7698085deecbd39f6686a3e84f1b777008be5347426f4b21";import{v as e,l as t,A as i,dx as r,w as o,c as s,u as a}from"./houseplan-card-Dc1_eajM.js";import{t as n,a as h,r as p}from"./zigbee-topology-B2eQAXzT.js";import{zigbeeTopologyRuntimeSnapshot as d,subscribeZigbeeTopology as l}from"./zigbee-topology-runtime-CSb-ImjM.js";function c(e,t,i,r,o,s=9,a=4.5){const n=t.x-e.x,h=t.y-e.y,p=Math.hypot(n,h),d=p-Math.max(0,i)-Math.max(0,r);if(!Number.isFinite(p)||p<=0||d<4)return null;const l=n/p,c=h/p,u="toward-neighbor"===o,v=u?{x:t.x-l*Math.max(0,r),y:t.y-c*Math.max(0,r)}:{x:e.x+l*Math.max(0,i),y:e.y+c*Math.max(0,i)},b=Math.min(s,Math.max(4,.45*d)),g=Math.min(a,.5*b),_=u?-1:1,m=v.x+l*b*_,x=v.y+c*b*_,y=-c;return{tip:v,points:[v,{x:m+y*g,y:x+l*g},{x:m-y*g,y:x-l*g}]}}const u={revision:0,topologies:[],states:{}};class v extends e{constructor(){super(...arguments),this.devices=[],this.currentSpace="",this._runtime=u,this._hovered="",this._pointerOver=e=>{if(!this._mouseAllowed(e))return void this._clear();const t=this._deviceFromEvent(e),i=t?.dataset.id||"";i&&i!==this._hovered&&(this._hovered=i,this.requestUpdate())},this._pointerOut=e=>{const t=this._deviceFromEvent(e);if(!t||t.dataset.id!==this._hovered)return;const i=e.relatedTarget instanceof Element?e.relatedTarget.closest('[data-hp="device"]'):null;i?.dataset.id!==this._hovered&&this._clear()},this._pointerDown=e=>{"mouse"!==e.pointerType&&this._clear()}}connectedCallback(){super.connectedCallback();const e=this.getRootNode();e.host&&"undefined"!=typeof MutationObserver&&(this._hoverGateObserver=new MutationObserver(()=>{e.host.hasAttribute("data-pointer-hover")||this._clear()}),this._hoverGateObserver.observe(e.host,{attributes:!0,attributeFilter:["data-pointer-hover"]})),queueMicrotask(()=>this._connectParent())}disconnectedCallback(){this._release?.(),this._release=void 0,this._disconnectParent(),this._hoverGateObserver?.disconnect(),this._hoverGateObserver=void 0,this._hovered="",super.disconnectedCallback()}updated(e){e.has("hass")&&(this._release?.(),this._runtime=d(this.hass),this._mappedMemo=void 0,this._release=l(this.hass,()=>{this._runtime=d(this.hass),this._mappedMemo=void 0,this.requestUpdate()})),(e.has("currentSpace")||e.has("devices")||e.has("registry"))&&(this._mappedMemo=void 0,this.devices.some(e=>e.id===this._hovered&&e.space===this.currentSpace)||(this._hovered=""))}_connectParent(){const e=this.parentElement;e&&e!==this._parent&&(this._disconnectParent(),this._parent=e,e.addEventListener("pointerover",this._pointerOver),e.addEventListener("pointerout",this._pointerOut),e.addEventListener("pointerdown",this._pointerDown,!0))}_disconnectParent(){this._parent?.removeEventListener("pointerover",this._pointerOver),this._parent?.removeEventListener("pointerout",this._pointerOut),this._parent?.removeEventListener("pointerdown",this._pointerDown,!0),this._parent=void 0}_deviceFromEvent(e){for(const t of e.composedPath())if(t instanceof HTMLElement&&"device"===t.dataset.hp)return t;return null}_mouseAllowed(e){const t=this.getRootNode();return"mouse"===e.pointerType&&t.host?.hasAttribute?.("data-pointer-hover")}_clear(){this._hovered&&(this._hovered="",this.requestUpdate())}_position(e,t,i){const r=[...this._parent?.querySelectorAll(".dev[data-id]")||[]].find(t=>t.dataset.id===e);if(!r)return null;const o=Number.parseFloat(r.style.left),s=Number.parseFloat(r.style.top),a=r.getBoundingClientRect();return Number.isFinite(o)&&Number.isFinite(s)?{x:o*t/100,y:s*i/100,width:a.width,height:a.height}:null}_targetText(e){if("remote-space"===e.kind){const i=this.spaces?.find(t=>t.id===e.spaceId)?.title;return"string"==typeof i&&i.trim()||n(t(this.hass),"route_other_space")}return n(t(this.hass),"unplaced-coordinator"===e.kind?"route_coordinator_not_on_plan":"route_device_not_on_plan")}_markerClearance(e){return.61*Math.max(e.width,e.height)+3}_points(e){return e.map(e=>`${e.x.toFixed(2)},${e.y.toFixed(2)}`).join(" ")}render(){if(!this._hovered||!this.registry||!this._runtime.topologies.length)return i;const e=this._mappedMemo,a=e&&e.runtime===this._runtime&&e.devices===this.devices&&e.registry===this.registry?e.mapped:h(this._runtime.topologies,this.devices,this.registry);e&&a===e.mapped||(this._mappedMemo={runtime:this._runtime,devices:this.devices,registry:this.registry,mapped:a});const d=p(a,this.currentSpace,this._hovered),l=this.clientWidth||this._parent?.clientWidth||1,u=this.clientHeight||this._parent?.clientHeight||1,v=this._position(this._hovered,l,u);if(!v)return i;const b=d.lines.map(e=>({...e,point:this._position(e.neighborMarkerId,l,u)})).filter(e=>!!e.point).map(e=>{const t=void 0===e.lqi?"rgba(145,155,165,.85)":r(e.lqi),i=e.routeDirection?c(v,e.point,this._markerClearance(v),this._markerClearance(e.point),e.routeDirection):null;return{...e,color:t,arrow:i}}),g=v.x>l/2,_=this._markerClearance(v)+18,m=d.parentTargets.map((e,t)=>{const i=30*(t-(d.parentTargets.length-1)/2),r={x:v.x+(g?-_:_),y:Math.max(14,Math.min(u-14,v.y+i))};return{target:e,point:r,arrow:c(v,r,this._markerClearance(v),0,"toward-neighbor")}});return s`
      ${b.length||m.length?o`<svg viewBox="0 0 ${l} ${u}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${b.map(e=>o`<line x1=${v.x} y1=${v.y}
          x2=${e.point.x} y2=${e.point.y}
          stroke=${e.color} data-direction=${e.routeDirection||"none"}
          stroke-width=${void 0===e.lqi?2:2.2}
          stroke-dasharray=${void 0===e.lqi?"5 5":i} opacity=".9"></line>
          ${e.arrow?o`<polygon class="route-arrow" data-hp="zigbee-topology-arrow"
            data-direction=${e.routeDirection} points=${this._points(e.arrow.points)}
            fill=${e.color}></polygon>`:i}`)}
        ${m.map(e=>o`<line class="parent-route" x1=${v.x} y1=${v.y}
          x2=${e.point.x} y2=${e.point.y} stroke="rgba(145,155,165,.92)"
          stroke-width="2" opacity=".9"></line>
          ${e.arrow?o`<polygon class="route-arrow" data-hp="zigbee-topology-parent-arrow"
            data-direction="toward-neighbor" points=${this._points(e.arrow.points)}
            fill="rgba(145,155,165,.92)"></polygon>`:i}`)}
      </svg>`:i}
      ${b.map(e=>s`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${e.neighborMarkerId} style="left:${e.point.x}px;top:${e.point.y}px;width:${1.22*e.point.width}px;height:${1.22*e.point.height}px"></div>`)}
      ${m.map(e=>s`<div class="parent-bubble ${g?"left":"right"}"
        data-hp="zigbee-topology-parent-bubble" data-kind=${e.target.kind}
        style="left:${e.point.x}px;top:${e.point.y}px">${this._targetText(e.target)}</div>`)}
      ${d.remoteCount?s`<div class="remote" data-hp="zigbee-topology-remote"
        style="left:${v.x}px;top:${v.y}px">${n(t(this.hass),"remote_count",{n:d.remoteCount})}</div>`:i}
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
