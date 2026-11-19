import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const repo=process.cwd();
const fixture=JSON.parse(readFileSync(resolve(repo,'demo/ui-lab/fixture.json'),'utf8'));
const space='matrix-1129';
const cols=[
 ['A','Иконка','icon'],['B','Короткое значение','value'],['C','Длинное значение','long'],
 ['D','Иконка + бейдж','badge'],['E','Длинный бейдж','longbadge'],['F','Длинные оба','both'],
 ['G','Иконка в группе','group'],['H','Значение + бейдж в группе','groupboth'],
].map(([id,title,shape])=>({id,title,shape}));
const definitions=[
 ['off','Выключено / покой','Доступно; обычная иконка, без пульса.'],
 ['working','Работает','Постоянная работа: янтарная пульсация в режиме «Активность».'],
 ['event','Короткое событие','Датчик движения: реальный фронт off→on каждые 6 секунд, короткий эффект 3,3 с.'],
 ['presence','Присутствие','Непрерывный presence, зелёная пульсация.'],
 ['transition','Переход','Cover opening: непрерывный переход. Защищённая пиктограмма cover.'],
 ['terminal','Завершение перехода','Cover closed↔open: короткий конечный переход каждые 6 секунд.'],
 ['alarm','Тревога','Нативный smoke: красная тревога во всех динамических режимах, включая значение.'],
 ['maintenance','Обслуживание','Home Connect Machine Care: отдельный ключ, без красной тревоги.'],
 ['attention','Внимание','Свой порог, attention после штатного подтверждения 3 с.'],
 ['bothissues','Внимание + обслуживание','Два раздельных служебных значка.'],
 ['priority','Тревога + внимание + сервис','Тревога имеет приоритет: служебные значки подавляются; причины остаются.'],
 ['offline','Unavailable','Все собственные сущности unavailable: одно приглушение всего значка.'],
 ['unknown','Unknown','Неизвестные данные не означают подтверждённый offline.'],
 ['valuebad','Источник значения unavailable','Само устройство доступно; недоступно только выбранное значение.'],
 ['badgebad','Источник бейджа unavailable','Само устройство доступно; недоступно только содержимое бейджа.'],
 ['missing','Источники удалены','Настроенные value/badge ссылаются на отсутствующую сущность: штатный fallback.'],
 ['new','Новое устройство','Красная отметка нового устройства.'],
 ['hidden','Скрытое + новое','Серая отметка скрытия при включённом «глазе», приоритет над новым.'],
 ['disabled','Выключено в HA','В текущем dev полностью скрывается даже при включённом «глазе»; в ячейке явно подписано отсутствие маркера. Активность запрещена.'],
 ['orphan','Привязка потеряна','Устройство удалено из реестра; диагностическое представление.'],
 ['virtual','Виртуальное','Виртуальная привязка, пунктирный контур; нет собственного offline. В текущем dev собственное значение уступает иконке (fallback), внешний бейдж сохраняется.'],
 ['hover','Hover','Зафиксированный штатный hover для сравнения всей строки.'],
 ['hoveralarm','Hover + тревога','Тревога остаётся красной поверх hover.'],
 ['hoveroffline','Hover + offline','Offline не подменяется активным hover.'],
 ['selected','Выделено в редакторе','Зафиксированный стиль штатного выделения. Кнопка «Редактор» проверяет живое поведение.'],
 ['focus','Клавиатурный фокус','Зафиксированный штатный :focus-visible. Живой фокус также проверяется Tab.'],
 ['batteryok','Заряд 80% · LQI 212','Зелёный полный заряд и хороший сигнал.'],
 ['batterywarn','Заряд 25% · LQI 100','Промежуточный заряд и сигнал.'],
 ['batterylow','Заряд 5% · LQI 30','Низкий заряд и плохой сигнал.'],
 ['batteryunknown','Заряд unknown · нет LQI','Неизвестный заряд; отсутствующий LQI не выдумывается.'],
 ['locked','Замок закрыт','Нативное состояние locked; безопасные действия сохраняются.'],
 ['unlocked','Замок открыт','Нативное состояние unlocked; защищённая пиктограмма.'],
 ['coverclosed','Cover закрыт','Защищённая динамическая пиктограмма закрытого cover.'],
 ['coveropen','Cover открыт','Защищённая динамическая пиктограмма открытого cover.'],
 ['badgeleft','Бейдж слева','Слева; для колонок без бейджа — контрольная форма.'],
 ['badgetop','Бейдж сверху','Сверху; длинные значения не должны срезать эффект.'],
 ['badgebottom','Бейдж снизу + LQI','Снизу; LQI уходит под бейдж, не перекрывает его.'],
 ['static','Статическое оформление','static_icon / value_static_icon: нативная тревога не перекрашивает статическую лицевую сторону; дополнительные бейджи штатно скрыты.'],
 ['nopulse','Без обычной активности','Режим «Иконка» / «Значение»: работа без обычных волн.'],
 ['custompulse','Свой цвет и размер','Работа; фиолетовый цвет, диаметр 2,2. Тревога по-прежнему имеет свой красный эффект.'],
 ['angle','Поворот иконки 45°','Индивидуальный угол; бейдж и его текст сохраняют штатное положение.'],
 ['scale','Размер 75% / 140%','Чередование размеров; группа содержит неодинаковые тела.'],
];
const rows=definitions.map(([key,title,note],i)=>({id:String(i+1).padStart(2,'0'),key,title,note}));
const grid={left:300,top:100,col:300,row:170,width:2700,height:100+rows.length*170};
const plan={id:space,title:'#1129 · Матрица устройств',plan_url:null,view_box:[0,0,grid.width/1000,grid.height/1000],cell_cm:5,rooms:[],walls:[],partitions:[],wall_segments:[],openings:[],wall_columns:[],decor:[],settings:{show_names:false,show_borders:false,fill_mode:'none',glow_enabled:false,bg_color:'#18222e'}};
fixture.config.spaces.push(plan);
fixture.areas.matrix1129={area_id:'matrix1129',name:'Матрица устройств #1129'};
fixture.config.settings={...fixture.config.settings,volumetric_view:false,sun_rays:false,bg_mode:'static',show_lqi:true,show_battery:true};
fixture.config.settings.filter_seeded=true;
fixture.config.settings.new_device_ids=[];
fixture.config.settings.known_devices||=[];
fixture.config.settings.marker_area_snapshot||={};
fixture.integrations=[{entry_id:'lab_entry',domain:'demo',title:'Synthetic UI Lab'},{entry_id:'matrix_homeconnect',domain:'homeconnect_ws',title:'Synthetic Home Connect'}];
let seq=0;
function label(text,x,y,size=13,color='#b9c9de'){plan.decor.push({id:'mx_text_'+(++seq),kind:'text',x:x/1000,y:y/1000,text,size_cm:size*1.2,color,opacity:1});}
function line(x1,y1,x2,y2){plan.decor.push({id:'mx_line_'+(++seq),kind:'line',x1:x1/1000,y1:y1/1000,x2:x2/1000,y2:y2/1000,color:'#43546b',opacity:.65,width_cm:.65});}
label('#1129  /  СОСТОЯНИЯ × ФОРМЫ',20,26,20,'#e4edf8');
label('Один код в таблице = одна ячейка на плане. Только синтетические устройства.',20,51,12);
cols.forEach((c,i)=>label(c.id+' · '+c.title,grid.left+i*grid.col+grid.col/2,82,13,'#e4edf8'));
for(let i=0;i<=cols.length;i++)line(grid.left+i*grid.col,62,grid.left+i*grid.col,grid.height);
for(let i=0;i<=rows.length;i++)line(0,grid.top+i*grid.row,grid.width,grid.top+i*grid.row);
const cells=[],events=[];
function entity(id,domain,suffix,state,attrs={},reg={}){
 const eid=`${domain}.${id}_${suffix}`;
 fixture.entities[eid]={entity_id:eid,device_id:id,platform:'demo',config_entry_id:'lab_entry',disabled_by:null,original_name:suffix,...reg};
 fixture.states[eid]={entity_id:eid,state:String(state),attributes:{friendly_name:`${id} ${suffix}`,...attrs},last_changed:'2026-11-19T00:00:00Z',last_updated:'2026-11-19T00:00:00Z'};
 return eid;
}
for(const [ri,row] of rows.entries()){
 const y=grid.top+ri*grid.row+grid.row*.55;
 label(row.id+' · '+row.title,grid.left/2,grid.top+ri*grid.row+34,14,'#e4edf8');
 for(const [ci,col] of cols.entries()){
  const code=row.id+col.id,id='mx_'+code.toLowerCase(),key=row.key;
  const grouped=['group','groupboth'].includes(col.shape),hasValue=['value','long','both','groupboth'].includes(col.shape),longValue=['long','both','groupboth'].includes(col.shape),hasBadge=['badge','longbadge','both','groupboth'].includes(col.shape),longBadge=['longbadge','both','groupboth'].includes(col.shape);
  const x=grid.left+ci*grid.col+(hasBadge||grouped?100:150);
  const marker={id,binding:'device:'+id,space,name:`${code} · ${row.title} · ${col.title}`,icon:'mdi:lightbulb-outline',display:hasValue?'value':'icon_ripple',size:2,tap_action:'info',is_light:false,value_badge:{enabled:false},hide_battery:true,hide_signal:true};
  fixture.devices[id]={id,name:marker.name,name_by_user:null,model:'Synthetic #1129 '+code,manufacturer:'UI Lab',area_id:'matrix1129',identifiers:[['ui_lab',id]],config_entries:['lab_entry'],disabled_by:null,entry_type:null,via_device_id:null};
  let domain='switch',state=['off','new','hidden','disabled','orphan','virtual','hover','selected','focus'].includes(key)?'off':'on',attrs={};
  if(['event','presence'].includes(key)){domain='binary_sensor';attrs.device_class=key==='event'?'motion':'occupancy';state=key==='event'?'off':'on';}
  if(['transition','terminal','coverclosed','coveropen'].includes(key)){domain='cover';state=key==='transition'?'opening':key==='coveropen'?'open':'closed';attrs={device_class:'window',current_position:state==='closed'?0:state==='open'?100:40};delete marker.icon;}
  if(['locked','unlocked'].includes(key)){domain='lock';state=key;delete marker.icon;}
  const primary=entity(id,domain,'main',state,attrs);
  const value=entity(id,'sensor','value',longValue?'Ожидание связи':22.4,{}, {entity_category:'diagnostic'});
  const badge=entity(id,'sensor','badge',longBadge?'Цикл завершён':48,{}, {entity_category:'diagnostic'});
  if(hasValue)marker.value_source={kind:'entity_state',entity_id:value};
  if(hasBadge)marker.value_badge={enabled:true,position:({badgeleft:'left',badgetop:'top',badgebottom:'bottom'})[key]||'right',source:{kind:'entity_state',entity_id:badge}};
  if(['alarm','priority','hoveralarm','static'].includes(key))entity(id,'binary_sensor','smoke','on',{device_class:'smoke'});
  if(['maintenance','bothissues','priority'].includes(key))entity(id,'binary_sensor','maintenance','on',{device_class:'problem'},{platform:'homeconnect_ws',translation_key:'binary_sensor_machinecarereminder',entity_category:'diagnostic',config_entry_id:'matrix_homeconnect'});
  if(['attention','bothissues','priority'].includes(key))marker.alert_sources=[{id:'high',type:'threshold',level:'attention',entity_id:value,operator:'ne',value:'not-active'}];
  if(['offline','hoveroffline','unknown'].includes(key))for(const eid of [primary,value,badge])fixture.states[eid].state=key==='unknown'?'unknown':'unavailable';
  if(key==='valuebad')fixture.states[value].state='unavailable';
  if(key==='badgebad')fixture.states[badge].state='unavailable';
  if(key==='missing'){delete fixture.states[value];delete fixture.entities[value];delete fixture.states[badge];delete fixture.entities[badge];}
  if(key==='new'||key==='hidden')fixture.config.settings.new_device_ids.push(id);else fixture.config.settings.known_devices.push(id);
  if(key==='hidden')marker.hidden=true;
  if(key==='disabled')fixture.devices[id].disabled_by='user';
  if(key==='orphan'){delete fixture.devices[id];for(const eid of [primary,value,badge]){delete fixture.entities[eid];delete fixture.states[eid];}}
  if(key==='virtual'){marker.binding='virtual';marker.icon='mdi:lightbulb-outline';}
  if(key.startsWith('battery')||key==='badgebottom'){
   marker.hide_battery=false;marker.hide_signal=false;
   const battery=({batteryok:80,batterywarn:25,batterylow:5,batteryunknown:'unknown',badgebottom:80})[key];
   entity(id,'sensor','battery',battery,{device_class:'battery',unit_of_measurement:'%'},{entity_category:'diagnostic',device_class:'battery'});
   if(key!=='batteryunknown')entity(id,'sensor','linkquality',({batteryok:212,batterywarn:100,batterylow:30,badgebottom:212})[key],{unit_of_measurement:'lqi'},{entity_category:'diagnostic',original_name:'Linkquality'});
  }
  if(key==='static')marker.display=hasValue?'value_static_icon':'static_icon';
  if(key==='nopulse')marker.display=hasValue?'value':'badge';
  if(key==='custompulse'){marker.ripple_color='#b672f6';marker.ripple_size=2.2;}
  if(key==='angle')marker.angle=45;
  if(key==='scale')marker.size=ci%2?2*1.4:2*.75;
  fixture.config.markers.push(marker);fixture.layout[id]={s:space,x:x/1000,y:y/1000};
  fixture.config.settings.marker_area_snapshot[id]={binding:marker.binding,area:'matrix1129'};
  label(code+' · '+col.title,grid.left+ci*grid.col+grid.col/2,grid.top+ri*grid.row+24,12,'#89b8f8');
  if(['event','terminal'].includes(key))events.push({id:primary,kind:key});
  let neighbor;
  if(grouped){
   neighbor=id+'_neighbor';
   fixture.config.markers.push({id:neighbor,binding:'virtual',space,name:`${code} · сосед`,icon:'mdi:power-socket-eu',display:'static_icon',size:key==='scale'?1.4:2,value_badge:{enabled:false},tap_action:'none',hide_battery:true,hide_signal:true});
   // Native contact geometry will align the neighbor against the complete measured face.
   fixture.layout[neighbor]={s:space,x:(x-50.625)/1000,y:y/1000};
  }
  const ordinarySuppressed=hasValue&&['working','event','presence','transition','terminal','custompulse'].includes(key);
  let hint=ordinarySuppressed?'Волны активности выключены в Value':key==='virtual'&&hasValue?'Штатный fallback: иконка':key==='selected'?'Зафиксирован стиль выделения':key==='focus'?'Зафиксирован focus-visible':'';
  if(key==='disabled')label('Не рисуется в текущем dev',grid.left+ci*grid.col+grid.col/2,y,12);
  if(hint)label(hint,grid.left+ci*grid.col+grid.col/2,grid.top+ri*grid.row+155,10);
  cells.push({code,id,row:row.id,key,column:col.id,shape:col.shape,neighbor,ordinarySuppressed,primary,x,y,hasValue,hasBadge});
 }
}
fixture.config.spaces=[plan,...fixture.config.spaces.filter(s=>s.id!==space)];
const matrix={issue:1129,base:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),space,grid,columns:cols,rows,cells,events};
mkdirSync(here,{recursive:true});
writeFileSync(resolve(here,'fixture.json'),JSON.stringify(fixture,null,2)+'\n');
writeFileSync(resolve(here,'matrix.json'),JSON.stringify(matrix,null,2)+'\n');
const md=`## Диагностическая матрица UI Lab для #1129\n\nБаза: dev@${matrix.base} (19.11.2026). Это **визуализация текущего поведения**, а не предложенное исправление волн и не реализация #1129. Прежний согласованный стенд UI-060/UI-061 (#1474) сохранён отдельно. Локальные продуктовые overrides сюда не подключены: используется только код указанного dev.\n\nОтдельное пространство **«#1129 · Матрица устройств»**. Строка = состояние, столбец = форма. Код **07F** на плане соответствует ячейке **07 × F**. В групповых столбцах слева от проверяемого устройства — нейтральный сосед; его цвет не должен присваиваться сигналу проверяемого устройства.\n\n| Код / состояние | A · Иконка | B · Значение | C · Длинное значение | D · Иконка + бейдж | E · Длинный бейдж | F · Длинные оба | G · Иконка в группе | H · Длинные оба в группе |\n|---|---|---|---|---|---|---|---|---|\n`+rows.map(row=>'| '+row.id+' · '+row.title+' | '+cols.map(col=>{const cell=cells.find(c=>c.row===row.id&&c.column===col.id);return cell.code+(cell.ordinarySuppressed?' †':'');}).join(' | ')+' |').join('\n')+`\n\n**†** Обычные волны доступны только в режиме «Активность» (icon_ripple). В режиме «Значение» они штатно отсутствуют; красная тревога остаётся и на овалах. Здесь ограничения продукта показаны честно, не обходятся.\n\n### Что задаёт каждая строка\n\n`+rows.map(r=>`- **${r.id}. ${r.title}:** ${r.note}`).join('\n')+`\n\n### Оси проверки, общие для всей сетки\n\n- Светлая / тёмная тема, обычный View / 2.5D, системное уменьшение движения, включение/выключение live states. Это отдельные режимы всей матрицы: их не смешиваем с ложными per-device настройками. При reduced motion обычная активность становится точкой, тревога остаётся красной без анимированных колец.\n- Hover / focus / выделение в строках 22–26 закреплены только лабораторией, используя декларации штатных стилей. Это показывает внешний вид одновременно в нескольких ячейках; настоящий hover, Tab и редактор устройств остаются доступны для проверки взаимодействия.\n- Все пять display modes, четыре позиции бейджа (right по умолчанию, left/top/bottom отдельными строками), разные размеры, угол, короткие и длинные значения, собственный цвет/диаметр волн.\n- Доступность самого устройства независима от отсутствующего/недоступного value/badge. Off, unknown и unavailable не смешиваются.\n- Нативная тревога, пользовательское внимание, обслуживание и приоритет тревоги; четыре класса пульса (none/alarm/short/continuous) и причины event/presence/transition/running.\n- Новое/скрытое/HA-disabled/осиротевшее/виртуальное, четыре состояния батареи и диапазоны LQI. Недопустимые состояния (например, работа HA-disabled) не подделываются.\n\nЭто конечный каталог визуальных ветвей и существенных сочетаний, а не бесконечный перебор всех текстов, чисел, цветов и декартова произведения независимых настроек. Показания подобраны так, чтобы обнаружить ошибки геометрии. Пылесос в движении, линии LED, радарные цели и символы проёмов — отдельные изображения плана, не варианты корпуса этой иконки; в #1129 их не подменяем обычным значком.\n\nПолная синтетическая fixture и machine-readable matrix.json генерируются из одного описания; имена/код ячейки доступны в штатной подсказке устройства. Лабораторные действия не вызывают настоящий HA.\n`;
writeFileSync(resolve(here,'MATRIX.md'),md);
console.log(JSON.stringify({rows:rows.length,columns:cols.length,cells:cells.length,markers:cells.length+cells.filter(c=>c.neighbor).length}));
