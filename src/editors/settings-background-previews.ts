import { html, type TemplateResult } from 'lit';
import { dayPhase } from '../sun';

export function settingsBackgroundPreviews(labels: readonly [string, string, string, string], hint: string): TemplateResult {
  const examples = [30, 0, 0, -18];
  return html`<div class="hpf-background-examples">
    <div class="hpf-background-grid">${labels.map((label, i) => html`
      <figure><div class="hpf-background-stage" style=${`background:${dayPhase(examples[i]).bg}`}>
        <ha-icon icon=${i === 3 ? 'mdi:weather-night' : i === 1 ? 'mdi:weather-sunset-up' : i === 2 ? 'mdi:weather-sunset-down' : 'mdi:white-balance-sunny'}></ha-icon>
        <svg viewBox="0 0 160 80" aria-hidden="true"><path d="M20 12H140V68H20ZM80 12V47M80 58V68M20 40H55M65 40H80M80 32H140" fill="var(--card-background-color)" stroke="var(--primary-text-color)" stroke-width="3" /></svg>
      </div><figcaption>${label}</figcaption></figure>`)}</div>
    <p class="hpf-hint">${hint}</p>
  </div>`;
}
