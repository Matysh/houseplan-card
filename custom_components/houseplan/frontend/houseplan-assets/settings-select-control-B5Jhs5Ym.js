globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="296ac3a7333f2d84e9116e979bea2537996957842715a2a9c5ff6352f6a383ef";import{A as e,b as a}from"./lit-element-BS4uug0d.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${n} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
