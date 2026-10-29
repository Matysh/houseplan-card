// Local visual experiment: ordered overflow, not fixed width breakpoints.
(() => {
  const panel = document.querySelector('houseplan-panel');
  const card = panel?.shadowRoot?.querySelector('houseplan-card');
  const root = card?.shadowRoot;
  if (!root) return;
  const style = document.createElement('style');
  style.textContent = `
    .hdr[data-ui1120-flow] > .head{display:flex!important;flex-wrap:nowrap!important;gap:10px!important;padding:10px 12px!important;height:auto!important;overflow:visible!important}
    .hdr[data-ui1120-flow] .head > *{flex-shrink:0!important}
    .hdr[data-ui1120-flow] .head > .tabs{display:flex!important;flex:none!important;width:auto!important;max-width:none!important;overflow:visible!important;flex-wrap:nowrap!important}
    .hdr[data-ui1120-flow] .head > .tabs .tab{display:inline-flex!important;white-space:nowrap;flex:none}
    .hdr[data-ui1120-flow] .tabs .tabedit{display:inline-flex!important}
    .hdr[data-ui1120-flow] .compact-space-select{flex:0 0 180px!important;width:180px!important;min-width:180px!important}
    .hdr[data-ui1120-flow] .compact-space-select::part(control){min-width:44px;padding-inline:12px;gap:8px}
    .hdr[data-ui1120-flow] .head > .modes{display:inline-flex!important;flex:none!important;width:auto!important;padding:var(--sp-2)!important;gap:var(--sp-1)!important;background:rgba(127,127,127,.12)!important}
    .hdr[data-ui1120-flow] .head .modetab{display:inline-flex!important}
    .hdr[data-ui1120-flow] .head .modetab > .ml{display:none!important}
    .hdr[data-ui1120-flow='0'] .modetab > ha-icon:not([data-ui008-wide]){display:none!important}
    .hdr[data-ui1120-flow='0'] .modetab > [data-ui008-wide]{display:inline-flex!important}
    .hdr[data-ui1120-flow]:not([data-ui1120-flow='0']) .modetab > ha-icon:not([data-ui008-wide]){display:inline-flex!important}
    .hdr[data-ui1120-flow]:not([data-ui1120-flow='0']) .modetab > [data-ui008-wide]{display:none!important}
    .hdr[data-ui1120-flow] .head > .spacer{display:block!important;flex:1 0 30px!important}
    .hdr[data-ui1120-flow] .head > .header-actions{display:inline-flex!important;gap:10px!important;margin:0!important;max-width:none!important}
    .hdr[data-ui1120-flow] .header-actions > .header-action,.hdr[data-ui1120-flow] .header-actions > .summary-control{display:inline-flex!important}
    .hdr[data-ui1120-flow] .header-menu-wrap{display:none!important}
    .hdr[data-ui1120-flow] .zoomctl .btn.zb:is([data-hp='zoom-in'],[data-hp='zoom-out'],[data-hp='zoom-fit']){display:inline-flex!important}
    .hdr[data-ui1120-flow] .zoomctl .btn.zb[data-hp='rotate-right']{border-radius:0!important}
    .hdr:is([data-ui1120-flow='2'],[data-ui1120-flow='3'],[data-ui1120-flow='4']) .zoomctl .btn.zb:is([data-hp='zoom-in'],[data-hp='zoom-out'],[data-hp='zoom-fit']){display:none!important}
    .hdr:is([data-ui1120-flow='2'],[data-ui1120-flow='3'],[data-ui1120-flow='4']) .zoomctl .btn.zb[data-hp='rotate-right']{border-radius:0 var(--rad-m) var(--rad-m) 0!important}
    /* Last single-row state: let the flexible gap shrink to the ordinary
       10px gap. The negative margin cancels the spacer's second flex gap. */
    .hdr[data-ui1120-flow='3'] .head > .spacer{flex:1 0 0px!important;margin-inline-start:-10px}
    .hdr[data-ui1120-flow='4'] > .head{flex-wrap:wrap!important}
    .hdr[data-ui1120-flow='4'] .head > .spacer{display:none!important}
    .hdr[data-ui1120-flow='4'] .head > .header-actions{flex:1 0 100%!important;justify-content:flex-start}
    .ui1120-probe{position:fixed!important;left:-100000px!important;top:0!important;visibility:hidden!important;pointer-events:none!important;width:max-content!important;min-height:0!important;contain:layout style!important}
    .ui1120-probe > .head{width:max-content!important}
    .ui1120-probe ha-icon{width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);flex-shrink:0}
    .ui1120-probe .head > .spacer{flex:0 0 30px!important}
  `;
  root.append(style);
  let wideTabs = null, queued = false, modelKey = '', measuring = false;
  // Replace the lab's 1024px space-navigation observer. Retain normal stage
  // ResizeObserver and native navigation/dirty guards. Not a product patch.
  const observerLease = {observe(){},disconnect(){},unobserve(){}};
  const stopFixedRule = () => {
    if(card._roHdr !== observerLease){card._roHdr?.disconnect();card._roHdr=observerLease;}
  };
  stopFixedRule();
  const phase = (header,value) => {
    if(header.dataset.ui1120Flow !== String(value)) header.dataset.ui1120Flow=String(value);
  };
  const setCompact = value => {
    if(card._compactSpaces === value) return false;
    card._compactSpaces=value;card.requestUpdate();return true;
  };
  const measure = () => {
    queued=false;
    const header=root.querySelector('ha-card > .hdr');
    const head=header?.querySelector(':scope > .head');
    if(!head || !header.clientWidth || header.classList.contains('kioskhide')) return;
    stopFixedRule();
    const key=JSON.stringify([card._model?.map(s=>[s.id,s.title]),card._mode,card._canEdit]);
    if(key!==modelKey){modelKey=key;wideTabs=null;}
    const tabs=head.querySelector(':scope > .tabs');
    if(!tabs) return;
    if(!tabs.classList.contains('compact-spaces')) wideTabs=tabs.cloneNode(true);
    if(!wideTabs){setCompact(false);return;}
    measuring=true;
    const probe=document.createElement('div');
    probe.className='hdr ui1120-probe';probe.setAttribute('aria-hidden','true');probe.inert=true;
    const clone=head.cloneNode(true);probe.append(clone);
    const compactTabs=tabs.classList.contains('compact-spaces') ? tabs.cloneNode(true) : null;
    clone.querySelector(':scope > .tabs').replaceWith(wideTabs.cloneNode(true));
    phase(probe,0);root.append(probe);
    let chosen=0;
    const available=header.getBoundingClientRect().width;
    const fits=()=>clone.getBoundingClientRect().width <= available + .25;
    while(chosen<2 && !fits()){chosen++;phase(probe,chosen);}
    if(!fits()){
      chosen=3;
      if(compactTabs){clone.querySelector(':scope > .tabs').replaceWith(compactTabs);phase(probe,3);if(!fits()) chosen=4;}
    }
    probe.remove();measuring=false;
    phase(header,chosen);
    if(setCompact(chosen>=3)) return;
    const stage=root.querySelector('.stage');
    const shell=root.querySelector('ha-card');
    if(stage && shell){const h=Math.round(stage.getBoundingClientRect().top-shell.getBoundingClientRect().top);if(h>=0 && h!==card._hdrH)card._hdrH=h;}
  };
  const schedule = () => {if(!queued){queued=true;requestAnimationFrame(measure);}};
  const resize=new ResizeObserver(schedule);
  const shell=root.querySelector('ha-card');if(shell)resize.observe(shell);
  // Probe insertion/removal must not feed back into measurements.
  new MutationObserver(records=>{
    if(measuring)return;
    if(records.some(r=> !r.target.closest?.('.ui1120-probe') &&
      [...r.addedNodes,...r.removedNodes].some(n=>!n.classList?.contains('ui1120-probe'))))schedule();
  }).observe(root,{childList:true,subtree:true,characterData:true});
  const updated=card.updated;
  card.updated=function(changes){stopFixedRule();const result=updated.call(this,changes);schedule();return result;};
  addEventListener('resize',schedule);
  document.fonts?.ready.then(schedule);
  // Shared select is already present in the current lab; lazy load it on a
  // fresh wide session before the first compact transition.
  if(!customElements.get('hp-settings-select'))void card._ensureEditorRuntime().then(schedule);
  schedule();
})();
