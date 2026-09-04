import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 640, height: 980 }, 2);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c.hass = {
    ...c.hass,
    locale: { language: 'ru' },
    states: {
      ...c.hass.states,
      'sensor.living_hum': {
        entity_id: 'sensor.living_hum',
        state: '47.6',
        attributes: {
          friendly_name: 'Living humidity',
          device_class: 'humidity',
          unit_of_measurement: '%',
        },
      },
    },
    entities: {
      ...c.hass.entities,
      'sensor.living_hum': {
        entity_id: 'sensor.living_hum',
        device_id: 'd_temp',
        platform: 'demo',
        disabled_by: null,
      },
    },
  };
  await c.updateComplete;
  // заливка temp вкл → класс filled и тултип с температурой
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { show_borders: true, show_names: true, fill_mode: 'temp', temp_min: 20, temp_max: 25 } })) };
  c._regSignature=''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.filledClass = sr().querySelectorAll('.room.styled.filled').length;   // только living (термометр)
  out.unfilled = sr().querySelectorAll('.room.styled:not(.filled)').length;
  // тултип комнаты: площадь и агрегаты температуры/влажности в стабильном порядке
  const rooms = [...sr().querySelectorAll('.room')];
  const room = rooms[0];
  room.dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200,
  }));
  await c.updateComplete;
  out.tipTemp = c._tip?.temp;
  out.tipHum = c._tip?.hum;
  out.tipHasTempLine = (sr().querySelector('.tip')?.textContent || '').includes('средняя температура');
  out.tipHasHumLine = (sr().querySelector('.tip')?.textContent || '').includes('средняя влажность: 48%');
  const metricLines = [...sr().querySelectorAll('.tip .m')].map((line) => line.textContent.trim());
  const tempLine = metricLines.findIndex((line) => line.includes('средняя температура'));
  const humLine = metricLines.findIndex((line) => line.includes('средняя влажность'));
  const lqiLine = metricLines.findIndex((line) => line.includes(c._t('tip.lqi')));
  out.tipMetricOrder = tempLine >= 0 && humLine === tempLine + 1 && lqiLine === humLine + 1;
  out.tipPositionUnchanged = sr().querySelector('.tip')?.style.left === '212px'
    && sr().querySelector('.tip')?.style.top === '212px';
  // _roomArea consumes the rendered room geometry (0..1000), not the stored
  // normalized config polygon (0..1).
  const expectedArea = c._roomArea(c._spaceModel().rooms[0]);
  out.tipHasArea = !!expectedArea && c._tip?.meta === c._t('tip.area', { value: expectedArea });
  out.tipHasAreaLine = (sr().querySelector('.tip')?.textContent || '').includes(expectedArea);

  // Комната без источника влажности не получает пустую строку.
  rooms[1].dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 210, clientY: 210,
  }));
  await c.updateComplete;
  out.noHumidityOmitted = c._tip?.hum == null
    && !(sr().querySelector('.tip')?.textContent || '').includes('средняя влажность');

  // Общий device tooltip остаётся без room humidity.
  sr().querySelector('.dev').dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 220, clientY: 220,
  }));
  await c.updateComplete;
  out.deviceTooltipHasNoHumidity = c._tip?.hum == null
    && !(sr().querySelector('.tip')?.textContent || '').includes('средняя влажность');

  // Touch/pen input never creates hover-only tooltips.
  room.dispatchEvent(new PointerEvent('pointerdown', {
    pointerType: 'touch', pointerId: 91, bubbles: true, composed: true,
    clientX: 230, clientY: 230,
  }));
  c._tip = null;
  room.dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'touch', pointerId: 91, bubbles: true, composed: true,
    clientX: 230, clientY: 230,
  }));
  await c.updateComplete;
  out.noHoverSuppressesTooltip = c._tip === null;
  room.dispatchEvent(new PointerEvent('pointerup', {
    pointerType: 'touch', pointerId: 91, bubbles: true, composed: true,
    clientX: 230, clientY: 230,
  }));
  // диалог: радио заливки, компактные поля, ширина
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  out.fillRadios = sr().querySelectorAll('input[name="fillmode"]').length;
  out.fillLabels = [...sr().querySelectorAll('input[name="fillmode"]')]
    // Read the radio's own label only. The selected temperature mode also
    // renders two nested range controls inside this label.
    .map((input) => input.nextElementSibling?.textContent?.trim());
  out.fillHasNone = out.fillLabels.includes(c._t('fill.none'));
  out.glowToggle = [...sr().querySelectorAll('hp-dialog label.srcrow')].some((label) =>
    label.textContent.trim() === c._t('space.glow_enabled')
      && !!label.querySelector('ha-switch,input[type="checkbox"]'));
  out.tempInputs = sr().querySelectorAll('.temprange .tempin').length;
  const hpDialog = sr().querySelector('hp-dialog');
  out.dialogWide = !!hpDialog?.hasAttribute('wide') && !!hpDialog.querySelector('.srcrow');
  out.dialogWidth = Math.round(hpDialog.shadowRoot.querySelector('.surface').getBoundingClientRect().width);
  // NaN-защита: пустой ввод не ломает границы
  const before = c._spaceDialog.tempMax;
  const fakeEv = { target: { value: '' } };
  // симулируем input с пустым значением через обработчик радио-строки — парсер должен сохранить старое
  const n = parseFloat('');
  out.nanGuard = !Number.isFinite(n) && c._spaceDialog.tempMax === before;
  // Space-level `none` remains readable, but the current dialog offers the
  // ordinary selectable custom colour in its place.
  c._spaceDialog = null;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'none', glow_enabled: true },
  })) };
  c._openSpaceDialog('edit', 'f1');
  await c.updateComplete;
  out.legacyNoneProjection = c._spaceDialog.fillMode;
  out.legacyNoneAlpha = c._spaceDialog.customFill?.a;
  out.legacyNoneGlowBases = sr().querySelectorAll('.glow-base-layer .glow-base').length;
  return out;
});
// артефакт для глазами: путь берём у ОС, а не хардкодим unix-овый — на Windows
// '/tmp/...' указывает в несуществующий C:\tmp и смоук падал, не дойдя до
// ассертов (портируемость, ревью 2026-07-27)
await page.screenshot({ path: join(tmpdir(), 'houseplan_ux_dialog.png') }).catch(() => {});
// Geometry values were re-baselined for the shared border-box hp-dialog in
// v1.59.2; the usable wide-dialog width remains 500 px.
checkAll(res, {
  "filledClass": 1,
  "unfilled": 3,
  "tipTemp": 22.4,
  "tipHum": 48,
  "fillRadios": 4,
  "fillLabels": ["Свой цвет", "По силе зигби-сигнала", "По освещению", "По температуре"],
  "fillHasNone": false,
  "legacyNoneProjection": "custom",
  "legacyNoneAlpha": 0,
  "legacyNoneGlowBases": 4,
  "tempInputs": 2,
  "dialogWidth": 500,
});
await finish(browser, res);
