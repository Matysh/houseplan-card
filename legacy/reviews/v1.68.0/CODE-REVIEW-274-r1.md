# CODE-REVIEW-274-r1

- Issue: [#274](https://github.com/Matysh/houseplan-card/issues/274) — беспроводной контроллер одинаково выглядит на плане и в preview
- Этап: code (PROCESS.md §2.7) · заход r1 · блокирующих циклов израсходовано 0 из 4
- Ветка: `issue/274-wireless-controller-parity`, коммит `c9b8497f58700748969daf9058304c774b2a7f2d`
- ТЗ: `docs/specs/274-wireless-controller-presentation-parity.md` (получило зелёный вердикт на spec-этапе, `docs/reviews/SPEC-REVIEW-274-r1.md`)
- Это первый code-review раунд задачи — разделы «Закрытие раунда r0» и «Унаследовано из r0» не применяются (правило PROCESS.md §2.9 касается r2+).

## Скоуп проверки

Диапазон: `git log --oneline origin/dev..HEAD` (3 коммита, из них 1 implementation-коммит
`c9b8497`) и `git diff origin/dev...HEAD`. Материал: `src/device-presentation.ts`,
`src/devices.ts`, `src/houseplan-card.ts`, новый unit-тест, новый browser smoke,
два новых мутанта в `scripts/mutation-gate.mjs`, документация (ARCHITECTURE, оба
USER-GUIDE, TESTING, оба CHANGELOG) и три копии бандла.

## Как проверялось

Проверка велась чтением кода **и** исполнением — не только чтением. Все команды
запускались непосредственно на `HEAD` (`c9b8497`).

1. **Прочитан диагноз в issue #274** (три комментария: аналитика, готовность ТЗ,
   handoff на code review) и подтверждённая автором первопричина: `deviceFromMarkerDraft()`
   строил draft только из одного маркера, поэтому tombstone отдельно удалённого
   target-маркера не учитывался в preview так же, как в сохранённом плане; после
   фильтрации цели `sources.sourceKind` у сохранённого маркера выпадал из `'controls'`,
   и `controllerAvailability()` не вызывался — контроллер получал `unavail` при живых
   battery/LQI/update.
2. **Прочитан фикс построчно**:
   - `src/devices.ts:1287-1303` — `deviceFromMarkerDraft()` принимает опциональный
     `siblingMarkers`, строит `markers = [...siblingMarkers.filter(id≠marker.id), marker]`
     и вызывает `buildDevices()` с полным ростером — draft теперь проходит те же
     tombstone/ownership фильтры, что и сохранённый план.
   - `src/houseplan-card.ts:19902-19911` — вызов `deviceFromMarkerDraft()` в
     `_markerPreviewDevice()` получил `siblingMarkers: this._markers` (тот же источник,
     из которого строится сам план, см. `src/houseplan-card.ts:4533`), а memo-ключ
     превью включил `contentFingerprint(this._markers)`, чтобы инвалидироваться при
     изменении общего ростера, а не только текущего маркера.
   - `src/device-presentation.ts:624-640` — введён `configuredController` (маркер не
     manual-virtual-light и имеет непустой persisted `controls`) и `controllerFace`
     (сохраняет прежнее условие `sourceKind === 'controls'`, добавляя случай, когда
     весь runtime-граф цели вычищен tombstone, но маркер по конфигурации остаётся
     контроллером). `controllerAvailability()` не изменена — это соответствует
     явному запрету ТЗ (§9 п.3) менять её без отдельного красного unit.
3. **Проверено, что новый unit умеет падать** (дисциплина «тест должен уметь падать»)
   отдельно для каждого из двух механизмов:
   - временно вернул `src/device-presentation.ts` к версии `origin/dev` (без
     `configuredController`/`controllerFace`) → `node --test test/device-presentation.test.mjs`
     — новый тест `issue 274 keeps a wireless controller…` красный:
     `availability: 'unavailable'` вместо `'available'`;
   - временно вернул `deviceFromMarkerDraft()` к однострочной версии (`markers: [marker]`,
     без sibling-роутера) → тот же тест красный: `draft honours the same tombstones as
     the plan` — `controls` у draft остаётся `['light.wall_group']` вместо `[]`.
   - в обоих случаях восстановил файл до состояния `HEAD` и перепроверил зелёный прогон.
4. **Прогнаны оба новых мутанта из `scripts/mutation-gate.mjs` напрямую**
   (`node scripts/mutation-gate.mjs --id=<id>`), а также существующий мутант
   `controller-availability-follows-target`, чей `find/replace` был обновлён в этом
   diff из-за переименования переменной — все три «покраснели, как обязаны», без
   ложных срабатываний в чистом прогоне.
5. **Прогнаны все дешёвые гейты заново на `HEAD`**: `npx tsc --noEmit` — чисто;
   `npm test` — 1167/1167 (0 fail, 0 skip — расходится с текстом автора «1166 pass,
   1 skip», см. «Чего не проверял»); `npm run build` — чисто, три копии бандла
   (`dist/houseplan-card.js`, `custom_components/.../houseplan-card.js`, синхронизированный
   `demo/srv/assets/houseplan-card.js`) идентичны байт-в-байт; `node scripts/check-docs.mjs`
   — «Documentation checks passed (7 files, 10 external links)».
6. **`node scripts/smoke-select.mjs --base origin/dev --head HEAD`** дал ровно тот же
   набор из пяти смоков, что назвал автор (`smoke_wireless_controller_parity`,
   `smoke_binding_picker`, `smoke_climate_once`, `smoke_controls`, `smoke_cover_tap`,
   все — «прямое совпадение»). Все пять исполнены (после `node scripts/bundle-sync.mjs`,
   без которого `demo/srv/assets/houseplan-card.js` не существовал в этом checkout) —
   все green, включая новый смоук с 11 отдельными assertion (`previewMatchesPlan`,
   `planKeepsLiveLqi`, `activeTargetWorksOnBothSurfaces` и др.).
7. **Прочитан новый смоук `demo/smoke_wireless_controller_parity.mjs` целиком** —
   сценарий воспроизводит ровно field fixture из ТЗ (event=unknown, battery=100,
   LQI=164, update=off, group=off), сравнивает `_devicePresentation()` плана с DOM
   (`data-state`, класс `unavail`, текст LQI) и с `hp-device-preview` в открытом
   диалоге того же маркера, затем возвращает target активным и проверяет, что обе
   поверхности синхронно становятся `working`. Работает через production-бандл
   (`assertFreshDemoBundleUnlessAllowed`), а не через мок.
8. **Проверено «одно число — один источник»**: `lqiText` вычисляется один раз внутри
   `resolveDevicePresentation` (`src/device-presentation.ts:764`) и потребляется и
   планом, и preview из одного и того же объекта `ResolvedDevicePresentation` — новый
   код не вводит второй путь для LQI. `test/single-source-numbers.test.mjs` прогнан
   отдельно — зелёный.
9. **Проверено, что фикс не ослабляет негативный контракт #251**: полный прогон
   существующего теста `issue 251 separates controller availability from controlled
   target status` (virtual, event-only-unavailable, все-diagnostics-unavailable,
   alarm-приоритет) остался зелёным без изменений тела теста; отдельно прослежено,
   что во всех его сценариях `light.wall_group` остаётся persisted-control с реальным
   состоянием (не tombstoned), поэтому `sources.sourceKind` там не покидает `'controls'`
   и новая ветка `configuredController` в этом тесте не участвует — расширение
   покрытия для tombstone-случая сделано отдельным новым тестом (issue 274), что
   допустимо согласно техническому предположению №4 ТЗ (раскладка тестов — решение
   ревьюера при сохранении AC2/AC4 и исполняемых мутантов).
10. Проверено, что diff не трогает геометрию/рёбра/`layout`/`marker.space`/`open_spans`
    → `npm run invariants` не требуется (см. «Чего не проверял»).
11. Проверены трейлеры коммита `c9b8497`: `Issue: #274`, `User-Visible: yes`; в том
    же коммите обновлены `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` (проверено
    `git show c9b8497 --stat`).

## AC — построчная проверка

| AC | Статус | Доказательство |
|---|---|---|
| AC1 (fixture доступна и нейтральна) | Выполнен | новый unit в `test/device-presentation.test.mjs` через production `buildDevices()`; `saved.entities === own`, `visual.availability==='available'`, `lqiText==='164'` — проверено исполнением |
| AC2 (plan и preview совпадают) | Выполнен | `smoke_wireless_controller_parity.mjs` (`previewMatchesPlan`, `planDomAgrees`) — исполнено против production-бандла |
| AC3 (группа меняет только status) | Выполнен | тот же смоук: `off→on` переводит обе поверхности в `working`, `availability` не меняется (`activeTargetWorksOnBothSurfaces`) |
| AC4 (registry/state generation) | Выполнен частично, по существу | смоук воспроизводит начальный event-only-плюс-диагностика ростер, `_maybeRebuildDevices()` (registry-путь), state-тик цели (off→on) и сверяет обе поверхности после каждого шага; отдельного сценария continuity hold/candidate/commit не добавлено — принято как обоснованное сужение, см. ниже |
| AC5 (негативный контракт #251 не ослаблен) | Выполнен | существующий тест #251 не тронут и зелёный; прочитано, почему новая ветка `configuredController` не активируется в его сценариях |
| AC6 (Static/kiosk/theme parity) | Выполнен по коду, не по golden | фикс расположен в `resolveDevicePresentation()`, общем для View/kiosk/Static/preview — все потребители получают один расчёт; `npm run golden:verify` не прогонялся полностью, см. «Чего не проверял» |
| AC7 (два исполняемых мутанта) | Выполнен | `wireless-controller-loses-filtered-target-role` и `wireless-controller-preview-drops-sibling-markers` — оба прогнаны напрямую, оба «покраснели, как обязаны» |
| AC8 (локальные гейты) | Выполнен | `tsc --noEmit`, `npm test`, `npm run build`+bundle parity, `check-docs.mjs` — прогнаны заново на `HEAD`, см. выше |

## Находки

Блокирующих (High/Medium в скоупе) находок нет.

**Low — принято без изменений, с записью.**

1. `src/houseplan-card.ts:19902` — memo-ключ превью теперь считает
   `contentFingerprint(this._markers)` при каждом вызове `_markerPreviewDevice()`,
   т.е. на каждый ре-рендер открытого диалога маркера, а не только на его открытие.
   Это полный обход всего персистентного ростера маркеров (до ~200 по цели J6), а не
   точечный lookup. Снято как некритичное: операция ограничена editor-only
   поверхностью (диалог маркера, desktop admin), стоимость — линейный проход по
   строковому представлению конфигурации без сети/polling, что укладывается в
   допущение ТЗ §10 «bounded O(e) fingerprint/lookup on device rebuild or snapshot
   capture»; аналогичный по стоимости `contentFingerprint` уже используется в этом
   файле для `_serverCfg`/`_layout`. Замер: не проводился (не назван ни в AC, ни как
   perf-sensitive путь), поэтому вывод сделан по анализу сложности, а не по профилю.

2. Автор заявил в handoff-комментарии «`npm test` — 1167 tests: 1166 pass, 1 skip,
   0 fail»; мой прогон на этом же `HEAD` даёт 1167 pass, 0 skip, 0 fail. Расхождение
   не влияет на вывод (0 fail в обоих случаях) и объясняется тремя условными
   `t.skip(...)` в `test/process-gate.test.mjs`, зависящими от доступности `git`/
   платформы — в среде ревью `git` доступен, поэтому skip не сработал. Не находка,
   зафиксировано для прозрачности числа, которое звучит в отчёте автора.

## Что проверено и корректно

- Корневая причина (roster parity + fallback availability) подтверждена чтением
  кода и **исполнением**: оба ключевых механизма фикса умеют ломаться (см. п.3
  «Как проверялось») и оба перехвачены именно тем unit-тестом и именно тем
  мутантом, которые заявлены в AC7.
- `controllerAvailability()` не изменена — запрет ТЗ соблюдён; фикс расположен
  строго на границе roster/sourceKind, как и требовало предположение №1 ТЗ.
- Manual-virtual-light и cover-face исключены из `configuredController` явно
  (`!isManualVirtualLightMarker(...)`, `sourceKind !== 'light' && !== 'cover'`) —
  дедициованная availability этих лиц не затронута; негативный контракт #251
  остаётся зелёным без правок его теста.
- Единственная точка вызова `deviceFromMarkerDraft()` в продакшен-коде обновлена;
  сигнатура обратно совместима (`siblingMarkers` — опциональный параметр).
- Документация (ARCHITECTURE.md, оба USER-GUIDE, TESTING.md, оба CHANGELOG) и три
  копии бандла обновлены в том самом implementation-коммите с верными трейлерами.
- `smoke-select.mjs` вернул именно тот набор, что заявлен автором; все пять смоков
  исполнены и зелёные на production-бандле.
- «Одно число — один источник» для LQI не нарушено: единственный расчёт
  `lqiText` внутри `ResolvedDevicePresentation`.

## Чего не проверял (и почему)

- **`npm run golden:verify` (полная матрица).** Попытка прогона в этой среде не
  успела завершиться за 180 c (лимит фонового шага) и не выдала промежуточного
  вывода — полный набор захватывает десятки визуальных фикстур в headless Chromium
  и по ТЗ (§ «Локальные гейты реализации», AC8) относится к prerelease-гейтам, а
  не к гейту ревью. Дополнительно проверено по коду: существующая golden-фикстура
  `device-icon-state-table-{light,dark}` (`demo/golden/matrix.mjs:404-424`) включает
  контроллер с `controls` (`golden-left-linkquality`), но не воспроизводит именно
  tombstone-сценарий из #274 — то есть полный прогон дал бы только общую
  регрессионную проверку («ничего другого не сдвинулось»), а не прямое
  доказательство AC6, которое уже даёт `smoke_wireless_controller_parity.mjs`
  прямым сравнением DOM плана и preview. Решение: не прогонять полную матрицу на
  этом раунде, отметить как открытый пункт для prerelease-гейта.
- **`npm run invariants`.** Diff не трогает рёбра комнат, `layout`, `marker.space`,
  `open_spans` или другую геометрию — гейт неприменим к этой задаче.
- **`python -m pytest tests_backend`.** `custom_components/**/*.py` не тронут.
- **Continuity hold/candidate/commit сценарий из AC4 отдельным unit'ом.**
  Подтверждённая автором первопричина — roster/tombstone на уровне `buildDevices()`,
  а не гонка поколений `RenderDeviceSnapshot`; специализированного теста на
  hold/candidate/commit для именно этого маркера не добавлено. Принято как
  обоснованное сужение (ТЗ, техническое предположение №4: раскладка lifecycle-тестов
  — решение ревьюера при сохранении AC2/AC4 и исполняемых мутантов) — существующие
  тесты continuity/снапшота (не входящие в этот diff) прошли без изменений в общем
  прогоне `npm test`, то есть регрессии в этой части не внесено, но новый прямой
  сценарий для #274 не добавлен.
- **Полный browser smoke-набор (`ls demo/smoke_*.mjs`, 175 файлов).** Выбор
  `smoke-select.mjs` показал только «прямые совпадения», без «неопределённости» —
  расширять выборку не потребовалось.
- **Performance-профили.** Не названы в AC и не затронуты чувствительным к перфу
  путём напрямую (только Low-находка №1 про memo-ключ, разобранная по сложности).
- **Ручное тестирование в браузере с реальным HA.** Не входит в цикл ревью;
  замещено production-bundle browser smoke и unit-тестами, исполненными лично.

## Итог

AC1–AC3, AC5, AC7, AC8 доказаны исполнением. AC4 и AC6 доказаны по существу
(код общий для всех поверхностей, ключевой сценарий смоука зелёный), но не
полным набором continuity- и golden-проверок — оба сужения объяснены выше и не
меняют вывод: корневая причина устранена в правильном месте, оба обязательных
мутанта ловятся, негативный контракт #251 не ослаблен, документация и трейлеры
в порядке. Находок уровня High/Medium нет.
