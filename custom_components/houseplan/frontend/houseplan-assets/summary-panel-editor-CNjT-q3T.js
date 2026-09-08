globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="e860fb1509e5f35c8441825424029d1cc533d50ee17ae22822d68ca34de168b5";import{b as e,A as t}from"./houseplan-card-BtecQ9In.js";import{s as a,n as s,m as l,a as o,b as i}from"./summary-panel-runtime-loaded-BYhUrst5.js";const r=r=>{const{host:c,dialog:n,local:u,problems:m,t:d}=r,p=m.find(e=>"error"===e.kind),$=n.localShow!==n.baseLocalShow||!n.localOnly&&!a(s(n.draft),n.base),b=$&&!n.busy&&!p,y=e=>m.find(t=>t.path===e),v=e=>e?d(`summary.problem.${e.code}`):"",h=Object.entries(c.hass?.states||{}).sort((e,t)=>{const a=String(e[1]?.attributes?.friendly_name||e[0]),s=String(t[1]?.attributes?.friendly_name||t[0]);return a.localeCompare(s)}),g=n.entityFilter.trim().toLocaleLowerCase(),_=g?h.filter(([e,t])=>`${e} ${t.attributes?.friendly_name||""}`.toLocaleLowerCase().includes(g)):h,k=()=>r.close(),f=e`<label class="summary-switch"><input type="checkbox"
      .checked=${n.localShow}
      @change=${e=>r.setDialog({...n,localShow:e.target.checked})} />
    <span>${d("summary.show_local")}</span></label>`,w=e`<h3 class="summary-sizes-title">${d("summary.sizes_title")}</h3>
    <div class="summary-local-sizes">
      <label>${d("kiosk.icon_scale")}</label>
      <input type="range" min="50" max="300" step="5"
        .value=${String(Math.round(100*u.icon_scale))}
        @input=${e=>r.saveLocal({icon_scale:Number(e.target.value)/100})} />
      <span>${Math.round(100*u.icon_scale)}%</span>
      <label>${d("kiosk.font_scale")}</label>
      <input type="range" min="50" max="300" step="5"
        .value=${String(Math.round(100*u.font_scale))}
        @input=${e=>r.saveLocal({font_scale:Number(e.target.value)/100})} />
      <span>${Math.round(100*u.font_scale)}%</span>
      <button class="btn ghost summary-size-reset" type="button"
        @click=${()=>r.saveLocal({icon_scale:1,font_scale:1})}>${d("gs.reset")}</button>
    </div>
    ${r.storageUnavailable?e`<div class="summary-problem warning">${d("summary.storage_unavailable")}</div>`:t}`;return e`<hp-dialog .hass=${c.hass} data-kind="summary"
      .title=${d("summary.settings")}
      icon="mdi:view-dashboard-outline" dismiss-on-scrim aria-busy=${String(n.busy)}
      @hp-close=${k}>
    <div class="body summary-editor">
      ${n.localOnly?e`<p class="rhint">${d(n.localOnlyHint)}</p>`:t}
      ${n.localOnly?e`${f}${w}`:e`
        <label>${d("summary.panel_title")}</label>
        <input type="text" .value=${n.draft.title}
          data-summary-error=${String(n.attempted&&"title"===p?.path)}
          aria-invalid=${"error"===y("title")?.kind?"true":"false"}
          @input=${e=>r.mutate(t=>{t.title=e.target.value})} />
        ${y("title")?e`<div class="summary-problem error">${v(y("title"))}</div>`:t}
        ${f}
        <label class="summary-switch"><input type="checkbox" .checked=${n.draft.show_on_mobile}
          @change=${e=>r.mutate(t=>{t.show_on_mobile=e.target.checked})} />
          <span>${d("summary.show_mobile")}</span></label>
        ${w}
        <label>${d("summary.search_entities")}</label>
        <input type="search" .value=${n.entityFilter}
          @input=${e=>r.setDialog({...n,entityFilter:e.target.value})} />
        ${_.length?t:e`<div class="summary-empty">${d("summary.no_search_results")}</div>`}
        <div class="summary-editor-blocks">
          ${n.draft.blocks.map((a,s)=>{const i=`blocks.${s}`,u=y(`${i}.scope`);return e`<article class="summary-editor-block"
                @dragover=${e=>e.preventDefault()}
                @drop=${e=>r.drop(e,`block:${s}`)}>
              <div class="summary-editor-row summary-block-head">
                <span class="summary-drag" draggable="true" title=${d("summary.drag")}
                  @dragstart=${e=>r.dragStart(e,`block:${s}`)}>⋮⋮</span>
                <input type="text" .value=${a.title}
                  placeholder=${d("summary.block_title")}
                  data-summary-error=${String(n.attempted&&p?.path===`${i}.title`)}
                  @input=${e=>r.mutate(t=>{t.blocks[s].title=e.target.value})} />
                <button type="button" title=${d("summary.up")} ?disabled=${0===s}
                  @click=${()=>r.mutate(e=>{e.blocks=l(e.blocks,s,s-1)})}>↑</button>
                <button type="button" title=${d("summary.down")}
                  ?disabled=${s===n.draft.blocks.length-1}
                  @click=${()=>r.mutate(e=>{e.blocks=l(e.blocks,s,s+1)})}>↓</button>
                <button type="button" title=${d("btn.delete")}
                  @click=${()=>r.deleteBlock(s)}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
              </div>
              ${y(`${i}.title`)?e`<div class="summary-problem error">${v(y(`${i}.title`))}</div>`:t}
              <div class="summary-editor-row">
                <label class="summary-switch"><input type="checkbox" .checked=${a.visible}
                  @change=${e=>r.mutate(t=>{t.blocks[s].visible=e.target.checked})} />
                  <span>${d("summary.block_visible")}</span></label>
                <select .value=${a.scope.type}
                  @change=${e=>r.mutate(t=>{t.blocks[s].scope="space"===e.target.value?{type:"space",space_id:c._space}:{type:"all"}})}>
                  <option value="all" ?selected=${"all"===a.scope.type}>${d("summary.scope_all")}</option>
                  <option value="space" ?selected=${"space"===a.scope.type}>${d("summary.scope_space")}</option>
                </select>
                ${"space"===a.scope.type?e`<select .value=${a.scope.space_id}
                  data-summary-error=${String(n.attempted&&p?.path===`${i}.scope`)}
                  @change=${e=>r.mutate(t=>{const a=t.blocks[s].scope;"space"===a.type&&(a.space_id=e.target.value)})}>
                ${c._model.some(e=>e.id===a.scope.space_id)?t:e`<option value=${a.scope.space_id} selected>${a.scope.space_id}</option>`}
                ${c._model.map(t=>e`<option value=${t.id}
                    ?selected=${t.id===a.scope.space_id}>${t.title}</option>`)}
                </select>`:t}
              </div>
              ${u?e`<div class="summary-problem ${u.kind}">${v(u)}</div>`:t}
              <div class="summary-editor-values">
                ${a.values.map((o,u)=>{const m=`${i}.values.${u}`,$=y(`${m}.source`),b=r.sourceToken(o.source);return e`<div class="summary-editor-value"
                      @dragover=${e=>{e.preventDefault(),e.stopPropagation()}}
                      @drop=${e=>r.drop(e,`value:${s}:${u}`)}>
                    <div class="summary-editor-row">
                      <span class="summary-drag" draggable="true" title=${d("summary.drag")}
                        @dragstart=${e=>r.dragStart(e,`value:${s}:${u}`)}>⋮⋮</span>
                      <input type="text" .value=${o.label}
                        placeholder=${d("summary.value_name")}
                        data-summary-error=${String(n.attempted&&p?.path===`${m}.label`)}
                        @input=${e=>r.mutate(t=>{t.blocks[s].values[u].label=e.target.value})} />
                      <button type="button" title=${d("summary.up")} ?disabled=${0===u}
                        @click=${()=>r.mutate(e=>{e.blocks[s].values=l(e.blocks[s].values,u,u-1)})}>↑</button>
                      <button type="button" title=${d("summary.down")} ?disabled=${u===a.values.length-1}
                        @click=${()=>r.mutate(e=>{e.blocks[s].values=l(e.blocks[s].values,u,u+1)})}>↓</button>
                      <button type="button" title=${d("btn.delete")}
                        @click=${()=>r.mutate(e=>{e.blocks[s].values.splice(u,1)})}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
                    </div>
                    ${y(`${m}.label`)?e`<div class="summary-problem error">${v(y(`${m}.label`))}</div>`:t}
                    <select class="summary-source" .value=${b}
                      data-summary-error=${String(n.attempted&&p?.path===`${m}.source`)}
                      @change=${e=>r.setSource(s,u,e.target.value)}>
                      <optgroup label=${d("summary.system_group")}>
                        <option value="system:device_count" ?selected=${"system:device_count"===b}>${d("summary.system.device_count")}</option>
                        <option value="system:total_area" ?selected=${"system:total_area"===b}>${d("summary.system.total_area")}</option>
                        <option value="system:datetime" ?selected=${"system:datetime"===b}>${d("summary.system.datetime")}</option>
                      </optgroup>
                      <optgroup label=${d("summary.entities_group")}>
                        ${"entity"!==o.source.type||o.source.entity_id?t:e`<option value="entity:" selected>${d("summary.select_source")}</option>`}
                        ${"entity"!==o.source.type||_.some(([e])=>e===o.source.entity_id)?t:e`<option value=${`entity:${o.source.entity_id}`} selected>${c.hass?.states?.[o.source.entity_id]?.attributes?.friendly_name||o.source.entity_id} — ${o.source.entity_id}</option>`}
                        ${_.map(([t,a])=>e`<option value=${`entity:${t}`}
                          ?selected=${b===`entity:${t}`}>
                          ${a.attributes?.friendly_name||t} — ${t}
                        </option>`)}
                      </optgroup>
                    </select>
                    ${$?e`<div class="summary-problem ${$.kind}">${v($)}</div>`:t}
                  </div>`})}
                <button class="btn ghost summary-add" type="button"
                  ?disabled=${a.values.length>=20}
                  title=${a.values.length>=20?d("summary.limit_values"):""}
                  @click=${()=>r.mutate(e=>{e.blocks[s].values.push(o())})}>
                  <ha-icon icon="mdi:plus"></ha-icon>${d("summary.add_value")}
                </button>
              </div>
            </article>`})}
        </div>
        <button class="btn ghost summary-add" type="button"
          ?disabled=${n.draft.blocks.length>=10}
          title=${n.draft.blocks.length>=10?d("summary.limit_blocks"):""}
          @click=${()=>r.mutate(e=>{e.blocks.push(i(d))})}>
          <ha-icon icon="mdi:plus"></ha-icon>${d("summary.add_block")}
        </button>
        ${n.error?e`<div class="summary-problem error" role="alert">${n.error}</div>`:t}
        ${n.conflict?e`<button class="btn ghost summary-reload" type="button"
          ?disabled=${n.busy} @click=${()=>r.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${d("summary.reload_current")}
        </button>`:t}
      `}
    </div>
    <div class="row" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${n.busy} @click=${k}>${d("btn.cancel")}</button>
      <span class="spacer"></span>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${n.localOnly?!$||n.busy:!b}
        @click=${()=>r.save()}><ha-icon icon="mdi:check"></ha-icon>${d("btn.save")}</button>
    </div>
  </hp-dialog>`};export{r as renderSummaryPanelEditor};
