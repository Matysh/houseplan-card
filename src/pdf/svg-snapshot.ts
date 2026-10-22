import type { SvgExportOptions } from './export-options';
import { PDF_FONT_BASE64 } from './pdf-font.generated';

const SVG = 'http://www.w3.org/2000/svg';
const HTML = 'http://www.w3.org/1999/xhtml';
const LIMIT = 25 * 1024 * 1024;
const CHROME = '.hp-editor-only-layer,[data-hp-live-editor],[data-hp-live-editor-html],.room-hover,.led-hit,.led-focus,.rlgo,.rlhandle';
const DEVICE = '.dev,.oplock,.vacpuck,.vactrail,.vacpath,[data-vacuum-owner],.radar-target,.radar-ranges,.iso-tile-shadows,.led-strips,[data-hp-device-furniture],.zigbee-topology-overlay,hp-zigbee-topology-overlay';

export interface SvgViewSource { stage: HTMLElement; isCurrent: () => boolean; }

/** Synchronous read-only capture. No HA/config authority and no live DOM mutation. */
export function captureSvgView(source: SvgViewSource, options: SvgExportOptions): SVGSVGElement {
  const { stage } = source;
  const box = stage.getBoundingClientRect();
  if (!source.isCurrent() || !box.width || !box.height) throw new Error('svg.view_required');
  const doc = stage.ownerDocument;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(box.width)); svg.setAttribute('height', String(box.height));
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const style = doc.createElementNS(SVG, 'style');
  style.textContent = `@font-face{font-family:Roboto;src:url(data:font/ttf;base64,${PDF_FONT_BASE64}) format('truetype')}*{animation:none!important;transition:none!important}`;
  svg.append(style);
  const excluded = (el: Element): boolean => el.matches(CHROME)
    || (!options.devices && el.matches(DEVICE))
    || (!options.decor && el.matches('.decorlayer'))
    || (!options.roomNames && el.matches('.roomlabel'))
    || (!options.backdrop && el.matches('[data-hp="backdrop"]'));

  const computed = (el: Element) => doc.defaultView!.getComputedStyle(el);
  const inline = (from: Element, to: Element, pseudo?: string): void => {
    const css = doc.defaultView!.getComputedStyle(from, pseudo);
    const target = (to as HTMLElement | SVGElement).style;
    for (const property of css) {
      if (property.startsWith('--') || property === 'content' || property === 'cursor') continue;
      const value = css.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)'"\s]+)["']?\)/g, 'url(#$1)');
      target.setProperty(property, value);
    }
    target.setProperty('animation', 'none', 'important');
    target.setProperty('transition', 'none', 'important');
    target.setProperty('pointer-events', 'none');
  };
  const clone = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '');
    if (!(node instanceof Element) || excluded(node)) return null;
    if (node.matches('script,style,link,iframe,object,embed,audio,video')) return null;
    if (node.matches('canvas')) throw new Error('svg.asset_failed');
    const css = computed(node);
    if (css.display === 'none') return null;
    const custom = node.localName.includes('-');
    const copy = custom ? doc.createElementNS(HTML, 'span') : node.cloneNode(false) as Element;
    for (const attr of [...copy.attributes]) {
      if (/^on/i.test(attr.name) || attr.name.startsWith('data-') || /^(aria-|title$|tabindex$|srcset$)/.test(attr.name)) copy.removeAttribute(attr.name);
      if (/^(href|xlink:href|src)$/.test(attr.name) && !node.matches('image,img,use')) copy.removeAttribute(attr.name);
    }
    inline(node, copy);
    const pseudo = (name: string) => {
      if (node.namespaceURI === SVG || custom) return;
      const p = doc.defaultView!.getComputedStyle(node, name);
      if (p.content === 'none' || p.content === 'normal' || p.display === 'none') return;
      const span = doc.createElementNS(HTML, 'span'); inline(node, span, name);
      span.textContent = p.content === '""' ? '' : p.content.replace(/^["']|["']$/g, ''); copy.append(span);
    };
    pseudo('::before');
    const children = node.localName === 'slot' ? (node as HTMLSlotElement).assignedNodes({ flatten: true })
      : node.shadowRoot ? node.shadowRoot.childNodes : node.childNodes;
    for (const child of children) { const next = clone(child); if (next) copy.appendChild(next); }
    pseudo('::after');
    return copy;
  };

  const background = doc.createElementNS(SVG, 'rect');
  background.setAttribute('width', '100%'); background.setAttribute('height', '100%');
  background.setAttribute('fill', options.background === 'custom' ? options.color : computed(stage).backgroundColor);
  background.setAttribute('opacity', String(options.background === 'custom' ? options.opacity : 1));
  if (options.background !== 'transparent') svg.append(background);

  // Keep native scene SVGs native; only HTML presentation (labels/markers/sky)
  // uses standard foreignObject. Geometry is never a screenshot.
  const append = (node: Element): void => {
    if (excluded(node) || computed(node).display === 'none') return;
    if (node.matches('.zoomwrap')) {
      [...node.children].sort((a, b) => (parseInt(computed(a).zIndex) || 0) - (parseInt(computed(b).zIndex) || 0)).forEach(append);
      return;
    }
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const copy = clone(node) as HTMLElement | SVGSVGElement | null;
    if (!copy) return;
    copy.style.position = 'static'; copy.style.margin = '0'; copy.style.transform = 'none';
    copy.style.width = `${rect.width}px`; copy.style.height = `${rect.height}px`;
    if (copy.namespaceURI === SVG) {
      copy.setAttribute('x', String(rect.left - box.left)); copy.setAttribute('y', String(rect.top - box.top));
      copy.setAttribute('width', String(rect.width)); copy.setAttribute('height', String(rect.height));
      svg.append(copy);
    } else {
      const foreign = doc.createElementNS(SVG, 'foreignObject');
      foreign.setAttribute('x', String(rect.left - box.left)); foreign.setAttribute('y', String(rect.top - box.top));
      foreign.setAttribute('width', String(rect.width)); foreign.setAttribute('height', String(rect.height));
      const wrapper = doc.createElementNS(HTML, 'div');
      wrapper.style.cssText = `position:relative;width:${rect.width}px;height:${rect.height}px;overflow:visible`;
      // The layer remains a positioning parent for absolute room/device children.
      copy.style.position = 'relative'; copy.style.left = '0'; copy.style.top = '0';
      wrapper.append(copy); foreign.append(wrapper); svg.append(foreign);
    }
  };
  for (const child of [...stage.children]) {
    if (child.matches('.zoomwrap') || options.background === 'current' && child.matches('.hp-day-cycle-env,.hp-moon-sky')) append(child);
  }
  return svg;
}

export function assertSvgBudget(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > LIMIT) throw new Error('svg.too_large');
}

/** Embed every referenced asset in the already detached, immutable frame. */
export async function finishSvgView(svg: SVGSVGElement): Promise<string> {
  const assets = new Map<string, Promise<string>>();
  let bytes = 0;
  const embed = (url: string): Promise<string> => {
    if (url.startsWith('#')) return Promise.resolve(url);
    const found = assets.get(url); if (found) return found;
    const result = (async () => {
      const parsed = new URL(url, location.href);
      if (!['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol)
        || ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== location.origin) throw new Error('svg.asset_failed');
      const response = await fetch(parsed.href, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('svg.asset_failed');
      const mime = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(mime)) throw new Error('svg.asset_failed');
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 0) assertSvgBudget(bytes + length);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('svg.asset_failed');
      const parts: BlobPart[] = [];
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength; assertSvgBudget(bytes);
          parts.push(chunk.value as BlobPart);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      finally { reader.releaseLock(); }
      const blob = new Blob(parts, { type: mime });
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('svg.asset_failed')); reader.readAsDataURL(blob);
      });
    })();
    assets.set(url, result); return result;
  };
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of ['href', 'xlink:href', 'src']) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, await embed(el.getAttribute(attr)!));
    }
    const style = (el as HTMLElement | SVGElement).style;
    if (!style) continue;
    for (const property of [...style]) {
      let value = style.getPropertyValue(property);
      for (const match of [...value.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)]) {
        const url = match[1]; if (url.startsWith('#')) continue;
        value = value.replace(match[0], `url("${await embed(url)}")`);
      }
      style.setProperty(property, value, style.getPropertyPriority(property));
    }
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}
