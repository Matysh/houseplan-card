# CODE-REVIEW-406-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/406
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4 (перед этим раундом)
- Ветка: `issue/406-beta2-polish`
- Коммит на ревью: `fe385cbf9d5a0fc11f0bcfacbe4ba03e01167949`
- ТЗ: `docs/specs/406-beta2-polish.md`, revision 4, зелёный `SPEC-REVIEW-406-r4`
- База сравнения: `origin/dev` = `b04387ce914aa8559fb3bc446f99a5751f67f32c`

## Скоуп

Четыре независимые правки из ТЗ:
(а) удаление 13 мёртвых ключей i18n + AST-гейт `test/i18n-dead-keys.test.mjs`;
(б) `role="alertdialog"` + `aria-describedby` для `hp-confirm` (`destructive` и
`warning`), обычные диалоги остаются на HA-ветке (`src/hp-dialog.ts`,
`src/hp-confirm.ts`);
(в) смок `demo/smoke_danger_confirm_branches.mjs` покрывает и HA-, и
нативную ветку;
(г) уборка `marker_area_snapshot` для исчезнувших устройств только при
авторитетном реестре + разворот правила усечения по лимиту
(`src/device-area-relocation.ts`).

Материал ревью — `git log --oneline origin/dev..HEAD` (9 коммитов, из них 5
`docs: review document for #406`/`docs: resolve...`/`docs: revise...` — все
имеют отношение к ТЗ, не к коду) и `git diff origin/dev...HEAD` (42 файла:
продуктовый код, тесты, смоки, мутанты, i18n, бандлы, changelog).

## Как проверялось

Ручного тестирования в цикле нет — правильность работы устанавливается
чтением кода, автотестами и браузерными смоками.

**Прогнано лично на `fe385cbf` (зелёного Validate на этом SHA нет):**

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | 1706 passed, 0 failed, 1 skipped — совпадает с заявкой автора |
| `npm run build` | green, `dist` собран за 16.3s |
| `node scripts/bundle-sync.mjs --check` (после build) | green, три копии бандла синхронны |
| `npm run bundle:budget` | initial 287320 B / budget 300000 B, headroom 12680 B (>0 → AC12 выполнен); есть предупреждение о низком запасе — это фон #367, не регрессия этой задачи |
| `node scripts/mutation-gate.mjs --check` | все мутанты, включая три новых (`i18n-dead-key-returns`, `confirm-dialog-loses-alertdialog`, `area-snapshot-cleanup-ignores-authority`), — `ok` |
| `node scripts/check-docs.mjs` | **RED** — см. находку ниже |
| `node demo/smoke_danger_confirm_branches.mjs` | green, все 24 поля `true` (AC6–AC8) |
| `node demo/smoke_area_relocation.mjs` | green, все 20 полей `true`, включая `authoritativeOrphanRemoved`/`nonAuthoritativeOrphanPreserved` (AC9–AC10) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «НЕОПРЕДЕЛЁННОСТЬ»: изменённых символов проекта — 6 (`MARKER_AREA_SNAPSHOT_LIMIT`, `MarkerAreaBinding`, `_useHaDialog`, `_usesHaDialog`, `validBinding`, `validText`), матрица — 212 смоков, ни один не назван связанным доказуемо |

**Не прогонял и почему:**

- Полная матрица `demo/smoke_*.mjs` (212 файлов) — диапазон затрагивает
  только `hp-dialog`/`hp-confirm` и `device-area-relocation`, у обоих есть
  прямо названные в AC6–AC10 смоки, которые я прогнал. Символы из вывода
  `smoke-select` — внутренние помощники (`_usesHaDialog`, `validBinding`,
  `MARKER_AREA_SNAPSHOT_LIMIT`), уже покрытые юнитами
  `test/device-area-relocation.test.mjs` построчно (проверено чтением: тест
  на переполнение лимита обращается к `MARKER_AREA_SNAPSHOT_LIMIT` напрямую).
  Полный прогон матрицы — предрелизная обязанность (§8), не гейт этого раунда.
- `npm run golden:verify` — прочитал `demo/golden/matrix.mjs`: ни один
  сценарий не открывает destructive/warning `hp-confirm` (есть только
  `device-dialog-*`, `decor-color`, `optimize-preflight-dialog` — другие
  диалоги). Видимый рендер, который затрагивает диапазон, в голден-матрице не
  зафиксирован — прогон не даст сигнала по этой задаче.
- `npm run invariants -- --config …` — диапазон не трогает рёбра комнат,
  записи толщины, `layout`-формат, `marker.space` или `open_spans`;
  `device-area-relocation.ts` меняет только момент уборки записи снапшота и
  порядок среза при переполнении, не геометрию. Не применимо.
- `python -m pytest tests_backend -q` — `custom_components/**/*.py` в диффе
  нет (только скомпилированные frontend-бандлы).
- Перфоманс-профили — не названы в AC, чувствительные к перфу пути не
  тронуты.

## Находки

### Medium (в скоупе, чинится в этой же задаче) — стал устаревшим отпечаток скриншотов документации

`node scripts/check-docs.mjs` красный на `fe385cbf`:

```
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

Воспроизведение (после `npm run build`, который уже входит в проверки
автора):

```
$ node scripts/check-docs.mjs
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

Причина механическая и ожидаемая: `visualFingerprint(ROOT)`
(`scripts/source-fingerprint.mjs`) считается по всему `src/**`, а диапазон
меняет `src/hp-dialog.ts`, `src/hp-confirm.ts`, `src/device-area-relocation.ts`
и все четыре словаря `src/i18n/*.json` — то есть отпечаток обязан был
измениться, и `docs/images/screenshots.json` обязан был обновиться вместе с
ним, независимо от того, меняются ли реально показанные пиксели. Я
дополнительно прогнал `node demo/docs/capture.mjs` во временной копии рабочей
дерева и подтвердил: все 10 сценариев (`view-desktop`, `view-touch`,
`space-create`, `room-contour-close`, `plan-context-tray`, `device-editor`,
`device-display-preview`, `background-editor`, `room-card`, `device-info`) —
из `demo/docs/screenshots.mjs`, ни один не открывает destructive/warning
`hp-confirm`, так что заявление автора «скриншоты не меняются» по существу,
вероятно, верно (файлы отличались побайтово в моей проверке, но это из-за
отсутствующего в песочнице `oxipng`, не из-за иного содержимого кадра — само
сообщение инструмента `oxipng не найден: кадры пишутся как есть, без
перепаковки` называет причину; я откатил эту пробную капчу перед
продолжением ревью). Но идентичность пикселей не отменяет обязательности
шага: `docs/images/screenshots.json` в диффе не тронут вообще
(`git diff origin/dev...HEAD -- docs/images/` — пусто), а `check-docs.mjs`
проверяет именно факт совпадения записанного отпечатка с текущим деревом, не
факт визуального совпадения.

Это ровно тот класс регрессии, который уже дважды оставлял `dev` с красным
job `docs` до следующей задачи (#230, #234, #237): гейт красный на коммите,
который автор передаёт на ревью, и останется красным после мержа, если его
не прогнать перед мержем.

**Ожидаемо**: `npm run build && node demo/docs/capture.mjs && npm run
docs:accept` (или эквивалент), обновлённые `docs/images/screenshots.json` и
(если байты правда меняются вне зависимости от oxipng) PNG — в том же PR.

## Что проверено и корректно

- **AC1–AC3** (мёртвые ключи, гейт, законные динамические/производные
  семейства). `test/i18n-dead-keys.test.mjs` строит множество через реальный
  TS AST (`ts.createSourceFile` по каждому файлу `src/**/*.ts`): литералы,
  шаблонные выражения с горизонтом `+`/`` ` ``, и производное правило
  `_help('x.help')` → `x.help.aria`. Второй тест в файле жёстко фиксирует
  `derivedHelpAria.size === 19` — то есть падает, если производных пар станет
  больше или меньше 19, а не просто «не меньше». `src/i18n/en.json` до/после:
  13 ключей удалены (`history.partition_add`, `confirm.delete_draft`,
  `confirm.delete_draft_segment`, `title.markup`, `history.delete_room`,
  `markup.delete`, `marker.display_hint`, `marker.display_hint_icon`,
  `confirm.delete_room`, `confirm.remove_marker`, `confirm.delete_space`,
  `confirm.unlock`, `confirm.delete_plan`) — совпадает построчно со списком
  ТЗ. `npm test` включает оба теста файла и прошёл.
- **AC4** (коллизия с `test/unified-wall-tool-source.test.mjs`). Строка
  `'history.partition_add'` убрана из проверяемого списка теста тем же
  коммитом, что и ключ из словарей — оба гейта зелёные одновременно
  (проверено прогоном `npm test`).
- **AC5** (паритет словарей). Диф по `de.json`/`fr.json`/`ru.json` даёт ту же
  тринадцатку удалённых строк, что и `en.json` (сверил `git diff` по каждому
  файлу построчно) — синхронно, 52 строки суммарно. `test/i18n.test.mjs`
  входит в `npm test` и прошёл.
- **AC6/AC7** (роль и `aria-describedby`). `src/hp-confirm.ts`: оба `kind`
  (`destructive` и `warning`) получают `.alert=${true}` безусловно —
  дихотомии по виду нет, что и требовал r1/r2 SPEC-REVIEW. `src/hp-dialog.ts`
  добавляет `alert`/`describedBy` как реактивные свойства,
  `_usesHaDialog()` возвращает `false`, когда `alert` истинен, — то есть
  alert-подтверждение принудительно идёт в нативную ветку независимо от
  `customElements.get('ha-dialog')`; нативный `<dialog>` получает
  `role=${this.alert ? 'alertdialog' : 'dialog'}` и
  `aria-describedby=${this.describedBy || nothing}`. Проверил по всему `src/`
  (`grep -n '\.alert='`), что `.alert` выставляет только `hp-confirm.ts` —
  ни один из ~30 других вызовов `<hp-dialog>` (маркер, калибровка,
  бэкдроп, импорт/экспорт, kiosk, слияние комнат и т.д.) не трогает
  `alert`/`describedBy`, то есть остаются обычным `role="dialog"` на
  HA-ветке. `demo/smoke_danger_confirm_branches.mjs` — green, поля
  `noHaDestructiveIsDescribedAlert`/`noHaWarningIsDescribedAlert`/
  `haDestructiveStaysNativeAlert`/`haWarningStaysNativeAlert` истинны;
  последняя пара доказывает именно то, что было провалом в r2 SPEC-REVIEW —
  alert не уходит в зарегистрированный `ha-dialog`. Отдельный `getByRole`
  на реальном accessibility-дереве Chromium (`realAccessibilityTreeIncludesConsequence`)
  подтверждает, что текст последствий действительно долетает до дерева
  доступности, а не только до DOM-атрибута.
- **AC8** (инварианты подтверждения в обоих окружениях). Тот же смок:
  фокус на «Отмена» (`noHa*FocusesCancel`/`ha*FocusesCancel`), Esc → `false`
  (`noHaWarningEscapeResolvesFalse`/`haWarningEscapeResolvesFalse`), клик по
  «Отмена» → `false` в обоих окружениях — все `true`.
- **AC9/AC10** (уборка снапшота только при авторитетном реестре).
  `resolveDeviceAreaRelocations` строит `liveIds`/`liveBindings` из
  `options.devices` и помечает `removeSnapshot: true` для записей снапшота,
  чей id и binding не совпадают ни с одним живым устройством/маркером, — но
  делает это только после `if (!options.authoritative) return ...` в начале
  функции, то есть цикл недостижим при неавторитетном реестре. Проверил
  обоих вызывающих в продукте: `houseplan-card.ts:5054/5166` передаёт
  `devices: this._devices` — полный список, только что пересобранный
  `buildDevices(...)` из актуального `registry`/`markers`/`settings`, а не
  отфильтрованное подмножество; `_syncAreaRelocations` (запись) вызывается
  только при `this._haRegistry.authoritative`. Читающие проекции
  (`space-render.ts:283`, `space-card.ts:455`) используют только
  `.relocateIds` и никогда не вызывают `applyAreaRelocationResolution` — то
  есть read-only карточка не может стереть запись сама
  (`staticMadeNoWrites: true` в смоке это подтверждает). Юниты
  `test/device-area-relocation.test.mjs` («authoritative registry removes
  orphan snapshots but preserves live marker ids» / «non-authoritative
  registry preserves orphan snapshots») и смок
  `demo/smoke_area_relocation.mjs` (`authoritativeOrphanRemoved` /
  `nonAuthoritativeOrphanPreserved`) оба зелёные. Мутант
  `area-snapshot-cleanup-ignores-authority` (снимает условие `authoritative`)
  ловится именно этим юнитом — проверил прогоном `mutation-gate.mjs --check`.
- **AC11** (усечение снапшота сохраняет последние записи). Один символ
  правки: `.slice(0, MARKER_AREA_SNAPSHOT_LIMIT)` →
  `.slice(-MARKER_AREA_SNAPSHOT_LIMIT)`. Новый юнит-тест строит вход
  `LIMIT + 2` записей и проверяет, что первые две (`entry-0`, `entry-1`)
  исчезли, а последняя (`entry-${LIMIT+1}`) осталась, — тест умеет падать:
  на старом `.slice(0, LIMIT)` он утверждал бы обратное и провалился бы.
- **AC12** (бюджет initial). `npm run bundle:budget` → 287320 B при бюджете
  300000 B, положительный запас — не растёт (совпадает с ожиданием ТЗ:
  удаление 52 строк уменьшает бюджет, атрибуты добавляют единицы байт).
- **Трейлеры и changelog**. Коммит `fe385cbf`: `Issue: #406`,
  `User-Visible: yes`. `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` получили по
  одному пункту про переход на нативную оболочку и `alertdialog` — в том же
  коммите, что и код (проверено `git show --stat fe385cbf`).
- **Одно число — один источник**. Диапазон не добавляет и не меняет ни одной
  видимой пользователю величины (роль/aria — не число; лимит `20_000` не
  показывается пользователю ни в каком UI) — раздел неприменим по существу,
  а не пропущен. `test/single-source-numbers.test.mjs` входит в `npm test` и
  прошёл.

## Чего не проверял

- Полную матрицу `demo/smoke_*.mjs` (212 файлов) — обоснование в разделе
  «Как проверялось».
- `npm run golden:verify` — ни один голден-сценарий не открывает
  затронутый диалог; обоснование там же.
- `npm run invariants` и `python -m pytest tests_backend` — диапазон их не
  задевает (геометрия/толщина/`layout` не тронуты; `.py`-файлов в диффе нет).
- Перфоманс-профили — не названы в AC, не тронуты.
- Реальный визуальный вид нативного диалога в живом Home Assistant (смена
  HA-хрома на нативную оболочку, которую ТЗ прямо называет видимым
  компромиссом) — только по коду и accessibility-дереву Chromium; ручного
  просмотра в настоящем HA в этом цикле нет и не может быть.

## Вердикт

Единственная находка — Medium, в скоупе задачи (устаревший отпечаток
`docs/images/screenshots.json` после правок в `src/**`), чинится тем же
шагом, что автор уже применяет в релизном процессе. Все 12 AC доказаны
тестом или смоком, который я лично прогнал и который умеет падать (мутанты
подтверждают это для трёх ключевых контрактов). High-находок нет.

**Жёлтый.**
