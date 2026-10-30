# SPEC-REVIEW-1080-r1

Issue: #1080 · Этап: spec (ревью ТЗ, PROCESS.md §2.4) · Трек: ask · Заход r1 ·
блокирующих циклов 0/4

Материал: тело issue #1080, раздел `## ТЗ`, редакция 1 · 26.10.2026 ·
bodyDigest `17434b64eb8cfb00ccaf28eeef45f2c18686cf0194bc2d8b05ae31ce5de09e91`
(REVIEW_CONTEXT). Основание ТЗ по коду — принятый dev
`98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`; рабочее дерево ревью — SHA
`5cfa93b32300f86abba995925509f06118e09945` (используется только для чтения
текущего состояния подсистемы декора, не как предмет код-ревью).

## Скоуп

ТЗ описывает очистку/единого владельца временного preview декора (мебель,
фигуры/линии, изображения) в редакторе подложки — владение между обычным
(«settled») и live-рендером на панорамировании, полном HA-рендере, отмене и
смене инструмента. Обслуживаемая строка `docs/SCOPE.md` — J4/J6 («from zero to
a working plan», «keep the plan true as the home evolves»): сам Background
editor уже закрывает эти job, задача устраняет визуальный дефект внутри него,
не расширяя продукт. UI-037 (pan при активном размещении мебели, #1081) явно
выведен из скоупа и не продублирован здесь.

## Как проверялось

Согласно политике этапа spec, кодовый Validate не запускался (tsc/build/
gate:small не требуются при отсутствии CI на SHA документа ревью). Проверка
велась по двум линиям:

1. **Обязательные разделы и DoR** (PROCESS.md §7.1, §2.5) — построчная сверка
   ТЗ: сценарий, что видит пользователь, проблема/основание, скоуп/не-скоуп,
   контракт поведения, UX/touch, модель данных и миграция, i18n, AC1…AC5 с
   колонкой доказательства, план автотестов, риски, откат, release-артефакты.
   Все обязательные разделы присутствуют; у каждого AC указан способ
   доказательства (unit/smoke/golden), открытых продуктовых вопросов к
   владельцу не осталось.
2. **Осуществимость AC — адресное чтение материала** (единственный непокрытый
   вопрос: существует ли в реальном коде механизм «двух одновременных копий
   preview», на который ссылается UI-038, или это гипотеза без основания).
   Прочитаны вызывающие пути: `src/houseplan-card.ts` (`_renderDecorLayer`,
   строки ~8647–8812), `src/live-editor.ts` (`routeHouseplanEditorUpdate`,
   `makeDecorShapeTransparent`, `editorTemplate`, `paintHouseplanEditor`,
   строки ~79–400), `src/houseplan-editor-runtime.ts`
   (`_renderFurniturePlacementPreview`, `_furniturePreviewPlacement`,
   `_furnPlace`, строки ~4595–4684) и `src/decor-image-editor.ts`
   (`renderPlacementPreview`, строки ~78–96). Это чтение, не исполнение: не
   запускался ни один оракул run_check, продуктовый код не менялся, мутанты не
   исполнялись.

   Результат: претензия ТЗ подтверждается структурой кода, а не является
   догадкой. `_renderDecorLayer` безусловно дописывает
   `_renderFurniturePlacementPreview()` / `_renderDecorImagePlacementPreview()`
   и черновик фигуры/линии (`draft`) в конец слоя **независимо от** фильтра
   `onlyId`, и эти элементы не несут `data-hp="decor"`/`data-id`. Между тем
   `makeDecorShapeTransparent` (единственный механизм, гасящий «обычную»
   копию при передаче владения live-слою) ищет ровно
   `.decorlayer [data-hp="decor"]` с подходящим `data-id` — то есть видит
   только существующие сохранённые объекты, но не умеет погасить эти
   безусловно отрисованные preview-узлы. `_furnPreviewInput`/`_decorDraft`
   входят в `liveProperties`/`hoverProperties` (`live-editor.ts:81-88`), так
   что обычные движения курсора уходят только в live-паинт
   (`routeHouseplanEditorUpdate`); если в этот момент случается полный Lit
   рендер по другой причине (HA-тик, ресайз и т.п.) при ещё не очищенном
   `_furnPreviewInput`/`_decorDraft`, обычный слой получает собственную копию
   preview, которая переживает дальнейшие live-кадры. Это ровно механизм,
   заявленный в UI-038 («обычный и live-слой одновременно рисуют мебель»), и
   он архитектурно общий для мебели, изображений и черновиков линии/
   прямоугольника/эллипса — ТЗ корректно называет это «общим compositing-
   путём», а не делает вывод по одному типу декора. Модули, перечисленные в
   разделе «Модули» (`src/live-editor.ts`, `src/houseplan-card.ts:
   _renderDecorLayer`, `test/live-editor.test.mjs`), и факт существования
   каждого (подтверждено `Glob`/`Grep`) делают AC1–AC4 технически доказуемыми
   тем способом, который указан в их колонке «Доказательство».
   Аналогичный прежний дефект #828 (временные path/guide стен) подтверждён
   как реальный прецедент — текст и механизм совпадают с описанием в
   `docs/ARCHITECTURE.md` (строки ~644–652), так что аналогия в разделе
   «Похожее прежнее исправление» не выдумана.

   Дополнительно проверено: `docs/release-ledger/v1.82.0/` существует и не
   содержит записи `1080.json` — ссылка ТЗ на «предыдущий stable v1.82.0» как
   базу для release-артефактов корректна; `docs/CHANGELOG.md` подтверждает,
   что текущая разработка идёт поверх `v1.83.0-beta.2`, а не `v1.82.0`, что
   согласуется с инструкцией ТЗ «не выдавать дату появления beta-сценария за
   доказательство» при классификации stable-fix/line-fix. В коде нет следов
   #1081 (`Grep` по репозиторию — ноль совпадений), что подтверждает
   актуальность пункта 7 контракта поведения (совместный сценарий pan ещё не
   доступен на реальном кандидате).

## Находки

Находок нет. High: 0, Medium: 0.

Рассмотренный, но не поднятый до находки пункт: раздел «UX и touch» ссылается
на приватные материалы UI Lab (`evidence/ui037-ui038-furniture-accepted-
20261025/`, `MANIFEST.json`), которых нет в репозитории (проверено `Glob`) и
которые сам текст ТЗ признаёт неоткрытыми в этой сессии. Это не доведено до
Medium, потому что ТЗ уже прямо адресует разрыв: «перед реализацией найти
точный набор и записать hash» — назначенная автору техническая задача, а не
недоговорённый продуктовый вопрос; итоговое наблюдаемое поведение AC5
(«ровно один видимый ghost» на всех стадиях жеста) уже сформулировано текстом
контракта независимо от приватных кадров, и доказательство может строиться на
собственном golden-сценарии автора, сверенном с письменным описанием UI-038, а
не на байтовом сравнении с недоступным файлом. Ручная сверка с приватными
кадрами владельца остаётся добровольной (решение владельца 2026-10-16, #929);
её недоступность не блокирует объективную проверку AC5.

## Что проверено и корректно

- Обязательные разделы ТЗ (PROCESS.md §7.1) все присутствуют; первые два —
  продуктовые («Сценарий», «Что человек увидит») — отвечают на оба вопроса
  без терминов реализации.
- Каждый AC1–AC5 однозначен, имеет наблюдаемый результат и названный способ
  доказательства (unit/smoke/golden); ни один не описывает результат,
  которого не подтверждает ни один документ.
- DoR-чеклист (§2.5) закрыт: AC пронумерованы с доказательством, файлы/модули
  названы и существуют, i18n решён («новых строк не требуется»), миграция
  решена по модели «нет новых полей» (instance-local runtime), touch — по
  `TOUCH-SUPPORT.md` (термин «safety floor» использован корректно, сверено
  текстом канона), performance назван явно (нет полного рендера/постоянного
  observer на каждый pointermove), release-артефакты и откат названы, открытых
  продуктовых вопросов владельцу нет.
- Технический механизм дефекта (двойной рендер preview без `data-hp="decor"`,
  непогашенный `makeDecorShapeTransparent`) подтверждён независимым чтением
  вызывающего кода, а не принят на веру из текста issue; совпадает с
  архитектурой `src/live-editor.ts`/`src/houseplan-card.ts`/
  `src/houseplan-editor-runtime.ts`/`src/decor-image-editor.ts`.
- Аналогия с #828 — реальный, документированный прецедент, а не
  изобретённая ссылка.
- Разделение скоупа с #1081 (UI-037 отдельно от UI-038) последовательно: сам
  жест pan при размещении нигде в контракте поведения не реализуется, только
  потребляется как внешнее условие.
- Ссылка на `docs/release-ledger/v1.82.0/` как предыдущий stable корректна
  относительно текущего состояния репозитория и `docs/CHANGELOG.md`.

## Чего не проверял

- Кодовый Validate (tsc/build/npm test/gate:small) — не требуется на этапе
  spec при отсутствии CI на SHA документа ревью; не запускался.
- Визуальное/пиксельное соответствие с приватными кадрами UI Lab
  (`furniture-pan-*.png`, `MANIFEST.json`) — материалы недоступны в этой
  сессии и не публикуются; это ограничение названо выше, а не гейт этого
  ревью.
- Исполнение автотестов/smoke/golden по плану ТЗ — задача ещё не
  реализована (этап spec), запуск не относится к ревью ТЗ.
- Не проверялась точная классификация stable-fix/line-fix — ТЗ сама
  откладывает это решение автору перед S7, что соответствует §11.9/#838.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/gate:small | Нет | Этап spec оценивает ТЗ; кодовый Validate не требуется, отсутствие CI на SHA документа ревью не является основанием его запускать |
| run_check (любой оракул) | Нет | Единственный непокрытый вопрос (реальность механизма «двух копий preview») разрешён адресным чтением вызывающего кода; исполнимый оракул для проверки текста ТЗ не требуется и не является соразмерным на этом этапе |
| Негативные/мутационные проверки | Нет | Не применимо: продукт не изменён, мутанты на этапе spec не исполняются вне ночного workflow |

## Маршрут

`route: fix` (трек `ask`, этап spec — `reclassify` для этого поля не
применяется).

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 →
в задаче · Документ: docs/reviews/SPEC-REVIEW-1080-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjcwMWMxY2JkNTUyNzg0NGRiZDZjYWE2ZGI0MDg3OTM2M2Q3ZjM5NTRkMWU1YjlkMTkwZmI5ZjA1YjY1ZTgwMDYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkNjk0NzMzYmMwMDRlZWM1NWQ0N2YyZGZjNWYyNTBjOTI2ODdkNjFlZTRlNTAwYjZkMTRhNDg5NGUwOTIzZDRjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDgwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1Y2ZhOTNiMzIzMDBmODZhYmJhOTk1OTI1NTA5ZjA2MTE4ZTA5OTQ1IiwidHJlZSI6IjBlN2U0NGUyYTY2NTNhYWM1YTI5ZTY0ZGQxODg0MjQzZjI4ODVjZTQiLCJib2R5RGlnZXN0IjoiMTc0MzRiNjRlYjhjZmIwMGNjYWYyOGVlZWY0NWYyYzE4Njg2Y2YwMTk0YmMyZDhiMDVhZTMxY2U1ZGUwOWU5MSIsInByb2R1Y2VyUnVuIjoiNDAyNTI1MTk2NDQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQxMDZhYmY3OTQ5N2QwNTEzNWNiODIxZTA2NzcyZTcwZTYyNDE5ZGJhMjI5ZWU1YTZhNzgwM2Q5Y2I5ZjhlOTkiLCJ2ZXJkaWN0RGlnZXN0IjoiODhmODgzNDE4YWVlY2Q5NjY3ZWM2N2E2ZWI5NmIyZTQ2NzdhZjZiYzEzMmRkZjFmYTg5NGRiZDVjMTVlOWMxNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJmNGRjMmI4Yzk2N2I3OWZmYTc1NDViNGE1ZGE5YzdhOThhYWQyNTNkY2ExYzBhNjZlZTViZjA5ODFmZDc0OWQzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2MDQ5NzgzLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDgwI2lzc3VlY29tbWVudC02NDA2MDQ5NzgzIiwiYm9keURpZ2VzdCI6IjE2MjJiYzlhMmRkZTExOWFiNjY0OGUzMDNhNjcyYjE0OTdjYWJjNTM1M2M3MWVlYTBiNDI2YmRkYjM1MjJmYWEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5cfa93b32300` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0e7e44e2a6653aac5a29e64dd1884243f2885ce4`
  ```
  git log --all --format='%H %T' | grep 0e7e44e2a665
  ```
- Тело issue: `17434b64eb8cfb00ccaf28eeef45f2c18686cf0194bc2d8b05ae31ce5de09e91`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzAsIm91dHB1dF90b2tlbnMiOjMwMjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExODU1OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMwNjgwNzgsImNvc3RVc2RFc3RpbWF0ZSI6MS4zOTAxNjc2MDAwMDAwMDA1fV0sInR1cm5zIjo0MywiZHVyYXRpb25NcyI6NDAwNTk3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zOTAxNjc2MDAwMDAwMDA1LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=70 output_tokens=30218 cache_creation_input_tokens=118558 cache_read_input_tokens=3068078 num_turns=43 -->
