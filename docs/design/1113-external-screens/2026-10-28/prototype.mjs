// UI-002 / #1113. Local visual adapter; uses the release UI Kit, no HA screen control.
(() => {
  const storageKey = 'houseplan-ui-lab:1113:approved-visual-20261028:v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const read = () => { try { return JSON.parse(localStorage.getItem(storageKey)) || {next_id:1,screens:[]}; } catch { return {next_id:1,screens:[]}; } };
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const node = (tag, attrs = {}, text) => {
    const el = document.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (text, icon, action, extra = {}) => {
    const el = node('button',{type:'button',class:'btn ghost',...extra});
    if (icon) el.append(node('ha-icon',{icon}));
    if (text) el.append(document.createTextNode(text));
    el.addEventListener('click',event => { event.stopPropagation(); action(event); });
    return el;
  };
  const sessions = new WeakMap(), roots = new WeakSet(), runtimes = new WeakSet();
  const time = value => Number(value) === 0 ? 'Выключено' : Number(value) < 60 ? `${value} с` : `${Number(value)/60} мин`;
  const closeChild = async state => {
    const child = state.child; if (!child) return;
    state.child = null;
    await child.beginExit(); child.remove();
  };
  const writeDraft = state => {
    const card = state.card;
    card._settingsDialog = {...card._settingsDialog,_uiLabScreens:clone(state.draft)};
    renderRows(state);
  };
  const openConstructor = (state, existing) => {
    if (state.child || !existing && state.draft.screens.length >= 20) return;
    const value = existing ? clone(existing) : {id:state.draft.next_id,space:'',rotation:'0',cycle:'0',idle:'0',summary:'local',hidden_devices:'local',icon_scale:'local',font_scale:'local',controls:'show'};
    const child = node('hp-dialog',{'data-kind':'external-screen-constructor','form-shell':'','settings-layout':'','compact':'','wide':'',lang:'ru'});
    child.title = existing ? `Экран ${value.id}` : 'Новый экран';
    child.subtitle = 'Вид плана на телевизоре или планшете'; child.icon = 'mdi:monitor'; child.hass = state.card.hass;
    state.child = child;
    child.addEventListener('hp-close',event => { event.stopPropagation(); void closeChild(state); });
    const body = node('div',{class:'body hpf-form hpf-settings-form ui002-constructor'});
    body.innerHTML = '<div class="hpf-grid ui002-fields"></div>';
    const grid = body.querySelector('.hpf-grid');
    const controls = {}, hints = {};
    const choices = [['local','Как на основном плане'],['show','Показывать'],['hide','Скрывать']];
    const sizes = [['local','Как на основном плане'],...[50,75,100,125,150,175,200,250,300].map(x=>[String(x),`${x} %`])];
    const spaces = state.card._serverCfg?.spaces || [];
    const fields = [
      ['space','Пространства',[['','Все пространства'],...spaces.map(s=>[s.id,s.title || s.id])]],
      ['rotation','Поворот',[0,90,180,270].map(x=>[String(x),`${x}°`])],
      ['cycle','Автолистание',[0,10,30,60,120,300,600].map(x=>[String(x),time(x)])],
      ['idle','Возврат к «Вписать всё» после простоя',[0,30,60,120,300,600].map(x=>[String(x),time(x)])],
      ['summary','Сводная панель',choices],
      ['hidden_devices','Скрытые устройства',[['local','Как на основном плане'],['show','Показывать'],['hide','Не показывать']]],
      ['icon_scale','Размер значков',sizes],
      ['font_scale','Размер текста',sizes],
      ['controls','Кнопки поверх плана',[['show','Показывать'],['hide','Скрывать']]],
    ];
    const updateDependencies = () => {
      controls.cycle.disabled = value.space !== '';
      const cycling = value.space === '' && Number(value.cycle) > 0;
      controls.idle.disabled = cycling;
      hints.cycle.textContent = controls.cycle.disabled ? 'Доступно, когда выбраны все пространства.' : '';
      hints.idle.textContent = cycling ? 'При автолистании план вписывается после 60 с простоя.' : '';
      hints.cycle.hidden = !hints.cycle.textContent; hints.idle.hidden = !hints.idle.textContent;
    };
    for (const [key,label,options] of fields) {
      const field = node('div',{class:'hpf-field'});
      const labelRow = node('span',{class:'hpf-label hpf-labelrow'});
      labelRow.append(node('label',{for:`ui002-${key}`},label));
      if (key === 'controls' || key === 'idle') {
        const help = node('hp-help',{instant:''}); help.ariaLabel = `Подсказка: ${label}`;
        help.text = key === 'controls' ? 'Показывать или скрывать кнопки управления сводной панелью поверх плана. Жесты управления планом остаются доступны.' : 'После выбранного времени без действий план вернётся к масштабу «Вписать всё». При автолистании используется пауза 60 секунд.';
        labelRow.append(help);
      }
      const select = node('select',{id:`ui002-${key}`,class:'hpf-select','aria-label':label,'data-hp':'field','data-field':`external-screen-${key}`});
      const actualOptions = [...options];
      if (!actualOptions.some(([v])=>v===String(value[key]))) actualOptions.push([String(value[key]),key==='space'?'Пространство удалено':String(value[key])]);
      for (const [v,label] of actualOptions) { const option=node('option',{value:v},label); option.selected=v===String(value[key]); select.append(option); }
      select.addEventListener('change',()=>{ value[key]=select.value; updateDependencies(); });
      const wrap = node('hp-settings-select'); wrap.append(select);
      const hint = node('p',{class:'hpf-hint'}); hint.hidden = true;
      controls[key]=select; hints[key]=hint; field.append(labelRow,wrap,hint); grid.append(field);
    }
    updateDependencies();
    body.append(node('p',{class:'hpf-note hpf-hint ui002-draft-note'},'Изменения применятся после нажатия «Сохранить» в общих настройках.'));
    const footer=node('div',{slot:'footer',class:'row dialog-action-footer hpf-footer'});
    footer.append(node('span',{class:'spacer'}));
    const actions=node('div',{class:'dialog-action-group dialog-action-commit'});
    actions.append(button('Отмена',null,()=>void closeChild(state)),button('ОК',null,()=>{
      if (!state.card._settingsDialog) return;
      if (existing) state.draft.screens=state.draft.screens.map(item=>item.id===value.id?clone(value):item);
      else { state.draft.screens.push(clone(value)); state.draft.next_id++; }
      writeDraft(state); void closeChild(state);
    },{class:'btn on','data-hp':'external-screen-ok'}));
    footer.append(actions); child.append(body,footer); state.card.shadowRoot.append(child);
  };
  function renderRows(state) {
    const pane=state.pane;
    pane.replaceChildren();
    const card=node('section',{class:'hpf-card'}), header=node('div',{class:'hpf-head ui002-head'});
    header.append(node('h3',{},'Внешние экраны'));
    const body=node('div',{class:'hpf-body'});
    body.append(node('p',{class:'hpf-hint ui002-intro'},'Настройте отдельный вид плана для каждого телевизора или планшета. Откройте ссылку профиля на нужном экране.'));
    if (!state.draft.screens.length) {
      const empty=node('div',{class:'ui002-empty'}); empty.append(node('ha-icon',{icon:'mdi:monitor-dashboard'}),node('span',{},'Внешних экранов пока нет'),button('Создать',null,()=>openConstructor(state),{class:'btn on','data-hp':'external-screen-create'})); body.append(empty);
    } else {
      const list=node('div',{class:'ui002-list',role:'list','aria-label':'Внешние экраны'});
      for (const profile of state.draft.screens) {
        const row=node('div',{class:'ui002-row',role:'listitem'});
        const space=(state.card._serverCfg?.spaces || []).find(s=>s.id===profile.space);
        const title=profile.space ? space?.title || 'Пространство удалено' : 'Все пространства';
        const edit=button('',null,()=>openConstructor(state,profile),{class:'ui002-edit','aria-label':`Изменить Экран ${profile.id}`});
        edit.append(node('strong',{},`Экран ${profile.id}`),node('span',{},`${title} · ${profile.rotation}° · ${!profile.space && Number(profile.cycle)>0 ? `Листание: ${time(profile.cycle)}` : 'Без автолистания'}`));
        row.append(edit,button('', 'mdi:delete-outline',()=>{ state.draft.screens=state.draft.screens.filter(p=>p.id!==profile.id); writeDraft(state); },{class:'btn ghost ui002-icon','aria-label':`Удалить Экран ${profile.id}`,title:'Удалить'}));
        const link=node('div',{class:'ui002-link'}),input=node('input',{class:'hpf-input',readonly:'','aria-label':`Ссылка для экрана ${profile.id}`,value:`/houseplan?hpprofile=${profile.id}`});
        input.addEventListener('click',()=>input.select());
        const copy=button('', 'mdi:content-copy',async()=>{ await navigator.clipboard.writeText(new URL(input.value,location.origin).href); copy.setAttribute('aria-label','Ссылка скопирована'); copy.querySelector('ha-icon').setAttribute('icon','mdi:check'); },{class:'btn ghost ui002-icon','aria-label':`Скопировать ссылку экрана ${profile.id}`,title:'Скопировать'});
        link.append(input,copy);row.append(link);
        if(profile.space&&!space)row.append(node('p',{class:'hpf-error'},'Пространство удалено. Выберите другое в настройках экрана.'));
        list.append(row);
      }
      body.append(list);
    }
    if(state.draft.screens.length){
      const addBottom=button('Добавить','mdi:plus',()=>openConstructor(state),{'data-hp':'external-screen-add-bottom'});addBottom.disabled=state.draft.screens.length>=20;
      body.append(addBottom);
      if(addBottom.disabled)body.append(node('p',{class:'hpf-hint'},'Можно создать не больше 20 профилей экранов.'));
    }
    card.append(header,body); pane.append(card);
  }
  const selectPane = (state,active) => {
    state.active=active;
    if (active) {
      for(const pane of state.dialog.querySelectorAll('.hpf-settings-pane')) if(pane.hidden !== (pane!==state.pane))pane.hidden=pane!==state.pane;
      for(const btn of state.dialog.querySelectorAll('.hpf-settings-nav button')){
        if(btn===state.navButton) { if(btn.getAttribute('aria-current')!=='page')btn.setAttribute('aria-current','page'); }
        else if(btn.hasAttribute('aria-current'))btn.removeAttribute('aria-current');
      }
      const mobile=state.dialog.querySelector('.hpf-settings-mobile select');
      if(mobile && mobile.value!=='external-screens'){mobile.value='external-screens';mobile.dispatchEvent(new Event('change',{bubbles:true}));}
    } else {state.pane.hidden=true;state.navButton.removeAttribute('aria-current');}
  };
  const installDialog = (card,dialog) => {
    if(sessions.has(dialog))return;
    const nav=dialog.querySelector('.hpf-settings-nav'),content=dialog.querySelector('.hpf-settings-content');
    if(!nav || !content)return;
    const state={card,dialog,draft:read(),active:false,child:null};sessions.set(dialog,state);
    const runtime=card._editorRuntime;
    if(runtime&&!runtimes.has(runtime)){
      runtimes.add(runtime);const save=runtime._saveSettingsDialog.bind(runtime);
      runtime._saveSettingsDialog=async(options={})=>{
        const draft=card._settingsDialog?._uiLabScreens;
        const owner=card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
        // Keep the shell until ACK, then let the shared dialogPresence animate its exit.
        // The stock Save path marks this exit as immediate; keepOpen avoids that marker.
        const result=await save({...options,keepOpen:true});
        if(result&&draft)localStorage.setItem(storageKey,JSON.stringify(draft));
        if(result&&!options.keepOpen&&card._settingsDialog&&owner===card.renderRoot.querySelector('hp-dialog[data-kind="settings"]')){
          card._settingsDialog=null;
          card.requestUpdate();
        }
        return result;
      };
    }
    state.navButton=button('Внешние экраны',null,()=>{dialog.closeTransientOverlays('exclusive');selectPane(state,true);},{'data-hp':'ui002-section','data-section':'external-screens','data-section-target':'external-screens'});
    state.navButton.removeAttribute('class');
    nav.insertBefore(state.navButton,nav.querySelector('[data-section="data"]'));
    state.pane=node('section',{class:'hpf-settings-pane','data-settings-section':'external-screens','aria-label':'Внешние экраны',hidden:''});content.append(state.pane);
    const mobile=dialog.querySelector('.hpf-settings-mobile select');
    if(mobile){mobile.append(node('option',{value:'external-screens'},'Внешние экраны'));mobile.addEventListener('change',event=>{if(mobile.value==='external-screens'){event.stopImmediatePropagation();selectPane(state,true);}else selectPane(state,false);},true);}
    nav.addEventListener('click',event=>{const target=event.target.closest('button');if(target&&target!==state.navButton)selectPane(state,false);},true);
    renderRows(state);
  };
  const installRoot = card => {
    const root=card?.shadowRoot;if(!root||roots.has(root))return;roots.add(root);
    const style=node('style');style.textContent=`
      .ui002-head{display:flex;align-items:center;justify-content:space-between}.ui002-head h3{flex:1}
      .ui002-icon{min-width:44px!important;min-height:44px!important;justify-content:center;padding:10px!important}
      .ui002-intro{margin:0 0 18px!important}.ui002-empty{display:flex;flex-direction:column;align-items:center;gap:18px;padding:38px 16px 44px;color:var(--secondary-text-color)}
      .ui002-empty>ha-icon{--mdc-icon-size:38px;opacity:.65}.ui002-list{display:grid;gap:12px;margin-bottom:16px}
      .ui002-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:6px 12px;padding:12px;border:1px solid var(--hpf-line,var(--divider-color));border-radius:10px}
      .ui002-edit{display:grid;gap:7px;text-align:left;min-height:44px;border:0;background:transparent;color:var(--primary-text-color);font:inherit;cursor:pointer;padding:6px;border-radius:7px;transition:background 160ms}
      .ui002-edit:hover{background:var(--hpf-tint,#8882)}.ui002-edit:focus-visible{outline:2px solid var(--primary-color)}.ui002-edit span{font-size:13px;color:var(--secondary-text-color);line-height:1.5}
      .ui002-link{grid-column:1/-1;display:flex;align-items:center;gap:8px}.ui002-link input{flex:1;min-width:0;font-size:13px}
      .ui002-fields{align-items:start;gap:20px 24px}.ui002-fields .hpf-label{min-height:22px}.ui002-draft-note{margin:24px 0 0!important}
      hp-dialog[data-kind="external-screen-constructor"] .hpf-form.ui002-constructor{padding:20px!important}
      .ui002-row .hpf-error{grid-column:1/-1}
      @media(max-width:550px){.ui002-fields{grid-template-columns:1fr}.ui002-row{padding:8px}}
    `;root.append(style);
    const scan=()=>{
      for(const dialog of root.querySelectorAll('hp-dialog[data-kind="settings"]')){
        installDialog(card,dialog);const state=sessions.get(dialog);
        if(state?.active)selectPane(state,true);
      }
      for(const child of root.querySelectorAll('hp-dialog[data-kind="external-screen-constructor"]'))if(!card._settingsDialog)child.remove();
    };
    new MutationObserver(scan).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-current']});scan();
  };
  const panel=document.querySelector('houseplan-panel');
  if(panel?.shadowRoot){const scan=()=>installRoot(panel.shadowRoot.querySelector('houseplan-card'));new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});scan();}
})();
