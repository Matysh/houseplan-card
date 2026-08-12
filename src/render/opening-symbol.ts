import { svg, type TemplateResult } from 'lit';
import type { OpeningCfg } from '../types';

export interface OpeningFaceOffset {
  ox: number;
  oy: number;
  cm: number;
  side: -1 | 1;
}

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
    : 4;
  const gateDepth = spec.type === 'gate' ? Math.sin((10 * Math.PI) / 180) * half : 0;
  return {
    half,
    jambHalf,
    gateDepth,
    outlineHalf: Math.max(16, jambHalf + 8, gateDepth + 8),
    hitHalf: Math.max(20, jambHalf + 10, gateDepth + 12),
  };
}

/** Visible architectural paths shared by committed openings and placement
 * preview. Interaction hitboxes, live bindings and data identity stay with the
 * caller so a preview can never behave like a saved object. */
export function renderOpeningVisibleGeometry(spec: OpeningVisibleSpec): TemplateResult {
  const amount = Math.max(0, Math.min(1, spec.amount));
  const { half, jambHalf } = openingVisibleMetrics(spec);
  const sx = spec.flipH ? -1 : 1;
  const sy = spec.flipV ? -1 : 1;

  // Shift swing geometry to its selected wall face. The outer scale applies
  // the user flips, so undo those signs here and let SVG re-apply them once.
  let swingTx = 0, swingTy = 0;
  if (spec.face.cm > 0 && (spec.face.ox || spec.face.oy)) {
    const rad = (-spec.angle * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    swingTx = spec.face.ox * c - spec.face.oy * s;
    swingTy = spec.face.ox * s + spec.face.oy * c;
    swingTx *= sx;
    swingTy *= sy;
  }

  let body: TemplateResult;
  if (spec.type === 'window') {
    const arcLen = (Math.PI / 2) * half;
    const glass = spec.face.cm > 0
      ? svg`<line class="op-glass" x1="0" y1="${-jambHalf}" x2="0" y2="${jambHalf}"
          stroke="${spec.tone}" stroke-width="1.5"></line>`
      : svg``;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <path class="op-arc" d="M 0 0 A ${half} ${half} 0 0 0 ${-half} ${-half}" fill="none"
        stroke="${spec.tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amount)}"></path>
      <path class="op-arc" d="M 0 0 A ${half} ${half} 0 0 1 ${half} ${-half}" fill="none"
        stroke="${spec.tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amount)}"></path>
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${-90 * amount}deg)">
          <rect x="0" y="-1.5" width="${half}" height="3" fill="${spec.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${half} 0)">
        <g class="op-leaf" style="transform:rotate(${90 * amount}deg)">
          <rect x="${-half}" y="-1.5" width="${half}" height="3" fill="${spec.tone}"></rect>
        </g>
      </g>
      ${glass}
      </g>`;
  } else if (spec.type === 'gate') {
    // Gate leaves open only 10° towards the resolved exterior face. Conjugating
    // their rotation through scaleY(-1) reverses the sign.
    const gateAngle = spec.face.side * sy * 10 * amount;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${gateAngle}deg)">
          <rect x="0" y="-1.75" width="${half}" height="3.5" fill="${spec.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${half} 0)">
        <g class="op-leaf" style="transform:rotate(${-gateAngle}deg)">
          <rect x="${-half}" y="-1.75" width="${half}" height="3.5" fill="${spec.tone}"></rect>
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
          <rect x="0" y="-1.75" width="${spec.length}" height="3.5" fill="${spec.tone}"></rect>
        </g>
      </g>
      </g>`;
  }

  return svg`<g transform="scale(${sx} ${sy})">
    <line x1="${-half}" y1="${-jambHalf}" x2="${-half}" y2="${jambHalf}"
      stroke="${spec.base}" stroke-width="2.5"></line>
    <line x1="${half}" y1="${-jambHalf}" x2="${half}" y2="${jambHalf}"
      stroke="${spec.base}" stroke-width="2.5"></line>
    ${body}
  </g>`;
}
