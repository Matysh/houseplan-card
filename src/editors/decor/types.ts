/**
 * Typed persisted model of the decorative layer.
 *
 * Coordinates stay normalised against the square plan canvas.  Physical
 * presentation (`width_cm`) is deliberately separate from geometry: resizing
 * an object must never make its outline thicker.
 */
export type DecorKind = 'line' | 'rect' | 'ellipse' | 'text' | 'furniture';

export interface DecorBase {
  id: string;
  kind: DecorKind;
  color?: string;
  /** Opacity of the stroke, glyphs or furniture drawing. */
  opacity?: number;
  /** Canonical physical stroke width. Old plans may still carry `width`. */
  width_cm?: number;
  /** Legacy SVG/render-unit stroke width. Read-only compatibility. */
  width?: number;
}

export interface DecorLine extends DecorBase {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Missing/solid keeps the legacy appearance; dashed is selected in properties. */
  line_style?: 'solid' | 'dashed';
}

export interface DecorBoxBase extends DecorBase {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
}

export interface DecorRect extends DecorBoxBase {
  kind: 'rect';
  fill?: boolean;
  fill_color?: string;
  fill_opacity?: number;
}

export interface DecorEllipse extends DecorBoxBase {
  kind: 'ellipse';
  fill?: boolean;
  fill_color?: string;
  fill_opacity?: number;
}

export interface DecorText extends DecorBase {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  /** Canonical physical font size. `size`/`scale` are legacy fallbacks. */
  size_cm?: number;
  size?: 's' | 'm' | 'l';
  scale?: number;
  angle?: number;
  /** Legacy live-text fields; new writes keep references inside `text`. */
  entity?: string | null;
  attr?: string | null;
  unit?: string | null;
}

export interface DecorFurniture extends DecorBoxBase {
  kind: 'furniture';
  symbol: string;
}

export type DecorShape = DecorLine | DecorRect | DecorEllipse | DecorText | DecorFurniture;

/** Session default / resolved per-object visual style. */
export interface DecorStyle {
  color: string;
  opacity: number;
  widthCm: number;
  fill: boolean;
  fillColor: string;
  fillOpacity: number;
}

/**
 * Future custom pictures implement this contract without changing selection,
 * snapping or transform chrome. File upload/lifecycle is intentionally not a
 * part of the current release.
 */
export interface DecorImageTransform {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  opacity?: number;
}
