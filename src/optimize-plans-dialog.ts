/**
 * Диалог «Оптимизировать планы» (Общие настройки → Сетка), #642.
 *
 * Первый вынос из монолита по образцу `live-*` и `RadarSetupController`: узкий
 * порт `OptimizePlansDialogPort` из 18 членов вместо `HouseplanEditorHostPort`
 * на 350, без делегатов-заглушек в карточке. Модуль импортирует только
 * редакторский рантайм, поэтому остаётся в его ленивом чанке; карточка берёт
 * отсюда только тип состояния.
 *
 * Сам диалог (`_alignDialog`) остаётся `@state` карточки: харнесс и golden
 * пишут его напрямую. Сюда переехали два куска состояния, которые карточке
 * не принадлежали: инлайн-фолбэк буфера обмена и дедуп dev-лога.
 */
import { html, nothing, type TemplateResult } from 'lit';

import { isGeometryCleanupRefusal } from './config-adoption';
import { formatLatticeShiftCm } from './coordinate-canonicalization';
import type { DeviceLayout } from './device-position-history';
import { haRegistryDiagnostics } from './ha-binding-status';
import type { I18nKey } from './i18n';
import type { SettingsI18nKey } from './i18n/settings';
import {
  reloadHaRegistriesBounded, unverifiedDiagnostics, unverifiedGroup, unverifiedName,
  type UnverifiedGroup,
} from './optimize-unverified';
import {
  spacePhysicalGeometryFingerprint, type OptimizeGeometryPreflightResult,
} from './plan-geometry-preflight';
import type { OptimizeReport, optimizePlans } from './plan-optimizer';
import type {
  SpaceReferencePositionDetail, SpaceReferenceRepairContext,
} from './space-reference-repair';
import type { ServerConfig } from './types';
import type { OptimizeSource, OptimizeWriteGuard, sameOptimizeSource } from './optimize-source';
import { contentFingerprint } from './visual-continuity';

/** Optimization preview plus the exact pair, so commit cannot differ from it. */
export type OptimizePlansDialogState = {
    report: OptimizeReport; config: any; layout: Record<string, any>;
    preflight: OptimizeGeometryPreflightResult | null;
    /** the promised maximum, in centimetres, ALREADY rounded up (AUD-158B1-01) */
    cm: number;
    /** the space that maximum belongs to, named only when there are several */
    where: string;
    changed: boolean;
    busy: boolean;
    /** False by default; true only after the secondary preview action. */
    removeLiveMissingPositions: boolean;
    removeInvalidMissingPositions: boolean;
    source: OptimizeSource;
    vacuumNames: string[];
    /** #869: a registry re-check is in flight (memory only). */
    retrying?: boolean;
    /** #869: the last re-check still brought no complete registry. */
    retryFailed?: boolean;
};

/**
 * Всё, что диалогу нужно от редактора. Порт собирает рантайм в конструкторе;
 * других зависимостей у модуля нет. Рост порта выше 23 членов — сигнал, что
 * сюда протекает чужая подсистема (юнит `optimize-plans-dialog.test.mjs`).
 */
export interface OptimizePlansDialogPort {
  dialog(): OptimizePlansDialogState | null;
  setDialog(next: OptimizePlansDialogState | null): void;
  /** #869: the dialog's own strings live in the lazy `settings` dictionary. */
  t(key: I18nKey | SettingsI18nKey, vars?: Record<string, string | number>): string;
  hass(): unknown;
  config(): ServerConfig | null;
  /** the normalised plan exists — the preview has something to optimise */
  planReady(): boolean;
  canWrite(): boolean;
  source(): OptimizeSource;
  layout(): DeviceLayout | null | undefined;
  integrationVersion(): string | null;
  /** `displayVersion(CARD_VERSION)` of the runtime; no second copy here */
  cardVersion(): string;
  requestUpdate(): void;
  showToast(message: string, id?: string): void;
  errorText(error: unknown): string;
  checkGeometry(config: ServerConfig): OptimizeGeometryPreflightResult;
  referenceContext(removeLiveMissingPositions: boolean, removeInvalidMissingPositions?: boolean): SpaceReferenceRepairContext;
  showMigrationBlocked(error: unknown): void;
  clearGeometryGesture(): void;
  commit(config: ServerConfig, layout: DeviceLayout, guard: OptimizeWriteGuard): Promise<void>;
  /** a write conflict reloads both stores before the error toast */
  reloadAfterConflict(): Promise<unknown>;
  /** #780: strips passing through walls of the optimised result (lazy LED tool). */
  ledNote(): TemplateResult | typeof nothing;
}

export function preflightDiagnostics(
  preflight: OptimizeGeometryPreflightResult,
  candidate: ServerConfig | null,
  { cardVersion, now }: { cardVersion: string; now: Date },
): object {
  // CODE-REVIEW-295-r1 M1: hash the CANDIDATE spaces the preflight judged,
  // not the already-saved config — a saved-config hash is exactly what a
  // space export would reproduce, and the block promises what the export
  // does not carry.
  const spacesById = new Map(((candidate as any)?.spaces || []) // any-ok: кандидат приходит из untyped optimizePlans, форма spaces не гарантирована
    .map((space) => [String(space?.id || ''), space]));
  return {
    kind: 'houseplan-optimize-preflight',
    origin: 'runtime',
    cardVersion,
    checkedAt: now.toISOString(),
    preflightFingerprint: preflight.fingerprint,
    failures: preflight.failures.map((failure) => ({
      spaceId: failure.spaceId,
      displayName: failure.displayName,
      reason: failure.reason,
      detail: failure.detail ?? null,
      spaceGeometryFingerprint: spacesById.has(failure.spaceId)
        ? spacePhysicalGeometryFingerprint(spacesById.get(failure.spaceId))
        : null,
    })),
  };
}

export function preflightVersionsDiffer(integration: string | null, cardVersion: string): boolean {
  return typeof integration === 'string' && integration.length > 0
    && integration !== cardVersion;
}

/**
 * #869: what the dialog takes from the runtime besides the port. The optimizer
 * is injected, not imported: this module is its own lazy chunk, and a static
 * edge into the editor runtime chunk would make Rollup rename the runtime's
 * named exports that the immutable-URL retry reads (#803).
 */
export interface OptimizePlansDialogOptions {
  optimize: typeof optimizePlans;
  sourceMatches: typeof sameOptimizeSource;
  /** the bounded wait of «Check again», 10 s by default */
  registryRetryMs?: number;
}

export class OptimizePlansDialog {
  /**
   * CODE-REVIEW-295-r1 M2: the inline clipboard fallback belongs to one
   * dialog showing. Keyed by the dialog object, a reopened dialog — always a
   * new object — can never display the previous refusal's JSON, and closing
   * needs no manual reset.
   */
  private readonly fallbacks = new WeakMap<object, string>();
  /** #295: dev-log once per distinct failing preflight, not once per render. */
  private reportedFingerprint: string | null = null;

  private readonly registryRetryMs: number;

  public constructor(
    private readonly port: OptimizePlansDialogPort,
    private readonly options: OptimizePlansDialogOptions,
  ) {
    this.registryRetryMs = options.registryRetryMs ?? 10_000;
  }

  /** #295: diagnostics text shown inline when the clipboard is unavailable. */
  public get clipboardFallback(): string | null {
    const dialog = this.port.dialog();
    return dialog ? this.fallbacks.get(dialog) ?? null : null;
  }

  private diagnostics(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): object {
    return preflightDiagnostics(preflight, candidate, {
      cardVersion: this.port.cardVersion(), now: new Date(),
    });
  }

  public reportPreflightFailure(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): void {
    if (preflight.ok || preflight.fingerprint === this.reportedFingerprint) return;
    this.reportedFingerprint = preflight.fingerprint;
    // eslint-disable-next-line no-console
    console.warn('[houseplan] optimize preflight failed', this.diagnostics(preflight, candidate));
  }

  public async copyDiagnostics(): Promise<void> {
    const dialog = this.port.dialog();
    const preflight = dialog?.preflight;
    if (!dialog) return;
    let text: string;
    if (preflight && !preflight.ok) {
      text = JSON.stringify(
        this.diagnostics(preflight, dialog.config ?? null), null, 2,
      );
    } else if (dialog.report.unverifiedPositions.length) {
      // #869: without a geometry refusal the button copies the unmatched records.
      text = JSON.stringify(unverifiedDiagnostics({
        items: dialog.report.unverifiedPositions,
        registry: haRegistryDiagnostics(this.port.hass()),
        analysisAuthoritative: dialog.report.registryAuthoritative === true,
        cardVersion: this.port.cardVersion(),
        integrationVersion: this.port.integrationVersion(),
        now: new Date(),
      }), null, 2);
    } else {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      if (this.fallbacks.delete(dialog)) this.port.requestUpdate();
      this.port.showToast(this.port.t('gs.preflight_copied'), 'gs.preflight_copied');
    } catch {
      // Insecure context / embedded webview: surface the block inline so the
      // owner can select and copy it by hand.
      this.fallbacks.set(dialog, text);
      this.port.requestUpdate();
    }
  }

  /**
   * Preview whole-plan maintenance. Nothing is written here: the pure run
   * produces both the report and the exact config/layout pair to commit.
   */
  public preview(removeLiveMissingPositions: boolean, removeInvalidMissingPositions = false): void {
    const config = this.port.config();
    if (!this.port.canWrite()) {
      this.port.showToast(this.port.t('gs.optimize_write_required'), 'gs.optimize_write_required');
      return;
    }
    if (!this.port.planReady() || !config) return;
    const source = this.port.source();
    const spaces = config.spaces || [];
    let r;
    try {
      r = this.options.optimize(
        config,
        this.port.layout() || {},
        this.port.referenceContext(removeLiveMissingPositions, removeInvalidMissingPositions),
      );
    } catch (error) {
      this.port.showMigrationBlocked(error);
      return;
    }
    const preflight = r.changed ? this.port.checkGeometry(r.config) : null;
    if (preflight) this.reportPreflightFailure(preflight, r.config);
    // The maximum geometry shift is an UPPER BOUND, not a sample. The run
    // measured every element in the centimetres of ITS OWN space — converting
    // one normalised maximum through the first space's `cell_cm` understated
    // a two-scale plan twentyfold (AUD-158B1-01) — and the last tenth is
    // rounded UP, so the promise can never be smaller than the deed.
    const cm = Math.ceil(r.report.maxShiftCm * 10) / 10;
    const sp = spaces.find((x) => x?.id != null && String(x.id) === r.report.maxSpace);
    const where = spaces.length > 1 && sp ? String(sp.title || sp.id) : '';
    const rooms = new Set((r.config.spaces || []).flatMap((space) =>
      (space.rooms || []).map((room) => room.id)));
    const vacuumNames = (r.config.markers || []).filter((marker) =>
      Object.values(marker.vacuum?.segment_map || {}).some((room) =>
        typeof room === 'string' && !!room && !rooms.has(room)))
      .map((marker) => String(marker.name || marker.id));
    // A new dialog object also starts without an inline clipboard fallback.
    this.port.setDialog({
      report: r.report, config: r.config, layout: r.layout, cm, where,
      preflight, changed: r.changed, busy: false, removeLiveMissingPositions,
      removeInvalidMissingPositions, source,
      vacuumNames,
    });
  }

  public open(): void { this.preview(false); }

  public toggleLivePositions(): void {
    const dialog = this.port.dialog();
    if (!dialog || dialog.busy || dialog.retrying || !dialog.report.liveMissingPositions.length) return;
    if (this.refreshChanged(dialog)) return;
    this.preview(!dialog.removeLiveMissingPositions, dialog.removeInvalidMissingPositions);
  }

  public toggleInvalidPositions(): void {
    const d = this.port.dialog();
    if (!d || d.busy || d.retrying || (d.changed && !d.preflight?.ok)
      || !d.report.invalidPositionsEligible.length) return;
    if (this.refreshChanged(d)) return;
    this.preview(d.removeLiveMissingPositions, !d.removeInvalidMissingPositions);
  }

  private refreshChanged(d: OptimizePlansDialogState): boolean {
    if (this.options.sourceMatches(d.source, this.port.source())) return false;
    this.preview(false, false);
    this.port.showToast(this.port.t('gs.optimize_preview_changed'), 'gs.optimize_preview_changed');
    return true;
  }

  /**
   * #869 «Check again»: one bounded reload of the HA registries, then the same
   * preview again. The report never changes by itself (it is the exact pair
   * Apply writes), and only the dialog that asked takes the answer: a closed
   * or reopened dialog discards it.
   */
  public async retryRegistry(): Promise<void> {
    const dialog = this.port.dialog();
    if (!dialog || dialog.busy || dialog.retrying) return;
    const pending = { ...dialog, retrying: true, retryFailed: false };
    this.port.setDialog(pending);
    const complete = await reloadHaRegistriesBounded(this.port.hass(), this.registryRetryMs);
    if (this.port.dialog() !== pending) return;
    // New evidence requires a new opt-in; never carry deletion consent across a refresh.
    if (complete) this.preview(false, false);
    if (this.port.dialog() === pending) {
      this.port.setDialog({ ...pending, retrying: false, retryFailed: !complete });
    }
  }

  /**
   * The backend persists an intent before either store changes, then keeps a
   * one-deep snapshot that remains undoable until the next plan edit.
   */
  public async run(): Promise<void> {
    let d = this.port.dialog();
    if (!this.port.canWrite()) {
      this.port.showToast(this.port.t('gs.optimize_write_required'), 'gs.optimize_write_required');
      return;
    }
    if (d?.retrying) return; // #869: the re-check may still rebuild this preview
    if (!d || d.busy || !this.port.config() || !d.changed || !d.preflight?.ok) return;
    if (!this.options.sourceMatches(d.source, this.port.source())) {
      this.preview(false, false);
      this.port.showToast(this.port.t('gs.optimize_preview_changed'), 'gs.optimize_preview_changed');
      return;
    }
    const fingerprint = contentFingerprint(d.config);
    if (d.preflight.fingerprint !== fingerprint) {
      const preflight = this.port.checkGeometry(d.config);
      this.reportPreflightFailure(preflight, d.config);
      d = { ...d, preflight };
      this.port.setDialog(d);
      if (!preflight.ok) return;
    }
    this.port.clearGeometryGesture();
    const pending = { ...d, busy: true };
    this.port.setDialog(pending);
    try {
      await this.port.commit(d.config, d.layout, {
        source: d.source, current: () => this.port.source(), canWrite: () => this.port.canWrite(),
      });
      if (this.port.dialog() !== pending || !this.port.canWrite()) return;
      if (d.removeInvalidMissingPositions) {
        this.preview(false, false);
        this.port.showToast(this.port.t('gs.optimize_invalid_done', {
          n: String(d.report.invalidPositionsRemoved.length),
        }), 'gs.optimize_invalid_done');
      } else this.port.setDialog(null);
      if (d.removeInvalidMissingPositions) return;
      this.port.showToast(this.port.t('gs.align_done', {
        n: String(d.report.moved),
        m: String(d.report.migrated + d.report.canonicalized
          + d.report.coordsCanonicalized + d.report.latticeCoordinatesCanonicalized
          + d.report.wallsMerged + d.report.spansMerged
          + d.report.partitionsMerged + d.report.partitionsReconciled
          + d.report.openingsRehosted + d.report.wallsStraightened),
        r: String(d.report.spaceRefsRemapped + d.report.roomRefsRemapped
          + d.report.positionsRemapped + d.report.markersDetached
          + d.report.orphanRoomLabelsRemoved + d.report.orphanDevicePositionsRemoved
          + d.report.orphanGroupPositionsRemoved + d.report.invalidPositionsRemoved.length),
      }), 'gs.align_done');
    } catch (e: any) { // any-ok: ответ WS HA не типизирован, code читается как у всех писателей конфига
      const current = this.port.dialog();
      if (current !== pending) return;
      if (e?.code === 'optimize_preview_changed') {
        if (this.port.canWrite()) this.preview(false, false);
        else this.port.setDialog({ ...pending, busy: false });
        const key = this.port.canWrite() ? 'gs.optimize_preview_changed' : 'gs.optimize_write_required';
        this.port.showToast(this.port.t(key), key);
        return;
      }
      if (current) this.port.setDialog({ ...current, busy: false });
      if (e?.code === 'wall_model_client_outdated') {
        this.port.showToast(this.port.t('toast.wall_model_client_outdated'), 'toast.wall_model_client_outdated');
        return;
      }
      if (e?.code === 'conflict') {
        await this.port.reloadAfterConflict();
        if (this.port.dialog() !== current && this.port.dialog()?.source !== current.source) return;
        if (this.port.canWrite()) this.preview(false, false);
      }
      if (!isGeometryCleanupRefusal(e)) this.port.showToast(this.port.t('toast.error', { err: this.port.errorText(e) }), 'toast.error');
    }
  }

  /**
   * #869: records that could not be matched. One explanation (they belong to
   * floors that are gone, are not drawn and can stay), the count per cause,
   * the registry line with «Check again» when this analysis ran on incomplete
   * HA data, and the support copy whenever the geometry check did not refuse.
   */
  private renderUnverified(d: OptimizePlansDialogState, failed: boolean): TemplateResult {
    const items = d.report.unverifiedPositions;
    const groups: Record<UnverifiedGroup, SpaceReferencePositionDetail[]> = {
      legacy_group: [], unknown_owner: [], registry_unavailable: [],
    };
    for (const item of items) groups[unverifiedGroup(item)].push(item);
    const hass = this.port.hass();
    const names = groups.legacy_group.map((item) => unverifiedName(hass, item)).filter(Boolean);
    const more = Math.max(0, names.length - 3);
    const legacyNames = names.length
      ? this.port.t('gs.optimize_live_names', {
          names: names.slice(0, 3).join(', '),
          more: more ? this.port.t('gs.optimize_reference_more', { n: String(more) }) : '',
        })
      : '';
    const limited = d.report.registryAuthoritative === false;
    const line = (n: number, key: SettingsI18nKey, vars: Record<string, string> = {}) => (n
      ? html`<li>${this.port.t(key, { n: String(n), ...vars })}</li>` : nothing);
    return html`<div class="optimize-unverified">
      <p class="alignmsg">${this.port.t('gs.optimize_unverified', { n: String(items.length) })}</p>
      <p class="rhint">${this.port.t('gs.optimize_unverified_safe')}</p>
      <ul>
        ${line(groups.legacy_group.length, 'gs.optimize_unverified_legacy', { names: legacyNames })}
        ${line(groups.unknown_owner.length, 'gs.optimize_unverified_unknown')}
        ${line(groups.registry_unavailable.length, 'gs.optimize_unverified_unchecked')}
      </ul>
      ${limited ? html`<div class="optimize-registry" role="status">
          <p class="rhint">${this.port.t('gs.optimize_registry_limited')}</p>
          ${d.retryFailed ? html`<p class="rhint">${this.port.t('gs.optimize_registry_still_limited')}</p>` : nothing}
        </div>` : nothing}
      ${limited || !failed ? html`<div class="optimize-actions">
          ${limited ? html`<button class="btn ghost optimize-action optimize-retry" type="button"
            ?disabled=${d.busy || !!d.retrying} @click=${() => this.retryRegistry()}>
            <ha-icon icon="mdi:refresh"></ha-icon>${this.port.t('gs.optimize_retry')}
          </button>` : nothing}
          ${failed ? nothing : html`<button class="btn ghost optimize-action optimize-copy" type="button"
            @click=${() => this.copyDiagnostics()}>
            <ha-icon icon="mdi:content-copy"></ha-icon>${this.port.t('gs.preflight_copy')}
          </button>`}
        </div>` : nothing}
      ${this.fallbackBlock(failed ? null : this.clipboardFallback)}
    </div>`;
  }

  /** #295: the copy text, selectable inline when the clipboard refused it. */
  private fallbackBlock(text: string | null): TemplateResult | typeof nothing {
    return text ? html`<details open>
      <summary>${this.port.t('gs.preflight_copy')}</summary>
      <pre style="user-select:text;white-space:pre-wrap">${text}</pre>
    </details>` : nothing;
  }

  /**
   * The confirmation separates geometry movement from lossless maintenance,
   * and promises the one-deep undo before either store is changed.
   */
  render(): TemplateResult {
    const d = this.port.dialog()!;
    const r = d.report;
    const failed = d.changed && !d.preflight?.ok;
    const failures = d.preflight?.failures || [];
    const visibleNames = failures.slice(0, 3).map((failure) => failure.displayName);
    const spaces = visibleNames.length
      ? visibleNames.join(', ')
      : this.port.t('gs.align_preflight_space', { n: '1' });
    const remaining = Math.max(0, failures.length - visibleNames.length);
    const more = remaining
      ? this.port.t('gs.align_preflight_more', { n: String(remaining) })
      : '';
    const repaired = r.spaceRefsRemapped + r.roomRefsRemapped
      + r.positionsRemapped + r.markersDetached;
    const modelMaintenance = r.migrated + r.canonicalized + r.coordsCanonicalized
      + r.wallSegmentsMigrated
      + r.roomDraftsMigrated + r.roomDraftSegmentsMigrated
      + r.wallsMerged + r.spansMerged + r.partitionsMerged
      + r.partitionsReconciled + r.openingsRehosted;
    const gridWarning = r.moved + r.rotated + r.coordsCanonicalized + r.wallsStraightened;
    const straightenCm = Math.ceil(r.maxStraightenShiftCm * 10) / 10;
    const straightenSpace = (this.port.config()?.spaces || []).find(
      (space) => String(space?.id || '') === r.maxStraightenSpace,
    );
    const straightenWhere = (this.port.config()?.spaces || []).length > 1 && straightenSpace
      ? String(straightenSpace.title || straightenSpace.id) : '';
    const removed = r.orphanRoomLabelsRemoved + r.orphanDevicePositionsRemoved
      + r.orphanGroupPositionsRemoved;
    const invalidEligible = r.invalidPositionsEligible;
    const invalidRetained = r.invalidPositionsRetained;
    const liveNames = r.liveMissingPositions.map((item) => item.name).filter(Boolean);
    const visibleLiveNames = liveNames.slice(0, 3).join(', ');
    const remainingLiveNames = Math.max(0, liveNames.length - 3);
    const liveNamesText = visibleLiveNames
      ? this.port.t('gs.optimize_live_names', {
          names: visibleLiveNames,
          more: remainingLiveNames
            ? this.port.t('gs.optimize_reference_more', { n: String(remainingLiveNames) }) : '',
        })
      : '';
    const hass = this.port.hass();
    const detailStatus = (item: typeof r.removedPositions[number]): string => {
      if (r.removedPositions.some((removedItem) => removedItem.id === item.id)) {
        return this.port.t('gs.optimize_detail_removed');
      }
      if (r.liveMissingPositions.some((liveItem) => liveItem.id === item.id)) {
        return this.port.t('gs.optimize_detail_live');
      }
      return this.port.t('gs.optimize_detail_unverified');
    };
    const detailKind = (kind: typeof r.removedPositions[number]['kind']): string => this.port.t(
      kind === 'room_label' ? 'gs.optimize_detail_room_label'
        : kind === 'group' ? 'gs.optimize_detail_group'
        : kind === 'device' ? 'gs.optimize_detail_device'
        : kind === 'legacy_group' ? 'gs.optimize_detail_legacy_group'
        : 'gs.optimize_detail_unknown',
    );
    // #869 п. 10: a known name first, then the id; otherwise as before.
    const detailText = (item: SpaceReferencePositionDetail): string => {
      const name = unverifiedName(hass, item);
      const base = { status: detailStatus(item), kind: detailKind(item.kind) };
      return name
        ? this.port.t('gs.optimize_detail_item_named', { ...base, name, id: item.id, space: item.spaceId })
        : this.port.t('gs.optimize_detail_item', { ...base, id: item.id, space: item.spaceId });
    };
    const referenceDetails = [
      ...r.removedPositions,
      ...r.liveMissingPositions.filter((item) => (
        !r.removedPositions.some((removedItem) => removedItem.id === item.id)
      )),
      ...r.unverifiedPositions,
    ];
    const visibleDetails = referenceDetails.slice(0, 10);
    const remainingDetails = Math.max(0, referenceDetails.length - visibleDetails.length);
    return html`<hp-dialog form-shell settings-layout compact wide class="ui-dialog" .hass=${this.port.hass()} data-kind="settings" .title=${this.port.t('gs.align_title')} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${() => this.port.setDialog(null)}>
        <div class="body">
          ${failed
            ? html`
              <p class="alignmsg">${this.port.t('gs.align_preflight_failed', { spaces, more })}</p>
              ${failures.slice(0, 10).map((failure) => html`<p class="alignmsg">
                ${failure.displayName}: ${this.port.t(`gs.preflight_reason_${failure.reason}` as I18nKey)}
              </p>`)}
              ${failures.length > 10 ? html`<p class="alignmsg">
                ${this.port.t('gs.align_preflight_more', { n: String(failures.length - 10) })}
              </p>` : nothing}
              <div class="rhint">${this.port.t('gs.align_preflight_hint')}</div>
              ${preflightVersionsDiffer(this.port.integrationVersion(), this.port.cardVersion()) ? html`
                <div class="rhint">${this.port.t('gs.preflight_update_hint')}</div>` : nothing}
              <div class="row">
                <button class="btn ghost" @click=${() => this.copyDiagnostics()}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>
                  ${this.port.t('gs.preflight_copy')}
                </button>
              </div>
              ${this.fallbackBlock(this.clipboardFallback)}`
            : !d.changed
            ? html`<p class="alignmsg">${this.port.t(
                r.liveMissingPositions.length || r.nestedRefsUnresolved
                  ? 'gs.optimize_no_automatic_changes'
                  // #869 п. 1: unmatched records alone ask nothing of the person.
                  : r.unverifiedPositions.length ? 'gs.optimize_no_changes' : 'gs.align_none',
              )}</p>`
            : html`
              ${r.moved ? html`<p class="alignmsg">${this.port.t('gs.align_count', {
                  n: String(r.moved), total: String(r.total), cm: String(d.cm),
                })}</p>` : nothing}
              ${r.currentPositionsMoved ? html`<p class="alignmsg">${this.port.t('gs.optimize_visible_positions', {
                  n: String(r.currentPositionsMoved), total: String(r.currentPositions),
                })}</p>` : nothing}
              ${r.archivedPositions ? html`<p class="alignmsg">${this.port.t('gs.optimize_missing_space_positions', {
                  n: String(r.archivedPositionsMoved), total: String(r.archivedPositions),
                })}</p>` : nothing}
              ${r.latticeCoordinatesCanonicalized ? html`
                <p class="alignmsg">${this.port.t('gs.optimize_lattice_summary', {
                  n: String(r.latticeCoordinatesCanonicalized),
                  cm: formatLatticeShiftCm(r.latticeMaxShiftCm),
                })}</p>
                ${r.latticeSpaces.map((space) => html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_lattice_space', {
                    space: space.space,
                    n: String(space.canonicalized),
                    far: String(space.far),
                  },
                )}</p>`)}
              ` : nothing}
              ${d.where
                ? html`<p class="alignmsg">${this.port.t('gs.align_where', { s: d.where })}</p>`
                : nothing}
              ${r.rotated
                ? html`<p class="alignmsg">${this.port.t('gs.align_turned', { n: String(r.rotated) })}</p>`
                : nothing}
              ${r.wallSegmentsMigrated ? html`<p class="alignmsg">${this.port.t(
                  'gs.wall_segments_migrated', { n: String(r.wallSegmentsMigrated) },
                )}</p>` : nothing}
              ${r.roomDraftsMigrated || r.roomDraftSegmentsMigrated ? html`
                <p class="alignmsg">${this.port.t('gs.room_drafts_migrated', {
                  drafts: String(r.roomDraftsMigrated),
                  segments: String(r.roomDraftSegmentsMigrated),
                })}</p>` : nothing}
              ${r.legacyZeroWallsMigrated ? html`<p class="alignmsg">${this.port.t(
                  'gs.zero_walls_migrated', { n: String(r.legacyZeroWallsMigrated) },
                )}</p>` : nothing}
              ${modelMaintenance ? html`<p class="alignmsg">${this.port.t('gs.optimize_changes', {
                  m: String(r.migrated), c: String(r.canonicalized),
                  p: String(r.coordsCanonicalized), w: String(r.wallsMerged),
                  s: String(r.spansMerged), i: String(r.partitionsMerged),
                })}</p>` : nothing}
              ${r.partitionsReconciled ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_coincident_partitions', { n: String(r.partitionsReconciled) },
                )}</p>` : nothing}
              ${r.openingsRehosted ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_openings_rehosted', { n: String(r.openingsRehosted) },
                )}</p>` : nothing}
              ${r.wallsStraightened ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_walls_straightened', {
                    n: String(r.wallsStraightened), cm: String(straightenCm),
                  },
                )}</p>` : nothing}
              ${straightenWhere ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_walls_straightened_where', { s: straightenWhere },
                )}</p>` : nothing}
              ${r.glowSpacesMigrated || r.glowRoomsMigrated
                ? html`<p class="alignmsg">${this.port.t('gs.optimize_glow_migration', {
                    spaces: String(r.glowSpacesMigrated),
                    rooms: String(r.glowRoomsMigrated),
                  })}</p>`
                : nothing}
              ${gridWarning ? html`<div class="rhint">${this.port.t('gs.align_warn')}</div>` : nothing}`}
          ${!failed && r.wallsStraightenSkipped ? html`<p class="rhint">${this.port.t(
              'gs.optimize_walls_straighten_skipped', {
                n: String(r.wallsStraightenSkipped),
              },
            )}</p>` : nothing}
          ${repaired
            ? html`<p class="alignmsg">${this.port.t('gs.optimize_references', {
                spaces: String(r.spaceRefsRemapped), rooms: String(r.roomRefsRemapped),
                positions: String(r.positionsRemapped), detached: String(r.markersDetached),
              })}</p>`
            : nothing}
          ${removed
            ? html`<p class="alignmsg">${this.port.t('gs.optimize_orphans_removed', {
                total: String(removed),
                rooms: String(r.orphanRoomLabelsRemoved),
                devices: String(r.orphanDevicePositionsRemoved),
                groups: String(r.orphanGroupPositionsRemoved),
              })}</p>`
            : nothing}
          ${r.liveMissingPositions.length
            ? html`<div class="optimize-live">
                <p class="alignmsg">${this.port.t(d.removeLiveMissingPositions
                  ? 'gs.optimize_live_positions_remove' : 'gs.optimize_live_positions', {
                  n: String(r.liveMissingPositions.length), names: liveNamesText,
                })}</p>
                <button class="btn ghost optimize-cleanup" type="button"
                  aria-pressed=${d.removeLiveMissingPositions ? 'true' : 'false'}
                  @click=${() => this.toggleLivePositions()} ?disabled=${d.busy || !!d.retrying}>
                  <ha-icon icon=${d.removeLiveMissingPositions ? 'mdi:undo' : 'mdi:map-marker-remove-outline'}></ha-icon>
                  ${this.port.t(d.removeLiveMissingPositions
                    ? 'gs.optimize_live_keep' : 'gs.optimize_live_remove')}
                </button>
                ${d.removeLiveMissingPositions
                  ? html`<div class="rhint optimize-selected" role="status">
                      ${this.port.t('gs.optimize_live_selected')}
                    </div>`
                  : nothing}
              </div>`
            : nothing}
          ${r.unverifiedPositions.length ? this.renderUnverified(d, failed) : nothing}
          ${invalidEligible.length || invalidRetained.length ? html`<div class="optimize-invalid">
              <p class="alignmsg">${this.port.t('gs.optimize_invalid_eligible', {
                n: String(invalidEligible.length),
              })}</p>
              <p class="rhint">${this.port.t('gs.optimize_invalid_hint')}</p>
              <button class="btn ghost optimize-action optimize-invalid-cleanup" type="button"
                aria-pressed=${d.removeInvalidMissingPositions ? 'true' : 'false'}
                ?disabled=${!invalidEligible.length || d.busy || !!d.retrying || failed || !this.port.canWrite()}
                @click=${() => this.toggleInvalidPositions()}>
                <ha-icon icon=${d.removeInvalidMissingPositions ? 'mdi:undo' : 'mdi:broom'}></ha-icon>
                ${this.port.t(d.removeInvalidMissingPositions
                  ? 'gs.optimize_invalid_keep' : 'gs.optimize_invalid_remove')}
              </button>
              ${!invalidEligible.length ? html`<p class="rhint">${this.port.t('gs.optimize_invalid_none_safe')}</p>` : nothing}
              ${d.removeInvalidMissingPositions ? html`<p class="rhint" role="status">
                ${this.port.t('gs.optimize_invalid_selected', { n: String(r.invalidPositionsRemoved.length) })}
              </p>` : nothing}
              ${invalidRetained.length ? html`<p class="rhint">${this.port.t('gs.optimize_invalid_retained', {
                  n: String(invalidRetained.length),
                })}</p>
                <ul>${(['live_owner', 'unknown_shape', 'registry_unavailable', 'unsupported_model'] as const)
                  .map((reason) => {
                    const n = invalidRetained.filter((item) => item.cleanupReason === reason).length;
                    return n ? html`<li>${this.port.t(`gs.optimize_invalid_${reason}`, { n: String(n) })}</li>` : nothing;
                  })}</ul>` : nothing}
            </div>` : nothing}
          ${r.nestedRefsUnresolved
            ? html`<div class="rhint" role="alert">${this.port.t('gs.optimize_vacuum_warning', {
                n: String(r.nestedRefsUnresolved),
              })}</div>`
            : nothing}
          ${(d.vacuumNames || []).map((name) => html`<p class="rhint">${this.port.t('gs.optimize_vacuum_action', { name })}</p>`)}
          ${this.port.ledNote()}
          ${referenceDetails.length
            ? html`<details class="optimize-details">
                <summary>${this.port.t('gs.optimize_details')}</summary>
                <ul>
                  ${visibleDetails.map((item) => html`<li>${detailText(item)}</li>`)}
                </ul>
                ${remainingDetails
                  ? html`<div class="rhint">${this.port.t('gs.optimize_details_more', {
                      n: String(remainingDetails),
                    })}</div>`
                  : nothing}
              </details>`
            : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" data-hp="dialog-cancel" @click=${() => this.port.setDialog(null)}>${this.port.t(
            d.changed ? 'btn.cancel' : 'btn.close',
          )}</button>
          ${!d.changed || !d.preflight?.ok ? nothing : html`
            <button class="btn on" data-hp="dialog-confirm" @click=${() => this.run()} ?disabled=${d.busy || !!d.retrying || !this.port.canWrite()}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.port.t(d.removeInvalidMissingPositions ? 'gs.optimize_apply_changes' : 'gs.align_run')}
            </button>`}
        </div>
    </hp-dialog>`;
  }
}
