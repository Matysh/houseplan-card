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
    c.hass = { ...c.hass, states: { ...c.hass.states, ...states } };
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

  // без hvac_action выбранный режим heat не доказывает реальную работу
  o.modeWithoutActionStaysDark = cls(trv, {
    'climate.trv': { state: 'heat', attributes: {} },
  }) === '';

  // горящая лампа устройства желтит значок, даже если primary — не она
  const lamp = { id: 'l', primary: 'sensor.lamp_power', entities: ['sensor.lamp_power', 'light.lamp'], marker: null };
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
