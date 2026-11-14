globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="a711262de27ea7ba5f522b98765c8fdb4c7d39ee632cb53ff3eb40b25a4a5242";import{A as e,b as a}from"./lit-element-f5Al4X-s.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:b=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${b} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
