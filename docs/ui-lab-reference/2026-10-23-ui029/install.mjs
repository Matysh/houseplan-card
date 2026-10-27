// Replay glue only. The installed adapter is the unchanged accepted UI-029 file.
import { installDevicePickerRoot } from '/overrides/device-picker-kit.mjs';
if (!window.__lab?.card) throw Error('Native UI Lab failed to initialize');
const toggle = document.querySelector('#lab-styles');
toggle.checked = true;
toggle.dispatchEvent(new Event('change'));
// The accepted adapter mutates nested HA roots and is not reversible by the CSS
// toggle. Keep reference mode explicit instead of offering a misleading A/B.
toggle.disabled = true;
toggle.title = 'Фиксированный эталон UI-029';
const roots = new WeakSet();
function scan(root) {
  if (!roots.has(root)) {
    roots.add(root);
    installDevicePickerRoot(root);
    new MutationObserver(() => scan(root)).observe(root, { childList: true, subtree: true });
  }
  for (const element of root.querySelectorAll('*')) if (element.shadowRoot) scan(element.shadowRoot);
}
scan(document);
// Same delayed-shadow discovery as the historical lab, not product architecture.
setInterval(() => scan(document), 1200);
document.title = 'UI-029 reference · beta.1 · synthetic data';
