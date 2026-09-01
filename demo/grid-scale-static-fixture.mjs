/**
 * Build the exact snapshot consumed by the static-card half of the grid-scale
 * smoke. The main and static cards normally load through different stores; a
 * comparative fixture must therefore hand the static card one atomic
 * config+layout pair instead of mixing the demo backend config with the main
 * card's temporary layout.
 */
export function coherentGridScaleStaticPatch({ config, layout, revision }) {
  if (!config || typeof config !== 'object' || !Array.isArray(config.spaces)) {
    throw new Error('grid-scale static fixture requires a complete config');
  }
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    throw new Error('grid-scale static fixture requires a complete layout');
  }
  const token = Number.isFinite(revision) ? revision : 0;
  return {
    config: structuredClone(config),
    configFingerprint: `grid-scale-fixture:${token}:config`,
    layout: structuredClone(layout),
    layoutFingerprint: `grid-scale-fixture:${token}:layout`,
  };
}
