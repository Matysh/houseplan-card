// #531: панорама двигает сцену трансформом, а не перерисовывает её каждый кадр.
//
// Перезапись атрибута `viewBox` — это инвалидация растеризации всего плана.
// В профиле владельца (Firefox 155, 144 Гц) кадр панорамы уходил на экран за
// 200 мс при незагруженном GPU, а драйвер пропускал 124–144 тика в секунду с
// пометкой «ждём краску». Свидетель судит причину, а не миллисекунды: считает
// перезаписи `viewBox` во время жеста и проверяет, что план при этом реально
// едет за курсором.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 800 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const settle = async () => { await card.updateComplete; await frame(); await frame(); };
  card._setMode('view');
  await settle();
  const stage = root.querySelector('.stage');
  const scene = root.querySelector('[data-hp-live-viewbox]');
  const layer = root.querySelector('[data-hp-live-layer="camera"]');
  result.sceneExists = !!scene && !!layer && !!stage;
  if (!result.sceneExists) return result;

  // Наблюдаем ровно за атрибутом, ради которого всё затевалось.
  let viewBoxWrites = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) if (record.attributeName === 'viewBox') viewBoxWrites += 1;
  });
  for (const node of root.querySelectorAll('[data-hp-live-viewbox]')) {
    observer.observe(node, { attributes: true, attributeFilter: ['viewBox'] });
  }

  const rect = stage.getBoundingClientRect();
  const at = (dx, dy) => ({
    clientX: rect.left + rect.width / 2 + dx,
    clientY: rect.top + rect.height / 2 + dy,
  });
  const send = (type, dx, dy) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true,
    pointerId: 31, isPrimary: true, pointerType: 'mouse', button: 0, buttons: 1, ...at(dx, dy),
  }));
  const viewBoxOf = () => scene.getAttribute('viewBox');

  const boxBefore = viewBoxOf();
  const marker = root.querySelector('[data-hp="device"]');
  // Нужен видимый узел самой сцены, а не заготовка из `<defs>`: у неё нет
  // экранного прямоугольника, и сравнивать её смещение не с чем.
  const room = root.querySelector('[data-hp-live-viewbox] [data-hp="room"]');
  result.parityTargetsExist = !!marker && !!room;
  const centre = (node) => {
    const box = node.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  };
  const markerBefore = marker ? centre(marker) : null;
  const roomBefore = room ? centre(room) : null;

  stage.setPointerCapture = () => {}; stage.releasePointerCapture = () => {};
  send('pointerdown', 0, 0);
  await frame();
  const startedAt = performance.now();
  let frames = 0;
  let framesWithSceneTransform = 0;
  let worstParity = 0;
  for (let step = 1; step <= 20; step += 1) {
    send('pointermove', -step * 6, -step * 3);
    await frame();
    frames += 1;
    const transform = getComputedStyle(scene).transform;
    if (transform && transform !== 'none') framesWithSceneTransform += 1;
    if (marker && room) {
      // #451: слой устройств и сцена обязаны ехать как одно целое. Сравниваются
      // не формулы, а экранные смещения одной и той же пары объектов.
      const markerNow = centre(marker); const roomNow = centre(room);
      const dx = Math.abs((markerNow[0] - markerBefore[0]) - (roomNow[0] - roomBefore[0]));
      const dy = Math.abs((markerNow[1] - markerBefore[1]) - (roomNow[1] - roomBefore[1]));
      worstParity = Math.max(worstParity, dx, dy);
    }
  }
  const elapsed = performance.now() - startedAt;
  const writesDuringGesture = viewBoxWrites;
  send('pointerup', -120, -60);
  await settle();
  await frame();
  observer.disconnect();

  // AC5: за 20 кадров жеста сцена перерисовывается считаные разы, а не каждый кадр.
  // Порог считается от реально прошедшего времени: бюджет — одна перезапись в 100 мс.
  const allowed = Math.max(2, Math.ceil(elapsed / 100) + 1);
  result.framesInGesture = frames;
  result.viewBoxWritesDuringGesture = writesDuringGesture;
  result.gestureDoesNotRepaintEveryFrame = writesDuringGesture <= allowed;
  result.wellBelowFrameCount = writesDuringGesture < frames / 2;
  // Сцена действительно едет: на большинстве кадров жеста на ней живой трансформ.
  result.framesWithSceneTransform = framesWithSceneTransform;
  result.sceneMovesByTransform = framesWithSceneTransform >= frames / 2;
  // AC6: маркер и сцена смещаются на экране одинаково, в пределах пикселя.
  result.worstParityPx = Math.round(worstParity * 100) / 100;
  result.markerFollowsTheScene = worstParity <= 1;
  // После жеста кадр осевший: новый viewBox записан, трансформов не осталось.
  result.viewBoxSettledAfterGesture = viewBoxOf() !== boxBefore;
  result.noTransformAfterGesture = ['none', ''].includes(getComputedStyle(scene).transform)
    && ['none', ''].includes(getComputedStyle(layer).transform);
  return result;
});

console.log(JSON.stringify(out, null, 1));
checkAll(out, {
  framesInGesture: out.framesInGesture,
  viewBoxWritesDuringGesture: out.viewBoxWritesDuringGesture,
  framesWithSceneTransform: out.framesWithSceneTransform,
  worstParityPx: out.worstParityPx,
});
await browser.close();
finish();
