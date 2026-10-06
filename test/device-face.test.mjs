import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deviceFaceStyle, deviceTextScale, deviceThemeClass,
  legacySupplementalMetrics, lqiClassName, renderDeviceFace,
  valueBadgeClassName, renderDeviceShadowFace,
} from '../test-build/device-face.js';

const face = (rippleColor) => ({
  display: 'icon_ripple', scale: 1,
  pulse: {
    kind: 'continuous', reason: 'running', generation: 1, expiresAt: null,
    color: rippleColor, diameterScale: 3, animated: true, reducedMotionIndicator: 'none',
  },
});

test('device face never emits an arbitrary persisted ripple declaration', () => {
  assert.deepEqual(deviceFaceStyle(face('#12aBcD')), [
    '--ripple-scale:3', '--ripple-color:#12aBcD',
  ]);
  assert.deepEqual(deviceFaceStyle(face('rgb(12, 140, 250)')), [
    '--ripple-scale:3', '--ripple-color:rgb(12, 140, 250)',
  ]);
  const hostile = deviceFaceStyle(face('red;position:fixed;inset:0'));
  assert.deepEqual(hostile, ['--ripple-scale:3']);
  assert.ok(!hostile.join(';').includes('position'));
});

test('HA darkMode selects an exact package theme and otherwise leaves CSS fallback in charge', () => {
  assert.equal(deviceThemeClass({ themes: { darkMode: true } }), 'theme-dark');
  assert.equal(deviceThemeClass({ themes: { darkMode: false } }), 'theme-light');
  assert.equal(deviceThemeClass({}), '');
});

test('untouched legacy temperature and humidity keep the second satellite', () => {
  const presentation = {
    valueBadge: {
      configured: false,
      source: { kind: 'temperature', eid: 'sensor.temp' },
      tone: 'temperature',
    },
    tempText: '22.4',
    humText: '48',
  };
  assert.deepEqual(legacySupplementalMetrics(presentation), [
    { kind: 'humidity', text: '48', suffix: '%' },
  ]);
  assert.deepEqual(legacySupplementalMetrics({
    ...presentation,
    valueBadge: { ...presentation.valueBadge, configured: true },
  }), []);
});

test('value badge classes cover all four positions and only bottom displaces LQI', () => {
  for (const position of ['right', 'bottom', 'left', 'top']) {
    const badge = {
      position, availability: 'available', tone: 'default',
    };
    assert.equal(
      valueBadgeClassName(badge),
      `value-badge pos-${position} available tone-default`,
    );
    assert.equal(
      lqiClassName(badge),
      position === 'bottom' ? 'lqi below-value-badge' : 'lqi',
    );
  }
  assert.equal(lqiClassName(null), 'lqi');
});

test('rendered pulse retains the documented activity-ring compatibility hook', () => {
  const presentation = {
    ...face('#ff9800'), classes: [], icon: 'mdi:lightbulb', angle: 0,
    valueText: null, valueFullText: null, valueBadge: null,
    lqiText: null, lqiColor: null, lqiBand: null, haDisabled: false,
    tempText: null, humText: null,
  };
  const root = renderDeviceFace(presentation, { surface: 'preview' });
  const nested = root.values.find((value) => value?.strings);
  assert.ok(nested);
  assert.match(nested.strings.join(''), /device-pulse activity-ring/);
});

test('Text and Double use one shared shell and deterministic full-text fitting', () => {
  assert.equal(deviceTextScale('42 °C'), 0.45);
  assert.equal(deviceTextScale('A very long localized device value'), 0.25);

  const presentation = {
    ...face('#ff9800'), classes: [], icon: 'mdi:lightbulb', angle: 0,
    valueText: null, valueFullText: null,
    valueBadge: {
      configured: true,
      position: 'left', availability: 'available', tone: 'default',
      text: '12345678901234567890 W', fullText: '12345678901234567890 W',
    },
    lqiText: '180', lqiColor: '#1DC21D', lqiBand: 'high', haDisabled: false,
    tempText: null, humText: null,
  };
  const root = renderDeviceFace(presentation, { surface: 'preview' });
  const flatten = (value) => value?.strings
    ? value.strings.join('') + value.values.map(flatten).join('')
    : Array.isArray(value) ? value.map(flatten).join('') : String(value ?? '');
  const markup = flatten(root);
  assert.match(markup, /device-shell/);
  assert.match(markup, /device-shell-frame/);
  assert.match(markup, /device-core/);
  assert.match(markup, /device-sections/);
  assert.match(markup, /band-/);
});

test('#792 shared face renders one passive HA battery icon for every state, never a floor shadow', () => {
  const flatten = (value) => value?.strings
    ? value.strings.map((part, index) => part + flatten(value.values[index])).join('')
    : Array.isArray(value) ? value.map(flatten).join('')
      : typeof value === 'symbol' ? '' : String(value ?? '');
  const presentation = {
    ...face('#ff9800'), icon: 'mdi:thermometer', valueBadge: null,
    valueText: null, lqiText: null, tempText: null, humText: null,
    battery: { state: 'warning', sourceEntityId: 'sensor.own_battery' },
  };
  for (const [state, icon] of Object.entries({
    normal: 'mdi:battery', warning: 'mdi:battery-30',
    low: 'mdi:battery-outline', unknown: 'mdi:battery-unknown',
  })) {
    for (const surface of ['interactive-plan', 'preview', 'static-card']) {
      const markup = flatten(renderDeviceFace({ ...presentation,
        battery: { ...presentation.battery, state },
      }, { surface }));
      assert.equal((markup.match(/class="device-battery"/g) || []).length, 1);
      assert.equal((markup.match(/<ha-icon class="device-battery-icon"/g) || []).length, 1);
      assert.match(markup, new RegExp(`class="device-battery-icon"\\s+icon=${icon}>`),
        `${state} binds exactly ${icon} to the battery icon`);
      assert.match(markup, new RegExp(`data-state=${state} aria-hidden="true"`));
      assert.doesNotMatch(markup, /sensor\.own_battery|tabindex|@click|@pointer|<path|<image|<svg|\.svg|%/);
    }
  }
  assert.doesNotMatch(flatten(renderDeviceFace({ ...presentation, battery: null }, { surface: 'preview' })), /device-battery/);
  assert.doesNotMatch(flatten(renderDeviceShadowFace(presentation)), /device-battery/);
});
