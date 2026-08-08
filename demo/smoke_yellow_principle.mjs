// Единый принцип жёлтого (2026-07-29): жёлтый = устройство прямо сейчас
// выполняет основную функцию. Термоголовка желтеет от реального нагрева
// (hvac_action), а не от служебного свитча защиты от накипи; горящая лампа
// желтит значок в любом режиме заливки тем же условием, что зажигает пятно.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(() => {
  const o = {};
  const c = window.__card;
  const cls = (d, states) => {
    const saved = c.hass;
    const entities = Object.fromEntries(Object.keys(states).map((entity_id) => [
      entity_id,
      { entity_id, platform: 'demo', disabled_by: null },
    ]));
    c.hass = {
      ...c.hass,
      entities: { ...c.hass.entities, ...entities },
      states: { ...c.hass.states, ...states },
    };
    const r = c._stateClass(d);
    c.hass = saved;
    return r;
  };
  const trv = { id: 't', primary: 'climate.trv', entities: ['climate.trv', 'switch.trv_anti_scaling'], marker: null };

  // реально греет → жёлтая
  o.heatingIsYellow = cls(trv, {
    'climate.trv': { state: 'heat', attributes: { hvac_action: 'heating' } },
    'switch.trv_anti_scaling': { state: 'on' },
  }) === 'on';

  // включена, но не греет (idle) → чёрная, даже со включённой защитой от накипи
  o.idleIsDark = cls(trv, {
    'climate.trv': { state: 'heat', attributes: { hvac_action: 'idle' } },
    'switch.trv_anti_scaling': { state: 'on' },
  }) === '';

  // выключена → чёрная
  o.offIsDark = cls(trv, {
    'climate.trv': { state: 'off', attributes: { hvac_action: 'off' } },
  }) === '';

  // Некоторые интеграции не отдают hvac_action: тогда их текущий режим из
  // hvac_modes — единственный доступный сигнал фактической работы.
  o.modeWithoutActionIsYellow = cls(trv, {
    'climate.trv': { state: 'heat_cool', attributes: { hvac_modes: ['off', 'heat', 'cool', 'heat_cool'] } },
  }) === 'on';

  // Функциональная роль настоящей лампы желтит значок. Auxiliary light у
  // soundbar/media-player, наоборот, отсечён системным role-resolver тестом.
  const lamp = { id: 'l', primary: 'light.lamp', entities: ['sensor.lamp_power', 'light.lamp'], marker: null };
  o.litLightWins = cls(lamp, {
    'sensor.lamp_power': { state: '5' },
    'light.lamp': { state: 'on' },
  }) === 'on';
  o.darkLampIdle = cls(lamp, {
    'sensor.lamp_power': { state: '5' },
    'light.lamp': { state: 'off' },
  }) === '';

  // «источник света»: умный выключатель с глупыми светильниками — жёлтый от
  // того же условия, что и пятно glow
  const wall = { id: 'w', primary: 'sensor.w', entities: ['sensor.w'],
    marker: { is_light: true, controls: ['switch.fixtures'] } };
  o.forcedSourceYellow = cls(wall, {
    'sensor.w': { state: '1' }, 'switch.fixtures': { state: 'on' },
  }) === 'on';
  return o;
});
await finish(browser, checkAll(out));
