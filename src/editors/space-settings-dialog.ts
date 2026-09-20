/**
 * Диалог «Пространство» в редакторском рантайме (#592 вынос, #600 форма по
 * референсу). Сама форма — `space-form.ts`, общая с онбордингом; здесь только
 * порт редактора: файлы, сохранение, копирование, удаление.
 */
import { html, type TemplateResult } from 'lit';

import { renderSpaceForm } from './space-form';
import { openSpaceCopyDialog, renderSpaceCopyDialog } from '../space-copy-runtime';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';

export { CELL_CM_MAX, CELL_CM_MIN } from './space-form';

/** Точка входа редакторского рантайма: тот же порт, что у онбординга, плюс Copy/Delete. */
export function renderSpaceSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  const d = this.host._spaceDialog!;
  if (d.copy) return renderSpaceCopyDialog(this.host, () => { void this._saveSpaceCopy(); });
  const form = renderSpaceForm({
    host: this.host,
    idPrefix: 'space',
    // Ссылка на метод, не обёртка: контракт i18n требует литеральный ключ в каждом вызове _help.
    help: this._help.bind(this),
    rangeInput: (min, max, step, value, onInput, disabled, ariaLabel) =>
      this._rangeInput(min, max, step, value, onInput, disabled, ariaLabel),
    pickPlanFile: (e) => this._pickPlanFile(e),
    toggleServerPlans: () => this._toggleServerPlans(),
    renderServerPlans: (dialog) => this._renderServerPlans(dialog),
    save: () => this._saveSpaceDialog(),
    skipImport: () => this._skipImport(),
    deleteSpace: () => this._deleteSpace(),
    copySpace: () => openSpaceCopyDialog(this.host),
  });
  return html`<hp-dialog .hass=${this.host.hass} data-kind="space" form-shell wide
      .title=${form.title} .badge=${form.badge} icon="mdi:floor-plan" @hp-close=${form.requestClose}>
    ${form.body}${form.footer}
  </hp-dialog>`;
}
