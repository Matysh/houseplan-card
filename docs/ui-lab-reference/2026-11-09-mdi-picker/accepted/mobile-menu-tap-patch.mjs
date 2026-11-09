// Pending shared-control UI Lab proposal; no accepted journal entry yet.
export const tapAssetPath='/assets/houseplan-assets/houseplan-card-PYSj5GP6.js';
export function patchMenuTap(source){
  const before='function _n(e,t="12px"){return`${e} { box-sizing:border-box;';
  const after='function _n(e,t="12px"){return`:host(hp-settings-select),:host(hp-icon-picker),:host(hp-color-opacity),[aria-haspopup],select,${e},${e} * { -webkit-tap-highlight-color:transparent; } ${e} { box-sizing:border-box;';
  if(source.split(before).length!==2)throw Error('Shared floating-control tap anchor mismatch');
  return source.replace(before,after);
}
