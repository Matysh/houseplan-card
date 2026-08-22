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
  const visualOffset = openingSymbolOffset(
    spec.type, spec.flipV, spec.angle, spec.face,
  );
  let swingTx = 0, swingTy = 0;
  if (visualOffset.ox || visualOffset.oy) {
    const rad = (-spec.angle * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    swingTx = visualOffset.ox * c - visualOffset.oy * s;
    swingTy = visualOffset.ox * s + visualOffset.oy * c;
    swingTx *= sx;
    swingTy *= sy;
  }

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
