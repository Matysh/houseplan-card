// #876 AC2/6: the settings opening, not a mutable draft object, owns async tails.
import { launch, launchColdView, checkAll, finish } from './serve.mjs';

{
  const { page, browser } = await launch();
  const out = await page.evaluate(async () => {
    const card = window.__card, hp = window.__hpTest, results = {};
    const root = () => card.shadowRoot;
    const dialog = () => root().querySelector('hp-dialog[data-kind="settings"]');
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const wait = async (predicate, name) => {
      const deadline = performance.now() + 10000;
      while (!predicate()) {
        if (performance.now() > deadline) throw new Error(`signal lifecycle: ${name}`);
        await frame();
      }
      await hp.settled();
    };
    await hp.setMode('devices');
    const open = async () => {
      root().querySelector('[data-hp="settings"]').click();
      await wait(() => dialog()?.querySelector('#gs-show-lqi'), 'settings opens');
    };
    const cancel = async () => {
      const closed = await hp.close(dialog(), { via: 'cancel' });
      if (closed.confirm) closed.confirm.querySelector('[data-hp="dialog-confirm"]').click();
      await wait(() => !dialog(), 'discard closes');
    };
    const original = card.hass.callWS;
    let pending, release;
    const blocked = new Promise(resolve => { release = resolve; });
    card.hass = { ...card.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') { pending = message; await blocked; }
      return original(message);
    } };
    await open();
    dialog().querySelector('#gs-show-lqi').click();
    await hp.settled();
    dialog().querySelector('[data-hp="dialog-confirm"]').click();
    await wait(() => !!pending, 'write dispatched');
    await hp.close(dialog(), { via: 'cancel' });
    await open();
    const replacement = dialog();
    const replacementInput = replacement.querySelector('#gs-show-lqi');
    replacementInput.click();
    await hp.settled();
    const replacementValue = replacementInput.checked;
    release();
    await hp.waitForWrites();
    results.oldSuccessKeepsNewOpening = dialog() === replacement
      && replacement.querySelector('#gs-show-lqi').checked === replacementValue;
    results.acceptedWriteHasOwnValue = card._serverCfg.settings.show_lqi === false;
    await cancel();
    card.hass = { ...card.hass, callWS: original };

    // A real conflict reload must win over the optimistic proposed global value.
    await hp.setServerConfig(cfg => { delete cfg.settings.show_lqi; cfg.settings.future_876 = 'server'; return cfg; });
    await open();
    dialog().querySelector('#gs-show-lqi').click();
    await hp.settled();
    card.hass = { ...card.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') throw Object.assign(new Error('conflict'), { code: 'conflict' });
      return original(message);
    } };
    dialog().querySelector('[data-hp="dialog-confirm"]').click();
    await wait(() => card._settingsDialog?.busy === false, 'conflict settles');
    results.conflictReloadKeepsServerAndDraft = !Object.hasOwn(card._serverCfg.settings, 'show_lqi')
      && card._serverCfg.settings.future_876 === 'server' && dialog().querySelector('#gs-show-lqi').checked === false;
    await cancel();
    card.hass = { ...card.hass, callWS: original };

    // Different session with an actual accepted read-only config response.
    let writes = 0;
    const readonly = document.createElement('houseplan-card');
    readonly.setConfig({ type: 'custom:houseplan-card' });
    readonly.hass = { ...card.hass, user: { id: 'readonly876', is_admin: false },
      connection: { ...card.hass.connection }, callWS: async message => {
        if (message.type === 'houseplan/config/set') writes++;
        const reply = await original(message);
        return message.type === 'houseplan/config/get' ? { ...reply, can_write: false } : reply;
      } };
    document.body.append(readonly);
    await wait(() => readonly.shadowRoot?.querySelector('.dev'), 'read-only accepted plan');
    results.readonlyNoSettingsControl = !readonly.shadowRoot.querySelector('[data-hp="settings"]');
    readonly._openSettingsDialog();
    await readonly.updateComplete;
    results.readonlyDirectOpeningDenied = !readonly.shadowRoot.querySelector('hp-dialog[data-kind="settings"]') && writes === 0;
    readonly.remove();
    return results;
  });
  checkAll(out);
  await finish(browser, out);
}

{
  const { page, browser } = await launchColdView();
  let held, resume;
  const loaded = new Promise(resolve => { resume = resolve; });
  await page.route('**/houseplan-editor-runtime-*.js', async route => {
    held = true;
    await loaded;
    await route.continue();
  });
  await page.locator('houseplan-card [data-hp="settings"]').click();
  const deadline = Date.now() + 10000;
  while (!held) {
    if (Date.now() > deadline) throw new Error('signal lifecycle: lazy editor request absent');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk: true }));
  resume();
  await page.waitForFunction(() => !!window.__card._editorRuntime);
  const out = await page.evaluate(async () => {
    await window.__hpTest.settled();
    return { lateLoaderCannotOpenInKiosk: !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="settings"]') };
  });
  checkAll(out);
  await finish(browser, out);
}
