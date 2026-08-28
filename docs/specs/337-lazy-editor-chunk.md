# ТЗ #337 — ленивый editor-runtime и multi-asset frontend

- Issue: https://github.com/Matysh/houseplan-card/issues/337
- Тип: техдолг / производительность
- Приоритет: P2
- Трек: полный — задача влияет на производительность и меняет несколько
  поверхностей и release-asset contract, поэтому не проходит критерии `small`
  из `PROCESS.md` §5
- Связанные задачи: #34 — направление декомпозиции frontend; #62 — единый
  eager-реестр двух текущих языков, lazy i18n в этой задаче отсутствует

## 1. Сценарий

Основная персона — жилец или гость (`docs/SCOPE.md`), который открывает
дашборд Home Assistant на телефоне, планшете или настенной панели, чтобы быстро
увидеть дом и управлять устройствами в View. Он не должен загружать код трёх
администраторских редакторов, пока сам не попросил открыть редактор.

Вторичная персона — владелец/администратор. При первом входе в Plan, Devices
или Background после открытия дашборда он допускает короткое ожидание загрузки,
но не потерю View, текущего пространства, масштаба или незавершённого клика.

## 2. Что человек увидит до и после

До изменения каждый вход на дашборд загружает весь редактор; после изменения
обычный View становится рабочим после заметно меньшей загрузки, а код редактора
подгружается только перед первым фактическим входом в него, без изменения
интерфейса и поведения редакторов.

При редкой ошибке загрузки редактора View остаётся рабочим, а пользователь
видит локализованное сообщение с просьбой обновить страницу вместо зависшей или
наполовину открытой панели.

## 3. Подтверждённое исходное состояние

Замеры выполнены на `origin/dev` `eff786f`, версия 1.68.1:

- `dist/houseplan-card.js` — 1 353 147 B raw / 378 335 B gzip;
- `src/houseplan-card.ts` даёт около 1 052 KiB кода до terser и содержит View,
  editor state machines, команды, панели и диалоги в одном классе;
- backend раздаёт только точный файл
  `/houseplan_files/houseplan-card.js`; относительный chunk сейчас получит 404;
- bundle sync, freshness, demo, CI и release scripts считают артефактом один
  JS-файл;
- консервативная минификация всех текущих статических `css\`\``-литералов
  уменьшает bundle примерно на 32 016 B raw, но только на 2 114 B gzip. Она не
  заменяет реальное code splitting;
- #62 намеренно сохранила `en` и `ru` синхронными/eager. Утверждение старого
  описания #337 о lazy dictionaries неверно и не является предпосылкой ТЗ.

## 4. Цели

1. Не загружать runtime Plan/Devices/Background и editor-only dialogs в первом
   рабочем View.
2. Ограничить сумму gzip initial View graph величиной **250 KiB**.
3. Сохранить наблюдаемое поведение View, переходов, редакторов, конфигурации и
   Home Assistant card editor.
4. Сделать несколько frontend-файлов полноценным проверяемым артефактом HACS,
   backend, demo, CI и release automation.
5. Безопасно минифицировать статические Lit CSS templates без визуальной
   разницы.

## 5. Не-цели

- не менять stored config/layout и не добавлять миграцию;
- не менять UX, состав инструментов, DOM-контракт, pointer thresholds,
  Undo/Redo, touch policy или геометрию;
- не заменять и не упрощать `polyclip-ts`;
- не делать lazy loading текущих i18n dictionaries;
- не оптимизировать backend API или SVG/Glow вычисления, если они нужны View;
- не считать успехом маленький entry, который тут же синхронно или автоматически
  скачивает тот же код до готовности View;
- не делать автоматический idle-prefetch editor runtime: он вернул бы сетевой
  расход всем пользователям, которые редактор не открывают.

## 6. Пользовательский контракт

### 6.1 Первый View

1. `houseplan-card` и `houseplan-space-card` регистрируются так же надёжно, как
   до изменения; HA не показывает промежуточное `Custom element doesn't exist`.
2. View считается готовым только когда видны план и устройства и доступны
   обычные View-действия. Все JS-файлы, обязательные до этого момента, входят в
   initial View graph и budget §13.
3. Ни один editor-only asset не запрашивается до намерения пользователя открыть
   редактор или editor-only диалог. Hover без клика и простои страницы не
   считаются намерением.
4. Пустая новая установка сохраняет текущий onboarding: диалог создания первого
   пространства не может зависеть от editor runtime.

### 6.2 Вход в редактор

1. Нажатие Plan, Devices или Background сначала запускает единственный shared
   loader. Mode, editor chrome и editor camera не коммитятся до успешной
   установки runtime.
2. Повторные/конкурентные клики используют один Promise; runtime не скачивается
   и не устанавливается дважды.
3. Пока загрузка занимает меньше 150 ms, отдельная плашка не появляется. После
   150 ms поверх неизменившегося View показывается неблокирующий существующий
   transition surface с текстом «Загружаем редактор…» / “Loading editor…”.
4. После успеха выполняется обычный переход текущего `mode-transition`; первая
   editor-панель не появляется в полуготовом состоянии. Пространство, View zoom
   snapshot и selection contracts сохраняются.
5. После первой успешной загрузки все три редактора и editor-only dialogs
   используют уже установленный runtime без новой сети.
6. Lovelace GUI editor загружается тем же lazy graph через async
   `getConfigElement()`. Создание config editor не должно заставлять View заранее
   загружать editor runtime.

### 6.3 Editor-only dialogs из View

К editor-only относятся формы, изменяющие plan/device/decor data и не нужные для
обычного просмотра. Если такая форма вызывается из доступной в View цепочки
(например, Edit из device info), loader завершается до открытия формы. Info,
more-info, подтверждение действия, статусы проёмов, kiosk controls и onboarding
остаются eager, если они нужны View сами по себе.

Точный список экспортов фиксирует `editor-runtime-manifest.ts`; новый editor-only
диалог должен добавляться туда, а не импортироваться из View entry напрямую.

### 6.4 Ошибка загрузки и обновление во время открытой вкладки

1. Первый сетевой/parse/fingerprint failure повторяет import один раз с
   versioned cache-buster текущей карточки. До retry View остаётся рабочим.
2. После повторной ошибки mode остаётся `view`, editor session не создаётся,
   toolbar/camera/selection не меняются. Показывается локализованное сообщение:
   «Не удалось загрузить редактор. Обновите страницу и повторите попытку.» /
   “Could not load the editor. Refresh the page and try again.”
3. Runtime сообщает build fingerprint до установки. Несовпадение entry/runtime
   рассматривается как тот же failure; код разных версий не смешивается.
4. Автоматический hard reload запрещён: он может прервать другое действие на
   HA-дашборде. Пользователь сам решает, когда обновить страницу.
5. Ошибка editor asset никогда не скрывает план и не ломает View-действия.

## 7. Архитектурный контракт frontend

### 7.1 Граница runtime

Создаётся `src/editors/runtime/` с двумя явными сторонами:

- eager `editor-loader.ts`: маленькая state machine `idle → loading → ready |
  failed`, dedupe, retry и fingerprint handshake;
- lazy `houseplan-editor-runtime.ts`: composition root редакторов;
- `editor-host-port.ts`: typed минимальный порт к snapshot, командами, save,
  translation, requestUpdate и mode transition владельца карточки;
- editor-specific render/controller modules, вынесенные из
  `houseplan-card.ts` законченными ответственностями.

Runtime не получает `HouseplanCard` через `any`, не патчит prototype и не читает
произвольные private fields. Он работает через typed host port и собственный
state. Число `any` в `src/` не увеличивается. Pure geometry authorities остаются
в текущих модулях и передаются runtime как обычные imports; второй модели
геометрии не создаётся.

Изменение является крупным independently releasable slice направления #34:
root сохраняет HA lifecycle, View projection/render, server revisions, common
dialogs, navigation и visual continuity; runtime получает editor gestures,
tool state, editor chrome/secondary tray, editor-only drafts/dialogs и команды.

### 7.2 Import graph

- eager entry не имеет static import из `src/editors/runtime/houseplan-editor-runtime.ts`
  или editor-only descendants;
- единственное runtime-ребро — `import()` внутри loader;
- общие модули, реально нужные View и editor, остаются eager либо становятся
  shared chunk, который входит в initial budget;
- модуль не признаётся editor-only только по имени: Rollup manifest и тест
  import graph являются источником истины;
- `polyclip-ts` сохраняется там, куда его помещают реальные потребители.

## 8. Multi-asset build и раздача

### 8.1 Выход Rollup

Rollup пишет дерево:

```text
dist/
  houseplan-card.js
  houseplan-assets/
    <rollup chunks>.js
  houseplan-assets.json
```

Имена chunk содержат content hash. Manifest детерминированно содержит:

- source fingerprint;
- entry filename;
- для каждого asset: relative path, SHA-256, raw bytes, gzip bytes;
- static imports и dynamic imports;
- рассчитанные `initialViewGzipBytes` и `lazyEditorGzipBytes`.

Порядок записей и gzip settings фиксированы, поэтому Windows/Linux build одного
SHA создаёт побайтово одинаковые committed snapshots.

### 8.2 Backend route

Точный публичный URL `/houseplan_files/houseplan-card.js` остаётся без изменений.
Chunks раздаются публичным read-only view по
`/houseplan_files/houseplan-assets/{filename}`.

View:

- принимает только один basename без `/`, `\\`, `..` и percent-decoded обходов;
- раздаёт только `.js`, присутствующий в текущем `houseplan-assets.json`;
- разрешает real path только внутри `frontend/houseplan-assets/`;
- возвращает 404 для отсутствующего/неразрешённого asset;
- не требует auth, потому что Lovelace ESM assets должны загружаться до карточки;
- перечитывает/инвалидирует manifest после обновления integration, чтобы config
  entry reload не оставлял старый allowlist.

Plans и marker files не возвращаются в public static path; существующий signed
content API не меняется.

### 8.3 Копии и HACS

`bundle:sync` атомарно синхронизирует **всё дерево**, а не один файл:

1. `dist/` — build output;
2. `custom_components/houseplan/frontend/` — committed release snapshot;
3. `demo/srv/assets/` — materialized untracked test copy.

Перед копированием target asset directory очищается только по списку старого
manifest, с path containment check; посторонние файлы не удаляются. После копии
каждый hash сверяется с manifest.

`houseplan.zip` включает entry, manifest и все chunks. Отдельный GitHub asset
`houseplan-card.js` сохраняется как диагностический entry-файл, но каноническая
установка остаётся целым `houseplan.zip`; документация не обещает, что один
скачанный entry без integration assets является самостоятельной установкой.
Release verification проверяет полный manifest внутри zip.

## 9. CSS minification

Build plugin обрабатывает только static Lit `css\`\`` templates без `${…}`:

- удаляет CSS comments вне строк;
- схлопывает ASCII whitespace вне строк;
- удаляет пробелы вокруг безопасной пунктуации, не меняя значения custom
  properties, strings, escapes, `url()`, `calc()`, media/container queries и
  descendant combinators;
- fail-closed сообщает файл/позицию при interpolation или незакрытой
  строке/comment вместо частичной порчи CSS;
- порядок templates и rules не меняется.

Минификация не имеет отдельного продуктового budget: ожидаемая gzip-экономия
мала и учитывается в общем initial View graph.

## 10. Fingerprint и cache contract

1. Source fingerprint продолжает покрывать `src/`, Rollup, TypeScript и lockfile;
   manifest несёт то же значение.
2. Entry публикует fingerprint как сейчас. Lazy runtime экспортирует тот же
   fingerprint; loader сверяет его до `ready`.
3. Demo freshness проверяет entry и manifest, затем SHA-256 каждого asset.
4. Content-hashed filename предотвращает выдачу нового кода из старого browser
   cache. Entry version query продолжает меняться вместе с release version.
5. Старый открытый entry после обновления может запросить удалённый hash; это
   штатный failure §6.4, а не основание хранить бесконечно старые chunks.

## 11. I18n и документация

Добавляются четыре ключа (RU/EN): loading editor, load failed, refresh advice и
доступное имя busy-state. Остальные подписи не меняются.

Обновляются:

- `docs/ARCHITECTURE.md` — multi-asset graph, runtime boundary и public routes;
- `docs/DEVELOPMENT.md` — build/sync/deploy всего дерева, проверка manifest;
- `docs/USER-GUIDE.ru.md` и README RU/EN — прежний resource URL сохраняется,
  но frontend состоит из entry и внутренних assets; ручное копирование одного
  JS не является поддерживаемой установкой;
- `docs/TESTING.md`/релевантный testing guide — сценарий failure и network gate;
- оба changelog — изменение пользовательски заметно по скорости и редкому
  сообщению ошибки.

## 12. Совместимость и миграция

Stored data не меняется; миграции нет. Старый браузер, способный исполнять
текущий ESM bundle, способен исполнять native dynamic import. При отсутствии
assets обновлённый entry сохраняет View и выдаёт §6.4.

Обновление integration требует полный HACS zip и обычный restart/reload HA.
Новый backend с новым frontend является штатной парой; mixed-version runtime
блокируется fingerprint handshake.

## 13. Критерии приёмки

**AC1. Честный initial budget.** На production build сумма gzip entry и всех
транзитивных static imports до рабочего первого View ≤ 256 000 B; dynamic editor
assets не учитываются только если browser smoke подтверждает, что они не
запрошены до editor intent. **Доказательство:** `bundle-budget` unit + CI command
с manifest + Playwright network smoke.

**AC2. Реальная lazy boundary.** Initial import graph не содержит editor runtime,
editor toolbar/gesture/dialog modules и GUI config editor; первый вход в любой
из трёх редакторов загружает один deduplicated editor graph. **Доказательство:**
manifest/import-graph unit и Playwright network smoke.

**AC3. View parity.** Configured View, kiosk, touch View, device actions,
Glow/sun/vacuum, openings, room hover, space switching and visual continuity
проходят без golden delta. **Доказательство:** связанные smokes + полный golden
verify на pre-release gate; на code-review — selected smokes из registry.

**AC4. Editor parity.** Plan, Devices и Background открываются после cold load;
основные select/draw/save/undo flows и editor-to-editor transitions проходят
существующие smokes без изменения ожидаемого DOM/данных. **Доказательство:**
selected editor smokes и unit tests controller/loader.

**AC5. Loader atomicity.** Двойной клик/конкурентные запросы выполняют один
import/install; mode и camera меняются только после ready. **Доказательство:**
unit с controllable Promise + browser smoke.

**AC6. Failure сохраняет View.** Первый 404/parse/fingerprint failure retry-ится
один раз; второй оставляет mode=view, план интерактивным и показывает
локализованное сообщение. **Доказательство:** unit loader state machine +
Playwright route abort/mismatch scenarios RU/EN.

**AC7. Asset security.** Backend отдаёт только manifest-listed JS из asset root и
отказывает traversal, encoded traversal, nested path, unknown extension и stale
asset. **Доказательство:** HA backend tests.

**AC8. Полнота distribution.** Build/sync/zip/release verification падают при
удалении или подмене любого manifest asset; dist, integration и demo после sync
побайтово совпадают по manifest. **Доказательство:** Node release-contract,
bundle-sync и freshness tests + zip test.

**AC9. CSS без семантической порчи.** Plugin корректно сохраняет strings,
escapes, URLs, custom properties, calc/media/container и combinators, умеет
падать на interpolation/malformed input; computed styles выбранных компонентов
и golden images не меняются. **Доказательство:** unit с adversarial fixtures +
computed-style smoke + golden verify.

**AC10. Fingerprint mismatch не смешивает версии.** Runtime с другим fingerprint
не устанавливается и проходит failure contract. **Доказательство:** unit +
browser injected mismatch.

**AC11. Onboarding и GUI editor.** Empty-config onboarding работает без editor
asset; async `getConfigElement()` загружает editor graph и возвращает прежний
custom element/config contract. **Доказательство:** browser smokes обоих путей.

**AC12. Без model drift.** No-op config/layout roundtrip и backend validation не
изменяют данные; `any` count в `src/` не растёт; второй geometry authority не
появляется. **Доказательство:** existing roundtrip/schema tests + static gate.

**AC13. Документация не обещает single-file install.** Resource URL остаётся
прежним, а install/deploy docs требуют целое asset tree. **Доказательство:**
`check-docs` и ревью текста.

## 14. План автотестов и гейты реализации

На каждом implementation slice:

```text
npm run typecheck
npm test
npm run build
npm run bundle:sync
node scripts/check-docs.mjs
node scripts/smoke-select.mjs --base origin/dev --head HEAD
<все smokes, выбранные registry и перечисленные AC>
git diff --check
```

Перед code review дополнительно:

- backend pure tests и полный HA subset в WSL/CI для frontend asset view;
- new network/failure/editor cold-load smoke;
- `npm run inventory`;
- hashes полного asset tree;
- `npm run golden:verify` как диагностический локальный прогон; канонический
  full golden/performance остаётся pre-beta CI по `PROCESS.md`.

Mutation guards обязаны уметь сломать: dynamic boundary, retry cap, fingerprint
check, manifest allowlist, omitted zip chunk, CSS string/comment handling и
initial budget.

## 15. Риски и меры

| Риск | Мера |
|---|---|
| Big-bang перенос editor state ломает жесты | переносить законченными typed slices; одинаковые smokes до/после каждого slice; без новой geometry model |
| Chunk доступен в demo, но 404 в HA | production backend route + HA harness test; smoke использует production URL layout |
| Entry мал, но eager shared chunk возвращает вес | budget следует transitive static graph из manifest и подтверждается network trace |
| Update смешивает версии | content hash + source fingerprint handshake; отказ до install |
| Сломан ручной deploy | sync/deploy docs и script работают с tree, не с одним `scp` |
| CSS whitespace меняет selector/value | token-aware conservative transform, adversarial tests, computed style + golden |
| Release zip неполон | manifest-driven zip validation и публичный asset verification |
| First editor click выглядит зависшим | 150 ms delayed loading surface, View остаётся на месте |

## 16. Откат

Откат выполняется одним release commit к предыдущему monolithic Rollup output,
точному static route и single-file bundle tooling. Stored config/layout не
менялись, поэтому data rollback не нужен. Backend не удаляет старый entry URL;
после отката новые chunk routes становятся неиспользуемыми.

## 17. Release-артефакты

- production entry + manifest + chunk tree в `dist/` и integration snapshot;
- обновлённый `houseplan.zip` с полным tree;
- прежний top-level GitHub `houseplan-card.js` entry asset;
- RU/EN changelog со ссылкой на #337;
- architecture/development/user docs;
- новые unit/backend/browser tests; golden baselines не меняются без отдельного
  reviewed acceptance.

## 18. Принято предположительно, можно менять без владельца

- имена внутренних modules/chunks и форма typed host port;
- формат manifest, если он остаётся детерминированным и доказывает все AC;
- точная реализация delayed loading surface поверх существующей transition UI;
- механизм перечитывания manifest backend view;
- gzip implementation и fixed compression level в budget script;
- разбиение editor extraction на внутренние commits/slices.

Нельзя менять без продуктового решения владельца: прежний resource URL,
отсутствие автоматического hard reload, сохранение рабочего View при failure и
отсутствие заранее загружаемого editor prefetch.
