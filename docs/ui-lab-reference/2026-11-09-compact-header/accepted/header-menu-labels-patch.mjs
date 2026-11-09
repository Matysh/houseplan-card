// Local proposal: preserve source icons and compact row geometry.
const labelExpression='label:t.getAttribute("aria-label")||t.getAttribute("data-hp-tooltip")||t.title||t.textContent?.trim()||""';
const labelFactory=`
function hpLabHeaderMenuLabel(button){
  const label=button.getAttribute('aria-label')||button.getAttribute('data-hp-tooltip')||button.title||button.textContent?.trim()||'';
  const row=document.createElement('span');
  row.style.cssText='display:flex;align-items:center;gap:10px;min-width:0;line-height:20px;';
  const source=button.querySelector('ha-icon'),svg=button.querySelector('svg');
  let icon;
  if(!source&&svg){icon=svg.cloneNode(true);icon.removeAttribute('class');}
  else {
    icon=document.createElement('ha-icon');
    const fallback={'panel-menu':'mdi:menu','space-settings':'mdi:cog-outline','space-add':'mdi:plus','summary-toggle':'mdi:page-layout-sidebar-right','summary-settings':'mdi:cog-outline','editor-close':'mdi:close'};
    icon.setAttribute('icon',source?.getAttribute('icon')||source?.icon||fallback[button.dataset.hp]||'mdi:cog-outline');
  }
  icon.setAttribute('aria-hidden','true');
  icon.style.cssText='display:inline-flex;align-items:center;justify-content:center;flex:0 0 18px;width:18px;height:18px;--mdc-icon-size:18px;pointer-events:none;';
  const text=document.createElement('span');text.textContent=label;
  row.append(icon,text);return row;
}
`;
export function applyMenuLabels(source){
  if(source.split(labelExpression).length!==2)throw Error('Header menu labels no longer match the pinned dev bundle');
  return labelFactory+source.replace(labelExpression,'label:hpLabHeaderMenuLabel(t)');
}
