globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="8ad2ff55f6971e58d1fb2526cac5af3ba27df7e1852412472484b7843c8d3372";globalThis.__HOUSEPLAN_ENTRY_URL__??=import.meta.url;await (async function waitForHaBootstrap(timeoutMs = 30000) {
  if (!globalThis.document?.querySelector('home-assistant')) return;
  const registry = globalThis.customElements;
  if (registry?.get('home-assistant')) return;
  if (typeof registry?.whenDefined !== 'function') {
    throw new Error('House Plan: Home Assistant custom element registry is unavailable');
  }
  let timer;
  try {
    await Promise.race([
      registry.whenDefined('home-assistant'),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(
          `House Plan: Home Assistant bootstrap did not complete within ${timeoutMs} ms`,
        )), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  // Native whenDefined can return the shim's proxy, not its actual constructor.
  // The current global registry must nevertheless own the public HA root now.
  if (!globalThis.customElements?.get('home-assistant')) {
    throw new Error('House Plan: Home Assistant bootstrap has no current root definition');
  }
})();try{await import("./houseplan-assets/view-frame-CE3dEVhj.js");await import("./houseplan-assets/lit-element-Dwst3mYD.js");await import("./houseplan-assets/houseplan-card-9vVrPP4A.js")}catch(e){if(!customElements.get("houseplan-card")){const l=String(navigator.language||"en").toLowerCase();const m=l.startsWith("ru")?"House Plan обновился — перезагрузите страницу (Ctrl+F5).":l.startsWith("de")?"House Plan wurde aktualisiert — bitte laden Sie die Seite neu (Strg+F5).":l.startsWith("fr")?"House Plan a été mis à jour — veuillez recharger la page (Ctrl+F5).":"House Plan was updated — please reload the page (Ctrl+F5).";customElements.define("houseplan-card",class extends HTMLElement{setConfig(){}getCardSize(){return 1}connectedCallback(){this.style.cssText="display:block;box-sizing:border-box;padding:16px;border:1px solid var(--divider-color,#e0e0e0);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);font:14px/1.4 var(--paper-font-body1_-_font-family,sans-serif)";this.textContent=m}})}console.error("[houseplan] stale houseplan-card.js: the implementation chunk is unavailable",e)}
