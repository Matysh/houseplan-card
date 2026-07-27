// Ревью R3-2: houseplan-space-card подписывала URL подложки и выбрасывала
// результат — getCardSize() правил временную модель, а render() строил свою
// заново из конфига, поэтому <image> запрашивал сырой requires_auth-путь и на
// каждом рендере получал 401. Проверяем весь контракт подписи для этой карточки.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  await customElements.whenDefined('houseplan-space-card');
  const main = window.__card;
  const raw = '/api/houseplan/content/plans/_/f1.tok.svg';

  // подложка на защищённом эндпоинте + управляемый ответ на подпись
  const cfg = JSON.parse(JSON.stringify(main._serverCfg));
  cfg.spaces = cfg.spaces.map((s) => (s.id === 'f1' ? { ...s, plan_url: raw } : s));
  let signCalls = 0;
  let failFirst = true;
  const requestedHrefs = [];
  const hass = { ...main.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: {} };
    if (m.type === 'houseplan/content/sign') {
      signCalls++;
      if (failFirst && signCalls === 1) throw new Error('ws down');
      const urls = {};
      for (const p of m.paths) urls[p] = p + '?authSig=SIG' + signCalls;
      return { urls };
    }
    return { ok: true };
  } };

  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = hass;
  host.appendChild(card);

  const stage = async () => {
    const t0 = Date.now();
    while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
      await new Promise((r) => setTimeout(r, 60));
    }
    await card.updateComplete;
    return card.renderRoot.querySelector('.hp-static-stage svg image');
  };
  const href = async () => { const im = await stage(); return im ? im.getAttribute('href') : null; };

  // 1) первая подпись упала → сырой URL в DOM не попадает (иначе 401)
  await stage();
  await new Promise((r) => setTimeout(r, 120));
  out.hrefAfterFailedSign = await href();

  // 2) повтор после ошибки: pending освобождён, вторая попытка проходит
  card.requestUpdate(); await card.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  out.hrefAfterRetry = await href();
  out.retried = signCalls >= 2;

  // 3) повторный рендер не теряет подпись и не просит её заново
  const before = signCalls;
  card.requestUpdate(); await card.updateComplete;
  out.hrefStable = await href();
  out.noExtraSignOnRerender = signCalls === before;

  // 4) протухшая подпись не отдаётся, стареющая — отдаётся, пока едет замена
  const ent = card._signer.entries;
  ent[raw] = { url: raw + '?authSig=OLD', at: Date.now() - 25 * 3600 * 1000 };
  card.requestUpdate(); await card.updateComplete;
  out.hrefWhenExpired = await href();
  ent[raw] = { url: raw + '?authSig=AGING', at: Date.now() - 20 * 3600 * 1000 };
  card.requestUpdate(); await card.updateComplete;
  out.hrefWhenAging = await href();

  // ни один сырой (неподписанный) путь не должен уходить в сеть
  for (const im of card.renderRoot.querySelectorAll('image')) requestedHrefs.push(im.getAttribute('href'));
  out.noRawHrefEver = !requestedHrefs.includes(raw);
  return out;
});
// зафиксировано прогоном на v1.45.1 и сверено с кодом
checkAll(res, {
  hrefAfterFailedSign: null,
  hrefAfterRetry: '/api/houseplan/content/plans/_/f1.tok.svg?authSig=SIG2',
  retried: true,
  hrefStable: '/api/houseplan/content/plans/_/f1.tok.svg?authSig=SIG2',
  noExtraSignOnRerender: true,
  hrefWhenExpired: null,
  hrefWhenAging: '/api/houseplan/content/plans/_/f1.tok.svg?authSig=AGING',
  noRawHrefEver: true,
});
await finish(browser);
