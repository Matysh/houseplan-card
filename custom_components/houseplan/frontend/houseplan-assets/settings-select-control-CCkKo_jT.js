globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="db22631f8dffce327662c122343d4c921f036b08d153a1b63c45a9e9ddaeb125";import{A as e,b as a}from"./lit-element-BfK6EUi6.js";function l({name:l,value:t,options:s,onChange:d,ariaLabel:i,disabled:n=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${i??e}
    ?disabled=${n} @change=${e=>d(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
