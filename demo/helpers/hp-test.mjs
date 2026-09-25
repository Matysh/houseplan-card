// Тестовый фасад харнесса смоков: `window.__hpTest` (#629).
//
// Смок, который открывает диалог присваиванием приватного поля и меняет план
// присваиванием `_serverCfg`, зелёный и тогда, когда кнопка, поле ввода или путь
// закрытия сломаны. Фасад делает то же самое так, как это делает человек или
// другой клиент HA: нажимает настоящую кнопку, печатает по символу, закрывает
// Escape'ом или крестиком, доставляет конфиг событием сервера.
//
// Живёт в харнессе, а не в бандле: в публичной карточке нет ни кода фасада, ни
// флага, который бы его включал (#629 §15). Ставится `launch()`,
// `launchColdView()` и `launchPanelCold()` из demo/serve.mjs после загрузки
// страницы; смок, который сам перезагружает страницу, зовёт
// `installHpTestOnPage(page)` ещё раз.
//
// Правила (docs/TESTING.md, «Тестовый фасад и приватное состояние»):
// - элементы ищутся ТОЛЬКО по контрактным селекторам SELECTORS — каждый из них
//   объявлен в docs/data-hp-contract.json с аудиторией `test`; это держит
//   test/hp-test-facade.test.mjs;
// - отсутствующий элемент — именованная ошибка, молчаливого отката на
//   приватный метод карточки нет;
// - фасад не пишет ни в одно поле карточки и читает только члены, которые
//   читает и сам продукт: READS ниже.

/**
 * Контрактные селекторы фасада. `{name}` — подстановка аргумента операции.
 * Единственный источник: страничная часть получает таблицу аргументом.
 */
export const SELECTORS = Object.freeze({
  modeRoot: 'ha-card[data-hp-mode]',
  modeTab: '[data-hp="mode-tab"][data-mode="{mode}"]',
  editorClose: '[data-hp="editor-close"]',
  tool: '[data-hp="toolbar"] [data-hp="tool"][data-tool="{tool}"]',
  spaceTab: '[data-hp="space-tab"][data-id="{id}"]',
  roomSettings: '[data-hp="room-settings"][data-room="{room}"]',
  addDevice: '[data-hp="toolbar"] [data-hp="tool"][data-tool="add-device"]',
  device: '[data-hp="device"][data-id="{id}"]',
  spaceAdd: '[data-hp="space-add"]',
  createSpace: '[data-hp="create-space"]',
  spaceSettings: '[data-hp="space-settings"][data-id="{id}"]',
  dialog: '[data-hp="dialog"]',
  dialogOfKind: '[data-hp="dialog"][data-kind="{kind}"]',
  confirmDialog: '[data-hp="dialog"][data-kind="confirm"]',
  dialogCancel: '[data-hp="dialog-cancel"]',
});

/** Члены карточки, которые фасад читает (F3). Записей нет ни одной. */
export const READS = Object.freeze(['_cfgRev', '_layoutRev', '_serverCfg', '_layout']);

/**
 * Страничная часть. Сериализуется Playwright'ом, поэтому самодостаточна:
 * ничего вне своего тела не видит, таблицу селекторов получает аргументом.
 */
export function installHpTest(selectors) {
  const preinstalled = typeof window.__hpTest !== 'undefined';
  const WAIT_MS = 5000;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const card = () => window.__card
    || document.querySelector('houseplan-card')
    || document.querySelector('houseplan-panel')?.shadowRoot?.querySelector('houseplan-card')
    || null;
  const need = (op) => {
    const c = card();
    if (!c) throw new Error(`__hpTest.${op}: карточка не смонтирована`);
    return c;
  };
  const rootOf = (c) => c.shadowRoot || c.renderRoot;
  const sel = (name, params = {}) => selectors[name].replace(/\{(\w+)\}/g, (_, key) => {
    const value = String(params[key]);
    return value.replace(/["\\]/g, '\\$&');
  });
  /** Поиск по селектору в дереве карточки, включая вложенные открытые shadow root. */
  const deepAll = (root, selector) => {
    const out = [];
    const walk = (node) => {
      if (!node) return;
      out.push(...node.querySelectorAll(selector));
      for (const el of node.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(root);
    return [...new Set(out)];
  };
  const find = (c, name, params) => deepAll(rootOf(c), sel(name, params))[0] || null;
  const mode = (c) => rootOf(c)?.querySelector(selectors.modeRoot)?.getAttribute('data-hp-mode') || '?';
  const missing = (op, c, name, params) => new Error(
    `__hpTest.${op}: ${sel(name, params)} не отрисован (режим ${mode(c)})`);
  const settled = async () => {
    const c = card();
    if (c?.updateComplete) await c.updateComplete;
    await frame();
    await frame();
    if (c?.updateComplete) await c.updateComplete;
  };
  const waitFor = async (op, predicate, describe, ms = WAIT_MS) => {
    const deadline = performance.now() + ms;
    for (;;) {
      const value = predicate();
      if (value) return value;
      if (performance.now() > deadline) throw new Error(`__hpTest.${op}: ${describe()}`);
      await sleep(16);
    }
  };
  const openDialog = async (op, c, kind) => {
    const dialogs = () => deepAll(rootOf(c), sel('dialogOfKind', { kind }));
    await settled();
    return waitFor(op, () => dialogs().at(-1), () => `диалог ${sel('dialogOfKind', { kind })} не открылся (режим ${mode(c)})`);
  };
  const deepActive = (root) => {
    let active = root.shadowRoot?.activeElement || document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active && root.contains(active) ? active : null;
  };
  const valueSetter = (el) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    return Object.getOwnPropertyDescriptor(proto, 'value').set;
  };

  const facade = {
    /** Был ли `__hpTest` на странице ДО установки харнессом — бандл его определять не должен (P2). */
    preinstalled,
    settled,

    async setMode(next) {
      const c = need('setMode');
      if (mode(c) === next) { await settled(); return; }
      const button = next === 'view'
        ? find(c, 'editorClose')
        : find(c, 'modeTab', { mode: next });
      if (!button) throw missing('setMode', c, next === 'view' ? 'editorClose' : 'modeTab', { mode: next });
      button.click();
      await settled();
      await waitFor('setMode', () => mode(c) === next,
        () => `${sel('modeRoot')} не перешёл в ${next} (сейчас ${mode(c)})`);
      await settled();
    },

    async setTool(tool) {
      const c = need('setTool');
      const button = find(c, 'tool', { tool });
      if (!button) throw missing('setTool', c, 'tool', { tool });
      button.click();
      await settled();
      return button;
    },

    async switchSpace(id) {
      const c = need('switchSpace');
      const tab = find(c, 'spaceTab', { id });
      if (!tab) throw missing('switchSpace', c, 'spaceTab', { id });
      tab.click();
      await settled();
      await waitFor('switchSpace', () => find(c, 'spaceTab', { id })?.getAttribute('aria-current') === 'page',
        () => `вкладка ${sel('spaceTab', { id })} не стала текущей`);
      await settled();
    },

    async openRoomEdit(room) {
      const c = need('openRoomEdit');
      const gear = find(c, 'roomSettings', { room });
      if (!gear) throw missing('openRoomEdit', c, 'roomSettings', { room });
      gear.click();
      return openDialog('openRoomEdit', c, 'room');
    },

    async openMarkerDialog(deviceId) {
      const c = need('openMarkerDialog');
      const target = deviceId === undefined
        ? find(c, 'addDevice')
        : find(c, 'device', { id: deviceId });
      if (!target) {
        throw deviceId === undefined
          ? missing('openMarkerDialog', c, 'addDevice')
          : missing('openMarkerDialog', c, 'device', { id: deviceId });
      }
      target.click();
      return openDialog('openMarkerDialog', c, 'marker');
    },

    async openSpaceDialog(kind = 'create', id) {
      const c = need('openSpaceDialog');
      let target;
      if (kind === 'edit') {
        target = find(c, 'spaceSettings', { id });
        if (!target) throw missing('openSpaceDialog', c, 'spaceSettings', { id });
      } else {
        target = find(c, 'spaceAdd') || find(c, 'createSpace');
        if (!target) throw missing('openSpaceDialog', c, 'spaceAdd');
      }
      target.click();
      return openDialog('openSpaceDialog', c, 'space');
    },

    /** «Конфиг изменили на сервере» (F2): событие houseplan_config_updated, карточка перечитывает сама. */
    async setServerConfig(next) {
      const c = need('setServerConfig');
      if (typeof window.__pushServerConfig !== 'function') throw new Error('__hpTest.setServerConfig: фикстура без __pushServerConfig');
      const current = structuredClone(c._serverCfg);
      const cfg = typeof next === 'function' ? (next(current) ?? current) : next;
      const rev = window.__pushServerConfig(cfg);
      await waitFor('setServerConfig',
        () => window.__servedRevision.config >= rev && c._cfgRev >= rev,
        () => `карточка не приняла ревизию конфига: ожидалась ${rev}, у карточки ${c._cfgRev}, отдано ${window.__servedRevision.config}`);
      await settled();
      return rev;
    },

    /**
     * #649: 2.5D is the installation-wide «General settings › Display» switch.
     * Delivered the way another client's save arrives (setServerConfig keeps
     * the card's current config); the oracle is the rendered stage class.
     */
    async setVolumetricView(on = true) {
      const c = need('setVolumetricView');
      await facade.setServerConfig((cfg) => {
        cfg.settings = { ...(cfg.settings || {}), volumetric_view: !!on };
        return cfg;
      });
      const stage = () => rootOf(c)?.querySelector('.stage');
      await waitFor('setVolumetricView',
        () => !!stage() && stage().classList.contains('projection-iso') === !!on,
        () => `вид не стал ${on ? '2.5D' : 'Flat'} (.stage: ${stage()?.className || 'нет'})`,
        10000);
      await settled();
    },

    /** То же для раскладки: событие houseplan_layout_updated (у карточки дебаунс 200 мс). */
    async setLayout(next) {
      const c = need('setLayout');
      if (typeof window.__pushServerLayout !== 'function') throw new Error('__hpTest.setLayout: фикстура без __pushServerLayout');
      const current = structuredClone(c._layout);
      const layout = typeof next === 'function' ? (next(current) ?? current) : next;
      const rev = window.__pushServerLayout(layout);
      await waitFor('setLayout',
        () => window.__servedRevision.layout >= rev && c._layoutRev >= rev,
        () => `карточка не приняла ревизию раскладки: ожидалась ${rev}, у карточки ${c._layoutRev}, отдано ${window.__servedRevision.layout}`);
      await settled();
      return rev;
    },

    /** Посимвольный ввод в поле: keydown → значение → input(insertText) → keyup; в конце change. */
    async input(el, text, { clear = true } = {}) {
      if (!el) throw new Error('__hpTest.input: элемент не передан');
      const target = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el
        : el.shadowRoot?.querySelector('input, textarea') || el.querySelector?.('input, textarea');
      if (!target) throw new Error(`__hpTest.input: в <${el.localName}> нет input/textarea`);
      const set = valueSetter(target);
      target.focus();
      if (clear && target.value !== '') {
        set.call(target, '');
        target.dispatchEvent(new InputEvent('input', {
          inputType: 'deleteContentBackward', bubbles: true, composed: true,
        }));
      }
      for (const ch of String(text)) {
        const key = { key: ch, bubbles: true, composed: true, cancelable: true };
        target.dispatchEvent(new KeyboardEvent('keydown', key));
        set.call(target, target.value + ch);
        target.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText', data: ch, bubbles: true, composed: true,
        }));
        target.dispatchEvent(new KeyboardEvent('keyup', key));
      }
      target.dispatchEvent(new Event('change', { bubbles: true }));
      await settled();
      return target;
    },

    /** Закрыть диалог настоящим путём: Escape, крестик окна или кнопка «Отмена». */
    async close(dialog, { via = 'escape' } = {}) {
      const c = need('close');
      const target = dialog || deepAll(rootOf(c), sel('dialog')).filter((d) => d.isConnected).at(-1);
      if (!target) throw missing('close', c, 'dialog');
      if (via === 'escape') {
        const origin = deepActive(target) || target;
        origin.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', bubbles: true, composed: true, cancelable: true,
        }));
      } else if (via === 'x') {
        if (target.shadowRoot?.querySelector('ha-dialog')) {
          throw new Error('__hpTest.close: крестик HA — в приватном shadow root HA; используйте via: escape или cancel');
        }
        const x = target.shadowRoot?.querySelector(sel('dialogCancel'));
        if (!x) throw new Error(`__hpTest.close: у диалога нет крестика ${sel('dialogCancel')}`);
        x.click();
      } else if (via === 'cancel') {
        const cancel = target.querySelector(sel('dialogCancel'));
        if (!cancel) throw new Error(`__hpTest.close: в содержимом диалога нет ${sel('dialogCancel')}`);
        cancel.click();
      } else {
        throw new Error(`__hpTest.close: неизвестный путь ${via}`);
      }
      await settled();
      const confirmOf = () => deepAll(rootOf(c), sel('confirmDialog')).find((d) => d !== target) || null;
      await waitFor('close', () => !target.isConnected || confirmOf(),
        () => `диалог ${target.getAttribute('data-kind')} не закрылся через ${via}`);
      await settled();
      return { closed: !target.isConnected, confirm: confirmOf() };
    },
  };
  window.__hpTest = Object.freeze(facade);
  return preinstalled;
}

/** Node-сторона: поставить фасад на открытую страницу. */
export async function installHpTestOnPage(page) {
  return page.evaluate(installHpTest, SELECTORS);
}
