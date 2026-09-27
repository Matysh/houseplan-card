# CODE-REVIEW-397-r1

- Issue: #397 — «Undo позиций #74: своё же эхо сбрасывает историю, а
  доказывающий это смок подстроен»
- ТЗ: `docs/specs/397-device-position-echo.md` (ревизия 2, принята жёлтым →
  зелёным в SPEC-REVIEW-397-r1/r2)
- Этап: code, заход r1, блокирующих циклов израсходовано 0 из 4
- Диапазон: `git diff origin/dev...HEAD` (HEAD `08d56122`), реализация в
  коммите `d87cc298` («fix: the card keeps the position it sent, so its echo
  is not foreign (#397)»), артефакты — в `08d56122`

## Скоуп проверки

Диф вне docs/reviews и бандлов:

- `src/houseplan-card.ts` — 5 строк, `_persistDevicePlacement`
- `demo/smoke_device_position_history.mjs` — правка фикстуры (M1) + новые
  проверки AC2/AC5б/AC6/AC7
- `test/device-position-echo.test.mjs` — новый юнит (3 теста)
- `scripts/mutation-gate.mjs` — новый мутант `device-echo-keeps-local-noncanonical`
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md` — пункт User-Visible
- `dist/**`, `custom_components/houseplan/frontend/**`, `docs/images/**` —
  артефакты сборки/скриншотов, сверены с исходником (см. «Как проверялось»)

Продуктовый код в узком скоупе ТЗ: только `_persistDevicePlacement`. Геометрия,
рёбра комнат, `layout`/`marker.space`/`open_spans` не затронуты — гейт
инвариантов (`npm run invariants`) не применим.

## Как проверялось

Зелёного Validate на `08d56122` не было — все гейты прогнаны локально.

1. **Чтение диффа.** `git diff origin/dev...HEAD -- src/houseplan-card.ts`
   построчно сверен с описанием B3 в ТЗ и с текстом коммита. Прочитаны
   контекст `_persistDevicePlacement` (:5224–5261), `applyDevicePlacement`
   (`src/device-position-history.ts:45-67`), `_reloadLayoutOnly`
   (:4904–4948), `_adoptStructuralResponses` (:4203–4269), `_loadFromServer`
   (:4280–…) — чтобы понять, какой путь реально вызывается при reconnect.
2. **Дешёвые гейты** (все на `08d56122`, после `npm run bundle:sync`, чтобы
   поднять `demo/srv/assets`, — без него браузерные смоки не грузят карточку
   вообще, что не связано с задачей, а с локальным окружением):
   - `npx tsc --noEmit` — чисто.
   - `npm test` — **1657 pass / 0 fail / 1 skip** (совпадает с заявлением
     автора).
   - `npm run build` — зелёный; `git status` после сборки чист → три копии
     бандла (`dist/`, `custom_components/houseplan/frontend/`, плюс
     git-игнорируемый `demo/srv/assets`, пересобранный отдельно) совпадают с
     закоммиченными.
   - `node scripts/check-docs.mjs` — «Documentation checks passed (7 files,
     10 external links)», включая отпечаток скриншотов (diff трогает
     `src/**`, значит гейт обязателен) — прошёл, скриншоты
     (`docs/images/01-view-desktop.png`, `09-device-info.png`) и
     `docs/images/screenshots.json` в коммите `08d56122` актуальны.
   - `node scripts/mutation-gate.mjs --check` — все патчи реестра, включая
     новый `device-echo-keeps-local-noncanonical`, ложатся на текущий код
     (`ok device-echo-keeps-local-noncanonical`).
   - `node --test test/mutation-gate.test.mjs` — 10/10, реестр не разошёлся
     с кодом.
3. **`node scripts/smoke-select.mjs --base origin/dev --head HEAD`** —
   результат «НЕОПРЕДЕЛЁННОСТЬ»: единственный изменённый символ `_layout`
   слишком широк (встречается почти везде), `contentFingerprint` не связан ни
   с одним смоком явно. АС задачи прямо называют
   `demo/smoke_device_position_history.mjs` как способ доказательства — этого
   достаточно, полную матрицу (209 файлов) не гонял: диф не расширяет
   поверхность за пределы одного метода и уже названного смока.
4. **`demo/smoke_device_position_history.mjs` — прогнан явно** (`node
   demo/smoke_device_position_history.mjs`, после `npm run bundle:sync`):
   все 31 проверка зелёные, включая новые `localCopyEqualsTheWire`,
   `ownEchoMatchesWhatWentOverTheWire`, `deleteEchoKeepsHistory`,
   `inFlightPositionWinsTheMerge`.
5. **Дисциплина «тест умеет падать» — проверена вручную**, а не принята на
   слово. В `_persistDevicePlacement` временно заменил
   ```
   const pos = canonicalizePosition(this._layout[deviceId]);
   if (contentFingerprint(pos) !== contentFingerprint(this._layout[deviceId])) {
     this._layout = { ...this._layout, [deviceId]: pos };
   }
   ```
   на `const pos = canonicalizePosition(...); void pos;` (то же преобразование,
   что делает мутант `device-echo-keeps-local-noncanonical`), пересобрал
   (`npm run bundle:sync`) и перезапустил смок. Результат:
   ```
   FAILED (3):
     - localCopyEqualsTheWire: expected true, got false
     - sameContentReloadKeepsHistory: expected true, got false
     - ownEchoMatchesWhatWentOverTheWire: expected true, got false
   ```
   Это ровно то расхождение, которое ТЗ требует для AC6, и ровно три проверки,
   которые называет коммит-сообщение автора («three checks red without the
   fix»). После проверки откатил файл (`git diff` снова пуст) и пересобрал,
   чтобы вернуть дерево в исходное состояние.
6. **`node --test test/device-position-echo.test.mjs`** — 3/3 pass отдельно
   от общего прогона, чтобы увидеть их независимо.
7. **Трейлеры и changelog.** `git show d87cc298` содержит `Issue: #397` и
   `User-Visible: yes`; правки обоих `docs/CHANGELOG*.md` лежат в этом же
   коммите (не в отдельном). `git show 08d56122` — `User-Visible: no`,
   корректно для чисто артефактного коммита.

## Разбор по AC

- **AC1** (после `_persistDevicePlacement` `_layout[deviceId]` побайтово
  раве отправленному, отпечаток по нему). Доказано двояко: поведенчески —
  смок `localCopyEqualsTheWire` (зелёный, покраснел при отмене фикса);
  структурно — `test/device-position-echo.test.mjs` (`AC1: the update branch
  stores what it sends, before sending it`) проверяет порядок операторов в
  исходнике. ТЗ просило «юнит с перехватом callWS» — по факту это не
  Node-юнит с мокнутым `hass.callWS`, а (а) браузерный смок с фейковым WS и
  (б) текстовый юнит по исходнику. Проверил, что это не слабее: смок реально
  перехватывает `message.pos` на проводе и сравнивает с `_layout`, то есть
  доказывает AC1 не хуже мокнутого юнита. Отклонение от буквы метода
  доказательства — Low, не блокирует.
- **AC2** (честный reload не чистит историю) — `sameContentReloadKeepsHistory`
  + новый `ownEchoMatchesWhatWentOverTheWire` (пин того, что стороны реально
  совпали — без этого проверка AC2 могла бы быть тавтологией). Зелёные,
  красные при отмене фикса. Выполнено.
- **AC3** (тот же инвариант для `_adoptStructuralResponses`, reconnect-путь,
  пункт 5 плана автотестов) — **не выполнено**. См. находку Medium-1 ниже.
- **AC4** (чужое изменение чистит историю) — `remoteContentClearsHistory`,
  код и фикстура не менялись в этой части, поведение унаследовано и
  подтверждено прогоном (зелёное).
- **AC5а** (удаление: ключ удалён локально до отпечатка) — юнит
  `AC5a: the delete branch removes the key before the fingerprint`, плюс
  чтением подтверждено: `applyDevicePlacement(layout, id, null)` удаляет ключ
  (`src/device-position-history.ts:50-54`), вызывается безусловно в начале
  `_persistDevicePlacement` (:5230) до отправки и до фиксации отпечатка.
  Выполнено.
- **AC5б** (эхо удаления не чистит историю) — `deleteEchoKeepsHistory`,
  зелёный. Отдельно проверено, что `echoProbe` в текущей демо-фикстуре
  разрешается (не `null`) — прогон подтвердил `true`, ветка реально
  исполняется, а не проваливается в `else`-заглушку. Выполнено.
- **AC6** (смок краснеет на коде до фикса) — доказано вручную (раздел «Как
  проверялось», п.5): 3 проверки красные без фикса, все остальные 28 —
  зелёные (значит, откат не сломал ничего постороннего, поломка точечная).
  Выполнено.
- **AC7** (запись в полёте побеждает ответ сервера) — `inFlightPositionWinsTheMerge`,
  зелёный; прочитан код `_reloadLayoutOnly` (:4912-4926) — `_sentPos`
  накладывается на `remote` после `mine`, порядок не менялся этим диффом.
  Выполнено.

## Находки

### Medium-1 (в скоупе, чинится в этом же раунде). AC3 не имеет ни одного
теста — `_adoptStructuralResponses` не упомянут ни в одном изменённом файле

ТЗ (`docs/specs/397-device-position-echo.md:114-117`) требует отдельного
доказательства для `_adoptStructuralResponses` («полная перезагрузка конфига
и layout, reconnect-путь») именно потому, что сам документ называет его
**вторым независимым путём**, читающим то же расхождение (раздел «(1) B3»,
строки 41-49): "Дальше расхождение читают два независимых пути:
`_reloadLayoutOnly`… `_adoptStructuralResponses`…". План автотестов, пункт 5,
прямо предписывает: «Перемещение → полный `_adoptStructuralResponses`
(reconnect) → `canUndo === true` (AC3)».

Ни `demo/smoke_device_position_history.mjs`, ни новый
`test/device-position-echo.test.mjs`, ни любой другой файл в диффе не
упоминают `_adoptStructuralResponses` или `_loadFromServer` (проверено:
`git diff origin/dev...HEAD | grep -i adoptStructural` — пусто). Все новые
проверки (`sameContentReloadKeepsHistory`, `ownEchoMatchesWhatWentOverTheWire`,
`deleteEchoKeepsHistory`, `inFlightPositionWinsTheMerge`) идут через
`_reloadLayoutOnly` — это первый путь, не второй.

**Воспроизведение**: `grep -n "_adoptStructuralResponses" demo/*.mjs
test/*.mjs` внутри изменённых файлов не находит совпадений; в
`docs/specs/397-device-position-echo.md:154` пункт 5 плана заявлен, но не
реализован.

**Разобрано по коду (проверено чтением, не исполнением) — риска регрессии в
проде я не вижу**: `_adoptStructuralResponses` (:4245-4258) сравнивает
`contentFingerprint(nextLayout)` с `(this._layoutContentFingerprint ||
contentFingerprint(this._layout))` — тем же `_layoutContentFingerprint` и тем
же `_layout`, которые фикс в `_persistDevicePlacement` теперь синхронизирует
с отправленным на сервер значением. Других мест, где этот путь читал бы
неканонический слепок, нет. То есть B3 закрыт для обоих потребителей одним и
тем же присваиванием — функционального дефекта, скорее всего, не осталось.

Но это не заменяет обязательство: ТЗ приняло AC3 с явным способом
доказательства, автор его не выполнил и не заявил как исключение. «Верно по
рассуждению ревьюера» — это ровно то временное доверие, из-за которого
заводился прецедент #102 (правка по одному замечанию тихо ломает
непроверяемый соседний путь) — только с обратным знаком: здесь никто и не
проверял. Нужно: добавить в `demo/smoke_device_position_history.mjs`
сценарий пункта 5 (переместить маркер → вызвать полный путь конфиг+layout,
которым реально идёт `_loadFromServer`/reconnect, с честным серверным
слепком → `canUndo === true`) либо явно проговорить в ТЗ/PR, почему этот
путь достаточно покрыт первым, и получить это как решение ревью, а не как
факт по умолчанию.

### Low-1. AC1 доказан не тем способом, что назвало ТЗ

ТЗ: «Доказательство: юнит с перехватом `callWS`». Реализация: браузерный смок
(перехват фейкового WS в `demo/`) + текстовый юнит по исходнику в `test/`. По
существу доказательство не слабее (см. разбор AC1 выше), но название файла в
плане (`test/device-position-persist.test.mjs`) и метод («юнит с перехватом
callWS») разошлись с тем, что реализовано (`test/device-position-echo.test.mjs`,
текстовый разбор + смок). Не блокирует, автор может закрыть комментарием
одной строкой, если согласен, что смок сильнее.

### Low-2. Юнит-план, пункт 3 («каноническая позиция не создаёт лишней
записи»), не имеет отдельного теста

Раздел «Риски» ТЗ (`docs/specs/397-device-position-echo.md:169-172`) просил
юнит на то, что уже каноническая позиция не вызывает лишнего присваивания
`_layout` (мера против лишнего ре-рендера). Гвард в коде
(`if (contentFingerprint(pos) !== contentFingerprint(this._layout[deviceId])) {…}`)
присутствует и корректен — проверено чтением: при равенстве отпечатков блок
не выполняется, второе присваивание `_layout` не происходит. Отдельного теста
на это нет ни в `test/`, ни в смоке. Riск-митигация без теста хуже, чем без
митигации, но здесь код всё же есть и логика прямолинейна (`!==` перед
присваиванием) — не блокирует, оставляю на усмотрение автора.

## Что проверено и корректно

- Порядок операций в `_persistDevicePlacement` соответствует контракту ТЗ:
  локальная запись канонического значения → `_sentPos.set` →
  `hass.callWS(...)` → `_layoutContentFingerprint` по актуальному `_layout`.
  Порядок «локальная запись раньше `_sentPos`» (риск-митигация из ТЗ)
  сохранён — проверено чтением :5241-5253.
- Ветка удаления использует тот же безусловный `applyDevicePlacement` в
  начале функции (:5230), отдельного расхождения между «обновить» и
  «удалить» в части фиксации отпечатка нет.
- M1 закрыт: `serverLayout = structuredClone(c._layout)` перед
  `_reloadLayoutOnly()` убран из смока; сервер теперь только то, что реально
  ушло по фейковому WS. Подтверждено падением 3 проверок при отмене фикса.
- `_sentPos` продолжает побеждать в `_reloadLayoutOnly` (:4918-4926) —
  код этого пути не тронут диффом, AC7 подтверждает поведение, а не чинит
  регрессию.
- CHANGELOG (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) — пункт добавлен в
  том же коммите, что и фикс; трейлеры `Issue: #397` / `User-Visible: yes`
  на месте.
- Бандл-артефакты (`dist/`, `custom_components/houseplan/frontend/`,
  скриншоты) актуальны — подтверждено пересборкой и чистым `git status`.
- Мутант `device-echo-keeps-local-noncanonical` зарегистрирован корректно,
  guard (`node demo/smoke_device_position_history.mjs`) существует и реально
  ловит поломку (проверено вручную, см. «Как проверялось», п.5), реестр не
  разошёлся с кодом (`test/mutation-gate.test.mjs` зелёный).

## Чего не проверял и почему

- **`node scripts/mutation-gate.mjs` (полный/по `--id=device-echo-keeps-local-noncanonical`)** —
  не гонял через штатный раннер: он в этой песочнице падает на не связанном
  с задачей препятствии (`python3 -m pytest tests_backend/...` — «No module
  named pytest», модуль не установлен) ещё на этапе чистого прогона,
  до применения самого мутанта. Это гейт предрелизного окна
  (`.github/workflows/mutation-gate.yml`), не гейт ревью, и файл сам себя так
  описывает («прогон дорогой… его место — перед стабильным релизом»).
  Заменил его точечной ручной проверкой (см. п.5 «Как проверялось»),
  которая доказывает то же самое для конкретного мутанта.
- **`python -m pytest tests_backend -q`** — диф не трогает
  `custom_components/**/*.py`, гейт не применим.
- **`npm run invariants`** — диф не трогает геометрию/рёбра/`layout`-ключи
  решётки, гейт не применим.
- **`npm run golden:verify`** — диф не меняет рендер/геометрию/стили/слои,
  только служебное поле `_layout` и порядок присваиваний; визуального следа
  у AC нет.
- **HA-харнесс** — в этой песочнице нет Home Assistant; это предрелизный
  гейт на точном SHA, автор пометил то же самое в своём комментарии.
- **Полная матрица `demo/smoke_*.mjs` (209 файлов)** — не запускал:
  `scripts/smoke-select.mjs` не нашёл сильной связи за пределами уже
  названного в АС смока, а сам диф не расширяет поверхность (один метод,
  один смок, названный ТЗ явно).

## Унаследовано из этапа spec

SPEC-REVIEW-397-r1 (жёлтый, Medium: AC5б/AC7 без способа доказательства) и
SPEC-REVIEW-397-r2 (зелёный) заранее проверили точность самого диагноза (B3,
M1) построчно против кода на SHA `83692e79`/`6edcde01` — до реализации.
Диагноз принят без повторной проверки номеров строк из ТЗ (они успели
сместиться в ходе реализации на единицы строк, что нормально и не меняет
сути); сам код B3/M1 в этом раунде я перечитал заново на HEAD, а не
унаследовал.
