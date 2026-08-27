# CODE-REVIEW-267-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/267
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4
- **Материал:** ветка `issue/267-device-presentation-table`, `git rev-parse HEAD` =
  `118062bb8cce6ffe7ab86233f10b9dfd00ac6f6d` (совпадает с SHA, заявленным в
  хендоффе r2), база `origin/dev@2294d46f`
- **Предыдущий раунд:** r1, вердикт красный, `docs/reviews/CODE-REVIEW-267-r1.md`,
  получен на `6efc315ba62e9b62ad5d95bbd0d2bdecb7d967ba`
- **Вердикт: зелёный**

## Скоуп ревью

Второй заход. Разбор — по дельте: `git diff 6efc315b..118062bb`
(исключая сам файл `docs/reviews/CODE-REVIEW-267-r1.md`, который автор
закоммитил вместе с хендоффом и который не является предметом правки).
Полный повторный прогон не требовался: дельта локальна (один коммит
`118062bb`, 8 нерендер-файлов вне `docs/reviews`), не задевает ребейз, не
меняет контракт видимого поведения и не вводит новую подсистему — это ровно
точечное закрытие трёх находок r1.

Файлы дельты (без сборочных артефактов и review-документа):

```
docs/DEVICE-PRESENTATION.md                       |  7 +--
docs/specs/267-device-presentation-decision-table.md | 10 ++--
scripts/mutation-gate.mjs                         | 60 +++++++++++++++++++++-
src/device-presentation-policy.ts                 |  7 +--
src/device-presentation.ts                        |  2 +-
test/device-presentation-policy.test.mjs          | 14 +++--
test/fixtures/device-presentation-decisions.mjs   |  7 +--
```

Плюс синхронные пересборки (`dist/`, `custom_components/.../houseplan-card.js`,
`docs/images/screenshots.json`) — сверены штатными гейтами, не разбирались
построчно.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High-1** — L04/L05/L06 в fixture ссылались на общий mutant `device-presentation-policy-lifecycle`, чей патч физически задевает только ветку `ha_disabled` и не может сломать `userHidden`/`orphaned` | Добавлены три новых, реально нацеленных мутанта: `device-presentation-policy-user-hidden` (патчит `else if (input.userHidden && !input.designPreview)`), `device-presentation-policy-user-hidden-preview` (патчит `else if (input.userHidden)` через `false &&`), `device-presentation-policy-orphaned` (патчит `else if (input.bindingLifecycle === 'orphaned')` тем же приёмом). Fixture переключена на них: L04→`…-user-hidden`, L05→`…-user-hidden-preview`, L06→`…-orphaned` | `scripts/mutation-gate.mjs` (новые записи в `MUTANTS`, ветка после мутанта `device-presentation-policy-lifecycle`); `test/fixtures/device-presentation-decisions.mjs:11-13`; `src/device-presentation-policy.ts:86-92` — текст `find` каждого патча посимвольно совпадает с соответствующей веткой production-кода. Проверено лично прогоном каждого `--id=` (см. таблицу гейтов) — все три «поймано 1 из 1», при снятом мутанте `git status` чист |
| **Medium-1 (в скоупе)** — `unverified` в `BindingPresentationLifecycle` был недостижим: `devices.ts` фильтрует его через `continue` до построения `DevItem`, но L06 «доказывал» его напрямую вызовом policy-функции, а не через `resolveDevicePresentation()` | `unverified` убран из типа `BindingPresentationLifecycle` (`src/device-presentation-policy.ts:27-28`), из ветки резолвера (`src/device-presentation.ts:587-588`, тернарник больше не содержит `unverified`), из теста (снят отдельный `assertDecision(unverified, …)` прогон) и из строки L06/§6.1 ТЗ (переименована в «orphaned binding», без второго исхода). Я перепроверил читанием, что `devices.ts` действительно фильтрует `unverified` **на всех** путях построения `DevItem`: явные device/entity-маркеры (`src/devices.ts:1193,1225`, `continue` до конструирования) и авто-обнаруженные устройства (`src/devices.ts:1108`, `if (bindingStatus.kind !== 'active') continue`) — других мест, где `bindingStatus:` присваивается `DevItem`, в файле нет (`grep -n "bindingStatus:" src/devices.ts` → 3 совпадения, все проверены). Значит удаление ветки — доказуемо чистое удаление мёртвого кода, а не изменение поведения | `src/device-presentation-policy.ts:27-28,86-92`; `src/device-presentation.ts:587-588`; `src/devices.ts:1108,1193,1225`; `docs/DEVICE-PRESENTATION.md` L06; `docs/specs/267-…table.md` §6.1 и интерфейс `DevicePresentationPolicyInput` |
| **Low-1** — `source.skipped_static_fast_path` производился кодом, но не документирован ни в одной строке | Добавлен ряд **S14** в `docs/DEVICE-PRESENTATION.md`, §6.2 ТЗ, `test/fixtures/…` и тест (`presentationRow` для static-fast-path), плюс новый targeted mutant `presentation-static-source-fast-path`, патчащий именно `EMPTY_SOURCES.decisionIds` | `docs/DEVICE-PRESENTATION.md` строка S14; `test/device-presentation-policy.test.mjs:205-210`; `scripts/mutation-gate.mjs` (мутант `presentation-static-source-fast-path`, патч `find: "sourceKind: 'none', decisionIds: ['source.skipped_static_fast_path'],"` — текстуально совпадает с `src/device-presentation.ts:178`). Прогнан лично — «поймано 1 из 1» |

По каждой строке проверка — не заявление автора: я сверил текст патча каждого
нового мутанта посимвольно с текущим кодом (`find` — точная подстрока) и
лично прогнал все четыре новых/изменённых `--id=` индивидуально, наблюдая
результат `поймано 1 из 1` и чистый `git status` после (мутация не осталась
в рабочем дереве).

## Унаследовано из r1

Без повторной проверки в этом раунде — дельта их не задевает:

- **AC1** (каноническая таблица покрывает все ряды) — `docs/reviews/CODE-REVIEW-267-r1.md`, проверено на `6efc315b`. Дельта добавляет один новый ряд (S14, см. выше, перепроверен), остальные 43 не менялись.
- **AC2** (единственный pure policy owner) — там же. Дельта не трогает архитектуру вызовов, только состав веток внутри уже выделенного `resolveDevicePresentationPolicy()`.
- **AC3** (source decisions названы) — там же, на `6efc315b`.
- **AC6** (controller/target parity) и **AC7** (surface parity) — там же; дельта не касается controller-ветки и preview-путей.
- **AC8** (refactor-only pixel/config contract), включая **полный** `npm run golden:verify` — 130/130 на Linux на `6efc315b`. В этом раунде golden не перезапускался целиком: единственное изменение в рендер-пути (`src/device-presentation.ts:587-588`) — удаление ветки `unverified`, которая, как показано в таблице выше, доказуемо никогда не могла быть достигнута с реальным `DevItem`; следовательно результат любого golden-сценария тождественен прогону на `6efc315b`. Три копии бандла пересобраны и идентичны по SHA-256 на `118062bb` (см. таблицу гейтов) — байт-в-байт то же, что даёт `git status` после локальной пересборки (чисто), то есть коммит уже содержит именно этот бандл.
- **AC9** (fast path без лишних вызовов) — там же, чтением кода; дельта не трогает эту ветку.
- **AC10** (штатные гейты) — перепрогнаны заново на `118062bb` в этом раунде (см. ниже), не наследуются.
- Трейлеры `Issue: #267`, `User-Visible: no` — верны на всех коммитах ветки, включая новый `118062bb` (проверено в этом раунде).

## Как проверялось (гейты этого раунда)

| Что | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юнит-тесты | `npm test` | 1379 тестов, 1378 passed, 0 failed, 1 skipped (совпадает с r1) |
| Сборка + сверка бандлов | `npm run build && npm run bundle:sync` + `sha256sum` трёх копий | все три идентичны: `01c5390f051b135f2c21e4e19bd5fa059abb9381d69fbda3eccffa677bf68a1a`; `git status` после пересборки чист — коммит уже содержит этот бандл |
| Документация | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Провенанс/статус issue | `node scripts/process-gate.mjs --base origin/dev --head HEAD --issues` | `гейт пройден, предупреждений 0` |
| Реестр мутантов, структурная сверка | `node scripts/mutation-gate.mjs --check` | зелёный, включая 4 новых/изменённых записи |
| Targeted mutation — реально применены и пойманы (предмет находки High-1) | `node scripts/mutation-gate.mjs --id=device-presentation-policy-user-hidden`, `--id=device-presentation-policy-user-hidden-preview`, `--id=device-presentation-policy-orphaned`, `--id=presentation-static-source-fast-path` (каждый отдельно) | все четыре «поймано 1 из 1»; `git status` после каждого — чисто |
| Выборка смоков по дельте раунда | `node scripts/smoke-select.mjs --base 6efc315b --head HEAD` | НЕОПРЕДЕЛЁННОСТЬ: 0 символов проекта на изменённых строках дельты — решение см. ниже |
| Выборка смоков по полному диффу issue | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение (2): `smoke_controls.mjs` (← `DevItem`), `smoke_wireless_controller_parity.mjs` (← `controllerAvailability`) — то же, что в r1 |
| Названные смоки | `node demo/smoke_controls.mjs`, `node demo/smoke_wireless_controller_parity.mjs`, `node demo/smoke_device_icon_design.mjs` | все три `OK` |
| Golden | не перезапускался в этом раунде | обоснование — см. «Унаследовано из r1», AC8 |
| Инварианты геометрии/модели | не прогонялись | дельта не трогает геометрию/`layout`/толщину стен/`marker.space`/`open_spans` — неприменимо |
| Backend | не прогонялся | дельта не трогает `custom_components/**/*.py` |

**Решение по смокам:** `smoke-select` на дельте раунда (`6efc315b..HEAD`) не
находит доказанной связи — сама дельта не меняет исполняемых веток
production-кода, кроме удаления мёртвой `unverified`-ветки (доказано выше) и
одного текстового литерала (`decisionIds` фолбэк S14, уже покрыт новым
production-тестом `S14`). Прогнал три смока, названные в r1 и в issue
(`smoke_controls`, `smoke_wireless_controller_parity`, `smoke_device_icon_design`),
для контроля регресса на итоговом `118062bb` — все зелёные. Полный набор
192 смоков — предрелизный гейт, не гейт ревью; дельта не даёт оснований его
расширять сверх того, что уже покрывал r1.

## Находки

Нет. Все три находки r1 (High-1, Medium-1, Low-1) закрыты и верифицированы
чтением production-кода и личным прогоном мутантов/тестов/смоков (таблица
выше), новых находок в дельте не возникло.

## Что проверено и корректно

- Закрытие High-1: три новых мутанта нацелены на уникальные, реально
  различающиеся ветки `resolveDevicePresentationPolicy()`; патчи проверены
  посимвольно и прогнаны лично.
- Закрытие Medium-1: `unverified` доказуемо недостижим на всех путях
  построения `DevItem` (три места присвоения `bindingStatus:` в
  `devices.ts`, все фильтруют `unverified` до конструирования) — удаление
  ветки корректно, а не «спрятанная» правка поведения.
- Закрытие Low-1: S14 добавлен по всей цепочке document↔fixture↔production↔
  mutation, включая рабочий production-тест (`presentationRow` с реальным
  `resolveDevicePresentation()`, не изолированный policy-вызов).
- Контракт-тест `device presentation decision document, fixture and mutation
  registry stay exact` (`test/device-presentation-policy.test.mjs:93-107`)
  по-прежнему проходит на новом составе из 44 рядов (замена L06 на «orphaned
  binding», добавление S14) — сверка документ↔fixture↔registry не нарушена.
- Трейлеры `Issue: #267` / `User-Visible: no` на `118062bb` корректны:
  видимое поведение не менялось (удалена недостижимая ветка,
  добавлена тестовая/документационная инфраструктура), `CHANGELOG.md` не
  тронут — это верно для `User-Visible: no`.
- `git rev-parse HEAD` = `118062bb…`, совпадает с материалом,
  заявленным в хендоффе r2.

## Чего не проверял

- Полный `npm run golden:verify` в этом раунде — не перезапускал; см.
  обоснование в разделе «Унаследовано из r1» (AC8): единственное изменение
  рендер-пути — доказуемо мёртвая ветка.
- Полный набор `demo/smoke_*.mjs` (192 файла) — не запускал, только три
  названных плюс два, названных `smoke-select` по полному диффу issue;
  остальные 189 не связаны дельтой ни прямо, ни по «слабой связи» — не
  повод их гонять на этом раунде.
- Инварианты геометрии/модели и backend-тесты — дельта их не задевает.
- Ручное открытие демо-стенда в браузере — не делал; полагаюсь на
  унаследованный из r1 полный golden (130/130) и текущие смоки как
  эквивалентное подтверждение отсутствия визуального регресса.

## Итог

Все находки r1 закрыты и верифицированы независимо (не по слову автора):
патчи мутантов сверены построчно с production-кодом, все четыре
новых/изменённых targeted-мутанта лично прогнаны и пойманы,
недостижимость `unverified` доказана чтением всех точек конструирования
`DevItem`. Штатные гейты (typecheck/test/build+сверка бандлов/check-docs/
process-gate/mutation-gate --check) зелёные на `118062bb`. Новых находок
нет. High: 0, Medium: 0.
