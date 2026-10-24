// #524: маркеры не анимируют тень, выраженную в контейнерных единицах.
//
// Тень оболочки и кольцо ядра заданы через `--dev-size`, а он восходит к
// `2.5cqw`. Пока `box-shadow` стоял в списке переходов, ЛЮБОЙ пересчёт
// контейнерных запросов — а он случается от подсказки, полосы прокрутки,
// поворота экрана — менял вычисленное значение у каждого маркера и запускал
// на нём некомпозируемый 150-миллисекундный переход. В профиле владельца
// (Firefox 155) 61 такой переход разом давал 9,4 к/с и кадры по 149 мс.
//
// Свидетель судит ПРИЧИНУ, а не время кадра: считает старты переходов, а не
// миллисекунды, и поэтому не флейкует и не зависит от движка. Проверять это
// в Chromium честно: переход запускается в обоих движках одинаково, разница
// только в цене перерисовки.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 820 });
// The demo host defaults to 780px; exercise actual wide Properties selection.
await page.evaluate(async () => {
  document.getElementById('host').style.width = '1100px';
  await window.__hpTest.setMode('devices');
  await window.__hpTest.settled();
});
await page.waitForFunction(() => !window.__card._modeTransitionBusy
  && window.__card._editorRuntime?.properties.wide);

// Слушатель ставится один раз и живёт до конца прогона.
await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  window.__starts = [];
  root.addEventListener('transitionrun', (event) => {
    const target = event.target;
    window.__starts.push({
      property: event.propertyName,
      cls: target?.getAttribute?.('class') || target?.tagName || '?',
      onMarker: !!target?.closest?.('.dev'),
    });
  }, true);
});

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const settle = async () => { await card.updateComplete; await frame(); await frame(); };
  const markers = [...root.querySelectorAll('[data-hp="device"]')];
  result.enoughMarkers = markers.length >= 8;
  result.everyMarkerHasShell = markers.every((marker) => !!marker.querySelector('.device-shell-frame'));

  // AC1: ширина контейнера меняется на один пиксель — переходов тени быть не должно.
  const stage = root.querySelector('.stage');
  const width = stage.getBoundingClientRect().width;
  window.__starts.length = 0;
  stage.style.width = `${Math.round(width) - 1}px`;
  await frame(); await frame();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const afterResize = [...window.__starts];
  stage.style.removeProperty('width');
  await settle();
  result.containerResizeStartsNoShadowTransition = afterResize
    .every((entry) => entry.property !== 'box-shadow');
  result.shadowTransitionsOnResize = afterResize.filter((e) => e.property === 'box-shadow').length;
  result.resizeStartsNothingOnMarkers = afterResize.filter((e) => e.onMarker).length;

  window.__starts.length = 0;
  return result;
});

// #1051 replaces the selected ring with a blue Devices core. Keep the #524
// cause guard: selection must never animate cqw-sized box-shadow. The accepted
// background-colour transition is a separate paint, so zero ANY animations is
// no longer the contract. Use the same native wide selection as icon-design.
const selected = page.locator('[data-hp="device"][data-id="d_tv"]');
const shellBefore = await selected.evaluate(node =>
  getComputedStyle(node.querySelector('.device-shell-frame')).borderColor);
await selected.click();
await page.mouse.move(1, 1);
await page.evaluate(async () => {
  await window.__hpTest.settled();
  const node = window.__card.renderRoot.querySelector('[data-hp="device"][data-id="d_tv"]');
  await Promise.allSettled(node.getAnimations({ subtree: true })
    .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
    .map(animation => animation.finished));
});
const selection = await selected.evaluate(node => ({
  selected: node.classList.contains('sel'),
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  shell: getComputedStyle(node.querySelector('.device-shell-frame')).borderColor,
  shadowTransitions: window.__starts.filter(entry => entry.property === 'box-shadow' && entry.onMarker).length,
  shadowAnimations: node.getAnimations({ subtree: true })
    .filter(animation => animation.transitionProperty === 'box-shadow').length,
}));
out.selectionUsesBlueCoreAndOrdinaryShell = selection.selected
  && selection.core === 'rgb(12, 130, 240)' && selection.shell === shellBefore;
out.selectionStartsNoShadowTransition = selection.shadowTransitions === 0;
out.selectedCoreHasNoShadowAnimation = selection.shadowAnimations === 0;
if (!out.selectionUsesBlueCoreAndOrdinaryShell) console.error({ selection, shellBefore });
await page.evaluate(() => { window.__starts.length = 0; });

// AC2: наведение настоящей мышью — отклик остался, анимируется рамка.
const box = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const marker = root.querySelector('[data-hp="device"]');
  const rect = marker.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
});
await page.mouse.move(box.x - 120, box.y - 120);
await page.waitForTimeout(60);
await page.mouse.move(box.x, box.y);
await page.waitForTimeout(250);
const hover = await page.evaluate(() => {
  const starts = [...window.__starts];
  return {
    // Браузер сообщает длинные формы: border-top-color и так далее.
    hoverAnimatesBorder: starts.some((entry) => /^border-\w+-color$/.test(entry.property) && entry.onMarker),
    hoverStartsNoShadow: starts.every((entry) => entry.property !== 'box-shadow'),
  };
});

checkAll({ ...out, ...hover }, { shadowTransitionsOnResize: 0, resizeStartsNothingOnMarkers: 0 });
await browser.close();
finish();
