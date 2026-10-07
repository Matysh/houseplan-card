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
    '_buildModel',
    '_cancelDecorGesture',
    '_checkSpacePhysicalGeometry',
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
    '_viewOr',
  ]),
  fields: Object.freeze([
    '_booting',
    '_bootSoft',
    '_cameraTransition',
    '_cfgEpoch',
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
    '_space',
    '_settingsDialog',
    '_tool',
  ]),
  // A comparison SHA before #89 is intentionally flat; the isometric runner
  // checks these members only when the target source tree supports Stage 1.
  optionalFields: Object.freeze([
    '_activeWallChainId', '_activeWallChainPartitionIds', '_wallChainSegmentCms',
    '_effectiveProjection', '_ensureIsoSceneRuntime',
    '_isoGeometryCache', '_isoStructuralBuildCount', '_offerWallFaces',
    '_liveEditorPaintCount', '_onLabsSnapshot',
    '_planSnapGeometryCache', '_roomDialog', '_syncVolumetricSetting', '_wallFaceBatch',
    '_wallFaceGraphCache',
    // #744: the #735 switch-cycle guard counts the union pool and the inner
    // contours; a comparison bundle without them reads 0.
    '_wallUnionPool', '_innerContourCache',
    // #769: the #735 guard judges these build counters; a base without them reads null.
    '_floorCacheBuilds',
  ]),
  // #649: members that only comparison bundles own. The benchmark feature-probes
  // them (`typeof card._setProjection === 'function'`); the current card no
  // longer has them, so they are declared but never required.
  legacyOnlyFields: Object.freeze(['_setProjection']),
  // #778: the resize Long Task attribution wraps the session controller's
  // `move` (with its `project`/`publish`/`measure` callbacks) for the time of
  // one editor part. Optional: a base without it (v1.68.1 keeps `_rszDrag`)
  // or with another callback shape reports `resizeLongTask.supported: false`
  // and a reason, never zero shares. A present member must be a function.
  optionalMethodsOf: Object.freeze({ _resize: Object.freeze(['move']) }),
  // #380: v1.68.1 owns the same resize session directly on the card; newer
  // bundles moved it into ResizeController. A comparison target must expose
  // one of the two explicit shapes; the current member retains its object
  // type check and is also verified against current production source.
  // #500 replaced the private structural adoption with a gated public entry
  // point. The boot diagnostics (#520) count adoptions through whichever of
  // the two the measured bundle owns; an undeclared rename would silently
  // report zero adoptions instead of failing.
  fieldAlternatives: Object.freeze([
    Object.freeze({ current: '_resize', legacy: '_rszDrag' }),
    Object.freeze({ current: '_adoptAuthoritative', legacy: '_adoptStructuralResponses' }),
  ]),
  fieldTypes: Object.freeze({
    _adoptAuthoritative: 'function',
    _booting: 'boolean',
    _bootSoft: 'boolean',
    _cameraTransition: 'object',
    _cfgEpoch: 'number',
    _cleanFloorCache: 'map',
    _devices: 'array',
    _continuity: 'object',
    _decorList: 'array',
    _decorTool: 'string',
    _activeWallChainPartitionIds: 'array',
    _wallChainSegmentCms: 'array',
    _effectiveProjection: 'function',
    _ensureIsoSceneRuntime: 'function',
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
    _isoStructuralBuildCount: 'number',
    _innerContourCache: 'map',
    _planSnapGeometryCache: 'object',
    _roomDialog: 'boolean',
    _resize: 'object',
    _syncVolumetricSetting: 'function',
    _serverCfg: 'object',
    _space: 'string',
    _tool: 'string',
    _wallFaceGraphCache: 'array',
    _wallUnionPool: 'map',
    _floorCacheBuilds: 'object',
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

/**
 * The 2.5D candidate contract of the large-house runner, shared by every 2.5D
 * profile: `large-house-isometric-v1`, its Stage 3 dense twin and the backdrop
 * twin (#743). The error names the profile being measured (#770); it used to
 * name the historical profile whichever one failed. `labs-hook` is the
 * pre-#448 activation path, checked before the first `hass`; `renderer` runs
 * after the lazy renderer has loaded. Self-contained like
 * `assertCardContract`: the runner serializes it with `toString()`.
 */
export function assertIsometricCandidate(card, profile, stage) {
  if (stage === 'labs-hook') {
    if (typeof card._onLabsSnapshot !== 'function')
      throw new Error(`${profile} candidate has no Labs fixture hook`);
    return;
  }
  if (stage !== 'renderer') throw new Error(`unknown 2.5D contract stage: ${stage}`);
  if (typeof card._effectiveProjection !== 'function' || !(card._isoGeometryCache instanceof Map))
    throw new Error(`${profile} candidate has no renderer contract`);
}

/** Single fail-fast implementation injected into both browser runners. Keep
 * this function self-contained: runners serialize it with `toString()`. */
export function assertCardContract(card, contract, profile = contract.label) {
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
  for (const [owner, names] of Object.entries(contract.optionalMethodsOf || {})) {
    const target = card[owner];
    if (!target || typeof target !== 'object') continue;
    for (const name of names) {
      if (name in target && typeof target[name] !== 'function') invalidFields.push(`${owner}.${name}:function`);
    }
  }
  const missing = [...missingMethods, ...missingFields, ...missingAlternatives];
  if (missing.length || invalidFields.length) {
    const details = [
      missing.length ? `missing private API: ${missing.join(', ')}` : '',
      invalidFields.length ? `invalid private API types: ${invalidFields.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(
      `${profile} harness is incompatible with this houseplan-card bundle; ${details}. `
      + 'Update the explicit candidate/base compatibility contract before profiling.',
    );
  }
}

/** The runner's CLI plan, including discarded samples (negative sample IDs). */
export function planLargeHouseIterations({ samples: sampleArg, warmups: warmupArg } = {}) {
  const samples = Math.max(1, Math.min(20, Number(sampleArg) || 7));
  // Change only the explicit CLI zero; retain defaults, clamping and fractions.
  const warmups = Math.max(0, Math.min(5, Number(warmupArg) || (warmupArg === '0' ? 0 : 1)));
  const iterations = [];
  for (let iteration = 0; iteration < warmups + samples; iteration++) {
    iterations.push(iteration - warmups);
  }
  return { samples, warmups, iterations };
}

/** Self-contained for serialization into the measured browser page. */
export function installEpochDiagnostics(card, captureStack) {
  const diag = card.__diag;
  diag.epochChanges = 0;
  diag.epochStackCaptures = 0;
  diag.epochTracesDropped = 0;
  diag.epochTracesLimit = 8;
  let epoch = 0;
  Object.defineProperty(card, '_cfgEpoch', {
    configurable: true,
    get: () => epoch,
    set: (next) => {
      if (next !== epoch) {
        diag.epochChanges += 1;
        if (diag.epochs.length < diag.epochTracesLimit) {
          diag.epochStackCaptures += 1;
          const stack = captureStack ? captureStack() : (new Error().stack || '');
          const frames = stack.split('\n').slice(1, 4)
            .map((line) => line.trim().replace(/^at\s+/, '').replace(/\s*\(.*$/, ''));
          diag.epochs.push(`${epoch}->${next}@${frames.join('<')}`);
        } else diag.epochTracesDropped += 1;
      }
      epoch = next;
    },
  });
}
