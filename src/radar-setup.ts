/** Session-local on-plan calibration flow for Stage-1 presence radars (#485). */
import { html, nothing, svg, type TemplateResult } from 'lit';

import type { I18nKey } from './i18n';
import { formatLength } from './logic';
import {
  projectRadarLocal, radarMedianSample, solveRadarTwoPoint,
} from './radar-geometry';
import type { RadarEditorDraft } from './radar-editor';
import type { MarkerRadar, RoomCfg } from './types';

const COUNTDOWN_MS = 10_000;
const CAPTURE_MS = 5_000;
const TRAIL_MS = 8_000;

type Point = readonly [number, number];
type SetupPhase = 'mount' | 'heading' | 'reference_1' | 'reference_2'
  | 'capture' | 'solved' | 'check_reference' | 'checking' | 'checked';

interface SetupSnapshot {
  local_targets?: { slot?: string; x_cm?: number; y_cm?: number; reported_at?: number }[];
  frame?: { health?: string };
}

interface RadarSetupConnection {
  subscribeMessage(
    callback: (event: unknown) => void,
    message: Record<string, unknown>,
  ): Promise<unknown>;
}
interface RadarSetupHass {
  connection?: RadarSetupConnection;
  config?: { unit_system?: { length?: string } };
}

interface ReferencePair { plan: Point; local: Point }

interface ActiveSetup {
  markerId: string;
  draft: RadarEditorDraft;
  room: RoomCfg;
  cellCm: number;
  configRev: number;
  phase: SetupPhase;
  mount: Point | null;
  headingPoint: Point | null;
  pendingPlan: Point | null;
  refs: ReferencePair[];
  solved?: { headingDeg: number; mirror: boolean; rmsCm: number };
  checkErrorCm?: number;
  countdownUntil?: number;
  captureUntil?: number;
  captureFor?: 0 | 1 | 2;
  samples: { at: number; point: Point }[];
  ambiguous: boolean;
  error?: I18nKey;
  trail: { at: number; slot: string; point: Point }[];
}

export interface RadarSetupHost {
  hass(): RadarSetupHass | null | undefined;
  requestUpdate(): void;
  t(key: I18nKey, vars?: Record<string, string | number>): string;
  configFromDraft(draft: RadarEditorDraft, cellCm: number): MarkerRadar | null;
  apply(draft: RadarEditorDraft): void;
}

function pointFromEvent(event: PointerEvent): Point | null {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return null;
  return [
    Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  ];
}

function headingBetween(mount: Point, target: Point): number {
  return ((Math.atan2(target[0] - mount[0], mount[1] - target[1]) * 180 / Math.PI) % 360 + 360) % 360;
}

function finitePoint(value: unknown): value is Point {
  return Array.isArray(value) && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

/**
 * Owns draft listeners and timers. Nothing here writes configuration: Apply
 * only returns a patched editor draft, and the ordinary marker Save remains
 * the sole revisioned persistence boundary.
 */
export class RadarSetupController {
  private active: ActiveSetup | null = null;
  private unsubscribe?: () => void;
  private generation = 0;
  private timer = 0;

  public constructor(private readonly host: RadarSetupHost) {}

  public begin(
    markerId: string, draft: RadarEditorDraft, room: RoomCfg, cellCm: number, configRev: number,
  ): boolean {
    if (!this.host.configFromDraft(draft, cellCm)) return false;
    this.reset();
    this.active = {
      markerId, draft, room, cellCm, configRev, phase: 'mount', mount: null,
      headingPoint: null, pendingPlan: null, refs: [], samples: [], ambiguous: false, trail: [],
    };
    this.host.requestUpdate();
    return true;
  }

  public reset(): void {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    clearInterval(this.timer);
    this.timer = 0;
    this.active = null;
  }

  public cancel(): boolean {
    if (!this.active) return false;
    this.reset();
    this.host.requestUpdate();
    return true;
  }

  public isActive(): boolean { return this.active !== null; }

  public syncMarker(markerId: string): void {
    if (this.active && this.active.markerId !== markerId) this.reset();
  }

  private coordinateProfile(): boolean {
    return !!this.active && ['esphome_ld2450_v1', 'cartesian_v1', 'polar_v1']
      .includes(this.active.draft.profile);
  }

  private choosePoint(event: PointerEvent): void {
    const state = this.active;
    const point = pointFromEvent(event);
    if (!state || !point || event.isPrimary === false
        || state.phase === 'capture' || state.phase === 'checking') return;
    state.error = undefined;
    if (state.phase === 'mount') {
      state.mount = point;
      state.phase = 'heading';
    } else if (state.phase === 'heading' && state.mount) {
      state.headingPoint = point;
      state.draft = {
        ...state.draft,
        mountX: String(Number((state.mount[0] * 1000).toFixed(3))),
        mountY: String(Number((state.mount[1] * 1000).toFixed(3))),
        heading: String(Number(headingBetween(state.mount, point).toFixed(3))),
      };
      state.phase = this.coordinateProfile() ? 'reference_1' : 'solved';
      if (this.coordinateProfile()) void this.subscribe();
    } else if (state.phase === 'reference_1' || state.phase === 'reference_2'
        || state.phase === 'check_reference') {
      state.pendingPlan = point;
    }
    this.host.requestUpdate();
  }

  private async subscribe(): Promise<void> {
    const state = this.active;
    const connection = this.host.hass()?.connection;
    if (!state || this.unsubscribe || typeof connection?.subscribeMessage !== 'function') return;
    const config = this.host.configFromDraft(state.draft, state.cellCm);
    if (!config) return;
    const generation = ++this.generation;
    try {
      const unsubscribe = await connection.subscribeMessage((event: unknown) => {
        if (generation !== this.generation || !this.active) return;
        this.receive(event as SetupSnapshot);
      }, {
        type: 'houseplan/radar/setup/subscribe', marker_id: state.markerId,
        expected_config_rev: state.configRev, draft_sources: { radar: config },
      });
      if (generation !== this.generation || !this.active) {
        if (typeof unsubscribe === 'function') unsubscribe();
      } else if (typeof unsubscribe === 'function') this.unsubscribe = unsubscribe as () => void;
    } catch (error: unknown) {
      if (generation !== this.generation || !this.active) return;
      const code = String(error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code || 'not_ready' : 'not_ready');
      const key = `radar.error_${code}` as I18nKey;
      this.active.error = this.host.t(key) === key ? 'radar.error_not_ready' : key;
      this.host.requestUpdate();
    }
  }

  private receive(snapshot: SetupSnapshot): void {
    const state = this.active;
    if (!state) return;
    const now = Date.now();
    const targets = Array.isArray(snapshot.local_targets)
      ? snapshot.local_targets.filter((target) => finitePoint([target.x_cm, target.y_cm])) : [];
    const activeSlots = new Set(targets.map((target) => String(target.slot || 'target')));
    state.trail = state.trail.filter((entry) =>
      entry.at >= now - TRAIL_MS && activeSlots.has(entry.slot));
    for (const target of targets) {
      const local: Point = [target.x_cm!, target.y_cm!];
      const slot = String(target.slot || 'target');
      const heading = state.solved?.headingDeg ?? Number(state.draft.heading);
      const mirror = state.solved?.mirror ?? state.draft.mirror;
      if (state.mount) {
        try {
          const point = projectRadarLocal(state.mount, heading, mirror, state.cellCm, local);
          const previous = [...state.trail].reverse().find((entry) => entry.slot === slot);
          if (previous && Math.hypot(
            point[0] - previous.point[0], point[1] - previous.point[1],
          ) * 240 * state.cellCm > 100) {
            state.trail = state.trail.filter((entry) => entry.slot !== slot);
          }
          state.trail.push({ at: now, slot, point });
        } catch { /* malformed live diagnostics stay invisible */ }
      }
    }
    const boundedTrail: ActiveSetup['trail'] = [];
    for (const slot of activeSlots) {
      boundedTrail.push(...state.trail.filter((entry) => entry.slot === slot).slice(-32));
    }
    state.trail = boundedTrail.sort((a, b) => a.at - b.at);
    if ((state.phase === 'capture' || state.phase === 'checking')
        && now >= (state.countdownUntil || 0) && now < (state.captureUntil || 0)) {
      if (targets.length === 1) {
        const reported = Number(targets[0].reported_at);
        state.samples.push({
          at: Number.isFinite(reported) ? reported * 1000 : now,
          point: [targets[0].x_cm!, targets[0].y_cm!],
        });
      } else if (targets.length > 1) state.ambiguous = true;
    }
    this.host.requestUpdate();
  }

  private startCapture(): void {
    const state = this.active;
    if (!state?.pendingPlan || !this.coordinateProfile()) return;
    state.samples = [];
    state.ambiguous = false;
    state.error = undefined;
    state.captureFor = state.phase === 'reference_1' ? 0
      : state.phase === 'reference_2' ? 1 : 2;
    state.phase = state.captureFor === 2 ? 'checking' : 'capture';
    state.countdownUntil = Date.now() + COUNTDOWN_MS;
    state.captureUntil = state.countdownUntil + CAPTURE_MS;
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 200);
    void this.subscribe();
    this.host.requestUpdate();
  }

  private tick(): void {
    const state = this.active;
    if (!state || !state.captureUntil || Date.now() < state.captureUntil) {
      this.host.requestUpdate();
      return;
    }
    clearInterval(this.timer);
    this.timer = 0;
    let local: Point;
    try {
      if (state.ambiguous) throw new Error('ambiguous_target');
      if (state.samples.length < 3
          || Math.max(...state.samples.map((sample) => sample.at))
            - Math.min(...state.samples.map((sample) => sample.at)) < 2_000) {
        throw new Error('insufficient_samples');
      }
      local = radarMedianSample(state.samples.map((sample) => sample.point));
    } catch (error: unknown) {
      state.error = String((error as Error)?.message) === 'ambiguous_target'
        ? 'radar.ambiguous_target' : 'radar.insufficient_samples';
      state.phase = state.captureFor === 0 ? 'reference_1'
        : state.captureFor === 1 ? 'reference_2' : 'check_reference';
      this.host.requestUpdate();
      return;
    }
    if (state.captureFor === 2 && state.solved && state.mount && state.pendingPlan) {
      const projected = projectRadarLocal(
        state.mount, state.solved.headingDeg, state.solved.mirror, state.cellCm, local,
      );
      state.checkErrorCm = Math.hypot(
        projected[0] - state.pendingPlan[0], projected[1] - state.pendingPlan[1],
      ) * 240 * state.cellCm;
      state.phase = 'checked';
    } else if (state.pendingPlan) {
      state.refs[state.captureFor || 0] = { plan: state.pendingPlan, local };
      state.pendingPlan = null;
      if (state.refs.length < 2) state.phase = 'reference_2';
      else this.solve();
    }
    this.host.requestUpdate();
  }

  private solve(): void {
    const state = this.active;
    if (!state?.mount || state.refs.length !== 2) return;
    try {
      state.solved = solveRadarTwoPoint(
        state.mount,
        [state.refs[0].local, state.refs[1].local],
        [state.refs[0].plan, state.refs[1].plan],
        state.cellCm,
      );
      state.draft = {
        ...state.draft,
        heading: String(Number(state.solved.headingDeg.toFixed(3))),
        mirror: state.solved.mirror,
      };
      state.phase = 'solved';
      state.error = undefined;
    } catch (error: unknown) {
      const message = String((error as Error)?.message);
      state.error = message === 'ambiguous_sources' ? 'radar.bad_references' : 'radar.bad_fit';
      state.refs = [];
      state.phase = 'reference_1';
    }
  }

  private beginCheck(): void {
    if (!this.active?.solved) return;
    this.active.pendingPlan = null;
    this.active.phase = 'check_reference';
    this.host.requestUpdate();
  }

  public interrupt(): void {
    if (!this.active) return;
    this.reset();
    this.host.requestUpdate();
  }

  private apply(): void {
    const state = this.active;
    if (!state?.mount || !state.headingPoint) return;
    const calibrationOverride = state.solved ? {
      method: 'two_point' as const,
      mirror: state.solved.mirror,
      cell_cm: state.cellCm,
      refs: state.refs.map((ref) => ({
        plan: { x: ref.plan[0], y: ref.plan[1] },
        local_cm: { x: ref.local[0], y: ref.local[1] },
      })),
      rms_cm: state.solved.rmsCm,
    } : {
      method: this.coordinateProfile() ? 'manual' as const : 'not_required' as const,
      mirror: state.draft.mirror,
      cell_cm: state.cellCm,
    };
    const draft = { ...state.draft, calibrationOverride };
    this.reset();
    this.host.apply(draft);
    this.host.requestUpdate();
  }

  private instruction(state: ActiveSetup): string {
    if (state.phase === 'mount') return this.host.t('radar.step_place_mount');
    if (state.phase === 'heading') return this.host.t('radar.step_place_heading');
    if (state.phase === 'reference_1') return this.host.t('radar.step_reference', { n: 1 });
    if (state.phase === 'reference_2') return this.host.t('radar.step_reference', { n: 2 });
    if (state.phase === 'check_reference') return this.host.t('radar.step_check_reference');
    if (state.phase === 'capture' || state.phase === 'checking') {
      const remaining = Math.max(0, Math.ceil(((state.countdownUntil || 0) - Date.now()) / 1000));
      return remaining > 0 ? this.host.t('radar.countdown', { seconds: remaining })
        : this.host.t('radar.capturing');
    }
    return this.host.t(state.phase === 'checked' ? 'radar.check_complete' : 'radar.fit_ready');
  }

  public render(): TemplateResult | typeof nothing {
    const state = this.active;
    if (!state) return nothing;
    const polygon = (state.room.poly || []).map((point) => `${point[0] * 1000},${point[1] * 1000}`).join(' ');
    const markers = [
      ...(state.mount ? [{ point: state.mount, cls: 'mount', label: 'R' }] : []),
      ...state.refs.map((ref, index) => ({ point: ref.plan, cls: 'reference', label: String(index + 1) })),
      ...(state.pendingPlan ? [{ point: state.pendingPlan, cls: 'pending', label: '+' }] : []),
    ];
    const canCapture = !!state.pendingPlan
      && ['reference_1', 'reference_2', 'check_reference'].includes(state.phase);
    const trailGroups = [...new Set(state.trail.map((entry) => entry.slot))]
      .map((slot) => state.trail.filter((entry) => entry.slot === slot));
    return html`<div class="radarsetup" role="group" aria-label=${this.host.t('radar.configure')}>
      <div class="radarsetup-head">
        <strong>${this.instruction(state)}</strong>
        <button class="iconbtn" type="button" title=${this.host.t('btn.cancel')}
          @click=${() => this.cancel()}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet"
        @pointerdown=${(event: PointerEvent) => this.choosePoint(event)}
        @pointercancel=${() => this.interrupt()}>
        <polygon class="room" points=${polygon}></polygon>
        ${trailGroups.map((trail) => trail.length > 1 ? svg`<polyline class="trail"
          points=${trail.map((entry) => `${entry.point[0] * 1000},${entry.point[1] * 1000}`).join(' ')}></polyline>` : nothing)}
        ${state.mount && state.headingPoint ? svg`<line class="heading"
          x1=${state.mount[0] * 1000} y1=${state.mount[1] * 1000}
          x2=${state.headingPoint[0] * 1000} y2=${state.headingPoint[1] * 1000}></line>` : nothing}
        ${markers.map((marker) => svg`<g class=${marker.cls}
          transform="translate(${marker.point[0] * 1000} ${marker.point[1] * 1000})">
          <circle r="18"></circle><text y="1">${marker.label}</text></g>`)}
      </svg>
      <p class="muted">${this.host.t('radar.desktop_hint')}</p>
      ${state.error ? html`<p class="error" role="alert">${this.host.t(state.error)}</p>` : nothing}
      ${state.checkErrorCm != null ? html`<p role="status">${this.host.t('radar.error_distance', {
        distance: formatLength(
          state.checkErrorCm,
          this.host.hass()?.config?.unit_system?.length === 'mi',
        ),
      })}</p>` : nothing}
      <div class="row">
        ${canCapture ? html`<button class="btn" type="button" @click=${() => this.startCapture()}>
          ${this.host.t('radar.start_measure')}</button>` : nothing}
        ${state.phase === 'solved' ? html`<button class="btn ghost" type="button"
          @click=${() => this.beginCheck()}>${this.host.t('radar.check_third')}</button>` : nothing}
        ${state.phase === 'solved' || state.phase === 'checked'
          ? html`<button class="btn on" type="button" @click=${() => this.apply()}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host.t('btn.save')}</button>` : nothing}
      </div>
    </div>`;
  }
}
