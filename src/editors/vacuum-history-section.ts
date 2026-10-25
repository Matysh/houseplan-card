/** UI-030 using the shared select/actions/callout, without a settings writer. */
import {html,nothing} from 'lit';
import type {DevItem} from '../types';
import type {HouseplanEditorHostPort} from '../houseplan-editor-runtime';
import {settingsCopy} from './settings-copy';

export function renderVacuumHistorySection(host:HouseplanEditorHostPort,device:DevItem){
  const history=host._vacHistory,{st}=settingsCopy(host);
  history.open(device);
  const reason=history.messageReason;
  return html`<section class="vacuum-history" data-hp="vacuum-history" aria-labelledby="vacuum-history-title"
    aria-busy=${String(history.loadingList||history.loadingShow)}>
    <h3 id="vacuum-history-title">${st('marker.history_title')}</h3>
    <hp-settings-select><select data-hp="field" data-field="vacuum-history-record" aria-label=${st('marker.history_select_label')}
      .value=${history.selected} ?disabled=${history.loadingList||!history.catalog?.records.length}
      @change=${(event:Event)=>{history.selected=(event.target as HTMLSelectElement).value;host.requestUpdate();}}>
      <option value="" ?selected=${!history.selected}>${st('marker.history_select')}</option>
      ${(history.catalog?.records??[]).map(row=>html`<option value=${row.id} ?selected=${history.selected===row.id}>${history.label(row.id)}</option>`)}
    </select></hp-settings-select>
    <div class="hpf-actions vacuum-history-actions">
      <button type="button" data-hp="vacuum-history-show" class="btn ${history.visible?'on':''}"
        ?disabled=${!history.canShow} @click=${()=>void history.show()}>
        <ha-icon icon="mdi:eye-outline"></ha-icon>${st('marker.history_show')}</button>
      <button type="button" data-hp="vacuum-history-hide" class="btn ghostbtn" ?disabled=${!history.visible}
        @click=${()=>history.hide()}><ha-icon icon="mdi:eye-off-outline"></ha-icon>${st('marker.history_hide')}</button>
    </div>
    <div class="hpf-callout"><ha-icon icon="mdi:information-outline"></ha-icon><p>${st('marker.history_local')}</p></div>
    ${history.visible&&history.shown?html`<p class="vacuum-history-status" data-hp="vacuum-history-shown" role="status">
      ${st('marker.history_shown',{date:history.label(history.shown.id)})}</p>`:nothing}
    ${reason?html`<p class="rhint" data-hp="vacuum-history-reason" role="status">${st(`marker.history_${reason}`,{name:history.otherSpace})}</p>`:nothing}
    ${!history.loadingList&&!history.loadingShow&&history.catalog?.records.length!==0&&history.reason
      &&history.reason!=='interrupted'&&!history.unavailableReason?html`<button type="button" class="btn ghostbtn"
        data-hp="vacuum-history-retry" @click=${()=>void history.load()}>${st('marker.history_retry')}</button>`:nothing}
  </section>`;
}
