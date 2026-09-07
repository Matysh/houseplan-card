export const MAX_PDF_RASTER_BYTES = 25 * 1024 * 1024;

/** Fail before writing a partial download when embedded JPEG data exceeds the contract. */
export function assertPdfRasterBudget(byteLengths: readonly number[]): void {
  let total = 0;
  for (const value of byteLengths) {
    total += Math.max(0, Number(value) || 0);
    if (total > MAX_PDF_RASTER_BYTES) throw new Error('pdf.too_large');
  }
}
