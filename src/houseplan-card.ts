/**
 * House Plan Card — an interactive house plan as a native Lovelace card.
 * Configuration sources:
 *  1) SERVER (the houseplan integration, WS houseplan/config/get) — spaces, plans,
 *     rooms, device overrides, virtual devices. Coordinates are NORMALIZED (0..1).
 *  2) LEGACY fallback — baked-in country-house data (src/data/*), coordinates in a 1489×1053 canvas.
 * The icon layout is stored on the server (houseplan/layout/*), fallback — localStorage.
 */
import { LitElement, html, svg, nothing, noChange, TemplateResult, PropertyValues, type PropertyDeclaration } from 'lit';
import { guard } from 'lit/directives/guard.js';
import { repeat } from 'lit/directives/repeat.js';
import './hp-dialog';
import type { HpDialog } from './hp-dialog';
import './hp-confirm';
import {
  HpConfirmController,
  type HpConfirmDecision,
  type HpConfirmRequest,
  type HpConfirmState,
} from './danger-confirm';
import type { SupportDialogState } from './support-feedback';
import type { ColorPickerLabels } from './hp-color-opacity';
import {
  EXCLUDED_DOMAINS, DEFAULT_ICON_RULES, compileIconRules, isValidPattern, iconFor,
  type IconRule, type CompiledIconRule,
} from './rules';
import {
  lqiColor, snapToGrid, snapSegment45, samePoint, pointInPolygon, markerIdForBinding,
  segmentCm, formatLength, roomEdges, roomPoly, paperRoomShapes, pointStrictlyInside, roomsOverlap,
  pointOnBoundary, mergeRooms, splitRoomPath, polygonArea, closestPointOnBoundary, pointStrictlyInside as ptInside, islandsOf, sharedBoundary, distToSegment, outlineWithout, cutSegments, alignGuides, segmentAngle, is45, isExact45Vector, type AlignGuide, swipeTarget, clampScale, migratePdfUrls, roomFillModeOf, roomGlowOf, contentUrl,
  snapToWall, snapPointAlongPoly, openingAmount, openingShoulders, interiorPoint,
  isInteriorLightOpeningType, openingLightApertureLength, openingLightStateSignature,
  quantizeOpeningLightAmount,
  openingEntityReferences, filterOpeningEntityCandidates,
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
  polyIsSimple, MIN_ROOM_CM,
  type SafeOpeningIn, type SafeResizeObstacle, type SafeResizeOptions,
  type SafeResizePlan, type SafeResizeReason, type SafeResizeResolution,
} from './resize';
import { formatArea } from './area-format';
import {
  type ResizeProjectionResult,
} from './resize-controller';
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
  furnitureGraphic,
  furniturePlanScreenScale, furnitureStrokePx,
  furnitureRenderTransform,
} from './furniture';
import {
  degradeWalls, rekeyWallsAfterMoveChecked, wallRecordCarrierViolations,
  setWallThickness, setWallThicknessForRoom, cmToField, wallCmToUnits,
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
  innerEdgeSpan, ownEdgeOffsets, thicknessCmAt,
} from './wall-thickness';
import type {
  JunctionLimitViolation, JunctionSharedGeometry, LimitSegment,
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
  createEmptySpaceConfig, initialSpaceDisplayDraft, switchSpacePlanSource, touchSpaceDisplay,
  type SpaceDialogState,
} from './space-dialog';
import { mdiHomeCityOutline } from '@mdi/js';
import {
  Affine, applyAffine, readVacTelemetry,
  autoCalibrate, pushTrailPoint, isVacMoving, vacTrailMode, vacMapIdWithFallback,
  parseVacSourceCandidate, resolveVacSource, resolveCurrentVacPath, trimVacPathTarget, normalizeVacPath,
  smoothVacPath, VAC_TRAIL_SMOOTH_RADIUS_CM, areaCentroid,
  vacCalibrationResidualCm, vacRoomNameMatchCount, VAC_CALIBRATION_WARN_CM,
  VAC_TELEPORT_GAP_MS, VAC_STALE_MS,
  FitParams, fitMatrix, fitFromMatrix, initialFit, reanchorFit, VacRoom,
  Pt as VacPt, type VacPath, type VacSourceCandidate,
  type VacSourceResolution, type VacSourceStatus,
} from './vacuum';
import {
  effectiveRoutes, observedMapIds, resolveRoute, planVacuumOverlay, routeWarningKey,
  type VacuumMapRoute, type VacuumRouteResolution,
} from './vacuum-routes';
import {
  buildDevices, deviceFromMarkerDraft, seedHiddenBindings, lqiFor, tempFor, climateTempFor,
  areaTemp, areaHum, effectiveExcludedIntegrations, sourceValue, roomClimateKey, roomClimateMap,
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
  RoomCfg, RoomDraftCfg, PartitionCfg, WallColumnCfg,
  SpaceModel, PdfRef, Marker, ServerConfig, DevItem, CardConfig,
  MarkerValueBadge, ValueBadgePosition, ValueBadgeSource, ZeroWallStyle,
} from './types';
import {
  COLUMN_MAX_CM, canonicalColumnAngle, clampColumnCm, columnBody,
  directionalOccluders, floorMinusBodies, geometryArea, geometryOuterRings,
  geometryAllRings, intersectionPaths, partitionBody, polyclipPathD,
  pointInOpaquePlanBody, pointInPhysicalBody, sameColumnPlacement,
  physicalBodyParts, scalePartitionOpeningCut,
  type PartitionOpeningCut,
} from './physical-geometry';
import {
  hostedOpeningIntervalsOverlap, materializePartitionOpening,
  partitionOpeningJambMargin, partitionOpeningNeedsStrictValidation,
  partitionOpeningCut, partitionOpeningFace,
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
  wallChainSegments, chainSegmentCms,
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
  adoptWallSegmentModelCandidateInPlace, commitWallSegmentModel,
  fixedTopologyWallLineageHints, sanitizeRoomDraftPath,
  resolveRoomOpeningHost, wallModelOffGridValueCount, WallSegmentModelError,
} from './wall-segment-model';
import {
  resolveZeroWalls,
  zeroWallHasOpening, zeroWallStyleOf,
} from './zero-walls';
import { snapNearAxisEndpoint } from './near-axis';
import type { SpaceReferenceRepairContext } from './space-reference-repair';
import { collectSpaceMarkerDependencies } from './space-deletion';
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
import { enqueueSerializedWrite } from './serialized-write-queue';
import type { CalibrationProposal, VacuumFit } from './vacuum-calibration-write';
import { hasTranslation, langOf, t, type I18nKey } from './i18n';
import { LANGUAGE_RUNTIME, subscribeLanguageLoadFailures } from './i18n/registry';
import {
  languageLoadingTemplate, languageRenderGate, type LanguageRenderGate,
} from './i18n/language-runtime';
import { CommandStack } from './command-stack';
import {
  applyDevicePlacement,
  devicePlacement,
  sameDevicePlacement,
  type DeviceLayout,
  type DevicePlacement,
  type DevicePositionState,
} from './device-position-history';
import {
  applyAreaRelocationResolution,
  markerAreaSnapshotOf,
  resolveAreaSnapshotCleanup,
  resolveDeviceAreaRelocations,
  type AreaRelocationResolution, type MarkerAreaBinding,
} from './device-area-relocation';
import { resolvedSvgScreenBlend, svgScreenBlendSupported } from './glow-blend';
import {
  buildGlowClipGeometry, buildLightBarrierScene, createGlowRuntimeState,
  disposeGlowRuntime, forgetGlowSource, forgetGlowSpace, glowSourceInOpaqueBody,
  pruneGlowSources, readGlowClip, renderGlowPools, resolveGlowCandidates, resolveGlowFeather,
  resolveLightBarrierRevision, transitionGlowSource, warnGlowGeometryFallback,
  writeGlowClip,
  type GlowRuntimeHost, type GlowRuntimeState, type GlowSpot,
} from './glow-scene';
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
  valueBadgeSourceKey, valueBadgeTitle, valueBadgeWriteFields, type ValueBadgeCandidate,
} from './device-value-badge';
import {
  createRenderDeviceSnapshot, presentationSnapshotKey, renderDeviceSnapshotPositions,
  type RenderDeviceSnapshot,
} from './render-device-snapshot';
import { RenderLifecycle, intakeHass } from './houseplan-render-lifecycle';
import type { HassRenderSnapshot } from './render-invalidation';
import { deviceFaceStyle, deviceThemeClass, renderDeviceFace } from './device-face';
import { effectiveDeviceBaseSize } from './device-marker-geometry'; import { renderZigbeeTopologyOverlay } from './zigbee-topology-overlay-bridge';
import {
  ModeTransitionController, viewportFromViewBox,
  type HouseplanMode, type ModeTransitionState, type ModeVisualState, type ModeViewBox,
} from './mode-transition';
import {
  CameraTransitionController, cameraTargetAtAnchor, sameCameraState,
  type CameraState, type CameraTransitionReason, type CameraTransitionState,
} from './viewport-transition';
import {
  acceptedRoomFitGesture, DoubleFitGestureRecognizer, roomFitCameraTarget,
  roomFitClampFrame,
  roomFitGeometryBounds, roomFitOwnerFromPath, STAGE_TAP_DISTANCE_PX,
  type RoomFitGestureCandidate,
} from './room-fit';
import { EditorRuntimeLoader, lazyLoadFailureMessage, type EditorRuntimeLoaderState } from './editor-runtime-loader';
import type { BackdropGuardState } from './backdrop-pick';
import {
  expiredWarmViewport, lruRead, lruWrite, normalizeMarkupTool, strictNumber,
  warmBootKey, warmMatch,
  type DecorTool, type MarkupTool, type WarmDialog, type WarmDialogKind,
  type WarmEntry, type WarmViewport,
} from './card-runtime';

// Chromium records a FAILED module in the page module map permanently — a
// retry of the same URL resolves from that map without touching the network.
// Each retry therefore needs a fresh query nonce to become a new module (#353).
let hpLazyRetrySeq = 0;
import {
  currentLabs, hashSpace, noteLabsRender, subscribeLabs, type LabsSnapshot,
} from './labs';
import {
  ISO_CAMERA, ISO_FLOOR_EDGE_HEIGHT, ISO_WALL_HEIGHT, isoFloorMatrixCss,
  projectPlanPoint, projectedFrame,
  unprojectFloorPoint, type ScenePoint, type ViewRect,
} from './iso-projection';
import {
  buildIsoFloorGeometry, buildIsoWallGeometry, isoEffectiveView, isoGeometryFingerprint,
  type IsoFloorGeometry, type IsoWallGeometry,
} from './iso-walls';
import {
  buildIsoOpeningBasis, isoOpeningBounds, projectIsoOpening, resolveIsoDecoration,
  type IsoDecorationLayers, type IsoOpeningBasis, type IsoOpeningPanel,
} from './iso-openings';
import {
  acquireHaRegistries, activeRegistryHass, cacheHaBindingStatuses,
  fullRegistryHass, haRegistryBuildSignature, haRegistryDiagnostics, haRegistrySnapshot,
  openingEntityAvailable, refreshHaRegistries, renderOpeningEntityAvailable,
  resolveHaBindingStatus,
  type HaBindingStatus, type HaRegistrySnapshot,
} from './ha-binding-status';
import type { DecorShape, DecorStyle } from './editors/decor/types';
import {
  DECOR_ASSETS_API_VERSION, decorAssetIds, projectDecorImage,
  resolveDecorAssets, type DecorAsset,
} from './decor-assets';
import {
  DEFAULT_DECOR_STYLE, boxAnchors, boxCorners, clamp01, decorCmToUnits,
  decorStrokeUnits, decorStyleFromSettings, decorStyleOf, decorStylePatch,
  decorUnitsToCm, mergeSnapGeometry, normalizeAngle, nudgeDecorShape, resizeDecorBox,
  resizedBoxTopLeft, snapDecorPoint, validDecorDraft,
  type DecorBox, type SnapGeometry,
} from './editors/decor/geometry';
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
import type {
  DeviceDragState, OpeningPlacementCandidate, OpMeasure, RenderOpening,
} from './interaction-types';
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

const CARD_VERSION = '1.72.0-beta.4';
const ENTRY_BUILD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const EDITOR_RETRY_ASSET = '__HOUSEPLAN_EDITOR_RETRY_ASSET__';

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
const CAMERA_BUTTON_MS = 180;
const CAMERA_WHEEL_MS = 160;
const CAMERA_FIT_MS = 220;
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
const warmBoot = new Map<string, WarmEntry[]>(); let warmGen = 0;
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

/** Smallest rectangle holding both (docs/CANVAS.md §4). */
const unionRect = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** #313: one Thickness-tool hit — a room interval or independent masonry. */
type WallThickSource = { kind: 'room' }
  | { kind: 'partition'; id: string }
  | { kind: 'draft'; id: string; segment: number };
type WallThickHit = {
  a: number[]; b: number[]; roomId: string; segs: number[][];
  open: boolean; cm: number; source: WallThickSource;
};

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
  activeDraftId: string | null;
};
const MAX_ROOM_DRAFTS = 200;
const MAX_DRAFT_POINTS = 500;
const MAX_DRAFT_SEGMENTS = 2000;
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
  room_drafts?: RoomDraftCfg[];
  partitions?: PartitionCfg[];
  wall_columns?: WallColumnCfg[];
  decor?: DecorShape[];
  plan_transform: {
    plan_x?: number; plan_y?: number; plan_scale?: number;
    plan_scale_x?: number; plan_scale_y?: number; plan_angle?: number;
  };
}
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
  /** Logical row restored after a nested marker dialog closes. */
  anchor?: string;
  busy?: string;
}

type FixedFloorState = FixedFloorSelection | { kind: 'pending'; value: unknown };

/**
 * #400: the paint order of the selection handles IS the hit priority, so it is
 * a named decision rather than a consequence of where the blocks happen to sit
 * in the template.
 *
 * Corner and edge handles carry the same hit radius (1.8 % of the view). On
 * furniture narrower than 4·hr — a 40 cm cabinet — their circles overlap, and
 * whichever is painted last takes the tap. The corner must be last: an edge
 * handle scales one axis, a corner scales both, and the object is small
 * exactly when proportional resize matters most.
 */
const HANDLE_PAINT_ORDER = ['edges', 'corners'] as const;

export class HouseplanCard extends LitElement {
  public requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: PropertyDeclaration): void {
    if (name === 'hass' && this.hass && this._liveRt) {
      const snapshot = this._visibleDeviceSnapshot || this._candidateDeviceSnapshot;
      const render = this._liveRt.hass(
        oldValue as HassRenderSnapshot | null | undefined, this.hass,
        snapshot ? { entityIds: snapshot.entityIds } : null,
        () => intakeHass(this),
      );
      if (!render) return;
    }
    if (name !== undefined) this._terminalFrame = 0;
    if (this._editorRuntime?._routeLiveEditorUpdate(name, oldValue)) return;
    this._liveRt?.clear();
    super.requestUpdate(name, oldValue, options);
  }

  public _editorRuntime: import('./houseplan-editor-runtime').HouseplanEditorRuntime | null = null;
  private _liveRt: import('./live-interaction-runtime').LiveRuntime | null = null;
  public _onboardingRuntime: import('./houseplan-onboarding-runtime').HouseplanOnboardingRuntime | null = null;
  private _editorRuntimeLoadingVisible = false;
  /** #39: pending large-backdrop decision; set only by the lazy pick flow. */
  public _backdropGuard: BackdropGuardState | null = null;
  private _editorRuntimeLoadingTimer?: number;
  private _editorModeRequest = 0;
  private _warmModeRequest = 0;
  private readonly _editorRuntimeLoader = new EditorRuntimeLoader<
    import('./houseplan-editor-runtime').HouseplanEditorRuntime
  >({
    expectedFingerprint: ENTRY_BUILD_FINGERPRINT,
    load: async (attempt) => {
      const module = attempt === 0
        ? await import('./houseplan-editor-runtime')
        : await import(/* @vite-ignore */ (() => {
            const url = new URL(EDITOR_RETRY_ASSET, import.meta.url);
            url.searchParams.set('hp_retry', `${CARD_VERSION}-${++hpLazyRetrySeq}`);
            return url.href;
          })()) as typeof import('./houseplan-editor-runtime');
      return {
        fingerprint: module.EDITOR_RUNTIME_FINGERPRINT,
        create: () => new module.HouseplanEditorRuntime(
          this as unknown as import('./houseplan-editor-runtime').HouseplanEditorHostPort,
        ),
      };
    },
    install: (runtime) => {
      this._editorRuntime = runtime;
    },
    stateChanged: (state) => this._editorRuntimeStateChanged(state),
    failed: (error, info) => {
      console.error('[houseplan] unable to load editor runtime', error);
      this._showToast(lazyLoadFailureMessage((key) => this._t(key), info));
    },
  });

  private readonly _onboardingRuntimeLoader = new EditorRuntimeLoader<
    import('./houseplan-onboarding-runtime').HouseplanOnboardingRuntime
  >({
    expectedFingerprint: ENTRY_BUILD_FINGERPRINT,
    load: async (attempt) => {
      const module = attempt === 0
        ? await import('./houseplan-onboarding-runtime')
        : await import(/* @vite-ignore */ (() => {
            const url = new URL('__HOUSEPLAN_ONBOARDING_RETRY_ASSET__', import.meta.url);
            url.searchParams.set('hp_retry', `${CARD_VERSION}-${++hpLazyRetrySeq}`);
            return url.href;
          })()) as typeof import('./houseplan-onboarding-runtime');
      return {
        fingerprint: module.ONBOARDING_RUNTIME_FINGERPRINT,
        create: () => new module.HouseplanOnboardingRuntime(
          this as unknown as import('./houseplan-editor-runtime').HouseplanEditorHostPort,
        ),
      };
    },
    install: (runtime) => {
      this._onboardingRuntime = runtime;
    },
    failed: (error, info) => {
      console.error('[houseplan] unable to load onboarding runtime', error);
      this._showToast(lazyLoadFailureMessage((key) => this._t(key), info));
    },
  });

  public _editorRuntimeOrThrow(): import('./houseplan-editor-runtime').HouseplanEditorRuntime {
    if (!this._editorRuntime) throw new Error('Houseplan editor runtime is not loaded');
    return this._editorRuntime;
  }

  public async _ensureEditorRuntime(): Promise<boolean> {
    return this._editorRuntimeLoader.ensure();
  }

  public async _ensureOnboardingRuntime(): Promise<boolean> {
    return this._onboardingRuntimeLoader.ensure();
  }

  private _editorRuntimeStateChanged(state: EditorRuntimeLoaderState): void {
    clearTimeout(this._editorRuntimeLoadingTimer);
    this._editorRuntimeLoadingTimer = undefined;
    if (state === 'loading') {
      this._editorRuntimeLoadingTimer = window.setTimeout(() => {
        this._editorRuntimeLoadingVisible = true;
        this.requestUpdate();
      }, 150);
      return;
    }
    this._editorRuntimeLoadingVisible = false;
    this.requestUpdate();
  }

  public async _requestMode(
    mode: 'view' | 'plan' | 'devices' | 'decor',
    animate = true,
    adopt = false,
  ): Promise<void> {
    const request = ++this._editorModeRequest;
    if (adopt) {
      this._warmModeRequest = request;
      if (this._refitRaf) { cancelAnimationFrame(this._refitRaf); this._refitRaf = 0; }
      this._pendingRefitSize = null;
    }
    if (mode !== 'view' && !(await this._ensureEditorRuntime())) {
      if (this._warmModeRequest === request) this._warmModeRequest = 0;
      return;
    }
    if (request !== this._editorModeRequest || !this.isConnected) {
      if (this._warmModeRequest === request) this._warmModeRequest = 0;
      return;
    }
    if (adopt) {
      this._adoptMode(mode);
      if (this._warmRevivePending) {
        clearTimeout(this._warmReviveTimer);
        this._warmReviveTimer = undefined;
        this._warmReviveDialog();
      }
      this.requestUpdate();
      void this.updateComplete.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this._warmModeRequest !== request || request !== this._editorModeRequest) return;
        const stage = this._stageEl;
        this._lastValidStageSize = stage && stage.clientWidth > 0 && stage.clientHeight > 0
          ? [stage.clientWidth, stage.clientHeight] : null;
        this._pendingRefitSize = null;
        this._warmModeRequest = 0;
      })));
      return;
    }
    this._setMode(mode, animate);
  }
  public hass?: any;
  private _config?: CardConfig;

  private _space = 'f1';
  private _layout: DeviceLayout = {};
  private _serverStorage = false;
  private _loadOk = false;
  /** null until config/get answers; then mirrors auth.may_write for this user. */
  private _serverCanWrite: boolean | null = null;
  private _loading = false;
  private _loadTries = 0;
  private _serverCfg: ServerConfig | null = null;
  private _cfgRev = 0;
  private _cfgContentFingerprint = '';
  private _unsubCfg: (() => void) | null = null;
  private _unsubLayout: (() => void) | null = null;
  private _unsubVirtual: (() => void) | null = null;
  private _liveSyncAttempt: Promise<void> | null = null;
  private _liveSyncGeneration = 0;
  private _liveSyncConnection: any = null;
  private _layoutRev = 0;
  private _layoutContentFingerprint = '';
  private _virtualLights: VirtualLightSnapshot = virtualLightSnapshot(null);
  /** One-deep server snapshot; invalidated by the first later plan edit. */
  private _canOptimizeUndo = false;
  private _undoKind: 'optimize' | 'import' | null = null;
  private _devices: DevItem[] = [];
  private _regSignature = '';
  private _defPos: Record<string, { x: number; y: number }> = {};
  private _newSyncKey = '';
  /** Saved positions temporarily superseded by authoritative HA Area truth. */
  private _areaRelocationIds = new Set<string>();
  /** First authoritative absence is runtime evidence to re-check, never to delete. */
  private _areaSnapshotCleanupCandidates = new Map<MarkerAreaBinding, number>();
  private _areaRelocationSyncKey = '';
  private _areaRelocationWrite: Promise<void> = Promise.resolve();
  private _tip: {
    x: number;
    y: number;
    title: string;
    meta: string;
    lqi?: number | null;
    temp?: number | null;
    hum?: number | null;
    room?: boolean;
  } | null = null;
  /** Room whose physical perimeter is highlighted in View. The explicit
   *  overlay is needed because thick wall bodies paint above room shapes. */
  private _hoverRoom: { space: string; room: RoomCfg } | null = null;
  private readonly _pointerModality = new PointerModalityController(
    this,
    () => this._syncPointerHoverTargets(),
  );
  private _pointerHoverObserver?: MutationObserver;
  private _devicePressAnimations = new Map<string, Animation>();
  private _selId: string | null = null;
  private _toast = '';
  private _toastTimer?: number;

  // --- room markup editor ---
  /** Interaction mode (docs/UX-MODES.md): view = display only, plan = geometry
   * editing, devices = marker placement/config. Never persisted — every load
   * starts in view. */
  private _mode: 'view' | 'plan' | 'devices' | 'decor' = 'view';
  /** Editor mode from a same-route warm remount while can_write is unknown. */
  private _pendingNavMode: 'plan' | 'devices' | 'decor' | null = null;
  // ---- decor (background) editor ----
  private _decorTool: DecorTool = 'select';
  private _decorStyle: DecorStyle = { ...DEFAULT_DECOR_STYLE };

  /** #377: the persisted default style seeds _decorStyle once, from the first
   * config that arrives (cache or server); later refreshes never overwrite a
   * live editing session. */
  private _decorStyleSeeded = false;

  private _seedDecorStyle(cfg: ServerConfig | null): void {
    if (this._decorStyleSeeded || !cfg) return;
    this._decorStyleSeeded = true;
    const raw = (cfg.settings as { decor_default_style?: unknown } | undefined)
      ?.decor_default_style;
    if (raw) this._decorStyle = decorStyleFromSettings(raw, DEFAULT_DECOR_STYLE);
  }
  private _decorDraft: { kind: 'line' | 'rect' | 'ellipse'; a: number[]; b: number[]; pid: number } | null = null;
  private _decorMove: {
    id: string; start: number[]; orig: DecorShape; pid: number; moved: boolean;
    before: SpaceGeometryState | null;
  } | null = null;
  private _decorSel: string | null = null;
  /** Pending eraser-tool confirmation. Delete/Backspace remains the direct
   *  command for an explicitly selected object. */
  private _decorEraseConfirm: { id: string; kind: DecorShape['kind'] } | null = null;
  /** The text dialog. Live references are part of `text`; `pickerEntity` is
   *  only transient UI state and is never persisted (docs/LIVE-TEXT.md). */
  private _decorTextDialog: {
    id?: string; x: number; y: number; text: string; color: string;
    opacity: number; angle: string; sizeCm: number;
    pickerEntity?: string;
    /** Keep an old link when inline syntax cannot represent its attr/unit losslessly. */
    preserveLegacy?: boolean;
  } | null = null;
  /** Style editor opened by double-clicking a non-text decor object. */
  private _decorShapeDialog: {
    id: string; kind: 'line' | 'rect' | 'ellipse' | 'furniture' | 'image';
    color: string; opacity: number; widthCm: number;
    lineStyle?: 'solid' | 'dashed';
    fill?: boolean; fillColor?: string; fillOpacity?: number;
    lengthCm?: number; sizeWCm?: number; sizeHCm?: number; angle: string;
    symbol?: string;
    assetId?: string;
    sizeWField?: string; sizeHField?: string; flipH?: boolean; flipV?: boolean;
  } | null = null;
  private _backdropDialog: { widthCm: number; heightCm: number; angle: string } | null = null;
  /** Last textarea selection survives moving focus to the HA pickers. */
  private _decorTextSelection: { start: number; end: number } = { start: 0, end: 0 };
  /**
   * The furniture palette (docs/FURNITURE.md §3): which symbol is armed and at
   * what REAL size it will be placed. `w`/`h` are centimetres — the fields show
   * them in metres or feet, but the config's one true scale is `cell_cm`, and
   * a unit system is a display setting, never a stored one.
   */
  private _furnPalette: { symbol: string; w: number; h: number } | null = null;
  private _decorImagePalette: DecorAsset | null = null;
  private _decorAssetCatalog: DecorAsset[] = [];
  private _decorAssets = new Map<string, DecorAsset>();
  private _decorAssetBusy = false;
  /** Category currently open in the two-level furniture palette. */
  private _furnCategory: string | null = null;
  /** Last fine-pointer location while one furniture stamp is armed. The final
   * geometry is deliberately resolved on render from the live palette so a
   * Width/Depth edit updates the ghost without another mouse move (#359). */
  private _furnPreviewInput: { raw: [number, number]; free: boolean } | null = null;
  /** Touch/pen has no hover. Delay its one-shot stamp until a clean pointerup
   * so pointercancel or a second contact cannot save accidental geometry. */
  private _furnTouchPending: {
    pid: number; sx: number; sy: number; pointerType: string; cancelled: boolean;
  } | null = null;
  /** The selected shape's own unrotated frame (text is measured from SVG). */
  private _dtBox: { id: string; x: number; y: number; w: number; h: number } | null = null;
  /**
   * One live transform gesture for every selected decor kind. Lines use two
   * endpoint handles; text uses one physical font size; box kinds use the
   * same oriented resize/rotate controller.
   */
  private _dtDrag: {
    id: string; kind: 'scale' | 'rotate'; pid: number;
    /** the pivot the block is scaled and rotated about (render units) */
    ax: number; ay: number;
    /** distance / bearing of the pointer at the start, and the stored values */
    r0: number; a0: number; textSizeCm0: number; angle0: number;
    /** box shapes: the dragged local edge signs and the oriented box at drag start */
    sgx?: number; sgy?: number;
    orig?: DecorBox;
    origShape: DecorShape;
    before: SpaceGeometryState | null;
    lineEnd?: 0 | 1;
    moved: boolean;
  } | null = null;
  /**
   * The live backdrop gesture (docs/BACKDROP.md §2): moving the picture by its
   * body, scaling it by a corner handle or rotating it by the upper handle.
   * `base` is the untransformed, centred rectangle the transform is measured
   * from, so a gesture never accumulates rounding of its own.
   */
  private _bdDrag: {
    kind: 'move' | 'scale' | 'rotate';
    pid: number;
    /** pointer down, render units */
    sx: number; sy: number;
    /** the centred default rect (render units) — the transform's origin */
    base: Rect;
    /** transform at pointer down */
    p0: { dx: number; dy: number; sx: number; sy: number; angle: number };
    /** the corner that STAYS PUT while scaling (render units) */
    fx: number; fy: number;
    /** which way the dragged corner points from the fixed one (±1) */
    sgx: number; sgy: number;
    rect0: DecorBox;
    before: SpaceGeometryState | null;
    moved: boolean;
  } | null = null;

  /** Edit tabs are offered to admins only (hass.user missing → assume admin). */
  /**
   * Editor chrome (Plan/Devices/Background tabs, space +/gear).
   * Driven by the server `can_write` flag from `houseplan/config/get` so the
   * UI matches `auth.may_write` / the `admin_only` option (audit P0-4).
   * Until the server answers, fail CLOSED: missing `hass.user` must never
   * open the editors (`=== true`, not `!== false`).
   */
  private get _canEdit(): boolean {
    if (!this._norm) return false;
    if (this._serverCanWrite === true) return true;
    if (this._serverCanWrite === false) return false;
    return this.hass?.user?.is_admin === true;
  }

  /** Legacy alias: markup machinery is active exactly in plan mode. */
  private get _kiosk(): boolean {
    return !!this._config?.kiosk;
  }

  private _showKioskDots(): void {
    this._kioskDots = true;
    clearTimeout(this._kioskDotsTimer);
    this._kioskDotsTimer = window.setTimeout(() => (this._kioskDots = false), 2500);
  }

  /** Kiosk auto-carousel: advance to the next space every `cycle` seconds. */
  /** Which way the incoming plan moves when the active space changes. */
  private _slide: '' | 'left' | 'right' = '';
  private _slideTimer?: number;

  private _reducedMotion = false;
  private _motionMedia?: MediaQueryList;
  private _onMotionChange = (event: MediaQueryListEvent): void => {
    this._reducedMotion = event.matches;
    this._cancelDevicePressFeedback();
    if (event.matches) this._cancelCameraTransition(true);
    // A preference change to reduced motion is authoritative immediately: do
    // not leave a 220 ms camera/chrome tween running until its old deadline.
    if (event.matches && this._modeTransitionPreparing) {
      this._modeTransitionForceAtomic = true;
    } else if (event.matches && this._modeTransition.active) {
      this._cancelModeTransition(true);
    }
    this.requestUpdate();
  };
  /** Last editor kept in the collapsing chrome so leaving it can animate out. */
  private _editorChromeMode: 'plan' | 'devices' | 'decor' = 'plan';
  private _modeTransitionVisual: ModeVisualState | null = null;
  private _modeTransitionPreparing = false;
  /** A visibility/reduced-motion interruption during the measurement frame
   * must still publish the measured target atomically, without waiting for a
   * RAF that a hidden document may throttle. */
  private _modeTransitionForceAtomic = false;
  private _modeTransitionRequest = 0;
  private _modeTransitionTargetZoom = 1;
  private _modeTransitionTargetCenterX: number | undefined;
  private _modeTransitionTargetCenterY: number | undefined;
  /** Last intended editor camera retained while an exit-to-View can still be
   * retargeted back to an editor. It is session-only, like `_viewModeSnap`. */
  private _modeTransitionEditorCamera: {
    zoom: number; centerX?: number; centerY?: number;
  } | null = null;
  private readonly _modeTransition = new ModeTransitionController({
    frame: (state) => this._applyModeTransitionFrame(state),
    settled: (state) => this._settleModeTransition(state),
  });
  /** #82: one camera-only transition inside a settled mode. It never owns
   * chrome/background coordinates — those remain exclusive to #101. */
  private _cameraTransitionFit: ModeViewBox | null = null;
  private readonly _cameraTransition = new CameraTransitionController({
    frame: (state) => this._applyCameraTransitionFrame(state),
    settled: (state) => this._settleCameraTransition(state),
  });
  /** Explicit second-level toolbar group. No current tools are grouped yet;
   *  the shared host/API prevents future editors from inventing dropdowns. */
  private declare _editorSecondary: import('./editor-secondary').EditorSecondaryController;
  private readonly _editorSecondaryCopy: EditorSecondaryCopy = {
    groupActive: (group, item) => this._t('editor.group_active', { group, item }),
    openGroup: (group) => this._t('editor.open_group', { group }),
    disabledAction: (action, reason) => this._t('editor.disabled_action', { action, reason }),
  };

  private get _modeTransitionBusy(): boolean {
    return this._modeTransitionPreparing || this._modeTransition.active;
  }

  private get _doubleFitEnabled(): boolean { return this._mode === 'view' && !this._vacFit && !this._modeTransitionBusy && !this._touchSequenceMultitouch && this._continuity.state === 'steady' && !this._continuity.overlayBlocksInteraction; }

  private _cameraState(): CameraState {
    const view = this._viewOr(this._baseVb());
    return { zoom: this._zoom, viewBox: { ...view } };
  }

  private _normalizeCameraState(state: CameraState): CameraState {
    const fit = this._cameraTransitionFit || fitView(this._baseVb(), this._stageAspect());
    const zoom = Math.min(HouseplanCard.ZOOM_MAX,
      Math.max(HouseplanCard.ZOOM_MIN, state.zoom));
    return { zoom, viewBox: this._clampView({ ...state.viewBox }, fit) };
  }

  private _applyCameraTransitionFrame(state: CameraTransitionState): void {
    const presented = this._normalizeCameraState(state.presented);
    // Retargeting must start from the camera that was actually painted, not
    // from an unclamped interpolation hidden inside the controller.
    state.presented = presented;
    this._zoom = presented.zoom;
    this._view = { ...presented.viewBox };
    this._liveVp(true);
  }

  private _settleCameraTransition(state: CameraTransitionState): void {
    const target = this._normalizeCameraState(state.to);
    this._zoom = target.zoom;
    this._view = { ...target.viewBox };
    this._cameraTransitionFit = null;
    if (state.reason !== 'room') this._saveZoom();
    this.requestUpdate();
  }

  /** Cancel a running camera transition.
   *
   *  #396: two cancellations look alike and mean opposite things. A STRUCTURAL
   *  one (space/mode change, adopt, resize, restore, disconnect) replaces the
   *  view wholesale — its stale target must not be written anywhere. A USER
   *  one (touching the plan on top of one's own zoom) freezes the presented
   *  frame and leaves it on screen: that frame IS the current intent, and
   *  before #82 the zoom commands persisted it synchronously. Keeping both on
   *  one branch is what lost the interrupted zoom. */
  private _cancelCameraTransition(commitTarget = false, keepPresented = false): void {
    const reason = this._cameraTransition.state?.reason;
    const presentedZoom = keepPresented && this._cameraTransition.active
      ? this._cameraTransition.presented?.zoom
      : undefined;
    this._cameraTransition.cancel(commitTarget);
    this._cameraTransitionFit = null;
    if (presentedZoom !== undefined && reason !== 'room') this._saveZoom();
  }

  /** A discrete camera command may follow a rapid mode click. Finish that
   *  short structural transition first so two controllers never write `_view`
   *  in the same frame. */
  private _prepareCameraCommand(): void {
    if (this._modeTransitionBusy) this._cancelModeTransition(true);
    if (this._tool === 'opening') {
      this._cursorPt = null;
      this._clearOpeningPlacement(false);
    }
  }

  private _startCameraTransition(
    target: CameraState,
    fit: ModeViewBox,
    reason: CameraTransitionReason,
    duration: number,
  ): boolean {
    const current = this._cameraState();
    const runningTarget = this._cameraTransition.target;
    if (runningTarget && sameCameraState(runningTarget, target)) return false;
    if (sameCameraState(current, target)) {
      this._cancelCameraTransition(false);
      return false;
    }
    this._cameraTransitionFit = { ...fit };
    this._cameraTransition.start(current, target, reason,
      this._reducedMotion ? 0 : duration);
    return true;
  }

  private _cssColor(value: string | null | undefined, fallback: string): string {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;color:${text}`;
    this.renderRoot.append(probe);
    const resolved = getComputedStyle(probe).color || fallback;
    probe.remove();
    return resolved;
  }

  private _currentModeVisual(mode = this._mode as HouseplanMode): ModeVisualState | null {
    // During the one-frame target measurement the controller has not started
    // yet, but `_modeTransitionVisual` is already the exact painted endpoint.
    // A rapid second click must retarget from that frame instead of rebuilding
    // an approximation from the newly committed logical mode.
    const presented = this._modeTransition.presented || this._modeTransitionVisual;
    if (presented) return { ...presented, viewport: {
      ...presented.viewport, viewBox: { ...presented.viewport.viewBox },
    } };
    const stage = this._stageEl;
    if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) return null;
    const chrome = this.renderRoot.querySelector('.editorchrome') as HTMLElement | null;
    const view = this._viewOr(this._baseVb());
    const paper = this.renderRoot.querySelector('.hp-paper') as SVGElement | null;
    const backdrop = this.renderRoot.querySelector('.hp-backdrop') as SVGElement | null;
    const zoomwrap = this.renderRoot.querySelector('.zoomwrap') as HTMLElement | null;
    const filter = zoomwrap ? getComputedStyle(zoomwrap).filter : '';
    const brightness = Number(/brightness\(([^)]+)\)/.exec(filter)?.[1]);
    return {
      presentedMode: mode,
      editorChromeHeight: mode === 'view' ? 0 : chrome?.getBoundingClientRect().height || 0,
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
      viewport: viewportFromViewBox(view, stage.clientWidth),
      stageColor: getComputedStyle(stage).backgroundColor || 'rgb(255, 255, 255)',
      paperColor: paper ? getComputedStyle(paper).fill : 'rgb(255, 255, 255)',
      sceneBrightness: Number.isFinite(brightness) ? brightness : 1,
      architectureOpacity: mode === 'decor' ? 0.35 : 1,
      backdropOpacity: backdrop ? Number(getComputedStyle(backdrop).opacity) || 1 : 1,
      viewWeight: mode === 'view' ? 1 : 0,
      editorWeight: mode === 'view' ? 0 : 1,
      toolbarContentOpacity: mode === 'view' ? 0 : 1,
    };
  }

  private _viewForModeTarget(
    zoom: number, centerX: number | undefined, centerY: number | undefined,
    stageWidth: number, stageHeight: number,
  ): ModeViewBox {
    const vb = this._baseVb();
    const fit = fitView(vb, stageWidth / Math.max(1, stageHeight));
    const z = Math.min(HouseplanCard.ZOOM_MAX, Math.max(HouseplanCard.ZOOM_MIN, zoom));
    const w = fit.w / z, h = fit.h / z;
    const cx = centerX ?? fit.x + fit.w / 2;
    const cy = centerY ?? fit.y + fit.h / 2;
    return this._clampView({ x: cx - w / 2, y: cy - h / 2, w, h }, fit);
  }

  private _targetStageColor(mode: HouseplanMode): string {
    if (mode !== 'view') return 'rgb(255, 255, 255)';
    return this._cssColor(this._stageBg(this._spaceDisplayForRender()),
      this._cssColor('var(--ha-card-background, var(--card-background-color, #111))', 'rgb(17, 17, 17)'));
  }

  private _targetPaperColor(mode: HouseplanMode): string {
    if (mode !== 'view' || !this._spaceModel()?.bg) return 'rgb(255, 255, 255)';
    return this._cssColor('var(--ha-card-background, var(--card-background-color, #111))', 'rgb(17, 17, 17)');
  }

  private _targetBrightness(_mode: HouseplanMode): number {
    return 1;
  }

  private _applyModeTransitionFrame(state: ModeTransitionState): void {
    if (state.targetMode !== this._mode) return;
    this._modeTransitionVisual = state.presented;
    this._view = { ...state.presented.viewport.viewBox };
    this.requestUpdate();
  }

  private _settleModeTransition(state: ModeTransitionState): void {
    if (state.targetMode !== this._mode) return;
    const settledRequest = this._modeTransitionRequest;
    this._view = { ...state.to.viewport.viewBox };
    this._zoom = this._modeTransitionTargetZoom;
    this._modeTransitionVisual = null;
    this._modeTransitionPreparing = false;
    this._lastValidStageSize = [state.to.stageWidth, state.to.stageHeight];
    if (this._mode === 'view') {
      this._saveZoom();
      this._viewModeSnap = null;
      this._modeTransitionEditorCamera = null;
    }
    this.requestUpdate();
    void this.updateComplete.then(() => {
      if (!this.isConnected || settledRequest !== this._modeTransitionRequest
          || this._modeTransitionBusy || state.targetMode !== this._mode) return;
      // Natural responsive layout remains the final authority. A breakpoint,
      // font load or outer resize may land while ResizeObserver is suppressed
      // by the transition; reconcile it before the next visible interaction.
      const stage = this._stageEl;
      if (stage && stage.clientWidth > 0 && stage.clientHeight > 0
          && (Math.abs(stage.clientWidth - state.to.stageWidth) > 0.5
            || Math.abs(stage.clientHeight - state.to.stageHeight) > 0.5)) {
        const current = this._view;
        this._lastValidStageSize = [stage.clientWidth, stage.clientHeight];
        this._applyView(
          this._zoom,
          current ? current.x + current.w / 2 : undefined,
          current ? current.y + current.h / 2 : undefined,
        );
        this.requestUpdate();
      }
      const focused = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
      const lostWithOutgoingUi = !focused || !focused.isConnected
        || !!focused.closest?.('.editorchrome, .stage');
      if (lostWithOutgoingUi) {
        (this.renderRoot.querySelector('.modetab.active') as HTMLElement | null)
          ?.focus?.({ preventScroll: true });
      }
    });
  }

  private _cancelModeTransition(commitTarget = true): void {
    this._cancelCameraTransition(false);
    const hadControllerState = !!this._modeTransition.state;
    this._modeTransitionRequest++;
    this._modeTransitionPreparing = false;
    this._modeTransitionForceAtomic = false;
    this._modeTransition.cancel(commitTarget);
    // A preparing transition has no controller state to settle. Its measured
    // callback is invalidated above, so always discard the retained frame;
    // otherwise a space switch/recovery during measurement can leave inline
    // height/background/camera coordinates attached indefinitely.
    if (!commitTarget || !hadControllerState) this._modeTransitionVisual = null;
  }

  /** Adopt a mode from configuration/recovery without leaving a measured
   * transition alive. User navigation continues to go through `_setMode()`. */
  private _adoptMode(mode: HouseplanMode): void {
    if (mode !== this._mode) this._clearRoomFocus(true);
    this._cancelModeTransition(false);
    this._mode = mode;
    if (mode !== 'view') this._editorChromeMode = mode;
  }

  /** Route departure cannot wait for a decorative frame that will never be
   * shown. Publish the pending View camera directly before warm persistence. */
  private _commitViewModeAtomic(
    from: ModeVisualState | null,
    targetZoom: number,
    targetCenterX?: number,
    targetCenterY?: number,
  ): void {
    this._modeTransitionPreparing = false;
    this._modeTransitionVisual = null;
    this._modeTransitionForceAtomic = false;
    this._zoom = targetZoom;
    if (from) {
      const targetStageWidth = this._stageEl?.clientWidth || from.stageWidth;
      const targetStageHeight = Math.max(1, from.stageHeight + from.editorChromeHeight);
      this._view = this._viewForModeTarget(
        targetZoom, targetCenterX, targetCenterY, targetStageWidth, targetStageHeight,
      );
      this._lastValidStageSize = [targetStageWidth, targetStageHeight];
    } else {
      this._view = null;
    }
    this._viewModeSnap = null;
    this._modeTransitionEditorCamera = null;
    this._saveZoom();
    this.requestUpdate();
  }

  private _prepareModeTransition(
    request: number,
    from: ModeVisualState,
    targetMode: HouseplanMode,
    targetZoom: number,
    targetCenterX?: number,
    targetCenterY?: number,
  ): void {
    void this.updateComplete.then(() => {
      if (!this.isConnected || request !== this._modeTransitionRequest || this._mode !== targetMode) {
        // Only clean the generation that still owns the preparing flag. A
        // stale callback must not cancel a newer transition, but a config or
        // recovery mode adoption in the measurement window must never strand
        // the scene in its inert/busy state.
        if (request === this._modeTransitionRequest) {
          this._modeTransitionPreparing = false;
          this._modeTransitionVisual = null;
          this._modeTransitionForceAtomic = false;
          this.requestUpdate();
        }
        return;
      }
      const chrome = this.renderRoot.querySelector('.editorchrome') as HTMLElement | null;
      const inner = chrome?.querySelector('.editorchrome-inner') as HTMLElement | null;
      const targetChromeHeight = targetMode === 'view' ? 0 : inner?.scrollHeight || inner?.getBoundingClientRect().height || 0;
      const totalHeight = Math.max(1, from.stageHeight + from.editorChromeHeight);
      const targetStageHeight = Math.max(1, totalHeight - targetChromeHeight);
      const targetStageWidth = this._stageEl?.clientWidth || from.stageWidth;
      if (targetStageWidth <= 0 || targetStageHeight <= 0) {
        this._modeTransitionPreparing = false;
        this._modeTransitionVisual = null;
        this._applyView(targetZoom, targetCenterX, targetCenterY);
        this.requestUpdate();
        return;
      }
      const targetView = this._viewForModeTarget(
        targetZoom, targetCenterX, targetCenterY, targetStageWidth, targetStageHeight,
      );
      const to: ModeVisualState = {
        presentedMode: targetMode,
        editorChromeHeight: targetChromeHeight,
        stageWidth: targetStageWidth,
        stageHeight: targetStageHeight,
        viewport: viewportFromViewBox(targetView, targetStageWidth),
        stageColor: this._targetStageColor(targetMode),
        paperColor: this._targetPaperColor(targetMode),
        sceneBrightness: this._targetBrightness(targetMode),
        architectureOpacity: targetMode === 'decor' ? 0.35 : 1,
        backdropOpacity: targetMode === 'decor' && this._decorTool !== 'backdrop' ? 0.5 : 1,
        viewWeight: targetMode === 'view' ? 1 : 0,
        editorWeight: targetMode === 'view' ? 0 : 1,
        toolbarContentOpacity: targetMode === 'view' ? 0 : 1,
      };
      this._modeTransitionPreparing = false;
      const forceAtomic = this._modeTransitionForceAtomic;
      this._modeTransitionForceAtomic = false;
      this._modeTransition.start(from, to, targetMode,
        this._reducedMotion || forceAtomic ? 0 : 220);
    });
  }

  /** An own `floor` property is deliberate, including invalid/null YAML. */
  private get _hasFixedFloor(): boolean {
    return !!this._config && Object.prototype.hasOwnProperty.call(this._config, 'floor');
  }

  /**
   * Resolve fixed-floor authority against one model snapshot. Cache may safely
   * prove an exact stable id, but it may not reject a missing id or resolve a
   * positional index until the integration has answered authoritatively.
   */
  private _fixedFloorState(models = this._model, authoritative = this._loadOk): FixedFloorState {
    const value = this._config?.floor;
    const selection = resolveFixedFloor({
      spaceIds: models.map((space) => space.id),
      hasFloor: this._hasFixedFloor,
      floor: value,
    });
    if (!this._hasFixedFloor || authoritative) return selection;
    if (typeof value === 'number') {
      if (selection.kind === 'valid'
          || selection.kind === 'invalid' && selection.reason === 'out-of-range-index') {
        return { kind: 'pending', value };
      }
      return selection;
    }
    if (selection.kind === 'valid') return selection;
    if (selection.kind === 'invalid' && selection.reason !== 'unknown-id') return selection;
    return { kind: 'pending', value };
  }

  /** One boundary for every mutation of the active space. */
  private _canCommitSpace(id: string, authority = false): boolean {
    if (authority || !this._hasFixedFloor) return true;
    const fixed = this._fixedFloorState();
    return fixed.kind === 'valid' && fixed.id === id;
  }

  private _commitSpace(id: string, authority = false): boolean {
    if (!this._canCommitSpace(id, authority)) return false;
    if (id !== this._space) {
      this._clearRoomFocus(true);
      this._cancelDangerConfirm();
      this._cancelCameraTransition(false);
      this._clearTransientHover(true);
      this._cancelDevicePressFeedback();
      this._editorRuntime?._clearFurniturePreview();
    }
    this._space = id;
    return true;
  }

  /** Change the space with the usual sideways transition. */
  private _slideTo(id: string, dir: 'left' | 'right'): boolean {
    if (id === this._space) return true;
    if (!this._canCommitSpace(id)) return false;
    if (this._wallFaceBatch) this._roomDialogCancel();
    if (this._mode === 'plan' && this._tool === 'draw' && !this._finishWallChain()) return false;
    this._cancelModeTransition(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (this._activeDraftId) this._resumeDraftBySpace[this._space] = this._activeDraftId;
    this._commitSpace(id);
    this._path = [];
    this._clearPlanSnapHover();
    this._clearOpeningPlacement(true);
    this._tool = 'draw';
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._selId = null;
    this._physicalSel = null;
    this._editorSecondary?.closeForNavigation();
    this._physicalDialog = null;
    this._physicalDrag = null;
    if (this._mode === 'plan' && this._tool === 'draw') this._resumeLastDraft();
    this._restoreZoom();
    if (reduce) return true;
    this._slide = dir;
    clearTimeout(this._slideTimer);
    this._slideTimer = window.setTimeout(() => {
      this._slideTimer = undefined;
      this._slide = '';
      this.requestUpdate();
    }, 190);
    this.requestUpdate();
    return true;
  }

  /** Direct space tabs use the same motion as swipe/carousel navigation. */
  // ---- reordering the space tabs (issue #220) ------------------------------
  //
  // Mouse only, editors only: the same tabs switch spaces in View, where touch
  // is a first-class citizen, so a gesture here would compete with that tap.
  // docs/specs/220-space-tab-reorder.md §4.1, "Touch editor: not exposed".

  private get _canReorderTabs(): boolean {
    return canStartTabDrag({
      canEdit: this._canEdit,
      kiosk: this._kiosk,
      mode: this._mode,
      pointerType: 'mouse',
      spaceCount: this._model.length,
      fixedFloor: this._hasFixedFloor,
    });
  }

  private _tabPointerDown(event: PointerEvent, id: string): void {
    if (!canStartTabDrag({
      canEdit: this._canEdit,
      kiosk: this._kiosk,
      mode: this._mode,
      pointerType: event.pointerType,
      spaceCount: this._model.length,
      fixedFloor: this._hasFixedFloor,
    })) return;
    // A mouse released past the edge of the panel fires neither pointerup nor
    // pointercancel on any tab, and the gesture would stay stuck mid-drag —
    // taking the next click with it, since _tabClick swallows clicks that
    // follow a drag (review CODE-REVIEW-220-r1, M1).
    //
    // Capture is the usual answer and this file uses it everywhere, but it is
    // not a guarantee: the browser grants it only for a live pointer, so a
    // gesture that starts any other way keeps no capture at all. The window
    // listener below is what actually closes the gesture; capture merely keeps
    // the moves flowing to the tab while the button is held.
    capturePointer(event);
    this._tabDragRelease = (release: PointerEvent) => this._tabPointerUp(release);
    window.addEventListener('pointerup', this._tabDragRelease);
    window.addEventListener('pointercancel', this._tabDragRelease);
    this._tabDrag = {
      id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      moved: false, targetId: null, placement: null,
    };
  }

  /** Resolve a drop from screen coordinates, independent of captured event.target. */
  private _tabDropTargetAt(clientX: number, clientY: number, sourceId: string): {
    targetId: string; placement: 'before' | 'after';
  } | null {
    const ids = this._model.map((space) => space.id);
    const sourceIndex = ids.indexOf(sourceId);
    if (sourceIndex < 0) return null;
    const tabs = this.renderRoot.querySelectorAll<HTMLElement>('[data-hp="space-tab"]');
    for (const tab of tabs) {
      const targetId = tab.dataset.id || '';
      if (!targetId || targetId === sourceId) continue;
      const rect = tab.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right
          || clientY < rect.top || clientY > rect.bottom) continue;
      const targetIndex = ids.indexOf(targetId);
      if (targetIndex < 0) return null;
      return { targetId, placement: targetIndex < sourceIndex ? 'before' : 'after' };
    }
    return null;
  }

  private _tabPointerMove(event: PointerEvent): void {
    const drag = this._tabDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved
        && !passedDragThreshold(event.clientX - drag.x, event.clientY - drag.y)) return;
    // Past the threshold the gesture is a drag: the click that would otherwise
    // follow is suppressed in _tabClick, and the panel shows where it lands.
    const target = this._tabDropTargetAt(event.clientX, event.clientY, drag.id);
    if (drag.moved && drag.targetId === target?.targetId
        && drag.placement === target?.placement) return;
    this._tabDrag = {
      ...drag,
      moved: true,
      targetId: target?.targetId || null,
      placement: target?.placement || null,
    };
  }

  private _tabPointerUp(event: PointerEvent): void {
    const drag = this._tabDrag;
    if (drag && drag.pointerId !== event.pointerId) return;
    const target = event.type === 'pointerup' && drag?.moved
      ? this._tabDropTargetAt(event.clientX, event.clientY, drag.id)
      : null;
    if (event.type === 'pointerup' && drag?.moved) this._suppressNextTabClick();
    this._endTabDrag();
    if (!drag?.moved || !target) return;
    this._commitTabOrder(drag.id, target.targetId);
  }

  /** Drop the gesture and its window listeners, wherever the release happened. */
  private _endTabDrag(): void {
    this._tabDrag = null;
    if (!this._tabDragRelease) return;
    window.removeEventListener('pointerup', this._tabDragRelease);
    window.removeEventListener('pointercancel', this._tabDragRelease);
    this._tabDragRelease = null;
  }

  /** A click that followed a real drag must not also switch the space. */
  private _tabClick(id: string): void {
    if (this._tabSuppressClick) {
      this._tabSuppressClick = false;
      clearTimeout(this._tabSuppressClickTimer);
      this._tabSuppressClickTimer = undefined;
      return;
    }
    this._pickSpace(id);
  }

  /** Browser click follows pointerup in the same task; clear if none arrived. */
  private _suppressNextTabClick(): void {
    this._tabSuppressClick = true;
    clearTimeout(this._tabSuppressClickTimer);
    this._tabSuppressClickTimer = window.setTimeout(() => {
      this._tabSuppressClick = false;
      this._tabSuppressClickTimer = undefined;
    }, 0);
  }

  /**
   * Write the new order — and, in the same write, the placement that used to
   * depend on it.
   *
   * A marker with neither an explicit space nor an area that names one renders
   * in whatever space sits first. Reordering would silently hand it to another
   * space, so the answer it has right now is written down first. This is the
   * whole reason the two changes may not be split into two saves.
   */
  private _commitTabOrder(movedId: string, targetId: string): void {
    const cfg = this._serverCfg;
    if (!cfg || !this._canReorderTabs) return;
    const ids = this._model.map((space) => space.id);
    const order = reorderSpaceIds(ids, movedId, targetId);
    if (order === ids) return;
    // The area in force, not merely the one stored on the marker: a marker that
    // binds an HA device inherits its area from the registry, and such a marker
    // never depended on the order (review CODE-REVIEW-220-r1, H1).
    const areaById = new Map(
      this._devices.map((device) => [String(device.id), String(device.area || '')]),
    );
    const pinned = markersNeedingPlacement(
      cfg.markers || [],
      Object.fromEntries(
        Object.entries(this._areaToSpace).map(([area, value]) => [area, value.space]),
      ),
      ids[0] || '',
      (markerId) => areaById.get(markerId) || '',
    );
    if (pinned.length) {
      const byId = new Map(pinned.map((entry) => [entry.id, entry.space]));
      for (const marker of cfg.markers || []) {
        const space = byId.get(String((marker as any).id));
        if (space) (marker as any).space = space;
      }
    }
    cfg.spaces = applySpaceOrder(cfg.spaces || [], order);
    this._saveConfig();
    if (!this._tabOrderWarned) {
      this._tabOrderWarned = true;
      this._showToast(this._t('toast.space_order_changed'));
    }
  }

  private _pickSpace(id: string): void {
    this._endTabDrag();
    if (id === this._space) return;
    const ids = this._model.map((sp) => sp.id);
    const from = ids.indexOf(this._space);
    const to = ids.indexOf(id);
    this._navApplied = true;
    this._showFar = false; // the hint is per space (docs/CANVAS.md §4.1)
    this._frame = null;
    if (this._slideTo(id, from >= 0 && to < from ? 'right' : 'left')) this._saveNav();
  }

  private _cycleTick(): void {
    if (this._hasFixedFloor || !this._kiosk || !(Number(this._config?.cycle) > 0)) return;
    if (Date.now() >= this._cyclePausedUntil && this._model.length > 1 && this._zoom <= 1.001) {
      const ids = this._model.map((m) => m.id);
      const i = ids.indexOf(this._space);
      this._slideTo(ids[(i + 1) % ids.length], 'left');
      this._showKioskDots();
    }
  }

  private _syncCycleTimer(): void {
    clearInterval(this._cycleTimer);
    this._cycleTimer = undefined;
    if (!this.isConnected || this._hasFixedFloor
        || !this._config?.kiosk || !(Number(this._config.cycle) > 0)) return;
    this._cycleTimer = window.setInterval(
      () => this._cycleTick(), Number(this._config.cycle) * 1000,
    );
  }

  /** Any edit mode is active (plan / devices / decor). */
  private get _editing(): boolean {
    return this._mode === 'plan' || this._mode === 'devices' || this._mode === 'decor';
  }

  private get _markup(): boolean {
    return this._mode === 'plan';
  }
  private _tool: MarkupTool = 'draw';
  /** UX-04: one named, 50-step command history for every plan-geometry tool. */
  private _geometryHistory = new CommandStack<SpaceGeometryState>(50);
  /** #74: independent session-local history for manual device placements. */
  private _devicePositionHistory = new CommandStack<DevicePositionState>(50);
  private _devicePositionBusy = false;
  /** Wall-thickness tool dialog (docs/WALL-THICKNESS.md). */
  private _wallDialog: {
    a: number[]; b: number[];
    value: string; roomId: string | null;
    // The Thickness tool serves independent masonry too. `room` keeps
    // the historical shape (walls records + «apply to room»); the other two
    // write partition.cm / draft.segments[i].cm. The switch in
    // `_wallThickApply` applies the same `0..100` contract to every source.
    source: WallThickSource;
    sx: number; sy: number;
  } | null = null;
  /**
   * Draw-toolbar thickness field (session). `null` until Plan is entered —
   * then primed to DRAW_WALL_DEFAULT_CM. Empty string = no thickness on commit.
   */
  private _drawWallField: string | null = null;
  /** The saved draft currently continued by the Draw tool. */
  private _activeDraftId: string | null = null;
  private _resumeDraftBySpace: Record<string, string> = {};
  /** One-click/two-click physical-object selection in the Plan editor. */
  private _physicalSel: {
    kind: 'partition' | 'column' | 'draft'; id: string; segment?: number;
  } | null = null;
  private _physicalDialog: {
    kind: 'partition' | 'column' | 'draft'; id: string; cm: string;
    segment?: number; shape?: 'square' | 'circle'; angle?: string; length?: string;
  } | null = null;
  private _partitionDeleteDialog: { id: string; openings: OpeningCfg[] } | null = null;
  private _roomDeleteDialog: { roomId: string; name: string } | null = null;
  /** Drag preview is render-only; config is committed once on pointerup. */
  private _physicalDrag: {
    pid: number; kind: 'partition' | 'column'; id: string;
    start: number[]; startClient: number[]; before: SpaceGeometryState | null; moved: boolean;
    base: PartitionCfg | WallColumnCfg; delta: number[];
  } | null = null;
  private _physicalRotate: {
    pid: number; id: string; center: number[]; startAngle: number;
    baseAngle: number; angle: number; before: SpaceGeometryState | null; moved: boolean;
  } | null = null;
  private _physicalLastTap: {
    kind: 'partition' | 'column' | 'draft'; id: string; segment?: number; at: number;
  } | null = null;
  private _physicalPickCycle: {
    signature: string; index: number; x: number; y: number; at: number;
  } | null = null;
  private _wallUnionCacheValue: {
    key: string;
    value: ReturnType<typeof wallBodiesUnionPath>;
  } | null = null;
  /** A floor switch is presentation-only: retain the bounded structural union
   * for recently shown floors instead of rebuilding it on every tab click. */
  private _wallUnionPool = new Map<string, {
    key: string;
    value: ReturnType<typeof wallBodiesUnionPath>;
  }>();
  /** Keep the historical cache property observable by performance/smoke
   * contracts. Explicit test/product invalidation also clears the pool. */
  private get _wallUnionCache(): {
    key: string;
    value: ReturnType<typeof wallBodiesUnionPath>;
  } | null {
    return this._wallUnionCacheValue;
  }
  private set _wallUnionCache(value: {
    key: string;
    value: ReturnType<typeof wallBodiesUnionPath>;
  } | null) {
    this._wallUnionCacheValue = value;
    if (value === null) this._wallUnionPool.clear();
  }
  private _isoGeometryCache = new Map<string, {
    geometry: IsoWallGeometry;
    floor: IsoFloorGeometry;
    openings: readonly IsoOpeningBasis[];
    frame: Rect;
  }>();
  private _isoFallback = new Set<string>();
  private _openingTunnelCache: {
    key: string;
    value: Array<OpeningTunnelGeometry | null>;
  } | null = null;
  /** A few consumers use intentionally different open-cut projections in one
   * frame. Keep a tiny keyed pool so hit-testing cannot evict placement data
   * (and vice versa) on every pointer move. */
  private _openingWallIndexCache = new Map<string, OpeningWallIndex>();
  private _openingPlacementIntervalsCache: { key: string; value: WallInterval[] } | null = null;
  private _openingDimensionContextCache: {
    key: string;
    value: OpeningDimensionContext;
  } | null = null;
  private _planSnapGeometryCache: { key: string; value: PlanSnapGeometry } | null = null;
  private _planStructuralGeometryCache: { key: string; value: PlanSnapGeometry } | null = null;
  private _hiddenWallDiagnosticCache: {
    key: string; value: HiddenWallDiagnosticGeometry;
  } | null = null;
  private _physicalBodiesCache: {
    key: string; drafts: number[][][]; partitions: number[][][];
    columns: number[][][]; patches: number[][][]; all: number[][][];
  } | null = null;
  /** Light cuts are type/floor-specific and differ from drawn masonry, but HA
   * state ticks must not rebuild independent-wall topology. */
  private _lightPhysicalBodiesCache: { key: string; all: number[][][] } | null = null;
  private _cleanFloorCache = new Map<string, {
    floor: number[][]; geom: any; path: string; area: number;
  }>();
  private _innerContourCache = new Map<string, number[][] | null>();
  private readonly _glowRuntimeState: GlowRuntimeState = createGlowRuntimeState();
  private readonly _glowRuntimeHost: GlowRuntimeHost = {
    window: () => this.ownerDocument.defaultView || window,
    isConnected: () => this.isConnected,
    requestUpdate: () => this.requestUpdate(),
    reducedMotion: () => this._reducedMotion,
  };
  /** Compatibility aliases keep the performance/smoke diagnostic contract. */
  private get _glowClipCache() { return this._glowRuntimeState.clipCache; }
  private get _glowGeometryWarnings() { return this._glowRuntimeState.geometryWarnings; }
  private _lightBarrierCache: {
    key: string;
    value: {
      occluders: LightSegment[]; floor: number[][][]; fingerprint: string;
      masonryGeometry: any; opaqueBodies: number[][][];
    };
  } | null = null;
  /** Space switching is presentation-only. Keep recently resolved light
   * topology just like wall topology, rather than rebuilding both per tab. */
  private _lightBarrierPool = new Map<string, NonNullable<typeof this._lightBarrierCache>>();
  /** Freeze the SVG blur while a pinch/pan emits animation frames, then adopt
   *  the final screen-space value after the gesture. */
  private get _glowFeatherUnits() { return this._glowRuntimeState.featherUnits; }
  private set _glowFeatherUnits(value: number | null) { this._glowRuntimeState.featherUnits = value; }
  /** Active pools survive an off transition until their 500 ms fade completes. */
  private get _glowRenderedSources() { return this._glowRuntimeState.renderedSources; }
  private get _glowLastAppearance() { return this._glowRuntimeState.lastAppearance; }
  private get _glowFeatherSuspendUntil() { return this._glowRuntimeState.featherSuspendUntil; }
  private set _glowFeatherSuspendUntil(value: number) { this._glowRuntimeState.featherSuspendUntil = value; }
  private get _glowFeatherResumeTimer() { return this._glowRuntimeState.featherResumeTimer; }
  private set _glowFeatherResumeTimer(value: number) { this._glowRuntimeState.featherResumeTimer = value; }
  private get _glowSourceSeq() { return this._glowRuntimeState.sourceSeq; }
  private set _glowSourceSeq(value: number) { this._glowRuntimeState.sourceSeq = value; }
  /** Pending/false uses the exact historical normal-layer fallback. */
  private _glowScreenBlend = false;
  private _duplicateColumnId: string | null = null;
  private _duplicateColumnTimer = 0;
  // Room Resize orchestration is isolated from this Lit/config composition shell (#264).
  private declare _resize: import('./resize-controller').ResizeController<
    ResizePreview, ResizeLiveLabel[], SpaceGeometryState, ResizeWallUnion, ResizeWallArtifact
  >;
  /** #329 AC7a: the limit the LAST projection broke, or null if it broke none. */
  private _rszLimitViolation: JunctionLimitViolation | null = null;
  private _path: number[][] = []; // current outline (render units, vertices snapped to the grid)
  private _cursorPt: number[] | null = null;
  private _planSnapHover: {
    contextKey: string; candidate: PlanSnapCandidate | null; conflicts: PlanSnapEndpoint[];
  } | null = null;
  private _mergeSel: string | null = null;
  /** Session-only explicit type/width chosen in the Opening sub-panel. */
  private _openingPreset: OpeningPlacementPreset | null = null;
  /** Existing orphan whose next valid placement replaces only its host. */
  private _openingRebindId: string | null = null;
  private _openingPresetRevision = 0;
  /** Last painted hover candidate. Click may reuse it only for the same input epoch. */
  private _openingHoverCandidate: OpeningPlacementCandidate | null = null;
  /** Last pointer target rejected only because its independent-wall jamb was too small. */
  private _openingJambBlockCm: number | null = null;
  private _openingDialog: {
    id?: string;                 // editing an existing opening
    type: 'door' | 'window' | 'gate' | 'passage';
    lengthCm: number;
    /** Avoid opting a rounded legacy length into strict geometry on a binding-only edit. */
    lengthTouched?: boolean;
    contact: string;
    lock: string;
    contactOpen?: boolean;
    contactFilter?: string;
    lockOpen?: boolean;
    lockFilter?: string;
    invert: boolean;
    flipH: boolean;
    flipV: boolean;
    host?: PartitionOpeningHost;
    x: number; y: number; angle: number; // render units (from the wall snap)
  } | null = null;
  private _openingInfo: OpeningCfg | null = null;
  private _opDrag: {
    id: string; moved: boolean; sx: number; sy: number; dirty: boolean;
    before: SpaceGeometryState | null;
  } | null = null;
  // live ruler badges + the "centered on the wall" tick while an opening is dragged
  private _opMeasure: OpMeasure | null = null;
  private _mergeDialog: { aId: string; bId: string; poly: number[][]; pick: 'a' | 'b' } | null = null;
  private _splitSel: { roomId: string; pts: number[][] } | null = null; // room being cut + the cut path so far
  // a split is applied only when the new room's dialog is confirmed — cancel leaves the room intact
  private _pendingSplit: { roomId: string; mainPoly: number[][]; newPoly: number[][] } | null = null;
  /** Pending #173 face decisions. Config remains untouched until the last one. */
  private _wallFaceBatch: WallFaceBatch | null = null;
  private _wallRepairDiagnostic: WallFaceRepairProposal | null = null;
  /** Four exact structural entries; never keyed by HA state, hover or theme. */
  private _wallFaceGraphCache: Array<{ key: string; value: WallFaceGraph }> = [];
  private _areaSel = '';
  private _nameSel = '';
  private _roomDialog = false;
  private _roomEditId: string | null = null; // gear on a room card (edit mode)
  private _roomFill: '' | 'none' | 'lqi' | 'light' | 'temp' | 'custom' = ''; // '' = inherit
  /** null = inherit the space custom color; value = explicit room override. */
  private _roomCustomFill: FillColorEntry | null = null;
  private _roomTempSrc = ''; // '' = average
  private _roomHumSrc = '';
  private _roomSrcOpen: 'temp' | 'hum' | null = null;
  private _roomSrcFilter = '';
  private _roomNameScale = 1;
  private _roomLabelScale = 1;
  // plan zoom/pan (zoom is saved per space, locally)
  private _zoom = 1;
  private _view: { x: number; y: number; w: number; h: number } | null = null; // current SVG viewBox (vb coordinates)
  private _zoomBySpace: Record<string, number> = {};
  /**
   * View-mode viewport remembered on entering an editor. Editor zoom is a
   * working tool (zoom in to grab a vertex), not the user's intention for
   * viewing — leaving any editor brings the view-mode viewport back.
   */
  private _viewModeSnap: { space: string; zoom: number; cx?: number; cy?: number } | null = null;
  /** Session-only View intent. It is deliberately absent from warm/LS/config state. */
  private _roomFocus: { spaceId: string; roomId: string } | null = null;
  /** Pointer owner captured from the actually painted event path. */
  private _roomPointer: RoomFitGestureCandidate | null = null; private readonly _doubleFit = new DoubleFitGestureRecognizer();
  private _pointers = new Map<number, { x: number; y: number }>();
  private _panStart: { sx: number; sy: number; vx: number; vy: number } | null = null;
  /**
   * What the current one-finger drag turned out to be, decided ONCE on the
   * first real movement and held until the finger lifts (see
   * `_stagePointerMove`). Only the kiosk has two candidates — a horizontal
   * drag there is the floor swipe; everywhere else a drag always pans.
   */
  private _panLock: 'pan' | 'swipe' | null = null;
  private _pinchStart: { dist: number; zoom: number } | null = null;
  private _suppressClick = false;
  private _viewportGestureDirty = false;
  /**
   * Pointer events from an interactive child may stop before the stage sees
   * them. Track touch contacts on the card in capture phase, so the second
   * finger always turns the whole sequence into navigation and can never leave
   * a synthetic tap on a device, room link, opening badge or editor control.
   */
  private _touchContacts = new Map<number, { x: number; y: number; inStage: boolean }>();
  private _touchSequenceMultitouch = false;
  private _touchClickBlockUntil = 0;
  /** Route occupied by this live card. Persistent navigation remembers only
   *  the space; leaving this HA route ends the transient editor session. */
  private _connectedPath = '';
  private _routeDepartureHandled = false;
  private readonly _onLocationChanged = (): void => {
    if (this._connectedPath && location.pathname !== this._connectedPath) {
      this._leaveCardRoute();
    } else if (location.pathname === this._connectedPath) {
      // Some HA routers keep the old view connected but hidden. Returning to
      // it re-arms the guard so a later departure ends the next edit session.
      this._routeDepartureHandled = false;
    }
  };
  private readonly _touchGestureGuard = {
    capture: true,
    handleEvent: (ev: Event): void => this._guardTouchGesture(ev),
  };
  private _roViewport?: ResizeObserver;
  private _roHdr?: ResizeObserver;
  private _onWinResize?: () => void;
  private _hdrH = 118; // measured px above the stage (see the observer in updated())
  /** HP-1552: first-open boot veil. In normal (non-kiosk) mode the stage is
   *  calc(100dvh - _hdrH), and _hdrH is measured from HA's chrome — which
   *  finishes loading AFTER the card's first paint, so every late panel
   *  nudged the height and the plan visibly jumped. The plan hides behind a
   *  pulsing-house veil for a full protective window (AUD-1552-02: the old
   *  early reveal on "two equal reads" let a panel landing at 400-600 ms
   *  jump on a VISIBLE plan); the whole lifecycle restarts from
   *  connectedCallback (AUD-1552-01: timers die on disconnect — a Lovelace
   *  DOM rebuild mid-boot used to leave the plan hidden forever).
   *  First open only; kiosk is 100dvh and never jumps. */
  private _booting = true;
  private _bootFading = false; // veil kept one beat for the opacity-out
  private _bootSettling = false;
  private _bootSettleRaf = 0;
  private _bootTimer?: number;
  private _bootLastH = -1;
  private _bootStart = 0;
  private _bootLastChange = 0; // when the stage height last moved (quiescence clock)
  private _bootSoft = false; // post-reveal grace: late chrome shifts glide, not jump
  private _bootSoftTimer?: number;
  /** The accidental-tap guard: pending confirmation for a toggle/run tap. */
  private _tapConfirm: {
    kind: 'toggle'; text: string; lines: string[];
    initialIntent: ResolvedToggleIntent; deviceId: string; exec: () => void;
  } | { kind: 'run'; text: string; exec: () => void } | null = null;
  /** One eager confirmation owner shared by View, onboarding and lazy editors. */
  private _dangerConfirm: HpConfirmState | null = null;
  /** Synchronize host/runtime language state and return the current branch. */
  private _syncDangerConfirmLocaleGate(): LanguageRenderGate {
    if (!this._config || !this.hass) return 'ready';
    return languageRenderGate(
      this, LANGUAGE_RUNTIME, langOf(this.hass, this._config.language),
    );
  }
  private readonly _dangerConfirmController = new HpConfirmController((state) => {
    this._dangerConfirm = state;
  });
  /**
   * The only post-initialisation branch whose body is literally `nothing`.
   * Onboarding and fixed-floor errors paint a card and can host hp-confirm;
   * a lost active space cannot.
   */
  private _dangerConfirmMissingSpace(): boolean {
    const model = this._model;
    if (!model.length) return false;
    const fixed = this._fixedFloorState(model);
    if (fixed.kind === 'pending' || fixed.kind === 'invalid') return false;
    return !this._spaceModel();
  }
  private _confirmDanger = (request: HpConfirmRequest): Promise<boolean> => {
    // #402/#417: a card that draws nothing cannot ask. Refusing outright is
    // the honest answer — the alternative is a promise nobody will ever
    // resolve. Keep the guards aligned with `_renderBody`'s two unrenderable
    // branches instead of registering a controller request with no DOM owner.
    if (!this._config || !this.hass) return Promise.resolve(false);
    if (this._syncDangerConfirmLocaleGate() === 'warm') return Promise.resolve(false);
    if (this._dangerConfirmMissingSpace()) return Promise.resolve(false);
    return this._dangerConfirmController.confirm(request);
  };
  private _cancelDangerConfirm = (): void => {
    this._dangerConfirmController.cancel();
  };
  private _onDangerConfirmDecision = (event: CustomEvent<HpConfirmDecision>): void => {
    this._dangerConfirmController.resolve(event.detail.token, event.detail.accepted);
  };
  private _onboardingShown = false; // the auto space dialog is shown once per session

  private _rulesDialog: { rules: IconRule[]; test: string; busy: boolean } | null = null;
  /** Optimization preview plus the exact pair, so commit cannot differ from it. */
  /** #295: diagnostics text shown inline when the clipboard is unavailable. */
  private _preflightClipboardFallback: string | null = null;
  /** #295: integration version from houseplan/config/get; null on old backends. */
  private _haIntegrationVersion: string | null = null;
  /** #423: support protocol capability from config/get; never persisted. */
  private _haSupportApi: number | null = null;
  /** #51: custom-image protocol capability from config/get; fail closed. */
  private _haDecorAssetsApi: number | null = null;
  private _decorAssetSyncToken = 0;
  private _alignDialog: {
    report: OptimizeReport; config: any; layout: Record<string, any>;
    preflight: OptimizeGeometryPreflightResult | null;
    /** the promised maximum, in centimetres, ALREADY rounded up (AUD-158B1-01) */
    cm: number;
    /** the space that maximum belongs to, named only when there are several */
    where: string;
    changed: boolean;
    busy: boolean;
    /** False by default; true only after the secondary preview action. */
    removeLiveMissingPositions: boolean;
  } | null = null;

  private _settingsDialog: {
    colors: FillColors; glowRadius: number; bgColor: string | null;
    /** sun on the plan (docs/SUN.md) */
    northDeg: number | null; bgMode: 'static' | 'daynight'; sunRays: boolean;
    showRoomTooltip: boolean; zigbeeTopology: import('./zigbee-topology-settings').ZigbeeTopologySettings;
    busy: boolean;
  } | null = null;
  private _supportDialog: SupportDialogState | null = null;
  private _backupExportDialog: {
    kind: 'full' | 'space'; planOnly: boolean; busy: boolean; error: string;
  } | null = null;
  private _backupImportDialog: {
    filename: string; size: number; token: string; preview: any;
    expectedConfigRev: number; expectedLayoutRev: number;
    duplicatePolicy: 'skip' | 'virtual'; confirmMissing: boolean;
    busy: boolean; error: string;
  } | null = null;
  /** Wedge memo: recomputed only when (azimuth, elevation, north, cfg rev) change (docs/SUN.md). */
  private _sunRaysCache: { key: string; rays: SunRay[]; rims: number[][][][] } | null = null;
  /** Browser-local fallback lifecycle; real sun updates arrive through hass. */
  private _dayCycleTimer = 0;
  private _dayCycleClockKey = '';
  private _compassDrag = false;
  private _importDialog: { floors: (FloorInfo & { checked: boolean })[] } | null = null;
  private _importQueue: string[] = []; // floor titles still to create
  private _importTotal = 0;
  private _rulesCompiledSrc = '';
  private _rulesCompiled: CompiledIconRule[] | undefined;

  private _infoCard: DevItem | null = null;
  /** Native HA more-info last opened by this card, for disabled mid-dialog cleanup. */
  private _nativeMoreInfoEntity: string | null = null;
  private _deviceInbox: DeviceInboxDialogState | null = null;
  private _deviceInboxReturn: DeviceInboxDialogState | null = null;
  private _deviceInboxMemo: { key: string; rows: DeviceInboxRow[] } | null = null;
  private _markerDialog: {
    devId?: string;      // the icon being edited (if any)
    /**
     * Folder attachments are uploaded into while this dialog is open. For a NEW
     * icon there is no marker id yet; every one of them used to upload into a
     * shared `files/new/`, so two markers attaching `manual.pdf` ended up
     * pointing at the same bytes (HP-1454-02). A per-dialog id keeps them
     * apart, and the files are moved to the real marker id once the config
     * write is accepted — the same copy→save→cleanup order as a rebind.
     */
    uploadId?: string;
    name: string;
    binding: string;     // 'device:<id>' | 'entity:<eid>' | 'virtual' | '' (not chosen yet)
    bindingMode: 'virtual' | 'ha';
    bindingOpen: boolean;   // the HA-list dropdown is expanded
    showEntities: boolean;  // list entities of devices too
    bindingFilter: string;
    icon: string;        // '' = auto
    autoIcon: string;    // the icon the rules would give — picker placeholder
    display: DeviceDisplayMode;
    rippleColor: string; // '' = accent
    rippleSize: number;  // in icon diameters; package default 1.5
    size: number;        // icon size multiplier
    angle: number;       // icon rotation, degrees
    /** UI projection. A legacy persisted `cover` is shown as `toggle`. */
    tapAction: string;
    tapActionTouched: boolean;
    originalHasTapAction: boolean;
    originalTapAction: string | null | undefined;
    /** Snapshot announced only after a user edit; live HA ticks do not rewrite it. */
    tapHintAnnouncement: string;
    toggleEntity: string;
    toggleEntityTouched: boolean;
    originalHasToggleEntity: boolean;
    originalToggleEntity: string | null | undefined;
    tapTarget: string;    // 'run': automation./script./scene. entity id
    tapConfirm: boolean;  // ask before toggle/run
    runFilter: string;
    controls: string[];  // entities this icon toggles as a group
    controlsFilter: string;
    glowRadius: string;  // per-device glow radius in display units; '' = global default
    lightRole: 'auto' | 'always' | 'never';
    lightRoleTouched: boolean;
    originalHasIsLight: boolean;
    originalIsLight: boolean | null | undefined;
    lightEntity: string;
    lightEntityTouched: boolean;
    originalHasLightEntity: boolean;
    originalLightEntity: string | null | undefined;
    glowMode: 'auto' | 'color' | 'fixed';
    glowColor: string;
    glowBrightness: number; // 1..100 for the fixed mode
    glowColorDrafted: boolean;
    glowBrightnessDrafted: boolean;
    glowTouched: boolean;
    originalHasGlowColor: boolean;
    originalGlowColor: { c: string; bri?: number | null } | null | undefined;
    valueBadgeEnabled: boolean;
    valueBadgeSource: ValueBadgeSource | null;
    valueBadgePosition: ValueBadgePosition;
    valueBadgeTouched: boolean;
    originalHasValueBadge: boolean;
    originalValueBadge: MarkerValueBadge | null | undefined;
    valueSource: ValueBadgeSource | null;
    valueSourceTouched: boolean;
    originalHasValueSource: boolean;
    originalValueSource: ValueBadgeSource | null | undefined;
    useClimateTemp: boolean; // badge + room-average vote from climate current_temperature
    model: string;
    link: string;
    description: string;
    pdfs: PdfRef[];
    room: string;
    roomTouched: boolean;
    hideFromPlan: boolean;        // 'space#area' for a virtual one
    busy: boolean;
  } | null = null;
  private _spaceDialog: SpaceDialogState | null = null;
  private _keyHandler = (e: KeyboardEvent) => this._onKey(e);
  /** DEV-B703-03 warm re-mount: the dead instance's viewport, and the two
   *  flags that keep the restore from being undone (the server load's centred
   *  _restoreZoom) or applied twice (the dialog revival). */
  private _warmVp: WarmViewport | null = null;
  private _warmVpArmed = false;
  private _warmLongReturn = false;
  private _warmRevivePending = false;
  private _warmReviveTimer?: number;
  /** AUD-159B1-01: this instance's identity in the memo — its generation, the
   *  key it settled under and the slot (card placement) it owns. */
  private _warmGen = ++warmGen;
  private _warmKey: string | null = null;
  private _warmSlot: WarmEntry | null = null;
  private _hashApplied = false;
  private _navApplied = false; // the saved space was restored (or the user navigated)
  private _labs: LabsSnapshot = { alpha: false, active: Object.freeze([]), space: '' };
  private _labsUnsub?: () => void;
  private _viewPreference: Record<string, 'flat' | 'iso'> = {};
  private _renderProjection: 'flat' | 'iso' = 'flat';
  // ---- kiosk (wall device) mode ----
  private _kioskScale: { icon: number; font: number } = { icon: 1, font: 1 };
  private _kioskDialog = false;
  /**
   * Previous entity states + the short event/terminal-transition window for
   * every marker. The map lives outside Lit state: hass ticks update it, one
   * timer repaints when the 3.3 s window closes, and the generation bit forces
   * a CSS event animation to restart on a rapid retrigger.
   */
  private _activityRt = new Map<string, FiniteActivityRuntime>();
  /** live-vacuum runtime per marker: RAW robot coords (matrix applied at render) */
  private _vacRt = new Map<string, { trail: VacPt[]; lastKey: string; lastTs: number;
    moving: boolean; jump: boolean; endedTs: number; lastPos: VacPt | null }>();
  /** view signature of the previous vacuum render: a changed view (zoom, pan,
      space switch) or a tab return must TELEPORT the puck — animating left/top
      through a viewport change reads as «едет через весь план» (owner). */
  private _vacViewKey = '';
  private _vacLastView: { x: number; y: number; w: number; h: number } | null = null;
  private _vacRaf = 0;
  /** server-recorded runs per marker: {current, previous} in raw robot coords */
  private _vacSrvTrails: Record<string, any> = {};
  private _unsubTrail?: () => void;
  private _vacJumpOnce = false;
  private _continuity = this._newContinuityController();
  private _continuityHistory: import('./visual-continuity').ContinuityTraceEvent[] = [];
  private _continuityUnsub?: () => void;
  private _languageFailureUnsub?: () => void;
  private _continuityEpoch = 0;
  private _continuityDataReady = true;
  private _continuityPaintToken = -1;
  private _continuityDisposed = false;
  private _renderSnapshotAt = Date.now();
  private _hassSequence = 0;
  private _visibleDeviceSnapshot: RenderDeviceSnapshot | null = null;
  private _candidateDeviceSnapshot: RenderDeviceSnapshot | null = null;
  private _stagedDeviceSnapshotToken = -1;
  private _capturedSnapshotSequence = -1;
  private _capturedSnapshotDevices: DevItem[] | null = null;
  private _capturedSnapshotLayout: Record<string, { x: number; y: number; s?: string; k?: number }> | null = null;
  private _capturedSnapshotActivity = '';
  private _capturedSnapshotConfigEpoch = -1;
  private _capturedSnapshotVirtual = '';
  private _lastValidStageSize: [number, number] | null = null;
  private _pendingRefitSize: [number, number] | null = null;
  private _refitRaf = 0;

  private _newContinuityController(): VisualContinuityController {
    return new VisualContinuityController(() => {
      this._resumeSettling = this._continuity.state !== 'steady';
      this._continuityEpoch++;
      if (this.isConnected) this.requestUpdate();
    });
  }

  private _pageVisibility = (signal: PageVisibilitySignal): void => {
    this._continuity.visibility(signal);
    this._dayCycleVisibility(signal);
    if (signal.kind === 'hidden') {
      this._clearRoomFocus(true);
      this._clearTransientHover(true);
      this._cancelDevicePressFeedback();
      this._cancelCameraTransition(true);
      if (this._modeTransitionPreparing) {
        // There is no measured controller endpoint to commit yet. Keep the
        // already queued measurement but force its synchronous atomic path;
        // cancelling here would expose target chrome with the old camera.
        this._modeTransitionForceAtomic = true;
      } else {
        this._cancelModeTransition(true);
      }
      return;
    }
    this._vacJumpOnce = true;
    if (!signal.long) {
      const now = Date.now();
      let expired = false;
      for (const runtime of this._activityRt.values()) {
        if (!runtime.flashKind || (runtime.expiresAt || runtime.flashTs + ACTIVITY_WINDOW_MS) > now) continue;
        runtime.flashTs = 0;
        runtime.flashKind = null;
        runtime.expiresAt = 0;
        expired = true;
      }
      if (expired) this.requestUpdate();
      return; // preserve hover and the completed visual frame
    }
    // A long sleep may have frozen activity clocks. Recompute them as
    // one candidate without clearing the currently visible hover or frame,
    // and revalidate config+layout as one structural pair.
    if (Date.now() - this._renderSnapshotAt > 1000) this._continuity.note('device-snapshot-stale');
    this._continuityDataReady = false;
    this._continuityPaintToken = -1;
    this._resumeSettling = true;
    if (!this._loading) void this._loadFromServer();
    else this.requestUpdate();
  };
  private _resumeSettling = false;
  private _viewportInvalidAt = 0;
  private _vacFit: VacuumFit | null = null;
  /** Marker whose lazy «All cameras» candidate section is expanded. */
  private _vacAllCamerasFor: string | null = null;
  /** One snapshot per currently open global-camera section; rebuilt on reopen. */
  private _vacAllCameraCache: { devId: string; candidates: VacSourceCandidate[] } | null = null;
  /** Proposed high-residual auto-calibration. Config remains untouched until Apply. */
  private _vacCalConfirm: CalibrationProposal | null = null;
  private _kioskDots = false;
  private _kioskDotsTimer?: number;
  private _kioskHoldTimer?: number;
  private _cycleTimer?: number;
  private _cyclePausedUntil = 0;
  private _swipeStart: { x: number; y: number; id: number } | null = null;

  /** Live tab reorder: which tab is held, where it started, where it would land. */
  private _tabDrag: {
    id: string; pointerId: number; x: number; y: number; moved: boolean;
    targetId: string | null; placement: 'before' | 'after' | null;
  } | null = null;

  /** Window-level release handler while a tab is held; see _tabPointerDown. */
  private _tabDragRelease: ((event: PointerEvent) => void) | null = null;
  private _tabSuppressClick = false;
  private _tabSuppressClickTimer?: number;

  /** The positional-`floor` warning is worth saying once, not on every drop. */
  private _tabOrderWarned = false;
  private get _labsIso(): boolean {
    return this._labs.active.includes('iso');
  }

  private get _desiredProjection(): 'flat' | 'iso' {
    return this._mode === 'view' && this._labsIso && this._viewPreference[this._space] === 'iso'
      ? 'iso' : 'flat';
  }

  private _saveViewPreference(): void {
    try { localStorage.setItem(LS_VIEW, JSON.stringify(this._viewPreference)); } catch { /* private mode */ }
  }

  private _logicalViewCenter(projection: 'flat' | 'iso'): { x: number; y: number } | null {
    const view = this._view;
    if (!view) return null;
    const center: ScenePoint = [view.x + view.w / 2, view.y + view.h / 2];
    const point = projection === 'iso' ? unprojectFloorPoint(center) : center;
    return { x: point[0], y: point[1] };
  }

  private _convertProjectionView(from: 'flat' | 'iso', to: 'flat' | 'iso'): void {
    if (from === to) return;
    this._clearRoomFocus(true);
    const logical = this._logicalViewCenter(from);
    this._view = null;
    const target = logical
      ? to === 'iso' ? projectPlanPoint([logical.x, logical.y], 0) : [logical.x, logical.y] as ScenePoint
      : null;
    this._applyView(this._zoom, target?.[0], target?.[1]);
    this._warmPatch({ vp: this._warmViewportState() });
    this.requestUpdate();
  }

  private _setProjection(projection: 'flat' | 'iso'): void {
    if (!this._labsIso || this._mode !== 'view') return;
    const from = this._effectiveProjection();
    this._viewPreference = { ...this._viewPreference, [this._space]: projection };
    if (projection === 'iso') {
      const retry = this._isoSceneKey();
      if (retry) this._isoFallback.delete(retry);
    }
    this._saveViewPreference();
    const to = this._effectiveProjection();
    this._convertProjectionView(from, to);
  }

  private _onLabsSnapshot = (next: LabsSnapshot): void => {
    const from = this._effectiveProjection();
    this._labs = next;
    const to = this._effectiveProjection();
    this._convertProjectionView(from, to);
    this.requestUpdate();
  };

  /** Deep-link: read `#space=<id>` from the URL (used by embedded houseplan-space-card). */
  private _hashSpace(): string {
    return hashSpace(window.location.hash || '');
  }
  private _onHashChange = (): void => {
    if (this._hasFixedFloor) return;
    const id = this._hashSpace();
    if (id && this._model.find((sp) => sp.id === id) && id !== this._space) {
      if (this._wallFaceBatch) this._roomDialogCancel();
      if (this._mode === 'plan' && this._tool === 'draw' && !this._finishWallChain()) return;
      if (this._activeDraftId) this._resumeDraftBySpace[this._space] = this._activeDraftId;
      this._commitSpace(id);
      this._selId = null;
      this._path = [];
      this._clearPlanSnapHover();
      this._clearOpeningPlacement(true);
      this._tool = 'draw';
      this._activeDraftId = null;
      this._draftSegmentCms = [];
      this._closingWallCm = null;
      if (this._mode === 'plan' && this._tool === 'draw') this._resumeLastDraft();
      this._restoreZoom();
      this.requestUpdate();
    }
  };

  private _drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  private _deviceDrag: DeviceDragState | null = null;
  private _rlResize: { id: string; space: string; k0: number; cx: number; cy: number; d0: number } | null = null;
  private _holdTimer?: number;
  private _holdFired = false;

  static properties = {
    _tabDrag: { state: true },
    _hdrH: { state: true },
    _booting: { state: true },
    _bootFading: { state: true },
    _bootSoft: { state: true },
    _continuityEpoch: { state: true },
    _editorRuntimeLoadingVisible: { state: true },
    _backdropGuard: { state: true },
    _tapConfirm: { state: true },
    _dangerConfirm: { state: true },
    hass: { attribute: false },
    _config: { state: true },
    _space: { state: true },
    _layout: { state: true },
    _devices: { state: true },
    _selId: { state: true },
    _toast: { state: true },
    _serverCfg: { state: true },
    _mode: { state: true },
    _tool: { state: true },
    _wallDialog: { state: true },
    _drawWallField: { state: true },
    _activeDraftId: { state: true },
    _physicalSel: { state: true },
    _physicalDialog: { state: true },
    _partitionDeleteDialog: { state: true },
    _roomDeleteDialog: { state: true },
    _physicalDrag: { state: true },
    _physicalRotate: { state: true },
    _duplicateColumnId: { state: true },
    _opMeasure: { state: true },
    _path: { state: true },
    _cursorPt: { state: true },
    _mergeSel: { state: true },
    _openingPreset: { state: true },
    _openingDialog: { state: true },
    _openingInfo: { state: true },
    _mergeDialog: { state: true },
    _splitSel: { state: true },
    _decorTool: { state: true },
    _decorStyle: { state: true },
    _decorDraft: { state: true },
    _decorSel: { state: true },
    _decorEraseConfirm: { state: true },
    _decorTextDialog: { state: true },
    _decorShapeDialog: { state: true },
    _backdropDialog: { state: true },
    _furnPalette: { state: true },
    _decorImagePalette: { state: true },
    _decorAssetCatalog: { state: true },
    _decorAssetBusy: { state: true },
    _furnCategory: { state: true },
    _furnPreviewInput: { state: true },
    _bdDrag: { state: true },
    _dtBox: { state: true },
    _dtDrag: { state: true },
    _kioskDialog: { state: true },
    _vacFit: { state: true },
    _vacAllCamerasFor: { state: true },
    _vacCalConfirm: { state: true },
    _kioskDots: { state: true },
    _areaSel: { state: true },
    _nameSel: { state: true },
    _roomDialog: { state: true },
    _roomEditId: { state: true },
    _roomFill: { state: true },
    _roomCustomFill: { state: true },
    _roomTempSrc: { state: true },
    _roomHumSrc: { state: true },
    _roomSrcOpen: { state: true },
    _roomSrcFilter: { state: true },
    _roomNameScale: { state: true },
    _roomLabelScale: { state: true },
    _spaceDialog: { state: true },
    _infoCard: { state: true },
    _deviceInbox: { state: true },
    _rulesDialog: { state: true },
    _settingsDialog: { state: true },
    _supportDialog: { state: true },
    _alignDialog: { state: true },
    _preflightClipboardFallback: { state: true },
    _backupExportDialog: { state: true },
    _backupImportDialog: { state: true },
    _importDialog: { state: true },
    _markerDialog: { state: true },
  };

  public connectedCallback(): void {
    this._connectedPath = location.pathname;
    this._routeDepartureHandled = false;
    window.addEventListener('location-changed', this._onLocationChanged);
    window.addEventListener('popstate', this._onLocationChanged);
    if (this._continuityDisposed) {
      this._continuity = this._newContinuityController();
      this._continuityDisposed = false;
      this._continuityPaintToken = -1;
    }
    const resolvedBlend = resolvedSvgScreenBlend(this.ownerDocument);
    if (resolvedBlend !== undefined) this._glowScreenBlend = resolvedBlend;
    this._continuityUnsub?.();
    this._continuityUnsub = subscribePageVisibility(this.ownerDocument, this._pageVisibility);
    // #354: only the View card owns toast infrastructure, so it alone turns a
    // locale-load failure into a visible message; other runtime surfaces keep
    // the console warning from the shared LanguageRuntime.
    this._languageFailureUnsub?.();
    this._languageFailureUnsub = subscribeLanguageLoadFailures(() => {
      this._showToast(this._t('toast.locale_load_failed'));
    });
    super.connectedCallback();
    void this._ensureLiveRuntime().catch(() => this.requestUpdate());
    this._pointerModality.connect(this.ownerDocument.defaultView);
    const PointerHoverObserver = this.ownerDocument.defaultView?.MutationObserver;
    if (PointerHoverObserver) {
      this._pointerHoverObserver = new PointerHoverObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) this._syncPointerHoverSubtree(node);
        }
      });
      this._pointerHoverObserver.observe(this.renderRoot, { childList: true, subtree: true });
    }
    this._motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._reducedMotion = !!this._motionMedia?.matches;
    this._motionMedia?.addEventListener?.('change', this._onMotionChange);
    svgScreenBlendSupported(this.ownerDocument).then((supported) => {
      if (supported === this._glowScreenBlend) return;
      this._glowScreenBlend = supported;
      if (this.isConnected) this.requestUpdate();
    });
    if (this.hass) this._ensureHaRegistryAuthority();
    window.addEventListener('keydown', this._keyHandler);
    // signatures expire (24 h); refresh well before that on long-lived screens
    this._signer.start(() => this.hass, () => this._referencedContentUrls());
    this._syncCycleTimer();
    window.addEventListener('hashchange', this._onHashChange);
    this._labsUnsub?.();
    this._labsUnsub = subscribeLabs(this._onLabsSnapshot);
    // AUD-1552-01: the boot-veil timers die in disconnectedCallback, so a
    // disconnect/reconnect while booting (Lovelace rebuilds its DOM, a view
    // switch remounts the card) used to strand _booting=true with no watcher
    // — the plan stayed hidden forever. Restart the veil lifecycle from every
    // connect: a fresh watch (fresh clock, so the hard cap counts from the
    // reconnect) while booting, or the tail timers if we detached mid-fade.
    if (this._booting) this._bootWatch();
    else if (this._bootFading) {
      clearTimeout(this._bootTimer);
      this._bootTimer = window.setTimeout(() => { this._bootFading = false; }, 220);
    }
    if (this._bootSoft) {
      clearTimeout(this._bootSoftTimer);
      this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
    }
    // DEV-B703-02: a reattach mid-outage must keep revalidating — the retry
    // timer died in disconnectedCallback
    if (!this._loadOk && this._serverCfg && this.hass) this._scheduleLoadRetry();
    // AUD-159B1-01: the placement is only knowable once we are IN the DOM.
    if (!this._warmSlot && this._config) this._warmAdopt();
    if (this._loadOk) this._ensureLiveSyncSubscriptions();
    // DEV-B703-03: one task later the element Lovelace replaced has detached
    // — only then is its open dialog ours to take over.
    if (this._warmVp && !this._warmRevivePending && this._warmReviveTimer === undefined) {
      this._warmRevivePending = true;
      this._warmReviveTimer = window.setTimeout(() => this._warmReviveDialog(), 0);
    }
    // If no card survived the document event, the placement tombstone still
    // carries its detach age and enters the same shared controller here.
    if (this._warmLongReturn) this._beginResumeSettle();
    this._warmLongReturn = false;
    // Transient navigation/resume fields are intentionally not reactive. A
    // same-element reconnect keeps Lit's previous DOM, so explicitly repaint
    // after clearing those fields in disconnectedCallback.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    this._liveRt?.dispose();
    this._editorRuntime?._disposeLiveEditor();
    this._clearRoomFocus(true);
    this._cancelDangerConfirm();
    // HA normally changes the route before removing the old Lovelace tree.
    // The explicit event covers routers that keep that tree connected for a
    // beat; this fallback covers a direct remove after history navigation.
    if (this._connectedPath && location.pathname !== this._connectedPath) {
      this._leaveCardRoute();
    }
    window.removeEventListener('location-changed', this._onLocationChanged);
    window.removeEventListener('popstate', this._onLocationChanged);
    this._continuityUnsub?.();
    this._continuityUnsub = undefined;
    this._languageFailureUnsub?.();
    this._languageFailureUnsub = undefined;
    this._motionMedia?.removeEventListener?.('change', this._onMotionChange);
    this._motionMedia = undefined;
    if (this._vacRaf) { cancelAnimationFrame(this._vacRaf); this._vacRaf = 0; }
    if (this._refitRaf) { cancelAnimationFrame(this._refitRaf); this._refitRaf = 0; }
    this._warmModeRequest = 0;
    if (this._dayCycleTimer) { clearInterval(this._dayCycleTimer); this._dayCycleTimer = 0; }
    this._dayCycleClockKey = '';
    if (this._bootSettleRaf) { cancelAnimationFrame(this._bootSettleRaf); this._bootSettleRaf = 0; }
    this._bootSettling = false;
    for (const rt of this._activityRt.values()) clearTimeout(rt.timer); // pending activity-window repaints
    window.removeEventListener('keydown', this._keyHandler);
    // A tab drag holds window listeners for the length of the gesture. Losing
    // the card mid-drag — Lovelace rebuilding its tree, the user leaving the
    // view with the button still down — would leave them alive: the closure
    // keeps this instance (and its config) from being collected, and the next
    // pointerup anywhere on the page would make an invisible card write its
    // order (review CODE-REVIEW-220-r2/r3, F1).
    this._endTabDrag();
    clearTimeout(this._tabSuppressClickTimer);
    this._tabSuppressClickTimer = undefined;
    this._tabSuppressClick = false;
    clearInterval(this._cycleTimer);
    clearTimeout(this._kioskDotsTimer);
    clearTimeout(this._kioskHoldTimer);
    clearTimeout(this._reloadRetry);
    clearTimeout(this._loadRetryTimer);
    this._loadRetryTimer = undefined; // a cleared id must not block a reschedule
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    this._connHooked?.removeEventListener?.('disconnected', this._onConnLost);
    this._connHooked?.removeEventListener?.('reconnect-error', this._onConnLost);
    this._connHooked = null;
    this._haRegistryRelease?.();
    this._haRegistryRelease = undefined;
    this._haRegistryConnection = null;
    this._signer.dispose();
    clearTimeout(this._toastTimer);
    clearTimeout(this._slideTimer);
    clearTimeout(this._editorRuntimeLoadingTimer);
    this._editorRuntimeLoadingTimer = undefined;
    this._editorRuntimeLoadingVisible = false;
    this._modeTransition.dispose();
    this._cameraTransition.dispose();
    this._cameraTransitionFit = null;
    this._modeTransitionVisual = null;
    this._modeTransitionPreparing = false;
    this._modeTransitionForceAtomic = false;
    this._modeTransitionRequest++;
    this._slideTimer = undefined;
    // Navigation transitions are session-only and never survive a remount.
    this._slide = '';
    clearTimeout(this._bootTimer);
    this._bootTimer = undefined; // AUD-1552-01: a cleared id must not block the reconnect watcher
    clearTimeout(this._bootSoftTimer);
    this._saveConfigDebounced.flush(); // never leave an edit unsent on teardown
    this._cancelDeviceDrag();
    window.removeEventListener('hashchange', this._onHashChange);
    this._labsUnsub?.();
    this._labsUnsub = undefined;
    clearTimeout(this._holdTimer);
    this._roViewport?.disconnect();
    this._roViewport = undefined;
    this._roHdr?.disconnect();
    this._roHdr = undefined;
    if (this._onWinResize) {
      window.removeEventListener('resize', this._onWinResize);
      this._onWinResize = undefined;
    }
    if (this._unsubCfg) {
      this._unsubCfg();
      this._unsubCfg = null;
    }
    if (this._unsubLayout) {
      this._unsubLayout();
      this._unsubLayout = null;
    }
    if (this._unsubVirtual) {
      this._unsubVirtual();
      this._unsubVirtual = null;
    }
    if (this._unsubTrail) {
      this._unsubTrail();
      this._unsubTrail = undefined;
    }
    this._liveSyncGeneration++;
    this._liveSyncAttempt = null;
    this._liveSyncConnection = null;
    clearTimeout(this._layoutSyncTimer);
    clearTimeout(this._duplicateColumnTimer);
    disposeGlowRuntime(this._glowRuntimeState, this._glowRuntimeHost);
    // DEV-B703-03: the last thing this instance was showing, then the
    // tombstone that lets exactly one successor adopt the open dialog.
    // AUD-159B1-02: the snapshot runs while `_warmRevivePending` is still
    // TRUE. An instance that never got to consume its predecessor's dialog
    // has nothing of its own to record there, and the old order (clear the
    // flag, then snapshot) had it write `dlg: null` over somebody else's
    // unsaved draft — a second Lovelace rebuild inside one task destroyed
    // the draft before the first successor could restore it. Now the draft
    // simply travels down the chain until one of them lives long enough.
    this._warmSnapshot();
    this._warmRevivePending = false;
    clearTimeout(this._warmReviveTimer);
    this._warmReviveTimer = undefined;
    this._warmRelease();
    this._clearPlanSnapHover();
    this._clearOpeningPlacement(true);
    this._editorRuntime?._clearFurniturePreview();
    // #369(д) r2-H1: the Shift listeners hold the runtime (and the card) in
    // their closure — a disconnected card must not stay pinned to window.
    this._editorRuntime?._furnShiftDetach();
    this._touchContacts.clear();
    this._touchSequenceMultitouch = false;
    this._touchClickBlockUntil = 0;
    this._clearTransientHover(true);
    this._cancelDevicePressFeedback();
    this._pointerHoverObserver?.disconnect();
    this._pointerHoverObserver = undefined;
    this._pointerModality.disconnect();
    this._editorSecondary?.reset();
    // R1: the rAF is the only normal owner that clears this flag. Reset only
    // after the disconnect snapshot (which must still skip unstable geometry),
    // so a same-element reattach can start fresh instead of keeping the veil.
    this._resumeSettling = false;
    this._continuityHistory = [...this._continuityHistory, ...this._continuity.trace].slice(-80);
    this._continuity.dispose();
    this._continuityDisposed = true;
    super.disconnectedCallback();
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._vacFit) {
      if (this._vacFit.busy) return;
      this._vacFit = null;
      this._showToast(this._t('vac.cal_cancelled'));
      e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') {
      // close the topmost open dialog; info popups first, then editors
      if (this._tapConfirm) { this._tapConfirm = null; return; }
      if (this._vacCalConfirm) {
        if (!this._vacCalConfirm.busy) this._vacCalConfirm = null;
        return;
      }
      if (this._decorEraseConfirm) { this._decorEraseConfirm = null; return; }
      if (this._openingInfo) { this._openingInfo = null; return; }
      if (this._infoCard) { this._closeInfoCard(); return; }
      if (this._rulesDialog) { this._rulesDialog = null; return; }
      if (this._alignDialog) { this._alignDialog = null; this._preflightClipboardFallback = null; return; }
      if (this._backupImportDialog) { this._backupImportDialog = null; return; }
      if (this._backupExportDialog) { this._backupExportDialog = null; return; }
      if (this._supportDialog) { void this._editorRuntime?._closeSupportDialog(); return; }
      if (this._settingsDialog) { this._settingsDialog = null; return; }
      if (this._markerDialog) { this._closeMarkerDialog(); return; }
      if (this._deviceInbox) { this._deviceInbox = null; return; }
      if (this._openingDialog) { this._openingDialog = null; return; }
      if (this._physicalDialog) { this._physicalDialog = null; return; }
      if (this._backdropDialog) { this._backdropDialog = null; return; }
      if (this._decorShapeDialog) { this._decorShapeDialog = null; return; }
      if (this._decorTextDialog) { this._decorTextDialog = null; return; }
      if (this._spaceDialog && !this._roomDialog) {
        // same semantics as the dialog's Cancel: an import queue is abandoned
        this._spaceDialog = null;
        this._importQueue = [];
        this._importTotal = 0;
        return;
      }
      if (this._editorSecondary?.hasOpenGroup) {
        e.preventDefault();
        this._editorSecondary?.closeGroup(true);
        return;
      }
    }
    // At the window listener `target` may be retargeted to the card host by
    // Shadow DOM. The composed path still contains the actual focused field.
    const eventPath = e.composedPath?.() || [e.target];
    const inField = eventPath.some((node: any) =>
      node?.matches?.('input, textarea, select, [contenteditable="true"]'),
    );
    // The secondary toolbar is a focusable control surface, not the canvas.
    // Delete/Backspace there must never fall through to the selected object.
    const inEditorSecondary = eventPath.some((node: any) =>
      node?.classList?.contains?.('editor-secondary'));
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // A Latin `key` names the shortcut the user actually pressed (including
    // QWERTZ/AZERTY). For a non-Latin layout use the physical code fallback,
    // so Russian «я» at KeyZ still works without making QWERTZ Ctrl+Z both
    // Undo (`key=z`) and Redo (`code=KeyY`) at the same time.
    const latinLetter = /^[a-z]$/.test(key);
    const isZ = key === 'z' || (!latinLetter && e.code === 'KeyZ');
    const isY = key === 'y' || (!latinLetter && e.code === 'KeyY');
    const redo = mod && ((isZ && e.shiftKey) || isY);
    const undo = mod && isZ && !e.shiftKey;
    if (this._mode === 'decor') {
      if ((undo || redo) && inField) return;
      if (redo) { e.preventDefault(); this._redoGeometry(); return; }
      if (undo) {
        e.preventDefault();
        if (this._decorDraft) { this._decorDraft = null; return; }
        if (this._decorMove || this._dtDrag || this._bdDrag) {
          this._cancelDecorGesture();
          return;
        }
        this._undoGeometry();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._decorSel &&
          !inField && !inEditorSecondary) {
        e.preventDefault();
        this._decorDeleteSel();
        return;
      }
      const arrow = e.key === 'ArrowLeft' ? [-this._gridPitch, 0]
        : e.key === 'ArrowRight' ? [this._gridPitch, 0]
          : e.key === 'ArrowUp' ? [0, -this._gridPitch]
            : e.key === 'ArrowDown' ? [0, this._gridPitch]
              : null;
      if (arrow && !mod && !e.altKey && this._decorTool === 'select' && this._decorSel
          && this._decorList.some((shape) => shape.id === this._decorSel)
          && !this._decorDraft && !this._decorMove && !this._dtDrag && !this._bdDrag
          && !inField && !inEditorSecondary && !this._editorSecondaryDialogBlocked) {
        e.preventDefault();
        this._decorNudge(arrow[0], arrow[1]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this._decorDraft) this._decorDraft = null;
        else if (this._decorMove || this._dtDrag || this._bdDrag) this._cancelDecorGesture();
        // The palette is one explicit surface: Escape closes it and returns
        // to Select in one step, regardless of whether a symbol was armed.
        else if (this._decorTool === 'furniture') {
          this._editorRuntime?._clearFurniturePreview();
          this._editorRuntime?._furnShiftDetach(); // #369(д) r2-H1
          this._furnPalette = null;
          this._furnCategory = null;
          this._decorTool = 'select';
        }
        else if (this._decorSel) this._decorSel = null;
        else if (this._decorTool !== 'select') this._decorTool = 'select';
        else this._setMode('view');
      }
      return;
    }
    if (this._mode === 'devices') {
      if ((undo || redo) && inField) return;
      if (redo) {
        e.preventDefault();
        this._redoDevicePosition();
        return;
      }
      if (undo) {
        e.preventDefault();
        this._undoDevicePosition();
        return;
      }
      if (e.key === 'Escape' && this._deviceDrag) {
        e.preventDefault();
        this._cancelDeviceDrag();
      }
      return;
    }
    if (!this._markup) return;
    if ((undo || redo) && inField) return; // keep native text-field history
    if ((e.key === 'Delete' || e.key === 'Backspace') && this._physicalSel
        && !inField && !inEditorSecondary) {
      e.preventDefault();
      this._deletePhysicalSelection();
      return;
    }
    if (redo) {
      e.preventDefault();
      this._redoGeometry();
      return;
    }
    if (undo) {
      e.preventDefault();
      if (this._resize?.dragging) {
        this._rszCancelDrag();
        return;
      }
      if (this._wallFaceBatch) {
        // The queue has not committed anything. Restore its terminal draft,
        // then make Ctrl/Cmd+Z visibly remove that last accepted point.
        this._roomDialogCancel();
        if (this._activeDraftId && this._path.length > 1) this._undoActiveDraftPoint();
        else this._undoPoint();
        return;
      }
      // A crash-safe segment is a real geometry command, but Undo keeps the
      // surviving draft active so the visible contract remains “one point back”.
      if (this._tool === 'draw' && this._path.length) {
        if (this._activeDraftId && this._path.length > 1) this._undoActiveDraftPoint();
        else this._undoPoint();
        return;
      }
      if (this._tool === 'split' && this._splitSel?.pts?.length) {
        this._splitSel = { ...this._splitSel, pts: this._splitSel.pts.slice(0, -1) };
        if (!this._splitSel.pts.length) this._cursorPt = null;
        return;
      }
      this._undoGeometry();
      return;
    }
    if (e.key !== 'Escape') return;
    if (this._physicalDrag || this._physicalRotate) {
      e.preventDefault();
      this._cancelPhysicalGesture();
      return;
    }
    if (this._roomDialog) {
      e.preventDefault();
      this._roomDialogCancel();
      return;
    }
    if (this._tool === 'draw' && this._path.length) {
      e.preventDefault();
      // Escape releases the active wall chain without making it destructive:
      // Ctrl/Cmd+Z remains the one-point undo path (#294).  Reuse the exact
      // finish transaction used by a tool change, but keep `draw` selected.
      this._finishWallChain();
      return;
    }
    if (this._physicalSel) {
      e.preventDefault();
      this._physicalSel = null;
      return;
    }
    if (this._tool === 'resize') {
      e.preventDefault();
      if (this._resize?.dragging) {
        // Esc mid-drag: the immutable preview is simply discarded
        this._rszCancelDrag();
        return;
      }
      if (this._resize?.escapeIdle() === 'exit-tool') this._tool = 'draw';
      this.requestUpdate();
      return;
    }
    // Esc walks back out of merge/split: point by point, then the room pick,
    // then the tool itself (back to the neutral draw tool)
    if (this._tool === 'split') {
      e.preventDefault();
      if (this._splitSel?.pts?.length) {
        this._splitSel = { ...this._splitSel, pts: this._splitSel.pts.slice(0, -1) };
        if (!this._splitSel.pts.length) this._cursorPt = null;
      } else if (this._splitSel) {
        this._splitSel = null;
      } else {
        this._tool = 'draw';
      }
      return;
    }
    if (this._tool === 'merge') {
      e.preventDefault();
      if (this._mergeSel) this._mergeSel = null;
      else this._tool = 'draw';
      return;
    }
    if (this._wallDialog) {
      e.preventDefault();
      this._wallDialog = null;
      return;
    }
    if (this._tool === 'opening' || this._tool === 'wallthick' || this._tool === 'delroom'
        || this._tool === 'column') {
      e.preventDefault();
      if (this._tool === 'opening') this._clearOpeningPlacement(true);
      this._tool = 'draw';
    }
  }

  /** Remove the last placed point; saved drafts stay structurally valid. */
  private _undoPoint(): void {
    if (!this._path.length) return;
    if (this._contourClosed) {
      this._path = this._path.slice(0, -1);
      this._closingWallCm = null;
      return;
    }
    if (this._activeDraftId && this._path.length > 1 && this._curSpaceCfg) {
      const before = this._geometrySnapshot();
      this._path = this._path.slice(0, -1);
      this._draftSegmentCms = this._draftSegmentCms.slice(0, -1);
      const sp = this._curSpaceCfg as any;
      const i = (sp.room_drafts || []).findIndex((d: any) => d.id === this._activeDraftId);
      if (i >= 0) {
        const previousSegments = Array.isArray(sp.room_drafts[i]?.segments)
          ? sp.room_drafts[i].segments : [];
        if (this._path.length < 2) {
          sp.room_drafts.splice(i, 1);
          if (!sp.room_drafts.length) delete sp.room_drafts;
          this._activeDraftId = null;
        } else {
          sp.room_drafts[i] = {
            id: this._activeDraftId,
            points: this._path.map((p) => [p[0] / NORM_W, p[1] / NORM_W]),
            // Undo removes the terminal edge; it must not rename every edge
            // that survived it. The v8 identity barrier only creates an id
            // for a genuinely new segment (#314).
            segments: this._draftSegmentCms.map((cm, index) => ({
              ...(previousSegments[index] || {}), cm,
            })),
          };
        }
        this._commitPhysicalGeometry(this._t('history.draft_segment_delete'), before);
      }
      return;
    }
    this._path = this._path.slice(0, -1);
  }

  /** Undo the persisted segment command while keeping its surviving draft active. */
  private _undoActiveDraftPoint(): void {
    const activeId = this._activeDraftId;
    const start = this._path[0] ? [...this._path[0]] : null;
    const command = this._geometryHistory.undo();
    if (!command) {
      this._undoPoint();
      return;
    }
    if (!this._applyGeometryState(command.before, true)) {
      this._geometryHistory.clear();
      return;
    }
    const draft = activeId
      ? this._spaceModel()?.room_drafts.find((item) => item.id === activeId)
      : null;
    if (draft) {
      this._activeDraftId = draft.id;
      this._path = draft.points.map((point) => [...point]);
      this._draftSegmentCms = this._adoptDraftCms(
        this._path, draft.segments.map((segment: any) => segment.cm), draft.id,
      );
      this._resumeDraftBySpace[this._space] = draft.id;
    } else {
      this._activeDraftId = null;
      this._path = start ? [start] : [];
      this._draftSegmentCms = [];
      if (activeId && this._resumeDraftBySpace[this._space] === activeId)
        delete this._resumeDraftBySpace[this._space];
    }
    this._clearPlanSnapHover();
    this._showToast(this._t('history.undone', { name: command.name }));
  }

  public static async getConfigElement() {
    await import('./editor');
    return document.createElement('houseplan-card-editor');
  }

  public static getStubConfig(): Partial<CardConfig> {
    return { type: 'custom:houseplan-card' };
  }

  /** Test hook (smokes): forget the warm re-mount memo — a cold page again.
   *  `ttl` retunes WARM_REVIVE_MS so a smoke can watch the TTL expire without
   *  standing still for ten seconds (AUD-159B1-03); omitted = back to 10 s. */
  public static _warmBootReset(ttl?: number): void {
    for (const list of warmBoot.values()) for (const s of list) clearTimeout(s.evict);
    warmBoot.clear();
    WARM_REVIVE_MS = ttl && ttl > 0 ? ttl : 10000;
  }

  /** Test hook (smokes): what the memo is holding — slots per key, and how
   *  many of them still keep a dialog payload alive. */
  public static _warmBootStats(): { keys: number; slots: number; dlgs: number; drafts: string[] } {
    let slots = 0, dlgs = 0;
    const drafts: string[] = [];
    for (const list of warmBoot.values()) {
      for (const s of list) {
        slots++;
        if (s.dlg) { dlgs++; drafts.push(s.dlg.kind); }
      }
    }
    return { keys: warmBoot.size, slots, dlgs, drafts };
  }

  public setConfig(config: CardConfig): void {
    const previousConfig = this._config;
    const previousFixed = !!previousConfig
      && Object.prototype.hasOwnProperty.call(previousConfig, 'floor');
    this._config = { icon_size: 2.5, show_temperature: true, live_states: true, show_signal: true, ...config };
    const fixedChanged = previousFixed !== this._hasFixedFloor
      || previousConfig?.floor !== this._config.floor;
    if (fixedChanged) {
      this._hashApplied = false;
      this._navApplied = false;
      this._warmVpArmed = false;
    }
    if (this._config.kiosk) { this._booting = false; this._bootFading = false; } // kiosk: 100dvh, nothing to settle
    if (!this._hasFixedFloor && config.default_floor) this._commitSpace(config.default_floor, true);
    try {
      this._zoomBySpace = JSON.parse(localStorage.getItem(LS_ZOOM) || '{}') || {};
    } catch {
      this._zoomBySpace = {};
    }
    try {
      const stored = JSON.parse(localStorage.getItem(LS_VIEW) || '{}') || {};
      this._viewPreference = Object.fromEntries(Object.entries(stored)
        .filter((entry): entry is [string, 'flat' | 'iso'] => entry[1] === 'flat' || entry[1] === 'iso'));
    } catch {
      this._viewPreference = {};
    }
    this._labs = currentLabs();
    try {
      const ks = JSON.parse(localStorage.getItem(LS_KIOSK) || 'null');
      this._kioskScale = { icon: clampScale(ks?.icon), font: clampScale(ks?.font) };
    } catch {
      /* defaults */
    }
    // instant render from cache (stale-while-revalidate): show the plan and icons
    // right away, without waiting for the server response — fresh data will load in the background.
    try {
      const c = JSON.parse(localStorage.getItem(LS_CFG) || 'null');
      if (c && c.config && Array.isArray(c.config.spaces)) {
        this._serverCfg = c.config;
        this._seedDecorStyle(this._serverCfg);
        this._cfgEpoch++;
        this._cfgRev = c.rev || 0;
        this._cfgContentFingerprint = c.config_fingerprint || contentFingerprint(c.config);
        this._layout = c.layout || {};
        this._layoutRev = c.layout_rev || 0;
        this._layoutContentFingerprint = c.layout_fingerprint || contentFingerprint(this._layout);
        this._virtualLights = virtualLightSnapshot(c.virtual_lights, this._cfgRev);
        this._serverStorage = true;
      }
    } catch {
      /* ignore */
    }
    this._adoptInitialSpace(this._model, this._loadOk);
    // HP-1551: the saved per-space zoom used to be applied only by
    // _restoreZoom()'s rAF after the server round-trip, so the cached config
    // painted its first frames at the default fit and the plan visibly
    // jumped to the saved zoom. The zoom store is already in hand here —
    // arm it BEFORE the first view computation, so the very first paint is
    // already at the user's zoom.
    if (this._mode === 'view' && !this._view) this._zoom = this._zoomBySpace[this._space] || 1;
    // AUD-159B1-01: the memo is claimed by DOM slot, and Lovelace calls
    // setConfig BEFORE it inserts the element — so the claim waits for
    // connectedCallback (still before the first render, so nothing flashes).
    // A setConfig on a card that is already attached (the editor's live
    // preview) re-claims right here, because the config is part of the key.
    if (this.isConnected) {
      this._syncCycleTimer();
      this._warmAdopt();
      if (this._warmLongReturn) this._beginResumeSettle();
      this._warmLongReturn = false;
    }
  }

  /**
   * DEV-B703-01/03 + AUD-159B1-01: find the memo of the card that used to sit
   * in THIS placement and step into it — the settled header height (no veil,
   * synchronous reveal in the final geometry) and, when the slot is provably
   * ours, the whole viewport. `_bootSoft` covers residual chrome drift with a
   * glide instead of a snap.
   */
  private _warmAdopt(): void {
    if (this._config?.kiosk) return;
    const key = warmBootKey(this._config);
    if (this._warmKey === key && this._warmSlot) return; // already sitting in it
    if (this._warmSlot) this._warmRelease(); // the config (or the window) changed under us
    const place = this.parentNode;
    const idx = this._warmIdx(place);
    const list = warmBoot.get(key);
    if (!list || !list.length) return; // cold page — the full protective boot
    // the same element re-attached (Lovelace moves cards around): our own slot
    // is waiting for us, and our live state is newer than anything in it
    const mine = list.find((s) => s.owner === this._warmGen);
    if (mine) {
      this._warmLongReturn = !!mine.freed && Date.now() - mine.freed >= CONTINUITY_LONG_HIDDEN_MS;
      clearTimeout(mine.evict); mine.evict = 0; mine.freed = 0; mine.live = true;
      this._warmSlot = mine;
      this._warmKey = key;
      if (mine.frameFingerprint) this._continuity.adoptCompleteFrame(mine.frameFingerprint);
      if (!this._devices.length && mine.devices?.length) this._devices = [...mine.devices];
      return;
    }
    const { slot, sure } = warmMatch(list, this._warmGen, place, idx);
    if (!slot) return;
    this._warmLongReturn = !!slot.freed && Date.now() - slot.freed >= CONTINUITY_LONG_HIDDEN_MS;
    this._booting = false;
    this._bootFading = false;
    this._hdrH = slot.hdrH;
    this._bootSoft = true; // timer armed in connectedCallback...
    if (this.isConnected) { // ...unless we are claiming while already attached
      clearTimeout(this._bootSoftTimer);
      this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
    }
    this._warmKey = key;
    if (sure) {
      clearTimeout(slot.evict); // the dialog is ours now, not the TTL's
      slot.evict = 0;
      slot.owner = this._warmGen;
      slot.place = place ? new WeakRef(place) : null;
      slot.idx = idx;
      slot.live = true;
      this._warmSlot = slot;
      this._warmVp = slot.vp; // adopted below, once the model is in hand
      if (slot.frameFingerprint) this._continuity.adoptCompleteFrame(slot.frameFingerprint);
      if (!this._devices.length && slot.devices?.length) this._devices = [...slot.devices];
      this._warmAdoptViewport(this._config!);
    } else {
      // Two identical cards on one view and no way to tell which slot is ours:
      // the height is interchangeable (they settle at the same chrome), the
      // viewport and the dialog belong to somebody and must not be guessed.
      this._warmSlot = {
        owner: this._warmGen, path: location.pathname,
        place: place ? new WeakRef(place) : null, idx, live: true,
        hdrH: slot.hdrH, stageH: slot.stageH, vp: null,
        frameFingerprint: '', devices: null, dlg: null, freed: 0, evict: 0,
      };
      list.push(this._warmSlot);
      this._warmTrim(list);
    }
  }

  /** This element's position among its parent's children (-1 if unmounted). */
  private _warmIdx(place: Node | null): number {
    const kids = (place as Element | null)?.children;
    if (!kids) return -1;
    for (let i = 0; i < kids.length; i++) if (kids[i] === this) return i;
    return -1;
  }

  /** Let go of the slot: the placement is still there, this instance is not. */
  private _warmRelease(): void {
    const s = this._warmSlot;
    const key = this._warmKey;
    this._warmSlot = null;
    this._warmKey = null;
    if (!s || !key) return;
    s.freed = Date.now();
    if (s.owner === this._warmGen) s.live = false;
    this._warmScheduleEvict(s, key);
  }

  /** Drop the oldest slot that nobody is sitting in. */
  private _warmTrim(list: WarmEntry[]): void {
    while (list.length > WARM_MAX_SLOTS) {
      const i = list.findIndex((s) => !s.live);
      if (i < 0) break;
      clearTimeout(list[i].evict);
      list.splice(i, 1);
    }
  }

  /**
   * AUD-159B1-03: the TTL used to be a rule checked at revive time only, so a
   * draft nobody came back for stayed reachable from module scope until the
   * page reloaded — with the space dialog that means a whole plan file held as
   * base64 (8 MiB allowed by the backend). Free the payload the moment it
   * stops being revivable; the height and the viewport are bytes, they stay.
   */
  private _warmScheduleEvict(s: WarmEntry, key: string): void {
    clearTimeout(s.evict);
    if (!s.dlg && (!s.vp || s.vp.mode === 'view')) return;
    const freed = s.freed;
    const gen = s.owner;
    s.evict = window.setTimeout(() => {
      s.evict = 0;
      if (s.freed !== freed || s.owner !== gen) return; // a successor took over
      // the dialog is unrevivable now, whoever is sitting in the slot
      s.dlg = null;
      // Route events can arrive after Lovelace has detached the old tree. The
      // TTL is the order-independent backstop: a stale editor viewport is
      // never revived after the short technical-remount window.
      s.vp = expiredWarmViewport(s.vp);
      s.frameFingerprint = '';
      // a slot nobody re-claimed is also what makes the NEXT claim ambiguous
      const list = warmBoot.get(key);
      if (!s.live && list && list.length > 1) {
        const i = list.indexOf(s);
        if (i >= 0) list.splice(i, 1);
      }
    }, WARM_REVIVE_MS + 250);
  }

  /**
   * DEV-B703-03: put back the EXACT viewport of the instance Lovelace threw
   * away — same space, same editor, same zoom and the same pan rect, so the
   * re-mount is bit-for-bit the view that was on screen. Runs after the LS
   * snapshot has restored the model (the space must exist) and after the
   * LS_NAV/default_floor guesses, which it supersedes: the memo is the newer,
   * finer-grained record of the very same intent. A `#space=` deep link is an
   * EXPLICIT navigation and still wins.
   */
  private _warmAdoptViewport(config: CardConfig): void {
    const vp = this._warmVp;
    if (!vp || this._warmSlot?.path !== location.pathname) {
      this._warmVp = null;
      return;
    }
    const fixed = this._fixedFloorState();
    if (this._hashApplied || !this._model.find((sp) => sp.id === vp.space)
        || fixed.kind === 'valid' && fixed.id !== vp.space
        || this._hasFixedFloor && fixed.kind !== 'valid') {
      this._warmVp = null; // another space is on screen — the memo is not about it
      return;
    }
    this._commitSpace(vp.space, true);
    this._navApplied = true;
    // A remounted card owns a fresh lazy-runtime instance. Keep View committed
    // until that runtime has installed, then adopt the remembered editor
    // atomically without rebuilding its camera through a View -> editor
    // transition. A newer user command invalidates this request through the
    // shared request counter.
    const restoredMode = vp.mode !== 'view' && this._canEdit && !config.kiosk ? vp.mode : 'view';
    this._adoptMode('view');
    // AUD-159B6-04: the memo is the NEWER and MORE SPECIFIC record than the
    // global LS nav — a neighbour card writing `mode=devices` into localStorage
    // must not be replayed over this owner's viewport once can_write answers
    // (it also broke the draft revival, whose guard compares the mode). So the
    // pending intent is REPLACED here, never merely added to.
    this._pendingNavMode = vp.mode !== 'view' && !this._canEdit && !config.kiosk ? vp.mode : null;
    this._zoom = vp.zoom;
    const projection = this._effectiveProjection();
    const sameProjection = projection === vp.projection && this._labsIso === vp.activeLabsIso;
    this._view = sameProjection && vp.view ? { ...vp.view } : null;
    this._viewModeSnap = sameProjection && vp.snap ? { ...vp.snap } : null;
    if (!sameProjection && vp.logicalCenter) {
      const center = projection === 'iso'
        ? projectPlanPoint([vp.logicalCenter.x, vp.logicalCenter.y], 0)
        : [vp.logicalCenter.x, vp.logicalCenter.y] as ScenePoint;
      this._applyView(vp.zoom, center[0], center[1]);
    }
    this._tool = normalizeMarkupTool(vp.tool);
    this._decorTool = vp.decorTool;
    this._showHidden = vp.showHidden;
    if (this._showFar !== vp.showFar) { this._showFar = vp.showFar; this._frame = null; }
    this._selId = vp.selId;
    this._resize?.restoreSelection(vp.rszSel);
    this._decorSel = vp.decorSel;
    this._warmVpArmed = true; // _loadFromServer must not re-centre this
    if (restoredMode !== 'view') void this._requestMode(restoredMode, false, true);
  }

  /** Merge a patch into this card's warm entry. `create` is false everywhere
   *  but the boot settle: a memo may only be BORN from a settled geometry. */
  private _warmPatch(patch: Partial<WarmEntry>, create = false): void {
    if (this._config?.kiosk) return;
    const k = warmBootKey(this._config);
    // The key carries the window size and the view path: once either changes
    // under a LIVE card, its slot describes a geometry that is no longer on
    // screen, and the next mount at the new size must boot cold (documented
    // in docs/WARM-REMOUNT.md §1) — so write nothing rather than lie.
    if (this._warmSlot && this._warmKey !== k) return;
    if (!this._warmSlot) {
      if (!create) return;
      const place = this.parentNode;
      this._warmKey = k;
      this._warmSlot = {
        owner: this._warmGen, path: location.pathname,
        place: place ? new WeakRef(place) : null, idx: this._warmIdx(place), live: true,
        hdrH: this._hdrH, stageH: 0, vp: null,
        frameFingerprint: '', devices: null, dlg: null, freed: 0, evict: 0,
      };
      const list = warmBoot.get(k) || [];
      list.push(this._warmSlot);
      warmBoot.set(k, list);
      this._warmTrim(list);
      while (warmBoot.size > WARM_MAX_KEYS) {
        const oldest = warmBoot.keys().next().value; // Map keeps insertion order
        if (oldest === undefined || oldest === k) break;
        for (const s of warmBoot.get(oldest) || []) clearTimeout(s.evict);
        warmBoot.delete(oldest);
      }
    }
    Object.assign(this._warmSlot, patch);
  }

  private _warmViewportState(): WarmViewport {
    const projection = this._effectiveProjection();
    return {
      space: this._space,
      mode: this._mode,
      projection,
      activeLabsIso: this._labsIso,
      logicalCenter: this._logicalViewCenter(projection),
      zoom: this._zoom,
      view: this._view ? { ...this._view } : null,
      snap: this._viewModeSnap ? { ...this._viewModeSnap } : null,
      tool: this._tool,
      decorTool: this._decorTool,
      showHidden: this._showHidden,
      showFar: this._showFar,
      selId: this._selId,
      rszSel: this._resize?.selectedRoomId,
      decorSel: this._decorSel,
    };
  }

  /**
   * The open dialog, or null. Deliberately null (docs/WARM-REMOUNT.md §4) for:
   *  • «Выровнять всё по сетке» and the room MERGE confirmation — a modal whose
   *    only content is "press OK to rewrite your plan". Resurrecting a
   *    confirmation next to a user who has just come back to the tab is how a
   *    destructive write gets a blind click; both are one click to reopen.
   *  • a tap confirmation — it carries a closure over the DEAD instance.
   *  • the floor-import wizard — `updated()` reopens it by itself while the
   *    config is still empty; reviving it too would double the queue.
   *  • ANY dialog with a save/upload in flight (`busy`) — the new instance
   *    cannot know whether the write landed, and offering Save again invites a
   *    second one. The config reload shows the truth instead.
   * Precedence follows the Esc stack: the topmost dialog is the one that is
   * "open" as far as the user is concerned.
   */
  private _warmDialogState(): WarmDialog | null {
    const at = (kind: WarmDialogKind, data: any): WarmDialog =>
      ({ kind, space: this._space, mode: this._mode, data });
    if (this._tapConfirm || this._alignDialog || this._mergeDialog || this._importDialog
        || this._backupExportDialog || this._backupImportDialog) return null;
    if (this._openingInfo) return at('openingInfo', (this._openingInfo as any).id);
    if (this._infoCard) return at('info', this._infoCard.id);
    if (this._rulesDialog) return this._rulesDialog.busy ? null : at('rules', this._rulesDialog);
    if (this._settingsDialog) return this._settingsDialog.busy ? null : at('settings', this._settingsDialog);
    if (this._markerDialog) return this._markerDialog.busy ? null : at('marker', this._markerDialog);
    if (this._openingDialog) return at('opening', this._openingDialog);
    if (this._backdropDialog) return at('backdrop', this._backdropDialog);
    if (this._decorShapeDialog) return at('decorShape', this._decorShapeDialog);
    if (this._decorTextDialog) return at('decorText', this._decorTextDialog);
    if (this._roomDialog) {
      return at('room', {
        editId: this._roomEditId, fill: this._roomFill, customFill: this._roomCustomFill,
        tempSrc: this._roomTempSrc,
        humSrc: this._roomHumSrc, srcOpen: this._roomSrcOpen, srcFilter: this._roomSrcFilter,
        nameScale: this._roomNameScale, labelScale: this._roomLabelScale,
        areaSel: this._areaSel, nameSel: this._nameSel,
        pendingSplit: this._pendingSplit, wallFaceBatch: this._wallFaceBatch,
        path: this._path,
      });
    }
    if (this._spaceDialog) return this._spaceDialog.busy ? null : at('space', this._spaceDialog);
    return null;
  }

  /** Mirror the live viewport (and the open dialog) into the memo. Called from
   *  every `updated()`: whatever the previous instance last PAINTED is what the
   *  next one must open at — and a dialog closed with Esc/Cancel/Save writes
   *  `dlg: null` here on the very next render, so it can never come back. */
  private _warmSnapshot(): void {
    // A candidate may already exist in fields while the DOM still presents the
    // previous complete frame. Never pair those fields with the old frame
    // fingerprint in the placement memo; the successful paint barrier writes
    // the coherent snapshot from its completion callback.
    if (this._booting || this._config?.kiosk || this._continuity.state !== 'steady') return;
    const patch: Partial<WarmEntry> = {
      vp: this._warmViewportState(),
      frameFingerprint: this._continuity.frameFingerprint,
      devices: this._devices,
    };
    // do not overwrite the snapshot we are about to revive FROM
    if (!this._warmRevivePending) patch.dlg = this._warmDialogState();
    // AUD-159B1-01: the placement is re-measured from the live DOM, so a card
    // that was moved (a sibling added above it) still names its own slot.
    if (this.isConnected && this._warmSlot?.owner === this._warmGen) {
      const place = this.parentNode;
      patch.place = place ? new WeakRef(place) : null;
      patch.idx = this._warmIdx(place);
    }
    this._warmPatch(patch);
  }

  /**
   * Re-open the dialog the dead instance had open. Not done in setConfig:
   * Lovelace may still be holding the old element there, and a live owner's
   * dialog must not be stolen. One task later the previous instance has
   * detached (`freed`) and the snapshot is ours to consume — exactly once.
   */
  private _warmReviveDialog(): void {
    const e = this._warmSlot; // AUD-159B1-01: OUR slot, never a neighbour's
    this._warmReviveTimer = undefined;
    if (!e || !e.dlg) {
      this._warmRevivePending = false;
      return;
    }
    const d = e.dlg;
    const freed = e.freed;
    if (d.mode !== this._mode && d.mode !== 'view' && this._warmVp?.mode === d.mode
        && !this._editorRuntime) {
      // The dialog belongs to the editor viewport that is currently waiting
      // for its lazy runtime. Do not consume it against the temporary View;
      // `_requestMode(..., adopt=true)` revives it immediately after the mode
      // can be committed safely.
      this._warmRevivePending = true;
      return;
    }
    this._warmRevivePending = false;
    e.dlg = null; e.freed = 0; // consume-once: no zombie on the third mount
    clearTimeout(e.evict); e.evict = 0;
    if (!freed || Date.now() - freed > WARM_REVIVE_MS) return; // owner alive, or gone long ago
    if (d.space !== this._space || d.mode !== this._mode) return;  // never in another space/editor
    switch (d.kind) {
      case 'space': this._spaceDialog = { ...d.data, busy: false, savedBusy: false }; break;
      case 'marker': this._markerDialog = { ...d.data, busy: false }; break;
      case 'settings': this._settingsDialog = { ...d.data, busy: false }; break;
      case 'rules': this._rulesDialog = { ...d.data, busy: false }; break;
      case 'opening': this._openingDialog = { ...d.data }; break;
      case 'backdrop': this._backdropDialog = { ...d.data }; break;
      case 'decorShape': this._decorShapeDialog = { ...d.data }; break;
      case 'decorText': {
        this._decorTextDialog = { ...d.data };
        const end = String(this._decorTextDialog?.text ?? '').length;
        this._decorTextSelection = { start: end, end };
        break;
      }
      case 'room': {
        const r = d.data;
        this._roomEditId = r.editId; this._roomFill = r.fill;
        this._roomCustomFill = r.customFill || null; this._roomTempSrc = r.tempSrc;
        this._roomHumSrc = r.humSrc; this._roomSrcOpen = r.srcOpen; this._roomSrcFilter = r.srcFilter;
        this._roomNameScale = r.nameScale; this._roomLabelScale = r.labelScale;
        this._areaSel = r.areaSel; this._nameSel = r.nameSel;
        this._pendingSplit = r.pendingSplit; this._wallFaceBatch = r.wallFaceBatch || null;
        this._path = r.path;
        if (this._wallFaceBatch) {
          this._activeDraftId = this._wallFaceBatch.activeDraftId;
          this._draftSegmentCms = [...this._wallFaceBatch.activeCms];
        }
        this._roomDialog = true;
        break;
      }
      // info popups are re-resolved by id: the config may have been reloaded
      // under us, and a card rendered from a stale object is a lie
      case 'info': {
        const dev = this._devices.find((x) => x.id === d.data);
        if (dev) this._infoCard = dev;
        break;
      }
      case 'openingInfo': {
        const op = (this._curSpaceCfg?.openings || []).find((x: any) => x.id === d.data);
        if (op) this._openingInfo = op;
        break;
      }
    }
    this.requestUpdate();
  }

  /** Save a snapshot of the config+layout to localStorage for an instant start. */
  private _cacheSnapshot(): void {
    if (!this._serverCfg) return;
    try {
      // Local edits may mutate nested config/layout before the debounced write;
      // keep the accepted identity paired with exactly what is cached.
      this._cfgContentFingerprint = contentFingerprint(this._serverCfg);
      this._layoutContentFingerprint = contentFingerprint(this._layout);
      this._virtualLights = reconcileVirtualLightSnapshot(
        this._virtualLights, this._serverCfg, this._cfgRev,
      );
      localStorage.setItem(LS_CFG, JSON.stringify({
        config: this._serverCfg,
        rev: this._cfgRev,
        config_fingerprint: this._cfgContentFingerprint,
        layout: this._layout,
        layout_rev: this._layoutRev,
        layout_fingerprint: this._layoutContentFingerprint,
        virtual_lights: virtualLightWire(this._virtualLights),
      }));
    } catch {
      /* ignore */
    }
  }

  private _beginContinuityCandidate(
    reason: string,
    dataReady: boolean,
    recoveryReason: 'plan' | 'connection' | 'stage-size' | 'asset' = 'plan',
  ): number {
    // Cold boot remains under the existing boot veil; #73 governs a frame
    // that has already been complete at least once.
    if (this._booting && !this._continuity.hasCompleteFrame) return this._continuity.token;
    this._continuityDataReady = dataReady;
    this._continuityPaintToken = -1;
    this._stagedDeviceSnapshotToken = -1;
    this._resumeSettling = true;
    return this._continuity.beginCandidate(reason, recoveryReason);
  }

  private _continuityStageValid(): boolean {
    const stage = this._stageEl;
    return !!stage && stage.clientWidth > 0 && stage.clientHeight > 0;
  }

  private _continuityAssetsReady(): boolean {
    // An empty/transient model is not a complete plan frame. Returning true
    // here used to let the previous DOM be blessed while the replacement
    // config was still being projected.
    if (!this._model.length) return false;
    const space = this._model.length ? this._spaceModel() : null;
    return !space?.bg?.href || this._signer.isReady(this.hass, space.bg.href);
  }

  private _initialSpaceSelection(
    models: SpaceModel[], authoritative = this._loadOk,
  ): InitialSpaceSelection {
    const fixed = this._fixedFloorState(models, authoritative);
    if (fixed.kind === 'valid') return { id: fixed.id, source: 'fixed' };
    if (this._hasFixedFloor) return { id: null, source: 'none' };
    return resolveInitialSpace({
      spaceIds: models.map((space) => space.id),
      hashSpace: this._hashSpace(),
      acceptHash: !this._hashApplied,
      currentSpace: this._space,
      preserveCurrent: this._hashApplied || this._navApplied || this._warmVpArmed,
      savedSpace: this._savedNav()?.space,
      defaultSpace: this._config?.default_floor,
    });
  }

  /** Install one exact raw-space authority before any spatial candidate paints. */
  private _adoptInitialSpace(
    models: SpaceModel[], authoritative = this._loadOk,
  ): InitialSpaceSelection {
    const selection = this._initialSpaceSelection(models, authoritative);
    if (!selection.id) return selection;
    this._commitSpace(selection.id, true);
    if (selection.source === 'hash') this._hashApplied = true;
    if (selection.source === 'saved') this._navApplied = true;
    return selection;
  }

  private _candidateBackdrop(config: ServerConfig | null, spaceId = this._space): string {
    const models = spaceModels(config);
    const fixed = this._fixedFloorState(models, true);
    if (this._hasFixedFloor && fixed.kind !== 'valid') return '';
    const preferred = this._initialSpaceSelection(models, true).id
      || (models.some((space) => space.id === spaceId) ? spaceId : models[0]?.id);
    return models.find((space) => space.id === preferred)?.bg?.href || '';
  }

  private _visualFrameFingerprint(): string {
    const stage = this._stageEl;
    const size = stage ? [stage.clientWidth, stage.clientHeight] : [0, 0];
    return visualFrameFingerprint([
      this._cfgRev,
      this._cfgContentFingerprint || contentFingerprint(this._serverCfg),
      this._layoutRev,
      this._layoutContentFingerprint || contentFingerprint(this._layout),
      this._space,
      this._mode,
      this._view,
      size,
      this._glowScreenBlend ? 'screen' : 'normal',
      this.hass?.themes?.darkMode ?? this.hass?.themes?.default_theme ?? '',
    ]);
  }

  /** Called from updated(): one token owns at most one paint barrier. */
  private _settleContinuityFrame(): void {
    if (this._booting || !this._continuityStageValid()) return;
    if (!this._continuity.hasCompleteFrame && this._continuity.state === 'steady') {
      // Cold start belongs to the boot veil. Do not replace it with a recovery
      // error just because a protected backdrop is still signing/decoding.
      if (this._continuityAssetsReady()) {
        this._renderSnapshotAt = Date.now();
        this._continuity.markCompleteFrame(this._visualFrameFingerprint());
      }
      return;
    }
    if (!this._continuityDataReady) return;
    if (!['holding', 'offline-stale', 'overlay-pending', 'overlay-visible', 'candidate-ready']
      .includes(this._continuity.state)) return;
    const token = this._continuity.token;
    if (this._candidateDeviceSnapshot
        && this._candidateDeviceSnapshot !== this._visibleDeviceSnapshot
        && this._stagedDeviceSnapshotToken !== token) {
      this._stagedDeviceSnapshotToken = token;
      this.requestUpdate();
      return;
    }
    if (this._continuityPaintToken === token) return;
    this._continuityPaintToken = token;
    if (!this._continuity.candidateReady(token)) return;
    void this._continuity.commitAfterPaint(token, {
      updateComplete: () => this.updateComplete,
      stageValid: () => this.isConnected && this._continuityStageValid(),
      assetsReady: () => this._continuityAssetsReady(),
      frameFingerprint: () => this._visualFrameFingerprint(),
    }).then((committed) => {
      if (!committed || token !== this._continuity.token) {
        if (token === this._continuity.token) {
          this._continuityPaintToken = -1;
          this._stagedDeviceSnapshotToken = -1;
          this._candidateDeviceSnapshot = null;
          this.requestUpdate();
        }
        return;
      }
      this._resumeSettling = false;
      this._renderSnapshotAt = Date.now();
      if (this._candidateDeviceSnapshot) this._visibleDeviceSnapshot = this._candidateDeviceSnapshot;
      this._candidateDeviceSnapshot = null;
      this._stagedDeviceSnapshotToken = -1;
      this._warmSnapshot();
    });
  }

  private _onBackdropLoaded(raw: string, paintedUrl?: string): void {
    this._signer.markLoaded(this.hass, raw, paintedUrl);
    this._continuity.note('asset-ready');
    this._continuityPaintToken = -1;
    if (this._continuity.state !== 'steady') this.requestUpdate();
  }

  private _retryContinuity = (): void => {
    this._continuityDataReady = false;
    this._continuityPaintToken = -1;
    this._continuity.retry(this._continuity.recoveryReason || 'plan');
    if (!this._loading) void this._loadFromServer();
  };

  private _renderRecoveryOverlay(): TemplateResult | typeof nothing {
    if (!this._continuity.overlayVisible && this._continuity.state !== 'recovery-error') return nothing;
    const connection = this._continuity.recoveryReason === 'connection';
    return html`<div class="recoveryoverlay phase-${this._continuity.overlayPhase}"
      role="status" aria-live="polite" aria-atomic="true"
      @pointerdown=${(event: Event) => event.stopPropagation()}
      @click=${(event: Event) => event.stopPropagation()}
      @wheel=${(event: Event) => event.stopPropagation()}>
        <ha-icon icon="mdi:home-sync-outline"></ha-icon>
        <span>${this._t(connection ? 'continuity.restore_connection' : 'continuity.restore_plan')}</span>
        ${this._continuity.state === 'recovery-error'
          ? html`<button class="btn on" @click=${this._retryContinuity}>${this._t('continuity.retry')}</button>`
          : nothing}
      </div>`;
  }

  private _renderEditorRuntimeLoading(): TemplateResult | typeof nothing {
    if (!this._editorRuntimeLoadingVisible) return nothing;
    return html`<div class="editorloading" role="status" aria-live="polite"
      aria-label=${this._t('editor.loading_aria')}>
        <ha-icon icon="mdi:loading"></ha-icon>
        <span>${this._t('editor.loading')}</span>
      </div>`;
  }

  /** Redacted lifecycle diagnostics used by the deterministic sampler. */
  public houseplanContinuityTrace(): readonly import('./visual-continuity').ContinuityTraceEvent[] {
    return [...this._continuityHistory, ...this._continuity.trace].slice(-80)
      .map((event) => ({ ...event, ...(event.stage ? { stage: [...event.stage] as [number, number] } : {}) }));
  }

  public getCardSize(): number {
    return 12;
  }

  // ================= MODEL RESOLUTION (server configuration) =================

  /** Whether a server configuration with spaces exists (otherwise — onboarding). */
  private get _norm(): boolean {
    return !!(this._serverCfg && this._serverCfg.spaces.length);
  }

  /** Spaces in render units (NORM_W × NORM_W — the canvas is square). */
  /** Bumped by every structural config mutation — the model/geometry cache key (audit L1). */
  private _cfgEpoch = 0;
  /** Exact settings-only Area lifecycle replacement which may reuse geometry. */
  private _cfgEpochPreservedConfig: ServerConfig | null = null;
  private _terminalFrame: 0 | 1 | 2 = 0; // 1=restored cancel, 2=deferred HA
  private _modelCache: { key: string; model: SpaceModel[] } | null = null;
  private _emptySpaceStateActive = false;
  private _decorSnapCache: {
    epoch: number; space: string; height: number; exclude: string; geometry: SnapGeometry;
  } | null = null;
  /** Last unsaved marker projection; invalidated by the complete dialog draft. */
  private _markerPreviewMemo: { key: string; device: DevItem | null } | null = null;
  private _markerPreviewDevicesMemo: {
    base: readonly DevItem[]; preview: DevItem; devices: readonly DevItem[];
  } | null = null;

  /** Cheap structural fingerprint of the config (audit L1 cache key). */
  private _cfgFingerprint(): string {
    const sp = this._serverCfg?.spaces || [];
    let s = sp.length + ':';
    for (const x of sp as any[]) {
      s += (x.id || '') + ',' + (x.plan_aspect || '') + ',' + (x.plan_url || '').length + ','
        // the backdrop transform is geometry: without it in the key a drag of
        // the picture would leave the memoized model (and the content frame
        // built from it) showing the old rectangle (docs/BACKDROP.md §5)
        + (x.plan_x ?? '') + ',' + (x.plan_y ?? '') + ',' + (x.plan_scale ?? '') + ','
        + (x.plan_scale_x ?? '') + ',' + (x.plan_scale_y ?? '') + ',' + (x.plan_angle ?? '') + ','
        + (x.rooms?.length || 0) + ',' + (x.openings?.length || 0) + ',' + (x.decor?.length || 0) + ';';
      for (const r of x.rooms || []) {
        // O(1) geometry roll-up per room: the count alone said nothing about
        // where the room actually is, so a moved rectangle or a dragged first/
        // last vertex looked identical (HP-1454-04). The epoch remains the
        // primary signal — this is the belt for a mutation that forgot to bump it.
        const p0 = r.poly?.[0], pn = r.poly?.[r.poly.length - 1];
        s += (r.poly?.length || 0) + '.' + (r.id || '') + '.' + (r.open_to || []).join('+') + '.'
          + (r.area || '') + '.' + JSON.stringify(r.settings || 0) + '.'
          + (r.x ?? '') + ',' + (r.y ?? '') + ',' + (r.w ?? '') + ',' + (r.h ?? '') + ','
          + (p0 ? p0[0] + '/' + p0[1] : '') + ',' + (pn ? pn[0] + '/' + pn[1] : '') + ';';
      }
    }
    return s;
  }

  private get _model(): SpaceModel[] {
    if (!this._serverCfg) return [];
    // In-place mutations mean the epoch can lag, so the key also carries the
    // config's structural fingerprint.
    const key = this._cfgEpoch + '|' + this._cfgFingerprint();
    if (this._modelCache && this._modelCache.key === key) return this._modelCache.model;
    const built = this._buildModel();
    this._modelCache = { key, model: built };
    return built;
  }

  private _buildModel(): SpaceModel[] {
    if (!this._serverCfg) return [];
    // HP-1550-01: the model renders the preview overlay, not the raw config
    // ONE model builder for both cards. This used to be a hand-copied twin of
    // spaceModels(), and the twin missed the legacy-store fallbacks the shared
    // one gained (safeViewBox, normRect) — the same broken store rendered fine
    // in the static card and as viewBox="0 0 0 0" here (HP-1503-01). The only
    // difference this card needs is the url: raw on purpose, because the model
    // is memoized on the config fingerprint, so a signed url baked in here
    // would freeze BEFORE the signature arrives and the plan would never load
    // (bug found 2026-07-27). _display() is called at render time instead.
    const cfg = this._renderCfg!;
    return spaceModels(cfg).map((m, i) => {
      const raw = (cfg.spaces[i] as any)?.plan_url;
      return m.bg && raw ? { ...m, bg: { ...m.bg, href: raw } } : m;
    });
  }

  private _spaceModel(): SpaceModel | undefined {
    return this._hasFixedFloor
      ? selectSpaceModelById(this._model, this._space)
      : selectActiveSpaceModel(this._model, this._space);
  }

  private _spaceModelById(id: string | null | undefined): SpaceModel | undefined {
    return selectSpaceModelById(this._model, id);
  }

  /** Abort every space-bound transaction once the authoritative plan is empty. */
  private _syncEmptySpaceState(): void {
    const empty = !!this._serverCfg && this._serverCfg.spaces.length === 0;
    if (!empty) {
      this._emptySpaceStateActive = false;
      return;
    }
    if (this._emptySpaceStateActive) return;
    this._emptySpaceStateActive = true;
    this._clearRoomFocus(true);

    for (const pointerId of this._pointers.keys()) {
      for (const node of this.renderRoot.querySelectorAll<HTMLElement>('*')) {
        try {
          if (node.hasPointerCapture?.(pointerId)) node.releasePointerCapture(pointerId);
        } catch {
          // A pointer may already have ended between the registry tick and cleanup.
        }
      }
    }
    this._pointers.clear();
    this._panStart = null;
    this._panLock = null;
    this._pinchStart = null;
    this._swipeStart = null;
    this._drag = null;
    this._deviceDrag = null;
    this._rlResize = null;
    this._vacFit = null;
    this._compassDrag = false;
    this._cancelModeTransition(false);
    this._mode = 'view';
    this._clearGeometryGesture();
    this._geometryHistory.clear();
    this._devicePositionHistory.clear();
    this._resumeDraftBySpace = {};
    this._tip = null;
    this._hoverRoom = null;
    this._openingInfo = null;
    this._closeInfoCard();
    this._deviceInbox = null;
    this._deviceInboxReturn = null;
    this._markerDialog = null;
    this._physicalDialog = null;
    this._backdropDialog = null;
    this._decorShapeDialog = null;
    this._decorTextDialog = null;
    this._roomDialog = false;
    if (this._spaceDialog?.mode === 'edit') this._spaceDialog = null;
    this._editorSecondary?.closeForNavigation();
    this._saveConfigDebounced.cancel();
    this._frame = null;
    this._planSnapGeometryCache = null;
    this._hiddenWallDiagnosticCache = null;
    this._decorSnapCache = null;
    this._commitSpace('', true);
  }

  private get _areaToSpace(): Record<string, { space: string; room: RoomCfg }> {
    const map: Record<string, { space: string; room: RoomCfg }> = {};
    for (const s of this._model) for (const r of s.rooms) if (r.area) map[r.area] = { space: s.id, room: r };
    return map;
  }

  private get _settings(): ServerConfig['settings'] {
    return this._serverCfg?.settings || {};
  }

  /** LOCAL editor tool (docs/FILTERING.md): show the hidden devices ghosted.
   *  The old toggle wrote settings.show_all — shared state that flipped the
   *  plan for every wall tablet at once. Legacy configs still honour it
   *  through buildDevices until they are seeded. */
  private _showHidden = false;

  private get _showAll(): boolean {
    return this._showHidden || (!this._settings.filter_seeded && !!this._settings.show_all);
  }

  /**
   * The seeder (docs/FILTERING.md): materialise the filter into explicit
   * hidden flags. Runs after every device rebuild on a client that may write;
   * idempotent — a device with ANY marker is never revisited, so an unticked
   * checkbox (a marker with hidden: false) is re-seed protection. Also
   * removes freshly hidden ids from the red-dot list: a dot on an invisible
   * device would wait forever.
   */
  private _seedHiddenDevices(): void {
    if (!this._serverCfg || !this._norm || !this._canEdit) return;
    const cfg = this._serverCfg;
    const bindings = seedHiddenBindings({
      hass: this.hass,
      registry: this._haRegistry,
      areaToSpace: Object.fromEntries(
        Object.entries(this._areaToSpace).map(([a, v]) => [a, v.space]),
      ),
      markers: this._markers,
      settings: this._settings,
      excluded: this._excluded,
      firstSpaceId: this._model[0]?.id || '',
      iconRules: this._iconRules,
    });
    if (!bindings.length && cfg.settings?.filter_seeded) return;
    cfg.markers = cfg.markers || [];
    const hiddenIds: string[] = [];
    for (const b of bindings) {
      const id = 'h' + b.slice(b.indexOf(':') + 1);
      cfg.markers.push({ id, binding: b, hidden: true });
      hiddenIds.push(b.slice(b.indexOf(':') + 1));
    }
    const st = { ...(cfg.settings || {}), filter_seeded: true } as any;
    delete st.show_all; // the shared toggle retires with the runtime filter
    if (hiddenIds.length && Array.isArray(st.new_device_ids)) {
      st.new_device_ids = st.new_device_ids.filter((x: string) => !hiddenIds.includes(x));
    }
    cfg.settings = st;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._saveConfig();
    this.requestUpdate();
  }

  /** Compiled icon rules: instance settings override the built-in defaults. */
  private get _iconRules(): CompiledIconRule[] | undefined {
    const custom = this._settings.icon_rules;
    if (!custom || !Array.isArray(custom) || !custom.length) return undefined;
    const src = JSON.stringify(custom);
    if (src !== this._rulesCompiledSrc) {
      this._rulesCompiledSrc = src;
      this._rulesCompiled = compileIconRules(custom);
    }
    return this._rulesCompiled;
  }

  /** Global fill palette (config.settings.fill_colors over the defaults). */
  private get _fillColors(): FillColors {
    return fillColorsOf(this._settings);
  }

  private get _excluded(): ReadonlySet<string> {
    return effectiveExcludedIntegrations(this._settings); // #44: single resolver
  }

  /** Replace only Area lifecycle settings without invalidating room geometry. */
  private _setAreaLifecycleConfig(next: ServerConfig): void {
    this._cfgEpochPreservedConfig = next;
    this._serverCfg = next;
  }

  protected willUpdate(changed: PropertyValues): void {
    // `_serverCfg` is the root of every geometry cache. Keep the epoch
    // invariant local to that reactive assignment so imports, reconnects and
    // demo harnesses cannot accidentally reuse an older config object's data.
    // #126's provenance/new-device write is the one exact exception: it changes
    // no space input, and rebuilding a 20-room floor here doubled cold work.
    if (changed.has('_serverCfg')) {
      const preserveGeometry = this._cfgEpochPreservedConfig === this._serverCfg;
      this._cfgEpochPreservedConfig = null;
      if (!preserveGeometry) this._cfgEpoch++;
      this._renderLife.invalidate();
    }
    this._syncEmptySpaceState();
    // #417: losing the only renderable space while a decision is pending must
    // settle it before render() clears hp-confirm with `nothing`.
    if (this._dangerConfirm && (
      this._dangerConfirmMissingSpace() || this._syncDangerConfirmLocaleGate() === 'warm'
    )) {
      this._cancelDangerConfirm();
    }
    if (changed.has('hass') && this.hass) {
      const snapshot = this._visibleDeviceSnapshot || this._candidateDeviceSnapshot;
      this._renderLife.observe(changed.get('hass') as HassRenderSnapshot | null | undefined, this.hass,
        snapshot ? { entityIds: snapshot.entityIds } : null, () => intakeHass(this));
    }
    if (this._continuity.hasCompleteFrame && this._continuity.state === 'steady') {
      this._continuity.refreshCompleteFrame(this._visualFrameFingerprint());
    }
    this._captureRenderDeviceSnapshot();
  }
  protected updated(): void {
    this._liveRt?.commit();
    this._editorRuntime?._commitLiveEditor();
    this._pruneDevicePressFeedback();
    this._syncDayCycleClock();
    this._warmSnapshot(); // DEV-B703-03: the memo follows what is on screen
    // Decor selection cannot exist before the lazy editor runtime is ready.
    if (this._editorRuntime) this._dtMeasure();
    const stage = this._stageEl;
    if (stage && !this._roViewport) {
      this._roViewport = new ResizeObserver(() => this._refitView());
      this._roViewport.observe(stage);
    }
    if (stage && this._booting && !this._bootTimer) this._bootWatch();
    // The stage fills the rest of the viewport. What sits above it inside the
    // CARD depends on the mode — the editor bars used to be billed against a
    // hard-coded 118px, so entering an editor pushed the plan down by the
    // difference. Measure our own chrome (stage top relative to the card) and
    // allow a BOUNDED amount for what the dashboard puts above us (HA's
    // toolbar). The first version used the absolute document coordinate here:
    // put anything tall before the card and the "header budget" swallowed the
    // whole viewport, leaving a 0px stage (HP-1500-02). Content above the card
    // is the dashboard's business — it scrolls; it is not header.
    const hdr = this.renderRoot.querySelector('.hdr') as HTMLElement | null;
    if (hdr && stage && !this._roHdr) {
      const measure = () => {
        const card = this.renderRoot.querySelector('ha-card');
        if (!card) return;
        const own = stage.getBoundingClientRect().top - card.getBoundingClientRect().top;
        const above = Math.min(Math.max(card.getBoundingClientRect().top, 0), 120);
        const t = Math.round(own + above);
        // `t` is already an integer. Ignoring a one-pixel delta left the View
        // stage one pixel shorter after an editor collapse and made the fitted
        // viewport drift; changing stage height cannot feed back into its top.
        if (t >= 0 && t !== this._hdrH) this._hdrH = t;
        // DEV-B703-01: chrome that lands after the settle (or a window
        // resize with a live card) must not poison the next warm mount —
        // the memo follows the live settled geometry.
        if (t >= 0 && !this._booting && !this._config?.kiosk && stage.clientHeight > 0) {
          this._warmPatch({ hdrH: t, stageH: stage.clientHeight });
        }
      };
      // a frame later: setting state straight from the observer callback makes
      // the browser report "ResizeObserver loop completed with undelivered
      // notifications" — the render it triggers resizes the stage again
      this._roHdr = new ResizeObserver(() => requestAnimationFrame(measure));
      this._roHdr.observe(hdr);
      this._onWinResize = () => requestAnimationFrame(measure);
      window.addEventListener('resize', this._onWinResize);
      measure();
    }
    if (stage && !this._view) this._refitView();
    this._editorSecondary?.afterRender();
    this._settleContinuityFrame();
    // onboarding: on an empty server config, open the space dialog right away
    if (
      this._serverStorage &&
      this._loadOk &&
      this._model.length === 0 &&
      !this._spaceDialog &&
      !this._importDialog &&
      !this._onboardingShown
    ) {
      this._onboardingShown = true;
      const floors = floorsOf(this.hass);
      if (floors.length) {
        this._importDialog = { floors: floors.map((f) => ({ ...f, checked: true })) };
      } else {
        this._openSpaceDialog('create');
      }
    }
  }

  // ================= server: config + layout =================

  /**
   * Adopt one structural WS candidate by revision + actual content identity.
   * Equal payloads keep their authoritative object references and geometry
   * epoch; equal revisions never hide changed content (#73 §9.4).
   */
  private _adoptConfigCapabilities(response: unknown): void {
    const capabilities = response && typeof response === 'object'
      ? response as Partial<Record<
          'integration_version' | 'support_api' | 'decor_assets_api', unknown
        >> : {};
    this._haIntegrationVersion = typeof capabilities.integration_version === 'string'
      ? capabilities.integration_version : this._haIntegrationVersion;
    const supportApi = capabilities.support_api;
    // Every successful config/get is authoritative. Missing or malformed data
    // after a backend downgrade must revoke a capability learned earlier.
    this._haSupportApi = typeof supportApi === 'number' && Number.isSafeInteger(supportApi)
      ? supportApi : null;
    this._haDecorAssetsApi = capabilities.decor_assets_api === DECOR_ASSETS_API_VERSION
      ? DECOR_ASSETS_API_VERSION : null;
  }

  private async _syncDecorAssets(cfg: ServerConfig | null): Promise<void> {
    const token = ++this._decorAssetSyncToken;
    if (this._haDecorAssetsApi !== DECOR_ASSETS_API_VERSION || !this.hass) {
      this._decorAssets = new Map();
      return;
    }
    const resolved = await resolveDecorAssets(this.hass, decorAssetIds(cfg), this._cfgRev);
    if (token !== this._decorAssetSyncToken) return;
    this._decorAssets = resolved;
    this._resign();
    this.requestUpdate();
  }

  private _adoptStructuralResponses(
    cfgResp: any,
    layResp?: any,
    layoutOverride?: Record<string, any>,
  ): { configChanged: boolean; layoutChanged: boolean } {
    const rawConfig = cfgResp?.config;
    const nextConfig = rawConfig && Array.isArray(rawConfig.spaces)
      ? rawConfig as ServerConfig : null;
    const nextCfgFingerprint = contentFingerprint(nextConfig);
    const configChanged = nextCfgFingerprint !== (this._cfgContentFingerprint
      || contentFingerprint(this._serverCfg));
    if (configChanged) {
      // A genuinely different baseline invalidates local geometry undo. A
      // reconnect echo with identical content deliberately does not.
      this._geometryHistory.clear();
      this._devicePositionHistory.clear();
      this._cancelDeviceDrag();
      this._pendingPhysicalWrites.clear();
      this._clearRoomFocus(true);
      // #82: a new structural baseline owns the viewport. Freeze the last
      // painted camera frame before replacing geometry so an obsolete target
      // cannot settle against the new content frame.
      this._cancelCameraTransition(false);
      if (this._serverCfg) this._clearGeometryGesture();
      this._serverCfg = nextConfig;
      this._seedDecorStyle(this._serverCfg);
      this._cfgContentFingerprint = nextCfgFingerprint;
    }
    this._cfgRev = cfgResp?.rev ?? this._cfgRev;
    if (cfgResp && ('virtual_lights' in cfgResp || 'config' in cfgResp)) {
      const nextVirtualLights = adoptVirtualLightServerSnapshot(
        this._virtualLights,
        cfgResp.virtual_lights,
        this._cfgRev,
        'virtual_lights' in cfgResp,
      );
      if (virtualLightFingerprint(nextVirtualLights)
          !== virtualLightFingerprint(this._virtualLights)) {
        this._virtualLights = nextVirtualLights;
        this._capturedSnapshotVirtual = '';
      }
    }

    let layoutChanged = false;
    if (layResp !== undefined || layoutOverride !== undefined) {
      const nextLayout = layoutOverride ?? layResp?.layout ?? {};
      const nextLayoutFingerprint = contentFingerprint(nextLayout);
      layoutChanged = nextLayoutFingerprint !== (this._layoutContentFingerprint
        || contentFingerprint(this._layout));
      if (layoutChanged) {
        this._cancelCameraTransition(false);
        this._devicePositionHistory.clear();
        this._cancelDeviceDrag();
        this._layout = nextLayout;
        this._layoutContentFingerprint = nextLayoutFingerprint;
      }
      this._layoutRev = layResp?.rev ?? this._layoutRev;
    }

    this._canOptimizeUndo = !!(cfgResp?.can_optimize_undo || layResp?.can_optimize_undo);
    this._adoptConfigCapabilities(cfgResp);
    this._undoKind = (cfgResp?.undo_kind || layResp?.undo_kind || null) as any;
    if (typeof cfgResp?.can_write === 'boolean') this._serverCanWrite = cfgResp.can_write;
    if (configChanged) this._continuity.note('config-candidate', { configRev: this._cfgRev });
    if (layoutChanged) this._continuity.note('layout-candidate', { layoutRev: this._layoutRev });
    return { configChanged, layoutChanged };
  }

  /** Resume only a same-route warm editor intent after permissions arrive.
   * Always enter through _setMode: it owns transition state, contextual tray
   * cleanup and navigation persistence. Direct assignment leaves those
   * surfaces in mutually inconsistent modes. */
  private _resumePendingNavMode(): boolean {
    if (!this._pendingNavMode || !this._canEdit || this._config?.kiosk) return false;
    const pendingMode = this._pendingNavMode;
    this._pendingNavMode = null;
    this._setMode(pendingMode, false);
    return true;
  }

  private async _loadFromServer(): Promise<void> {
    this._loading = true;
    this._loadTries++;
    const visibleSpace = this._space;
    const hadViewport = !!this._view;
    try {
      const [cfgResp, layResp] = await Promise.all([
        this.hass.callWS({ type: 'houseplan/config/get' }),
        this.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      const candidateConfig = cfgResp?.config && Array.isArray(cfgResp.config.spaces)
        ? cfgResp.config : null;
      const structuralChanged = contentFingerprint(candidateConfig)
          !== (this._cfgContentFingerprint || contentFingerprint(this._serverCfg))
        || contentFingerprint(layResp?.layout ?? {})
          !== (this._layoutContentFingerprint || contentFingerprint(this._layout));
      if (structuralChanged) {
        const assetReady = await this._signer.prepareImage(
          this.hass, this._candidateBackdrop(candidateConfig),
        );
        if (!assetReady) {
          this._continuity.note('asset-failed');
          this._scheduleLoadRetry(true);
          return;
        }
      }
      if (structuralChanged && this._continuity.hasCompleteFrame
          && this._continuity.state === 'steady') {
        this._beginContinuityCandidate('structural-response', true);
      }
      this._connectionWasLost = false;
      this._serverStorage = true;
      // absent can_write = older backend / demo stub → keep null (legacy admin fallback)
      if (typeof cfgResp?.can_write === 'boolean') this._serverCanWrite = cfgResp.can_write;
      this._canOptimizeUndo = !!(cfgResp?.can_optimize_undo || layResp?.can_optimize_undo);
      this._adoptStructuralResponses(cfgResp, layResp);
      void this._syncDecorAssets(candidateConfig).catch(() => undefined);
      this._adoptInitialSpace(this._model, true);
      this._resumePendingNavMode();
      this._cacheSnapshot();
      // DEV-B703-03: a warm re-mount already holds the exact viewport of the
      // instance that was thrown away; the centred restore here IS the
      // reported jerk. Only a genuine navigation (the hash/nav landed us on
      // another space) still needs it.
      if (this._warmVpArmed && this._space === this._warmVp?.space) this._warmVpArmed = false;
      else if (!hadViewport || this._space !== visibleSpace) this._restoreZoom();
      this._loadOk = true;
      // Trails and event subscriptions enrich an already complete snapshot.
      // A read-only HA session may reject these; that must never roll the
      // accepted config back into the mandatory load catch.
      void this.hass.callWS({ type: 'houseplan/trail/get' })
        .then((r: any) => { this._vacSrvTrails = r?.trails || {}; this.requestUpdate(); })
        .catch(() => undefined);
      this._ensureLiveSyncSubscriptions();
    } catch (e) {
      if (this._serverCfg) {
        // DEV-B703-02: this instance already RENDERS a valid config (the LS
        // snapshot, or an earlier successful load). A failing socket is a
        // transient condition — nulling _serverCfg here blanked the plan on
        // every reconnect that took more than 8 hass ticks. Stale-while-
        // revalidate: the last valid config stays on screen until a
        // successful reload replaces it, and revalidation keeps running on
        // our own clock (willUpdate stops driving loads after 8 tries).
        this._scheduleLoadRetry(true);
      } else if (this._loadTries >= 8) {
        // nothing was ever shown — genuine no-backend: local-only fallback
        this._serverStorage = false;
        try {
          this._layout = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
        } catch {
          this._layout = {};
        }
      }
      // fewer than 8 tries with nothing shown yet: silently wait for the
      // next hass update (WS warm-up)
    } finally {
      this._loading = false;
      // Readiness belongs to the candidate attempt, including a bounded asset
      // failure. Leaving it false on an early return stranded the controller
      // before its own two-second barrier could ever start.
      this._continuityDataReady = true;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this.requestUpdate();
    }
  }

  /** Best-effort live sync starts only after the initial snapshot is usable. */
  private _ensureLiveSyncSubscriptions(): void {
    const connection = this.hass?.connection;
    if (!connection) return;
    if (connection !== this._liveSyncConnection) {
      this._unsubCfg?.();
      this._unsubCfg = null;
      this._unsubLayout?.();
      this._unsubLayout = null;
      this._unsubTrail?.();
      this._unsubTrail = undefined;
      this._unsubVirtual?.();
      this._unsubVirtual = null;
      this._liveSyncGeneration++;
      this._liveSyncAttempt = null;
      this._liveSyncConnection = connection;
    }
    if (this._liveSyncAttempt) return;
    const generation = this._liveSyncGeneration;
    const attempts: Array<() => Promise<void>> = [];
    const subscribe = (
      current: () => (() => void) | null | undefined,
      adopt: (unsubscribe: () => void) => void,
      event: string,
      callback: (event: any) => void | Promise<void>,
    ): void => {
      if (current()) return;
      attempts.push(async () => {
        const unsubscribe = await connection.subscribeEvents(callback, event);
        const valid = generation === this._liveSyncGeneration
          && this.isConnected && this.hass?.connection === connection && !current();
        if (valid) adopt(unsubscribe);
        else unsubscribe?.();
      });
    };

    subscribe(
      () => this._unsubCfg,
      (unsubscribe) => { this._unsubCfg = unsubscribe; },
      'houseplan_config_updated',
      (ev: any) => {
        // Flush a pending local edit BEFORE adopting a remote revision:
        // otherwise the debounced write reads a config that this reload has
        // already replaced, and the user's edit vanishes (audit L2).
        const observedRev = Number(ev?.data?.rev ?? -1);
        if (observedRev !== this._cfgRev) void this._reloadConfigOnly(false, observedRev);
      },
    );
    subscribe(
      () => this._unsubTrail,
      (unsubscribe) => { this._unsubTrail = unsubscribe; },
      'houseplan_trail_updated',
      async () => {
        try {
          const r: any = await this.hass.callWS({ type: 'houseplan/trail/get' });
          this._vacSrvTrails = r?.trails || {};
          this.requestUpdate();
        } catch { /* transient WS hiccup — the next event retries */ }
      },
    );
    subscribe(
      () => this._unsubLayout,
      (unsubscribe) => { this._unsubLayout = unsubscribe; },
      'houseplan_layout_updated',
      (ev: any) => this._onLayoutEvent(Number(ev?.data?.rev ?? -1)),
    );
    subscribe(
      () => this._unsubVirtual,
      (unsubscribe) => { this._unsubVirtual = unsubscribe; },
      'houseplan_virtual_light_updated',
      (ev: any) => {
        const next = applyVirtualLightEvent(this._virtualLights, ev?.data);
        if (next === this._virtualLights) return;
        this._virtualLights = next;
        this._capturedSnapshotVirtual = '';
        this._cacheSnapshot();
        this.requestUpdate();
      },
    );

    if (!attempts.length) return;
    const task = settleBestEffort(attempts).then(() => undefined);
    this._liveSyncAttempt = task;
    void task.finally(() => {
      if (this._liveSyncAttempt === task) this._liveSyncAttempt = null;
    });
  }

  /**
   * Adopt the server config. Any pending local write is flushed first and, if a
   * write is still in flight, the reload is deferred — adopting a revision on
   * top of an unsent edit is exactly how edits disappeared (audit L2).
   * `force` skips the deferral (conflict path: the local edit already lost).
   */
  private async _reloadConfigOnly(force = false, observedRev?: number): Promise<void> {
    if (!force) {
      // The event can arrive before the response to our own config/set. By the
      // time a pending write settles, its returned revision is current and the
      // queued event is merely an echo. Reloading it would erase the valid
      // session Undo stack after every local command. Revisions are monotonic,
      // so an equal or older observation is safe to ignore.
      if (observedRev !== undefined && observedRev <= this._cfgRev) return;
      if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.flush();
      if (this._cfgWriting) {
        // retry once the in-flight write settles
        clearTimeout(this._reloadRetry);
        this._reloadRetry = window.setTimeout(() => this._reloadConfigOnly(false, observedRev), 400);
        return;
      }
    }
    this._beginContinuityCandidate('config-reload', false);
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/config/get' });
      const candidateConfig = resp?.config && Array.isArray(resp.config.spaces)
        ? resp.config as ServerConfig : null;
      const configChanged = contentFingerprint(candidateConfig)
        !== (this._cfgContentFingerprint || contentFingerprint(this._serverCfg));
      if (configChanged && !await this._signer.prepareImage(
        this.hass, this._candidateBackdrop(candidateConfig),
      )) {
        this._continuity.note('asset-failed');
        this._scheduleLoadRetry(true);
        return;
      }
      const visibleSpace = this._space;
      this._adoptStructuralResponses(resp);
      void this._syncDecorAssets(candidateConfig).catch(() => undefined);
      this._adoptInitialSpace(this._model, true);
      this._resumePendingNavMode();
      this._cacheSnapshot();
      if (this._space !== visibleSpace) this._restoreZoom();
      this._regSignature = '';
      this._maybeRebuildDevices();
      this.requestUpdate();
    } catch (e: any) {
      // a failed reload leaves the card on its last known config; tell the user
      // rather than silently diverging from the server (audit L2 note)
      this._showToast(this._t('toast.cfg_reload_failed', { err: this._errText(e) }));
    } finally {
      this._continuityDataReady = true;
      this.requestUpdate();
    }
  }

  private _reloadRetry?: number;
  /** DEV-B703-02: self-driven revalidation once willUpdate's 8-try budget is
   *  spent — without it a card whose socket died at mount would show the
   *  cached plan forever and never revalidate (hass ticks stop driving loads
   *  after 8 tries). Exponential backoff capped at 8 s; single timer;
   *  cleared on disconnect and on a connection 'ready'. */
  private _loadRetryTimer?: number;
  private _scheduleLoadRetry(force = false): void {
    if (this._loadRetryTimer !== undefined) return;
    const delay = Math.min(8000, 500 * 2 ** Math.min(4, Math.max(1, this._loadTries - 7)));
    this._loadRetryTimer = window.setTimeout(() => {
      this._loadRetryTimer = undefined;
      if ((force || !this._loadOk) && !this._loading && this.hass) this._loadFromServer();
    }, delay);
  }

  /** DEV-B703-02: revalidate the moment the socket comes back. The event
   *  subscriptions (houseplan_config_updated / layout / trail) survive a
   *  reconnect on their own — home-assistant-js-websocket keeps the
   *  Connection object alive and replays its subscription commands on
   *  'ready' — but a LOAD that burned its retry budget while the socket was
   *  down would never run again. 'ready' fires on every (re)connect: reset
   *  the budget and quietly re-read the config. */
  private _connHooked: { removeEventListener?: (t: string, cb: () => void) => void } | null = null;
  private _connectionWasLost = false;
  /** Shared, page-level full HA registry authority (one fetch/subscription per connection). */
  private _haRegistryRelease?: () => void;
  private _haRegistryConnection: any = null;
  private _haRegistryRev = -1;
  private _haBindingCacheKey = '';
  private _planHassMemo: { hass: unknown; sig: string; active: unknown; full: unknown } | null = null;
  private _renderLife = new RenderLifecycle();
  private _liveEditorPaintCount = 0;

  private async _ensureLiveRuntime(): Promise<void> {
    if (this._liveRt) return;
    const module = await import('./live-interaction-runtime');
    this._liveRt = new module.LiveRuntime(this);
    if (this.isConnected) this.requestUpdate();
  }

  private _liveVp(now = false): void { this._liveRt ? this._liveRt.viewport(now) : this.requestUpdate(); }
  private _syncLiveHover(): void { this._liveRt ? this._liveRt.hover() : this.requestUpdate(); }
  /** Bypass live routing so a gesture terminal publishes the last HA frame. */
  private _flushHa(): void { if (this._liveRt?.take()) { this._terminalFrame = 2; super.requestUpdate(); } }
  private _onHaRegistryUpdate = (): void => {
    const snapshot = haRegistrySnapshot(this.hass);
    if (snapshot.revision === this._haRegistryRev && this._devices.length) return;
    this._haRegistryRev = snapshot.revision;
    this._renderLife.invalidate();
    this._planHassMemo = null;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this.requestUpdate();
  };

  private _ensureHaRegistryAuthority(): void {
    const connection = this.hass?.connection || null;
    if (!connection || connection === this._haRegistryConnection) return;
    this._haRegistryRelease?.();
    this._haRegistryConnection = connection;
    this._haRegistryRev = -1;
    this._haBindingCacheKey = '';
    this._renderLife.invalidate();
    this._areaSnapshotCleanupCandidates.clear();
    this._planHassMemo = null;
    this._haRegistryRelease = acquireHaRegistries(this.hass, this._onHaRegistryUpdate);
    this._onHaRegistryUpdate();
  }

  private get _haRegistry(): HaRegistrySnapshot {
    return haRegistrySnapshot(this.hass);
  }

  /** Active-only projection for every plan-level state/data/action consumer. */
  private get _planHass(): any {
    const snapshot = this._haRegistry;
    const sig = haRegistryBuildSignature(this.hass, snapshot);
    const memo = this._planHassMemo;
    if (memo && memo.hass === this.hass && memo.sig === sig) {
      return memo.active;
    }
    const active = activeRegistryHass(this.hass, snapshot);
    const full = fullRegistryHass(this.hass, snapshot);
    this._planHassMemo = { hass: this.hass, sig, active, full };
    return active;
  }

  private _captureRenderDeviceSnapshot(): void {
    if (!this.hass) return;
    const now = Date.now();
    const activity = [...this._activityRt.entries()]
      .map(([id, runtime]) => `${id}:${runtime.gen}:${runtime.flashTs}:`
        + `${runtime.flashKind
          && (runtime.expiresAt || runtime.flashTs + ACTIVITY_WINDOW_MS) > now ? 1 : 0}`)
      .join('|');
    const virtualFingerprint = virtualLightFingerprint(this._virtualLights);
    if (this._capturedSnapshotSequence === this._hassSequence
        && this._capturedSnapshotDevices === this._devices
        && this._capturedSnapshotLayout === this._layout
        && this._capturedSnapshotConfigEpoch === this._cfgEpoch
        && this._capturedSnapshotVirtual === virtualFingerprint
        && this._capturedSnapshotActivity === activity) return;
    const planHass = this._planHass;
    const presentations = new Map<string, ResolvedDevicePresentation>();
    const facts = new Map<string, unknown>();
    const entityIds = new Set<string>(['sun.sun']);
    if (this._vacFit?.source) entityIds.add(this._vacFit.source);
    const deviceIds = new Set<string>();
    const areaIds = new Set<string>();
    const addSource = (source: string | null | undefined): void => {
      if (!source) return;
      const separator = source.indexOf(':');
      if (separator < 0) { entityIds.add(source); return; }
      const kind = source.slice(0, separator), reference = source.slice(separator + 1);
      if (kind === 'device') deviceIds.add(reference);
      else if (kind === 'entity') entityIds.add(reference);
    };
    for (const space of this._model) for (const room of space.rooms) {
      if (room.area) areaIds.add(room.area);
      addSource(room.settings?.temp_source);
      addSource(room.settings?.hum_source);
    }
    for (const rawSpace of this._serverCfg?.spaces || []) for (const opening of rawSpace.openings || []) {
      for (const entityId of openingEntityReferences(opening)) entityIds.add(entityId);
    }
    // Inline HA variables on the decorative layer are part of the painted
    // frame too. Capture both the current token format and the legacy
    // one-entity fields so a reconnect cannot update a label ahead of the
    // rooms, devices and light layers around it.
    for (const rawSpace of this._serverCfg?.spaces || []) {
      for (const shape of rawSpace.decor || []) {
        if (shape.kind !== 'text') continue;
        for (const match of String(shape.text || '').matchAll(/\{([^{}\r\n]+)\}/g)) {
          const reference = liveTextReference(match[1]);
          if (reference?.entity) entityIds.add(reference.entity);
        }
        if (shape.entity) entityIds.add(shape.entity);
        // HA's formatter functions are runtime capabilities and must not cross
        // the immutable render-snapshot boundary. Freeze the already formatted
        // caption instead, so locale/precision/unit and every surrounding plan
        // layer belong to one atomic HA frame.
        facts.set(`decor:${rawSpace.id}:${shape.id}`, liveText(
          shape.text, shape, planHass,
          (entityId) => !!planHass.entities?.[entityId] && !!planHass.states?.[entityId]
            && !isRemovedPlanEntity(planHass, entityId, removedPlanBindings(this._markers)),
        ));
      }
    }
    const planLightSources = resolvedLightSources(
      planHass, this._devices, null, this._virtualLights,
    );
    for (const device of this._devices) {
      for (const showLqi of [false, true]) {
        presentations.set(presentationSnapshotKey(device.id, showLqi), resolveDevicePresentation(
          planHass, device, {
            liveStates: this._config?.live_states !== false,
            showTemperature: this._config?.show_temperature !== false,
            // A per-space show_lqi value is an explicit override of the card
            // default. Snapshot both projections exactly as requested so the
            // full card, preview and static card cannot disagree.
            showSignal: showLqi,
            activityRuntime: this._activityRt.get(device.id),
            sourceDetails: false,
            lightDevices: this._devices,
            lightSources: planLightSources,
            registryHass: this._fullRegistryHass,
            reducedMotion: this._reducedMotion,
          },
        ));
      }
      if (this._isVacDev(device)) {
        const source = this._vacSource(device, planHass);
        const telemetry = source ? readVacTelemetry(planHass?.states?.[source]?.attributes) : null;
        const runtime = this._vacRt.get(device.id);
        // One routing authority per frame: render() must not re-derive which
        // map the robot is on, or two answers become possible (#162).
        const routes = effectiveRoutes(device.id, device.marker?.vacuum ?? null, device.space, source);
        const resolution = resolveRoute({
          routes,
          observed: observedMapIds(routes, [source], (src) => this._vacObservedMapId(device, src, planHass)),
          spaceIds: new Set(this._model.map((space) => space.id)),
        });
        facts.set(`vacuum:${device.id}`, {
          source,
          telemetry,
          routes,
          resolution,
          mapId: telemetry ? this._vacMapId(device, telemetry, planHass) : null,
          runtime: runtime ? {
            trail: runtime.trail,
            lastTs: runtime.lastTs,
            moving: runtime.moving,
            jump: runtime.jump,
          } : null,
          server: this._vacSrvTrails[device.id] || null,
        });
      }
    }
    const snapshot = createRenderDeviceSnapshot({
      sourceSequence: this._hassSequence, hass: planHass,
      devices: this._devices, presentations,
      positions: renderDeviceSnapshotPositions(
        this._model.length > 0,
        this._devices,
        (device) => this._livePos(device),
      ),
      facts,
      entityIds,
      deviceIds,
      areaIds,
    });
    this._capturedSnapshotSequence = this._hassSequence;
    this._capturedSnapshotDevices = this._devices;
    this._capturedSnapshotLayout = this._layout;
    this._capturedSnapshotActivity = activity;
    this._capturedSnapshotConfigEpoch = this._cfgEpoch;
    this._capturedSnapshotVirtual = virtualFingerprint;
    if (!this._visibleDeviceSnapshot || this._continuity.state === 'steady') {
      this._visibleDeviceSnapshot = snapshot;
      this._candidateDeviceSnapshot = null;
    } else {
      this._candidateDeviceSnapshot = snapshot;
    }
  }

  private get _renderDeviceSnapshot(): RenderDeviceSnapshot | null {
    return this._stagedDeviceSnapshotToken === this._continuity.token
      ? this._candidateDeviceSnapshot || this._visibleDeviceSnapshot
      : this._visibleDeviceSnapshot || this._candidateDeviceSnapshot;
  }

  private get _renderPlanHass(): any {
    return this._renderDeviceSnapshot?.hass || this._planHass;
  }

  private get _renderDevices(): readonly DevItem[] {
    return this._renderDeviceSnapshot?.devices || this._devices;
  }

  /** Normal frames reuse the vacuum-only subset captured with their facts. */
  private get _renderVacuumDevices(): readonly DevItem[] {
    return this._renderDeviceSnapshot?.vacuumDevices || this._devices;
  }

  /**
   * Full registry metadata for diagnostics and action safety checks. Entity
   * states/services for actions always come from the active `_planHass`;
   * disabled rows are exposed here only so the resolver can reject/explain.
   */
  private get _fullRegistryHass(): any {
    void this._planHass;
    return this._planHassMemo?.full || this.hass;
  }

  private _bindingStatus(binding: string): HaBindingStatus {
    return resolveHaBindingStatus(this.hass, binding, this._haRegistry);
  }

  /** Redacted client-side support data; no states, names or marker metadata. */
  public houseplanDiagnostics(): {
    registry: ReturnType<typeof haRegistryDiagnostics> & { lastSuccessAgeMs: number | null };
    bindings: Record<HaBindingStatus['kind'], number>;
  } {
    const { registry, bindings } = this._renderLife.diagnostics(
      this.hass, this._markers, (binding) => this._bindingStatus(binding),
    );
    return {
      registry: {
        ...registry,
        lastSuccessAgeMs: registry.lastSuccess
          ? Math.max(0, Date.now() - registry.lastSuccess) : null,
      },
      bindings,
    };
  }

  private _openBindingInHa(binding: string): void {
    const [kind, ref] = binding.split(':');
    if (!ref) return;
    if (kind === 'device') {
      navigate('/config/devices/device/' + encodeURIComponent(ref));
      return;
    }
    if (kind === 'entity') {
      const reg = this._fullRegistryHass.entities?.[ref];
      if (reg?.device_id) {
        navigate('/config/devices/device/' + encodeURIComponent(reg.device_id));
      }
    }
  }

  /** Only device-backed bindings have a stable HA configuration route. */
  private _bindingHasHaPage(binding: string): boolean {
    const [kind, ref] = binding.split(':');
    if (!ref) return false;
    return kind === 'device'
      || (kind === 'entity' && !!this._fullRegistryHass.entities?.[ref]?.device_id);
  }

  private _toggleMarkerDialogVisibility(): void {
    const d = this._markerDialog;
    if (!d) return;
    const status = d.bindingMode === 'ha' ? this._bindingStatus(d.binding) : null;
    const effectivelyHidden = d.hideFromPlan || status?.kind === 'ha_disabled';
    if (effectivelyHidden && status?.kind === 'ha_disabled') {
      this._showToast(this._t(status.reason === 'entity'
        ? 'toast.ha_disabled_show_entity' : 'toast.ha_disabled_show_device'));
      return;
    }
    if (effectivelyHidden && status?.kind === 'unverified') {
      this._showToast(this._t('toast.ha_binding_unverified'));
      return;
    }
    this._markerDialog = { ...d, hideFromPlan: !effectivelyHidden };
  }
  private _onConnReady = (): void => {
    this._loadTries = 0;
    clearTimeout(this._loadRetryTimer);
    this._loadRetryTimer = undefined;
    refreshHaRegistries(this.hass);
    if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.flush();
    if (this._cfgWriting) {
      clearTimeout(this._reloadRetry);
      this._reloadRetry = window.setTimeout(this._onConnReady, 400);
      return;
    }
    if (!this._connectionWasLost && this._continuity.hasCompleteFrame) {
      this._beginContinuityCandidate('connection-ready', false, 'plan');
    } else {
      // A confirmed loss already owns the connection candidate/token.
      this._continuityDataReady = false;
      this._continuityPaintToken = -1;
    }
    if (this._loading) return;
    // Re-read config and layout as one mandatory candidate. Optional live-sync
    // subscriptions are then retried independently for whichever channels are
    // still missing; their rejection cannot invalidate this snapshot.
    // `_loadFromServer` adopts each side by revision+fingerprint and preserves
    // equal references.
    this._loadFromServer();
  };
  private _onConnLost = (): void => {
    if (this._booting && !this._continuity.hasCompleteFrame) return;
    this._connectionWasLost = true;
    this._continuityDataReady = false;
    this._continuityPaintToken = -1;
    this._continuity.connectionLost();
  };
  private _hookConnection(): void {
    const conn = (this.hass as any)?.connection;
    if (!conn || conn === this._connHooked) return;
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    this._connHooked?.removeEventListener?.('disconnected', this._onConnLost);
    this._connHooked?.removeEventListener?.('reconnect-error', this._onConnLost);
    conn.addEventListener?.('ready', this._onConnReady);
    conn.addEventListener?.('disconnected', this._onConnLost);
    conn.addEventListener?.('reconnect-error', this._onConnLost);
    this._connHooked = conn;
  }
  /**
   * Signed urls for the content endpoint (audit follow-up B1 regression).
   * A browser cannot authenticate an <image href> or an <a href>: HA takes a
   * Bearer header or an `authSig` signed path, and an element sends neither.
   * So the card asks the backend to sign what it is about to display.
   */
  private _signer = new ContentSigner(() => this.requestUpdate());

  /** Display url: a signature we hold and still trust, else nothing. */
  private _display(url: string | null | undefined): string {
    return this._signer.display(this.hass, url);
  }

  private _referencedContentUrls(): Set<string> {
    const urls = referencedContentUrls(this._serverCfg);
    for (const asset of this._decorAssets.values()) urls.add(asset.url);
    return urls;
  }

  /** Re-sign what the live config still references (wall tablets outlive one). */
  private _resign(): void {
    this._signer.resign(this.hass, this._referencedContentUrls());
  }

  private _layoutSyncTimer?: number;

  /**
   * A layout revision appeared. It may well be ours: the event travels over the
   * same socket as the reply to our own write and can arrive first, so
   * reacting immediately means re-reading what we just sent — and, worse,
   * racing a drag that has not been flushed yet. Wait a beat; if our own reply
   * lands in the meantime, `_layoutRev` catches up and there is nothing to do.
   */
  private _onLayoutEvent(rev: number): void {
    if (rev <= this._layoutRev) return;
    clearTimeout(this._layoutSyncTimer);
    this._layoutSyncTimer = window.setTimeout(() => {
      if (rev <= this._layoutRev) return; // it was ours after all
      this._reloadLayoutOnly();
    }, 200);
  }

  /**
   * Remember a revision this card produced, so its own `layout_updated` event
   * is not mistaken for someone else's and does not trigger a pointless
   * re-read of what we just wrote.
   */
  private _noteLayoutRev(r: any): void {
    const rev = r?.rev;
    if (typeof rev === 'number' && rev > this._layoutRev) this._layoutRev = rev;
  }

  /**
   * Adopt positions written elsewhere, without dropping our own (HP-1460-03).
   *
   * Only the layout is re-read — the config is untouched, so this cannot
   * disturb an edit in progress. Positions this card has moved but not yet
   * sent are flushed first and then kept on top of the server's answer: a fix
   * for a stale UI must not turn into a lost drag.
   */
  private async _reloadLayoutOnly(): Promise<void> {
    if (!this._serverStorage || !this.hass?.callWS) return;
    this._beginContinuityCandidate('layout-reload', false);
    // Snapshot BEFORE flushing. `flush()` runs the debounced writer
    // synchronously, and the first thing that does is empty `_dirtyPos` — so
    // reading the dirty set afterwards found nothing to protect and the server's
    // older position was painted over the drag the user had just made
    // (HP-1461-02). Positions are captured by value for the same reason.
    const mine = new Map<string, any>();
    for (const id of this._dirtyPos) if (this._layout[id]) mine.set(id, this._layout[id]);
    if (this._persistLayout.pending()) this._persistLayout.flush();
    // …and again after the flush: what was dirty is now in flight, and a write
    // sent before this reload was even scheduled is in there too. Until the
    // server acknowledges a position, this card is the authority on it.
    for (const [id, pos] of this._sentPos) mine.set(id, pos);
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/layout/get' });
      const remote = resp?.layout || {};
      const merged: Record<string, any> = { ...remote };
      for (const [id, pos] of mine) {
        if (pos === null) delete merged[id];
        else merged[id] = pos;
      }
      const fingerprint = contentFingerprint(merged);
      const differsFromCurrent = fingerprint !== contentFingerprint(this._layout);
      if (differsFromCurrent) {
        this._cancelDeviceDrag();
        this._devicePositionHistory.clear();
        this._layout = merged;
      }
      this._layoutContentFingerprint = fingerprint;
      this._layoutRev = resp?.rev ?? this._layoutRev;
      this._canOptimizeUndo = !!resp?.can_optimize_undo;
      this._haIntegrationVersion = typeof resp?.integration_version === 'string'
        ? resp.integration_version : this._haIntegrationVersion;
      this._undoKind = (resp?.undo_kind || null) as any;
      this._cacheSnapshot();
      this.requestUpdate();
    } catch {
      /* a failed refresh just leaves the positions we already had */
    } finally {
      this._continuityDataReady = true;
      this.requestUpdate();
    }
  }

  private _dirtyPos = new Set<string>();
  /** Positions sent to the server and not acknowledged yet (HP-1461-02). */
  private _sentPos = new Map<string, DeviceLayout[string] | null>();

  private _persistLocalLayout(): void {
    this._layout = canonicalizeLayoutGeometry(this._layout);
    localStorage.setItem(LS_KEY, JSON.stringify(this._layout));
  }

  private _persistLayout = debounce(() => {
    if (this._serverStorage) {
      // point-wise updates: do not overwrite positions changed in other windows
      const ids = [...this._dirtyPos];
      this._dirtyPos.clear();
      for (const id of ids) {
        const pos = canonicalizePosition(this._layout[id]);
        if (!pos) continue;
        this._layout = { ...this._layout, [id]: pos };
        // in flight until the server answers: a layout reload triggered in the
        // meantime must keep this position, not the one the server still has
        this._sentPos.set(id, pos);
        this.hass
          .callWS({ type: 'houseplan/layout/update', device_id: id, pos })
          .then((r: any) => this._noteLayoutRev(r))
          .catch((e: any) => this._showToast(this._t('toast.pos_save_failed', { err: this._errText(e) })))
          .finally(() => { if (this._sentPos.get(id) === pos) this._sentPos.delete(id); });
      }
      this._cacheSnapshot();
    } else {
      this._persistLocalLayout();
    }
  }, 600);

  // ================= devices from the registries =================

  private _maybeRebuildDevices(): void {
    const h = this.hass;
    if (!h?.devices || !h?.entities || !h?.areas) return;
    const registry = this._haRegistry;
    const sig =
      haRegistryBuildSignature(h, registry) + ':' + Object.keys(h.areas).length + ':' +
      (this._norm ? 'n' : 'l') + ':' + langOf(h, this._config?.language);
    if (sig === this._regSignature && this._devices.length) return;
    this._regSignature = sig;
    const before = new Map(this._devices.map((d) => [d.id, d.bindingStatus?.kind || 'active']));
    this._devices = buildDevices({
      hass: h,
      registry,
      areaToSpace: Object.fromEntries(
        Object.entries(this._areaToSpace).map(([a, v]) => [a, v.space]),
      ),
      markers: this._markers,
      settings: this._settings,
      excluded: this._excluded,
      showAll: this._showAll,
      firstSpaceId: this._model[0]?.id || '',
      loc: (k) => this._t(k),
      iconRules: this._iconRules,
    });
    const savedBindings = this._markers
      .filter((marker) => !marker.removed && marker.binding !== 'virtual')
      .map((marker) => marker.binding).sort();
    const bindingCacheKey = registry.revision + ':' + savedBindings.join('|');
    if (registry.authoritative && bindingCacheKey !== this._haBindingCacheKey) {
      const statuses = new Map<string, HaBindingStatus>();
      for (const binding of savedBindings) {
        statuses.set(binding, resolveHaBindingStatus(h, binding, registry));
      }
      cacheHaBindingStatuses(statuses);
      this._haBindingCacheKey = bindingCacheKey;
    }
    let areaRelocations: AreaRelocationResolution | null = null;
    if (registry.authoritative) {
      areaRelocations = this._resolveAreaRelocations(registry);
      this._areaRelocationIds = new Set(areaRelocations.relocateIds);
      if (this._areaRelocationIds.size) {
        this._cancelDeviceDrag();
        const relocating = this._areaRelocationIds;
        this._devicePositionHistory.removeWhere(({ before, after }) =>
          relocating.has(before.deviceId) || relocating.has(after.deviceId));
        const dialog = this._markerDialog;
        if (dialog?.devId && !dialog.roomTouched && this._areaRelocationIds.has(dialog.devId)) {
          const current = this._devices.find((device) => device.id === dialog.devId);
          if (current) this._markerDialog = {
            ...dialog,
            room: current.marker?.room_id
              ? `${current.space}#@${current.marker.room_id}`
              : current.space && current.area ? `${current.space}#${current.area}` : '',
          };
        }
      }
    }
    this._defPos = this._defaultPositions();
    this._syncNewDevices();
    this._seedHiddenDevices();
    if (areaRelocations) this._syncAreaRelocations(areaRelocations);
    // Rebuilds also happen without a hass update (marker save/rebind). Establish
    // new baselines and clear old flashes synchronously, before the next paint.
    this._syncActivityRuntime();
    const liveVac = new Set(this._devices.filter((d) => !d.hidden).map((d) => d.id));
    for (const id of this._vacRt.keys()) if (!liveVac.has(id)) this._vacRt.delete(id);
    if (this._infoCard) {
      const current = this._devices.find((d) => d.id === this._infoCard!.id);
      this._infoCard = current && current.bindingStatus?.kind !== 'ha_disabled'
        ? current : null;
    }
    const disabledNow = this._devices.some(
      (d) => d.bindingStatus?.kind === 'ha_disabled' && before.get(d.id) !== 'ha_disabled',
    );
    if (disabledNow) {
      if (this._infoCard?.bindingStatus?.kind === 'ha_disabled'
          || this._devices.find((d) => d.id === this._infoCard?.id)?.bindingStatus?.kind === 'ha_disabled') {
        this._closeInfoCard();
      }
      if (this._deviceDrag
          && this._devices.find((d) => d.id === this._deviceDrag!.id)?.bindingStatus?.kind === 'ha_disabled') {
        this._cancelDeviceDrag();
        this._devicePositionHistory.clear();
      }
      clearTimeout(this._holdTimer);
      this._holdFired = false;
      this._tip = null;
      this._tapConfirm = null;
    }
    if (this._nativeMoreInfoEntity && !this._planEntityAvailable(this._nativeMoreInfoEntity)) {
      fireEvent(this, 'hass-more-info', { entityId: null });
      this._nativeMoreInfoEntity = null;
    }
  }

  /**
   * Join filtered placement decisions with fail-safe registry lifecycle
   * evidence. The two inputs deliberately stay separate: a device that cannot
   * be painted is not thereby absent from Home Assistant.
   */
  private _resolveAreaRelocations(registry = this._haRegistry): AreaRelocationResolution {
    const cleanup = resolveAreaSnapshotCleanup({
      snapshot: this._settings.marker_area_snapshot,
      authoritative: registry.authoritative,
      revision: registry.revision,
      registryDevices: registry.devices,
      registryEntities: registry.entities,
      liveStates: this.hass?.states,
      markers: this._markers,
      previousCandidates: this._areaSnapshotCleanupCandidates,
    });
    this._areaSnapshotCleanupCandidates = cleanup.candidates;
    if (cleanup.needsConfirmationRefresh && this._canEdit) refreshHaRegistries(this.hass);
    return resolveDeviceAreaRelocations({
      devices: this._devices,
      model: this._model,
      layout: this._layout,
      snapshot: this._settings.marker_area_snapshot,
      authoritative: registry.authoritative,
      cleanupSnapshotIds: cleanup.removeIds,
      coordinateScale: NORM_W,
    });
  }

  /**
   * "New device" flag (server-side, shared by every client): an auto device
   * that appears after the known baseline was recorded gets a red dot until
   * someone opens its editor. The baseline is seeded silently on first run,
   * so an upgrade never floods the plan with dots.
   */
  private _syncNewDevices(): void {
    if (!this._norm || !this._loadOk || !this._serverCfg) return;
    // only auto-appearing icons: area devices and light groups; markers are user-made
    const autoIds = this._devices.filter((d) => !d.marker && !d.virtual).map((d) => d.id).sort();
    const key = autoIds.join(',');
    if (key === this._newSyncKey) return; // same registry picture — nothing to do
    this._newSyncKey = key;
    const st: any = this._settings;
    const { fresh, known } = diffNewDevices(autoIds, st.known_devices);
    if (!Array.isArray(st.known_devices) || fresh.length) {
      const newIds = [...new Set([...(st.new_device_ids || []), ...fresh])];
      this._serverCfg = {
        ...this._serverCfg,
        settings: { ...st, known_devices: known, new_device_ids: newIds },
      };
      // best-effort persist: non-admins under admin_only just keep the local view
      this._saveConfig();
    }
  }

  /**
   * Persist authoritative registry-Area transitions without ever letting a
   * stale saved point win between registry paint and server acknowledgement.
   * Layout deletion is deliberately completed before provenance advances.
   */
  private _syncAreaRelocations(resolution: AreaRelocationResolution): void {
    if (!this._serverCfg || !this._norm || !this._canEdit || !this._haRegistry.authoritative) return;
    const actionable = resolution.decisions.filter(
      (decision) => decision.updateSnapshot || decision.removeSnapshot,
    );
    if (!actionable.length) return;
    const key = contentFingerprint({
      snapshot: markerAreaSnapshotOf(this._settings.marker_area_snapshot),
      decisions: actionable,
    });
    if (key === this._areaRelocationSyncKey) return;
    this._areaRelocationSyncKey = key;

    this._areaRelocationWrite = this._areaRelocationWrite.catch(() => undefined).then(async () => {
      if (!this._serverCfg || !this._haRegistry.authoritative) return;
      // The queue may have waited behind another registry/config mutation.
      // Re-resolve at execution time so an explicit room choice or rebind wins.
      const current = this._resolveAreaRelocations();
      this._areaRelocationIds = new Set(current.relocateIds);
      const committed = new Set<string>();
      const deletedPlacements = new Map<string, DevicePlacement>();
      let deleteFailed = false;
      for (const decision of current.decisions) {
        if (!decision.relocate) continue;
        const before = devicePlacement(this._layout, decision.id);
        try {
          await this._persistDevicePlacement(decision.id, null);
          committed.add(decision.id);
          if (before) deletedPlacements.set(decision.id, before);
          this._areaRelocationIds.delete(decision.id);
        } catch (error: unknown) {
          deleteFailed = true;
          this._layout = applyDevicePlacement(this._layout, decision.id, before);
          this._showToast(this._t('toast.pos_save_failed', { err: this._errText(error) }));
        }
      }

      const st = this._settings;
      const nextSnapshot = applyAreaRelocationResolution(
        st.marker_area_snapshot, current, committed,
      );
      const nextAttention = [...new Set([
        ...(Array.isArray(st.new_device_ids) ? st.new_device_ids : []),
        ...committed,
      ])];
      const snapshotChanged = contentFingerprint(nextSnapshot)
        !== contentFingerprint(markerAreaSnapshotOf(st.marker_area_snapshot));
      const attentionChanged = contentFingerprint(nextAttention)
        !== contentFingerprint(Array.isArray(st.new_device_ids) ? st.new_device_ids : []);
      if (snapshotChanged || attentionChanged) {
        const previousSnapshot = st.marker_area_snapshot;
        const previousAttention = st.new_device_ids;
        const nextConfig: ServerConfig = {
          ...this._serverCfg,
          settings: {
            ...st,
            marker_area_snapshot: nextSnapshot,
            ...(attentionChanged ? { new_device_ids: nextAttention } : {}),
          },
        };
        this._setAreaLifecycleConfig(nextConfig);
        try {
          // Await this internal lifecycle write. A debounced fire-and-forget
          // save would leave the local snapshot advanced after a rejection,
          // suppressing the retry required by the delete-first contract.
          // If the registry rebuild was itself triggered by a debounced user
          // mutation, the candidate below already contains that mutation.
          // Cancel its redundant timer so one UI Save remains one transport
          // write (#44) while still sharing the serialized write chain.
          if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.cancel();
          await this._writeConfig();
        } catch (error: unknown) {
          const current = this._settings;
          // Restore only if no newer mutation replaced our exact attempt while
          // the serialized write was in flight.
          if (contentFingerprint(current.marker_area_snapshot)
              === contentFingerprint(nextSnapshot)
              && contentFingerprint(current.new_device_ids)
                === contentFingerprint(attentionChanged ? nextAttention : previousAttention)) {
            const restored = { ...current };
            if (previousSnapshot === undefined) delete restored.marker_area_snapshot;
            else restored.marker_area_snapshot = previousSnapshot;
            if (previousAttention === undefined) delete restored.new_device_ids;
            else restored.new_device_ids = previousAttention;
            const restoredConfig: ServerConfig = { ...this._serverCfg!, settings: restored };
            this._setAreaLifecycleConfig(restoredConfig);
            this._cfgContentFingerprint = contentFingerprint(this._serverCfg);
          }
          // Config and layout are separate stores, but this lifecycle change is
          // one user transaction. A rejected provenance write must put every
          // successfully deleted manual point back before the relocation may
          // retry. Keep the ids pending while restoring so the stale point
          // cannot win the render against the authoritative registry Area.
          for (const id of committed) this._areaRelocationIds.add(id);
          const restoreFailed = new Set<string>();
          for (const [id, placement] of deletedPlacements) {
            try {
              await this._persistDevicePlacement(id, placement);
            } catch (restoreError: unknown) {
              restoreFailed.add(id);
              this._showToast(this._t('toast.pos_save_failed', {
                err: this._errText(restoreError),
              }));
            }
          }
          this._areaRelocationSyncKey = '';
          this._regSignature = '';
          const code = error && typeof error === 'object' && 'code' in error
            ? (error as { code?: unknown }).code : undefined;
          if (code === 'conflict') {
            this._showToast(this._t('toast.conflict'));
            await this._reloadConfigOnly(true);
          } else {
            this._showToast(this._t('toast.cfg_save_failed', { err: this._errText(error) }));
          }
          if (restoreFailed.size && this._serverCfg) {
            const attentionSettings = this._settings;
            const attention = [...new Set([
              ...(Array.isArray(attentionSettings.new_device_ids)
                ? attentionSettings.new_device_ids : []),
              ...restoreFailed,
            ])];
            const attentionConfig: ServerConfig = {
              ...this._serverCfg,
              settings: { ...attentionSettings, new_device_ids: attention },
            };
            this._setAreaLifecycleConfig(attentionConfig);
            try {
              await this._writeConfig();
            } catch (attentionError: unknown) {
              this._showToast(this._t('toast.cfg_save_failed', {
                err: this._errText(attentionError),
              }));
            }
          }
        }
      }
      if (deleteFailed) this._areaRelocationSyncKey = '';
      this.requestUpdate();
    });
  }

  /** Ids currently flagged as new (drawn with the red dot). */
  private get _newIds(): Set<string> {
    const list = this._settings.new_device_ids;
    return new Set([...(Array.isArray(list) ? list : []), ...this._areaRelocationIds]);
  }

  /** First visit to the device's editor acknowledges its "new" flag. */
  private _ackNewDevice(id: string): void {
    if (!this._newIds.has(id) || !this._serverCfg) return;
    const st: any = this._settings;
    this._serverCfg = {
      ...this._serverCfg,
      settings: { ...st, new_device_ids: (st.new_device_ids || []).filter((x: string) => x !== id) },
    };
    this._saveConfig();
    this.requestUpdate();
  }

  /** Filtering + light groups + overrides + virtual devices. */
  private get _markers(): Marker[] {
    return this._serverCfg?.markers || [];
  }

  private _roomLqi(area: string | null): number | null {
    if (!area) return null;
    const vals: number[] = [];
    for (const d of this._renderDevices) {
      if (d.area !== area || d.virtual) continue;
      const l = lqiFor(this._renderPlanHass, d.entities);
      if (l != null) vals.push(l);
    }
    return averageLqi(vals);
  }

  // ================= positions =================

  /** Bounding rectangle of a room (rect or polygon) in render units. */
  private _roomBounds(r: RoomCfg): { x: number; y: number; w: number; h: number } {
    if (r.poly && r.poly.length) {
      const xs = r.poly.map((p) => p[0]);
      const ys = r.poly.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    return { x: r.x ?? 0, y: r.y ?? 0, w: r.w ?? 0, h: r.h ?? 0 };
  }

  private _defaultPositions(): Record<string, { x: number; y: number }> {
    const map: Record<string, { x: number; y: number }> = {};
    const iconPct = this._config?.icon_size ?? 2.5;
    for (const s of this._model) {
      // docs/CANVAS.md §6: the icon's RENDER-unit footprint follows the plan's
      // own size — NORM_W for anything inside the old square (identical to
      // before), proportionally more for a plan several canvases wide.
      const minDist = (iconPct / 100) * iconUnit(s) * 1.3;
      for (const r of s.rooms) {
        if (!r.area) continue;
        // HA-disabled saved markers stay in the roster: they render nowhere
        // outside the service ghost, but reserve their old auto-grid slot so
        // temporary deactivation cannot shuffle visible neighbours.
        const ds = this._devices.filter((d) => d.area === r.area && d.space === s.id);
        if (!ds.length) continue;
        const b = this._roomBounds(r);
        const pad = Math.min(b.w, b.h) * 0.1;
        const iw = b.w - pad * 2;
        const ih = b.h - pad * 2;
        const cols = Math.max(1, Math.round(Math.sqrt((ds.length * iw) / Math.max(ih, 1))));
        const rows = Math.ceil(ds.length / cols);
        const cw = iw / cols;
        const ch = ih / Math.max(rows, 1);
        const pts = ds.map((_, i) => ({
          x: b.x + pad + cw * ((i % cols) + 0.5),
          y: b.y + pad + ch * (Math.floor(i / cols) + 0.5),
        }));
        declump(pts, b, minDist, pad * 0.5);
        // an auto-placed icon lands on a node too (docs/CANVAS.md §9) — the
        // owner's "everything on the grid" covers what the card places itself
        ds.forEach((d, i) => (map[d.id] = snapPt(pts[i])));
      }
    }
    return map;
  }

  /** Device position in render units of the current space. */
  private _pos(d: DevItem): { x: number; y: number } {
    const captured = this._renderDeviceSnapshot?.positions.get(d.id);
    return captured ? { x: captured.x, y: captured.y } : this._livePos(d);
  }

  private _livePos(d: DevItem): { x: number; y: number } {
    const s = this._spaceModelById(d.space);
    const saved = this._areaRelocationIds.has(d.id) ? undefined : this._layout[d.id];
    if (saved) {
      if (this._norm) {
        if (saved.s === d.space) {
          return { x: saved.x * NORM_W, y: saved.y * NORM_W };
        }
      } else if (saved.s === undefined) {
        return { x: saved.x, y: saved.y };
      }
    }
    if (this._defPos[d.id]) return this._defPos[d.id];
    if (!s) return { x: NORM_W / 2, y: NORM_W / 2 };
    // the middle of what IS drawn, not of a canvas that has no edges any more
    return snapPt(spaceCenter(s));
  }

  private _devicePlacementForCanvas(d: DevItem, x: number, y: number): DevicePlacement {
    if (!this._norm) return { x: Math.round(x), y: Math.round(y) };
    const g = this._gridPitch;
    const gx = Math.round(x / g) * g;
    const gy = Math.round(y / g) * g;
    return {
      s: d.space,
      x: clampCanvasN(gx / NORM_W),
      y: clampCanvasN(gy / NORM_W),
    };
  }

  private _previewDevicePlacement(deviceId: string, placement: DevicePlacement | null): void {
    this._layout = applyDevicePlacement(this._layout, deviceId, placement);
    this.requestUpdate();
  }

  /** Abort an uncommitted device preview. Returns true when a drag existed. */
  private _cancelDeviceDrag(): boolean {
    const drag = this._deviceDrag;
    if (!drag) return false;
    this._editorRuntime?._cancelPointerMove('device');
    this._deviceDrag = null;
    try {
      if (drag.source?.hasPointerCapture?.(drag.pointerId)) {
        drag.source.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // Pointer capture may already have ended before the cancellation signal.
    }
    this._previewDevicePlacement(drag.id, drag.before);
    return true;
  }

  /** One serial, point-wise position write used by drag commit and history. */
  private async _persistDevicePlacement(
    deviceId: string,
    placement: DevicePlacement | null,
  ): Promise<void> {
    this._layout = applyDevicePlacement(this._layout, deviceId, placement);
    if (this._serverStorage) {
      let pending: DeviceLayout[string] | null = null;
      let registered = false;
      try {
        let response: unknown;
        if (placement === null) {
          pending = null;
          this._sentPos.set(deviceId, pending);
          registered = true;
          response = await this.hass.callWS({
            type: 'houseplan/layout/delete', device_id: deviceId,
          });
        } else {
          // #397: keep locally exactly what goes on the wire, or the card's
          // own echo reads as a remote edit and wipes the undo stack.
          const pos = canonicalizePosition(this._layout[deviceId]);
          if (contentFingerprint(pos) !== contentFingerprint(this._layout[deviceId])) {
            this._layout = { ...this._layout, [deviceId]: pos };
          }
          pending = pos;
          this._sentPos.set(deviceId, pending);
          registered = true;
          response = await this.hass.callWS({
            type: 'houseplan/layout/update', device_id: deviceId, pos,
          });
        }
        this._noteLayoutRev(response);
        this._layoutContentFingerprint = contentFingerprint(this._layout);
        this._cacheSnapshot();
      } finally {
        if (registered && this._sentPos.get(deviceId) === pending) this._sentPos.delete(deviceId);
      }
      return;
    }
    this._persistLocalLayout();
  }

  private _devicePositionStateValid(state: DevicePositionState): boolean {
    const device = this._devices.find((candidate) => candidate.id === state.deviceId);
    return !!device
      && device.space === state.spaceId
      && device.bindingStatus?.kind !== 'ha_disabled'
      && !!this._spaceModelById(state.spaceId);
  }

  private async _runDevicePositionHistory(direction: 'undo' | 'redo'): Promise<void> {
    if (this._cancelDeviceDrag() || this._devicePositionBusy) return;
    const command = direction === 'undo'
      ? this._devicePositionHistory.undo()
      : this._devicePositionHistory.redo();
    if (!command) return;
    const target = direction === 'undo' ? command.before : command.after;
    if (!this._devicePositionStateValid(target)) {
      this._devicePositionHistory.clear();
      this._showToast(this._t('history.device_stale'));
      this.requestUpdate();
      return;
    }

    const rollback = devicePlacement(this._layout, target.deviceId);
    if (target.spaceId !== this._space) {
      this._commitSpace(target.spaceId);
      this._restoreZoom();
    }
    this._devicePositionBusy = true;
    this._previewDevicePlacement(target.deviceId, target.placement);
    try {
      await this._persistDevicePlacement(target.deviceId, target.placement);
      this._showToast(this._t(direction === 'undo' ? 'history.undone' : 'history.redone', {
        name: command.name,
      }));
    } catch (error: unknown) {
      this._previewDevicePlacement(target.deviceId, rollback);
      if (direction === 'undo') this._devicePositionHistory.redo();
      else this._devicePositionHistory.undo();
      this._showToast(this._t('toast.pos_save_failed', { err: this._errText(error) }));
    } finally {
      this._devicePositionBusy = false;
      this.requestUpdate();
    }
  }

  private _undoDevicePosition(): void {
    void this._runDevicePositionHistory('undo');
  }

  private _redoDevicePosition(): void {
    void this._runDevicePositionHistory('redo');
  }

  private _savePos(d: DevItem, x: number, y: number): void {
    if (!this._spaceModelById(d.space)) return;
    this._layout = applyDevicePlacement(
      this._layout, d.id, this._devicePlacementForCanvas(d, x, y),
    );
    this._dirtyPos.add(d.id);
    this._persistLayout();
  }

  // ================= live states =================

  /** One semantic projection consumed by the plan, preview and static card. */
  private _devicePresentation(
    d: DevItem, showLqi = this._config?.show_signal !== false, designPreview = false,
  ): ResolvedDevicePresentation {
    const captured = !designPreview
      ? this._renderDeviceSnapshot?.presentations.get(presentationSnapshotKey(d.id, showLqi))
      : null;
    if (captured) return captured;
    return resolveDevicePresentation(this._renderPlanHass, d, {
      liveStates: this._config?.live_states !== false,
      showTemperature: this._config?.show_temperature !== false,
      showSignal: showLqi,
      designPreview,
      activityRuntime: this._activityRt.get(d.id),
      sourceDetails: false,
      lightDevices: this._renderDevices,
      registryHass: this._fullRegistryHass,
      reducedMotion: this._reducedMotion,
    });
  }

  /** One semantic result feeds the plate and every non-critical activity effect. */
  private _deviceVisual(d: DevItem): DeviceVisualState {
    return this._devicePresentation(d).visual;
  }

  /** CSS classes retained behind the old helper name for smoke/debug callers. */
  private _stateClass(d: DevItem, visual = this._deviceVisual(d)): string {
    const presentation = this._devicePresentation(d);
    if (presentation.effectiveHidden) return '';
    const activity = presentation.display === 'icon_ripple'
      && this._config?.live_states !== false && visual.status !== 'alarm'
      ? visual.activity : 'none';
    return presentationClasses({ ...presentation, visual, activity }).join(' ');
  }

  private _liveTemp(d: DevItem): number | null {
    if (!this._config?.show_temperature) return null;
    // Opt-in climate source (marker.use_climate_temp): the AC/thermostat's
    // current_temperature gets the same badge a thermometer has. No valid
    // reading (missing attribute, unavailable) -> no badge at all.
    if (d.marker?.use_climate_temp === true) {
      const t = climateTempFor(this._renderPlanHass, d.entities);
      if (t != null) return t;
    }
    if (d.icon !== 'mdi:thermometer' && d.icon !== 'mdi:air-filter') return null;
    return tempFor(this._renderPlanHass, d.entities);
  }

  /** Every HA entity owned by a dialog binding. */
  private _bindingEntities(binding: string): string[] {
    if (binding === 'virtual' || !binding) return [];
    const status = this._bindingStatus(binding);
    return status.kind === 'active' ? status.enabledEntityIds : status.allEntityIds;
  }

  /** Does the dialog's binding carry a climate entity? Gates the opt-in checkbox. */
  private _bindingHasClimate(binding: string): boolean {
    return this._bindingEntities(binding).some((eid) => eid.startsWith('climate.'));
  }

  /** Static display can deliberately hide this binding's alarm indication. */
  private _bindingHasAlarm(binding: string): boolean {
    return this._bindingEntities(binding).some((eid) => {
      const state = this._planHass?.states?.[eid] || this.hass?.states?.[eid];
      const registry = this._fullRegistryHass.entities[eid] || this.hass?.entities?.[eid];
      return isAlarmCapable(
        eid.split('.')[0],
        state?.attributes?.device_class
          || registry?.device_class
          || registry?.original_device_class,
      );
    });
  }

  // ================= interaction =================

  private _deviceBindingActive(d: DevItem, notify = true): boolean {
    if (d.virtual || d.bindingKind === 'virtual') return true;
    if (!d.bindingKind || !d.bindingRef) return false;
    const status = this._bindingStatus(`${d.bindingKind}:${d.bindingRef}`);
    if (status.kind === 'active') return true;
    if (notify) {
      this._showToast(this._t(status.kind === 'ha_disabled'
        ? 'toast.ha_disabled_action' : 'toast.ha_binding_unverified'));
    }
    return false;
  }

  private _openMoreInfo(entityId?: string): void {
    if (!entityId) {
      this._showToast(this._t('toast.no_entity'));
      return;
    }
    if (!this._planEntityAvailable(entityId)) {
      this._showToast(this._t('toast.ha_disabled_action'));
      return;
    }
    this._nativeMoreInfoEntity = entityId;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  /**
   * A modal opened while a view pointer is still down interrupts the stage's
   * normal pointerup lifecycle. Drop every navigation anchor immediately and
   * release capture defensively, even though the current view path does not
   * normally request it. This is intentionally separate from editor geometry.
   */
  private _interruptViewGesture(pointerId?: number, source?: Element | null): void {
    clearTimeout(this._holdTimer);
    clearTimeout(this._kioskHoldTimer);
    if (pointerId !== undefined) {
      for (const element of [source, this._stageEl]) {
        try {
          if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
        } catch {
          /* Pointer ownership may already have moved to the modal. */
        }
      }
    }
    this._pointers.clear();
    this._panStart = null;
    this._panLock = null;
    this._pinchStart = null;
    this._swipeStart = null;
    this._roomPointer = null;
    this._doubleFit.clear();
  }

  /** Close the device card and make stale long-press state non-observable. */
  private _closeInfoCard(): void {
    this._interruptViewGesture();
    this._holdFired = false;
    this._infoCard = null;
  }

  /** Right click in VIEW mode always opens HA's more-info (owner's decision). */
  private _ctxDevice(ev: MouseEvent, d: DevItem): void {
    if (this._mode !== 'view') return; // editors keep the native context menu
    ev.preventDefault();
    ev.stopPropagation();
    if (!this._deviceBindingActive(d)) return;
    if (d.primary) this._openMoreInfo(d.primary);
    else this._infoCard = d;
  }

  private _clickDevice(ev: Event, d: DevItem): void {
    // Devices are passive landmarks in Plan/Background. Guard before stopping
    // propagation so a Background tool still owns the same canvas point even
    // if a future CSS change accidentally makes a marker a hit target again.
    if (this._mode !== 'view' && this._mode !== 'devices') return;
    ev.stopPropagation();
    if (this._deviceDrag?.moved || this._suppressClick || this._holdFired) return;
    if (this._mode === 'devices') {
      this._openMarkerDialog(d);
      return;
    }
    // The renderer may deliberately keep an older, complete visual snapshot
    // on screen while a new HA/config frame is being committed (#73). Actions
    // must never inherit that visual staleness: resolve the current DevItem by
    // stable marker id before reading tap_action, controls or the binding.
    const actionDevice = this._devices.find((item) => item.id === d.id);
    if (!actionDevice) return; // marker disappeared from the live config
    const action = projectedTapAction(
      actionDevice.tapAction, actionDevice.primary?.split('.')[0],
    );
    // An explicit no-op still owns the click: propagation was stopped and the
    // current marker was resolved, but no capability, feedback or UI path runs.
    if (action === 'none') return;
    // the accidental-tap guard (owner's spec 2026-07-29): any state-changing
    // action — toggle or run — may ask first. The dialog is ours, not the
    // native browser prompts, so it works and looks right on a wall tablet.
    const guarded = (text: string, exec: () => void): void => {
      if (actionDevice.marker?.tap_confirm) this._tapConfirm = { kind: 'run', text, exec };
      else exec();
    };
    if (action === 'toggle') {
      const initial = this._toggleIntent(actionDevice);
      if (!initial) return;
      if (!toggleOperation(initial)) {
        this._showUnavailableToggleTargets(initial);
        return; // other configured no-target outcomes remain intentional quiet no-ops
      }
      const execute = (intent: ResolvedToggleIntent): void => {
        const operation = toggleOperation(intent);
        if (!operation) return;
        if (operation.kind === 'virtual-light') {
          this._startDevicePressFeedback(actionDevice.id);
          this.hass.callWS({
            type: 'houseplan/virtual_light/toggle',
            marker_id: operation.markerId,
          }).then((result: any) => {
            const next = applyVirtualLightEvent(this._virtualLights, result);
            if (next === this._virtualLights) return;
            this._virtualLights = next;
            this._capturedSnapshotVirtual = '';
            this._cacheSnapshot();
            this.requestUpdate();
          }).catch((e: any) => this._showToast(this._t(
            'toast.virtual_light_toggle_failed', { err: this._errText(e) },
          )));
          return;
        }
        const { command } = operation;
        this._startDevicePressFeedback(actionDevice.id);
        this.hass.callService(command.domain, command.service, command.data)
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      };
      const name = toggleIntentName(initial) || actionDevice.name;
      if (actionDevice.marker?.tap_confirm) {
        const lines = this._toggleConfirmationLines(initial);
        if (!lines.length) return;
        this._tapConfirm = {
          kind: 'toggle',
          text: this._t('confirm.tap_toggle', { name }),
          lines,
          initialIntent: initial,
          deviceId: actionDevice.id,
          exec: () => {
            const currentDevice = this._devices.find((item) => item.id === actionDevice.id);
            const current = currentDevice ? this._toggleIntent(currentDevice) : null;
            if (current && !toggleOperation(current)
                && this._showUnavailableToggleTargets(current)) return;
            if (!current || !sameToggleOperationTargets(initial, current)) {
              this._showToast(this._t('toast.tap_target_changed'));
              return;
            }
            execute(current); // current state decides the current direction
          },
        };
      } else execute(initial);
      return;
    }
    // The House Plan device card is a local informational surface built from
    // the DevItem that is already on screen. It does not call an HA service
    // and must not disappear behind a second, momentary registry-status check
    // (notably on compound cover/curtain devices). HA-backed actions below
    // keep the active-binding gate. Closing the stage gesture first also
    // prevents a pending pan/long-press lifecycle from swallowing the modal.
    if (action === 'info') {
      this._interruptViewGesture();
      this._infoCard = actionDevice;
      return;
    }
    if (!this._deviceBindingActive(actionDevice)) return;
    if (action === 'run') {
      const target = actionDevice.marker?.tap_target || '';
      const svc = runServiceFor(target);
      const st = this.hass.states[target];
      if (!svc || !st) {
        this._showToast(this._t('toast.run_target_missing'));
        return;
      }
      const name = st.attributes?.friendly_name || target;
      guarded(this._t('confirm.tap_run', { name }), () => {
        if (!this._deviceBindingActive(actionDevice) || !this._planEntityAvailable(target)) return;
        this._startDevicePressFeedback(actionDevice.id);
        this.hass
          .callService(svc.domain, svc.service, { entity_id: target })
          .then(() => {
            this._stampActivity(
              actionDevice.id, 'event', this._activitySourceKey(actionDevice),
            );
            this.requestUpdate();
            this._showToast(this._t('toast.run_started', { name }));
          })
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    if (action === 'more-info' && actionDevice.primary) {
      this._openMoreInfo(actionDevice.primary);
      return;
    }
    this._infoCard = actionDevice;
  }

  /** Explain a safe controls no-op through the card's standard local toast. */
  private _showUnavailableToggleTargets(intent: ResolvedToggleIntent): boolean {
    const names = unavailableToggleTargetNames(intent);
    if (!names.length) return false;
    this._showToast(names.length === 1
      ? this._t('toast.toggle_target_unavailable', { name: names[0] })
      : this._t('toast.toggle_targets_unavailable', { names: names.join(', ') }));
    return true;
  }

  private _keyDevice(ev: KeyboardEvent, d: DevItem): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    if (this._mode !== 'view' && this._mode !== 'devices') return;
    ev.preventDefault();
    this._clickDevice(ev, d);
  }

  /** One retargetable visual acknowledgement owned by actual action dispatch. */
  private _startDevicePressFeedback(markerId: string): void {
    const marker = [...this.renderRoot.querySelectorAll<HTMLElement>('.dev[data-id]')]
      .find((candidate) => candidate.dataset.id === markerId);
    const body = marker?.querySelector<HTMLElement>('.device-shell');
    if (!body || typeof body.animate !== 'function') return;
    const paintedScale = Number.parseFloat(
      this.ownerDocument.defaultView?.getComputedStyle(body).scale || '',
    );
    const restartScale = Number.isFinite(paintedScale)
      ? Math.max(0.95, Math.min(1, paintedScale))
      : 1;
    this._devicePressAnimations.get(markerId)?.cancel();
    const frames: Keyframe[] = this._reducedMotion
      ? [
          { outlineColor: 'transparent', outlineStyle: 'solid', outlineWidth: '0px' },
          {
            outlineColor: 'var(--hp-accent, #3ea6ff)', outlineStyle: 'solid',
            outlineWidth: '2px', outlineOffset: '2px', offset: 0.5,
          },
          { outlineColor: 'transparent', outlineStyle: 'solid', outlineWidth: '0px' },
        ]
      : [
          { scale: String(restartScale) },
          { scale: '0.95', offset: 0.5 },
          { scale: '1' },
        ];
    const animation = body.animate(frames, {
      duration: 200,
      easing: 'cubic-bezier(.22,.61,.36,1)',
    });
    this._devicePressAnimations.set(markerId, animation);
    const clear = (): void => {
      if (this._devicePressAnimations.get(markerId) === animation) {
        this._devicePressAnimations.delete(markerId);
      }
    };
    animation.addEventListener('finish', clear, { once: true });
    animation.addEventListener('cancel', clear, { once: true });
  }

  private _cancelDevicePressFeedback(): void {
    for (const animation of this._devicePressAnimations.values()) animation.cancel();
    this._devicePressAnimations.clear();
  }

  private _pruneDevicePressFeedback(): void {
    if (!this._devicePressAnimations.size) return;
    const visible = new Set(
      [...this.renderRoot.querySelectorAll<HTMLElement>('.dev[data-id]')]
        .map((marker) => marker.dataset.id || ''),
    );
    for (const [markerId, animation] of this._devicePressAnimations) {
      if (visible.has(markerId)) continue;
      animation.cancel();
      this._devicePressAnimations.delete(markerId);
    }
  }

  /** Translate a key in the card's current language. */
  private _t(key: I18nKey, vars?: Record<string, string | number>): string {
    return t(langOf(this.hass, this._config?.language), key, vars);
  }

  /** Per-card copy keeps presentation-only pickers independent across languages. */
  private get _colorPickerLabels(): ColorPickerLabels {
    return {
      title: this._t('color_picker.title'),
      hue: this._t('color_picker.hue'),
      saturation: this._t('color_picker.saturation'),
      value: this._t('color_picker.value'),
      hex: this._t('color_picker.hex'),
      invalidHex: this._t('color_picker.invalid_hex'),
    };
  }

  /** Localize both parts of a help affordance while hp-help stays presentation-only. */
  private _help(key: Extract<I18nKey, `${string}.help`>): TemplateResult | typeof nothing {
    return this._editorRuntimeOrThrow()._help(key);
  }

  private get _stageEl(): HTMLElement | null {
    return this.renderRoot.querySelector('.stage') as HTMLElement | null;
  }

  /**
   * Everything of the current space that counts as CONTENT, one item per
   * object (docs/CANVAS.md §4): rooms and the backdrop image come from the
   * model, openings/decor/devices are added here because the model does not
   * carry them. Devices use their RESOLVED position, so a marker parked in
   * the far corner of the yard frames with the rest.
   *
   * HIDDEN devices are NOT content (DEV-2C947-01): the frame is presentation,
   * and a device the plan does not draw must not decide what the plan opens
   * on — hiding a marker that once wandered into the yard used to leave the
   * house a dot in the corner of an empty frame. They keep counting for room
   * LQI/climate and they keep their auto-grid cell (docs/FILTERING.md); only
   * the frame stops seeing them, including the ghosts of the device editor,
   * whose reach is the pan slack's job, not the opening view's.
   */
  private _contentItems(m: SpaceModel): ContentItem[] {
    const extra: ContentItem[] = [];
    for (const d of this._devices) {
      if (d.space !== m.id || d.hidden) continue;
      const p = this._pos(d);
      extra.push({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });
    }
    if (m.id === this._space) {
      for (const o of this._openingsR) {
        const rad = (Number(o.angle) * Math.PI) / 180;
        const dx = (Math.cos(rad) * o.rlen) / 2, dy = (Math.sin(rad) * o.rlen) / 2;
        const it = itemOf([[o.rx - dx, o.ry - dy], [o.rx + dx, o.ry + dy]]);
        if (it) extra.push(it);
      }
      const H = this._decorH;
      for (const x of this._decorList) {
        // Missing image assets are intentionally invisible in View. Their
        // geometry still participates while Background is open, where the
        // bounded repair placeholder is actually painted and selectable.
        if (x.kind === 'image' && !this._decorAssets.has(x.asset_id)
            && this._mode !== 'decor') continue;
        const pts = x.kind === 'line'
          ? [[x.x1 * NORM_W, x.y1 * H], [x.x2 * NORM_W, x.y2 * H]]
          : x.kind === 'text'
            ? [[x.x * NORM_W, x.y * H]]
            : boxCorners({ x: x.x * NORM_W, y: x.y * H, w: x.w * NORM_W,
                h: x.h * H, angle: x.angle });
        const it = itemOf(pts);
        if (it) extra.push(it);
      }
      // Independent physical geometry participates in content bounds even
      // outside room paper. Each body is one bounded object, never a vote made
      // only by its centre point.
      for (const body of this._physicalBodiesR(m)) {
        const it = itemOf(body);
        if (it) extra.push(it);
      }
    }
    return contentItems(m, extra);
  }

  /**
   * The content frame of the current space, memoised (docs/CANVAS.md §4).
   *
   * In VIEW mode it follows the config: adding a device out in the yard
   * widens what "fit" means. Inside an EDITOR it only ever GROWS — the frame
   * bounds pan and the meaning of zoom 1, and a frame that shrank the moment
   * you deleted a room would move the ground under a drag. It never bounds
   * where you may DRAW: §5 pan slack plus 3x zoom-out is far more room than
   * the old square ever gave (that is what HP-1490-03 needed).
   */
  private _frame:
    | { id: string; model: SpaceModel; layout: unknown; devs: unknown; far: boolean;
        grow: boolean; rect: Rect; all: Rect; outliers: number }
    | null = null;
  /** The outlier hint's «Показать» is on: the frame takes in the far strays
   *  too, so zoom, pan and the fit button all agree about what "everything"
   *  is. Reset when the space changes (docs/CANVAS.md §4.1). */
  private _showFar = false;

  private _frameOf(): { rect: Rect; all: Rect; outliers: number } {
    const m = this._spaceModel();
    if (!m) {
      this._frame = null;
      const fallback = { x: 0, y: 0, w: NORM_W, h: NORM_W };
      return { rect: fallback, all: fallback, outliers: 0 };
    }
    // Memo by IDENTITY, not by an epoch counter: `_model`, `_layout` and
    // `_devices` are all replaced (never mutated in place) whenever their
    // content changes, so this catches a marker drag and a server push alike —
    // an epoch would have to be bumped at every one of those call sites.
    const f = this._frame;
    // `grow` is part of the KEY, not just of the computation (DEV-2C947-02):
    // the union an editor accumulated is an editor's frame, and leaving for
    // View has to recompute rather than inherit it — otherwise a room moved
    // far away in the Plan editor kept View framing the empty ground it left
    // behind, until some unrelated model change happened to invalidate memo.
    const grow = this._mode !== 'view';
    // A LIVE BACKDROP GESTURE FREEZES THE FRAME (docs/BACKDROP.md §2). The
    // picture is a content item, so dragging it grows the frame — which
    // rescales the view, which changes how many plan units a screen pixel is
    // worth, mid-gesture: the picture then runs away from the finger and no
    // drag lands where it was aimed. The frame catches up on release.
    if (f && f.id === m.id && this._bdDrag) return f;
    if (f && f.id === m.id && f.model === m && f.layout === this._layout
        && f.devs === this._devices && f.far === this._showFar && f.grow === grow) return f;
    const cf = contentFrame(this._contentItems(m));
    let all = cf.all || spaceFrame(m);
    let rect = this._showFar ? all : (cf.core || spaceFrame(m));
    if (f && f.id === m.id && grow && f.grow) {
      // Inside an editor the frame only GROWS: it bounds pan and defines what
      // zoom 1 means, and a frame that shrank the instant a room was deleted
      // would move the ground under the pointer mid-gesture. Only ever unions
      // with a frame the SAME editor session produced (f.grow).
      rect = unionRect(f.rect, rect);
      all = unionRect(f.all, all);
    }
    this._frame = {
      id: m.id, model: m, layout: this._layout, devs: this._devices,
      far: this._showFar, grow, rect, all, outliers: cf.outliers,
    };
    return this._frame;
  }

  /** The rectangle "fit to screen" fits — always the content (docs/CANVAS.md). */
  private _isoSource(): { key: string; build: () => {
    walls: any;
    floor: any;
    openings: readonly IsoOpeningBasis[];
  } } | null {
    const space = this._spaceModel();
    if (!space) return null;
    const walls = this._spaceWalls;
    const openCuts = this._openCuts();
    const openings = this._openingsR.map((opening, sourceIndex) => ({
      id: String(opening.id || sourceIndex),
      sourceIndex,
      type: opening.type,
      x: opening.rx,
      y: opening.ry,
      angle: Number(opening.angle) || 0,
      length: opening.rlen > 0 ? opening.rlen : 0.9 * NORM_W,
      flipH: !!opening.flip_h,
      flipV: !!opening.flip_v,
    }));
    const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, this._cellCm);
    const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, this._cellCm);
    const key = `${space.id}|${isoGeometryFingerprint({
      rooms: space.rooms, walls, openCuts, openings,
      partitions: space.partitions, roomDrafts: space.room_drafts, columns: space.wall_columns,
      cellCm: this._cellCm, gridPitch: this._gridPitch, wallKeyPitch: this._wallKeyPitch,
      camera: ISO_CAMERA, wallHeight,
      floorEdgeHeight, algorithm: 3,
    })}`;
    return {
      key,
      build: () => {
        const extras = physicalBodyParts(
          space, this._cellCm, this._gridPitch, this._gridPitch * 0.0002,
          this._partitionOpeningCuts(space),
        ).all;
        const roomOpenings = this._roomWallOpeningInputs(this._openingsR, space);
        const united = walls.length || extras.length
          ? wallBodiesGeometry(
              space.rooms, walls, openCuts, roomOpenings,
              this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, extras,
            )
          : null;
        if (united && (united.status === 'failed-core' || united.status === 'not-applicable'))
          throw new Error('wall boolean geometry failed');
        const floor = united?.paperGeom ?? floorFootprintGeometry(
          space.rooms, walls, openCuts,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        );
        if (!floor) throw new Error('floor boolean geometry failed');
        const openingIndex = united?.openingIndex || buildOpeningWallIndex(
          space.rooms, walls, openCuts,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        );
        const openingBases = openings.map((opening) => {
          const rendered = this._openingsR[opening.sourceIndex];
          const faceFlipV = opening.type === 'gate' ? !opening.flipV : opening.flipV;
          const face = rendered?.partitionHost
            ? partitionOpeningFace(rendered.partitionHost, faceFlipV)
            : walls.length || opening.type === 'gate'
              ? openingInnerFaceOffsetFromIndex(openingIndex, {
                  x: opening.x,
                  y: opening.y,
                  angle: opening.angle,
                  length: opening.length,
                  flip_v: faceFlipV,
                })
            : { ox: 0, oy: 0, cm: 0, side: -1 as -1 | 1 };
          return buildIsoOpeningBasis({ ...opening, face }, wallHeight);
        });
        return {
          walls: united?.components.flatMap((component) => component.geom) || [],
          floor, openings: Object.freeze(openingBases),
        };
      },
    };
  }

  private _isoSceneKey(): string | null {
    if (!this._labsIso || this._mode !== 'view') return null;
    try { return this._isoSource()?.key ?? null; } catch { return `${this._space}|invalid`; }
  }

  private _isoScene(): {
    key: string;
    geometry: IsoWallGeometry;
    floor: IsoFloorGeometry;
    openings: readonly IsoOpeningBasis[];
    frame: Rect;
  } | null {
    const source = this._isoSource();
    if (!source) return null;
    const cached = this._isoGeometryCache.get(source.key);
    if (cached) return { key: source.key, ...cached };
    const flat = this._frameOf().rect;
    const structural = source.build();
    const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, this._cellCm);
    const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, this._cellCm);
    const openingFrame = isoOpeningBounds(structural.openings);
    const structuralFrame = openingFrame ? unionRect(flat, openingFrame) : flat;
    const frame = projectedFrame({
      rect: structuralFrame,
      wallHeight,
      openingHeight: wallHeight,
      floorDepth: floorEdgeHeight,
    });
    const geometry = buildIsoWallGeometry(structural.walls, ISO_CAMERA, wallHeight);
    const floor = buildIsoFloorGeometry(structural.floor, floorEdgeHeight);
    const value = { geometry, floor, openings: structural.openings, frame };
    lruWrite(this._isoGeometryCache, source.key, value, 8);
    return { key: source.key, ...value };
  }

  private _effectiveProjection(): 'flat' | 'iso' {
    if (this._desiredProjection !== 'iso' || !this._model.length) return 'flat';
    const key = this._isoSceneKey() || `${this._space}|invalid`;
    if (this._isoFallback.has(key)) return 'flat';
    try {
      const scene = this._isoScene();
      if (!scene) return 'flat';
      return isoEffectiveView('iso', scene.key, this._isoFallback);
    } catch (error) {
      if (!this._isoFallback.has(key)) {
        this._isoFallback.add(key);
        const parts = key.split('|');
        console.warn(`HOUSEPLAN ISO FALLBACK: #89, space ${this._space}, fingerprint ${parts[parts.length - 1]}, ${error instanceof Error ? error.message : 'renderer error'}`);
      }
      return 'flat';
    }
  }

  private _scenePoint(point: readonly [number, number]): ScenePoint {
    return this._renderProjection === 'iso' ? projectPlanPoint(point, 0) : point;
  }

  private _floorView(view: { x: number; y: number; w: number; h: number }): ViewRect {
    if (this._renderProjection !== 'iso') return view;
    const start = unprojectFloorPoint([view.x, view.y]);
    const end = unprojectFloorPoint([view.x + view.w, view.y + view.h]);
    return { x: start[0], y: start[1], w: end[0] - start[0], h: end[1] - start[1] };
  }

  private _baseVb(): number[] {
    if (this._effectiveProjection() === 'iso') {
      // No-borders is the accepted Stage 1 no-volume scene. Stage 2 structure
      // is absent there, so its opening/floor-edge bounds must be absent too;
      // otherwise merely hiding volume reframes every live floor pixel.
      if (!this._spaceDisplayForRender().showBorders) {
        const flat = this._frameOf().rect;
        const frame = projectedFrame({
          rect: flat,
          wallHeight: gridVisualUnits(ISO_WALL_HEIGHT, this._cellCm),
        });
        return [frame.x, frame.y, frame.w, frame.h];
      }
      const frame = this._isoScene()?.frame ?? this._frameOf().rect;
      return [frame.x, frame.y, frame.w, frame.h];
    }
    const r = this._frameOf().rect;
    return [r.x, r.y, r.w, r.h];
  }

  /** How many objects the opening view deliberately leaves out (§4.1). */
  private get _outliers(): number {
    return this._showFar ? 0 : this._frameOf().outliers;
  }

  /** The outlier hint's action: take the far objects into the frame, then fit. */
  private _fitFar(): void {
    this._clearRoomFocus();
    this._showFar = true;
    this._frame = null;
    // The camera command may be a no-op at the fitted target. The hint still
    // changed state and must disappear without waiting for another render.
    this.requestUpdate();
    this._resetZoom();
  }

  private _clearRoomFocus(pointer = false): void {
    this._doubleFit.clear();
    this._roomFocus = null;
    if (pointer) this._roomPointer = null;
  }

  /** Exact finite room geometry in the current camera coordinate system. */
  private _roomFitBounds(room: RoomCfg, space: SpaceModel) {
    const own = roomPoly(room);
    if (!own || !room.id) return null;
    const walls = this._spaceWalls;
    const openCuts = this._openCuts();
    const united = this._wallUnionGeometry();
    const floor = walls.length
      ? (this._innerRoomContour(
          space, room.id, openCuts, united?.roomGeom, united?.multiWallNodes,
        ) || own)
      : own;
    const disp = this._spaceDisplayForRender();
    let wall: number[][] = [];
    if (disp.showBorders && walls.length) {
      const profile = roomWallProfile(
        space.rooms, room.id, walls, openCuts,
        this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
      );
      if (profile) {
        wall = outsetContour(profile.poly, profile.offsets, united?.multiWallNodes)
          || profile.poly;
      }
    }
    const projection = this._effectiveProjection();
    return roomFitGeometryBounds({
      floor,
      wall,
      projection,
      wallHeight: projection === 'iso' && disp.showBorders
        ? gridVisualUnits(ISO_WALL_HEIGHT, this._cellCm) : 0,
      floorDepth: projection === 'iso' && disp.showBorders
        ? gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, this._cellCm) : 0,
      // Room outlines and wall-body outlines are centred on their primitives.
      padding: disp.showBorders ? gridVisualUnits(1.25, this._cellCm) : 0,
    });
  }

  /** Apply or retarget one room command without introducing a second RAF owner. */
  private _fitRoom(roomId: string, animate = true): boolean {
    if (this._mode !== 'view') return false;
    this._doubleFit.clear();
    const space = this._spaceModel();
    const room = space?.rooms.find((item) => item.id === roomId);
    if (!space || !room) {
      this._clearRoomFocus();
      return false;
    }
    const bounds = this._roomFitBounds(room, space);
    if (!bounds) {
      this._clearRoomFocus();
      return false;
    }
    // Store only stable ids. A temporarily unmeasurable stage may retry this
    // intent at the next positive ResizeObserver delivery.
    this._roomFocus = { spaceId: space.id, roomId };
    const stage = this._stageEl;
    if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) return true;
    const base = this._baseVb();
    const baseFit = fitView(base, stage.clientWidth / stage.clientHeight);
    const target = roomFitCameraTarget({
      bounds,
      baseFit,
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
      minZoom: HouseplanCard.ZOOM_MIN,
      maxZoom: HouseplanCard.ZOOM_MAX,
    });
    if (!target) {
      this._clearRoomFocus();
      return false;
    }
    const current = this._cameraState();
    const clamp = roomFitClampFrame(baseFit, current.viewBox, target.viewBox, bounds);
    target.viewBox = this._clampView(target.viewBox, clamp);
    if (animate) {
      this._prepareCameraCommand();
      this._startCameraTransition(target, clamp, 'room', CAMERA_FIT_MS);
      return true;
    }
    this._cancelCameraTransition(false);
    if (!sameCameraState(current, target)) {
      this._zoom = target.zoom;
      this._view = { ...target.viewBox };
      this.requestUpdate();
    }
    return true;
  }

  /** «Вписать всё» (docs/CANVAS.md §8) — the toolbar button and the "home is
   *  that way" arrow share it. It fits whatever the frame currently means:
   *  the main mass, or everything once the far-objects hint has been used. */
  private _fitAll(reason: 'fit' | 'home' | 'double-tap' = 'fit'): void {
    this._clearRoomFocus();
    this._showFar = true;
    this._frame = null;
    this.requestUpdate();
    this._resetZoom(reason);
  }

  /** Unobtrusive inline hint: some objects stand an order of magnitude away
   *  from the plan and are deliberately outside the opening view. No modal —
   *  a chip with one action (docs/CANVAS.md §4.1). */
  private _renderFarHint(): TemplateResult | typeof nothing {
    if (this._kiosk || this._mode !== 'view' || this._booting || !this._outliers) return nothing;
    return html`<div class="farhint">
      <ha-icon icon="mdi:map-marker-alert-outline"></ha-icon>
      <span>${this._t('canvas.far_objects', { n: this._outliers })}</span>
      <button class="btn ghostbtn" @click=${() => this._fitFar()}>${this._t('canvas.show_far')}</button>
    </div>`;
  }

  /** "Home is that way" (docs/CANVAS.md §5): the plane has no edges, so it is
   *  possible to pan until nothing is on screen. One small pointer towards the
   *  content, one click back to it. */
  private _renderHomeArrow(): TemplateResult | typeof nothing {
    if (this._booting) return nothing;
    const v = this._view;
    if (!v || !v.w || !v.h) return nothing;
    const base = this._baseVb();
    const f = { x: base[0], y: base[1], w: base[2], h: base[3] };
    const gone = f.x + f.w <= v.x || f.x >= v.x + v.w || f.y + f.h <= v.y || f.y >= v.y + v.h;
    if (!gone) return nothing;
    const ang = Math.atan2((f.y + f.h / 2) - (v.y + v.h / 2), (f.x + f.w / 2) - (v.x + v.w / 2));
    const left = 50 + Math.cos(ang) * 38;
    const top = 50 + Math.sin(ang) * 38;
    return html`<button class="homearrow" title=${this._t('canvas.home_tip')}
      style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%"
      @click=${(e: Event) => { e.stopPropagation(); this._fitAll('home'); }}>
      <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${((ang * 180) / Math.PI).toFixed(1)}deg)"></ha-icon>
    </button>`;
  }

  /** Aspect ratio of the scene (width/height, px). */
  private _stageAspect(): number {
    const s = this._stageEl;
    const vb = this._baseVb();
    return s && s.clientHeight ? s.clientWidth / s.clientHeight : vb[2] / vb[3];
  }

  /** Current view with a fallback to the full fit. */
  private _viewOr(vb: number[]): { x: number; y: number; w: number; h: number } {
    return this._view && this._view.w ? this._view : fitView(vb, this._stageAspect());
  }

  /**
   * Room labels must keep their View screen geometry while the Plan toolbar
   * borrows height from the stage. Devices continue to scale with the active
   * editor viewport; only the label core uses the hypothetical View viewport
   * at the same zoom and total card height (#200).
   */
  private _roomLabelReferenceViewWidth(view: { w: number }): number {
    if (!this._markup) return view.w;
    const stage = this._stageEl;
    const chrome = this.renderRoot.querySelector('.editorchrome') as HTMLElement | null;
    if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) return view.w;
    const totalHeight = stage.clientHeight + (chrome?.getBoundingClientRect().height || 0);
    if (totalHeight <= 0) return view.w;
    return this._viewForModeTarget(
      this._zoom, undefined, undefined, stage.clientWidth, totalHeight,
    ).w;
  }

  /** Screen (sx,sy relative to the scene, px) → vb coordinates per the current view. */
  private _screenToVb(sx: number, sy: number): number[] {
    const s = this._stageEl;
    const v = this._viewOr(this._baseVb());
    const w = s?.clientWidth || 1, h = s?.clientHeight || 1;
    return [v.x + (sx / w) * v.w, v.y + (sy / h) * v.h];
  }

  /** Zoom limits (docs/CANVAS.md §5): 8x in as before, 3x out — beyond that
   *  the screen is empty plane, which is not information. */
  private static readonly ZOOM_MAX = 8;
  private static readonly ZOOM_MIN = MIN_ZOOM;

  /**
   * Keep the view within reach of the content (docs/CANVAS.md §5).
   *
   * There is no edge any more, so this is NOT "the content must cover the
   * scene" — that was the rule that made it impossible to draw or place
   * anything past the plan. Panning may walk a whole screen off the content
   * in every direction (PAN_SLACK), which is what an editor needs to extend a
   * plan outwards; further than that you would only be lost, and the "home is
   * that way" arrow already covers the walk back.
   */
  private _clampView(
    v: { x: number; y: number; w: number; h: number },
    fit: { x: number; y: number; w: number; h: number },
  ): { x: number; y: number; w: number; h: number } {
    const axis = (vp: number, vs: number, fp: number, fs: number): number => {
      const slack = Math.max(vs, fs) * PAN_SLACK;
      const a = fp - slack, b = fp + fs - vs + slack;
      return Math.max(Math.min(a, b), Math.min(Math.max(a, b), vp));
    };
    return { w: v.w, h: v.h, x: axis(v.x, v.w, fit.x, fit.w), y: axis(v.y, v.h, fit.y, fit.h) };
  }

  /** Set the zoom (centered on vb point cx,cy, or on the center of the current view). */
  private _applyView(zoom: number, cx?: number, cy?: number): boolean {
    this._cancelCameraTransition(false);
    const vb = this._baseVb();
    const fit = fitView(vb, this._stageAspect());
    const z = Math.min(HouseplanCard.ZOOM_MAX, Math.max(HouseplanCard.ZOOM_MIN, zoom));
    const w = fit.w / z, h = fit.h / z;
    const cur = this._viewOr(vb);
    const ccx = cx ?? cur.x + cur.w / 2;
    const ccy = cy ?? cur.y + cur.h / 2;
    const next = this._clampView({ x: ccx - w / 2, y: ccy - h / 2, w, h }, fit);
    const same = this._view
      && Math.abs(this._zoom - z) < 1e-9
      && Math.abs(this._view.x - next.x) < 1e-6
      && Math.abs(this._view.y - next.y) < 1e-6
      && Math.abs(this._view.w - next.w) < 1e-6
      && Math.abs(this._view.h - next.h) < 1e-6;
    if (same) return false;
    if (this._tool === 'opening') {
      this._cursorPt = null;
      this._clearOpeningPlacement(false);
    }
    this._zoom = z;
    this._view = next;
    this._liveVp();
    return true;
  }

  /**
   * HP-1552: hold the boot veil until the stage height settles. AUD-1552-02:
   * the old "two equal reads at a 200 ms cadence" revealed the plan at
   * ~400 ms, so an HA panel landing right after (450+ ms is realistic on a
   * slow device) still jumped on a VISIBLE plan. The veil now holds for the
   * full protective window (BOOT_MIN_MS); the height is sampled every 100 ms
   * and any change restarts a trailing-quiescence requirement
   * (BOOT_QUIET_MS), so chrome still settling near the cap extends the wait.
   * BOOT_MAX_MS lifts the veil unconditionally — it can never get stuck.
   */
  private _bootWatch(): void {
    clearTimeout(this._bootTimer); // never two concurrent watchers (connect + updated)
    this._bootStart = Date.now();
    this._bootLastH = -1; // the first read only arms the comparison
    this._bootLastChange = this._bootStart;
    const tick = () => {
      if (!this._booting) return;
      const now = Date.now();
      const h = this._stageEl ? this._stageEl.clientHeight : 0;
      if (h !== this._bootLastH) { this._bootLastH = h; this._bootLastChange = now; }
      const elapsed = now - this._bootStart;
      if (elapsed >= BOOT_MAX_MS || (elapsed >= BOOT_MIN_MS && h > 0 && now - this._bootLastChange >= BOOT_QUIET_MS)) {
        this._bootSettled();
        return;
      }
      this._bootTimer = window.setTimeout(tick, 100);
    };
    this._bootTimer = window.setTimeout(tick, 100);
  }

  private _bootSettled(): void {
    if (!this._booting || this._bootSettling) return;
    this._bootSettling = true;
    this._refitView(); // calculate the final geometry while still covered
    this._bootSettleRaf = requestAnimationFrame(() => {
      this._bootSettleRaf = 0;
      this._finishBootSettled();
    });
  }

  private _finishBootSettled(): void {
    if (!this._booting) return;
    // Refit once more before removing the veil. This prevents a default-view reveal.
    this._refitView();
    this._booting = false;
    this._bootSettling = false;
    // DEV-B703-01: the page has settled once — the next instance with the
    // same config at the same viewport opens warm (no veil, no wait).
    const settledH = this._stageEl?.clientHeight ?? 0;
    if (!this._config?.kiosk && settledH > 0) {
      this._warmPatch({ hdrH: this._hdrH, stageH: settledH, vp: this._warmViewportState() }, true);
    }
    this._bootFading = true; // one soft opacity-out, then out of the DOM
    this._bootTimer = window.setTimeout(() => { this._bootFading = false; }, 220);
    // AUD-1552-02: chrome that lands after the cap (device slower than
    // BOOT_MAX_MS) must not snap — for a short grace the stage height
    // transitions and the viewport ResizeObserver refits the plan each frame.
    this._bootSoft = true;
    clearTimeout(this._bootSoftTimer);
    this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
  }

  /** The soft grace only covers PASSIVE late chrome. A user action that
   *  changes the stage height (entering/leaving an editor) must apply
   *  instantly — the plan may not drift under the pointer mid-drag. */
  private _bootSoftCancel(): void {
    if (!this._bootSoft) return;
    clearTimeout(this._bootSoftTimer);
    this._bootSoft = false;
  }

  /** Hold the last complete frame after a long sleep; never hide the scene. */
  private _beginResumeSettle(): void {
    if (this._booting || this._resumeSettling) return;
    if (this._modeTransitionPreparing) this._modeTransitionForceAtomic = true;
    else this._cancelModeTransition(true);
    this._viewportInvalidAt = 0;
    this._beginContinuityCandidate('warm-resume', false);
    // A card can be detached for the whole visibility event and reattached as
    // the same already-loaded instance. In that case `willUpdate()` has no
    // reason to reload, so the warm tombstone must start its own revalidation
    // instead of immediately blessing the stale frame as current.
    if (!this._loading) void this._loadFromServer();
    else this.requestUpdate();
  }

  /** Recompute the view for a new scene size, preserving zoom and center. */
  private _refitView(): void {
    if (this._modeTransitionBusy || this._warmModeRequest) return;
    // Resize is structural: keep the currently painted camera, cancel its old
    // target, then let the existing refit path own the new stage geometry.
    this._cancelCameraTransition(false);
    const stage = this._stageEl;
    // ResizeObserver may deliver a zero/transitional box while a browser tab
    // is frozen or while Lovelace replaces the card. Mutating `_view` from
    // that box is the scale jump observed on return.
    if (!stage || document.visibilityState !== 'visible' || stage.clientWidth <= 0 || stage.clientHeight <= 0) {
      if (!this._viewportInvalidAt) this._viewportInvalidAt = Date.now();
      return;
    }
    const size: [number, number] = [stage.clientWidth, stage.clientHeight];
    const previous = this._lastValidStageSize;
    const sameSize = !!previous
      && Math.abs(previous[0] - size[0]) <= 0.5
      && Math.abs(previous[1] - size[1]) <= 0.5;
    const invalidFor = this._viewportInvalidAt ? Date.now() - this._viewportInvalidAt : 0;
    this._viewportInvalidAt = 0;
    if (!previous) {
      this._lastValidStageSize = size;
      if (this._roomFocus?.spaceId === this._space) {
        this._fitRoom(this._roomFocus.roomId, false);
      } else if (!this._view) this._applyView(this._zoom);
      return;
    }
    // 0x0 -> the same positive size is explicitly a no-op.
    if (sameSize) {
      this._pendingRefitSize = null;
      return;
    }
    this._pendingRefitSize = size;
    if (this._refitRaf) return;
    this._refitRaf = requestAnimationFrame(() => {
      this._refitRaf = 0;
      const target = this._pendingRefitSize;
      this._pendingRefitSize = null;
      const live = this._stageEl;
      if (!target || !live || live.clientWidth <= 0 || live.clientHeight <= 0) return;
      if (Math.abs(live.clientWidth - target[0]) > 0.5
          || Math.abs(live.clientHeight - target[1]) > 0.5) {
        this._refitView();
        return;
      }
      const old = this._lastValidStageSize;
      if (old && Math.abs(old[0] - target[0]) <= 0.5 && Math.abs(old[1] - target[1]) <= 0.5) return;
      this._lastValidStageSize = target;
      const cur = this._view;
      if (invalidFor >= CONTINUITY_LONG_HIDDEN_MS) {
        this._beginContinuityCandidate('stage-size-restored', true, 'stage-size');
      } else if (this._continuity.hasCompleteFrame) {
        this._beginContinuityCandidate('stage-resize', true, 'stage-size');
      }
      if (this._roomFocus?.spaceId === this._space) {
        this._fitRoom(this._roomFocus.roomId, false);
        return;
      }
      this._applyView(
        this._zoom,
        cur ? cur.x + cur.w / 2 : undefined,
        cur ? cur.y + cur.h / 2 : undefined,
      );
    });
  }

  private _cameraTargetAt(
    sx: number,
    sy: number,
    newZoom: number,
    animated = false,
  ): { target: CameraState; fit: ModeViewBox } | null {
    const stage = this._stageEl;
    if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) return null;
    const vb = this._baseVb();
    const fit = fitView(vb, this._stageAspect());
    const z = Math.min(HouseplanCard.ZOOM_MAX, Math.max(HouseplanCard.ZOOM_MIN, newZoom));
    // #396 AC3: the world point under the pointer is read from the SAME state
    // the zoom is accumulated from — the running target. Reading it from the
    // lagging presented frame made a fast trackpad series walk the anchor
    // 14-16 CSS px away, while spec #82 §10 promises it stays put.
    const anchorFrom = (animated && this._cameraTransition.target)
      || this._cameraState();
    const target = cameraTargetAtAnchor(
      anchorFrom, z, fit,
      stage.clientWidth, stage.clientHeight, sx, sy,
    );
    if (!target) return null;
    target.viewBox = this._clampView(target.viewBox, fit);
    return { target, fit };
  }

  /** Immediate path for direct pinch: keep the point under the fingers. */
  private _zoomAt(sx: number, sy: number, newZoom: number): void {
    this._clearRoomFocus();
    this._cancelCameraTransition(false);
    const result = this._cameraTargetAt(sx, sy, newZoom);
    if (!result) return;
    if (this._tool === 'opening') {
      this._cursorPt = null;
      this._clearOpeningPlacement(false);
    }
    this._zoom = result.target.zoom;
    this._view = { ...result.target.viewBox };
    this._liveVp();
  }

  private _onWheel(ev: WheelEvent): void {
    this._clearRoomFocus();
    this._prepareCameraCommand();
    const stage = this._stageEl;
    if (!stage) return;
    ev.preventDefault();
    const r = stage.getBoundingClientRect();
    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    const baseZoom = this._cameraTransition.target?.zoom ?? this._zoom;
    const result = this._cameraTargetAt(
      ev.clientX - r.left, ev.clientY - r.top, baseZoom * factor, true,
    );
    if (result) this._startCameraTransition(
      result.target, result.fit, 'wheel', CAMERA_WHEEL_MS,
    );
  }

  private _stepZoom(delta: number): void {
    this._clearRoomFocus();
    this._prepareCameraCommand();
    const stage = this._stageEl;
    if (!stage) return;
    const baseZoom = this._cameraTransition.target?.zoom ?? this._zoom;
    const result = this._cameraTargetAt(
      stage.clientWidth / 2,
      stage.clientHeight / 2,
      baseZoom * (delta > 0 ? 1.4 : 1 / 1.4),
      true,
    );
    if (result) this._startCameraTransition(
      result.target, result.fit, 'button', CAMERA_BUTTON_MS,
    );
  }

  /** «Вписать всё» (docs/CANVAS.md §8) — the toolbar's middle button and the
   *  old "reset zoom" in one: frame the content at zoom 1, centred. With
   *  `all` it also takes in the far strays the opening view leaves out. */
  private _resetZoom(reason: 'fit' | 'home' | 'double-tap' = 'fit'): void {
    this._clearRoomFocus();
    this._prepareCameraCommand();
    const vb = this._baseVb();
    const fit = fitView(vb, this._stageAspect());
    this._startCameraTransition(
      { zoom: 1, viewBox: { ...fit } },
      fit,
      reason,
      CAMERA_FIT_MS,
    );
  }

  /** Save the current space zoom to localStorage (view mode only). */
  private _saveZoom(): void {
    // Editor zoom is a working tool, never the viewing intent: while an editor
    // is open the wheel/pinch keep calling _saveZoom, but the per-space VIEW
    // zoom must not learn about it. The exit-editor restore used to re-save the
    // view zoom from a rAF — on a slow tablet the floor-tab click lands BEFORE
    // that rAF (input runs first in the frame), the space guard skipped the
    // fix-up and the editor 500% stayed in _zoomBySpace/LS_ZOOM for the next
    // visit to that floor. Editors do not need zoom persistence at all.
    if (this._mode !== 'view') return;
    this._zoomBySpace = { ...this._zoomBySpace, [this._space]: this._zoom };
    try {
      localStorage.setItem(LS_ZOOM, JSON.stringify(this._zoomBySpace));
    } catch {
      /* ignore */
    }
  }

  /** Restore the saved space zoom and center the plan. */
  private _restoreZoom(): void {
    this._clearRoomFocus(true);
    this._cancelCameraTransition(false);
    const z = this._zoomBySpace[this._space] || 1;
    this._zoom = z;
    const stage = this._stageEl;
    if (stage && stage.clientHeight) {
      // HP-1551: the stage is already measured — apply the view NOW, before
      // the next paint. The unconditional rAF here used to let one frame
      // (or a whole server round-trip worth of frames, via the updated()
      // refit running with the stale zoom before this method was called at
      // all) paint at the default fit — the visible "flash" on opening.
      const vb = this._baseVb();
      this._applyView(z, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
      this.requestUpdate();
      return;
    }
    // stage not measurable yet: let updated() fit it with the (already
    // correct) _zoom on the first layout, then center on the plan
    this._view = null;
    requestAnimationFrame(() => {
      if (!this._stageEl) return;
      const vb = this._baseVb();
      this._applyView(z, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
      this.requestUpdate();
    });
  }

  private _stagePointerDown(ev: PointerEvent): void {
    const roomId = ev.isPrimary && ev.button === 0 && this._mode === 'view' ? roomFitOwnerFromPath(ev.composedPath()) : null;
    this._roomPointer = roomId
      ? { pointerId: ev.pointerId, spaceId: this._space, roomId }
      : null;
    this._doubleFit.pointerDown(ev, this._space, this._doubleFitEnabled);
    // The gesture that starts here freezes the animated frame and keeps it on
    // screen — so the shown zoom becomes the saved one (#396 AC1).
    this._cancelCameraTransition(false, true);
    if (this._vacFit) return; // no pan/swipe while fitting the robot map
    // The shared secondary controller owns palette dismissal in window
    // capture, including the matching synthetic click. Do not duplicate that
    // lifecycle here: the former fallback left `_suppressClick` stuck when a
    // pointerup was lost or a pointercancel followed the dismiss press.
    if (this._kiosk) {
      this._cyclePausedUntil = Date.now() + 60000;
      if (this._pointers.size === 0) {
        this._swipeStart = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
        // long-press on EMPTY stage opens the per-screen size popover
        if (!(ev.target as HTMLElement).closest?.('.dev, .roomlabel, .oplock')) {
          clearTimeout(this._kioskHoldTimer);
          this._kioskHoldTimer = window.setTimeout(() => {
            this._roomPointer = null;
            this._doubleFit.clear();
            this._kioskDialog = true;
            this._swipeStart = null;
          }, 3000);
        }
      } else {
        this._swipeStart = null; // second finger = pinch, not a swipe
        clearTimeout(this._kioskHoldTimer);
      }
    }
    // do not interfere with icon and label dragging
    if (this._drag || this._deviceDrag) return;
    if (this._markup) {
      // Drawing is CLICK-based, so gestures coexist with it: a finger that
      // MOVES pans, two fingers pinch, and _suppressClick keeps the release
      // from feeding the active tool. The editor used to opt out of gestures
      // entirely, which left a phone with no way to zoom or pan the plan
      // (owner's report). Pointers that begin on interactive children still
      // stay out — labels and handles run their own drags.
      if ((ev.target as HTMLElement).closest?.('.roomlabel, .rlhandle, .rszhandle, .dev, .oplock, .op-hit, button')) return;
    }
    if (this._mode === 'devices' && (ev.target as HTMLElement).closest('.dev')) return;
    if (this._mode === 'decor' && this._decorPointerDown(ev)) return;
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const v = this._viewOr(this._baseVb());
    if (this._pointers.size === 1) {
      this._panStart = { sx: ev.clientX, sy: ev.clientY, vx: v.x, vy: v.y };
      this._panLock = null; // undecided until the finger moves
      this._suppressClick = false;
    } else if (this._pointers.size === 2) {
      this._clearRoomFocus(true);
      // A second pointer turns the gesture into navigation. An Opening hover
      // must never survive underneath that pinch. Keep the selected preset: lifting the
      // fingers returns to the same placement session, just without a stale
      // preview at the pre-gesture coordinate.
      if (this._tool === 'opening') {
        this._cursorPt = null;
        this._clearOpeningPlacement(false);
      } else if (this._tool === 'draw') {
        this._clearPlanSnapHover();
      }
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this._pinchStart = { dist, zoom: this._zoom };
      this._panStart = null;
      this._panLock = null;
    }
  }

  /**
   * Is a horizontal drag reserved for the floor swipe right now? Only on a
   * kiosk screen, only at the zoom `swipeTarget` accepts, and only when there
   * is more than one space to swipe between — everywhere else nothing
   * competes with panning.
   */
  private get _swipeZone(): boolean {
    return !this._hasFixedFloor && this._kiosk && this._zoom <= 1.001 && this._model.length > 1;
  }

  private _stagePointerMove(ev: PointerEvent): void {
    if (this._physicalRotate?.pid === ev.pointerId) {
      this._physicalRotateMove(ev);
      return;
    }
    if (this._physicalDrag?.pid === ev.pointerId) {
      this._physicalMove(ev);
      return;
    }
    if (this._dtDrag?.pid === ev.pointerId) {
      this._dtMove(ev);
      return;
    }
    if (this._bdDrag?.pid === ev.pointerId) {
      this._bdMove(ev);
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      const draft = this._decorDraft;
      let b = this._decorSnap(this._svgPoint(ev), ev.pointerType);
      if (ev.shiftKey && (draft.kind === 'rect' || draft.kind === 'ellipse')) {
        const dx = b[0] - draft.a[0], dy = b[1] - draft.a[1];
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        b = this._snap([
          draft.a[0] + (dx < 0 ? -side : side),
          draft.a[1] + (dy < 0 ? -side : side),
        ]);
      }
      this._decorDraft = { ...draft, b };
      return;
    }
    if (this._decorMove?.pid === ev.pointerId) {
      this._decorMoveUpdate(ev);
      return;
    }
    if (this._mode === 'decor'
        && (this._decorTool === 'furniture' || this._decorTool === 'image')
        && this._editorRuntime) {
      this._notePointer(ev);
      if (this._editorRuntime._furnPointerMove(ev, this._pointerModality.hoverEnabled)) return;
    }
    if (!this._pointers.has(ev.pointerId)) {
      this._markupMove(ev);
      return;
    }
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    // the tool preview (snap dot, measure label) keeps following the finger
    if (this._markup && this._pointers.size === 1) this._markupMove(ev);
    if (this._pinchStart && this._pointers.size >= 2) {
      this._clearRoomFocus(true);
      if (this._tool === 'opening') {
        this._cursorPt = null;
        this._clearOpeningPlacement(false);
      } else if (this._tool === 'draw') {
        this._clearPlanSnapHover();
      }
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = dist / (this._pinchStart.dist || 1);
      const r = this._stageEl!.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2 - r.left;
      const cy = (pts[0].y + pts[1].y) / 2 - r.top;
      this._zoomAt(cx, cy, this._pinchStart.zoom * scale);
      this._viewportGestureDirty = true;
      this._suppressClick = true;
      this._saveZoom();
    } else if (this._panStart) {
      const ddx = ev.clientX - this._panStart.sx;
      const ddy = ev.clientY - this._panStart.sy;
      if (Math.abs(ddx) + Math.abs(ddy) > 4) {
        this._roomPointer = null;
        this._doubleFit.clear();
        this._suppressClick = true;
        clearTimeout(this._holdTimer);
        if (this._tool === 'opening') {
          this._cursorPt = null;
          this._clearOpeningPlacement(false);
        } else if (this._tool === 'draw') {
          this._clearPlanSnapHover();
        }
      }
      // Which gesture is this? Decided once, on the first movement worth the
      // name, and kept for the rest of the drag so the plan cannot flip-flop
      // under the finger. Panning is NOT gated on the zoom any more (owner,
      // 2026-08-04: «таскать план при любом масштабе»): on an infinite canvas
      // there is no "the content already covers the scene" state that would
      // make a drag meaningless — `_clampView` alone decides how far you may
      // walk, at 400% and at 33% alike.
      if (this._panLock === null && Math.abs(ddx) + Math.abs(ddy) > STAGE_TAP_DISTANCE_PX) {
        this._panLock = this._swipeZone && Math.abs(ddx) > Math.abs(ddy) * 1.5 ? 'swipe' : 'pan';
        if (this._panLock === 'pan') this._clearRoomFocus();
      }
      const stage = this._stageEl;
      if (this._panLock === 'pan' && stage) {
        const vb = this._baseVb();
        const v = this._viewOr(vb);
        const fit = fitView(vb, this._stageAspect());
        this._view = this._clampView(
          {
            x: this._panStart.vx - (ddx / (stage.clientWidth || 1)) * v.w,
            y: this._panStart.vy - (ddy / (stage.clientHeight || 1)) * v.h,
            w: v.w,
            h: v.h,
          },
          fit,
        );
        this._viewportGestureDirty = true;
        this._liveVp();
      }
    }
  }

  private _stagePointerLeave(ev: PointerEvent): void {
    this._editorRuntime?._cancelPointerMove('markup-hover');
    if (this._mode === 'decor') this._editorRuntime?._furnPointerLeave(ev);
    if (!this._markup) return;
    if (this._tool === 'opening') {
      this._cursorPt = null;
      this._clearOpeningPlacement(false);
    } else if (this._tool === 'draw') {
      this._clearPlanSnapHover();
    }
  }

  private _stagePointerUp(ev: PointerEvent): void {
    this._flushHa();
    this._editorRuntime?._cancelPointerMove('markup-hover');
    const acceptedRoom = acceptedRoomFitGesture(
      this._roomPointer,
      ev.pointerId,
      this._space,
      this._roomPointer && this._mode === 'view' ? roomFitOwnerFromPath(ev.composedPath()) : null,
      this._suppressClick || !!this._pinchStart || this._panLock !== null
        || this._holdFired || this._touchSequenceMultitouch,
    );
    if (this._roomPointer?.pointerId === ev.pointerId) this._roomPointer = null;
    const doubleFit = this._doubleFit.pointerUp(ev, this._space, this._doubleFitEnabled, this._suppressClick || !!this._pinchStart || this._panLock !== null || this._holdFired);
    if (doubleFit) this._fitAll('double-tap');
    if (this._kiosk) {
      clearTimeout(this._kioskHoldTimer);
      const ss = this._swipeStart;
      this._swipeStart = null;
      if (!acceptedRoom && ss && ss.id === ev.pointerId) {
        const dx = ev.clientX - ss.x;
        const dy = ev.clientY - ss.y;
        // The lock is FINAL (audit DEV-1DA1-02). `_stagePointerMove` decided
        // once, on the first movement worth the name, whether this gesture is
        // a swipe or a pan — and the release may not overturn it. Until this
        // the release asked `swipeTarget()` again from the raw start→end
        // vector, so a CURVED gesture (a small vertical lead-in that locks
        // 'pan', then a long horizontal sweep) dragged the plan under the
        // finger and still landed on another storey when it lifted. A pan is
        // a pan to the end: no floor change, whatever the overall vector
        // happens to look like. A motionless tap never locks anything, so it
        // remains eligible for the shared free-background double-fit recognizer.
        const target = this._panLock === 'pan'
          ? null
          : swipeTarget(dx, dy, this._zoom, this._model.map((m) => m.id), this._space);
        if (target) {
          // the plan follows the finger: swiping left brings the next one in
          // from the right, so the current one leaves to the left
          if (this._slideTo(target, dx < 0 ? 'left' : 'right')) {
            this._saveNav();
            this._suppressClick = true;
            setTimeout(() => (this._suppressClick = false), 0);
            this._showKioskDots();
          }
        }
      }
    }
    if (this._physicalDrag?.pid === ev.pointerId) {
      this._physicalUp(ev);
      return;
    }
    if (this._physicalRotate?.pid === ev.pointerId) {
      this._physicalRotateUp(ev);
      return;
    }
    if (this._dtDrag?.pid === ev.pointerId) {
      this._dtUp();
      return;
    }
    if (this._bdDrag?.pid === ev.pointerId) {
      this._bdUp();
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      this._decorCommitDraft();
      return;
    }
    if (this._decorMove?.pid === ev.pointerId) {
      this._editorRuntimeOrThrow()._dmUp();
      return;
    }
    if (this._editorRuntime?._furnPointerUp(ev)) return;
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinchStart = null;
    if (this._pointers.size === 0) {
      this._panStart = null;
      this._panLock = null;
      // reset click suppression on the next tick (so that a click right after a pan does not fire)
      if (this._suppressClick) setTimeout(() => (this._suppressClick = false), 0);
    }
    if (this._viewportGestureDirty && this._pointers.size === 0 && !acceptedRoom) {
      this._viewportGestureDirty = false;
      this.requestUpdate();
    }
    if (acceptedRoom) this._fitRoom(acceptedRoom);
  }

  private _clickRoom(r: RoomCfg): void {
    if (this._suppressClick || !r.area) return;
    navigate('/config/areas/area/' + r.area);
  }

  private _roomLabelKey(ev: KeyboardEvent, roomId: string): void {
    if (this._mode !== 'view' || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    ev.preventDefault();
    ev.stopPropagation();
    this._fitRoom(roomId);
  }

  private _pointerDown(ev: PointerEvent, d: DevItem): void {
    // Only View and the Devices editor own device input. In Background the
    // event must keep bubbling to the active decor tool; do not prevent it,
    // capture it or create a layout drag.
    if (this._mode !== 'view' && this._mode !== 'devices') return;
    if (this._mode === 'view') {
      // view: no drag, no capture — panning may start on an icon; only the
      // long-press timer runs (cancelled by stage movement)
      this._holdFired = false;
      clearTimeout(this._holdTimer);
      const pointerId = ev.pointerId;
      const source = ev.currentTarget as Element | null;
      this._holdTimer = window.setTimeout(() => {
        this._holdFired = true;
        this._interruptViewGesture(pointerId, source);
        this._infoCard = d;
      }, 600);
      return;
    }
    // A disabled ghost is a service entry point, not a movable plan object.
    // Leave the click intact so the settings dialog still opens.
    if (d.bindingStatus?.kind === 'ha_disabled' || this._devicePositionBusy) return;
    if (this._deviceDrag) {
      if (this._deviceDrag.pointerId !== ev.pointerId) this._cancelDeviceDrag();
      return;
    }
    ev.preventDefault();
    const p = this._pos(d);
    this._deviceDrag = {
      id: d.id,
      spaceId: d.space,
      displayName: d.name,
      pointerId: ev.pointerId,
      source: ev.currentTarget as Element | null,
      sx: ev.clientX,
      sy: ev.clientY,
      ox: p.x,
      oy: p.y,
      moved: false,
      before: devicePlacement(this._layout, d.id),
      start: this._devicePlacementForCanvas(d, p.x, p.y),
    };
    capturePointer(ev);
    this._tip = null;
    this._syncLiveHover();
  }

  private _pointerMove(ev: PointerEvent, d: DevItem): void {
    if (this._mode !== 'devices') return;
    const drag = this._deviceDrag;
    if (!drag || drag.id !== d.id || drag.pointerId !== ev.pointerId) return;
    this._editorRuntimeOrThrow()._queuePointerMove('device', () => this._pointerMoveNow(ev, d));
  }

  private _pointerMoveNow(ev: PointerEvent, d: DevItem): void {
    if (this._mode !== 'devices') return;
    const drag = this._deviceDrag;
    if (!drag || drag.id !== d.id || drag.pointerId !== ev.pointerId) return;
    const stage = this.renderRoot.querySelector('.stage') as HTMLElement;
    if (!stage) return;
    const vb = this._baseVb();
    const rect = stage.getBoundingClientRect();
    const v = this._viewOr(vb);
    const dx = ((ev.clientX - drag.sx) / rect.width) * v.w;
    const dy = ((ev.clientY - drag.sy) / rect.height) * v.h;
    if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 3) {
      drag.moved = true;
      clearTimeout(this._holdTimer);
    }
    // DEV-B58-01. This used to be clamped into `vb` — the CONTENT FRAME — with
    // a 0.8 % margin, which is exactly the "old canvas border" the owner ran
    // into: a marker could never be dragged past the outline of whatever was
    // already drawn, so a plan could not be extended by moving a device out to
    // where the new room was going to be. The plan has no edges any more
    // (docs/CANVAS.md §9); the only bound is the garbage limit the backend
    // enforces, and it is the SAME ±5000 on both sides of the wire.
    const nx = clampCanvasR(drag.ox + dx);
    const ny = clampCanvasR(drag.oy + dy);
    this._previewDevicePlacement(d.id, this._devicePlacementForCanvas(d, nx, ny));
  }
  private _pointerUp(ev: PointerEvent, d: DevItem): void {
    clearTimeout(this._holdTimer);
    if (this._mode !== 'devices') return;
    const drag = this._deviceDrag;
    if (!drag || drag.id !== d.id || drag.pointerId !== ev.pointerId) return;
    this._editorRuntimeOrThrow()._flushPointerMove('device');
    this._deviceDrag = null;
    const after = devicePlacement(this._layout, d.id);
    if (!drag.moved || after === null || sameDevicePlacement(after, drag.start)) {
      this._previewDevicePlacement(d.id, drag.before);
      return;
    }

    this._selId = d.id;
    this._suppressClick = true;
    window.setTimeout(() => { this._suppressClick = false; }, 0);
    this._devicePositionBusy = true;
    this.requestUpdate();
    void this._persistDevicePlacement(d.id, after)
      .then(() => {
        const name = this._t('history.device_move', { name: drag.displayName });
        this._devicePositionHistory.push({
          name,
          before: {
            deviceId: drag.id, spaceId: drag.spaceId, placement: drag.before,
          },
          after: {
            deviceId: drag.id, spaceId: drag.spaceId, placement: after,
          },
        });
      })
      .catch((error: unknown) => {
        this._previewDevicePlacement(d.id, drag.before);
        this._showToast(this._t('toast.pos_save_failed', { err: this._errText(error) }));
      })
      .finally(() => {
        this._devicePositionBusy = false;
        this.requestUpdate();
      });
  }
  private _pointerCancel(ev: PointerEvent, d: DevItem): void {
    if (this._deviceDrag?.id !== d.id || this._deviceDrag.pointerId !== ev.pointerId) return;
    this._cancelDeviceDrag();
  }

  private _showToast(msg: string): void {
    // A toast supersedes transient explanatory surfaces in this card only.
    // Dialogs own their portal/overlay registry, so another card stays intact.
    for (const dialog of this.renderRoot.querySelectorAll<HpDialog>('hp-dialog')) {
      dialog.closeTransientOverlays('toast');
    }
    this._toast = msg;
    clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => {
      this._toast = '';
    }, 3500);
  }

  /** Publish the instance-local input authority to nested shared controls. */
  private _syncPointerHoverTargets(): void {
    const enabled = this._pointerModality.hoverEnabled;
    for (const target of this.renderRoot.querySelectorAll<HTMLElement>(
      POINTER_HOVER_TARGET_SELECTOR,
    )) {
      target.toggleAttribute('data-pointer-hover', enabled);
    }
  }

  private _syncPointerHoverSubtree(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const enabled = this._pointerModality.hoverEnabled;
    if (element.matches(POINTER_HOVER_TARGET_SELECTOR)) {
      element.toggleAttribute('data-pointer-hover', enabled);
    }
    for (const target of element.querySelectorAll<HTMLElement>(
      POINTER_HOVER_TARGET_SELECTOR,
    )) {
      target.toggleAttribute('data-pointer-hover', enabled);
    }
  }

  /** Remove visual state that can only be owned by a live mouse hover. */
  private _clearTransientHover(suspend = false): void {
    if (suspend) this._pointerModality.suspend();
    if (this._tip) this._tip = null;
    if (this._hoverRoom) this._hoverRoom = null;
    this._syncLiveHover();
  }

  /** The latest real pointer event, not a page-global first-touch latch, owns hover. */
  private _notePointer(ev: PointerEvent): void {
    const previous = this._pointerModality.modality;
    const modality = this._pointerModality.note(ev);
    if ((modality === 'touch' || modality === 'pen')
        && (previous !== modality || !!this._tip || !!this._hoverRoom)) {
      this._clearTransientHover();
    }
  }

  /**
   * Capture-phase guard for browser clicks synthesized after touch gestures.
   *
   * `_suppressClick` covers a pan/pinch that the stage itself observed. The
   * contact set closes the other path: an interactive child is allowed to stop
   * pointer propagation, but it is not allowed to hide/navigate/toggle from one
   * finger of a two-finger gesture. The short tail also covers WebKit emitting
   * `click` after the final pointerup rather than in the same task.
   */
  private _guardTouchGesture(ev: Event): void {
    if (this._editorSecondary?.handleOutsideDismiss(ev)) return;
    if (ev.type === 'click') {
      if (!this._suppressClick && !this._touchSequenceMultitouch
          && Date.now() > this._touchClickBlockUntil) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }
    const pointer = ev as PointerEvent;
    this._notePointer(pointer);
    if (ev.type === 'pointercancel' || ev.type === 'lostpointercapture') this._doubleFit.clear(); else if (ev.type === 'pointerdown') this._doubleFit.clearOutside(pointer);
    if (pointer.pointerType !== 'touch') return;
    if (ev.type === 'pointerdown') {
      this._touchContacts.set(pointer.pointerId, {
        x: pointer.clientX,
        y: pointer.clientY,
        inStage: !!(pointer.target as Element | null)?.closest?.('.stage'),
      });
      if (this._touchContacts.size >= 2) {
        this._clearRoomFocus(true);
        this._clearTransientHover();
        this._touchSequenceMultitouch = true;
        this._touchClickBlockUntil = Number.POSITIVE_INFINITY;
        clearTimeout(this._holdTimer);
        clearTimeout(this._kioskHoldTimer);
        this._swipeStart = null;
        // Viewing is the guaranteed touch surface. Seed its existing stage
        // pinch pipeline even when a child swallowed the first pointerdown.
        const contacts = [...this._touchContacts.values()];
        if (this._mode === 'view' && !this._vacFit
            && contacts.every((contact) => contact.inStage)) {
          this._pointers = new Map([...this._touchContacts].map(([id, contact]) => [
            id, { x: contact.x, y: contact.y },
          ]));
          const [a, b] = contacts;
          this._pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this._zoom };
          this._panStart = null;
          this._panLock = null;
        } else if (this._vacFit) {
          this._pointers.clear();
          this._pinchStart = null;
          this._panStart = null;
          this._panLock = null;
        }
      }
      return;
    }
    if (ev.type === 'pointermove') {
      const contact = this._touchContacts.get(pointer.pointerId);
      if (!contact) return;
      const next = { ...contact, x: pointer.clientX, y: pointer.clientY };
      this._touchContacts.set(pointer.pointerId, next);
      if (this._touchSequenceMultitouch && this._mode === 'view' && !this._vacFit && this._pinchStart
          && [...this._touchContacts.values()].every((item) => item.inStage)) {
        this._pointers.set(pointer.pointerId, { x: pointer.clientX, y: pointer.clientY });
        const contacts = [...this._touchContacts.values()];
        if (contacts.length >= 2 && this._stageEl) {
          const [a, b] = contacts;
          const scale = Math.hypot(a.x - b.x, a.y - b.y) / (this._pinchStart.dist || 1);
          const rect = this._stageEl.getBoundingClientRect();
          this._zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top,
            this._pinchStart.zoom * scale);
          this._saveZoom();
        }
      }
      return;
    }
    if (ev.type !== 'pointerup' && ev.type !== 'pointercancel'
        && ev.type !== 'lostpointercapture') return;
    this._clearTransientHover();
    this._touchContacts.delete(pointer.pointerId);
    if (this._touchSequenceMultitouch) {
      this._touchClickBlockUntil = Date.now() + 500;
      this._pointers.delete(pointer.pointerId);
      if (!this._vacFit && this._pointers.size >= 2) {
        const [a, b] = [...this._pointers.values()];
        this._pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this._zoom };
      } else {
        this._pinchStart = null;
      }
      if (this._pointers.size === 0) {
        this._panStart = null;
        this._panLock = null;
      }
    }
    if (this._touchContacts.size === 0) this._touchSequenceMultitouch = false;
  }

  private _showTip(
    ev: PointerEvent,
    title: string,
    meta: string,
    lqi?: number | null,
    temp?: number | null,
    hum?: number | null,
    room = false,
  ): void {
    this._notePointer(ev);
    if (!this._pointerModality.hoverEnabled) return;
    if (this._drag || this._deviceDrag) return;
    this._tip = { x: ev.clientX, y: ev.clientY, title, meta, lqi, temp, hum, room };
    this._syncLiveHover();
  }

  /** Room pointer preflight stays authoritative even when its tooltip is off. */
  private _roomTipEnabledForPointer(ev: PointerEvent): boolean {
    if (this._mode !== 'view') return false;
    this._notePointer(ev);
    if (showRoomTooltipOf(this._settings)) return true;
    if (this._tip?.room) { this._tip = null; this._syncLiveHover(); }
    return false;
  }

  // ================= ROOM MARKUP EDITOR =================

  private get _gridPitch(): number {
    // NORM_W / GRID_N and nothing else. The infinite canvas did NOT touch this
    // (docs/CANVAS.md §9): the step is the same for every plan, at every zoom,
    // whatever the content frame happens to be — so no existing plan's nodes
    // ever moved out from under it.
    return GRID_PITCH;
  }

  /** cm represented by one grid cell for the current space (default 5). */
  private get _cellCm(): number {
    const v = Number(this._curSpaceCfg?.cell_cm);
    return Number.isFinite(v) && v > 0 ? v : 5;
  }

  /** Human-readable length of a segment (render units) using the HA unit system. */
  private _fmtLen(a: number[], b: number[]): string {
    const cm = segmentCm(a, b, this._gridPitch, this._cellCm);
    return formatLength(cm, this.hass?.config?.unit_system?.length === 'mi');
  }

  private get _curSpaceCfg(): any {
    // HP-1550-01: while a resize drag is live, every render-path reader sees
    // the preview overlay; _writeConfig deliberately reads _serverCfg instead,
    // so a queued write can never pick the preview up.
    const pv = this._resize?.preview;
    if (pv && pv.space === this._space) return pv.sp;
    return this._serverCfg?.spaces.find((s: any) => s.id === this._space);
  }

  /** The config AS RENDERED: _serverCfg with the live resize preview substituted in. */
  private get _renderCfg(): ServerConfig | null {
    const pv = this._resize?.preview;
    if (!pv || !this._serverCfg) return this._serverCfg;
    return {
      ...this._serverCfg,
      spaces: this._serverCfg.spaces.map((s: any) => (s.id === pv.space ? pv.sp : s)),
    };
  }

  private get _spaceH(): number {
    const sp = this._curSpaceCfg;
    return NORM_W; // square canvas
  }

  /**
   * Walls of the current space in render units — DERIVED from the room outlines.
   * There is no standalone "line" entity: every wall belongs to a closed room, and a
   * wall shared with a neighbour survives deleting either room (the other still yields it).
   */
  private get _segments(): number[][] {
    const sp = this._curSpaceCfg;
    const H = this._spaceH;
    return roomEdges(sp?.rooms || []).map((s) => [s[0] * NORM_W, s[1] * H, s[2] * NORM_W, s[3] * H]);
  }

  private _savedNav(): { space?: string } | null {
    if (this._hasFixedFloor) return null;
    try {
      return JSON.parse(localStorage.getItem(LS_NAV) || 'null');
    } catch {
      return null;
    }
  }

  private _saveNav(): void {
    if (this._hasFixedFloor) return;
    try {
      // Writing on every mode/space change also migrates legacy
      // `{ space, mode }` records by dropping their obsolete editor field.
      localStorage.setItem(LS_NAV, JSON.stringify({ space: this._space }));
    } catch {
      /* private mode etc. */
    }
  }

  /**
   * A route change is a real departure from the card, unlike a same-route
   * Lovelace remount. End the editing session before its old warm slot can be
   * adopted on return. Space remains persisted; editor mode, selections,
   * dialogs and editor viewport do not.
   */
  private _leaveCardRoute(): void {
    if (this._routeDepartureHandled) return;
    this._routeDepartureHandled = true;
    this._clearRoomFocus(true); this._cancelDangerConfirm();
    // The destination page cannot display this decorative transition and may
    // disconnect us before its first measured frame. Commit View atomically so
    // the warm tombstone never records an editor camera under `mode: view`.
    if (this._mode !== 'view') this._setMode('view', false);
    this._pendingNavMode = null;
    this._geometryHistory.clear();
    this._activeDraftId = null;
    this._resumeDraftBySpace = {};
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._drawWallField = null;
    this._showHidden = false;

    // A same-element reattach must not render an editor-only modal over View.
    this._tapConfirm = null;
    this._vacCalConfirm = null;
    this._decorEraseConfirm = null;
    this._openingInfo = null;
    this._closeInfoCard();
    this._rulesDialog = null;
    this._alignDialog = null;
    this._preflightClipboardFallback = null;
    this._backupImportDialog = null;
    this._backupExportDialog = null;
    if (this._supportDialog?.preview?.token) {
      void this._editorRuntime?._discardSupportPreview(this._supportDialog.preview.token);
    }
    this._supportDialog = null;
    this._settingsDialog = null;
    this._deviceInbox = null;
    this._deviceInboxReturn = null;
    this._markerDialog = null;
    this._openingDialog = null;
    this._physicalDialog = null;
    this._wallDialog = null;
    this._backdropDialog = null;
    this._decorShapeDialog = null;
    this._decorTextDialog = null;
    this._mergeDialog = null;
    this._roomDialog = false;
    this._spaceDialog = null;
    this._importDialog = null;

    // `_warmPatch()` intentionally refuses to write under a different path,
    // because warmBootKey already belongs to the route we just left. Seal the
    // owned slot directly with the safe return state and discard its painted
    // editor fingerprint; a later instance may still reuse settled dimensions
    // and device metadata, but never the editor or its draft.
    const slot = this._warmSlot;
    if (slot?.owner === this._warmGen) {
      slot.vp = this._warmViewportState();
      slot.dlg = null;
      slot.frameFingerprint = '';
      clearTimeout(slot.evict);
      slot.evict = 0;
    }
    this._saveNav();
  }

  private _setMode(mode: 'view' | 'plan' | 'devices' | 'decor', animate = true): void {
    if (mode !== this._mode) {
      this._clearRoomFocus(true);
      this._cancelDangerConfirm();
    }
    this._warmModeRequest = 0;
    if (!this._editorRuntime) {
      if (mode === 'view') {
        // Cancel a pending editor intent without disturbing the unchanged View.
        this._editorModeRequest++;
        return;
      }
      void this._requestMode(mode, animate);
      return;
    }
    return this._editorRuntime._setMode(mode, animate);
  }

  /** Prime the Draw thickness field to 15 cm once per Plan session. */
  private _primeDrawWallField(): void {
    return this._editorRuntimeOrThrow()._primeDrawWallField();
  }

  private get _drawWallFieldValue(): string {
    if (this._drawWallField === null) {
      return cmToField(DRAW_WALL_DEFAULT_CM, this._imperial);
    }
    return this._drawWallField;
  }

  private get _drawWallCm(): number | null {
    const raw = strictNumber(this._drawWallFieldValue);
    if (raw == null || raw < 0) return null;
    const cm = this._imperial ? raw * 2.54 : raw;
    const max = this._tool === 'column' ? COLUMN_MAX_CM : 100;
    const min = this._tool === 'column' ? 1 : 0;
    return cm >= min && cm <= max ? cm : null;
  }

  private get _drawWallMaxCm(): number {
    return this._tool === 'column' ? COLUMN_MAX_CM : 100;
  }

  private _showPhysicalRange(max = this._drawWallMaxCm, min = 0): void {
    return this._editorRuntimeOrThrow()._showPhysicalRange(max, min);
  }

  private _draftSegmentCount(sp = this._curSpaceCfg as any): number {
    return this._editorRuntimeOrThrow()._draftSegmentCount(sp);
  }

  /**
   * Finish the active Walls chain because the user changed tool/mode/space.
   * A saved draft is crash safety only; once explicitly finished, its segments
   * become ordinary selectable partitions and can never auto-resume.
   */
  /**
   * Collapse collinear partitions of one thickness (issue #229).
   *
   * `seedIds` confines the sweep to the connected component containing the
   * freshly drawn chain; the optimiser calls the pure module without seeds.
   * Openings ride along: their position is stored as a fraction of the host's
   * length, so every merge has to rewrite both the fraction and the legacy
   * `x/y/angle` projection that older readers still consume (#132).
   */
  private _mergeSpacePartitions(sp: any, seedIds?: string[]): number {
    return this._editorRuntimeOrThrow()._mergeSpacePartitions(sp, seedIds);
  }

  private _finishWallChain(): boolean {
    return this._editorRuntimeOrThrow()._finishWallChain();
  }

  /** One transition gate for Plan toolbar tools. */
  private _activateMarkupTool(tool: MarkupTool): void {
    return this._editorRuntimeOrThrow()._activateMarkupTool(tool);
  }

  private _limitReached(kind: 'draft' | 'partition' | 'column'): boolean {
    return this._editorRuntimeOrThrow()._limitReached(kind);
  }


  private _svgPoint(ev: MouseEvent): number[] {
    return this._editorRuntimeOrThrow()._svgPoint(ev);
  }

  /**
   * THE snap (docs/CANVAS.md §9). Every editor gesture that produces a plan
   * coordinate goes through here, so "strictly on the grid" is one function
   * and not a habit. No modifier bypasses it. The canvas clamp rides along: there are no edges
   * to bump into any more, only the ±5000 the backend refuses to store.
   */
  private _snap(p: number[]): number[] {
    return this._editorRuntimeOrThrow()._snap(p);
  }

  /** Grid snap for the free end of the wall currently being drawn. */
  private _snapDrawPoint(p: number[], lock45 = false): number[] {
    return this._editorRuntimeOrThrow()._snapDrawPoint(p, lock45);
  }

  /** Canonical physical opening slots on room-wall centrelines. */
  private _planSnapOpeningCuts(space: SpaceModel, openCuts: number[][]): number[][] {
    return this._editorRuntimeOrThrow()._planSnapOpeningCuts(space, openCuts);
  }

  /** Static presentation axes shared by the overlay and its hit resolver. */
  private _planSnapGeometrySnapshot(): { key: string; value: PlanSnapGeometry } {
    return this._editorRuntimeOrThrow()._planSnapGeometrySnapshot();
  }

  /** Independent sources hidden under another wall, without snap deduplication. */
  private _hiddenWallDiagnosticSnapshot(): {
    key: string; value: HiddenWallDiagnosticGeometry;
  } {
    return this._editorRuntimeOrThrow()._hiddenWallDiagnosticSnapshot();
  }

  /**
   * Room-face topology deliberately ignores door/window/gate/passage slots:
   * an opening cuts masonry but does not remove the owning wall from a room
   * contour (#185). A zero-thickness wall also remains topology (#306).
   * Keeping this snapshot separate preserves the established face contract.
   */
  private _planStructuralGeometrySnapshot(): { key: string; value: PlanSnapGeometry } {
    return this._editorRuntimeOrThrow()._planStructuralGeometrySnapshot();
  }

  private _planSnapContextKey(geometryKey: string): string {
    return this._editorRuntimeOrThrow()._planSnapContextKey(geometryKey);
  }

  private _resolvePlanDrawPoint(
    raw: number[], lock45: boolean,
  ): {
    point: number[]; candidate: PlanSnapCandidate | null;
    conflicts: PlanSnapEndpoint[]; ambiguous: boolean; contextKey: string;
  } {
    return this._editorRuntimeOrThrow()._resolvePlanDrawPoint(raw, lock45);
  }

  private get _activePlanSnapCandidate(): PlanSnapCandidate | null {
    if (!this._markup || this._tool !== 'draw') return null;
    const hover = this._planSnapHover;
    if (!hover) return null;
    const snapshot = this._planSnapGeometrySnapshot();
    return hover.contextKey === this._planSnapContextKey(snapshot.key) ? hover.candidate : null;
  }

  private get _activePlanSnapConflicts(): PlanSnapEndpoint[] {
    if (!this._markup || this._tool !== 'draw') return [];
    const hover = this._planSnapHover;
    if (!hover) return [];
    const snapshot = this._planSnapGeometrySnapshot();
    return hover.contextKey === this._planSnapContextKey(snapshot.key) ? hover.conflicts : [];
  }

  private _clearPlanSnapHover(clearCursor = true): void {
    if (!this._editorRuntime) {
      this._planSnapHover = null;
      if (clearCursor) this._cursorPt = null;
      return;
    }
    return this._editorRuntimeOrThrow()._clearPlanSnapHover(clearCursor);
  }

  private _samePt(a: readonly number[], b: readonly number[]): boolean {
    return samePoint(a, b);
  }

  /**
   * Room-boundary walls are derived from rooms, so the legacy per-space
   * `segments` array is dead weight. Independent walls live in the typed
   * `partitions` collection and must never be confused with that legacy field.
   */
  private _dropLegacySegments(): void {
    return this._editorRuntimeOrThrow()._dropLegacySegments();
  }

  /**
   * Config writes are serialized (HP-1454-03).
   *
   * The debounce only spaced out the *starts*. If a write took longer than
   * 500 ms — a busy instance, a slow link — the next edit went out with the
   * same `expected_rev`, the server accepted the first and rejected the second
   * as a conflict, and the conflict handler reloaded the server copy over the
   * local one. The user's second edit was gone, with a toast that blamed
   * another window when there was none.
   *
   * One chain, one write in flight. A write always reads `_serverCfg` at the
   * moment it runs, so edits made while another write was out are carried by
   * the next one, with the revision that write returned.
   */
  private _writesPending = 0;
  private _writeChain: Promise<void> = Promise.resolve();
  private _pendingPhysicalWrites = new Map<string, {
    fingerprint: string; before: SpaceGeometryState;
  }>();

  /**
   * A rejected config/set accepted no part of its payload. Restore every
   * physical space carried by that request to the earliest server-backed
   * snapshot, including newer edits made on the same unaccepted base while the
   * request was in flight. Ambiguous persisted walls are never inspected or
   * cleaned here: this is transaction rollback, not repair (#314).
   */
  private _rollbackRejectedPhysicalWrites(
    entries: Array<[string, { fingerprint: string; before: SpaceGeometryState }]>,
  ): boolean {
    return this._editorRuntimeOrThrow()._rollbackRejectedPhysicalWrites(entries);
  }

  /** Revalidate the synchronous rollback after every write already queued. */
  private async _reloadRejectedPhysicalWrite(): Promise<void> {
    return this._editorRuntimeOrThrow()._reloadRejectedPhysicalWrite();
  }

  /** A config write is in flight — the card must not adopt a server revision. */
  private get _cfgWriting(): boolean {
    return this._writesPending > 0;
  }

  /**
   * The sole frontend config transport.  Keeping the final canonicalization at
   * this boundary makes View-owned metadata writes and strict editor writes
   * converge on the same payload contract without making View load the editor.
   */
  private async _sendConfigCandidate(candidate: ServerConfig): Promise<void> {
    const canonicalCandidate = canonicalizeConfigGeometry(candidate);
    const response = await this.hass.callWS({
      type: 'houseplan/config/set', config: canonicalCandidate, expected_rev: this._cfgRev,
    });
    this._cfgRev = response?.rev ?? this._cfgRev + 1;
  }

  private _writeConfig(): Promise<void> {
    if (this._editorRuntime) return this._editorRuntime._writeConfig();
    // Registry discovery may update shared metadata while the card is still
    // display-only. Persist that small View-owned mutation without pulling in
    // the editor runtime; strict physical-write validation is impossible here
    // because such writes can only be created by an installed editor.
    this._writesPending++;
    this._writeChain = enqueueSerializedWrite(this._writeChain, async () => {
      if (!this._serverCfg) return;
      const candidate = canonicalizeConfigGeometry(this._serverCfg);
      const candidateFingerprint = contentFingerprint(candidate);
      if (candidateFingerprint !== contentFingerprint(this._serverCfg)) {
        this._serverCfg = candidate;
      }
      this._cfgContentFingerprint = candidateFingerprint;
      await this._sendConfigCandidate(candidate);
    });
    const mine = this._writeChain.finally(() => { this._writesPending--; });
    return mine;
  }

  /**
   * Every mutation path ends here, so this is the one place that can invalidate
   * the geometry caches synchronously. The WRITE stays debounced; the epoch bump
   * must not be (audit L1: a bump inside the debounce arrives 500 ms after the
   * render that needed it, and the plan renders stale geometry).
   */
  private _saveConfig(): void {
    this._cfgEpoch++;
    this._saveConfigDebounced();
  }

  /** Deep, immutable geometry state from the real config (never Resize preview). */
  private _geometrySnapshotFromConfig(config: any, spaceId: string): SpaceGeometryState | null {
    return this._editorRuntimeOrThrow()._geometrySnapshotFromConfig(config, spaceId);
  }

  private _geometrySnapshot(spaceId = this._space): SpaceGeometryState | null {
    return this._editorRuntimeOrThrow()._geometrySnapshot(spaceId);
  }

  /** Finish one geometry transaction and invalidate the redo branch. */
  private _recordGeometry(name: string, before: SpaceGeometryState | null): void {
    return this._editorRuntimeOrThrow()._recordGeometry(name, before);
  }

  /** Replace only persisted geometry in memory; no history entry and no WS. */
  private _restoreGeometryStateInConfig(
    config: any, state: SpaceGeometryState, preserveIdentityHints = false,
  ): boolean {
    return this._editorRuntimeOrThrow()._restoreGeometryStateInConfig(config, state, preserveIdentityHints);
  }

  private _restoreGeometryStateLocal(state: SpaceGeometryState): boolean {
    return this._editorRuntimeOrThrow()._restoreGeometryStateLocal(state);
  }

  /** Shared fail-closed transaction boundary for every physical writer. */
  private _wallModelBlockerLabel(error: unknown): string {
    return this._editorRuntimeOrThrow()._wallModelBlockerLabel(error);
  }

  /** A legacy virtual-wall projection is still present only until its first
   * structural v9 write. Keep its atomic-failure copy distinct from generic
   * wall-model validation without persisting provenance on the new atoms. */
  private _hasLegacyZeroWallFields(config: any = this._serverCfg): boolean {
    return this._editorRuntimeOrThrow()._hasLegacyZeroWallFields(config);
  }

  private _showWallModelMigrationBlocked(error: unknown): void {
    return this._editorRuntimeOrThrow()._showWallModelMigrationBlocked(error);
  }

  /** #329: every wall of a space as the limit checks see it. */
  private _limitSegmentsOf(space: any): LimitSegment[] {
    return this._editorRuntimeOrThrow()._limitSegmentsOf(space);
  }

  /** #329 П1-П5 over one space. Pure input, no side effects. */
  private _junctionLimitViolations(config: unknown, spaceId: string,
    sharedGeometry?: JunctionSharedGeometry | null,
    roomIds?: ReadonlySet<string>): JunctionLimitViolation[] {
    return this._editorRuntimeOrThrow()._junctionLimitViolations(config, spaceId, sharedGeometry, roomIds);
  }

  /** Localised refusal text for the first violation a write introduces. */
  private _junctionLimitLabel(violation: JunctionLimitViolation): string {
    return this._editorRuntimeOrThrow()._junctionLimitLabel(violation);
  }

  /** #329: violations this write would ADD; inherited ones stay untouched. */
  private _junctionLimitsIntroduced(
    candidate: ServerConfig, previousConfig: ServerConfig, spaceId: string,
  ): JunctionLimitViolation[] {
    return this._editorRuntimeOrThrow()._junctionLimitsIntroduced(candidate, previousConfig, spaceId);
  }

  private _commitPhysicalGeometry(
    name: string,
    before: SpaceGeometryState | null,
    additionalAuthoredPoints: readonly (readonly number[])[] = [],
  ): boolean {
    return this._editorRuntimeOrThrow()._commitPhysicalGeometry(name, before, additionalAuthoredPoints);
  }

  /** Drop every transient gesture before replacing committed geometry. */
  private _clearGeometryGesture(): void {
    if (!this._editorRuntime) {
      // Empty-install onboarding is intentionally independent from the editor
      // chunk.  Before that chunk exists there can be no live editor gesture,
      // but warm state may still carry inert draft fields: clear them eagerly
      // so the empty-state reset never pulls editor code into View.
      this._path = [];
      this._planSnapHover = null;
      this._cursorPt = null;
      this._openingHoverCandidate = null;
      this._openingJambBlockCm = null;
      this._openingPreset = null;
      this._openingRebindId = null;
      this._mergeSel = null;
      this._mergeDialog = null;
      this._splitSel = null;
      this._pendingSplit = null;
      this._wallFaceBatch = null;
      this._wallRepairDiagnostic = null;
      this._roomDeleteDialog = null;
      this._wallDialog = null;
      this._physicalDialog = null;
      this._physicalSel = null;
      this._physicalDrag = null;
      this._physicalRotate = null;
      this._activeDraftId = null;
      this._draftSegmentCms = [];
      this._closingWallCm = null;
      this._openingDialog = null;
      this._resize?.reset();
      this._decorDraft = null;
      this._decorMove = null;
      this._dtDrag = null;
      this._bdDrag = null;
      return;
    }
    return this._editorRuntimeOrThrow()._clearGeometryGesture();
  }

  /** Browser/OS cancellation is an aborted transaction, never a commit. */
  private _stagePointerCancel(ev: PointerEvent): void {
    this._flushHa();
    this._editorRuntime?._cancelPointerMove('markup-hover');
    if (this._roomPointer?.pointerId === ev.pointerId) this._roomPointer = null; this._doubleFit.clear();
    if (this._editorRuntime) return this._editorRuntime._stagePointerCancel(ev);
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinchStart = null;
    if (this._pointers.size === 0) {
      this._panStart = null;
      this._panLock = null;
      this._swipeStart = null;
    }
    if (this._viewportGestureDirty && this._pointers.size === 0) {
      this._viewportGestureDirty = false;
      this.requestUpdate();
    }
  }

  private _applyGeometryState(
    state: SpaceGeometryState, allowHistoryBoundaryRepair = false,
  ): boolean {
    return this._editorRuntimeOrThrow()._applyGeometryState(state, allowHistoryBoundaryRepair);
  }

  private _undoGeometry = (): void => {
    return this._editorRuntimeOrThrow()._undoGeometry();
  }

  private _redoGeometry = (): void => {
    return this._editorRuntimeOrThrow()._redoGeometry();
  }

  private _saveConfigDebounced = debounce(() => {
    if (!this._serverCfg) return;
    this._writeConfig().catch((e: any) => {
      const physicalRollback = e?.physicalGeometryRolledBack === true;
      if (e?.code === 'geometry-unsafe') {
        return;
      } else if (e?.code === 'wall_model_client_outdated') {
        this._showToast(this._t('toast.wall_model_client_outdated'));
      } else if (e?.code === 'conflict') {
        // a real one now: another window wrote between our read and our write
        this._showToast(this._t('toast.conflict'));
        if (!physicalRollback) {
          this._cancelPath();
          void this._reloadConfigOnly(true);
        }
      } else {
        this._showToast(this._t('toast.cfg_save_failed', { err: this._errText(e) }));
      }
      if (physicalRollback) void this._reloadRejectedPhysicalWrite();
    });
  }, 500);

  /**
   * The room that strictly contains p. Being ON a wall does not count: neighbouring
   * rooms share walls, so new vertices legitimately land on existing outlines.
   */
  private _roomAt(p: number[]): RoomCfg | undefined {
    return this._editorRuntimeOrThrow()._roomAt(p);
  }

  /** The first existing room the outline would overlap (rooms must not overlap). */
  private _overlapRoom(verts: number[][]): RoomCfg | undefined {
    return this._editorRuntimeOrThrow()._overlapRoom(verts);
  }

  private _pointInRoom(p: number[], r: RoomCfg): boolean {
    if (r.poly) return pointInPolygon(p, r.poly);
    return r.x != null && p[0] >= r.x && p[0] <= r.x + r.w!
      && p[1] >= r.y! && p[1] <= r.y! + r.h!;
  }

  /** A room ring may meet only at the endpoints of neighbouring edges. */
  private _contourSelfIntersects(poly: number[][]): boolean {
    return this._editorRuntimeOrThrow()._contourSelfIntersects(poly);
  }

  /** The same append limits guard both an ordinary point and an auto-close terminal point. */
  private _canAppendRoomDraftPoint(): boolean {
    return this._editorRuntimeOrThrow()._canAppendRoomDraftPoint();
  }

  private _markupClick(ev: MouseEvent): void {
    if (!this._editorRuntime) return;
    return this._editorRuntime._markupClick(ev);
  }

  private _draftSegmentCms: number[] = [];
  private _closingWallCm: number | null = null;

  private _draftEndAt(
    pt: number[], excludeId?: string,
  ): { draft: RoomDraftCfg; reverse: boolean } | null {
    return this._editorRuntimeOrThrow()._draftEndAt(pt, excludeId);
  }

  private _mergeDraftEndpoint(
    hit: { draft: RoomDraftCfg; reverse: boolean },
  ): void {
    return this._editorRuntimeOrThrow()._mergeDraftEndpoint(hit);
  }

  /**
   * Thickness array adopted from storage, brought to the length of the path.
   *
   * A record written before #234 may be shorter than the path: the resolver
   * fills the gaps by the same rule the preview and the writers use, so a
   * resumed draft cannot carry a hidden 15 cm into the next save. Reported to
   * the console rather than to the user: the person did not cause it and cannot
   * fix it.
   */
  private _adoptDraftCms(path: readonly (readonly number[])[], recorded: readonly (number | null | undefined)[], id?: string): number[] {
    return this._editorRuntimeOrThrow()._adoptDraftCms(path, recorded, id);
  }

  /**
   * Carry persisted draft identity by its physical carrier, not by array index.
   * Resuming a chain from its opposite end reverses the path, and positional
   * copying used to silently attach every ID to the neighbouring segment.
   */
  private _draftSegmentsForPath(
    path: readonly (readonly number[])[], draft: any,
    cms: readonly (number | null | undefined)[],
  ): Array<{ id?: string; cm: number; [key: string]: any }> {
    return this._editorRuntimeOrThrow()._draftSegmentsForPath(path, draft, cms);
  }

  /**
   * Persist every completed draft segment immediately.
   *
   * The thickness of the new segment is already recorded by the caller (#234):
   * this method must not decide whether to record it, or the array and the path
   * drift apart the moment the toolbar field is mid-edit.
   */
  private _persistActiveDraftSegment(): void {
    return this._editorRuntimeOrThrow()._persistActiveDraftSegment();
  }

  private _activeWallSourceKey(index: number): string {
    return this._editorRuntimeOrThrow()._activeWallSourceKey(index);
  }

  /** Canonical solid axes plus one immutable projection of the active chain. */
  private _wallGraphSources(path: readonly (readonly number[])[]): WallGraphSourceSegment[] {
    return this._editorRuntimeOrThrow()._wallGraphSources(path);
  }

  private _wallFaceGraph(
    sources: readonly WallGraphSourceSegment[], epsilon: number,
  ): WallFaceGraph {
    return this._editorRuntimeOrThrow()._wallFaceGraph(sources, epsilon);
  }

  /** Detect click-induced faces and open a mutation-free decision queue. */
  private _offerWallFaces(
    beforePath: number[][],
    addedSegmentIndex = this._path.length - 2,
    beforeGraphSources?: WallGraphSourceSegment[],
  ): void {
    return this._editorRuntimeOrThrow()._offerWallFaces(beforePath, addedSegmentIndex, beforeGraphSources);
  }

  private _beginWallFaceBatch(candidates: WallFaceCandidate[]): void {
    return this._editorRuntimeOrThrow()._beginWallFaceBatch(candidates);
  }

  /** Offer the smallest unoccupied exact face under an idle Walls click. */
  private _offerExistingWallFace(raw: number[]): boolean {
    return this._editorRuntimeOrThrow()._offerExistingWallFace(raw);
  }

  private _columnClick(raw: number[]): void {
    return this._editorRuntimeOrThrow()._columnClick(raw);
  }

  private _openPhysicalDialog(
    kind: 'partition' | 'column' | 'draft', id: string, segment?: number,
  ): void {
    return this._editorRuntimeOrThrow()._openPhysicalDialog(kind, id, segment);
  }

  private _savePhysicalDialog = (): void => {
    return this._editorRuntimeOrThrow()._savePhysicalDialog();
  }

  private _deletePhysicalSelection = (): Promise<void> => {
    return this._editorRuntimeOrThrow()._deletePhysicalSelection();
  }

  private _confirmPartitionDelete = (): void => {
    return this._editorRuntimeOrThrow()._confirmPartitionDelete();
  }

  private _deleteDraftWhole = (): Promise<void> => {
    return this._editorRuntimeOrThrow()._deleteDraftWhole();
  }

  private _deleteDraftSegment = (): Promise<void> => {
    return this._editorRuntimeOrThrow()._deleteDraftSegment();
  }

  private _physicalDown(ev: PointerEvent, kind: 'partition' | 'column', id: string): void {
    return this._editorRuntimeOrThrow()._physicalDown(ev, kind, id);
  }

  private _clampPhysicalDelta(
    kind: 'partition' | 'column', base: PartitionCfg | WallColumnCfg, delta: number[],
  ): number[] {
    return this._editorRuntimeOrThrow()._clampPhysicalDelta(kind, base, delta);
  }

  private _physicalMove(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._physicalMove(ev);
  }

  private _physicalUp(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._physicalUp(ev);
  }

  private _registerPhysicalTap(
    kind: 'partition' | 'column' | 'draft', id: string, segment?: number,
  ): void {
    return this._editorRuntimeOrThrow()._registerPhysicalTap(kind, id, segment);
  }

  private _cancelPhysicalGesture(): void {
    return this._editorRuntimeOrThrow()._cancelPhysicalGesture();
  }

  private _physicalRotateDown(ev: PointerEvent, c: WallColumnCfg): void {
    return this._editorRuntimeOrThrow()._physicalRotateDown(ev, c);
  }

  private _physicalRotateMove(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._physicalRotateMove(ev);
  }

  private _physicalRotateUp(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._physicalRotateUp(ev);
  }


  // ================= room resize tool (docs/RESIZE.md) =================

  /** Rooms of the current space as render-unit polygons (legacy rects converted). */
  private _rszRooms(): { id: string; poly: number[][]; wall_ids?: string[] }[] {
    return this._editorRuntimeOrThrow()._rszRooms();
  }

  private _rszOpenings(): SafeOpeningIn[] {
    return this._editorRuntimeOrThrow()._rszOpenings();
  }

  private _rszObstacles(): SafeResizeObstacle[] {
    return this._editorRuntimeOrThrow()._rszObstacles();
  }

  private _rszOptsFor(a: number[], b: number[]): SafeResizeOptions {
    return this._editorRuntimeOrThrow()._rszOptsFor(a, b);
  }

  private _rszResolution(
    roomId: string, edge: number, renderSnapshot?: string,
  ): SafeResizeResolution {
    return this._editorRuntimeOrThrow()._rszResolution(roomId, edge, renderSnapshot);
  }

  private _rszSnapshot(): string {
    return this._editorRuntimeOrThrow()._rszSnapshot();
  }

  /** Lifecycle reset which cannot leave the memoized model on a discarded preview. */
  private _rszResetController(): void {
    return this._editorRuntimeOrThrow()._rszResetController();
  }

  /** Live preview of the candidate geometry, based on the immutable pre-drag snapshot —
   *  walls, fills, labels and openings all follow in the same render.
   *
   *  HP-1550-01: the preview must NEVER touch _serverCfg. It used to be written
   *  into the shared mutable space config, and the serialized write chain
   *  (HP-1454-03) reads `_serverCfg` AT THE MOMENT a write runs — so a debounced
   *  write still queued from a previous edit carried the mid-drag preview to the
   *  server before pointerup, and an Esc after that left the abandoned geometry
   *  persisted (reload resurrected it). Flushing the queue before the drag would
   *  not close it: the queued write reads the mutable config later anyway. The
   *  live geometry therefore lives in the controller preview overlay; _curSpaceCfg /
   *  _renderCfg feed it to every render, and only _rszUp moves it into the real
   *  config — the single point where a resize becomes visible to _writeConfig. */
  private _rszProjectPreview(
    snapshot: string,
    polys: Record<string, number[][]>,
    ops: Record<string, [number, number]>,
    changedRoomIds: readonly string[],
    sourceRooms: readonly { id: string; poly: number[][]; wall_ids?: string[] }[],
  ): ResizeProjectionResult<ResizePreview, ResizeWallArtifact> {
    return this._editorRuntimeOrThrow()._rszProjectPreview(snapshot, polys, ops, changedRoomIds, sourceRooms);
  }

  /** Publish one controller-accepted preview and retain its validated masonry pass. */
  private _rszAcceptPreview(
    preview: ResizePreview | null, wallGeometry: ResizeWallArtifact | null,
  ): void {
    return this._editorRuntimeOrThrow()._rszAcceptPreview(preview, wallGeometry);
  }

  /** Validate once and retain the exact geometry pass for the preview render. */
  private _rszSpaceCandidateGeometry(spaceId: string, sp: any): {
    ok: boolean;
    wallGeometry: ReturnType<typeof wallBodiesGeometry> | null;
  } {
    return this._editorRuntimeOrThrow()._rszSpaceCandidateGeometry(spaceId, sp);
  }

  /** Fail-closed check for one exact candidate through the common barrier. */
  private _rszSpaceCandidateRenderable(spaceId: string, sp: any): boolean {
    return this._editorRuntimeOrThrow()._rszSpaceCandidateRenderable(spaceId, sp);
  }

  /** Final identity guard for the exact overlay already shown to the user. */
  private _rszCandidateRenderable(preview: { space: string; sp: any } | null): boolean {
    return this._editorRuntimeOrThrow()._rszCandidateRenderable(preview);
  }

  private _rszEdgeDown(ev: PointerEvent, roomId: string, edge: number): void {
    return this._editorRuntimeOrThrow()._rszEdgeDown(ev, roomId, edge);
  }

  private _rszReasonText(reason: SafeResizeReason): string {
    return this._editorRuntimeOrThrow()._rszReasonText(reason);
  }

  private _rszDisabledActivate(ev: Event, reason: SafeResizeReason): void {
    return this._editorRuntimeOrThrow()._rszDisabledActivate(ev, reason);
  }

  private _rszDisabledKey(ev: KeyboardEvent, reason: SafeResizeReason): void {
    return this._editorRuntimeOrThrow()._rszDisabledKey(ev, reason);
  }

  private _rszMove(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._rszMove(ev);
  }

  private _rszUp(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._rszUp(ev);
  }

  private _rszCancelDrag(pointerId?: number): void {
    return this._editorRuntimeOrThrow()._rszCancelDrag(pointerId);
  }

  /** HP-1550-03: pointercancel / lostpointercapture is an ABORT, not a release —
   *  the system interrupted the stream (app switch, palm rejection), so the drag
   *  takes the cancel path: snapshot geometry, no undo step, no write. The pid
   *  guard also absorbs the lostpointercapture that follows a normal pointerup
   *  or a pointercancel (the drag is already gone — no double cancel/commit). */
  private _rszPointerCancel(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._rszPointerCancel(ev);
  }

  private _rszEdgeLabels(
    res: { polys: Record<string, number[][]> }, plan: SafeResizePlan,
    sourceRooms: readonly { id: string; poly: number[][] }[] | null = this._resize?.rooms,
  ): ResizeLiveLabel[] {
    return this._editorRuntimeOrThrow()._rszEdgeLabels(res, plan, sourceRooms);
  }

  /**
   * Внутренние длины рёбер комнаты в сантиметрах, по одному числу на ребро.
   *
   * Толщины берутся из атомарного профиля (#233): `thicknessCmAt` по целому
   * ребру возвращает 0 на ребре со сплит-толщиной, и подписи молча перестали бы
   * сокращаться. `null` означает «профиля нет» — тогда вызывающий показывает
   * осевую длину, как до правки.
   */
  private _rszInnerSpanCms(
    roomId: string, own: number[][], polys: Record<string, number[][]>,
  ): number[] | null {
    return this._editorRuntimeOrThrow()._rszInnerSpanCms(roomId, own, polys);
  }

  /** Pointer-inert measurement ink above masonry and below openings/handles. */
  private _renderResizeMeasurements(): TemplateResult | typeof nothing {
    return this._editorRuntimeOrThrow()._renderResizeMeasurements();
  }

  /** Fixed-topology wall handles. Disabled geometry remains visible and
   * explains why it cannot start a gesture; the old corner scale is gone. */
  private _renderResizeLayer(view: { x: number; y: number; w: number; h: number },
    roomIds?: readonly string[]): TemplateResult {
    return this._editorRuntimeOrThrow()._renderResizeLayer(view, roomIds);
  }

  /** Openings of the current space in render units. */
  private get _openingsR(): RenderOpening[] {
    const sp = this._curSpaceCfg;
    const H = this._spaceH;
    const space = this._spaceModel();
    if (!space) return [];
    return (sp?.openings || []).flatMap((o: OpeningCfg) => {
      const fallback: RenderOpening = {
        ...o, rx: o.x * NORM_W, ry: o.y * H, rlen: o.length * NORM_W,
      };
      // Contour-wall hosts are identity metadata; their materialised x/y/angle
      // stay the legacy render input until the Stage 3 graph renderer.
      if (!o.host || o.host.kind === 'wall') return [fallback];
      const resolution = resolvePartitionOpeningCompat(
        o, space.partitions, NORM_W, this._cellCm, this._gridPitch,
      );
      if (!resolution.resolved) {
        return this._mode === 'plan'
          ? [{ ...fallback, orphanReason: resolution.reason || 'invalid-host' }]
          : [];
      }
      let [rx, ry] = resolution.resolved.center;
      const drag = this._physicalDrag;
      if (drag?.moved && drag.kind === 'partition' && drag.id === o.host.id) {
        rx += drag.delta[0];
        ry += drag.delta[1];
      }
      return [{
        ...o,
        rx, ry,
        rlen: resolution.resolved.length,
        angle: resolution.resolved.angle,
        partitionHost: resolution.resolved,
      }];
    });
  }

  private _partitionOpeningCuts(
    space: SpaceModel | undefined = this._spaceModel(),
    accept: (opening: OpeningCfg) => boolean = () => true,
  ): PartitionOpeningCut[] {
    if (!space) return [];
    const config = this._curSpaceCfg?.id === space.id ? this._curSpaceCfg : null;
    return geometryPartitionOpeningCuts(
      geometryOpenings(config, space, this._cellCm, this._gridPitch, NORM_W),
      accept,
    );
  }

  /**
   * Room masonry may be cut by a hosted opening only for an exact collinear
   * composite. Nearby/crossing walls never inherit the partition's cut.
   */
  private _roomWallOpeningInputs(
    openings: readonly RenderOpening[] = this._openingsR,
    space: SpaceModel | undefined = this._spaceModel(),
  ): Array<{ x: number; y: number; angle: number; length: number }> {
    if (!space) return [];
    const openCuts = this._openCuts();
    return geometryRoomOpeningInputs(
      openings as readonly GeometryOpeningProjection[],
      space, this._spaceWalls, openCuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
  }

  private _openingFace(
    opening: RenderOpening, index: OpeningWallIndex, flipV: boolean,
  ): OpeningFaceOffset {
    return opening.partitionHost
      ? partitionOpeningFace(opening.partitionHost, flipV)
      : openingInnerFaceOffsetFromIndex(index, {
          x: opening.rx, y: opening.ry,
          angle: opening.angle, length: opening.rlen, flip_v: flipV,
        });
  }

  /** cm → render units via the space scale (cm per grid cell). */
  private _cmToUnits(cm: number): number {
    return (cm / this._cellCm) * this._gridPitch;
  }

  // ================= decor (background) layer =================

  private get _decorList(): DecorShape[] {
    const sp = this._curSpaceCfg;
    return (Array.isArray(sp?.decor) ? sp.decor : []) as DecorShape[];
  }

  private get _decorH(): number {
    return NORM_W;
  }

  private _decorResolvedStyle(shape?: DecorShape | null): DecorStyle {
    return decorStyleOf(shape, this._cellCm, this._gridPitch, DEFAULT_DECOR_STYLE);
  }

  private _decorWidthUnits(shape?: DecorShape | null): number {
    return decorStrokeUnits(shape, this._cellCm, this._gridPitch, DEFAULT_DECOR_STYLE.widthCm);
  }

  /** Canonical text size is physical; old size/scale values stay pixel-exact. */
  private _decorTextSizeCm(shape?: DecorShape | null): number {
    if (shape?.kind === 'text') {
      const canonical = Number(shape.size_cm);
      if (Number.isFinite(canonical) && canonical > 0) return canonical;
      return decorUnitsToCm(
        DECOR_TEXT_BASE * decorTextScale(shape), this._cellCm, this._gridPitch,
      );
    }
    return decorUnitsToCm(DECOR_TEXT_BASE, this._cellCm, this._gridPitch);
  }

  private _decorTextUnits(shape: DecorShape): number {
    if (shape.kind !== 'text') return DECOR_TEXT_BASE;
    const canonical = Number(shape.size_cm);
    return Number.isFinite(canonical) && canonical > 0
      ? decorCmToUnits(canonical, this._cellCm, this._gridPitch)
      : DECOR_TEXT_BASE * decorTextScale(shape);
  }

  /** Small physical fields are centimetres in metric plans and inches in imperial plans. */
  private _decorSmallField(cm: number): number {
    return Math.round((this._imperial ? cm / 2.54 : cm) * 100) / 100;
  }

  private _decorSmallCm(value: number): number {
    const cm = this._imperial ? value * 2.54 : value;
    return Number.isFinite(cm) ? Math.max(0.1, Math.min(100, cm)) : 0.1;
  }

  private _decorTextCm(value: number): number {
    const cm = this._imperial ? value * 2.54 : value;
    return Number.isFinite(cm) ? Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, cm)) : 0.1;
  }

  private _decorLargeField(cm: number): number {
    return Math.round((this._imperial ? cm / 30.48 : cm / 100) * 100) / 100;
  }

  private _decorLargeCm(value: number): number {
    const cm = this._imperial ? value * 30.48 : value * 100;
    return Number.isFinite(cm) ? Math.max(0.1, Math.min(CANVAS_LIMIT * this._cellCm, cm)) : 0.1;
  }

  /** Keep full geometry precision while presenting human-sized angle fields. */
  private _angleField(value: unknown): string {
    const angle = Number(value);
    return Number.isFinite(angle) ? String(Number(angle.toFixed(3))) : '0';
  }

  private _decorBoxOf(shape: DecorShape): DecorBox | null {
    if (shape.kind !== 'rect' && shape.kind !== 'ellipse'
        && shape.kind !== 'furniture' && shape.kind !== 'image') return null;
    return {
      x: shape.x * NORM_W, y: shape.y * this._decorH,
      w: shape.w * NORM_W, h: shape.h * this._decorH,
      angle: normalizeAngle(shape.angle) || undefined,
    };
  }

  /** Magnet candidates are intentionally limited to decor and room contours. */
  private _decorSnapGeometry(excludeId?: string): SnapGeometry {
    return this._editorRuntimeOrThrow()._decorSnapGeometry(excludeId);
  }

  private _decorSnap(raw: number[], pointerType = 'mouse', excludeId?: string): number[] {
    return this._editorRuntimeOrThrow()._decorSnap(raw, pointerType, excludeId);
  }

  private _replaceDecor(id: string, patch: Partial<DecorShape>): void {
    return this._editorRuntimeOrThrow()._replaceDecor(id, patch);
  }

  /** Esc/Ctrl+Z during a live gesture restores its transaction start without creating history. */
  private _cancelDecorGesture(): void {
    return this._editorRuntimeOrThrow()._cancelDecorGesture();
  }

  /** Begin a decor gesture. Returns true when the event is consumed (no pan). */
  private _decorPointerDown(ev: PointerEvent): boolean {
    return this._editorRuntimeOrThrow()._decorPointerDown(ev);
  }

  /** Commit the dragged shape (ignore degenerate ones) and persist. */
  private _decorCommitDraft(): void {
    return this._editorRuntimeOrThrow()._decorCommitDraft();
  }

  /** Select tool: pointerdown on a shape starts moving it. */
  private _decorShapeDown(ev: PointerEvent, shape: DecorShape): void {
    // #358: decor shapes render in View too; CSS pointer-events alone must
    // not be what keeps a cold tab from throwing (its twin _decorShapeDbl
    // got this guard in #337 already).
    if (!this._editorRuntime) return;
    return this._editorRuntime._decorShapeDown(ev, shape);
  }

  private _decorMoveUpdate(ev: PointerEvent): void {
    this._editorRuntimeOrThrow()._queuePointerMove('decor-move', () =>
      this._editorRuntimeOrThrow()._decorMoveUpdate(ev));
  }

  private _decorNudge(renderDx: number, renderDy: number): boolean {
    if (this._mode !== 'decor' || this._decorTool !== 'select'
        || !this._decorSel || this._decorDraft || this._decorMove || this._dtDrag || this._bdDrag)
      return false;
    const selected = this._decorList.find((shape) => shape.id === this._decorSel);
    const sp = this._curSpaceCfg;
    if (!selected || !sp) return false;
    const moved = nudgeDecorShape(
      selected, renderDx, renderDy, NORM_W, this._decorH, CANVAS_LIMIT,
    );
    if (!moved) return false;
    const before = this._geometrySnapshot();
    sp.decor = this._decorList.map((shape) => shape.id === selected.id ? moved : shape);
    this._recordGeometry(this._t('history.decor_move'), before);
    this._saveConfig();
    this.requestUpdate();
    return true;
  }

  /** Select tool: every decor object has a double-click properties dialog. */
  private _decorShapeDbl(ev: MouseEvent, shape: DecorShape): void {
    if (!this._editorRuntime) return;
    return this._editorRuntime._decorShapeDbl(ev, shape);
  }

  /** One properties entry point shared by double click and the context tray. */
  private _openDecorProperties(shape: DecorShape): void {
    return this._editorRuntimeOrThrow()._openDecorProperties(shape);
  }

  /** Open the editor of an existing label (double click, or the text tool). */
  private _decorOpenText(shape: DecorShape): void {
    return this._editorRuntimeOrThrow()._decorOpenText(shape);
  }

  private _decorRememberTextSelection(el: HTMLTextAreaElement): void {
    return this._editorRuntimeOrThrow()._decorRememberTextSelection(el);
  }

  /** Insert a complete reference without ever truncating it into broken text. */
  private _decorInsertLiveVariable(attr: string | null): void {
    return this._editorRuntimeOrThrow()._decorInsertLiveVariable(attr);
  }

  private _decorSaveText(): void {
    return this._editorRuntimeOrThrow()._decorSaveText();
  }

  private _decorSaveShape(): void {
    return this._editorRuntimeOrThrow()._decorSaveShape();
  }

  // ---- common decor transform controller ----
  // The mechanics are the backdrop frame's (docs/BACKDROP.md), reused
  // rather than reinvented: chrome that never takes a pointer, finger-sized
  // handles that always do, the gesture written live into the config and
  // PERSISTED only if something actually moved. What differs is the pivot —
  // a label has an anchor (its x/y), not a box, so both gestures are about
  // that anchor and the text never walks away from the point it was placed at.

  /** The selected shape under Select. Every decor kind uses this controller. */
  private get _dtSel(): DecorShape | null {
    if (this._mode !== 'decor' || this._decorTool !== 'select' || !this._decorSel) return null;
    return this._decorList.find((x) => x.id === this._decorSel) || null;
  }

  /**
   * What the object turns about. A label has an ANCHOR (its x/y is the point it
   * was placed at, and it must never walk away from it); boxes and lines use
   * their geometric centres.
   */
  private _dtPivot(sh: DecorShape): number[] {
    return this._editorRuntimeOrThrow()._dtPivot(sh);
  }

  /** Write physical text size/angle into the shape — live, without saving. */
  private _dtApply(id: string, patch: { textSizeCm?: number; angle?: number }): void {
    return this._editorRuntimeOrThrow()._dtApply(id, patch);
  }

  private _dtStart(
    ev: PointerEvent, kind: 'scale' | 'rotate', corner?: number[], lineEnd?: 0 | 1,
  ): void {
    return this._editorRuntimeOrThrow()._dtStart(ev, kind, corner, lineEnd);
  }

  private _dtMove(ev: PointerEvent): void {
    this._editorRuntimeOrThrow()._queuePointerMove('decor-transform', () =>
      this._editorRuntimeOrThrow()._dtMove(ev));
  }

  private _dtUp(): void {
    this._editorRuntimeOrThrow()._flushPointerMove('decor-transform');
    return this._editorRuntimeOrThrow()._dtUp();
  }

  /**
   * Measure the selected label's own box. SVG can only tell us how big a text
   * actually came out once it is in the DOM, so the frame is one render
   * behind — and it is re-measured whenever the text, its scale or the
   * selection changes. Guarded against the render→measure→render loop by
   * comparing the numbers before asking for another update.
   */
  private _dtMeasure(): void {
    return this._editorRuntimeOrThrow()._dtMeasure();
  }

  private _deleteDecor(id: string): void {
    return this._editorRuntimeOrThrow()._deleteDecor(id);
  }

  private _decorDeleteSel(): void {
    return this._editorRuntimeOrThrow()._decorDeleteSel();
  }

  private _confirmDecorErase(): void {
    return this._editorRuntimeOrThrow()._confirmDecorErase();
  }

  // ============ backdrop transform frame (docs/BACKDROP.md) ============

  /** The centred, UNTRANSFORMED rectangle of the current backdrop image. */
  private get _bdBase(): Rect | null {
    const sp = this._curSpaceCfg;
    return sp?.plan_url ? { ...fitInSquare(sp.plan_aspect, NORM_W) } : null;
  }

  /** Where the backdrop image sits right now, render units (null: no image). */
  private get _bdRect(): (Rect & { angle?: number }) | null {
    const sp = this._curSpaceCfg;
    return sp?.plan_url ? planRect(sp, NORM_W) : null;
  }

  /** The stored transform of the current space (defaults = the old behaviour). */
  private get _bdParams(): { dx: number; dy: number; sx: number; sy: number; angle: number } {
    const sp = this._curSpaceCfg;
    const dx = Number(sp?.plan_x), dy = Number(sp?.plan_y);
    const legacy = Number(sp?.plan_scale);
    const sxRaw = Number(sp?.plan_scale_x), syRaw = Number(sp?.plan_scale_y);
    const baseScale = Number.isFinite(legacy) && legacy > 0 ? legacy : 1;
    return {
      dx: Number.isFinite(dx) ? dx : 0,
      dy: Number.isFinite(dy) ? dy : 0,
      sx: Number.isFinite(sxRaw) && sxRaw > 0 ? sxRaw : baseScale,
      sy: Number.isFinite(syRaw) && syRaw > 0 ? syRaw : baseScale,
      angle: normalizeAngle(sp?.plan_angle),
    };
  }

  private _openBackdropDialog(ev?: Event): void {
    if (!this._editorRuntime) return;
    return this._editorRuntime._openBackdropDialog(ev);
  }

  private _saveBackdropDialog(): void {
    return this._editorRuntimeOrThrow()._saveBackdropDialog();
  }

  /**
   * The transform frame belongs exclusively to the backdrop tool. It is never
   * active in Select and can never swallow a decor gesture.
   */
  private get _bdActive(): boolean {
    return this._mode === 'decor' && !!this._bdRect && this._decorTool === 'backdrop';
  }

  /**
   * …and may the picture be dragged by its BODY? Only under its own tool.
   *
   * The corner handles are precise targets and are live as soon as the frame
   * is, but the body is the whole picture, i.e. most of the screen — claiming
   * it under the select tool would take away the one-finger pan the owner
   * asked for on 2026-08-04 («таскать план при любом масштабе»), which
   * smoke_pan_any_zoom guards. So moving the picture is a tool, exactly like
   * drawing a line is.
   */
  private get _bdMovable(): boolean {
    return this._mode === 'decor' && this._decorTool === 'backdrop' && !!this._bdRect;
  }

  /** Write a transform into the space config — live, without saving. */
  private _bdApply(dx: number, dy: number, sx: number, sy: number, angle: number): void {
    return this._editorRuntimeOrThrow()._bdApply(dx, dy, sx, sy, angle);
  }

  /**
   * Begin a backdrop gesture. `corner` is the DRAGGED corner as a pair of
   * signs (-1 = the low side of the axis, +1 = the high one); absent = the
   * body, i.e. a move. Returns false when there is nothing to grab.
   */
  private _bdStart(ev: PointerEvent, corner?: number[], rotate = false): boolean {
    return this._editorRuntimeOrThrow()._bdStart(ev, corner, rotate);
  }

  /**
   * One step of the gesture.
   *
   * MOVE — the resulting TOP-LEFT CORNER is snapped, not the delta, so one
   * drag is enough to put a legacy off-grid picture on the lattice
   * (docs/CANVAS.md §9.3, the same rule decor already follows).
   *
   * SCALE — proportional about the fixed corner by default; Shift allows the
   * two axes to diverge. ROTATE — 5° by default, free with Shift.
   *
   * Positional snapping is mandatory (UX-05).
   */
  private _bdMove(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._bdMove(ev);
  }

  /** Has this space's picture been moved or scaled at all? */
  private get _bdMoved(): boolean {
    if (this._mode !== 'decor' || !this._bdRect) return false;
    const p = this._bdParams;
    return p.dx !== 0 || p.dy !== 0 || p.sx !== 1 || p.sy !== 1 || p.angle !== 0;
  }

  /** Put the picture back where an untouched plan has it: centred, own size. */
  private _bdReset(): void {
    return this._editorRuntimeOrThrow()._bdReset();
  }

  /** Release: persist only when something actually moved. */
  private _bdUp(): void {
    return this._editorRuntimeOrThrow()._bdUp();
  }

  /**
   * Live size badge while the picture is dragged or scaled (owner 2026-08-04):
   * its REAL width × height through `cell_cm`, in the HA unit system — the
   * same `_fmtLen` (`segmentCm`/`formatLength`) and the same `.measurelabel`
   * the wall ruler and the room resize use, so there is one way the card ever
   * states a length.
   */
  private get _bdLive(): { x: number; y: number; text: string } | null {
    if (!this._bdDrag) return null;
    const r = this._bdRect;
    if (!r) return null;
    return {
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      text: `${this._fmtLen([0, 0], [r.w, 0])} × ${this._fmtLen([0, 0], [0, r.h])}`,
    };
  }

  /** The transform frame itself: a dashed outline and four corner handles. */
  private _renderBackdropFrame(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    if (!this._editorRuntime) return nothing;
    return this._editorRuntimeOrThrow()._renderBackdropFrame(view);
  }

  /**
   * The common selected-object frame: line endpoints, or a dashed outline,
   * four corner handles and one rotation handle. Same
   * mechanics and same handle size as the backdrop frame (docs/BACKDROP.md
   * §2) — finger-sized in SCREEN terms, so it stays grabbable at any zoom —
   * and it rides the block's own rotation, so the corners stay at the corners.
   */
  private _renderTextFrame(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const sh = this._dtSel;
    if (!sh) return nothing;
    if (sh.kind === 'text' && this._dtBox?.id !== sh.id) return nothing;
    const b = sh.kind === 'text' ? this._dtBox : this._decorBoxOf(sh);
    if (sh.kind !== 'line' && !b) return nothing;
    // Two radii, one gesture (owner 2026-08-05: «уменьшить в 4 раза»). `hr`
    // is the HIT radius — unchanged, still 1.8 % of the visible view, still
    // finger-sized at any zoom — carried by an invisible circle. `kr` is what
    // you SEE: a quarter of it, a bead instead of a button, so the frame stops
    // covering the very words it is framing. Same split the wall-resize
    // handles use (.rszhandle + .rszicon, docs/RESIZE.md).
    const hr = Math.max(view.w, view.h) * 0.018;
    const kr = hr / 4;
    if (sh.kind === 'line') {
      const a = [sh.x1 * NORM_W, sh.y1 * this._decorH];
      const c = [sh.x2 * NORM_W, sh.y2 * this._decorH];
      return svg`<g class="dtframe dtlineframe">
        <line class="dtbox" x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}"></line>
        ${[a, c].map((p, i) => svg`<circle class="dthandle dtendpoint" cx="${p[0]}" cy="${p[1]}"
          r="${hr.toFixed(1)}" @pointerdown=${(e: PointerEvent) => this._dtStart(e, 'scale', undefined, i as 0 | 1)}></circle>
          <circle class="dtknob" cx="${p[0]}" cy="${p[1]}" r="${kr.toFixed(2)}"></circle>`)}
      </g>` as unknown as TemplateResult;
    }
    if (!b) return nothing;
    const [ax, ay] = this._dtPivot(sh);
    const ang = Number(sh.angle) || 0;
    const corners: [number, number, string][] = [
      [-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw'],
    ];
    const arm = hr * 2.2;
    const furniture = sh.kind === 'furniture' || sh.kind === 'image';
    const sides: [number, number, string][] = furniture ? [
      [0, -1, 'ns'], [1, 0, 'ew'], [0, 1, 'ns'], [-1, 0, 'ew'],
    ] : [];
    return svg`<g class="dtframe${furniture ? ' dtfurnitureframe' : ''}" transform=${ang ? `rotate(${ang} ${ax} ${ay})` : nothing}>
      <rect class="dtbox" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"></rect>
      <line class="dtstem" x1="${b.x + b.w / 2}" y1="${b.y}" x2="${b.x + b.w / 2}" y2="${b.y - arm}"></line>
      <circle class="dthandle dtrot" cx="${b.x + b.w / 2}" cy="${b.y - arm}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => this._dtStart(e, 'rotate')}></circle>
      <circle class="dtknob" cx="${b.x + b.w / 2}" cy="${b.y - arm}" r="${kr.toFixed(2)}"></circle>
      ${HANDLE_PAINT_ORDER.map((role) => (role === 'edges'
        ? sides.map(([sx, sy, cur]) => {
          const x = sx < 0 ? b.x : sx > 0 ? b.x + b.w : b.x + b.w / 2;
          const y = sy < 0 ? b.y : sy > 0 ? b.y + b.h : b.y + b.h / 2;
          return svg`<circle class="dthandle dtedge dt-${cur}" cx="${x}" cy="${y}"
            r="${hr.toFixed(1)}" @pointerdown=${(e: PointerEvent) =>
              this._dtStart(e, 'scale', [sx, sy])}></circle>
            <circle class="dtknob dtedgeknob" cx="${x}" cy="${y}" r="${kr.toFixed(2)}"></circle>`;
        })
        : corners.map(([sx, sy, cur]) => svg`<circle class="dthandle dt-${cur}"
          cx="${sx < 0 ? b.x : b.x + b.w}" cy="${sy < 0 ? b.y : b.y + b.h}" r="${hr.toFixed(1)}"
          @pointerdown=${(e: PointerEvent) => this._dtStart(e, 'scale', [sx, sy])}></circle><circle class="dtknob"
          cx="${sx < 0 ? b.x : b.x + b.w}" cy="${sy < 0 ? b.y : b.y + b.h}" r="${kr.toFixed(2)}"></circle>`)))}
    </g>` as unknown as TemplateResult;
  }

  private _renderDecorLayer(onlyId?: string | null): TemplateResult {
    const W = NORM_W, H = this._decorH;
    const editing = this._mode === 'decor';
    const erasing = editing && this._decorTool === 'erase';
    // One measured outer viewBox scale for the whole layer. Furniture paths
    // keep `non-scaling-stroke` only to reject their own independent width /
    // depth transform; multiplying by this factor restores the same physical
    // camera zoom ordinary decor gets from the plan SVG (#361).
    const stage = this._stageEl;
    const planView = this._viewOr(this._baseVb());
    // #376(г): the compensation formula models the 2D camera (uniform
    // min(stage/planView)). The labs iso projection scales the floor through
    // its own non-uniform transform, where ordinary decor is anisotropic as
    // well — there furniture strokes keep the pre-#361 behaviour (scale 1)
    // instead of diverging from their neighbours by a wrong-camera factor.
    const furnitureScreenScale = this._renderProjection === 'iso' ? 1 : furniturePlanScreenScale(
      stage?.clientWidth, stage?.clientHeight, planView.w, planView.h,
    );
    const shapes = this._decorList.filter((sh) => onlyId === undefined || sh.id === onlyId).map((sh) => {
      const cls = 'dshape' + (editing && this._decorSel === sh.id ? ' dsel' : '');
      const style = this._decorResolvedStyle(sh);
      const strokeWidth = this._decorWidthUnits(sh);
      const down = (e: PointerEvent) => this._decorShapeDown(e, sh);
      const dbl = (e: MouseEvent) => this._decorShapeDbl(e, sh);
      // docs/STYLING-HOOKS.md §3: every shape carries its kind and its id
      if (sh.kind === 'line')
        // round caps: line ends read as circles of the stroke width, so two
        // lines meeting at an angle join without the notch (owner's screenshot)
        return svg`<line class="${cls}" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
          stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}"
          stroke-dasharray=${sh.line_style === 'dashed' ? `${strokeWidth * 4} ${strokeWidth * 3}` : nothing}
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${down} @dblclick=${dbl}></line>
          ${editing && this._decorTool === 'select' ? svg`<line class="dshape dselecthit"
            data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
            @pointerdown=${down} @dblclick=${dbl}></line>` : nothing}
          ${erasing ? svg`<line class="dshape derasehit" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
            @pointerdown=${down}></line>` : nothing}`;
      if (sh.kind === 'rect') {
        const cx = (sh.x + sh.w / 2) * W, cy = (sh.y + sh.h / 2) * H;
        const ang = normalizeAngle(sh.angle);
        return svg`<rect class="${cls}" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          x="${sh.x * W}" y="${sh.y * H}" width="${sh.w * W}" height="${sh.h * H}"
          stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}"
          fill="${style.fill ? style.fillColor : 'none'}" fill-opacity="${style.fill ? style.fillOpacity : 0}"
          transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing}
          @pointerdown=${down} @dblclick=${dbl}></rect>
          ${erasing ? svg`<rect class="dshape derasehit" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            x="${sh.x * W}" y="${sh.y * H}" width="${sh.w * W}" height="${sh.h * H}"
            transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing} @pointerdown=${down}></rect>` : nothing}`;
      }
      if (sh.kind === 'ellipse') {
        const cx = (sh.x + sh.w / 2) * W, cy = (sh.y + sh.h / 2) * H;
        const ang = normalizeAngle(sh.angle);
        return svg`<ellipse class="${cls}" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          cx="${cx}" cy="${cy}"
          rx="${(sh.w / 2) * W}" ry="${(sh.h / 2) * H}" stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}"
          fill="${style.fill ? style.fillColor : 'none'}" fill-opacity="${style.fill ? style.fillOpacity : 0}"
          transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing}
          @pointerdown=${down} @dblclick=${dbl}></ellipse>
          ${erasing ? svg`<ellipse class="dshape derasehit" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            cx="${cx}" cy="${cy}" rx="${(sh.w / 2) * W}" ry="${(sh.h / 2) * H}"
            transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing} @pointerdown=${down}></ellipse>` : nothing}`;
      }
      if (sh.kind === 'image') {
        const projection = projectDecorImage(sh, W, H);
        if (!projection) return nothing;
        const [x, y, w, h, opacity, transform] = projection;
        const asset = this._decorAssets.get(sh.asset_id);
        if (!asset) return editing && this._editorRuntime
          ? this._editorRuntime._renderMissingDecorImage(sh, cls, transform, x, y, w, h, down, dbl)
          : nothing;
        const href = this._display(asset.url);
        if (!href) return nothing;
        return svg`<image class="${cls} dimage" data-hp="decor" data-id=${sh.id}
          data-kind="image" href=${href} x=${x} y=${y} width=${w} height=${h}
          opacity=${opacity} preserveAspectRatio="none" transform=${transform}
          @load=${() => this._signer.markLoaded(this._renderPlanHass, asset.url, href)}
          @pointerdown=${down} @dblclick=${dbl}></image>
          ${erasing ? svg`<rect class="dshape derasehit" data-hp="decor" data-id=${sh.id}
            data-kind="image" x=${x} y=${y} width=${w} height=${h} transform=${transform}
            @pointerdown=${down}></rect>` : nothing}`;
      }
      if (sh.kind === 'furniture') {
        // One path per piece. Designer art keeps its native viewBox and is
        // scaled to the user's stored box; vector-effect rejects that local
        // non-uniform transform while furnitureScreenScale restores the outer
        // physical plan zoom.
        // An unknown symbol renders as nothing: a plan from a newer card must
        // open in an older one, not break it.
        const art = furnitureGraphic(sh.symbol);
        if (!art) return nothing;
        const tr = furnitureRenderTransform(sh, W, H, art.viewW, art.viewH);
        const visibleStrokePx = furnitureStrokePx(strokeWidth, furnitureScreenScale);
        const selectStrokePx = furnitureStrokePx(
          strokeWidth + decorCmToUnits(20, this._cellCm, this._gridPitch),
          furnitureScreenScale,
        );
        return svg`<path class="${cls} dfurn" data-hp="decor" data-id="${sh.id}"
          data-kind="${sh.kind}" data-symbol="${sh.symbol}" d="${art.d}" transform=${tr}
          stroke="${style.color}" stroke-opacity="${style.opacity}"
          stroke-width="${visibleStrokePx}" fill="none"
          stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
          @pointerdown=${down} @dblclick=${dbl}></path>
          ${editing && this._decorTool === 'select' ? svg`<path
            class="dshape dfurniturehit" data-hp="decor" data-id="${sh.id}"
            data-kind="${sh.kind}" data-symbol="${sh.symbol}" d="${art.d}" transform=${tr}
            stroke-width="${selectStrokePx}" fill="none" stroke-linecap="round"
            stroke-linejoin="round" vector-effect="non-scaling-stroke"
            @pointerdown=${down} @dblclick=${dbl}></path>` : nothing}
          ${erasing ? svg`<path class="dshape derasehit" data-hp="decor" data-id="${sh.id}"
            data-kind="${sh.kind}" data-symbol="${sh.symbol}" d="${art.d}" transform=${tr}
            vector-effect="non-scaling-stroke"
            @pointerdown=${down}></path>` : nothing}`;
      }
      if (sh.kind === 'text') {
        // The label is painted from the LIVE value on every render — the same
        // `hass` the rest of the card reads, no polling of its own. Without an
        // entity `liveText` gives the stored text back byte-for-byte, so a
        // plain label is the plain label it always was (docs/LIVE-TEXT.md).
        const fs = this._decorTextUnits(sh);
        const frozenText = this._renderDeviceSnapshot?.facts.get(`decor:${this._space}:${sh.id}`);
        const lines = decorTextLines(typeof frozenText === 'string' ? frozenText : liveText(
          sh.text, sh, this._renderPlanHass, (eid) => this._renderEntityAvailable(eid),
        ));
        const ax = sh.x * W, ay = sh.y * H;
        const ang = Number(sh.angle) || 0;
        // the block is centred on its anchor, horizontally (the layer's
        // text-anchor) and vertically — so adding a second line grows the
        // label in both directions instead of pushing the first one up
        const y0 = ay - ((lines.length - 1) * fs * DT_LINE) / 2;
        return svg`<text class="${cls} dtext" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          x="${ax}" y="${ay}" fill="${style.color}" fill-opacity="${style.opacity}"
          font-size="${fs}" transform=${ang ? `rotate(${ang} ${ax} ${ay})` : nothing}
          @pointerdown=${down} @dblclick=${dbl}>${lines.map(
            (ln, i) => svg`<tspan x="${ax}" y="${y0 + i * fs * DT_LINE}">${ln}</tspan>`,
          )}</text>`;
      }
      return nothing;
    });
    // живое превью рисуемой фигуры
    let draft: unknown = nothing;
    const d = this._decorDraft;
    if (d) {
      const st = this._decorStyle;
      const sw = decorCmToUnits(st.widthCm, this._cellCm, this._gridPitch);
      if (d.kind === 'line')
        draft = svg`<line class="ddraft" x1="${d.a[0]}" y1="${d.a[1]}" x2="${d.b[0]}" y2="${d.b[1]}"
          stroke="${st.color}" stroke-opacity="${st.opacity}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"></line>`;
      else {
        const x = Math.min(d.a[0], d.b[0]), y = Math.min(d.a[1], d.b[1]);
        const w = Math.abs(d.b[0] - d.a[0]), h = Math.abs(d.b[1] - d.a[1]);
        draft = d.kind === 'rect'
          ? svg`<rect class="ddraft" x="${x}" y="${y}" width="${w}" height="${h}" stroke="${st.color}"
              stroke-opacity="${st.opacity}" stroke-width="${sw}" fill="${st.fill ? st.fillColor : 'none'}" fill-opacity="${st.fill ? st.fillOpacity : 0}"></rect>`
          : svg`<ellipse class="ddraft" cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"
              stroke="${st.color}" stroke-opacity="${st.opacity}" stroke-width="${sw}" fill="${st.fill ? st.fillColor : 'none'}" fill-opacity="${st.fill ? st.fillOpacity : 0}"></ellipse>`;
      }
    }
    return svg`<g class="decorlayer">${shapes}${draft}${this._editorRuntime?._renderFurniturePlacementPreview(furnitureScreenScale) ?? nothing}${this._editorRuntime?._renderDecorImagePlacementPreview() ?? nothing}</g>` as unknown as TemplateResult;
  }

  // ================= shared editor secondary surface =================

  private get _editorToolbarGroups(): readonly EditorToolbarGroup[] {
    if (this._mode !== 'plan') return [];
    return [{
      id: 'opening',
      label: this._t('markup.opening'),
      icon: 'mdi:door',
      activeItemId: this._tool === 'opening' ? this._openingPreset?.type : undefined,
      items: [
        {
          id: 'window', label: this._t('opening.window'), icon: 'mdi:window-closed-variant',
          role: 'tool', invoke: () => this._activateOpeningPlacement('window'),
        },
        {
          id: 'door', label: this._t('opening.door'), icon: 'mdi:door-open',
          role: 'tool', invoke: () => this._activateOpeningPlacement('door'),
        },
        {
          id: 'passage', label: this._t('opening.passage'), icon: 'mdi:arch',
          role: 'tool', invoke: () => this._activateOpeningPlacement('passage'),
        },
        {
          id: 'gate', label: this._t('opening.gate'), icon: 'mdi:gate',
          role: 'tool', invoke: () => this._activateOpeningPlacement('gate'),
        },
      ],
    }];
  }

  private _renderEditorGroupLauncher(group: EditorToolbarGroup): TemplateResult {
    return this._editorRuntimeOrThrow()._renderEditorGroupLauncher(group);
  }

  /** Stable target identity + current config epoch + operation revision. */
  private get _editorSecondaryContextId(): string {
    const base = `editor:${this._mode}:${this._space}:${this._cfgEpoch}`;
    const group = this._editorSecondary?.activeGroup(this._editorToolbarGroups);
    if (group) return `${base}:group:${group.id}:${this._editorSecondary?.groupGeneration}`;
    if (this._mode === 'plan') {
      const sel = this._physicalSel;
      if (sel) return `${base}:selection:${sel.kind}:${sel.id}:${sel.segment ?? ''}`;
      return `${base}:tool:${this._tool}:${this._path.length}`;
    }
    if (this._mode === 'decor') {
      if (this._decorTool === 'furniture')
        return `${base}:palette:furniture:${this._furnPalette?.symbol || 'none'}`;
      if (this._decorTool === 'image')
        return `${base}:palette:image:${this._decorImagePalette?.asset_id || 'none'}`;
      if (this._decorTool === 'select' && this._decorSel)
        return `${base}:selection:decor:${this._decorSel}`;
      return `${base}:tool:${this._decorTool}:${this._bdMoved ? 1 : 0}:${this._bdDrag ? 1 : 0}`;
    }
    return `${base}:none`;
  }

  private _runEditorContext<T>(contextId: string, action: () => T): T | undefined {
    return this._editorRuntimeOrThrow()._runEditorContext(contextId, action);
  }

  private _renderEditorGroupModel(group: EditorToolbarGroup): EditorSecondaryModel {
    return this._editorRuntimeOrThrow()._renderEditorGroupModel(group);
  }

  private _renderDrawWallControl(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDrawWallControl();
  }

  private _renderPlanSecondary(): EditorSecondaryModel | null {
    return this._editorRuntimeOrThrow()._renderPlanSecondary();
  }

  private _renderDecorSecondary(): EditorSecondaryModel | null {
    return this._editorRuntimeOrThrow()._renderDecorSecondary();
  }

  /** Backdrop reset is a space-level maintenance action, not a tool option.
   * Keep it reachable from every ordinary decor context as it was before the
   * contextual tray extraction; an explicit palette keeps priority. */
  private _withBackdropReset(model: EditorSecondaryModel | null): EditorSecondaryModel | null {
    return this._editorRuntimeOrThrow()._withBackdropReset(model);
  }

  private get _editorSecondaryDialogBlocked(): boolean {
    return !!(this._dangerConfirm || this._tapConfirm || this._vacCalConfirm
      || this._roomDialog || this._mergeDialog
      || this._openingDialog || this._physicalDialog || this._openingInfo
      || this._decorTextDialog || this._decorShapeDialog || this._backdropDialog
      || this._decorEraseConfirm || this._spaceDialog || this._markerDialog || this._deviceInbox
      || this._infoCard || this._rulesDialog || this._settingsDialog || this._supportDialog
      || this._alignDialog || this._importDialog || this._kioskDialog
      || this._backupExportDialog || this._backupImportDialog
      || this._wallDialog);
  }

  private _renderEditorSecondary(): TemplateResult | typeof nothing {
    return this._editorRuntimeOrThrow()._renderEditorSecondary();
  }

  private _renderDecorBar(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDecorBar();
  }

  private _renderDecorEraseConfirm(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDecorEraseConfirm();
  }

  private _renderDecorTextDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDecorTextDialog();
  }

  private _renderDecorShapeDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDecorShapeDialog();
  }

  private _renderBackdropDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderBackdropDialog();
  }

  /** CSS-pixel interaction constants stay stable at every plan zoom. */
  private _cssPxToRender(px: number): number {
    return this._editorRuntimeOrThrow()._cssPxToRender(px);
  }

  /** Zero-thickness walls. Their paint and light policy share one resolver. */
  private _renderZeroWalls(disp?: SpaceDisplay): TemplateResult {
    if (disp && !disp.showBorders && !this._editing) return svg`` as unknown as TemplateResult;
    const zero = this._zeroWalls();
    if (!zero.lines.length) return svg`` as unknown as TemplateResult;
    const stroke = disp?.color || 'var(--hp-muted)';
    return svg`<g class="zero-walls ${zero.style}"
      data-zero-wall-style=${zero.style} style="--zero-wall-stroke:${stroke}">
      ${zero.lines.map((sg) => svg`<line class="zero-wall"
        x1="${sg[0]}" y1="${sg[1]}" x2="${sg[2]}" y2="${sg[3]}"></line>`)}
    </g>` as unknown as TemplateResult;
  }

  private _zeroWalls() {
    const space = this._spaceModel();
    return space
      ? resolveZeroWalls(
          this._curSpaceCfg, space, NORM_W, this._gridPitch * 0.02,
        )
      : { style: zeroWallStyleOf(this._curSpaceCfg), lines: [], contour: [], barriers: [], transmissive: [] };
  }

  /** Every contour atom without a body is a cut in physical wall geometry. */
  private _openCuts(): number[][] {
    return this._zeroWalls().contour;
  }

  /** Delete tool: defer all wall consequences to one explicit accessible choice. */
  private _deleteRoomClick(raw: number[]): void {
    return this._editorRuntimeOrThrow()._deleteRoomClick(raw);
  }

  private _confirmRoomDelete = (keepWalls: boolean): void => {
    return this._editorRuntimeOrThrow()._confirmRoomDelete(keepWalls);
  }


  // ================= WALL THICKNESS (docs/WALL-THICKNESS.md) =================

  /** Keys are always stored in normalised space (GRID_STEP_N). */
  private get _wallKeyPitch(): number {
    return GRID_STEP_N;
  }

  private get _spaceWalls(): WallEntry[] {
    const w = this._curSpaceCfg?.walls;
    return Array.isArray(w) ? (w as WallEntry[]) : [];
  }

  /** Thickness of the atomic stretch under a segment (docs/WALL-THICKNESS.md). */
  private _intervalCm(seg: number[]): number {
    const space = this._spaceModel();
    if (!space) return 0;
    return intervalCmAt(
      space.rooms, this._spaceWalls, this._openCuts(), seg,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
  }

  /** Rewrite thickness keys onto the current atomic intervals and drop dead ones. */
  private _normalizeWalls(walls: WallEntry[] | null | undefined, cuts: number[][]): WallEntry[] {
    const space = this._spaceModel();
    if (!space) return [];
    const next = normalizeWallIntervals(
      space.rooms, walls, cuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
    return degradeWalls(next, this._curSpaceCfg?.rooms || [], GRID_STEP_N, 1,
      cuts.map((c) => [c[0] / NORM_W, c[1] / NORM_W, c[2] / NORM_W, c[3] / NORM_W]));
  }

  /** Paper under rooms, grown by shared-wall half-thickness when set. */
  private _paperShapes(rooms: any[]): Array<
    | { path: string }
    | { poly: string }
    | { rect: { x: number; y: number; w: number; h: number; rx: number } }
  > {
    const walls = this._spaceWalls;
    if (!walls.length) return paperRoomShapes(rooms);
    const united = this._wallUnionGeometry();
    return united?.paperD ? [{ path: united.paperD }] : paperRoomShapes(rooms);
  }

  /** Canonical paper + masonry geometry, cached by structural config epoch. */
  private _wallUnionGeometry(): ReturnType<typeof wallBodiesUnionPath> {
    const space = this._spaceModel();
    if (!space) return null;
    const walls = this._spaceWalls;
    const extras = this._physicalBodiesR();
    if (!walls.length && !extras.length) return null;
    const unionKey = `${this._space}|${this._cfgEpoch}|${space.rooms.length}`;
    if (!this._wallUnionCache || this._wallUnionCache.key !== unionKey) {
      const cached = lruRead(this._wallUnionPool, unionKey);
      if (cached.hit) this._wallUnionCache = cached.value;
      else {
        // Opening association and physical-body extraction are structural
        // work. Do them only for a real cache miss; this method is intentionally
        // called by many room consumers in one render.
        const openCuts = this._openCuts();
        const openings = this._roomWallOpeningInputs();
        const value = wallBodiesUnionPath(
          space.rooms, walls, openCuts, openings,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, extras,
        );
        if (value) Object.defineProperty(value, 'sourceFingerprint', {
          value: contentFingerprint([this._curSpaceCfg, this._cellCm, this._gridPitch]),
          enumerable: false,
        });
        const entry = {
          key: unionKey,
          value,
        };
        lruWrite(this._wallUnionPool, unionKey, entry, 8);
        this._wallUnionCache = entry;
      }
    }
    return this._wallUnionCache.value;
  }

  /** Thick-wall spans in render units — suppress centreline stroke under bodies. */
  private _thickWallCuts(): number[][] {
    const space = this._spaceModel();
    if (!space) return [];
    const walls = this._spaceWalls;
    if (!walls.length) return [];
    const openCuts = this._openCuts();
    return wallEdgeBodies(
      space.rooms, walls, openCuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    ).map((b) => [b.a[0], b.a[1], b.b[0], b.b[1]]);
  }

  /** Structural room face shared by every fill surface in the same frame. */
  private _innerRoomContour(
    space: SpaceModel,
    roomId: string,
    openCuts: number[][] = this._openCuts(),
    roomWalls: ReturnType<typeof wallBodiesGeometry>['roomGeom'] = this._wallUnionGeometry()?.roomGeom,
    multiWallNodes = this._wallUnionGeometry()?.multiWallNodes,
  ): number[][] | null {
    const cutsKey = openCuts.map((cut) => cut.join(',')).join(';');
    const key = `${space.id}|${this._cfgEpoch}|${roomId}|${cutsKey}`;
    // Resize advances the structural epoch before publishing every preview,
    // so editor and View consumers can safely share one per-epoch answer.
    const cached = lruRead(this._innerContourCache, key);
    if (cached.hit) return cached.value;
    const value = innerContourForRoom(
      space.rooms, roomId, this._spaceWalls, openCuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
      roomWalls,
      multiWallNodes,
    );
    lruWrite(this._innerContourCache, key, value, 600);
    return value;
  }

  /**
   * The ATOMIC wall stretch under the cursor for the wall-thickness tool.
   *
   * AUD-159B6-01: it used to return the whole polygon edge (only preferring a
   * shared overlap), so a click on the outer remainder of a partially shared
   * wall wrote a key that the renderer then spread over the shared part as
   * well. The unit of the tool is now the same interval the renderer draws.
   */
  private _wallThickHit(raw: number[]): WallThickHit | null {
    return this._editorRuntimeOrThrow()._wallThickHit(raw);
  }

  private get _wallThickHover(): { segs: number[][]; open: boolean; d: string } | null {
    if (!this._markup || this._tool !== 'wallthick' || !this._cursorPt || this._wallDialog) return null;
    const hit = this._wallThickHit(this._cursorPt);
    if (!hit) return null;
    // The visible strip follows the physical wall body. Only a zero-thickness
    // centreline receives a scale-independent visual minimum; hit testing keeps
    // its deliberately generous and separate radius in _wallThickHit().
    const half = wallThickHoverHalfUnits(hit.cm, this._cellCm, this._gridPitch);
    let d = '';
    for (const sg of hit.segs) {
      d += (d ? ' ' : '') + drawWallPreviewD(
        [[sg[0], sg[1]], [sg[2], sg[3]]], half, false,
      );
    }
    return { segs: hit.segs, open: hit.open, d };
  }

  private _wallThickClick(raw: number[]): void {
    return this._editorRuntimeOrThrow()._wallThickClick(raw);
  }

  private _wallThickApply(allRoom: boolean): void {
    return this._editorRuntimeOrThrow()._wallThickApply(allRoom);
  }

  private _wallHatchDefs(color: string): TemplateResult {
    // Hatching is visible in View as well as in Plan, so its tiny SVG
    // definition belongs to the eager projection rather than editor runtime.
    const step = wallHatchStepUnits(this._cellCm);
    const stripe = 2 * (step / HATCH_BASE_STEP_UNITS);
    const stroke = color || '#607d8b';
    return svg`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
        width="${step}" height="${step}" patternTransform="rotate(45)">
        <path d="M0 0 L0 ${step}" stroke="${stroke}" stroke-width="${stripe}"></path>
      </pattern>
    </defs>` as unknown as TemplateResult;
  }

  /**
   * One authoritative room-fill projection per render frame. Room polygons and
   * thick-wall opening tunnels consume the same object, so a live HA tick can
   * never update one without the other or drift in palette semantics.
   */
  private _resolvedRoomFills(space: SpaceModel, disp: SpaceDisplay): RoomFillFrame {
    const byRoom = new Map<RoomCfg, ResolvedRoomFill | null>();
    const byId = new Map<string, ResolvedRoomFill | null>();
    for (const room of space.rooms) {
      // The dimmed plan behind the room dialog is a real preview, not a second
      // renderer. Feed its pending selection through this same frame resolver.
      const mode = this._roomDialog && room.id === this._roomEditId
        ? (this._roomFill || disp.fill)
        : roomFillModeOf(disp.fill, room);
      const customFill = this._roomDialog && room.id === this._roomEditId
        ? (this._roomCustomFill || disp.customFill)
        : roomCustomFillOf(disp.customFill, room);
      const resolved = resolveEffectiveRoomFill(
        mode,
        mode === 'lqi' && room.area ? this._roomLqi(room.area) : null,
        mode === 'light'
          ? resolvedLightState(resolvedLightSources(
            this._renderPlanHass, this._renderDevices, room, this._virtualLights,
          ))
          : 'none',
        mode === 'temp' ? this._roomTemp(room) : null,
        disp.tempMin,
        disp.tempMax,
        this._fillColors,
        customFill,
      );
      byRoom.set(room, resolved);
      if (room.id) byId.set(room.id, resolved);
    }
    return { byRoom, byId };
  }

  /** Pending space-dialog values projected through the production resolver. */
  private _spaceDisplayForRender(): SpaceDisplay {
    const current = spaceDisplayOf(this._curSpaceCfg);
    const dialog = this._spaceDialog;
    if (!dialog || dialog.mode !== 'edit' || dialog.spaceId !== this._space) return current;
    return {
      ...current,
      showBorders: dialog.showBorders,
      showNames: dialog.showNames,
      hideDecor: dialog.hideDecor,
      hideOpenings: dialog.hideOpenings,
      color: dialog.roomColor,
      opacity: dialog.roomOpacity,
      fill: dialog.fillMode,
      customFill: dialog.customFill ? customFillOf(dialog.customFill) : DEFAULT_CUSTOM_FILL,
      glow: dialog.glowEnabled,
      tempMin: dialog.tempMin,
      tempMax: dialog.tempMax,
      showLqi: dialog.showLqi,
      cardFontScale: dialog.cardFontScale,
      labelTemp: dialog.labelTemp,
      labelHum: dialog.labelHum,
      labelLqi: dialog.labelLqi,
      labelLight: dialog.labelLight,
    };
  }

  /** Atomic wall association shared by symbols, wall cuts and tunnel geometry. */
  private _openingWallIndexFor(space: SpaceModel, openCuts: number[][]): {
    key: string; value: OpeningWallIndex;
  } {
    const roomFingerprint = space.rooms.map((room) => (
      `${room.id}:${room.poly?.map((point) => point.join(',')).join('/') || `${room.x},${room.y},${room.w},${room.h}`}`
    )).join(';');
    const wallFingerprint = this._spaceWalls.map((wall) => (
      `${wall.key}:${wall.a?.join(',') || ''}:${wall.b?.join(',') || ''}:${wall.cm}`
    )).join(';');
    const cutFingerprint = openCuts.map((cut) => cut.join(',')).join(';');
    const key = [
      space.id, this._cfgEpoch, this._wallKeyPitch, this._cellCm, this._gridPitch,
      roomFingerprint, wallFingerprint, cutFingerprint,
    ].join('|');
    let value = this._openingWallIndexCache.get(key);
    if (value) {
      // Refresh recency on hit; the pool is intentionally tiny because each
      // entry retains derived wall/tunnel geometry.
      lruWrite(this._openingWallIndexCache, key, value, 4);
    } else {
      value = buildOpeningWallIndex(
        space.rooms, this._spaceWalls, openCuts,
        this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
      );
      lruWrite(this._openingWallIndexCache, key, value, 4);
    }
    return { key, value };
  }

  /**
   * Room-coloured base beneath Glow/sun and beneath the architectural symbol.
   * The pure helper returns exact atomic wall strips in opening-local coords;
   * a hard-stop gradient changes side precisely at local y=0 (the wall axis),
   * never at an assumed 50% of an asymmetric bounding box.
   */
  private _renderOpeningTunnelFills(
    space: SpaceModel,
    roomFills: RoomFillFrame,
    layer: 'data' | 'glow-base' = 'data',
  ): TemplateResult {
    // Plan mode replaces live fills with its blue editing wash. A coloured
    // tunnel there would no longer repeat the room and could obstruct handles.
    if (this._markup || !this._spaceWalls.length || !this._openingsR.length)
      return svg`` as unknown as TemplateResult;
    // Do not leave an empty presentation layer behind when Glow is disabled
    // for every room. Besides keeping the DOM contract explicit, this avoids
    // needless opening-index work on plans that do not use the overlay.
    if (layer === 'glow-base' && ![...roomFills.byRoom.values()].some(Boolean))
      return svg`` as unknown as TemplateResult;
    const openCuts = this._openCuts();
    const geometryInputs = this._openingsR.map((opening) => ({
      x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
    }));
    const geometryFingerprint = geometryInputs
      .map((opening) => `${opening.x},${opening.y},${opening.angle},${opening.length}`).join(';');
    const wallIndex = this._openingWallIndexFor(space, openCuts);
    const cacheKey = `${wallIndex.key}|${geometryFingerprint}`;
    if (!this._openingTunnelCache || this._openingTunnelCache.key !== cacheKey) {
      this._openingTunnelCache = {
        key: cacheKey,
        value: openingTunnelGeometriesFromIndex(wallIndex.value, geometryInputs),
      };
    }
    return renderOpeningTunnelFills({
      openings: this._openingsR,
      geometries: this._openingTunnelCache.value,
      fillsByRoomId: roomFills.byId,
      idPrefix: `${space.id}-${layer}`,
      groupClass: layer === 'data' ? 'opening-tunnels' : 'opening-tunnels glow-base-tunnels',
      dataLayer: layer,
    });
  }

  /** Frame-local Glow-base projection. Data/static fills keep their exact
   * colors; a room receives darkness only when its selected data mode resolves
   * to no visible data object (for example Temperature without a sensor). */
  private _resolvedGlowBase(
    space: SpaceModel, disp: SpaceDisplay, dataFills: RoomFillFrame,
  ): RoomFillFrame {
    const byRoom = new Map<RoomCfg, ResolvedRoomFill | null>();
    const byId = new Map<string, ResolvedRoomFill | null>();
    const base = this._fillColors.glow_base;
    for (const room of space.rooms) {
      const dataFill = dataFills.byRoom.get(room);
      const resolved: ResolvedRoomFill | null = roomGlowOf(disp.glow, room)
        && (!dataFill || dataFill.opacity <= 0)
        ? { color: base.c, opacity: base.a, mode: 'glow' }
        : null;
      byRoom.set(room, resolved);
      if (room.id) byId.set(room.id, resolved);
    }
    return { byRoom, byId };
  }

  /**
   * Paint the same clean-floor geometry as the interactive room layer, but as
   * a pointer-transparent source-over overlay above the resolved data fill.
   */
  private _renderGlowBaseRooms(space: SpaceModel, frame: RoomFillFrame): TemplateResult {
    if (this._markup || ![...frame.byRoom.values()].some(Boolean))
      return svg`` as unknown as TemplateResult;
    const polys = new Map<RoomCfg, number[][] | null>(
      space.rooms.map((room) => [room, roomPoly(room)]),
    );
    const openCuts = this._openCuts();
    const roomWalls = this._wallUnionGeometry()?.roomGeom;
    const pathD = (points: number[][]) =>
      'M ' + points.map((point) => point[0] + ' ' + point[1]).join(' L ') + ' Z';
    const shapes = space.rooms.map((room) => {
      const fill = frame.byRoom.get(room) || null;
      const ownPoly = polys.get(room) || null;
      if (!fill || !ownPoly) return nothing;
      const floor = this._spaceWalls.length && room.id
        ? (this._innerRoomContour(space, room.id, openCuts, roomWalls) || ownPoly)
        : ownPoly;
      const otherPolys = space.rooms
        .filter((other) => other !== room)
        .map((other) => polys.get(other))
        .filter((poly): poly is number[][] => !!poly);
      const holes = islandsOf(floor, otherPolys);
      const cleanPath = this._cleanFloor(room, floor, space).path;
      if (cleanPath || holes.length) {
        return svg`<path class="glow-base" data-room-id=${room.id || nothing}
          d="${[cleanPath || pathD(floor), ...holes.map(pathD)].join(' ')}"
          fill=${fill.color} fill-opacity=${fill.opacity} fill-rule="evenodd"
          pointer-events="none"></path>`;
      }
      if (room.poly || floor !== ownPoly) {
        return svg`<polygon class="glow-base" data-room-id=${room.id || nothing}
          points="${floor.map((point) => point.join(',')).join(' ')}"
          fill=${fill.color} fill-opacity=${fill.opacity} pointer-events="none"></polygon>`;
      }
      return svg`<rect class="glow-base" data-room-id=${room.id || nothing}
        x=${room.x} y=${room.y} width=${room.w} height=${room.h}
        rx=${Math.min(room.w!, room.h!) * 0.03}
        fill=${fill.color} fill-opacity=${fill.opacity} pointer-events="none"></rect>`;
    });
    return svg`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${shapes}</g>` as unknown as TemplateResult;
  }

  private _renderWallBodies(disp: SpaceDisplay): TemplateResult {
    if (this._renderProjection === 'iso') return svg`` as unknown as TemplateResult;
    if (disp && !disp.showBorders && (this._mode === 'view' || this._mode === 'devices'))
      return svg`` as unknown as TemplateResult;
    const united = this._wallUnionGeometry();
    if (!united) return svg`` as unknown as TemplateResult;
    const stage = this._stageEl;
    const v = this._viewOr(this._baseVb());
    const px = stage && stage.clientWidth && v.w ? stage.clientWidth / v.w : 1;
    const stroke = disp?.color || '#607d8b';
    // Two independent ways for hatching to become noise: a body too thin to
    // hold stripes, and stripes too close to tell apart (#230 §8.4).
    const solid = wallBodyNeedsSolid(united.depthUnits, px)
      || wallHatchNeedsSolid(wallHatchStepUnits(this._cellCm), px);
    const wf = this._fillColors.wall_fill;
    // Fill colour UNDER the hatch (owner 2026-08-05): both, never one instead
    // of the other. When the body is thinner than ~3px on screen the hatch
    // collapses into noise — keep the solid fill alone.
    return svg`<g class="wallbodies" style="--room-stroke:${stroke};--wall-fill:${wf.c};--wall-fill-op:${wf.a}">
      ${united.paths.map((component) => svg`
        <path class="wallbody-fill" data-component=${component.id} d="${component.d}"
          fill="${wf.c}" fill-opacity="${wf.a}" fill-rule=${component.fillRule}
          stroke="none" pointer-events="none"></path>
        <path class="wallbody ${solid ? 'solid' : ''}"
          data-hp="wall" data-id="union" data-kind="union" data-component=${component.id}
          d="${component.d}" fill="${solid ? 'none' : 'url(#hp-wall-hatch)'}"
          fill-rule=${component.fillRule}
          stroke="${stroke}" stroke-width="${gridVisualUnits(0.6, this._cellCm)}"
          pointer-events="none"></path>`)}
    </g>` as unknown as TemplateResult;
  }

  private _isoDecorationLayers(disp: SpaceDisplay): IsoDecorationLayers {
    const filtersSupported = typeof CSS === 'undefined'
      || typeof CSS.supports !== 'function'
      || CSS.supports('filter', 'blur(1px)');
    const forcedColors = typeof matchMedia === 'function'
      && matchMedia('(forced-colors: active)').matches;
    return resolveIsoDecoration({
      showBorders: disp.showBorders,
      hideOpenings: disp.hideOpenings,
      filtersSupported,
      forcedColors,
    });
  }

  private _isoOpeningPanels(layers: IsoDecorationLayers): IsoOpeningPanel[] {
    if (!layers.panels) return [];
    const scene = this._isoScene();
    if (!scene) return [];
    const panels = scene.openings.flatMap((basis) => {
      const opening = this._openingsR[basis.sourceIndex];
      return opening ? projectIsoOpening(basis, this._openingAmt(opening)) : [];
    });
    return panels.sort((a, b) => a.depth - b.depth
      || a.sourceIndex - b.sourceIndex || a.leaf - b.leaf);
  }

  private _renderIsoDefs(
    layers: IsoDecorationLayers,
    root: 'underlay' | 'shadows' | 'walls',
  ): TemplateResult {
    const visualScale = gridVisualScale(this._cellCm);
    return svg`<defs>
      ${root === 'walls' && layers.materialNuance ? svg`
        <linearGradient id="hp-iso-wall-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="iso-side-hi"></stop><stop offset="1" class="iso-side-lo"></stop>
        </linearGradient>
        <linearGradient id="hp-iso-wall-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" class="iso-top-hi"></stop><stop offset="1" class="iso-top-lo"></stop>
        </linearGradient>` : nothing}
      ${root === 'underlay' && layers.shadows ? svg`
        <filter id="hp-iso-ambient-shadow" x="-12%" y="-12%" width="124%" height="130%">
          <feGaussianBlur stdDeviation="${7 * visualScale}"></feGaussianBlur>
        </filter>` : nothing}
      ${root === 'shadows' && layers.shadows ? svg`
        <filter id="hp-iso-contact-shadow" x="-8%" y="-20%" width="116%" height="140%">
          <feGaussianBlur stdDeviation="${2.5 * visualScale}"></feGaussianBlur>
        </filter>
        <filter id="hp-iso-leaf-shadow" x="-12%" y="-30%" width="124%" height="160%">
          <feGaussianBlur stdDeviation="${2 * visualScale}"></feGaussianBlur>
        </filter>` : nothing}
    </defs>` as unknown as TemplateResult;
  }

  private _renderIsoUnderlay(layers: IsoDecorationLayers): TemplateResult {
    if (!layers.structural) return svg`` as unknown as TemplateResult;
    const floor = this._isoScene()?.floor;
    if (!floor) return svg`` as unknown as TemplateResult;
    return svg`<g class="iso-underlay" data-hp="iso-underlay" aria-hidden="true" pointer-events="none">
      ${this._renderIsoDefs(layers, 'underlay')}
      ${layers.shadows && floor.footprintPath
        ? svg`<path class="iso-ambient-shadow" d=${floor.footprintPath}
            transform="translate(0 ${gridVisualUnits(8, this._cellCm)})"></path>`
        : nothing}
      <g class="iso-floor-edge">${floor.sides.map((face) =>
        svg`<path class="iso-floor-side" d=${face.d} data-component=${face.component}
          data-edge=${face.edge}></path>`)}</g>
    </g>` as unknown as TemplateResult;
  }

  private _renderIsoShadows(
    layers: IsoDecorationLayers,
    panels: readonly IsoOpeningPanel[],
  ): TemplateResult {
    if (!layers.shadows) return svg`` as unknown as TemplateResult;
    const geometry = this._isoScene()?.geometry;
    if (!geometry) return svg`` as unknown as TemplateResult;
    return svg`<g class="iso-shadows" data-hp="iso-shadows" aria-hidden="true" pointer-events="none">
      ${this._renderIsoDefs(layers, 'shadows')}
      <path class="iso-contact-shadow" d=${geometry.contactPath}></path>
      <g class="iso-leaf-shadows">${panels.map((panel) =>
        svg`<path class="iso-leaf-shadow" d=${panel.shadowD}
          data-id=${panel.id} data-leaf=${panel.leaf}></path>`)}</g>
    </g>` as unknown as TemplateResult;
  }

  private _renderIsoWalls(
    layers: IsoDecorationLayers,
    panels: readonly IsoOpeningPanel[],
  ): TemplateResult {
    if (this._renderProjection !== 'iso') return svg`` as unknown as TemplateResult;
    if (!layers.structural) return svg`` as unknown as TemplateResult;
    const scene = this._isoScene();
    if (!scene) return svg`` as unknown as TemplateResult;
    return svg`<g class="iso-walls" data-hp="iso-walls" data-fingerprint=${scene.key}>
      ${this._renderIsoDefs(layers, 'walls')}
      <g class="iso-wall-sides">${scene.geometry.sides.map((face) =>
        svg`<path class="iso-wall-side" d=${face.d} data-edge=${face.edge}></path>`)}</g>
      <path class="iso-wall-top" d=${scene.geometry.topPath} fill-rule="evenodd"></path>
      ${layers.panels ? svg`<g class="iso-openings" data-hp="iso-openings"
          aria-hidden="true" pointer-events="none">${panels.map((panel) =>
          svg`<path class="iso-opening-panel iso-${panel.type}" d=${panel.d}
            data-id=${panel.id} data-kind=${panel.type} data-leaf=${panel.leaf}></path>`)}</g>` : nothing}
    </g>` as unknown as TemplateResult;
  }

  /**
   * View-only clean-floor perimeter above real wall bodies.
   *
   * The hover follows the same inner face that defines the displayed room
   * area. A nested room is a hole in the hovered room, so its boundary uses the
   * opposite (outward) wall face. Open spans stay dashed in their own layer;
   * doors, windows and gates remain gaps instead of being bridged by a solid accent.
   */
  private _roomHoverPaths(space: SpaceModel): { fillD: string; outlineD: string } | null {
    const hover = this._hoverRoom;
    if (this._mode !== 'view' || !hover || hover.space !== space.id) {
      return null;
    }
    const room = space.rooms.find((r) => r === hover.room || (!!r.id && r.id === hover.room.id));
    if (!room) return null;
    const poly = roomPoly(room);
    if (!poly) return null;

    // A parent room also owns the floor-facing side of walls around rooms
    // nested inside it. Keep the room together with its cached polygon so a
    // hole can use the OUTER face of that nested room's wall.
    const others = space.rooms
      .filter((r) => r !== room)
      .map((r) => ({ room: r, poly: roomPoly(r) }))
      .filter((v): v is { room: RoomCfg; poly: number[][] } => !!v.poly);
    const islandPolys = islandsOf(poly, others.map((v) => v.poly));
    const allOpenCuts = this._openCuts();
    const eps = this._gridPitch * 0.02;
    const openCuts = allOpenCuts.filter((cut) => {
      const midpoint = [(cut[0] + cut[2]) / 2, (cut[1] + cut[3]) / 2];
      return poly.some((point, index) => distToSegment(
        midpoint, [point[0], point[1], ...poly[(index + 1) % poly.length]],
      ) <= eps * 4);
    });
    const walls = this._spaceWalls;
    const roomWalls = this._wallUnionGeometry()?.roomGeom;
    const floor = walls.length && room.id
      ? (this._innerRoomContour(space, room.id, allOpenCuts, roomWalls) || poly)
      : poly;
    const contours: { axis: number[][]; face: number[][] }[] = [{ axis: poly, face: floor }];
    for (const island of islandPolys) {
      const owner = others.find((v) => v.poly === island)?.room;
      let face = island;
      if (walls.length && owner?.id) {
        const profile = roomWallProfile(
          space.rooms, owner.id, walls, allOpenCuts,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        );
        if (profile) face = outsetContour(profile.poly, profile.offsets) || island;
      }
      contours.push({ axis: island, face });
    }
    // A hidden opening symbol is still a physical opening: never bridge a
    // doorway/window with the hover stroke merely because its symbol is off.
    const openingCuts = this._roomWallOpeningInputs(this._openingsR, space).map((o) => {
      const rad = (o.angle * Math.PI) / 180;
      const dx = (Math.cos(rad) * o.length) / 2;
      const dy = (Math.sin(rad) * o.length) / 2;
      return [o.x - dx, o.y - dy, o.x + dx, o.y + dy];
    });
    // Cuts are stored on wall centrelines. Project each relevant cut onto the
    // clean-floor face before trimming; otherwise a door on a thick wall would
    // no longer intersect the inset hover contour.
    const cutOnFace = (cut: number[], axis: number[][], face: number[][]): number[] | null => {
      const cx = cut[2] - cut[0], cy = cut[3] - cut[1];
      const cLen = Math.hypot(cx, cy);
      if (cLen < eps) return null;
      const cux = cx / cLen, cuy = cy / cLen;
      const mx = (cut[0] + cut[2]) / 2, my = (cut[1] + cut[3]) / 2;
      let belongs = false;
      for (let i = 0; i < axis.length; i++) {
        const a = axis[i], b = axis[(i + 1) % axis.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const eLen = Math.hypot(ex, ey);
        if (eLen < eps || Math.abs(cux * (ey / eLen) - cuy * (ex / eLen)) > 0.05) continue;
        if (distToSegment([mx, my], [a[0], a[1], b[0], b[1]]) <= eps * 4) {
          belongs = true;
          break;
        }
      }
      if (!belongs) return null;

      let best: { a: number[]; b: number[]; d: number } | null = null;
      for (let i = 0; i < face.length; i++) {
        const a = face[i], b = face[(i + 1) % face.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const eLen = Math.hypot(ex, ey);
        if (eLen < eps || Math.abs(cux * (ey / eLen) - cuy * (ex / eLen)) > 0.05) continue;
        const d = distToSegment([mx, my], [a[0], a[1], b[0], b[1]]);
        if (!best || d < best.d) best = { a, b, d };
      }
      if (!best) return null;
      const fx = best.b[0] - best.a[0], fy = best.b[1] - best.a[1];
      const fLen = Math.hypot(fx, fy) || 1;
      const nx = -fy / fLen, ny = fx / fLen;
      const shift = (best.a[0] - mx) * nx + (best.a[1] - my) * ny;
      return [
        cut[0] + nx * shift, cut[1] + ny * shift,
        cut[2] + nx * shift, cut[3] + ny * shift,
      ];
    };

    const rawCuts = openCuts.concat(openingCuts);
    const d = contours.map(({ axis, face }) => {
      const cuts = rawCuts
        .map((cut) => cutOnFace(cut, axis, face))
        .filter((cut): cut is number[] => !!cut);
      if (!cuts.length) {
        return `M ${face.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
      }
      return outlineWithout(face, cuts, eps)
        .map((sg) => `M ${sg[0]} ${sg[1]} L ${sg[2]} ${sg[3]}`)
        .join(' ');
    }).filter(Boolean).join(' ');
    if (!d) return null;
    const pathOf = (points: number[][]) =>
      `M ${points.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
    const cleanFloor = this._cleanFloor(room, floor, space).path || pathOf(floor);
    const fillD = [cleanFloor, ...islandPolys.map(pathOf)].join(' ');
    return { fillD, outlineD: d };
  }

  private _renderRoomHoverFill(
    paths: { fillD: string; outlineD: string } | null,
  ): TemplateResult {
    return svg`<g class="room-hover room-hover-fill-layer" pointer-events="none">
      <path class="room-hover-fill" data-hp-live-room-hover="fill"
        d="${paths?.fillD || ''}" ?hidden=${!paths} fill-rule="evenodd"></path>
    </g>` as unknown as TemplateResult;
  }

  private _renderRoomHoverOutline(
    paths: { fillD: string; outlineD: string } | null,
  ): TemplateResult {
    return svg`<g class="room-hover room-hover-outline-layer" pointer-events="none">
      <path class="room-hover-halo" data-hp-live-room-hover="halo"
        d="${paths?.outlineD || ''}" ?hidden=${!paths}></path>
      <path class="room-hover-outline" data-hp-live-room-hover="outline"
        d="${paths?.outlineD || ''}" ?hidden=${!paths}></path>
    </g>` as unknown as TemplateResult;
  }

  /** Hover highlight for the wall-thickness tool (SVG). */
  private _renderWallThickUi(): TemplateResult {
    if (!this._editorRuntime) return svg`` as unknown as TemplateResult;
    return this._editorRuntimeOrThrow()._renderWallThickUi();
  }

  /** Thickness input popover, anchored in stage % like measure labels. */
  private _renderWallThickDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderWallThickDialog();
  }


  private _openingAt(raw: readonly number[]): RenderOpening | null {
    return this._editorRuntimeOrThrow()._openingAt(raw);
  }

  private _resolveOpeningPlacement(raw: readonly number[]): OpeningPlacementCandidate | null {
    return this._editorRuntimeOrThrow()._resolveOpeningPlacement(raw);
  }

  private _activateOpeningPlacement(type: OpeningPlacementType): void {
    return this._editorRuntimeOrThrow()._activateOpeningPlacement(type);
  }

  private _clearOpeningPlacement(clearPreset: boolean): void {
    if (!this._editorRuntime) {
      this._openingHoverCandidate = null;
      this._openingJambBlockCm = null;
      if (clearPreset) {
        this._openingPreset = null;
        this._openingRebindId = null;
      }
      return;
    }
    return this._editorRuntimeOrThrow()._clearOpeningPlacement(clearPreset);
  }

  /** Opening tool: click an existing opening to edit it, or a wall to place one. */
  private _openingClick(raw: number[]): void {
    return this._editorRuntimeOrThrow()._openingClick(raw);
  }

  /** Open the properties dialog for an existing opening. */
  private _editOpening(o: RenderOpening): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._editOpening(o);
  }

  /** Drag an opening along the walls (view mode): it re-snaps continuously. */
  private _opPointerDown(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._opPointerDown(ev, o);
  }

  private _opPointerMove(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._opPointerMove(ev, o);
  }

  /**
   * Shoulder rulers + the soft centre magnet for an opening of `rlen` sitting
   * at a wall snap. ONE implementation for both gestures the owner asked to
   * behave alike (2026-08-03): dragging an existing opening and placing a new
   * one. `tol` is half a grid step; the centre magnet and along-wall grid step
   * are mandatory. The returned
   * x/y are ALREADY magnetised, so the caller just writes them.
   */
  private _opRuler(
    snap: { x: number; y: number; angle: number },
    rlen: number,
  ): { x: number; y: number; angle: number; measure: OpMeasure | null } {
    return this._editorRuntimeOrThrow()._opRuler(snap, rlen);
  }

  private _opPointerUp(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._opPointerUp(ev, o);
  }

  /** Click: the status card (delayed so a double click can cancel it). */
  private _opClick(ev: MouseEvent, o: RenderOpening): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._opClick(ev, o);
  }

  private _saveOpening(): void {
    return this._editorRuntimeOrThrow()._saveOpening();
  }

  private _deleteOpening(): void {
    return this._editorRuntimeOrThrow()._deleteOpening();
  }

  private _rebindPartitionOpening = (): void => {
    return this._editorRuntimeOrThrow()._rebindPartitionOpening();
  }

  /** Contact-sensor candidates: door/window/gate-like classes first, then the rest. */
  private _contactCandidates(): { value: string; label: string }[] {
    return this._editorRuntimeOrThrow()._contactCandidates();
  }

  private _lockCandidates(): { value: string; label: string }[] {
    return this._editorRuntimeOrThrow()._lockCandidates();
  }

  private _toggleOpeningEntityPicker(kind: 'contact' | 'lock'): void {
    return this._editorRuntimeOrThrow()._toggleOpeningEntityPicker(kind);
  }

  private _filterOpeningEntities(kind: 'contact' | 'lock', value: string): void {
    return this._editorRuntimeOrThrow()._filterOpeningEntities(kind, value);
  }

  private _selectOpeningEntity(kind: 'contact' | 'lock', value: string): void {
    return this._editorRuntimeOrThrow()._selectOpeningEntity(kind, value);
  }

  /** Merge: first click picks a room, second picks the room to merge it with. */
  private _mergeClick(raw: number[]): void {
    return this._editorRuntimeOrThrow()._mergeClick(raw);
  }

  private _commitMerge(): void {
    return this._editorRuntimeOrThrow()._commitMerge();
  }

  /** Split: click the room, then two points on its walls. */
  private _splitClick(raw: number[]): void {
    return this._editorRuntimeOrThrow()._splitClick(raw);
  }

  private get _contourClosed(): boolean {
    // Legacy/split dialog closure appends a render-only edge and records its
    // thickness separately. #173 graph closure persists the terminal segment
    // in the draft, so it must stay editable after Cancel.
    return this._path.length >= 4
      && this._samePt(this._path[0], this._path[this._path.length - 1])
      && (this._closingWallCm != null || !this._activeDraftId);
  }

  private _markupMove(ev: MouseEvent): void {
    if (!this._markup || !this._editorRuntime) return;
    this._editorRuntimeOrThrow()._queuePointerMove('markup-hover', () => this._editorRuntime!._markupMove(ev));
  }

  /** One resolved architectural candidate shared by hover and click. */
  private get _openingPreview(): OpeningPlacementCandidate | null {
    const preset = this._openingPreset;
    if (this._tool !== 'opening' || !preset || !this._cursorPt) return null;
    const raw = this._cursorPt;
    const cached = this._openingHoverCandidate;
    if (cached && sameOpeningPlacementInput(
      cached, [raw[0], raw[1]], preset.revision, this._cfgEpoch,
    )) return cached;
    // an existing opening under the cursor will be edited, not added — no preview
    if (this._openingAt(raw)) {
      this._openingHoverCandidate = null;
      return null;
    }
    const resolved = this._resolveOpeningPlacement(raw);
    this._openingHoverCandidate = resolved;
    return resolved;
  }

  /** The rulers to draw right now: from the DRAG of an existing opening, or
   *  from the PLACEMENT preview of a new one — identical badges either way. */
  private get _opMeasureView(): OpMeasure | null {
    return this._opMeasure || this._openingPreview?.measure || null;
  }

  /** Save a room with an optional HA-area binding.
   *  An area supplies the fallback name; a room without one needs a name. */
  private _saveRoom(): void {
    return this._editorRuntimeOrThrow()._saveRoom();
  }

  private _decideWallFace(create: boolean): void {
    return this._editorRuntimeOrThrow()._decideWallFace(create);
  }

  private _wallSourceCmAt(
    point: number[], activePath: number[][], activeCms: number[],
  ): number {
    return this._editorRuntimeOrThrow()._wallSourceCmAt(point, activePath, activeCms);
  }

  private _activePathWithRepair(
    path: number[][], proposal: WallFaceRepairProposal | undefined,
  ): number[][] {
    return this._editorRuntimeOrThrow()._activePathWithRepair(path, proposal);
  }

  private _validateWallRepair(
    proposal: WallFaceRepairProposal, activePath: number[][],
  ): boolean {
    return this._editorRuntimeOrThrow()._validateWallRepair(proposal, activePath);
  }

  /** Apply one revalidated endpoint move inside the surrounding room transaction. */
  private _applyWallRepair(
    proposal: WallFaceRepairProposal, batch: WallFaceBatch,
  ): boolean {
    return this._editorRuntimeOrThrow()._applyWallRepair(proposal, batch);
  }

  /** Revalidate and apply every queued answer as one geometry transaction. */
  private _applyWallFaceBatch(): void {
    return this._editorRuntimeOrThrow()._applyWallFaceBatch();
  }

  private _commitRoom(): void {
    return this._editorRuntimeOrThrow()._commitRoom();
  }

  private _cancelPath(): void {
    return this._editorRuntimeOrThrow()._cancelPath();
  }

  private _resumeLastDraft(): void {
    return this._editorRuntimeOrThrow()._resumeLastDraft();
  }

  /** Cancel a room flow without applying geometry; graph batches keep their terminal draft. */
  private _roomDialogCancel(): void {
    return this._editorRuntimeOrThrow()._roomDialogCancel();
  }

  /** HA areas not yet assigned to any room in the config. */
  private get _freeAreas(): any[] {
    const used = new Set<string>();
    for (const sp of this._serverCfg?.spaces || [])
      for (const r of sp.rooms || []) if (r.area) used.add(r.area);
    for (const decision of this._wallFaceBatch?.decisions || [])
      if (decision.create && decision.area) used.add(decision.area);
    return Object.values<any>(this.hass?.areas || {})
      .filter((a) => !used.has(a.area_id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  // ================= DEVICE EDITOR (markers) =================

  private _openDeviceInbox(): void {
    return this._editorRuntimeOrThrow()._openDeviceInbox();
  }

  private _closeMarkerDialog(): void {
    return this._editorRuntimeOrThrow()._closeMarkerDialog();
  }

  private _deviceInboxCandidates(showEntities: boolean) {
    return this._editorRuntimeOrThrow()._deviceInboxCandidates(showEntities);
  }

  private _deviceInboxRows(): DeviceInboxRow[] {
    return this._editorRuntimeOrThrow()._deviceInboxRows();
  }

  private _deviceForInboxRow(row: DeviceInboxRow): DevItem | null {
    return this._editorRuntimeOrThrow()._deviceForInboxRow(row);
  }

  private _openInboxMarker(row: DeviceInboxRow, add = false): void {
    return this._editorRuntimeOrThrow()._openInboxMarker(row, add);
  }

  private async _setInboxHidden(row: DeviceInboxRow, hidden: boolean): Promise<void> {
    return this._editorRuntimeOrThrow()._setInboxHidden(row, hidden);
  }

  private _findInboxDevice(row: DeviceInboxRow): void {
    return this._editorRuntimeOrThrow()._findInboxDevice(row);
  }

  private _deviceInboxTabKey(event: KeyboardEvent): void {
    return this._editorRuntimeOrThrow()._deviceInboxTabKey(event);
  }

  private _openMarkerDialog(d?: DevItem): void {
    if (!this._editorRuntime) {
      void this._ensureEditorRuntime().then((ready) => {
        if (ready) this._openMarkerDialog(d);
      });
      return;
    }
    return this._editorRuntime._openMarkerDialog(d);
  }

  /** Runnable targets for the 'run' tap action: automations, scripts, scenes. */
  private _runCandidates(): { value: string; label: string; sub: string }[] {
    return this._editorRuntimeOrThrow()._runCandidates();
  }

  /** Binding candidates: HA devices + group/helper entities, minus the ones already placed. */
  private _bindingCandidates(): { value: string; label: string; sub: string }[] {
    return this._editorRuntimeOrThrow()._bindingCandidates();
  }

  /** A closed outline may intentionally remain a set of independent walls. */
  private _keepClosedAsPartitions = (): void => {
    return this._editorRuntimeOrThrow()._keepClosedAsPartitions();
  }

  /** All independent physical bodies in render units. Physics intentionally
   * does not depend on show_borders. */
  private _physicalBodiesR(space: SpaceModel | undefined = this._spaceModel()): number[][][] {
    if (!space) return [];
    const key = `${space.id}|${this._cfgEpoch}|${this._cellCm}|${this._gridPitch}`;
    if (this._physicalBodiesCache?.key === key) return this._physicalBodiesCache.all;
    const frame = physicalBodyParts(
      space, this._cellCm, this._gridPitch, this._gridPitch * 0.0002,
      this._partitionOpeningCuts(space),
    );
    this._physicalBodiesCache = { key, ...frame };
    return frame.all;
  }

  /** Per-record bodies remain the editor/furniture identity surface. */
  private _rawPhysicalBodiesR(space: SpaceModel | undefined = this._spaceModel()): number[][][] {
    if (!space) return [];
    this._physicalBodiesR(space);
    const frame = this._physicalBodiesCache;
    return frame ? [...frame.drafts, ...frame.partitions, ...frame.columns] : [];
  }

  /** Cached clean floor. A cheap bbox pass is the spatial index needed for
   * rooms which touch only a small subset of independent bodies. */
  private _cleanFloor(
    room: RoomCfg, floor: number[][], space: SpaceModel | undefined = this._spaceModel(),
  ): { floor: number[][]; geom: any; path: string; area: number } {
    if (!space) {
      return {
        floor, geom: null, path: '',
        area: geometryArea([[[...floor, floor[0]]]]),
      };
    }
    const roomKey = room.id || `#${space.rooms.indexOf(room)}`;
    const key = `${space.id}|${this._cfgEpoch}|${roomKey}`;
    if (!this._resize?.preview) {
      const cached = lruRead(this._cleanFloorCache, key);
      if (cached.hit) return cached.value;
    }
    const xs = floor.map((p) => p[0]), ys = floor.map((p) => p[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const candidates = this._physicalBodiesR(space).filter((body) => {
      const bx = body.map((p) => p[0]), by = body.map((p) => p[1]);
      return Math.max(...bx) >= box[0] && Math.min(...bx) <= box[2]
        && Math.max(...by) >= box[1] && Math.min(...by) <= box[3];
    });
    const geom = candidates.length ? floorMinusBodies(floor, candidates) : null;
    const result = {
      floor,
      geom,
      path: geom ? polyclipPathD(geom) : '',
      area: geom ? geometryArea(geom) : geometryArea([[[...floor, floor[0]]]]),
    };
    if (!this._resize?.preview) {
      lruWrite(this._cleanFloorCache, key, result, 600);
    }
    return result;
  }

  /** Effective auto icon for a binding selected but not saved yet. */
  private _autoIconForBinding(binding: string): string {
    if (binding === 'virtual') return 'mdi:map-marker';
    const [kind, ref] = binding.split(':');
    if (!ref) return '';
    const h = this._fullRegistryHass;
    const status = this._bindingStatus(binding);
    const activeEntities = status.kind === 'active' ? status.enabledEntityIds : status.allEntityIds;
    if (kind === 'device') {
      const dev = h.devices?.[ref];
      if (!dev) return 'mdi:help-circle';
      const entities = activeEntities;
      if (entities.some((eid) => eid.startsWith('lock.'))) return 'mdi:lock';
      return resolveIcon(
        h, dev.name_by_user || dev.name || '', dev.model, entities, this._iconRules,
      );
    }
    if (kind === 'entity') {
      const reg = h.entities?.[ref];
      const state = this.hass.states?.[ref];
      const name = reg?.name || state?.attributes?.friendly_name || ref;
      return ref.startsWith('lock.')
        ? 'mdi:lock'
        : resolveIcon(h, name, '', [ref], this._iconRules);
    }
    return '';
  }

  /** List of rooms across all spaces for a virtual device. */
  private _allRoomsFlat(): { value: string; label: string }[] {
    const res: { value: string; label: string }[] = [];
    for (const sp of this._serverCfg?.spaces || []) {
      for (const r of sp.rooms || []) {
        if (r.area) {
          res.push({ value: sp.id + '#' + r.area, label: (sp.title || sp.id) + ' · ' + r.name });
        } else if (r.id) {
          // sub-area room (no HA area): manual placement by room id — issue #3
          res.push({
            value: sp.id + '#@' + r.id,
            label: (sp.title || sp.id) + ' · ' + r.name + ' · ' + this._t('marker.subarea'),
          });
        }
      }
    }
    return res;
  }

  /** Readable error text (never “[object Object]”). */
  private _errText(e: any): string {
    if (!e) return this._t('err.unknown');
    if (typeof e === 'string') return e;
    if (e.code === 'invalid_passage_fields') {
      // #42: structured JSON details first; the legacy "space=..;.." format
      // stays accepted for one beta (deprecated 2026-08-30, remove with the
      // next stable) while old backends are still around.
      const raw = String(e.message || e.error || '');
      let spaceId = '', fieldList: string[] = [];
      try {
        const details = JSON.parse(raw);
        spaceId = String(details.space ?? '');
        fieldList = Array.isArray(details.fields) ? details.fields.map(String) : [];
      } catch {
        const match = raw.match(/space=([^;]*);\s*opening=([^;]*);\s*fields=([^;]*)/);
        if (match) { spaceId = match[1]; fieldList = match[3].split(',').filter(Boolean); }
      }
      if (spaceId || fieldList.length) {
        const space = this._serverCfg?.spaces
          ?.find((item: { id?: unknown }) => String(item.id) === spaceId);
        const labels: Record<string, I18nKey> = {
          contact: 'opening.contact_label', lock: 'opening.lock_label', invert: 'opening.invert',
          flip_h: 'opening.flip_h', flip_v: 'opening.flip_v',
        };
        const fields = fieldList
          .map((field) => labels[field] ? this._t(labels[field]) : field).join(', ');
        return this._t('opening.invalid_passage_fields', {
          room: space?.title || spaceId, fields,
        });
      }
    }
    if (e.code === 'invalid_partition_opening_jamb_margin') {
      const raw = String(e.message || e.error || '');
      let marginCm = NaN;
      try {
        marginCm = Number(JSON.parse(raw).margin_cm);
      } catch {
        const match = raw.match(/margin_cm=([^;}"]*)/); // legacy format, one beta
        marginCm = match ? Number(match[1]) : NaN;
      }
      if (Number.isFinite(marginCm)) {
        return this._t('opening.partition_jamb_margin', {
          distance: formatLength(marginCm, this._imperial),
        });
      }
    }
    // #42 code-first: a backend code always renders a localized message —
    // the raw English e.message goes to the console for debugging, never
    // into the DOM. Errors WITHOUT a code (plain JS failures) keep showing
    // their message: there is nothing better to show.
    if (e.code != null) {
      const key = `backup.error.${e.code}` as I18nKey;
      const localized = this._t(key);
      if (e.message) console.warn('[houseplan] backend error', e.code, e.message);
      return localized !== key ? localized : this._t('err.code', { code: e.code });
    }
    if (e.message) return e.message;
    if (e.error) return e.error;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  private _backupErrorText(e: any): string {
    return this._editorRuntimeOrThrow()._backupErrorText(e);
  }

  /**
   * Manual files are uploaded via HTTP (multipart) — not via WebSocket, whose message size
   * limit breaks the connection on large PDFs.
   */
  private async _pickMarkerFiles(ev: Event): Promise<void> {
    return this._editorRuntimeOrThrow()._pickMarkerFiles(ev);
  }

  private _removeMarkerPdf(url: string): void {
    return this._editorRuntimeOrThrow()._removeMarkerPdf(url);
  }

  /** Persist only deliberate role/appearance edits; untouched legacy absence stays absent. */
  private _markerLightFields(d: NonNullable<HouseplanCard['_markerDialog']>): Partial<Marker> {
    return this._editorRuntimeOrThrow()._markerLightFields(d);
  }

  /** Preserve absent/default and legacy cover until the user edits the select. */
  private _markerTapActionFields(
    d: NonNullable<HouseplanCard['_markerDialog']>,
  ): Pick<Marker, 'tap_action'> | Record<string, never> {
    return this._editorRuntimeOrThrow()._markerTapActionFields(d);
  }

  /** Preserve absence and stale/future literals until this exact selector is edited. */
  private _markerToggleEntityFields(
    d: NonNullable<HouseplanCard['_markerDialog']>,
  ): Pick<Marker, 'toggle_entity'> | Record<string, never> {
    return this._editorRuntimeOrThrow()._markerToggleEntityFields(d);
  }

  private async _saveMarker(): Promise<void> {
    return this._editorRuntimeOrThrow()._saveMarker();
  }

  private async _deleteMarker(): Promise<void> {
    return this._editorRuntimeOrThrow()._deleteMarker();
  }

  private _normPos(space: string, x: number, y: number): { s: string; x: number; y: number } {
    return { s: space, x: x / NORM_W, y: y / NORM_W };
  }

  // ================= SPACE MANAGEMENT =================

  private _spaceDialogUsesOnboardingRuntime(mode: 'edit' | 'create'): boolean {
    return mode === 'create' && !this._editorRuntime && (
      !!this._onboardingRuntime
      ||
      (this._serverCfg?.spaces.length || 0) === 0
      || this._importTotal > 0
      || this._importQueue.length > 0
    );
  }

  private _spaceRuntimeOrThrow(): import('./houseplan-onboarding-runtime').HouseplanOnboardingRuntime {
    if (!this._onboardingRuntime) throw new Error('Houseplan onboarding runtime is not loaded');
    return this._onboardingRuntime;
  }

  private _openSpaceDialog(mode: 'edit' | 'create', spaceId?: string): void {
    if (this._spaceDialogUsesOnboardingRuntime(mode)) {
      if (this._onboardingRuntime) {
        this._onboardingRuntime._openSpaceDialog(mode, spaceId);
        return;
      }
      void this._ensureOnboardingRuntime().then((ready) => {
        if (ready) this._spaceRuntimeOrThrow()._openSpaceDialog(mode, spaceId);
      });
      return;
    }
    if (!this._editorRuntime) {
      void this._ensureEditorRuntime().then((ready) => {
        if (ready) this._openSpaceDialog(mode, spaceId);
      });
      return;
    }
    return this._editorRuntime._openSpaceDialog(mode, spaceId);
  }

  /** Background file selection: read base64 and determine the aspect ratio. */
  private async _pickPlanFile(ev: Event): Promise<void> {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime('create')) {
      return this._onboardingRuntime._pickPlanFile(ev);
    }
    return this._editorRuntimeOrThrow()._pickPlanFile(ev);
  }

  /**
   * Plans that are on the server but not attached anywhere are not garbage —
   * the component never deletes them (docs/SCOPE.md), which only makes sense if
   * they can be found again. This is that: detach a plan, come back later, pick
   * it out of the list. It is also the only way one is ever deleted.
   */
  private _toggleServerPlans = async (): Promise<void> => {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime('create')) {
      return this._onboardingRuntime._toggleServerPlans();
    }
    return this._editorRuntimeOrThrow()._toggleServerPlans();
  }

  /** The in-flight proportions read for the last picked saved plan. Save
   *  awaits it rather than shipping whatever was there before (HP-1490-04). */
  private _aspectJob: Promise<number> | null = null;

  private _useServerPlan(url: string): void {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime('create')) {
      return this._onboardingRuntime._useServerPlan(url);
    }
    return this._editorRuntimeOrThrow()._useServerPlan(url);
  }

  /**
   * Read a stored plan's proportions from the image itself.
   *
   * The content endpoint needs a signature, and `_display()` deliberately
   * returns nothing until one arrives. Loading too early therefore failed and
   * an earlier version treated that as "unknown ratio" and saved a fallback of
   * 1.414 — a square plan came out stretched (HP-1470-03). So wait for the
   * signature, and bind the result to THIS dialog and THIS url, or a late
   * answer would reshape whatever the user opened next.
   */
  private async _readPlanAspect(url: string): Promise<number> {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime('create')) {
      return this._onboardingRuntime._readPlanAspect(url);
    }
    return this._editorRuntimeOrThrow()._readPlanAspect(url);
  }

  private async _deleteServerPlan(name: string): Promise<void> {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime('create')) {
      return this._onboardingRuntime._deleteServerPlan(name);
    }
    return this._editorRuntimeOrThrow()._deleteServerPlan(name);
  }

  private _renderServerPlans(d: NonNullable<typeof this._spaceDialog>): TemplateResult {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime(d.mode)) {
      return this._onboardingRuntime._renderServerPlans(d);
    }
    return this._editorRuntimeOrThrow()._renderServerPlans(d);
  }

  private async _saveSpaceDialog(): Promise<void> {
    if (this._onboardingRuntime && this._spaceDialogUsesOnboardingRuntime('create')) {
      return this._onboardingRuntime._saveSpaceDialog();
    }
    return this._editorRuntimeOrThrow()._saveSpaceDialog();
  }

  private async _deleteSpace(): Promise<void> {
    return this._editorRuntimeOrThrow()._deleteSpace();
  }

  /** Immediate config save with a revision bump (no debounce).

  On a rev conflict the local copy is refreshed before rethrowing, so the
  user's retry starts from the fresh config instead of hitting the same
  conflict again. */
  private async _saveConfigNow(): Promise<void> {
    return this._editorRuntimeOrThrow()._saveConfigNow();
  }


  // ================= FLOORS IMPORT WIZARD =================

  private _startImport(): void {
    if (this._onboardingRuntime) return this._onboardingRuntime._startImport();
    return this._editorRuntimeOrThrow()._startImport();
  }

  /** Open the space dialog for the next queued floor (title prefilled, plan required). */
  private _openNextImport(): void {
    if (this._onboardingRuntime) return this._onboardingRuntime._openNextImport();
    return this._editorRuntimeOrThrow()._openNextImport();
  }

  /** Skip the current floor of the wizard without creating a space. */
  private _skipImport(): void {
    if (this._onboardingRuntime) return this._onboardingRuntime._skipImport();
    return this._editorRuntimeOrThrow()._skipImport();
  }

  private _renderImportDialog(): TemplateResult {
    if (this._onboardingRuntime) return this._onboardingRuntime._renderImportDialog();
    return this._editorRuntimeOrThrow()._renderImportDialog();
  }

  // ================= SUN ON THE PLAN (docs/SUN.md) =================

  /** Global settings with the general-settings dialog's pending values. */
  private _sunGlobal(): any {
    const gd = this._settingsDialog;
    if (!gd) return this._settings;
    return {
      ...this._settings,
      north_deg: gd.northDeg ?? undefined,
      bg_mode: gd.bgMode,
      sun_rays: gd.sunRays,
    };
  }

  /** Current space settings with the space dialog's pending values. */
  private _sunSpace(): any {
    const sd = this._spaceDialog;
    const saved = this._curSpaceCfg?.settings || {};
    if (!sd || sd.mode !== 'edit' || sd.spaceId !== this._space) return saved;
    return {
      ...saved,
      north_deg: sd.northDeg ?? undefined,
      bg_mode: sd.bgMode ?? undefined,
      sun_rays: sd.sunRays ?? undefined,
    };
  }

  /** Effective compass; null = the whole sun feature is inert (docs/SUN.md). */
  private _effNorth(): number | null {
    return northDegOf(this._sunGlobal(), this._sunSpace());
  }

  private _effBgMode(): 'static' | 'daynight' {
    return bgModeOf(this._sunGlobal(), this._sunSpace());
  }

  /** Current four-phase environment. Editors stay static; #101 supplies viewWeight. */
  private _dayCycleState(now: Date | number = new Date()): DayCycleState | null {
    const viewWeight = this._modeTransitionVisual?.viewWeight ?? (this._mode === 'view' ? 1 : 0);
    if (viewWeight <= 0 || this._effBgMode() !== 'daynight') return null;
    return resolveDayCycle(this._renderPlanHass, now);
  }

  private _dayCycleTick = (): void => {
    if (!this.isConnected || this.ownerDocument.visibilityState === 'hidden') return;
    const state = this._dayCycleState();
    if (!state) {
      if (this._dayCycleTimer) { clearInterval(this._dayCycleTimer); this._dayCycleTimer = 0; }
      this._dayCycleClockKey = '';
      return;
    }
    const key = dayCycleFingerprint(state);
    if (key === this._dayCycleClockKey) return;
    this._dayCycleClockKey = key;
    this.requestUpdate();
  };

  /** Arm a 30 s timer only for the browser-clock fallback while visible. */
  private _syncDayCycleClock(): void {
    const state = this._dayCycleState();
    this._dayCycleClockKey = state ? dayCycleFingerprint(state) : '';
    const needsTimer = state?.source === 'clock'
      && this.ownerDocument.visibilityState !== 'hidden' && this.isConnected;
    if (needsTimer && !this._dayCycleTimer) {
      this._dayCycleTimer = window.setInterval(this._dayCycleTick, 30_000);
    } else if (!needsTimer && this._dayCycleTimer) {
      clearInterval(this._dayCycleTimer);
      this._dayCycleTimer = 0;
    }
  }

  private _dayCycleVisibility(signal: PageVisibilitySignal): void {
    if (signal.kind === 'hidden') {
      if (this._dayCycleTimer) { clearInterval(this._dayCycleTimer); this._dayCycleTimer = 0; }
      return;
    }
    this._dayCycleTick();
    this._syncDayCycleClock();
  }

  private _effSunRays(): boolean {
    return sunRaysOn(this._sunGlobal(), this._sunSpace());
  }

  /** sun.sun, but only when the feature is armed (north_deg set somewhere). */
  private _sunNow(): { azimuth: number; elevation: number } | null {
    return this._effNorth() !== null ? sunStateOf(this._renderPlanHass) : null;
  }

  /**
   * Window light wedges (docs/SUN.md): view/kiosk only. Geometry recomputes
   * ONLY when the memo key changes — sun attributes tick every ~30-120 s and
   * everything else in `hass` must not trigger the polygon clipping.
   */
  private _renderSunRays(space: SpaceModel): TemplateResult {
    const empty = svg`` as unknown as TemplateResult;
    // HARD gates — the feature is simply not on: leaving an editor, a space
    // with rays off, or night. Those never fade, they just are not there.
    // Logical mode changes at transition start. Keep the outgoing view-only
    // layer alive until #101's `viewWeight` reaches zero instead of dropping
    // the rays in frame zero.
    const transitionViewWeight = this._modeTransitionVisual?.viewWeight ?? 0;
    if ((this._editing && transitionViewWeight <= 0) || !this._effSunRays()) {
      this._sunFadeReset();
      return empty;
    }
    const north = this._effNorth();
    const sun = north !== null ? sunStateOf(this._renderPlanHass) : null;
    if (!sun || sun.elevation <= 0) { this._sunFadeReset(); return empty; }
    const alpha = rayPeakAlpha();
    // The ONE thing that fades (owner 2026-08-03): the 3° threshold. Above it
    // the layer is there at full strength, below it gone — with a 2 s CSS
    // fade either way. The keep-alive below is what lets the fade-OUT play at
    // all: without it the layer would leave the DOM in the same frame.
    if (raysVisible(sun.elevation)) {
      if (this._sunOutTimer) { clearTimeout(this._sunOutTimer); this._sunOutTimer = 0; }
      this._sunOut = false;
      this._sunShown = true;
    } else {
      if (!this._sunShown) return empty; // never lit: nothing to dissolve
      if (!this._sunOut) {
        this._sunOut = true;
        this._sunOutTimer = window.setTimeout(() => {
          this._sunOutTimer = 0;
          this._sunShown = false;
          this._sunOut = false;
          this.requestUpdate();
        }, RAY_FADE_MS);
      }
    }
    // DEV-B701-01: the geometry signal must be _cfgEpoch, not _cfgRev.
    // Every local mutation ends in _saveConfig(), which bumps the epoch
    // SYNCHRONOUSLY; _cfgRev only moves after the debounced WS write is
    // acked, so a rev-keyed memo served wedges for the OLD window position
    // during the whole write window (and forever if the write failed).
    const zeroWalls = this._zeroWalls();
    const zeroKey = zeroWalls.barriers.map((line) => line.join(',')).join(';');
    const key = `${space.id}|${sun.azimuth}|${sun.elevation}|${north}|${this._cfgEpoch}`
      + `|${zeroWalls.style}|${zeroKey}`;
    if (!this._sunRaysCache || this._sunRaysCache.key !== key) {
      const rooms = space.rooms
        .map((r) => ({ id: r.id || '', poly: roomPoly(r) }))
        .filter((r): r is { id: string; poly: number[][] } => !!r.id && !!r.poly);
      const windows = this._openingsR
        // A contour-wall host is stable identity metadata, not a different
        // physical carrier. Only an independent partition window is excluded
        // from exterior sunlight (#132, ADR 282 Stage 1).
        .filter((o) => o.type === 'window' && o.host?.kind !== 'partition')
        .map((o) => ({ id: o.id, x: o.rx, y: o.ry, angle: o.angle, length: o.rlen }));
      const walls = this._spaceWalls;
      const openCuts = this._openCuts();
      const openingWallIndex = this._openingWallIndexFor(space, openCuts).value;
      const innerByRoom: Record<string, number[][]> = {};
      const wallDepthByOpening: Record<string, number> = {};
      const roomWalls = this._wallUnionGeometry()?.roomGeom;
      if (walls.length) {
        for (const r of rooms) {
          const inn = this._innerRoomContour(space, r.id, openCuts, roomWalls);
          if (inn) innerByRoom[r.id] = inn;
        }
        for (const o of windows) {
          const face = openingInnerFaceOffsetFromIndex(
            openingWallIndex, { x: o.x, y: o.y, angle: o.angle, length: o.length },
          );
          if (face.cm > 0) {
            wallDepthByOpening[o.id] = wallCmToUnits(face.cm, this._cellCm, this._gridPitch);
          }
        }
      }
      let rays = computeSunRays(
        rooms, windows, sun.azimuth, sun.elevation, north!,
        walls.length ? innerByRoom : undefined,
        walls.length ? wallDepthByOpening : undefined,
      );
      const physical = this._physicalBodiesR(space);
      // A two-point body has zero area at rest, but its extrusion along the
      // sun direction is a real shadow polygon. This is the exact-line
      // counterpart of Glow's visibility barrier and never affects floor area.
      const sunOccluders = [
        ...physical,
        ...zeroWalls.barriers.map((line) => [
          [line[0], line[1]], [line[2], line[3]],
        ]),
      ];
      if (sunOccluders.length) {
        rays = rays.map((ray) => {
          const shadows = directionalOccluders(sunOccluders, ray.dir, ray.len);
          const clipped = ray.polys.map((poly) => floorMinusBodies(poly, shadows));
          return {
            ...ray,
            paths: clipped.map(polyclipPathD).filter(Boolean),
            polys: clipped.flatMap(geometryOuterRings),
          };
        }).filter((ray) => ray.paths?.length || ray.polys.length);
      }
      // the rim is pure geometry off the same wedges — memoised on the same key
      this._sunRaysCache = { key, rays, rims: rays.map((r) => rayRimEdges(r)) };
    }
    const rays = this._sunRaysCache.rays;
    const rims = this._sunRaysCache.rims;
    if (!rays.length) return empty;
    const color = rayColor(dayPhase(sun.elevation).warmth);
    const stops = rayStops();
    const rimAlpha = rimPeakAlpha();
    const rimStopList = rimStops();
    // NO filter here, and none in <defs>. Owner 2026-08-04: «не надо размывать
    // их боковые грани» — the shaft keeps the crisp sides real light has, and
    // the only falloff is the gradient. The tip needs no blur either:
    // `rayStops()` is already at zero from RAY_FADE_END on, and the wedge's far
    // edge IS the gradient's last iso-alpha line, so it has nothing left to
    // draw. The polygons come out of `computeSunRays()` already intersected
    // with the room, so no clip-path is needed to keep the light off the far
    // side of a wall.
    //
    // DEV-EB173-01: the axis runs along the wall's INWARD NORMAL, from the
    // room-side opening face inward, and is `r.depth` = `len·cos` long — NOT
    // along the ray. For parallel rays, distance from the source span is an
    // affine function of the point, so its iso-alpha lines are parallel to the
    // wall; with this axis every point `source + dir·u` lands at offset
    // `u/len`. Whole inner opening at peak alpha, identical fade distance along every
    // ray, and the parallelogram's far edge exactly on the gradient's end.
    //
    // THE RIM (owner 2026-08-04, docs/SUN.md «The rim»): a 1 px black hairline
    // along the two SIDE edges only, so the shaft stays legible on white paper
    // where added luminance cannot read. It gets a gradient of its own —
    // `hp-sunrim-i` — deliberately built on the SAME x1/y1/x2/y2 and the same
    // `rayStops()` curve as `hp-sun-i`, only black and with its own peak: the
    // line must die on the very stop the fill dies on, never outlive it.
    // `non-scaling-stroke` keeps it one screen pixel at any zoom, and the
    // segments come out of the ALREADY clipped polygons, so a wall still stops
    // the light by geometry alone and no clip-path enters this layer.
    return svg`<defs>
        ${rays.map((r, i) => {
          const mx = (r.a[0] + r.b[0]) / 2;
          const my = (r.a[1] + r.b[1]) / 2;
          const ax = mx + r.normal[0] * r.depth;
          const ay = my + r.normal[1] * r.depth;
          return svg`<linearGradient id="hp-sun-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}" x2="${ax}" y2="${ay}">
            ${stops.map(([off, k]) => svg`<stop offset="${(off * 100).toFixed(1)}%"
              stop-color="${color}" stop-opacity="${(alpha * k).toFixed(4)}"></stop>`)}
          </linearGradient>
          <linearGradient id="hp-sunrim-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}" x2="${ax}" y2="${ay}">
            ${rimStopList.map(([off, k]) => svg`<stop offset="${(off * 100).toFixed(1)}%"
              stop-color="${RIM_COLOR}" stop-opacity="${(rimAlpha * k).toFixed(4)}"></stop>`)}
          </linearGradient>`;
        })}
      </defs>
      <g class="sunlayer hp-view-only-layer ${this._sunOut ? 'out' : ''}"
        opacity="${this._modeTransitionVisual?.viewWeight ?? 1}">
        ${rays.map((r, i) => r.paths?.length
          ? r.paths.map((d) => svg`<path d=${d} fill-rule="evenodd" fill="url(#hp-sun-${i})"></path>`)
          : r.polys.map((p) => svg`<polygon
              points="${p.map((q) => q[0] + ',' + q[1]).join(' ')}" fill="url(#hp-sun-${i})"></polygon>`))}
        ${rays.map((r, i) => (rims[i] || []).map((e) => svg`<line class="sunrim"
          x1="${e[0][0]}" y1="${e[0][1]}" x2="${e[1][0]}" y2="${e[1][1]}"
          stroke="url(#hp-sunrim-${i})" stroke-width="1"
          vector-effect="non-scaling-stroke"></line>`))}
      </g>` as unknown as TemplateResult;
  }

  /** Sun-ray layer keep-alive: `shown` = in the DOM, `out` = playing the
   *  2 s dissolve before it leaves (plain fields — the timer requests the
   *  update, render just reads them). */
  private _sunShown = false;
  private _sunOut = false;
  private _sunOutTimer = 0;

  /** Drop the layer at once: used by every gate that is NOT the 3° threshold. */
  private _sunFadeReset(): void {
    if (this._sunOutTimer) { clearTimeout(this._sunOutTimer); this._sunOutTimer = 0; }
    this._sunShown = false;
    this._sunOut = false;
  }

  /** One drag/click sample on the compass dial → dialog north_deg. */
  private _compassPoint(ev: PointerEvent): void {
    const el = ev.currentTarget as SVGSVGElement;
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 5) return; // the dead centre says nothing about angle
    let a = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
    if (ev.shiftKey) a = Math.round(a / 15) * 15; // coarse 15° steps with Shift
    a = ((a % 360) + 360) % 360;
    this._settingsDialog = { ...this._settingsDialog!, northDeg: a };
  }

  /** The compass dial: drag the «N» arrow around the ring (docs/SUN.md). */
  private _renderCompass(): TemplateResult {
    const d = this._settingsDialog!;
    const deg = d.northDeg;
    return html`<svg class="compass ${deg === null ? 'unset' : ''}" viewBox="-60 -60 120 120"
      @pointerdown=${(e: PointerEvent) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        this._compassDrag = true;
        this._compassPoint(e);
      }}
      @pointermove=${(e: PointerEvent) => { if (this._compassDrag) this._compassPoint(e); }}
      @pointerup=${() => (this._compassDrag = false)}
      @pointercancel=${() => (this._compassDrag = false)}>
      <circle class="cring" r="50"></circle>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(
        (t) => svg`<line class="ctick ${t % 90 ? 'minor' : ''}" x1="0" y1="-50" x2="0" y2="${t % 90 ? -46 : -43}"
          transform="rotate(${t})"></line>`,
      )}
      <g class="cneedle" transform="rotate(${deg ?? 0})">
        <line x1="0" y1="34" x2="0" y2="-28"></line>
        <path d="M -7 -24 L 0 -42 L 7 -24 Z"></path>
        <text x="0" y="-12" text-anchor="middle">${this._t('gs.north_letter')}</text>
      </g>
      <text class="cdeg" x="0" y="26" text-anchor="middle">${deg === null ? '—' : deg + '°'}</text>
    </svg>`;
  }

  /**
   * Effective stage background: per-space override → global setting → '' (the
   * theme default from the stylesheet). An open dialog previews its pending
   * value, so the color can be picked against the live plan. The four-phase
   * environment is a separate layer behind the plan (#146).
   */
  private _stageBg(disp: SpaceDisplay): string {
    const gd = this._settingsDialog;
    const sd = this._spaceDialog;
    const globalBg = gd ? gd.bgColor || '' : stageBgOf(this._settings, { bgColor: null });
    const spaceBg = sd && sd.mode === 'edit' && sd.spaceId === this._space
      ? sd.bgColor || ''
      : disp.bgColor || '';
    return spaceBg || globalBg;
  }

  /** Current computed stage background as #rrggbb — the color input's default. */
  private _stageBgHex(): string {
    const st = this._stageEl;
    if (st) {
      const m = getComputedStyle(st).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) return '#' + m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('');
    }
    return '#111111';
  }

  // ================= GENERAL SETTINGS =================

  private _openSettingsDialog = (): void => {
    if (!this._editorRuntime) {
      void this._ensureEditorRuntime().then((ready) => {
        if (ready) this._openSettingsDialog();
      });
      return;
    }
    return this._editorRuntime._openSettingsDialog();
  }

  private _openSupportDialog = (): void => {
    if (!this._editorRuntime) {
      void this._ensureEditorRuntime().then((ready) => {
        if (ready) this._openSupportDialog();
      });
      return;
    }
    this._editorRuntime._openSupportDialog();
  };

  /**
   * Preview whole-plan maintenance. Nothing is written here: the pure run
   * produces both the report and the exact config/layout pair to commit.
   */
  /**
   * #295: one diagnostics payload for the clipboard, the inline fallback and
   * the dev log. `origin: runtime` is the honest part of the contract — the
   * refusal depends on live card state and a saved export may not reproduce
   * it, so the payload carries what the export cannot.
   */
  private _preflightDiagnostics(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): object {
    return this._editorRuntimeOrThrow()._preflightDiagnostics(preflight, candidate);
  }

  /** #295: dev-log once per distinct failing preflight, not once per render. */
  private _reportedPreflightFingerprint: string | null = null;
  private _reportPreflightFailure(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): void {
    return this._editorRuntimeOrThrow()._reportPreflightFailure(preflight, candidate);
  }

  /**
   * #295: the «update House Plan» advice only helps when the frontend is
   * actually stale. houseplan/config/get now reports the integration
   * version; an old backend does not, and then the advice is simply not
   * shown — a missing hint is better than a misleading one (the rc.1
   * report where the owner had nothing newer to update to).
   */
  private _preflightVersionsDiffer(): boolean {
    return this._editorRuntimeOrThrow()._preflightVersionsDiffer();
  }

  private async _copyPreflightDiagnostics(): Promise<void> {
    return this._editorRuntimeOrThrow()._copyPreflightDiagnostics();
  }

  private _checkOptimizeGeometry(config: ServerConfig): OptimizeGeometryPreflightResult {
    return this._editorRuntimeOrThrow()._checkOptimizeGeometryImpl(config);
  }

  /** One strict production source shared by editor commits and stale rechecks. */
  private _checkSpacePhysicalGeometry(
    config: ServerConfig,
    spaceId: string,
    captureWallGeometry?: (
      geometry: ReturnType<typeof wallBodiesGeometry>,
    ) => void,
  ) {
    return this._editorRuntimeOrThrow()._checkSpacePhysicalGeometryImpl(config, spaceId, captureWallGeometry);
  }

  private _optimizeReferenceContext(
    removeLiveMissingPositions: boolean,
  ): SpaceReferenceRepairContext {
    return this._editorRuntimeOrThrow()._optimizeReferenceContext(removeLiveMissingPositions);
  }

  private _previewAlignDialog(removeLiveMissingPositions: boolean): void {
    return this._editorRuntimeOrThrow()._previewAlignDialog(removeLiveMissingPositions);
  }

  private _openAlignDialog = (): void => {
    return this._editorRuntimeOrThrow()._openAlignDialog();
  }

  private _toggleOptimizeLivePositions = (): void => {
    return this._editorRuntimeOrThrow()._toggleOptimizeLivePositions();
  }

  /**
   * The backend persists an intent before either store changes, then keeps a
   * one-deep snapshot that remains undoable until the next plan edit.
   */
  private async _runAlignToGrid(): Promise<void> {
    return this._editorRuntimeOrThrow()._runAlignToGrid();
  }

  /** Prevent a double click from sending two restores of the same snapshot. */
  private _optimizeUndoBusy = false;

  /** Restore the one-deep snapshot, provided no later plan edit exists. */
  private async _undoPlanOptimization(): Promise<void> {
    return this._editorRuntimeOrThrow()._undoPlanOptimization();
  }

  private _openBackupExport = (): void => {
    return this._editorRuntimeOrThrow()._openBackupExport();
  }

  private async _runBackupExport(): Promise<void> {
    return this._editorRuntimeOrThrow()._runBackupExport();
  }

  private async _pickBackupImport(ev: Event): Promise<void> {
    return this._editorRuntimeOrThrow()._pickBackupImport(ev);
  }

  private async _setBackupDuplicatePolicy(policy: 'skip' | 'virtual'): Promise<void> {
    return this._editorRuntimeOrThrow()._setBackupDuplicatePolicy(policy);
  }

  private async _applyBackupImport(): Promise<void> {
    return this._editorRuntimeOrThrow()._applyBackupImport();
  }

  private _renderBackupExportDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderBackupExportDialog();
  }

  private _renderBackupImportDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderBackupImportDialog();
  }

  private _setFillColor(key: keyof FillColors, patch: Partial<{ c: string; a: number }>): void {
    return this._editorRuntimeOrThrow()._setFillColor(key, patch);
  }

  private async _saveSettingsDialog(): Promise<void> {
    return this._editorRuntimeOrThrow()._saveSettingsDialog();
  }

  /** Boolean toggle for dialog rows: the native ha-switch when the HA
   *  frontend provides it, the classic checkbox otherwise (older HA, the
   *  smoke env). The ha-* API is undocumented and shifts between HA
   *  releases, so the presence check is the ONLY coupling: both branches
   *  fire `change` and both are read back via `.checked` off the event
   *  target - one handler, two renderers. */
  private _boolInput(checked: boolean, onChange: (v: boolean) => void, disabled = false): TemplateResult {
    return this._editorRuntimeOrThrow()._boolInput(checked, onChange, disabled);
  }

  /** Range slider for dialog rows: ha-slider when available, plain
   *  input[type=range] otherwise. Same fallback contract as _boolInput;
   *  ha-slider emits `input` while dragging and `change` on release
   *  (which of the two carries the final value differs between HA
   *  versions - listen to both, the handler is idempotent). */
  private _rangeInput(
    min: number, max: number, step: number, value: number,
    onInput: (v: number) => void, disabled = false, ariaLabel?: string,
  ): TemplateResult {
    return this._editorRuntimeOrThrow()._rangeInput(min, max, step, value, onInput, disabled, ariaLabel);
  }

  private _renderColorRow(key: keyof FillColors, labelKey: string): TemplateResult {
    return this._editorRuntimeOrThrow()._renderColorRow(key, labelKey);
  }

  /** Glow radius: stored in cm (config.settings.glow_radius_cm), default 3 m. */
  private get _glowRadiusCm(): number {
    const v = Number((this._settings as any).glow_radius_cm);
    return Number.isFinite(v) && v > 0 ? v : 300;
  }

  private get _imperial(): boolean {
    return this.hass?.config?.unit_system?.length === 'mi';
  }

  private get _glowRadiusPlaceholder(): string {
    const cm = this._glowRadiusCm;
    return this._imperial ? String(Math.round((cm / 30.48) * 10) / 10) : String(cm / 100);
  }

  /**
   * Keep a source node alive while CSS fades it out. A new `on` state cancels
   * the pending removal, so rapid toggles reverse the same transition instead
   * of destroying and recreating the SVG/filter stack.
   */
  private _glowTransition(
    key: string,
    active: boolean,
  ): { domId: number; entering: boolean; leaving: boolean } | null {
    return transitionGlowSource(
      this._glowRuntimeState, this._glowRuntimeHost, key, active,
    );
  }

  private _forgetGlowSource(key: string): void {
    forgetGlowSource(this._glowRuntimeState, this._glowRuntimeHost, key);
  }

  private _forgetGlowSpace(spaceId: string): void {
    forgetGlowSpace(this._glowRuntimeState, this._glowRuntimeHost, spaceId);
  }

  private _warnGlowGeometryFallback(
    spaceId: string, fingerprint: string, roomId: string, phase: string,
  ): void {
    warnGlowGeometryFallback(
      this._glowRuntimeState, spaceId, fingerprint, roomId, phase,
    );
  }

  /**
   * Everything in a space that stops light, and the floor light may land on.
   *
   * Opaque: the wall bodies exactly as the plan draws them — with their real
   * thickness — plus every independent body (partition, column, room draft),
   * plus the bare outline of any edge that carries no thickness at all.
   * Transparent: doorways and gates, cut out of the masonry so the
   * opening is a real gap between two jamb faces; and virtual (open)
   * boundaries, which are not walls to begin with. A window stays solid: an
   * indoor lamp must not wash the street, so the light's masonry is cut by
   * passages only and differs on purpose from the drawn one.
   *
   * The result depends on the plan plus the small signature of bound interior
   * door/gate states, so it is shared by every lamp and unrelated HA updates.
   */
  private _lightBarriers(
    space: SpaceModel, polys: { r: RoomCfg; poly: number[][] }[],
  ): {
    occluders: LightSegment[]; floor: number[][][]; fingerprint: string;
    masonryGeometry: any; opaqueBodies: number[][][];
  } {
    const raw = this._curSpaceCfg;
    const revision = resolveLightBarrierRevision({
      rawSpaceConfig: raw,
      space,
      openings: this._openingsR,
      cellCm: this._cellCm,
      gridPitch: this._gridPitch,
      openingAmount: (opening) => this._openingAmt(opening),
    });
    const cacheKey = `${space.id}|${revision.fingerprint}`;
    const pooled = lruRead(this._lightBarrierPool, cacheKey);
    if (pooled.hit) {
      this._lightBarrierCache = pooled.value;
      return pooled.value.value;
    }
    const value = buildLightBarrierScene({
      space,
      revision,
      walls: this._spaceWalls,
      zeroWalls: this._zeroWalls(),
      wallKeyPitch: this._wallKeyPitch,
      cellCm: this._cellCm,
      gridPitch: this._gridPitch,
      coordScale: NORM_W,
      sharedWallGeometry: this._wallUnionGeometry(),
      physicalBodies: (partitionCuts, lightPhysicalKey) => {
        if (this._lightPhysicalBodiesCache?.key !== lightPhysicalKey) {
          this._lightPhysicalBodiesCache = {
            key: lightPhysicalKey,
            all: physicalBodyParts(
              space, this._cellCm, this._gridPitch, this._gridPitch * 0.0002,
              partitionCuts,
            ).all,
          };
        }
        return this._lightPhysicalBodiesCache.all;
      },
    });
    const entry = { key: cacheKey, value };
    lruWrite(this._lightBarrierPool, cacheKey, entry, 8);
    this._lightBarrierCache = entry;
    return value;
  }

  /** Light pools of the current space: dark house, glowing sources. */
  private _renderGlowLayer(space: SpaceModel, disp: SpaceDisplay): TemplateResult {
    const colors = this._fillColors;
    const defaultR = (this._glowRadiusCm / this._cellCm) * this._gridPitch;
    const polys = space.rooms
      .map((r) => ({ r, poly: roomPoly(r) }))
      .filter((x): x is { r: RoomCfg; poly: number[][] } => !!x.poly);
    const enabled = polys.filter(({ r }) => roomGlowOf(disp.glow, r));
    if (!enabled.length) {
      this._forgetGlowSpace(space.id);
      return svg`` as unknown as TemplateResult;
    }
    const scene = this._lightBarriers(space, polys);
    const candidates = resolveGlowCandidates({
      hass: this._renderPlanHass,
      devices: this._renderDevices,
      virtualLights: this._virtualLights,
      spaceId: space.id,
      defaultColor: colors.glow_light.c,
      paletteAlpha: colors.glow_light.a,
      defaultRadiusUnits: defaultR,
      cellCm: this._cellCm,
      gridPitch: this._gridPitch,
      position: (device) => this._pos(device),
    });
    const spots: GlowSpot[] = [];
    const seenSourceKeys = new Set<string>();
    for (const candidate of candidates) {
      const { key, pos } = candidate;
      seenSourceKeys.add(key);
      // Invalid placement inside any opaque body must remain dark. The
      // masonry geometry already contains the exact passage cuts, so a valid
      // interior doorway remains transparent while a source embedded in the
      // surrounding wall cannot light one side of its tunnel. The visibility
      // sweep separately rejects a source that lies exactly on an opaque edge.
      // Exterior opening tunnels deliberately remain in `masonryGeometry`,
      // so placing the source there suppresses the entire pool rather than
      // lighting only the indoor half of the tunnel.
      if (glowSourceInOpaqueBody(pos, scene)) {
        // This placement cannot produce a valid previous-frame fade: the old
        // clip belongs to a different position. Remove its transition state as
        // well, rather than leaving a timer for a DOM node no longer rendered.
        this._forgetGlowSource(key);
        continue;
      }
      const transition = this._glowTransition(key, !!candidate.appearance);
      if (!transition) continue;
      if (candidate.appearance) this._glowLastAppearance.set(key, candidate.appearance);
      const appearance = this._glowLastAppearance.get(key);
      if (!appearance) continue;
      let geometry: GlowSpot['geometry'] = null;
      const clipKey =
        `${space.id}|${scene.fingerprint}|${pos.x.toFixed(4)},${pos.y.toFixed(4)}|${candidate.radius.toFixed(4)}`;
      const cachedClip = readGlowClip(this._glowRuntimeState, clipKey);
      if (cachedClip.hit) {
        geometry = cachedClip.value;
      } else {
        // The entire light model, in two lines: what can this lamp see, and
        // where is there floor to light. Doorways, gates and dashed zero walls are
        // simply missing from `occluders`, so light crosses them without any
        // notion of a "spill", a "sector", a "tunnel" or an "open zone" — and
        // a wall corner two rooms away casts its shadow for exactly the same
        // reason a column does.
        geometry = buildGlowClipGeometry({
          spaceId: space.id,
          source: pos,
          radius: candidate.radius,
          scene,
          polygons: polys.map(({ r, poly }) => ({ room: r, poly })),
          onBoundsFailure: (roomId, phase) => this._warnGlowGeometryFallback(
            space.id, scene.fingerprint, roomId, phase,
          ),
        });
        writeGlowClip(this._glowRuntimeState, clipKey, geometry);
      }
      spots.push({
        key,
        sourceEid: candidate.sourceEid,
        domId: transition.domId,
        entering: transition.entering,
        leaving: transition.leaving,
        pos,
        c: appearance.c,
        alpha: appearance.alpha,
        geometry,
        r: candidate.radius,
      });
    }
    pruneGlowSources(
      this._glowRuntimeState, this._glowRuntimeHost, space.id, seenSourceKeys,
    );
    if (!spots.length) return svg`` as unknown as TemplateResult;
    // Per-room Glow overrides are visual clips only. The transport calculation
    // above still crosses a disabled room, but no base/pool pixels are painted
    // there. For the common all-enabled case this extra clip is omitted.
    const walls = this._spaceWalls;
    const openCuts = enabled.length === polys.length ? [] : this._openCuts();
    const roomWalls = this._wallUnionGeometry()?.roomGeom;
    const enabledClip = enabled.length === polys.length ? null : enabled.map(({ r, poly }) => {
      const floorPoly = walls.length && r.id
        ? (this._innerRoomContour(space, r.id, openCuts, roomWalls) || poly)
        : poly;
      const clean = this._cleanFloor(r, floorPoly, space).path;
      const holes = islandsOf(
        floorPoly,
        polys.filter((other) => other.r !== r).map((other) => other.poly),
      );
      const path = (points: number[][]) =>
        'M ' + points.map((point) => point[0] + ' ' + point[1]).join(' L ') + ' Z';
      return [clean || path(floorPoly), ...holes.map(path)].join(' ');
    });
    // A hair on SCREEN, so an edge stays a hairline at any zoom instead of
    // turning into a smear when the plan is enlarged.
    const view = this._viewOr(this._baseVb());
    const perUnit = this._stageEl?.clientWidth && view.w
      ? this._stageEl.clientWidth / view.w
      : 1;
    // #396: the freeze must key on "the camera is moving", not on the two
    // gesture flags. An animated transition sets neither, so every tween frame
    // rebuilt the blur region — the very cost this gate was added to avoid.
    const cameraStill = !this._pinchStart && !this._panStart
      && !this._cameraTransition.active;
    const feather = resolveGlowFeather(
      this._glowRuntimeState, perUnit, cameraStill,
    );
    return renderGlowPools({
      spots,
      enabledClip,
      feather: feather.feather,
      featherEnabled: feather.enabled,
      screenBlend: this._glowScreenBlend,
    });
  }

  /**
   * The confirmation separates geometry movement from lossless maintenance,
   * and promises the one-deep undo before either store is changed.
   */
  private _renderAlignDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderAlignDialog();
  }

  private _renderSettingsDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderSettingsDialog();
  }

  private _renderSupportDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderSupportDialog();
  }

  // ================= ICON RULES EDITOR =================

  private _openRulesDialog = (): void => {
    return this._editorRuntimeOrThrow()._openRulesDialog();
  }

  private _rulesSet(rules: IconRule[]): void {
    return this._editorRuntimeOrThrow()._rulesSet(rules);
  }

  private async _saveRules(): Promise<void> {
    return this._editorRuntimeOrThrow()._saveRules();
  }

  private _renderRulesDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderRulesDialog();
  }

  private _saveKioskScale(patch: Partial<{ icon: number; font: number }>): void {
    this._kioskScale = { ...this._kioskScale, ...patch };
    try {
      localStorage.setItem(LS_KIOSK, JSON.stringify(this._kioskScale));
    } catch {
      /* ignore */
    }
    this.requestUpdate();
  }

  /** Per-SCREEN size settings (wall tablets differ) — stored locally. */
  private _renderKioskDialog(): TemplateResult {
    const k = this._kioskScale;
    const row = (key: 'icon' | 'font', label: string) => {
      const value = Math.round(k[key] * 100);
      const input = (event: Event) => {
        const next = Number((event.target as HTMLInputElement).value);
        if (Number.isFinite(next)) this._saveKioskScale({ [key]: next / 100 });
      };
      return html`<label>${label}</label>
        <div class="colorrow">
          <input type="range" min="50" max="300" step="5" .value=${String(value)}
            @input=${input} aria-label=${label} />
          <span class="opv">${value}%</span>
        </div>`;
    };
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('kiosk.title')} icon="mdi:tablet"
      dismiss-on-scrim @hp-close=${() => (this._kioskDialog = false)}>
        <div class="body">
          <div class="rhint">${this._t('kiosk.hint')}</div>
          ${row('icon', this._t('kiosk.icon_scale'))}
          ${row('font', this._t('kiosk.font_scale'))}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => this._saveKioskScale({ icon: 1, font: 1 })}>${this._t('gs.reset')}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => (this._kioskDialog = false)}>${this._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

  // ================= render =================

  private _fixedFloorValue(value: unknown): string {
    if (typeof value === 'string') return value || "''";
    try {
      const encoded = JSON.stringify(value);
      return (encoded === undefined ? String(value) : encoded).slice(0, 160);
    } catch {
      return String(value).slice(0, 160);
    }
  }

  /** The dangerous-action confirmation, rendered outside the body's branches.
   *
   *  #402: it used to sit at the end of `_renderBody`, i.e. inside the last
   *  branch of a chain of early returns — so in onboarding («no spaces yet»),
   *  in the fixed-floor states and without a space it did not exist at all.
   *  The controller was fine; the decision simply had no source, because the
   *  element that dispatches it was not in the DOM: the promise hung forever
   *  and the trash button next to a saved plan was dead. An open dialog also
   *  vanished when the card slipped into any of those branches.
   *
   *  Placing it beside the body rather than inside it fixes the class, not the
   *  instance: a branch added later cannot lose the confirmation again. */
  private _renderDangerConfirm(): TemplateResult | typeof nothing {
    if (!this._dangerConfirm) return nothing;
    return html`<hp-confirm .hass=${this.hass}
        .request=${this._dangerConfirm.request}
        .token=${this._dangerConfirm.token}
        @hp-confirm-decision=${this._onDangerConfirmDecision}>
      </hp-confirm>`;
  }

  /** One stable Lit template site lets a nested `noChange` retain the body
   * while the independent confirmation child is removed during a warm gate. */
  private _renderRoot(body: TemplateResult | typeof noChange): TemplateResult {
    return html`${body}${this._renderDangerConfirm()}`;
  }

  protected render(): TemplateResult | typeof nothing | typeof noChange {
    const body = this._renderBody();
    // `nothing` is the only root that has no decision surface. `noChange` is
    // deliberately nested: it preserves the committed body while allowing the
    // sibling hp-confirm to settle/cancel on a ready -> warm transition.
    if (body === nothing) return body;
    return this._renderRoot(body);
  }

  private _renderBody(): TemplateResult | typeof nothing | typeof noChange {
    if (!this._config || !this.hass) return nothing;
    const terminalFrame = this._terminalFrame;
    this._terminalFrame = 0;
    if (terminalFrame === 1) return noChange;
    const localeGate = this._syncDangerConfirmLocaleGate();
    if (localeGate === 'cold') return languageLoadingTemplate();
    if (localeGate === 'warm') return noChange;
    const onboardingRuntimeRequested = !!this._importDialog
      || !!(this._spaceDialog && this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode));
    const editorRuntimeRequested = this._mode !== 'view'
      || !!(this._roomDialog || this._mergeDialog || this._openingDialog
        || this._physicalDialog || this._partitionDeleteDialog || this._roomDeleteDialog
        || this._decorTextDialog || this._decorShapeDialog || this._backdropDialog
        || this._decorEraseConfirm
        || (this._spaceDialog && !this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode))
        || this._deviceInbox
        || this._markerDialog || this._rulesDialog || this._settingsDialog || this._supportDialog
        || this._alignDialog || this._backupExportDialog || this._backupImportDialog
        || this._kioskDialog || this._vacFit || this._vacCalConfirm);
    if (onboardingRuntimeRequested && !this._onboardingRuntime) {
      void this._ensureOnboardingRuntime();
    }
    if (editorRuntimeRequested && !this._editorRuntime) void this._ensureEditorRuntime();
    const model = this._model;
    const diagnostics = this._renderLife.diagnostics(
      this.hass, this._markers, (binding) => this._bindingStatus(binding),
    );
    const fixed = this._fixedFloorState(model);
    if (fixed.kind === 'pending') {
      return html`<ha-card data-fixed-floor-state="pending">
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title || this._t('card.title')}</div>
        </div>
        <div class="empty" role="status" aria-live="polite">
          <ha-icon icon="mdi:loading" class="big fixedfloor-loading"></ha-icon>
          <p>${this._t('fixed_floor.loading')}</p>
        </div>
      </ha-card>`;
    }
    if (fixed.kind === 'invalid') {
      return html`<ha-card
        data-fixed-floor-state="invalid"
        data-fixed-floor-reason=${fixed.reason}>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title || this._t('card.title')}</div>
        </div>
        <div class="empty fixedfloor-error" role="alert" aria-live="assertive">
          <ha-icon icon="mdi:alert-circle-outline" class="big"></ha-icon>
          <p><b>${this._t('fixed_floor.invalid_title')}</b></p>
          <p>${this._t('fixed_floor.invalid_body', { value: this._fixedFloorValue(fixed.value) })}</p>
        </div>
      </ha-card>`;
    }
    if (!model.length) {
      return html`<ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint || nothing}
        data-recovery-reason=${(this._continuity.overlayVisible || this._continuity.state === 'recovery-error')
          ? this._continuity.recoveryReason || nothing : nothing}
        data-ha-registry-access=${diagnostics.registry.access}
        data-ha-disabled-bindings=${diagnostics.bindings.ha_disabled}
        data-ha-unverified-bindings=${diagnostics.bindings.unverified}>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title || this._t('card.title')}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>${this._t('empty.no_spaces')}</p>
          ${this._serverStorage
            ? html`<p class="muted">${this._t('empty.add_first')}</p>
                <button class="btn on" @click=${() => this._openSpaceDialog('create')}>
                  <ha-icon icon="mdi:plus"></ha-icon>${this._t('btn.add_space')}
                </button>`
            : html`<p class="muted">${this._t('empty.install')}</p>`}
        </div>
        ${this._spaceDialog
          ? (this._onboardingRuntime || this._editorRuntime) ? this._renderSpaceDialog() : nothing
          : nothing}
        ${this._importDialog ? this._onboardingRuntime ? this._renderImportDialog() : nothing : nothing}
        ${this._toast ? html`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>` : nothing}
      </ha-card>`;
    }
    const space = this._spaceModel();
    if (!space) return nothing;
    const navigationSpaces = fixed.kind === 'valid' ? [space] : model;
    const vb = space.vb;
    const projection = this._effectiveProjection();
    this._renderProjection = projection;
    if (this._labs.active.length) noteLabsRender();
    const iso = projection === 'iso';
    // hidden devices render ONLY in the device editor with "show hidden" on
    // (ghosted); everywhere else the flag removes them from sight — but not
    // from the build, so room LQI still counts them (docs/FILTERING.md)
    const showGhosts = this._mode === 'devices' && this._showAll;
    const devs = this._renderDevices.filter((d) => d.space === space.id && (!d.hidden || showGhosts));
    const deviceSnapshot = this._renderDeviceSnapshot;
    const disp = this._spaceDisplayForRender();
    // Stage 2 capability work is deliberately absent from Flat/Labs-off
    // renders. Decorative capability never enters the structural cache key.
    const isoLayers = iso ? this._isoDecorationLayers(disp) : null;
    const isoPanels = isoLayers ? this._isoOpeningPanels(isoLayers) : [];
    const roomFills = this._resolvedRoomFills(space, disp);
    const glowBase = this._resolvedGlowBase(space, disp, roomFills);
    const showLqi = disp.showLqi ?? this._config.show_signal ?? true;
    const cfgSize = this._config.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;
    const deviceBasePct = effectiveDeviceBaseSize(iconPct);
    const view = this._viewOr(this._baseVb());
    const floorView = this._floorView(view);
    // Background around the plan (view/kiosk; editors keep their own canvas).
    // Both settings dialogs preview their pending value live.
    const stageBg = this._editing ? '' : this._stageBg(disp);
    // opening rulers: the drag of an existing one OR the placement preview
    const opMeasure = this._opMeasureView;
    const editorChromeMode = this._mode === 'view' ? this._editorChromeMode : this._mode;
    const roomHover = this._roomHoverPaths(space);
    const backdropHref = space.bg ? this._display(space.bg.href) : '';
    const recoveryReason = (this._continuity.overlayVisible || this._continuity.state === 'recovery-error')
      ? this._continuity.recoveryReason : null;
    const modeVisual = this._modeTransitionVisual;
    const dayCycle = this._dayCycleState();
    const dayCycleWeight = modeVisual?.viewWeight ?? (this._mode === 'view' ? 1 : 0);
    const transitionFromMode = this._modeTransition.state?.from.presentedMode;
    const glowLayerVisible = !this._markup || !!modeVisual && (
      modeVisual.presentedMode === 'view' || modeVisual.presentedMode === 'devices'
      || transitionFromMode === 'view' || transitionFromMode === 'devices'
    );
    const transitionStageBg = modeVisual?.stageColor || stageBg;
    const transitionBrightness = modeVisual?.sceneBrightness ?? 1;

    return html`
      <ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint || nothing}
        data-device-snapshot-sequence=${deviceSnapshot?.sourceSequence ?? nothing}
        data-recovery-reason=${recoveryReason || nothing}
        data-ha-registry-access=${diagnostics.registry.access}
        data-ha-disabled-bindings=${diagnostics.bindings.ha_disabled}
        data-ha-unverified-bindings=${diagnostics.bindings.unverified}
        @pointerover=${(event: PointerEvent) => this._notePointer(event)}
        @pointerdown=${this._touchGestureGuard}
        @pointermove=${this._touchGestureGuard}
        @pointerup=${this._touchGestureGuard}
        @pointercancel=${this._touchGestureGuard}
        @lostpointercapture=${this._touchGestureGuard}
        @click=${this._touchGestureGuard}>
        <div class="hdr ${this._kiosk ? 'kioskhide' : ''}">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title || this._t('card.title')}
          </div>
          <div class="tabs" @pointermove=${(e: PointerEvent) => this._tabPointerMove(e)}>
            ${navigationSpaces.map(
              (s) => html`<button
                data-hp="space-tab" data-id="${s.id}"
                class="tab ${this._space === s.id ? 'active' : ''}${
                  this._tabDrag?.moved && this._tabDrag.id === s.id ? ' dragging' : ''}${
                  this._tabDrag?.moved && this._tabDrag.targetId === s.id
                    ? ` drop-${this._tabDrag.placement}` : ''}"
                ?data-reorderable=${this._canReorderTabs}
                @pointerdown=${(e: PointerEvent) => this._tabPointerDown(e, s.id)}
                @pointerup=${(e: PointerEvent) => this._tabPointerUp(e)}
                @pointercancel=${() => this._endTabDrag()}
                @click=${() => this._tabClick(s.id)}
              >
                ${s.title}${this._norm && this._canEdit
                  ? html`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t('title.configure_space')}
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        this._openSpaceDialog('edit', s.id);
                      }}></ha-icon>`
                  : nothing}
              </button>`,
            )}
            ${''/* «Добавить пространство» is a NAVIGATION action, not a plan-editor
                   tool (owner 2026-08-04): it lives next to the floor names in every
                   mode, exactly where the per-space gear does. Kiosk is a shop
                   window — the whole .hdr is display:none there, but the button is
                   also not RENDERED, so nothing invisible is clickable. */}
            ${this._canEdit && !this._kiosk && !this._hasFixedFloor
              ? html`<button class="tab tabadd" title=${this._t('title.add_space')}
                  @click=${() => this._openSpaceDialog('create')}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`
              : nothing}
          </div>
          ${this._canEdit
            ? html`<div class="modes">
                ${([['plan', 'mdi:floor-plan'], ['devices', 'mdi:tune-variant'], ['decor', 'mdi:draw']] as const).map(
                  ([m, ic]) => html`<button class="modetab ${this._mode === m ? 'active' : ''}"
                    data-editor-navigation=${m}
                    title=${this._t(('mode.' + m + '_tip') as any)}
                    @click=${() => this._setMode(m)}>
                    <ha-icon icon=${ic}></ha-icon><span class="ml">${this._t(('mode.' + m) as any)}</span>
                    ${this._mode === m
                      ? html`<ha-icon class="closex" icon="mdi:close" title=${this._t('title.close_editor')}
                          data-editor-navigation="view"
                          @click=${(e: Event) => { e.stopPropagation(); this._setMode('view'); }}></ha-icon>`
                      : nothing}
                  </button>`,
                )}
              </div>`
            : nothing}
          <span class="count">${this._t('count.devices', { n: devs.filter((d) => !d.hidden).length })}</span>
          <span class="spacer"></span>
          ${this._labsIso && this._mode === 'view' && !this._kiosk
            ? html`<button class="btn projection-toggle ${iso ? 'on' : ''}"
                data-hp="projection-toggle" aria-pressed=${iso ? 'true' : 'false'}
                aria-label=${this._t('view.volumetric')}
                title=${this._t(iso ? 'view.flat' : 'view.volumetric')}
                @click=${() => this._setProjection(iso ? 'flat' : 'iso')}>
                <ha-icon icon=${iso ? 'mdi:view-grid-outline' : 'mdi:cube-outline'}></ha-icon>
              </button>`
            : nothing}
          <div class="zoomctl">
            <button class="btn zb" @click=${() => this._stepZoom(-1)} title=${this._t('title.zoom_out')}><ha-icon icon="mdi:minus"></ha-icon></button>
            ${''/* docs/CANVAS.md §8: this IS «вписать всё» — the old "reset
                   zoom" renamed rather than duplicated. No longer disabled at
                   zoom 1: at zoom 1 panned off to the side it still has work. */}
            <button class="btn zb" @click=${() => this._fitAll()}
              title=${this._t('title.zoom_fit')}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${() => this._stepZoom(1)} title=${this._t('title.zoom_in')}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm && this._canEdit
            ? html`<button class="btn header-action" @click=${this._openSettingsDialog} title=${this._t('title.general_settings')}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>
              <button class="btn header-action support-button" @click=${this._openSupportDialog}
                title=${this._t('support.title')} aria-label=${this._t('support.title')}>
                <ha-icon icon="mdi:help-circle-outline"></ha-icon>
              </button>`
            : nothing}
        </div>
        ${this._canEdit && !this._kiosk
          ? html`<div class="editorchrome ${this._editing || this._modeTransitionBusy ? 'open' : ''}${this._modeTransitionBusy ? ' transitioning' : ''}"
              style=${modeVisual ? `height:${modeVisual.editorChromeHeight}px;opacity:${modeVisual.editorWeight}` : nothing}
              aria-hidden=${this._editing ? 'false' : 'true'}
              ?inert=${!this._editing}>
              <div class="editorchrome-inner"
                style=${modeVisual ? `opacity:${modeVisual.toolbarContentOpacity}` : nothing}>
                ${this._editorRuntime
                  ? editorChromeMode === 'plan'
                    ? this._renderMarkupBar()
                    : editorChromeMode === 'devices'
                      ? this._renderDevicesBar()
                      : this._renderDecorBar()
                  : nothing}
              </div>
            </div>`
          : nothing}
        </div>

        <div class="stage ${this._markup ? 'markup tool-' + this._tool + (this._tool === 'split' && !this._splitSel ? ' pickstage' : '') + (this._tool === 'wallthick' && this._wallThickHover ? ' wallhot' : '') : ''} ${this._mode === 'decor' ? 'dtool-' + this._decorTool : ''} ${space.bg ? '' : 'noplan'} mode-${this._mode}${this._bdMovable ? ' bdgrab' : ''}${this._bdDrag ? ' bdgrabbing' : ''}${dayCycle ? ` daycycle phase-${dayCycle.phase}` : ''}${this._booting ? ' hpboot' : ''}${this._bootSoft ? ' hpsettle' : ''}${this._modeTransitionBusy ? ' mode-transition' : ''}"
          ?inert=${this._modeTransitionBusy}
          style="height:${modeVisual ? `${modeVisual.stageHeight}px` : this._kiosk ? '100dvh' : `calc(100dvh - ${this._hdrH}px)`}${transitionStageBg ? `;background:${transitionStageBg}` : ''};--hp-cell-visual-scale:${gridVisualScale(this._cellCm)};--wall-fill:${this._fillColors.wall_fill.c};--wall-fill-op:${this._fillColors.wall_fill.a};--hp-mode-architecture-opacity:${modeVisual ? modeVisual.architectureOpacity : this._mode === 'decor' ? 0.35 : 1};--hp-mode-view-weight:${modeVisual?.viewWeight ?? (this._mode === 'view' ? 1 : 0)};--hp-mode-editor-weight:${modeVisual?.editorWeight ?? (this._mode === 'view' ? 0 : 1)}${modeVisual ? `;--hp-mode-paper:${modeVisual.paperColor}` : ''}${dayCycle ? `;${dayCycleStageVars(dayCycle)}` : ''}"
          @click=${(e: MouseEvent) => this._markupClick(e)}
          @wheel=${(e: WheelEvent) => this._onWheel(e)}
          @pointerdown=${(e: PointerEvent) => { this._notePointer(e); this._stagePointerDown(e); }}
          @pointermove=${(e: PointerEvent) => this._stagePointerMove(e)}
          @pointerleave=${(e: PointerEvent) => this._stagePointerLeave(e)}
          @pointerup=${(e: PointerEvent) => this._stagePointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._stagePointerCancel(e)}>
          ${renderDayCycleEnvironment(dayCycle, dayCycleWeight)}
          ${this._editorRuntime ? this._renderEditorSecondary() : nothing}
          <div class="zoomwrap ${this._slide ? 'slide-' + this._slide : ''}"
            ?inert=${this._continuity.overlayBlocksInteraction || this._modeTransitionBusy}
            style="${transitionBrightness !== 1 ? `filter:brightness(${transitionBrightness.toFixed(3)})` : ''}">
          ${iso && isoLayers?.structural ? svg`<svg class="iso-underlay-svg" data-hp-live-viewbox="camera"
              viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoUnderlay(isoLayers)}
            </svg>` : nothing}
          <svg class=${isoLayers?.structural ? 'plan-svg' : nothing}
            data-hp-live-viewbox=${isoLayers?.structural ? 'camera' : 'floor'}
            viewBox=${isoLayers?.structural
              ? `${view.x} ${view.y} ${view.w} ${view.h}`
              : `${floorView.x} ${floorView.y} ${floorView.w} ${floorView.h}`}
            preserveAspectRatio=${isoLayers?.structural || !iso ? 'xMidYMid meet' : 'none'}>
            <g class=${isoLayers?.structural ? 'iso-floor-scene' : nothing}
              transform=${isoLayers?.structural ? isoFloorMatrixCss() : nothing}>
            ${''/* THE PAPER IS THE ROOMS (docs/BACKDROP.md §3, owner
                   2026-08-04). Opaque shapes stop the scene background —
                   bg_color or the day-cycle environment — from bleeding through the
                   plan. They follow the ROOM CONTOURS and nothing else: one
                   shape per room in exactly the room's own geometry, so an
                   L-shaped house or a pair of detached buildings never grows a
                   white bounding rectangle, and an empty space has no paper at
                   all. A backdrop image no longer makes paper of its own — it
                   is drawn ON this sheet, one layer below the geometry, so a
                   picture with transparency and no rooms under it shows the
                   scene through, which is the deliberate consequence.
                   `space` comes from _renderCfg, so a live resize preview
                   controller preview moves the paper together with the rooms.
                   One <g> around ALL paper shapes: the external day-cycle outline
                   (styles.ts) is composited once for the whole sheet, so
                   adjacent rooms never cast seams onto each other's paper. */}
            ${this._wallHatchDefs(disp.color)}${svg`<g class="hp-paperg">${this._paperShapes(space.rooms).map((sh) =>
              'path' in sh
                ? svg`<path class="hp-paper" d="${sh.path}" fill-rule="evenodd" pointer-events="none"></path>`
              : 'poly' in sh
                ? svg`<polygon class="hp-paper" points="${sh.poly}" pointer-events="none"></polygon>`
                : svg`<rect class="hp-paper" x="${sh.rect.x}" y="${sh.rect.y}" width="${sh.rect.w}" height="${sh.rect.h}" rx="${sh.rect.rx}" pointer-events="none"></rect>`,
              )}</g>`}
            ${this._editing ? this._renderMarkupDefs(vb) : nothing}
            ${''/* the grid is a property of the plane, not of a box: it follows
                   the VIEW so it is there wherever you pan (docs/CANVAS.md §7) */}
            ${this._editing && !this._markup && this._gridLevels()
              ? svg`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`
              : nothing}
            ${space.bg && backdropHref
              ? svg`<image class="hp-backdrop" href="${backdropHref}" x="${space.bg.x}" y="${space.bg.y}" width="${space.bg.w}" height="${space.bg.h}"
                  opacity="${modeVisual?.backdropOpacity ?? (this._mode === 'decor' && this._decorTool !== 'backdrop' ? 0.5 : 1)}"
                  @load=${() => this._onBackdropLoaded(space.bg!.href, backdropHref)}
                  transform=${space.bg.angle
                    ? `rotate(${space.bg.angle} ${space.bg.x + space.bg.w / 2} ${space.bg.y + space.bg.h / 2})`
                    : nothing}
                  @dblclick=${(e: Event) => this._openBackdropDialog(e)}
                  preserveAspectRatio="none" />`
              : nothing}
            ${(() => {
              // audit L1: hoisted out of the per-room map — these depend on the
              // config, not on entity state, and were recomputed per room.
              const allZeroCuts = this._openCuts();
              const allThickCuts = this._thickWallCuts();
              const roomWallGeometry = this._wallUnionGeometry()?.roomGeom;
              const polyCache = new Map<any, number[][] | null>();
              const polyOf = (rr: any) => {
                if (!polyCache.has(rr)) polyCache.set(rr, roomPoly(rr));
                return polyCache.get(rr)!;
              };
              const otherPolys = (rr: any) =>
                space.rooms.filter((o) => o !== rr).map(polyOf).filter(Boolean) as number[][][];
              return space.rooms.filter((r) => r.area || this._mode === 'view' || this._markup || disp.showBorders).map((r) => {
              let cls = 'room ' + (space.bg ? 'overlay' : 'yard') + (this._markup ? ' outlined' : '');
              if (this._markup && (r.id === this._mergeSel || r.id === this._splitSel?.roomId))
                cls += ' picked';
              let style = '';
              const effFill = roomFillModeOf(disp.fill, r);
              if (!this._markup && (disp.showBorders || effFill !== 'none')) {
                cls += ' styled';
                const st: string[] = [];
                // keep the stroke colour even when borders are hidden, so hover can reveal it
                st.push(`--room-stroke:${disp.color}`, `--room-stroke-op:${disp.showBorders ? disp.opacity : 0}`);
                // One frame-local resolver drives both this room and every
                // thick-wall opening tunnel that continues its floor colour.
                const fillC = roomFills.byRoom.get(r) || null;
                if (fillC) {
                  cls += ' filled';
                  st.push(`--room-fill:${fillC.color}`, `--room-fill-op:${fillC.opacity}`);
                } else st.push('--room-fill:transparent', '--room-fill-op:0');
                style = st.join(';');
              }
              let areaText: string | null | undefined;
              const tip = (e: PointerEvent) => {
                if (!this._roomTipEnabledForPointer(e)) return;
                if (areaText === undefined) areaText = this._roomArea(r);
                this._showTip(
                  e,
                  r.name || this._t('room.unnamed'),
                  areaText ? this._t('tip.area', { value: areaText }) : '',
                  showLqi ? this._roomLqi(r.area) : null,
                  this._roomTemp(r),
                  this._roomHum(r),
                  true,
                );
              };
              const enterRoom = (event: PointerEvent) => {
                this._notePointer(event);
                if (this._pointerModality.hoverEnabled) {
                  this._hoverRoom = { space: space.id, room: r };
                  this._syncLiveHover();
                }
              };
              const myPoly = polyOf(r);
              // A room's ordinary solid stroke must not run beneath its zero
              // wall overlay — suppress it and draw a trimmed outline. This
              // includes exterior zero atoms, not only shared room boundaries.
              // Applies in the Plan editor too (picked rooms keep their full
              // amber highlight — the merge/split selection must stay visible).
              const isPicked = this._markup && (r.id === this._mergeSel || r.id === this._splitSel?.roomId);
              const zeroCuts = myPoly && !isPicked
                ? allZeroCuts.filter((cut) => {
                    const midpoint = [(cut[0] + cut[2]) / 2, (cut[1] + cut[3]) / 2];
                    return myPoly.some((point, index) => distToSegment(
                      midpoint,
                      [point[0], point[1], ...myPoly[(index + 1) % myPoly.length]],
                    ) <= this._gridPitch * 0.08);
                  })
                : [];
              const thickCuts = !isPicked ? allThickCuts : [];
              const edgeCuts = zeroCuts.concat(thickCuts);
              if (edgeCuts.length) cls += ' noedge';
              // island rooms punch holes in their parent's fill (evenodd)
              const walls = this._spaceWalls;
              const fillPoly = (walls.length && r.id && myPoly)
                ? (this._innerRoomContour(space, r.id, allZeroCuts, roomWallGeometry) || myPoly)
                : myPoly;
              const holes = fillPoly ? islandsOf(fillPoly, otherPolys(r)) : [];
              const pathD = (pts: number[][]) =>
                'M ' + pts.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z';
              const obstaclePath = fillPoly ? this._cleanFloor(r, fillPoly, space).path : '';
              // docs/STYLING-HOOKS.md §3 — the same three hooks whichever SVG
              // element this room happens to be drawn as today
              const hpId = r.id || nothing;
              const hpArea = r.area || nothing;
              const shape = obstaclePath && fillPoly
                ? svg`<path class="${cls}" style="${style}" fill-rule="evenodd"
                    data-hp="room" data-id=${hpId} data-area=${hpArea}
                    d="${[obstaclePath, ...holes.map(pathD)].join(' ')}"
                    @pointerenter=${enterRoom}
                    @pointermove=${tip}
                    @pointerleave=${() => this._clearTransientHover()}></path>`
                : holes.length && fillPoly
                ? svg`<path class="${cls}" style="${style}" fill-rule="evenodd"
                    data-hp="room" data-id=${hpId} data-area=${hpArea}
                    d="${[fillPoly, ...holes].map(pathD).join(' ')}"
                    @pointerenter=${enterRoom}
                    @pointermove=${tip}
                    @pointerleave=${() => this._clearTransientHover()}></path>`
                 : fillPoly && fillPoly !== myPoly
                 ? svg`<polygon class="${cls}" style="${style}" points="${fillPoly.map((p) => p.join(',')).join(' ')}"
                     data-hp="room" data-id=${hpId} data-area=${hpArea}
                    @pointerenter=${enterRoom}
                    @pointermove=${tip}
                    @pointerleave=${() => this._clearTransientHover()}></polygon>`
                 : r.poly
                 ? svg`<polygon class="${cls}" style="${style}" points="${r.poly.map((p) => p.join(',')).join(' ')}"
                     data-hp="room" data-id=${hpId} data-area=${hpArea}
                    @pointerenter=${enterRoom}
                    @pointermove=${tip}
                    @pointerleave=${() => this._clearTransientHover()}></polygon>`
                 : svg`<rect class="${cls}" style="${style}"
                     data-hp="room" data-id=${hpId} data-area=${hpArea}
                     x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w!, r.h!) * 0.03}"
                    @pointerenter=${enterRoom}
                    @pointermove=${tip}
                    @pointerleave=${() => this._clearTransientHover()}></rect>`;
              const trimmed = edgeCuts.length && myPoly
                ? outlineWithout(myPoly, edgeCuts, this._gridPitch * 0.02)
                : null;
              const outline = trimmed
                ? svg`<path class="room-outline ${this._markup ? 'outlined' : ''}"
                    d="${trimmed.map((sg) => `M ${sg[0]} ${sg[1]} L ${sg[2]} ${sg[3]}`).join(' ')}"
                    style=${this._markup ? nothing : `stroke:${disp.color};stroke-opacity:${disp.showBorders ? disp.opacity : 0}`}></path>`
                : nothing;
              return svg`${shape}${outline}`;
              });
            })()}
            ${this._renderRoomHoverFill(roomHover)}
            ${this._renderOpeningTunnelFills(space, roomFills)}
            ${this._renderGlowBaseRooms(space, glowBase)}
            ${this._renderOpeningTunnelFills(space, glowBase, 'glow-base')}
            ${''/* Decor is one composition layer above every floor treatment
                   (room fill/hover, opening tunnels and Glow base) and below
                   live lighting, physical plan geometry and devices. Keep
                   hide_decor visual-only: the decor editor must always paint
                   stored shapes so they remain editable. */}
            ${disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer()}
            ${glowLayerVisible ? this._renderGlowLayer(space, disp) : nothing}
            ${this._renderSunRays(space)}
            ${this._editing ? svg`<g class="hp-editor-only-layer"
              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderAlignGuides()}</g>` : nothing}
            ${this._markup ? svg`<g class="hp-editor-only-layer"
              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderMarkupLayer(vb)}</g>` : nothing}
            ${''/* «Скрыть проёмы» (space.hide_openings) — same deal: the plan
                   editor keeps drawing doors, windows and gates so they stay
                   editable, and only the symbols are hidden elsewhere. What
                   an opening MEANS is untouched: light still spills through
                   it, the sun still comes in at its window, and the contact
                   sensor still opens it. */}
            ${''/* View: zero-thickness geometry still meets thick walls on their
                   centreline, but paints BELOW the physical wall body. The
                   hatch therefore masks the visually awkward half-dashes
                   inside thick jambs without changing the stored span. */}
            ${!this._editing ? this._renderZeroWalls(disp) : nothing}
            ${this._renderWallBodies(disp)}
            ${this._markup && this._tool === 'resize' ? this._renderResizeMeasurements() : nothing}
            ${this._renderRoomHoverOutline(roomHover)}
            ${''/* Editors: saved zero-thickness walls deliberately paint AFTER
                   thick wall bodies. Their
                   full centreline geometry remains visible for editing. */}
            ${this._editing ? this._renderZeroWalls(disp) : nothing}
            ${this._markup ? svg`<g class="hp-editor-only-layer"
              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderHiddenWallDiagnosticOverlay()}</g>` : nothing}
            ${this._markup ? svg`<g class="hp-editor-only-layer"
              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderOpeningPlacementPreview()}</g>` : nothing}
            ${opMeasure ? this._renderOpeningDimensionGuides(opMeasure) : nothing}
            ${opMeasure?.guide ? this._renderOpeningCenterTick(opMeasure.guide) : nothing}
            ${''/* Static architectural axes and endpoints are a Plan-editor
                   invariant. Tool-specific hover/snap state is resolved inside
                   the overlay and remains exclusive to Walls. */}
            ${''/* Active chain ink paints above the wall bodies: persisted
                   draft segments already own opaque masonry, which would
                   otherwise cover the chain axis and nodes (#307). It stays
                   below the snap overlay so snap highlights keep priority. */}
            ${this._markup ? svg`<g class="hp-editor-only-layer"
              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderActiveChainInk()}</g>` : nothing}
            ${this._markup ? svg`<g class="hp-editor-only-layer hp-plan-snap-layer"
              opacity="${modeVisual?.editorWeight ?? 1}">${this._renderPlanSnapOverlay()}</g>` : nothing}
            ${disp.hideOpenings && !this._markup
              ? nothing
              : isoLayers && !isoLayers.floorSymbols
                ? nothing
                : this._renderOpenings(disp)}
            ${this._renderWallThickUi()}
            ${this._markup && this._tool === 'resize' ? this._renderResizeLayer(view) : nothing}
            ${''/* editor chrome, not plan content: the backdrop frame sits on
                   top of everything the plan draws so its handles stay
                   grabbable (docs/BACKDROP.md §2). It exists only in the
                   backdrop editor, where rooms and devices are pointer-inert. */}
            ${this._renderBackdropFrame(view)}
            ${this._renderTextFrame(view)}
            <g data-hp-live-editor></g>
            </g>
          </svg>
          ${iso && isoLayers?.structural ? svg`<svg class="iso-shadows-svg" data-hp-live-viewbox="camera"
              viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoShadows(isoLayers, isoPanels)}
            </svg>
            <svg class="iso-walls-svg" data-hp-live-viewbox="camera" viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
              preserveAspectRatio="xMidYMid meet" aria-hidden="true" pointer-events="none">
              ${this._renderIsoWalls(isoLayers, isoPanels)}
            </svg>` : nothing}${renderZigbeeTopologyOverlay({ hass: this.hass, settings: this._settings, devices: this._renderDevices, registry: this._haRegistry, currentSpace: space.id, spaces: this._serverCfg?.spaces, viewKey: view, view: this._mode === 'view', kiosk: this._kiosk })}
          ${''/* docs/CANVAS.md §6: an icon is a percentage of the PLAN and
                 scales with it when you zoom — the behaviour the card always
                 had, restored by the owner. `iconCqw` is `iconPct * iconUnit
                 / view.w`: the old expression with the stored `vb.w` replaced
                 by the plan's own base unit, which is the same NORM_W for an
                 ordinary plan (pixel-identical) but grows with a plan drawn
                 past the old square, where a fixed 1000 would have shrunk
                 every marker to a dot. Same expression as the static
                 space-card, so the two renderers agree. The compatibility
                 base is resolved before `iconCqw`; only the per-device and
                 kiosk multipliers still feed --dev-size. */}
          <div class="devlayer" data-hp-live-layer="camera" style="--icon-size:${iconCqw(iconPct, space, view.w, this._kiosk ? this._kioskScale.icon : 1).toFixed(3)}cqw;--device-base-size:${iconCqw(deviceBasePct, space, view.w, this._kiosk ? this._kioskScale.icon : 1).toFixed(3)}cqw;--rl-icon-size:${iconCqw(iconPct, space, this._roomLabelReferenceViewWidth(view), this._kiosk ? this._kioskScale.icon : 1).toFixed(3)}cqw;--rl-font:${this._kiosk ? this._kioskScale.font : 1}">
            ${devs.map((d) => this._renderDevice(d, view, showLqi))}
            ${this._renderVacuums(this._renderVacuumDevices, view, space.id)}
            ${this._renderVacFit(view)}
            ${this._renderOpeningLocks(view)}
            ${disp.showNames || this._markup
              ? space.rooms.map((r) => this._renderRoomLabel(r, space, view, disp))
              : nothing}
            ${this._markup ? space.rooms.map((r) => this._renderRoomGear(r, space, view)) : nothing}
          </div>
          <div data-hp-live-editor-html></div>
          ${this._wallDialog
            ? html`<div class="measurelayer" data-hp-live-layer="camera">${this._renderWallThickDialog()}</div>`
            : nothing}
          </div>
          <div class="zoombadge" data-hp-live-zoom hidden><span data-hp-live-zoom-value></span></div>
          ${this._renderFarHint()}
          ${this._renderHomeArrow()}
          ${this._renderEditorRuntimeLoading()}
          ${this._renderRecoveryOverlay()}
          ${this._booting || this._bootFading
            ? html`<div class="bootveil ${this._booting ? '' : 'off'}" aria-hidden="true">
                <svg class="boothouse" viewBox="0 0 24 24"><path d="${mdiHomeCityOutline}"></path></svg>
              </div>`
            : nothing}
        </div>

        ${this._roomDialog ? this._editorRuntime ? this._renderRoomDialog() : nothing : nothing}
        ${this._mergeDialog ? this._editorRuntime ? this._renderMergeDialog() : nothing : nothing}
        ${this._openingDialog ? this._editorRuntime ? this._renderOpeningDialog() : nothing : nothing}
        ${this._physicalDialog ? this._editorRuntime ? this._renderPhysicalDialog() : nothing : nothing}
        ${this._partitionDeleteDialog ? this._editorRuntime ? this._renderPartitionDeleteDialog() : nothing : nothing}
        ${this._roomDeleteDialog ? this._editorRuntime ? this._renderRoomDeleteDialog() : nothing : nothing}
        ${this._openingInfo ? this._renderOpeningInfoCard() : nothing}
        ${this._decorTextDialog ? this._editorRuntime ? this._renderDecorTextDialog() : nothing : nothing}
        ${this._decorShapeDialog ? this._editorRuntime ? this._renderDecorShapeDialog() : nothing : nothing}
        ${this._backdropDialog ? this._editorRuntime ? this._renderBackdropDialog() : nothing : nothing}
        ${this._decorEraseConfirm ? this._editorRuntime ? this._renderDecorEraseConfirm() : nothing : nothing}
        ${this._spaceDialog
          ? (this._onboardingRuntime || this._editorRuntime) ? this._renderSpaceDialog() : nothing
          : nothing}
        ${this._deviceInbox ? this._editorRuntime ? this._renderDeviceInbox() : nothing : nothing}
        ${this._markerDialog ? this._editorRuntime ? this._renderMarkerDialog() : nothing : nothing}
        ${this._backdropGuard
          ? (this._editorRuntime
            ? this._editorRuntime._renderBackdropGuard()
            : this._onboardingRuntime?._renderBackdropGuard() ?? nothing)
          : nothing}
        ${this._vacCalConfirm ? this._editorRuntime ? html`<hp-dialog .hass=${this.hass}
          .title=${this._t('vac.residual_title')} icon="mdi:map-marker-alert-outline"
          dismiss-on-scrim aria-busy=${String(!!this._vacCalConfirm.busy)}
          @hp-close=${() => { if (!this._vacCalConfirm?.busy) this._vacCalConfirm = null; }}>
            <div class="body">
              <p>${this._t('vac.residual_message', { error: this._vacCalConfirm.error })}</p>
            </div>
            <div class="row" slot="footer">
              <button class="btn ghost" ?disabled=${this._vacCalConfirm.busy}
                @click=${() => (this._vacCalConfirm = null)}>${this._t('btn.cancel')}</button>
              <span class="spacer"></span>
              <button class="btn ghost" ?disabled=${this._vacCalConfirm.busy}
                @click=${() => this._vacApplyCalibrationProposal(true)}>${this._t('vac.fit')}</button>
              <button class="btn on" ?disabled=${this._vacCalConfirm.busy}
                @click=${() => this._vacApplyCalibrationProposal(false)}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t('vac.apply_proposal')}
              </button>
            </div>
        </hp-dialog>` : nothing : nothing}
        ${this._infoCard ? this._renderInfoCard() : nothing}
        ${this._rulesDialog ? this._editorRuntime ? this._renderRulesDialog() : nothing : nothing}
        ${this._settingsDialog ? this._editorRuntime ? this._renderSettingsDialog() : nothing : nothing}
        ${this._supportDialog ? this._editorRuntime ? this._renderSupportDialog() : nothing : nothing}
        ${this._alignDialog ? this._editorRuntime ? this._renderAlignDialog() : nothing : nothing}
        ${this._backupExportDialog ? this._editorRuntime ? this._renderBackupExportDialog() : nothing : nothing}
        ${this._backupImportDialog ? this._editorRuntime ? this._renderBackupImportDialog() : nothing : nothing}
        ${this._importDialog ? this._onboardingRuntime ? this._renderImportDialog() : nothing : nothing}
        <div class="tip" data-hp-live-tip hidden></div>
        ${this._kiosk && !this._hasFixedFloor && this._kioskDots && this._model.length > 1
          ? html`<div class="kioskdots">
              ${this._model.map((m) => html`<span class="kdot ${m.id === this._space ? 'on' : ''}"></span>`)}
            </div>`
          : nothing}
        ${this._kioskDialog ? this._renderKioskDialog() : nothing}
        ${this._vacFit ? html`<div class="vaccalbar" aria-busy=${String(!!this._vacFit.busy)}>
          <span>${this._t('vac.fit_hint')}</span>
          <button class="btn ghostbtn" ?disabled=${this._vacFit.busy}
            @click=${() => this._vacFitTurn({ rot: ((this._vacFit!.p.rot + 90) % 360) as FitParams['rot'] })}>${this._t('vac.fit_rotate')}</button>
          <button class="btn ghostbtn" ?disabled=${this._vacFit.busy}
            @click=${() => this._vacFitTurn({ mir: !this._vacFit!.p.mir })}>${this._t('vac.fit_mirror')}</button>
          <button class="btn" ?disabled=${this._vacFit.busy}
            @click=${() => this._vacFitSave()}>${this._t('btn.save')}</button>
          <button class="btn ghostbtn" ?disabled=${this._vacFit.busy}
            @click=${() => { this._vacFit = null; }}>${this._t('btn.cancel')}</button>
        </div>` : nothing}
        ${this._tapConfirm
          ? html`<hp-dialog .hass=${this.hass}
              .title=${this._tapConfirm.kind === 'toggle' ? this._tapConfirm.text : this._t('btn.run')}
              icon="mdi:alert-outline"
              dismiss-on-scrim @hp-close=${() => (this._tapConfirm = null)}>
                <div class="body ${this._tapConfirm.kind === 'toggle' ? 'tapconfirm-body' : ''}">
                  ${this._tapConfirm.kind === 'run'
                    ? html`<p>${this._tapConfirm.text}</p>`
                    : this._tapConfirm.lines.map((line, index) => html`
                        <p class="tapconfirm-line" data-line=${index}>${line}</p>`)}
                </div>
                <div class="row" slot="footer">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${() => (this._tapConfirm = null)}>${this._t('btn.cancel')}</button>
                  <button class="btn on" @click=${() => { const c = this._tapConfirm!; this._tapConfirm = null; c.exec(); }}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.run')}
                  </button>
                </div>
            </hp-dialog>`
          : nothing}
        ${this._toast ? html`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>` : nothing}
      </ha-card>
    `;
  }


  // ---------------- live robot vacuums (docs/VACUUM.md) ----------------

  private _vacCandidateStatus(
    entityId: string, candidate: VacSourceCandidate | null, planHass = this._planHass,
  ): VacSourceStatus {
    const binding = this._bindingStatus('entity:' + entityId);
    if (binding.kind === 'ha_disabled') return 'disabled';
    if (binding.kind === 'orphaned') return 'missing';
    if (binding.kind === 'unverified') return 'unverified';
    const state = planHass?.states?.[entityId];
    if (state?.state === 'unavailable') return 'unavailable';
    return candidate?.hasPosition ? 'ok' : 'unsupported';
  }

  /** Snapshot the expensive global camera classification once per opening. */
  private _vacOpenAllCameras(d: DevItem): void {
    const registry = this._haRegistry.entities || {};
    const candidates: VacSourceCandidate[] = [];
    for (const [entityId, state] of Object.entries<any>(this.hass?.states || {})) {
      if (!entityId.startsWith('camera.')) continue;
      const candidate = parseVacSourceCandidate(entityId, state, registry[entityId]);
      if (candidate) candidates.push(candidate);
    }
    this._vacAllCameraCache = { devId: d.id, candidates };
    this._vacAllCamerasFor = d.id;
  }

  /** One sticky, order-independent source resolver for render/dialog/fit. */
  private _vacSourceResolution(
    d: DevItem, includeAllCameras = false, planHass = this._planHass,
  ): VacSourceResolution {
    const vacuum = d.marker?.vacuum;
    const pinned = typeof vacuum?.source === 'string' && !!vacuum.source;
    const sameDevice = new Set(d.entities || []);
    const ids = new Set<string>(sameDevice);
    if (pinned) ids.add(vacuum!.source!);
    const registry = planHass?.entities || {};
    const candidates: VacSourceCandidate[] = [];
    for (const entityId of ids) {
      const state = planHass?.states?.[entityId];
      const candidate = parseVacSourceCandidate(entityId, state, registry[entityId]);
      if (candidate) candidates.push(candidate);
      else if (pinned && entityId === vacuum!.source) {
        candidates.push({
          entityId,
          name: String(state?.attributes?.friendly_name || entityId),
          platform: registry[entityId]?.platform ? String(registry[entityId].platform) : null,
          category: entityId.startsWith('camera.') ? 'camera' : 'partial',
          hasPosition: false, hasRooms: false, hasPath: false, hasMapId: false, score: 0,
        });
      }
    }
    if (includeAllCameras && this._vacAllCameraCache?.devId === d.id) {
      const existing = new Set(candidates.map((candidate) => candidate.entityId));
      for (const candidate of this._vacAllCameraCache.candidates) {
        if (!existing.has(candidate.entityId)) candidates.push(candidate);
      }
    }
    const statuses: Record<string, VacSourceStatus> = {};
    for (const candidate of candidates) {
      statuses[candidate.entityId] = this._vacCandidateStatus(candidate.entityId, candidate, planHass);
    }
    return resolveVacSource(vacuum?.source, sameDevice, candidates, statuses);
  }

  /** The sticky/automatic live-position source entity, or null. */
  private _vacSource(d: DevItem, planHass = this._planHass): string | null {
    if (d.marker?.vacuum?.live === false) return null;
    const resolution = this._vacSourceResolution(d, false, planHass);
    // A disabled/unavailable/unverified source must never leak stale HA
    // attributes into plan overlays. `unsupported` remains usable because it
    // may still provide rooms/path for calibration and trail rendering.
    return resolution.status === 'ok' || resolution.status === 'unsupported'
      ? resolution.entityId : null;
  }

  private _vacEntity(d: DevItem): string | null {
    if (d.primary?.startsWith('vacuum.')) return d.primary;
    return (d.entities || []).find((e) => e.startsWith('vacuum.')) || null;
  }

  private _isVacDev(d: DevItem): boolean {
    return !!this._vacEntity(d);
  }

  /** Start/restart a short semantic event or direct-terminal transition. */
  private _activitySourceKey(d: DevItem): string {
    return this._activitySnapshot(d).sourceKey;
  }

  private _activitySnapshot(
    d: DevItem,
    planLightSources = resolvedLightSources(
      this._planHass, this._devices, null, this._virtualLights,
    ),
  ): { samples: EntityVisualSample[]; sourceKey: string } {
    const sources = resolvePresentationSources(
      this._planHass, d, this._devices, planLightSources, this._fullRegistryHass,
    );
    return {
      samples: sources.samples,
      sourceKey: activitySourceSignature(this._planHass, d, sources),
    };
  }

  private _stampActivity(id: string, kind: 'event' | 'transition', sources?: string): void {
    let rt = this._activityRt.get(id);
    if (!rt) {
      rt = createFiniteActivityRuntime(sources || '', []);
      this._activityRt.set(id, rt);
    }
    if (sources != null) rt.sources = sources;
    stampFiniteActivity(
      rt, kind, Date.now(), window.clearTimeout.bind(window),
      (delay) => window.setTimeout(() => this.requestUpdate(), delay),
    );
  }

  /**
   * Bring activity runtime in sync with the marker/source graph without
   * classifying an edge. Called after every device rebuild as well as before a
   * hass tick: new sources get a baseline, rebound sources lose the old flash,
   * and removed markers cannot leave timers behind.
   */
  private _syncActivityRuntime(): Map<string, { samples: EntityVisualSample[]; sourceKey: string }> {
    const snapshots = new Map<string, { samples: EntityVisualSample[]; sourceKey: string }>();
    if (!this.hass) return snapshots;
    if (this._config?.live_states === false) {
      for (const runtime of this._activityRt.values()) clearTimeout(runtime.timer);
      this._activityRt.clear();
      return snapshots;
    }
    const live = new Set<string>();
    const planLightSources = resolvedLightSources(
      this._planHass, this._devices, null, this._virtualLights,
    );
    for (const d of this._devices) {
      if (d.hidden) continue;
      // Alarm/continuous semantics are resolved from the current samples and
      // need no finite history. Keep that history only while its display mode
      // can actually show it, so a later mode change cannot replay old edges.
      if (normalizeDeviceDisplay(d.marker?.display) !== 'icon_ripple') continue;
      live.add(d.id);
      const snapshot = this._activitySnapshot(d, planLightSources);
      snapshots.set(d.id, snapshot);
      const { samples, sourceKey } = snapshot;
      let rt = this._activityRt.get(d.id);
      if (!rt) {
        rt = createFiniteActivityRuntime(sourceKey, samples);
        this._activityRt.set(d.id, rt);
        continue;
      }
      if (rt.sources === sourceKey) continue;
      // A brief unknown/unavailable state can change the effective role graph.
      // Resetting here prevents recovery from becoming a false fresh event.
      resetFiniteActivityRuntime(rt, sourceKey, samples, window.clearTimeout.bind(window));
    }
    for (const [id, rt] of this._activityRt) {
      if (live.has(id)) continue;
      clearTimeout(rt.timer);
      this._activityRt.delete(id);
    }
    return snapshots;
  }

  /**
   * One pass per hass tick records every effective source. Only a witnessed,
   * meaningful edge starts a short effect: first load and recovery from
   * unknown/unavailable establish a baseline and never fake a detection.
   */
  private _activityTick(): void {
    if (!this.hass) return;
    const snapshots = this._syncActivityRuntime();
    for (const d of this._devices) {
      if (d.hidden) continue;
      if (normalizeDeviceDisplay(d.marker?.display) !== 'icon_ripple') continue;
      const snapshot = snapshots.get(d.id) || this._activitySnapshot(d);
      const { samples, sourceKey } = snapshot;
      const rt = this._activityRt.get(d.id);
      if (!rt || rt.sources !== sourceKey) continue;
      const edge = advanceFiniteActivity(rt, samples, window.clearTimeout.bind(window));
      // A direct closed↔open fallback is only a substitute for integrations
      // that omit opening/closing. Once a real travelling state is observed,
      // it owns the ring and the old 3.3 s fallback is discarded.
      if (edge) this._stampActivity(d.id, edge, sourceKey);
    }
  }

  /**
   * Trail buffers live OUTSIDE render: every hass tick appends the raw robot
   * position, so the trail survives view switches and zoom without ever being
   * part of reactive state (600 points re-rendering the world would hurt).
   */
  private _vacTick(): void {
    if (!this.hass) return;
    for (const d of this._devices) {
      if (d.hidden || !this._isVacDev(d)) continue;
      if (normalizeDeviceDisplay(d.marker?.display) === 'static_icon') {
        this._vacRt.delete(d.id);
        continue;
      }
      const src = this._vacSource(d);
      if (!src) continue;
      const vacEnt = this._vacEntity(d);
      const moving = isVacMoving(this.hass.states[vacEnt || '']?.state);
      const tele = readVacTelemetry(this.hass.states[src]?.attributes);
      let rt = this._vacRt.get(d.id);
      if (!rt) {
        rt = { trail: [], lastKey: '', lastTs: 0, moving: false, jump: false, endedTs: 0, lastPos: null };
        this._vacRt.set(d.id, rt);
      }
      if (moving && !rt.moving) { rt.trail = []; rt.lastPos = null; } // a fresh run
      const wantTrail = vacTrailMode(d.marker?.vacuum) !== 'never' && !tele?.path.length;
      if (!moving && rt.moving) {
        rt.endedTs = Date.now();
        // the run is over: the puck has arrived everywhere it was going
        if (wantTrail && rt.lastPos) rt.trail = pushTrailPoint(rt.trail, rt.lastPos, 40);
        rt.lastPos = null;
      }
      rt.moving = moving;
      const pos = tele?.pos;
      if (moving && pos) {
        const key = pos.x + ':' + pos.y;
        if (key !== rt.lastKey) {
          const now = Date.now();
          // a long silence then a far point = sparse cloud data: teleport, no glide
          rt.jump = rt.lastTs > 0 && now - rt.lastTs > VAC_TELEPORT_GAP_MS;
          rt.lastKey = key;
          rt.lastTs = now;
          // the trail lags ONE point behind: when a new target arrives the puck
          // has just (visually) reached the previous one — a segment must never
          // outrun the icon (owner report 2026-07-31)
          if (wantTrail && rt.lastPos) rt.trail = pushTrailPoint(rt.trail, rt.lastPos, 40);
          rt.lastPos = [pos.x, pos.y];
        }
      }
    }
  }



  /**
   * HP-1540-01: an auto-discovered vacuum has NO config marker until the first
   * general Save of its dialog, yet the «Живая позиция» section is already
   * interactive. Every vacuum handler used to `cfg.markers.find(...)` and
   * silently no-op without one — auto-calibration even toasted success while
   * saving nothing. Materialise a minimal marker (same id/binding the dialog
   * Save would produce — see _saveMarker/markerIdForBinding) before any
   * vacuum write, so the write has somewhere real to land.
   */
  private _vacEnsureMarker(d: DevItem): Marker | null {
    const cfg = this._serverCfg;
    if (!cfg) return null;
    cfg.markers = cfg.markers || [];
    const existing = cfg.markers.find((x: Marker) => x.id === d.id);
    if (existing) return existing;
    if ((d.bindingKind !== 'device' && d.bindingKind !== 'entity') || !d.bindingRef) return null;
    const m: Marker = {
      id: d.id,
      binding: d.bindingKind + ':' + d.bindingRef,
      space: d.space || null,
      area: d.area || null,
      // explicit like _saveMarker: a marker of any kind tells the seeder
      // "the user decided" (docs/FILTERING.md)
      hidden: d.hidden ? true : false,
    };
    cfg.markers.push(m);
    return m;
  }

  /** «Живая позиция» in the device dialog — vacuum markers only. */
  private _renderVacSection(dlg: any): TemplateResult | typeof nothing {
    return this._editorRuntimeOrThrow()._renderVacSection(dlg);
  }

  /**
   * The active-map id. The camera rarely names its map; Dreame keeps the
   * human-readable one on the vacuum entity (selected_map, verified against a
   * live X50 Master) — without this both floors would share one matrix.
   */
  /**
   * #358: map-id resolution belongs to the eager View card — it runs inside
   * willUpdate for every vacuum with telemetry, and the #337 stub killed the
   * whole Lit update cycle on a cold tab. Same move as #357: the card owns
   * the implementation, the editor runtime delegates back.
   */
  public _vacMapId(d: DevItem, tele: { mapId: string }, planHass = this._planHass): string {
    // HP-1541-01: nullish, not truthy — selected_map: 0 is a real map id and
    // must equal what trails.py resolve_map_id stores server-side.
    const ve = this._vacEntity(d);
    const sel = ve ? planHass?.states?.[ve]?.attributes?.selected_map : null;
    return vacMapIdWithFallback(tele.mapId, sel);
  }

  /** The map id an exact source reports right now, or undefined if silent. */
  public _vacObservedMapId(d: DevItem, source: string, planHass = this._planHass): string | undefined {
    const tele = readVacTelemetry(planHass?.states?.[source]?.attributes);
    return tele ? this._vacMapId(d, tele, planHass) : undefined;
  }

  /** Persist a solved matrix into marker.vacuum.calibration[mapId].
   *  Returns whether the write actually landed — callers must not toast
   *  success otherwise (HP-1540-01). */
  private _vacSaveMatrix(
    markerId: string, source: string, mapId: string, matrix: Affine, routeId = '',
  ): Promise<boolean> {
    return this._editorRuntimeOrThrow()._vacSaveMatrix(markerId, source, mapId, matrix, routeId);
  }

  /** The exact plan-room set accepted by auto-calibration and diagnostics. */
  private _vacPlanRoomAnchors(spaceId: string | null | undefined): Array<{
    name: string; cx: number; cy: number;
  }> {
    return this._editorRuntimeOrThrow()._vacPlanRoomAnchors(spaceId);
  }

  /** «Настроить автоматически»: robot rooms ↔ plan rooms by name. */
  private _vacAutoCalibrate(d: DevItem): Promise<void> {
    return this._editorRuntimeOrThrow()._vacAutoCalibrate(d);
  }

  private _vacApplyCalibrationProposal(manual: boolean): Promise<void> {
    return this._editorRuntimeOrThrow()._vacApplyCalibrationProposal(manual);
  }

  /** «Подогнать вручную»: open the fit overlay and leave the dialog. */
  private _vacStartFit(d: DevItem): void {
    return this._editorRuntimeOrThrow()._vacStartFit(d);
  }

  private _vacFitSave(): Promise<void> {
    return this._editorRuntimeOrThrow()._vacFitSave();
  }

  /** Rotate/mirror around the ghost centre so the map does not fly away. */
  private _vacFitTurn(patch: Partial<FitParams>): void {
    return this._editorRuntimeOrThrow()._vacFitTurn(patch);
  }

  private _vacGhostCentre(rooms: VacRoom[]): VacPt {
    return this._editorRuntimeOrThrow()._vacGhostCentre(rooms);
  }

  /** px→canvas-units for a pointer delta, via the current stage size. */
  private _vacDelta(view: { w: number; h: number }, dxPx: number, dyPx: number): VacPt {
    return this._editorRuntimeOrThrow()._vacDelta(view, dxPx, dyPx);
  }

  private _vacFitPointer(ev: PointerEvent, view: { x: number; y: number; w: number; h: number }): void {
    return this._editorRuntimeOrThrow()._vacFitPointer(ev, view);
  }

  /** The translucent robot map over the plan while fitting. */
  private _renderVacFit(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    if (!this._editorRuntime) return nothing;
    return this._editorRuntimeOrThrow()._renderVacFit(view);
  }

  /** Every frame: glue the growing tip segment to the animated puck centre. */
  private _vacRafLoop(): void {
    this._vacRaf = requestAnimationFrame(() => {
      const sr = this.renderRoot as ShadowRoot;
      const stage = this._stageEl;
      const view = this._vacLastView;
      const pucks = sr?.querySelectorAll?.('.vacpuck') || [];
      if (!stage || !view || !pucks.length) { this._vacRaf = 0; return; }
      const sb = stage.getBoundingClientRect();
      for (const puck of pucks as any) {
        const mid = puck.getAttribute('data-mid');
        const pb = puck.getBoundingClientRect();
        const cx = view.x + ((pb.left + pb.width / 2 - sb.left) / sb.width) * view.w;
        const cy = view.y + ((pb.top + pb.height / 2 - sb.top) / sb.height) * view.h;
        for (const line of sr.querySelectorAll(`line.tip[data-mid="${mid}"]`)) {
          line.setAttribute('x2', cx.toFixed(1));
          line.setAttribute('y2', cy.toFixed(1));
        }
      }
      this._vacRafLoop();
    });
  }

  /** One bounded current/previous trail serializer for flat and Iso surfaces. */
  private _vacTrailPathD(path: VacPath, matrix: Affine): string {
    const calibrated = path.map((segment) => segment.map(([x, y]) => applyAffine(matrix, x, y)));
    const commands = smoothVacPath(calibrated, this._cmToUnits(VAC_TRAIL_SMOOTH_RADIUS_CM));
    const pointText = (point: readonly [number, number]): string => {
      const scene = this._scenePoint(point);
      return `${scene[0].toFixed(1)} ${scene[1].toFixed(1)}`;
    };
    return commands.map((segment) => segment.map((command) => {
      if (command.kind === 'move') return `M ${pointText(command.point)}`;
      if (command.kind === 'line') return `L ${pointText(command.point)}`;
      return `Q ${pointText(command.control)} ${pointText(command.point)}`;
    }).join(' ')).join(' ');
  }

  /** Puck + trail for every live vacuum of the space. */
  /**
   * Live overlays for every robot whose ACTIVE map routes into this space.
   *
   * The device list is deliberately not the space-filtered one: the dock keeps
   * living in `marker.space`, but the puck and the trails belong to the space
   * of the active route, which is the whole point of #162.
   */
  private _renderVacuums(devs: readonly DevItem[], view: { x: number; y: number; w: number; h: number }, spaceId: string): TemplateResult | typeof nothing {
    if (this._markup || this._mode === 'decor') return nothing;
    const viewKey = this._space + '|' + view.x + '|' + view.y + '|' + view.w + '|' + view.h;
    const jumpAll = this._vacJumpOnce || viewKey !== this._vacViewKey;
    this._vacViewKey = viewKey;
    this._vacJumpOnce = false;
    const pucks: TemplateResult[] = [];
    const trails: TemplateResult[] = [];
    for (const d of devs) {
      if (d.hidden || !this._isVacDev(d)) continue;
      if (normalizeDeviceDisplay(d.marker?.display) === 'static_icon') continue;
      const fact = this._renderDeviceSnapshot?.facts.get(`vacuum:${d.id}`) as any;
      const src = fact?.source ?? this._vacSource(d, this._renderPlanHass);
      if (!src) continue;
      const tele = fact?.telemetry ?? readVacTelemetry(this._renderPlanHass?.states[src]?.attributes);
      if (!tele) continue;
      const routes: VacuumMapRoute[] = fact?.routes
        ?? effectiveRoutes(d.id, d.marker?.vacuum ?? null, d.space, src);
      const resolution: VacuumRouteResolution = fact?.resolution ?? resolveRoute({
        routes,
        observed: observedMapIds(routes, [src], (source) => this._vacObservedMapId(d, source)),
        spaceIds: new Set(this._model.map((space) => space.id)),
      });
      const srv0 = fact?.server ?? this._vacSrvTrails[d.id];
      const plan = planVacuumOverlay({
        resolution, routes, renderSpace: spaceId,
        rootSource: d.marker?.vacuum?.source ?? null,
        serverCurrent: srv0?.current ?? null,
        serverPrevious: srv0?.previous ?? null,
        explicitRoutes: Array.isArray(d.marker?.vacuum?.map_routes),
      });
      if (!plan.live && !plan.previous) continue;
      const matrix = plan.live;
      const rt = fact?.runtime ?? this._vacRt.get(d.id);
      const moving = rt?.moving ?? false;
      const tmode = vacTrailMode(d.marker?.vacuum);
      // owner 2026-07-31: hide when the cleanup is over (default), unless the
      // mode says always; the previous run only ever shows in 'always'
      const showCur = tmode === 'always' || (tmode === 'cleaning' && moving);
      const srv = srv0;
      const srvCur = plan.currentRunMatches && Array.isArray(srv?.current?.points) ? srv.current : null;
      const srvPrev = plan.previous && Array.isArray(srv?.previous?.points) ? srv.previous : null;
      // the PREVIOUS run stays visible even at rest: users compare where the
      // robot has been against where it has not (owner call 2026-07-31)
      if (tmode === 'always' && srvPrev && plan.previous) {
        const previous = normalizeVacPath(srvPrev.points);
        const pathD = this._vacTrailPathD(previous, plan.previous);
        if (pathD) {
          trails.push(svg`<g class="prev"><path class="case" d="${pathD}"></path><path class="core" d="${pathD}"></path></g>`);
        }
      }
      // One arbitration authority: integration multi-subpath → server run →
      // local runtime. Only drawable segments participate.
      if (showCur && matrix) {
        const current = resolveCurrentVacPath(tele, srvCur, rt?.trail || []);
        // Server/integration paths include the current target. Remove it from
        // the final subpath only while moving so the line cannot outrun puck.
        const raw: VacPath = moving && (current.source === 'integration' || current.source === 'server')
          ? trimVacPathTarget(current.path) : current.path;
        if (raw.length) {
          const pathD = this._vacTrailPathD(raw, matrix);
          // A single SVG path with several M commands keeps gaps literal.
          if (pathD) trails.push(svg`<path class="case" d="${pathD}"></path><path class="core" d="${pathD}"></path>`);
          const last = raw[raw.length - 1];
          if (moving && last?.length >= 2) {
            const anchor = last[last.length - 1];
            const [ax, ay] = applyAffine(matrix, anchor[0], anchor[1]);
            const point = this._scenePoint([ax, ay]);
            const a1 = point[0].toFixed(1), a2 = point[1].toFixed(1);
            trails.push(svg`<line class="case tip" data-mid="${d.id}" x1="${a1}" y1="${a2}" x2="${a1}" y2="${a2}"></line><line class="core tip" data-mid="${d.id}" x1="${a1}" y1="${a2}" x2="${a1}" y2="${a2}"></line>`);
          }
        }
      }
      if (!moving || !tele.pos || !matrix) continue;
      const [cx, cy] = applyAffine(matrix, tele.pos.x, tele.pos.y);
      const point = this._scenePoint([cx, cy]);
      const left = ((point[0] - view.x) / view.w) * 100;
      const top = ((point[1] - view.y) / view.h) * 100;
      const stale = rt && rt.lastTs > 0 && Date.now() - rt.lastTs > VAC_STALE_MS;
      const icon = d.marker?.icon || d.icon || 'mdi:robot-vacuum';
      pucks.push(html`<div
        data-mid="${d.id}"
        class="vacpuck ${deviceThemeClass(this._renderPlanHass)} ${rt?.jump || jumpAll ? 'jump' : ''} ${stale ? 'stale' : ''}"
        style="left:${left}%;top:${top}%"
        title=${d.name}
        @click=${(e: Event) => { e.stopPropagation(); const ve = this._vacEntity(d); if (ve) this._openMoreInfo(ve); }}>
        <ha-icon .icon=${icon}></ha-icon>
      </div>`);
    }
    this._vacLastView = view;
    if (pucks.length && !this._vacRaf) this._vacRafLoop();
    if (!pucks.length && !trails.length) return nothing;
    return html`
      ${trails.length ? svg`<svg class="vactrail" data-hp-live-viewbox="camera" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="none">${trails}</svg>` : nothing}
      ${pucks}`;
  }

  private _renderDevice(d: DevItem, view: { x: number; y: number; w: number; h: number }, showLqi = true): TemplateResult {
    const pos = this._pos(d);
    const point = this._scenePoint([pos.x, pos.y]);
    const left = ((point[0] - view.x) / view.w) * 100;
    const top = ((point[1] - view.y) / view.h) * 100;
    const presentation = this._devicePresentation(d, showLqi);
    const st = [`left:${left}%`, `top:${top}%`, ...deviceFaceStyle(presentation)];
    const disabledReason = presentation.disabledReason;
    const ghostLabel = presentation.haDisabled
      ? this._t((`marker.ha_disabled_${disabledReason}`) as any)
      : d.userHidden ? this._t('marker.hidden_ghost') : d.name;
    const a11yState = deviceA11yState(presentation);
    const interactive = this._mode === 'view' || this._mode === 'devices';
    const deviceAriaLabel = [
      ghostLabel,
      !presentation.haDisabled
        ? this._t((`marker.state_a11y_${a11yState}`) as I18nKey) : '',
      presentation.pulse.kind !== 'none'
        ? this._t((`marker.pulse_a11y_${presentation.pulse.reason}`) as I18nKey) : '',
      presentation.valueFullText || presentation.valueText || '',
      valueBadgeTitle(presentation.valueBadge),
      presentation.lqiText != null && presentation.lqiBand
        ? this._t((`marker.lqi_a11y_${presentation.lqiBand}`) as I18nKey, {
            value: presentation.lqiText,
          }) : '',
    ].filter(Boolean).join(', ');
    const metrics = [
      d.model,
      presentation.valueBadge?.fullText || '',
      presentation.lqiText != null ? 'LQI ' + presentation.lqiText : '',
    ].filter(Boolean).join(' · ');

    return html`<div
      ${''/* docs/STYLING-HOOKS.md §3: the styling contract. `nothing` on an
             attribute binding REMOVES the attribute, so a virtual marker has
             no data-entity at all rather than "undefined". */}
      data-hp="device"
      data-id="${d.id}"
      data-entity=${d.primary || nothing}
      data-area=${d.area || nothing}
      data-binding-status=${presentation.haDisabled ? 'ha-disabled' : d.bindingStatus?.kind || 'active'}
      data-disabled-reason=${disabledReason ? disabledReason.replace('_', '-') : nothing}
      data-state=${a11yState}
      data-lqi-band=${presentation.lqiText != null ? presentation.lqiBand || nothing : nothing}
      role=${interactive ? 'button' : nothing}
      tabindex=${interactive ? '0' : nothing}
      aria-label=${deviceAriaLabel}
      class="dev ${deviceThemeClass(this._renderPlanHass)} ${presentation.classes.join(' ')} ${this._selId === d.id ? 'sel' : ''} ${d.virtual ? 'virtual' : ''} ${d.hidden ? 'ghost' : ''} ${presentation.haDisabled ? 'ha-disabled' : ''} ${presentation.valueText != null ? 'valonly' : ''}"
      style="${st.join(';')}"
      @click=${(e: MouseEvent) => this._clickDevice(e, d)}
      @keydown=${(e: KeyboardEvent) => this._keyDevice(e, d)}
      @contextmenu=${(e: MouseEvent) => this._ctxDevice(e, d)}
      @pointerover=${(e: PointerEvent) => {
        if (this._mode !== 'view' && this._mode !== 'devices') return;
        this._showTip(e, d.name, presentation.haDisabled ? ghostLabel : metrics);
      }}
      @pointerleave=${() => this._clearTransientHover()}
      @pointerdown=${(e: PointerEvent) => this._pointerDown(e, d)}
      @pointermove=${(e: PointerEvent) => {
        if (this._mode !== 'view' && this._mode !== 'devices') return;
        this._pointerMove(e, d);
        this._showTip(e, d.name, presentation.haDisabled ? ghostLabel : metrics);
      }}
      @pointerup=${(e: PointerEvent) => this._pointerUp(e, d)}
      @pointercancel=${(e: PointerEvent) => this._pointerCancel(e, d)}
      @lostpointercapture=${(e: PointerEvent) => this._pointerCancel(e, d)}
    >
      ${renderDeviceFace(presentation, {
        surface: 'interactive-plan',
        newDevice: this._newIds.has(d.id),
        newDeviceTitle: this._t('device.new'),
        disabledTitle: presentation.haDisabled ? ghostLabel : '',
      })}
      ${this._vacRouteBadge(d)}
    </div>`;
  }

  /**
   * The dock says out loud that the moving robot is drawn nowhere (#162).
   *
   * Silence would be the worse failure: a plan with no robot on it reads as
   * "the robot is not cleaning", and the user has no way to learn that a map
   * simply has no floor assigned.
   */
  private _vacRouteBadge(d: DevItem): TemplateResult | typeof nothing {
    if (!this._isVacDev(d) || d.hidden) return nothing;
    if (normalizeDeviceDisplay(d.marker?.display) === 'static_icon') return nothing;
    const fact = this._renderDeviceSnapshot?.facts.get(`vacuum:${d.id}`) as
      { resolution?: VacuumRouteResolution } | undefined;
    const reason = routeWarningKey(fact?.resolution, this._vacRt.get(d.id)?.moving ?? false);
    if (!reason) return nothing;
    const text = this._t(`vac.route_warn_${reason}` as I18nKey);
    return html`<span class="vacwarn" role="img" aria-label=${text} title=${text}>
      <ha-icon icon="mdi:alert-outline"></ha-icon></span>`;
  }

  /** Clean-floor area shown in the room tooltip (same rule as resize labels). */
  private _roomArea(r: RoomCfg): string | null {
    const poly = roomPoly(r);
    if (!poly) return null;
    const space = this._spaceModel();
    if (!space) return null;
    const walls = this._spaceWalls;
    const floor = walls.length && r.id
      ? (this._innerRoomContour(space, r.id) || poly)
      : poly;
    const clean = this._cleanFloor(r, floor);
    const cmPerUnit = this._cellCm / this._gridPitch;
    return formatArea(
      (clean.area * cmPerUnit * cmPerUnit) / 1e4,
      this._renderPlanHass?.config?.unit_system?.length === 'mi',
    );
  }

  /** Room temperature honouring the tier-3 source override. */
  private _roomTemp(r: RoomCfg): number | null {
    const src = r.settings?.temp_source;
    if (src) return sourceValue(this._renderPlanHass, src, 'temp', this._markers);
    const key = roomClimateKey(this._spaceModel()?.id, r);
    return key ? this._climate().get(key)?.temp ?? null : null;
  }

  /** Room humidity honouring the tier-3 source override. */
  private _roomHum(r: RoomCfg): number | null {
    const src = r.settings?.hum_source;
    if (src) return sourceValue(this._renderPlanHass, src, 'hum', this._markers);
    const key = roomClimateKey(this._spaceModel()?.id, r);
    return key ? this._climate().get(key)?.hum ?? null : null;
  }

  // Ключи сравниваются только по ссылке (`===`), значение не читается ни разу.
  // Поэтому `unknown` для hass точнее любого структурного типа: он и запрещает
  // случайно воспользоваться содержимым, и не врёт про форму объекта, которую
  // HA нам не обещает. Правила и маркеры при этом типизированы по-настоящему.
  private _climateCache: {
    h: unknown;
    r: CompiledIconRule[] | undefined;
    mk: Marker[] | undefined;
    ex: string[] | undefined;
    m: Map<string, AreaClimate>;
  } | null = null;

  /**
   * Climate for every HA Area and explicitly placed local room, computed ONCE
   * per hass snapshot (review R2-3, issue #317).
   * Home Assistant hands out a new `hass` object on every state change, so
   * identity is exactly the right cache key: fresh states always recompute,
   * and the 60 rooms of one render share a single registry pass instead of
   * triggering one each (two, with humidity on).
   */
  private _climate(): Map<string, AreaClimate> {
    // markers are part of the key: ticking "use the device's temperature
    // sensor" replaces the markers array, so the average recomputes at once
    const mk = this._serverCfg?.markers;
    const planHass = this._renderPlanHass;
    const c = this._climateCache;
    // #44 r1-M1: the exclusion list is part of the key — saving new Discovery
    // filters replaces the settings object, and room climate must follow the
    // new exclusions immediately, not on the next unrelated hass tick. The
    // STORED array reference is the key (stable across renders); _excluded
    // itself builds a fresh Set per call when a list is present.
    const ex = this._settings.exclude_integrations;
    if (c && c.h === planHass && c.r === this._iconRules && c.mk === mk && c.ex === ex) return c.m;
    const m = roomClimateMap(planHass, this._iconRules, mk, this._excluded);
    this._climateCache = { h: planHass, r: this._iconRules, mk, ex, m };
    return m;
  }

  private _resetRoomDialogFields(): void {
    return this._editorRuntimeOrThrow()._resetRoomDialogFields();
  }

  /** Open the room dialog for an EXISTING room (the gear on its card). */
  private _openRoomEdit(r: RoomCfg): void {
    return this._editorRuntimeOrThrow()._openRoomEdit(r);
  }

  /** Collect the room settings object from the dialog state (null = all inherited). */
  private _roomSettingsFromDialog(): RoomCfg['settings'] {
    return this._editorRuntimeOrThrow()._roomSettingsFromDialog();
  }

  /** Save the room edited via the gear (name, area, tier-3 settings). */
  private _saveRoomEdit(): void {
    return this._editorRuntimeOrThrow()._saveRoomEdit();
  }

  /** Devices + sensor entities for the measurement-source picker. */
  private _roomSrcCandidates(): { value: string; label: string; sub: string }[] {
    return this._editorRuntimeOrThrow()._roomSrcCandidates();
  }

  /** Human label of a picked measurement source. */
  private _roomSrcLabel(src: string): string {
    return this._editorRuntimeOrThrow()._roomSrcLabel(src);
  }

  /** Saved label position (layout key rl_<roomId>) or the room center. */
  private _labelPos(r: RoomCfg, spaceId: string): { x: number; y: number } {
    const saved = this._layout['rl_' + (r.id || '')];
    if (saved && saved.s === spaceId) return { x: saved.x * NORM_W, y: saved.y * NORM_W };
    const center = this._roomCenter(r);
    const grid = this._gridPitch;
    return {
      x: clampCanvasR(snapToGrid(center[0], grid)),
      y: clampCanvasR(snapToGrid(center[1], grid)),
    };
  }

  /** Room-name labels are dragged exactly like device icons (same layout store). */
  private _labelDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._labelDown(ev, r, spaceId);
  }

  private _labelMove(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._labelMove(ev, r, spaceId);
  }

  private _labelUp(r: RoomCfg): void {
    if (!this._editorRuntime) return;
    return this._editorRuntimeOrThrow()._labelUp(r);
  }

  /** Saved room-card scale (layout key rl_<roomId>, field k), clamped 0.5..3. */
  private _labelScale(r: RoomCfg): number {
    const scale = (this._layout['rl_' + (r.id || '')] as any)?.k;
    return typeof scale === 'number' && Number.isFinite(scale)
      ? Math.min(3, Math.max(0.5, scale)) : 1;
  }

  private _rlResizeDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    return this._editorRuntimeOrThrow()._rlResizeDown(ev, r, spaceId);
  }

  private _rlResizeMove(ev: PointerEvent): void {
    return this._editorRuntimeOrThrow()._rlResizeMove(ev);
  }

  private _rlResizeUp(): void {
    return this._editorRuntimeOrThrow()._rlResizeUp();
  }

  /** The room-settings button: detached from the (movable) label, always at
   *  the geometric CENTRE of the room, sized at 70% of a device icon and
   *  therefore zooming with the plan (owner's spec, 2026-07-29). */
  private _gearPtCache = new WeakMap<number[][], number[]>();

  private _renderRoomGear(
    r: RoomCfg, space: SpaceModel, view: { x: number; y: number; w: number; h: number },
  ): TemplateResult | typeof nothing {
    return this._editorRuntimeOrThrow()._renderRoomGear(r, space, view);
  }

  private _renderRoomLabel(
    r: RoomCfg, space: SpaceModel, view: { x: number; y: number; w: number; h: number }, disp: SpaceDisplay,
  ): TemplateResult | typeof nothing {
    // audit/feedback: rooms without a name still need their gear in the Plan
    // editor — that is where you name them (field report, 2026-07-27)
    if (!r.name && !this._markup) return nothing;
    const p = this._labelPos(r, space.id);
    const point = this._scenePoint([p.x, p.y]);
    const left = ((point[0] - view.x) / view.w) * 100;
    const top = ((point[1] - view.y) / view.h) * 100;
    const op = Math.min(1, disp.opacity + 0.25);
    const k = this._labelScale(r);
    // Optional metrics row. Temperature/humidity and light sources may use an
    // explicit room_id even when this room has no HA Area. LQI remains area-only.
    const rows: TemplateResult[] = [];
    if (disp.labelTemp || disp.labelHum || (disp.labelLqi && r.area) || disp.labelLight) {
      if (disp.labelTemp) {
        const t = this._roomTemp(r);
        if (t != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${t}°</span>`);
      }
      if (disp.labelHum) {
        const hm = this._roomHum(r);
        if (hm != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${hm}%</span>`);
      }
      if (disp.labelLqi && r.area) {
        const l = this._roomLqi(r.area);
        if (l != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${l}</span>`);
      }
      if (disp.labelLight) {
        const ls = resolvedLightStats(resolvedLightSources(
          this._renderPlanHass, this._renderDevices, r, this._virtualLights,
        ));
        if (ls) {
          const txt = ls.on === 0
            ? this._t('roomcard.light_off')
            : ls.on === ls.total
              ? this._t('roomcard.light_on')
              : this._t('roomcard.light_partial', { on: ls.on, total: ls.total });
          rows.push(html`<span class="rlm ${ls.on ? 'lit' : ''}"><ha-icon icon=${ls.on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}></ha-icon>${txt}</span>`);
        }
      }
    }
    // Plan keeps the same name-row geometry as the other modes, but the Area
    // icon remains part of the draggable label instead of becoming a link.
    const showAreaLink = !!r.area;
    const areaLinkInteractive = !this._markup;
    return html`<div class="roomlabel ${rows.length ? 'card' : ''}"
      data-hp="room-label" data-id=${r.id || nothing} data-area=${r.area || nothing}
      role=${this._mode === 'view' ? 'button' : nothing}
      tabindex=${this._mode === 'view' ? '0' : nothing}
      aria-label=${this._mode === 'view' ? this._t('room.fit_action', { name: r.name || '' }) : nothing}
      style="left:${left}%;top:${top}%;color:${disp.color};opacity:${op};--rl-scale:${k};--rl-space:${disp.cardFontScale};--rl-name:${clampScale(r.settings?.name_scale)};--rl-meta:${clampScale(r.settings?.label_scale)}"
      @keydown=${this._mode === 'view' && r.id
        ? (e: KeyboardEvent) => this._roomLabelKey(e, r.id!) : nothing}
      @pointerdown=${this._markup
        ? (e: PointerEvent) => this._labelDown(e, r, space.id) : nothing}
      @pointermove=${this._markup
        ? (e: PointerEvent) => this._labelMove(e, r, space.id) : nothing}
      @pointerup=${this._markup ? () => this._labelUp(r) : nothing}
      @pointercancel=${this._markup ? () => this._labelUp(r) : nothing}
    ><span class="rlname">${r.name || (this._markup ? this._t('room.unnamed') : '')}${showAreaLink
        ? html`<ha-icon class="rlgo" icon="mdi:open-in-new"
            title=${areaLinkInteractive ? this._t('room.open_area') : nothing}
            @click=${areaLinkInteractive
              ? (e: Event) => { e.stopPropagation(); this._clickRoom(r); }
              : nothing}
            @pointerdown=${areaLinkInteractive
              ? (e: Event) => e.stopPropagation()
              : nothing}></ha-icon>`
        : nothing}</span>
      ${rows.length ? html`<span class="rlmetrics">${rows}</span>` : nothing}
      ${this._mode === 'plan'
        ? ['tl', 'tr', 'bl', 'br'].map(
            (c) => html`<span class="rlhandle ${c}"
              @pointerdown=${(e: PointerEvent) => this._rlResizeDown(e, r, space.id)}
              @pointermove=${(e: PointerEvent) => this._rlResizeMove(e)}
              @pointerup=${() => this._rlResizeUp()}
              @pointercancel=${() => this._rlResizeUp()}></span>`,
          )
        : nothing}
    </div>`;
  }
  /** Pointer-owned HTML painted by the live child renderer, outside the host Lit tree. */
  public _renderLiveEditorMeasurements(value: unknown): TemplateResult | typeof nothing {
    const view = value as { x: number; y: number; w: number; h: number };
    const opMeasure = this._opMeasureView, decorMeasure = this._decorMeasure, bdLive = this._bdLive,
      furnLive = this._editorRuntime?._furnLive() ?? null;
    return html`
      ${this._measureAnchor
        ? html`<div class="measurelayer" data-hp-live-layer="camera">${this._renderMeasureLabel(view)}</div>`
        : nothing}
      ${this._resize?.liveLabels
        ? html`<div class="measurelayer" data-hp-live-layer="camera">${this._resize.liveLabels.map((l) => html`<div
            class="measurelabel ${l.kind === 'area' ? 'rszarea' : 'rszlength'}"
            data-hp=${l.kind === 'area' ? 'resize-area-label' : 'resize-length-label'} data-room=${l.kind === 'area' ? l.roomId : nothing} data-side=${l.kind === 'area' ? l.placement.side : nothing}
            style="left:${(((l.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((l.y - view.y) / view.h) * 100).toFixed(2)}%;${l.kind === 'area'
              ? `--rsz-label-x:${l.placement.offsetXPx.toFixed(2)}px;--rsz-label-y:${l.placement.offsetYPx.toFixed(2)}px;--rsz-label-tangent:${l.placement.tangentOffsetPx.toFixed(2)}px`
              : ''}">${l.text}</div>`)}</div>`
        : nothing}
      ${opMeasure
        ? html`<div class="measurelayer" data-hp-live-layer="camera">${opMeasure.labels.map((l) => html`<div
            class="measurelabel opshoulder ${l.dimension ? 'opdimension' : ''}"
            data-dimension-source=${l.dimension?.source || nothing} data-dimension-room=${l.dimension?.roomId || nothing}
            style="left:${(((l.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((l.y - view.y) / view.h) * 100).toFixed(2)}%;${l.dimension
              ? `--op-label-shift-x:${(l.dimension.labelNormal[0] * 12).toFixed(2)}px;--op-label-shift-y:${(l.dimension.labelNormal[1] * 12).toFixed(2)}px`
              : ''}">${l.text}</div>`)}</div>`
        : nothing}
      ${decorMeasure
        ? html`<div class="measurelayer" data-hp-live-layer="camera"><div class="measurelabel dmeasure ${decorMeasure.on45 ? 'on45' : ''}"
            style="left:${(((decorMeasure.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((decorMeasure.y - view.y) / view.h) * 100).toFixed(2)}%">${decorMeasure.text}</div></div>`
        : nothing}
      ${furnLive
        ? html`<div class="measurelayer" data-hp-live-layer="camera">${furnLive.map((l) => html`<div class="measurelabel furnmeasure"
            style="left:${(((l.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((l.y - view.y) / view.h) * 100).toFixed(2)}%">${l.text}</div>`)}</div>`
        : nothing}
      ${bdLive
        ? html`<div class="measurelayer" data-hp-live-layer="camera"><div class="measurelabel bdmeasure"
            style="left:${(((bdLive.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((bdLive.y - view.y) / view.h) * 100).toFixed(2)}%">${bdLive.text}</div></div>`
        : nothing}
    `;
  }

  /** Where the live measurement starts: the last outline point, or the first split point. */
  private get _measureAnchor(): number[] | null {
    if (!this._markup || !this._cursorPt) return null;
    if (this._tool === 'draw' && this._path.length && !this._contourClosed)
      return this._path[this._path.length - 1];
    if (this._tool === 'split' && this._splitSel?.pts?.length)
      return this._splitSel.pts[this._splitSel.pts.length - 1];
    return null;
  }

  /** Length badge that follows the cursor while drawing a segment or a cut. */
  private _renderMeasureLabel(view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const a = this._measureAnchor!;
    const b = this._cursorPt!;
    const left = ((b[0] - view.x) / view.w) * 100;
    const top = ((b[1] - view.y) / view.h) * 100;
    // angle badge: length · angle, both green when the angle is a 45° multiple
    const deg = segmentAngle(a, b);
    const shown = Math.round(deg * 10) / 10;
    const on45 = isExact45Vector(a, b, this._gridPitch * 0.0002);
    return html`<div class="measurelabel ${on45 ? 'on45' : ''}" style="left:${left}%;top:${top}%">
      ${this._fmtLen(a, b)} · ${shown}°</div>`;
  }

  /**
   * Live size badge for the shape being drawn in the BACKGROUND (decor)
   * editor — owner 2026-08-04: «в редакторе подложки у линий писать длину,
   * как при рисовании комнат в редакторе плана».
   *
   * A line gets exactly what a wall gets while a plan is drawn: length ·
   * angle in the HA unit system, green on a 45° multiple — the same
   * `_fmtLen` (`segmentCm` over `cell_cm`), the same `.measurelabel`. The
   * only difference is WHERE it sits: a wall badge follows the cursor
   * because the cursor is the wall's free end, while a decor line is pulled
   * out by both ends at once, so its badge rides the MIDDLE of the segment
   * (owner: «плашка на середине линии»).
   *
   * Rectangles report «W × H» plus area; ellipses report one radius for a
   * circle or both radii otherwise. A draft that has not moved yet (the
   * pointerdown before the drag) shows nothing — a «0» badge under the cursor
   * is noise, not a measurement.
   */
  private get _decorMeasure(): { x: number; y: number; text: string; on45: boolean } | null {
    const d = this._decorDraft;
    if (!d || this._mode !== 'decor') return null;
    const [ax, ay] = d.a;
    const [bx, by] = d.b;
    if (Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) < 1e-6) return null;
    const x = (ax + bx) / 2;
    const y = (ay + by) / 2;
    if (d.kind === 'line') {
      const deg = segmentAngle(d.a, d.b);
      return { x, y, on45: is45(deg),
        text: `${this._fmtLen(d.a, d.b)} · ${Math.round(deg * 10) / 10}°` };
    }
    const wText = this._fmtLen([ax, ay], [bx, ay]);
    const hText = this._fmtLen([bx, ay], [bx, by]);
    if (d.kind === 'ellipse') {
      const rx = this._fmtLen([0, 0], [Math.abs(bx - ax) / 2, 0]);
      const ry = this._fmtLen([0, 0], [0, Math.abs(by - ay) / 2]);
      const circle = Math.abs(Math.abs(bx - ax) - Math.abs(by - ay)) < 1e-6;
      return { x, y, on45: false, text: circle ? `R ${rx}` : `Rx ${rx} × Ry ${ry}` };
    }
    const area = (decorUnitsToCm(Math.abs(bx - ax), this._cellCm, this._gridPitch)
      * decorUnitsToCm(Math.abs(by - ay), this._cellCm, this._gridPitch)) / 10000;
    return { x, y, on45: false,
      text: `${wText} × ${hText} · ${formatArea(area, this._imperial)}` };
  }

  // ================= alignment guides (smart guides) =================

  /** The point being drawn/dragged right now, or null (per editor context). */
  private get _alignPoint(): number[] | null {
    if (this._markup) {
      if (this._tool === 'draw' && this._path.length && !this._contourClosed && this._cursorPt)
        return this._cursorPt;
      if (this._tool === 'split' && this._splitSel?.pts?.length && this._cursorPt)
        return this._cursorPt;
      if (this._drag?.id.startsWith('rl_') && this._drag.moved) {
        const roomId = this._drag.id.slice(3);
        const room = this._spaceModel()?.rooms.find((r) => r.id === roomId);
        return room ? (() => { const p = this._labelPos(room, this._space); return [p.x, p.y]; })() : null;
      }
      return null;
    }
    if (this._mode === 'devices' && this._deviceDrag?.moved) {
      const d = this._devices.find((x) => x.id === this._deviceDrag!.id);
      return d ? (() => { const p = this._pos(d); return [p.x, p.y]; })() : null;
    }
    if (this._mode === 'decor') {
      if (this._decorDraft) return this._decorDraft.b;
      if (this._decorMove) {
        const sh = this._decorList.find((x) => x.id === this._decorMove!.id);
        if (!sh) return null;
        const W = NORM_W, H = this._decorH;
        if (sh.kind === 'line') return [sh.x1 * W, sh.y1 * H];
        return [sh.x * W, sh.y * H];
      }
      return null;
    }
    return null;
  }

  /** Alignment candidates for the current context (owner's matrix). */
  private _alignCandidates(): number[][] {
    return this._editorRuntimeOrThrow()._alignCandidates();
  }

  private _renderAlignGuides(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderAlignGuides();
  }

  /** Perpendicular dashed tick through the wall's center while a dragged opening
   * sits exactly in the middle — same look as the alignment guides. Length is
   * about the wall stroke (2.5) × 6 to each side. */
  private _renderOpeningCenterTick(gd: { x: number; y: number; angle: number }): TemplateResult {
    return this._editorRuntimeOrThrow()._renderOpeningCenterTick(gd);
  }

  /** Physical dimension segments for a NEW-opening placement preview (#238).
   * Existing-opening drag labels carry no `dimension` and render nothing here. */
  private _renderOpeningDimensionGuides(measure: OpMeasure): TemplateResult {
    return this._editorRuntimeOrThrow()._renderOpeningDimensionGuides(measure);
  }

  private _roomCenter(r: RoomCfg): number[] {
    if (r.poly) {
      const n = r.poly.length;
      return [r.poly.reduce((a, p) => a + p[0], 0) / n, r.poly.reduce((a, p) => a + p[1], 0) / n];
    }
    return [r.x! + r.w! / 2, r.y! + Math.min(r.w!, r.h!) * 0.1];
  }

  /** Live state of an opening's contact, 0..1 drawn amount. */
  private _openingAmt(o: OpeningCfg): number {
    const entity = o.contact && this._renderOpeningEntityAvailable(o.contact)
      ? this._renderPlanHass.states[o.contact]
      : null;
    return openingAmount(
      o.type, entity?.state, !!o.invert, entity?.attributes?.current_position,
    );
  }

  /** Deleted bindings are unavailable to every plan-level consumer. */
  private _planEntityAvailable(eid: string | null | undefined): boolean {
    if (!eid) return false;
    if (isRemovedPlanEntity(this._fullRegistryHass, eid, removedPlanBindings(this._markers))) return false;
    return this._bindingStatus('entity:' + eid).kind === 'active';
  }

  /** Availability from the same immutable projection as the painted frame. */
  private _renderEntityAvailable(eid: string | null | undefined): boolean {
    if (!eid) return false;
    if (isRemovedPlanEntity(this._renderPlanHass, eid, removedPlanBindings(this._markers))) return false;
    return !!this._renderPlanHass.entities?.[eid] && !!this._renderPlanHass.states?.[eid];
  }

  /** Exact opening references ignore marker tombstones but keep HA status. */
  private _openingEntityAvailable(eid: string | null | undefined): boolean {
    return openingEntityAvailable(this.hass, eid, this._haRegistry);
  }

  /** Opening availability from the same immutable projection as the frame. */
  private _renderOpeningEntityAvailable(eid: string | null | undefined): boolean {
    return renderOpeningEntityAvailable(this._renderPlanHass, eid);
  }

  /**
   * Architectural openings, drawn in plan (SVG) coordinates so they scale and
   * pan with the plan. A passage deliberately contributes no visible symbol;
   * its editor hitbox is still supplied by the shared metrics below.
   */
  private _renderOpeningPlacementPreview(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderOpeningPlacementPreview();
  }

  private _renderOpenings(disp: SpaceDisplay, onlyIds?: readonly string[]): TemplateResult {
    const items = onlyIds ? this._openingsR.filter((item) => onlyIds.includes(item.id)) : this._openingsR;
    if (!items.length) return svg``;
    const space = this._spaceModel();
    if (!space) return svg``;
    const base = disp.color;
    const walls = this._spaceWalls;
    const openCuts = this._openCuts();
    const openingWallIndex = this._openingWallIndexFor(space, openCuts).value;
    return svg`<g class="openinglayer">${items.map((o) => {
      if (o.orphanReason) return svg`<g class="opening orphan" data-hp="opening-orphan"
        data-id=${o.id} role="button" tabindex="0"
        aria-label=${this._t('opening.partition_orphan')}
        transform="translate(${o.rx} ${o.ry})"
        @click=${(event: MouseEvent) => { event.stopPropagation(); this._editOpening(o); }}>
        <circle r=${gridVisualUnits(this._gridPitch * 0.55, this._cellCm)}></circle>
        <text text-anchor="middle" dominant-baseline="central">!</text>
      </g>`;
      const amt = this._openingAmt(o);
      const active = amt > 0 && !!o.contact && this._renderOpeningEntityAvailable(o.contact);
      const tone = active ? 'var(--hp-open)' : base;
      // A normal door/window uses the selected room-side face. A gate's
      // architectural symbol sits and opens on the opposite (exterior) face;
      // flip_v still lets the user reverse that side where a shared wall makes
      // "outside" inherently ambiguous.
      const faceFlipV = o.type === 'gate' ? !o.flip_v : o.flip_v;
      // Resolve the side even with zero-thickness walls for gates, while
      // preserving the cheap classic path for ordinary line-plan openings.
      const face = o.partitionHost || walls.length || o.type === 'gate'
        ? this._openingFace(o, openingWallIndex, !!faceFlipV)
        : { ox: 0, oy: 0, cm: 0, side: -1 as -1 | 1 };
      const visibleSpec: OpeningVisibleSpec = {
        type: o.type,
        length: o.rlen,
        angle: o.angle,
        amount: amt,
        flipH: !!o.flip_h,
        flipV: !!o.flip_v,
        base,
        tone,
        cellCm: this._cellCm,
        gridPitch: this._gridPitch,
        face,
      };
      const { half, outlineHalf, hitHalf } = openingVisibleMetrics(visibleSpec);
      const outlinePad = gridVisualUnits(10, this._cellCm);
      const hitPad = gridVisualUnits(12, this._cellCm);
      return svg`<g class="opening" data-hp="opening" data-id="${o.id}" data-kind="${o.type}"
        transform="translate(${o.rx} ${o.ry}) rotate(${o.angle})">
        ${renderOpeningVisibleGeometry(visibleSpec)}
        <rect class="op-outline" x="${-half - outlinePad}" y="${-outlineHalf}"
          width="${o.rlen + outlinePad * 2}" height="${outlineHalf * 2}"
          rx="${gridVisualUnits(6, this._cellCm)}"></rect>
        <rect class="op-hit" x="${-half - hitPad}" y="${-hitHalf}"
          width="${o.rlen + hitPad * 2}" height="${hitHalf * 2}"
          @click=${(e: MouseEvent) => this._opClick(e, o)}
          @pointerdown=${(e: PointerEvent) => this._opPointerDown(e, o)}
          @pointermove=${(e: PointerEvent) => this._opPointerMove(e, o)}
          @pointerup=${(e: PointerEvent) => this._opPointerUp(e, o)}
          @pointercancel=${(e: PointerEvent) => this._opPointerUp(e, o)}></rect>
      </g>`;
    })}</g>`;
  }

  /** Padlock badges for door-like openings with a lock entity. */
  private _renderOpeningLocks(view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const items = this._openingsR.filter(
      (o) => !o.orphanReason && (o.type === 'door' || o.type === 'gate')
        && o.lock && this._renderOpeningEntityAvailable(o.lock),
    );
    if (!items.length) return html``;
    const space = this._spaceModel();
    if (!space) return html``;
    const openCuts = this._openCuts();
    const openingWallIndex = this._openingWallIndexFor(space, openCuts).value;
    return html`${items.map((o) => {
      const st = this._renderPlanHass.states[o.lock!]?.state;
      const locked = st === 'locked';
      const known = locked || ['unlocked', 'open', 'opening', 'unlocking', 'locking'].includes(String(st));
      // Perpendicular offset from the opening center, away from the swing side.
      // Gate exterior depends on the room edge, not merely on normalized wall
      // angle, so resolve that face explicitly.
      const rad = ((o.angle + 90) * Math.PI) / 180;
      const gateFace = o.type === 'gate'
        ? this._openingFace(o, openingWallIndex, !o.flip_v)
        : null;
      const lockOffset = gridVisualUnits(16, this._cellCm);
      const off = gateFace ? -lockOffset * gateFace.side : lockOffset * (o.flip_v ? -1 : 1);
      const px = o.rx + Math.cos(rad) * off;
      const py = o.ry + Math.sin(rad) * off;
      const point = this._scenePoint([px, py]);
      const left = ((point[0] - view.x) / view.w) * 100;
      const top = ((point[1] - view.y) / view.h) * 100;
      return html`<div class="oplock ${deviceThemeClass(this._renderPlanHass)} ${locked ? 'locked' : known ? 'unlocked' : 'unknown'}"
        style="left:${left}%;top:${top}%"
        @click=${(e: MouseEvent) => {
          if (this._mode !== 'view') return;
          e.stopPropagation();
          this._openingInfo = o;
        }}>
        <span class="oplock-shell" aria-hidden="true">
          <span class="oplock-core">
            <ha-icon icon="${locked ? 'mdi:lock' : known ? 'mdi:lock-open-variant' : 'mdi:lock-question'}"></ha-icon>
          </span>
        </span>
      </div>`;
    })}`;
  }

  /**
   * Explicit lock/unlock from the opening info card. This does NOT violate the
   * "locks never toggle from the plan" rule: that rule guards against ACCIDENTAL
   * taps on plan icons; here the user has opened the info card and pressed a
   * clearly labeled action button — same interaction contract as HA's more-info.
   */
  private async _lockAction(entityId: string, action: 'lock' | 'unlock'): Promise<void> {
    // THE ONLY sanctioned lock actuation surface (review CR-1, 2026-07-27).
    // The invariant is "no lock or alarm panel is ever actuated by a TAP on the
    // plan" — icons, badges, controls[] and the device card all refuse. This
    // button is a deliberate, labeled control inside an opened card, the same
    // contract as Home Assistant's own more-info dialog. Unlocking additionally
    // asks for confirmation; locking does not (locking is never destructive).
    if (!this._openingEntityAvailable(entityId)) return;
    if (action === 'unlock') {
      const name = this.hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
      const accepted = await this._confirmDanger({
        key: 'unlock',
        kind: 'warning',
        title: this._t('confirm.unlock_title'),
        message: this._t('confirm.unlock_body'),
        objectName: name,
        confirmLabel: this._t('opening.unlock_action'),
        cancelLabel: this._t('btn.cancel'),
      });
      const opening = this._openingInfo;
      if (!accepted || !this._openingEntityAvailable(entityId)
        || !opening || (opening.type !== 'door' && opening.type !== 'gate')
        || opening.lock !== entityId || this.hass?.states?.[entityId]?.state !== 'locked') return;
    }
    this.hass?.callService?.('lock', action, { entity_id: entityId });
  }

  private _renderOpeningInfoCard(): TemplateResult {
    const o = this._openingInfo!;
    // A legacy/future writer may have left door bindings on a passage. They
    // remain readable for lossless round-trip, but are inert on every surface.
    const contact = o.type !== 'passage' && o.contact
      && this._openingEntityAvailable(o.contact) ? o.contact : null;
    const lock = (o.type === 'door' || o.type === 'gate') && o.lock
      && this._openingEntityAvailable(o.lock) ? o.lock : null;
    const cSt = contact ? this.hass.states[contact]?.state : null;
    const amt = this._openingAmt(o);
    const lSt = lock ? this.hass.states[lock]?.state : null;
    const titleKey = o.type === 'door' ? 'opening.door'
      : o.type === 'gate' ? 'opening.gate'
        : o.type === 'passage' ? 'opening.passage' : 'opening.window';
    const openingIcon = o.type === 'door' ? 'mdi:door'
      : o.type === 'gate' ? 'mdi:gate'
        : o.type === 'passage' ? 'mdi:arch' : 'mdi:window-closed-variant';
    const contactIcon = o.type === 'gate'
      ? (amt > 0 ? 'mdi:gate-open' : 'mdi:gate')
      : (amt > 0 ? 'mdi:door-open' : 'mdi:door-closed');
    const row = (icon: string, label: string, value: string, cls = '') =>
      html`<div class="oprow ${cls}"><ha-icon icon=${icon}></ha-icon><span>${label}</span><b>${value}</b></div>`;
    return html`<hp-dialog .hass=${this.hass}
      .title=${this._t(titleKey)} icon=${openingIcon} dismiss-on-scrim
      @hp-close=${() => (this._openingInfo = null)}>
        <div class="body">
          ${contact
            ? row(contactIcon,
                this._t('opening.contact_label'),
                cSt === 'unavailable' || cSt == null
                  ? this._t('opening.state_unknown')
                  : this._t(amt > 0 ? 'opening.open' : 'opening.closed'),
                amt > 0 ? 'warn' : 'ok')
            : nothing}
          ${lock
            ? row(lSt === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant',
                this._t('opening.lock_label'),
                lSt === 'locked' ? this._t('opening.locked')
                  : ['unlocked', 'open'].includes(String(lSt)) ? this._t('opening.unlocked')
                  : this._t('opening.state_unknown'),
                lSt === 'locked' ? 'ok' : 'warn')
            : nothing}
          ${lock && (lSt === 'locked' || ['unlocked', 'open'].includes(String(lSt)))
            ? html`<button
                class="btn lockact ${lSt === 'locked' ? 'warn' : ''}"
                @click=${() => this._lockAction(lock, lSt === 'locked' ? 'unlock' : 'lock')}>
                <ha-icon icon=${lSt === 'locked' ? 'mdi:lock-open-variant' : 'mdi:lock'}></ha-icon>
                ${this._t(lSt === 'locked' ? 'opening.unlock_action' : 'opening.lock_action')}
              </button>`
            : lock && ['locking', 'unlocking'].includes(String(lSt))
              ? html`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t('opening.lock_pending')}
                </button>`
              : nothing}
          ${!contact && !lock ? html`<p class="muted">${this._t('opening.no_entities')}</p>` : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._openingInfo = null)}>${this._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

  private _renderOpeningDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderOpeningDialog();
  }

  /** Adaptive grid density for the current view (docs/CANVAS.md §7):
   *  which multiple of the drawing pitch is still legible on screen, and
   *  which coarser one carries the accent dots. */
  private _gridLevels(): { fine: number; coarse: number } | null {
    return this._editorRuntimeOrThrow()._gridLevels();
  }

  private _renderMarkupDefs(_vb: number[]): TemplateResult {
    return this._editorRuntimeOrThrow()._renderMarkupDefs(_vb);
  }

  private _renderPhysicalEditorLayer(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderPhysicalEditorLayer();
  }

  private _renderHiddenWallDiagnosticOverlay(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderHiddenWallDiagnosticOverlay();
  }

  private _renderPlanSnapOverlay(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderPlanSnapOverlay();
  }

  /** Update the only pointer-dependent node without scheduling a full card render. */
  private _syncPlanSnapActiveMarker(candidate: PlanSnapCandidate | null): void {
    return this._editorRuntimeOrThrow()._syncPlanSnapActiveMarker(candidate);
  }

  /** Pointer-only ambiguity styling without a full Lit render on large plans. */
  private _syncPlanSnapConflictMarkers(conflicts: readonly PlanSnapEndpoint[]): void {
    return this._editorRuntimeOrThrow()._syncPlanSnapConflictMarkers(conflicts);
  }

  /** Physical depth for one immutable architectural snap segment. */
  private _planSnapPhysicalSegment(segment: PlanSnapSegment): LinearWallSegment | null {
    return this._editorRuntimeOrThrow()._planSnapPhysicalSegment(segment);
  }

  /**
   * Local target patches make a snapped rubber-band meet saved masonry before
   * the click. The expensive saved union stays cached; pointermove examines
   * only immutable snap axes touching a preview vertex.
   */
  private _drawPreviewJoinPatchD(
    points: number[][], halfDepths: number[],
  ): string {
    return this._editorRuntimeOrThrow()._drawPreviewJoinPatchD(points, halfDepths);
  }

  private _renderMarkupLayer(vb: number[]): TemplateResult {
    return this._editorRuntimeOrThrow()._renderMarkupLayer(vb);
  }

  /**
   * Axis and node ink of the active wall/room chain. Every click persists the
   * segment into `room_drafts`, whose opaque masonry paints ABOVE the markup
   * layer, so drawing this ink inside `_renderMarkupLayer` left already-placed
   * segments looking like bare walls (#307). The chain ink therefore paints in
   * its own layer after the wall bodies and before the snap overlay: yellow
   * "work in progress" styling stays distinct from finished walls, and the
   * snap geometry keeps excluding the active draft (no self-snapping).
   */
  private _renderActiveChainInk(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderActiveChainInk();
  }

  private _renderPartitionDeleteDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderPartitionDeleteDialog();
  }

  private _renderRoomDeleteDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderRoomDeleteDialog();
  }

  private _renderPhysicalDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderPhysicalDialog();
  }

  private _renderMarkupBar(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderMarkupBar();
  }

  private _renderDevicesBar(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDevicesBar();
  }

  private _renderDeviceInbox(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderDeviceInbox();
  }

  /** Entities of a device worth CONTROLLING or reading, in a sensible order. */
  private _cardEntities(d: DevItem): { eid: string; kind: 'toggle' | 'value' | 'open' }[] {
    const h = this._planHass;
    const out: { eid: string; kind: 'toggle' | 'value' | 'open' }[] = [];
    const seen = new Set<string>();
    const push = (eid: string) => {
      if (!eid || seen.has(eid) || !h.states[eid]) return;
      const reg = h.entities[eid];
      if (reg?.entity_category === 'config' || reg?.entity_category === 'diagnostic') return;
      seen.add(eid);
      const dom = eid.split('.')[0];
      if (['light', 'switch', 'fan', 'humidifier', 'siren', 'input_boolean'].includes(dom))
        out.push({ eid, kind: 'toggle' });
      else if (['cover', 'valve', 'lock', 'climate', 'media_player', 'vacuum', 'water_heater'].includes(dom))
        out.push({ eid, kind: 'open' }); // needs the full more-info UI
      else if (['sensor', 'binary_sensor', 'number', 'select'].includes(dom))
        out.push({ eid, kind: 'value' });
    };
    for (const source of resolvedLightSources(h, this._devices, null, this._virtualLights)) {
      if (source.device.id !== d.id) continue;
      for (const eid of [...source.serviceEids, ...source.stateEids]) push(eid);
    }
    if (d.primary) push(d.primary);
    for (const e of d.entities) push(e);
    return out.slice(0, 12);
  }

  /** Toggle straight from the device card (safe domains only). */
  private _cardToggle(eid: string): void {
    const dom = eid.split('.')[0];
    if (dom === 'lock' || dom === 'alarm_control_panel' || !this._planEntityAvailable(eid)) return;
    this.hass
      .callService('homeassistant', 'toggle', { entity_id: eid })
      .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
  }

  private _renderInfoCard(): TemplateResult {
    const d = this._infoCard!;
    const st = d.primary ? this.hass.states[d.primary] : undefined;
    const stateTxt = st ? hassValue(this.hass, d.primary)?.text ?? st.state : null;
    const controls = (d.controls ?? d.marker?.controls ?? [])
      .filter(isControllable).filter((eid) => this._planEntityAvailable(eid));
    return html`<hp-dialog .hass=${this.hass} .title=${d.name} .icon=${d.icon} wide
      dismiss-on-scrim @hp-close=${this._closeInfoCard}>
        <div class="body">
          ${(() => {
            // Field feedback: on a wall tablet this card is for CONTROLLING the
            // home; model/links/manuals are reference material and belong below.
            const ents = this._cardEntities(d);
            if (!ents.length) return nothing;
            return html`<div class="entlist">
              ${ents.map(({ eid, kind }) => {
                const est = this.hass.states[eid];
                const name = this.hass.entities[eid]?.name
                  || est?.attributes?.friendly_name || eid;
                const val = est ? hassValue(this.hass, eid)?.text ?? est.state : '';
                const on = est?.state === 'on' || ['open', 'unlocked', 'playing', 'cleaning'].includes(est?.state);
                return html`<div class="entrow ${on ? 'on' : ''}">
                  <ha-icon icon=${stateIcon(
                    iconFor(name, '', this._iconRules), eid.split('.')[0],
                    est?.attributes?.device_class, est?.state, false,
                  )}></ha-icon>
                  <span class="en">${name}</span>
                  ${kind === 'toggle'
                    ? html`<button class="entbtn ${on ? 'on' : ''}"
                        @click=${() => this._cardToggle(eid)}>${val}</button>`
                    : kind === 'open'
                      ? html`<button class="entbtn"
                          @click=${() => { this._closeInfoCard(); this._openMoreInfo(eid); }}>${val}</button>`
                      : html`<span class="ev">${val}</span>`}
                </div>`;
              })}
            </div>`;
          })()}
          ${d.model ? html`<div class="inforow"><span class="k">${this._t('info.model')}</span><span>${d.model}</span></div>` : nothing}
          ${stateTxt && !this._cardEntities(d).length
            ? html`<div class="inforow"><span class="k">${this._t('info.state')}</span><span>${stateTxt}</span></div>` : nothing}
          ${safeUrl(d.link)
            ? html`<div class="inforow"><span class="k">${this._t('info.link')}</span>
                <a href="${safeUrl(d.link)}" target="_blank" rel="noreferrer noopener">${d.link}</a></div>`
            : nothing}
          ${d.description ? html`<div class="infodesc">${d.description}</div>` : nothing}
          ${d.pdfs && d.pdfs.length
            ? html`<div class="inforow"><span class="k">${this._t('info.manuals')}</span><span class="pdflist">
                ${d.pdfs.map(
                  (p) => html`<a class="pdf" href="${safeUrl(this._display(p.url)) || '#'}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${p.name}</a>`,
                )}</span></div>`
            : nothing}
          ${controls.length
            ? html`<div class="inforow"><span class="k">${this._t('info.controls')}</span>
                <span class="ctrlstates">
                  ${controls.map((eid) => {
                    const cs = this.hass.states[eid];
                    const on = cs?.state === 'on';
                    return html`<span class="ctrlstate ${on ? 'on' : ''}">
                      <ha-icon icon=${on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}></ha-icon>
                      ${cs?.attributes?.friendly_name || eid}</span>`;
                  })}
                </span></div>`
            : nothing}
          ${!d.model && !stateTxt && !d.link && !d.description && !(d.pdfs && d.pdfs.length) && !controls.length
            ? html`<div class="infodesc muted">${this._t('info.none')}</div>`
            : nothing}
        </div>
        <div class="row infofooter" slot="footer">
          <button class="btn" @click=${() => { const dd = d; this._closeInfoCard(); this._openMarkerDialog(dd); }}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t('btn.edit')}
          </button>
          ${d.primary
            ? html`<button class="btn" @click=${() => { const p = d.primary; this._closeInfoCard(); this._openMoreInfo(p); }}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t('btn.open_in_ha')}
              </button>`
            : nothing}
          <button class="btn ghost infofooter-close" @click=${this._closeInfoCard}>${this._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

  /** Preserve absence/future fields until the user explicitly edits the badge. */
  private _markerValueBadgeFields(
    d: NonNullable<HouseplanCard['_markerDialog']>,
  ): Pick<Marker, 'value_badge'> | Record<string, never> {
    return this._editorRuntimeOrThrow()._markerValueBadgeFields(d);
  }

  /** Convert the transactional dialog state into the marker that Save would write. */
  private _markerDraft(d: NonNullable<HouseplanCard['_markerDialog']>): Marker | null {
    return this._editorRuntimeOrThrow()._markerDraft(d);
  }

  /** Runtime device for the unsaved marker, built by the production pipeline. */
  private _markerPreviewDevice(d: NonNullable<HouseplanCard['_markerDialog']>): DevItem | null {
    return this._editorRuntimeOrThrow()._markerPreviewDevice(d);
  }

  /** Preserve array identity while the dialog draft and runtime roster stay
   * unchanged, allowing light/value resolvers to reuse their WeakMap caches. */
  private _markerPreviewDevices(preview: DevItem): readonly DevItem[] {
    return this._editorRuntimeOrThrow()._markerPreviewDevices(preview);
  }

  /**
   * #357: toggle resolution belongs to the eager View card. The lazy split
   * #337 left these four methods delegating into the editor runtime, so a
   * plain tap on a cold tab (kiosk, fresh page) threw synchronously inside
   * the click handler until someone opened any editor surface. The resolver
   * chain is a pure eager module (device-toggle.ts) over card-owned state —
   * the editor runtime now delegates back here, not the other way round.
   */
  public _toggleIntent(
    device: DevItem,
    devices: readonly DevItem[] = this._devices,
  ): ResolvedToggleIntent | null {
    return resolveToggleIntent({
      hass: this._planHass,
      registryHass: this._fullRegistryHass,
      devices,
      device,
      virtualLights: this._virtualLights,
    });
  }

  private _toggleIntentForDialog(
    d: NonNullable<HouseplanCard['_markerDialog']>,
  ): ResolvedToggleIntent | null {
    return this._editorRuntimeOrThrow()._toggleIntentForDialog(d);
  }

  public _toggleStateText(entityId: string, fallback: string): string {
    const state = this._planHass?.states?.[entityId] || this.hass?.states?.[entityId];
    try {
      return state && typeof this.hass?.formatEntityState === 'function'
        ? this.hass.formatEntityState(state) : fallback;
    } catch {
      return fallback;
    }
  }

  /** Current-state copy is localized without teaching the dialog command semantics. */
  public _toggleConfirmationStateText(target: ResolvedToggleTarget): string {
    const raw = String(target.state || 'unknown');
    const formatted = target.entityId ? this._toggleStateText(target.entityId, raw) : raw;
    if (formatted.trim().toLocaleLowerCase() !== raw.trim().toLocaleLowerCase()) return formatted;
    const known: Partial<Record<string, I18nKey>> = {
      on: 'confirm.state_on',
      off: 'confirm.state_off',
      open: 'confirm.state_open',
      closed: 'confirm.state_closed',
      opening: 'confirm.state_opening',
      closing: 'confirm.state_closing',
      unknown: 'confirm.state_unknown',
    };
    const key = known[raw];
    if (key) return this._t(key);
    // A future integration-specific token stays honest and readable even in a
    // harness without HA's formatter; underscores are never exposed as UI.
    return raw.replaceAll('_', ' ').replaceAll('-', ' ');
  }

  /** Snapshot lines shown by Toggle confirmation; execution still re-resolves later. */
  public _toggleConfirmationLines(intent: ResolvedToggleIntent): string[] {
    const effectKeys: Record<Exclude<ToggleNextEffect, 'toggle'>, I18nKey> = {
      'turn-on': 'confirm.state_on',
      'turn-off': 'confirm.state_off',
      open: 'confirm.state_open',
      close: 'confirm.state_closed',
      stop: 'confirm.state_stopped',
    };
    return formatToggleConfirmation(intent, {
      state: (target) => this._toggleConfirmationStateText(target),
      current: (state) => this._t('confirm.current_state', { state }),
      expected: (state) => this._t('confirm.expected_state', { state }),
      groupCurrent: (on, total) => this._t('confirm.group_current', { on, total }),
      groupAllOn: () => this._t('confirm.group_all_on'),
      groupAllOff: () => this._t('confirm.group_all_off'),
      unavailable: (count) => this._t('confirm.unavailable_targets', { count }),
      effect: (effect) => this._t(effectKeys[effect]),
      expectedByHa: () => this._t('confirm.expected_by_ha'),
    });
  }

  private _toggleHintLines(intent: ResolvedToggleIntent | null): string[] {
    return this._editorRuntimeOrThrow()._toggleHintLines(intent);
  }

  /** One projection for the untouched select, hints and draft transitions. */
  private _effectiveStoredTapAction(
    d: NonNullable<HouseplanCard['_markerDialog']>, primaryDomain?: string,
  ): string {
    return this._editorRuntimeOrThrow()._effectiveStoredTapAction(d, primaryDomain);
  }

  private _effectiveMarkerTapAction(
    d: NonNullable<HouseplanCard['_markerDialog']>,
    preview = this._markerPreviewDevice(d),
  ): string {
    return this._editorRuntimeOrThrow()._effectiveMarkerTapAction(d, preview);
  }

  /** Store one user-triggered announcement; live HA state ticks do not mutate it. */
  private _announceToggleDraft(
    d: NonNullable<HouseplanCard['_markerDialog']>,
  ): NonNullable<HouseplanCard['_markerDialog']> {
    return this._editorRuntimeOrThrow()._announceToggleDraft(d);
  }

  private _valueBadgeForBinding(
    d: NonNullable<HouseplanCard['_markerDialog']>, binding: string,
  ): Pick<NonNullable<HouseplanCard['_markerDialog']>,
    'valueBadgeEnabled' | 'valueBadgeSource' | 'valueBadgeTouched'> {
    return this._editorRuntimeOrThrow()._valueBadgeForBinding(d, binding);
  }

  private _markerSpatialSource(d: NonNullable<HouseplanCard['_markerDialog']>) {
    return this._editorRuntimeOrThrow()._markerSpatialSource(d);
  }

  private _markerAutoHasSpatialSource(d: NonNullable<HouseplanCard['_markerDialog']>): boolean {
    return this._editorRuntimeOrThrow()._markerAutoHasSpatialSource(d);
  }

  private _setMarkerLightRole(role: 'auto' | 'always' | 'never'): void {
    return this._editorRuntimeOrThrow()._setMarkerLightRole(role);
  }

  private _controlRefInfo(ref: string): { label: string; sub: string; icon: string; warning: boolean } {
    return this._editorRuntimeOrThrow()._controlRefInfo(ref);
  }

  private _valueBadgeCandidateLabel(candidate: ValueBadgeCandidate): string {
    return this._editorRuntimeOrThrow()._valueBadgeCandidateLabel(candidate);
  }

  private _controlCandidates(d: NonNullable<HouseplanCard['_markerDialog']>): {
    value: string; label: string; sub: string; icon: string;
  }[] {
    return this._editorRuntimeOrThrow()._controlCandidates(d);
  }

  private _addControlRef(d: NonNullable<HouseplanCard['_markerDialog']>, ref: string): void {
    return this._editorRuntimeOrThrow()._addControlRef(d, ref);
  }

  /** Switch modes without losing manual drafts; entering a manual mode snapshots live values once. */
  private _setMarkerGlowMode(mode: 'auto' | 'color' | 'fixed'): void {
    return this._editorRuntimeOrThrow()._setMarkerGlowMode(mode);
  }

  private _renderMarkerDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderMarkerDialog();
  }

  private _renderSpaceDialog(): TemplateResult {
    if (this._onboardingRuntime && this._spaceDialog
        && this._spaceDialogUsesOnboardingRuntime(this._spaceDialog.mode)) {
      return this._onboardingRuntime._renderSpaceDialog();
    }
    return this._editorRuntimeOrThrow()._renderSpaceDialog();
  }

  private _renderMergeDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderMergeDialog();
  }

  /** Live sample of a room card at the given multipliers (dialog preview). */
  private _renderCardPreview(spaceScale: number, nameScale: number, labelScale: number): TemplateResult {
    const base = 18 * spaceScale;
    return html`<div class="cardpreview">
      <span class="cpname" style="font-size:${(base * nameScale).toFixed(1)}px">
        ${this._t('preview.room_name')}</span>
      <span class="cpmeta" style="font-size:${(base * 0.62 * labelScale).toFixed(1)}px">
        <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
        <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
        <ha-icon icon="mdi:lightbulb-on"></ha-icon>${this._t('roomcard.light_partial', { on: 1, total: 3 })}
      </span>
    </div>`;
  }

  /** One measurement-source control (average vs an explicit device/entity). */
  private _renderRoomSource(kind: 'temp' | 'hum'): TemplateResult {
    return this._editorRuntimeOrThrow()._renderRoomSource(kind);
  }

  private _renderRoomDialog(): TemplateResult {
    return this._editorRuntimeOrThrow()._renderRoomDialog();
  }

  static styles = [cardStyles, editorSecondaryStyles];
}

if (!customElements.get('houseplan-card')) {
  customElements.define('houseplan-card', HouseplanCard);
}

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.find((c: any) => c.type === 'houseplan-card')) {
  (window as any).customCards.push({
    type: 'houseplan-card',
    name: 'House Plan Card',
    description: 'Interactive house plan: spaces, rooms and devices with live states and drag layout.',
  });
}

// eslint-disable-next-line no-console
console.info(`%c HOUSEPLAN-CARD %c v${CARD_VERSION} `, 'background:#3ea6ff;color:#04121f;font-weight:700', '');
