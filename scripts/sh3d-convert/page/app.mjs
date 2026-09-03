/**
 * Страница /convert: интерфейс конвертера (#446).
 *
 * Вся конверсия идёт здесь, в браузере. Ни одного сетевого вызова на этой
 * странице нет и быть не должно: план дома — приватные данные, а сама страница
 * живёт на хосте, который по нашему описанию расходный и потенциально
 * враждебный. Отсутствие `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon`
 * проверяется тестом по собранному артефакту, а не обещанием в тексте.
 *
 * Отчёт показывается ДО скачивания — это требование задачи, а не украшение:
 * человек должен узнать про спрямлённую дугу и непривязанную дверь заранее, а
 * не искать их потом в плане из сотен объектов.
 */
import { readSh3d } from '../sh3d.mjs';
import { ConvertError, MIN_HOUSEPLAN, convertHome } from '../convert.mjs';

const TOOL_VERSION = 'sh3d-convert 0.1';
const MAX_FILE_BYTES = 64 * 1024 * 1024;

/** Словари вынесены в экспорт: полноту ключей проверяет тест страницы. */
export const TEXT = {
  ru: {
    'page.title': 'Конвертер Sweet Home 3D → House Plan',
    'page.lead': 'Файл плана из Sweet Home 3D превращается в документ импорта House Plan — по одному на этаж.',
    'page.privacy': 'Конверсия идёт в вашем браузере. Файл никуда не загружается: страница не делает ни одного сетевого запроса.',
    'page.requires': `Требуется House Plan ${MIN_HOUSEPLAN} или новее.`,
    'drop.title': 'Перетащите сюда файл .sh3d',
    'drop.or': 'или',
    'drop.button': 'Выбрать файл',
    'drop.hint': 'Ничего не уходит с вашего компьютера',
    'busy': 'Читаю файл…',
    'result.title': 'Что получилось',
    'result.download': 'Скачать этаж',
    'result.rooms': 'комнат',
    'result.walls': 'стен',
    'result.openings': 'проёмов',
    'result.cell': 'клетка сетки',
    'result.skipped': 'этаж пропущен: комнат нет',
    'result.notes': 'На что посмотреть после импорта',
    'howto.title': 'Как импортировать',
    'howto.1': 'Откройте карточку House Plan → Общие настройки → Резервная копия и перенос.',
    'howto.2': 'Выберите импорт и укажите скачанный файл: House Plan покажет предпросмотр и ничего не запишет до подтверждения.',
    'howto.3': 'Этаж добавится рядом с существующими пространствами. Привязку комнат к областям Home Assistant и расстановку устройств сделайте в редакторе — в файле их нет.',
    'error.title': 'Не получилось',
    'error.retry': 'Выбрать другой файл',
    'back': 'На главную',
    'note.vertices_snapped': 'Вершины комнат выровнены по осевым линиям стен: {count}. Sweet Home 3D обводит комнаты по внутренним граням, иначе общая стена превратилась бы в две.',
    'note.curved_wall_straightened': 'Круглых стен спрямлено: {count}. Дуг в House Plan нет.',
    'note.thickness_clamped': 'Стен толще {limit} см обрезано до предела: {count}.',
    'note.edge_without_wall': 'Границ без стены: {count}. Такая граница останется открытой — стены в файле там не было.',
    'note.opening_unhosted': 'Проём не привязался ни к одной стене и не перенесён: {id}.',
    'note.opening_shortened': 'Проём шире стены и обрезан до неё: {id}.',
    'note.opening_without_width': 'Проём без ширины пропущен: {id}.',
    'note.room_without_polygon': 'Комната без контура пропущена: {id}.',
    'note.room_collapsed': 'Контур комнаты рассыпался после выравнивания и пропущен: {id}.',
    'note.level_without_rooms': 'Этаж «{title}» пропущен: в нём нет ни одной комнаты. House Plan строит геометрию по комнатам — нарисуйте их в Sweet Home 3D.',
    'note.furniture_dropped': 'Мебель, материалы, свет и камеры не переносятся: House Plan — живая карта дома, а не редактор интерьера.',
    'code.not_zip': 'Это не файл Sweet Home 3D: архив не читается.',
    'code.entry_missing': 'В архиве нет Home.xml. Пересохраните план в Sweet Home 3D 5.3 или новее.',
    'code.encrypted': 'Архив защищён паролем.',
    'code.zip64': 'Такой архив (zip64) не поддерживается.',
    'code.entry_too_large': 'Файл слишком большой.',
    'code.entity_declaration': 'В файле объявлены XML-сущности — такой файл не читается.',
    'code.entity_reference': 'В файле есть неизвестная XML-сущность.',
    'code.nothing_to_convert': 'В плане нет ни одной комнаты. House Plan строит геометрию по комнатам: нарисуйте их в Sweet Home 3D и сохраните файл заново.',
    'code.room_too_complex': 'Слишком сложный контур комнаты.',
    'code.unit_not_metric': 'План сохранён не в метрических единицах.',
    'code.file_too_large': 'Файл больше 64 МБ.',
    'code.unknown': 'Неизвестная ошибка чтения файла.',
  },
  en: {
    'page.title': 'Sweet Home 3D → House Plan converter',
    'page.lead': 'Turns a Sweet Home 3D file into House Plan import documents — one per level.',
    'page.privacy': 'The conversion runs in your browser. The file is never uploaded: this page makes no network requests at all.',
    'page.requires': `Requires House Plan ${MIN_HOUSEPLAN} or newer.`,
    'drop.title': 'Drop a .sh3d file here',
    'drop.or': 'or',
    'drop.button': 'Choose a file',
    'drop.hint': 'Nothing leaves your computer',
    'busy': 'Reading the file…',
    'result.title': 'What came out',
    'result.download': 'Download level',
    'result.rooms': 'rooms',
    'result.walls': 'walls',
    'result.openings': 'openings',
    'result.cell': 'grid cell',
    'result.skipped': 'level skipped: no rooms',
    'result.notes': 'What to check after the import',
    'howto.title': 'How to import',
    'howto.1': 'Open the House Plan card → General settings → Backup & transfer.',
    'howto.2': 'Pick import and choose the downloaded file: House Plan shows a preview and writes nothing until you confirm.',
    'howto.3': 'The level is added next to your existing spaces. Bind rooms to Home Assistant areas and place devices in the editor — the file carries neither.',
    'error.title': 'That did not work',
    'error.retry': 'Choose another file',
    'back': 'Back to the site',
    'note.vertices_snapped': 'Room vertices aligned to wall centrelines: {count}. Sweet Home 3D traces rooms along inner faces, so without this a shared wall would become two.',
    'note.curved_wall_straightened': 'Curved walls straightened: {count}. House Plan has no arcs.',
    'note.thickness_clamped': 'Walls thicker than {limit} cm clamped to the limit: {count}.',
    'note.edge_without_wall': 'Boundaries without a wall: {count}. They stay open — there was no wall in the file.',
    'note.opening_unhosted': 'This opening matched no wall and was skipped: {id}.',
    'note.opening_shortened': 'Opening wider than its wall, shortened to fit: {id}.',
    'note.opening_without_width': 'Opening without a width, skipped: {id}.',
    'note.room_without_polygon': 'Room without an outline, skipped: {id}.',
    'note.room_collapsed': 'Room outline collapsed after alignment and was skipped: {id}.',
    'note.level_without_rooms': 'Level “{title}” skipped: it has no rooms. House Plan builds geometry from rooms — draw them in Sweet Home 3D.',
    'note.furniture_dropped': 'Furniture, materials, lights and cameras are not carried over: House Plan is a live map of the home, not an interior editor.',
    'code.not_zip': 'This is not a Sweet Home 3D file: the archive cannot be read.',
    'code.entry_missing': 'The archive has no Home.xml. Re-save the plan in Sweet Home 3D 5.3 or newer.',
    'code.encrypted': 'The archive is password protected.',
    'code.zip64': 'This archive (zip64) is not supported.',
    'code.entry_too_large': 'The file is too large.',
    'code.entity_declaration': 'The file declares XML entities and cannot be read.',
    'code.entity_reference': 'The file contains an unknown XML entity.',
    'code.nothing_to_convert': 'The plan has no rooms. House Plan builds geometry from rooms: draw them in Sweet Home 3D and save the file again.',
    'code.room_too_complex': 'A room outline is too complex.',
    'code.unit_not_metric': 'The plan is not saved in metric units.',
    'code.file_too_large': 'The file is larger than 64 MB.',
    'code.unknown': 'Unknown error while reading the file.',
  },
};

let lang = 'en';

const fill = (template, values) =>
  String(template).replace(/\{(\w+)\}/g, (whole, key) =>
    (values && values[key] !== undefined ? String(values[key]) : whole));

const t = (key, values) => fill(TEXT[lang][key] ?? TEXT.en[key] ?? key, values);

function applyLanguage(next) {
  lang = TEXT[next] ? next : 'en';
  document.documentElement.lang = lang;
  try {
    localStorage.setItem('hp-convert-lang', lang);
  } catch {
    // Приватный режим: язык просто не запомнится, это не ошибка.
  }
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-lang]')) {
    node.classList.toggle('on', node.dataset.lang === lang);
  }
  if (lastResult) renderResult(lastResult);
}

let lastResult = null;

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const show = (id, visible) => {
  document.getElementById(id).hidden = !visible;
};

function noteText(note) {
  const key = `note.${note.code}`;
  const known = TEXT[lang][key] || TEXT.en[key];
  return known ? fill(known, note) : `${note.code}: ${JSON.stringify(note)}`;
}

function download(name, document_) {
  const blob = new Blob([`${JSON.stringify(document_, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = name;
  link.click();
  // Ссылка живёт ровно до клика: держать её незачем, а память жалко.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderResult(result) {
  lastResult = result;
  const { documents, report, stem } = result;
  const host = document.getElementById('levels');
  host.textContent = '';
  let downloadIndex = 0;
  for (const level of report.levels) {
    const card = element('div', 'level');
    card.append(element('h3', null, level.title || level.id || '—'));
    if (level.skipped) {
      card.append(element('p', 'muted', t('result.skipped')));
    } else {
      const stats = element('p', 'stats');
      stats.textContent = [
        `${level.rooms} ${t('result.rooms')}`,
        `${level.walls} ${t('result.walls')}`,
        `${level.openings} ${t('result.openings')}`,
        `${t('result.cell')}: ${level.cellCm} cm`,
      ].join(' · ');
      card.append(stats);
      const index = downloadIndex++;
      const button = element('button', 'btn primary', t('result.download'));
      button.addEventListener('click', () =>
        download(`${stem}.${level.spaceId}.json`, documents[index]));
      card.append(button);
    }
    const notes = [...(level.notes || [])];
    if (notes.length) {
      card.append(element('h4', 'notes-title', t('result.notes')));
      const list = element('ul', 'notes');
      for (const note of notes) list.append(element('li', null, noteText(note)));
      card.append(list);
    }
    host.append(card);
  }
  const shared = element('ul', 'notes');
  for (const item of report.items) shared.append(element('li', null, noteText(item)));
  document.getElementById('shared-notes').replaceChildren(shared);
  show('result', true);
  show('error', false);
  show('busy', false);
}

function renderError(code, detail) {
  const key = `code.${code}`;
  const known = TEXT[lang][key] || TEXT.en[key];
  document.getElementById('error-text').textContent = known || t('code.unknown');
  const details = document.getElementById('error-detail');
  details.textContent = detail && !known ? detail : '';
  details.hidden = !details.textContent;
  show('error', true);
  show('result', false);
  show('busy', false);
}

async function handleFile(file) {
  if (!file) return;
  lastResult = null;
  show('busy', true);
  show('error', false);
  show('result', false);
  try {
    if (file.size > MAX_FILE_BYTES) {
      renderError('file_too_large');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const home = await readSh3d(bytes);
    const { documents, report } = convertHome(home, { toolVersion: TOOL_VERSION });
    renderResult({
      documents,
      report,
      stem: file.name.replace(/\.sh3d$/i, '') || 'plan',
    });
  } catch (error) {
    const code = error && error.code ? error.code : 'unknown';
    renderError(code, error instanceof ConvertError ? error.message : String(error?.message || ''));
  }
}

export function mount() {
  const input = document.getElementById('file');
  const zone = document.getElementById('drop');
  input.addEventListener('change', () => handleFile(input.files[0]));
  document.getElementById('pick').addEventListener('click', () => input.click());
  document.getElementById('retry').addEventListener('click', () => input.click());
  for (const event of ['dragenter', 'dragover']) {
    zone.addEventListener(event, (raw) => {
      raw.preventDefault();
      zone.classList.add('over');
    });
  }
  for (const event of ['dragleave', 'drop']) {
    zone.addEventListener(event, () => zone.classList.remove('over'));
  }
  zone.addEventListener('drop', (raw) => {
    raw.preventDefault();
    handleFile(raw.dataTransfer?.files?.[0]);
  });
  for (const node of document.querySelectorAll('[data-lang]')) {
    node.addEventListener('click', () => applyLanguage(node.dataset.lang));
  }
  let saved = null;
  try {
    saved = localStorage.getItem('hp-convert-lang');
  } catch {
    saved = null;
  }
  applyLanguage(saved || (String(navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'));
}
