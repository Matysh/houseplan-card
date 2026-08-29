/**
 * #39: header-level diagnostics for backdrop rasters.
 *
 * The whole point of this module is what it does NOT do: no ImageBitmap, no
 * canvas, no allocation sized by anything read from the file. Dimensions and
 * the alpha flag come from fixed-offset header fields of the bytes the dialog
 * already holds, so the "this image is huge" warning costs nothing even for a
 * 100-megapixel scan. Security stance (spec §Release/security): fields from
 * the file are used for arithmetic only; implausible values and any parser
 * exception collapse to 'unknown', which the UX treats as a warning, never as
 * a silent pass.
 *
 * Thresholds live here as the single calibration point (spec §Константы).
 * They were derived from the 2026-08-29 desktop-Chromium matrix
 * (demo/benchmark_backdrop_decode.mjs) with a conservative tablet margin; a
 * field recalibration is a one-file change.
 */

/** Warn when the decoded RGBA image would exceed this (≈32 MP). */
export const WARN_DECODED_BYTES = 128 * 1024 * 1024;
/** Browsers cap canvas/bitmap sides near 16384 px; beyond it decode is hopeless. */
export const HARD_DIMENSION = 16384;
/** Longest side of the reduced copy: enough for a 4K plan display. */
export const DOWNSCALE_TARGET_PX = 4096;
export const DOWNSCALE_JPEG_QUALITY = 0.9;
/** Give a slow tablet a real chance before declaring the decode dead. */
export const DOWNSCALE_TIMEOUT_MS = 10_000;

export type BackdropVerdict = 'safe' | 'warn' | 'hard' | 'unknown';

export interface BackdropProbe {
  kind: BackdropVerdict;
  width: number | null;
  height: number | null;
  alpha: boolean;
  decodedBytes: number | null;
}

/** Sides beyond this are treated as parser garbage, not as a real image. */
const PLAUSIBLE_MAX_SIDE = 1_000_000;

const unknown = (): BackdropProbe =>
  ({ kind: 'unknown', width: null, height: null, alpha: false, decodedBytes: null });

const verdictFor = (width: number, height: number, alpha: boolean): BackdropProbe => {
  if (!Number.isInteger(width) || !Number.isInteger(height)
      || width <= 0 || height <= 0
      || width > PLAUSIBLE_MAX_SIDE || height > PLAUSIBLE_MAX_SIDE) return unknown();
  const decodedBytes = width * height * 4; // exact integers far below 2^53
  const kind: BackdropVerdict = Math.max(width, height) > HARD_DIMENSION
    ? 'hard'
    : decodedBytes > WARN_DECODED_BYTES ? 'warn' : 'safe';
  return { kind, width, height, alpha, decodedBytes };
};

const u32be = (b: Uint8Array, at: number): number =>
  ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u16be = (b: Uint8Array, at: number): number => (b[at] << 8) | b[at + 1];
const u24le = (b: Uint8Array, at: number): number =>
  b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u16le = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8);
const ascii = (b: Uint8Array, at: number, text: string): boolean => {
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
};

/** PNG: IHDR is mandatory-first; colour types 4/6 or a tRNS chunk mean alpha. */
function probePng(b: Uint8Array): BackdropProbe {
  if (b.length < 33 || u32be(b, 0) !== 0x89504e47 || u32be(b, 4) !== 0x0d0a1a0a) return unknown();
  if (!ascii(b, 12, 'IHDR')) return unknown();
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  const colourType = b[25];
  let alpha = colourType === 4 || colourType === 6;
  // A palette/grayscale/rgb PNG may still carry transparency via tRNS. Walk
  // chunk headers only (length+type, 8 bytes each hop) — never the payloads.
  if (!alpha) {
    let at = 33;
    for (let hops = 0; hops < 64 && at + 8 <= b.length; hops++) {
      const length = u32be(b, at);
      if (ascii(b, at + 4, 'tRNS')) { alpha = true; break; }
      if (ascii(b, at + 4, 'IDAT') || ascii(b, at + 4, 'IEND')) break;
      if (length > b.length) break; // hostile length: stop walking, keep IHDR data
      at += 12 + length;
    }
  }
  return verdictFor(width, height, alpha);
}

/** JPEG: scan marker segments to the first SOF0..SOF15 frame header. */
function probeJpeg(b: Uint8Array): BackdropProbe {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return unknown();
  let at = 2;
  for (let hops = 0; hops < 256 && at + 4 <= b.length; hops++) {
    if (b[at] !== 0xff) { at++; continue; } // padding/garbage tolerance
    const marker = b[at + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { at += 2; continue; }
    const isSof = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (at + 9 > b.length) return unknown();
      return verdictFor(u16be(b, at + 7), u16be(b, at + 5), false); // JPEG never has alpha
    }
    if (marker === 0xda) return unknown(); // scan started before any SOF: give up
    const length = u16be(b, at + 2);
    if (length < 2) return unknown();
    at += 2 + length;
  }
  return unknown();
}

/** WebP: VP8X (canvas size + alpha flag), lossy VP8 or lossless VP8L. */
function probeWebp(b: Uint8Array): BackdropProbe {
  if (b.length < 30 || !ascii(b, 0, 'RIFF') || !ascii(b, 8, 'WEBP')) return unknown();
  if (ascii(b, 12, 'VP8X')) {
    const alpha = (b[20] & 0x10) !== 0;
    return verdictFor(u24le(b, 24) + 1, u24le(b, 27) + 1, alpha);
  }
  if (ascii(b, 12, 'VP8 ')) {
    // Lossy bitstream: 3-byte frame tag, then the 0x9d012a start code.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return unknown();
    return verdictFor(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff, false);
  }
  if (ascii(b, 12, 'VP8L')) {
    if (b[20] !== 0x2f) return unknown();
    // LE bit-packed: 14 bits width-1, 14 bits height-1, 1 bit alpha.
    const raw = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    const width = (raw & 0x3fff) + 1;
    const height = ((raw >> 14) & 0x3fff) + 1;
    const alpha = ((raw >> 28) & 1) === 1;
    return verdictFor(width, height, alpha);
  }
  return unknown();
}

/**
 * Classify a raster before anything expensive happens. `unknown` is the
 * fail-closed answer for anything the parser cannot vouch for.
 */
export function probeBackdrop(bytes: Uint8Array, ext: string): BackdropProbe {
  try {
    if (ext === 'png') return probePng(bytes);
    if (ext === 'jpg') return probeJpeg(bytes);
    if (ext === 'webp') return probeWebp(bytes);
    return unknown(); // svg never reaches the raster probe by contract
  } catch {
    return unknown();
  }
}

/** Reduced-copy geometry: longest side to the target, aspect preserved. */
export function downscaleDimensions(
  width: number, height: number, target = DOWNSCALE_TARGET_PX,
): { width: number; height: number } {
  const scale = Math.min(1, target / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
