// Риск по изменённым участкам (#707, PROCESS.md §5): одна чистая функция над
// `git diff --unified=0 <merge-base>..<head>`.
//
// Трек `ship`/`show` держится на «решать нечего», а рамки ship считают строки
// и файлы, но не видят, ЧТО тронуто: обработчик `pointerdown` в двенадцать
// строк проходил их так же, как опечатка. Здесь судится изменённая строка, а не
// файл: правило «участок» — любая изменённая строка кода в файле из списка,
// правило «токен» — токен в изменённой строке любого файла класса A (§1).
// Монолиты (`houseplan-card.ts`, `houseplan-editor-runtime.ts`) судятся только
// токенами: ни один шаблон участка их не задевает, и тест держит это
// («монолит участком не судится»). Пустые строки, комментарии, строки импорта и
// строки только типов TypeScript риска не дают (#755) — кроме файлов участка
// `migration`, где типы конфига и есть контракт.
//
// Таблица — эвристика (ТЗ #707 §10 п.2): пути и токены меняются свободно,
// каждая строка покрыта положительным и отрицательным случаем в
// `test/process-track.test.mjs`. Ложное срабатывание стоит одного ревью модели,
// пропуск — не хуже, чем без проверки.
import { classify } from './change-classes.mjs';

/** Классы в порядке печати. `visual` — единственный, что ship не повышает. */
export const RISK_CLASSES = Object.freeze(['geometry', 'touch', 'migration', 'devices', 'perf', 'ux', 'visual']);
export const RAISING_CLASSES = Object.freeze(RISK_CLASSES.filter((cls) => cls !== 'visual'));
/** На класс печатается не больше стольких доказательств; классифицируются все ханки. */
export const RISK_EVIDENCE_LIMIT = 5;

const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
/** `wall-*` → `src/wall-<что угодно>.ts` верхнего уровня `src/`. */
const src = (glob) => ({ label: glob, re: new RegExp(`^src/${escape(glob).replace(/\*/g, '[^/]*')}\\.ts$`) });
const py = (stem) => ({ label: `${stem}.py`, re: new RegExp(`^custom_components/houseplan/${stem}\\.py$`) });
const path = (label, re) => ({ label, re });

const RENDER_DIR = path('src/render/**', /^src\/render\//);

/** Правило «участок»: класс → файлы, любая изменённая строка кода которых даёт класс. */
const AREAS = {
  geometry: [
    ...['physical-geometry', 'space-geometry', 'wall-*', 'junction-limits', 'coincident-partitions',
      'coordinate-canonicalization', 'opening-*', 'partition-openings', 'open-spans', 'near-axis', 'align-grid',
      // #755: лестница — модель и преобразования; `stairs-view` (отрисовка) — в
      // `visual:render`, указатель `stairs-editor` ловят токены touch.
      'grid-scale', 'room-fit', 'resize*', 'stairs', 'stairs-box', 'stairs-editor-model',
      'radar-geometry', 'zigbee-topology-geometry',
      'device-marker-geometry', 'plan-geometry-preflight', 'plan-optimizer', 'zero-walls', 'iso-projection'].map(src),
    ...['geometry_migration', 'coordinate_canonicalization', 'junction_limits', 'wall_segment_model',
      'radar_geometry', 'projection'].map(py),
  ],
  touch: ['pointer-modality', 'pointer-move-queue', 'touch-gesture-click-guard', 'live-interaction-runtime',
    'live-viewport', 'viewport-transition', 'room-gear-drag'].map(src),
  migration: [
    // #755: запись и приём конфига, а не всё `config-*`: мемо отпечатка
    // (`config-fingerprint-pass`) о схеме не знает.
    ...['types', 'wall-tool-compat', 'config-adoption', 'config-store', 'config-reload-authority',
      'config-write-conflict'].map(src),
    ...['store', 'geometry_migration', 'import_export', 'validation'].map(py),
  ],
  devices: [
    ...['device-toggle', 'marker-toggle-entity', 'integration-provider', 'virtual-light-state', 'vacuum*',
      'device-hit-owner'].map(src),
    ...['auth', 'http_api', 'websocket_api', 'virtual_lights', 'vacuum_routes'].map(py),
  ],
  perf: [RENDER_DIR, ...['render-*', 'houseplan-render-lifecycle', 'iso-scene-render', 'glow-*', 'day-cycle-render',
    'initial-load', 'boot-soft-layout'].map(src)],
  'visual:render': [RENDER_DIR, ...['iso-*', 'glow-*', 'day-cycle-render', 'space-render', 'stairs-view',
    'device-visual', 'device-face'].map(src), path('*.generated.ts', /^src\/(?:.*\/)?[^/]*\.generated\.ts$/)],
  'visual:ui': [
    path('src/styles/**', /^src\/styles\//),
    path('src/styles.ts', /^src\/styles\.ts$/),
    path('src/**/*styles*.ts', /^src\/(?:.*\/)?[^/]*styles[^/]*\.ts$/),
    path('src/**/*-style.ts', /^src\/(?:.*\/)?[^/]*-style\.ts$/),
  ],
};

/**
 * Правило «токен»: класс → регулярное выражение по изменённой строке файла
 * класса A (кроме JSON — у переводов своё правило `ux`: текст перевода со словом
 * «thickness» не геометрия). `snapshot` не `snapTo*`: геометрия — только привязка.
 */
const TOKENS = {
  geometry: /[\w$]*(?:thickness|canonicaliz|junction|snap(?:to|pt))[\w$]*/gi,
  touch: /(?:pointer(?:down|up|move|cancel)|touch(?:start|end|move|cancel))(?![a-z])|PointerEvent|TouchEvent|(?:set|release)PointerCapture|pointerType|touch-action|dblclick|contextmenu/g,
  migration: /[\w$]*migrat[\w$]*|STORAGE_VERSION|schema_version/gi,
  devices: /callService|turn_on|turn_off|is_admin|require_admin/g,
  perf: /requestAnimationFrame|(?:Resize|Intersection|Mutation)Observer|getBoundingClientRect|getComputedStyle|offset(?:Width|Height|Top|Left)|will-change|backdrop-filter|(?<![\w$])filter:/g,
  // SVG-атрибут с `=` или `:` — разметкой, объектом стиля или CSS.
  'visual:render': /(?<![\w$-])(?:stroke(?:-(?:width|dasharray|linecap|linejoin))?|fill(?:-opacity)?|opacity|viewBox|shape-rendering|vector-effect)(?=['"]?\s*[=:])/g,
};

/** Правило `ux`: только добавленные строки. */
const I18N_FILE = [/^src\/i18n\/(?:.*\/)?[^/]+\.json$/, /^custom_components\/(?:.*\/)?translations\/[^/]+\.json$/];
const JSON_KEY = /^\s*"((?:[^"\\]|\\.)+)"\s*:/;
const DEFINE = 'customElements.define(';

/** Пустая строка или строка-комментарий риска не даёт. */
export function isCommentOrBlank(text, file = '') {
  const line = String(text).trim();
  if (!line) return true;
  if (/^(?:\/\/|\/\*|\*\/|\*|<!--)/.test(line)) return true;
  return file.endsWith('.py') && line.startsWith('#');
}

/**
 * Строки модулей и типов TypeScript (#755) риска не дают, как комментарий:
 * поведение меняет код, который читает импорт или тип, а его строки судятся как
 * прежде. Это оператор `import …`, `export … from …`, `export type …`, голова
 * `interface X`/`type X =` и строки внутри такого блока: с отступом и
 * закрывающая строка без отступа.
 */
const MODULE_LINE = /^(?:import\s|export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*['"]|\}\s*from\s*['"])/;
const TYPE_LINE = /^(?:export\s+(?:declare\s+)?type\s|(?:export\s+)?(?:declare\s+)?(?:interface\s+[\w$]|type\s+[\w$]+\s*(?:<.*>)?\s*=))/;
/** Строка-оператор, после которой блок декларации ещё открыт: `import {`, `interface X {`, `type X =`. */
const OPENS_BLOCK = /[{=(<,|&]\s*$/;
export const isModuleOrTypeStatement = (text) => MODULE_LINE.test(text) || TYPE_LINE.test(text);
const opensBlock = (text) => isModuleOrTypeStatement(text) && OPENS_BLOCK.test(text);

/**
 * Номера строк `rows` (из `parseUnifiedDiff`), которые по #755 — модули или
 * только типы. Состояние «внутри блока декларации» ведётся по каждой стороне
 * каждого блока изменений: начальное — по контексту ханка (git пишет в
 * `@@ … @@ <контекст>` последнюю строку без отступа перед ханком, в старой
 * версии; атрибутов diff для `.ts` в репозитории нет), дальше его меняет каждая
 * строка без отступа внутри блока. Так член интерфейса под заголовком
 * `@@ … @@ export interface X {` и целиком добавленный интерфейс судятся одинаково.
 */
export function moduleOrTypeRows(rows = []) {
  const out = new Set();
  const open = new Map();
  rows.forEach((row, i) => {
    const key = `${row.block ?? 0}${row.side}`;
    if (!open.has(key)) open.set(key, opensBlock(row.ctx ?? ''));
    const text = String(row.text);
    if (!text || /^\s/.test(text)) {
      if (open.get(key)) out.add(i);
      return;
    }
    if (/^(?:\/\/|\/\*|\*)/.test(text)) return;
    if (open.get(key) && /^[}\])>]/.test(text)) {
      out.add(i);
      open.set(key, false);
      return;
    }
    if (isModuleOrTypeStatement(text)) out.add(i);
    open.set(key, opensBlock(text));
  });
  return out;
}

/**
 * Разбор `git diff --unified=0` (подходит и с контекстом): файлы и их изменённые
 * строки с номерами. Удалённая строка несёт номер и путь старой стороны,
 * добавленная — новой. Переименование без правки ханков не даёт, двоичный файл —
 * тоже (его ловят рамки ship).
 *
 * Каждая строка несёт ещё `ctx` — контекст своего блока изменений (#755: для
 * первого блока ханка — текст заголовка `@@ … @@ <контекст>`, для следующих —
 * последняя строка контекста без отступа), `block` — номер блока в файле и
 * `at` — номер строки своей стороны в блоке: удалённая и добавленная с одним
 * `at` — одна заменённая строка.
 */
export function parseUnifiedDiff(text = '') {
  const files = [];
  let file = null;
  let oldLine = 0; let newLine = 0; let oldLeft = 0; let newLeft = 0;
  let ctx = ''; let block = -1; let inBlock = false; let atOld = 0; let atNew = 0;
  const unquote = (p) => (p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p);
  const row = (side, line, body) => {
    if (!inBlock) { block += 1; inBlock = true; atOld = 0; atNew = 0; }
    const at = side === '-' ? atOld++ : atNew++;
    file.lines.push({ side, line, text: body, ctx, block, at });
  };
  for (const raw of String(text).split('\n')) {
    if (file && (oldLeft > 0 || newLeft > 0)) {
      if (raw.startsWith('-') && oldLeft > 0) {
        row('-', oldLine, raw.slice(1)); oldLine += 1; oldLeft -= 1; continue;
      }
      if (raw.startsWith('+') && newLeft > 0) {
        row('+', newLine, raw.slice(1)); newLine += 1; newLeft -= 1; continue;
      }
      if (raw.startsWith(' ')) {
        // Контекст как у git: строка, начинающаяся с буквы, `_` или `$`.
        if (/^[A-Za-z_$]/.test(raw.slice(1))) ctx = raw.slice(1);
        inBlock = false; oldLine += 1; newLine += 1; oldLeft -= 1; newLeft -= 1; continue;
      }
      if (raw.startsWith('\\')) continue;
      oldLeft = 0; newLeft = 0;
    }
    let m;
    if ((m = /^diff --git (?:"?a\/)(.+?)"? (?:"?b\/)(.+?)"?$/.exec(raw))) {
      file = { oldPath: m[1], newPath: m[2], lines: [] };
      files.push(file);
      block = -1; inBlock = false;
      continue;
    }
    if (!file) continue;
    if ((m = /^--- (.+)$/.exec(raw))) { file.oldPath = m[1] === '/dev/null' ? null : unquote(m[1]).replace(/^a\//, ''); continue; }
    if ((m = /^\+\+\+ (.+)$/.exec(raw))) { file.newPath = m[1] === '/dev/null' ? null : unquote(m[1]).replace(/^b\//, ''); continue; }
    if ((m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/.exec(raw))) {
      oldLine = Number(m[1]); oldLeft = m[2] === undefined ? 1 : Number(m[2]);
      newLine = Number(m[3]); newLeft = m[4] === undefined ? 1 : Number(m[4]);
      ctx = m[5]; inBlock = false;
    }
  }
  return files;
}

/** Риск диффа без единого класса: этап spec, ветки нет, инфраструктура. */
export const emptyRisk = () => ({ classes: [], raising: [], visual: { render: false, ui: false }, evidence: {}, counts: {} });

/**
 * Классы риска диффа с доказательствами `путь:строка · правило`.
 * `raising` — классы, которые повышают ship (все, кроме `visual`);
 * `visual.render` / `visual.ui` — область визуального риска; `evidence` — не
 * больше `RISK_EVIDENCE_LIMIT` строк на класс, `counts` — сколько всего.
 */
export function classifyRisk(diffText = '') {
  // класс → ключ строки → { path, line, side, rules }
  const hits = new Map();
  const add = (cls, where, rule) => {
    if (!hits.has(cls)) hits.set(cls, new Map());
    const key = `${where.side}${where.path}:${where.line}`;
    const entry = hits.get(cls).get(key) || { ...where, rules: [] };
    if (!entry.rules.includes(rule)) entry.rules.push(rule);
    hits.get(cls).set(key, entry);
  };
  const areas = { render: false, ui: false };
  for (const file of parseUnifiedDiff(diffText)) {
    const removedKeys = new Set();
    for (const row of file.lines) {
      const p = row.side === '-' ? file.oldPath : file.newPath;
      if (row.side !== '-' || !p || !I18N_FILE.some((re) => re.test(p))) continue;
      const key = JSON_KEY.exec(row.text);
      if (key) removedKeys.add(key[1]);
    }
    const typeOnly = moduleOrTypeRows(file.lines);
    // Добавленная строка блока по `at`: пара для удалённой — одна заменённая строка.
    const addedAt = new Map(file.lines.filter((r) => r.side === '+').map((r) => [`${r.block}:${r.at}`, r]));
    for (const [i, row] of file.lines.entries()) {
      const p = row.side === '-' ? file.oldPath : file.newPath;
      if (!p || classify(p) !== 'A' || isCommentOrBlank(row.text, p)) continue;
      // #755: типы конфига — контракт, в участке migration строки типов судятся.
      if (typeOnly.has(i) && p.endsWith('.ts') && !AREAS.migration.some((r) => r.re.test(p))) continue;
      const where = { path: p, line: row.line, side: row.side };
      const pair = row.side === '-' && file.newPath ? addedAt.get(`${row.block}:${row.at}`) : null;
      if (pair) where.pair = `+${file.newPath}:${pair.line}`;
      for (const [cls, rules] of Object.entries(AREAS)) {
        const rule = rules.find((r) => r.re.test(p));
        if (rule) add(cls, where, `участок ${rule.label}`);
      }
      if (!p.endsWith('.json')) {
        for (const [cls, re] of Object.entries(TOKENS)) {
          re.lastIndex = 0;
          const found = [...new Set([...row.text.matchAll(re)].map((m) => m[0]))];
          for (const token of found) add(cls, where, `токен ${token}`);
        }
      }
      if (row.side === '+') {
        if (I18N_FILE.some((re) => re.test(p))) {
          const key = JSON_KEY.exec(row.text);
          if (key && !removedKeys.has(key[1])) add('ux', where, `новый ключ "${key[1]}"`);
        }
        if (row.text.includes(DEFINE)) add('ux', where, `токен ${DEFINE}`);
      }
    }
  }
  const risk = emptyRisk();
  const merged = new Map();
  for (const [cls, entries] of hits) {
    const name = cls.startsWith('visual:') ? 'visual' : cls;
    if (cls === 'visual:render') areas.render = true;
    if (cls === 'visual:ui') areas.ui = true;
    if (!merged.has(name)) merged.set(name, new Map());
    for (const [key, entry] of entries) {
      const into = merged.get(name).get(key) || { ...entry, rules: [] };
      const area = cls.startsWith('visual:') ? ` (${cls.slice('visual:'.length)})` : '';
      for (const rule of entry.rules) if (!into.rules.includes(`${rule}${area}`)) into.rules.push(`${rule}${area}`);
      merged.get(name).set(key, into);
    }
  }
  // #755: заменённая строка — одно доказательство, а не «удалена» и новая рядом:
  // удалённая уходит в свою пару, если та дала тот же класс.
  for (const entries of merged.values()) {
    for (const [key, entry] of entries) {
      const into = entry.pair && entries.get(entry.pair);
      if (!into) continue;
      for (const rule of entry.rules) if (!into.rules.includes(rule)) into.rules.push(rule);
      entries.delete(key);
    }
  }
  for (const cls of RISK_CLASSES) {
    const entries = merged.get(cls);
    if (!entries?.size) continue;
    risk.classes.push(cls);
    const list = [...entries.values()];
    risk.counts[cls] = list.length;
    risk.evidence[cls] = list.slice(0, RISK_EVIDENCE_LIMIT).map((e) => `${e.path}:${e.line}${e.side === '-' ? ' (удалена)' : ''} · ${e.rules.join(', ')}`);
  }
  risk.raising = risk.classes.filter((cls) => RAISING_CLASSES.includes(cls));
  risk.visual = areas;
  return risk;
}

/** Строка класса для комментария, промпта и пакета: `touch: a:1 · …; b:2 · … и ещё N`. */
export function riskClassLine(risk, cls) {
  const evidence = risk?.evidence?.[cls] || [];
  const more = (risk?.counts?.[cls] ?? evidence.length) - evidence.length;
  const area = cls === 'visual'
    ? ` (${[risk.visual?.render && 'render', risk.visual?.ui && 'ui'].filter(Boolean).join(', ')})` : '';
  return `${cls}${area}: ${evidence.join('; ')}${more > 0 ? `; и ещё ${more}` : ''}`;
}
