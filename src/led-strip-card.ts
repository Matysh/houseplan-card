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
 * only (ТЗ §5). A strip's dialog elsewhere still loads the tool: its save
 * renames the link on a rebinding.
 */
export function ledSection(
  card: LedCardPort, devId: string, leave: () => Promise<boolean>,
): TemplateResult | typeof nothing {
  const devices = card._mode === 'devices';
  if (!devices && !card._serverCfg?.spaces.some((space: { led_strips?: Array<{ marker: string | null }> }) =>
    space.led_strips?.some((strip) => strip.marker === devId))) return nothing;
  const led = ledEditorFor(card, 'dialog');
  return devices ? led?.markerSection(devId, leave) ?? nothing : nothing;
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
