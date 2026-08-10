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
    '_rszDrag',
    '_settingsDialog',
    '_tool',
  ]),
});

export const GLOW_CARD_CONTRACT = Object.freeze({
  label: 'Glow performance profiles',
  methods: Object.freeze([]),
  fields: Object.freeze([
    ...CACHE_FIELDS,
    '_devices',
    '_glowScreenBlend',
    '_loadOk',
  ]),
});
