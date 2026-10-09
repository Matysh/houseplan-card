# CODE-REVIEW-626-r1

Issue: #626 · этап: code · заход: r1 · материал: `552504b834c73484779720a356150aaee92afc28`
(рабочая копия уже на нём; `git rev-parse HEAD` = `552504b834c73484779720a356150aaee92afc28`)
Ветка: `issue/626-acl-policy` · база: `origin/dev` (merge-base `d5df838976f6be55d30048510773b6079dce50c1`)
Validate на материале: success, `workflow_dispatch`,
https://github.com/Matysh/houseplan-card/actions/runs/36125882168

## Скоуп

ТЗ (issue body, ревью SPEC-REVIEW-626-r1, зелёный) требует:

1. `may_write()` — единственный источник writer-прав для WS/HTTP: admin всегда
   writer; `admin_only=true` — только admin; `admin_only=false` — обычный
   non-admin пишет, `system-read-only` — нет; неизвестный/неполный user —
   fail-closed.
2. `houseplan/plans/list` закрыт тем же guard-ом, стандартная ошибка
   `unauthorized`, без сканирования каталога для не-писателя.
3. `houseplan/trail/get` рекурсивно очищен от ключа `source` без мутации
   `TrailBook`.
4. Документация (`USER-GUIDE.ru.md` §2/§20, `SCOPE.md`, `ARCHITECTURE.md`) и
   оба changelog синхронизированы с контрактом.

Не-скоуп (подтверждаю по диффу — не тронуто): entity-level фильтрация
`config/get`/`layout/get`, `virtual_light/toggle`, ACL радаров, content
signing, `assets/resolve`/`assets/list` контракт (кроме использования
`may_write`, что уже было).

Диапазон материала: 3 продуктовых коммита с корректными трейлерами
(`Issue: #626`, `User-Visible: yes` на обоих user-visible коммитах):

```
552504b8 fix: preserve administrator write access
e6987459 fix: respect Home Assistant read-only ACL
25290527 docs: review document for #626 (артефакт ревью ТЗ, не код)
```

`552504b8` — самостоятельно найденный и исправленный автором дефект второго
коммита: в `e6987459` проверка групп шла раньше проверки `is_admin`, из-за
чего администратор без заполненного `user.groups` терял write-доступ.
Финальная версия `auth.py` проверяет `is_admin` до групп — это видно в
материале ревью, поэтому не находка, а зафиксированный факт истории.

Диффу не принадлежит ни один файл `src/**` — карточка (TS/Lit) не меняется,
`config/get.can_write` и без правки читал `may_write()`, так что фронтенд
автоматически наследует новую границу без отдельного изменения (подтверждено
чтением `websocket_api.py:1472`, не тронуто диффом).

## Как проверялось

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit` | не гонял | Validate green на материале покрывает (job «Фронтенд»); диффа по `src/**` нет |
| `npm test` | не гонял | то же; `npm run inventory`-затрагивающих изменений нет |
| `npm run build` + сверка 3 копий бандла | не гонял | Validate green («Фронтенд: … синхрон бандла») |
| `node scripts/check-docs.mjs` | не гонял | входит в job «Предполёт»; diff трогает `docs/**`, job green. Известный сущест­вующий stale screenshot fingerprint — предсуществующий, в `--screenshots=warn`-режиме (обычный push) не блокирует; см. «чего не проверял» |
| `python -m ruff check custom_components/houseplan` | не гонял отдельно | входит в job «Бэкенд», green |
| `python -m mypy` (strict allowlist) | не гонял отдельно | входит в job «Бэкенд», green |
| `python -m pytest tests_backend -q` (реальный HA) | не гонял — в этой среде `homeassistant` не установлен (`ModuleNotFoundError`), harness недоступен, `test_ha_*.py` не собрался бы | job «Бэкенд: pytest в Home Assistant» на материале — green (canonical по AGENTS.md) |
| Мутанты по диффу (6 шардов, включая 3 новых `acl-*`) | не гонял — CI это уже сделал | все 6 шардов «Мутанты по диффу» на материале — green |
| `node scripts/smoke-select.mjs --base d5df838976f6be55d30048510773b6079dce50c1 --head HEAD` | прогнал сам | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются… Тронуто файлов: 13.» — смоки не нужны, визуальный контракт не меняется (подтверждает и ТЗ: «новые скриншоты и golden-baselines не требуются») |
| `golden:verify` | не гонял | нет видимого изменения рендера — не применимо |
| Инварианты геометрии | не гонял | правка не касается геометрии плана |
| Performance-профили | не гонял | в AC не названы |

Дешёвые гейты (typecheck/test/build) и HA-harness backend, а также diff-мутанты
на этом SHA уже подтверждены зелёным Validate (issue #343); я прочитал JSON
списка джобов запуска (`gh run view 36125882168 --json jobs`) и убедился, что
именно нужные джобы («Бэкенд: pytest в Home Assistant», все 6 шардов «Мутанты
по диффу», «Предполёт») зелёные, а не просто что весь run «success» — smoke/
golden/performance ожидаемо `skipped` (это не PR, не release-кандидат, диффа
по `src/**` нет — см. AGENTS.md «Heavy CI gates»).

Помимо CI, я прочитал целиком: `auth.py` (финальная версия), дифф
`websocket_api.py` (guard `plans/list`, `_public_trails`, `ws_trail_get`),
весь дифф трёх тестовых файлов и `scripts/mutation-registry.mjs`, дифф всех
пяти документов.

## AC → доказательство

| AC | Доказано | Чем | Чем краснеет |
|---|---|---|---|
| AC1 (`may_write` матрица + fail-closed) | тестом | `test_may_write_honours_explicit_admin_only_false` (`auth.py:17-55`): admin/household/read_only/mixed/`groups=[]`/нет атрибута `groups`/группа без `id` — 7 веток | мутант `acl-readonly-group-becomes-writer` (заменяет финальный `return` на `True`) — CI job «Мутанты по диффу» green, т.е. свидетель поймал мутанта |
| AC2 (6 команд × роли, `can_write`==`may_write`) | тестом | `test_issue_626_authenticated_read_acl_matrix_and_trail_projection`: admin/household/read_only × `config/get.can_write`, `layout/get`, `trail/get`, `plans/list`, `assets/list`; `virtual_light/toggle` не различает роли по контракту — не входит в матрицу теста намеренно (роли не различают результат), регресс подтверждён отдельно (AC7) | не требуется — не защитный AC для различающих ролей за пределами уже перечисленных |
| AC3 (`plans/list` unauthorized, без сканирования) | тестом | `test_issue_626_plans_list_refuses_viewer_before_scanning`: `monkeypatch` на `hass.async_add_executor_job` — исполнитель обязан не вызваться для read-only; guard стоит до `_runtime()`/чтения каталога (`websocket_api.py:1059-1061`, до строки 1062 `_runtime(...)`) | мутант `acl-plan-catalog-open-to-viewers` (убирает guard) — пойман, CI green |
| AC4 (`trail/get` без `source`, storage не мутируется) | тестом | тот же тест: вложенный `route.source` удалён, `route.id` сохранён, `recorder.book.data == stored_trails` после запроса (проверка отсутствия мутации через `copy.deepcopy` до и сравнение после) | мутант `acl-trail-view-exposes-source-entity` (инвертирует фильтр `key != "source"`) — пойман, CI green |
| AC5 (WS `config/set` и HTTP upload отклоняют read-only при `admin_only=false`, пропускают household) | тестом (частично, см. находку) | WS: `test_issue_626_authenticated_read_acl_matrix_and_trail_projection` (household пишет rev 0→1, read_only получает `unauthorized` на rev 1). HTTP: `test_issue_626_plan_upload_refuses_read_only_but_allows_household` | нет отдельного мутанта на `http_api.py`, т.к. сам `http_api.py` диффом не тронут — гейт полагается на существующий вызов `may_write()` (`http_api.py:460`) и на unit-покрытие `may_write` |
| AC6 (документация непротиворечива) | чтением | `USER-GUIDE.ru.md`/`USER-GUIDE.md` §20 новая таблица ролей, `ARCHITECTURE.md` абзац + правка строки `trail/get`/`plans/list` в таблице команд, `SCOPE.md` абзац — формулировки согласуются друг с другом и с контрактом ТЗ построчно | `node scripts/check-docs.mjs` — покрыт зелёным job «Предполёт» на материале |
| AC7 (регресс: `virtual_light/toggle`, `layout/get`, `assets/list`) | тестом (существующим, не тронутым диффом) | `test_read_only_authenticated_user_can_toggle` (`test_ha_virtual_lights.py:98-110`, не изменён) подтверждает toggle остаётся доступен read-only; `layout/get`/`assets/list` проверены внутри нового ACL-матрица теста (AC2) | покрывается тем же прогоном backend job — весь набор green, значит регресса нет |

## Находки

### Medium (в скоупе задачи, чинится в ней же)

**Потеряна прямая регрессионная проверка HTTP-загрузки при `admin_only=true`
(значение по умолчанию) для обычного non-admin.**

- Файл: `tests_backend/test_ha_upload.py:301-316`
- Было: `test_issue_617_plan_upload_refuses_non_admin` — вызывала
  `_setup(hass)` (без опций ⇒ `admin_only=true` по умолчанию) и
  `hass_read_only_access_token` как представитель «любой non-admin»,
  проверяла реальный HTTP round-trip `POST /api/houseplan/plans/upload` →
  403 `unauthorized`.
- Стало: тест переименован в
  `test_issue_626_plan_upload_refuses_read_only_but_allows_household` и его
  `_setup` сменился на `options={CONF_ADMIN_ONLY: False}` — весь тест теперь
  проверяет только ветку `admin_only=false`. План автотестов в самом ТЗ
  (issue #626, «План автотестов» п.4) допускал оба варианта: «добавить HTTP
  upload regression… **либо расширить существующий тест общей
  writer-policy**» — расширить, не заменить. Просмотрел весь файл
  `tests_backend/test_ha_upload.py` (список тестов приведён ниже) — других
  проверок «`admin_only=true` (по умолчанию) + non-admin + HTTP upload»
  не осталось.
- Почему это находка, а не педантизм: `http_api.py` этим диффом не
  тронут (guard `if not may_write(...)` на `http_api.py:460` — код 2026-07-27,
  предшествует #626), но именно поэтому для него нет специального
  мутанта в `scripts/mutation-registry.mjs` (проверил — ни одна запись не
  целится в guard плана-аплоада) и не было раньше. Единственной сеткой,
  которая ловила регресс конкретно на HTTP-пути при `admin_only=true`, был
  сам этот тест — а он теперь проверяет другую ветку. Останься logика
  `may_write()` при `admin_only=true` в порядке (она и в порядке — см. AC1),
  а вот случайный будущий разрыв именно HTTP-проводки (например, в
  `http_api.py:460` кто-то уберёт `if`, оставив только ветку `admin_only`
  внутри другого места) для default-конфигурации никто не покраснеет: юнит-тесты
  `may_write` не ходят через `http_api.py`, а единственный HTTP-round-trip
  тест для не-писателя теперь заточен под `admin_only=false`.
- Чем чинится: вернуть в `test_ha_upload.py` вторую проверку — non-admin
  (обычная группа или read-only, не важно какая при `admin_only=true` —
  обе сейчас writer=false) получает 403 при настройках по умолчанию, ИЛИ
  добавить отдельный маленький тест на этот случай.
- Область: строго внутри изменённого этим диффом файла — правка входит в
  тот же issue, отдельный issue не заводится.

Других High/Medium не найдено.

### Low (снято ревьюером без возврата автору)

- `custom_components/houseplan/auth.py:35-37` — комментарий «HA normally
  exposes admin groups too…» немного избыточен рядом с однозначным кодом
  (`if is_admin: return True`), но не вводит в заблуждение и не противоречит
  докстрингу модуля. Не влияет ни на один AC — оставляю как есть.

## Что проверено и корректно

- `may_write()` (`auth.py:17-55`): порядок проверок `admin_only` →
  `is_admin` → группы; fail-closed на `entry is None`, на `groups` не-список/
  пустой список, на элемент группы без строкового `id`. Смешанный набор
  групп (`GROUP_ID_USER` + `GROUP_ID_READ_ONLY`) корректно трактуется как
  read-only — соответствует продуктовому решению 1 из issue.
- `ws_plans_list` (`websocket_api.py:1052-1062`): guard стоит первой строкой
  функции, до любого обращения к `_runtime`/файловой системе — доказано
  мутацией и monkeypatch-тестом, а не только чтением.
- `_public_trails`/`ws_trail_get` (`websocket_api.py:2392-2416`): чистая
  рекурсивная проекция, возвращает новую структуру, не мутирует
  `rec.book.data` — подтверждено сравнением `recorder.book.data ==
  stored_trails` после запроса в тесте, а не только «выглядит immutable».
- `config/get.can_write` (`websocket_api.py:1472`) не изменён диффом и уже
  вызывал `may_write()` — значит новая граница автоматически видна в UI без
  отдельной правки фронтенда; UI не имеет собственной копии решения.
- Тест `test_decor_asset_resolve_non_admin_is_writer_when_admin_only_is_off`
  (`test_ha_websocket.py:3087+`) — до диффа использовал
  `hass_read_only_access_token` как «типичный non-admin writer», что было
  корректно только при старом (ошибочном) поведении. Автор поменял его на
  `_access_token_for_group(hass, GROUP_ID_USER)` — необходимое следствие
  исправления, не потеря покрытия: при старой семантике тест проверял то же
  самое (не write-only-для-read-only), просто использовал read-only как
  suррогат обычного пользователя; теперь суррогат заменён на настоящего.
- Документация: таблица ролей в `USER-GUIDE.ru.md`/`USER-GUIDE.md` §20,
  абзац в `ARCHITECTURE.md` (Integration WS API) и абзац в `SCOPE.md`
  говорят одно и то же тремя разными словами без противоречий; строка
  `plans/list`/`trail/get` в таблице команд `ARCHITECTURE.md` обновлена
  синхронно с кодом.
- Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в тех
  же user-visible коммитах, что и код (в `552504b8` уточнена одна и та же
  запись, а не заведена вторая — нет дублирующегося числа/факта с разными
  источниками).
- Не-скоуп соблюдён: `virtual_light/toggle`, `assets/list`-контракт,
  entity-level фильтрация `config/get`/`layout/get`, ACL радаров — ни один
  файл вне заявленных «Затрагиваемые файлы и модули» не тронут (проверено
  по `git diff --stat` целиком).
- SHA `01e51817b615295c3546329cf8434deeef83f02a`, названный автором в
  промежуточном комментарии «готово к ревью», в материале не резолвится
  (`git cat-file -t` — «could not get object info»). Это не находка: автор
  сам обнаружил и исправил дефект после этого коммита следующим пушем,
  итоговый SHA материала (`552504b8`) — тот самый, что зафиксирован в шапке
  задачи ревью, и именно он проверен Validate. Норма по REVIEWER.md
  («SHA не резолвится — не находка, если не мёртв уже на момент публикации
  отчёта»): здесь отчёта на том SHA не публиковалось.

## Чего не проверял

- Не выполнял `tsc`/`npm test`/`npm run build`/`mypy`/`ruff`/
  `pytest tests_backend` вручную — только чтением и по зелёному Validate на
  точном SHA материала (job-level, не «весь run green» одной галочкой).
- Не устанавливал `homeassistant` в этой среде — physически невозможно
  верифицировать 115/4 «passed», заявленные автором локально в WSL,
  независимо от CI; полагаюсь на canonical Linux CI backend job (по
  AGENTS.md «HA-харнесс канонически подтверждает Linux CI»), который зелёный
  на этом самом SHA.
- Не прогонял browser-smokes и golden — `smoke-select.mjs` сам подтвердил,
  что для этого диффа (`src/**` не тронут) выбирать нечего; данные пусты, а
  не проигнорированы.
- Не проверял поведение при реальном Home Assistant инстансе с настоящей
  группой `system-read-only` за пределами того, что покрывает backend-job
  CI (в частности — поведение при будущих версиях HA, где может измениться
  состав `GROUP_ID_READ_ONLY`); это риск, который ТЗ явно принимает
  («используется стабильный ID системной группы read-only»).
- Не проверял производительность — в AC не заявлена, диффа по горячим путям
  рендера нет.
- Строгий (`--screenshots=strict`) режим `check-docs.mjs` не гонял — по
  AGENTS.md это гейт релиз-кандидата, а не обычного push/ревью; автор в
  комментарии честно указал единственный pre-existing stale fingerprint,
  не относящийся к этому диффу.

## Вердикт

Один Medium в скоупе задачи (потеря регрессионного HTTP-теста для
`admin_only=true` non-admin, деталь выше) без единого High. Все семь AC
подтверждены — четыре защитных (AC1, AC3, AC4, AC5) имеют мутационное
подтверждение «чем краснеет» для WS-пути; для HTTP-пути AC5 не имеет
собственного мутанта именно из-за находки выше. Изменение решает заявленный
сценарий и не ухудшает ни один из уже закрытых core user jobs (`docs/SCOPE.md`
J2/J6: read-only остаётся полноценным зрителем, администратор не теряет
доступ). Возвращаю автору на исправление находки; повторный цикл — по
дельте.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/626-acl-policy`, коммит `552504b834c7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a24a3a11afe04ca54d4e52ed670a3ee038d0a785`
  ```
  git log --all --format='%H %T' | grep a24a3a11afe0
  ```
- Тело issue: `83f287ba63d6a04d1ffa6f1205382587c2342cbc04bfaebcde04219d841fa564`
- Вердикт конвейера: `yellow` · High 0
