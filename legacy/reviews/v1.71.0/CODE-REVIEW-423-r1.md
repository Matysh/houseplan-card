# CODE-REVIEW-423-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/423
- Этап: код-ревью (PROCESS.md §2.7), заход **r1**, блокирующих циклов израсходовано 0 из 4
- Материал: ветка `issue/423-v170-polish`, HEAD на момент вывода `3576cc2ea7e5f85b4e8d91a45be4d85b7158528b`
- ТЗ: `docs/specs/423-v170-polish.md` (SPEC-REVIEW-423-r1, зелёный)
- Диапазон: `git diff origin/dev...HEAD` (54 файла, включая генерированные `dist/**` и `custom_components/houseplan/frontend/**`)

## Скоуп

Шесть подтверждённых аудитом v1.70.0 дефектов support pipeline:

1. Repair families по `translation_key` вместо `broken_plan_*`.
2. Filename из SHA-256-префикса вместо capability-token.
3. Двухфазная quota-проверка (до store/executor и после `await`).
4. `support_api: 1` вместо строгого равенства версий релиза.
5. Lazy support-словари вне initial View graph.
6. `backdrop_decode` benchmark под общий browser-error guard.

Пункт (е) issue (комментарий `docs-screenshots.yml`) явно исключён — принадлежит #422, файл в диффе не тронут (подтверждено: `git diff` по этому workflow пуст).

## Как проверялось

### Гейты

| Гейт | Статус | Как подтверждён |
|---|---|---|
| `npx tsc --noEmit` / `npm run typecheck` | зелёный | не перегонял: Validate `3576cc2e` → success, job «Фронтенд: типы, юниты, мутанты, синхрон бандла» выполнился заново (не reuse) и прошёл — https://github.com/Matysh/houseplan-card/actions/runs/33668037515 |
| `npm test` | зелёный | тот же job на том же прогоне; численно 1749/1749 (1 skip) заявлено автором, не расходится с зелёным job |
| `npm run build` + `bundle:sync` (сверка копий) | зелёный | тот же job (`синхрон бандла` — часть его имени и шагов) |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | зелёный | перепрогнал сам: «Новых any нет» |
| `npm run bundle:budget` | зелёный | перепроверил вручную числа из `dist/houseplan-assets.json`: `initialViewGzipBytes=289137` < baseline 291046 и < budget 300000; `lazyEditorGzipBytes=154772`; `assertSupportBundleOwnership` подключён в `scripts/bundle-budget.mjs` и вызывается из main-блока, вызываемого `npm run bundle:budget`, который стоит в `validate.yml:460` и `publish-prerelease.yml:86` |
| `node scripts/check-docs.mjs` / job `docs` | зелёный | Validate `3576cc2e`, job «Предполётные проверки: документация, провенанс, процесс» → success (на предыдущем SHA `2038ab91` падал именно на `DOCS: failure`; коммит `3576cc2e` принял 2 скриншота и починил) |
| `python -m pytest tests_backend -q` (Linux HA) | зелёный | не перегонял локально (нет `homeassistant` в этом окружении — тихий скип, доказательством не считается). Проверил по CI: job «Бэкенд: pytest в Home Assistant» на прогоне для `4a7de337` (test: harden support preflight verification) реально выполнился и завершился `success` в 18:32:22 — до дальнейших изменений backend-путей не было, поэтому для `3576cc2e` job корректно **reuse**-нут (ключ `gate-reuse.mjs` включает src/**+demo/golden/**+package-lock и т.д., но backend-ключ отдельный и завязан на измененные backend-пути; после `4a7de337` backend-файлы не менялись) |
| `npm run golden:verify` | зелёный, не по диффу | Validate `3576cc2e` показывает job `golden` как **skipped** (reuse). Проверил происхождение реального прогона: на прогоне `4a7de337` (33667562495) job «Golden-кадры против принятых эталонов» дошёл до конца матрицы — лог показывает `passed` для всех сценариев, включая `support-desktop-empty-light-en`, `support-desktop-preview-dark-en`, `support-phone-validation-light-ru`, `support-phone-success-dark-en`, `support-relay-error-light-en`, `support-tablet-preview-dark-ru` — и **успешно сохранил cache-маркер** `reuse-golden-366e97...` в 18:34:48, после чего run получил `cancelled` только из-за отмены следующим пушем (смоки/golden в этом run отменились позже реального успеха golden). Это не «слепое доверие reuse»: сам прогон матрицы состоялся и был зелёным на коде, идентичном текущему `demo/golden/harness.mjs` (правка `card._haSupportApi = 1` в сценарии `support` вошла именно в этот коммит) |
| `performance_smoke` | зелёный, не по диффу | тот же прогон `4a7de337`: job «Перф-смок: бюджет времени кадра» реально выполнился и завершился success (18:31:37–18:33:15), не отменён |
| Браузерные смоки (полная матрица, 3 шарда) | зелёный, ПО ДИФФУ | Validate `3576cc2e`: все 3 шарда + «Смоки: все шарды зелёные» выполнились заново (не reuse) и прошли — это полный прогон `demo/smoke_*.mjs`, включая `smoke_support_feedback.mjs`, `smoke_help_affordance.mjs`, `smoke_preflight_diagnostics.mjs` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнил сам | «Прямое совпадение» (9): `smoke_support_feedback`, `smoke_help_affordance`, `smoke_optimize_coordinate_canonicalization`, `smoke_tap_ctx`, `smoke_junction_limits`, `smoke_partition_openings`, `smoke_preflight_diagnostics`, `smoke_room_resize`, `smoke_zero_wall_migration_unblocked`. Первые три из списка совпадают по существу (support-диалог, `_haIntegrationVersion`); остальные — совпадение по `_showToast`/`this.host._config` (не изменённая диффом логика, просто те же геттеры переиспользованы в новых строках `_copySupportText`/`_supportErrorText`). Все 9, как и вся остальная матрица, реально прогнаны в job "Смоки в браузере" на `3576cc2e" (см. строку выше) — отдельный точечный прогон не потребовался |
| `node demo/benchmark_backdrop_decode.mjs --guard-probe` | перепрогнал сам | `EXC Error: houseplan backdrop guard probe` → `FAILED: 1 uncaught exception(s) inside the card` → exit code 1. Тест умеет падать: подтверждено выполнением, не чтением |
| `node --test test/smoke-harness-contract.test.mjs` (контракт AC9) | проверено чтением | Мутационная проверка встроена в сам тест (снимает `watchPage`/`reportPageErrors` и требует красноты) — не потребовало отдельного прогона поверх зелёного `npm test` |
| Инварианты модели (`npm run invariants`) | не прогонял, не требуется | диапазон не трогает геометрию/`layout`/`marker.space`/`open_spans`/толщину стен |
| `python -m pytest tests_backend -q` без HA | не прогонял | заведомо тихо скипнул бы `test_ha_*.py`, доказательством не является (AGENTS.md) |

### Ручное чтение и трассировка

- Прочитан полный диапазон `custom_components/houseplan/websocket_api.py`, `support_transport.py`, `const.py` — построчно сверен с §"Контракт реализации" ТЗ.
- Прочитан полный диапазон `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, `src/support-feedback.ts`, `src/i18n/support.ts`.
- Прочитаны все новые/изменённые backend- и frontend-тесты построчно, а не по именам.
- Проведена архивная проверка происхождения зелёных гейтов в GitHub Actions (`gh api .../jobs`, `gh cache list`) для reuse-джобов backend/golden/performance — см. таблицу выше. Это не входит в обычный объём ревью, но потребовалось, потому что итоговый прогон `3576cc2e` сам по себе не содержит подтверждения backend/golden — я не принял reuse на слово.

## Находки

Пусто. High: 0, Medium: 0, Low: 0.

## Проверено и корректно (по AC)

- **AC1.** `_support_repairs()` (`websocket_api.py:251-267`) агрегирует по `translation_key` через `_SUPPORT_REPAIR_FAMILY = ^[a-z][a-z0-9_]{0,63}$`, пропускает foreign domain, `None` и невалидные ключи. `test_support_repairs_aggregate_safe_translation_key_families` конструирует ровно эти шесть случаев (два `broken_plan`, одно новое семейство, unsafe-ключ, missing-ключ, foreign domain) и проверяет через `json.dumps`, что raw id/placeholders/unsafe-ключ физически отсутствуют в сериализованном результате. Тест умеет падать: откат к `startswith("broken_plan_")` не подхватит `future_repair`. Доказано автотестом.
- **AC2.** Backend (`support_transport.py:58-60`) и frontend (`houseplan-editor-runtime.ts:9308-9310`) оба берут `sha256[:12]`/`sha256.slice(0,12)` из одного и того же значения `preview["sha256"]`, вычисленного один раз в `_build_snapshot` и не пересчитываемого отдельно нигде (проверено: `attachment_sha256=preview.get("sha256")` в `ws_support_submit`, `websocket_api.py:2333`) — источник числа один, ветвления сравнения "видно дважды" нет. `filename_token` полностью удалён из `support_transport.py` и всех вызывающих мест (grep по репозиторию — пусто). Backend-тест проверяет точное имя `houseplan-support-0123456789ab.json` и отсутствие token-префикса. Доказано транспортным тестом + frontend smoke (`downloadExact` в `smoke_support_feedback.mjs`).
- **AC3/AC4.** Прочитан порядок в `ws_support_preview` (`websocket_api.py:2164-2233`): preflight-проверка стоит до `write_lock`/`store.async_load`/`executor_job`; финальная проверка — после `await`, до удаления старого token; удаление старого token — синхронный участок без `await` между проверкой и записью. Три специально сконструированных backend-теста доказывают это исполнением, а не декларацией: `test_support_preview_quota_rejects_before_store_load_or_executor` мон키патчит `async_load`/`async_add_executor_job` так, что их вызов кидает `AssertionError`, и подтверждает, что при исчерпанной квоте они не вызываются вовсе; `test_support_preview_failed_refresh_keeps_previous_token` роняет `build_support_package` и проверяет, что старый token не исчез; `test_support_preview_final_quota_check_closes_executor_race` реальным `threading.Barrier` синхронизирует два конкурентных WS-запроса внутри executor-колбэка и проверяет, что ровно один получает `support_rate_limited`, а итоговый набор превью не превышает лимит. Все три теста по конструкции обязаны падать при откате к прежнему порядку (задача явно этого требует, и логика совпадает с планом отрицательной проверки ТЗ, пункт 3). Доказано backend-тестами.
- **AC5.** `SUPPORT_API_VERSION = 1` (`const.py`) добавлен в `ws_config_get` как top-level `support_api`, включая ветку с `fields`-проекцией (`websocket_api.py:1264`, обе ветки видел в диффе и в тесте). Backend-тест проверяет оба пути (`resp["result"]` и `projected["result"]`) и явно — что поле отсутствует внутри `config`. Frontend: `_adoptConfigCapabilities` (`houseplan-card.ts:4279-4288`) принимает только `Number.isSafeInteger`, иначе сбрасывает в `null`; вызывается на всех четырёх путях получения `config/get` (полная загрузка, structural adopt, periodic reload, config-reload) — проверил каждый вызов построчно. Доказано backend-тестом + чтением всех вызовов на фронтенде.
- **AC6.** Единый предикат `supportApiCompatible` (`support-feedback.ts:6-8`, `value === 1`) используется во всех трёх местах — `_buildSupportPreview`, `_submitSupport`, `_renderSupportDialog` (grep подтвердил отсутствие остатков старого `_haIntegrationVersion === CARD_VERSION`). Unit-тест `supportApiCompatible` перебирает `undefined, null, 0, 2, '1', 1.0, true, {}, NaN` — все должны быть несовместимы, только `1` совместим. `smoke_support_feedback.mjs` добавил явный сценарий mixed-release (`_haIntegrationVersion='mixed-release', support_api=1` → форма видна) и повторно проверил old-backend fail-closed через `_haSupportApi=null`. Доказано unit-тестом + smoke.
- **AC7.** `src/i18n/support/{en,ru,de,fr}.json` содержат по 42 ключа (тест явно фиксирует число), `en.json`/`ru.json`/etc. в основном словаре оставляют только `support.title`. `i18n.test.mjs` добавил тест на равенство key-set и плейсхолдеров всех четырёх support-словарей; `i18n-dead-keys.test.mjs` теперь сканирует объединённый словарь (core + support). `bundle-assets.test.mjs` — юнит-тест на `assertSupportBundleOwnership` с мутационной проверкой (marker в initial graph → падает; initial gzip не улучшился → падает). Доказано i18n- и bundle-тестами.
- **AC8.** `dist/houseplan-assets.json`: `initialViewGzipBytes=289137` (< 291046 baseline, budget не менялся — 300000). Перепроверил числа лично, не только со слов автора. `assertSupportBundleOwnership` — новый вызов в `bundle-budget.mjs`, подключён в CI (`validate.yml:460`, `publish-prerelease.yml:86`). Доказано build-манифестом + подключённым тестом.
- **AC9.** Лично прогнал `node demo/benchmark_backdrop_decode.mjs --guard-probe` — код возврата 1, ожидаемое сообщение о необработанном исключении. Обычный режим (`cases`) не тронут кроме обёртки `watchPage`/`reportPageErrors`. Контрактный тест `smoke-harness-contract.test.mjs` идёт дальше формального совпадения по имени: у него есть встроенная негативная проверка (снять `watchPage` или заменить `reportPageErrors()` на `false` → контракт обязан покраснеть) — то есть тест доказанно умеет падать, а не просто присутствует. Доказано исполнением + контрактным тестом.
- **AC10.** `git diff` по `.github/workflows/docs-screenshots.yml` пуст. Доказано diff'ом напрямую.
- **AC11.** Typecheck/unit/build — см. таблицу гейтов. Runtime-схемы (`CONFIG_SCHEMA`, `LAYOUT_SCHEMA`) в диффе не тронуты — `support_api` не проходит через них, добавляется в ответ отдельно после `_layout_metadata`/config-объекта. Проверено чтением.
- **AC12.** `docs/USER-GUIDE.md`/`.ru.md` переформулированы на «доступна при совместимом API», без упоминания SHA-префикса как публичного обещания. Оба `docs/CHANGELOG.md`/`.ru.md` отредактированы в том же коммите (`2038ab91`, `User-Visible: yes`) — трейлеры и оба changelog проверены `git show` напрямую. Доказано чтением diff + code review.

## Что не проверял (и почему)

- **Полный ручной прогон `python -m pytest tests_backend -q` на этой машине** — здесь нет `homeassistant`, тихий скип не был бы доказательством. Заменено проверкой происхождения реального Linux-CI-прогона на предыдущем SHA той же ветки (см. таблицу).
- **`npm run golden:verify` и `performance_smoke` вручную** — ТЗ прямо говорит, что видимый DOM/layout не меняется (только текст `support.update_required`, который не входит в golden-покрытие по разметке). Вместо повторного прогона проверил, что зелёный результат в reuse-цепочке реален (не «зелёная галка по недоразумению») — см. лог golden-job с `passed` по всем `support-*` сценариям.
- **8 из 9 «слабых»/совпавших по `_showToast`/`_config` смоков** (`smoke_junction_limits`, `smoke_partition_openings`, `smoke_room_resize`, `smoke_zero_wall_migration_unblocked`, `smoke_tap_ctx`, `smoke_optimize_coordinate_canonicalization`) и 18 позиций из «слабой связи» — отдельно не гонял: они совпали по названию геттера, который диапазон не меняет по смыслу (`_showToast`/`this.host._config` использованы как есть, без изменения контракта). Все они входят в полную матрицу, которая реально прогналась на точном SHA `3576cc2e` (3 шарда + сводный job зелёные), так что фактическое покрытие есть — просто не через отдельный целевой запуск.
- **Инварианты модели (`npm run invariants`)** — диапазон не касается геометрии рёбер, толщины стен, `layout`, `marker.space`, `open_spans`; не применимо.
- **Реальный HA `IssueEntry.translation_key`** — не проверял исходники `homeassistant-core` напрямую (модуль недоступен локально); опирался на (а) существующее использование `translation_key=` в `custom_components/houseplan/repairs.py:51` того же пакета для создания `broken_plan`-репаров, (б) зелёный Linux backend CI на этом же коде. Оснований сомневаться нет, но это не то же самое, что чтение исходников HA.

## Вердикт

Зелёный. Все 12 AC доказаны автотестами, которые проверены на способность падать (чтением конструкции или прогоном), либо прямым чтением кода с фиксацией «проверено чтением». Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/423-v170-polish`, коммит `3576cc2ea7e5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `856c13aff5985cd40bf743c00137911b055fd955`
  ```
  git log --all --format='%H %T' | grep 856c13aff598
  ```
- ТЗ `docs/specs/423-v170-polish.md`, блоб `3a0e7b78a9f8a01f3f54e4a6182dba04badecfae`
  ```
  git log --all --find-object=3a0e7b78a9f8a01f3f54e4a6182dba04badecfae -- docs/specs/423-v170-polish.md
  ```
