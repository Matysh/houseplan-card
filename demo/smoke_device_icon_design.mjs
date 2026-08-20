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
      tap_action: 'more-info',
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
  shell: getComputedStyle(node.querySelector('.device-shell-frame')).borderColor,
  opacity: getComputedStyle(node).opacity,
}));
await page.hover(selector('d_kettle'));
// The production core/shell hover transition is 150 ms. Sampling in the same
// frame only proves the starting color and lets a restored unavailable hover
// escape the mutation guard.
await page.waitForTimeout(220);
const afterUnavailable = await page.$eval(selector('d_kettle'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  shell: getComputedStyle(node.querySelector('.device-shell-frame')).borderColor,
  opacity: getComputedStyle(node).opacity,
}));

await page.hover(selector('d_tv'));
await page.waitForTimeout(220);
const ordinaryHover = await page.$eval(selector('d_tv'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  glyph: getComputedStyle(node.querySelector('.device-core')).color,
  shell: getComputedStyle(node.querySelector('.device-shell-frame')).borderColor,
}));
await page.$eval(selector('d_tv'), (node) => {
  node.querySelector('.device-core').style.transition = 'none';
  node.querySelector('.device-shell-frame').style.transition = 'none';
  node.classList.remove('theme-dark');
  node.classList.add('theme-light');
});
const lightHover = await page.$eval(selector('d_tv'), (node) => ({
  core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
  glyph: getComputedStyle(node.querySelector('.device-core')).color,
  shell: getComputedStyle(node.querySelector('.device-shell-frame')).borderColor,
}));
await page.evaluate(() => {
  const c = window.__card;
  window.__capsuleActionCount = 0;
  window.__capsuleOriginalMoreInfo = c._openMoreInfo;
  c._openMoreInfo = () => { window.__capsuleActionCount++; };
});
const capsulePositions = [];
for (const [index, position] of ['right', 'bottom', 'left', 'top'].entries()) {
  await page.mouse.move(1, 1);
  await page.$eval(selector('d_temp'), (node, nextPosition) => {
    const shell = node.querySelector('.device-shell');
    const badge = node.querySelector('.value-badge');
    for (const name of ['right', 'bottom', 'left', 'top']) {
      shell.classList.remove(`pos-${name}`);
      badge.classList.remove(`pos-${name}`);
    }
    shell.classList.add(`pos-${nextPosition}`);
    badge.classList.add(`pos-${nextPosition}`);
  }, position);
  const valuePoint = await page.$eval(selector('d_temp'), (node, nextPosition) => {
    const value = node.querySelector('.value-badge').getBoundingClientRect();
    const center = { x: value.left + value.width / 2, y: value.top + value.height / 2 };
    if (nextPosition === 'right') center.x = value.right - 1;
    if (nextPosition === 'left') center.x = value.left + 1;
    if (nextPosition === 'bottom') center.y = value.bottom - 1;
    if (nextPosition === 'top') center.y = value.top + 1;
    return center;
  }, position);
  await page.mouse.move(valuePoint.x, valuePoint.y);
  await page.waitForTimeout(220);
  const hover = await page.$eval(selector('d_temp'), (node, point) => {
    return {
      core: getComputedStyle(node.querySelector('.device-core')).backgroundColor,
      hovered: node.matches(':hover'),
      target: node.getRootNode().elementFromPoint(point.x, point.y)?.className || '',
    };
  }, valuePoint);
  await page.mouse.click(valuePoint.x, valuePoint.y);
  const actionCount = await page.evaluate(() => window.__capsuleActionCount);
  capsulePositions.push({ position, hover, actionAccepted: actionCount === index + 1 });
}
const capsuleCorePoint = await page.$eval(selector('d_temp'), (node) => {
  const core = node.querySelector('.device-core').getBoundingClientRect();
  return { x: core.left + core.width / 2, y: core.top + core.height / 2 };
});
await page.mouse.click(capsuleCorePoint.x, capsuleCorePoint.y);
const capsuleActions = await page.evaluate(() => {
  const c = window.__card;
  const count = window.__capsuleActionCount;
  c._openMoreInfo = window.__capsuleOriginalMoreInfo;
  delete window.__capsuleOriginalMoreInfo;
  delete window.__capsuleActionCount;
  return count;
});
await page.$eval(selector('d_tv'), (node) => {
  node.classList.remove('theme-light');
  node.classList.add('theme-dark');
});
await page.mouse.move(1, 1);
await page.waitForTimeout(220);

const result = await page.evaluate(async ({ beforeUnavailable, afterUnavailable, ordinaryHover, lightHover, capsulePositions, capsuleActions, reference }) => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const node = (id) => sr().querySelector(`.dev[data-id="${id}"]`);
  const rect = (element) => element?.getBoundingClientRect();
  const light = node('d_light1');
  const lightShell = light?.querySelector('.device-shell');
  const lightFrame = light?.querySelector('.device-shell-frame');
  const lightCore = light?.querySelector('.device-core');
  const shellRect = rect(lightFrame);
  const coreRect = rect(lightCore);
  const presence = node('d_motion');
  const unavailable = node('d_kettle');
  const text = node('d_tv');
  const lqiSamples = ['d_temp', 'd_motion', 'd_window', 'd_lamp'].map((id) => {
    const marker = node(id);
    const label = marker?.querySelector('.lqi');
    const value = Number(label?.textContent?.trim());
    if (!label || !Number.isFinite(value)) return null;
    const hue = Math.max(0, Math.min(120, Math.round(((value - 40) / 140) * 120)));
    const probe = document.createElement('span');
    probe.style.color = `hsl(${hue}, 85%, 55%)`;
    sr().append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return { value, actual: getComputedStyle(label).color, expected };
  }).filter(Boolean);
  const textFrame = text?.querySelector('.device-shell-frame');
  const textCore = text?.querySelector('.device-core');
  const textFrameRect = rect(textFrame);
  const textCoreRect = rect(textCore);
  const textFrameRadius = getComputedStyle(textFrame).borderTopLeftRadius;
  const textCoreRadius = parseFloat(
    getComputedStyle(textCore).borderTopLeftRadius,
  );
  const originalTextFrameInlineRadius = textFrame.style.borderRadius;
  textFrame.style.borderRadius = '50%';
  const mutantTextFrameRadius = getComputedStyle(textFrame).borderTopLeftRadius;
  textFrame.style.borderRadius = originalTextFrameInlineRadius;
  const double = node('d_temp');
  const doubleShellRect = rect(double?.querySelector('.device-shell-frame'));
  const doubleCoreRect = rect(double?.querySelector('.device-core'));
  const doubleValueRect = rect(double?.querySelector('.value-badge'));
  const pseudo = getComputedStyle(light, '::before');
  lightCore.style.transition = 'none';
  lightFrame.style.transition = 'none';
  text.querySelector('.device-core').style.transition = 'none';
  text.querySelector('.device-shell-frame').style.transition = 'none';
  const coreStyle = getComputedStyle(lightCore);
  const activeShellStyle = getComputedStyle(lightFrame);
  const valueRadius = parseFloat(getComputedStyle(double?.querySelector('.value-badge')).borderTopLeftRadius);
  const coreRadiusText = coreStyle.borderTopLeftRadius;
  const radiusIsHalf = (value, rectangle) => value.endsWith('%')
    ? Math.abs(parseFloat(value) - 50) <= 0.01
    : Math.abs(parseFloat(value) - rectangle.width / 2) <= 0.5;

  const lockNode = node('d_lock');
  lockNode.querySelector('.device-core').style.transition = 'none';
  lockNode.querySelector('.device-shell-frame').style.transition = 'none';
  const darkThemeClassProjected = lockNode.classList.contains('theme-dark');
  const darkThemeCore = getComputedStyle(lockNode.querySelector('.device-core')).backgroundColor;
  const darkLockGlyph = getComputedStyle(lockNode.querySelector('.device-core')).color;
  const darkLockShell = getComputedStyle(lockNode.querySelector('.device-shell-frame')).borderColor;
  const originalLockClasses = lockNode.className;
  const originalLockStyle = lockNode.getAttribute('style') || '';
  lockNode.style.setProperty('--device-base-size', '50.4px');
  lockNode.style.setProperty('--dev-scale', '1');
  const stateClasses = [
    'theme-light', 'theme-dark', 'on', 'open', 'alarm', 'unavail', 'virtual',
    'sel', 'lock-locked', 'lock-unlocked',
  ];
  const sampleState = (theme, classes = []) => {
    lockNode.classList.remove(...stateClasses);
    lockNode.classList.add(`theme-${theme}`, ...classes);
    const core = getComputedStyle(lockNode.querySelector('.device-core'));
    const shell = getComputedStyle(lockNode.querySelector('.device-shell-frame'));
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
  const originalTextStyle = text.getAttribute('style') || '';
  const sizeMatrix = [
    { configured: 32, effective: 28.8 },
    { configured: 56, effective: 50.4 },
    { configured: 96, effective: 86.4 },
  ].map(({ configured, effective }) => {
    light.style.setProperty('--device-base-size', `${effective}px`);
    light.style.setProperty('--dev-scale', '1');
    double.style.setProperty('--device-base-size', `${effective}px`);
    double.style.setProperty('--dev-scale', '1');
    const sizedCore = rect(light.querySelector('.device-core'));
    const sizedShell = rect(light.querySelector('.device-shell-frame'));
    const sizedIcon = rect(light.querySelector('ha-icon'));
    const sizedValue = rect(double.querySelector('.value-badge'));
    const iconSvg = light.querySelector('ha-icon')?.shadowRoot?.querySelector('svg');
    const pathBox = iconSvg?.querySelector('path')?.getBBox();
    return {
      configured,
      effective,
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

  const textShellSizeMatrix = [24, 32, 56, 96, 112].map((effective) => {
    text.style.setProperty('--device-base-size', `${effective}px`);
    text.style.setProperty('--dev-scale', '1');
    const frameRect = rect(textFrame);
    const coreRect = rect(textCore);
    const frameStyle = getComputedStyle(textFrame);
    const coreStyle = getComputedStyle(textCore);
    return {
      effective,
      frameWidth: frameRect?.width || 0,
      frameHeight: frameRect?.height || 0,
      coreWidth: coreRect?.width || 0,
      coreHeight: coreRect?.height || 0,
      frameRadius: frameStyle.borderTopLeftRadius,
      coreRadius: parseFloat(coreStyle.borderTopLeftRadius),
      horizontalInset: frameRect && coreRect ? (frameRect.width - coreRect.width) / 2 : 0,
      verticalInset: frameRect && coreRect ? (frameRect.height - coreRect.height) / 2 : 0,
    };
  });
  text.setAttribute('style', originalTextStyle);

  light.classList.remove('theme-dark');
  light.classList.add('theme-light');
  const lightActiveGlyph = getComputedStyle(lightCore).color;
  const lightActiveShell = getComputedStyle(lightFrame).borderColor;
  light.classList.remove('theme-light');
  light.classList.add('theme-dark');

  const defaultShell = getComputedStyle(text.querySelector('.device-shell-frame')).borderColor;
  text.classList.remove('theme-dark');
  text.classList.add('theme-light');
  const lightThemeCore = getComputedStyle(text.querySelector('.device-core')).backgroundColor;
  text.classList.remove('theme-light');
  text.classList.add('theme-dark');
  text.classList.add('sel');
  const selectedShell = getComputedStyle(text.querySelector('.device-shell-frame')).borderColor;
  const selectedCoreDecoration = getComputedStyle(text.querySelector('.device-core')).boxShadow;
  text.classList.remove('sel');
  text.focus({ focusVisible: true });
  const focusVisibleMatched = text.matches(':focus-visible');
  const focusShell = getComputedStyle(text.querySelector('.device-shell-frame')).borderColor;
  const focusCoreDecoration = getComputedStyle(text.querySelector('.device-core')).boxShadow;
  text.blur();

  const originalCallService = c.hass.callService;
  let actionDispatches = 0;
  c.hass.callService = async () => { actionDispatches++; };
  light.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await Promise.resolve();
  const pressAnimation = lightShell.getAnimations().find((animation) =>
    animation.effect?.getTiming().duration === 200);
  const pressFrames = pressAnimation?.effect?.getKeyframes?.() || [];
  const acceptedActionFeedback = actionDispatches === 1
    && pressAnimation?.effect?.getTiming().duration === 200
    && pressFrames.some((frame) => frame.scale === '0.95');
  await new Promise((resolve) => setTimeout(resolve, 240));
  const feedbackLifecycleBounded = !lightShell.getAnimations().some((animation) =>
    animation.effect?.getTiming().duration === 200);
  c._reducedMotion = true;
  light.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await Promise.resolve();
  const reducedAnimation = lightShell.getAnimations().find((animation) =>
    animation.effect?.getTiming().duration === 200);
  const reducedFrames = reducedAnimation?.effect?.getKeyframes?.() || [];
  const reducedMotionUsesNoScale = !!reducedAnimation
    && reducedFrames.every((frame) => frame.scale == null)
    && reducedFrames.some((frame) => frame.outlineWidth === '2px');
  c._cancelDevicePressFeedback();
  c._reducedMotion = false;
  const enterAction = new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, composed: true, cancelable: true,
  });
  light.dispatchEvent(enterAction);
  await Promise.resolve();
  const keyboardAnimation = lightShell.getAnimations().find((animation) =>
    animation.effect?.getTiming().duration === 200);
  const keyboardActionFeedback = enterAction.defaultPrevented && actionDispatches === 3
    && keyboardAnimation?.effect?.getKeyframes?.().some((frame) => frame.scale === '0.95');
  c._cancelDevicePressFeedback();
  c.hass.callService = originalCallService;

  let moreInfo = 0;
  c._openMoreInfo = () => { moreInfo++; };
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  unavailable.dispatchEvent(enter);
  const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  unavailable.dispatchEvent(space);
  const informationalActionHasNoFeedback = unavailable.querySelector('.device-shell')
    .getAnimations().every((animation) => animation.effect?.getTiming().duration !== 200);

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
      lightClasses: light.className,
      lightShellVariable: getComputedStyle(light).getPropertyValue('--device-shell-stroke'),
      lightThemeCore,
      focusVisibleMatched,
      focusShell,
      defaultShell,
      focusCoreDecoration,
      stateMatrix,
      sizeMatrix,
      textShellSizeMatrix,
      textFrameRadius,
      mutantTextFrameRadius,
      reference,
      lightHover,
      ordinaryHover,
      capsulePositions,
      capsuleActions,
      lqiSamples,
    },
    referenceAssetsLoaded: Object.values(reference).every((theme) => Object.values(theme)
      .every((state) => state.core.startsWith('rgb')
        && state.glyph.startsWith('rgb') && state.shell.startsWith('rgb'))),
    geometryMatchesAt32_56_96: sizeMatrix.every((sample) =>
      Math.abs(sample.core - sample.effective) <= 0.5
      && Math.abs(sample.shell / sample.core - 1.26875) < 0.03
      && sample.coreRadius === '50%'
      && Math.abs(sample.valueHeight / sample.core - 0.7875) < 0.015
      && Math.abs(sample.valueRadius - sample.valueHeight / 2) <= 0.5
      && Math.abs(sample.iconViewport / sample.core - 0.55) < 0.01
      && Math.abs(sample.paintedWidth / sample.core - 0.458333) < 0.015
      && Math.abs(sample.paintedHeight / sample.core - 0.458333) < 0.015),
    referenceStateMatrixMatches: ['light', 'dark'].every((theme) =>
      ['default', 'active', 'lock', 'unlock', 'alert'].every((state) =>
        stateMatrix[theme][state].core === reference[theme][state].core
        && stateMatrix[theme][state].glyph === reference[theme][state].glyph
        && stateMatrix[theme][state].shell === reference[theme][state].shell
        && Math.abs(stateMatrix[theme][state].shellWidth
          - Math.max(1, Math.floor(reference[theme][state].shellWidth * 50.4))) <= 0.5)),
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
    iconShellIsCircle: !!shellRect && Math.abs(shellRect.width - shellRect.height) <= 0.5
      && activeShellStyle.borderTopLeftRadius === '50%',
    textCoreIsStadium: !!textCoreRect && textCoreRect.width > textCoreRect.height
      && Math.abs(textCoreRadius - textCoreRect.height / 2) <= 0.5,
    textShellIsStadiumAtRepresentativeSizes: !!textFrameRect
      && textFrameRect.width > textFrameRect.height
      && textFrameRadius === '9999px'
      && textShellSizeMatrix.every((sample) => sample.frameWidth > sample.frameHeight
        && sample.coreWidth > sample.coreHeight
        && sample.frameRadius === '9999px'
        && Number.parseFloat(sample.frameRadius) >= sample.frameHeight / 2
        && Math.abs(sample.coreRadius - sample.coreHeight / 2) <= 0.5
        && Math.abs(sample.horizontalInset - sample.verticalInset) <= 0.5),
    textShellMutationGuardRejects50Percent: textFrameRadius === '9999px'
      && mutantTextFrameRadius === '50%',
    valueBadgeIsPill: !!doubleValueRect
      && Math.abs(valueRadius - doubleValueRect.height / 2) <= 0.5,
    doubleShellKeepsCapsule: !!doubleShellRect
      && doubleShellRect.width > doubleShellRect.height
      && getComputedStyle(double.querySelector('.device-shell-frame')).borderTopLeftRadius === '9999px',
    packageShadowColor: getComputedStyle(lightFrame).boxShadow.includes('37, 40, 45'),
    noBackdropBlur: getComputedStyle(lightFrame).backdropFilter === 'none',
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
    acceptedActionFeedback,
    feedbackLifecycleBounded,
    reducedMotionUsesNoScale,
    keyboardActionFeedback,
    informationalActionHasNoFeedback,
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
    lqiUsesContinuousComputedColor: lqiSamples.length >= 3
      && lqiSamples.every((sample) => sample.actual === sample.expected)
      && lqiSamples.some((sample) => sample.value > 41 && sample.value < 179
        && sample.actual !== 'rgb(240, 160, 12)'),
    unavailableHasNoHoverOrMotion: JSON.stringify(beforeUnavailable) === JSON.stringify(afterUnavailable)
      && beforeUnavailable.opacity === '0.35' && !unavailable.querySelector('.device-pulse'),
    valueCapsuleOwnsHoverAndActionAtEveryPosition: capsulePositions.length === 4
      && capsulePositions.every(({ hover, actionAccepted }) => hover.hovered
        && hover.core === 'rgb(12, 130, 240)'
        && String(hover.target).includes('device-shell-frame')
        && actionAccepted)
      && capsuleActions === 5,
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
}, { beforeUnavailable, afterUnavailable, ordinaryHover, lightHover, capsulePositions, capsuleActions, reference });

const { __debug, ...out } = result;
if (Object.values(out).some((value) => value !== true)) {
  console.error(`device icon debug: ${JSON.stringify(__debug, null, 2)}`);
}
checkAll(out);
await finish(browser, out);
