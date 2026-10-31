globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="0a89f0c4ce03f55f7167a23a2a3ab11079d16fccc41680735d9a2dd716d99a30";import{A as e,b as a}from"./lit-element-BdQ7BkK2.js";function l({name:l,value:t,options:s,onChange:d,ariaLabel:i,disabled:c=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${i??e}
    ?disabled=${c} @change=${e=>d(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
