// UI-029 accepted (#998): theme the genuine HA icon picker in device settings only.
const styles = {
  'ha-picker-field': `
    :host{display:block;min-width:0;font:inherit;}
    ha-combo-box-item{box-sizing:border-box;width:100%;min-height:44px;
      border:1px solid var(--hpf-line,var(--divider-color));border-radius:8px;
      background:var(--hpf-control-surface,var(--hpf-surface,var(--card-background-color)));
      color:var(--primary-text-color);cursor:pointer;
      --md-list-item-one-line-container-height:42px;--md-list-item-two-line-container-height:42px;
      --md-list-item-leading-space:14px;--md-list-item-trailing-space:14px;
      --md-list-item-label-text-size:14px;--md-list-item-label-text-line-height:20px;
      --ha-md-list-item-gap:14px;--md-ripple-hover-opacity:0;--md-ripple-pressed-opacity:0;
      transition:background 160ms,border-color 160ms;}
    ha-combo-box-item::after{display:none;}
    ha-combo-box-item:hover{border-color:var(--hpf-accent,var(--primary-color));background:var(--hpf-tint);}
    ha-combo-box-item:focus-within{border-color:var(--hpf-accent,var(--primary-color));outline:none;}
    [slot=headline]{min-width:0;overflow:hidden;text-overflow:ellipsis;font:inherit;}
    .arrow{width:18px;height:18px;--mdc-icon-size:18px;color:var(--primary-text-color);transition:transform 160ms;}
    :host(.opened) .arrow{transform:rotate(180deg);}
    .clear{margin:0;--ha-icon-button-size:28px;--ha-icon-button-padding-inline:0px;}
    @media(max-width:550px){:host{font-size:16px;}ha-combo-box-item{--md-list-item-label-text-size:16px;}}
    @media(prefers-reduced-motion:reduce){ha-combo-box-item,.arrow{transition:none;}}
  `,
  'ha-generic-picker': `
    :host,.container,#picker{min-width:0;max-width:100%;}
    wa-popover{--wa-panel-border-radius:10px;--wa-panel-border-color:var(--hpf-line,var(--divider-color));}
    wa-popover::part(body){box-sizing:border-box;width:min(var(--body-width),calc(100vw - 32px));
      max-width:calc(100vw - 32px);min-height:0;height:320px;max-height:min(70dvh,320px);
      padding:5px;border:1px solid var(--hpf-line,var(--divider-color));border-radius:10px;
      background:var(--hpf-surface,var(--card-background-color));color:var(--primary-text-color);
      box-shadow:0 8px 28px #0003;}
  `,
  'ha-picker-combo-box': `
    :host{padding-top:0;min-width:0;max-width:100%;font:inherit;
      background:var(--hpf-surface,var(--card-background-color));color:var(--primary-text-color);}
    ha-input-search{padding:5px 5px 8px;min-width:0;box-sizing:border-box;font:inherit;}
    ha-input-search::part(wa-base){box-sizing:border-box;height:44px;min-height:44px;padding:0 12px;
      border:1px solid var(--hpf-line,var(--divider-color));border-radius:8px;
      background:var(--hpf-control-surface,var(--hpf-surface,var(--card-background-color)));
      color:var(--primary-text-color);box-shadow:none;outline:none;
      transition:background 160ms,border-color 160ms;}
    ha-input-search:hover::part(wa-base){border-color:var(--hpf-accent,var(--primary-color));}
    ha-input-search:focus-within::part(wa-base){border-color:var(--hpf-accent,var(--primary-color));outline:none;box-shadow:none;}
    ha-input-search::part(wa-input){min-width:0;margin-inline:8px;padding:0;font:inherit;color:var(--primary-text-color);}
    ha-input-search::part(wa-input)::placeholder{color:var(--secondary-text-color);}
    .list-wrapper,lit-virtualizer,.plain-list{min-width:0;max-width:100%;overflow-x:hidden;}
    .combo-box-row{min-width:0;border-radius:6px;min-height:44px;transition:background-color 160ms,color 160ms;}
    .combo-box-row.current-value{color:var(--hpf-accent,var(--primary-color));background:transparent;}
    .combo-box-row:is(:hover,.selected){background:var(--hpf-tint);}
    ha-combo-box-item{border-radius:6px;min-width:0;font:inherit;
      --md-list-item-one-line-container-height:44px;--md-list-item-top-space:0px;--md-list-item-bottom-space:0px;
      --md-list-item-leading-space:12px;--md-list-item-trailing-space:12px;
      --md-list-item-label-text-size:14px;--md-list-item-label-text-line-height:20px;
      --md-list-item-label-text-color:inherit;--md-ripple-hover-opacity:0;}
    @media(max-width:550px){:host{font-size:16px;}ha-combo-box-item{--md-list-item-label-text-size:16px;}}
  `,
};

export function installDevicePickerRoot(root) {
  if (!styles[root.host?.localName]) return;
  let node=root.host, belongs=false, iconPicker=false;
  while(node){if(node.localName==='ha-icon-picker')iconPicker=true;if(node.matches?.('hp-dialog[data-kind=marker]')){belongs=true;break;}node=node.parentElement||node.getRootNode()?.host;}
  if(!belongs)return;
  const sheet=new CSSStyleSheet();sheet.replaceSync(styles[root.host.localName]);
  root.adoptedStyleSheets=[...root.adoptedStyleSheets,sheet];
  if(root.host.localName==='ha-generic-picker'){
    const spacing=()=>{const popup=root.querySelector('wa-popover');if(popup&&popup.distance!==7)popup.distance=7;};
    new MutationObserver(spacing).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['distance']});spacing();
  }
  if(iconPicker&&root.host.localName==='ha-picker-combo-box'){
    const searchLabel=()=>{const field=root.querySelector('ha-input-search');if(field&&field.placeholder!=='Поиск')field.placeholder='Поиск';};
    new MutationObserver(searchLabel).observe(root,{childList:true,subtree:true});searchLabel();
  }
  if(root.host.localName==='ha-picker-field'){
    const triangle=()=>{const arrow=root.querySelector('.arrow');if(arrow&&arrow.path!=='m7 10 5 5 5-5z')arrow.path='m7 10 5 5 5-5z';};
    new MutationObserver(triangle).observe(root,{childList:true,subtree:true});triangle();
  }
}






