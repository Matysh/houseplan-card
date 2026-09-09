import { svg, type TemplateResult } from 'lit';

// Designer-supplied Tabler outline paths. Attribution travels in the package's
// THIRD_PARTY_NOTICES.md; no remote icon request or HA icon-registry dependency.
const paths = {
  settings: [
    'M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065',
    'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
  ],
  sidebar: ['M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12', 'M15 4l0 16'],
  eye: ['M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6'],
  eyeOff: ['M10.585 10.587a2 2 0 0 0 2.829 2.828', 'M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87', 'M3 3l18 18'],
  plus: ['M12 5l0 14', 'M5 12l14 0'],
  chevron: ['M6 9l6 6l6 -6'],
  up: ['M12 19V5m-6 6 6-6 6 6'],
  down: ['M12 5v14m-6-6 6 6 6-6'],
  close: ['m6 6 12 12M6 18 18 6'],
  grip: ['M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01'],
} as const;

export function summaryIcon(name: keyof typeof paths): TemplateResult {
  return svg`<svg class="summary-icon" data-summary-icon=${name} viewBox="0 0 24 24"
    width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    ${paths[name].map((d) => svg`<path d=${d}></path>`)}
  </svg>`;
}
