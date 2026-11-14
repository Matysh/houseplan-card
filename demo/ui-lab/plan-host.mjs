/** Optional plan-only UI Lab entry; leaves the normal fixture/session path unchanged. */
import { installNetworkGuard } from './session.mjs';
installNetworkGuard(window);
window.__labLanguage = 'en';
try {
  await import('/assets/icons.js');
  await import('/ha-bootstrap.mjs');
  await import('/assets/houseplan-card.js');
  const { createPlanHostFixture } = await import('/plan-host-fixture.js');
  const fixture = await (await fetch('/fixture.json')).json();
  const lab = createPlanHostFixture(fixture.config);
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'Plan-host lab', language: 'en' });
  card.planHost = lab.host;
  document.querySelector('#product').replaceChildren(card);
  window.__planHostLab = lab; window.__card = card;
} catch (error) { document.querySelector('#product').textContent = `Plan-host lab failed: ${error.message}`; throw error; }
