/** Shared four-phase environment templates for full and static cards (#146). */
import { html, nothing, type TemplateResult } from 'lit';
import {
  DAY_CYCLE_PALETTES, type DayCyclePhase, type DayCycleState,
} from './sun';

const PHASES: readonly DayCyclePhase[] = ['dawn', 'day', 'dusk', 'night'];

/** CSS variables owned by the stage rather than copied into its plan tree. */
export function dayCycleStageVars(state: DayCycleState | null): string {
  if (!state) return '';
  const palette = DAY_CYCLE_PALETTES[state.phase];
  return [
    `--hp-day-cycle-outline-near:${palette.outlineNear}`,
    `--hp-day-cycle-outline-mid:${palette.outlineMid}`,
    `--hp-day-cycle-outline-far:${palette.outlineFar}`,
  ].join(';');
}

/** Four constant layers make gradient changes genuinely cross-fade in CSS. */
export function renderDayCycleEnvironment(
  state: DayCycleState | null,
  viewWeight = 1,
): TemplateResult | typeof nothing {
  if (!state) return nothing;
  const position = [
    `--hp-day-cycle-sun-x:${state.sunX.toFixed(2)}%`,
    `--hp-day-cycle-sun-y:${state.sunY.toFixed(2)}%`,
    `--hp-day-cycle-sun-opacity:${state.sunOpacity.toFixed(3)}`,
    `opacity:${Math.min(1, Math.max(0, viewWeight)).toFixed(4)}`,
  ].join(';');
  return html`<div class="hp-day-cycle-env" aria-hidden="true"
      data-day-cycle-phase=${state.phase} data-day-cycle-source=${state.source}
      style=${position}>
    ${PHASES.map((phase) => {
      const palette = DAY_CYCLE_PALETTES[phase];
      const background = `background:radial-gradient(ellipse at 50% 88%, ${palette.horizon} 0%, transparent 54%),linear-gradient(180deg, ${palette.top} 0%, ${palette.bottom} 100%);box-shadow:inset 0 0 90px ${palette.vignette}`;
      return html`<div class="hp-day-cycle-bg phase-${phase} ${phase === state.phase ? 'active' : ''}"
          data-day-cycle-layer=${phase} style=${background}>
        <div class="hp-day-cycle-sun" style="background:radial-gradient(circle, ${palette.sun} 0%, transparent 67%)"></div>
      </div>`;
    })}
  </div>`;
}
