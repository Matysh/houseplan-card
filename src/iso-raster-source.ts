import type { IsoRasterFrame } from './iso-raster-geometry';

// Hover is cleared at camera input and is never part of the reusable plan.
export const isoRasterHoverSelector = '.room-hover-fill, .room-hover-halo, .room-hover-outline';

const svgNamespace = 'http://www.w3.org/2000/svg';
const xlink = 'http://www.w3.org/1999/xlink';
const widthToken = 'hp-raster-width';
const heightToken = 'hp-raster-height';
const viewBoxToken = 'hp-raster-view-box';
const outlineToken = 'hp-raster-outline-dpr';
const filterToken = 'hp-raster-prefilter';

const hrefOf = (element: Element) => element.getAttribute('href') || element.getAttributeNS(xlink, 'href');

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Capture the same scene and styling once, then reuse it for different cameras. */
export async function captureIsoRasterSource(scene: SVGSVGElement, stage: HTMLElement,
  computed: CSSStyleDeclaration, signal: AbortSignal): Promise<string> {
  const root = scene.getRootNode();
  if (!(root instanceof ShadowRoot) || scene.querySelector('foreignObject')) throw Error('Unsupported SVG source');
  const doc = scene.ownerDocument;
  const outer = doc.createElementNS(svgNamespace, 'svg');
  outer.setAttribute('width', widthToken);
  outer.setAttribute('height', heightToken);
  outer.style.setProperty('--hp-raster-outline-scale', outlineToken);
  // The overview has its own smaller sample grid. Smooth its source texels
  // once; the compositor naturally scales that softness with the overview.
  outer.style.filter = 'var(--hp-raster-prefilter)';
  outer.style.setProperty('--hp-raster-prefilter', filterToken);
  const context = doc.createElementNS(svgNamespace, 'g');
  // Boot/transition opacity belongs to the live wrapper, not the plan ink.
  const transient = new Set(['hpboot', 'hpsettle', 'hpiso-pending', 'mode-transition']);
  context.setAttribute('class', [...stage.classList].filter(name => !transient.has(name)).join(' '));
  if (stage.hasAttribute('data-hp-iso-floor-markers')) context.setAttribute('data-hp-iso-floor-markers', 'true');
  const css = doc.createElementNS(svgNamespace, 'style');
  const sceneCss = [...root.styleSheets, ...root.adoptedStyleSheets]
    .flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
  // #1480/#1486: discover referenced names explicitly. Copying unrelated
  // inherited HA tokens can consume the material declarations on reparse.
  const names = new Set(['color', 'color-scheme', 'font-size', 'font-family']);
  for (const name of stage.style) if (name.startsWith('--')) names.add(name);
  for (const match of (sceneCss + '\n' + scene.outerHTML).matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1]);
  for (const name of names) context.style.setProperty(name, computed.getPropertyValue(name));
  css.textContent = sceneCss + '\ng.stage, g.zoomwrap { opacity:1; transform:none; filter:none; clip-path:none; }';
  const wrap = doc.createElementNS(svgNamespace, 'g');
  wrap.setAttribute('class', 'zoomwrap');
  const clone = scene.cloneNode(true) as SVGSVGElement;
  clone.style.removeProperty('opacity');
  for (const hover of clone.querySelectorAll(isoRasterHoverSelector)) hover.remove();
  // An SVG image has a new animation timeline. Preserve the settled sun
  // instead of restarting the fade at zero on each bitmap.
  const sun = clone.querySelector<SVGElement>('.iso-sunwash');
  if (sun) {
    sun.style.animation = 'none';
    if (sun.classList.contains('out')) sun.style.opacity = '0';
  }
  clone.setAttribute('viewBox', viewBoxToken);
  clone.setAttribute('preserveAspectRatio', 'none');
  const external = new Map<string, Promise<string>>();
  for (const element of clone.querySelectorAll('image, feImage, use')) {
    const href = hrefOf(element);
    if (!href || href.startsWith('data:image/')) continue;
    if (href.startsWith('#') && clone.querySelector('[id="' + CSS.escape(href.slice(1)) + '"]')) continue;
    if (element.localName === 'use') throw Error('Unsupported SVG reference');
    const url = new URL(href, doc.baseURI).href;
    if (!external.has(url)) {
      external.set(url, fetch(url, { signal, credentials: 'same-origin' }).then(async response => {
        if (!response.ok) throw Error('SVG image could not be loaded');
        const blob = await response.blob();
        return dataUrl(blob);
      }));
    }
  }
  const resolved = new Map(await Promise.all([...external].map(async ([url, image]) => [url, await image] as const)));
  for (const element of clone.querySelectorAll('image, feImage')) {
    const href = hrefOf(element);
    if (!href || !external.size || href.startsWith('#') || href.startsWith('data:image/')) continue;
    const inline = resolved.get(new URL(href, doc.baseURI).href);
    if (inline) {
      element.removeAttributeNS(xlink, 'href');
      element.setAttribute('href', inline);
    }
  }
  signal.throwIfAborted();
  wrap.append(clone);
  context.append(wrap);
  outer.append(css, context);
  return new XMLSerializer().serializeToString(outer);
}

export async function decodeIsoRaster(source: string, { bounds: { x, y, w, h }, width, height }: IsoRasterFrame,
  signal: AbortSignal, dpr: number, overview = false): Promise<ImageBitmap> {
  const xml = source.replace(widthToken, String(width)).replace(heightToken, String(height))
    .replace(outlineToken, String(dpr))
    .replace('--hp-raster-prefilter: ' + filterToken, '--hp-raster-prefilter: ' + (overview ? 'blur(.6px)' : 'none'))
    .replace('viewBox="' + viewBoxToken + '"', 'viewBox="' + [x, y, w, h].join(' ') + '"');
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  try {
    signal.throwIfAborted();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}
