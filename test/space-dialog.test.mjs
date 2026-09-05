import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createEmptySpaceConfig,
  initialSpaceDisplayDraft,
  switchSpacePlanSource,
  touchSpaceDisplay,
} from '../test-build/space-dialog.js';

test('a fresh space is a complete empty v8/v9 wall-model document (#324)', () => {
  assert.deepEqual(createEmptySpaceConfig('floor', 'Ground floor'), {
    id: 'floor',
    title: 'Ground floor',
    plan_url: null,
    view_box: [0, 0, 1, 1],
    rooms: [],
    wall_segments: [],
  });
});

test('fresh create projects honest File and Draw display defaults', () => {
  const file = initialSpaceDisplayDraft();
  assert.deepEqual(file, {
    source: 'file', showBorders: false, showNames: false, displayTouched: false,
  });

  const draw = switchSpacePlanSource(file, 'draw');
  assert.deepEqual(draw, {
    source: 'draw', showBorders: true, showNames: true, displayTouched: false,
  });
  assert.deepEqual(switchSpacePlanSource(draw, 'file'), file);
});

test('touching either display switch preserves the complete mixed pair', () => {
  const draw = switchSpacePlanSource(initialSpaceDisplayDraft(), 'draw');
  const mixed = touchSpaceDisplay(draw, 'showBorders', false);
  assert.deepEqual(mixed, {
    source: 'draw', showBorders: false, showNames: true, displayTouched: true,
  });
  assert.deepEqual(switchSpacePlanSource(mixed, 'file'), {
    ...mixed, source: 'file',
  });
  assert.deepEqual(switchSpacePlanSource(mixed, 'draw'), mixed);
});

test('every supported Draw pair remains exact after a touched source round-trip', () => {
  for (const [showBorders, showNames] of [
    [false, false], [true, false], [false, true],
  ]) {
    let draft = switchSpacePlanSource(initialSpaceDisplayDraft(), 'draw');
    draft = touchSpaceDisplay(draft, 'showBorders', showBorders);
    draft = touchSpaceDisplay(draft, 'showNames', showNames);
    const roundTrip = switchSpacePlanSource(switchSpacePlanSource(draft, 'file'), 'draw');
    assert.deepEqual(roundTrip, {
      source: 'draw', showBorders, showNames, displayTouched: true,
    });
  }
});

test('source and display transitions are immutable and preserve unrelated fields', () => {
  const draft = { ...initialSpaceDisplayDraft(), title: 'Ground', cellCm: 7.5 };
  const switched = switchSpacePlanSource(draft, 'draw');
  const touched = touchSpaceDisplay(switched, 'showNames', false);

  assert.notEqual(switched, draft);
  assert.notEqual(touched, switched);
  assert.deepEqual(draft, {
    source: 'file', showBorders: false, showNames: false, displayTouched: false,
    title: 'Ground', cellCm: 7.5,
  });
  assert.equal(touched.title, 'Ground');
  assert.equal(touched.cellCm, 7.5);
});

test('#456 Copy is an edit-settings action and is absent from onboarding', () => {
  const runtime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const onboarding = readFileSync(new URL('../src/houseplan-onboarding-runtime.ts', import.meta.url), 'utf8');
  assert.match(runtime, /d\.mode === 'edit'[\s\S]*openSpaceCopyDialog\(this\.host\)/);
  assert.match(runtime, /<div class="dialog-action-group">[\s\S]*btn\.copy/);
  assert.doesNotMatch(runtime, /dialog-action-danger[\s\S]{0,300}btn\.copy/);
  assert.doesNotMatch(onboarding, /btn\.copy|openSpaceCopyDialog|space\.copy_/);
});
