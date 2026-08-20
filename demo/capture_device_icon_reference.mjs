#!/usr/bin/env node
// Issue #211: human-reviewable Reference SVG <-> Runtime matrix.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mdiLightbulbSpot } from '@mdi/js';
import { launch } from './serve.mjs';

const artifactDir = resolve('artifacts/device-icon-reference');
mkdirSync(artifactDir, { recursive: true });

const referenceAsset = (theme, file, coreSize) => {
  let source = readFileSync(resolve('demo/srv/reference/device-icons', theme, file), 'utf8');
  if (file === 'Lock.svg') {
    const old = theme === 'Dark' ? '#252525' : 'black';
    source = source.replaceAll(old, '#66D17A');
    if (theme === 'Dark') source = source.replaceAll('fill="white"', 'fill="#252525"');
  }
  if (file === 'Unlock.svg') {
    source = source.replaceAll(theme === 'Dark' ? '#1DC21D' : '#F0A00C', '#F0410C');
  }
  const nativeWidth = Number(source.match(/<svg[^>]*width="([\d.]+)"/)?.[1] || 127);
  return {
    url: `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`,
    displayWidth: nativeWidth * coreSize / 80,
  };
};

const { page, browser } = await launch(
  { width: 1280, height: 960 }, 1, [], { colorScheme: 'dark' },
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
    ['d_tv', marker('d_tv', { display: 'value' })],
    ['d_temp', marker('d_temp', {
      display: 'badge',
      value_badge: {
        enabled: true,
        source: { kind: 'entity_state', entity_id: 'sensor.living_temp' },
        position: 'right',
      },
    })],
  ]);
  c._serverCfg.markers = [
    ...(c._serverCfg.markers || []).filter((item) => !replacements.has(item.id)),
    ...replacements.values(),
  ];
  c.hass = {
    ...c.hass,
    states: {
      ...c.hass.states,
      'sensor.living_temp': {
        ...c.hass.states['sensor.living_temp'],
        state: '23',
        attributes: { ...c.hass.states['sensor.living_temp']?.attributes, unit_of_measurement: '%' },
      },
      'media_player.tv': {
        ...c.hass.states['media_player.tv'],
        state: 'Working',
      },
    },
  };
  c._regSignature = '';
  c._cfgEpoch++;
  c._maybeRebuildDevices();
  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  const qaStyle = document.createElement('style');
  qaStyle.textContent = '.devtip{display:none!important}';
  (c.renderRoot || c.shadowRoot).append(qaStyle);
  await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
});

const selector = (id) => `.dev[data-id="${id}"]`;

async function runtimePng(theme, row, size) {
  await page.mouse.move(1, 1);
  await page.evaluate(({ id, themeName, classes, px, clearValues }) => {
    const node = (window.__card.renderRoot || window.__card.shadowRoot)
      .querySelector(`.dev[data-id="${id}"]`);
    for (const marker of (window.__card.renderRoot || window.__card.shadowRoot).querySelectorAll('.dev'))
      marker.style.visibility = marker === node ? 'visible' : 'hidden';
    node.classList.remove(...[
      'theme-light', 'theme-dark', 'on', 'open', 'alarm', 'unavail', 'virtual',
      'sel', 'lock-locked', 'lock-unlocked',
    ]);
    node.classList.add(`theme-${themeName}`, ...classes);
    node.style.setProperty('--device-base-size', `${px}px`);
    node.style.setProperty('--dev-scale', '1');
    node.querySelector('.device-core')?.style.setProperty('transition', 'none');
    node.querySelector('.device-shell-frame')?.style.setProperty('transition', 'none');
    if (clearValues) node.querySelectorAll('.value-badge').forEach((value) => value.remove());
    node.blur();
  }, {
    id: row.id,
    themeName: theme.toLowerCase(),
    classes: row.classes || [],
    px: size,
    clearValues: row.clearValues || false,
  });
  if (row.hover) {
    await page.hover(selector(row.id));
    await page.waitForTimeout(180);
  }
  if (row.focus) {
    await page.$eval(selector(row.id), (node) => node.focus());
  }
  await page.$eval(selector(row.id), (node) => {
    for (const tooltip of (window.__card.renderRoot || window.__card.shadowRoot).querySelectorAll('.devtip'))
      tooltip.style.setProperty('display', 'none', 'important');
    node.querySelector('.lqi')?.style.setProperty('display', 'none');
  });
  const clip = await page.$eval(selector(row.id), (node) => {
    const shell = node.querySelector('.device-shell-frame').getBoundingClientRect();
    const pad = 22;
    return {
      x: Math.max(0, shell.left - pad),
      y: Math.max(0, shell.top - pad),
      width: shell.width + pad * 2,
      height: shell.height + pad * 2,
    };
  });
  return (await page.screenshot({ clip })).toString('base64');
}

const rows = [
  { label: 'Default', file: 'Icon Default.svg', id: 'd_light1' },
  { label: 'Hover', file: 'Icon Hover.svg', id: 'd_light1', hover: true },
  { label: 'Active', file: 'Icon Active.svg', id: 'd_light1', classes: ['on'] },
  { label: 'Lock', file: 'Lock.svg', id: 'd_lock', classes: ['lock-locked'] },
  { label: 'Unlock', file: 'Unlock.svg', id: 'd_lock', classes: ['lock-unlocked'] },
  { label: 'Selected', file: 'Selected.svg', id: 'd_light1', classes: ['sel'] },
  { label: 'Focus', file: 'Focus Visible.svg', id: 'd_light1', focus: true },
  { label: 'Alert', file: 'Alert Value.svg', id: 'd_temp', classes: ['alarm'] },
  { label: 'Virtual', file: 'Virtual Device Default.svg', id: 'd_motion', classes: ['virtual'] },
  { label: 'Unavailable', file: 'Unavailable.svg', id: 'd_light1', classes: ['unavail'] },
  { label: 'Text', file: 'Text Default.svg', id: 'd_tv' },
  { label: 'Double Right', file: 'Double Default Right.svg', id: 'd_temp' },
];

const matrix = [];
for (const theme of ['Light', 'Dark']) {
  for (const row of rows) {
    matrix.push({
      theme,
      row,
      size: 56,
      runtime: await runtimePng(theme, row, 56),
    });
  }
  for (const size of [32, 96]) {
    const row = rows[0];
    matrix.push({ theme, row, size, runtime: await runtimePng(theme, row, size) });
  }
  const textRow = rows.find((row) => row.label === 'Text');
  matrix.push({ theme, row: textRow, size: 96, runtime: await runtimePng(theme, textRow, 96) });
}

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const body = matrix.map(({ theme, row, size, runtime }) => {
  const reference = referenceAsset(theme, row.file, size);
  return `
  <tr>
    <td>${theme}</td><td>${escapeHtml(row.label)}</td><td>${size}px</td>
    <td class="preview"><img style="width:${reference.displayWidth}px" src="${reference.url}" alt="Reference ${escapeHtml(row.label)}"></td>
    <td class="preview runtime"><img src="data:image/png;base64,${runtime}" alt="Runtime ${escapeHtml(row.label)}"></td>
  </tr>`;
}).join('');
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Device icon reference/runtime matrix</title>
<style>
  body{margin:24px;background:#777;color:#111;font:16px system-ui,sans-serif}
  h1,p{max-width:1100px} table{border-collapse:collapse;width:100%;background:#aaa}
  th,td{border:1px solid #555;padding:8px;text-align:left} th{position:sticky;top:0;background:#ddd;z-index:2}
  .preview{width:38%;text-align:center;background:linear-gradient(135deg,#d5d5d5 50%,#666 50%)}
  .preview img{display:block;margin:auto;max-width:300px;max-height:180px}.runtime img{image-rendering:auto}
</style></head><body>
<h1>House Plan device icons: package 1.1.1 vs runtime</h1>
<p>Issues #211/#217. Reference SVG is loaded directly from the designer package; Runtime is a fresh browser capture. Default covers 32/56/96 px and Text has an additional large 96 px row so its outer stadium curvature is reviewable. Dark Unlock is evaluated using the owner's amber override from #179.</p>
<table><thead><tr><th>Theme</th><th>State/layout</th><th>Core</th><th>Reference SVG</th><th>Runtime</th></tr></thead>
<tbody>${body}</tbody></table></body></html>`;
const htmlPath = resolve(artifactDir, 'device-icons-reference-runtime.html');
writeFileSync(htmlPath, html);

await page.setViewportSize({ width: 1600, height: 1000 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({
  path: resolve(artifactDir, 'device-icons-reference-runtime.png'),
  fullPage: true,
});
await browser.close();
console.log(`OK device icon reference/runtime matrix: ${htmlPath}`);
