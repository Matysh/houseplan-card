import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c0 = window.__card;
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
  // 3) свайп при 1:1 переключает пространство (и точки показываются)
  const s0 = c._space;
  const stage = sr().querySelector('.stage');
  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, clientX: 600, clientY: 300 }));
  stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, clientX: 450, clientY: 305 }));
  await c.updateComplete;
  out.swipeSwitches = c._space !== s0;
  out.dotsShown = !!sr().querySelector('.kioskdots');
  // 4) при зуме свайп не переключает
  c._zoom = 2; const s1 = c._space;
  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 2, clientX: 600, clientY: 300 }));
  stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 2, clientX: 450, clientY: 305 }));
  await c.updateComplete;
  out.noSwipeZoomed = c._space === s1;
  // 5) двойной тап сбрасывает зум
  c._lastTap = Date.now() - 100;
  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 3, clientX: 500, clientY: 300 }));
  stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3, clientX: 501, clientY: 300 }));
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
  out.persisted = JSON.parse(localStorage.getItem('houseplan_card_kiosk_v1')).icon === 1;
  // 7) попап настроек экрана открывается (прямой вызов; долгое нажатие проверено таймером)
  c._kioskDialog = true; await c.updateComplete;
  out.dialogRenders = !!sr().querySelector('.dialog input[type="range"]');
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
console.log(JSON.stringify(res, null, 1));
await browser.close();
