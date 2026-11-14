/** Explicit isolated composition root. Importing it does not register the card. */
import { html, nothing, render } from 'lit';
import { HouseplanCard, CARD_VERSION } from './houseplan-card';
import type { PlanHost } from './plan-host';
import { hostError } from './plan-host';
import { createStandaloneHost, validateStandaloneHost, validateStandaloneHandshake } from './standalone-plan-host';
import { createStandalonePresentation, type StandalonePresentationOptions } from './standalone-presentation';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { ensureLanguage } from './i18n/registry';
import { t, langOf } from './i18n';
import { noticeStyles } from './styles/notice.styles';
export { PLAN_ONLY_CAPABILITIES } from './plan-capabilities';
export type { PlanHost } from './plan-host';

const mounts=new WeakSet<HTMLElement>();
// Resolved from the actual emitted owner chunk, not the facade's directory.
const stylesheet=new URL('__HOUSEPLAN_STANDALONE_STYLESHEET__',import.meta.url).href;
let ownedCard: CustomElementConstructor | undefined;

/** `ready` confirms handshake and connection, not a completed first paint.
 * Always dispose the returned handle, including after a rejected ready. */
export function mountHouseplan(container: HTMLElement, source: PlanHost, options: StandalonePresentationOptions) {
  if(container.ownerDocument!==document || mounts.has(container))throw Error('Standalone mount already owned or in another document');
  const existing=customElements.get('houseplan-card');
  if(existing && existing!==ownedCard)throw Error('Standalone requires a separate document');
  const root=document.createElement('div');root.className='houseplan-standalone';
  root.style.cssText='height:100%;min-height:400px;min-width:0';
  const status=document.createElement('div');root.append(status);
  let control:ReturnType<typeof createStandaloneHost> | undefined, card:HouseplanCard | undefined, disposed=false;
  const ui=createStandalonePresentation(root,options,context=>control?.publish(context));
  mounts.add(container);container.append(root);
  const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheet;root.prepend(link);
  const style=document.createElement('style');style.textContent=noticeStyles.cssText;root.prepend(style);
  root.inert=true;root.setAttribute('aria-busy','true');
  render(html`<ha-circular-progress active></ha-circular-progress>`,status);
  const ready=(async()=>{
    try{
      validateStandaloneHost(source);
      control=createStandaloneHost(source,ui.context);
      const response=await control.host.request<Record<string,unknown>>({type:'houseplan/config/get'});
      if(disposed)throw hostError('context-changed');
      validateStandaloneHandshake(response,ENTRY_BUILD_FINGERPRINT,CARD_VERSION);
      if(!ownedCard){customElements.define('houseplan-card',HouseplanCard);ownedCard=HouseplanCard;}
      card=document.createElement('houseplan-card') as HouseplanCard;
      // No hass assignment/default HaPlanHost construction before this injection.
      card.planHost=control.host;card.panelHost=true;
      card.setConfig({type:'custom:houseplan-card'});
      render(nothing,status);status.remove();root.append(card);
      return card;
    }catch(error){
      if(!disposed){
        await ensureLanguage(langOf(ui.context));
        if(!disposed)render(html`<div class="hpf-notice" role="alert">${t(langOf(ui.context),'standalone.host_error')}</div>`,status);
      }
      throw error;
    }finally{root.inert=false;root.removeAttribute('aria-busy');}
  })();
  return {ready,get element(){return card;},version:CARD_VERSION,
    updatePresentation(next:Partial<StandalonePresentationOptions>){if(disposed)throw hostError('context-changed');return ui.update(next);},
    dispose(){if(disposed)return;disposed=true;control?.dispose();card?.remove();ui.dispose();root.remove();mounts.delete(container);}};
}
