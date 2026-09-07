import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PDF_COMPASS_PATHS,
  PDF_COMPASS_VIEWBOX_SIZE,
  pdfCompassOps,
  pdfCompassTransform,
} from '../test-build/pdf/pdf-compass.js';

const EXPECTED_PATHS = [
  'M20.82,15.31h0L10.46,9c-.46-.26-1.11.37-.86.84l6.15,10.56,10.56,6.15a.66.66,0,0,0,.84-.86Zm-4,4,3-3,4.55,7.44Z',
  'M18,2A16,16,0,1,0,34,18,16,16,0,0,0,18,2Zm1,29.95V29.53H17v2.42A14,14,0,0,1,4.05,19H6.47V17H4.05A14,14,0,0,1,17,4.05V6.47h2V4.05A14,14,0,0,1,31.95,17H29.53v2h2.42A14,14,0,0,1,19,31.95Z',
];

const apply = (matrix, x, y) => [
  matrix.a * x + matrix.c * y + matrix.e,
  matrix.b * x + matrix.d * y + matrix.f,
];

const closeTo = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
};

test('compass keeps the two canonical Clarity paths pinned to the reviewed commit', () => {
  assert.deepEqual(PDF_COMPASS_PATHS, EXPECTED_PATHS);
  assert.equal(PDF_COMPASS_VIEWBOX_SIZE, 36);
});

test('compass transform preserves its center, size and cardinal north semantics', () => {
  const center = [120, 80];
  const cardinal = [
    { northDeg: 0, direction: [0, -1] },
    { northDeg: 90, direction: [1, 0] },
    { northDeg: 180, direction: [0, 1] },
    { northDeg: 270, direction: [-1, 0] },
  ];
  for (const { northDeg, direction } of cardinal) {
    const matrix = pdfCompassTransform({ centerX: center[0], centerY: center[1], size: 36, northDeg });
    const transformedCenter = apply(matrix, 18, 18);
    closeTo(transformedCenter[0], center[0]);
    closeTo(transformedCenter[1], center[1]);

    // The canonical diagonal from (18,18) to (17,17) is the needle's north axis.
    const transformedNorth = apply(matrix, 17, 17);
    const dx = transformedNorth[0] - center[0];
    const dy = transformedNorth[1] - center[1];
    closeTo(dx / Math.SQRT2, direction[0]);
    closeTo(dy / Math.SQRT2, direction[1]);
  }
});

test('compass operations are finite, deterministic and normalize equivalent angles', () => {
  const placement = { centerX: 70, centerY: 45, size: 24, northDeg: -90 };
  const first = pdfCompassOps(placement);
  const second = pdfCompassOps({ ...placement, northDeg: 270 });
  assert.deepEqual(first, second);
  assert.ok(first.length > 20);
  assert.equal(first.filter((entry) => entry.op === 'Z').length, 4);
  for (const entry of first) {
    for (const value of Object.values(entry).filter((item) => typeof item === 'number')) {
      assert.ok(Number.isFinite(value));
    }
  }
  assert.deepEqual(
    pdfCompassTransform({ centerX: 0, centerY: 0, size: 18, northDeg: 360 }),
    pdfCompassTransform({ centerX: 0, centerY: 0, size: 18, northDeg: 0 }),
  );
});

test('compass rejects non-finite placement and non-positive sizes', () => {
  assert.throws(
    () => pdfCompassTransform({ centerX: 0, centerY: 0, size: 0, northDeg: 0 }),
    { name: 'RangeError' },
  );
  assert.throws(
    () => pdfCompassTransform({ centerX: Number.NaN, centerY: 0, size: 10, northDeg: 0 }),
    { name: 'RangeError' },
  );
});

test('tracked notice preserves Clarity source, commit and MIT attribution', async () => {
  const notice = await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  const shippedNotice = await readFile(
    new URL('../custom_components/houseplan/THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8',
  );
  assert.match(notice, /bf6bdd0dd3f247f1a320d44d13fecdeda18c071c/);
  assert.match(notice, /Copyright \(c\) 2018 VMware, Inc\./);
  assert.match(notice, /MIT License/);
  assert.match(notice, /copies or substantial portions of the Software/);
  assert.equal(shippedNotice, notice, 'the HACS zip ships the exact reviewed notice');
});
