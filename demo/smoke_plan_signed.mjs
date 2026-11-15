// Подложка (фон плана) лежит за requires_auth-эндпоинтом: браузер не умеет
// авторизовать <image href>, поэтому карточка просит бэкенд подписать путь.
// Регрессия 2026-07-27: _display() вызывался внутри _buildModel(), а модель
// мемоизируется по отпечатку конфига — неподписанный url «замерзал» в кэше,
// подпись до <image> не доезжала. План не отображался никогда, а браузер
// продолжал дёргать неподписанный путь → 401 → HA писал «неудачный вход»
// с собственного IP пользователя.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const unsignedRequests = [];
page.on('request', request => {
  const url = new URL(request.url());
  if (url.pathname === '/api/houseplan/content/plans/_/f1.svg' && !url.searchParams.has('authSig'))
    unsignedRequests.push(request.url());
});
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const bgHref = () => {
    const im = sr().querySelector('.stage svg image');
    return im ? im.getAttribute('href') : null;
  };

  let signCalls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const base = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/content/sign') {
      signCalls++;
      const n = signCalls;
      if (n === 1) await gate;
      const urls = {};
      for (const p of m.paths) urls[p] = p.split('?')[0] + '?authSig=SIG' + n;
      return { urls };
    }
    return base(m);
  } };

  const previousAcceptedHref = bgHref();
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : {
    ...s, plan_url: '/api/houseplan/content/plans/_/f1.svg?v=17831509',
  })};
  c._cfgEpoch++;
  c.requestUpdate(); await c.updateComplete;

  // Until signing, either no image or exactly the already accepted old frame
  // may remain. The new unsigned path must never reach the browser.
  out.noUnsignedHrefBeforeSign = bgHref() === null
    || (bgHref() === previousAcceptedHref && c._floorHolding === true);

  release();
  await window.__hpTest.settled();

  // подпись доехала до атрибута, а не осела в кэше модели
  out.signRequested = signCalls;
  out.hrefSigned = bgHref();

  // перерисовка по состоянию HA не теряет подпись и не просит её заново
  c.requestUpdate(); await c.updateComplete;
  out.hrefAfterRerender = bgHref();
  out.signRequestedAfterRerender = signCalls;

  // ре-подпись на долгоживущем экране: старый url держится до нового ответа
  const before = bgHref();
  c._resign();
  out.resignKeepsPlan = bgHref() === before;
  await new Promise((r) => setTimeout(r, 80));
  await c.updateComplete;
  out.hrefAfterResign = bgHref();
  return out;
});
// зафиксировано прогоном на v1.44.7 и сверено с кодом
checkAll(res, {
  noUnsignedHrefBeforeSign: true,
  signRequested: 1,
  hrefSigned: '/api/houseplan/content/plans/_/f1.svg?authSig=SIG1',
  hrefAfterRerender: '/api/houseplan/content/plans/_/f1.svg?authSig=SIG1',
  signRequestedAfterRerender: 1,
  resignKeepsPlan: true,
  hrefAfterResign: '/api/houseplan/content/plans/_/f1.svg?authSig=SIG2',
});
checkAll({ noUnsignedHttpRequests: unsignedRequests.length === 0 });
await finish(browser);
