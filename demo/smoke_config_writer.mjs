// HP-1454-03: две локальные правки уходили с одной ревизией, вторая терялась.
// Debounce разносил только СТАРТЫ. Если первый config/set отвечал дольше 500 мс,
// вторая правка уходила с тем же expected_rev, сервер принимал первую и
// отклонял вторую как conflict — а обработчик конфликта перечитывал серверную
// копию поверх локальной. Правка исчезала, и тост винил «другое окно».
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const base = c.hass.callWS;
  const writes = [];
  let rev = 10;
  let releaseFirst;
  const firstGate = new Promise((r) => { releaseFirst = r; });

  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/set') {
      const n = writes.length + 1;
      writes.push({ expected: m.expected_rev, titles: m.config.spaces.map((s) => s.title) });
      if (n === 1) await firstGate;                  // первый ответ задержан
      if (m.expected_rev !== rev) { const e = new Error('conflict'); e.code = 'conflict'; throw e; }
      rev += 1;
      return { ok: true, rev };
    }
    if (m.type === 'houseplan/config/get') {
      const r = await base(m);
      return { config: JSON.parse(JSON.stringify(r.config)), rev };
    }
    return base(m);
  } };
  c._cfgRev = rev;

  // правка №1 и, пока первая запись висит, правка №2
  c._serverCfg.spaces[0].title = 'FIRST';
  c._saveConfig();
  c._saveConfigDebounced.flush();
  await new Promise((r) => setTimeout(r, 30));
  out.oneInFlight = writes.length === 1;

  c._serverCfg.spaces[0].title = 'SECOND';
  c._saveConfig();
  c._saveConfigDebounced.flush();
  await new Promise((r) => setTimeout(r, 30));
  out.stillOneInFlight = writes.length === 1;   // вторая ждёт очереди, не летит параллельно

  releaseFirst();
  await new Promise((r) => setTimeout(r, 120));

  out.writes = writes.length;
  out.revisions = writes.map((w) => w.expected);          // вторая обязана взять новую ревизию
  out.secondCarriedTheEdit = writes[1]?.titles[0] === 'SECOND';
  out.editSurvived = c._serverCfg.spaces[0].title === 'SECOND';
  out.noConflictToast = !(c._toast || '').length;
  return out;
});
// зафиксировано прогоном на v1.46.0 и сверено с кодом
checkAll(res, {
  oneInFlight: true,
  stillOneInFlight: true,
  writes: 2,
  revisions: [10, 11],
  secondCarriedTheEdit: true,
  editSurvived: true,
  noConflictToast: true,
});
await finish(browser);
