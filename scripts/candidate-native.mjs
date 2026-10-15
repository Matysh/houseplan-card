#!/usr/bin/env node
// Native evidence is not owner field acceptance. No helper/private gesture calls here.
import { spawnSync } from 'node:child_process';
import { attestStandardLaunch, requirePinnedBrowser } from './browser-attestation.mjs';
import { candidateInputs, digest, NATIVE_PROFILES } from './candidate-readiness.mjs';
import { isMainModule } from './spawn-portable.mjs';
export const NATIVE_CHECK_FLOORS = Object.freeze({
  'demo/smoke_wallthick_standalone.mjs': ['911 AC1 room public click opens dialog',
    '911 AC1 partition target band persists away from pointer',
    '911 AC1 room input draft and neighbour hover retain current physical target',
    '911 AC2 room held dialog drag retains one physical band', '911 AC2 room held pan follows physical wall',
    '911 AC2 partition zoom really changed camera', '911 AC2 partition complete config layout history and wire unchanged',
    '911 AC4 floor switch clears selected indication', '911 AC4 partition Undo restores full source config',
    '911 AC4 remount kiosk=true cannot revive selected wall'],
  'demo/smoke_canvas_surface_gestures.mjs': ['AC1 native selection replaces all text',
    'AC2 corner follows held pointer 1:1', 'AC2 pointercancel retains last position and retires owner',
    'AC3 clamp 1', 'AC4 moved held pan keeps screen rect',
    'AC5 wheel .wallthick-dlg input keeps camera and value',
    'AC6 Escape retires capture without write or history', 'AC6 Enter wire contains entered centimetres',
    'AC7 LED pointer .led-picker cannot navigate', 'AC8 View surface contact never becomes scene second finger',
    'AC9 future input selects without scene navigation', 'AC9 decor tray keeps scene fixed'],
  'demo/smoke_physical_body_characterization.mjs': ['acceptedGestureOneHistoryAndWrite',
    'physicalRenderRouteOneZeroOne', 'partitionGridAndRigidOpening', 'columnRotationFiveDegreeStep',
    'columnShiftRotationIsFree', 'realOverlappingBodyCycle', 'duplicateColumnRefusedWithoutWriteOrHistory',
    'jitterBelowFivePixelsPreservesDoubleTapDialog', 'nativeUndoCancelsHeldBodyWithoutHistoryOrWrite'],
  'demo/smoke_backdrop.mjs': ['backdrop_body_down_one_full_render', 'backdrop_body_down_grabbing',
    'backdrop_body_twelve_moves_have_live_paint', 'backdrop_body_twelve_moves_zero_full_renders',
    'backdrop_body_up_one_full_render', 'backdrop_body_up_not_grabbing',
    'backdrop_edge_move_viewbox_frozen', 'backdrop_edge_release_frame_catches_up',
    'backdrop_rotate_handle_snaps_five_degrees', 'backdrop_rotate_shift_preserves_free_angle',
    'reset_clears_the_fields'],
  'demo/smoke_partition_openings_preview.mjs': ['canonicalFixturePaintsDoorWindowAndStaticOther',
    'heldPreviewNeverWritesConfigOrHistory', 'nativeEscapeRollsBackAndLateRealUpCannotCommit',
    'nativeUndoRestoresTheWholeHostOpeningTransaction', 'physicalRenderRouteOneZeroOne',
    'releaseKeepsRigidHostAndOpeningsInOneHistoryAndWrite', 'repeatedDragAndActiveUndoLeaveNoGhostOrWrite',
    'staticOtherAndPaintedSettingsStayUnchanged', 'trustedSamePointerCancelRestoresWithoutConfigHistoryOrGhost',
    'twoDistinctHeldTargetsFollowExactDeltaWithOneVisibleCopy'],
  'demo/smoke_wall_node_move.mjs': ['committed geometry equals the visible preview', 'Undo restores exact starting catalogue/openings',
    'Esc and trailing move/up create no writes', 'invalid last release never saves the older valid candidate',
    'raster: original affected wall is a translucent source ghost', 'native node movement keeps the frozen camera'],
  'demo/smoke_live_pan_coverage.mjs': ['flatMouseRightEdgeHeldCoverage', 'flatTouchZoomOutHeldCoverage',
    'isoTouchZoomOutHeldCoverage', 'isoMouseRightEdgeMarkerParity', 'kioskTouchRightEdgeHeldCoverage', 'stablePromotionCleansAtTerminal'],
});
export function judgeNativeOutput(script, result) {
  const text = result.stdout || '';
  if (result.error || result.status !== 0 || !/^OK\s*$/m.test(text)) return { pass: false, reason: 'failed/incomplete/timeout native process' };
  if (script.endsWith('smoke_wall_node_topology.mjs')) {
    if (!/"cycles":\s*100/.test(text) || !/"scenarios":\s*[1-9]\d*/.test(text)) return { pass: false, reason: 'topology cycle oracle missing' };
    return { pass: true, observed: 'native T/X scenarios and 100 Esc/Undo cycles completed' };
  }
  const line = text.split('\n').find(l => l.startsWith('HP_SMOKE_CHECKS '));
  let checks;
  try { checks = JSON.parse(line?.slice(16)); } catch { return { pass: false, reason: 'observable check inventory missing' }; }
  const ordinary = NATIVE_CHECK_FLOORS[script];
  if (!ordinary || !Array.isArray(checks) || ordinary.some(name => !checks.includes(name))) return { pass: false, reason: 'ordinary/risky-neighbour oracle missing' };
  return { pass: true, observed: checks.join('; ') };
}
export async function runCandidateNative({ input = candidateInputs(), profiles = Object.keys(NATIVE_PROFILES), execute = spawnSync,
  attest = attestStandardLaunch, root = process.cwd() } = {}) {
  if (!profiles.length || profiles.some(p => !NATIVE_PROFILES[p])) throw Error('known native profiles required');
  const environment = await attest({ reason: '#858 candidate-native' });
  const scripts = [...new Set(profiles.flatMap(p => NATIVE_PROFILES[p].map(c => c.script)))];
  const outputs = new Map(scripts.map(script => {
    const result = execute(process.execPath, ['scripts/candidate-native.mjs', `--script=${script}`], { cwd: root, env: { ...process.env, HP_SMOKE_CHECKS: '1' },
      encoding: 'utf8', timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
    return [script, { ...judgeNativeOutput(script, result), script, scriptHash: input.scripts[script],
      nativeOutput: digest((result.stdout || '') + (result.stderr || '')), stdout: result.stdout, stderr: result.stderr }];
  }));
  const cases = profiles.flatMap(p => NATIVE_PROFILES[p]).map(c => ({ id: c.id, oracle: c.oracle, ...outputs.get(c.script) }));
  return { schema: 1, sha: input.sha, tree: input.tree, bundle: input.manifest, pins: input.pins,
    environment: { node: process.version, platform: process.platform, arch: process.arch, browser: environment.actual },
    cases, pass: cases.every(c => c.pass), ownerAcceptance: false };
}
if (isMainModule(import.meta.url)) {
  try {
    const script = process.argv.find(a => a.startsWith('--script='))?.slice(9);
    if (script) {
      if (!Object.values(NATIVE_PROFILES).flat().some(c => c.script === script)) throw Error('unknown native script');
      requirePinnedBrowser('#858 candidate native scene');
      await import(new URL(`../${script}`, import.meta.url));
    } else {
    const profiles = process.argv.find(a => a.startsWith('--profiles='))?.slice(11).split(',');
    const result = await runCandidateNative({ ...(profiles ? { profiles } : {}) });
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
    }
  } catch (error) { console.error(String(error?.message || error)); process.exitCode = 1; }
}
