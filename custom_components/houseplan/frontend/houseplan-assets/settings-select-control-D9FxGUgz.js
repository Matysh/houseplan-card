globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="b36c532197b7284b05902c2ee9857da1531437cc6e3ae67ea708374c35944309";import{A as e,b as a}from"./lit-element-Byo338PA.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:c=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${c} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
