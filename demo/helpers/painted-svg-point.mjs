/** Measure the browser's painted point, including an enclosing HTML lens. */
export function paintedSvgPoint(node, x, y) {
  if (!node.closest('[data-hp-iso-perspective-floor]')) {
    const matrix = node.getScreenCTM();
    return matrix ? new DOMPoint(x, y).matrixTransform(matrix) : null;
  }
  // SVG's screen CTM omits its HTML perspective ancestor.
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  probe.setAttribute('x', x);
  probe.setAttribute('y', y);
  node.parentElement.append(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return new DOMPoint(rect.left, rect.top);
}
