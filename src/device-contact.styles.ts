/** Contact-only CSS arrives with the fingerprinted live renderer, never View's entry. */
import { css } from 'lit';

export const deviceContactStyles = css`
  .device-contact-ink { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
  /* An inline SVG joins a font-sized line box and drifts below small cores. */
  .device-contact-ink > svg { display: block; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .device-contact-contour {
    fill: none; stroke: var(--device-shell-stroke);
    stroke-width: var(--device-shell-border-width);
    /* Match the ordinary CSS border's used whole-pixel width, not an
       independently scaled SVG user-unit stroke. Keep the fallback above. */
    stroke-width: round(down, var(--device-shell-border-width), 1px);
    vector-effect: non-scaling-stroke; pointer-events: none;
    filter: drop-shadow(0 2px 3px rgb(37 40 45 / 16%));
  }
  .device-contact-contour.grouped { stroke: var(--device-shell-base-stroke); }
  .device-contact-hit { fill: transparent; stroke: none; pointer-events: all; }
  .hp-static-stage .device-contact-hit { pointer-events: none; }
  .dev[data-hp-device-contact] .device-shell-frame { opacity: 0; pointer-events: none; transition: none; }
  /* marker.mjs dimensions expressed through the unchanged 80-unit core.
     Actual flex/text fit owns the bbox, not the approximate 2.15/1.16/1.8
     prototype boxes. Standalone badges keep their existing presentation. */
  .dev[data-hp-device-contact] .device-shell { gap: calc(var(--dev-size) * .12875); }
  .dev[data-hp-device-contact] .device-shell.pos-top,
  .dev[data-hp-device-contact] .device-shell.pos-bottom { gap: calc(var(--dev-size) * .23175); }
  .dev[data-hp-device-contact] .value-badge {
    min-width: calc(var(--dev-size) * 1.351875);
    height: calc(var(--dev-size) * .79825);
    border-radius: calc(var(--dev-size) * .399125);
    font-size: calc(var(--dev-size) * var(--value-font-scale, .45) * .729583333333);
  }
  .dev[data-hp-device-contact] .device-shell.pos-top .value-badge,
  .dev[data-hp-device-contact] .device-shell.pos-bottom .value-badge { min-width: calc(var(--dev-size) * 1.21025); }
  .dev[data-hp-device-contact] .device-core,
  .dev[data-hp-device-contact] .value-badge { filter: drop-shadow(0 3px 4px rgb(37 40 45 / 19%)); }
  .dev[data-hp-device-contact]:focus-visible .device-core,
  .dev[data-hp-device-contact].sel .device-core { outline: 2px solid #0c82f0; outline-offset: 2px; }
`;

const roots = new WeakSet<object>(), sheets = new WeakMap<Document,CSSStyleSheet>();
/** Append our own sheet without replacing Lit's or capture's managed sheets. */
export function adoptDeviceContactStyles(value: ParentNode): void {
  if (roots.has(value)) return;
  const root = value as ShadowRoot, doc = root.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && root.adoptedStyleSheets) {
    let sheet = sheets.get(doc);
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(deviceContactStyles.cssText); sheets.set(doc,sheet); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets,sheet];
  } else {
    const style = doc.createElement('style'); style.textContent = deviceContactStyles.cssText; root.append(style);
  }
  roots.add(root);
}
