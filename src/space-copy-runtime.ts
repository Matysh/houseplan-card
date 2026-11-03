import { html, type TemplateResult } from 'lit';
import { isGeometryCleanupRefusal } from './config-adoption';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { I18nKey } from './i18n';
import {
  createSpaceCopyCandidate, newSpaceCopySeed, nextSpaceCopyTitle,
  SpaceCopyError, type SpaceCopyErrorCode,
} from './space-copy';
import type { OptimisticAttempt } from './serialized-write-queue';
import type { ServerConfig } from './types';

export interface SpaceCopyRuntimeServices {
  clearGeometryGesture(): void;
  saveConfigNow(attempt: OptimisticAttempt<ServerConfig>): Promise<void>;
  setMode(mode: 'plan'): void;
  newSeed?: () => string;
}

const ERROR_KEYS: Record<SpaceCopyErrorCode, I18nKey> = {
  source_missing: 'space.copy_error_source_missing',
  source_invalid: 'space.copy_error_source_invalid',
  spaces_limit: 'space.copy_error_spaces_limit',
  partitions_limit: 'space.copy_error_partitions_limit',
  openings_limit: 'space.copy_error_openings_limit',
  decor_limit: 'space.copy_error_decor_limit',
  stairs_limit: 'space.copy_error_stairs_limit',
  columns_limit: 'space.copy_error_columns_limit',
  opening_host_missing: 'space.copy_error_opening_host',
  opening_host_unknown: 'space.copy_error_opening_host',
  geometry_unsafe: 'space.copy_error_geometry',
};

let operationSequence = 0;

function setBusy(host: HouseplanEditorHostPort, token: number, busy: boolean): boolean {
  const dialog = host._spaceDialog;
  if (!dialog?.copy || dialog.copy.token !== token) return false;
  host._spaceDialog = { ...dialog, busy, copy: { ...dialog.copy, busy } };
  return true;
}

function invalidateConfig(host: HouseplanEditorHostPort): void {
  host._cfgEpoch++;
  host._modelCache = null;
  host._frame = null;
  host._regSignature = '';
  host._maybeRebuildDevices();
  host.requestUpdate();
}

export function openSpaceCopyDialog(host: HouseplanEditorHostPort): void {
  const dialog = host._spaceDialog;
  if (!dialog || dialog.mode !== 'edit' || dialog.busy || !host._serverCfg) return;
  const source = host._serverCfg.spaces.find((space) => space?.id === dialog.spaceId);
  if (!source) return;
  host._spaceDialog = {
    ...dialog,
    copy: {
      title: nextSpaceCopyTitle(source.title, host._serverCfg.spaces, host._t('space.copy_fallback')),
      furniture: false,
      decor: false,
      busy: false,
      token: 0,
    },
  };
}

export function closeSpaceCopyDialog(host: HouseplanEditorHostPort): void {
  const dialog = host._spaceDialog;
  if (!dialog?.copy || dialog.busy || dialog.copy.busy) return;
  host._spaceDialog = { ...dialog, copy: undefined };
}

export function renderSpaceCopyDialog(
  host: HouseplanEditorHostPort,
  submit: () => void,
): TemplateResult {
  const dialog = host._spaceDialog!;
  const copy = dialog.copy!;
  const close = () => closeSpaceCopyDialog(host);
  const choose = (key: 'furniture' | 'decor', event: Event) => {
    const current = host._spaceDialog;
    if (current?.copy && !current.busy && !current.copy.busy) {
      host._spaceDialog = { ...current, copy: { ...current.copy, [key]: (event.target as HTMLInputElement).checked } };
    }
  };
  return html`<hp-dialog form-shell settings-layout compact wide class="ui-dialog" .hass=${host.hass} data-kind="space"
    .title=${host._t('space.copy_title')}
    icon="mdi:content-copy" @hp-close=${close}>
      <div class="body hpf-form">
        <label class="hpf-label" for="space-copy-name">${host._t('space.copy_name')}</label>
        <input id="space-copy-name" class="namein hpf-input" type="text" autofocus
          .value=${copy.title} ?disabled=${copy.busy}
          @focus=${(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()}
          @input=${(event: Event) => {
            const current = host._spaceDialog;
            if (current?.copy && !current.busy) {
              host._spaceDialog = {
                ...current,
                copy: { ...current.copy, title: (event.target as HTMLInputElement).value },
              };
            }
          }}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === 'Enter' && copy.title.trim() && !copy.busy) {
              event.preventDefault();
              submit();
            }
          }} />
        <label class="hpf-check hpf-check-wrap">
          <input id="space-copy-furniture" data-hp="field" data-field="space-copy-furniture" type="checkbox"
            .checked=${copy.furniture} ?disabled=${copy.busy} @change=${(event: Event) => choose('furniture', event)} />
          ${host._t('space.copy_furniture')}
        </label>
        <label class="hpf-check hpf-check-wrap">
          <input id="space-copy-decor" data-hp="field" data-field="space-copy-decor" type="checkbox"
            .checked=${copy.decor} ?disabled=${copy.busy} @change=${(event: Event) => choose('decor', event)} />
          ${host._t('space.copy_decor')}
        </label>
      </div>
      <div class="row dialog-action-footer" slot="footer">
        <span class="spacer"></span>
        <button class="btn ghost" data-hp="dialog-cancel"
          @click=${close} ?disabled=${copy.busy}>
          ${host._t('btn.cancel')}
        </button>
        <button class="btn on" data-hp="dialog-confirm"
          @click=${submit} ?disabled=${!copy.title.trim() || copy.busy}>
          <ha-icon icon="mdi:content-copy"></ha-icon>${copy.busy ? '…' : host._t('space.copy_create')}
        </button>
      </div>
  </hp-dialog>`;
}

function showCopyError(host: HouseplanEditorHostPort, error: unknown): void {
  if (error instanceof SpaceCopyError) {
    host._showToast(host._t(ERROR_KEYS[error.code]), ERROR_KEYS[error.code]);
    return;
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'wall_model_client_outdated') {
    host._showToast(host._t('toast.wall_model_client_outdated'), 'toast.wall_model_client_outdated');
    return;
  }
  if (!isGeometryCleanupRefusal(error)) host._showToast(host._t('toast.error', { err: host._errText(error) }), 'toast.error');
}

/** Copy accepted geometry as-is. The server proves its stored source (#1227). */
export async function saveSpaceCopy(
  host: HouseplanEditorHostPort,
  services: SpaceCopyRuntimeServices,
): Promise<void> {
  const initial = host._spaceDialog;
  if (!initial?.copy || initial.mode !== 'edit' || initial.busy || initial.copy.busy
      || !initial.copy.title.trim() || !initial.spaceId || !host._serverCfg) return;
  const token = ++operationSequence;
  const sourceId = initial.spaceId;
  const title = initial.copy.title.trim();
  const options = { furniture: initial.copy.furniture, decor: initial.copy.decor };
  host._spaceDialog = {
    ...initial,
    busy: true,
    copy: { ...initial.copy, title, busy: true, token },
  };
  try {
    if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
    await host._writeChain;
    if (!setBusy(host, token, true) || !host._serverCfg) return;

    const previous = host._serverCfg;
    const result = createSpaceCopyCandidate(
      previous, sourceId, title, services.newSeed?.() ?? newSpaceCopySeed(), options,
    );
    const attempt = host._adoption.beginOptimistic(previous, result.config);
    host._adoption.stageLocalConfig(result.config);
    invalidateConfig(host);
    try {
      await services.saveConfigNow(attempt);
    } catch (error) {
      if (host._rollbackOptimistic(attempt)) invalidateConfig(host);
      if ((error as { code?: unknown } | null)?.code !== 'conflict') {
        await host._reloadConfigOnly(true);
      }
      throw error;
    }

    host._canOptimizeUndo = false;
    host._undoKind = null;
    services.clearGeometryGesture();
    host._selId = null;
    host._physicalSel = null;
    host._spaceDialog = null;
    host._commitSpace(result.space.id, true);
    services.setMode('plan');
    host._tool = 'draw';
    host._path = [];
    host._cursorPt = null;
    host._activeWallChainId = null;
    host._activeWallChainPartitionIds = [];
    host._primeDrawWallField();
    host._saveNav();
    host.requestUpdate();
    host._showToast(host._t('toast.space_copied', { name: title }), 'toast.space_copied');
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'conflict') {
      await Promise.all([host._reloadConfigOnly(true), host._reloadLayoutOnly()]);
    }
    setBusy(host, token, false);
    showCopyError(host, error);
  }
}
