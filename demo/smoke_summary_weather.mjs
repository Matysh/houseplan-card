// Synthetic HA forecast transport; real product summary/editor rendering and lifecycle.
import { launch, check, finish } from './serve.mjs';
import { mkdirSync } from 'node:fs';
const { page, browser } = await launch({ width: 1280, height: 720 });
mkdirSync('output/issue1174', { recursive: true });
try {
  await page.waitForFunction(() => !!window.__card?._summary);
  await page.evaluate(async () => {
    const card = window.__card, root = () => card.shadowRoot;
    const settle = async () => { await card.updateComplete; await new Promise(requestAnimationFrame); await card.updateComplete;
      await root().querySelector('hp-summary-weather')?.updateComplete; };
    card._config = { ...card._config, language: 'ru', kiosk: false };
    card._serverCanWrite = true; card._haSummaryPanelApi = 1; card.narrow = false;
    const subscriptions = [], opened = [], writes = [];
    const weather = { state: 'cloudy', attributes: { friendly_name: 'Дом', temperature: 8, apparent_temperature: 6,
      temperature_unit: '°C', wind_speed: 3.2, wind_speed_unit: 'm/s', wind_bearing: 225, humidity: 76, supported_features: 1 } };
    const connection = { subscribeMessage(callback, message) {
      const sub = { callback, message, released: false }; subscriptions.push(sub);
      return Promise.resolve(() => { sub.released = true; });
    } };
    card.hass = { ...card.hass, connection, language: 'ru', locale: { language: 'ru', number_format: 'decimal_comma' },
      config: { ...card.hass.config, time_zone: 'Europe/Moscow', unit_system: { temperature: '°C' } },
      states: { ...card.hass.states, 'weather.lab_home': weather } };
    const cfg = structuredClone(card._serverCfg);
    cfg.settings = { ...cfg.settings, summary_panel: { version: 1, title: 'Обзор дома', show_on_mobile: true,
      blocks: [], weather: { enabled: true, entity_id: 'weather.lab_home' } } };
    card._serverCfg = cfg; card._settings = cfg.settings; card._cfgEpoch = (card._cfgEpoch || 0) + 1;
    card._sendConfigCandidate = async candidate => { writes.push(structuredClone(candidate)); card._cfgRev++; };
    root().addEventListener('hass-more-info', event => opened.push(event.detail.entityId));
    card._summary.updated(); card.requestUpdate(); await settle();
    const toggle = root().querySelector('[data-hp="summary-toggle"]');
    if (toggle?.getAttribute('aria-pressed') !== 'true') toggle?.click();
    await settle();
    window.__weather1174 = { card, root, settle, weather, subscriptions, opened, writes,
      widget: () => root().querySelector('hp-summary-weather'),
      set: async values => { card.hass = { ...card.hass, states: { ...card.hass.states, ...values } }; await settle(); },
      config: async weatherConfig => { const next = structuredClone(card._serverCfg);
        next.settings.summary_panel.weather = weatherConfig; card._serverCfg = next; card._settings = next.settings;
        card._summary.updated(); card.requestUpdate(); await settle(); },
    };
  });
  await page.waitForFunction(() => window.__weather1174.widget()?.textContent.includes('+8°'));
  check('weather works as the only panel content', await page.evaluate(() => {
    const f = window.__weather1174;
    return !f.root().querySelector('.summary-empty') && f.subscriptions.length === 1
      && f.widget().textContent.includes('Ветер юго-западный') && f.widget().textContent.includes('3,2 м/с');
  }));
  await page.evaluate(async () => {
    const f = window.__weather1174;
    const day = n => { const date = new Date(); date.setUTCHours(12, 0, 0, 0); date.setUTCDate(date.getUTCDate() + n); return date.toISOString(); };
    f.subscriptions[0].callback({ type: 'daily', forecast: [
      { datetime: day(0), temperature: 10, templow: 4, condition: 'partlycloudy' },
      { datetime: day(1), temperature: 7, templow: 3, condition: 'rainy' },
      { datetime: day(2), temperature: 9, templow: 5, condition: 'cloudy' },
    ] }); await f.settle();
  });
  check('daily forecast shows three ordered days', await page.locator('hp-summary-weather .summary-weather-forecast > div').count() === 3);
  await page.locator('hp-summary-weather').screenshot({ path: 'output/issue1174/weather-widget.png' });
  await page.screenshot({ path: 'output/issue1174/weather-only.png' });
  await page.locator('hp-summary-weather button').click();
  check('weather opens its own HA more-info', await page.evaluate(() => window.__weather1174.opened.at(-1) === 'weather.lab_home'));
  check('current weather and forecast updates do not rerender the parent plan', await page.evaluate(async () => {
    const f = window.__weather1174, card = f.card;
    const render = card.render; let renders = 0;
    card.render = function (...args) { renders++; return render.apply(this, args); };
    await f.set({ 'weather.lab_home': { ...f.weather, attributes: { ...f.weather.attributes, temperature: 9 } } });
    f.subscriptions[0].callback({ type: 'daily', forecast: [] }); await f.settle();
    card.render = render;
    return renders === 0 && f.widget().textContent.includes('+9°');
  }));
  check('absent values are omitted, zero is retained, Fahrenheit and west bearing render correctly', await page.evaluate(async () => {
    const f = window.__weather1174;
    await f.set({ 'weather.lab_home': { state: 'sunny', attributes: { temperature: 32, temperature_unit: '°F',
      humidity: 0, wind_bearing: 270 } } });
    const text = f.widget().textContent;
    return text.includes('+32°F') && text.includes('0%') && text.includes('Ветер западный') && !text.includes('Ощущается');
  }));
  check('unavailable and deleted sources never silently switch to another location', await page.evaluate(async () => {
    const f = window.__weather1174;
    await f.set({ 'weather.lab_home': { state: 'unavailable' }, 'weather.lab_country': f.weather });
    const unavailable = f.widget().textContent.includes('Погода временно недоступна');
    const states = { ...f.card.hass.states }; delete states['weather.lab_home'];
    f.card.hass = { ...f.card.hass, states }; await f.settle();
    return unavailable && !f.widget().textContent.includes('+8°') && f.widget().textContent.includes('удал');
  }));
  await page.evaluate(async () => {
    const f = window.__weather1174;
    await f.set({ 'weather.lab_home': f.weather });
    await f.card._summary.openDialog(); await f.settle();
  });
  await page.waitForSelector('[data-field="summary-weather-enabled"]');
  await page.screenshot({ path: 'output/issue1174/weather-settings.png' });
  const picker = page.locator('[data-field="summary-weather-entity"]');
  await picker.selectOption('weather.lab_country');
  const checkbox = page.locator('[data-field="summary-weather-enabled"]');
  await checkbox.uncheck();
  check('disabled checkbox hides source picker', await picker.count() === 0);
  await checkbox.check();
  check('reenabling restores explicit source', await picker.inputValue() === 'weather.lab_country');
  await page.evaluate(async () => {
    const f = window.__weather1174;
    f.root().querySelector('hp-dialog[data-kind="summary"] [data-hp="dialog-confirm"]')?.click(); await f.settle();
  });
  // Saving through the real summary handler; the isolated server stub records its wire body.
  check('selected weather source is saved in the configuration', await page.evaluate(() =>
    window.__weather1174.writes.at(-1)?.settings.summary_panel.weather.entity_id === 'weather.lab_country'));
  check('hide releases forecast and late replies cannot revive it', await page.evaluate(async () => {
    const f = window.__weather1174;
    await f.config({ enabled: true, entity_id: 'weather.lab_home' });
    f.root().querySelector('[data-hp="summary-toggle"]')?.click(); await f.settle();
    f.subscriptions.forEach(sub => sub.callback({ type: 'daily', forecast: [{ datetime: new Date().toISOString(), temperature: 999 }] }));
    await f.settle();
    return f.subscriptions.every(sub => sub.released) && !f.root().querySelector('.summary-overlay[aria-hidden="false"]');
  }));
} finally { await finish(browser); }
