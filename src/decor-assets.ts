import type { DecorShape } from './editors/decor/types';

export const DECOR_ASSETS_API_VERSION = 1;
export const DECOR_ASSET_ID_RE = /^[0-9a-f]{64}$/;
export const DECOR_ASSET_RESOLVE_BATCH = 200;

export interface DecorAsset {
  asset_id: string;
  name: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  width: number;
  height: number;
  bytes: number;
  url: string;
  used_by?: { space_id: string; decor_id: string }[];
}

export function decorAssetIds(config: any): string[] {
  const ids = new Set<string>();
  for (const space of config?.spaces || []) {
    for (const shape of space?.decor || []) {
      if (shape?.kind === 'image' && DECOR_ASSET_ID_RE.test(shape.asset_id)) ids.add(shape.asset_id);
    }
  }
  return [...ids];
}

export function adoptDecorAssets(value: unknown): Map<string, DecorAsset> {
  const out = new Map<string, DecorAsset>();
  const rows = (value as { assets?: unknown })?.assets;
  if (!Array.isArray(rows)) return out;
  for (const raw of rows) {
    const row = raw as Partial<DecorAsset>;
    const extension = row.mime === 'image/png' ? 'png'
      : row.mime === 'image/jpeg' ? 'jpg'
        : row.mime === 'image/webp' ? 'webp'
          : row.mime === 'image/svg+xml' ? 'svg' : '';
    const expectedUrl = `/api/houseplan/content/assets/_/${row.asset_id}.${extension}`;
    if (!DECOR_ASSET_ID_RE.test(String(row.asset_id || '')) || row.url !== expectedUrl
        || typeof row.name !== 'string' || !Number.isFinite(row.bytes) || Number(row.bytes) < 1
        || !Number.isFinite(row.width) || !Number.isFinite(row.height)
        || Number(row.width) <= 0 || Number(row.height) <= 0) continue;
    out.set(row.asset_id!, row as DecorAsset);
  }
  return out;
}

/** Resolve every unique id without ever exceeding the backend message cap. */
export async function resolveDecorAssets(
  hass: { callWS: (message: Record<string, unknown>) => Promise<unknown> },
  assetIds: readonly string[],
): Promise<Map<string, DecorAsset>> {
  const unique = [...new Set(assetIds.filter((id) => DECOR_ASSET_ID_RE.test(id)))];
  const out = new Map<string, DecorAsset>();
  for (let offset = 0; offset < unique.length; offset += DECOR_ASSET_RESOLVE_BATCH) {
    const response = await hass.callWS({
      type: 'houseplan/assets/resolve',
      asset_ids: unique.slice(offset, offset + DECOR_ASSET_RESOLVE_BATCH),
    });
    for (const [id, asset] of adoptDecorAssets(response)) out.set(id, asset);
  }
  return out;
}

/** 100 cm wide, aspect preserving, with a 200 cm height cap. */
export function initialDecorImageCm(widthPx: number, heightPx: number): { w: number; h: number } {
  const ratio = Number.isFinite(widthPx) && Number.isFinite(heightPx) && widthPx > 0 && heightPx > 0
    ? widthPx / heightPx : 1;
  let w = 100;
  let h = w / ratio;
  if (h > 200) {
    h = 200;
    w = h * ratio;
  }
  return { w, h };
}

export function isDecorImage(shape: DecorShape): shape is Extract<DecorShape, { kind: 'image' }> {
  return shape.kind === 'image';
}
