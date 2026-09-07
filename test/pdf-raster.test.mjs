import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPdfRasterBudget, MAX_PDF_RASTER_BYTES,
} from '../test-build/pdf/pdf-raster.js';

test('PDF raster budget accepts the limit and rejects the next byte', () => {
  assert.doesNotThrow(() => assertPdfRasterBudget([MAX_PDF_RASTER_BYTES - 1, 1]));
  assert.throws(() => assertPdfRasterBudget([MAX_PDF_RASTER_BYTES, 1]), {
    message: 'pdf.too_large',
  });
});
