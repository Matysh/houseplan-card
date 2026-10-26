/** One presentation of the existing floor wizard; callers retain write guards. */
import { html } from 'lit';
import type { CompactDialogHost } from './compact-dialog-styles';
import { langOf, type I18nKey } from './i18n';

interface FloorChoice { id: string; name: string; level?: number | null; checked: boolean }
interface FloorImportHost extends CompactDialogHost {
  hass: unknown;
  _config?: { language?: string } | null;
  _importDialog: { floors: FloorChoice[] } | null;
  _t(key: I18nKey, vars?: Record<string, string | number>): string;
}
export function renderFloorImportDialog(host: FloorImportHost, manual: () => void, start: () => void,
  manualAction: 'import-manual' | 'import-create-space' = 'import-manual') {
  const dialog = host._importDialog!, selected = dialog.floors.filter(floor => floor.checked).length;
  return html`<hp-dialog .hass=${host.hass} data-kind="import" class="ui-dialog" form-shell settings-layout compact wide
    .title=${host._t('import.title')} icon="mdi:home-floor-1" @hp-close=${() => (host._importDialog = null)}>
    <div class="body">
      <div class="rhint">${host._t('import.hint')}</div>
      ${dialog.floors.map((floor, index) => html`<label class="floorrow">
        <input data-hp="field" data-field="import-floor" data-value=${floor.id} type="checkbox" .checked=${floor.checked}
          @change=${(event: Event) => {
            const floors = [...dialog.floors]; floors[index] = { ...floor, checked: (event.target as HTMLInputElement).checked };
            host._importDialog = { floors };
          }} />
        <span>${floor.name}</span>${floor.level != null ? html`<span class="floorlvl">L${floor.level}</span>` : null}
      </label>`)}
      <hp-plan-converter-info .language=${langOf(host.hass, host._config?.language)}></hp-plan-converter-info>
    </div>
    <div class="row hpf-footer" slot="footer">
      <button data-hp="action" data-action=${manualAction} class="btn ghost" @click=${manual}>${host._t('import.manual')}</button>
      <span class="spacer"></span>
      <button class="btn on" data-hp="dialog-confirm" @click=${start} ?disabled=${!selected}>
        <ha-icon icon="mdi:import"></ha-icon>${host._t('import.start', { n: selected })}
      </button>
    </div>
  </hp-dialog>`;
}
