// Local visual draft for issue #1000. No alarm evaluation or HA writes.
// Uses the product's hp-dialog, hp-settings-select and shared hpf form kit.
(async () => {
  while (!window.__lab?.card?.shadowRoot) await new Promise(resolve => setTimeout(resolve, 100));
  const card = window.__lab.card;
  const root = card.shadowRoot;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const operators = [['eq','равно','='],['ne','не равно','≠'],['gt','больше','>'],['lt','меньше','<'],['gte','больше или равно','≥'],['lte','меньше или равно','≤']];
  const labels = {state:'Состояние',battery:'Заряд батареи',battery_level:'Заряд батареи',temperature:'Температура',current_temperature:'Текущая температура',humidity:'Влажность',brightness:'Яркость',power:'Мощность',energy:'Энергия',voltage:'Напряжение',linkquality:'Качество связи',unit_of_measurement:'Единица измерения',device_class:'Класс устройства',friendly_name:'Название'};
  const sessions = new WeakMap();
  const style = document.createElement('style');
  style.dataset.prototype = '1000';
  style.textContent = `
    [data-settings-section="alarms"] .alarm-heading {display:flex;align-items:center;justify-content:space-between;gap:12px}
    [data-settings-section="alarms"] .alarm-heading h3 {margin:0}
    [data-settings-section="alarms"] .alarm-add {display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;min-width:40px;padding:0;border:1px dashed var(--hpf-tint-line,var(--primary-color));border-radius:8px;color:var(--hpf-accent,var(--primary-color));background:var(--hpf-tint,transparent);cursor:pointer}
    [data-settings-section="alarms"] .alarm-add ha-icon {--mdc-icon-size:22px}
    [data-settings-section="alarms"] .alarm-table {width:100%;border-collapse:collapse;font-size:14px}
    [data-settings-section="alarms"] .alarm-table th {padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:var(--secondary-text-color);border-bottom:1px solid var(--hpf-line,var(--divider-color))}
    [data-settings-section="alarms"] .alarm-table td {padding:12px;border-bottom:1px solid var(--hpf-line,var(--divider-color));vertical-align:middle}
    [data-settings-section="alarms"] .alarm-table tr:last-child td {border-bottom:0}
    [data-settings-section="alarms"] .alarm-table .alarm-empty {height:150px;text-align:center;color:var(--secondary-text-color)}
    [data-settings-section="alarms"] .alarm-empty-content {display:grid;justify-items:center;gap:14px}
    [data-settings-section="alarms"] .alarm-create {min-height:36px;padding:8px 16px}
    [data-settings-section="alarms"] .alarm-condition {display:grid;gap:4px}
    [data-settings-section="alarms"] .alarm-condition small {font-size:12px;color:var(--secondary-text-color);overflow-wrap:anywhere}
    [data-settings-section="alarms"] .alarm-remove {display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--error-color,#db4437);cursor:pointer}
    [data-settings-section="alarms"] .alarm-remove:hover {background:color-mix(in srgb,var(--error-color,#db4437) 10%,transparent)}
    [data-settings-section="alarms"] .alarm-remove ha-icon {--mdc-icon-size:19px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-source-field {grid-column:1/-1}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome {display:grid;gap:8px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome-heading {display:flex;align-items:center;gap:8px;line-height:20px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome-heading ha-icon {display:inline-flex;align-items:center;flex:none;margin:0;--mdc-icon-size:16px;color:var(--hpf-accent)}
  `;
  root.append(style);

  function deviceContext() {
    const draft = card._markerDialog || {};
    const device = card._devices?.find(item => item.id === draft.devId || item.marker?.id === draft.devId);
    const binding = draft.binding || device?.marker?.binding || '';
    const hass = card.hass || window.__lab.mock.hass;
    const states = hass.states || {};
    const entityIds = new Set(device?.entities || []);
    if (device?.primary) entityIds.add(device.primary);
    if (binding.startsWith('entity:')) entityIds.add(binding.slice(7));
    if (binding.startsWith('device:')) {
      const id = binding.slice(7);
      for (const [entityId, entry] of Object.entries(hass.entities || {})) if (entry.device_id === id) entityIds.add(entry.entity_id || entityId);
    }
    const sources = [];
    for (const entityId of entityIds) {
      const state = states[entityId];
      if (!state) continue;
      const name = state.attributes?.friendly_name || entityId;
      sources.push({key:entityId+'|state',entityId,attribute:null,label: name+' · Состояние',shortLabel:'Состояние',value:state.state});
      for (const [attribute,value] of Object.entries(state.attributes || {})) {
        if (value !== null && ['string','number','boolean'].includes(typeof value)) sources.push({key:entityId+'|'+attribute,entityId,attribute,label:name+' · '+(labels[attribute] || attribute),shortLabel:labels[attribute] || attribute,value});
      }
    }
    return {key:draft.devId || binding || 'new-device',name:draft.name || device?.name || 'Устройство',sources,hass};
  }

  const readAlarms = key => {
    try { const value = JSON.parse(localStorage.getItem('ui-lab:prototype:1000:'+key) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const saveAlarms = (key,value) => {
    try { localStorage.setItem('ui-lab:prototype:1000:'+key,JSON.stringify(value)); } catch {}
  };

  function renderRows(session) {
    const rows = readAlarms(session.key);
    session.pane.querySelector('tbody').innerHTML = rows.length ? rows.map((alarm,index) => {
      const operator = operators.find(item => item[0] === alarm.operator)?.[2] || '=';
      return `<tr><td><div class="alarm-condition"><span>${esc(alarm.shortLabel)} <strong>${esc(operator)}</strong> ${esc(alarm.value)}</span><small>${esc(alarm.entityId)}${alarm.attribute ? ' · '+esc(alarm.attribute) : ''}</small></div></td><td>Включить тревогу</td><td><button type="button" class="alarm-remove" data-remove="${index}" aria-label="Удалить тревогу" title="Удалить тревогу"><ha-icon icon="mdi:delete-outline"></ha-icon></button></td></tr>`;
    }).join('') : '<tr><td colspan="3" class="alarm-empty"><div class="alarm-empty-content"><span>Тревог пока нет</span><button type="button" class="btn on alarm-create" data-create-alarm>Создать</button></div></td></tr>';
  }

  function openConstructor(session) {
    if (root.querySelector('hp-dialog[data-kind="alarm-constructor"]')) return;
    const context = deviceContext();
    const modal = document.createElement('hp-dialog');
    modal.dataset.kind = 'alarm-constructor';
    modal.title = 'Новая тревога';
    modal.subtitle = context.name;
    modal.hass = context.hass;
    modal.className = 'ui-dialog';
    modal.setAttribute('form-shell','');
    modal.setAttribute('settings-layout','');
    modal.setAttribute('compact','');
    modal.setAttribute('wide','');
    modal.setAttribute('lang','ru');
    modal.setAttribute('icon','mdi:bell-alert-outline');
    modal.innerHTML = `<div class="body hpf-form hpf-settings-form"><div class="hpf-sections hpf-sections-plain">
      <div class="hpf-section"><section class="hpf-card"><div class="hpf-head"><h3>Если</h3></div><div class="hpf-body"><div class="hpf-grid">
        <div class="hpf-field alarm-source-field"><span class="hpf-label hpf-labelrow"><label for="alarm-source-1000">Значение устройства</label></span><hp-settings-select><select id="alarm-source-1000" class="hpf-select" aria-label="Значение устройства">${context.sources.map(source=>`<option value="${esc(source.key)}">${esc(source.label)}</option>`).join('') || '<option value="">Нет доступных значений</option>'}</select></hp-settings-select><p class="hpf-hint alarm-current"></p></div>
        <div class="hpf-field"><span class="hpf-label hpf-labelrow"><label for="alarm-operator-1000">Условие</label><hp-help instant data-alarm-condition-help></hp-help></span><hp-settings-select><select id="alarm-operator-1000" class="hpf-select" aria-label="Условие">${operators.map(([value,label,symbol])=>`<option value="${value}">${symbol} ${label}</option>`).join('')}</select></hp-settings-select></div>
        <div class="hpf-field"><span class="hpf-label hpf-labelrow"><label for="alarm-value-1000">Значение</label></span><input id="alarm-value-1000" class="hpf-input" type="text" autocomplete="off" placeholder="Введите значение" aria-label="Значение"><p class="hpf-error" hidden>Введите значение</p></div>
      </div></div></section></div>
      <div class="hpf-section"><div class="hpf-callout alarm-outcome"><div class="alarm-outcome-heading"><ha-icon icon="mdi:bell-alert-outline"></ha-icon><span>Включится тревога</span></div><p class="hpf-hint">Когда условие выполнится, значок устройства на плане будет выделен красным и начнёт пульсировать, чтобы тревогу было видно издалека. В карточке устройства появится причина тревоги с текущим значением и заданным условием. Тревога также будет учитываться в карточке комнаты и сводной панели. После завершения тревоги устройство вернётся к обычному отображению.</p></div></div>
    </div></div><div slot="footer" class="row dialog-action-footer hpf-footer"><span class="spacer"></span><div class="dialog-action-group dialog-action-commit"><button type="button" class="btn ghost" data-alarm-cancel>Отмена</button><button type="button" class="btn on" data-alarm-ok>OK</button></div></div>`;
    const conditionHelp = modal.querySelector('[data-alarm-condition-help]');
    conditionHelp.ariaLabel = 'Как работают условия тревоги';
    conditionHelp.text = 'Условие сравнивает выбранное значение устройства со значением, которое вы указали.\n\nЧисла сравниваются по величине: 10 больше 2. Дробная часть тоже учитывается: например, 22.5 больше 22.\n\nДля текста используйте «равно» или «не равно»: например, состояние «on» равно «on» и не равно «off». Операторы «больше» и «меньше» предназначены для чисел.\n\n«Больше или равно» и «меньше или равно» включают саму границу. Например, при условии «больше или равно 25» значение 25 тоже подходит.';
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await modal.beginExit();
      modal.remove();
    };
    modal.addEventListener('hp-close',event=>{event.stopPropagation();close();});
    modal.querySelector('[data-alarm-cancel]').onclick = close;
    const sourceSelect = modal.querySelector('#alarm-source-1000');
    const valueInput = modal.querySelector('#alarm-value-1000');
    const updateCurrent = () => {
      const source = context.sources.find(item => item.key === sourceSelect.value);
      modal.querySelector('.alarm-current').textContent = source ? 'Сейчас: '+source.value : '';
      valueInput.inputMode = typeof source?.value === 'number' ? 'decimal' : 'text';
    };
    sourceSelect.addEventListener('change',updateCurrent);
    updateCurrent();
    modal.querySelector('[data-alarm-ok]').onclick = () => {
      const source = context.sources.find(item => item.key === sourceSelect.value);
      const value = valueInput.value.trim();
      if (!source || !value) { modal.querySelector('.hpf-error').hidden = false; valueInput.focus(); return; }
      const rows = readAlarms(session.key);
      rows.push({entityId:source.entityId,attribute:source.attribute,shortLabel:source.shortLabel,operator:modal.querySelector('#alarm-operator-1000').value,value});
      saveAlarms(session.key,rows);renderRows(session);close();
    };
    root.append(modal);
  }

  function attach(dialog) {
    if (sessions.has(dialog)) return;
    const nav = dialog.querySelector('.hpf-settings-nav');
    const content = dialog.querySelector('.hpf-settings-content');
    if (!nav || !content) return;
    const context = deviceContext();
    const button = document.createElement('button');
    button.type = 'button';button.dataset.hp = 'settings-section';button.dataset.kind = 'marker';button.dataset.section = 'alarms';button.dataset.sectionTarget = 'alarms';button.textContent = 'Тревоги устройства';
    const pane = document.createElement('section');
    pane.className = 'hpf-settings-pane';pane.dataset.settingsSection = 'alarms';pane.setAttribute('aria-label','Тревоги устройства');pane.hidden = true;
    pane.innerHTML = '<section class="hpf-card"><div class="hpf-head alarm-heading"><h3>Тревоги устройства</h3><button type="button" class="alarm-add" aria-label="Добавить тревогу" title="Добавить тревогу"><ha-icon icon="mdi:plus"></ha-icon></button></div><div class="hpf-body"><table class="alarm-table"><thead><tr><th>Условие</th><th>Действие</th><th style="width:36px"></th></tr></thead><tbody></tbody></table></div></section>';
    const session = {key:context.key,pane,button,active:false};sessions.set(dialog,session);
    const mobile = dialog.querySelector('.hpf-settings-mobile select');
    if (mobile) {const option = document.createElement('option');option.value='alarms';option.textContent='Тревоги устройства';mobile.append(option);}
    nav.append(document.createElement('hr'),button);content.append(pane);
    const select = id => {
      session.active = id === 'alarms';
      for (const section of content.querySelectorAll(':scope > .hpf-settings-pane')) section.hidden = section.dataset.settingsSection !== id;
      for (const item of nav.querySelectorAll('button[data-section]')) { if(item.dataset.section===id)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current'); }
      if (mobile) mobile.value = id;
    };
    button.onclick = event => {event.stopPropagation();select('alarms');};
    nav.addEventListener('click',event=>{const target=event.target.closest('button[data-section]');if(target && target!==button)select(target.dataset.section);},true);
    if (mobile) mobile.addEventListener('change',event=>{if(mobile.value==='alarms'){event.stopImmediatePropagation();select('alarms');}else select(mobile.value);},true);
    pane.querySelector('.alarm-add').onclick = () => openConstructor(session);
    pane.addEventListener('click',event=>{if(event.target.closest('[data-create-alarm]')){openConstructor(session);return;}const remove=event.target.closest('[data-remove]');if(!remove)return;const rows=readAlarms(session.key);rows.splice(Number(remove.dataset.remove),1);saveAlarms(session.key,rows);renderRows(session);});
    renderRows(session);
  }
  const scan = () => {for(const dialog of root.querySelectorAll('hp-dialog[data-kind="marker"]'))attach(dialog);};
  new MutationObserver(scan).observe(root,{childList:true,subtree:true});
  scan();
})();
