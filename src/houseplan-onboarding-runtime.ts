import { html, nothing, type TemplateResult } from 'lit';
import { classifyPlanFile, encodePlanFile, renderBackdropGuard } from './backdrop-pick';
import { hasTranslation, langOf, t, type I18nKey } from './i18n';
import './hp-help';

import {
  DEFAULT_CUSTOM_FILL,
  DEFAULT_ROOM_COLOR,
  DEFAULT_ROOM_OPACITY,
  DEFAULT_TEMP_MAX,
  DEFAULT_TEMP_MIN,
  customFillOf,
  spaceDisplayOf,
} from './logic';
import { northDegOf } from './sun';
import {
  createEmptySpaceConfig,
  initialSpaceDisplayDraft,
} from './space-dialog';
import { rememberSpaceDialogBaseline } from './editors/space-form-state';
import { collectSpaceMarkerDependencies } from './space-deletion';
import {
  gridCellFieldValue,
  newSpaceCellCm,
} from './grid-scale';
import { zeroWallStyleOf } from './zero-walls';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
// #600: форма и границы шага сетки — из одного модуля с редактором; прежняя
// локальная копия констант и `strictNumber` нарушала «одно число — один источник».
import { CELL_CM_MAX, CELL_CM_MIN, renderSpaceForm } from './editors/space-form';

const BUILD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

/**
 * Space creation/import is part of empty-install onboarding, not an editor.
 * It therefore has its own lazy boundary: normal View downloads neither this
 * module nor the editor, while a new empty installation can create its first
 * space without ever requesting the editor chunk.
 */
export const ONBOARDING_RUNTIME_FINGERPRINT = BUILD_FINGERPRINT;

export class HouseplanOnboardingRuntime {
  public constructor(public readonly host: HouseplanEditorHostPort) {}

  private _help(key: Extract<I18nKey, `${string}.help`>): TemplateResult | typeof nothing {
    const ariaKey = `${key}.aria` as I18nKey;
    const lang = langOf(this.host.hass, this.host._config?.language);
    if (!hasTranslation(lang, key) || !hasTranslation(lang, ariaKey)) return nothing;
    return html`<hp-help data-help-key=${key}
      .text=${t(lang, key)} .ariaLabel=${t(lang, ariaKey)}></hp-help>`;
  }

  public _openSpaceDialog(mode: 'edit' | 'create', spaceId?: string): void {
    if (!this.host._serverStorage || !this.host._serverCfg) {
      this.host._showToast(this.host._t('toast.integration_missing'));
      return;
    }
    if (mode === 'edit') {
      const sp = this.host._serverCfg.spaces.find((space) => space.id === spaceId);
      if (!sp) return;
      const disp = spaceDisplayOf(sp);
      const storedCustom = sp.settings?.custom_fill && typeof sp.settings.custom_fill === 'object'
        ? customFillOf(sp.settings.custom_fill) : null;
      const dialogCustom = disp.fill === 'none'
        ? { ...(storedCustom || DEFAULT_CUSTOM_FILL), a: 0 }
        : storedCustom;
      this.host._spaceDialog = {
        mode, spaceId, title: sp.title, planUrl: sp.plan_url || null, planFile: null,
        source: sp.plan_url ? 'file' : 'draw',
        showBorders: disp.showBorders, showNames: disp.showNames,
        zeroWallStyle: zeroWallStyleOf(sp),
        displayTouched: true,
        hideDecor: disp.hideDecor, hideOpenings: disp.hideOpenings,
        roomColor: disp.color, roomOpacity: disp.opacity,
        fillMode: disp.fill === 'none' ? 'custom' : disp.fill,
        customFill: dialogCustom,
        glowEnabled: disp.glow,
        bgColor: disp.bgColor,
        bgMode: sp.settings?.bg_mode === 'static' || sp.settings?.bg_mode === 'daynight'
          ? sp.settings.bg_mode : null,
        northDeg: northDegOf({}, sp.settings),
        sunRays: typeof sp.settings?.sun_rays === 'boolean' ? sp.settings.sun_rays : null,
        tempMin: disp.tempMin, tempMax: disp.tempMax,
        showLqi: disp.showLqi ?? this.host._config?.show_signal ?? true,
        cardFontScale: disp.cardFontScale,
        labelTemp: disp.labelTemp, labelHum: disp.labelHum,
        labelLqi: disp.labelLqi, labelLight: disp.labelLight,
        cellCm: Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5,
        cellCmInput: gridCellFieldValue(
          Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5, this.host._imperial,
        ),
        cellCmTouched: false,
        busy: false,
      };
      return;
    }
    const cellCm = newSpaceCellCm(this.host._imperial);
    this.host._spaceDialog = {
      mode, title: '', planUrl: null, planFile: null,
      ...initialSpaceDisplayDraft(),
      hideDecor: false, hideOpenings: false, zeroWallStyle: 'dashed',
      roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'custom',
      customFill: { ...DEFAULT_CUSTOM_FILL, a: 0 },
      glowEnabled: true,
      bgColor: null,
      bgMode: 'daynight', northDeg: null, sunRays: null,
      tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
      showLqi: this.host._config?.show_signal ?? true,
      cardFontScale: 1,
      labelTemp: false, labelHum: false, labelLqi: false, labelLight: false,
      cellCm,
      cellCmInput: gridCellFieldValue(cellCm, this.host._imperial),
      cellCmTouched: false,
      busy: false,
    };
    // #600 К10: снимок на момент открытия — от него считается «есть изменения».
    rememberSpaceDialogBaseline(this.host, this.host._spaceDialog);
  }

  public async _pickPlanFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.host._spaceDialog) return;
    // #39: re-selecting the same file after a guard decision must fire again.
    input.value = '';
    const classified = await classifyPlanFile(file);
    if (classified.kind === 'reject') {
      this.host._showToast(this.host._t('toast.plan_formats'));
      return;
    }
    if (classified.kind === 'guard') {
      this.host._backdropGuard = classified.state;
      return;
    }
    const payload = await encodePlanFile(file, classified.ext, file.name);
    if (!this.host._spaceDialog) return;
    this.host._spaceDialog = { ...this.host._spaceDialog, planFile: payload };
  }

  public _renderBackdropGuard(): TemplateResult | typeof nothing {
    return renderBackdropGuard(
      this.host,
      (payload) => {
        if (this.host._spaceDialog) {
          this.host._spaceDialog = { ...this.host._spaceDialog, planFile: payload };
        }
      },
      () => { this.host._backdropGuard = null; },
      this.host.hass,
    ) ?? nothing;
  }

  public _toggleServerPlans = async (): Promise<void> => {
    const dialog = this.host._spaceDialog;
    if (!dialog) return;
    if (dialog.pickSaved) {
      this.host._spaceDialog = { ...dialog, pickSaved: false };
      return;
    }
    this.host._spaceDialog = { ...dialog, pickSaved: true, savedBusy: true };
    try {
      const response: { plans?: NonNullable<typeof dialog.saved> } = await this.host.hass.callWS({
        type: 'houseplan/plans/list',
      });
      const current = this.host._spaceDialog;
      if (current) this.host._spaceDialog = {
        ...current, saved: response?.plans || [], savedBusy: false,
      };
    } catch (error: unknown) {
      const current = this.host._spaceDialog;
      if (current) this.host._spaceDialog = { ...current, saved: [], savedBusy: false };
      this.host._showToast(this.host._t('toast.plans_list_failed', {
        err: this.host._errText(error),
      }));
    }
  };

  public _useServerPlan(url: string): void {
    const dialog = this.host._spaceDialog;
    if (!dialog) return;
    this.host._spaceDialog = {
      ...dialog, planUrl: url, planFile: null, pickSaved: false, savedAspect: undefined,
    };
    this.host._aspectJob = this._readPlanAspect(url);
  }

  public async _readPlanAspect(url: string): Promise<number> {
    for (let i = 0; i < 40; i++) {
      const src = this.host._display(url);
      if (src) {
        const ratio = await new Promise<number>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image.naturalWidth && image.naturalHeight
            ? image.naturalWidth / image.naturalHeight : 0);
          image.onerror = () => resolve(0);
          image.src = src;
        });
        const current = this.host._spaceDialog;
        if (current && current.planUrl === url && Number.isFinite(ratio) && ratio > 0) {
          this.host._spaceDialog = { ...current, savedAspect: ratio };
          return ratio;
        }
        return 0;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (this.host._spaceDialog?.planUrl !== url) return 0;
    }
    return 0;
  }

  public async _deleteServerPlan(name: string): Promise<void> {
    const dialog = this.host._spaceDialog;
    const plan = dialog?.saved?.find((candidate) => candidate.name === name);
    if (!dialog || !plan || plan.used_by.length || plan.url === dialog.planUrl) return;
    const accepted = await this.host._confirmDanger({
      key: 'delete-plan',
      kind: 'destructive',
      title: this.host._t('confirm.delete_plan_title'),
      message: this.host._t('confirm.delete_plan_body'),
      objectName: name,
      confirmLabel: this.host._t('btn.delete'),
      cancelLabel: this.host._t('btn.cancel'),
    });
    const currentDialog = this.host._spaceDialog;
    const currentPlan = currentDialog?.saved?.find((candidate) => candidate.name === name);
    if (!accepted || !currentDialog || !currentPlan
      || currentPlan.url !== plan.url || currentPlan.modified !== plan.modified
      || currentPlan.used_by.length || currentPlan.url === currentDialog.planUrl) return;
    try {
      await this.host.hass.callWS({ type: 'houseplan/plans/delete', name });
      const dialog = this.host._spaceDialog;
      if (dialog?.saved) this.host._spaceDialog = {
        ...dialog, saved: dialog.saved.filter((plan) => plan.name !== name),
      };
    } catch (error: unknown) {
      this.host._showToast(this.host._t('toast.plan_delete_failed', {
        err: this.host._errText(error),
      }));
    }
  }

  public _renderServerPlans(
    dialog: NonNullable<HouseplanEditorHostPort['_spaceDialog']>,
  ): TemplateResult {
    if (dialog.savedBusy) return html`<div class="savedplans muted">${this.host._t('space.loading')}</div>`;
    const list = dialog.saved || [];
    if (!list.length) return html`<div class="savedplans muted">${this.host._t('space.no_saved')}</div>`;
    const kb = (size: number) => (size >= 1048576
      ? `${(size / 1048576).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`);
    return html`<div class="savedplans">
      ${list.map((plan) => html`
        <div class="savedplan ${plan.url === dialog.planUrl ? 'cur' : ''}">
          <img src=${this.host._display(plan.url)} alt="" loading="lazy" decoding="async" />
          <div class="savedmeta">
            <b>${plan.name}</b>
            <span class="muted">${kb(plan.size)}${plan.used_by.length
              ? ` · ${this.host._t('space.used_by', { list: plan.used_by.join(', ') })}`
              : ''}</span>
          </div>
          <button class="btn ghost" @click=${() => this._useServerPlan(plan.url)}
            ?disabled=${plan.url === dialog.planUrl}>${this.host._t('btn.use')}</button>
          <button class="btn ghost danger"
            title=${plan.used_by.length || plan.url === dialog.planUrl
              ? this.host._t('space.in_use') : this.host._t('btn.delete')}
            ?disabled=${plan.used_by.length > 0 || plan.url === dialog.planUrl}
            @click=${() => this._deleteServerPlan(plan.name)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>`)}
    </div>`;
  }

  private async _saveConfigNow(): Promise<void> {
    this.host._cfgEpoch++;
    try {
      await this.host._writeConfig();
    } catch (error: unknown) {
      const failure = error as { physicalGeometryRolledBack?: boolean; code?: string };
      if (failure?.physicalGeometryRolledBack) await this.host._reloadRejectedPhysicalWrite();
      else if (failure?.code === 'conflict') await this.host._reloadConfigOnly();
      throw error;
    }
  }

  public async _saveSpaceDialog(): Promise<void> {
    const dialog = this.host._spaceDialog;
    if (!dialog || dialog.busy || !dialog.title.trim()) return;
    if (dialog.source === 'file' && !dialog.planFile && !dialog.planUrl) {
      this.host._showToast(this.host._t('toast.plan_required'));
      return;
    }
    const wasFirst = dialog.mode === 'create' && (this.host._serverCfg?.spaces.length || 0) === 0;
    this.host._spaceDialog = { ...dialog, busy: true };
    try {
      const spaceId = dialog.mode === 'create'
        ? `s${Date.now().toString(36)}` : dialog.spaceId!;
      let uploaded: { url: string; aspect: number } | null = null;
      if (dialog.source === 'file' && dialog.planFile) {
        const response: { url: string } = await this.host.hass.callWS({
          type: 'houseplan/plan/set',
          space_id: spaceId,
          ext: dialog.planFile.ext,
          data: dialog.planFile.b64,
        });
        uploaded = { url: response.url, aspect: dialog.planFile.aspect };
      }
      let pickedAspect: number | null = dialog.savedAspect || null;
      if (!uploaded && dialog.source === 'file' && dialog.planUrl
          && !pickedAspect && this.host._aspectJob) {
        pickedAspect = (await this.host._aspectJob) || null;
      }

      const config = this.host._serverCfg!;
      let space = config.spaces.find((candidate) => candidate.id === spaceId);
      if (dialog.mode === 'create') {
        space = createEmptySpaceConfig(spaceId, dialog.title.trim());
        config.spaces.push(space);
      } else {
        if (!space) throw new Error(`space ${spaceId} is gone from the config`);
        space.title = dialog.title.trim();
      }
      if (!space) throw new Error(`space ${spaceId} is unavailable`);
      if (uploaded) {
        space.plan_url = uploaded.url;
        space.plan_aspect = uploaded.aspect;
      } else if (dialog.source === 'file' && dialog.planUrl && dialog.planUrl !== space.plan_url) {
        space.plan_url = dialog.planUrl;
        space.plan_aspect = pickedAspect;
      }
      if (dialog.source === 'draw') {
        space.plan_url = null;
        space.plan_aspect = null;
        delete space.plan_x;
        delete space.plan_y;
        delete space.plan_scale;
        delete space.plan_scale_x;
        delete space.plan_scale_y;
        delete space.plan_angle;
      }
      space.settings = {
        ...(space.settings || {}),
        show_borders: dialog.showBorders,
        show_names: dialog.showNames,
        hide_decor: dialog.hideDecor || undefined,
        hide_openings: dialog.hideOpenings || undefined,
        room_color: dialog.roomColor,
        room_opacity: dialog.roomOpacity,
        bg_color: dialog.bgColor || undefined,
        bg_mode: dialog.bgMode || undefined,
        north_deg: dialog.northDeg ?? undefined,
        sun_rays: dialog.sunRays ?? undefined,
        fill_mode: dialog.fillMode,
        custom_fill: dialog.customFill || undefined,
        glow_enabled: dialog.glowEnabled,
        temp_min: Number.isFinite(dialog.tempMin)
          ? Math.min(dialog.tempMin, dialog.tempMax) : DEFAULT_TEMP_MIN,
        temp_max: Number.isFinite(dialog.tempMax)
          ? Math.max(dialog.tempMin, dialog.tempMax) : DEFAULT_TEMP_MAX,
        show_lqi: dialog.showLqi,
        card_font_scale: dialog.cardFontScale !== 1 ? dialog.cardFontScale : undefined,
        label_temp: dialog.labelTemp,
        label_hum: dialog.labelHum,
        label_lqi: dialog.labelLqi,
        label_light: dialog.labelLight,
      };
      space.zero_wall_style = dialog.zeroWallStyle;
      space.cell_cm = Number.isFinite(dialog.cellCm) && dialog.cellCm > 0
        ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, dialog.cellCm)) : 5;
      await this._saveConfigNow();
      this.host._spaceDialog = null;
      if (dialog.mode === 'create') this.host._commitSpace(space.id);
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      if (this.host._importQueue.length) {
        this._openNextImport();
      } else if (wasFirst || this.host._importTotal > 0) {
        const wasImport = this.host._importTotal > 0;
        this.host._importTotal = 0;
        this.host._commitSpace(this.host._serverCfg!.spaces[0]?.id || this.host._space);
        await this.host._requestMode('plan');
        this.host._tool = 'draw';
        this.host._path = [];
        this.host._cursorPt = null;
        this.host._primeDrawWallField();
        this.host._showToast(this.host._t(wasFirst && !wasImport
          ? 'toast.space_added_onboard' : 'import.done'));
      } else {
        this.host._showToast(this.host._t(dialog.mode === 'create'
          ? 'toast.space_added' : 'toast.space_saved'));
        if (dialog.mode === 'create') {
          if (this.host._mode !== 'plan') await this.host._requestMode('plan');
          else {
            this.host._tool = 'draw';
            this.host._path = [];
            this.host._cursorPt = null;
            this.host._primeDrawWallField();
            this.host._saveNav();
          }
        }
      }
    } catch (error: unknown) {
      const failure = error as { code?: string };
      if (failure?.code !== 'conflict') await this.host._reloadConfigOnly(true);
      if (this.host._spaceDialog) this.host._spaceDialog = {
        ...this.host._spaceDialog, busy: false,
      };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(error) }));
    }
  }

  public async _deleteSpace(): Promise<void> {
    const dialog = this.host._spaceDialog;
    if (!dialog || dialog.mode !== 'edit') return;
    const serverConfig = this.host._serverCfg;
    if (!serverConfig) return;
    const space = serverConfig.spaces.find((candidate) => candidate.id === dialog.spaceId);
    if (!space) return;
    const dependencies = collectSpaceMarkerDependencies(
      serverConfig, this.host._layout || {}, dialog.spaceId || '',
    );
    const deletingLastSpace = serverConfig.spaces.length === 1
      && serverConfig.spaces[0]?.id === dialog.spaceId;
    if (dependencies.count && !deletingLastSpace) {
      this.host._spaceDialog = { ...dialog, deleteBlockers: dependencies.count };
      return;
    }
    const spaceId = dialog.spaceId!;
    const accepted = await this.host._confirmDanger({
      key: 'delete-space',
      kind: 'destructive',
      title: this.host._t('confirm.delete_space_title'),
      message: this.host._t('confirm.delete_space_body'),
      objectName: space.title,
      confirmLabel: this.host._t('btn.delete'),
      cancelLabel: this.host._t('btn.cancel'),
    });
    const currentDialog = this.host._spaceDialog;
    const currentConfig = this.host._serverCfg;
    if (!accepted || !currentDialog || currentDialog.mode !== 'edit'
      || currentDialog.busy || currentDialog.spaceId !== spaceId || !currentConfig) return;
    const currentSpace = currentConfig.spaces.find((candidate) => candidate.id === spaceId);
    if (!currentSpace) return;
    const currentDependencies = collectSpaceMarkerDependencies(
      currentConfig, this.host._layout || {}, spaceId,
    );
    const currentlyDeletingLastSpace = currentConfig.spaces.length === 1
      && currentConfig.spaces[0]?.id === spaceId;
    if (currentDependencies.count && !currentlyDeletingLastSpace) {
      this.host._spaceDialog = {
        ...currentDialog, deleteBlockers: currentDependencies.count,
      };
      return;
    }
    this.host._spaceDialog = { ...currentDialog, deleteBlockers: 0, busy: true };
    try {
      if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.flush();
      if (this.host._persistLayout.pending()) this.host._persistLayout.flush();
      await this.host._writeChain;
      await this.host.hass.callWS({
        type: 'houseplan/space/delete',
        space_id: spaceId,
        expected_config_rev: this.host._cfgRev,
        expected_layout_rev: this.host._layoutRev,
      });
      const [configResponse, layoutResponse] = await Promise.all([
        this.host._getAuthoritativeConfig(),
        this.host.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      // #500: revisions come with the re-read bodies, never from the delete reply.
      const adopted = await this.host._adoptAuthoritative({
        cfgResp: configResponse, layResp: layoutResponse, reason: 'space-delete', profile: 'post-write',
      });
      // Asset wait: nothing adopted, the scheduled reload owns the tail (same as every reload path).
      if (adopted.status !== 'adopted') {
        this.host._spaceDialog = { ...currentDialog, busy: false };
        this.host.requestUpdate();
        return;
      }
      this.host._spaceDialog = null;
      if (this.host._space === spaceId) {
        this.host._commitSpace(this.host._serverCfg!.spaces[0]?.id || '');
      }
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._showToast(this.host._t('toast.space_deleted'));
    } catch (error: unknown) {
      const failure = error as { code?: string };
      if (failure?.code === 'conflict' || failure?.code === 'space_in_use') {
        await Promise.all([
          this.host._reloadConfigOnly(true), this.host._reloadLayoutOnly(),
        ]);
      }
      const refreshedConfig = this.host._serverCfg;
      if (this.host._spaceDialog && refreshedConfig) {
        const refreshed = collectSpaceMarkerDependencies(
          refreshedConfig, this.host._layout || {}, spaceId,
        );
        const stillLastSpace = refreshedConfig.spaces.length === 1
          && refreshedConfig.spaces[0]?.id === spaceId;
        this.host._spaceDialog = {
          ...this.host._spaceDialog,
          busy: false,
          deleteBlockers: stillLastSpace ? 0 : refreshed.count,
        };
      }
      this.host._showToast(this.host._t('toast.delete_failed', {
        err: this.host._errText(error),
      }));
    }
  }

  public _startImport(): void {
    const dialog = this.host._importDialog;
    if (!dialog) return;
    const titles = dialog.floors.filter((floor) => floor.checked).map((floor) => floor.name);
    this.host._importDialog = null;
    if (!titles.length) {
      this._openSpaceDialog('create');
      return;
    }
    this.host._importQueue = titles;
    this.host._importTotal = titles.length;
    this._openNextImport();
  }

  public _openNextImport(): void {
    const title = this.host._importQueue.shift();
    if (title === undefined) return;
    const cellCm = newSpaceCellCm(this.host._imperial);
    this.host._spaceDialog = {
      mode: 'create', title, planUrl: null, planFile: null,
      ...initialSpaceDisplayDraft(),
      hideDecor: false, hideOpenings: false, zeroWallStyle: 'dashed',
      roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'custom',
      customFill: null,
      glowEnabled: true,
      bgColor: null,
      bgMode: 'daynight', northDeg: null, sunRays: null,
      tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
      showLqi: this.host._config?.show_signal ?? true,
      cardFontScale: 1,
      labelTemp: false, labelHum: false, labelLqi: false, labelLight: false,
      cellCm,
      cellCmInput: gridCellFieldValue(cellCm, this.host._imperial),
      cellCmTouched: false,
      busy: false,
    };
    // #600 К10: снимок на момент открытия — от него считается «есть изменения».
    rememberSpaceDialogBaseline(this.host, this.host._spaceDialog);
  }

  public _skipImport(): void {
    this.host._spaceDialog = null;
    if (this.host._importQueue.length) this._openNextImport();
    else if (this.host._importTotal > 0 && this.host._model.length) {
      this.host._importTotal = 0;
      this.host._commitSpace(this.host._serverCfg!.spaces[0]?.id || this.host._space);
      void this.host._requestMode('plan').then(() => {
        this.host._showToast(this.host._t('import.done'));
      });
    }
  }

  public _renderImportDialog(): TemplateResult {
    const dialog = this.host._importDialog!;
    const selected = dialog.floors.filter((floor) => floor.checked).length;
    return html`<hp-dialog .hass=${this.host.hass} data-kind="import"
      .title=${this.host._t('import.title')}
      icon="mdi:home-floor-1" @hp-close=${() => (this.host._importDialog = null)}>
        <div class="body">
          <div class="rhint">${this.host._t('import.hint')}</div>
          ${dialog.floors.map((floor, index) => html`<label class="floorrow">
            <input type="checkbox" .checked=${floor.checked}
              @change=${(event: Event) => {
                const floors = [...dialog.floors];
                floors[index] = {
                  ...floor, checked: (event.target as HTMLInputElement).checked,
                };
                this.host._importDialog = { floors };
              }} />
            <span>${floor.name}</span>
            ${floor.level != null ? html`<span class="floorlvl">L${floor.level}</span>` : nothing}
          </label>`)}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => {
            this.host._importDialog = null;
            this._openSpaceDialog('create');
          }}>${this.host._t('import.manual')}</button>
          <span class="spacer"></span>
          <button class="btn on" data-hp="dialog-confirm"
            @click=${() => this._startImport()} ?disabled=${!selected}>
            <ha-icon icon="mdi:import"></ha-icon>${this.host._t('import.start', { n: selected })}
          </button>
        </div>
    </hp-dialog>`;
  }

  private _rangeInput(
    min: number, max: number, step: number, value: number, change: (next: number) => void,
    disabled = false, ariaLabel?: string,
  ): TemplateResult {
    return html`<input type="range" min=${min} max=${max} step=${step} .value=${String(value)}
      ?disabled=${disabled} aria-label=${ariaLabel ?? nothing}
      @input=${(event: Event) => change(Number((event.target as HTMLInputElement).value))} />`;
  }

  /**
   * #600: форма пространства — общая с редакторским рантаймом
   * (`renderSpaceForm`), у онбординга здесь только порт: свои пикер файлов,
   * сохранение и пропуск импорта; Copy и Delete не подаются — онбординг создаёт.
   * До #600 здесь лежала собственная копия разметки на 300 строк.
   */
  public _renderSpaceDialog(): TemplateResult {
    const form = renderSpaceForm({
      host: this.host,
      idPrefix: 'onboarding-space',
      help: this._help.bind(this),
      rangeInput: (min, max, step, value, onInput, disabled, ariaLabel) =>
        this._rangeInput(min, max, step, value, onInput, disabled, ariaLabel),
      pickPlanFile: (event) => this._pickPlanFile(event),
      toggleServerPlans: () => this._toggleServerPlans(),
      renderServerPlans: (dialog) => this._renderServerPlans(dialog),
      save: () => this._saveSpaceDialog(),
      skipImport: () => this._skipImport(),
    });
    return html`<hp-dialog .hass=${this.host.hass} data-kind="onboarding" form-shell wide
        .title=${form.title} .badge=${form.badge} icon="mdi:floor-plan" @hp-close=${form.requestClose}>
      ${form.body}${form.footer}
    </hp-dialog>`;
  }
}
