globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="18017b17d2d02066abdb401fbaad086c518898a165c41b2067350706d60f77e7";import{A as e,b as t,l as s,e3 as a,bb as i,ba as r,c as o}from"./houseplan-card-4LsBDF5O.js";const n=Object.freeze({blocks:10,values:20,title:48,label:64}),l=e=>"string"==typeof e?e.trim():"",m=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),u=e=>!!e&&"object"==typeof e;function c(e){return`${e}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`}function h(e){return{version:1,title:e("summary.default_title"),show_on_mobile:!0,blocks:[{id:"summary-default",title:e("summary.default_block"),visible:!0,scope:{type:"all"},values:[{id:"summary-device-count",label:e("summary.system.device_count"),source:{type:"system",key:"device_count"}},{id:"summary-total-area",label:e("summary.system.total_area"),source:{type:"system",key:"total_area"}},{id:"summary-datetime",label:e("summary.system.datetime"),source:{type:"system",key:"datetime"}}]}]}}function d(e){if(!u(e))return!1;const t=e;return!(1!==t.version||"string"!=typeof t.title||"boolean"!=typeof t.show_on_mobile||!Array.isArray(t.blocks))&&t.blocks.every(e=>{if(!u(e)||"string"!=typeof e.id||"string"!=typeof e.title||"boolean"!=typeof e.visible||!u(e.scope)||!Array.isArray(e.values))return!1;const t=e.scope;return("all"===t.type||"space"===t.type&&"string"==typeof t.space_id)&&e.values.every(e=>{if(!u(e)||"string"!=typeof e.id||"string"!=typeof e.label||!u(e.source))return!1;const t=e.source;return"entity"===t.type&&"string"==typeof t.entity_id||"system"===t.type&&"string"==typeof t.key&&["device_count","total_area","datetime"].includes(t.key)})})}function y(e){return structuredClone(e)}function p(e,t){return e.blocks.filter(e=>e.visible&&("all"===e.scope.type||"space"===e.scope.type&&e.scope.space_id===t))}function g(e,t,s,a){const i=[],r=function(e){const t=new Map,s=new Map;for(const a of e?.blocks||[]){"space"===a.scope.type&&t.set(a.id,a.scope.space_id);for(const e of a.values)"entity"===e.source.type&&s.set(e.id,e.source.entity_id)}return{scopes:t,sources:s}}(t),o=new Set,m=new Set,u=(e,t,s)=>{const a=l(e);a?(e=>[...e].length)(a)>t&&i.push({path:s,kind:"error",code:"limit"}):i.push({path:s,kind:"error",code:"required"})};return u(e.title,n.title,"title"),e.blocks.length>n.blocks&&i.push({path:"blocks",kind:"error",code:"limit"}),e.blocks.forEach((e,t)=>{const c=`blocks.${t}`;if(u(e.id,n.label,`${c}.id`),u(e.title,n.title,`${c}.title`),o.has(e.id)&&i.push({path:`${c}.id`,kind:"error",code:"duplicate_id"}),o.add(e.id),"space"===e.scope.type){const t=l(e.scope.space_id);t?s.has(t)||i.push({path:`${c}.scope`,kind:r.scopes.get(e.id)===t?"warning":"error",code:"missing_space"}):i.push({path:`${c}.scope`,kind:"error",code:"required"})}else"all"!==e.scope.type&&i.push({path:`${c}.scope`,kind:"error",code:"required"});e.values.length>n.values&&i.push({path:`${c}.values`,kind:"error",code:"limit"}),e.values.forEach((e,t)=>{const s=`${c}.values.${t}`;if(u(e.id,n.label,`${s}.id`),u(e.label,n.label,`${s}.label`),m.has(e.id)&&i.push({path:`${s}.id`,kind:"error",code:"duplicate_id"}),m.add(e.id),"entity"===e.source.type){const t=l(e.source.entity_id);t?a.has(t)||i.push({path:`${s}.source`,kind:r.sources.get(e.id)===t?"warning":"error",code:"missing_entity"}):i.push({path:`${s}.source`,kind:"error",code:"required"})}else"system"===e.source.type&&["device_count","total_area","datetime"].includes(e.source.key)||i.push({path:`${s}.source`,kind:"error",code:"invalid_source"})})}),i}function b(e){return{...e,version:1,title:l(e.title),show_on_mobile:!1!==e.show_on_mobile,blocks:e.blocks.map(e=>({...e,id:l(e.id),title:l(e.title),visible:!1!==e.visible,scope:"space"===e.scope.type?{...e.scope,type:"space",space_id:l(e.scope.space_id)}:{...e.scope,type:"all"},values:e.values.map(e=>({...e,id:l(e.id),label:l(e.label),source:"entity"===e.source.type?{...e.source,type:"entity",entity_id:l(e.source.entity_id)}:{...e.source,type:"system",key:e.source.key}}))}))}}function f(e){const t=e.showOnMobile||!1===e.narrow;return e.view&&e.localShow&&t&&e.fits}function _(e){const t=Number(e);return Number.isFinite(t)?Math.max(.5,Math.min(3,Math.round(20*t)/20)):1}function v(e,t){return JSON.stringify(e)===JSON.stringify(t)}function w(e,t,s){if(t<0||t>=e.length||s<0||s>=e.length||t===s)return[...e];const a=[...e],[i]=a.splice(t,1);return a.splice(s,0,i),a}function k(e){return{id:c("b"),title:e("summary.new_block"),visible:!0,scope:{type:"all"},values:[]}}function x(e){return{id:c("v"),label:"",source:{type:"entity",entity_id:""}}}const S=String.raw`
  .summary-control {
    display: inline-flex;
    flex: 0 0 auto;
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    overflow: hidden;
    background: var(--card-background-color, #fff);
  }
  .summary-control > button {
    width: 46px;
    height: 46px;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-right: 1px solid var(--divider-color);
    color: var(--primary-text-color);
    background: transparent;
    cursor: pointer;
  }
  .summary-control > button:last-child { border-right: 0; }
  .summary-control > button.on {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color);
  }
  .summary-control > button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -3px;
  }
  .summary-control ha-icon { --mdc-icon-size: 21px; }
  .summary-control.kiosk {
    position: absolute;
    z-index: 31;
    top: calc(12px + env(safe-area-inset-top));
    right: calc(12px + env(safe-area-inset-right));
    box-shadow: 0 4px 14px rgb(0 0 0 / 22%);
  }
  .summary-overlay,
  .summary-measure {
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.35;
    color: var(--primary-text-color);
    background: color-mix(in srgb, var(--card-background-color, #fff) 94%, transparent);
    border: 1px solid var(--divider-color);
    border-radius: 16px;
    box-shadow: 0 8px 28px rgb(0 0 0 / 24%);
  }
  .summary-overlay {
    position: absolute;
    z-index: 24;
    display: flex;
    flex-direction: column;
    min-width: 280px;
    max-height: var(--summary-height-cap);
    overflow: hidden;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    pointer-events: auto;
    touch-action: pan-y;
  }
  .summary-overlay.right {
    top: var(--summary-top);
    right: calc(12px + env(safe-area-inset-right));
    bottom: var(--summary-bottom);
    width: clamp(280px, 31cqw, 420px);
    max-width: var(--summary-width-cap);
    animation: hp-summary-in-right 190ms ease-out;
  }
  .summary-overlay.bottom {
    right: auto;
    bottom: var(--summary-bottom);
    left: 50%;
    width: max-content;
    min-width: min(360px, var(--summary-width-cap));
    max-width: var(--summary-width-cap);
    transform: translateX(-50%);
    animation: hp-summary-in-bottom 190ms ease-out;
  }
  .summary-overlay h2,
  .summary-measure h2 {
    margin: 0;
    padding: 14px 16px 12px;
    font-size: 1.16em;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .summary-scroll {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0 10px 12px;
  }
  .summary-block,
  .summary-measure section {
    margin: 0 0 9px;
    padding: 10px;
    border-radius: 11px;
    background: var(--secondary-background-color);
  }
  .summary-block:last-child { margin-bottom: 0; }
  .summary-block h3,
  .summary-measure h3 {
    margin: 0 0 7px;
    font-size: 1em;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .summary-value {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(min-content, auto);
    gap: 10px;
    align-items: baseline;
    padding: 4px 0;
  }
  .summary-value span,
  .summary-value strong { min-width: 0; overflow-wrap: anywhere; }
  .summary-value strong { text-align: right; font-weight: 600; }
  .summary-empty { padding: 8px 0; color: var(--secondary-text-color); }
  .summary-measure {
    position: fixed;
    z-index: -1;
    top: -10000px;
    left: -10000px;
    width: 280px;
    visibility: hidden;
    pointer-events: none;
  }
  .summary-safe-probe {
    position: fixed;
    z-index: -1;
    top: -10000px;
    left: -10000px;
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
      env(safe-area-inset-bottom) env(safe-area-inset-left);
    visibility: hidden;
    pointer-events: none;
  }
  .summary-measure section { margin: 0 10px 12px; }
  @keyframes hp-summary-in-right {
    from { opacity: 0; translate: 10px 0; }
    to { opacity: 1; translate: 0 0; }
  }
  @keyframes hp-summary-in-bottom {
    from { opacity: 0; translate: 0 10px; }
    to { opacity: 1; translate: 0 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .summary-overlay { animation: none; }
  }

  .summary-editor { min-width: min(640px, calc(100vw - 56px)); }
  .summary-editor > label:not(.summary-switch) {
    display: block;
    margin: 12px 0 5px;
    font-weight: 600;
  }
  .summary-editor input[type='text'],
  .summary-editor input[type='search'],
  .summary-editor select {
    box-sizing: border-box;
    min-width: 0;
    min-height: 44px;
    padding: 7px 9px;
    color: var(--primary-text-color);
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
  }
  .summary-editor input[type='text'],
  .summary-editor input[type='search'] { width: 100%; }
  .summary-editor [aria-invalid='true'] { border-color: var(--error-color, #db4437); }
  .summary-switch {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    gap: 8px;
    margin: 8px 0;
  }
  .summary-switch input { width: 18px; height: 18px; }
  .summary-editor input[type='range'] { min-height: 44px; }
  .summary-editor button,
  hp-dialog > .row[slot='footer'] button { min-height: 44px; }
  .summary-local-sizes {
    display: grid;
    grid-template-columns: max-content minmax(140px, 1fr) 48px;
    gap: 8px 14px;
    align-items: center;
  }
  .summary-sizes-title { margin: 14px 0 8px; font-size: 1em; }
  .summary-size-reset { grid-column: 1 / -1; justify-self: start; }
  .summary-editor-blocks { display: grid; gap: 12px; margin-top: 10px; }
  .summary-editor-block {
    padding: 12px;
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    background: var(--secondary-background-color);
  }
  .summary-editor-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
  .summary-block-head { flex-wrap: nowrap; }
  .summary-block-head input { flex: 1 1 180px; }
  .summary-editor-row button {
    min-width: 44px;
    height: 44px;
    padding: 0 7px;
    border: 0;
    border-radius: 7px;
    color: var(--primary-text-color);
    background: var(--card-background-color, #fff);
    cursor: pointer;
  }
  .summary-editor-row button:disabled { opacity: .4; cursor: default; }
  .summary-drag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 44px;
    color: var(--secondary-text-color);
    cursor: grab;
    letter-spacing: -4px;
  }
  .summary-editor-values { display: grid; gap: 8px; margin-top: 10px; }
  .summary-editor-value { padding-top: 8px; border-top: 1px solid var(--divider-color); }
  .summary-editor-value input { flex: 1 1 180px; }
  .summary-source { width: 100%; margin-top: 7px; }
  .summary-problem { margin: 5px 0; font-size: .9em; }
  .summary-problem.error { color: var(--error-color, #db4437); }
  .summary-problem.warning { color: var(--warning-color, #f59e0b); }
  .summary-add { margin-top: 9px; }
  .summary-reload { margin-top: 8px; }
  @media (max-width: 600px) {
    .summary-editor { min-width: 0; width: calc(100vw - 44px); }
    .summary-block-head { flex-wrap: wrap; }
    .summary-block-head input { order: -1; flex-basis: 100%; }
  }`,$={en:{"summary.default_title":"Summary","summary.default_block":"General","summary.system.device_count":"Device count","summary.system.total_area":"Total room area","summary.system.datetime":"Date and time","summary.new_block":"New block","summary.value_name":"Value name","summary.delete_block_title":"Delete block?","summary.delete_block_body":"This block contains values. It will be removed from the draft.","summary.save_failed":"Could not save the summary panel.","summary.conflict":"The configuration changed in another window. Load the current version to start again.","summary.reload_current":"Load current configuration","summary.unavailable":"Source unavailable","summary.empty_block":"No values in this block","summary.empty_space":"No values for this space","summary.measure_block":"Block","summary.measure_label":"Status","summary.controls":"Summary panel controls","summary.settings":"Summary panel settings","summary.show":"Show summary panel","summary.hide":"Hide summary panel","summary.hidden_mobile":"The panel is enabled locally but disabled on mobile","summary.hidden_narrow_unknown":"The panel is enabled locally and is waiting for Home Assistant to report the screen mode","summary.hidden_small":"The panel is enabled locally but this card is too small","summary.show_local":"Show panel on this card","summary.backend_required":"Update the House Plan integration to edit shared panel contents. Local display settings are still available.","summary.local_only":"You can change settings for this card. Shared panel contents are managed by an administrator.","summary.sizes_title":"Sizes on this screen","summary.no_search_results":"No matching entities","summary.storage_unavailable":"These screen settings work for this session but cannot be saved in this browser.","summary.load_failed":"Could not open the panel settings.","summary.unsupported_schema":"This panel was created by a newer House Plan version and cannot be shown here.","summary.panel_title":"Panel title","summary.show_mobile":"Display on mobile devices","summary.block_title":"Block title","summary.up":"Move up","summary.down":"Move down","summary.drag":"Drag to reorder","summary.select_source":"Select a source","summary.block_visible":"Visible","summary.scope_all":"All spaces","summary.scope_space":"Specific space","summary.system_group":"System values","summary.entities_group":"Home Assistant entities","summary.search_entities":"Search entities by name or entity ID","summary.limit_values":"A block can contain up to 20 values","summary.add_value":"Add value","summary.limit_blocks":"The panel can contain up to 10 blocks","summary.add_block":"Add block","summary.problem.required":"Fill in this field.","summary.problem.limit":"The allowed limit has been exceeded.","summary.problem.duplicate_id":"This internal identifier is duplicated.","summary.problem.invalid_source":"Select a valid source.","summary.problem.missing_entity":"This entity is no longer available. Select another source to replace it.","summary.problem.missing_space":"This space is no longer available. Select another scope to replace it."},ru:{"summary.default_title":"Сводная информация","summary.default_block":"Общее","summary.system.device_count":"Количество устройств","summary.system.total_area":"Общая площадь комнат","summary.system.datetime":"Дата и время","summary.new_block":"Новый блок","summary.value_name":"Название показателя","summary.delete_block_title":"Удалить блок?","summary.delete_block_body":"В блоке есть показатели. Он будет удалён из черновика.","summary.save_failed":"Не удалось сохранить сводную панель.","summary.conflict":"Конфигурация изменилась в другом окне. Загрузите актуальную версию, чтобы начать заново.","summary.reload_current":"Загрузить актуальную конфигурацию","summary.unavailable":"Источник недоступен","summary.empty_block":"В этом блоке нет показателей","summary.empty_space":"Нет показателей для этого пространства","summary.measure_block":"Блок","summary.measure_label":"Состояние","summary.controls":"Управление сводной панелью","summary.settings":"Настройки сводной панели","summary.show":"Показать сводную панель","summary.hide":"Скрыть сводную панель","summary.hidden_mobile":"Панель включена локально, но отключена на мобильных устройствах","summary.hidden_narrow_unknown":"Панель включена локально и ожидает от Home Assistant информацию о режиме экрана","summary.hidden_small":"Панель включена локально, но карточка слишком мала","summary.show_local":"Показывать панель в этой карточке","summary.backend_required":"Обновите интеграцию House Plan, чтобы менять общее содержимое панели. Локальные настройки доступны.","summary.local_only":"Вы можете менять настройки этой карточки. Общим содержимым панели управляет администратор.","summary.sizes_title":"Размеры на этом экране","summary.no_search_results":"Подходящие сущности не найдены","summary.storage_unavailable":"Настройки экрана действуют в этой сессии, но браузер не может их сохранить.","summary.load_failed":"Не удалось открыть настройки панели.","summary.unsupported_schema":"Эта панель создана в более новой версии House Plan и не может быть здесь показана.","summary.panel_title":"Название панели","summary.show_mobile":"Отображать на мобильных устройствах","summary.block_title":"Название блока","summary.up":"Выше","summary.down":"Ниже","summary.drag":"Перетащить для изменения порядка","summary.select_source":"Выберите источник","summary.block_visible":"Показывать","summary.scope_all":"Все пространства","summary.scope_space":"Определённое пространство","summary.system_group":"Системные показатели","summary.entities_group":"Сущности Home Assistant","summary.search_entities":"Поиск сущностей по названию или entity ID","summary.limit_values":"В блоке может быть не больше 20 показателей","summary.add_value":"Добавить значение","summary.limit_blocks":"В панели может быть не больше 10 блоков","summary.add_block":"Добавить блок","summary.problem.required":"Заполните это поле.","summary.problem.limit":"Превышено допустимое ограничение.","summary.problem.duplicate_id":"Внутренний идентификатор повторяется.","summary.problem.invalid_source":"Выберите корректный источник.","summary.problem.missing_entity":"Эта сущность больше недоступна. Выберите другой источник, чтобы заменить её.","summary.problem.missing_space":"Это пространство больше недоступно. Выберите другую область, чтобы заменить его."},de:{"summary.default_title":"Übersicht","summary.default_block":"Allgemein","summary.system.device_count":"Anzahl der Geräte","summary.system.total_area":"Gesamte Raumfläche","summary.system.datetime":"Datum und Uhrzeit","summary.new_block":"Neuer Block","summary.value_name":"Bezeichnung","summary.delete_block_title":"Block löschen?","summary.delete_block_body":"Dieser Block enthält Werte und wird aus dem Entwurf entfernt.","summary.save_failed":"Die Übersicht konnte nicht gespeichert werden.","summary.conflict":"Die Konfiguration wurde in einem anderen Fenster geändert. Laden Sie die aktuelle Version, um neu zu beginnen.","summary.reload_current":"Aktuelle Konfiguration laden","summary.unavailable":"Quelle nicht verfügbar","summary.empty_block":"Keine Werte in diesem Block","summary.empty_space":"Keine Werte für diesen Bereich","summary.measure_block":"Block","summary.measure_label":"Status","summary.controls":"Steuerung der Übersicht","summary.settings":"Einstellungen der Übersicht","summary.show":"Übersicht anzeigen","summary.hide":"Übersicht ausblenden","summary.hidden_mobile":"Die Übersicht ist lokal aktiv, aber auf Mobilgeräten deaktiviert","summary.hidden_narrow_unknown":"Die Übersicht ist lokal aktiv und wartet auf den Bildschirmmodus von Home Assistant","summary.hidden_small":"Die Übersicht ist lokal aktiv, aber diese Karte ist zu klein","summary.show_local":"Übersicht in dieser Karte anzeigen","summary.backend_required":"Aktualisieren Sie die House-Plan-Integration, um gemeinsame Inhalte zu bearbeiten. Lokale Einstellungen bleiben verfügbar.","summary.local_only":"Sie können Einstellungen dieser Karte ändern. Gemeinsame Inhalte verwaltet ein Administrator.","summary.sizes_title":"Größen auf diesem Bildschirm","summary.no_search_results":"Keine passenden Entitäten","summary.storage_unavailable":"Diese Bildschirmeinstellungen gelten für diese Sitzung, können aber in diesem Browser nicht gespeichert werden.","summary.load_failed":"Die Panel-Einstellungen konnten nicht geöffnet werden.","summary.unsupported_schema":"Dieses Panel wurde mit einer neueren House-Plan-Version erstellt und kann hier nicht angezeigt werden.","summary.panel_title":"Titel der Übersicht","summary.show_mobile":"Auf Mobilgeräten anzeigen","summary.block_title":"Blocktitel","summary.up":"Nach oben","summary.down":"Nach unten","summary.drag":"Zum Sortieren ziehen","summary.select_source":"Quelle auswählen","summary.block_visible":"Sichtbar","summary.scope_all":"Alle Bereiche","summary.scope_space":"Bestimmter Bereich","summary.system_group":"Systemwerte","summary.entities_group":"Home-Assistant-Entitäten","summary.search_entities":"Entitäten nach Name oder Entity-ID suchen","summary.limit_values":"Ein Block kann bis zu 20 Werte enthalten","summary.add_value":"Wert hinzufügen","summary.limit_blocks":"Die Übersicht kann bis zu 10 Blöcke enthalten","summary.add_block":"Block hinzufügen","summary.problem.required":"Füllen Sie dieses Feld aus.","summary.problem.limit":"Das zulässige Limit wurde überschritten.","summary.problem.duplicate_id":"Diese interne Kennung wird mehrfach verwendet.","summary.problem.invalid_source":"Wählen Sie eine gültige Quelle.","summary.problem.missing_entity":"Diese Entität ist nicht mehr verfügbar. Wählen Sie zum Ersetzen eine andere Quelle.","summary.problem.missing_space":"Dieser Bereich ist nicht mehr verfügbar. Wählen Sie zum Ersetzen einen anderen Geltungsbereich."},fr:{"summary.default_title":"Résumé","summary.default_block":"Général","summary.system.device_count":"Nombre d’appareils","summary.system.total_area":"Surface totale des pièces","summary.system.datetime":"Date et heure","summary.new_block":"Nouveau bloc","summary.value_name":"Nom de la valeur","summary.delete_block_title":"Supprimer le bloc ?","summary.delete_block_body":"Ce bloc contient des valeurs et sera supprimé du brouillon.","summary.save_failed":"Impossible d’enregistrer le panneau de résumé.","summary.conflict":"La configuration a changé dans une autre fenêtre. Chargez la version actuelle pour recommencer.","summary.reload_current":"Charger la configuration actuelle","summary.unavailable":"Source indisponible","summary.empty_block":"Aucune valeur dans ce bloc","summary.empty_space":"Aucune valeur pour cet espace","summary.measure_block":"Bloc","summary.measure_label":"État","summary.controls":"Commandes du panneau de résumé","summary.settings":"Paramètres du panneau de résumé","summary.show":"Afficher le panneau de résumé","summary.hide":"Masquer le panneau de résumé","summary.hidden_mobile":"Le panneau est activé localement mais désactivé sur mobile","summary.hidden_narrow_unknown":"Le panneau est activé localement et attend le mode d’écran de Home Assistant","summary.hidden_small":"Le panneau est activé localement mais cette carte est trop petite","summary.show_local":"Afficher le panneau dans cette carte","summary.backend_required":"Mettez à jour l’intégration House Plan pour modifier le contenu partagé. Les réglages locaux restent disponibles.","summary.local_only":"Vous pouvez modifier les réglages de cette carte. Le contenu partagé est géré par un administrateur.","summary.sizes_title":"Tailles pour cet écran","summary.no_search_results":"Aucune entité correspondante","summary.storage_unavailable":"Ces réglages d’écran s’appliquent à cette session, mais ce navigateur ne peut pas les enregistrer.","summary.load_failed":"Impossible d’ouvrir les paramètres du panneau.","summary.unsupported_schema":"Ce panneau a été créé par une version plus récente de House Plan et ne peut pas être affiché ici.","summary.panel_title":"Titre du panneau","summary.show_mobile":"Afficher sur les appareils mobiles","summary.block_title":"Titre du bloc","summary.up":"Monter","summary.down":"Descendre","summary.drag":"Faire glisser pour réorganiser","summary.select_source":"Sélectionner une source","summary.block_visible":"Visible","summary.scope_all":"Tous les espaces","summary.scope_space":"Espace spécifique","summary.system_group":"Valeurs système","summary.entities_group":"Entités Home Assistant","summary.search_entities":"Rechercher par nom ou identifiant d’entité","summary.limit_values":"Un bloc peut contenir jusqu’à 20 valeurs","summary.add_value":"Ajouter une valeur","summary.limit_blocks":"Le panneau peut contenir jusqu’à 10 blocs","summary.add_block":"Ajouter un bloc","summary.problem.required":"Remplissez ce champ.","summary.problem.limit":"La limite autorisée est dépassée.","summary.problem.duplicate_id":"Cet identifiant interne est dupliqué.","summary.problem.invalid_source":"Sélectionnez une source valide.","summary.problem.missing_entity":"Cette entité n’est plus disponible. Sélectionnez une autre source pour la remplacer.","summary.problem.missing_space":"Cet espace n’est plus disponible. Sélectionnez une autre portée pour le remplacer."}};const M=new WeakMap,T=e=>null===e||"object"!=typeof e&&"function"!=typeof e?null:e;function C(e){return e}function D(e){const t=e.localName;return"string"==typeof t&&t?t:"node"}function z(e){const t=e,s=T(t.parentNode);if(s)return s;const a=T(t.host);if(a)return a;if("function"!=typeof t.getRootNode)return null;const i=T(t.getRootNode.call(e));return i&&i!==e?T(i.host):null}function R(e){const t=function(e){let t=e;for(let e=0;t&&e<16;e++){if("hui-card"===D(t))return t;t=z(t)}return e}(e),s=M.get(t);if(s)return s;const a=function(e){const t=[];let s=e;for(let e=0;s&&e<16;e++){const e=z(s);if(!e){t.unshift(D(s));break}const a=C(e).children,i=a?Array.from(a).indexOf(s):-1;t.unshift(`${D(s)}:${Math.max(0,i)}`),s=e}return t.join("/")||"root"}(t);return M.set(t,a),a}var L=Object.freeze({__proto__:null,LoadedSummaryPanelRuntime:class{constructor(e){this.dialog=null,this.local={version:1,show:!1,icon_scale:1,font_scale:1},this.storageKey=null,this.stage={width:0,height:0,minimumHeight:162,controlTop:0},this.clock=new Date,this.clockTimer=0,this.deviceMemo=null,this.areaMemo=null,this.storageUnavailable=!1,this.clockContext="",this.editorRenderer=null,this.editorLoad=null,this.metricsModule=null,this.metricsLoad=null,this.styleSheet=null,this.translate=e=>this.t(e),this.host=e}get dialogOpen(){return!!this.dialog}entityIds(){return function(e){if(!e||!d(e))return[];const t=new Set;for(const s of e.blocks)for(const e of s.values){if("entity"!==e.source.type)continue;const s=l(e.source.entity_id);s&&t.add(s)}return[...t]}(this.config().config)}connect(){this.ensureStyle(),this.loadLocal()}disconnect(){this.clockTimer&&clearTimeout(this.clockTimer),this.clockTimer=0}visibility(e){if("hidden"===e)return this.clockTimer&&clearTimeout(this.clockTimer),void(this.clockTimer=0);this.clock=new Date,this.syncClock(),this.host.requestUpdate()}updated(){this.syncNativeNarrow(),this.loadLocal(),this.measureLayout(),this.syncClock()}resized(){this.measureLayout()}closeDialogIfIdle(){return!(!this.dialog||this.dialog.busy)&&(this.dialog=null,this.host.requestUpdate(),!0)}blocksOtherDialogs(){return!!this.dialog}saveScale(e){this.saveLocal({icon_scale:e.icon??this.local.icon_scale,font_scale:e.font??this.local.font_scale})}renderMeasure(){const s=this.config().config?.title;return s&&"view"===this.host._mode?t`<div class="summary-measure" aria-hidden="true" inert>
      <h2>${s}</h2><section><h3>${this.t("summary.measure_block")}</h3>
      <div class="summary-value"><span>${this.t("summary.measure_label")}</span>
        <strong>${this.t("summary.unavailable")}</strong></div></section>
    </div><div class="summary-safe-probe" aria-hidden="true" inert></div>`:e}renderPanel(){const s=this.config().config;if(!s)return e;const a=this.layout();if(!f({view:"view"===this.host._mode,localShow:this.local.show,showOnMobile:s.show_on_mobile,narrow:this.host.narrow,fits:a.fits}))return e;this.ensureMetrics();const i=p(s,this.host._space),r=e=>e.stopPropagation();return t`<aside class="summary-overlay ${a.side}" aria-label=${s.title}
        style="--summary-height-cap:${Math.floor(a.heightCap)}px;--summary-width-cap:${Math.floor(a.availableWidth)}px;--summary-top:${a.top}px;--summary-bottom:${a.bottom}px"
        @click=${r} @dblclick=${r} @pointerdown=${r} @pointerup=${r}
        @pointermove=${r} @wheel=${r}>
      <h2>${s.title}</h2>
      <div class="summary-scroll">
        ${i.length?i.map(e=>t`<section class="summary-block">
          <h3>${e.title}</h3>
          ${e.values.length?e.values.map(e=>t`<div class="summary-value">
            <span>${e.label}</span><strong>${this.value(e)}</strong>
          </div>`):t`<div class="summary-empty">${this.t("summary.empty_block")}</div>`}
        </section>`):t`<div class="summary-empty">${this.t("summary.empty_space")}</div>`}
      </div>
    </aside>`}renderControls(s=!1){if("view"!==this.host._mode)return e;const a=this.config(),i=this.layout(),r=this.local.show&&(a.unsupported?this.t("summary.unsupported_schema"):a.config?.show_on_mobile||!0!==this.host.narrow?a.config?.show_on_mobile||null!==this.host.narrow?i.fits?"":this.t("summary.hidden_small"):this.t("summary.hidden_narrow_unknown"):this.t("summary.hidden_mobile"))||this.t(this.local.show?"summary.hide":"summary.show"),o=e=>e.stopPropagation();return t`<div class="summary-control ${s?"kiosk":""}" role="group"
        aria-label=${this.t("summary.controls")} @click=${o} @dblclick=${o}
        @pointerdown=${o} @pointerup=${o} @pointermove=${o} @wheel=${o}>
      <button type="button" @click=${()=>{this.openDialog()}}
        title=${this.t("summary.settings")} aria-label=${this.t("summary.settings")}>
        <ha-icon icon="mdi:cog-outline"></ha-icon>
      </button>
      <button type="button" class=${this.local.show?"on":""}
        aria-pressed=${this.local.show?"true":"false"}
        title=${r} aria-label=${r}
        @click=${()=>this.saveLocal({show:!this.local.show})}>
        <ha-icon icon="mdi:view-dashboard-outline"></ha-icon>
      </button>
    </div>`}renderDialog(){return this.dialog&&this.editorRenderer?this.editorRenderer({host:this.host,dialog:this.dialog,local:this.local,storageUnavailable:this.storageUnavailable,problems:this.problems(this.dialog),setDialog:e=>{this.dialog=e,this.host.requestUpdate()},saveLocal:e=>this.saveLocal(e),mutate:e=>this.mutate(e),deleteBlock:e=>{this.deleteBlock(e)},dragStart:(e,t)=>this.dragStart(e,t),drop:(e,t)=>this.drop(e,t),sourceToken:e=>this.sourceToken(e),setSource:(e,t,s)=>this.setSource(e,t,s),save:()=>{this.saveDialog()},reload:()=>{this.reloadDialog()},close:()=>this.closeDialogIfIdle(),t:e=>this.t(e)}):e}t(e){return e.startsWith("summary.")?function(e,t){const s=e.toLowerCase().split("-")[0];return($[s]||$.en)[t]||$.en[t]||t}(s(this.host.hass,this.host._config?.language),e):this.host._t(e)}ensureStyle(){const e=this.host.renderRoot;if(this.styleSheet&&e.adoptedStyleSheets.includes(this.styleSheet))return;const t=this.host.ownerDocument.defaultView?.CSSStyleSheet;if(t&&"adoptedStyleSheets"in e){const s=new t;return s.replaceSync(S),this.styleSheet=s,void(e.adoptedStyleSheets=[...e.adoptedStyleSheets,s])}if(e.querySelector("style[data-hp-summary]"))return;const s=this.host.ownerDocument.createElement("style");s.dataset.hpSummary="true",s.textContent=S,e.insertBefore(s,e.firstChild)}placementSlot(){return R(this.host)}preferenceKey(){return function(e){const t=l(e.userId),s=l(e.slot);return t&&s?`houseplan.summary-panel.v1:${[t,l(e.path)||"/",l(e.host)||"card",s].map(e=>encodeURIComponent(e)).join(":")}`:null}({userId:this.host.hass?.user?.id||this.host.hass?.user?.name,path:location.pathname,host:this.host.panelHost?"panel":"lovelace",slot:this.placementSlot()})}syncNativeNarrow(){if(this.host.panelHost)return;let e=this.host;for(let t=0;e&&t<12;t++){const t=e.getRootNode();if(e=e.parentNode||(t instanceof ShadowRoot?t.host:null),!e||e===this.host)continue;const s=e.narrow;if("boolean"==typeof s)return void(this.host.narrow!==s&&(this.host.narrow=s))}}loadLocal(){const e=this.preferenceKey();if(!e||e===this.storageKey)return;let t=null,s=null,a=!0;try{t=JSON.parse(localStorage.getItem(e)||"null")}catch{a=!1}try{s=JSON.parse(localStorage.getItem("houseplan_card_kiosk_v1")||"null")}catch{a=!1}this.storageKey=e,this.storageUnavailable=!a,this.local=function(e,t){const s=e&&"object"==typeof e?e:{},a=t&&"object"==typeof t?t:{};return{version:1,show:!0===s.show,icon_scale:_(m(s,"icon_scale")?s.icon_scale:a.icon),font_scale:_(m(s,"font_scale")?s.font_scale:a.font)}}(t,s),this.host._kioskScale={icon:this.local.icon_scale,font:this.local.font_scale}}saveLocal(e){this.local={...this.local,...e,version:1,icon_scale:_(e.icon_scale??this.local.icon_scale),font_scale:_(e.font_scale??this.local.font_scale)},this.host._kioskScale={icon:this.local.icon_scale,font:this.local.font_scale},this.storageKey||=this.preferenceKey();let t=!1;try{this.storageKey&&(localStorage.setItem(this.storageKey,JSON.stringify(this.local)),t=!0)}catch{}this.storageUnavailable=!t,t||this.host._showToast?.(this.t("summary.storage_unavailable")),this.host.requestUpdate()}config(){return function(e,t){const s=e?.summary_panel;return void 0===s?{config:h(t),derived:!0,unsupported:!1}:d(s)?{config:s,derived:!1,unsupported:!1}:{config:null,derived:!1,unsupported:!0}}(this.host._settings,this.translate)}async openDialog(){this.loadLocal();try{this.editorLoad||=import("./summary-panel-editor-Cc5nnZdf.js").then(e=>e.renderSummaryPanelEditor),this.editorRenderer=await this.editorLoad}catch(e){return this.editorLoad=null,void this.host._showToast?.(`${this.t("summary.load_failed")} ${this.host._errText(e)}`)}const e=this.config(),t=e.config||h(this.translate),s=this.host._haSummaryPanelApi!==a,i=e.unsupported?"summary.unsupported_schema":s&&this.host._canManageConfiguration?"summary.backend_required":"summary.local_only";this.dialog={draft:y(t),base:y(t),baseRevision:this.host._cfgRev,localShow:this.local.show,baseLocalShow:this.local.show,localOnly:this.host._kiosk||!this.host._canManageConfiguration||s||e.unsupported,localOnlyHint:i,busy:!1,attempted:!1,entityFilter:"",error:"",conflict:!1},this.host.requestUpdate()}problems(e=this.dialog){return!e||e.localOnly?[]:g(b(e.draft),e.base,new Set(this.host._model.map(e=>e.id)),new Set(Object.keys(this.host.hass?.states||{})))}mutate(e){if(!this.dialog||this.dialog.busy||this.dialog.localOnly)return;const t=y(this.dialog.draft);e(t),this.dialog={...this.dialog,draft:t,error:"",conflict:!1},this.host.requestUpdate()}async deleteBlock(e){const t=this.dialog?.draft.blocks[e];if(t){if(t.values.length){if(!await this.host._confirmDanger({key:"summary-block",kind:"warning",title:this.t("summary.delete_block_title"),message:this.t("summary.delete_block_body"),objectName:t.title,confirmLabel:this.t("btn.delete"),cancelLabel:this.t("btn.cancel")}))return}this.mutate(t=>{t.blocks.splice(e,1)})}}sourceToken(e){return"system"===e.type?`system:${e.key}`:`entity:${e.entity_id}`}setSource(e,t,s){this.mutate(a=>{const i=a.blocks[e]?.values[t];if(i)if(s.startsWith("system:")){const e=s.slice(7);(e=>"device_count"===e||"total_area"===e||"datetime"===e)(e)&&(i.source={type:"system",key:e})}else i.source={type:"entity",entity_id:s.startsWith("entity:")?s.slice(7):s}})}dragStart(e,t){e.dataTransfer?.setData("text/x-houseplan-summary",t),e.dataTransfer&&(e.dataTransfer.effectAllowed="move")}drop(e,t){e.preventDefault(),e.stopPropagation();const s=e.dataTransfer?.getData("text/x-houseplan-summary")||"",a=s.split(":").map(Number),i=t.split(":").map(Number);s.startsWith("block:")&&t.startsWith("block:")?this.mutate(e=>{e.blocks=w(e.blocks,a[1],i[1])}):s.startsWith("value:")&&t.startsWith("value:")&&a[1]===i[1]&&this.mutate(e=>{e.blocks[a[1]].values=w(e.blocks[a[1]].values,a[2],i[2])})}async saveDialog(){const e=this.dialog;if(!e||e.busy)return;const t=b(e.draft);if((e.localOnly?[]:g(t,e.base,new Set(this.host._model.map(e=>e.id)),new Set(Object.keys(this.host.hass?.states||{})))).some(e=>"error"===e.kind))return this.dialog={...e,draft:t,attempted:!0},this.host.requestUpdate(),await this.host.updateComplete,void this.host.renderRoot.querySelector('[data-summary-error="true"]')?.focus?.();this.dialog={...e,draft:t,busy:!0,attempted:!1,error:"",conflict:!1},this.host.requestUpdate();try{if(!e.localOnly&&!v(t,e.base)){this.host._writesPending++;const s=i(this.host._writeChain,async()=>{if(!this.host._serverCfg)throw new Error(this.t("summary.save_failed"));if(this.host._cfgRev!==e.baseRevision)throw new Error(this.t("summary.conflict"));const s=r({...this.host._serverCfg,settings:{...this.host._serverCfg.settings||{},summary_panel:t}});let a=!1;try{await this.host._sendConfigCandidate(s)}catch(e){try{const s=await this.host._getAuthoritativeConfig(),i=function(e,t){if(!u(e))return null;const s=e.config,a=e.rev;if(!u(s)||!Array.isArray(s.spaces)||"number"!=typeof a||!Number.isSafeInteger(a)||a<0)return null;const i=u(s.settings)?s.settings:null,r=i?.summary_panel;return d(r)&&v(r,t)?{config:s,rev:a}:null}(s,t);if(!i)throw e;const r=o(i.config)!==(this.host._cfgContentFingerprint||o(this.host._serverCfg));if(r&&!await this.host._signer.prepareImage(this.host.hass,this.host._candidateBackdrop(i.config)))throw this.host._continuity.note("asset-failed"),this.host._scheduleLoadRetry(!0),e;r&&this.host._continuity.hasCompleteFrame&&"steady"===this.host._continuity.state&&this.host._beginContinuityCandidate("summary-recovery",!0);const n=this.host._space;this.host._adoptStructuralResponses(s),this.host._syncDecorAssets(i.config).catch(()=>{}),this.host._adoptInitialSpace(this.host._model,!0),this.host._resumePendingNavMode(),this.host._cacheSnapshot(),this.host._space!==n&&this.host._restoreZoom(),this.host._regSignature="",this.host._maybeRebuildDevices(),a=!0}catch{throw e}}a||(this.host._serverCfg=s,this.host._cfgContentFingerprint=o(s),this.host._cacheSnapshot())});this.host._writeChain=s,await s.finally(()=>{this.host._writesPending--})}this.saveLocal({show:e.localShow}),this.dialog=null}catch(t){const s="conflict"===t?.code||this.host._cfgRev!==e.baseRevision;this.dialog={...this.dialog||e,busy:!1,conflict:s,error:s?this.t("summary.conflict"):this.host._errText(t)}}this.host.requestUpdate()}async reloadDialog(){const e=this.dialog;if(e&&!e.busy){this.dialog={...e,busy:!0,error:"",conflict:!1},this.host.requestUpdate();try{if(await this.host._reloadConfigOnly(!0),e.conflict&&this.host._cfgRev===e.baseRevision)throw new Error(this.t("summary.load_failed"));const t=this.config().config||h(this.translate);this.dialog={...e,draft:y(t),base:y(t),baseRevision:this.host._cfgRev,busy:!1,attempted:!1,error:"",conflict:!1}}catch(t){this.dialog={...e,busy:!1,error:this.host._errText(t),conflict:!0}}this.host.requestUpdate()}}metrics(){const e=this.metricsModule;if(!e)return{deviceCount:null,areaM2:null,now:this.clock};if(!this.deviceMemo||this.deviceMemo.cfgEpoch!==this.host._cfgEpoch||this.deviceMemo.layoutRev!==this.host._layoutRev||this.deviceMemo.registryRev!==this.host._haRegistry.revision){const t=e.representedHaDeviceIds({registry:this.host._haRegistry,areaToSpace:Object.fromEntries(Object.entries(this.host._areaToSpace).map(([e,t])=>[e,t.space])),spaceIds:new Set(this.host._model.map(e=>e.id)),firstSpaceId:this.host._model[0]?.id||"",markers:this.host._markers});this.deviceMemo={cfgEpoch:this.host._cfgEpoch,layoutRev:this.host._layoutRev,registryRev:this.host._haRegistry.revision,value:t?.size??null}}return this.areaMemo&&this.areaMemo.cfgEpoch===this.host._cfgEpoch||(this.areaMemo={cfgEpoch:this.host._cfgEpoch,value:this.host._serverCfg?e.totalCleanFloorAreaM2(this.host._serverCfg,this.host._model):null}),{deviceCount:this.deviceMemo.value,areaM2:this.areaMemo.value,now:this.clock}}value(e){const t=this.metricsModule;return(t?"entity"===e.source.type?t.summaryEntityValue(this.host.hass,e.source.entity_id):t.summarySystemValue(e.source,this.metrics(),this.host.hass,s(this.host.hass,this.host._config?.language)):null)??this.t("summary.unavailable")}ensureMetrics(){this.metricsModule||this.metricsLoad||(this.metricsLoad=import("./summary-panel-metrics-C7UmMbnv.js"),this.metricsLoad.then(e=>{this.metricsModule=e,this.host.requestUpdate()}).catch(()=>{}).finally(()=>{this.metricsLoad=null}))}layout(){return function(e){const t=Math.max(0,Number(e.width)||0),s=Math.max(0,Number(e.height)||0),a=t>=s?"right":"bottom",i=Math.max(0,e.safeLeft||0)+12,r=Math.max(0,e.safeRight||0)+12,o=Math.max(Math.max(0,e.safeTop||0)+12,e.controlTop||0),n=Math.max(Math.max(0,e.safeBottom||0)+12,e.controlBottom||0),l=Math.max(0,t-i-r),m=Math.max(0,s-o-n),u="bottom"===a?Math.min(.6*s,m):m;return{side:a,fits:t>0&&s>0&&l>=280&&u>=Math.max(0,e.minimumHeight),availableWidth:l,heightCap:u,top:o,bottom:n}}({width:this.stage.width,height:this.stage.height,...this.safeInsets(),controlTop:this.host._kiosk?this.stage.controlTop:0,minimumHeight:this.stage.minimumHeight})}measureLayout(){const e=this.host._stageEl;if(!e)return;const t=this.host.renderRoot.querySelector(".summary-measure"),s=this.host.renderRoot.querySelector(".summary-control.kiosk"),a=e.getBoundingClientRect(),i=s?.getBoundingClientRect(),r={width:Math.round(e.clientWidth),height:Math.round(e.clientHeight),minimumHeight:Math.max(162,Math.ceil(t?.getBoundingClientRect().height||0)),controlTop:i?Math.max(0,Math.ceil(i.bottom-a.top+12)):0};r.width===this.stage.width&&r.height===this.stage.height&&r.minimumHeight===this.stage.minimumHeight&&r.controlTop===this.stage.controlTop||(this.stage=r,this.host.requestUpdate())}safeInsets(){const e=this.host.renderRoot.querySelector(".summary-safe-probe");if(!e)return{safeLeft:0,safeRight:0,safeTop:0,safeBottom:0};const t=this.host.ownerDocument.defaultView?.getComputedStyle(e);if(!t)return{safeLeft:0,safeRight:0,safeTop:0,safeBottom:0};const s=e=>Number.parseFloat(e)||0;return{safeLeft:s(t.paddingLeft),safeRight:s(t.paddingRight),safeTop:s(t.paddingTop),safeBottom:s(t.paddingBottom)}}hasVisibleClock(){const e=this.config().config;return!("hidden"===this.host.ownerDocument.visibilityState||!e)&&(!!f({view:"view"===this.host._mode,localShow:this.local.show,showOnMobile:e.show_on_mobile,narrow:this.host.narrow,fits:this.layout().fits})&&p(e,this.host._space).some(e=>e.values.some(e=>"system"===e.source.type&&"datetime"===e.source.key)))}syncClock(){const e=`${s(this.host.hass,this.host._config?.language)}\n${this.host.hass?.config?.time_zone||""}`;e!==this.clockContext&&(this.clockContext=e,this.clock=new Date);const t=this.hasVisibleClock();if(t&&!this.clockTimer){this.clock=new Date;const e=()=>{this.clock=new Date,this.clockTimer=0,this.host.requestUpdate(),this.syncClock()};this.clockTimer=window.setTimeout(e,6e4-Date.now()%6e4+25)}else!t&&this.clockTimer&&(clearTimeout(this.clockTimer),this.clockTimer=0)}}});export{x as a,k as b,L as c,w as m,b as n,v as s};
