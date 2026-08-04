// «Уже загруженные» — прокручиваемый список превью внутри диалога пространства.
// Проверяем НЕ наличие узлов в DOM, а ГЕОМЕТРИЮ: scrollable-контейнер как
// flex-item в .dialog .body (flex column) схлопывается до бордера (min-height
// auto = 0 при overflow != visible), и владелец видит тонкую полоску вместо
// сетки миниатюр. Ровно этот баг уже ловили в .candlist (v1.53.1) — смок там
// смотрел только на DOM и пропустил его.
import { launch, checkAll, finish } from './serve.mjs';

const VIEWPORTS = [
  { name: 'desktop', width: 900, height: 1000 },
  { name: 'mobile', width: 390, height: 780 },
];

const out = {};
for (const vp of VIEWPORTS) {
  const { page, browser } = await launch({ width: vp.width, height: vp.height }, 1);
  const res = await page.evaluate(async (mode) => {
    const o = {};
    const c = window.__card;
    const sr = () => c.shadowRoot || c.renderRoot;
    const base = c.hass.callWS;
    const mk = (i) => ({
      name: `plan${i}.png`,
      url: `/api/houseplan/content/plans/_/plan${i}.png`,
      size: 100000 + i * 1000,
      modified: i,
      used_by: [],
    });
    let serverPlans = [mk(1), mk(2), mk(3), mk(4), mk(5), mk(6)];
    c.hass = { ...c.hass, callWS: async (m) => {
      if (m.type === 'houseplan/plans/list') return { plans: serverPlans };
      if (m.type === 'houseplan/content/sign') {
        const urls = {}; for (const p of m.paths) urls[p] = p; return { urls };
      }
      return base(m);
    } };

    const openPicker = async () => {
      c._spaceDialog = { ...c._spaceDialog, source: 'file' };
      await c.updateComplete;
      await c._toggleServerPlans();
      await new Promise((r) => setTimeout(r, 80));
      await c.updateComplete;
      await new Promise((r) => requestAnimationFrame(() => r()));
    };
    const geom = (tag) => {
      const box = sr().querySelector('.savedplans');
      const rows = [...sr().querySelectorAll('.savedplan')];
      o[tag + 'Rows'] = rows.length;
      if (!box || !rows.length) { o[tag + 'BoxTall'] = false; o[tag + 'FirstVisible'] = false; return; }
      const b = box.getBoundingClientRect();
      const r0 = rows[0].getBoundingClientRect();
      o[tag + 'BoxH'] = Math.round(b.height);
      // 2-3 ряда миниатюр: ряд ~40px + отступы
      o[tag + 'BoxTall'] = b.height >= 100;
      // первая миниатюра целиком внутри контейнера и не нулевая
      o[tag + 'FirstVisible'] = r0.height >= 32 && r0.top >= b.top - 1 && r0.bottom <= b.bottom + 1;
      // при 6 планах список не влезает целиком — должна быть прокрутка
      o[tag + 'Scrolls'] = box.scrollHeight - box.clientHeight > 8;
      box.scrollTop = 9999;
      o[tag + 'ScrollWorks'] = box.scrollTop > 8;
      box.scrollTop = 0;
    };

    // 1. диалог создания пространства
    c._openSpaceDialog('create');
    await c.updateComplete;
    await openPicker();
    geom('create');

    // 2. диалог настроек существующего пространства
    c._spaceDialog = null; await c.updateComplete;
    c._openSpaceDialog('edit', 'f1');
    await c.updateComplete;
    await openPicker();
    geom('edit');

    // 3. пусто: аккуратная надпись, а не схлопнутая полоска
    serverPlans = [];
    c._spaceDialog = { ...c._spaceDialog, pickSaved: false };
    await c.updateComplete;
    await openPicker();
    const empty = sr().querySelector('.savedplans');
    o.emptyHasText = !!empty && empty.textContent.trim().length > 0;
    o.emptyTall = !!empty && empty.getBoundingClientRect().height >= 24;
    o.mode = mode;
    return o;
  }, vp.name);
  for (const [k, v] of Object.entries(res)) out[vp.name + '.' + k] = v;
  await browser.close();
}

console.log(JSON.stringify(out, null, 1));
checkAll(out, {
  'desktop.createRows': 6,
  'desktop.editRows': 6,
  'desktop.createBoxH': out['desktop.createBoxH'],
  'desktop.editBoxH': out['desktop.editBoxH'],
  'desktop.mode': 'desktop',
  'mobile.createRows': 6,
  'mobile.editRows': 6,
  'mobile.createBoxH': out['mobile.createBoxH'],
  'mobile.editBoxH': out['mobile.editBoxH'],
  'mobile.mode': 'mobile',
});
await finish(null);
