# SPEC-REVIEW — issue #1079, заход r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Документ: docs/reviews/SPEC-REVIEW-1079-r1.md

Материал: тело issue #1079 (раздел `## ТЗ`, редакция 1 · 26.10.2026 · `track:ask`),
основание по коду — принятый dev `98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`. Трек —
`ask` (владелец 26.10.2026: «провести задачу по процессу до S8»); спорных
вопросов по треку нет — сложность/риск геометрии и видимого контракта сами
по себе требуют `ask`, автор обосновал это в аналитике S2→S3.

## Скоуп

Задача обслуживает core job J1 `docs/SCOPE.md` («live spatial overview») —
точность визуального представления того, что сейчас физически освещено.
Не затрагивает редакторы, HA-команды, миграцию схемы. ТЗ прямо разводит эту
задачу с #1078 (солнечный доступ, `room.sun_transparent`) и с «Пропускает
свет» — пересечения скоупа нет.

## Как проверялось

Ревью этапа spec: кодовый Validate не запускался (не требуется, #696/REVIEWER.md
«Ревью ТЗ»). Проверка — чтение материала и сопоставление каждого утверждения
«Проблемы»/«Контракта поведения» с реальным кодом и канонами:

- `src/logic.ts` — `isInteriorLightOpeningType` (door/gate/passage allowlist,
  строки 334-338), `openingAmount` (318-332), `openingLightApertureLength`
  (380-384), `openingLightStateSignature` (365-377, фильтр только door/gate) —
  подтверждает описанный allowlist и то, что контакт окна сегодня нигде не
  входит в сигнатуру кеша (контракт п.7 не ломает существующий фильтр).
- `src/glow-scene.ts` — `resolveLightBarrierRevision` (261-310): уже существует
  геометрическая проверка «пол по обе стороны проёма в пределах пространства»
  (`onFloor` с offset-пробами по нормали), применяемая к любому типу проёма,
  но отфильтрованная до door/gate/passage через `isInteriorLightOpeningType`.
  Это именно тот механизм, который ТЗ предлагает расширить на `window`
  (раздел «Принято предположительно») — расширение локально и не требует
  новой системы распространения света.
- `docs/LIGHT.md` — разделы «What stops light» и «Source placement» дословно
  описывают сегодняшнее поведение, которое ТЗ меняет («windows: an indoor lamp
  must not wash the street», «If the source centre is inside … a window
  tunnel … the source produces no Glow at all»); раздел «Caching» подтверждает,
  что геометрический fingerprint уже не зависит от камеры/`_cfgEpoch`
  (контракт п.7, «движение камеры не пересобирает барьеры»).
- `docs/WALL-THICKNESS.md` (228, 599, 735, 781, 841, 889) — подтверждает, что
  оконный тоннель уже существует как геометрическая вырезка стены наравне с
  дверью/воротами на уровне presentation/room-floor cuts, а не изобретается
  заново — делает «использовать существующие cuts/visibility» реалистичным.
- `docs/ISOMETRIC.md` (181-201) — 2.5D-слой переиспользует тот же floor SVG
  («existing floor SVG … Glow, sun») и не строит собственный источник Glow —
  подтверждает AC5 («Flat/2.5D … используют одинаковую область») без
  дополнительного объяснения в ТЗ: паритет получается архитектурно, не
  отдельной синхронизацией.
- `docs/PDF-EXPORT.md` — PDF полностью исключает Glow, SVG-экспорт захватывает
  уже отрисованный View; значит «поддержанное static представление» из
  контракта п.6 корректно не включает экспортные поверхности, и ТЗ не должно
  было их перечислять.
- `docs/USER-GUIDE.ru.md` (1487-1497, 2364-2371) — подтверждает действующую
  терминологию «внутренние/наружные окна» (уже используется для солнца) и
  действующую пользовательскую формулировку «окно … для света глухо», которую
  ТЗ обязано поменять в release-артефактах — раздел «Release-артефакты» это
  называет явно.
- Манифест `run_check` (REVIEW_CHECKS) подтверждает, что `test/logic.test.mjs`,
  `test/glow-scene.test.mjs`, `test/light-visibility.test.mjs`,
  `test/physical-geometry.test.mjs` уже существуют как unit-гнёзда для
  заявленного плана автотестов — инфраструктура доказательства не придумана.

Отдельно разобран пограничный случай «окно между обычной комнатой и
комнатой-террасой»: терраса в этом продукте — обычная комната с полом (нет
отдельного schema-типа «улица»), поэтому по буквальному определению ТЗ
(«пол по обе стороны») такое окно корректно классифицируется как внутреннее
и пропускает Glow на террасу. Это не конфликтует с «не выпускать свет
наружу»: «наружу» в ТЗ означает именно непокрытую планом территорию за
внешней стеной, а не любую комнату с нестандартным назначением. Проверено
чтением, не исполнением; предмета для обращения к владельцу не нашёл.

Адресных проверок осуществимости/negative-input не потребовалось: ни одно
утверждение ТЗ не разошлось с кодом/документами при чтении, поэтому не было
конкретного непокрытого вопроса, оправдывающего исполнение.

## Разделы ТЗ (§7.1)

Все обязательные разделы на месте: сценарий, что человек увидит до/после,
проблема, скоуп и не-скоуп, контракт поведения (7 пунктов), UX и touch,
модель данных и миграция, i18n, критерии приёмки AC1-AC6 с колонкой
«Доказательство», план автотестов, риски (все 6 классов §2.6 — async/
данные-права/геометрия/визуал/объём-perf/host-input), откат, release-
артефакты. Два продуктовых раздела («Сценарий», «Что человек увидит») отвечают
на требуемые вопросы персоны/поверхности/момента одной фразой, без терминов
реализации.

## Находки

Нет High. Нет Medium. Нет Low.

Каждый AC однозначен и имеет названный способ доказательства:

- AC1-AC4 — защитные/контрактные утверждения (валидный/невалидный тоннель,
  fail-dark, независимость от contact) с названными unit+smoke/golden
  доказательствами, включая явно перечисленные negative inputs в «Плане
  автотестов» (второй пол отсутствует, неверный host, будущий тип, частичная
  наружная сторона, наружное окно) — на этапе spec это и есть требуемое
  «чем краснеет»: конкретный отрицательный случай назван текстом, его
  регистрация как мутанта/свидетеля — дело код-ревью, не ТЗ.
- AC5 — явно разводит, что инвалидирует кеш (geometry), а что нет (pan),
  проверяемо через уже существующий `test/light-barrier-pass.test.mjs`/
  `glow-scene.test.mjs`.
- AC6 — регрессия соседних классификаторов, доказывается существующими unit
  + ревью кода.

Технических вопросов, вынесенных владельцу, в ТЗ нет; единственный найденный
при разборе пограничный случай (терраса как «комната») решается по тексту
самого ТЗ без домысливания и не требует отдельного вопроса.

## Что проверено и корректно

- Соответствие «Проблемы» реальному коду (`isInteriorLightOpeningType`,
  allowlist) — точное.
- Переиспользование существующей геометрической «floor on both sides»
  проверки вместо новой модели распространения света — архитектурно
  обосновано действующим кодом.
- Явное разведение с #1078/`room.sun_transparent` и с опцией «Пропускает
  свет» — непротиворечиво, скоуп не пересекается.
- Терминология «внутреннее/наружное окно» совпадает с уже используемой в
  `USER-GUIDE.ru.md` для солнца — не изобретена заново.
- Release-классификация (`major`) и список документов для обновления
  (LIGHT/USER-GUIDE/ARCHITECTURE) названы, с явной оговоркой «окончательно
  проверить базу до S7» — соответствует тому, что release-ledger файл
  создаётся до S7, а не на этапе spec.
- Откат описан предметно (вернуть allowlist, не хранить два рабочих пути
  параллельно) — соответствует требованию «что удалено взамен добавленного».

## Чего не проверял

- Кодовый Validate (tsc/build/gate:small/npm test) — не требуется на этапе
  spec (REVIEWER.md «Ревью ТЗ», #696); код ещё не написан.
- Реальное выполнение golden/smoke-сценариев из «Плана автотестов» — их
  ещё нет, это предмет код-ревью.
- Решение по разработке (как именно принудительно установить amount=1 для
  окна при построении cut-геометрии; как именно переиспользовать
  `isInteriorLightOpeningType`/`onFloor`) — ТЗ сознательно оставляет это в
  «Принято предположительно, поменять свободно»; не предмет ревью ТЗ.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/`gate:small` | Нет | Этап spec: кодовый Validate не требуется, кода ещё нет |
| Зависимости/Chromium, smoke/golden | Нет | Не ставятся на этапе spec (#696) |
| Адресная проверка осуществимости/negative-input | Нет | Ни одно утверждение ТЗ не разошлось с прочитанным кодом/документами — конкретного непокрытого вопроса, оправдывающего исполнение, не возникло |
| `run_check` (манифест) | Не вызывался | Нужен был только для подтверждения существования файлов тестового плана — это сделано чтением (Glob/Grep в манифесте), исполнение не требовалось |

## Маршрут

route: fix (этап spec, трек `ask` — не `show`, `reclassify` не применяется).

## Побочные находки (REVIEW_FINDINGS_POLICY: mode=issues)

Побочных находок нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjZjYjA0ZDlmNTcwNTdlNzFmYWYyMmE4MWVhODMzZjNhM2U4YTJmNWNhNGIyN2Q5YTYxZDg4YmY1ZTlmMGE1YjUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxYmQ2YTBiNzc3ZWE2NGNlYTBjYjc5OTZhZTU0YTg3YmM3NGJlNTMwMzRlOTU1N2YxNjQwMTkyYzVjOWY3MTE3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc5LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1Y2ZhOTNiMzIzMDBmODZhYmJhOTk1OTI1NTA5ZjA2MTE4ZTA5OTQ1IiwidHJlZSI6IjBlN2U0NGUyYTY2NTNhYWM1YTI5ZTY0ZGQxODg0MjQzZjI4ODVjZTQiLCJib2R5RGlnZXN0IjoiYzUxYzE1Mjk1ZDUzZDM5MGE1MjY2MWFlOTk3OTU3MzlhMzMxM2M3MjQ4MGZlOGVmYzlkZDAxNzA4YzVhYTZmOCIsInByb2R1Y2VyUnVuIjoiNDAyNTI1MTIyNjgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjExMmQ4YzY1ZDViMGM2MWI3NzFjODVjMTYxMzJmMjIzN2I0NGE0NDEyZmQ0MjI3OTg5NDg0MDJmYzg0OWFjYjkiLCJ2ZXJkaWN0RGlnZXN0IjoiOWI2YWNlNjQ0OGVjODdhMzY0ZGU4OGQ1YTk0Mjc4NDIzNGQyOTcyMDI3OWQ1YTQyMWQwYWYxMDdjZDM2MGQ3MSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3NjY3MjExNWNlODRkNmIxYmJkOTE1MmI0Y2YyNTViOTk3MTI1OGYyZDY0MjczODllMDE1MWY5NDE5MGJmZWI3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2MDQ4NTIxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc5I2lzc3VlY29tbWVudC02NDA2MDQ4NTIxIiwiYm9keURpZ2VzdCI6Ijc0YTBhZjNjZjBmMTkzNDJlZjU3NmIyYTg2N2ZiMzkwNGJiZDMwZTg0YmQ2MjZkZDdkNzBhMGEzODM4ZTgwMGEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5cfa93b32300` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0e7e44e2a6653aac5a29e64dd1884243f2885ce4`
  ```
  git log --all --format='%H %T' | grep 0e7e44e2a665
  ```
- Тело issue: `c51c15295d53d390a52661ae99795739a3313c72480fe8efc9dd01708c5aa6f8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjMwNDI0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyMjM5MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE0NzI2NDIsImNvc3RVc2RFc3RpbWF0ZSI6MS4wODg0MTI0MDAwMDAwMDAyfV0sInR1cm5zIjoyOCwiZHVyYXRpb25NcyI6Mzk1NTI0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wODg0MTI0MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=40 output_tokens=30424 cache_creation_input_tokens=122391 cache_read_input_tokens=1472642 num_turns=28 -->
