# SPEC-REVIEW-1161-r1

## Материал раунда

- Issue: #1161, этап `spec`, трек `ask`, заход r1 (первый цикл), блокирующих циклов 0/4.
- Тело issue (материал ревью): commit `7e5348926755347592e8df60cb623b9b7982b87d`,
  tree `67048d8cbf6b032a418aa9f15928cf741d345ee8`,
  bodyDigest `sha256:7580433ec4a78d572982ff221160420c66b5638e5cc3ed0746cf1ec1510096eb`
  (из REVIEW_CONTEXT, статический снимок; `changedFiles: []` — продуктового кода в этой задаче ещё нет).
- Источник ТЗ — раздел `## ТЗ` тела issue #1161 (owner decision #517, `docs/specs/` не используется).
- Учтены два авторских комментария: оценка/трек (`6531754974`), отчёт механического preflight
  с двумя находками по отсутствующим разделам «До и после»/«Не-скоуп» и двум AC без названного
  способа доказательства (`6531788364`), и подтверждение их устранения (`6531814057`). На момент
  этого ревью тело issue уже содержит оба раздела отдельными заголовками и явный способ
  доказательства у AC3/AC4 — преflight-находки закрыты в самом материале.

## Скоуп

Регрессия производительности прогретого переключения этажей в Просмотре (J1 `docs/SCOPE.md`):
#1093 сузил `RenderSnapshotReuseWindow` до текущего этажа и добавил `_space` в source key ради
изоляции скрытых потребителей, но тем самым свёл окно к одному слоту — каждый возврат на уже
открывавшийся этаж теряет прежний capture и строит все device presentations заново (Full
Performance 41112543376 красный по `longTask.countP95` в трёх профилях). ТЗ просит ограниченный
per-floor reuse (до 8 удерживаемых слотов, LRU) той же самой реализации guard'ов, без нового
алгоритма capture, без изменения публичного API, UX, i18n или модели данных.

## Как проверялось

Этап `spec`: кодовый Validate не требуется, `tsc`/`build`/`npm test`/`gate:small` не запускались —
по явному `ciEvidence`-примечанию в REVIEW_CONTEXT и политике ревью ТЗ. `run_check` не вызывался:
не нашлось ни одного конкретного непокрытого вопроса, который оправдывал бы адресное исполнение —
каждое техническое утверждение ТЗ проверено независимым чтением существующей реализации (ниже).

Независимо от авторских выводов прочитаны вызывающие пути и инварианты, которые эта задача
меняет или на которые опирается:

| Утверждение/опора ТЗ | Проверено по | Результат |
|---|---|---|
| Текущая реализация — один слот, `_space` входит в source key, guard'ы (source/presentation/row/light) и cloning/fail-open уже существуют и именно их просит "не ослаблять" | `src/render-snapshot-reuse.ts` целиком (`RenderSnapshotReuseWindow`: `sources`/`inputs`/`deps`/`lightDeps`/`built`/`lend`/`track`) | подтверждено — ТЗ точно описывает код, который есть сейчас, а не воображаемую архитектуру |
| `_space` — ключ текущего этажа, опциональный только для legacy/test-вызовов | `src/render-snapshot-capture.ts:41` (`_space?: string`); реальная карточка: `src/houseplan-card.ts:1076` (`private _space = 'f1'`), `:1747` (`this._space = id`) — всегда конкретный этаж, `undefined` в реальном View не встречается | подтверждено: п.1 контракта «отсутствие floor ID — для legacy/test» не притворяется продуктовым сценарием |
| «Не более 8 слотов, LRU, вытеснение самого давнего» — реализуемо и уже есть прецедент в кодовой базе («как текущий bounded floor-model cache», комментарий автора) | `src/demand-space-models.ts` (`DemandSpaceModels`, `limit=8`, `Map` с `delete()`+`set()` на каждом обращении и `while (size>limit) delete(oldest)`) — буквально тот же паттерн, уже используется для этажей | подтверждено: предлагаемый лимит и механизм не новы для проекта и реализуемы без изобретения новой структуры данных |
| «Нового публичного продукта/диагностического API не требуется», счётчики суммируют работу всех слотов без записи в приватные поля | `src/live-interaction-runtime.ts:51,56-59` (`public readonly capture = new RenderSnapshotReuseWindow()`; `public work(): Record<string, number> { return {...this.capture.stats, ...} }`) — уже публичный, уже используемый путь чтения счётчиков | подтверждено: оборачивание `capture` в тонкий per-floor owner не требует нового публичного метода — `work()` просто делегирует суммарный `stats` |
| «reset не скрывает уже выполненную работу» | `src/render-snapshot-reuse.ts:208-224` (`reset()` не трогает `this.stats`) — уже так сегодня | подтверждено, согласуется с контрактом п.5 |
| «reset/disconnect очищает все удерживаемые слоты» — согласуется с единственной текущей точкой вызова | `src/live-interaction-runtime.ts:134-141` (`dispose()` → `this.capture.reset()`, один вызов) | подтверждено: при превращении `capture` в owner с N слотами один вызов `reset()` естественно транслируется в очистку всех слотов — не требует новой точки интеграции в `houseplan-card.ts` |
| «production-bundle smoke/counter witness» — не изобретённый термин, а существующая практика | `scripts/smoke-links.mjs` — десятки существующих сценариев, явно описанных как `production-bundle` (например #867, #876, #654, #490) | подтверждено: AC1/AC5 ссылаются на реальный, уже применяемый класс свидетелей |
| «companion task-impact» вердикт для HA/E2E — реальный, уже используемый механизм, а не новая процедура | `docs/analysis/1093-selective-invalidation-2026-10-28.md:341` — ссылка на `task-impact/houseplan-card-1093.md` в репозитории `houseplan-e2e`, уже применялась для #1093 | подтверждено: формулировка «новый HA-сценарий не нужен… вердикт отдельно в companion task-impact» корректно переносит решение в уже существующий канал, а не оставляет вопрос без ответа |
| Инвариант «Snapshot reuse keys include the display roster and choice; its live updates equal a complete capture» (`docs/DEVICE-PRESENTATION.md:295-296`) не ослабляется | ТЗ п.3: «Разрешено reuse только при тех же доказательствах, что у одиночного окна» — `showUserHidden`/`host._showHidden` уже часть `inputs` (`render-snapshot-reuse.ts:126`) | подтверждено: канонический документ подсистемы и контракт ТЗ не расходятся |

Отдельно разобран один технический момент, не вынесенный ТЗ в открытый вопрос, но требующий
явного решения на этапе реализации: что именно считается «доступом», обновляющим LRU-very —
только reuse-попадание или любой `begin()` для данного этажа (включая холодный/full capture).
Единственный прецедент в кодовой базе (`DemandSpaceModels.read`) обновляет позицию в `Map` при
**любом** обращении, попадании или промахе (`delete` + повторная `set` внутри `full()`
независимо от того, пересчитан ли `SpaceModel`). Это технический вопрос (не продуктовый — не
меняет ничего, что видит пользователь), и по §7.1 его решает ревьюер по существу, а не владелец:
решение — «любой `begin()` по этажу обновляет recency», оно согласуется с единственным
существующим прецедентом ограниченного кэша в проекте и с духом контракта п.2 («доступ
обновляет LRU», без оговорки «только удачный reuse»). Находки это не образует.

## Находки

Находок нет: High — 0, Medium — 0, Low — 0.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют и заполнены по существу отдельными заголовками:
  сценарий и результат для пользователя; «До и после»; проблема и скоуп; «Не-скоуп»
  (явно исключает #1159/#1160 и смежные неизменяемые протоколы); контракт поведения и модель
  данных (5 пронумерованных пунктов, включая явное «persisted data отсутствуют» — миграция не
  нужна и обоснованно не нужна); UX/i18n/права (явное «новых строк и контролов нет»); критерии
  приёмки AC1…AC5, у каждого назван наблюдаемый результат и способ доказательства; план
  автотестов; риски и откат; release-артефакты. Преflight-замечания из комментария
  `6531788364` (отсутствующие разделы, AC3/AC4 без метода доказательства) в текущем теле issue
  устранены — проверено повторным чтением самого тела, а не со слов автора.
- Каждый AC называет конкретный, уже существующий класс свидетеля (unit/work-counter тест,
  differential oracle, именованный файл будущего теста, именованные npm-скрипты бенчмарка,
  gate:small/product units/конкретные смоки и Golden) и явно отделяет его от недостаточного
  доказательства (AC4 прямо запрещает заменять gate диагностическими CPU-профилями, single
  sample и локальным correctness probe; AC1 запрещает подменять нужный reuse пропуском
  capture/consumer isolation).
- Защитные AC проверяемы по существу: AC2 (актуальность) и AC3 (границы/lifecycle) обе называют
  конкретный провоцирующий сценарий (visible/hidden HA-изменения, 9-й floor/LRU eviction,
  reset/disconnect, незавершённый `begin`) — то есть у каждой есть явный негативный случай,
  которым соответствующий будущий тест обязан падать на старом/ослабленном коде, а не просто
  «способ доказательства» без падающего сценария.
- Лимит «8 слотов» и механизм LRU не являются произвольным числом или новой идеей: совпадают
  с уже действующим в проекте ограниченным per-floor кэшем (`DemandSpaceModels`, лимит 8) —
  решение согласовано с существующей архитектурой, а не изобретает параллельный примитив.
- Сохранение существующих guard'ов «без ослабления» реализуемо технически: «тонкий
  владелец/обёртка и приватный leaf-класс» вокруг уже написанного `RenderSnapshotReuseWindow`
  не требует изменения ни одного из уже протестированных источников/presentation-ключей.
- Технических вопросов, оставленных владельцу без ответа, в тексте нет; единственная найденная
  при независимой проверке техническая неопределённость (семантика «доступа» для LRU) решена
  выше по существу, согласно существующему прецеденту, и не требует эскалации.
- Release-артефакты корректно ссылаются на существующий, уже использовавшийся для #1093 канал
  companion task-impact для HA/E2E-вердикта, а не оставляют его неопределённым.

## Чего не проверял

- Продуктовый код не существует (`changedFiles: []`), поэтому код-ревью, автотесты,
  `gate:small`, golden и Full Performance не входят в этап `spec` и не запускались — это
  соответствует политике «кодовый Validate на этапе spec не требуется».
- Классификация release-ledger (`category=line-fix`, `introducedBy=#1093`, `baseStable=v1.82.0`)
  — это авторское суждение, которое проверяется на код-ревью относительно реального диффа;
  на этапе ТЗ она выглядит обоснованной (регрессия действительно введена #1093 против v1.82.0),
  но финальная сверка требует самого коммита.
- Трейлеры `Issue:`/`User-Visible:` и фактическое наполнение обоих changelog не проверялись —
  кода и коммитов ещё нет.
- Поведение будущего `test/render-snapshot-floor-reuse.test.mjs` не исполнялось (файла не
  существует — подтверждено `Glob`) и не могло исполняться на этом этапе; его падение на
  неослабленном/неполном коде будет предметом код-ревью.
- Ручная dev/GPU-приёмка не требовалась и не выполнялась (`docs/process/REVIEWER.md`, #929).

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `tsc`/`build`/`npm test`/`gate:small` | нет | этап `spec`; кодового материала нет, явная политика ревью ТЗ не запускать их |
| `run_check` (любой executable check из манифеста) | нет | ни один пункт ТЗ не остался с непокрытым вопросом, требующим исполнения; все технические опоры ТЗ проверены чтением существующей реализации (таблица выше) |
| Чтение базовых файлов/символов, на которые опирается ТЗ | да | `src/render-snapshot-reuse.ts`, `src/render-snapshot-capture.ts`, `src/live-interaction-runtime.ts`, `src/demand-space-models.ts`, `src/houseplan-card.ts` (точки `_space`), `scripts/smoke-links.mjs`, `docs/DEVICE-PRESENTATION.md`, `docs/analysis/1093-selective-invalidation-2026-10-28.md`, тесты `test/render-snapshot-incremental.test.mjs`, `test/render-snapshot-consumers.test.mjs`, `test/presentation-light-frame.test.mjs` |

## Вердикт

Зелёный. High: 0, Medium: 0. Route: `fix`. Маршрут публикации — `mode: issues`
(`REVIEW_FINDINGS_POLICY` совпадает со встроенным доверенным снимком); побочных находок вне
скоупа нет, `outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImNjNjgwMmY4ZWRhZGJlNjYyMjc3ZmM1NWEyOWRmZmMzZThkNDcyMzYyMWRiZTg4ODIxYzU0MzAwMzZhMGQ3ODYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhMTU1MGMwMjZlN2QyM2E1MzRiNzYyMzFkZWM3MmE5ZDk2YjA4OGNhYTNlMWFmNWUzZDY4MTgzNDU3MWU0NzcwIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTYxLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI3ZTUzNDg5MjY3NTUzNDc1OTJlOGRmNjBjYjYyM2I5Yjc5ODJiODdkIiwidHJlZSI6IjY3MDQ4ZDhjYmY2YjAzMmE0MThhYTlmMTU5MjhjZjc0MWQzNDVlZTgiLCJib2R5RGlnZXN0IjoiNzU4MDQzM2VjNGE3OGQ1NzI5ODJmZjIyMTE2MDQyMGM2NmI1NjM4ZTVjYzNlZDA3NDZjZjFlYzE1MTAwOTZlYiIsInByb2R1Y2VyUnVuIjoiNDExMTYxNTAzNjUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjIwN2E1YTg5OTUzNjJjYjg5NGM0MWQ1YmRmNThjNzBlYWM5ZjNiZGY1ODc5ZmM1ZjM0ZDVmOTdiYTExZTc4NzIiLCJ2ZXJkaWN0RGlnZXN0IjoiODI3MGExYWM0NmY4OTlhMTJjNTc3ZGIyOTBjMTFkYjQxN2Q3MzM2NzU0ZjZmZjg2NmQxYWMyNzgxMTJjNDMxNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiMTcyZjI4MmZiZWQzZDhkY2VhZjJhY2E0Mjg3ZjFhNDE3NDc2Nzk0ZmQzMTUyMWQxYWIxN2ZmYzE4ODNhOWY5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTMyMDE0ODI2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTYxI2lzc3VlY29tbWVudC02NTMyMDE0ODI2IiwiYm9keURpZ2VzdCI6ImE5OGZiZjQ2YzJlZjJhMGZhMTc2NzIxZDFmZTA3OTk0MWFjYjRmOTdhMDE3ZWZmNmRkY2Q4YTQ1YWZmMDFiNGIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `7e5348926755` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `67048d8cbf6b032a418aa9f15928cf741d345ee8`
  ```
  git log --all --format='%H %T' | grep 67048d8cbf6b
  ```
- Тело issue: `7580433ec4a78d572982ff221160420c66b5638e5cc3ed0746cf1ec1510096eb`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODQsIm91dHB1dF90b2tlbnMiOjM4NTgyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MjE4OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM1OTQ3MjgsImNvc3RVc2RFc3RpbWF0ZSI6MS42NzM2ODU1OTk5OTk5OTk4fV0sInR1cm5zIjo1NywiZHVyYXRpb25NcyI6NDkwNzE3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42NzM2ODU1OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=84 output_tokens=38582 cache_creation_input_tokens=142188 cache_read_input_tokens=3594728 num_turns=57 -->
