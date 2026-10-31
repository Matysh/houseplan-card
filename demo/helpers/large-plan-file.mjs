import assert from 'node:assert/strict';

/** A valid browser-encoded PNG: exercises decoded dimensions, not a fake header. */
export async function largePlanFile(page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 10000;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 10000, 10000);
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    canvas.width = canvas.height = 0;
    return base64;
  });
  const file = { name:'large-valid.png', mimeType:'image/png', buffer:Buffer.from(encoded, 'base64') };
  assert.equal(file.buffer.readUInt32BE(16), 10000); assert.equal(file.buffer.readUInt32BE(20), 10000);
  return file;
}
