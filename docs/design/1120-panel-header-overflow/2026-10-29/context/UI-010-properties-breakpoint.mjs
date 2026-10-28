// UI-010: local Properties panel breakpoint, shared by all three editors.
(() => {
  const cards = new WeakSet();
  const patched = new WeakSet();
  const install = card => {
    const root = card?.shadowRoot;
    if (!root || cards.has(card)) return;
    cards.add(card);
    const scan = () => {
      const properties = card._editorRuntime?.properties;
      if (!properties || patched.has(properties)) return;
      patched.add(properties);
      const nativeWide = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(properties),'wide')?.get;
      if (!nativeWide) return;
      Object.defineProperty(properties,'wide',{
        configurable:true,
        get() { return this.width >= 1024 && nativeWide.call(this); }
      });
      // Keep the native observer's measurement and layout work. This observer
      // supplies the new crossing event in the 960..1024 interval as well.
      let observed;
      let wasWide;
      const observer = new ResizeObserver(() => {
        const wide = observed.getBoundingClientRect().width >= 1024;
        if (wide === wasWide) return;
        const shrinking = wasWide === true && !wide;
        wasWide = wide;
        if (shrinking) {
          const hadFocus = root.activeElement?.closest('.hp-properties');
          const draft = properties.fields.draft;
          const picker = [...root.querySelectorAll('.hp-properties [data-property]')]
            .find(el => el.dataset.property === draft?.field)?.querySelector('hp-color-opacity');
          const value = picker?.captureHexDraft();
          if (draft && value) properties.suspendedColor = {draft,value};
          properties.closeTransient();
          if (hadFocus) root.querySelector('[data-hp="editor-close"]')?.focus({preventScroll:true});
        }
        card.requestUpdate();
      });
      const observe = properties.observe;
      properties.observe = function (...args) {
        const result = observe.apply(this,args);
        const element = root.querySelector('ha-card');
        if (element && element !== observed) {
          observer.disconnect(); observed = element; wasWide = undefined;
          observer.observe(element);
        }
        return result;
      };
      const dispose = properties.dispose;
      properties.dispose = function (...args) {
        observer.disconnect(); observed = null; wasWide = undefined;
        return dispose.apply(this,args);
      };
      properties.observe();
      card.requestUpdate();
    };
    // Runtime loads lazily; install before its first editor render when possible.
    const ensure = card._ensureEditorRuntime;
    card._ensureEditorRuntime = async function (...args) {
      const ready = await ensure.apply(this,args);
      scan();
      return ready;
    };
    new MutationObserver(scan).observe(root,{childList:true,subtree:true});
    scan();
  };
  const panel = document.querySelector('houseplan-panel');
  if (panel?.shadowRoot) {
    const scan = () => install(panel.shadowRoot.querySelector('houseplan-card'));
    new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});
    scan();
  }
})();
