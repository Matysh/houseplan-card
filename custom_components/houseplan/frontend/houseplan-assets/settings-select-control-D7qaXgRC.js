globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="b7bf6f0887687f21fbdf2c08448b60c6d6e84a0d870a4ea06324f63e5509a483";import{A as e,b as a}from"./lit-element-Qi-A6wAA.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${n} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
