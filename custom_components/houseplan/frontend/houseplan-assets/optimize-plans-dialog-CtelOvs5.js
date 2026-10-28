globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="1ecd2c93b26a65fb31b5ded5033bfc22a75f047a4a9079ee820c417077ca9b89";import{A as i,b as t}from"./lit-element-C3tniB7C.js";import{d$ as e,e0 as s,e1 as o,e2 as r,z as n,y as a,az as p}from"./houseplan-card-C8CQtDVT.js";import{dq as l}from"./view-frame-CokxygsX.js";function g(i){return"legacy_group"===i.kind?"legacy_group":"registry_unavailable"===i.reason?"registry_unavailable":"unknown_owner"}function c(i,t){return t.name||("legacy_group"===t.kind?function(i,t){const e=i?.areas,s=t.slice(4);return e&&"object"==typeof e&&Object.prototype.hasOwnProperty.call(e,s)?String(e[s]?.name??"").trim():""}(i,t.id):"")}function h(i,t,{cardVersion:e,now:s}){const o=new Map((t?.spaces||[]).map(i=>[String(i?.id||""),i]));return{kind:"houseplan-optimize-preflight",origin:"runtime",cardVersion:e,checkedAt:s.toISOString(),preflightFingerprint:i.fingerprint,failures:i.failures.map(i=>({spaceId:i.spaceId,displayName:i.displayName,reason:i.reason,detail:i.detail??null,spaceGeometryFingerprint:o.has(i.spaceId)?p(o.get(i.spaceId)):null}))}}function d(i,t){return"string"==typeof i&&i.length>0&&i!==t}class m{constructor(i,t){this.port=i,this.options=t,this.fallbacks=new WeakMap,this.reportedFingerprint=null,this.registryRetryMs=t.registryRetryMs??1e4}get clipboardFallback(){const i=this.port.dialog();return i?this.fallbacks.get(i)??null:null}diagnostics(i,t){return h(i,t,{cardVersion:this.port.cardVersion(),now:new Date})}reportPreflightFailure(i,t){i.ok||i.fingerprint===this.reportedFingerprint||(this.reportedFingerprint=i.fingerprint,console.warn("[houseplan] optimize preflight failed",this.diagnostics(i,t)))}async copyDiagnostics(){const i=this.port.dialog(),t=i?.preflight;if(!i)return;let e;if(t&&!t.ok)e=JSON.stringify(this.diagnostics(t,i.config??null),null,2);else{if(!i.report.unverifiedPositions.length)return;e=JSON.stringify(function(i){const t={legacy_group:0,unknown_owner:0,registry_unavailable:0};for(const e of i.items)t[g(e)]++;return{kind:"houseplan-optimize-unverified",cardVersion:i.cardVersion,integrationVersion:i.integrationVersion,checkedAt:i.now.toISOString(),registry:{access:i.registry.access,authoritative:i.registry.authoritative,error:i.registry.error??null,analysisAuthoritative:i.analysisAuthoritative},counts:{total:i.items.length,...t},records:i.items.map(i=>({id:i.id,spaceId:i.spaceId,kind:i.kind,reason:i.reason??null}))}}({items:i.report.unverifiedPositions,registry:r(this.port.hass()),analysisAuthoritative:!0===i.report.registryAuthoritative,cardVersion:this.port.cardVersion(),integrationVersion:this.port.integrationVersion(),now:new Date}),null,2)}try{await navigator.clipboard.writeText(e),this.fallbacks.delete(i)&&this.port.requestUpdate(),this.port.showToast(this.port.t("gs.preflight_copied"),"gs.preflight_copied")}catch{this.fallbacks.set(i,e),this.port.requestUpdate()}}preview(i,t=!1){const e=this.port.config();if(!this.port.canWrite())return void this.port.showToast(this.port.t("gs.optimize_write_required"),"gs.optimize_write_required");if(!this.port.planReady()||!e)return;const s=this.port.source(),o=e.spaces||[];let r;try{r=this.options.optimize(e,this.port.layout()||{},this.port.referenceContext(i,t))}catch(i){return void this.port.showMigrationBlocked(i)}const n=r.changed?this.port.checkGeometry(r.config):null;n&&this.reportPreflightFailure(n,r.config);const a=Math.ceil(10*r.report.maxShiftCm)/10,p=o.find(i=>null!=i?.id&&String(i.id)===r.report.maxSpace),l=o.length>1&&p?String(p.title||p.id):"",g=new Set((r.config.spaces||[]).flatMap(i=>(i.rooms||[]).map(i=>i.id))),c=(r.config.markers||[]).filter(i=>Object.values(i.vacuum?.segment_map||{}).some(i=>"string"==typeof i&&!!i&&!g.has(i))).map(i=>String(i.name||i.id));this.port.setDialog({report:r.report,config:r.config,layout:r.layout,cm:a,where:l,preflight:n,changed:r.changed,busy:!1,removeLiveMissingPositions:i,removeInvalidMissingPositions:t,source:s,vacuumNames:c})}open(){this.preview(!1)}toggleLivePositions(){const i=this.port.dialog();i&&!i.busy&&!i.retrying&&i.report.liveMissingPositions.length&&(this.refreshChanged(i)||this.preview(!i.removeLiveMissingPositions,i.removeInvalidMissingPositions))}toggleInvalidPositions(){const i=this.port.dialog();!i||i.busy||i.retrying||i.changed&&!i.preflight?.ok||!i.report.invalidPositionsEligible.length||this.refreshChanged(i)||this.preview(i.removeLiveMissingPositions,!i.removeInvalidMissingPositions)}refreshChanged(i){return!this.options.sourceMatches(i.source,this.port.source())&&(this.preview(!1,!1),this.port.showToast(this.port.t("gs.optimize_preview_changed"),"gs.optimize_preview_changed"),!0)}async retryRegistry(){const i=this.port.dialog();if(!i||i.busy||i.retrying)return;const t={...i,retrying:!0,retryFailed:!1};this.port.setDialog(t);const r=await(n=this.port.hass(),a=this.registryRetryMs,new Promise(i=>{const t=e(n).revision;let r=()=>{};const p=globalThis.setTimeout(()=>{r(),i(!1)},a);r=s(n,()=>{const s=e(n);s.revision!==t&&(globalThis.clearTimeout(p),r(),i(s.authoritative))}),o(n)}));var n,a;this.port.dialog()===t&&(r&&this.preview(!1,!1),this.port.dialog()===t&&this.port.setDialog({...t,retrying:!1,retryFailed:!r}))}async run(){let i=this.port.dialog();if(!this.port.canWrite())return void this.port.showToast(this.port.t("gs.optimize_write_required"),"gs.optimize_write_required");if(i?.retrying)return;if(!i||i.busy||!this.port.config()||!i.changed||!i.preflight?.ok)return;if(!this.options.sourceMatches(i.source,this.port.source()))return this.preview(!1,!1),void this.port.showToast(this.port.t("gs.optimize_preview_changed"),"gs.optimize_preview_changed");const t=n(i.config);if(i.preflight.fingerprint!==t){const t=this.port.checkGeometry(i.config);if(this.reportPreflightFailure(t,i.config),i={...i,preflight:t},this.port.setDialog(i),!t.ok)return}this.port.clearGeometryGesture();const e={...i,busy:!0};this.port.setDialog(e);try{if(await this.port.commit(i.config,i.layout,{source:i.source,current:()=>this.port.source(),canWrite:()=>this.port.canWrite()}),this.port.dialog()!==e||!this.port.canWrite())return;if(i.removeInvalidMissingPositions?(this.preview(!1,!1),this.port.showToast(this.port.t("gs.optimize_invalid_done",{n:String(i.report.invalidPositionsRemoved.length)}),"gs.optimize_invalid_done")):this.port.setDialog(null),i.removeInvalidMissingPositions)return;this.port.showToast(this.port.t("gs.align_done",{n:String(i.report.moved),m:String(i.report.migrated+i.report.canonicalized+i.report.coordsCanonicalized+i.report.latticeCoordinatesCanonicalized+i.report.wallsMerged+i.report.spansMerged+i.report.partitionsMerged+i.report.partitionsReconciled+i.report.openingsRehosted+i.report.wallsStraightened),r:String(i.report.spaceRefsRemapped+i.report.roomRefsRemapped+i.report.positionsRemapped+i.report.markersDetached+i.report.orphanRoomLabelsRemoved+i.report.orphanDevicePositionsRemoved+i.report.orphanGroupPositionsRemoved+i.report.invalidPositionsRemoved.length)}),"gs.align_done")}catch(i){const t=this.port.dialog();if(t!==e)return;if("optimize_preview_changed"===i?.code){this.port.canWrite()?this.preview(!1,!1):this.port.setDialog({...e,busy:!1});const i=this.port.canWrite()?"gs.optimize_preview_changed":"gs.optimize_write_required";return void this.port.showToast(this.port.t(i),i)}if(t&&this.port.setDialog({...t,busy:!1}),"wall_model_client_outdated"===i?.code)return void this.port.showToast(this.port.t("toast.wall_model_client_outdated"),"toast.wall_model_client_outdated");if("conflict"===i?.code){if(await this.port.reloadAfterConflict(),this.port.dialog()!==t&&this.port.dialog()?.source!==t.source)return;this.port.canWrite()&&this.preview(!1,!1)}a(i)||this.port.showToast(this.port.t("toast.error",{err:this.port.errorText(i)}),"toast.error")}}renderUnverified(e,s){const o=e.report.unverifiedPositions,r={legacy_group:[],unknown_owner:[],registry_unavailable:[]};for(const i of o)r[g(i)].push(i);const n=this.port.hass(),a=r.legacy_group.map(i=>c(n,i)).filter(Boolean),p=Math.max(0,a.length-3),l=a.length?this.port.t("gs.optimize_live_names",{names:a.slice(0,3).join(", "),more:p?this.port.t("gs.optimize_reference_more",{n:String(p)}):""}):"",h=!1===e.report.registryAuthoritative,d=(e,s,o={})=>e?t`<li>${this.port.t(s,{n:String(e),...o})}</li>`:i;return t`<div class="optimize-unverified">
      <p class="alignmsg">${this.port.t("gs.optimize_unverified",{n:String(o.length)})}</p>
      <p class="rhint">${this.port.t("gs.optimize_unverified_safe")}</p>
      <ul>
        ${d(r.legacy_group.length,"gs.optimize_unverified_legacy",{names:l})}
        ${d(r.unknown_owner.length,"gs.optimize_unverified_unknown")}
        ${d(r.registry_unavailable.length,"gs.optimize_unverified_unchecked")}
      </ul>
      ${h?t`<div class="optimize-registry" role="status">
          <p class="rhint">${this.port.t("gs.optimize_registry_limited")}</p>
          ${e.retryFailed?t`<p class="rhint">${this.port.t("gs.optimize_registry_still_limited")}</p>`:i}
        </div>`:i}
      ${h||!s?t`<div class="optimize-actions">
          ${h?t`<button class="btn ghost optimize-action optimize-retry" type="button"
            ?disabled=${e.busy||!!e.retrying} @click=${()=>this.retryRegistry()}>
            <ha-icon icon="mdi:refresh"></ha-icon>${this.port.t("gs.optimize_retry")}
          </button>`:i}
          ${s?i:t`<button class="btn ghost optimize-action optimize-copy" type="button"
            @click=${()=>this.copyDiagnostics()}>
            <ha-icon icon="mdi:content-copy"></ha-icon>${this.port.t("gs.preflight_copy")}
          </button>`}
        </div>`:i}
      ${this.fallbackBlock(s?null:this.clipboardFallback)}
    </div>`}fallbackBlock(e){return e?t`<details open>
      <summary>${this.port.t("gs.preflight_copy")}</summary>
      <pre style="user-select:text;white-space:pre-wrap">${e}</pre>
    </details>`:i}render(){const e=this.port.dialog(),s=e.report,o=e.changed&&!e.preflight?.ok,r=e.preflight?.failures||[],n=r.slice(0,3).map(i=>i.displayName),a=n.length?n.join(", "):this.port.t("gs.align_preflight_space",{n:"1"}),p=Math.max(0,r.length-n.length),g=p?this.port.t("gs.align_preflight_more",{n:String(p)}):"",h=s.spaceRefsRemapped+s.roomRefsRemapped+s.positionsRemapped+s.markersDetached,m=s.migrated+s.canonicalized+s.coordsCanonicalized+s.wallSegmentsMigrated+s.roomDraftsMigrated+s.roomDraftSegmentsMigrated+s.wallsMerged+s.spansMerged+s.partitionsMerged+s.partitionsReconciled+s.openingsRehosted,u=s.moved+s.rotated+s.coordsCanonicalized+s.wallsStraightened,_=Math.ceil(10*s.maxStraightenShiftCm)/10,v=(this.port.config()?.spaces||[]).find(i=>String(i?.id||"")===s.maxStraightenSpace),f=(this.port.config()?.spaces||[]).length>1&&v?String(v.title||v.id):"",$=s.orphanRoomLabelsRemoved+s.orphanDevicePositionsRemoved+s.orphanGroupPositionsRemoved,y=s.invalidPositionsEligible,z=s.invalidPositionsRetained,w=s.liveMissingPositions.map(i=>i.name).filter(Boolean),S=w.slice(0,3).join(", "),b=Math.max(0,w.length-3),M=S?this.port.t("gs.optimize_live_names",{names:S,more:b?this.port.t("gs.optimize_reference_more",{n:String(b)}):""}):"",P=this.port.hass(),k=i=>s.removedPositions.some(t=>t.id===i.id)?this.port.t("gs.optimize_detail_removed"):s.liveMissingPositions.some(t=>t.id===i.id)?this.port.t("gs.optimize_detail_live"):this.port.t("gs.optimize_detail_unverified"),R=i=>this.port.t("room_label"===i?"gs.optimize_detail_room_label":"group"===i?"gs.optimize_detail_group":"device"===i?"gs.optimize_detail_device":"legacy_group"===i?"gs.optimize_detail_legacy_group":"gs.optimize_detail_unknown"),D=i=>{const t=c(P,i),e={status:k(i),kind:R(i.kind)};return t?this.port.t("gs.optimize_detail_item_named",{...e,name:t,id:i.id,space:i.spaceId}):this.port.t("gs.optimize_detail_item",{...e,id:i.id,space:i.spaceId})},I=[...s.removedPositions,...s.liveMissingPositions.filter(i=>!s.removedPositions.some(t=>t.id===i.id)),...s.unverifiedPositions],C=I.slice(0,10),T=Math.max(0,I.length-C.length);return t`<hp-dialog .hass=${this.port.hass()} data-kind="settings" .title=${this.port.t("gs.align_title")} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${()=>this.port.setDialog(null)}>
        <div class="body">
          ${o?t`
              <p class="alignmsg">${this.port.t("gs.align_preflight_failed",{spaces:a,more:g})}</p>
              ${r.slice(0,10).map(i=>t`<p class="alignmsg">
                ${i.displayName}: ${this.port.t(`gs.preflight_reason_${i.reason}`)}
              </p>`)}
              ${r.length>10?t`<p class="alignmsg">
                ${this.port.t("gs.align_preflight_more",{n:String(r.length-10)})}
              </p>`:i}
              <div class="rhint">${this.port.t("gs.align_preflight_hint")}</div>
              ${d(this.port.integrationVersion(),this.port.cardVersion())?t`
                <div class="rhint">${this.port.t("gs.preflight_update_hint")}</div>`:i}
              <div class="row">
                <button class="btn ghost" @click=${()=>this.copyDiagnostics()}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>
                  ${this.port.t("gs.preflight_copy")}
                </button>
              </div>
              ${this.fallbackBlock(this.clipboardFallback)}`:e.changed?t`
              ${s.moved?t`<p class="alignmsg">${this.port.t("gs.align_count",{n:String(s.moved),total:String(s.total),cm:String(e.cm)})}</p>`:i}
              ${s.currentPositionsMoved?t`<p class="alignmsg">${this.port.t("gs.optimize_visible_positions",{n:String(s.currentPositionsMoved),total:String(s.currentPositions)})}</p>`:i}
              ${s.archivedPositions?t`<p class="alignmsg">${this.port.t("gs.optimize_missing_space_positions",{n:String(s.archivedPositionsMoved),total:String(s.archivedPositions)})}</p>`:i}
              ${s.latticeCoordinatesCanonicalized?t`
                <p class="alignmsg">${this.port.t("gs.optimize_lattice_summary",{n:String(s.latticeCoordinatesCanonicalized),cm:l(s.latticeMaxShiftCm)})}</p>
                ${s.latticeSpaces.map(i=>t`<p class="alignmsg">${this.port.t("gs.optimize_lattice_space",{space:i.space,n:String(i.canonicalized),far:String(i.far)})}</p>`)}
              `:i}
              ${e.where?t`<p class="alignmsg">${this.port.t("gs.align_where",{s:e.where})}</p>`:i}
              ${s.rotated?t`<p class="alignmsg">${this.port.t("gs.align_turned",{n:String(s.rotated)})}</p>`:i}
              ${s.wallSegmentsMigrated?t`<p class="alignmsg">${this.port.t("gs.wall_segments_migrated",{n:String(s.wallSegmentsMigrated)})}</p>`:i}
              ${s.roomDraftsMigrated||s.roomDraftSegmentsMigrated?t`
                <p class="alignmsg">${this.port.t("gs.room_drafts_migrated",{drafts:String(s.roomDraftsMigrated),segments:String(s.roomDraftSegmentsMigrated)})}</p>`:i}
              ${s.legacyZeroWallsMigrated?t`<p class="alignmsg">${this.port.t("gs.zero_walls_migrated",{n:String(s.legacyZeroWallsMigrated)})}</p>`:i}
              ${m?t`<p class="alignmsg">${this.port.t("gs.optimize_changes",{m:String(s.migrated),c:String(s.canonicalized),p:String(s.coordsCanonicalized),w:String(s.wallsMerged),s:String(s.spansMerged),i:String(s.partitionsMerged)})}</p>`:i}
              ${s.partitionsReconciled?t`<p class="alignmsg">${this.port.t("gs.optimize_coincident_partitions",{n:String(s.partitionsReconciled)})}</p>`:i}
              ${s.openingsRehosted?t`<p class="alignmsg">${this.port.t("gs.optimize_openings_rehosted",{n:String(s.openingsRehosted)})}</p>`:i}
              ${s.wallsStraightened?t`<p class="alignmsg">${this.port.t("gs.optimize_walls_straightened",{n:String(s.wallsStraightened),cm:String(_)})}</p>`:i}
              ${f?t`<p class="alignmsg">${this.port.t("gs.optimize_walls_straightened_where",{s:f})}</p>`:i}
              ${s.glowSpacesMigrated||s.glowRoomsMigrated?t`<p class="alignmsg">${this.port.t("gs.optimize_glow_migration",{spaces:String(s.glowSpacesMigrated),rooms:String(s.glowRoomsMigrated)})}</p>`:i}
              ${u?t`<div class="rhint">${this.port.t("gs.align_warn")}</div>`:i}`:t`<p class="alignmsg">${this.port.t(s.liveMissingPositions.length||s.nestedRefsUnresolved?"gs.optimize_no_automatic_changes":s.unverifiedPositions.length?"gs.optimize_no_changes":"gs.align_none")}</p>`}
          ${!o&&s.wallsStraightenSkipped?t`<p class="rhint">${this.port.t("gs.optimize_walls_straighten_skipped",{n:String(s.wallsStraightenSkipped)})}</p>`:i}
          ${h?t`<p class="alignmsg">${this.port.t("gs.optimize_references",{spaces:String(s.spaceRefsRemapped),rooms:String(s.roomRefsRemapped),positions:String(s.positionsRemapped),detached:String(s.markersDetached)})}</p>`:i}
          ${$?t`<p class="alignmsg">${this.port.t("gs.optimize_orphans_removed",{total:String($),rooms:String(s.orphanRoomLabelsRemoved),devices:String(s.orphanDevicePositionsRemoved),groups:String(s.orphanGroupPositionsRemoved)})}</p>`:i}
          ${s.liveMissingPositions.length?t`<div class="optimize-live">
                <p class="alignmsg">${this.port.t(e.removeLiveMissingPositions?"gs.optimize_live_positions_remove":"gs.optimize_live_positions",{n:String(s.liveMissingPositions.length),names:M})}</p>
                <button class="btn ghost optimize-cleanup" type="button"
                  aria-pressed=${e.removeLiveMissingPositions?"true":"false"}
                  @click=${()=>this.toggleLivePositions()} ?disabled=${e.busy||!!e.retrying}>
                  <ha-icon icon=${e.removeLiveMissingPositions?"mdi:undo":"mdi:map-marker-remove-outline"}></ha-icon>
                  ${this.port.t(e.removeLiveMissingPositions?"gs.optimize_live_keep":"gs.optimize_live_remove")}
                </button>
                ${e.removeLiveMissingPositions?t`<div class="rhint optimize-selected" role="status">
                      ${this.port.t("gs.optimize_live_selected")}
                    </div>`:i}
              </div>`:i}
          ${s.unverifiedPositions.length?this.renderUnverified(e,o):i}
          ${y.length||z.length?t`<div class="optimize-invalid">
              <p class="alignmsg">${this.port.t("gs.optimize_invalid_eligible",{n:String(y.length)})}</p>
              <p class="rhint">${this.port.t("gs.optimize_invalid_hint")}</p>
              <button class="btn ghost optimize-action optimize-invalid-cleanup" type="button"
                aria-pressed=${e.removeInvalidMissingPositions?"true":"false"}
                ?disabled=${!y.length||e.busy||!!e.retrying||o||!this.port.canWrite()}
                @click=${()=>this.toggleInvalidPositions()}>
                <ha-icon icon=${e.removeInvalidMissingPositions?"mdi:undo":"mdi:broom"}></ha-icon>
                ${this.port.t(e.removeInvalidMissingPositions?"gs.optimize_invalid_keep":"gs.optimize_invalid_remove")}
              </button>
              ${y.length?i:t`<p class="rhint">${this.port.t("gs.optimize_invalid_none_safe")}</p>`}
              ${e.removeInvalidMissingPositions?t`<p class="rhint" role="status">
                ${this.port.t("gs.optimize_invalid_selected",{n:String(s.invalidPositionsRemoved.length)})}
              </p>`:i}
              ${z.length?t`<p class="rhint">${this.port.t("gs.optimize_invalid_retained",{n:String(z.length)})}</p>
                <ul>${["live_owner","unknown_shape","registry_unavailable","unsupported_model"].map(e=>{const s=z.filter(i=>i.cleanupReason===e).length;return s?t`<li>${this.port.t(`gs.optimize_invalid_${e}`,{n:String(s)})}</li>`:i})}</ul>`:i}
            </div>`:i}
          ${s.nestedRefsUnresolved?t`<div class="rhint" role="alert">${this.port.t("gs.optimize_vacuum_warning",{n:String(s.nestedRefsUnresolved)})}</div>`:i}
          ${(e.vacuumNames||[]).map(i=>t`<p class="rhint">${this.port.t("gs.optimize_vacuum_action",{name:i})}</p>`)}
          ${this.port.ledNote()}
          ${I.length?t`<details class="optimize-details">
                <summary>${this.port.t("gs.optimize_details")}</summary>
                <ul>
                  ${C.map(i=>t`<li>${D(i)}</li>`)}
                </ul>
                ${T?t`<div class="rhint">${this.port.t("gs.optimize_details_more",{n:String(T)})}</div>`:i}
              </details>`:i}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" data-hp="dialog-cancel" @click=${()=>this.port.setDialog(null)}>${this.port.t(e.changed?"btn.cancel":"btn.close")}</button>
          ${e.changed&&e.preflight?.ok?t`
            <button class="btn on" data-hp="dialog-confirm" @click=${()=>this.run()} ?disabled=${e.busy||!!e.retrying||!this.port.canWrite()}>
              <ha-icon icon="mdi:check"></ha-icon>${e.busy?"…":this.port.t(e.removeInvalidMissingPositions?"gs.optimize_apply_changes":"gs.align_run")}
            </button>`:i}
        </div>
    </hp-dialog>`}}export{m as OptimizePlansDialog,h as preflightDiagnostics,d as preflightVersionsDiffer};
