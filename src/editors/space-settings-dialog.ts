/**
 * Диалог «Пространство» в редакторском рантайме (#592 вынос, #600 форма по
 * референсу). Сама форма — `space-form.ts`, общая с онбордингом; здесь только
 * порт редактора: файлы, сохранение, копирование, удаление.
 */
import { html, type TemplateResult } from 'lit';
import { langOf } from '../i18n';

import { ensureSettingsDialogStyles } from './settings-styles';
import { settingsSections, selectSettingsSection, revealSettingsField } from './settings-sections';
import { settingsNorth } from './settings-north';
import { settingsCopy } from './settings-copy';
import { renderSpaceForm } from './space-form';
import { openSpaceCopyDialog, renderSpaceCopyDialog } from '../space-copy-runtime';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';

export { CELL_CM_MAX, CELL_CM_MIN } from './space-form';

/** Точка входа редакторского рантайма: тот же порт, что у онбординга, плюс Copy/Delete. */
export function renderSpaceSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureSettingsDialogStyles(this.host);
  const { st } = settingsCopy(this.host);
  const d = this.host._spaceDialog!;
  if (d.copy) return renderSpaceCopyDialog(this.host, () => { void this._saveSpaceCopy(); });
  const form = renderSpaceForm({
    host: this.host,
    idPrefix: 'space',
    northControl: settingsNorth,
    revealField: field => revealSettingsField(this.host,field),
    openGeneral: section => { selectSettingsSection(this.host,'general',section); this._openSettingsDialog(); },
    // Ссылка на метод, не обёртка: контракт i18n требует литеральный ключ в каждом вызове _help.
    help: this._help.bind(this),
    rangeInput: (min, max, step, value, onInput, disabled, ariaLabel, fieldId) =>
      this._rangeInput(min, max, step, value, onInput, disabled, ariaLabel, fieldId),
    pickPlanFile: (e) => this._pickPlanFile(e),
    toggleServerPlans: () => this._toggleServerPlans(),
    renderServerPlans: (dialog) => this._renderServerPlans(dialog),
    save: () => this._saveSpaceDialog(),
    skipImport: () => this._skipImport(),
    deleteSpace: (withDevices) => this._deleteSpace(withDevices),
    copySpace: () => openSpaceCopyDialog(this.host),
  });
  return html`<hp-dialog class="ui-dialog hpf-settings-dialog" .hass=${this.host.hass} lang=${langOf(this.host.hass,this.host._config?.language)} data-kind="space" form-shell wide settings-layout
      .title=${d.mode === 'edit' ? `${this.host._t('space.header')} · ${d.title.trim()}` : form.title}
      .subtitle=${st('space.scope')} icon="mdi:cog-outline" icon-badge="mdi:layers-outline" @hp-close=${form.requestClose}>
    <div class="body hpf-form hpf-settings-form">${settingsSections(this.host,'space',form.sections,st('dialog.section'))}${form.notices}</div>${form.footer}
  </hp-dialog>`;
}
