export type RgbColor = { r: number; g: number; b: number };
export type HsvColor = { h: number; s: number; v: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function normalizeHue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim().replace(/^#/, '');
  const expanded = /^[0-9a-fA-F]{3}$/.test(token)
    ? token.split('').map((part) => `${part}${part}`).join('')
    : token;
  return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toLowerCase()}` : null;
}

export function hexToRgb(value: unknown): RgbColor | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex(rgb: RgbColor): string {
  const channel = (value: number): string =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

export function rgbToHsv(rgb: RgbColor): HsvColor {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }
  return {
    h: normalizeHue(h),
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

export function hsvToRgb(hsv: HsvColor): RgbColor {
  const h = normalizeHue(hsv.h);
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  let channels: [number, number, number];
  if (h < 60) channels = [chroma, x, 0];
  else if (h < 120) channels = [x, chroma, 0];
  else if (h < 180) channels = [0, chroma, x];
  else if (h < 240) channels = [0, x, chroma];
  else if (h < 300) channels = [x, 0, chroma];
  else channels = [chroma, 0, x];
  return {
    r: Math.round((channels[0] + m) * 255),
    g: Math.round((channels[1] + m) * 255),
    b: Math.round((channels[2] + m) * 255),
  };
}

export function hsvToHex(hsv: HsvColor): string {
  return rgbToHex(hsvToRgb(hsv));
}
