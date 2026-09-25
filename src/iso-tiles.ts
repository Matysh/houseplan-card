/**
 * #649 п.1 (docs/ISOMETRIC.md, Stage 6): device markers and opening locks as
 * raised tiles in the 2.5D View — rounded body, a solid edge below it, a soft
 * floor shadow in one layer under every marker.
 *
 * Every number is the designer lab (sketch 07, `lab.js`/`lab.css`) converted
 * from its 80-unit base disc into D, the base core diameter of the space
 * (`--device-base-size`) already scaled by ICON_SCALE. The edge colours are the
 * lab's CSS filters (`brightness(.7) saturate(.85)`, light floor
 * `brightness(.82) saturate(.8)`) evaluated here once, so the stylesheet and
 * the tests read one source.
 *
 * Flat never reaches this module: every selector is scoped to
 * `.stage.projection-iso.mode-view`.
 */
import { html, type TemplateResult } from 'lit';
import { colorLuma, parseHexColor, type Rgb } from './iso-materials';

export const ISO_ICON_SCALE = 1.12;
/** In D (base core diameter × ICON_SCALE); lab units / 80. */
export const ISO_TILE = Object.freeze({
  depth: 8 / 80,
  radius: 22 / 80,
  radiusOfHeight: 0.3,
  lift: 6 / 80,
  badgeGap: 6 / 80,
  shadowInset: 3 / 80,
  frameWidth: 5 / 80,
  frameOutset: 6 / 80,
});

export interface IsoTileShadow {
  dx: number;
  dy: number;
  /** Gaussian σ in D (the lab's feGaussianBlur stdDeviation). */
  sigma: number;
  opacityWhite: number;
  opacityTinted: number;
}

/**
 * Computed by `getComputedStyle` from the lab in all four theme × floor
 * combinations (SPEC-REVIEW-649-r1 M1): the dark-theme opacity rule is last in
 * lab.css and overrides the floor opacities, not offset or blur.
 */
export function isoTileShadow(theme: 'light' | 'dark', lightFloor: boolean): IsoTileShadow {
  const geometry = lightFloor
    ? { dx: 8 / 80, dy: 34 / 80, sigma: 11 / 80 }
    : { dx: 8 / 80, dy: 30 / 80, sigma: 22 / 80 };
  if (theme === 'dark') return { ...geometry, opacityWhite: 0.4, opacityTinted: 0.4 };
  return lightFloor
    ? { ...geometry, opacityWhite: 0.3, opacityTinted: 0.42 }
    : { ...geometry, opacityWhite: 0.34, opacityTinted: 0.5 };
}

/** CSS `saturate(s)` then `brightness(b)` (both linear; order-free before clamping). */
function filtered(rgb: Rgb, brightness: number, saturation: number): Rgb {
  const [r, g, b] = rgb;
  const s = saturation;
  const R = (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b;
  const G = (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b;
  const B = (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b;
  return [R * brightness, G * brightness, B * brightness];
}

// + 1e-9: the filter matrices sum to 1, so float dust must not turn 178.5 into 178.
const toHex = (rgb: Rgb): string => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c)) + 1e-9)
  .toString(16).padStart(2, '0')).join('')}`;

export const ISO_DARK_EDGE_LIGHT_THEME = '#5b5e5a';
export const ISO_DARK_EDGE_DARK_THEME = '#4a4a4a';

/** Edge (tile thickness) colour of a body colour (ТЗ #649 п.1 «Торец»). */
export function isoEdgeColor(body: string, theme: 'light' | 'dark', lightFloor: boolean): string {
  const rgb = parseHexColor(body) ?? [255, 255, 255];
  const dark = colorLuma(rgb) * 255 < 70;
  if (dark) return theme === 'dark' ? ISO_DARK_EDGE_DARK_THEME : ISO_DARK_EDGE_LIGHT_THEME;
  if (theme === 'dark' && colorLuma(rgb) > 0.98) return ISO_DARK_EDGE_DARK_THEME;
  return toHex(lightFloor ? filtered(rgb, 0.82, 0.8) : filtered(rgb, 0.7, 0.85));
}

/** Body colours of the marker states (devices.styles.ts); the edge is derived from them. */
export const ISO_STATE_BODIES = Object.freeze({
  on: '#F0A00C',
  open: '#ff9f43',
  'lock-locked': '#66D17A',
  'lock-unlocked': '#F0410C',
  unavail: '#B5BAC1',
  alarm: '#F0410C',
} as const);

const D = 'var(--iso-d)';
const u = (k: number): string => `calc(${D} * ${Number(k.toFixed(6))})`;
const S = '.stage.projection-iso.mode-view';

/** The state table: body, glyph and edge per class, theme and floor. Order = Flat precedence. */
export function isoTileStateCss(): string {
  const rules: string[] = [];
  const edge = (body: string, theme: 'light' | 'dark', floor: boolean) => isoEdgeColor(body, theme, floor);
  // Neutral body: the theme core colour; no theme class keeps light-dark() like Flat.
  rules.push(`${S} .dev { --iso-body: var(--device-core-bg); --iso-fg: var(--device-core-fg);`
    + ` --iso-edge: light-dark(${edge('#ffffff', 'light', false)}, ${ISO_DARK_EDGE_DARK_THEME});`
    + ` --iso-badge-edge: light-dark(${edge('#ffffff', 'light', false)}, ${ISO_DARK_EDGE_DARK_THEME}); }`);
  rules.push(`${S} .dev.iso-floor-light { --iso-edge: light-dark(${edge('#ffffff', 'light', true)}, ${ISO_DARK_EDGE_DARK_THEME});`
    + ` --iso-badge-edge: light-dark(${edge('#ffffff', 'light', true)}, ${ISO_DARK_EDGE_DARK_THEME}); }`);
  rules.push(`${S} .dev.theme-light { --iso-edge: ${edge('#ffffff', 'light', false)}; --iso-badge-edge: ${edge('#ffffff', 'light', false)}; }`);
  rules.push(`${S} .dev.theme-light.iso-floor-light { --iso-edge: ${edge('#ffffff', 'light', true)}; --iso-badge-edge: ${edge('#ffffff', 'light', true)}; }`);
  rules.push(`${S} .dev.theme-dark { --iso-edge: ${ISO_DARK_EDGE_DARK_THEME}; --iso-badge-edge: ${ISO_DARK_EDGE_DARK_THEME}; }`);
  for (const [state, body] of Object.entries(ISO_STATE_BODIES)) {
    rules.push(`${S} .dev.${state} { --iso-body: ${body}; --iso-fg: light-dark(#fff, #252525);`
      + ` --iso-edge: ${edge(body, 'light', false)}; }`);
    rules.push(`${S} .dev.${state}.iso-floor-light { --iso-edge: ${edge(body, 'light', true)}; }`);
    rules.push(`${S} .dev.theme-light.${state} { --iso-fg: #fff; }`);
    rules.push(`${S} .dev.theme-dark.${state} { --iso-fg: #252525; }`);
  }
  // Locks: the same body language.
  rules.push(`${S} .oplock { --iso-body: var(--oplock-core-bg); --iso-fg: var(--oplock-core-fg);`
    + ` --iso-edge: light-dark(${edge('#ffffff', 'light', false)}, ${ISO_DARK_EDGE_DARK_THEME}); }`);
  rules.push(`${S} .oplock.iso-floor-light { --iso-edge: light-dark(${edge('#ffffff', 'light', true)}, ${ISO_DARK_EDGE_DARK_THEME}); }`);
  rules.push(`${S} .oplock.theme-dark { --iso-edge: ${ISO_DARK_EDGE_DARK_THEME}; }`);
  for (const [cls, body] of [['locked', '#66D17A'], ['unlocked', '#F0410C']] as const) {
    rules.push(`${S} .oplock.${cls} { --iso-edge: ${edge(body, 'light', false)}; }`);
    rules.push(`${S} .oplock.${cls}.iso-floor-light { --iso-edge: ${edge(body, 'light', true)}; }`);
  }
  // Floor shadows, theme × floor (a later rule of equal weight wins: dark last).
  const tinted = ':is(.on, .open, .lock-locked, .lock-unlocked, .unavail, .alarm, .locked, .unlocked)';
  const shadow = (sel: string, s: IsoTileShadow, white = true) => `${sel} {`
    + ` --iso-sh-dx: ${u(s.dx)}; --iso-sh-dy: ${u(s.dy)}; --iso-sh-blur: ${u(s.sigma * 2)};`
    + ` --iso-sh-a: ${white ? s.opacityWhite : s.opacityTinted}; --iso-sh-a-white: ${s.opacityWhite}; }`;
  const G = `${S} .iso-tile-shadow`;
  rules.push(shadow(G, isoTileShadow('light', false)));
  rules.push(shadow(`${G}${tinted}`, isoTileShadow('light', false), false));
  rules.push(shadow(`${G}.iso-floor-light`, isoTileShadow('light', true)));
  rules.push(shadow(`${G}.iso-floor-light${tinted}`, isoTileShadow('light', true), false));
  rules.push(shadow(`${G}.theme-dark.theme-dark`, isoTileShadow('dark', false)));
  rules.push(shadow(`${G}.theme-dark.theme-dark.iso-floor-light`, isoTileShadow('dark', true)));
  rules.push(shadow(`${G}.theme-dark.theme-dark${tinted}`, isoTileShadow('dark', false), false));
  rules.push(shadow(`${G}.theme-dark.theme-dark.iso-floor-light${tinted}`, isoTileShadow('dark', true), false));
  return rules.join('\n');
}

/** Geometry of the tile language, as CSS custom properties in D. */
export function isoTileGeometryCss(): string {
  return `${S} .devlayer { --iso-d: calc(var(--device-base-size, 2.25cqw) * ${ISO_ICON_SCALE}); }
${S} .dev, ${S} .oplock {
  --iso-depth: ${u(ISO_TILE.depth)};
  --iso-lift: ${u(ISO_TILE.lift)};
  --iso-frame-w: ${u(ISO_TILE.frameWidth)};
  --iso-frame-out: ${u(ISO_TILE.frameOutset + ISO_TILE.frameWidth / 2)};
  --iso-shadow-inset: ${u(ISO_TILE.shadowInset)};
}
${S} .dev { --iso-radius: min(${u(ISO_TILE.radius)}, calc(var(--dev-size) * ${ISO_TILE.radiusOfHeight})); }
${S} .dev .value-badge { --iso-badge-radius: min(${u(ISO_TILE.radius)}, calc(var(--dev-size) * .7875 * ${ISO_TILE.radiusOfHeight})); }
${S} .dev .device-shell.with-values { gap: ${u(ISO_TILE.badgeGap)}; }
${S} .oplock { --iso-radius: min(${u(ISO_TILE.radius)}, calc(var(--oplock-core-size) * ${ISO_TILE.radiusOfHeight})); }`;
}

/**
 * The floor-shadow twin of a marker or lock: the same classes and geometry,
 * painted only as the inset, blurred box-shadow of its bodies. It lives in one
 * layer under every marker, so a shadow never lands on a neighbour's tile.
 */
export function renderIsoTileShadow(kind: 'dev' | 'oplock', owner: string, classes: string, style: string,
  face: TemplateResult): TemplateResult {
  return html`<div class="${kind} iso-tile-shadow ${classes}" data-shadow-of=${owner} style=${style}
    aria-hidden="true">${face}</div>`;
}
