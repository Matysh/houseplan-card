globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="789ce83e327e9db7c4ec5cff0ea24a37d0c51c12ee057d991cac50bb50b2ff5b";import{A as e,b as a}from"./lit-element-CiUEg7gU.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:c,disabled:d=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${c??e}
    ?disabled=${d} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
