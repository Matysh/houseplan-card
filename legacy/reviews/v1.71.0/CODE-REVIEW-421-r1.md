# CODE-REVIEW-421-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/421
- Этап: `S6-code-review` (код-ревью, PROCESS.md §2.7)
- Материал: `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
  на коммите `f4b425f3c0baf4f326a30669cc23a5f63c4bbaad` (ветка
  `origin/issue/421-negative-test-proofs`, HEAD detached на этом SHA).
- Заход: r1 (первый код-ревью раунда, блокирующих циклов израсходовано 0 из 4).
  ТЗ прошло два раунда spec-review (`docs/reviews/SPEC-REVIEW-421-r1.md`,
  `docs/reviews/SPEC-REVIEW-421-r2.md`), итоговый вердикт — зелёный на
  `fac1f884`.

## Скоуп

Единственный коммит реализации — `f4b425f3` («test: prove three defensive
contracts fail red»). Остальные 4 коммита в диапазоне — документация ТЗ и
ревью ТЗ (`c409ec6a`, `7f9b9198`, `fac1f884`, `03cc6063`), кода не меняют.

Изменённые файлы `f4b425f3`:

- `custom_components/houseplan/websocket_api.py` — clock seam
  `_support_monotonic()` (обёртка над `time.monotonic()`);
- `tests_backend/test_ha_websocket.py` — реальные submit-проверки
  replacement/discard/TTL вместо discard-only идемпотентности;
- `demo/guard/guard_report_page_errors.mjs` (новый) — отдельная browser probe
  через `reportPageErrors()`, без `finish()`;
- `demo/guard/verify-guard.mjs` — регистрация новой probe;
- `scripts/docs-accept.mjs` — вынесенная экспортируемая
  `acceptedDocsManifest()`, `main()` теперь вызывает её как единственный путь;
- `test/docs-accept.test.mjs` — unit-матрица новой/сохранённой acceptance
  trace;
- `scripts/mutation-gate.mjs` — 5 новых адресных мутантов
  (`support-preview-replacement-keeps-old-token`,
  `support-preview-discard-keeps-token`,
  `support-preview-submit-skips-ttl-prune`,
  `report-page-errors-skips-round-trip`,
  `docs-fingerprint-refresh-erases-acceptance-trace`);
- `test/smoke-exception-guard.test.mjs`, `test/smoke-harness-contract.test.mjs`
  — контракт на новую probe (обнаружимость, отсутствие `finish()`, счётчик
  `verify-guard.mjs` в реестре);
- `docs/specs/README.md` — строка issue↔ТЗ.

Production-код (`websocket_api.py`) изменён минимально: три существующих
разрыва доказательности не потребовали фикса поведения (ТЗ предполагало это
как вероятный исход, «принятые предположения»/«затрагиваемые файлы») — только
добавлен monkeypatch-совместимый clock seam, без изменения логики
replacement/discard/TTL/prune. `demo/serve.mjs` не тронут вовсе.

## Как проверялось

1. Прочитан ТЗ `docs/specs/421-negative-test-proofs.md` на `fac1f884` целиком,
   оба документа spec-review, `docs/SCOPE.md`, разделы 2.7/2.9/2.10/7/8/12
   `PROCESS.md`.
2. `git diff origin/dev...HEAD` разобран файл за файлом (см. «Скоуп»).
3. Для каждого AC1–AC9 сверено соответствие тесту/коду построчно (см.
   «Что проверено и корректно»).
4. Прогнаны гейты, не покрытые дешёвым CI-прогоном (см. таблицу гейтов).
5. Прочитан production-код seam'ов (`websocket_api.py:234-253`, `2181-2253`,
   `2284-2317`; `demo/serve.mjs:44-121`), чтобы подтвердить, что анкоры
   мутантов адресуют именно то, что описывает ТЗ, а не соседний код.

### Гейты

Validate на этом SHA (`f4b425f3`) зелёный целиком:
https://github.com/Matysh/houseplan-card/actions/runs/33660048919 — все job,
включая «Бэкенд: pytest в Home Assistant», «Фронтенд: типы, юниты, мутанты,
синхрон бандла» (typecheck/`npm test`/`npm run build`/bundle-tree), «Golden»,
«Смоки в браузере (3 шарда)», «Перф-смок» — `success`. Дешёвые гейты (tsc,
`npm test`, build+bundle sync) и `pytest tests_backend` этим прогоном
переиспользованы, повторно не гонялись.

Diff не трогает `src/**` — `node scripts/check-docs.mjs` не требуется
(подтверждено `node scripts/smoke-select.mjs --base origin/dev --head HEAD`:
«Исполняемого frontend-диффа нет»). Diff не трогает геометрию/`layout`/
`marker.space`/толщину стен — model-invariants не требуются. Golden/perf уже
зелёные тем же CI-прогоном, доп. прогон не нужен: AC9 явно не требует пиксельных
доказательств.

Не покрыто Validate (это release/mutation-gate, отдельный workflow, не
запускается на каждом обычном прогоне) — прогнано мной:

| Гейт | Команда | Результат |
|---|---|---|
| Применимость патчей | `node scripts/mutation-gate.mjs --check` | `ok` по всем мутантам реестра, включая 5 новых — анкоры существуют в текущем коде ровно один раз |
| AC7 (docs acceptance) | `node scripts/mutation-gate.mjs --id=docs-fingerprint-refresh-erases-acceptance-trace` | чистый прогон `ok`, с мутантом — `тест покраснел, как обязан`, «поймано 1 из 1» |
| AC4+AC5 (browser probe) | `node scripts/mutation-gate.mjs --id=report-page-errors-skips-round-trip` | чистый прогон `node demo/guard/verify-guard.mjs` — `ok` (реальный Chromium, все 4 probe включая новую отработали штатно); с мутантом — «поймано 1 из 1» |
| AC1 (replacement) | `node scripts/mutation-gate.mjs --id=support-preview-replacement-keeps-old-token` | **не выполнено** — локальный питон без `pytest`/`pytest-homeassistant-custom-component`/`homeassistant` (ошибка `No module named pytest`); заменено чтением кода, см. ниже |
| AC2 (discard) | `--id=support-preview-discard-keeps-token` | то же ограничение, то же замещение чтением |
| AC3 (TTL) | `--id=support-preview-submit-skips-ttl-prune` | то же ограничение, то же замещение чтением |

Для трёх backend-мутантов (AC1–AC3) отрицательный прогон **проверен чтением, не
исполнением**: `--check` подтвердил, что анкоры патчей (`websocket_api.py:2196-2198`,
`2251-2252`, `2284-2285`) — точные, единственные вхождения в текущем коде.
Построчный разбор функций `ws_support_preview`/`ws_support_preview_discard`/
`ws_support_submit` (см. «Что проверено и корректно») показывает, что удаление
каждого анкора именно ломает ту assert-пару, которую добавил новый тест
(`support_preview_expired` / число вызовов `submitted`) — логика однозначна,
альтернативных путей, которые сохранили бы прежнее поведение без этого кода,
нет. Реальный запуск pytest этих трёх мутантов — открытый пункт, см.
«Чего не проверял».

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **AC1 (replacement).** `test_support_preview_replacement_and_discard_are_draft_local`
  создаёт три токена (два — `draft-same-card`, один — `draft-other-card`),
  мокает `async_submit_report`. После замены `first["token"]` (старый токен
  того же драфта) отвечает `support_preview_expired`
  (`tests_backend/test_ha_websocket.py:1362-1365`); `other["token"]` (другой
  `draft_id`) успешно доходит до транспорта с точными байтами
  (`:1367-1371`, сверено с `other["text"].encode("utf-8")`). Код: цикл замены
  `websocket_api.py:2196-2198` — анкор мутанта
  `support-preview-replacement-keeps-old-token` совпадает буквально; без него
  `first["token"]` остаётся в `rt.support_previews`, и submit прошёл бы
  успешно, а не с `support_preview_expired` — тест ловит именно это.
- **AC2 (discard).** После `preview/discard` `replacement["token"]`
  submit отвечает `support_preview_expired`, `len(submitted) == 1` (транспорт
  не вызван повторно) — `:1383-1390`. Discard уже удалённого `first["token"]`
  остаётся идемпотентным `{ok: true}` — тест это явно использует, а не
  выдаёт за доказательство удаления (замечание r1 ТЗ учтено буквально: успех
  discard больше не единственное доказательство). Код: `pop` в
  `ws_support_preview_discard` — `websocket_api.py:2251` — анкор мутанта
  `support-preview-discard-keeps-token` точный; без `pop` токен остался бы в
  карте, submit прошёл бы успешно вместо `support_preview_expired`.
- **AC3 (TTL).** `test_support_preview_token_expires_at_ttl_without_transport`
  подменяет `_support_monotonic` управляемым словарём `clock`, без `sleep`.
  До границы (`TTL - 1`) submit успешен и байты совпадают
  (`:1416-1419`); на границе (`now >= expires`, `TTL` секунд от создания)
  submit отвечает `support_preview_expired`, `len(submitted) == 1` — relay не
  вызван (`:1421-1428`). Код: `_prune_support_previews(rt)` перед чтением
  токена в `ws_support_submit` — `websocket_api.py:2284` — анкор мутанта
  `support-preview-submit-skips-ttl-prune` точный; без prune истёкшая запись
  осталась бы в карте и submit прошёл бы успешно.
- **Идемпотентность ключей.** Каждый submit в новых тестах использует свой
  `idempotency_key` (`replaced-token-proof`, `other-draft-proof`,
  `discarded-token-proof`, `before-ttl-proof`, `at-ttl-proof`) — риск ТЗ
  «результат маскируется idempotency-кэшем» закрыт буквально.
  Rate-limit (`MAX_SUPPORT_PREVIEWS_PER_USER = 3`) не задет: подсчёт `owned`
  в `websocket_api.py:2199` идёт уже после цикла замены, число одновременно
  живых токенов на владельца в обоих тестах не превышает 2.
- **AC4/AC5 (browser probe).** `guard_report_page_errors.mjs` создаёт page
  error в хвосте (`setTimeout(..., 0)`), не вызывает `finish()`, только
  `await reportPageErrors()` — совпадает с контрактом дословно. Прочитан
  `demo/serve.mjs:44-121`: `reportPageErrors()` и `finish()` независимо each
  вызывают `roundTripLivePages()` — это две реально разные функции, мутант
  адресует ровно тело `reportPageErrors`, анкор уникален (подтверждено
  `--check`). Реальный прогон `verify-guard.mjs` (Chromium) — без мутанта все
  4 probe зелёные, с мутантом (`--id=report-page-errors-skips-round-trip`) —
  «поймано 1 из 1» — AC4 и AC5 доказаны исполнением, не только чтением.
  `test/smoke-harness-contract.test.mjs` фиксирует source-контракт (нет
  `finish()`, есть `reportPageErrors()`), `test/smoke-exception-guard.test.mjs`
  — обнаружимость 4 проб и регистрацию 3 мутантов реестра (двух старых плюс
  нового) с 3 вызовами `verify-guard.mjs` в реестре.
- **AC6/AC7 (docs acceptance).** `acceptedDocsManifest()` — чистая функция без
  мутации входов (`test/docs-accept.test.mjs` явно проверяет
  `'acceptance' in manifest === false` и неравенство ссылок; `previousAcceptance`
  тоже не мутируется — сверено `structuredClone`). Три ветки покрыты:
  реальная замена (`declared/witnesses/floor` + `witnessesSkippedBecause` при
  флаге), fingerprint-only с прежним trace (все прежние поля плюс
  `lastWriteWasFingerprintOnly: true`, включая произвольное поле `future`),
  fingerprint-only без прежнего trace (только `lastWriteWasFingerprintOnly`).
  `main()` в `scripts/docs-accept.mjs` вызывает эту же функцию — дублирующей
  inline-сборки не осталось (сверено диффом). Мутант
  `docs-fingerprint-refresh-erases-acceptance-trace` подменяет ветку
  fingerprint-only на пустой trace; guard —
  `--test-name-pattern="fingerprint-only refresh"`, совпадает с названием
  теста `#421 fingerprint-only refresh preserves the complete previous
  acceptance trace`. Прогнан лично — красный без фикса, пойман. AC7 требовал
  именно этого теста, а не теста `docsAcceptancePlan()` — верно, мутация
  патчит только `docs-accept.mjs`, к планировщику отношения не имеет.
- **AC8.** `--check` — все патчи (старые и 5 новых) анкорятся ровно один раз.
  `tsc --noEmit`/`npm test`/`build`+bundle sync/`pytest tests_backend` —
  зелёные на этом же SHA тем же Validate-прогоном.
- **AC9.** `websocket_api.py` меняет только имя вызова часов
  (`time.monotonic()` → `_support_monotonic()`, тождественная реализация по
  умолчанию) — публичный контракт, коды ошибок, схема, пиксели не меняются.
  `docs-accept.mjs` — чистый рефакторинг существующей inline-сборки в
  экспортируемую функцию с тем же поведением (сверено построчно со старым
  кодом в диффе). User-Visible: no на всех 5 коммитов — верно, changelog не
  тронут ни в RU, ни в EN.
- **Трейлеры.** Все 5 коммитов несут `Issue: #421` и `User-Visible: no`;
  ветка `issue/421-negative-test-proofs` соответствует конвенции.
- **Не-скоуп ТЗ соблюдён.** WebSocket API, коды ошибок, TTL-значение,
  idempotency-семантика, UI Help & feedback, browser smoke harness,
  правила приёмки скриншотов — не изменены; изменения точечные, ровно по
  трём названным швам.

## Чего не проверял

- **Реальный pytest-прогон трёх новых backend-мутантов**
  (`support-preview-replacement-keeps-old-token`,
  `support-preview-discard-keeps-token`,
  `support-preview-submit-skips-ttl-prune`) — окружение ревью не содержит
  `pytest`/`pytest-homeassistant-custom-component`/`homeassistant`
  (`ModuleNotFoundError`/`No module named pytest`). Заменено чтением кода
  (см. таблицу гейтов и «Что проверено»). Это открытый остаток: AC1–AC3
  доказаны тестом на исполнении (backend job Validate зелёный на
  правильном коде) и логическим разбором мутанта, но не отдельным красным
  прогоном каждого `--id=` лично мной.
- Полный `node scripts/mutation-gate.mjs` (без `--id`/`--check`) — дорогой
  release-гейт по всему реестру (~сотня мутантов), задача явно выводит его за
  рамки обычного прогона («Производительность» ТЗ); прогнаны только 5 новых
  адресных id плюс `--check`.
- `npm run golden:verify`, `python -m pytest tests_backend -q` (полный, не по
  одному тесту), `npx tsc --noEmit`, `npm test`, `npm run build` — не
  перезапускались локально; переиспользован зелёный Validate-прогон на этом
  же SHA (`f4b425f3`), гейты дешёвые и не расходятся с diff.
- `docs/TESTING.md` — не проверял на необходимость доп. описания новых
  guard ID: файл не упоминает существующие probe по именам вообще (только
  общие команды `--list`/`--check`/`--changed`), поэтому новые ID
  обнаружимы тем же путём без правки runbook; ТЗ считало это опциональным.
- Ручное UI-тестирование — не проводилось: изменение не имеет видимой
  поверхности (User-Visible: no, подтверждено AC9), а сценарий задачи — это
  разработчик, ломающий гейт, а не персона из `docs/SCOPE.md`.

## Материал раунда

- Ветка: `origin/issue/421-negative-test-proofs`
- SHA: `f4b425f3c0baf4f326a30669cc23a5f63c4bbaad`
- Диапазон: `origin/dev..HEAD` (5 коммитов, 1 из них — код)
- Validate CI: https://github.com/Matysh/houseplan-card/actions/runs/33660048919 (success)

## Вердикт

Зелёный. Три заявленных разрыва доказательности закрыты адресно и без
расширения скоупа: AC1–AC3 логически доказаны и подтверждены зелёным backend
CI-прогоном (сам pytest-запуск трёх новых `--id=` мутантов лично не
воспроизведён — нет backend-окружения в песочнице ревью, см. «Чего не
проверял»), AC4–AC7 воспроизведены мной лично как красный→пойман результат
исполнением. Production-поведение не изменено (AC9). High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/421-negative-test-proofs`, коммит `f4b425f3c0ba` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `87d4684aa6e067a201e82ca3b690e0c1a5b55df1`
  ```
  git log --all --format='%H %T' | grep 87d4684aa6e0
  ```
- ТЗ `docs/specs/421-negative-test-proofs.md`, блоб `41cd21d1f105502a9c9a7464af0d4b199ae322c9`
  ```
  git log --all --find-object=41cd21d1f105502a9c9a7464af0d4b199ae322c9 -- docs/specs/421-negative-test-proofs.md
  ```
