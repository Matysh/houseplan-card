import { html, type TemplateResult } from 'lit';
import { DAY_CYCLE_PALETTES, type DayCyclePhase } from '../sun';

/** Use the same phase tokens as the real surrounding canvas, never legacy dayPhase colours. */
export function settingsBackgroundPreviews(labels: readonly [string, string, string, string], hints: readonly string[]): TemplateResult {
  const phases: readonly DayCyclePhase[] = ['dawn', 'day', 'dusk', 'night'];
  return html`<div class="hpf-background-examples">
    <div class="hpf-background-grid">${phases.map((phase, i) => {
      const p = DAY_CYCLE_PALETTES[phase];
      return html`<figure><div class="hpf-background-stage" data-phase=${phase}
        style=${`background:radial-gradient(ellipse at 50% 88%,${p.horizon} 0%,transparent 54%),linear-gradient(180deg,${p.top} 0%,${p.bottom} 100%);box-shadow:inset 0 0 45px ${p.vignette}`}>
        <svg viewBox="0 0 120 84" aria-hidden="true"><path class="hpf-mini-floor" d="M18 14H102V70H62V60H18Z"/><path class="hpf-mini-wall" d="M62 14V60M18 40H62M62 42H102"/></svg>
      </div><figcaption>${labels[i]}</figcaption></figure>`;
    })}</div>
    <div class="hpf-background-rules">${hints.map(hint => html`<p class="hpf-hint">${hint}</p>`)}</div>
  </div>`;
}
