# CODE-REVIEW-1045-r1

Issue: #1045 · Этап: code · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: `96cea9546fbf24ebe25c47d2b735fd8bf8ef3e6a` (HEAD рабочей копии, подтверждено `git rev-parse HEAD`)
Диапазон: `origin/dev..HEAD`, 22 коммита (11 non-merge + 11 merge), 56 файлов, +3048/−107.
Принятый `validate-gate` run: https://github.com/Matysh/houseplan-card/actions/runs/40141879067 (review-light proof).

## Скоуп

ТЗ (SPEC r2, зелёный вердикт 2026-10-23T21:22:25Z): безопасное удаление
промежуточного структурного узла стены (A–B–C → A–C) через контекстное меню по
правому клику в Plan/Select. Узкий новый WS `houseplan/wall/node_delete`,
отдельный backend-модуль `wall_node_delete.py`, общий writer/history/validators,
capability `wall_node_delete_api: 1` как transport metadata. User-Visible: yes,
release-ledger `v1.82.0/1045.json`: `major`.

Риск по изменённым участкам (#707), сверка с AC ТЗ (трек `ask`):

| Класс | Где в ТЗ закрыт |
| --- | --- |
| geometry | «Контракт геометрии и безопасности» п.1–6, AC1–AC5 |
| touch | «Touch editor: best effort / intentionally degraded… отдельный long-press не добавляется», AC6 |
| devices | «Данные устройств… не входят в delta», AC3 «Посторонние… устройства… неизменны» |
| ux (i18n) | «Файлы и i18n» — точные EN/RU строки восьми новых ключей |

Отмечу отдельно: указанные в риске строки `websocket_api.py:156-160` и ещё 75 —
это **неизменённые контекстные строки** unified-diff вокруг существующего
импорта `virtual_lights` (сам diff добавляет только импорт `wall_node_delete`,
регистрацию команды и capability-флаг, плюс новую функцию `ws_wall_node_delete`
— 86 добавленных строк всего, 2 смысловых хунка). Содержательных правок
устройств в этом диффе нет; класс «devices» закрыт декларативно через AC3, а
не через изменение device-кода.

Все четыре класса покрыты AC ТЗ — route не требует `reclassify` (на `ask` этот
критерий и не применяется; `route: fix` зафиксирован заданием).

## Как проверялось

Принятый proof (не повторялось): `validate-gate` run 40141879067 на точном
материале `96cea9546` зелёный — классификация файлов, preflight/provenance,
Hassfest, HACS, переиспользование дерева, **геометрия: TS/Python parity
исполнена**, **фронтенд: типы/юниты/бандл-синхрон**, **бэкенд: pytest в Home
Assistant** (backend job 3м56с), **упаковка**, **браузер: выбранные проверки
push** (29 required по #1060), **продукт: свежие проверки диапазона и
упаковки**, **доказательство выполненных проверок**. Пропущены намеренно и не
требуются этой задачей: мутанты по диффу (нет ночного окна — политика §2.7),
Golden-кадры (ledger `visual` отсутствует, рендер-риска нет — новый renderer не
добавлялся), перф-смок (performance не названа в AC), шардированные browser
smokes вне push-плана (push-план уже покрывает 29 отобранных).

Адресные проверки, которые провёл я сам (чтением, без исполнения мутантов и
без патчей исполняемой реализации):

1. Прочитал полностью `custom_components/houseplan/wall_node_delete.py` (290
   строк), diff `websocket_api.py`/`const.py`, оба бэкенд-теста и
   `wall_node_delete_parity.py` — сверил с контрактом ТЗ п.1–9 построчно.
2. Прочитал `src/wall-node-delete.ts`, `wall-node-delete-menu.ts`,
   `wall-node-editor.ts` (diff), `wall-node-card-adapter.ts` (diff),
   `wall-node-refusal.ts`, `wall-node-history.ts` (diff) — сверил
   stale-identity/double-invoke/capability-gating/i18n-mapping.
3. Прочитал и прошёл руками узкий touch-фикс в `src/houseplan-card.ts:7483-7511`
   и связанный блок в `wall-node-editor.ts:123-165` (`guardEvent`/`down`) —
   воспроизвёл логику `TouchGestureClickGuard` (`src/touch-gesture-click-guard.ts`,
   не изменён) и убедился, что ранний вызов `pointerDown(id,'mouse')` —
   единственный путь снять `_postGestureClickBlocked` для правого клика ровно
   на узле (`down()` иначе перехватывает это событие раньше общего пути).
4. Прочитал `scripts/mutation-registry.mjs` diff (102 строки, 16 новых
   мутантов) и сверил все 15 id из финального хендоффа — все найдены, с
   реальными `find/replace`-патчами на существующие файлы и непустым `because`.
5. Прочитал три теста `test/wall-node-delete-menu.test.mjs`, шесть тестов
   `test/node-delete-history.test.mjs`, три параметризованных теста
   `test/wall-node-delete.test.mjs`, ключевые тесты `tests_backend/
   test_ha_wall_node_delete.py` (конкурентный CAS, forged-inverse, export/import
   roundtrip) — для каждого проверил, что ассерт действительно про отказ/
   неизменность состояния, а не тривиальный positive.
6. Прочитал полностью `demo/smoke_wall_node_delete.mjs` (все `check(...)`) —
   включая последовательность «две pinch-точки → stale `contextmenu` остаётся
   заблокирован → **без reset**, следующий реальный `rightClick` на том же узле
   открывает меню» (строки 189–211) — это и есть «fresh mouse positive» после
   «stale compatibility negative», доказанное исполнением (не мутацией): при
   отсутствии раннего `pointerDown` именно этот следующий `open()` завис бы на
   `action().waitFor()`, что ровно соответствует guard-команде
   зарегистрированного `node-delete-fresh-right-down-cannot-rearm-1045`.
7. Сверил трейлеры всех 22 коммитов, оба changelog в трёх `User-Visible: yes`
   коммитах, `docs/release-ledger/v1.82.0/1045.json`, `docs/ARCHITECTURE.md`,
   `docs/DEVELOPMENT.md`, `docs/WALL-THICKNESS.md`, `docs/CONFIG-COMPATIBILITY.md`,
   `docs/USER-GUIDE.ru.md`/`.md`, `docs/STATUS.md`, i18n (`en/ru/de/fr.json`).
8. Сверил перенос `polyIsSimple` в `src/logic.ts` с совместимым re-export из
   `resize.ts` — тело одно, второй путь не оставлен (#1014).
9. Сверил изменение `Select-only` hard cap (20276 → 21458 Б) и `hostRefs`/`raw`
   baselines в `scripts/node-editor-bundle-budget.mjs`/`monolith-baseline.json`
   с цифрами из хендоффа и `docs/DEVELOPMENT.md` — совпадают.

Для этого исследования использовал четыре параллельных ревью-агента
(backend-контракт, frontend/touch-контракт, реестр мутантов/защитные AC,
документация/трейлеры/changelog) и затем лично перепроверил каждое спорное
или неоднозначное утверждение из их отчётов, прежде чем включать его сюда (см.
«Находки» — два их утверждения не подтвердились при самостоятельной проверке).

Не прогонялось: полная регрессия/полный Golden/мутанты-исполнение (не требуются
на этом объёме задачи, §8), собственный `npm run gate:small`/`npm test` (приняты
через validate-gate 40141879067 на том же материале — повторный прогон не даёт
новой информации, §8/#857).

## Находки

**High: 0. Medium (в скоупе): 0. Medium (вне скоупа): 0.**

Два подозрения, поднятые одним из исследовательских агентов, не подтвердились
при самостоятельной перепроверке и не включены как находки:

- *«i18n-ключ `backup.error.node_delete_backend_unavailable` отсутствует в
  en/ru»* — неверно: ключ присутствует в `src/i18n/tools/en.json:80` и
  `ru.json:80` (проверено чтением), симметрично всем четырём языкам. Это
  девятый ключ сверх восьми буквально перечисленных в ТЗ, но он — точное
  зеркало уже существующего `backup.error.node_move_backend_unavailable`
  (общий паттерн резервного «backend unavailable» тоста для необработанных
  кодов), найден и закрыт автором через существующий quality-тест
  (`test_backend_quality.py`), не продуктовая двусмысленность. **Low**,
  не возвращает задачу.
- *«Нет теста на положительный сценарий „после pinch — реальный правый клик
  открывает меню“»* — неверно: такой тест есть, но структурно неявный (см. п.6
  выше, строки 189–211 `demo/smoke_wall_node_delete.mjs`). Без фикса этот же
  `open([.5, .7])` завис бы. Для ясности было бы лучше дать этой проверке
  отдельное явное имя `check(...)` вместо полагания на отсутствие `reset()`
  между блоками — **Low**, стилистическое наблюдение, не блокирует.

Прочие второстепенные (Low) наблюдения без влияния на вердикт:

- `src/wall-node-delete.py` (sic, фактически `.py` backend): выбор survivor-ID
  через `sorted(incident, key=lambda w: w["id"])` не прокомментирован в коде;
  ТЗ прямо относит этот выбор к «принято предположительно, поменять свободно»
  — не находка контракта, просто читаемость.
- Реестр мутантов содержит 16-й id (`node-delete-disabled-proof-missing-1045`),
  не упомянутый в финальной таблице хендоффа автора — лишний, не проблема
  (дополнительное покрытие, не пробел).

## Защитные AC — доказано / чем краснеет

Таблица ниже собрана мной из кода и тестов (формат хендоффа автора был
двухколоночным; я восстановил принятый протоколом трёхколоночный вид и
проверил каждую ячейку чтением, а не со слов).

| AC | Чем доказано (исполняемо) | Чем краснеет |
| --- | --- | --- |
| AC2 — степень/ownership/future-attrs/новый контакт/геометрия | Обычные TS/Python negative fixtures (`test/fixtures/1045-wall-node-delete.json`: `endpoint`, `same-ray-ambiguity`, `T`, `X-passing`, `future-attribute-mismatch`, `thickness-mismatch` — исполняются и падают по `reason`), rotated parity (160 сценариев), native disabled reason (`demo/smoke_wall_node_delete.mjs`: T-junction/thickness/opening disabled) | `node-delete-physical-degree-bypassed-1045`; `node-delete-future-attributes-discarded-1045`; `node-delete-chord-new-contact-accepted-1045` — зарегистрированы в `scripts/mutation-registry.mjs`, не исполнялись |
| AC3 — проёмы/физические поля/alias | Complete candidate/host field equality, angled/margins/unhosted refusal (`angled-opening`, `legacy-unhosted` fixtures), nested future-JSON isolation, реальный HA forged-inverse тест (`test_ha_wall_node_delete.py`, исполняемый, PASS) | `node-delete-returned-attributes-alias-before-1045`; `node-delete-server-inverse-proof-bypassed-1045` — зарегистрированы, не исполнялись |
| AC4 — ACL/CAS/queue/authority | Реальный конкурентный WS-тест `test_issue_1045_ws_atomic_concurrency_inverse_store_and_reload` (два клиента, `asyncio.gather`, один получает `conflict`) — исполняемый, PASS; native held WS/writer units | `node-delete-server-cas-bypassed-1045`; `node-delete-retired-intent-sends-after-own-queue-1045`; `node-delete-replaced-authority-reply-adopted-1045` — зарегистрированы, не исполнялись |
| AC5 — общий Undo/Redo, refused inverse сохраняет cursor | Common CommandStack units (`test/node-delete-history.test.mjs`, 6 тестов, исполняемые), exact parity inverses, native reload, backend stale-CAS/forged-inverse refusals (исполняемые) | `node-delete-refused-inverse-removes-command-1045`; `node-delete-server-inverse-proof-bypassed-1045` — зарегистрированы, не исполнялись |
| AC6 — menu/input/Properties/old backend | Реальный native right-click (Playwright `page.mouse.click`), retained command после восьми retire-контекстов, dirty/held Properties (`test/wall-node-delete-menu.test.mjs`), View/kiosk/readonly/old-backend disabled, stale-compat-negative+fresh-mouse-positive (см. «Как проверялось» п.6, исполняемо) | `node-delete-right-down-starts-pan-1045`; `node-delete-pinch-compatibility-opens-menu-1045`; `node-delete-fresh-right-down-cannot-rearm-1045`; `node-delete-chosen-intent-dies-with-menu-1045`; `node-delete-stale-properties-opening-replayed-1045`; `node-delete-nonliteral-capability-granted-1045` — зарегистрированы, не исполнялись |

Ни одна ячейка «чем краснеет» не пуста; для AC2–AC5 есть минимум по одному
реально исполняемому отрицательному тесту сверх зарегистрированных мутантов —
это сильнее минимального требования.

## Что проверено и корректно

- **Геометрический контракт (п.1–6 ТЗ).** `_classify`/`rays` дедуплицируют
  совпадающих владельцев по направлению (не по числу записей) — ровно та
  модель «coincident owners don't multiply physical rays» из
  `docs/WALL-THICKNESS.md`. `len(incident) == 2` требуется отдельно.
  Координаты A/C берутся напрямую из исходных `a`/`b`, без round/screen/grid.
  Survivor-ID — детерминированная сортировка по `id`. Несовместимость
  wall/partition и несовпадающие атрибуты (включая `bool` vs `int`, порядок
  ключей) — явный отказ через строгое `_equal`.
- **Валидация до записи (п.4, п.7).** `ws_wall_node_delete` вызывает тот же
  набор production-валидаторов, что `ws_wall_node_move`
  (`validate_wall_model_transition → CONFIG_SCHEMA → validate_opening_passages
  → node_delete_host_baseline → validate_partition_opening_hosts →
  validate_junction_limits`), всё в одной executor-job под `write_lock`;
  промежуточных `save` нет — частичная запись архитектурно невозможна.
- **CAS.** `expected_rev != rev` проверяется до любых вычислений; конкурентный
  тест подтверждает `conflict` без порчи стора.
- **Inverse-доказательство (п.9).** `node_delete_candidate(direction="undo")`
  реально пересчитывает `forward = delete_node_space(before_space, intent)` и
  сверяет канонизированный результат с текущим состоянием — не «доверяет»
  клиентскому `before_space`. Три подделанных фикстуры (future/endpoint/opening)
  и HA-тест `test_issue_1045_ws_forged_inverse_cannot_modify_foreign_data`
  проверяют именно эту защиту.
- **Проёмы (п.5).** Rehost пересчитывает `t` на новом сегменте, проверяет jamb
  margins и угол (±1e-7°), legacy-unhosted и угловые/непредставимые случаи дают
  отказ; посторонние/чужие опенинги не входят в delta.
- **Frontend lifecycle (UX-раздел ТЗ).** `WallNodeDeleteMenu.current()`
  перепроверяет revision/space/epoch/navigation/claim на каждом шаге (open →
  show → choose → send → write → render), а не только при открытии. Правый
  `pointerdown` не захватывает узел и не стартует pan/Move
  (`wall-node-editor.ts:158-165`, явный комментарий и тест). Повторный клик во
  время записи инертен (`this.menu = null` сразу при первом `choose`).
  Старый backend (`wall_node_delete_api` ≠ 1) держит пункт disabled с причиной
  `node_delete_update_required`, капабилити гейтится отдельно от Move
  (`host._haWallNodeDeleteApi === 1`, не переиспользует move-флаг).
- **Touch-совместимость (риск-класс touch).** Узкий фикс в
  `houseplan-card.ts`/`wall-node-editor.ts` подаёт реальному правому
  `pointerdown` раннее уведомление `TouchGestureClickGuard`, не трогая код
  самого guard'а и не меняя поведение для обычных touch-жестов и для
  несвязанных contextmenu-путей (вызов `handleActivation` для contextmenu
  читает только текущее состояние guard'а, без побочных мутаций, второй раз не
  вызывается из-за short-circuit `||`). `touch: best effort / intentionally
  degraded` и «отдельный long-press не добавляется» — соблюдено, long-press
  действительно не реализован.
- **i18n/терминология.** Все восемь заданных ТЗ строк (en/ru) совпадают
  дословно; `node_move_*` тексты не переиспользованы; `USER-GUIDE.ru.md`
  использует «Удалить узел»/«удаление узла стены» синхронно с ключами.
- **Трейлеры и changelog.** Все 11 non-merge коммитов несут `Issue: #1045` и
  `User-Visible: yes|no`; все три `User-Visible: yes` коммита правят оба
  changelog в том же коммите; записи RU/EN согласованы по смыслу и совпадают
  с реализацией.
- **Release-ledger.** `major` обоснован (новая пользовательская команда с
  отдельным backend-эндпоинтом, UI и документацией, не инфраструктура и не
  внутрибетный фикс) — корректно относительно предыдущего stable `v1.81.0`.
- **Bundle budget.** Поднятие Select-only hard cap (20276 → 21458 Б, без
  запаса) задокументировано в `docs/DEVELOPMENT.md` с точными измерениями на
  каждом шаге интеграции; `hostRefs`/`raw` baseline обновлены до фактических
  чисел; остальные ceiling/band/ABI/latency guard не менялись. Добавлена новая
  строгая проверка «Select-only не импортирует editor runtime facade».
- **Совместимость.** Старый `wall_node_move` API/writer не тронут
  (byte-identical путь), капабилити — чистый transport-metadata флаг вне схемы
  конфигурации, модель/версия хранения не меняются, JSON/ZIP/import/export
  используют прежнюю схему (подтверждено реальным export/import roundtrip
  тестом на 4 комбинациях kind×state).
- **Удалённый дублирующий путь (§7.2, #1014).** `polyIsSimple` перенесён
  целиком в `logic.ts` с одним телом и совместимым re-export из `resize.ts`;
  второго пути не осталось.

## Чего не проверял

- Полную регрессию, полный Golden-прогон и ночное исполнение мутантов — не
  требуются этим объёмом задачи (§8); они остаются в предрелизном/ночном
  контуре. «Caught» для 16 новых мутантов остаётся nightly unknown — это
  ожидаемо и не находка.
- Собственноручный повтор `npm run gate:small`/`npm test`/`pytest
  tests_backend` — переиспользован принятый `validate-gate` run 40141879067 на
  точном материале `96cea9546`; повторный прогон на том же материале не дал
  бы новой информации (§8, #857).
- Ручную GPU/desktop-приёмку владельцем — добровольна, её отсутствие не
  находка (#929).
- Фактическую подлинность цитаты «owner permission» про поднятие bundle-cap
  (`«сильно на размеры не заморачивайся…»`) — она приведена автором как
  решение владельца, принятое вне GitHub-треда issue (не видно в комментариях
  issue #1045, видимо — отдельный чат); я не могу её независимо подтвердить.
  Это не влияет на корректность кода: решение последовательно
  задокументировано в `docs/DEVELOPMENT.md` на каждом шаге и не затрагивает ни
  один AC или защитный инвариант — чисто бюджетный/процессный вопрос.
- Производительность (frame-budget смок) — не названа в AC, корректно
  пропущена согласно ТЗ.
- Визуальную матрицу (Golden) — `ledger.visual` не заполнен, намерения нет;
  риск-классификация `render=false/ui=false` в push-плане соответствует тому,
  что PDF/Flat/2.5D-рендер не меняется (AC7 закрыт чтением существующих
  проекций + целевой assertion на painted span, как и требует метод
  доказательства AC7 в самом ТЗ).

## Побочные находки (REVIEW_FINDINGS_POLICY, mode=issues)

Снимок политики: `mode=issues`. Побочных Medium-находок вне скоупа #1045 не
обнаружено — новых issue не заводится.

## Вердикт

Зелёный. High: 0, Medium: 0. AC1–AC7 доказаны (AC1–AC6 исполняемыми тестами с
подтверждённой способностью падать; AC7 — чтением существующих разделяемых
проекций плюс целевой browser-assertion, как и предписывает метод доказательства
в самом ТЗ). Трейлеры, changelog, release-ledger, канонические документы и
bundle-budget корректны и согласованы. Маршрут — `fix` (задан заданием).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1045-node-delete`, коммит `96cea9546fbf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d96b19bc23f5efdb13866ab9a64e6964a84b4674`
  ```
  git log --all --format='%H %T' | grep d96b19bc23f5
  ```
- Тело issue: `6baaac76e880992571786aa5a9483ef4c7c1e60692696b78754853a410069a3f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzOTIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDg3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyNzQsIm91dHB1dF90b2tlbnMiOjExNzc0NywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo0NTYzMzAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjkwMzcyNiwiY29zdFVzZEVzdGltYXRlIjo1LjIwMzU3NTE5OTk5OTk5OTV9XSwidHVybnMiOjc1LCJkdXJhdGlvbk1zIjo3NDk0MzQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo1LjIwOTA2MjIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5666 output_tokens=117766 cache_creation_input_tokens=456330 cache_read_input_tokens=12903726 num_turns=75 -->
