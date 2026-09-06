import { html, type TemplateResult } from 'lit';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { I18nKey } from './i18n';
import { optimizePlans } from './plan-optimizer';
import { commitPlanOptimization } from './plan-optimize-write';
import {
  createSpaceCopyCandidate, newSpaceCopySeed, nextSpaceCopyTitle,
  SpaceCopyError, type SpaceCopyErrorCode,
} from './space-copy';
import type { OptimizeGeometryPreflightResult } from './plan-geometry-preflight';
import type { SpaceReferenceRepairContext } from './space-reference-repair';
import { optimisticAttempt, rollbackOptimistic, type OptimisticAttempt } from './serialized-write-queue';
import type { ServerConfig } from './types';
import { contentFingerprint } from './visual-continuity';

export interface SpaceCopyRuntimeServices {
  clearGeometryGesture(): void;
  optimizeReferenceContext(): SpaceReferenceRepairContext;
  reportPreflightFailure(result: OptimizeGeometryPreflightResult, config: ServerConfig): void;
  saveConfigNow(attempt: OptimisticAttempt<ServerConfig>): Promise<void>;
  setMode(mode: 'plan'): void;
  showWallModelMigrationBlocked(error: unknown): void;
  optimize?: typeof optimizePlans;
  newSeed?: () => string;
}

const ERROR_KEYS: Record<SpaceCopyErrorCode, I18nKey> = {
  source_missing: 'space.copy_error_source_missing',
  source_invalid: 'space.copy_error_source_invalid',
  spaces_limit: 'space.copy_error_spaces_limit',
  partitions_limit: 'space.copy_error_partitions_limit',
  openings_limit: 'space.copy_error_openings_limit',
  decor_limit: 'space.copy_error_decor_limit',
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
  return html`<hp-dialog .hass=${host.hass} .title=${host._t('space.copy_title')}
    icon="mdi:content-copy" @hp-close=${close}>
      <div class="body">
        <label for="space-copy-name">${host._t('space.copy_name')}</label>
        <input id="space-copy-name" class="namein" type="text" autofocus
          .value=${copy.title}
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
      </div>
      <div class="row dialog-action-footer" slot="footer">
        <span class="spacer"></span>
        <button class="btn ghost" @click=${close} ?disabled=${copy.busy}>
          ${host._t('btn.cancel')}
        </button>
        <button class="btn on" @click=${submit} ?disabled=${!copy.title.trim() || copy.busy}>
          <ha-icon icon="mdi:content-copy"></ha-icon>${copy.busy ? '…' : host._t('space.copy_create')}
        </button>
      </div>
  </hp-dialog>`;
}

function showCopyError(host: HouseplanEditorHostPort, error: unknown): void {
  if (error instanceof SpaceCopyError) {
    host._showToast(host._t(ERROR_KEYS[error.code]));
    return;
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'wall_model_client_outdated') {
    host._showToast(host._t('toast.wall_model_client_outdated'));
    return;
  }
  host._showToast(host._t('toast.error', { err: host._errText(error) }));
}

/** Submit one guarded two-step operation: optional Optimize, then config Copy. */
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
  host._spaceDialog = {
    ...initial,
    busy: true,
    copy: { ...initial.copy, title, busy: true, token },
  };
  let optimizeAccepted = false;
  try {
    if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
    await host._writeChain;
    if (!setBusy(host, token, true) || !host._serverCfg) return;

    const configRevision = host._cfgRev;
    const layoutRevision = host._layoutRev;
    const configFingerprint = contentFingerprint(host._serverCfg);
    const layoutFingerprint = contentFingerprint(host._layout);
    let optimized;
    try {
      optimized = (services.optimize ?? optimizePlans)(
        host._serverCfg, host._layout, services.optimizeReferenceContext(),
      );
    } catch (error) {
      setBusy(host, token, false);
      services.showWallModelMigrationBlocked(error);
      return;
    }

    if (optimized.changed) {
      const preflight = host._checkOptimizeGeometry(optimized.config);
      services.reportPreflightFailure(preflight, optimized.config);
      if (!preflight.ok) {
        setBusy(host, token, false);
        host._showToast(host._t('space.copy_error_optimize_geometry'));
        return;
      }
      const accepted = await host._confirmDanger({
        key: `copy-space:${sourceId}`,
        kind: 'warning',
        title: host._t('space.copy_optimize_title'),
        message: host._t('space.copy_optimize_body', { name: title }),
        objectName: title,
        confirmLabel: host._t('space.copy_optimize_confirm'),
        cancelLabel: host._t('btn.cancel'),
        icon: 'mdi:broom',
      });
      if (!setBusy(host, token, accepted)) return;
      if (!accepted) return;
      if (host._cfgRev !== configRevision || host._layoutRev !== layoutRevision
          || !host._serverCfg || contentFingerprint(host._serverCfg) !== configFingerprint
          || contentFingerprint(host._layout) !== layoutFingerprint) {
        setBusy(host, token, false);
        host._showToast(host._t('space.copy_error_changed'));
        return;
      }
      services.clearGeometryGesture();
      await commitPlanOptimization(host, optimized.config, optimized.layout);
      optimizeAccepted = true;
    }

    if (!setBusy(host, token, true) || !host._serverCfg) return;
    const previous = host._serverCfg;
    const result = createSpaceCopyCandidate(
      previous, sourceId, title, services.newSeed?.() ?? newSpaceCopySeed(),
    );
    let safe = false;
    try { safe = host._checkSpacePhysicalGeometry(result.config, result.space.id).ok; } catch { safe = false; }
    if (!safe || host._junctionLimitViolations(result.config, result.space.id).length) {
      throw new SpaceCopyError('geometry_unsafe');
    }
    const attempt = optimisticAttempt(
      previous, result.config, host._cfgContentFingerprint, host._cfgRev, contentFingerprint,
    );
    host._serverCfg = result.config;
    invalidateConfig(host);
    try {
      await services.saveConfigNow(attempt);
    } catch (error) {
      if (rollbackOptimistic(host, attempt, contentFingerprint)) invalidateConfig(host);
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
    host._showToast(host._t('toast.space_copied', { name: title }));
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'conflict') {
      await Promise.all([host._reloadConfigOnly(true), host._reloadLayoutOnly()]);
    }
    setBusy(host, token, false);
    showCopyError(host, error);
    if (optimizeAccepted) host.requestUpdate();
  }
}
