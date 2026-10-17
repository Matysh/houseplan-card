# SPEC-REVIEW-942-r1

Issue: #942 — «Расширенная диагностика через „Помощь и обратная связь“».
Этап: ревью ТЗ (PROCESS.md §2.4). Трек: `ask`. Заход r1 · блокирующих циклов
израсходовано 0 из 4.

Материал: тело issue `#942`, раздел `## ТЗ`, редакция 1. Дерево материала
`12ff505aca4d6e2bacb532588621e5bffd1cd3ab`, `bodyDigest:
3902312fa9ea3407447bf2ea368a2344beab6db23c1388549e2980a2adc15f2e`
(из `REVIEW_CONTEXT`, сверено побайтово с телом, полученным
`gh issue view 942 --json body`). Архивного `docs/specs/942-*.md` нет и не
создаётся — ТЗ живёт только в теле issue (#517). Три комментария автора
(claim · аналитика · «Сделано») прочитаны с GitHub напрямую.

Побочные находки: политика `mode=issues` (снимок
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`, round 1) — побочных находок нет,
отдельных issue не заводилось; всё найденное — в пределах §6 таблицы самого
#942.

## Скоуп

J1/J6 (`docs/SCOPE.md`): обслуживание уже работающего пространственного
интерфейса через существующий диагностический канал Help & feedback, не
новая поверхность и не history/CAD/3D-функция. Задача прямо исключает рендер,
маршрутизацию робота, историю/лог HA, DOM/screenshot, устройства/HA registry,
Zigbee topology snapshot и radar heatmap/history — это ровно то, что
`docs/SCOPE.md` относит либо к «Out of scope», либо к узким, уже одобренным
исключениям (#485 radar, #935/#940/#918 — потребители, не дубликаты). Ручная
dev/GPU-приёмка владельцем корректно не требуется (#929, 2026-10-16).

## Как проверялось

Порядок по `AGENTS.md` «Reading order by role»: `docs/SCOPE.md` → `AGENTS.md`
→ `docs/process/REVIEWER.md` → тело issue #942 и три его комментария → канон
подсистем, которые ТЗ намерено затрагивает: `docs/VACUUM.md`, `docs/RADAR.md`,
`docs/LIGHT.md`, `docs/FILTERING.md`, `docs/DEVICE-PRESENTATION.md`,
`docs/SUPPORT-PRIVACY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`.

Продуктового диффа по #942 нет (автор прямо пишет «продуктовый код не
менялся»), поэтому гейты прогонялись как проверка текущего `dev` (материал
ревью — текст, а не код), а не как проверка реализации задачи:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` (после `npm ci`, `node_modules` отсутствовал) | PASS, 0 ошибок |
| unit/backend-JS | `npm test` | 5137 тестов, 5136 pass, 1 skipped, 0 fail |
| build | `npm run build` | PASS, бандл собран (`tsc --noEmit && rollup -c`) |
| механический формат ТЗ | `specFormatErrors(body, 'ask')` из `scripts/review-preflight.mjs`, вызван напрямую на теле issue | `[]` — обязательные разделы, контигуентная нумерация AC1…AC10 и названный способ доказательства у каждого подтверждены машиной |

`pytest tests_backend`, HA harness, relay-тесты, golden, smoke, performance,
`npm run invariants` не прогонялись: продуктового Python/TS-диффа по #942 нет,
это гейты этапа code-review на фактическом коде, а не текста ТЗ. Автор уже
привёл baseline `pytest -q tests_backend/test_support_package.py` → 23 passed
— это подтверждает текущую (v1) политику, не полноту будущей v2-реализации,
и ревью её так и трактует.

Отдельно проверялась фактическая обоснованность утверждений ТЗ о текущих
контрактах подсистем (чтение, не исполнение) — не домыслена ли реализация,
которую текст выдаёт за уже существующий факт:

| Утверждение ТЗ (§6/§7) | Проверка | Результат |
|---|---|---|
| Статусы источника пылесоса `ok/missing/disabled/unavailable/unverified/unsupported/none` | `docs/VACUUM.md` «Source resolution and diagnostics» | подтверждено дословно |
| Результаты `resolveRoute()` `ready/needs_calibration/unmapped/ambiguous/missing_space/none` | `docs/VACUUM.md` «Maps and floors» | подтверждено дословно; ТЗ отдельно оговаривает, что остальные ~15 причин §7.3 — новые **наблюдательные** диагностические поля, «не новая ветка разрешения renderer-а» — формулировка сама снимает риск спутать их с реальным возвратом `resolveRoute()` |
| Radar: персистентные `profile/units/mount/room/calibration/source refs`, без targets/tracking IDs/occupancy history/heatmap | `docs/RADAR.md` (конфигурация vs observations) | подтверждено |
| `settings.glow`/`glow_radius_cm`, sun flags, единый резолвер fill/glow | `docs/LIGHT.md`, `docs/SUN.md` | подтверждено, «не второй light engine» соответствует фактическому единому resolver'у |
| `marker.hidden`/`marker.removed` (tombstone), `bindingStatus: ha_disabled`, lifecycle `on_plan/available/hidden/readd`, `unverified` | `docs/FILTERING.md` | подтверждено дословно |
| `opening.contact`/`opening.lock`, `host:{kind,id,t}` | `docs/FILTERING.md`, `docs/WALL-THICKNESS.md` | подтверждено |
| `display`/`activity`/`value_source`/`value_badge`/`controls`/`tap_*`/«secure no-op» | `docs/DEVICE-PRESENTATION.md`, `docs/SCOPE.md` («lock invariant») | подтверждено |
| `room.settings.temp_min/temp_max` с наследованием | `docs/CONFIG-COMPATIBILITY.md` | подтверждено |
| `support_api` capability, relay-хост, TTL10 мин, retention 30д/24ч | `docs/SUPPORT-PRIVACY.md`, `custom_components/houseplan/websocket_api.py`, `src/version-recovery-card.ts` | подтверждено |
| Терминология UI (`support.attach`, Show data/Download JSON/Refresh, «Помощь и обратная связь») | `src/i18n/support/{en,ru}.json`, `docs/USER-GUIDE.ru.md` | подтверждено, v2-формулировки в ТЗ — явно новые, не выданы за уже существующие |
| Сводная панель: `panel/blocks/values/scope/source`, **«effective show/mobile/size visibility»** | `docs/specs/505-summary-panel-design-parity.md` | **частично не подтверждено** — см. находку M1 |

## Находки

### Medium (в скоупе, возврат автору) — M1: несуществующее поле «size visibility» у сводной панели

**Файл:** тело issue #942, раздел §6, строка таблицы «Сводная панель».

Текст ТЗ требует переносить в диагностику «effective show/mobile/**size**
visibility» для сводной панели (#437) — то есть заявляет «size» как реальное
наблюдаемое/эффективное свойство блока или значения панели, наравне с `show`
и `mobile`.

Единственный источник контракта панели — `docs/specs/505-summary-panel-design-parity.md`
(архивный ТЗ до #517, панель не имеет отдельного канонического файла из
списка `AGENTS.md`). Он прямо утверждает обратное: AC7 этого документа —
«Size controls absent; old scale values preserved for admin and local-only
paths» (строка 228), а раздел «Release artifacts» перечисляет изменения
документации как «control placement, layout, mobile dependency, **removed
size controls**» (строка 268). Текущий код (`src/summary-panel-editor-style.ts`
и соседние файлы) не содержит персистентного поля `size` для блока/значения
панели — размерные контролы были удалены как продуктовое решение, а не
скрыты. `show` и `mobile` как раздельные effective-флаги видимости
подтверждаются тем же документом (строки 77–80, 138).

Это утверждение о поведении системы, которого нет ни в одном документе, и
оно не помечено в тексте ТЗ как предположение — классический случай
«догадка, записанная как факт» (PROCESS.md §7.1). Для реализации это не
абстрактный риск: AC3 прямо требует «parametrized backend+unit fixtures по
каждой строке §6», то есть по этой строке должен появиться тест на
«эффективную видимость по размеру» для сущности, которая была осознанно
удалена из продукта на #505. Исполнитель либо потратит время на
реконструкцию несуществующего понятия, либо придумает собственное
толкование «size» прямо в коде — без утверждения владельца/ревьюера, что
именно считается корректным.

**Как правится:** одна правка текста — убрать «size» из перечня для «Сводная
панель» (оставить «effective show/mobile visibility»), либо, если имелось в
виду что-то другое (например, число активных блоков/значений, а не
размерный контрол), явно назвать это другим термином и сослаться на
`docs/specs/505-summary-panel-design-parity.md`. Это правка ТЗ, не
реализации, и остаётся в рамках того же AC3/§6 — отдельный issue не
заводится.

## Что проверено и корректно

- Обязательные разделы PROCESS.md §7.1 присутствуют и в правильном порядке:
  сценарий (§1) · что человек увидит до/после (§2) · проблема (§1/§2) · скоуп
  и не-скоуп (§3) · UX (§4) · контракт/формат/приватность (§5) · модель
  данных, совместимость, выкладка, откат (§10) · i18n (§11) · AC1…AC10 с
  доказательством (§12) · план автотестов и release-артефакты (§13) · риски и
  «принято предположительно» (§14). Механическая проверка
  `specFormatErrors(..., 'ask')` подтверждает это нулём ошибок независимо от
  ручного чтения.
- Каждый AC1–AC10 называет способ доказательства (unit/backend/HA
  harness/browser smoke/relay staging) и явный отрицательный
  случай/негативный тест в том же столбце — защитные AC (AC5, AC8, AC9, AC10)
  не оставляют пустой третий столбец «чем краснеет».
- Открытых продуктовых вопросов владельцу не осталось: раздел «Принято
  предположительно» (§14) содержит только действительно технические решения
  (раскладка файлов, имена внутренних типов, алгоритм bounded sampling) —
  ни один пункт не определяет видимое пользователю поведение, которое стоило
  бы выносить владельцу как продуктовый вопрос (PROCESS.md §7.1,
  «смешанный вопрос делится, а не эскалируется целиком»).
- Приватностные границы (§5) согласованы с `docs/SUPPORT-PRIVACY.md`: формат
  `houseplan-support-package`, TTL/retention/host/redirect-refusal не
  меняются, расширение явно остаётся allowlist/enum-only, запрет на сырые
  provider-ответы и Zigbee topology snapshot сохранён дословно.
- Критичный для исходного примера #918/#940 путь — различимость причины
  отказа текущего маршрута при совпадающем map ID и run без `route_id` —
  закреплён отдельным явным требованием (§7 п.7) и привязан к AC1/AC2 с
  конкретным позитивным/негативным сценарием, а не абстрактной формулировкой.
- Версионирование API (`support_package_versions:[1,2]`, явное advertisement,
  честный `support_api` capability, никакого молчаливого отката v2→v1) —
  согласовано с реальным существующим `support_api` capability-полем и не
  меняет контракт `support_api=1`.
- Touch/responsive требование (§4, «Телефон360px… без overflow») соответствует
  `docs/TOUCH-SUPPORT.md` — Help-диалог относится к «View dialogs», которые
  полностью поддерживаются на touch, а исключение формы из kiosk — рамки
  задачи не расширяет.
- Классификация release («major относительно v1.81.0», milestone 1.82 после
  реализации) соответствует фактическому последнему stable-каталогу
  (`docs/release-ledger/v1.81.0/`).
- Бюджеты/лимиты (§9) — новые числовые ограничения диагностики (≤512 KiB
  input, ≤2 MiB diagnostic section, bounded collections) не снижают и не
  меняют действующие attachment/request-лимиты из `docs/SUPPORT-PRIVACY.md`.

## Чего не проверял

- Не исполнялись `pytest tests_backend` (полный), HA harness
  (`test_ha_*.py`), relay unit/staging-тесты, golden, performance,
  `npm run invariants` — продуктового Python/TS-диффа по #942 нет, это
  гейты этапа code-review на фактическом коде, не предмет spec-ревью.
  Названный автором baseline (`pytest -q tests_backend/test_support_package.py`
  → 23 passed) принят как контекст текущей v1-политики, не как доказательство
  будущей реализации.
- Не проверялась реализуемость конкретных формул/алгоритмов (bounded
  sampling, affine-эквивалентность геометрии, executor lease) построчно
  против существующего кода — ТЗ само относит это к «принято
  предположительно», корректность реализации проверит код-ревью по
  фактическому диффу.
- Не проверялись ~15 новых диагностических кодов причин пылесоса (§7 п.3:
  `drawable/hidden/static_display/.../runtime_unavailable`) на предмет
  однозначного триггера для каждого из них по отдельности: ТЗ явно называет
  их «наблюдательными, не новой веткой разрешения renderer-а» и привязывает
  обязательное наблюдаемое поведение только к конкретным сценариям #918/#940
  и к общему свойству «несколько причин — список, а не угаданная единственная»
  (AC4) — точное имя каждого внутреннего кода признано техническим решением
  наравне с прочими из §14 и не поднято как отдельная находка.
- Не проверялись DE/FR-локали поштучно — ТЗ ссылается на штатный процесс
  (`CONTRIBUTING.md` «Translations»), который реально существует и не
  требует отдельного рассмотрения на этапе ТЗ.
- Не проводилась ручная dev/GPU-приёмка владельцем — добровольна и не
  является гейтом (#929, 2026-10-16).
- Не проверялась работоспособность staging/prod relay-выкладки (§10 п.4) —
  она описана как шаг после S8, вне материала этого ревью.

## Вердикт

Единственная находка (M1, «size visibility» сводной панели) — Medium, в
скоупе того же AC3/§6, правится одной фразой текста ТЗ без продуктового
решения владельца. High-находок нет. Остальная часть ТЗ — редакция 1 зрелая:
обязательные разделы полны, каждый AC проверяем и называет способ
доказательства и отрицательный свидетель, технические утверждения о текущих
контрактах подсистем подтверждаются кодом и каноном, продуктовых вопросов
владельцу не осталось.

`Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `b45aa0f57066` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `12ff505aca4d6e2bacb532588621e5bffd1cd3ab`
  ```
  git log --all --format='%H %T' | grep 12ff505aca4d
  ```
- Тело issue: `3902312fa9ea3407447bf2ea368a2344beab6db23c1388549e2980a2adc15f2e`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MDYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njk2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMzQsIm91dHB1dF90b2tlbnMiOjUzNDM2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIwOTIyNSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY3NDIxOTYsImNvc3RVc2RFc3RpbWF0ZSI6Mi42NjgxNTg2OTk5OTk5OTk4fV0sInR1cm5zIjo2NSwiZHVyYXRpb25NcyI6NzE1NzY1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi42NzI4NTQ3LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4740 output_tokens=53454 cache_creation_input_tokens=209225 cache_read_input_tokens=6742196 num_turns=65 -->
