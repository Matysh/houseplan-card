// Ревью R2-2: бэкенд подписывает не более MAX_SIGN_PATHS путей за вызов и
// молча отбрасывает остальные. Карточка обязана бить запрос на батчи, помнить
// возраст подписи и чистить кэш от ссылок, которых в конфиге больше нет —
// иначе на настенном планшете «лишние» записи протухают навсегда.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const base = c.hass.callWS;
  const batchSizes = [];
  let round = 0;

  // This probe owns its signer authority. Reusing the demo card's connection
  // would intentionally share its cache and make the batch contract depend on
  // whichever smoke content the main card has already rendered.
  c.hass = { ...c.hass, connection: Object.create(c.hass.connection), callWS: async (m) => {
    if (m.type === 'houseplan/content/sign') {
      batchSizes.push(m.paths.length);
      const urls = {};
      // как настоящий бэкенд: не больше 200 за раз, про остальные — молчание
      for (const p of m.paths.slice(0, 200)) urls[p] = p.split('?')[0] + '?authSig=R' + round;
      return { urls };
    }
    return base(m);
  } };

  // 201 вложение, разложенное по маркерам: столько же подписанных ссылок
  const pdfs = [];
  for (let i = 0; i < 201; i++) pdfs.push({ name: 'm' + i, url: '/api/houseplan/content/files/m/doc' + i + '.pdf' });
  c._serverCfg = {
    ...c._serverCfg,
    markers: [{
      id: 'mk1', binding: 'virtual', name: 'Attachment probe', space: c._space, pdfs,
    }],
  };
  c._cfgEpoch++;

  round = 1;
  for (const p of pdfs) c._display(p.url);
  await new Promise((r) => setTimeout(r, 120));
  out.firstBatches = [...batchSizes];
  out.signedAfterFirst = Object.keys(c._signer.entries).length;

  // переподписывание: все 201, снова батчами, ни одна запись не остаётся старой
  batchSizes.length = 0;
  round = 2;
  c._resign();
  await new Promise((r) => setTimeout(r, 120));
  out.resignBatches = [...batchSizes];
  const vals = Object.values(c._signer.entries).map((v) => v.url);
  out.allRefreshed = vals.length === 201 && vals.every((u) => u.endsWith('authSig=R2'));

  // ссылка, исчезнувшая из конфига, выбывает из кэша и не занимает слот
  c._serverCfg = {
    ...c._serverCfg,
    markers: [{
      id: 'mk1', binding: 'virtual', name: 'Attachment probe', space: c._space,
      pdfs: pdfs.slice(0, 5),
    }],
  };
  c._cfgEpoch++;
  batchSizes.length = 0;
  round = 3;
  c._resign();
  await new Promise((r) => setTimeout(r, 120));
  out.prunedTo = Object.keys(c._signer.entries).length;
  out.pruneBatches = [...batchSizes];

  // протухшая подпись не отдаётся: она вернула бы 401 и «попытку входа»
  const one = pdfs[0].url;
  c._signer.shared.signed[one] = {
    url: one + '?authSig=OLD', at: Date.now() - 25 * 3600 * 1000, loaded: true,
  };
  out.expiredNotServed = c._display(one) === '';
  out.expiredDropped = c._signer.entries[one] === undefined;
  // а стареющая, но ещё живая — отдаётся, пока едет замена
  c._signer.shared.signed[one] = {
    url: one + '?authSig=AGING', at: Date.now() - 20 * 3600 * 1000, loaded: true,
  };
  out.agingStillServed = c._display(one) === one + '?authSig=AGING';
  return out;
});
// зафиксировано прогоном на v1.45.0 и сверено с кодом
checkAll(res, {
  firstBatches: [200, 1],
  signedAfterFirst: 201,
  resignBatches: [200, 1],
  allRefreshed: true,
  prunedTo: 5,
  pruneBatches: [5],
  expiredNotServed: true,
  expiredDropped: true,
  agingStillServed: true,
});
await finish(browser);
