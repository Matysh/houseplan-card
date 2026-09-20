// #600 AC3/К1: сохранённый конфиг после правки через НОВЫЙ UI побайтово
// совпадает с конфигом после тех же правок, записанных прямо в состояние
// черновика (путь, которым пользовались прежние обработчики и существующие
// смоки). Четыре диалога, по одному сценарию правок на каждый; сравнивается
// JSON.stringify(_serverCfg) целиком, а не отдельные ключи — сосед, в который
// утёк контрол, покраснеет здесь, даже если никто не догадался его проверить.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30)); };
  const settle = async () => { for (let i = 0; i < 6; i++) { await c.updateComplete; await new Promise((r) => setTimeout(r, 40)); } };
  const q = (kind, sel) => sr().querySelector(`hp-dialog[data-kind="${kind}"]`)?.querySelector(sel);
  const qa = (kind, sel) => [...(sr().querySelector(`hp-dialog[data-kind="${kind}"]`)?.querySelectorAll(sel) || [])];
  const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const change = (el, value) => { if (value !== undefined) el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const radio = (kind, name, value) => { const r = qa(kind, `input[name="${name}"]`).find((x) => x.value === value); r.checked = true; change(r); };
  const saveViaUi = async (kind) => { q(kind, '.dialog-action-commit [data-hp="dialog-confirm"]').click(); await settle(); };
  const snapshot = () => JSON.stringify(c._serverCfg);
  const cfg0 = JSON.parse(JSON.stringify(c._serverCfg));
  const reset = async () => {
    c._settingsDialog = null; c._spaceDialog = null; c._markerDialog = null; if (c._roomDialog) c._roomDialogCancel();
    c._serverCfg = JSON.parse(JSON.stringify(cfg0)); c._cfgEpoch++; c._modelCache = null;
    c._regSignature = ''; c._maybeRebuildDevices?.(); await upd();
  };
  const spId = c._space;
  const pair = async (name, ui, state) => {
    await reset(); await ui(); const a = snapshot();
    await reset(); await state(); const b = snapshot();
    o[`${name}_uiChangedConfig`] = a !== JSON.stringify(cfg0);
    o[`${name}_uiEqualsStatePath`] = a === b;
    if (a !== b) o[`${name}_diff`] = [a.length, b.length, [...a].findIndex((ch, i) => ch !== b[i])];
  };

  // --- Space -----------------------------------------------------------------
  await pair('space',
    async () => {
      c._setMode('view'); c._openSpaceDialog('edit', spId); await upd();
      q('space', '#space-show-borders').click(); await upd();
      radio('space', 'space-fill-mode', 'temp'); await upd();
      input(q('space', '#space-temp-max'), '27'); await upd();
      change(q('space', '#space-north-mode'), 'custom'); await upd();
      input(q('space', '#space-north-deg'), '90'); await upd();
      input(q('space', '#space-card-font'), '150'); await upd();
      await saveViaUi('space');
    },
    async () => {
      c._setMode('view'); c._openSpaceDialog('edit', spId); await upd();
      const d = c._spaceDialog;
      c._spaceDialog = { ...d, showBorders: !d.showBorders, fillMode: 'temp', tempMax: 27, northMode: 'custom', northDeg: 90, cardFontScale: 1.5 };
      await upd(); await c._saveSpaceDialog(); await settle();
    });

  // --- General ---------------------------------------------------------------
  await pair('general',
    async () => {
      c._openSettingsDialog(); await upd();
      q('settings', '#gs-room-tooltip').click(); await upd();
      input(qa('settings', '.hpf-card[data-card="fills"] .hpf-colortile')[0].querySelector('.hpf-colortile-meta input'), '33'); await upd();
      input(q('settings', '#gs-glow-radius'), '4.5'); await upd();
      radio('settings', 'gs-bg-mode', 'daynight'); await upd();
      input(q('settings', '#gs-north'), '45'); await upd();
      await saveViaUi('settings');
    },
    async () => {
      c._openSettingsDialog(); await upd();
      const d = c._settingsDialog;
      c._settingsDialog = { ...d, showRoomTooltip: !d.showRoomTooltip, glowRadius: 4.5, bgMode: 'daynight', northDeg: 45,
        colors: { ...d.colors, light_on: { c: d.colors.light_on.c, a: 0.33 } } };
      await upd(); await c._saveSettingsDialog(); await settle();
    });

  // --- Room ------------------------------------------------------------------
  const roomId = cfg0.spaces.find((s) => s.id === spId).rooms[0].id;
  await pair('room',
    async () => {
      c._setMode('plan'); await upd();
      c._openRoomEdit(c._curSpaceCfg.rooms.find((r) => r.id === roomId)); await upd();
      input(q('room', '#room-name'), 'Parity room'); await upd();
      q('room', '#room-fill-inherit').click(); await upd();
      radio('room', 'rfill', 'temp'); await upd();
      input(q('room', '#room-temp-min'), '19'); await upd();
      input(q('room', '#room-name-scale'), '150'); await upd();
      await saveViaUi('room');
    },
    async () => {
      c._setMode('plan'); await upd();
      c._openRoomEdit(c._curSpaceCfg.rooms.find((r) => r.id === roomId)); await upd();
      c._nameSel = 'Parity room'; c._roomFill = 'temp'; c._roomTempMin = '19'; c._roomNameScale = 1.5;
      await upd(); c._saveRoomEdit(); await settle();
    });

  // --- Device ----------------------------------------------------------------
  const lampId = (c._devices.find((d) => d.id === 'd_light1') || c._devices.find((d) => d.bindingKind === 'device')).id;
  const lamp = () => c._devices.find((d) => d.id === lampId);
  await pair('device',
    async () => {
      c._setMode('devices'); await upd();
      c._openMarkerDialog(lamp()); await upd();
      input(q('marker', '#marker-name'), 'Parity lamp'); await upd();
      change(q('marker', '#marker-tap-action'), 'toggle'); await upd();
      q('marker', '#marker-tap-confirm').click(); await upd();
      radio('marker', 'marker-light-role', 'always'); await upd();
      radio('marker', 'marker-glow-mode', 'fixed'); await upd();
      input(q('marker', '#marker-glow-brightness'), '42'); await upd();
      input(q('marker', '#marker-glow-radius'), '2.5'); await upd();
      input(q('marker', '#marker-model'), 'M-600'); await upd();
      input(q('marker', '#marker-angle'), '35'); await upd();
      await saveViaUi('marker');
    },
    async () => {
      c._setMode('devices'); await upd();
      c._openMarkerDialog(lamp()); await upd();
      c._markerDialog = { ...c._markerDialog, name: 'Parity lamp', tapAction: 'toggle', tapActionTouched: true, tapConfirm: true, model: 'M-600', angle: 35 };
      await upd();
      c._setMarkerLightRole('always'); await upd();
      c._setMarkerGlowMode('fixed'); await upd();
      c._markerDialog = { ...c._markerDialog, glowBrightness: 42, glowBrightnessDrafted: true, glowTouched: true, glowRadius: '2.5' };
      await upd(); await c._saveMarker(); await settle();
    });

  await reset();
  return o;
});

checkAll(Object.fromEntries(Object.entries(out).filter(([k]) => !k.endsWith('_diff'))));
await finish(browser, out);
