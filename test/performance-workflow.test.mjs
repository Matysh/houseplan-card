import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import {
  ISOMETRIC_STAGE3_DENSE_PROFILE,
  makeIsometricStage3DenseFixture,
} from '../demo/performance/isometric-stage3-dense-fixture.mjs';

const readWorkflow = (name) => readFileSync(
  new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8',
);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('ordinary Validate keeps only the bounded candidate performance smoke', () => {
  const workflow = readWorkflow('validate.yml');
  for (const contract of [
    'performance_smoke:',
    '--variants=60 --samples=3 --warmups=1',
    '--absolute-only',
    'budgets-glow-smoke.json',
    'budgets-space-glow-smoke.json',
    'cancel-in-progress: true',
  ]) assert.ok(workflow.includes(contract), `missing fast-gate contract: ${contract}`);
  assert.ok(!workflow.includes('Capture base and candidate profiles'));
  assert.ok(!workflow.includes('schedule:'));
});

test('full performance is isolated to stable, scheduled and manual entry points', () => {
  const workflow = readWorkflow('performance.yml');
  for (const contract of [
    'name: Полные бенчмарки производительности',
    'branches:',
    '- main',
    'paths-ignore:',
    '- ".github/workflows/**"',
    '- "docs/**"',
    'schedule:',
    'workflow_dispatch:',
    'Capture base and candidate profile',
    'profile:',
    '- large-house',
    '- isometric',
    '- isometric-backdrop',
    '- isometric-stage3',
    '- plan-snap',
    '- interaction',
    '- blend',
    '- overlay',
    '- space-default',
    '- space-glow',
    '- led-strips',
    'PROFILE: ${{ matrix.profile }}',
    'name: full-performance-${{ matrix.profile }}',
    '--samples=7 --warmups=1',
  ]) assert.ok(workflow.includes(contract), `missing full-gate contract: ${contract}`);

  assert.ok(workflow.includes('if [ -f baseline/scripts/bundle-sync.mjs ]; then'));
  // #780: led-strips-v1 runs three candidate-only sizes judged by absolute limits.
  assert.equal((workflow.match(/--samples=7 --warmups=1/g) || []).length, 23);
  for (const size of ['10x5', '50x50', 'none']) {
    assert.ok(workflow.includes(`npm run benchmark:led-strips -- --size=${size} --samples=7 --warmups=1`), size);
  }
  assert.equal((workflow.match(/--allow-stage2-base/g) || []).length, 1,
    'only the Stage 3 comparison base may bypass the candidate-only DOM contract');
  assert.ok(workflow.includes('budgets-isometric-stage3-dense.json'));
  assert.ok(workflow.includes('budgets-large-house-isometric-backdrop.json'));
  assert.equal((workflow.match(/--baseline-sha=/g) || []).length, 3);
  assert.equal((workflow.match(/--candidate-sha=/g) || []).length, 3);

  const release = readWorkflow('release.yml');
  // #540: признак стабильного — тег кандидата, не поле события: тот же гейт
  // работает и по `workflow_dispatch`, где события нет.
  assert.ok(release.includes("if: ${{ needs.candidate.outputs.prerelease != 'true' }}"));
  assert.ok(release.includes('--workflow=performance.yml --label="Полные бенчмарки производительности"'));
  assert.ok(release.includes('test -s dist/houseplan-panel.js'));
  assert.ok(release.includes('cp dist/houseplan-card.js houseplan.zip release-assets/'),
    'the standalone release asset remains card-only; the panel ships through HACS zip');
  assert.ok(!release.includes('softprops/action-gh-release'), 'one upload path (gh release upload into the draft), not two');
});

test('#160 Stage 3 dense fixture extends rather than mutates the historical witness', () => {
  const historical = makeLargeHouseFixture();
  const historicalSnapshot = structuredClone(historical);
  const dense = makeIsometricStage3DenseFixture();

  assert.equal(ISOMETRIC_STAGE3_DENSE_PROFILE, 'isometric-stage3-dense-v1');
  assert.deepEqual(historical, historicalSnapshot);
  assert.deepEqual(makeLargeHouseFixture(), historicalSnapshot);
  assert.equal(dense.counts.devices, 200);
  assert.equal(dense.counts.denseMarkers, 200);
  assert.ok(dense.counts.decoratedMarkers > 0);
  assert.equal(dense.counts.boundOpenings, dense.counts.floors * 3);
  assert.ok(dense.config.markers.some((marker) => marker.display === 'value'));
  assert.ok(dense.config.markers.some((marker) => marker.value_badge?.enabled));
  assert.equal(Object.keys(dense.stage3Dense.pulseDeviceIdsBySpace).length,
    dense.config.spaces.length);
  assert.ok(dense.stage3Dense.decoratedDeviceIds
    .some((id) => dense.config.settings.new_device_ids.includes(id)));
  assert.deepEqual(dense.stage3Dense.expectedOpeningKinds, ['door', 'window', 'gate']);
  assert.ok(Object.values(dense.states).some((state) => Number.isFinite(state.attributes?.lqi)));
  for (const space of dense.config.spaces) {
    const pulseDeviceId = dense.stage3Dense.pulseDeviceIdsBySpace[space.id];
    assert.equal(dense.layout[pulseDeviceId]?.s, space.id);
    assert.equal(dense.config.markers.find((marker) => marker.id === pulseDeviceId)
      ?.display, 'icon_ripple');
    const pulseEntity = Object.values(dense.entities)
      .find((entity) => entity.device_id === pulseDeviceId);
    assert.match(pulseEntity?.entity_id || '', /^fan\./);
    assert.equal(dense.states[pulseEntity.entity_id]?.state, 'on');
    assert.ok(dense.config.settings.new_device_ids
      .some((id) => dense.layout[id]?.s === space.id), `${space.id} lacks new-device facet`);
    for (const setting of ['label_temp', 'label_hum', 'label_lqi', 'label_light'])
      assert.equal(space.settings[setting], true, `${space.id} lacks ${setting}`);
    assert.ok(space.openings.some((opening) => opening.type === 'window' && opening.contact));
    assert.ok(space.openings.some((opening) => opening.type === 'door'
      && opening.contact && opening.lock));
    assert.ok(space.openings.some((opening) => opening.type === 'gate'
      && opening.contact && opening.lock));
  }
});

test('#160 Stage 3 budget preserves every historical common ceiling', () => {
  const historical = readJson('../demo/performance/budgets-large-house-isometric.json');
  const dense = readJson('../demo/performance/budgets-isometric-stage3-dense.json');
  assert.equal(dense.profile, ISOMETRIC_STAGE3_DENSE_PROFILE);
  for (const [metric, budget] of Object.entries(historical.timings))
    assert.deepEqual(dense.timings[metric], budget, `changed historical limit for ${metric}`);
  for (const key of ['longTasks', 'heap', 'cacheEntries', 'cacheGrowth', 'renderedDevices'])
    assert.deepEqual(dense[key], historical[key], `changed historical ${key} contract`);
  for (const metric of ['openingUpdateMs', 'overlayInteractionMs']) {
    assert.equal(dense.timings[metric].maxRegressionRatio, 0.2);
    assert.ok(dense.timings[metric].noiseAllowanceMs
      <= historical.timings.stateUpdateMs.noiseAllowanceMs);
    assert.ok(dense.timings[metric].hardMaxMs <= historical.timings.stateUpdateMs.hardMaxMs);
  }
});

test('#743 backdrop budget is the historical isometric budget under its own profile id', () => {
  // A new fixture meaning gets a new id (README, "Changing budgets"); the twin
  // shares every ceiling with large-house-isometric-v1, as #160 does.
  const historical = readJson('../demo/performance/budgets-large-house-isometric.json');
  const backdrop = readJson('../demo/performance/budgets-large-house-isometric-backdrop.json');
  assert.equal(backdrop.profile, 'large-house-isometric-backdrop-v1');
  assert.deepEqual({ ...backdrop, profile: historical.profile }, historical,
    'the twin differs from the historical isometric budget only in profile');
  assert.equal('viewToggleMs' in backdrop.timings, false, '#720: the toggle is reported, not budgeted');
  const workflow = readWorkflow('performance.yml');
  const capture = workflow.slice(workflow.indexOf('            isometric-backdrop)'));
  assert.match(capture,
    /^ {12}isometric-backdrop\)\n {14}npm run benchmark:large-house-isometric-backdrop -- --target-root=\.\.\/baseline --samples=7 --warmups=1 [^\n]+\n {14}npm run benchmark:large-house-isometric-backdrop -- --target-root=\. --samples=7 --warmups=1 /,
    'base and candidate are captured by the same runner, base first');
  assert.match(workflow,
    /--budgets=demo\/performance\/budgets-large-house-isometric-backdrop\.json [^\n]*--baseline-sha="[^\n]*--candidate-sha="/,
    'the comparison pins both exact SHAs, as the isometric profile does');
  const pkg = readJson('../package.json');
  assert.equal(pkg.scripts['benchmark:large-house-isometric-backdrop'],
    'node demo/benchmark_large_house.mjs --profile=large-house-isometric-backdrop-v1');
});

test('#743 backdrop profile walks the imagePlan path and probes update passes after the #735 guard', () => {
  const runner = readFileSync(new URL('../demo/benchmark_large_house.mjs', import.meta.url), 'utf8');
  assert.match(runner, /const isometric = [^;\n]*\|\| backdrop;/,
    'the backdrop twin runs every 2.5D window of large-house-isometric-v1');
  assert.match(runner,
    /space\.plan_url = `\/assets\/f1\.svg\?\$\{space\.id\}`;\s*space\.plan_aspect = 1;/,
    'every floor gets the shipped picture under a URL of its own over the whole plan square');
  assert.match(runner, /backdrops: fixture\.config\.spaces\.length/);
  assert.match(runner,
    /if \(backdrop && !card\.renderRoot\.querySelector\('\.stage svg image\.hp-backdrop'\)\)\s*throw new Error\(`\$\{profile\} rendered no backdrop image`\);\s*const firstStableRenderMs/,
    'a stable frame without the backdrop layer fails the sample (docs/TESTING.md rule 3)');
  const cycleStart = runner.indexOf('const switchCycle = await duration(');
  const guard = runner.indexOf('switchCycle built a floor inside the window', cycleStart);
  const probe = runner.indexOf('const floorSwitchPasses = [];', cycleStart);
  const gc = runner.indexOf('await forceGc();', cycleStart);
  assert.ok(cycleStart > 0 && guard > cycleStart && probe > guard && gc > probe,
    'the probe follows the switchCycle window and its #735 guard and precedes forced GC');
  const probeBody = runner.slice(probe, gc);
  assert.ok(!probeBody.includes('duration(') && !probeBody.includes('startLongTaskWindow('),
    'the probe stays outside every timed and Long Task window');
  assert.match(probeBody,
    /for \(let index = 0; index < 6; index\+\+\) \{\s*const passesBefore = card\.__diag\.updates;\s*card\._pickSpace\(`perf-floor-\$\{\(index % fixture\.counts\.floors\) \+ 1\}`\);\s*for \(let wait = 0; wait < 20 && !\(await card\.updateComplete\); wait\+\+\);\s*floorSwitchPasses\.push\(card\.__diag\.updates - passesBefore\);/,
    'six warm switches, each counted until updateComplete reports quiescence');
  assert.match(runner,
    /\.\.\.\(backdrop \? \{ floorSwitchPasses: \{ supported: true, perSwitch: floorSwitchPasses \} \} : \{\}\)/,
    'only the backdrop profile reports the passes');
});

test('#570 current Stage 4 runner fails closed on the agreed observable DOM contract', () => {
  const runner = readFileSync(new URL('../demo/benchmark_large_house.mjs', import.meta.url), 'utf8');
  for (const contract of [
    'data-hp-iso-stage',
    'data-hp-iso-structural-builds',
    'data-hp-iso-overlay-kind',
    'data-hp-iso-raised',
    'data-hp-iso-nudged',
    'data-hp-iso-material-def',
    'totalRootsByKind',
    'stage3RootsByKind',
    'openingSurfaceCounts',
    'facetCounts',
    'definitionCounts',
    'no shared texture pattern',
    'no shared shadow filter',
    'no observable',
    'Stage 4 roots',
    'opening surfaces',
    'entered Flat fallback',
    'structural build counter is absent',
    'raised overlay nudged although #713 lifts every tile by one rise',
    'isoStructuralBuilds',
    'haUpdateDelta',
    'performed a structural rebuild for an HA-only state update',
    'requires an exact git source SHA',
  ]) assert.ok(runner.includes(contract), `missing Stage 4 runner contract: ${contract}`);
  assert.match(runner,
    /\[data-hp-iso-overlay-kind\]\[data-hp-iso-floor\]\[data-hp-iso-visual\]/,
    'Stage 4 counts must use interactive roots, not duplicated inert SVG diagnostics');
  assert.match(runner, /raisedVacuumCount/,
    'floor-bound vacuum must have an independent negative raised-state check');
  assert.match(runner, /stage3 !== total/,
    'every rendered device, room label and lock root must participate in Stage 4');
  assert.match(runner, /expectedOpeningKinds\.map/,
    'door, window and gate surfaces must contribute to the measured Stage 4 scene');
  assert.match(runner, /pulseDeviceIdsBySpace\?\.\[card\._space\]/,
    'every switched floor must retain its own observable pulse witness');
  assert.match(runner,
    /if \(snapshot\.effectiveProjection !== 'iso'\) failures\.push\('effective projection is not iso'\);/,
    'a dense Stage 4 report must reject Flat fallback instead of timing it as success');
  assert.match(runner,
    /requiresIsoStructuralBuildCounter[\s\S]*?afterStateIsoStructuralBuilds !== steadyIsoStructuralBuilds/,
    'both isometric profiles must reject a structural rebuild on the HA-only window');
});

test('#735 switchCycle times warmed navigation and fails on a floor build inside its window', () => {
  // Every sample mounts a new card that has seen only floors 1 and 2 before
  // the cycle, so the first visit to floor 3 (and, in the interaction
  // profile, a rebuilt floor 1) used to dominate switchCycleMs. The runner
  // visits every fixture floor once after the settings dialog closes and
  // before the timed window, then guards the window against any build.
  const runner = readFileSync(new URL('../demo/benchmark_large_house.mjs', import.meta.url), 'utf8');
  const settingsClosed = runner.indexOf('card._settingsDialog = null;');
  const cycleStart = runner.indexOf('const switchCycle = await duration(');
  assert.ok(settingsClosed > 0 && cycleStart > settingsClosed,
    'the switch cycle must follow the closed settings dialog');
  const warmup = runner.slice(settingsClosed, cycleStart);
  assert.match(warmup,
    /for \(let floor = 1; floor <= fixture\.counts\.floors; floor\+\+\) \{\s*card\._pickSpace\(`perf-floor-\$\{floor\}`\);\s*await card\.updateComplete;\s*await frame\(\);\s*\}/,
    'every fixture floor must be visited once before the switchCycle window');
  assert.match(warmup,
    /card\._pickSpace\('perf-floor-2'\);\s*await card\.updateComplete;\s*await frame\(\);\s*const switchCycleCachesBefore = cacheSnapshot\(card\);\s*const switchCycleBuildsBefore = isoStructuralBuildCount\(card\);\s*$/,
    'the cycle must still start from floor 2 with the guard snapshot taken last');
  assert.ok(!warmup.includes('duration(') && !warmup.includes('startLongTaskWindow('),
    'the warm-up must stay outside every timed and Long Task window');
  const afterCycle = runner.slice(cycleStart, runner.indexOf('await forceGc();', cycleStart));
  for (const contract of [
    'const switchCycleCachesAfter = cacheSnapshot(card);',
    'const switchCycleBuildsAfter = isoStructuralBuildCount(card);',
    'switchCycleCachesAfter[key] > switchCycleCachesBefore[key]',
    'switchCycleBuildsBefore != null && switchCycleBuildsAfter !== switchCycleBuildsBefore',
    '${profile} switchCycle built a floor inside the window: ',
  ]) assert.ok(afterCycle.includes(contract), `missing #735 switchCycle guard: ${contract}`);
});

test('#347: a rewritten before forces the full run instead of guessing the range', () => {
  // Force-push kills github.event.before; the merge-base fallback then
  // guessed a range that hid a real custom_components/** diff behind two doc
  // files, and the heavy jobs silently skipped while the run stayed green —
  // the #171/#207 class of silent pass. The contract: a non-zero before that
  // no longer exists switches classification to an unconditional full run
  // with a loud step-summary note, and the merge-base fallback remains ONLY
  // for the genuinely new branch (zero before).
  const workflow = readWorkflow('validate.yml');
  const classify = workflow.slice(
    workflow.indexOf('Классификация изменённых файлов'),
    workflow.indexOf('reuse:'),
  );
  // Полный прогон — `classify-changes.mjs --all`: все выходы true (#473 вынес
  // список выходов из inline-shell, ветка force-push идёт тем же путём).
  assert.ok(
    /force-push[\s\S]*?node scripts\/classify-changes\.mjs --all >> "\$GITHUB_OUTPUT"/.test(classify),
    'мёртвый before обязан включать полный прогон, не merge-base-угадывание');
  assert.ok(classify.includes('GITHUB_STEP_SUMMARY'),
    'пропуск классификации обязан быть громким в summary');
  const fallback = classify.slice(classify.indexOf('Новая ветка'));
  assert.ok(!fallback.includes('cat-file'),
    'merge-base-фолбэк остаётся только для нулевого before — без повторной проверки существования');
});

test('#780 led-strips-v1: the derived fixture converts devices without adding icons, the budget is the ТЗ table', async () => {
  const { makeLedStripsFixture } = await import('../demo/performance/led-strips-fixture.mjs');
  const { makeLargeHouseFixture } = await import('../demo/fixtures/large-house.mjs');
  const base = makeLargeHouseFixture();
  const led = makeLedStripsFixture(50, 50);
  assert.equal(Object.keys(led.devices).length, Object.keys(base.devices).length, 'no device added');
  assert.equal(Object.keys(led.layout).length, Object.keys(base.layout).length, 'no icon position added');
  for (const space of led.config.spaces) {
    assert.equal(space.led_strips.length, 50);
    for (const strip of space.led_strips) {
      assert.equal(strip.points.length, 50);
      assert.equal(led.states[`light.perf_led_${space.id.slice(-1) - 1}_${strip.id.split('-').pop()}`]?.state, 'on');
      assert.equal(led.config.markers.filter((marker) => marker.id === strip.marker).length, 1);
      assert.equal(led.config.markers.find((marker) => marker.id === strip.marker).space, space.id);
    }
  }
  const budgets = JSON.parse(readFileSync(new URL('../demo/performance/budgets-led-strips.json', import.meta.url), 'utf8'));
  assert.deepEqual(budgets.sizes['10x5'], { firstStableRenderMs: 3400, warmSpaceReadyMs: 1500, stateUpdateMs: 1000,
    panZoomMs: 500, panZoomLongTaskMaxMs: 150, retainedHeapBytes: 64 * 1024 * 1024 });
  assert.deepEqual(budgets.sizes['50x50'], { firstStableRenderMs: 5000, warmSpaceReadyMs: 1500, stateUpdateMs: 1500,
    panZoomMs: 500, panZoomLongTaskMaxMs: 150, retainedHeapBytes: 64 * 1024 * 1024 });
  assert.equal(budgets.cacheEntries, 50);
});
