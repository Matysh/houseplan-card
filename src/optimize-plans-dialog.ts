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

import { formatLatticeShiftCm } from './coordinate-canonicalization';
import type { DeviceLayout } from './device-position-history';
import type { I18nKey } from './i18n';
import {
  spacePhysicalGeometryFingerprint, type OptimizeGeometryPreflightResult,
} from './plan-geometry-preflight';
import { optimizePlans, type OptimizeReport } from './plan-optimizer';
import type { SpaceReferenceRepairContext } from './space-reference-repair';
import type { ServerConfig } from './types';
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
};

/**
 * Всё, что диалогу нужно от редактора. Порт собирает рантайм в конструкторе;
 * других зависимостей у модуля нет. Рост порта выше 20 членов — сигнал, что
 * сюда протекает чужая подсистема (юнит `optimize-plans-dialog.test.mjs`).
 */
export interface OptimizePlansDialogPort {
  dialog(): OptimizePlansDialogState | null;
  setDialog(next: OptimizePlansDialogState | null): void;
  t(key: I18nKey, vars?: Record<string, string | number>): string;
  hass(): unknown;
  config(): ServerConfig | null;
  /** the normalised plan exists — the preview has something to optimise */
  planReady(): boolean;
  layout(): DeviceLayout | null | undefined;
  integrationVersion(): string | null;
  /** `displayVersion(CARD_VERSION)` of the runtime; no second copy here */
  cardVersion(): string;
  requestUpdate(): void;
  showToast(message: string): void;
  errorText(error: unknown): string;
  checkGeometry(config: ServerConfig): OptimizeGeometryPreflightResult;
  referenceContext(removeLiveMissingPositions: boolean): SpaceReferenceRepairContext;
  showMigrationBlocked(error: unknown): void;
  clearGeometryGesture(): void;
  commit(config: ServerConfig, layout: DeviceLayout): Promise<void>;
  /** a write conflict reloads both stores before the error toast */
  reloadAfterConflict(): Promise<unknown>;
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

  public constructor(private readonly port: OptimizePlansDialogPort) {}

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
    if (!dialog || !preflight || preflight.ok) return;
    const text = JSON.stringify(
      this.diagnostics(preflight, dialog.config ?? null), null, 2,
    );
    try {
      await navigator.clipboard.writeText(text);
      if (this.fallbacks.delete(dialog)) this.port.requestUpdate();
      this.port.showToast(this.port.t('gs.preflight_copied'));
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
  public preview(removeLiveMissingPositions: boolean): void {
    const config = this.port.config();
    if (!this.port.planReady() || !config) return;
    const spaces = config.spaces || [];
    let r;
    try {
      r = optimizePlans(
        config,
        this.port.layout() || {},
        this.port.referenceContext(removeLiveMissingPositions),
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
    // A new dialog object also starts without an inline clipboard fallback.
    this.port.setDialog({
      report: r.report, config: r.config, layout: r.layout, cm, where,
      preflight, changed: r.changed, busy: false, removeLiveMissingPositions,
    });
  }

  public open(): void { this.preview(false); }

  public toggleLivePositions(): void {
    const dialog = this.port.dialog();
    if (!dialog || dialog.busy || !dialog.report.liveMissingPositions.length) return;
    this.preview(!dialog.removeLiveMissingPositions);
  }

  /**
   * The backend persists an intent before either store changes, then keeps a
   * one-deep snapshot that remains undoable until the next plan edit.
   */
  public async run(): Promise<void> {
    let d = this.port.dialog();
    if (!d || d.busy || !this.port.config() || !d.changed || !d.preflight?.ok) return;
    const fingerprint = contentFingerprint(d.config);
    if (d.preflight.fingerprint !== fingerprint) {
      const preflight = this.port.checkGeometry(d.config);
      this.reportPreflightFailure(preflight, d.config);
      d = { ...d, preflight };
      this.port.setDialog(d);
      if (!preflight.ok) return;
    }
    this.port.clearGeometryGesture();
    this.port.setDialog({ ...d, busy: true });
    try {
      await this.port.commit(d.config, d.layout);
      this.port.setDialog(null);
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
          + d.report.orphanGroupPositionsRemoved),
      }));
    } catch (e: any) { // any-ok: ответ WS HA не типизирован, code читается как у всех писателей конфига
      const current = this.port.dialog();
      if (current) this.port.setDialog({ ...current, busy: false });
      if (e?.code === 'wall_model_client_outdated') {
        this.port.showToast(this.port.t('toast.wall_model_client_outdated'));
        return;
      }
      if (e?.code === 'conflict') {
        await this.port.reloadAfterConflict();
      }
      this.port.showToast(this.port.t('toast.error', { err: this.port.errorText(e) }));
    }
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
    const registryLimited = r.unverifiedPositions.some(
      (item) => item.reason === 'registry_unavailable',
    );
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
        : 'gs.optimize_detail_unknown',
    );
    const referenceDetails = [
      ...r.removedPositions,
      ...r.liveMissingPositions.filter((item) => (
        !r.removedPositions.some((removedItem) => removedItem.id === item.id)
      )),
      ...r.unverifiedPositions,
    ];
    const visibleDetails = referenceDetails.slice(0, 10);
    const remainingDetails = Math.max(0, referenceDetails.length - visibleDetails.length);
    const fallback = this.clipboardFallback;
    return html`<hp-dialog .hass=${this.port.hass()} data-kind="settings" .title=${this.port.t('gs.align_title')} icon="mdi:broom"
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
              ${fallback ? html`<details open>
                <summary>${this.port.t('gs.preflight_copy')}</summary>
                <pre style="user-select:text;white-space:pre-wrap">${fallback}</pre>
              </details>` : nothing}`
            : !d.changed
            ? html`<p class="alignmsg">${this.port.t(
                r.liveMissingPositions.length || r.unverifiedPositions.length
                  || r.nestedRefsUnresolved
                  ? 'gs.optimize_no_automatic_changes' : 'gs.align_none',
              )}</p>`
            : html`
              ${r.moved ? html`<p class="alignmsg">${this.port.t('gs.align_count', {
                  n: String(r.moved), total: String(r.total), cm: String(d.cm),
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
                  @click=${() => this.toggleLivePositions()} ?disabled=${d.busy}>
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
          ${r.unverifiedPositions.length
            ? html`<div class="rhint" role="alert">
                ${this.port.t('gs.optimize_unverified', {
                  n: String(r.unverifiedPositions.length),
                })}
                ${registryLimited ? ` ${this.port.t('gs.optimize_registry_limited')}` : ''}
              </div>`
            : nothing}
          ${r.nestedRefsUnresolved
            ? html`<div class="rhint" role="alert">${this.port.t('gs.optimize_vacuum_warning', {
                n: String(r.nestedRefsUnresolved),
              })}</div>`
            : nothing}
          ${referenceDetails.length
            ? html`<details class="optimize-details">
                <summary>${this.port.t('gs.optimize_details')}</summary>
                <ul>
                  ${visibleDetails.map((item) => html`<li>${this.port.t('gs.optimize_detail_item', {
                    status: detailStatus(item), kind: detailKind(item.kind),
                    id: item.id, space: item.spaceId,
                  })}</li>`)}
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
          <button class="btn ghost" data-hp="dialog-cancel" @click=${() => this.port.setDialog(null)}>${this.port.t('btn.cancel')}</button>
          ${!d.changed || !d.preflight?.ok ? nothing : html`
            <button class="btn on" data-hp="dialog-confirm" @click=${() => this.run()} ?disabled=${d.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.port.t('gs.align_run')}
            </button>`}
        </div>
    </hp-dialog>`;
  }
}
