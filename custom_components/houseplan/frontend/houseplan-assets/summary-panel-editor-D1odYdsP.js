globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="a711262de27ea7ba5f522b98765c8fdb4c7d39ee632cb53ff3eb40b25a4a5242";import{b as e,A as a}from"./lit-element-f5Al4X-s.js";import"./hp-settings-select-BcnSe7Ck.js";import{fd as s,fb as t,fc as l,fy as i,fz as r}from"./houseplan-card-DozY4ohB.js";import{a as o,s as c,j as n,i as u}from"./summary-shared-zRg3jp6v.js";import{l as m}from"./view-frame-DBoks50i.js";import"./ref-CpeNPJGk.js";import"./floating-surface-CIEjvwtH.js";import"./open-spans-ht11cvCf.js";import"./render-exact-FFKGkmh8.js";const d=d=>{const{host:p,dialog:b,problems:y,t:$}=d,h=o(p.hass?.states),v=b.draft.weather,f=e=>u(m(p.hass,p._config?.language),e),g=y.find(e=>"error"===e.kind),k=b.localShow!==b.baseLocalShow||!b.localOnly&&!s(t(b.draft),b.base),_=k&&!b.busy&&!g,w=e=>y.find(a=>a.path===e),S=e=>e?$(`summary.problem.${e.code}`):"",x=()=>d.close(),j=e`<label class="summary-switch hpf-toggle hpf-noicon" for="summary-local-show">
    <span class="hpf-toggle-title">${$("summary.show_local")}</span><span class="hpf-toggle-caption" id="summary-local-show-hint">${$("summary.show_local_hint")}</span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${b.localShow}
      ?disabled=${b.busy} aria-label=${$("summary.show_local")}
      aria-describedby="summary-local-show-hint"
      @change=${e=>d.setDialog({...b,localShow:e.target.checked})} /></label>`;return e`<hp-dialog .hass=${p.hass} data-kind="summary" class="ui-dialog" form-shell settings-layout compact style="--hp-dialog-wide-width:920px"
      .title=${$("summary.settings")} wide flex-content
      dismiss-on-scrim aria-busy=${String(b.busy)}
      @hp-close=${x}>
    <div class="body summary-editor hpf-form" @click=${()=>d.closeSource()}>
      ${b.localOnly?e`<p class="summary-local-hint hpf-hint">${$(b.localOnlyHint)}</p>`:a}
      <section class="summary-general hpf-card hpf-card-padded" aria-labelledby="summary-general-title">
        <h3 class="hpf-heading" id="summary-general-title">${$("summary.general_settings")}</h3>
        <div class="summary-general-grid">
        ${b.localOnly?a:e`<div class="summary-field hpf-field">
        <label class="hpf-label" for="summary-panel-title">${$("summary.panel_title")}</label>
        <input class="hpf-input" id="summary-panel-title" type="text" .value=${b.draft.title}
          ?disabled=${b.busy}
          data-summary-error=${String(b.attempted&&"title"===g?.path)}
          aria-invalid=${"error"===w("title")?.kind?"true":"false"}
          @input=${e=>d.mutate(a=>{a.title=e.target.value})} />
        ${w("title")?e`<div class="summary-problem hpf-error error">${S(w("title"))}</div>`:a}
        </div>`}
        ${j}
        ${b.localOnly?a:e`<label class="summary-switch hpf-toggle hpf-noicon" for="summary-mobile-show">
          <span class="hpf-toggle-title">${$("summary.show_mobile")}</span><span class="hpf-toggle-caption" id="summary-mobile-show-hint">${$("summary.show_mobile_hint")}</span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${b.draft.show_on_mobile} ?disabled=${!b.localShow||b.busy}
          aria-label=${$("summary.show_mobile")} aria-describedby="summary-mobile-show-hint"
          @change=${e=>d.mutate(a=>{a.show_on_mobile=e.target.checked})} /></label>`}
        </div>
        ${b.localOnly?a:e`<div class="summary-weather-settings hpf-divider-before">
          <div class="summary-weather-setting-row">
            <label class="hpf-check"><input type="checkbox" data-hp="field" data-field="summary-weather-enabled"
              aria-label=${f("show")} .checked=${!0===v?.enabled} ?disabled=${b.busy}
              @change=${e=>d.mutate(a=>{const s=e.target.checked;a.weather={...a.weather,enabled:s,...!a.weather?.entity_id&&s&&1===h.length?{entity_id:h[0].id}:{}}})}><span>${f("show")}</span></label>
            ${v?.enabled&&(h.length>1||v.entity_id&&!h.some(e=>e.id===v.entity_id))?e`<hp-settings-select><select class="hpf-select" data-hp="field" data-field="summary-weather-entity"
                  aria-label=${f("source")} .value=${v.entity_id||""} ?disabled=${b.busy}
                  @change=${e=>d.mutate(a=>{const s=e.target.value;a.weather={enabled:!0,...s?{entity_id:s}:{}}})}>
                  <option value="" ?selected=${!v.entity_id}>${f("choose")}</option>
                  ${v.entity_id&&!h.some(e=>e.id===v.entity_id)?e`<option value=${v.entity_id} selected>${f("removed")} · ${v.entity_id}</option>`:a}
                  ${h.map(a=>e`<option value=${a.id} ?selected=${a.id===v.entity_id}>${a.name} · ${a.id}</option>`)}
                </select></hp-settings-select>`:a}
          </div>
          ${v?.enabled&&!h.length?e`<p class="hpf-hint">${f("no_source")}</p>`:a}
          ${w("weather.entity_id")?e`<p class="hpf-hint">${S(w("weather.entity_id"))}</p>`:a}
        </div>`}
        ${d.storageUnavailable?e`<div class="summary-problem hpf-note-warning warning">${$("summary.storage_unavailable")}</div>`:a}
      </section>
      ${b.localOnly?a:e`
        <section class="summary-blocks-card hpf-card hpf-card-padded" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 class="hpf-heading" id="summary-blocks-title">${$("summary.blocks")}</h3>
            <p>${$("summary.blocks_hint")}</p></div>
          <span class="summary-block-count hpf-chip">${$("summary.block_count").replace("{count}",String(b.draft.blocks.length)).replace("{limit}","10")}</span>
        </header>
        <div class="summary-editor-blocks">
          ${b.draft.blocks.map((s,t)=>{const r=`blocks.${t}`,o=w(`${r}.scope`);return e`<article class="summary-editor-block hpf-reading-block"
                @dragover=${e=>e.preventDefault()}
                @drop=${e=>d.drop(e,`block:${t}`)}>
              <div class="summary-block-head hpf-chrome-group">
                <span class="summary-drag" draggable=${String(!b.busy)} title=${$("summary.drag")}
                  @dragstart=${e=>d.dragStart(e,`block:${t}`)}>${c("grip")}</span>
                <div class="summary-order">
                <button class="btn hpf-action-icon summary-icon-button" type="button" title=${$("summary.up")}
                  aria-label=${$("summary.up")} ?disabled=${0===t||b.busy}
                  @click=${()=>d.mutate(e=>{e.blocks=l(e.blocks,t,t-1)})}>${c("up")}</button>
                <button class="btn hpf-action-icon summary-icon-button" type="button" title=${$("summary.down")}
                  aria-label=${$("summary.down")}
                  ?disabled=${t===b.draft.blocks.length-1||b.busy}
                  @click=${()=>d.mutate(e=>{e.blocks=l(e.blocks,t,t+1)})}>${c("down")}</button>
                </div>
                <input class="hpf-input summary-block-title" type="text" .value=${s.title}
                  placeholder=${$("summary.block_title")} aria-label=${$("summary.block_title")}
                  ?disabled=${b.busy}
                  data-summary-error=${String(b.attempted&&g?.path===`${r}.title`)}
                  aria-invalid=${"error"===w(`${r}.title`)?.kind?"true":"false"}
                  @input=${e=>d.mutate(a=>{a.blocks[t].title=e.target.value})} />
                <button class="btn hpf-action-icon summary-icon-button summary-visibility hpf-action-toggle" type="button"
                  ?disabled=${b.busy} aria-pressed=${String(s.visible)}
                  title=${$(s.visible?"summary.hide_block":"summary.show_block")}
                  aria-label=${$(s.visible?"summary.hide_block":"summary.show_block")}
                  @click=${()=>d.mutate(e=>{e.blocks[t].visible=!e.blocks[t].visible})}>${c(s.visible?"eye":"eyeOff")}</button>
              ${w(`${r}.title`)?e`<div class="summary-problem hpf-error error summary-block-title-error">${S(w(`${r}.title`))}</div>`:a}
              <div class="summary-scope">
                <hp-settings-select><select class="hpf-select" .value=${s.scope.type} ?disabled=${b.busy}
                  aria-label=${$("summary.scope")}
                  @change=${e=>d.mutate(a=>{a.blocks[t].scope="space"===e.target.value?{type:"space",space_id:p._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===s.scope.type}>${$("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===s.scope.type}>${$("summary.scope_space")}</option>
                </select></hp-settings-select>
                ${"space"===s.scope.type?e`<hp-settings-select><select class="hpf-select" .value=${s.scope.space_id}
                  ?disabled=${b.busy} aria-label=${$("summary.scope_space")}
                  data-summary-error=${String(b.attempted&&g?.path===`${r}.scope`)}
                  aria-invalid=${"error"===o?.kind?"true":"false"}
                  @change=${e=>d.mutate(a=>{const s=a.blocks[t].scope;"space"===s.type&&(s.space_id=e.target.value)})}>
                ${p._model.some(e=>e.id===s.scope.space_id)?a:e`<option value=${s.scope.space_id} selected>${s.scope.space_id}</option>`}
                ${p._model.map(a=>e`<option value=${a.id}
                    ?selected=${a.id===s.scope.space_id}>${a.title}</option>`)}
                </select></hp-settings-select>`:a}
              </div>
              ${o?e`<div class="summary-problem summary-scope-problem ${"error"===o.kind?"hpf-error":"hpf-note-warning"} ${o.kind}">${S(o)}</div>`:a}
              </div>
              <div class="summary-block-body">
              <div class="summary-editor-values">
                ${s.values.map((i,o)=>{const u=`${r}.values.${o}`,m=w(`${u}.source`),p=d.sourceToken(i.source),y=b.activeSource?.blockId===s.id&&b.activeSource.valueId===i.id,h="system"===i.source.type?$(`summary.system.${i.source.key}`):i.source.entity_id?d.entityIndex.labels.get(i.source.entity_id)||i.source.entity_id:$("summary.select_source"),v="system"===i.source.type?$("summary.system_source"):i.source.entity_id,f=y?n(d.entityIndex,b.entityFilter):null,k="entity"===i.source.type&&!!i.source.entity_id&&!d.entityIndex.labels.has(i.source.entity_id),_=`${s.id}\n${i.id}`;return e`<div class="summary-editor-value hpf-reading-block"
                      @dragover=${e=>{e.preventDefault(),e.stopPropagation()}}
                      @drop=${e=>d.drop(e,`value:${t}:${o}`)}>
                      <span class="summary-drag" draggable=${String(!b.busy)} title=${$("summary.drag")}
                        @dragstart=${e=>d.dragStart(e,`value:${t}:${o}`)}>${c("grip")}</span>
                      <div class="summary-order">
                      <button class="btn hpf-action-icon summary-icon-button" type="button" title=${$("summary.up")}
                        aria-label=${$("summary.up")} ?disabled=${0===o||b.busy}
                        @click=${()=>d.mutate(e=>{e.blocks[t].values=l(e.blocks[t].values,o,o-1)})}>${c("up")}</button>
                      <button class="btn hpf-action-icon summary-icon-button" type="button" title=${$("summary.down")}
                        aria-label=${$("summary.down")}
                        ?disabled=${o===s.values.length-1||b.busy}
                        @click=${()=>d.mutate(e=>{e.blocks[t].values=l(e.blocks[t].values,o,o+1)})}>${c("down")}</button>
                      </div>
                      <div class="summary-value-label">
                        <input class="hpf-input" type="text" .value=${i.label} ?disabled=${b.busy}
                          placeholder=${$("summary.value_name")} aria-label=${$("summary.value_name")}
                          data-summary-error=${String(b.attempted&&g?.path===`${u}.label`)}
                          aria-invalid=${"error"===w(`${u}.label`)?.kind?"true":"false"}
                          @input=${e=>d.mutate(a=>{a.blocks[t].values[o].label=e.target.value})} />
                        ${w(`${u}.label`)?e`<div class="summary-problem hpf-error error">${S(w(`${u}.label`))}</div>`:a}
                      </div>
                    <div class="summary-source-field">
                    <button class="btn hpf-action-picker summary-source" type="button"
                      ?disabled=${b.busy}
                      data-summary-source-owner=${_}
                      data-summary-error=${String(b.attempted&&g?.path===`${u}.source`)}
                      aria-invalid=${"error"===m?.kind?"true":"false"}
                      aria-haspopup="listbox" aria-expanded=${y?"true":"false"}
                      @click=${e=>{e.stopPropagation(),y?d.closeSource():d.openSource(s.id,i.id)}}>
                      <span class="summary-source-caption hpf-action-caption"><strong>${h}</strong>
                        ${v?e`<small>${v}</small>`:a}</span>
                      ${c("chevron")}
                    </button>
                    ${y&&f?e`<div class="summary-source-picker hpf-panel"
                        @click=${e=>e.stopPropagation()}
                        @keydown=${e=>{"Escape"===e.key&&(e.preventDefault(),e.stopPropagation(),d.closeSource(!0))}}>
                      <label class="hpf-label">${$("summary.search_entities")}</label>
                      <input class="hpf-input" type="search" data-summary-picker-search
                        ?disabled=${b.busy}
                        aria-label=${$("summary.search_entities")} .value=${b.entityFilter}
                        @input=${e=>d.setDialog({...b,entityFilter:e.target.value})} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${$("summary.select_source")}>
                        <div class="summary-source-group hpf-labelrow">${$("summary.system_group")}</div>
                        ${["device_count","total_area","datetime"].map(a=>e`
                          <button class="btn hpf-action-option" type="button" role="option"
                            ?disabled=${b.busy}
                            aria-selected=${p===`system:${a}`?"true":"false"}
                            @click=${()=>d.setSource(s.id,i.id,`system:${a}`)}>
                            ${$(`summary.system.${a}`)}
                          </button>`)}
                        ${k?e`<div class="summary-source-group hpf-labelrow">${$("summary.current_source")}</div>
                          <button type="button" role="option" class="btn hpf-action-option hpf-action-warning broken" aria-selected="true"
                            ?disabled=${b.busy}
                            @click=${()=>d.setSource(s.id,i.id,p)}>
                            ${h}
                          </button>`:a}
                        <div class="summary-source-group hpf-labelrow">${$("summary.entities_group")}</div>
                        ${f.entries.map(a=>e`<button class="btn hpf-action-option" type="button" role="option"
                            ?disabled=${b.busy}
                            aria-selected=${p===`entity:${a.id}`?"true":"false"}
                            @click=${()=>d.setSource(s.id,i.id,`entity:${a.id}`)}>
                          <span>${a.label}</span><small>${a.id}</small>
                        </button>`)}
                        ${f.total?a:e`<div class="summary-empty hpf-hint">${$("summary.no_search_results")}</div>`}
                        ${f.truncated?e`<div class="summary-refine hpf-hint">${$("summary.refine_search")}</div>`:a}
                      </div>
                    </div>`:a}
                    ${m?e`<div class="summary-problem ${"error"===m.kind?"hpf-error":"hpf-note-warning"} ${m.kind}">${S(m)}</div>`:a}
                    </div>
                    <button class="btn danger hpf-action-icon summary-icon-button summary-value-remove" type="button"
                      title=${$("btn.delete")} aria-label=${$("btn.delete")} ?disabled=${b.busy}
                      @click=${()=>d.mutate(e=>{e.blocks[t].values.splice(o,1)})}>${c("close")}</button>
                  </div>`})}
                <button class="btn hpf-action-fill summary-add summary-add-value" type="button"
                  ?disabled=${s.values.length>=20||b.busy}
                  title=${s.values.length>=20?$("summary.limit_values"):""}
                  @click=${()=>d.mutate(e=>{e.blocks[t].values.push(i())})}>
                  ${c("plus")}${$("summary.add_value")}
                </button>
              </div>
              <footer class="summary-block-footer hpf-divider-before">
                <button class="btn danger summary-delete-block" type="button" ?disabled=${b.busy}
                  @click=${()=>d.deleteBlock(t)}>${$("summary.delete_block")}</button>
              </footer>
              </div>
            </article>`})}
        </div>
        <button class="btn summary-add summary-add-block" type="button"
          ?disabled=${b.draft.blocks.length>=10||b.busy}
          title=${b.draft.blocks.length>=10?$("summary.limit_blocks"):""}
          @click=${()=>d.mutate(e=>{e.blocks.push(r($))})}>
          ${c("plus")}${$("summary.add_block")}
        </button>
        </section>
        ${b.error?e`<div class="summary-problem hpf-error error" role="alert">${b.error}</div>`:a}
        ${b.conflict?e`<button class="btn ghost summary-reload" type="button"
          ?disabled=${b.busy} @click=${()=>d.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${$("summary.reload_current")}
        </button>`:a}
      `}
    </div>
    <div class="row summary-editor-footer" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${b.busy} @click=${x}>${$("btn.cancel")}</button>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${b.localOnly?!k||b.busy:!_}
        @click=${()=>d.save()}>${$("btn.save")}</button>
    </div>
  </hp-dialog>`};export{d as renderSummaryPanelEditor};
