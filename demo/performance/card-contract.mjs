/**
 * Private houseplan-card surface consumed by the performance runners.
 *
 * The candidate runner profiles both the candidate bundle and a bundle built
 * from the comparison SHA. Keep these lists explicit so a private rename in
 * either tree fails before measurements instead of silently reporting zeroes.
 */
const CACHE_FIELDS = Object.freeze([
  '_cleanFloorCache',
  '_glowClipCache',
  '_wallUnionCache',
  '_openingTunnelCache',
  '_openingWallIndexCache',
]);

export const LARGE_HOUSE_CARD_CONTRACT = Object.freeze({
  label: 'large-house-v1',
  methods: Object.freeze([
    '_baseVb',
    '_bindingStatus',
    '_cancelDecorGesture',
    '_decorBoxOf',
    '_dtMeasure',
    '_dtMove',
    '_dtStart',
    '_openSettingsDialog',
    '_pickSpace',
    '_pos',
    '_renderBody',
    '_rszCancelDrag',
    '_rszEdgeDown',
    '_rszMove',
    '_rszRooms',
    '_setMode',
    '_scenePoint',
    '_viewOr',
  ]),
  fields: Object.freeze([
    '_booting',
    '_bootSoft',
    '_cameraTransition',
    ...CACHE_FIELDS,
    '_continuity',
    '_cursorPt',
    '_decorList',
    '_decorSel',
    '_decorTool',
    '_devices',
    '_gridPitch',
    '_hassSequence',
    '_loadOk',
    '_model',
    '_modeTransitionBusy',
    '_path',
    '_serverCfg',
    '_settingsDialog',
    '_tool',
  ]),
  // A comparison SHA before #89 is intentionally flat; the isometric runner
  // checks these members only when the target source tree supports Stage 1.
  optionalFields: Object.freeze([
    '_activeDraftId', '_draftSegmentCms', '_isoGeometryCache', '_offerWallFaces',
    '_liveEditorPaintCount', '_onLabsSnapshot', '_planSnapGeometryCache', '_roomDialog', '_setProjection',
    '_wallFaceBatch', '_wallFaceGraphCache',
  ]),
  // #380: v1.68.1 owns the same resize session directly on the card; newer
  // bundles moved it into ResizeController. A comparison target must expose
  // one of the two explicit shapes; the current member retains its object
  // type check and is also verified against current production source.
  fieldAlternatives: Object.freeze([
    Object.freeze({ current: '_resize', legacy: '_rszDrag' }),
  ]),
  fieldTypes: Object.freeze({
    _booting: 'boolean',
    _bootSoft: 'boolean',
    _cameraTransition: 'object',
    _cleanFloorCache: 'map',
    _devices: 'array',
    _continuity: 'object',
    _decorList: 'array',
    _decorTool: 'string',
    _draftSegmentCms: 'array',
    _glowClipCache: 'map',
    _gridPitch: 'number',
    _hassSequence: 'number',
    _loadOk: 'boolean',
    _liveEditorPaintCount: 'number',
    _model: 'array',
    _onLabsSnapshot: 'function',
    _offerWallFaces: 'function',
    _path: 'array',
    _isoGeometryCache: 'map',
    _planSnapGeometryCache: 'object',
    _roomDialog: 'boolean',
    _resize: 'object',
    _setProjection: 'function',
    _serverCfg: 'object',
    _tool: 'string',
    _wallFaceGraphCache: 'array',
  }),
});

export const GLOW_CARD_CONTRACT = Object.freeze({
  label: 'Glow performance profiles',
  methods: Object.freeze([]),
  fields: Object.freeze([
    ...CACHE_FIELDS,
    '_devices',
    '_loadOk',
  ]),
  // Additive blending was introduced after the first supported performance
  // bases. Its absence is safe: the runner keeps the historical normal blend.
  optionalFields: Object.freeze(['_glowScreenBlend']),
  fieldTypes: Object.freeze({
    _cleanFloorCache: 'map',
    _devices: 'array',
    _glowClipCache: 'map',
    _glowScreenBlend: 'boolean',
    _loadOk: 'boolean',
  }),
});

export const SPACE_GLOW_CARD_CONTRACT = Object.freeze({
  label: 'Static-card Glow performance profiles',
  methods: Object.freeze([]),
  fields: Object.freeze(['_devices', '_loading', '_snap']),
  optionalFields: Object.freeze(['_glowRuntimeState', '_glowScreenBlend']),
  fieldTypes: Object.freeze({
    _devices: 'array',
    _loading: 'boolean',
    _glowRuntimeState: 'object',
    _glowScreenBlend: 'boolean',
  }),
});

/** Single fail-fast implementation injected into both browser runners. Keep
 * this function self-contained: runners serialize it with `toString()`. */
export function assertCardContract(card, contract) {
  const matches = (value, expected) => {
    if (expected === 'array') return Array.isArray(value);
    if (expected === 'map') return value instanceof Map;
    return typeof value === expected;
  };
  const missingMethods = contract.methods
    .filter((name) => typeof card[name] !== 'function')
    .map((name) => `${name}()`);
  const missingFields = contract.fields
    .filter((name) => !(name in card) || card[name] === undefined);
  const missingAlternatives = (contract.fieldAlternatives || [])
    .filter((choice) => !Object.values(choice)
      .some((name) => name in card && card[name] !== undefined))
    .map((choice) => Object.values(choice).join('|'));
  const alternativeFields = (contract.fieldAlternatives || [])
    .flatMap((choice) => Object.values(choice));
  const invalidFields = [
    ...contract.fields, ...(contract.optionalFields || []), ...alternativeFields,
  ]
    .filter((name) => name in card && contract.fieldTypes?.[name]
      && !matches(card[name], contract.fieldTypes[name]))
    .map((name) => `${name}:${contract.fieldTypes[name]}`);
  const missing = [...missingMethods, ...missingFields, ...missingAlternatives];
  if (missing.length || invalidFields.length) {
    const details = [
      missing.length ? `missing private API: ${missing.join(', ')}` : '',
      invalidFields.length ? `invalid private API types: ${invalidFields.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(
      `${contract.label} harness is incompatible with this houseplan-card bundle; ${details}. `
      + 'Update the explicit candidate/base compatibility contract before profiling.',
    );
  }
}
