import { html, nothing, svg, type TemplateResult } from 'lit';

import { classifyPlanFile } from './backdrop-pick';
import {
  adoptDecorAssets, initialDecorImageCm, type DecorAsset,
} from './decor-assets';
import {
  FURNITURE_GROUPS, furnitureGraphic, furnitureOfGroup,
  furnitureSignedFieldCm, furnitureSignedFieldValue, type FurnitureGroup,
} from './furniture';
import { GENERATED_FURNITURE_MENU } from './furniture-menu-art.generated';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { I18nKey } from './i18n';
import { CANVAS_LIMIT, NORM_W, clampCanvasN } from './space-geometry';
import type { DecorShape } from './editors/decor/types';
import { decorCmToUnits } from './editors/decor/geometry';

interface DecorImageEditorHooks<Snapshot> {
  decorSnap: (raw: number[], pointerType?: string) => number[];
  geometrySnapshot: () => Snapshot;
  clearFurniturePreview: () => void;
  recordGeometry: (name: string, before: Snapshot) => void;
  saveConfig: () => void;
  saveShape: () => void;
  setGuardReplace: (replace: boolean | null) => void;
  furnShiftDetach: () => void;
  furnPick: (symbol: string) => void;
  furnFieldValue: (cm: number) => number;
  furnFieldToCm: (value: number) => number;
}

/**
 * Asset lifecycle and the two large decor palettes live outside the editor
 * runtime core. The runtime owns orchestration; this controller owns the
 * self-contained image/furniture UI introduced by #51.
 */
export class DecorImageEditor<Snapshot> {
  public constructor(
    private readonly host: HouseplanEditorHostPort,
    private readonly hooks: DecorImageEditorHooks<Snapshot>,
  ) {}

  public place(raw: number[], pointerType = 'mouse'): void {
    const asset = this.host._decorImagePalette;
    const sp = this.host._curSpaceCfg;
    if (!asset || !sp) return;
    const at = this.hooks.decorSnap(raw, pointerType);
    const size = initialDecorImageCm(asset.width, asset.height);
    const w = decorCmToUnits(size.w, this.host._cellCm, this.host._gridPitch) / NORM_W;
    const h = decorCmToUnits(size.h, this.host._cellCm, this.host._gridPitch)
      / this.host._decorH;
    const id = 'di' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const before = this.hooks.geometrySnapshot();
    sp.decor = [...this.host._decorList, {
      id, kind: 'image', asset_id: asset.asset_id,
      x: clampCanvasN(at[0] / NORM_W - w / 2),
      y: clampCanvasN(at[1] / this.host._decorH - h / 2),
      w, h, opacity: 1,
    } as DecorShape];
    this.host._decorSel = id;
    this.host._decorTool = 'select';
    this.host._decorImagePalette = null;
    this.hooks.clearFurniturePreview();
    this.hooks.recordGeometry(this.host._t('history.decor_add'), before);
    this.hooks.saveConfig();
    this.host.requestUpdate();
  }

  public renderPlacementPreview(): TemplateResult | typeof nothing {
    const input = this.host._furnPreviewInput;
    const asset = this.host._decorImagePalette;
    if (!input || !asset || this.host._mode !== 'decor'
        || this.host._decorTool !== 'image' || !this.host._pointerModality.hoverEnabled) {
      return nothing;
    }
    const at = this.hooks.decorSnap(input.raw, 'mouse');
    const cm = initialDecorImageCm(asset.width, asset.height);
    const w = decorCmToUnits(cm.w, this.host._cellCm, this.host._gridPitch) / NORM_W;
    const h = decorCmToUnits(cm.h, this.host._cellCm, this.host._gridPitch)
      / this.host._decorH;
    const href = this.host._display(asset.url);
    if (!href) return nothing;
    return svg`<image class="decor-image-placement-preview" href=${href}
      x=${at[0] - w * NORM_W / 2} y=${at[1] - h * this.host._decorH / 2}
      width=${w * NORM_W} height=${h * this.host._decorH}
      opacity="0.65" preserveAspectRatio="none" pointer-events="none"></image>`;
  }

  public renderMissing(
    shape: Extract<DecorShape, { kind: 'image' }>, cls: string, transform: string,
    x: number, y: number, w: number, h: number,
    down: (event: PointerEvent) => void, dbl: (event: MouseEvent) => void,
  ): TemplateResult {
    const cx = x + w / 2;
    const cy = y + h / 2;
    return svg`<g class="${cls} dimage-missing"
      data-hp="decor" data-id=${shape.id} data-kind="image" transform=${transform}
      @pointerdown=${down} @dblclick=${dbl}>
      <title>${this.host._t('decor.image_unavailable')}</title>
      <rect x=${x} y=${y} width=${w} height=${h}></rect>
      <path d=${`M${x} ${y}L${x + w} ${y + h}M${x + w} ${y}L${x} ${y + h}`}></path>
      <text class="dimage-missing-label" x=${cx} y=${cy}
        fill="var(--primary-text-color, #333)" stroke="var(--card-background-color, #fff)"
        stroke-width="2" paint-order="stroke" pointer-events="none"
        font-size=${Math.min(18, h * 0.25)} text-anchor="middle" dominant-baseline="middle"
        textLength=${Math.max(1, Math.min(w * 0.8, 160))}
        lengthAdjust="spacingAndGlyphs">${this.host._t('decor.image_unavailable')}</text>
    </g>`;
  }

  public async uploadFromInput(ev: Event, replaceSelection = false): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.host._decorAssetBusy) return;
    let classified: Awaited<ReturnType<typeof classifyPlanFile>>;
    try {
      classified = await classifyPlanFile(file, 2 * 1024 * 1024);
    } catch {
      this.host._showToast(this.host._t('backup.error.invalid_image'));
      return;
    }
    if (classified.kind === 'reject') {
      this.host._showToast(this.host._t('toast.plan_formats'));
      return;
    }
    if (classified.kind === 'guard') {
      this.hooks.setGuardReplace(replaceSelection);
      this.host._backdropGuard = classified.state;
      return;
    }
    await this.upload(file, file.name, replaceSelection);
  }

  public async upload(file: Blob, name: string, replaceSelection: boolean): Promise<void> {
    if (this.host._decorAssetBusy) return;
    this.host._decorAssetBusy = true;
    try {
      const body = new FormData();
      body.append('file', file, name);
      const response: Response = this.host.hass?.fetchWithAuth
        ? await this.host.hass.fetchWithAuth('/api/houseplan/assets/upload', { method: 'POST', body })
        : await fetch('/api/houseplan/assets/upload', {
            method: 'POST', body,
            headers: this.host.hass?.auth?.data?.access_token
              ? { authorization: `Bearer ${this.host.hass.auth.data.access_token}` } : {},
          });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error || !data.asset) {
        const messages: Record<string, I18nKey> = {
          invalid_format: 'backup.error.invalid_image',
          invalid_image: 'backup.error.invalid_image',
          unsupported_image: 'backup.error.unsupported_image',
          too_large: 'backdrop.too_large_title',
          capacity_exceeded: 'decor.image_error_capacity',
        };
        throw new Error(this.host._t(messages[String(data.error)] || 'backup.error.io_error'));
      }
      const asset = adoptDecorAssets({ assets: [data.asset] }).values().next().value as
        DecorAsset | undefined;
      if (!asset) throw new Error(this.host._t('backup.error.io_error'));
      this.host._decorAssets = new Map(this.host._decorAssets).set(asset.asset_id, asset);
      this.host._decorAssetCatalog = [
        asset, ...this.host._decorAssetCatalog.filter((item) => item.asset_id !== asset.asset_id),
      ];
      if (replaceSelection && this.host._decorShapeDialog?.kind === 'image') {
        this.host._decorShapeDialog = { ...this.host._decorShapeDialog, assetId: asset.asset_id };
      } else {
        this.host._decorImagePalette = asset;
      }
      this.host.requestUpdate();
    } catch (error) {
      this.host._showToast(this.host._t('decor.image_upload_failed', {
        err: this.host._errText(error),
      }));
    } finally {
      this.host._decorAssetBusy = false;
    }
  }

  public async delete(asset: DecorAsset): Promise<void> {
    if (asset.used_by?.length) {
      this.host._showToast(this.host._t('decor.image_in_use'));
      return;
    }
    const accepted = await this.host._confirmDanger({
      key: `delete-decor-asset:${asset.asset_id}`,
      kind: 'destructive',
      title: this.host._t('decor.image_delete_title'),
      message: this.host._t('decor.image_delete_message', { name: asset.name }),
      confirmLabel: this.host._t('btn.delete'),
      cancelLabel: this.host._t('btn.cancel'),
    });
    if (!accepted) return;
    try {
      await this.host.hass.callWS({ type: 'houseplan/assets/delete', asset_id: asset.asset_id });
      this.host._decorAssetCatalog = this.host._decorAssetCatalog.filter(
        (item) => item.asset_id !== asset.asset_id,
      );
      this.host._decorAssets.delete(asset.asset_id);
      if (this.host._decorImagePalette?.asset_id === asset.asset_id) {
        this.host._decorImagePalette = null;
      }
      this.host.requestUpdate();
    } catch (error) {
      this.host._showToast((error as { code?: string })?.code === 'in_use'
        ? this.host._t('decor.image_in_use') : this.host._t('backup.error.io_error'));
    }
  }

  public async loadCatalog(): Promise<void> {
    try {
      const response = await this.host.hass.callWS({ type: 'houseplan/assets/list' });
      const catalog = adoptDecorAssets(response);
      this.host._decorAssetCatalog = [...catalog.values()];
      this.host._decorAssets = new Map([...this.host._decorAssets, ...catalog]);
      this.host.requestUpdate();
    } catch {
      this.host._showToast(this.host._t('backup.error.io_error'));
    }
  }

  public renderImagePalette(): TemplateResult {
    const armed = this.host._decorImagePalette;
    return html`<div class="furnpalette imagepalette" role="dialog"
      aria-label=${this.host._t('decor.image_title')}
      @pointerdown=${(event: Event) => event.stopPropagation()}>
      <div class="furnhd"><ha-icon icon="mdi:image-plus-outline"></ha-icon>${this.host._t('decor.image_title')}
        <span class="spacer"></span>
        <button class="btn furnclose" title=${this.host._t('btn.close')} @click=${() => {
          this.host._decorImagePalette = null;
          this.hooks.clearFurniturePreview();
          this.host._decorTool = 'select';
        }}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="furnbody">
        <label class="btn primary imageupload ${this.host._decorAssetBusy ? 'disabled' : ''}">
          <ha-icon icon="mdi:upload"></ha-icon>${this.host._t(
            this.host._decorAssetBusy ? 'decor.image_uploading' : 'decor.image_upload',
          )}
          <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            ?disabled=${this.host._decorAssetBusy}
            @change=${(event: Event) => this.uploadFromInput(event)} />
        </label>
        <div class="furnrow imageassets">
          ${this.host._decorAssetCatalog.length ? nothing
            : html`<span class="furnhint imageempty">${this.host._t('decor.image_none')}</span>`}
          ${this.host._decorAssetCatalog.map((asset) => html`<div class="imageasset">
            <button class="furnitem ${armed?.asset_id === asset.asset_id ? 'on' : ''}"
              title=${asset.name} @click=${() => {
                this.host._decorImagePalette = asset;
                this.host.requestUpdate();
              }}>
              <img src=${this.host._display(asset.url)} alt="" /><span>${asset.name}</span>
              ${asset.used_by?.length ? html`<small>${this.host._t(
                'decor.image_used', { n: asset.used_by.length },
              )}</small>` : nothing}
            </button>
            <button class="btn ghost imageassetdelete" title=${this.host._t('btn.delete')}
              ?disabled=${!!asset.used_by?.length}
              @click=${() => this.delete(asset)}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
          </div>`)}
        </div>
      </div>
      <div class="furnsize"><span class="furnhint">${this.host._t(
        armed ? 'decor.image_place_hint' : 'decor.image_pick_hint',
      )}</span></div>
    </div>`;
  }

  public renderFurniturePalette(): TemplateResult {
    const pal = this.host._furnPalette;
    const categoryId = this.host._furnCategory;
    const allSymbols = FURNITURE_GROUPS.flatMap((group) => furnitureOfGroup(group));
    const categories = GENERATED_FURNITURE_MENU.filter((item) =>
      allSymbols.some((symbol) => symbol.category === item.id));
    const category = categories.find((item) => item.id === categoryId) || null;
    const variants = category
      ? allSymbols.filter((symbol) => symbol.category === category.id)
      : [];
    const unit = this.host._t(this.host._imperial ? 'gs.unit_ft' : 'gs.unit_m');
    const preview = (id: string): TemplateResult => {
      const art = furnitureGraphic(id);
      if (!art) {
        return svg`<svg class="furnprev" aria-hidden="true"></svg>` as unknown as TemplateResult;
      }
      return svg`<svg class="furnprev" viewBox=${`0 0 ${art.viewW} ${art.viewH}`}
        preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path
        d=${art.d} fill="none" stroke="currentColor" stroke-width="1.2"
        vector-effect="non-scaling-stroke" stroke-linecap="round"
        stroke-linejoin="round"></path></svg>` as unknown as TemplateResult;
    };
    const categoryPreview = (item: (typeof GENERATED_FURNITURE_MENU)[number]): TemplateResult =>
      svg`<svg class="furnprev furncatprev" viewBox=${`0 0 ${item.art.viewW} ${item.art.viewH}`}
        preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path
        d=${item.art.d} fill="none" stroke="currentColor" stroke-width="1.5"
        vector-effect="non-scaling-stroke" stroke-linecap="round"
        stroke-linejoin="round"></path></svg>` as unknown as TemplateResult;
    return html`<div class="furnpalette" @pointerdown=${(event: Event) => event.stopPropagation()}>
      <div class="furnhd">
        <ha-icon icon="mdi:sofa-outline"></ha-icon>${this.host._t('furn.title')}
        <span class="spacer"></span>
        <button class="btn furnclose" title=${this.host._t('btn.close')}
          @click=${() => {
            this.hooks.clearFurniturePreview();
            this.host._furnPalette = null;
            this.hooks.furnShiftDetach();
            this.host._furnCategory = null;
            this.host._decorTool = 'select';
          }}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="furnbody">
        ${category ? html`
          <button class="btn ghost furnback" @click=${() => {
            this.hooks.clearFurniturePreview();
            this.host._furnPalette = null;
            this.hooks.furnShiftDetach();
            this.host._furnCategory = null;
          }}>
            <ha-icon icon="mdi:arrow-left"></ha-icon>${this.host._t('furn.back_to_categories')}
          </button>
          <div class="furngroup" data-category=${category.id}>
            ${this.host._t(`furn.cat_${category.id}` as I18nKey)}
          </div>
          <div class="furnrow furnvariants">
            ${variants.map((symbol) => html`<button
              class="furnitem ${pal?.symbol === symbol.id ? 'on' : ''}" data-symbol=${symbol.id}
              title=${this.host._t(`furn.sym_${symbol.id}` as I18nKey)}
              @click=${() => this.hooks.furnPick(symbol.id)}>
              ${preview(symbol.id)}<span>${this.host._t(`furn.sym_${symbol.id}` as I18nKey)}</span>
            </button>`)}
          </div>
        ` : FURNITURE_GROUPS.map((group) => html`
          <div class="furngroup" data-group=${group}>${this.host._t(`furn.group_${group}` as I18nKey)}</div>
          <div class="furnrow furncategories">
            ${categories.filter((item) => item.group === group).map((item) => html`<button
              class="furnitem furncategory" data-category=${item.id}
              title=${this.host._t(`furn.cat_${item.id}` as I18nKey)}
              @click=${() => {
                this.hooks.clearFurniturePreview();
                this.host._furnPalette = null;
                this.hooks.furnShiftDetach();
                this.host._furnCategory = item.id;
              }}>
              ${categoryPreview(item)}<span>${this.host._t(`furn.cat_${item.id}` as I18nKey)}</span>
            </button>`)}
          </div>`)}
      </div>
      ${pal ? html`<div class="furnsize">
        <label>${this.host._t('furn.width')}<span class="furnunit">${unit}</span></label>
        <input class="namein furnw" type="number" min="0.01" step="0.05"
          .value=${String(this.hooks.furnFieldValue(pal.w))}
          @input=${(event: Event) => (this.host._furnPalette = {
            ...pal,
            w: this.hooks.furnFieldToCm(Number((event.target as HTMLInputElement).value)),
          })} />
        <label>${this.host._t('furn.depth')}<span class="furnunit">${unit}</span></label>
        <input class="namein furnh" type="number" min="0.01" step="0.05"
          .value=${String(this.hooks.furnFieldValue(pal.h))}
          @input=${(event: Event) => (this.host._furnPalette = {
            ...pal,
            h: this.hooks.furnFieldToCm(Number((event.target as HTMLInputElement).value)),
          })} />
        <span class="furnhint">${this.host._t('furn.place_hint')}</span>
      </div>` : html`<div class="furnsize"><span class="furnhint">${this.host._t(
        'furn.pick_hint',
      )}</span></div>`}
    </div>`;
  }

  private furnitureSizeInput(axis: 'w' | 'h', raw: string): void {
    const dialog = this.host._decorShapeDialog;
    if (!dialog || (dialog.kind !== 'furniture' && dialog.kind !== 'image')) return;
    const cm = furnitureSignedFieldCm(
      raw, this.host._imperial, CANVAS_LIMIT * this.host._cellCm,
    );
    const field = axis === 'w' ? 'sizeWField' : 'sizeHField';
    const size = axis === 'w' ? 'sizeWCm' : 'sizeHCm';
    const flip = axis === 'w' ? 'flipH' : 'flipV';
    this.host._decorShapeDialog = {
      ...dialog,
      [field]: raw,
      ...(cm === null ? {} : { [size]: Math.abs(cm), [flip]: cm < 0 }),
    };
  }

  private furnitureFlip(axis: 'w' | 'h', checked: boolean): void {
    const dialog = this.host._decorShapeDialog;
    if (!dialog || (dialog.kind !== 'furniture' && dialog.kind !== 'image')) return;
    const raw = axis === 'w' ? dialog.sizeWField : dialog.sizeHField;
    const parsed = furnitureSignedFieldCm(
      raw, this.host._imperial, CANVAS_LIMIT * this.host._cellCm,
    );
    const fallback = axis === 'w' ? dialog.sizeWCm : dialog.sizeHCm;
    const cm = Math.abs(parsed ?? fallback ?? 0.1);
    const field = axis === 'w' ? 'sizeWField' : 'sizeHField';
    const flip = axis === 'w' ? 'flipH' : 'flipV';
    this.host._decorShapeDialog = {
      ...dialog,
      [field]: furnitureSignedFieldValue(cm, checked, this.host._imperial),
      [flip]: checked,
    };
  }

  public renderShapeDialog(): TemplateResult {
    const dialog = this.host._decorShapeDialog!;
    const canFill = dialog.kind === 'rect' || dialog.kind === 'ellipse';
    const kindLabel = this.host._t(`decor.${dialog.kind}` as I18nKey);
    const unit = this.host._t(this.host._imperial ? 'gs.unit_ft' : 'gs.unit_m');
    const furnitureWcm = dialog.kind === 'furniture' || dialog.kind === 'image'
      ? furnitureSignedFieldCm(
          dialog.sizeWField, this.host._imperial, CANVAS_LIMIT * this.host._cellCm,
        ) : null;
    const furnitureHcm = dialog.kind === 'furniture' || dialog.kind === 'image'
      ? furnitureSignedFieldCm(
          dialog.sizeHField, this.host._imperial, CANVAS_LIMIT * this.host._cellCm,
        ) : null;
    const invalidFurnitureSize = (dialog.kind === 'furniture' || dialog.kind === 'image')
      && (furnitureWcm === null || furnitureHcm === null);
    const selectedImage = dialog.kind === 'image'
      ? this.host._decorAssetCatalog.find((asset) => asset.asset_id === dialog.assetId)
        || this.host._decorAssets.get(dialog.assetId || '')
      : null;
    return html`<hp-dialog .hass=${this.host.hass}
      .title=${this.host._t('decor.object_title', { kind: kindLabel })} icon="mdi:pencil-outline"
      dismiss-on-scrim @hp-close=${() => (this.host._decorShapeDialog = null)}>
        <div class="body">
          ${dialog.kind === 'furniture' ? html`
            <label>${this.host._t('furn.symbol')}</label>
            <select class="namein"
              @change=${(event: Event) => (this.host._decorShapeDialog = {
                ...dialog, symbol: (event.target as HTMLSelectElement).value,
              })}>
              ${GENERATED_FURNITURE_MENU.map((category) => ({
                category,
                symbols: furnitureOfGroup(category.group as FurnitureGroup)
                  .filter((symbol) => symbol.category === category.id),
              })).filter((entry) => entry.symbols.length).map(({ category, symbols }) => html`
                <optgroup label=${`${this.host._t(`furn.group_${category.group}` as I18nKey)} · ${this.host._t(`furn.cat_${category.id}` as I18nKey)}`}>
                ${symbols.map((symbol) => html`<option value=${symbol.id}
                  ?selected=${symbol.id === dialog.symbol}>
                  ${this.host._t(`furn.sym_${symbol.id}` as I18nKey)}
                </option>`)}
              </optgroup>`)}
            </select>` : dialog.kind === 'image' ? html`
            <label>${this.host._t('decor.image_asset')}</label>
            <select class="namein" .value=${dialog.assetId || ''}
              @change=${(event: Event) => (this.host._decorShapeDialog = {
                ...dialog, assetId: (event.target as HTMLSelectElement).value,
              })}>
              ${this.host._decorAssetCatalog.map((asset) => html`<option value=${asset.asset_id}
                ?selected=${asset.asset_id === dialog.assetId}>${asset.name}</option>`)}
            </select>
            ${selectedImage ? html`<div class="imagepropertypreview">
              <img src=${this.host._display(selectedImage.url)} alt=${selectedImage.name} />
              <span>${selectedImage.name}</span>
            </div>` : nothing}
            <label class="btn ghost imageupload">
              <ha-icon icon="mdi:image-refresh-outline"></ha-icon>${this.host._t('decor.image_replace')}
              <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                ?disabled=${this.host._decorAssetBusy}
                @change=${(event: Event) => this.uploadFromInput(event, true)} />
            </label>` : nothing}
          ${dialog.kind === 'image' ? html`
            <label>${this.host._t('space.opacity')}</label>
            <input class="namein" type="range" min="0" max="1" step="0.01"
              .value=${String(dialog.opacity)}
              @input=${(event: Event) => (this.host._decorShapeDialog = {
                ...dialog, opacity: Number((event.target as HTMLInputElement).value),
              })} />` : html`<hp-color-opacity .label=${this.host._t('decor.color')}
            .color=${dialog.color} .opacity=${dialog.opacity}
            .opacityLabel=${this.host._t('space.opacity')}
            .pickerLabels=${this.host._colorPickerLabels}
            @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) =>
              (this.host._decorShapeDialog = { ...dialog, ...event.detail })}></hp-color-opacity>`}
          ${dialog.kind !== 'image' ? html`<label>${this.host._t('decor.width')}</label>
          <div class="colorrow"><input class="namein" type="number"
            min=${this.host._decorSmallField(0.1)} max=${this.host._decorSmallField(100)} step="0.1"
            .value=${String(this.host._decorSmallField(dialog.widthCm))}
            @input=${(event: Event) => (this.host._decorShapeDialog = {
              ...dialog,
              widthCm: this.host._decorSmallCm(Number((event.target as HTMLInputElement).value)),
            })} /><span class="opl">${this.host._t(
              this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm',
            )}</span></div>` : nothing}
          ${dialog.kind === 'line' ? html`
            <label>${this.host._t('decor.line_style')}</label>
            <div role="radiogroup" aria-label=${this.host._t('decor.line_style')}>
              <label class="srcrow"><input type="radio" name="decor-line-style"
                .checked=${dialog.lineStyle !== 'dashed'}
                @change=${() => (this.host._decorShapeDialog = {
                  ...dialog, lineStyle: 'solid',
                })} />
                <span>${this.host._t('decor.line_style_solid')}</span></label>
              <label class="srcrow"><input type="radio" name="decor-line-style"
                .checked=${dialog.lineStyle === 'dashed'}
                @change=${() => (this.host._decorShapeDialog = {
                  ...dialog, lineStyle: 'dashed',
                })} />
                <span>${this.host._t('decor.line_style_dashed')}</span></label>
            </div>
            <label>${this.host._t('decor.length')}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this.host._decorLargeField(dialog.lengthCm || 0))}
              @input=${(event: Event) => (this.host._decorShapeDialog = {
                ...dialog,
                lengthCm: this.host._decorLargeCm(Number((event.target as HTMLInputElement).value)),
              })} />
              <span class="opl">${unit}</span></div>`
            : dialog.kind === 'furniture' || dialog.kind === 'image' ? html`
            <label>${this.host._t('decor.size')}</label>
            <div class="colorrow"><input class="namein" type="number" step="any"
              aria-invalid=${furnitureWcm === null ? 'true' : 'false'}
              .value=${dialog.sizeWField || ''}
              @input=${(event: Event) => this.furnitureSizeInput(
                'w', (event.target as HTMLInputElement).value,
              )} />
              <span>×</span><input class="namein" type="number" step="any"
              aria-invalid=${furnitureHcm === null ? 'true' : 'false'}
              .value=${dialog.sizeHField || ''}
              @input=${(event: Event) => this.furnitureSizeInput(
                'h', (event.target as HTMLInputElement).value,
              )} />
              <span class="opl">${unit}</span></div>
            <label class="dfill"><input type="checkbox" .checked=${!!dialog.flipH}
              @change=${(event: Event) => this.furnitureFlip(
                'w', (event.target as HTMLInputElement).checked,
              )} />${this.host._t('decor.flip_h')}</label>
            <label class="dfill"><input type="checkbox" .checked=${!!dialog.flipV}
              @change=${(event: Event) => this.furnitureFlip(
                'h', (event.target as HTMLInputElement).checked,
              )} />${this.host._t('decor.flip_v')}</label>` : html`
            <label>${this.host._t('decor.size')}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this.host._decorLargeField(dialog.sizeWCm || 0))}
              @input=${(event: Event) => (this.host._decorShapeDialog = {
                ...dialog,
                sizeWCm: this.host._decorLargeCm(Number((event.target as HTMLInputElement).value)),
              })} />
              <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this.host._decorLargeField(dialog.sizeHCm || 0))}
              @input=${(event: Event) => (this.host._decorShapeDialog = {
                ...dialog,
                sizeHCm: this.host._decorLargeCm(Number((event.target as HTMLInputElement).value)),
              })} />
              <span class="opl">${unit}</span></div>`}
          <label>${this.host._t('decor.angle')}</label>
          <input class="namein" type="number" min="-180" max="180" step="1"
            .value=${dialog.angle}
            @input=${(event: Event) => (this.host._decorShapeDialog = {
              ...dialog, angle: (event.target as HTMLInputElement).value,
            })} />
          ${canFill ? html`<label class="dfill"><input type="checkbox" .checked=${!!dialog.fill}
            @change=${(event: Event) => (this.host._decorShapeDialog = {
              ...dialog, fill: (event.target as HTMLInputElement).checked,
            })} />${this.host._t('decor.fill')}</label>
            <hp-color-opacity .label=${this.host._t('decor.fill_color')}
              .color=${dialog.fillColor || dialog.color} .opacity=${dialog.fillOpacity ?? 0.25}
              .opacityLabel=${this.host._t('space.opacity')}
              .pickerLabels=${this.host._colorPickerLabels} .disabled=${!dialog.fill}
              @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) =>
                (this.host._decorShapeDialog = {
                  ...dialog, fillColor: event.detail.color, fillOpacity: event.detail.opacity,
                })}></hp-color-opacity>` : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this.host._decorShapeDialog = null)}>${this.host._t('btn.cancel')}</button>
          <button class="btn primary" ?disabled=${invalidFurnitureSize}
            @click=${this.hooks.saveShape}>${this.host._t('btn.save')}</button>
        </div>
    </hp-dialog>`;
  }
}
