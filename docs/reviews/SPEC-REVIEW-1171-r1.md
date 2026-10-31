# SPEC-REVIEW-1171-r1

Issue: #1171 — «Статическая карточка: не отображаются двери в стенах комнат»
Этап: spec (ревью ТЗ, PROCESS.md §2.4) · Трек: `ask` · Заход: r1 · Блокирующих циклов: 0/4
Материал: тело issue #1171, `bodyDigest: e20fd105416df5f2ec19cda94677f9fbbb9a872ee993182416314ca4f2d0dfc0`
(SHA/tree контекста: `5d9ca27e6dc6321bd75252347896ddea43562060` / `c013e2a862d0243137a0f45859b62b800fed6b7e`)

Маршрут вердикта: `fix` (директивно для данного этапа/раунда, #726).

## Скоуп

Статическая карточка `houseplan-space-card` не рисует двери, привязанные к
стене комнаты (`host.kind=wall`) — только партиционные (`host.kind=partition`).
Задача обслуживает J1/J4/J6 (`docs/SCOPE.md`): компактная схема должна
достоверно показывать сохранённую архитектуру и её состояние. ТЗ фиксирует
исправление согласованной проекции door/window/gate/passage в Static для
room-wall, partition и legacy-записей: символ, физический вырез/тоннель,
frame (`content`/`house`) и cache invalidation — при сохранении контракта
полного плана, read-only поведения Static и партиционного/passage-пути как
обязательных регрессионных соседей. Новый тип проёма, редактирование в
Static, миграция геометрии и выпуск беты — явно вне скоупа.

## Как проверялось

Прочитаны один раз: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
тело issue #1171 (все три страницы `REVIEW_CONTEXT`, включая авторские
комментарии 2026-10-31 — аналитика, занятие в работу, публикация ТЗ и два
раунда устранения механических замечаний «Name the evidence method» по
AC2/AC5/AC6). Дополнительно для терминологии и осуществимости —
`docs/USER-GUIDE.ru.md` (§18 «Статическая карточка пространства» и абзац про
Glow/проходы) и `docs/WALL-THICKNESS.md` (терминология room-wall/
partition-hosted/hosted-opening).

Кодовый Validate на этапе spec не требуется; материал ревью — текст ТЗ, а не
диапазон коммитов (`changedFiles: []`). Адресные проверки осуществимости —
чтением текущего `dev` на зафиксированном SHA, без исполнения (вопросы
касаются структуры существующего кода, а не его поведения под нагрузкой или
входом, так что исполнимый oracle здесь не соразмерен):

1. **Вопрос:** действительно ли `resolvedHosted`/`hostedOpeningSymbols` в
   `space-render.ts` отфильтровывают `host.kind=wall`, как заявляет
   «Причина и затронутые места»? **Результат:** подтверждено чтением —
   `resolvedHosted` на `src/space-render.ts:387-396` возвращает `[]` для
   всего, кроме `opening.host?.kind === 'partition'`; `hostedOpeningSymbols`
   (строки 931-932) строится исключительно из `resolvedHosted`; frame-цикл
   `fit: house` (строка 519) использует тот же список. Симптом и причина —
   не домысел.
2. **Вопрос:** существует ли уже чистая общая проекция, на которую ТЗ
   предлагает переключить Static («geometryOpenings/geometryRoomOpeningInputs»)?
   **Результат:** да — `src/plan-geometry-preflight.ts:211-243` определяет
   `geometryOpenings`, которая уже одинаково резолвит `host.kind=wall`
   (ранний возврат raw x/y/length, строка 229) и `host.kind=partition`
   (через `resolvePartitionOpeningCompat`); полная карточка уже использует
   её в `_renderOpenings` (`src/houseplan-card.ts:8737`). Направление
   исправления, предложенное в ТЗ, не гипотетическое — общий путь уже есть
   и уже служит эталоном «что видит полная панель» для AC1.
3. **Вопрос:** существует ли уже общая математика стороны/грани, которую
   Контракт п.2 запрещает копировать отдельно в Static? **Результат:** да —
   `houseplan-card.ts:8759-8768` (`_openingFace`) — тонкая обёртка вокруг
   двух уже экспортированных чистых функций: `partitionOpeningFace`
   (`src/partition-openings.ts:153`, уже используется в Static) и
   `openingInnerFaceOffsetFromIndex` (`src/wall-thickness.ts:4640`, уже
   используется независимо от класса карточки в `src/iso-scene-render.ts`
   для 2.5D). Отдельная копия алгоритма не требуется технически — запрет
   в Контракте п.2 исполним, а не декларативен.
4. **Вопрос:** соответствует ли предпосылка AC7 («устаревшее ограничение
   Static в USER-GUIDE») реальному тексту документа? **Результат:** да —
   `docs/USER-GUIDE.ru.md:1584-1586`: «Отображение уже существующих дверей,
   окон и ворот в Static в рамках этой функции намеренно не менялось» —
   дословно та историческая граница, которую ТЗ просит актуализировать.
5. **Вопрос:** названы ли в AC2/AC5/AC6 существующие тестовые файлы/smoke, а
   не вымышленные пути (после правки по механическому замечанию)?
   **Результат:** `test/partition-openings.test.mjs`,
   `test/opening-symbol-placement.test.mjs`, `test/room-opening-host.test.mjs`,
   `test/space-render-caches.test.mjs`, `test/space-card-fit.test.mjs`,
   `demo/smoke_open_passage.mjs`, `demo/smoke_space_card_identity.mjs` — все
   существуют. `demo/smoke_static_wall_openings.mjs` (AC5) ещё не существует —
   ожидаемо, это новый smoke, создаваемый в реализации, а не ложная ссылка на
   нереализованный код.
6. Кэш-контракт п.6 (структурный fingerprint, ограниченный пул, без
   перестройки топологии по HA tick) сверен с уже существующим паттерном в
   `test/space-render-caches.test.mjs` (fingerprint-ключи,
   `lruWrite`/eviction) и с реальным кодом `cachedStaticWallGeometry`/
   `wallGeometryFingerprint` (`space-render.ts:453-482`) — контракт описывает
   расширение существующего механизма, а не новый.

Полные build/test гейты (`tsc`, `npm test`, `gate:small`, golden) не
запускались — материал ревью не содержит диффа кода, а отсутствие CI на SHA
документа ревью не является основанием их запускать (этап spec). Негативный
прогон/мутант не выполнялся: ни один из вопросов выше не требовал исполнения
кода — все закрылись прямым чтением существующих модулей.

## Находки

Находок нет.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют и однозначны: сценарий (J1/J4/J6,
  `houseplan-space-card`, включая узкий сенсорный экран); что человек увидит
  до/после — одной фразой, без терминов реализации; проблема и основание;
  скоуп и не-скоуп с явным списком исключений (#1167/#1149/#1150, новый тип
  проёма, редактирование, миграция, бета); контракт поведения — 7 пунктов;
  UX и поддержка устройств; модель данных/миграция/i18n — явное «нет» с
  обоснованием (чисто ошибка чтения/отрисовки существующих данных); критерии
  приёмки AC1–AC7, план автотестов, риски, откат, release-артефакты,
  «принято предположительно» блок.
- Каждый AC называет конкретный способ доказательства: unit-команды с
  именами файлов, named native smoke (включая новый, явно обозначенный как
  создаваемый), Golden-кадры с привязкой к `visual`/scene intent, «ревью
  кода» для AC7 — удовлетворяет DoR (§2.5) и устраняет механические
  замечания предыдущих (домодельных) попыток по AC2/AC5/AC6.
- Технический план реально реализуем: направление «переиспользовать
  `geometryOpenings`/общие face-хелперы вместо второй копии» опирается на
  уже существующий в `dev` код (п. 2–3 выше), а не на несуществующую
  инфраструктуру — риск «независимая копия алгоритма создаст расхождение»
  закрыт предписанием reuse, который физически возможен.
- Контракт корректно разграничивает продуктовое и техническое: «Технические
  решения — принято предположительно, поменять свободно» явно оставляет
  решение по декомпозиции/именам файлов исполнителю, что соответствует §7.1
  («всё, чего пользователь не наблюдает, агенты решают сами»); открытых
  продуктовых вопросов к владельцу нет, а технические вопросы (например,
  как именно извлечь `openingWallIndex`-эквивалент для Static) закрыты этим
  блоком, а не оставлены недосказанными.
- Риски названы предметно (неверная сторона/flip, символ поверх кладки,
  усечённый leaf, stale cache, дублирование composite cut, случайный
  интерактивный hit) и каждый отражён отдельным пунктом Контракта поведения
  или AC — не абстрактный список для галочки.
- Откат предметен: обычный revert реализации, без миграции данных, явный
  запрет «менять геометрию пользователя для обхода симптома».
- AC1 и AC5 явно требуют проверки в настоящих production-карточках с
  численными assertions, а не только счётчика DOM-узлов («Счётчик DOM —
  полезный адресный свидетель, но сам по себе не доказывает корректный
  вид») — соответствует требованию не подменять наблюдаемый пользовательский
  результат формальным прогоном.
- Терминология («сторона открывания», «разрыв стены», «fit: content/house»,
  «show_borders», «hideOpenings») соответствует `docs/USER-GUIDE.ru.md` (§18
  и соседние разделы про проёмы/ворота/Glow), не изобретена.
- Частный отчёт (`hpr-37af40968d`) и его геометрия корректно остаются вне
  публичного материала; AC1 и план автотестов явно требуют независимой
  публичной synthetic-fixture, не копирующей координаты пользователя.
- AC7 корректно ограничивает код-ревью готовым материалом («S7 проводит
  только code review готового материала»), сохраняя разделение фаз.

## Чего не проверял

- Содержимое приватного отчёта `hpr-37af40968d` и `diagnostics/hpr-37af40968d/`
  — по тексту issue эти материалы закрыты и не публикуются; не входят в
  `REVIEW_CONTEXT`, и их проверка не требуется для оценки осуществимости ТЗ
  (доказательство AC1 опирается на независимую публичную fixture, не на
  приватный отчёт).
- Код ещё не существует — не проверялись `tsc`/`gate:small`/golden/
  smoke-select и не выполнялся ни один негативный/мутантный прогон: предмет
  ревью — текст ТЗ, соразмерного исполнимого oracle для текста, отличного
  от чтения существующих модулей, нет.
- Точные будущие имена новых файлов/хелперов (например, как именно будет
  извлечён общий face/index-хелпер для `space-render.ts`) — решение
  исполнителя по явному блоку ТЗ «принято предположительно, поменять
  свободно»; на этапе spec это не предмет ревью.
- Фактическое состояние `dev` на момент начала кодирования (войдут ли в базу
  другие задачи раньше #1171) — это проверяется конвейером перед S6, не на
  этапе spec.
- Классификация release-ledger (`stable-fix` против `line-fix`) как
  конкретный файл `docs/release-ledger/<previous-stable>/1171.json` —
  артефакт создаётся при реализации/код-ревью, не на этапе spec; ТЗ уже
  называет ожидаемую классификацию (`stable-fix`) в AC7.

## Гейты: что прогнано и почему

| Гейт | Прогнан? | Причина |
|---|---|---|
| `tsc`/build/`npm test`/`gate:small` | Нет | Этап spec оценивает ТЗ, не код; диапазон коммитов пуст (`changedFiles: []`) |
| Golden/UI Lab | Нет | Нет сцен для нереализованного исправления |
| Негативный тест/мутант | Нет | Нет исполняемого предмета на этапе spec; все адресные вопросы закрылись чтением существующего кода без необходимости исполнения |
| Адресное чтение репозитория (структура `space-render.ts`, `geometryOpenings`, face-хелперы, USER-GUIDE, тестовые файлы) | Да | Единственные конкретные непокрытые вопросы — реальность заявленной причины бага, осуществимость предложенного reuse-направления и существование названных в AC test/smoke файлов; результаты — в разделе «Как проверялось» |

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Документ: docs/reviews/SPEC-REVIEW-1171-r1.md

Маршрут: `fix`. Побочных находок вне скоупа не обнаружено (`outside_findings`
пуст; политика публикации — `mode=issues` по сверенному
`REVIEW_FINDINGS_POLICY`, публикацию выполняет pipeline).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijg2NzA0MDUxYjQ4MGFmMmE5ZmY5N2ZiNDNlN2IwYjdkOWQ1ZmE5ODVmYmM5MTQ0MDEyOWQ1Mzg0OGMwMWM3NjMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4NTE1ZWVkMGQzOTcwNTMzZjJjNzc3N2YwNTkwNGRiZTQyZDNjMzJlZWZlZGNhZTEyNzU4ZjI3MzhhNjMyNzdhIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTcxLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1ZDljYTI3ZTZkYzYzMjFiZDc1MjUyMzQ3ODk2ZGRlYTQzNTYyMDYwIiwidHJlZSI6ImMwMTNlMmE4NjJkMDI0MzEzN2EwZjQ1ODU5YjYyYjgwMGZlZDZiN2UiLCJib2R5RGlnZXN0IjoiZTIwZmQxMDU0MTZkZjVmMmVjMTljZGE5NDY3N2Y5ZmJiYjlhODcyZWU5OTMxODI0MTYzMTRjYTRmMmQwZGZjMCIsInByb2R1Y2VyUnVuIjoiNDEyMTcxNzkzMzIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU4YTBiM2YyMDMzYjBlN2VlZmMwMDZjMTdmNzhmOWRhODJjNDUyMGM3MjE3NDYyZjFjMmUxYjA3ZTY1YmI3MzciLCJ2ZXJkaWN0RGlnZXN0IjoiZTZmZjZkYzE1NjFjNTA1MmFhZjU1MDQzOGQ1NTViYzg2NjdkZTRlMDhjOTg2ODhiNTNlYmQ1NTlkYzk1N2Q4ZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIyYzU1Njg3MGRjNjgzZWIzOTMyZjJlY2UxYjljN2JkMDk1MjE2ZmFhMTcwMzhhZTAzM2QzMjhmMjFkZDQ4OWE3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQ1ODA2MjY0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTcxI2lzc3VlY29tbWVudC02NTQ1ODA2MjY0IiwiYm9keURpZ2VzdCI6ImFlZmYxNGJjNzYwNDNmNTNjMGMzZWRlYmZlNzE3MTkwNDZmMTIwMmVjY2YxZTU3YWFhOGVhNTFlMWQxZjQ2Y2YifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5d9ca27e6dc6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c013e2a862d0243137a0f45859b62b800fed6b7e`
  ```
  git log --all --format='%H %T' | grep c013e2a862d0
  ```
- Тело issue: `e20fd105416df5f2ec19cda94677f9fbbb9a872ee993182416314ca4f2d0dfc0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTgsIm91dHB1dF90b2tlbnMiOjI2NDIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNTQzOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIzMzM3NTMsImNvc3RVc2RFc3RpbWF0ZSI6MS4yMzI4NDI2fV0sInR1cm5zIjo0MiwiZHVyYXRpb25NcyI6MzM4NDQwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yMzI4NDI2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=58 output_tokens=26422 cache_creation_input_tokens=125439 cache_read_input_tokens=2333753 num_turns=42 -->
