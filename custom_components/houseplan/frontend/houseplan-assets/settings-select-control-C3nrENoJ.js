globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="1f14522c6db94b71d0ef9ca190e7323740ee2fc29cb55e148e9f430485fe7741";import{A as e,b as a}from"./lit-element-ByAa5P0r.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${n} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
