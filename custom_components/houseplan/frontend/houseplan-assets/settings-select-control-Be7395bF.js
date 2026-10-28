globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="4ce7b51a88116e4796a3cee80cdcdcbc678fde073492280ccf237d52efa17ece";import{A as e,b as a}from"./lit-element-ZopDGmT5.js";function l({name:l,value:t,options:s,onChange:c,ariaLabel:d,disabled:i=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${i} @change=${e=>c(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
