import type { RenderOpening } from './interaction-types';
import type { SpaceDisplay } from './logic';
import type { ResolvedOpeningVisual } from './opening-features';
import { resolveIsoDecorationLayers, resolveIsoOpeningPanels, type IsoOverlayRenderScene, type IsoRenderScene } from './iso-scene-geometry';
import type { IsoDecorationLayers } from './iso-openings';

export * from './iso-scene-geometry';
export { computeIsoSunBeams } from './iso-sun';
export { Plan3dHost } from './plan-3d-host';
export { readPlan3dMarkerFaces } from './plan-3d-markers';
export const ISO_SCENE_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export function preparePlan3dFrame(input: {
  display: SpaceDisplay;
  scene: IsoRenderScene;
  openings: readonly RenderOpening[];
  amountOf: (opening: RenderOpening) => number;
  visualOf: (opening: RenderOpening) => ResolvedOpeningVisual;
  overlays: (layers: IsoDecorationLayers) => IsoOverlayRenderScene | null;
}) {
  const layers = resolveIsoDecorationLayers(input.display);
  return { layers, panels: resolveIsoOpeningPanels(layers, input.scene, input.openings, input.amountOf, input.visualOf),
    overlays: input.overlays(layers) };
}
