globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="f33ee2dc24f9a15e5f01273f614e17c5471d1a55bbb7faa292301be416bb6e58";import{A as e,b as a}from"./lit-element-BwbCOeg9.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:b=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${b} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
