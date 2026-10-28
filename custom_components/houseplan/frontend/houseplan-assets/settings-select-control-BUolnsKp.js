globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="1ecd2c93b26a65fb31b5ded5033bfc22a75f047a4a9079ee820c417077ca9b89";import{A as e,b as a}from"./lit-element-C3tniB7C.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:c=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${c} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
