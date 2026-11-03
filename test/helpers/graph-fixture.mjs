import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
import { commitGraphEditResult } from '../../test-build/graph-edit-intent.js';

/** Construct current authority from an authored legacy fixture, never label raw projections model11. */
export function currentGraphFixture(input) {
  return commitWallSegmentModel(input).config;
}

/** A test author supplies the same explicit scope as the corresponding UI writer. */
export function editGraphFixture(config, spaceId, intent, change) {
  const index = config.spaces.findIndex(space => space.id === spaceId);
  if (index < 0) throw new Error(`missing fixture space: ${spaceId}`);
  const before = config.spaces[index], draft = structuredClone(before);
  change(draft);
  const result = commitGraphEditResult(before, draft, intent);
  config.spaces[index] = result.space;
  return result;
}
