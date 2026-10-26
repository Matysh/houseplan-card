// Transport-only bootstrap. Every adapter below is byte-identical to acceptance.
const { card } = window.__lab || {};
if (!card) throw Error('The native UI Lab did not initialize; reference adapters were not installed.');
const toggle = document.querySelector('#lab-styles');
toggle.checked = true;
const enabled = () => toggle.checked;
const modules = [
  ['color-picker-motion', 'installColorPickerMotion'],
  ['decor-selection-frames', 'installDecorSelectionFrames'],
  ['space-dialog', 'installSpaceDialog'],
  ['furniture-placement-pan', 'installFurniturePlacementPan'],
  ['device-context-actions', 'installDeviceContextActions'],
  ['confirmation-kit', 'installConfirmationKit'],
  ['hidden-device-status', 'installHiddenDeviceStatus'],
  ['editor-grid-coverage', 'installEditorGridCoverage'],
  ['first-space-converter', 'installFirstSpaceConverter'],
];
for (const [name, method] of modules) {
  const module = await import(`/overrides/${name}.mjs`);
  if (name === 'color-picker-motion') module[method](enabled);
  else module[method](card, enabled);
}
toggle.dispatchEvent(new Event('change'));
card.requestUpdate();
document.title = 'UI Lab reference · beta.2 · synthetic data';
