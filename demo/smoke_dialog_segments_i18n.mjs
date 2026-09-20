// #600 AC2/AC9, ревью r1 M1: подписи сегментов не рвутся посреди слова ни в
// одной из четырёх локалей ни в одном из четырёх диалогов. Смок на скролл
// контейнера этого не видел: слово ломалось внутри кнопки, scrollWidth не рос.
//
// Проверка: у текстового span'а каждого варианта число клиентских прямоугольников
// (строк) не больше числа слов — однословная подпись всегда в одну строку,
// многословная переносится только по пробелам; кнопка при этом не выходит за
// границы своего сегмента.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 40)); };
  const spId = c._space;
  const closeAll = async () => {
    c._settingsDialog = null; c._spaceDialog = null; c._markerDialog = null; if (c._roomDialog) c._roomDialogCancel();
    await upd();
  };
  const open = {
    space: async () => { c._setMode('view'); c._openSpaceDialog('edit', spId); await upd(); c._spaceDialog = { ...c._spaceDialog, fillMode: 'temp', northMode: 'custom', northDeg: 35 }; await upd(); },
    settings: async () => { c._openSettingsDialog(); await upd(); },
    room: async () => {
      c._setMode('plan'); await upd();
      c._openRoomEdit(c._curSpaceCfg.rooms[0]); await upd();
      c._roomFill = 'temp'; c._roomTempSrc = ''; c._roomSrcOpen = null; await upd();
    },
    marker: async () => {
      c._setMode('devices'); await upd();
      const d = c._devices.find((x) => x.id === 'd_light1') || c._devices.find((x) => x.bindingKind === 'device') || c._devices[0];
      c._openMarkerDialog(d); await upd();
      c._markerDialog = { ...c._markerDialog, lightRole: 'always', lightRoleTouched: true, glowMode: 'fixed', glowTouched: true, valueBadgeEnabled: true, valueBadgeTouched: true };
      await upd();
    },
  };
  const wordsOf = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  for (const lang of ['en', 'ru', 'de', 'fr']) {
    c._config = { ...c._config, language: lang }; await upd();
    for (const [kind, opener] of Object.entries(open)) {
      await closeAll(); await opener();
      const dlg = sr().querySelector(`hp-dialog[data-kind="${kind}"]`);
      const labels = [...(dlg?.querySelectorAll('.hpf-seg label') || [])];
      let broken = [];
      let outside = [];
      for (const label of labels) {
        const span = [...label.querySelectorAll('span')].find((s) => !s.classList.contains('hpf-line'));
        if (!span) continue;
        // span — flex-элемент (блок), у блока один прямоугольник даже при переносе:
        // строки считаются по текстовому узлу через Range.
        const range = document.createRange(); range.selectNodeContents(span);
        const lines = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).length;
        if (lines > wordsOf(span.textContent)) broken.push(`${lang}/${kind}: «${span.textContent.trim()}» в ${lines} строк`);
        const lb = label.getBoundingClientRect(); const sb = span.getBoundingClientRect();
        if (sb.left < lb.left - 0.5 || sb.right > lb.right + 0.5) outside.push(`${lang}/${kind}: «${span.textContent.trim()}» шире кнопки`);
      }
      o[`${lang}_${kind}_hasSegments`] = labels.length >= 2;
      o[`${lang}_${kind}_noMidWordBreak`] = broken.length === 0 || broken;
      o[`${lang}_${kind}_labelsInsideButtons`] = outside.length === 0 || outside;
    }
  }
  await closeAll();
  c._config = { ...c._config, language: 'en' }; await upd();
  return o;
});

const normalized = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v === true]));
checkAll(normalized);
await finish(browser, out);
