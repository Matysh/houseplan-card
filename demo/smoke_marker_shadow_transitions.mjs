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
  card._setMode('devices');
  await settle();
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

  // AC3: кольцо выделения появляется сразу и без перехода.
  const target = markers[0];
  const core = target.querySelector('.device-core');
  const ringWidth = () => {
    const shadow = getComputedStyle(core).boxShadow;
    const px = [...shadow.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Math.abs(Number(m[1])));
    return Math.max(0, ...px);
  };
  const before = ringWidth();
  card._selId = target.dataset.id;
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  result.selectionRingAppearsInOneFrame = ringWidth() > before;
  result.selectionRingDoesNotAnimate = (core.getAnimations?.() || []).length === 0;
  card._selId = null;
  card.requestUpdate();
  await settle();
  window.__starts.length = 0;
  return result;
});

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
