<<<<<<< HEAD:custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-Cw68F8HP.js
<<<<<<< HEAD:custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-GJ38Op_d.js
<<<<<<< HEAD:custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-CIcTVu4w.js
<<<<<<<< HEAD:custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-CnjofBa1.js
globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="ae7c8e5f4037f7411ca44d300e7144531a4d1459ed32af8cb65818605449bfea";import{l as t,aS as s,A as e,t as o,c as a,cf as l,cg as i,ch as h,ci as c,aP as n,cj as r,co as p,ck as d,cl as _,cm as u,cn as g,df as m,aO as b,aQ as $,dg as v}from"./houseplan-card-BSrM0Lhk.js";import{i as f,c as y,e as w,r as D,a as k,b as S,d as C,t as M}from"./backdrop-pick-DZzpEyIT.js";const F=1e3,x=t=>{if(!t.trim())return null;const s=Number(t.replace(",","."));return Number.isFinite(s)?s:null},T="ae7c8e5f4037f7411ca44d300e7144531a4d1459ed32af8cb65818605449bfea";class L{constructor(t){this.host=t,this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:t?.plans||[],savedBusy:!1})}catch(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}}}_help(l){const i=`${l}.aria`,h=t(this.host.hass,this.host._config?.language);return s(h,l)&&s(h,i)?a`<hp-help data-help-key=${l}
========
globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="9cc5ce6d3f552668321875d6bbd7d4dea32b2ae365030a354e6d7910313c1f5d";import{l as t,aT as s,A as e,t as o,c as a,cg as l,ch as i,ci as h,cj as c,aQ as n,ck as r,cp as p,cl as d,cm as _,cn as u,co as g,dg as m,aP as b,aR as $,dh as v}from"./houseplan-card-7FEkn7sJ.js";import{i as f,c as y,e as w,r as D,a as k,b as S,d as C,t as M}from"./backdrop-pick-DTvxUUZe.js";const F=1e3,T=t=>{if(!t.trim())return null;const s=Number(t.replace(",","."));return Number.isFinite(s)?s:null},x="9cc5ce6d3f552668321875d6bbd7d4dea32b2ae365030a354e6d7910313c1f5d";class L{constructor(t){this.host=t,this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:t?.plans||[],savedBusy:!1})}catch(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}}}_help(l){const i=`${l}.aria`,h=t(this.host.hass,this.host._config?.language);return s(h,l)&&s(h,i)?a`<hp-help data-help-key=${l}
>>>>>>>> 3e3192f2 (fix: keep large-plan interactions off the full render path):custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-CIcTVu4w.js
      .text=${o(h,l)} .ariaLabel=${o(h,i)}></hp-help>`:e}_openSpaceDialog(t,s){if(!this.host._serverStorage||!this.host._serverCfg)return void this.host._showToast(this.host._t("toast.integration_missing"));if("edit"===t){const e=this.host._serverCfg.spaces.find(t=>t.id===s);if(!e)return;const o=l(e),a=e.settings?.custom_fill&&"object"==typeof e.settings.custom_fill?i(e.settings.custom_fill):null,p="none"===o.fill?{...a||h,a:0}:a;return void(this.host._spaceDialog={mode:t,spaceId:s,title:e.title,planUrl:e.plan_url||null,planFile:null,source:e.plan_url?"file":"draw",showBorders:o.showBorders,showNames:o.showNames,zeroWallStyle:r(e),displayTouched:!0,hideDecor:o.hideDecor,hideOpenings:o.hideOpenings,roomColor:o.color,roomOpacity:o.opacity,fillMode:"none"===o.fill?"custom":o.fill,customFill:p,glowEnabled:o.glow,bgColor:o.bgColor,bgMode:"static"===e.settings?.bg_mode||"daynight"===e.settings?.bg_mode?e.settings.bg_mode:null,northDeg:n({},e.settings),sunRays:"boolean"==typeof e.settings?.sun_rays?e.settings.sun_rays:null,tempMin:o.tempMin,tempMax:o.tempMax,showLqi:o.showLqi??this.host._config?.show_signal??!0,cardFontScale:o.cardFontScale,labelTemp:o.labelTemp,labelHum:o.labelHum,labelLqi:o.labelLqi,labelLight:o.labelLight,cellCm:Number(e.cell_cm)>0?Number(e.cell_cm):5,cellCmInput:c(Number(e.cell_cm)>0?Number(e.cell_cm):5,this.host._imperial),cellCmTouched:!1,busy:!1})}const e=p(this.host._imperial);this.host._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,...f(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:g,roomOpacity:u,fillMode:"custom",customFill:{...h,a:0},glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:_,tempMax:d,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:e,cellCmInput:c(e,this.host._imperial),cellCmTouched:!1,busy:!1}}async _pickPlanFile(t){const s=t.target,e=s.files?.[0];if(!e||!this.host._spaceDialog)return;s.value="";const o=await y(e);if("reject"===o.kind)return void this.host._showToast(this.host._t("toast.plan_formats"));if("guard"===o.kind)return void(this.host._backdropGuard=o.state);const a=await w(e,o.ext,e.name);this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:a})}_renderBackdropGuard(){return D(this.host,t=>{this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:t})},()=>{this.host._backdropGuard=null},this.host.hass)??e}_useServerPlan(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this.host._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let s=0;s<40;s++){const s=this.host._display(t);if(s){const e=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:0),e.onerror=()=>t(0),e.src=s}),o=this.host._spaceDialog;return o&&o.planUrl===t&&Number.isFinite(e)&&e>0?(this.host._spaceDialog={...o,savedAspect:e},e):0}if(await new Promise(t=>setTimeout(t,150)),this.host._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){const s=this.host._spaceDialog,e=s?.saved?.find(s=>s.name===t);if(!s||!e||e.used_by.length||e.url===s.planUrl)return;const o=await this.host._confirmDanger({key:"delete-plan",kind:"destructive",title:this.host._t("confirm.delete_plan_title"),message:this.host._t("confirm.delete_plan_body"),objectName:t,confirmLabel:this.host._t("btn.delete"),cancelLabel:this.host._t("btn.cancel")}),a=this.host._spaceDialog,l=a?.saved?.find(s=>s.name===t);if(o&&a&&l&&l.url===e.url&&l.modified===e.modified&&!l.used_by.length&&l.url!==a.planUrl)try{await this.host.hass.callWS({type:"houseplan/plans/delete",name:t});const s=this.host._spaceDialog;s?.saved&&(this.host._spaceDialog={...s,saved:s.saved.filter(s=>s.name!==t)})}catch(t){this.host._showToast(this.host._t("toast.plan_delete_failed",{err:this.host._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return a`<div class="savedplans muted">${this.host._t("space.loading")}</div>`;const s=t.saved||[];if(!s.length)return a`<div class="savedplans muted">${this.host._t("space.no_saved")}</div>`;return a`<div class="savedplans">
=======
globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="e41a5310d5f3fc04fbdfd0262a5176efe9ef37bfccec822ba8fe61abce72cfb2";import{l as t,aT as s,A as e,t as o,c as a,cg as l,ch as i,ci as h,cj as c,aQ as n,ck as r,cp as p,cl as d,cm as _,cn as u,co as g,dg as m,aP as b,aR as $,dh as f}from"./houseplan-card-DWJtraIS.js";import{i as v,c as y,e as w,r as D,a as k,b as S,d as C,t as M}from"./backdrop-pick-DIgi2Yuh.js";const F=1e3,T=t=>{if(!t.trim())return null;const s=Number(t.replace(",","."));return Number.isFinite(s)?s:null},x="e41a5310d5f3fc04fbdfd0262a5176efe9ef37bfccec822ba8fe61abce72cfb2";class L{constructor(t){this.host=t,this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:t?.plans||[],savedBusy:!1})}catch(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}}}_help(l){const i=`${l}.aria`,h=t(this.host.hass,this.host._config?.language);return s(h,l)&&s(h,i)?a`<hp-help data-help-key=${l}
      .text=${o(h,l)} .ariaLabel=${o(h,i)}></hp-help>`:e}_openSpaceDialog(t,s){if(!this.host._serverStorage||!this.host._serverCfg)return void this.host._showToast(this.host._t("toast.integration_missing"));if("edit"===t){const e=this.host._serverCfg.spaces.find(t=>t.id===s);if(!e)return;const o=l(e),a=e.settings?.custom_fill&&"object"==typeof e.settings.custom_fill?i(e.settings.custom_fill):null,p="none"===o.fill?{...a||h,a:0}:a;return void(this.host._spaceDialog={mode:t,spaceId:s,title:e.title,planUrl:e.plan_url||null,planFile:null,source:e.plan_url?"file":"draw",showBorders:o.showBorders,showNames:o.showNames,zeroWallStyle:r(e),displayTouched:!0,hideDecor:o.hideDecor,hideOpenings:o.hideOpenings,roomColor:o.color,roomOpacity:o.opacity,fillMode:"none"===o.fill?"custom":o.fill,customFill:p,glowEnabled:o.glow,bgColor:o.bgColor,bgMode:"static"===e.settings?.bg_mode||"daynight"===e.settings?.bg_mode?e.settings.bg_mode:null,northDeg:n({},e.settings),sunRays:"boolean"==typeof e.settings?.sun_rays?e.settings.sun_rays:null,tempMin:o.tempMin,tempMax:o.tempMax,showLqi:o.showLqi??this.host._config?.show_signal??!0,cardFontScale:o.cardFontScale,labelTemp:o.labelTemp,labelHum:o.labelHum,labelLqi:o.labelLqi,labelLight:o.labelLight,cellCm:Number(e.cell_cm)>0?Number(e.cell_cm):5,cellCmInput:c(Number(e.cell_cm)>0?Number(e.cell_cm):5,this.host._imperial),cellCmTouched:!1,busy:!1})}const e=p(this.host._imperial);this.host._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,...v(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:g,roomOpacity:u,fillMode:"custom",customFill:{...h,a:0},glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:_,tempMax:d,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:e,cellCmInput:c(e,this.host._imperial),cellCmTouched:!1,busy:!1}}async _pickPlanFile(t){const s=t.target,e=s.files?.[0];if(!e||!this.host._spaceDialog)return;s.value="";const o=await y(e);if("reject"===o.kind)return void this.host._showToast(this.host._t("toast.plan_formats"));if("guard"===o.kind)return void(this.host._backdropGuard=o.state);const a=await w(e,o.ext,e.name);this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:a})}_renderBackdropGuard(){return D(this.host,t=>{this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:t})},()=>{this.host._backdropGuard=null},this.host.hass)??e}_useServerPlan(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this.host._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let s=0;s<40;s++){const s=this.host._display(t);if(s){const e=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:0),e.onerror=()=>t(0),e.src=s}),o=this.host._spaceDialog;return o&&o.planUrl===t&&Number.isFinite(e)&&e>0?(this.host._spaceDialog={...o,savedAspect:e},e):0}if(await new Promise(t=>setTimeout(t,150)),this.host._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){const s=this.host._spaceDialog,e=s?.saved?.find(s=>s.name===t);if(!s||!e||e.used_by.length||e.url===s.planUrl)return;const o=await this.host._confirmDanger({key:"delete-plan",kind:"destructive",title:this.host._t("confirm.delete_plan_title"),message:this.host._t("confirm.delete_plan_body"),objectName:t,confirmLabel:this.host._t("btn.delete"),cancelLabel:this.host._t("btn.cancel")}),a=this.host._spaceDialog,l=a?.saved?.find(s=>s.name===t);if(o&&a&&l&&l.url===e.url&&l.modified===e.modified&&!l.used_by.length&&l.url!==a.planUrl)try{await this.host.hass.callWS({type:"houseplan/plans/delete",name:t});const s=this.host._spaceDialog;s?.saved&&(this.host._spaceDialog={...s,saved:s.saved.filter(s=>s.name!==t)})}catch(t){this.host._showToast(this.host._t("toast.plan_delete_failed",{err:this.host._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return a`<div class="savedplans muted">${this.host._t("space.loading")}</div>`;const s=t.saved||[];if(!s.length)return a`<div class="savedplans muted">${this.host._t("space.no_saved")}</div>`;return a`<div class="savedplans">
>>>>>>> 5ef300b8 (fix: satisfy render performance validation gates):custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-GJ38Op_d.js
=======
globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="c7dfd3e006eea5eee4423a8f33e89f71c11e8f34de9a6e05891f767097d7ff5d";import{l as t,aT as s,A as e,t as o,c as a,cg as l,ch as i,ci as h,cj as c,aQ as n,ck as r,cp as p,cl as d,cm as _,cn as u,co as g,dg as m,aP as b,aR as $,dh as v}from"./houseplan-card-Dc6_C1GY.js";import{i as f,c as y,e as w,r as D,a as k,b as S,d as C,t as M}from"./backdrop-pick-Z95eZVCu.js";const F=1e3,T=t=>{if(!t.trim())return null;const s=Number(t.replace(",","."));return Number.isFinite(s)?s:null},x="c7dfd3e006eea5eee4423a8f33e89f71c11e8f34de9a6e05891f767097d7ff5d";class L{constructor(t){this.host=t,this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:t?.plans||[],savedBusy:!1})}catch(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}}}_help(l){const i=`${l}.aria`,h=t(this.host.hass,this.host._config?.language);return s(h,l)&&s(h,i)?a`<hp-help data-help-key=${l}
      .text=${o(h,l)} .ariaLabel=${o(h,i)}></hp-help>`:e}_openSpaceDialog(t,s){if(!this.host._serverStorage||!this.host._serverCfg)return void this.host._showToast(this.host._t("toast.integration_missing"));if("edit"===t){const e=this.host._serverCfg.spaces.find(t=>t.id===s);if(!e)return;const o=l(e),a=e.settings?.custom_fill&&"object"==typeof e.settings.custom_fill?i(e.settings.custom_fill):null,p="none"===o.fill?{...a||h,a:0}:a;return void(this.host._spaceDialog={mode:t,spaceId:s,title:e.title,planUrl:e.plan_url||null,planFile:null,source:e.plan_url?"file":"draw",showBorders:o.showBorders,showNames:o.showNames,zeroWallStyle:r(e),displayTouched:!0,hideDecor:o.hideDecor,hideOpenings:o.hideOpenings,roomColor:o.color,roomOpacity:o.opacity,fillMode:"none"===o.fill?"custom":o.fill,customFill:p,glowEnabled:o.glow,bgColor:o.bgColor,bgMode:"static"===e.settings?.bg_mode||"daynight"===e.settings?.bg_mode?e.settings.bg_mode:null,northDeg:n({},e.settings),sunRays:"boolean"==typeof e.settings?.sun_rays?e.settings.sun_rays:null,tempMin:o.tempMin,tempMax:o.tempMax,showLqi:o.showLqi??this.host._config?.show_signal??!0,cardFontScale:o.cardFontScale,labelTemp:o.labelTemp,labelHum:o.labelHum,labelLqi:o.labelLqi,labelLight:o.labelLight,cellCm:Number(e.cell_cm)>0?Number(e.cell_cm):5,cellCmInput:c(Number(e.cell_cm)>0?Number(e.cell_cm):5,this.host._imperial),cellCmTouched:!1,busy:!1})}const e=p(this.host._imperial);this.host._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,...f(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:g,roomOpacity:u,fillMode:"custom",customFill:{...h,a:0},glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:_,tempMax:d,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:e,cellCmInput:c(e,this.host._imperial),cellCmTouched:!1,busy:!1}}async _pickPlanFile(t){const s=t.target,e=s.files?.[0];if(!e||!this.host._spaceDialog)return;s.value="";const o=await y(e);if("reject"===o.kind)return void this.host._showToast(this.host._t("toast.plan_formats"));if("guard"===o.kind)return void(this.host._backdropGuard=o.state);const a=await w(e,o.ext,e.name);this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:a})}_renderBackdropGuard(){return D(this.host,t=>{this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:t})},()=>{this.host._backdropGuard=null},this.host.hass)??e}_useServerPlan(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this.host._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let s=0;s<40;s++){const s=this.host._display(t);if(s){const e=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:0),e.onerror=()=>t(0),e.src=s}),o=this.host._spaceDialog;return o&&o.planUrl===t&&Number.isFinite(e)&&e>0?(this.host._spaceDialog={...o,savedAspect:e},e):0}if(await new Promise(t=>setTimeout(t,150)),this.host._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){const s=this.host._spaceDialog,e=s?.saved?.find(s=>s.name===t);if(!s||!e||e.used_by.length||e.url===s.planUrl)return;const o=await this.host._confirmDanger({key:"delete-plan",kind:"destructive",title:this.host._t("confirm.delete_plan_title"),message:this.host._t("confirm.delete_plan_body"),objectName:t,confirmLabel:this.host._t("btn.delete"),cancelLabel:this.host._t("btn.cancel")}),a=this.host._spaceDialog,l=a?.saved?.find(s=>s.name===t);if(o&&a&&l&&l.url===e.url&&l.modified===e.modified&&!l.used_by.length&&l.url!==a.planUrl)try{await this.host.hass.callWS({type:"houseplan/plans/delete",name:t});const s=this.host._spaceDialog;s?.saved&&(this.host._spaceDialog={...s,saved:s.saved.filter(s=>s.name!==t)})}catch(t){this.host._showToast(this.host._t("toast.plan_delete_failed",{err:this.host._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return a`<div class="savedplans muted">${this.host._t("space.loading")}</div>`;const s=t.saved||[];if(!s.length)return a`<div class="savedplans muted">${this.host._t("space.no_saved")}</div>`;return a`<div class="savedplans">
>>>>>>> c62e9a7e (fix: clear settled viewport compositing):custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-Cw68F8HP.js
      ${s.map(s=>{return a`
=======
globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="537e55810287e6afa5b2e28b6b9e88779660d0b34aa961863aac5d137a03339e";import{l as t,aT as s,A as e,t as a,c as o,cg as l,ch as i,ci as h,cj as c,aQ as n,ck as r,cp as p,cl as _,cm as d,cn as u,co as g,dg as m,aP as b,aR as $,dh as v}from"./houseplan-card-DQ_6nRYk.js";import{i as f,c as y,e as w,r as D,a as k,b as S,d as C,t as M}from"./backdrop-pick-B2OVWnva.js";const F=1e3,T=t=>{if(!t.trim())return null;const s=Number(t.replace(",","."));return Number.isFinite(s)?s:null},x="537e55810287e6afa5b2e28b6b9e88779660d0b34aa961863aac5d137a03339e";class L{constructor(t){this.host=t,this._toggleServerPlans=async()=>{const t=this.host._spaceDialog;if(t)if(t.pickSaved)this.host._spaceDialog={...t,pickSaved:!1};else{this.host._spaceDialog={...t,pickSaved:!0,savedBusy:!0};try{const t=await this.host.hass.callWS({type:"houseplan/plans/list"}),s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:t?.plans||[],savedBusy:!1})}catch(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,saved:[],savedBusy:!1}),this.host._showToast(this.host._t("toast.plans_list_failed",{err:this.host._errText(t)}))}}}}_help(l){const i=`${l}.aria`,h=t(this.host.hass,this.host._config?.language);return s(h,l)&&s(h,i)?o`<hp-help data-help-key=${l}
      .text=${a(h,l)} .ariaLabel=${a(h,i)}></hp-help>`:e}_openSpaceDialog(t,s){if(!this.host._serverStorage||!this.host._serverCfg)return void this.host._showToast(this.host._t("toast.integration_missing"));if("edit"===t){const e=this.host._serverCfg.spaces.find(t=>t.id===s);if(!e)return;const a=l(e),o=e.settings?.custom_fill&&"object"==typeof e.settings.custom_fill?i(e.settings.custom_fill):null,p="none"===a.fill?{...o||h,a:0}:o;return void(this.host._spaceDialog={mode:t,spaceId:s,title:e.title,planUrl:e.plan_url||null,planFile:null,source:e.plan_url?"file":"draw",showBorders:a.showBorders,showNames:a.showNames,zeroWallStyle:r(e),displayTouched:!0,hideDecor:a.hideDecor,hideOpenings:a.hideOpenings,roomColor:a.color,roomOpacity:a.opacity,fillMode:"none"===a.fill?"custom":a.fill,customFill:p,glowEnabled:a.glow,bgColor:a.bgColor,bgMode:"static"===e.settings?.bg_mode||"daynight"===e.settings?.bg_mode?e.settings.bg_mode:null,northDeg:n({},e.settings),sunRays:"boolean"==typeof e.settings?.sun_rays?e.settings.sun_rays:null,tempMin:a.tempMin,tempMax:a.tempMax,showLqi:a.showLqi??this.host._config?.show_signal??!0,cardFontScale:a.cardFontScale,labelTemp:a.labelTemp,labelHum:a.labelHum,labelLqi:a.labelLqi,labelLight:a.labelLight,cellCm:Number(e.cell_cm)>0?Number(e.cell_cm):5,cellCmInput:c(Number(e.cell_cm)>0?Number(e.cell_cm):5,this.host._imperial),cellCmTouched:!1,busy:!1})}const e=p(this.host._imperial);this.host._spaceDialog={mode:t,title:"",planUrl:null,planFile:null,...f(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:g,roomOpacity:u,fillMode:"custom",customFill:{...h,a:0},glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:d,tempMax:_,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:e,cellCmInput:c(e,this.host._imperial),cellCmTouched:!1,busy:!1}}async _pickPlanFile(t){const s=t.target,e=s.files?.[0];if(!e||!this.host._spaceDialog)return;s.value="";const a=await y(e);if("reject"===a.kind)return void this.host._showToast(this.host._t("toast.plan_formats"));if("guard"===a.kind)return void(this.host._backdropGuard=a.state);const o=await w(e,a.ext,e.name);this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:o})}_renderBackdropGuard(){return D(this.host,t=>{this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,planFile:t})},()=>{this.host._backdropGuard=null},this.host.hass)??e}_useServerPlan(t){const s=this.host._spaceDialog;s&&(this.host._spaceDialog={...s,planUrl:t,planFile:null,pickSaved:!1,savedAspect:void 0},this.host._aspectJob=this._readPlanAspect(t))}async _readPlanAspect(t){for(let s=0;s<40;s++){const s=this.host._display(t);if(s){const e=await new Promise(t=>{const e=new Image;e.onload=()=>t(e.naturalWidth&&e.naturalHeight?e.naturalWidth/e.naturalHeight:0),e.onerror=()=>t(0),e.src=s}),a=this.host._spaceDialog;return a&&a.planUrl===t&&Number.isFinite(e)&&e>0?(this.host._spaceDialog={...a,savedAspect:e},e):0}if(await new Promise(t=>setTimeout(t,150)),this.host._spaceDialog?.planUrl!==t)return 0}return 0}async _deleteServerPlan(t){const s=this.host._spaceDialog,e=s?.saved?.find(s=>s.name===t);if(!s||!e||e.used_by.length||e.url===s.planUrl)return;const a=await this.host._confirmDanger({key:"delete-plan",kind:"destructive",title:this.host._t("confirm.delete_plan_title"),message:this.host._t("confirm.delete_plan_body"),objectName:t,confirmLabel:this.host._t("btn.delete"),cancelLabel:this.host._t("btn.cancel")}),o=this.host._spaceDialog,l=o?.saved?.find(s=>s.name===t);if(a&&o&&l&&l.url===e.url&&l.modified===e.modified&&!l.used_by.length&&l.url!==o.planUrl)try{await this.host.hass.callWS({type:"houseplan/plans/delete",name:t});const s=this.host._spaceDialog;s?.saved&&(this.host._spaceDialog={...s,saved:s.saved.filter(s=>s.name!==t)})}catch(t){this.host._showToast(this.host._t("toast.plan_delete_failed",{err:this.host._errText(t)}))}}_renderServerPlans(t){if(t.savedBusy)return o`<div class="savedplans muted">${this.host._t("space.loading")}</div>`;const s=t.saved||[];if(!s.length)return o`<div class="savedplans muted">${this.host._t("space.no_saved")}</div>`;return o`<div class="savedplans">
      ${s.map(s=>{return o`
>>>>>>> d30c27df (fix: reconcile lightweight interaction frames):custom_components/houseplan/frontend/houseplan-assets/houseplan-onboarding-runtime-BNBXTjIo.js
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
    </div>`}async _saveConfigNow(){this.host._cfgEpoch++;try{await this.host._writeConfig()}catch(t){const s=t;throw s?.physicalGeometryRolledBack?await this.host._reloadRejectedPhysicalWrite():"conflict"===s?.code&&await this.host._reloadConfigOnly(),t}}async _saveSpaceDialog(){const t=this.host._spaceDialog;if(!t||t.busy||!t.title.trim())return;if("file"===t.source&&!t.planFile&&!t.planUrl)return void this.host._showToast(this.host._t("toast.plan_required"));const s="create"===t.mode&&0===(this.host._serverCfg?.spaces.length||0);this.host._spaceDialog={...t,busy:!0};try{const e="create"===t.mode?`s${Date.now().toString(36)}`:t.spaceId;let a=null;if("file"===t.source&&t.planFile){a={url:(await this.host.hass.callWS({type:"houseplan/plan/set",space_id:e,ext:t.planFile.ext,data:t.planFile.b64})).url,aspect:t.planFile.aspect}}let o=t.savedAspect||null;!a&&"file"===t.source&&t.planUrl&&!o&&this.host._aspectJob&&(o=await this.host._aspectJob||null);const l=this.host._serverCfg;let i=l.spaces.find(t=>t.id===e);if("create"===t.mode)i=k(e,t.title.trim()),l.spaces.push(i);else{if(!i)throw new Error(`space ${e} is gone from the config`);i.title=t.title.trim()}if(!i)throw new Error(`space ${e} is unavailable`);if(a?(i.plan_url=a.url,i.plan_aspect=a.aspect):"file"===t.source&&t.planUrl&&t.planUrl!==i.plan_url&&(i.plan_url=t.planUrl,i.plan_aspect=o),"draw"===t.source&&(i.plan_url=null,i.plan_aspect=null,delete i.plan_x,delete i.plan_y,delete i.plan_scale,delete i.plan_scale_x,delete i.plan_scale_y,delete i.plan_angle),i.settings={...i.settings||{},show_borders:t.showBorders,show_names:t.showNames,hide_decor:t.hideDecor||void 0,hide_openings:t.hideOpenings||void 0,room_color:t.roomColor,room_opacity:t.roomOpacity,bg_color:t.bgColor||void 0,bg_mode:t.bgMode||void 0,north_deg:t.northDeg??void 0,sun_rays:t.sunRays??void 0,fill_mode:t.fillMode,custom_fill:t.customFill||void 0,glow_enabled:t.glowEnabled,temp_min:Number.isFinite(t.tempMin)?Math.min(t.tempMin,t.tempMax):d,temp_max:Number.isFinite(t.tempMax)?Math.max(t.tempMin,t.tempMax):_,show_lqi:t.showLqi,card_font_scale:1!==t.cardFontScale?t.cardFontScale:void 0,label_temp:t.labelTemp,label_hum:t.labelHum,label_lqi:t.labelLqi,label_light:t.labelLight},i.zero_wall_style=t.zeroWallStyle,i.cell_cm=Number.isFinite(t.cellCm)&&t.cellCm>0?Math.max(.1,Math.min(F,t.cellCm)):5,await this._saveConfigNow(),this.host._spaceDialog=null,"create"===t.mode&&this.host._commitSpace(i.id),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._importQueue.length)this._openNextImport();else if(s||this.host._importTotal>0){const t=this.host._importTotal>0;this.host._importTotal=0,this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||this.host._space),await this.host._requestMode("plan"),this.host._tool="draw",this.host._path=[],this.host._cursorPt=null,this.host._primeDrawWallField(),this.host._showToast(this.host._t(s&&!t?"toast.space_added_onboard":"import.done"))}else this.host._showToast(this.host._t("create"===t.mode?"toast.space_added":"toast.space_saved")),"create"===t.mode&&("plan"!==this.host._mode?await this.host._requestMode("plan"):(this.host._tool="draw",this.host._path=[],this.host._cursorPt=null,this.host._primeDrawWallField(),this.host._saveNav()))}catch(t){const s=t;"conflict"!==s?.code&&await this.host._reloadConfigOnly(!0),this.host._spaceDialog&&(this.host._spaceDialog={...this.host._spaceDialog,busy:!1}),this.host._showToast(this.host._t("toast.error",{err:this.host._errText(t)}))}}async _deleteSpace(){const t=this.host._spaceDialog;if(!t||"edit"!==t.mode)return;const s=this.host._serverCfg;if(!s)return;const e=s.spaces.find(s=>s.id===t.spaceId);if(!e)return;const a=S(s,this.host._layout||{},t.spaceId||""),o=1===s.spaces.length&&s.spaces[0]?.id===t.spaceId;if(a.count&&!o)return void(this.host._spaceDialog={...t,deleteBlockers:a.count});const l=t.spaceId,i=await this.host._confirmDanger({key:"delete-space",kind:"destructive",title:this.host._t("confirm.delete_space_title"),message:this.host._t("confirm.delete_space_body"),objectName:e.title,confirmLabel:this.host._t("btn.delete"),cancelLabel:this.host._t("btn.cancel")}),h=this.host._spaceDialog,c=this.host._serverCfg;if(!i||!h||"edit"!==h.mode||h.busy||h.spaceId!==l||!c)return;if(!c.spaces.find(t=>t.id===l))return;const n=S(c,this.host._layout||{},l),r=1===c.spaces.length&&c.spaces[0]?.id===l;if(!n.count||r){this.host._spaceDialog={...h,deleteBlockers:0,busy:!0};try{this.host._saveConfigDebounced.pending()&&this.host._saveConfigDebounced.flush(),this.host._persistLayout.pending()&&this.host._persistLayout.flush(),await this.host._writeChain;const t=await this.host.hass.callWS({type:"houseplan/space/delete",space_id:l,expected_config_rev:this.host._cfgRev,expected_layout_rev:this.host._layoutRev}),[s,e]=await Promise.all([this.host.hass.callWS({type:"houseplan/config/get"}),this.host.hass.callWS({type:"houseplan/layout/get"})]);this.host._adoptStructuralResponses(s,e),this.host._cfgRev=t?.config_rev??this.host._cfgRev,this.host._layoutRev=t?.layout_rev??this.host._layoutRev,this.host._spaceDialog=null,this.host._space===l&&this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||""),this.host._regSignature="",this.host._maybeRebuildDevices(),this.host._showToast(this.host._t("toast.space_deleted"))}catch(t){const s=t;"conflict"!==s?.code&&"space_in_use"!==s?.code||await Promise.all([this.host._reloadConfigOnly(!0),this.host._reloadLayoutOnly()]);const e=this.host._serverCfg;if(this.host._spaceDialog&&e){const t=S(e,this.host._layout||{},l),s=1===e.spaces.length&&e.spaces[0]?.id===l;this.host._spaceDialog={...this.host._spaceDialog,busy:!1,deleteBlockers:s?0:t.count}}this.host._showToast(this.host._t("toast.delete_failed",{err:this.host._errText(t)}))}}else this.host._spaceDialog={...h,deleteBlockers:n.count}}_startImport(){const t=this.host._importDialog;if(!t)return;const s=t.floors.filter(t=>t.checked).map(t=>t.name);this.host._importDialog=null,s.length?(this.host._importQueue=s,this.host._importTotal=s.length,this._openNextImport()):this._openSpaceDialog("create")}_openNextImport(){const t=this.host._importQueue.shift();if(void 0===t)return;const s=p(this.host._imperial);this.host._spaceDialog={mode:"create",title:t,planUrl:null,planFile:null,...f(),hideDecor:!1,hideOpenings:!1,zeroWallStyle:"dashed",roomColor:g,roomOpacity:u,fillMode:"custom",customFill:null,glowEnabled:!0,bgColor:null,bgMode:"daynight",northDeg:null,sunRays:null,tempMin:d,tempMax:_,showLqi:this.host._config?.show_signal??!0,cardFontScale:1,labelTemp:!1,labelHum:!1,labelLqi:!1,labelLight:!1,cellCm:s,cellCmInput:c(s,this.host._imperial),cellCmTouched:!1,busy:!1}}_skipImport(){this.host._spaceDialog=null,this.host._importQueue.length?this._openNextImport():this.host._importTotal>0&&this.host._model.length&&(this.host._importTotal=0,this.host._commitSpace(this.host._serverCfg.spaces[0]?.id||this.host._space),this.host._requestMode("plan").then(()=>{this.host._showToast(this.host._t("import.done"))}))}_renderImportDialog(){const t=this.host._importDialog,s=t.floors.filter(t=>t.checked).length;return o`<hp-dialog .hass=${this.host.hass} .title=${this.host._t("import.title")}
      icon="mdi:home-floor-1" @hp-close=${()=>this.host._importDialog=null}>
        <div class="body">
          <div class="rhint">${this.host._t("import.hint")}</div>
          ${t.floors.map((s,a)=>o`<label class="floorrow">
            <input type="checkbox" .checked=${s.checked}
              @change=${e=>{const o=[...t.floors];o[a]={...s,checked:e.target.checked},this.host._importDialog={floors:o}}} />
            <span>${s.name}</span>
            ${null!=s.level?o`<span class="floorlvl">L${s.level}</span>`:e}
          </label>`)}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${()=>{this.host._importDialog=null,this._openSpaceDialog("create")}}>${this.host._t("import.manual")}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${()=>this._startImport()} ?disabled=${!s}>
            <ha-icon icon="mdi:import"></ha-icon>${this.host._t("import.start",{n:s})}
          </button>
        </div>
    </hp-dialog>`}_boolInput(t,s){return o`<input type="checkbox" .checked=${t}
      @change=${t=>s(t.target.checked)} />`}_rangeInput(t,s,e,a,l){return o`<input type="range" min=${t} max=${s} step=${e} .value=${String(a)}
      @input=${t=>l(Number(t.target.value))} />`}_renderSpaceDialog(){return this._renderSpaceDialogBody(this.host._spaceDialog)}_renderSpaceDialogBody(t){const s=this.host._importTotal>0&&"create"===t.mode?this.host._t("import.progress",{i:this.host._importTotal-this.host._importQueue.length,n:this.host._importTotal}):"",a=()=>{this.host._spaceDialog=null,this.host._importQueue=[],this.host._importTotal=0};return o`<hp-dialog .hass=${this.host.hass}
      .title=${`${"create"===t.mode?this.host._t("space.new"):this.host._t("space.header")}${s?` · ${s}`:""}`}
      icon="mdi:floor-plan" wide @hp-close=${a}>
        <div class="body">
          <label>${this.host._t("space.title_label")}</label>
          <input class="namein" type="text" placeholder=${this.host._t("space.title_ph")}
            .value=${t.title}
            @input=${s=>this.host._spaceDialog={...t,title:s.target.value}} />
          <label>${this.host._t("space.plan_label")}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"file"===t.source}
              @change=${()=>this.host._spaceDialog=C(t,"file")} />
            <span>${this.host._t("space.source_file")}</span>
          </label>
          ${"file"===t.source?o`<div class="planrow">
              ${t.planFile?o`<span class="planname">${t.planFile.name}</span>`:t.planUrl?o`<img class="planprev" src=${this.host._display(t.planUrl)}
                      alt=${this.host._t("space.plan_alt")} />`:o`<span class="planname muted">${this.host._t("space.no_plan")}</span>`}
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
            ${t.pickSaved?this._renderServerPlans(t):e}`:e}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${"draw"===t.source}
              @change=${()=>this.host._spaceDialog=C(t,"draw")} />
            <span>${this.host._t("space.source_draw")}</span>
          </label>

          <div class="helpfieldlabel">
            <label for="onboarding-space-cell-cm">${this.host._t("space.scale_label")}</label>
            ${this._help("space.cell_cm.help")}
          </div>
          <div class="colorrow">
            <input id="onboarding-space-cell-cm" class="namein tempin" type="number"
              min=${c(.1,this.host._imperial)}
              max=${c(F,this.host._imperial)}
              step="0.1"
              .value=${t.cellCmInput??c(t.cellCm,this.host._imperial)}
              @input=${s=>{const e=s.target.value,a=T(e),o=null==a?null:m(a,this.host._imperial);this.host._spaceDialog={...t,cellCmInput:e,cellCmTouched:!0,cellCm:null!=o&&o>0?Math.max(.1,Math.min(F,o)):t.cellCm}}} />
            <span class="opl">${this.host._t(this.host._imperial?"space.scale_unit_imperial":"space.scale_unit")}</span>
          </div>

          <label class="dispsection">${this.host._t("space.display_section")}</label>
          <label class="srcrow">
            ${this._boolInput(t.showBorders,s=>{this.host._spaceDialog=M(t,"showBorders",s)})}
            <span>${this.host._t("space.show_borders")}</span>
          </label>
          <div class="helpfieldlabel">
            <label for="onboarding-space-zero-wall-style">${this.host._t("space.zero_wall_style")}</label>
            ${this._help("space.zero_wall_style.help")}
          </div>
          <select id="onboarding-space-zero-wall-style" class="areasel" @change=${s=>{const e=s.target.value;this.host._spaceDialog={...t,zeroWallStyle:"solid"===e?"solid":"dashed"}}}>
            <option value="dashed" ?selected=${"dashed"===t.zeroWallStyle}>
              ${this.host._t("space.zero_wall_dashed")}
            </option>
            <option value="solid" ?selected=${"solid"===t.zeroWallStyle}>
              ${this.host._t("space.zero_wall_solid")}
            </option>
          </select>
          <label class="srcrow">
            ${this._boolInput(t.showNames,s=>{this.host._spaceDialog=M(t,"showNames",s)})}
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
          ${[["labelTemp","space.label_temp"],["labelHum","space.label_hum"],["labelLqi","space.label_lqi"],["labelLight","space.label_light"]].map(([s,e])=>o`<label class="srcrow">
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
          <div class="helpfieldlabel">
            <label for="onboarding-space-bg-mode">${this.host._t("space.bg_mode")}</label>
            ${this._help("space.bg_mode.help")}
          </div>
          <select id="onboarding-space-bg-mode" class="areasel" @change=${s=>{const e=s.target.value;this.host._spaceDialog={...t,bgMode:"static"===e||"daynight"===e?e:null}}}>
            <option value="" ?selected=${null===t.bgMode}>${this.host._t("space.sun_inherit")}</option>
            <option value="static" ?selected=${"static"===t.bgMode}>${this.host._t("gs.bg_static")}</option>
            <option value="daynight" ?selected=${"daynight"===t.bgMode}>${this.host._t("gs.bg_daynight")}</option>
          </select>
          ${"static"===(t.bgMode??b(this.host._settings,{}))?o`
            <div class="colorrow">
              <hp-color-opacity .label=${this.host._t("space.bg_color")}
                .pickerLabels=${this.host._colorPickerLabels}
                .color=${t.bgColor||$(this.host._settings,{bgColor:null})||this.host._stageBgHex()}
                .opacity=${1} .showOpacity=${!1}
                @hp-color-opacity-change=${s=>{this.host._spaceDialog={...t,bgColor:s.detail.color}}}></hp-color-opacity>
              ${t.bgColor?o`<button class="btn ghost" @click=${()=>{this.host._spaceDialog={...t,bgColor:null}}}>${this.host._t("space.bg_inherit")}</button>`:o`<span class="opl">${this.host._t("space.bg_inherited")}</span>`}
            </div>`:e}
          <div class="helpfieldlabel">
            <label for="onboarding-space-north">${this.host._t("space.north")}</label>
            ${this._help("space.north.help")}
          </div>
          <div class="colorrow">
            <input id="onboarding-space-north" class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this.host._t("space.sun_inherit")}
              .value=${null===t.northDeg?"":String(t.northDeg)}
              @input=${s=>{const e=s.target.value.trim(),a=""===e?null:Math.round(Number(e));this.host._spaceDialog={...t,northDeg:null!==a&&Number.isFinite(a)?Math.min(359,Math.max(0,a)):null}}} />
            <span class="opl">${null===t.northDeg?this.host._t("space.north_inherited",{v:null===n(this.host._settings,{})?"—":`${n(this.host._settings,{})}°`}):"°"}</span>
          </div>
          <label>${this.host._t("space.sun_rays")}</label>
          <select class="areasel" @change=${s=>{const e=s.target.value;this.host._spaceDialog={...t,sunRays:""===e?null:"1"===e}}}>
            <option value="" ?selected=${null===t.sunRays}>${this.host._t("space.sun_inherit")}</option>
            <option value="1" ?selected=${!0===t.sunRays}>${this.host._t("space.sun_on")}</option>
            <option value="0" ?selected=${!1===t.sunRays}>${this.host._t("space.sun_off")}</option>
          </select>
          <div class="helpfieldlabel">
            <span>${this.host._t("space.fill_label")}</span>
            ${this._help("space.fill_mode.help")}
          </div>
          ${v.map(t=>[t,`fill.${t}`]).map(([s,a])=>o`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${t.fillMode===s}
                @change=${()=>this.host._spaceDialog={...t,fillMode:s}} />
              <span>${this.host._t(a)}</span>
              ${"temp"===s&&"temp"===t.fillMode?o`<span class="temprange">
                <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMin)}
                  @input=${s=>{const e=T(s.target.value);null!=e&&(this.host._spaceDialog={...t,tempMin:e})}} />
                –
                <input class="namein tempin" type="number" step="0.5" .value=${String(t.tempMax)}
                  @input=${s=>{const e=T(s.target.value);null!=e&&(this.host._spaceDialog={...t,tempMax:e})}} /> °C
              </span>`:e}
            </label>
            ${"custom"===s&&"custom"===t.fillMode?o`
              <div class="colorrow gsrow">
                <span class="gsl">${this.host._t("space.custom_fill")}</span>
                <hp-color-opacity .label=${this.host._t("space.custom_fill")}
                  .opacityLabel=${this.host._t("space.opacity")}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${(t.customFill||h).c}
                  .opacity=${(t.customFill||h).a}
                  @hp-color-opacity-change=${s=>{this.host._spaceDialog={...t,customFill:{c:s.detail.color,a:s.detail.opacity}}}}></hp-color-opacity>
                ${t.customFill?o`<button class="btn ghost" type="button"
                  @click=${()=>this.host._spaceDialog={...t,customFill:null}}>
                  ${this.host._t("btn.reset")}</button>`:e}
              </div>`:e}`)}
          <label class="srcrow">
            ${this._boolInput(t.glowEnabled,s=>{this.host._spaceDialog={...t,glowEnabled:s}})}
            <span>${this.host._t("space.glow_enabled")}</span>
          </label>
          ${t.deleteBlockers?o`<div class="backuperror" role="alert">
            ${this.host._t("space.delete_blocked",{n:String(t.deleteBlockers)})}
          </div>`:e}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${"edit"===t.mode?o`<div class="dialog-action-group dialog-action-danger">
            <button class="btn danger" @click=${()=>this._deleteSpace()} ?disabled=${t.busy}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t("btn.delete")}
            </button>
          </div>`:e}
          <div class="dialog-action-group dialog-action-commit">
            ${this.host._importTotal>0&&"create"===t.mode?o`<button class="btn ghost" @click=${()=>this._skipImport()}>
                  ${this.host._t("btn.skip")}</button>`:e}
            <button class="btn ghost" @click=${a}>${this.host._t("btn.cancel")}</button>
            <button class="btn on" @click=${()=>this._saveSpaceDialog()}
              ?disabled=${!t.title.trim()||"file"===t.source&&!(t.planFile||t.planUrl)||t.busy}
              title=${"file"!==t.source||t.planFile||t.planUrl?"":this.host._t("title.need_plan")}>
              <ha-icon icon="mdi:check"></ha-icon>${t.busy?"…":this.host._t("btn.save")}
            </button>
          </div>
        </div>
    </hp-dialog>`}}export{L as HouseplanOnboardingRuntime,x as ONBOARDING_RUNTIME_FINGERPRINT};
