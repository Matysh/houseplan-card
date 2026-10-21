# CODE-REVIEW-976-r1

Issue: #976 · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов 0/4
Материал: `48cd7b41046b9dab143425e5999e169da94f2abd` (ветка `issue/976-ui-polish`,
`origin/dev` на момент ревью — рабочая копия уже на материале, `git status` чист).

## Скоуп

ТЗ (ревью ТЗ r1, зелёное, `docs/reviews/SPEC-REVIEW-976-r1.md`) переносит весь цикл
UI Lab UI-001–UI-010 в продукт: единый UI настроек для второстепенных диалогов
(Помощь, PDF, Устройства, Правила иконок), общий accepted-close lifecycle с
анимацией, стабильный возврат фокуса без вспышки рамки, единый клик по инструменту
после вторичного меню (UI-010), визуальная полировка сводной панели и превью
«Лучи солнца», замена «Стереть» → «Удалить». 16 коммитов, 118 файлов, ~1700/270
строк. Все коммиты несут `Issue: #976`; `User-Visible: yes` — в 5 коммитах, и в
каждом из них правка синхронно затрагивает `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` (проверено `git show --stat` по каждому).

Risk-by-changed-hunks (трек ask — сверка по AC ТЗ, не reclassify):

| Класс | Токен/место | AC ТЗ | Вывод |
|---|---|---|---|
| geometry | `houseplan-editor-runtime.ts:10804` (`wall-thickness`) | UI-010 + явная строка ТЗ «Проверить аналогичные переходы в других редакторах при изменении общего контроллера» | Покрыто: только `data-editor-tool-intent` на существующей кнопке инструмента, геометрия стен не затронута |
| touch | `dialog-return-focus.ts:17`, `editor-secondary.ts:311/315`, `led-strip-editor.ts:745` | AC5 (focus), AC10 (один клик после меню), AC3/4 (все потребители `hp-dialog`, включая LED picker) | Покрыто: `led-strip-editor.ts:745` — тривиальная обёртка `dialogPresence(this.pickerDialog())`, сам `hp-dialog` этого пикера явно входит в перечень потребителей из раздела «Архитектура» ТЗ |
| perf | `device-inbox-menu.ts:25,31-34` (`getBoundingClientRect`×3, `offsetWidth`, `offsetHeight`) | AC9 + допущение «не добавлять… синхронные layout-read в render» | Покрыто: вызов только из `@toggle` на `<details>` (пользовательское действие), не из `render()` — проверено чтением `houseplan-editor-runtime.ts` и `device-inbox-menu.ts` |

Все три класса покрыты AC ТЗ. Маршрут вердикта — `fix` (как и зафиксировано
снимком политики для ask).

## Как проверялось

Дешёвые гейты не перегонялись — материал `48cd7b410` имеет зелёный Validate
https://github.com/Matysh/houseplan-card/actions/runs/39487500219 (402 smoke,
220 golden, frontend/backend/performance). Прочитан полный `git diff
origin/dev...HEAD` (3694 строки) построчно, сверены:

- `src/dialog-presence.ts`, `src/dialog-exit.ts`, `src/dialog-return-focus.ts`,
  `src/hp-dialog.ts` (новый lifecycle `beginExit`/`cancelExit`/`rejectClose`,
  `DialogExitController`, Popover-fallback, inert-presentation) — чтением, с
  трассировкой состояний (`_closing`, `_closeRequested`, `_releasedModal`,
  `_exit.current`) по всем вызывающим путям (`_requestClose`, `_onHaHide`,
  `_onHaClosed`, danger-confirm, marker dialog permission-bypass).
- `src/editor-secondary.ts` (`handleOutsideDismiss` — UI-010 фикс) и
  `test/editor-secondary.test.mjs` — вручную протрассирован сценарий отзыва
  мутанта `toolbar-dismiss-swallows-intent-976` (откат `onToolIntent`): тест
  `#976 direct tool pointer and keyboard intents dismiss without swallowing
  their activation` перестаёт проходить, так как функция вернёт `true` вместо
  `false` — padает корректно.
- `src/dialog-exit.ts` + `test/dialog-exit.test.mjs` — прослежены оба
  зарегистрированных мутанта (`dialog-exit-stale-completion-976`,
  `dialog-exit-never-bounded-976`): для первого вручную проверено, что патч
  `if (false) return;` даёт `controller.current !== current` после повторного
  `old.complete()`, что ломает `assert.equal(controller.current, current)`;
  для второго — пустой `cancelTimer` оставляет `timers` пустым, и
  `timers[0].callback()` кидает на `undefined`. Оба — валидные caught-сценарии
  (проверено чтением, не исполнением мутанта — мутанты не запускались).
- `src/device-inbox-menu.ts` + `test/device-inbox-menu.test.mjs` — мутант
  `inbox-menu-forgets-footer-976` (замена `Math.min(...,footer.top)` на
  `viewport.top+viewport.height`) проверен вручную на втором тестовом случае:
  даёт `bounds.height=500` вместо ожидаемых `0` — тест падает.
- `src/houseplan-card.ts`: обёртка всех ~25 диалоговых сайтов `dialogPresence`,
  включая корректный bypass анимации для permission-revoke (`_markerDialog`,
  третий параметр `animate`) и forced-cancellation danger confirm
  (`_dangerConfirmAnimateExit`). Отдельно — побочно найденный и исправленный
  баг `_releaseWarmRefit` (рассинхрон камеры после реального resize стенда):
  прочитан код, сверен с `docs/WARM-REMOUNT.md` (обновлён) и зарегистрированным
  мутантом `warm-remount-blesses-mismatched-camera-976`; не продуктовая
  геометрия плана, а исправление камеры/viewBox, вне запрета ТЗ «не менять
  геометрию плана/лучей». Задокументировано в хендоффе и найдено ненамеренно в
  процессе починки существующего смока `smoke_wall_node_topology.mjs`, не
  входившего в исходный план автотестов ТЗ — принято как добросовестно
  закрытая побочная регрессия, не расширение скоупа.
- i18n: `confirm.erase_decor`, `decor.erase`, `decor.erase_confirm_title`
  (en/fr/ru) и `gs.palette_shared` (en/de/fr/ru settings) — сверены построчно,
  `de.json` для decor-ключей не тронут намеренно (там уже было «löschen» до
  диффа — проверено `git show origin/dev:src/i18n/de.json`). `gs.preview_selected`
  удалён из всех 4 settings-локалей и из `sun-settings-view.ts`/
  `general-settings-dialog.ts` одновременно — остаточных ссылок нет (grep).
- `docs/release-ledger/v1.81.0/976.json`: `line-fix`, `introducedBy:931` —
  согласуется с тем, что #931 — предыдущая бета-фича текущего цикла редизайна
  настроек (подтверждено по `docs/CHANGELOG.md`); #976 — завершение того же
  цикла, не отдельная маркетируемая фича. Авторское суждение принято.
- Числа бандла: `scripts/bundle-budget.mjs`
  (`INITIAL_VIEW_GZIP_CEILING=332_018`, `LAZY_EDITOR_GZIP_CEILING=320_340`) и
  `scripts/monolith-baseline.json` (`bundleBytes=3285837`) сверены с
  нарративом `docs/DEVELOPMENT.md` и комментариями хендоффа. Заявленные в
  последнем комментарии «фактические» числа после ребейза на #978
  (333686/322212/3285863 B) на ~3–26 Б отличаются от зафиксированных в файлах
  констант/бейзлайна — это в пределах полосы допуска (`BUNDLE_BYTES_BAND=2000`,
  `LAZY_GRAPH_CEILING_BAND=2000`) и не влияет на гейт; не находка.
- Трейлеры: все 16 коммитов — `Issue: #976`; единственный коммит с правкой
  `demo/golden/baselines/*.png` (`22dab0d4d`) несёт `Release:` и
  `Baseline-Reviewed:` одновременно — соответствует §10.1.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — широкий
  прямой охват (186 смоков, ожидаемо для правки общего `_renderRoot`/
  `render()`) плюс 6 зарегистрированных связей, включая новый
  `smoke_ui_polish_976.mjs` ↔ все новые lifecycle-файлы. Полная матрица уже
  прогнана и зелёная на этом SHA (ссылка выше), повторный прогон не требовался.

## Находки

Находок уровня High или Medium не обнаружено.

## Что проверено и корректно

- Защитные AC (AC4, AC5, AC9, AC10) имеют зарегистрированных свидетелей с
  понятным «чем краснеет»; состав таблицы хендоффа (двухколоночный — «что
  проверено» / «свидетель с указанием мутанта или негативного кейса») по
  существу покрывает требование «AC · доказано · краснеет», пустых мест нет.
- Общий lifecycle диалогов (`dialog-presence`/`dialog-exit`/`dialog-return-focus`)
  корректно разделяет запрос закрытия и терминал: permission/forced-context
  cancellation обходит анимацию (`animate=false`), reduced-motion даёт
  `deadline=0`, повторный `beginExit()` идемпотентен, `cancelExit()` снимает
  `inert`/popover корректно при реконнекте/дисконнекте директивы.
  `prepareDialogReturnFocus` ограничен реальной кнопкой-opener и снимается по
  следующему `keydown`/`pointerdown`/`blur`, не глобальным подавлением фокуса.
- `footer Cancel` в General/Space теперь ищет `hp-dialog` через
  `closest('hp-dialog')`, а не полагается на `event.currentTarget` как на сам
  диалог (исправление сопутствующего бага, задокументировано в хендоффе).
- i18n по всем изменённым ключам синхронен во всех поддерживаемых локалях;
  `docs/USER-GUIDE.ru.md`/`.md`, `DECOR-EDITOR.md`, `UX-MODES.md`,
  `PDF-EXPORT.md`, `WARM-REMOUNT.md`, `ARCHITECTURE.md`, `STATUS.md` обновлены
  по контракту, терминология («Удалить», корзина вместо ластика) согласована
  с ТЗ и USER-GUIDE.
- `smoke_ui_polish_976.mjs` (новый, 123 строки) и `demo/ui-lab/verify-polish.mjs`
  (новый, 385 строк, authentic-HA) реально проверяют AC1–AC12 через публичные
  действия и computed paint, а не regex по исходникам; существующие смоки
  переведены на `__hpTest.settled()`, учитывающий новый `inert`-терминал — не
  ослабление оракулов, а их синхронизация с новым жизненным циклом (проверено
  построчно в `demo/helpers/hp-test.mjs` и по смокам, использующим `settled()`).
- Контракты-по-монолиту (`test/hp-dialog-contract.test.mjs`,
  `test/optional-space-model-contract.test.mjs`) обновлены вслед за кодом, без
  добавления новых имён в список читающих монолит regex-тестов.
- Risk-by-changed-hunks: все три класса (geometry/touch/perf) покрыты AC ТЗ
  (таблица выше).

## Чего не проверял

- Автотесты/typecheck/build/bundle-policy не перегонялись — зелёный Validate
  на точном SHA материала уже подтверждён ссылкой в задаче (§8, #343).
- Мутанты (`warm-remount-blesses-mismatched-camera-976`,
  `dialog-invalidated-confirmation-retains-paint-976`,
  `dialog-exit-keeps-native-authority-976`, `inbox-menu-forgets-footer-976`,
  `dialog-exit-stale-completion-976`, `dialog-exit-never-bounded-976`,
  `toolbar-dismiss-swallows-intent-976`, `dialog-return-focus-ring-flashes-976`)
  не исполнялись — только статическая регистрация и разбор по коду/тестам
  (общая политика, ночной прогон отдельно).
- Полная предрелизная матрица (release/night coverage) — вне скоупа ревью,
  остаётся предрелизной обязанностью.
- Частный архив UI Lab и личный стенд 8890 не запрашивались и не
  просматривались (не публикуются по решению ТЗ, не требуется для AC).
- Ручная dev/GPU-приёмка владельцем — добровольна, не проверялась и не
  требуется (`docs/process/REVIEWER.md`, #929).
- Исчерпывающий аудит всех ~80 новых строк `settings-dialogs.styles.ts` на
  предмет остаточных неиспользуемых старых правил CSS в неизменённых файлах
  вне диффа (например, `space-settings-dialog.ts`, не входящий в правку) не
  проводился — ограничился прочтением файлов, которые диф явно коснулся.

## Маршрут

`fix` (трек ask).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/976-ui-polish`, коммит `48cd7b41046b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `919f49c055e9d2596cedf1e98bf7dd0211bc805a`
  ```
  git log --all --format='%H %T' | grep 919f49c055e9
  ```
- Тело issue: `fefbf496b6ec20f3c181dc4c9ab3529d4a5fe78204a5ca04ccd3b1bd09b48b0a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMzMsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTM4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjAsIm91dHB1dF90b2tlbnMiOjM1NjEyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjI1NDcwNywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEwNTk3OTAzLCJjb3N0VXNkRXN0aW1hdGUiOjMuNDk0NzY4NjAwMDAwMDAxM31dLCJ0dXJucyI6NjcsImR1cmF0aW9uTXMiOjQyNjM4NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuNDk5OTA2NjAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5153 output_tokens=35633 cache_creation_input_tokens=254707 cache_read_input_tokens=10597903 num_turns=67 -->
