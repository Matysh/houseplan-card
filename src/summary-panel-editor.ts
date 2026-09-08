import { html, nothing, type TemplateResult } from 'lit';
import type { SummaryPanelConfig, SummaryPanelSource } from './types';
import {
  type SummaryDraftProblem, type SummaryPanelLocalPreferences,
  moveSummaryItem, newSummaryBlock, newSummaryValue,
  normalizeSummaryDraft, sameSummaryPanel,
} from './summary-panel';
import type { SummaryPanelDialogState } from './summary-panel-runtime-loaded';
import type { SummaryPanelHost } from './summary-panel-host';
import {
  searchSummaryEntityIndex, type SummaryEntityIndex,
} from './summary-panel-picker';

export type SummaryPanelEditorContext = {
  host: SummaryPanelHost;
  dialog: SummaryPanelDialogState;
  local: SummaryPanelLocalPreferences;
  storageUnavailable: boolean;
  problems: SummaryDraftProblem[];
  entityIndex: SummaryEntityIndex;
  setDialog(dialog: SummaryPanelDialogState | null): void;
  saveLocal(patch: Partial<SummaryPanelLocalPreferences>): void;
  mutate(mutate: (draft: SummaryPanelConfig) => void): void;
  deleteBlock(index: number): void;
  dragStart(event: DragEvent, token: string): void;
  drop(event: DragEvent, target: string): void;
  sourceToken(source: SummaryPanelSource): string;
  openSource(blockId: string, valueId: string): void;
  closeSource(returnFocus?: boolean): void;
  setSource(blockId: string, valueId: string, token: string): void;
  save(): void;
  reload(): void;
  close(): void;
  t(key: string): string;
};

export type SummaryPanelEditorRenderer = (
  context: SummaryPanelEditorContext,
) => TemplateResult | typeof nothing;

/** Lazy settings surface for #437; imported only after the gear is pressed. */
export const renderSummaryPanelEditor: SummaryPanelEditorRenderer = (context) => {
  const { host, dialog, local, problems, t } = context;
  const firstError = problems.find((problem) => problem.kind === 'error');
  const changed = dialog.localShow !== dialog.baseLocalShow
    || !dialog.localOnly && !sameSummaryPanel(normalizeSummaryDraft(dialog.draft), dialog.base);
  const canSave = changed && !dialog.busy && !firstError;
  const fieldProblem = (path: string) => problems.find((problem) => problem.path === path);
  const problemText = (problem: SummaryDraftProblem | undefined) => problem
    ? t(`summary.problem.${problem.code}`) : '';
  const close = () => context.close();
  const showRow = html`<label class="summary-switch"><input type="checkbox"
      .checked=${dialog.localShow}
      @change=${(event: Event) => context.setDialog({
        ...dialog, localShow: (event.target as HTMLInputElement).checked,
      })} />
    <span>${t('summary.show_local')}</span></label>`;
  const sizeRows = html`<h3 class="summary-sizes-title">${t('summary.sizes_title')}</h3>
    <div class="summary-local-sizes">
      <div class="summary-size-field">
        <div><label for="summary-icon-scale">${t('kiosk.icon_scale')}</label>
          <output for="summary-icon-scale">${Math.round(local.icon_scale * 100)}%</output></div>
        <input id="summary-icon-scale" type="range" min="50" max="300" step="5"
          .value=${String(Math.round(local.icon_scale * 100))}
          @input=${(event: Event) => context.saveLocal({
            icon_scale: Number((event.target as HTMLInputElement).value) / 100,
          })} />
      </div>
      <div class="summary-size-field">
        <div><label for="summary-font-scale">${t('kiosk.font_scale')}</label>
          <output for="summary-font-scale">${Math.round(local.font_scale * 100)}%</output></div>
        <input id="summary-font-scale" type="range" min="50" max="300" step="5"
          .value=${String(Math.round(local.font_scale * 100))}
          @input=${(event: Event) => context.saveLocal({
            font_scale: Number((event.target as HTMLInputElement).value) / 100,
          })} />
      </div>
      <button class="btn ghost summary-size-reset" type="button"
        @click=${() => context.saveLocal({ icon_scale: 1, font_scale: 1 })}>${t('gs.reset')}</button>
    </div>
    ${context.storageUnavailable
      ? html`<div class="summary-problem warning">${t('summary.storage_unavailable')}</div>` : nothing}`;
  return html`<hp-dialog .hass=${host.hass} data-kind="summary"
      .title=${t('summary.settings')}
      icon="mdi:view-dashboard-outline" dismiss-on-scrim aria-busy=${String(dialog.busy)}
      @hp-close=${close}>
    <div class="body summary-editor" @click=${() => context.closeSource()}>
      ${dialog.localOnly ? html`<p class="rhint">${t(
        dialog.localOnlyHint,
      )}</p>` : nothing}
      ${dialog.localOnly ? html`${showRow}${sizeRows}` : html`
        <label>${t('summary.panel_title')}</label>
        <input type="text" .value=${dialog.draft.title}
          data-summary-error=${String(dialog.attempted && firstError?.path === 'title')}
          aria-invalid=${fieldProblem('title')?.kind === 'error' ? 'true' : 'false'}
          @input=${(event: Event) => context.mutate((draft) => {
            draft.title = (event.target as HTMLInputElement).value;
          })} />
        ${fieldProblem('title')
          ? html`<div class="summary-problem error">${problemText(fieldProblem('title'))}</div>` : nothing}
        ${showRow}
        <label class="summary-switch"><input type="checkbox" .checked=${dialog.draft.show_on_mobile}
          @change=${(event: Event) => context.mutate((draft) => {
            draft.show_on_mobile = (event.target as HTMLInputElement).checked;
          })} />
          <span>${t('summary.show_mobile')}</span></label>
        ${sizeRows}
        <div class="summary-editor-blocks">
          ${dialog.draft.blocks.map((block, bi) => {
            const bp = `blocks.${bi}`;
            const scopeProblem = fieldProblem(`${bp}.scope`);
            return html`<article class="summary-editor-block"
                @dragover=${(event: DragEvent) => event.preventDefault()}
                @drop=${(event: DragEvent) => context.drop(event, `block:${bi}`)}>
              <div class="summary-editor-row summary-block-head">
                <span class="summary-drag" draggable="true" title=${t('summary.drag')}
                  @dragstart=${(event: DragEvent) => context.dragStart(event, `block:${bi}`)}>⋮⋮</span>
                <input type="text" .value=${block.title}
                  placeholder=${t('summary.block_title')}
                  data-summary-error=${String(dialog.attempted && firstError?.path === `${bp}.title`)}
                  @input=${(event: Event) => context.mutate((draft) => {
                    draft.blocks[bi].title = (event.target as HTMLInputElement).value;
                  })} />
                <button type="button" title=${t('summary.up')} ?disabled=${bi === 0}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks = moveSummaryItem(draft.blocks, bi, bi - 1);
                  })}>↑</button>
                <button type="button" title=${t('summary.down')}
                  ?disabled=${bi === dialog.draft.blocks.length - 1}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks = moveSummaryItem(draft.blocks, bi, bi + 1);
                  })}>↓</button>
                <button type="button" title=${t('btn.delete')}
                  @click=${() => context.deleteBlock(bi)}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
              </div>
              ${fieldProblem(`${bp}.title`)
                ? html`<div class="summary-problem error">${problemText(fieldProblem(`${bp}.title`))}</div>` : nothing}
              <div class="summary-editor-row">
                <label class="summary-switch"><input type="checkbox" .checked=${block.visible}
                  @change=${(event: Event) => context.mutate((draft) => {
                    draft.blocks[bi].visible = (event.target as HTMLInputElement).checked;
                  })} />
                  <span>${t('summary.block_visible')}</span></label>
                <select .value=${block.scope.type}
                  @change=${(event: Event) => context.mutate((draft) => {
                    draft.blocks[bi].scope = (event.target as HTMLSelectElement).value === 'space'
                      ? { type: 'space', space_id: host._space } : { type: 'all' };
                  })}>
                  <option value="all" ?selected=${block.scope.type === 'all'}>${t('summary.scope_all')}</option>
                  <option value="space" ?selected=${block.scope.type === 'space'}>${t('summary.scope_space')}</option>
                </select>
                ${block.scope.type === 'space' ? html`<select .value=${block.scope.space_id}
                  data-summary-error=${String(dialog.attempted && firstError?.path === `${bp}.scope`)}
                  @change=${(event: Event) => context.mutate((draft) => {
                    const scope = draft.blocks[bi].scope;
                    if (scope.type === 'space') scope.space_id = (event.target as HTMLSelectElement).value;
                  })}>
                ${!host._model.some((space) => space.id === block.scope.space_id)
                    ? html`<option value=${block.scope.space_id} selected>${block.scope.space_id}</option>` : nothing}
                ${host._model.map((space) => html`<option value=${space.id}
                    ?selected=${space.id === block.scope.space_id}>${space.title}</option>`)}
                </select>` : nothing}
              </div>
              ${scopeProblem
                ? html`<div class="summary-problem ${scopeProblem.kind}">${problemText(scopeProblem)}</div>` : nothing}
              <div class="summary-editor-values">
                ${block.values.map((value, vi) => {
                  const vp = `${bp}.values.${vi}`;
                  const sourceProblem = fieldProblem(`${vp}.source`);
                  const sourceToken = context.sourceToken(value.source);
                  const active = dialog.activeSource?.blockId === block.id
                    && dialog.activeSource.valueId === value.id;
                  const sourceLabel = value.source.type === 'system'
                    ? t(`summary.system.${value.source.key}`)
                    : value.source.entity_id
                      ? `${context.entityIndex.labels.get(value.source.entity_id)
                        || value.source.entity_id} — ${value.source.entity_id}`
                      : t('summary.select_source');
                  const search = active
                    ? searchSummaryEntityIndex(context.entityIndex, dialog.entityFilter) : null;
                  const broken = value.source.type === 'entity' && !!value.source.entity_id
                    && !context.entityIndex.labels.has(value.source.entity_id);
                  const owner = `${block.id}\n${value.id}`;
                  return html`<div class="summary-editor-value"
                      @dragover=${(event: DragEvent) => { event.preventDefault(); event.stopPropagation(); }}
                      @drop=${(event: DragEvent) => context.drop(event, `value:${bi}:${vi}`)}>
                    <div class="summary-editor-row">
                      <span class="summary-drag" draggable="true" title=${t('summary.drag')}
                        @dragstart=${(event: DragEvent) => context.dragStart(event, `value:${bi}:${vi}`)}>⋮⋮</span>
                      <input type="text" .value=${value.label}
                        placeholder=${t('summary.value_name')}
                        data-summary-error=${String(dialog.attempted && firstError?.path === `${vp}.label`)}
                        @input=${(event: Event) => context.mutate((draft) => {
                          draft.blocks[bi].values[vi].label = (event.target as HTMLInputElement).value;
                        })} />
                      <button type="button" title=${t('summary.up')} ?disabled=${vi === 0}
                        @click=${() => context.mutate((draft) => {
                          draft.blocks[bi].values = moveSummaryItem(draft.blocks[bi].values, vi, vi - 1);
                        })}>↑</button>
                      <button type="button" title=${t('summary.down')} ?disabled=${vi === block.values.length - 1}
                        @click=${() => context.mutate((draft) => {
                          draft.blocks[bi].values = moveSummaryItem(draft.blocks[bi].values, vi, vi + 1);
                        })}>↓</button>
                      <button type="button" title=${t('btn.delete')}
                        @click=${() => context.mutate((draft) => {
                          draft.blocks[bi].values.splice(vi, 1);
                        })}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
                    </div>
                    ${fieldProblem(`${vp}.label`)
                      ? html`<div class="summary-problem error">${problemText(fieldProblem(`${vp}.label`))}</div>` : nothing}
                    <button class="summary-source" type="button"
                      data-summary-source-owner=${owner}
                      data-summary-error=${String(dialog.attempted && firstError?.path === `${vp}.source`)}
                      aria-haspopup="listbox" aria-expanded=${active ? 'true' : 'false'}
                      @click=${(event: Event) => {
                        event.stopPropagation();
                        if (active) context.closeSource(); else context.openSource(block.id, value.id);
                      }}>
                      <span>${sourceLabel}</span><ha-icon icon="mdi:chevron-down"></ha-icon>
                    </button>
                    ${active && search ? html`<div class="summary-source-picker"
                        @click=${(event: Event) => event.stopPropagation()}
                        @keydown=${(event: KeyboardEvent) => {
                          if (event.key !== 'Escape') return;
                          event.preventDefault(); event.stopPropagation(); context.closeSource(true);
                        }}>
                      <label>${t('summary.search_entities')}</label>
                      <input type="search" data-summary-picker-search
                        aria-label=${t('summary.search_entities')} .value=${dialog.entityFilter}
                        @input=${(event: Event) => context.setDialog({
                          ...dialog, entityFilter: (event.target as HTMLInputElement).value,
                        })} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${t('summary.select_source')}>
                        <div class="summary-source-group">${t('summary.system_group')}</div>
                        ${(['device_count', 'total_area', 'datetime'] as const).map((key) => html`
                          <button type="button" role="option"
                            aria-selected=${sourceToken === `system:${key}` ? 'true' : 'false'}
                            @click=${() => context.setSource(block.id, value.id, `system:${key}`)}>
                            ${t(`summary.system.${key}`)}
                          </button>`)}
                        ${broken ? html`<div class="summary-source-group">${t('summary.current_source')}</div>
                          <button type="button" role="option" class="broken" aria-selected="true"
                            @click=${() => context.setSource(block.id, value.id, sourceToken)}>
                            ${sourceLabel}
                          </button>` : nothing}
                        <div class="summary-source-group">${t('summary.entities_group')}</div>
                        ${search.entries.map((entry) => html`<button type="button" role="option"
                            aria-selected=${sourceToken === `entity:${entry.id}` ? 'true' : 'false'}
                            @click=${() => context.setSource(block.id, value.id, `entity:${entry.id}`)}>
                          <span>${entry.label}</span><small>${entry.id}</small>
                        </button>`)}
                        ${!search.total ? html`<div class="summary-empty">${t('summary.no_search_results')}</div>` : nothing}
                        ${search.truncated ? html`<div class="summary-refine">${t('summary.refine_search')}</div>` : nothing}
                      </div>
                    </div>` : nothing}
                    ${sourceProblem
                      ? html`<div class="summary-problem ${sourceProblem.kind}">${problemText(sourceProblem)}</div>` : nothing}
                  </div>`;
                })}
                <button class="btn ghost summary-add" type="button"
                  ?disabled=${block.values.length >= 20}
                  title=${block.values.length >= 20 ? t('summary.limit_values') : ''}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks[bi].values.push(newSummaryValue(t));
                  })}>
                  <ha-icon icon="mdi:plus"></ha-icon>${t('summary.add_value')}
                </button>
              </div>
            </article>`;
          })}
        </div>
        <button class="btn ghost summary-add" type="button"
          ?disabled=${dialog.draft.blocks.length >= 10}
          title=${dialog.draft.blocks.length >= 10 ? t('summary.limit_blocks') : ''}
          @click=${() => context.mutate((draft) => {
            draft.blocks.push(newSummaryBlock(t));
          })}>
          <ha-icon icon="mdi:plus"></ha-icon>${t('summary.add_block')}
        </button>
        ${dialog.error ? html`<div class="summary-problem error" role="alert">${dialog.error}</div>` : nothing}
        ${dialog.conflict ? html`<button class="btn ghost summary-reload" type="button"
          ?disabled=${dialog.busy} @click=${() => context.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${t('summary.reload_current')}
        </button>` : nothing}
      `}
    </div>
    <div class="row" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${dialog.busy} @click=${close}>${t('btn.cancel')}</button>
      <span class="spacer"></span>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${dialog.localOnly ? !changed || dialog.busy : !canSave}
        @click=${() => context.save()}><ha-icon icon="mdi:check"></ha-icon>${t('btn.save')}</button>
    </div>
  </hp-dialog>`;
};
