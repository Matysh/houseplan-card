# SPEC-REVIEW-1111-r1

## Скоуп

- Issue: #1111 · этап: `spec` · трек: `ask` · заход: r1 (блокирующих циклов 0/4).
- Материал: тело issue #1111, раздел `## ТЗ`, редакция 1 · 28.10.2026 · основа
  `dev 09bda8dbe` (bodyDigest из REVIEW_CONTEXT). Кодовый Validate не требуется
  (этап spec); проверялась осуществимость и проверяемость ТЗ чтением материала.
- Обязательные источники роли прочитаны по одному разу: `docs/SCOPE.md`,
  `AGENTS.md`, `docs/process/REVIEWER.md`. Канон `PROCESS.md` открывался
  адресно: §2.4, §2.5, §7.1 (обязательные разделы ТЗ, однозначность AC,
  порог продуктовых вопросов).

## Как проверялось

1. Сверил каждую строку кода, на которую ссылается ТЗ, с текущим деревом:
   - `houseplan-render-lifecycle.ts:96-116` — `intakeHass`: точное совпадение
     (безусловный `_planHassMemo.hass = null` на `:105`, `_activityTick` на
     `:115`, короткий возврат при `hidden`/`_routeDepartureHandled` на `:112`).
   - `houseplan-card.ts:4914-4925` — геттер `_planHass`: подтверждена
     безусловная пересборка `activeRegistryHass(...)` при новом `this.hass`.
   - `houseplan-card.ts:11894-11933` (`_syncActivityRuntime`) и `:11940-11956`
     (`_activityTick`) — точное совпадение границ; подтвердил, что
     `planLightSources` в `_syncActivityRuntime` вычисляется один раз в начале
     функции и используется только для устройств с `display: icon_ripple`
     (единственный потребитель внутри этой функции — заявление ТЗ корректно
     в заявленной области).
   - `ha-binding-status.ts:327-360` (`activeRegistryHass`) — подтвердил цикл
     `for (const [eid, state] of Object.entries(hass?.states || {}))`,
     безусловный при любом новом `hass`, и правила disabled-сущность/
     disabled-родитель/`authoritative` без родителя, как описано в контракте
     п.2.
   - `_maybeRebuildDevices` (`:5230-5243`) — подтвердил существующий O(1)-путь
     через `_deviceRosterState.matches(h)` (закрыт #1093), вне скоупа этой
     задачи — согласуется с разделом «Не-скоуп».
2. Проверил, что все названные в плане автотестов и AC файлы существуют и,
   значит, план «unit/smoke/benchmark расширяется» осуществим, а не ссылается
   на несуществующую инфраструктуру: `test/houseplan-render-lifecycle.test.mjs`,
   `test/ha-binding-status.test.mjs`, `test/activity-runtime.test.mjs`,
   `test/view-runtime-boundary.test.mjs`, `demo/benchmark_selective_invalidation.mjs`,
   `demo/smoke_disabled_device.mjs`, `demo/smoke_activity_color_settings.mjs`,
   `demo/smoke_device_battery_performance.mjs`, `demo/smoke_radar_live.mjs`,
   `demo/smoke_vacuum.mjs`, `demo/smoke_live_text.mjs`,
   `demo/smoke_selective_invalidation.mjs`, `demo/smoke_view_runtime_kiosk_recovery.mjs`
   — все присутствуют в дереве материала.
3. Сверил масштаб фикстуры (214 устройств / 2890 сущностей / 1673 состояния),
   названный в сценарии и AC1/AC6, с прецедентом #1093:
   `docs/analysis/1093-selective-invalidation-2026-10-28.md:21` фиксирует тот
   же прогон («214 registry devices, 2890 entities and 1685 state rows (1673
   synthetic + demo)») и `docs/release-ledger/v1.82.0/1093.json` —
   `"category": "stable-fix"` относительно того же `baseStable: v1.82.0`.
   Предположительная классификация ТЗ («stable-fix… подтвердить чтением тега»)
   согласована с этим прецедентом, а не выдумана.
4. Адресно проверил один конкретный технический вопрос, не закрытый текстом
   ТЗ однозначно: может ли инкрементальная проекция ограничить стоимость тика
   числом изменившихся состояний k, если Lovelace-карта получает от HA не
   дельту, а весь `hass` целиком. Прочитал существующий аналог —
   `render-invalidation.ts:34-76` (`classifyHassRenderChange`) — он достигает
   `O(число зависимостей плана)` только потому, что сравнивает заранее
   известный *ограниченный* список `dependencies.entityIds`, а не весь
   `hass.states`. У `_planHass`/`activeRegistryHass`, в отличие от него, нет
   заранее ограниченного списка — выходной словарь должен содержать все
   активные состояния установки, а не только интересующие план. Из этого
   следует, что обнаружение «каких именно k ключей изменилось» между двумя
   последовательными `hass.states` структурно требует хотя бы одного прохода
   по `Object.keys(hass.states)` (дешёвого — по ссылочному равенству, но не
   нулевого). Это ровно тот риск, который сам автор называет в разделе
   «Принято предположительно» («если ревью покажет, что сам обход ключей
   `hass.states` на N сущностях дороже порога, рассматривается ленивая
   проекция») и прямо оставляет как решение по ходу реализации, не меняющее
   контракт п.1–3. Результат проверки: формулировка контракта («≤ k
   (+константа)») — про счётчик-seam, а не про буквальное число итераций
   сравнения, и независимая проверка реальной стоимости тика есть отдельно —
   AC6 (замер wall-clock до/после на той же фикстуре). Если реализация
   «обманет» счётчик, но не сократит реальное время тика, это поймает AC6, а
   не AC1 — так и было задумано (AC6 — отдельный, не дублирующий, oracle).
   Вопрос снят: контракт проверяем, двухуровневая защита (seam-счётчик +
   wall-clock benchmark) достаточна, чтобы не требовать более точного
   определения «обработанного состояния» в тексте ТЗ на этапе spec — это
   решает уже код-ревью по §2.7 («пустой столбец „чем краснеет“» неприменимо,
   здесь столбец заполнен: несовпадение со счётчиком/с перестроенной с нуля
   проекцией).
5. Проверил обязательные разделы ТЗ (§7.1): сценарий, что человек увидит
   до/после, проблема, скоуп/не-скоуп, контракт поведения, UX, модель данных
   и миграция, i18n, критерии приёмки AC1–AC7 со способом доказательства,
   план автотестов, риски, откат, release-артефакты — присутствуют все.
   Раздел «Принято предположительно» фиксирует 3 технических решения,
   оставленных на усмотрение авторов/ревью (§7.1: «всё, чего пользователь не
   наблюдает, агенты решают сами») — продуктовых вопросов владельцу нет.
6. Для каждого AC проверил наличие явного негативного/смежного входа и
   способа падения («чем краснеет» по сути, не только по заголовку колонки):
   AC1 — RED обязателен на неизменённой базе (1673/1) до правки; AC2 — корпус
   граничных случаев реестра (disabled-сущность/родитель, `authoritative` без
   родителя, YAML-сущность, `sun.sun`); AC3 — «три тика без события — 0
   полных проходов»; AC4 — «устройство на другом этаже/скрытое — 0 расчётов»;
   AC5 — регресс по существующим смокам без правки ожиданий; AC7 —
   неизменность поведения #1093 плюс ревью кода по пп.1–5. Пустых столбцов
   доказательства нет.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Отдельно отмечаю — не как находку, а как наблюдение без последствий для
вердикта: в сценарии указаны персоны «J1/J6 из SCOPE», но текст в скобках
(«просмотр плана семьёй, киоск») соответствует только J1; J6 (поддержание
плана/ростер устройств) явно отнесён к не-скоупу этой задачи (#1093). Это не
меняет ни один AC и не создаёт неоднозначности контракта — чисто
классификационная неточность одной строки, не требующая возврата ТЗ.

## Что проверено и корректно

- Все ссылки на строки кода в разделах «Что нашёл аудит» и «Проблема»
  совпадают с текущим деревом материала (см. «Как проверялось», п.1) —
  описание текущего поведения не домыслено.
- Утверждение «единственный потребитель» для `planLightSources` внутри
  `_syncActivityRuntime` подтверждено чтением тела функции.
- Классификация release-ledger (`stable-fix` относительно `v1.82.0`) согласна
  с прецедентом #1093 на той же базовой версии.
- Все названные тестовые/демо-файлы для плана автотестов и AC существуют —
  план не ссылается на несуществующую инфраструктуру.
- Обязательные разделы ТЗ присутствуют полностью (§7.1), открытых продуктовых
  вопросов владельцу нет, три технических допущения явно помечены и
  обсуждаемы ревью, а не поданы как факт.
- Для каждого AC указан способ доказательства и негативный/граничный случай;
  у защитного AC2 (данные/права — disabled/authoritative не ослабляются)
  способ падения — несовпадение инкрементальной проекции с эталонной
  пересборкой с нуля на корпусе граничных случаев.
- Не-скоуп сформулирован explicit и непротиворечив: рендер/классификация,
  ростер устройств, `_vacTick`, LQI/бэкенд, статик-карты, семантика ripple и
  сами правила disabled/authoritative остаются без изменений — только момент
  их применения.

## Чего не проверял

- Код реализации не существует (`Реализации ещё нет` — по тексту ТЗ), поэтому
  исполнение юнитов/смоков/бенчмарка не запускалось: на этапе spec это не
  требуется (Validate — после кода).
- Не проверялась точность утверждения «единственный потребитель» для
  `resolvedLightSources` в целом по всей кодовой базе — в коде десятки вызовов
  этой функции в других модулях (рендер, glow, бейджи, editor-runtime); ТЗ
  претендует только на единственность потребителя внутри конкретного вызова
  в `_syncActivityRuntime`, что и было проверено. Более широкий поиск скрытых
  потребителей ТЗ сознательно откладывает на этап реализации (раздел
  «Риски»), это корректное решение для spec-этапа, а не пробел ревью.
- Не выполнялся `npm run gate:small`, `tsc`, `build`, `npm test` — согласно
  прямому указанию: кодовый Validate на этапе spec не требуется, отсутствие
  CI на SHA документа ревью не является причиной их запускать.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `tsc`/`build`/`npm test`/`gate:small` | Нет | Этап `spec`: кодовый Validate не нужен, реализации нет |
| Адресное чтение изменённых/рискованных мест кода, на которые ссылается ТЗ | Да | Единственный применимый на spec-этапе способ проверить осуществимость и точность ссылок |
| Проверка существования файлов плана автотестов (unit/smoke/benchmark) | Да (Glob) | Чтобы план не ссылался на несуществующую инфраструктуру |
| Адресная проверка одного конкретного непокрытого технического вопроса (инкрементальная стоимость тика при отсутствии диффа от HA) | Да (чтение `render-invalidation.ts`, сопоставление с риском/допущением ТЗ) | Единственный найденный непокрытый вопрос; обычный negative-input case не требовался — вопрос снят чтением |
| Полные regression/golden/perf-наборы | Нет | Это предрелизный гейт, не гейт ревью ТЗ (PROCESS.md §8); на этапе spec код отсутствует |

## Маршрут

`route: fix` (зафиксировано политикой вызова; не переопределяется).

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQyOTRkM2QxZTRlYjU2OWFiMDVlMTQzNGZiYjBhOWZhZjFmOWRmNmFiY2I1NWZiODE1NDkzODE4YTlkNDc3YzIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiNmNjYzhkNTIzN2E2N2ZiZTVlZGZlNmMzNmU5ZWNjZTAxYzFhMTMyN2FlNDMyYzJhOTAyODgwOTExNmY0YmRkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTExLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwOWJkYThkYmVlOGI1MDU3N2JmYzRhZmZjMzMyYjhjZGE5MTRmNWI0IiwidHJlZSI6ImE2NWQ4YmU5M2I2ZTY0NGZhNmYzZGUzZTQxMmJlOTRmZDYwNTdjZTkiLCJib2R5RGlnZXN0IjoiYTNlYWI2N2Y2MTQ4MjlmMmI2ZDBkNTQ1NjMxZWE0ZjM1N2IwMWE2NTM3MDQ4YjdlODM3ODI0NTQxYTA5M2QxZCIsInByb2R1Y2VyUnVuIjoiNDA2NTEwMTIyMTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjA5ZWI1NThjODVhODg4NmU2NTY2MWNiMThmYzI0MzVkMGZlZWI2NjM5NGVlNmU0NGI3MzljZmQ1MzY0M2U1NDAiLCJ2ZXJkaWN0RGlnZXN0IjoiNzVhYTczNTRhNDE0MmE1MjhlMmU1ZGM5NWZjNjVkN2IyYjcyMjZhZDAxMjE2NmYxMGU5MDcyZTczZjFhNmQxYiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjNWVkZWI4ZWUxNDQ1NGE4YWFhZjQzMzY5N2VkZWMxZTU4NjI5YzliNzA1ZWU3OWEyMzJhODk4YWM4YzA0ODg5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzNTQ1MDIxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTExI2lzc3VlY29tbWVudC02NDYzNTQ1MDIxIiwiYm9keURpZ2VzdCI6IjMyZjQ5NjliYzJmZjg2MWFlM2QwYzMzM2Y0ZWQwZTIyY2UzZjliNDgxOTcyNTEwMWY1OWQ1NmI3Y2U4NTU3NjgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `09bda8dbee8b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a65d8be93b6e644fa6f3de3e412be94fd6057ce9`
  ```
  git log --all --format='%H %T' | grep a65d8be93b6e
  ```
- Тело issue: `a3eab67f614829f2b6d0d545631ea4f357b01a6537048b7e837824541a093d1d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTgsIm91dHB1dF90b2tlbnMiOjM2NTc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk3NjM5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTk4MzE3OSwiY29zdFVzZEVzdGltYXRlIjoxLjE1MzA0Nzc5OTk5OTk5OTd9XSwidHVybnMiOjUwLCJkdXJhdGlvbk1zIjo0NTY1MTMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjE1MzA0Nzc5OTk5OTk5OTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=58 output_tokens=36574 cache_creation_input_tokens=97639 cache_read_input_tokens=1983179 num_turns=50 -->
