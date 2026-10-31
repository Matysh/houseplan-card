# SPEC-REVIEW-1171-r2

Issue: #1171 — «Статическая карточка: не отображаются двери в стенах комнат»
Этап: spec (ревью ТЗ, PROCESS.md §2.4) · Трек: `ask` · Заход: r2 · Блокирующих циклов: 0/4
Материал: тело issue #1171, `bodyDigest: 226739fdd30c49b15ffb0bd76a4dce7e7d395c7e38114c66a248f0d4caa435fa`
(SHA/tree контекста: `96a4343b9cfed9ce1f6df38f36b37c01ee6cddc1` / `4bf52f8940fdf47e46e9a0868e62e26bcf35e1de`)

Маршрут вердикта: `fix` (директивно для данного этапа/раунда, #726).

## Скоуп

Задача не изменилась с r1: исправить согласованную проекцию уже поддерживаемых
door/window/gate/passage в Static (`houseplan-space-card`) для стен комнат,
перегородок и совместимых legacy-записей — символ, физический вырез/тоннель,
frame (`content`/`house`) и cache invalidation, при сохранении контракта
полного плана, read-only Static и партиционного/passage-пути как
обязательных регрессионных соседей. Обслуживает J1/J4/J6.

**Предмет r2 — дельта, а не задача целиком** (PROCESS.md §2.10). Между r1 и r2
тело issue изменилось ровно в одном месте: пункт 5 «Контракта поведения» (и
согласованная с ним фраза AC3 про `show_borders`) переписан. По хронологии
комментариев issue: r1 ушёл в зелёный (`SPEC-REVIEW-1171-r1.md`,
bodyDigest `e20fd105416df5f2ec19cda94677f9fbbb9a872ee993182416314ca4f2d0dfc0`)
без находок; во время S6 автор обнаружил собственную неточность — комментарий
6545873182: *«уточнён контракт п.5/AC3 по фактическому `spaceDisplayOf`:
`hideOpenings: !(s.show_borders ?? noPlan)`; отдельного `hide_openings` нет…
исправлено моё неверное утверждение об независимости символов от
`show_borders`»*. Это не находка ревьюера, закрываемая автором, а
самостоятельная правка текста ТЗ после зелёного r1, что по §2.10 открывает
новый раунд ревью на изменившийся материал.

## Как проверялось

Прочитаны один раз обязательные источники пакета: `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md` (включая раздел «Повторный раунд», §2.10) — без
расхождений с r1 по применимым правилам. Тело issue #1171 прочитано по всем
трём страницам `REVIEW_CONTEXT`, включая комментарии до и после r1
(аналитика, S3→S4, два раунда механических замечаний AC2/AC5/AC6, зелёный r1,
взятие в S6, затем комментарий 6545873182 с правкой п.5/AC3 и stash
реализации до нового зелёного SPEC).

Найден и прочитан предыдущий раунд: `docs/reviews/SPEC-REVIEW-1171-r1.md`
(вердикт зелёный, High 0 / Medium 0, материал `5d9ca27e6dc6` /
`c013e2a862d0`). Дельта локальна: ребейза на ушедший вперёд `dev` в материале
spec нет (spec живёт в теле issue, не в коммитах), контракт задачи не
сменился, новая подсистема не появилась — объём разбора сокращён до дельты,
а не строгость.

Единственный содержательный вопрос, открытый дельтой: верна ли новая
формулировка п.5 («`hideOpenings` — производное от `show_borders`, отдельной
настройки `hide_openings` нет; выключение `show_borders` скрывает символы
вместе с границами и исключает их вклад в кадр; физический разрыв остаётся в
структурной геометрии; после включения границ символы и вырезы
возвращаются») фактическому существующему коду, а не выдумана вместо старой
ошибочной. Адресная проверка чтением (структурный вопрос о существующем коде,
исполнимый oracle несоразмерен):

1. **Вопрос:** действительно ли `hideOpenings` — чистая функция от
   `show_borders`, без отдельного флага? **Результат:** подтверждено —
   `src/logic.ts:1413` `hideOpenings: !(s.show_borders ?? noPlan)` внутри
   `spaceDisplayOf` (строка 1380); комментарий в самом коде (`src/logic.ts:1412`,
   `#945`) гласит буквально «one display choice owns borders and opening
   symbols». Поиском по `src` (`hideOpenings|spaceDisplayOf`) не найдено
   отдельного ключа `hide_openings` ни в схеме, ни в потребителях — заявление
   «отдельная настройка не вводится и не используется» корректно описывает уже
   существующее, а не предлагает новое.
2. **Вопрос:** действительно ли выключение `show_borders` скрывает и символы, и
   их вклад в кадр, а не только обводку? **Результат:** подтверждено в
   `src/space-render.ts` — рендер стен (`wallUnion`, строка 758) и контур в
   `fit: house` (строки 502/508/512) гейтятся на `disp.showBorders`; список
   символов проёмов (`hostedOpeningSymbols`, строка 931) и их вклад в тот же
   frame-цикл (строка 519) гейтятся на `!disp.hideOpenings` — то есть на тот же
   флаг с обратным знаком. Это не новая связь, вносимая этой задачей: гейт на
   строке 519 уже стоит в коде до неё, с явным комментарием «mirroring the
   hideOpenings guard for symbols» (строка 501) — п.5 верно фиксирует
   существующий инвариант как регрессионного соседа, не придумывает его.
3. **Вопрос:** не противоречит ли новая формулировка документированному
   пользовательскому контракту? **Результат:** нет — `docs/USER-GUIDE.ru.md:932`
   описывает настройку «Отображать границы комнат (в том числе двери и окна)»
   как включающую «обводку и символы всех проёмов» одним флагом; строка 3124
   использует тот же термин `show_borders`. Формулировка п.5/AC3 использует ту
   же терминологию, что и USER-GUIDE, не изобретённую.
4. **Вопрос:** не осталось ли в теле issue других мест, всё ещё опирающихся на
   отменённое предположение о независимости символов от `show_borders»
   (несогласованность внутри одного документа)? **Результат:** не найдено —
   AC3 («видимость проёмов/границ через `show_borders` соответствуют контракту
   выше»), AC4 («hide/borders влияют на кадр только по текущей политике
   видимости») и раздел «Модель данных»/«UX» уже сформулированы в терминах
   единого флага и не содержат альтернативного текста о независимости.

Остальные разделы ТЗ (Сценарий, Проблема и основание, Скоуп/не-скоуп, п.1–4,
6–7 Контракта, UX и устройства, модель данных/миграция/i18n, AC1/AC2/AC4–AC7,
план автотестов, риски и откат, release-артефакты, «Технические решения»)
текстуально не изменились между r1 и r2 — приняты из r1 без повторной
проверки (раздел «Унаследовано из r1» ниже).

Полные build/test гейты (`tsc`, `npm test`, `gate:small`, golden) не
запускались — материал ревью остаётся текстом ТЗ (`changedFiles: []`), а
отсутствие CI на SHA документа ревью не основание их запускать на этапе spec.
Негативный прогон/мутант не выполнялся: единственный открытый вопрос дельты
закрылся прямым чтением уже существующего (до этой задачи) кода и документа
пользователя, без необходимости исполнения.

## Находки

Находок нет.

## Что проверено и корректно

- Дельта (п.5 «Контракта поведения» + согласованная фраза AC3) описывает
  фактическое поведение уже существующего `spaceDisplayOf`/`space-render.ts`
  точно, одной формулой, без несуществующего отдельного флага `hide_openings`
  — проверено построчным сопоставлением с `src/logic.ts:1380-1414` и
  `src/space-render.ts:501-519,758,931`.
- Формулировка согласована с документированным пользовательским контрактом
  (`docs/USER-GUIDE.ru.md:932,3124`) — не вводит новую терминологию и не
  обещает поведение сверх уже описанного.
- Внутри обновлённого тела issue нет остаточной несогласованности: AC3/AC4 и
  соседние разделы уже сформулированы в терминах единого флага, старое
  (ошибочное) утверждение о независимости нигде не осталось в тексте.
- Правка не расширяет и не сужает скоуп, AC1–AC7 и не вводит новую
  настройку/поверхность — соответствует ограничению «не входят: новые
  настройки» из раздела «Скоуп и не-скоуп», не затронутого дельтой.
- Остальные обязательные разделы §7.1 (включая однозначность каждого AC и
  названный способ доказательства) не менялись и остаются в состоянии,
  зафиксированном зелёным r1.

## Чего не проверял

- Повторно весь текст ТЗ вне дельты (Сценарий, Контракт п.1–4/6–7, AC1, AC2,
  AC4–AC7, план автотестов, риски/откат, release-артефакты, «Технические
  решения») — не изменился байт в байт со времени зелёного r1; принят из r1 по
  правилу «предмет повторного раунда — дельта» (см. «Унаследовано из r1»).
- Код ещё не существует как продуктовый diff на момент этого ревью (работа S6
  сохранена автором в `git stash`, по его собственному комментарию
  6545873182, до нового зелёного SPEC) — `tsc`/`gate:small`/golden/smoke-select
  не запускались; это ожидаемо для этапа spec.
- Приватный отчёт `hpr-37af40968d` и `diagnostics/hpr-37af40968d/` — закрыты по
  тексту issue, не входят в `REVIEW_CONTEXT`, не требуются для оценки
  осуществимости обновлённого пункта.
- Точное будущее имя/декомпозиция хелперов — остаётся решением исполнителя по
  блоку «Технические решения — принято предположительно», не предмет этапа
  spec.

## Гейты: что прогнано и почему

| Гейт | Прогнан? | Причина |
|---|---|---|
| `tsc`/build/`npm test`/`gate:small` | Нет | Этап spec оценивает текст ТЗ, не код; диапазон коммитов пуст (`changedFiles: []`) |
| Golden/UI Lab | Нет | Нет сцен для нереализованного исправления |
| Негативный тест/мутант | Нет | Нет исполняемого предмета на этапе spec; единственный открытый вопрос дельты закрылся чтением существующего (допроектного) кода и документа |
| Адресное чтение репозитория (формула `hideOpenings`/`spaceDisplayOf` в `src/logic.ts`, гейты `disp.showBorders`/`disp.hideOpenings` в `src/space-render.ts`, терминология `docs/USER-GUIDE.ru.md`) | Да | Единственный конкретный непокрытый вопрос дельты r2 — соответствует ли новая формулировка п.5/AC3 фактическому существующему коду, а не выдумана; результаты — в разделе «Как проверялось» |

## Закрытие раунда r1

r1 ушёл в зелёный без находок (High 0 / Medium 0, `SPEC-REVIEW-1171-r1.md`) —
закрывать по этой таблице нечего. Переход к r2 вызван не находкой
предыдущего ревью, а самостоятельной правкой текста ТЗ автором после
зелёного r1 (комментарий 6545873182, во время S6): уточнение формулировки
п.5/AC3 по фактическому `spaceDisplayOf`. Эта правка разобрана выше как
предмет r2 и подтверждена чтением кода и USER-GUIDE.

## Унаследовано из r1

Принято без повторной проверки, текст не изменился со времени зелёного r1 —
документ `docs/reviews/SPEC-REVIEW-1171-r1.md`, материал `bodyDigest:
e20fd105416df5f2ec19cda94677f9fbbb9a872ee993182416314ca4f2d0dfc0` (SHA/tree
`5d9ca27e6dc6321bd75252347896ddea43562060` / `c013e2a862d0243137a0f45859b62b800fed6b7e`):

- Сценарий, «Что человек увидит до и после», «Проблема и основание», «Скоуп и
  не-скоуп» (исключения #1167/#1149/#1150, новый тип проёма, редактирование,
  миграция, бета).
- Контракт поведения п.1–4, 6, 7 (источник видимого списка и запрет
  поиска/перепривязки; единственность отрисовки и общая математика
  стороны/грани; вырез по канонической геометрии без дублирования;
  разрыв/тоннель от физической геометрии, а не от contact; жизненный цикл,
  fingerprint и keyed identity; неинтерактивность и отсутствие write).
- AC1, AC2, AC4, AC5, AC6, AC7 целиком — дельта затронула только формулировку
  п.5 и согласованную с ней фразу AC3, остальные критерии и названные
  способы доказательства (unit-команды, named native smoke, Golden intents,
  ревью кода для AC7) не менялись.
- План автотестов и доказательств, «Риски и откат», «Release-артефакты»,
  «Технические решения — принято предположительно».
- Подтверждённая в r1 реальность причины и осуществимость направления
  исправления (`resolvedHosted`/`hostedOpeningSymbols` в `space-render.ts`
  фильтруют только `host.kind=partition`; `geometryOpenings` и общие
  face-хелперы `partitionOpeningFace`/`openingInnerFaceOffsetFromIndex` уже
  существуют и уже используются) — дельта r2 их не касается.

## Вердикт

Вердикт: зелёный · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 0

Маршрут: `fix`. Побочных находок вне скоупа не обнаружено — `outside_findings`
пуст; политика публикации — `mode=issues` по сверенному
`REVIEW_FINDINGS_POLICY` (round 2), публикацию выполняет pipeline.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjUyNGU5M2IzNjU4OGNiMWFjMTkyMTliY2Y4YmM0MGZkM2FiMWFlYjA1MWZhYjRkMWM4ZGU1MTczOWY1NGE5ZjUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5NGZmMjk0YTliM2ZkZTEzNjdjODZjYjc0MDQxMDRlZTA0NmQ4NzllMDZkZGNlZmYzMDc1Y2QzMGNlZmZlY2QzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTcxLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI5NmE0MzQzYjljZmVkOWNlMWY2ZGYzOGYzNmIzN2MwMWVlNmNkZGMxIiwidHJlZSI6IjRiZjUyZjg5NDBmZGY0N2U0NmU5YTA4NjhlNjJlMjZiY2YzNWUxZGUiLCJib2R5RGlnZXN0IjoiMjI2NzM5ZmRkMzBjNDliMTVmZmIwYmQ3NmE0ZGNlN2U3ZDM5NWM3ZTM4MTE0YzY2YTI0OGYwZDRjYWE0MzVmYSIsInByb2R1Y2VyUnVuIjoiNDEyMTgzODk1MDkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjE3YmQwZWM3NjkyZGRlNTg0MTAxMDY5MjI2ZjgzMDlkOGNhOGRkMTU1Mzk2YTI5NmExZmFmNDFhM2JhNDkxOTkiLCJ2ZXJkaWN0RGlnZXN0IjoiZjhiYjQwYjUxN2UzNTkyYTc4MWQ5OWU3OTZjYTQ0YjVlZGI4MzAwODJhZTc2M2FhZWZlODAyY2ZkZGJlMGFjOSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjZTQ1YzNjMGQ3ODdiNmMxYWU5ZTVhNjAwMGUyYjBiMWZkZjlkMzc1NDBjZTIwMjQ3MzZjMDZiYmY4MTQ4ZWY0IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQ1OTQyNjEyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTcxI2lzc3VlY29tbWVudC02NTQ1OTQyNjEyIiwiYm9keURpZ2VzdCI6ImQ5OTYwMzNlZTAxNGM4ZTZjOWMzNjVjZDk3YzUyOTJjYWE5OTljNjI3NTAxYTYzYzliY2Y2NGEyOThhNTRjZjQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `96a4343b9cfe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4bf52f8940fdf47e46e9a0868e62e26bcf35e1de`
  ```
  git log --all --format='%H %T' | grep 4bf52f8940fd
  ```
- Тело issue: `226739fdd30c49b15ffb0bd76a4dce7e7d395c7e38114c66a248f0d4caa435fa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjIsIm91dHB1dF90b2tlbnMiOjE0MzUwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjcyNjQ4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTU1MjEzLCJjb3N0VXNkRXN0aW1hdGUiOjAuNTQ1MTc4Nn1dLCJ0dXJucyI6MTgsImR1cmF0aW9uTXMiOjE4NDg2NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNTQ1MTc4NiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=22 output_tokens=14350 cache_creation_input_tokens=72648 cache_read_input_tokens=555213 num_turns=18 -->
