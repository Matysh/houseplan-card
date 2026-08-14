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
    '_openSettingsDialog',
    '_pickSpace',
    '_rszCancelDrag',
    '_rszEdgeDown',
    '_rszMove',
    '_rszRooms',
    '_setMode',
    '_viewOr',
  ]),
  fields: Object.freeze([
    '_booting',
    ...CACHE_FIELDS,
    '_devices',
    '_gridPitch',
    '_loadOk',
    '_model',
    '_path',
    '_rszDrag',
    '_serverCfg',
    '_settingsDialog',
    '_tool',
  ]),
  // A comparison SHA before #89 is intentionally flat; the isometric runner
  // checks these two members only when the target source tree supports Stage 1.
  optionalFields: Object.freeze(['_isoGeometryCache', '_planSnapGeometryCache', '_setProjection']),
  fieldTypes: Object.freeze({
    _booting: 'boolean',
    _cleanFloorCache: 'map',
    _devices: 'array',
    _glowClipCache: 'map',
    _gridPitch: 'number',
    _loadOk: 'boolean',
    _model: 'array',
    _path: 'array',
    _isoGeometryCache: 'map',
    _planSnapGeometryCache: 'object',
    _setProjection: 'function',
    _serverCfg: 'object',
    _tool: 'string',
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
  const invalidFields = [...contract.fields, ...(contract.optionalFields || [])]
    .filter((name) => name in card && contract.fieldTypes?.[name]
      && !matches(card[name], contract.fieldTypes[name]))
    .map((name) => `${name}:${contract.fieldTypes[name]}`);
  const missing = [...missingMethods, ...missingFields];
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
