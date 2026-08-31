// #44: the Discovery-filters section makes group_lights and
// exclude_integrations visible, previewable and saved in one write.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 980, height: 820 });
const out = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.renderRoot || c.shadowRoot;
  // #126 seeds registry-Area provenance on the first authoritative build.
  // Start this write-count contract only after that unrelated bootstrap write.
  await c._areaRelocationWrite;
  const writes = [];
  const base = c.hass.callWS;
  let rev = 70;
  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/set') {
      writes.push(JSON.parse(JSON.stringify({
        group_lights: m.config.settings?.group_lights ?? null,
        exclude_integrations: m.config.settings?.exclude_integrations ?? null,
      })));
      rev += 1;
      return { ok: true, rev };
    }
    return base(m);
  } };
  c._cfgRev = rev;
  await new Promise((resolve) => setTimeout(resolve, 650));
  c._saveConfigDebounced?.flush?.();
  await c._writeChain;
  await c._areaRelocationWrite;
  writes.length = 0;
  const result = {};

  c._setMode('devices');
  await c.updateComplete;
  c._openDeviceInbox();
  await c.updateComplete;
  const tabs = [...root().querySelectorAll('.device-inbox-tabs [role="tab"]')];
  tabs[1]?.click(); // «Доступны»
  await c.updateComplete;
  const section = root().querySelector('.device-inbox-discovery');
  result.sectionOnAvailable = !!section;
  section?.querySelector('summary')?.click();
  await c.updateComplete;

  // AC1: тумблер группировки
  const runtime = c._editorRuntime;
  const dialog = () => c._deviceInbox;
  const toggle = root().querySelector('.device-inbox-discovery .srcrow input');
  result.toggleDefaultOn = !!toggle?.checked;
  toggle.checked = false;
  toggle.dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;

  // AC2: добавить исключение — превью-счётчик «скроется» ненулевой
  // демо: все устройства платформы 'demo' — исключение честно всё материализует
  const anyIntegration = 'demo';
  // AC3: явный маркер той же интеграции обязан пережить запись фильтров
  c._serverCfg = { ...c._serverCfg, markers: [...(c._serverCfg.markers || []), {
    id: 'explicit-44', binding: 'device:d_lamp', space: c._serverCfg.spaces[0].id,
  }] };
  c._regSignature = '';
  c._maybeRebuildDevices();
  await c._areaRelocationWrite;
  await new Promise((resolve) => setTimeout(resolve, 650));
  c._saveConfigDebounced?.flush?.();
  await c._writeChain;
  writes.length = 0;
  const beforeExcluded = runtime._discoveryFilterState(dialog()).excluded.length;
  c._deviceInbox = { ...dialog(), draftExcluded: [
    ...runtime._discoveryFilterState(dialog()).excluded, anyIntegration,
  ] };
  await c.updateComplete;
  const preview = runtime._discoveryFilterPreview(dialog());
  result.previewHides = preview.hide > 0;
  result.previewLightsCounted = preview.lights >= 0;

  // Save: одна запись, ключи в конфиге
  await runtime._saveDiscoveryFilters(dialog());
  await new Promise((r) => setTimeout(r, 100));
  c._saveConfigDebounced?.flush?.();
  await new Promise((r) => setTimeout(r, 200));
  result.oneWrite = writes.length === 1;
  result.writeCarriesBoth = writes[0]
    && writes[0].group_lights === false
    && Array.isArray(writes[0].exclude_integrations)
    && writes[0].exclude_integrations.includes(anyIntegration)
    && writes[0].exclude_integrations.length === beforeExcluded + 1;

  // AC3: явный маркер пережил запись фильтров (в т.ч. в конфиге)
  result.markersUntouched = (c._serverCfg.markers || [])
    .some((marker) => marker.id === 'explicit-44');

  // AC1-обратно: вернуть группировку и рекомендуемые → ключи удаляются
  const d2 = c._deviceInbox;
  c._deviceInbox = { ...d2, draftGroupLights: true, draftExcluded: null };
  await c.updateComplete;
  await runtime._saveDiscoveryFilters(c._deviceInbox);
  await new Promise((r) => setTimeout(r, 100));
  c._saveConfigDebounced?.flush?.();
  await new Promise((r) => setTimeout(r, 200));
  result.secondWrite = writes.length === 2;
  result.defaultsRemoveKeys = writes[1]
    && writes[1].group_lights === null && writes[1].exclude_integrations === null;

  // AC4: причина с именем интеграции — строим строку и проверяем текст
  const excludedNow = new Set([anyIntegration]);
  c._serverCfg = { ...c._serverCfg, settings: {
    ...c._serverCfg.settings, exclude_integrations: [...excludedNow],
  } };
  c._deviceInboxMemo = null; c._regSignature = '';
  c._maybeRebuildDevices?.(); c.requestUpdate();
  await c.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  await c.updateComplete;
  // причина с именем интеграции живёт на строках reason=excluded_integration
  // (категория строк — какой была до задачи; вкладку не навязываем)
  const tabsNow = [...root().querySelectorAll('.device-inbox-tabs [role="tab"]')];
  let reasonNames = false;
  for (const tab of tabsNow) {
    tab.click();
    await c.updateComplete;
    const reasons = [...root().querySelectorAll('.device-inbox-reason')]
      .map((node) => node.textContent || '');
    if (reasons.some((text) => text.includes(anyIntegration))) { reasonNames = true; break; }
  }
  result.reasonNamesIntegration = reasonNames;

  c._closeDeviceInbox?.();
  return result;
});
checkAll(out, ['sectionOnAvailable', 'toggleDefaultOn', 'previewHides', 'previewLightsCounted',
  'oneWrite', 'writeCarriesBoth', 'markersUntouched', 'secondWrite', 'defaultsRemoveKeys',
  'reasonNamesIntegration']);
await finish(browser);
