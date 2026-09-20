/* Shared UI primitives for the demo forms: icons, escaping, the "?" help tooltip and the toast.
   Form-specific state stays in each form module. */
export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clone = value => JSON.parse(JSON.stringify(value));

export const icons = {
  floor:'<path d="M3 3h18v18H3zM3 11h8V3m0 8v6H3m13 4V11h5m-6-4h6M7 17v4"/>',
  sliders:'<path d="M4 6h7m4 0h5M4 12h2m4 0h10M4 18h10m4 0h2"/><circle cx="13" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.6 1.6 0 0 1 1-2.8h2A4 4 0 0 0 21 10c0-4-4-7-9-7Z"/><circle cx="7.5" cy="10" r=".6"/><circle cx="11" cy="6.8" r=".6"/><circle cx="16" cy="8.5" r=".6"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h3m3 0h4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  close:'<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z" fill="currentColor" stroke="none"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>',
  help:'<path d="M11 18h2v-2h-2v2M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" fill="currentColor" stroke="none"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 16-6-6L5 21"/>',
  draw:'<path d="M13 4H4v16h16v-9M9 15l1-4L19 2l3 3-9 9-4 1Zm8-11 3 3"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2H3v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10"/>',
  borders:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h.1M12 3h.1M21 12h.1M12 21h.1"/>',
  type:'<path d="M4 5V3h16v2M12 3v18m-4 0h8"/>',
  zigbee:'<path d="M58.4999 67.1667H61.8333V72.1667H58.4999V67.1667ZM65.1666 72.1667H68.4999V67.1667H65.1666V72.1667ZM46.8333 38.8333V42.1667H80.1666V38.8333H46.8333ZM58.4999 58.8333V63.8333H68.4999V58.8333C72.6666 56.45 76.8333 53.8333 76.8333 45.5H50.1666C50.1666 53.8333 54.3333 56.45 58.4999 58.8333Z" transform="translate(-26.1 -21.3) scale(.6)" fill="currentColor" stroke="none"/>',
  sofa:'<path d="M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M5 18H3V11h4v4h10v-4h4v7H5Zm0 0v3m14-3v3"/>',
  door:'<path d="M4 21V3h15v18M4 21h17M7 21V5l9 2v14M12 13h.1"/>',
  temperature:'<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Zm3-6v10"/>',
  humidity:'<path d="M12 3s7 8 7 12a7 7 0 0 1-14 0c0-4 7-12 7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/>',
  bulb:'<path d="M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3Zm1 6h6"/>',
  eyeOff:'<path d="m3 3 18 18M10.5 10.5a2 2 0 0 0 3 3M6 6a17 17 0 0 0-4 6s4 7 10 7a13 13 0 0 0 5-1M9 5a13 13 0 0 1 3 0c6 0 10 7 10 7a16 16 0 0 1-3 4"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/>',
  reset:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  link:'<path d="m9 15 6-6"/><path d="M11 6l1-1a5 5 0 0 1 7 7l-1 1M13 18l-1 1a5 5 0 0 1-7-7l1-1"/>',
  radar:'<path d="M12 12 6 6"/><path d="M4 12a8 8 0 0 0 16 0M7 12a5 5 0 0 0 10 0M10 12a2 2 0 0 0 4 0"/>',
  tooltip:'<path d="M4 4h16v11H9l-5 4Z"/><path d="M8 8h8M8 11h5"/>',
  wall:'<path d="M3 6h18v12H3zM3 10h18M3 14h18M9 6v4m6 0v4M9 14v4m3-8v4"/>',
  broom:'<path d="M19.36 2.72l1.42 1.42-5.72 5.71c1.07 1.54 1.22 3.39.32 4.59L9.06 8.12c1.2-.9 3.05-.75 4.59.32l5.71-5.72M5.93 17.57c-2.01-2.01-3.24-4.41-3.58-6.65l4.88-2.09 7.44 7.44-2.09 4.88c-2.24-.34-4.64-1.57-6.65-3.58Z" fill="currentColor" stroke="none"/>',
  wifi:'<path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M11 18h2"/>',
  refresh:'<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.sliders}</svg>`;
export const hydrateIcons = (scope = document) => $$('[data-icon]', scope).forEach(el => { el.innerHTML = icon(el.dataset.icon); });

/* Toast: one shared status line at the bottom of the page. */
let toastTimer;
export function showToast(message) {
  const toast = $('#toast');
  clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}

/* Help: "?" trigger with a floating tooltip, mirrors the product's hp-help
   (hover, click or focus opens; Escape, outside click or leaving closes). One surface serves every form. */
const helpPopover = document.createElement('div');
helpPopover.id = 'help-popover'; helpPopover.className = 'help-popover'; helpPopover.setAttribute('role', 'tooltip'); helpPopover.hidden = true;
document.body.append(helpPopover);
let helpTrigger = null, helpPinned = false, helpText = () => '';
function positionHelp() {
  if (!helpTrigger) return;
  const margin = 8, gap = 6, a = helpTrigger.getBoundingClientRect();
  helpPopover.style.maxWidth = `${Math.max(0, Math.min(320, innerWidth - margin * 2))}px`;
  const r = helpPopover.getBoundingClientRect();
  const left = Math.min(Math.max(margin, a.left), innerWidth - margin - r.width);
  let top = a.bottom + gap, side = 'bottom';
  if (top + r.height > innerHeight - margin && a.top - gap - r.height >= margin) { top = a.top - gap - r.height; side = 'top'; }
  helpPopover.style.left = `${Math.round(left)}px`; helpPopover.style.top = `${Math.round(top)}px`; helpPopover.dataset.side = side;
}
function openHelp(button, pinned) {
  if (helpTrigger && helpTrigger !== button) helpTrigger.setAttribute('aria-expanded', 'false');
  helpTrigger = button; helpPinned = pinned || (helpPinned && helpTrigger === button);
  helpPopover.textContent = helpText(button.dataset.help);
  helpPopover.hidden = false; button.setAttribute('aria-expanded', 'true');
  positionHelp();
}
export function closeHelp() {
  if (!helpTrigger) return;
  helpTrigger.setAttribute('aria-expanded', 'false'); helpTrigger = null; helpPinned = false; helpPopover.hidden = true;
}
export const helpOpen = () => !!helpTrigger;
document.addEventListener('pointerdown', e => { if (helpTrigger && !e.target.closest('button[data-help]') && !helpPopover.contains(e.target)) closeHelp(); }, true);
addEventListener('resize', () => { if (helpTrigger) positionHelp(); });
/* Bind the triggers inside `scope` to a dictionary { key: [title, text] }; `scroller` keeps the tooltip anchored while the form scrolls. */
export function attachHelp(scope, scroller, copy) {
  const text = key => copy[key][1];
  scope.addEventListener('click', e => {
    const button = e.target.closest('button[data-help]'); if (!button) return;
    helpText = text;
    if (helpTrigger === button && helpPinned) closeHelp(); else openHelp(button, true);
  });
  scope.addEventListener('pointerover', e => {
    const button = e.target.closest('button[data-help]');
    if (!button || e.pointerType === 'touch' || helpPinned) return;
    helpText = text; openHelp(button, false);
  });
  scope.addEventListener('pointerout', e => {
    const button = e.target.closest('button[data-help]');
    if (button && helpTrigger === button && !helpPinned && !button.contains(e.relatedTarget)) closeHelp();
  });
  scope.addEventListener('focusin', e => { const b = e.target.closest('button[data-help]'); if (b && !helpPinned) { helpText = text; openHelp(b, false); } });
  scope.addEventListener('focusout', e => { const b = e.target.closest('button[data-help]'); if (b && helpTrigger === b && !helpPinned) closeHelp(); });
  scroller.addEventListener('scroll', () => { if (helpTrigger) positionHelp(); }, { passive: true });
  return { button: key => `<button type="button" class="help-button" data-help="${key}" aria-label="Help: ${escape(copy[key][0])}" aria-expanded="false" title="Help: ${escape(copy[key][0])}">${icon('help')}</button>` };
}
