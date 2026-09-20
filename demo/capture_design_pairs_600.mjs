// #600 AC1: парные кадры продукта для сравнения с референсом
// docs/design/600-settings-dialogs/ (ACCEPTANCE.md). Диагностическая съёмка, не
// golden: кадры не принимаются golden:accept и не участвуют в golden:verify.
//
//   node demo/capture_design_pairs_600.mjs [--out=docs/design/600-settings-dialogs/pairs]
//
// Четыре диалога × две темы, ширина поверхности 560, скроллер раскрыт на всю
// высоту, чтобы кадр показывал форму целиком, как макет референса. Состояния —
// те же, что в макетах: пространство с температурной заливкой и своим севером,
// общие настройки со статическим фоном, комната с эффективной температурной
// заливкой, устройство — привязанный светильник с ролью Always и фиксированным
// свечением.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch } from './serve.mjs';

const out = resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) || 'docs/design/600-settings-dialogs/pairs');
mkdirSync(out, { recursive: true });

const THEMES = {
  light: {
    '--primary-color': '#0b73b8', '--primary-text-color': '#202124', '--secondary-text-color': '#5f6368',
    '--card-background-color': '#ffffff', '--ha-card-background': '#ffffff', '--divider-color': '#d7d9de',
    '--secondary-background-color': '#e7eaee', '--primary-background-color': '#eef1f4',
  },
  dark: {
    '--primary-color': '#3ea6ff', '--primary-text-color': '#e6e7eb', '--secondary-text-color': '#9aa4ad',
    '--card-background-color': '#202126', '--ha-card-background': '#202126', '--divider-color': '#3a3d45',
    '--secondary-background-color': '#2b2d33', '--primary-background-color': '#11151b',
  },
};

const { page, browser } = await launch({ width: 1280, height: 3600 });

const applyTheme = (theme) => page.evaluate(({ vars, theme }) => {
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.documentElement.style.colorScheme = theme;
  document.body.style.background = theme === 'light' ? '#eef1f4' : '#11151b';
  const c = window.__card;
  c.hass = { ...c.hass, themes: { ...(c.hass.themes || {}), darkMode: theme === 'dark' } };
}, { vars: THEMES[theme], theme });

const openAndExpand = (which) => page.evaluate(async (w) => {
  const c = window.__card;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 40)); };
  c._settingsDialog = null; c._spaceDialog = null; c._markerDialog = null; if (c._roomDialog) c._roomDialogCancel();
  await upd();
  const spId = c._space;
  if (w === 'space') {
    c._setMode('view'); c._openSpaceDialog('edit', spId); await upd();
    c._spaceDialog = { ...c._spaceDialog, fillMode: 'temp', northMode: 'custom', northDeg: 35 }; await upd();
  }
  if (w === 'general') {
    c._openSettingsDialog(); await upd();
    c._settingsDialog = { ...c._settingsDialog, bgMode: 'static', northDeg: 45 }; await upd();
  }
  if (w === 'room') {
    c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s
      : ({ ...s, settings: { ...(s.settings || {}), fill_mode: 'temp', show_names: true } })) };
    c._setMode('plan'); await upd();
    c._openRoomEdit(c._curSpaceCfg.rooms[0]); await upd();
    c._roomFill = 'temp'; c._roomTempMin = '19'; await upd();
  }
  if (w === 'device') {
    c._setMode('devices'); await upd();
    const d = c._devices.find((x) => x.id === 'd_light1') || c._devices.find((x) => x.bindingKind === 'device') || c._devices[0];
    c._openMarkerDialog(d); await upd();
    c._markerDialog = { ...c._markerDialog, lightRole: 'always', lightRoleTouched: true, glowMode: 'fixed', glowTouched: true }; await upd();
  }
  const sr = c.shadowRoot || c.renderRoot;
  const dlg = sr.querySelector('hp-dialog[form-shell]');
  const surface = dlg?.shadowRoot?.querySelector('.surface');
  const content = dlg?.shadowRoot?.querySelector('.content');
  if (content) { content.style.maxHeight = 'none'; content.style.overflow = 'visible'; }
  if (surface) { surface.style.maxHeight = 'none'; surface.style.height = 'auto'; }
  const backdrop = dlg?.shadowRoot?.querySelector('.backdrop, .scrim');
  if (backdrop) backdrop.style.alignItems = 'flex-start';
  // Автофокус первого поля и всплывшая по фокусу подсказка «?» — не часть макета.
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  active?.blur?.();
  await new Promise((r) => setTimeout(r, 250));
  const b = surface?.getBoundingClientRect();
  return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
}, which);

const report = [];
for (const theme of ['light', 'dark']) {
  await applyTheme(theme);
  for (const which of ['space', 'general', 'room', 'device']) {
    const b = await openAndExpand(which);
    if (!b || !b.w) { report.push(`${which}/${theme}: нет поверхности`); continue; }
    const file = resolve(out, `${which}-${theme}.png`);
    const shot = await page.screenshot({ clip: {
      x: Math.max(0, b.x - 4), y: Math.max(0, b.y - 4), width: Math.min(b.w + 8, 1280), height: Math.min(b.h + 8, 3600),
    } });
    writeFileSync(file, shot);
    report.push(`${which}/${theme}: ${Math.round(b.w)}×${Math.round(b.h)} → ${file}`);
  }
}
console.log(report.join('\n'));
await browser.close();
