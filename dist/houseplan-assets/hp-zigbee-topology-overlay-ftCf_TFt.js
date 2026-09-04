globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="0d5ff9930a326df40a69665b8ab60fd2338148edc8b55031d3b6867d104a33d5";import{v as e,A as t,dx as i,w as s,c as o,l as r,u as n}from"./houseplan-card-CV9tmn2h.js";import{a,r as h,t as d}from"./zigbee-topology-CJoMsB_b.js";import{zigbeeTopologyRuntimeSnapshot as p,subscribeZigbeeTopology as c}from"./zigbee-topology-runtime-DdBA3cDf.js";const l={revision:0,topologies:[],states:{}};class v extends e{constructor(){super(...arguments),this.devices=[],this.currentSpace="",this._runtime=l,this._hovered="",this._pointerOver=e=>{if(!this._mouseAllowed(e))return void this._clear();const t=this._deviceFromEvent(e),i=t?.dataset.id||"";i&&i!==this._hovered&&(this._hovered=i,this.requestUpdate())},this._pointerOut=e=>{const t=this._deviceFromEvent(e);if(!t||t.dataset.id!==this._hovered)return;const i=e.relatedTarget instanceof Element?e.relatedTarget.closest('[data-hp="device"]'):null;i?.dataset.id!==this._hovered&&this._clear()},this._pointerDown=e=>{"mouse"!==e.pointerType&&this._clear()}}connectedCallback(){super.connectedCallback();const e=this.getRootNode();e.host&&"undefined"!=typeof MutationObserver&&(this._hoverGateObserver=new MutationObserver(()=>{e.host.hasAttribute("data-pointer-hover")||this._clear()}),this._hoverGateObserver.observe(e.host,{attributes:!0,attributeFilter:["data-pointer-hover"]})),queueMicrotask(()=>this._connectParent())}disconnectedCallback(){this._release?.(),this._release=void 0,this._disconnectParent(),this._hoverGateObserver?.disconnect(),this._hoverGateObserver=void 0,this._hovered="",super.disconnectedCallback()}updated(e){e.has("hass")&&(this._release?.(),this._runtime=p(this.hass),this._mappedMemo=void 0,this._release=c(this.hass,()=>{this._runtime=p(this.hass),this._mappedMemo=void 0,this.requestUpdate()})),(e.has("currentSpace")||e.has("devices")||e.has("registry"))&&(this._mappedMemo=void 0,this.devices.some(e=>e.id===this._hovered&&e.space===this.currentSpace)||(this._hovered=""))}_connectParent(){const e=this.parentElement;e&&e!==this._parent&&(this._disconnectParent(),this._parent=e,e.addEventListener("pointerover",this._pointerOver),e.addEventListener("pointerout",this._pointerOut),e.addEventListener("pointerdown",this._pointerDown,!0))}_disconnectParent(){this._parent?.removeEventListener("pointerover",this._pointerOver),this._parent?.removeEventListener("pointerout",this._pointerOut),this._parent?.removeEventListener("pointerdown",this._pointerDown,!0),this._parent=void 0}_deviceFromEvent(e){for(const t of e.composedPath())if(t instanceof HTMLElement&&"device"===t.dataset.hp)return t;return null}_mouseAllowed(e){const t=this.getRootNode();return"mouse"===e.pointerType&&t.host?.hasAttribute?.("data-pointer-hover")}_clear(){this._hovered&&(this._hovered="",this.requestUpdate())}_position(e){const t=[...this._parent?.querySelectorAll(".dev[data-id]")||[]].find(t=>t.dataset.id===e);if(!t)return null;const i=Number.parseFloat(t.style.left),s=Number.parseFloat(t.style.top),o=t.getBoundingClientRect();return Number.isFinite(i)&&Number.isFinite(s)?{x:i,y:s,width:o.width,height:o.height}:null}render(){if(!this._hovered||!this.registry||!this._runtime.topologies.length)return t;const e=this._mappedMemo,n=e&&e.runtime===this._runtime&&e.devices===this.devices&&e.registry===this.registry?e.mapped:a(this._runtime.topologies,this.devices,this.registry);e&&n===e.mapped||(this._mappedMemo={runtime:this._runtime,devices:this.devices,registry:this.registry,mapped:n});const p=h(n,this.currentSpace,this._hovered),c=this._position(this._hovered);if(!c)return t;const l=p.lines.map(e=>({...e,point:this._position(e.neighborMarkerId)})).filter(e=>!!e.point);return o`
      ${l.length?s`<svg viewBox="0 0 100 100" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${l.map(e=>s`<line x1=${c.x} y1=${c.y}
          x2=${e.point.x} y2=${e.point.y}
          stroke=${void 0===e.lqi?"rgba(145,155,165,.85)":i(e.lqi)}
          stroke-width=${void 0===e.lqi?2:2.2}
          stroke-dasharray=${void 0===e.lqi?"5 5":t} opacity=".9"></line>`)}
      </svg>`:t}
      ${l.map(e=>o`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${e.neighborMarkerId} style="left:${e.point.x}%;top:${e.point.y}%;width:${1.22*e.point.width}px;height:${1.22*e.point.height}px"></div>`)}
      ${p.remoteCount?o`<div class="remote" data-hp="zigbee-topology-remote"
        style="left:${c.x}%;top:${c.y}%">${d(r(this.hass),"remote_count",{n:p.remoteCount})}</div>`:t}
    `}}v.properties={hass:{attribute:!1},devices:{attribute:!1},registry:{attribute:!1},currentSpace:{type:String,attribute:"current-space"},viewKey:{attribute:!1}},v.styles=n`
    :host { position: absolute; inset: 0; z-index: 5; display: block; pointer-events: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    line { vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .halo {
      position: absolute; width: calc(var(--device-base-size, 4cqw) * 1.22);
      height: calc(var(--device-base-size, 4cqw) * 1.22); transform: translate(-50%, -50%);
      box-sizing: border-box; border: 2px solid rgba(120, 190, 220, .82); border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(120, 190, 220, .16);
    }
    .remote {
      position: absolute; transform: translate(12px, calc(-100% - 12px));
      border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
      padding: 3px 7px; color: #fff; background: rgba(28,31,36,.88);
      box-shadow: 0 2px 7px rgba(0,0,0,.28); white-space: nowrap;
      font: 600 11px/1.2 system-ui, sans-serif;
    }
    @media (forced-colors: active) {
      line { stroke: Highlight !important; }
      .halo { border-color: Highlight; box-shadow: none; }
      .remote { color: CanvasText; background: Canvas; border-color: CanvasText; }
    }
  `,customElements.get("hp-zigbee-topology-overlay")||customElements.define("hp-zigbee-topology-overlay",v);export{v as HpZigbeeTopologyOverlay};
