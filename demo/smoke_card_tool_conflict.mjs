import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); await c.updateComplete;
  const stage = sr().querySelector('.stage');
  const label = sr().querySelector('.roomlabel');
  out.hasLabel = !!label;
  // 1) draw: клик по карточке не добавляет точку
  c._tool = 'draw'; c._path = []; await c.updateComplete;
  label.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: 10, clientY: 10 }));
  await c.updateComplete;
  out.drawIgnored = c._path.length === 0;
  // 2) клик по угловой метке тоже не считается кликом инструмента
  const handle = label.querySelector('.rlhandle');
  handle.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: 10, clientY: 10 }));
  await c.updateComplete;
  out.handleIgnored = c._path.length === 0;
  // 3) во время резайза клики по сцене игнорируются
  const room = c._spaceModel().rooms.find((r) => r.name);
  c._rlResize = { id: 'rl_' + room.id, space: c._space, k0: 1, cx: 0, cy: 0, d0: 50 };
  const before = c._path.length;
  c._markupClick(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
  out.duringResizeIgnored = c._path.length === before;
  c._rlResize = null;
  // 4) обычный клик по сцене (мимо карточки) по-прежнему работает — точка ставится
  const r = stage.getBoundingClientRect();
  // найти долю экрана, попадающую в свободное место (не внутри комнаты)
  let fx = 0.4, fy = 0.4;
  outer: for (let ix = 1; ix < 20; ix++) for (let iy = 1; iy < 20; iy++) {
    const ev = new MouseEvent('click', { clientX: r.left + r.width * ix / 20, clientY: r.top + r.height * iy / 20 });
    const raw = c._svgPoint(ev);
    if (!c._roomAt(c._snap(raw))) { fx = ix / 20; fy = iy / 20; break outer; }
  }
  stage.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true,
    clientX: r.left + r.width * fx, clientY: r.top + r.height * fy }));
  await c.updateComplete;
  out.normalClickWorks = c._path.length === 1;
  // 5) delroom: клик по карточке не зовёт confirm (переопределим)
  let confirmCalled = false;
  window.confirm = () => { confirmCalled = true; return false; };
  c._tool = 'delroom'; c._path = []; await c.updateComplete;
  label.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: 10, clientY: 10 }));
  await c.updateComplete;
  out.delroomIgnored = !confirmCalled;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
