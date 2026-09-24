# CODE-REVIEW-617-r1

- Issue: [#617 «Загрузка плана > ~3 МиБ обрывает WebSocket без сообщения»](https://github.com/Matysh/houseplan-card/issues/617)
- ТЗ: тело issue #617, раздел `## ТЗ` (докладов в `docs/specs/` не создаётся — решение #517)
- Спек-ревью: `SPEC-REVIEW-617-r1.md`, вердикт зелёный, High 0 / Medium 0, одна Low
  («новый необязательный параметр» `allowOriginal` уже существовал)
- Ревью-SHA: `e5305cff67d76c3c65de7513c5fc5dbd3f805cd9` (`git rev-parse HEAD` сверен
  перед выводом вердикта), дерево `6e53f3f648200949e8079bc738ffba7ef60e6b12`
- База диапазона: `origin/dev` = `c8f9b5d3b4cd279818412114d3c0439bffcbbf7a`
- Заход: **r1** · блокирующих циклов израсходовано **0 из 2** (лёгкий трек)
- Материал: `git log --oneline origin/dev..HEAD` — два коммита
  (`f2c9321a` fix, класс A/B, User-Visible: yes; `e5305cff` test, класс B,
  User-Visible: no); `git diff origin/dev...HEAD` — 77 файлов

## Важная процедурная находка (не блокирует)

Тело issue #617 менялось после зелёного ревью ТЗ. Записанный в
`SPEC-REVIEW-617-r1.md` («Материал раунда», автогенерированный якорь)
хеш тела — `f8d7f51e97db367fb59302863a5ab105d72a8aa34c7fa955fdc6ee29139973c6`
(18220 байт). Текущий `sha256(тело issue, UTF-8, как отдаёт gh issue view
617 --json body)` = `696d986cca3720a468ba776055d544cececd4713062b4c5e5b6e2e44ced87092`
(27142 байта) — не совпадает. GitHub не хранит diff тела, поэтому точную
дельту показать нельзя (см. вводную инструкцию к этому ревью, #517).

Как это повлияло на ревью: **все AC этого документа сверялись с ТЕКУЩИМ
полным текстом ТЗ** (раздел «Критерии приёмки», AC1–AC8), а не с версией на
момент спек-ревью. Расхождений между текущим текстом и тем, что описывает
хендофф разработчика (`f2c9321a`, `e5305cff`), не найдено — контракт
сервера, клиентский хелпер, i18n-ключи, таблица ответов, «принято
предположительно» — всё, что implementation утверждает, дословно
соответствует текущему тексту issue. Похоже, что рост тела — это
добавление разделов ТЗ уже ПОСЛЕ первичного короткого баг-репорта (в теле
явно виден шов `---` между старым «Из аудита 22.09…» и новым «## ТЗ»), то
есть спек-ревью проверяло более раннюю/короткую редакцию текста, а
разработчик и это ревью работают с финальной. Called out here per
инструкции; не заводит отдельного цикла, поскольку код полностью
соответствует финальному тексту, который я и проверял.

## Скоуп изменения

Файл плана в диалоге пространства (редактор и онбординг) теперь грузится
по `POST /api/houseplan/plans/upload` вместо base64 внутри WS-кадра
`houseplan/plan/set`, который аварийно закрывал соединение выше ≈3 МиБ
(дефолтный 4 МиБ лимит кадра aiohttp) и делал заявленный `MAX_PLAN_BYTES =
8 МиБ` недостижимым. WS-команда остаётся для старых закешированных
карточек, пишет через тот же общий writer. Работа обслуживает J4/J6
(`docs/SCOPE.md`) — «загрузка плана без сюрпризов» часть онбординга и
поддержания плана.

## Как проверялось

Прочитаны перед вынесением вердикта: `docs/SCOPE.md`,
`docs/process/REVIEWER.md`, `AGENTS.md`, тело issue #617 целиком со всеми
7 комментариями (два хендоффа разработчика, разбор красного Validate на
`f2c9321a`, фикс тестовой фикстуры в `e5305cff`), `docs/USER-GUIDE.ru.md`
(терминология «План», «Файлы и квоты»).

Код читан построчно по всему диффу (77 файлов; бандл/`dist` — сверены
пересборкой, не читались построчно): `custom_components/houseplan/plans.py`,
`http_api.py`, `websocket_api.py`, `__init__.py`, `src/backdrop-pick.ts`,
`houseplan-editor-runtime.ts`, `houseplan-onboarding-runtime.ts`,
`space-dialog.ts`, i18n × 4 языка, `USER-GUIDE.{md,ru.md}`,
`CHANGELOG.{md,ru.md}`, `docs/testing-notes/decor-and-backdrop.md`,
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`,
`scripts/monolith-baseline.json`, оба backend-теста, TS unit-тест, три
изменённых смока.

### Гейты — что прогнано лично на `e5305cff`

CI-статус на входе: «Validate» (дешёвые гейты) на `e5305cff` зелёный
([run 35957714954](https://github.com/Matysh/houseplan-card/actions/runs/35957714954)),
«Бэкенд: pytest в Home Assistant» (полный HA-харнесс, Linux CI) зелёный
([run 35956794697](https://github.com/Matysh/houseplan-card/actions/runs/35956794697)).
**Важно:** dispatch мутация-гейта (тот, что реально патчит код, собирает
бандл/пакет и проверяет, что гвард краснеет) на `e5305cff` НЕ запускался —
последний комментарий автора прямо это называет («dispatch с мутантами на
нём ещё не запускался»). Поэтому защитные AC (AC2–AC5) я доказывал не
табличкой из ТЗ, а личным прогоном.

| Гейт | Результат | Как |
|---|---|---|
| `npx tsc --noEmit` + `rollup -c` (build) | ok | `npm run bundle:sync`, `git status --short` после — пусто (бандл байт-в-байт совпал с закоммиченным) |
| `npm test` (полный) | не перегонял | принят по зелёному Validate `e5305cff`; локально прогнан только изменённый/новый файл — см. ниже |
| `node --test test/plan-upload-limit.test.mjs` | **ok**, 5/5 | лично, после `tsc -p tsconfig.test.json && fix-test-build.mjs` |
| `python3 -m pytest tests_backend/test_plan_upload.py` | **ok**, 8/8 | лично (после `pip install pytest voluptuous` — окружение сессии их не имело; полный HA-харнесс не поднимал, он уже зелёный в CI) |
| `python3 -m pytest tests_backend/test_ha_upload.py` (13 новых веток) | не перегонял, полный HA-харнесс тяжёл для локальной установки (нужен Python ≥3.13 для `pytest-homeassistant-custom-component`) | принят по зелёному CI-прогону на этом SHA |
| `node scripts/check-docs.mjs --screenshots=warn` | ok (7 файлов, 12 ссылок; предупреждение о скриншотах — известный несвязанный долг #479) | лично |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | ok, новых `any` нет (145 добавленных строк в 5 файлах) | лично |
| `npm run lint:unused` | ok, все числа монолита совпали с базой | лично |
| `npm run bundle:budget` | ok (headroom-предупреждение — известный несвязанный долг #367/#474, новый код лежит в ленивом графе редактора, eager View не вырос) | лично |
| `node scripts/mutation-gate.mjs --check` (заморозка якорей) | ok, 0 stale | лично |
| `node scripts/mutation-gate.mjs --id=plan-upload-client-limit` | **ok, поймано 1/1** | лично — патч снимает клиентскую проверку предела, гвард (`smoke_plan_upload_limit.mjs`) краснеет |
| `node scripts/mutation-gate.mjs --id=plan-upload-guard-original` | **ok, поймано 1/1** | лично — патч возвращает `allowOriginal=true`, гвард краснеет |
| `node scripts/mutation-gate.mjs --id=plan-upload-reduced-over-limit-staged` | **ok, поймано 1/1** | лично — патч отключает повторную проверку после уменьшения, гвард краснеет |
| `node scripts/mutation-gate.mjs --id=plan-upload-413-text-dropped` | **ok, поймано 1/1** | лично — патч убирает разбор `too_large`, юнит-тест краснеет |
| `node scripts/mutation-gate.mjs --id=plan-upload-server-bound` | **ok, поймано 1/1** | лично — патч сдвигает потоковую границу на `chunk`, pure pytest краснеет |
| `node demo/smoke_plan_upload_limit.mjs` | ok, все 26 проверок true | лично, на пересобранном бандле |
| `node demo/smoke_plan_upload_reject.mjs` | ok | лично |
| `node demo/smoke_plan_upload_race.mjs` | ok | лично |
| `node demo/smoke_backdrop_guard.mjs` | ok, все 13 проверок true | лично (декор/#39 паритет после смены b64→blob) |
| `node demo/smoke_decor_images.mjs` | ok, все 13 проверок true | лично (декор-путь `renderBackdropGuard` без `planLimitBytes` не задет) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 14 прямых совпадений (включая оба plan-upload смока и `smoke_backdrop_guard`), 32 слабых | вывод приложен ниже; все относящиеся к диффу смоки прогнаны явно, не только по совпадению |
| `npm run invariants` | не применимо | геометрия не менялась (AC/диф этого не касаются) |
| `python -m pytest` (полный HA, все `test_ha_*.py`) | не перегонял целиком | зелёный на этом SHA в CI, локально нет python≥3.13 |
| performance-профили | не применимо | AC их не называет; ТЗ явно говорит «нет влияния на рендер и бюджеты», бюджет бандла проверен (`bundle:budget`) |

Вывод `smoke-select.mjs` (кратко): «Изменено файлов src/**: 5 · символов
на изменённых строках: 17»; прямое совпадение включает
`smoke_plan_upload_limit.mjs`, `smoke_backdrop_guard.mjs`,
`smoke_decor_images.mjs` (все три прогнаны выше); `smoke_plan_upload_race`
и `smoke_plan_upload_reject` попали в категорию «слабая связь» по имени
`_spaceDialog» (символ слишком общий, чтобы инструмент дал прямое
совпадение), но они прогнаны лично — оба зелёные — потому что диф их
явно и умышленно правит (не по подсказке инструмента, а по факту `git diff
--stat`).

## Разбор критериев приёмки (текущий текст ТЗ)

| AC | Разбор | Вердикт |
|---|---|---|
| AC1 (5 МиБ → один POST, `plan_url` из ответа, соединение живо) | `smoke_plan_upload_limit.mjs`: `fiveMiBOnePost`, `fiveMiBBytesSent`, `editorPlanSetCalls=0`, `planUrlFromResponse`, `dialogClosedAfterSave` — все true; backend `test_issue_617_plan_upload_stores_a_5_mib_plan_byte_for_byte` — sha256 на диске совпадает. Прогнано лично. | **Доказан** |
| AC2 (SVG `MAX+1` → тост «8», без запросов) | Юнит `test/plan-upload-limit.test.mjs` + смок `svgToastNamesLimit/svgNotStaged/svgNoRequests`. Мутант `plan-upload-client-limit` красный на снятой проверке — прогнан лично. | **Доказан, защитный AC подтверждён мутацией** |
| AC3 (растр `MAX+1` → диалог #39 без «Оставить оригинал», уменьшенная копия `>` предела → тост) | Смок: `guardHidesOriginal`, `guardOffersReduced`, `guardBodyNamesLimit`, `reducedWithinLimit`, `oversizedReducedToast/NotStaged` — все true. Два мутанта (`plan-upload-guard-original`, `plan-upload-reduced-over-limit-staged`) красные — прогнаны лично. Читкой подтверждена точная ветка `hard`/`unknown` → старые тексты сохраняются, `safe`/`warn` над пределом → новый `backdrop.over_limit_body` (`renderBackdropGuard`, `src/backdrop-pick.ts:236-250`). | **Доказан, обе защитные ветки подтверждены мутацией** |
| AC4 (сервер: граница включительная, 403/400×2/400 no_file/one_file_only/bad_request/507) | `tests_backend/test_ha_upload.py` (5 новых тестов) — зелёные в CI на этом SHA; `tests_backend/test_plan_upload.py` (pure, включает потоковую границу) — 8/8 лично. Мутант `plan-upload-server-bound` (сдвиг границы на `chunk`) красный — прогнан лично. HA-специфичные ветки (403/`may_write`, реальный `request.multipart()`) проверены чтением (`http_api.py:388-436`) + CI, не переисполнены локально (нет HA-харнесса) — **проверено чтением, не исполнением**, для этой части. | **Доказан** (частично — чтением для HA-веток, исполнением — для pure-веток и границы) |
| AC5 (413 сервера → текст с пределом, диалог открыт, `config/set` не отправлялся) | Юнит `#617 AC5` (4 сценария, включая 413 без JSON — прокси). Смок: `serverTooLargeToast/DialogOpen/NoConfigSet` — true. Чтением подтверждено: `_saveSpaceDialog` (`houseplan-editor-runtime.ts:8083-8161`) шлёт `uploadPlanFile` ДО `_saveConfigNow()`, исключение уводит в `catch` (`:8206-8221`), который не закрывает диалог и не шлёт `config/set`. Мутант `plan-upload-413-text-dropped` красный — прогнан лично. | **Доказан, защитный AC подтверждён мутацией** |
| AC6 (одно число TS/Python/оба USER-GUIDE) | `test/plan-upload-limit.test.mjs` первый тест — читает все 4 источника и сравнивает; прогнан лично, зелёный. | **Доказан** |
| AC7 (WS не меняется, общий writer) | `websocket_api.py:2348-2384` — `ws_plan_set` вызывает `store_plan_upload`, никаких собственных `atomic_write`/`check_quota`/`token_hex`; backend `test_issue_617_both_transports_write_through_the_one_writer` проверяет это по тексту модулей (исполнением, не regex-догадкой — тест реально импортирует и парсит функцию). Существующие WS-тесты плана не правились (диф не касается их ожиданий). | **Доказан** |
| AC8 (оба рантайма — один хелпер) | `houseplan-editor-runtime.ts` и `houseplan-onboarding-runtime.ts` оба вызывают `stagePlanFile`/`uploadPlanFile`/`renderPlanBackdropGuard` из `backdrop-pick.ts` — сверено чтением обоих файлов, идентичные вызовы. Смок гоняет обе поверхности (`onboardingOnePost`, `onboardingPlanSetCalls=0`). | **Доказан** |

## Проверено чтением и корректно (без отдельного прогона)

- Единая точка авторизации: HTTP-view вызывает `may_write(hass,
  request.get("hass_user"))` (`http_api.py:388`), WS — `_check_write` →
  тот же `may_write` (`websocket_api.py:305-307`, `auth.py:16`). Одна
  политика на обоих транспортах.
- `PLAN_EXTENSIONS` — один и тот же набор в схеме WS-команды
  (`websocket_api.py:2326`, `vol.In(sorted(PLAN_EXTENSIONS))`) и в проверке
  HTTP-view (`http_api.py:434`). Паритет форматов не может разъехаться.
- Порядок проверок во view (`unauthorized` → `not_ready` → `Content-Length`
  too_large → чтение multipart → `invalid_space_id` → `bad_ext` →
  `no_file`) соответствует таблице ТЗ буквально построчно.
- Копия-при-записи: `store_plan_upload` создаёт НОВОЕ уникальное имя,
  ничего не удаляет (`plans.py:315-337`); backend-тест
  `test_issue_617_store_plan_upload_is_copy_on_write` подтверждает это
  исполнением.
- Отказ по квоте не оставляет следов: `test_issue_617_store_plan_upload_quota_refusal_leaves_nothing`
  и HA-тест `test_issue_617_plan_upload_limit_is_inclusive_and_refusal_leaves_nothing`
  оба явно листят директорию до/после и сравнивают.
- Декор не задет: `renderBackdropGuard` получил необязательный 7-й параметр
  `planLimitBytes`; единственный вызов из decor-пути
  (`houseplan-editor-runtime.ts:7933`, ветка `decorReplace !== null`) его не
  передаёт → `overPlanLimit` всегда `false` → старое поведение. Подтверждено
  и чтением, и прогоном `smoke_decor_images.mjs` (все 13 проверок).
- i18n: все 4 языка (`en/ru/de/fr`) получили оба новых ключа
  (`toast.plan_too_large`, `backdrop.over_limit_body`), переведены по
  смыслу (fr — «Mo», как в существующем `err.too_large`, как и требует ТЗ).
- Release-артефакты: `docs/CHANGELOG.md`/`.ru.md` — в том же коммите
  `f2c9321a`, что и `User-Visible: yes`; `docs/USER-GUIDE.md`/`.ru.md` —
  число 8 не менялось, добавлена ровно одна фраза, как в ТЗ.
- Трейлеры: оба коммита несут `Issue: #617`; `f2c9321a` —
  `User-Visible: yes` с обоими changelog в том же коммите, `e5305cff` —
  `User-Visible: no` (тест-онли правка, продуктовый код побайтово не
  менялся — подтверждено самим автором и не опровергнуто чтением диффа).
- «Одно число, один источник» (§8): 8 МБ имеет единственный источник
  правды — `Python MAX_PLAN_BYTES`; TS-константа и оба USER-GUIDE — её
  производные, связаны тестом. В диффе нет второго места, где число «8»
  или «8388608» было бы захардкожено независимо.
- Второй проход по r2-коммиту `e5305cff`: правка только теста
  (`tests_backend/test_ha_upload.py`), продуктовый код (`src/**`,
  `custom_components/**`) побайтово идентичен `f2c9321a` — проверено
  `git diff f2c9321a e5305cff --stat` (единственный изменённый файл —
  тест). Ни одна проверка не ослаблена, добавлена ветка `bad_request` для
  не-multipart тела, которая раньше не проверялась вовсе.

## Чего не проверял

- Полный `npm test` (весь набор `test/*.test.mjs`) не перегонял целиком —
  принят по зелёному Validate CI на этом SHA; прогнал только изменённый
  файл (`plan-upload-limit.test.mjs`) лично.
- Полный HA-харнесс `tests_backend/test_ha_upload.py` (13 новых тестов
  #617 + все существующие) не перегонял — окружение сессии не имеет
  Python ≥3.13, необходимого для `pytest-homeassistant-custom-component`.
  Принят по зелёному прогону CI на этом же SHA
  ([run 35956794697](https://github.com/Matysh/houseplan-card/actions/runs/35956794697)).
  Pure-часть той же логики (`test_plan_upload.py`) прогнана лично.
- Полный dispatch мутация-гейта (весь реестр, не только 5 plan-upload
  мутантов) не гонял — это предрелизный/ночной объём, несоразмерный ревью
  (§8). Прогнаны только 5 мутантов, относящихся к этой задаче
  (`plan-upload-client-limit`, `plan-upload-guard-original`,
  `plan-upload-reduced-over-limit-staged`, `plan-upload-413-text-dropped`,
  `plan-upload-server-bound`) — все пойманы.
- Не проверял поведение при пустом файле/пустом текстовом поле
  (`read_bounded` на 0 байт возвращает `b""`, не `None`) — не описано ни
  одним AC, не поведенческий риск (совпадает с существующим поведением WS
  на пустой `data`).
- Не гонял `npm run golden:verify` — диф не меняет рендер геометрии/сцены,
  ТЗ прямо говорит «Golden … нет».
- Не гонял `npm run invariants` — геометрия/ссылки на неё не менялись.
- Не проверял поведение прокси перед HA (413 без тела) вживую — только
  юнит-симуляцией (`answer(413, null)` в тесте); реальный прокси не
  разворачивал.
- Не проверял вручную в браузере (ручного тестирования в цикле нет,
  согласно инструкции) — вместо этого лично прогнаны все относящиеся к
  диффу смоки на pupeteer/Chromium, что и есть эквивалент «работает».

## Находки

Нет находок High или Medium в скоупе задачи. Одна процедурная заметка (не
Low-дефект кода) — расхождение хеша тела issue с зафиксированным в
спек-ревью, см. раздел выше; код полностью соответствует финальному
тексту, отдельного цикла не требует.

## Вердикт

Все 8 AC доказаны — где автотестом с личным подтверждением, что тест умеет
падать (5 защитных AC подтверждены персонально прогнанной мутацией не по
заявлению автора, а по факту красного гварда), где чтением с явной
записью для HA-веток, недоступных в этом окружении, но зелёных на этом же
SHA в CI. Общий writer, единая авторизация и общий набор расширений
исключают дрейф между HTTP и WS путями. Декор и остальной не-скоуп не
задеты — подтверждено и чтением, и прогоном. Трейлеры и changelog в
порядке. Единственная процедурная находка (расхождение хеша тела issue) не
меняет вывод: реализация соответствует финальному тексту ТЗ построчно.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/617-plan-http-upload`, коммит `e5305cff67d7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6e53f3f648200949e8079bc738ffba7ef60e6b12`
  ```
  git log --all --format='%H %T' | grep 6e53f3f64820
  ```
- Тело issue: `6682a2131de842acea0a178f21d254b2d3c0fb88309a244451362a5bb4475514`
- Вердикт конвейера: `green` · High 0
