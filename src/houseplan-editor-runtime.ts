/**
 * House Plan Card — an interactive house plan as a native Lovelace card.
 * Configuration sources:
 *  1) SERVER (the houseplan integration, WS houseplan/config/get) — spaces, plans,
 *     rooms, device overrides, virtual devices. Coordinates are NORMALIZED (0..1).
 *  2) LEGACY fallback — baked-in country-house data (src/data/*), coordinates in a 1489×1053 canvas.
 * The icon layout is stored on the server (houseplan/layout/*), fallback — localStorage.
 */
import { LitElement, html, svg, nothing, TemplateResult, PropertyValues } from 'lit';
import { guard } from 'lit/directives/guard.js';
import { renderVacuumMapsSection } from './editors/vacuum-maps-section';
import { calibrationTarget, planVacuumFit } from './vacuum-route-edit';
import { repeat } from 'lit/directives/repeat.js';
import {
  cancelHouseplanPointerMove, flushHouseplanPointerMove, queueHouseplanPointerMove,
} from './pointer-move-queue';
import {
  commitHouseplanEditor, disposeHouseplanEditor, measureHouseplanDecorText,
  routeHouseplanEditorUpdate, whenHouseplanEditorSettled,
} from './live-editor';
import './hp-dialog';
import type { HpDialog } from './hp-dialog';
import type { HpConfirmRequest } from './danger-confirm';
import './hp-color-opacity';
import type { ColorPickerLabels } from './hp-color-opacity';
import './hp-help';
import type { AuthoritativeConfigResponse } from './version-recovery-card';
import './hp-device-preview'; import './hp-zigbee-topology-settings';
import {
  EXCLUDED_DOMAINS, DEFAULT_ICON_RULES, compileIconRules, isValidPattern, iconFor,
  type IconRule, type CompiledIconRule,
} from './rules';
import {
  lqiColor, snapToGrid, snapSegment45, samePoint, pointInPolygon, markerIdForBinding,
  segmentCm, formatLength, roomEdges, roomPoly, paperRoomShapes, pointStrictlyInside, roomsOverlap,
  pointOnBoundary, mergeRooms, splitRoomPath, polygonArea, closestPointOnBoundary, pointStrictlyInside as ptInside, islandsOf, sharedBoundary, distToSegment, outlineWithout, cutSegments, alignGuides, segmentAngle, is45, isExact45Vector, type AlignGuide, swipeTarget, clampScale, migratePdfUrls, roomFillModeOf, roomGlowOf, contentUrl,
  snapToWall, snapPointAlongPoly, openingAmount, openingShoulders, interiorPoint,
  isInteriorLightOpeningType, openingEntityReferences, filterOpeningEntityCandidates,
  poleOfInaccessibility, subst,
  averageLqi, fitView, declump, safeUrl, floorsOf, type FloorInfo,
  stateIcon, lightColorOf, parseRoomRef, diffNewDevices, resolveGlowValues, resolveGlowAppearance,
  glowAlpha, normalizeGlowColorOverride, isControllable,
  spaceDisplayOf, resolveEffectiveRoomFill, fillColorsOf, DEFAULT_FILL_COLORS,
  customFillOf, roomCustomFillOf, DEFAULT_CUSTOM_FILL,
  type FillColors, type FillColorEntry, type ResolvedRoomFill, runServiceFor, RUN_TARGET_DOMAINS,
  DEFAULT_ROOM_COLOR, DEFAULT_ROOM_OPACITY, stageBgOf, showRoomTooltipOf,
  DEFAULT_TEMP_MIN, DEFAULT_TEMP_MAX, type SpaceDisplay,
  referencedContentUrls,
  DISPLAY_MODES, TAP_ACTIONS, SPACE_FILL_UI_MODES, ROOM_FILL_MODES,
  normalizeDeviceDisplay, isAlarmCapable, type DeviceDisplayMode,
  liveText, liveTextReference, liveTextToken, hassValue, valueWithUnit, decorTextScale, decorTextLines,
  DECOR_TEXT_BASE,
} from './logic';
import {
  resolveSafeResize,
  coalesceResizeRooms,
  polyIsSimple, areaM2, formatArea, MIN_ROOM_CM,
  type SafeOpeningIn, type SafeResizeObstacle, type SafeResizeOptions,
  type SafeResizePlan, type SafeResizeReason, type SafeResizeResolution,
} from './resize';
import {
  ResizeController,
  type ResizeProjectionResult,
} from './resize-controller';
import { resizeLiveCandidateSpace, resizeLiveJunctionRoomIds } from './resize-live-preflight';
import { commitWallChainSegmentGeometry } from './draft-live-commit';
import {
  placeResizeAreaLabel, resizeMeasuredEdges,
  type ResizeAreaPlacement,
} from './resize-labels';
import {
  computeSunRays, dayPhase, northDegOf, bgModeOf, sunRaysOn,
  sunStateOf, rayPeakAlpha, raysVisible, rayColor, RAY_FADE_MS, type SunRay,
  rayStops, resolveDayCycle, dayCycleFingerprint, type DayCycleState,
  rayRimEdges, rimStops, rimPeakAlpha, RIM_COLOR,
} from './sun';
import { dayCycleStageVars, renderDayCycleEnvironment } from './day-cycle-render';
import {
  furnitureDefaultCm,
  furnitureGraphic, furnitureCorners,
  furnitureRenderTransform, furnitureStrokePx,
  resizeFurnitureTransform, furnitureRotationAngle,
  furnitureSignedFieldCm, furnitureSignedFieldValue,
  clampFurnCm,
  type FurnitureResizeResult,
} from './furniture';
import { FURN_WALL_CELLS, resolveFurniturePlacement, snapFurnitureToWall, type FurniturePlacement } from './furniture-placement';
import { FURNITURE_ART_RUNTIME } from './furniture-art-runtime';
import { FURNITURE_ART_FINGERPRINT, GENERATED_FURNITURE_ART } from './furniture-plan-art.generated';
import { furnitureWallSurfacesFor, type FurnitureWallSurface } from './furniture-wall-surface';
import {
  degradeWalls, rekeyWallsAfterMoveChecked, wallRecordCarrierViolations,
  setWallThickness, setWallThicknessForRoom, cmToField, wallCmToUnits,
  multiWallNodesForGeometry,
  wallEdgeBodies, wallBodiesGeometry, wallBodiesGeometryPath, wallBodiesUnionPath,
  recutWallBodiesGeometry,
  floorFootprintGeometry,
  innerContourForRoom, roomWallProfile, outsetContour,
  openingInnerFaceOffsetFromIndex, openingTunnelGeometriesFromIndex,
  openingWallIndex as buildOpeningWallIndex, resolveOpeningWallAssociation,
  applyWallThicknessToNewRoom,
  drawWallPreviewD, linearWallJoinPatches, DRAW_WALL_DEFAULT_CM,
  wallIntervals, materializeWallIntervals,
  normalizeWallIntervals,
  intervalCmAt, wallBodyNeedsSolid, wallHatchNeedsSolid, wallHatchStepUnits,
  HATCH_BASE_STEP_UNITS, type OpeningTunnelGeometry, type OpeningWallIndex,
  type LinearWallSegment, type WallEntry, type WallInterval,
  type MultiWallNodeMap,
  innerEdgeSpan, ownEdgeOffsets, thicknessCmAt,
} from './wall-thickness';
import {
  junctionLimitViolations, increasedViolations,
  type JunctionLimitViolation, type JunctionSharedGeometry, type LimitSegment,
} from './junction-limits';
import {
  pointOnOpenCut, sanitizeOpenSpans,
  type OpenSpanEntry,
} from './open-spans';
import { ContentSigner } from './signing';
import {
  resolveFixedFloor, resolveInitialSpace, settleBestEffort,
  type FixedFloorSelection, type InitialSpaceSelection,
} from './initial-load';
import { selectActiveSpaceModel, selectSpaceModelById } from './space-model-selection';
import {
  createEmptySpaceConfig, initialSpaceDisplayDraft, strictNumber, switchSpacePlanSource,
  touchSpaceDisplay, type SpaceDialogState,
} from './space-dialog';
import { commitPlanOptimization } from './plan-optimize-write';
import { openSpaceCopyDialog, renderSpaceCopyDialog, saveSpaceCopy } from './space-copy-runtime';
import { mdiHomeCityOutline } from '@mdi/js';
import {
  Affine, applyAffine, readVacTelemetry,
  autoCalibrate, pushTrailPoint, isVacMoving, vacTrailMode, vacMapIdWithFallback,
  parseVacSourceCandidate, resolveVacSource, resolveCurrentVacPath, trimVacPathTarget, areaCentroid,
  vacCalibrationResidualCm, vacRoomNameMatchCount, VAC_CALIBRATION_WARN_CM,
  VAC_TELEPORT_GAP_MS, VAC_STALE_MS,
  FitParams, fitMatrix, initialFit, reanchorFit, VacRoom,
  Pt as VacPt, type VacPath, type VacSourceCandidate,
  type VacSourceResolution, type VacSourceStatus,
} from './vacuum';
import {
  buildDevices, deviceFromMarkerDraft, effectiveExcludedIntegrations, seedHiddenBindings, lqiFor, tempFor, humFor, climateTempFor, isHumEntity,
  areaTemp, areaHum, sourceValue, areaClimateMap,
  resolvedLightSources, resolvedLightState, resolvedLightStats,
  hasOwnSpatialSource, hasOwnStatefulLightSource, ownControllableEntities,
  forcedLightEntityOf,
  resolveDeviceLightSettings, selectSpatialGlowSource,
  resolvedDeviceStateEntities, removedPlanBindings, isRemovedPlanEntity,
  deletePlanMarkerRecords, effectiveMarkerControls, persistedExternalControls,
  removeMarkerControlReferences, rewriteMarkerControlReferences, markerControlWouldCycle,
  resolveIcon,
  type AreaClimate,
} from './devices';
import {
  bindingCandidates, buildDeviceInbox, filterDeviceInbox,
  type DeviceInboxCategory, type DeviceInboxReason, type DeviceInboxRow,
} from './device-inbox';
import {
  formatToggleConfirmation, formatToggleIntent, projectedTapAction, resolveToggleIntent,
  sameToggleOperationTargets, toggleCoverEntity, toggleIntentName, toggleOperation,
  toggleEntityCandidates, unavailableToggleTargetNames,
  type ResolvedToggleIntent, type ResolvedToggleTarget,
  type ToggleNextEffect, type ToggleNoneReason,
  type ToggleSkipReason,
} from './device-toggle';
import { toggleEntityWriteFields } from './marker-toggle-entity';
import { removeMarkerAreaSnapshots } from './device-area-relocation';
import {
  adoptVirtualLightServerSnapshot,
  applyVirtualLightEvent,
  reconcileVirtualLightSnapshot,
  virtualLightFingerprint,
  virtualLightSnapshot,
  virtualLightWire,
  type VirtualLightSnapshot,
} from './virtual-light-state';
import type {
  OpeningCfg, PartitionOpeningHost,
  RoomCfg, PartitionCfg, WallColumnCfg,
  SpaceModel, PdfRef, Marker, ServerConfig, DevItem, CardConfig,
  MarkerValueBadge, ValueBadgePosition, ValueBadgeSource, ZeroWallStyle,
} from './types';
import {
  COLUMN_MAX_CM, canonicalColumnAngle, clampColumnCm, columnBody,
  directionalOccluders, floorMinusBodies, geometryArea, geometryOuterRings,
  geometryAllRings, intersectionPaths, partitionBody, polyclipPathD,
  pointInOpaquePlanBody, pointInPhysicalBody, sameColumnPlacement,
  physicalBodyParts,
  type PartitionOpeningCut,
} from './physical-geometry';
import {
  hostedOpeningIntervalsOverlap, materializePartitionOpening,
  partitionOpeningJambMargin, partitionOpeningNeedsStrictValidation,
  partitionOpeningFace,
  partitionPlacementIntervals, resolvePartitionOpeningCompat, resolvePartitionOpeningStrict,
  type PartitionOpeningOrphanReason, type ResolvedPartitionOpening,
} from './partition-openings';
import {
  buildHiddenWallDiagnosticGeometry, buildPlanSnapGeometry,
  resolvePlanSnapResult, resolveStrictPlanSnap,
  type HiddenWallDiagnosticGeometry,
  type PlanSnapCandidate, type PlanSnapEndpoint, type PlanSnapGeometry, type PlanSnapSegment,
} from './plan-snap-overlay';
import {
  atomizeWallSegments, buildWallFaceGraph, findNewWallFacesInGraphs, findWallFaceAtPoint,
  normalizeUnifiedWallTool, wallChainSegments, chainSegmentCms,
  type WallFaceGraph, type WallGraphFace, type WallGraphSourceSegment,
} from './wall-face-graph';
import { parameterOnPartition, planRoomDeletion } from './room-deletion';
import {
  planWallFaceRepair, repairMovesHostedPartition, type WallFaceRepairProposal,
} from './wall-face-repair';
import {
  LightSegment, polygonSegments, splitAtIntersections, visibilityPolygon,
} from './light-visibility';
import './space-card';
import { cardStyles } from './styles';
import { editorSecondaryStyles } from './editor-secondary.styles';
import {
  EditorSecondaryController,
  type EditorSecondaryCopy,
  type EditorSecondaryModel,
  type EditorToolbarGroup,
} from './editor-secondary';
import {
  fitInSquare, planRect, contentBounds, spaceModels, contentFrame, contentItems, spaceFrame,
  spaceCenter, iconUnit, iconCqw, gridLevels, itemOf, snapPt,
  MIN_ZOOM, PAN_SLACK, CANVAS_LIMIT, SANE_LIMIT, GRID_PITCH, GRID_STEP_N,
  PLAN_SCALE_MIN, PLAN_SCALE_MAX,
  clampCanvasR, clampCanvasN, type ContentItem, type Rect,
} from './space-geometry';
import { optimizePlans, type OptimizeReport } from './plan-optimizer';
import {
  WALL_SEGMENT_MODEL_VERSION,
  adoptWallSegmentModelCandidateInPlace, commitWallSegmentModel,
  fixedTopologyWallLineageHints,
  resolveRoomOpeningHost, wallModelOffGridValueCount, WallSegmentModelError,
} from './wall-segment-model';
import {
  legacyZeroContourLines, resolveZeroWalls, zeroContourLines,
  zeroWallHasOpening, zeroWallStyleOf,
} from './zero-walls';
import { snapNearAxisEndpoint } from './near-axis';
import type { SpaceReferenceRepairContext } from './space-reference-repair';
import { collectSpaceMarkerDependencies, spaceDeletionMessage } from './space-deletion';
import {
  checkSpacePhysicalGeometry,
  checkOptimizeGeometry,
  geometryOpenCuts,
  geometryOpenings,
  geometryPartitionOpeningCuts,
  geometryRoomOpeningInputs,
  spacePhysicalGeometryFingerprint,
  type GeometryOpeningProjection,
  type OptimizeGeometryPreflightResult,
} from './plan-geometry-preflight';
import {
  canonicalizeConfigGeometry,
  canonicalizeLayoutGeometry,
  canonicalizePosition,
  formatLatticeShiftCm,
} from './coordinate-canonicalization';
import { enqueueSerializedWrite, optimisticAttempt, rollbackOptimistic, type OptimisticAttempt } from './serialized-write-queue';
import { applyCalibrationProposal, saveAutomaticCalibration, saveManualCalibration, saveVacuumMatrix,
  type CalibrationProposal, type VacuumFit } from './vacuum-calibration-write';
import { hasTranslation, langOf, t, type I18nKey } from './i18n';
import { supportT, type SupportI18nKey } from './i18n/support'; import { writeZigbeeTopologySettings, zigbeeTopologySettingsOf, type ZigbeeTopologySettings } from './zigbee-topology-settings';
import {
  newSupportDialogState,
  supportApiCompatible,
  supportCanSubmit,
  supportDraftError,
  supportErrorCode,
  supportRuntimeFacts,
  supportSizeKiB,
  supportSubmissionIdentity,
  type SupportDialogState,
  type SupportPreview,
} from './support-feedback';
import { classifyPlanFile, encodePlanFile, renderBackdropGuard } from './backdrop-pick';
import { CommandStack } from './command-stack';
import type { DeviceLayout, DevicePositionState } from './device-position-history';
import { resolvedSvgScreenBlend, svgScreenBlendSupported } from './glow-blend';
import {
  CONTINUITY_LONG_HIDDEN_MS,
  VisualContinuityController,
  contentFingerprint,
  subscribePageVisibility,
  visualFrameFingerprint,
  type PageVisibilitySignal,
} from './visual-continuity';
import { PointerModalityController } from './pointer-modality';
import {
  entityVisualSample, entityVisualSamplesForDevice,
  type DeviceActivity, type DeviceVisualState, type EntityVisualSample,
} from './device-visual';
import {
  activitySourceSignature, deviceA11yState, presentationClasses, resolveDevicePresentation,
  resolvePresentationSources, type ResolvedDevicePresentation,
} from './device-presentation';
import {
  ACTIVITY_WINDOW_MS, advanceFiniteActivity, createFiniteActivityRuntime,
  resetFiniteActivityRuntime, stampFiniteActivity, type FiniteActivityRuntime,
} from './activity-runtime';
import {
  recommendedValueBadgeSource, valueBadgeCandidates, valueBadgeSourceFromKey,
  valueBadgeSourceKey, valueBadgeTitle, valueBadgeWriteFields, valueSourceWriteFields,
  type ValueBadgeCandidate,
} from './device-value-badge';
import {
  createRenderDeviceSnapshot, presentationSnapshotKey, renderDeviceSnapshotPositions,
  type RenderDeviceSnapshot,
} from './render-device-snapshot';
import { deviceFaceStyle, deviceThemeClass, renderDeviceFace } from './device-face';
import { effectiveDeviceBaseSize } from './device-marker-geometry';
import {
  ModeTransitionController, viewportFromViewBox,
  type HouseplanMode, type ModeTransitionState, type ModeVisualState, type ModeViewBox,
} from './mode-transition';
import {
  currentLabs, hashSpace, noteLabsRender, subscribeLabs, type LabsSnapshot,
} from './labs';
import { projectPlanPoint } from './iso-projection';
import {
  acquireHaRegistries, activeRegistryHass, cacheHaBindingStatuses,
  fullRegistryHass, haRegistryBuildSignature, haRegistryDiagnostics, haRegistrySnapshot,
  openingEntityAvailable, refreshHaRegistries, renderOpeningEntityAvailable,
  resolveHaBindingStatus,
  type HaBindingStatus, type HaRegistrySnapshot,
} from './ha-binding-status';
import type { DecorShape, DecorStyle } from './editors/decor/types';
import {
  DECOR_ASSETS_API_VERSION, type DecorAsset,
} from './decor-assets';
import { DecorImageEditor } from './decor-image-editor';
import {
  DEFAULT_DECOR_STYLE, boxAnchors, boxCorners, clamp01, decorCmToUnits,
  decorStrokeUnits, decorStyleOf, decorStylePatch,
  decorUnitsToCm, mergeSnapGeometry, normalizeAngle, resizeDecorBox,
  resizedBoxTopLeft, snapDecorPoint, validDecorDraft,
  type DecorBox, type SnapGeometry,
} from './editors/decor/geometry';
import { decorStyleToSettings } from './editors/decor/geometry';
import { renderOpeningTunnelFills } from './render/opening-tunnels';
import {
  openingVisibleMetrics, renderOpeningVisibleGeometry,
  type OpeningFaceOffset, type OpeningVisibleSpec,
} from './render/opening-symbol';
import {
  openingDefaultLengthCm, openingPlacementPreset, passagePlacementPreviewGeometry,
  resolveOpeningPlacementResult, sameOpeningPlacementInput,
  type OpeningPlacementPreset, type OpeningPlacementType,
} from './opening-placement';
import {
  buildOpeningDimensionContext, resolveOpeningDimensions,
  type OpeningDimensionContext,
} from './opening-dimensions';
import type { OpeningPlacementCandidate, OpMeasure, RenderOpening } from './interaction-types';
import { safeStoredColor } from './color';
import {
  gridCellFieldToCm, gridCellFieldValue, gridVisualScale, gridVisualUnits,
  newSpaceCellCm, wallThickHoverHalfUnits,
} from './grid-scale';
import {
  applySpaceOrder, canStartTabDrag, markersNeedingPlacement, passedDragThreshold,
  reorderSpaceIds,
} from './space-order';
import { applyOpeningMoves, mergeCollinearPartitions, spaceMergeGeometry } from './wall-merge';
import { reconcileCoincidentPartitions } from './coincident-partitions';

const CARD_VERSION = '1.73.0-beta.1';

// #474: the editor imports the furniture artwork statically and hands it to
// the page runtime the moment this chunk evaluates — before the loader's
// `install`, so the palette and the placement ghost never render `pending`.
FURNITURE_ART_RUNTIME.adopt(GENERATED_FURNITURE_ART, FURNITURE_ART_FINGERPRINT);

type ResizeLiveLabel = {
  kind: 'length';
  x: number;
  y: number;
  text: string;
  edge: { a: [number, number]; b: [number, number] };
} | {
  kind: 'area';
  roomId: string;
  x: number;
  y: number;
  text: string;
  placement: ResizeAreaPlacement;
};
type ResizePreview = { space: string; sp: any };
type ResizeWallUnion = ReturnType<typeof wallBodiesUnionPath>;
type ResizeWallArtifact = ReturnType<typeof wallBodiesGeometry>;
const DISPLAY_LABEL_KEYS: Record<DeviceDisplayMode, I18nKey> = {
  badge: 'display.badge',
  icon_ripple: 'display.icon_ripple',
  value: 'display.value',
  static_icon: 'display.static_icon',
};
const DISPLAY_HINT_KEYS: Record<DeviceDisplayMode, I18nKey> = {
  badge: 'marker.display_hint_badge',
  icon_ripple: 'marker.display_hint_icon_ripple',
  value: 'marker.display_hint_value',
  static_icon: 'marker.display_hint_static_icon',
};
/** Keeps every previously valid scale at the maximum 20 cm grid scale lossless. */
const DECOR_TEXT_CM_MAX = 2000;
const CELL_CM_MIN = 0.1;
const CELL_CM_MAX = 1000;
/** HP-1552 boot-veil timing (AUD-1552-02). The veil holds for at least
 *  BOOT_MIN_MS; every stage-height change restarts a BOOT_QUIET_MS
 *  trailing-quiescence requirement (chrome still settling near the cap
 *  extends the wait); BOOT_MAX_MS lifts the veil unconditionally.
 *  BOOT_MIN_MS exceeds the old 600 ms window by a frame-latency margin: a
 *  panel applied right at the window's edge (~590 ms) only materializes in
 *  the stage height a couple of rAF/render frames later. */
const BOOT_MIN_MS = 700;
const BOOT_QUIET_MS = 250;
const BOOT_MAX_MS = 1200;
/** AUD-1552-02: post-reveal grace during which late chrome shifts glide
 *  (CSS height transition on the stage) instead of snapping. */
const BOOT_SOFT_MS = 1500;
type LruRead<V> = { hit: true; value: V } | { hit: false };
const lruRead = <K, V>(cache: Map<K, V>, key: K): LruRead<V> => {
  if (!cache.has(key)) return { hit: false };
  const value = cache.get(key)!;
  cache.delete(key);
  cache.set(key, value);
  return { hit: true, value };
};
const lruWrite = <K, V>(cache: Map<K, V>, key: K, value: V, limit: number): void => {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};
/** DEV-B703-01: warm re-mount memo — MODULE scope, so it lives with the loaded
 *  PAGE, not with any card instance. Lovelace re-creates card elements when
 *  the websocket reconnects after a long-backgrounded tab; the fresh instance
 *  used to run the whole first-open boot (veil + BOOT_MIN_MS + quiescence),
 *  which reads as «план перезагрузился», even though the page (and HA's
 *  chrome) never went anywhere. Within one loaded page the chrome IS already
 *  settled, so the geometry the previous instance settled at is still valid:
 *  remember it per (viewport size × card config) and let the next instance
 *  open instantly in the final geometry, no veil at all. A window resize
 *  between instances changes the key → miss → the full protective boot (the
 *  only case where the chrome may genuinely re-settle). The config part of
 *  the key keeps two DIFFERENT cards on one page from adopting each other's
 *  header height (same config twice on one view is indistinguishable — and
 *  then the heights match anyway). */
/** DEV-B703-03 — what the dead instance was LOOKING at. The header height
 *  alone was not enough: `_view` (the pan) never left the instance, and the
 *  EDITOR zoom is deliberately not persisted (`_saveZoom` is view-only) while
 *  the editor MODE is (LS_NAV). So a re-mount inside an editor came back at
 *  the view-mode zoom, and a panned view came back re-centred on the plan —
 *  the owner's «чуть-чуть дёргается масштаб». The memo now carries the whole
 *  viewport, so the restore is the same rect, not the same zoom number. */
type WarmViewport = {
  space: string;
  mode: 'view' | 'plan' | 'devices' | 'decor';
  projection: 'flat' | 'iso';
  activeLabsIso: boolean;
  logicalCenter: { x: number; y: number } | null;
  zoom: number;
  view: { x: number; y: number; w: number; h: number } | null;
  /** the view-mode viewport an editor was entered from (_viewModeSnap) */
  snap: { space: string; zoom: number; cx?: number; cy?: number } | null;
  tool: MarkupTool;
  decorTool: DecorTool;
  showHidden: boolean;
  /** «показать дальние» changes _baseVb, so the restored view rect is only
   *  the same rect if the frame it was clamped against is the same one */
  showFar: boolean;
  selId: string | null;
  rszSel: string | null;
  decorSel: string | null;
};
const expiredWarmViewport = (vp: WarmViewport | null): WarmViewport | null => {
  if (!vp || vp.mode === 'view') return vp;
  return {
    ...vp,
    mode: 'view',
    zoom: vp.snap?.space === vp.space ? vp.snap.zoom : vp.zoom,
    view: null,
    snap: null,
    tool: 'draw',
    decorTool: 'select',
    showHidden: false,
    selId: null,
    rszSel: null,
    decorSel: null,
  };
};
/** Which dialog was open and its draft (docs/WARM-REMOUNT.md §3). `data` is
 *  the live draft OBJECT — the memo is module state, never serialised, so a
 *  half-filled device dialog with its uploaded pdfs survives for free. */
type WarmDialogKind = 'space' | 'marker' | 'settings' | 'opening' | 'decorText' | 'decorShape' | 'backdrop' | 'rules' | 'room' | 'info' | 'openingInfo';
type WarmDialog = { kind: WarmDialogKind; space: string; mode: string; data: any };
/** AUD-159B1-01: one entry per CARD PLACEMENT, not per key. Two cards with an
 *  identical config on one view share the key, so the key alone cannot say
 *  whose viewport this is; `place`/`idx` (the parent element the card was
 *  mounted in, and its position among that parent's children) identify the
 *  DOM slot, and `owner` the live instance sitting in it. A re-mount into the
 *  same slot inherits the entry; a different card never does. */
type WarmEntry = {
  /** generation id of the instance that currently owns the slot */
  owner: number;
  /** HA route where this placement was captured. */
  path: string;
  /** the parent element the owner was mounted in (weak — never keep DOM alive) */
  place: WeakRef<Node> | null;
  /** the owner's index among that parent's children */
  idx: number;
  /** the owner is attached; a dead slot is a tombstone waiting for a successor */
  live: boolean;
  hdrH: number;
  stageH: number;
  vp: WarmViewport | null;
  /** Last complete visual frame for #73; safe only inside the same placement. */
  frameFingerprint: string;
  /** Metadata projection is immutable-by-replacement and avoids an empty
   *  device layer on a same-document warm remount before registry refresh. */
  devices: readonly DevItem[] | null;
  dlg: WarmDialog | null;
  /** when the instance that wrote `dlg` detached; 0 = it is still alive */
  freed: number;
  /** the TTL timer that frees `dlg` once it can no longer be revived */
  evict: number;
};
const warmBoot = new Map<string, WarmEntry[]>();
let warmGen = 0;
/** `location.pathname` is the dashboard AND the view path: two Lovelace views
 *  never share a key, so a card that comes back on another view boots cold
 *  instead of inheriting a stranger's viewport (AUD-159B1-01). The hash is
 *  deliberately out — `#space=` is OUR deep link, not another placement. */
const warmBootKey = (config: unknown): string =>
  `${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(config ?? {})}`;
/** A dialog is revived only if the instance that owned it died THIS long ago.
 *  A Lovelace rebuild detaches and re-attaches within one task; a user who
 *  walked off to another dashboard view and came back later must not be met
 *  by a dialog they have long forgotten opening. */
let WARM_REVIVE_MS = 10000;
/** The memo gains a key on every window RESIZE and never loses one; the
 *  values used to be two numbers, and now they can hold a dialog draft (a
 *  plan pdf among it). Keep the last few viewports — a stale entry only
 *  costs the next card at that size a cold boot. */
const WARM_MAX_KEYS = 8;
/** How many placements of ONE key are remembered. More identical cards than
 *  this on one view and the oldest dead slot is dropped — it only costs that
 *  placement a cold boot. */
const WARM_MAX_SLOTS = 4;

/** Which slot of `list` belongs to the instance now claiming it, and may we
 *  trust it with the viewport/dialog (`sure`) or only with the settled height?
 *  Ranked, best first (AUD-159B1-01):
 *    4 — same parent, same index: literally the DOM slot we are standing in,
 *        which is how Lovelace replaces a card (the predecessor may still be
 *        attached for another task — that is the case the audit reproduced);
 *    0 — some OTHER placement whose owner is still attached: a neighbouring
 *        card with an identical config, never ours to inherit;
 *    3 — same parent, shifted index, owner gone: still our placement;
 *    2 — a tombstone whose placement is gone with its subtree — the ordinary
 *        Lovelace rebuild, where the container is rebuilt too.
 *  A tie means two candidates are equally plausible: then only the settled
 *  height is adopted, and it is the same for all of them anyway. */
const warmMatch = (
  list: WarmEntry[],
  gen: number,
  place: Node | null,
  idx: number,
): { slot: WarmEntry | null; sure: boolean } => {
  const score = (s: WarmEntry): number => {
    const same = !!place && s.place?.deref() === place;
    if (same && s.idx === idx) return 4;
    if (s.live) return 0;
    return same ? 3 : 2;
  };
  let best: WarmEntry | null = null;
  let bestScore = 0;
  let ties = 0;
  let newest: WarmEntry | null = null;
  for (const s of list) {
    if (s.owner === gen) continue;
    newest = s;
    const sc = score(s);
    if (sc <= 0) continue;
    if (sc > bestScore) { best = s; bestScore = sc; ties = 1; }
    else if (sc === bestScore) ties++;
  }
  if (!best || ties > 1) return { slot: best || newest, sure: false };
  return { slot: best, sure: true };
};
/** Rotation step of a decor text block — the same 5° a device icon turns in
 *  (marker dialog). Shift affects angle precision only, never position. */
const DT_ANGLE_STEP = 5;
/** Line spacing of a multi-line label, in font sizes. */
const DT_LINE = 1.2;
const LS_KEY = 'houseplan_card_layout_v1';
const LS_CFG = 'houseplan_card_cfg_v1'; // cache of the server config+layout for instant rendering
const LS_ZOOM = 'houseplan_card_zoom_v1';
const LS_NAV = 'houseplan_card_nav_v1'; // last space only; editor sessions never survive page navigation
const LS_KIOSK = 'houseplan_card_kiosk_v1'; // per-SCREEN size multipliers (each wall tablet differs)
const LS_VIEW = 'houseplan_card_view_v1'; // presentation preference per space, Labs-only
const POINTER_HOVER_TARGET_SELECTOR = 'hp-dialog, hp-help, hp-color-opacity, hp-device-preview';
const NORM_W = 1000; // side of the render space — the canvas is square (v1.48.0)
/** Short semantic-event / direct-terminal-transition window. Event uses
    three sequential 1.1 s waves; motion cool-down itself never animates. */
/**
 * How finely the lit region is traced where nothing blocks the light. 96 steps
 * put the chord error at 0.05% of the radius — under a tenth of a pixel on a
 * wall tablet, and cheap because only unobstructed directions use them.
 */
const GLOW_ARC_STEPS = 96;
/**
 * Width of the lit→unlit ramp along a shadow edge, in SCREEN pixels: the eye
 * reads a perfectly geometric edge as a cut-out, and a real penumbra is never
 * wider than a hair at this scale. Measured on screen on purpose, so zooming in
 * does not turn a hairline into a smear.
 */
const GLOW_EDGE_FEATHER_PX = 2;
/**
 * Radial profile of a pool, as [offset %, share of the calibrated alpha].
 * Monotonic all the way out: a lamp is brightest under itself and dies at its
 * radius. The centre keeps the full calibrated alpha, so nothing about the
 * brightness maths (docs/specs/067) changes — only where that alpha is spent.
 */
const GLOW_FALLOFF: readonly (readonly [number, number])[] = [
  [0, 1], [45, 0.88], [70, 0.62], [86, 0.32], [100, 0],
];
/** A source pool fades in/out without changing its final calibrated alpha. */
const GLOW_FADE_MS = 500;

/** Smallest rectangle holding both (docs/CANVAS.md §4). */
const unionRect = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** #313: one Thickness-tool hit — a room interval or independent masonry. */
type WallThickSource = { kind: 'room' }
  | { kind: 'partition'; id: string };
type WallThickHit = {
  a: number[]; b: number[]; roomId: string; segs: number[][];
  open: boolean; cm: number; source: WallThickSource;
};

type MarkupTool = 'select' | 'draw' | 'column' | 'merge' | 'split' | 'resize' | 'opening' | 'wallthick' | 'delroom';
type RoomFillFrame = {
  byRoom: Map<RoomCfg, ResolvedRoomFill | null>;
  byId: Map<string, ResolvedRoomFill | null>;
};
type WallFaceCandidate = WallGraphFace & {
  split?: { roomId: string; mainPoly: number[][]; newPoly: number[][] };
  consumeAllActive?: boolean;
  /** Face existed before this click; rejecting it must be a true no-op. */
  existing?: boolean;
  repair?: WallFaceRepairProposal;
};
type WallFaceDecision = {
  candidate: WallFaceCandidate;
  create: boolean;
  name?: string;
  area?: string | null;
  settings?: RoomCfg['settings'];
};
type WallFaceBatch = {
  candidates: WallFaceCandidate[];
  index: number;
  decisions: WallFaceDecision[];
  activePath: number[][];
  activeCms: number[];
  activePartitionIds: string[];
};
/**
 * The floor a source can see, and nothing else. One region means one clip:
 * a beam through a doorway, the room it lands in and the shadow of a column
 * are all the same computation, so they can never disagree with each other.
 */
type GlowClipGeometry = { lit: string[] };
const MARKUP_TOOLS = new Set<MarkupTool>([
  'select', 'draw', 'column', 'merge', 'split', 'resize',
  'opening', 'wallthick', 'delroom',
]);
/** Warm viewport is page-memory, so it may contain a tool name from the old bundle. */
const normalizeMarkupTool = (value: unknown): MarkupTool => {
  // #173 replaces the public one-shot Partition tool with one Walls chain.
  // A warm page may still carry the old session token; reading it is inert.
  value = normalizeUnifiedWallTool(value);
  // Opening placement is valid only together with its explicit session-only
  // type preset. Warm viewport state does not persist that preset.
  if (value === 'opening') return 'draw';
  return typeof value === 'string' && MARKUP_TOOLS.has(value as MarkupTool)
    ? value as MarkupTool
    : 'draw';
};
const MAX_WALL_CHAIN_POINTS = 500;
const MAX_PARTITIONS = 2000;
const MAX_ROOMS = 400;
const MAX_WALL_COLUMNS = 500;
/** Everything whose topology or wall association changes in the plan editor. */
interface SpaceGeometryState {
  spaceId: string;
  rooms: any[];
  openings?: OpeningCfg[];
  walls?: WallEntry[];
  wall_segments?: any[];
  open_spans?: OpenSpanEntry[];
  partitions?: PartitionCfg[];
  wall_columns?: WallColumnCfg[];
  decor?: DecorShape[];
  plan_transform: {
    plan_x?: number; plan_y?: number; plan_scale?: number;
    plan_scale_x?: number; plan_scale_y?: number; plan_angle?: number;
  };
}
/** Tools of the decor (background) editor. `furniture` is the library
 *  (docs/FURNITURE.md): it opens a palette and places a symbol at real size. */
type DecorTool = 'select' | 'backdrop' | 'line' | 'rect' | 'ellipse' | 'text' | 'furniture' | 'image' | 'erase';

const fireEvent = (node: EventTarget, type: string, detail?: unknown) => {
  const ev = new Event(type, { bubbles: true, composed: true }) as any;
  ev.detail = detail ?? {};
  node.dispatchEvent(ev);
};

const navigate = (path: string) => {
  history.pushState(null, '', path);
  fireEvent(window, 'location-changed', { replace: false });
};

/**
 * Debounce with `flush()` and `pending`. Both are load-bearing: a pending
 * config write MUST be flushed before the card adopts a server revision,
 * otherwise the edit is silently dropped (audit L2, 2026-07-27).
 */
interface Debounced<T extends (...a: any[]) => void> {
  (...a: Parameters<T>): void;
  flush(): void;
  cancel(): void;
  pending(): boolean;
}

const debounce = <T extends (...a: any[]) => void>(fn: T, ms: number): Debounced<T> => {
  let t: number | undefined;
  let last: Parameters<T> | null = null;
  const wrapped = ((...a: Parameters<T>) => {
    clearTimeout(t);
    last = a;
    t = window.setTimeout(() => {
      t = undefined;
      const args = last;
      last = null;
      if (args) fn(...args);
    }, ms);
  }) as Debounced<T>;
  wrapped.flush = () => {
    if (t === undefined) return;
    clearTimeout(t);
    t = undefined;
    const args = last;
    last = null;
    if (args) fn(...args);
  };
  wrapped.cancel = () => {
    clearTimeout(t);
    t = undefined;
    last = null;
  };
  wrapped.pending = () => t !== undefined;
  return wrapped;
};

/**
 * Capture the pointer for a drag, tolerating an inactive pointerId.
 *
 * `setPointerCapture` throws for synthetic events and for pointers some
 * browsers consider gone; that killed a drag outright. The opening pipeline
 * was hardened for this, the device/label/resize ones were not (audit
 * follow-up L4 sub-item) — now they all go through here.
 */
const capturePointer = (ev: PointerEvent): void => {
  try {
    (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId);
  } catch {
    /* an inactive pointerId must never kill the drag */
  }
};

interface DeviceInboxDialogState {
  tab: DeviceInboxCategory;
  search: string;
  showEntities: boolean;
  onlyNew: boolean;
  limit: number;
  /** #44: Discovery-filters drafts. `undefined` = untouched (mirror the
   * stored settings); draftExcluded `null` = "recommended" (no stored key). */
  filtersOpen?: boolean;
  draftGroupLights?: boolean;
  draftExcluded?: string[] | null;
  /** Logical row restored after a nested marker dialog closes. */
  anchor?: string;
  busy?: string;
}

type FixedFloorState = FixedFloorSelection | { kind: 'pending'; value: unknown };


export interface HouseplanEditorHostPort {
  _ackNewDevice: (id: string) => void;
  _activeWallChainId: string | null;
  _activeWallChainPartitionIds: string[];
  _activePlanSnapCandidate: PlanSnapCandidate | null;
  _activePlanSnapConflicts: PlanSnapEndpoint[];
  _activityRt: Map<string, FiniteActivityRuntime>;
  _adoptInitialSpace: (models: SpaceModel[], authoritative?: boolean) => InitialSpaceSelection;
  _adoptStructuralResponses: (cfgResp: any, layResp?: any, layoutOverride?: Record<string, any>) => { configChanged: boolean; layoutChanged: boolean; };
  _alignDialog: { report: OptimizeReport; config: any; layout: Record<string, any>; preflight: OptimizeGeometryPreflightResult | null; cm: number; where: string; changed: boolean; busy: boolean; removeLiveMissingPositions: boolean; } | null;
  _alignPoint: number[] | null;
  _allRoomsFlat: () => { value: string; label: string; }[];
  _angleField: (value: unknown) => string;
  _applyView: (zoom: number, cx?: number, cy?: number) => boolean;
  _areaSel: string;
  _areaToSpace: Record<string, { space: string; room: RoomCfg; }>;
  _aspectJob: Promise<number> | null;
  _autoIconForBinding: (binding: string) => string;
  _backdropGuard: import('./backdrop-pick').BackdropGuardState | null;
  _backdropDialog: { widthCm: number; heightCm: number; angle: string; } | null;
  _backupExportDialog: { kind: "full" | "space"; planOnly: boolean; busy: boolean; error: string; } | null;
  _backupImportDialog: { filename: string; size: number; token: string; preview: any; expectedConfigRev: number; expectedLayoutRev: number; duplicatePolicy: "skip" | "virtual"; confirmMissing: boolean; busy: boolean; error: string; } | null;
  _baseVb: () => number[];
  _bdActive: boolean;
  _bdBase: Rect | null;
  _bdDrag: { kind: "move" | "scale" | "rotate"; pid: number; sx: number; sy: number; base: Rect; p0: { dx: number; dy: number; sx: number; sy: number; angle: number; }; fx: number; fy: number; sgx: number; sgy: number; rect0: DecorBox; before: SpaceGeometryState | null; moved: boolean; } | null;
  _bdMovable: boolean;
  _bdMoved: boolean;
  _bdParams: { dx: number; dy: number; sx: number; sy: number; angle: number; };
  _bdRect: (Rect & { angle?: number; }) | null;
  _bindingEntities: (binding: string) => string[];
  _bindingHasAlarm: (binding: string) => boolean;
  _bindingHasClimate: (binding: string) => boolean;
  _bindingHasHaPage: (binding: string) => boolean;
  _bindingStatus: (binding: string) => HaBindingStatus;
  _bootSoftCancel: () => void;
  _cacheSnapshot: () => void;
  _canCommitSpace: (id: string, authority?: boolean) => boolean;
  _canEdit: boolean;
  _canOptimizeUndo: boolean;
  _cancelDevicePressFeedback: () => void;
  _cancelDeviceDrag: () => boolean;
  _cancelModeTransition: (commitTarget?: boolean) => void;
  _candidateDeviceSnapshot: RenderDeviceSnapshot | null;
  _capturedSnapshotConfigEpoch: number;
  _cellCm: number;
  _cfgContentFingerprint: string;
  _cfgEpoch: number;
  _cfgRev: number;
  _clearTransientHover: (suspend?: boolean) => void;
  _closeInfoCard: () => void;
  _closingWallCm: number | null;
  _cmToUnits: (cm: number) => number;
  _colorPickerLabels: ColorPickerLabels;
  _commitSpace: (id: string, authority?: boolean) => boolean;
  _commitViewModeAtomic: (from: ModeVisualState | null, targetZoom: number, targetCenterX?: number, targetCenterY?: number) => void;
  _confirmDanger: (request: HpConfirmRequest) => Promise<boolean>;
  _cancelDangerConfirm: () => void;
  _config: CardConfig | undefined;
  _contourClosed: boolean;
  _curSpaceCfg: any;
  _currentModeVisual: (mode?: HouseplanMode) => ModeVisualState | null;
  _cursorPt: number[] | null;
  _decorBoxOf: (shape: DecorShape) => DecorBox | null;
  _decorDraft: { kind: "line" | "rect" | "ellipse"; a: number[]; b: number[]; pid: number; } | null;
  _decorEraseConfirm: { id: string; kind: DecorShape["kind"]; } | null;
  _decorImagePalette: DecorAsset | null;
  _decorAssetCatalog: DecorAsset[];
  _decorAssets: Map<string, DecorAsset>;
  _decorAssetBusy: boolean;
  _decorH: number;
  _decorLargeCm: (value: number) => number;
  _decorLargeField: (cm: number) => number;
  _decorList: DecorShape[];
  _decorMove: { id: string; start: number[]; orig: DecorShape; pid: number; moved: boolean; before: SpaceGeometryState | null; } | null;
  _decorResolvedStyle: (shape?: DecorShape | null) => DecorStyle;
  _decorSel: string | null;
  _decorShapeDialog: { id: string; kind: "line" | "rect" | "ellipse" | "furniture" | "image"; color: string; opacity: number; widthCm: number; lineStyle?: "solid" | "dashed"; fill?: boolean; fillColor?: string; fillOpacity?: number; lengthCm?: number; sizeWCm?: number; sizeHCm?: number; angle: string; symbol?: string; assetId?: string; sizeWField?: string; sizeHField?: string; flipH?: boolean; flipV?: boolean; } | null;
  _decorSmallCm: (value: number) => number;
  _decorSmallField: (cm: number) => number;
  _decorSnapCache: { epoch: number; space: string; height: number; exclude: string; geometry: SnapGeometry; } | null;
  _decorStyle: DecorStyle;
  _decorTextCm: (value: number) => number;
  _decorTextDialog: { id?: string; x: number; y: number; text: string; color: string; opacity: number; angle: string; sizeCm: number; pickerEntity?: string; preserveLegacy?: boolean; } | null;
  _decorTextSelection: { start: number; end: number; };
  _decorTextSizeCm: (shape?: DecorShape | null) => number;
  _decorTool: DecorTool;
  _defPos: Record<string, { x: number; y: number; }>;
  _deviceInbox: DeviceInboxDialogState | null;
  _deviceInboxMemo: { key: string; rows: DeviceInboxRow[]; } | null;
  _deviceInboxReturn: DeviceInboxDialogState | null;
  _devicePresentation: (d: DevItem, showLqi?: boolean, designPreview?: boolean) => ResolvedDevicePresentation;
  _devicePositionBusy: boolean;
  _devicePositionHistory: CommandStack<DevicePositionState>;
  _devices: DevItem[];
  _dirtyPos: Set<string>;
  _display: (url: string | null | undefined) => string;
  _wallChainSegmentCms: number[];
  _wallChainRedo: Array<{ id: string; point: number[]; cm: number }>;
  _drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; } | null;
  /** #400: device dragging has its own state since #74; `_drag` is null in
   *  the devices mode, so anything excluding "the thing being dragged" there
   *  must read this instead. Only the id is needed by the editor runtime. */
  _deviceDrag: { id: string } | null;
  _drawWallCm: number | null;
  _drawWallField: string | null;
  _drawWallFieldValue: string;
  _drawWallMaxCm: number;
  _dtBox: { id: string; x: number; y: number; w: number; h: number; } | null;
  _dtDrag: { id: string; kind: "scale" | "rotate"; pid: number; ax: number; ay: number; r0: number; a0: number; textSizeCm0: number; angle0: number; sgx?: number; sgy?: number; orig?: DecorBox; origShape: DecorShape; before: SpaceGeometryState | null; lineEnd?: 0 | 1; moved: boolean; } | null;
  _dtSel: DecorShape | null;
  _duplicateColumnId: string | null;
  _duplicateColumnTimer: number;
  _editing: boolean;
  _editorChromeMode: "plan" | "devices" | "decor";
  _editorSecondary: EditorSecondaryController;
  _editorSecondaryContextId: string;
  _editorSecondaryCopy: EditorSecondaryCopy;
  _editorSecondaryDialogBlocked: boolean;
  _editorToolbarGroups: readonly EditorToolbarGroup[];
  _effectiveProjection: () => "flat" | "iso";
  _endTabDrag: () => void;
  _errText: (e: any) => string;
  _excluded: Set<string>;
  _fillColors: FillColors;
  _fmtLen: (a: number[], b: number[]) => string;
  _frame: { id: string; model: SpaceModel; layout: unknown; devs: unknown; far: boolean; grow: boolean; rect: Rect; all: Rect; outliers: number; } | null;
  _freeAreas: any[];
  _fullRegistryHass: any;
  _furnPalette: { symbol: string; w: number; h: number; } | null;
  _furnCategory: string | null;
  _furnPreviewInput: { raw: [number, number]; free: boolean; } | null;
  _furnTouchPending: {
    pid: number; sx: number; sy: number; pointerType: string; cancelled: boolean;
  } | null;
  _gearPtCache: WeakMap<number[][], number[]>;
  _geometryHistory: CommandStack<SpaceGeometryState>;
  _getAuthoritativeConfig: () => Promise<AuthoritativeConfigResponse>;
  _glowRadiusCm: number;
  _glowRadiusPlaceholder: string;
  _gridPitch: number;
  _haIntegrationVersion: string | null;
  _haSupportApi: number | null;
  _haDecorAssetsApi: number | null;
  _haRegistry: HaRegistrySnapshot;
  _hasFixedFloor: boolean;
  _hiddenWallDiagnosticCache: { key: string; value: HiddenWallDiagnosticGeometry; } | null;
  _hoverRoom: { space: string; room: RoomCfg; } | null;
  _iconRules: CompiledIconRule[] | undefined;
  _imperial: boolean;
  _importDialog: { floors: (FloorInfo & { checked: boolean; })[]; } | null;
  _importQueue: string[];
  _importTotal: number;
  _infoCard: DevItem | null;
  _innerRoomContour: (space: SpaceModel, roomId: string, openCuts?: number[][], roomWalls?: ReturnType<typeof wallBodiesGeometry>['roomGeom'], multiWallNodes?: MultiWallNodeMap | null | undefined) => number[][] | null;
  _junctionLimitViolations: (config: unknown, spaceId: string,
    sharedGeometry?: JunctionSharedGeometry | null, roomIds?: ReadonlySet<string>) => JunctionLimitViolation[];
  _isVacDev: (d: DevItem) => boolean;
  _kiosk: boolean;
  _kioskDialog: boolean;
  _kioskHoldTimer: number | undefined;
  _kioskScale: { icon: number; font: number; };
  _labsIso: boolean;
  _lastValidStageSize: [number, number] | null;
  _layout: DeviceLayout;
  _layoutRev: number;
  _logicalViewCenter: (projection: "flat" | "iso") => { x: number; y: number; } | null;
  _markerDialog: { devId?: string; uploadId?: string; name: string; binding: string; bindingMode: "virtual" | "ha"; bindingOpen: boolean; showEntities: boolean; bindingFilter: string; icon: string; autoIcon: string; display: DeviceDisplayMode; rippleColor: string; rippleSize: number; size: number; angle: number; tapAction: string; tapActionTouched: boolean; originalHasTapAction: boolean; originalTapAction: string | null | undefined; tapHintAnnouncement: string; toggleEntity: string; toggleEntityTouched: boolean; originalHasToggleEntity: boolean; originalToggleEntity: string | null | undefined; tapTarget: string; tapConfirm: boolean; runFilter: string; controls: string[]; controlsFilter: string; glowRadius: string; lightRole: "auto" | "always" | "never"; lightRoleTouched: boolean; originalHasIsLight: boolean; originalIsLight: boolean | null | undefined; lightEntity: string; lightEntityTouched: boolean; originalHasLightEntity: boolean; originalLightEntity: string | null | undefined; glowMode: "auto" | "color" | "fixed"; glowColor: string; glowBrightness: number; glowColorDrafted: boolean; glowBrightnessDrafted: boolean; glowTouched: boolean; originalHasGlowColor: boolean; originalGlowColor: { c: string; bri?: number | null; } | null | undefined; valueBadgeEnabled: boolean; valueBadgeSource: ValueBadgeSource | null; valueBadgePosition: ValueBadgePosition; valueBadgeTouched: boolean; originalHasValueBadge: boolean; originalValueBadge: MarkerValueBadge | null | undefined; valueSource: ValueBadgeSource | null; valueSourceTouched: boolean; originalHasValueSource: boolean; originalValueSource: ValueBadgeSource | null | undefined; useClimateTemp: boolean; model: string; link: string; description: string; pdfs: PdfRef[]; room: string; roomTouched: boolean; hideFromPlan: boolean; busy: boolean; } | null;
  _markerPreviewDevicesMemo: { base: readonly DevItem[]; preview: DevItem; devices: readonly DevItem[]; } | null;
  _markerPreviewMemo: { key: string; device: DevItem | null; } | null;
  _markers: Marker[];
  _markup: boolean;
  _maybeRebuildDevices: () => void;
  _mergeDialog: { aId: string; bId: string; poly: number[][]; pick: "a" | "b"; } | null;
  _mergeSel: string | null;
  _mode: "view" | "plan" | "devices" | "decor";
  _modeTransitionBusy: boolean;
  _modeTransitionEditorCamera: { zoom: number; centerX?: number; centerY?: number; } | null;
  _modeTransitionForceAtomic: boolean;
  _modeTransitionPreparing: boolean;
  _modeTransitionRequest: number;
  _modeTransitionTargetCenterX: number | undefined;
  _modeTransitionTargetCenterY: number | undefined;
  _modeTransitionTargetZoom: number;
  _modeTransitionVisual: ModeVisualState | null;
  _model: SpaceModel[];
  _modelCache: { key: string; model: SpaceModel[]; } | null;
  _nameSel: string;
  _newIds: Set<string>;
  _newSyncKey: string;
  _norm: boolean;
  _normPos: (space: string, x: number, y: number) => { s: string; x: number; y: number; };
  _normalizeWalls: (walls: WallEntry[] | null | undefined, cuts: number[][]) => WallEntry[];
  _noteLayoutRev: (r: any) => void;
  _opDrag: { id: string; moved: boolean; sx: number; sy: number; dirty: boolean; before: SpaceGeometryState | null; } | null;
  _opMeasure: OpMeasure | null;
  _openBindingInHa: (binding: string) => void;
  _openCuts: () => number[][];
  _openingAmt: (o: OpeningCfg) => number;
  _openingDialog: { id?: string; type: "door" | "window" | "gate" | "passage"; lengthCm: number; lengthTouched?: boolean; contact: string; lock: string; contactOpen?: boolean; contactFilter?: string; lockOpen?: boolean; lockFilter?: string; invert: boolean; flipH: boolean; flipV: boolean; host?: PartitionOpeningHost; x: number; y: number; angle: number; } | null;
  _openingDimensionContextCache: { key: string; value: OpeningDimensionContext; } | null;
  _openingEntityAvailable: (eid: string | null | undefined) => boolean;
  _openingFace: (opening: RenderOpening, index: OpeningWallIndex, flipV: boolean) => OpeningFaceOffset;
  _openingHoverCandidate: OpeningPlacementCandidate | null;
  _openingJambBlockCm: number | null;
  _openingPlacementIntervalsCache: { key: string; value: WallInterval[]; } | null;
  _openingPreset: OpeningPlacementPreset | null;
  _openingPresetRevision: number;
  _openingPreview: OpeningPlacementCandidate | null;
  _openingRebindId: string | null;
  _openingWallIndexFor: (space: SpaceModel, openCuts: number[][]) => { key: string; value: OpeningWallIndex; };
  _openingsR: RenderOpening[];
  _optimizeUndoBusy: boolean;
  _panLock: "pan" | "swipe" | null;
  _panStart: { sx: number; sy: number; vx: number; vy: number; } | null;
  _partitionDeleteDialog: { id: string; openings: OpeningCfg[]; } | null;
  _path: number[][];
  _pendingNavMode: "plan" | "devices" | "decor" | null;
  _pendingPhysicalWrites: Map<string, { fingerprint: string; before: SpaceGeometryState; }>;
  _pendingSplit: { roomId: string; mainPoly: number[][]; newPoly: number[][]; } | null;
  _persistLayout: Debounced<() => void>;
  _physicalBodiesCache: { key: string; drafts: number[][][]; partitions: number[][][]; columns: number[][][]; patches: number[][][]; all: number[][][]; } | null;
  _physicalBodiesR: (space?: SpaceModel | undefined) => number[][][];
  _physicalDialog: { kind: "partition" | "column"; id: string; cm: string; shape?: "square" | "circle"; angle?: string; length?: string; } | null;
  _physicalDrag: { pid: number; kind: "partition" | "column"; id: string; start: number[]; startClient: number[]; before: SpaceGeometryState | null; moved: boolean; base: PartitionCfg | WallColumnCfg; delta: number[]; } | null;
  _physicalLastTap: { kind: "partition" | "column"; id: string; at: number; } | null;
  _physicalPickCycle: { signature: string; index: number; x: number; y: number; at: number; } | null;
  _physicalRotate: { pid: number; id: string; center: number[]; startAngle: number; baseAngle: number; angle: number; before: SpaceGeometryState | null; moved: boolean; } | null;
  _physicalSel: { kind: "partition" | "column"; id: string; } | null;
  _pinchStart: { dist: number; zoom: number; } | null;
  _planEntityAvailable: (eid: string | null | undefined) => boolean;
  _planHass: any;
  _planSnapGeometryCache: { key: string; value: PlanSnapGeometry; } | null;
  _planSnapHover: { contextKey: string; candidate: PlanSnapCandidate | null; conflicts: PlanSnapEndpoint[]; } | null;
  _planStructuralGeometryCache: { key: string; value: PlanSnapGeometry; } | null;
  _pointerModality: PointerModalityController;
  _pointers: Map<number, { x: number; y: number; }>;
  _pos: (d: DevItem) => { x: number; y: number; };
  _preflightClipboardFallback: string | null;
  _prepareModeTransition: (request: number, from: ModeVisualState, targetMode: HouseplanMode, targetZoom: number, targetCenterX?: number, targetCenterY?: number) => void;
  _reducedMotion: boolean;
  _rawPhysicalBodiesR: () => number[][][];
  _regSignature: string;
  _reloadConfigOnly: (force?: boolean, observedRev?: number) => Promise<void>;
  _reloadLayoutOnly: () => Promise<void>;
  _renderCardPreview: (spaceScale: number, nameScale: number, labelScale: number) => TemplateResult;
  _renderCompass: () => TemplateResult;
  _renderPlanHass: any;
  _reportedPreflightFingerprint: string | null;
  _resign: () => void;
  _resize: ResizeController<
    ResizePreview, ResizeLiveLabel[], SpaceGeometryState, ResizeWallUnion, ResizeWallArtifact
  >;
  _restoreZoom: () => void;
  _redoDevicePosition: () => void;
  _rlResize: { id: string; space: string; k0: number; cx: number; cy: number; d0: number; } | null;
  _roomCenter: (r: RoomCfg) => number[];
  _roomCustomFill: FillColorEntry | null;
  _roomDeleteDialog: { roomId: string; name: string; } | null;
  _roomDialog: boolean;
  _roomEditId: string | null;
  _roomFill: "" | "none" | "lqi" | "light" | "temp" | "custom";
  _roomHumSrc: string;
  _roomLabelScale: number;
  _roomNameScale: number;
  _roomSrcFilter: string;
  _roomSrcOpen: "temp" | "hum" | null;
  _roomTempSrc: string;
  _roomWallOpeningInputs: (openings?: readonly RenderOpening[], space?: SpaceModel | undefined) => Array<{ x: number; y: number; angle: number; length: number; }>;
  _rszLimitViolation: JunctionLimitViolation | null;
  _rulesDialog: { rules: IconRule[]; test: string; busy: boolean; } | null;
  _saveConfigDebounced: Debounced<() => void>;
  _saveNav: () => void;
  _savePos: (d: DevItem, x: number, y: number) => void;
  _screenToVb: (sx: number, sy: number) => number[];
  _segments: number[][];
  _selId: string | null;
  _sentPos: Map<string, DeviceLayout[string] | null>;
  _serverCfg: ServerConfig | null;
  _serverStorage: boolean;
  _settings: { exclude_integrations?: string[]; group_lights?: boolean; show_all?: boolean; filter_seeded?: boolean; icon_rules?: { pattern: string; icon: string; }[]; show_room_tooltip?: boolean; zigbee_topology?: { enabled?: boolean; z2m_base_topics?: string[] }; };
  _terminalFrame: 0 | 1 | 2;
  _settingsDialog: { colors: FillColors; glowRadius: number; bgColor: string | null; northDeg: number | null; bgMode: "static" | "daynight"; sunRays: boolean; showRoomTooltip: boolean; zigbeeTopology: ZigbeeTopologySettings; busy: boolean; } | null;
  _supportDialog: SupportDialogState | null;
  _showAll: boolean;
  _showHidden: boolean;
  _showToast: (msg: string) => void;
  _signer: ContentSigner;
  _space: string;
  _spaceDialog: SpaceDialogState | null;
  _spaceH: number;
  _spaceModel: () => SpaceModel | undefined;
  _spaceModelById: (id: string | null | undefined) => SpaceModel | undefined;
  _spaceWalls: WallEntry[];
  _splitSel: { roomId: string; pts: number[][]; } | null;
  _stageBgHex: () => string;
  _stageEl: HTMLElement | null;
  _stagedDeviceSnapshotToken: number;
  _suppressClick: boolean;
  _swipeStart: { x: number; y: number; id: number; } | null;
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  _undoDevicePosition: () => void;
  _thickWallCuts: () => number[][];
  _tip: { x: number; y: number; title: string; meta: string; lqi?: number | null; temp?: number | null; hum?: number | null; room?: boolean; } | null;
  _toggleConfirmationLines: (intent: ResolvedToggleIntent) => string[];
  _toggleConfirmationStateText: (target: ResolvedToggleTarget) => string;
  _toggleIntent: (device: DevItem, devices?: readonly DevItem[]) => ResolvedToggleIntent | null;
  _toggleMarkerDialogVisibility: () => void;
  _toggleStateText: (entityId: string, fallback: string) => string;
  _tool: MarkupTool;
  _undoKind: "optimize" | "import" | null;
  _undoPoint: () => void;
  _vacAllCameraCache: { devId: string; candidates: VacSourceCandidate[]; } | null;
  _vacAllCamerasFor: string | null;
  _vacCalConfirm: CalibrationProposal | null;
  _vacEnsureMarker: (d: DevItem) => Marker | null;
  _vacEntity: (d: DevItem) => string | null;
  _vacMapId: (d: DevItem, tele: { mapId: string }, planHass?: any) => string;
  _vacFit: VacuumFit | null;
  _vacOpenAllCameras: (d: DevItem) => void;
  _vacRt: Map<string, { trail: VacPt[]; lastKey: string; lastTs: number; moving: boolean; jump: boolean; endedTs: number; lastPos: VacPt | null; }>;
  _vacSource: (d: DevItem, planHass?: any) => string | null;
  _vacObservedMapId: (d: DevItem, source: string) => string | undefined;
  _vacSourceResolution: (d: DevItem, includeAllCameras?: boolean, planHass?: any) => VacSourceResolution;
  _vacSrvTrails: Record<string, any>;
  _view: { x: number; y: number; w: number; h: number; } | null;
  _viewportGestureDirty: boolean;
  _viewModeSnap: { space: string; zoom: number; cx?: number; cy?: number; } | null;
  _viewOr: (vb: number[]) => { x: number; y: number; w: number; h: number; };
  _viewPreference: Record<string, "flat" | "iso">;
  _virtualLights: VirtualLightSnapshot;
  _visibleDeviceSnapshot: RenderDeviceSnapshot | null;
  _wallDialog: { a: number[]; b: number[]; value: string; roomId: string | null; source: WallThickSource; sx: number; sy: number; } | null;
  _wallFaceBatch: WallFaceBatch | null;
  _wallFaceGraphCache: { key: string; value: WallFaceGraph; }[];
  _wallKeyPitch: number;
  _wallRepairDiagnostic: WallFaceRepairProposal | null;
  _wallThickHover: { segs: number[][]; open: boolean; d: string; } | null;
  _wallUnionCache: { key: string; value: ReturnType<typeof wallBodiesUnionPath>; } | null;
  _wallUnionPool: Map<string, { key: string; value: ReturnType<typeof wallBodiesUnionPath>; }>;
  _writeChain: Promise<void>;
  _writesPending: number;
  _sendConfigCandidate: (candidate: ServerConfig) => Promise<void>;
  _writeConfig: () => Promise<void>;
  _requestMode: (mode: 'view' | 'plan' | 'devices' | 'decor', animate?: boolean) => Promise<void>;
  _checkOptimizeGeometry: (config: ServerConfig) => OptimizeGeometryPreflightResult;
  _checkSpacePhysicalGeometry: (
    config: ServerConfig,
    spaceId: string,
    captureWallGeometry?: (geometry: ReturnType<typeof wallBodiesGeometry>) => void,
  ) => ReturnType<typeof checkSpacePhysicalGeometry>;
  _primeDrawWallField: () => void;
  _reloadRejectedPhysicalWrite: () => Promise<void>;
  _zoom: number;
  _zoomBySpace: Record<string, number>;
  hass: any;
  isConnected: boolean;
  renderRoot: HTMLElement | DocumentFragment;
  requestUpdate: (name?: PropertyKey, oldValue?: unknown) => void;
  updateComplete: Promise<boolean>;
}

/** Lazily loaded implementation of editor-only interaction and rendering. */
export const EDITOR_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export class HouseplanEditorRuntime {
  private _junctionBaselineCache = new WeakMap<object, {
    spaceId: string; fingerprint: string; violations: JunctionLimitViolation[];
  }>();
  private _resizePreviewNodes: MultiWallNodeMap | null = null;
  private _resizeBaselineLimits: JunctionLimitViolation[] = [];
  private _resizeBaseFrameStable = true;
  private _supportExpiryTimer?: number;
  private _supportPreviewGeneration = 0;
  private _decorAssetGuardReplace: boolean | null = null;
  private readonly _decorImages: DecorImageEditor<SpaceGeometryState | null>;

  public constructor(public readonly host: HouseplanEditorHostPort) {
    this._decorImages = new DecorImageEditor(host, {
      decorSnap: (raw, pointerType) => this._decorSnap(raw, pointerType),
      geometrySnapshot: () => this._geometrySnapshot(),
      clearFurniturePreview: () => this._clearFurniturePreview(),
      recordGeometry: (name, before) => this._recordGeometry(name, before),
      saveConfig: () => this._saveConfig(),
      saveShape: () => this._decorSaveShape(),
      setGuardReplace: (replace) => { this._decorAssetGuardReplace = replace; },
      furnShiftDetach: () => this._furnShiftDetach(),
      furnPick: (symbol) => this._furnPick(symbol),
      furnFieldValue: (cm) => this._furnFieldValue(cm),
      furnFieldToCm: (value) => this._furnFieldToCm(value),
    });
    host._editorSecondary = new EditorSecondaryController({
      root: () => host.renderRoot as ShadowRoot,
      requestUpdate: () => host.requestUpdate(),
      updateComplete: () => host.updateComplete,
      clearTip: () => { host._tip = null; },
    });
    host._resize = new ResizeController<
      ResizePreview, ResizeLiveLabel[], SpaceGeometryState, ResizeWallUnion, ResizeWallArtifact
    >();
  }
public _routeLiveEditorUpdate(name?: PropertyKey, oldValue?: unknown): boolean {
    const live = routeHouseplanEditorUpdate(this.host, name, oldValue);
    if (!live && this.host._resize.preview) this._resizeBaseFrameStable = false;
    return live;
  }
public _commitLiveEditor(): void { commitHouseplanEditor(this.host); }
public _disposeLiveEditor(): void { disposeHouseplanEditor(this.host); }
public async _whenLiveEditorSettled(): Promise<void> {
  // An already queued pointer calculation runs before this continuation.
  // A complete Lit render may also supersede the lightweight frame, and its
  // updated() hook commits that same state before updateComplete resolves.
  await this.host.updateComplete;
  await whenHouseplanEditorSettled(this.host);
}
public _queuePointerMove(key: string, run: () => void): void { queueHouseplanPointerMove(this.host, key, run); }
public _flushPointerMove(key: string): void { flushHouseplanPointerMove(this.host, key); }
public _cancelPointerMove(key?: string): void { cancelHouseplanPointerMove(this.host, key); }
public _help(key: Extract<I18nKey, `${string}.help`>): TemplateResult | typeof nothing {
    const ariaKey = `${key}.aria` as I18nKey;
    const lang = langOf(this.host.hass, this.host._config?.language);
    if (!hasTranslation(lang, key) || !hasTranslation(lang, ariaKey)) return nothing;
    return html`<hp-help data-help-key=${key}
      .text=${t(lang, key)} .ariaLabel=${t(lang, ariaKey)}></hp-help>`;
  }

public _setMode(mode: 'view' | 'plan' | 'devices' | 'decor', animate = true): void {
    if (mode !== this.host._mode) this.host._cancelDangerConfirm();
    this.host._endTabDrag();
    this._clearFurniturePreview();
    // A mode command is newer than the editor remembered by a same-route warm
    // remount. Clear it before the same-mode early return: while can_write is
    // pending, Lit may still be presenting the previous editor DOM even though
    // the new instance already fails closed to `view`. Its close button must
    // cancel the deferred editor in one press, not let the server response
    // reopen it and force a second press (#95).
    this.host._pendingNavMode = null;
    const space = this.host._spaceModel();
    if (!space) {
      this.host._cancelModeTransition(false);
      this.host._mode = 'view';
      return;
    }
    if (this.host._kiosk && mode !== 'view') return; // wall devices never edit
    if (this.host._mode === mode) {
      if (!animate && mode === 'view' && this.host._modeTransitionBusy) {
        const from = this.host._currentModeVisual(mode);
        const targetZoom = this.host._modeTransitionTargetZoom;
        const targetCenterX = this.host._modeTransitionTargetCenterX;
        const targetCenterY = this.host._modeTransitionTargetCenterY;
        this.host._cancelModeTransition(false);
        this.host._commitViewModeAtomic(from, targetZoom, targetCenterX, targetCenterY);
      }
      return;
    }
    if (this.host._mode === 'devices') this.host._cancelDeviceDrag();
    this.host._bootSoftCancel(); // navigation owns its own short, bounded transition
    if ((mode === 'plan' || mode === 'decor') && !this.host._norm) {
      this.host._showToast(this.host._t('toast.markup_needs_server'));
      return;
    }
    if (this.host._wallFaceBatch) this._roomDialogCancel();
    if (this.host._mode === 'plan' && this.host._tool === 'draw' && !this._finishWallChain()) return;
    this.host._clearTransientHover(true);
    this.host._cancelDevicePressFeedback();
    const previousMode = this.host._mode;
    const previousProjection = this.host._effectiveProjection();
    const capturedVisual = this.host._currentModeVisual(previousMode);
    const retargeting = this.host._modeTransitionBusy;
    // The target toolbar replaces the old editor markup during the hidden
    // measurement frame. Give that incoming content its own coordinate on the
    // shared controller so editor-to-editor switches do not pop abruptly.
    const fromVisual = capturedVisual && previousMode !== 'view' && mode !== 'view'
      ? { ...capturedVisual, toolbarContentOpacity: this.host._reducedMotion ? 1 : 0.35 }
      : capturedVisual;
    this.host._cancelModeTransition(false);
    this.host._editorSecondary.closeForNavigation();
    // A live decor transform is a transaction. Switching tabs must cancel and
    // restore it, not merely forget its pointer record after the config has
    // already been mutated by move/resize.
    if (this.host._decorMove || this.host._dtDrag || this.host._bdDrag) this._cancelDecorGesture();
    const baseChanges = !space.bg && (mode === 'view') !== (previousMode === 'view');
    // A running/preparing transition has not committed its target to `_zoom`
    // yet. Retarget from the painted frame, but preserve the latest camera
    // intent; otherwise rapid View -> editor A -> editor B resurrects the old
    // View zoom/center and settles somewhere a direct transition never would.
    const returningToEditor = retargeting && previousMode === 'view' && mode !== 'view'
      ? this.host._modeTransitionEditorCamera : null;
    let targetZoom = returningToEditor?.zoom
      ?? (retargeting ? this.host._modeTransitionTargetZoom : this.host._zoom);
    let targetCenterX = returningToEditor
      ? returningToEditor.centerX
      : retargeting ? this.host._modeTransitionTargetCenterX : fromVisual?.viewport.centerX;
    let targetCenterY = returningToEditor
      ? returningToEditor.centerY
      : retargeting ? this.host._modeTransitionTargetCenterY : fromVisual?.viewport.centerY;
    if (previousMode === 'view' && mode !== 'view' && !retargeting) {
      // remember the view-mode viewport: whatever zooming happens inside the
      // editors is a working tool, not what the user wants to see afterwards
      const v = this.host._view;
      this.host._viewModeSnap = {
        space: this.host._space,
        zoom: this.host._zoom,
        cx: v ? this.host._logicalViewCenter(previousProjection)?.x : undefined,
        cy: v ? this.host._logicalViewCenter(previousProjection)?.y : undefined,
      };
      if (previousProjection === 'iso') {
        const logical = this.host._logicalViewCenter('iso');
        targetCenterX = logical?.x;
        targetCenterY = logical?.y;
        this.host._view = null;
        this.host._mode = mode;
        this.host._applyView(this.host._zoom, logical?.x, logical?.y);
      }
      if (baseChanges) {
        targetZoom = 1;
        targetCenterX = undefined;
        targetCenterY = undefined;
      }
    }
    this.host._mode = mode;
    if (previousMode === 'devices' && mode !== 'devices') {
      this.host._showHidden = false;
      this.host._deviceInbox = null;
      this.host._deviceInboxReturn = null;
      this.host._deviceInboxMemo = null;
    }
    this.host._editorChromeMode = mode === 'view' ? previousMode as 'plan' | 'devices' | 'decor' : mode;
    if (mode === 'view') {
      if (previousMode !== 'view' && !retargeting) {
        this.host._modeTransitionEditorCamera = {
          zoom: this.host._zoom,
          centerX: fromVisual?.viewport.centerX,
          centerY: fromVisual?.viewport.centerY,
        };
      }
      const snap = this.host._viewModeSnap;
      // restore the snapshot only for the space it was taken in
      if (snap && snap.space === this.host._space) {
        targetZoom = snap.zoom;
        const targetProjection = this.host._labsIso && this.host._viewPreference[this.host._space] === 'iso'
          ? 'iso' : 'flat';
        const center = snap.cx != null && snap.cy != null && targetProjection === 'iso'
          ? projectPlanPoint([snap.cx, snap.cy], 0) : null;
        targetCenterX = center?.[0] ?? snap.cx;
        targetCenterY = center?.[1] ?? snap.cy;
      } else if (snap) {
        // HP-1543-01: the floor CHANGED inside the editor — the snapshot
        // belongs to the floor the editor was entered from, while _zoom still
        // carries the editor's working zoom for the floor we are exiting on.
        // Dropping the snapshot alone left that editor zoom (say 500%) on
        // screen in view mode. The per-space store was never polluted
        // (_saveZoom is view-only), so the standard centred
        // _restoreZoom() puts back this floor's saved VIEW viewport. Its rAF
        // reads _zoomBySpace, not the snapshot, so the same-tick floor-tab
        // race the view-only guard protects against stays closed.
        targetZoom = this.host._zoomBySpace[this.host._space] || 1;
        targetCenterX = undefined;
        targetCenterY = undefined;
      }
    } else {
      this.host._modeTransitionEditorCamera = {
        zoom: targetZoom, centerX: targetCenterX, centerY: targetCenterY,
      };
    }
    this.host._modeTransitionTargetZoom = targetZoom;
    this.host._modeTransitionTargetCenterX = targetCenterX;
    this.host._modeTransitionTargetCenterY = targetCenterY;
    if (previousProjection === 'iso'
        || (mode === 'view' && this.host._labsIso && this.host._viewPreference[this.host._space] === 'iso')) {
      this.host._modeTransitionForceAtomic = true;
    }
    const request = ++this.host._modeTransitionRequest;
    if (!animate) {
      // The only non-animated caller is route departure; keep the guard local
      // so a future editor caller cannot accidentally use View geometry.
      if (mode === 'view') {
        this.host._commitViewModeAtomic(fromVisual, targetZoom, targetCenterX, targetCenterY);
      }
    } else if (fromVisual) {
      this.host._modeTransitionPreparing = true;
      this.host._modeTransitionVisual = fromVisual;
      this.host._prepareModeTransition(
        request, fromVisual, mode, targetZoom, targetCenterX, targetCenterY,
      );
    } else {
      // A zero-sized stage cannot animate. Keep the functional fallback
      // atomic and publish the exact target as soon as it is measurable.
      this.host._modeTransitionPreparing = false;
      this.host._modeTransitionVisual = null;
      this.host._zoom = targetZoom;
      this.host._view = null;
      requestAnimationFrame(() => {
        if (!this.host.isConnected || request !== this.host._modeTransitionRequest || this.host._mode !== mode) return;
        this.host._applyView(targetZoom, targetCenterX, targetCenterY);
        if (mode === 'view') {
          this.host._viewModeSnap = null;
          this.host._modeTransitionEditorCamera = null;
        }
        this.host.requestUpdate();
      });
    }
    this.host._path = [];
    this._clearPlanSnapHover();
    this._clearOpeningPlacement(true);
    this.host._tool = 'draw';
    this.host._mergeSel = null;
    this.host._mergeDialog = null;
    this.host._splitSel = null;
    this.host._pendingSplit = null;
    this.host._selId = null;
    this.host._physicalSel = null;
    this.host._physicalDialog = null;
    this.host._physicalDrag = null;
    this._rszResetController();
    this.host._tip = null;
    this.host._hoverRoom = null;
    this.host._decorDraft = null;
    this.host._decorSel = null;
    this.host._decorMove = null;
    this.host._backdropDialog = null;
    // Every Background session starts predictably on Select. The image has an
    // explicit tool of its own; only that tool may claim its body or frame.
    this.host._decorTool = 'select';
    this.host._bdDrag = null;
    this.host._dtDrag = null;
    this.host._dtBox = null;
    if (mode === 'plan') this._primeDrawWallField();
    this.host._saveNav();
  }

public _primeDrawWallField(): void {
    if (this.host._drawWallField === null) {
      this.host._drawWallField = cmToField(DRAW_WALL_DEFAULT_CM, this.host._imperial);
    }
  }

public _showPhysicalRange(max = this.host._drawWallMaxCm, min = 0): void {
    this.host._showToast(this.host._t('toast.physical_range', {
      min: cmToField(min, this.host._imperial),
      max: cmToField(max, this.host._imperial),
      unit: this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm'),
    }));
  }

public _mergeSpacePartitions(sp: any, seedIds?: string[]): number {
    const partitions = (sp?.partitions || []) as PartitionCfg[];
    if (partitions.length < 2) return 0;
    const result = mergeCollinearPartitions(partitions, {
      pitch: GRID_STEP_N,
      seedIds,
      geometry: spaceMergeGeometry(sp),
    });
    if (!result.merged) return 0;
    sp.partitions = result.partitions;
    applyOpeningMoves(sp.openings, sp.partitions, result.openingMoves, {
      coordScale: NORM_W, cellCm: this.host._cellCm, gridPitch: this.host._gridPitch,
    });
    return result.merged;
  }

public _finishWallChain(): boolean {
    if (this.host._tool !== 'draw' || this.host._wallFaceBatch || this.host._roomDialog) return true;
    this.host._path = [];
    this.host._activeWallChainId = null;
    this.host._activeWallChainPartitionIds = [];
    this.host._wallChainSegmentCms = [];
    this.host._wallChainRedo = [];
    this.host._closingWallCm = null;
    this._clearPlanSnapHover();
    return true;
  }

public _activateMarkupTool(tool: MarkupTool): void {
    if (tool === this.host._tool) return;
    if (this.host._wallFaceBatch) this._roomDialogCancel();
    if (this.host._tool === 'draw' && !this._finishWallChain()) return;
    else this._cancelPath();
    if (this.host._tool === 'resize') {
      if (this.host._resize.dragging) this._rszCancelDrag();
      else this.host._resize.reset();
    }
    this.host._tool = tool;
    if (tool === 'resize') this.host._resize.selectRoom(null);
    if (tool === 'wallthick') this.host._wallDialog = null;
  }

public _limitReached(kind: 'partition' | 'column'): boolean {
    const sp = this.host._curSpaceCfg as any;
    if (!sp) return true;
    const reached = kind === 'partition'
      ? (sp.partitions || []).length >= MAX_PARTITIONS
      : (sp.wall_columns || []).length >= MAX_WALL_COLUMNS;
    if (reached) this.host._showToast(this.host._t('toast.physical_limit'));
    return reached;
  }

public _svgPoint(ev: MouseEvent): number[] {
    const stage = this.host.renderRoot.querySelector('.stage') as HTMLElement;
    const r = stage.getBoundingClientRect();
    return this.host._screenToVb(ev.clientX - r.left, ev.clientY - r.top);
  }

public _snap(p: number[]): number[] {
    const g = this.host._gridPitch;
    return [clampCanvasR(snapToGrid(p[0], g)), clampCanvasR(snapToGrid(p[1], g))];
  }

public _snapDrawPoint(p: number[], lock45 = false): number[] {
    const anchor = this.host._path[this.host._path.length - 1];
    const candidate = lock45 && anchor
      ? snapSegment45(anchor, p, this.host._gridPitch, SANE_LIMIT)
      : p;
    return this._snap(candidate);
  }

public _planSnapOpeningCuts(space: SpaceModel, openCuts: number[][]): number[][] {
    if (!this.host._openingsR.length) return [];
    const index = this.host._openingWallIndexFor(space, openCuts).value;
    const cuts: number[][] = [];
    for (const input of this.host._roomWallOpeningInputs(this.host._openingsR, space)) {
      const association = resolveOpeningWallAssociation(index, input);
      if (!association.negative && !association.positive) continue;
      const rad = input.angle * Math.PI / 180;
      const dx = Math.cos(rad) * input.length / 2;
      const dy = Math.sin(rad) * input.length / 2;
      cuts.push([input.x - dx, input.y - dy, input.x + dx, input.y + dy]);
    }
    return cuts;
  }

public _planSnapGeometrySnapshot(): { key: string; value: PlanSnapGeometry } {
    const space = this.host._spaceModel();
    if (!space) {
      return { key: `${this.host._space}|empty`, value: { segments: [], endpoints: [] } };
    }
    const key = [
      this.host._space, this.host._cfgEpoch, space.rooms.length, space.partitions.length,
    ].join('|');
    if (this.host._planSnapGeometryCache?.key === key) return this.host._planSnapGeometryCache;
    const zeroCuts = this.host._openCuts();
    const value = buildPlanSnapGeometry({
      space,
      // A zero-thickness wall is still a canonical wall axis and snap target.
      // Only an actual opening removes the presentation interval (#306).
      roomCuts: this._planSnapOpeningCuts(space, zeroCuts),
      partitionCuts: this._partitionOpeningCuts(space),
      epsilon: this.host._gridPitch * 0.0002,
    });
    this.host._planSnapGeometryCache = { key, value };
    return this.host._planSnapGeometryCache;
  }

public _hiddenWallDiagnosticSnapshot(): {
    key: string; value: HiddenWallDiagnosticGeometry;
  } {
    const space = this.host._spaceModel();
    if (!space) {
      return { key: `${this.host._space}|hidden-empty`, value: { segments: [], endpoints: [] } };
    }
    const key = [
      'hidden', this.host._space, this.host._cfgEpoch,
      space.rooms.length, space.partitions.length,
    ].join('|');
    if (this.host._hiddenWallDiagnosticCache?.key === key) {
      return this.host._hiddenWallDiagnosticCache;
    }
    const value = buildHiddenWallDiagnosticGeometry({
      space,
      epsilon: this.host._gridPitch * 0.0002,
    });
    this.host._hiddenWallDiagnosticCache = { key, value };
    return this.host._hiddenWallDiagnosticCache;
  }

public _planStructuralGeometrySnapshot(): { key: string; value: PlanSnapGeometry } {
    const space = this.host._spaceModel();
    if (!space) {
      return { key: `${this.host._space}|structural-empty`, value: { segments: [], endpoints: [] } };
    }
    const key = [
      'structural', this.host._space, this.host._cfgEpoch,
      space.rooms.length, space.partitions.length,
    ].join('|');
    if (this.host._planStructuralGeometryCache?.key === key) {
      return this.host._planStructuralGeometryCache;
    }
    const value = buildPlanSnapGeometry({
      space,
      epsilon: this.host._gridPitch * 0.0002,
    });
    this.host._planStructuralGeometryCache = { key, value };
    return this.host._planStructuralGeometryCache;
  }

public _planSnapContextKey(geometryKey: string): string {
    const first = this.host._path[0];
    const anchor = this.host._path[this.host._path.length - 1];
    return [
      geometryKey, this.host._tool, this.host._path.length,
      first ? `${first[0]},${first[1]}` : '',
      anchor ? `${anchor[0]},${anchor[1]}` : '',
    ].join('|');
  }

public _resolvePlanDrawPoint(
    raw: number[], lock45: boolean,
  ): {
    point: number[]; candidate: PlanSnapCandidate | null;
    conflicts: PlanSnapEndpoint[]; ambiguous: boolean; contextKey: string;
  } {
    const snapshot = this._planSnapGeometrySnapshot();
    const anchor = this.host._path[this.host._path.length - 1];
    const closure = this.host._tool === 'draw' && this.host._path.length >= 3
      ? [{ point: this.host._path[0], key: 'closure:first-point' }]
      : [];
    // Accepted segments are immediately part of the canonical partition graph.
    // Keep their intermediate vertices out of ordinary snapping so the active
    // chain cannot snap onto itself. The first vertex is deliberately omitted:
    // once three points exist it remains the explicit contour-closure target.
    const excludedActivePoints = this.host._path.length > 1
      ? this.host._path.slice(1)
      : anchor ? [anchor] : [];
    const options = {
      tolerance: this._cssPxToRender(12),
      distinguishTolerance: this._cssPxToRender(8),
      gridStep: this.host._gridPitch,
      excludePoints: excludedActivePoints,
      extraEndpoints: closure,
      epsilon: this.host._gridPitch * 0.0002,
    };
    const resolution = lock45 && anchor
      ? resolveStrictPlanSnap(snapshot.value, raw, { ...options, anchor })
      : resolvePlanSnapResult(snapshot.value, raw, options);
    const candidate = resolution.kind === 'resolved' ? resolution.candidate : null;
    const snapped = candidate ? [...candidate.point] : this._snapDrawPoint(raw, lock45);
    const point = anchor ? snapNearAxisEndpoint(anchor, snapped) : snapped;
    // A nearby topology endpoint loses snap ownership when the drafting rule
    // moves the actually persisted point away from it. Preview and click must
    // describe the exact same geometry (#290).
    const effectiveCandidate = candidate && samePoint(point, candidate.point) ? candidate : null;
    return {
      point,
      candidate: effectiveCandidate,
      conflicts: resolution.kind === 'ambiguous' ? resolution.conflicts : [],
      ambiguous: resolution.kind === 'ambiguous',
      contextKey: this._planSnapContextKey(snapshot.key),
    };
  }

public _clearPlanSnapHover(clearCursor = true): void {
    this.host._planSnapHover = null;
    this._syncPlanSnapActiveMarker(null);
    this._syncPlanSnapConflictMarkers([]);
    if (clearCursor) this.host._cursorPt = null;
  }

public _samePt(a: readonly number[], b: readonly number[]): boolean {
    return samePoint(a, b);
  }

public _dropLegacySegments(config = this.host._serverCfg): void {
    // «Ripple only» was removed from the UI: keep old configs readable, then
    // materialise the recognisable icon+activity presentation on any write.
    for (const marker of config?.markers || []) {
      if (marker.display === 'ripple') marker.display = 'icon_ripple';
    }
    for (const sp of config?.spaces || []) {
      delete (sp as any).segments;
      const physicalIds = new Set<string>();
      const validId = (id: any): id is string => typeof id === 'string'
        && id.length >= 1 && id.length <= 64 && !physicalIds.has(id);
      const keepId = (id: string): boolean => { physicalIds.add(id); return true; };
      const point = (p: any): p is number[] => Array.isArray(p) && p.length === 2
        && p.every((v: any) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= CANVAS_LIMIT);
      if (Array.isArray((sp as any).partitions)) {
        (sp as any).partitions = (sp as any).partitions.filter((p: any) =>
          p && validId(p.id) && point(p.a) && point(p.b)
          && Math.hypot(p.a[0] - p.b[0], p.a[1] - p.b[1]) > 1e-9
          && keepId(p.id))
          .map((p: any) => ({
            ...p,
            cm: Number.isFinite(Number(p.cm)) ? Math.max(0, Math.min(100, Number(p.cm))) : 15,
          }));
        if (!(sp as any).partitions.length) delete (sp as any).partitions;
      }
      if (Array.isArray((sp as any).wall_columns)) {
        (sp as any).wall_columns = (sp as any).wall_columns.filter((c: any) =>
          c && validId(c.id) && point(c.center) && keepId(c.id))
          .map((c: any) => ({
            id: c.id, shape: c.shape === 'circle' ? 'circle' : 'square',
            center: [Number(c.center[0]), Number(c.center[1])],
            cm: clampColumnCm(Number(c.cm) || 15),
            ...(c.shape === 'circle' ? {} : { angle: canonicalColumnAngle(c.angle) }),
          }));
        if (!(sp as any).wall_columns.length) delete (sp as any).wall_columns;
      }
      if (Array.isArray(sp.walls)) {
        const model = selectSpaceModelById(spaceModels({ spaces: [sp] } as any), sp.id);
        const cuts = model
          ? resolveZeroWalls(sp, model, NORM_W, GRID_PITCH * 0.02).contour
            .map((cut) => cut.map((value) => value / NORM_W))
          : sanitizeOpenSpans((sp as any).open_spans)
            .map((e) => [e.a[0], e.a[1], e.b[0], e.b[1]]);
        sp.walls = degradeWalls(sp.walls, sp.rooms || [], GRID_STEP_N, 1, cuts);
        if (!sp.walls.length) delete sp.walls;
      }
    }
  }

public _rollbackRejectedPhysicalWrites(
    entries: Array<[string, { fingerprint: string; before: SpaceGeometryState }]>,
  ): boolean {
    if (!this.host._serverCfg || !entries.length) return false;
    let restored = false;
    for (const [spaceId] of entries) {
      const pending = this.host._pendingPhysicalWrites.get(spaceId);
      if (!pending) continue;
      restored = this._restoreGeometryStateInConfig(this.host._serverCfg, pending.before) || restored;
      this.host._pendingPhysicalWrites.delete(spaceId);
    }
    if (!restored) return false;
    this._clearGeometryGesture();
    this.host._geometryHistory.clear();
    this.host._cfgEpoch++;
    this.host._modelCache = null;
    this.host._wallUnionCache = null;
    this.host._physicalBodiesCache = null;
    this.host._frame = null;
    this.host._regSignature = '';
    this.host._cfgContentFingerprint = contentFingerprint(this.host._serverCfg);
    this.host._maybeRebuildDevices();
    this.host.requestUpdate();
    return true;
  }

public async _reloadRejectedPhysicalWrite(): Promise<void> {
    const queued = this.host._writeChain;
    await queued.catch(() => undefined);
    await this.host._reloadConfigOnly(true);
  }

public _prepareConfigCandidate(config: ServerConfig): ServerConfig { this._dropLegacySegments(config); return canonicalizeConfigGeometry(config); }

public _writeConfig(attempt: OptimisticAttempt<ServerConfig> | null = null): Promise<void> {
    this.host._writesPending++;
    this.host._writeChain = enqueueSerializedWrite(this.host._writeChain, async () => {
      if (!this.host._serverCfg) return;
      const liveFingerprint = contentFingerprint(this.host._serverCfg);
      const candidate = this._prepareConfigCandidate(this.host._serverCfg);
      const candidateFingerprint = contentFingerprint(candidate);
      if (attempt && liveFingerprint === attempt.attemptedFingerprint) Object.assign(attempt, { revision: this.host._cfgRev, attempted: candidate, attemptedFingerprint: candidateFingerprint });
      const strictEntries = [...this.host._pendingPhysicalWrites.entries()];
      for (const [spaceId, accepted] of strictEntries) {
        const candidateSpace = candidate.spaces.find((space) => space.id === spaceId);
        const exactFingerprint = spacePhysicalGeometryFingerprint(candidateSpace);
        if (exactFingerprint === accepted.fingerprint) continue;
        let safe = false;
        try { safe = this.host._checkSpacePhysicalGeometry(candidate, spaceId).ok; } catch { safe = false; }
        if (!safe) {
          this._restoreGeometryStateLocal(accepted.before);
          this.host._pendingPhysicalWrites.delete(spaceId);
          this.host._geometryHistory.clear();
          this.host._showToast(this.host._t('toast.geometry_unsafe'));
          throw Object.assign(new Error('unsafe wall geometry'), { code: 'geometry-unsafe' });
        }
        accepted.fingerprint = exactFingerprint;
      }
      // Do not replace the reactive root merely because the pure helper
      // returned a clone. Besides an unnecessary render, that used to expose
      // unrelated write-time cleanup as a visual change (#224 review H1).
      // A real coordinate change still adopts the exact object sent below;
      // willUpdate owns the corresponding geometry-epoch bump.
      if (candidateFingerprint !== contentFingerprint(this.host._serverCfg)) {
        this.host._serverCfg = candidate;
      }
      this.host._cfgContentFingerprint = candidateFingerprint;
      try {
        await this.host._sendConfigCandidate(candidate);
      } catch (error) {
        const rolledBack = this._rollbackRejectedPhysicalWrites(strictEntries);
        if (!rolledBack) throw error;
        // HA normally rejects with an Error-like object, but integrations and
        // test doubles may reject with a string.  Never lose the rollback tag:
        // the caller still has to schedule an authoritative re-read after the
        // synchronous, fail-closed restoration (#314).
        const failure: any = error && typeof error === 'object'
          ? error : Object.assign(new Error(String(error)), { cause: error });
        failure.physicalGeometryRolledBack = true;
        throw failure;
      }
      for (const [spaceId, accepted] of strictEntries) {
        if (this.host._pendingPhysicalWrites.get(spaceId)?.fingerprint === accepted.fingerprint)
          this.host._pendingPhysicalWrites.delete(spaceId);
      }
    });
    const mine = this.host._writeChain.finally(() => { this.host._writesPending--; });
    // keep the chain itself unadorned so the next link waits for the write only
    return mine;
  }

public _saveConfig(): void {
    this.host._cfgEpoch++;
    this.host._saveConfigDebounced();
  }

public _geometrySnapshotFromConfig(config: any, spaceId: string): SpaceGeometryState | null {
    const sp = config?.spaces?.find((s: any) => s.id === spaceId);
    if (!sp) return null;
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const plan_transform: SpaceGeometryState['plan_transform'] = {};
    for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const) {
      if (sp[key] !== undefined) plan_transform[key] = sp[key];
    }
    return {
      spaceId,
      rooms: copy(sp.rooms || []),
      ...(Array.isArray(sp.openings) ? { openings: copy(sp.openings) } : {}),
      ...(Array.isArray(sp.walls) ? { walls: copy(sp.walls) } : {}),
      ...(Array.isArray(sp.wall_segments) ? { wall_segments: copy(sp.wall_segments) } : {}),
      ...(Array.isArray((sp as any).open_spans)
        ? { open_spans: copy((sp as any).open_spans) }
        : {}),
      ...(Array.isArray((sp as any).partitions)
        ? { partitions: copy((sp as any).partitions) }
        : {}),
      ...(Array.isArray((sp as any).wall_columns)
        ? { wall_columns: copy((sp as any).wall_columns) }
        : {}),
      ...(Array.isArray(sp.decor) ? { decor: copy(sp.decor) } : {}),
      plan_transform,
    };
  }

public _geometrySnapshot(spaceId = this.host._space): SpaceGeometryState | null {
    return this._geometrySnapshotFromConfig(this.host._serverCfg, spaceId);
  }

public _recordGeometry(name: string, before: SpaceGeometryState | null): void {
    if (!before) return;
    const after = this._geometrySnapshot(before.spaceId);
    if (!after || JSON.stringify(before) === JSON.stringify(after)) return;
    this.host._geometryHistory.push({ name, before, after });
    this.host.requestUpdate();
  }

public _restoreGeometryStateInConfig(
    config: any, state: SpaceGeometryState, preserveIdentityHints = false,
  ): boolean {
    const sp = config?.spaces?.find((space) => space.id === state.spaceId);
    if (!sp) return false;
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const oldRooms = new Map((sp.rooms || []).map((room) => [room.id, room]));
    sp.rooms = copy(state.rooms);
    if (preserveIdentityHints) {
      for (const room of sp.rooms) {
        const old: any = oldRooms.get(room.id);
        if (!Array.isArray(room.wall_ids) && Array.isArray(old?.wall_ids)
            && old.wall_ids.length === room.poly?.length) room.wall_ids = copy(old.wall_ids);
      }
    }
    const assign = (key: 'openings' | 'walls' | 'wall_segments' | 'open_spans'
      | 'partitions' | 'wall_columns' | 'decor', value: unknown): void => {
      if (value !== undefined) (sp as any)[key] = copy(value);
      else if (!(preserveIdentityHints && key === 'wall_segments')) delete (sp as any)[key];
    };
    const oldOpenings = new Map((sp.openings || []).map((opening: any) => [opening.id, opening]));
    assign('openings', state.openings);
    assign('walls', state.walls);
    assign('wall_segments', state.wall_segments);
    assign('open_spans', state.open_spans);
    assign('partitions', state.partitions);
    assign('wall_columns', state.wall_columns);
    assign('decor', state.decor);
    if (preserveIdentityHints) {
      for (const opening of sp.openings || []) {
        const old: any = oldOpenings.get(opening.id);
        if (!opening.host && old?.host?.kind === 'wall') opening.host = copy(old.host);
      }
    }
    for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const)
      delete (sp as any)[key];
    Object.assign(sp, copy(state.plan_transform || {}));
    return true;
  }

public _restoreGeometryStateLocal(state: SpaceGeometryState): boolean {
    if (!this._restoreGeometryStateInConfig(this.host._serverCfg, state)) return false;
    this.host._cfgEpoch++;
    this.host._modelCache = null;
    this.host._wallUnionCache = null;
    this.host._physicalBodiesCache = null;
    this.host._frame = null;
    this.host.requestUpdate();
    return true;
  }

public _wallModelBlockerLabel(error: unknown): string {
    const reason = error instanceof WallSegmentModelError ? error.reason : 'invalid-room';
    return this.host._t(`wall_model.reason.${reason}`);
  }

public _hasLegacyZeroWallFields(config: any = this.host._serverCfg): boolean {
    return (config?.spaces || []).some((space) => (
      (Array.isArray(space?.open_spans) && space.open_spans.length > 0)
      || (space?.rooms || []).some((room) => (
        Array.isArray(room?.open_to) && room.open_to.length > 0
      ))
    ));
  }

public _showWallModelMigrationBlocked(error: unknown): void {
    const key = this._hasLegacyZeroWallFields()
      ? 'toast.zero_wall_migration_blocked'
      : 'toast.wall_model_migration_blocked';
    this.host._showToast(this.host._t(key, { reason: this._wallModelBlockerLabel(error) }));
  }

public _limitSegmentsOf(space: any): LimitSegment[] {
    const segments: LimitSegment[] = [];
    for (const segment of (space?.wall_segments || [])) {
      if (segment?.a && segment?.b) {
        segments.push({
          id: String(segment.id || ''), a: segment.a, b: segment.b, cm: Number(segment.cm),
        });
      }
    }
    for (const partition of (space?.partitions || [])) {
      if (partition?.a && partition?.b) {
        segments.push({
          id: String(partition.id || ''), a: partition.a, b: partition.b, cm: Number(partition.cm),
        });
      }
    }
    return segments;
  }

public _junctionLimitViolations(
    config: unknown, spaceId: string,
    /** #330 §4.7: an already computed masonry pass of THIS config (e.g. the
     * resize preflight's artifact) — the union is never paid twice. */
    sharedGeometry?: JunctionSharedGeometry | null,
    roomIds?: ReadonlySet<string>,
  ): JunctionLimitViolation[] {
    const space = ((config as { spaces?: Array<{ id?: unknown }> } | null)?.spaces || [])
      .find((item) => item?.id === spaceId);
    return space ? junctionLimitViolations(
      config, spaceId, this._limitSegmentsOf(space), sharedGeometry, roomIds,
    ) : [];
  }

public _junctionLimitLabel(violation: JunctionLimitViolation): string {
    const round = (value: number) => String(Math.round(value * 10) / 10);
    return this.host._t(`junction.limit_${violation.rule}` as I18nKey, {
      actual: round(violation.actual), limit: round(violation.limit),
    });
  }

public _junctionLimitsIntroduced(
    candidate: ServerConfig, previousConfig: ServerConfig, spaceId: string,
    candidateGeometry?: JunctionSharedGeometry | null,
    affectedRoomIds?: readonly string[],
  ): JunctionLimitViolation[] {
    // The baseline must be the previous document AS THE CANDIDATE SEES IT: a
    // legacy space carries no wall catalogue at all, so comparing it raw with
    // a migrated candidate reported every inherited short segment as new and
    // refused legitimate resizes of real plans. Both sides therefore cross
    // the same identity barrier first. Current-version documents are already
    // materialized, while legacy documents cross that barrier once.
    const affected = affectedRoomIds?.length ? new Set(affectedRoomIds) : undefined;
    let inherited: JunctionLimitViolation[] | undefined;
    const previousSpace = (previousConfig.spaces || [])
      .find((space) => space?.id === spaceId);
    let fingerprint = '';
    try { fingerprint = spacePhysicalGeometryFingerprint(previousSpace); }
    catch { fingerprint = ''; }
    const cached = !affected && previousConfig && typeof previousConfig === 'object'
      ? this._junctionBaselineCache.get(previousConfig) : undefined;
    if (cached && fingerprint && cached.fingerprint === fingerprint
        && cached.spaceId === spaceId) {
      inherited = cached.violations;
    }
    if (!inherited) {
      try {
        const baseline = Number(previousConfig?.model_version || 0) >= WALL_SEGMENT_MODEL_VERSION
          ? previousConfig
          : commitWallSegmentModel(previousConfig).config;
        inherited = this.host._junctionLimitViolations(
          baseline, spaceId, affected ? null : undefined, affected,
        );
      } catch {
        // An unmigratable baseline proves nothing about inheritance; never
        // refuse the write on that basis.
        return [];
      }
      if (!affected && previousConfig && typeof previousConfig === 'object' && fingerprint) {
        this._junctionBaselineCache.set(previousConfig, {
          spaceId, fingerprint, violations: inherited,
        });
      }
    }
    let next: JunctionLimitViolation[] = [];
    let comparison = inherited;
    try {
      next = this.host._junctionLimitViolations(candidate, spaceId, candidateGeometry, affected);
      if (affected) comparison = inherited.filter(
        (item) => item.rule !== 'clearance' || affected.has(item.subject),
      );
    }
    catch {
      // #331 §2.5: candidate judgment fails closed; only an unprovable
      // baseline above is allowed to fail open.
      return [{ rule: 'check_failed', subject: spaceId, actual: 0, limit: 0 }];
    }
    return increasedViolations(next, comparison);
  }

public _commitPhysicalGeometry(
    name: string,
    before: SpaceGeometryState | null,
    additionalAuthoredPoints: readonly (readonly number[])[] = [],
  ): boolean {
    if (!before || !this.host._serverCfg) return false;
    const liveCandidate = this.host._serverCfg;
    const editedState = this._geometrySnapshotFromConfig(liveCandidate, before.spaceId);
    const liveSpace = liveCandidate.spaces.find((space) => space.id === before.spaceId);
    if (!liveSpace || spacePhysicalGeometryFingerprint(before)
        === spacePhysicalGeometryFingerprint(liveSpace)) return false;
    // Preserve #278's existing fail-closed guard. Identity materialisation may
    // repair/atomise a degraded legacy projection, but it must never be used to
    // make an otherwise rejected user edit look safe.
    let legacySafe = false;
    try { legacySafe = this.host._checkSpacePhysicalGeometry(liveCandidate, before.spaceId).ok; }
    catch { legacySafe = false; }
    if (!legacySafe) {
      this._clearGeometryGesture();
      this._restoreGeometryStateLocal(before);
      this.host._showToast(this.host._t('toast.geometry_unsafe'));
      return false;
    }
    let committedCandidate: any;
    let historyBefore = before;
    try {
      // ADR 282 Stage 1: every structural writer crosses the same atomic
      // canonicalisation/identity barrier.  The pure candidate is adopted only
      // after every space migrated successfully, so a blocker leaves the live
      // config byte-equivalent.
      if (Number(liveCandidate.model_version || 0) < 9) {
        // The first edit of a pre-v9 document must derive identity and legacy
        // zero-wall projection from the pre-edit carrier, not from its already
        // moved/split coordinates.
        // Materialise that baseline locally, then replay the edited legacy
        // projection over it so lineage and Undo share the same stable IDs.
        const baselineSource = JSON.parse(JSON.stringify(liveCandidate));
        if (!this._restoreGeometryStateInConfig(baselineSource, before))
          throw new WallSegmentModelError('invalid-room', before.spaceId);
        const baseline = commitWallSegmentModel(baselineSource).config;
        historyBefore = this._geometrySnapshotFromConfig(baseline, before.spaceId) || before;
        const editedWithIdentity = JSON.parse(JSON.stringify(baseline));
        if (!editedState || !this._restoreGeometryStateInConfig(
          editedWithIdentity, editedState, true,
        )) throw new WallSegmentModelError('invalid-room', before.spaceId);
        const baselineSpace = baseline.spaces.find((space) => space.id === before.spaceId);
        const editedSpace = editedWithIdentity.spaces.find((space) => space.id === before.spaceId);
        // A fixed-topology pre-catalogue edit expresses thickness through the
        // legacy `walls[]` projection. Replay it onto the baseline catalogue
        // before v9 treats `cm` as authoritative. Geometry-changing writers
        // instead rely on lineage: projecting moved walls onto old baseline
        // coordinates would incorrectly turn the moved atom into zero.
        if (!Array.isArray(editedState.wall_segments)
            && JSON.stringify(before.rooms) === JSON.stringify(editedState.rooms)) {
          for (const segment of editedSpace?.wall_segments || []) {
            segment.cm = thicknessCmAt(
              editedState.walls, segment.a, segment.b, GRID_STEP_N, 1,
            );
          }
        }
        const lineageHints = fixedTopologyWallLineageHints(
          baselineSpace, before.rooms, editedSpace,
        );
        committedCandidate = commitWallSegmentModel(editedWithIdentity, {
          lineageHints, lineageSpaceId: before.spaceId,
        }).config;
      } else committedCandidate = commitWallSegmentModel(liveCandidate).config;
    } catch (error) {
      this._clearGeometryGesture();
      this._restoreGeometryStateLocal(before);
      this._showWallModelMigrationBlocked(error);
      return false;
    }
    let safe = false;
    try {
      const afterSpace = committedCandidate.spaces.find((space) => space.id === before.spaceId);
      // A completed point of the active, grid-snapped chain is authored input.
      // Include the session carrier in the growth baseline so later conversion
      // from partitions to room masonry does not count it as newly derived.
      const authoredPoints = this.host._path.length >= 2
        ? this.host._path.map((point) => [point[0] / NORM_W, point[1] / NORM_W])
        : [];
      authoredPoints.push(...additionalAuthoredPoints.map((point) => [point[0], point[1]]));
      safe = wallModelOffGridValueCount(afterSpace)
        <= wallModelOffGridValueCount(historyBefore, authoredPoints)
        && this.host._checkSpacePhysicalGeometry(committedCandidate, before.spaceId).ok;
    } catch {
      safe = false;
    }
    if (!safe) {
      this._clearGeometryGesture();
      this._restoreGeometryStateLocal(before);
      this.host._showToast(this.host._t('toast.geometry_unsafe'));
      return false;
    }
    // #329: the owner's junction limits refuse the WRITE. An existing plan's
    // inherited violations are never re-judged (spec §3), so the candidate is
    // compared against the pre-edit document.
    const beforeConfig = JSON.parse(JSON.stringify(liveCandidate));
    this._restoreGeometryStateInConfig(beforeConfig, before);
    const introduced = this._junctionLimitsIntroduced(
      committedCandidate, beforeConfig, before.spaceId,
    );
    if (introduced.length) {
      this._clearGeometryGesture();
      this._restoreGeometryStateLocal(before);
      this.host._showToast(this._junctionLimitLabel(introduced[0]));
      return false;
    }
    adoptWallSegmentModelCandidateInPlace(liveCandidate, committedCandidate);
    this._recordGeometry(name, historyBefore);
    const afterSpace = liveCandidate.spaces.find((space) => space.id === before.spaceId);
    const pending = this.host._pendingPhysicalWrites.get(before.spaceId);
    this.host._pendingPhysicalWrites.set(before.spaceId, {
      before: pending?.before || historyBefore,
      fingerprint: spacePhysicalGeometryFingerprint(afterSpace),
    });
    this._saveConfig();
    return true;
  }

public _clearGeometryGesture(): void {
    this._clearFurniturePreview();
    this.host._path = [];
    this._clearPlanSnapHover();
    this._clearOpeningPlacement(false);
    this.host._mergeSel = null;
    this.host._mergeDialog = null;
    this.host._splitSel = null;
    this.host._pendingSplit = null;
    this.host._wallFaceBatch = null;
    this.host._wallRepairDiagnostic = null;
    this.host._roomDeleteDialog = null;
    this.host._wallDialog = null;
    this.host._physicalDialog = null;
    this.host._physicalSel = null;
    this.host._physicalDrag = null;
    this.host._physicalRotate = null;
    this.host._activeWallChainId = null;
    this.host._activeWallChainPartitionIds = [];
    this.host._wallChainSegmentCms = [];
    this.host._wallChainRedo = [];
    this.host._closingWallCm = null;
    this.host._openingDialog = null;
    this._rszResetController();
    this.host._decorDraft = null;
    this.host._decorMove = null;
    this.host._dtDrag = null;
    this.host._bdDrag = null;
  }

public _stagePointerCancel(ev: PointerEvent): void {
    clearTimeout(this.host._kioskHoldTimer);
    if (this.host._swipeStart?.id === ev.pointerId) this.host._swipeStart = null;
    if (this.host._furnTouchPending?.pid === ev.pointerId) {
      this._clearFurniturePreview();
      this.host._pointers.delete(ev.pointerId);
      this.host.requestUpdate();
      return;
    }
    if (this.host._physicalDrag?.pid === ev.pointerId || this.host._physicalRotate?.pid === ev.pointerId) {
      this._cancelPhysicalGesture();
      return;
    }
    if (this.host._decorDraft?.pid === ev.pointerId) {
      this.host._decorDraft = null;
      this.host.requestUpdate();
      return;
    }
    if (this.host._decorMove?.pid === ev.pointerId || this.host._dtDrag?.pid === ev.pointerId
        || this.host._bdDrag?.pid === ev.pointerId) {
      this._cancelDecorGesture();
      return;
    }
    if (this.host._tool === 'opening') {
      this.host._cursorPt = null;
      this._clearOpeningPlacement(false);
    } else if (this.host._tool === 'draw') {
      this._clearPlanSnapHover();
    }
    this.host._pointers.delete(ev.pointerId);
    if (this.host._pointers.size < 2) this.host._pinchStart = null;
    if (this.host._pointers.size === 0) {
      this.host._panStart = null;
      this.host._panLock = null;
    }
    if (this.host._viewportGestureDirty && this.host._pointers.size === 0) {
      this.host._viewportGestureDirty = false;
      this.host.requestUpdate();
    }
  }

public _applyGeometryState(
    state: SpaceGeometryState, allowHistoryBoundaryRepair = false,
  ): boolean {
    if (!this.host._canCommitSpace(state.spaceId)) return false;
    const before = this._geometrySnapshot(state.spaceId);
    if (!before || !this._restoreGeometryStateLocal(state)) return false;
    const restoredCandidate = this.host._serverCfg;
    const physicalChanged = spacePhysicalGeometryFingerprint(before)
      !== spacePhysicalGeometryFingerprint(state);
    if (physicalChanged) {
      let safe = false;
      try {
        const check = restoredCandidate
          ? this.host._checkSpacePhysicalGeometry(restoredCandidate, state.spaceId)
          : null;
        safe = !!check?.ok || !!(allowHistoryBoundaryRepair
          && check?.reason === 'wall-degraded-extra');
      } catch { safe = false; }
      if (!safe) {
        this._restoreGeometryStateLocal(before);
        this.host._showToast(this.host._t('toast.geometry_unsafe'));
        return false;
      }
    }
    let committedCandidate: any;
    try {
      committedCandidate = commitWallSegmentModel(restoredCandidate).config;
    } catch (error) {
      this._restoreGeometryStateLocal(before);
      this._showWallModelMigrationBlocked(error);
      return false;
    }
    if (physicalChanged) {
      let safe = false;
      try {
        const check = committedCandidate
          ? this.host._checkSpacePhysicalGeometry(committedCandidate, state.spaceId)
          : null;
        // A history snapshot can predate the write-time wall degradation that
        // canonicalized its command. Restore that one repairable baseline so
        // Undo remains byte-exact immediately; _writeConfig still degrades and
        // strictly validates the outbound candidate before it can leave the
        // card. Every other preflight failure stays fail-closed.
        safe = !!check?.ok || !!(allowHistoryBoundaryRepair
          && check?.reason === 'wall-degraded-extra');
      } catch { safe = false; }
      if (!safe) {
        this._restoreGeometryStateLocal(before);
        this.host._showToast(this.host._t('toast.geometry_unsafe'));
        return false;
      }
      adoptWallSegmentModelCandidateInPlace(restoredCandidate, committedCandidate);
      const afterSpace = restoredCandidate?.spaces.find((space) => space.id === state.spaceId);
      const pending = this.host._pendingPhysicalWrites.get(state.spaceId);
      this.host._pendingPhysicalWrites.set(state.spaceId, {
        before: pending?.before || before,
        fingerprint: spacePhysicalGeometryFingerprint(afterSpace),
      });
    } else adoptWallSegmentModelCandidateInPlace(restoredCandidate, committedCandidate);
    this._clearGeometryGesture();
    if (this.host._space !== state.spaceId) {
      this.host._commitSpace(state.spaceId);
      this.host._saveNav();
      this.host._restoreZoom();
    }
    this.host._modelCache = null;
    this.host._frame = null;
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    this._saveConfig();
    this.host.requestUpdate();
    return true;
  }

public _undoGeometry = (): void => {
    if (this.host._physicalDrag || this.host._physicalRotate) {
      this._cancelPhysicalGesture();
      return;
    }
    if (this.host._decorDraft) { this.host._decorDraft = null; this.host.requestUpdate(); return; }
    if (this.host._decorMove || this.host._dtDrag || this.host._bdDrag) {
      this._cancelDecorGesture();
      return;
    }
    if (this.host._resize.dragging) { this._rszCancelDrag(); return; }
    const command = this.host._geometryHistory.undo();
    if (!command) return;
    if (!this._applyGeometryState(command.before, true)) {
      this.host._geometryHistory.clear();
      return;
    }
    this.host._showToast(this.host._t('history.undone', { name: command.name }));
  };

public _redoGeometry = (): void => {
    // Redo and Undo share the same transaction boundary. The first invocation
    // cancels an in-progress transform; only the next one navigates history.
    if (this.host._physicalDrag || this.host._physicalRotate) {
      this._cancelPhysicalGesture();
      return;
    }
    if (this.host._decorDraft) { this.host._decorDraft = null; this.host.requestUpdate(); return; }
    if (this.host._decorMove || this.host._dtDrag || this.host._bdDrag) {
      this._cancelDecorGesture();
      return;
    }
    if (this.host._resize.dragging) { this._rszCancelDrag(); return; }
    if (this.host._activeWallChainId && this.host._wallChainRedo.length) {
      const chainId = this.host._activeWallChainId;
      const path = this.host._path.map((point) => [...point]);
      const ids = [...this.host._activeWallChainPartitionIds];
      const cms = [...this.host._wallChainSegmentCms];
      const redo = [...this.host._wallChainRedo];
      const terminal = redo[redo.length - 1];
      const command = this.host._geometryHistory.redo();
      if (!command) return;
      if (!this._applyGeometryState(command.after, true)) {
        this.host._geometryHistory.clear();
        return;
      }
      this.host._activeWallChainId = chainId;
      this.host._path = [...path, [...terminal.point]];
      this.host._activeWallChainPartitionIds = [...ids, terminal.id];
      this.host._wallChainSegmentCms = [...cms, terminal.cm];
      this.host._wallChainRedo = redo.slice(0, -1);
      this._clearPlanSnapHover();
      this.host._showToast(this.host._t('history.redone', { name: command.name }));
      return;
    }
    const command = this.host._geometryHistory.redo();
    if (!command) return;
    if (!this._applyGeometryState(command.after, true)) {
      this.host._geometryHistory.clear();
      return;
    }
    this.host._showToast(this.host._t('history.redone', { name: command.name }));
  };

public _roomAt(p: number[]): RoomCfg | undefined {
    return this.host._spaceModel()?.rooms.find((r) => {
      const poly = roomPoly(r);
      return !!poly && pointStrictlyInside(p, poly);
    });
  }

public _overlapRoom(verts: number[][]): RoomCfg | undefined {
    return this.host._spaceModel()?.rooms.find((r) => {
      const poly = roomPoly(r);
      return !!poly && roomsOverlap(verts, poly);
    });
  }

public _pointInRoom(p: number[], r: RoomCfg): boolean {
    if (r.poly) return pointInPolygon(p, r.poly);
    return (
      r.x != null && p[0] >= r.x! && p[0] <= r.x! + r.w! && p[1] >= r.y! && p[1] <= r.y! + r.h!
    );
  }

public _contourSelfIntersects(poly: number[][]): boolean {
    if (!polyIsSimple(poly)) return true; // transverse crossings
    const n = poly.length;
    const eps = 0.001;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        // Neighbours deliberately share one endpoint, including first ↔ last.
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        const c = poly[j], d = poly[(j + 1) % n];
        const cd = [c[0], c[1], d[0], d[1]];
        const ab = [a[0], a[1], b[0], b[1]];
        // This also catches a closing edge passing through an older vertex and
        // collinear overlap, which a proper-crossing test intentionally omits.
        if (distToSegment(a, cd) <= eps || distToSegment(b, cd) <= eps ||
            distToSegment(c, ab) <= eps || distToSegment(d, ab) <= eps) return true;
      }
    }
    return false;
  }

public _canAppendWallPoint(): boolean {
    if (this.host._drawWallCm == null) { this._showPhysicalRange(100); return false; }
    if (this.host._path.length >= MAX_WALL_CHAIN_POINTS) {
      this.host._showToast(this.host._t('toast.physical_limit'));
      return false;
    }
    const spCfg = this.host._curSpaceCfg as any;
    if ((spCfg?.partitions || []).length >= MAX_PARTITIONS) {
      this.host._showToast(this.host._t('toast.physical_limit'));
      return false;
    }
    return true;
  }

public _markupClick(ev: MouseEvent): void {
    if (this.host._vacFit) return; // the fit overlay owns all pointer input
    if (!this.host._markup) return;
    const space = this.host._spaceModel();
    if (!space) {
      this._clearGeometryGesture();
      return;
    }
    // a pan or pinch just happened — the synthesized click is not a draw
    if (this.host._suppressClick) return;
    // Room cards swallow markup clicks: dragging, resizing or just clicking a
    // card must not feed the active tool (draw point, delete room, merge/split
    // pick, opening placement). The drag itself already stops pointer events,
    // but the synthesized `click` afterwards still bubbles to the stage.
    if (this.host._drag || this.host._rlResize) return;
    const path = (ev.composedPath?.() || []) as any[];
    if (path.some((n) => n?.classList?.contains?.('roomlabel') || n?.classList?.contains?.('rlhandle'))) return;
    if (path.some((n) => n?.classList?.contains?.('physical-hit'))) return;
    const raw = this._svgPoint(ev);
    if (this.host._tool === 'select') {
      this.host._physicalSel = null;
      return;
    }
    if (this.host._tool === 'resize') {
      // a click picks the room for the scale frame; handle drags never get here
      if (this.host._resize.dragging || path.some((n) => n?.classList?.contains?.('rszhandle'))) return;
      const room = [...space.rooms].reverse().find((r) => this._pointInRoom(raw, r));
      this.host._resize.selectRoom(room?.id || null);
      this.host.requestUpdate();
      return;
    }
    if (this.host._tool === 'delroom') {
      this._deleteRoomClick(raw);
      return;
    }
    if (this.host._tool === 'opening') {
      this._openingClick(raw);
      return;
    }
    if (this.host._tool === 'merge') {
      this._mergeClick(raw);
      return;
    }
    if (this.host._tool === 'wallthick') {
      this._wallThickClick(raw);
      return;
    }
    if (this.host._tool === 'split') {
      this._splitClick(raw);
      return;
    }
    if (this.host._tool === 'column') {
      this._columnClick(raw);
      return;
    }
    // Walls: every completed segment is immediately an ordinary independent wall.
    this.host._wallRepairDiagnostic = null;
    const resolved = this._resolvePlanDrawPoint(raw, ev.shiftKey);
    if (resolved.ambiguous) {
      this.host._planSnapHover = {
        contextKey: resolved.contextKey, candidate: null, conflicts: resolved.conflicts,
      };
      this._syncPlanSnapActiveMarker(null);
      this._syncPlanSnapConflictMarkers(resolved.conflicts);
      this.host._showToast(this.host._t('toast.plan_snap_ambiguous'));
      return;
    }
    let pt = resolved.point;
    if (ev.ctrlKey || ev.metaKey) {
      // The closure shortcut owns the gesture even before the chain has the
      // two existing edges required to form a room. Falling through here
      // would turn a refused Ctrl/Cmd+click into an ordinary drawing click.
      ev.preventDefault();
      if (this.host._path.length < 3) return;
      // Preserve the established shortcut, but commit its closing wall through
      // the same graph/draft path as an ordinary click on the first node.
      pt = snapNearAxisEndpoint(
        this.host._path[this.host._path.length - 1], this.host._path[0],
      );
    }
    // Island rooms (v1.34.0): drawing INSIDE an existing room is legal — the
    // contour may become a nested room (a column, an inner room). Partial
    // overlaps are still rejected, but only at closing time, when the whole
    // outline is known (roomsOverlap treats full nesting as legal).
    if (!this.host._path.length) {
      // A free idle click can name a room inside masonry that was completed in
      // an earlier session. Shift and architectural snap hits retain the Walls
      // gesture, so this offer never steals an intentional new chain.
      if (!ev.shiftKey && !resolved.candidate && this._offerExistingWallFace(raw)) return;
      this.host._activeWallChainId = `chain-${Date.now().toString(36)}`;
      this.host._activeWallChainPartitionIds = [];
      this.host._wallChainSegmentCms = [];
      this.host._wallChainRedo = [];
      this.host._path = [pt];
      return;
    }
    const last = this.host._path[this.host._path.length - 1];
    if (this._samePt(pt, last)) return; // repeated click on the same point
    if (!this._canAppendWallPoint()) return;
    const cm = this.host._drawWallCm;
    if (cm == null) { this._showPhysicalRange(100); return; }
    const sp = this.host._curSpaceCfg as any;
    if (!sp) return;
    const beforePath = this.host._path.map((point) => [...point]);
    const beforeChainId = this.host._activeWallChainId;
    const beforeIds = [...this.host._activeWallChainPartitionIds];
    const beforeCms = [...this.host._wallChainSegmentCms];
    const beforeGraphSources = this._wallGraphSources([]);
    const before = this._geometrySnapshot();
    const id = `partition-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
    sp.partitions ||= [];
    sp.partitions.push({
      id,
      a: [last[0] / NORM_W, last[1] / NORM_W],
      b: [pt[0] / NORM_W, pt[1] / NORM_W],
      cm,
    });
    this.host._path = [...this.host._path, pt];
    this.host._wallChainSegmentCms = [...this.host._wallChainSegmentCms, cm];
    this.host._activeWallChainPartitionIds = [...beforeIds, id];
    this.host._wallChainRedo = [];
    if (!commitWallChainSegmentGeometry(this, this.host._t('history.wall_segment'), before)) {
      this.host._activeWallChainId = beforeChainId;
      this.host._activeWallChainPartitionIds = beforeIds;
      this.host._path = beforePath;
      this.host._wallChainSegmentCms = beforeCms;
      return;
    }
    this._offerWallFaces(beforePath, beforePath.length - 1, beforeGraphSources);
  }


public _activeWallSourceKey(index: number): string {
    const id = this.host._activeWallChainPartitionIds[index];
    const segment = id
      ? this._planStructuralGeometrySnapshot().value.segments.find((item) => (
        item.sourceKind === 'partition' && item.sourceId === id
      ))
      : null;
    return segment ? `static:${segment.key}` : `active:${this.host._activeWallChainId || 'session'}:${index}`;
  }

public _wallGraphSources(_path: readonly (readonly number[])[]): WallGraphSourceSegment[] {
    const staticGeometry = this._planStructuralGeometrySnapshot().value;
    return staticGeometry.segments.map((segment) => ({
      a: segment.a, b: segment.b, key: `static:${segment.key}`,
    }));
  }

public _wallFaceGraph(
    sources: readonly WallGraphSourceSegment[], epsilon: number,
  ): WallFaceGraph {
    // Exact JSON identity avoids stale topology. Source keys include real
    // open-span cuts/provenance; presentation opening cuts are intentionally
    // absent from the structural graph (#185).
    const key = `${this.host._space}|${epsilon}|${JSON.stringify(sources)}`;
    const cachedIndex = this.host._wallFaceGraphCache.findIndex((entry) => entry.key === key);
    if (cachedIndex >= 0) {
      const [cached] = this.host._wallFaceGraphCache.splice(cachedIndex, 1);
      this.host._wallFaceGraphCache.push(cached);
      return cached.value;
    }
    const value = buildWallFaceGraph(sources, epsilon);
    this.host._wallFaceGraphCache.push({ key, value });
    if (this.host._wallFaceGraphCache.length > 4) this.host._wallFaceGraphCache.shift();
    return value;
  }

public _offerWallFaces(
    beforePath: number[][],
    addedSegmentIndex = this.host._path.length - 2,
    beforeGraphSources?: WallGraphSourceSegment[],
  ): void {
    if (this.host._path.length < 2 || this.host._wallFaceBatch || this.host._roomDialog) return;
    const space = this.host._spaceModel();
    if (!space) return;
    const addedSourceKey = this._activeWallSourceKey(addedSegmentIndex);
    const epsilon = this.host._gridPitch * 0.0002;
    let faces: WallGraphFace[];
    let after: WallGraphSourceSegment[];
    try {
      const before = beforeGraphSources || this._wallGraphSources(beforePath);
      after = this._wallGraphSources(this.host._path);
      faces = findNewWallFacesInGraphs(
        this._wallFaceGraph(before, epsilon), this._wallFaceGraph(after, epsilon),
        addedSourceKey,
      );
    } catch {
      // Topology is advisory. The just-persisted draft remains the source of
      // truth and drawing can continue when malformed legacy geometry exists.
      return;
    }
    if (!faces.length) {
      const repair = planWallFaceRepair(after, {
        requiredSourceKey: addedSourceKey,
        maxDistance: wallCmToUnits(2, this.host._cellCm, this.host._gridPitch),
        gridStep: this.host._gridPitch,
        epsilon,
      });
      if (repair.kind === 'ambiguous') {
        this.host._wallRepairDiagnostic = repair.proposals[0] || null;
        this.host._showToast(this.host._t(
          this.host._drawWallCm === 0 ? 'toast.zero_wall_ambiguous' : 'toast.wall_repair_ambiguous',
        ));
        return;
      }
      if (repair.kind === 'repair' && !this._overlapRoom(repair.face.ring)) {
        this._beginWallFaceBatch([{ ...repair.face, repair: repair.proposal }]);
      }
      return;
    }

    // A clean wall-to-wall cut is one product decision about the smaller part,
    // even though the planar delta contains both resulting faces.
    for (const room of space.rooms) {
      const poly = roomPoly(room);
      if (!room.id || !poly) continue;
      const parts = splitRoomPath(poly, this.host._path, this.host._gridPitch * 0.02);
      if (!parts) continue;
      const [p1, p2] = parts;
      const main = polygonArea(p1) >= polygonArea(p2) ? p1 : p2;
      const fresh = main === p1 ? p2 : p1;
      const matched = [...faces].sort((left, right) =>
        Math.abs(left.area - polygonArea(fresh)) - Math.abs(right.area - polygonArea(fresh))
        || left.key.localeCompare(right.key))[0];
      if (!matched) return;
      this._beginWallFaceBatch([{
        ...matched,
        ring: fresh.map((point) => [point[0], point[1]] as [number, number]),
        split: { roomId: room.id, mainPoly: main, newPoly: fresh },
        consumeAllActive: true,
      }]);
      return;
    }

    const eligible = faces.filter((face) => {
      if (face.ring.length < 3 || this._contourSelfIntersects(face.ring)) return false;
      // roomsOverlap rejects exact duplicates and partial overlap, while full
      // nesting in either direction deliberately remains eligible.
      return !this._overlapRoom(face.ring);
    });
    if (eligible.length) this._beginWallFaceBatch(eligible);
  }

public _beginWallFaceBatch(candidates: WallFaceCandidate[]): void {
    this.host._wallRepairDiagnostic = null;
    this.host._wallFaceBatch = {
      candidates: [...candidates].sort((left, right) =>
        left.area - right.area || left.key.localeCompare(right.key)),
      index: 0,
      decisions: [],
      activePath: this.host._path.map((point) => [...point]),
      activeCms: [...this.host._wallChainSegmentCms],
      activePartitionIds: [...this.host._activeWallChainPartitionIds],
    };
    this._clearPlanSnapHover();
    this.host._nameSel = '';
    this.host._areaSel = '';
    this._resetRoomDialogFields();
    this.host._roomDialog = true;
  }

public _offerExistingWallFace(raw: number[]): boolean {
    if (this.host._path.length || this.host._wallFaceBatch || this.host._roomDialog) return false;
    const epsilon = this.host._gridPitch * 0.0002;
    try {
      const graph = this._wallFaceGraph(this._wallGraphSources([]), epsilon);
      let face = findWallFaceAtPoint(graph, raw, epsilon);
      let repair: WallFaceRepairProposal | undefined;
      if (!face) {
        const result = planWallFaceRepair(this._wallGraphSources([]), {
          point: raw,
          maxDistance: wallCmToUnits(2, this.host._cellCm, this.host._gridPitch),
          gridStep: this.host._gridPitch,
          epsilon,
        });
        if (result.kind === 'ambiguous') {
          this.host._wallRepairDiagnostic = result.proposals[0] || null;
          this.host._showToast(this.host._t(
            this.host._drawWallCm === 0 ? 'toast.zero_wall_ambiguous' : 'toast.wall_repair_ambiguous',
          ));
          return true;
        }
        if (result.kind === 'repair') {
          face = result.face;
          repair = result.proposal;
        } else if (result.kind === 'none') {
          const diagnostic = planWallFaceRepair(this._wallGraphSources([]), {
            point: raw,
            maxDistance: this._cssPxToRender(12),
            gridStep: this.host._gridPitch,
            epsilon,
          });
          if (diagnostic.kind === 'repair') {
            this.host._wallRepairDiagnostic = diagnostic.proposal;
            this.host._showToast(this.host._t('toast.wall_repair_too_large'));
            return true;
          }
        }
      }
      if (!face || face.ring.length < 3 || this._contourSelfIntersects(face.ring)
          || this._overlapRoom(face.ring)) return false;
      this._beginWallFaceBatch([{ ...face, existing: !repair, repair }]);
      return true;
    } catch {
      return false;
    }
  }

public _columnClick(raw: number[]): void {
    const center = this._snap(raw);
    const cm = this.host._drawWallCm;
    if (cm == null) { this._showPhysicalRange(COLUMN_MAX_CM, 1); return; }
    if (!this.host._curSpaceCfg || this._limitReached('column')) return;
    const model = this.host._spaceModel();
    if (!model) return;
    const candidate: WallColumnCfg = {
      id: 'column-' + Date.now().toString(36), shape: 'square', center, cm: clampColumnCm(cm), angle: 0,
    };
    const duplicate = (model.wall_columns || []).find((c) =>
      sameColumnPlacement(c, candidate, this.host._gridPitch * 0.02));
    if (duplicate) {
      clearTimeout(this.host._duplicateColumnTimer);
      this.host._duplicateColumnId = duplicate.id;
      this.host._duplicateColumnTimer = window.setTimeout(() => {
        this.host._duplicateColumnId = null;
      }, 900);
      this.host._showToast(this.host._t('toast.column_duplicate'));
      return;
    }
    const before = this._geometrySnapshot();
    const sp = this.host._curSpaceCfg as any;
    sp.wall_columns ||= [];
    sp.wall_columns.push({ ...candidate, center: [center[0] / NORM_W, center[1] / NORM_W] });
    this._commitPhysicalGeometry(this.host._t('history.column_add'), before);
  }

public _openPhysicalDialog(
    kind: 'partition' | 'column', id: string,
  ): void {
    const model = this.host._spaceModel();
    if (!model) return;
    if (kind === 'partition') {
      const p = model.partitions.find((x) => x.id === id);
      if (p) this.host._physicalDialog = {
        kind, id, cm: cmToField(p.cm, this.host._imperial), length: this.host._fmtLen(p.a, p.b),
      };
    } else if (kind === 'column') {
      const c = model.wall_columns.find((x) => x.id === id);
      if (c) this.host._physicalDialog = {
        kind, id, cm: cmToField(c.cm, this.host._imperial), shape: c.shape,
        angle: this.host._angleField(c.shape === 'square' ? canonicalColumnAngle(c.angle) : 0),
      };
    }
  }

public _savePhysicalDialog = (): void => {
    const d = this.host._physicalDialog;
    const sp = this.host._curSpaceCfg as any;
    const model = this.host._spaceModel();
    if (!d || !sp || !model) return;
    const raw = strictNumber(d.cm);
    if (raw == null) {
      this._showPhysicalRange(
        d.kind === 'column' ? COLUMN_MAX_CM : 100, d.kind === 'column' ? 1 : 0,
      );
      return;
    }
    const cmRaw = this.host._imperial ? raw * 2.54 : raw;
    const max = d.kind === 'column' ? COLUMN_MAX_CM : 100;
    const min = d.kind === 'column' ? 1 : 0;
    if (!Number.isFinite(cmRaw) || cmRaw < min || cmRaw > max) {
      this._showPhysicalRange(max, min);
      return;
    }
    if (d.kind === 'column') {
      const current = model.wall_columns.find((x) => x.id === d.id);
      if (!current) return;
      const rawAngle = strictNumber(d.angle || '0');
      if (d.shape !== 'circle'
          && (rawAngle == null || rawAngle < 0 || rawAngle >= 90)) {
        this.host._showToast(this.host._t('toast.physical_angle'));
        return;
      }
      const candidate: WallColumnCfg = d.shape === 'circle'
        ? { id: d.id, shape: 'circle', center: current.center, cm: cmRaw }
        : { id: d.id, shape: 'square', center: current.center, cm: cmRaw,
            angle: rawAngle! };
      if (model.wall_columns.some((c) => c.id !== d.id
          && sameColumnPlacement(c, candidate, this.host._gridPitch * 0.02))) {
        this.host._showToast(this.host._t('toast.column_duplicate'));
        return;
      }
    }
    const before = this._geometrySnapshot();
    if (d.kind === 'partition') {
      const p = (sp.partitions || []).find((x: any) => x.id === d.id);
      if (p && cmRaw === 0 && zeroWallHasOpening(sp.openings, {
        kind: 'partition', id: d.id,
      })) {
        this.host._showToast(this.host._t('toast.zero_wall_opening_conflict'));
        return;
      }
      if (p) p.cm = cmRaw;
    } else if (d.kind === 'column') {
      const c = (sp.wall_columns || []).find((x: any) => x.id === d.id);
      if (c) {
        c.cm = clampColumnCm(cmRaw);
        c.shape = d.shape === 'circle' ? 'circle' : 'square';
        if (c.shape === 'square') c.angle = strictNumber(d.angle || '0')!;
        else delete c.angle;
      }
    }
    const committed = this._commitPhysicalGeometry(this.host._t('history.physical_edit'), before);
    this.host._physicalDialog = null;
    if (!committed) this.host.requestUpdate();
  };

public _deletePhysicalSelection = async (): Promise<void> => {
    const sel = this.host._physicalSel;
    const sp = this.host._curSpaceCfg as any;
    if (!sel || !sp) return;
    const before = this._geometrySnapshot();
    if (sel.kind === 'partition') {
      const hosted = (sp.openings || [])
        .filter((opening: OpeningCfg) => opening.host?.kind === 'partition'
          && opening.host.id === sel.id)
        .sort((a: OpeningCfg, b: OpeningCfg) => (a.host?.t || 0) - (b.host?.t || 0));
      if (hosted.length) {
        this.host._partitionDeleteDialog = {
          id: sel.id,
          openings: hosted.map((opening: OpeningCfg) => JSON.parse(JSON.stringify(opening))),
        };
        return;
      }
    }
    const key = sel.kind === 'partition' ? 'partitions' : 'wall_columns';
    sp[key] = (sp[key] || []).filter((x: any) => x.id !== sel.id);
    if (!sp[key].length) delete sp[key];
    if (this.host._activeWallChainPartitionIds.includes(sel.id)) this._cancelPath();
    this.host._physicalSel = null;
    this.host._physicalDialog = null;
    this._commitPhysicalGeometry(this.host._t('history.physical_delete'), before);
  };

public _confirmPartitionDelete = (): void => {
    const dialog = this.host._partitionDeleteDialog;
    const sp = this.host._curSpaceCfg as any;
    if (!dialog || !sp) return;
    const before = this._geometrySnapshot();
    sp.partitions = (sp.partitions || []).filter((partition: PartitionCfg) =>
      partition.id !== dialog.id);
    if (!sp.partitions.length) delete sp.partitions;
    sp.openings = (sp.openings || []).filter((opening: OpeningCfg) =>
      opening.host?.kind !== 'partition' || opening.host.id !== dialog.id);
    if (!sp.openings.length) delete sp.openings;
    this.host._partitionDeleteDialog = null;
    this.host._physicalSel = null;
    this.host._physicalDialog = null;
    this._commitPhysicalGeometry(this.host._t('history.physical_delete'), before);
  };


public _physicalDown(ev: PointerEvent, kind: 'partition' | 'column', id: string): void {
    const model = this.host._spaceModel();
    if (!model) return;
    ev.stopPropagation();
    capturePointer(ev);
    const point = this._svgPoint(ev);
    const candidates: Array<{ kind: 'partition' | 'column'; id: string }> = [];
    for (const c of [...model.wall_columns].reverse()) {
      if (pointInPhysicalBody(point, columnBody(c, this.host._cellCm, this.host._gridPitch)))
        candidates.push({ kind: 'column', id: c.id });
    }
    for (const p of [...model.partitions].reverse()) {
      const body = partitionBody(p.a, p.b, p.cm, this.host._cellCm, this.host._gridPitch);
      if (body && pointInPhysicalBody(point, body)) candidates.push({ kind: 'partition', id: p.id });
    }
    if (!candidates.some((x) => x.kind === kind && x.id === id)) candidates.unshift({ kind, id });
    const signature = candidates.map((x) => `${x.kind}:${x.id}`).sort().join('|');
    const now = performance.now();
    const cycle = this.host._physicalPickCycle;
    const repeat = candidates.length > 1 && cycle?.signature === signature
      && now - cycle.at > 380 && now - cycle.at <= 1200
      && Math.hypot(ev.clientX - cycle.x, ev.clientY - cycle.y) <= 10;
    const index = repeat ? (cycle.index + 1) % candidates.length
      : Math.max(0, candidates.findIndex((x) => x.kind === kind && x.id === id));
    this.host._physicalPickCycle = { signature, index, x: ev.clientX, y: ev.clientY, at: now };
    kind = candidates[index].kind;
    id = candidates[index].id;
    const base = kind === 'partition'
      ? model.partitions.find((x) => x.id === id)
      : model.wall_columns.find((x) => x.id === id);
    if (!base) return;
    this.host._physicalSel = { kind, id };
    this.host._physicalDrag = {
      pid: ev.pointerId, kind, id, start: this._svgPoint(ev),
      startClient: [ev.clientX, ev.clientY],
      before: this._geometrySnapshot(), moved: false,
      base: JSON.parse(JSON.stringify(base)), delta: [0, 0],
    };
  }

public _clampPhysicalDelta(
    kind: 'partition' | 'column', base: PartitionCfg | WallColumnCfg, delta: number[],
  ): number[] {
    const points = kind === 'partition'
      ? [(base as PartitionCfg).a, (base as PartitionCfg).b]
      : [(base as WallColumnCfg).center];
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    return [
      Math.max(-CANVAS_LIMIT * NORM_W - Math.min(...xs),
        Math.min(CANVAS_LIMIT * NORM_W - Math.max(...xs), delta[0])),
      Math.max(-CANVAS_LIMIT * NORM_W - Math.min(...ys),
        Math.min(CANVAS_LIMIT * NORM_W - Math.max(...ys), delta[1])),
    ];
  }

public _physicalMove(ev: PointerEvent): void {
    ev.stopPropagation();
    queueHouseplanPointerMove(this.host, 'physical', () => this._physicalMoveNow(ev));
  }

private _physicalMoveNow(ev: PointerEvent): void {
    const drag = this.host._physicalDrag;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.stopPropagation();
    const raw = this._svgPoint(ev);
    const anchor = drag.kind === 'partition'
      ? (drag.base as PartitionCfg).a : (drag.base as WallColumnCfg).center;
    const target = this._snap([
      anchor[0] + raw[0] - drag.start[0], anchor[1] + raw[1] - drag.start[1],
    ]);
    const delta = this._clampPhysicalDelta(
      drag.kind, drag.base, [target[0] - anchor[0], target[1] - anchor[1]],
    );
    this.host._physicalDrag = {
      ...drag, delta,
      moved: drag.moved || Math.hypot(
        ev.clientX - drag.startClient[0], ev.clientY - drag.startClient[1],
      ) >= 5,
    };
  }

public _physicalUp(ev: PointerEvent): void {
    flushHouseplanPointerMove(this.host, 'physical');
    const drag = this.host._physicalDrag;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.stopPropagation();
    this.host._physicalDrag = null;
    if (!drag.moved) {
      this._registerPhysicalTap(drag.kind, drag.id);
      return;
    }
    const model = this.host._spaceModel();
    if (!this.host._curSpaceCfg || !model) return;
    const sp = this.host._curSpaceCfg as any;
    if (drag.kind === 'partition') {
      const p = (sp.partitions || []).find((x: any) => x.id === drag.id);
      const base = drag.base as PartitionCfg;
      if (p) {
        const moved: PartitionCfg = {
          ...base,
          a: [base.a[0] + drag.delta[0], base.a[1] + drag.delta[1]],
          b: [base.b[0] + drag.delta[0], base.b[1] + drag.delta[1]],
        };
        p.a = [moved.a[0] / NORM_W, moved.a[1] / NORM_W];
        p.b = [moved.b[0] / NORM_W, moved.b[1] / NORM_W];
        for (const opening of sp.openings || []) {
          if (opening.host?.kind !== 'partition' || opening.host.id !== drag.id) continue;
          const resolved = resolvePartitionOpeningCompat(
            opening, [moved], NORM_W, this.host._cellCm, this.host._gridPitch,
          ).resolved;
          if (resolved) Object.assign(
            opening, materializePartitionOpening(opening, resolved, NORM_W),
          );
        }
      }
    } else {
      const c = (sp.wall_columns || []).find((x: any) => x.id === drag.id);
      const base = drag.base as WallColumnCfg;
      const candidate: WallColumnCfg = {
        ...base,
        center: [base.center[0] + drag.delta[0], base.center[1] + drag.delta[1]],
      } as WallColumnCfg;
      if (model.wall_columns.some((x) => x.id !== drag.id
          && sameColumnPlacement(x, candidate, this.host._gridPitch * 0.02))) {
        this.host._showToast(this.host._t('toast.column_duplicate'));
        return;
      }
      if (c) c.center = [
        (base.center[0] + drag.delta[0]) / NORM_W,
        (base.center[1] + drag.delta[1]) / NORM_W,
      ];
    }
    this._commitPhysicalGeometry(this.host._t('history.physical_move'), drag.before);
  }

public _registerPhysicalTap(
    kind: 'partition' | 'column', id: string,
  ): void {
    const now = performance.now();
    const twice = this.host._physicalLastTap?.kind === kind
      && this.host._physicalLastTap.id === id
      && now - this.host._physicalLastTap.at <= 360;
    this.host._physicalLastTap = { kind, id, at: now };
    if (twice) {
      this.host._physicalLastTap = null;
      this._openPhysicalDialog(kind, id);
    }
  }

public _cancelPhysicalGesture(): void {
    cancelHouseplanPointerMove(this.host, 'physical');
    cancelHouseplanPointerMove(this.host, 'physical-rotate');
    this.host._physicalDrag = null;
    this.host._physicalRotate = null;
    this.host.requestUpdate();
  }

public _physicalRotateDown(ev: PointerEvent, c: WallColumnCfg): void {
    if (c.shape !== 'square' || !this.host._spaceModel()) return;
    ev.preventDefault();
    ev.stopPropagation();
    capturePointer(ev);
    const p = this._svgPoint(ev);
    this.host._physicalSel = { kind: 'column', id: c.id };
    this.host._physicalRotate = {
      pid: ev.pointerId, id: c.id, center: [...c.center],
      startAngle: Math.atan2(p[1] - c.center[1], p[0] - c.center[0]) * 180 / Math.PI,
      baseAngle: canonicalColumnAngle(c.angle), angle: canonicalColumnAngle(c.angle),
      before: this._geometrySnapshot(), moved: false,
    };
  }

public _physicalRotateMove(ev: PointerEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    queueHouseplanPointerMove(this.host, 'physical-rotate', () => this._physicalRotateMoveNow(ev));
  }

private _physicalRotateMoveNow(ev: PointerEvent): void {
    const drag = this.host._physicalRotate;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.preventDefault();
    ev.stopPropagation();
    const p = this._svgPoint(ev);
    const pointerAngle = Math.atan2(p[1] - drag.center[1], p[0] - drag.center[0]) * 180 / Math.PI;
    const raw = drag.baseAngle + pointerAngle - drag.startAngle;
    const angle = canonicalColumnAngle(ev.shiftKey ? raw : Math.round(raw / 5) * 5);
    this.host._physicalRotate = { ...drag, angle, moved: drag.moved || Math.abs(raw - drag.baseAngle) >= 0.5 };
  }

public _physicalRotateUp(ev: PointerEvent): void {
    flushHouseplanPointerMove(this.host, 'physical-rotate');
    const drag = this.host._physicalRotate;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.host._physicalRotate = null;
    const model = this.host._spaceModel();
    if (!drag.moved || !this.host._curSpaceCfg || !model) return;
    const current = model.wall_columns.find((c) => c.id === drag.id);
    if (!current || current.shape !== 'square') return;
    const candidate: WallColumnCfg = { ...current, angle: drag.angle };
    if (model.wall_columns.some((c) => c.id !== drag.id
        && sameColumnPlacement(c, candidate, this.host._gridPitch * 0.02))) {
      this.host._showToast(this.host._t('toast.column_duplicate'));
      return;
    }
    const stored = (this.host._curSpaceCfg as any).wall_columns?.find((c: any) => c.id === drag.id);
    if (!stored) return;
    stored.angle = drag.angle;
    this._commitPhysicalGeometry(this.host._t('history.physical_edit'), drag.before);
  }

public _rszRooms(): { id: string; poly: number[][]; wall_ids?: string[] }[] {
    const out: { id: string; poly: number[][]; wall_ids?: string[] }[] = [];
    const space = this.host._spaceModel();
    if (!space) return out;
    for (const r of space.rooms) {
      const poly = r.id ? roomPoly(r) : null;
      if (poly) out.push({
        id: r.id!, poly,
        wall_ids: Array.isArray(r.wall_ids) ? [...r.wall_ids] : undefined,
      });
    }
    return coalesceResizeRooms(out, Math.max(1e-12, this.host._gridPitch * 1e-12));
  }

public _rszOpenings(): SafeOpeningIn[] {
    return this.host._openingsR.map((o) => ({
      id: o.id, x: o.rx, y: o.ry, length: o.rlen,
      hosted: !!o.host, angle: o.angle, type: o.type,
    }));
  }

public _rszObstacles(): SafeResizeObstacle[] {
    const space = this.host._spaceModel();
    if (!space) return [];
    const obstacles: SafeResizeObstacle[] = [];
    for (const partition of space.partitions || []) {
      obstacles.push({
        kind: 'segment', a: [...partition.a], b: [...partition.b],
        half: wallCmToUnits(partition.cm, this.host._cellCm, this.host._gridPitch) / 2,
      });
    }
    for (const column of space.wall_columns || []) {
      const half = wallCmToUnits(column.cm, this.host._cellCm, this.host._gridPitch) / 2;
      obstacles.push({
        kind: 'circle', center: [...column.center],
        radius: column.shape === 'square' ? half * Math.SQRT2 : half,
      });
    }
    return obstacles;
  }

public _rszOptsFor(a: number[], b: number[]): SafeResizeOptions {
    const cm = thicknessCmAt(this.host._spaceWalls, a, b, this.host._wallKeyPitch, NORM_W);
    const exact = this.host._spaceWalls.filter((wall) => Array.isArray(wall.a) && Array.isArray(wall.b)
      && wall.a.length >= 2 && wall.b.length >= 2).map((wall) => ({
      wall,
      a: [wall.a![0] * NORM_W, wall.a![1] * this.host._spaceH],
      b: [wall.b![0] * NORM_W, wall.b![1] * this.host._spaceH],
    }));
    const axis = Math.abs(a[0] - b[0]) <= this.host._gridPitch * 0.05 ? 'v'
      : Math.abs(a[1] - b[1]) <= this.host._gridPitch * 0.05 ? 'h' : null;
    const overlaps = exact.filter((entry) => {
      if (!axis) return false;
      if (axis === 'h') {
        if (Math.abs(entry.a[1] - a[1]) > this.host._gridPitch * 0.05
            || Math.abs(entry.b[1] - a[1]) > this.host._gridPitch * 0.05) return false;
        return Math.min(Math.max(a[0], b[0]), Math.max(entry.a[0], entry.b[0]))
          - Math.max(Math.min(a[0], b[0]), Math.min(entry.a[0], entry.b[0])) > this.host._gridPitch * 0.05;
      }
      if (Math.abs(entry.a[0] - a[0]) > this.host._gridPitch * 0.05
          || Math.abs(entry.b[0] - a[0]) > this.host._gridPitch * 0.05) return false;
      return Math.min(Math.max(a[1], b[1]), Math.max(entry.a[1], entry.b[1]))
        - Math.max(Math.min(a[1], b[1]), Math.min(entry.a[1], entry.b[1])) > this.host._gridPitch * 0.05;
    });
    const exactCms = new Set(overlaps.map((entry) => Number(entry.wall.cm)).filter((value) => value > 0));
    return {
      minDim: this.host._cmToUnits(MIN_ROOM_CM),
      eps: this.host._gridPitch * 0.05,
      step: this.host._gridPitch,
      movingHalf: cm > 0 ? wallCmToUnits(cm, this.host._cellCm, this.host._gridPitch) / 2 : 0,
      obstacles: this._rszObstacles(),
      thicknessConflict: exactCms.size > 1,
    };
  }

public _rszResolution(
    roomId: string, edge: number, renderSnapshot?: string,
  ): SafeResizeResolution {
    const snap = this.host._resize.snapshotIdentity || renderSnapshot || this._rszSnapshot();
    const key = `${this.host._space}|${this.host._cellCm}|${this.host._gridPitch}|${snap}`;
    const cacheKey = `${roomId}:${edge}`;
    return this.host._resize.resolve(key, cacheKey, () => {
      const rooms = [...(this.host._resize.rooms || this._rszRooms())];
      const room = rooms.find((candidate) => candidate.id === roomId);
      const a = room?.poly?.[edge] || [0, 0];
      const b = room?.poly?.[(edge + 1) % (room?.poly?.length || 1)] || [0, 0];
      return resolveSafeResize(
        rooms, [...(this.host._resize.openings || this._rszOpenings())], roomId, edge,
        this._rszOptsFor(a, b),
      );
    });
  }

public _rszSnapshot(): string {
    return JSON.stringify(this._geometrySnapshot() || {
      spaceId: this.host._space, rooms: [], openings: [], walls: [], open_spans: [],
    });
  }

public _rszResetController(): void {
    const hadPreview = this.host._resize.preview !== null;
    this.host._resize.reset();
    if (hadPreview) this.host._cfgEpoch++;
  }

public _rszProjectPreview(
    snapshot: string,
    polys: Record<string, number[][]>,
    ops: Record<string, [number, number]>,
    changedRoomIds: readonly string[],
    sourceRooms: readonly { id: string; poly: number[][]; wall_ids?: string[] }[],
  ): ResizeProjectionResult<ResizePreview, ResizeWallArtifact> {
    // #329 AC7a: only the LAST projection may explain the refusal, so the
    // previous verdict never leaks into a rejection of another kind.
    this.host._rszLimitViolation = null;
    const real = this.host._serverCfg?.spaces.find((s: any) => s.id === this.host._space);
    if (!real || !this.host._serverCfg) return { ok: false, reason: 'missing-context' };
    const s = JSON.parse(snapshot); // fresh deep copies every move — free to mutate
    const sp: any = {
      ...real,
      rooms: s.rooms,
      openings: s.openings || [],
    };
    for (const key of ['walls', 'wall_segments', 'open_spans', 'partitions', 'wall_columns', 'decor'] as const) {
      if (s[key] !== undefined) (sp as any)[key] = s[key];
      else delete (sp as any)[key];
    }
    for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const) {
      if (s.plan_transform?.[key] !== undefined) (sp as any)[key] = s.plan_transform[key];
      else delete (sp as any)[key];
    }
    const H = this.host._spaceH;
    for (const [id, poly] of Object.entries(polys)) {
      const r = sp.rooms.find((x: any) => x.id === id);
      if (!r) continue;
      r.poly = poly.map((p) => [p[0] / NORM_W, p[1] / H]);
      delete r.x; delete r.y; delete r.w; delete r.h; // a resized room is saved as a polygon
    }
    for (const [id, c] of Object.entries(ops)) {
      const o = (sp.openings || []).find((x: any) => x.id === id);
      if (!o) continue;
      o.x = c[0] / NORM_W;
      o.y = c[1] / H;
    }
    // Geometry that belongs to a wall must ride in the SAME live overlay as
    // its room polygons. Map from the immutable snapshot on every move (never
    // from the previous preview), so atomic identity and thickness cannot lag
    // behind or accumulate rounding error during a long drag.
    const oldSpans: [number[], number[]][] = [];
    const newSpans: [number[], number[]][] = [];
    for (const id of changedRoomIds) {
      const oldR = sourceRooms.find((r) => r.id === id);
      const nr = sp.rooms.find((x: any) => x.id === id);
      if (!oldR || !nr?.poly) continue;
      const newPoly = nr.poly.map((p: number[]) => [p[0] * NORM_W, p[1] * H] as number[]);
      if (oldR.poly.length !== newPoly.length) continue;
      const ids = Array.isArray((oldR as any).wall_ids) ? (oldR as any).wall_ids : [];
      for (let i = 0; i < oldR.poly.length; i++) {
        oldSpans.push([oldR.poly[i], oldR.poly[(i + 1) % oldR.poly.length]]);
        newSpans.push([newPoly[i], newPoly[(i + 1) % newPoly.length]]);
        const id = ids[i];
        const segment = typeof id === 'string'
          ? (sp.wall_segments || []).find((item) => item.id === id)
          : null;
        if (segment) {
          segment.a = [newPoly[i][0] / NORM_W, newPoly[i][1] / NORM_W];
          segment.b = [
            newPoly[(i + 1) % newPoly.length][0] / NORM_W,
            newPoly[(i + 1) % newPoly.length][1] / NORM_W,
          ];
        }
      }
    }
    if (oldSpans.length) {
      if (Array.isArray(sp.walls) && sp.walls.length) {
        const rekeyed = rekeyWallsAfterMoveChecked(
          sp.walls, oldSpans, newSpans, this.host._wallKeyPitch, NORM_W, 'fixed-topology',
        );
        if (rekeyed.rejected) return { ok: false, reason: 'wall-metadata' };
        sp.walls = rekeyed.walls;
      }
    }
    const wallCarriers: [number[], number[]][] = [];
    for (const room of sp.rooms || []) {
      const poly = roomPoly(room);
      if (!poly || poly.length < 2) continue;
      for (let index = 0; index < poly.length; index++) {
        wallCarriers.push([
          [poly[index][0] * NORM_W, poly[index][1] * NORM_W],
          [poly[(index + 1) % poly.length][0] * NORM_W,
            poly[(index + 1) % poly.length][1] * NORM_W],
        ]);
      }
    }
    // Old plans may contain explicit historical debt (for example an authored
    // off-grid thickness breakpoint). Safe Resize must not silently repair it,
    // but it may not create a new invalid record either. Remove byte-identical
    // old records as a multiset and prove only newly written/split records.
    // That keeps pointermove bounded by the touched thickness profile instead
    // of comparing every historical record with every carrier twice per frame.
    const wallSignature = (wall: WallEntry): string =>
      JSON.stringify([wall?.key, wall?.cm, wall?.a, wall?.b]);
    const oldWallCounts = new Map<string, number>();
    for (const wall of s.walls || []) {
      const key = wallSignature(wall);
      oldWallCounts.set(key, (oldWallCounts.get(key) || 0) + 1);
    }
    const changedWalls: WallEntry[] = [];
    for (const wall of sp.walls || []) {
      const key = wallSignature(wall);
      const remaining = oldWallCounts.get(key) || 0;
      if (remaining) oldWallCounts.set(key, remaining - 1);
      else changedWalls.push(wall);
    }
    if (wallRecordCarrierViolations(changedWalls, wallCarriers, this.host._wallKeyPitch,
      NORM_W, s.walls || []).length) return { ok: false, reason: 'wall-metadata' };
    const liveRoomIds = resizeLiveJunctionRoomIds(sp.rooms || [], changedRoomIds);
    const liveSpace = resizeLiveCandidateSpace(sp, liveRoomIds);
    if (!liveSpace || !this._rszSpaceCandidateGeometry(this.host._space, liveSpace).ok)
      return { ok: false, reason: 'physical-geometry' };
    // #329 AC7a: a step that would ADD a junction-limit violation is never
    // projected, so the drag stops at the last allowed position instead of
    // committing an impossible plan.
    const limitCandidate = {
      ...this.host._serverCfg,
      spaces: (this.host._serverCfg?.spaces || []).map(
        (space) => (space?.id === this.host._space ? sp : space),
      ),
    };
    try { this._resizePreviewNodes = multiWallNodesForGeometry(
        liveSpace.rooms, liveSpace.walls as unknown as WallEntry[], [], GRID_STEP_N,
        this.host._cellCm, this.host._gridPitch, NORM_W,
      );
    } catch { this._resizePreviewNodes = null; }
    let limited: JunctionLimitViolation[];
    try {
      const affected = new Set(changedRoomIds);
      const next = this.host._junctionLimitViolations(limitCandidate, this.host._space,
        { status: 'lightweight', multiWallNodes: this._resizePreviewNodes }, affected);
      const baseline = this._resizeBaselineLimits.filter(
        (item) => item.rule !== 'clearance' || affected.has(item.subject));
      limited = increasedViolations(next, baseline);
    } catch {
      limited = [{ rule: 'check_failed', subject: this.host._space, actual: 0, limit: 0 }];
    }
    if (limited.length) {
      this.host._rszLimitViolation = limited[0];
      return { ok: false, reason: 'junction-limit' };
    }
    return {
      ok: true,
      value: {
        preview: { space: this.host._space, sp },
        beforeWalls: s.walls || [],
        afterWalls: sp.walls || [], artifact: null,
      },
    };
  }
public _rszAcceptPreview(
    preview: ResizePreview | null, wallGeometry: ResizeWallArtifact | null,
  ): void {
    this.host._cfgEpoch++;
    if (this.host._physicalBodiesCache) this.host._physicalBodiesCache.key =
      `${this.host._space}|${this.host._cfgEpoch}|${this.host._cellCm}|${this.host._gridPitch}`;
    if (!preview || !wallGeometry) return;
    const projected = wallBodiesGeometryPath(wallGeometry);
    if (!projected) return;
    const key = `${this.host._space}|${this.host._cfgEpoch}|${preview.sp.rooms.length}`;
    Object.defineProperty(projected, 'sourceFingerprint', {
      value: contentFingerprint([preview.sp, this.host._cellCm, this.host._gridPitch]),
      enumerable: false,
    });
    const entry = { key, value: projected };
    lruWrite(this.host._wallUnionPool, key, entry, 8);
    this.host._wallUnionCache = entry;
  }

public _rszSpaceCandidateGeometry(spaceId: string, sp: any): {
    ok: boolean;
    wallGeometry: ReturnType<typeof wallBodiesGeometry> | null;
  } {
    if (!this.host._serverCfg) return { ok: false, wallGeometry: null };
    const candidate = {
      ...this.host._serverCfg,
      spaces: this.host._serverCfg.spaces.map((space) =>
        space.id === spaceId ? sp : space),
    } as ServerConfig;
    let wallGeometry: ReturnType<typeof wallBodiesGeometry> | null = null;
    try {
      const check = this.host._checkSpacePhysicalGeometry(
        candidate, spaceId, (geometry) => { wallGeometry = geometry; },
      );
      return { ok: check.ok, wallGeometry };
    } catch {
      return { ok: false, wallGeometry: null };
    }
  }

public _rszSpaceCandidateRenderable(spaceId: string, sp: any): boolean {
    if (!this.host._serverCfg) return false;
    try {
      const candidate = {
        ...this.host._serverCfg,
        spaces: this.host._serverCfg.spaces.map((space) =>
          space.id === spaceId ? sp : space),
      } as ServerConfig;
      return this.host._checkSpacePhysicalGeometry(candidate, spaceId).ok;
    } catch {
      return false;
    }
  }

public _rszCandidateRenderable(preview: { space: string; sp: any } | null): boolean {
    return !!preview && preview.space === this.host._space
      && this._rszSpaceCandidateRenderable(preview.space, preview.sp);
  }

public _rszEdgeDown(ev: PointerEvent, roomId: string, edge: number): void {
    if (this.host._tool !== 'resize' || this.host._resize.dragging) return;
    this._resizeBaseFrameStable = true;
    ev.stopPropagation();
    ev.preventDefault();
    const rooms = this._rszRooms();
    const resolution = this._rszResolution(roomId, edge);
    if (!resolution.enabled) {
      this.host._showToast(this._rszReasonText(resolution.reason));
      return;
    }
    capturePointer(ev);
    const plan = resolution.plan;
    try {
      this._resizeBaselineLimits = this.host._junctionLimitViolations(
        this.host._serverCfg, this.host._space, null, new Set(plan.roomIds));
    } catch { this._resizeBaselineLimits = []; }
    const start = this._svgPoint(ev);
    const wallUnionKey = `${this.host._space}|${this.host._cfgEpoch}|${rooms.length}`;
    const wallUnionBefore = this.host._wallUnionCache?.key === wallUnionKey
      ? this.host._wallUnionCache.value : null;
    const snapshotIdentity = this._rszSnapshot();
    this.host._resize.begin({
      pointerId: ev.pointerId, start: [start[0], start[1]], roomId, plan,
      options: this._rszOptsFor(plan.a, plan.b), rooms,
      openings: this._rszOpenings(), snapshotIdentity,
      before: JSON.parse(snapshotIdentity) as SpaceGeometryState,
      wallUnionBefore,
      epochBefore: this.host._cfgEpoch,
    });
  }

public _rszReasonText(reason: SafeResizeReason): string {
    return this.host._t(`resize.disabled.${reason}` as I18nKey);
  }

public _rszDisabledActivate(ev: Event, reason: SafeResizeReason): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.host._showToast(this._rszReasonText(reason));
  }

public _rszDisabledKey(ev: KeyboardEvent, reason: SafeResizeReason): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    this._rszDisabledActivate(ev, reason);
  }

public _rszMove(ev: PointerEvent): void {
    if (!this.host._resize.ownsPointer(ev.pointerId)) return;
    ev.stopPropagation();
    queueHouseplanPointerMove(this.host, 'resize', () => this._rszMoveNow(ev));
  }
private _rszMoveNow(ev: PointerEvent): void {
    if (!this.host._resize.ownsPointer(ev.pointerId)) return;
    ev.stopPropagation();
    const p = this._svgPoint(ev);
    const result = this.host._resize.move({
      pointerId: ev.pointerId,
      point: [p[0], p[1]],
      step: this.host._gridPitch,
      snap: (point) => {
        const snapped = this._snap(point);
        return [snapped[0], snapped[1]];
      },
      project: (snapshot, polys, openings, changedRoomIds, rooms) =>
        this._rszProjectPreview(snapshot, polys, openings, changedRoomIds, rooms),
      publish: (preview, artifact) => this._rszAcceptPreview(preview, artifact),
      measure: (candidate, plan) => this._rszEdgeLabels(candidate, plan),
    });
    if (result.kind === 'rejected') {
      // Persistence metadata is part of the geometry transaction. If wall or
      // virtual-span rekeying would be lossy, keep the last complete preview:
      // the pointer visibly stops there and pointerup can commit only that
      // already-rendered safe candidate.
      if (result.notify) {
        // #329 AC7a: a step stopped by a junction limit names THAT rule — the
        // generic "geometry cannot be saved" wording would hide which limit
        // the wall ran into.
        this.host._showToast(this.host._rszLimitViolation
          ? `${this.host._t('resize.limit_stopped')} — `
            + this._junctionLimitLabel(this.host._rszLimitViolation)
          : this.host._t('resize.preview_failed'));
      }
      this.host.requestUpdate();
      return;
    }
    if (result.kind === 'accepted') this.host.requestUpdate();
  }

public _rszUp(ev: PointerEvent): void {
    flushHouseplanPointerMove(this.host, 'resize');
    if (!this.host._resize.ownsPointer(ev.pointerId)) return;
    ev.stopPropagation();
    const result = this.host._resize.finish({
      pointerId: ev.pointerId,
      currentSnapshotIdentity: this._rszSnapshot(),
      validatePreview: (preview) => this._rszCandidateRenderable(preview),
    });
    if (result.kind === 'no-op') {
      // HP-1550-01: nothing to restore — the preview never touched the config
      this.host._cfgEpoch++;
      this.host.requestUpdate();
      return;
    }
    if (result.kind === 'rejected') {
      this.host._cfgEpoch++;
      this.host._showToast(this.host._t('resize.commit_failed'));
      this.host.requestUpdate();
      return;
    }
    // Commit the exact preview in one step. No simplify/rebuild pass is allowed:
    // preview and persistence share the same fixed-topology candidate.
    const preview = result.preview;
    const sp = this.host._serverCfg?.spaces.find((space) => space.id === preview.space);
    if (sp) {
      sp.rooms = preview.sp.rooms;
      sp.openings = preview.sp.openings;
      if (Array.isArray(preview.sp.walls)) {
        if (preview.sp.walls.length) sp.walls = preview.sp.walls;
        else delete sp.walls;
      }
      if (Array.isArray(preview.sp.wall_segments)) sp.wall_segments = preview.sp.wall_segments;
    }
    // the click synthesized after the drag must not re-pick the selection
    this.host._suppressClick = true;
    setTimeout(() => (this.host._suppressClick = false), 0);
    this._commitPhysicalGeometry(this.host._t('history.resize_room'), result.before);
    this.host.requestUpdate();
  }

public _rszCancelDrag(pointerId?: number): void {
    cancelHouseplanPointerMove(this.host, 'resize');
    const result = this.host._resize.cancel(this._rszSnapshot(), pointerId);
    if (result.kind === 'no-op') return;
    // An identical cancel reuses the pre-drag structural caches and writes nothing.
    if (result.restoreEpoch !== null) this.host._cfgEpoch = result.restoreEpoch;
    else this.host._cfgEpoch++;
    if (this.host._physicalBodiesCache) this.host._physicalBodiesCache.key =
      `${this.host._space}|${this.host._cfgEpoch}|${this.host._cellCm}|${this.host._gridPitch}`;
    if (result.restoreWallUnion) {
      // Alias the already-proved pre-drag union under the restored epoch.
      const space = this.host._spaceModel();
      if (space) {
        const key = `${this.host._space}|${this.host._cfgEpoch}|${space.rooms.length}`;
        const entry = { key, value: result.restoreWallUnion };
        lruWrite(this.host._wallUnionPool, key, entry, 8);
        this.host._wallUnionCache = entry;
      }
    }
    // Retain the canonical frame only when the drag was actually painted in
    // the isolated plan-editor layer. Programmatic/non-editor callers still
    // need a full render to replace their preview DOM.
    if (result.restoreEpoch !== null && this.host._mode === 'plan'
        && this._resizeBaseFrameStable) this.host._terminalFrame = 1;
    this.host.requestUpdate();
  }

public _rszPointerCancel(ev: PointerEvent): void {
    if (!this.host._resize.ownsPointer(ev.pointerId)) return;
    ev.stopPropagation();
    this._rszCancelDrag(ev.pointerId);
  }

public _rszEdgeLabels(
    res: { polys: Record<string, number[][]> }, plan: SafeResizePlan,
    sourceRooms: readonly { id: string; poly: number[][] }[] | null = this.host._resize.rooms,
  ): ResizeLiveLabel[] {
    const rooms = sourceRooms;
    const labels: ResizeLiveLabel[] = [];
    const own = res.polys[plan.roomId] || rooms?.find((r) => r.id === plan.roomId)!.poly;
    if (!own || !rooms) return labels;
    const n = own.length;
    // Длины — между внутренними гранями, как и площадь ниже (#233). Раньше
    // здесь считалась осевая длина, и одно облачко подписей несло две разные
    // конвенции: «3.00 × 4.00» по центрам стен рядом с площадью по полу.
    const spanCms = this._rszInnerSpanCms(plan.roomId, own, res.polys);
    // The moving wall is obvious under the pointer. Only its two side walls
    // remain useful measurements, and each one owns the matching highlight.
    for (const edge of resizeMeasuredEdges(own, plan.edge)) {
      const a = own[edge], b = own[(edge + 1) % n];
      const cm = spanCms?.[edge];
      labels.push({
        kind: 'length',
        x: (a[0] + b[0]) / 2,
        y: (a[1] + b[1]) / 2,
        text: cm == null ? this.host._fmtLen(a, b)
          : formatLength(cm, this.host.hass?.config?.unit_system?.length === 'mi'),
        edge: { a: [a[0], a[1]], b: [b[0], b[1]] },
      });
    }
    // Live areas sit beside the moving wall, one on each owner side. Placement
    // is pure screen-space math fed by the stage size cached by ResizeObserver;
    // no pointermove DOM measurement is allowed.
    const imperial = this.host.hass?.config?.unit_system?.length === 'mi';
    const ids = plan.roomIds;
    const walls = this.host._spaceWalls;
    const physical = this.host._physicalBodiesR();
    const base = this.host._baseVb();
    const currentView = this.host._view && this.host._view.w > 0 && this.host._view.h > 0
      ? this.host._view
      : { x: base[0], y: base[1], w: base[2], h: base[3] };
    const [cachedW, cachedH] = this.host._lastValidStageSize || [currentView.w, currentView.h];
    const view = {
      ...currentView,
      stageWidth: Math.max(1, cachedW),
      stageHeight: Math.max(1, cachedH),
    };
    const space = this.host._spaceModel();
    const cfgSize = this.host._config?.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;
    const iconPx = space
      ? iconCqw(iconPct, space, currentView.w, this.host._kiosk ? this.host._kioskScale.icon : 1)
          * view.stageWidth / 100
      : 24;
    const gearHeightPx = Math.max(10, iconPx * 0.77);
    const gearText = this.host._t('room.settings_short');
    // Mirrors the CSS proportions conservatively: icon + gap + two paddings +
    // localized text at the button's 0.42*height font size.
    const gearWidthPx = gearHeightPx * (
      0.55 + 0.35 * 0.42 + 0.76 + Math.max(1, gearText.length) * 0.66 * 0.42
    );
    for (const id of ids) {
      const poly = res.polys[id] || rooms.find((r) => r.id === id)!.poly;
      // The preview is already the active render model. Reuse the same shared
      // masonry union + contour cache that the following render consumes;
      // rebuilding both independently here doubled one Resize frame.
      const floor = walls.length && space
        ? (innerContourForRoom(
          space.rooms, id, walls, this.host._openCuts(), this.host._wallKeyPitch,
          this.host._cellCm, this.host._gridPitch, NORM_W, null, this._resizePreviewNodes,
        ) || poly)
        : poly;
      const m2 = physical.length
        ? geometryArea(floorMinusBodies(floor, physical))
            * Math.pow(this.host._cellCm / this.host._gridPitch, 2) / 1e4
        : areaM2(floor, this.host._gridPitch, this.host._cellCm);
      const text = formatArea(m2, imperial);
      const placement = placeResizeAreaLabel({
        poly,
        edge: plan.edgeByRoom[id],
        text,
        view,
        gearCenter: poleOfInaccessibility(poly),
        gearWidthPx,
        gearHeightPx,
      });
      labels.push({
        kind: 'area', roomId: id,
        x: placement.anchor[0], y: placement.anchor[1], text, placement,
      });
    }
    return labels;
  }

public _rszInnerSpanCms(
    roomId: string, own: number[][], polys: Record<string, number[][]>,
  ): number[] | null {
    const rooms = Object.keys(polys).length
      ? Object.entries(polys).map(([id, poly]) => ({ id, poly }))
      : this.host._spaceModel()?.rooms;
    if (!rooms?.length) return null;
    const walls = this.host._spaceWalls;
    if (!walls.length) return null;
    const openCuts = this.host._openCuts();
    const offsets = ownEdgeOffsets(
      rooms, roomId, walls, openCuts,
      this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
    );
    if (!offsets || offsets.length !== own.length) return null;
    const perUnitCm = this.host._cellCm / this.host._gridPitch;
    return own.map((_, edge) => innerEdgeSpan(own, edge, offsets) * perUnitCm);
  }

public _renderResizeMeasurements(): TemplateResult | typeof nothing {
    const live = this.host._resize.liveLabels;
    if (!live?.length) return nothing;
    const lengths = live.filter((label) => label.kind === 'length');
    const areas = live.filter((label) => label.kind === 'area');
    return svg`<g class="rszmeasurelayer" aria-hidden="true" pointer-events="none">
      ${lengths.map((label, index) => svg`<g class="rszmeasuredge"
          data-hp="resize-measured-edge" data-edge-index=${index}>
        <line class="rszmeasurehalo" x1=${label.edge.a[0]} y1=${label.edge.a[1]}
          x2=${label.edge.b[0]} y2=${label.edge.b[1]}></line>
        <line class="rszmeasureink" x1=${label.edge.a[0]} y1=${label.edge.a[1]}
          x2=${label.edge.b[0]} y2=${label.edge.b[1]}></line>
      </g>`)}
      ${areas.map((label) => svg`<line class="rszleader" data-hp="resize-area-leader"
        data-room=${label.roomId}
        x1=${label.placement.leader.a[0]} y1=${label.placement.leader.a[1]}
        x2=${label.placement.leader.b[0]} y2=${label.placement.leader.b[1]}></line>`)}
    </g>`;
  }

public _renderResizeLayer(
    view: { x: number; y: number; w: number; h: number }, roomIds?: readonly string[],
  ): TemplateResult {
    const hr = Math.max(view.w * 0.013, 5); // finger-sized HIT radius on touch, like .vacfithandle
    // Wall-handle glyph: half the old circle — a wall segment with two arrows
    // pointing perpendicular to it (the directions the wall can be dragged).
    // Drawn in local coords (wall along X), rotated per edge at render time.
    // The invisible circle above keeps the full finger-sized hit area and the
    // HP-1550-04 hit-test priority over openings.
    const s = hr / 2, f = (v: number) => v.toFixed(1);
    const iconD =
      `M ${f(-0.7 * s)} 0 H ${f(0.7 * s)}` +
      ` M 0 ${f(-0.22 * s)} V ${f(-s)} M ${f(-0.32 * s)} ${f(-0.6 * s)} L 0 ${f(-s)} L ${f(0.32 * s)} ${f(-0.6 * s)}` +
      ` M 0 ${f(0.22 * s)} V ${f(s)} M ${f(-0.32 * s)} ${f(0.6 * s)} L 0 ${f(s)} L ${f(0.32 * s)} ${f(0.6 * s)}`;
    const parts: TemplateResult[] = [];
    const rooms = this._rszRooms();
    // A geometry snapshot is a deep clone/serialization. It is the cache key
    // for every handle in this frame, so compute it once per layer render —
    // never once per room edge. During a drag the immutable gesture snapshot
    // remains authoritative inside _rszResolution.
    const renderSnapshot = this.host._resize.snapshotIdentity || this._rszSnapshot();
    const visibleRooms = roomIds?.length ? new Set(roomIds) : null;
    for (const r of rooms) {
      if (visibleRooms && !visibleRooms.has(r.id)) continue;
      for (let i = 0; i < r.poly.length; i++) {
        const a = r.poly[i], b = r.poly[(i + 1) % r.poly.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < this.host._gridPitch) continue;
        const mx = f((a[0] + b[0]) / 2), my = f((a[1] + b[1]) / 2);
        const ang = f(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI);
        const resolution = this._rszResolution(r.id, i, renderSnapshot);
        const disabled = !resolution.enabled;
        const reason = disabled ? this._rszReasonText(resolution.reason) : this.host._t('title.markup_resize');
        parts.push(svg`<circle class="rszhandle ${disabled ? 'disabled' : ''}"
          cx="${mx}" cy="${my}" r="${f(hr)}" tabindex="0" role="button"
          aria-disabled="${disabled ? 'true' : 'false'}" aria-label="${reason}"
          @pointerdown=${(e: PointerEvent) => this._rszEdgeDown(e, r.id, i)}
          @pointermove=${(e: PointerEvent) => this._rszMove(e)}
          @pointerup=${(e: PointerEvent) => this._rszUp(e)}
          @pointercancel=${(e: PointerEvent) => this._rszPointerCancel(e)}
          @lostpointercapture=${(e: PointerEvent) => this._rszPointerCancel(e)}
          @click=${disabled ? (e: Event) => this._rszDisabledActivate(e, resolution.reason) : null}
          @keydown=${disabled ? (e: KeyboardEvent) => this._rszDisabledKey(e, resolution.reason) : null}>
          <title>${reason}</title>
        </circle>`);
        parts.push(svg`<g class="rszicon ${disabled ? 'disabled' : ''}" transform="translate(${mx} ${my}) rotate(${ang})"><path class="rszhalo" d="${iconD}"></path><path class="rszink" d="${iconD}"></path></g>`);
      }
    }
    return svg`<g class="resize-layer">${parts}</g>`;
  }

public _partitionOpeningCuts(
    space: SpaceModel | undefined = this.host._spaceModel(),
    accept: (opening: OpeningCfg) => boolean = () => true,
  ): PartitionOpeningCut[] {
    if (!space) return [];
    const config = this.host._curSpaceCfg?.id === space.id ? this.host._curSpaceCfg : null;
    const openings = geometryOpenings(
      config, space, this.host._cellCm, this.host._gridPitch, NORM_W,
    );
    return geometryPartitionOpeningCuts(openings, accept);
  }

public _decorSnapGeometry(excludeId?: string): SnapGeometry {
    const space = this.host._spaceModel();
    if (!space) return { points: [], segments: [] };
    const cacheKey = excludeId || '';
    const cached = this.host._decorSnapCache;
    if (cached && cached.epoch === this.host._cfgEpoch && cached.space === this.host._space
        && cached.height === this.host._decorH && cached.exclude === cacheKey) {
      return cached.geometry;
    }
    const parts: SnapGeometry[] = [];
    for (const shape of this.host._decorList) {
      if (shape.id === excludeId) continue;
      if (shape.kind === 'line') {
        const a = [shape.x1 * NORM_W, shape.y1 * this.host._decorH];
        const b = [shape.x2 * NORM_W, shape.y2 * this.host._decorH];
        parts.push({
          points: [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]],
          segments: [{ a, b }],
        });
      } else if (shape.kind === 'text') {
        parts.push({ points: [[shape.x * NORM_W, shape.y * this.host._decorH]], segments: [] });
      } else {
        const box = this.host._decorBoxOf(shape);
        if (box) parts.push(boxAnchors(box));
      }
    }
    for (const room of space.rooms) {
      const poly = roomPoly(room);
      if (!poly?.length) continue;
      parts.push({
        points: poly.flatMap((p, i) => {
          const q = poly[(i + 1) % poly.length];
          return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]];
        }),
        segments: poly.map((p, i) => ({ a: p, b: poly[(i + 1) % poly.length] })),
      });
    }
    const geometry = mergeSnapGeometry(parts);
    this.host._decorSnapCache = {
      epoch: this.host._cfgEpoch, space: this.host._space, height: this.host._decorH,
      exclude: cacheKey, geometry,
    };
    return geometry;
  }

public _decorSnap(raw: number[], pointerType = 'mouse', excludeId?: string): number[] {
    const stage = this.host._stageEl;
    const view = this.host._viewOr(this.host._baseVb());
    const px = pointerType === 'touch' || pointerType === 'pen' ? 14 : 8;
    const tolerance = stage ? (view.w / Math.max(1, stage.clientWidth)) * px : this.host._gridPitch;
    return snapDecorPoint(
      raw, this._decorSnapGeometry(excludeId), tolerance,
      (point) => this._snap(point),
    ).point;
  }

public _replaceDecor(id: string, patch: Partial<DecorShape>): void {
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    sp.decor = this.host._decorList.map((shape) => shape.id === id ? { ...shape, ...patch } : shape);
    // The edited shape is excluded from the gesture's magnet candidates, so
    // keep the cached geometry of every *other* object across pointermoves.
    // A different exclude id/cache key rebuilds it when the next gesture starts.
    this.host.requestUpdate();
  }

public _cancelDecorGesture(): void {
    cancelHouseplanPointerMove(this.host, 'decor-transform');
    cancelHouseplanPointerMove(this.host, 'decor-move');
    cancelHouseplanPointerMove(this.host, 'backdrop');
    const before = this.host._decorMove?.before || this.host._dtDrag?.before || this.host._bdDrag?.before;
    const sp = before && this.host._serverCfg?.spaces.find((space) => space.id === before.spaceId);
    if (before && sp) {
      const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
      if (before.decor !== undefined) sp.decor = copy(before.decor);
      else delete sp.decor;
      for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const)
        delete sp[key];
      Object.assign(sp, copy(before.plan_transform || {}));
      // The restored transform is byte-identical; keep geometry caches.
      this.host._decorSnapCache = null;
    }
    this.host._decorMove = null;
    this.host._dtDrag = null;
    this.host._bdDrag = null;
    // Mark after named terminal setters; only the unnamed cancel frame may be retained.
    if (before && sp && this.host._mode === 'decor') this.host._terminalFrame = 1;
    this.host.requestUpdate();
  }

public _decorPointerDown(ev: PointerEvent): boolean {
    const t = this.host._decorTool;
    // #369(е): only the primary mouse button places objects — a right/middle
    // click with an armed tool must not stamp furniture or start a shape.
    // Touch/pen keep their own transactions (button is 0/-1 there).
    if (ev.pointerType === 'mouse' && ev.button !== 0
        && t !== 'select' && t !== 'erase') return false;
    // A DRAWING tool owns the whole canvas. Pressing on top of an existing
    // shape must start a NEW figure at that very point — otherwise a line can
    // never begin at the end of another line, because the old line grabs the
    // press first (owner, 2026-08-04). Only select/erase talk to shapes, and
    // only for them does the shape's own handler get to deal with the event.
    const onShape = (t === 'select' || t === 'erase')
      ? ((ev.target as HTMLElement).closest?.('.dshape') as SVGElement | null)
      : null;
    if (onShape) return true; // the shape's own handler deals with it
    if (t === 'line' || t === 'rect' || t === 'ellipse') {
      ev.preventDefault();
      const p = this._decorSnap(this._svgPoint(ev), ev.pointerType);
      this.host._decorDraft = { kind: t, a: p, b: p, pid: ev.pointerId };
      capturePointer(ev);
      return true;
    }
    if (t === 'text') {
      // …and the press did NOT land on an existing label: those are the one
      // exception to the inertness above (see _decorShapeDown).
      const p = this._decorSnap(this._svgPoint(ev), ev.pointerType);
      this.host._decorTextDialog = {
        x: clampCanvasN(p[0] / NORM_W), y: clampCanvasN(p[1] / this.host._decorH),
        text: '', color: this.host._decorStyle.color, opacity: this.host._decorStyle.opacity,
        angle: '0', sizeCm: decorUnitsToCm(DECOR_TEXT_BASE, this.host._cellCm, this.host._gridPitch),
      };
      this.host._decorTextSelection = { start: 0, end: 0 };
      return true;
    }
    if (t === 'furniture' || t === 'image') {
      // The furniture tool is a STAMP: the palette arms a symbol, the press
      // puts it down at its real size and the editor goes back to `select`
      // with the new piece selected (owner: «сразу выделен»). Without an armed
      // symbol the press does nothing but keep the pan — pressing the canvas
      // must not silently place whatever was chosen last week.
      if (t === 'furniture' ? !this.host._furnPalette : !this.host._decorImagePalette) return false;
      ev.preventDefault();
      // A mouse has already shown the exact result and keeps the traditional
      // one-press stamp. Touch/pen has no hover, so commit only after a clean
      // pointerup; pointercancel, movement and a second contact stay fail-dark.
      const pointerType = ev.pointerType || 'mouse';
      if (pointerType === 'mouse') {
        if (t === 'furniture') this._furnPlace(this._svgPoint(ev), ev.shiftKey, pointerType);
        else this._decorImagePlace(this._svgPoint(ev), pointerType);
        return true;
      }
      const pending = this.host._furnTouchPending;
      if (pending && pending.pid !== ev.pointerId) {
        pending.cancelled = true;
        this.host._furnPreviewInput = null;
        return true;
      }
      this.host._furnTouchPending = {
        pid: ev.pointerId,
        sx: ev.clientX,
        sy: ev.clientY,
        pointerType,
        cancelled: false,
      };
      this.host._furnPreviewInput = null;
      capturePointer(ev);
      return true;
    }
    // Empty-space selection belongs only to Select. Erase is an object
    // command: a miss must be a true no-op. With SVG text its painted glyphs
    // do not cover the whole logical label box, so clearing here made a click
    // between letters appear to erase only the selection outline.
    if (t === 'select') this.host._decorSel = null;
    // …and under its own tool the picture is grabbable by its body
    // (docs/BACKDROP.md §2). Only INSIDE the image rect: press beside the
    // picture and the plane still pans with one finger.
    if (this.host._bdMovable) {
      const r = this.host._bdRect!;
      const p = this._svgPoint(ev);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const a = (-normalizeAngle(r.angle) * Math.PI) / 180;
      const dx = p[0] - cx, dy = p[1] - cy;
      const local = [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
      if (local[0] >= r.x && local[0] <= r.x + r.w && local[1] >= r.y && local[1] <= r.y + r.h) {
        ev.preventDefault();
        return this._bdStart(ev);
      }
    }
    return false; // pan is allowed
  }

public _decorCommitDraft(): void {
    const d = this.host._decorDraft;
    this.host._decorDraft = null;
    if (!d) return;
    const min = this.host._gridPitch * 0.5;
    if (!validDecorDraft(d.kind, d.a, d.b, min)) return;
    const W = NORM_W, H = this.host._decorH;
    const st = this.host._decorStyle;
    const before = this._geometrySnapshot();
    const id = 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    // creation had no canvas guard at all while the MOVE did — a draft could be
    // born outside the range the mover then refused to leave. One limit, both
    // ends of the gesture (docs/CANVAS.md §9).
    const cn = clampCanvasN;
    let shape: DecorShape;
    if (d.kind === 'line') {
      shape = { id, kind: 'line', x1: cn(d.a[0] / W), y1: cn(d.a[1] / H),
        x2: cn(d.b[0] / W), y2: cn(d.b[1] / H), ...decorStylePatch(st, false) } as DecorShape;
    } else {
      const x = cn(Math.min(d.a[0], d.b[0]) / W), y = cn(Math.min(d.a[1], d.b[1]) / H);
      const w = Math.abs(d.b[0] - d.a[0]) / W, h = Math.abs(d.b[1] - d.a[1]) / H;
      shape = { id, kind: d.kind, x, y, w, h, ...decorStylePatch(st, true) } as DecorShape;
    }
    const sp = this.host._curSpaceCfg;
    sp.decor = [...this.host._decorList, shape];
    this.host._decorSel = id;
    this._recordGeometry(this.host._t('history.decor_add'), before);
    this._saveConfig();
    this.host.requestUpdate();
  }

public _decorShapeDown(ev: PointerEvent, shape: DecorShape): void {
    if (this.host._mode !== 'decor') return;
    // Under any other tool the shape is not a target at all: the press has to
    // reach the stage, where the drawing tool starts a new figure (or the
    // backdrop tool grabs the picture). Swallowing it here was the bug — the
    // click on a line end did nothing but keep the old selection alive.
    const t = this.host._decorTool;
    // ONE exception (owner, 2026-08-04): under the TEXT tool an existing LABEL
    // is a target again, and pressing it opens its editor instead of starting
    // a new label on top of it. Everything else stays inert — a press on a
    // line or a rectangle under the text tool still reaches the stage and
    // creates a new label there (the CSS keeps them pointer-inert, this is
    // the belt to that pair of braces).
    if (t === 'text') {
      if (shape.kind !== 'text') return;
      ev.stopPropagation();
      ev.preventDefault();
      this._decorOpenText(shape);
      return;
    }
    if (t !== 'select' && t !== 'erase') return;
    ev.stopPropagation();
    ev.preventDefault();
    if (t === 'erase') {
      this.host._decorEraseConfirm = { id: shape.id, kind: shape.kind };
      return;
    }
    this.host._decorSel = shape.id;
    this.host._decorMove = {
      id: shape.id, start: this._svgPoint(ev), orig: JSON.parse(JSON.stringify(shape)),
      pid: ev.pointerId, moved: false, before: this._geometrySnapshot(),
    };
    capturePointer(ev);
  }

public _decorMoveUpdate(ev: PointerEvent): void {
    const m = this.host._decorMove; if (!m) return;
    if (m.orig?.kind === 'furniture') { this._furnMoveUpdate(ev); return; }
    const p = this._svgPoint(ev);
    const o0: any = m.orig;
    // The delta used to be what got snapped, which preserves whatever off-grid
    // offset the shape already had: a legacy shape at 0.3013 stayed at 0.3013
    // for ever, one step at a time. Snap the RESULTING ANCHOR instead, so one
    // drag is enough to put any shape on the grid (docs/CANVAS.md §9).
    const ax0 = (o0.kind === 'line' ? o0.x1 : o0.x) * NORM_W;
    const ay0 = (o0.kind === 'line' ? o0.y1 : o0.y) * this.host._decorH;
    const anchor = this._decorSnap(
      [ax0 + (p[0] - m.start[0]), ay0 + (p[1] - m.start[1])],
      ev.pointerType, m.id,
    );
    let dx = (anchor[0] - ax0) / NORM_W;
    let dy = (anchor[1] - ay0) / this.host._decorH;
    // audit follow-up L4 gave decor a bounds clamp of -0.25..1.25 — the plan
    // was a sheet with edges then. It is not any more (docs/CANVAS.md): the
    // clamp is now the same garbage limit the backend enforces, so decor can
    // follow a plan that lives at 2.7 and still cannot be flung to 1e100.
    const o: any = m.orig;
    const curX = o.kind === 'line' ? Math.min(o.x1, o.x2) : o.x;
    const curY = o.kind === 'line' ? Math.min(o.y1, o.y2) : o.y;
    const w = o.kind === 'line' ? Math.abs(o.x2 - o.x1) : (o.w || 0);
    const h = o.kind === 'line' ? Math.abs(o.y2 - o.y1) : (o.h || 0);
    const lim = CANVAS_LIMIT;
    dx = Math.max(-lim - curX, Math.min(lim - curX - w, dx));
    dy = Math.max(-lim - curY, Math.min(lim - curY - h, dy));
    if (dx || dy) m.moved = true;
    const sp = this.host._curSpaceCfg;
    sp.decor = this.host._decorList.map((x) => {
      if (x.id !== m.id) return x;
      const o: any = m.orig;
      if (x.kind === 'line') return { ...x, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
      return { ...x, x: o.x + dx, y: o.y + dy };
    });
    this.host.requestUpdate();
  }
public _dmUp(): void {
    flushHouseplanPointerMove(this.host, 'decor-move'); const move = this.host._decorMove;
    if (move?.moved) { this._recordGeometry(this.host._t('history.decor_move'), move.before); this._saveConfig(); }
    this.host._decorMove = null; this.host.requestUpdate();
  }

public _decorShapeDbl(ev: MouseEvent, shape: DecorShape): void {
    if (this.host._mode !== 'decor' || this.host._decorTool !== 'select') return;
    ev.preventDefault();
    ev.stopPropagation();
    this.host._decorMove = null;
    this.host._decorSel = shape.id;
    this._openDecorProperties(shape);
  }

public _openDecorProperties(shape: DecorShape): void {
    if (this.host._mode !== 'decor' || this.host._decorTool !== 'select') return;
    if (shape.kind === 'text') {
      this._decorOpenText(shape);
      return;
    }
    if (!['line', 'rect', 'ellipse', 'furniture', 'image'].includes(shape.kind)) return;
    if (shape.kind === 'image') void this._decorImageCatalogLoad();
    const style = this.host._decorResolvedStyle(shape);
    const line = shape.kind === 'line' ? shape : null;
    const box = this.host._decorBoxOf(shape);
    this.host._decorShapeDialog = {
      id: shape.id,
      kind: shape.kind as 'line' | 'rect' | 'ellipse' | 'furniture' | 'image',
      color: style.color, opacity: style.opacity, widthCm: style.widthCm,
      angle: this.host._angleField(line
        ? normalizeAngle(segmentAngle(
            [line.x1 * NORM_W, line.y1 * this.host._decorH],
            [line.x2 * NORM_W, line.y2 * this.host._decorH],
          ))
        : normalizeAngle((shape as any).angle)),
      ...(line ? {
        lengthCm: decorUnitsToCm(
          Math.hypot((line.x2 - line.x1) * NORM_W, (line.y2 - line.y1) * this.host._decorH),
          this.host._cellCm, this.host._gridPitch,
        ),
        lineStyle: line.line_style === 'dashed' ? 'dashed' : 'solid',
      } : {}),
      ...(box ? {
        sizeWCm: decorUnitsToCm(box.w, this.host._cellCm, this.host._gridPitch),
        sizeHCm: decorUnitsToCm(box.h, this.host._cellCm, this.host._gridPitch),
      } : {}),
      ...(shape.kind === 'furniture' ? {
        symbol: shape.symbol,
        flipH: !!shape.flip_h,
        flipV: !!shape.flip_v,
        sizeWField: furnitureSignedFieldValue(
          decorUnitsToCm(box!.w, this.host._cellCm, this.host._gridPitch),
          !!shape.flip_h, this.host._imperial,
        ),
        sizeHField: furnitureSignedFieldValue(
          decorUnitsToCm(box!.h, this.host._cellCm, this.host._gridPitch),
          !!shape.flip_v, this.host._imperial,
        ),
      } : {}),
      ...(shape.kind === 'image' ? {
        assetId: shape.asset_id,
        flipH: !!shape.flip_h,
        flipV: !!shape.flip_v,
        sizeWField: furnitureSignedFieldValue(
          decorUnitsToCm(box!.w, this.host._cellCm, this.host._gridPitch),
          !!shape.flip_h, this.host._imperial,
        ),
        sizeHField: furnitureSignedFieldValue(
          decorUnitsToCm(box!.h, this.host._cellCm, this.host._gridPitch),
          !!shape.flip_v, this.host._imperial,
        ),
      } : {}),
      ...(shape.kind === 'rect' || shape.kind === 'ellipse' ? {
        fill: style.fill, fillColor: style.fillColor, fillOpacity: style.fillOpacity,
      } : {}),
    };
  }

public _decorOpenText(shape: DecorShape): void {
    if (shape.kind !== 'text') return;
    let text = String(shape.text ?? '');
    const hasInline = [...text.matchAll(/\{([^{}\r\n]+)\}/g)]
      .some((m) => !!liveTextReference(m[1]));
    const explicitUnit = String(shape.unit ?? '').trim();
    // Old dialogs represented the entity state as attr="state"; inline text
    // represents that same value with a bare `{entity}` token.
    const legacyAttr = String(shape.attr ?? '').trim().toLowerCase() === 'state'
      ? null
      : shape.attr;
    const legacyToken = !hasInline && !explicitUnit
      ? liveTextToken(shape.entity, legacyAttr)
      : '';
    const preserveLegacy = !!String(shape.entity ?? '').trim() && !hasInline
      && (!legacyToken || !!explicitUnit);
    if (legacyToken && !preserveLegacy) {
      const slot = text.indexOf('{}');
      text = slot >= 0
        ? text.slice(0, slot) + legacyToken + text.slice(slot + 2)
        : `${text}${text ? ' ' : ''}${legacyToken}`;
    }
    this.host._decorTextDialog = {
      id: shape.id, x: shape.x, y: shape.y, text,
      color: safeStoredColor(shape.color, this.host._decorStyle.color),
      opacity: clamp01(shape.opacity, this.host._decorStyle.opacity),
      angle: this.host._angleField(shape.angle),
      sizeCm: this.host._decorTextSizeCm(shape),
      pickerEntity: shape.entity || '',
      preserveLegacy: preserveLegacy || undefined,
    };
    this.host._decorTextSelection = { start: text.length, end: text.length };
  }

public _decorRememberTextSelection(el: HTMLTextAreaElement): void {
    this.host._decorTextSelection = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  }

public _decorInsertLiveVariable(attr: string | null): void {
    const d = this.host._decorTextDialog;
    if (!d) return;
    const token = liveTextToken(d.pickerEntity, attr);
    if (!token) return;
    const old = d.text;
    const start = Math.max(0, Math.min(old.length, this.host._decorTextSelection.start));
    const end = Math.max(start, Math.min(old.length, this.host._decorTextSelection.end));
    if (old.length - (end - start) + token.length > 200) return;
    const text = old.slice(0, start) + token + old.slice(end);
    const caret = start + token.length;
    this.host._decorTextSelection = { start: caret, end: caret };
    // Inserting a new inline reference is the explicit replacement of any
    // unrepresentable legacy link; the stale side fields can now be dropped.
    this.host._decorTextDialog = { ...d, text, preserveLegacy: undefined };
    this.host.updateComplete.then(() => {
      const el = this.host.renderRoot.querySelector<HTMLTextAreaElement>('textarea.dtarea');
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

public _decorSaveText(): void {
    const d = this.host._decorTextDialog;
    // The user's own line breaks are kept; the surrounding whitespace is not.
    const text = String(d?.text ?? '').replace(/\r\n?/g, '\n').trim();
    if (!d || !text) { this.host._decorTextDialog = null; return; }
    const before = this._geometrySnapshot();
    const sp = this.host._curSpaceCfg;
    const textStyle = {
      color: d.color, opacity: clamp01(d.opacity),
      size_cm: Number(Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, d.sizeCm)).toFixed(4)),
      ...(normalizeAngle(d.angle) ? { angle: normalizeAngle(d.angle) } : {}),
    };
    if (d.id) {
      sp.decor = this.host._decorList.map((x) => {
        if (x.id !== d.id) return x;
        if (x.kind !== 'text') return x;
        // A legacy unit or non-canonical attribute cannot be represented by
        // the inline grammar. Keep those fields until the user explicitly
        // replaces the binding; ordinary representable links still migrate.
        if (d.preserveLegacy) {
          const { angle: _angle, size: _size, scale: _scale, ...straight } = x;
          return { ...straight, text, ...textStyle };
        }
        // beta.9 and earlier stored one live link beside the text. Saving in
        // the new editor migrates it to inline tokens and drops the old fields.
        const { entity, attr, unit, ...rest } = x;
        const { angle: _angle, size: _size, scale: _scale, ...straight } = rest;
        return { ...straight, text, ...textStyle };
      });
    } else {
      const id = 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      sp.decor = [...this.host._decorList, { id, kind: 'text', x: d.x, y: d.y,
        text, ...textStyle }];
      this.host._decorSel = id;
    }
    this.host._decorTextDialog = null;
    this._recordGeometry(this.host._t(d.id ? 'history.decor_edit' : 'history.decor_add'), before);
    this._saveConfig();
    this.host.requestUpdate();
  }

public _decorSaveShape(): void {
    const d = this.host._decorShapeDialog;
    if (!d) return;
    const before = this._geometrySnapshot();
    const style: DecorStyle = {
      color: d.color, opacity: clamp01(d.opacity),
      widthCm: Math.max(0.1, Math.min(100, Number(d.widthCm) || 0.1)),
      fill: !!d.fill, fillColor: d.fillColor || d.color,
      fillOpacity: clamp01(d.fillOpacity, 0.25),
    };
    const sp = this.host._curSpaceCfg;
    const furnitureWcm = d.kind === 'furniture' || d.kind === 'image'
      ? furnitureSignedFieldCm(
          d.sizeWField, this.host._imperial, CANVAS_LIMIT * this.host._cellCm,
        ) : null;
    const furnitureHcm = d.kind === 'furniture' || d.kind === 'image'
      ? furnitureSignedFieldCm(
          d.sizeHField, this.host._imperial, CANVAS_LIMIT * this.host._cellCm,
        ) : null;
    if ((d.kind === 'furniture' || d.kind === 'image')
        && (furnitureWcm === null || furnitureHcm === null)) return;
    sp.decor = this.host._decorList.map((shape) => {
      if (shape.id !== d.id) return shape;
      const fillable = d.kind === 'rect' || d.kind === 'ellipse';
      const visual = decorStylePatch(style, fillable);
      if (shape.kind === 'line') {
        const cx = ((shape.x1 + shape.x2) / 2) * NORM_W;
        const cy = ((shape.y1 + shape.y2) / 2) * this.host._decorH;
        const length = decorCmToUnits(Math.max(0.1, Number(d.lengthCm) || 0.1), this.host._cellCm, this.host._gridPitch);
        const rad = (normalizeAngle(d.angle) * Math.PI) / 180;
        const dx = Math.cos(rad) * length / 2, dy = Math.sin(rad) * length / 2;
        const a = this._snap([cx - dx, cy - dy]);
        const b = this._snap([cx + dx, cy + dy]);
        const { width: _legacyWidth, line_style: _oldLineStyle, ...rest } = shape;
        return { ...rest, ...visual,
          x1: clampCanvasN(a[0] / NORM_W), y1: clampCanvasN(a[1] / this.host._decorH),
          x2: clampCanvasN(b[0] / NORM_W), y2: clampCanvasN(b[1] / this.host._decorH),
          ...(d.lineStyle === 'dashed' ? { line_style: 'dashed' as const } : {}),
        } as DecorShape;
      }
      if (shape.kind === 'furniture') {
        const oldW = shape.w * NORM_W, oldH = shape.h * this.host._decorH;
        const w = decorCmToUnits(Math.abs(furnitureWcm!), this.host._cellCm, this.host._gridPitch);
        const h = decorCmToUnits(Math.abs(furnitureHcm!), this.host._cellCm, this.host._gridPitch);
        const cx = shape.x * NORM_W + oldW / 2, cy = shape.y * this.host._decorH + oldH / 2;
        const angle = normalizeAngle(d.angle);
        const { width: _legacyWidth, angle: _oldAngle, flip_h: _oldFlipH,
          flip_v: _oldFlipV, ...rest } = shape;
        return { ...rest, ...visual,
          x: clampCanvasN((cx - w / 2) / NORM_W),
          y: clampCanvasN((cy - h / 2) / this.host._decorH),
          w: w / NORM_W, h: h / this.host._decorH,
          ...(d.symbol ? { symbol: d.symbol } : {}),
          ...(furnitureWcm! < 0 ? { flip_h: true } : {}),
          ...(furnitureHcm! < 0 ? { flip_v: true } : {}),
          ...(angle ? { angle } : {}),
        } as DecorShape;
      }
      if (shape.kind === 'image') {
        const oldW = shape.w * NORM_W, oldH = shape.h * this.host._decorH;
        const w = decorCmToUnits(Math.abs(furnitureWcm!), this.host._cellCm, this.host._gridPitch);
        const h = decorCmToUnits(Math.abs(furnitureHcm!), this.host._cellCm, this.host._gridPitch);
        const cx = shape.x * NORM_W + oldW / 2, cy = shape.y * this.host._decorH + oldH / 2;
        const angle = normalizeAngle(d.angle);
        return {
          id: shape.id, kind: 'image' as const,
          asset_id: d.assetId || shape.asset_id,
          x: clampCanvasN((cx - w / 2) / NORM_W),
          y: clampCanvasN((cy - h / 2) / this.host._decorH),
          w: w / NORM_W, h: h / this.host._decorH,
          opacity: clamp01(d.opacity, 1),
          ...(furnitureWcm! < 0 ? { flip_h: true } : {}),
          ...(furnitureHcm! < 0 ? { flip_v: true } : {}),
          ...(angle ? { angle } : {}),
        } as DecorShape;
      }
      if (shape.kind === 'rect' || shape.kind === 'ellipse') {
        const oldW = shape.w * NORM_W, oldH = shape.h * this.host._decorH;
        const w = Math.max(this.host._gridPitch, snapToGrid(
          decorCmToUnits(Number(d.sizeWCm), this.host._cellCm, this.host._gridPitch), this.host._gridPitch,
        ));
        const h = Math.max(this.host._gridPitch, snapToGrid(
          decorCmToUnits(Number(d.sizeHCm), this.host._cellCm, this.host._gridPitch), this.host._gridPitch,
        ));
        const cx = shape.x * NORM_W + oldW / 2, cy = shape.y * this.host._decorH + oldH / 2;
        const angle = normalizeAngle(d.angle);
        const topLeft = resizedBoxTopLeft(
          { x: cx - w / 2, y: cy - h / 2 }, angle,
          (point) => this._snap(point),
        );
        const { width: _legacyWidth, angle: _oldAngle, ...rest } = shape;
        return { ...rest, ...visual,
          x: clampCanvasN(topLeft[0] / NORM_W), y: clampCanvasN(topLeft[1] / this.host._decorH),
          w: w / NORM_W, h: h / this.host._decorH,
          ...(angle ? { angle } : {}),
        } as DecorShape;
      }
      return shape;
    });
    if (d.kind !== 'image') this._updateDecorStyle({ ...style,
      fill: d.kind === 'rect' || d.kind === 'ellipse' ? style.fill : this.host._decorStyle.fill,
      fillColor: d.kind === 'rect' || d.kind === 'ellipse' ? style.fillColor : this.host._decorStyle.fillColor,
      fillOpacity: d.kind === 'rect' || d.kind === 'ellipse' ? style.fillOpacity : this.host._decorStyle.fillOpacity,
    });
    this.host._decorShapeDialog = null;
    this._recordGeometry(this.host._t('history.decor_edit'), before);
    this._saveConfig();
    this.host.requestUpdate();
  }

public _dtPivot(sh: DecorShape): number[] {
    if (sh.kind === 'line') return [
      ((sh.x1 + sh.x2) / 2) * NORM_W,
      ((sh.y1 + sh.y2) / 2) * this.host._decorH,
    ];
    if (sh.kind === 'furniture' || sh.kind === 'image'
        || sh.kind === 'rect' || sh.kind === 'ellipse')
      return [(sh.x + sh.w / 2) * NORM_W, (sh.y + sh.h / 2) * this.host._decorH];
    return [sh.x * NORM_W, sh.y * this.host._decorH];
  }

public _dtApply(id: string, patch: { textSizeCm?: number; angle?: number }): void {
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    sp.decor = this.host._decorList.map((x) => {
      if (x.id !== id) return x;
      const rest: any = { ...x };
      if (x.kind === 'text' && patch.textSizeCm !== undefined) {
        delete rest.size;
        delete rest.scale;
      }
      const out: any = { ...rest };
      if (patch.textSizeCm !== undefined)
        out.size_cm = Number(Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, patch.textSizeCm)).toFixed(4));
      if (patch.angle !== undefined) {
        if (patch.angle) out.angle = Number(patch.angle.toFixed(2));
        else delete out.angle; // straight again = the field goes away
      }
      return out;
    });
    this.host._cfgEpoch++;
    this.host.requestUpdate();
  }

public _dtStart(
    ev: PointerEvent, kind: 'scale' | 'rotate', corner?: number[], lineEnd?: 0 | 1,
  ): void {
    const sh = this.host._dtSel;
    if (!sh) return;
    ev.stopPropagation();
    ev.preventDefault();
    const [ax, ay] = this._dtPivot(sh);
    const p = this._svgPoint(ev);
    const box = this.host._decorBoxOf(sh);
    this.host._dtDrag = {
      id: sh.id, kind, pid: ev.pointerId, ax, ay,
      r0: Math.hypot(p[0] - ax, p[1] - ay),
      a0: (Math.atan2(p[1] - ay, p[0] - ax) * 180) / Math.PI,
      textSizeCm0: sh.kind === 'text' ? this.host._decorTextSizeCm(sh) : 1,
      angle0: sh.kind === 'line' ? 0 : Number(sh.angle) || 0,
      // which corner is being pulled, and the box it started from: a piece of
      // furniture is resized about the OPPOSITE corner, so both have to be
      // remembered — a label, scaled about its anchor, needs neither
      sgx: corner?.[0], sgy: corner?.[1],
      orig: box || undefined,
      origShape: JSON.parse(JSON.stringify(sh)),
      before: this._geometrySnapshot(),
      lineEnd,
      moved: false,
    };
    capturePointer(ev);
  }

public _dtMove(ev: PointerEvent): void {
    const d = this.host._dtDrag;
    if (!d) return;
    const p = this._svgPoint(ev);
    if (d.lineEnd !== undefined && d.origShape.kind === 'line') {
      const at = this._decorSnap(p, ev.pointerType, d.id);
      const nx = clampCanvasN(at[0] / NORM_W), ny = clampCanvasN(at[1] / this.host._decorH);
      const old = d.origShape;
      const ox = d.lineEnd === 0 ? old.x1 : old.x2;
      const oy = d.lineEnd === 0 ? old.y1 : old.y2;
      if (Math.abs(nx - ox) > 1e-9 || Math.abs(ny - oy) > 1e-9) d.moved = true;
      this._replaceDecor(d.id, d.lineEnd === 0 ? { x1: nx, y1: ny } : { x2: nx, y2: ny });
      return;
    }
    if (d.kind === 'scale' && d.orig) {
      if (d.origShape.kind === 'furniture' || d.origShape.kind === 'image') {
        const box = resizeFurnitureTransform(
          { ...d.orig, flip_h: d.origShape.flip_h, flip_v: d.origShape.flip_v },
          d.sgx ?? 1, d.sgy ?? 1, p[0], p[1],
          !ev.shiftKey, decorCmToUnits(0.1, this.host._cellCm, this.host._gridPitch),
        );
        const changed = Math.abs(box.x - d.orig.x) > 1e-9 || Math.abs(box.y - d.orig.y) > 1e-9
          || Math.abs(box.w - d.orig.w) > 1e-9 || Math.abs(box.h - d.orig.h) > 1e-9
          || !!box.flip_h !== !!d.origShape.flip_h || !!box.flip_v !== !!d.origShape.flip_v;
        if (!changed && !d.moved) return;
        d.moved ||= changed;
        this._decorApplyFurnitureBox(d.id, box);
        return;
      }
      // Box geometry preserves ratio by default and separates axes with Shift.
      // Each dimension lands on a whole cell.
      const box = resizeDecorBox(
        d.orig, d.sgx ?? 1, d.sgy ?? 1, p[0], p[1],
        !ev.shiftKey, this.host._gridPitch, this.host._gridPitch,
      );
      const changed = Math.abs(box.x - d.orig.x) > 1e-6 || Math.abs(box.y - d.orig.y) > 1e-6
        || Math.abs(box.w - d.orig.w) > 1e-6 || Math.abs(box.h - d.orig.h) > 1e-6;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._decorApplyBox(d.id, box);
      return;
    }
    if (d.kind === 'scale') {
      // uniform, about the anchor: the distance from the anchor is invariant
      // under the block's own rotation, so a rotated block scales the same way
      const r = Math.hypot(p[0] - d.ax, p[1] - d.ay);
      if (d.r0 < 1e-6) return;
      const sizeCm = Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, d.textSizeCm0 * (r / d.r0)));
      const changed = Math.abs(sizeCm - d.textSizeCm0) > 1e-6;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._dtApply(d.id, { textSizeCm: sizeCm });
      return;
    }
    const a = (Math.atan2(p[1] - d.ay, p[0] - d.ax) * 180) / Math.PI;
    let ang: number;
    if (d.origShape.kind === 'furniture' || d.origShape.kind === 'image') {
      ang = furnitureRotationAngle(d.angle0, d.a0, a, ev.shiftKey);
    } else {
      ang = d.angle0 + (a - d.a0);
      // Existing non-furniture contract: 5° normally, Shift = free.
      if (!ev.shiftKey) ang = Math.round(ang / DT_ANGLE_STEP) * DT_ANGLE_STEP;
      ang = ((ang % 360) + 360) % 360;
      if (ang > 180) ang -= 360;
    }
    const changed = Math.abs(ang - d.angle0) > 1e-6;
    if (!changed && !d.moved) return;
    d.moved ||= changed;
    this._dtApply(d.id, { angle: ang });
  }

public _dtUp(): void {
    const d = this.host._dtDrag;
    this.host._dtDrag = null;
    if (d?.moved) {
      this._recordGeometry(this.host._t('history.decor_transform'), d.before);
      this._saveConfig();
    }
    this.host.requestUpdate();
  }

public _dtMeasure(): void {
    measureHouseplanDecorText(this.host);
  }

public _deleteDecor(id: string): void {
    if (!this.host._decorList.some((shape) => shape.id === id)) return;
    const before = this._geometrySnapshot();
    const sp = this.host._curSpaceCfg;
    sp.decor = this.host._decorList.filter((shape) => shape.id !== id);
    if (this.host._decorSel === id) this.host._decorSel = null;
    this._recordGeometry(this.host._t('history.decor_delete'), before);
    this._saveConfig();
    this.host.requestUpdate();
  }

public _decorDeleteSel(): void {
    if (this.host._decorSel) this._deleteDecor(this.host._decorSel);
  }

public _confirmDecorErase(): void {
    const pending = this.host._decorEraseConfirm;
    this.host._decorEraseConfirm = null;
    if (pending) this._deleteDecor(pending.id);
  }

public _furnFieldValue(cm: number): number {
    return Math.round((this.host._imperial ? cm / 30.48 : cm / 100) * 100) / 100;
  }

public _furnFieldToCm(v: number): number {
    return clampFurnCm(this.host._imperial ? v * 30.48 : v * 100);
  }

/** #369(д): the preview must follow Shift even without mouse movement. */
private _furnShiftListener = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Shift') return;
    const input = this.host._furnPreviewInput;
    if (!input) return;
    const free = ev.type === 'keydown';
    if (input.free === free) return;
    this.host._furnPreviewInput = { ...input, free };
    this.host.requestUpdate();
  };

private _furnShiftAttached = false;

private _furnShiftAttach(): void {
    if (this._furnShiftAttached) return;
    this._furnShiftAttached = true;
    window.addEventListener('keydown', this._furnShiftListener);
    window.addEventListener('keyup', this._furnShiftListener);
  }

public _furnShiftDetach(): void {
    if (!this._furnShiftAttached) return;
    this._furnShiftAttached = false;
    window.removeEventListener('keydown', this._furnShiftListener);
    window.removeEventListener('keyup', this._furnShiftListener);
  }

public _furnPick(symbol: string): void {
    const d = furnitureDefaultCm(symbol);
    this.host._furnPalette = { symbol, w: d.w, h: d.h };
    this._furnShiftAttach();
}

/** Cached room-facing surfaces plus already-physical independent body faces. */
private get _furnWalls(): readonly FurnitureWallSurface[] {
  return furnitureWallSurfacesFor(this.host);
}

public _resolveFurniturePlacement(
    raw: number[], free = false, pointerType = 'mouse',
  ): FurniturePlacement | null {
    const pal = this.host._furnPalette;
    const sp = this.host._curSpaceCfg;
    if (!pal || !sp) return null;
    const W = NORM_W, H = this.host._decorH;
    const snapped = this._decorSnap(raw, pointerType);
    return resolveFurniturePlacement({
      symbol: pal.symbol,
      widthCm: pal.w,
      depthCm: pal.h,
      point: [snapped[0], snapped[1]],
      canvasW: W,
      canvasH: H,
      cellCm: this.host._cellCm,
      gridPitch: this.host._gridPitch,
      walls: this._furnWalls,
      wallReach: this.host._gridPitch * FURN_WALL_CELLS,
      intentPoint: [raw[0], raw[1]],
      free,
  });
}

public _furniturePreviewPlacement(): FurniturePlacement | null {
  const input = this.host._furnPreviewInput;
  if (!input || this.host._mode !== 'decor' || this.host._decorTool !== 'furniture'
      || !this.host._furnPalette || !this.host._pointerModality.hoverEnabled) return null;
  return this._resolveFurniturePlacement(input.raw, input.free, 'mouse');
}

/** One real furniture path, in the same decor composition group as saved
 * shapes. It paints after them and the whole decor layer remains below walls. */
public _renderFurniturePlacementPreview(
  furnitureScreenScale: number,
): TemplateResult | typeof nothing {
  const placement = this._furniturePreviewPlacement();
  if (!placement) return nothing;
  const art = furnitureGraphic(placement.symbol);
  if (!art) return nothing;
  const transform = furnitureRenderTransform(
    placement, NORM_W, this.host._decorH, art.viewW, art.viewH,
  );
  const style = this.host._decorStyle;
  const strokeWidth = furnitureStrokePx(
    decorCmToUnits(style.widthCm, this.host._cellCm, this.host._gridPitch),
    furnitureScreenScale,
  );
  return svg`<path class="furniture-placement-preview dfurn"
    data-symbol=${placement.symbol} d=${art.d} transform=${transform}
    stroke=${style.color} stroke-opacity=${style.opacity}
    stroke-width=${strokeWidth}
    fill="none" stroke-linecap="round" stroke-linejoin="round"
    vector-effect="non-scaling-stroke" aria-hidden="true" pointer-events="none"></path>`;
}

/** Live width/depth labels for a furniture corner resize. */
public _furnLive(): { x: number; y: number; text: string }[] | null {
  const drag = this.host._dtDrag;
  if (!drag || drag.kind !== 'scale' || !drag.orig) return null;
  const shape = this.host._decorList.find((item) => item.id === drag.id);
  if (!shape || shape.kind !== 'furniture') return null;
  const w = shape.w * NORM_W;
  const h = shape.h * this.host._decorH;
  const corners = furnitureCorners(
    shape.x * NORM_W, shape.y * this.host._decorH, w, h, Number(shape.angle) || 0,
  );
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const top = mid(corners[0], corners[1]);
  const left = mid(corners[0], corners[3]);
  return [
    { x: top[0], y: top[1], text: this.host._fmtLen([0, 0], [w, 0]) },
    { x: left[0], y: left[1], text: this.host._fmtLen([0, 0], [0, h]) },
  ];
}

public _furnPlace(raw: number[], free = false, pointerType = 'mouse'): void {
    const placement = this._resolveFurniturePlacement(raw, free, pointerType);
    if (!placement) return;
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    const before = this._geometrySnapshot();
    const id = 'df' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const shape: any = {
      id, kind: 'furniture', symbol: placement.symbol,
      x: placement.x, y: placement.y, w: placement.w, h: placement.h,
      ...decorStylePatch(this.host._decorStyle, false),
    };
    // a straight piece stores no angle at all, exactly as a straight label
    // stores none (docs/LIVE-TEXT.md §3)
    if (placement.angle) shape.angle = placement.angle;
    sp.decor = [...this.host._decorList, shape];
    this.host._decorSel = id;
    // …and the editor goes back to the tool that can move what was just placed
    this.host._decorTool = 'select';
    this.host._furnPalette = null;
    this.host._furnCategory = null;
    this._furnShiftDetach();
    this._clearFurniturePreview();
    this._recordGeometry(this.host._t('history.decor_add'), before);
    this._saveConfig();
    this.host.requestUpdate();
  }

public _clearFurniturePreview(): void {
    this.host._furnPreviewInput = null;
    this.host._furnTouchPending = null;
  }

/** Track only real fine-pointer hover. Touch/pen own a delayed one-tap
 * transaction below and must never resurrect a compatibility mouse ghost. */
public _furnPointerMove(ev: PointerEvent, hoverAllowed: boolean): boolean {
    const pending = this.host._furnTouchPending;
    if (pending?.pid === ev.pointerId) {
      if (Math.abs(ev.clientX - pending.sx) + Math.abs(ev.clientY - pending.sy) > 8) {
        pending.cancelled = true;
      }
      this.host._furnPreviewInput = null;
      return true;
    }
    const armed = this.host._decorTool === 'furniture'
      ? !!this.host._furnPalette
      : this.host._decorTool === 'image' && !!this.host._decorImagePalette;
    if (this.host._mode !== 'decor' || !armed) {
      this._clearFurniturePreview();
      return false;
    }
    if (ev.pointerType !== 'mouse' || !hoverAllowed) {
      this.host._furnPreviewInput = null;
      return false;
    }
    const raw = this._svgPoint(ev);
    this.host._furnPreviewInput = { raw: [raw[0], raw[1]], free: ev.shiftKey };
    return true;
  }

public _furnPointerLeave(ev: PointerEvent): void {
    if (this.host._furnTouchPending?.pid === ev.pointerId) {
      this.host._furnTouchPending.cancelled = true;
    }
    this.host._furnPreviewInput = null;
  }

public _furnPointerUp(ev: PointerEvent): boolean {
    const pending = this.host._furnTouchPending;
    if (!pending || pending.pid !== ev.pointerId) return false;
    this.host._furnTouchPending = null;
    if (!pending.cancelled && this.host._mode === 'decor'
        && ((this.host._decorTool === 'furniture' && this.host._furnPalette)
          || (this.host._decorTool === 'image' && this.host._decorImagePalette))) {
      if (this.host._decorTool === 'furniture')
        this._furnPlace(this._svgPoint(ev), ev.shiftKey, pending.pointerType);
      else this._decorImagePlace(this._svgPoint(ev), pending.pointerType);
    }
    return true;
  }

public _furnMoveUpdate(ev: PointerEvent): void {
    const m = this.host._decorMove; if (!m) return;
    if (m.orig.kind !== 'furniture') return;
    const o: any = m.orig;
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    const W = NORM_W, H = this.host._decorH;
    const p = this._svgPoint(ev);
    const rawCx = (o.x + o.w / 2) * W + (p[0] - m.start[0]);
    const rawCy = (o.y + o.h / 2) * H + (p[1] - m.start[1]);
    let x: number, y: number;
    let angle = Number(o.angle) || 0;
    const angleRad = angle * Math.PI / 180, preferredNormal: [number, number] = [-Math.sin(angleRad), Math.cos(angleRad)];
    const snap = ev.shiftKey ? null : snapFurnitureToWall(
      rawCx, rawCy, o.h * H, this._furnWalls,
      this.host._gridPitch * FURN_WALL_CELLS, this.host._gridPitch,
      [rawCx, rawCy], preferredNormal);
    if (snap) {
      x = snap.cx / W - o.w / 2;
      y = snap.cy / H - o.h / 2;
      angle = snap.angle;
    } else {
      const a = this._decorSnap(
        [rawCx - (o.w / 2) * W, rawCy - (o.h / 2) * H], ev.pointerType, m.id,
      );
      x = a[0] / W;
      y = a[1] / H;
    }
    x = clampCanvasN(x); y = clampCanvasN(y);
    if (Math.abs(x - o.x) > 1e-9 || Math.abs(y - o.y) > 1e-9
        || Math.abs(angle - (Number(o.angle) || 0)) > 1e-9) m.moved = true;
    sp.decor = this.host._decorList.map((s) => {
      if (s.id !== m.id) return s;
      const out: any = { ...s, x, y };
      if (angle) out.angle = Number(angle.toFixed(2));
      else delete out.angle;
      return out;
    });
    this.host.requestUpdate();
  }

public _decorApplyBox(id: string, box: { x: number; y: number; w: number; h: number }): void {
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    const W = NORM_W, H = this.host._decorH;
    sp.decor = this.host._decorList.map((s) => {
      if (s.id !== id) return s;
      const topLeft = resizedBoxTopLeft(
        box, (s as any).angle, (point) => this._snap(point),
      );
      return {
        ...s,
        x: clampCanvasN(topLeft[0] / W), y: clampCanvasN(topLeft[1] / H),
        w: Math.max(this.host._gridPitch / W, Math.min(CANVAS_LIMIT * 2, box.w / W)),
        h: Math.max(this.host._gridPitch / H, Math.min(CANVAS_LIMIT * 2, box.h / H)),
      } as DecorShape;
    });
    this.host._cfgEpoch++;
    this.host.requestUpdate();
  }

  public _decorApplyFurnitureBox(id: string, box: FurnitureResizeResult): void {
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    const W = NORM_W, H = this.host._decorH;
    const minUnits = decorCmToUnits(0.1, this.host._cellCm, this.host._gridPitch);
    sp.decor = this.host._decorList.map((shape) => {
      if (shape.id !== id || (shape.kind !== 'furniture' && shape.kind !== 'image')) return shape;
      const { flip_h: _oldFlipH, flip_v: _oldFlipV, ...rest } = shape;
      return {
        ...rest,
        x: clampCanvasN(box.x / W), y: clampCanvasN(box.y / H),
        w: Math.max(minUnits / W, Math.min(CANVAS_LIMIT * 2, box.w / W)),
        h: Math.max(minUnits / H, Math.min(CANVAS_LIMIT * 2, box.h / H)),
        ...(box.flip_h ? { flip_h: true } : {}),
        ...(box.flip_v ? { flip_v: true } : {}),
      } as DecorShape;
    });
    this.host._cfgEpoch++;
    this.host.requestUpdate();
  }

public _decorImagePlace(raw: number[], pointerType = 'mouse'): void {
  this._decorImages.place(raw, pointerType);
}

public _renderDecorImagePlacementPreview(): TemplateResult | typeof nothing {
  return this._decorImages.renderPlacementPreview();
}

public _renderMissingDecorImage(
  shape: Extract<DecorShape, { kind: 'image' }>, cls: string, transform: string,
  x: number, y: number, w: number, h: number,
  down: (event: PointerEvent) => void, dbl: (event: MouseEvent) => void,
): TemplateResult {
  return this._decorImages.renderMissing(shape, cls, transform, x, y, w, h, down, dbl);
}

public async _decorImageUpload(ev: Event, replaceSelection = false): Promise<void> {
  await this._decorImages.uploadFromInput(ev, replaceSelection);
  }

private async _uploadDecorImage(
    file: Blob, name: string, replaceSelection: boolean,
): Promise<void> {
  await this._decorImages.upload(file, name, replaceSelection);
  }

public async _decorImageDelete(asset: DecorAsset): Promise<void> {
  await this._decorImages.delete(asset);
}

private async _decorImageCatalogLoad(): Promise<void> {
  await this._decorImages.loadCatalog();
}

public _renderDecorImagePalette(): TemplateResult {
  return this._decorImages.renderImagePalette();
  }

public _renderFurnPalette(): TemplateResult {
  return this._decorImages.renderFurniturePalette();
  }

public _openBackdropDialog(ev?: Event): void {
    if (!this.host._bdMovable || !this.host._bdRect) return;
    ev?.preventDefault();
    ev?.stopPropagation();
    this.host._bdDrag = null;
    const r = this.host._bdRect;
    this.host._backdropDialog = {
      widthCm: decorUnitsToCm(r.w, this.host._cellCm, this.host._gridPitch),
      heightCm: decorUnitsToCm(r.h, this.host._cellCm, this.host._gridPitch),
      angle: this.host._angleField(r.angle),
    };
  }

public _saveBackdropDialog(): void {
    const d = this.host._backdropDialog;
    const base = this.host._bdBase, current = this.host._bdRect;
    if (!d || !base || !current) return;
    const angle = normalizeAngle(d.angle);
    const before = this._geometrySnapshot();
    const w = Math.min(base.w * PLAN_SCALE_MAX, Math.max(
      base.w * PLAN_SCALE_MIN, snapToGrid(
        decorCmToUnits(d.widthCm, this.host._cellCm, this.host._gridPitch), this.host._gridPitch,
      ),
    ));
    const h = Math.min(base.h * PLAN_SCALE_MAX, Math.max(
      base.h * PLAN_SCALE_MIN, snapToGrid(
        decorCmToUnits(d.heightCm, this.host._cellCm, this.host._gridPitch), this.host._gridPitch,
      ),
    ));
    const cx = current.x + current.w / 2, cy = current.y + current.h / 2;
    const topLeft = resizedBoxTopLeft(
      { x: cx - w / 2, y: cy - h / 2 }, angle,
      (point) => this._snap(point),
    );
    this._bdApply((topLeft[0] - base.x) / NORM_W, (topLeft[1] - base.y) / NORM_W,
      w / base.w, h / base.h, angle);
    this.host._backdropDialog = null;
    this._recordGeometry(this.host._t('history.backdrop_transform'), before);
    this._saveConfig();
  }

public _bdApply(dx: number, dy: number, sx: number, sy: number, angle: number): void {
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    // 6 decimals: the same precision the rest of the normalised config keeps,
    // and enough for a 1000-unit canvas to be exact to a thousandth of a pixel
    sp.plan_x = Number(clampCanvasN(dx).toFixed(6));
    sp.plan_y = Number(clampCanvasN(dy).toFixed(6));
    delete sp.plan_scale;
    sp.plan_scale_x = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, sx)).toFixed(6));
    sp.plan_scale_y = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, sy)).toFixed(6));
    const a = normalizeAngle(angle);
    if (a) sp.plan_angle = Number(a.toFixed(2));
    else delete sp.plan_angle;
    this.host._cfgEpoch++;
    this.host.requestUpdate();
  }

public _bdStart(ev: PointerEvent, corner?: number[], rotate = false): boolean {
    const base = this.host._bdBase, r = this.host._bdRect;
    if (!base || !r) return false;
    const p = this._svgPoint(ev);
    const sgx = corner ? corner[0] : 0;
    const sgy = corner ? corner[1] : 0;
    // the corner that stays put is the OPPOSITE one
    const fx = sgx > 0 ? r.x : r.x + r.w;
    const fy = sgy > 0 ? r.y : r.y + r.h;
    this.host._bdDrag = {
      kind: rotate ? 'rotate' : corner ? 'scale' : 'move',
      pid: ev.pointerId,
      sx: p[0], sy: p[1],
      base, p0: this.host._bdParams,
      fx, fy, sgx, sgy,
      rect0: { x: r.x, y: r.y, w: r.w, h: r.h, angle: r.angle },
      before: this._geometrySnapshot(),
      moved: false,
    };
    capturePointer(ev);
    return true;
  }

public _bdMove(ev: PointerEvent): void {
    queueHouseplanPointerMove(this.host, 'backdrop', () => this._bdMoveNow(ev));
  }

private _bdMoveNow(ev: PointerEvent): void {
    const d = this.host._bdDrag;
    if (!d) return;
    const p = this._svgPoint(ev);
    const b = d.base;
    if (d.kind === 'move') {
      const x0 = d.rect0.x, y0 = d.rect0.y;
      const at = this._snap([x0 + (p[0] - d.sx), y0 + (p[1] - d.sy)]);
      const changed = Math.abs(at[0] - x0) > 1e-9 || Math.abs(at[1] - y0) > 1e-9;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._bdApply((at[0] - b.x) / NORM_W, (at[1] - b.y) / NORM_W,
        d.p0.sx, d.p0.sy, d.p0.angle);
      return;
    }
    if (d.kind === 'rotate') {
      const cx = d.rect0.x + d.rect0.w / 2, cy = d.rect0.y + d.rect0.h / 2;
      const a0 = Math.atan2(d.sy - cy, d.sx - cx) * 180 / Math.PI;
      let angle = d.p0.angle + (Math.atan2(p[1] - cy, p[0] - cx) * 180 / Math.PI - a0);
      if (!ev.shiftKey) angle = Math.round(angle / DT_ANGLE_STEP) * DT_ANGLE_STEP;
      angle = normalizeAngle(angle);
      const changed = Math.abs(angle - d.p0.angle) > 1e-9;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._bdApply(d.p0.dx, d.p0.dy, d.p0.sx, d.p0.sy, angle);
      return;
    }
    const box = resizeDecorBox(
      d.rect0, d.sgx, d.sgy, p[0], p[1], !ev.shiftKey,
      this.host._gridPitch, Math.min(b.w, b.h) * PLAN_SCALE_MIN,
    );
    const sx = box.w / Math.max(1e-9, b.w), sy = box.h / Math.max(1e-9, b.h);
    const changed = Math.abs(sx - d.p0.sx) > 1e-9 || Math.abs(sy - d.p0.sy) > 1e-9
      || Math.abs(box.x - d.rect0.x) > 1e-9 || Math.abs(box.y - d.rect0.y) > 1e-9;
    if (!changed && !d.moved) return;
    d.moved ||= changed;
    const topLeft = resizedBoxTopLeft(
      box, d.p0.angle, (point) => this._snap(point),
    );
    this._bdApply((topLeft[0] - b.x) / NORM_W, (topLeft[1] - b.y) / NORM_W,
      sx, sy, d.p0.angle);
  }

public _bdReset(): void {
    const sp = this.host._curSpaceCfg;
    if (!sp) return;
    const before = this._geometrySnapshot();
    delete sp.plan_x; delete sp.plan_y; delete sp.plan_scale;
    delete sp.plan_scale_x; delete sp.plan_scale_y; delete sp.plan_angle;
    this.host._bdDrag = null;
    this._recordGeometry(this.host._t('history.backdrop_transform'), before);
    this._saveConfig();
    this.host._showToast(this.host._t('decor.backdrop_reset_done'));
    this.host.requestUpdate();
  }

public _bdUp(): void {
    flushHouseplanPointerMove(this.host, 'backdrop');
    const d = this.host._bdDrag;
    this.host._bdDrag = null;
    if (d?.moved) {
      this._recordGeometry(this.host._t('history.backdrop_transform'), d.before);
      this._saveConfig();
    }
    this.host.requestUpdate();
  }

public _renderBackdropFrame(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const r = this.host._bdRect;
    if (!this.host._bdActive || !r) return nothing;
    // Two radii, one gesture — the split the text frame uses (docs/LIVE-TEXT.md
    // §3) and, since 2026-08-05, every corner handle in the card. `hr` is the
    // HIT radius: a fraction of the visible view, so the target stays
    // finger-sized at any zoom. `kr` is what you SEE — a quarter of it, because
    // a blob the size of a room is not a handle, it is an occlusion (owner:
    // «уменьшить в 4 раза… они постоянно гигантские»). The clickable area is
    // unchanged; only the ink shrank.
    const hr = Math.max(view.w, view.h) * 0.02;
    const kr = hr / 4;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const angle = normalizeAngle(r.angle);
    const arm = hr * 2.2;
    const corners: [number, number, string][] = [
      [-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw'],
    ];
    return svg`<g class="bdframe" transform=${angle ? `rotate(${angle} ${cx} ${cy})` : nothing}>
      <rect class="bdbox" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"></rect>
      <line class="dtstem" x1="${cx}" y1="${r.y}" x2="${cx}" y2="${r.y - arm}"></line>
      <circle class="bdhandle dtrot" cx="${cx}" cy="${r.y - arm}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => {
          e.stopPropagation(); e.preventDefault(); this._bdStart(e, undefined, true);
        }}></circle>
      <circle class="bdknob" cx="${cx}" cy="${r.y - arm}" r="${kr.toFixed(2)}"></circle>
      ${corners.map(([sx, sy, cur]) => {
        const cx = sx < 0 ? r.x : r.x + r.w;
        const cy = sy < 0 ? r.y : r.y + r.h;
        return svg`<circle
          class="bdhandle bd-${cur}" data-corner="${sx + ',' + sy}"
          cx="${cx}" cy="${cy}" r="${hr.toFixed(1)}"
          @pointerdown=${(e: PointerEvent) => {
            e.stopPropagation(); e.preventDefault(); this._bdStart(e, [sx, sy]);
          }}></circle><circle class="bdknob" cx="${cx}" cy="${cy}" r="${kr.toFixed(2)}"></circle>`;
      })}
    </g>` as unknown as TemplateResult;
  }

public _renderEditorGroupLauncher(group: EditorToolbarGroup): TemplateResult {
    return this.host._editorSecondary.renderGroupLauncher(
      group,
      this.host._editorToolbarGroups,
      this.host._editorSecondaryCopy,
    );
  }

public _runEditorContext<T>(contextId: string, action: () => T): T | undefined {
    return this.host._editorSecondary.runContext(
      contextId, this.host._editorSecondaryContextId, action,
    );
  }

public _renderEditorGroupModel(group: EditorToolbarGroup): EditorSecondaryModel {
    return this.host._editorSecondary.renderGroupModel(
      group,
      this.host._editorSecondaryContextId,
      this.host._editorSecondaryCopy,
    );
  }

public _renderDrawWallControl(): TemplateResult {
    const min = this.host._tool === 'column' ? 1 : 0;
    return html`<label class="drawwall ${this.host._drawWallCm == null ? 'invalid' : ''}">${this.host._t('wallthick.field')}
      <input type="number" min=${cmToField(min, this.host._imperial)}
        max=${cmToField(this.host._drawWallMaxCm, this.host._imperial)} step="any"
        .value=${this.host._drawWallFieldValue}
        @input=${(e: Event) => {
          this.host._drawWallField = (e.target as HTMLInputElement).value;
        }}
        title=${this.host._t(this.host._tool === 'draw' ? 'markup.draw_wall_title'
          : 'physical.column_size_title')} />
      <span class="opl">${this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span>
      <span class="rangehint">${this.host._t('physical.allowed_range', {
        min: cmToField(min, this.host._imperial),
        max: cmToField(this.host._drawWallMaxCm, this.host._imperial),
        unit: this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm'),
      })}</span>
    </label>`;
  }

public _renderPlanSecondary(): EditorSecondaryModel | null {
    const contextId = this.host._editorSecondaryContextId;
    const sel = this.host._physicalSel;
    if (sel) {
      const exists = sel.kind === 'partition'
        ? !!this.host._curSpaceCfg.partitions?.some((item: PartitionCfg) => item.id === sel.id)
        : !!this.host._curSpaceCfg.wall_columns?.some((item: WallColumnCfg) => item.id === sel.id);
      if (!exists) return null;
      const label = sel.kind === 'partition' ? this.host._t('markup.partition')
        : sel.kind === 'column' ? this.host._t('markup.column') : this.host._t('markup.add');
      return {
        contextId,
        kind: 'selection',
        ariaLabel: this.host._t('editor.context_actions', { object: label }),
        visibleLabel: label,
        content: html`
          <button class="btn ghost" @click=${() => this._runEditorContext(contextId, () => {
            const current = this.host._physicalSel;
            if (current) this._openPhysicalDialog(current.kind, current.id);
          })}><ha-icon icon="mdi:tune"></ha-icon>${this.host._t('btn.properties')}</button>
          <button class="btn danger" @click=${() => this._runEditorContext(contextId, () => this._deletePhysicalSelection())}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
          </button>`,
      };
    }

    const hasThickness = this.host._tool === 'draw' || this.host._tool === 'column';
    const hintKey = this.host._tool === 'column' ? 'markup.hint_column'
      : this.host._tool === 'resize' ? 'markup.hint_resize'
      : this.host._tool === 'wallthick' ? 'markup.hint_wallthick'
      : null;
    const drawHint = this.host._tool === 'draw'
      ? this.host._t(this.host._path.length ? 'markup.hint_points' : 'markup.hint_start',
          this.host._path.length ? { n: this.host._path.length } : undefined)
      : '';
    if (!hasThickness && !hintKey && !drawHint) return null;
    const operation = this.host._tool === 'draw' && this.host._path.length > 0;
    return {
      contextId,
      kind: operation ? 'operation' : 'tool',
      ariaLabel: this.host._t('editor.tool_options', {
        tool: this.host._t((this.host._tool === 'draw' ? 'markup.add'
          : this.host._tool === 'column' ? 'markup.column'
          : this.host._tool === 'resize' ? 'markup.resize'
          : 'markup.wallthick') as any),
      }),
      content: html`
        ${hasThickness ? this._renderDrawWallControl() : nothing}
        ${drawHint ? html`<span class="hint">${drawHint}</span>` : nothing}
        ${hintKey ? html`<span class="hint">${this.host._t(hintKey as any)}</span>` : nothing}
        ${this.host._tool === 'draw' && this.host._path.length
          ? html`<button class="btn ghost" @click=${() => this._runEditorContext(contextId, () => this._cancelPath())}>
              ${this.host._t('btn.reset')}
            </button>` : nothing}`,
    };
  }

public _renderDecorSecondary(): EditorSecondaryModel | null {
    const contextId = this.host._editorSecondaryContextId;
    if (this.host._decorTool === 'furniture') {
      return {
        contextId,
        kind: 'palette',
        ariaLabel: this.host._t('editor.palette', { tool: this.host._t('decor.furniture') }),
        launcherId: 'furniture',
        dismissPolicy: this.host._furnPalette ? 'stay-open-on-canvas' : 'outside',
        dismiss: () => {
          if (this.host._decorTool !== 'furniture') return;
          this._clearFurniturePreview();
          this.host._furnPalette = null;
          this._furnShiftDetach();
          this.host._furnCategory = null;
          this.host._decorTool = 'select';
          this.host.requestUpdate();
        },
        content: this._renderFurnPalette(),
      };
    }
    if (this.host._decorTool === 'image') {
      return {
        contextId,
        kind: 'palette',
        ariaLabel: this.host._t('editor.palette', { tool: this.host._t('decor.image') }),
        launcherId: 'image',
        dismissPolicy: this.host._decorImagePalette ? 'stay-open-on-canvas' : 'outside',
        dismiss: () => {
          if (this.host._decorTool !== 'image') return;
          this._clearFurniturePreview();
          this.host._decorImagePalette = null;
          this.host._decorTool = 'select';
          this.host.requestUpdate();
        },
        content: this._renderDecorImagePalette(),
      };
    }
    const selected = this.host._dtSel;
    if (selected) {
      const label = this.host._t((`decor.${selected.kind}`) as any);
      return {
        contextId,
        kind: 'selection',
        ariaLabel: this.host._t('editor.context_actions', { object: label }),
        visibleLabel: label,
        content: html`
          <button class="btn ghost" @click=${() => this._runEditorContext(contextId, () => {
            const current = this.host._dtSel;
            if (current) this._openDecorProperties(current);
          })}><ha-icon icon="mdi:tune"></ha-icon>${this.host._t('btn.properties')}</button>
          <button class="btn danger" @click=${() => this._runEditorContext(contextId, () => this._decorDeleteSel())}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
          </button>`,
      };
    }

    const draws = this.host._decorTool === 'line' || this.host._decorTool === 'rect' || this.host._decorTool === 'ellipse';
    const canFill = this.host._decorTool === 'rect' || this.host._decorTool === 'ellipse';
    const backdrop = this.host._decorTool === 'backdrop' && !!this.host._bdRect;
    if (!draws && !backdrop) return null;
    return {
      contextId,
      kind: 'tool',
      ariaLabel: this.host._t('editor.tool_options', {
        tool: this.host._t((draws ? `decor.${this.host._decorTool}` : 'decor.backdrop') as any),
      }),
      content: html`
        ${draws ? html`
          <hp-color-opacity .label=${this.host._t('decor.color')} .color=${this.host._decorStyle.color}
            .opacity=${this.host._decorStyle.opacity} .opacityLabel=${this.host._t('space.opacity')}
            .pickerLabels=${this.host._colorPickerLabels}
            @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
              this._updateDecorStyle({ ...this.host._decorStyle, ...e.detail })}></hp-color-opacity>
          <label class="drawwall">${this.host._t('decor.width')}
            <input type="number" min=${this.host._decorSmallField(0.1)}
              max=${this.host._decorSmallField(100)} step="0.1"
              .value=${String(this.host._decorSmallField(this.host._decorStyle.widthCm))}
              @input=${(e: Event) => this._updateDecorStyle({ ...this.host._decorStyle,
                widthCm: this.host._decorSmallCm(Number((e.target as HTMLInputElement).value)) })} />
            <span class="opl">${this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span>
          </label>
          ${canFill ? html`<label class="dfill"><input type="checkbox" .checked=${this.host._decorStyle.fill}
              @change=${(e: Event) => this._updateDecorStyle({ ...this.host._decorStyle,
                fill: (e.target as HTMLInputElement).checked })} />${this.host._t('decor.fill')}</label>
            <hp-color-opacity .label=${this.host._t('decor.fill_color')} .color=${this.host._decorStyle.fillColor}
              .opacity=${this.host._decorStyle.fillOpacity} .opacityLabel=${this.host._t('space.opacity')}
              .pickerLabels=${this.host._colorPickerLabels}
              .disabled=${!this.host._decorStyle.fill}
              @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
                this._updateDecorStyle({ ...this.host._decorStyle,
                  fillColor: e.detail.color, fillOpacity: e.detail.opacity })}></hp-color-opacity>` : nothing}
        ` : nothing}
        ${backdrop ? html`<span class="bdhint">${this.host._t('decor.backdrop_hint')}</span>` : nothing}`,
    };
  }

public _withBackdropReset(model: EditorSecondaryModel | null): EditorSecondaryModel | null {
    if (!this.host._bdMoved || this.host._bdDrag || model?.kind === 'palette') return model;
    const contextId = this.host._editorSecondaryContextId;
    const reset = html`<button class="btn bdreset" title=${this.host._t('decor.backdrop_reset')}
      @click=${() => this._runEditorContext(contextId, () => this._bdReset())}>
      <ha-icon icon="mdi:image-refresh-outline"></ha-icon>${this.host._t('decor.backdrop_reset')}
    </button>`;
    if (!model) {
      return {
        contextId,
        kind: 'tool',
        ariaLabel: this.host._t('editor.tool_options', { tool: this.host._t('decor.backdrop') }),
        content: reset,
      };
    }
    return {
      ...model,
      kind: model.kind === 'selection' ? 'mixed' : model.kind,
      content: html`${model.content}${reset}`,
    };
  }

public _renderEditorSecondary(): TemplateResult | typeof nothing {
    if (!this.host._editing) return nothing;
    const group = this.host._editorSecondary.activeGroup(this.host._editorToolbarGroups);
    const model = group ? this._renderEditorGroupModel(group)
      : this.host._mode === 'plan' ? this._renderPlanSecondary()
      : this.host._mode === 'decor' ? this._withBackdropReset(this._renderDecorSecondary())
      : null;
    return this.host._editorSecondary.render(model, this.host._editorSecondaryDialogBlocked);
  }

public _renderDecorBar(): TemplateResult {
    const tools = [
      ['select', 'mdi:cursor-default-outline', 'decor.select'],
      // moving the picture is a TOOL (docs/BACKDROP.md §2) — offered only when
      // there IS a picture, so a hand-drawn space's bar is unchanged
      ...(this.host._bdRect ? [['backdrop', 'mdi:image-move', 'decor.backdrop'] as const] : []),
      ['line', 'mdi:vector-line', 'decor.line'],
      ['rect', 'mdi:rectangle-outline', 'decor.rect'],
      ['ellipse', 'mdi:ellipse-outline', 'decor.ellipse'],
      ['text', 'mdi:format-text', 'decor.text'],
      // the library sits next to the shapes it belongs with (docs/FURNITURE.md)
      ['furniture', 'mdi:sofa-outline', 'decor.furniture'],
      ...(this.host._haDecorAssetsApi === DECOR_ASSETS_API_VERSION
        ? [['image', 'mdi:image-plus-outline', 'decor.image'] as const] : []),
      ['erase', 'mdi:eraser', 'decor.erase'],
    ] as const;
    const undoName = this.host._geometryHistory.undoName;
    const redoName = this.host._geometryHistory.redoName;
    return html`<div class="editbar decorbar">
      <div class="editbar-tools" tabindex="-1" ?inert=${this.host._modeTransitionBusy}>
      ${tools.map(
        ([t, ic, k]) => html`<button class="btn dtool ${this.host._decorTool === t ? 'on' : ''}"
          data-editor-palette=${t === 'furniture' || t === 'image' ? t : nothing}
          @click=${() => {
            if ((t === 'furniture' || t === 'image') && this.host._decorTool === t) {
              this._clearFurniturePreview();
              this.host._furnPalette = null;
              this.host._decorImagePalette = null;
              this._furnShiftDetach();
              this.host._furnCategory = null;
              this.host._decorTool = 'select';
              return;
            }
            if (t === 'furniture' || t === 'image') this.host._editorSecondary.openPalette();
            if (t === 'image') void this._decorImageCatalogLoad();
            this.host._decorTool = t as typeof this.host._decorTool;
            this.host._decorDraft = null;
            // the palette belongs to its tool and to nothing else: leaving the
            // tool disarms whatever was chosen, so no later click can stamp it
            if (t !== 'furniture') {
              this._clearFurniturePreview();
              this.host._furnPalette = null;
              this._furnShiftDetach();
              this.host._furnCategory = null;
            } else {
              this._clearFurniturePreview();
              this.host._furnCategory = null;
            }
            if (t !== 'image') this.host._decorImagePalette = null;
          }}
          title=${this.host._t(k)}>
          <ha-icon icon=${ic}></ha-icon><span class="ml">${this.host._t(k)}</span>
        </button>`,
      )}
      ${this.host._editorToolbarGroups.map((group) => this._renderEditorGroupLauncher(group))}
      <hp-color-opacity class="decor-default-color"
        .label=${this.host._t('decor.color')}
        .color=${this.host._decorStyle.color}
        .opacity=${this.host._decorStyle.opacity}
        .opacityLabel=${this.host._t('space.opacity')}
        .pickerLabels=${this.host._colorPickerLabels}
        @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
          this._updateDecorStyle({ ...this.host._decorStyle, ...e.detail })}>
      </hp-color-opacity>
      <button class="btn ghost" @click=${() => this._undoGeometry()} ?disabled=${!undoName}
        title=${undoName ? this.host._t('history.undo_named', { name: undoName }) : this.host._t('history.undo_empty')}>
        <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t('history.undo')}
      </button>
      <button class="btn ghost" @click=${() => this._redoGeometry()} ?disabled=${!redoName}
        title=${redoName ? this.host._t('history.redo_named', { name: redoName }) : this.host._t('history.redo_empty')}>
        <ha-icon icon="mdi:redo-variant"></ha-icon>${this.host._t('history.redo')}
      </button>
      </div>
      <div class="editbar-end">
        <button class="btn barclose" title=${this.host._t('title.close_editor')}
          data-editor-navigation="view"
          @click=${() => this._setMode('view')}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    </div>`;
  }

public _renderDecorEraseConfirm(): TemplateResult {
    const pending = this.host._decorEraseConfirm!;
    const kind = this.host._t(`decor.${pending.kind}` as any);
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('decor.erase_confirm_title')}
      icon="mdi:eraser" dismiss-on-scrim @hp-close=${() => (this.host._decorEraseConfirm = null)}>
        <div class="body"><p>${this.host._t('confirm.erase_decor', { kind })}</p></div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this.host._decorEraseConfirm = null)}>
            ${this.host._t('btn.cancel')}
          </button>
          <button class="btn danger" @click=${() => this._confirmDecorErase()}>
            <ha-icon icon="mdi:eraser"></ha-icon>${this.host._t('decor.erase')}
          </button>
        </div>
    </hp-dialog>`;
  }

public _renderDecorTextDialog(): TemplateResult {
    const d = this.host._decorTextDialog!;
    const ent = (d.pickerEntity || '').trim();
    const st = ent ? this.host.hass?.states?.[ent] : null;
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('decor.text_title')}
      icon="mdi:format-text" dismiss-on-scrim @hp-close=${() => (this.host._decorTextDialog = null)}>
        <div class="body">
          <label>${this.host._t('decor.text_label')}</label>
          ${''/* a textarea, not an input: the user's own line breaks are kept
                 and rendered (centred). Enter is a NEW LINE here, so saving
                 moved to Ctrl/Cmd+Enter and the button. */}
          <textarea class="namein dtarea" rows="3" maxlength="200" .value=${d.text} autofocus
            @input=${(e: Event) => {
              const el = e.target as HTMLTextAreaElement;
              this._decorRememberTextSelection(el);
              this.host._decorTextDialog = { ...d, text: el.value };
            }}
            @click=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @keyup=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @select=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @blur=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @keydown=${(e: KeyboardEvent) => {
              e.stopPropagation();
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this._decorSaveText();
            }}></textarea>
          <hp-color-opacity .label=${this.host._t('decor.color')} .color=${d.color} .opacity=${d.opacity}
            .opacityLabel=${this.host._t('space.opacity')} .pickerLabels=${this.host._colorPickerLabels}
            @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
              (this.host._decorTextDialog = { ...d, ...e.detail })}></hp-color-opacity>
          <label>${this.host._t('decor.text_size')}</label>
          <div class="colorrow"><input class="namein" type="number" min="0.1"
            max=${this.host._decorSmallField(DECOR_TEXT_CM_MAX)} step="0.1"
            .value=${String(this.host._decorSmallField(d.sizeCm))}
            @input=${(e: Event) => (this.host._decorTextDialog = { ...d,
              sizeCm: this.host._decorTextCm(Number((e.target as HTMLInputElement).value)) })} />
            <span class="opl">${this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span></div>
          <label>${this.host._t('decor.angle')}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${d.angle}
            @input=${(e: Event) => (this.host._decorTextDialog = { ...d,
              angle: (e.target as HTMLInputElement).value })} />
          <label class="dispsection">${this.host._t('decor.live_group')}</label>
          <label>${this.host._t('decor.live_entity')}</label>
          <input class="namein" type="text" list="hp-dtext-ents" placeholder=${this.host._t('decor.live_entity_ph')}
            .value=${d.pickerEntity || ''}
            @input=${(e: Event) => (this.host._decorTextDialog = {
              ...d, pickerEntity: (e.target as HTMLInputElement).value,
            })} />
          <datalist id="hp-dtext-ents">
            ${Object.keys(this.host.hass?.states || {}).map((id) => html`<option value=${id}></option>`)}
          </datalist>
          ${ent ? html`
            <label>${this.host._t('decor.live_attr')}</label>
            <select id="decor-live-attribute" class="namein" .value=${''}
              @change=${(e: Event) => {
                const value = (e.target as HTMLSelectElement).value;
                if (value) this._decorInsertLiveVariable(value === '__state__' ? null : value);
              }}>
              <option value="">${this.host._t('decor.live_attr_ph')}</option>
              <option value="__state__">${this.host._t('decor.live_state')}</option>
              ${Object.keys(st?.attributes || {})
                .filter((a) => !!liveTextToken(ent, a))
                .map((a) => html`<option value=${a}>${a}</option>`)}
            </select>
          ` : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this.host._decorTextDialog = null)}>${this.host._t('btn.cancel')}</button>
          <button class="btn primary" ?disabled=${!d.text.trim()} @click=${() => this._decorSaveText()}>${this.host._t('btn.save')}</button>
        </div>
    </hp-dialog>`;
  }

public _renderDecorShapeDialog(): TemplateResult {
  return this._decorImages.renderShapeDialog();
  }

public _renderBackdropDialog(): TemplateResult {
    const d = this.host._backdropDialog!;
    const unit = this.host._t(this.host._imperial ? 'gs.unit_ft' : 'gs.unit_m');
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('decor.backdrop_properties')}
      icon="mdi:image-edit-outline" dismiss-on-scrim @hp-close=${() => (this.host._backdropDialog = null)}>
      <div class="body">
        <label>${this.host._t('decor.size')}</label>
        <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this.host._decorLargeField(d.widthCm))}
          @input=${(e: Event) => (this.host._backdropDialog = { ...d,
            widthCm: this.host._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
          <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this.host._decorLargeField(d.heightCm))}
          @input=${(e: Event) => (this.host._backdropDialog = { ...d,
            heightCm: this.host._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
          <span class="opl">${unit}</span></div>
        <label>${this.host._t('decor.angle')}</label>
        <input class="namein" type="number" min="-180" max="180" step="1" .value=${d.angle}
          @input=${(e: Event) => (this.host._backdropDialog = { ...d,
            angle: (e.target as HTMLInputElement).value })} />
      </div>
      <div class="row" slot="footer"><span class="spacer"></span>
        <button class="btn ghost" @click=${() => (this.host._backdropDialog = null)}>${this.host._t('btn.cancel')}</button>
        <button class="btn primary" @click=${() => this._saveBackdropDialog()}>${this.host._t('btn.save')}</button>
      </div>
    </hp-dialog>`;
  }

public _cssPxToRender(px: number): number {
    const stage = this.host._stageEl;
    const view = this.host._viewOr(this.host._baseVb());
    if (!stage?.clientWidth || !stage.clientHeight) return (this.host._gridPitch / 8) * px;
    return Math.max(view.w / stage.clientWidth, view.h / stage.clientHeight) * px;
  }

public _deleteRoomClick(raw: number[]): void {
    const space = this.host._spaceModel();
    if (!space) return;
    const room = [...space.rooms].reverse().find((r) => this._pointInRoom(raw, r));
    if (!room) {
      this.host._showToast(this.host._t('toast.delete_room_pick'));
      return;
    }
    if (!room.id) return;
    this.host._roomDeleteDialog = { roomId: room.id, name: room.name };
  }

public _confirmRoomDelete = (keepWalls: boolean): void => {
    const dialog = this.host._roomDeleteDialog;
    const sp = this.host._curSpaceCfg;
    const space = this.host._spaceModel();
    if (!dialog || !sp || !space) return;
    const room = space.rooms.find((candidate) => candidate.id === dialog.roomId);
    if (!room) { this.host._roomDeleteDialog = null; return; }
    const openCuts = this.host._openCuts();
    const allIntervals = wallIntervals(
      space.rooms, this.host._spaceWalls, openCuts,
      this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
    );
    const roomIntervals = allIntervals.filter((interval) => interval.roomId === room.id);
    const plan = planRoomDeletion(
      roomIntervals,
      space.partitions,
      this.host._openingsR.map((opening) => ({
        ...opening, x: opening.rx, y: opening.ry,
      })),
      this.host._gridPitch * 0.02,
    );
    const newCount = new Set(plan.materialize
      .filter((item) => !item.reusePartitionId)
      .map((item) => item.interval.key)).size;
    if (keepWalls && (sp.partitions || []).length + newCount > MAX_PARTITIONS) {
      this.host._showToast(this.host._t('toast.physical_limit'));
      return;
    }
    const before = this._geometrySnapshot();
    const materializedWalls = materializeWallIntervals(
      space.rooms, this.host._spaceWalls, openCuts,
      this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
    );
    if (keepWalls) {
      sp.partitions ||= [];
      const targetByInterval = new Map<string, PartitionCfg>();
      const createdByKey = new Map<string, PartitionCfg>();
      const sourceWallId = (interval: { a: readonly number[]; b: readonly number[] }): string | null => {
        const match = (sp.wall_segments || []).find((segment: any) => {
          const a = [Number(segment.a?.[0]) * NORM_W, Number(segment.a?.[1]) * NORM_W];
          const b = [Number(segment.b?.[0]) * NORM_W, Number(segment.b?.[1]) * NORM_W];
          return (this._samePt(interval.a, a) && this._samePt(interval.b, b))
            || (this._samePt(interval.a, b) && this._samePt(interval.b, a));
        });
        return typeof match?.id === 'string' && match.id ? match.id : null;
      };
      const seed = Date.now().toString(36);
      for (const item of plan.materialize) {
        let target = item.reusePartitionId
          ? sp.partitions.find((partition: PartitionCfg) => partition.id === item.reusePartitionId)
          : createdByKey.get(item.interval.key);
        if (!target) {
          target = {
            id: sourceWallId(item.interval) || `partition-room-${seed}-${createdByKey.size}`,
            a: [item.interval.a[0] / NORM_W, item.interval.a[1] / NORM_W],
            b: [item.interval.b[0] / NORM_W, item.interval.b[1] / NORM_W],
            cm: item.interval.cm,
          };
          sp.partitions.push(target);
          createdByKey.set(item.interval.key, target);
        }
        targetByInterval.set(item.interval.key, target);
      }
      for (const opening of sp.openings || []) {
        const intervalKey = plan.openingIntervals.get(opening.id);
        const target = intervalKey ? targetByInterval.get(intervalKey) : null;
        const rendered = this.host._openingsR.find((candidate) => candidate.id === opening.id);
        if (!target || !rendered) continue;
        const renderTarget = {
          a: [target.a[0] * NORM_W, target.a[1] * NORM_W],
          b: [target.b[0] * NORM_W, target.b[1] * NORM_W],
        };
        opening.host = {
          kind: 'partition', id: target.id,
          t: parameterOnPartition([rendered.rx, rendered.ry], renderTarget),
        };
      }
    } else if (plan.removeOpeningIds.length) {
      const remove = new Set(plan.removeOpeningIds);
      sp.openings = (sp.openings || []).filter((opening: OpeningCfg) => !remove.has(opening.id));
      if (!sp.openings.length) delete sp.openings;
    }
    sp.rooms = sp.rooms.filter((r: any) => r.id !== room.id);
    this.host._cfgEpoch++;
    const normalized = this.host._normalizeWalls(materializedWalls, this.host._openCuts());
    if (normalized.length) sp.walls = normalized;
    else delete sp.walls;
    this.host._roomDeleteDialog = null;
    this._commitPhysicalGeometry(this.host._t(
      keepWalls ? 'history.delete_room_keep_walls' : 'history.delete_room_with_walls',
    ), before);
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    this.host.requestUpdate();
  };

public _wallThickHit(raw: number[]): WallThickHit | null {
    const space = this.host._spaceModel();
    if (!space) return null;
    const pull = this.host._gridPitch * 6;
    const cuts = this.host._openCuts();
    type Hit = WallThickHit;
    // #313: the tool serves every wall — room intervals AND independent
    // masonry. On an exact overlap (the #308 duplicate) the independent wall
    // wins: it owns the hit zone, exactly like the select tool, and it is
    // the body the eye actually sees.
    let best: { hit: Hit; d: number; independent: boolean } | null = null;
    const offer = (hit: Hit, d: number, independent: boolean): void => {
      if (d > pull) return;
      if (!best || d < best.d - 1e-9
          || (independent && !best.independent && d <= best.d + 1e-9)) {
        best = { hit, d, independent };
      }
    };
    for (const iv of wallIntervals(
      space.rooms, this.host._spaceWalls, cuts,
      this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
    )) {
      offer({
        a: iv.a, b: iv.b, roomId: iv.roomId,
        segs: [[iv.a[0], iv.a[1], iv.b[0], iv.b[1]]],
        open: iv.open, cm: iv.cm, source: { kind: 'room' },
      }, distToSegment(raw, [iv.a[0], iv.a[1], iv.b[0], iv.b[1]]), false);
    }
    for (const partition of space.partitions || []) {
      const a = [partition.a[0], partition.a[1]];
      const b = [partition.b[0], partition.b[1]];
      offer({
        a, b, roomId: '', segs: [[a[0], a[1], b[0], b[1]]],
        open: false, cm: Number(partition.cm) || 0,
        source: { kind: 'partition', id: partition.id },
      }, distToSegment(raw, [a[0], a[1], b[0], b[1]]), true);
    }
    return best ? (best as { hit: Hit }).hit : null;
  }

public _wallThickClick(raw: number[]): void {
    const hit = this._wallThickHit(raw);
    if (!hit) {
      this.host._showToast(this.host._t('toast.wallthick_pick'));
      return;
    }
    const cm = hit.cm;
    const view = this.host._viewOr(this.host._baseVb());
    const mx = (hit.a[0] + hit.b[0]) / 2, my = (hit.a[1] + hit.b[1]) / 2;
    this.host._wallDialog = {
      a: hit.a, b: hit.b,
      value: cmToField(cm, this.host._imperial),
      roomId: hit.roomId,
      source: hit.source,
      sx: ((mx - view.x) / view.w) * 100,
      sy: ((my - view.y) / view.h) * 100,
    };
  }

public _wallThickApply(allRoom: boolean): void {
    const d = this.host._wallDialog;
    if (!d) return;
    const sp = this.host._curSpaceCfg;
    const space = this.host._spaceModel();
    if (!sp || !space) return;
    const text = d.value.trim();
    const raw = text ? strictNumber(text) : null;
    if (raw == null) { this._showPhysicalRange(100); return; }
    const cmRaw = this.host._imperial ? raw * 2.54 : raw;
    if (!Number.isFinite(cmRaw) || cmRaw < 0 || cmRaw > 100) {
      this._showPhysicalRange(100);
      return;
    }
    // Independent walls own their records. Zero is the same
    // canonical bodyless state here as it is for a contour atom (#306).
    if (d.source.kind !== 'room') {
      const before = this._geometrySnapshot();
      const partition = (sp.partitions || [])
        .find((item: PartitionCfg) => item.id === (d.source as { id: string }).id);
      if (!partition) return;
      if (cmRaw === 0 && zeroWallHasOpening(sp.openings, {
        kind: 'partition', id: partition.id,
      })) {
        this.host._showToast(this.host._t('toast.zero_wall_opening_conflict'));
        return;
      }
      partition.cm = cmRaw;
      this.host._wallDialog = null;
      const committed = this._commitPhysicalGeometry(
        this.host._t('history.wall_thickness'), before,
      );
      if (committed) this.host._showToast(this.host._t('toast.wallthick_set'));
      this.host.requestUpdate();
      return;
    }
    const before = this._geometrySnapshot();
    const cm = cmRaw > 0 ? cmRaw : null;
    if (cmRaw === 0) {
      const eps = this.host._gridPitch * 0.02;
      const target = [d.a[0], d.a[1], d.b[0], d.b[1]];
      const room = (sp.rooms || []).find((item) => item.id === d.roomId);
      const ids = new Set<string>(allRoom && room && Array.isArray(room.wall_ids)
        ? room.wall_ids
        : (sp.wall_segments || []).filter((segment: any) => {
            const a = [Number(segment.a?.[0]) * NORM_W, Number(segment.a?.[1]) * NORM_W];
            const b = [Number(segment.b?.[0]) * NORM_W, Number(segment.b?.[1]) * NORM_W];
            return distToSegment(a, target) <= eps && distToSegment(b, target) <= eps;
          }).map((segment: any) => String(segment.id)));
      const blocked = (sp.openings || []).some((opening: OpeningCfg) => {
        if (opening.host?.kind === 'partition') return false;
        if (opening.host?.kind === 'wall' && ids.has(opening.host.id)) return true;
        if (opening.host) return false;
        const point = [Number(opening.x) * NORM_W, Number(opening.y) * NORM_W];
        return point.every(Number.isFinite) && distToSegment(point, target) <= eps;
      });
      if (blocked) {
        this.host._showToast(this.host._t('toast.zero_wall_opening_conflict'));
        return;
      }
    }
    let openCuts = this.host._openCuts();
    if (cmRaw > 0 && openCuts.length) {
      // The selected zero axis is a cut only in the PRE-edit body profile.
      // Remove exactly the carriers being restored before the compatibility
      // wall normalizer runs; otherwise it discards the new positive record as
      // if the segment were still a zero interval (#306).
      const targets: number[][] = [];
      if (allRoom && d.roomId) {
        const room = (sp.rooms || []).find((item) => item.id === d.roomId);
        const ids = new Set<string>(Array.isArray(room?.wall_ids) ? room.wall_ids : []);
        for (const segment of sp.wall_segments || []) {
          if (!ids.has(segment.id)) continue;
          targets.push([
            Number(segment.a?.[0]) * NORM_W, Number(segment.a?.[1]) * NORM_W,
            Number(segment.b?.[0]) * NORM_W, Number(segment.b?.[1]) * NORM_W,
          ]);
        }
        // A pre-v9 room has no catalogue IDs yet. Its current zero axes still
        // come from the rendered room outline, so use that outline as the
        // carrier set for this first explicit positive-thickness edit. The
        // common v9 barrier below will materialise stable IDs atomically.
        if (!targets.length) {
          const renderedRoom = space.rooms.find((item) => item.id === d.roomId);
          const poly = renderedRoom ? roomPoly(renderedRoom) : null;
          for (let index = 0; poly && index < poly.length; index++) {
            const a = poly[index], b = poly[(index + 1) % poly.length];
            targets.push([a[0], a[1], b[0], b[1]]);
          }
        }
      } else targets.push([d.a[0], d.a[1], d.b[0], d.b[1]]);
      const eps = this.host._gridPitch * 0.02;
      openCuts = openCuts.filter((cut) => !targets.some((target) => (
        distToSegment([cut[0], cut[1]], target) <= eps
        && distToSegment([cut[2], cut[3]], target) <= eps
        && distToSegment([target[0], target[1]], cut) <= eps
        && distToSegment([target[2], target[3]], cut) <= eps
      )));
    }
    let next: WallEntry[];
    if (allRoom && d.roomId) {
      next = setWallThicknessForRoom(
        sp.walls, space.rooms, d.roomId, cm, this.host._wallKeyPitch, openCuts, NORM_W,
      );
    } else {
      next = setWallThickness(sp.walls, d.a, d.b, cm, this.host._wallKeyPitch, NORM_W);
    }
    next = this.host._normalizeWalls(next, openCuts);
    // ADR 282 Stage 1: this writer knows that absence from `next` is an
    // explicit zero chosen by the user, not a missing compatibility record.
    // Mirror that intent into the canonical catalogue before the common
    // barrier; otherwise its lineage fallback would resurrect the old cm.
    for (const segment of sp.wall_segments || []) {
      segment.cm = thicknessCmAt(
        next, segment.a, segment.b, GRID_STEP_N, 1,
      );
    }
    if (next.length) sp.walls = next;
    else delete sp.walls;
    this.host._wallDialog = null;
    if (this._commitPhysicalGeometry(this.host._t('history.wall_thickness'), before))
      this.host._showToast(this.host._t(cmRaw === 0 ? 'toast.wallthick_cleared' : 'toast.wallthick_set'));
    this.host.requestUpdate();
  }

public _wallHatchDefs(color: string): TemplateResult {
    if (!this.host._spaceWalls.length && !this.host._physicalBodiesR().length && !this.host._markup)
      return svg`` as unknown as TemplateResult;
    // The step is a physical distance now — 9.6 cm of plan, whatever the grid
    // scale — so it must NOT be compensated for zoom: a wall that changes its
    // hatching as you zoom is exactly what #230 is about (spec §4.2).
    const step = wallHatchStepUnits(this.host._cellCm);
    const stripe = 2 * (step / HATCH_BASE_STEP_UNITS);
    // Bake the wall colour into the pattern — CSS vars on <pattern> content
    // do not inherit from the filled path, so var(--room-stroke) fell back
    // to grey while the wall outline used the real border colour.
    const stroke = color || '#607d8b';
    return svg`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
        width="${step}" height="${step}" patternTransform="rotate(45)">
        <path d="M0 0 L0 ${step}" stroke="${stroke}" stroke-width="${stripe}"></path>
      </pattern>
    </defs>` as unknown as TemplateResult;
  }

public _renderWallThickUi(): TemplateResult {
    const hover = this.host._wallThickHover;
    if (!hover || !hover.d) return svg`` as unknown as TemplateResult;
    return svg`<path class="wallthick-hover ${hover.open ? 'isopen' : ''}"
      d="${hover.d}"></path>` as unknown as TemplateResult;
  }

public _renderWallThickDialog(): TemplateResult {
    const d = this.host._wallDialog;
    if (!d) return html``;
    return html`<div class="wallthick-dlg" style="left:${d.sx.toFixed(2)}%;top:${d.sy.toFixed(2)}%"
      @click=${(e: Event) => e.stopPropagation()}>
      <div class="row">
        <label>${this.host._t('wallthick.field')}</label>
        <input type="number" min="0" max="100" step="any" .value=${d.value}
          @input=${(e: Event) => {
            this.host._wallDialog = { ...d, value: (e.target as HTMLInputElement).value };
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); this._wallThickApply(false); }
          }} />
        <span class="opl">${this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span>
      </div>
      <div class="row">
        ${d.source.kind === 'room' ? html`<button class="btn ghost"
          @click=${() => this._wallThickApply(true)}>
          ${this.host._t('wallthick.apply_room')}
        </button>` : nothing}
        <span class="spacer"></span>
        <button class="btn on" @click=${() => this._wallThickApply(false)}>
          <ha-icon icon="mdi:check"></ha-icon>
        </button>
      </div>
    </div>`;
  }

public _openingAt(raw: readonly number[]): RenderOpening | null {
    if (!this.host._openingsR.length) return null;
    const roughHits = this.host._openingsR.flatMap((o) => {
      const rad = o.angle * Math.PI / 180;
      const dx = raw[0] - o.rx, dy = raw[1] - o.ry;
      const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
      if (Math.abs(localX) > o.rlen / 2 + gridVisualUnits(12, this.host._cellCm)) return [];
      return [{ o, localY: -dx * Math.sin(rad) + dy * Math.cos(rad) }];
    });
    if (!roughHits.length) return null;
    const space = this.host._spaceModel();
    if (!space) return null;
    const openCuts = this.host._openCuts();
    const wallIndex = this.host._openingWallIndexFor(space, openCuts).value;
    return roughHits.find(({ o, localY }) => {
      const faceFlipV = o.type === 'gate' ? !o.flip_v : o.flip_v;
      const face = o.partitionHost || this.host._spaceWalls.length || o.type === 'gate'
        ? this.host._openingFace(o, wallIndex, !!faceFlipV)
        : { ox: 0, oy: 0, cm: 0, side: -1 as -1 | 1 };
      const metrics = openingVisibleMetrics({
        type: o.type,
        length: o.rlen,
        angle: o.angle,
        amount: this.host._openingAmt(o),
        flipH: !!o.flip_h,
        flipV: !!o.flip_v,
        base: '', tone: '',
        cellCm: this.host._cellCm,
        gridPitch: this.host._gridPitch,
        face,
      });
      // Match the committed `.op-hit` rectangle exactly. The old radial test
      // made a 3 m gate suppress placement in a huge circular area far away
      // from its visible/hit geometry.
      return Math.abs(localY) <= metrics.hitHalf;
    })?.o || null;
  }

public _resolveOpeningPlacement(raw: readonly number[]): OpeningPlacementCandidate | null {
    const preset = this.host._openingPreset;
    if (this.host._tool !== 'opening' || !preset) return null;
    const space = this.host._spaceModel();
    if (!space) return null;
    const openCuts = this.host._openCuts();
    const wallIndex = this.host._openingWallIndexFor(space, openCuts);
    const placementKey = `${wallIndex.key}|partitions:${this.host._cfgEpoch}`;
    if (!this.host._openingPlacementIntervalsCache
        || this.host._openingPlacementIntervalsCache.key !== placementKey) {
      this.host._openingPlacementIntervalsCache = {
        key: placementKey,
        value: [
          ...wallIntervals(
            space.rooms, this.host._spaceWalls, openCuts,
            this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
          ),
          ...partitionPlacementIntervals(space.partitions, this.host._cellCm, this.host._gridPitch),
        ],
      };
    }
    if (!this.host._openingDimensionContextCache
        || this.host._openingDimensionContextCache.key !== placementKey) {
      this.host._openingDimensionContextCache = {
        key: placementKey,
        value: buildOpeningDimensionContext({
          rooms: space.rooms,
          walls: this.host._spaceWalls,
          openCuts,
          partitions: space.partitions,
          roomOpenings: this.host._roomWallOpeningInputs(),
          partitionCuts: this._partitionOpeningCuts(space),
          pitch: this.host._wallKeyPitch,
          cellCm: this.host._cellCm,
          gridPitch: this.host._gridPitch,
          coordScale: NORM_W,
          epsilon: this.host._gridPitch * 0.0002,
        }),
      };
    }
    const resolution = resolveOpeningPlacementResult({
      pointer: [raw[0], raw[1]],
      preset,
      geometryRevision: this.host._cfgEpoch,
      renderedLength: this.host._cmToUnits(preset.lengthCm),
      intervals: this.host._openingPlacementIntervalsCache.value,
      baseTolerance: this.host._gridPitch * 1.5,
      bodyPointerPadding: this._cssPxToRender(
        this.host._pointerModality.modality === 'touch' || this.host._pointerModality.modality === 'pen' ? 10 : 6,
      ),
      gridStep: this.host._gridPitch,
    });
    this.host._openingJambBlockCm = resolution.jambBlockedTarget
      ? (resolution.jambBlockedTarget.physicalHalfWidth / this.host._gridPitch) * this.host._cellCm
      : null;
    const core = resolution.candidate;
    if (!core) return null;
    const faceFlipV = core.type === 'gate' ? !core.flipV : core.flipV;
    let face: OpeningFaceOffset;
    if (core.host) {
      const hosted = resolvePartitionOpeningCompat({
        id: 'preview', type: core.type,
        x: core.x / NORM_W, y: core.y / NORM_W,
        angle: core.angle, length: core.renderedLength / NORM_W,
        host: core.host,
      }, space.partitions, NORM_W, this.host._cellCm, this.host._gridPitch).resolved;
      face = hosted
        ? partitionOpeningFace(hosted, faceFlipV)
        : { ox: 0, oy: 0, cm: 0, side: -1 };
    } else {
      face = openingInnerFaceOffsetFromIndex(
        wallIndex.value,
        { x: core.x, y: core.y, angle: core.angle, length: core.renderedLength, flip_v: faceFlipV },
      );
    }
    const imperial = this.host.hass?.config?.unit_system?.length === 'mi';
    // #238: placement labels are physical dimensions. They consume the ONE
    // resolved candidate above and never re-run pointer snap; existing-opening
    // drag deliberately keeps `_opRuler`/`openingShoulders` below.
    const dimensions = resolveOpeningDimensions(
      core, this.host._openingDimensionContextCache.value,
    );
    const labels = dimensions.map((dimension) => ({
      x: dimension.label[0],
      y: dimension.label[1],
      text: formatLength((dimension.distance / this.host._gridPitch) * this.host._cellCm, imperial),
      dimension,
    }));
    return { ...core, face, measure: { labels, guide: core.measure.guide } };
  }

public _activateOpeningPlacement(type: OpeningPlacementType): void {
    this._activateMarkupTool('opening');
    if (this.host._tool !== 'opening') return;
    this.host._openingPreset = openingPlacementPreset(type, ++this.host._openingPresetRevision);
    this.host._openingHoverCandidate = null;
    this.host._cursorPt = null;
  }

public _clearOpeningPlacement(clearPreset: boolean): void {
    this.host._openingHoverCandidate = null;
    this.host._openingJambBlockCm = null;
    if (clearPreset) {
      this.host._openingPreset = null;
      this.host._openingRebindId = null;
    }
  }

public _openingClick(raw: number[]): void {
    const space = this.host._spaceModel();
    if (!space) return;
    // Rebind is an explicit one-shot placement: the orphan's stale fallback
    // position must not win hit testing when the replacement wall crosses it.
    const hit = this.host._openingRebindId ? null : this._openingAt(raw);
    if (hit) {
      this._editOpening(hit);
      return;
    }
    const preset = this.host._openingPreset;
    if (!preset) return;
    const cached = this.host._openingHoverCandidate;
    const place = cached && sameOpeningPlacementInput(
      cached, [raw[0], raw[1]], preset.revision, this.host._cfgEpoch,
    ) ? cached : this._resolveOpeningPlacement(raw);
    if (!place) {
      if (this.host._openingJambBlockCm != null) {
        this.host._showToast(this.host._t('opening.partition_jamb_margin', {
          distance: formatLength(this.host._openingJambBlockCm, this.host._imperial),
        }));
        return;
      }
      const eps = this.host._gridPitch * 1.5;
      const snap = snapToWall(raw, space.rooms, eps);
      if (snap && pointOnOpenCut(snap.x, snap.y, snap.angle, this.host._openCuts(), eps)) {
        this.host._showToast(this.host._t('toast.opening_on_zero_wall'));
        return;
      }
      this.host._showToast(this.host._t('toast.opening_no_wall'));
      return;
    }
    const rebound = this.host._openingRebindId
      ? this.host._curSpaceCfg?.openings?.find((item: OpeningCfg) => item.id === this.host._openingRebindId)
      : null;
    this.host._openingDialog = {
      ...(rebound ? {
        id: rebound.id,
        type: rebound.type,
        lengthCm: Math.round((rebound.length * NORM_W / this.host._gridPitch) * this.host._cellCm),
        lengthTouched: false,
        contact: rebound.contact || '', lock: rebound.lock || '',
        invert: !!rebound.invert, flipH: !!rebound.flip_h, flipV: !!rebound.flip_v,
      } : {
        type: place.type, lengthCm: place.lengthCm, contact: '', lock: '',
        invert: false, flipH: place.flipH, flipV: place.flipV,
      }),
      ...(place.host ? { host: place.host } : {}),
      x: place.x, y: place.y, angle: place.angle,
    };
    this.host._openingRebindId = null;
    // rulers, tick and ghost live only through the placement gesture
    this.host._openingHoverCandidate = null;
    this.host._cursorPt = null;
  }

public _editOpening(o: RenderOpening): void {
    this.host._openingDialog = {
      id: o.id,
      type: o.type,
      lengthCm: Math.round((o.rlen / this.host._gridPitch) * this.host._cellCm),
      lengthTouched: false,
      contact: o.contact || '',
      lock: o.lock || '',
      invert: !!o.invert,
      flipH: !!o.flip_h,
      flipV: !!o.flip_v,
      ...(o.host?.kind === 'partition' ? { host: { ...o.host } } : {}),
      x: o.rx, y: o.ry, angle: o.angle,
    };
  }

public _opPointerDown(ev: PointerEvent, o: OpeningCfg): void {
    if (this.host._mode !== 'plan' || !this.host._spaceModel()) return;
    // HP-1550-04: in the resize tool the wall handles own the geometry — a door
    // in the middle of a wall must neither swallow the handle nor start its own
    // drag (it travels with the wall through the resize pipeline instead)
    if (this.host._tool === 'resize') return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      capturePointer(ev);
    } catch {
      /* an inactive pointerId (synthetic events, some browsers) must not kill the drag */
    }
    this.host._opDrag = {
      id: o.id, moved: false, sx: ev.clientX, sy: ev.clientY, dirty: false,
      before: this._geometrySnapshot(),
    };
  }

public _opPointerMove(ev: PointerEvent, o: OpeningCfg): void {
    queueHouseplanPointerMove(this.host, 'opening', () => this._opPointerMoveNow(ev, o));
  }

private _opPointerMoveNow(ev: PointerEvent, o: OpeningCfg): void {
    if (!this.host._opDrag || this.host._opDrag.id !== o.id) return;
    // audit L4: the other drag pipelines require 3 px before calling it a drag.
    // Without it every tap counted as a drag: the properties dialog never
    // opened and an unchanged config was written (which then broadcast the
    // event behind the L2 data loss).
    if (Math.abs(ev.clientX - this.host._opDrag.sx) + Math.abs(ev.clientY - this.host._opDrag.sy) <= 3) return;
    const space = this.host._spaceModel();
    if (!space) return;
    const raw = this._svgPoint(ev);
    const sp = this.host._curSpaceCfg;
    const cfg = sp?.openings?.find((x: OpeningCfg) => x.id === o.id);
    if (!cfg) return;
    if (cfg.host?.kind === 'partition') {
      const partition = space.partitions.find((item) => item.id === cfg.host!.id);
      if (!partition) return;
      const dx = partition.b[0] - partition.a[0], dy = partition.b[1] - partition.a[1];
      const length = Math.hypot(dx, dy);
      if (!(length > 1e-9)) return;
      const ux = dx / length, uy = dy / length;
      const perpendicular = Math.abs(
        (raw[0] - partition.a[0]) * uy - (raw[1] - partition.a[1]) * ux,
      );
      if (perpendicular > this.host._gridPitch * 4) return;
      const half = cfg.length * NORM_W / 2;
      const jamb = partitionOpeningJambMargin(partition, this.host._cellCm, this.host._gridPitch);
      const shoulder = half + jamb;
      let along = (raw[0] - partition.a[0]) * ux + (raw[1] - partition.a[1]) * uy;
      along = Math.round(along / this.host._gridPitch) * this.host._gridPitch;
      along = Math.max(shoulder, Math.min(length - shoulder, along));
      if (length < shoulder * 2 - 1e-9) return;
      const t = along / length;
      const nx = (partition.a[0] + ux * along) / NORM_W;
      const ny = (partition.a[1] + uy * along) / this.host._spaceH;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle >= 90) angle -= 180;
      else if (angle < -90) angle += 180;
      const changed = cfg.host.t !== t || cfg.x !== nx || cfg.y !== ny || cfg.angle !== angle;
      this.host._opDrag.moved = true;
      if (changed) this.host._opDrag.dirty = true;
      cfg.host = { ...cfg.host, t };
      cfg.x = nx; cfg.y = ny; cfg.angle = angle;
      this.host._opMeasure = null;
      if (changed) this.host._cfgEpoch++;
      this.host.requestUpdate();
      return;
    }
    const snap = snapToWall(raw, space.rooms, this.host._gridPitch * 4);
    if (!snap) return; // too far from any wall: the opening stays where it was
    this.host._opDrag.moved = true;
    // ruler badges on both shoulders + soft magnet to the wall's center
    // (owner 2026-08-03) — the very same helper the PLACEMENT preview uses
    const r = this._opRuler(snap, cfg.length * NORM_W);
    this.host._opMeasure = r.measure;
    const nx = r.x / NORM_W;
    const ny = r.y / this.host._spaceH;
    const geometryChanged = cfg.x !== nx || cfg.y !== ny || cfg.angle !== snap.angle;
    if (geometryChanged) this.host._opDrag.dirty = true;
    cfg.x = nx;
    cfg.y = ny;
    cfg.angle = snap.angle;
    if (Number(this.host._serverCfg?.model_version || 0) >= 9) {
      const host = resolveRoomOpeningHost(cfg, sp?.wall_segments || []);
      if (host) cfg.host = host;
      else delete cfg.host;
    }
    // The wall cut and room-coloured tunnel are geometry caches too. Advance
    // the preview epoch so both follow the live opening instead of remaining at
    // its pre-drag location until pointerup/save.
    if (geometryChanged) this.host._cfgEpoch++;
    this.host.requestUpdate();
  }

public _opRuler(
    snap: { x: number; y: number; angle: number },
    rlen: number,
  ): { x: number; y: number; angle: number; measure: OpMeasure | null } {
    const rooms = this.host._spaceModel()?.rooms || [];
    const tol = this.host._gridPitch / 2;
    let cx = snap.x, cy = snap.y;
    let sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol);
    if (sh && sh.centered && (cx !== sh.wallCenter[0] || cy !== sh.wallCenter[1])) {
      [cx, cy] = sh.wallCenter;
      sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol);
    } else if (sh) {
      // Not centred: quantise the offset ALONG the wall to the grid step
      // (docs/CANVAS.md §9.3). Grid-BOUND would lift the opening off a diagonal
      // wall, so the wall stays the master and the grid only says WHERE on it.
      // The magnet is consulted first on purpose — a wall whose middle is not a
      // node must still be able to hold a centred window.
      const [ax, ay] = sh.wallA, [bx, by] = sh.wallB;
      const wx = bx - ax, wy = by - ay;
      const len = Math.hypot(wx, wy);
      if (len > 0) {
        const g = this.host._gridPitch;
        const half = Math.min(rlen / 2, len / 2);
        let along = Math.round((((cx - ax) * wx + (cy - ay) * wy) / len) / g) * g;
        along = Math.max(half, Math.min(len - half, along));
        cx = ax + (along / len) * wx;
        cy = ay + (along / len) * wy;
        sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol) || sh;
      }
    }
    if (!sh) return { x: cx, y: cy, angle: snap.angle, measure: null };
    const imperial = this.host.hass?.config?.unit_system?.length === 'mi';
    const lbl = (d: number, m: number[]) =>
      ({ x: m[0], y: m[1], text: formatLength((d / this.host._gridPitch) * this.host._cellCm, imperial) });
    return {
      x: cx, y: cy, angle: snap.angle,
      measure: {
        labels: [lbl(sh.sideA, sh.midA), lbl(sh.sideB, sh.midB)],
        guide: sh.centered
          ? { x: sh.wallCenter[0], y: sh.wallCenter[1], angle: snap.angle }
          : null,
      },
    };
  }

public _opPointerUp(ev: PointerEvent, o: OpeningCfg): void {
    if (!this.host._opDrag || this.host._opDrag.id !== o.id) return;
    flushHouseplanPointerMove(this.host, 'opening');
    const drag = this.host._opDrag;
    const moved = drag.moved;
    this.host._opMeasure = null; // badges and the center tick live only through the drag
    // only write when the geometry actually changed (audit L4)
    if (moved && drag.dirty) {
      this._commitPhysicalGeometry(this.host._t('history.move_opening'), drag.before);
    }
    // keep the flag until the click event that follows pointerup, then let it go
    const finish = () => { this.host._opDrag = null; this.host.requestUpdate(); };
    if (moved) window.setTimeout(finish, 0); else finish();
  }

public _opClick(ev: MouseEvent, o: RenderOpening): void {
    // HP-1550-04: in the resize tool a click over an opening falls through to
    // the stage (room picking) instead of opening the editor dialog
    if (this.host._mode === 'plan' && this.host._tool === 'resize') return;
    ev.stopPropagation();
    if (this.host._opDrag?.moved) return; // that click was the tail of a drag
    // openings are inert outside Plan mode (owner's decision: View must not
    // interact with them at all); in Plan any click on an opening edits it
    if (this.host._mode === 'plan') this._editOpening(o);
  }

public _saveOpening(): void {
    const d = this.host._openingDialog;
    const sp = this.host._curSpaceCfg;
    const model = this.host._spaceModel();
    if (!d || !sp || !model) return;
    const before = this._geometrySnapshot();
    const H = this.host._spaceH;
    const previous = (sp.openings || []).find((item: OpeningCfg) => item.id === d.id);
    const o: OpeningCfg = {
      ...(previous || {}),
      id: d.id || 'o' + Date.now().toString(36),
      type: d.type,
      x: d.x / NORM_W,
      y: d.y / H,
      angle: d.angle,
      length: previous && !d.lengthTouched
        ? previous.length
        : this.host._cmToUnits(Math.max(20, d.lengthCm)) / NORM_W,
      ...(d.host ? { host: { ...d.host } } : {}),
    };
    if (o.host?.kind === 'partition') {
      const strict = partitionOpeningNeedsStrictValidation(previous, o);
      const resolution = strict
        ? resolvePartitionOpeningStrict(
            o, model.partitions, NORM_W, this.host._cellCm, this.host._gridPitch,
          )
        : resolvePartitionOpeningCompat(
            o, model.partitions, NORM_W, this.host._cellCm, this.host._gridPitch,
          );
      if (!resolution.resolved) {
        const partition = model.partitions.find((item) => item.id === o.host!.id);
        if (resolution.reason === 'does-not-fit-jamb' && partition) {
          const margin = partitionOpeningJambMargin(
            partition, this.host._cellCm, this.host._gridPitch,
          );
          this.host._showToast(this.host._t('opening.partition_jamb_margin', {
            distance: formatLength(
              (margin / this.host._gridPitch) * this.host._cellCm, this.host._imperial,
            ),
          }));
        } else {
          this.host._showToast(this.host._t('opening.partition_orphan'));
        }
        return;
      }
      const siblings = (sp.openings || []).flatMap((item: OpeningCfg) => {
        if (!item.host || item.id === o.id) return [];
        const sibling = resolvePartitionOpeningCompat(
          item, model.partitions, NORM_W, this.host._cellCm, this.host._gridPitch,
        ).resolved;
        return sibling ? [sibling] : [];
      });
      if (hostedOpeningIntervalsOverlap(resolution.resolved, siblings)) {
        this.host._showToast(this.host._t('toast.opening_no_wall'));
        return;
      }
      Object.assign(o, materializePartitionOpening(o, resolution.resolved, NORM_W));
    } else if (Number(this.host._serverCfg?.model_version || 0) >= 9) {
      const host = resolveRoomOpeningHost(o, sp.wall_segments || []);
      if (!host) {
        this.host._showToast(this.host._t('toast.opening_no_wall'));
        return;
      }
      o.host = host;
    } else {
      delete o.host;
    }
    if (d.type === 'passage') {
      // The canonical passage record contains geometry only. Delete keys
      // instead of writing null/false so imports and old broken records have
      // one unambiguous representation after an explicit edit.
      delete o.contact;
      delete o.lock;
      delete o.invert;
      delete o.flip_h;
      delete o.flip_v;
    } else {
      o.contact = d.contact || null;
      o.lock = d.type === 'door' || d.type === 'gate' ? d.lock || null : null;
      o.invert = d.invert || undefined;
      o.flip_h = d.type !== 'gate' && d.flipH || undefined;
      o.flip_v = d.flipV || undefined;
    }
    sp.openings = sp.openings || [];
    const i = sp.openings.findIndex((x: OpeningCfg) => x.id === o.id);
    if (i >= 0) sp.openings[i] = o;
    else sp.openings.push(o);
    this._commitPhysicalGeometry(
      this.host._t(d.id ? 'history.edit_opening' : 'history.add_opening'), before,
    );
    this.host._openingDialog = null;
    this.host.requestUpdate();
  }

public _deleteOpening(): void {
    const d = this.host._openingDialog;
    const sp = this.host._curSpaceCfg;
    if (!d?.id || !sp?.openings) return;
    const before = this._geometrySnapshot();
    sp.openings = sp.openings.filter((x: OpeningCfg) => x.id !== d.id);
    this._commitPhysicalGeometry(this.host._t('history.delete_opening'), before);
    this.host._openingDialog = null;
    this.host.requestUpdate();
  }

public _rebindPartitionOpening = (): void => {
    const d = this.host._openingDialog;
    if (!d?.id) return;
    const openingId = d.id;
    this._activateMarkupTool('opening');
    if (this.host._tool !== 'opening') return;
    // Tool activation clears every stale placement session. Publish the
    // rebind identity only after that gate so the next click cannot degrade
    // into creating a second opening.
    this.host._openingRebindId = openingId;
    this.host._openingPreset = {
      type: d.type,
      lengthCm: d.lengthCm,
      flipH: d.flipH,
      flipV: d.flipV,
      revision: ++this.host._openingPresetRevision,
    };
    this.host._openingDialog = null;
    this.host._openingHoverCandidate = null;
  };

public _contactCandidates(): { value: string; label: string }[] {
    const out: [string, string, number][] = [];
    for (const eid of Object.keys(this.host.hass.states)) {
      if (!this.host._openingEntityAvailable(eid)) continue;
      const dom = eid.split('.')[0];
      if (dom !== 'binary_sensor' && dom !== 'cover') continue;
      const st = this.host.hass.states[eid];
      const dc = st?.attributes?.device_class || '';
      const doorish = ['door', 'window', 'opening', 'garage_door', 'garage'].includes(dc);
      if (dom === 'cover' && !doorish) continue;
      out.push([eid, st?.attributes?.friendly_name || eid, doorish ? 0 : 1]);
    }
    return out
      .sort((a, b) => a[2] - b[2] || a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }

public _lockCandidates(): { value: string; label: string }[] {
    return Object.keys(this.host.hass.states)
      .filter((eid) => eid.startsWith('lock.') && this.host._openingEntityAvailable(eid))
      .map((eid) => ({ value: eid, label: this.host.hass.states[eid]?.attributes?.friendly_name || eid }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

public _toggleOpeningEntityPicker(kind: 'contact' | 'lock'): void {
    const d = this.host._openingDialog;
    if (!d) return;
    const nextOpen = kind === 'contact' ? !d.contactOpen : !d.lockOpen;
    this.host._openingDialog = {
      ...d,
      contactOpen: kind === 'contact' ? nextOpen : false,
      lockOpen: kind === 'lock' ? nextOpen : false,
    };
  }

public _filterOpeningEntities(kind: 'contact' | 'lock', value: string): void {
    const d = this.host._openingDialog;
    if (!d) return;
    this.host._openingDialog = kind === 'contact'
      ? { ...d, contactFilter: value }
      : { ...d, lockFilter: value };
  }

public _selectOpeningEntity(kind: 'contact' | 'lock', value: string): void {
    const d = this.host._openingDialog;
    if (!d) return;
    this.host._openingDialog = kind === 'contact'
      ? { ...d, contact: value, contactOpen: false, contactFilter: '' }
      : { ...d, lock: value, lockOpen: false, lockFilter: '' };
  }

public _mergeClick(raw: number[]): void {
    const space = this.host._spaceModel();
    if (!space) return;
    const rooms = space.rooms;
    const hit = [...rooms].reverse().find((r) => this._pointInRoom(raw, r));
    if (!hit?.id) return;
    const hitId = hit.id;
    if (!this.host._mergeSel || this.host._mergeSel === hitId) {
      this.host._mergeSel = this.host._mergeSel === hitId ? null : hitId; // click again = deselect
      return;
    }
    const a = rooms.find((r) => r.id === this.host._mergeSel);
    const pa = a ? roomPoly(a) : null;
    const pb = roomPoly(hit);
    const merged = pa && pb ? mergeRooms(pa, pb) : null;
    if (!merged) {
      // only rooms sharing a wall collapse into one outline (see mergeRooms)
      this.host._showToast(this.host._t('toast.merge_not_adjacent'));
      this.host._mergeSel = null;
      return;
    }
    this.host._mergeDialog = { aId: this.host._mergeSel, bId: hitId, poly: merged, pick: 'a' };
    this.host._mergeSel = null;
  }

public _commitMerge(): void {
    const d = this.host._mergeDialog;
    const sp = this.host._curSpaceCfg;
    if (!d || !sp || !this.host._spaceModel()) return;
    const before = this._geometrySnapshot();
    const H = this.host._spaceH;
    const keepId = d.pick === 'a' ? d.aId : d.bId;
    const dropId = d.pick === 'a' ? d.bId : d.aId;
    const keep = sp.rooms.find((r: any) => r.id === keepId);
    if (!keep) {
      this.host._mergeDialog = null;
      return;
    }
    // the kept room keeps its id, so its label position and devices stay put
    keep.poly = d.poly.map((p) => [p[0] / NORM_W, p[1] / H]);
    delete keep.x; delete keep.y; delete keep.w; delete keep.h; // a merged room is never a rect
    sp.rooms = sp.rooms.filter((r: any) => r.id !== dropId);
    const committed = this._commitPhysicalGeometry(this.host._t('history.merge_rooms'), before);
    this.host._mergeDialog = null;
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    if (committed) this.host._showToast(this.host._t('toast.rooms_merged', { name: keep.name || '' }));
  }

public _splitClick(raw: number[]): void {
    const space = this.host._spaceModel();
    if (!space) return;
    const rooms = space.rooms;
    if (!this.host._splitSel) {
      const hit = [...rooms].reverse().find((r) => this._pointInRoom(raw, r));
      if (!hit?.id) return;
      this.host._splitSel = { roomId: hit.id, pts: [] };
      return;
    }
    const room = rooms.find((r) => r.id === this.host._splitSel!.roomId);
    const poly = room ? roomPoly(room) : null;
    if (!room || !poly) {
      this.host._splitSel = null;
      return;
    }
    // A split point lands on the room's nearest wall — the user aims at a wall,
    // and rooms need not be grid-aligned (imported/legacy polygons), so snapping
    // to the grid would miss the outline. The pull is capped: a click far from
    // any wall (e.g. an accidental one in the middle of the room) is a miss and
    // gets the toast, not a wall the user never meant. splitRoom() still rejects
    // any cut that is not a clean wall-to-wall chord.
    // …and it is still QUANTISED: the offset ALONG the wall moves in whole grid
    // steps (docs/CANVAS.md §9), which on the axis-aligned, grid-drawn walls the
    // editor itself makes IS a grid node. There is no free-position bypass.
    const eps = this.host._gridPitch * 0.02;
    const pull = this.host._gridPitch * 6; // ≈2.5% of the plan width — generous but intentional
    const raw0 = closestPointOnBoundary(raw, poly);
    const near = raw0 ? (snapPointAlongPoly(raw0, poly, this.host._gridPitch) || raw0) : raw0;
    const wallPt = raw0 && near && Math.hypot(raw0[0] - raw[0], raw0[1] - raw[1]) <= pull ? near : null;
    const onWall = !!wallPt && pointOnBoundary(wallPt, poly, eps);
    const cur = this.host._splitSel.pts;
    if (!cur.length) {
      // the cut starts on a wall
      if (!onWall) {
        this.host._showToast(this.host._t('toast.split_pick_wall'));
        return;
      }
      this.host._splitSel = { ...this.host._splitSel, pts: [wallPt!] };
      return;
    }
    if (!onWall) {
      // an interior click adds an intermediate vertex of the cut path
      const mid = this._snap(raw);
      if (!ptInside(mid, poly, eps)) {
        this.host._showToast(this.host._t('toast.split_pick_inside'));
        return;
      }
      this.host._splitSel = { ...this.host._splitSel, pts: [...cur, mid] };
      return;
    }
    // a wall point finishes the cut
    const parts = splitRoomPath(poly, [...cur, wallPt!], eps);
    if (!parts) {
      this.host._showToast(this.host._t('toast.split_bad_cut'));
      return;
    }
    this._resetRoomDialogFields();
    // the bigger part stays the room it was — name, area and devices go with it
    const [p1, p2] = parts;
    const main = polygonArea(p1) >= polygonArea(p2) ? p1 : p2;
    const fresh = main === p1 ? p2 : p1;
    this.host._pendingSplit = { roomId: room.id!, mainPoly: main, newPoly: fresh };
    this.host._cursorPt = null;
    this.host._nameSel = '';
    this.host._areaSel = '';
    this.host._roomDialog = true;
  }

public _markupMove(ev: MouseEvent): void {
    if (!this.host._markup) return;
    if (this.host._tool === 'column') {
      this.host._cursorPt = this._snap(this._svgPoint(ev));
      return;
    }
    if (this.host._tool === 'opening' || this.host._tool === 'wallthick') {
      // hover preview: raw cursor point; snapping happens in the preview getters
      this.host._cursorPt = this._svgPoint(ev);
      return;
    }
    const architectural = this.host._tool === 'draw' && !this.host._contourClosed;
    const cutting = this.host._tool === 'split' && !!this.host._splitSel?.pts?.length;
    if (!architectural && !cutting) return;
    const raw = this._svgPoint(ev);
    if (architectural) {
      const resolved = this._resolvePlanDrawPoint(raw, ev.shiftKey);
      this.host._planSnapHover = {
        contextKey: resolved.contextKey,
        candidate: resolved.candidate,
        conflicts: resolved.conflicts,
      };
      this._syncPlanSnapConflictMarkers(resolved.conflicts);
      this._syncPlanSnapActiveMarker(resolved.candidate);
      // Before the first click there is no rubber-band to repaint. Updating the
      // dedicated marker avoids walking the complete large-house Lit tree for
      // every mouse move while click still resolves from the event coordinate.
      if (!this.host._path.length) return;
      this.host._cursorPt = resolved.point;
      return;
    }
    this.host._cursorPt = this._snap(raw);
  }

public _saveRoom(): void {
    if (!this.host._areaSel && !this.host._nameSel.trim()) return;
    if (this.host._wallFaceBatch) {
      this._decideWallFace(true);
      return;
    }
    this._commitRoom();
  }

public _decideWallFace(create: boolean): void {
    const batch = this.host._wallFaceBatch;
    if (!batch) return;
    const candidate = batch.candidates[batch.index];
    if (!candidate) return;
    if (!create && (candidate.existing || candidate.repair) && batch.candidates.length === 1) {
      this.host._wallFaceBatch = null;
      this.host._roomDialog = false;
      this.host._nameSel = '';
      this.host._areaSel = '';
      this.host.requestUpdate();
      return;
    }
    const decision: WallFaceDecision = create ? {
      candidate,
      create: true,
      name: this.host._nameSel.trim(),
      area: this.host._areaSel || null,
      settings: this._roomSettingsFromDialog()
        ? JSON.parse(JSON.stringify(this._roomSettingsFromDialog())) : null,
    } : { candidate, create: false };
    const decisions = [...batch.decisions, decision];
    const nextIndex = batch.index + 1;
    if (nextIndex < batch.candidates.length) {
      this.host._wallFaceBatch = { ...batch, decisions, index: nextIndex };
      this.host._nameSel = '';
      this.host._areaSel = '';
      this._resetRoomDialogFields();
      this.host.requestUpdate();
      return;
    }
    this.host._wallFaceBatch = { ...batch, decisions };
    this._applyWallFaceBatch();
  }

public _wallSourceCmAt(
    point: number[], activePath: number[][], activeCms: number[],
  ): number {
    const validCm = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    const epsilon = this.host._gridPitch * 0.02;
    const model = this.host._spaceModel();
    if (!model) return DRAW_WALL_DEFAULT_CM;
    // Already-saved independent masonry is authoritative when the new chain
    // traces it. Room-owned walls are preserved by the canonical wall helpers.
    for (const segment of this._planSnapGeometrySnapshot().value.segments) {
      if (segment.sourceKind === 'room'
          || distToSegment(point, [segment.a[0], segment.a[1], segment.b[0], segment.b[1]]) > epsilon) continue;
      if (segment.sourceKind === 'partition') {
        return validCm(model.partitions.find((item) => item.id === segment.sourceId)?.cm)
          ?? DRAW_WALL_DEFAULT_CM;
      }
    }
    // Толщина отрезка активной цепочки решается тем же резолвером (#234):
    // именно это значение подсвечивает инструмент «Толщина», и расхождение с
    // записью здесь было тем способом, которым дефект и обнаружился.
    const resolved = chainSegmentCms(
      Math.max(0, activePath.length - 1), activeCms,
      this.host._drawWallCm, DRAW_WALL_DEFAULT_CM,
    );
    for (let i = 0; i + 1 < activePath.length; i++) {
      const a = activePath[i], b = activePath[i + 1];
      if (distToSegment(point, [a[0], a[1], b[0], b[1]]) <= epsilon) {
        return resolved[i] ?? DRAW_WALL_DEFAULT_CM;
      }
    }
    return DRAW_WALL_DEFAULT_CM;
  }

public _activePathWithRepair(
    path: number[][], proposal: WallFaceRepairProposal | undefined,
  ): number[][] {
    const result = path.map((point) => [...point]);
    if (!proposal) return result;
    const source = this.host._activeWallChainPartitionIds.findIndex((_, index) => (
      this._activeWallSourceKey(index) === proposal.sourceKey
    ));
    const index = source >= 0 ? source + (proposal.endpoint === 'b' ? 1 : 0) : -1;
    if (index >= 0 && index < result.length) result[index] = [...proposal.to];
    return result;
  }

public _validateWallRepair(
    proposal: WallFaceRepairProposal, activePath: number[][],
  ): boolean {
    const epsilon = this.host._gridPitch * 0.0002;
    const sources = this._wallGraphSources(activePath);
    const source = sources.find((item) => item.key === proposal.sourceKey);
    const target = sources.find((item) => item.key === proposal.targetSourceKey);
    if (!source || !target) return false;
    const current = proposal.endpoint === 'a' ? source.a : source.b;
    if (Math.hypot(current[0] - proposal.from[0], current[1] - proposal.from[1]) > epsilon) return false;
    if (distToSegment(proposal.to, [target.a[0], target.a[1], target.b[0], target.b[1]]) > epsilon) {
      return false;
    }
    if (repairMovesHostedPartition(
      proposal, (this.host._curSpaceCfg as any)?.openings || [],
    )) return false;
    return true;
  }

public _applyWallRepair(
    proposal: WallFaceRepairProposal, batch: WallFaceBatch,
  ): boolean {
    const sp = this.host._curSpaceCfg as any;
    if (!sp || !this._validateWallRepair(proposal, batch.activePath)) return false;
    const write = (point: number[]): void => {
      point[0] = proposal.to[0] / NORM_W;
      point[1] = proposal.to[1] / NORM_W;
    };
    if (!proposal.sourceKey.startsWith('static:')) return false;
    const [kind, sourceId] = proposal.sourceKey.slice('static:'.length).split('|');
    if (kind === 'partition') {
      const partition = (sp.partitions || []).find((item: PartitionCfg) => item.id === sourceId);
      if (!partition) return false;
      const renderA = [partition.a[0] * NORM_W, partition.a[1] * NORM_W];
      const renderB = [partition.b[0] * NORM_W, partition.b[1] * NORM_W];
      const point = Math.hypot(renderA[0] - proposal.from[0], renderA[1] - proposal.from[1])
          <= this.host._gridPitch * 0.0002 ? partition.a
        : Math.hypot(renderB[0] - proposal.from[0], renderB[1] - proposal.from[1])
          <= this.host._gridPitch * 0.0002 ? partition.b : null;
      if (!point) return false;
      write(point);
      const activeIndex = batch.activePartitionIds.indexOf(sourceId);
      if (activeIndex >= 0) {
        const pathIndex = activeIndex + (proposal.endpoint === 'b' ? 1 : 0);
        if (batch.activePath[pathIndex]) batch.activePath[pathIndex] = [...proposal.to];
      }
      return true;
    }
    return false;
  }

public _applyWallFaceBatch(): void {
    const batch = this.host._wallFaceBatch;
    const sp = this.host._curSpaceCfg as any;
    const model = this.host._spaceModel();
    if (!batch || !sp || !model) return;
    const abort = (message: string, vars?: Record<string, string | number>): void => {
      this.host._showToast(this.host._t(message as any, vars));
      this._roomDialogCancel();
    };
    const accepted = batch.decisions.filter((decision) => decision.create);
    const acceptedRings = accepted.map((decision) => decision.candidate.ring);
    const existingRooms = model.rooms;
    for (let i = 0; i < acceptedRings.length; i++) {
      if (this._contourSelfIntersects(acceptedRings[i]) || polygonArea(acceptedRings[i]) <= 1e-6) {
        abort('toast.contour_cannot_close');
        return;
      }
      for (let j = i + 1; j < acceptedRings.length; j++) {
        if (roomsOverlap(acceptedRings[i], acceptedRings[j])) {
          abort('toast.contour_cannot_close');
          return;
        }
      }
      const ownSplit = accepted[i].candidate.split?.roomId;
      const clash = existingRooms.find((room) => room.id !== ownSplit
        && !!roomPoly(room) && roomsOverlap(acceptedRings[i], roomPoly(room)!));
      if (clash) {
        abort('toast.room_overlap', { name: clash.name || '' });
        return;
      }
    }
    if ((sp.rooms || []).length + accepted.length > MAX_ROOMS) {
      abort('toast.physical_limit');
      return;
    }
    if (accepted.some((decision) => decision.candidate.split
        && !sp.rooms.some((room) => room.id === decision.candidate.split!.roomId))) {
      abort('toast.contour_cannot_close');
      return;
    }

    const repairs = accepted
      .map((decision) => decision.candidate.repair)
      .filter((repair): repair is WallFaceRepairProposal => !!repair);
    if (repairs.length > 1 || (repairs[0] && !this._validateWallRepair(repairs[0], batch.activePath))) {
      abort('toast.wall_repair_changed');
      return;
    }
    const effectiveActivePath = this._activePathWithRepair(batch.activePath, repairs[0]);

    if (!accepted.length) {
      this.host._path = [];
      this.host._activeWallChainId = null;
      this.host._activeWallChainPartitionIds = [];
      this.host._wallChainSegmentCms = [];
      this.host._wallChainRedo = [];
      this.host._closingWallCm = null;
      this.host._wallFaceBatch = null;
      this.host._roomDialog = false;
      this.host._nameSel = '';
      this.host._areaSel = '';
      this.host.requestUpdate();
      this.host._showToast(this.host._t('toast.wall_chain_saved'));
      return;
    }
    const activePartitionIds = new Set(batch.activePartitionIds);
    const epsilon = this.host._gridPitch * 0.0002;
    const roomLineage = accepted.map((decision) => decision.candidate.ring.map((a, index, ring) => {
      const b = ring[(index + 1) % ring.length];
      const carriers = model.partitions.filter((partition) => {
        const length = Math.hypot(partition.b[0] - partition.a[0], partition.b[1] - partition.a[1]);
        if (!(length > epsilon)) return false;
        const ux = (partition.b[0] - partition.a[0]) / length;
        const uy = (partition.b[1] - partition.a[1]) / length;
        const along = (point: number[]) => (
          (point[0] - partition.a[0]) * ux + (point[1] - partition.a[1]) * uy
        );
        return distToSegment(a, [partition.a[0], partition.a[1], partition.b[0], partition.b[1]]) <= epsilon
          && distToSegment(b, [partition.a[0], partition.a[1], partition.b[0], partition.b[1]]) <= epsilon
          && along(a) >= -epsilon && along(a) <= length + epsilon
          && along(b) >= -epsilon && along(b) <= length + epsilon;
      });
      carriers.sort((left, right) => (
        Number(activePartitionIds.has(right.id)) - Number(activePartitionIds.has(left.id))
        || Math.hypot(left.b[0] - left.a[0], left.b[1] - left.a[1])
          - Math.hypot(right.b[0] - right.a[0], right.b[1] - right.a[1])
        || left.id.localeCompare(right.id)
      ));
      return carriers[0]?.id || '';
    }));
    const before = this._geometrySnapshot();
    if (!before) {
      abort('toast.geometry_unsafe');
      return;
    }
    const abortMutation = (): void => {
      this._restoreGeometryStateLocal(before);
      abort('toast.geometry_unsafe');
    };
    if (repairs[0] && !this._applyWallRepair(repairs[0], batch)) {
      abort('toast.wall_repair_changed');
      return;
    }
    const hasSplit = accepted.some((decision) => !!decision.candidate.split);
    const splitWalls = hasSplit
      ? materializeWallIntervals(
          model.rooms, sp.walls, this.host._openCuts(),
          this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
        )
      : null;
    const wallsBeforeSplit = hasSplit && Array.isArray(sp.walls) ? sp.walls : null;
    for (const decision of accepted) {
      const split = decision.candidate.split;
      if (!split) continue;
      const main = sp.rooms.find((room) => room.id === split.roomId);
      if (!main) {
        abortMutation();
        return;
      }
      main.poly = split.mainPoly.map((point) => [point[0] / NORM_W, point[1] / this.host._spaceH]);
      delete main.x; delete main.y; delete main.w; delete main.h;
    }

    const seed = Date.now().toString(36);
    const newRooms: Array<{ room: any; decision: WallFaceDecision }> = [];
    accepted.forEach((decision, index) => {
      const areaName = decision.area ? this.host.hass.areas[decision.area]?.name : '';
      const room = {
        id: `r${seed}-${index}`,
        name: decision.name || areaName || this.host._t('room.default_name'),
        area: decision.area || null,
        poly: decision.candidate.ring.map((point) =>
          [point[0] / NORM_W, point[1] / this.host._spaceH]),
        ...(roomLineage[index].some(Boolean) ? { wall_ids: roomLineage[index] } : {}),
        ...(decision.settings ? { settings: JSON.parse(JSON.stringify(decision.settings)) } : {}),
      };
      sp.rooms.push(room);
      newRooms.push({ room, decision });
    });

    if (hasSplit) {
      const next = this.host._normalizeWalls(splitWalls, this.host._openCuts());
      if (next.length) sp.walls = next;
      else if (!wallsBeforeSplit?.length) delete sp.walls;
      else sp.walls = wallsBeforeSplit;
    }
    if (newRooms.length) {
      // Make the new model visible to the canonical wall helpers before they
      // key intervals. This is still inside the one history/save transaction.
      this.host._cfgEpoch++;
      const openCuts = this.host._openCuts();
      const updatedModel = this.host._spaceModel();
      if (!updatedModel) {
        abortMutation();
        return;
      }
      let walls = sp.walls;
      for (const { room, decision } of newRooms) {
        const ring = decision.candidate.ring;
        const fallback = this._wallSourceCmAt(
          ring[0], batch.activePath, batch.activeCms,
        );
        walls = applyWallThicknessToNewRoom(
          walls, updatedModel.rooms, room.id, fallback,
          this.host._wallKeyPitch, openCuts, NORM_W,
        );
        for (const interval of wallIntervals(
          updatedModel.rooms, walls, openCuts,
          this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
        )) {
          if (interval.roomId !== room.id || interval.kind !== 'outer') continue;
          const midpoint = [
            (interval.a[0] + interval.b[0]) / 2,
            (interval.a[1] + interval.b[1]) / 2,
          ];
          walls = setWallThickness(
            walls, interval.a, interval.b,
            this._wallSourceCmAt(midpoint, batch.activePath, batch.activeCms),
            this.host._wallKeyPitch, NORM_W,
          );
        }
      }
      const normalized = this.host._normalizeWalls(walls, openCuts);
      if (normalized.length) sp.walls = normalized;
      else delete sp.walls;

      // Every accepted click already wrote an ordinary partition. Once the
      // chain creates room faces, consume the coincident carriers into the
      // canonical room-wall representation in this same transaction.
      this.host._cfgEpoch++;
      const reconciledModel = this.host._spaceModel();
      if (!reconciledModel) {
        abortMutation();
        return;
      }
      const reconciled = reconcileCoincidentPartitions(
        sp, reconciledModel, sp.walls, openCuts,
        {
          pitch: this.host._wallKeyPitch,
          cellCm: this.host._cellCm,
          gridPitch: this.host._gridPitch,
          coordScale: NORM_W,
          allowCoincidentPartitions: true, // #478 room acceptance consumes its wall carriers.
        },
      );
      if (reconciled.walls.length) sp.walls = reconciled.walls;
      else delete sp.walls;
      if (reconciled.partitions.length) sp.partitions = reconciled.partitions;
      else delete sp.partitions;
      if (reconciled.openings.length) sp.openings = reconciled.openings;
      else delete sp.openings;
    }

    if (!this._commitPhysicalGeometry(this.host._t('history.wall_face_batch'), before)) return;
    this.host._path = [];
    this.host._activeWallChainId = null;
    this.host._activeWallChainPartitionIds = [];
    this.host._wallChainSegmentCms = [];
    this.host._wallChainRedo = [];
    this.host._closingWallCm = null;
    this.host._wallFaceBatch = null;
    this.host._roomDialog = false;
    this.host._nameSel = '';
    this.host._areaSel = '';
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    // Match the ordinary room-save contract: newly area-bound devices are
    // auto-added and their initial positions are pinned immediately, while a
    // clean split leaves the surviving parent's existing layout untouched.
    const boundAreas = new Set(accepted
      .map((decision) => decision.area)
      .filter((area): area is string => !!area));
    if (boundAreas.size) {
      const next = { ...this.host._layout };
      for (const device of this.host._devices) {
        if (!boundAreas.has(device.area || '') || device.space !== this.host._space) continue;
        if (this.host._layout[device.id]) continue;
        const position = this.host._defPos[device.id];
        if (!position) continue;
        next[device.id] = {
          s: this.host._space, x: position.x / NORM_W, y: position.y / NORM_W,
        };
        this.host._dirtyPos.add(device.id);
      }
      this.host._layout = next;
      this.host._persistLayout();
    }
    this.host._showToast(this.host._t(accepted.length ? 'toast.wall_rooms_saved' : 'toast.wall_chain_saved', {
      n: accepted.length,
    }));
  }

public _commitRoom(): void {
    const sp = this.host._curSpaceCfg;
    const space = this.host._spaceModel();
    if (!sp || !space) return;
    const before = this._geometrySnapshot();
    if (!before) return;
    const abortMutation = (): void => {
      this._restoreGeometryStateLocal(before);
      this.host._showToast(this.host._t('toast.geometry_unsafe'));
    };
    const H = this.host._spaceH;
    const wasSplit = !!this.host._pendingSplit;
    // Split changes the two source-wall edges into shorter children. Preserve
    // the effective old profile while the original outline still proves the
    // full extent of legacy midpoint-only wall keys; after the mutation that
    // information is irrecoverable and one child would normalise to 0 cm.
    const splitWalls = wasSplit
      ? materializeWallIntervals(
          space.rooms, sp.walls, this.host._openCuts(),
          this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
        )
      : null;
    const wallsBeforeSplit = wasSplit && Array.isArray(sp.walls) ? sp.walls : null;
    let verts: number[][];
    if (this.host._pendingSplit) {
      // apply the cut now: the bigger part keeps the original room, this dialog names the rest
      const main = sp.rooms.find((r: any) => r.id === this.host._pendingSplit!.roomId);
      if (!main) {
        this.host._pendingSplit = null;
        this.host._splitSel = null;
        this.host._roomDialog = false;
        return;
      }
      main.poly = this.host._pendingSplit.mainPoly.map((p) => [p[0] / NORM_W, p[1] / H]);
      delete main.x; delete main.y; delete main.w; delete main.h;
      verts = this.host._pendingSplit.newPoly;
    } else {
      if (!this.host._contourClosed) return;
      verts = this.host._path.slice(0, -1); // without the duplicated closing vertex
    }
    const areaName = this.host._areaSel ? this.host.hass.areas[this.host._areaSel]?.name : '';
    const newRoom: any = {
      id: 'r' + Date.now().toString(36),
      name: this.host._nameSel || areaName || this.host._t('room.default_name'),
      area: this.host._areaSel || null,
      poly: verts.map((p) => [p[0] / NORM_W, p[1] / H]),
      ...(this._roomSettingsFromDialog() ? { settings: this._roomSettingsFromDialog() } : {}),
    };
    sp.rooms.push(newRoom);
    // A Split rewrites the parent outline and adds a child, so a span that used
    // to sit between the parent and a neighbour may now belong to the child.
    // Geometry first, then spans and the derived open_to — otherwise border
    // trimming reads the new geometry while glow reads the old connectivity
    // (AUD-159B6-02).
    if (wasSplit) {
      const next = this.host._normalizeWalls(splitWalls, this.host._openCuts());
      if (next.length) sp.walls = next;
      else if (!wallsBeforeSplit?.length) delete sp.walls;
      else sp.walls = wallsBeforeSplit;
    }
    // Draw-session wall thickness: apply to new edges only; keep neighbour cm
    // on shared stretches. Split naming does not use the Draw field.
    if (!wasSplit) {
      const edgeCms = chainSegmentCms(
        verts.length,
        [...this.host._wallChainSegmentCms, this.host._closingWallCm ?? undefined],
        this.host._drawWallCm, DRAW_WALL_DEFAULT_CM,
      );
      const cm = edgeCms[0];
      if (cm != null) {
        this.host._cfgEpoch++; // the new room must be in the model before keying
        const openCuts = this.host._openCuts();
        const updatedSpace = this.host._spaceModel();
        if (!updatedSpace) {
          abortMutation();
          return;
        }
        let next = applyWallThicknessToNewRoom(
          sp.walls, updatedSpace.rooms, newRoom.id, cm,
          this.host._wallKeyPitch, openCuts, NORM_W,
        );
        // The room may have been drawn while the toolbar thickness changed.
        // Shared stretches keep the already-existing physical wall; every
        // outer atomic stretch receives the value of its source draft edge.
        for (const iv of wallIntervals(
          updatedSpace.rooms, next, openCuts,
          this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
        )) {
          if (iv.roomId !== newRoom.id || iv.kind !== 'outer') continue;
          const mid = [(iv.a[0] + iv.b[0]) / 2, (iv.a[1] + iv.b[1]) / 2];
          const source = verts.findIndex((a, i) => {
            const b = verts[(i + 1) % verts.length];
            return distToSegment(mid, [a[0], a[1], b[0], b[1]]) <= this.host._gridPitch * 0.02;
          });
          if (source >= 0) next = setWallThickness(
            next, iv.a, iv.b, edgeCms[source],
            this.host._wallKeyPitch, NORM_W,
          );
        }
        next = this.host._normalizeWalls(next, openCuts);
        if (next.length) sp.walls = next;
        else delete sp.walls;

        const reconciledModel = this.host._spaceModel();
        if (!reconciledModel) {
          abortMutation();
          return;
        }
        const reconciled = reconcileCoincidentPartitions(
          sp, reconciledModel, sp.walls, openCuts,
          {
            pitch: this.host._wallKeyPitch,
            cellCm: this.host._cellCm,
            gridPitch: this.host._gridPitch,
            coordScale: NORM_W,
            allowCoincidentPartitions: true,
          },
        );
        if (reconciled.walls.length) sp.walls = reconciled.walls;
        else delete sp.walls;
        if (reconciled.partitions.length) sp.partitions = reconciled.partitions;
        else delete sp.partitions;
        if (reconciled.openings.length) sp.openings = reconciled.openings;
        else delete sp.openings;
      }
    }
    const committed = this._commitPhysicalGeometry(
      this.host._t(wasSplit ? 'history.split_room' : 'history.add_room'), before,
    );
    this.host._path = [];
    this.host._activeWallChainId = null;
    this.host._activeWallChainPartitionIds = [];
    this.host._wallChainSegmentCms = [];
    this.host._wallChainRedo = [];
    this.host._closingWallCm = null;
    this.host._pendingSplit = null;
    this.host._splitSel = null;
    const boundArea = this.host._areaSel;
    this.host._areaSel = '';
    this.host._nameSel = '';
    this.host._roomDialog = false;
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    if (!committed) return;
    // auto-add the area's device icons + PIN their positions in the layout,
    // so that icons do not get reshuffled when the order in the HA registry changes.
    let added = 0;
    if (boundArea) {
      const H2 = NORM_W;
      const next = { ...this.host._layout };
      for (const d of this.host._devices) {
        if (d.area !== boundArea || d.space !== this.host._space) continue;
        added++;
        if (this.host._layout[d.id]) continue; // placed manually — leave it alone
        const dp = this.host._defPos[d.id];
        if (!dp) continue;
        next[d.id] = { s: this.host._space, x: dp.x / NORM_W, y: dp.y / H2 };
        this.host._dirtyPos.add(d.id);
      }
      this.host._layout = next;
      this.host._persistLayout();
    }
    const roomsN = this.host._model.find((s) => s.id === this.host._space)?.rooms.length || 0;
    this.host._showToast(
      boundArea
        ? this.host._t('toast.room_saved', { n: roomsN, added })
        : this.host._t('toast.room_saved_no_area', { n: roomsN }),
    );
  }

public _cancelPath(): void {
    this.host._wallRepairDiagnostic = null;
    this.host._path = [];
    this.host._activeWallChainId = null;
    this.host._activeWallChainPartitionIds = [];
    this.host._wallChainSegmentCms = [];
    this.host._wallChainRedo = [];
    this.host._closingWallCm = null;
    this._clearPlanSnapHover();
    this.host._roomDialog = false;
    this.host._pendingSplit = null;
    this.host._wallFaceBatch = null;
    this.host._splitSel = null;
    this.host._mergeSel = null;
    this.host._mergeDialog = null;
    this.host._physicalSel = null;
    this.host._physicalDrag = null;
    this.host._physicalRotate = null;
    this._clearOpeningPlacement(true);
  }

public _roomDialogCancel(): void {
    this.host._roomDialog = false;
    if (this.host._roomEditId) {
      this.host._roomEditId = null;
      this.host._nameSel = '';
      this.host._areaSel = '';
      return;
    }
    if (this.host._wallFaceBatch) {
      const batch = this.host._wallFaceBatch;
      this.host._wallFaceBatch = null;
      this.host._path = batch.activePath.map((point) => [...point]);
      this.host._wallChainSegmentCms = [...batch.activeCms];
      this.host._activeWallChainPartitionIds = [...batch.activePartitionIds];
      this.host._activeWallChainId ||= `chain-${Date.now().toString(36)}`;
      this.host._nameSel = '';
      this.host._areaSel = '';
      this.host.requestUpdate();
      return;
    }
    if (this.host._pendingSplit) {
      // nothing was applied yet — drop the cut entirely, the room stays whole
      this.host._pendingSplit = null;
      this.host._splitSel = null;
      return;
    }
    this.host._undoPoint();
  }

public _openDeviceInbox(): void {
    this.host._deviceInboxReturn = null;
    this.host._deviceInbox = this.host._deviceInbox || {
      tab: 'on_plan', search: '', showEntities: false, onlyNew: false, limit: 100,
    };
  }

public _closeMarkerDialog(): void {
    this.host._markerDialog = null;
    if (this.host._deviceInboxReturn) {
      const restored = { ...this.host._deviceInboxReturn };
      this.host._deviceInbox = restored;
      this.host._deviceInboxReturn = null;
      if (restored.anchor) {
        void this.host.updateComplete.then(() => requestAnimationFrame(() => {
          const selector = `.device-inbox-row[data-binding="${CSS.escape(restored.anchor!)}"]`;
          this.host.renderRoot.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'nearest' });
        }));
      }
    }
  }

public _deviceInboxCandidates(showEntities: boolean) {
    return bindingCandidates({
      hass: this.host._planHass,
      devices: this.host._devices,
      markers: this.host._markers,
      showEntities,
      labels: {
        device: this.host._t('marker.sub_device'),
        z2mGroup: this.host._t('marker.sub_z2m_group'),
        group: this.host._t('marker.sub_group'),
        helper: this.host._t('marker.sub_helper'),
        entity: this.host._t('marker.sub_entity'),
      },
    });
  }

public _deviceInboxRows(): DeviceInboxRow[] {
    const dialog = this.host._deviceInbox || this.host._deviceInboxReturn;
    const showEntities = !!dialog?.showEntities;
    const key = [
      this.host._haRegistry.revision, this.host._cfgRev, this.host._cfgEpoch, this.host._regSignature,
      this.host._newSyncKey, showEntities ? 1 : 0, this.host._showAll ? 1 : 0,
      langOf(this.host.hass, this.host._config?.language),
    ].join('|');
    if (this.host._deviceInboxMemo?.key === key) return this.host._deviceInboxMemo.rows;
    const candidates = this._deviceInboxCandidates(showEntities);
    const bindings = new Set<string>(candidates.map((item) => item.value));
    for (const marker of this.host._markers) if (marker.binding && marker.binding !== 'virtual') bindings.add(marker.binding);
    for (const device of this.host._devices) {
      if (device.bindingKind && device.bindingKind !== 'virtual' && device.bindingRef) {
        bindings.add(`${device.bindingKind}:${device.bindingRef}`);
      }
    }
    const statuses = new Map<string, HaBindingStatus>();
    for (const binding of bindings) statuses.set(binding, this.host._bindingStatus(binding));

    const areaMap = this.host._areaToSpace;
    const areaNames: Record<string, string> = {};
    for (const [id, area] of Object.entries<any>(this.host.hass?.areas || {})) {
      areaNames[id] = areaMap[id]?.room?.name || area?.name || id;
    }
    // A room may keep a valid HA area reference even when the current user has
    // only a limited area-registry snapshot.  Its plan-visible name is still
    // authoritative for the catalog and search.
    for (const [id, target] of Object.entries(areaMap)) {
      areaNames[id] = target.room.name || areaNames[id] || id;
    }
    const spaceNames = Object.fromEntries(this.host._model.map((space) => [space.id, space.title]));
    const spaceByArea = Object.fromEntries(
      Object.entries(areaMap).map(([area, value]) => [area, value.space]),
    );
    const integrationByBinding: Record<string, string> = {};
    const devicePlatforms = new Map<string, Set<string>>();
    for (const [entityId, entity] of Object.entries<any>(this.host._fullRegistryHass.entities || {})) {
      const platform = String(entity?.platform || '').trim();
      if (platform) integrationByBinding[`entity:${entityId}`] = platform;
      if (platform && entity?.device_id) {
        const set = devicePlatforms.get(entity.device_id) || new Set<string>();
        set.add(platform);
        devicePlatforms.set(entity.device_id, set);
      }
    }
    for (const [deviceId, platforms] of devicePlatforms) {
      integrationByBinding[`device:${deviceId}`] = [...platforms].sort().join(', ');
    }
    const reasonByBinding: Record<string, DeviceInboxReason> = {};
    for (const [deviceId, device] of Object.entries<any>(this.host._fullRegistryHass.devices || {})) {
      const binding = `device:${deviceId}`;
      const platforms = devicePlatforms.get(deviceId) || new Set<string>();
      const identifierDomain = Array.isArray(device?.identifiers?.[0])
        ? String(device.identifiers[0][0] || '') : '';
      // #44 r1-M2: a device without a single platform-bearing entity still has
      // an integration name — its identifier domain. Without this fallback the
      // reason text would render the raw {integration} placeholder.
      if (identifierDomain && !integrationByBinding[binding]) {
        integrationByBinding[binding] = identifierDomain;
      }
      const excluded = [identifierDomain, ...platforms].some((domain) => this.host._excluded.has(domain));
      if (device?.entry_type === 'service') reasonByBinding[binding] = 'service_entry';
      else if (excluded) reasonByBinding[binding] = 'excluded_integration';
      else if (device?.model === 'Group') reasonByBinding[binding] = 'grouped_light';
      else if (/scene/i.test(device?.model || '')) reasonByBinding[binding] = 'excluded_domain';
      else if (/bridge/i.test(`${device?.model || ''}${device?.name || ''}`)
          || (identifierDomain === 'myheat' && device?.via_device_id)) {
        reasonByBinding[binding] = 'represented_by_parent';
      }
    }
    const rows = buildDeviceInbox({
      devices: this.host._devices,
      markers: this.host._markers,
      candidates,
      statuses,
      newDeviceIds: this.host._newIds,
      showHiddenOnPlan: this.host._showAll,
      areaNames, spaceNames, spaceByArea, integrationByBinding, reasonByBinding,
    });
    this.host._deviceInboxMemo = { key, rows };
    return rows;
  }

public _deviceForInboxRow(row: DeviceInboxRow): DevItem | null {
    const runtime = row.deviceId ? this.host._devices.find((item) => item.id === row.deviceId) : null;
    if (runtime) return runtime;
    const marker = row.markerId ? this.host._markers.find((item) => item.id === row.markerId) : null;
    if (!marker || marker.removed) return null;
    return {
      id: marker.id,
      name: row.name,
      model: row.model,
      area: row.areaId,
      space: row.spaceId || this.host._space,
      hidden: marker.hidden === true || row.status.kind === 'ha_disabled',
      userHidden: marker.hidden === true,
      bindingStatus: row.status,
      icon: row.icon,
      entities: row.status.kind === 'active' ? row.status.enabledEntityIds : [],
      allEntities: row.status.allEntityIds,
      primary: row.status.kind === 'active' ? row.status.enabledEntityIds[0] : undefined,
      marker,
      bindingKind: row.kind,
      bindingRef: row.binding.slice(row.binding.indexOf(':') + 1),
      pdfs: marker.pdfs || [],
    };
  }

public _openInboxMarker(row: DeviceInboxRow, add = false): void {
    const snapshot = this.host._deviceInbox;
    if (!snapshot) return;
    this.host._deviceInboxReturn = { ...snapshot, anchor: row.key };
    this.host._deviceInbox = null;
    if (!add) {
      const device = this._deviceForInboxRow(row);
      if (device) this._openMarkerDialog(device);
      else this._closeMarkerDialog();
      return;
    }
    this._openMarkerDialog();
    if (!this.host._markerDialog) {
      this._closeMarkerDialog();
      return;
    }
    this.host._markerDialog = {
      ...this.host._markerDialog,
      bindingMode: 'ha', binding: row.binding, bindingOpen: false,
      showEntities: row.kind === 'entity', name: '',
    };
  }

public async _setInboxHidden(row: DeviceInboxRow, hidden: boolean): Promise<void> {
    const dialog = this.host._deviceInbox;
    const cfg = this.host._serverCfg;
    if (!dialog || !cfg || dialog.busy || row.status.kind !== 'active') return;
    const previous = cfg.markers || [];
    const live = previous.find((marker) => !marker.removed && marker.binding === row.binding);
    if (!hidden && !live) return;
    const id = live?.id || markerIdForBinding(
      row.binding, row.markerId, () => `m_${Date.now().toString(36)}`,
    );
    const next: Marker = live
      ? { ...live, hidden }
      : { id, binding: row.binding, hidden: true };
    cfg.markers = [
      ...previous.filter((marker) => marker.id !== id
        && (marker.binding !== row.binding || marker.removed === true)),
      next,
    ];
    this.host._deviceInbox = { ...dialog, busy: row.key, anchor: row.key };
    try {
      await this._saveConfigNow();
      this.host._regSignature = '';
      this.host._deviceInboxMemo = null;
      this.host._maybeRebuildDevices();
      if (this.host._deviceInbox) this.host._deviceInbox = { ...this.host._deviceInbox, busy: undefined };
      this.host._showToast(this.host._t('device_inbox.saved'));
    } catch (error: any) {
      if (this.host._serverCfg === cfg) cfg.markers = previous;
      if (this.host._deviceInbox) this.host._deviceInbox = { ...this.host._deviceInbox, busy: undefined };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(error) }));
    }
  }

public _findInboxDevice(row: DeviceInboxRow): void {
    if (!row.canFind) return;
    const device = this._deviceForInboxRow(row);
    if (!device) return;
    this.host._deviceInbox = null;
    if (device.space && device.space !== this.host._space) {
      if (!this.host._commitSpace(device.space)) return;
      this.host._restoreZoom();
    }
    const focus = () => {
      const current = this.host._devices.find((item) => item.id === device.id) || device;
      const point = this.host._pos(current);
      this.host._applyView(this.host._zoom, point.x, point.y);
      this.host._selId = current.id;
      this.host.requestUpdate();
      window.setTimeout(() => {
        if (this.host._selId === current.id) {
          this.host._selId = null;
          this.host.requestUpdate();
        }
      }, 1500);
    };
    requestAnimationFrame(() => requestAnimationFrame(focus));
  }

public _deviceInboxTabKey = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const dialog = this.host._deviceInbox;
    if (!dialog) return;
    const tabs: DeviceInboxCategory[] = ['on_plan', 'available', 'hidden', 'readd'];
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const index = (tabs.indexOf(dialog.tab) + offset + tabs.length) % tabs.length;
    this.host._deviceInbox = { ...dialog, tab: tabs[index], limit: 100, onlyNew: false };
    event.preventDefault();
  };

public _openMarkerDialog(d?: DevItem): void {
    // A global-camera snapshot belongs to one explicit expansion only; never
    // carry it across device-dialog sessions.
    this.host._vacAllCamerasFor = null;
    this.host._vacAllCameraCache = null;
    if (d) this.host._ackNewDevice(d.id);
    if (!this.host._norm) {
      this.host._showToast(this.host._t('toast.marker_needs_server'));
      return;
    }
    if (d) {
      const marker = d.marker;
      const hasIsLight = Object.prototype.hasOwnProperty.call(marker || {}, 'is_light');
      const hasLightEntity = Object.prototype.hasOwnProperty.call(marker || {}, 'light_entity');
      const hasGlowColor = Object.prototype.hasOwnProperty.call(marker || {}, 'glow_color');
      const hasValueBadge = Object.prototype.hasOwnProperty.call(marker || {}, 'value_badge');
      const hasValueSource = Object.prototype.hasOwnProperty.call(marker || {}, 'value_source');
      const hasTapAction = Object.prototype.hasOwnProperty.call(marker || {}, 'tap_action');
      const hasToggleEntity = Object.prototype.hasOwnProperty.call(marker || {}, 'toggle_entity');
      const glowOverride = normalizeGlowColorOverride(marker?.glow_color);
      const currentBadge = this.host._devicePresentation(d, true).valueBadge;
      const badgeCandidates = valueBadgeCandidates(this.host._planHass, d, this.host._devices);
      const recommendedBadge = recommendedValueBadgeSource(this.host._planHass, d, badgeCandidates);
      this.host._markerDialog = {
        devId: d.id,
        name: d.name,
        binding: d.bindingKind === 'virtual' ? 'virtual' : d.bindingKind + ':' + d.bindingRef,
        bindingMode: d.bindingKind === 'virtual' ? 'virtual' : 'ha',
        bindingOpen: false,
        // a marker bound to an ENTITY of a device only shows up with the box on
        showEntities: d.bindingKind === 'entity' && !!this.host._fullRegistryHass.entities[d.bindingRef || '']?.device_id,
        bindingFilter: '',
        icon: d.marker?.icon || '',
        autoIcon: d.icon || '',
        display: normalizeDeviceDisplay(d.marker?.display),
        rippleColor: safeStoredColor(d.marker?.ripple_color, ''),
        rippleSize: Number(d.marker?.ripple_size) > 0 ? Number(d.marker!.ripple_size) : 1.5,
        size: Number(d.marker?.size) > 0 ? Number(d.marker!.size) : 1,
        angle: Number(d.marker?.angle) || 0,
        tapAction: projectedTapAction(d.marker?.tap_action, d.primary?.split('.')[0]),
        tapActionTouched: false,
        originalHasTapAction: hasTapAction,
        originalTapAction: d.marker?.tap_action,
        tapHintAnnouncement: '',
        toggleEntity: marker?.toggle_entity || '',
        toggleEntityTouched: false,
        originalHasToggleEntity: hasToggleEntity,
        originalToggleEntity: marker?.toggle_entity,
        tapTarget: d.marker?.tap_target || '',
        tapConfirm: d.marker?.tap_confirm === true,
        runFilter: '',
        // Keep unknown, temporarily inactive and duplicate external targets
        // byte-for-byte across Open → Save. Runtime uses the filtered
        // effective projection; a legacy self-reference is not a light source.
        controls: persistedExternalControls(d.marker?.binding, d.marker?.controls, d.entities),
        controlsFilter: '',
        lightRole: marker?.is_light === true ? 'always' : marker?.is_light === false ? 'never' : 'auto',
        lightRoleTouched: false,
        originalHasIsLight: hasIsLight,
        originalIsLight: marker?.is_light,
        lightEntity: marker?.light_entity || '',
        lightEntityTouched: false,
        originalHasLightEntity: hasLightEntity,
        originalLightEntity: marker?.light_entity,
        glowMode: glowOverride?.bri != null ? 'fixed' : glowOverride ? 'color' : 'auto',
        glowColor: glowOverride?.c || this.host._fillColors.glow_light.c,
        glowBrightness: Math.max(1, Math.round((glowOverride?.bri ?? 1) * 100)),
        glowColorDrafted: !!glowOverride,
        glowBrightnessDrafted: glowOverride?.bri != null,
        glowTouched: false,
        originalHasGlowColor: hasGlowColor && (!!glowOverride || marker?.glow_color === null),
        originalGlowColor: glowOverride || (marker?.glow_color === null ? null : undefined),
        valueBadgeEnabled: hasValueBadge ? marker?.value_badge?.enabled === true : !!currentBadge,
        valueBadgeSource: marker?.value_badge?.source || currentBadge?.source || recommendedBadge,
        valueBadgePosition: marker?.value_badge?.position || currentBadge?.position || 'right',
        valueBadgeTouched: false,
        originalHasValueBadge: hasValueBadge,
        originalValueBadge: marker?.value_badge,
        valueSource: marker?.value_source || null,
        valueSourceTouched: false,
        originalHasValueSource: hasValueSource,
        originalValueSource: marker?.value_source,
        useClimateTemp: d.marker?.use_climate_temp === true,
        glowRadius: Number(d.marker?.glow_radius_cm) > 0
          ? String(this.host._imperial
              ? Math.round((Number(d.marker!.glow_radius_cm) / 30.48) * 10) / 10
              : Math.round(Number(d.marker!.glow_radius_cm)) / 100)
          : '',
        model: d.model || '',
        link: d.link || '',
        description: d.description || '',
        pdfs: [...(d.pdfs || [])],
        room: d.marker?.room_id
          ? d.space + '#@' + d.marker.room_id
          : d.space && d.area ? d.space + '#' + d.area : '',
        roomTouched: false,
        hideFromPlan: d.marker?.hidden === true,
        busy: false,
      };
    } else {
      this.host._markerDialog = {
        name: '', binding: 'virtual', bindingMode: 'virtual', bindingOpen: false,
        showEntities: false, bindingFilter: '', icon: '', autoIcon: '',
        display: 'badge', rippleColor: '', rippleSize: 1.5, size: 1, angle: 0,
        tapAction: 'info', tapActionTouched: false,
        originalHasTapAction: false, originalTapAction: undefined, tapHintAnnouncement: '',
        toggleEntity: '', toggleEntityTouched: false,
        originalHasToggleEntity: false, originalToggleEntity: undefined,
        tapTarget: '', tapConfirm: false, runFilter: '',
        controls: [], controlsFilter: '',
        lightRole: 'auto', lightRoleTouched: false,
        originalHasIsLight: false, originalIsLight: undefined,
        lightEntity: '', lightEntityTouched: false,
        originalHasLightEntity: false, originalLightEntity: undefined,
        glowMode: 'auto', glowColor: this.host._fillColors.glow_light.c, glowBrightness: 100,
        glowColorDrafted: false, glowBrightnessDrafted: false, glowTouched: false,
        originalHasGlowColor: false, originalGlowColor: undefined,
        valueBadgeEnabled: false, valueBadgeSource: null, valueBadgePosition: 'right',
        valueBadgeTouched: false, originalHasValueBadge: false, originalValueBadge: undefined,
        valueSource: null, valueSourceTouched: false,
        originalHasValueSource: false, originalValueSource: undefined,
        useClimateTemp: false, glowRadius: '', model: '',
        link: '', description: '', pdfs: [], room: '', roomTouched: false,
        hideFromPlan: false, busy: false,
        uploadId: 'up_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      };
    }
  }

public _runCandidates(): { value: string; label: string; sub: string }[] {
    const out: { value: string; label: string; sub: string }[] = [];
    for (const dom of RUN_TARGET_DOMAINS) {
      for (const [eid, st] of Object.entries<any>(this.host.hass.states)) {
        if (!eid.startsWith(dom + '.')) continue;
        if (!this.host._planEntityAvailable(eid)) continue;
        out.push({
          value: eid,
          label: st?.attributes?.friendly_name || eid,
          sub: this.host._t(('run.' + dom) as any),
        });
      }
    }
    return out.sort((a, b) => a.sub.localeCompare(b.sub) || a.label.localeCompare(b.label));
  }

public _bindingCandidates(): { value: string; label: string; sub: string }[] {
    const list = bindingCandidates({
      hass: this.host._planHass,
      devices: this.host._devices,
      markers: this.host._markers,
      showEntities: !!this.host._markerDialog?.showEntities,
      currentBinding: this.host._markerDialog?.binding,
      currentDeviceId: this.host._markerDialog?.devId,
      labels: {
        device: this.host._t('marker.sub_device'),
        z2mGroup: this.host._t('marker.sub_z2m_group'),
        group: this.host._t('marker.sub_group'),
        helper: this.host._t('marker.sub_helper'),
        entity: this.host._t('marker.sub_entity'),
      },
    });
    const f = (this.host._markerDialog?.bindingFilter || '').toLowerCase().trim();
    const filtered = f
      ? list.filter((o) => (o.label + ' ' + o.sub + ' ' + o.value).toLowerCase().includes(f))
      : list;
    filtered.sort((a, b) => a.label.localeCompare(b.label));
    return filtered.slice(0, 200);
  }

public _keepClosedAsPartitions = (): void => {
    if (this.host._wallFaceBatch) {
      this._decideWallFace(false);
      return;
    }
    if (!this.host._contourClosed || this.host._pendingSplit || !this.host._curSpaceCfg) return;
    // Every accepted edge is already an ordinary partition. Rejecting all
    // detected faces only ends the session; it must not duplicate the chain.
    this.host._roomDialog = false;
    this.host._path = [];
    this.host._activeWallChainId = null;
    this.host._activeWallChainPartitionIds = [];
    this.host._wallChainSegmentCms = [];
    this.host._wallChainRedo = [];
    this.host._closingWallCm = null;
    this.host.requestUpdate();
  };

public _backupErrorText(e: any): string {
    const code = e?.code ?? e?.error;
    if (typeof code === 'string') {
      const key = `backup.error.${code}`;
      const translated = this.host._t(key as I18nKey);
      if (translated !== key) return translated;
    }
    return this.host._errText(e);
  }

public async _pickMarkerFiles(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = input.files ? [...input.files] : [];
    input.value = '';
    if (!files.length || !this.host._markerDialog) return;
    const mid = this.host._markerDialog.uploadId || this.host._markerDialog.devId || 'new';
    const uploaded: PdfRef[] = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('marker_id', mid);
        fd.append('file', file, file.name);
        // fetchWithAuth refreshes a stale access_token itself; the fallback is the raw token
        const resp: Response = this.host.hass?.fetchWithAuth
          ? await this.host.hass.fetchWithAuth('/api/houseplan/upload', { method: 'POST', body: fd })
          : await fetch('/api/houseplan/upload', {
              method: 'POST',
              body: fd,
              headers: this.host.hass?.auth?.data?.access_token
                ? { authorization: `Bearer ${this.host.hass.auth.data.access_token}` }
                : {},
            });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.error) {
          const map: Record<string, string> = {
            too_large: this.host._t('err.too_large', { mb: json.max_mb || 50 }),
            bad_ext: this.host._t('err.bad_ext'),
            unauthorized: this.host._t('err.unauthorized'),
          };
          throw new Error(map[json.error] || json.error || 'HTTP ' + resp.status);
        }
        uploaded.push({ name: json.name || file.name, url: json.url });
      } catch (e: any) {
        this.host._showToast(this.host._t('toast.file_failed', { name: file.name, err: this.host._errText(e) }));
      }
    }
    // the dialog might have closed during the upload — add only if it is still open
    if (uploaded.length && this.host._markerDialog) {
      this.host._markerDialog = { ...this.host._markerDialog, pdfs: [...this.host._markerDialog.pdfs, ...uploaded] };
      this.host._showToast(this.host._t('toast.files_attached', { n: uploaded.length }));
    }
  }

public _removeMarkerPdf(url: string): void {
    if (!this.host._markerDialog) return;
    this.host._markerDialog = {
      ...this.host._markerDialog,
      pdfs: this.host._markerDialog.pdfs.filter((p) => p.url !== url),
    };
  }

public _markerLightFields(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>): Partial<Marker> {
    const fields: Partial<Marker> = {};
    if (!d.lightRoleTouched) {
      if (d.originalHasIsLight) fields.is_light = d.originalIsLight ?? null;
    } else if (d.lightRole === 'always') fields.is_light = true;
    else if (d.lightRole === 'never') fields.is_light = false;

    if (!d.lightEntityTouched) {
      if (d.originalHasLightEntity) fields.light_entity = d.originalLightEntity ?? null;
    } else if (d.lightEntity) {
      fields.light_entity = d.lightEntity;
    }

    if (!d.glowTouched) {
      if (d.originalHasGlowColor) fields.glow_color = d.originalGlowColor ?? null;
    } else if (d.glowMode !== 'auto') {
      const glow: NonNullable<Marker['glow_color']> = {
        c: safeStoredColor(d.glowColor, this.host._fillColors.glow_light.c),
      };
      if (d.glowMode === 'fixed') {
        glow.bri = Math.max(0.01, Math.min(1, Math.round(d.glowBrightness) / 100));
      }
      fields.glow_color = glow;
    }
    return fields;
  }

public _markerTapActionFields(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
  ): Pick<Marker, 'tap_action'> | Record<string, never> {
    if (!d.tapActionTouched) {
      return d.originalHasTapAction ? { tap_action: d.originalTapAction ?? null } : {};
    }
    return { tap_action: d.tapAction || null };
  }

public _markerToggleEntityFields(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
  ): Pick<Marker, 'toggle_entity'> | Record<string, never> {
    return toggleEntityWriteFields({
      touched: d.toggleEntityTouched,
      originalHas: d.originalHasToggleEntity,
      original: d.originalToggleEntity,
      value: d.toggleEntity,
    });
  }

public async _saveMarker(): Promise<void> {
    const dlg = this.host._markerDialog;
    if (!dlg || dlg.busy) return;
    const effectiveTapAction = this._effectiveMarkerTapAction(dlg);
    if (dlg.bindingMode === 'ha' && (!dlg.binding || dlg.binding === 'virtual')) return;
    if (dlg.binding === 'virtual' && !dlg.name.trim()) {
      this.host._showToast(this.host._t('toast.virtual_name_required'));
      return;
    }
    if (effectiveTapAction === 'run' && !dlg.tapTarget) {
      this.host._showToast(this.host._t('toast.run_target_required'));
      return;
    }
    if (dlg.valueBadgeTouched && dlg.valueBadgeEnabled && !dlg.valueBadgeSource) {
      this.host._showToast(this.host._t('toast.value_badge_source_required'));
      return;
    }
    if (dlg.bindingMode === 'ha') {
      const status = this.host._bindingStatus(dlg.binding);
      const previous = dlg.devId
        ? this.host._markers.find((marker) => marker.id === dlg.devId) : null;
      const replacingWithInactive = !previous || previous.binding !== dlg.binding;
      if (status.kind !== 'active' && replacingWithInactive) {
        this.host._showToast(this.host._t(status.kind === 'ha_disabled'
          ? 'toast.ha_disabled_add' : 'toast.ha_binding_unverified'));
        return;
      }
      // Saving metadata for an already-disabled binding is allowed, but a
      // blocked Show attempt may never erase an older explicit user hidden.
      if (status.kind === 'ha_disabled' && previous?.hidden === true && !dlg.hideFromPlan) {
        this.host._markerDialog = { ...dlg, hideFromPlan: true };
        this.host._showToast(this.host._t(status.reason === 'entity'
          ? 'toast.ha_disabled_show_entity' : 'toast.ha_disabled_show_device'));
        return;
      }
    }
    const cfg = this.host._serverCfg;
    if (!cfg) return;
    const baseRevision = this.host._cfgRev;
    const baseContent = contentFingerprint(cfg);
    let candidate = JSON.parse(JSON.stringify(cfg)) as ServerConfig;
    const markers = candidate.markers || [];
    const id = markerIdForBinding(dlg.binding, dlg.devId, () => 'v_' + Date.now().toString(36));
    const oldId = dlg.devId;
    const prevDev = oldId ? this.host._devices.find((x) => x.id === oldId) : null;
    const previousMarker = oldId ? markers.find((candidate) => candidate.id === oldId) : null;
    const previousExplicit = !!previousMarker && (
      (typeof previousMarker.area === 'string' && previousMarker.area.length > 0)
      || (previousMarker.area === null && !!previousMarker.space && !!previousMarker.room_id)
    );
    // Opening a registry-following marker shows its effective HA room in the
    // select, but that display value is not an explicit override. Preserve
    // absence until the user actually changes the selector; this also prevents
    // a dialog opened during an HA Area transition from saving its stale draft.
    const writePlacement = dlg.binding === 'virtual' || dlg.roomTouched || previousExplicit;
    const roomRef = dlg.binding === 'virtual' || dlg.roomTouched ? parseRoomRef(dlg.room) : null;
    let space: string | null = previousExplicit && !dlg.roomTouched
      ? previousMarker?.space || null : roomRef?.space || null;
    const area: string | null = previousExplicit && !dlg.roomTouched
      ? previousMarker?.area || null : roomRef?.area || null;
    const roomId: string | null = previousExplicit && !dlg.roomTouched
      ? previousMarker?.room_id || null : roomRef?.roomId || null;
    const explicitSpaceId = space || prevDev?.space || null;
    const targetSpaceModel = explicitSpaceId
      ? this.host._spaceModelById(explicitSpaceId)
      : this.host._spaceModel();
    if (!targetSpaceModel) return;
    const targetSpaceId = targetSpaceModel.id;
    if (dlg.binding === 'virtual' && !space) space = targetSpaceId;
    this.host._markerDialog = { ...dlg, busy: true };
    let attempt: OptimisticAttempt<ServerConfig> | null = null;
    let configAccepted = false;
    try {
      const replacedRemovedIds = dlg.binding === 'virtual'
        ? []
        : markers
          .filter((m) => m.removed && m.binding === dlg.binding)
          .map((m) => m.id);
      const replacingRemoved = replacedRemovedIds.length > 0;
      const controls = persistedExternalControls(
        dlg.binding, dlg.controls, this.host._bindingEntities(dlg.binding),
      );
      // the vacuum block is edited live outside the dialog transaction —
      // the rebuild below must carry it over, not erase it
      const prevVac = markers.find((m0: Marker) => m0.id === id || m0.id === oldId)?.vacuum || null;
      const marker: Marker = {
        id,
        vacuum: prevVac,
        binding: dlg.binding,
        name: dlg.name.trim() || null,
        icon: dlg.icon || null,
        display: dlg.display !== 'badge' ? dlg.display : null,
        ripple_color: dlg.display === 'icon_ripple' && dlg.rippleColor ? dlg.rippleColor : null,
        ripple_size: dlg.display === 'icon_ripple' && dlg.rippleSize !== 1.5 ? dlg.rippleSize : null,
        size: dlg.size !== 1 ? dlg.size : null,
        angle: dlg.angle ? dlg.angle : null,
        ...this._markerTapActionFields(dlg),
        ...this._markerToggleEntityFields(dlg),
        tap_target: effectiveTapAction === 'run' ? dlg.tapTarget || null : null,
        tap_confirm: dlg.tapConfirm ? true : null,
        controls: controls.length ? controls : null,
        // pdfs may be rewritten below when rebinding changes the marker id
        ...this._markerLightFields(dlg),
        ...this._markerValueBadgeFields(dlg),
        ...this._markerValueSourceFields(dlg),
        use_climate_temp: dlg.useClimateTemp ? true : null,
        glow_radius_cm: (() => {
          const v = strictNumber(dlg.glowRadius);
          if (v == null || v <= 0) return null;
          return Math.round(this.host._imperial ? v * 30.48 : v * 100);
        })(),
        model: dlg.model.trim() || null,
        link: dlg.link.trim() || null,
        description: dlg.description.trim() || null,
        pdfs: dlg.pdfs,
        // Explicit false, not absence: a marker of any kind is what tells the
        // seeder "the user decided" — unticking must not invite a re-hide
        // (docs/FILTERING.md).
        hidden: dlg.hideFromPlan ? true : false,
      };
      // save the room choice (always for virtual ones; for bound ones — if chosen)
      if (writePlacement) {
        marker.space = space;
        marker.area = area;
        marker.room_id = roomId;
      }
      // the room changed → move the icon to its center
      const prevRoomId = prevDev?.marker?.room_id ?? null;
      const roomChanged = dlg.roomTouched && prevDev != null
        && (prevDev.space !== space || prevDev.area !== area || prevRoomId !== roomId);
      // Rebinding changes the marker id, so the uploaded files must follow.
      // Order matters (review CR-2): COPY first, save the config, and only then
      // delete the old folder. If the save is rejected, the old urls in the
      // stored config still resolve — the files never left. A failed copy
      // leaves the urls untouched and tells the user (review CR-3).
      let cleanupOldFiles = false;
      // a new icon uploaded into its own staging folder; an edited one into its
      // own id. Either way the files move to the final id here.
      const fileSrc = dlg.uploadId || oldId;
      if (fileSrc && fileSrc !== id && marker.pdfs?.length) {
        try {
          const res: any = await this.host.hass.callWS({
            type: 'houseplan/files/migrate', from_id: fileSrc, to_id: id,
          });
          const mapping = res?.mapping || {};
          marker.pdfs = migratePdfUrls(marker.pdfs, fileSrc, id, mapping);
          cleanupOldFiles = Object.keys(mapping).length > 0;
        } catch (e: any) {
          this.host._showToast(this.host._t('toast.files_migrate_failed', { err: this.host._errText(e) }));
        }
      }
      // Rebinding changes source identity. Rewrite every marker:* edge in the
      // same config transaction before replacing the marker itself.
      candidate.markers = markers;
      if (oldId && oldId !== id)
        candidate.markers = rewriteMarkerControlReferences(candidate.markers, oldId, id);
      if (oldId && oldId !== id && marker.value_badge?.source?.kind === 'derived_marker_state'
          && marker.value_badge.source.ref === `marker:${oldId}`) {
        marker.value_badge.source = { kind: 'derived_marker_state', ref: `marker:${id}` };
      }
      if (oldId && oldId !== id && marker.value_source?.kind === 'derived_marker_state'
          && marker.value_source.ref === `marker:${oldId}`) {
        marker.value_source = { kind: 'derived_marker_state', ref: `marker:${id}` };
      }
      // remove the previous marker (by the old id and by the new id)
      candidate.markers = candidate.markers.filter(
        (m) => m.id !== id && m.id !== oldId
          && (marker.binding === 'virtual' || m.binding !== marker.binding),
      );
      candidate.markers.push(marker);
      const obsoleteAreaSnapshotIds = new Set(replacedRemovedIds);
      if (oldId && oldId !== id) obsoleteAreaSnapshotIds.add(oldId);
      obsoleteAreaSnapshotIds.delete(id);
      if (obsoleteAreaSnapshotIds.size && candidate.settings?.marker_area_snapshot) {
        candidate.settings = {
          ...candidate.settings,
          marker_area_snapshot: removeMarkerAreaSnapshots(
            candidate.settings.marker_area_snapshot, obsoleteAreaSnapshotIds,
          ),
        };
      }
      // Position rule (owner's decision, v1.33.4): editing an existing icon —
      // rebinding it to another HA device/entity or to another room — must NOT
      // move it. Its current position (saved or the ephemeral auto one) is
      // migrated to the new marker id. Only two cases still center the icon:
      // a truly NEW icon, and a move to a room in a DIFFERENT space (keeping
      // the old coordinates there would be meaningless).
      // Write POINT-WISE (layout/update), not the whole layout — a full layout/set
      // overwrites positions changed in other windows (the v1.4.4 incident).
      let newPos: { s: string; x: number; y: number } | null = null;
      const prevRec = oldId ? this.host._layout[oldId] : null;
      const prevPos = prevRec
        ? { s: prevRec.s || prevDev?.space || this.host._space, x: prevRec.x, y: prevRec.y }
        : oldId && prevDev && this.host._defPos[oldId]
          ? this.host._normPos(prevDev.space, this.host._defPos[oldId].x, this.host._defPos[oldId].y)
          : null;
      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId) {
        // stays in place; pin it under the (possibly new) id
        if (id !== oldId || !this.host._layout[id] || roomChanged) {
          newPos = { s: prevPos.s, x: prevPos.x, y: prevPos.y };
        }
      } else if (replacingRemoved || !this.host._layout[id] || roomChanged) {
        let cx = targetSpaceModel.vb[0] + targetSpaceModel.vb[2] / 2;
        let cy = targetSpaceModel.vb[1] + targetSpaceModel.vb[3] / 2;
        const room = roomId
          ? targetSpaceModel.rooms.find((r) => r.id === roomId)
          : area
            ? targetSpaceModel.rooms.find((r) => r.area === area)
            : undefined;
        if (room) [cx, cy] = this.host._roomCenter(room);
        newPos = this.host._normPos(targetSpaceId, cx, cy);
      }
      // File copy is async: never install a candidate built from a replaced root.
      if (this.host._serverCfg !== cfg || this.host._cfgRev !== baseRevision || contentFingerprint(cfg) !== baseContent) {
        if (this.host._markerDialog) this.host._markerDialog = { ...this.host._markerDialog, busy: false };
        this.host._showToast(this.host._t('toast.conflict'));
        return;
      }
      candidate = this._prepareConfigCandidate(candidate);
      attempt = optimisticAttempt(cfg, candidate, this.host._cfgContentFingerprint, this.host._cfgRev, contentFingerprint);
      this.host._serverCfg = candidate;
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host.requestUpdate();
      if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.cancel();
      await this._saveConfigNow(attempt);
      configAccepted = true;
      if (newPos) {
        const pos = canonicalizePosition(newPos);
        this.host._layout = { ...this.host._layout, [id]: pos };
        this.host._noteLayoutRev(await this.host.hass.callWS({
          type: 'houseplan/layout/update', device_id: id, pos,
        }));
      }
      const obsoleteIds = new Set(replacedRemovedIds);
      if (oldId && oldId !== id) obsoleteIds.add(oldId);
      obsoleteIds.delete(id);
      for (const obsoleteId of obsoleteIds) {
        // Rebinding or replacing a legacy tombstone changed the icon id.
        delete this.host._layout[obsoleteId];
        await this.host.hass.callWS({ type: 'houseplan/layout/delete', device_id: obsoleteId })
          .then((r: any) => this.host._noteLayoutRev(r)).catch(() => undefined);
      }
      // the config is committed — now it is safe to drop the old folder
      if (cleanupOldFiles && fileSrc) {
        await this.host.hass
          .callWS({ type: 'houseplan/files/cleanup', marker_id: fileSrc })
          .catch(() => undefined); // leftovers are harmless; broken links are not
      }
      this._closeMarkerDialog();
      this.host._cancelDeviceDrag();
      this.host._devicePositionHistory.clear();
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._showToast(this.host._t('toast.marker_saved'));
    } catch (e: any) {
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (!configAccepted && attempt) {
        rollbackOptimistic(this.host, attempt, contentFingerprint);
        this.host._regSignature = '';
        this.host._maybeRebuildDevices();
        this.host.requestUpdate();
      }
      if (this.host._markerDialog) this.host._markerDialog = { ...this.host._markerDialog, busy: false };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    }
  }

public async _deleteMarker(): Promise<void> {
    const dlg = this.host._markerDialog;
    if (!dlg || dlg.busy || !dlg.devId) return;
    const d = dlg.devId ? this.host._devices.find((x) => x.id === dlg.devId) : null;
    const persisted = this.host._markers.find((marker) => marker.id === dlg.devId);
    if (!d && !persisted) return;
    const expectedBinding = d
      ? d.bindingKind === 'virtual' ? 'virtual'
        : d.bindingKind && d.bindingRef ? `${d.bindingKind}:${d.bindingRef}` : ''
      : persisted!.binding;
    if (!expectedBinding) return;
    const label = dlg.name || this.host._t('device.fallback');
    const targetId = dlg.devId;
    const accepted = await this.host._confirmDanger({
      key: 'remove-marker',
      kind: 'destructive',
      title: this.host._t('confirm.remove_marker_title'),
      message: this.host._t('confirm.remove_marker_body'),
      objectName: label,
      confirmLabel: this.host._t('btn.delete'),
      cancelLabel: this.host._t('btn.cancel'),
    });
    const currentDialog = this.host._markerDialog;
    if (!accepted || !currentDialog || currentDialog.busy || currentDialog.devId !== targetId) return;
    const currentDevice = this.host._devices.find((item) => item.id === targetId);
    const currentPersisted = this.host._markers.find((marker) => marker.id === targetId);
    if (!currentDevice && !currentPersisted) return;
    const cfg = this.host._serverCfg;
    if (!cfg) return;
    cfg.markers = cfg.markers || [];
    const previousMarkers = cfg.markers;
    const binding = currentDevice
      ? currentDevice.bindingKind === 'virtual' ? 'virtual'
        : currentDevice.bindingKind && currentDevice.bindingRef
          ? `${currentDevice.bindingKind}:${currentDevice.bindingRef}` : ''
      : currentPersisted!.binding;
    if (!binding || binding !== expectedBinding) return;
    const deletion = deletePlanMarkerRecords(
      cfg.markers, targetId, binding, binding === 'virtual',
    );
      cfg.markers = removeMarkerControlReferences(deletion.markers, deletion.cleanupIds);
      const cleanupIds = deletion.cleanupIds;
      if (cleanupIds.size && cfg.settings?.marker_area_snapshot) {
        cfg.settings = {
          ...cfg.settings,
          marker_area_snapshot: removeMarkerAreaSnapshots(
            cfg.settings.marker_area_snapshot, cleanupIds,
          ),
        };
      }
    this.host._markerDialog = { ...currentDialog, busy: true };
    try {
      await this._saveConfigNow();
      // Housekeeping follows the durable config write. Every call is
      // idempotent and best-effort: the device is already deleted even if an
      // old integration cannot yet serve one of the cleanup commands.
      for (const id of cleanupIds) {
        delete this.host._layout[id];
        delete this.host._defPos[id];
        this.host._dirtyPos.delete(id);
        this.host._sentPos.delete(id);
        const activity = this.host._activityRt.get(id);
        if (activity) clearTimeout(activity.timer);
        this.host._activityRt.delete(id);
        this.host._vacRt.delete(id);
        delete this.host._vacSrvTrails[id];
        await this.host.hass.callWS({ type: 'houseplan/layout/delete', device_id: id })
          .then((r: any) => this.host._noteLayoutRev(r)).catch(() => undefined);
        await this.host.hass.callWS({ type: 'houseplan/files/cleanup', marker_id: id })
          .catch(() => undefined);
        await this.host.hass.callWS({ type: 'houseplan/trail/delete', marker_id: id })
          .catch(() => undefined);
      }
      if (this.host._deviceInboxReturn) {
        this.host._deviceInboxReturn = { ...this.host._deviceInboxReturn, tab: 'readd', anchor: binding };
      }
      this._closeMarkerDialog();
      this.host._cancelDeviceDrag();
      this.host._devicePositionHistory.clear();
      if (this.host._infoCard?.id === targetId) this.host._closeInfoCard();
      if (this.host._selId === targetId) this.host._selId = null;
      if (this.host._drag?.id === targetId) this.host._drag = null;
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._showToast(this.host._t('toast.marker_removed'));
    } catch (e: any) {
      if (this.host._serverCfg === cfg) cfg.markers = previousMarkers;
      if (this.host._markerDialog) this.host._markerDialog = { ...this.host._markerDialog, busy: false };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    }
  }

public _openSpaceDialog(mode: 'edit' | 'create', spaceId?: string): void {
    if (!this.host._serverStorage || !this.host._serverCfg) {
      this.host._showToast(this.host._t('toast.integration_missing'));
      return;
    }
    if (mode === 'edit') {
      const sp = this.host._serverCfg!.spaces.find((x: any) => x.id === spaceId);
      if (!sp) return;
      const disp = spaceDisplayOf(sp);
      const storedCustom = sp.settings?.custom_fill && typeof sp.settings.custom_fill === 'object'
        ? customFillOf(sp.settings.custom_fill) : null;
      // Space-level None is no longer a separate UI choice. Project it to the
      // same custom colour at zero opacity, so merely opening/saving settings
      // cannot change either the visible floor or the Glow darkness.
      const dialogCustom = disp.fill === 'none'
        ? { ...(storedCustom || DEFAULT_CUSTOM_FILL), a: 0 }
        : storedCustom;
      this.host._spaceDialog = {
        mode, spaceId, title: sp.title, planUrl: sp.plan_url || null, planFile: null,
        source: sp.plan_url ? 'file' : 'draw',
        showBorders: disp.showBorders, showNames: disp.showNames,
        zeroWallStyle: zeroWallStyleOf(sp),
        displayTouched: true,
        hideDecor: disp.hideDecor, hideOpenings: disp.hideOpenings,
        roomColor: disp.color, roomOpacity: disp.opacity,
        // `none` is a legacy space token. The current editor represents its
        // exact appearance as a transparent user colour.
        fillMode: disp.fill === 'none' ? 'custom' : disp.fill,
        customFill: dialogCustom,
        glowEnabled: disp.glow,
        bgColor: disp.bgColor,
        bgMode: sp.settings?.bg_mode === 'static' || sp.settings?.bg_mode === 'daynight' ? sp.settings.bg_mode : null,
        northDeg: northDegOf({}, sp.settings),
        sunRays: typeof sp.settings?.sun_rays === 'boolean' ? sp.settings.sun_rays : null,
        tempMin: disp.tempMin, tempMax: disp.tempMax,
        showLqi: disp.showLqi ?? this.host._config?.show_signal ?? true,
        cardFontScale: disp.cardFontScale,
        labelTemp: disp.labelTemp, labelHum: disp.labelHum,
        labelLqi: disp.labelLqi, labelLight: disp.labelLight,
        cellCm: Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5,
        cellCmInput: gridCellFieldValue(
          Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5, this.host._imperial,
        ),
        cellCmTouched: false,
        busy: false,
      };
    } else {
      this.host._spaceDialog = {
        mode, title: '', planUrl: null, planFile: null,
        ...initialSpaceDisplayDraft(),
        hideDecor: false, hideOpenings: false, zeroWallStyle: 'dashed',
        roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'custom',
        // `custom` replaces the old `none` choice in the editor, but creating
        // a space must preserve the old no-floor visual by default. The user
        // can make this colour visible explicitly with the opacity control.
        customFill: { ...DEFAULT_CUSTOM_FILL, a: 0 },
        glowEnabled: true,
        bgColor: null,
        bgMode: 'daynight', northDeg: null, sunRays: null,
        tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
        showLqi: this.host._config?.show_signal ?? true,
        cardFontScale: 1,
        labelTemp: false, labelHum: false, labelLqi: false, labelLight: false,
        cellCm: newSpaceCellCm(this.host._imperial),
        cellCmInput: gridCellFieldValue(newSpaceCellCm(this.host._imperial), this.host._imperial),
        cellCmTouched: false,
        busy: false,
      };
    }
  }

public async _pickPlanFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.host._spaceDialog) return;
    // #39: re-selecting the same file after a guard decision must fire again.
    input.value = '';
    this._decorAssetGuardReplace = null;
    const classified = await classifyPlanFile(file);
    if (classified.kind === 'reject') {
      this.host._showToast(this.host._t('toast.plan_formats'));
      return;
    }
    if (classified.kind === 'guard') {
      this.host._backdropGuard = classified.state;
      return;
    }
    const payload = await encodePlanFile(file, classified.ext, file.name);
    if (!this.host._spaceDialog) return;
    this.host._spaceDialog = { ...this.host._spaceDialog, planFile: payload };
  }

public _renderBackdropGuard(): TemplateResult | typeof nothing {
    const decorReplace = this._decorAssetGuardReplace;
    if (decorReplace !== null) {
      return renderBackdropGuard(
        this.host,
        () => undefined,
        () => {
          this.host._backdropGuard = null;
          this._decorAssetGuardReplace = null;
        },
        this.host.hass,
        (blob, name) => this._uploadDecorImage(blob, name, decorReplace),
        (this.host._backdropGuard?.file.size || 0) <= 2 * 1024 * 1024,
      ) ?? nothing;
    }
    return renderBackdropGuard(
      this.host,
      (payload) => {
        if (this.host._spaceDialog) {
          this.host._spaceDialog = { ...this.host._spaceDialog, planFile: payload };
        }
      },
      () => { this.host._backdropGuard = null; },
      this.host.hass,
    ) ?? nothing;
  }

public _toggleServerPlans = async (): Promise<void> => {
    const d = this.host._spaceDialog;
    if (!d) return;
    if (d.pickSaved) {
      this.host._spaceDialog = { ...d, pickSaved: false };
      return;
    }
    this.host._spaceDialog = { ...d, pickSaved: true, savedBusy: true };
    try {
      const r: any = await this.host.hass.callWS({ type: 'houseplan/plans/list' });
      const cur = this.host._spaceDialog;
      if (cur) this.host._spaceDialog = { ...cur, saved: r?.plans || [], savedBusy: false };
    } catch (e: any) {
      const cur = this.host._spaceDialog;
      if (cur) this.host._spaceDialog = { ...cur, saved: [], savedBusy: false };
      this.host._showToast(this.host._t('toast.plans_list_failed', { err: this.host._errText(e) }));
    }
  };

public _useServerPlan(url: string): void {
    const d = this.host._spaceDialog;
    if (!d) return;
    // Attach immediately — the click should not wait for anything. The OLD
    // file's proportions go right away: they describe the previous image, and
    // a Save racing the read must get "unknown", never "the wrong shape".
    this.host._spaceDialog = { ...d, planUrl: url, planFile: null, pickSaved: false, savedAspect: undefined };
    this.host._aspectJob = this._readPlanAspect(url);
  }

public async _readPlanAspect(url: string): Promise<number> {
    for (let i = 0; i < 40; i++) {           // ~6 s, then give up quietly
      const src = this.host._display(url);
      if (src) {
        const ratio = await new Promise<number>((res) => {
          const img = new Image();
          img.onload = () => res(img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight : 0);
          img.onerror = () => res(0);
          img.src = src;
        });
        const cur = this.host._spaceDialog;
        if (cur && cur.planUrl === url && Number.isFinite(ratio) && ratio > 0) {
          this.host._spaceDialog = { ...cur, savedAspect: ratio };
          return ratio;
        }
        return 0;
      }
      await new Promise((r) => setTimeout(r, 150));
      if (this.host._spaceDialog?.planUrl !== url) return 0;   // the user moved on
    }
    return 0;
  }

public async _deleteServerPlan(name: string): Promise<void> {
    const dialog = this.host._spaceDialog;
    const plan = dialog?.saved?.find((candidate) => candidate.name === name);
    if (!dialog || !plan || plan.used_by.length || plan.url === dialog.planUrl) return;
    const accepted = await this.host._confirmDanger({
      key: 'delete-plan',
      kind: 'destructive',
      title: this.host._t('confirm.delete_plan_title'),
      message: this.host._t('confirm.delete_plan_body'),
      objectName: name,
      confirmLabel: this.host._t('btn.delete'),
      cancelLabel: this.host._t('btn.cancel'),
    });
    const currentDialog = this.host._spaceDialog;
    const currentPlan = currentDialog?.saved?.find((candidate) => candidate.name === name);
    if (!accepted || !currentDialog || !currentPlan
      || currentPlan.url !== plan.url || currentPlan.modified !== plan.modified
      || currentPlan.used_by.length || currentPlan.url === currentDialog.planUrl) return;
    try {
      await this.host.hass.callWS({ type: 'houseplan/plans/delete', name });
      const d = this.host._spaceDialog;
      if (d?.saved) this.host._spaceDialog = { ...d, saved: d.saved.filter((p) => p.name !== name) };
    } catch (e: any) {
      this.host._showToast(this.host._t('toast.plan_delete_failed', { err: this.host._errText(e) }));
    }
  }

public _renderServerPlans(d: NonNullable<typeof this.host._spaceDialog>): TemplateResult {
    if (d.savedBusy) return html`<div class="savedplans muted">${this.host._t('space.loading')}</div>`;
    const list = d.saved || [];
    if (!list.length) return html`<div class="savedplans muted">${this.host._t('space.no_saved')}</div>`;
    const kb = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
    return html`<div class="savedplans">
      ${list.map((p) => html`
        <div class="savedplan ${p.url === d.planUrl ? 'cur' : ''}">
          <img src=${this.host._display(p.url)} alt="" loading="lazy" decoding="async" />
          <div class="savedmeta">
            <b>${p.name}</b>
            <span class="muted">${kb(p.size)}${p.used_by.length
              ? ' · ' + this.host._t('space.used_by', { list: p.used_by.join(', ') })
              : ''}</span>
          </div>
          <button class="btn ghost" @click=${() => this._useServerPlan(p.url)}
            ?disabled=${p.url === d.planUrl}>${this.host._t('btn.use')}</button>
          <button class="btn ghost danger"
            title=${p.used_by.length || p.url === d.planUrl ? this.host._t('space.in_use') : this.host._t('btn.delete')}
            ?disabled=${p.used_by.length > 0 || p.url === d.planUrl}
            @click=${() => this._deleteServerPlan(p.name)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>`)}
    </div>`;
  }

public async _saveSpaceDialog(): Promise<void> {
    const d = this.host._spaceDialog;
    if (!d || d.busy || !d.title.trim()) return;
    if (d.source === 'file' && !d.planFile && !d.planUrl) {
      this.host._showToast(this.host._t('toast.plan_required'));
      return;
    }
    const wasFirst = d.mode === 'create' && (this.host._serverCfg?.spaces.length || 0) === 0;
    this.host._spaceDialog = { ...d, busy: true };
    try {
      const spaceId = d.mode === 'create' ? 's' + Date.now().toString(36) : d.spaceId!;

      /* Upload BEFORE touching the config, and never hold a reference to a
         config object across an await. `houseplan/config/get` runs on every
         `houseplan_config_updated` event and REPLACES `_serverCfg`; a space
         object captured before the upload is then detached, so plan_url,
         aspect and settings were written into an orphan and the save shipped
         the untouched config. Symptom: the file lands on disk, the plan never
         appears, and re-saving does not help (owner's install, 2026-07-27). */
      let uploaded: { url: string; aspect: number } | null = null;
      if (d.source === 'file' && d.planFile) {
        const resp = await this.host.hass.callWS({
          type: 'houseplan/plan/set', space_id: spaceId, ext: d.planFile.ext, data: d.planFile.b64,
        });
        uploaded = { url: resp.url, aspect: d.planFile.aspect };
      }

      // A plan picked from the server list reads its proportions from the
      // image, and Save used to outrun that read: the snapshot still carried
      // the PREVIOUS file's ratio and a wide plan came out at the old shape
      // for good (HP-1490-04). Wait for the read — it is bounded (~6 s) and
      // the dialog is already busy. Unknown stays unknown, never the old
      // value: a square fallback is honest, an inherited ratio is not.
      let pickedAspect: number | null = d.savedAspect || null;
      if (!uploaded && d.source === 'file' && d.planUrl && !pickedAspect && this.host._aspectJob) {
        pickedAspect = (await this.host._aspectJob) || null;
      }

      // from here on: no awaits until the save, so `sp` cannot be orphaned
      const cfg = this.host._serverCfg!;
      let sp: any;
      if (d.mode === 'create') {
        sp = createEmptySpaceConfig(spaceId, d.title.trim());
        cfg.spaces.push(sp);
      } else {
        sp = cfg.spaces.find((x: any) => x.id === spaceId);
        if (!sp) throw new Error('space ' + spaceId + ' is gone from the config');
        sp.title = d.title.trim();
      }
      if (uploaded) {
        sp.plan_url = uploaded.url;
        // the image's own proportions, so it can be centred before it loads
        sp.plan_aspect = uploaded.aspect;
      } else if (d.source === 'file' && d.planUrl && d.planUrl !== sp.plan_url) {
        // picked from the server list: no upload, just a reference — and the
        // previous image's proportions never survive the switch
        sp.plan_url = d.planUrl;
        sp.plan_aspect = pickedAspect;
      }
      // switching an existing space to "draw" detaches its background image
      // (the uploaded file stays on disk; only the reference is cleared).
      // Its transform goes with it — there is nothing left for plan_x/plan_y/
      // plan_scale to describe, and a stale one would silently apply to the
      // NEXT picture uploaded here (docs/BACKDROP.md §1).
      if (d.source === 'draw') {
        sp.plan_url = null; sp.plan_aspect = null;
        delete sp.plan_x; delete sp.plan_y; delete sp.plan_scale;
        delete sp.plan_scale_x; delete sp.plan_scale_y; delete sp.plan_angle;
      }
      // Persist exactly what the dialog showed. Source defaults are projected
      // visibly while editing the create state, never hidden here at Save.
      sp.settings = {
        ...(sp.settings || {}),
        show_borders: d.showBorders,
        show_names: d.showNames,
        // written only when ON: a plan that never hid anything stores nothing
        hide_decor: d.hideDecor || undefined,
        hide_openings: d.hideOpenings || undefined,
        room_color: d.roomColor,
        room_opacity: d.roomOpacity,
        bg_color: d.bgColor || undefined, // empty = inherit the general setting
        bg_mode: d.bgMode || undefined,    // sun on the plan (docs/SUN.md); empty = inherit
        north_deg: d.northDeg ?? undefined,
        sun_rays: d.sunRays ?? undefined,
        fill_mode: d.fillMode,
        custom_fill: d.customFill || undefined,
        // Always materialize the independent value. In particular, editing a
        // legacy fill_mode:'glow' space preserves its appearance atomically
        // while replacing the old token with the selected data fill.
        glow_enabled: d.glowEnabled,
        temp_min: Number.isFinite(d.tempMin) ? Math.min(d.tempMin, d.tempMax) : DEFAULT_TEMP_MIN,
        temp_max: Number.isFinite(d.tempMax) ? Math.max(d.tempMin, d.tempMax) : DEFAULT_TEMP_MAX,
        show_lqi: d.showLqi,
        card_font_scale: d.cardFontScale !== 1 ? d.cardFontScale : undefined,
        label_temp: d.labelTemp,
        label_hum: d.labelHum,
        label_lqi: d.labelLqi,
        label_light: d.labelLight,
      };
      // This is a geometry policy of the space, not a visual room setting.
      sp.zero_wall_style = d.zeroWallStyle;
      sp.cell_cm = Number.isFinite(d.cellCm) && d.cellCm > 0
        ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, d.cellCm)) : 5;
      // Nothing to clean up from here: the backend collects the superseded
      // file inside the same locked transaction that accepted this config
      // (review R3-1). A cleanup driven from the client could not be ordered
      // against another client's commit and deleted its freshly saved plan.
      await this._saveConfigNow();
      this.host._spaceDialog = null;
      if (d.mode === 'create') this.host._commitSpace(sp.id);
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      if (this.host._importQueue.length) {
        // floors-import wizard: proceed to the next floor
        this._openNextImport();
      } else if (wasFirst || this.host._importTotal > 0) {
        // guide the user onward: straight into room markup mode
        this.host._importTotal = 0;
        this.host._commitSpace(this.host._serverCfg!.spaces[0]?.id || this.host._space);
        this._setMode('plan');
        this.host._tool = 'draw';
        this.host._path = [];
        this.host._cursorPt = null;
        this._primeDrawWallField();
        this.host._showToast(this.host._t(wasFirst && !this.host._importTotal ? 'toast.space_added_onboard' : 'import.done'));
      } else {
        this.host._showToast(d.mode === 'create' ? this.host._t('toast.space_added') : this.host._t('toast.space_saved'));
        // A freshly created space is empty — View has nothing to show. Open
        // the plan editor (draw tool) so the user can mark rooms immediately,
        // same as the first-space onboard path above.
        if (d.mode === 'create') {
          if (this.host._mode !== 'plan') this._setMode('plan');
          else {
            this.host._tool = 'draw';
            this.host._path = [];
            this.host._cursorPt = null;
            this._primeDrawWallField();
            this.host._saveNav();
          }
        }
      }
    } catch (e: any) {
      // The dialog edits the reactive config optimistically before config/set.
      // A rejected create used to leave that unsaved space on screen; the next
      // delete then flushed the same malformed write and repeated its error.
      // Re-adopt server truth for every failed space transaction.  Conflict is
      // already reloaded by _saveConfigNow; do not issue the same read twice.
      // A lost response is safe too: if the server did commit, config/get
      // returns it.
      if (e?.code !== 'conflict') await this.host._reloadConfigOnly(true);
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (this.host._spaceDialog) this.host._spaceDialog = { ...this.host._spaceDialog, busy: false };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    }
  }

public async _deleteSpace(): Promise<void> {
    const d = this.host._spaceDialog;
    if (!d || d.mode !== 'edit') return;
    const serverCfg = this.host._serverCfg;
    if (!serverCfg) return;
    const sp = serverCfg.spaces.find((x: any) => x.id === d.spaceId);
    const dependencies = collectSpaceMarkerDependencies(
      serverCfg, this.host._layout || {}, d.spaceId || '',
    );
    const deletingLastSpace = serverCfg.spaces.length === 1
      && serverCfg.spaces[0]?.id === d.spaceId;
    if (dependencies.count && !deletingLastSpace) {
      this.host._spaceDialog = { ...d, deleteBlockers: dependencies.count };
      return;
    }
    if (!sp) return;
    const spaceId = d.spaceId!;
    const accepted = await this.host._confirmDanger({
      key: 'delete-space',
      kind: 'destructive',
      title: this.host._t('confirm.delete_space_title'),
      message: spaceDeletionMessage(this.host._t('confirm.delete_space_body'),
        this.host._t('confirm.delete_space_vac_routes'), dependencies.routeCount),
      objectName: sp.title,
      confirmLabel: this.host._t('btn.delete'),
      cancelLabel: this.host._t('btn.cancel'),
    });
    const currentDialog = this.host._spaceDialog;
    const currentConfig = this.host._serverCfg;
    if (!accepted || !currentDialog || currentDialog.mode !== 'edit'
      || currentDialog.busy || currentDialog.spaceId !== spaceId || !currentConfig) return;
    const currentSpace = currentConfig.spaces.find((candidate) => candidate.id === spaceId);
    if (!currentSpace) return;
    const currentDependencies = collectSpaceMarkerDependencies(
      currentConfig, this.host._layout || {}, spaceId,
    );
    const currentlyDeletingLastSpace = currentConfig.spaces.length === 1
      && currentConfig.spaces[0]?.id === spaceId;
    if (currentDependencies.count && !currentlyDeletingLastSpace) {
      this.host._spaceDialog = {
        ...currentDialog, deleteBlockers: currentDependencies.count,
      };
      return;
    }
    this.host._spaceDialog = { ...currentDialog, deleteBlockers: 0, busy: true };
    try {
      if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.flush();
      if (this.host._persistLayout.pending()) this.host._persistLayout.flush();
      await this.host._writeChain;
      const response: any = await this.host.hass.callWS({
        type: 'houseplan/space/delete',
        space_id: spaceId,
        expected_config_rev: this.host._cfgRev,
        expected_layout_rev: this.host._layoutRev,
      });
      const [configResponse, layoutResponse] = await Promise.all([
        this.host._getAuthoritativeConfig(),
        this.host.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      this.host._adoptStructuralResponses(configResponse, layoutResponse);
      this.host._cfgRev = response?.config_rev ?? this.host._cfgRev;
      this.host._layoutRev = response?.layout_rev ?? this.host._layoutRev;
      this.host._spaceDialog = null;
      if (this.host._space === spaceId) this.host._commitSpace(this.host._serverCfg!.spaces[0]?.id || '');
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._showToast(this.host._t('toast.space_deleted'));
    } catch (e: any) {
      if (e?.code === 'conflict' || e?.code === 'space_in_use') {
        await Promise.all([this.host._reloadConfigOnly(true), this.host._reloadLayoutOnly()]);
      }
      const refreshedConfig = this.host._serverCfg;
      if (this.host._spaceDialog && refreshedConfig) {
        const refreshed = collectSpaceMarkerDependencies(
          refreshedConfig, this.host._layout || {}, spaceId,
        );
        const stillLastSpace = refreshedConfig.spaces.length === 1
          && refreshedConfig.spaces[0]?.id === spaceId;
        this.host._spaceDialog = {
          ...this.host._spaceDialog,
          busy: false,
          deleteBlockers: stillLastSpace ? 0 : refreshed.count,
        };
      }
      this.host._showToast(this.host._t('toast.delete_failed', { err: this.host._errText(e) }));
    }
  }

public async _saveConfigNow(attempt: OptimisticAttempt<ServerConfig> | null = null): Promise<void> {
    this.host._cfgEpoch++;
    try {
      // same queue as the debounced writer: a dialog saving while a background
      // write is still out must not race it into a self-inflicted conflict
      await this._writeConfig(attempt);
    } catch (e: any) {
      if (e?.physicalGeometryRolledBack) await this._reloadRejectedPhysicalWrite();
      else if (e?.code === 'conflict') await this.host._reloadConfigOnly();
      throw e;
    }
  }

public _saveSpaceCopy(): Promise<void> {
    return saveSpaceCopy(this.host, {
      clearGeometryGesture: () => this._clearGeometryGesture(),
      optimizeReferenceContext: () => this._optimizeReferenceContext(false),
      reportPreflightFailure: (result, config) => this._reportPreflightFailure(result, config),
      saveConfigNow: (attempt) => this._saveConfigNow(attempt),
      setMode: () => this._setMode('plan'),
      showWallModelMigrationBlocked: (error) => this._showWallModelMigrationBlocked(error),
    });
  }

public _startImport(): void {
    const dlg = this.host._importDialog;
    if (!dlg) return;
    const titles = dlg.floors.filter((f) => f.checked).map((f) => f.name);
    this.host._importDialog = null;
    if (!titles.length) {
      this._openSpaceDialog('create');
      return;
    }
    this.host._importQueue = titles;
    this.host._importTotal = titles.length;
    this._openNextImport();
  }

public _openNextImport(): void {
    const title = this.host._importQueue.shift();
    if (title === undefined) return;
    this.host._spaceDialog = {
      mode: 'create', title, planUrl: null, planFile: null,
      ...initialSpaceDisplayDraft(),
      hideDecor: false, hideOpenings: false, zeroWallStyle: 'dashed',
      roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'custom',
      customFill: null,
      glowEnabled: true,
      bgColor: null,
      bgMode: 'daynight', northDeg: null, sunRays: null,
      tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
      showLqi: this.host._config?.show_signal ?? true,
      cardFontScale: 1,
      labelTemp: false, labelHum: false, labelLqi: false, labelLight: false,
      cellCm: newSpaceCellCm(this.host._imperial),
      cellCmInput: gridCellFieldValue(newSpaceCellCm(this.host._imperial), this.host._imperial),
      cellCmTouched: false,
      busy: false,
    };
  }

public _skipImport(): void {
    this.host._spaceDialog = null;
    if (this.host._importQueue.length) this._openNextImport();
    else if (this.host._importTotal > 0 && this.host._model.length) {
      this.host._importTotal = 0;
      this.host._commitSpace(this.host._serverCfg!.spaces[0]?.id || this.host._space);
      this._setMode('plan');
      this.host._showToast(this.host._t('import.done'));
    }
  }

public _renderImportDialog(): TemplateResult {
    const d = this.host._importDialog!;
    const n = d.floors.filter((f) => f.checked).length;
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('import.title')} icon="mdi:home-floor-1"
      @hp-close=${() => (this.host._importDialog = null)}>
        <div class="body">
          <div class="rhint">${this.host._t('import.hint')}</div>
          ${d.floors.map(
            (f, i) => html`<label class="floorrow">
              <input type="checkbox" .checked=${f.checked}
                @change=${(e: Event) => {
                  const floors = [...d.floors];
                  floors[i] = { ...f, checked: (e.target as HTMLInputElement).checked };
                  this.host._importDialog = { floors };
                }} />
              <span>${f.name}</span>
              ${f.level != null ? html`<span class="floorlvl">L${f.level}</span>` : nothing}
            </label>`,
          )}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => { this.host._importDialog = null; this._openSpaceDialog('create'); }}>
            ${this.host._t('import.manual')}
          </button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => this._startImport()} ?disabled=${!n}>
            <ha-icon icon="mdi:import"></ha-icon>${this.host._t('import.start', { n })}
          </button>
        </div>
    </hp-dialog>`;
  }

public _openSettingsDialog = (): void => {
    if (!this.host._norm) return;
    // deep copy so the dialog edits do not leak into the live palette
    const cm = this.host._glowRadiusCm;
    const glowRadius = this.host._imperial
      ? Math.round((cm / 30.48) * 10) / 10
      : Math.round(cm) / 100;
    this.host._settingsDialog = {
      colors: JSON.parse(JSON.stringify(this.host._fillColors)),
      glowRadius,
      bgColor: stageBgOf(this.host._settings, { bgColor: null }) || null,
      northDeg: northDegOf(this.host._settings, {}),
      bgMode: bgModeOf(this.host._settings, {}),
      sunRays: sunRaysOn(this.host._settings, {}),
      showRoomTooltip: showRoomTooltipOf(this.host._settings), zigbeeTopology: zigbeeTopologySettingsOf(this.host._settings), busy: false,
    };
  };

public _openSupportDialog = (): void => {
    if (!this.host._norm || !this.host._canEdit) return;
    clearTimeout(this._supportExpiryTimer);
    this._supportExpiryTimer = undefined;
    this._supportPreviewGeneration += 1;
    this.host._supportDialog = newSupportDialogState();
  };

private _supportPatch(
    draftId: string,
    patch: Partial<SupportDialogState>,
  ): SupportDialogState | null {
    const current = this.host._supportDialog;
    if (!current || current.draftId !== draftId) return null;
    const next = { ...current, ...patch };
    this.host._supportDialog = next;
    return next;
  }

private async _focusSupport(selector: string): Promise<void> {
    await this.host.updateComplete;
    this.host.renderRoot.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }

private _updateSupportDraft(field: 'contact' | 'message', value: string): void {
    const current = this.host._supportDialog;
    if (!current || current.status === 'building' || current.status === 'sending'
        || current.status === 'success') return;
    const candidate: SupportDialogState = { ...current, [field]: value };
    // Validate text independently from the optional preview. Editing must clear
    // stale transport errors, while an expired prepared package remains explicit.
    const textError = supportDraftError({ ...candidate, attach: false, preview: null });
    const showRequired = textError === 'message_required'
      && current.errorCode === 'validation.message_required';
    const immediateError = textError === 'message_too_long' || textError === 'contact_too_long';
    if (showRequired || immediateError) {
      this._supportPatch(current.draftId, {
        [field]: value,
        status: 'error',
        errorCode: `validation.${textError}`,
      });
      return;
    }
    if (candidate.attach && candidate.preview && candidate.preview.expiresAt <= Date.now()) {
      this._supportPatch(current.draftId, {
        [field]: value,
        status: 'error',
        errorCode: 'support_preview_expired',
      });
      return;
    }
    this._supportPatch(current.draftId, {
      [field]: value,
      status: candidate.attach && candidate.preview ? 'ready' : 'idle',
      errorCode: '',
    });
  }

public async _discardSupportPreview(token: string): Promise<void> {
    if (!token) return;
    try {
      await this.host.hass.callWS({ type: 'houseplan/support/preview/discard', token });
    } catch {
      // Cleanup is best-effort; backend TTL is the final privacy guard.
    }
  }

public async _closeSupportDialog(): Promise<void> {
    const dialog = this.host._supportDialog;
    if (!dialog) return;
    if (dialog.status === 'building' || dialog.status === 'sending') {
      const lang = langOf(this.host.hass, this.host._config?.language);
      const accepted = await this.host._confirmDanger({
        key: 'close-support-busy',
        kind: 'warning',
        title: supportT(lang, 'support.close_busy_title'),
        message: supportT(lang, 'support.close_busy_body'),
        confirmLabel: this.host._t('btn.close'),
        cancelLabel: this.host._t('btn.cancel'),
      });
      if (!accepted) {
        await this.host.updateComplete;
        this.host.renderRoot.querySelector<HpDialog>('#support-dialog')?.rejectClose();
        return;
      }
    }
    clearTimeout(this._supportExpiryTimer);
    this._supportExpiryTimer = undefined;
    this.host._supportDialog = null;
    if (dialog.preview?.token && dialog.status !== 'success') {
      void this._discardSupportPreview(dialog.preview.token);
    }
  }

private _scheduleSupportExpiry(draftId: string, preview: SupportPreview): void {
    clearTimeout(this._supportExpiryTimer);
    const delay = Math.max(0, preview.expiresAt - Date.now());
    this._supportExpiryTimer = window.setTimeout(() => {
      const current = this.host._supportDialog;
      if (!current || current.draftId !== draftId || current.preview?.token !== preview.token
          || !current.attach || current.status === 'success' || current.status === 'sending') return;
      this._supportPatch(draftId, {
        status: 'error',
        errorCode: 'support_preview_expired',
      });
    }, Math.min(delay + 20, 2_147_483_647));
  }

private _supportFacts(): ReturnType<typeof supportRuntimeFacts> {
    const registry = this.host._haRegistry;
    return supportRuntimeFacts({
      userAgent: globalThis.navigator?.userAgent || '',
      language: langOf(this.host.hass, this.host._config?.language),
      registryAccess: registry.access,
      registryLastSuccess: registry.lastSuccess,
    });
  }

private _supportPreviewRequestIsCurrent(draftId: string, generation: number): boolean {
    const current = this.host._supportDialog;
    return generation === this._supportPreviewGeneration
      && current?.draftId === draftId
      && current.attach;
  }

private async _buildSupportPreview(draftId: string): Promise<void> {
    const current = this.host._supportDialog;
    if (!current || current.draftId !== draftId || !current.attach
        || !supportApiCompatible(this.host._haSupportApi)) return;
    const generation = ++this._supportPreviewGeneration;
    this._supportPatch(draftId, { status: 'building', errorCode: '' });
    let issuedToken = '';
    try {
      const response: unknown = await this.host.hass.callWS({
        type: 'houseplan/support/preview',
        card_version: CARD_VERSION,
        ...this._supportFacts(),
        draft_id: draftId,
      });
      const payload = response && typeof response === 'object'
        ? response as Partial<Record<
          'text' | 'size' | 'expires_in' | 'spaces' | 'token' | 'sha256' | 'version' | 'format',
          unknown
        >> : {};
      const now = Date.now();
      const text = typeof payload.text === 'string' ? payload.text : '';
      const size = Number(payload.size);
      const expiresIn = Number(payload.expires_in);
      const spaces = Number(payload.spaces);
      const token = String(payload.token || '');
      if (/^[0-9a-f]{48}$/.test(token)) issuedToken = token;
      const sha256 = String(payload.sha256 || '');
      const version = Number(payload.version);
      const format = String(payload.format || '');
      const byteSize = new TextEncoder().encode(text).byteLength;
      if (!/^[0-9a-f]{48}$/.test(token) || !/^[0-9a-f]{64}$/.test(sha256)
          || format !== 'houseplan-support-package' || version !== 1
          || !Number.isInteger(size) || size !== byteSize || !Number.isInteger(spaces) || spaces < 0
          || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 600 || !text.endsWith('\n')) {
        throw { code: 'support_rejected' };
      }
      const preview: SupportPreview = {
        token,
        expiresAt: now + expiresIn * 1000,
        size,
        sha256,
        spaces,
        format,
        version,
        text,
        preparedAt: now,
      };
      if (!this._supportPreviewRequestIsCurrent(draftId, generation)) {
        issuedToken = '';
        void this._discardSupportPreview(token);
        return;
      }
      if (!this._supportPatch(draftId, {
        status: 'ready',
        preview,
        errorCode: '',
        rawOpen: false,
      })) {
        issuedToken = '';
        void this._discardSupportPreview(token);
        return;
      }
      issuedToken = '';
      this._scheduleSupportExpiry(draftId, preview);
    } catch (error: unknown) {
      // The backend has allocated every syntactically valid token it returns.
      // Cleanup is independent from UI currentness: invalid, stale or locally
      // unadoptable responses must not occupy a slot until TTL.
      if (issuedToken) {
        const token = issuedToken;
        issuedToken = '';
        void this._discardSupportPreview(token);
      }
      if (!this._supportPreviewRequestIsCurrent(draftId, generation)) return;
      if (!this._supportPatch(draftId, {
        status: 'error',
        errorCode: supportErrorCode(error),
      })) return;
      void this._focusSupport('#support-error');
    }
  }

public async _setSupportAttachment(attach: boolean): Promise<void> {
    const current = this.host._supportDialog;
    if (!current || current.status === 'sending' || current.status === 'success') return;
    const token = current.preview?.token || '';
    if (!attach) {
      this._supportPreviewGeneration += 1;
      clearTimeout(this._supportExpiryTimer);
      this._supportExpiryTimer = undefined;
      this._supportPatch(current.draftId, {
        attach: false,
        status: 'idle',
        preview: null,
        rawOpen: false,
        errorCode: '',
      });
      if (token) void this._discardSupportPreview(token);
      return;
    }
    this._supportPatch(current.draftId, { attach: true, errorCode: '' });
    await this._buildSupportPreview(current.draftId);
  }

public async _refreshSupportPreview(): Promise<void> {
    const current = this.host._supportDialog;
    if (!current || !current.attach || current.status === 'building' || current.status === 'sending') return;
    await this._buildSupportPreview(current.draftId);
  }

public _downloadSupportPreview(): void {
    const preview = this.host._supportDialog?.preview;
    if (!preview) return;
    const blob = new Blob([preview.text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `houseplan-support-${preview.sha256.slice(0, 12)}.json`;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

private async _copySupportText(text: string, successKey: SupportI18nKey): Promise<void> {
    const lang = langOf(this.host.hass, this.host._config?.language);
    try {
      await navigator.clipboard.writeText(text);
      this.host._showToast(supportT(lang, successKey));
    } catch {
      this.host._showToast(supportT(lang, 'support.copy_failed'));
    }
  }

public async _submitSupport(): Promise<void> {
    const current = this.host._supportDialog;
    if (!current || !supportApiCompatible(this.host._haSupportApi)) return;
    const validation = supportDraftError(current);
    if (validation) {
      this._supportPatch(current.draftId, {
        status: 'error',
        errorCode: `validation.${validation}`,
      });
      void this._focusSupport('#support-message');
      return;
    }
    if (!supportCanSubmit(current)) return;
    const submission = supportSubmissionIdentity(current);
    const sending = this._supportPatch(current.draftId, {
      status: 'sending',
      errorCode: '',
      idempotencyKey: submission.idempotencyKey,
      submissionFingerprint: submission.fingerprint,
    });
    if (!sending) return;
    try {
      const response: unknown = await this.host.hass.callWS({
        type: 'houseplan/support/submit',
        message: sending.message.trim(),
        contact: sending.contact.trim(),
        ...(sending.attach && sending.preview ? { preview_token: sending.preview.token } : {}),
        idempotency_key: sending.idempotencyKey,
      });
      const reportId = response && typeof response === 'object' && 'report_id' in response
        ? String((response as { report_id?: unknown }).report_id || '') : '';
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(reportId)) {
        throw { code: 'support_unavailable' };
      }
      clearTimeout(this._supportExpiryTimer);
      this._supportExpiryTimer = undefined;
      if (!this._supportPatch(current.draftId, {
        status: 'success',
        reportId,
        errorCode: '',
      })) return;
      void this._focusSupport('#support-receipt');
    } catch (error: unknown) {
      if (!this._supportPatch(current.draftId, {
        status: 'error',
        errorCode: supportErrorCode(error),
      })) return;
      void this._focusSupport('#support-error');
    }
  }

private _supportErrorText(state: SupportDialogState): string {
    const lang = langOf(this.host.hass, this.host._config?.language);
    if (state.errorCode.startsWith('validation.')) {
      const suffix = state.errorCode.slice('validation.'.length);
      return supportT(lang, `support.validation.${suffix}` as SupportI18nKey);
    }
    return supportT(
      lang,
      `support.error.${state.errorCode || 'support_unavailable'}` as SupportI18nKey,
    );
  }

private _supportMessageKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    void this._submitSupport();
  }

public _renderSupportDialog(): TemplateResult {
    const state = this.host._supportDialog!;
    const lang = langOf(this.host.hass, this.host._config?.language);
    const guideUrl = lang === 'ru'
      ? 'https://github.com/Matysh/houseplan-card/blob/main/docs/USER-GUIDE.ru.md'
      : 'https://github.com/Matysh/houseplan-card/blob/main/docs/USER-GUIDE.md';
    const compatible = supportApiCompatible(this.host._haSupportApi);
    const st = (key: SupportI18nKey, vars?: Record<string, string | number>): string =>
      supportT(lang, key, vars);
    const busy = state.status === 'building' || state.status === 'sending';
    const validation = supportDraftError(state);
    const preparedMinutes = state.preview
      ? Math.max(0, Math.floor((Date.now() - state.preview.preparedAt) / 60_000)) : 0;
    const manualRecovery = state.status === 'error'
      && !state.errorCode.startsWith('validation.');
    const contactInvalid = state.errorCode === 'validation.contact_too_long';
    const messageInvalid = state.errorCode === 'validation.message_required'
      || state.errorCode === 'validation.message_too_long';
    return html`<hp-dialog id="support-dialog" .hass=${this.host.hass}
      .title=${this.host._t('support.title')} icon="mdi:help-circle-outline" wide dismiss-on-scrim
      @hp-close=${() => void this._closeSupportDialog()}>
        <div class="body supportbody">
          <section class="supportsection" aria-labelledby="support-about-heading">
            <h3 id="support-about-heading">${st('support.about_group')}</h3>
            <div class="aboutver">${this.host._t('gs.about_version', { v: CARD_VERSION })}</div>
            <div class="supportlinks">
              <a class="aboutlink" href="https://github.com/Matysh/houseplan-card" target="_blank" rel="noopener noreferrer">
                <ha-icon icon="mdi:github"></ha-icon>${this.host._t('gs.about_github')}</a>
              <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener noreferrer">
                <ha-icon icon="mdi:send"></ha-icon>${this.host._t('gs.about_telegram')}</a>
            </div>
          </section>
          <section class="supportsection" aria-labelledby="support-docs-heading">
            <h3 id="support-docs-heading">${st('support.guide_group')}</h3>
            <a class="aboutlink" href=${guideUrl} target="_blank" rel="noopener noreferrer">
              <ha-icon icon="mdi:book-open-page-variant-outline"></ha-icon>${st('support.guide')}</a>
          </section>
          ${compatible ? html`
            <section class="supportsection supportform" aria-labelledby="support-form-heading">
              <h3 id="support-form-heading">${st('support.form_group')}</h3>
              <label for="support-contact">${st('support.contact')}</label>
              <input id="support-contact" class="namein" type="text" autocomplete="off"
                aria-invalid=${contactInvalid ? 'true' : 'false'}
                aria-describedby=${contactInvalid ? 'support-error' : nothing}
                .value=${state.contact} ?disabled=${busy || state.status === 'success'}
                @input=${(event: Event) => this._updateSupportDraft(
                  'contact', (event.target as HTMLInputElement).value,
                )} />
              <label for="support-message">${st('support.message')}</label>
              <textarea id="support-message" class="supportmessage" required
                aria-invalid=${messageInvalid ? 'true' : 'false'}
                aria-describedby=${messageInvalid ? 'support-error' : nothing}
                .value=${state.message} ?disabled=${busy || state.status === 'success'}
                @keydown=${(event: KeyboardEvent) => this._supportMessageKeydown(event)}
                @input=${(event: Event) => this._updateSupportDraft(
                  'message', (event.target as HTMLTextAreaElement).value,
                )}></textarea>
              <label class="srcrow supportattach">
                <input type="checkbox" .checked=${state.attach} aria-describedby="support-attach-hint"
                  ?disabled=${busy || state.status === 'success'}
                  @change=${(event: Event) => void this._setSupportAttachment(
                    (event.target as HTMLInputElement).checked,
                  )} />
                <span>${st('support.attach')}</span>
              </label>
              <p id="support-attach-hint" class="rhint">${st('support.attach_hint')}</p>
              ${state.attach ? html`<p class="supportwarning" role="note">
                <ha-icon icon="mdi:shield-alert-outline"></ha-icon>
                <span>${st('support.geometry_warning')}</span>
              </p>` : nothing}
              ${state.status === 'building' ? html`<div class="supportstatus" role="status" aria-live="polite">
                <ha-icon icon="mdi:progress-clock"></ha-icon>${st('support.building')}
              </div>` : nothing}
              ${state.attach && state.preview ? html`
                <div class="supportpreview">
                  <div class="supportsummary">${st('support.preview_summary', {
                    version: state.preview.version,
                    spaces: state.preview.spaces,
                    size: supportSizeKiB(state.preview.size),
                  })}</div>
                  <div class="supporthash"><span>SHA-256</span><code>${state.preview.sha256}</code></div>
                  <div class="rhint">${st('support.prepared', { n: preparedMinutes })}</div>
                  <details ?open=${state.rawOpen}
                    @toggle=${(event: Event) => this._supportPatch(state.draftId, {
                      rawOpen: (event.currentTarget as HTMLDetailsElement).open,
                    })}>
                    <summary>${st('support.show_data')}</summary>
                    ${state.rawOpen ? html`<textarea class="supportraw" readonly
                      .value=${state.preview.text}></textarea>` : nothing}
                  </details>
                  <div class="supportactions">
                    <button type="button" class="btn ghost" @click=${() => this._downloadSupportPreview()}>
                      <ha-icon icon="mdi:download"></ha-icon>${st('support.download')}
                    </button>
                    <button type="button" class="btn ghost" @click=${() => void this._refreshSupportPreview()}
                      ?disabled=${busy || state.status === 'success'}>
                      <ha-icon icon="mdi:refresh"></ha-icon>${st('support.refresh')}
                    </button>
                  </div>
                </div>` : nothing}
              <p class="rhint supportprivacy">${st('support.privacy')}</p>
              ${state.status === 'error' ? html`
                <div id="support-error" class="supporterror" role="alert" tabindex="-1">
                  <strong>${st('support.error_title')}</strong>
                  <span>${this._supportErrorText(state)}</span>
                </div>` : nothing}
              ${state.status === 'error' && state.attach && !state.preview ? html`
                <div class="supportactions">
                  <button type="button" class="btn ghost"
                    @click=${() => void this._refreshSupportPreview()}>
                    <ha-icon icon="mdi:refresh"></ha-icon>${st('support.refresh')}
                  </button>
                </div>` : nothing}
              ${manualRecovery ? html`
                <div class="supportmanual">
                  <strong>${st('support.manual_recovery')}</strong>
                  <div class="supportactions">
                    <button type="button" class="btn ghost" @click=${() => void this._copySupportText(
                      state.message, 'support.message_copied',
                    )}>${st('support.copy_message')}</button>
                    ${state.preview ? html`<button type="button" class="btn ghost"
                      @click=${() => this._downloadSupportPreview()}>${st('support.download')}</button>` : nothing}
                    <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener noreferrer">Telegram</a>
                    <a class="aboutlink" href="https://github.com/Matysh/houseplan-card/issues" target="_blank" rel="noopener noreferrer">GitHub</a>
                  </div>
                </div>` : nothing}
              ${state.status === 'success' ? html`
                <div id="support-receipt" class="supportsuccess" role="status" aria-live="polite" tabindex="-1">
                  <strong>${st('support.success', { id: state.reportId })}</strong>
                  <button type="button" class="btn ghost" @click=${() => void this._copySupportText(
                    state.reportId, 'support.id_copied',
                  )}>${st('support.copy_id')}</button>
                </div>` : nothing}
            </section>` : html`
            <div class="supportupdate" role="status">
              <ha-icon icon="mdi:update"></ha-icon>
              <span>${st('support.update_required')}</span>
            </div>`}
        </div>
        <div class="row supportfooter" slot="footer">
          <button type="button" class="btn ghost" @click=${() => void this._closeSupportDialog()}>
            ${this.host._t('btn.close')}
          </button>
          <span class="spacer"></span>
          ${compatible && state.status !== 'success' ? html`
            <button type="button" class="btn on" @click=${() => void this._submitSupport()}
              ?disabled=${!supportCanSubmit(state)}>
              <ha-icon icon="mdi:send"></ha-icon>${state.status === 'sending'
                ? st('support.sending')
                : state.status === 'error' && !validation
                  ? st('support.retry') : st('support.send')}
            </button>` : nothing}
        </div>
    </hp-dialog>`;
  }

public _preflightDiagnostics(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): object {
    // CODE-REVIEW-295-r1 M1: hash the CANDIDATE spaces the preflight judged,
    // not the already-saved config — a saved-config hash is exactly what a
    // space export would reproduce, and the block promises what the export
    // does not carry.
    const spacesById = new Map(((candidate as any)?.spaces || [])
      .map((space) => [String(space?.id || ''), space]));
    return {
      kind: 'houseplan-optimize-preflight',
      origin: 'runtime',
      cardVersion: CARD_VERSION,
      checkedAt: new Date().toISOString(),
      preflightFingerprint: preflight.fingerprint,
      failures: preflight.failures.map((failure) => ({
        spaceId: failure.spaceId,
        displayName: failure.displayName,
        reason: failure.reason,
        detail: failure.detail ?? null,
        spaceGeometryFingerprint: spacesById.has(failure.spaceId)
          ? spacePhysicalGeometryFingerprint(spacesById.get(failure.spaceId))
          : null,
      })),
    };
  }

public _reportPreflightFailure(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): void {
    if (preflight.ok || preflight.fingerprint === this.host._reportedPreflightFingerprint) return;
    this.host._reportedPreflightFingerprint = preflight.fingerprint;
    // eslint-disable-next-line no-console
    console.warn('[houseplan] optimize preflight failed', this._preflightDiagnostics(preflight, candidate));
  }

public _preflightVersionsDiffer(): boolean {
    const integration = this.host._haIntegrationVersion;
    return typeof integration === 'string' && integration.length > 0
      && integration !== CARD_VERSION;
  }

public async _copyPreflightDiagnostics(): Promise<void> {
    const preflight = this.host._alignDialog?.preflight;
    if (!preflight || preflight.ok) return;
    const text = JSON.stringify(
      this._preflightDiagnostics(preflight, this.host._alignDialog?.config ?? null), null, 2,
    );
    try {
      await navigator.clipboard.writeText(text);
      this.host._preflightClipboardFallback = null;
      this.host._showToast(this.host._t('gs.preflight_copied'));
    } catch {
      // Insecure context / embedded webview: surface the block inline so the
      // owner can select and copy it by hand.
      this.host._preflightClipboardFallback = text;
    }
  }

public _checkOptimizeGeometryImpl(config: ServerConfig): OptimizeGeometryPreflightResult {
    return checkOptimizeGeometry(config, {
      fallbackSpaceName: (index) => this.host._t('gs.align_preflight_space', {
        n: String(index),
      }),
    });
  }

public _checkSpacePhysicalGeometryImpl(
    config: ServerConfig,
    spaceId: string,
    captureWallGeometry?: (
      geometry: ReturnType<typeof wallBodiesGeometry>,
    ) => void,
  ) {
    return checkSpacePhysicalGeometry(config, spaceId, {
      fallbackSpaceName: (index) => this.host._t('gs.align_preflight_space', { n: String(index) }),
      captureWallGeometry: captureWallGeometry
        ? (_input, geometry) => captureWallGeometry(geometry)
        : undefined,
    });
  }

public _optimizeReferenceContext(
    removeLiveMissingPositions: boolean,
  ): SpaceReferenceRepairContext {
    const registry = this.host._haRegistry;
    const full = this.host._fullRegistryHass;
    const names: Record<string, string> = {};
    const humanName = (...values: unknown[]): string => {
      for (const value of values) {
        const name = String(value || '').trim();
        if (name) return name;
      }
      return '';
    };
    for (const [deviceId, device] of Object.entries<any>(registry.devices || {})) {
      names[deviceId] = humanName(device?.name_by_user, device?.name, device?.model);
    }
    for (const [entityId, entity] of Object.entries<any>(registry.entities || {})) {
      names[`lg_${entityId}`] = humanName(
        this.host.hass?.states?.[entityId]?.attributes?.friendly_name,
        entity?.name,
        entity?.original_name,
      );
    }
    for (const device of this.host._devices) names[device.id] = humanName(device.name, names[device.id]);
    for (const marker of this.host._serverCfg?.markers || []) {
      const separator = String(marker.binding || '').indexOf(':');
      const kind = separator > 0 ? marker.binding.slice(0, separator) : '';
      const ref = separator > 0 ? marker.binding.slice(separator + 1) : '';
      const bound = kind === 'device'
        ? full?.devices?.[ref]
        : kind === 'entity' ? full?.entities?.[ref] : null;
      names[marker.id] = humanName(
        marker.name,
        kind === 'device' ? bound?.name_by_user : null,
        bound?.name,
        kind === 'entity' ? this.host.hass?.states?.[ref]?.attributes?.friendly_name : null,
        names[marker.id],
      );
    }
    return {
      effectiveAreaByMarker: Object.fromEntries(
        this.host._devices
          .filter((device) => !device.virtual && !!device.area)
          .map((device) => [device.id, device.area]),
      ),
      ownerRoster: {
        authoritative: registry.authoritative,
        deviceIds: Object.keys(registry.devices || {}),
        // State-only YAML entities are positive existence evidence even though
        // an authoritative Entity Registry cannot list them.
        entityIds: [...new Set([
          ...Object.keys(registry.entities || {}),
          ...Object.keys(this.host.hass?.states || {}),
        ])],
        names,
      },
      removeLiveMissingPositions,
    };
  }

public _previewAlignDialog(removeLiveMissingPositions: boolean): void {
    if (!this.host._norm || !this.host._serverCfg) return;
    const spaces = this.host._serverCfg.spaces || [];
    let r;
    try {
      r = optimizePlans(
        this.host._serverCfg,
        this.host._layout || {},
        this._optimizeReferenceContext(removeLiveMissingPositions),
      );
    } catch (error) {
      this._showWallModelMigrationBlocked(error);
      return;
    }
    const preflight = r.changed ? this.host._checkOptimizeGeometry(r.config) : null;
    if (preflight) this._reportPreflightFailure(preflight, r.config);
    // The maximum geometry shift is an UPPER BOUND, not a sample. The run
    // measured every element in the centimetres of ITS OWN space — converting
    // one normalised maximum through the first space's `cell_cm` understated
    // a two-scale plan twentyfold (AUD-158B1-01) — and the last tenth is
    // rounded UP, so the promise can never be smaller than the deed.
    const cm = Math.ceil(r.report.maxShiftCm * 10) / 10;
    const sp = spaces.find((x: any) => x?.id != null && String(x.id) === r.report.maxSpace);
    const where = spaces.length > 1 && sp ? String(sp.title || sp.id) : '';
    // CODE-REVIEW-295-r1 M2: the inline clipboard fallback belongs to one
    // dialog showing — a reopened dialog must not display the previous
    // refusal's JSON while the visible reasons already describe a new one.
    this.host._preflightClipboardFallback = null;
    this.host._alignDialog = {
      report: r.report, config: r.config, layout: r.layout, cm, where,
      preflight, changed: r.changed, busy: false, removeLiveMissingPositions,
    };
  }

public _openAlignDialog = (): void => this._previewAlignDialog(false);

public _toggleOptimizeLivePositions = (): void => {
    const dialog = this.host._alignDialog;
    if (!dialog || dialog.busy || !dialog.report.liveMissingPositions.length) return;
    this._previewAlignDialog(!dialog.removeLiveMissingPositions);
  };

public async _runAlignToGrid(): Promise<void> {
    let d = this.host._alignDialog;
    if (!d || d.busy || !this.host._serverCfg || !d.changed || !d.preflight?.ok) return;
    const fingerprint = contentFingerprint(d.config);
    if (d.preflight.fingerprint !== fingerprint) {
      const preflight = this.host._checkOptimizeGeometry(d.config);
      this._reportPreflightFailure(preflight, d.config);
      d = { ...d, preflight };
      this.host._alignDialog = d;
      if (!preflight.ok) return;
    }
    this._clearGeometryGesture();
    this.host._alignDialog = { ...d, busy: true };
    try {
      await commitPlanOptimization(this.host, d.config, d.layout);
      this.host._alignDialog = null;
      this.host._preflightClipboardFallback = null;
      this.host._showToast(this.host._t('gs.align_done', {
        n: String(d.report.moved),
        m: String(d.report.migrated + d.report.canonicalized
          + d.report.coordsCanonicalized + d.report.latticeCoordinatesCanonicalized
          + d.report.wallsMerged + d.report.spansMerged
          + d.report.partitionsMerged + d.report.partitionsReconciled
          + d.report.openingsRehosted + d.report.wallsStraightened),
        r: String(d.report.spaceRefsRemapped + d.report.roomRefsRemapped
          + d.report.positionsRemapped + d.report.markersDetached
          + d.report.orphanRoomLabelsRemoved + d.report.orphanDevicePositionsRemoved
          + d.report.orphanGroupPositionsRemoved),
      }));
    } catch (e: any) {
      if (this.host._alignDialog) this.host._alignDialog = { ...this.host._alignDialog, busy: false };
      if (e?.code === 'wall_model_client_outdated') {
        this.host._showToast(this.host._t('toast.wall_model_client_outdated'));
        return;
      }
      if (e?.code === 'conflict') {
        await Promise.all([this.host._reloadConfigOnly(true), this.host._reloadLayoutOnly()]);
      }
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    }
  }

public async _undoPlanOptimization(): Promise<void> {
    if (!this.host._canOptimizeUndo || this.host._optimizeUndoBusy) return;
    const undoKind = this.host._undoKind;
    this._clearGeometryGesture();
    this.host._optimizeUndoBusy = true;
    this.host.requestUpdate();
    try {
      await this.host.hass.callWS({
        type: 'houseplan/plan/optimize_undo',
        expected_config_rev: this.host._cfgRev,
        expected_layout_rev: this.host._layoutRev,
      });
      const [cfgResp, layResp] = await Promise.all([
        this.host._getAuthoritativeConfig(),
        this.host.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      // config/get is the sole authority for runtime capabilities, including
      // integration_version. Reuse the full-card adopter instead of leaving
      // this direct optimization-undo path with stale version state (#462).
      this.host._adoptStructuralResponses(cfgResp, layResp);
      this.host._geometryHistory.clear();
      this.host._cancelDeviceDrag();
      this.host._devicePositionHistory.clear();
      this.host._canOptimizeUndo = false;
      this.host._undoKind = null;
      this.host._cfgEpoch++;
      this.host._modelCache = null;
      this.host._frame = null;
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._cacheSnapshot();
      this.host.requestUpdate();
      this.host._showToast(this.host._t(undoKind === 'import' ? 'backup.import_undone' : 'gs.optimize_undone'));
    } catch (e: any) {
      this.host._canOptimizeUndo = false;
      this.host._undoKind = null;
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    } finally {
      this.host._optimizeUndoBusy = false;
      this.host.requestUpdate();
    }
  }

public _openBackupExport = (): void => {
    this.host._settingsDialog = null;
    this.host._backupExportDialog = { kind: 'full', planOnly: false, busy: false, error: '' };
  };

public async _runBackupExport(): Promise<void> {
    const d = this.host._backupExportDialog;
    if (!d || d.busy) return;
    this.host._backupExportDialog = { ...d, busy: true, error: '' };
    try {
      const response: any = await this.host.hass.callWS({
        type: 'houseplan/export/create',
        kind: d.kind,
        space_id: d.kind === 'space' ? this.host._space : undefined,
        ...(d.kind === 'space' && d.planOnly ? { plan_only: true } : {}),
        card_version: CARD_VERSION,
      });
      const blob = new Blob([JSON.stringify(response.document, null, 2) + '\n'], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.filename || `houseplan-${d.kind}.json`;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      this.host._backupExportDialog = null;
      this.host._showToast(this.host._t('backup.export_done'));
    } catch (error: any) {
      if (this.host._backupExportDialog) {
        this.host._backupExportDialog = { ...this.host._backupExportDialog, busy: false, error: this._backupErrorText(error) };
      }
    }
  }

public async _pickBackupImport(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.host._settingsDialog = null;
    this.host._backupImportDialog = {
      filename: file.name, size: file.size, token: '', preview: null,
      expectedConfigRev: this.host._cfgRev, expectedLayoutRev: this.host._layoutRev,
      duplicatePolicy: 'skip', confirmMissing: false, busy: true, error: '',
    };
    try {
      if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.flush();
      await this.host._writeChain;
      if (this.host._persistLayout.pending()) this.host._persistLayout.flush();
      const path = '/api/houseplan/import/preview?duplicate_policy=skip';
      const init = { method: 'POST', body: file, headers: { 'content-type': 'application/json' } };
      const response: Response = this.host.hass?.fetchWithAuth
        ? await this.host.hass.fetchWithAuth(path, init)
        : await fetch(path, {
            ...init,
            headers: {
              ...init.headers,
              ...(this.host.hass?.auth?.data?.access_token
                ? { authorization: `Bearer ${this.host.hass.auth.data.access_token}` } : {}),
            },
          });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${response.status}`), { code: data.error });
      if (this.host._backupImportDialog) {
        this.host._backupImportDialog = {
          ...this.host._backupImportDialog,
          token: data.token,
          preview: data.preview,
          expectedConfigRev: data.expected_config_rev,
          expectedLayoutRev: data.expected_layout_rev,
          busy: false,
        };
      }
    } catch (error: any) {
      if (this.host._backupImportDialog) {
        this.host._backupImportDialog = { ...this.host._backupImportDialog, busy: false, error: this._backupErrorText(error) };
      }
    }
  }

public async _setBackupDuplicatePolicy(policy: 'skip' | 'virtual'): Promise<void> {
    const d = this.host._backupImportDialog;
    if (!d || d.busy || !d.token || policy === d.duplicatePolicy) return;
    this.host._backupImportDialog = { ...d, duplicatePolicy: policy, busy: true, error: '' };
    try {
      const response: any = await this.host.hass.callWS({
        type: 'houseplan/import/revalidate', token: d.token, duplicate_policy: policy,
      });
      if (this.host._backupImportDialog) {
        this.host._backupImportDialog = {
          ...this.host._backupImportDialog,
          preview: { ...d.preview, ...response.preview },
          expectedConfigRev: response.expected_config_rev,
          expectedLayoutRev: response.expected_layout_rev,
          confirmMissing: false,
          busy: false,
        };
      }
    } catch (error: any) {
      if (this.host._backupImportDialog) {
        this.host._backupImportDialog = {
          ...this.host._backupImportDialog,
          duplicatePolicy: d.duplicatePolicy,
          preview: d.preview,
          confirmMissing: d.confirmMissing,
          busy: false,
          error: this._backupErrorText(error),
        };
      }
    }
  }

public async _applyBackupImport(): Promise<void> {
    const d = this.host._backupImportDialog;
    if (!d || d.busy || !d.token || !d.preview) return;
    if (d.preview.confirmation_required && !d.confirmMissing) return;
    this.host._backupImportDialog = { ...d, busy: true, error: '' };
    const previousSpace = this.host._space;
    try {
      const result: any = await this.host.hass.callWS({
        type: 'houseplan/import/apply',
        token: d.token,
        expected_config_rev: d.expectedConfigRev,
        expected_layout_rev: d.expectedLayoutRev,
        duplicate_policy: d.duplicatePolicy,
        confirm_missing_content: d.confirmMissing,
      });
      const [configResponse, layoutResponse] = await Promise.all([
        this.host._getAuthoritativeConfig(),
        this.host.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      this.host._adoptStructuralResponses(configResponse, layoutResponse);
      this.host._geometryHistory.clear();
      this.host._dirtyPos.clear();
      this.host._sentPos.clear();
      this.host._defPos = {};
      this.host._cfgEpoch++;
      this.host._modelCache = null;
      this.host._frame = null;
      this.host._visibleDeviceSnapshot = null;
      this.host._candidateDeviceSnapshot = null;
      this.host._stagedDeviceSnapshotToken = -1;
      this.host._capturedSnapshotConfigEpoch = -1;
      this.host._regSignature = '';
      this.host._signer.invalidate(this.host.hass);
      this.host._resign();
      this.host._maybeRebuildDevices();
      const spaces = this.host._serverCfg?.spaces || [];
      const nextSpace = result.kind === 'space' && result.space_id
        ? result.space_id
        : spaces.some((space) => space.id === previousSpace)
          ? previousSpace : spaces[0]?.id || this.host._space;
      if (this.host._hasFixedFloor) this.host._adoptInitialSpace(this.host._model, true);
      else this.host._commitSpace(nextSpace);
      this.host._backupImportDialog = null;
      this.host._cacheSnapshot();
      this.host.requestUpdate();
      const outcomeCounts = result.kind === 'space' ? d.preview.counts : result.counts;
      this.host._showToast(this.host._t(result.kind === 'space' ? 'backup.space_done' : 'backup.full_done', {
        spaces: String(outcomeCounts?.spaces || 0), rooms: String(outcomeCounts?.rooms || 0),
        markers: String(outcomeCounts?.markers || 0),
        refs: String(result.repaired_target_refs || 0),
      }));
    } catch (error: any) {
      if (error?.code === 'conflict' && this.host._backupImportDialog?.token) {
        try {
          const current = this.host._backupImportDialog;
          const refreshed: any = await this.host.hass.callWS({
            type: 'houseplan/import/revalidate', token: current.token,
            duplicate_policy: current.duplicatePolicy,
          });
          this.host._backupImportDialog = {
            ...current,
            preview: { ...current.preview, ...refreshed.preview },
            expectedConfigRev: refreshed.expected_config_rev,
            expectedLayoutRev: refreshed.expected_layout_rev,
            confirmMissing: false,
            busy: false,
            error: this.host._t('backup.revalidated'),
          };
          return;
        } catch (refreshError: any) {
          error = refreshError;
        }
      }
      if (this.host._backupImportDialog) {
        this.host._backupImportDialog = { ...this.host._backupImportDialog, busy: false, error: this._backupErrorText(error) };
      }
    }
  }

public _renderBackupExportDialog(): TemplateResult {
    const d = this.host._backupExportDialog!;
    const currentSpace = (this.host._serverCfg?.spaces || []).find((space) => space.id === this.host._space);
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('backup.export_title')}
      icon="mdi:download" dismiss-on-scrim @hp-close=${() => (this.host._backupExportDialog = null)}>
      <div class="body backupbody">
        <div class="rhint">${this.host._t('backup.export_hint')}</div>
        <label class="srcrow"><input type="radio" name="backup-kind" value="full"
          .checked=${d.kind === 'full'}
          @change=${() => (this.host._backupExportDialog = { ...d, kind: 'full', planOnly: false })} />
          <span>${this.host._t('backup.full')}</span></label>
        <label class="srcrow"><input type="radio" name="backup-kind" value="space"
          .checked=${d.kind === 'space'} ?disabled=${!currentSpace}
          @change=${() => (this.host._backupExportDialog = { ...d, kind: 'space' })} />
          <span>${currentSpace
            ? this.host._t('backup.current_space_title', { title: currentSpace.title || currentSpace.id })
            : this.host._t('backup.no_current_space')}</span></label>
        ${d.kind === 'space' && currentSpace ? html`<label class="srcrow backupplanonly">
          <input type="checkbox" .checked=${d.planOnly}
            @change=${(event: Event) => (this.host._backupExportDialog = {
              ...d, planOnly: (event.target as HTMLInputElement).checked,
            })} />
          <span><b>${this.host._t('backup.plan_only')}</b><small>${this.host._t('backup.plan_only_hint')}</small></span>
        </label>` : nothing}
        <div class="backupwarn">${this.host._t('backup.privacy_warning')}</div>
        ${d.error ? html`<div class="backuperror" role="alert">${d.error}</div>` : nothing}
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" autofocus @click=${() => (this.host._backupExportDialog = null)}>${this.host._t('btn.cancel')}</button>
        <span class="spacer"></span>
        <button class="btn on" ?disabled=${d.busy || (d.kind === 'space' && !currentSpace)}
          @click=${() => this._runBackupExport()}>
          <ha-icon icon="mdi:download"></ha-icon>${d.busy ? '…' : this.host._t('backup.download')}
        </button>
      </div>
    </hp-dialog>`;
  }

public _renderBackupImportDialog(): TemplateResult {
    type ContentItem = { kind?: string; url: string; state?: string };
    const d = this.host._backupImportDialog!;
    const p = d.preview;
    const decorContent = ((p?.content || []) as ContentItem[])
      .filter((item) => item.kind === 'decor_asset');
    const decorAssetCount = new Set(decorContent.map((item) => item.url)).size;
    const missingDecor = decorContent.filter((item) => item.state === 'missing_preserved');
    const missingDecorAssetCount = new Set(missingDecor.map((item) => item.url)).size;
    const counts = p?.counts || {};
    const draftMigration = p?.migration || {};
    const report = p?.reference_report || {};
    const sum = (values: any): number => Object.values(values || {}).reduce(
      (total: number, value: any) => total + (Number(value) || 0), 0,
    );
    const allReportRows: Array<[
      'incoming_remapped' | 'target_repaired' | 'preserved_unresolved'
      | 'collisions' | 'dropped_links' | 'bounded_lineages',
      number,
    ]> = [
      ['incoming_remapped', sum(report.remapped?.incoming)],
      ['target_repaired', sum(report.remapped?.target)],
      ['preserved_unresolved', sum(report.preservedUnresolved)],
      ['collisions', sum(report.collisions)],
      ['dropped_links', sum(report.droppedIncomingLinks)],
      ['bounded_lineages', Number(report.boundedLineages) || 0],
    ];
    const reportRows = allReportRows.filter(([, value]) => value > 0);
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('backup.import_title')}
      icon="mdi:upload" wide dismiss-on-scrim @hp-close=${() => (this.host._backupImportDialog = null)}>
      <div class="body backupbody" aria-busy=${d.busy ? 'true' : 'false'}>
        <div class="backupfile"><b>${d.filename}</b><span>${(d.size / 1024).toFixed(1)} KB</span></div>
        ${d.busy && !p ? html`<div class="rhint" role="status" aria-live="polite">${this.host._t('backup.reading')}</div>` : nothing}
        ${d.error ? html`<div class="backuperror" role="alert">${d.error}</div>` : nothing}
        ${p ? html`
          <div class="backupsummary">
            <b>${this.host._t(p.kind === 'full' ? 'backup.full' : 'backup.current_space')}</b>
            ${p.plan_only ? html`<span class="backupplanonlystatus">${this.host._t('backup.plan_only_preview')}</span>` : nothing}
            <span>${this.host._t(p.source === 'same' ? 'backup.same_source' : 'backup.foreign_source')}</span>
            <span>${this.host._t('backup.created', { value: p.created_at || '—' })}</span>
            <span>${this.host._t('backup.versions', {
              card: p.card_version || '—', integration: p.integration_version || '—',
              model: String(p.model_version ?? '—'),
            })}</span>
          </div>
          <div class="backupcounts">
            <span>${this.host._t('backup.count_spaces', { n: p.kind === 'full'
              ? `${p.current_counts?.spaces || 0} → ${counts.spaces || 0}` : String(counts.spaces || 0) })}</span>
            <span>${this.host._t('backup.count_rooms', { n: p.kind === 'full'
              ? `${p.current_counts?.rooms || 0} → ${counts.rooms || 0}` : String(counts.rooms || 0) })}</span>
            <span>${this.host._t('backup.count_walls', { n: p.kind === 'full'
              ? `${p.current_counts?.walls || 0} → ${counts.walls || 0}` : String(counts.walls || 0) })}</span>
            <span>${this.host._t('backup.count_openings', { n: p.kind === 'full'
              ? `${p.current_counts?.openings || 0} → ${counts.openings || 0}` : String(counts.openings || 0) })}</span>
            <span>${this.host._t('backup.count_decor', { n: p.kind === 'full'
              ? `${p.current_counts?.decor || 0} → ${counts.decor || 0}` : String(counts.decor || 0) })}</span>
            <span>${this.host._t('backup.count_markers', { n: p.kind === 'full'
              ? `${p.current_counts?.markers || 0} → ${counts.markers || 0}` : String(counts.markers || 0) })}</span>
            <span>${this.host._t('backup.count_layout', { n: p.kind === 'full'
              ? `${p.current_counts?.layout || 0} → ${counts.layout || 0}` : String(counts.layout || 0) })}</span>
          </div>
          ${p.bindings ? html`<div class="rhint">${this.host._t('backup.bindings', {
            device: String(p.bindings.device || 0), entity: String(p.bindings.entity || 0),
            virtual: String(p.bindings.virtual || 0), legacy: String(p.legacy_positions || 0),
          })}</div><div class="rhint">${this.host._t('backup.binding_status', {
            active: String(p.bindings.active || 0), disabled: String(p.bindings.disabled || 0),
            missing: String(p.bindings.missing || 0),
          })}</div>` : nothing}
          ${p.missing_areas?.length ? html`<div class="backupwarn">${this.host._t('backup.missing_areas', {
            areas: p.missing_areas.join(', '),
          })}</div>` : nothing}
          ${p.dropped_marker_links ? html`<div class="backupwarn">${this.host._t('backup.dropped_marker_links', {
            n: String(p.dropped_marker_links),
          })}</div>` : nothing}
          ${draftMigration.room_drafts || draftMigration.room_draft_segments ? html`
            <div class="rhint">${this.host._t('backup.room_drafts_migrated', {
              drafts: String(draftMigration.room_drafts || 0),
              segments: String(draftMigration.room_draft_segments || 0),
            })}</div>` : nothing}
          ${p.repaired_target_refs ? html`<div class="rhint">${this.host._t('backup.repaired_target_refs', {
            n: String(p.repaired_target_refs),
          })}</div>` : nothing}
          ${p.preserved_unresolved_refs ? html`
            <div class="backupwarn">${this.host._t('backup.preserved_unresolved_refs', {
              n: String(p.preserved_unresolved_refs),
            })}<br />${this.host._t('backup.preserved_unresolved_hint')}</div>
          ` : nothing}
          ${reportRows.length ? html`<details class="backupdetails">
            <summary>${this.host._t('backup.import_details')}</summary>
            <div>
              ${reportRows.map(([key, value]) => html`<span>${this.host._t(
                `backup.import_detail.${key}`, { n: String(value) },
              )}</span>`)}
              ${(report.examples || []).slice(0, 8).map((item) => html`
                <code>${item.owner} → ${item.reference}</code>
              `)}
            </div>
          </details>` : nothing}
          ${p.kind === 'full' ? html`
            <div class="backupwarn">${this.host._t('backup.replace_warning')}</div>
            ${p.source === 'foreign' ? html`<div class="rhint">${this.host._t('backup.foreign_bookkeeping')}</div>` : nothing}` : html`
            <div class="backupsummary"><b>${this.host._t('backup.final_name')}</b><span>${p.space_title}</span></div>
            <div class="rhint">${this.host._t('backup.target_settings')}</div>
            ${p.duplicates ? html`<fieldset class="backupchoices"><legend>${this.host._t('backup.duplicates', { n: String(p.duplicates) })}</legend>
              <label><input type="radio" name="duplicate-policy" .checked=${d.duplicatePolicy === 'skip'}
                @change=${() => this._setBackupDuplicatePolicy('skip')} />${this.host._t('backup.skip')}</label>
              <label><input type="radio" name="duplicate-policy" .checked=${d.duplicatePolicy === 'virtual'}
                @change=${() => this._setBackupDuplicatePolicy('virtual')} />${this.host._t('backup.virtual_copy')}</label>
            </fieldset>` : nothing}`}
          ${p.content?.length ? html`<div class="backupcontent">
            <b>${this.host._t('backup.content')}</b>
            ${decorContent.length ? html`<span>${this.host._t('backup.decor_images_summary', {
              assets: decorAssetCount, objects: decorContent.length,
              missing: missingDecorAssetCount,
            })}</span>` : nothing}
            ${(p.content as ContentItem[]).filter((item) => item.kind !== 'decor_asset').map((item) => html`<span>${item.url} · ${this.host._t(
              item.state === 'available' ? 'backup.content_available'
                : item.state === 'external' ? 'backup.content_external'
                  : 'backup.content_detach_required',
            )}</span>`)}
          </div>` : nothing}
          ${p.confirmation_required ? html`<label class="srcrow backupconfirm">
            <input type="checkbox" .checked=${d.confirmMissing}
              @change=${(e: Event) => (this.host._backupImportDialog = { ...d, confirmMissing: (e.target as HTMLInputElement).checked })} />
            <span>${this.host._t(missingDecor.length
              ? 'backup.confirm_missing_images' : 'backup.confirm_detach')}</span>
          </label>` : nothing}
        ` : nothing}
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" autofocus @click=${() => (this.host._backupImportDialog = null)}>${this.host._t('btn.cancel')}</button>
        <span class="spacer"></span>
        ${p ? html`<button class="btn ${p.kind === 'full' ? 'danger' : 'on'}"
          ?disabled=${d.busy || (p.confirmation_required && !d.confirmMissing)} @click=${() => this._applyBackupImport()}>
          <ha-icon icon=${p.kind === 'full' ? 'mdi:database-import' : 'mdi:plus'}></ha-icon>
          ${d.busy ? '…' : this.host._t(p.kind === 'full' ? 'backup.replace' : 'backup.add')}
        </button>` : nothing}
      </div>
    </hp-dialog>`;
  }

public _setFillColor(key: keyof FillColors, patch: Partial<{ c: string; a: number }>): void {
    const d = this.host._settingsDialog!;
    this.host._settingsDialog = { ...d, colors: { ...d.colors, [key]: { ...d.colors[key], ...patch } } };
  }

/** #377: every UI change of the session default style flows through here —
 * the style updates instantly, the persist is debounced so a palette drag
 * produces one config write. */
public _updateDecorStyle(next: DecorStyle): void {
    this.host._decorStyle = next;
    if (this._decorStylePersistTimer !== null) window.clearTimeout(this._decorStylePersistTimer);
    this._decorStylePersistTimer = window.setTimeout(() => {
      this._decorStylePersistTimer = null;
      this._persistDecorStyle();
    }, 1000);
  }

  private _decorStylePersistTimer: number | null = null;

  /** #377: mirror the current default style into settings.decor_default_style.
   * The default itself is stored as the ABSENCE of the key; a no-op diff does
   * not touch the store. Uses the ordinary serialized write path (expected_rev). */
  private _persistDecorStyle(): void {
    const cfg = this.host._serverCfg;
    if (!cfg) return;
    const patch = decorStyleToSettings(this.host._decorStyle);
    const settings: Record<string, unknown> = { ...(cfg.settings as object) };
    const before = JSON.stringify(settings.decor_default_style ?? null);
    if (patch) settings.decor_default_style = patch;
    else delete settings.decor_default_style;
    if (JSON.stringify(settings.decor_default_style ?? null) === before) return;
    this.host._serverCfg = { ...cfg, settings } as typeof cfg;
    this._saveConfig();
  }

  public async _saveSettingsDialog(): Promise<void> {
    const d = this.host._settingsDialog;
    if (!d || d.busy) return;
    this.host._settingsDialog = { ...d, busy: true };
    let attempt: OptimisticAttempt<ServerConfig> | null = null;
    try {
      const cfg = this.host._serverCfg!;
      const isDefault = JSON.stringify(d.colors) === JSON.stringify(DEFAULT_FILL_COLORS);
      let settings: ServerConfig['settings'] & Record<string, unknown> = { ...cfg.settings };
      if (isDefault) delete settings.fill_colors;
      else settings.fill_colors = d.colors;
      const cm = this.host._imperial ? d.glowRadius * 30.48 : d.glowRadius * 100;
      if (Number.isFinite(cm) && cm > 0 && Math.round(cm) !== 300) settings.glow_radius_cm = Math.round(cm);
      else delete settings.glow_radius_cm;
      if (d.bgColor) settings.bg_color = d.bgColor;
      else delete settings.bg_color;
      // Legacy absence means static; new installations/spaces materialise daynight.
      if (d.northDeg !== null && Number.isInteger(d.northDeg) && d.northDeg >= 0 && d.northDeg <= 359)
        settings.north_deg = d.northDeg;
      else delete settings.north_deg;
      settings.bg_mode = d.bgMode;
      if (d.sunRays) settings.sun_rays = true;
      else delete settings.sun_rays;
      if (d.showRoomTooltip) delete settings.show_room_tooltip;
      else settings.show_room_tooltip = false; settings = writeZigbeeTopologySettings(settings, d.zigbeeTopology);
      // Old configs may still contain this accepted field, but weather no
      // longer affects sunlight; saving general settings cleans it up.
      delete settings.weather_entity;
      const nextConfig = { ...cfg, settings };
      attempt = optimisticAttempt(cfg, nextConfig, this.host._cfgContentFingerprint,
        this.host._cfgRev, contentFingerprint);
      this.host._serverCfg = nextConfig;
      await this._saveConfigNow(attempt);
      if (!d.showRoomTooltip && this.host._tip?.room) this.host._tip = null;
      this.host._settingsDialog = null;
      this.host.requestUpdate();
      this.host._showToast(this.host._t('gs.saved'));
    } catch (e: any) {
      // Esc may close the dialog in flight; the toast must still fire (audit L3).
      // Never overwrite an authoritative conflict reload or newer edit (#439).
      if (attempt) rollbackOptimistic(this.host, attempt, contentFingerprint);
      if (this.host._settingsDialog) this.host._settingsDialog = { ...this.host._settingsDialog, busy: false };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    }
  }

public _boolInput(checked: boolean, onChange: (v: boolean) => void, disabled = false): TemplateResult {
    const h = (e: Event) => onChange(!!(e.target as HTMLInputElement).checked);
    return customElements.get('ha-switch')
      ? html`<ha-switch .checked=${checked} .disabled=${disabled} @change=${h}></ha-switch>`
      : html`<input type="checkbox" .checked=${checked} ?disabled=${disabled} @change=${h} />`;
  }

public _rangeInput(
    min: number, max: number, step: number, value: number,
    onInput: (v: number) => void, disabled = false, ariaLabel?: string,
  ): TemplateResult {
    const h = (e: Event) => {
      const n = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(n)) onInput(n);
    };
    return customElements.get('ha-slider')
      ? html`<ha-slider .min=${min} .max=${max} .step=${step} .value=${value}
          .disabled=${disabled} aria-label=${ariaLabel || nothing} @input=${h} @change=${h}></ha-slider>`
      : html`<input type="range" min=${min} max=${max} step=${step} .value=${String(value)}
          ?disabled=${disabled} aria-label=${ariaLabel || nothing} @input=${h} />`;
  }

public _renderColorRow(key: keyof FillColors, labelKey: string): TemplateResult {
    const d = this.host._settingsDialog!;
    const v = d.colors[key];
    return html`<div class="colorrow gsrow">
      <hp-color-opacity .label=${this.host._t(labelKey as any)}
        .opacityLabel=${this.host._t('space.opacity')}
        .pickerLabels=${this.host._colorPickerLabels}
        .color=${v.c} .opacity=${v.a} .showOpacity=${true}
        @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
          this._setFillColor(key, { c: e.detail.color, a: e.detail.opacity });
        }}></hp-color-opacity>
    </div>`;
  }

public _renderAlignDialog(): TemplateResult {
    const d = this.host._alignDialog!;
    const r = d.report;
    const failed = d.changed && !d.preflight?.ok;
    const failures = d.preflight?.failures || [];
    const visibleNames = failures.slice(0, 3).map((failure) => failure.displayName);
    const spaces = visibleNames.length
      ? visibleNames.join(', ')
      : this.host._t('gs.align_preflight_space', { n: '1' });
    const remaining = Math.max(0, failures.length - visibleNames.length);
    const more = remaining
      ? this.host._t('gs.align_preflight_more', { n: String(remaining) })
      : '';
    const repaired = r.spaceRefsRemapped + r.roomRefsRemapped
      + r.positionsRemapped + r.markersDetached;
    const modelMaintenance = r.migrated + r.canonicalized + r.coordsCanonicalized
      + r.wallSegmentsMigrated
      + r.roomDraftsMigrated + r.roomDraftSegmentsMigrated
      + r.wallsMerged + r.spansMerged + r.partitionsMerged
      + r.partitionsReconciled + r.openingsRehosted;
    const gridWarning = r.moved + r.rotated + r.coordsCanonicalized + r.wallsStraightened;
    const straightenCm = Math.ceil(r.maxStraightenShiftCm * 10) / 10;
    const straightenSpace = (this.host._serverCfg?.spaces || []).find(
      (space) => String(space?.id || '') === r.maxStraightenSpace,
    );
    const straightenWhere = (this.host._serverCfg?.spaces || []).length > 1 && straightenSpace
      ? String(straightenSpace.title || straightenSpace.id) : '';
    const removed = r.orphanRoomLabelsRemoved + r.orphanDevicePositionsRemoved
      + r.orphanGroupPositionsRemoved;
    const liveNames = r.liveMissingPositions.map((item) => item.name).filter(Boolean);
    const visibleLiveNames = liveNames.slice(0, 3).join(', ');
    const remainingLiveNames = Math.max(0, liveNames.length - 3);
    const liveNamesText = visibleLiveNames
      ? this.host._t('gs.optimize_live_names', {
          names: visibleLiveNames,
          more: remainingLiveNames
            ? this.host._t('gs.optimize_reference_more', { n: String(remainingLiveNames) }) : '',
        })
      : '';
    const registryLimited = r.unverifiedPositions.some(
      (item) => item.reason === 'registry_unavailable',
    );
    const detailStatus = (item: typeof r.removedPositions[number]): string => {
      if (r.removedPositions.some((removedItem) => removedItem.id === item.id)) {
        return this.host._t('gs.optimize_detail_removed');
      }
      if (r.liveMissingPositions.some((liveItem) => liveItem.id === item.id)) {
        return this.host._t('gs.optimize_detail_live');
      }
      return this.host._t('gs.optimize_detail_unverified');
    };
    const detailKind = (kind: typeof r.removedPositions[number]['kind']): string => this.host._t(
      kind === 'room_label' ? 'gs.optimize_detail_room_label'
        : kind === 'group' ? 'gs.optimize_detail_group'
        : kind === 'device' ? 'gs.optimize_detail_device'
        : 'gs.optimize_detail_unknown',
    );
    const referenceDetails = [
      ...r.removedPositions,
      ...r.liveMissingPositions.filter((item) => (
        !r.removedPositions.some((removedItem) => removedItem.id === item.id)
      )),
      ...r.unverifiedPositions,
    ];
    const visibleDetails = referenceDetails.slice(0, 10);
    const remainingDetails = Math.max(0, referenceDetails.length - visibleDetails.length);
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('gs.align_title')} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${() => { this.host._alignDialog = null; this.host._preflightClipboardFallback = null; }}>
        <div class="body">
          ${failed
            ? html`
              <p class="alignmsg">${this.host._t('gs.align_preflight_failed', { spaces, more })}</p>
              ${failures.slice(0, 10).map((failure) => html`<p class="alignmsg">
                ${failure.displayName}: ${this.host._t(`gs.preflight_reason_${failure.reason}` as I18nKey)}
              </p>`)}
              ${failures.length > 10 ? html`<p class="alignmsg">
                ${this.host._t('gs.align_preflight_more', { n: String(failures.length - 10) })}
              </p>` : nothing}
              <div class="rhint">${this.host._t('gs.align_preflight_hint')}</div>
              ${this._preflightVersionsDiffer() ? html`
                <div class="rhint">${this.host._t('gs.preflight_update_hint')}</div>` : nothing}
              <div class="row">
                <button class="btn ghost" @click=${() => this._copyPreflightDiagnostics()}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>
                  ${this.host._t('gs.preflight_copy')}
                </button>
              </div>
              ${this.host._preflightClipboardFallback ? html`<details open>
                <summary>${this.host._t('gs.preflight_copy')}</summary>
                <pre style="user-select:text;white-space:pre-wrap">${this.host._preflightClipboardFallback}</pre>
              </details>` : nothing}`
            : !d.changed
            ? html`<p class="alignmsg">${this.host._t(
                r.liveMissingPositions.length || r.unverifiedPositions.length
                  || r.nestedRefsUnresolved
                  ? 'gs.optimize_no_automatic_changes' : 'gs.align_none',
              )}</p>`
            : html`
              ${r.moved ? html`<p class="alignmsg">${this.host._t('gs.align_count', {
                  n: String(r.moved), total: String(r.total), cm: String(d.cm),
                })}</p>` : nothing}
              ${r.latticeCoordinatesCanonicalized ? html`
                <p class="alignmsg">${this.host._t('gs.optimize_lattice_summary', {
                  n: String(r.latticeCoordinatesCanonicalized),
                  cm: formatLatticeShiftCm(r.latticeMaxShiftCm),
                })}</p>
                ${r.latticeSpaces.map((space) => html`<p class="alignmsg">${this.host._t(
                  'gs.optimize_lattice_space', {
                    space: space.space,
                    n: String(space.canonicalized),
                    far: String(space.far),
                  },
                )}</p>`)}
              ` : nothing}
              ${d.where
                ? html`<p class="alignmsg">${this.host._t('gs.align_where', { s: d.where })}</p>`
                : nothing}
              ${r.rotated
                ? html`<p class="alignmsg">${this.host._t('gs.align_turned', { n: String(r.rotated) })}</p>`
                : nothing}
              ${r.wallSegmentsMigrated ? html`<p class="alignmsg">${this.host._t(
                  'gs.wall_segments_migrated', { n: String(r.wallSegmentsMigrated) },
                )}</p>` : nothing}
              ${r.roomDraftsMigrated || r.roomDraftSegmentsMigrated ? html`
                <p class="alignmsg">${this.host._t('gs.room_drafts_migrated', {
                  drafts: String(r.roomDraftsMigrated),
                  segments: String(r.roomDraftSegmentsMigrated),
                })}</p>` : nothing}
              ${r.legacyZeroWallsMigrated ? html`<p class="alignmsg">${this.host._t(
                  'gs.zero_walls_migrated', { n: String(r.legacyZeroWallsMigrated) },
                )}</p>` : nothing}
              ${modelMaintenance ? html`<p class="alignmsg">${this.host._t('gs.optimize_changes', {
                  m: String(r.migrated), c: String(r.canonicalized),
                  p: String(r.coordsCanonicalized), w: String(r.wallsMerged),
                  s: String(r.spansMerged), i: String(r.partitionsMerged),
                })}</p>` : nothing}
              ${r.partitionsReconciled ? html`<p class="alignmsg">${this.host._t(
                  'gs.optimize_coincident_partitions', { n: String(r.partitionsReconciled) },
                )}</p>` : nothing}
              ${r.openingsRehosted ? html`<p class="alignmsg">${this.host._t(
                  'gs.optimize_openings_rehosted', { n: String(r.openingsRehosted) },
                )}</p>` : nothing}
              ${r.wallsStraightened ? html`<p class="alignmsg">${this.host._t(
                  'gs.optimize_walls_straightened', {
                    n: String(r.wallsStraightened), cm: String(straightenCm),
                  },
                )}</p>` : nothing}
              ${straightenWhere ? html`<p class="alignmsg">${this.host._t(
                  'gs.optimize_walls_straightened_where', { s: straightenWhere },
                )}</p>` : nothing}
              ${r.glowSpacesMigrated || r.glowRoomsMigrated
                ? html`<p class="alignmsg">${this.host._t('gs.optimize_glow_migration', {
                    spaces: String(r.glowSpacesMigrated),
                    rooms: String(r.glowRoomsMigrated),
                  })}</p>`
                : nothing}
              ${gridWarning ? html`<div class="rhint">${this.host._t('gs.align_warn')}</div>` : nothing}`}
          ${!failed && r.wallsStraightenSkipped ? html`<p class="rhint">${this.host._t(
              'gs.optimize_walls_straighten_skipped', {
                n: String(r.wallsStraightenSkipped),
              },
            )}</p>` : nothing}
          ${repaired
            ? html`<p class="alignmsg">${this.host._t('gs.optimize_references', {
                spaces: String(r.spaceRefsRemapped), rooms: String(r.roomRefsRemapped),
                positions: String(r.positionsRemapped), detached: String(r.markersDetached),
              })}</p>`
            : nothing}
          ${removed
            ? html`<p class="alignmsg">${this.host._t('gs.optimize_orphans_removed', {
                total: String(removed),
                rooms: String(r.orphanRoomLabelsRemoved),
                devices: String(r.orphanDevicePositionsRemoved),
                groups: String(r.orphanGroupPositionsRemoved),
              })}</p>`
            : nothing}
          ${r.liveMissingPositions.length
            ? html`<div class="optimize-live">
                <p class="alignmsg">${this.host._t(d.removeLiveMissingPositions
                  ? 'gs.optimize_live_positions_remove' : 'gs.optimize_live_positions', {
                  n: String(r.liveMissingPositions.length), names: liveNamesText,
                })}</p>
                <button class="btn ghost optimize-cleanup" type="button"
                  aria-pressed=${d.removeLiveMissingPositions ? 'true' : 'false'}
                  @click=${() => this._toggleOptimizeLivePositions()} ?disabled=${d.busy}>
                  <ha-icon icon=${d.removeLiveMissingPositions ? 'mdi:undo' : 'mdi:map-marker-remove-outline'}></ha-icon>
                  ${this.host._t(d.removeLiveMissingPositions
                    ? 'gs.optimize_live_keep' : 'gs.optimize_live_remove')}
                </button>
                ${d.removeLiveMissingPositions
                  ? html`<div class="rhint optimize-selected" role="status">
                      ${this.host._t('gs.optimize_live_selected')}
                    </div>`
                  : nothing}
              </div>`
            : nothing}
          ${r.unverifiedPositions.length
            ? html`<div class="rhint" role="alert">
                ${this.host._t('gs.optimize_unverified', {
                  n: String(r.unverifiedPositions.length),
                })}
                ${registryLimited ? ` ${this.host._t('gs.optimize_registry_limited')}` : ''}
              </div>`
            : nothing}
          ${r.nestedRefsUnresolved
            ? html`<div class="rhint" role="alert">${this.host._t('gs.optimize_vacuum_warning', {
                n: String(r.nestedRefsUnresolved),
              })}</div>`
            : nothing}
          ${referenceDetails.length
            ? html`<details class="optimize-details">
                <summary>${this.host._t('gs.optimize_details')}</summary>
                <ul>
                  ${visibleDetails.map((item) => html`<li>${this.host._t('gs.optimize_detail_item', {
                    status: detailStatus(item), kind: detailKind(item.kind),
                    id: item.id, space: item.spaceId,
                  })}</li>`)}
                </ul>
                ${remainingDetails
                  ? html`<div class="rhint">${this.host._t('gs.optimize_details_more', {
                      n: String(remainingDetails),
                    })}</div>`
                  : nothing}
              </details>`
            : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => { this.host._alignDialog = null; this.host._preflightClipboardFallback = null; }}>${this.host._t('btn.cancel')}</button>
          ${!d.changed || !d.preflight?.ok ? nothing : html`
            <button class="btn on" @click=${() => this._runAlignToGrid()} ?disabled=${d.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.host._t('gs.align_run')}
            </button>`}
        </div>
    </hp-dialog>`;
  }

public _renderSettingsDialog(): TemplateResult {
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('gs.title')} icon="mdi:cog-outline" wide
      @hp-close=${() => (this.host._settingsDialog = null)}>
        <div class="body">
          <div class="rhint">${supportT(
            langOf(this.host.hass, this.host._config?.language), 'gs.hint',
          )}</div>
          <label class="srcrow">
            ${this._boolInput(this.host._settingsDialog!.showRoomTooltip, (v) =>
              (this.host._settingsDialog = { ...this.host._settingsDialog!, showRoomTooltip: v }))}
            <span>${supportT(
              langOf(this.host.hass, this.host._config?.language), 'gs.show_room_tooltip',
            )}</span>
          </label><hp-zigbee-topology-settings .hass=${this.host.hass} .value=${this.host._settingsDialog!.zigbeeTopology} .savedEnabled=${zigbeeTopologySettingsOf(this.host._settings).enabled} .devices=${this.host._devices} .registry=${this.host._haRegistry} @hp-topology-settings-change=${(event: CustomEvent<ZigbeeTopologySettings>) => (this.host._settingsDialog = { ...this.host._settingsDialog!, zigbeeTopology: event.detail })}></hp-zigbee-topology-settings>
          <label class="dispsection">${this.host._t('gs.light_group')}</label>
          ${this._renderColorRow('light_on', 'gs.light_on')}
          ${this._renderColorRow('light_off', 'gs.light_off')}
          ${this._renderColorRow('light_none', 'gs.light_none')}
          <label class="dispsection">${this.host._t('gs.temp_group')}</label>
          ${this._renderColorRow('temp_cold', 'gs.temp_cold')}
          ${this._renderColorRow('temp_ok', 'gs.temp_ok')}
          ${this._renderColorRow('temp_hot', 'gs.temp_hot')}
          <label class="dispsection">${this.host._t('gs.lqi_group')}</label>
          ${this._renderColorRow('lqi_low', 'gs.lqi_low')}
          ${this._renderColorRow('lqi_high', 'gs.lqi_high')}
          <label class="dispsection">${this.host._t('gs.glow_group')}</label>
          ${this._renderColorRow('glow_base', 'gs.glow_base')}
          ${this._renderColorRow('glow_light', 'gs.glow_light')}
          <div class="colorrow gsrow">
            <span class="gsl help-inline-label"><label for="gs-glow-radius">${this.host._t('gs.glow_radius')}</label>
              ${this._help('gs.glow_radius.help')}</span>
            <input id="gs-glow-radius" type="number" class="tempin" min="0.5" step="0.5"
              .value=${String(this.host._settingsDialog!.glowRadius)}
              @input=${(e: Event) => {
                const v = strictNumber((e.target as HTMLInputElement).value);
                if (v != null && v > 0)
                  this.host._settingsDialog = { ...this.host._settingsDialog!, glowRadius: v };
              }} />
            <span class="opl">${this.host._imperial ? this.host._t('gs.unit_ft') : this.host._t('gs.unit_m')}</span>
          </div>
          <label class="dispsection">${this.host._t('gs.wall_group')}</label>
          ${this._renderColorRow('wall_fill', 'gs.wall_fill')}
          <label class="dispsection">${this.host._t('gs.bg_group')}</label>
          <div class="colorrow gsrow">
            <span class="gsl help-inline-label"><label for="gs-bg-mode">${this.host._t('gs.bg_mode')}</label>
              ${this._help('gs.bg_mode.help')}</span>
            <select id="gs-bg-mode" class="areasel"
              @change=${(e: Event) =>
                (this.host._settingsDialog = { ...this.host._settingsDialog!, bgMode: (e.target as HTMLSelectElement).value === 'daynight' ? 'daynight' : 'static' })}>
              <option value="static" ?selected=${this.host._settingsDialog!.bgMode === 'static'}>${this.host._t('gs.bg_static')}</option>
              <option value="daynight" ?selected=${this.host._settingsDialog!.bgMode === 'daynight'}>${this.host._t('gs.bg_daynight')}</option>
            </select>
          </div>
          ${this.host._settingsDialog!.bgMode === 'static'
            ? html`<div class="colorrow gsrow">
                <hp-color-opacity .label=${this.host._t('gs.bg_color')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${this.host._settingsDialog!.bgColor || this.host._stageBgHex()}
                  .opacity=${1} .showOpacity=${false}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                    this.host._settingsDialog = { ...this.host._settingsDialog!, bgColor: e.detail.color };
                  }}></hp-color-opacity>
                ${this.host._settingsDialog!.bgColor
                  ? html`<button class="btn ghost" @click=${() =>
                      (this.host._settingsDialog = { ...this.host._settingsDialog!, bgColor: null })}>${this.host._t('gs.bg_default')}</button>`
                  : html`<span class="opl">${this.host._t('gs.bg_theme')}</span>`}
              </div>`
            : nothing}
          <label class="dispsection">${this.host._t('gs.sun_group')}</label>
          ${!sunStateOf(this.host.hass)
            ? html`<div class="rhint">${this.host._t('gs.sun_missing')}</div>`
            : nothing}
          <div class="sunrow">
            ${this.host._renderCompass()}
            <div class="suncol">
              <div class="helpfieldlabel compact">
                <label for="gs-north">${this.host._t('gs.north')}</label>
                ${this._help('gs.north.help')}
              </div>
              <div class="colorrow">
                <input id="gs-north" class="namein tempin" type="number" min="0" max="359" step="1"
                  placeholder=${this.host._t('gs.north_ph')}
                  .value=${this.host._settingsDialog!.northDeg === null ? '' : String(this.host._settingsDialog!.northDeg)}
                  @input=${(e: Event) => {
                    const raw = (e.target as HTMLInputElement).value.trim();
                    const n = raw === '' ? null : Math.round(Number(raw));
                    this.host._settingsDialog = {
                      ...this.host._settingsDialog!,
                      northDeg: n !== null && Number.isFinite(n) ? Math.min(359, Math.max(0, n)) : null,
                    };
                  }} />
                ${this.host._settingsDialog!.northDeg !== null
                  ? html`<button class="btn ghost" @click=${() =>
                      (this.host._settingsDialog = { ...this.host._settingsDialog!, northDeg: null })}>${this.host._t('gs.north_clear')}</button>`
                  : nothing}
              </div>
            </div>
          </div>
          <label class="srcrow">
            ${this._boolInput(this.host._settingsDialog!.sunRays, (v) =>
              (this.host._settingsDialog = { ...this.host._settingsDialog!, sunRays: v }))}
            <span>${this.host._t('gs.sun_rays')}</span>
          </label>
          ${this.host._canEdit ? html`
            <label class="dispsection">${this.host._t('gs.backup_group')}</label>
            <div class="rhint">${this.host._t('gs.backup_hint')}</div>
            <div class="backupactions">
              <button class="btn ghost" @click=${() => this._openBackupExport()}>
                <ha-icon icon="mdi:download"></ha-icon>${this.host._t('backup.export_open')}
              </button>
              <span class="backupupload">
                <button class="btn ghost" type="button" @click=${(e: Event) =>
                  ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                  <ha-icon icon="mdi:upload"></ha-icon>${this.host._t('backup.import_open')}
                </button>
                <input type="file" accept="application/json,.json" @change=${(event: Event) => this._pickBackupImport(event)} />
              </span>
              ${this.host._canOptimizeUndo && this.host._undoKind === 'import' ? html`
                <button class="btn ghost" @click=${() => this._undoPlanOptimization()}
                  ?disabled=${this.host._optimizeUndoBusy}>
                  <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t('backup.undo_import')}
                </button>` : nothing}
            </div>` : nothing}
          <label class="dispsection">${this.host._t('gs.grid_group')}</label>
          <div class="rhint">${this.host._t('gs.grid_hint')}</div>
          <div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${() => this._openAlignDialog()}>
              <ha-icon icon="mdi:broom"></ha-icon>${this.host._t('gs.align_all')}
            </button>
          </div>
          ${this.host._canOptimizeUndo && this.host._undoKind !== 'import' ? html`<div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${() => this._undoPlanOptimization()}
              ?disabled=${this.host._optimizeUndoBusy}>
              <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t('gs.optimize_undo')}
            </button>
          </div>` : nothing}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() =>
            (this.host._settingsDialog = { ...this.host._settingsDialog!, colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: this.host._imperial ? 9.8 : 3, bgColor: null, northDeg: null, bgMode: 'daynight', sunRays: false, showRoomTooltip: true, zigbeeTopology: { enabled: false, z2mBaseTopics: [] } })}>
            ${this.host._t('gs.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this.host._settingsDialog = null)}>${this.host._t('btn.cancel')}</button>
          <button class="btn on" @click=${() => this._saveSettingsDialog()} ?disabled=${this.host._settingsDialog!.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this.host._settingsDialog!.busy ? '…' : this.host._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

public _openRulesDialog = (): void => {
    if (!this.host._norm) return;
    const custom = this.host._settings.icon_rules;
    const rules = (custom && custom.length ? custom : DEFAULT_ICON_RULES).map((r) => ({ ...r }));
    this.host._rulesDialog = { rules, test: '', busy: false };
  };

public _rulesSet(rules: IconRule[]): void {
    this.host._rulesDialog = { ...this.host._rulesDialog!, rules };
  }

public async _saveRules(): Promise<void> {
    const dlg = this.host._rulesDialog;
    if (!dlg || dlg.busy) return;
    const cleaned = dlg.rules.filter((r) => r.pattern.trim() && r.icon.trim());
    this.host._rulesDialog = { ...dlg, busy: true };
    try {
      const cfg = this.host._serverCfg!;
      const isDefault = JSON.stringify(cleaned) === JSON.stringify(DEFAULT_ICON_RULES);
      const settings: any = { ...cfg.settings };
      if (isDefault) delete settings.icon_rules;
      else settings.icon_rules = cleaned;
      this.host._serverCfg = { ...cfg, settings };
      await this._saveConfigNow();
      this.host._rulesDialog = null;
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._showToast(this.host._t('rules.saved'));
    } catch (e: any) {
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (this.host._rulesDialog) this.host._rulesDialog = { ...this.host._rulesDialog, busy: false };
      this.host._showToast(this.host._t('toast.error', { err: this.host._errText(e) }));
    }
  }

public _renderRulesDialog(): TemplateResult {
    const d = this.host._rulesDialog!;
    const compiled = compileIconRules(d.rules);
    const testIcon = d.test.trim() ? iconFor(d.test, '', compiled) : null;
    const move = (i: number, delta: number) => {
      const r = [...d.rules];
      const j = i + delta;
      if (j < 0 || j >= r.length) return;
      [r[i], r[j]] = [r[j], r[i]];
      this._rulesSet(r);
    };
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('rules.title')}
      icon="mdi:shape-plus-outline" wide @hp-close=${() => (this.host._rulesDialog = null)}>
        <div class="body">
          <div class="rhint">${this.host._t('rules.hint')}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this.host._t('rules.test_ph')}
              .value=${d.test}
              @input=${(e: Event) => (this.host._rulesDialog = { ...d, test: (e.target as HTMLInputElement).value })} />
            ${testIcon ? html`<ha-icon icon=${testIcon}></ha-icon><span class="rtesticon">${testIcon}</span>` : nothing}
          </div>
          ${d.rules.map((r, i) => {
            const bad = r.pattern.trim() !== '' && !isValidPattern(r.pattern);
            return html`<div class="rrow">
              <input class="namein rpat ${bad ? 'bad' : ''}" type="text"
                placeholder=${this.host._t('rules.pattern_ph')}
                title=${bad ? this.host._t('rules.invalid') : ''}
                .value=${r.pattern}
                @input=${(e: Event) => {
                  const rules = [...d.rules];
                  rules[i] = { ...r, pattern: (e.target as HTMLInputElement).value };
                  this._rulesSet(rules);
                }} />
              <input class="namein ricon" type="text" placeholder=${this.host._t('rules.icon_ph')}
                .value=${r.icon}
                @input=${(e: Event) => {
                  const rules = [...d.rules];
                  rules[i] = { ...r, icon: (e.target as HTMLInputElement).value };
                  this._rulesSet(rules);
                }} />
              <ha-icon class="rprev" icon=${r.icon || 'mdi:chip'}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-up" title=${this.host._t('btn.up')}
                @click=${() => move(i, -1)}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-down" title=${this.host._t('btn.down')}
                @click=${() => move(i, 1)}></ha-icon>
              <ha-icon class="ract del" icon="mdi:close" title=${this.host._t('btn.delete')}
                @click=${() => this._rulesSet(d.rules.filter((_, j) => j !== i))}></ha-icon>
            </div>`;
          })}
          <button class="btn ghost" @click=${() => this._rulesSet([...d.rules, { pattern: '', icon: '' }])}>
            <ha-icon icon="mdi:plus"></ha-icon>${this.host._t('rules.add')}
          </button>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => this._rulesSet(DEFAULT_ICON_RULES.map((r) => ({ ...r })))}>
            ${this.host._t('rules.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this.host._rulesDialog = null)}>${this.host._t('btn.cancel')}</button>
          <button class="btn on" @click=${() => this._saveRules()} ?disabled=${d.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.host._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

public _saveKioskScale(patch: Partial<{ icon: number; font: number }>): void {
    this.host._kioskScale = { ...this.host._kioskScale, ...patch };
    try {
      localStorage.setItem(LS_KIOSK, JSON.stringify(this.host._kioskScale));
    } catch {
      /* ignore */
    }
    this.host.requestUpdate();
  }

public _renderKioskDialog(): TemplateResult {
    const k = this.host._kioskScale;
    const row = (key: 'icon' | 'font', label: string) => html`<label>${label}</label>
      <div class="colorrow">
        ${this._rangeInput(50, 300, 5, Math.round(k[key] * 100), (n) => this._saveKioskScale({ [key]: n / 100 }))}
        <span class="opv">${Math.round(k[key] * 100)}%</span>
      </div>`;
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('kiosk.title')} icon="mdi:tablet"
      dismiss-on-scrim @hp-close=${() => (this.host._kioskDialog = false)}>
        <div class="body">
          <div class="rhint">${this.host._t('kiosk.hint')}</div>
          ${row('icon', this.host._t('kiosk.icon_scale'))}
          ${row('font', this.host._t('kiosk.font_scale'))}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => this._saveKioskScale({ icon: 1, font: 1 })}>${this.host._t('gs.reset')}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => (this.host._kioskDialog = false)}>${this.host._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

public _renderVacSection(dlg: any): TemplateResult | typeof nothing {
    const dev = this.host._devices.find((x) => x.id === dlg.devId);
    if (!dev || !this.host._isVacDev(dev)) return nothing;
    const v = dev.marker?.vacuum || {};
    const includeAllCameras = this.host._vacAllCamerasFor === dev.id;
    const resolution = this.host._vacSourceResolution(dev, includeAllCameras);
    const src = resolution.entityId;
    const selected = resolution.candidates.find((candidate) => candidate.entityId === src) || null;
    const tele = src ? readVacTelemetry(this.host.hass?.states[src]?.attributes) : null;
    const canUseSource = v.live !== false
      && (resolution.status === 'ok' || resolution.status === 'unsupported');
    const planRooms = this._vacPlanRoomAnchors(dev.space);
    const roomMatches = tele
      ? vacRoomNameMatchCount(tele.rooms, planRooms.map((room) => room.name)) : 0;
    const tierA = !!(canUseSource && tele && roomMatches >= 3);
    const setVac = (patch: Record<string, unknown>) => {
      // HP-1540-01: materialise the marker first — find() alone silently
      // dropped every edit for a vacuum that had never been saved
      const m = this.host._vacEnsureMarker(dev);
      if (!m) return;
      m.vacuum = { ...(m.vacuum || {}), ...patch };
      this.host._regSignature = '';
      // First-use markers are materialised above, so the dialog must rebuild
      // immediately instead of waiting for an unrelated HA state tick.
      this.host._maybeRebuildDevices();
      this._saveConfig();
      this.host.requestUpdate();
    };
    const sameDevice = new Set(dev.entities || []);
    const primaryCandidates = resolution.candidates.filter((candidate) =>
      sameDevice.has(candidate.entityId) || candidate.entityId === v.source);
    const globalCandidates = includeAllCameras
      ? resolution.candidates.filter((candidate) => candidate.entityId.startsWith('camera.')
        && !primaryCandidates.some((entry) => entry.entityId === candidate.entityId))
      : [];
    const capability = (candidate: VacSourceCandidate) => [
      candidate.hasPosition ? this.host._t('vac.cap_position') : '',
      candidate.hasRooms ? this.host._t('vac.cap_rooms_short') : '',
      candidate.hasPath ? this.host._t('vac.cap_path') : '',
      candidate.hasMapId ? this.host._t('vac.cap_map') : '',
    ].filter(Boolean).join(' · ') || this.host._t('vac.cap_none');
    const candidateButton = (candidate: VacSourceCandidate) => html`
      <button type="button" class="vacsource ${candidate.entityId === src ? 'on' : ''}"
        @click=${() => setVac({ source: candidate.entityId })}>
        <span><b>${candidate.name}</b><small>${candidate.entityId}</small></span>
        <span class="vacsource-meta">${candidate.platform || this.host._t('vac.platform_unknown')} · ${capability(candidate)}</span>
      </button>`;
    const knownSameDeviceXcme = resolution.candidates.some((candidate) =>
      sameDevice.has(candidate.entityId) && candidate.category === 'known_xcme_incomplete');
    const showXcmeHint = knownSameDeviceXcme
      || (!!resolution.pinned && !!src?.startsWith('camera.') && !selected?.hasPosition);
    const openPicker = () => {
      const picker = [...this.host.renderRoot.querySelectorAll<HTMLDetailsElement>('details.vacpicker')]
        .find((details) => details.dataset.devId === dev.id);
      if (!picker) return;
      picker.open = true;
      picker.querySelector<HTMLElement>('summary')?.focus();
    };
    return html`
      <label>${this.host._t('vac.section')}</label>
      <div class="bindbox vacbox">
        <div class="vacdiag" role="status">
          <div><span>${this.host._t('vac.diag_source')}</span><b>${src || this.host._t('vac.source_none')}</b></div>
          ${selected?.platform ? html`<div><span>${this.host._t('vac.diag_platform')}</span><b>${selected.platform}</b></div>` : nothing}
          <div><span>${this.host._t('vac.diag_status')}</span><b>${this.host._t((`vac.source_status_${resolution.status}`) as any)}</b></div>
          <div><span>${this.host._t('vac.diag_position')}</span><b>${tele?.pos ? this.host._t('common.yes') : this.host._t('common.no')}</b></div>
          <div><span>${this.host._t('vac.diag_rooms')}</span><b>${subst(this.host._t('vac.diag_rooms_value'), {
            total: String(tele?.rooms.length || 0), matched: String(roomMatches),
            readiness: this.host._t(roomMatches >= 3 ? 'vac.autocal_ready' : 'vac.autocal_not_ready'),
          })}</b></div>
          <div><span>${this.host._t('vac.diag_path')}</span><b>${tele?.path.length ? this.host._t('common.yes') : this.host._t('common.no')}</b></div>
          <div><span>${this.host._t('vac.diag_map')}</span><b>${tele?.mapId ?? 'default'}</b></div>
        </div>
        ${(resolution.status === 'missing' || resolution.status === 'disabled' || resolution.status === 'unverified')
          ? html`<div class="warn vacsource-warning">
              <span>${this.host._t((`vac.source_banner_${resolution.status}`) as any)}</span>
              <button type="button" class="btn ghostbtn" @click=${openPicker}>${this.host._t('vac.choose_source')}</button>
            </div>` : nothing}
        ${showXcmeHint ? html`<div class="warn vacxcme">
          <b>${this.host._t('vac.xcme_hint')}</b>
          <pre>attributes:
  - vacuum_position
  - rooms
  - path
  - map_name</pre>
        </div>` : nothing}
        <details class="vacpicker" data-dev-id=${dev.id}>
          <summary class="btn ghostbtn">${this.host._t('vac.choose_source')}</summary>
          <div class="vacsource-list">
            <button type="button" class="vacsource ${!resolution.pinned ? 'on' : ''}"
              @click=${() => setVac({ source: null })}>
              <span><b>${this.host._t('vac.source_auto')}</b><small>${this.host._t('vac.source_auto_hint')}</small></span>
            </button>
            ${primaryCandidates.map(candidateButton)}
            <details ?open=${includeAllCameras}
              @toggle=${(event: Event) => {
                const open = (event.currentTarget as HTMLDetailsElement).open;
                if (open) this.host._vacOpenAllCameras(dev);
                else {
                  this.host._vacAllCamerasFor = null;
                  this.host._vacAllCameraCache = null;
                }
              }}>
              <summary>${this.host._t('vac.all_cameras')}</summary>
              <div class="rhint">${this.host._t('vac.all_cameras_warn')}</div>
              ${includeAllCameras
                ? (globalCandidates.length ? globalCandidates.map(candidateButton)
                  : html`<div class="rhint">${this.host._t('vac.all_cameras_empty')}</div>`)
                : nothing}
            </details>
          </div>
        </details>
        <div class="vacbtns">
          ${tierA ? html`<button class="btn" ?disabled=${this.host._markerDialog?.busy} @click=${() => this._vacAutoCalibrate(dev)}>${this.host._t('vac.autocal')}</button>` : nothing}
          ${canUseSource
            ? html`<button class="btn ghostbtn" ?disabled=${this.host._markerDialog?.busy} @click=${() => this._vacStartFit(dev)}>${this.host._t('vac.fit')}</button>`
            : nothing}
          <a class="btn ghostbtn" href="https://github.com/Matysh/houseplan-card/blob/main/docs/VACUUM.md"
            target="_blank" rel="noopener">${this.host._t('vac.documentation')}</a>
        </div>
        ${tele ? html`
          <label class="srcrow">
            ${this._boolInput(v.live !== false, (on) => setVac({ live: on ? null : false }))}
            <span>${this.host._t('vac.live')}</span>
          </label>
          <label>${this.host._t('vac.trail')}</label>
          <select class="areasel"
            @change=${(e: Event) => setVac({ trail_mode: (e.target as HTMLSelectElement).value, trail: null })}>
            ${(['never', 'cleaning', 'always'] as const).map((mv) => html`
              <option value=${mv} ?selected=${vacTrailMode(v) === mv}>${this.host._t(('vac.trail_' + mv) as any)}</option>`)}
          </select>
          ${renderVacuumMapsSection(this, dev, resolution)}
        ` : nothing}
      </div>`;
  }

public _vacMapId(d: DevItem, tele: { mapId: string }, planHass = this.host._planHass): string {
    // #358: the View card owns map-id resolution — it runs inside willUpdate
    // for every vacuum with telemetry on tabs that never load this runtime.
    return this.host._vacMapId(d, tele, planHass);
  }

public _vacSaveMatrix(
    markerId: string, source: string, mapId: string, matrix: Affine, routeId = '',
  ): Promise<boolean> {
    return saveVacuumMatrix(this, markerId, source, mapId, matrix, routeId);
  }

public _vacPlanRoomAnchors(spaceId: string | null | undefined): Array<{
    name: string; cx: number; cy: number;
  }> {
    return (this.host._spaceModelById(spaceId)?.rooms || [])
      // HP-1540-04: legacy rectangle rooms (x/y/w/h) are still first-class;
      // roomPoly() gives the same outline the renderer uses for them.
      .map((room) => ({ room, poly: roomPoly(room) }))
      .filter(({ room, poly }: any) => room.name && poly)
      .map(({ room, poly }: any) => {
        const centroid = areaCentroid(poly);
        return centroid ? { name: String(room.name), cx: centroid[0], cy: centroid[1] } : null;
      })
      .filter(Boolean) as Array<{ name: string; cx: number; cy: number }>;
  }

public async _vacAutoCalibrate(d: DevItem): Promise<void> {
    if (this.host._markerDialog?.busy) return;
    const src = this.host._vacSource(d);
    const tele = src ? readVacTelemetry(this.host.hass?.states[src]?.attributes) : null;
    if (!src || !tele || tele.rooms.length < 3) {
      this.host._showToast(this.host._t('vac.autocal_no_rooms'));
      return;
    }
    const mapId = this._vacMapId(d, tele);
    const target = calibrationTarget(d.id, d.marker?.vacuum ?? null, d.space, src, mapId);
    const res = autoCalibrate(tele.rooms, this._vacPlanRoomAnchors(target.space));
    if (!res) {
      this.host._showToast(this.host._t('vac.autocal_no_match'));
      return;
    }
    const rawSpace = this.host._serverCfg?.spaces?.find((space) => space.id === target.space);
    const rawCellCm = Number(rawSpace?.cell_cm);
    const cellCm = Number.isFinite(rawCellCm) && rawCellCm > 0 ? rawCellCm : 5;
    const residualCm = vacCalibrationResidualCm(res.residual, this.host._gridPitch, cellCm);
    if (residualCm > VAC_CALIBRATION_WARN_CM) {
      this.host._vacCalConfirm = {
        markerId: d.id, source: src, mapId, routeId: target.routeId, space: target.space, matrix: res.matrix,
        rooms: res.matched.length,
        error: formatLength(residualCm, this.host.hass?.config?.unit_system?.length === 'mi'),
      };
      return;
    }
    await saveAutomaticCalibration(this, {
      markerId: d.id, source: src, mapId, routeId: target.routeId, space: target.space,
      matrix: res.matrix, rooms: res.matched.length,
    });
  }

public _vacApplyCalibrationProposal(manual: boolean): Promise<void> {
    return applyCalibrationProposal(this, manual);
  }

public _vacStartFit(d: DevItem, routeId = ''): void {
    if (this.host._markerDialog?.busy) return;
    const src = this.host._vacSource(d);
    const tele = src ? readVacTelemetry(this.host.hass?.states[src]?.attributes) : null;
    if (!src || !tele) {
      this.host._showToast(this.host._t('vac.cal_need_pos'));
      return;
    }
    const mapId = this._vacMapId(d, tele);
    const plan = planVacuumFit(d.id, d.marker?.vacuum ?? null, {
      routeId, source: src, mapId, dockSpace: d.space, rooms: tele.rooms,
      viewBoxOf: (id) => (this.host._spaceModelById(id)?.vb as [number, number, number, number]) ?? null,
    });
    if (!plan) return;
    this.host._markerDialog = null;
    if (plan.space !== this.host._space && !this.host._commitSpace(plan.space)) return;
    this.host._vacFit = { markerId: d.id, source: src, mapId, routeId: plan.routeId, p: plan.params, drag: null };
  }

public _vacFitSave(): Promise<void> {
    return saveManualCalibration(this, fitMatrix);
  }

public _vacFitTurn(patch: Partial<FitParams>): void {
    const f = this.host._vacFit;
    if (!f || f.busy) return;
    const tele = readVacTelemetry(this.host.hass?.states[f.source]?.attributes);
    const c = this._vacGhostCentre(tele?.rooms || []);
    const next = { ...f.p, ...patch } as FitParams;
    this.host._vacFit = { ...f, p: reanchorFit(next, f.p, c[0], c[1]) };
  }

public _vacGhostCentre(rooms: VacRoom[]): VacPt {
    const xs: number[] = [], ys: number[] = [];
    for (const r of rooms) {
      xs.push(r.x0 ?? r.cx, r.x1 ?? r.cx);
      ys.push(r.y0 ?? r.cy, r.y1 ?? r.cy);
    }
    if (!xs.length) return [0, 0];
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }

public _vacDelta(view: { w: number; h: number }, dxPx: number, dyPx: number): VacPt {
    const st = this.host._stageEl;
    const w = st?.clientWidth || 1, h = st?.clientHeight || 1;
    return [(dxPx / w) * view.w, (dyPx / h) * view.h];
  }

public _vacFitPointer(ev: PointerEvent, view: { x: number; y: number; w: number; h: number }): void {
    const f = this.host._vacFit;
    if (!f) return;
    ev.stopPropagation();
    if (f.busy) return;
    if (ev.type === 'pointerdown') {
      const t = ev.target as HTMLElement;
      const corner = t.getAttribute?.('data-corner');
      try {
        (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
      } catch { /* synthetic pointers (tests) have no active id — capture is a nicety */ }
      this.host._vacFit = { ...f, drag: corner
        ? { kind: 'scale', sx: ev.clientX, sy: ev.clientY, p0: { ...f.p },
            fx: Number(corner.split(',')[0]), fy: Number(corner.split(',')[1]) }
        : { kind: 'move', sx: ev.clientX, sy: ev.clientY, p0: { ...f.p }, fx: 0, fy: 0 } };
      return;
    }
    const d = f.drag;
    if (!d) return;
    if (ev.type === 'pointermove') {
      const [dx, dy] = this._vacDelta(view, ev.clientX - d.sx, ev.clientY - d.sy);
      if (d.kind === 'move') {
        this.host._vacFit = { ...f, p: { ...d.p0, ox: d.p0.ox + dx, oy: d.p0.oy + dy } };
      } else {
        // corner-stretch: uniform scale about the OPPOSITE corner (fx, fy —
        // the fixed corner in robot coords), like a graphics-editor frame
        const tele = readVacTelemetry(this.host.hass?.states[f.source]?.attributes);
        const c = this._vacGhostCentre(tele?.rooms || []);
        const m0 = fitMatrix(d.p0);
        const [gx, gy] = applyAffine(m0, c[0], c[1]);
        const [px0, py0] = applyAffine(m0, d.fx, d.fy);
        const span0 = Math.hypot(gx - px0, gy - py0) || 1;
        // distance change of the dragged corner (opposite of fixed) from centre
        const [cx0, cy0] = [2 * gx - px0, 2 * gy - py0];
        const span1 = Math.hypot(cx0 + dx * 2 - px0, cy0 + dy * 2 - py0) / 2;
        const k = Math.max(0.05, span1 / span0);
        const next = { ...d.p0, s: d.p0.s * k } as FitParams;
        this.host._vacFit = { ...f, p: reanchorFit(next, d.p0, d.fx, d.fy) };
      }
      return;
    }
    if (ev.type === 'pointerup' || ev.type === 'pointercancel') {
      this.host._vacFit = { ...f, drag: null };
    }
  }

public _renderVacFit(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const f = this.host._vacFit;
    if (!f) return nothing;
    const tele = readVacTelemetry(this.host._renderPlanHass?.states?.[f.source]?.attributes);
    if (!tele) return nothing;
    const m = fitMatrix(f.p);
    const rects: TemplateResult[] = [];
    const xs: number[] = [], ys: number[] = [];
    for (const r of tele.rooms) {
      if (r.x0 == null) continue;
      const cs = [[r.x0!, r.y0!], [r.x1!, r.y0!], [r.x1!, r.y1!], [r.x0!, r.y1!]]
        .map(([x, y]) => applyAffine(m, x, y));
      cs.forEach(([x, y]) => { xs.push(x); ys.push(y); });
      const [lx, ly] = applyAffine(m, r.cx, r.cy);
      rects.push(svg`<polygon points="${cs.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"></polygon>
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${r.name}</text>`);
    }
    let dot: TemplateResult | typeof nothing = nothing;
    if (tele.pos) {
      const [dx2, dy2] = applyAffine(m, tele.pos.x, tele.pos.y);
      dot = svg`<circle class="vacfitdot" cx="${dx2.toFixed(1)}" cy="${dy2.toFixed(1)}" r="${(view.w * 0.012).toFixed(1)}"></circle>`;
    }
    // corner handles on the ghost bbox; data-corner carries the FIXED corner
    // (the opposite one) in robot coordinates
    const handles: TemplateResult[] = [];
    if (xs.length) {
      const inv = ((): ((x: number, y: number) => VacPt) => {
        const det = m[0] * m[4] - m[1] * m[3];
        return (x, y) => [
          (m[4] * (x - m[2]) - m[1] * (y - m[5])) / det,
          (-m[3] * (x - m[2]) + m[0] * (y - m[5])) / det,
        ];
      })();
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      // hit radius (finger-sized: these are grabbed on tablets) and the bead
      // you actually see, a quarter of it — same split as .bdhandle/.bdknob
      const r = view.w * 0.022;
      const kr = r / 4;
      for (const [hx, hy, ox2, oy2] of [[x0, y0, x1, y1], [x1, y0, x0, y1], [x1, y1, x0, y0], [x0, y1, x1, y0]] as number[][]) {
        const fixed = inv(ox2, oy2);
        handles.push(svg`<circle class="vacfithandle" data-corner="${fixed[0] + ',' + fixed[1]}"
          cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}"></circle>
          <circle class="vacfitknob" cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${kr.toFixed(2)}"></circle>`);
      }
    }
    return html`<svg class="vacfit" viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
        preserveAspectRatio="none"
        @pointerdown=${(e: PointerEvent) => this._vacFitPointer(e, view)}
        @pointermove=${(e: PointerEvent) => this._vacFitPointer(e, view)}
        @pointerup=${(e: PointerEvent) => this._vacFitPointer(e, view)}
        @pointercancel=${(e: PointerEvent) => this._vacFitPointer(e, view)}>${rects}${dot}${handles}</svg>`;
  }

public _resetRoomDialogFields(): void {
    this.host._roomEditId = null;
    this.host._roomFill = '';
    this.host._roomCustomFill = null;
    this.host._roomTempSrc = '';
    this.host._roomHumSrc = '';
    this.host._roomSrcOpen = null;
    this.host._roomSrcFilter = '';
    this.host._roomNameScale = 1;
    this.host._roomLabelScale = 1;
  }

public _openRoomEdit(r: RoomCfg): void {
    if (!r.id) return;
    this.host._roomEditId = r.id;
    this.host._nameSel = r.name || '';
    this.host._areaSel = r.area || '';
    this.host._roomFill = r.settings?.fill_mode === 'glow'
      ? ''
      : ((r.settings?.fill_mode as any) || '');
    const rawCustom = r.settings?.custom_fill;
    this.host._roomCustomFill = rawCustom && typeof rawCustom === 'object'
      ? customFillOf(rawCustom, spaceDisplayOf(this.host._curSpaceCfg).customFill)
      : null;
    this.host._roomTempSrc = r.settings?.temp_source || '';
    this.host._roomHumSrc = r.settings?.hum_source || '';
    this.host._roomNameScale = clampScale(r.settings?.name_scale);
    this.host._roomLabelScale = clampScale(r.settings?.label_scale);
    this.host._roomSrcOpen = null;
    this.host._roomSrcFilter = '';
    this.host._roomDialog = true;
  }

public _roomSettingsFromDialog(): RoomCfg['settings'] {
    const st: any = {};
    if (this.host._roomFill) st.fill_mode = this.host._roomFill;
    if (this.host._roomCustomFill) st.custom_fill = this.host._roomCustomFill;
    if (this.host._roomTempSrc) st.temp_source = this.host._roomTempSrc;
    if (this.host._roomHumSrc) st.hum_source = this.host._roomHumSrc;
    if (this.host._roomNameScale !== 1) st.name_scale = this.host._roomNameScale;
    if (this.host._roomLabelScale !== 1) st.label_scale = this.host._roomLabelScale;
    return Object.keys(st).length ? st : null;
  }

public _saveRoomEdit(): void {
    const sp = this.host._curSpaceCfg;
    const room = sp?.rooms.find((x: any) => x.id === this.host._roomEditId);
    if (!room) {
      this.host._roomDialog = false;
      this.host._roomEditId = null;
      return;
    }
    room.name = this.host._nameSel.trim() || room.name;
    room.area = this.host._areaSel || null;
    // Preserve unknown/future room settings. If this dialog replaces a legacy
    // fill_mode:'glow', materialize its effective Glow in the same write so a
    // seemingly unrelated room edit cannot switch the light overlay off.
    const previous = room.settings || {};
    const next: any = { ...previous };
    if (this.host._roomFill) next.fill_mode = this.host._roomFill;
    else delete next.fill_mode;
    if (this.host._roomCustomFill) next.custom_fill = this.host._roomCustomFill;
    else delete next.custom_fill;
    if (previous.fill_mode === 'glow' && typeof previous.glow !== 'boolean') next.glow = true;
    if (this.host._roomTempSrc) next.temp_source = this.host._roomTempSrc;
    else delete next.temp_source;
    if (this.host._roomHumSrc) next.hum_source = this.host._roomHumSrc;
    else delete next.hum_source;
    if (this.host._roomNameScale !== 1) next.name_scale = this.host._roomNameScale;
    else delete next.name_scale;
    if (this.host._roomLabelScale !== 1) next.label_scale = this.host._roomLabelScale;
    else delete next.label_scale;
    if (Object.keys(next).length) room.settings = next;
    else delete room.settings;
    this._saveConfig();
    this.host._roomDialog = false;
    this.host._roomEditId = null;
    this.host._nameSel = '';
    this.host._areaSel = '';
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    this.host.requestUpdate();
    this.host._showToast(this.host._t('toast.room_updated'));
  }

public _roomSrcCandidates(): { value: string; label: string; sub: string }[] {
    const h = this.host._planHass;
    const removed = removedPlanBindings(this.host._markers);
    const q = this.host._roomSrcFilter.trim().toLowerCase();
    const list: { value: string; label: string; sub: string }[] = [];
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.entry_type === 'service') continue;
      if (removed.devices.has(dev.id)) continue;
      const name = (dev.name_by_user || dev.name || dev.id).trim();
      if (q && !name.toLowerCase().includes(q)) continue;
      list.push({ value: 'device:' + dev.id, label: name, sub: dev.model || this.host._t('marker.sub_device') });
    }
    for (const [eid, reg] of Object.entries<any>(h.entities)) {
      if (!eid.startsWith('sensor.') || reg.hidden) continue;
      if (isRemovedPlanEntity(h, eid, removed)) continue;
      const label = reg.name || h.states[eid]?.attributes?.friendly_name || eid;
      if (q && !(label + ' ' + eid).toLowerCase().includes(q)) continue;
      list.push({ value: 'entity:' + eid, label, sub: eid });
    }
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list.slice(0, 200);
  }

public _roomSrcLabel(src: string): string {
    const i = src.indexOf(':');
    const k = src.slice(0, i);
    const ref = src.slice(i + 1);
    if (k === 'device') {
      return this.host._fullRegistryHass.devices[ref]?.name_by_user
        || this.host._fullRegistryHass.devices[ref]?.name || ref;
    }
    return this.host._fullRegistryHass.entities[ref]?.name
      || this.host.hass.states[ref]?.attributes?.friendly_name || ref;
  }

public _labelPos(r: RoomCfg, spaceId: string): { x: number; y: number } {
    const saved = this.host._layout['rl_' + (r.id || '')];
    if (saved && saved.s === spaceId) {
      return { x: saved.x * NORM_W, y: saved.y * NORM_W };
    }
    // a label nobody has dragged sits at the room's CENTROID, which is not a
    // node for an odd-sized or polygonal room — put it on the nearest one
    const c = this._snap(this.host._roomCenter(r));
    return { x: c[0], y: c[1] };
  }

public _labelDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (this.host._mode !== 'plan') return;
    ev.preventDefault();
    ev.stopPropagation();
    const p = this._labelPos(r, spaceId);
    this.host._drag = { id: 'rl_' + (r.id || ''), sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y, moved: false };
    capturePointer(ev);
    this.host._tip = null;
  }

public _labelMove(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    const id = 'rl_' + (r.id || '');
    if (!this.host._drag || this.host._drag.id !== id) return;
    const stage = this.host._stageEl;
    if (!stage) return;
    const space = this.host._spaceModelById(spaceId);
    if (!space) return;
    const vb = space.vb;
    const rect = stage.getBoundingClientRect();
    const v = this.host._viewOr(vb);
    const dx = ((ev.clientX - this.host._drag.sx) / rect.width) * v.w;
    const dy = ((ev.clientY - this.host._drag.sy) / rect.height) * v.h;
    if (Math.abs(ev.clientX - this.host._drag.sx) + Math.abs(ev.clientY - this.host._drag.sy) > 3) this.host._drag.moved = true;
    // DEV-B58-01, and worse than the marker's: this clamped to the space's
    // STORED view_box, which for every existing plan is the old unit square.
    // A room drawn at 2.5 had a name that could not be dragged to its own room.
    const nx = clampCanvasR(this.host._drag.ox + dx);
    const ny = clampCanvasR(this.host._drag.oy + dy);
    this.host._savePos({ id, space: spaceId } as DevItem, nx, ny);
  }

public _labelUp(r: RoomCfg): void {
    const id = 'rl_' + (r.id || '');
    if (!this.host._drag || this.host._drag.id !== id) return;
    const moved = this.host._drag.moved;
    this.host._drag = moved ? this.host._drag : null;
    if (moved) window.setTimeout(() => (this.host._drag = null), 0);
  }

public _labelScale(r: RoomCfg): number {
    const k = (this.host._layout['rl_' + (r.id || '')] as any)?.k;
    return typeof k === 'number' && Number.isFinite(k) ? Math.min(3, Math.max(0.5, k)) : 1;
  }

public _rlResizeDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (this.host._mode !== 'plan') return;
    ev.preventDefault();
    ev.stopPropagation();
    const card = (ev.target as HTMLElement).closest('.roomlabel') as HTMLElement | null;
    if (!card) return;
    const b = card.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const d0 = Math.max(8, Math.hypot(ev.clientX - cx, ev.clientY - cy));
    this.host._rlResize = { id: 'rl_' + (r.id || ''), space: spaceId, k0: this._labelScale(r), cx, cy, d0 };
    capturePointer(ev);
  }

public _rlResizeMove(ev: PointerEvent): void {
    const rs = this.host._rlResize;
    if (!rs) return;
    ev.stopPropagation();
    const dist = Math.max(8, Math.hypot(ev.clientX - rs.cx, ev.clientY - rs.cy));
    const k = Math.min(3, Math.max(0.5, rs.k0 * (dist / rs.d0)));
    const rec: any = this.host._layout[rs.id];
    if (!rec) {
      // the card was never dragged: pin its current default position first
      const roomId = rs.id.slice(3);
      const sp = this.host._spaceModelById(rs.space);
      if (!sp) return;
      const room = sp.rooms.find((x) => x.id === roomId);
      if (!room) return;
      const p = this._labelPos(room, rs.space);

      this.host._layout = {
        ...this.host._layout,
        [rs.id]: { s: rs.space, x: p.x / NORM_W, y: p.y / NORM_W, k },
      };
    } else {
      this.host._layout = { ...this.host._layout, [rs.id]: { ...rec, k } };
    }
    this.host._dirtyPos.add(rs.id);
  }

public _rlResizeUp(): void {
    if (!this.host._rlResize) return;
    this.host._rlResize = null;
    this.host._persistLayout();
  }

public _renderRoomGear(
    r: RoomCfg, space: SpaceModel, view: { x: number; y: number; w: number; h: number },
  ): TemplateResult | typeof nothing {
    if (!r.id) return nothing;
    let c: number[] | null = null;
    if (r.poly) {
      // the VISUAL centre (largest inscribed circle) — interiorPoint only
      // promises "inside", which sat visibly off-centre on an L-shaped room.
      // The model is memoized, so the poly array is a stable cache key.
      c = this.host._gearPtCache.get(r.poly) || null;
      if (!c) { c = poleOfInaccessibility(r.poly); this.host._gearPtCache.set(r.poly, c); }
    } else if (r.x != null && r.y != null) {
      c = [r.x + (r.w || 0) / 2, r.y + (r.h || 0) / 2];
    }
    if (!c) return nothing;
    const left = ((c[0] - view.x) / view.w) * 100;
    const top = ((c[1] - view.y) / view.h) * 100;
    return html`<button class="rlgearbtn" data-hp="room-settings" data-room=${r.id}
      style="left:${left}%;top:${top}%"
      title=${this.host._t('room.settings_title')}
      @pointerdown=${(e: Event) => e.stopPropagation()}
      @click=${(e: Event) => { e.stopPropagation(); this._openRoomEdit(r); }}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
      <span class="rlgeartext">${this.host._t('room.settings_short')}</span>
    </button>`;
  }

public _alignCandidates(): number[][] {
    const out: number[][] = [];
    const spm = this.host._spaceModel();
    if (this.host._markup) {
      if (!spm) return out;
      if (this.host._drag?.id.startsWith('rl_')) {
        // room-card drag: centers of the OTHER room cards
        const dragged = this.host._drag.id.slice(3);
        for (const r of spm.rooms) {
          if (!r.name || r.id === dragged) continue;
          const p = this._labelPos(r, this.host._space);
          out.push([p.x, p.y]);
        }
        return out;
      }
      // drawing: room vertices + current path/split points
      for (const r of spm.rooms) {
        const poly = roomPoly(r);
        if (poly) for (const p of poly) out.push(p);
      }
      if (this.host._tool === 'draw') for (const p of this.host._path) out.push(p);
      if (this.host._tool === 'split' && this.host._splitSel?.pts) for (const p of this.host._splitSel.pts) out.push(p);
      return out;
    }
    if (this.host._mode === 'devices') {
      // other icons of this space only (owner's decision)
      //
      // #400: the dragged marker is excluded by `_deviceDrag`, not `_drag`.
      // Device dragging moved into its own state with #74, and `_drag` is
      // null in this mode — so the marker being moved was listed among its
      // own alignment candidates. Nothing looked wrong because a point always
      // matches itself within tolerance: the guide was drawn from the marker
      // to itself and is indistinguishable from an honest one.
      const draggedId = this.host._deviceDrag?.id ?? this.host._drag?.id;
      for (const d of this.host._devices) {
        if (d.space !== this.host._space || d.id === draggedId
            || d.bindingStatus?.kind === 'ha_disabled') continue;
        const p = this.host._pos(d);
        out.push([p.x, p.y]);
      }
      return out;
    }
    if (this.host._mode === 'decor') {
      const movingId = this.host._decorMove?.id;
      out.push(...this._decorSnapGeometry(movingId).points);
      if (this.host._decorDraft) out.push(this.host._decorDraft.a);
      return out;
    }
    return out;
  }

public _renderAlignGuides(): TemplateResult {
    const pt = this.host._alignPoint;
    if (!pt) return svg`` as unknown as TemplateResult;
    // exact node match for grid-snapped things; half a cell for free-moving cards
    const tol = this.host._drag?.id.startsWith('rl_') ? this.host._gridPitch * 0.5 : this.host._gridPitch * 0.05;
    const guides = alignGuides(pt, this._alignCandidates(), tol);
    if (!guides.length) return svg`` as unknown as TemplateResult;
    const g = this.host._gridPitch;
    const over = g * 1.5; // extend a little past the point
    return svg`<g class="alignguides">
      ${guides.map((gd: AlignGuide) => {
        const [x1, y1, x2, y2] = gd.axis === 'x'
          ? [gd.at, gd.from[1], gd.at, pt[1] + Math.sign(pt[1] - gd.from[1]) * over]
          : [gd.from[0], gd.at, pt[0] + Math.sign(pt[0] - gd.from[0]) * over, gd.at];
        return svg`<line class="alignline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>
          <circle class="aligndot" cx="${gd.from[0]}" cy="${gd.from[1]}"
            r="${gridVisualUnits(g * 0.18, this.host._cellCm)}"></circle>`;
      })}
    </g>` as unknown as TemplateResult;
  }

public _renderOpeningCenterTick(gd: { x: number; y: number; angle: number }): TemplateResult {
    const rad = ((gd.angle + 90) * Math.PI) / 180;
    const half = gridVisualUnits(2.5 * 6, this.host._cellCm);
    return svg`<line class="alignline opcentertick"
      x1="${gd.x - Math.cos(rad) * half}" y1="${gd.y - Math.sin(rad) * half}"
      x2="${gd.x + Math.cos(rad) * half}" y2="${gd.y + Math.sin(rad) * half}"></line>` as unknown as TemplateResult;
  }

public _renderOpeningDimensionGuides(measure: OpMeasure): TemplateResult {
    const dimensions = measure.labels.flatMap((label) => label.dimension ? [label.dimension] : []);
    if (!dimensions.length) return svg`` as unknown as TemplateResult;
    const tickHalf = this._cssPxToRender(4);
    return svg`<g class="opening-dimensions" aria-hidden="true" pointer-events="none">
      ${dimensions.map((dimension) => {
        const nx = -dimension.axis[1], ny = dimension.axis[0];
        const tick = (point: [number, number], end: string) => svg`<line
          class="opening-dimension-tick" data-end=${end}
          x1=${point[0] - nx * tickHalf} y1=${point[1] - ny * tickHalf}
          x2=${point[0] + nx * tickHalf} y2=${point[1] + ny * tickHalf}></line>`;
        return svg`<g class="opening-dimension" data-source=${dimension.source}
          data-room=${dimension.roomId || nothing}>
          <line class="opening-dimension-line"
            x1=${dimension.from[0]} y1=${dimension.from[1]}
            x2=${dimension.to[0]} y2=${dimension.to[1]}></line>
          ${tick(dimension.from, 'from')}${tick(dimension.to, 'to')}
        </g>`;
      })}
    </g>` as unknown as TemplateResult;
  }

public _renderOpeningPlacementPreview(): TemplateResult {
    const candidate = this.host._openingPreview;
    if (!candidate) return svg``;
    const visibleSpec: OpeningVisibleSpec = {
      type: candidate.type,
      length: candidate.renderedLength,
      angle: candidate.angle,
      amount: openingAmount(candidate.type, null),
      flipH: candidate.flipH,
      flipV: candidate.flipV,
      base: 'var(--hp-open)',
      tone: 'var(--hp-open)',
      cellCm: this.host._cellCm,
      gridPitch: this.host._gridPitch,
      face: candidate.face,
    };
    const passageGeometry = candidate.type === 'passage'
      ? passagePlacementPreviewGeometry(
          candidate, gridVisualUnits(this.host._gridPitch, this.host._cellCm),
        )
      : null;
    return svg`<g class="opening-preview" data-kind=${candidate.type}
      aria-hidden="true" pointer-events="none"
      transform="translate(${candidate.x} ${candidate.y}) rotate(${candidate.angle})">
      ${passageGeometry ? svg`
        <rect class="passage-preview-cut" pointer-events="none"
          x=${passageGeometry.rect.x} y=${passageGeometry.rect.y}
          width=${passageGeometry.rect.width} height=${passageGeometry.rect.height}></rect>
        ${passageGeometry.boundaries.map((boundary) => svg`
          <line class="passage-preview-boundary" pointer-events="none"
            x1=${boundary.x1} y1=${boundary.y1}
            x2=${boundary.x2} y2=${boundary.y2}></line>`)}
      ` : renderOpeningVisibleGeometry(visibleSpec)}
    </g>
    <circle class="opening-preview-dot opghost-dot" aria-hidden="true" pointer-events="none"
      cx=${candidate.x} cy=${candidate.y}
      r=${gridVisualUnits(this.host._gridPitch * 0.18, this.host._cellCm)}></circle>` as unknown as TemplateResult;
  }

public _renderOpeningDialog(): TemplateResult {
    const d = this.host._openingDialog!;
    const partitions = this.host._spaceModel()?.partitions || [];
    const previous = d.id
      ? this.host._curSpaceCfg?.openings?.find((item: OpeningCfg) => item.id === d.id)
      : null;
    const dialogOpening: OpeningCfg = {
      id: d.id || 'preview', type: d.type,
      x: d.x / NORM_W, y: d.y / this.host._spaceH,
      angle: d.angle,
      length: previous && !d.lengthTouched
        ? previous.length
        : this.host._cmToUnits(Math.max(20, d.lengthCm)) / NORM_W,
      ...(d.host ? { host: d.host } : {}),
    };
    const strict = partitionOpeningNeedsStrictValidation(previous, dialogOpening);
    const hostResolution = d.host
      ? strict
        ? resolvePartitionOpeningStrict(
            dialogOpening, partitions, NORM_W, this.host._cellCm, this.host._gridPitch,
          )
        : resolvePartitionOpeningCompat(
            dialogOpening, partitions, NORM_W, this.host._cellCm, this.host._gridPitch,
          )
      : null;
    const jambInvalid = hostResolution?.reason === 'does-not-fit-jamb';
    const hostPartition = d.host
      ? partitions.find((partition) => partition.id === d.host!.id)
      : null;
    const jambDistance = hostPartition
      ? formatLength(hostPartition.cm / 2, this.host._imperial)
      : '';
    const orphan = !!d.host && !hostResolution?.resolved && !jambInvalid;
    const icon = d.type === 'gate' ? 'mdi:gate'
      : d.type === 'window' ? 'mdi:window-closed-variant'
        : d.type === 'passage' ? 'mdi:arch' : 'mdi:door';
    const picker = (kind: 'contact' | 'lock', list: { value: string; label: string }[]) => {
      const cur = kind === 'contact' ? d.contact : d.lock;
      const open = kind === 'contact' ? !!d.contactOpen : !!d.lockOpen;
      const filter = kind === 'contact' ? d.contactFilter || '' : d.lockFilter || '';
      const selected = list.find((candidate) => candidate.value === cur);
      const selectedLabel = selected?.label
        || this.host.hass.states[cur]?.attributes?.friendly_name
        || this.host._fullRegistryHass.entities[cur]?.name
        || cur;
      const filtered = filterOpeningEntityCandidates(list, filter);
      return html`
        <button type="button" class="dropbtn opening-entity-drop ${open ? 'open' : ''}"
          data-opening-picker=${kind} aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this._toggleOpeningEntityPicker(kind)}>
          ${cur
            ? html`<b>${selectedLabel}</b><span class="ref">${cur}</span>`
            : html`<span class="muted">${this.host._t('opening.none')}</span>`}
          <ha-icon icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
        </button>
        ${open
          ? html`<div class="droppanel opening-entity-panel" data-opening-panel=${kind}>
              <input class="namein opening-entity-search" type="text"
                placeholder=${this.host._t('opening.search_ph')} .value=${filter}
                @input=${(e: Event) => this._filterOpeningEntities(
                  kind, (e.target as HTMLInputElement).value,
                )} />
              <div class="candlist">
                <button type="button" class="cand opening-entity-candidate ${cur ? '' : 'sel'}"
                  data-opening-entity="" @click=${() => this._selectOpeningEntity(kind, '')}>
                  <span class="cl">${this.host._t('opening.none')}</span>
                </button>
                ${filtered.map((candidate) => html`
                  <button type="button"
                    class="cand opening-entity-candidate ${candidate.value === cur ? 'sel' : ''}"
                    data-opening-entity=${candidate.value}
                    @click=${() => this._selectOpeningEntity(kind, candidate.value)}>
                    <span class="cl">${candidate.label}</span>
                    <span class="cs">${candidate.value}</span>
                  </button>`)}
                ${!filtered.length
                  ? html`<div class="cand muted opening-entity-empty">${this.host._t('marker.nothing_found')}</div>`
                  : nothing}
              </div>
            </div>`
          : nothing}`;
    };
    return html`<hp-dialog .hass=${this.host.hass} wide
      .title=${d.id ? this.host._t('opening.edit') : this.host._t('opening.new')} icon=${icon}
      @hp-close=${() => (this.host._openingDialog = null)}>
        <div class="body">
          ${d.host ? html`<label>${this.host._t('opening.host_partition')}</label>
            <div class=${orphan || jambInvalid ? 'habindingbanner' : 'rhint'}
              role=${orphan || jambInvalid ? 'status' : nothing}>
              ${orphan || jambInvalid ? html`<ha-icon icon="mdi:alert-outline"></ha-icon>` : nothing}
              <span>${orphan
                ? this.host._t('opening.partition_orphan')
                : jambInvalid
                  ? this.host._t('opening.partition_jamb_margin', { distance: jambDistance })
                  : this.host._t('opening.host_partition')}</span>
            </div>` : nothing}
          <label>${this.host._t('opening.type_label')}</label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'window'}
            @change=${() => (this.host._openingDialog = {
              ...d, type: 'window', lengthCm: d.id ? d.lengthCm : openingDefaultLengthCm('window'),
              contactOpen: false, lockOpen: false,
            })} />
            <span>${this.host._t('opening.window')}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'door'}
            @change=${() => (this.host._openingDialog = {
              ...d, type: 'door', lengthCm: d.id ? d.lengthCm : openingDefaultLengthCm('door'),
              contactOpen: false, lockOpen: false,
            })} />
            <span>${this.host._t('opening.door')}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'passage'}
            @change=${() => (this.host._openingDialog = {
              ...d, type: 'passage', lengthCm: d.id ? d.lengthCm : openingDefaultLengthCm('passage'),
              contactOpen: false, lockOpen: false,
            })} />
            <span>${this.host._t('opening.passage')}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'gate'}
            @change=${() => (this.host._openingDialog = {
              ...d, type: 'gate',
              lengthCm: d.id ? d.lengthCm : openingDefaultLengthCm('gate'), flipH: false,
              contactOpen: false, lockOpen: false,
            })} />
            <span>${this.host._t('opening.gate')}</span></label>

          <label>${this.host._t('opening.length_label')}</label>
          <input class="namein tempin" type="number" min="20" max="600" step="5" .value=${String(d.lengthCm)}
            @input=${(e: Event) => {
              const n = strictNumber((e.target as HTMLInputElement).value);
              if (n != null) this.host._openingDialog = { ...d, lengthCm: n, lengthTouched: true };
            }} />

          ${d.type === 'passage' && (d.contact || d.lock)
            ? html`<div class="habindingbanner" role="status" aria-live="polite">
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                <span>${this.host._t('opening.passage_binding_warning')}</span>
              </div>`
            : nothing}

          ${d.type !== 'passage'
            ? html`<label>${this.host._t('opening.contact_label')}</label>
                ${picker('contact', this._contactCandidates())}
                ${d.contact
                  ? html`<label class="srcrow">${this._boolInput(d.invert, (v) => (this.host._openingDialog = { ...d, invert: v }))}
                      <span>${this.host._t('opening.invert')}</span></label>`
                  : nothing}`
            : nothing}

          ${d.type === 'door' || d.type === 'gate'
            ? html`<label>${this.host._t('opening.lock_label')}</label>
                ${picker('lock', this._lockCandidates())}`
            : nothing}

          ${d.type !== 'gate' && d.type !== 'passage'
            ? html`<label class="srcrow">${this._boolInput(d.flipH, (v) => (this.host._openingDialog = { ...d, flipH: v }))}
                <span>${this.host._t('opening.flip_h')}</span></label>`
            : nothing}
          ${d.type !== 'passage'
            ? html`<label class="srcrow">${this._boolInput(d.flipV, (v) => (this.host._openingDialog = { ...d, flipV: v }))}
                <span>${this.host._t('opening.flip_v')}</span></label>`
            : nothing}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${d.id
            ? html`<div class="dialog-action-group dialog-action-danger">
                <button class="btn danger" @click=${() => this._deleteOpening()}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
                </button>
              </div>`
            : nothing}
          ${orphan
            ? html`<button class="btn ghost" @click=${() => this._rebindPartitionOpening()}>
                ${this.host._t('opening.rebind_partition')}
              </button>`
            : nothing}
          <div class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" @click=${() => (this.host._openingDialog = null)}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" @click=${() => this._saveOpening()}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }

public _gridLevels(): { fine: number; coarse: number } | null {
    const stage = this.host._stageEl;
    const v = this.host._viewOr(this.host._baseVb());
    const px = stage && stage.clientWidth && v.w ? stage.clientWidth / v.w : 1;
    return gridLevels(this.host._gridPitch, px);
  }

public _renderMarkupDefs(_vb: number[]): TemplateResult {
    const lv = this._gridLevels();
    if (!lv) return svg`<defs></defs>` as unknown as TemplateResult;
    const g = this.host._gridPitch * lv.fine;
    const G = this.host._gridPitch * lv.coarse;
    const dotR = this.host._gridPitch * lv.fine * 0.14;
    // Two patterns, CAD-style: the fine dots thin out as you zoom away
    // (gridLevels drops whole decades of them) while every coarse node keeps
    // a bigger, darker dot, so the eye never loses the scale reference.
    return svg`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${g}" height="${g}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${dotR}" class="griddot"></circle>
          <circle cx="${g}" cy="0" r="${dotR}" class="griddot"></circle>
          <circle cx="0" cy="${g}" r="${dotR}" class="griddot"></circle>
          <circle cx="${g}" cy="${g}" r="${dotR}" class="griddot"></circle>
        </pattern>
        <pattern id="hp-grid-major" x="0" y="0" width="${G}" height="${G}" patternUnits="userSpaceOnUse">
          <rect width="${G}" height="${G}" fill="url(#hp-grid)"></rect>
          <circle cx="0" cy="0" r="${dotR * 2.1}" class="griddot major"></circle>
          <circle cx="${G}" cy="0" r="${dotR * 2.1}" class="griddot major"></circle>
          <circle cx="0" cy="${G}" r="${dotR * 2.1}" class="griddot major"></circle>
          <circle cx="${G}" cy="${G}" r="${dotR * 2.1}" class="griddot major"></circle>
        </pattern>
      </defs>`;
  }

public _renderPhysicalEditorLayer(): TemplateResult {
    const space = this.host._spaceModel();
    if (!space) return svg`` as unknown as TemplateResult;
    const g = this.host._gridPitch;
    const view = this.host._viewOr(this.host._baseVb());
    const stage = this.host._stageEl;
    const unitsPerPx = stage?.clientWidth ? view.w / stage.clientWidth : g / 8;
    const touchStroke = 24;
    const handleR = Math.max(g * 0.22, unitsPerPx * 8);
    const rotateHandleR = Math.max(handleR, unitsPerPx * 12);
    const path = (poly: number[][]) => `M ${poly.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
    const selected = (kind: string, id: string) =>
      (this.host._physicalSel?.kind === kind && this.host._physicalSel.id === id)
      || (kind === 'column' && this.host._duplicateColumnId === id);
    const partitions = (space.partitions || []).map((p) => {
      const body = partitionBody(p.a, p.b, p.cm, this.host._cellCm, this.host._gridPitch);
      return body
        ? svg`<path class="physical-hit ${selected('partition', p.id) ? 'selected' : ''}"
            data-hp="partition" data-kind="partition" data-id=${p.id} d=${path(body)}
            stroke-width=${touchStroke} vector-effect="non-scaling-stroke"
            @pointerdown=${(e: PointerEvent) => this._physicalDown(e, 'partition', p.id)}
            @pointermove=${(e: PointerEvent) => this._physicalMove(e)}
            @pointerup=${(e: PointerEvent) => this._physicalUp(e)}></path>`
        : svg`<line class="physical-hit ${selected('partition', p.id) ? 'selected' : ''}"
            data-hp="partition" data-kind="partition" data-id=${p.id}
            x1=${p.a[0]} y1=${p.a[1]} x2=${p.b[0]} y2=${p.b[1]}
            stroke-width=${touchStroke} vector-effect="non-scaling-stroke"
            @pointerdown=${(e: PointerEvent) => this._physicalDown(e, 'partition', p.id)}
            @pointermove=${(e: PointerEvent) => this._physicalMove(e)}
            @pointerup=${(e: PointerEvent) => this._physicalUp(e)}></line>`;
    });
    const columns = (space.wall_columns || []).map((c) => {
      const shown = this.host._physicalRotate?.id === c.id
        ? { ...c, angle: this.host._physicalRotate.angle } as WallColumnCfg : c;
      const body = columnBody(shown, this.host._cellCm, this.host._gridPitch);
      return svg`<path class="physical-hit ${selected('column', c.id) ? 'selected' : ''}"
        data-hp="wall-column" data-kind=${c.shape} data-id=${c.id} d=${path(body)}
        stroke-width=${touchStroke} vector-effect="non-scaling-stroke"
        @pointerdown=${(e: PointerEvent) => this._physicalDown(e, 'column', c.id)}
        @pointermove=${(e: PointerEvent) => this._physicalMove(e)}
        @pointerup=${(e: PointerEvent) => this._physicalUp(e)}></path>`;
    });
    const drag = this.host._physicalDrag;
    const ghost = (() => {
      if (!drag?.moved) return nothing;
      if (drag.kind === 'partition' && Number((drag.base as PartitionCfg).cm) === 0) {
        const partition = drag.base as PartitionCfg;
        return svg`<line class="physical-drag zero"
          x1=${partition.a[0]} y1=${partition.a[1]}
          x2=${partition.b[0]} y2=${partition.b[1]}
          transform="translate(${drag.delta[0]} ${drag.delta[1]})"></line>`;
      }
      const poly = drag.kind === 'partition'
        ? partitionBody((drag.base as PartitionCfg).a, (drag.base as PartitionCfg).b,
            (drag.base as PartitionCfg).cm, this.host._cellCm, this.host._gridPitch)
        : columnBody(drag.base as WallColumnCfg, this.host._cellCm, this.host._gridPitch);
      return poly ? svg`<path class="physical-drag" d=${path(poly)}
        transform="translate(${drag.delta[0]} ${drag.delta[1]})"></path>` : nothing;
    })();
    const chrome = (() => {
      const sel = this.host._physicalSel;
      if (!sel) return nothing;
      if (sel.kind === 'partition') {
        const p = space.partitions.find((x) => x.id === sel.id);
        if (!p) return nothing;
        const body = partitionBody(p.a, p.b, p.cm, this.host._cellCm, this.host._gridPitch);
        const mx = (p.a[0] + p.b[0]) / 2, my = (p.a[1] + p.b[1]) / 2;
        return svg`<g class="physical-chrome" data-kind="partition-selection">
          ${body
            ? svg`<path class="frame" d=${path(body)}></path>`
            : svg`<line class="frame" x1=${p.a[0]} y1=${p.a[1]}
                x2=${p.b[0]} y2=${p.b[1]}></line>`}
          <circle class="move-dot" cx=${p.a[0]} cy=${p.a[1]} r=${handleR * 0.55}></circle>
          <circle class="move-dot" cx=${p.b[0]} cy=${p.b[1]} r=${handleR * 0.55}></circle>
          <circle class="move-dot" cx=${mx} cy=${my} r=${handleR}></circle>
        </g>`;
      }
      const base = space.wall_columns.find((x) => x.id === sel.id);
      if (!base) return nothing;
      const c = this.host._physicalRotate?.id === base.id
        ? { ...base, angle: this.host._physicalRotate.angle } as WallColumnCfg : base;
      const body = columnBody(c, this.host._cellCm, this.host._gridPitch);
      if (c.shape !== 'square') return svg`<g class="physical-chrome" data-kind="circle-selection">
        <path class="frame" d=${path(body)}></path>
        <circle class="move-dot" cx=${c.center[0]} cy=${c.center[1]} r=${handleR}></circle>
      </g>`;
      const size = wallCmToUnits(c.cm, this.host._cellCm, this.host._gridPitch);
      const angle = canonicalColumnAngle(c.angle) * Math.PI / 180;
      const ux = Math.sin(angle), uy = -Math.cos(angle);
      const edge = [c.center[0] + ux * size / 2, c.center[1] + uy * size / 2];
      const handle = [edge[0] + ux * Math.max(g, unitsPerPx * 24),
        edge[1] + uy * Math.max(g, unitsPerPx * 24)];
      return svg`<g class="physical-chrome" data-kind="square-selection">
        <path class="frame" d=${path(body)}></path>
        <circle class="move-dot" cx=${c.center[0]} cy=${c.center[1]} r=${handleR}></circle>
        <line class="stem" x1=${edge[0]} y1=${edge[1]} x2=${handle[0]} y2=${handle[1]}></line>
        <circle class="rotate-handle" cx=${handle[0]} cy=${handle[1]} r=${rotateHandleR}
          data-kind="rotate" @pointerdown=${(e: PointerEvent) => this._physicalRotateDown(e, base)}
          @pointermove=${(e: PointerEvent) => this._physicalRotateMove(e)}
          @pointerup=${(e: PointerEvent) => this._physicalRotateUp(e)}></circle>
      </g>`;
    })();
    return svg`<g class="physical-editor">${partitions}${columns}${ghost}${chrome}</g>`;
  }

public _renderHiddenWallDiagnosticOverlay(): TemplateResult {
    if (!this.host._markup) return svg`` as unknown as TemplateResult;
    const geometry = this._hiddenWallDiagnosticSnapshot().value;
    if (!geometry.segments.length) return svg`` as unknown as TemplateResult;
    const radius = wallCmToUnits(5, this.host._cellCm, this.host._gridPitch);
    return svg`<g class="hidden-wall-diagnostic" data-hp="hidden-wall-diagnostic"
      data-segment-count=${geometry.segments.length}
      data-endpoint-count=${geometry.endpoints.length}
      aria-hidden="true" pointer-events="none">
      ${geometry.segments.map((segment) => svg`<line class="hidden-wall-line"
        data-key=${segment.key} data-source-kind=${segment.sourceKind}
        data-source-id=${segment.sourceId}
        x1=${segment.a[0]} y1=${segment.a[1]} x2=${segment.b[0]} y2=${segment.b[1]}
        vector-effect="non-scaling-stroke" pointer-events="none"></line>`)}
      ${geometry.endpoints.map((endpoint) => svg`<circle class="hidden-wall-node"
        data-key=${endpoint.key} data-source-kind=${endpoint.sourceKind}
        data-source-id=${endpoint.sourceId}
        cx=${endpoint.point[0]} cy=${endpoint.point[1]} r=${radius}
        pointer-events="none"></circle>`)}
    </g>` as unknown as TemplateResult;
  }

public _renderPlanSnapOverlay(): TemplateResult {
    if (!this.host._markup) {
      return svg`` as unknown as TemplateResult;
    }
    const geometry = this._planSnapGeometrySnapshot().value;
    const active = this.host._activePlanSnapCandidate;
    const conflictKeys = new Set(this.host._activePlanSnapConflicts.map((item) => item.key));
    const staticRadius = wallCmToUnits(5, this.host._cellCm, this.host._gridPitch);
    const activeRadius = wallCmToUnits(10, this.host._cellCm, this.host._gridPitch);
    return svg`<g class="plan-snap-overlay" data-hp="plan-snap-overlay"
      data-segment-count=${geometry.segments.length}
      data-endpoint-count=${geometry.endpoints.length}
      aria-hidden="true" pointer-events="none">
      ${guard([geometry, staticRadius, [...conflictKeys].sort().join('|')], () => svg`
        ${geometry.segments.map((segment) => svg`<line class="plan-snap-line"
          data-key=${segment.key} data-source-kind=${segment.sourceKind}
          x1=${segment.a[0]} y1=${segment.a[1]} x2=${segment.b[0]} y2=${segment.b[1]}
          vector-effect="non-scaling-stroke" pointer-events="none"></line>`)}
        ${geometry.endpoints.map((endpoint) => svg`<circle class="plan-snap-node ${conflictKeys.has(endpoint.key) ? 'conflict' : ''}"
          data-kind="endpoint" data-key=${endpoint.key} data-active="false"
          cx=${endpoint.point[0]} cy=${endpoint.point[1]} r=${staticRadius}
          pointer-events="none"></circle>`)}
      `)}
      <circle class="plan-snap-node ${active ? 'active' : ''} ${active?.kind === 'line' ? 'dynamic' : ''}"
        data-hp="plan-snap-active-marker"
        data-kind=${active?.kind ?? nothing} data-key=${active?.key ?? nothing}
        data-active=${active ? 'true' : 'false'}
        cx=${active?.point[0] ?? 0} cy=${active?.point[1] ?? 0} r=${activeRadius}
        visibility=${active ? 'visible' : 'hidden'} pointer-events="none"></circle>
    </g>` as unknown as TemplateResult;
  }

public _syncPlanSnapActiveMarker(candidate: PlanSnapCandidate | null): void {
    const marker = this.host.renderRoot?.querySelector<SVGCircleElement>(
      '[data-hp="plan-snap-active-marker"]',
    );
    if (!marker) return;
    marker.setAttribute('class', `plan-snap-node${candidate ? ' active' : ''}${
      candidate?.kind === 'line' ? ' dynamic' : ''
    }`);
    marker.setAttribute('data-active', candidate ? 'true' : 'false');
    marker.setAttribute('visibility', candidate ? 'visible' : 'hidden');
    if (!candidate) {
      marker.removeAttribute('data-kind');
      marker.removeAttribute('data-key');
      return;
    }
    marker.setAttribute('data-kind', candidate.kind);
    marker.setAttribute('data-key', candidate.key);
    marker.setAttribute('cx', String(candidate.point[0]));
    marker.setAttribute('cy', String(candidate.point[1]));
    marker.setAttribute('r', String(wallCmToUnits(10, this.host._cellCm, this.host._gridPitch)));
  }

public _syncPlanSnapConflictMarkers(conflicts: readonly PlanSnapEndpoint[]): void {
    const keys = new Set(conflicts.map((item) => item.key));
    for (const marker of this.host.renderRoot?.querySelectorAll<SVGCircleElement>(
      '.plan-snap-node[data-kind="endpoint"]',
    ) || []) {
      marker.setAttribute('class', `plan-snap-node${keys.has(marker.dataset.key || '') ? ' conflict' : ''}`);
    }
  }

public _planSnapPhysicalSegment(segment: PlanSnapSegment): LinearWallSegment | null {
    let cm = 0;
    const space = this.host._spaceModel();
    if (!space) return null;
    if (segment.sourceKind === 'partition') {
      cm = Number(space.partitions.find((item) => item.id === segment.sourceId)?.cm) || 0;
    } else {
      cm = intervalCmAt(
        space.rooms, this.host._spaceWalls, this.host._openCuts(),
        [segment.a[0], segment.a[1], segment.b[0], segment.b[1]],
        this.host._wallKeyPitch, this.host._cellCm, this.host._gridPitch, NORM_W,
      );
    }
    if (!(cm > 0)) return null;
    return {
      a: [...segment.a], b: [...segment.b],
      halfDepth: wallCmToUnits(cm, this.host._cellCm, this.host._gridPitch) / 2,
    };
  }

public _drawPreviewJoinPatchD(
    points: number[][], halfDepths: number[],
  ): string {
    if (points.length < 2) return '';
    const preview: LinearWallSegment[] = [];
    for (let i = 0; i + 1 < points.length; i++) {
      if (!(halfDepths[i] > 0)) continue;
      preview.push({ a: points[i], b: points[i + 1], halfDepth: halfDepths[i] });
    }
    if (!preview.length) return '';
    const eps = this.host._gridPitch * 0.0002;
    const touching = this._planSnapGeometrySnapshot().value.segments
      .filter((segment) => points.some((point) => distToSegment(point, [
        segment.a[0], segment.a[1], segment.b[0], segment.b[1],
      ]) <= eps))
      .map((segment) => this._planSnapPhysicalSegment(segment))
      .filter((segment): segment is LinearWallSegment => !!segment);
    const patches = linearWallJoinPatches([...preview, ...touching], eps);
    return patches.map((patch) =>
      `M ${patch.map((point) => `${point[0]} ${point[1]}`).join(' L ')} Z`).join(' ');
  }

public _renderMarkupLayer(vb: number[]): TemplateResult {
    // Derived axes omit zero and positive-body stretches; their dedicated
    // layers paint those segments with the correct style and z-order.
    const openCuts = this.host._openCuts();
    const thickCuts = this.host._thickWallCuts();
    const allCuts = openCuts.concat(thickCuts);
    const segs = allCuts.length
      ? cutSegments(this.host._segments, allCuts, this.host._gridPitch * 0.02)
      : this.host._segments;
    const path = this.host._path;
    const g = this.host._gridPitch;
    const view = this.host._viewOr(this.host._baseVb());
    const drawCm = this.host._tool === 'draw' ? this.host._drawWallCm : null;
    const previewPts = (() => {
      if (this.host._tool !== 'draw' || !path.length || drawCm == null) return null;
      if (this.host._contourClosed) return path;
      if (this.host._cursorPt) return [...path, this.host._cursorPt];
      return path.length >= 2 ? path : null;
    })();
    // Превью берёт толщины из того же резолвера, что и запись (#234). Раньше
    // здесь была вторая формула, и расходились они ровно на пропуске: на экране
    // текущее поле, в конфиге — 15 см.
    const previewHalfDepths = previewPts
      ? chainSegmentCms(
          previewPts.length - 1,
          this.host._contourClosed
            ? [...this.host._wallChainSegmentCms, this.host._closingWallCm ?? undefined]
            : this.host._wallChainSegmentCms,
          drawCm, DRAW_WALL_DEFAULT_CM,
        ).map((cm) => wallCmToUnits(cm, this.host._cellCm, this.host._gridPitch) / 2)
      : [];
    const previewD = previewPts
      ? drawWallPreviewD(
          previewPts,
          wallCmToUnits(drawCm!, this.host._cellCm, this.host._gridPitch) / 2,
          this.host._contourClosed,
          previewHalfDepths,
        )
      : '';
    const previewJoinPatchD = previewPts
      ? this._drawPreviewJoinPatchD(previewPts, previewHalfDepths)
      : '';
    const repairPreview = this.host._wallFaceBatch?.candidates[this.host._wallFaceBatch.index]?.repair
      || this.host._wallRepairDiagnostic;
    return svg`
      ${this._gridLevels()
        ? svg`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`
        : nothing}
      ${segs.map((s) => svg`<line class="seg" x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}"></line>`)}
      ${this._renderPhysicalEditorLayer()}
      ${this.host._tool === 'column' && this.host._cursorPt && this.host._drawWallCm
        ? svg`<path class="physical-drag" d=${(() => {
            const c: WallColumnCfg = { id: 'preview', shape: 'square', center: this.host._cursorPt!, cm: this.host._drawWallCm! };
            const body = columnBody(c, this.host._cellCm, this.host._gridPitch);
            return `M ${body.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
          })()}></path>`
        : nothing}
      ${previewD
        ? svg`<path class="drawwall-preview-fill" d="${previewD}"></path>
             <path class="drawwall-preview" d="${previewD}"></path>`
        : nothing}
      ${previewPts && drawCm === 0
        ? svg`<polyline class="drawwall-zero-preview ${zeroWallStyleOf(this.host._curSpaceCfg)}"
            points=${previewPts.map((point) => point.join(',')).join(' ')}></polyline>`
        : nothing}
      ${previewJoinPatchD
        ? svg`<path class="drawwall-preview-fill" d="${previewJoinPatchD}"></path>
             <path class="drawwall-preview" style="stroke:none" d="${previewJoinPatchD}"></path>`
        : nothing}
      ${repairPreview ? svg`<line class="wall-repair-preview"
        x1=${repairPreview.from[0]} y1=${repairPreview.from[1]}
        x2=${repairPreview.to[0]} y2=${repairPreview.to[1]}
        aria-hidden="true" pointer-events="none"></line>` : nothing}
      ${this.host._tool === 'split' && this.host._splitSel?.pts?.length
        ? svg`${this.host._splitSel.pts.length > 1
              ? svg`<polyline class="pathline" points="${this.host._splitSel.pts.map((p) => p.join(',')).join(' ')}"></polyline>`
              : nothing}
            ${this.host._splitSel.pts.map((p, i) => svg`<circle class="vertex ${i === 0 ? 'first' : ''}"
              cx="${p[0]}" cy="${p[1]}" r="${gridVisualUnits(g * 0.22, this.host._cellCm)}"></circle>`)}
            ${this.host._cursorPt
              ? svg`<line class="preview" x1="${this.host._splitSel.pts[this.host._splitSel.pts.length - 1][0]}" y1="${this.host._splitSel.pts[this.host._splitSel.pts.length - 1][1]}"
                  x2="${this.host._cursorPt[0]}" y2="${this.host._cursorPt[1]}"></line>`
              : nothing}`
        : nothing}
    `;
  }

public _renderActiveChainInk(): TemplateResult {
    const path = this.host._path;
    const g = this.host._gridPitch;
    return svg`
      ${path.length > 1
        ? svg`<polyline class="pathline" points="${path.map((p) => p.join(',')).join(' ')}"></polyline>`
        : nothing}
      ${path.length && this.host._cursorPt && this.host._tool === 'draw' && !this.host._contourClosed
        ? svg`<line class="active-axis" x1="${path[path.length - 1][0]}" y1="${path[path.length - 1][1]}"
            x2="${this.host._cursorPt[0]}" y2="${this.host._cursorPt[1]}" aria-hidden="true"></line>
            ${!this.host._activePlanSnapCandidate && !this.host._activePlanSnapConflicts.length
              ? svg`<circle class="active-vertex" cx="${this.host._cursorPt[0]}" cy="${this.host._cursorPt[1]}"
                  r="${gridVisualUnits(g * 0.22, this.host._cellCm)}" aria-hidden="true"></circle>` : nothing}`
        : nothing}
      ${path.map((p, i) => svg`<circle class="vertex ${i === 0 ? 'first' : ''}"
        cx="${p[0]}" cy="${p[1]}" r="${gridVisualUnits(g * 0.22, this.host._cellCm)}"></circle>`)}
    ` as unknown as TemplateResult;
  }

public _renderPartitionDeleteDialog(): TemplateResult {
    const dialog = this.host._partitionDeleteDialog!;
    const imperial = this.host.hass?.config?.unit_system?.length === 'mi';
    return html`<hp-dialog .hass=${this.host.hass}
      .title=${this.host._t('confirm.delete_partition_openings_title')}
      icon="mdi:wall" dismiss-on-scrim
      @hp-close=${() => (this.host._partitionDeleteDialog = null)}>
      <div class="body">
        <p>${this.host._t('confirm.delete_partition_openings_body', {
          count: dialog.openings.length,
        })}</p>
        <ul aria-label=${this.host._t('confirm.delete_partition_openings_title')}>
          ${dialog.openings.map((opening) => html`<li>${this.host._t(
            'confirm.delete_partition_openings_item', {
              type: this.host._t(`opening.${opening.type}` as I18nKey),
              length: formatLength(
                (opening.length * NORM_W / this.host._gridPitch) * this.host._cellCm,
                imperial,
              ),
            },
          )}</li>`)}
        </ul>
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" @click=${() => (this.host._partitionDeleteDialog = null)}>
          ${this.host._t('btn.cancel')}
        </button>
        <span class="spacer"></span>
        <button class="btn danger" @click=${() => this._confirmPartitionDelete()}>
          <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
        </button>
      </div>
    </hp-dialog>`;
  }

public _renderRoomDeleteDialog(): TemplateResult {
    const dialog = this.host._roomDeleteDialog!;
    return html`<hp-dialog .hass=${this.host.hass}
      .title=${this.host._t('confirm.delete_room_title', { name: dialog.name })}
      icon="mdi:floor-plan" dismiss-on-scrim
      @hp-close=${() => (this.host._roomDeleteDialog = null)}>
      <div class="body">
        <p>${this.host._t('confirm.delete_room_body')}</p>
      </div>
      <div class="row" slot="footer">
        <button class="btn ghost" @click=${() => (this.host._roomDeleteDialog = null)}>
          ${this.host._t('btn.cancel')}
        </button>
        <span class="spacer"></span>
        <button class="btn" @click=${() => this._confirmRoomDelete(true)}>
          <ha-icon icon="mdi:wall"></ha-icon>${this.host._t('btn.delete_room_keep_walls')}
        </button>
        <button class="btn danger" @click=${() => this._confirmRoomDelete(false)}>
          <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete_room_with_walls')}
        </button>
      </div>
    </hp-dialog>`;
  }

public _renderPhysicalDialog(): TemplateResult {
    const d = this.host._physicalDialog!;
    const column = d.kind === 'column';
    return html`<hp-dialog .hass=${this.host.hass} wide
      .title=${this.host._t(column ? 'physical.column_properties' : 'physical.partition_properties')}
      icon=${column ? 'mdi:vector-square' : 'mdi:wall'}
      @hp-close=${() => (this.host._physicalDialog = null)}>
        <div class="body">
          ${column ? html`<label>${this.host._t('physical.shape')}</label>
            <select class="areasel" @change=${(e: Event) => {
              const shape = (e.target as HTMLSelectElement).value as 'square' | 'circle';
              this.host._physicalDialog = { ...d, shape };
            }}>
              <option value="square" ?selected=${d.shape === 'square'}>${this.host._t('physical.square')}</option>
              <option value="circle" ?selected=${d.shape === 'circle'}>${this.host._t('physical.circle')}</option>
            </select>` : nothing}
          <label>${this.host._t(column
            ? d.shape === 'circle' ? 'physical.diameter' : 'physical.side'
            : 'wallthick.field')}</label>
          <div class="row"><input class="namein tempin" type="number"
            min=${cmToField(column ? 1 : 0, this.host._imperial)}
            max=${cmToField(column ? 150 : 100, this.host._imperial)} step="any" .value=${d.cm}
            @input=${(e: Event) => (this.host._physicalDialog = {
              ...d, cm: (e.target as HTMLInputElement).value,
            })} />
            <span class="opl">${this.host._t(this.host._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span></div>
          ${column && d.shape === 'square' ? html`
            <label>${this.host._t('physical.rotation')}</label>
            <input class="namein tempin" type="number" min="0" max="89.999" step="5"
              .value=${d.angle || '0'}
              @input=${(e: Event) => (this.host._physicalDialog = {
                ...d, angle: (e.target as HTMLInputElement).value,
              })} />` : nothing}
          ${d.length ? html`<div class="muted">${this.host._t('physical.length')}: ${d.length}</div>` : nothing}
        </div>
        <div class="row dialog-action-footer physicalfooter" slot="footer">
          <div class="dialog-action-group dialog-action-danger">
            <button class="btn danger" @click=${() => this._deletePhysicalSelection()}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
            </button>
          </div>
          <div class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" @click=${() => (this.host._physicalDialog = null)}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" @click=${() => this._savePhysicalDialog()}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }

public _renderMarkupBar(): TemplateResult {
    const undoName = this.host._geometryHistory.undoName;
    const redoName = this.host._geometryHistory.redoName;
    const undoTitle = undoName
      ? this.host._t('history.undo_named', { name: undoName })
      : this.host._t('history.undo_empty');
    const redoTitle = redoName
      ? this.host._t('history.redo_named', { name: redoName })
      : this.host._t('history.redo_empty');
    return html`<div class="editbar planbar">
      <div class="editbar-tools" tabindex="-1" ?inert=${this.host._modeTransitionBusy}>
        <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
        <span class="wallsgroup">
        <button class="btn ${this.host._tool === 'select' ? 'on' : ''}"
          @click=${() => this._activateMarkupTool('select')}
          title=${this.host._t('title.markup_select')}>
          <ha-icon icon="mdi:cursor-default-outline"></ha-icon>${this.host._t('markup.select')}
        </button>
        <button class="btn ${this.host._tool === 'draw' ? 'on' : ''}"
          aria-pressed=${this.host._tool === 'draw' ? 'true' : 'false'}
          @click=${() => this._activateMarkupTool('draw')}
          title=${this.host._t('title.markup_add')}>
          <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this.host._t('markup.add')}
        </button>
        <button class="btn ${this.host._tool === 'column' ? 'on' : ''}"
          @click=${() => this._activateMarkupTool('column')}
          title=${this.host._t('title.markup_column')}>
          <ha-icon icon="mdi:vector-square"></ha-icon>${this.host._t('markup.column')}
        </button>
      </span>
      <button class="btn ${this.host._tool === 'merge' ? 'on' : ''}"
        @click=${() => this._activateMarkupTool('merge')}
        title=${this.host._t('title.markup_merge')}>
        <ha-icon icon="mdi:vector-union"></ha-icon>${this.host._t('markup.merge')}
      </button>
      <button class="btn ${this.host._tool === 'split' ? 'on' : ''}"
        @click=${() => this._activateMarkupTool('split')}
        title=${this.host._t('title.markup_split')}>
        <ha-icon icon="mdi:vector-polyline-remove"></ha-icon>${this.host._t('markup.split')}
      </button>
      <button class="btn ${this.host._tool === 'resize' ? 'on' : ''}"
        @click=${() => this._activateMarkupTool('resize')}
        title=${this.host._t('title.markup_resize')}>
        <ha-icon icon="mdi:arrow-expand-all"></ha-icon>${this.host._t('markup.resize')}
      </button>
      ${this.host._editorToolbarGroups.map((group) => this._renderEditorGroupLauncher(group))}
      <button class="btn ${this.host._tool === 'wallthick' ? 'on' : ''}"
        @click=${() => this._activateMarkupTool('wallthick')}
        title=${this.host._t('title.markup_wallthick')}>
        <ha-icon icon="mdi:wall"></ha-icon>${this.host._t('markup.wallthick')}
      </button>
      <button class="btn ${this.host._tool === 'delroom' ? 'on' : ''}"
        @click=${() => this._activateMarkupTool('delroom')}
        title=${this.host._t('title.markup_delroom')}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('markup.delete_room')}
      </button>
      <button class="btn ghost" @click=${() => this._undoGeometry()}
        ?disabled=${!undoName}
        title=${undoTitle} aria-label=${undoTitle}>
        <ha-icon icon="mdi:undo-variant" aria-hidden="true"></ha-icon>
      </button>
      <button class="btn ghost" @click=${() => this._redoGeometry()}
        ?disabled=${!redoName}
        title=${redoTitle} aria-label=${redoTitle}>
        <ha-icon icon="mdi:redo-variant" aria-hidden="true"></ha-icon>
      </button>
      </div>
      <div class="editbar-end">
        <button class="btn barclose" title=${this.host._t('title.close_editor')}
          data-editor-navigation="view"
          @click=${() => this._setMode('view')}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    </div>`;
  }

public _renderDevicesBar(): TemplateResult {
    const undoName = this.host._devicePositionHistory.undoName;
    const redoName = this.host._devicePositionHistory.redoName;
    const undoTitle = undoName
      ? this.host._t('history.undo_named', { name: undoName })
      : this.host._t('history.undo_empty');
    const redoTitle = redoName
      ? this.host._t('history.redo_named', { name: redoName })
      : this.host._t('history.redo_empty');
    return html`<div class="editbar devbar">
      <div class="editbar-tools" tabindex="-1" ?inert=${this.host._modeTransitionBusy}>
        <ha-icon icon="mdi:tune-variant" class="warn"></ha-icon>
        <button class="btn" @click=${() => this._openMarkerDialog()}
          title=${this.host._t('title.add_device')}>
          <ha-icon icon="mdi:plus-box-outline"></ha-icon>${this.host._t('devbar.add')}
        </button>
        <button class="btn ${this.host._showAll ? 'on' : ''}" @click=${() => this._openDeviceInbox()}
          title=${this.host._t('device_inbox.title')}>
          <ha-icon icon="mdi:devices"></ha-icon>${this.host._t('device_inbox.button')}
        </button>
        <button class="btn" @click=${() => this._openRulesDialog()} title=${this.host._t('title.icon_rules')}>
          <ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this.host._t('devbar.rules')}
        </button>
        ${this.host._editorToolbarGroups.map((group) => this._renderEditorGroupLauncher(group))}
      </div>
      <div class="editbar-end">
        <button class="btn ghost" data-device-position-history="undo"
          @click=${() => this.host._undoDevicePosition()}
          ?disabled=${this.host._devicePositionBusy || !undoName}
          title=${undoTitle} aria-label=${undoTitle}>
          <ha-icon icon="mdi:undo-variant" aria-hidden="true"></ha-icon>
        </button>
        <button class="btn ghost" data-device-position-history="redo"
          @click=${() => this.host._redoDevicePosition()}
          ?disabled=${this.host._devicePositionBusy || !redoName}
          title=${redoTitle} aria-label=${redoTitle}>
          <ha-icon icon="mdi:redo-variant" aria-hidden="true"></ha-icon>
        </button>
        <button class="btn barclose" title=${this.host._t('title.close_editor')}
          data-editor-navigation="view"
          @click=${() => this._setMode('view')}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    </div>`;
  }

/** #44: drafts merged over the stored settings — the single truth the
 * preview, the chips and Save all read. */
public _discoveryFilterState(dialog: DeviceInboxDialogState): {
  groupLights: boolean; excluded: string[]; usesProductList: boolean; dirty: boolean;
} {
    const settings = this.host._settings as { group_lights?: boolean; exclude_integrations?: string[] };
    const groupLights = dialog.draftGroupLights !== undefined
      ? dialog.draftGroupLights : settings.group_lights !== false;
    const stored = settings.exclude_integrations;
    const excluded = dialog.draftExcluded !== undefined
      ? (dialog.draftExcluded === null ? [...EXCLUDED_DOMAINS] : dialog.draftExcluded)
      : (stored ? [...stored] : [...EXCLUDED_DOMAINS]);
    const usesProductList = dialog.draftExcluded !== undefined
      ? dialog.draftExcluded === null : !stored;
    const dirty = dialog.draftGroupLights !== undefined || dialog.draftExcluded !== undefined;
    return { groupLights, excluded: excluded.sort(), usesProductList, dirty };
  }

  /** Integrations really present in the HA registry (platforms + device
   * identifier domains), for the exclusion search. */
  private _registryIntegrations(): string[] {
    const found = new Set<string>();
    // Реестр HA нетипизирован на своей стороне, но здесь читаются ровно два
    // поля и оба защищённо, поэтому хватает минимальной структурной формы —
    // она честнее `any`: описывает то, на что код действительно опирается.
    const full = this.host._fullRegistryHass as {
      entities?: Record<string, { platform?: unknown } | undefined>;
      devices?: Record<string, { identifiers?: unknown[] } | undefined>;
    } | null | undefined;
    for (const reg of Object.values(full?.entities || {})) {
      if (reg?.platform) found.add(String(reg.platform));
    }
    for (const device of Object.values(full?.devices || {})) {
      const first = device?.identifiers?.[0];
      const domain = Array.isArray(first) ? first[0] : null;
      if (domain) found.add(String(domain));
    }
    return [...found].sort();
  }

  private _discoveryPreviewMemo: { key: string; value: { appear: number; hide: number; lights: number } } | null = null;

  /** #44 AC6: the preview runs the SAME buildDevices the plan runs — draft
   * settings in, binding sets compared. Memoised so hass ticks while the
   * section is open do not redo discovery. */
public _discoveryFilterPreview(dialog: DeviceInboxDialogState): { appear: number; hide: number; lights: number } {
    const draft = this._discoveryFilterState(dialog);
    const key = [
      draft.groupLights ? 1 : 0, draft.usesProductList ? 'p' : draft.excluded.join(','),
      this.host._cfgEpoch, this.host._regSignature,
    ].join('|');
    if (this._discoveryPreviewMemo?.key === key) return this._discoveryPreviewMemo.value;
    const ctx = {
      hass: this.host.hass,
      registry: this.host._haRegistry,
      areaToSpace: Object.fromEntries(
        Object.entries(this.host._areaToSpace).map(([a, v]) => [a, v.space]),
      ),
      markers: this.host._markers,
      showAll: this.host._showAll,
      firstSpaceId: this.host._model[0]?.id || '',
      loc: (k: string) => this.host._t(k as never),
      iconRules: this.host._iconRules,
    };
    // Two shared builders, zero copies of the filter logic: the exclusion
    // materialises through seedHiddenBindings (hidden markers), the grouping
    // changes the buildDevices candidate set — the preview diffs BOTH.
    const seededOf = (settings: object, excluded: ReadonlySet<string>) => new Set(
      seedHiddenBindings({ ...ctx, settings, excluded } as never));
    const candidatesOf = (settings: object, excluded: ReadonlySet<string>) => new Set(
      buildDevices({ ...ctx, settings, excluded } as never)
        .map((device) => device.bindingRef || device.id));
    const currentExcluded = effectiveExcludedIntegrations(this.host._settings);
    const draftSettings = { ...this.host._settings, group_lights: draft.groupLights };
    const draftExcluded = new Set(draft.excluded);
    const seededNow = seededOf(this.host._settings, currentExcluded);
    const seededNext = seededOf(draftSettings, draftExcluded);
    const candidatesNow = candidatesOf(this.host._settings, currentExcluded);
    const candidatesNext = candidatesOf(draftSettings, draftExcluded);
    let appear = 0, hide = 0, lights = 0;
    const isLight = (binding: string) => binding.includes('light.');
    for (const binding of seededNow) if (!seededNext.has(binding)) { appear++; if (isLight(binding)) lights++; }
    for (const binding of seededNext) if (!seededNow.has(binding)) { hide++; if (isLight(binding)) lights++; }
    for (const binding of candidatesNext) if (!candidatesNow.has(binding)) { appear++; if (isLight(binding)) lights++; }
    for (const binding of candidatesNow) if (!candidatesNext.has(binding)) { hide++; if (isLight(binding)) lights++; }
    const value = { appear, hide, lights };
    this._discoveryPreviewMemo = { key, value };
    return value;
  }

  /** #44: one settings write per Save; defaults are stored as ABSENCE. */
public async _saveDiscoveryFilters(dialog: DeviceInboxDialogState): Promise<void> {
    const cfg = this.host._serverCfg;
    if (!cfg) return;
    const draft = this._discoveryFilterState(dialog);
    const settings: Record<string, unknown> = { ...(cfg.settings as object) };
    if (draft.groupLights) delete settings.group_lights;
    else settings.group_lights = false;
    if (draft.usesProductList) delete settings.exclude_integrations;
    else settings.exclude_integrations = draft.excluded;
    this.host._serverCfg = { ...cfg, settings } as typeof cfg;
    this.host._deviceInboxMemo = null;
    this._discoveryPreviewMemo = null;
    this.host._regSignature = ''; // force the device rebuild to see new filters
    if (this.host._deviceInbox) {
      this.host._deviceInbox = {
        ...dialog, draftGroupLights: undefined, draftExcluded: undefined,
      };
    }
    this._saveConfig();
    this.host._maybeRebuildDevices();
    this.host.requestUpdate();
  }

  private _renderDiscoveryFilters(dialog: DeviceInboxDialogState): TemplateResult {
    const draft = this._discoveryFilterState(dialog);
    const patch = (delta: Partial<DeviceInboxDialogState>) =>
      (this.host._deviceInbox = { ...dialog, ...delta });
    const preview = dialog.filtersOpen && draft.dirty ? this._discoveryFilterPreview(dialog) : null;
    const known = this._registryIntegrations().filter((name) => !draft.excluded.includes(name));
    return html`<details class="device-inbox-discovery" ?open=${dialog.filtersOpen}
        @toggle=${(event: Event) => patch({ filtersOpen: (event.target as HTMLDetailsElement).open })}>
      <summary>${this.host._t('device_inbox.filters_title' as never)}</summary>
      <label class="srcrow">
        <input type="checkbox" .checked=${draft.groupLights}
          @change=${(event: Event) => patch({
            draftGroupLights: (event.target as HTMLInputElement).checked,
          })} />
        ${this.host._t('device_inbox.filters_group_lights' as never)}
      </label>
      <div class="device-inbox-excluded">
        <span>${this.host._t('device_inbox.filters_excluded' as never)}</span>
        <div class="device-inbox-chips">
          ${draft.excluded.map((name) => html`<span class="chip">${name}
            <button type="button" aria-label="×"
              @click=${() => patch({ draftExcluded: draft.excluded.filter((x) => x !== name) })}>×</button>
          </span>`)}
        </div>
        <input type="text" list="hp-discovery-integrations"
          placeholder=${this.host._t('device_inbox.filters_search_ph' as never)}
          @change=${(event: Event) => {
            const input = event.target as HTMLInputElement;
            const name = input.value.trim();
            if (name && !draft.excluded.includes(name)) {
              patch({ draftExcluded: [...draft.excluded, name] });
            }
            input.value = '';
          }} />
        <datalist id="hp-discovery-integrations">
          ${known.map((name) => html`<option value=${name}></option>`)}
        </datalist>
        <button type="button" class="btn ghost" ?disabled=${draft.usesProductList}
          @click=${() => patch({ draftExcluded: null })}>
          ${this.host._t('device_inbox.filters_reset' as never)}
        </button>
      </div>
      ${preview ? html`<div class="device-inbox-preview">
        ${this.host._t('device_inbox.filters_preview_appear' as never, { count: String(preview.appear) })}
        · ${this.host._t('device_inbox.filters_preview_hide' as never, { count: String(preview.hide) })}
        · ${this.host._t('device_inbox.filters_preview_lights' as never, { count: String(preview.lights) })}
      </div>` : nothing}
      <button type="button" class="btn on" ?disabled=${!draft.dirty}
        @click=${() => this._saveDiscoveryFilters(dialog)}>
        ${this.host._t('device_inbox.filters_save' as never)}
      </button>
    </details>`;
  }

public _renderDeviceInbox(): TemplateResult {
    const dialog = this.host._deviceInbox!;
    const rows = this._deviceInboxRows();
    const counts = Object.fromEntries((['on_plan', 'available', 'hidden', 'readd'] as const)
      .map((category) => [category, rows.filter((row) => row.category === category).length]));
    const filtered = filterDeviceInbox(
      rows, dialog.tab, dialog.search, dialog.tab === 'on_plan' && dialog.onlyNew,
    );
    const visible = filtered.slice(0, dialog.limit);
    const tabLabel = (tab: DeviceInboxCategory) => this.host._t(`device_inbox.tab_${tab}` as I18nKey);
    const emptyKey = `device_inbox.empty_${dialog.tab}` as I18nKey;
    const openVirtual = () => {
      this.host._deviceInboxReturn = { ...dialog };
      this.host._deviceInbox = null;
      this._openMarkerDialog();
      if (!this.host._markerDialog) this._closeMarkerDialog();
    };
    return html`<hp-dialog class="device-inbox-dialog" .hass=${this.host.hass}
      .title=${this.host._t('device_inbox.title')} icon="mdi:devices" wide
      @hp-close=${() => (this.host._deviceInbox = null)}>
      <div class="device-inbox" ?inert=${!!dialog.busy}>
        <div class="device-inbox-head">
          <input class="device-inbox-search" type="search" autofocus
            placeholder=${this.host._t('device_inbox.search')} .value=${dialog.search}
            @input=${(event: Event) => (this.host._deviceInbox = {
              ...dialog, search: (event.target as HTMLInputElement).value, limit: 100,
            })} />
          <button type="button" class="btn" @click=${openVirtual}>
            <ha-icon icon="mdi:map-marker-plus-outline"></ha-icon>
            ${this.host._t('device_inbox.add_virtual')}
          </button>
        </div>
        <div class="device-inbox-tabs" role="tablist" @keydown=${(event: KeyboardEvent) => this._deviceInboxTabKey(event)}>
          ${(['on_plan', 'available', 'hidden', 'readd'] as DeviceInboxCategory[]).map((tab) => html`
            <button type="button" role="tab" aria-selected=${dialog.tab === tab ? 'true' : 'false'}
              class=${dialog.tab === tab ? 'on' : ''}
              @click=${() => (this.host._deviceInbox = { ...dialog, tab, limit: 100, onlyNew: false })}>
              ${tabLabel(tab)} <span>${counts[tab]}</span>
            </button>`)}
        </div>
        <div class="device-inbox-filters">
          ${dialog.tab === 'on_plan' ? html`<label>
            <input type="checkbox" .checked=${dialog.onlyNew}
              @change=${(event: Event) => (this.host._deviceInbox = {
                ...dialog, onlyNew: (event.target as HTMLInputElement).checked, limit: 100,
              })} />${this.host._t('device_inbox.only_new')}
          </label>` : nothing}
          ${dialog.tab === 'available' ? html`<label>
            <input type="checkbox" .checked=${dialog.showEntities}
              @change=${(event: Event) => {
                this.host._deviceInboxMemo = null;
                this.host._deviceInbox = {
                  ...dialog, showEntities: (event.target as HTMLInputElement).checked, limit: 100,
                };
              }} />${this.host._t('device_inbox.show_entities')}
          </label>` : nothing}
          <span class="device-inbox-filter-help">
            <label>
              <input type="checkbox" .checked=${this.host._showAll}
                @change=${(event: Event) => {
                  this.host._showHidden = (event.target as HTMLInputElement).checked;
                  this.host._deviceInboxMemo = null;
                  this.host.requestUpdate();
                }} />${this.host._t('device_inbox.show_hidden')}
            </label>
            ${this._help('device_inbox.show_hidden.help')}
          </span>
        </div>
        ${dialog.tab === 'available' ? this._renderDiscoveryFilters(dialog) : nothing}
        <div class="device-inbox-results" aria-live="polite">
          ${visible.length ? visible.map((row) => {
            const primary = row.category === 'on_plan'
              ? row.canFind ? html`<button type="button" class="btn" @click=${() => this._findInboxDevice(row)}>
                  <ha-icon icon="mdi:crosshairs-gps"></ha-icon>${this.host._t('device_inbox.find')}</button>`
                : html`<button type="button" class="btn" @click=${() => this._openInboxMarker(row)}
                    ?disabled=${!row.canEdit}>${this.host._t('device_inbox.edit')}</button>`
              : row.category === 'hidden'
                ? html`<button type="button" class="btn" @click=${() => this._setInboxHidden(row, false)}
                    title=${row.canShow ? '' : this.host._t('device_inbox.show_disabled')}
                    ?disabled=${!row.canShow}>${this.host._t('device_inbox.show')}</button>`
                : html`<button type="button" class="btn" @click=${() => this._openInboxMarker(row, true)}
                    ?disabled=${!row.canAdd}>${this.host._t(row.category === 'readd'
                      ? 'device_inbox.readd' : 'device_inbox.add')}</button>`;
            const status = row.status.kind === 'active' ? ''
              : this.host._t(`device_inbox.status_${row.status.kind}` as I18nKey);
            return html`<article class="device-inbox-row" data-binding=${row.binding}
              data-category=${row.category} data-status=${row.status.kind}>
              <ha-icon class="device-inbox-icon" .icon=${row.icon}></ha-icon>
              <div class="device-inbox-copy">
                <div class="device-inbox-name"><b>${row.name}</b>
                  ${row.isNew ? html`<span class="device-inbox-new">${this.host._t('device_inbox.new')}</span>` : nothing}
                </div>
                <div class="device-inbox-meta">
                  ${[row.model, row.integration, row.spaceName, row.areaName].filter(Boolean).join(' · ')}
                </div>
                <div class="device-inbox-reason">
                  ${row.reason === 'excluded_integration' && row.integration
                    ? this.host._t('device_inbox.reason_excluded_integration',
                        { integration: row.integration })
                    : this.host._t(`device_inbox.reason_${row.reason}` as I18nKey)}
                  ${status ? html`<span class="device-inbox-status">${status}</span>` : nothing}
                </div>
                <code>${row.binding}</code>
              </div>
              <div class="device-inbox-actions">
                ${primary}
                ${row.canEdit || row.canHide || row.category === 'available'
                    || row.category === 'hidden' || this.host._bindingHasHaPage(row.binding) ? html`
                  <details class="device-inbox-menu">
                    <summary class="btn ghost" aria-label=${this.host._t('device_inbox.more_actions')}
                      title=${this.host._t('device_inbox.more_actions')}>
                      <ha-icon icon="mdi:dots-vertical"></ha-icon>
                    </summary>
                    <div class="device-inbox-menu-items">
                      ${row.canEdit && !(row.category === 'on_plan' && !row.canFind)
                        ? html`<button type="button" class="btn ghost" @click=${() => this._openInboxMarker(row)}>
                            ${this.host._t('device_inbox.edit')}</button>` : nothing}
                      ${row.canHide ? html`<button type="button" class="btn ghost"
                        @click=${() => this._setInboxHidden(row, true)}>${this.host._t('device_inbox.hide')}</button>` : nothing}
                      ${row.category === 'available' ? html`<button type="button" class="btn ghost"
                        @click=${() => this._setInboxHidden(row, true)}>${this.host._t('device_inbox.hide_available')}</button>` : nothing}
                      ${row.category === 'hidden' ? html`<button type="button" class="btn ghost"
                        title=${row.canFind ? '' : this.host._t('device_inbox.find_hidden_hint')}
                        ?disabled=${!row.canFind} @click=${() => this._findInboxDevice(row)}>
                        <ha-icon icon="mdi:crosshairs-gps"></ha-icon>${this.host._t('device_inbox.find')}</button>` : nothing}
                      ${this.host._bindingHasHaPage(row.binding) ? html`<button type="button" class="btn ghost"
                        @click=${() => this.host._openBindingInHa(row.binding)}>${this.host._t('btn.open_in_ha')}</button>` : nothing}
                    </div>
                  </details>` : nothing}
              </div>
            </article>`;
          }) : html`<div class="device-inbox-empty">${this.host._t(emptyKey)}</div>`}
        </div>
        ${filtered.length > visible.length ? html`<button type="button" class="btn device-inbox-more"
          @click=${() => (this.host._deviceInbox = { ...dialog, limit: dialog.limit + 100 })}>
          ${this.host._t('device_inbox.show_more')} (${filtered.length - visible.length})
        </button>` : nothing}
      </div>
      <div slot="footer" class="row">
        <button type="button" class="btn ghost" @click=${() => (this.host._deviceInbox = null)}>
          ${this.host._t('btn.close')}</button>
      </div>
    </hp-dialog>`;
  }

public _markerValueBadgeFields(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
  ): Pick<Marker, 'value_badge'> | Record<string, never> {
    return valueBadgeWriteFields({
      touched: d.valueBadgeTouched,
      originalHas: d.originalHasValueBadge,
      original: d.originalValueBadge,
      enabled: d.valueBadgeEnabled,
      source: d.valueBadgeSource,
      position: d.valueBadgePosition,
    });
  }

public _markerValueSourceFields(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
  ): Pick<Marker, 'value_source'> | Record<string, never> {
    return valueSourceWriteFields({
      touched: d.valueSourceTouched,
      originalHas: d.originalHasValueSource,
      original: d.originalValueSource,
      source: d.valueSource,
    });
  }

public _markerDraft(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>): Marker | null {
    if (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual')) return null;
    const roomRef = parseRoomRef(d.room);
    const id = markerIdForBinding(d.binding, d.devId, () => '__hp_device_preview__');
    const previous = this.host._markers.find((marker) => marker.id === id || marker.id === d.devId);
    const controls = persistedExternalControls(
      d.binding, d.controls, this.host._bindingEntities(d.binding),
    );
    const effectiveTapAction = this._effectiveStoredTapAction(d);
    const marker: Marker = {
      id,
      binding: d.binding,
      name: d.name.trim() || null,
      icon: d.icon || null,
      display: d.display !== 'badge' ? d.display : null,
      ripple_color: d.display === 'icon_ripple' && d.rippleColor ? d.rippleColor : null,
      ripple_size: d.display === 'icon_ripple' && d.rippleSize !== 1.5 ? d.rippleSize : null,
      size: d.size !== 1 ? d.size : null,
      angle: d.angle || null,
      ...this._markerTapActionFields(d),
      ...this._markerToggleEntityFields(d),
      tap_target: effectiveTapAction === 'run' ? d.tapTarget || null : null,
      tap_confirm: d.tapConfirm ? true : null,
      controls: controls.length ? controls : null,
      ...this._markerLightFields(d),
      ...this._markerValueBadgeFields(d),
      ...this._markerValueSourceFields(d),
      use_climate_temp: d.useClimateTemp ? true : null,
      glow_radius_cm: (() => {
        const value = strictNumber(d.glowRadius);
        if (value == null || value <= 0) return null;
        return Math.round(this.host._imperial ? value * 30.48 : value * 100);
      })(),
      model: d.model.trim() || null,
      link: d.link.trim() || null,
      description: d.description.trim() || null,
      pdfs: d.pdfs,
      hidden: d.hideFromPlan,
      vacuum: previous?.vacuum || null,
    };
    const previousExplicit = !!previous && (
      (typeof previous.area === 'string' && previous.area.length > 0)
      || (previous.area === null && !!previous.space && !!previous.room_id)
    );
    if (d.binding === 'virtual' || d.roomTouched) {
      marker.space = roomRef?.space || (d.binding === 'virtual' ? this.host._space : null);
      marker.area = roomRef?.area || null;
      marker.room_id = roomRef?.roomId || null;
    } else if (previousExplicit) {
      marker.space = previous!.space;
      marker.area = previous!.area;
      marker.room_id = previous!.room_id;
    }
    return marker;
  }

public _markerPreviewDevice(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>): DevItem | null {
    const marker = this._markerDraft(d);
    if (!marker) return null;
    const key = `${this.host._haRegistry.revision}\n${contentFingerprint(this.host._markers)}\n${JSON.stringify(marker)}`;
    if (this.host._markerPreviewMemo?.key === key) return this.host._markerPreviewMemo.device;
    const device = deviceFromMarkerDraft({
      hass: this.host.hass,
      registry: this.host._haRegistry,
      areaToSpace: Object.fromEntries(
        Object.entries(this.host._areaToSpace).map(([area, value]) => [area, value.space]),
      ),
      marker,
      siblingMarkers: this.host._markers,
      settings: this.host._settings,
      excluded: this.host._excluded,
      showAll: this.host._showAll,
      firstSpaceId: this.host._model[0]?.id || this.host._space,
      loc: (key) => this.host._t(key),
      iconRules: this.host._iconRules,
    });
    this.host._markerPreviewMemo = { key, device };
    return device;
  }

public _markerPreviewDevices(preview: DevItem): readonly DevItem[] {
    const memo = this.host._markerPreviewDevicesMemo;
    if (memo?.base === this.host._devices && memo.preview === preview) return memo.devices;
    const devices = [...this.host._devices.filter((item) => item.id !== preview.id), preview];
    this.host._markerPreviewDevicesMemo = { base: this.host._devices, preview, devices };
    return devices;
  }

public _toggleIntent(
    device: DevItem,
    devices: readonly DevItem[] = this.host._devices,
  ): ResolvedToggleIntent | null {
    // #357: the View card owns toggle resolution — a plain tap must work on a
    // cold tab that never loaded this runtime. Editor consumers delegate back.
    return this.host._toggleIntent(device, devices);
  }

public _toggleIntentForDialog(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
  ): ResolvedToggleIntent | null {
    const preview = this._markerPreviewDevice(d);
    if (!preview) return null;
    const devices = this._markerPreviewDevices(preview);
    return this._toggleIntent(preview, devices);
  }

public _toggleStateText(entityId: string, fallback: string): string {
    return this.host._toggleStateText(entityId, fallback);
  }

public _toggleConfirmationStateText(target: ResolvedToggleTarget): string {
    return this.host._toggleConfirmationStateText(target);
  }

public _toggleConfirmationLines(intent: ResolvedToggleIntent): string[] {
    return this.host._toggleConfirmationLines(intent);
  }

public _toggleHintLines(intent: ResolvedToggleIntent | null): string[] {
    if (!intent) return [];
    const effect = (value: ToggleNextEffect): string =>
      this.host._t(`marker.toggle_effect_${value.replace('-', '_')}` as I18nKey);
    const skipReason = (value: ToggleSkipReason): string =>
      this.host._t(`marker.toggle_skip_${value.replace('-', '_')}` as I18nKey);
    return formatToggleIntent(intent, {
      single: (target) => {
        if ('via' in target && target.via === 'virtual-light') {
          return this.host._t('marker.virtual_light_target', { name: target.name });
        }
        const entityId = target.entityId || ('ref' in target ? target.ref : '');
        const name = target.name || entityId;
        return this.host._t('marker.toggle_hint_single', { name, id: entityId });
      },
      group: (targets) => this.host._t('marker.toggle_hint_group', {
        count: targets.length,
        names: targets.map((target) => `${target.name} (${target.entityId})`).join(', '),
      }),
      currentNext: (target, next) => target.via === 'virtual-light'
        ? this.host._t('marker.virtual_light_current', {
          state: this.host._t(target.state === 'on'
            ? 'marker.virtual_light_state_on' : 'marker.virtual_light_state_off'),
          effect: effect(next),
        })
        : this.host._t('marker.toggle_hint_current', {
          state: this._toggleStateText(target.entityId, target.state),
          effect: effect(next),
        }),
      groupCurrentNext: (targets, next) => this.host._t('marker.toggle_hint_group_current', {
        on: targets.filter((target) => target.state === 'on').length,
        count: targets.length,
        effect: effect(next),
      }),
      skipped: (targets) => this.host._t('marker.toggle_hint_skipped', {
        count: targets.length,
        targets: targets.map((target) => {
          const id = target.entityId || target.ref;
          return `${target.name || id} (${id}: ${skipReason(target.reason)})`;
        }).join(', '),
      }),
      none: (reason: ToggleNoneReason) =>
        this.host._t(`marker.toggle_none_${reason.replaceAll('-', '_')}` as I18nKey),
    });
  }

public _effectiveStoredTapAction(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>, primaryDomain?: string,
  ): string {
    return d.tapActionTouched
      ? d.tapAction
      : projectedTapAction(
          d.originalHasTapAction ? d.originalTapAction : null,
          primaryDomain,
        );
  }

public _effectiveMarkerTapAction(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
    preview = this._markerPreviewDevice(d),
  ): string {
    return this._effectiveStoredTapAction(d, preview?.primary?.split('.')[0]);
  }

public _announceToggleDraft(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>,
  ): NonNullable<HouseplanEditorHostPort['_markerDialog']> {
    const preview = this._markerPreviewDevice(d);
    const next = !d.tapActionTouched
      ? { ...d, tapAction: this._effectiveMarkerTapAction(d, preview) }
      : d;
    const text = next.tapAction === 'toggle'
      ? this._toggleHintLines(this._toggleIntentForDialog(next)).join(' ')
      : '';
    return { ...next, tapHintAnnouncement: text };
  }

public _valueBadgeForBinding(
    d: NonNullable<HouseplanEditorHostPort['_markerDialog']>, binding: string,
  ): Pick<NonNullable<HouseplanEditorHostPort['_markerDialog']>,
    'valueBadgeEnabled' | 'valueBadgeSource' | 'valueBadgeTouched'> {
    const draft = {
      ...d, binding,
      valueBadgeEnabled: false, valueBadgeSource: null, valueBadgeTouched: true,
    };
    const device = this._markerPreviewDevice(draft);
    if (!device) return { valueBadgeEnabled: false, valueBadgeSource: null, valueBadgeTouched: true };
    const lightDevices = [...this.host._devices.filter((item) => item.id !== device.id), device];
    const candidates = valueBadgeCandidates(this.host._planHass, device, lightDevices);
    const source = recommendedValueBadgeSource(this.host._planHass, device, candidates);
    return {
      valueBadgeEnabled: d.valueBadgeEnabled && !!source,
      valueBadgeSource: source,
      valueBadgeTouched: true,
    };
  }

public _markerSpatialSource(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>) {
    const device = this._markerPreviewDevice(d);
    if (!device) return null;
    const preview = { ...device, hidden: false };
    return selectSpatialGlowSource(resolvedLightSources(this.host._planHass, [
      ...this.host._devices.filter((item) => item.id !== preview.id), preview,
    ], null, this.host._virtualLights).filter((source) => source.device.id === preview.id));
  }

public _markerAutoHasSpatialSource(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>): boolean {
    const autoDraft = { ...d, lightRole: 'auto' as const, lightRoleTouched: true };
    const device = this._markerPreviewDevice(autoDraft);
    return !!device && hasOwnSpatialSource(this.host._planHass, { ...device, hidden: false });
  }

public _setMarkerLightRole(role: 'auto' | 'always' | 'never'): void {
    const d = this.host._markerDialog;
    if (!d) return;
    this.host._markerDialog = { ...d, lightRole: role, lightRoleTouched: true };
  }

public _controlRefInfo(ref: string): { label: string; sub: string; icon: string; warning: boolean } {
    if (!ref.startsWith('marker:')) {
      return {
        label: this.host.hass.states[ref]?.attributes?.friendly_name || ref,
        sub: ref,
        icon: ref.startsWith('light.') ? 'mdi:lightbulb' : 'mdi:toggle-switch',
        warning: !this.host._planEntityAvailable(ref),
      };
    }
    const id = ref.slice('marker:'.length);
    const marker = this.host._markers.find((item) => item.id === id);
    const device = this.host._devices.find((item) => item.id === id);
    if (!marker || marker.removed || marker.is_light !== true) {
      return {
        label: this.host._t('marker.control_missing_label'),
        sub: `${this.host._t('marker.control_broken')} (${ref})`,
        icon: 'mdi:alert-outline', warning: true,
      };
    }
    const space = this.host._serverCfg?.spaces.find((item) => item.id === (device?.space || marker.space));
    const stateful = !!device && ownControllableEntities(device).length > 0;
    return {
      label: marker.name || device?.name || id,
      sub: [space?.title || device?.space || marker.space, marker.room_id || device?.area,
        stateful ? '' : this.host._t('marker.control_passive')].filter(Boolean).join(' · '),
      icon: marker.icon || device?.icon || 'mdi:lightbulb-outline',
      warning: marker.hidden === true || device?.hidden === true,
    };
  }

public _valueBadgeCandidateLabel(candidate: ValueBadgeCandidate): string {
    const source = candidate.source;
    if (source.kind === 'derived_lqi') return this.host._t('marker.value_badge_lqi');
    if (source.kind === 'derived_marker_state') {
      return this.host._t('marker.value_badge_marker_state', { name: candidate.label });
    }
    if (source.kind === 'entity_state') {
      return this.host._t('marker.value_badge_state', { name: candidate.label });
    }
    const entityName = this.host.hass.states[source.entity_id]?.attributes?.friendly_name
      || this.host._fullRegistryHass.entities[source.entity_id]?.name || source.entity_id;
    return this.host._t(`marker.value_badge_attr_${source.attribute}` as I18nKey, { name: entityName });
  }

public _controlCandidates(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>): {
    value: string; label: string; sub: string; icon: string;
  }[] {
    const currentId = this._markerDraft(d)?.id || d.devId || '';
    const plan: { value: string; label: string; sub: string; icon: string; search: string }[] = [];
    const coveredEntities = new Set<string>();
    for (const marker of this.host._markers) {
      if (marker.id === currentId || marker.removed || marker.hidden || marker.is_light !== true) continue;
      if (marker.binding !== 'virtual' && this.host._bindingStatus(marker.binding).kind !== 'active') continue;
      const device = this.host._devices.find((item) => item.id === marker.id);
      if (!device || device.hidden) continue;
      const info = this._controlRefInfo(`marker:${marker.id}`);
      for (const eid of ownControllableEntities(device)) coveredEntities.add(eid);
      plan.push({
        value: `marker:${marker.id}`, label: info.label, sub: info.sub, icon: info.icon,
        search: `${info.label} ${info.sub} ${marker.id} ${ownControllableEntities(device).join(' ')}`.toLowerCase(),
      });
    }
    const ha = Object.keys(this.host.hass.states || {})
      .filter((eid) => isControllable(eid) && !coveredEntities.has(eid)
        && effectiveMarkerControls(d.binding, [eid], this.host._bindingEntities(d.binding)).length > 0
        && this.host._planEntityAvailable(eid))
      .map((eid) => {
        const info = this._controlRefInfo(eid);
        return { value: eid, label: info.label, sub: eid, icon: info.icon,
          search: `${info.label} ${eid}`.toLowerCase() };
      });
    const q = d.controlsFilter.trim().toLowerCase();
    return [...plan, ...ha]
      .filter((item) => !d.controls.includes(item.value) && (!q || item.search.includes(q)))
      .slice(0, 12)
      .map(({ search: _search, ...item }) => item);
  }

public _addControlRef(d: NonNullable<HouseplanEditorHostPort['_markerDialog']>, ref: string): void {
    if (ref.startsWith('marker:')) {
      const controllerId = this._markerDraft(d)?.id || d.devId || '';
      if (!controllerId) {
        this.host._showToast(this.host._t('toast.marker_binding_required'));
        return;
      }
      const targetId = ref.slice('marker:'.length);
      const draft = this._markerDraft(d);
      const graph = draft
        ? [...this.host._markers.filter((marker) => marker.id !== controllerId), draft]
        : this.host._markers;
      if (markerControlWouldCycle(graph, controllerId, targetId)) {
        this.host._showToast(this.host._t('toast.marker_control_cycle'));
        return;
      }
    }
    this.host._markerDialog = this._announceToggleDraft({
      ...d, controls: [...d.controls, ref], controlsFilter: '',
    });
  }

public _setMarkerGlowMode(mode: 'auto' | 'color' | 'fixed'): void {
    const d = this.host._markerDialog;
    if (!d) return;
    if (mode === 'auto') {
      this.host._markerDialog = { ...d, glowMode: mode, glowTouched: true };
      return;
    }
    const source = this._markerSpatialSource(d);
    const values = resolveGlowValues(
      source ? this.host._planHass.states[source.eid] : undefined,
      null,
      this.host._fillColors.glow_light.c,
    );
    const needColor = !d.glowColorDrafted;
    const needBrightness = mode === 'fixed' && !d.glowBrightnessDrafted;
    this.host._markerDialog = {
      ...d,
      glowMode: mode,
      glowColor: needColor ? values.c : d.glowColor,
      glowBrightness: needBrightness ? Math.max(1, Math.round(values.bri * 100)) : d.glowBrightness,
      glowColorDrafted: true,
      glowBrightnessDrafted: d.glowBrightnessDrafted || mode === 'fixed',
      glowTouched: true,
    };
  }

public _renderMarkerDialog(): TemplateResult {
    const d = this.host._markerDialog!;
    const isVirtual = d.bindingMode === 'virtual';
    const cands = this._bindingCandidates();
    const ownEntities = this.host._bindingEntities(d.binding);
    const bindingStatus = isVirtual ? null : this.host._bindingStatus(d.binding);
    const canOpenBindingInHa = !isVirtual && this.host._bindingHasHaPage(d.binding);
    const previewDevice = this._markerPreviewDevice(d);
    // Untouched defaults are projections, not stored values. Re-resolve the
    // select from the current preview on every render: HA may reveal a more
    // meaningful leading entity (most visibly `light.*`) after the dialog was
    // opened. Runtime already uses that current primary, so keeping the stale
    // draft value here made the select say "Device card" while a tap toggled
    // the lamp. An explicit user choice remains authoritative and stable.
    const effectiveTapAction = this._effectiveMarkerTapAction(d, previewDevice);
    const previewSpaceDisplay = previewDevice
      ? spaceDisplayOf(this.host._serverCfg?.spaces.find((space) => space.id === previewDevice.space))
      : null;
    const previewLightDevices = previewDevice
      ? this._markerPreviewDevices(previewDevice)
      : this.host._devices;
    const toggleIntent = effectiveTapAction === 'toggle' && previewDevice
      ? this._toggleIntent(previewDevice, previewLightDevices) : null;
    const toggleHintLines = this._toggleHintLines(toggleIntent);
    const previewPresentation = previewDevice
      ? resolveDevicePresentation(this.host._planHass, previewDevice, {
          liveStates: this.host._config?.live_states !== false,
          showTemperature: this.host._config?.show_temperature !== false,
          showSignal: previewSpaceDisplay?.showLqi ?? (this.host._config?.show_signal !== false),
          designPreview: true,
          activityRuntime: this.host._activityRt.get(previewDevice.id),
          lightDevices: previewLightDevices,
          registryHass: this.host._fullRegistryHass,
          reducedMotion: this.host._reducedMotion,
        })
      : null;
    const badgeCandidates = previewDevice
      ? valueBadgeCandidates(this.host._planHass, previewDevice, previewLightDevices) : [];
    const badgeRecommendation = previewDevice
      ? recommendedValueBadgeSource(this.host._planHass, previewDevice, badgeCandidates) : null;
    const effectiveBadgeEnabled = d.valueBadgeTouched
      ? d.valueBadgeEnabled : !!previewPresentation?.valueBadge;
    const effectiveBadgeSource = d.valueBadgeTouched
      ? d.valueBadgeSource : previewPresentation?.valueBadge?.source || d.valueBadgeSource;
    const effectiveBadgePosition = d.valueBadgeTouched
      ? d.valueBadgePosition : previewPresentation?.valueBadge?.position || d.valueBadgePosition;
    const badgeSourceKey = valueBadgeSourceKey(effectiveBadgeSource);
    const badgeSourceMissing = !!effectiveBadgeSource
      && !badgeCandidates.some((item) => item.key === badgeSourceKey);
    const selectedBadgeCandidate = badgeCandidates.find((item) => item.key === badgeSourceKey);
    const valueSourceKey = valueBadgeSourceKey(d.valueSource);
    const valueSourceMissing = !!d.valueSource && (!valueSourceKey
      || !badgeCandidates.some((item) => item.key === valueSourceKey));
    const selectedValueSourceCandidate = badgeCandidates.find((item) => item.key === valueSourceKey);
    const innerValueSourceKey = previewPresentation?.valueSource?.sourceKey || '';
    const autoHasSpatialSource = this._markerAutoHasSpatialSource(d);
    const statefulSource = !!previewDevice
      && hasOwnStatefulLightSource(this.host._planHass, { ...previewDevice, hidden: false });
    const lightSettings = resolveDeviceLightSettings(
      d.lightRole, autoHasSpatialSource, statefulSource, d.glowMode,
    );
    const glowSourceDisabled = !lightSettings.sourceExists;
    const liveGlowDisabled = !lightSettings.fromSourceEnabled;
    const passiveSource = lightSettings.passive;
    const displayedGlowMode = lightSettings.effectiveMode;
    const glowDisabledHint = d.lightRole === 'never'
      ? this.host._t('marker.glow_disabled_never')
      : d.lightRole === 'auto' && !autoHasSpatialSource
        ? this.host._t('marker.glow_disabled_auto')
        : passiveSource ? this.host._t('marker.glow_passive_hint')
          : this.host._t('marker.glow_disabled_no_entity');
    const leadingEntities = previewDevice ? ownControllableEntities(previewDevice) : [];
    // Keep the fallback text aligned with the production resolver. In
    // particular, an entity binding or the resolved primary may precede the
    // registry order used for the remaining candidates.
    const effectiveLeading = previewDevice ? forcedLightEntityOf(previewDevice) || '' : '';
    const staleLeading = !!d.lightEntity && !leadingEntities.includes(d.lightEntity);
    const toggleEntities = previewDevice ? toggleEntityCandidates(previewDevice) : [];
    const staleToggleEntity = !!d.toggleEntity && !toggleEntities.includes(d.toggleEntity);
    const automaticToggleIntent = effectiveTapAction === 'toggle'
      ? this._toggleIntentForDialog({ ...d, toggleEntity: '', toggleEntityTouched: true })
      : null;
    const automaticToggleTarget = automaticToggleIntent
      ? [...automaticToggleIntent.targets, ...automaticToggleIntent.skippedTargets]
        .map((target) => target.entityId || ('ref' in target ? target.ref : ''))
        .filter(Boolean)
        .join(', ')
      : '';
    const curLabel = (() => {
      if (isVirtual) return null;
      const found = cands.find((c) => c.value === d.binding);
      if (found) return found.label;
      const [k, ref] = d.binding.split(':');
      if (k === 'device') return this.host._fullRegistryHass.devices[ref]?.name_by_user || this.host._fullRegistryHass.devices[ref]?.name || ref;
      return this.host._fullRegistryHass.entities[ref]?.name || this.host.hass.states[ref]?.attributes?.friendly_name || ref;
    })();
    return html`<hp-dialog .hass=${this.host.hass}
      .title=${d.devId ? this.host._t('info.device_header') : this.host._t('marker.new_device')}
      icon="mdi:shape-plus" wide @hp-close=${() => this._closeMarkerDialog()}>
        <div class="body">
          ${bindingStatus?.kind === 'ha_disabled'
            ? html`<div class="habindingbanner" role="status">
                <ha-icon icon="mdi:power-plug-off-outline"></ha-icon>
                <span>${this.host._t(`marker.ha_disabled_${bindingStatus.reason}` as I18nKey)}</span>
                ${canOpenBindingInHa
                  ? html`<button class="btn ghost" type="button" @click=${() => this.host._openBindingInHa(d.binding)}>
                      <ha-icon icon="mdi:open-in-new"></ha-icon>${this.host._t('btn.open_in_ha')}
                    </button>`
                  : nothing}
              </div>`
            : bindingStatus?.kind === 'unverified' && !!d.binding
              ? html`<div class="habindingbanner limited" role="status">
                  <ha-icon icon="mdi:shield-alert-outline"></ha-icon>
                  <span>${this.host._t('marker.ha_registry_limited')}</span>
                </div>`
              : nothing}
          <label>${this.host._t('marker.name_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('marker.name_ph')}
            .value=${d.name}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, name: (e.target as HTMLInputElement).value })} />

          <label>${this.host._t('marker.binding_label')}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${d.bindingMode === 'virtual'}
                @change=${() => {
                  // #385(а) r2-M1: no same-binding guard here on purpose — a
                  // radio input fires no change event when it is already
                  // checked, so this branch runs only on an actual switch to
                  // virtual; the reset below is therefore always legitimate.
                  const next = {
                    ...d, bindingMode: 'virtual' as const, binding: 'virtual', bindingOpen: false,
                    controls: persistedExternalControls('virtual', d.controls),
                    autoIcon: this.host._autoIconForBinding('virtual'),
                  };
                  this.host._markerDialog = this._announceToggleDraft({
                    ...next, ...this._valueBadgeForBinding(next, 'virtual'),
                    valueSource: null, valueSourceTouched: true,
                  });
                }} />
              <span>${this.host._t('marker.virtual_option')}</span>
            </label>
            <div class="bindharow">
              <label class="srcrow">
                <input type="radio" name="bmode" .checked=${d.bindingMode === 'ha'}
                  @change=${() => (this.host._markerDialog = this._announceToggleDraft({
                    ...d, bindingMode: 'ha',
                    binding: d.binding === 'virtual' ? '' : d.binding,
                    bindingOpen: d.binding === 'virtual' || !d.binding,
                  }))} />
                <span>${this.host._t('marker.from_ha_option')}</span>
              </label>
              <label class="srcrow inline entcheck" title=${this.host._t('marker.show_entities_tip')}>
                ${this._boolInput(d.showEntities, (v) => (this.host._markerDialog = { ...d, showEntities: v }),
                  d.bindingMode !== 'ha')}
                <span>${this.host._t('marker.show_entities')}</span>
              </label>
            </div>
            ${d.bindingMode === 'ha'
              ? html`<button class="dropbtn ${d.bindingOpen ? 'open' : ''}"
                    @click=${() => (this.host._markerDialog = { ...d, bindingOpen: !d.bindingOpen })}>
                    ${curLabel
                      ? html`<b>${curLabel}</b><span class="ref">${d.binding}${bindingStatus?.kind === 'ha_disabled'
                          ? ` · ${this.host._t('marker.binding_disabled')}` : ''}</span>`
                      : html`<span class="muted">${this.host._t('marker.pick_ph')}</span>`}
                    <ha-icon icon=${d.bindingOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
                  </button>
                  ${d.bindingOpen
                    ? html`<div class="droppanel">
                        <input class="namein" type="text" placeholder=${this.host._t('marker.search_ph')}
                          .value=${d.bindingFilter}
                          @input=${(e: Event) => (this.host._markerDialog = { ...d, bindingFilter: (e.target as HTMLInputElement).value })} />
                        <div class="candlist">
                          ${cands.map(
                            (c) => html`<div class="cand ${c.value === d.binding ? 'sel' : ''}"
                              @click=${() => {
                                // #385(а): same-binding click is a no-op —
                                // only an actual change resets value source
                                // and badge (spec #378 §1.6).
                                if (c.value === d.binding) {
                                  this.host._markerDialog = { ...d, bindingOpen: false };
                                  return;
                                }
                                const next = {
                                  ...d, binding: c.value, bindingOpen: false,
                                  controls: persistedExternalControls(
                                    c.value, d.controls, this.host._bindingEntities(c.value),
                                  ),
                                  autoIcon: this.host._autoIconForBinding(c.value),
                                };
                                this.host._markerDialog = this._announceToggleDraft({
                                  ...next, ...this._valueBadgeForBinding(next, c.value),
                                  valueSource: null, valueSourceTouched: true,
                                });
                              }}>
                              <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                            </div>`,
                          )}
                          ${!cands.length ? html`<div class="cand muted">${this.host._t('marker.nothing_found')}</div>` : nothing}
                        </div>
                      </div>`
                    : nothing}`
              : nothing}
          </div>

          <label for="marker-room">${this.host._t('marker.room_label')}${isVirtual ? '' : this.host._t('marker.room_override')}</label>
          <select id="marker-room" class="areasel"
            @change=${(e: Event) => (this.host._markerDialog = {
              ...d, room: (e.target as HTMLSelectElement).value, roomTouched: true,
            })}>
            <option value="" ?selected=${!d.room}>
              ${isVirtual ? this.host._t('marker.room_choose') : this.host._t('marker.room_auto')}
            </option>
            ${this.host._allRoomsFlat().map(
              (r) => html`<option value=${r.value} ?selected=${r.value === d.room}>${r.label}</option>`,
            )}
          </select>

          ${this._renderVacSection(d)}

          <label>${this.host._t('marker.tap_label')}</label>
          <select id="marker-tap-action" class="areasel"
            aria-describedby=${effectiveTapAction === 'toggle' ? 'marker-toggle-hint' : nothing}
            @change=${(e: Event) => {
              const next = {
                ...d,
                tapAction: (e.target as HTMLSelectElement).value,
                tapActionTouched: true,
              };
              this.host._markerDialog = this._announceToggleDraft(next);
            }}>
            ${TAP_ACTIONS.map((v) => [v, 'tap.' + v.replace('-', '_')] as const).map(
              ([v, k]) => html`<option value=${v} ?selected=${v === effectiveTapAction}>
                ${this.host._t(k as any)}
              </option>`,
            )}
          </select>
          ${effectiveTapAction === 'toggle'
            && (toggleEntities.length > 1 || staleToggleEntity)
            ? html`<div class="markerhelpfield markertoggleentity">
                <div class="markerhelplabel">
                  <label for="marker-toggle-entity">${this.host._t('marker.toggle_entity_label')}</label>
                  ${this._help('marker.toggle_entity.help')}
                </div>
                <select id="marker-toggle-entity" class="areasel"
                  @change=${(e: Event) => {
                    const next = {
                      ...d,
                      toggleEntity: (e.target as HTMLSelectElement).value,
                      toggleEntityTouched: true,
                    };
                    this.host._markerDialog = this._announceToggleDraft(next);
                  }}>
                  <option value="" ?selected=${staleToggleEntity || !d.toggleEntity}>
                    ${this.host._t('marker.toggle_entity_auto', {
                      entity: automaticToggleTarget || this.host._t('marker.toggle_entity_none'),
                    })}
                  </option>
                  ${toggleEntities.map((eid) => html`<option value=${eid}
                    ?selected=${!staleToggleEntity && eid === d.toggleEntity}>
                    ${this.host.hass.states[eid]?.attributes?.friendly_name
                      || this.host._fullRegistryHass.entities[eid]?.name || eid} · ${eid}
                  </option>`)}
                </select>
                ${staleToggleEntity ? html`<p class="muted markerlightwarning" role="status">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  ${this.host._t('marker.toggle_entity_missing', {
                    entity: d.toggleEntity,
                    fallback: automaticToggleTarget || this.host._t('marker.toggle_entity_none'),
                  })}
                </p>` : nothing}
              </div>`
            : nothing}
          ${effectiveTapAction === 'toggle'
            ? html`<div id="marker-toggle-hint" class="rhint togglehint">
                ${toggleHintLines.map((line) => html`<div>${line}</div>`)}
              </div>
              <div class="sr-only" role="status" aria-live="polite">${d.tapHintAnnouncement}</div>`
            : nothing}
          ${effectiveTapAction === 'run'
            ? (() => {
                const q = d.runFilter.trim().toLowerCase();
                const cands = this._runCandidates().filter(
                  (c) => !q || c.label.toLowerCase().includes(q) || c.value.includes(q),
                );
                const cur = d.tapTarget ? this._runCandidates().find((c) => c.value === d.tapTarget) : null;
                return html`
                  <label>${this.host._t('marker.run_target_label')}</label>
                  ${d.tapTarget && !cur
                    ? html`<div class="rhint">${this.host._t('marker.run_target_gone', { id: d.tapTarget })}</div>`
                    : nothing}
                  <input class="namein" type="text" placeholder=${this.host._t('marker.run_search_ph')}
                    .value=${cur ? cur.label : d.runFilter}
                    @focus=${(e: Event) => { (e.target as HTMLInputElement).select(); }}
                    @input=${(e: Event) => (this.host._markerDialog = { ...d, runFilter: (e.target as HTMLInputElement).value, tapTarget: '' })} />
                  ${!cur
                    ? html`<div class="candlist">
                        ${cands.slice(0, 40).map(
                          (c) => html`<div class="cand ${c.value === d.tapTarget ? 'sel' : ''}"
                            @click=${() => (this.host._markerDialog = { ...d, tapTarget: c.value, runFilter: '' })}>
                            <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                          </div>`,
                        )}
                        ${!cands.length ? html`<div class="cand muted">${this.host._t('marker.nothing_found')}</div>` : nothing}
                      </div>`
                    : nothing}`;
              })()
            : nothing}
          ${effectiveTapAction === 'run' || effectiveTapAction === 'toggle'
            ? html`<label class="srcrow" title=${this.host._t('marker.tap_confirm_tip')}>
                ${this._boolInput(d.tapConfirm, (v) => (this.host._markerDialog = { ...d, tapConfirm: v }))}
                <span>${this.host._t('marker.tap_confirm')}</span>
              </label>`
            : nothing}

          <div class="helpfieldlabel">
            <label for="marker-controls-filter">${this.host._t('marker.controls_label')}</label>
            ${this._help('marker.controls.help')}
          </div>
          ${d.controls.length
            ? html`<div class="ctrlchips">
                ${d.controls.map((eid) => {
                  const info = this._controlRefInfo(eid);
                  return html`<span class="ctrlchip ${info.warning ? 'warning' : ''}" title=${info.sub}>
                  <ha-icon icon=${info.icon}></ha-icon>${info.label}
                  <ha-icon icon="mdi:close" @click=${() =>
                    (this.host._markerDialog = this._announceToggleDraft({
                      ...d, controls: d.controls.filter((x) => x !== eid),
                    }))}></ha-icon>
                </span>`;
                })}
              </div>`
            : nothing}
          <input id="marker-controls-filter" class="namein" type="text" placeholder=${this.host._t('marker.controls_filter')}
            .value=${d.controlsFilter}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, controlsFilter: (e.target as HTMLInputElement).value })} />
          ${d.controlsFilter.trim()
            ? html`<div class="ctrllist">
                ${this._controlCandidates(d).map((candidate) => html`<button class="ctrlopt"
                    @click=${() => this._addControlRef(d, candidate.value)}>
                    <ha-icon icon=${candidate.icon}></ha-icon>
                    ${candidate.label}
                    <span class="sub">${candidate.sub}</span>
                  </button>`)}
              </div>`
            : nothing}

          ${this.host._bindingHasClimate(d.binding)
            ? html`<label class="srcrow climrow" title=${this.host._t('marker.use_climate_temp_tip')}>
                ${this._boolInput(d.useClimateTemp, (v) => (this.host._markerDialog = { ...d, useClimateTemp: v }))}
                <span>${this.host._t('marker.use_climate_temp')}</span>
              </label>`
            : nothing}
          <fieldset class="markerlightgroup">
            <legend><span>${this.host._t('marker.light_role_label')}</span>${this._help('marker.light_role.help')}</legend>
            <div class="markerradios" role="radiogroup" aria-label=${this.host._t('marker.light_role_label')}>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="auto"
                .checked=${d.lightRole === 'auto'} @change=${() => this._setMarkerLightRole('auto')} />
                <span>${this.host._t(autoHasSpatialSource ? 'marker.light_role_auto_yes' : 'marker.light_role_auto_no')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="always"
                .checked=${d.lightRole === 'always'} @change=${() => this._setMarkerLightRole('always')} />
                <span>${this.host._t('marker.light_role_always')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="never"
                .checked=${d.lightRole === 'never'} @change=${() => this._setMarkerLightRole('never')} />
                <span>${this.host._t('marker.light_role_never')}</span></label>
            </div>
          </fieldset>

          ${d.lightRole === 'always' && (leadingEntities.length > 1 || staleLeading)
            ? html`<div class="markerhelpfield markerleadingentity">
                <div class="markerhelplabel">
                  <label for="marker-light-entity">${this.host._t('marker.light_entity_label')}</label>
                  ${this._help('marker.light_entity.help')}
                </div>
                <select id="marker-light-entity" class="areasel"
                  @change=${(e: Event) => (this.host._markerDialog = {
                    ...d,
                    lightEntity: (e.target as HTMLSelectElement).value,
                    lightEntityTouched: true,
                  })}>
                  <option value="" ?selected=${staleLeading || !d.lightEntity}>
                    ${this.host._t('marker.light_entity_auto', {
                      entity: effectiveLeading || this.host._t('marker.light_entity_none'),
                    })}
                  </option>
                  ${leadingEntities.map((eid) => html`<option value=${eid}
                    ?selected=${!staleLeading && eid === d.lightEntity}>
                    ${this.host.hass.states[eid]?.attributes?.friendly_name
                      || this.host._fullRegistryHass.entities[eid]?.name || eid} · ${eid}
                  </option>`)}
                </select>
                ${staleLeading ? html`<p class="muted markerlightwarning" role="status">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  ${this.host._t('marker.light_entity_missing', {
                    entity: d.lightEntity, fallback: effectiveLeading || '—',
                  })}
                </p>` : nothing}
              </div>`
            : nothing}

          <fieldset class="markerlightgroup" ?disabled=${glowSourceDisabled}>
            <legend><span>${this.host._t('marker.glow_color_label')}</span>${this._help('marker.glow_mode.help')}</legend>
            <div class="markerradios" role="radiogroup" aria-label=${this.host._t('marker.glow_color_label')}>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="auto"
                .checked=${displayedGlowMode === 'auto'} ?disabled=${liveGlowDisabled}
                aria-describedby=${liveGlowDisabled ? 'marker-glow-disabled-hint' : nothing}
                @change=${() => this._setMarkerGlowMode('auto')} />
                <span>${this.host._t('marker.glow_mode_auto')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="color"
                .checked=${displayedGlowMode === 'color'} ?disabled=${glowSourceDisabled}
                aria-describedby=${glowSourceDisabled ? 'marker-glow-disabled-hint' : nothing}
                @change=${() => this._setMarkerGlowMode('color')} />
                <span>${this.host._t('marker.glow_mode_color')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="fixed"
                .checked=${displayedGlowMode === 'fixed'} ?disabled=${glowSourceDisabled}
                aria-describedby=${glowSourceDisabled ? 'marker-glow-disabled-hint' : nothing}
                @change=${() => this._setMarkerGlowMode('fixed')} />
                <span>${this.host._t('marker.glow_mode_fixed')}</span></label>
            </div>
            ${displayedGlowMode !== 'auto' ? html`<div class="colorrow markerglowvalue">
              <hp-color-opacity .label=${this.host._t('marker.glow_color')}
                .color=${d.glowColor} .opacity=${1} .showOpacity=${false}
                .pickerLabels=${this.host._colorPickerLabels}
                .disabled=${glowSourceDisabled}
                @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                  this.host._markerDialog = {
                    ...d, glowMode: displayedGlowMode,
                    glowColor: e.detail.color, glowColorDrafted: true, glowTouched: true,
                  };
                }}></hp-color-opacity>
              ${displayedGlowMode === 'fixed' ? html`
                <span class="opl">${this.host._t('marker.glow_brightness')}</span>
                ${this._rangeInput(1, 100, 1, d.glowBrightness, (n) => {
                  this.host._markerDialog = {
                    ...d, glowMode: displayedGlowMode,
                    glowBrightness: n, glowBrightnessDrafted: true, glowTouched: true,
                  };
                }, glowSourceDisabled, this.host._t('marker.glow_brightness'))}
                <span class="opv">${Math.round(d.glowBrightness)}%</span>` : nothing}
            </div>` : nothing}
          </fieldset>
          <div class="markerhelpfield">
            <div class="markerhelplabel">
              <label for="marker-glow-radius">${this.host._t('marker.glow_radius_label')}</label>
              ${this._help('marker.glow_radius.help')}
            </div>
            <div class="colorrow">
              <input id="marker-glow-radius" class="tempin" type="number" min="0.5" step="0.5"
                placeholder=${this.host._glowRadiusPlaceholder} ?disabled=${glowSourceDisabled}
                aria-describedby=${glowSourceDisabled || passiveSource ? 'marker-glow-disabled-hint' : nothing}
                .value=${d.glowRadius}
                @input=${(e: Event) => (this.host._markerDialog = { ...d, glowRadius: (e.target as HTMLInputElement).value })} />
              <span class="opl">${this.host._imperial ? this.host._t('gs.unit_ft') : this.host._t('gs.unit_m')}</span>
            </div>
          </div>
          ${glowSourceDisabled || passiveSource
            ? html`<p id="marker-glow-disabled-hint" class="muted markerlightdisabled" role="note">
                <ha-icon icon="mdi:information-outline"></ha-icon>${glowDisabledHint}
              </p>`
            : nothing}

          <label>${this.host._t('marker.icon_label')}</label>
          ${customElements.get('ha-icon-picker')
            // Feed the effective icon to HA's picker so its field renders both
            // the glyph and the mdi:* label. autoIcon is presentation-only:
            // untouched dialogs still save d.icon as an empty auto override.
            ? html`<ha-icon-picker .hass=${this.host.hass} .value=${d.icon || d.autoIcon}
                .placeholder=${d.autoIcon || undefined}
                .fallbackPath=${undefined}
                @value-changed=${(e: any) => {
                  const icon = e.detail.value || '';
                  // Some picker versions announce an assigned value. Do not
                  // let that turn the display-only auto icon into an override.
                  if (!d.icon && icon === d.autoIcon) return;
                  this.host._markerDialog = { ...d, icon };
                }}></ha-icon-picker>`
            : html`<input class="namein" type="text"
                placeholder=${d.autoIcon || this.host._t('marker.icon_ph')}
                .value=${d.icon}
                @input=${(e: Event) => (this.host._markerDialog = { ...d, icon: (e.target as HTMLInputElement).value })} />`}
          ${!d.icon && d.autoIcon
            ? html`<p class="muted iconauto"><ha-icon icon=${d.autoIcon}></ha-icon>
                <span>${this.host._t('marker.icon_auto', { icon: d.autoIcon })}</span>
                <button class="btn ghost" type="button"
                  @click=${() => (this.host._markerDialog = { ...d, icon: d.autoIcon })}>
                  ${this.host._t('marker.icon_pin_auto')}
                </button></p>`
            : nothing}

          <label for="marker-display">${this.host._t('marker.display_label')}</label>
          <select id="marker-display" class="areasel"
            @change=${(e: Event) => (this.host._markerDialog = {
              ...d,
              display: normalizeDeviceDisplay((e.target as HTMLSelectElement).value),
            })}>
            ${DISPLAY_MODES.map((v) => html`<option value=${v} ?selected=${v === d.display}>
              ${this.host._t(DISPLAY_LABEL_KEYS[v])}
            </option>`)}
          </select>
          <p class="muted">${this.host._t(DISPLAY_HINT_KEYS[d.display])}</p>
          ${d.display === 'value' ? html`<div class="markerhelpfield markervaluesource">
            <div class="markerhelplabel">
              <label for="marker-value-source">${this.host._t('marker.value_source')}</label>
              ${this._help('marker.value_source.help')}
            </div>
            <select id="marker-value-source" class="areasel" ?disabled=${isVirtual}
              @change=${(e: Event) => (this.host._markerDialog = {
                ...d,
                valueSource: valueBadgeSourceFromKey((e.target as HTMLSelectElement).value),
                valueSourceTouched: true,
              })}>
              <option value="" ?selected=${!d.valueSource}>
                ${this.host._t('marker.value_source_auto')}
              </option>
              ${valueSourceMissing ? html`<option value=${valueSourceKey || '__missing__'} selected>
                ${this.host._t('marker.value_badge_missing')}
              </option>` : nothing}
              ${badgeCandidates.map((candidate) => html`<option value=${candidate.key}
                ?selected=${candidate.key === valueSourceKey}
                title=${candidate.technical}>
                ${this._valueBadgeCandidateLabel(candidate)} · ${candidate.value}
              </option>`)}
            </select>
            ${selectedValueSourceCandidate
              ? html`<p class="muted markerbadgetechnical"><code>${selectedValueSourceCandidate.technical}</code></p>`
              : nothing}
            ${isVirtual ? html`<p class="muted markerlightdisabled" role="note">
              <ha-icon icon="mdi:information-outline"></ha-icon>
              ${this.host._t('marker.preview.reason.value_virtual')}
            </p>` : valueSourceMissing ? html`<p class="muted markerlightwarning" role="status">
              <ha-icon icon="mdi:alert-outline"></ha-icon>${this.host._t('marker.value_source_missing_hint')}
            </p>` : nothing}
          </div>` : nothing}
          ${d.display === 'static_icon' && this.host._bindingHasAlarm(d.binding)
            ? html`<div class="habindingbanner" role="note">
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                <span>${this.host._t('marker.static_alarm_warning')}</span>
              </div>`
            : nothing}
          <fieldset class="markerlightgroup markerbadgegroup">
            <legend><span>${this.host._t('marker.value_badge_title')}</span>${this._help('marker.value_badge.help')}</legend>
            <label class="srcrow">
              ${this._boolInput(effectiveBadgeEnabled, (enabled) => {
                const source = effectiveBadgeSource || badgeRecommendation;
                this.host._markerDialog = {
                  ...d,
                  valueBadgeEnabled: enabled && !!source,
                  valueBadgeSource: source,
                  valueBadgeTouched: true,
                };
              }, d.display === 'static_icon' || (!badgeCandidates.length && !d.valueBadgeSource))}
              <span>${this.host._t('marker.value_badge_enabled')}</span>
            </label>
            ${d.display === 'static_icon'
              ? html`<p class="muted markerlightdisabled" role="note">
                  <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t('marker.value_badge_static')}
                </p>`
              : !badgeCandidates.length && !d.valueBadgeSource
                ? html`<p class="muted markerlightdisabled" role="note">
                    <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t('marker.value_badge_empty')}
                  </p>`
                : nothing}
            ${effectiveBadgeEnabled ? html`
              <div class="markerhelplabel">
                <label for="marker-value-badge-source">${this.host._t('marker.value_badge_source')}</label>
                ${this._help('marker.value_badge_source.help')}
              </div>
          <select id="marker-value-badge-source" class="areasel"
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  valueBadgeSource: valueBadgeSourceFromKey((e.target as HTMLSelectElement).value),
                  valueBadgeEnabled: true,
                  valueBadgeTouched: true,
                })}>
                ${badgeSourceMissing ? html`<option value=${badgeSourceKey} selected>
                  ${this.host._t('marker.value_badge_missing')}
                </option>` : nothing}
                ${badgeCandidates.map((candidate) => html`<option value=${candidate.key}
                  ?selected=${candidate.key === badgeSourceKey}
                  title=${candidate.technical}>
                  ${this._valueBadgeCandidateLabel(candidate)} · ${candidate.value}
                </option>`)}
              </select>
              ${selectedBadgeCandidate
                ? html`<p class="muted markerbadgetechnical"><code>${selectedBadgeCandidate.technical}</code></p>`
                : nothing}
              ${badgeSourceMissing ? html`<p class="muted markerlightwarning" role="status">
                <ha-icon icon="mdi:alert-outline"></ha-icon>${this.host._t('marker.value_badge_missing_hint')}
              </p>` : nothing}
              ${d.display === 'value' && badgeSourceKey === innerValueSourceKey
                ? html`<p class="muted markerlightwarning" role="note">
                    <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t('marker.value_badge_duplicate')}
                  </p>` : nothing}
              <div class="markerhelplabel">
                <label for="marker-value-badge-position">${this.host._t('marker.value_badge_position')}</label>
                ${this._help('marker.value_badge_position.help')}
              </div>
          <select id="marker-value-badge-position" class="areasel"
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  valueBadgeEnabled: effectiveBadgeEnabled,
                  valueBadgeSource: effectiveBadgeSource,
                  valueBadgePosition: (e.target as HTMLSelectElement).value as ValueBadgePosition,
                  valueBadgeTouched: true,
                })}>
                ${(['right', 'bottom', 'left', 'top'] as const).map((position) => html`
                  <option value=${position} ?selected=${position === effectiveBadgePosition}>
                    ${this.host._t(`marker.value_badge_${position}` as I18nKey)}
                  </option>`)}
              </select>
            ` : nothing}
          </fieldset>
          ${previewPresentation
            ? html`<hp-device-preview
                .hass=${this.host.hass}
                .presentation=${previewPresentation}
                .registry=${this.host._haRegistry}
                .deviceName=${d.name.trim() || previewDevice?.name || curLabel || ''}>
              </hp-device-preview>`
            : html`<div class="devicepreview-empty">
                <ha-icon icon="mdi:eye-outline"></ha-icon>
                <span>${this.host._t('marker.preview.select_source')}</span>
              </div>`}
          ${d.display === 'icon_ripple'
            ? html`<div class="colorrow ripple-colorrow">
                <hp-color-opacity .label=${this.host._t('marker.activity_color')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${d.rippleColor || '#3ea6ff'} .opacity=${1} .showOpacity=${false}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                    this.host._markerDialog = { ...d, rippleColor: e.detail.color };
                  }}></hp-color-opacity>
              </div>
              <div class="colorrow ripple-sizerow">
                <span class="opl">${this.host._t('marker.ripple_size')}</span>
                ${this._rangeInput(1, 8, 0.5, d.rippleSize, (n) => (this.host._markerDialog = { ...d, rippleSize: n }))}
                <span class="opv">×${d.rippleSize}</span>
              </div>
              <p class="muted" role="note">${this.host._t('marker.activity_alarm_note')}</p>`
            : nothing}

          <label>${this.host._t('marker.size_label')}</label>
          <div class="colorrow">
            ${this._rangeInput(0.5, 3, 0.1, d.size, (n) => (this.host._markerDialog = { ...d, size: n }))}
            <span class="opv">×${d.size.toFixed(1)}</span>
            <span class="opl">${this.host._t('marker.angle_label')}</span>
            ${''/* 5 degrees, not 10 (owner 2026-08-03): a marker often has to
                   line up with a wall that is not on a 10-degree grid. */}
            ${this._rangeInput(0, 355, 5, d.angle, (n) => (this.host._markerDialog = { ...d, angle: n }))}
            <span class="opv">${d.angle}°</span>
          </div>

          <label>${this.host._t('marker.model_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('marker.model_ph')}
            .value=${d.model}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, model: (e.target as HTMLInputElement).value })} />

          <label>${this.host._t('marker.link_label')}</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${d.link}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, link: (e.target as HTMLInputElement).value })} />

          <label>${this.host._t('marker.desc_label')}</label>
          <textarea class="descin" rows="4" placeholder=${this.host._t('marker.desc_ph')}
            .value=${d.description}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, description: (e.target as HTMLTextAreaElement).value })}></textarea>

          <label>${this.host._t('marker.manuals_label')}</label>
          <div class="pdfedit">
            ${d.pdfs.map(
              (p) => html`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${safeUrl(this.host._display(p.url)) || '#'}" target="_blank" rel="noreferrer noopener">${p.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${() => this._removeMarkerPdf(p.url)}></ha-icon></span>`,
            )}
            <span class="fileupload">
              <button class="btn filebtn" type="button" @click=${(e: Event) =>
                ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                <ha-icon icon="mdi:paperclip"></ha-icon>${this.host._t('btn.attach')}
              </button>
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${(e: Event) => this._pickMarkerFiles(e)} />
            </span>
          </div>
        </div>
        <div class="row markerfooter" slot="footer">
          <div class="markeractions">
            ${d.devId
              ? html`<button class="btn" type="button"
                  ?disabled=${d.busy}
                  aria-pressed=${d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'true' : 'false'}
                  title=${this.host._t(d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'marker.show_tip' : 'marker.hide_tip')}
                  @click=${this.host._toggleMarkerDialogVisibility}>
                  <ha-icon icon=${d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}></ha-icon>
                  ${this.host._t(d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'marker.show' : 'marker.hide')}
                </button>`
              : nothing}
            ${d.devId
              ? html`<button class="btn danger" type="button" ?disabled=${d.busy}
                  title=${this.host._t('marker.delete_tip')} @click=${() => this._deleteMarker()}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
                </button>`
              : nothing}
          </div>
          <div class="markersaveactions">
            <button class="btn ghost" ?disabled=${d.busy}
              @click=${() => this._closeMarkerDialog()}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" @click=${() => this._saveMarker()}
              ?disabled=${d.busy || (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual'
                || (!d.devId && bindingStatus?.kind !== 'active')))}
              title=${d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual') ? this.host._t('marker.pick_ph') : ''}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }

public _renderSpaceDialog(): TemplateResult {
    const d = this.host._spaceDialog!;
    if (d.copy) return renderSpaceCopyDialog(this.host, () => { void this._saveSpaceCopy(); });
    const progress = this.host._importTotal > 0 && d.mode === 'create'
      ? this.host._t('import.progress', {
          i: this.host._importTotal - this.host._importQueue.length,
          n: this.host._importTotal,
        })
      : '';
    const close = () => {
      this.host._spaceDialog = null;
      this.host._importQueue = [];
      this.host._importTotal = 0;
    };
    return html`<hp-dialog .hass=${this.host.hass}
      .title=${`${d.mode === 'create' ? this.host._t('space.new') : this.host._t('space.header')}${progress ? ` · ${progress}` : ''}`}
      icon="mdi:floor-plan" wide @hp-close=${close}>
        <div class="body">
          <label>${this.host._t('space.title_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('space.title_ph')}
            .value=${d.title}
            @input=${(e: Event) => (this.host._spaceDialog = { ...d, title: (e.target as HTMLInputElement).value })} />
          <label>${this.host._t('space.plan_label')}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'file'}
              @change=${() => (this.host._spaceDialog = switchSpacePlanSource(d, 'file'))} />
            <span>${this.host._t('space.source_file')}</span>
          </label>
          ${d.source === 'file'
            ? html`<div class="planrow">
                ${d.planFile
                  ? html`<span class="planname">${d.planFile.name}</span>`
                  : d.planUrl
                    ? html`<img class="planprev" src=${this.host._display(d.planUrl)} alt=${this.host._t('space.plan_alt')} />`
                    : html`<span class="planname muted">${this.host._t('space.no_plan')}</span>`}
                <span class="fileupload">
                  <button class="btn filebtn" type="button" @click=${(e: Event) =>
                    ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                    <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? this.host._t('btn.replace') : this.host._t('btn.upload')}
                  </button>
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${(e: Event) => this._pickPlanFile(e)} />
                </span>
                <button class="btn ghost" @click=${() => this._toggleServerPlans()}
                  title=${this.host._t('space.pick_saved_hint')}>
                  <ha-icon icon="mdi:folder-image"></ha-icon>${this.host._t('space.pick_saved')}
                </button>
              </div>
              ${d.pickSaved ? this._renderServerPlans(d) : nothing}`
            : nothing}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'draw'}
              @change=${() => (this.host._spaceDialog = switchSpacePlanSource(d, 'draw'))} />
            <span>${this.host._t('space.source_draw')}</span>
          </label>

          <div class="helpfieldlabel">
            <label for="space-cell-cm">${this.host._t('space.scale_label')}</label>
            ${this._help('space.cell_cm.help')}
          </div>
          <div class="colorrow">
            <input id="space-cell-cm" class="namein tempin" type="number"
              min=${gridCellFieldValue(CELL_CM_MIN, this.host._imperial)}
              max=${gridCellFieldValue(CELL_CM_MAX, this.host._imperial)}
              step="0.1" .value=${d.cellCmInput ?? gridCellFieldValue(d.cellCm, this.host._imperial)}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value;
                const n = strictNumber(raw);
                const canonical = n == null ? null : gridCellFieldToCm(n, this.host._imperial);
                this.host._spaceDialog = {
                  ...d,
                  cellCmInput: raw,
                  cellCmTouched: true,
                  cellCm: canonical != null && canonical > 0
                    ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, canonical)) : d.cellCm,
                };
              }} />
            <span class="opl">${this.host._t(
              this.host._imperial ? 'space.scale_unit_imperial' : 'space.scale_unit',
            )}</span>
          </div>

          <label class="dispsection">${this.host._t('space.display_section')}</label>
          <label class="srcrow">
            ${this._boolInput(d.showBorders, (v) => (this.host._spaceDialog = touchSpaceDisplay(d, 'showBorders', v)))}
            <span>${this.host._t('space.show_borders')}</span>
          </label>
          <div class="helpfieldlabel">
            <label for="space-zero-wall-style">${this.host._t('space.zero_wall_style')}</label>
            ${this._help('space.zero_wall_style.help')}
          </div>
          <select id="space-zero-wall-style" class="areasel"
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              this.host._spaceDialog = {
                ...d, zeroWallStyle: value === 'solid' ? 'solid' : 'dashed',
              };
            }}>
            <option value="dashed" ?selected=${d.zeroWallStyle === 'dashed'}>
              ${this.host._t('space.zero_wall_dashed')}
            </option>
            <option value="solid" ?selected=${d.zeroWallStyle === 'solid'}>
              ${this.host._t('space.zero_wall_solid')}
            </option>
          </select>
          <label class="srcrow">
            ${this._boolInput(d.showNames, (v) => (this.host._spaceDialog = touchSpaceDisplay(d, 'showNames', v)))}
            <span>${this.host._t('space.show_names')}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(d.showLqi, (v) => (this.host._spaceDialog = { ...d, showLqi: v }))}
            <span>${this.host._t('space.show_lqi')}</span>
          </label>
          ${''/* the two "draw less" switches (owner 2026-08-05). They only
                 hide: the shapes and the openings stay in the config and
                 stay visible in the editor that owns them, so nothing is
                 lost and nothing becomes uneditable. */}
          <label class="srcrow">
            ${this._boolInput(d.hideDecor, (v) => (this.host._spaceDialog = { ...d, hideDecor: v }))}
            <span>${this.host._t('space.hide_decor')}</span>
          </label>
          <div class="rhint">${this.host._t('space.hide_decor_tip')}</div>
          <label class="srcrow">
            ${this._boolInput(d.hideOpenings, (v) => (this.host._spaceDialog = { ...d, hideOpenings: v }))}
            <span>${this.host._t('space.hide_openings')}</span>
          </label>
          <div class="rhint">${this.host._t('space.hide_openings_tip')}</div>
          <label class="dispsection">${this.host._t('space.roomcard_section')}</label>
          ${([['labelTemp', 'space.label_temp'], ['labelHum', 'space.label_hum'],
              ['labelLqi', 'space.label_lqi'], ['labelLight', 'space.label_light']] as const).map(
            ([f, k]) => html`<label class="srcrow">
              ${this._boolInput(d[f], (v) => (this.host._spaceDialog = { ...d, [f]: v }))}
              <span>${this.host._t(k)}</span>
            </label>`,
          )}
          <label>${this.host._t('space.card_font')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(d.cardFontScale * 100), (n) => (this.host._spaceDialog = { ...d, cardFontScale: n / 100 }))}
            <span class="opv">${Math.round(d.cardFontScale * 100)}%</span>
          </div>
          ${this.host._renderCardPreview(d.cardFontScale, 1, 1)}
          <div class="colorrow">
            <hp-color-opacity .label=${this.host._t('space.room_color')}
              .opacityLabel=${this.host._t('space.opacity')}
              .pickerLabels=${this.host._colorPickerLabels}
              .color=${d.roomColor} .opacity=${d.roomOpacity} .showOpacity=${true}
              @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                this.host._spaceDialog = {
                  ...d, roomColor: e.detail.color, roomOpacity: e.detail.opacity,
                };
              }}></hp-color-opacity>
          </div>
          <div class="helpfieldlabel">
            <label for="space-bg-mode">${this.host._t('space.bg_mode')}</label>
            ${this._help('space.bg_mode.help')}
          </div>
          <select id="space-bg-mode" class="areasel"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this.host._spaceDialog = { ...d, bgMode: v === 'static' || v === 'daynight' ? (v as any) : null };
            }}>
            <option value="" ?selected=${d.bgMode === null}>${this.host._t('space.sun_inherit')}</option>
            <option value="static" ?selected=${d.bgMode === 'static'}>${this.host._t('gs.bg_static')}</option>
            <option value="daynight" ?selected=${d.bgMode === 'daynight'}>${this.host._t('gs.bg_daynight')}</option>
          </select>
          ${(d.bgMode ?? bgModeOf(this.host._settings, {})) === 'static'
            ? html`<div class="colorrow">
                <hp-color-opacity .label=${this.host._t('space.bg_color')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${d.bgColor || stageBgOf(this.host._settings, { bgColor: null }) || this.host._stageBgHex()}
                  .opacity=${1} .showOpacity=${false}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                    this.host._spaceDialog = { ...d, bgColor: e.detail.color };
                  }}></hp-color-opacity>
                ${d.bgColor
                  ? html`<button class="btn ghost" @click=${() => (this.host._spaceDialog = { ...d, bgColor: null })}>
                      ${this.host._t('space.bg_inherit')}</button>`
                  : html`<span class="opl">${this.host._t('space.bg_inherited')}</span>`}
              </div>`
            : nothing}
          <div class="helpfieldlabel">
            <label for="space-north">${this.host._t('space.north')}</label>
            ${this._help('space.north.help')}
          </div>
          <div class="colorrow">
            <input id="space-north" class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this.host._t('space.sun_inherit')}
              .value=${d.northDeg === null ? '' : String(d.northDeg)}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const n = raw === '' ? null : Math.round(Number(raw));
                this.host._spaceDialog = { ...d, northDeg: n !== null && Number.isFinite(n) ? Math.min(359, Math.max(0, n)) : null };
              }} />
            <span class="opl">${d.northDeg === null
              ? this.host._t('space.north_inherited', {
                  v: northDegOf(this.host._settings, {}) === null ? '—' : String(northDegOf(this.host._settings, {})) + '°',
                })
              : '°'}</span>
          </div>
          <label>${this.host._t('space.sun_rays')}</label>
          <select class="areasel"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this.host._spaceDialog = { ...d, sunRays: v === '' ? null : v === '1' };
            }}>
            <option value="" ?selected=${d.sunRays === null}>${this.host._t('space.sun_inherit')}</option>
            <option value="1" ?selected=${d.sunRays === true}>${this.host._t('space.sun_on')}</option>
            <option value="0" ?selected=${d.sunRays === false}>${this.host._t('space.sun_off')}</option>
          </select>
          <div class="helpfieldlabel">
            <span>${this.host._t('space.fill_label')}</span>
            ${this._help('space.fill_mode.help')}
          </div>
          ${SPACE_FILL_UI_MODES.map((v) => [v, 'fill.' + v] as const).map(
            ([v, k]) => html`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${d.fillMode === v}
                @change=${() => (this.host._spaceDialog = { ...d, fillMode: v as any })} />
              <span>${this.host._t(k as any)}</span>
              ${v === 'temp' && d.fillMode === 'temp'
                ? html`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMin)}
                      @input=${(e: Event) => {
                        const n = strictNumber((e.target as HTMLInputElement).value);
                        if (n != null) this.host._spaceDialog = { ...d, tempMin: n };
                      }} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMax)}
                      @input=${(e: Event) => {
                        const n = strictNumber((e.target as HTMLInputElement).value);
                        if (n != null) this.host._spaceDialog = { ...d, tempMax: n };
                      }} />
                    °C
                  </span>`
                : nothing}
            </label>
              ${v === 'custom' && d.fillMode === 'custom'
                ? html`<div class="colorrow gsrow">
                    <span class="gsl">${this.host._t('space.custom_fill')}</span>
                    <hp-color-opacity
                      .label=${this.host._t('space.custom_fill')}
                      .opacityLabel=${this.host._t('space.opacity')}
                      .pickerLabels=${this.host._colorPickerLabels}
                      .color=${(d.customFill || DEFAULT_CUSTOM_FILL).c}
                      .opacity=${(d.customFill || DEFAULT_CUSTOM_FILL).a}
                      @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                        this.host._spaceDialog = { ...d, customFill: { c: e.detail.color, a: e.detail.opacity } };
                      }}></hp-color-opacity>
                    ${d.customFill
                      ? html`<button class="btn ghost" type="button"
                          @click=${() => (this.host._spaceDialog = { ...d, customFill: null })}>
                          ${this.host._t('btn.reset')}</button>`
                      : nothing}
                  </div>`
                : nothing}`,
          )}
          <label class="srcrow">
            ${this._boolInput(d.glowEnabled, (checked) => {
              this.host._spaceDialog = { ...d, glowEnabled: checked };
            })}
            <span>${this.host._t('space.glow_enabled')}</span>
          </label>
          ${d.deleteBlockers
            ? html`<div class="backuperror" role="alert">${this.host._t('space.delete_blocked', {
                n: String(d.deleteBlockers),
              })}</div>`
            : nothing}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${d.mode === 'edit'
            ? html`<div class="dialog-action-group">
                <button class="btn ghost" @click=${() => openSpaceCopyDialog(this.host)} ?disabled=${d.busy}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>${this.host._t('btn.copy')}
                </button>
              </div>`
            : nothing}
          ${d.mode === 'edit'
            ? html`<div class="dialog-action-group dialog-action-danger">
                <button class="btn danger" @click=${() => this._deleteSpace()} ?disabled=${d.busy}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
                </button>
              </div>`
            : nothing}
          <div class="dialog-action-group dialog-action-commit">
            ${this.host._importTotal > 0 && d.mode === 'create'
              ? html`<button class="btn ghost" @click=${() => this._skipImport()}>${this.host._t('btn.skip')}</button>`
              : nothing}
            <button class="btn ghost" @click=${close}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" @click=${() => this._saveSpaceDialog()}
              ?disabled=${!d.title.trim() || (d.source === 'file' && !(d.planFile || d.planUrl)) || d.busy}
              title=${d.source === 'file' && !(d.planFile || d.planUrl) ? this.host._t('title.need_plan') : ''}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }

public _renderMergeDialog(): TemplateResult {
    const d = this.host._mergeDialog!;
    const rooms = this.host._spaceModel()?.rooms || [];
    const opt = (id: string, key: 'a' | 'b') => {
      const r = rooms.find((x) => x.id === id);
      const area = r?.area ? this.host.hass.areas[r.area]?.name : null;
      return html`<label class="srcrow">
        <input type="radio" name="mergekeep" .checked=${d.pick === key}
          @change=${() => (this.host._mergeDialog = { ...d, pick: key })} />
        <span>${r?.name || ''} <span class="muted">· ${area || this.host._t('merge.no_area')}</span></span>
      </label>`;
    };
    return html`<hp-dialog .hass=${this.host.hass} .title=${this.host._t('merge.header')} icon="mdi:vector-union"
      @hp-close=${() => (this.host._mergeDialog = null)}>
        <div class="body">
          <p class="muted">${this.host._t('merge.hint')}</p>
          <label>${this.host._t('merge.keep')}</label>
          ${opt(d.aId, 'a')}
          ${opt(d.bId, 'b')}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this.host._mergeDialog = null)}>${this.host._t('btn.cancel')}</button>
          <button class="btn on" @click=${() => this._commitMerge()}>
            <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

public _renderRoomSource(kind: 'temp' | 'hum'): TemplateResult {
    const val = kind === 'temp' ? this.host._roomTempSrc : this.host._roomHumSrc;
    const setVal = (v: string) => {
      if (kind === 'temp') this.host._roomTempSrc = v;
      else this.host._roomHumSrc = v;
      this.host.requestUpdate();
    };
    const open = this.host._roomSrcOpen === kind;
    return html`
      <label>${this.host._t(kind === 'temp' ? 'room.temp_src_label' : 'room.hum_src_label')}</label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${kind}" .checked=${!val}
          @change=${() => { setVal(''); this.host._roomSrcOpen = null; }} />
        <span>${this.host._t('room.src_average')}</span>
      </label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${kind}" .checked=${!!val}
          @change=${() => { this.host._roomSrcOpen = kind; this.host._roomSrcFilter = ''; this.host.requestUpdate(); }} />
        <span>${this.host._t('room.src_pick')}</span>
      </label>
      ${val || open
        ? html`<button class="dropbtn ${open ? 'open' : ''}"
              @click=${() => { this.host._roomSrcOpen = open ? null : kind; this.host._roomSrcFilter = ''; }}>
              ${val
                ? html`<b>${this._roomSrcLabel(val)}</b><span class="ref">${val}</span>`
                : html`<span class="muted">${this.host._t('room.src_ph')}</span>`}
              <ha-icon icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
            </button>
            ${open
              ? html`<div class="droppanel">
                  <input class="namein" type="text" placeholder=${this.host._t('marker.search_ph')}
                    .value=${this.host._roomSrcFilter}
                    @input=${(e: Event) => { this.host._roomSrcFilter = (e.target as HTMLInputElement).value; this.host.requestUpdate(); }} />
                  <div class="candlist">
                    ${this._roomSrcCandidates().map(
                      (c) => html`<div class="cand ${c.value === val ? 'sel' : ''}"
                        @click=${() => { setVal(c.value); this.host._roomSrcOpen = null; }}>
                        <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                      </div>`,
                    )}
                  </div>
                </div>`
              : nothing}`
        : nothing}`;
  }

public _renderRoomDialog(): TemplateResult {
    const edit = !!this.host._roomEditId;
    const faceBatch = !edit ? this.host._wallFaceBatch : null;
    const batchProgress = faceBatch && faceBatch.candidates.length > 1
      ? this.host._t('room.queue_progress', {
          current: faceBatch.index + 1, total: faceBatch.candidates.length,
        })
      : '';
    const canSaveNew = !!this.host._areaSel || !!this.host._nameSel.trim();
    const spaceDisplay = spaceDisplayOf(this.host._curSpaceCfg);
    const effectiveFill = this.host._roomFill || spaceDisplay.fill;
    const customFill = this.host._roomCustomFill || spaceDisplay.customFill;
    // the free-areas list must include the edited room's CURRENT area
    const areas = [...this.host._freeAreas];
    if (edit && this.host._areaSel && !areas.some((a) => a.area_id === this.host._areaSel)) {
      const cur = this.host.hass.areas[this.host._areaSel];
      if (cur) areas.unshift(cur);
    }
    return html`<hp-dialog class="roomdialog" .hass=${this.host.hass} wide
      .title=${edit ? this.host._t('room.settings_title')
        : batchProgress || this.host._t('room.new')}
      icon=${edit ? 'mdi:cog-outline' : 'mdi:floor-plan'} @hp-close=${() => this._roomDialogCancel()}>
        <div class="body">
          ${batchProgress ? html`<p class="muted" role="status" aria-live="polite">
            ${batchProgress}
          </p>` : nothing}
          <label>${this.host._t('room.name_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('room.name_ph')}
            .value=${this.host._nameSel}
            @input=${(e: Event) => (this.host._nameSel = (e.target as HTMLInputElement).value)} />
          <label>${this.host._t('room.area_label')}</label>
          <select class="areasel"
            @change=${(e: Event) => {
              this.host._areaSel = (e.target as HTMLSelectElement).value;
              if (!this.host._nameSel && this.host._areaSel)
                this.host._nameSel = this.host.hass.areas[this.host._areaSel]?.name || '';
              this.host.requestUpdate();
            }}>
            <option value="">${this.host._t('room.no_area_option')}</option>
            ${areas.map(
              (a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.host._areaSel}>${a.name}</option>`,
            )}
          </select>

          <label class="dispsection">${this.host._t('room.settings_section')}</label>
          <label>${this.host._t('room.fill_label')}</label>
          ${([['', 'fill.inherit'], ...ROOM_FILL_MODES.map((v) => [v, 'fill.' + v])] as const).map(
            ([v, k]) => html`<label class="srcrow inline">
              <input type="radio" name="rfill" .checked=${this.host._roomFill === v}
                @change=${() => { this.host._roomFill = v as any; this.host.requestUpdate(); }} />
              <span>${this.host._t(k as any)}</span>
            </label>`,
          )}
          ${effectiveFill === 'custom'
            ? html`<div class="colorrow gsrow">
                <span class="gsl">${this.host._roomCustomFill
                  ? this.host._t('room.custom_fill_own') : this.host._t('room.custom_fill_space')}</span>
                <hp-color-opacity
                  .label=${this.host._roomCustomFill
                    ? this.host._t('room.custom_fill_own') : this.host._t('room.custom_fill_space')}
                  .opacityLabel=${this.host._t('space.opacity')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${customFill.c}
                  .opacity=${customFill.a}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                    this.host._roomCustomFill = { c: e.detail.color, a: e.detail.opacity };
                  }}></hp-color-opacity>
                ${this.host._roomCustomFill
                  ? html`<button class="btn ghost" type="button" @click=${() => {
                      this.host._roomCustomFill = null;
                    }}>${this.host._t('btn.reset')}</button>`
                  : nothing}
              </div>`
            : nothing}
          ${this._renderRoomSource('temp')}
          ${this._renderRoomSource('hum')}

          <label class="dispsection">${this.host._t('room.sizes_section')}</label>
          <label>${this.host._t('room.name_scale')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(this.host._roomNameScale * 100), (n) => { this.host._roomNameScale = n / 100; this.host.requestUpdate(); })}
            <span class="opv">${Math.round(this.host._roomNameScale * 100)}%</span>
          </div>
          <label>${this.host._t('room.label_scale')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(this.host._roomLabelScale * 100), (n) => { this.host._roomLabelScale = n / 100; this.host.requestUpdate(); })}
            <span class="opv">${Math.round(this.host._roomLabelScale * 100)}%</span>
          </div>
          ${this.host._renderCardPreview(
            spaceDisplayOf(this.host._curSpaceCfg).cardFontScale,
            this.host._roomNameScale,
            this.host._roomLabelScale,
          )}
        </div>
        <div class="row roomfooter" slot="footer">
          <button class="btn ghost" @click=${() => this._roomDialogCancel()}>${this.host._t('btn.cancel')}</button>
          <span class="spacer"></span>
          ${edit
            ? html`<button class="btn on" @click=${() => this._saveRoomEdit()} ?disabled=${!this.host._nameSel.trim()}>
                <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
              </button>`
            : html`${!this.host._pendingSplit ? html`<button class="btn ghost" @click=${() => this._keepClosedAsPartitions()}>
                <ha-icon icon="mdi:wall"></ha-icon>${this.host._t('btn.keep_as_walls')}
              </button>` : nothing}
              <button class="btn on room-save" @click=${() => this._saveRoom()} ?disabled=${!canSaveNew}>
                <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
              </button>`}
        </div>
    </hp-dialog>`;
  }
}
