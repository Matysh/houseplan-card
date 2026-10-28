globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="be47c12c6e0c74c42e4e22b3e4562cf844a843c292b8be4d94e56b447cef295c";import{A as e,b as a}from"./lit-element-Ed1l-mAx.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:c,disabled:d=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${c??e}
    ?disabled=${d} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
