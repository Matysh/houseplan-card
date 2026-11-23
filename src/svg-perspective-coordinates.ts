/** getCTM stops at the SVG viewport. Reapply the HTML lens explicitly
 * because getScreenCTM drops the projective term of the ancestor transform. */
export function readIsoPerspectiveSvg(node: SVGGraphicsElement) {
  const svg = node.ownerSVGElement, layer = svg?.parentElement;
  const lens = layer?.getAttribute('data-lens');
  const reference = layer?.parentElement?.querySelector<SVGSVGElement>(
    ':scope > svg[data-hp-perspective-reference], :scope > svg.plan-svg');
  if (!svg || !lens || !reference) return null;
  // The affine reference shares the lens's viewport and includes ancestor
  // rotation and live zoom. Its CTM does not pass through the HTML lens.
  const screen = reference.getScreenCTM(), svgMatrix = svg.getCTM(), nodeMatrix = node.getCTM();
  if (!screen || !svgMatrix || !nodeMatrix) return null;
  const toScene = svgMatrix.inverse().multiply(nodeMatrix), toLocal = toScene.inverse();
  const fromScreen = screen.inverse();
  const [cx, cy, rate, lift] = lens.split(' ').map(Number);
  return {
    toScreen(x: number, y: number): [number,number] {
      const p = new DOMPoint(x, y).matrixTransform(toScene);
      const w = 1 - rate * (p.y - cy);
      const q = new DOMPoint(cx + (p.x - cx) / w, cy + (p.y - cy - lift) / w).matrixTransform(screen);
      return [q.x, q.y];
    },
    fromScreen(x: number, y: number): [number,number] | null {
      const q = new DOMPoint(x, y).matrixTransform(fromScreen);
      const px = q.x - cx, py = q.y - cy;
      const dy = (py + lift) / (1 + rate * py);
      const w = 1 - rate * dy;
      const p = new DOMPoint(cx + px * w, cy + dy).matrixTransform(toLocal);
      return Number.isFinite(p.x) && Number.isFinite(p.y) && w > 0 ? [p.x, p.y] : null;
    },
  };
}
