# CODE-REVIEW-43-r2

- Issue: [#43](https://github.com/Matysh/houseplan-card/issues/43) — Диалог помощи и обратной связи с обезличенным support report
- Ветка: `issue/43-help-feedback`
- SHA ревью: `0e0ca3d4dc38851555a825b9481817642d8647a9`
- Заход: r2 (второй код-ревью) · блокирующих циклов израсходовано **1/4** (r1 был жёлтым — потратил цикл; зелёный вердикт цикла не образует, §4/#227)
- Вердикт: **зелёный** · High: 0 · Medium: 0

## 1. Скоуп раунда

Это второй заход, разбор — по дельте (§2.10 PROCESS.md). Предыдущий вердикт
(r1, жёлтый) получен на SHA `1ba5363038055b3f3442b62a761161d05c6d03c7`
(документ `docs/reviews/CODE-REVIEW-43-r1.md`, SHA явно назван в самом
документе). Дельта:

```
git diff 1ba53630..0e0ca3d4
```

3 коммита сверх r1: `ffddc383` (fix: satisfy validation gates), `40d63080`
(docs: review document — публикация r1, генерирует конвейер, не автор),
`0e0ca3d4` (test: cover help and feedback browser flows).

Продуктовый код изменён только в двух местах, и оба — рефакторинг типов без
изменения поведения:

- `src/houseplan-editor-runtime.ts` (+28/−17): `response: any` → `response: unknown`
  с явным сужением через промежуточный `payload`-объект в `_buildSupportPreview`
  и `_submitSupport`. Логика чтения полей (`text`, `size`, `token`, `sha256`,
  `report_id`, …) идентична строка в строку — только тип входа сузился.
- `src/support-feedback.ts` (+4/−3): `options.language as any` → typed
  `readonly string[]`, `(value as any).code` → `(value as {code?:unknown}).code`.
  Тоже чистое сужение типа, не логики.

`custom_components/houseplan/**/*.py` в дельте не тронут вообще (проверено
`git diff --stat 1ba53630..HEAD -- custom_components/` — только сгенерированные
`frontend/**`). Единственная правка бэкенда — 158 новых строк тестов в
`tests_backend/test_support_package.py`, сам `support_package.py` не менялся.

Остальное — тесты и инфраструктура: новый `demo/smoke_support_feedback.mjs`
(270 строк), 6 golden-сцен в `demo/golden/matrix.mjs` + ветка `dialog === 'support'`
в `demo/golden/harness.mjs`, обновлённый `demo/smoke_general_settings.mjs`,
новый мутант в `scripts/mutation-gate.mjs`, обновлённый `docs/images/screenshots.json`
(отпечаток скриншотов).

Дельта локальна: контракт поведения не менялся, новая подсистема не задета,
объём (≈390 строк не считая бандла) на порядок меньше исходной задачи
(+7023/−411 в r1). Полный повторный разбор не требуется — §2.10.

## 2. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1.** `check-docs` красный — устаревший `sourceFingerprint` скриншотов | `docs/images/screenshots.json` обновлён (`sourceFingerprint`/`sourceSha256` во всех сценах: `7faa6c2e…` → `7e950337…`) коммитом `ffddc383` | Лично прогнал `node scripts/check-docs.mjs` на HEAD `0e0ca3d4` → `Documentation checks passed (7 files, 10 external links)` |
| **M2.** Ни одного браузерного смока/golden-сцены для диалога Help & Feedback | Новый `demo/smoke_support_feedback.mjs` (режимы view/plan/devices/decor, kiosk, read-only, EN/RU, старый backend, validation/focus, preview/SHA/download exact bytes, success/429/timeout/unknown, retry с тем же idempotency key, 320×760 и 760×320, touch-target 44px) + 6 golden-сцен в `matrix.mjs` (`support-desktop-empty-light-en`, `support-desktop-preview-dark-en`, `support-phone-validation-light-ru`, `support-phone-success-dark-en`, `support-relay-error-light-en`, `support-tablet-preview-dark-ru`) + ветка `dialog === 'support'` в `demo/golden/harness.mjs`, оба коммитом `0e0ca3d4` | Лично прогнал `node demo/smoke_support_feedback.mjs` на свежем бандле — все 18 полей `true`, `OK`. Лично прогнал `node scripts/mutation-gate.mjs --id=support-timeout-claims-success` — `чистый прогон` + `тест покраснел, как обязан`, `поймано 1 из 1`: смок реально умеет падать на мутанте §14.4 (ложный success на timeout). Лично прогнал `node demo/golden/run.mjs --mode=capture --scenario=<каждая из 6>` — все 6 строятся без ошибки (`missing-baseline`, не `error`; baseline умышленно не принят до предрелизного визуального ревью, это по процессу, не пропуск). `test/golden-matrix.test.mjs` получил новый тест «issue 43 support dialog has the six reviewed responsive states», зелёный в `npm test` |
| **M3.** `no-new-any` красный — 4 новых `any` без обоснования | Все 4 типизированы (см. §1) коммитом `ffddc383` | Лично прогнал `node scripts/no-new-any.mjs --base origin/dev --head HEAD` на HEAD `0e0ca3d4` → `Новых any нет` |

Все три Medium закрыты предметно — не косметика вокруг находки, а именно то,
что было названо (актуальный отпечаток вместо любого другого фикса; смок и
golden именно для нового диалога, а не для соседней фичи; типизация именно тех
четырёх строк).

## 3. Унаследовано из r1

Без повторной проверки в этом раунде — код на этих участках дельта не
затронула, полный разбор см. `docs/reviews/CODE-REVIEW-43-r1.md`
(SHA `1ba53630`):

- Allowlist-проекция `support_package.py`: 8 `_project_*`-функций строят новый
  `dict`, не мутируя исходник (§7.3). Сам файл в дельте не менялся —
  дельта только добавила тесты поверх него (см. §5).
- Авторизация и владение токеном на всех трёх WS-командах
  (`_check_write`/`may_write`, сверка `preview.get("owner")`).
- Транспорт: фиксированный HTTPS-хост, без редиректов, таймауты 5/20с, статус
  мапится на закрытый список кодов до чтения тела.
- Relay `scripts/support-relay/**`: не менялся дельтой, 36/36 тестов,
  инварианты против подмены `X-Forwarded-For` (живой пентест владельца при
  ревью ТЗ r3-r5).
- «Одно число — один источник» для preview/download/submit (§2.6 r1) —
  цепочка байт/хеш не менялась.
- Деградация на старом backend (`compatible = _haIntegrationVersion === CARD_VERSION`).
- AC15 (нулевое влияние на `diagnostics.py`/`import_export.py`/`validation.py`).
- Трейлеры и changelog коммита `1e2e0fa6` (Issue/User-Visible, оба changelog
  в одном коммите) — не пересматривались, дельта changelog не трогает.
- Low-находки r1 (L1 единицы Caddyfile, L2 порядок проверки CPU/лимита, L3
  `_support_repairs()` без sentinel-теста, L4 неиспользуемые i18n-ключи
  `backup.error.support_*`) — сняты решением ревьюера r1 с записью, дельта их
  не касается, повторно не поднимаю.
- Ограничение проверки бэкенда: полный HA-харнесс (`test_ha_websocket.py` и
  т.д.) в r1 не поднимался (нет закреплённой версии Python 3.14/phcc в
  песочнице ревьюера) — то же ограничение действует и здесь, оно не связано с
  дельтой (AC9/AC10 остаются «проверено чтением», не автотестом с моей
  стороны, как и в r1).

## 4. Как проверялось в этом раунде

Дешёвые гейты гоняются в каждом раунде (§2.10); прогнаны лично на HEAD
`0e0ca3d4`, зелёного Validate CI на этом SHA нет — обязанность ревьюера (см.
задание раунда).

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный, 0 ошибок |
| Юнит/интеграционные | `npm test` | 1725 тестов: 1724 passed, 1 skipped, 0 failed — совпадает с числом из хендоффа автора |
| Сборка + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| Три копии бандла | `npm run bundle:sync` | `git status` чист после — `dist`, `custom_components/.../frontend`, `demo/srv/assets` синхронны |
| Docs-контракт (диапазон меняет `src/**`) | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — M1 закрыт |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | `Новых any нет` — M3 закрыт |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | «гейт пройден, предупреждений 0», 18 коммитов |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 6 изменённых файлов `src/**`, 37 «прямое совпадение»; `demo/smoke_support_feedback.mjs` назван прямым совпадением по символам `_closeSupportDialog, _config, _downloadSupportPreview, _editorRuntime, _haIntegrationVersion, _submitSupport` — ровно то, что и требовалось запустить |
| Целевой смок (новый, M2) | `node demo/smoke_support_feedback.mjs` | все 18 проверок `true`, `OK` |
| Целевой смок (изменённый, About moved out) | `node demo/smoke_general_settings.mjs` | все проверки `true`, `OK`, включая новую `aboutMovedOut: true` |
| Мутационный гейт нового смока | `node scripts/mutation-gate.mjs --id=support-timeout-claims-success` | `ok чистый прогон` + `ok тест покраснел, как обязан` → `поймано 1 из 1` — смок доказуемо умеет падать (дисциплина §2.7/§18) |
| Golden-сцены (существование/сборка) | `node demo/golden/run.mjs --mode=capture --scenario=<id>` для всех 6 новых сцен | все 6 строятся без ошибки (`missing-baseline`, не `error`) |
| Бэкенд-тесты дельты | `pip install pytest voluptuous` (без пина, как в r1) → `python -m pytest tests_backend/test_support_package.py -q` | `14 passed` (10 старых + 4 новых: reject non-mapping, rich-projection sentinel, projection helpers fail-closed, size-limit-after-projection) |

## 5. Разбор по AC, чьё доказательство дельта задевает

Обозначения как в r1: **PASS/тест** — автотест, умеющий падать (см. §4);
**PASS/чтение** — проверено чтением; **∅** — не переоценивался, см. §3.

| AC | Было (r1) | Стало (r2) | Почему изменилось |
|---|---|---|---|
| AC1 | PASS/чтение | **PASS/тест** | `smoke_support_feedback.mjs`: порядок кнопок (`afterSettings` = `.support-button` идёт после `mdi:cog-outline`), неизменность режима/zoom/выбора при открытии для всех 4 режимов, `kioskHidden`, `readonlyAbsent` — все `true` |
| AC2 | PASS/тест+чтение | PASS/тест+чтение (усилено) | Логика не менялась (тест `test/support-feedback.test.mjs` не в дельте); новый смок добавляет DOM-уровень: `aboutAndEnglishGuide`/`russianGuide`/`oldBackendDegrades` — `true`. `smoke_general_settings.mjs` подтверждает `aboutMovedOut: true` — блок не задвоен |
| AC3 | PASS/тест | PASS/тест (усилено) | `freshDefaults`, `freshAfterSuccess` — новый черновик пуст при каждом открытии/после успеха, чекбокс не сохраняется, теперь и на уровне браузера, не только unit |
| AC4 | PASS/тест | PASS/тест (усилено) | `openIsLocal`: открытие диалога не увеличивает счётчик `houseplan/support/*`-вызовов до включения чекбокса |
| AC5, AC9, AC10 | PASS/тест(+чтение) | ∅ (логика не менялась) | Единственная правка смежного кода — сужение `any → unknown` в `_buildSupportPreview`/`_submitSupport`; путь чтения полей (`payload.text`, `payload.token`, …) идентичен построчно старому `response?.text` и т.д. — проверил диффом, поведение при `response` не-объектом (`undefined`) то же самое (`{}` фоллбэк даёт те же `''`/`NaN`, что и `?.`) |
| AC6, AC7, AC8 | PASS/тест | ∅, но с дополнительным покрытием | `support_package.py` не менялся; `tests_backend/test_support_package.py` получил 4 новых теста, включая структурный `test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values` (сеет `poly`/`walls`/`markers`/`decor` с частично некорректными формами и секретными полями, проверяет точный спроецированный результат) — прогнал сам, 14/14 зелёных. Это усиление доказательства, не обязательное по находкам r1, но не создаёт риска: тесты только добавляют строгости |
| AC13 | PASS/чтение | **PASS/тест** | Смок покрывает success/`support_rate_limited`/`support_unavailable` (timeout)/`unknown_command`, ретрай с тем же `idempotencyKey` (4 запроса с одним и тем же ключом), сохранение черновика при ошибке. Мутационный гейт `support-timeout-claims-success` подтверждает, что смок красный на реальной регрессии — не просто зелёный тест-пустышка |
| AC14 | PASS/чтение, UNVERIFIED по заявленному способу | **PASS/тест** (touch/layout), golden-candidate (не baseline) | `touchTarget` (≥44×44), `noHorizontalOverflow`, `phonePortrait`/`phoneLandscape` (320×760, 760×320 без клиппинга) — реальный браузерный рендер, не чтение TS. 6 golden-сцен покрывают desktop/phone/tablet × light/dark по именам состояний из §14.2 ТЗ; baseline умышленно не принят (процесс требует полного Linux CI артефакта для приёмки — это предрелизный шаг, не код-ревью) |
| AC11, AC12/12a, AC15, AC16, AC17 | PASS | ∅ | Relay, backend-модули diagnostics/import_export/validation, i18n-независимость и lazy-импорт дельтой не задеты — код идентичен r1 |

## 6. Находки этого раунда

Ничего блокирующего. Одна наблюдение уровня Low, снимаю с записью, не
блокирует:

**L5 (новая, Low).** Старый `demo/smoke_general_settings.mjs` проверял в
реальном DOM точные атрибуты About-ссылок (`href`, `target=_blank`,
`rel=noopener`) и точный текст версии (`Houseplan Card v${BUNDLE_VERSION}`) —
эта проверка выпала при переносе About в новый диалог: замена,
`aboutAndEnglishGuide` в `smoke_support_feedback.mjs`, проверяет только
количество `.aboutlink` (`=== 2`) и суффикс `href` guide-ссылки, не точные
`href`/`target`/`rel` GitHub/Telegram-ссылок и не текст версии. Не блокирую:
разметка статична (`src/houseplan-editor-runtime.ts:9387-9397`, атрибуты
захардкожены в шаблоне), риск молчаливого дрейфа без сопутствующей правки кода
практически нулевой, а `test/support-feedback.test.mjs` (не в этой дельте)
уже проверяет текстом, что `gs.about_version` не задвоен. Стоит вернуть
точную проверку атрибутов при следующей правке этого смока, отдельного issue
не требует.

## 7. Что проверено и корректно (в дополнение к §3)

- Три Medium из r1 закрыты предметно, не декларативно — по каждой лично
  воспроизвёл зелёный результат на HEAD этого раунда (см. таблицу §2 и §4).
- Новый смок доказуемо способен упасть: мутационный гейт `support-timeout-claims-success`
  красит именно `demo/smoke_support_feedback.mjs`, а не абстрактный юнит —
  снимает риск «зелёный тест ничего не проверяет», который прямо назван в
  документации самого `mutation-gate.mjs`.
- Рефакторинг типов (`any` → `unknown`/сужение) не меняет поведение: логика
  чтения полей идентична, `npm test` (1724/1724 незменившихся зелёных) и
  целевые смоки подтверждают эквивалентность.
- Три копии бандла синхронны, `git status` чист после `bundle:sync` —
  класс D не расходится с классом A.
- Трейлеры всех трёх коммитов дельты корректны (`Issue: #43`,
  `User-Visible: no` — оправданно, видимого поведения дельта не меняет,
  changelog не тронут).
- `process-gate --issues` зелёный, 0 предупреждений на 18 коммитах диапазона.

## 8. Чего не проверял и почему

- **Полный HA-харнесс** (`test_ha_websocket.py` целиком) — то же ограничение
  песочницы, что и в r1 (нет закреплённой Python 3.14/`pytest-homeassistant-custom-component==0.13.357`);
  дельта не меняет ни один файл, который этот харнесс покрывал бы иначе, чем
  уже покрыто в r1. AC9/AC10 остаются на «проверено чтением».
- **`npm run invariants`** — диапазон не меняет геометрию/`layout`/толщину
  стен ни в r1, ни в дельте; неприменимо, не пропуск.
- **`golden:verify`/приёмка эталонов** — 6 новых сцен собираются без ошибки,
  но baseline не принимался: это предрелизный шаг (§8 PROCESS.md,
  `npm run golden:accept -- --reviewed` только по полному Linux CI
  артефакту), не обязанность код-ревью. Локальный `golden:verify` на всей
  матрице не гонял — большинство существующих сцен в этой песочнице дают
  `different` уже на `origin/dev` (другой Chromium/шрифты), это фон, не
  регрессия дельты, и полный прогон — предрелизная, а не ревью-обязанность.
- **Полный набор `demo/smoke_*.mjs`** (213 файлов) — не оправдано: дельта не
  меняет ничего, что затрагивало бы несвязанные поверхности; `smoke-select.mjs`
  подтверждает совпадения только на общих символах для остальных 36 файлов
  (типовой фон, тот же вывод, что и в r1).
- **Relay `scripts/support-relay/**`** — не в дельте, не перепрочитывал
  повторно (r1 уже перечитал этот код заново как часть первого код-ревью, а
  не принял на веру со спек-ревью).

## 9. Итог

Все три Medium-находки r1 закрыты предметно, каждая — воспроизведённым
зелёным результатом на HEAD этого раунда, а не заявлением автора. Дельта не
меняет продуктовую логику (только сужение типов и добавление тестов/смоков/
golden-сцен), поэтому полный повторный разбор всех 17 AC не требовался —
переоценены только AC1/AC2/AC3/AC4/AC13/AC14, чьё доказательство дельта
затронула, остальные унаследованы из r1 без изменений в коде, который их
доказывает. Новый браузерный смок дополнительно подтверждён мутационным
гейтом — это не пустой зелёный тест. High-находок нет, Medium-находок нет,
одно Low-наблюдение снято с записью в этом же документе.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0
