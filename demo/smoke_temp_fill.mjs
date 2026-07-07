import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const setFill = async (settings) => {
    c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s, settings })) };
    c.requestUpdate(); await c.updateComplete;
    return [...sr().querySelectorAll('.room.styled')].map((r) => {
      const st = r.getAttribute('style') || '';
      const m = st.match(/--room-fill:([^;]+)/);
      return m ? m[1] : null;
    });
  };
  // living room avg temp = 22.4 (единственный термометр в demo)
  out.comfy = await setFill({ show_borders: true, fill_mode: 'temp', temp_min: 20, temp_max: 25 });
  out.cold = await setFill({ show_borders: true, fill_mode: 'temp', temp_min: 23, temp_max: 26 });
  out.hot  = await setFill({ show_borders: true, fill_mode: 'temp', temp_min: 18, temp_max: 21 });
  out.swapped = await setFill({ show_borders: true, fill_mode: 'temp', temp_min: 25, temp_max: 20 });
  // диалог: поля границ видны только в режиме temp
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  out.dialogTempFields = sr().querySelectorAll('.tempin').length;
  c._spaceDialog = { ...c._spaceDialog, fillMode: 'none' }; await c.updateComplete;
  out.dialogHiddenWhenNone = sr().querySelectorAll('.tempin').length;
  c._spaceDialog = null;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
