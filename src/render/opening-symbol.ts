import { svg, type TemplateResult } from 'lit';
import type { OpeningCfg } from '../types';
import { gridVisualScale, gridVisualUnits } from '../grid-scale';
import { openingSymbolOffset, type OpeningFaceOffset } from '../opening-symbol-placement';

export type { OpeningFaceOffset } from '../opening-symbol-placement';

export interface OpeningVisibleSpec {
  type: OpeningCfg['type'];
  length: number;
  angle: number;
  amount: number;
  flipH: boolean;
  flipV: boolean;
  base: string;
  tone: string;
  cellCm: number;
  gridPitch: number;
  face: OpeningFaceOffset;
}

export interface OpeningVisibleMetrics {
  half: number;
  jambHalf: number;
  gateDepth: number;
  outlineHalf: number;
  hitHalf: number;
}

export interface OpeningVisibleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function openingVisibleMetrics(spec: OpeningVisibleSpec): OpeningVisibleMetrics {
  const half = spec.length / 2;
  const jambHalf = spec.face.cm > 0
    ? ((spec.face.cm / spec.cellCm) * spec.gridPitch) / 2
    : gridVisualUnits(4, spec.cellCm);
  const gateDepth = spec.type === 'gate' ? Math.sin((10 * Math.PI) / 180) * half : 0;
  return {
    half,
    jambHalf,
    gateDepth,
    outlineHalf: Math.max(
      gridVisualUnits(16, spec.cellCm),
      jambHalf + gridVisualUnits(8, spec.cellCm),
      gateDepth + gridVisualUnits(8, spec.cellCm),
    ),
    hitHalf: Math.max(
      gridVisualUnits(20, spec.cellCm),
      jambHalf + gridVisualUnits(10, spec.cellCm),
      gateDepth + gridVisualUnits(12, spec.cellCm),
    ),
  };
}

type LocalBounds = OpeningVisibleBounds;

function addPoint(bounds: LocalBounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function addSweptRect(
  bounds: LocalBounds,
  originX: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  fromDeg: number,
  toDeg: number,
): void {
  const lo = Math.min(fromDeg, toDeg) * Math.PI / 180;
  const hi = Math.max(fromDeg, toDeg) * Math.PI / 180;
  const candidates = (x: number, y: number): number[] => {
    const phase = Math.atan2(y, x);
    const angles = [lo, hi];
    for (let k = -3; k <= 3; k++) {
      const horizontal = k * Math.PI - phase;
      const vertical = Math.PI / 2 + k * Math.PI - phase;
      if (horizontal > lo && horizontal < hi) angles.push(horizontal);
      if (vertical > lo && vertical < hi) angles.push(vertical);
    }
    return angles;
  };
  for (const x of [x0, x1]) for (const y of [y0, y1]) {
    for (const angle of candidates(x, y)) {
      const c = Math.cos(angle), s = Math.sin(angle);
      addPoint(bounds, originX + x * c - y * s, x * s + y * c);
    }
  }
}

function bodyTranslation(spec: OpeningVisibleSpec): [number, number] {
  const visualOffset = openingSymbolOffset(
    spec.type, spec.flipV, spec.angle, spec.face,
  );
  if (!visualOffset.ox && !visualOffset.oy) return [0, 0];
  const rad = (-spec.angle * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const sx = spec.flipH ? -1 : 1;
  const sy = spec.flipV ? -1 : 1;
  return [
    (visualOffset.ox * c - visualOffset.oy * s) * sx,
    (visualOffset.ox * s + visualOffset.oy * c) * sy,
  ];
}

/**
 * State-independent painted envelope of one saved architectural symbol.
 * Leaf rectangles are swept analytically through their complete motion; no
 * DOM measurement is involved, and changing the bound entity cannot resize
 * a tight static card. `passage` has no standalone visible symbol.
 */
export function openingVisibleBounds(
  spec: OpeningVisibleSpec,
  center: readonly [number, number] = [0, 0],
): OpeningVisibleBounds | null {
  if (spec.type === 'passage' || !(spec.length > 0)
      || ![spec.length, spec.angle, center[0], center[1]].every(Number.isFinite)) return null;
  const { half, jambHalf } = openingVisibleMetrics(spec);
  const visibleScale = gridVisualScale(spec.cellCm);
  const leafHalf = 1.75 * visibleScale;
  const jambStrokeHalf = 1.25 * visibleScale;
  const arcStrokeHalf = 0.75 * visibleScale;
  const jamb: LocalBounds = {
    minX: -half - jambStrokeHalf,
    minY: -jambHalf - jambStrokeHalf,
    maxX: half + jambStrokeHalf,
    maxY: jambHalf + jambStrokeHalf,
  };
  const body: LocalBounds = {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
  };
  if (spec.type === 'window') {
    addSweptRect(body, -half, 0, half, -leafHalf, leafHalf, -90, 0);
    addSweptRect(body, half, -half, 0, -leafHalf, leafHalf, 0, 90);
    addPoint(body, -half - arcStrokeHalf, -half - arcStrokeHalf);
    addPoint(body, half + arcStrokeHalf, arcStrokeHalf);
  } else if (spec.type === 'gate') {
    const turn = spec.face.side * 10;
    addSweptRect(body, -half, 0, half, -leafHalf, leafHalf, 0, turn);
    addSweptRect(body, half, -half, 0, -leafHalf, leafHalf, -turn, 0);
  } else {
    addSweptRect(body, -half, 0, spec.length, -leafHalf, leafHalf, -90, 0);
    addPoint(body, -half - arcStrokeHalf, -spec.length - arcStrokeHalf);
    addPoint(body, half + arcStrokeHalf, arcStrokeHalf);
  }
  const [tx, ty] = bodyTranslation(spec);
  const combined: LocalBounds = { ...jamb };
  addPoint(combined, body.minX + tx, body.minY + ty);
  addPoint(combined, body.maxX + tx, body.maxY + ty);

  const sx = spec.flipH ? -1 : 1;
  // Gate vertical direction is carried by face.side, matching the renderer.
  const sy = spec.type === 'gate' ? 1 : (spec.flipV ? -1 : 1);
  const angle = spec.angle * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const world: OpeningVisibleBounds = {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
  };
  for (const x of [combined.minX, combined.maxX]) {
    for (const y of [combined.minY, combined.maxY]) {
      const rx = x * sx, ry = y * sy;
      addPoint(world, center[0] + rx * c - ry * s, center[1] + rx * s + ry * c);
    }
  }
  return world;
}

/** Visible architectural paths shared by committed openings and placement
 * preview. Interaction hitboxes, live bindings and data identity stay with the
 * caller so a preview can never behave like a saved object. */
export function renderOpeningVisibleGeometry(spec: OpeningVisibleSpec): TemplateResult {
  // An open passage is physical negative space. Selection/hover metrics stay
  // with the caller, but the architectural layer must contain no jamb, leaf,
  // arc, gate panel or standalone frame.
  if (spec.type === 'passage') return svg``;
  const amount = Math.max(0, Math.min(1, spec.amount));
  const { half, jambHalf } = openingVisibleMetrics(spec);
  const visualScale = gridVisualScale(spec.cellCm);
  const leafHalf = 1.75 * visualScale;
  const sx = spec.flipH ? -1 : 1;
  const sy = spec.flipV ? -1 : 1;
  // A gate is already symmetric around the wall axis. Its vertical flip is a
  // direction command, not a mirror transform: face.side carries the resolved
  // turn side and must remain observable instead of being cancelled by a
  // second scaleY(-1).
  const renderSy = spec.type === 'gate' ? 1 : sy;

  // Every symbol sits on the wall centreline. flip_v changes only leaf/swing
  // direction; gates use face.side for their 10 degree turn (#250).
  const [swingTx, swingTy] = bodyTranslation(spec);

  let body: TemplateResult;
  if (spec.type === 'window') {
    const arcLen = (Math.PI / 2) * half;
    const glass = spec.face.cm > 0
      ? svg`<line class="op-glass" x1="0" y1="${-jambHalf}" x2="0" y2="${jambHalf}"
          stroke="${spec.tone}" stroke-width="${1.5 * visualScale}"></line>`
      : svg``;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <path class="op-arc" d="M 0 0 A ${half} ${half} 0 0 0 ${-half} ${-half}" fill="none"
        stroke="${spec.tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amount)}"></path>
      <path class="op-arc" d="M 0 0 A ${half} ${half} 0 0 1 ${half} ${-half}" fill="none"
        stroke="${spec.tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amount)}"></path>
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${-90 * amount}deg)">
          <rect x="0" y="${-1.5 * visualScale}" width="${half}" height="${3 * visualScale}" fill="${spec.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${half} 0)">
        <g class="op-leaf" style="transform:rotate(${90 * amount}deg)">
          <rect x="${-half}" y="${-1.5 * visualScale}" width="${half}" height="${3 * visualScale}" fill="${spec.tone}"></rect>
        </g>
      </g>
      ${glass}
      </g>`;
  } else if (spec.type === 'gate') {
    // Gate leaves open only 10° towards the resolved face. Gate flip_v changes
    // face.side at the resolver; there is deliberately no second inversion
    // here, so shared and partition hosts expose opposite turn signs too.
    const gateAngle = spec.face.side * 10 * amount;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${gateAngle}deg)">
          <rect x="0" y="${-leafHalf}" width="${half}" height="${leafHalf * 2}" fill="${spec.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${half} 0)">
        <g class="op-leaf" style="transform:rotate(${-gateAngle}deg)">
          <rect x="${-half}" y="${-leafHalf}" width="${half}" height="${leafHalf * 2}" fill="${spec.tone}"></rect>
        </g>
      </g>
      </g>`;
  } else {
    const arcLen = (Math.PI / 2) * spec.length;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <path class="op-arc" d="M ${half} 0 A ${spec.length} ${spec.length} 0 0 0 ${-half} ${-spec.length}" fill="none"
        stroke="${spec.tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amount)}"></path>
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${-90 * amount}deg)">
          <rect x="0" y="${-leafHalf}" width="${spec.length}" height="${leafHalf * 2}" fill="${spec.tone}"></rect>
        </g>
      </g>
      </g>`;
  }

  return svg`<g transform="scale(${sx} ${renderSy})">
    <line x1="${-half}" y1="${-jambHalf}" x2="${-half}" y2="${jambHalf}"
      stroke="${spec.base}" stroke-width="${2.5 * visualScale}"></line>
    <line x1="${half}" y1="${-jambHalf}" x2="${half}" y2="${jambHalf}"
      stroke="${spec.base}" stroke-width="${2.5 * visualScale}"></line>
    ${body}
  </g>`;
}
