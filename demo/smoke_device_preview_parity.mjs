// Shared face parity for the same live light on the full plan, the marker
// editor preview and houseplan-space-card.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const face = (node) => {
    if (!node) return null;
    const semantic = ['on', 'open', 'alarm', 'unavail', 'valonly', 'activity-running', 'activity-event', 'activity-presence', 'activity-transition'];
    return {
      classes: semantic.filter((name) => node.classList.contains(name)),
      icon: node.querySelector(':scope > ha-icon')?.getAttribute('icon') || '',
      value: node.querySelector('.valtext')?.textContent?.trim() || '',
      temp: node.querySelector('.tval')?.textContent?.trim() || '',
      hum: node.querySelector('.hval')?.textContent?.trim() || '',
      scale: node.style.getPropertyValue('--dev-scale'),
      rippleScale: node.style.getPropertyValue('--ripple-scale'),
      rippleColor: node.style.getPropertyValue('--ripple-color'),
    };
  };

  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  const planFace = face(sr().querySelector('.dev[data-id="d_light1"]'));

  c._setMode('devices');
  const device = c._devices.find((item) => item.id === 'd_light1');
  c._openMarkerDialog(device);
  await c.updateComplete;
  const preview = sr().querySelector('hp-device-preview');
  await preview?.updateComplete;
  const previewFace = face(preview?.renderRoot?.querySelector('.dev'));
  const providerShown = /demo/i.test(preview?.renderRoot?.querySelector('.previewfacts')?.textContent || '');

  await customElements.whenDefined('houseplan-space-card');
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = c.hass;
  document.body.appendChild(card);
  const started = Date.now();
  while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() - started < 6000) await wait(60);
  await card.updateComplete;
  const staticNode = card.renderRoot.querySelector('.dev[data-id="d_light1"]');
  const staticFace = face(staticNode);

  return {
    allFacesPresent: !!planFace && !!previewFace && !!staticFace,
    planPreviewEqual: JSON.stringify(planFace) === JSON.stringify(previewFace),
    planStaticEqual: JSON.stringify(planFace) === JSON.stringify(staticFace),
    providerShown,
    staticBindingHook: staticNode?.getAttribute('data-binding-status') === 'active',
  };
});

checkAll(res);
await finish(browser, res);
