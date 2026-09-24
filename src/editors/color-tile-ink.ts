/**
 * Цвет подписи на плитке цвета General settings (#615).
 *
 * С #615 плитка показывает прозрачность шахматкой: цвет лежит поверх шахматки
 * с непрозрачностью α. Подпись должна читаться на том, что человек видит, а не
 * на «чистом» `hex`: при α=0 видна одна шахматка, и белая подпись на ней
 * пропадает даже у почти чёрного цвета.
 *
 * Чистые функции без DOM и lit — живут отдельно от `form-kit.ts`, чтобы юнит
 * мог их импортировать (`tsconfig.test.json`), а бандл держал их в ленивом
 * графе редакторов вместе с единственным потребителем.
 */

/** Тёмная подпись плитки — та же, что была до #615. */
export const TILE_INK_DARK = '#1f2a30';
export const TILE_INK_LIGHT = '#fff';

/**
 * Средний тон шахматки `hp-color-opacity` (`#b8b8b8` / `#eee`, поровну):
 * (184 + 238) / 2 = 211 = `#d3d3d3`. Смешивание с ним по α даёт видимый цвет.
 */
export const CHECKER_MEAN = 211;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isLightRgb([r, g, b]: [number, number, number]): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/** Светлый ли цвет — для контраста подписи поверх свотча плитки. */
export function isLightHex(hex: string): boolean {
  const rgb = parseHex(hex);
  return rgb ? isLightRgb(rgb) : true;
}

/**
 * Цвет подписи по яркости ВИДИМОГО цвета: `hex`, смешанный со средним тоном
 * шахматки по α (контракт #615 п.4). При α=1 совпадает с `isLightHex(hex)`,
 * при α=0 подпись тёмная у любого цвета — под ней одна светлая шахматка.
 */
export function colorTileInk(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return TILE_INK_DARK;
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  const seen = rgb.map((v) => v * a + CHECKER_MEAN * (1 - a)) as [number, number, number];
  return isLightRgb(seen) ? TILE_INK_DARK : TILE_INK_LIGHT;
}
