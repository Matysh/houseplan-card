import { html, svg, type TemplateResult } from 'lit';
import { unitInput } from './form-kit';

export function settingsNorth({
  id, value, raw, label, invalid, angleHint, onInput, onChange,
}: {
  id: string; value: number | null; raw: string; label: string; invalid?: boolean; angleHint?: string;
  onInput: (raw: string) => void; onChange: (value: number) => void;
}): TemplateResult {
  const angle = value ?? 0;
  const point = (event: MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) > 8) onChange((Math.round(Math.atan2(x, -y) * 180 / Math.PI) + 360) % 360);
  };
  return html`<div class="hpf-north-control">
    <button data-hp="field" data-field=${`${id}-dial`} class="hpf-north-dial ${value === null ? 'hpf-unset' : ''}" type="button" role="slider" aria-label=${label}
      aria-valuemin="0" aria-valuemax="359" aria-valuenow=${angle}
      @keydown=${(event: KeyboardEvent) => {
        const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
        if (delta !== undefined || event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          onChange(event.key === 'Home' ? 0 : event.key === 'End' ? 359 : (angle + delta! + 360) % 360);
        }
      }}
      @pointerdown=${(event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const button = event.currentTarget as HTMLElement;
        button.focus(); button.setPointerCapture(event.pointerId); point(event);
      }}
      @pointermove=${(event: PointerEvent) => {
        if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) point(event);
      }}
      @pointerup=${(event: PointerEvent) => {
        const button = event.currentTarget as HTMLElement;
        if (button.hasPointerCapture(event.pointerId)) { point(event); button.releasePointerCapture(event.pointerId); }
      }}>
      <svg viewBox="0 0 148 148" aria-hidden="true">
        <circle cx="74" cy="74" r="56" fill="none" stroke="currentColor" opacity=".25" />
        ${Array.from({ length: 36 }, (_, i) => {
          const a = i * Math.PI / 18, inner = i % 9 === 0 ? 43 : 49;
          return svg`<line x1=${74 + Math.sin(a) * inner} y1=${74 - Math.cos(a) * inner}
            x2=${74 + Math.sin(a) * 54} y2=${74 - Math.cos(a) * 54} stroke="currentColor" opacity=".4" />`;
        })}
        <g transform=${`rotate(${angle} 74 74)`}>
          <path d="M74 28 L64 82 L74 74 L84 82Z" fill="var(--primary-color)" />
          <path d="M74 120 L64 82 L74 74 L84 82Z" fill="currentColor" opacity=".35" />
        </g>
        <circle cx="74" cy="74" r="4" fill="currentColor" />
        <text x="74" y="13" text-anchor="middle" fill="currentColor">0°</text>
        <text x="137" y="78" text-anchor="middle" fill="currentColor">90°</text>
        <text x="74" y="145" text-anchor="middle" fill="currentColor">180°</text>
        <text x="12" y="78" text-anchor="middle" fill="currentColor">270°</text>
      </svg>
    </button>
    <div class="hpf-north-values">
      ${unitInput({ id, value: raw, wide:true, min: 0, max: 359, step: 1, unit: '°', ariaLabel: label, invalid, onInput })}
      <input data-hp="field" data-field=${`${id}-slider`} type="range" min="0" max="359" step="1" .value=${String(angle)} aria-label=${label}
        @input=${(event: Event) => onChange(Number((event.target as HTMLInputElement).value))} />
      ${angleHint ? html`<p class="hpf-hint">${angleHint}</p>` : ''}
    </div>
  </div>`;
}
