# SPEC-REVIEW-1076-r1

Issue: #1076 — «Стены: лишний внутренний отрезок на плавном изгибе внутри штриховки»
Трек: `track:ask` · Этап: `spec` · Заход: r1 · Блокирующих циклов: 0/4
Материал: тело issue #1076, `bodyDigest 950627ede2c5b455fc1111a810aa186f2399bd0b91821c4f68dad952f70f1b46`
(раздел `## ТЗ`, редакция 1, 26.10.2026, основание по коду — принятый `dev 98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`).
Маршрут (#726): `fix`.

## Скоуп ревью

Оценивается ТЗ в теле issue #1076 (PROCESS.md §2.4, §7.1): обязательные разделы,
однозначность и доказуемость каждого AC, осуществимость контракта поведения
относительно текущего кода. Продуктовый код не менялся (аналитика и ТЗ это
прямо фиксируют); кодовый Validate на этом этапе не требуется.

Какую строку `docs/SCOPE.md` обслуживает задача: J1 («показать дом целиком»),
J4/J6 (плавное, точное отображение плана, построенного без Inkscape/CAD) —
дефект рендера стен искажает читаемость плана на View/Flat/2.5D/static
поверхностях, что прямо попадает в основную миссию «spatial at-a-glance».

## Как проверялось

Читался канон в заданном порядке: `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, тело issue #1076 целиком (включая оба комментария
владельца — аналитику S2→S3 и передачу ТЗ на ревью), `PROCESS.md` §7.1/§2.4/§2.5,
`docs/WALL-THICKNESS.md` целиком (канонический документ подсистемы, на
которую ссылается задача).

Проверка осуществимости ТЗ проводилась статическим чтением кода (Read/Grep),
без исполнения build/test — на этапе spec это не требуется, и ни один AC не
подразумевает уже выполненную проверку. Конкретный проверяемый вопрос был
один: действительно ли названные в разделе «Модули» объекты (`src/physical-geometry.ts`,
`src/wall-shell-union.ts`, `linearWallJoinPatches`, `physicalBodySet`,
`wallBodiesGeometry`) существуют и лежат на пути реального рендера, а не в
неиспользуемом служебном коде. Ответ подтверждён чтением:

- `physicalBodySet`/`physicalBodyParts` определены в `src/physical-geometry.ts:282,
  src/physical-geometry.ts` (функция `physicalBodyParts` строит `patches` через
  `linearWallJoinPatches(partitionSegments, epsilon)` — `src/physical-geometry.ts:274`,
  а сама `linearWallJoinPatches` определена в `src/wall-thickness.ts:1260`).
- `physicalBodyParts(...).all` — реальный вход живого рендера: вызывается из
  `src/houseplan-card.ts:9644,10550` и `src/space-render.ts:406,795` (через
  `extraBodies` в `wallBodiesGeometry`, `src/wall-thickness.ts:3724`), то есть
  это не «параллельный», а основной путь кладки независимых перегородок,
  включая сценарий из бэкапа (`rooms: []`, три независимые `partitions`).
- `wall-shell-union.ts` (`canonicalComputedWallGeometry`,
  `unionWallShellGeometry`) действительно отвечает за объединение «masonry ∪
  exterior shell» с ретраем по каноническим координатам — релевантно для
  соседних случаев с комнатами, хотя в точном фикстуре issue (без комнат)
  этот путь, видимо, не задействован напрямую.
- `docs/WALL-THICKNESS.md` §3 прямо описывает механизм, который ТЗ предлагает
  чинить: «Independent partition segments keep flat raw quads for editor
  identity, but exact endpoint↔endpoint ... nodes add computed join patches
  before the presentation union... ordinary corners use the same bounded
  `MITRE_LIMIT = 4` rule». Гипотеза ТЗ (внутренний торец/вырожденный
  union-контур на стыке с близким к 180° углом) согласуется с этим
  инвариантом и не противоречит ни одному зафиксированному правилу подсистемы.

Других непокрытых конкретных вопросов, оправдывающих адресную проверку
осуществимости или negative-input case, не возникло — дальнейшее исполнение
не запускалось.

### Перечень гейтов

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/gate:small | нет | этап spec, кодовый Validate не требуется (PROCESS.md §2.4/§8, docs/process/REVIEWER.md «Ревью ТЗ») |
| ci:golden/смоки/invariants | нет | кода и диффа ещё нет, нечего прогонять на этапе spec |
| адресная проверка осуществимости (чтение кода) | да | единственный конкретный вопрос — существование и реальная задействованность названных в ТЗ модулей/функций; результат выше |
| run_check (fixed-check runner) | не вызывался | не возникло исполнимого негативного/осуществимостного кейса, требующего прогона; все проверки закрылись чтением исходников |

## Находки

Блокирующих (High) и Medium-находок не обнаружено.

Низкая (Low, снимается ревьюером с записью, не открывает цикл): раздел
«Модули» формулирует список как «`src/physical-geometry.ts`,
`src/wall-shell-union.ts`, функции `linearWallJoinPatches`/`physicalBodySet`»,
что можно прочитать как утверждение, что обе функции лежат в одном из двух
названных файлов. Фактически `physicalBodySet` действительно в
`physical-geometry.ts`, а `linearWallJoinPatches` — в `src/wall-thickness.ts`
(см. «Как проверялось»). Это не создаёт неоднозначности для разработки или
ревью кода: раздел прямо помечен как «точный минимальный набор определяется
свидетелем», я независимо подтвердил, что все названные символы существуют и
лежат на реальном пути рендера сценария из бэкапа, и ни один AC не зависит от
точного файла. Снимаю без возврата автору.

## Что проверено и корректно

- Обязательные разделы ТЗ по §7.1 присутствуют полностью: сценарий · что
  человек увидит до/после · проблема и основание · скоуп/не-скоуп · контракт
  поведения · UX и touch · модель данных и миграция · модули · i18n · AC1…AC5
  с указанием доказательства · план автотестов · риски и производительность ·
  откат · release-артефакты · «принято предположительно».
- Первые два раздела продуктовые и отвечают на нужные вопросы: персона
  (администратор/семья, J1/J4/J6), поверхность (план с независимыми стенами),
  и отдельная фраза «что человек увидит» без терминов реализации.
- Каждый AC (AC1–AC5) имеет однозначный наблюдаемый результат и явно названный
  способ доказательства (smoke+pixel/golden, unit геометрии, golden, smoke
  сравнения кадров, unit/round-trip) — требование DoR §2.5 выполнено.
- Входные координаты точно воспроизводят бэкап владельца (три независимые
  перегородки 15 см, угол ~9,2276°, `cell_cm: 1`, без комнат/проёмов/колонн) —
  пригодны для синтетического минимального фикстура без копирования файла
  пользователя целиком.
- Контракт поведения (п.1–6) корректно запрещает типичные «обходные» дефекты:
  маскировку швов косметическим фильтром, полное удаление контуров, раздувание
  epsilon для слияния соседних стен, нормализацию пользовательских данных,
  регрессии в zoom/pan/reload. Это прямо соответствует разделу «Standing
  rule» в `docs/SCOPE.md` (никогда не менять файл пользователя по догадке) и
  инвариантам `docs/WALL-THICKNESS.md` (hatch density — физическая величина,
  раздутие epsilon запрещено).
- Негативные случаи в AC3/плане автотестов (прямое продолжение, обычный угол,
  свободный конец, разные толщины, близкие несоединённые стены) покрывают
  ровно то пространство, где легко сломать соседнее поведение при попытке
  зачинить этот конкретный стык.
- i18n/миграция/данные — корректно «нет», так как фикс чисто вычислительный/
  рендерный и не меняет конфигурацию.
- Риски (precision при почти коллинеарных рёбрах, perf — не делать лишний
  union на каждый pan/кадр, touch pan/pinch) и откат (вернуть render-патч, не
  требовать новой миграции) заполнены содержательно, не формальной отпиской.
- Продуктовых вопросов, вынесенных владельцу, в ТЗ нет; я не нашёл скрытого
  продуктового вопроса, который следовало бы туда вынести — выбор
  render-only/geometry-фикса явно зафиксирован как технический и отдан
  «измеренному свидетелю», что корректно для раздела «принято предположительно».
- Классификация stable-fix/line-fix сознательно отложена до S7 — это разрешено
  DoR (§2.5) и не блокирует «Готово к разработке».

## Чего не проверял

- Не запускал build/tsc/test/gate:small/golden/invariants — не требуется на
  этапе spec (кода ещё нет, чинить нечего).
- Не выполнял мутационное тестирование и не трогал исполняемую реализацию —
  запрещено вне ночного workflow и не нужно для оценки ТЗ.
- Не проверял реальное воспроизведение дефекта на живой HA-установке — ТЗ
  честно фиксирует, что это ещё не сделано, и прямо требует получить такого
  красного свидетеля первым шагом исполнения (контракт поведения п.1); это
  корректно отложено на этап реализации/код-ревью, а не является пробелом ТЗ.
- Не проверял docs/release-ledger — записи для #1076 ещё нет, что ожидаемо на
  этом этапе.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 →
нет · Документ: docs/reviews/SPEC-REVIEW-1076-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjJiMTBhZGE3OGM5OWEyZTk0YzMwYWVmYzZlNDYwMmQ5MGZhOWExMDdhNWVmOGViNGQ5MjM3MGZlM2M3NTMwNTIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2M2VlN2EyNzZhMGFhNmM5MzEzMzVlNGE4YjRmNTA1YjkyZTVjN2ZmZDgwZmIxMDFhNGU0OWM2Y2Y2ZDNlMzFiIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc2LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1Y2ZhOTNiMzIzMDBmODZhYmJhOTk1OTI1NTA5ZjA2MTE4ZTA5OTQ1IiwidHJlZSI6IjBlN2U0NGUyYTY2NTNhYWM1YTI5ZTY0ZGQxODg0MjQzZjI4ODVjZTQiLCJib2R5RGlnZXN0IjoiOTUwNjI3ZWRlMmM1YjQ1NWZjMTExMWE4MTBhYTE4NmYyMzk5YmQwYjkxODIxYzRmNjhkYWQ5NTJmNzBmMWI0NiIsInByb2R1Y2VyUnVuIjoiNDAyNTI1MjA5MDIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijc5MDI1NjFjMDQwNTExMzE1NzYyYjllOTAxNmRlYzcyOTU1MDFkMzA5Njg2MzE3MjNjNjBhYWM3N2ZkNzQ3MWIiLCJ2ZXJkaWN0RGlnZXN0IjoiOTRkYzQxNWI2YmVkYjM5YWI1ZjdiZWMxZWM1YTEwZTBkMTExYmRmMmFkZTQ1ZDdhZGJmYzBiNTMxYjgxNDE4MSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3MGUxNTYwNzhkZTYxODJiNTM5YTM0MjUzMTkyYzdkOGY0M2E0NjQ5ZDY5MTZhMzg4ZjYyNGVkMDU2MWVhMWFhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2MDQyMzM4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc2I2lzc3VlY29tbWVudC02NDA2MDQyMzM4IiwiYm9keURpZ2VzdCI6ImFkZjY5ZWI1NWRkZDkxNzcyNmUxNGVhNjlhZTk2MDc1OTdlZmNjMTVlNWU5YWYzZTI0NjIyNDJiMWYwNGRhNGUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5cfa93b32300` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0e7e44e2a6653aac5a29e64dd1884243f2885ce4`
  ```
  git log --all --format='%H %T' | grep 0e7e44e2a665
  ```
- Тело issue: `950627ede2c5b455fc1111a810aa186f2399bd0b91821c4f68dad952f70f1b46`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjI4MTU2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNjI1MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE3OTkzOTAsImNvc3RVc2RFc3RpbWF0ZSI6MS4xMDY1MjJ9XSwidHVybnMiOjM4LCJkdXJhdGlvbk1zIjozNjE3OTYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjEwNjUyMiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=42 output_tokens=28156 cache_creation_input_tokens=116250 cache_read_input_tokens=1799390 num_turns=38 -->
