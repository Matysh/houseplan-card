# SPEC-REVIEW-942-r2

Issue: #942 — «Расширенная диагностика через „Помощь и обратная связь“».
Этап: ревью ТЗ (PROCESS.md §2.4). Трек: `ask`. Заход r2 · блокирующих циклов
израсходовано 1 из 4.

Материал: тело issue `#942`, раздел `## ТЗ`, редакция 2. Дерево материала
`202c1c51558322f3b9c5ac467e385a0323104772`, `bodyDigest:
11cbf71af82c4c7edde66734d757818172790a92c959718610b50cf5593e8893`
(из `REVIEW_CONTEXT`, сверено побайтово с телом, полученным
`gh issue view 942 --json body`). SHA материала
`67fcd77af1c967d6db3301224a96e29a3087c2d9` — рабочая копия уже на нём
(`git rev-parse HEAD`). Архивного `docs/specs/942-*.md` нет и не создаётся —
ТЗ живёт только в теле issue (#517). Все шесть комментариев issue прочитаны
с GitHub напрямую: claim автора, аналитика, «Сделано» редакции 1, вердикт
конвейера r1, «Сделано» редакции 2, черновик разработчика (track:ask,
локальная ветка, не пушится до S5).

Предыдущий раунд: `docs/reviews/SPEC-REVIEW-942-r1.md`, материал
`b45aa0f57066` (tree `12ff505aca4d6e2bacb532588621e5bffd1cd3ab`), вердикт
жёлтый, High 0, Medium 1 (M1).

Побочные находки: политика `mode=issues` (снимок
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`, round 2) — побочных находок нет,
отдельных issue не заводилось; всё найденное входит в предмет самого #942.

## Скоуп

Не изменился относительно r1: J1/J6 (`docs/SCOPE.md`) — обслуживание уже
работающего пространственного интерфейса через существующий диагностический
канал Help & feedback, не новая поверхность и не history/CAD/3D-функция.
Задача по-прежнему прямо исключает рендер/маршрутизацию робота, историю/лог
HA, DOM/screenshot, устройства/HA registry, Zigbee topology snapshot и radar
heatmap/history. Дельта раунда (см. ниже) не меняет границы скоупа из §3.

## Предмет повторного раунда — дельта

Сверка текста редакции 2 против редакции 1 (по цитатам в
SPEC-REVIEW-942-r1.md и по комментарию автора «Сделано» редакции 2) даёт
ровно четыре изменения:

1. Заголовок `## ТЗ`: добавлена строка «Редакция 2. Исправлено M1 из
   SPEC-REVIEW-942-r1: у сводной панели нет size-контрола (#505);
   диагностируем только существующие show/mobile flags. Дополнительно
   уточнён fail-closed read ACL для новых серверных фактов.»
2. §6, строка «Сводная панель»: было — «effective show/mobile/**size**
   visibility»; стало — «effective show/mobile visibility по существующему
   контракту #505 … **size-контролов нет**» (явное отрицание, не просто
   удаление слова).
3. §8 (Сбор, доверие и согласованность): добавлен новый последний абзац про
   entity read ACL — «Право редактировать House Plan не заменяет право
   читать конкретные сущности HA…» целиком, включая `access_denied`,
   повторную проверку перед submit и запрет хранить исходные ID вне TTL-памяти
   preview.
4. AC8 (§12): третий столбец расширен тремя новыми отрицательными
   свидетелями — «non-admin writer с запретом чтения, отзыв read до
   публикации/submit, foreign-source run».

Остальной текст (§1–5 кроме правленой строки, §7, §9–11, §13–14, AC1–AC7,
AC9–AC10) текстуально не изменился — сверено построчно с цитатами и
пересказом в SPEC-REVIEW-942-r1.md и подтверждено тем, что ни одна другая
находка/комментарий r1 не требовала правки за пределами M1.

## Как проверялось

Порядок по `AGENTS.md` «Reading order by role»: `docs/SCOPE.md` → `AGENTS.md`
→ `docs/process/REVIEWER.md` → тело issue #942 и все шесть его комментариев
→ `docs/reviews/SPEC-REVIEW-942-r1.md` (материал и находки прошлого раунда)
→ адресно код, на который опирается новый абзац §8.

- Механическая проверка формата: `specFormatErrors(body, 'ask')` из
  `scripts/review-preflight.mjs`, вызвана напрямую на теле issue (redaction 2)
  → `[]`, 0 ошибок — обязательные разделы §7.1, контигуентная нумерация
  AC1…AC10 и названный способ доказательства у каждого подтверждены машиной
  повторно (а не только унаследованы из r1).
- Проверка фактической обоснованности нового абзаца §8/AC8 (entity read ACL)
  — чтение, не исполнение:
  - `custom_components/houseplan/auth.py:17-55` (`may_write`) — подтверждает,
    что non-admin writer — реальный, а не гипотетический актор: при
    `CONF_ADMIN_ONLY=False` обычный пользователь без `is_admin` становится
    writer'ом, если его группы не включают `GROUP_ID_READ_ONLY`. Значит
    формулировка «may_write не означает доступ ко всем HA-сущностям» описывает
    настоящий, уже существующий класс пользователей, а не изобретённый.
  - `custom_components/houseplan/websocket_api.py:1625-1636` (`_readable_entity_ids`)
    и использования на строках 1711, 2314 — подтверждают, что
    entity-level read ACL (`user.permissions.check_entity(entity_id, "read")`,
    с обходом для `is_admin`) уже существует в продукте и уже применяется для
    фильтрации видимых неадминистратору-writer'у сущностей в соседнем
    WebSocket-пути.
  - `custom_components/houseplan/radar_websocket.py:81-86` (`_can_read`,
    `POLICY_READ`) — второй независимый прецедент того же примитива
    (`check_entity`) для той же цели (отказ `source_restricted` при нехватке
    read-прав на источники радара, строки 56/128/184/225/238).
  - Проверено отсутствие конфликта с `docs/SCOPE.md` («Authenticated View
    deliberately shares the complete spatial plan … rather than pretending to
    be an entity-by-entity privacy boundary», строки 37–39): это утверждение
    описывает потребление уже отрендеренного View внутри домохозяйства, а не
    экспорт данных наружу, к стороннему support-relay. Новый ACL-гейт — про
    второе, не про первое; противоречия нет, это разные поверхности с разными
    требованиями утечки данных.
- Сверка редакции 2 §6 построчно с `docs/specs/505-summary-panel-design-parity.md`
  (AC7 «Size controls absent», «Release artifacts: … removed size controls») —
  новая формулировка «size-контролов нет» дословно соответствует документу,
  M1 закрыт по существу, а не только по форме.
- Дешёвые гейты на SHA `67fcd77a` (зелёного Validate на этом SHA нет,
  прогнаны лично):

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` (после `npm ci`, `node_modules` отсутствовал) | PASS, 0 ошибок |
| unit/backend-JS | `npm test` | 5137 тестов, 5136 pass, 1 skipped, 0 fail |
| build | `npm run build` | PASS, бандл собран (`tsc --noEmit && rollup -c`) |
| восстановление бандла | `npm run bundle:clean` | дерево возвращено к закоммиченному; `git status --short` пуст после |

- Не прогонялись: `pytest tests_backend`, HA harness (`test_ha_*.py`), relay
  unit/staging-тесты, golden, performance, `npm run invariants`. Причина та
  же, что в r1, и дельта раунда её не меняет: продуктового Python/TS-диффа по
  #942 нет (автор прямо пишет «продуктовый код не менялся»), это гейты
  этапа code-review на фактическом коде, а не текста ТЗ. Приведённые автором
  baseline-прогоны (Python projector 23 PASS, relay 38 PASS, HA WebSocket
  support 15 PASS) приняты как контекст текущей v1-политики, не как
  доказательство будущей v2-реализации — ревью их так и трактует.

## Находки

Находок нет — ни High, ни Medium, ни Low.

## Что проверено и корректно

- M1 из r1 закрыт точно предписанной правкой и чуть сильнее минимального
  требования: строка не просто лишилась слова «size», а прямо отрицает
  существование size-контролов и ссылается на #505, что исключает повторную
  реконструкцию несуществующего понятия на этапе реализации.
- Новый абзац §8 про entity read ACL — не «догадка, записанная как факт»
  (PROCESS.md §7.1): оба упомянутых в нём понятия (non-admin writer,
  entity-level read permission) уже существуют в коде и уже используются для
  той же цели в соседних WebSocket-путях (`_readable_entity_ids`,
  `_can_read`/`radar_websocket.py`). ТЗ лишь распространяет уже рабочий
  паттерн на новый диагностический путь, а не изобретает параллельный.
- AC8 получил конкретные отрицательные свидетели для нового требования
  («non-admin writer с запретом чтения», «отзыв read до публикации/submit»,
  «foreign-source run») — третий столбец «чем краснеет» не пуст, защитный AC
  доказуем предписанным способом (PROCESS.md §2.7).
- Механическая проверка формата (`specFormatErrors`) подтверждает редакцию 2
  независимо от ручного чтения: все обязательные разделы на месте,
  контигуентная нумерация AC1…AC10 сохранена.
- Открытых продуктовых вопросов владельцу по-прежнему нет: §14 не менялся,
  в нём явно сказано «Перед ревью незакрытых продуктовых вопросов нет», и
  дельта раунда (M1 + ACL) не продуктовый вопрос, а исправление и уточнение
  технического/защитного контракта.
- Остальная часть ТЗ (AC1–AC7, AC9–AC10, §1–5 кроме правленой строки, §7,
  §9–11, §13–14) текстуально не изменилась относительно зрелой редакции 1,
  уже разобранной построчно в SPEC-REVIEW-942-r1.md — дельта раунда не
  задевает эти разделы, полный повторный разбор не требуется (PROCESS.md
  §2.10).

## Чего не проверял

- Как и в r1: реализуемость конкретных формул/алгоритмов (bounded sampling,
  affine-эквивалентность геометрии, executor lease), ~15 новых кодов причин
  пылесоса построчно, DE/FR-локали, ручная dev/GPU-приёмка владельцем,
  работоспособность staging/prod relay-выкладки — всё это вне материала
  spec-ревью и дельта r2 их не касается.
- Полный `pytest tests_backend`, HA harness, relay-тесты, golden, performance,
  `npm run invariants` — продуктового Python/TS-диффа по #942 нет.
- Не проверялось, как именно в коде будет называться `access_denied` и
  реализована «приватная память preview scope до TTL» — это техническое
  решение по смыслу §14 («физическая раскладка… имена внутренних типов — не
  вопросы владельцу»), а не продуктовый контракт, подлежащий отдельной
  проверке на этом этапе.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, §6 «Сводная панель» заявляла несуществующее «size visibility») | Строка переписана: «effective show/mobile visibility по существующему контракту #505 … size-контролов нет» — явное отрицание несуществующего свойства вместо простого удаления слова | Тело issue #942, §6, строка «Сводная панель» (редакция 2, `bodyDigest: 11cbf71af82c4c7edde66734d757818172790a92c959718610b50cf5593e8893`); дословно подтверждено сверкой с `docs/specs/505-summary-panel-design-parity.md` (AC7 «Size controls absent», «removed size controls») |

## Унаследовано из r1

Принято без повторной проверки, поскольку материал за пределами описанной
выше дельты не менялся: полный разбор обязательных разделов §7.1, зрелость
AC1–AC7/AC9–AC10, соответствие терминологии подсистем (`docs/VACUUM.md`,
`docs/RADAR.md`, `docs/LIGHT.md`, `docs/SUN.md`, `docs/FILTERING.md`,
`docs/DEVICE-PRESENTATION.md`, `docs/SUPPORT-PRIVACY.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.ru.md`, `docs/WALL-THICKNESS.md`), классификация релиза
(major относительно v1.81.0, milestone 1.82 после реализации), бюджеты §9 и
версионирование API (§10) — все зафиксированы и аргументированы в
`docs/reviews/SPEC-REVIEW-942-r1.md`, материал `b45aa0f57066`
(tree `12ff505aca4d6e2bacb532588621e5bffd1cd3ab`,
bodyDigest `3902312fa9ea3407447bf2ea368a2344beab6db23c1388549e2980a2adc15f2e`).

## Вердикт

Единственная находка r1 закрыта точно по предписанной правке, сильнее
минимального требования. Единственное содержательное дополнение редакции 2
(entity read ACL в §8/AC8) — не домысел: оно переиспользует существующий в
коде примитив entity-level read permission
(`user.permissions.check_entity(entity_id, "read")`), уже применяемый для
фильтрации видимых неадминистратору-writer'у сущностей в
`websocket_api.py` и `radar_websocket.py`, не конфликтует с
`docs/SCOPE.md` (разные поверхности: View-потребление внутри дома против
экспорта наружу), и получает в AC8 конкретный отрицательный свидетель.
Продуктовых вопросов владельцу не осталось. Дешёвые гейты на SHA `67fcd77a`
зелёные, дерево чистое после `bundle:clean`.

`Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `67fcd77af1c9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `202c1c51558322f3b9c5ac467e385a0323104772`
  ```
  git log --all --format='%H %T' | grep 202c1c515583
  ```
- Тело issue: `11cbf71af82c4c7edde66734d757818172790a92c959718610b50cf5593e8893`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MDgsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njg4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Miwib3V0cHV0X3Rva2VucyI6MjIzOTYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTExMDkzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mjc2MDg3MSwiY29zdFVzZEVzdGltYXRlIjoxLjIyMDYzMDIwMDAwMDAwMDJ9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjo0ODIzMTMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjIyNTMxODIwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4670 output_tokens=22412 cache_creation_input_tokens=111093 cache_read_input_tokens=2760871 num_turns=41 -->
