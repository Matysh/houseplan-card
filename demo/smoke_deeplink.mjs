// Smoke: the full houseplan-card honours the #space=<id> deep-link (hashchange).
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 820, height: 760 }, 1);
const res = await page.evaluate(async () => {
  const card = window.__card;
  const ids = card._model.map((s) => s.id);
  const target = ids[1] || ids[0];
  const before = card._space;
  // simulate a deep-link arriving on the already-open dashboard
  window.location.hash = '#space=' + target;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await card.updateComplete;
  const after = card._space;
  // invalid hash must be ignored
  window.location.hash = '#space=__nope__';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await card.updateComplete;
  const afterBad = card._space;
  window.location.hash = '';
  return { ids, before, target, after, afterBad };
});
await browser.close();
const ok = res.after === res.target && res.afterBad === res.target;
console.log(JSON.stringify(res));
if (!ok) { console.error('FAIL deeplink smoke'); process.exit(1); }
console.log('OK deep-link: full card switches to #space=<id>, ignores invalid ids');
