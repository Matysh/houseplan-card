// #600, серия 2: «Общие настройки» по референсу docs/design/600-settings-dialogs/
// (§5 SPEC.md). Фокусный свидетель формы: состав карточек и отсутствие старой
// разметки (AC1), один заголовок у карточки Zigbee (дефект 1), плитки цвета и
// плашки пишут в те же ключи (AC3/К1), Save только при изменениях и вопрос при
// закрытии (AC6/К10), цели и семантика (AC9/К7).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30)); };
  const dlg = () => sr().querySelector('hp-dialog[data-kind="settings"]');
  const q = (sel) => dlg()?.querySelector(sel);
  const qa = (sel) => [...(dlg()?.querySelectorAll(sel) || [])];
  const saveBtn = () => q('[data-hp="dialog-confirm"]');
  const statusText = () => q('.hpf-status')?.textContent.trim() || '';
  const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };

  c._openSettingsDialog(); await upd();
  const d0 = JSON.parse(JSON.stringify(c._settingsDialog));

  // --- AC1: семь карточек по §5.1, старой разметки нет ----------------------
  o.sevenCardsInOrder = JSON.stringify(qa('.hpf-card').map((card) => card.dataset.card))
    === JSON.stringify(['display', 'zigbee', 'fills', 'glow', 'plan', 'sun', 'data']);
  o.noLegacyMarkup = qa('.rhint, .srcrow, .dispsection, fieldset, .gsrow, .colorrow, .helpfieldlabel, select.areasel').length === 0;
  o.noNativeSelects = qa('select').length === 0;
  // Дефект 1 из #600: у карточки Zigbee один заголовок — свой, а компонент
  // внутри в режиме embedded заголовок не рисует.
  const zigbee = q('.hpf-card[data-card="zigbee"]');
  const topo = zigbee?.querySelector('hp-zigbee-topology-settings');
  o.zigbeeHeadingOnce = !!zigbee && zigbee.querySelectorAll('h3').length === 1
    && !!zigbee.querySelector('.hpf-head hp-help[data-help-key="topology.help"]')
    && !!topo?.hasAttribute('embedded') && !topo.shadowRoot.querySelector('.section')
    && !!topo.shadowRoot.querySelector('.hpf-toggle input[type="checkbox"]');
  o.colorTilesCount = qa('.hpf-colortile').length === 10; // 8 заливок + 2 свечения
  o.wallFillIsAPlate = !!q('.hpf-card[data-card="plan"] .hpf-colorrow .hpf-colorfield');
  o.compassIs44 = (() => { const b = q('.compass')?.getBoundingClientRect(); return !!b && Math.round(b.width) === 44 && Math.round(b.height) === 44; })();
  o.sunMissingIsACallout = !c.hass.states['sun.sun']
    ? !!qa('.hpf-callout').find((n) => n.textContent.trim() === c._t('gs.sun_missing'))
    : true;

  // --- AC9 ----------------------------------------------------------------
  const toggles = qa('.hpf-toggle > input[type="checkbox"]');
  o.toggleTargetsAre44 = toggles.length >= 3 && toggles.every((i) => { const b = i.getBoundingClientRect(); return b.width >= 44 && b.height >= 44; });
  o.segmentsAreRadiogroups = qa('.hpf-seg').length === 2 && qa('.hpf-seg').every((s) => s.getAttribute('role') === 'radiogroup');

  // --- К10 ------------------------------------------------------------------
  o.saveDisabledWhenClean = saveBtn().disabled === true && statusText() === '';
  q('#gs-room-tooltip').click(); await upd();
  o.toggleWritesShowRoomTooltip = c._settingsDialog.showRoomTooltip === !d0.showRoomTooltip && c._settingsDialog.radarShowLive === d0.radarShowLive;
  o.saveEnabledWhenDirtyWithoutDuplicateStatus = saveBtn().disabled === false && statusText() === '';
  q('#gs-room-tooltip').click(); await upd();
  o.cleanAgainWhenReverted = saveBtn().disabled === true;

  // --- К1: плитки, плашки, поля -------------------------------------------
  const lightsOnTile = qa('.hpf-card[data-card="fills"] .hpf-colortile')[0];
  input(lightsOnTile.querySelector('.hpf-colortile-meta input'), '33'); await upd();
  o.tileOpacityWritesOwnKey = Math.abs(c._settingsDialog.colors.light_on.a - 0.33) < 1e-9
    && c._settingsDialog.colors.light_on.c === d0.colors.light_on.c
    && c._settingsDialog.colors.light_off.a === d0.colors.light_off.a;
  o.tileHexPrinted = lightsOnTile.querySelector('.hpf-hex').textContent === d0.colors.light_on.c;
  input(q('.hpf-card[data-card="plan"] .hpf-colorrow .hpf-opacity input'), '40'); await upd();
  o.wallFillOpacityWritesOwnKey = Math.abs(c._settingsDialog.colors.wall_fill.a - 0.4) < 1e-9;
  input(q('#gs-glow-radius'), '4.5'); await upd();
  o.glowRadiusWrites = c._settingsDialog.glowRadius === 4.5;
  input(q('#gs-north'), '400'); await upd();
  o.northOutOfRangeBlocksSave = c._settingsDialog.northDeg === 400 && saveBtn().disabled === true
    && q('#gs-north').getAttribute('aria-invalid') === 'true' && !!q('.hpf-status .hpf-link');
  input(q('#gs-north'), '45'); await upd();
  o.northWritesAndClearLinkAppears = c._settingsDialog.northDeg === 45
    && q('.compass svg').style.transform === 'rotate(45deg)'
    && [...qa('.hpf-card[data-card="sun"] .hpf-link')].some((l) => l.textContent === c._t('gs.north_clear'));
  [...qa('.hpf-card[data-card="sun"] .hpf-link')].find((l) => l.textContent === c._t('gs.north_clear')).click(); await upd();
  o.clearResetsNorth = c._settingsDialog.northDeg === null;
  const outer = qa('input[name="gs-sun-ray-origin"]').find((r) => !r.checked);
  outer.click(); await upd();
  o.originSegmentWrites = c._settingsDialog.sunRayOrigin !== d0.sunRayOrigin && c._settingsDialog.sunRays === d0.sunRays;
  const daynight = qa('input[name="gs-bg-mode"]').find((r) => r.closest('label').textContent.includes(c._t('gs.bg_daynight')));
  daynight.click(); await upd();
  o.bgSegmentWritesAndHidesColor = c._settingsDialog.bgMode === 'daynight' && !q('.hpf-card[data-card="plan"] .hpf-field .hpf-colorfield');
  o.noNativeColorInputs = qa('input[type="color"]').length === 0;

  // --- К10: закрытие с изменениями спрашивает ------------------------------
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  const confirm = () => sr().querySelector('hp-confirm hp-dialog');
  o.discardAsksFirst = !!confirm() && !!dlg();
  confirm()?.querySelector('[data-hp="dialog-cancel"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.keepEditingKeepsDialog = !!dlg() && c._settingsDialog !== null;
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  confirm()?.querySelector('[data-hp="dialog-confirm"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.discardCloses = !dlg() && c._settingsDialog === null;
  c._openSettingsDialog(); await upd();
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  o.cleanClosesImmediately = !dlg() && !confirm();

  // Reset to defaults делает форму «грязной» — есть что сохранять.
  c._openSettingsDialog(); await upd();
  [...qa('.dialog-action-footer .btn')].find((b) => b.textContent.trim() === c._t('gs.reset')).click(); await upd();
  o.resetMakesDirtyWhenDefaultsDiffer = JSON.stringify(c._settingsDialog.colors) !== JSON.stringify(d0.colors)
    ? saveBtn().disabled === false : true;
  c._settingsDialog = null; await upd();
  return o;
});

checkAll(out);
await finish(browser, out);
