globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="4c71ffc5d05d356ad51092fb72d0d4b399aaa26b182f3a714ffb32a569995bef";import{b as a,A as s}from"./houseplan-card-Cg17Cmu0.js";import{s as e,n as t,a as l,m as r,b as o,c as i,d as u}from"./summary-panel-runtime-loaded-Bm2iVqgf.js";const m=m=>{const{host:c,dialog:d,problems:n,t:b}=m,y=n.find(a=>"error"===a.kind),$=d.localShow!==d.baseLocalShow||!d.localOnly&&!e(t(d.draft),d.base),p=$&&!d.busy&&!y,v=a=>n.find(s=>s.path===a),h=a=>a?b(`summary.problem.${a.code}`):"",k=()=>m.close(),g=a`<label class="summary-switch" for="summary-local-show">
    <span class="summary-switch-caption"><strong>${b("summary.show_local")}</strong>
      <small id="summary-local-show-hint">${b("summary.show_local_hint")}</small></span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${d.localShow}
      ?disabled=${d.busy} aria-label=${b("summary.show_local")}
      aria-describedby="summary-local-show-hint"
      @change=${a=>m.setDialog({...d,localShow:a.target.checked})} /></label>`;return a`<hp-dialog .hass=${c.hass} data-kind="summary"
      .title=${b("summary.settings")} wide
      dismiss-on-scrim aria-busy=${String(d.busy)}
      @hp-close=${k}>
    <div class="body summary-editor" @click=${()=>m.closeSource()}>
      ${d.localOnly?a`<p class="summary-local-hint">${b(d.localOnlyHint)}</p>`:s}
      <section class="summary-general" aria-labelledby="summary-general-title">
        <h3 id="summary-general-title">${b("summary.general_settings")}</h3>
        <div class="summary-general-grid">
        ${d.localOnly?s:a`<div class="summary-field">
        <label for="summary-panel-title">${b("summary.panel_title")}</label>
        <input id="summary-panel-title" type="text" .value=${d.draft.title}
          ?disabled=${d.busy}
          data-summary-error=${String(d.attempted&&"title"===y?.path)}
          aria-invalid=${"error"===v("title")?.kind?"true":"false"}
          @input=${a=>m.mutate(s=>{s.title=a.target.value})} />
        ${v("title")?a`<div class="summary-problem error">${h(v("title"))}</div>`:s}
        </div>`}
        ${g}
        ${d.localOnly?s:a`<label class="summary-switch" for="summary-mobile-show">
          <span class="summary-switch-caption"><strong>${b("summary.show_mobile")}</strong>
            <small id="summary-mobile-show-hint">${b("summary.show_mobile_hint")}</small></span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${d.draft.show_on_mobile} ?disabled=${!d.localShow||d.busy}
          aria-label=${b("summary.show_mobile")} aria-describedby="summary-mobile-show-hint"
          @change=${a=>m.mutate(s=>{s.show_on_mobile=a.target.checked})} /></label>`}
        </div>
        ${m.storageUnavailable?a`<div class="summary-problem warning">${b("summary.storage_unavailable")}</div>`:s}
      </section>
      ${d.localOnly?s:a`
        <section class="summary-blocks-card" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 id="summary-blocks-title">${b("summary.blocks")}</h3>
            <p>${b("summary.blocks_hint")}</p></div>
          <span class="summary-block-count">${b("summary.block_count").replace("{count}",String(d.draft.blocks.length)).replace("{limit}","10")}</span>
        </header>
        <div class="summary-editor-blocks">
          ${d.draft.blocks.map((e,t)=>{const u=`blocks.${t}`,n=v(`${u}.scope`);return a`<article class="summary-editor-block"
                @dragover=${a=>a.preventDefault()}
                @drop=${a=>m.drop(a,`block:${t}`)}>
              <div class="summary-block-head">
                <span class="summary-drag" draggable=${String(!d.busy)} title=${b("summary.drag")}
                  @dragstart=${a=>m.dragStart(a,`block:${t}`)}>${l("grip")}</span>
                <div class="summary-order">
                <button class="summary-icon-button" type="button" title=${b("summary.up")}
                  aria-label=${b("summary.up")} ?disabled=${0===t||d.busy}
                  @click=${()=>m.mutate(a=>{a.blocks=r(a.blocks,t,t-1)})}>${l("up")}</button>
                <button class="summary-icon-button" type="button" title=${b("summary.down")}
                  aria-label=${b("summary.down")}
                  ?disabled=${t===d.draft.blocks.length-1||d.busy}
                  @click=${()=>m.mutate(a=>{a.blocks=r(a.blocks,t,t+1)})}>${l("down")}</button>
                </div>
                <input class="summary-block-title" type="text" .value=${e.title}
                  placeholder=${b("summary.block_title")} aria-label=${b("summary.block_title")}
                  ?disabled=${d.busy}
                  data-summary-error=${String(d.attempted&&y?.path===`${u}.title`)}
                  aria-invalid=${"error"===v(`${u}.title`)?.kind?"true":"false"}
                  @input=${a=>m.mutate(s=>{s.blocks[t].title=a.target.value})} />
                <button class="summary-icon-button summary-visibility" type="button"
                  ?disabled=${d.busy} aria-pressed=${String(e.visible)}
                  title=${b(e.visible?"summary.hide_block":"summary.show_block")}
                  aria-label=${b(e.visible?"summary.hide_block":"summary.show_block")}
                  @click=${()=>m.mutate(a=>{a.blocks[t].visible=!a.blocks[t].visible})}>${l(e.visible?"eye":"eyeOff")}</button>
              ${v(`${u}.title`)?a`<div class="summary-problem error summary-block-title-error">${h(v(`${u}.title`))}</div>`:s}
              <div class="summary-scope">
                <select .value=${e.scope.type} ?disabled=${d.busy}
                  aria-label=${b("summary.scope")}
                  @change=${a=>m.mutate(s=>{s.blocks[t].scope="space"===a.target.value?{type:"space",space_id:c._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===e.scope.type}>${b("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===e.scope.type}>${b("summary.scope_space")}</option>
                </select>
                ${"space"===e.scope.type?a`<select .value=${e.scope.space_id}
                  ?disabled=${d.busy} aria-label=${b("summary.scope_space")}
                  data-summary-error=${String(d.attempted&&y?.path===`${u}.scope`)}
                  aria-invalid=${"error"===n?.kind?"true":"false"}
                  @change=${a=>m.mutate(s=>{const e=s.blocks[t].scope;"space"===e.type&&(e.space_id=a.target.value)})}>
                ${c._model.some(a=>a.id===e.scope.space_id)?s:a`<option value=${e.scope.space_id} selected>${e.scope.space_id}</option>`}
                ${c._model.map(s=>a`<option value=${s.id}
                    ?selected=${s.id===e.scope.space_id}>${s.title}</option>`)}
                </select>`:s}
              </div>
              ${n?a`<div class="summary-problem summary-scope-problem ${n.kind}">${h(n)}</div>`:s}
              </div>
              <div class="summary-block-body">
              <div class="summary-editor-values">
                ${e.values.map((i,c)=>{const n=`${u}.values.${c}`,$=v(`${n}.source`),p=m.sourceToken(i.source),k=d.activeSource?.blockId===e.id&&d.activeSource.valueId===i.id,g="system"===i.source.type?b(`summary.system.${i.source.key}`):i.source.entity_id?m.entityIndex.labels.get(i.source.entity_id)||i.source.entity_id:b("summary.select_source"),_="system"===i.source.type?b("summary.system_source"):i.source.entity_id,f=k?o(m.entityIndex,d.entityFilter):null,w="entity"===i.source.type&&!!i.source.entity_id&&!m.entityIndex.labels.has(i.source.entity_id),S=`${e.id}\n${i.id}`;return a`<div class="summary-editor-value"
                      @dragover=${a=>{a.preventDefault(),a.stopPropagation()}}
                      @drop=${a=>m.drop(a,`value:${t}:${c}`)}>
                      <span class="summary-drag" draggable=${String(!d.busy)} title=${b("summary.drag")}
                        @dragstart=${a=>m.dragStart(a,`value:${t}:${c}`)}>${l("grip")}</span>
                      <div class="summary-order">
                      <button class="summary-icon-button" type="button" title=${b("summary.up")}
                        aria-label=${b("summary.up")} ?disabled=${0===c||d.busy}
                        @click=${()=>m.mutate(a=>{a.blocks[t].values=r(a.blocks[t].values,c,c-1)})}>${l("up")}</button>
                      <button class="summary-icon-button" type="button" title=${b("summary.down")}
                        aria-label=${b("summary.down")}
                        ?disabled=${c===e.values.length-1||d.busy}
                        @click=${()=>m.mutate(a=>{a.blocks[t].values=r(a.blocks[t].values,c,c+1)})}>${l("down")}</button>
                      </div>
                      <div class="summary-value-label">
                        <input type="text" .value=${i.label} ?disabled=${d.busy}
                          placeholder=${b("summary.value_name")} aria-label=${b("summary.value_name")}
                          data-summary-error=${String(d.attempted&&y?.path===`${n}.label`)}
                          aria-invalid=${"error"===v(`${n}.label`)?.kind?"true":"false"}
                          @input=${a=>m.mutate(s=>{s.blocks[t].values[c].label=a.target.value})} />
                        ${v(`${n}.label`)?a`<div class="summary-problem error">${h(v(`${n}.label`))}</div>`:s}
                      </div>
                    <div class="summary-source-field">
                    <button class="summary-source" type="button"
                      ?disabled=${d.busy}
                      data-summary-source-owner=${S}
                      data-summary-error=${String(d.attempted&&y?.path===`${n}.source`)}
                      aria-invalid=${"error"===$?.kind?"true":"false"}
                      aria-haspopup="listbox" aria-expanded=${k?"true":"false"}
                      @click=${a=>{a.stopPropagation(),k?m.closeSource():m.openSource(e.id,i.id)}}>
                      <span class="summary-source-caption"><strong>${g}</strong>
                        ${_?a`<small>${_}</small>`:s}</span>
                      ${l("chevron")}
                    </button>
                    ${k&&f?a`<div class="summary-source-picker"
                        @click=${a=>a.stopPropagation()}
                        @keydown=${a=>{"Escape"===a.key&&(a.preventDefault(),a.stopPropagation(),m.closeSource(!0))}}>
                      <label>${b("summary.search_entities")}</label>
                      <input type="search" data-summary-picker-search
                        ?disabled=${d.busy}
                        aria-label=${b("summary.search_entities")} .value=${d.entityFilter}
                        @input=${a=>m.setDialog({...d,entityFilter:a.target.value})} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${b("summary.select_source")}>
                        <div class="summary-source-group">${b("summary.system_group")}</div>
                        ${["device_count","total_area","datetime"].map(s=>a`
                          <button type="button" role="option"
                            ?disabled=${d.busy}
                            aria-selected=${p===`system:${s}`?"true":"false"}
                            @click=${()=>m.setSource(e.id,i.id,`system:${s}`)}>
                            ${b(`summary.system.${s}`)}
                          </button>`)}
                        ${w?a`<div class="summary-source-group">${b("summary.current_source")}</div>
                          <button type="button" role="option" class="broken" aria-selected="true"
                            ?disabled=${d.busy}
                            @click=${()=>m.setSource(e.id,i.id,p)}>
                            ${g}
                          </button>`:s}
                        <div class="summary-source-group">${b("summary.entities_group")}</div>
                        ${f.entries.map(s=>a`<button type="button" role="option"
                            ?disabled=${d.busy}
                            aria-selected=${p===`entity:${s.id}`?"true":"false"}
                            @click=${()=>m.setSource(e.id,i.id,`entity:${s.id}`)}>
                          <span>${s.label}</span><small>${s.id}</small>
                        </button>`)}
                        ${f.total?s:a`<div class="summary-empty">${b("summary.no_search_results")}</div>`}
                        ${f.truncated?a`<div class="summary-refine">${b("summary.refine_search")}</div>`:s}
                      </div>
                    </div>`:s}
                    ${$?a`<div class="summary-problem ${$.kind}">${h($)}</div>`:s}
                    </div>
                    <button class="summary-icon-button summary-value-remove" type="button"
                      title=${b("btn.delete")} aria-label=${b("btn.delete")} ?disabled=${d.busy}
                      @click=${()=>m.mutate(a=>{a.blocks[t].values.splice(c,1)})}>${l("close")}</button>
                  </div>`})}
                <button class="summary-add summary-add-value" type="button"
                  ?disabled=${e.values.length>=20||d.busy}
                  title=${e.values.length>=20?b("summary.limit_values"):""}
                  @click=${()=>m.mutate(a=>{a.blocks[t].values.push(i())})}>
                  ${l("plus")}${b("summary.add_value")}
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
          @click=${()=>m.mutate(a=>{a.blocks.push(u(b))})}>
          ${l("plus")}${b("summary.add_block")}
        </button>
        </section>
        ${d.error?a`<div class="summary-problem error" role="alert">${d.error}</div>`:s}
        ${d.conflict?a`<button class="btn ghost summary-reload" type="button"
          ?disabled=${d.busy} @click=${()=>m.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${b("summary.reload_current")}
        </button>`:s}
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
