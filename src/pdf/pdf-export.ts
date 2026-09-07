import { html, type TemplateResult } from 'lit';
import type { PdfDialogContext, PdfAssetReference } from './hp-pdf-dialog';
import './hp-pdf-dialog';
import { buildPdfPage, type PdfExportOptions, type PdfRasterPlacement } from './pdf-scene';
import { writePdf } from './pdf-writer';
import { NORM_W } from '../space-geometry';
import { projectDecorImage } from '../decor-assets';
import type { DecorShape } from '../editors/decor/types';
import { pdfLocalDate } from './pdf-date';
import { assertPdfRasterBudget } from './pdf-raster';

export const PDF_EXPORT_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export type { PdfAssetReference } from './hp-pdf-dialog';
export type PdfRuntimeContext = Omit<PdfDialogContext, 'save'>;

async function imageToJpeg(url: string, id: string): Promise<{
  id: string; bytes: Uint8Array; width: number; height: number;
}> {
  if (!url) throw new Error('pdf.asset_failed');
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('pdf.asset_failed');
  const source = await response.blob();
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(source); } catch { throw new Error('pdf.asset_failed'); }
  try {
    if (source.type === 'image/jpeg') return {
      id, bytes: new Uint8Array(await source.arrayBuffer()), width: bitmap.width, height: bitmap.height,
    };
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('pdf.asset_failed');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!jpeg) throw new Error('pdf.asset_failed');
    return { id, bytes: new Uint8Array(await jpeg.arrayBuffer()), width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close(); }
}

async function rasters(context: PdfRuntimeContext, options: PdfExportOptions): Promise<PdfRasterPlacement[]> {
  const out: PdfRasterPlacement[] = [];
  if (options.backdrop && context.space.bg) {
    const image = await imageToJpeg(context.backdropUrl, 'backdrop');
    out.push({ ...image, x: context.space.bg.x, y: context.space.bg.y,
      drawWidth: context.space.bg.w, drawHeight: context.space.bg.h,
      angle: context.space.bg.angle, opacity: 0.6 });
  }
  if (options.decor) {
    let index = 0;
    for (const shape of (context.rawSpace.decor || []) as DecorShape[]) {
      if (shape.kind !== 'image') continue;
      const asset = context.decorAssets.get(shape.asset_id);
      const projection = projectDecorImage(shape, NORM_W, NORM_W);
      if (!asset || !projection) throw new Error('pdf.asset_failed');
      const image = await imageToJpeg(asset.url, `decor${index++}`);
      out.push({ ...image, x: projection[0], y: projection[1], drawWidth: projection[2],
        drawHeight: projection[3], opacity: projection[4], angle: Number(shape.angle) || 0 });
    }
  }
  assertPdfRasterBudget(out.map((image) => image.bytes.byteLength));
  return out;
}

function slug(value: string): string {
  const clean = value.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return clean.toLowerCase() || 'space';
}

export async function exportSpacePdf(
  context: PdfRuntimeContext, options: PdfExportOptions, now: Date,
): Promise<Uint8Array> {
  const images = await rasters(context, options);
  const page = buildPdfPage({ ...context, options, now, rasters: images, t: context.t });
  const bytes = writePdf(page);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `houseplan-${slug(context.space.title)}-${pdfLocalDate(now)}.pdf`;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  return bytes;
}

export class PdfExportRuntime {
  /** Browser-smoke seam for the pre-writer size guard. */
  public assertRasterBudget(byteLengths: readonly number[]): void {
    assertPdfRasterBudget(byteLengths);
  }

  public render(context: PdfRuntimeContext): TemplateResult {
    let complete!: PdfDialogContext;
    complete = {
      ...context,
      save: async (options) => { await exportSpacePdf(context, options, complete.now || new Date()); },
    };
    return html`<hp-pdf-dialog .context=${complete}></hp-pdf-dialog>`;
  }
}
