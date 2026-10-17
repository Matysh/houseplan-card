# CODE-REVIEW-941-r1

Материал: `c9b5e9b4d98563defd08f6837be63dc1df5439a9` (рабочая копия на этом SHA,
совпадает с `git rev-parse HEAD`). Диапазон: `origin/dev..HEAD` — два коммита
(`7c2df739a2…` fix, `c9b5e9b4d9…` docs(ledger)). Трек: show, заход r1,
блокирующих циклов израсходовано 0 из 2.

## Скоуп

Issue #941 — узкая правка согласованного в #937 контракта «ссылка на подложку,
не доступ к файлу»: `safeImageReference` ранее отбрасывал только userinfo и
query/hash, совпавшие с denylist `token|password|secret|auth|api[_-]?key`, и
пропускал подписанные URL (`sig`, `X-Amz-Credential`, `X-Amz-Signature`, Azure
SAS и т. п.). Это обслуживает J4 (docs/SCOPE.md) — безопасный перенос плана в
рамках уже одобренного в #937 узкого исключения на внешний конвертер Easy
Floorplan; renderer, HA, импорт карточки и разрешения не затронуты. Скоуп
задачи сам это ограничивает, и диф ему соответствует: единственный
продуктовый файл — `scripts/sh3d-convert/easy-style.mjs`, плюс пересборка
`dist/index.html`, тесты и документация (RU/EN user-guide, ARCHITECTURE,
DEVELOPMENT, STATUS, README, release-ledger).

**Маршрут §5**: complexity (узкая замена denylist на allowlist, риск низкий) —
проходит; surfaces (один модуль `easy-style.mjs`, одна функция) — проходит;
migration (новых config-полей/совместимости нет) — проходит; ux-contract
(поведение «пропустить с `image_reference_skipped`» уже зафиксировано в #937,
меняется только набор пропускаемых ссылок) — проходит; perf-touch (нет) —
проходит; undocumented — поведение описано в этом же коммите в
`docs/USER-GUIDE.md`/`.ru.md`, `docs/ARCHITECTURE.md` и
`scripts/sh3d-convert/README.md` — проходит. Все критерии §5 выполнены →
`route: fix`.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA (ссылка в задаче
ревью) — `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy
--verify` не перегонял. Дополнительно для диффа и AC сам прогнал:

| Гейт | Команда | Результат |
|---|---|---|
| Фокусные unit-тесты диффа | `node --test test/easy-floorplan-style.test.mjs test/easy-floorplan-convert.test.mjs` | 15/15 PASS |
| Offline-страница соответствует источникам (AC3) | `node scripts/sh3d-convert/build-page.mjs --check` | `ok: offline converter matches its sources and canonical runtime` |
| Браузерный смок, названный в AC3 | `node demo/smoke_plan_converter.mjs` | PASS, включая гонки чтения, stale click, RU/EN, 360px, offline (атрибутация пина Playwright/Chromium в выводе) |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)» — карточные browser-smoke не выбираются, выбирать нечего |
| Тесты release-ledger/changelog, затронутые диффом | `node --test test/release-ledger.test.mjs test/release-contract.test.mjs test/user-stable-changelog.test.mjs` | 37/37 PASS |

Чтением проверены: сам diff `easy-style.mjs` (allowlist query-параметров,
замена denylist), `easy-content.mjs` (единственный вызывающий, `plan_url`
остаётся ссылкой, не читается как локальный путь), README/ARCHITECTURE/
USER-GUIDE диффы на соответствие формулировок реализации, release-ledger JSON
(`category: line-fix`, `introducedBy: 937`, `baseStable: v1.81.0`) —
сопоставлено с `docs/release-ledger/v1.81.0/937.json` (там `category: major`,
не выпущен в прошлый stable, значит #941 — внутрибетная правка без
пользовательского milestone, корректно). Трейлеры обоих коммитов проверены:
`Issue: #941` на обоих, `User-Visible: yes` на fix-коммите — оба changelog
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правятся в том же коммите
`7c2df739a2…`; `User-Visible: no` на doc-only ledger-коммите корректен.

Комментарии issue (GitHub, актуальный снимок): цепочка автора без споров —
claim → done → механический отказ (в ledger не хватало `introducedBy`,
форматный PASS не был вердиктом) → исправленный done на материале `c9b5e9b4d9…`.
Разногласий с ревьюером нет, владелец и автор — одно лицо.

## Разбор по AC

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (sig/signature/X-Amz-\*/Azure SAS/session/ticket/неизвестные/re-encoded/hash не переносятся, экспорт их не содержит и сообщает о пропуске) | `test/easy-floorplan-style.test.mjs` «#941 only bounded image selectors survive…» (14 отрицательных случаев) + `test/easy-floorplan-convert.test.mjs` «#941 signed image credentials never appear…» (сквозной экспорт, оба `sig=` и `X-Amz-*`, проверка `JSON.stringify(result).includes('synthetic-private') === false` и `notes` содержит `image_reference_skipped`) | Обычный отрицательный случай на неизменённой реализации, прогнан: `ok 13` в прогоне выше (PASS с текущим кодом — каждое значение из списка реально отбрасывается allowlist’ом, т. е. отсутствие соответствующего ключа в `IMAGE_QUERY` либо непустой `url.hash`). Негативные значения выбраны по формулировке AC1 построчно (sig, signature, X-Amz-\*, Azure SAS sv/sp, session, ticket, unknown, re-encoded `%2569g`, hash) — это и есть свидетель, не мутант |
| AC2 (простой HTTP(S)/`/local/` и литеральные version/size/format проходят; userinfo, traversal, опасные схемы, прежние token-кейсы по-прежнему отказывают) | Тот же тест (3 положительных URL с `v/w/h/format`, `version/width/height`, `q/dpr/fit`) + унаследованный `#937 image references preserve safe URLs…` (userinfo, `//`, `file:`, `javascript:`, `data:`, `/local/../`, `access_token=`, `#token=`) | Положительная ветка подтверждена PASS на неизменённой реализации; отрицательная (userinfo/traversal/схемы/прежние token-кейсы) не менялась с #937 и не являлась предметом этого диффа — её «чем краснеет» уже установлен в `CODE-REVIEW-937-r1` (зелёный), в этом раунде перепроверена исполнением (PASS), не переоткрывается |
| AC3 (offline-страница соответствует исходникам, SH3D/Easy, гонки чтения и скачивание без сети) | `build-page.mjs --check` (ok) + `demo/smoke_plan_converter.mjs` (PASS, см. таблицу гейтов) | Не защитный AC (сценарий, не гард) — доказательство исполнением, не «чем краснеет» |

## Находки

Находок нет: High — 0, Medium — 0, Low — 0.

Побочных находок при чтении кода/документации не возникло. Доверенный снимок
политики: `mode=issues` (issue #941, этап code, заход r1) — новых issue не
заводилось, заводить было нечего.

## Что проверено и корректно

- Замена denylist на allowlist (`IMAGE_QUERY`) закрывает именно пробел из
  репродукции issue: `sig`, `X-Amz-Credential`/`X-Amz-Signature` больше не
  проходят, потому что это не разрешённые имена параметров, а не потому что
  распознаны как «похожие на секрет» — что соответствует формулировке «вместо
  бесконечного denylist… допускаем только явно безопасные параметризованные
  варианты».
- `url.hash` теперь отбрасывается безусловно (было — только по denylist) —
  соответствует AC1 «произвольный hash».
- Повторяющийся ключ (`?w=640&w=320`) отбрасывает всю ссылку (`seen`-множество)
  — защита от попытки протащить второе значение мимо первой успешной проверки.
- Единственный вызывающий (`easy-content.mjs:72`) использует результат только
  как `plan_url`-ссылку, не как путь для чтения файла этим скриптом — риска
  path traversal через допущенные `v/version` (буквы/цифры/`.`/`-`) нет.
- `dist/index.html` пересобран и соответствует источникам (`--check`), диф —
  ровно одна изменённая строка бандла.
- Трейлеры, оба changelog в одном коммите, release-ledger (`line-fix`,
  `introducedBy: 937`, без пользовательского summary — корректно для
  внутрибетной правки) — всё на месте.
- Документация (USER-GUIDE RU/EN, ARCHITECTURE, DEVELOPMENT, README) описывает
  именно реализованный allowlist (конкретные имена и границы), а не
  приблизительно.

## Чего не проверял

- Не перегонял полный `npx tsc --noEmit` / `npm run build` + сверку трёх копий
  бандла / полный `npm test` — приняты по зелёному Validate на этом SHA
  (ссылка в задаче ревью); материал/окружение не менялись с этого прогона.
- Не прогонял `pytest tests_backend` — диф не касается Python.
- Не прогонял `npm run invariants` — диф не касается геометрии/ссылок на неё.
- Не прогонял performance — в AC не назван.
- Не перегонял полный `npm run gate:small` — фокусные тесты диффа и смежные
  (ledger/changelog/style/convert) прогнаны адресно; сами они входят в
  `gate:small`, и автор уже отчитался о зелёном `gate:small` на точном HEAD
  в комментарии issue.
- Не проверял ручным образом живую выкладку на `/var/www/houseplan/convert/` —
  по #937/#941 выкладка явно отложена до приёмки и S8, в этом диффе её нет.
- Мутанты не исполнялись и не запрашивались — все «чем краснеет» в таблице
  AC закрыты обычными отрицательными случаями на неизменённой реализации.

## Вердикт

Зелёный. Все AC доказаны (AC1/AC2 — таблицей «чем краснеет», AC3 —
исполнением), High/Medium не найдено, трейлеры и changelog в порядке,
release-ledger корректен, маршрут §5 — `fix`. Бюджет циклов не тратится
(зелёный цикла не образует).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/941-converter-private-urls`, коммит `c9b5e9b4d985` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b878dba4f12c22cb08696fe16bb11818a6bd3078`
  ```
  git log --all --format='%H %T' | grep b878dba4f12c
  ```
- Тело issue: `01393b51f0a6e7d5f91957dfb69a8110fee165fca605a824845ef24606c4d1f0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDcsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTkyMDAwMDAwMDAwMDAwNH0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjQsIm91dHB1dF90b2tlbnMiOjIxMTgyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwOTI5MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIzMDU2MTcsImNvc3RVc2RFc3RpbWF0ZSI6MS4wNjkyMDY0fV0sInR1cm5zIjozOSwiZHVyYXRpb25NcyI6MjY4Nzk3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wNzQzOTgzOTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5171 output_tokens=21199 cache_creation_input_tokens=109290 cache_read_input_tokens=2305617 num_turns=39 -->
