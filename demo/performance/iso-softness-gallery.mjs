import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startIsoPaintScene, zoomIsoPaint } from '../helpers/iso-paint-scene.mjs';
import { finish } from '../serve.mjs';

const output = process.env.HP_WHEEL_GALLERY;
const executablePath = process.env.HP_WHEEL_BROWSER;
if (!output || !executablePath) throw Error('Set HP_WHEEL_GALLERY and HP_WHEEL_BROWSER');
await mkdir(output, { recursive: true });
const { browser, page } = await startIsoPaintScene({ width:1408, height:952, dpr:2, reducedMotion:'no-preference',
  launchOptions:{ executablePath, headless:false }, browserArgs:['--enable-gpu'] });
const stage = page.locator('houseplan-card .stage');
const mark = 'houseplan.iso.raster.ready';
const completed = () => page.evaluate(mark => performance.getEntriesByName(mark).length, mark);
const results = [];
try {
  const cdp = await browser.newBrowserCDPSession();
  const info = await cdp.send('SystemInfo.getInfo');
  if (info.gpu.featureStatus?.gpu_compositing !== 'enabled') throw Error('GPU compositing is unavailable');
  const renderer = info.gpu.auxAttributes.glRenderer;
  await cdp.detach();
  // Keep pointer hover out of both images. The exact frame would otherwise
  // show a tooltip or room highlight that the held raster does not include.
  await page.mouse.move(4, 4);
  for (const darkMode of [false, true]) {
    await page.evaluate(async darkMode => {
      const card = window.__isoPaint;
      card.hass = { ...card.hass, themes:{ ...card.hass.themes, darkMode } };
      await card.updateComplete;
    }, darkMode);
    let index = 0;
    const theme = darkMode ? 'dark' : 'light';
    for (const [base, factor] of [[1.15,1.5],[1.15,2],[1.15,3],[1.15,4],[4,1/1.5],[4,1/2],[4,1/3]]) {
      const count = await completed();
      await zoomIsoPaint(page, base);
      // The same base can reuse an already prepared frame.
      await page.waitForFunction(({ count, mark }) => {
        const entry = performance.getEntriesByName(mark).at(-1);
        const card = window.__isoPaint;
        const current = card._viewOr(card._baseVb());
        return entry && (performance.getEntriesByName(mark).length > count ||
          Math.abs(entry.detail.view.w - current.w) < 1e-6);
      }, { count, mark });
      await page.evaluate(factor => {
        const card = window.__isoPaint;
        const prepare = window.createImageBitmap;
        let release;
        const held = new Promise(resolve => { release = resolve; });
        window.createImageBitmap = (...args) => held.then(() => prepare(...args));
        window.__restoreWheelImage = () => { window.createImageBitmap = prepare; release(); };
        card._panLock = 'pan';
        card._liveIsoRasterInput = () => 'wheel';
        card._applyView(card._zoom * factor);
        card._liveVp(true);
      }, factor);
      const readState = () => page.evaluate(() => {
        const root = window.__isoPaint.renderRoot;
        const main = root.querySelector('.hp-iso-gesture-image');
        const scale = main?.style.transform.match(/\bscale\(([^,)]+)/)?.[1];
        return { scale: scale ? Number(scale) * devicePixelRatio : null,
          markers: root.querySelector('[data-hp-live-marker-surface]')?.style.transform,
          underlay: !!root.querySelector('.hp-iso-gesture-underlay'),
          active: !!main,
          visibility: document.visibilityState };
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const state = await readState();
      if (state.visibility !== 'visible' || !state.active) throw Error('The requested held frame was not displayed: ' + JSON.stringify(state));
      const id = theme + '-' + ++index;
      await stage.screenshot({ path: join(output, id + '-gesture.png') });
      if (JSON.stringify(state) !== JSON.stringify(await readState()))
        throw Error('The held camera or raster changed during capture: ' + id);
      await page.evaluate(async () => {
        const card = window.__isoPaint;
        window.__restoreWheelImage();
        delete card._liveIsoRasterInput;
        card._panLock = null;
        card.requestUpdate();
        await card.updateComplete;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await stage.screenshot({ path: join(output, id + '-exact.png') });
      results.push({ id, theme, requested: factor, ...state });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
  await writeFile(join(output, 'frames.json'), JSON.stringify({ renderer, results }, null, 2));
  const headings = { light: 'Светлая тема', dark: 'Тёмная тема' };
  const pictures = results.map(item => {
    const scale = item.scale && item.scale.toFixed(2);
    return '<section><h2>' + headings[item.theme] + ' · ' +
      (item.requested > 1 ? 'приближение ×' + item.requested : 'отдаление ×' + (1/item.requested).toFixed(1)) +
      (item.underlay ? ' · видна подложка' : '') + '</h2><p>Масштаб растрового кадра в экранных пикселях ' + scale +
      '×.</p><div class="row"><figure><figcaption>Во время жеста</figcaption><a href="' + item.id +
      '-gesture.png"><img loading="lazy" src="' + item.id + '-gesture.png"></a></figure>' +
      '<figure><figcaption>Точный кадр той же камеры</figcaption><a href="' + item.id +
      '-exact.png"><img loading="lazy" src="' + item.id + '-exact.png"></a></figure></div></section>';
  }).join('\n');
  await writeFile(join(output, 'index.html'), '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Мягкость 2.5D #1485</title>' +
    '<style>body{margin:24px;font:16px system-ui,sans-serif;background:#171a20;color:#efeff2}section{margin:32px 0}' +
    '.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;display:block;margin-top:6px}' +
    '@media(max-width:650px){.row{grid-template-columns:1fr}}</style><h1>Мягкость плана во время зума 2.5D</h1>' +
    '<p>Яндекс Браузер, RTX 4090, DPR 2, синтетический план. Для контрольного снимка следующий растр намеренно задержан. ' +
    'Нажмите на кадр, чтобы открыть PNG в исходном размере.</p>' + pictures + '</html>');
} finally {
  await finish(browser);
}
