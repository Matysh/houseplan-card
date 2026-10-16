# CODE-REVIEW-896-r1

Этап: code · заход r1 · блокирующих циклов 0/4 · Трек: ask
Материал: `5dd1144b1d83d999162b7b6ae135ff225c4d69d8` (origin/dev..HEAD, 5 коммитов:
`e69eab4e` → `1b426d62` → `29066416` → `cc07cb3e` → `5dd1144b`), база `dev 45b348f4`.
ТЗ: тело issue #896, принятая версия r2 (зелёный SPEC-REVIEW-896-r2, M1 закрыт).

## Скоуп

Чистая инфраструктура классов B/C: честная wire-фикстура демо-сервера
(`demo/srv/fixture-state.js`), service-recorder, переживающий подмену `hass`
при переключении состояния, scoped-стабильность статического capture поверх
shadow DOM без вмешательства в managed DOM Lit, полный паспорт capture identity
(включая `browser-args.mjs` и его локальные зависимости), устранение
несуществующего расхождения CLI/теста в бюджете трёх ленивых графов и
диагностический (не product-fix) таймлайн LED transitionend. Плюс адаптация
~14 существующих смоков к новой, более честной фикстуре (без ослабления их
оракулов) и два найденных вне-скоуп продуктовых дефекта (#867 Zigbee resize,
#890 config-authority race), корректно вынесенных из этого issue.

`src/**`, Python-бэкенд, продуктовые таймстемпы/потолки/baseline-PNG в диффе
нет — `git diff --stat origin/dev...HEAD` подтверждает. User-Visible: no на
всех пяти коммитах, оба changelog не тронуты — корректно. Ledger
`docs/release-ledger/v1.80.1/896.json` = `infra`, обоснование соответствует
диффу; инфраструктура в пользовательский milestone не входит — согласуется с
правилом (#838).

## Как проверялось

Материал читался напрямую (без доверия авторским пересказам):

- `git diff origin/dev...HEAD` целиком, файл за файлом — `demo/srv/{demo.html,fixture-state.js}`,
  `demo/golden/{harness,static-stability,run}.mjs`, `demo/docs/capture.mjs`,
  `scripts/{source-fingerprint,docs-accept,check-docs}.mjs`,
  `test/{demo-fixture,source-fingerprint,bundle-assets}.test.mjs`,
  `demo/transition-timeline.mjs`, `demo/smoke_led_strip_glow.mjs`,
  изменённые consumer-смоки (`smoke_bg_color`, `smoke_space_card`,
  `smoke_static_icon`, `smoke_sign_cap`, `smoke_view_recovery` и др.), доки.
- Сверка контракта фикстуры с реальным бэкендом: `custom_components/houseplan/websocket_api.py`
  (`ws_layout_update`, `expected_rev` на `config/set`/`layout/set`, отсутствие
  `expected_rev` у `layout/update`) — фикстура воспроизводит именно это, не
  придуманный контракт.
- Сверка единственного источника `LAZY_GRAPH_CEILING_BAND` (`scripts/bundle-budget.mjs:744`,
  импортируется тестом, не задублирован).
- Все пять коммитов — трейлеры `Issue:`/`User-Visible:` прочитаны `git log -1 --format=%B` на
  каждом.
- Подтверждён зелёный Validate именно на этом SHA: `gh run view 38654502257` →
  `headSha=5dd1144b…`, `conclusion=success`.
- Полный текст тела issue и всех комментариев (включая SPEC-REVIEW r1/r2 и три
  хэндоффа автора) — делта между r1/r2 спек-ревью и финальным кодом сверена:
  AC5 в финальном коде реализован ровно так, как закрыт в SPEC-REVIEW-896-r2
  (удаление строки `test/bundle-assets.test.mjs:1281`, новый параметризованный
  тест на границе `ceiling+band-500/ceiling+band/+1`).

Гейты сам не прогонял — обоснование ниже.

## Проверено и корректно (AC1–AC6)

| AC | Как доказано (прочитано) | Негативный пробник подтверждён чтением |
|---|---|---|
| AC1 (`createServiceRecorder`) | `demo/srv/demo.html`: `callService` обёрнут один раз в `serviceRecorder`, переживает `card.hass={...card.hass,states:STATES}` (не пересоздаёт объект `hass` целиком, как раньше). `smoke_fixture_contract.mjs` — три реальных клика, `expected` сверяется поэлементно. | `test/demo-fixture.test.mjs:49-56` явно воспроизводит старый баг (метод пересоздаётся каждый вызов) и показывает, что `assert.deepEqual(counted, expected)` падает — тест умеет ловить регресс. |
| AC2 (`createFixtureStore`) | `fixture-state.js` клонирует вход/выход (`structuredClone`), `cas()` требует `expected_rev === rev` на `config/set`/`layout/set`, `layout/update`/`delete` — без CAS, точно как бэкенд (`websocket_api.py:816-882`, там нет `expected_rev` в схеме `layout/update`). No-op запись не инкрементирует ревизию (`equal()` проверка) — соответствует серверному `if layout.get(device_id)==msg.pos: return same rev` (websocket_api.py:869-871). | `test/demo-fixture.test.mjs:16-18` — три варианта `expected_rev` (`undefined`, старый, будущий) все дают `conflict`, документ не меняется (`before`/`after` сверка байт-в-байт); `smoke_fixture_contract.mjs:58-66` — конфликт и injected transport refusal оставляют пару byte-identical. |
| AC3 (static-stability) | `static-stability.mjs` — стиль вносится только через `adoptedStyleSheets` на уже существующий/вновь открытый `ShadowRoot`, никогда не как DOM-узел в `renderBefore`/managed-часть Lit; `reset()` снимает патч `attachShadow`, убирает только свой sheet, восстанавливает media-режимы (`resetGoldenStability` возвращает `prior` из `emulateMedia`). Коммиты `cc07cb3e`/`29066416` — целевые фиксы именно этой проблемы (Lit `_$AR`/`nextSibling` null), воспроизведённой и закрытой в одном диффе. | `smoke_capture_stability.mjs:20` — head-only негативный контроль НЕ пересекает shadow DOM (ожидаемо из-за инкапсуляции, доказывает что обычный старый подход не работал бы); `:73` — no-reset негативное наблюдение отличается от обычных media; `:85-100` — воспроизведённый регрессионный сценарий (`overlap→cover-source`) с проверкой отсутствия capture-owned DOM-якоря. |
| AC4 (capture identity) | `source-fingerprint.mjs`: `browserArgumentCorpus` обходит реальные локальные импорты `browser-args.mjs`; `captureScriptFingerprint` хэширует этот корпус + `capture.mjs`. `docs-accept.mjs`/`check-docs.mjs` используют ту же функцию (один источник числа). | `test/source-fingerprint.test.mjs` — новый тест: смена байта в зависимом `flags.mjs` меняет identity и инвалидирует кандидат (`verifyDocsCandidate` бросает на несовпадении), LF/CRLF канонизируется, пост-capture policy исключена явно. |
| AC5 (lazy-graph band) | M1 из SPEC-REVIEW-896-r1 закрыт точным адресом: удалена именно строка `assert.ok(ceiling+band-bytes>500)` (была в `test/bundle-assets.test.mjs:1281` на момент r1), основной `lazyGraphCeilingViolation`/`assertBundleBudget` не трогали. | Новый тест `test/bundle-assets.test.mjs` (после удалённой строки) параметризованно проверяет три графа на `offset ∈ {-500, 0, 1}`: на `+1` оба предиката (`shippedGraphJudge`, `cliJudge`) бросают `/больше полосы/`; на границе `ceiling+band` оба PASS. Арифметика (`259060`/`257060`/`2000`) из комментария SPEC-REVIEW-896-r2 — пересчитана чтением кода, совпадает. |
| AC6 (LED-диагностика) | `transition-timeline.mjs` — чистая функция без таймеров/ретраев, различает причины (`missing-transitionrun`, `listener-attached-late`, `missing-transitionend`, `delivered-after-deadline`, `unexpected-native-duration`). Явно заявлено как диагностика, не product-fix; причина исторического отказа оставлена `unknown` — корректно по ТЗ («одно наблюдение не объявляет regression/флак решённым»). | `test/demo-fixture.test.mjs:64-78` — все пять причин отказа покрыты отдельными сборками событий; `:75-77` явно проверяет, что более позднее успешное наблюдение не переписывает уже провалившийся первый приём (`first.passed===false` сохраняется). |

Трейлеры (`Issue: #896`, `User-Visible: no`) — на всех пяти коммитах,
корректны. `User-Visible: no` → изменений в `docs/CHANGELOG*.md` нет, что и
требуется. Ledger-файл присутствует и обоснован.

Контракт между фикстурой и реальным бэкендом сверен построчно по
`websocket_api.py` — расхождений не найдено.

Единственное число, которое теоретически могло бы иметь два источника
(`LAZY_GRAPH_CEILING_BAND=2000`), имеет один источник
(`scripts/bundle-budget.mjs:744`), импортируемый и CLI, и тестом — находка
§8 не возникает.

Адаптация ~14 существующих смоков к более честной фикстуре (например,
`smoke_bg_color.mjs`, `smoke_space_card.mjs`, `smoke_static_icon.mjs`)
прочитана выборочно: замена приватного `_snap`/alias-инъекции на реальный GET
через собственное `callWS`/`setServerConfig` не ослабляет ни один
существующий оракул, только меняет способ доставки конфигурации карточке.
`smoke_sign_cap.mjs`/`smoke_view_recovery.mjs` (foreign-HA consumers) —
проверено, что добавленные проверки (`pendingAuthorityRetired`,
`replacementAcceptedExactConfig` и т.п.) — это ужесточение, а не ослабление:
старые ассерты (`fullRejectsReplacedConnection` и т.д.) сохранены без
изменений рядом с новыми.

Два найденных попутных продуктовых дефекта (Zigbee resize/viewBox — F009,
переданный в #867; config-authority race — переданный автору #890) корректно
не замаскированы патчем в этом B/C-issue и не создают новых issue в
нарушение запрета пользователя — следы переданы координатору текстом
хэндоффа, это соответствует политике (сам ревьюер новых issue тоже не
заводит, так как находок вне скоупа не обнаружено).

## Чего не проверял

- **Не перегонял `npx tsc --noEmit`, `npm test`, `npm run build` +
  `bundle-policy --verify`.** Validate на точном SHA `5dd1144b` зелёный
  (подтверждено `gh run view 38654502257` → `headSha` совпадает,
  `conclusion=success`) — по правилу «дешёвые гейты уже подтверждены» (#343)
  повторный прогон не требовался.
- **Не гонял golden:verify/смоки сам.** Метка `ci:golden` на issue не стоит —
  конвейер не счёл риск кадра production-рендера применимым (ожидаемо:
  `static-stability.mjs` работает только внутри capture lifecycle и
  восстанавливается в `finally`, `src/**` не меняется). Автор в хэндоффе
  заявил локальный `npm run golden:verify` 205/205 PASS и восемь именованных
  native-смоков PASS с конкретными числами — это заявление не является
  заменой гейта по правилам, но для данного диффа (демо/тест-инфраструктура,
  без продуктового рендера) я прочитал сам код стабилизации и смок
  `smoke_capture_stability.mjs` целиком и нахожу логику корректной и
  тестируемой без необходимости переисполнения тяжёлого набора.
- **Не выполнял `pytest tests_backend`** — Python-бэкенд не менялся (diff
  stat подтверждает отсутствие `custom_components/**` в патче), гейт не
  применим.
- **Не гонял `npm run invariants`** — геометрия/ссылки на неё не менялись.
- **Не проверял свежесть скриншотов/screenshot-доков** — не гейт задачи
  (#697), боту на `dev` обновлять.
- **LED-таймлайн (`artifacts/led-transition-896/...`) не воспроизводил
  исполнением** — это diagnostic-only артефакт вне репозитория
  (`.gitignore: artifacts/`), заявленная автором причина отказа прямо
  названа `unknown`, регрессии не заявлено — оснований перепроверять нет.

## Находки

Нет. High: 0, Medium: 0.

## Вердикт

Зелёный. AC1–AC6 подтверждены чтением кода и исполнимыми тестами с явными
негативными пробниками (включая демонстрацию падения на старом/дефектном
поведении); контракт фикстуры сверен с реальным бэкендом построчно;
трейлеры, ledger и скоуп корректны; дешёвые гейты подтверждены Validate на
точном материале.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/896-fixture-capture-qa`, коммит `5dd1144b1d83` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7af0e6c0a313df62fae88794992496adb4676fe8`
  ```
  git log --all --format='%H %T' | grep 7af0e6c0a313
  ```
- Тело issue: `aef54f71daf7a6f5220e75953253f7dd1762a49f773ba129774a9c284e2c580f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzksIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Mzc5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Miwib3V0cHV0X3Rva2VucyI6MjE2NjQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTI2NTY3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzE5MDA2NiwiY29zdFVzZEVzdGltYXRlIjoxLjM2MTA0NTIwMDAwMDAwMDJ9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjoyNzg3NzMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjM2NTQyNDIwMDAwMDAwMDMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4341 output_tokens=21684 cache_creation_input_tokens=126567 cache_read_input_tokens=3190066 num_turns=40 -->
