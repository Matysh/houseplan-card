/**
 * #618: batch Hide/Show in the Devices catalog.
 *
 * Selection is ephemeral dialog state (`selected`, exact bindings).  The
 * write is shared with the single-row action: one pure fold
 * (`applyInboxVisibility`), one `houseplan/config/set` with the usual
 * `expected_rev`, rollback on any failure.  Lives in the lazy editor graph.
 */
import { html, nothing, type TemplateResult } from 'lit';
import {
  applyInboxVisibility, effectiveInboxSelection, filterDeviceInbox, isInboxBatchTab,
  selectableInboxRows, type DeviceInboxCategory, type DeviceInboxRow,
} from './device-inbox';
import type { I18nKey } from './i18n';
import type { Marker } from './types';

/** B6: `busy` sentinel while a batch write is in flight (drives `inert`). */
export const INBOX_BATCH_BUSY = '__batch__';

export interface InboxBatchDialog {
  tab: DeviceInboxCategory;
  search: string;
  onlyNew: boolean;
  anchor?: string;
  busy?: string;
  selected?: string[];
}

export interface InboxBatchHost<D extends InboxBatchDialog> {
  _deviceInbox: D | null;
  _serverCfg: { markers: Marker[] } | null;
  _regSignature: string;
  _deviceInboxMemo: unknown;
  _maybeRebuildDevices: () => void;
  _showToast: (msg: string) => void;
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  _errText: (e: any) => string; // any-ok: mirrors the host port signature
}

export interface InboxBatchDeps {
  rows: () => DeviceInboxRow[];
  saveConfigNow: () => Promise<void>;
}

export interface InboxBatchView {
  batchTab: boolean;
  selectable: DeviceInboxRow[];
  selectableKeys: Set<string>;
  chosen: DeviceInboxRow[];
  chosenKeys: Set<string>;
}

/** B3: selectable rows of the dialog's tab over the whole filtered set. */
export function inboxSelectableFor(rows: readonly DeviceInboxRow[], dialog: InboxBatchDialog): DeviceInboxRow[] {
  if (!isInboxBatchTab(dialog.tab)) return [];
  return selectableInboxRows(filterDeviceInbox(
    rows, dialog.tab, dialog.search, dialog.tab === 'on_plan' && dialog.onlyNew,
  ));
}

export function inboxBatchView(dialog: InboxBatchDialog, filtered: readonly DeviceInboxRow[]): InboxBatchView {
  const batchTab = isInboxBatchTab(dialog.tab);
  const selectable = batchTab ? selectableInboxRows(filtered) : [];
  const chosen = effectiveInboxSelection(dialog.selected, selectable);
  return {
    batchTab, selectable, chosen,
    selectableKeys: new Set(selectable.map((row) => row.key)),
    chosenKeys: new Set(chosen.map((row) => row.key)),
  };
}

export function toggleInboxSelection<D extends InboxBatchDialog>(
  host: InboxBatchHost<D>, key: string, checked: boolean,
): void {
  const dialog = host._deviceInbox;
  if (!dialog || dialog.busy) return;
  const rest = (dialog.selected || []).filter((item) => item !== key);
  host._deviceInbox = { ...dialog, selected: checked ? [...rest, key] : rest };
}

export function selectAllInbox<D extends InboxBatchDialog>(
  host: InboxBatchHost<D>, deps: InboxBatchDeps, checked: boolean,
): void {
  const dialog = host._deviceInbox;
  if (!dialog || dialog.busy) return;
  host._deviceInbox = {
    ...dialog, selected: checked ? inboxSelectableFor(deps.rows(), dialog).map((row) => row.key) : [],
  };
}

/** Hide selected (On plan) / Show selected (Hidden). */
export async function setInboxSelectionHidden<D extends InboxBatchDialog>(
  host: InboxBatchHost<D>, deps: InboxBatchDeps, hidden: boolean,
): Promise<void> {
  const dialog = host._deviceInbox;
  if (!dialog || dialog.busy || dialog.tab !== (hidden ? 'on_plan' : 'hidden')) return;
  const rows = effectiveInboxSelection(dialog.selected, inboxSelectableFor(deps.rows(), dialog));
  if (!rows.length) return;
  await writeInboxVisibility(host, deps, rows, hidden, true);
}

/** One Hide/Show transaction for a single row (`batch=false`) or a batch. */
export async function writeInboxVisibility<D extends InboxBatchDialog>(
  host: InboxBatchHost<D>, deps: InboxBatchDeps,
  rows: readonly DeviceInboxRow[], hidden: boolean, batch: boolean,
): Promise<void> {
  const dialog = host._deviceInbox;
  const cfg = host._serverCfg;
  if (!dialog || !cfg || dialog.busy || !rows.length) return;
  const previousMarkers = cfg.markers || [];
  const applied = applyInboxVisibility(previousMarkers, rows, hidden, () => `m_${Date.now().toString(36)}`);
  if (!applied.changed) return;
  cfg.markers = applied.markers;
  host._deviceInbox = {
    ...dialog,
    busy: batch ? INBOX_BATCH_BUSY : rows[0].key,
    anchor: batch ? dialog.anchor : rows[0].key,
  };
  const refreshRows = () => {
    host._regSignature = '';
    host._deviceInboxMemo = null;
    host._maybeRebuildDevices();
  };
  try {
    await deps.saveConfigNow(); // #618 B5: one write per batch
    refreshRows();
    if (host._deviceInbox) {
      host._deviceInbox = { ...host._deviceInbox, busy: undefined, ...(batch ? { selected: [] } : {}) };
    }
    host._showToast(batch
      ? host._t(hidden ? 'device_inbox.batch_hidden' : 'device_inbox.batch_shown', { count: String(applied.changed) })
      : host._t('device_inbox.saved'));
  } catch (error) {
    if (host._serverCfg === cfg) cfg.markers = previousMarkers; // #618 B8 rollback
    refreshRows();
    const current = host._deviceInbox;
    if (current) {
      // B8/B9: keep the selection, narrowed to rows still actionable after
      // the rollback or the conflict re-read.
      const selected = current.selected
        ? effectiveInboxSelection(current.selected, inboxSelectableFor(deps.rows(), current)).map((row) => row.key)
        : undefined;
      host._deviceInbox = { ...current, busy: undefined, selected };
    }
    host._showToast(host._t('toast.error', { err: host._errText(error) }));
  }
}

/** B4/§6: "Select all (N)" + "Selected: K · action (K) · Clear selection". */
export function renderInboxBatchPanel<D extends InboxBatchDialog>(
  host: InboxBatchHost<D>, deps: InboxBatchDeps, dialog: D, view: InboxBatchView,
): TemplateResult | typeof nothing {
  if (!view.batchTab) return nothing;
  const { selectable, chosen } = view;
  const count = { count: String(chosen.length) };
  return html`<div class="device-inbox-batch">
    <label class="device-inbox-select-all">
      <input type="checkbox" .checked=${selectable.length > 0 && chosen.length === selectable.length}
        .indeterminate=${chosen.length > 0 && chosen.length < selectable.length}
        ?disabled=${!selectable.length}
        @change=${(event: Event) => selectAllInbox(host, deps, (event.target as HTMLInputElement).checked)} />
      ${host._t('device_inbox.select_all', { count: String(selectable.length) })}
    </label>
    ${dialog.selected?.length ? html`<div class="device-inbox-batch-actions">
      <span class="device-inbox-selected">${host._t('device_inbox.selected_count', count)}</span>
      <button type="button" class="btn device-inbox-batch-apply" ?disabled=${!chosen.length}
        @click=${() => setInboxSelectionHidden(host, deps, dialog.tab === 'on_plan')}>
        ${host._t(dialog.tab === 'on_plan' ? 'device_inbox.hide_selected' : 'device_inbox.show_selected', count)}
      </button>
      <button type="button" class="btn ghost device-inbox-batch-clear"
        @click=${() => selectAllInbox(host, deps, false)}>${host._t('device_inbox.clear_selection')}</button>
    </div>` : nothing}
  </div>`;
}

/** §6: row checkbox left of the icon; an inactive one explains why. */
export function renderInboxRowSelect<D extends InboxBatchDialog>(
  host: InboxBatchHost<D>, dialog: D, view: InboxBatchView, row: DeviceInboxRow,
): TemplateResult | typeof nothing {
  if (!view.batchTab) return nothing;
  const canSelect = view.selectableKeys.has(row.key);
  const hint = canSelect ? ''
    : host._t(dialog.tab === 'hidden' ? 'device_inbox.show_disabled' : 'device_inbox.select_inactive');
  return html`<label class="device-inbox-select" title=${hint}>
    <input type="checkbox" aria-label=${host._t('device_inbox.select_row', { name: row.name })}
      .checked=${view.chosenKeys.has(row.key)} ?disabled=${!canSelect}
      @click=${(event: Event) => event.stopPropagation()}
      @change=${(event: Event) => toggleInboxSelection(host, row.key, (event.target as HTMLInputElement).checked)} />
  </label>`;
}
