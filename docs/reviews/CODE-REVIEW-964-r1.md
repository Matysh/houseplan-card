# CODE-REVIEW — issue #964 — заход r1

**Материал:** `ea507fed8017b870ce5dfeca0c4456ff2ca11b63` (единственный коммит
`feat(tooling): preserve offline interface workbench in demo/ui-lab`, трейлеры
`Issue: #964` / `User-Visible: no`). Диапазон `origin/dev..HEAD` = 1 коммит;
`git diff origin/dev...HEAD` — 27 файлов, +4033/-0, без единого файла класса A
(`src/**`, `custom_components/**` не затронуты).

Трек: `show` (метка владельца). Этап: code, заход r1, блокирующих циклов
израсходовано 0 из 2 (предыдущий технический возврат — конфликт rebase в
`docs/STATUS.md` до модельного ревью — цикл не расходовал, см. комментарии
issue от владельца).

## Скоуп

Инфраструктурная задача (класс B/C): отдельный переносимый локальный стенд
`demo/ui-lab/` для итераций интерфейса — loopback HTTP-сервер, отдающий
настоящий продуктовый bundle (`dist/`) и закреплённые официальные компоненты
Home Assistant (`home_assistant_frontend 20260930.4`, сверка по SHA-256),
синтетический fixture, локальный mock HA, экспорт/импорт сессии в
`localStorage`, CSS hot-reload оверрайды для четырёх shadow root. Существующий
`demo/` (golden/performance/guard/stand) не заменён и не изменён. Продуктовый
polish #963 в этот коммит не перенесён. `User-Visible: no` соответствует
дифу — ни одного файла A, оба changelog не тронуты (и не должны быть).

Три AC из тела issue:
- AC1 — один документированной командой поднять закреплённый HA runtime и UI
  Lab, открыть настоящий план/редакторы/диалоги, theme/language/overrides.
- AC2 — сервер только loopback, не проксирует HA, не пишет; приватный набор
  изолирован от синтетической сессии.
- AC3 — инструкция переиспользования/overrides/session export-import;
  невалидный импорт не теряет текущую сессию.

## Как проверялось

Прочитано построчно (не бегло): `demo/ui-lab/server.mjs`, `session.mjs`,
`ha-runtime.mjs`, `config.mjs`, `prepare-ha.mjs`, `app.mjs`, `ha-bootstrap.mjs`,
`mock-ha.mjs`, `smoke.mjs`, `README.md`, `ha-lock.json`, фрагмент
`fixture.json`, содержимое `overrides/*.css`; диффы `docs/ARCHITECTURE.md`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`, `package.json`, `.gitignore`,
`docs/release-ledger/v1.81.0/964.json`; `test/ui-lab-server.test.mjs` и
`test/ui-lab-session.test.mjs` целиком.

### Гейты

| Гейт | Статус | Как |
|---|---|---|
| `tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` (копии сверены) | PASS, не перегонял | Зелёный Validate на этом же SHA: https://github.com/Matysh/houseplan-card/actions/runs/39227131319 (#343) — дешёвые гейты подтверждены, повторный прогон избыточен. `npm test` этого прогона уже включает оба новых test-файла. |
| `node --test test/ui-lab-server.test.mjs test/ui-lab-session.test.mjs` | PASS 15/15, прогнал сам | Независимо от Validate; совпадает с заявленным автором результатом. |
| `node demo/ui-lab/prepare-ha.mjs --ha-cache /tmp/ui-lab-ha-cache` | PASS, прогнал сам | Настоящая сетевая загрузка официального wheel `home_assistant_frontend-20260930.4-py3-none-any.whl` (110732939 байт), сверка SHA-256/размера/детерминированного manifest, извлечение. |
| `npm run bundle:sync` (зависимость smoke) | PASS, прогнал сам | Нужен для `assertFreshDemoBundle`; после smoke выполнен `npm run bundle:clean`, рабочее дерево возвращено к `git status` чистому состоянию на `ea507fed8`. |
| `node demo/ui-lab/smoke.mjs --ha-cache /tmp/ui-lab-ha-cache` (browser smoke, назван в AC1/AC2/AC3) | **PASS 10/10, прогнал сам** | Headless Chromium (Playwright 1.62.0, chrome-headless-shell 151.0.7922.34), настоящий продуктовый bundle + настоящие `ha-dialog`/`ha-icon`/`ha-card`. Результат идентичен заявленному автором списку проверок. |
| `smoke-select.mjs` (продуктовый фронтенд-смок) | Не прогонял | Нет файлов `src/**` в диффе → смок-селектор не выбирает продуктовые смоки; согласуется с заявлением автора. |
| `golden:verify`, инварианты модели, `pytest tests_backend`, performance | N/A, не прогонял | Нет изменений рендера/геометрии/Python/производительности в диффе. |
| `node scripts/check-docs.mjs --screenshots=warn`, `node scripts/process-gate.mjs --issues`, `git diff --check` | Не перегонял | Покрыты тем же зелёным Validate/`process-gate` прогоном на этом SHA; не меняющие их факторы (скриншоты — не гейт задачи, #697). |

Чего не проверял: реальное Windows/WSL окружение (заявленный автором
двойной прогон на Windows/WSL не воспроизводил — моя проверка только на
Linux); реальный Windows junction (на Linux тест тот же сценарий эмулирует
directory symlink — `t.skip` недоступен, прошёл содержательно, но это не
то же самое ограничение ОС, что настоящая junction); GPU/визуальную
приёмку — трек `show`, ручная приёмка владельцем необязательна (#929).

## Находки

Нет High. Нет Medium (ни в скоупе, ни вне скоупа). Побочных находок нет —
новых issue не заводил (снимок политики `mode=issues`, маршрут не
потребовался).

## Что проверено и корректно

- **Изоляция сервера (AC2).** `requestPath` отклоняет `//`, `\`, `%00`, `:`,
  `..`/`.`-сегменты и декодирует URL до проверки (`server.mjs:42-49`);
  `validHost` принимает только `localhost`/`127.0.0.1` с портом, совпадающим
  с реальным слушающим портом (`server.mjs:51-54`); только `GET`/`HEAD`
  (`server.mjs:94`). Проверил исполнением: `403` на поддельный Host (включая
  `[::1]`, чужой порт, `localhost@evil.test`), `405` на
  `POST/PUT/DELETE/PATCH/OPTIONS`, `400` на `/../fixture.json`,
  `%2e%2e`, `%5c..%5c`, двойное декодирование `%252e%252e`, `%00`, `//evil.test/`,
  `404` на не-allowlisted пути (`package.json`, `config.mjs`, `ha-lock.json`,
  `server.mjs`, частные overrides) — все эти случаи исполнены тестом
  `test/ui-lab-server.test.mjs:107-119` и моим прогоном (15/15 PASS) плюс
  браузерным smoke-чеком «negative transport attempts are blocked and HTTP
  writes rejected» (`POST /api/services/... → 405`).
- **Path-traversal/symlink/junction escape.** `safeFile`/`within` в
  `ha-runtime.mjs:11-24` резолвят оба пути через `realpathSync` и сверяют
  принадлежность корню после резолва symlink — тест
  `test/ui-lab-server.test.mjs:196-211` создаёт реальный symlink наружу
  (на Windows — junction) и подтверждает `null`/`404`, не раскрывая
  содержимое приватного файла. Прогнал сам — PASS.
- **Целостность продукта/рантайма.** `productFiles` и `verifyHaRuntime`
  проверяют SHA-256 каждого объявленного файла и якорные записи до отдачи;
  порча файла после старта отдаёт `500` без утечки пути/содержимого
  (`post-start asset tampering...`, PASS). `prepare-ha.mjs` проверяет
  SHA-256/размер **до** любой распаковки и отклоняет неофициальный wheel
  (`preparer rejects unverified wheel before creating a cache`) — проверил
  это и реальной сетевой загрузкой и реальным сопоставлением с актуальным
  `ha-lock.json` (которое прошло `verifyHaRuntime` без ошибок).
- **Приватность fixture (AC2/AC3).** `datasetId` строится из
  content+path-хэша, провенанс не содержит абсолютных путей/имён файлов
  (`private fixture identity...`, PASS); README и `.gitignore` (`demo/ui-lab/
  private`, `.cache`, `exports`, `evidence`) согласованы.
- **Сессии (AC3).** `validateSnapshot`/`validateJson` в `session.mjs`
  ограничивают глубину/число узлов, отбрасывают `__proto__`/`prototype`/
  `constructor`-ключи, проверяют форму `layout`/`states`/`config`; импорт/
  экспорт работают только после прохождения валидации и атомарной записи —
  некорректный/чужой/перегруженный вход (другой `datasetId`/`productFingerprint`/
  `schema`, `virtualLightsOff` с нестроковым элементом, `layout.x` строкой,
  8 MiB+ размер, прототипное загрязнение) не трогает уже сохранённую и
  историческую запись (`bad imports never replace...`, PASS) и не ломает
  `Object.prototype` (`assert.equal({}.polluted, undefined)`). Браузерный
  smoke отдельно прогнал полный цикл export → reset (с подтверждением) →
  import (с подтверждением) → состояние совпадает с экспортированным.
- **Сетевой guard в браузере.** `installNetworkGuard` перехватывает
  `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon`/`serviceWorker.register`/
  внешнюю навигацию/submit до загрузки HA/продуктовых модулей; юнит-тест и
  реальный Playwright-перехватчик (`context.route('**/*', ...)` в
  `smoke.mjs`, который абортит любой off-origin запрос) совпали — ни одного
  внешнего запроса за весь smoke.
- **Документация и классификация.** `docs/release-ledger/v1.81.0/964.json`
  — `category: infra`, обоснование относительно текущего stable корректно
  (не пользовательский milestone, #838). Трейлеры коммита верны
  (`Issue: #964`, `User-Visible: no` — соответствует отсутствию файлов A и
  правок changelog). `docs/ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`
  дополнены непротиворечиво поверх актуального `dev` (ребейз на `454a2f283`
  прошёл конфликт только в `STATUS.md`, обе записи #962/#964 на месте).
  `package.json`/`.gitignore` — только новые скрипты и игноры, ничего не
  удалено и не переопределено.

## Таблица «AC · чем доказано · чем краснеет» (защитные части AC2/AC3)

| AC | Чем доказано | Чем краснеет |
|---|---|---|
| AC2 — loopback-only, не пишет, не проксирует | `test/ui-lab-server.test.mjs` (`UI Lab rejects non-loopback Hosts, writes, path traversal...`) + browser smoke «negative transport attempts» | Обычный отрицательный прогон, результат воспроизведён мной: `403` на поддельный `Host`, `405` на не-GET/HEAD методы, `400` на traversal/encoding-варианты, HTTP `POST /api/services/light/turn_on` → `405` в браузерном контексте. |
| AC2 — целостность рантайма/продукта (fail-closed на подмену) | `missing, mismatched and tampered product/runtime/fixture inputs fail closed`, `post-start asset tampering is not served` | Обычный отрицательный прогон: повреждённый manifest/asset/fixture → `throw`/`500`, воспроизведено мной (15/15 PASS). |
| AC2/AC3 — symlink/junction не даёт выйти из корня | `directory symlinks and Windows junctions cannot escape a served root or HTTP route` | Обычный отрицательный прогон на реальном symlink (Linux) — воспроизведено мной: `safeFile` → `null`, HTTP → `404`, содержимое приватного файла не в ответе. |
| AC3 — невалидный/чужой импорт не теряет текущую сессию | `bad imports never replace the existing or historical session` (12 вариантов входа, включая `__proto__`-инъекцию, разный `datasetId`/`schema`, превышение 8 MiB) | Обычный отрицательный прогон, воспроизведено мной: каждый вход бросает исключение, `storage.getItem` после попытки равен значению до неё. |

Пустых третьих столбцов нет.

## Маршрут

Все критерии §5 для `track:show` пройдены:
- **complexity** — риск/сложность в пределах show: блок класса A не
  тронут, инструмент изолирован (loopback, вне release bundle), каждая
  рискованная ветка (traversal, целостность, прототипное загрязнение)
  закрыта исполненным отрицательным случаем.
- **surfaces** — один модуль (`demo/ui-lab/` как цельный инструмент), не
  новая продуктовая поверхность.
- **migration** — нет миграции конфигурации продукта и новых
  compatibility-полей (формат сессии — внутренний артефакт инструмента, не
  продукта).
- **ux-contract** — нет нового пользовательского UX-контракта,
  `User-Visible: no` подтверждён диффом.
- **perf-touch** — не затрагивает производительность или touch-контракт
  продукта.
- **undocumented** — ожидаемое поведение зафиксировано в самом отчёте
  автора, в `demo/ui-lab/README.md` (этим же коммитом) и в
  `docs/ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`.

`route: fix`.

## Вердикт

Зелёный. AC1–AC3 доказаны исполнением (юнит + браузерный smoke,
воспроизведено мной независимо, не только по заявлению автора), находок
High/Medium нет, гейты либо подтверждены зелёным Validate на этом SHA, либо
прогнаны мной лично там, где это требовали AC (ui-lab:prepare + ui-lab
browser smoke). Рабочее дерево возвращено в исходное состояние
(`bundle:clean`) после локальных прогонов.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/964-ui-lab`, коммит `ea507fed8017` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a9e11a670085a2845a920dbed2f0e1daa2f1dece`
  ```
  git log --all --format='%H %T' | grep a9e11a670085
  ```
- Тело issue: `3c51710fd0304d978247c8cf8ac83d74f48463f9d8a4251b75618019ef7a077f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxODYsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjcxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1MCwib3V0cHV0X3Rva2VucyI6MjUxNjMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE1Njg3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjQwNDI1MywiY29zdFVzZEVzdGltYXRlIjoxLjE5NTMyODU5OTk5OTk5OTl9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjozNjU5NzIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjIwMDU5OTU5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5236 output_tokens=25180 cache_creation_input_tokens=115687 cache_read_input_tokens=2404253 num_turns=41 -->
