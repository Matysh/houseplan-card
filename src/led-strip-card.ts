/**
 * #780: the card's side of the Devices-editor LED tool (ТЗ §4, §13.1) — the
 * loader of its lazy chunk, the toolbar button, the device-dialog section and
 * the LED branch of the device history. Only delegation lives here: the tool,
 * its geometry and its copy are in the `led-strip-editor` chunk.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { ledEditorModule } from './led-strip-gate';
import type { LedHistoryState, LedStripEditor } from './led-strip-editor';
import type { ServerConfig } from './types';

interface LedCardPort {
  _editorRuntime: unknown;
  _ledEditor: LedStripEditor | null;
  _mode: string;
  _serverCfg: ServerConfig | null;
  _alignDialog: { config: ServerConfig } | null;
  _devicePositionBusy: boolean;
  _devicePositionHistory: { undo(): unknown; redo(): unknown; clear(): void };
  _t(key: string, vars?: Record<string, string | number>): string;
  _showToast(message: string): void;
  requestUpdate(): void;
}

/** The tool once its chunk is here (an editor must be loaded); otherwise one load. */
export function ledEditorFor(card: LedCardPort, entry: string): LedStripEditor | null {
  const module = card._editorRuntime ? ledEditorModule(entry, () => card.requestUpdate()) : null;
  return module ? (card._ledEditor ??= module.createLedStripEditor(card as never)) : null;
}

/** «LED-лента» next to «Add» in the Devices editor (ТЗ §4 п.1); a second press leaves the tool. */
export function ledButton(card: LedCardPort): TemplateResult {
  const tool = card._ledEditor?.tool;
  return html`<button class="btn ${tool ? 'on' : ''}" data-hp="tool" data-tool="led-strip"
    aria-pressed=${tool ? 'true' : 'false'} @click=${() => {
      if (tool) return card._ledEditor!.close();
      const entry = `tool${Date.now()}`, open = () => ledEditorFor(card, entry)?.open();
      if (ledEditorModule(entry, open)) open();
    }}><ha-icon icon="mdi:led-strip-variant"></ha-icon>${card._t('devbar.led')}</button>`;
}

/**
 * The device dialog's "icon ↔ LED strip" section — in the Devices editor
 * only (ТЗ §5). A device without a strip gets the static «Show as LED strip»
 * at once (the tool loads on the press, the dialog does not shift); a strip's
 * device loads the tool, also outside Devices: its save renames the link on a
 * rebinding.
 */
export function ledSection(card: LedCardPort, devId: string): TemplateResult | typeof nothing {
  const devices = card._mode === 'devices';
  const owned = !!card._serverCfg?.spaces.some((space: { led_strips?: Array<{ marker: string | null }> }) =>
    space.led_strips?.some((strip) => strip.marker === devId));
  if (!devices) {
    if (owned) ledEditorFor(card, 'dialog');
    return nothing;
  }
  if (card._ledEditor) return card._ledEditor.markerSection(devId);
  if (owned) { ledEditorFor(card, 'dialog'); return nothing; }
  return html`<div class="hpf-group led-representation" data-led-representation="icon">
    <div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn ghost" type="button" data-led-action="show-strip"
      @click=${() => {
        const entry = `tool${Date.now()}`, go = () => ledEditorFor(card, entry)?.convertFromDialog(devId);
        if (ledEditorModule(entry, go)) go();
      }}><ha-icon icon="mdi:led-strip-variant"></ha-icon>${card._t('devbar.led_show')}</button></div>
  </div>`;
}

const hasStrips = (config: ServerConfig | null | undefined) => !!config?.spaces.some(
  (space: { led_strips?: unknown[] }) => space.led_strips?.length);

/** «Optimize plans»: strips through walls of the optimised result, counted by the tool (AC16). */
export function ledWallsNote(card: LedCardPort): TemplateResult | typeof nothing {
  const config = card._alignDialog?.config;
  return config && hasStrips(config) ? ledEditorFor(card, 'optimize')?.wallsNote(config) ?? nothing : nothing;
}

/** The import summary: strips whose device did not travel are left unbound (§9). */
export function ledImportNote(card: LedCardPort, n: unknown): TemplateResult | typeof nothing {
  return n ? html`<div class="backupwarn" data-led-unbound-import=${String(n)}>${card._t('backup.unbound_led_strips', { n: String(n) })}</div>` : nothing;
}

/** Undo/Redo of an LED command (ТЗ §4 п.9): its own strip record, never a newer foreign change. */
export async function ledHistory(
  card: LedCardPort, direction: 'undo' | 'redo',
  command: { name: string; before: unknown; after: unknown },
): Promise<void> {
  const [target, from] = (direction === 'undo' ? [command.before, command.after] : [command.after, command.before]) as LedHistoryState[];
  card._devicePositionBusy = true;
  const result = card._ledEditor ? await card._ledEditor.applyHistory(target, from) : 'stale';
  card._devicePositionBusy = false;
  if (result === 'failed') {
    if (direction === 'undo') card._devicePositionHistory.redo(); else card._devicePositionHistory.undo();
  } else {
    if (result === 'stale') card._devicePositionHistory.clear();
    card._showToast(card._t(result === 'stale' ? 'history.device_stale'
      : direction === 'undo' ? 'history.undone' : 'history.redone', { name: command.name }));
  }
  card.requestUpdate();
}
