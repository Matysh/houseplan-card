# Issue #348 — полная немецкая локализация House Plan

- **Issue:** https://github.com/Matysh/houseplan-card/issues/348
- **Зависимость:** #62 — единый реестр языков и автоматические i18n-gates
- **Статус документа:** реализовано, передано на код-ревью
- **Приоритет / тип:** P1 / feature
- **Трек:** полный: задача меняет публичный языковой контракт, несколько
  frontend/backend-поверхностей, первый render и performance budget
- **Пользовательское изменение:** да

## 1. Сценарий и пользовательская ценность

Немецкоязычный пользователь выбирает Deutsch в профиле Home Assistant либо
явно в настройках карточки. После этого View, kiosk, встроенные редакторы,
диалоги, подсказки, ошибки и config/options flow интеграции House Plan работают
на немецком без английских или русских фрагментов.

Задача закрывает языковой барьер для крупной Home Assistant-аудитории и впервые
проверяет инфраструктуру #62 на реальном третьем языке. После неё следующий
перевод должен добавляться тем же проверяемым путём, без нового ручного списка
локалей.

## 2. Что человек увидит до и после

**До:** `de`, `de-DE`, `de-AT` и `de-CH` не зарегистрированы и синхронно
откатываются на English. В selector языка нет Deutsch.

**После:**

- в selector языка после `Русский` появляется `Deutsch`;
- Auto выбирает Deutsch для любого HA locale с primary subtag `de`;
- явное `language: de` принудительно включает немецкий независимо от профиля;
- все собственные строки House Plan отображаются на немецком;
- при первой загрузке немецкого словаря пользователь не видит промежуточный
  English UI: на холодном mount допустим только короткий нейтральный busy-state,
  а уже отрисованный кадр при смене языка остаётся на месте до атомарной смены;
- English и Русский продолжают работать и загружаться синхронно, как до задачи.

## 3. Границы перевода

### 3.1. Переводится

- весь key set `src/i18n/en.json`: View, kiosk, Plan/Devices/Background editors,
  onboarding, диалоги, tooltips/help, aria-тексты, подтверждения, toasts, ошибки,
  backup/Optimize/vacuum и GUI editors обеих карточек;
- `custom_components/houseplan/translations/de.json`: config flow, options flow
  и repair issue;
- native label языка — `Deutsch`.

### 3.2. Не переводится карточкой

- названия пространств, комнат, устройств, сущностей, HA areas и интеграций;
- состояния, единицы, даты и значения, которые уже форматирует Home Assistant;
- entity IDs, model names, filenames, URLs, stable config/API tokens;
- бренд `House Plan`, `Home Assistant`, `HA`, `HACS`, `Zigbee`, `LQI`, `Glow` и
  общеупотребимые технические имена форматов;
- полный немецкий комплект README/User Guide. Каноническая пользовательская
  документация по-прежнему ведётся на English и Русском по правилу #62.

## 4. Языковой и терминологический контракт

English dictionary — смысловой канон; Русский используется только для снятия
неоднозначности. Перевод не должен буквально переносить ошибки или неудачную
грамматику исходной строки: смысл, действие и уровень опасности сохраняются.

Базовый glossary:

| Канонический термин | Немецкий UI |
| --- | --- |
| View | Ansicht |
| Plan editor | Planeditor |
| Device editor | Geräteeditor |
| Background editor | Hintergrundeditor |
| Space | Bereich |
| Room | Raum |
| Wall / physical wall | Wand / physische Wand |
| Zero-thickness wall | Wand ohne Dicke |
| Partition | Trennwand |
| Column | Säule |
| Opening / passage | Öffnung / offener Durchgang |
| Door / window / gate | Tür / Fenster / Tor |
| Device / entity | Gerät / Entität |
| Fill | Füllung |
| Glow | Glow |
| Save / Cancel / Delete | Speichern / Abbrechen / Löschen |

Правила качества:

1. Используется вежливый нейтральный UI без `du`/`Sie`, где это возможно;
   команды формулируются коротким imperative/infinitive style.
2. Существительные и заголовки следуют немецкому написанию с заглавной буквы;
   предложения — sentence case, не English Title Case.
3. Используются настоящие `ä`, `ö`, `ü`, `ß`, а не `ae/oe/ue/ss`, кроме
   стабильных идентификаторов.
4. Placeholders `{name}`, `{n}`, `{reason}` и остальные не переводятся, не
   добавляются и не удаляются; знаки вокруг них согласуются по-немецки.
5. Строки с числом сохраняют нейтральную грамматику: текущий `subst()` не имеет
   ICU/plural rules.
6. Кнопки и короткие labels не заканчиваются точкой; ошибки и полные подсказки
   могут заканчиваться точкой согласованно с English.
7. В одном workflow нельзя смешивать синонимы из glossary без смысловой причины.

## 5. Locale resolution и persisted config

Реестр #62 получает canonical entry:

```ts
{ code: 'de', nativeLabel: 'Deutsch', ... }
```

Существующая exact → primary → English политика не меняется:

| Explicit config | HA locale | Результат |
| --- | --- | --- |
| `de`, `DE` | любой | `de` |
| пусто/нет | `de`, `de-DE`, `de_AT`, `de-CH` | `de` |
| неизвестное legacy-значение | `de-*` | `de` |
| пусто/нет | неизвестная локаль | `en` |

`language` остаётся строковым полем без изменения schema и миграции. Уже
сохранённое неизвестное значение selector по-прежнему показывает losslessly,
пока пользователь явно не выберет Auto или зарегистрированный язык.

## 6. Runtime загрузки немецкого словаря

### 6.1. Почему словарь ленивый

На базе `origin/dev` перед задачей initial View graph занимает **255 910 B gzip
из бюджета 256 000 B**. Frontend English/Russian dictionaries имеют около
66/70 KiB raw каждый. Третий static import гарантированно нарушит принятый в
#337 budget. Повышение бюджета либо перенос случайного View-кода в editor chunk
не являются допустимым решением этой задачи.

English и Русский сохраняются eager/synchronous ради compatibility-контракта
#62. Только `de` поставляется отдельным content-hashed dynamic locale chunk.

### 6.2. Registry и cache

Typed registry остаётся единственным источником code/native label/stable order,
но поддерживает две формы записи:

- eager dictionary (`en`, `ru`);
- lazy loader (`de`).

Общий locale runtime:

- дедуплицирует одновременные запросы `de` от нескольких экземпляров карточек;
- хранит успешно загруженный dictionary в page-lifetime cache;
- предоставляет синхронным `t()`/`hasTranslation()` только уже готовый словарь;
- уведомляет подписанные Lit hosts об успешном завершении;
- не делает fetch/import для `en` и `ru`;
- очищает rejected promise и выполняет один bounded retry; после повторного
  отказа разблокирует UI с English fallback, пишет один `console.warn` и не
  создаёт бесконечного цикла запросов/рендеров.

Dynamic module экспортирует собственный build fingerprint. Loader принимает
словарь только при совпадении с fingerprint initial chunk; stale/mixed bundle не
может тихо отрисовать перевод от другой версии.

### 6.3. Render gate

Один shared host controller используется четырьмя самостоятельными корневыми
поверхностями:

1. `houseplan-card`;
2. `houseplan-space-card`;
3. GUI editor `houseplan-card`;
4. GUI editor `houseplan-space-card`.

До готовности выбранного lazy dictionary:

- холодный mount рисует только нейтральный `aria-busy="true"` progress surface
  без English/Russian текста и без интерактивных элементов;
- если host уже имеет полный кадр и язык меняют на `de`, старый кадр остаётся
  неизменным до готовности и затем заменяется немецким атомарно;
- редактор/диалог не может принять click по невидимой старой локали;
- late resolve после смены обратно на `en`/`ru` или disconnect не возвращает
  host на `de` и не вызывает исключения;
- ошибка после bounded retry переходит в рабочий English fallback, а не оставляет
  вечный spinner.

Вложенные локализованные компоненты не создают независимых запросов: они
появляются только после gate корневого host либо подписываются на тот же cache.

## 7. Bundle manifest, доставка и budget

Locale chunk является полноценным HACS asset:

- попадает в `houseplan-assets.json`, bundle sync, backend allowlist, release ZIP
  и tree/hash verification из #337;
- входит в `lazyFiles`, но **не** в `lazyEditorFiles` и
  `lazyOnboardingFiles`; manifest получает явную `lazyLocaleFiles` группу;
- не запрашивается при English/Russian View;
- при немецком View загружается ровно один раз на страницу до появления первого
  локализованного кадра;
- initial View graph после loader/registry изменений остаётся ≤ 256 000 B gzip.

Разрешено удалить только доказанно неиспользуемые legacy i18n keys (включая
оставшиеся после #62 ручные labels `editor.lang_en`/`editor.lang_ru`), если это
нужно для сохранения budget. Удаление подтверждается source-usage test и проходит
одинаково во всех словарях; смысл живого UI не меняется. Повышать budget нельзя.

## 8. Layout, accessibility и touch

Немецкие строки обычно длиннее English. Перевод считается рабочим только если:

- заголовки диалогов переносятся и не обрезаются;
- footer actions не создают горизонтальный scroll и остаются доступны;
- toolbars/context trays используют штатный wrap/scroll, не уменьшая рабочую
  область иначе, чем English/Russian;
- View и kiosk при 390 px остаются полностью работоспособны по
  `docs/TOUCH-SUPPORT.md`;
- tooltip/help не создаёт лишний dialog scroll;
- `aria-label`, `role=status/alert` и busy-state имеют корректный язык либо
  нейтральны до загрузки;
- `lang="de"` или эквивалентный локальный marker доступен корневой поверхности,
  чтобы browser/assistive technology применяли немецкие правила произношения.

Редакторы остаются desktop-first; их данные обязаны быть безопасны на touch, но
новая точность touch-editing в задачу не входит.

## 9. Translation completeness и автоматические gates

Проверки #62 расширяются на eager и lazy entries и обязаны загружать production
словари через registry API, а не обходить lazy path прямым чтением только ради
зелёного теста.

Gate проверяет:

- registry ↔ frontend files ↔ backend files one-to-one для `en`, `ru`, `de`;
- exact key set относительно English, непустые значения, placeholders и полный
  help body/aria contract;
- отсутствие кириллицы в `de` кроме явно allowlisted user/example literals;
- отсутствие необоснованного English fallback: значения `de` не равны English,
  кроме allowlist брендов, единиц, стабильных терминов и односимвольных glyph;
- glossary для ключевых публичных controls;
- locale matrix `de`/`de-*`/explicit/fallback и selector order
  `Auto`, `English`, `Русский`, `Deutsch`;
- lazy state machine: dedupe, success, race, retry/failure fallback, disconnect;
- production bundle не содержит German dictionary в initial static graph.

Backend translation test проверяет German config/options/repair strings через
HA translation API либо, если harness не предоставляет стабильный language
API, точную file/key/placeholder parity плюс чтение `de.json`.

## 10. Acceptance criteria

- **AC1. Полный German key set.** `de` зарегистрирован как `Deutsch`; frontend и
  backend dictionaries имеют полный набор ключей, непустые значения и точные
  placeholders/help pairs. **Доказательство:** registry-driven unit + backend
  translation test.
- **AC2. Locale resolution.** Explicit `de` и Auto для `de`, `de-DE`, `de_AT`,
  `de-AT`, `de-CH` выбирают German; неизвестная locale использует English.
  **Доказательство:** unit matrix.
- **AC3. Нет смешанного UI.** Репрезентативные View, device dialog, Plan editor,
  Devices editor, Background editor, onboarding и оба GUI editors содержат
  немецкие House Plan strings и не содержат English/Russian UI fragments.
  **Доказательство:** targeted Playwright smoke с semantic assertions.
- **AC4. Без языкового flash.** На искусственно задержанном `de` import холодный
  mount показывает нейтральный busy-state; warm language switch сохраняет старый
  complete frame и атомарно публикует German; controls inert до commit.
  **Доказательство:** unit state machine + Playwright delayed-load smoke.
- **AC5. Без deadlock при ошибке.** Два отказа lazy load дают один warning и
  рабочий English fallback; смена языка/disconnect во время pending не публикует
  устаревший кадр. **Доказательство:** unit с controllable loader.
- **AC6. Performance.** German dictionary отсутствует в initial static graph;
  English/Russian не запрашивают locale chunk; German загружает его один раз;
  initial View ≤ 256 000 B gzip. **Доказательство:** bundle-manifest/budget unit,
  production build manifest и Playwright network trace.
- **AC7. Доставка.** Locale chunk присутствует в manifest, HACS tree, backend
  allowlist и ZIP-verification path; classified как `lazyLocaleFiles`, а не
  editor/onboarding. **Доказательство:** bundle tree/backend tests.
- **AC8. Layout/accessibility.** Немецкие View/kiosk и репрезентативные dialogs
  не имеют clipping/горизонтального scroll при desktop и 390 px; busy-state
  нейтрален и `aria-busy`; German surface сообщает locale assistive technology.
  **Доказательство:** smoke metrics + reviewed golden desktop/mobile.
- **AC9. English/Russian compatibility.** Existing eager first render, locale
  selector values, persisted config и видимые EN/RU strings не меняются, кроме
  появления option Deutsch и удаления доказанно мёртвых registry-label keys.
  **Доказательство:** unit regression + bundle network smoke + diff review.
- **AC10. Документация и release artifacts.** User guides перечисляют `de`,
  contribution docs описывают eager/lazy third-locale flow, а оба changelog
  сообщают о German UI и ссылке #348. **Доказательство:** docs diff/check-docs.

## 11. План тестов и обязательные gates

### Unit / backend

- registry/file/key/placeholder/help/glossary parity для трёх языков;
- locale resolution и selector order;
- pure locale loader/controller state machine с deferred promises;
- bundle manifest role classification и initial budget;
- locale asset allowlist/tree validation;
- German backend translation structure/lookup.

### Browser / visual

- новый `demo/smoke_german_locale.mjs`: semantic coverage AC3, locale switch,
  delayed loader, failure fallback и network count;
- German desktop golden: основной View + открытый device/settings dialog;
- German 390 px golden: View/kiosk либо самый длинный гарантированный View
  dialog; отсутствие overflow измеряется smoke, а не только глазами;
- существующие EN/RU docs/golden не перезаписываются без визуальной причины.

### Локально перед code review

```text
npm run typecheck
npm test
npm run bundle:sync
npm run bundle:budget
npm run inventory
node scripts/smoke-select.mjs --base origin/dev --head HEAD
node demo/smoke_german_locale.mjs
node scripts/check-docs.mjs
git diff --check
```

Backend HA harness и golden capture запускаются по селектору/CI на Linux; на
Windows локальный Chromium smoke обязателен, если зависимости доступны.

## 12. Затронутые файлы и модули

Ожидаемый scope (точные имена helper-файлов может уточнить реализация):

- `src/i18n/de.json`, lazy module/controller под `src/i18n/`;
- `src/i18n/registry.ts`, `src/i18n.ts`;
- `src/houseplan-card.ts`, `src/space-card.ts`, `src/editor.ts`,
  `src/space-editor.ts` — shared readiness gate;
- `custom_components/houseplan/translations/de.json`;
- `scripts/bundle-manifest.mjs`, bundle/tree/backend route tests при необходимости;
- `test/i18n.test.mjs`, locale loader и bundle tests;
- targeted smoke/golden matrix;
- `CONTRIBUTING.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md`, оба changelog и этот документ;
- generated bundle tree и принятые Linux golden baselines.

Новых config keys и backend API нет.

## 13. Риски и меры

| Риск | Мера |
| --- | --- |
| Машинный/буквальный перевод меняет смысл опасного действия | glossary, ручной аудит confirmations/errors/security strings, semantic smoke |
| German entry формально есть, часть UI падает в English | exact key parity + no-English allowlist + representative browser coverage |
| Длинные строки ломают диалоги и kiosk | desktop/mobile metrics и golden |
| Lazy locale даёт English flash | root render gate и delayed-load smoke |
| Lazy locale зависает после 404/mixed deploy | fingerprint, bounded retry, fail-open English |
| Несколько карточек скачивают chunk многократно | page cache и dedupe unit/network trace |
| Locale chunk ошибочно считается editor-only | явная manifest role и AC7 |
| Loader превышает initial budget даже без словаря | измерение build; только доказанная очистка мёртвых i18n keys, budget не повышается |
| EN/RU стали async или изменили первый кадр | eager entries остаются; network/render regression |

## 14. Откат

Откат удаляет `de` entry/files и lazy locale runtime, возвращает registry/tests
к eager `en`/`ru`. Persisted `language: de` безопасно становится неизвестным
legacy value: selector показывает его временной option, runtime применяет HA
locale → English fallback по контракту #62. Data migration и rollback backend
config не нужны.

## 15. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: значимый bullet со ссылкой #348;
- User Guide EN/RU: `language = auto|en|ru|de`, Auto locale matrix и короткое
  описание German lazy first load/fallback;
- CONTRIBUTING: третий язык может быть lazy, registry entry определяет loader;
- `docs/TESTING.md`: German semantic/layout/network checks;
- generated multi-file bundle и release ZIP validation;
- Linux-reviewed German desktop/mobile golden baselines;
- security изменений нет; performance artifact — manifest с initial/lazy locale
  gzip и network trace.

## 16. План реализации

1. Расширить registry pure contract eager/lazy entries и написать loader tests.
2. Добавить shared Lit readiness gate и race/failure tests четырёх root hosts.
3. Добавить `de.json`, перевести/вычитать frontend и backend strings, включить
   glossary/no-fallback gates.
4. Развести locale/editor/onboarding roles в bundle manifest и проверить
   package/backend/ZIP delivery.
5. Добавить semantic/layout/network smoke и German golden scenarios.
6. Обновить docs/changelogs, собрать и синхронизировать bundle.
7. Прогнать gates, передать точный SHA на независимое code review.
