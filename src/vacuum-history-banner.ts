import {html,nothing} from 'lit';
import type {I18nKey} from './i18n';
import type {VacuumHistory} from './vacuum-history';

export function renderVacuumHistoryBanner(history:VacuumHistory,t:(key:I18nKey,vars?:Record<string,string|number>)=>string){
  return history.visible&&history.shown?html`<div class="vacuum-history-banner" data-hp="vacuum-history-banner" role="status">
    <ha-icon icon="mdi:history"></ha-icon><span>${t('vac.history_banner',{date:history.label(history.shown.id)})}</span>
    ${history.renderLimited?html`<span>${t('vac.history_limited')}</span>`:nothing}
    ${!history.shown.completed?html`<span>${t('vac.history_interrupted')}</span>`:nothing}
    <button type="button" data-hp="vacuum-history-hide" @pointerdown=${(event:Event)=>event.stopPropagation()}
      @click=${(event:Event)=>{event.stopPropagation();history.hide();}}>${t('vac.history_hide')}</button>
  </div>`:nothing;
}
