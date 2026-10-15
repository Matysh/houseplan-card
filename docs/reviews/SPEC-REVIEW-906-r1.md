# SPEC-REVIEW-906-r1

## Материал раунда

- Этап: spec (PROCESS.md §2.4). Трек: `ask`. Заход: r1. Блокирующих циклов
  израсходовано 0/4.
- ТЗ — тело issue [#906](https://github.com/Matysh/houseplan-card/issues/906),
  раздел `## ТЗ` (решение владельца 2026-09-10, #517). `docs/specs/` для этой
  задачи файла не содержит — архив до 2026-09-10, новый файл не создаётся.
- sha256 нормализованного тела issue на момент ревью:
  `43a4a57cb3052dea204aa99c6acfe1f80a235541844a0c1b2bc47fc51e533cd5`
  (получено `gh issue view 906 --json body -q .body`).
- Код сверялся на `dev@1d3ef09dbf5a89726f2c3ea4cb7786b5f3b2f963` (v1.81.0-beta.3,
  последний зелёный Validate) — не как диффа-материал (ветки `issue/906-*` не
  существует, реализация не заказана и не начата, `git status` рабочей копии
  чист), а как источник истины для проверки технических утверждений ТЗ.
- Единственный комментарий в issue — от владельца (`Matysh`, `authorAssociation:
  OWNER`), это и аналитика, и занятие автора ТЗ одновременно («Взял: автор ТЗ»).

## Скоуп

Задача — тех.долг/perf в подсистеме Zigbee-диагностики (J7 `docs/SCOPE.md`,
"Is my Zigbee mesh healthy here?"): `haRegistrySnapshot` возвращает новый
wrapper-объект при неизменных `devices`/`entities`/`revision`, оверлей Zigbee
topology инвалидирует memo маппинга по identity этого wrapper, и для provider
nodes без `deviceId` повторяется линейный скан реестра на каждый рендер во
время hover. Задача просит восстановить переиспользование memo при семантически
неизменных входах, не трогая TTL/пороги/visual routing. Реализация этим
поручением не заказана: «после принятого ТЗ остановиться до отдельной команды».

## Как проверялось

1. Прочитаны в порядке из `AGENTS.md`: `docs/SCOPE.md` → `AGENTS.md` →
   `docs/process/REVIEWER.md`; открыты разделы канона по ссылкам —
   PROCESS.md §2.3–2.5, §4, §7.1, §7.2, §8, §11.9.
2. Прочитано тело issue #906 целиком (`## ТЗ` и предшествующие
   «Проблема»/«Текущие основания») и единственный комментарий владельца.
3. **Технические утверждения ТЗ проверены чтением кода на HEAD, а не приняты
   на веру** (это и есть «проверено чтением, не исполнением» для технической
   части — на этапе spec тестов ещё нет):
   - `src/ha-binding-status.ts:287-295` — `haRegistrySnapshot` возвращает
     `{ revision, authoritative, access, devices, entities, lastSuccess, error
     }` новым объектным литералом при каждом вызове; `devices`/`entities`
     внутри могут быть той же ссылкой (`entry.projectedDevices` и т.п.), но
     сам wrapper — нет. Подтверждает центральное утверждение ТЗ.
   - `src/houseplan-card.ts:4631-4633` (`private get _haRegistry` вызывает
     `haRegistrySnapshot(this.hass)` без мемоизации) и `:11236`
     (`registry: this._haRegistry` передаётся оверлею на каждый рендер) —
     подтверждают, что новый wrapper действительно долетает до оверлея каждый
     кадр.
   - `src/hp-zigbee-topology-overlay.ts:522-524` — `memo.registry ===
     this.registry` сравнивает identity; при новом wrapper каждый раз ложно,
     значит `mapTopologies` пересчитывается на каждый рендер с ховером,
     несмотря на комментарий в `zigbee-topology.ts:137` («memoized by the
     overlay's snapshot revision») — комментарий устарел, а ТЗ описывает
     именно это расхождение, не выдумывает его.
   - `src/zigbee-topology.ts:51-65` (`deviceIdsForNode`) — для узла без
     `node.deviceId` действительно делает `Object.entries` по всем
     `registry.devices`, затем по всем `registry.entities`; `:142-149`
     (`mapTopologies`) вызывает её на каждый узел каждой топологии. Подтверждает
     «для provider nodes без deviceId повторяется registry scan».
   - `#769` и `#867` — оба `state: CLOSED` (`gh issue view`); ни один не
     покрывает этот шов по телу ТЗ #906, дедупликация корректна, задача не
     переоткрывает закрытое.
   - Классификация `stable-fix/performance` (§11.9): предыдущий stable —
     `v1.80.1` (`git tag --list`, последний стабильный тег перед
     `v1.80.1-beta.1`/`v1.81.0-beta.*`); оба файла (`ha-binding-status.ts`,
     `hp-zigbee-topology-overlay.ts`) и сама Zigbee-hover-фича существовали в
     `v1.80.1` (`git show v1.80.1:<path>` успешен, `git log` фичи начинается
     задолго до 1.80). Значит это не правка новой бета-функции (`line-fix` с
     `introducedBy` не требуется), а фикс поведения, существовавшего в
     предыдущем stable — `stable-fix` обоснован.
4. `docs/TOUCH-SUPPORT.md` — раздел «Pointer modality and hover ownership»:
   hover уже гейтится общим механизмом модальности указателя независимо от
   фичи; правка не трогает код гейта hover, только то, что происходит **после**
   того как ховер уже разрешён. Влияние на touch реально отсутствует, а не
   просто не названо.
5. Гейты кода (`typecheck`/`npm test`/`npm run build`) **не прогонялись** —
   на этапе spec реализации нет, дифф отсутствует (`git status` чист, ветки
   `issue/906-*` не существует), прогонять нечего (`docs/process/REVIEWER.md`
   «Зависимости и Chromium на этапе spec не ставились», #696). Зелёный Validate
   на `1d3ef09d` подтверждён владельцем материала ссылкой и к этой задаче
   отношения не имеет (её кода ещё нет).

## Находки

Находок, блокирующих принятие ТЗ (High/Medium), нет. Два наблюдения снимаю
сам, с записью причины (Low, PROCESS.md §2.4 «Low либо правится, либо
снимается решением ревьюера с записью»):

1. **Low — «Что человек увидит до и после» сформулирован в терминах
   реализации.** §7.1 требует «одной фразой, без терминов реализации», а текст
   ТЗ использует «оболочка snapshot», «mapping», «ownership» — словарь кода, не
   наблюдения пользователя.
   Снимаю: ТЗ само честно заявляет, что не обещает измеримого ускорения
   («Исправление не требует заранее заданного миллисекундного выигрыша»,
   «не рекламировать... измеренное ускорение без замера») — то есть
   наблюдаемого пользователем символа задержки здесь действительно нет, и
   изобретать его ради формы было бы догадкой, записанной как факт, что хуже
   текущей не идеальной формулировки. Раздел корректно описывает отсутствие
   видимого эффекта при семантически неизменных данных.
2. **Low — явной строки «touch: нет» нет.** DoR (§2.5) требует названного
   влияния на touch.
   Снимаю: проверено чтением `docs/TOUCH-SUPPORT.md` — hover-гейт по модальности
   указателя задачу не касается, правка лежит целиком после точки, где touch уже
   отфильтрован. Эквивалентно явному «нет», и реализация этим ТЗ не
   открывает новый touch-путь.

## Что проверено и корректно

- Все обязательные разделы §7.1 присутствуют: сценарий, что увидит человек,
  проблема, скоуп/не-скоуп, контракт поведения, UX и доступность, модель
  данных и миграция, i18n, критерии приёмки, план автотестов, риски, откат,
  release-артефакты.
- Сценарий и персона привязаны к `docs/SCOPE.md` (J7, admin, hover).
- AC1–AC3 однозначны и у каждого назван способ доказательства: AC1 — unit
  (work-count witness с до/после на одном тесте), AC2 — unit-матрица
  инвалидации (включая edge case `revision0`/limited registry и `A→B→A`),
  AC3 — ревью кода + существующие смоки (`smoke-select`) без изменения
  thresholds/TTL.
- Технический выбор реализации («semantic key» vs «стабильный wrapper»)
  явно помечен «принято предположительно, поменять свободно» — не вынесен
  владельцу как продуктовый вопрос, что и требуется: это решение не видно
  пользователю.
- Не-скоуп закрывает реальные риски расползания (TTL, provider scan,
  visual routing, LQI averaging, proactive indexing, global perf refactor).
- UX явно отрицает дефект растра/резкости — не провоцирует требование §7.1 о
  свидетеле в реальном GPU-браузере (#690), и это соответствует действительности
  задачи (чистая логика кэша, не рендер).
- Откат — обычный revert; модель данных — runtime-only memo, миграции нет,
  проверено по `docs/CONFIG-COMPATIBILITY.md` (нет persisted полей, нечего
  мигрировать).
- Release-классификация `stable-fix`/performance с `milestone 1.81` и базой
  `v1.80.1` подтверждена git-историей (раздел «Как проверялось», п.3).
- Трек `ask` и расширенный охват (ТЗ для tech-debt-находки без диффа) —
  прямое поручение владельца, зафиксированное в его же комментарии
  (`authorAssociation: OWNER`) и в разделе ТЗ «Маршрут и граница поручения»;
  открытых продуктовых вопросов владельцу в тексте нет.

## Чего не проверял

- Гейты кода (`typecheck`/`npm test`/`npm run build`/`bundle-policy`) — не
  прогонял: на этапе spec реализации и диффа нет, прогонять нечего (см. «Как
  проверялось», п.5).
- Реальный размер выигрыша в миллисекундах — ТЗ сам явно не требует этого на
  этапе ТЗ и просит доказательство work-count, а не времени; оценка отложена
  до код-ревью AC3.
- Внешний источник `batch-findings-2026-10-14.md` (F-BATCH-016) — не часть
  репозитория и не материал ревью ТЗ (материал — тело issue), не открывал.
- Полный Home Assistant harness / backend — задача не трогает Python, правка
  целиком в `src/**`.

## Вердикт

Зелёный. Блокирующих находок нет; оба Low сняты ревьюером с записью причины.
ТЗ готово к «Готово к разработке».

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `1d3ef09dbf5a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5eef92fb68e0b8a0f089d6838bdf4c687e52e5ca`
  ```
  git log --all --format='%H %T' | grep 5eef92fb68e0
  ```
- Тело issue: `548082a4e45fb6bdfdc027128fc9b9c00244ef4869ec8b1052682a5d67a02d78`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzIsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzgyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0Miwib3V0cHV0X3Rva2VucyI6MjUxNDYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzA0NTIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNDUxMTU4LCJjb3N0VXNkRXN0aW1hdGUiOjAuODIzNTgzNjAwMDAwMDAwMn1dLCJ0dXJucyI6MjYsImR1cmF0aW9uTXMiOjMwNTM5MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODI3OTY1NjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4314 output_tokens=25168 cache_creation_input_tokens=70452 cache_read_input_tokens=1451158 num_turns=26 -->
