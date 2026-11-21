import { render, type TemplateResult } from 'lit';
import type { SvgViewSource } from './svg-snapshot';

/**
 * Lay out an inert export frame in the card's shadow root so the usual SVG
 * capture can resolve styles and icon shadow DOM. This is not another card:
 * no live state, HA subscriptions, camera or input handlers are installed.
 */
export async function prepareSvgFlatStage(
  live: HTMLElement,
  scene: TemplateResult,
  isCurrent: () => boolean,
  isoStage: SVGSVGElement,
): Promise<SvgViewSource> {
  const doc = live.ownerDocument, root = live.parentNode;
  const size = live.getBoundingClientRect();
  if (!root || !isCurrent() || !(size.width > 0 && size.height > 0)) throw new Error('svg.not_ready');
  const wrapper = doc.createElement('div');
  wrapper.inert = true;
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;contain:layout paint';
  const stage = doc.createElement('div');
  stage.className = ['stage', 'mode-view', ...[...live.classList].filter(c =>
    c === 'noplan' || c === 'daycycle' || c.startsWith('theme-') || c.startsWith('phase-'))].join(' ');
  stage.style.cssText = live.style.cssText;
  Object.assign(stage.style, { width: size.width + 'px', height: size.height + 'px', margin: '0' });
  wrapper.append(stage);
  root.appendChild(wrapper);
  const dispose = () => {
    render(null, stage);
    wrapper.remove();
  };
  try {
    render(scene, stage);
    for (const [from, to] of [
      ['[data-hp-export-floor-light]', '[data-hp-export-light-slot]'],
      ['.iso-led-plane', '[data-hp-export-led-slot]'],
    ]) {
      const source = isoStage.querySelector(from), target = stage.querySelector(to);
      if (source && target) for (const child of source.childNodes) target.appendChild(child.cloneNode(true));
    }
    const docWindow = doc.defaultView;
    if (!docWindow) throw new Error('svg.not_ready');
    // HA icons can resolve asynchronously after Lit installs the node. Take
    // the complex shadow content only after the icon is present, or refuse
    // the export instead of emitting a partial plan.
    const icons = [...stage.querySelectorAll('ha-icon')];
    const deadline = performance.now() + 1500;
    const painted = (icon: Element) => !!icon.shadowRoot?.querySelector('svg path, svg use, img, ha-svg-icon')
      || !!icon.querySelector('svg path, svg use, img');
    while (icons.some(icon => !painted(icon))) {
      if (!isCurrent()) throw new Error('svg.cancelled');
      if (performance.now() >= deadline) throw new Error('svg.not_ready');
      await new Promise(resolve => docWindow.setTimeout(resolve, 24));
    }
    if (!isCurrent()) throw new Error('svg.cancelled');
    return { stage, dispose, isCurrent };
  } catch (error) {
    dispose();
    throw error;
  }
}
