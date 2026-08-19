// Issue #179: package shell/state/motion/a11y contract in the real shared renderer.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch(
  { width: 1120, height: 900 }, 1, [], { colorScheme: 'dark' },
);

await page.evaluate(async () => {
  const c = window.__card;
  const marker = (id, patch) => ({
    ...(c._serverCfg.markers || []).find((item) => item.id === id),
    id, binding: `device:${id}`, ...patch,
  });
  const replacements = new Map([
    ['d_light1', marker('d_light1', { display: 'badge' })],
    ['d_motion', marker('d_motion', { display: 'icon_ripple' })],
    ['d_tv', marker('d_tv', { display: 'value' })],
    ['d_temp', marker('d_temp', {
      display: 'badge',
      value_badge: {
        enabled: true,
        source: { kind: 'entity_state', entity_id: 'sensor.living_temp' },
        position: 'right',
      },
    })],
    ['d_kettle', marker('d_kettle', { display: 'icon_ripple', tap_action: 'more-info' })],
  ]);
  c._serverCfg.markers = [
    ...(c._serverCfg.markers || []).filter((item) => !replacements.has(item.id)),
    ...replacements.values(),
  ];
  c.hass = {
    ...c.hass,
    themes: { ...(c.hass.themes || {}), darkMode: true },
    states: {
      ...c.hass.states,
      'binary_sensor.hall_motion': {
        ...c.hass.states['binary_sensor.hall_motion'],
        state: 'on',
        attributes: {
          ...c.hass.states['binary_sensor.hall_motion'].attributes,
          device_class: 'presence', linkquality: 64,
        },
      },
      'media_player.tv': {
        ...c.hass.states['media_player.tv'],
        state: 'A very long localized device value without clipping',
      },
      'sensor.living_temp': {
        ...c.hass.states['sensor.living_temp'],
        state: '12345678901234567890',
        attributes: {
          ...c.hass.states['sensor.living_temp'].attributes,
          linkquality: 30,
        },
      },
      'switch.kettle': {
        ...c.hass.states['switch.kettle'],
        state: 'unavailable',
      },
    },
  };
  c._regSignature = '';
  c._cfgEpoch++;
  c._maybeRebuildDevices();
  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

await page.waitForTimeout(220);

const selector = (id) => `.dev[data-id="${id}"]`;
const beforeUnavailable = await page.$eval(selector('d_kettle'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  shell: getComputedStyle(node.querySelector('.device-shell')).borderColor,
}));
await page.hover(selector('d_kettle'));
const afterUnavailable = await page.$eval(selector('d_kettle'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  shell: getComputedStyle(node.querySelector('.device-shell')).borderColor,
}));

const out = await page.evaluate(async ({ beforeUnavailable, afterUnavailable }) => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const node = (id) => sr().querySelector(`.dev[data-id="${id}"]`);
  const rect = (element) => element?.getBoundingClientRect();
  const light = node('d_light1');
  const lightShell = light?.querySelector('.device-shell');
  const lightCore = light?.querySelector('.device-core');
  const shellRect = rect(lightShell);
  const coreRect = rect(lightCore);
  const presence = node('d_motion');
  const unavailable = node('d_kettle');
  const text = node('d_tv');
  const double = node('d_temp');
  const doubleShellRect = rect(double?.querySelector('.device-shell'));
  const doubleCoreRect = rect(double?.querySelector('.device-core'));
  const doubleValueRect = rect(double?.querySelector('.value-badge'));
  const pseudo = getComputedStyle(light, '::before');

  const lockNode = node('d_lock');
  lockNode.querySelector('.device-core').style.transition = 'none';
  const darkThemeClassProjected = lockNode.classList.contains('theme-dark');
  const darkThemeCore = getComputedStyle(lockNode.querySelector('.device-core')).backgroundColor;
  lockNode.classList.remove('theme-dark');
  lockNode.classList.add('theme-light');
  const lightThemeCore = getComputedStyle(lockNode.querySelector('.device-core')).backgroundColor;
  lockNode.classList.remove('theme-light');
  lockNode.classList.add('theme-dark');

  let moreInfo = 0;
  c._openMoreInfo = () => { moreInfo++; };
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  unavailable.dispatchEvent(enter);
  const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  unavailable.dispatchEvent(space);

  const aria = unavailable.getAttribute('aria-label') || '';
  const viewKeyboard = unavailable.getAttribute('role') === 'button'
    && unavailable.getAttribute('tabindex') === '0'
    && enter.defaultPrevented && space.defaultPrevented && moreInfo === 2;

  await c._setMode('devices');
  await c.updateComplete;
  const editorNode = node('d_light1');
  editorNode.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, cancelable: true,
  }));
  await c.updateComplete;
  const editorKeyboardOpensSettings = c._markerDialog?.devId === 'd_light1';
  c._markerDialog = null;
  await c._setMode('plan');
  await c.updateComplete;
  const planNode = node('d_light1');
  const planNotInTabOrder = !planNode?.hasAttribute('role') && !planNode?.hasAttribute('tabindex');

  return {
    sharedShellGeometry: !!shellRect && !!coreRect
      && Math.abs(shellRect.width / coreRect.width - 1.26875) < 0.03,
    packageShadowColor: getComputedStyle(lightShell).boxShadow.includes('37, 40, 45'),
    noBackdropBlur: getComputedStyle(lightShell).backdropFilter === 'none',
    activeUsesPackageAmber: getComputedStyle(lightCore).backgroundColor === 'rgb(240, 160, 12)',
    lightThemeCoreIsWhite: lightThemeCore === 'rgb(255, 255, 255)',
    darkThemeCoreIs252525: darkThemeClassProjected && darkThemeCore === 'rgb(37, 37, 37)',
    hitAreaAtLeast44: parseFloat(pseudo.width) >= 44 && parseFloat(pseudo.height) >= 44,
    presenceContinuousGreen: presence?.querySelector('.device-pulse.continuous.reason-presence')
      && getComputedStyle(presence.querySelector('.device-pulse i')).borderColor === 'rgb(29, 194, 29)'
      && getComputedStyle(presence.querySelector('.device-pulse i')).animationDuration === '3.6s',
    lockedStateProjected: node('d_lock')?.classList.contains('lock-locked')
      && node('d_lock')?.getAttribute('data-state') === 'locked',
    lqiBandsProjected: node('d_temp')?.getAttribute('data-lqi-band') === 'low'
      && node('d_window')?.getAttribute('data-lqi-band') === 'mid'
      && node('d_lamp')?.getAttribute('data-lqi-band') === 'high',
    unavailableHasNoHoverOrMotion: JSON.stringify(beforeUnavailable) === JSON.stringify(afterUnavailable)
      && !unavailable.querySelector('.device-pulse'),
    unavailableAriaIsReadable: /unavailable/i.test(aria) && /LQI|signal/i.test(aria),
    textIsComplete: text?.querySelector('.valtext')?.textContent
      === 'A very long localized device value without clipping'
      && getComputedStyle(text.querySelector('.valtext')).textOverflow !== 'ellipsis'
      && getComputedStyle(text.querySelector('.valtext')).overflow === 'visible'
      && text.getAttribute('aria-label')?.includes('A very long localized device value without clipping'),
    doubleUsesOneShell: !!doubleShellRect && !!doubleCoreRect && !!doubleValueRect
      && doubleShellRect.left <= Math.min(doubleCoreRect.left, doubleValueRect.left)
      && doubleShellRect.right >= Math.max(doubleCoreRect.right, doubleValueRect.right),
    viewKeyboard,
    editorKeyboardOpensSettings,
    planNotInTabOrder,
  };
}, { beforeUnavailable, afterUnavailable });

checkAll(out);
await finish(browser, out);
