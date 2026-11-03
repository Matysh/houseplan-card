/**
 * Selectors from the product's declared test contract (contract/
 * data-hp-contract.json, houseplan-card#489 and #1011). Every selector is
 * built by `hp()` and checked against the contract when it is built; the
 * legacy class/role fallbacks are gone — the oldest version any suite runs is
 * the previous stable (≥ 1.81.0), long past 1.73.0-beta.7 where the hooks
 * appeared. Hooks newer than the installed product are gated per scenario by
 * `requireHooks` (tests/lib/contract.mjs).
 */
import { hp, root, historicalHp } from './contract.mjs';

export { hp, root };

export const HP = {
  ready: root('data-hp-state', 'ready'),
  mode: (mode) => root('data-hp-mode', mode),
  empty: hp('empty'),
  createSpace: hp('create-space'),
  dialog: (kind) => hp('dialog', kind ? { kind } : {}),
  dialogConfirm: hp('dialog-confirm'),
  dialogCancel: hp('dialog-cancel'),
  pdf: hp('pdf'),
  settings: hp('settings'),
  support: hp('support'),
  spaceAdd: hp('space-add'),
  spaceTab: hp('space-tab'),
  spaceSettings: hp('space-settings'),
  panelMenu: hp('panel-menu'),
  panelTitle: historicalHp('panel-title'),
  modeTab: (mode) => hp('mode-tab', { mode }),
  toolbar: (kind) => hp('toolbar', { kind }),
  tool: (id) => hp('tool', { tool: id }),
  toast: hp('toast'),
  room: hp('room'),
  device: (entityId) => hp('device', entityId ? { entity: entityId } : {}),
  editorTabs: hp('mode-tab'),
  editorClose: hp('editor-close'),
  field: (field, value) => hp('field', { field, value }),
  action: (action, value) => hp('action', { action, value }),
};

/** Confirm button of a dialog: the declared hook. */
export const confirmIn = (dialog) => dialog.locator(HP.dialogConfirm).first();
/** Cancel/close button of a dialog: the declared hook. */
export const cancelIn = (dialog) => dialog.locator(HP.dialogCancel).first();
