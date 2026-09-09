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
import { summaryIcon } from './summary-panel-icons';

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
  const { host, dialog, problems, t } = context;
  const firstError = problems.find((problem) => problem.kind === 'error');
  const changed = dialog.localShow !== dialog.baseLocalShow
    || !dialog.localOnly && !sameSummaryPanel(normalizeSummaryDraft(dialog.draft), dialog.base);
  const canSave = changed && !dialog.busy && !firstError;
  const fieldProblem = (path: string) => problems.find((problem) => problem.path === path);
  const problemText = (problem: SummaryDraftProblem | undefined) => problem
    ? t(`summary.problem.${problem.code}`) : '';
  const close = () => context.close();
  const showRow = html`<label class="summary-switch" for="summary-local-show">
    <span class="summary-switch-caption"><strong>${t('summary.show_local')}</strong>
      <small id="summary-local-show-hint">${t('summary.show_local_hint')}</small></span>
    <input id="summary-local-show" data-summary-local-show type="checkbox"
      .checked=${dialog.localShow}
      ?disabled=${dialog.busy} aria-label=${t('summary.show_local')}
      aria-describedby="summary-local-show-hint"
      @change=${(event: Event) => context.setDialog({
        ...dialog, localShow: (event.target as HTMLInputElement).checked,
      })} /></label>`;
  return html`<hp-dialog .hass=${host.hass} data-kind="summary"
      .title=${t('summary.settings')} wide flex-content
      dismiss-on-scrim aria-busy=${String(dialog.busy)}
      @hp-close=${close}>
    <div class="body summary-editor" @click=${() => context.closeSource()}>
      ${dialog.localOnly ? html`<p class="summary-local-hint">${t(
        dialog.localOnlyHint,
      )}</p>` : nothing}
      <section class="summary-general" aria-labelledby="summary-general-title">
        <h3 id="summary-general-title">${t('summary.general_settings')}</h3>
        <div class="summary-general-grid">
        ${!dialog.localOnly ? html`<div class="summary-field">
        <label for="summary-panel-title">${t('summary.panel_title')}</label>
        <input id="summary-panel-title" type="text" .value=${dialog.draft.title}
          ?disabled=${dialog.busy}
          data-summary-error=${String(dialog.attempted && firstError?.path === 'title')}
          aria-invalid=${fieldProblem('title')?.kind === 'error' ? 'true' : 'false'}
          @input=${(event: Event) => context.mutate((draft) => {
            draft.title = (event.target as HTMLInputElement).value;
          })} />
        ${fieldProblem('title')
          ? html`<div class="summary-problem error">${problemText(fieldProblem('title'))}</div>` : nothing}
        </div>` : nothing}
        ${showRow}
        ${!dialog.localOnly ? html`<label class="summary-switch" for="summary-mobile-show">
          <span class="summary-switch-caption"><strong>${t('summary.show_mobile')}</strong>
            <small id="summary-mobile-show-hint">${t('summary.show_mobile_hint')}</small></span>
          <input id="summary-mobile-show" data-summary-mobile-show type="checkbox"
          .checked=${dialog.draft.show_on_mobile} ?disabled=${!dialog.localShow || dialog.busy}
          aria-label=${t('summary.show_mobile')} aria-describedby="summary-mobile-show-hint"
          @change=${(event: Event) => context.mutate((draft) => {
            draft.show_on_mobile = (event.target as HTMLInputElement).checked;
          })} /></label>` : nothing}
        </div>
        ${context.storageUnavailable
          ? html`<div class="summary-problem warning">${t('summary.storage_unavailable')}</div>` : nothing}
      </section>
      ${!dialog.localOnly ? html`
        <section class="summary-blocks-card" aria-labelledby="summary-blocks-title">
        <header class="summary-blocks-heading">
          <div><h3 id="summary-blocks-title">${t('summary.blocks')}</h3>
            <p>${t('summary.blocks_hint')}</p></div>
          <span class="summary-block-count">${t('summary.block_count')
            .replace('{count}', String(dialog.draft.blocks.length)).replace('{limit}', '10')}</span>
        </header>
        <div class="summary-editor-blocks">
          ${dialog.draft.blocks.map((block, bi) => {
            const bp = `blocks.${bi}`;
            const scopeProblem = fieldProblem(`${bp}.scope`);
            return html`<article class="summary-editor-block"
                @dragover=${(event: DragEvent) => event.preventDefault()}
                @drop=${(event: DragEvent) => context.drop(event, `block:${bi}`)}>
              <div class="summary-block-head">
                <span class="summary-drag" draggable=${String(!dialog.busy)} title=${t('summary.drag')}
                  @dragstart=${(event: DragEvent) => context.dragStart(event, `block:${bi}`)}>${summaryIcon('grip')}</span>
                <div class="summary-order">
                <button class="summary-icon-button" type="button" title=${t('summary.up')}
                  aria-label=${t('summary.up')} ?disabled=${bi === 0 || dialog.busy}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks = moveSummaryItem(draft.blocks, bi, bi - 1);
                  })}>${summaryIcon('up')}</button>
                <button class="summary-icon-button" type="button" title=${t('summary.down')}
                  aria-label=${t('summary.down')}
                  ?disabled=${bi === dialog.draft.blocks.length - 1 || dialog.busy}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks = moveSummaryItem(draft.blocks, bi, bi + 1);
                  })}>${summaryIcon('down')}</button>
                </div>
                <input class="summary-block-title" type="text" .value=${block.title}
                  placeholder=${t('summary.block_title')} aria-label=${t('summary.block_title')}
                  ?disabled=${dialog.busy}
                  data-summary-error=${String(dialog.attempted && firstError?.path === `${bp}.title`)}
                  aria-invalid=${fieldProblem(`${bp}.title`)?.kind === 'error' ? 'true' : 'false'}
                  @input=${(event: Event) => context.mutate((draft) => {
                    draft.blocks[bi].title = (event.target as HTMLInputElement).value;
                  })} />
                <button class="summary-icon-button summary-visibility" type="button"
                  ?disabled=${dialog.busy} aria-pressed=${String(block.visible)}
                  title=${t(block.visible ? 'summary.hide_block' : 'summary.show_block')}
                  aria-label=${t(block.visible ? 'summary.hide_block' : 'summary.show_block')}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks[bi].visible = !draft.blocks[bi].visible;
                  })}>${summaryIcon(block.visible ? 'eye' : 'eyeOff')}</button>
              ${fieldProblem(`${bp}.title`)
                ? html`<div class="summary-problem error summary-block-title-error">${problemText(fieldProblem(`${bp}.title`))}</div>` : nothing}
              <div class="summary-scope">
                <select .value=${block.scope.type} ?disabled=${dialog.busy}
                  aria-label=${t('summary.scope')}
                  @change=${(event: Event) => context.mutate((draft) => {
                    draft.blocks[bi].scope = (event.target as HTMLSelectElement).value === 'space'
                      ? { type: 'space', space_id: host._space } : { type: 'all' };
                  })}>
                  <option value="all" ?selected=${block.scope.type === 'all'}>${t('summary.scope_all')}</option>
                  <option value="space" ?selected=${block.scope.type === 'space'}>${t('summary.scope_space')}</option>
                </select>
                ${block.scope.type === 'space' ? html`<select .value=${block.scope.space_id}
                  ?disabled=${dialog.busy} aria-label=${t('summary.scope_space')}
                  data-summary-error=${String(dialog.attempted && firstError?.path === `${bp}.scope`)}
                  aria-invalid=${scopeProblem?.kind === 'error' ? 'true' : 'false'}
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
                ? html`<div class="summary-problem summary-scope-problem ${scopeProblem.kind}">${problemText(scopeProblem)}</div>` : nothing}
              </div>
              <div class="summary-block-body">
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
                      ? context.entityIndex.labels.get(value.source.entity_id) || value.source.entity_id
                      : t('summary.select_source');
                  const sourceDetail = value.source.type === 'system'
                    ? t('summary.system_source') : value.source.entity_id;
                  const search = active
                    ? searchSummaryEntityIndex(context.entityIndex, dialog.entityFilter) : null;
                  const broken = value.source.type === 'entity' && !!value.source.entity_id
                    && !context.entityIndex.labels.has(value.source.entity_id);
                  const owner = `${block.id}\n${value.id}`;
                  return html`<div class="summary-editor-value"
                      @dragover=${(event: DragEvent) => { event.preventDefault(); event.stopPropagation(); }}
                      @drop=${(event: DragEvent) => context.drop(event, `value:${bi}:${vi}`)}>
                      <span class="summary-drag" draggable=${String(!dialog.busy)} title=${t('summary.drag')}
                        @dragstart=${(event: DragEvent) => context.dragStart(event, `value:${bi}:${vi}`)}>${summaryIcon('grip')}</span>
                      <div class="summary-order">
                      <button class="summary-icon-button" type="button" title=${t('summary.up')}
                        aria-label=${t('summary.up')} ?disabled=${vi === 0 || dialog.busy}
                        @click=${() => context.mutate((draft) => {
                          draft.blocks[bi].values = moveSummaryItem(draft.blocks[bi].values, vi, vi - 1);
                        })}>${summaryIcon('up')}</button>
                      <button class="summary-icon-button" type="button" title=${t('summary.down')}
                        aria-label=${t('summary.down')}
                        ?disabled=${vi === block.values.length - 1 || dialog.busy}
                        @click=${() => context.mutate((draft) => {
                          draft.blocks[bi].values = moveSummaryItem(draft.blocks[bi].values, vi, vi + 1);
                        })}>${summaryIcon('down')}</button>
                      </div>
                      <div class="summary-value-label">
                        <input type="text" .value=${value.label} ?disabled=${dialog.busy}
                          placeholder=${t('summary.value_name')} aria-label=${t('summary.value_name')}
                          data-summary-error=${String(dialog.attempted && firstError?.path === `${vp}.label`)}
                          aria-invalid=${fieldProblem(`${vp}.label`)?.kind === 'error' ? 'true' : 'false'}
                          @input=${(event: Event) => context.mutate((draft) => {
                            draft.blocks[bi].values[vi].label = (event.target as HTMLInputElement).value;
                          })} />
                        ${fieldProblem(`${vp}.label`)
                          ? html`<div class="summary-problem error">${problemText(fieldProblem(`${vp}.label`))}</div>` : nothing}
                      </div>
                    <div class="summary-source-field">
                    <button class="summary-source" type="button"
                      ?disabled=${dialog.busy}
                      data-summary-source-owner=${owner}
                      data-summary-error=${String(dialog.attempted && firstError?.path === `${vp}.source`)}
                      aria-invalid=${sourceProblem?.kind === 'error' ? 'true' : 'false'}
                      aria-haspopup="listbox" aria-expanded=${active ? 'true' : 'false'}
                      @click=${(event: Event) => {
                        event.stopPropagation();
                        if (active) context.closeSource(); else context.openSource(block.id, value.id);
                      }}>
                      <span class="summary-source-caption"><strong>${sourceLabel}</strong>
                        ${sourceDetail ? html`<small>${sourceDetail}</small>` : nothing}</span>
                      ${summaryIcon('chevron')}
                    </button>
                    ${active && search ? html`<div class="summary-source-picker"
                        @click=${(event: Event) => event.stopPropagation()}
                        @keydown=${(event: KeyboardEvent) => {
                          if (event.key !== 'Escape') return;
                          event.preventDefault(); event.stopPropagation(); context.closeSource(true);
                        }}>
                      <label>${t('summary.search_entities')}</label>
                      <input type="search" data-summary-picker-search
                        ?disabled=${dialog.busy}
                        aria-label=${t('summary.search_entities')} .value=${dialog.entityFilter}
                        @input=${(event: Event) => context.setDialog({
                          ...dialog, entityFilter: (event.target as HTMLInputElement).value,
                        })} />
                      <div class="summary-source-results" role="listbox"
                          aria-label=${t('summary.select_source')}>
                        <div class="summary-source-group">${t('summary.system_group')}</div>
                        ${(['device_count', 'total_area', 'datetime'] as const).map((key) => html`
                          <button type="button" role="option"
                            ?disabled=${dialog.busy}
                            aria-selected=${sourceToken === `system:${key}` ? 'true' : 'false'}
                            @click=${() => context.setSource(block.id, value.id, `system:${key}`)}>
                            ${t(`summary.system.${key}`)}
                          </button>`)}
                        ${broken ? html`<div class="summary-source-group">${t('summary.current_source')}</div>
                          <button type="button" role="option" class="broken" aria-selected="true"
                            ?disabled=${dialog.busy}
                            @click=${() => context.setSource(block.id, value.id, sourceToken)}>
                            ${sourceLabel}
                          </button>` : nothing}
                        <div class="summary-source-group">${t('summary.entities_group')}</div>
                        ${search.entries.map((entry) => html`<button type="button" role="option"
                            ?disabled=${dialog.busy}
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
                    </div>
                    <button class="summary-icon-button summary-value-remove" type="button"
                      title=${t('btn.delete')} aria-label=${t('btn.delete')} ?disabled=${dialog.busy}
                      @click=${() => context.mutate((draft) => {
                        draft.blocks[bi].values.splice(vi, 1);
                      })}>${summaryIcon('close')}</button>
                  </div>`;
                })}
                <button class="summary-add summary-add-value" type="button"
                  ?disabled=${block.values.length >= 20 || dialog.busy}
                  title=${block.values.length >= 20 ? t('summary.limit_values') : ''}
                  @click=${() => context.mutate((draft) => {
                    draft.blocks[bi].values.push(newSummaryValue(t));
                  })}>
                  ${summaryIcon('plus')}${t('summary.add_value')}
                </button>
              </div>
              <footer class="summary-block-footer">
                <button class="summary-delete-block" type="button" ?disabled=${dialog.busy}
                  @click=${() => context.deleteBlock(bi)}>${t('summary.delete_block')}</button>
              </footer>
              </div>
            </article>`;
          })}
        </div>
        <button class="summary-add summary-add-block" type="button"
          ?disabled=${dialog.draft.blocks.length >= 10 || dialog.busy}
          title=${dialog.draft.blocks.length >= 10 ? t('summary.limit_blocks') : ''}
          @click=${() => context.mutate((draft) => {
            draft.blocks.push(newSummaryBlock(t));
          })}>
          ${summaryIcon('plus')}${t('summary.add_block')}
        </button>
        </section>
        ${dialog.error ? html`<div class="summary-problem error" role="alert">${dialog.error}</div>` : nothing}
        ${dialog.conflict ? html`<button class="btn ghost summary-reload" type="button"
          ?disabled=${dialog.busy} @click=${() => context.reload()}>
          <ha-icon icon="mdi:reload"></ha-icon>${t('summary.reload_current')}
        </button>` : nothing}
      ` : nothing}
    </div>
    <div class="row summary-editor-footer" slot="footer">
      <button class="btn ghost" data-hp="dialog-cancel"
        ?disabled=${dialog.busy} @click=${close}>${t('btn.cancel')}</button>
      <button class="btn on" data-hp="dialog-confirm"
        ?disabled=${dialog.localOnly ? !changed || dialog.busy : !canSave}
        @click=${() => context.save()}>${t('btn.save')}</button>
    </div>
  </hp-dialog>`;
};
