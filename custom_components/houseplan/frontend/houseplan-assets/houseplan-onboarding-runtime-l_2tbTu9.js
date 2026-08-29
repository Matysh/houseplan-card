globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="0f7edde68a64b82e24b51acbb2ba3050dbe2684c43fd3cb3428ee481b9de3d0f";import{bT as t,bU as s,bV as e,bW as o,aq as a,bX as l,c0 as i,bY as h,bZ as c,b_ as n,b$ as r,A as p,b as _,cR as d,ap as u,ar as g,cS as m}from"./houseplan-card-DVfaouS8.js";import{i as b,c as $,e as v,r as f,a as y,b as w,s as D,t as S}from"./backdrop-pick-DIYZEnDX.js";const k=1e3,C=t=>{if(!t.trim())return null;const s=Number(t.replace(",","."));return Number.isFinite(s)?s:null},M="0f7edde68a64b82e24b51acbb2ba3050dbe2684c43fd3cb3428ee481b9de3d0f";class F{constructor(t){this.host=t,this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:t?.plans||[],savedBusy:!1})}catch(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}}}_openSpaceDialog(p,_){if(!this.host._serverStorage||!this.host._serverCfg)return void this.host._showToast(this.host._t("toast.integration_missing"));if("edit"===p){const i=this.host._serverCfg.spaces.find(t=>t.id===_);if(!i)return;const h=t(i),c=i.settings?.custom_fill&&"object"==typeof i.settings.custom_fill?s(i.settings.custom_fill):null,n="none"===h.fill?{...c||e,a:0}:c;return void(this.host._spaceDialog={mode:p,spaceId:_,title:i.title,planUrl:i.plan_url||null,planFile:null,source:i.plan_url?"file":"draw",showBorders:h.showBorders,showNames:h.showNames,zeroWallStyle:l(i),displayTouched:!0,hideDecor:h.hideDecor,hideOpenings:h.hideOpenings,roomColor:h.color,roomOpacity:h.opacity,fillMode:"none"===h.fill?"custom":h.fill,customFill:n,glowEnabled:h.glow,bgColor:h.bgColor,bgMode:"static"===i.settings?.bg_mode||"daynight"===i.settings?.bg_mode?i.settings.bg_mode:null,northDeg:a({},i.settings),sunRays:"boolean"==typeof i.settings?.sun_rays?i.settings.sun_rays:null,tempMin:h.tempMin,tempMax:h.tempMax,showLqi:h.showLqi??this.host._config?.show_signal??!0,cardFontScale:h.cardFontScale,labelTemp:h.labelTemp,labelHum:h.labelHum,labelLqi:h.labelLqi,labelLight:h.labelLight,cellCm:Number(i.cell_cm)>0?Number(i.cell_cm):5,cellCmInput:o(Number(i.cell_cm)>0?Number(i.cell_cm):5,this.host._imperial),cellCmTouched:!1,busy:!1})}const d=i(this.host._imperial);this.host._spaceDialog={mode:p,title:"",planUrl:null,planFile:null,...b(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:r,roomOpacity:n,fillMode:"custom",customFill:{...e,a:0},glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:c,tempMax:h,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:d,cellCmInput:o(d,this.host._imperial),cellCmTouched:!1,busy:!1}}async _pickPlanFile(t){const s=t.target,e=s.files?.[0];if(!e||!this.host._spaceDialog)return;s.value="";const o=await $(e);if("reject"===o.kind)return void this.host._showToast(this.host._t("toast.plan_formats"));if("guard"===o.kind)return void(this.host._backdropGuard=o.state);const a=await v(e,o.ext,e.name);this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:a})}_renderBackdropGuard(){return f(this.host,t=>{this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:t})},()=>{this.host._backdropGuard=null},this.host.hass)??p}_useServerPlan(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this.host._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let s=0;s<40;s++){const s=this.host._display(t);if(s){const e=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:0),e.onerror=()=>t(0),e.src=s}),o=this.host._spaceDialog;return o&&o.planUrl===t&&Number.isFinite(e)&&e>0?(this.host._spaceDialog={...o,savedAspect:e},e):0}if(await new Promise(t=>setTimeout(t,150)),this.host._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){if(confirm(this.host._t("confirm.delete_plan",{name:t})))try{await this.host.hass.callWS({type:"houseplan/plans/delete",name:t});const s=this.host._spaceDialog;s?.saved&&(this.host._spaceDialog={...s,saved:s.saved.filter(s=>s.name!==t)})}catch(t){this.host._showToast(this.host._t("toast.plan_delete_failed",{err:this.host._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return _`<div class="savedplans muted">${this.host._t("space.loading")}</div>`;const s=t.saved||[];if(!s.length)return _`<div class="savedplans muted">${this.host._t("space.no_saved")}</div>`;return _`<div class="savedplans">
      ${s.map(s=>{return _`
        <div class="savedplan ${s.url===t.planUrl?"cur":""}">
          <img src=${this.host._display(s.url)} alt="" loading="lazy" decoding="async" />
          <div class="savedmeta">
            <b>${s.name}</b>
            <span class="muted">${e=s.size,e>=1048576?`${(e/1048576).toFixed(1)} MB`:`${Math.round(e/1024)} KB`}${s.used_by.length?` · ${this.host._t("space.used_by",{list:s.used_by.join(", ")})}`:""}</span>
          </div>
          <button class="btn ghost" @click=${()=>this._useServerPlan(s.url)}
            ?disabled=${s.url===t.planUrl}>${this.host._t("btn.use")}</button>
          <button class="btn ghost danger"
            title=${s.used_by.length||s.url===t.planUrl?this.host._t("space.in_use"):this.host._t("btn.delete")}
            ?disabled=${s.used_by.length>0||s.url===t.planUrl}
            @click=${()=>this._deleteServerPlan(s.name)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>`;var e})}
    </div>`}async _saveConfigNow(){this.host._cfgEpoch++;try{await this.host._writeConfig()}catch(t){const s=t;throw s?.physicalGeometryRolledBack?await this.host._reloadRejectedPhysicalWrite():"conflict"===s?.code&&await this.host._reloadConfigOnly(),t}}async _saveSpaceDialog(){const t=this.host._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this.host._showToast(this.host._t("toast.plan_required"));const s="create"===t.mode&&0===(this.host._serverCfg?.spaces.length||0);this.host._spaceDialog={...t,busy:!0};try{const e="create"===t.mode?`s${Date.now().toString(36)}`:t.spaceId;let o=null;if("file"===t.source&&t.planFile){o={url:(await this.host.hass.callWS({type:"houseplan/plan/set",space_id:e,ext:t.planFile.ext,data:t.planFile.b64})).url,aspect:t.planFile.aspect}}let a=t.savedAspect||null;!o&&"file"===t.source&&t.planUrl&&!a&&this.host._aspectJob&&(a=await this.host._aspectJob||null);const l=this.host._serverCfg;let i=l.spaces.find(t=>t.id===e);if("create"===t.mode)i=y(e,t.title.trim()),l.spaces.push(i);else{if(!i)throw new Error(`space ${e} is gone from the config`);i.title=t.title.trim()}if(!i)throw new Error(`space ${e} is unavailable`);if(o?(i.plan_url=o.url,i.plan_aspect=o.aspect):"file"===t.source&&t.planUrl&&t.planUrl!==i.plan_url&&(i.plan_url=t.planUrl,i.plan_aspect=a),"draw"===t.source&&(i.plan_url=null,i.plan_aspect=null,delete i.plan_x,delete i.plan_y,delete i.plan_scale,delete i.plan_scale_x,delete i.plan_scale_y,delete i.plan_angle),i.settings={...i.settings||{},show_borders:t.showBorders,show_names:t.showNames,hide_decor:t.hideDecor||void 0,hide_openings:t.hideOpenings||void 0,room_color:t.roomColor,room_opacity:t.roomOpacity,bg_color:t.bgColor||void 0,bg_mode:t.bgMode||void 0,north_deg:t.northDeg??void 0,sun_rays:t.sunRays??void 0,fill_mode:t.fillMode,custom_fill:t.customFill||void 0,glow_enabled:t.glowEnabled,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):c,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):h,show_lqi:t.showLqi,card_font_scale:1!==t.cardFontScale?t.cardFontScale:void 0,label_temp:t.labelTemp,label_hum:t.labelHum,label_lqi:t.labelLqi,label_light:t.labelLight},i.zero_wall_style=t.zeroWallStyle,i.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?Math.max(.1,Math.min(k,t.cellCm)):5,await this._saveConfigNow(),this.host._spaceDialog=null,"create"===t.mode&&this.host._commitSpace(i.id),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._importQueue.length)this._openNextImport();else if(s||this.host._importTotal>0){const t=this.host._importTotal>0;this.host._importTotal=0,this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||this.host._space),await this.host._requestMode("plan"),this.host._tool="draw",this.host._path=[],this.host._cursorPt=null,this.host._primeDrawWallField(),this.host._showToast(this.host._t(s&&!t?"toast.space_added_onboard":"import.done"))}else this.host._showToast(this.host._t("create"===t.mode?"toast.space_added":"toast.space_saved")),"create"===t.mode&&("plan"!==this.host._mode?await this.host._requestMode("plan"):(this.host._tool="draw",this.host._path=[],this.host._cursorPt=null,this.host._primeDrawWallField(),this.host._saveNav()))}catch(t){const s=t;"conflict"!==s?.code&&await this.host._reloadConfigOnly(!0),this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}async _deleteSpace(){const t=this.host._spaceDialog;if(!t||"edit"!==t.mode)return;const s=this.host._serverCfg;if(!s)return;const e=s.spaces.find(s=>s.id===t.spaceId);if(!e)return;const o=w(s,this.host._layout||{},t.spaceId||""),a=1===s.spaces.length&&s.spaces[0]?.id===t.spaceId;if(!o.count||a){if(confirm(this.host._t("confirm.delete_space",{title:e.title}))){this.host._spaceDialog={...t,deleteBlockers:0,busy:!0};try{this.host._saveConfigDebounced.pending()&&this.host._saveConfigDebounced.flush(),this.host._persistLayout.pending()&&this.host._persistLayout.flush(),await this.host._writeChain;const s=await this.host.hass.callWS({type:"houseplan/space/delete",space_id:t.spaceId,expected_config_rev:this.host._cfgRev,expected_layout_rev:this.host._layoutRev}),[e,o]=await Promise.all([this.host.hass.callWS({type:"houseplan/config/get"}),this.host.hass.callWS({type:"houseplan/layout/get"})]);this.host._adoptStructuralResponses(e,o),this.host._cfgRev=s?.config_rev??this.host._cfgRev,this.host._layoutRev=s?.layout_rev??this.host._layoutRev,this.host._spaceDialog=null,this.host._space===t.spaceId&&this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||""),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._showToast(this.host._t("toast.space_deleted"))}catch(s){const e=s;"conflict"!==e?.code&&"space_in_use"!==e?.code||await Promise.all([this.host._reloadConfigOnly(!0),this.host._reloadLayoutOnly()]);const o=this.host._serverCfg;if(this.host._spaceDialog&&o){const s=w(o,this.host._layout||{},t.spaceId||""),e=1===o.spaces.length&&o.spaces[0]?.id===t.spaceId;this.host._spaceDialog={...this.host._spaceDialog,busy:!1,deleteBlockers:e?0:s.count}}this.host._showToast(this.host._t("toast.delete_failed",{err:this.host._errText(s)}))}}}else this.host._spaceDialog={...t,deleteBlockers:o.count}}_startImport(){const t=this.host._importDialog;if(!t)return;const s=t.floors.filter(t=>t.checked).map(t=>t.name);this.host._importDialog=null,s.length?(this.host._importQueue=s,this.host._importTotal=s.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this.host._importQueue.shift();if(void 0===t)return;const s=i(this.host._imperial);this.host._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,...b(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:r,roomOpacity:n,fillMode:"custom",customFill:null,glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:c,tempMax:h,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:s,cellCmInput:o(s,this.host._imperial),cellCmTouched:!1,busy:!1}}_skipImport(){this.host._spaceDialog=null,this.host._importQueue.length?this._openNextImport():this.host._importTotal>0&&this.host._model.length&&(this.host._importTotal=0,this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||this.host._space),this.host._requestMode("plan").then(()=>{this.host._showToast(this.host._t("import.done"))}))}_renderImportDialog(){const t=this.host._importDialog,s=t.floors.filter(t=>t.checked).length;return _`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("import.title")}
      icon="mdi:home-floor-1" @hp-close=${()=>this.host._importDialog=null}>
        <div class="body">
          <div class="rhint">${this.host._t("import.hint")}</div>
          ${t.floors.map((s,e)=>_`<label class="floorrow">
            <input type="checkbox" .checked=${s.checked}
              @change=${o=>{const a=[...t.floors];a[e]={...s,checked:o.target.checked},this.host._importDialog={floors:a}}} />
            <span>${s.name}</span>
            ${null!=s.level?_`<span class="floorlvl">L${s.level}</span>`:p}
          </label>`)}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>{this.host._importDialog=null,this._openSpaceDialog("create")}}>${this.host._t("import.manual")}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._startImport()} ?disabled=${!s}>
            <ha-icon icon="mdi:import"></ha-icon>${this.host._t("import.start",{n:s})}
          </button>
        </div>
    </hp-dialog>`}_boolInput(t,s){return _`<input type="checkbox" .checked=${t}
      @change=${t=>s(t.target.checked)} />`}_rangeInput(t,s,e,o,a){return _`<input type="range" min=${t} max=${s} step=${e} .value=${String(o)}
      @input=${t=>a(Number(t.target.value))} />`}_renderSpaceDialog(){return this._renderSpaceDialogBody(this.host._spaceDialog)}_renderSpaceDialogBody(t){const s=this.host._importTotal>0&&"create"===t.mode?this.host._t("import.progress",{i:this.host._importTotal-this.host._importQueue.length,n:this.host._importTotal}):"",l=()=>{this.host._spaceDialog=null,this.host._importQueue=[],this.host._importTotal=0};return _`<hp-dialog .hass=${this.host.hass}
      .title=${`${"create"===t.mode?this.host._t("space.new"):this.host._t("space.header")}${s?` · ${s}`:""}`}
      icon="mdi:floor-plan" wide @hp-close=${l}>
        <div class="body">
          <label>${this.host._t("space.title_label")}</label>
          <input class="namein" type="text" placeholder=${this.host._t("space.title_ph")}
            .value=${t.title}
            @input=${s=>this.host._spaceDialog={...t,title:s.target.value}} />
          <label>${this.host._t("space.plan_label")}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"file"===t.source}
              @change=${()=>this.host._spaceDialog=D(t,"file")} />
            <span>${this.host._t("space.source_file")}</span>
          </label>
          ${"file"===t.source?_`<div class="planrow">
              ${t.planFile?_`<span class="planname">${t.planFile.name}</span>`:t.planUrl?_`<img class="planprev" src=${this.host._display(t.planUrl)}
                      alt=${this.host._t("space.plan_alt")} />`:_`<span class="planname muted">${this.host._t("space.no_plan")}</span>`}
              <span class="fileupload">
                <button class="btn filebtn" type="button" @click=${t=>t.currentTarget.nextElementSibling?.click()}>
                  <ha-icon icon="mdi:upload"></ha-icon>${t.planUrl||t.planFile?this.host._t("btn.replace"):this.host._t("btn.upload")}
                </button>
                <input type="file" hidden
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                  @change=${t=>this._pickPlanFile(t)} />
              </span>
              <button class="btn ghost" @click=${this._toggleServerPlans}
                title=${this.host._t("space.pick_saved_hint")}>
                <ha-icon icon="mdi:folder-image"></ha-icon>${this.host._t("space.pick_saved")}
              </button>
            </div>
            ${t.pickSaved?this._renderServerPlans(t):p}`:p}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"draw"===t.source}
              @change=${()=>this.host._spaceDialog=D(t,"draw")} />
            <span>${this.host._t("space.source_draw")}</span>
          </label>

          <label>${this.host._t("space.scale_label")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number"
              min=${o(.1,this.host._imperial)}
              max=${o(k,this.host._imperial)}
              step="0.1"
              .value=${t.cellCmInput??o(t.cellCm,this.host._imperial)}
              @input=${s=>{const e=s.target.value,o=C(e),a=null==o?null:d(o,this.host._imperial);this.host._spaceDialog={...t,cellCmInput:e,cellCmTouched:!0,cellCm:null!=a&&a>0?Math.max(.1,Math.min(k,a)):t.cellCm}}} />
            <span class="opl">${this.host._t(this.host._imperial?"space.scale_unit_imperial":"space.scale_unit")}</span>
          </div>

          <label class="dispsection">${this.host._t("space.display_section")}</label>
          <label class="srcrow">
            ${this._boolInput(t.showBorders,s=>{this.host._spaceDialog=S(t,"showBorders",s)})}
            <span>${this.host._t("space.show_borders")}</span>
          </label>
          <label>${this.host._t("space.zero_wall_style")}</label>
          <select class="areasel" @change=${s=>{const e=s.target.value;this.host._spaceDialog={...t,zeroWallStyle:"solid"===e?"solid":"dashed"}}}>
            <option value="dashed" ?selected=${"dashed"===t.zeroWallStyle}>
              ${this.host._t("space.zero_wall_dashed")}
            </option>
            <option value="solid" ?selected=${"solid"===t.zeroWallStyle}>
              ${this.host._t("space.zero_wall_solid")}
            </option>
          </select>
          <div class="rhint">${this.host._t("space.zero_wall_help")}</div>
          <label class="srcrow">
            ${this._boolInput(t.showNames,s=>{this.host._spaceDialog=S(t,"showNames",s)})}
            <span>${this.host._t("space.show_names")}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(t.showLqi,s=>{this.host._spaceDialog={...t,showLqi:s}})}
            <span>${this.host._t("space.show_lqi")}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(t.hideDecor,s=>{this.host._spaceDialog={...t,hideDecor:s}})}
            <span>${this.host._t("space.hide_decor")}</span>
          </label>
          <div class="rhint">${this.host._t("space.hide_decor_tip")}</div>
          <label class="srcrow">
            ${this._boolInput(t.hideOpenings,s=>{this.host._spaceDialog={...t,hideOpenings:s}})}
            <span>${this.host._t("space.hide_openings")}</span>
          </label>
          <div class="rhint">${this.host._t("space.hide_openings_tip")}</div>
          <label class="dispsection">${this.host._t("space.roomcard_section")}</label>
          ${[["labelTemp","space.label_temp"],["labelHum","space.label_hum"],["labelLqi","space.label_lqi"],["labelLight","space.label_light"]].map(([s,e])=>_`<label class="srcrow">
            ${this._boolInput(t[s],e=>{this.host._spaceDialog={...t,[s]:e}})}
            <span>${this.host._t(e)}</span>
          </label>`)}
          <label>${this.host._t("space.card_font")}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50,300,5,Math.round(100*t.cardFontScale),s=>{this.host._spaceDialog={...t,cardFontScale:s/100}})}
            <span class="opv">${Math.round(100*t.cardFontScale)}%</span>
          </div>
          ${this.host._renderCardPreview(t.cardFontScale,1,1)}
          <div class="colorrow">
            <hp-color-opacity .label=${this.host._t("space.room_color")}
              .opacityLabel=${this.host._t("space.opacity")}
              .pickerLabels=${this.host._colorPickerLabels}
              .color=${t.roomColor} .opacity=${t.roomOpacity} .showOpacity=${!0}
              @hp-color-opacity-change=${s=>{this.host._spaceDialog={...t,roomColor:s.detail.color,roomOpacity:s.detail.opacity}}}></hp-color-opacity>
          </div>
          <label>${this.host._t("space.bg_mode")}</label>
          <select class="areasel" @change=${s=>{const e=s.target.value;this.host._spaceDialog={...t,bgMode:"static"===e||"daynight"===e?e:null}}}>
            <option value="" ?selected=${null===t.bgMode}>${this.host._t("space.sun_inherit")}</option>
            <option value="static" ?selected=${"static"===t.bgMode}>${this.host._t("gs.bg_static")}</option>
            <option value="daynight" ?selected=${"daynight"===t.bgMode}>${this.host._t("gs.bg_daynight")}</option>
          </select>
          ${"static"===(t.bgMode??u(this.host._settings,{}))?_`
            <div class="colorrow">
              <hp-color-opacity .label=${this.host._t("space.bg_color")}
                .pickerLabels=${this.host._colorPickerLabels}
                .color=${t.bgColor||g(this.host._settings,{bgColor:null})||this.host._stageBgHex()}
                .opacity=${1} .showOpacity=${!1}
                @hp-color-opacity-change=${s=>{this.host._spaceDialog={...t,bgColor:s.detail.color}}}></hp-color-opacity>
              ${t.bgColor?_`<button class="btn ghost" @click=${()=>{this.host._spaceDialog={...t,bgColor:null}}}>${this.host._t("space.bg_inherit")}</button>`:_`<span class="opl">${this.host._t("space.bg_inherited")}</span>`}
            </div>`:p}
          <label>${this.host._t("space.north")}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this.host._t("space.sun_inherit")}
              .value=${null===t.northDeg?"":String(t.northDeg)}
              @input=${s=>{const e=s.target.value.trim(),o=""===e?null:Math.round(Number(e));this.host._spaceDialog={...t,northDeg:null!==o&&Number.isFinite(o)?Math.min(359,Math.max(0,o)):null}}} />
            <span class="opl">${null===t.northDeg?this.host._t("space.north_inherited",{v:null===a(this.host._settings,{})?"—":`${a(this.host._settings,{})}°`}):"°"}</span>
          </div>
          <label>${this.host._t("space.sun_rays")}</label>
          <select class="areasel" @change=${s=>{const e=s.target.value;this.host._spaceDialog={...t,sunRays:""===e?null:"1"===e}}}>
            <option value="" ?selected=${null===t.sunRays}>${this.host._t("space.sun_inherit")}</option>
            <option value="1" ?selected=${!0===t.sunRays}>${this.host._t("space.sun_on")}</option>
            <option value="0" ?selected=${!1===t.sunRays}>${this.host._t("space.sun_off")}</option>
          </select>
          <label>${this.host._t("space.fill_label")}</label>
          ${m.map(t=>[t,`fill.${t}`]).map(([s,o])=>_`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===s}
                @change=${()=>this.host._spaceDialog={...t,fillMode:s}} />
              <span>${this.host._t(o)}</span>
              ${"temp"===s&&"temp"===t.fillMode?_`<span class="temprange">
                <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMin)}
                  @input=${s=>{const e=C(s.target.value);null!=e&&(this.host._spaceDialog={...t,tempMin:e})}} />
                –
                <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMax)}
                  @input=${s=>{const e=C(s.target.value);null!=e&&(this.host._spaceDialog={...t,tempMax:e})}} /> °C
              </span>`:p}
            </label>
            ${"custom"===s&&"custom"===t.fillMode?_`
              <div class="colorrow gsrow">
                <span class="gsl">${this.host._t("space.custom_fill")}</span>
                <hp-color-opacity .label=${this.host._t("space.custom_fill")}
                  .opacityLabel=${this.host._t("space.opacity")}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${(t.customFill||e).c}
                  .opacity=${(t.customFill||e).a}
                  @hp-color-opacity-change=${s=>{this.host._spaceDialog={...t,customFill:{c:s.detail.color,a:s.detail.opacity}}}}></hp-color-opacity>
                ${t.customFill?_`<button class="btn ghost" type="button"
                  @click=${()=>this.host._spaceDialog={...t,customFill:null}}>
                  ${this.host._t("btn.reset")}</button>`:p}
              </div>`:p}`)}
          <label class="srcrow">
            ${this._boolInput(t.glowEnabled,s=>{this.host._spaceDialog={...t,glowEnabled:s}})}
            <span>${this.host._t("space.glow_enabled")}</span>
          </label>
          ${t.deleteBlockers?_`<div class="backuperror" role="alert">
            ${this.host._t("space.delete_blocked",{n:String(t.deleteBlockers)})}
          </div>`:p}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${"edit"===t.mode?_`<div class="dialog-action-group dialog-action-danger">
            <button class="btn danger" @click=${()=>this._deleteSpace()} ?disabled=${t.busy}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
            </button>
          </div>`:p}
          <div class="dialog-action-group dialog-action-commit">
            ${this.host._importTotal>0&&"create"===t.mode?_`<button class="btn ghost" @click=${()=>this._skipImport()}>
                  ${this.host._t("btn.skip")}</button>`:p}
            <button class="btn ghost" @click=${l}>${this.host._t("btn.cancel")}</button>
            <button class="btn on" @click=${()=>this._saveSpaceDialog()}
              ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
              title=${"file"!==t.source||t.planFile||t.planUrl?"":this.host._t("title.need_plan")}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this.host._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}}export{F as HouseplanOnboardingRuntime,M as ONBOARDING_RUNTIME_FINGERPRINT};
