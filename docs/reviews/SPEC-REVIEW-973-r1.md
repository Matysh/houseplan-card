# SPEC-REVIEW — issue #973, заход r1

## Скоуп

Ревью ТЗ (PROCESS.md §2.4) на треке `ask`, этап `spec`, заход r1
(блокирующих циклов 0/4). Материал — тело issue #973, раздел `## ТЗ`, в
текущей редакции (механический preflight по разделам уже пройден после
правки заголовков подразделов, комментарий от 2026-10-20 05:52:38Z).
Задача: восстановление устаревших/осиротевших связей (radar v1, vacuum
`map_routes`, `controls[]`, `value_badge`/`value_source`, LED-лента) при
импорте бэкапа через общий серверный recovery-проход, и та же проверка —
на стороне экспорта, чтобы продукт не создавал файл, который сам же
отвергнет. Исходный баг: присланный ZIP с одним выключенным radar v1,
ссылающимся на удалённую комнату, валит `create_preview`
(`invalid_config: radar room must exist in the marker space`).

Продуктовый код пока не менялся (подтверждено комментарием автора и
`git log --oneline origin/dev..HEAD` — задача ещё не в работе). Ревьюер
ТЗ не правит ни ТЗ, ни код — только оценивает.

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`
   полностью, тело issue #973 и все 6 его комментариев (через `gh issue
   view --json body,comments`, т.к. MCP `get_issue`/`get_issue_comments`
   не получили разрешения в этой сессии).
2. Сверены обязательные разделы ТЗ (PROCESS.md §7.1): сценарий · что
   человек увидит до и после · проблема · скоуп и не-скоуп · контракт
   поведения · UX · модель данных и миграция · i18n · критерии приёмки
   AC1…AC8 с указанием способа доказательства · план автотестов · риски
   · откат · release-артефакты — все присутствуют и озаглавлены
   по форматным требованиям.
3. Сверено соответствие `docs/SCOPE.md` (J4/J6): см. «Проверено и
   корректно».
4. Нормативная таблица «Единый контракт восстановления» построчно
   сверена с действующим контрактом в `docs/CONFIG-COMPATIBILITY.md`
   (строки о `marker.vacuum.map_routes` #162, `marker.controls[]`
   `marker:<id>`-ссылках, `value_badge`/`derived_marker_state.ref`),
   `docs/VACUUM.md` (схема `marker.vacuum`, поле `live`) и
   `docs/RADAR.md` (пауза радара без потери настроек — существующий UX,
   на который новое поведение опирается).
5. Код: `custom_components/houseplan/radar_validation.py` (строка,
   которая валит исходный репорт — `_invalid("radar room must exist in
   the marker space")`), `custom_components/houseplan/validation.py`
   (self-reference/cycle/duplicate-проверка `marker.controls[]`,
   change-aware через `old_controls`/`validate_all`) — чтобы понять, что
   именно предлагаемый контракт меняет относительно действующего кода, а
   не додумывать по тексту ТЗ.
6. `git log`/`git tag`/`docs/CHANGELOG.md` — чтобы проверить заявленную
   классификацию релиза (`stable-fix` относительно предыдущего stable
   v1.81.0) и `docs/release-ledger/v1.81.0/973.json` (ещё не создан —
   ожидаемо для стадии `spec`, код не писался).
7. Файл `REVIEW_FINDINGS_POLICY` сверен построчно с доверенным снимком
   из промпта — совпадает (`mode: issues`, issue 973, stage `spec`,
   round 1).

## Чего не проверял и почему

Стадия `spec`: продуктового кода ещё нет, поэтому `npx tsc --noEmit`,
`npm test`, `npm run build`, golden, smoke, HA harness, инварианты
модели и performance-гейты не прогонялись — им нечего проверять
(AGENTS.md: «Зависимости и Chromium на этапе spec не ставились», #696).
Ручная dev/GPU-приёмка не требуется и не проверялась (owner-decision
2026-10-16, #929). `docs/release-ledger/v1.81.0/973.json` не существует
— это ожидаемо на этой стадии и не является находкой: ledger пишется на
код-ревью. Личный ZIP автора (источник репродукции) не запрашивался и не
просматривался — он прямо объявлен непубликуемым и не входит в
fixtures; это соответствует описанной в ТЗ политике, а не пробел ревью.

## Находки

Находок, блокирующих вердикт (High или Medium в скоупе), нет.

Отдельно отмечаю как **не находку, а риск для код-ревью** (NB, не Low,
решение остаётся автору): AC1 целиком опирается на личный, не
коммитящийся в репозиторий ZIP — у будущего ревьюера кода не будет
доступа к файлу, чтобы перепроверить проход `parse/read_archive/
plan_files/preview/revalidate/prepare_apply`. ТЗ называет способ
доказательства (конкретный список стадий пайплайна), но не фиксирует
формат свидетельства (команда + результат: число пространств/комнат/
маркеров, точный код ошибки до/после) для вставки в коммит/issue —
без него на код-ревью голое «Verified» не будет доказательством
(AGENTS.md, docs/process/REVIEWER.md). Автору стоит явно договориться о
формате пруфа при переходе к реализации; ТЗ-гейт это не блокирует, так
как способ доказательства как таковой назван, а проект уже имеет
прецедент такой же работы с приватными файлами репродукции.

## Проверено и корректно

- **Соответствие SCOPE.md.** Исходный скоуп (J4 «zero to a working
  plan» через мастер импорта, J6 «keep the plan true as the home
  evolves») заявлен ТЗ и подтверждён: импорт/экспорт бэкапа —
  существующая, принятая функциональность этих job, а не новая
  поверхность. Расширение со `track:show` (один radar-кейс) до
  `track:ask` (общий контракт по нескольким namespace, экспорт тоже)
  явно санкционировано владельцем в комментариях от 2026-10-20 05:48 и
  05:50 («исправить аналогичные... те же проверки при экспорте») — это
  не самовольное расширение скоупа агентом.
- **Классификация релиза.** `git log -L` показывает, что строгая
  radar-валидация (`radar_validation.py`, `"radar room must exist in
  the marker space"`) введена коммитом `58f5f1854` от 2026-09-08
  («feat: add presence radar stage 1», #485) — задолго до тега
  `v1.81.0` (релиз `877e49dc1`, `docs/CHANGELOG.md`: 2026-10-16).
  `marker.vacuum.map_routes` (#162) введён 2026-09-03, тоже до
  v1.81.0. Заявленная классификация `stable-fix` («строгий full-import
  validator radar уже есть в v1.81.0») подтверждается историей, а не
  голословна.
- **Контракт для radar/vacuum согласован с действующей документацией.**
  Таблица ТЗ «безопасно выключаем, сохраняя настройки» для radar v1
  (room/allowed_room_ids/scale) и vacuum (`map_routes` → `live:false`)
  переиспользует существующие булевы поля (`radar.enabled`,
  `marker.vacuum.live`, задокументированные в `docs/RADAR.md`
  — «**Use this presence radar** switch pauses an existing radar
  without erasing its configuration» — и `docs/VACUUM.md` —
  `marker.vacuum = { live?, ... }`), а не изобретает новую
  persistent-сущность, что соответствует разделу «Модель данных»
  («новой persistent recovery/quarantine-сущности... нет»).
  Отдельное заявление «Existing dropped_marker_links/unbound_led_strips
  не считаются повторно» корректно разграничивает новую import/export
  recovery-логику от уже задокументированного в
  `docs/CONFIG-COMPATIBILITY.md` поведения single-space export
  (строки 448–455: cross-space `map_routes` уже дропаются и считаются
  в `dropped_marker_links` на этом пути) — новое правило относится к
  другому случаю (полный документ/ZIP с реально отсутствующим
  пространством), пересечения/двойного учёта не создаёт.
- **AC однозначны и называют способ доказательства.** Каждый из AC1–AC8
  помечен категорией (`backend` / `unit/backend` / `smoke` /
  `backend/runtime` / `negative/backend`) и описывает конкретный
  проверяемый инвариант (сохранность состава после восстановления,
  идемпотентность повторного recovery, отсутствие записи в HA до
  Apply, защита от обхода валидации под видом ремонта и т.д.) —
  соответствует требованию §7.1 об указании способа доказательства на
  стадии ТЗ (детальные имена тестов и таблица «чем краснеет» относятся
  уже к код-ревью, не к этой стадии).
- **Не-скоуп и откат названы явно и непротиворечиво**: список
  исключений («восстановление любых повреждённых байтов», «выбор
  первой/ближайшей комнаты», «repair обычного live config при
  экспорте» и т.д.) и откат («revert коммитов задачи», исходный ZIP не
  переписывается) присутствуют, соответствуют требованиям §7.1.
- **Открытых продуктовых вопросов, ошибочно не заданных владельцу, не
  обнаружено.** Проверены формулировки на скрытые развилки (например,
  трактовка «только для выключенного блока» в разделе про допуск
  несогласованности) — они разрешаются однозначно самим текстом
  (ссылка на несуществующую/чужую комнату физически не позволяет
  радару остаться активным, так как целевого объекта для привязки
  нет); отдельного решения владельца это не требует.

## Побочные находки

Побочных находок нет. (Политика `REVIEW_FINDINGS_POLICY`: `mode:
issues`, `issue 973`, `stage spec`, `round 1` — маршрут для Medium вне
скоупа был бы «отдельный issue со ссылкой на #973»; поводов его
применять не возникло.)

## Вердикт

Зелёный. High: 0, Medium: 0. ТЗ полно, разделы на месте, AC однозначны
и называют способ доказательства, заявленная классификация релиза и
переиспользуемые механизмы проверены по истории и действующему коду —
несоответствий не найдено. Бюджет циклов не расходуется (зелёный
вердикт цикла не образует, PROCESS.md §4).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `f34e6a6f488d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `db69c27781fdeb67a79bda99da20cbb6595e92c0`
  ```
  git log --all --format='%H %T' | grep db69c27781fd
  ```
- Тело issue: `2d3a66372cda1f622a09ea72a44ebb2bf52452360e121f32546ee4cffa2ec8f3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzYsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODc2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Niwib3V0cHV0X3Rva2VucyI6NDM4NzUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE1Mzc2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mjk5MDQ4MiwiY29zdFVzZEVzdGltYXRlIjoxLjQ5ODQ4MjM5OTk5OTk5OTl9XSwidHVybnMiOjQ5LCJkdXJhdGlvbk1zIjo1Mjg2NTAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjUwMzM1ODQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4842 output_tokens=43895 cache_creation_input_tokens=115376 cache_read_input_tokens=2990482 num_turns=49 -->
