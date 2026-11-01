import { BETA_GOLDEN, BETA_PANEL_GOLDEN, BETA_LOVELACE_GOLDEN,
  PANEL_GOLDEN_SOURCES, selectExact } from './selections.mjs';

/** Draft matrix only: the active demo matrix and reviewed PNGs are untouched. */
export function prepareGoldenSelection(candidates) {
  const sources = selectExact(candidates, PANEL_GOLDEN_SOURCES.map(id => ({ id })), scene => scene.id);
  const lovelace = selectExact(candidates, BETA_LOVELACE_GOLDEN.map(id => ({ id })), scene => scene.id);
  if (lovelace.some(scene => scene.panelHost)) throw Error('Lovelace selection must use the card host');
  const variants = [];
  const replaced = new Set();
  for (const [index, source] of sources.entries()) {
    const id = BETA_PANEL_GOLDEN[index];
    if (source.id === id) {
      if (!source.panelHost) throw Error(`Expected panel host: ${id}`);
      continue;
    }
    if (candidates.some(scene => scene.id === id)) throw Error(`Panel scene ID already exists: ${id}`);
    variants.push({ ...source, id, panelHost: true, sourceSceneId: source.id });
    replaced.add(source.id);
  }
  // Replace the old host variant in stable too; do not run both whole matrices.
  const all = [...candidates.filter(scene => !replaced.has(scene.id)), ...variants];
  if (new Set(all.map(scene => scene.id)).size !== all.length) throw Error('Duplicate golden scene ID');
  const beta = selectExact(all, BETA_GOLDEN.map(id => ({ id })), scene => scene.id);
  const betaIds = new Set(BETA_GOLDEN);
  return { beta, rest: all.filter(scene => !betaIds.has(scene.id)), all };
}
