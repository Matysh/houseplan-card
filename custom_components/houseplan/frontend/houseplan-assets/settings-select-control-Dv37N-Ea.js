globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="2b99bf48542b46b9ae19f5dfdce521d8ee85d4326d49553322b63fac019f9ed5";import{A as e,b as a}from"./lit-element-vCG3pNO7.js";function l({name:l,value:t,options:s,onChange:d,ariaLabel:i,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${i??e}
    ?disabled=${n} @change=${e=>d(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
