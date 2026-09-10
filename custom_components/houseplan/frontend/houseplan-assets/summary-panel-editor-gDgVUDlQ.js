globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="c8d5c166e30a11241ef32c7e1dc70368632e84c448524a8340494350ec4d5fca";import{b as a,A as e}from"./houseplan-card-DXAxXz4t.js";import{s,n as t,a as l,m as r,b as o,c as i,d as u}from"./summary-panel-runtime-loaded-Cdo93NMV.js";const m=m=>{const{host:c,dialog:d,problems:n,t:b}=m,y=n.find(a=>"error"===a.kind),$=d.localShow!==d.baseLocalShow||!d.localOnly&&!s(t(d.draft),d.base),p=$&&!d.busy&&!y,v=a=>n.find(e=>e.path===a),h=a=>a?b(`summary.problem.${a.code}`):"",k=()=>m.close(),g=a`<label class="summary-switch" for="summary-local-show">
    <span class="summary-switch-caption"><strong>${b("summary.show_local")}</strong>
      <small id="summary-local-show-hint">${b("summary.show_local_hint")}</small></span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${d.localShow}
      ?disabled=${d.busy} aria-label=${b("summary.show_local")}
      aria-describedby="summary-local-show-hint"
      @change=${a=>m.setDialog({...d,localShow:a.target.checked})} /></label>`;return a`<hp-dialog .hass=${c.hass} data-kind="summary"
      .title=${b("summary.settings")} wide flex-content
      dismiss-on-scrim aria-busy=${String(d.busy)}
      @hp-close=${k}>
    <div class="body summary-editor" @click=${()=>m.closeSource()}>
      ${d.localOnly?a`<p class="summary-local-hint">${b(d.localOnlyHint)}</p>`:e}
      <section class="summary-general" aria-labelledby="summary-general-title">
        <h3 id="summary-general-title">${b("summary.general_settings")}</h3>
        <div class="summary-general-grid">
        ${d.localOnly?e:a`<div class="summary-field">
        <label for="summary-panel-title">${b("summary.panel_title")}</label>
        <input id="summary-panel-title" type="text" .value=${d.draft.title}
          ?disabled=${d.busy}
          data-summary-error=${String(d.attempted&&"title"===y?.path)}
          aria-invalid=${"error"===v("title")?.kind?"true":"false"}
          @input=${a=>m.mutate(e=>{e.title=a.target.value})} />
        ${v("title")?a`<div class="summary-problem error">${h(v("title"))}</div>`:e}
        </div>`}
        ${g}
        ${d.localOnly?e:a`<label class="summary-switch" for="summary-mobile-show">
          <span class="summary-switch-caption"><strong>${b("summary.show_mobile")}</strong>
            <small id="summary-mobile-show-hint">${b("summary.show_mobile_hint")}</small></span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${d.draft.show_on_mobile} ?disabled=${!d.localShow||d.busy}
          aria-label=${b("summary.show_mobile")} aria-describedby="summary-mobile-show-hint"
          @change=${a=>m.mutate(e=>{e.show_on_mobile=a.target.checked})} /></label>`}
        </div>
        ${m.storageUnavailable?a`<div class="summary-problem warning">${b("summary.storage_unavailable")}</div>`:e}
      </section>
      ${d.localOnly?e:a`
        <section class="summary-blocks-card" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 id="summary-blocks-title">${b("summary.blocks")}</h3>
            <p>${b("summary.blocks_hint")}</p></div>
          <span class="summary-block-count">${b("summary.block_count").replace("{count}",String(d.draft.blocks.length)).replace("{limit}","10")}</span>
        </header>
        <div class="summary-editor-blocks">
          ${d.draft.blocks.map((s,t)=>{const u=`blocks.${t}`,n=v(`${u}.scope`);return a`<article class="summary-editor-block"
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
                <input class="summary-block-title" type="text" .value=${s.title}
                  placeholder=${b("summary.block_title")} aria-label=${b("summary.block_title")}
                  ?disabled=${d.busy}
                  data-summary-error=${String(d.attempted&&y?.path===`${u}.title`)}
                  aria-invalid=${"error"===v(`${u}.title`)?.kind?"true":"false"}
                  @input=${a=>m.mutate(e=>{e.blocks[t].title=a.target.value})} />
                <button class="summary-icon-button summary-visibility" type="button"
                  ?disabled=${d.busy} aria-pressed=${String(s.visible)}
                  title=${b(s.visible?"summary.hide_block":"summary.show_block")}
                  aria-label=${b(s.visible?"summary.hide_block":"summary.show_block")}
                  @click=${()=>m.mutate(a=>{a.blocks[t].visible=!a.blocks[t].visible})}>${l(s.visible?"eye":"eyeOff")}</button>
              ${v(`${u}.title`)?a`<div class="summary-problem error summary-block-title-error">${h(v(`${u}.title`))}</div>`:e}
              <div class="summary-scope">
                <select .value=${s.scope.type} ?disabled=${d.busy}
                  aria-label=${b("summary.scope")}
                  @change=${a=>m.mutate(e=>{e.blocks[t].scope="space"===a.target.value?{type:"space",space_id:c._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===s.scope.type}>${b("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===s.scope.type}>${b("summary.scope_space")}</option>
                </select>
                ${"space"===s.scope.type?a`<select .value=${s.scope.space_id}
                  ?disabled=${d.busy} aria-label=${b("summary.scope_space")}
                  data-summary-error=${String(d.attempted&&y?.path===`${u}.scope`)}
                  aria-invalid=${"error"===n?.kind?"true":"false"}
                  @change=${a=>m.mutate(e=>{const s=e.blocks[t].scope;"space"===s.type&&(s.space_id=a.target.value)})}>
                ${c._model.some(a=>a.id===s.scope.space_id)?e:a`<option value=${s.scope.space_id} selected>${s.scope.space_id}</option>`}
                ${c._model.map(e=>a`<option value=${e.id}
                    ?selected=${e.id===s.scope.space_id}>${e.title}</option>`)}
                </select>`:e}
              </div>
              ${n?a`<div class="summary-problem summary-scope-problem ${n.kind}">${h(n)}</div>`:e}
              </div>
              <div class="summary-block-body">
              <div class="summary-editor-values">
                ${s.values.map((i,c)=>{const n=`${u}.values.${c}`,$=v(`${n}.source`),p=m.sourceToken(i.source),k=d.activeSource?.blockId===s.id&&d.activeSource.valueId===i.id,g="system"===i.source.type?b(`summary.system.${i.source.key}`):i.source.entity_id?m.entityIndex.labels.get(i.source.entity_id)||i.source.entity_id:b("summary.select_source"),_="system"===i.source.type?b("summary.system_source"):i.source.entity_id,f=k?o(m.entityIndex,d.entityFilter):null,w="entity"===i.source.type&&!!i.source.entity_id&&!m.entityIndex.labels.has(i.source.entity_id),S=`${s.id}\n${i.id}`;return a`<div class="summary-editor-value"
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
                        ?disabled=${c===s.values.length-1||d.busy}
                        @click=${()=>m.mutate(a=>{a.blocks[t].values=r(a.blocks[t].values,c,c+1)})}>${l("down")}</button>
                      </div>
                      <div class="summary-value-label">
                        <input type="text" .value=${i.label} ?disabled=${d.busy}
                          placeholder=${b("summary.value_name")} aria-label=${b("summary.value_name")}
                          data-summary-error=${String(d.attempted&&y?.path===`${n}.label`)}
                          aria-invalid=${"error"===v(`${n}.label`)?.kind?"true":"false"}
                          @input=${a=>m.mutate(e=>{e.blocks[t].values[c].label=a.target.value})} />
                        ${v(`${n}.label`)?a`<div class="summary-problem error">${h(v(`${n}.label`))}</div>`:e}
                      </div>
                    <div class="summary-source-field">
                    <button class="summary-source" type="button"
                      ?disabled=${d.busy}
                      data-summary-source-owner=${S}
                      data-summary-error=${String(d.attempted&&y?.path===`${n}.source`)}
                      aria-invalid=${"error"===$?.kind?"true":"false"}
                      aria-haspopup="listbox" aria-expanded=${k?"true":"false"}
                      @click=${a=>{a.stopPropagation(),k?m.closeSource():m.openSource(s.id,i.id)}}>
                      <span class="summary-source-caption"><strong>${g}</strong>
                        ${_?a`<small>${_}</small>`:e}</span>
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
                        ${["device_count","total_area","datetime"].map(e=>a`
                          <button type="button" role="option"
                            ?disabled=${d.busy}
                            aria-selected=${p===`system:${e}`?"true":"false"}
                            @click=${()=>m.setSource(s.id,i.id,`system:${e}`)}>
                            ${b(`summary.system.${e}`)}
                          </button>`)}
                        ${w?a`<div class="summary-source-group">${b("summary.current_source")}</div>
                          <button type="button" role="option" class="broken" aria-selected="true"
                            ?disabled=${d.busy}
                            @click=${()=>m.setSource(s.id,i.id,p)}>
                            ${g}
                          </button>`:e}
                        <div class="summary-source-group">${b("summary.entities_group")}</div>
                        ${f.entries.map(e=>a`<button type="button" role="option"
                            ?disabled=${d.busy}
                            aria-selected=${p===`entity:${e.id}`?"true":"false"}
                            @click=${()=>m.setSource(s.id,i.id,`entity:${e.id}`)}>
                          <span>${e.label}</span><small>${e.id}</small>
                        </button>`)}
                        ${f.total?e:a`<div class="summary-empty">${b("summary.no_search_results")}</div>`}
                        ${f.truncated?a`<div class="summary-refine">${b("summary.refine_search")}</div>`:e}
                      </div>
                    </div>`:e}
                    ${$?a`<div class="summary-problem ${$.kind}">${h($)}</div>`:e}
                    </div>
                    <button class="summary-icon-button summary-value-remove" type="button"
                      title=${b("btn.delete")} aria-label=${b("btn.delete")} ?disabled=${d.busy}
                      @click=${()=>m.mutate(a=>{a.blocks[t].values.splice(c,1)})}>${l("close")}</button>
                  </div>`})}
                <button class="summary-add summary-add-value" type="button"
                  ?disabled=${s.values.length>=20||d.busy}
                  title=${s.values.length>=20?b("summary.limit_values"):""}
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
        ${d.error?a`<div class="summary-problem error" role="alert">${d.error}</div>`:e}
        ${d.conflict?a`<button class="btn ghost summary-reload" type="button"
          ?disabled=${d.busy} @click=${()=>m.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${b("summary.reload_current")}
        </button>`:e}
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
