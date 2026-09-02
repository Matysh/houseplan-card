# ТЗ #423 — Полиш support pipeline и защитных инструментов v1.70.0

- Issue: https://github.com/Matysh/houseplan-card/issues/423
- Приоритет: P3, `tech-debt` / `polish`
- Маршрут: full; затронуты backend, frontend UX/i18n, transport, bundle graph и
  Playwright tooling, поэтому задача не проходит критерий одной поверхности
  лёгкого трека
- Связанные контракты: #43 (Help & feedback), #352/#367 (bundle ownership и
  бюджет), #404/#407/#421 (browser exception guard), #422 (docs screenshot gate)

## Сценарий

Пользователь обновляет карточку и интеграцию House Plan через HACS. Браузер ещё
может держать предыдущий bundle, либо одна из двух частей обновляется раньше
другой. Пользователь открывает «Помощь и обратную связь», пишет сообщение и при
желании прикладывает обезличенный пакет.

Одновременно разработчик должен иметь честные сведения о Repair families,
дешёвый отказ при исчерпанном лимите preview, безопасное имя файла, контролируемый
initial bundle и benchmark, который не пропускает browser exception.

## Что человек увидит до и после

**До:** при любом несовпадении номера релиза форма полностью скрывается, даже
если обе стороны поддерживают один и тот же support API. Скачанный JSON и
multipart-вложение названы префиксом живого preview-token. Остальные дефекты
почти не видны напрямую: новый тип Repair может отсутствовать в пакете, а запрос
с исчерпанным лимитом сначала зря строит пакет до 8 МиБ.

**После:** форма доступна при совместимом `support_api`, независимо от равенства
номеров релиза. Старый backend без capability по-прежнему fail-closed показывает
предложение обновиться. И ручное скачивание, и relay attachment получают одно
имя по короткому префиксу SHA-256, без части capability-token. Тексты, поля,
согласие на вложение и отправка внешне не меняются.

## Цель

Закрыть шесть подтверждённых разрывов аудита v1.70.0 без изменения support
package v1 и без расширения передаваемых приватных данных:

1. перечислять все активные стабильные семейства House Plan Repair;
2. не использовать capability-token в имени файла;
3. отклонять очевидно лишний preview до дорогой сборки;
4. согласовывать форму по версии support API, а не версии релиза;
5. вынести form-only локализации из initial View graph;
6. подключить backdrop decode benchmark к общему browser-error guard.

## Проблема и подтверждённые причины

### 1. Repair families

`_support_repairs()` сейчас анализирует только `issue_id.startswith("broken_plan_")`
и жёстко выдаёт `code: "broken_plan"`. Реестр уже хранит безопасный стабильный
`translation_key`; именно он описывает семейство, тогда как issue id содержит
идентичность конкретного экземпляра и может включать приватный placeholder.

### 2. Filename

`ws_support_submit()` передаёт preview-token в `filename_token`, а
`support_transport.py` пишет первые 32 символа в multipart filename. Frontend
использует первые 12 символов того же token при Download JSON. Полный token не
раскрывается, но имя без необходимости основано на bearer capability.

### 3. Preview quota

`ws_support_preview()` захватывает копии store и исполняет `_build_snapshot()` до
prune/count. Только после потенциальной валидации, псевдонимизации и сериализации
8 МиБ приходит `support_rate_limited`.

### 4. Compatibility

`_buildSupportPreview()`, `_submitSupport()` и `_renderSupportDialog()` требуют
`_haIntegrationVersion === CARD_VERSION`. Номер релиза является диагностикой,
но не версией протокола. Владелец выбрал явную capability `support_api: 1`.

### 5. Lazy support copy

43 английских `support.*` и соответствующие русские строки входят в общий
initial chunk через eager locale dictionaries. Только `support.title` нужен
карточке до загрузки editor runtime; вся остальная форма уже lazy.

### 6. Backdrop benchmark

`demo/benchmark_backdrop_decode.mjs` создаёт `page` напрямую и не вызывает ни
`watchPage()`, ни `reportPageErrors()`. Необработанный `pageerror` может попасть
в лог, но оставить exit code нулевым.

## Скоуп

В скоупе:

- безопасная агрегация Repair issues по `translation_key`;
- одинаковый short-id из SHA-256 для browser download и multipart filename;
- quota preflight до store copy/build и повторная проверка после асинхронной
  сборки;
- top-level capability `support_api` в ответе `houseplan/config/get`;
- component-memory состояние capability и единый чистый predicate совместимости;
- lazy support dictionaries для RU/EN/DE/FR с прежними значениями строк;
- bundle ownership test и зафиксированное уменьшение initial View gzip;
- подключение backdrop benchmark к `watchPage()` и `reportPageErrors()`;
- unit/backend/smoke/contract tests, User Guide и changelog RU/EN.

## Не-скоуп

- изменение endpoint relay, consent, retention, формы, package schema или набора
  приватных данных;
- изменение лимитов `3/3`, TTL 10 минут или replacement semantics;
- отправка списка raw Repair ids, placeholders, titles или exception text;
- новый negotiation endpoint или пробный submit ради определения capability;
- ленивый вынос всей RU/EN локали: переносится только семейство support form;
- изменение screenshot capture workflow: неверный комментарий и межпрогонный
  гейт уже принадлежат #422;
- превращение backdrop benchmark в обязательный CI performance gate.

## UX

- About и Guide доступны всегда, как сейчас.
- Форма, checkbox и Send доступны, когда `support_api === 1`.
- Отсутствующее, нецелое, нулевое или неизвестное значение capability считается
  несовместимым. UI показывает локализованное сообщение об обновлении до
  совместимых версий, не технический номер API.
- Несовпадающие card/integration release versions сами по себе больше ничего не
  скрывают и не блокируют.
- Никаких новых действий, переключателей, toast, фокусов и состояний загрузки.
- Download JSON сохраняет те же bytes, но имя становится
  `houseplan-support-{sha256[0:12]}.json`.

## Контракт реализации

### 1. Safe Repair family

Для каждой активной записи реестра с `domain === houseplan` берётся
`translation_key` объекта issue. Значение включается только если это строка,
соответствующая `^[a-z][a-z0-9_]{0,63}$`. Записи без безопасного ключа
пропускаются fail-closed.

Одинаковые ключи агрегируются, результат сортируется по `code` и имеет прежний
вид `{ "code": string, "count": positive integer }`. Ни `issue_id`, ни
translation placeholders, ни display text в package не попадают. Два
`broken_plan_<space>` по-прежнему дают `{code: "broken_plan", count: 2}`;
будущее семейство с другим id автоматически попадает под своим translation key.

### 2. Filename short-id

Short-id равен первым 12 lowercase hex символам уже рассчитанного SHA-256 exact
attachment bytes. SHA уже входит в preview и request metadata; отдельный random
id и новое поле WebSocket ответа не нужны. Благодаря случайному namespace
псевдонимов новый preview имеет новые bytes/hash даже для того же плана.

- frontend Download использует `preview.sha256.slice(0, 12)`;
- backend transport строит имя только из валидированного
  `attachment_sha256[:12]`;
- parameter `filename_token` удаляется из transport API;
- при `attachment is None` filename не создаётся;
- browser и relay получают одинаковое имя.

### 3. Двухфазная quota-проверка

Один helper проверяет вместимость preview-map для `(owner, draft_id)`:

1. prune expired records по одному captured monotonic `now`;
2. при подсчёте временно исключить старую запись того же owner/draft, потому что
   успешный refresh заменит её;
3. проверить per-user и total limits;
4. при отказе отправить `support_rate_limited` до чтения store, deep copy и
   `async_add_executor_job(_build_snapshot)`.

Старый preview текущего draft на preflight не удаляется: неудачная новая сборка
не должна уничтожать пригодный снимок. После возврата executor выполняются новый
prune и тот же capacity check, потому что во время `await` другой запрос мог
занять слот. Только после успешной второй проверки старый token того же draft
удаляется и новый record записывается без следующего `await`.

### 4. Версия support API

Текущий backend добавляет в каждый полный и projected ответ
`houseplan/config/get` поле:

```json
{ "support_api": 1 }
```

Поле — runtime capability, а не persisted config. Миграции нет. Карточка на
каждом успешном `config/get` нормализует значение: только safe integer `1`
считается поддерживаемым; отсутствие/другая версия сбрасывает прошлое значение,
чтобы downgrade backend не оставил stale permission.

Чистый helper `supportApiCompatible(value)` используется всеми тремя путями:
render, preview build и submit. Release `integration_version` сохраняется для
диагностики и других функций, но больше не участвует в support form gate.
Добавочные изменения протокола остаются в API v1; breaking change получает новый
номер и старый frontend fail-closed.

### 5. Lazy support dictionaries

В основных `src/i18n/{en,ru,de,fr}.json` остаётся `support.title`, потому что
header action существует до загрузки editor runtime. Остальные `support.*`
переносятся без изменения текста и placeholders в отдельные словари, импортируемые
только графом `houseplan-editor-runtime`.

Lazy helper:

- типизирует собственный набор support keys;
- выбирает точный словарь RU/EN/DE/FR и синхронно fallback-ит в English;
- использует общий `subst` для placeholders;
- не мутирует глобальный LanguageRuntime и не создаёт дополнительной сетевой
  загрузки после загрузки editor runtime.

Общие i18n tests отдельно доказывают равенство ключей/placeholders основного и
support-наборов во всех четырёх языках. Dead-key scan рассматривает оба английских
словаря. Production build обязан показать, что form-only English/Russian marker
strings отсутствуют в `initialViewFiles` и присутствуют в `lazyEditorFiles`.

Baseline для сравнения берётся из чистого `dev` на начале задачи: **291046 B
gzip initial View**. После реализации значение должно быть строго меньше baseline;
увеличение бюджета `300000` или простая рекалибровка запрещены.

### 6. Browser error guard benchmark

Benchmark оборачивает созданную страницу штатным `watchPage()`. После всех cases,
но до `browser.close()`, он вызывает `await reportPageErrors()`; при true
завершает сценарий ненулевым кодом без печати ложного success. Синхронные ошибки
отдельных слишком больших cases продолжают печататься как измерительный `FAIL` и
не превращаются автоматически в crash всего benchmark: предмет guard — только
необработанный page error.

Contract test охватывает все `demo/benchmark_*.mjs`, которые создают Playwright
page: такая страница должна пройти через `watchPage`, а скрипт — запросить
`reportPageErrors` или `finish`. Отрицательная проверка удаляет один из этих
вызовов и обязана краснеть. Для динамического доказательства сам benchmark
получает служебный `--guard-probe`: режим не запускает тяжёлую decode-матрицу,
создаёт контролируемый tail `pageerror`, проходит через тот же финальный verdict
и обязан завершиться кодом 1 с сообщением общего guard. Обычный запуск без флага
не меняет cases или формат строк измерений.

## Модель данных, API и миграция

- Persisted config/layout, model version, import/export и support package v1 не
  меняются.
- `support_api` — новое additive top-level поле response `config/get`; старые
  клиенты его игнорируют, старые backends не присылают.
- `_haSupportApi` живёт только в памяти экземпляра карточки, в cache/localStorage
  не записывается.
- Preview record сохраняет прежние bytes/hash/versions. Нового filename id в
  record нет.
- Relay request JSON и validation schema не меняются; меняется только безопасное
  multipart filename.

## i18n

Видимый текст `support.update_required` обновляется во всех RU/EN/DE/FR: вместо
требования одинакового номера релиза он просит обновить карточку и интеграцию до
совместимых версий. Остальные строки переносятся побайтово без правки смысла.

Основные ключи:

- `support.title` — остаётся в core dictionary;
- `support.update_required` — lazy, новый смысл compatibility;
- все остальные `support.*` — lazy, значения без изменения.

## Accessibility, touch и kiosk

Разметка dialog, порядок tab, label/aria-live, focus, 44×44 targets и responsive
layout не меняются. Touch, desktop и keyboard используют один compatibility
predicate. Kiosk по-прежнему скрывает Help action. Вынос словарей не допускает
пустого текста или English flash: editor runtime и его словари загружаются одной
lazy graph dependency до открытия dialog.

## Security и privacy

- Capability token остаётся только в WebSocket payload/runtime-map и никогда не
  входит в filename.
- SHA short-id не добавляет новую информацию: полный SHA уже явно показан
  пользователю и отправляется relay для проверки bytes.
- Repair aggregation принимает только стабильный безопасный translation key;
  сырые ids/placeholders исключены тестом.
- Capability negotiation не вызывает relay и не ослабляет HA `may_write`.
- Quota preflight уменьшает доступную злоумышленнику дорогую работу; финальная
  проверка сохраняет ограничение при конкурентных запросах.

## Производительность

- Исчерпанная preview quota отклоняется до deep copy/schema/projection/JSON.
- Обычный допустимый preview получает два линейных прохода по максимум трём
  records; стоимость ничтожна относительно snapshot build.
- Initial View gzip обязан уменьшиться относительно 291046 B. Lazy editor может
  вырасти на перенесённые строки; суммарные bytes допустимы, потому что платит
  только открывающий редактор/Help пользователь.
- Backdrop benchmark не становится CI gate и не меняет измеряемую матрицу; один
  финальный browser round-trip не входит в case timing.

## Затрагиваемые файлы

Ожидаемый набор:

- `custom_components/houseplan/websocket_api.py`;
- `custom_components/houseplan/support_transport.py`;
- `tests_backend/test_ha_websocket.py`;
- `tests_backend/test_ha_support_transport.py`;
- `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`;
- `src/support-feedback.ts` либо отдельный compatibility helper;
- `src/i18n/{en,ru,de,fr}.json` и новые lazy support dictionaries/helper;
- `test/support-feedback.test.mjs`, `test/i18n.test.mjs`,
  `test/i18n-dead-keys.test.mjs`, `test/bundle-assets.test.mjs`;
- `demo/smoke_support_feedback.mjs`;
- `demo/benchmark_backdrop_decode.mjs` и его contract test;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

`.github/workflows/docs-screenshots.yml` не меняется в #423.

## Критерии приёмки

- **AC1.** Два House Plan issues одного безопасного `translation_key` дают одну
  family/count; другое безопасное семейство попадает автоматически; foreign
  domain и unsafe/missing key не попадают, raw ids/placeholders отсутствуют.
  Доказательство: backend unit/HA test + code review.
- **AC2.** Browser download и relay multipart используют exact filename
  `houseplan-support-{sha256[0:12]}.json`; capability-token отсутствует в имени,
  bytes/hash не меняются. Доказательство: frontend smoke + transport test.
- **AC3.** При исчерпанной quota без replaceable token ответ
  `support_rate_limited` приходит без store loads/executor build; refresh своего
  draft имеет право заменить token и не удаляет старый при build failure.
  Доказательство: HA backend tests.
- **AC4.** Если слот занят конкурентно во время snapshot `await`, финальная
  проверка не превышает лимит и не удаляет прежний token текущего draft.
  Доказательство: управляемый backend test.
- **AC5.** `config/get` всегда возвращает `support_api: 1`, включая projection;
  поле не хранится в config. Старый backend без поля остаётся совместим с
  frontend load, но support form fail-closed. Доказательство: backend + unit.
- **AC6.** Support form/preview/submit работают при разных release versions и
  `support_api === 1`; missing, invalid, 0 или 2 блокируют все три пути одним
  predicate. Доказательство: unit + `smoke_support_feedback.mjs`.
- **AC7.** Все RU/EN/DE/FR support keys непусты, имеют одинаковый key/placeholder
  set и отображают прежний текст, кроме согласованного compatibility message.
  Core содержит только `support.title`; form-only strings принадлежат lazy editor
  graph. Доказательство: i18n + bundle ownership tests.
- **AC8.** Production build имеет initial View gzip строго меньше baseline
  291046 B без изменения budget; Help dialog на четырёх языках остаётся полным.
  Доказательство: build manifest + smoke/code review.
- **AC9.** Backdrop benchmark регистрирует page через `watchPage`, запрашивает
  финальный browser-error verdict и в `--guard-probe` выходит ненулевым при
  injected pageerror без запуска decode-матрицы. Обычный режим сохраняет прежние
  cases/вывод. Доказательство: contract test + динамическая отрицательная probe.
- **AC10.** `.github/workflows/docs-screenshots.yml` не меняется; #423 ссылается
  на #422 как владельца дублирующего пункта. Доказательство: diff/code review.
- **AC11.** Typecheck, unit, build и затронутые backend tests зелёные; runtime
  package/config schemas и UI layout не меняются. Доказательство: локальный цикл
  и Linux CI.
- **AC12.** User Guide и оба changelog описывают capability-based compatibility
  и безопасное имя без технических обещаний о внутреннем SHA-префиксе сверх
  нужного пользователю. Доказательство: docs guard/code review.

## План отрицательной проверки

1. Вернуть агрегацию по `broken_plan_` — тест с новым `translation_key` краснеет.
2. Вернуть filename от token — smoke/transport test находят token prefix.
3. Перенести preflight после executor либо убрать post-await check — отдельные
   quota tests краснеют на build call или превышении лимита.
4. Вернуть сравнение `integration_version === CARD_VERSION` — mixed-release
   smoke краснеет; удалить/reset `support_api` adoption — old-backend case
   краснеет.
5. Вернуть form strings в core dictionary — bundle ownership test находит marker
   в initial graph и initial gzip перестаёт уменьшаться.
6. Удалить `watchPage` или browser-error verdict из benchmark — contract/probe
   краснеет.

## Риски

- **Stale capability после downgrade.** Missing/invalid field явно сбрасывает
  состояние на incompatible при каждом `config/get`.
- **API v2 ошибочно принимается старой карточкой.** Predicate принимает ровно 1;
  additive изменения не повышают API, breaking change повышает.
- **Quota race.** Capacity проверяется повторно после каждого `await`, запись
  replacement выполняется атомарным синхронным участком.
- **Неудачный refresh уничтожает старый preview.** Старый token удаляется только
  после успешного build и финальной capacity-проверки.
- **Repair key раскрывает данные.** Строгая форма ключа и запрет fallback к issue
  id оставляют только проектный translation key.
- **Lazy copy теряет локаль/fallback.** Отдельная parity/placeholder matrix и
  smoke четырёх языков блокируют неполный перенос.
- **Экономия бандла мнимая.** AC фиксирует owner graph и числовой baseline, не
  только общий budget.
- **Benchmark начинает считать ожидаемый per-case FAIL как exception.** Guard
  реагирует только на pageerror; существующий catch/вывод cases сохраняется.

## Откат

Откат implementation-коммита возвращает строгий release-version gate, прежние
filenames, eager support strings, позднюю quota-проверку и старый benchmark.
Persisted data и package schema откатывать не нужно. Backend additive
`support_api` безопасно удалить вместе с frontend predicate одним релизом;
старый frontend и так игнорирует поле.

## Release-артефакты

- обязательны `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же
  User-Visible commit;
- обязательна правка раздела Help & feedback в обоих User Guide;
- golden/docs screenshots не нужны: DOM/layout/text видимой совместимой формы не
  меняются, а compatibility message проверяется текстом/smoke;
- performance artifact — before/after `dist/houseplan-assets.json` с baseline
  initial gzip 291046 B и доказательством ownership;
- security evidence — transport test, где filename не содержит token;
- issue остаётся открытым в `S8-merged` до пакетного закрытия при выпуске беты.

## Принятые предположения

- Владелец подтвердил default: protocol capability важнее равенства product
  versions; первая и единственная поддерживаемая версия сейчас равна 1.
- SHA-256 — уже раскрытая внутри consented preview метаинформация и допустимый
  источник short-id; новое случайное поле не добавляется.
- `translation_key` — каноническое имя Repair family. Repair без безопасного
  translation key считается внутренне некорректным и в support package не
  показывается.
- Все form-only support strings переносятся для четырёх локалей одновременно;
  оставлять RU eager при выносе только EN было бы скрытой архитектурной
  асимметрией.
- Пункт issue про порядок комментария в docs workflow полностью принадлежит
  #422 и не расходует реализацию/ревью #423.
