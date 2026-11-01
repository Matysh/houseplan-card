/** Accepted #1105 selections. Counts refer to files/scenes/named journeys, never TAP cases. */
export const CRITICAL_NODE = Object.freeze([
  'config-write-conflict', 'config-reload-authority', 'config-write-context',
  'layout-write-reload', 'model-invariants', 'device-editor-access',
  'device-editor-permissions-runtime', 'device-toggle',
].map(name => `test/${name}.test.mjs`));

const smokeLabels = {
  readonly_cold_start: 'Сохранённый план при первом открытии без прав редактирования',
  cold_view_toggle: 'Команда устройству сразу после холодного открытия View',
  view_edit_permissions: 'Поздний ответ и смена прав пользователя',
  toggle_confirmation: 'Подтверждение команды устройству',
  editor_gestures: 'Жесты редактора без случайного клика или команды',
  canvas_surface_gestures: 'Жесты на поверхности плана',
  editor_draft_exit: 'Выход из редактора и несохранённые изменения',
  geometry_history_refusal: 'Отказ операции и целостность истории геометрии',
  decor_creation_selection: 'Создание декора и выбор созданного объекта',
  space_switch_transitions: 'Переключение между этажами',
  live_text: 'Обновление живого текста',
  isometric_live_touch: 'Живое состояние и касания в изометрии',
  view_recovery: 'Восстановление View после задержки или сбоя',
};
export const BETA_SMOKES = Object.freeze([
  ['readonly_cold_start'], ['cold_view_toggle'], ['view_edit_permissions', '--only=late'],
  ['toggle_confirmation'], ['editor_gestures'], ['canvas_surface_gestures'],
  ['editor_draft_exit'], ['geometry_history_refusal'], ['decor_creation_selection'],
  ['space_switch_transitions'], ['live_text'], ['isometric_live_touch'], ['view_recovery'],
].map(([name, ...args]) => ({ file: `demo/smoke_${name}.mjs`, name: smokeLabels[name], args })));

// Main product surfaces run through the real panel host. Reuse existing panel
// scenes where available; the other source fixtures get distinct panel IDs/PNGs.
export const PANEL_GOLDEN_SOURCES = Object.freeze([
  'panel-wide-view-light-en', 'panel-compact-ui-1132', 'panel-three-rows-ui-1132',
  'panel-narrow-kiosk-fixed',
  'device-icon-state-table-light', 'device-icon-state-table-dark',
  'lighting-glow-sun-dark', 'lighting-temp-glow-light',
  'lighting-sun-transparent-chain-flat', 'lighting-led-strip-glow-dark',
  'wall-junctions-view-dark', 'geometry-diagonal-45-opening-dark',
  'opening-symbol-flip-pairs-light', 'isometric-geometry-view-light',
  'isometric-stage3-overlays-dark', 'isometric-opening-symbol-parity-dark',
  'panel-wide-plan-editor-dark-en', 'geometry-devices-editor-dark', 'geometry-decor-editor-dark',
  'device-dialog-mobile-ru', 'room-temperature-dialog-desktop-en',
  'view-device-menu-readonly-light-ru',
]);
export const BETA_PANEL_GOLDEN = Object.freeze(PANEL_GOLDEN_SOURCES.map(id =>
  id.startsWith('panel-') ? id : `panel-${id}`));
// Only the embedding-specific sample is repeated in Lovelace, not the product matrix.
export const BETA_LOVELACE_GOLDEN = Object.freeze([
  'geometry-view-light-fit', 'plan-rotation-phone-view-320-1070', 'geometry-plan-editor-dark',
]);
export const BETA_GOLDEN = Object.freeze([...BETA_PANEL_GOLDEN, ...BETA_LOVELACE_GOLDEN]);

export const BETA_E2E = Object.freeze([
  ['first-run', 'tests/first-run/first-space.admin.spec.mjs', 'from the sidebar page to a saved first space without any image'],
  ['journeys', 'tests/panel.admin.spec.mjs', 'is listed in the sidebar and shows the plan on the very first open'],
  ['journeys', 'tests/panel.mobile.spec.mjs', 'sidebar page on a phone draws the plan and opens the drawer'],
  ['journeys', 'tests/selective-invalidation.admin.spec.mjs', 'Save remains pending until its real HA ACK, then closes and survives reload'],
  ['journeys', 'tests/selective-invalidation.admin.spec.mjs', 'a confirmed Save refusal leaves server truth intact and does not poison subsequent Copy and history'],
  ['journeys', 'tests/zz-restart.admin.spec.mjs', 'an open plan survives a Home Assistant restart and is live again'],
  ['journeys', 'tests/readonly.viewer.spec.mjs', 'the sidebar page shows the plan read-only'],
  ['journeys', 'tests/readonly.viewer.spec.mjs', 'the dashboard card is the same read-only plan'],
  ['first-run', 'tests/first-run/empty.viewer.spec.mjs', 'a non-admin sees a calm read-only empty state, no create action'],
  ['journeys', 'tests/editor-devices.admin.spec.mjs', 'a device is moved with undo and redo, renamed and copied, and the plan keeps it'],
  ['journeys', 'tests/panel.admin.spec.mjs', 'tapping a toggle-bound lamp switches it in Home Assistant'],
  ['journeys', 'tests/transfer-import.admin.spec.mjs', 'damaged, wrong and invalid files are refused and the plan stays as it was'],
  ['upgrade', 'tests/upgrade/upgrade.admin.spec.mjs', 'an open browser follows an integration update after the HA restart'],
].map(([suite, file, title]) => ({ suite, file, title })));

/** Reject fuzzy names, duplicate selectors and cross-product file/title matches. */
export function selectExact(candidates, wanted, key = item => `${item.file}\0${item.title}`) {
  const expected = wanted.map(key);
  if (!expected.length || new Set(expected).size !== expected.length) throw Error('Selection must be nonempty and unique');
  const selected = [];
  for (const name of expected) {
    const matches = candidates.filter(candidate => key(candidate) === name);
    if (matches.length !== 1) throw Error(`Expected exactly one candidate: ${name.replaceAll('\0', ' / ')}; found ${matches.length}`);
    selected.push(matches[0]);
  }
  return selected;
}
