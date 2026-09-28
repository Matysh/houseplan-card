import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c0 = window.__card;
  const legacyScaleKey = 'houseplan_card_kiosk_v1';
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith('houseplan.summary-panel.v1:')) localStorage.removeItem(key);
  }
  localStorage.setItem(legacyScaleKey, JSON.stringify({ icon: 1.25, font: 0.95 }));
  const legacyScaleBefore = localStorage.getItem(legacyScaleKey);
  // создать киоск-экземпляр
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  c.hass = c0.hass;
  document.body.appendChild(c);
  c.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:99';
  await new Promise((r) => setTimeout(r, 400));
  c.hass = { ...c0.hass };
  await c.updateComplete;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) шапка скрыта
  const hdr = sr().querySelector('.hdr');
  out.headerHidden = !hdr || getComputedStyle(hdr).display === 'none';
  // 2) редакторы заблокированы
  c._setMode('plan'); await c.updateComplete;
  out.editorsBlocked = c._mode === 'view';
  // 3) центральный drag остаётся pan, а свайп из внутренней 48 px зоны
  // правого края при 1:1 переключает на соседнее пространство.
  const s0 = c._space;
  const stage = sr().querySelector('.stage');
  const fire = (type, pointerId, clientX, clientY) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId, pointerType: 'touch',
    isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX, clientY,
  }));
  const rect = stage.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const centerView = JSON.stringify(c._viewOr(c._baseVb()));
  fire('pointerdown', 1, centerX, centerY);
  fire('pointermove', 1, centerX - 150, centerY + 5);
  fire('pointerup', 1, centerX - 150, centerY + 5);
  await c.updateComplete;
  out.centralDragPansWithoutSwitching = c._space === s0
    && JSON.stringify(c._viewOr(c._baseVb())) !== centerView && c._panLock === null;
  const rightEdgeX = rect.right - 20;
  fire('pointerdown', 2, rightEdgeX, centerY);
  fire('pointermove', 2, rightEdgeX - 80, centerY + 2);
  fire('pointerup', 2, rightEdgeX - 120, centerY + 3);
  await c.updateComplete;
  out.edgeSwipeSwitches = c._space !== s0;
  out.dotsShown = !!sr().querySelector('.kioskdots');
  // 4) при зуме свайп не переключает
  c._zoom = 2; const s1 = c._space;
  const leftEdgeX = rect.left + 20;
  fire('pointerdown', 3, leftEdgeX, centerY);
  fire('pointermove', 3, leftEdgeX + 80, centerY + 2);
  fire('pointerup', 3, leftEdgeX + 120, centerY + 3);
  await c.updateComplete;
  out.noSwipeZoomed = c._space === s1;
  // 5) двойной тап сбрасывает зум
  for (const pointerId of [4, 5]) {
    fire('pointerdown', pointerId, centerX, centerY);
    fire('pointerup', pointerId, centerX + 1, centerY);
  }
  const resetStarted = performance.now();
  while (c._cameraTransition?.active) {
    if (performance.now() - resetStarted > 1000) throw new Error('double-tap camera transition did not settle');
    await new Promise((r) => requestAnimationFrame(r));
  }
  await c.updateComplete;
  out.dblTapResets = c._zoom === 1;
  // 6) локальный множитель иконок применяется
  c._saveKioskScale({ icon: 2 }); await c.updateComplete;
  const dl = sr().querySelector('.devlayer');
  const size1 = dl.getAttribute('style');
  c._saveKioskScale({ icon: 1 }); await c.updateComplete;
  const size2 = sr().querySelector('.devlayer').getAttribute('style');
  const v1 = parseFloat(size1.match(/--icon-size:([\d.]+)/)[1]);
  const v2 = parseFloat(size2.match(/--icon-size:([\d.]+)/)[1]);
  out.iconScaleWorks = Math.abs(v1 / v2 - 2) < 0.01;
  const summaryKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key) => key?.startsWith('houseplan.summary-panel.v1:'));
  const savedScale = summaryKeys.map((key) => JSON.parse(localStorage.getItem(key)))
    .find((value) => value?.icon_scale === 1);
  out.persisted = savedScale?.icon_scale === 1;
  out.legacyScaleUntouched = localStorage.getItem(legacyScaleKey) === legacyScaleBefore;
  // 7) попап настроек экрана открывается (прямой вызов; долгое нажатие проверено таймером)
  c._kioskDialog = true; await c.updateComplete;
  out.dialogRenders = !!sr().querySelector('hp-dialog input[type="range"]');
  c._kioskDialog = false;
  // 8) карусель: тик двигает пространство, пауза после касания работает
  const cs = c._space;
  c._config = { ...c._config, cycle: 1 };
  c._cyclePausedUntil = 0;
  c._cycleTick(); await c.updateComplete;
  out.cycleAdvances = c._space !== cs;
  c._cyclePausedUntil = Date.now() + 60000;
  const cs2 = c._space;
  c._cycleTick(); await c.updateComplete;
  out.cyclePaused = c._space === cs2;
  // 9) обычная карточка (не киоск): шапка на месте, свайпа нет
  const sr0 = c0.shadowRoot || c0.renderRoot;
  out.normalHeader = !!sr0.querySelector('.hdr') && getComputedStyle(sr0.querySelector('.hdr')).display !== 'none';
  c.remove();
  return out;
});
checkAll(res);
await finish(browser, res);
