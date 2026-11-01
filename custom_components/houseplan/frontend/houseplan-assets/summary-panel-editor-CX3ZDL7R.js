globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="39760e6c6f7b630d2ede693ff5378ebe59ffaa3f61f89eed567f2a1723058a36";import{b as a,A as e}from"./lit-element-DOGBMnIa.js";import"./hp-settings-select-UaYC6OBx.js";import{eG as s,eE as t,eF as l,f4 as r,f5 as o}from"./houseplan-card-Da5nD8ni.js";import{s as i,a as c}from"./summary-shared-C9fLS0JK.js";import"./floating-surface-C1x0oBML.js";import"./view-frame-CRjiDpFP.js";import"./canvas-constants-BxswoD16.js";import"./context-menu-4vdZor2e.js";const u=u=>{const{host:m,dialog:n,problems:d,t:p}=u,b=d.find(a=>"error"===a.kind),y=n.localShow!==n.baseLocalShow||!n.localOnly&&!s(t(n.draft),n.base),$=y&&!n.busy&&!b,h=a=>d.find(e=>e.path===a),v=a=>a?p(`summary.problem.${a.code}`):"",f=()=>u.close(),g=a`<label class="summary-switch hpf-toggle hpf-noicon" for="summary-local-show">
    <span class="hpf-toggle-title">${p("summary.show_local")}</span><span class="hpf-toggle-caption" id="summary-local-show-hint">${p("summary.show_local_hint")}</span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${n.localShow}
      ?disabled=${n.busy} aria-label=${p("summary.show_local")}
      aria-describedby="summary-local-show-hint"
      @change=${a=>u.setDialog({...n,localShow:a.target.checked})} /></label>`;return a`<hp-dialog .hass=${m.hass} data-kind="summary" class="ui-dialog" form-shell settings-layout compact style="--hp-dialog-wide-width:920px"
      .title=${p("summary.settings")} wide flex-content
      dismiss-on-scrim aria-busy=${String(n.busy)}
      @hp-close=${f}>
    <div class="body summary-editor hpf-form" @click=${()=>u.closeSource()}>
      ${n.localOnly?a`<p class="summary-local-hint hpf-hint">${p(n.localOnlyHint)}</p>`:e}
      <section class="summary-general hpf-card hpf-card-padded" aria-labelledby="summary-general-title">
        <h3 class="hpf-heading" id="summary-general-title">${p("summary.general_settings")}</h3>
        <div class="summary-general-grid">
        ${n.localOnly?e:a`<div class="summary-field hpf-field">
        <label class="hpf-label" for="summary-panel-title">${p("summary.panel_title")}</label>
        <input class="hpf-input" id="summary-panel-title" type="text" .value=${n.draft.title}
          ?disabled=${n.busy}
          data-summary-error=${String(n.attempted&&"title"===b?.path)}
          aria-invalid=${"error"===h("title")?.kind?"true":"false"}
          @input=${a=>u.mutate(e=>{e.title=a.target.value})} />
        ${h("title")?a`<div class="summary-problem hpf-error error">${v(h("title"))}</div>`:e}
        </div>`}
        ${g}
        ${n.localOnly?e:a`<label class="summary-switch hpf-toggle hpf-noicon" for="summary-mobile-show">
          <span class="hpf-toggle-title">${p("summary.show_mobile")}</span><span class="hpf-toggle-caption" id="summary-mobile-show-hint">${p("summary.show_mobile_hint")}</span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${n.draft.show_on_mobile} ?disabled=${!n.localShow||n.busy}
          aria-label=${p("summary.show_mobile")} aria-describedby="summary-mobile-show-hint"
          @change=${a=>u.mutate(e=>{e.show_on_mobile=a.target.checked})} /></label>`}
        </div>
        ${u.storageUnavailable?a`<div class="summary-problem hpf-note-warning warning">${p("summary.storage_unavailable")}</div>`:e}
      </section>
      ${n.localOnly?e:a`
        <section class="summary-blocks-card hpf-card hpf-card-padded" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 class="hpf-heading" id="summary-blocks-title">${p("summary.blocks")}</h3>
            <p>${p("summary.blocks_hint")}</p></div>
          <span class="summary-block-count hpf-chip">${p("summary.block_count").replace("{count}",String(n.draft.blocks.length)).replace("{limit}","10")}</span>
        </header>
        <div class="summary-editor-blocks">
          ${n.draft.blocks.map((s,t)=>{const o=`blocks.${t}`,d=h(`${o}.scope`);return a`<article class="summary-editor-block hpf-reading-block"
                @dragover=${a=>a.preventDefault()}
                @drop=${a=>u.drop(a,`block:${t}`)}>
              <div class="summary-block-head hpf-chrome-group">
                <span class="summary-drag" draggable=${String(!n.busy)} title=${p("summary.drag")}
                  @dragstart=${a=>u.dragStart(a,`block:${t}`)}>${i("grip")}</span>
                <div class="summary-order">
                <button class="btn hpf-action-icon summary-icon-button" type="button" title=${p("summary.up")}
                  aria-label=${p("summary.up")} ?disabled=${0===t||n.busy}
                  @click=${()=>u.mutate(a=>{a.blocks=l(a.blocks,t,t-1)})}>${i("up")}</button>
                <button class="btn hpf-action-icon summary-icon-button" type="button" title=${p("summary.down")}
                  aria-label=${p("summary.down")}
                  ?disabled=${t===n.draft.blocks.length-1||n.busy}
                  @click=${()=>u.mutate(a=>{a.blocks=l(a.blocks,t,t+1)})}>${i("down")}</button>
                </div>
                <input class="hpf-input summary-block-title" type="text" .value=${s.title}
                  placeholder=${p("summary.block_title")} aria-label=${p("summary.block_title")}
                  ?disabled=${n.busy}
                  data-summary-error=${String(n.attempted&&b?.path===`${o}.title`)}
                  aria-invalid=${"error"===h(`${o}.title`)?.kind?"true":"false"}
                  @input=${a=>u.mutate(e=>{e.blocks[t].title=a.target.value})} />
                <button class="btn hpf-action-icon summary-icon-button summary-visibility hpf-action-toggle" type="button"
                  ?disabled=${n.busy} aria-pressed=${String(s.visible)}
                  title=${p(s.visible?"summary.hide_block":"summary.show_block")}
                  aria-label=${p(s.visible?"summary.hide_block":"summary.show_block")}
                  @click=${()=>u.mutate(a=>{a.blocks[t].visible=!a.blocks[t].visible})}>${i(s.visible?"eye":"eyeOff")}</button>
              ${h(`${o}.title`)?a`<div class="summary-problem hpf-error error summary-block-title-error">${v(h(`${o}.title`))}</div>`:e}
              <div class="summary-scope">
                <hp-settings-select><select class="hpf-select" .value=${s.scope.type} ?disabled=${n.busy}
                  aria-label=${p("summary.scope")}
                  @change=${a=>u.mutate(e=>{e.blocks[t].scope="space"===a.target.value?{type:"space",space_id:m._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===s.scope.type}>${p("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===s.scope.type}>${p("summary.scope_space")}</option>
                </select></hp-settings-select>
                ${"space"===s.scope.type?a`<hp-settings-select><select class="hpf-select" .value=${s.scope.space_id}
                  ?disabled=${n.busy} aria-label=${p("summary.scope_space")}
                  data-summary-error=${String(n.attempted&&b?.path===`${o}.scope`)}
                  aria-invalid=${"error"===d?.kind?"true":"false"}
                  @change=${a=>u.mutate(e=>{const s=e.blocks[t].scope;"space"===s.type&&(s.space_id=a.target.value)})}>
                ${m._model.some(a=>a.id===s.scope.space_id)?e:a`<option value=${s.scope.space_id} selected>${s.scope.space_id}</option>`}
                ${m._model.map(e=>a`<option value=${e.id}
                    ?selected=${e.id===s.scope.space_id}>${e.title}</option>`)}
                </select></hp-settings-select>`:e}
              </div>
              ${d?a`<div class="summary-problem summary-scope-problem ${"error"===d.kind?"hpf-error":"hpf-note-warning"} ${d.kind}">${v(d)}</div>`:e}
              </div>
              <div class="summary-block-body">
              <div class="summary-editor-values">
                ${s.values.map((r,m)=>{const d=`${o}.values.${m}`,y=h(`${d}.source`),$=u.sourceToken(r.source),f=n.activeSource?.blockId===s.id&&n.activeSource.valueId===r.id,g="system"===r.source.type?p(`summary.system.${r.source.key}`):r.source.entity_id?u.entityIndex.labels.get(r.source.entity_id)||r.source.entity_id:p("summary.select_source"),k="system"===r.source.type?p("summary.system_source"):r.source.entity_id,_=f?c(u.entityIndex,n.entityFilter):null,w="entity"===r.source.type&&!!r.source.entity_id&&!u.entityIndex.labels.has(r.source.entity_id),S=`${s.id}\n${r.id}`;return a`<div class="summary-editor-value hpf-reading-block"
                      @dragover=${a=>{a.preventDefault(),a.stopPropagation()}}
                      @drop=${a=>u.drop(a,`value:${t}:${m}`)}>
                      <span class="summary-drag" draggable=${String(!n.busy)} title=${p("summary.drag")}
                        @dragstart=${a=>u.dragStart(a,`value:${t}:${m}`)}>${i("grip")}</span>
                      <div class="summary-order">
                      <button class="btn hpf-action-icon summary-icon-button" type="button" title=${p("summary.up")}
                        aria-label=${p("summary.up")} ?disabled=${0===m||n.busy}
                        @click=${()=>u.mutate(a=>{a.blocks[t].values=l(a.blocks[t].values,m,m-1)})}>${i("up")}</button>
                      <button class="btn hpf-action-icon summary-icon-button" type="button" title=${p("summary.down")}
                        aria-label=${p("summary.down")}
                        ?disabled=${m===s.values.length-1||n.busy}
                        @click=${()=>u.mutate(a=>{a.blocks[t].values=l(a.blocks[t].values,m,m+1)})}>${i("down")}</button>
                      </div>
                      <div class="summary-value-label">
                        <input class="hpf-input" type="text" .value=${r.label} ?disabled=${n.busy}
                          placeholder=${p("summary.value_name")} aria-label=${p("summary.value_name")}
                          data-summary-error=${String(n.attempted&&b?.path===`${d}.label`)}
                          aria-invalid=${"error"===h(`${d}.label`)?.kind?"true":"false"}
                          @input=${a=>u.mutate(e=>{e.blocks[t].values[m].label=a.target.value})} />
                        ${h(`${d}.label`)?a`<div class="summary-problem hpf-error error">${v(h(`${d}.label`))}</div>`:e}
                      </div>
                    <div class="summary-source-field">
                    <button class="btn hpf-action-picker summary-source" type="button"
                      ?disabled=${n.busy}
                      data-summary-source-owner=${S}
                      data-summary-error=${String(n.attempted&&b?.path===`${d}.source`)}
                      aria-invalid=${"error"===y?.kind?"true":"false"}
                      aria-haspopup="listbox" aria-expanded=${f?"true":"false"}
                      @click=${a=>{a.stopPropagation(),f?u.closeSource():u.openSource(s.id,r.id)}}>
                      <span class="summary-source-caption hpf-action-caption"><strong>${g}</strong>
                        ${k?a`<small>${k}</small>`:e}</span>
                      ${i("chevron")}
                    </button>
                    ${f&&_?a`<div class="summary-source-picker hpf-panel"
                        @click=${a=>a.stopPropagation()}
                        @keydown=${a=>{"Escape"===a.key&&(a.preventDefault(),a.stopPropagation(),u.closeSource(!0))}}>
                      <label class="hpf-label">${p("summary.search_entities")}</label>
                      <input class="hpf-input" type="search" data-summary-picker-search
                        ?disabled=${n.busy}
                        aria-label=${p("summary.search_entities")} .value=${n.entityFilter}
                        @input=${a=>u.setDialog({...n,entityFilter:a.target.value})} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${p("summary.select_source")}>
                        <div class="summary-source-group hpf-labelrow">${p("summary.system_group")}</div>
                        ${["device_count","total_area","datetime"].map(e=>a`
                          <button class="btn hpf-action-option" type="button" role="option"
                            ?disabled=${n.busy}
                            aria-selected=${$===`system:${e}`?"true":"false"}
                            @click=${()=>u.setSource(s.id,r.id,`system:${e}`)}>
                            ${p(`summary.system.${e}`)}
                          </button>`)}
                        ${w?a`<div class="summary-source-group hpf-labelrow">${p("summary.current_source")}</div>
                          <button type="button" role="option" class="btn hpf-action-option hpf-action-warning broken" aria-selected="true"
                            ?disabled=${n.busy}
                            @click=${()=>u.setSource(s.id,r.id,$)}>
                            ${g}
                          </button>`:e}
                        <div class="summary-source-group hpf-labelrow">${p("summary.entities_group")}</div>
                        ${_.entries.map(e=>a`<button class="btn hpf-action-option" type="button" role="option"
                            ?disabled=${n.busy}
                            aria-selected=${$===`entity:${e.id}`?"true":"false"}
                            @click=${()=>u.setSource(s.id,r.id,`entity:${e.id}`)}>
                          <span>${e.label}</span><small>${e.id}</small>
                        </button>`)}
                        ${_.total?e:a`<div class="summary-empty hpf-hint">${p("summary.no_search_results")}</div>`}
                        ${_.truncated?a`<div class="summary-refine hpf-hint">${p("summary.refine_search")}</div>`:e}
                      </div>
                    </div>`:e}
                    ${y?a`<div class="summary-problem ${"error"===y.kind?"hpf-error":"hpf-note-warning"} ${y.kind}">${v(y)}</div>`:e}
                    </div>
                    <button class="btn danger hpf-action-icon summary-icon-button summary-value-remove" type="button"
                      title=${p("btn.delete")} aria-label=${p("btn.delete")} ?disabled=${n.busy}
                      @click=${()=>u.mutate(a=>{a.blocks[t].values.splice(m,1)})}>${i("close")}</button>
                  </div>`})}
                <button class="btn hpf-action-fill summary-add summary-add-value" type="button"
                  ?disabled=${s.values.length>=20||n.busy}
                  title=${s.values.length>=20?p("summary.limit_values"):""}
                  @click=${()=>u.mutate(a=>{a.blocks[t].values.push(r())})}>
                  ${i("plus")}${p("summary.add_value")}
                </button>
              </div>
              <footer class="summary-block-footer hpf-divider-before">
                <button class="btn danger summary-delete-block" type="button" ?disabled=${n.busy}
                  @click=${()=>u.deleteBlock(t)}>${p("summary.delete_block")}</button>
              </footer>
              </div>
            </article>`})}
        </div>
        <button class="btn summary-add summary-add-block" type="button"
          ?disabled=${n.draft.blocks.length>=10||n.busy}
          title=${n.draft.blocks.length>=10?p("summary.limit_blocks"):""}
          @click=${()=>u.mutate(a=>{a.blocks.push(o(p))})}>
          ${i("plus")}${p("summary.add_block")}
        </button>
        </section>
        ${n.error?a`<div class="summary-problem hpf-error error" role="alert">${n.error}</div>`:e}
        ${n.conflict?a`<button class="btn ghost summary-reload" type="button"
          ?disabled=${n.busy} @click=${()=>u.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${p("summary.reload_current")}
        </button>`:e}
      `}
    </div>
    <div class="row summary-editor-footer" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${n.busy} @click=${f}>${p("btn.cancel")}</button>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${n.localOnly?!y||n.busy:!$}
        @click=${()=>u.save()}>${p("btn.save")}</button>
    </div>
  </hp-dialog>`};export{u as renderSummaryPanelEditor};
