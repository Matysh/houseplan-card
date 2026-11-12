import { svg, type TemplateResult } from 'lit';
import { mdiWeatherSunny, mdiWeatherSunnyOff } from '@mdi/js';
import type { OpeningCfg } from '../types';
import { resolveOpeningVisual, type ResolvedOpeningVisual } from '../opening-features';
import { gridVisualScale, gridVisualUnits } from '../grid-scale';
import { openingSlidePlacement, openingSymbolOffset, type OpeningFaceOffset } from '../opening-symbol-placement';

export type { OpeningFaceOffset } from '../opening-symbol-placement';

export interface OpeningVisibleSpec {
  type: OpeningCfg['type'];
  visual?: ResolvedOpeningVisual;
  /** Proven room occupancy on the negative/positive sides of the aperture. */
  handleSides?: readonly [boolean, boolean];
  selectedLeaf?: string;
  length: number;
  angle: number;
  amount: number;
  flipH: boolean;
  flipV: boolean;
  base: string;
  tone: string;
  /** State paint is confined to a door's arc; other opening types keep tone. */
  sensorActive?: boolean;
  sensorDriven?: boolean;
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

export const openingGuideColor = (base: string, sensorDriven: boolean): string =>
  sensorDriven ? 'var(--hp-accent, var(--primary-color, #03a9f4))' : base;

/** Direct symbol readers use the same implicit two-leaf resolver as the card. */
function resolvedSpec(spec: OpeningVisibleSpec): OpeningVisibleSpec {
  if (spec.type !== 'window' || spec.visual) return spec;
  const visual = resolveOpeningVisual({ id:'symbol', type:'window', x:0, y:0,
    length:spec.length, angle:spec.angle, flip_v:spec.flipV }, () => null, spec.amount);
  return { ...spec, visual: { ...visual, leaves: visual.leaves!.map(leaf =>
    ({ ...leaf, sensorDriven: !!spec.sensorDriven })) } };
}

function openingHandle(spec: OpeningVisibleSpec, x: number, y = 0, localSide = 1): TemplateResult {
  const scale = gridVisualScale(spec.cellCm), half = 1.75 * scale;
  const sides = spec.type === 'door' ? [true, true] : spec.handleSides || [false, false];
  const negative = sides[localSide < 0 ? 1 : 0], positive = sides[localSide < 0 ? 0 : 1];
  if (!negative && !positive) return svg``;
  return svg`<line class="op-handle" x1=${x} x2=${x}
    y1=${y - (negative ? half * 2.2 : 0)} y2=${y + (positive ? half * 2.2 : 0)}
    stroke=${spec.base} stroke-width=${2.1 * scale} stroke-linecap="round" pointer-events="none"></line>`;
}

/** UI-059 plan symbol. All parts consume the same resolved source; no stored live state. */
function renderWindowLeaves(spec: OpeningVisibleSpec): TemplateResult {
  const leaves = spec.visual!.leaves!, count = leaves.length, width = spec.length / count;
  const { half, jambHalf } = openingVisibleMetrics(spec), scale = gridVisualScale(spec.cellCm);
  const side = spec.visual!.side === 'negative' ? 1 : -1;
  const lift = 20 / spec.cellCm * spec.gridPitch, arcLen = Math.PI / 2 * width;
  const shrink = Math.min(3 / spec.cellCm * spec.gridPitch, Math.max(0, (width - 4 * scale) / 2));
  const capInset = Math.min(1.35 * scale, (width - 2 * shrink) * .2), openX = shrink + capInset;
  // Accepted final top sketch: 3cm per side, diagonals ten degrees closer to perpendicular.
  const run = lift * Math.tan(Math.max(Math.PI / 360, Math.atan(width * .10 / lift) - 10 * Math.PI / 180));
  const inset = Math.min(width / 2, openX + run);
  const plane = `M ${inset} 0 L ${openX} ${-lift} L ${width - openX} ${-lift} L ${width - inset} 0 Z`;
  const pieces = leaves.map((leaf, i) => {
    const right = leaf.hinge === 'end', direction = right ? -1 : 1;
    const origin = -half + i * width + (right ? width : 0);
    const transform = `translate(${origin} 0) scale(${direction} ${side})`;
    const amount = Math.max(0, Math.min(1, leaf.amount)), top = leaf.hinge === 'top';
    const color = openingGuideColor(spec.base, leaf.sensorDriven);
    const indicatorX = -half + (i + .5) * width, indicatorY = side * (jambHalf + 12 * scale);
    return {
      plane: top ? svg`<g transform=${transform}><g class="op-leaf" style="transform:scaleY(${amount})">
        <path class="op-top-plane" d=${plane} fill="#42bfff" fill-opacity=".20" stroke="none"></path>
      </g></g>` : svg``,
      guides: svg`<g transform=${transform}>${top ? svg`<g class="op-leaf" style="transform:scaleY(${amount})">
        <path class="op-arc op-top-connector" d="M ${inset} 0 L ${openX} ${-lift}" fill="none" stroke=${color} stroke-width=${1.5 * scale}></path>
        <path class="op-arc op-top-connector" d="M ${width - inset} 0 L ${width - openX} ${-lift}" fill="none" stroke=${color} stroke-width=${1.5 * scale}></path>
      </g>` : svg`<path class="op-arc" d="M ${width} 0 A ${width} ${width} 0 0 0 0 ${-width}" fill="none" stroke=${color}
        stroke-dasharray=${arcLen} stroke-dashoffset=${arcLen * (1 - amount)}></path>`}</g>
        ${i > 0 && spec.face.cm > 0 ? svg`<line class="op-glass" x1=${-half + i * width} y1=${-jambHalf}
          x2=${-half + i * width} y2=${jambHalf} stroke=${spec.base} stroke-width=${1.5 * scale}></line>` : svg``}`,
      baseline: top ? svg`<g transform=${transform}><line class="op-arc op-top-closed-position" x1="0" y1="0"
        x2=${width} y2="0" stroke=${spec.base} stroke-width=${1.5 * scale}></line></g>` : svg``,
      leaf: svg`<g data-opening-leaf=${leaf.id} data-hinge=${leaf.hinge} transform=${transform}>
        <g class="op-leaf" style=${top ? `transform:translateY(${-lift * amount}px)` : `transform:rotate(${-90 * amount}deg)`}>
          <rect rx=${.6 * scale} x=${top ? shrink * amount : 0} y=${-1.5 * scale}
            width=${width - (top ? 2 * shrink * amount : 0)} height=${3 * scale} fill=${spec.base}></rect>
          ${openingHandle(spec, top ? width / 2 : width - Math.min(width * .15, 6 * scale) * 1.5, 0, side)}
        </g></g>`,
      indicator: svg`${leaf.shade ? svg`<g class="op-shade-indicator" data-opening-leaf=${leaf.id}
          transform="translate(${indicatorX} ${indicatorY}) scale(${.55 * scale})" fill=${spec.base} pointer-events="none">
          ${leaf.shade.amount === null
            ? svg`<text text-anchor="middle" dominant-baseline="central" font-size="19">?</text>`
            : svg`<path data-icon=${leaf.shade.amount === 0 ? 'mdi:weather-sunny-off' : 'mdi:weather-sunny'}
                d=${leaf.shade.amount === 0 ? mdiWeatherSunnyOff : mdiWeatherSunny} transform="translate(-12 -12)"></path>`}
        </g>` : svg``}${leaf.unknown ? svg`<text class="op-leaf-unknown" data-opening-leaf=${leaf.id}
          x=${indicatorX} y=${-indicatorY} text-anchor="middle" dominant-baseline="central"
          font-size=${11 * scale} fill=${spec.base} pointer-events="none">?</text>` : svg``}`,
    };
  });
  return svg`<g stroke-linecap="round" stroke-linejoin="round">
    ${spec.selectedLeaf ? leaves.map((leaf, index) => leaf.id === spec.selectedLeaf
      ? svg`<rect x=${-half + index * width} y=${-jambHalf - 4 * scale} width=${width}
          height=${2 * jambHalf + 8 * scale} rx=${2 * scale} fill="var(--hp-accent, var(--primary-color))" fill-opacity=".12" pointer-events="none"></rect>` : svg``) : svg``}
    <g class="op-window-glass" stroke="none" pointer-events="none">
      <rect class="op-window-tint" x=${-half} y=${-jambHalf} width=${spec.length} height=${jambHalf * 2}
        rx=${.6 * scale} fill="#42bfff" fill-opacity=".20"></rect>
      <path class="op-window-glint" d="M ${-half + spec.length * .16} ${-jambHalf} L ${-half + spec.length * .32} ${-jambHalf} L ${-half + spec.length * .50} ${jambHalf} L ${-half + spec.length * .34} ${jambHalf} Z" fill="#ffffff" fill-opacity=".26"></path>
      <path class="op-window-glint" d="M ${-half + spec.length * .57} ${-jambHalf} L ${-half + spec.length * .61} ${-jambHalf} L ${-half + spec.length * .79} ${jambHalf} L ${-half + spec.length * .75} ${jambHalf} Z" fill="#ffffff" fill-opacity=".32"></path>
    </g>
    <line x1=${-half} y1=${-jambHalf} x2=${-half} y2=${jambHalf} stroke=${spec.base} stroke-width=${2.5 * scale}></line>
    <line x1=${half} y1=${-jambHalf} x2=${half} y2=${jambHalf} stroke=${spec.base} stroke-width=${2.5 * scale}></line>
    <g class="op-window-planes">${pieces.map(piece => piece.plane)}</g>
    <g class="op-window-guides">${pieces.map(piece => piece.guides)}</g>
    <g class="op-window-closed-positions">${pieces.map(piece => piece.baseline)}</g>
    <g class="op-window-leaves">${pieces.map(piece => piece.leaf)}</g>
    ${pieces.map(piece => piece.indicator)}
  </g>`;
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
  spec = resolvedSpec(spec);
  if (spec.type === 'passage' || !(spec.length > 0)
      || ![spec.length, spec.angle, center[0], center[1]].every(Number.isFinite)) return null;
  if (spec.visual?.unsupported) return null;
  if (spec.visual?.leaves || spec.visual?.mechanism === 'slide') {
    const { half, jambHalf } = openingVisibleMetrics(spec), scale = gridVisualScale(spec.cellCm);
    const local = { minX: -half - 8 * scale, maxX: half + 8 * scale,
      minY: -jambHalf - 24 * scale, maxY: jambHalf + 24 * scale };
    if (spec.visual.leaves) {
      const width = spec.length / spec.visual.leaves.length;
      const depth = Math.max(...spec.visual.leaves.map(leaf => leaf.hinge === 'top'
        ? 20 / spec.cellCm * spec.gridPitch : width)) + 8 * scale;
      if (spec.visual.side === 'negative') local.minY = Math.min(local.minY, -depth);
      else local.maxY = Math.max(local.maxY, depth);
    } else {
      const rad = spec.angle * Math.PI / 180;
      const faceX = spec.face.ox * Math.cos(rad) + spec.face.oy * Math.sin(rad);
      const faceY = -spec.face.ox * Math.sin(rad) + spec.face.oy * Math.cos(rad);
      const shift = (spec.visual.direction === 'end' ? 1 : -1) * spec.length;
      local.minX = Math.min(local.minX, -half + faceX + Math.min(0, shift) - 8 * scale);
      local.maxX = Math.max(local.maxX, half + faceX + Math.max(0, shift) + 8 * scale);
      local.minY = Math.min(local.minY, faceY - 8 * scale);
      local.maxY = Math.max(local.maxY, faceY + 8 * scale);
    }
    const rad = spec.angle * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const world = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const x of [local.minX, local.maxX]) for (const y of [local.minY, local.maxY]) {
      addPoint(world, center[0] + x * c - y * s, center[1] + x * s + y * c);
    }
    return world;
  }
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
  spec = resolvedSpec(spec);
  // An open passage is physical negative space. Selection/hover metrics stay
  // with the caller, but the architectural layer must contain no jamb, leaf,
  // arc, gate panel or standalone frame.
  if (spec.type === 'passage') return svg``;
  if (spec.visual?.unsupported) return svg``;
  if (spec.type === 'window' && spec.visual?.leaves) return renderWindowLeaves(spec);
  const amount = Math.max(0, Math.min(1, spec.amount));
  const { half, jambHalf } = openingVisibleMetrics(spec);
  const visualScale = gridVisualScale(spec.cellCm);
  const leafHalf = 1.75 * visualScale;
  if (spec.visual?.mechanism === 'slide' && (spec.type === 'door' || spec.type === 'gate')) {
    const { x:tx, y:ty, shift } = openingSlidePlacement(spec.angle, spec.length, spec.visual.direction, amount, spec.face);
    return svg`<g stroke-linecap="round" stroke-linejoin="round">
      <line x1=${-half} y1=${-jambHalf} x2=${-half} y2=${jambHalf} stroke=${spec.base} stroke-width=${2.5 * visualScale}></line>
      <line x1=${half} y1=${-jambHalf} x2=${half} y2=${jambHalf} stroke=${spec.base} stroke-width=${2.5 * visualScale}></line>
      <g transform="translate(${tx} ${ty})"><g class="op-leaf" style="transform:translateX(${shift}px)">
        <rect rx=${.6 * visualScale} x=${-half} y=${-leafHalf} width=${spec.length} height=${leafHalf * 2} fill=${spec.base}></rect>
        ${spec.type === 'door' ? openingHandle(spec,
          spec.visual.direction === 'end' ? -half + Math.min(spec.length * .15, 6 * visualScale) * 1.5
            : half - Math.min(spec.length * .15, 6 * visualScale) * 1.5) : svg``}
      </g></g>
    </g>`;
  }
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
  if (spec.type === 'gate') {
    // Gate leaves open only 10° towards the resolved face. Gate flip_v changes
    // face.side at the resolver; there is deliberately no second inversion
    // here, so shared and partition hosts expose opposite turn signs too.
    const gateAngle = spec.face.side * 10 * amount;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${gateAngle}deg)">
          <rect rx=${.6 * visualScale} x="0" y="${-leafHalf}" width="${half}" height="${leafHalf * 2}" fill="${spec.tone}"></rect>
        </g>
      </g>
      <g transform="translate(${half} 0)">
        <g class="op-leaf" style="transform:rotate(${-gateAngle}deg)">
          <rect rx=${.6 * visualScale} x="${-half}" y="${-leafHalf}" width="${half}" height="${leafHalf * 2}" fill="${spec.tone}"></rect>
        </g>
      </g>
      </g>`;
  } else {
    const arcLen = (Math.PI / 2) * spec.length;
    body = svg`
      <g transform="translate(${swingTx} ${swingTy})">
      <path class="op-arc" d="M ${half} 0 A ${spec.length} ${spec.length} 0 0 0 ${-half} ${-spec.length}" fill="none"
        stroke="${openingGuideColor(spec.base, !!(spec.sensorDriven ?? spec.sensorActive))}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amount)}"></path>
      <g transform="translate(${-half} 0)">
        <g class="op-leaf" style="transform:rotate(${-90 * amount}deg)">
          <rect rx=${.6 * visualScale} x="0" y="${-leafHalf}" width="${spec.length}" height="${leafHalf * 2}" fill="${spec.base}"></rect>
          ${openingHandle(spec, spec.length - Math.min(spec.length * .15, 6 * visualScale) * 1.5, 0, sy)}
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
