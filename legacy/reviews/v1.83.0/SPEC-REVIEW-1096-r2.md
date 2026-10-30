# SPEC-REVIEW #1096 — заход r2

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 · Документ: docs/reviews/SPEC-REVIEW-1096-r2.md

Маршрут (#726): `route: fix`.

## Материал раунда

- Этап: `spec`, трек: `ask`.
- Тело issue #1096, редакция ТЗ **2** от 27.10.2026 (`bodyDigest`
  `3b56bf2738e5f500cea0f13047b63ef034ea4f2ae05b7aa2f7749336b4fdaa4b`), основа — dev `d6ebc42a2`.
  Код-дерево ревью: рабочая копия репозитория на `e4c0c75da4` (два следующих коммита после
  `d6ebc42a2` — `docs: review document for #1089/#1096`, оба class C, путь записи не затрагивают).
- Предыдущий раунд: r1, документ `docs/reviews/SPEC-REVIEW-1096-r1.md`, вердикт жёлтый,
  материал — тело issue на дереве `21b98559a2`, `bodyDigest` `218e561f96d2845ff7cc0baf4efdc46d5c02b0c8bcf226df5d3fcc0d8e2f66cd`,
  находка M1.
- Дельта r1→r2 (по хендоффу автора, комментарий `6445260641`): п.5 контракта — развилка
  материализованный/легаси для `preserve_space_appearance`; новый кейс корпуса в AC1; новый
  негативный вход в AC6; раздел «Риски» — назван визуальный класс риска. Остальной текст ТЗ
  не менялся.

## Скоуп ревью

Задача обслуживает J4/J6 (`docs/SCOPE.md`): «Keep the plan true as the home evolves» —
перф-правка серверного пути `config/set`/`config/get`, без изменения протокола, контракта
ошибок или видимого поведения, кроме скорости ответа на больших домах. Трек `ask` корректен:
перф, публичный контракт валидации, несколько модулей (`AGENTS.md` §Tracks, критерии
`complexity`/`surfaces`/`perf-touch`).

Раунд не первый → разбор по дельте (`docs/process/REVIEWER.md`, «Повторный раунд»,
PROCESS.md §2.10): независимая перепроверка — закрытие M1 (п.5/AC1/AC6/Риски) и его
последствия для соседних пунктов контракта, не затронутых правкой. Остальные разделы ТЗ
(Сценарий, Проблема, Скоуп/Не-скоуп, Контракт пп. 1–4/6/7, AC2–5/7–11, План автотестов,
Откат, Release-артефакты) — дельта их не задевает, сомнений в локальности дельты нет
(правка r2 — точечная, текст вне четырёх названных мест автором подтверждён как неизменный
и совпадает побайтно с r1 при сверке).

## Как проверялось

Static-first (#857): прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
полное тело issue #1096 (редакция 2) и страницы истории (комментарии r1-хендоффа, r1-вердикта,
r2-хендоффа). Кодовый Validate не требуется (этап spec, реализации нет); гейты `tsc`/`build`/
`npm test`/`gate:small` не прогонялись — согласно правилу этапа (`docs/process/REVIEWER.md`,
«Ревью ТЗ»), это не является пропуском гейта.

Адресная проверка осуществимости (единственный конкретный непокрытый вопрос дельты —
совпадает ли описанная в п.5 развилка материализовано/легаси с реальным кодом
`preserve_space_appearance`/`normalize_room_appearance`, которые правка AC1/AC6 называет
по имени): прочитаны `custom_components/houseplan/room_appearance.py` (функции
`normalize_room_appearance`, `preserve_space_appearance`) и фрагмент
`custom_components/houseplan/websocket_api.py` (`ws_config_get`, строки 1764–1834, включая
названную в ТЗ `:1784`). Результат: оба факта подтверждены чтением, без исполнения —

- `preserve_space_appearance` сегодня безусловно вызывает `normalize_room_appearance(previous)`
  (полный deepcopy документа) и только потом читает нужное пространство по `id` — именно та
  точка, для которой п.5 предлагает развилку;
- `normalize_room_appearance` расставляет `name_color`/`wall_fill` через `setdefault` **по
  каждому полю независимо** — значит пространство с одним материализованным и одним
  отсутствующим полем не ломает ни определение «материализовано» (требует **оба** поля), ни
  эквивалентность результата после развилки: для такого пространства п.5 классифицирует его
  как легаси и вычисляет оба поля прежним правилом, что побайтно совпадает с текущим
  поведением (неизменное поле `setdefault` не трогает, отсутствующее — вычисляет);
  слово «материализован» в п.5 однозначно привязано к сохранённой записи (`previous`), а не
  к результату уже прогнанного `normalize_room_appearance` — развилки по кругу нет;
- `ws_config_get` (:1784) действительно единственный раз на всю функцию вызывает
  `normalize_room_appearance({**DEFAULT_CONFIG, **data.get("config", {})})` под `write_lock`
  — ровно то место, которое AC6 просит обусловить материализацией.

Других адресных проверок дельта не требует: новый кейс корпуса AC1 и негативный вход AC6 —
это описания будущих тестов, не код; их проверяемость подтверждается тем, что названные в них
функции/сигнатуры (`normalize_room_appearance`, `canonicalize_config_geometry`,
`config_store.async_load`, `copy.deepcopy`) существуют и совпадают по поведению с текстом ТЗ.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе): п.5 контракта утверждал безусловное равенство прямого чтения `name_color`/`wall_fill` в `preserve_space_appearance` результату `normalize_room_appearance(previous)`, хотя эта функция вычисляет поля по умолчанию для немматериализованного (легаси, до #1037) документа; та же развилка была явно сделана в этом же пункте для `config/get`, но не для `preserve_space_appearance`; ни один AC не покрывал легаси-previous кейс; раздел «Риски» писал «визуал — нет». | П.5 переписан: `preserve_space_appearance` и `config/get` теперь различают материализованное/легаси-пространство **одинаково** (по наличию обоих полей `name_color`+`wall_fill` в сохранённой записи); для материализованного — прямое чтение без `normalize_room_appearance`/deepcopy; для легаси — вычисление прежним правилом через общий helper на одно пространство. AC1 получил новый кейс корпуса. AC6 получил негативный вход и перечень spy, включая `normalize_room_appearance`. Раздел «Риски» называет визуальный класс и ссылается на AC1/AC6. | Тело issue, ТЗ редакция 2: п.5 контракта (абзац «`preserve_space_appearance` и `config/get` различают материализованный и легаси-документ одинаково…»); AC1 (ячейка «Наблюдаемый результат», фраза «легаси previous без `name_color`/`wall_fill`…»); AC6 (обе ячейки, фраза «на легаси previous отдаёт кандидату те же вычисленные `name_color`/`wall_fill`…» и «spy на … `normalize_room_appearance`; … отрицательный вход — легаси previous с `room_color`…»); «Риски» (строка «Визуал: единственный путь к регрессии…(M1 ревью r1); закрыт развилкой п. 5 и кейсами AC1/AC6» и «визуал — легаси-цвета, AC1/AC6»). Подтверждено независимым чтением `room_appearance.py:19-53` и `websocket_api.py:1764-1834` — текст ТЗ соответствует реальному поведению этих функций (раздел «Как проверялось» выше). |

M1 закрыт полностью, без остаточной неоднозначности: формулировка п.5 однозначно привязывает
«материализовано» к сохранённой записи (а не к промежуточному результату), что исключает
циклическое определение, которое могло бы возникнуть при небрежной формулировке.

## Унаследовано из r1

Без повторной проверки приняты разделы, которых дельта r1→r2 не касается — текст совпадает
с текстом, принятым в `docs/reviews/SPEC-REVIEW-1096-r1.md` (материал r1: тело issue на дереве
`21b98559a2`, `bodyDigest` `218e561f96d2845ff7cc0baf4efdc46d5c02b0c8bcf226df5d3fcc0d8e2f66cd`):

- Сценарий, «Что человек увидит до и после», «Проблема» — построчная сверка номеров
  файлов/функций/строк с деревом в r1 признана совпадающей.
- Скоуп / Не-скоуп.
- Контракт поведения пп. 1 («Затронутое и нетронутое»), 2 («Отметка чистоты»), 3 («Что
  проверяется в scoped-проходе»), 4 («Обходы на event loop по условию»), 6 («Файлы»),
  7 («Неизменное») — текст не менялся правкой r2.
- AC2–AC5, AC7–AC11 — критерии и способы доказательства не менялись; feasibility
  (`schema_clean_rev`, `baseline_counts`, условные обходы радара/сущностей/LQI) признана в r1
  без новой инфраструктуры.
- План автотестов, «Откат», «Release-артефакты», i18n, «Модель данных и миграция», UX.
- Трек `ask` и оценка владельца (комментарий `6443287130`) — без изменений.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- M1 закрыт корректно и без побочных эффектов на AC2–AC11 и п. 1–4/6/7 контракта (они не
  ссылаются на `preserve_space_appearance`/`normalize_room_appearance` и не зависят от
  развилки материализовано/легаси).
- Развилка материализовано/легаси в п.5 сформулирована однозначно и проверяема: условие
  «материализовано» на сохранённой записи, а не на производном результате; подтверждено
  чтением текущего кода `room_appearance.py` и `websocket_api.py` — текст ТЗ описывает
  реальное поведение, а не вымышленное.
- Новый кейс корпуса AC1 («легаси previous без `name_color`/`wall_fill` в одном или всех
  пространствах при кандидате без этих полей») корректно охватывает и полностью легаси, и
  частично материализованные пространства (по одному из двух полей) — независимо проверено,
  что `setdefault`-семантика `normalize_room_appearance` делает эти случаи эквивалентными
  после развилки.
- AC6 получил названный отрицательный вход («легаси previous с `room_color`, кандидат без
  полей → после записи `settings.name_color` равен вычисленному из `room_color`, а не
  дефолту схемы») — защитный AC теперь имеет непустую строку «чем краснеет»
  (`docs/process/REVIEWER.md`, #435): это описанный обычный негативный вход с ожидаемым
  результатом, а не пустая ссылка на мутанта.
- Раздел «Риски» больше не содержит ложного «визуал — нет»; визуальный класс риска назван и
  привязан к конкретным AC.
- Обязательные разделы ТЗ (§7.1) присутствуют; `specFormatErrors(body, 'ask')` по хендоффу
  автора — 0 ошибок (форматная проверка, не вердикт, принята как контекст, не перезапускалась).

## Чего не проверял

- Повторную построчную сверку номеров строк/функций вне делты (`websocket_api.py:1963-2209`,
  `:2048-2050`, `:2060-2087`, `store.py:243-250`, `plans.py:409-425`/`:150-170`,
  `zigbee_lqi.py:94-108`, `radar_validation.py:171`) — она выполнена и принята в r1 и дельтой
  r2 не затронута; пригодный неизменившийся check не повторяется (`docs/process/REVIEWER.md`,
  «Повторный раунд»).
- Исполнение какого-либо кода или теста: реализации нет, этап spec не требует Validate; оба
  факта, проверенные адресно (материализация в `preserve_space_appearance`, единственный
  `normalize_room_appearance` в `ws_config_get`), проверены **чтением, не исполнением** —
  соразмерного исполнимого oracle для ещё не написанного кода не существует.
- Полноту списка «парных писателей», сбрасывающих `schema_clean_rev` (AC5 покрывает только
  `marker/copy` как пример) — вне делты r1→r2, вопрос был открыт и закрыт в r1 авторской
  ссылкой на AC5 без возражений ревью r1; новых оснований пересматривать это в r2 нет.
- `gate:small`, `pytest tests_backend`, `npm run invariants` — не прогонялись; правило этапа
  spec (`docs/process/REVIEWER.md`: «Кодовый Validate на этапе spec не требуется») освобождает
  от них, реализации, которую можно было бы прогнать, не существует.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `tsc`/`build`/`npm test`/`gate:small`/`pytest tests_backend` | Нет | Этап `spec`: кодового Validate не требуется, реализации нет (правило этапа, `docs/process/REVIEWER.md` «Ревью ТЗ»). |
| `specFormatErrors(body, 'ask')` | Нет (переиспользован результат автора) | Форматная, не семантическая проверка; хендофф автора (комментарий `6445260641`) приводит результат 0 ошибок на точном тексте r2 — контекст, не вердикт; повторный прогон не требуется для вердикта ТЗ. |
| Адресное чтение кода (`room_appearance.py`, `websocket_api.py:1764-1834`) | Да | Единственный конкретный непокрытый вопрос дельты r2 — согласуется ли описанная развилка материализовано/легаси с реальным кодом; проверено чтением (см. «Как проверялось»). |

## Итог

M1 закрыт полностью и без побочных эффектов; новых находок в дельте r2 и в проверенных
её последствиях нет. Вердикт — зелёный.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImUzOWRmOTYxMzdkNjRjNDg0ODEwYjRmNjMzOGQ0MGUzMGUxMGM1N2FmZmFlYWI0ZWI0NmIzNGE2YjdlMzhlOTAiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5MDMzNmJlNWEwNDcwNmRiNWYwNWMwN2MyZGE3Yzg3MjM5ZDM2NDUzY2Q3NzM4MDc0NTQwNTcwMjkxMGM5ZmIzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk2LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJlNGMwYzc1ZGE0MDViZWRhNTllNWFmMGE4YTg1N2RiNDEzMmRhZjVmIiwidHJlZSI6Ijg2NTRmZjAyYTdiODhhNzE4ZTc5NjcyOWY4N2ExMzYxY2I0NmQ1ODAiLCJib2R5RGlnZXN0IjoiM2I1NmJmMjczOGU1ZjUwMGNlYTBmMTMwNDdiNjNlZjAzNGVhNGYyYWUwNWI3YWEyZjc3NDkzMzZiNGZkYWE0YiIsInByb2R1Y2VyUnVuIjoiNDA1MjU4MzYwNjEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjhkZjVkZmQ0ZjlkYzQxNWE1YjJmOWE3MTA0ODljYzQ2NWZkNmMyZGI2ZjJkY2ZmYTRjM2ZhMDFhN2VjYjJlZGIiLCJ2ZXJkaWN0RGlnZXN0IjoiNzU3NTNkMDFiYjYyYzc4MTVjZDNhODU0ZTM0NDcwOTE1ZDA3ODE0YTEwZWE3MTk4YzIwMzc5ZWFkNDQ5ZWQ1MiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5ZDU2Njc5OTc4ZDdhYzJjOWQ3Zjk2ZjM3YjVmNjc1ODdiODc2YTYzNWI4MDRlZWUyYjMwODQ2OWYxZDY5MWYwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQ1NDE1MDc5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk2I2lzc3VlY29tbWVudC02NDQ1NDE1MDc5IiwiYm9keURpZ2VzdCI6ImQ4ZmViZWZiNDBhYzI1NGVjMTNlNjZhNzRiOGI3N2FkNDlmYTIxMWZjMDNhNmYyYzQxZjg1ZjdmNzRlNDk3YzkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `e4c0c75da405` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8654ff02a7b88a718e796729f87a1361cb46d580`
  ```
  git log --all --format='%H %T' | grep 8654ff02a7b8
  ```
- Тело issue: `3b56bf2738e5f500cea0f13047b63ef034ea4f2ae05b7aa2f7749336b4fdaa4b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjAsIm91dHB1dF90b2tlbnMiOjE4ODI0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjc2NTQ4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTQ4NzQyLCJjb3N0VXNkRXN0aW1hdGUiOjAuNjA0MjIwNH1dLCJ0dXJucyI6MTcsImR1cmF0aW9uTXMiOjIxOTA2MCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjA0MjIwNCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=20 output_tokens=18824 cache_creation_input_tokens=76548 cache_read_input_tokens=548742 num_turns=17 -->
