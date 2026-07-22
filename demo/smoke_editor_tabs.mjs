import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const tabs = () => [...sr().querySelectorAll('.modetab')];
  // 1) две вкладки, Просмотра нет, крестиков в неактивных нет
  out.twoTabs = tabs().length === 3; // третья — Редактор подложки (v1.33.0)
  out.labels = tabs().map((t) => t.textContent.trim());
  out.noCrossIdle = sr().querySelectorAll('.modetab .closex').length === 0;
  out.startView = c._mode === 'view';
  // 2) клик по «Редактор плана» → активна, панель с крестиком
  tabs()[0].click(); await c.updateComplete;
  out.planActive = c._mode === 'plan' && tabs()[0].classList.contains('active');
  out.planBar = !!sr().querySelector('.editbar');
  out.planBarClose = !!sr().querySelector('.editbar .barclose');
  out.tabCross = !!tabs()[0].querySelector('.closex');
  // 3) повторный клик по активной вкладке — ничего
  tabs()[0].click(); await c.updateComplete;
  out.reclickNoop = c._mode === 'plan';
  // 4) прямое переключение План → Устройства
  tabs()[1].click(); await c.updateComplete;
  out.directSwitch = c._mode === 'devices';
  out.devBar = !!sr().querySelector('.editbar.devbar');
  out.devBarBtns = sr().querySelectorAll('.editbar.devbar .btn:not(.barclose)').length === 3; // add/show-all/rules (v1.33.2: Reset removed)
  // 5) инструменты устройств из шапки исчезли (в .bar их больше нет)
  out.headerCleanInDev = !sr().querySelector('.bar > .btn[title*="' + (c._t('title.add_device')) + '"]');
  // 6) крестик на панели → Просмотр
  sr().querySelector('.editbar .barclose').click(); await c.updateComplete;
  out.barCloseWorks = c._mode === 'view' && !sr().querySelector('.editbar');
  // 7) крестик в самой вкладке → Просмотр (и не переключает режим)
  tabs()[1].click(); await c.updateComplete;
  tabs()[1].querySelector('.closex').click(); await c.updateComplete;
  out.tabCrossWorks = c._mode === 'view';
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
