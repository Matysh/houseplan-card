globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="f22dcc979004507b77674070fffadce8266dc1cce8822581dae9e39c73410d02";import{A as e,b as a}from"./lit-element-U0Wc_dD9.js";function l({name:l,value:t,options:s,onChange:d,ariaLabel:i,disabled:c=!1}){return a`<hp-settings-select><select data-hp="field" data-field=${l} class="hpf-select" id=${l} name=${l} .value=${t} aria-label=${i??e}
    ?disabled=${c} @change=${e=>d(e.target.value)}>
    ${s.map(e=>a`<option value=${e.value} ?selected=${e.value===t} ?disabled=${e.disabled}>${e.label}</option>`)}
  </select></hp-settings-select>`}export{l as s};
