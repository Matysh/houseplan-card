/**
 * Persisted Houseplan colours use one intentionally small contract.
 *
 * Keeping this stricter than the browser CSS grammar makes old, imported or
 * manually edited config safe before it reaches an inline style/SVG paint
 * sink. The backend enforces the same exact form on new writes.
 */
export const STORED_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function safeStoredColor(value: unknown, fallback: string): string;
export function safeStoredColor(value: unknown, fallback: null): string | null;
export function safeStoredColor(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' && STORED_COLOR_RE.test(value) ? value : fallback;
}

const RGB_COMPONENT = '(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
const GENERATED_RGB_RE = new RegExp(
  `^rgb\\(${RGB_COMPONENT}, ${RGB_COMPONENT}, ${RGB_COMPONENT}\\)$`,
);

/**
 * Render-boundary guard for the two colour forms the application can produce:
 * strict persisted hex and canonical rgb() generated below. This must not be
 * used to broaden the persisted colour contract.
 */
export function safeRenderColor(value: unknown, fallback: string): string;
export function safeRenderColor(value: unknown, fallback: null): string | null;
export function safeRenderColor(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string'
    && (STORED_COLOR_RE.test(value) || GENERATED_RGB_RE.test(value))
    ? value
    : fallback;
}

/** Canonical CSS rgb() from untrusted HA attributes; invalid input has no colour. */
export function generatedRgbColor(values: unknown): string | null {
  if (!Array.isArray(values) || values.length < 3) return null;
  const channels = values.slice(0, 3);
  if (!channels.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
  const [r, g, b] = channels.map((value) => Math.round(Math.min(255, Math.max(0, value))));
  return `rgb(${r}, ${g}, ${b})`;
}
