/** Device settings presentation; vacuum writes retain their existing boundaries. */
import {html,nothing,type TemplateResult} from 'lit';
import type {I18nKey} from '../i18n';
import type {ToolsI18nKey} from '../i18n/tools';
import type {HouseplanEditorRuntime} from '../houseplan-editor-runtime';
import {readVacTelemetry,vacTrailMode,vacRoomNameMatchCount,type VacSourceCandidate} from '../vacuum';
import {subst} from '../logic';
import {renderVacuumMapsSection} from './vacuum-maps-section';
import {renderVacuumPathDiagnostics} from './vacuum-path-diagnostics';
import {field,formCard,subsection,toggleRow, formSections, disclosure, actionHelp,
} from './form-kit';
import {settingsCopy} from './settings-copy';
import {saveVacuumDockRestart,vacuumDockRestartPending} from '../vacuum-dock-restart-write';
import {ecovacsSourceState,ecovacsSourceAllowed} from '../vacuum-ecovacs-client';
import { previewVacuumTrailStyle } from '../vacuum-trail-style';

export function renderVacuumSettingsSection(runtime:HouseplanEditorRuntime,dlg:NonNullable<HouseplanEditorRuntime['host']['_markerDialog']>,toolsT:(key:ToolsI18nKey)=>string):TemplateResult|typeof nothing {
    const {st}=settingsCopy(runtime.host);
    const help=(key:ToolsI18nKey,label:string)=>html`<hp-help instant .text=${toolsT(key)} .ariaLabel=${st('dialog.help_for',{name:label})}></hp-help>`;
    const dev = runtime.host._devices.find((x) => x.id === dlg.devId);
    if (!dev || !runtime.host._isVacDev(dev)) return nothing;
    const v = dev.marker?.vacuum || {};
    const trailStyle = previewVacuumTrailStyle(dev.id, v, dlg);
    const includeAllCameras = runtime.host._vacAllCamerasFor === dev.id;
    const resolution = runtime.host._vacSourceResolution(dev, includeAllCameras);
    const src = resolution.entityId;
    const selected = resolution.candidates.find((candidate) => candidate.entityId === src) || null;
    const allowed = !src || ecovacsSourceAllowed(runtime.host._planHass, src,
      dev.primary?.startsWith('vacuum.') ? dev.primary : (dev.entities || []).find(id => id.startsWith('vacuum.')) || null);
    const tele = src && allowed ? readVacTelemetry(runtime.host._planHass?.states[src]?.attributes) : null;
    const ecovacs = src?.startsWith('image.') && selected?.platform === 'ecovacs'
      ? ecovacsSourceState(runtime.host, runtime.host.hass, src) : null;
    const canUseSource = v.live !== false && allowed
      && (resolution.status === 'ok' || resolution.status === 'unsupported');
    const planRooms = runtime._vacPlanRoomAnchors(dev.space);
    const roomMatches = tele
      ? vacRoomNameMatchCount(tele.rooms, planRooms.map((room) => room.name)) : 0;
    const tierA = !!(canUseSource && tele && roomMatches >= 3);
    const setVac = (patch: Record<string, unknown>) => {
      // HP-1540-01: materialise the marker first — find() alone silently
      // dropped every edit for a vacuum that had never been saved
      const m = runtime.host._vacEnsureMarker(dev);
      if (!m) return;
      m.vacuum = { ...(m.vacuum || {}), ...patch };
      runtime.host._regSignature = '';
      // First-use markers are materialised above, so the dialog must rebuild
      // immediately instead of waiting for an unrelated HA state tick.
      runtime.host._maybeRebuildDevices();
      runtime._saveConfig();
      runtime.host.requestUpdate();
    };
    const sameDevice = new Set(dev.entities || []);
    const primaryCandidates = resolution.candidates.filter((candidate) =>
      sameDevice.has(candidate.entityId) || candidate.entityId === v.source);
    const globalCandidates = includeAllCameras
      ? resolution.candidates.filter((candidate) => (candidate.entityId.startsWith('camera.') || candidate.entityId.startsWith('image.'))
        && !primaryCandidates.some((entry) => entry.entityId === candidate.entityId))
      : [];
    const capability = (candidate: VacSourceCandidate) => [
      candidate.hasPosition ? runtime.host._t('vac.cap_position') : '',
      candidate.hasRooms ? runtime.host._t('vac.cap_rooms_short') : '',
      candidate.hasPath ? runtime.host._t('vac.cap_path') : '',
      candidate.hasMapId ? runtime.host._t('vac.cap_map') : '',
    ].filter(Boolean).join(' · ') || runtime.host._t('vac.cap_none');
    const candidateButton = (candidate: VacSourceCandidate) => html`
      <button type="button" class="vacsource ${candidate.entityId === src ? 'on' : ''}"
        @click=${() => setVac({ source: candidate.entityId })}>
        <span><b>${candidate.name}</b><small>${candidate.entityId}</small></span>
        <span class="vacsource-meta">${candidate.platform || runtime.host._t('vac.platform_unknown')} · ${capability(candidate)}</span>
      </button>`;
    const knownSameDeviceXcme = resolution.candidates.some((candidate) =>
      sameDevice.has(candidate.entityId) && candidate.category === 'known_xcme_incomplete');
    const showXcmeHint = knownSameDeviceXcme
      || (!!resolution.pinned && !!src?.startsWith('camera.') && !selected?.hasPosition);
    const openPicker = () => {
      const picker = [...runtime.host.renderRoot.querySelectorAll<HTMLDetailsElement>('details.vacpicker')]
        .find((details) => details.id === `vacpicker-${dev.id}`);
      if (!picker) return;
      picker.open = true;
      picker.querySelector<HTMLElement>('summary')?.focus();
    };
    const diagnostics=html`<div class="vacdiag" role="status">
          <div><span>${runtime.host._t('vac.diag_source')}</span><b>${src || runtime.host._t('vac.source_none')}</b></div>
          ${selected?.platform ? html`<div><span>${runtime.host._t('vac.diag_platform')}</span><b>${selected.platform}</b></div>` : nothing}
          <div><span>${runtime.host._t('vac.diag_status')}</span><b>${runtime.host._t((`vac.source_status_${resolution.status}`) as I18nKey)}</b></div>
          <div><span>${runtime.host._t('vac.diag_position')}</span><b>${tele?.pos ? runtime.host._t('common.yes') : runtime.host._t('common.no')}</b></div>
          <div><span>${runtime.host._t('vac.diag_rooms')}</span><b>${subst(runtime.host._t('vac.diag_rooms_value'), {
            total: String(tele?.rooms.length || 0), matched: String(roomMatches),
            readiness: runtime.host._t(roomMatches >= 3 ? 'vac.autocal_ready' : 'vac.autocal_not_ready'),
          })}</b></div>
          <div><span>${runtime.host._t('vac.diag_path')}</span><b>${tele?.nativePath || tele?.path.length ? runtime.host._t('common.yes') : runtime.host._t('common.no')}</b></div>
          ${renderVacuumPathDiagnostics(runtime.host, dev)}
          <div><span>${runtime.host._t('vac.diag_map')}</span><b>${tele?.mapId ?? 'default'}</b></div>
          ${(v.map_routes || []).map(route=>html`<div><span>${route.id}</span><b>${route.map_id} · ${route.source}</b></div>`)}
        </div>`;
    return html`<div class="vacbox vacuum-profile">${formCard({id:'vacuum',title:st('marker.section_vacuum'),
      help:html`<div class="vacuum-source-status">${st('marker.vacuum_status_inline',{status:runtime.host._t((`vac.source_status_${resolution.status}`) as I18nKey)})}</div>`,body:formSections([
          field({label:runtime.host._t('vac.diag_source'),control:html`<span>${src || runtime.host._t('vac.source_none')}</span>`}),
          html`${subsection({title:st('marker.vacuum_source_path')})}${(resolution.status === 'missing' || resolution.status === 'disabled' || resolution.status === 'unverified')
          ? html`<div class="warn vacsource-warning">
              <span>${runtime.host._t((`vac.source_banner_${resolution.status}`) as I18nKey)}</span>
              <button type="button" class="btn ghostbtn" @click=${openPicker}>${runtime.host._t('vac.choose_source')}</button>
            </div>` : nothing}
          ${showXcmeHint ? html`<div class="warn vacxcme">
          <b>${runtime.host._t('vac.xcme_hint')}</b>
          <pre>attributes:
  - vacuum_position
  - rooms
  - path
  - map_name</pre>
        </div>` : nothing}
          ${ecovacs ? html`<div class="rhint" data-hp="ecovacs-source-hint">${runtime.host._t(
          !allowed ? 'vac.ecovacs_wrong_device' : !ecovacs.supported ? 'vac.ecovacs_update_backend'
            : ecovacs.frame?.reason ? 'vac.ecovacs_unsupported'
              : !tele && v.live !== false ? 'vac.ecovacs_waiting' : 'vac.ecovacs_manual_hint')}</div>` : nothing}
          <div class="vacuum-source-controls">${disclosure({id:`vacpicker-${dev.id}`,className:'vacpicker',
            title:runtime.host._t('vac.choose_source'),triggerClass:'btn ghostbtn',
            help:help('marker.vacuum_source_help',runtime.host._t('vac.choose_source')),
            content:html`<div class="vacsource-list">
            <button type="button" class="vacsource ${!resolution.pinned ? 'on' : ''}"
              @click=${() => setVac({ source: null })}>
              <span><b>${runtime.host._t('vac.source_auto')}</b><small>${runtime.host._t('vac.source_auto_hint')}</small></span>
            </button>
            ${primaryCandidates.map(candidateButton)}
            <details ?open=${includeAllCameras}
              @toggle=${(event: Event) => {
                const open = (event.currentTarget as HTMLDetailsElement).open;
                if (open) runtime.host._vacOpenAllCameras(dev);
                else {
                  runtime.host._vacAllCamerasFor = null;
                  runtime.host._vacAllCameraCache = null;
                }
              }}>
              <summary>${runtime.host._t('vac.all_cameras')}</summary>
              <div class="rhint">${runtime.host._t('vac.all_cameras_warn')}</div>
              ${includeAllCameras
                ? (globalCandidates.length ? globalCandidates.map(candidateButton)
                  : html`<div class="rhint">${runtime.host._t('vac.all_cameras_empty')}</div>`)
                : nothing}
            </details>
          </div>`})}</div>`,
          tele || ecovacs ? toggleRow({id:'marker-vacuum-live',title:runtime.host._t('vac.live'),help:help('marker.vacuum_live_help',runtime.host._t('vac.live')),checked:v.live!==false,onChange:on=>setVac({live:on?null:false})}) : nothing,
          tele || ecovacs ? field({label:runtime.host._t('vac.trail'),help:html`<hp-help instant data-help="vacuum-trail" .text=${toolsT('marker.vacuum_trail_help')} .ariaLabel=${st('dialog.help_for',{name:runtime.host._t('vac.trail')})}></hp-help>`,control:html`<hp-settings-select><select class="areasel"
            @change=${(e: Event) => setVac({ trail_mode: (e.target as HTMLSelectElement).value, trail: null })}>
            ${(['never', 'cleaning', 'always'] as const).map((mv) => html`
              <option value=${mv} ?selected=${vacTrailMode(v) === mv}>${runtime.host._t(('vac.trail_' + mv) as I18nKey)}</option>`)}
          </select></hp-settings-select>`}) : nothing,
          html`<div class="vacuum-trail-color">
          <span>${st('marker.vacuum_trail_color')}</span>
          <hp-color-opacity .label=${st('marker.vacuum_trail_color')} .hideLabel=${true}
            .triggerLabel=${st('marker.vacuum_trail_color_action')} .nativeTooltip=${false}
            .color=${trailStyle.color} .opacity=${trailStyle.opacity} .showOpacity=${true}
            .opacityLabel=${runtime.host._t('space.opacity')} .pickerLabels=${runtime.host._colorPickerLabels}
            .disabled=${dlg.busy}
            @hp-color-opacity-change=${(event: CustomEvent<{color:string;opacity:number}>)=>{
              const current=runtime.host._markerDialog;
              if (!current || current.devId!==dev.id || current.busy) return;
              runtime.host._markerDialog={...current,vacuumTrail:{...event.detail}};
              runtime.host.requestUpdate();
            }}></hp-color-opacity>
          <span class="vacuum-trail-readout">${st('marker.vacuum_trail_color_summary',{
            hex:trailStyle.color,transparency:100-Math.round(trailStyle.opacity*100),
          })}</span>
        </div>`,
          toggleRow({id:'marker-vacuum-dock-restart',title:runtime.host._t('vac.new_run_after_dock'),
          caption:runtime.host._t(runtime.host._haVacuumDockRestartApi===1?'vac.new_run_after_dock_hint':'vac.new_run_after_dock_update'),
          checked:v.new_run_after_dock===true,
          disabled:runtime.host._haVacuumDockRestartApi!==1||!runtime.host._canEdit||runtime.host._kiosk||vacuumDockRestartPending(runtime.host,dev.id),
          onChange:(on,event)=>{
            if(event?.target instanceof HTMLInputElement) event.target.checked=v.new_run_after_dock===true;
            void saveVacuumDockRestart(runtime,dev.id,on);
          }}),
          html`<div class="vacbtns hpf-actions">
          ${tierA ? html`<button class="btn" ?disabled=${runtime.host._markerDialog?.busy} @click=${() => runtime._vacAutoCalibrate(dev)}>${runtime.host._t('vac.autocal')}</button>` : nothing}
          ${canUseSource && !!tele
            ? html`<button class="btn ghostbtn" ?disabled=${runtime.host._markerDialog?.busy} @click=${() => runtime._vacStartFit(dev)}>${runtime.host._t('vac.fit')}</button>`
            : nothing}
          ${actionHelp(html`<a class="btn ghostbtn" href="https://github.com/Matysh/houseplan-card/blob/main/docs/VACUUM.md"
            target="_blank" rel="noopener">${runtime.host._t('vac.documentation')}</a>`,help('marker.vacuum_documentation_help',runtime.host._t('vac.documentation')))}
        </div>`,
          renderVacuumMapsSection(runtime,dev,resolution,st('marker.vacuum_maps_calibration')),
          disclosure({className:'hpf-profile-diagnostics',title:st('marker.vacuum_diagnostics'),content:diagnostics}),
        ])})}</div>`;
  }
