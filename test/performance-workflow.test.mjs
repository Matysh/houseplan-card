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
    'schedule:',
    'workflow_dispatch:',
    'Capture base and candidate profile',
    'profile:',
    '- large-house',
    '- isometric',
    '- isometric-stage3',
    '- plan-snap',
    '- interaction',
    '- blend',
    '- overlay',
    '- space-default',
    '- space-glow',
    'PROFILE: ${{ matrix.profile }}',
    'name: full-performance-${{ matrix.profile }}',
    '--samples=7 --warmups=1',
  ]) assert.ok(workflow.includes(contract), `missing full-gate contract: ${contract}`);

  assert.ok(workflow.includes('if [ -f baseline/scripts/bundle-sync.mjs ]; then'));
  assert.equal((workflow.match(/--samples=7 --warmups=1/g) || []).length, 18);
  assert.equal((workflow.match(/--allow-stage2-base/g) || []).length, 1,
    'only the Stage 3 comparison base may bypass the candidate-only DOM contract');
  assert.ok(workflow.includes('budgets-isometric-stage3-dense.json'));
  assert.equal((workflow.match(/--baseline-sha=/g) || []).length, 2);
  assert.equal((workflow.match(/--candidate-sha=/g) || []).length, 2);

  const release = readWorkflow('release.yml');
  assert.ok(release.includes('if: ${{ !github.event.release.prerelease }}'));
  assert.ok(release.includes('--workflow=performance.yml --label="Полные бенчмарки производительности"'));
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

test('#160 Stage 3 runner fails closed on the agreed observable DOM contract', () => {
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
    'Stage 3 roots',
    'opening surfaces',
    'entered Flat fallback',
    'structural build counter is absent',
    'isoStructuralBuilds',
    'haUpdateDelta',
    'performed a structural rebuild for an HA-only state update',
    'requires an exact git source SHA',
  ]) assert.ok(runner.includes(contract), `missing Stage 3 runner contract: ${contract}`);
  assert.match(runner,
    /\[data-hp-iso-overlay-kind\]\[data-hp-iso-floor\]\[data-hp-iso-visual\]/,
    'Stage 3 counts must use interactive roots, not duplicated inert SVG diagnostics');
  assert.match(runner, /raisedVacuumCount/,
    'floor-bound vacuum must have an independent negative raised-state check');
  assert.match(runner, /stage3 !== total/,
    'every rendered device, room label and lock root must participate in Stage 3');
  assert.match(runner, /expectedOpeningKinds\.map/,
    'door, window and gate surfaces must contribute to the measured Stage 3 scene');
  assert.match(runner, /pulseDeviceIdsBySpace\?\.\[card\._space\]/,
    'every switched floor must retain its own observable pulse witness');
  assert.match(runner,
    /if \(snapshot\.effectiveProjection !== 'iso'\) failures\.push\('effective projection is not iso'\);/,
    'a dense Stage 3 report must reject Flat fallback instead of timing it as success');
  assert.match(runner,
    /requiresIsoStructuralBuildCounter[\s\S]*?afterStateIsoStructuralBuilds !== steadyIsoStructuralBuilds/,
    'both isometric profiles must reject a structural rebuild on the HA-only window');
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
