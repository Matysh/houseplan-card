/**
 * Stage 4 isometric scene orchestration and inert SVG rendering.
 *
 * The card remains the owner of live HA state and editor interaction. This
 * module owns the presentation-only structural cache, overlay projection and
 * SVG volume layers so the main Lit shell does not also become a renderer.
 */
import { ISO_ICON_SCALE } from './iso-tiles';
// #649 п.2: the 2.5D light lives in this lazy graph; Flat never loads it.
export { computeIsoSunBeams, renderIsoSunWash } from './iso-sun';
import { nothing, svg, type TemplateResult } from 'lit';
import { mdiWeatherSunny, mdiWeatherSunnyOff } from '@mdi/js';
import type { ResolvedOpeningVisual } from './opening-features';
import { clampScale, fitView, islandsOf, roomPoly, type SpaceDisplay } from './logic';
import {
  ISO_CAMERA, ISO_FLOOR_EDGE_HEIGHT,
  ISO_RAISED_OVERLAY_HEIGHT, ISO_WALL_HEIGHT,
  projectedFrame, isoCameraFor, projectPlanPoint, type PlanPoint, type ScenePoint, type IsoCamera,
} from './iso-projection';
import { planRotation, type PlanRotation } from './view-frame';
import {
  buildIsoFloorGeometry, buildIsoWallGeometry, isoGeometryFingerprint,
  type IsoFloorGeometry, type IsoWallFace, type IsoWallGeometry, type IsoWallTopFace,
} from './iso-walls';
import {
  ISO_OPENING_GEOMETRY_POLICY, buildIsoOpeningBasis, isoOpeningBounds, projectIsoOpening,
  projectIsoOpeningStructure, resolveIsoDecoration,
  type IsoDecorationLayers, type IsoOpeningBasis, type IsoOpeningPanel,
  type IsoOpeningGeometryPolicy, type IsoOpeningSurface,
} from './iso-openings';
import {
  resolveIsoOverlayOwner, resolveIsoOverlayPlacement,
  type IsoOverlayPlacement, type IsoOverlayRoom, type IsoRaisedOverlayKind,
} from './iso-overlays';
import {
  floorFootprintGeometry, openingInnerFaceOffsetFromIndex,
  openingWallIndex as buildOpeningWallIndex, resolveOpeningWallAssociation,
  wallBodiesGeometry,
  type OpeningWallIndex, type WallEntry,
} from './wall-thickness';
import { partitionOpeningFace } from './partition-openings';
import { openingLockFloorPlacement } from './opening-symbol-placement';
import { physicalBodyParts, type PartitionOpeningCut } from './physical-geometry';
import { gridVisualScale, gridVisualUnits } from './grid-scale';
import { iconUnit, type Rect } from './space-geometry';
import { lruRead, lruWrite } from './card-runtime';
import type { ResolvedDevicePresentation } from './device-presentation';
import { deviceTextScale, legacySupplementalMetrics } from './device-face';
import type { RenderOpening } from './interaction-types';
import type { DevItem, RoomCfg, SpaceModel, OpeningFeatures } from './types';

export * from './iso-scene-geometry';
import { buildIsoWallDepthQueue, resolveIsoDecorationLayers, resolveIsoOpeningPanels,
  type IsoOverlayRenderScene, type IsoRenderScene, type IsoOpeningRenderSurface } from './iso-scene-geometry';
export const ISO_SCENE_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export interface IsoFramePresentation {
  layers: IsoDecorationLayers;
  panels: readonly IsoOpeningPanel[];
  overlays: IsoOverlayRenderScene | null;
  underlay: TemplateResult;
  shadows: TemplateResult;
  walls: TemplateResult;
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
}): IsoFramePresentation {
  const layers = resolveIsoDecorationLayers(input.display);
  const panels = layers.panels
    ? resolveIsoOpeningPanels(layers, input.scene, input.openings, input.amountOf, input.visualOf)
    : [];
  const overlays = input.overlays(layers);
  const render = (renderLayers: IsoDecorationLayers): IsoFramePresentation => ({
    layers: renderLayers, panels, overlays,
    underlay: renderIsoUnderlay(renderLayers, input.scene?.floor, input.cellCm),
    shadows: renderIsoShadows(renderLayers, panels, input.scene?.geometry, input.cellCm),
    walls: svg`${renderIsoWalls(input.projection, renderLayers, input.scene, panels, input.cellCm)}
      ${renderLayers.panels ? renderIsoOpeningIndicators(input.scene, input.openings, input.visualOf, input.cellCm, input.display.color) : nothing}`,
  });
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
    if (!visual?.leaves || basis.type !== 'window') return [];
    const side = visual.side === 'negative' ? -1 : 1;
    return visual.leaves.map((leaf, index) => {
      const fraction = (index + .5) / visual.leaves!.length;
      const center: PlanPoint = [basis.axis.start[0] + (basis.axis.end[0] - basis.axis.start[0]) * fraction,
        basis.axis.start[1] + (basis.axis.end[1] - basis.axis.start[1]) * fraction];
      const point = (sign: number) => projectPlanPoint([
        center[0] + basis.axis.normal[0] * sign * (basis.face.depth / 2 + 12 * scale),
        center[1] + basis.axis.normal[1] * sign * (basis.face.depth / 2 + 12 * scale),
      ], basis.windowProfile?.frameBottom ?? 0, scene.camera);
      const shade = point(-side), unknown = point(side);
      return svg`${leaf.shade ? svg`<g class="op-shade-indicator" transform="translate(${shade[0]} ${shade[1]}) scale(${.55 * scale})" fill=${color}>
        ${leaf.shade.amount === null ? svg`<text text-anchor="middle" dominant-baseline="central" font-size="19">?</text>`
          : svg`<path d=${leaf.shade.amount === 0 ? mdiWeatherSunnyOff : mdiWeatherSunny} transform="translate(-12 -12)"></path>`}
        </g>` : nothing}${leaf.unknown ? svg`<text class="op-leaf-unknown" x=${unknown[0]} y=${unknown[1]} fill=${color}
          text-anchor="middle" dominant-baseline="central" font-size=${11 * scale}>?</text>` : nothing}`;
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
        data-edge=${face.edge}></path>${layers.materialNuance
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
  projection: 'flat' | 'iso',
  layers: IsoDecorationLayers,
  scene: IsoRenderScene | null,
  panels: readonly IsoOpeningPanel[],
  cellCm: number,
): TemplateResult {
  if (projection !== 'iso' || !layers.structural || !scene) return emptySvg();
  const openingSurfaces: IsoOpeningRenderSurface[] = layers.panels ? [
    ...scene.openingSurfaces,
    ...panels.flatMap((panel) => panel.surfaces.map((surface) => ({
      ...surface,
      id: panel.id,
      sourceIndex: panel.sourceIndex,
      type: panel.type,
      leaf: panel.leaf,
    }))),
  ] : [];
  const depthQueue = buildIsoWallDepthQueue(scene.geometry, openingSurfaces);
  return svg`<g class="iso-walls" data-hp="iso-walls" data-fingerprint=${scene.key}>
    ${renderIsoDefs(layers, 'walls', cellCm)}
    <g class=${layers.panels ? 'iso-wall-depth-queue iso-openings' : 'iso-wall-depth-queue'}
      data-hp=${layers.panels ? 'iso-openings' : nothing}
      aria-hidden="true" pointer-events="none">${depthQueue.map((entry) => {
        if (entry.layer === 'wall-side') {
          const face = entry.face;
          return svg`<path class="iso-wall-side" d=${face.d} data-edge=${face.edge}></path>${layers.materialNuance
            ? svg`<path class="iso-material-texture iso-wall-texture" d=${face.d}></path>`
            : nothing}`;
        }
        if (entry.layer === 'wall-top') {
          const face = entry.face;
          return svg`<path class="iso-wall-top" d=${face.d} data-component=${face.component}
            fill-rule="evenodd"></path>${layers.materialNuance
            ? svg`<path class="iso-material-texture iso-wall-texture" d=${face.d}
                fill-rule="evenodd"></path>`
            : nothing}`;
        }
        const surface = entry.surface;
        /* css-uses {"owner":"renderIsoWalls","kind":"class","values":["iso-door","iso-window"],"reason":"Opening surfaces have exactly the door/window type union"} */
        return svg`<path class="iso-opening-panel iso-${surface.type} iso-opening-${surface.kind} iso-material-${surface.material}"
          d=${surface.d} data-id=${surface.id} data-kind=${surface.type}
          data-surface=${surface.kind} data-leaf=${surface.leaf ?? nothing}></path>${layers.materialNuance
            ? svg`<path class="iso-material-texture iso-wall-texture iso-opening-texture"
                d=${surface.d}></path>`
            : nothing}`;
      })}</g>
  </g>` as unknown as TemplateResult;
}
