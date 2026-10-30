# CODE-REVIEW-1054-r1

Материал: `10ea30c538b243e9261162f77977e747191906f8` (HEAD), диапазон `origin/dev..HEAD`.
Трек: show · этап: code · заход: r1 · блокирующих циклов использовано 0 из 2.

## Скоуп

Одна поверхность: lifecycle «полной» карточки (`src/houseplan-card.ts`,
`requestUpdate`/`connectedCallback`/`disconnectedCallback`), владелец чтения
`CardReadLifecycle` (`src/card-read-lifecycle.ts`, не менялся). Продуктовый
diff — ровно 13 строк A в одном файле:

1. `requestUpdate('hass')` — `authorityChanged` (результат `_configWriteContext.observe`)
   теперь безусловно вызывает `this._read.defer()`, независимо от того, был ли
   уже активен/ожидал чтение (`observe`'s собственный «waiting»-путь это не
   покрывал, если `_read.context` был обнулён предыдущим `disconnectedCallback`).
2. `connectedCallback` — `if (this._read.pending) void this._loadFromServer();`
   перед `requestUpdate()`: единственное место, которое потребляет оставшийся
   `pending`, когда сам `hass` не меняется в такте реконнекта (а значит,
   существующая проверка в `willUpdate` на `changed.has('hass')` не сработает).
3. `disconnectedCallback` — `interruptedRead = this._read.pending || this._read.busy`
   считается ДО `this._read.invalidate()`; если был активен/ожидал, после
   invalidate() снова выставляется `defer()` — транспортный claim отзывается,
   но спрос переживает повторный detach.

Остальной diff — тесты и документация: новый browser-смок
`demo/smoke_detached_authority.mjs`, три статических mutation-witness
(`scripts/mutation-registry.mjs`), запись в `scripts/smoke-links.mjs`,
обновление инвентаря (`scripts/ci-registry-inventory.json`,
`docs/testing-notes/mutation-browser-guards.md`), канонические доки
(`ARCHITECTURE.md`, `WARM-REMOUNT.md`, `DEVELOPMENT.md`, `STATUS.md`),
RU+EN changelog и `docs/release-ledger/v1.82.0/1054.json`.

Не затронуты: UI/разметка/геометрия, writer/CAS/permissions, shared LQI
backend/adapters, recovery cadence/TTL, перф-пороги — совпадает с
заявленным скоупом ТЗ.

## Как проверялось

Правило §2.10/#857 — принятый handoff не повторяется. Прочитан и сверен:

- Тело issue #1054 (проблема/root cause/ТЗ/AC1-3, скоуп, трейлеры) и полная
  лента комментариев автора (взятие в работу, промежуточные RED/GREEN
  native-прогоны, два форматных возврата по §7.2, финальный handoff с
  таблицей AC и списком гейтов).
- Диапазон `git log`/`git diff origin/dev...HEAD` — построчно по всем 13
  изменённым файлам, включая полный текст нового `demo/smoke_detached_authority.mjs`
  (130 строк) и трёх новых `MUTANT_DEFINITIONS`.
- `src/card-read-lifecycle.ts` и `src/config-write-context.ts` (не менялись,
  но несущие семантику `pending`/`busy`/`observe`/`authorityChanged`) —
  прочитаны целиком, чтобы проверить корректность композиции новых трёх
  хуков чтением, а не предположением.
- `src/houseplan-render-lifecycle.ts` (`intakeHass`) и
  `src/config-reload-authority.ts` — прочитаны, чтобы отделить уже
  существующий (неизменный) путь reload для CONNECTED смены authority от
  нового detached-специфичного пути; подтверждено, что оба пути
  коалесцируются одним и тем же `CardReadLifecycle.begin()` без дублирующего
  сетевого вызова (`if (this.active) return null;`).
- Git-трейлеры всех 5 коммитов диапазона: `Issue: #1054` на всех, `User-Visible: yes`
  на обоих code-коммитах (`75dad8c0e`, `b215d57ad`) и обоих merge-коммитах
  несущих продуктовые доки (`7ad521af9`, `10ea30c53`); у чисто-инфраструктурного
  merge (`4de91a238`, только STATUS/CI-инвентарь синхронизация) —
  `User-Visible: no`, обоснованно. В обоих code-коммитах правки
  `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` идут в том же коммите, что и код
  (проверено `git show --stat`).
- `docs/release-ledger/v1.82.0/1054.json` — `category: stable-fix` без
  `introducedBy`; сверено с #1051 (та же категория, тот же стиль обоснования)
  и с #1053 (`line-fix`+`introducedBy` для функциональности, появившейся уже
  после stable). Автор явно отметил в body issue, что исходный `!isConnected`
  guard присутствует в stable v1.82.0 — обоснование категории корректно по
  существу, не просто выведено из `User-Visible`.
- **Validate-gate (review-light) для материала `10ea30c538b243e9261162f77977e747191906f8`:**
  https://github.com/Matysh/houseplan-card/actions/runs/40067342968 — сверено
  напрямую (`gh run view 40067342968 --json headSha,conclusion`):
  `headSha` совпадает с материалом ревью, `conclusion: success`. Проверены
  job'ы прогона: `preflight`, `changes`, `reuse`, `frontend` (типы, юниты,
  бандл-синхрон), `product_guards`, `bundle`, **`browser_selected`
  («Браузер: выбранные проверки push»)** и финальный `proof` — все `success`.
  `browser_selected` — это задача выбора/прогона смоков по committed diff
  (`scripts/smoke-links.mjs`): новая запись `{files: ['src/houseplan-card.ts',
  'src/card-read-lifecycle.ts'], smokes: ['smoke_detached_authority.mjs',
  'smoke_view_recovery.mjs']}` гарантирует, что именно новый смок реально
  исполнялся в этом зелёном прогоне для этого SHA — это закрывает AC1 и AC2
  исполнением, не только авторским заявлением. `mutants`-job и полные
  `smoke`/`golden`/`backend`-шарды в review-light ожидаемо `skipped`
  (track show, `reviewLight: {mutants:false}` — `scripts/ci-proof.mjs`).
- Использован принятый proof как хендофф (policy): tsc/build/`gate:small`/
  `mutation-gate --check` НЕ повторялись — они покрыты `frontend`-job'ой
  этого же зелёного прогона.

### Адресная проверка, не покрытая proof

Сам факт, что `browser_selected` зелёный, не говорит, какие именно из 5
сценариев смока (`short`, `long`, `same-object`, `ABA`, `held-return`) и
57 ассершенов внутри реально доказывают три AC — это требует чтения кода
смока, а не повторного исполнения. Прочитан `demo/smoke_detached_authority.mjs`
построчно и прослежена механика каждого сценария:

- Сценарии кладут реальный held-promise на `houseplan/config/get`/
  `houseplan/layout/get` только в ветке `held-return` (`holdReads`), поэтому
  `held-return` — это не вторая копия того же теста, а отдельный путь,
  который детерминированно проверяет именно `disconnectedCallback`'s
  `interruptedRead` (повторный `card.remove()` ровно в момент, когда первая
  пара заявок ещё «подвешена» — `firstForeignPairIsHeld` ждёт
  `b.held.length === 2`).
- `oneCurrentMandatoryPair` считает ровно 2 пары запросов для `held-return`
  (одна отозванная, одна текущая) и ровно 1 для остальных сценариев — это
  прямое числовое доказательство «второй loader не создан, старый claim не
  получает хвост», а не косвенный вывод.
- `noFullReadWhileDetached` проверяется ПОСЛЕ смены `hass` но ДО возврата в
  DOM (`!card.isConnected`) — прямое доказательство AC «пока host detached,
  сетевое чтение не начинается».
- `fullAuthorityReturnsWithoutAnotherHassTick`/`currentLiveSignalReturns`/
  `oldWritePermissionDoesNotReturn` проверяются без какого-либо
  дополнительного `card.hass = …` после возврата в DOM — прямое
  доказательство «без дополнительного HA tick».

Прочитаны также все три новых mutation-witness в `scripts/mutation-registry.mjs`
(`full-detached-authority-intent-dropped-1054`,
`full-reattach-pending-authority-not-started-1054`,
`full-interrupted-reattach-loses-read-intent-1054`): каждый патч нацелен на
уникальную строку (сверено `grep -n` — совпадение ровно одно на каждый
`find`, включая то, что `find` для `full-reattach-pending-authority-not-started-1054`
содержит хвост `\n    this.requestUpdate();`, который отличает строку в
`connectedCallback` от текстуально идентичной строки в `willUpdate`, где
после неё идёт `}`, а не `this.requestUpdate();`). Мутанты **не исполнялись**
мной — это соответствует политике (зарегистрированные свидетели, execution
остаётся за ночным workflow); прочитаны только как доказательство того, что
регистрация синтаксически и семантически валидна, а не формальная.

Отдельно проверено чтением (не исполнением), что CONNECTED-путь смены
authority (через `intakeHass`/`_loadOk=false`, существующий код, не
изменённый этим диффом) не приводит к дублирующему сетевому запросу при
новом безусловном `_read.defer()`: `CardReadLifecycle.begin()` коалесцирует
повторный старт в одном поколении (`if (this.active) return null;`), так что
два независимых вызова `_loadFromServer()` из разных call site безопасны.

## Находки

Находок нет — ни High, ни Medium, ни Low.

Рассмотрен и отклонён как не-находка: перенос строки внутри абзаца в
`docs/WARM-REMOUNT.md` («…сохраняет\nпрежнее отсутствие перечитывания.») —
чисто косметический артефакт форматирования prose-файла, не влияет на смысл
и не нарушает структуру документа (аналогичные переносы есть в соседних
абзацах того же файла).

## Что проверено и корректно

- **AC1** (full-карточка восстанавливает актуальные конфиг/layout/слои без
  дополнительного HA tick/клика/pageshow): доказано исполнением в принятом
  `browser_selected` прогоне на точном материале — смок гоняет реальные
  `short`/`long` (20с реальной паузы через подмену `Date.now`, не ослабление
  TTL) сценарии, `space`-карточка — живой контрольный потребитель с теми же
  данными. `noWritesOrRadioCommands`/`oldWritePermissionDoesNotReturn`/
  `viewRecoveryDoesNotLoadEditor` проверяют, что при этом не произошло
  побочных записей, восстановления старого write-гранта или загрузки editor
  runtime в View.
- **AC2** (same-context no-reload, no reads while detached, coalescing,
  held A/B/ABA, interrupted reattach, user/connection/route fencing):
  доказано тем же прогоном — `sameContextShortReturnDoesNotReload`,
  `noFullReadWhileDetached`, `oneCurrentMandatoryPair` (включая
  `held-return`/`ABA`/`same-object` ветки). Существующий
  `smoke_view_recovery.mjs` и targeted lifecycle unit остаются в составе
  `smoke-links.mjs`-записи #1054 как сохранённые witness'ы транспортных
  fences — не затронуты диффом (не входят в его изменённые файлы).
- **AC3** (fresh accepted base, gate:small, pre-push hook, static mutation
  readiness, профильные доки, User-Visible RU+EN+ledger, независимый CODE до
  S8, без эталонов/bundle/релиза): база — принятый `dev` после #1052/#1053 и
  текущего цикла #1051/#1046/#1055 (видно по merge-коммитам и
  `docs/release-ledger`); эталоны/bundle в диффе отсутствуют; это первое
  независимое CODE ревью (CODE budget 0/2 до этого вердикта).
- Защитная таблица «AC · чем доказан · чем краснеет» присутствует в
  финальном комментарии автора (issuecomment после handoff) для обоих
  защитных AC1/AC2, со ссылкой на конкретный native RED до правки и на три
  зарегистрированных witness с явной пометкой «не исполнялись» — соответствует
  требованию §2.7/#435.
- Отдельная смежная находка автора (другой «mounted same-object» дефект без
  исходного detach) корректно вынесена в отдельный issue #1056, без
  добавления её исправления в этот материал — дисциплина скоупа соблюдена.

## Чего не проверял

- Не повторял `tsc`/`npm run build`/`gate:small`/`mutation-gate --check` —
  покрыты принятым `review-light` на точном SHA материала (см. «Как
  проверялось»); повторный прогон не даёт нового сигнала при неизменных
  входе/окружении/oracle.
- Не исполнял ни один из трёх зарегистрированных mutation-witness
  (`full-detached-authority-intent-dropped-1054`,
  `full-reattach-pending-authority-not-started-1054`,
  `full-interrupted-reattach-loses-read-intent-1054`) — по общей политике
  ревью это исполнение мутанта, допустимое только в ночном workflow; их
  валидность проверена чтением (уникальность `find`-паттернов, релевантность
  `guard`).
- Не прогонял `golden`/`backend pytest`/`geometry_parity`/`performance_smoke` —
  они `skipped` в review-light и не релевантны диффу (нет визуальных,
  Python-геометрических или перф-изменений в скоупе).
- Не проверял свежесть скриншотов документации — не гейт задачи (#697).
- Не трогал `docs/USER-GUIDE.ru.md` — диффом не меняется видимое
  пользователю поведение/терминология интерфейса (это внутренний recovery
  lifecycle, а не новый UI-элемент или текст), UPDATE не требовался и не
  запрашивался ни ТЗ, ни диффом.

## Побочные находки

Побочных находок нет. (Доверенный снимок prepare: `mode=issues`, outside
findings заводятся отдельным issue — в этом ревью таких не возникло.)

## Вердикт

Зелёный. route: fix (все критерии §5 соблюдены: complexity ≤3 — точечный
13-строчный diff в одном lifecycle; surfaces — один модуль/один lifecycle
owner; migration — нет конфигурации/compatibility-полей; ux-contract — нет
нового контракта, восстанавливается уже существующий recovery-контракт;
perf-touch — TTL/тайминги/touch не затронуты; undocumented — поведение
зафиксировано самим диффом в `WARM-REMOUNT.md`/`ARCHITECTURE.md` и явно
названо в теле issue как «уже существующий контракт recovery»).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1054-detached-authority-intent`, коммит `10ea30c538b2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `18a7ed868d45004cbe251ee2895b1157a2f0550c`
  ```
  git log --all --format='%H %T' | grep 18a7ed868d45
  ```
- Тело issue: `e2c629b79f1c1d3627ff2ce982666a523018f923fe64c0bf9f6db783f49e04ba`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwODYsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTY2MDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTAsIm91dHB1dF90b2tlbnMiOjM0MTc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExMDMxMiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM2NTk2MjIsImNvc3RVc2RFc3RpbWF0ZSI6MS41MTUwOTI0MDAwMDAwMDAxfV0sInR1cm5zIjo1MCwiZHVyYXRpb25NcyI6NDA1MDI2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41MjAyNTg0MDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5176 output_tokens=34190 cache_creation_input_tokens=110312 cache_read_input_tokens=3659622 num_turns=50 -->
