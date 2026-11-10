/** Detect one-pixel SVG seams inside a room-coloured opening tunnel. Sample a
 * narrow strip around local y=0: this crosses the join between both floor
 * half-faces at any opening angle while excluding legitimate outer-profile
 * steps where adjacent wall intervals have different physical thicknesses. */
export async function inspectTunnelContinuity(page, png, clip, spec) {
  return page.evaluate(async ({ png64, clip, spec }) => {
    const card = window.__goldenCard;
    const root = card?.renderRoot;
    const opening = card?._openingsR?.find(item => item.id === spec.openingId);
    const floors = [...(root?.querySelectorAll('[data-hp="room"]') || [])].filter(path => {
      const style = getComputedStyle(path);
      // Unfilled paper is also uniformly painted. It is not a positive control
      // for the room-coloured fill whose tunnel seam this witness judges.
      return path instanceof SVGGeometryElement && path.classList.contains('filled') && style.fill !== 'none'
        && style.fill !== 'rgba(0, 0, 0, 0)' && Number(style.fillOpacity) > 0 && Number(style.opacity) > 0;
    });
    if (!opening || !(opening.rlen > 0) || !floors.length)
      throw new Error(`semantic golden opening floor missing: ${spec.openingId}`);
    if (root.querySelector('.opening-tunnels[data-layer="data"]'))
      throw new Error('semantic golden retired data tunnel returned');
    const base = floors[0].getScreenCTM();
    if (!base) throw new Error(`semantic golden floor has no screen transform: ${spec.openingId}`);
    const openingToPlane = new DOMMatrix().translate(opening.rx, opening.ry).rotate(opening.angle);
    const matrix = new DOMMatrix([base.a,base.b,base.c,base.d,base.e,base.f]).multiply(openingToPlane);
    const inverse = matrix.inverse();
    const band = (Math.max(1.5, spec.axisBandPx || 2.5) + spec.insetPx + 2)
      / Math.max(1e-6, Math.hypot(matrix.c, matrix.d));
    const localBounds = {x:-opening.rlen/2,y:-band,width:opening.rlen,height:band*2};
    const corners = [-opening.rlen/2,opening.rlen/2].flatMap(x => [-band,band]
      .map(y => new DOMPoint(x,y).matrixTransform(matrix)));
    const rect = {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
      top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const originX = clip?.x || 0, originY = clip?.y || 0;
    // Screenshots may be captured at DPR > 1. DOMRect/clip are CSS pixels,
    // image coordinates are device pixels, so derive the scale instead of
    // silently sampling the wrong strip at high DPI.
    const cssWidth = clip?.width || document.documentElement.clientWidth;
    const cssHeight = clip?.height || document.documentElement.clientHeight;
    const scaleX = image.width / Math.max(1, cssWidth);
    const scaleY = image.height / Math.max(1, cssHeight);
    const insetX = Math.max(1, Math.round(spec.insetPx * scaleX));
    const insetY = Math.max(1, Math.round(spec.insetPx * scaleY));
    const left = Math.max(0, Math.ceil((rect.left - originX) * scaleX) + insetX);
    const top = Math.max(0, Math.ceil((rect.top - originY) * scaleY) + insetY);
    const right = Math.min(image.width - 1, Math.floor((rect.right - originX) * scaleX) - insetX);
    const bottom = Math.min(image.height - 1, Math.floor((rect.bottom - originY) * scaleY) - insetY);
    if (right - left < 3 || bottom - top < 3)
      throw new Error(`semantic golden tunnel is too small: ${left},${top},${right},${bottom}`);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rgb = (x, y) => {
      const offset = (y * image.width + x) * 4;
      return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    };
    let maxJump = 0, maxPair = null, samplePairs = 0;
    const compare = (a, b, x, y, direction) => {
      const jump = Math.max(
        Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      if (jump > maxJump) {
        maxJump = jump;
        maxPair = { x, y, direction, a, b };
      }
      samplePairs++;
    };
    const localXScale = Math.max(1e-6, Math.hypot(matrix.a, matrix.b));
    const localYScale = Math.max(1e-6, Math.hypot(matrix.c, matrix.d));
    const endInset = Math.max(1, spec.insetPx) / localXScale;
    const axisBand = Math.max(1.5, spec.axisBandPx || 2.5) / localYScale;
    const insideAxisBand = (x, y) => {
      const cssX = originX + (x + 0.5) / scaleX;
      const cssY = originY + (y + 0.5) / scaleY;
      const local = new DOMPoint(cssX, cssY).matrixTransform(inverse);
      const inside = local.x >= localBounds.x + endInset
        && local.x <= localBounds.x + localBounds.width - endInset
        && Math.abs(local.y) <= axisBand;
      if (inside && !floors.some(path => path.isPointInFill(local.matrixTransform(openingToPlane))))
        throw new Error(`semantic golden opening floor has a coverage gap: ${spec.openingId}`);
      return inside;
    };
    for (let y = top; y <= bottom; y++) {
      for (let x = left + 1; x <= right; x++) {
        if (insideAxisBand(x - 1, y) && insideAxisBand(x, y))
          compare(rgb(x - 1, y), rgb(x, y), x, y, 'horizontal');
      }
    }
    for (let x = left; x <= right; x++) {
      for (let y = top + 1; y <= bottom; y++) {
        if (insideAxisBand(x, y - 1) && insideAxisBand(x, y))
          compare(rgb(x, y - 1), rgb(x, y), x, y, 'vertical');
      }
    }
    if (!samplePairs) throw new Error(`semantic golden tunnel axis strip is empty: ${spec.openingId}`);
    return {
      maxJump, maxPair, samplePairs, bounds: [left, top, right, bottom],
      scale: [scaleX, scaleY],
    };
  }, { png64: png.toString('base64'), clip, spec });
}

