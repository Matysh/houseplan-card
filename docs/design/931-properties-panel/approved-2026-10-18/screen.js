const shapes={
house:'<path d="M3 10 12 3l9 7v11H3Z"/><path d="M9 21v-8h6v8"/>',
plan:'<path d="M3 3h18v18H3Z"/><path d="M12 3v10h9M3 13h9v8"/>',
devices:'<path d="M9 18h6M9.5 21h5M8 14a6 6 0 1 1 8 0c-1 .8-1 2-1 3H9c0-1 0-2.2-1-3Z"/>',
decor:'<path d="m3 8 9-5 9 5-9 5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>',
eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
cursor:'<path d="m5 3 14 9-7 1-3 7Z"/>',
wall:'<path d="M2 5h20v14H2ZM2 12h20M9 5v7m7 0v7"/>',
door:'<path d="M5 21V3h14v18M8 21V6l8-2v17Z"/><path d="M13 13h.1"/>',
plus:'<path d="M12 4v16M4 12h16"/>',
line:'<path d="m4 20 16-16"/>',
rect:'<rect x="3" y="5" width="18" height="14" rx="1"/>',
text:'<path d="M4 5V3h16v2M12 3v18M8 21h8"/>',
variable:'<path d="M8 3H6a2 2 0 0 0-2 2v4l-2 3 2 3v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4l2 3-2 3v4a2 2 0 0 1-2 2h-2M10 9l4 6m0-6-4 6"/>',
temperature:'<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v10"/><circle cx="12" cy="18" r="1.5"/>',
image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-4 5 5"/>',
undo:'<path d="M3 8h11a7 7 0 0 1 0 14M3 8l5-5M3 8l5 5"/>',
redo:'<path d="M21 8H10a7 7 0 0 0 0 14M21 8l-5-5M21 8l-5 5"/>',
xy:'<path d="M5 3v16h16M5 3 2 6M5 3l3 3m13 13-3-3m3 3-3 3"/>',
size:'<path d="M3 3h6M3 3v6m18 12h-6m6 0v-6M3 3l7 7m11 11-7-7"/>',
palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="7" cy="14" r="1"/><path d="M21 12h-5a3 3 0 0 0-3 3v6"/>',
adjust:'<path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-5 0v6"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',
copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
swap:'<path d="M4 7h15l-4-4m4 4-4 4M20 17H5l4-4m-4 4 4 4"/>',
lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
check:'<path d="m5 12 4 4L19 6"/>',
settings:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
link:'<path d="m8 15-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m5 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0M8 16l8-8" transform="translate(1 0) scale(.92)"/>',
flipH:'<path d="M12 2v20M3 6v12l6-6Zm18 0v12l-6-6Z"/>',
flipV:'<path d="M2 12h20M6 3h12l-6 6Zm0 18h12l-6-6Z"/>',
chevron:'<path d="m8 4 8 8-8 8"/>',
led:'<path d="M3 20V6h8v8h10"/><circle cx="3" cy="20" r="1"/><circle cx="21" cy="14" r="1"/>',
furniture:'<rect x="5" y="7" width="14" height="9" rx="2"/><path d="M3 11v9m18-9v9M3 17h18M7 3h10v4"/>'
};
function icon(name){return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(shapes[name]||shapes.rect)+'</svg>';}
function field(label,value,unit='',state='',extra=''){
 return '<div class="field '+state+'"><div class="field-label">'+label+(state==='readonly'?icon('lock'):'')+'</div><div class="control">'+extra+'<span class="value">'+value+'</span>'+(unit?'<span class="unit">'+unit+'</span>':'')+'</div></div>';
}
const disabled=(label,unit='')=>field(label,'—',unit,'disabled');
const row=(...items)=>'<div class="row'+(items.length===1?' one':'')+'">'+items.join('')+'</div>';
const col=(label,hex,opacity=100,state='')=>'<div class="field color-field '+state+'"><div class="field-label">'+label+'</div><div class="control"><span class="swatch"'+(hex?' style="background:'+hex+'"':'')+'></span><span class="value">'+(hex||'—')+'</span>'+(hex?'<span class="color-alpha">'+opacity+'%</span>':'')+'</div></div>';
function section(cls,name,ico,content){return '<section class="section '+cls+'"><div class="section-title">'+icon(ico)+name+'<span class="chevron">⌃</span></div>'+content+'</section>';}
const emptyAppearance=row(col('Цвет контура',null,0,'disabled'),col('Заливка',null,0,'disabled'))+row(disabled('Толщина контура','см'),disabled('Стиль линии'));
const variableDialog=new URLSearchParams(location.search).get('dialog')==='variable';
const variants={
wall:{editor:'plan',title:'Независимая стена',meta:'Первый этаж · отдельный участок',icon:'wall',
position:row(field('Начало · X₁','200','см'),field('Начало · Y₁','350','см'))+row(field('Конец · X₂','500','см'),field('Конец · Y₂','350','см')),
geometry:row(field('Длина','300','см','readonly'),field('Толщина стены','12','см'))+row(field('Угол','0','°','readonly'),disabled('Масштаб','%'))+'<div class="hint">Длина и угол вычисляются по концам стены.</div>',
appearance:emptyAppearance,features:'',status:'Независимая стена · 300 см'},
opening:{editor:'plan',title:'Дверной проём',meta:'Первый этаж · гостиная — кухня',icon:'door',
position:row(field('Центр · X','700','см','readonly'),field('Центр · Y','300','см','readonly'))+row(field('Отступ от угла','250','см'))+'<div class="hint">До ближнего края проёма. Размер показан на плане.</div>',
geometry:row(field('Ширина проёма','100','см'),disabled('Высота на плане','см'))+row(field('Угол','90','°','readonly'),disabled('Масштаб','%'))+'<div class="hint">Поворот проёма определяется стеной.</div>',
appearance:emptyAppearance,
featureTitle:'Дверь',features:'<div class="feature-row"><div class="choice">'+icon('swap')+'Переставить петли</div></div><div class="feature-label">Открывание</div><div class="feature-row"><div class="choice">В гостиную</div><div class="choice active">В кухню</div></div>',status:'Дверной проём · 100 см'},
device:{editor:'devices',title:'Подсветка кухни',meta:'Устройство · Первый этаж',icon:'devices',
position:row(field('Центр · X','1 000','см'),field('Центр · Y','200','см'))+'<div class="hint">Положение центра значка на плане.</div>',
geometry:row(disabled('Ширина','см'),disabled('Высота на плане','см'))+row(field('Поворот значка','0','°'),field('Масштаб значка','100','%'))+'<div class="hint">Размер значка меняется пропорционально.</div>',
appearance:emptyAppearance,
features:'<div class="action-button">'+icon('settings')+'Открыть настройки устройства</div><div class="hint device-settings-hint">Двойной клик по устройству на плане также открывает настройки.</div>',status:'Подсветка кухни · устройство'},
rectangle:{editor:'decor',title:'Прямоугольник',meta:'Декор · Первый этаж',icon:'rect',
position:row(field('Центр · X','350','см'),field('Центр · Y','225','см'))+'<div class="hint">Положение центра рамки выделения.</div>',
geometry:row(field('Ширина','300','см'),field('Высота на плане','150','см'))+row(field('Угол','15','°'),disabled('Масштаб','%')),
appearance:row(col('Цвет контура','#718B82',100),col('Заливка','#C4D5CF',65))+row(field('Толщина контура','2','см'),disabled('Стиль линии')),
features:'',status:'Прямоугольник · 300 × 150 см'},
text:{editor:'decor',title:'Температура на кухне',meta:'Текст · Первый этаж',icon:'text',
position:row(field('Центр · X','575','см'),field('Центр · Y','662,5','см'))+'<div class="hint">Положение центра рамки текста.</div>',
geometry:row(field('Ширина',variableDialog?'100':'200','см','readonly'),field('Высота на плане','30','см','readonly'))+row(field('Угол','0','°'),field('Размер шрифта','22,5','см'))+'<div class="hint">Габариты вычисляются по тексту и шрифту.</div>',
appearance:row(col('Цвет текста','#526871',100),col('Заливка',null,0,'disabled'))+row(disabled('Толщина контура','см'),disabled('Стиль линии')),
featureTitle:'Текст',features:'<div class="text-content" role="textbox" aria-label="Текст" aria-multiline="true">'+(variableDialog?'На кухне <span class="caret"></span>':'На кухне {sensor.kitchen_temperature}')+'</div><div class="variable-button">'+icon('variable')+'Вставить переменную HA</div>',status:'Текст · Температура на кухне'},
image:{editor:'decor',title:'Ковёр.png',meta:'Изображение декора · Первый этаж',icon:'image',
position:row(field('Центр · X','1 175','см'),field('Центр · Y','612,5','см'))+'<div class="hint">Положение центра рамки изображения.</div>',
geometry:row(field('Ширина','170','см'),field('Высота на плане','230','см'))+row(field('Угол','−12','°'),disabled('Масштаб','%')),
appearance:row(col('Цвет контура',null,0,'disabled'),col('Заливка',null,0,'disabled'))+row(field('Непрозрачность','80','%'),disabled('Стиль линии')),
featureTitle:'Изображение',features:'<div class="feature-label">Отражение</div><div class="feature-row"><div class="choice">'+icon('flipH')+'Горизонтально</div><div class="choice">'+icon('flipV')+'Вертикально</div></div><div class="feature-label">Пропорции</div><div class="feature-row"><div class="choice active">'+icon('link')+'Сохранять пропорции</div></div>',status:'Изображение декора · Ковёр.png'},
contour:{editor:'plan',title:'Стена контура',meta:'Контур гостиной · Первый этаж',icon:'wall',
position:row(field('Точка A · X','0','см','readonly'),field('Точка A · Y','0','см','readonly'))+row(field('Точка B · X','700','см','readonly'),field('Точка B · Y','0','см','readonly'))+'<div class="hint">Положение концов меняется перемещением узлов на плане.</div>',
geometry:row(field('Длина','700','см','readonly'),field('Толщина стены','12','см'))+row(field('Угол','0','°','readonly'),disabled('Масштаб','%'))+'<div class="hint">Длина и угол вычисляются по точкам A и B.</div>',
appearance:emptyAppearance,features:'<div class="context-note">Точки общие с соседними стенами.<br>Их положение изменится вместе.</div>',status:'Стена контура · Гостиная',deleteReason:'Стена — часть контура комнаты.<br>Чтобы удалить её, сначала удалите комнату.'},
backdrop:{editor:'decor',title:'План этажа.png',meta:'Основная картинка плана · Первый этаж',icon:'image',
position:row(field('Центр · X','675','см'),field('Центр · Y','400','см'))+'<div class="hint">Положение центра картинки плана.</div>',
geometry:row(field('Ширина','1 350','см'),field('Высота на плане','800','см'))+row(field('Угол','0','°'),disabled('Масштаб','%')),
appearance:row(col('Цвет контура',null,0,'disabled'),col('Заливка',null,0,'disabled'))+row(field('Непрозрачность','80','%'),disabled('Стиль линии')),
features:'<div class="action-button">'+icon('undo')+'Вернуть картинку</div><div class="hint">Восстановить исходное положение и размер.</div>',status:'Основная картинка плана',deleteReason:'Чтобы убрать картинку, измените вид подложки<br>в настройках пространства.'},
led:{editor:'devices',title:'Подсветка кухни',meta:'LED-лента · Первый этаж',icon:'led',
position:row(field('Центр · X','1 000','см','readonly'),field('Центр · Y','220','см','readonly'))+'<div class="hint">Положение определяется точками ленты.</div>',
geometry:row(field('Длина ленты','600','см','readonly'),disabled('Высота на плане','см'))+row(disabled('Угол','°'),disabled('Масштаб','%'))+'<div class="hint">Перемещайте точки ленты на плане.</div>',
appearance:emptyAppearance,features:'<div class="action-button">'+icon('settings')+'Открыть настройки устройства</div><div class="hint">При отображении значком устройство<br>и его настройки сохраняются.</div>',status:'LED-лента · Подсветка кухни'}
};
const which=new URLSearchParams(location.search).get('variant')||'rectangle';
const v=variants[which],edNames={plan:'План',devices:'Устройства',decor:'Подложка'};
function tool(label,ico,active=false){return '<div class="tool '+(active?'active':'')+'">'+icon(ico)+label+'</div>';}
const tools={plan:tool('Выбрать','cursor',true)+'<div class="tool-sep"></div>'+tool('Контур','plan')+tool('Стена','wall')+tool('Проём','door')+tool('Колонна','plus')+tool('Лестница','size'),
devices:tool('Выбрать','cursor',true)+'<div class="tool-sep"></div>'+tool('Добавить устройство','plus')+tool('LED-лента','led'),
decor:tool('Выбрать','cursor',true)+'<div class="tool-sep"></div>'+tool('Подложка','image')+tool('Линия','line')+tool('Фигура','rect')+tool('Текст','text')+tool('Мебель','furniture')+tool('Изображение','image')};
const contextual = v.featureTitle ? section('features',v.featureTitle,v.icon,v.features) : (v.features ? '<div class="section features no-title">'+v.features+'</div>' : '');
const secondaryAction = ['device','led'].includes(which) ? '<div class="action-copy" title="Создать рядом виртуальную копию устройства">'+icon('copy')+'Копировать</div>' : (which==='image' ? '<div class="action-copy" title="Заменить изображение">'+icon('image')+'Заменить…</div>' : '');
const deleteAction = v.deleteReason ? '<div class="delete-wrap"><div class="action-delete disabled" role="button" aria-disabled="true" tabindex="0">'+icon('trash')+'Удалить</div><div class="action-tooltip" role="tooltip">'+v.deleteReason+'</div></div>' : '<div class="action-delete">'+icon('trash')+'Удалить</div>';
const primaryAction = which==='led' ? '<div class="action-display">'+icon('devices')+'<span>Отображать<br>как устройство</span></div>' : deleteAction;
const actionFooter = '<footer class="panel-foot"><div class="object-actions '+(!secondaryAction?'solo':'')+'">'+secondaryAction+primaryAction+'</div><div class="foot-help"><div><span class="key">'+(which==='text'?'Ctrl Enter':'Enter')+'</span><span>Применить</span></div><div><span class="key">Esc</span><span>Отменить ввод</span></div><div><span class="key">Ctrl Z</span><span>Отменить правку</span></div></div></footer>';
document.getElementById('app').innerHTML='<header class="top"><div class="brand">'+icon('house')+'Houseplan</div><div class="divider"></div><div class="space"><b>Мой дом</b><span>/</span><b>Первый этаж</b><span>⌄</span></div><nav class="editor-tabs"><div class="editor-tab">'+icon('eye')+'Просмотр</div>'+Object.keys(edNames).map(k=>'<div class="editor-tab '+(k===v.editor?'active':'')+'">'+icon(k)+edNames[k]+'</div>').join('')+'</nav><div class="top-right"><i class="saved-dot"></i>Все изменения применены<div class="avatar">С</div></div></header><main class="workspace"><div class="tools">'+tools[v.editor]+'<div class="tools-right"><div class="tool tool-only">'+icon('undo')+'</div><div class="tool tool-only disabled">'+icon('redo')+'</div></div></div><div class="canvas mode-'+v.editor+'"><div id="scene"></div><div class="selection-pill">'+icon(v.icon)+v.status+'</div><div class="zoom"><span class="z">−</span><span>100%</span><span class="z">+</span>'+icon('size')+'</div><div class="scale"><div></div>1 м</div></div><div class="statusbar"><span>'+edNames[v.editor]+' · Выбрать</span><span>Выделен 1 объект</span><span>Сетка: 10 см</span></div></main><aside class="panel"><header class="panel-head"><div class="heading">Свойства<span class="clear">'+icon('close')+'Снять выделение</span></div><div class="object-title">'+v.title+'</div><div class="object-meta">'+v.meta+'</div></header>'+section('position','Положение','xy',v.position)+section('geometry','Геометрия','size',v.geometry)+section('appearance','Оформление','palette',v.appearance)+contextual+actionFooter+'</aside>';
const teal='#078a9e';
function handle(x,y){return '<rect x="'+(x-4)+'" y="'+(y-4)+'" width="8" height="8" fill="#fff" stroke="'+teal+'" stroke-width="1.5"/>';}
function pivot(x,y){return '<circle cx="'+x+'" cy="'+y+'" r="4" fill="#fff" stroke="'+teal+'" stroke-width="1.5"/><path d="M'+(x-7)+' '+y+'h14M'+x+' '+(y-7)+'v14" stroke="'+teal+'" stroke-width="1"/>';}
function bounds(x,y,w,h,angle=0){return '<g transform="rotate('+angle+' '+(x+w/2)+' '+(y+h/2)+')"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="none" stroke="'+teal+'" stroke-width="1.7"/>'+[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(p=>handle(...p)).join('')+'<path d="M'+(x+w/2)+' '+y+'v-24" stroke="'+teal+'"/><circle cx="'+(x+w/2)+'" cy="'+(y-24)+'" r="4" fill="#fff" stroke="'+teal+'" stroke-width="1.5"/>'+pivot(x+w/2,y+h/2)+'</g>';}
function tag(x,y,text){return '<g><rect x="'+x+'" y="'+y+'" width="'+(text.length*7+22)+'" height="26" rx="4" fill="#fff" stroke="#9dcfd7"/><text x="'+(x+11)+'" y="'+(y+17)+'" font-size="12" fill="#167e8e">'+text+'</text></g>';}
function device(x,y,selected=false,type='devices'){return '<g transform="translate('+x+' '+y+')">'+(selected?'<circle r="29" fill="#078a9e12" stroke="'+teal+'" stroke-width="2"/>'+handle(29,0):'')+'<circle r="19" fill="#fff" stroke="'+(selected?teal:'#cbd5db')+'" stroke-width="1.4"/><g transform="translate(-11 -11) scale(.92)" fill="none" stroke="'+(selected?teal:'#87969f')+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+shapes[type]+'</g></g>';}
function objects(){
 let s='<g class="demo-decor" opacity="'+(v.editor==='decor'?'1':'.28')+'"><g transform="rotate(15 520 340)"><rect x="400" y="280" width="240" height="120" rx="1" fill="#C4D5CF" fill-opacity=".65" stroke="#718B82" stroke-width="1.6"/></g>';
 s+='<g transform="rotate(-12 1180 650)" opacity=".8"><rect x="1112" y="558" width="136" height="184" fill="#cfc3aa"/><rect x="1121" y="567" width="118" height="166" fill="#e4dacc" stroke="#b7a98b"/><path d="m1127 580 106 142m-106-119 106 119m-106-96 90 96m-90-73 67 73m-67-50 44 50m-44-27 21 27M1145 577l88 118m-65-118 65 95m-42-95 42 72m-19-72 19 49" stroke="#b8a787" stroke-width="2" opacity=".7"/></g>';
 s+='<text id="decor-text" x="700" y="690" text-anchor="middle" dominant-baseline="middle" fill="#526871" font-size="18">'+(which==='text'?(variableDialog?'На кухне':'На кухне 22,4 °C'):'Добро пожаловать')+'</text></g>';
 s+='<path d="M400 440H640" stroke="#8b979e" stroke-width="10" fill="none"/>';
 s+='<g opacity="'+(v.editor==='devices'?'1':'.18')+'">'+(which==='led'?'':device(1040,320,which==='device'))+device(340,220,false,'adjust')+device(1210,520,false,'devices')+device(430,690,false,'devices')+device(920,650,false,'adjust')+'</g>';
 if(which==='wall')s+='<path d="M400 440H640" stroke="'+teal+'" stroke-width="13" opacity=".22"/><path d="M400 440H640" stroke="'+teal+'" stroke-width="2"/>'+handle(400,440)+handle(640,440)+tag(377,464,'A')+tag(618,464,'B')+'<path d="M400 415v-12m0 6h240m0-6v12" stroke="'+teal+'" fill="none"/><text x="520" y="395" text-anchor="middle" font-size="13" fill="'+teal+'">300 см</text>';
 if(which==='opening')s+='<path d="M800 360H880A80 80 0 0 1 800 440" fill="#078a9e10" stroke="'+teal+'" stroke-width="2"/><path d="M800 360V440" stroke="'+teal+'" stroke-width="3" stroke-dasharray="4 3"/>'+handle(800,440)+pivot(800,400)+tag(885,386,'Дверь · 100 см')+'<path d="M800 160H750M800 360H750M758 160V360M752 166l12-12M752 366l12-12" fill="none" stroke="'+teal+'" stroke-width="1.2"/><text x="742" y="260" transform="rotate(-90 742 260)" text-anchor="middle" font-size="13" fill="'+teal+'">250 см</text><circle cx="800" cy="160" r="5" fill="#fff" stroke="'+teal+'" stroke-width="2"/><path d="M806 159L832 153" stroke="'+teal+'"/>'+tag(834,135,'От этого угла')+'<path d="M806 360L895 347" stroke="'+teal+'"/>'+tag(895,330,'Петли')+'<circle cx="800" cy="360" r="6" fill="'+teal+'" stroke="#fff" stroke-width="2"/>';
 if(which==='rectangle')s+=bounds(400,280,240,120,15)+tag(423,227,'Прямоугольник');
 if(which==='text')s+=(variableDialog?bounds(660,677,80,26):bounds(620,677,160,26))+tag(630,730,'Текст');
 if(which==='image')s+=bounds(1112,558,136,184,-12)+tag(1120,778,'Ковёр.png');
 if(which==='device')s+=tag(1078,306,'Подсветка кухни');
 if(which==='contour')s+='<path d="M240 160H800" stroke="'+teal+'" stroke-width="14" opacity=".20"/><path d="M240 160H800" stroke="'+teal+'" stroke-width="2"/>'+handle(240,160)+handle(800,160)+tag(226,112,'A')+tag(786,112,'B');
 if(which==='backdrop')s+=bounds(240,160,1080,640)+tag(690,818,'План этажа.png');
 if(which==='led')s+='<path d="M840 296H1240V376" stroke="'+teal+'" stroke-width="16" opacity=".15" stroke-linejoin="round" fill="none"/><path d="M840 296H1240V376" stroke="'+teal+'" stroke-width="4" stroke-linejoin="round" fill="none"/>'+handle(840,296)+handle(1240,296)+handle(1240,376)+tag(950,252,'Подсветка кухни · LED-лента');
 return s;
}
// The raster renderer inserts the verified shared plan; the source page has no interaction handlers.
window.mountScene=(svg)=>{
 const content=svg.replace(/<\?xml[\s\S]*?\?>/,'').replace('<svg','<svg class="scene"').replace('</svg>',objects()+'</svg>');
 document.getElementById('scene').innerHTML=content;
};
if(variableDialog){
 document.getElementById('app').insertAdjacentHTML('beforeend','<div class="modal-shade"></div><section class="variable-dialog" role="dialog" aria-label="Вставить переменную HA"><header><h1>Вставить переменную HA</h1>'+icon('close')+'</header><div class="dialog-body"><div class="dialog-label">Сущность</div><div class="entity-picker"><div>'+icon('temperature')+'</div><div><b>Температура на кухне</b><small>sensor.kitchen_temperature</small></div><span class="dropdown-arrow">⌄</span></div><div class="dialog-label">Значение</div><div class="dialog-select"><span>Состояние</span><span>⌄</span></div><div class="variable-preview"><div>Предпросмотр</div><strong>На кухне 22,4 °C</strong></div></div><footer><div class="dialog-cancel">Отмена</div><div class="dialog-insert">'+icon('plus')+'Вставить</div></footer></section>');
}
