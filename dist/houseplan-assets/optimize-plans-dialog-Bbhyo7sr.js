globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="aea4a3694e0140680ddfd37e3ceccd262392e9564b25118231ccf83cf13f50d9";import{A as t,o as i,cD as e}from"./open-spans-BqTqJwOm.js";import{d4 as s,d5 as o,d6 as r,d7 as n,O as a,c as l,a6 as p}from"./houseplan-card-C9BqWB-m.js";function g(t){return"legacy_group"===t.kind?"legacy_group":"registry_unavailable"===t.reason?"registry_unavailable":"unknown_owner"}function c(t,i){return i.name||("legacy_group"===i.kind?function(t,i){const e=t?.areas,s=i.slice(4);return e&&"object"==typeof e&&Object.prototype.hasOwnProperty.call(e,s)?String(e[s]?.name??"").trim():""}(t,i.id):"")}function d(t,i,{cardVersion:e,now:s}){const o=new Map((i?.spaces||[]).map(t=>[String(t?.id||""),t]));return{kind:"houseplan-optimize-preflight",origin:"runtime",cardVersion:e,checkedAt:s.toISOString(),preflightFingerprint:t.fingerprint,failures:t.failures.map(t=>({spaceId:t.spaceId,displayName:t.displayName,reason:t.reason,detail:t.detail??null,spaceGeometryFingerprint:o.has(t.spaceId)?p(o.get(t.spaceId)):null}))}}function h(t,i){return"string"==typeof t&&t.length>0&&t!==i}class m{constructor(t,i){this.port=t,this.options=i,this.fallbacks=new WeakMap,this.reportedFingerprint=null,this.registryRetryMs=i.registryRetryMs??1e4}get clipboardFallback(){const t=this.port.dialog();return t?this.fallbacks.get(t)??null:null}diagnostics(t,i){return d(t,i,{cardVersion:this.port.cardVersion(),now:new Date})}reportPreflightFailure(t,i){t.ok||t.fingerprint===this.reportedFingerprint||(this.reportedFingerprint=t.fingerprint,console.warn("[houseplan] optimize preflight failed",this.diagnostics(t,i)))}async copyDiagnostics(){const t=this.port.dialog(),i=t?.preflight;if(!t)return;let e;if(i&&!i.ok)e=JSON.stringify(this.diagnostics(i,t.config??null),null,2);else{if(!t.report.unverifiedPositions.length)return;e=JSON.stringify(function(t){const i={legacy_group:0,unknown_owner:0,registry_unavailable:0};for(const e of t.items)i[g(e)]++;return{kind:"houseplan-optimize-unverified",cardVersion:t.cardVersion,integrationVersion:t.integrationVersion,checkedAt:t.now.toISOString(),registry:{access:t.registry.access,authoritative:t.registry.authoritative,error:t.registry.error??null,analysisAuthoritative:t.analysisAuthoritative},counts:{total:t.items.length,...i},records:t.items.map(t=>({id:t.id,spaceId:t.spaceId,kind:t.kind,reason:t.reason??null}))}}({items:t.report.unverifiedPositions,registry:n(this.port.hass()),analysisAuthoritative:!0===t.report.registryAuthoritative,cardVersion:this.port.cardVersion(),integrationVersion:this.port.integrationVersion(),now:new Date}),null,2)}try{await navigator.clipboard.writeText(e),this.fallbacks.delete(t)&&this.port.requestUpdate(),this.port.showToast(this.port.t("gs.preflight_copied"))}catch{this.fallbacks.set(t,e),this.port.requestUpdate()}}preview(t){const i=this.port.config();if(!this.port.planReady()||!i)return;const e=i.spaces||[];let s;try{s=this.options.optimize(i,this.port.layout()||{},this.port.referenceContext(t))}catch(t){return void this.port.showMigrationBlocked(t)}const o=s.changed?this.port.checkGeometry(s.config):null;o&&this.reportPreflightFailure(o,s.config);const r=Math.ceil(10*s.report.maxShiftCm)/10,n=e.find(t=>null!=t?.id&&String(t.id)===s.report.maxSpace),a=e.length>1&&n?String(n.title||n.id):"";this.port.setDialog({report:s.report,config:s.config,layout:s.layout,cm:r,where:a,preflight:o,changed:s.changed,busy:!1,removeLiveMissingPositions:t})}open(){this.preview(!1)}toggleLivePositions(){const t=this.port.dialog();t&&!t.busy&&!t.retrying&&t.report.liveMissingPositions.length&&this.preview(!t.removeLiveMissingPositions)}async retryRegistry(){const t=this.port.dialog();if(!t||t.busy||t.retrying)return;const i={...t,retrying:!0,retryFailed:!1};this.port.setDialog(i);const e=await(n=this.port.hass(),a=this.registryRetryMs,new Promise(t=>{const i=s(n).revision;let e=()=>{};const l=globalThis.setTimeout(()=>{e(),t(!1)},a);e=o(n,()=>{const o=s(n);o.revision!==i&&(globalThis.clearTimeout(l),e(),t(o.authoritative))}),r(n)}));var n,a;this.port.dialog()===i&&(e&&this.preview(i.removeLiveMissingPositions),this.port.dialog()===i&&this.port.setDialog({...i,retrying:!1,retryFailed:!e}))}async run(){let t=this.port.dialog();if(t?.retrying)return;if(!t||t.busy||!this.port.config()||!t.changed||!t.preflight?.ok)return;const i=a(t.config);if(t.preflight.fingerprint!==i){const i=this.port.checkGeometry(t.config);if(this.reportPreflightFailure(i,t.config),t={...t,preflight:i},this.port.setDialog(t),!i.ok)return}this.port.clearGeometryGesture(),this.port.setDialog({...t,busy:!0});try{await this.port.commit(t.config,t.layout),this.port.setDialog(null),this.port.showToast(this.port.t("gs.align_done",{n:String(t.report.moved),m:String(t.report.migrated+t.report.canonicalized+t.report.coordsCanonicalized+t.report.latticeCoordinatesCanonicalized+t.report.wallsMerged+t.report.spansMerged+t.report.partitionsMerged+t.report.partitionsReconciled+t.report.openingsRehosted+t.report.wallsStraightened),r:String(t.report.spaceRefsRemapped+t.report.roomRefsRemapped+t.report.positionsRemapped+t.report.markersDetached+t.report.orphanRoomLabelsRemoved+t.report.orphanDevicePositionsRemoved+t.report.orphanGroupPositionsRemoved)}))}catch(t){const i=this.port.dialog();if(i&&this.port.setDialog({...i,busy:!1}),"wall_model_client_outdated"===t?.code)return void this.port.showToast(this.port.t("toast.wall_model_client_outdated"));"conflict"===t?.code&&await this.port.reloadAfterConflict(),l(t)||this.port.showToast(this.port.t("toast.error",{err:this.port.errorText(t)}))}}renderUnverified(e,s){const o=e.report.unverifiedPositions,r={legacy_group:[],unknown_owner:[],registry_unavailable:[]};for(const t of o)r[g(t)].push(t);const n=this.port.hass(),a=r.legacy_group.map(t=>c(n,t)).filter(Boolean),l=Math.max(0,a.length-3),p=a.length?this.port.t("gs.optimize_live_names",{names:a.slice(0,3).join(", "),more:l?this.port.t("gs.optimize_reference_more",{n:String(l)}):""}):"",d=!1===e.report.registryAuthoritative,h=(e,s,o={})=>e?i`<li>${this.port.t(s,{n:String(e),...o})}</li>`:t;return i`<div class="optimize-unverified">
      <p class="alignmsg">${this.port.t("gs.optimize_unverified",{n:String(o.length)})}</p>
      <p class="rhint">${this.port.t("gs.optimize_unverified_safe")}</p>
      <ul>
        ${h(r.legacy_group.length,"gs.optimize_unverified_legacy",{names:p})}
        ${h(r.unknown_owner.length,"gs.optimize_unverified_unknown")}
        ${h(r.registry_unavailable.length,"gs.optimize_unverified_unchecked")}
      </ul>
      ${d?i`<div class="optimize-registry" role="status">
          <p class="rhint">${this.port.t("gs.optimize_registry_limited")}</p>
          ${e.retryFailed?i`<p class="rhint">${this.port.t("gs.optimize_registry_still_limited")}</p>`:t}
        </div>`:t}
      ${d||!s?i`<div class="optimize-actions">
          ${d?i`<button class="btn ghost optimize-action optimize-retry" type="button"
            ?disabled=${e.busy||!!e.retrying} @click=${()=>this.retryRegistry()}>
            <ha-icon icon="mdi:refresh"></ha-icon>${this.port.t("gs.optimize_retry")}
          </button>`:t}
          ${s?t:i`<button class="btn ghost optimize-action optimize-copy" type="button"
            @click=${()=>this.copyDiagnostics()}>
            <ha-icon icon="mdi:content-copy"></ha-icon>${this.port.t("gs.preflight_copy")}
          </button>`}
        </div>`:t}
      ${this.fallbackBlock(s?null:this.clipboardFallback)}
    </div>`}fallbackBlock(e){return e?i`<details open>
      <summary>${this.port.t("gs.preflight_copy")}</summary>
      <pre style="user-select:text;white-space:pre-wrap">${e}</pre>
    </details>`:t}render(){const s=this.port.dialog(),o=s.report,r=s.changed&&!s.preflight?.ok,n=s.preflight?.failures||[],a=n.slice(0,3).map(t=>t.displayName),l=a.length?a.join(", "):this.port.t("gs.align_preflight_space",{n:"1"}),p=Math.max(0,n.length-a.length),g=p?this.port.t("gs.align_preflight_more",{n:String(p)}):"",d=o.spaceRefsRemapped+o.roomRefsRemapped+o.positionsRemapped+o.markersDetached,m=o.migrated+o.canonicalized+o.coordsCanonicalized+o.wallSegmentsMigrated+o.roomDraftsMigrated+o.roomDraftSegmentsMigrated+o.wallsMerged+o.spansMerged+o.partitionsMerged+o.partitionsReconciled+o.openingsRehosted,u=o.moved+o.rotated+o.coordsCanonicalized+o.wallsStraightened,_=Math.ceil(10*o.maxStraightenShiftCm)/10,f=(this.port.config()?.spaces||[]).find(t=>String(t?.id||"")===o.maxStraightenSpace),v=(this.port.config()?.spaces||[]).length>1&&f?String(f.title||f.id):"",y=o.orphanRoomLabelsRemoved+o.orphanDevicePositionsRemoved+o.orphanGroupPositionsRemoved,$=o.liveMissingPositions.map(t=>t.name).filter(Boolean),S=$.slice(0,3).join(", "),w=Math.max(0,$.length-3),z=S?this.port.t("gs.optimize_live_names",{names:S,more:w?this.port.t("gs.optimize_reference_more",{n:String(w)}):""}):"",b=this.port.hass(),k=t=>o.removedPositions.some(i=>i.id===t.id)?this.port.t("gs.optimize_detail_removed"):o.liveMissingPositions.some(i=>i.id===t.id)?this.port.t("gs.optimize_detail_live"):this.port.t("gs.optimize_detail_unverified"),M=t=>this.port.t("room_label"===t?"gs.optimize_detail_room_label":"group"===t?"gs.optimize_detail_group":"device"===t?"gs.optimize_detail_device":"legacy_group"===t?"gs.optimize_detail_legacy_group":"gs.optimize_detail_unknown"),R=t=>{const i=c(b,t),e={status:k(t),kind:M(t.kind)};return i?this.port.t("gs.optimize_detail_item_named",{...e,name:i,id:t.id,space:t.spaceId}):this.port.t("gs.optimize_detail_item",{...e,id:t.id,space:t.spaceId})},P=[...o.removedPositions,...o.liveMissingPositions.filter(t=>!o.removedPositions.some(i=>i.id===t.id)),...o.unverifiedPositions],D=P.slice(0,10),C=Math.max(0,P.length-D.length);return i`<hp-dialog .hass=${this.port.hass()} data-kind="settings" .title=${this.port.t("gs.align_title")} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${()=>this.port.setDialog(null)}>
        <div class="body">
          ${r?i`
              <p class="alignmsg">${this.port.t("gs.align_preflight_failed",{spaces:l,more:g})}</p>
              ${n.slice(0,10).map(t=>i`<p class="alignmsg">
                ${t.displayName}: ${this.port.t(`gs.preflight_reason_${t.reason}`)}
              </p>`)}
              ${n.length>10?i`<p class="alignmsg">
                ${this.port.t("gs.align_preflight_more",{n:String(n.length-10)})}
              </p>`:t}
              <div class="rhint">${this.port.t("gs.align_preflight_hint")}</div>
              ${h(this.port.integrationVersion(),this.port.cardVersion())?i`
                <div class="rhint">${this.port.t("gs.preflight_update_hint")}</div>`:t}
              <div class="row">
                <button class="btn ghost" @click=${()=>this.copyDiagnostics()}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>
                  ${this.port.t("gs.preflight_copy")}
                </button>
              </div>
              ${this.fallbackBlock(this.clipboardFallback)}`:s.changed?i`
              ${o.moved?i`<p class="alignmsg">${this.port.t("gs.align_count",{n:String(o.moved),total:String(o.total),cm:String(s.cm)})}</p>`:t}
              ${o.latticeCoordinatesCanonicalized?i`
                <p class="alignmsg">${this.port.t("gs.optimize_lattice_summary",{n:String(o.latticeCoordinatesCanonicalized),cm:e(o.latticeMaxShiftCm)})}</p>
                ${o.latticeSpaces.map(t=>i`<p class="alignmsg">${this.port.t("gs.optimize_lattice_space",{space:t.space,n:String(t.canonicalized),far:String(t.far)})}</p>`)}
              `:t}
              ${s.where?i`<p class="alignmsg">${this.port.t("gs.align_where",{s:s.where})}</p>`:t}
              ${o.rotated?i`<p class="alignmsg">${this.port.t("gs.align_turned",{n:String(o.rotated)})}</p>`:t}
              ${o.wallSegmentsMigrated?i`<p class="alignmsg">${this.port.t("gs.wall_segments_migrated",{n:String(o.wallSegmentsMigrated)})}</p>`:t}
              ${o.roomDraftsMigrated||o.roomDraftSegmentsMigrated?i`
                <p class="alignmsg">${this.port.t("gs.room_drafts_migrated",{drafts:String(o.roomDraftsMigrated),segments:String(o.roomDraftSegmentsMigrated)})}</p>`:t}
              ${o.legacyZeroWallsMigrated?i`<p class="alignmsg">${this.port.t("gs.zero_walls_migrated",{n:String(o.legacyZeroWallsMigrated)})}</p>`:t}
              ${m?i`<p class="alignmsg">${this.port.t("gs.optimize_changes",{m:String(o.migrated),c:String(o.canonicalized),p:String(o.coordsCanonicalized),w:String(o.wallsMerged),s:String(o.spansMerged),i:String(o.partitionsMerged)})}</p>`:t}
              ${o.partitionsReconciled?i`<p class="alignmsg">${this.port.t("gs.optimize_coincident_partitions",{n:String(o.partitionsReconciled)})}</p>`:t}
              ${o.openingsRehosted?i`<p class="alignmsg">${this.port.t("gs.optimize_openings_rehosted",{n:String(o.openingsRehosted)})}</p>`:t}
              ${o.wallsStraightened?i`<p class="alignmsg">${this.port.t("gs.optimize_walls_straightened",{n:String(o.wallsStraightened),cm:String(_)})}</p>`:t}
              ${v?i`<p class="alignmsg">${this.port.t("gs.optimize_walls_straightened_where",{s:v})}</p>`:t}
              ${o.glowSpacesMigrated||o.glowRoomsMigrated?i`<p class="alignmsg">${this.port.t("gs.optimize_glow_migration",{spaces:String(o.glowSpacesMigrated),rooms:String(o.glowRoomsMigrated)})}</p>`:t}
              ${u?i`<div class="rhint">${this.port.t("gs.align_warn")}</div>`:t}`:i`<p class="alignmsg">${this.port.t(o.liveMissingPositions.length||o.nestedRefsUnresolved?"gs.optimize_no_automatic_changes":o.unverifiedPositions.length?"gs.optimize_no_changes":"gs.align_none")}</p>`}
          ${!r&&o.wallsStraightenSkipped?i`<p class="rhint">${this.port.t("gs.optimize_walls_straighten_skipped",{n:String(o.wallsStraightenSkipped)})}</p>`:t}
          ${d?i`<p class="alignmsg">${this.port.t("gs.optimize_references",{spaces:String(o.spaceRefsRemapped),rooms:String(o.roomRefsRemapped),positions:String(o.positionsRemapped),detached:String(o.markersDetached)})}</p>`:t}
          ${y?i`<p class="alignmsg">${this.port.t("gs.optimize_orphans_removed",{total:String(y),rooms:String(o.orphanRoomLabelsRemoved),devices:String(o.orphanDevicePositionsRemoved),groups:String(o.orphanGroupPositionsRemoved)})}</p>`:t}
          ${o.liveMissingPositions.length?i`<div class="optimize-live">
                <p class="alignmsg">${this.port.t(s.removeLiveMissingPositions?"gs.optimize_live_positions_remove":"gs.optimize_live_positions",{n:String(o.liveMissingPositions.length),names:z})}</p>
                <button class="btn ghost optimize-cleanup" type="button"
                  aria-pressed=${s.removeLiveMissingPositions?"true":"false"}
                  @click=${()=>this.toggleLivePositions()} ?disabled=${s.busy||!!s.retrying}>
                  <ha-icon icon=${s.removeLiveMissingPositions?"mdi:undo":"mdi:map-marker-remove-outline"}></ha-icon>
                  ${this.port.t(s.removeLiveMissingPositions?"gs.optimize_live_keep":"gs.optimize_live_remove")}
                </button>
                ${s.removeLiveMissingPositions?i`<div class="rhint optimize-selected" role="status">
                      ${this.port.t("gs.optimize_live_selected")}
                    </div>`:t}
              </div>`:t}
          ${o.unverifiedPositions.length?this.renderUnverified(s,r):t}
          ${o.nestedRefsUnresolved?i`<div class="rhint" role="alert">${this.port.t("gs.optimize_vacuum_warning",{n:String(o.nestedRefsUnresolved)})}</div>`:t}
          ${this.port.ledNote()}
          ${P.length?i`<details class="optimize-details">
                <summary>${this.port.t("gs.optimize_details")}</summary>
                <ul>
                  ${D.map(t=>i`<li>${R(t)}</li>`)}
                </ul>
                ${C?i`<div class="rhint">${this.port.t("gs.optimize_details_more",{n:String(C)})}</div>`:t}
              </details>`:t}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" data-hp="dialog-cancel" @click=${()=>this.port.setDialog(null)}>${this.port.t(s.changed?"btn.cancel":"btn.close")}</button>
          ${s.changed&&s.preflight?.ok?i`
            <button class="btn on" data-hp="dialog-confirm" @click=${()=>this.run()} ?disabled=${s.busy||!!s.retrying}>
              <ha-icon icon="mdi:check"></ha-icon>${s.busy?"…":this.port.t("gs.align_run")}
            </button>`:t}
        </div>
    </hp-dialog>`}}export{m as OptimizePlansDialog,d as preflightDiagnostics,h as preflightVersionsDiffer};
