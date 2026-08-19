// Issues #179/#211: package shell/state/motion/a11y contract in the shared renderer.
import { readFileSync } from 'node:fs';
import { mdiLightbulbSpot } from '@mdi/js';
import { launch, checkAll, finish } from './serve.mjs';

const referenceSvg = (theme, name) => readFileSync(
  new URL(`./srv/reference/device-icons/${theme}/${name}`, import.meta.url),
  'utf8',
);
const tagAttribute = (tag, name) => tag.match(new RegExp(`${name}="([^"]+)"`))?.[1] || '';
const coreTag = (svg) => svg.match(/<rect[^>]*width="80"[^>]*height="80"[^>]*rx="40"[^>]*>/)?.[0] || '';
const shellTag = (svg) => svg.match(/<(?:path|rect)[^>]*stroke="[^"]+"[^>]*stroke-width="[^"]+"[^>]*>/)?.[0] || '';
const glyphTag = (svg) => [...svg.matchAll(/<path[^>]*fill="[^"]+"[^>]*>/g)].at(0)?.[0] || '';
const canonicalHex = (value) => ({ white: '#FFFFFF', black: '#000000' }[value.toLowerCase()] || value.toUpperCase());
const browserColor = (value, opacity = null) => {
  const hex = canonicalHex(value).replace('#', '');
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
  return opacity == null
    ? `rgb(${channels.join(', ')})`
    : `rgba(${channels.join(', ')}, ${Number(opacity)})`;
};
const svgState = (theme, name) => {
  const svg = referenceSvg(theme, name);
  const core = coreTag(svg);
  const shell = shellTag(svg);
  const glyph = glyphTag(svg);
  return {
    core: browserColor(tagAttribute(core, 'fill')),
    glyph: browserColor(tagAttribute(glyph, 'fill')),
    shell: browserColor(
      tagAttribute(shell, 'stroke'),
      tagAttribute(shell, 'stroke-opacity') || null,
    ),
    shellWidth: Number(tagAttribute(shell, 'stroke-width')) / 80,
  };
};
const reference = {
  light: {
    default: svgState('Light', 'Icon Default.svg'),
    hover: svgState('Light', 'Icon Hover.svg'),
    active: svgState('Light', 'Icon Active.svg'),
    lock: svgState('Light', 'Lock.svg'),
    unlock: svgState('Light', 'Unlock.svg'),
    unavailable: svgState('Light', 'Unavailable.svg'),
    alert: svgState('Light', 'Alert Value.svg'),
  },
  dark: {
    default: svgState('Dark', 'Icon Default.svg'),
    hover: svgState('Dark', 'Icon Hover.svg'),
    active: svgState('Dark', 'Icon Active.svg'),
    lock: svgState('Dark', 'Lock.svg'),
    unlock: svgState('Dark', 'Unlock.svg'),
    unavailable: svgState('Dark', 'Unavailable.svg'),
    alert: svgState('Dark', 'Alert Value.svg'),
  },
};
// Owner decision in #179 overrides the stale green Dark/Unlock asset.
reference.dark.unlock = {
  ...reference.dark.unlock,
  core: reference.light.unlock.core,
  glyph: reference.dark.active.glyph,
  shell: reference.light.unlock.shell,
};

const { page, browser } = await launch(
  { width: 1120, height: 900 }, 1, [], { colorScheme: 'dark' },
);

await page.evaluate((path) => { window.__ICONS['mdi:lightbulb-spot'] = path; }, mdiLightbulbSpot);

await page.evaluate(async () => {
  const c = window.__card;
  const marker = (id, patch) => ({
    ...(c._serverCfg.markers || []).find((item) => item.id === id),
    id, binding: `device:${id}`, ...patch,
  });
  const replacements = new Map([
    ['d_light1', marker('d_light1', { display: 'badge', icon: 'mdi:lightbulb-spot' })],
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
  opacity: getComputedStyle(node).opacity,
}));
await page.hover(selector('d_kettle'));
// The production core/shell hover transition is 150 ms. Sampling in the same
// frame only proves the starting color and lets a restored unavailable hover
// escape the mutation guard.
await page.waitForTimeout(220);
const afterUnavailable = await page.$eval(selector('d_kettle'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  shell: getComputedStyle(node.querySelector('.device-shell')).borderColor,
  opacity: getComputedStyle(node).opacity,
}));

await page.hover(selector('d_tv'));
await page.waitForTimeout(220);
const ordinaryHover = await page.$eval(selector('d_tv'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  glyph: getComputedStyle(node.querySelector('.device-core')).color,
  shell: getComputedStyle(node.querySelector('.device-shell')).borderColor,
}));
await page.$eval(selector('d_tv'), (node) => {
  node.querySelector('.device-core').style.transition = 'none';
  node.querySelector('.device-shell').style.transition = 'none';
  node.classList.remove('theme-dark');
  node.classList.add('theme-light');
});
const lightHover = await page.$eval(selector('d_tv'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  glyph: getComputedStyle(node.querySelector('.device-core')).color,
  shell: getComputedStyle(node.querySelector('.device-shell')).borderColor,
}));
await page.$eval(selector('d_tv'), (node) => {
  node.classList.remove('theme-light');
  node.classList.add('theme-dark');
});
await page.mouse.move(1, 1);
await page.waitForTimeout(220);

const result = await page.evaluate(async ({ beforeUnavailable, afterUnavailable, ordinaryHover, lightHover, reference }) => {
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
  lightCore.style.transition = 'none';
  lightShell.style.transition = 'none';
  text.querySelector('.device-core').style.transition = 'none';
  text.querySelector('.device-shell').style.transition = 'none';
  const coreStyle = getComputedStyle(lightCore);
  const activeShellStyle = getComputedStyle(lightShell);
  const valueRadius = parseFloat(getComputedStyle(double?.querySelector('.value-badge')).borderTopLeftRadius);
  const coreRadiusText = coreStyle.borderTopLeftRadius;
  const radiusIsHalf = (value, rectangle) => value.endsWith('%')
    ? Math.abs(parseFloat(value) - 50) <= 0.01
    : Math.abs(parseFloat(value) - rectangle.width / 2) <= 0.5;

  const lockNode = node('d_lock');
  lockNode.querySelector('.device-core').style.transition = 'none';
  lockNode.querySelector('.device-shell').style.transition = 'none';
  const darkThemeClassProjected = lockNode.classList.contains('theme-dark');
  const darkThemeCore = getComputedStyle(lockNode.querySelector('.device-core')).backgroundColor;
  const darkLockGlyph = getComputedStyle(lockNode.querySelector('.device-core')).color;
  const darkLockShell = getComputedStyle(lockNode.querySelector('.device-shell')).borderColor;
  const originalLockClasses = lockNode.className;
  const originalLockStyle = lockNode.getAttribute('style') || '';
  lockNode.style.setProperty('--icon-size', '56px');
  lockNode.style.setProperty('--dev-scale', '1');
  const stateClasses = [
    'theme-light', 'theme-dark', 'on', 'open', 'alarm', 'unavail', 'virtual',
    'sel', 'lock-locked', 'lock-unlocked',
  ];
  const sampleState = (theme, classes = []) => {
    lockNode.classList.remove(...stateClasses);
    lockNode.classList.add(`theme-${theme}`, ...classes);
    const core = getComputedStyle(lockNode.querySelector('.device-core'));
    const shell = getComputedStyle(lockNode.querySelector('.device-shell'));
    return {
      core: core.backgroundColor,
      glyph: core.color,
      shell: shell.borderColor,
      shellWidth: parseFloat(shell.borderTopWidth),
      shellStyle: shell.borderStyle,
      opacity: getComputedStyle(lockNode).opacity,
    };
  };
  const stateMatrix = Object.fromEntries(['light', 'dark'].map((theme) => [theme, {
    default: sampleState(theme),
    active: sampleState(theme, ['on']),
    lock: sampleState(theme, ['lock-locked']),
    unlock: sampleState(theme, ['lock-unlocked']),
    alert: sampleState(theme, ['alarm']),
    virtual: sampleState(theme, ['virtual']),
    unavailable: sampleState(theme, ['unavail']),
  }]));
  lockNode.className = originalLockClasses;
  lockNode.setAttribute('style', originalLockStyle);

  const originalLightStyle = light.getAttribute('style') || '';
  const originalDoubleStyle = double.getAttribute('style') || '';
  const sizeMatrix = [32, 56, 96].map((size) => {
    light.style.setProperty('--icon-size', `${size}px`);
    light.style.setProperty('--dev-scale', '1');
    double.style.setProperty('--icon-size', `${size}px`);
    double.style.setProperty('--dev-scale', '1');
    const sizedCore = rect(light.querySelector('.device-core'));
    const sizedShell = rect(light.querySelector('.device-shell'));
    const sizedIcon = rect(light.querySelector('ha-icon'));
    const sizedValue = rect(double.querySelector('.value-badge'));
    const iconSvg = light.querySelector('ha-icon')?.shadowRoot?.querySelector('svg');
    const pathBox = iconSvg?.querySelector('path')?.getBBox();
    return {
      requested: size,
      core: sizedCore?.width || 0,
      shell: sizedShell?.width || 0,
      coreRadius: getComputedStyle(light.querySelector('.device-core')).borderTopLeftRadius,
      valueHeight: sizedValue?.height || 0,
      valueRadius: parseFloat(getComputedStyle(double.querySelector('.value-badge')).borderTopLeftRadius),
      iconViewport: sizedIcon?.width || 0,
      paintedWidth: pathBox && sizedIcon ? pathBox.width / 24 * sizedIcon.width : 0,
      paintedHeight: pathBox && sizedIcon ? pathBox.height / 24 * sizedIcon.height : 0,
    };
  });
  light.setAttribute('style', originalLightStyle);
  double.setAttribute('style', originalDoubleStyle);

  light.classList.remove('theme-dark');
  light.classList.add('theme-light');
  const lightActiveGlyph = getComputedStyle(lightCore).color;
  const lightActiveShell = getComputedStyle(lightShell).borderColor;
  light.classList.remove('theme-light');
  light.classList.add('theme-dark');

  const defaultShell = getComputedStyle(text.querySelector('.device-shell')).borderColor;
  text.classList.remove('theme-dark');
  text.classList.add('theme-light');
  const lightThemeCore = getComputedStyle(text.querySelector('.device-core')).backgroundColor;
  text.classList.remove('theme-light');
  text.classList.add('theme-dark');
  text.classList.add('sel');
  const selectedShell = getComputedStyle(text.querySelector('.device-shell')).borderColor;
  const selectedCoreDecoration = getComputedStyle(text.querySelector('.device-core')).boxShadow;
  text.classList.remove('sel');
  text.focus();
  const focusVisibleMatched = text.matches(':focus-visible');
  const focusShell = getComputedStyle(text.querySelector('.device-shell')).borderColor;
  const focusCoreDecoration = getComputedStyle(text.querySelector('.device-core')).boxShadow;
  text.blur();

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
    __debug: {
      shellWidth: shellRect?.width,
      coreWidth: coreRect?.width,
      shellCoreRatio: shellRect && coreRect ? shellRect.width / coreRect.width : null,
      coreRadiusText,
      valueHeight: doubleValueRect?.height,
      valueRadius,
      lightActiveGlyph,
      lightActiveShell,
      lightThemeCore,
      focusVisibleMatched,
      focusShell,
      defaultShell,
      focusCoreDecoration,
      stateMatrix,
      sizeMatrix,
      reference,
      lightHover,
      ordinaryHover,
    },
    referenceAssetsLoaded: Object.values(reference).every((theme) => Object.values(theme)
      .every((state) => state.core.startsWith('rgb')
        && state.glyph.startsWith('rgb') && state.shell.startsWith('rgb'))),
    geometryMatchesAt32_56_96: sizeMatrix.every((sample) =>
      Math.abs(sample.core - sample.requested) <= 0.5
      && Math.abs(sample.shell / sample.core - 1.26875) < 0.03
      && sample.coreRadius === '50%'
      && Math.abs(sample.valueHeight / sample.core - 0.7875) < 0.015
      && Math.abs(sample.valueRadius - sample.valueHeight / 2) <= 0.5
      && Math.abs(sample.iconViewport / sample.core - 0.5) < 0.01
      && Math.abs(sample.paintedWidth / sample.core - 0.416667) < 0.015
      && Math.abs(sample.paintedHeight / sample.core - 0.416667) < 0.015),
    referenceStateMatrixMatches: ['light', 'dark'].every((theme) =>
      ['default', 'active', 'lock', 'unlock', 'alert'].every((state) =>
        stateMatrix[theme][state].core === reference[theme][state].core
        && stateMatrix[theme][state].glyph === reference[theme][state].glyph
        && stateMatrix[theme][state].shell === reference[theme][state].shell
        && Math.abs(stateMatrix[theme][state].shellWidth
          - Math.max(1, reference[theme][state].shellWidth * 56)) <= 0.5)),
    referenceHoverMatches: lightHover.core === reference.light.hover.core
      && lightHover.glyph === reference.light.hover.glyph
      && lightHover.shell === reference.light.default.shell
      && ordinaryHover.core === reference.dark.hover.core
      && ordinaryHover.glyph === reference.dark.hover.glyph
      && ordinaryHover.shell === reference.dark.default.shell,
    virtualUsesThemeDefaultWithDashedShell: ['light', 'dark'].every((theme) =>
      stateMatrix[theme].virtual.core === reference[theme].default.core
      && stateMatrix[theme].virtual.glyph === reference[theme].default.glyph
      && stateMatrix[theme].virtual.shell === reference[theme].default.shell
      && stateMatrix[theme].virtual.shellStyle === 'dashed'),
    sharedShellGeometry: !!shellRect && !!coreRect
      && Math.abs(shellRect.width / coreRect.width - 1.26875) < 0.03,
    iconCoreIsCircle: !!coreRect && radiusIsHalf(coreRadiusText, coreRect),
    valueBadgeIsPill: !!doubleValueRect
      && Math.abs(valueRadius - doubleValueRect.height / 2) <= 0.5,
    packageShadowColor: getComputedStyle(lightShell).boxShadow.includes('37, 40, 45'),
    noBackdropBlur: getComputedStyle(lightShell).backdropFilter === 'none',
    activeUsesPackageAmber: getComputedStyle(lightCore).backgroundColor === 'rgb(240, 160, 12)'
      && activeShellStyle.borderColor === 'rgb(240, 160, 12)'
      && getComputedStyle(lightCore).color === 'rgb(37, 37, 37)',
    lightActiveUsesWhiteGlyphAndAmberShell: lightActiveGlyph === 'rgb(255, 255, 255)'
      && lightActiveShell === 'rgb(240, 160, 12)',
    darkDefaultShellUsesPackageStroke: defaultShell === 'rgba(37, 37, 37, 0.75)',
    darkHoverChangesCoreOnly: ordinaryHover.core === 'rgb(12, 130, 240)'
      && ordinaryHover.glyph === 'rgb(37, 37, 37)'
      && ordinaryHover.shell === 'rgba(37, 37, 37, 0.75)',
    selectionDecoratesCoreNotShell: selectedShell === defaultShell
      && selectedCoreDecoration.includes('240, 160, 12'),
    focusDecoratesCoreNotShell: focusVisibleMatched && focusShell === defaultShell
      && focusCoreDecoration.includes('12, 130, 240'),
    lightThemeCoreIsWhite: lightThemeCore === 'rgb(255, 255, 255)',
    darkThemeCoreIs252525: darkThemeClassProjected && darkThemeCore === 'rgb(37, 37, 37)',
    darkLockUsesWhiteGlyphAndDarkShell: darkLockGlyph === 'rgb(255, 255, 255)'
      && darkLockShell === 'rgb(37, 37, 37)',
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
      && beforeUnavailable.opacity === '0.35' && !unavailable.querySelector('.device-pulse'),
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
}, { beforeUnavailable, afterUnavailable, ordinaryHover, lightHover, reference });

const { __debug, ...out } = result;
if (Object.values(out).some((value) => value !== true)) {
  console.error(`device icon debug: ${JSON.stringify(__debug, null, 2)}`);
}
checkAll(out);
await finish(browser, out);
