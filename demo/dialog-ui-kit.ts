/** Developer gallery: the actual dialog kit with synthetic data (#1007). */
import { LitElement, html, nothing } from 'lit';
import '../src/hp-dialog';
import '../src/hp-help';
import '../src/hp-settings-select';
import { ensureSettingsDialogStyles } from '../src/editors/settings-styles';
import { settingsActionsCss } from '../src/styles/settings-action.styles';
import { actionHelp, callout, disclosure, field, formCard, formSections, toggleRow, selectControl } from '../src/editors/form-kit';
class DialogKitGallery extends LitElement {
  static properties = { hiddenSection:{state:true}, reversed:{state:true}, checked:{state:true}, value:{state:true} };
  hiddenSection=false;
  reversed=false;
  checked=false;
  value='first';
  connectedCallback() { super.connectedCallback(); ensureSettingsDialogStyles(this); }
  render() {
    const help=html`<hp-help instant data-pointer-hover text="Общее пояснение настройки" aria-label="Помощь"></hp-help>`;
    const sections=[
      field({label:'Источник данных',htmlFor:'kit-source',control:html`<input id="kit-source" class="hpf-input" value="Датчик гостиной" />`}),
      this.hiddenSection ? nothing : field({label:'Условное поле',control:html`<input data-kit="conditional" class="hpf-input" value="21.5" />`}),
      toggleRow({id:'kit-toggle',title:'Очень длинное название настройки, которое занимает несколько строк на узком экране',caption:'Пояснение под настройкой',checked:this.checked,help,onChange:v=>{this.checked=v;}}),
      field({label:'Режим работы',control:selectControl({name:'kit-select',value:this.value,ariaLabel:'Режим работы',
        options:[{value:'first',label:'Первый вариант'},{value:'second',label:'Второй вариант'}],onChange:v=>{this.value=v;}})}),
      disclosure({title:'Диагностика',content:html`<p data-kit="diagnostics">Данные устройства доступны</p>`}),
      disclosure({title:'Источник и показ пути',triggerClass:'btn',className:'kit-picker',help,content:html`<button class="btn" data-kit="pick">Выбрать источник</button>`}),
      html`<div class="hpf-actions">${actionHelp(html`<button class="btn" data-kit="action" @click=${()=>{this.value='action';}}>Проверить</button>`,help)}
        <button class="btn" disabled>Недоступно</button><button class="btn on" aria-busy="true">Сохранение…</button></div>`,
      callout({text:'Общая информационная плашка'}),
    ];
    return html`<style>${settingsActionsCss(':is(.hpf-form,.hpf-footer) .btn')}
      .hpf-settings-content{padding:20px}.hpf-form{font:13px/22px Roboto,Arial,sans-serif}
      .hpf-footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 16px}
    </style><hp-dialog settings-layout wide form-shell title="Общий UI-кит" subtitle="Обезличенные примеры" .hass=${(window as Window & {__card?:{hass:unknown}}).__card?.hass}>
      <div class="body hpf-form hpf-settings-form"><section class="hpf-settings-pane"><div class="hpf-settings-content">
        ${formCard({title:'Типовые настройки',body:formSections(this.reversed?[...sections].reverse():sections)})}
      </div></section></div>
      <div class="hpf-footer" slot="footer"><button class="btn" @click=${()=>{this.hiddenSection=!this.hiddenSection;}}>Скрыть поле</button>
        <button class="btn" @click=${()=>{this.reversed=!this.reversed;}}>Поменять порядок</button><button class="btn on">Сохранить</button></div>
    </hp-dialog>`;
  }
}
customElements.define('hp-dialog-kit-gallery',DialogKitGallery);
document.body.append(document.createElement('hp-dialog-kit-gallery'));
