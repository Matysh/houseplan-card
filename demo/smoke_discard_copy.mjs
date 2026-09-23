// #610: all four unsaved-settings owners use unambiguous RU actions and the
// save-off glyph, while unrelated warning confirmations keep their lock glyphs.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 320, height: 820 });

const out = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const settle = async () => {
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 70));
  };
  c._config = { ...(c._config || {}), language: 'ru' };
  await c._ensureEditorRuntime();
  await settle();

  const cases = [
    {
      kind: 'marker', state: '_markerDialog', key: 'discard-marker-dialog', input: '#marker-name',
      open: () => {
        c._setMode('devices');
        c._openMarkerDialog(c._devices.find((item) => item.id === 'd_light1') || c._devices[0]);
      },
      value: (field) => `${field.value} x`,
    },
    {
      kind: 'room', state: '_roomDialog', key: 'discard-room-dialog', input: '#room-name',
      open: () => { c._setMode('plan'); c._openRoomEdit(c._curSpaceCfg.rooms[0]); },
      value: (field) => `${field.value} x`,
    },
    {
      kind: 'space', state: '_spaceDialog', key: 'discard-space-dialog', input: '#space-title',
      open: () => { c._setMode('view'); c._openSpaceDialog('edit', c._space); },
      value: (field) => `${field.value} x`,
    },
    {
      kind: 'settings', state: '_settingsDialog', key: 'discard-settings-dialog', input: '#gs-north',
      open: () => c._openSettingsDialog(),
      value: () => '47',
    },
  ];

  const result = {};
  for (const testCase of cases) {
    testCase.open();
    await settle();
    const owner = () => root().querySelector(`hp-dialog[data-kind="${testCase.kind}"]`);
    const field = owner().querySelector(testCase.input);
    field.value = testCase.value(field);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const draftValue = field.value;

    owner().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
    await settle();
    let confirm = root().querySelector('hp-confirm hp-dialog');
    let buttons = [...(confirm?.querySelectorAll('.danger-confirm-footer button') || [])];
    const titleIcon = confirm?.icon;
    const actionIcon = buttons[1]?.querySelector('ha-icon')?.getAttribute('icon');
    result[`${testCase.kind}CopyAndIcons`] = confirm?.querySelector('.danger-confirm-body')?.dataset.confirmKey === testCase.key
      && JSON.stringify(buttons.map((button) => button.textContent.trim()))
        === JSON.stringify(['Вернуться', 'Не сохранять'])
      && titleIcon === 'mdi:content-save-off-outline'
      && actionIcon === 'mdi:content-save-off-outline';
    buttons[0].click();
    await settle();
    result[`${testCase.kind}ReturnKeepsDraft`] = Boolean(c[testCase.state])
      && owner()?.querySelector(testCase.input)?.value === draftValue
      && !root().querySelector('hp-confirm hp-dialog');

    owner().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
    await settle();
    confirm = root().querySelector('hp-confirm hp-dialog');
    buttons = [...(confirm?.querySelectorAll('.danger-confirm-footer button') || [])];
    buttons[1].click();
    await settle();
    result[`${testCase.kind}DiscardCloses`] = !c[testCase.state]
      && !root().querySelector(`hp-dialog[data-kind="${testCase.kind}"]`);
  }

  const fallback = c._confirmDanger({
    key: 'warning-fallback', kind: 'warning', title: 'Warning', message: 'Warning body',
    confirmLabel: 'Proceed', cancelLabel: 'Back',
  });
  await settle();
  const warning = root().querySelector('hp-confirm hp-dialog');
  result.unrelatedWarningKeepsLockGlyphs = warning?.icon === 'mdi:lock-open-alert-outline'
    && warning.querySelector('[data-hp="dialog-confirm"] ha-icon')?.getAttribute('icon')
      === 'mdi:lock-open-variant';
  warning.querySelector('[data-hp="dialog-cancel"]').click();
  result.unrelatedWarningCancelIsSafe = await fallback === false;
  return result;
});

checkAll(out);
await finish(browser, out);
