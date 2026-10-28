/** Canonical large-house input: no unrelated all-floor migration on release. */
import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
export const openingDragFixture = () => {
    const fixture = makeLargeHouseFixture();
    fixture.config = commitWallSegmentModel(fixture.config).config;
    return fixture;
};
