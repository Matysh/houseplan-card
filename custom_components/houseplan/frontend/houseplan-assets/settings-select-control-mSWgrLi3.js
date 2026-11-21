globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="96d8e71a0e6405e709ab6765d8371c06bad012cf0b3f3e835c32a12bec29f1b0";import{A as e,b as a}from"./lit-element-C17gPlFG.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${n} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
