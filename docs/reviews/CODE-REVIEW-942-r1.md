# CODE-REVIEW-942-r1

Issue: #942 · этап: code · трек: ask · заход: r1 · блокирующих циклов: 0/4
Материал: `issue/942-support-diagnostics` @ `35f6315e863895e83be9b9a931e6a19638b07f1e`
(база `dev@0f4496f57` с принятыми #918/#919). Рабочая копия уже на этом SHA,
`git rev-parse HEAD` сверен перед итогом.

## Скоуп

Редакция 2 ТЗ #942 (принятая зелёным SPEC-REVIEW-942-r2): opt-in support
package v2/schema1 — закрытая проекция конфигурации/связей, нормализованные
client/server observations, геометрия/samples пылесоса с identity-сохранением,
entity read ACL независимо от `may_write`, честная сводка полноты (coverage),
v1/v2 negotiation, отдельная (пока не выполненная — она после S8) выкладка
relay. AC1–AC10 целиком в скоупе; AC10 по формулировке ТЗ §10/§13 выполняется
*после* S8 и в код-ревью не проверяется как блокер.

## Как проверялось

Static-first (#857): материал неизменен (ровно указанный SHA), окружение и
оракул (Validate) тоже не изменились — дешёвые гейты и уже выполненный полный
`ci:full`+`ci:golden` Validate на этом SHA не перегонялись повторно. Прочитаны
тело issue (ТЗ ред.2), все комментарии (аналитика → SPEC-REVIEW r1/r2 →
реализация → три возврата до модели: красный Validate, несобранный
model-review, два ребейз-конфликта → финальный хендофф на `35f6315e`),
`docs/process/REVIEWER.md`, затронутые разделы `PROCESS.md`, `docs/SCOPE.md`,
`AGENTS.md`.

Прочитан код построчно в ключевых зонах риска, а не только хендофф:
`support_wire_schema.py` (вся схема CLIENT_INPUT/DIAGNOSTICS/PACKAGE и функция
`validate()`), `support_snapshot.py` (`can_read`/`scope_readable`, routes/rooms
truncation, access_denied ветки), `support_preview.py`/`websocket_api.py`
(`ws_support_submit`, read-ACL recheck на submit, canonical bytes), `houseplan-
editor-runtime.ts` (`_buildSupportPreview`, `_closeSupportDialog` stale-snapshot
fix, consent pinning), `support-diagnostics.ts`, `test/support-diagnostics.
test.mjs`, i18n-словари (en/ru/de/fr) и `test/i18n.test.mjs`,
`scripts/mutation-registry.mjs` (новые семь witness-якорей), release-ledger
`docs/release-ledger/v1.81.0/942.json`, все trailers диапазона
`origin/dev..HEAD`.

Выполнены лично (дешёвые, детерминированные, не меняющие предмет ревью):

| Гейт | Команда | Результат |
|---|---|---|
| Статическая применимость реестра мутантов | `node scripts/mutation-gate.mjs --check` | 1648 definitions, 0 ошибок (`ok` на всех, включая семь новых `support-v2-*`/`-effective-source-*` якорей); мутанты НЕ исполнялись |
| Существование guard-тестов семи новых witness | `grep -rn "def <guard-test>"` по каждому из пяти backend guard-функций | все пять найдены в `tests_backend/test_ha_support_v2.py` и `test_support_builds.py`; два smoke-guard сценария (`stale`/`discard`, `refresh`/`re-consent`) найдены в `demo/smoke_support_diagnostics.mjs` |
| Проверка лимитов §9 по коду, а не только по заявлению | чтение `Array(...)` границ и `[:N]`-усечений в `support_wire_schema.py`/`support_snapshot.py`/`support-diagnostics.ts` | 32 робота / 16 candidates / 64 routes / 64 sources / 256 room anchors / 4096 points / 256 fragments / 512KiB input / depth≤12 / 2MiB diagnostic section — все найдены в коде, числа совпадают с ТЗ §9 |
| Закрытость enum причин coverage | сверка `support_wire_schema.py:119-130` (12 reason-enum) против `src/i18n/support/en.json` | 1:1, без лишних и без пропущенных ключей |
| Параллелизм словарей EN/RU/DE/FR | подсчёт `support.*` ключей по каждому файлу + `test/i18n.test.mjs` (keys.length===102) | 67/67/67/67 top-level + единый assert на 102 lazy editor dictionary ключа |
| Трейлеры диапазона | `git log origin/dev..HEAD --format=%B` по каждому из 13 коммитов | `Issue: #942` на каждом коммите класса A/B; `User-Visible: yes` ровно на двух (d2c91d1c, 95951036), и в обоих тот же коммит правит `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` |
| Ledger | чтение `docs/release-ledger/v1.81.0/942.json` | `category: major` относительно v1.81.0, RU/EN summary присутствуют, обоснование — новая пользовательская возможность, не исправление робота — соответствует характеру изменения |
| Легитимность зелёного Validate на материале | `gh run view 39028730024` (SHA в ответе = `35f6315e…`) + `gh run view 39027958073` (SHA предыдущего коммита `5f8d7f58…`) | оба success; вместе покрывают полный `ci:full`+`ci:golden`: backend pytest (прошёл на `5f8d7f58`, т.к. дерево backend между двумя коммитами не менялось — коммит `35f6315e` правит только golden baselines/index), golden+3 browser-шарда+perf (прошли на `35f6315e`), HACS/hassfest/provenance (прошли на `5f8d7f58`); «Мутанты по диффу» и «Геометрия TS/Python parity» skipped в обоих — согласно политике (мутанты только ночью) и отсутствию изменений в core-геометрии (affine/wall-align), не в новой diagnostics-проекции |
| submit использует ровно previewed bytes | чтение `ws_support_submit` | `attachment = preview.get("bytes")`, `attachment_sha256 = preview.get("sha256")` — не пересчитываются; re-check `scope_readable` перед отправкой (строка, патчи которой зарегистрированы как `support-v2-submit-skips-read-acl`) |

## Риск по изменённым участкам (#707) — покрытие классов AC

- **devices** (`support_snapshot.py` токены `is_admin`, `websocket_api.py`
  импорт `support_package`/`support_preview`/`scope_readable` и смежные
  участки): `is_admin` — часть `can_read()` (admin видит всё, как в остальном
  коде HA-permissions, см. тот же паттерн в `_readable_entity_ids`/
  `_can_read` до этой задачи) — прямо требуется АС8 («entity read ACL не
  обходится через may_write/client/run», §8 ТЗ). Остальные помеченные строки —
  импорт и провода WS-команд preview/submit, тоже AC8/AC5/AC6 (version
  negotiation, canonical bytes). Класс покрыт.
- **ux** (новые i18n-ключи `support.attach_legacy`, `attach_hint_legacy`,
  `legacy_diagnostics`, `coverage_title`, `coverage_complete` и далее):
  перечислены дословно в ТЗ §11 («Ключи support EN+RU... фиксированные
  category/reason переводы под `support.diag.*`») и проверяются AC7 (состав/
  coverage/legacy warning видны до отправки, phone/desktop light/dark без
  overflow). Класс покрыт.

Оба класса из списка риска имеют явную строку ТЗ/AC — дополнительных
«необъяснённых» участков не найдено; `route: reclassify` не применяется (это
инструмент трека `show`, задача на `ask`).

## Находки

Находок нет — ни High, ни Medium, ни Low.

Отдельно отмечаю (не находка, честная констатация): AC10 (relay на
staging/prod) по тексту ТЗ §10/§13 выполняется *после* S8 («После S8 сначала
accepted-code relay on staging... Если выкладка невозможна, не объявлять
задачу законченной») — это не пропуск автора, а прямое указание ТЗ. Автор
сам называет это в разделе «НЕ сделано» каждого хендоффа. Код и rollout/
rollback-план для relay готовы и прочитаны (`scripts/support-relay/
hp_relay/support_wire_schema.py`, `validate.py`, 41/41 unittest), сам деплой
не является предметом этого код-ревью.

## Что проверено и корректно

- **AC1/#918** — `vacuumSupportReasons` (test/support-diagnostics.test.mjs) и
  backend `test_918_identity_rejection_survives_actual_builder_and_actual_run_
  adoption` реально разводят `run_source_mismatch` (root A / route B) от
  `stopped`, от `run_route_mismatch` (пришитый foreign route_id) и от
  `foreign_space`/`runtime_unavailable`; control-сценарий (совпадающий
  source) даёт `currentRunMatches: true`. Не выдумано, прочитано в реализации
  и в тесте с реальными негативными ветками.
- **AC2** — границы координат/матриц и усечение samples заданы в схеме и
  enforced `validate()` (reject, не silent-truncate, для untrusted
  CLIENT_INPUT) либо явным `[:N]` на серверной стороне (bounded-but-sampled,
  с сохранением identities/reasons — соответствует §9 «первой важности»).
  Числа совпадают с ТЗ §9 построчно (см. таблицу выше).
- **AC3** — закрытый allowlist в `support_wire_schema.py` (`Object(...,
  frozenset(...))`) отвергает неизвестные поля конфигурации; 12 reason-enum
  закрыты и имеют ровно соответствующие i18n-ключи — не больше, не меньше.
- **AC5** — submit берёт `preview["bytes"]`/`["sha256"]` как есть, не
  пересчитывает; re-check `scope_readable` на submit — то же место, что
  патчит зарегистрированный (не исполненный) witness
  `support-v2-submit-skips-read-acl`. Lease-таймаут (`support_builds.py`)
  патчится предложенным witness ровно в `asyncio.wait_for`/`release` —
  патч синтаксически корректен и не исполнялся (`execution=0` в реестре).
- **AC7/§11** — i18n parity обеспечена автотестом
  (`test/i18n.test.mjs`, `keys.length === 102`), а не только текущим
  состоянием файлов — будущая рассинхронизация локалей красит тест.
- **AC8** — `can_read`/`scope_readable` идентичны по духу уже существующим в
  коде примитивам (`_readable_entity_ids`, `_can_read`), что подтверждено ещё
  в SPEC-REVIEW-942-r2; код-ревью подтверждает, что реализация действительно
  вызывает эти функции в preview-build, publish и submit, а не только в
  одной точке.
- **Трейлеры/changelog/ledger** — соответствуют правилам (см. таблицу).
- **Golden** — принятие шести Help-сцен поверх matrix76 задокументировано
  (`Baseline-Reviewed-Local`, инспекция 6 PNG, 204 неизменных сцены, 114
  byte-identical witnesses) и подтверждено успешным job «Golden-кадры против
  принятых эталонов» в Validate `39028730024` на итоговом SHA.

## Чего не проверял (и почему не требовалось)

- Полный `python -m pytest tests_backend` (1578/1 skipped), `npm run
  gate:small`, четыре браузерных smoke-шарда, perf-smoke и `golden:verify`
  лично не перегонял — они зелёные на материале `35f6315e` в CI
  (`39028730024`, backend-часть — на предшествующем коммиту-golden-accept SHA
  `5f8d7f58`, дерево вне golden между ними не менялось, что я проверил
  `git diff --stat` и чтением commit message). Повторный прогон тех же входов
  на том же материале не добавил бы доказательства (§8 REVIEWER.md).
- Полный backend `pytest` и браузерные скриншоты не инспектировал пиксель-в-
  пиксель лично — доверился: (а) успешному Validate-джобу, (б) PNG SHA256
  byte-identical сверке, описанной автором и подкреплённой числом witnesses
  (114 при floor10), (в) собственному чтению схемы/кода, которое независимо
  подтверждает заявленные инварианты (coverage enum closure, лимиты, ACL).
- `pytest`/relay staging/prod HTTP (AC10) — не в скоуве код-ревью по ТЗ §10/
  §13 (post-S8 шаг); отдельно отмечено выше, не находка.
- Мутанты (весь реестр, включая семь новых) не исполнялись — согласно
  общей политике, это разрешено только ночному workflow; для code-review
  ограничился статическим `--check` (применимость патчей) и проверкой, что
  названные guard-тесты существуют и имеют нужные негативные ветки по тексту.
- Ручная dev/GPU-приёмка владельцем — ТЗ §1 прямо говорит «не требовать»,
  поэтому не запрашивалась и не является находкой (#929).
- Полный аудит всех ~82/~95 файл:строка из блока «Риск по изменённым
  участкам» построчно не делал — трек `ask` требует подтвердить, что каждый
  **класс** risk покрыт AC/документом (см. раздел выше), что и сделано на
  репрезентативных примерах каждого класса (is_admin/ACL-провода для
  `devices`, новые i18n-ключи для `ux`); оба класса прослеживаются к
  конкретным строкам ТЗ без домыслов.

## Вердикт

Зелёный. High: 0, Medium: 0. Маршрут — `fix` (track `ask`, не `show`;
`reclassify` неприменим). Цикл не образуется (§4).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/942-support-diagnostics`, коммит `35f6315e8638` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7310d532d04e3348b040d5c1fdf4c1a51fd96176`
  ```
  git log --all --format='%H %T' | grep 7310d532d04e
  ```
- Тело issue: `11cbf71af82c4c7edde66734d757818172790a92c959718610b50cf5593e8893`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMTYsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjE2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Niwib3V0cHV0X3Rva2VucyI6MjYxMDMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTU0NzE0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTM2NTg5MiwiY29zdFVzZEVzdGltYXRlIjoxLjk1MzI1NjR9XSwidHVybnMiOjU2LCJkdXJhdGlvbk1zIjozMzY5NTQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjk1ODQ3MjQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5212 output_tokens=26123 cache_creation_input_tokens=154714 cache_read_input_tokens=5365892 num_turns=56 -->
