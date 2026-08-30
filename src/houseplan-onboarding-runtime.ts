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
  SPACE_FILL_UI_MODES,
  customFillOf,
  spaceDisplayOf,
  stageBgOf,
} from './logic';
import { bgModeOf, northDegOf } from './sun';
import {
  createEmptySpaceConfig,
  initialSpaceDisplayDraft,
  switchSpacePlanSource,
  touchSpaceDisplay,
} from './space-dialog';
import { collectSpaceMarkerDependencies } from './space-deletion';
import {
  gridCellFieldToCm,
  gridCellFieldValue,
  newSpaceCellCm,
} from './grid-scale';
import { zeroWallStyleOf } from './zero-walls';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';

const BUILD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const CELL_CM_MIN = 0.1;
const CELL_CM_MAX = 1000;

const strictNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

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
    if (!confirm(this.host._t('confirm.delete_plan', { name }))) return;
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
    if (!confirm(this.host._t('confirm.delete_space', { title: space.title }))) return;
    this.host._spaceDialog = { ...dialog, deleteBlockers: 0, busy: true };
    try {
      if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.flush();
      if (this.host._persistLayout.pending()) this.host._persistLayout.flush();
      await this.host._writeChain;
      const response: { config_rev?: number; layout_rev?: number } = await this.host.hass.callWS({
        type: 'houseplan/space/delete',
        space_id: dialog.spaceId,
        expected_config_rev: this.host._cfgRev,
        expected_layout_rev: this.host._layoutRev,
      });
      const [configResponse, layoutResponse] = await Promise.all([
        this.host.hass.callWS({ type: 'houseplan/config/get' }),
        this.host.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      this.host._adoptStructuralResponses(configResponse, layoutResponse);
      this.host._cfgRev = response?.config_rev ?? this.host._cfgRev;
      this.host._layoutRev = response?.layout_rev ?? this.host._layoutRev;
      this.host._spaceDialog = null;
      if (this.host._space === dialog.spaceId) {
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
          refreshedConfig, this.host._layout || {}, dialog.spaceId || '',
        );
        const stillLastSpace = refreshedConfig.spaces.length === 1
          && refreshedConfig.spaces[0]?.id === dialog.spaceId;
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
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('import.title')}
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
          <button class="btn on" @click=${() => this._startImport()} ?disabled=${!selected}>
            <ha-icon icon="mdi:import"></ha-icon>${this.host._t('import.start', { n: selected })}
          </button>
        </div>
    </hp-dialog>`;
  }

  private _boolInput(value: boolean, change: (checked: boolean) => void): TemplateResult {
    return html`<input type="checkbox" .checked=${value}
      @change=${(event: Event) => change((event.target as HTMLInputElement).checked)} />`;
  }

  private _rangeInput(
    min: number, max: number, step: number, value: number, change: (next: number) => void,
  ): TemplateResult {
    return html`<input type="range" min=${min} max=${max} step=${step} .value=${String(value)}
      @input=${(event: Event) => change(Number((event.target as HTMLInputElement).value))} />`;
  }

  public _renderSpaceDialog(): TemplateResult {
    return this._renderSpaceDialogBody(this.host._spaceDialog!);
  }

  private _renderSpaceDialogBody(
    dialog: NonNullable<HouseplanEditorHostPort['_spaceDialog']>,
  ): TemplateResult {
    const progress = this.host._importTotal > 0 && dialog.mode === 'create'
      ? this.host._t('import.progress', {
        i: this.host._importTotal - this.host._importQueue.length,
        n: this.host._importTotal,
      }) : '';
    const close = () => {
      this.host._spaceDialog = null;
      this.host._importQueue = [];
      this.host._importTotal = 0;
    };
    return html`<hp-dialog .hass=${this.host.hass}
      .title=${`${dialog.mode === 'create'
        ? this.host._t('space.new') : this.host._t('space.header')}${progress ? ` · ${progress}` : ''}`}
      icon="mdi:floor-plan" wide @hp-close=${close}>
        <div class="body">
          <label>${this.host._t('space.title_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('space.title_ph')}
            .value=${dialog.title}
            @input=${(event: Event) => (this.host._spaceDialog = {
              ...dialog, title: (event.target as HTMLInputElement).value,
            })} />
          <label>${this.host._t('space.plan_label')}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${dialog.source === 'file'}
              @change=${() => (this.host._spaceDialog = switchSpacePlanSource(dialog, 'file'))} />
            <span>${this.host._t('space.source_file')}</span>
          </label>
          ${dialog.source === 'file' ? html`<div class="planrow">
              ${dialog.planFile
                ? html`<span class="planname">${dialog.planFile.name}</span>`
                : dialog.planUrl
                  ? html`<img class="planprev" src=${this.host._display(dialog.planUrl)}
                      alt=${this.host._t('space.plan_alt')} />`
                  : html`<span class="planname muted">${this.host._t('space.no_plan')}</span>`}
              <span class="fileupload">
                <button class="btn filebtn" type="button" @click=${(event: Event) =>
                  ((event.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                  <ha-icon icon="mdi:upload"></ha-icon>${dialog.planUrl || dialog.planFile
                    ? this.host._t('btn.replace') : this.host._t('btn.upload')}
                </button>
                <input type="file" hidden
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                  @change=${(event: Event) => this._pickPlanFile(event)} />
              </span>
              <button class="btn ghost" @click=${this._toggleServerPlans}
                title=${this.host._t('space.pick_saved_hint')}>
                <ha-icon icon="mdi:folder-image"></ha-icon>${this.host._t('space.pick_saved')}
              </button>
            </div>
            ${dialog.pickSaved ? this._renderServerPlans(dialog) : nothing}` : nothing}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${dialog.source === 'draw'}
              @change=${() => (this.host._spaceDialog = switchSpacePlanSource(dialog, 'draw'))} />
            <span>${this.host._t('space.source_draw')}</span>
          </label>

          <div class="helpfieldlabel">
            <label for="onboarding-space-cell-cm">${this.host._t('space.scale_label')}</label>
            ${this._help('space.cell_cm.help')}
          </div>
          <div class="colorrow">
            <input id="onboarding-space-cell-cm" class="namein tempin" type="number"
              min=${gridCellFieldValue(CELL_CM_MIN, this.host._imperial)}
              max=${gridCellFieldValue(CELL_CM_MAX, this.host._imperial)}
              step="0.1"
              .value=${dialog.cellCmInput ?? gridCellFieldValue(dialog.cellCm, this.host._imperial)}
              @input=${(event: Event) => {
                const raw = (event.target as HTMLInputElement).value;
                const parsed = strictNumber(raw);
                const canonical = parsed == null ? null
                  : gridCellFieldToCm(parsed, this.host._imperial);
                this.host._spaceDialog = {
                  ...dialog,
                  cellCmInput: raw,
                  cellCmTouched: true,
                  cellCm: canonical != null && canonical > 0
                    ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, canonical)) : dialog.cellCm,
                };
              }} />
            <span class="opl">${this.host._t(this.host._imperial
              ? 'space.scale_unit_imperial' : 'space.scale_unit')}</span>
          </div>

          <label class="dispsection">${this.host._t('space.display_section')}</label>
          <label class="srcrow">
            ${this._boolInput(dialog.showBorders, (value) => {
              this.host._spaceDialog = touchSpaceDisplay(dialog, 'showBorders', value);
            })}
            <span>${this.host._t('space.show_borders')}</span>
          </label>
          <div class="helpfieldlabel">
            <label for="onboarding-space-zero-wall-style">${this.host._t('space.zero_wall_style')}</label>
            ${this._help('space.zero_wall_style.help')}
          </div>
          <select id="onboarding-space-zero-wall-style" class="areasel" @change=${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            this.host._spaceDialog = {
              ...dialog, zeroWallStyle: value === 'solid' ? 'solid' : 'dashed',
            };
          }}>
            <option value="dashed" ?selected=${dialog.zeroWallStyle === 'dashed'}>
              ${this.host._t('space.zero_wall_dashed')}
            </option>
            <option value="solid" ?selected=${dialog.zeroWallStyle === 'solid'}>
              ${this.host._t('space.zero_wall_solid')}
            </option>
          </select>
          <label class="srcrow">
            ${this._boolInput(dialog.showNames, (value) => {
              this.host._spaceDialog = touchSpaceDisplay(dialog, 'showNames', value);
            })}
            <span>${this.host._t('space.show_names')}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(dialog.showLqi, (value) => {
              this.host._spaceDialog = { ...dialog, showLqi: value };
            })}
            <span>${this.host._t('space.show_lqi')}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(dialog.hideDecor, (value) => {
              this.host._spaceDialog = { ...dialog, hideDecor: value };
            })}
            <span>${this.host._t('space.hide_decor')}</span>
          </label>
          <div class="rhint">${this.host._t('space.hide_decor_tip')}</div>
          <label class="srcrow">
            ${this._boolInput(dialog.hideOpenings, (value) => {
              this.host._spaceDialog = { ...dialog, hideOpenings: value };
            })}
            <span>${this.host._t('space.hide_openings')}</span>
          </label>
          <div class="rhint">${this.host._t('space.hide_openings_tip')}</div>
          <label class="dispsection">${this.host._t('space.roomcard_section')}</label>
          ${([
            ['labelTemp', 'space.label_temp'], ['labelHum', 'space.label_hum'],
            ['labelLqi', 'space.label_lqi'], ['labelLight', 'space.label_light'],
          ] as const).map(([field, key]) => html`<label class="srcrow">
            ${this._boolInput(dialog[field], (value) => {
              this.host._spaceDialog = { ...dialog, [field]: value };
            })}
            <span>${this.host._t(key)}</span>
          </label>`)}
          <label>${this.host._t('space.card_font')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(dialog.cardFontScale * 100), (value) => {
              this.host._spaceDialog = { ...dialog, cardFontScale: value / 100 };
            })}
            <span class="opv">${Math.round(dialog.cardFontScale * 100)}%</span>
          </div>
          ${this.host._renderCardPreview(dialog.cardFontScale, 1, 1)}
          <div class="colorrow">
            <hp-color-opacity .label=${this.host._t('space.room_color')}
              .opacityLabel=${this.host._t('space.opacity')}
              .pickerLabels=${this.host._colorPickerLabels}
              .color=${dialog.roomColor} .opacity=${dialog.roomOpacity} .showOpacity=${true}
              @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) => {
                this.host._spaceDialog = {
                  ...dialog, roomColor: event.detail.color, roomOpacity: event.detail.opacity,
                };
              }}></hp-color-opacity>
          </div>
          <div class="helpfieldlabel">
            <label for="onboarding-space-bg-mode">${this.host._t('space.bg_mode')}</label>
            ${this._help('space.bg_mode.help')}
          </div>
          <select id="onboarding-space-bg-mode" class="areasel" @change=${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            this.host._spaceDialog = {
              ...dialog,
              bgMode: value === 'static' || value === 'daynight' ? value : null,
            };
          }}>
            <option value="" ?selected=${dialog.bgMode === null}>${this.host._t('space.sun_inherit')}</option>
            <option value="static" ?selected=${dialog.bgMode === 'static'}>${this.host._t('gs.bg_static')}</option>
            <option value="daynight" ?selected=${dialog.bgMode === 'daynight'}>${this.host._t('gs.bg_daynight')}</option>
          </select>
          ${(dialog.bgMode ?? bgModeOf(this.host._settings, {})) === 'static' ? html`
            <div class="colorrow">
              <hp-color-opacity .label=${this.host._t('space.bg_color')}
                .pickerLabels=${this.host._colorPickerLabels}
                .color=${dialog.bgColor || stageBgOf(this.host._settings, { bgColor: null })
                  || this.host._stageBgHex()}
                .opacity=${1} .showOpacity=${false}
                @hp-color-opacity-change=${(event: CustomEvent<{ color: string }>) => {
                  this.host._spaceDialog = { ...dialog, bgColor: event.detail.color };
                }}></hp-color-opacity>
              ${dialog.bgColor ? html`<button class="btn ghost" @click=${() => {
                this.host._spaceDialog = { ...dialog, bgColor: null };
              }}>${this.host._t('space.bg_inherit')}</button>`
                : html`<span class="opl">${this.host._t('space.bg_inherited')}</span>`}
            </div>` : nothing}
          <div class="helpfieldlabel">
            <label for="onboarding-space-north">${this.host._t('space.north')}</label>
            ${this._help('space.north.help')}
          </div>
          <div class="colorrow">
            <input id="onboarding-space-north" class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this.host._t('space.sun_inherit')}
              .value=${dialog.northDeg === null ? '' : String(dialog.northDeg)}
              @input=${(event: Event) => {
                const raw = (event.target as HTMLInputElement).value.trim();
                const value = raw === '' ? null : Math.round(Number(raw));
                this.host._spaceDialog = {
                  ...dialog,
                  northDeg: value !== null && Number.isFinite(value)
                    ? Math.min(359, Math.max(0, value)) : null,
                };
              }} />
            <span class="opl">${dialog.northDeg === null
              ? this.host._t('space.north_inherited', {
                v: northDegOf(this.host._settings, {}) === null
                  ? '—' : `${northDegOf(this.host._settings, {})}°`,
              }) : '°'}</span>
          </div>
          <label>${this.host._t('space.sun_rays')}</label>
          <select class="areasel" @change=${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            this.host._spaceDialog = {
              ...dialog, sunRays: value === '' ? null : value === '1',
            };
          }}>
            <option value="" ?selected=${dialog.sunRays === null}>${this.host._t('space.sun_inherit')}</option>
            <option value="1" ?selected=${dialog.sunRays === true}>${this.host._t('space.sun_on')}</option>
            <option value="0" ?selected=${dialog.sunRays === false}>${this.host._t('space.sun_off')}</option>
          </select>
          <div class="helpfieldlabel">
            <span>${this.host._t('space.fill_label')}</span>
            ${this._help('space.fill_mode.help')}
          </div>
          ${SPACE_FILL_UI_MODES.map((value) => [value, `fill.${value}`] as const).map(
            ([value, key]) => html`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${dialog.fillMode === value}
                @change=${() => (this.host._spaceDialog = { ...dialog, fillMode: value })} />
              <span>${this.host._t(key)}</span>
              ${value === 'temp' && dialog.fillMode === 'temp' ? html`<span class="temprange">
                <input class="namein tempin" type="number" step="0.5" .value=${String(dialog.tempMin)}
                  @input=${(event: Event) => {
                    const parsed = strictNumber((event.target as HTMLInputElement).value);
                    if (parsed != null) this.host._spaceDialog = { ...dialog, tempMin: parsed };
                  }} />
                –
                <input class="namein tempin" type="number" step="0.5" .value=${String(dialog.tempMax)}
                  @input=${(event: Event) => {
                    const parsed = strictNumber((event.target as HTMLInputElement).value);
                    if (parsed != null) this.host._spaceDialog = { ...dialog, tempMax: parsed };
                  }} /> °C
              </span>` : nothing}
            </label>
            ${value === 'custom' && dialog.fillMode === 'custom' ? html`
              <div class="colorrow gsrow">
                <span class="gsl">${this.host._t('space.custom_fill')}</span>
                <hp-color-opacity .label=${this.host._t('space.custom_fill')}
                  .opacityLabel=${this.host._t('space.opacity')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${(dialog.customFill || DEFAULT_CUSTOM_FILL).c}
                  .opacity=${(dialog.customFill || DEFAULT_CUSTOM_FILL).a}
                  @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) => {
                    this.host._spaceDialog = {
                      ...dialog, customFill: { c: event.detail.color, a: event.detail.opacity },
                    };
                  }}></hp-color-opacity>
                ${dialog.customFill ? html`<button class="btn ghost" type="button"
                  @click=${() => (this.host._spaceDialog = { ...dialog, customFill: null })}>
                  ${this.host._t('btn.reset')}</button>` : nothing}
              </div>` : nothing}`,
          )}
          <label class="srcrow">
            ${this._boolInput(dialog.glowEnabled, (checked) => {
              this.host._spaceDialog = { ...dialog, glowEnabled: checked };
            })}
            <span>${this.host._t('space.glow_enabled')}</span>
          </label>
          ${dialog.deleteBlockers ? html`<div class="backuperror" role="alert">
            ${this.host._t('space.delete_blocked', { n: String(dialog.deleteBlockers) })}
          </div>` : nothing}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${dialog.mode === 'edit' ? html`<div class="dialog-action-group dialog-action-danger">
            <button class="btn danger" @click=${() => this._deleteSpace()} ?disabled=${dialog.busy}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
            </button>
          </div>` : nothing}
          <div class="dialog-action-group dialog-action-commit">
            ${this.host._importTotal > 0 && dialog.mode === 'create'
              ? html`<button class="btn ghost" @click=${() => this._skipImport()}>
                  ${this.host._t('btn.skip')}</button>` : nothing}
            <button class="btn ghost" @click=${close}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" @click=${() => this._saveSpaceDialog()}
              ?disabled=${!dialog.title.trim()
                || (dialog.source === 'file' && !(dialog.planFile || dialog.planUrl)) || dialog.busy}
              title=${dialog.source === 'file' && !(dialog.planFile || dialog.planUrl)
                ? this.host._t('title.need_plan') : ''}>
              <ha-icon icon="mdi:check"></ha-icon>${dialog.busy ? '…' : this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }
}
