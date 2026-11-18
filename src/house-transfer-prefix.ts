/** Bounded container routing only. Never interpret the portable JSON payload. */
export const HOUSE_PREFIX_BYTES = 1024;
export type HousePrefixKind = 'house' | 'unsupported' | 'other';

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function classifyHousePrefix(input: Uint8Array): HousePrefixKind {
  const bytes = input.subarray(0, HOUSE_PREFIX_BYTES);
  if (bytes.length < 38) return 'other';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50 || view.getUint16(4, true) !== 20
      || view.getUint16(6, true) !== 0 || view.getUint16(8, true) !== 0
      || view.getUint16(10, true) !== 0 || view.getUint16(12, true) !== 33
      || view.getUint16(26, true) !== 8 || view.getUint16(28, true) !== 0) return 'other';
  const size = view.getUint32(22, true);
  if (size !== view.getUint32(18, true) || size > HOUSE_PREFIX_BYTES - 38 || bytes.length < 38 + size) return 'other';
  const decoder = new TextDecoder();
  if (decoder.decode(bytes.subarray(30, 38)) !== 'mimetype') return 'other';
  const body = bytes.subarray(38, 38 + size);
  const match = /^application\/vnd\.houseplan\.plan\+zip;version=([1-9][0-9]{0,5})$/.exec(decoder.decode(body));
  if (!match || crc32(body) !== view.getUint32(14, true)) return 'other';
  return match[1] === '1' ? 'house' : 'unsupported';
}

export async function readHousePrefix(file: Blob): Promise<{ kind: HousePrefixKind; zip: boolean }> {
  const bytes = new Uint8Array(await file.slice(0, HOUSE_PREFIX_BYTES).arrayBuffer());
  return { kind: classifyHousePrefix(bytes), zip: bytes[0] === 0x50 && bytes[1] === 0x4b };
}
