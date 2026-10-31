globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="0a89f0c4ce03f55f7167a23a2a3ab11079d16fccc41680735d9a2dd716d99a30";import{b as a,A as s}from"./lit-element-BdQ7BkK2.js";import"./hp-settings-select-b1qL4WZa.js";import{ex as e,ev as t,ew as l,eW as o,eX as r}from"./houseplan-card-DNa5Fphy.js";import{s as i,a as c}from"./summary-shared-Dc3wzxgJ.js";import"./floating-surface-yowiAbZ2.js";import"./view-frame-LtcRdS6Q.js";import"./canvas-constants-BoMbKBoj.js";import"./context-menu-zeMsIxU5.js";const u=u=>{const{host:m,dialog:n,problems:d,t:b}=u,p=d.find(a=>"error"===a.kind),y=n.localShow!==n.baseLocalShow||!n.localOnly&&!e(t(n.draft),n.base),$=y&&!n.busy&&!p,h=a=>d.find(s=>s.path===a),v=a=>a?b(`summary.problem.${a.code}`):"",g=()=>u.close(),k=a`<label class="summary-switch" for="summary-local-show">
    <span class="summary-switch-caption"><strong>${b("summary.show_local")}</strong>
      <small id="summary-local-show-hint">${b("summary.show_local_hint")}</small></span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${n.localShow}
      ?disabled=${n.busy} aria-label=${b("summary.show_local")}
      aria-describedby="summary-local-show-hint"
      @change=${a=>u.setDialog({...n,localShow:a.target.checked})} /></label>`;return a`<hp-dialog .hass=${m.hass} data-kind="summary" class="ui-dialog" form-shell settings-layout compact style="--hp-dialog-wide-width:920px"
      .title=${b("summary.settings")} wide flex-content
      dismiss-on-scrim aria-busy=${String(n.busy)}
      @hp-close=${g}>
    <div class="body summary-editor hpf-form" @click=${()=>u.closeSource()}>
      ${n.localOnly?a`<p class="summary-local-hint">${b(n.localOnlyHint)}</p>`:s}
      <section class="summary-general hpf-card hpf-card-padded" aria-labelledby="summary-general-title">
        <h3 class="hpf-heading" id="summary-general-title">${b("summary.general_settings")}</h3>
        <div class="summary-general-grid">
        ${n.localOnly?s:a`<div class="summary-field hpf-field">
        <label class="hpf-label" for="summary-panel-title">${b("summary.panel_title")}</label>
        <input class="hpf-input" id="summary-panel-title" type="text" .value=${n.draft.title}
          ?disabled=${n.busy}
          data-summary-error=${String(n.attempted&&"title"===p?.path)}
          aria-invalid=${"error"===h("title")?.kind?"true":"false"}
          @input=${a=>u.mutate(s=>{s.title=a.target.value})} />
        ${h("title")?a`<div class="summary-problem error">${v(h("title"))}</div>`:s}
        </div>`}
        ${k}
        ${n.localOnly?s:a`<label class="summary-switch" for="summary-mobile-show">
          <span class="summary-switch-caption"><strong>${b("summary.show_mobile")}</strong>
            <small id="summary-mobile-show-hint">${b("summary.show_mobile_hint")}</small></span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${n.draft.show_on_mobile} ?disabled=${!n.localShow||n.busy}
          aria-label=${b("summary.show_mobile")} aria-describedby="summary-mobile-show-hint"
          @change=${a=>u.mutate(s=>{s.show_on_mobile=a.target.checked})} /></label>`}
        </div>
        ${u.storageUnavailable?a`<div class="summary-problem warning">${b("summary.storage_unavailable")}</div>`:s}
      </section>
      ${n.localOnly?s:a`
        <section class="summary-blocks-card hpf-card hpf-card-padded" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 class="hpf-heading" id="summary-blocks-title">${b("summary.blocks")}</h3>
            <p>${b("summary.blocks_hint")}</p></div>
          <span class="summary-block-count">${b("summary.block_count").replace("{count}",String(n.draft.blocks.length)).replace("{limit}","10")}</span>
        </header>
        <div class="summary-editor-blocks">
          ${n.draft.blocks.map((e,t)=>{const r=`blocks.${t}`,d=h(`${r}.scope`);return a`<article class="summary-editor-block"
                @dragover=${a=>a.preventDefault()}
                @drop=${a=>u.drop(a,`block:${t}`)}>
              <div class="summary-block-head">
                <span class="summary-drag" draggable=${String(!n.busy)} title=${b("summary.drag")}
                  @dragstart=${a=>u.dragStart(a,`block:${t}`)}>${i("grip")}</span>
                <div class="summary-order">
                <button class="btn hpf-action-icon summary-icon-button" type="button" title=${b("summary.up")}
                  aria-label=${b("summary.up")} ?disabled=${0===t||n.busy}
                  @click=${()=>u.mutate(a=>{a.blocks=l(a.blocks,t,t-1)})}>${i("up")}</button>
                <button class="btn hpf-action-icon summary-icon-button" type="button" title=${b("summary.down")}
                  aria-label=${b("summary.down")}
                  ?disabled=${t===n.draft.blocks.length-1||n.busy}
                  @click=${()=>u.mutate(a=>{a.blocks=l(a.blocks,t,t+1)})}>${i("down")}</button>
                </div>
                <input class="hpf-input summary-block-title" type="text" .value=${e.title}
                  placeholder=${b("summary.block_title")} aria-label=${b("summary.block_title")}
                  ?disabled=${n.busy}
                  data-summary-error=${String(n.attempted&&p?.path===`${r}.title`)}
                  aria-invalid=${"error"===h(`${r}.title`)?.kind?"true":"false"}
                  @input=${a=>u.mutate(s=>{s.blocks[t].title=a.target.value})} />
                <button class="btn hpf-action-icon summary-icon-button summary-visibility hpf-action-toggle" type="button"
                  ?disabled=${n.busy} aria-pressed=${String(e.visible)}
                  title=${b(e.visible?"summary.hide_block":"summary.show_block")}
                  aria-label=${b(e.visible?"summary.hide_block":"summary.show_block")}
                  @click=${()=>u.mutate(a=>{a.blocks[t].visible=!a.blocks[t].visible})}>${i(e.visible?"eye":"eyeOff")}</button>
              ${h(`${r}.title`)?a`<div class="summary-problem error summary-block-title-error">${v(h(`${r}.title`))}</div>`:s}
              <div class="summary-scope">
                <hp-settings-select><select class="hpf-select" .value=${e.scope.type} ?disabled=${n.busy}
                  aria-label=${b("summary.scope")}
                  @change=${a=>u.mutate(s=>{s.blocks[t].scope="space"===a.target.value?{type:"space",space_id:m._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===e.scope.type}>${b("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===e.scope.type}>${b("summary.scope_space")}</option>
                </select></hp-settings-select>
                ${"space"===e.scope.type?a`<hp-settings-select><select class="hpf-select" .value=${e.scope.space_id}
                  ?disabled=${n.busy} aria-label=${b("summary.scope_space")}
                  data-summary-error=${String(n.attempted&&p?.path===`${r}.scope`)}
                  aria-invalid=${"error"===d?.kind?"true":"false"}
                  @change=${a=>u.mutate(s=>{const e=s.blocks[t].scope;"space"===e.type&&(e.space_id=a.target.value)})}>
                ${m._model.some(a=>a.id===e.scope.space_id)?s:a`<option value=${e.scope.space_id} selected>${e.scope.space_id}</option>`}
                ${m._model.map(s=>a`<option value=${s.id}
                    ?selected=${s.id===e.scope.space_id}>${s.title}</option>`)}
                </select></hp-settings-select>`:s}
              </div>
              ${d?a`<div class="summary-problem summary-scope-problem ${d.kind}">${v(d)}</div>`:s}
              </div>
              <div class="summary-block-body">
              <div class="summary-editor-values">
                ${e.values.map((o,m)=>{const d=`${r}.values.${m}`,y=h(`${d}.source`),$=u.sourceToken(o.source),g=n.activeSource?.blockId===e.id&&n.activeSource.valueId===o.id,k="system"===o.source.type?b(`summary.system.${o.source.key}`):o.source.entity_id?u.entityIndex.labels.get(o.source.entity_id)||o.source.entity_id:b("summary.select_source"),f="system"===o.source.type?b("summary.system_source"):o.source.entity_id,_=g?c(u.entityIndex,n.entityFilter):null,w="entity"===o.source.type&&!!o.source.entity_id&&!u.entityIndex.labels.has(o.source.entity_id),S=`${e.id}\n${o.id}`;return a`<div class="summary-editor-value"
                      @dragover=${a=>{a.preventDefault(),a.stopPropagation()}}
                      @drop=${a=>u.drop(a,`value:${t}:${m}`)}>
                      <span class="summary-drag" draggable=${String(!n.busy)} title=${b("summary.drag")}
                        @dragstart=${a=>u.dragStart(a,`value:${t}:${m}`)}>${i("grip")}</span>
                      <div class="summary-order">
                      <button class="btn hpf-action-icon summary-icon-button" type="button" title=${b("summary.up")}
                        aria-label=${b("summary.up")} ?disabled=${0===m||n.busy}
                        @click=${()=>u.mutate(a=>{a.blocks[t].values=l(a.blocks[t].values,m,m-1)})}>${i("up")}</button>
                      <button class="btn hpf-action-icon summary-icon-button" type="button" title=${b("summary.down")}
                        aria-label=${b("summary.down")}
                        ?disabled=${m===e.values.length-1||n.busy}
                        @click=${()=>u.mutate(a=>{a.blocks[t].values=l(a.blocks[t].values,m,m+1)})}>${i("down")}</button>
                      </div>
                      <div class="summary-value-label">
                        <input class="hpf-input" type="text" .value=${o.label} ?disabled=${n.busy}
                          placeholder=${b("summary.value_name")} aria-label=${b("summary.value_name")}
                          data-summary-error=${String(n.attempted&&p?.path===`${d}.label`)}
                          aria-invalid=${"error"===h(`${d}.label`)?.kind?"true":"false"}
                          @input=${a=>u.mutate(s=>{s.blocks[t].values[m].label=a.target.value})} />
                        ${h(`${d}.label`)?a`<div class="summary-problem error">${v(h(`${d}.label`))}</div>`:s}
                      </div>
                    <div class="summary-source-field">
                    <button class="btn hpf-action-picker summary-source" type="button"
                      ?disabled=${n.busy}
                      data-summary-source-owner=${S}
                      data-summary-error=${String(n.attempted&&p?.path===`${d}.source`)}
                      aria-invalid=${"error"===y?.kind?"true":"false"}
                      aria-haspopup="listbox" aria-expanded=${g?"true":"false"}
                      @click=${a=>{a.stopPropagation(),g?u.closeSource():u.openSource(e.id,o.id)}}>
                      <span class="summary-source-caption hpf-action-caption"><strong>${k}</strong>
                        ${f?a`<small>${f}</small>`:s}</span>
                      ${i("chevron")}
                    </button>
                    ${g&&_?a`<div class="summary-source-picker"
                        @click=${a=>a.stopPropagation()}
                        @keydown=${a=>{"Escape"===a.key&&(a.preventDefault(),a.stopPropagation(),u.closeSource(!0))}}>
                      <label class="hpf-label">${b("summary.search_entities")}</label>
                      <input class="hpf-input" type="search" data-summary-picker-search
                        ?disabled=${n.busy}
                        aria-label=${b("summary.search_entities")} .value=${n.entityFilter}
                        @input=${a=>u.setDialog({...n,entityFilter:a.target.value})} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${b("summary.select_source")}>
                        <div class="summary-source-group">${b("summary.system_group")}</div>
                        ${["device_count","total_area","datetime"].map(s=>a`
                          <button class="btn hpf-action-option" type="button" role="option"
                            ?disabled=${n.busy}
                            aria-selected=${$===`system:${s}`?"true":"false"}
                            @click=${()=>u.setSource(e.id,o.id,`system:${s}`)}>
                            ${b(`summary.system.${s}`)}
                          </button>`)}
                        ${w?a`<div class="summary-source-group">${b("summary.current_source")}</div>
                          <button type="button" role="option" class="btn hpf-action-option hpf-action-warning broken" aria-selected="true"
                            ?disabled=${n.busy}
                            @click=${()=>u.setSource(e.id,o.id,$)}>
                            ${k}
                          </button>`:s}
                        <div class="summary-source-group">${b("summary.entities_group")}</div>
                        ${_.entries.map(s=>a`<button class="btn hpf-action-option" type="button" role="option"
                            ?disabled=${n.busy}
                            aria-selected=${$===`entity:${s.id}`?"true":"false"}
                            @click=${()=>u.setSource(e.id,o.id,`entity:${s.id}`)}>
                          <span>${s.label}</span><small>${s.id}</small>
                        </button>`)}
                        ${_.total?s:a`<div class="summary-empty">${b("summary.no_search_results")}</div>`}
                        ${_.truncated?a`<div class="summary-refine">${b("summary.refine_search")}</div>`:s}
                      </div>
                    </div>`:s}
                    ${y?a`<div class="summary-problem ${y.kind}">${v(y)}</div>`:s}
                    </div>
                    <button class="btn danger hpf-action-icon summary-icon-button summary-value-remove" type="button"
                      title=${b("btn.delete")} aria-label=${b("btn.delete")} ?disabled=${n.busy}
                      @click=${()=>u.mutate(a=>{a.blocks[t].values.splice(m,1)})}>${i("close")}</button>
                  </div>`})}
                <button class="btn hpf-action-fill summary-add summary-add-value" type="button"
                  ?disabled=${e.values.length>=20||n.busy}
                  title=${e.values.length>=20?b("summary.limit_values"):""}
                  @click=${()=>u.mutate(a=>{a.blocks[t].values.push(o())})}>
                  ${i("plus")}${b("summary.add_value")}
                </button>
              </div>
              <footer class="summary-block-footer">
                <button class="btn danger summary-delete-block" type="button" ?disabled=${n.busy}
                  @click=${()=>u.deleteBlock(t)}>${b("summary.delete_block")}</button>
              </footer>
              </div>
            </article>`})}
        </div>
        <button class="btn summary-add summary-add-block" type="button"
          ?disabled=${n.draft.blocks.length>=10||n.busy}
          title=${n.draft.blocks.length>=10?b("summary.limit_blocks"):""}
          @click=${()=>u.mutate(a=>{a.blocks.push(r(b))})}>
          ${i("plus")}${b("summary.add_block")}
        </button>
        </section>
        ${n.error?a`<div class="summary-problem error" role="alert">${n.error}</div>`:s}
        ${n.conflict?a`<button class="btn ghost summary-reload" type="button"
          ?disabled=${n.busy} @click=${()=>u.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${b("summary.reload_current")}
        </button>`:s}
      `}
    </div>
    <div class="row summary-editor-footer" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${n.busy} @click=${g}>${b("btn.cancel")}</button>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${n.localOnly?!y||n.busy:!$}
        @click=${()=>u.save()}>${b("btn.save")}</button>
    </div>
  </hp-dialog>`};export{u as renderSummaryPanelEditor};
