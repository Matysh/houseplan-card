# CODE-REVIEW #32 · r1 — единое подтверждение опасных действий

- Issue: https://github.com/Matysh/houseplan-card/issues/32
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- Материал: `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
- ТЗ: `docs/specs/032-unified-danger-confirmation.md` (spec-review зелёный на r2,
  SHA `206bcd1a`, документы `docs/reviews/SPEC-REVIEW-32-r{1,2}.md`)
- Это первый раунд код-ревью — предыдущего кода-раунда нет, разбор полный,
  разделы «Унаследовано из r0» и «Закрытие r0» не нужны.

## Скоуп диффа

`origin/dev...HEAD`, 57 файлов, ключевые продуктовые:

- `src/danger-confirm.ts` (новый) — `HpConfirmController`, replace-not-queue,
  token-based resolve.
- `src/hp-confirm.ts` (новый) — presentation поверх `hp-dialog`.
- `src/houseplan-card.ts` — controller-owner, host API `_confirmDanger`/
  `_cancelDangerConfirm`, cancel на смене space/mode/route/disconnect, unlock
  call site.
- `src/houseplan-editor-runtime.ts`, `src/houseplan-onboarding-runtime.ts` —
  миграция 7 из 8 call sites (draft whole/segment, marker, plan×2, space×2).
- `src/i18n/{en,ru,de,fr}.json` — новые title/body ключи.
- `src/styles/dialogs.styles.ts` — стили `.danger-confirm-*`.
- `test/danger-confirmation.test.mjs` (новый), правки
  `test/render-device-snapshot.test.mjs`, `tsconfig.test.json`.
- `demo/smoke_danger_confirmation.mjs` (новый), правки `demo/smoke_lock_action.mjs`,
  `demo/smoke_lock_invariant.mjs`, `demo/smoke_saved_plans.mjs`.
- Документация: `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.ru.md`, оба CHANGELOG,
  сгенерированное дерево бандла (dist + custom_components + demo/srv).

Основа сверена читением: все 8 call sites §4.1 ТЗ найдены в диффе как
`await this._confirmDanger(...)` / `await this.host._confirmDanger(...)`;
прямых вызовов `confirm(` в `src/**` не осталось (перепроверено `rg` и
собственным прогоном `test/danger-confirmation.test.mjs`).

## Как проверялось

Зелёного Validate на SHA `7b363caa` нет — все гейты ниже прогнаны мной лично
в рабочей копии на этом SHA.

### Дешёвые гейты (прогнаны)

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm test` | `tests 1652 · pass 1651 · fail 0 · skipped 1` |
| `npm run bundle:sync` | build ok; `git status --porcelain` после — пусто (три дерева синхронны) |
| `npm run bundle:budget` | `initial View: 285355 B gzip (budget 300000 B, headroom 14645 B)` — совпадает с заявкой автора (+1300 B к baseline 284055, ≤3 KiB по AC-13) |
| `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | `Новых any нет` (379 добавленных строк в 6 файлах) |

`npm run invariants` не прогонял: дифф не трогает рёбра/толщину/`layout`/
`marker.space`/`open_spans` — только диалоговый слой и call sites,
геометрия не затронута.

`npm run golden:verify` не прогонял: новый диалог не входит в golden-матрицу,
и diff не показывает изменения существующего baseline (только служебные
скриншоты документации, см. ниже).

`python -m pytest tests_backend -q` не прогонял: `custom_components/**/*.py`
не тронут (только сгенерированное `frontend/*`).

Performance-профили не прогонял: не названы в AC, чувствительные к перфу пути
не затронуты.

### Browser smoke — выбор и результат

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: матрица 209
смоков, 39 «прямое совпадение», 81 «слабая связь» (остальное неопределённость).
Прямые совпадения в основном объясняются тем, что дифф трогает общие поля
хоста (`_mode`, `_markerDialog`, `_spaceDialog`, `_physicalDialog`,
`_curSpaceCfg`, `_openingInfo`, `_commitSpace`) в функциях-обёртках
(`_setMode`, `_commitSpace`, `_editorSecondaryDialogBlocked`), а не потому что
эти смоки проверяют подтверждение как таковое.

Прогнал (актуальный контракт диалога — cancel/accept/replace/focus/touch,
уже прогнанные автором плюс независимая перепроверка):

`smoke_danger_confirmation`, `smoke_esc_dialogs`, `smoke_dialog_footer_width`,
`smoke_toggle_confirmation`, `smoke_opening_binding`, `smoke_lock_action`,
`smoke_lock_invariant`, `smoke_saved_plans`, `smoke_warm_dialogs`,
`smoke_editor_tabs` — все 10 зелёные (полный JSON output эквивалентен
заявке автора).

Дополнительно прогнал прямые совпадения на `_physicalDialog`/`_openingInfo`,
которых не было в списке автора, потому что ровно они называют мигрированные
call sites (`_deleteDraftWhole`/`_deleteDraftSegment`, `_lockAction`):
`smoke_free_walls`, `smoke_registryless_opening`, `smoke_inert_openings`,
`smoke_open_passage`, `smoke_lazy_editor_chunk` (AC-10).

Это вскрыло H1 (ниже): `smoke_free_walls` и `smoke_registryless_opening`
падают. Разбирая причину, прошёлся по всем демо-смокам, которые вообще
вызывают один из мигрированных методов
(`grep -rl "_deleteMarker\|_deleteSpace()\|_deleteServerPlan\|_deleteDraftWhole\|_deleteDraftSegment\|_deletePhysicalSelection\|_lockAction(" demo/smoke_*.mjs`
→ 11 файлов) и отдельно все, что стабили `window.confirm`
(`grep -rl "window\.confirm\s*=" demo/smoke_*.mjs` → 6 файлов), чтобы отделить
не задетые (`lock`-only, `partition`/`column`-kind, blocked-путь) от реально
сломанных. Результат — раздел «Находки» ниже.

Остальные 29 прямых совпадений и все 81 слабых не прогонял: по чтению кода
дифф трогает эти поля только через общий `_editorSecondaryDialogBlocked`/
`_cancelDangerConfirm` — они не меняют логику, которую эти смоки проверяют
(room dialog, merge/split, tap confirm, vac calibration, палитра мебели и
т.п.), а не потому что «выбор по теме» — их предмет прямо не пересекается ни
с одним из 8 мигрированных call sites (подтверждено `grep` выше: только
перечисленные 11 файлов вообще вызывают эти методы).

## Находки

### H1 — миграция ломает существующие смоки: 2 дают неверный вердикт, 3 виснут навсегда

**Файлы:** `demo/smoke_free_walls.mjs`, `demo/smoke_registryless_opening.mjs`,
`demo/smoke_binding_picker.mjs`, `demo/smoke_hidden_flag.mjs`,
`demo/smoke_optional_space_model.mjs`.

Задача заменяет синхронный `confirm()` на `await this._confirmDanger(...)`,
который резолвится только реальным кликом по кнопке диалога. Дифф обновил под
это ровно 3 существующих смока (`smoke_lock_action.mjs`,
`smoke_lock_invariant.mjs`, `smoke_saved_plans.mjs` — видно в
`git diff origin/dev...HEAD --stat`), но в дереве есть ещё 5 смоков, которые
вызывают один из тех же восьми call sites и по-старому либо стабят
`window.confirm = () => true` без взаимодействия с диалогом, либо не ждут
промис вовсе. Воспроизведено исполнением, не догадкой:

```
$ node demo/smoke_free_walls.mjs
FAILED (2):
  - deleteOnDraftRemovesWholeOutline: expected true, got false
  - invalidThicknessCreatesNothing: expected true, got false

$ node demo/smoke_registryless_opening.mjs
FAILED (1):
  - explicitInfoActionStillWorks: expected true, got false

$ timeout 25 node demo/smoke_binding_picker.mjs
Terminated            # процесс не завершается сам, требуется kill

$ timeout 25 node demo/smoke_hidden_flag.mjs
Terminated

$ timeout 25 node demo/smoke_optional_space_model.mjs
Terminated
```

Причина видна в исходниках смоков:

- `smoke_free_walls.mjs:13` ставит `window.confirm = () => true;`, затем
  синхронно вызывает `c._deletePhysicalSelection()` на `draft`-выборе (строки
  195–197) и тут же читает результат — `_deletePhysicalSelection` для
  `kind: 'draft'` делает `this._deleteDraftWhole(); return;` без `await`
  (`src/houseplan-editor-runtime.ts:3072`), поэтому реальное удаление
  происходит позже, после клика по несуществующей кнопке — который никогда не
  случается.
- `smoke_registryless_opening.mjs:89-91` тем же способом стабит `window.confirm`
  и вызывает `card._lockAction(lockId, 'unlock')` без `await`, читая
  `serviceCalls.at(-1)` сразу же.
- `smoke_binding_picker.mjs:33-34`, `smoke_hidden_flag.mjs:83-84,96-97`,
  `smoke_optional_space_model.mjs:91-93` **ждут** промис
  (`await c._deleteMarker()` / `await card._deleteSpace()`), но промис
  `_confirmDanger` резолвится только явным `hp-confirm-decision`, а стаб
  `window.confirm` больше никем не читается — сцена не диспатчит клик,
  дизконнект или замену запроса, поэтому `await` виснет бесконечно. Три файла
  проверял отдельно — во всех трёх процесс не завершается, `finish()`
  (`demo/serve.mjs:35`, выставляет `process.exitCode = 1` при провале) вообще
  не достигается. Это хуже явного провала: в CI такой смок не падает быстро, а
  занимает слот до тайм-аута раннера.

Не задеты (проверено, не потребовалось чинить): `smoke_orphan_space_references.mjs`
стабит `window.confirm` и ждёт `_deleteSpace()`, но сценарий останавливается на
blocker-проверке до `_confirmDanger` (`deleteExplainsBlockerWithoutConfirmOrWrite`),
поэтому не виснет — прогнан, зелёный. `smoke_opening_binding.mjs` и
`smoke_partition_openings.mjs` вызывают `_lockAction(..., 'lock')` (не 'unlock')
и `_deletePhysicalSelection()` на `partition`/`column`-выборе — ни один путь не
проходит через `_confirmDanger` по контракту §4.1/§7 ТЗ, поэтому оба зелёные
без правок.

Это не «сторонний тест устарел сам по себе» — регресс создан ровно теми
изменениями, которые в скоупе задачи (§4.1 ТЗ, миграция `_deleteDraftWhole`,
`_deleteMarker`, `_deleteSpace`, `_lockAction`). Три из восьми уже
адаптированных смоков показывают правильный образец правки — кликать по
`hp-confirm .danger-confirm-footer .btn...` после `await c.updateComplete`
(см. `demo/smoke_lock_action.mjs`, `demo/smoke_lock_invariant.mjs`,
`demo/smoke_saved_plans.mjs`), тот же приём применим к оставшимся 5 файлам.
До правки полный pre-release smoke-прогон (§8) зависнет на трёх из них.

**Серьёзность: High.** Блокирует; чинится в этой же задаче (§4.1 её
собственный скоуп), issue не заводится.

### L1 — шесть старых односложных ключей i18n остались без потребителей

`confirm.delete_draft`, `confirm.delete_draft_segment`, `confirm.remove_marker`,
`confirm.delete_space`, `confirm.unlock`, `confirm.delete_plan` присутствуют во
всех четырёх словарях, но после миграции ни один файл в `src/**`, `test/**`,
`demo/**` их не использует — проверено:

```
$ grep -rn "confirm\.delete_draft'" src/ test/ demo/   # и так для всех шести — пусто
```

ТЗ §8 разрешает удаление старых ключей «только если source/test search
доказывает отсутствие потребителей» — этот поиск и есть доказательство.
AC-11 (парность словарей) не нарушен: возврат чист, находка не о корректности,
а об оставленном мёртвом коде.

**Серьёзность: Low.** Не блокирует; можно поправить в этой же правке (удалить
шесть ключей из всех четырёх словарей) либо оставить с запиской — на
усмотрение автора.

## Что проверено и совпало с кодом

- **AC-1/AC-2** — source-contract test (`test/danger-confirmation.test.mjs`,
  тест «all dangerous-action call sites use the shared confirmation contract»)
  считает 0 вызовов `confirm(` и ровно 8 `await this(.host)?._confirmDanger(`
  в перечисленных трёх файлах, плюс проверяет все 6 диагностических `key`.
  Тест умеет падать: `nativeCalls.length === 0` и `sharedCalls.length === 8`
  оба жёстко зафиксированы, любое отклонение красит тест.
- **AC-3/AC-4/AC-5/AC-6/AC-7/AC-8/AC-9** — `demo/smoke_danger_confirmation.mjs`
  прогнан лично, зелёный; закрывает cancel-safety по всем 6 классам операций
  (включая оба lazy runtime для plan/space), replace-семантику, race
  (`staleContextCannotMutate`), фокус/трап/320px/локали.
- **AC-10** — `demo/smoke_lazy_editor_chunk.mjs` (не тронут диффом, прогнан
  лично) остаётся зелёным: `onboardingDoesNotLoadEditor: true` — controller
  и `hp-confirm` действительно в eager root, не тянут editor chunk.
- **AC-11** — `npm test` включает `test/i18n.test.mjs`, generic key-set parity
  (`assert.deepEqual(Object.keys(dictionary).sort(), enKeys)`) прошёл для всех
  четырёх словарей.
- **AC-12** — читением: `_roomDeleteDialog`, `_partitionDeleteDialog`,
  `confirm.erase_decor`, backup/optimize диалоги не тронуты диффом (нет их в
  списке изменённых файлов/функций), `_editorSecondaryDialogBlocked` получил
  добавление `_dangerConfirm` в общий OR-список блокировки secondary-панели —
  это тот же паттерн, что уже применён к `_tapConfirm`/`_roomDialog` и не
  меняет их собственную логику. `smoke_editor_tabs`, `smoke_esc_dialogs`
  (оба трогают `_markerDialog`/`_roomDialog`/`_spaceDialog`) зелёные.
- **AC-13** — см. таблицу гейтов выше, число совпадает с заявкой автора.
- **Race-safety §7** — читением всех 7 переписанных call sites
  (`_deleteDraftWhole`, `_deleteDraftSegment`, `_deleteMarker`,
  `_deleteServerPlan`×2, `_deleteSpace`×2): каждый захватывает identity
  (`spaceId`/`draftId`/`segment`/`targetId`/`plan.url+modified`) до `await`,
  затем перепроверяет её после — включая пересчёт `collectSpaceMarkerDependencies`
  и `deletingLastSpace` заново для `_deleteSpace`, ровно как требует §7 ТЗ.
  Дополнительно подтверждено исполнением: `staleContextCannotMutate` в
  `smoke_danger_confirmation.mjs` меняет `_space` между открытием и `resolve`
  и проверяет, что геометрия не мутировала.
- **Unlock revalidation** — `_lockAction` (`src/houseplan-card.ts:12766`)
  перепроверяет `_openingEntityAvailable`, что `_openingInfo` — тот же
  proём/тип/`lock` id, и что состояние всё ещё `'locked'`, иначе не вызывает
  `hass.callService`. `test/render-device-snapshot.test.mjs` теперь проверяет
  тот же порядок статическим разбором продакшен-исходника.
- **Blocker-проверка раньше confirm** (§4.1 таблица сценариев, «пространство»)
  — в обеих реализациях `_deleteSpace` блокер-чек и ветка «последнее
  пространство» стоят строго до `_confirmDanger`, без изменений порядка
  относительно dev.
- **Bundle sync** — сгенерированное дерево (`dist/**`,
  `custom_components/houseplan/frontend/**`, `demo/srv/assets/**`) идентично
  тому, что производит `npm run bundle:sync` на этом SHA (`git status`
  пустой после локальной сборки).
- **Трейлеры** — все 7 коммитов имеют `Issue: #32`; `User-Visible: yes` стоит
  ровно у коммита `c91ac74e`, и оба CHANGELOG изменены в этом же коммите
  (`git show --stat c91ac74e`).
- **Документация** — `docs/ARCHITECTURE.md` (новый абзац One modal contract),
  `docs/USER-GUIDE.ru.md` (терминология «Отмена», «Esc», диалог называет
  объект — согласовано с текущим текстом гайда, не изобретено).

## Чего не проверял

- 29 из 39 «прямых» и все 81 «слабых» строк `smoke-select` — обоснование в
  разделе «Как проверялось».
- `npm run golden:verify`, `python -m pytest tests_backend`,
  performance-профили, `npm run invariants` — обоснование там же (не
  затронуты диффом/AC).
- Ручное браузерное тестирование вне headless-смоков (touch-жесты на реальном
  устройстве, экранный ридер) — вне возможностей цикла; доверился
  `demo/smoke_danger_confirmation.mjs` и existing `smoke_esc_dialogs`/
  `smoke_dialog_footer_width` как прокси для focus trap/320px/screen-reader
  разметки (`role`/`aria` наследуются от `hp-dialog`, не проверял вручную
  скринридером).
- Полный прогон всех 209 демо-смоков — не требуется на этапе ревью
  (PROCESS.md §8, это пред-релизный гейт), но именно поэтому H1 не является
  «пропустил бы CI» — это ревью и должно было его поймать до пред-релизного
  гейта, что и произошло.

## Вывод

AC-1…AC-13 подтверждены по коду и/или исполнением, кроме побочного эффекта
миграции на пять не входящих в §4.1 файлов демо-смоков (H1) — тот же класс
регресса, что и в описанном риске ТЗ «синхронный caller продолжит работу до
решения», только на testing-инфраструктуре, а не в продакшен-пути. Продуктовый
код и текстовый контракт корректны и полностью соответствуют ТЗ; блокирует
только H1.

Вердикт: жёлтый. Возврат автору для правки 5 смоков (образец есть в этом же
диффе) и по желанию — снятия L1.
