globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="8ad2ff55f6971e58d1fb2526cac5af3ba27df7e1852412472484b7843c8d3372";import{A as e,b as a}from"./lit-element-Dwst3mYD.js";function l({name:l,value:t,options:s,onChange:d,ariaLabel:i,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${i??e}
    ?disabled=${n} @change=${e=>d(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
