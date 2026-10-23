# SPEC-REVIEW-1045-r2

## Скоуп

Issue #1045 — «Редактор плана: безопасное удаление узла через контекстное
меню», трек `ask`, заход r2 (1/4 блокирующих циклов израсходовано до этого
вердикта). Продуктовый запрос не изменился с r1: в редакторе Плана (Select)
правый клик на структурном узле B между стенами A–B/B–C добавляет пункт
контекстного меню «Удалить узел», который заменяет две стены одной A–C,
сохраняя A/C на месте; операция разрешена только при ровно двух физических
стенах в узле и безопасной итоговой геометрии, иначе пункт недоступен и план
не меняется. Продуктовая строка — J4/J6 (`docs/SCOPE.md`, строки 51 и 53):
«от нуля до рабочего плана без Inkscape/YAML» и «держать план достоверным по
мере жизни дома».

Кодовых изменений нет: материал — ровно тело issue
(`material.sha` = `05c21794a89c06df61cbd3e02d49f97297352c8b`, рабочая копия на
нём; `bodyDigest` REVIEW_CONTEXT =
`6baaac76e880992571786aa5a9483ef4c7c1e60692696b78754853a410069a3f`, отличается
от r1 — `d4e5d644b91b147d308ea85a4aa616a33b93546e59ad7bba0ede5bf85fbc394f` —
что подтверждает фактическое изменение тела между раундами). Единственная
находка r1 (жёлтый, Medium в скоупе: не названа итоговая формулировка строк
write_conflict/write_unavailable/update_required для node_delete) —
предмет этого раунда; остальная ТЗ по заявлению автора (комментарий 21:17:20)
не менялась.

## Как проверялось

Static-first (#857): обязательные источники роли reviewer —
`docs/SCOPE.md` (строки J4/J6), `AGENTS.md` («Read this first», Rule #1,
треки, §1 классы изменений), `docs/process/REVIEWER.md` целиком (позиция,
«Отрицательные проверки и мутанты», «Ревью ТЗ», «Повторный раунд», «Находки и
вердикт») — прочитаны заново в этом раунде. Прочитано тело issue #1045
целиком и все 7 текущих комментариев GitHub (`gh issue view 1045 --json
comments`), включая авторский анализ 21:02:27, preflight-отказ/исправление
21:04:01/21:05:28, вердикт пайплайна r1 21:14:52 и авторский комментарий о
правке 21:17:20.

Разбор по дельте (§2.10, конспект «Повторный раунд»): найден и прочитан
документ и материал r1 — `docs/reviews/SPEC-REVIEW-1045-r1.md` (вердикт
жёлтый, High 0, Medium 1, материал — тело issue на коммите `6186cd19e141`).
Единственная предметная правка — раздел «Файлы и i18n»: вместо прежней
формулировки «update/conflict/unavailable используют существующие
согласованные общие сообщения либо прямые localized аналоги» текущее тело
прямо вводит три новых ключа с конкретным RU/EN текстом: `node_delete_write_
conflict` («The plan changed. Reopen the menu and try deleting the node
again.» / «План изменился. Откройте меню заново и повторите удаление узла.»),
`node_delete_write_unavailable` («Could not delete the node. Try again.» /
«Не удалось удалить узел. Повторите попытку.»),
`node_delete_update_required` («Update the House Plan integration to delete
wall nodes.» / «Для удаления узлов стен обновите интеграцию House Plan.») —
и явно закрывает развилку: «Тексты node_move_* не переиспользуются: удаление
не называется перемещением». Это буквально вариант (b) из ремедиации r1
(«завести три новых … с конкретной RU/EN формулировкой»), не вариант (a)
(переиспользование move-текстов).

Эта правка задевает AC4 («Ошибка транспорта/серверный отказ не принимает
локальную геометрию») и AC6 («Старый backend даёт update-required») — оба
перечитаны в текущей редакции тела и сверены с новыми ключами: формулировки
соответствуют сценариям (CAS/stale-revision конфликт, общий серверный отказ,
устаревший backend). Остальные разделы (сценарий, что видит человек,
скоуп/не-скоуп, контракт геометрии и безопасности пп.1–6, UX/права/lifecycle,
модель данных/writer/история/совместимость, пять исходных i18n-ключей
node_delete/node_delete_history/node_delete_degree/node_delete_unsafe/
node_delete_opening, AC1–AC3/AC5/AC7, риски/откат/release-артефакты, «принято
предположительно») сверены построчно с текстом, который цитирует и пересказывает
r1-документ, — совпадают дословно или перефразировкой без смысловых
расхождений; делта в них отсутствует, повторная проверка подсистемных
документов (`docs/WALL-THICKNESS.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/STYLING-HOOKS.md`, `docs/DEVICE-PRESENTATION.md`, `docs/USER-GUIDE.ru.md`
§8) не требуется — они приняты унаследованно (раздел ниже).

Кодовый Validate на этапе spec не требуется и не запускался (`tsc`, `build`,
`npm test`, `gate:small`, mutation-gate) — отсутствие CI на SHA документа
ревью не причина их запускать. Единственный непокрытый вопрос этого раунда
(реальны ли новые тексты как самостоятельные ключи, а не косметическая
подмена) закрыт обычным чтением тела issue — конкретные EN/RU строки
процитированы в теле дословно, адресная код-проверка не требовалась.
Зависимости/Chromium не ставились (#696).

## Находки

Находок нет — ни High, ни Medium, ни Low, в скоупе и вне его.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
| --- | --- | --- |
| Medium: не названы итоговые строки для `write_conflict`/`write_unavailable`/`update_required` у `node_delete` — развилка между реиспользованием `node_move_*` и новыми ключами оставлена открытой | Автор выбрал вариант (b) из ремедиации r1: введены три новых операционно-специфичных ключа с точным RU/EN текстом, и явно исключено реиспользование move-текстов | Тело issue, раздел «Файлы и i18n»: «Для отказов вводятся ровно три новых operation-specific ключа: `node_delete_write_conflict` — … ; `node_delete_write_unavailable` — … ; `node_delete_update_required` — … . Тексты node_move_* не переиспользуются: удаление не называется перемещением.» Подтверждено авторским комментарием 2026-10-23T21:17:20Z: «Исправлен единственный Medium SPEC r1 … Вариант reuse move-текстов исключён.» |

## Унаследовано из r1

Принято без повторной проверки — разделы ТЗ, не задетые дельтой; основание —
`docs/reviews/SPEC-REVIEW-1045-r1.md` (вердикт жёлтый, High 0, Medium 1,
материал тело issue на `6186cd19e141953ab85e459f06b7745f8f70d5b8`,
`bodyDigest` `d4e5d644b91b147d308ea85a4aa616a33b93546e59ad7bba0ede5bf85fbc394f`):

- Обязательные разделы §7.1 присутствуют по содержанию (сценарий · что видит
  человек · скоуп/не-скоуп · контракт геометрии и безопасности · UX/права/
  lifecycle · модель данных/writer/история/совместимость · файлы и i18n ·
  AC1–AC7 с доказательством · риски/производительность/откат/release).
- AC1–AC3, AC5, AC7 однозначны и несут названный способ доказательства
  (TS/Python kernel parity + smoke; negative unit/backend + browser; unit/
  backend TS/Python parity + HA writer test; kernel/backend/history unit +
  smoke; targeted browser assertions + review existing shared projections) —
  текст AC не менялся между r1 и r2.
- Геометрическая модель переиспользует #803 (`docs/WALL-THICKNESS.md`,
  «coincident owners do not multiply physical rays», классы degree 1–6/T/X);
  rehost проёма (AC3) — существующий примитив (`opening_repair.py`,
  `validation.py`); capability-паттерн `wall_node_delete_api: 1` — существующий
  механизм (`websocket_api.py`, `"wall_node_move_api": 1`); пять исходных
  i18n-ключей (`node_delete`, `node_delete_history`, `node_delete_degree`,
  `node_delete_unsafe`, `node_delete_opening`) следуют конвенции `node_move_*`.
  Все прочитаны чтением в r1, код между раундами не менялся (его и не было).
  Проверено, что новая i18n-правка их не затрагивает (другой фрагмент текста).
- Отсутствие побочных рисков по устройствам/декору/стилям
  (`docs/STYLING-HOOKS.md`, `docs/DEVICE-PRESENTATION.md`), touch — best
  effort/degraded, View/Flat/2.5D/static/PDF без нового рендерера (AC7),
  откат — обычный follow-up, release-артефакты (`User-Visible: yes`, оба
  changelog, `major`, `docs/release-ledger/v1.82.0/1045.json`) — путь и
  классификация не менялись между раундами.
- Открытых продуктовых вопросов владельцу нет: спорная трактовка
  A–B–C→A–C для угла разобрана автором в комментарии 2026-10-23T21:02:27Z
  («ровно два физических направления не равно числу владельцев одной общей
  стены»), решена по существу, вопросом владельцу не осталась.

## Что проверено и корректно

- Правка раздела «Файлы и i18n» однозначно закрывает Medium r1: три новых
  ключа `node_delete_write_conflict`/`node_delete_write_unavailable`/
  `node_delete_update_required` с конкретным RU/EN текстом, явный отказ от
  реиспользования `node_move_*`-формулировок.
- Новые тексты согласованы со сценариями AC4 (CAS/транспортный отказ) и AC6
  (устаревший backend → update-required): ни один не говорит про
  «перемещение», каждый называет операцию удаления узла.
- Naming convention соблюдена: `node_delete_write_conflict`/
  `node_delete_write_unavailable`/`node_delete_update_required` следуют той же
  схеме `<feature>_<reason>`, что существующие `node_move_write_conflict`/
  `node_move_write_unavailable`/`node_move_update_required` — три новых ключа
  добавляются к пяти, названным в r1, итого восемь новых ключей, без
  переименования существующих `node_move_*` (риск регрессии #803,
  названный в r1 как следствие варианта (a), не материализовался — выбран
  вариант (b)).
- Раздел «Принято предположительно» не перечисляет i18n-формулировки отказов
  как допущение — следовательно, прежняя двусмысленность не просто скрыта
  пометкой «на усмотрение исполнителя», а снята текстом по существу.
- Побочная политика находок (доверенный снимок
  `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`, `mode=issues`, `issue=1045,
  stage=spec, round=2, path=null`) сверена с `REVIEW_FINDINGS_POLICY` —
  файл совпадает со снимком из промпта, расхождений нет; побочных находок и
  так нет, маршрут не применяется.
- Лейблы issue на момент ревью: `S4-spec-review`, `track:ask`, `P2`,
  `feature`, `geometry` — соответствуют этапу/треку, под которые готовился
  этот документ.

## Чего не проверял

- Не перечитывал заново `docs/WALL-THICKNESS.md`, `opening_repair.py`,
  `validation.py`, `websocket_api.py`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/STYLING-HOOKS.md`, `docs/DEVICE-PRESENTATION.md`,
  `docs/USER-GUIDE.ru.md` §8 — дельта их не касается, раздел «Унаследовано
  из r1» принимает их проверку r1 без повтора (§2.10).
- Не запускал `tsc`/`build`/`npm test`/`gate:small`/mutation-gate — на этапе
  spec кодовый Validate не требуется, продуктового кода нет.
- Не исполнял и не регистрировал мутантов, не патчил реализацию — единственный
  непокрытый вопрос раунда (реальность новых i18n-текстов) закрылся обычным
  чтением тела issue.
- Не проверял свежесть golden/скриншотов (#697) и не устанавливал
  зависимости/Chromium (#696) — ни один пробел AC этого раунда не требовал
  адресной проверки через демо/браузер.
- Не читал возможный локальный черновик автора (Spec-Draft, §11.8) — по
  правилу ревью ТЗ он не читается и доводом не считается.
- Детальная раскладка TS/Python helper-модулей, survivor-ID алгоритм,
  представление сессионного menu target — по-прежнему «принято
  предположительно, поменять свободно» (техническое, не предмет ревью ТЗ).

## Побочные находки

Побочных находок нет.

## Вердикт

Зелёный. High — 0, Medium — 0. Единственная находка r1 (не названа итоговая
формулировка строк write_conflict/write_unavailable/update_required)
закрыта: автор ввёл три новых операционно-специфичных ключа с точным RU/EN
текстом и явно исключил реиспользование move-формулировок. Остальное
содержание ТЗ не менялось между раундами и уже было признано корректным в
r1 (все обязательные разделы, все семь AC с однозначным способом
доказательства, геометрический и backend-контракт, совместимость,
release-артефакты). Открытых продуктовых вопросов владельцу не осталось.
Зелёный вердикт цикла не образует и не тратит бюджет §4 — блокирующих
циклов остаётся израсходовано 1 из 4.

Маршрут: `route: fix` (задано промптом для этого ревью; зелёный вердикт
маршрут не применяет — задача движется дальше).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `05c21794a89c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0cf73bd20ceb1f7d634f1e5b1c874c866648c63b`
  ```
  git log --all --format='%H %T' | grep 0cf73bd20ceb
  ```
- Тело issue: `6baaac76e880992571786aa5a9483ef4c7c1e60692696b78754853a410069a3f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2NjQsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzQ5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyNiwib3V0cHV0X3Rva2VucyI6MTM3NTIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NTkwOTIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3NjUyNjEsImNvc3RVc2RFc3RpbWF0ZSI6MC41MjY5OTIyfV0sInR1cm5zIjoyMSwiZHVyYXRpb25NcyI6MTUzMDcwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC41MzE3NDEyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4690 output_tokens=13769 cache_creation_input_tokens=59092 cache_read_input_tokens=765261 num_turns=21 -->
