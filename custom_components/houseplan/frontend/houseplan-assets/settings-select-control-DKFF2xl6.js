globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="39760e6c6f7b630d2ede693ff5378ebe59ffaa3f61f89eed567f2a1723058a36";import{A as e,b as a}from"./lit-element-DOGBMnIa.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${n} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
