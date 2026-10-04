/** Browser-side #789 witnesses. No product imports or private state writes.
 * The reference freezes the d8949cff full48 mask construction (led-strip-field
 * lines 433–465). Geometry/visibility are deliberately shared with the actual
 * DOM; smoke_led_strip_field's independent distance oracle covers those.
 * Actual raster styles are resolved on the connected node, so a leaked host
 * coarse selector cannot disappear merely because the clone left its host.
 */
export function installLedZoomOracle() {
  const NS = 'http://www.w3.org/2000/svg';
  const root = card => card.shadowRoot;
  const bands = field => [...field.querySelectorAll('mask > g > path')];
  const fields = card => [...root(card).querySelectorAll('[data-led-field]')];
  const attrs = node => [...node.attributes].map(a => [a.name, a.value]);
  const visibleThroughHost = (node, card) => {
    for (let current = node; current;) {
      const css = getComputedStyle(current);
      if (css.display === 'none' || css.visibility !== 'visible' || !(Number(css.opacity) > 0)) return false;
      if (current === card) return true;
      current = current.parentElement || current.getRootNode()?.host || null;
    }
    return false;
  };
  const stops = [[0, 1], [45, .88], [70, .62], [86, .32], [100, 0]];
  const grey = fraction => {
    const at = fraction * 100;
    for (let i = 1; i < stops.length; i++) {
      const [a, va] = stops[i - 1], [b, vb] = stops[i];
      if (at <= b) {
        const v = Math.round((va + (vb - va) * (at - a) / (b - a)) * 255);
        return `rgb(${v}, ${v}, ${v})`;
      }
    }
    return 'rgb(0, 0, 0)';
  };
  const snapshot = card => {
    const nodes = [...root(card).querySelectorAll('.led-fields, .led-fields *, [data-led-strip], [data-led-strip] *, [data-glow-source], [data-glow-source] *')];
    return { nodes, attributes: nodes.map(attrs), cache: [...root(card).querySelectorAll('.led-fields')]
      .map(n => [n.dataset.ledCache, n.dataset.ledRecomputes]) };
  };
  const unchanged = (card, before) => {
    const after = snapshot(card);
    const hitWidthChanges = [];
    const stable = before.nodes.length === after.nodes.length && before.nodes.every((node, i) => {
      if (node !== after.nodes[i]) return false;
      const old = before.attributes[i], now = after.attributes[i];
      if (!node.matches('.led-hit')) return JSON.stringify(old) === JSON.stringify(now);
      const oldWidth = old.find(([key]) => key === 'stroke-width')?.[1];
      const newWidth = now.find(([key]) => key === 'stroke-width')?.[1];
      if (oldWidth !== newWidth) hitWidthChanges.push({ oldWidth, newWidth });
      return JSON.stringify(old.filter(([key]) => key !== 'stroke-width'))
        === JSON.stringify(now.filter(([key]) => key !== 'stroke-width'));
    });
    return { stable, hitWidthChanges, cacheStable: JSON.stringify(before.cache) === JSON.stringify(after.cache) };
  };
  const quality = card => ({
    coarse: card.getAttribute('data-led-zoom-quality') === 'coarse',
    ordinary: [...root(card).querySelectorAll('[data-glow-source]')].map(field => ({
      visible: visibleThroughHost(field, card),
    })),
    fields: fields(card).map(field => {
      const paths = bands(field);
      const painted = paths.filter(path => getComputedStyle(path).display !== 'none');
      const pool = field.querySelector('.led-pool');
      return { id: field.dataset.ledField, retained: paths.length, painted: painted.length,
        visible: visibleThroughHost(field, card) && Number(pool.getAttribute('fill-opacity')) > 0,
        correct24: paths.length === 48 && paths.every((path, k) => k % 2
          ? getComputedStyle(path).display === 'none'
          : getComputedStyle(path).display !== 'none' && getComputedStyle(path).stroke === grey(1 - (k + 1) / 48)),
        fill: pool.getAttribute('fill'), alpha: pool.getAttribute('fill-opacity'),
      };
    }),
  });
  const clone = (card, frozen48) => {
    const original = root(card).querySelector('.led-fields');
    if (!original) throw new Error('LED raster oracle: no field');
    const copy = original.cloneNode(true);
    fields(card).forEach((field, i) => {
      const target = copy.querySelectorAll('[data-led-field]')[i];
      target.style.opacity = getComputedStyle(field).opacity;
      target.style.visibility = getComputedStyle(field).visibility;
      target.style.mixBlendMode = getComputedStyle(field).mixBlendMode;
      const actualPaths = bands(field), targetPaths = bands(target);
      if (actualPaths.length !== 48) throw new Error(`LED raster oracle: expected retained48, got ${actualPaths.length}`);
      if (frozen48) {
        const group = targetPaths[0].parentNode;
        const d = actualPaths[0].getAttribute('d');
        const radius = Number(actualPaths[0].getAttribute('stroke-width')) / 2;
        group.replaceChildren();
        for (let k = 0; k < 48; k++) {
          const path = document.createElementNS(NS, 'path');
          const outer = 1 - k / 48, inner = 1 - (k + 1) / 48;
          for (const [name, value] of Object.entries({ d, fill: 'none', stroke: grey((outer + inner) / 2),
            'stroke-width': 2 * outer * radius, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) {
            path.setAttribute(name, String(value));
          }
          group.appendChild(path);
        }
      } else actualPaths.forEach((path, k) => {
        const css = getComputedStyle(path);
        targetPaths[k].style.stroke = css.stroke;
        targetPaths[k].style.display = css.display;
        targetPaths[k].style.visibility = css.visibility;
      });
    });
    return copy;
  };
  const raster = async (source, box, scale, background) => {
    const [x, y, w, h] = box;
    const xml = `<svg xmlns="${NS}" width="${w * scale}" height="${h * scale}" viewBox="${box.join(' ')}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>${new XMLSerializer().serializeToString(source)}</svg>`;
    const img = new Image(); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale;
    const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
    return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, canvas };
  };
  const full48 = async (card, { scales = [1, 2, 4], background = '#868d94', images = false } = {}) => {
    const pools = [...root(card).querySelectorAll('.led-pool')];
    const rects = pools.map(p => ['x', 'y', 'width', 'height'].map(a => Number(p.getAttribute(a))));
    const x = Math.floor(Math.min(...rects.map(r => r[0]))) - 2;
    const y = Math.floor(Math.min(...rects.map(r => r[1]))) - 2;
    const box = [x, y, Math.ceil(Math.max(...rects.map(r => r[0] + r[2]))) - x + 2,
      Math.ceil(Math.max(...rects.map(r => r[1] + r[3]))) - y + 2];
    const actual = clone(card, false), expected = clone(card, true), rows = [];
    for (const scale of scales) {
      const a = await raster(actual, box, scale, background), b = await raster(expected, box, scale, background);
      let differentPixels = 0, maxDelta = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        let different = false;
        for (let c = 0; c < 4; c++) {
          const delta = Math.abs(a.data[i + c] - b.data[i + c]);
          maxDelta = Math.max(maxDelta, delta); different ||= delta !== 0;
        }
        if (different) differentPixels++;
      }
      rows.push({ scale, pixels: a.data.length / 4, differentPixels, maxDelta,
        ...(images ? { actualPng: a.canvas.toDataURL(), expectedPng: b.canvas.toDataURL() } : {}) });
    }
    return rows;
  };
  window.__ledZoomOracle = { snapshot, unchanged, quality, full48 };
}
