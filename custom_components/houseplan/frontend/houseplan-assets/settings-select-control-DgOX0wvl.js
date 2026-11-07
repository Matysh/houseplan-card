globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="c95c41e21242847bb0178c364a0aab03467f8fc171df0b0a12324e57297aa556";import{A as e,b as a}from"./lit-element-Dc9WXzV8.js";function l({name:l,value:t,options:s,onChange:i,ariaLabel:d,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${d??e}
    ?disabled=${n} @change=${e=>i(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
