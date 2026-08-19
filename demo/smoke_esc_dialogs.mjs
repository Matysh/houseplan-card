import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const composedContains = (root, target) => {
    let node = target;
    while (node) {
      if (node === root) return true;
      const tree = node.getRootNode?.();
      node = node.parentNode || (tree instanceof ShadowRoot ? tree.host : null);
    }
    return false;
  };

  // A11Y-02: the shared native fallback carries the same modal/focus contract
  // that ha-dialog supplies in Home Assistant.
  const opener = document.createElement('button');
  opener.textContent = 'open settings';
  sr.append(opener);
  opener.focus();
  c._openSettingsDialog(); await c.updateComplete; await frame();
  const hp = sr.querySelector('hp-dialog');
  const native = hp?.shadowRoot?.querySelector('dialog');
  const titleId = native?.getAttribute('aria-labelledby');
  out.sharedShell = !!hp && !!native?.open;
  out.modalSemantics = native?.getAttribute('role') === 'dialog'
    && native?.getAttribute('aria-modal') === 'true'
    && !!titleId && !!hp.shadowRoot.getElementById(titleId)?.textContent.trim();
  let active = deepActive();
  // Unified colour controls put the first focus target in their own shadow
  // root. Test composed ownership, not only light-DOM containment.
  out.initialFocus = !!active && composedContains(hp, active);
  const focusable = [...hp.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
  const last = focusable.at(-1);
  last?.focus();
  last?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab', bubbles: true, composed: true, cancelable: true,
  }));
  active = deepActive();
  out.focusTrap = active?.classList?.contains('close') === true;
  active?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await c.updateComplete; await frame();
  out.restoreFocus = !c._settingsDialog && deepActive() === opener;
  opener.remove();

  const esc = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await c.updateComplete; };
  // общие настройки
  c._openSettingsDialog(); await c.updateComplete;
  await esc(); out.settings = !c._settingsDialog;
  // правила иконок
  c._openRulesDialog(); await c.updateComplete;
  await esc(); out.rules = !c._rulesDialog;
  // диалог устройства
  c._setMode('devices'); c._openMarkerDialog(); await c.updateComplete;
  await esc(); out.marker = !c._markerDialog;
  // диалог пространства (+ очистка очереди импорта)
  c._openSpaceDialog('edit', c._space); c._importQueue = ['x']; c._importTotal = 1; await c.updateComplete;
  await esc(); out.space = !c._spaceDialog && c._importQueue.length === 0;
  // инфо-карточка устройства
  c._setMode('view'); c._infoCard = c._devices[0]; await c.updateComplete;
  await esc(); out.info = !c._infoCard;
  // инфо двери/замка
  c._openingInfo = { id: 'op1', type: 'door', rx: 550, ry: 200, len_cm: 90, lock: 'lock.front_door' }; await c.updateComplete;
  await esc(); out.openingInfo = !c._openingInfo;
  // приоритет: инфо поверх настроек — Esc закрывает только инфо
  c._openSettingsDialog(); c._infoCard = c._devices[0]; await c.updateComplete;
  await esc(); out.stacked = !c._infoCard && !!c._settingsDialog;
  await esc(); out.stacked2 = !c._settingsDialog;
  // Esc в разметке по-прежнему откатывает точку, а не только диалоги
  c._setMode('plan'); c._tool = 'draw'; c._path = [[1, 2], [3, 4]]; await c.updateComplete;
  await esc(); out.undoPointStillWorks = c._path.length === 1;
  return out;
});
checkAll(res);
await finish(browser, res);
