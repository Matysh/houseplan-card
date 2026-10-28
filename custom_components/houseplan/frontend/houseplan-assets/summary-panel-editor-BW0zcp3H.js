globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="be47c12c6e0c74c42e4e22b3e4562cf844a843c292b8be4d94e56b447cef295c";import{b as e,A as a}from"./lit-element-Ed1l-mAx.js";import"./hp-settings-select-DD0gBeEr.js";import{dO as s,dM as t,dN as l,ea as r,eb as o}from"./houseplan-card-LY0n_7O2.js";import{s as i,a as u}from"./summary-shared-DDfeknh3.js";import"./floating-surface-CZb8ItPZ.js";import"./view-frame-yD8HSYBk.js";const m=m=>{const{host:c,dialog:d,problems:n,t:b}=m,y=n.find(e=>"error"===e.kind),$=d.localShow!==d.baseLocalShow||!d.localOnly&&!s(t(d.draft),d.base),p=$&&!d.busy&&!y,v=e=>n.find(a=>a.path===e),h=e=>e?b(`summary.problem.${e.code}`):"",k=()=>m.close(),g=e`<label class="summary-switch" for="summary-local-show">
    <span class="summary-switch-caption"><strong>${b("summary.show_local")}</strong>
      <small id="summary-local-show-hint">${b("summary.show_local_hint")}</small></span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${d.localShow}
      ?disabled=${d.busy} aria-label=${b("summary.show_local")}
      aria-describedby="summary-local-show-hint"
      @change=${e=>m.setDialog({...d,localShow:e.target.checked})} /></label>`;return e`<hp-dialog .hass=${c.hass} data-kind="summary"
      .title=${b("summary.settings")} wide flex-content
      dismiss-on-scrim aria-busy=${String(d.busy)}
      @hp-close=${k}>
    <div class="body summary-editor" @click=${()=>m.closeSource()}>
      ${d.localOnly?e`<p class="summary-local-hint">${b(d.localOnlyHint)}</p>`:a}
      <section class="summary-general" aria-labelledby="summary-general-title">
        <h3 id="summary-general-title">${b("summary.general_settings")}</h3>
        <div class="summary-general-grid">
        ${d.localOnly?a:e`<div class="summary-field">
        <label for="summary-panel-title">${b("summary.panel_title")}</label>
        <input id="summary-panel-title" type="text" .value=${d.draft.title}
          ?disabled=${d.busy}
          data-summary-error=${String(d.attempted&&"title"===y?.path)}
          aria-invalid=${"error"===v("title")?.kind?"true":"false"}
          @input=${e=>m.mutate(a=>{a.title=e.target.value})} />
        ${v("title")?e`<div class="summary-problem error">${h(v("title"))}</div>`:a}
        </div>`}
        ${g}
        ${d.localOnly?a:e`<label class="summary-switch" for="summary-mobile-show">
          <span class="summary-switch-caption"><strong>${b("summary.show_mobile")}</strong>
            <small id="summary-mobile-show-hint">${b("summary.show_mobile_hint")}</small></span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${d.draft.show_on_mobile} ?disabled=${!d.localShow||d.busy}
          aria-label=${b("summary.show_mobile")} aria-describedby="summary-mobile-show-hint"
          @change=${e=>m.mutate(a=>{a.show_on_mobile=e.target.checked})} /></label>`}
        </div>
        ${m.storageUnavailable?e`<div class="summary-problem warning">${b("summary.storage_unavailable")}</div>`:a}
      </section>
      ${d.localOnly?a:e`
        <section class="summary-blocks-card" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 id="summary-blocks-title">${b("summary.blocks")}</h3>
            <p>${b("summary.blocks_hint")}</p></div>
          <span class="summary-block-count">${b("summary.block_count").replace("{count}",String(d.draft.blocks.length)).replace("{limit}","10")}</span>
        </header>
        <div class="summary-editor-blocks">
          ${d.draft.blocks.map((s,t)=>{const o=`blocks.${t}`,n=v(`${o}.scope`);return e`<article class="summary-editor-block"
                @dragover=${e=>e.preventDefault()}
                @drop=${e=>m.drop(e,`block:${t}`)}>
              <div class="summary-block-head">
                <span class="summary-drag" draggable=${String(!d.busy)} title=${b("summary.drag")}
                  @dragstart=${e=>m.dragStart(e,`block:${t}`)}>${i("grip")}</span>
                <div class="summary-order">
                <button class="summary-icon-button" type="button" title=${b("summary.up")}
                  aria-label=${b("summary.up")} ?disabled=${0===t||d.busy}
                  @click=${()=>m.mutate(e=>{e.blocks=l(e.blocks,t,t-1)})}>${i("up")}</button>
                <button class="summary-icon-button" type="button" title=${b("summary.down")}
                  aria-label=${b("summary.down")}
                  ?disabled=${t===d.draft.blocks.length-1||d.busy}
                  @click=${()=>m.mutate(e=>{e.blocks=l(e.blocks,t,t+1)})}>${i("down")}</button>
                </div>
                <input class="summary-block-title" type="text" .value=${s.title}
                  placeholder=${b("summary.block_title")} aria-label=${b("summary.block_title")}
                  ?disabled=${d.busy}
                  data-summary-error=${String(d.attempted&&y?.path===`${o}.title`)}
                  aria-invalid=${"error"===v(`${o}.title`)?.kind?"true":"false"}
                  @input=${e=>m.mutate(a=>{a.blocks[t].title=e.target.value})} />
                <button class="summary-icon-button summary-visibility" type="button"
                  ?disabled=${d.busy} aria-pressed=${String(s.visible)}
                  title=${b(s.visible?"summary.hide_block":"summary.show_block")}
                  aria-label=${b(s.visible?"summary.hide_block":"summary.show_block")}
                  @click=${()=>m.mutate(e=>{e.blocks[t].visible=!e.blocks[t].visible})}>${i(s.visible?"eye":"eyeOff")}</button>
              ${v(`${o}.title`)?e`<div class="summary-problem error summary-block-title-error">${h(v(`${o}.title`))}</div>`:a}
              <div class="summary-scope">
                <hp-settings-select><select .value=${s.scope.type} ?disabled=${d.busy}
                  aria-label=${b("summary.scope")}
                  @change=${e=>m.mutate(a=>{a.blocks[t].scope="space"===e.target.value?{type:"space",space_id:c._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===s.scope.type}>${b("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===s.scope.type}>${b("summary.scope_space")}</option>
                </select></hp-settings-select>
                ${"space"===s.scope.type?e`<hp-settings-select><select .value=${s.scope.space_id}
                  ?disabled=${d.busy} aria-label=${b("summary.scope_space")}
                  data-summary-error=${String(d.attempted&&y?.path===`${o}.scope`)}
                  aria-invalid=${"error"===n?.kind?"true":"false"}
                  @change=${e=>m.mutate(a=>{const s=a.blocks[t].scope;"space"===s.type&&(s.space_id=e.target.value)})}>
                ${c._model.some(e=>e.id===s.scope.space_id)?a:e`<option value=${s.scope.space_id} selected>${s.scope.space_id}</option>`}
                ${c._model.map(a=>e`<option value=${a.id}
                    ?selected=${a.id===s.scope.space_id}>${a.title}</option>`)}
                </select></hp-settings-select>`:a}
              </div>
              ${n?e`<div class="summary-problem summary-scope-problem ${n.kind}">${h(n)}</div>`:a}
              </div>
              <div class="summary-block-body">
              <div class="summary-editor-values">
                ${s.values.map((r,c)=>{const n=`${o}.values.${c}`,$=v(`${n}.source`),p=m.sourceToken(r.source),k=d.activeSource?.blockId===s.id&&d.activeSource.valueId===r.id,g="system"===r.source.type?b(`summary.system.${r.source.key}`):r.source.entity_id?m.entityIndex.labels.get(r.source.entity_id)||r.source.entity_id:b("summary.select_source"),_="system"===r.source.type?b("summary.system_source"):r.source.entity_id,f=k?u(m.entityIndex,d.entityFilter):null,w="entity"===r.source.type&&!!r.source.entity_id&&!m.entityIndex.labels.has(r.source.entity_id),S=`${s.id}\n${r.id}`;return e`<div class="summary-editor-value"
                      @dragover=${e=>{e.preventDefault(),e.stopPropagation()}}
                      @drop=${e=>m.drop(e,`value:${t}:${c}`)}>
                      <span class="summary-drag" draggable=${String(!d.busy)} title=${b("summary.drag")}
                        @dragstart=${e=>m.dragStart(e,`value:${t}:${c}`)}>${i("grip")}</span>
                      <div class="summary-order">
                      <button class="summary-icon-button" type="button" title=${b("summary.up")}
                        aria-label=${b("summary.up")} ?disabled=${0===c||d.busy}
                        @click=${()=>m.mutate(e=>{e.blocks[t].values=l(e.blocks[t].values,c,c-1)})}>${i("up")}</button>
                      <button class="summary-icon-button" type="button" title=${b("summary.down")}
                        aria-label=${b("summary.down")}
                        ?disabled=${c===s.values.length-1||d.busy}
                        @click=${()=>m.mutate(e=>{e.blocks[t].values=l(e.blocks[t].values,c,c+1)})}>${i("down")}</button>
                      </div>
                      <div class="summary-value-label">
                        <input type="text" .value=${r.label} ?disabled=${d.busy}
                          placeholder=${b("summary.value_name")} aria-label=${b("summary.value_name")}
                          data-summary-error=${String(d.attempted&&y?.path===`${n}.label`)}
                          aria-invalid=${"error"===v(`${n}.label`)?.kind?"true":"false"}
                          @input=${e=>m.mutate(a=>{a.blocks[t].values[c].label=e.target.value})} />
                        ${v(`${n}.label`)?e`<div class="summary-problem error">${h(v(`${n}.label`))}</div>`:a}
                      </div>
                    <div class="summary-source-field">
                    <button class="summary-source" type="button"
                      ?disabled=${d.busy}
                      data-summary-source-owner=${S}
                      data-summary-error=${String(d.attempted&&y?.path===`${n}.source`)}
                      aria-invalid=${"error"===$?.kind?"true":"false"}
                      aria-haspopup="listbox" aria-expanded=${k?"true":"false"}
                      @click=${e=>{e.stopPropagation(),k?m.closeSource():m.openSource(s.id,r.id)}}>
                      <span class="summary-source-caption"><strong>${g}</strong>
                        ${_?e`<small>${_}</small>`:a}</span>
                      ${i("chevron")}
                    </button>
                    ${k&&f?e`<div class="summary-source-picker"
                        @click=${e=>e.stopPropagation()}
                        @keydown=${e=>{"Escape"===e.key&&(e.preventDefault(),e.stopPropagation(),m.closeSource(!0))}}>
                      <label>${b("summary.search_entities")}</label>
                      <input type="search" data-summary-picker-search
                        ?disabled=${d.busy}
                        aria-label=${b("summary.search_entities")} .value=${d.entityFilter}
                        @input=${e=>m.setDialog({...d,entityFilter:e.target.value})} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${b("summary.select_source")}>
                        <div class="summary-source-group">${b("summary.system_group")}</div>
                        ${["device_count","total_area","datetime"].map(a=>e`
                          <button type="button" role="option"
                            ?disabled=${d.busy}
                            aria-selected=${p===`system:${a}`?"true":"false"}
                            @click=${()=>m.setSource(s.id,r.id,`system:${a}`)}>
                            ${b(`summary.system.${a}`)}
                          </button>`)}
                        ${w?e`<div class="summary-source-group">${b("summary.current_source")}</div>
                          <button type="button" role="option" class="broken" aria-selected="true"
                            ?disabled=${d.busy}
                            @click=${()=>m.setSource(s.id,r.id,p)}>
                            ${g}
                          </button>`:a}
                        <div class="summary-source-group">${b("summary.entities_group")}</div>
                        ${f.entries.map(a=>e`<button type="button" role="option"
                            ?disabled=${d.busy}
                            aria-selected=${p===`entity:${a.id}`?"true":"false"}
                            @click=${()=>m.setSource(s.id,r.id,`entity:${a.id}`)}>
                          <span>${a.label}</span><small>${a.id}</small>
                        </button>`)}
                        ${f.total?a:e`<div class="summary-empty">${b("summary.no_search_results")}</div>`}
                        ${f.truncated?e`<div class="summary-refine">${b("summary.refine_search")}</div>`:a}
                      </div>
                    </div>`:a}
                    ${$?e`<div class="summary-problem ${$.kind}">${h($)}</div>`:a}
                    </div>
                    <button class="summary-icon-button summary-value-remove" type="button"
                      title=${b("btn.delete")} aria-label=${b("btn.delete")} ?disabled=${d.busy}
                      @click=${()=>m.mutate(e=>{e.blocks[t].values.splice(c,1)})}>${i("close")}</button>
                  </div>`})}
                <button class="summary-add summary-add-value" type="button"
                  ?disabled=${s.values.length>=20||d.busy}
                  title=${s.values.length>=20?b("summary.limit_values"):""}
                  @click=${()=>m.mutate(e=>{e.blocks[t].values.push(r())})}>
                  ${i("plus")}${b("summary.add_value")}
                </button>
              </div>
              <footer class="summary-block-footer">
                <button class="summary-delete-block" type="button" ?disabled=${d.busy}
                  @click=${()=>m.deleteBlock(t)}>${b("summary.delete_block")}</button>
              </footer>
              </div>
            </article>`})}
        </div>
        <button class="summary-add summary-add-block" type="button"
          ?disabled=${d.draft.blocks.length>=10||d.busy}
          title=${d.draft.blocks.length>=10?b("summary.limit_blocks"):""}
          @click=${()=>m.mutate(e=>{e.blocks.push(o(b))})}>
          ${i("plus")}${b("summary.add_block")}
        </button>
        </section>
        ${d.error?e`<div class="summary-problem error" role="alert">${d.error}</div>`:a}
        ${d.conflict?e`<button class="btn ghost summary-reload" type="button"
          ?disabled=${d.busy} @click=${()=>m.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${b("summary.reload_current")}
        </button>`:a}
      `}
    </div>
    <div class="row summary-editor-footer" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${d.busy} @click=${k}>${b("btn.cancel")}</button>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${d.localOnly?!$||d.busy:!p}
        @click=${()=>m.save()}>${b("btn.save")}</button>
    </div>
  </hp-dialog>`};export{m as renderSummaryPanelEditor};
