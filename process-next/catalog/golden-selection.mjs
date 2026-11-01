import { BETA_GOLDEN, BETA_PANEL_GOLDEN, BETA_LOVELACE_GOLDEN,
  PANEL_GOLDEN_SOURCES, selectExact } from './selections.mjs';

/** Canonical matrix selection; reviewed PNGs are changed only by explicit acceptance. */
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

/** Existing fixture helpers key some semantic checks/repaint by the source ID.
 * Report and baseline identity remain the distinct panel ID, never this alias. */
export const goldenHarnessScenario = scene => scene.sourceSceneId
  ? { ...scene, id: scene.sourceSceneId } : scene;

/** A selected diagnostic/verification run uses the same scenes as the release sets. */
export function goldenRunSelection(candidates, argv = []) {
  const value = name => argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  for (const arg of argv) if (!['--mode=', '--selection=', '--scenario='].some(prefix => arg.startsWith(prefix)))
    throw Error(`Unknown golden argument: ${arg}`);
  const mode = value('mode') ?? 'verify', selection = value('selection') ?? 'all', scenario = value('scenario');
  if (!['capture', 'verify'].includes(mode)) throw Error(`Unknown golden mode: ${mode}`);
  if (!['beta', 'rest', 'all'].includes(selection)) throw Error('Expected --selection=beta|rest|all');
  const available = prepareGoldenSelection(candidates)[selection];
  const scenarios = scenario ? available.filter(item => item.id === scenario) : available;
  if (!scenarios.length) throw Error(`Unknown or empty golden selection: ${scenario ?? selection}`);
  return { mode, selection, scenario, scenarios };
}
