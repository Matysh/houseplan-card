/**
 * Stage 4 isometric scene orchestration and inert SVG rendering.
 *
 * The card remains the owner of live HA state and editor interaction. This
 * module owns the presentation-only structural cache, overlay projection and
 * SVG volume layers so the main Lit shell does not also become a renderer.
 */
// #649 п.2: the 2.5D light lives in this lazy graph; Flat never loads it.
export { computeIsoSunBeams, renderIsoSunWash } from './iso-sun';
import { nothing, svg, type TemplateResult } from 'lit';
import { difference, union, type Geom } from 'polyclip-ts';
import { ISO_LAB_FLOOR_MARKERS, ISO_LAB_OPENINGS } from './iso-lab-camera';
import { clipIsoOpeningDepthQueue, deviceWallOcclusion, furnitureOcclusion } from './iso-lab-visibility';
import { isoWallLightPainter, type IsoWallLightSource } from './iso-wall-light';
export { isoFurnitureLightSampler } from './iso-wall-light';
import type { ResolvedOpeningVisual } from './opening-features';
import type { SpaceDisplay } from './logic';
import { isoDisplayWallHeight, projectPlanPoint, type PlanPoint } from './iso-projection';
import type { IsoFloorGeometry, IsoWallGeometry } from './iso-walls';
import type { IsoDecorationLayers, IsoOpeningPanel } from './iso-openings';
import { gridVisualScale, gridVisualUnits } from './grid-scale';
import type { RenderOpening } from './interaction-types';

export * from './iso-scene-geometry';
import { buildIsoWallDepthQueue, resolveIsoDecorationLayers, resolveIsoOpeningPanels,
  type IsoOverlayRenderScene, type IsoRenderScene, type IsoOpeningRenderSurface } from './iso-scene-geometry';
export const ISO_SCENE_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

const wallCutPaint = new WeakMap<object, string>();
/** Wall and lintel caps are one cut plane. Outline only their outer boundary;
 * the joints above a doorway are construction seams, not visible edges. */
function continuousWallCut(scene:IsoRenderScene,queue:ReturnType<typeof buildIsoWallDepthQueue>):string {
  const cached=wallCutPaint.get(queue);if(cached!==undefined)return cached;
  const parts:Geom[]=[];
  const ring=(points:readonly (readonly number[])[]):[number,number][]=>{
    const out=points.map(p=>[Number(p[0].toFixed(6)),Number(p[1].toFixed(6))] as [number,number]);
    if(out.length)out.push(out[0]);return out;
  };
  for(const entry of queue){
    if(entry.layer==='wall-top'&&entry.face.projectedRings)parts.push(entry.face.projectedRings.map(ring));
    else if(entry.layer==='opening'&&entry.surface.kind==='opening-lintel-top'&&entry.surface.points&&scene.camera)
      parts.push([ring(entry.surface.points.map(p=>projectPlanPoint(p.point,p.z,scene.camera)))]);
  }
  const merged=parts.length ? union(parts[0],...parts.slice(1)) : [];
  const result=merged.flatMap(poly=>poly.map(ring=>`M ${ring.map(p=>p.join(' ')).join(' L ')} Z`)).join(' ');
  wallCutPaint.set(queue,result);return result;
}

const shadowClips = new WeakMap<object, string | null>();

function shadowVisibility(scene: IsoRenderScene, queue: ReturnType<typeof buildIsoWallDepthQueue>): string | null {
  if (!scene.camera || !scene.frame) return null;
  const existing = shadowClips.get(queue);
  if (existing !== undefined) return existing;
  const camera = scene.camera;
  const ring = (points: readonly (readonly number[])[]): [number, number][] =>
    points.map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))]);
  const silhouettes: Geom[] = [];
  for (const entry of queue) {
    if (entry.layer === 'wall-top' && entry.face.projectedRings) {
      silhouettes.push(entry.face.projectedRings.map(ring));
    } else if (entry.layer === 'wall-side' && entry.face.points?.length > 2) {
      silhouettes.push([ring(entry.face.points)]);
    } else if (entry.layer === 'opening' && entry.surface.points && entry.surface.points.length > 2) {
      silhouettes.push([ring(entry.surface.points.map(({point,z}) => projectPlanPoint(point,z,camera)))]);
    }
  }
  const {x,y,w,h} = scene.frame;
  const bounds: Geom = [[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]];
  // One opaque clip shared by all floor shadows. Boundaries and holes are
  // computed in projected coordinates, outside the live camera path.
  try {
    const visible = difference(bounds, ...silhouettes);
    const clip = visible.flatMap(poly => poly.map(points => `M ${points.map(p => p.join(' ')).join(' L ')} Z`)).join(' ');
    shadowClips.set(queue, clip);
    return clip;
  } catch {
    shadowClips.set(queue, null);
    return null;
  }
}

export interface IsoFramePresentation {
  layers: IsoDecorationLayers;
  panels: readonly IsoOpeningPanel[];
  overlays: IsoOverlayRenderScene | null;
  underlay: TemplateResult;
  shadows: TemplateResult;
  walls: TemplateResult;
  foreground: TemplateResult | typeof nothing;
  shadowClip: string | null;
}

export interface IsoFurniturePaint {
  footprint: readonly PlanPoint[];
  height: number;
  body: TemplateResult;
}

/** Resolve every lazy Stage 4 artifact inside the card's single failure boundary. */
export function resolveIsoFramePresentation(input: {
  projection: 'flat' | 'iso';
  display: SpaceDisplay;
  scene: IsoRenderScene | null;
  openings: readonly RenderOpening[];
  amountOf: (opening: RenderOpening) => number;
  visualOf?: (opening: RenderOpening) => ResolvedOpeningVisual;
  overlays: (layers: IsoDecorationLayers) => IsoOverlayRenderScene | null;
  cellCm: number;
  furniture?: readonly IsoFurniturePaint[];
  wallLights?: readonly IsoWallLightSource[];
}): IsoFramePresentation {
  const layers = resolveIsoDecorationLayers(input.display);
  const panels = layers.panels
    ? resolveIsoOpeningPanels(layers, input.scene, input.openings, input.amountOf, input.visualOf)
    : [];
  const overlays = input.overlays(layers);
  const smoothMaterials = ISO_LAB_FLOOR_MARKERS && !!input.scene?.camera;
  const render = (renderLayers: IsoDecorationLayers): IsoFramePresentation => {
    const structure = renderIsoStructure(input.projection, renderLayers, input.scene, panels, input.cellCm, input.furniture, overlays, input.wallLights);
    const indicators = renderLayers.panels ? renderIsoOpeningIndicators(input.scene, input.openings, input.visualOf, input.cellCm, input.display.color) : nothing;
    return {
      layers: renderLayers, panels, overlays,
      underlay: renderIsoUnderlay(renderLayers, input.scene?.floor, input.cellCm, smoothMaterials),
      shadows: renderIsoShadows(renderLayers, panels, input.scene?.geometry, input.cellCm),
      walls: svg`${structure.walls}${structure.foreground === nothing ? indicators : nothing}`,
      foreground: structure.foreground === nothing ? nothing : svg`${structure.foreground}${indicators}`,
      shadowClip: structure.shadowClip,
    };
  };
  try { return render(layers); } catch (error) {
    // A material/shadow presentation failure loses only decorative nuance.
    // Structural projection errors above (panels/overlays), or failures that
    // persist on the solid retry, still escape to the fingerprint latch.
    if (!layers.shadows && !layers.materialNuance) throw error;
    return render({ ...layers, shadows: false, materialNuance: false });
  };
}

const emptySvg = (): TemplateResult => svg`` as unknown as TemplateResult;

function renderIsoOpeningIndicators(scene: IsoRenderScene | null, openings: readonly RenderOpening[],
  visualOf: ((opening: RenderOpening) => ResolvedOpeningVisual) | undefined, cellCm: number, color: string): TemplateResult {
  if (!scene || !visualOf) return emptySvg();
  const scale = gridVisualScale(cellCm);
  return svg`<g class="iso-opening-indicators" pointer-events="none" aria-hidden="true">${scene.openings.flatMap(basis => {
    const opening = openings[basis.sourceIndex], visual = opening && visualOf(opening);
    if (!visual?.leaves?.some(leaf => leaf.unknown) || basis.type !== 'window') return [];
    const leaves = visual.leaves;
    const side = visual.side === 'negative' ? -1 : 1;
    const sill = basis.windowProfile?.frameBottom ?? 0;
    const start = projectPlanPoint(basis.axis.start, sill, scene.camera);
    const end = projectPlanPoint(basis.axis.end, sill, scene.camera);
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const span = Math.hypot(dx, dy), bay = span / leaves.length;
    const markerScale = ISO_LAB_OPENINGS ? Math.max(scale * .75, Math.min(scale, bay / 18)) : scale;
    const extra = ISO_LAB_OPENINGS ? Math.max(0, 22 * markerScale - bay) : 0;
    return leaves.map((leaf, index) => {
      const fraction = (index + .5) / leaves.length;
      const center: PlanPoint = [basis.axis.start[0] + (basis.axis.end[0] - basis.axis.start[0]) * fraction,
        basis.axis.start[1] + (basis.axis.end[1] - basis.axis.start[1]) * fraction];
      // Keep per-sash order along the projected opening, even when it is too
      // narrow to fit four legible symbols at their exact plan spacing.
      const shift = span > 0 ? (index - (leaves.length - 1) / 2) * extra / span : 0;
      const point = (sign: number) => {
        const p = projectPlanPoint([
          center[0] + basis.axis.normal[0] * sign * (basis.face.depth / 2 + 12 * scale),
          center[1] + basis.axis.normal[1] * sign * (basis.face.depth / 2 + 12 * scale),
        ], sill, scene.camera);
        const centreX = start[0] + dx * fraction, centreY = start[1] + dy * fraction;
        const across = span ? ((p[1] - centreY) * dx - (p[0] - centreX) * dy) / span : 0;
        const clearance = ISO_LAB_OPENINGS && span ? Math.sign(across)
          * Math.max(0, 11 * markerScale - Math.abs(across)) / span : 0;
        return [p[0] + dx * shift - dy * clearance, p[1] + dy * shift + dx * clearance];
      };
      // Curtains already show light transmission in volume; retain only an
      // unknown sash-position indicator, independently of the shade state.
      const unknown = point(side);
      return svg`${leaf.unknown ? svg`<text class="op-leaf-unknown" data-opening-id=${basis.id} data-opening-leaf=${leaf.id} x=${unknown[0]} y=${unknown[1]} fill=${color}
          text-anchor="middle" dominant-baseline="central" font-size=${11 * markerScale}>?</text>` : nothing}`;
    });
  })}</g>`;
}

/** Scale-aware visual light vector for the one remaining building ambient shadow. */
export function isoFixedLightTransform(cellCm: number): string {
  return `translate(${gridVisualUnits(4, cellCm)} ${gridVisualUnits(8, cellCm)})`;
}

function renderIsoDefs(
  layers: IsoDecorationLayers,
  root: 'underlay' | 'walls',
  cellCm: number,
): TemplateResult {
  const visualScale = gridVisualScale(cellCm);
  return svg`<defs>
    ${root === 'walls' && layers.materialNuance ? svg`
      <linearGradient id="hp-iso-wall-side" data-hp-iso-material-def x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="iso-side-hi"></stop><stop offset="0.58" class="iso-side-mid"></stop><stop offset="1" class="iso-side-lo"></stop>
      </linearGradient>
      <linearGradient id="hp-iso-wall-top" data-hp-iso-material-def x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" class="iso-top-hi"></stop><stop offset="1" class="iso-top-lo"></stop>
      </linearGradient>
      <pattern id="hp-iso-wall-texture" data-hp-iso-material-def patternUnits="userSpaceOnUse"
        width="${12 * visualScale}" height="${12 * visualScale}">
        <circle class="iso-texture-mark" cx="${2 * visualScale}" cy="${2 * visualScale}"
          r="${0.55 * visualScale}"></circle>
        <path class="iso-texture-line" d="M ${5 * visualScale} ${10 * visualScale}
          l ${5 * visualScale} ${-5 * visualScale}"></path>
      </pattern>` : nothing}
    ${root === 'underlay' && layers.materialNuance ? svg`
      <pattern id="hp-iso-floor-texture" data-hp-iso-material-def patternUnits="userSpaceOnUse"
        width="${14 * visualScale}" height="${14 * visualScale}">
        <circle class="iso-texture-mark" cx="${3 * visualScale}" cy="${3 * visualScale}"
          r="${0.5 * visualScale}"></circle>
      </pattern>` : nothing}
    ${root === 'underlay' && layers.shadows ? svg`
      <filter id="hp-iso-ambient-shadow" data-hp-iso-material-def x="-12%" y="-12%" width="124%" height="130%">
        <feGaussianBlur stdDeviation="${7 * visualScale}"></feGaussianBlur>
      </filter>` : nothing}
  </defs>` as unknown as TemplateResult;
}

export function renderIsoUnderlay(
  layers: IsoDecorationLayers,
  floor: IsoFloorGeometry | undefined,
  cellCm: number,
  smoothMaterials = false,
): TemplateResult {
  if (!layers.structural || !floor) return emptySvg();
  return svg`<g class="iso-underlay" data-hp="iso-underlay" aria-hidden="true" pointer-events="none">
    ${renderIsoDefs(layers, 'underlay', cellCm)}
    ${layers.shadows && floor.footprintPath
      ? svg`<path class="iso-ambient-shadow" d=${floor.footprintPath}
          transform=${isoFixedLightTransform(cellCm)}></path>`
      : nothing}
    <g class="iso-floor-edge">${floor.sides.map((face) =>
      svg`<path class="iso-floor-side" d=${face.d} data-component=${face.component}
        data-edge=${face.edge}></path>${layers.materialNuance && !smoothMaterials
        ? svg`<path class="iso-material-texture iso-floor-texture" d=${face.d}></path>`
        : nothing}`)}</g>
  </g>` as unknown as TemplateResult;
}

export function renderIsoShadows(
  _layers: IsoDecorationLayers,
  _panels: readonly IsoOpeningPanel[],
  _geometry: IsoWallGeometry | undefined,
  _cellCm: number,
): TemplateResult {
  return emptySvg();
}

export function renderIsoWalls(
  projection: 'flat' | 'iso', layers: IsoDecorationLayers, scene: IsoRenderScene | null,
  panels: readonly IsoOpeningPanel[], cellCm: number,
): TemplateResult {
  return renderIsoStructure(projection, layers, scene, panels, cellCm).walls;
}

function renderIsoStructure(
  projection: 'flat' | 'iso',
  layers: IsoDecorationLayers,
  scene: IsoRenderScene | null,
  panels: readonly IsoOpeningPanel[],
  cellCm: number,
  furniture: readonly IsoFurniturePaint[] = [],
  overlays: IsoOverlayRenderScene | null = null,
  wallLights: readonly IsoWallLightSource[] = [],
): Pick<IsoFramePresentation,'walls'|'foreground'|'shadowClip'> {
  if (projection !== 'iso' || !layers.structural || !scene) return {walls:emptySvg(), foreground:nothing, shadowClip:null};
  const openingSurfaces: IsoOpeningRenderSurface[] = layers.panels ? [
    ...scene.openingSurfaces,
    ...panels.flatMap((panel) => panel.surfaces.map((surface) => ({
      ...surface,
      id: panel.id,
      sourceIndex: panel.sourceIndex,
      type: panel.type,
      leaf: panel.leaf,
    }))),
  ] : scene.openingSurfaces.filter(surface => surface.material === 'wall-side' || surface.material === 'wall-top');
  const ordered = buildIsoWallDepthQueue(scene.geometry, openingSurfaces,
    (scene.camera?.floorScaleY ?? 1) !== 1);
  const depthQueue = ISO_LAB_OPENINGS && scene.camera
    ? clipIsoOpeningDepthQueue(ordered,scene.camera,gridVisualScale(cellCm)) : ordered;
  const wallCut = ISO_LAB_OPENINGS ? continuousWallCut(scene,depthQueue) : '';
  if (scene.camera && overlays) for (const placement of overlays.devices.values()) {
    placement.wallMask = deviceWallOcclusion(depthQueue,scene.camera,placement,gridVisualUnits(isoDisplayWallHeight(),cellCm));
  }
  // Fill adjoining visible masonry faces together. Separately antialiased
  // edges otherwise leave a light hairline where a window apron meets its wall.
  const masonrySides = ISO_LAB_OPENINGS ? depthQueue.flatMap(entry => {
    if (entry.layer === 'wall-side' && entry.face.roundColumn === undefined) return [entry.face.d];
    if (entry.layer === 'opening' && entry.surface.material === 'wall-side') return [entry.surface.d];
    return [];
  }).join(' ') : '';
  // Keep individual planes for visibility. Paint adjacent visible facets as a
  // single SVG fill so antialiasing cannot expose the floor between them.
  const columnPaint = new Map<number, string[]>();
  const columnRuns = new Map<number, string[]>();
  const columnBounds = new Map<number, { left: number; right: number }>();
  for (const face of scene.geometry.sides) {
    if (face.roundColumn === undefined) continue;
    const bounds = columnBounds.get(face.roundColumn) ?? {left: Infinity, right: -Infinity};
    for (const [x] of face.points) {
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
    }
    columnBounds.set(face.roundColumn, bounds);
  }
  let previous: number | undefined;
  depthQueue.forEach((entry, index) => {
    const column = entry.layer === 'wall-side' ? entry.face.roundColumn : undefined;
    if (entry.layer === 'wall-side' && column !== undefined) {
      // The legacy painter can interleave an object between two facets. Only
      // the depth-clipped pass may coalesce across other objects in the queue.
      let run = columnPaint.get(column);
      if (!run || (!ISO_LAB_OPENINGS && previous !== column)) {
        run = [];
        columnPaint.set(column, run);
        columnRuns.set(index, run);
      }
      run.push(entry.face.d);
    }
    previous = column;
  });
  const visibility = scene.camera ? furniture.map(item=>furnitureOcclusion(depthQueue,scene.camera!,item.footprint,item.height)) : [];
  const glassSlots = new Map<number,number>();
  visibility.forEach((item,slot)=>item.frontGlass.forEach(index=>glassSlots.set(index,slot)));
  const entries = depthQueue.map((entry,index)=>({entry,index}));
  const masonry = ({entry}:typeof entries[number]) => entry.layer !== 'opening'
    || entry.surface.material === 'wall-side' || entry.surface.material === 'wall-top';
  const masonrySide = ({entry}:typeof entries[number]) => entry.layer === 'wall-side'
    || (entry.layer === 'opening' && entry.surface.material === 'wall-side');
  const paintWallLight = scene.camera ? isoWallLightPainter(wallLights, scene.camera, cellCm, scene.geometry) : () => nothing;
  // The raised-marker presentation has smooth surfaces. Avoid mounting the
  // duplicate path strings that its CSS previously hid during every paint.
  const textures = layers.materialNuance && !(ISO_LAB_FLOOR_MARKERS && scene.camera);
  const paintEntry = ({entry,index}:typeof entries[number]) => {
        if (entry.layer === 'wall-side') {
          const face = entry.face;
          if (face.roundColumn !== undefined) {
            const paths = columnRuns.get(index);
            return svg`${paths ? svg`<path data-hp-round-column=${face.roundColumn} d=${paths.join(' ')}
              fill=${layers.materialNuance ? 'url(#hp-iso-column-'+face.roundColumn+')' : 'var(--iso-side-mid, #adadad)'}></path>` : nothing}${paintWallLight(entry,index)}`;
          }
          return svg`<path class="iso-wall-side" d=${face.d} fill-rule="evenodd" data-edge=${face.edge}></path>${textures
            ? svg`<path class="iso-material-texture iso-wall-texture" d=${face.d}></path>`
            : nothing}${paintWallLight(entry,index)}`;
        }
        if (entry.layer === 'wall-top') {
          if(wallCut)return nothing;
          const face = entry.face;
          return svg`<path class="iso-wall-top" d=${face.d} data-component=${face.component}
            fill-rule="evenodd"></path>${textures
            ? svg`<path class="iso-material-texture iso-wall-texture" d=${face.d}
                fill-rule="evenodd"></path>`
            : nothing}`;
        }
        const surface = entry.surface;
        if(wallCut&&surface.kind==='opening-lintel-top')return nothing;
        if (surface.material === 'wall-side' || surface.material === 'wall-top') {
          return svg`<path class="iso-${surface.material}" d=${surface.d} fill-rule="evenodd"
            data-id=${surface.id} data-kind=${surface.type} data-surface=${surface.kind}></path>${paintWallLight(entry,index)}`;
        }
        /* css-uses {"owner":"renderIsoWalls","kind":"class","values":["iso-door","iso-window"],"reason":"Opening surfaces have exactly the door/window type union"} */
        return svg`<path class="iso-opening-panel iso-${surface.type} iso-opening-${surface.kind} iso-material-${surface.material}"
          d=${surface.d} fill-rule="evenodd" data-id=${surface.id} data-kind=${surface.type}
          data-surface=${surface.kind} data-leaf=${surface.leaf ?? nothing}></path>${textures
            ? svg`<path class="iso-material-texture iso-wall-texture iso-opening-texture"
                d=${surface.d}></path>`
            : nothing}`;
  };
  const walls = svg`<g class="iso-walls" data-hp="iso-walls" data-fingerprint=${scene.key} ?data-hp-opening-masonry=${ISO_LAB_OPENINGS}>
    ${renderIsoDefs(layers, 'walls', cellCm)}
    <defs>
    ${Array.from(columnBounds, ([id, bounds]) => svg`
      <linearGradient id=${'hp-iso-column-'+id} gradientUnits="userSpaceOnUse"
        x1=${bounds.left} x2=${bounds.right} y1="0" y2="0">
        <stop offset="0" class="iso-side-mid"></stop><stop offset=".28" class="iso-side-hi"></stop>
        <stop offset="1" class="iso-side-lo"></stop>
      </linearGradient>`)}</defs>
    <g class=${layers.panels ? 'iso-wall-depth-queue iso-openings' : 'iso-wall-depth-queue'}
      data-hp=${layers.panels ? 'iso-openings' : nothing}
      aria-hidden="true" pointer-events="none">
      ${/* Composite the masonry once, including its seam underpaint and light.
           Per-face alpha would darken overlaps; opening materials stay independent.
           The depth queue already clips surfaces against nearer opaque geometry. */nothing}
      <g class="iso-wall-side-fill">
        ${masonrySides ? svg`<path class="iso-masonry-underpaint" fill="var(--iso-side-mid, #adadad)"
          d=${masonrySides}></path>` : nothing}
        ${entries.filter(masonrySide).map(paintEntry)}
      </g>
      <g class="iso-wall-fill">
        ${entries.filter(row=>masonry(row)&&!masonrySide(row)).map(paintEntry)}
        ${wallCut ? svg`<path class="iso-wall-top" data-hp="iso-wall-cut" d=${wallCut} fill-rule="evenodd"></path>` : nothing}
      </g>
      <g class="iso-wall-contours">
        ${wallCut ? svg`<path class="iso-wall-top iso-wall-contour" d=${wallCut}></path>` : nothing}
        ${entries.filter(masonry).map(({entry}) => entry.layer === 'wall-top'
          ? wallCut ? nothing : svg`<path class="iso-wall-top iso-wall-contour" d=${entry.face.d}></path>`
          : entry.layer === 'opening' && entry.surface.material === 'wall-top'
            && !(wallCut && entry.surface.kind === 'opening-lintel-top')
            ? svg`<path class="iso-wall-top iso-wall-contour" d=${entry.surface.d}></path>` : nothing)}
      </g>
      ${entries.filter(row=>!masonry(row)&&!glassSlots.has(row.index)).map(paintEntry)}
    </g></g>`;
  const foreground = furniture.length ? svg`<g class="iso-walls" ?data-hp-opening-masonry=${ISO_LAB_OPENINGS}>
      ${furniture.map((item,slot)=>{
        const {clip} = visibility[slot];
        const id = 'hp-furniture-foreground-'+slot;
        return svg`${clip !== null ? svg`<defs><clipPath id=${id}><path d=${clip}></path></clipPath></defs>` : nothing}
          <g clip-path=${clip !== null ? 'url(#'+id+')' : nothing}>${item.body}</g>
          ${entries.filter(({index})=>glassSlots.get(index)===slot).map(paintEntry)}`;
      })}</g>` : nothing;
  return {walls,foreground,shadowClip:shadowVisibility(scene,depthQueue)};
}
