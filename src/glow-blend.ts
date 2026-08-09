/** Runtime proof that this document can rasterize isolated SVG screen blend. */

const documentProbes = new WeakMap<Document, Promise<boolean>>();

export type Rgb = readonly [number, number, number];

/** CSS screen formula in 8-bit sRGB, rounded exactly like a pixel sample. */
export function screenRgb(a: Rgb, b: Rgb): [number, number, number] {
  return [0, 1, 2].map((index) => Math.round(
    255 - ((255 - a[index]) * (255 - b[index])) / 255,
  )) as [number, number, number];
}

const closePixel = (actual: Uint8ClampedArray, expected: Rgb, offset: number): boolean => (
  actual[offset + 3] === 255
  && expected.every((channel, index) => Math.abs(actual[offset + index] - channel) <= 2)
);

async function renderProbe(doc: Document): Promise<boolean> {
  const win = doc.defaultView;
  if (!win || !win.CSS?.supports?.('mix-blend-mode', 'screen')) return false;
  const sourceA: Rgb = [128, 32, 16];
  const sourceB: Rgb = [16, 64, 128];
  const background: Rgb = [9, 19, 29];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="1" viewBox="0 0 4 1">
    <rect width="4" height="1" fill="rgb(${background.join(',')})"/>
    <g style="isolation:isolate">
      <rect x="0" width="2" height="1" fill="rgb(${sourceA.join(',')})"/>
      <rect x="1" width="2" height="1" fill="rgb(${sourceB.join(',')})" style="mix-blend-mode:screen"/>
    </g>
  </svg>`;
  const url = win.URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const node = new win.Image();
      const timer = win.setTimeout(() => reject(new Error('SVG blend probe timeout')), 1000);
      node.onload = () => { win.clearTimeout(timer); resolve(node); };
      node.onerror = () => { win.clearTimeout(timer); reject(new Error('SVG blend probe failed')); };
      node.src = url;
    });
    const canvas = doc.createElement('canvas');
    canvas.width = 4;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, 4, 1);
    const pixels = context.getImageData(0, 0, 4, 1).data;
    return closePixel(pixels, sourceA, 0)
      && closePixel(pixels, screenRgb(sourceA, sourceB), 4)
      && closePixel(pixels, sourceB, 8)
      && closePixel(pixels, background, 12);
  } catch {
    return false;
  } finally {
    win.URL.revokeObjectURL(url);
  }
}

/** One cached Promise per real Document; errors are a normal false fallback. */
export function svgScreenBlendSupported(doc: Document): Promise<boolean> {
  const cached = documentProbes.get(doc);
  if (cached) return cached;
  const probe = renderProbe(doc).catch(() => false);
  documentProbes.set(doc, probe);
  return probe;
}

