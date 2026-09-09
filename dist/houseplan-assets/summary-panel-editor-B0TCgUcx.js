globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="70eab6df053a23d23990b71d010867944f5b11d2f5ce94f0ae4127415539d46c";import{b as e,A as t}from"./houseplan-card-Qyj7-UrB.js";import{s as a,n as s,m as l,a as o,b as i,c as r}from"./summary-panel-runtime-loaded-BgzYimug.js";const c=c=>{const{host:u,dialog:n,local:m,problems:d,t:p}=c,$=d.find(e=>"error"===e.kind),b=n.localShow!==n.baseLocalShow||!n.localOnly&&!a(s(n.draft),n.base),y=b&&!n.busy&&!$,v=e=>d.find(t=>t.path===e),h=e=>e?p(`summary.problem.${e.code}`):"",k=()=>c.close(),g=e`<label class="summary-switch"><input type="checkbox"
      .checked=${n.localShow}
      @change=${e=>c.setDialog({...n,localShow:e.target.checked})} />
    <span>${p("summary.show_local")}</span></label>`,_=e`<h3 class="summary-sizes-title">${p("summary.sizes_title")}</h3>
    <div class="summary-local-sizes">
      <div class="summary-size-field">
        <div><label for="summary-icon-scale">${p("kiosk.icon_scale")}</label>
          <output for="summary-icon-scale">${Math.round(100*m.icon_scale)}%</output></div>
        <input id="summary-icon-scale" type="range" min="50" max="300" step="5"
          .value=${String(Math.round(100*m.icon_scale))}
          @input=${e=>c.saveLocal({icon_scale:Number(e.target.value)/100})} />
      </div>
      <div class="summary-size-field">
        <div><label for="summary-font-scale">${p("kiosk.font_scale")}</label>
          <output for="summary-font-scale">${Math.round(100*m.font_scale)}%</output></div>
        <input id="summary-font-scale" type="range" min="50" max="300" step="5"
          .value=${String(Math.round(100*m.font_scale))}
          @input=${e=>c.saveLocal({font_scale:Number(e.target.value)/100})} />
      </div>
      <button class="btn ghost summary-size-reset" type="button"
        @click=${()=>c.saveLocal({icon_scale:1,font_scale:1})}>${p("gs.reset")}</button>
    </div>
    ${c.storageUnavailable?e`<div class="summary-problem warning">${p("summary.storage_unavailable")}</div>`:t}`;return e`<hp-dialog .hass=${u.hass} data-kind="summary"
      .title=${p("summary.settings")}
      icon="mdi:view-dashboard-outline" dismiss-on-scrim aria-busy=${String(n.busy)}
      @hp-close=${k}>
    <div class="body summary-editor" @click=${()=>c.closeSource()}>
      ${n.localOnly?e`<p class="rhint">${p(n.localOnlyHint)}</p>`:t}
      ${n.localOnly?e`${g}${_}`:e`
        <label>${p("summary.panel_title")}</label>
        <input type="text" .value=${n.draft.title}
          data-summary-error=${String(n.attempted&&"title"===$?.path)}
          aria-invalid=${"error"===v("title")?.kind?"true":"false"}
          @input=${e=>c.mutate(t=>{t.title=e.target.value})} />
        ${v("title")?e`<div class="summary-problem error">${h(v("title"))}</div>`:t}
        ${g}
        <label class="summary-switch"><input type="checkbox" .checked=${n.draft.show_on_mobile}
          @change=${e=>c.mutate(t=>{t.show_on_mobile=e.target.checked})} />
          <span>${p("summary.show_mobile")}</span></label>
        ${_}
        <div class="summary-editor-blocks">
          ${n.draft.blocks.map((a,s)=>{const r=`blocks.${s}`,m=v(`${r}.scope`);return e`<article class="summary-editor-block"
                @dragover=${e=>e.preventDefault()}
                @drop=${e=>c.drop(e,`block:${s}`)}>
              <div class="summary-editor-row summary-block-head">
                <span class="summary-drag" draggable="true" title=${p("summary.drag")}
                  @dragstart=${e=>c.dragStart(e,`block:${s}`)}>⋮⋮</span>
                <input type="text" .value=${a.title}
                  placeholder=${p("summary.block_title")}
                  data-summary-error=${String(n.attempted&&$?.path===`${r}.title`)}
                  @input=${e=>c.mutate(t=>{t.blocks[s].title=e.target.value})} />
                <button type="button" title=${p("summary.up")} ?disabled=${0===s}
                  @click=${()=>c.mutate(e=>{e.blocks=l(e.blocks,s,s-1)})}>↑</button>
                <button type="button" title=${p("summary.down")}
                  ?disabled=${s===n.draft.blocks.length-1}
                  @click=${()=>c.mutate(e=>{e.blocks=l(e.blocks,s,s+1)})}>↓</button>
                <button type="button" title=${p("btn.delete")}
                  @click=${()=>c.deleteBlock(s)}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
              </div>
              ${v(`${r}.title`)?e`<div class="summary-problem error">${h(v(`${r}.title`))}</div>`:t}
              <div class="summary-editor-row">
                <label class="summary-switch"><input type="checkbox" .checked=${a.visible}
                  @change=${e=>c.mutate(t=>{t.blocks[s].visible=e.target.checked})} />
                  <span>${p("summary.block_visible")}</span></label>
                <select .value=${a.scope.type}
                  @change=${e=>c.mutate(t=>{t.blocks[s].scope="space"===e.target.value?{type:"space",space_id:u._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===a.scope.type}>${p("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===a.scope.type}>${p("summary.scope_space")}</option>
                </select>
                ${"space"===a.scope.type?e`<select .value=${a.scope.space_id}
                  data-summary-error=${String(n.attempted&&$?.path===`${r}.scope`)}
                  @change=${e=>c.mutate(t=>{const a=t.blocks[s].scope;"space"===a.type&&(a.space_id=e.target.value)})}>
                ${u._model.some(e=>e.id===a.scope.space_id)?t:e`<option value=${a.scope.space_id} selected>${a.scope.space_id}</option>`}
                ${u._model.map(t=>e`<option value=${t.id}
                    ?selected=${t.id===a.scope.space_id}>${t.title}</option>`)}
                </select>`:t}
              </div>
              ${m?e`<div class="summary-problem ${m.kind}">${h(m)}</div>`:t}
              <div class="summary-editor-values">
                ${a.values.map((i,u)=>{const m=`${r}.values.${u}`,d=v(`${m}.source`),b=c.sourceToken(i.source),y=n.activeSource?.blockId===a.id&&n.activeSource.valueId===i.id,k="system"===i.source.type?p(`summary.system.${i.source.key}`):i.source.entity_id?`${c.entityIndex.labels.get(i.source.entity_id)||i.source.entity_id} — ${i.source.entity_id}`:p("summary.select_source"),g=y?o(c.entityIndex,n.entityFilter):null,_="entity"===i.source.type&&!!i.source.entity_id&&!c.entityIndex.labels.has(i.source.entity_id),f=`${a.id}\n${i.id}`;return e`<div class="summary-editor-value"
                      @dragover=${e=>{e.preventDefault(),e.stopPropagation()}}
                      @drop=${e=>c.drop(e,`value:${s}:${u}`)}>
                    <div class="summary-editor-row">
                      <span class="summary-drag" draggable="true" title=${p("summary.drag")}
                        @dragstart=${e=>c.dragStart(e,`value:${s}:${u}`)}>⋮⋮</span>
                      <input type="text" .value=${i.label}
                        placeholder=${p("summary.value_name")}
                        data-summary-error=${String(n.attempted&&$?.path===`${m}.label`)}
                        @input=${e=>c.mutate(t=>{t.blocks[s].values[u].label=e.target.value})} />
                      <button type="button" title=${p("summary.up")} ?disabled=${0===u}
                        @click=${()=>c.mutate(e=>{e.blocks[s].values=l(e.blocks[s].values,u,u-1)})}>↑</button>
                      <button type="button" title=${p("summary.down")} ?disabled=${u===a.values.length-1}
                        @click=${()=>c.mutate(e=>{e.blocks[s].values=l(e.blocks[s].values,u,u+1)})}>↓</button>
                      <button type="button" title=${p("btn.delete")}
                        @click=${()=>c.mutate(e=>{e.blocks[s].values.splice(u,1)})}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
                    </div>
                    ${v(`${m}.label`)?e`<div class="summary-problem error">${h(v(`${m}.label`))}</div>`:t}
                    <button class="summary-source" type="button"
                      data-summary-source-owner=${f}
                      data-summary-error=${String(n.attempted&&$?.path===`${m}.source`)}
                      aria-haspopup="listbox" aria-expanded=${y?"true":"false"}
                      @click=${e=>{e.stopPropagation(),y?c.closeSource():c.openSource(a.id,i.id)}}>
                      <span>${k}</span><ha-icon icon="mdi:chevron-down"></ha-icon>
                    </button>
                    ${y&&g?e`<div class="summary-source-picker"
                        @click=${e=>e.stopPropagation()}
                        @keydown=${e=>{"Escape"===e.key&&(e.preventDefault(),e.stopPropagation(),c.closeSource(!0))}}>
                      <label>${p("summary.search_entities")}</label>
                      <input type="search" data-summary-picker-search
                        aria-label=${p("summary.search_entities")} .value=${n.entityFilter}
                        @input=${e=>c.setDialog({...n,entityFilter:e.target.value})} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${p("summary.select_source")}>
                        <div class="summary-source-group">${p("summary.system_group")}</div>
                        ${["device_count","total_area","datetime"].map(t=>e`
                          <button type="button" role="option"
                            aria-selected=${b===`system:${t}`?"true":"false"}
                            @click=${()=>c.setSource(a.id,i.id,`system:${t}`)}>
                            ${p(`summary.system.${t}`)}
                          </button>`)}
                        ${_?e`<div class="summary-source-group">${p("summary.current_source")}</div>
                          <button type="button" role="option" class="broken" aria-selected="true"
                            @click=${()=>c.setSource(a.id,i.id,b)}>
                            ${k}
                          </button>`:t}
                        <div class="summary-source-group">${p("summary.entities_group")}</div>
                        ${g.entries.map(t=>e`<button type="button" role="option"
                            aria-selected=${b===`entity:${t.id}`?"true":"false"}
                            @click=${()=>c.setSource(a.id,i.id,`entity:${t.id}`)}>
                          <span>${t.label}</span><small>${t.id}</small>
                        </button>`)}
                        ${g.total?t:e`<div class="summary-empty">${p("summary.no_search_results")}</div>`}
                        ${g.truncated?e`<div class="summary-refine">${p("summary.refine_search")}</div>`:t}
                      </div>
                    </div>`:t}
                    ${d?e`<div class="summary-problem ${d.kind}">${h(d)}</div>`:t}
                  </div>`})}
                <button class="btn ghost summary-add" type="button"
                  ?disabled=${a.values.length>=20}
                  title=${a.values.length>=20?p("summary.limit_values"):""}
                  @click=${()=>c.mutate(e=>{e.blocks[s].values.push(i())})}>
                  <ha-icon icon="mdi:plus"></ha-icon>${p("summary.add_value")}
                </button>
              </div>
            </article>`})}
        </div>
        <button class="btn ghost summary-add" type="button"
          ?disabled=${n.draft.blocks.length>=10}
          title=${n.draft.blocks.length>=10?p("summary.limit_blocks"):""}
          @click=${()=>c.mutate(e=>{e.blocks.push(r(p))})}>
          <ha-icon icon="mdi:plus"></ha-icon>${p("summary.add_block")}
        </button>
        ${n.error?e`<div class="summary-problem error" role="alert">${n.error}</div>`:t}
        ${n.conflict?e`<button class="btn ghost summary-reload" type="button"
          ?disabled=${n.busy} @click=${()=>c.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${p("summary.reload_current")}
        </button>`:t}
      `}
    </div>
    <div class="row" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${n.busy} @click=${k}>${p("btn.cancel")}</button>
      <span class="spacer"></span>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${n.localOnly?!b||n.busy:!y}
        @click=${()=>c.save()}><ha-icon icon="mdi:check"></ha-icon>${p("btn.save")}</button>
    </div>
  </hp-dialog>`};export{c as renderSummaryPanelEditor};
