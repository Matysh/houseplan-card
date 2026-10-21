# CODE-REVIEW-1007-r1

Issue: [#1007](https://github.com/Matysh/houseplan-card/issues/1007) — «Общий UI-кит диалогов: отступы, строки настроек, кнопки, подсказки и спойлеры».
Трек: `ask`. Этап: `code`. Заход: r1 (первый код-ревью этой задачи; бюджет этапа `code` — 0/4 потраченных циклов).
Материал: `a39e38f8d5a8a4b404e71faccb69e0dc3a0306f3` (ветка на нём же, рабочая копия соответствует).
Диапазон: `origin/dev..HEAD`, 10 коммитов.
Маршрут побочных находок: `mode=issues` (доверенный снимок политики). Побочных находок нет.

## Скоуп

ТЗ в теле issue (раздел `## ТЗ`), принято зелёным спек-ревью r2 (High 0/Medium 0,
`docs/reviews/SPEC-REVIEW-1007-r2.md`). Единственная находка r1 этого спека
(M1 — не названы реальные места дублирования `.device-inbox-tabs button` и
рендереры в `houseplan-editor-runtime.ts`) была закрыта в ревизии ТЗ перед r2;
в этом коде проверено, что реализация её действительно устраняет (ниже).

Изменённые участки по AC1–AC9: расширение `src/editors/form-kit.ts` явными
`formSections`/`actionHelp`/`disclosure`; новый общий слой
`src/styles/dialog-composition.styles.ts`; миграция четырёх форм настроек
(general/space/room/marker) и radar/vacuum секций; Zigbee ZHA/Z2M на общий
спойлер и общий генератор кнопок; устранение дублирующего
`.device-inbox-tabs button` в `src/styles/editor-dialogs.styles.ts`;
исправление реального дефекта `scripts/png-identical.mjs`
(`ImageBitmap.close()` перед чтением размеров — ложное равенство 0×0);
новая исполняемая галерея `demo/dialog-ui-kit.ts` +
`demo/smoke_dialog_ui_kit.mjs`; 6 новых мутантов в реестре (зарегистрированы,
не исполнялись); документация `docs/DIALOG-UI-KIT.md`,
`docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`; оба changelog; release-ledger
`docs/release-ledger/v1.82.0/1007.json`; принятие 5 golden-кадров.

**Риск по изменённым участкам (#707).**
perf: `src/styles/settings-dialogs.styles.ts:68` (удалена) · токен `filter:`.
Удалённая строка — `.hpf-settings-form button:not(:disabled):hover,.hpf-footer
button:not(:disabled):hover{filter:brightness(1.08);}`. Это точный дубликат
`filter:brightness(1.08)`, уже входящего в общий токен `settingsActionHover`
(`src/styles/settings-action.styles.ts:3`, не менялся) и применяемого тем же
листом двумя строками ниже через
`:is(.hpf-settings-form,...).btn:not(:disabled):is(:hover,:focus-visible...)`
(контекстная строка диффа, без изменений). Проверено чтением шаблонов всех
четырёх footer'ов (`general-settings-dialog.ts:299-316`,
`room-settings-dialog.ts:247`, `space-form.ts:163`,
`marker-dialog.ts:914`) — каждая кнопка footer несёт класс `.btn`, других
`<button>` без этого класса в данных корнях нет. Удаление — дедупликация
второго владельца одного и того же paint (AC5 «единственный владелец
hover»), а не потеря токена: поведение при наведении не меняется. Покрыто
`smoke_dialog_ui_kit.mjs` (`helpHoverDoesNotPaintTrigger` сравнивает
вычисленный `background`/`box-shadow` соседней кнопки до/после) и описано в
AC5 строке таблицы. Находка не открывается.

## Как проверялось

Дешёвые гейты подтверждены внешней ссылкой на этом точном SHA
([Validate 39685048667](https://github.com/Matysh/houseplan-card/actions/runs/39685048667),
success) — не перегонялись повторно по правилу «уже подтверждено». Локально
перепроверены адресные вещи, которые Validate не покрывает по умолчанию:

| Гейт | Статус | Как |
|---|---|---|
| `node scripts/mutation-gate.mjs --check-anchors` | PASS (static-readiness) | все 6 новых `-1007` id — `ok`; `execution=0` — мутанты не исполнялись (соответствует политике) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений | трейлеры `Issue:`/`User-Visible:` на каждом коммите класса A/B, `Release:`+`Baseline-Reviewed:` на коммите с baseline PNG |
| Чтение diff построчно (все 43 изменённых файла) | выполнено | см. находки/разделы ниже |
| Сверка golden-индекса | выполнено чтением | ровно 5 изменённых хэшей в `baselines-index.json` = ровно 5 изменённых PNG в diff; `ci.sha=49c3fb442`, `run=39681901012` совпадают с заявленным в handoff; `foreignCapture.reason` зафиксирован для Windows-приёмки Linux-кадров |
| Сверка release-ledger | выполнено чтением | схема и поля идентичны соседним `1005.json`/`1006.json`; классификация `stable-fix` обоснована (правит поведение, уже существовавшее в v1.82.0, без `introducedBy`, т.к. не line-fix) |
| Сверка changelog ↔ коммиты | выполнено | RU/EN правятся в одном коммите с `User-Visible: yes` на каждом из 5 таких коммитов; `User-Visible: no` коммиты changelog не трогают |
| Единственный источник числа (§8) | выполнено | `LAZY_EDITOR_GZIP_CEILING=325_007` назван один раз в `scripts/bundle-budget.mjs`, с тем же числом в `docs/DEVELOPMENT.md`; `Tests` в `docs/STATUS.md` — сгенерированная строка (`status-snapshot.mjs`), не ручная правка |

**Чего не проверял (явно, не гейт этого ревью):** `npx tsc --noEmit`, `npm test`,
`npm run build` + bundle-копии не перегонялись — зелёный Validate на этом SHA
уже их подтвердил. Полный `npm run smoke:full`/performance/HA-harness —
не требуются AC и не запускались (как и автором). Мутанты реестра не
исполнялись — это ночной/релизный гейт, не ревью. Личные снимки
`artifacts/dialog-ui-kit-1007/` не просматривались как сторонний UI Lab —
визуальная приёмка велась по **принятому golden** (канонический путь), а не
по этим артефактам.

## Разбор по AC

Таблица «AC · чем доказан · чем краснеет» в теле issue (и в
`docs/DIALOG-UI-KIT.md`) содержит все 9 строк, третий столбец не пуст ни в
одной — для защитных AC1–AC4/AC6/AC8 указаны либо зарегистрированные
свидетели (`*-1007`, явно «не исполнялись»), либо обычный исполненный
отрицательный ввод с результатом. Проверено построчно:

- **AC1** (общие примитивы, 4 формы, удалены дубли). `formSections`/`field`/
  `toggleRow`/`disclosure`/`actionHelp` определены в `form-kit.ts`; все
  четыре формы (`general-settings-dialog.ts`, `space-form.ts`,
  `room-settings-dialog.ts`, `marker-dialog.ts`) переведены, включая radar
  (`radar-section.ts`) и существующие поля vacuum
  (`vacuum-settings-section.ts`). Старые структурные исключения
  (`.hpf-body > * + *`, `.hpf-body > .hpf-sub + *`, `.hpf-profile-target > * +
  *`, `#gs-moon-status`, `.hpf-background-examples`, `.hpf-context-links` и
  др.) удалены из `settings-dialogs.styles.ts` одним куском — их функцию
  теперь несёт `.hpf-section:not([hidden]) ~ .hpf-section:not([hidden])` в
  `dialog-composition.styles.ts`. Таблица миграции в `DIALOG-UI-KIT.md`
  перечисляет все заявленные потребители (включая Zigbee, помощь, список
  устройств, правила иконок, печать, подтверждения). Проверено чтением, не
  исполнением для частей без прямого smoke (fieldGrid stacked-вариант в
  `space-form.ts`, онбординг оставлен нетронутым).
- **AC2** (устойчивость при скрытии/перестановке). `formSections` строит
  массив фиксированной длины и заполняет пропуски `nothing` по индексу
  (`form-kit.ts`), поэтому у Lit сохраняется child-part identity — скрытие
  не сдвигает соседей. `test/dialog-composition.test.mjs` проверяет это на
  уровне `formSectionEntries` (включая вложенные пустые массивы/`false`/
  `null`). `smoke_dialog_ui_kit.mjs` проверяет это в реальном DOM:
  `omittedSectionHasNoSeparator`, `siblingDraftSurvivesOmission`,
  `reorderedSectionsKeepRhythm`, `conditionalSectionRestored`. Два
  зарегистрированных witness (`marker-glow-fields-lose-section-composition-1007`,
  `room-font-controls-lose-section-composition-1007`) покрывают реальные
  формы (Glow-поля marker-dialog, два font-控троля room-dialog) — не
  исполнялись, что соответствует политике для дорогого Chromium-гейта.
- **AC3** (Help не активирует соседа). `hp-help.ts` `_triggerClick` теперь
  вызывает `preventDefault`/`stopPropagation` на каждом клике — независимо от
  того, в каком контейнере лежит триггер. `disclosure()` кладёт `help` как
  DOM-соседа `<details>` (`.hpf-disclosure-with-help`), а не потомком
  `<summary>` — ровно то, что чинит упомянутый в ТЗ vacuum-дефект
  (`vacuum-settings-section.ts`: раньше `hp-help` был внутри `<summary>`,
  теперь — через `disclosure({help:...})`). `smoke_dialog_ui_kit.mjs`
  проверяет `helpHoverDoesNotPaintTrigger` (сравнение вычисленного
  `background`/`box-shadow` соседа до/после), `helpClickDoesNotOpen`,
  `helpDoesNotToggle`, touch-вариант через `page.touchscreen.tap`.
  Зарегистрированный `dialog-kit-help-inside-disclosure-1007` — не
  исполнялся.
- **AC4** (единый спойлер ZHA/Z2M/диагностика). `hp-zigbee-topology-settings.ts`
  переведён на `disclosure`/`formSections`, дублирующий CSS кнопок заменён
  общим `settingsActionsCss('button')`; `.incomplete` получил класс
  `hpf-disclosure hpf-disclosure-compact` — вариант со status-типографикой
  документирован отдельно в `DIALOG-UI-KIT.md`. Существующий мутант
  `zigbee-incomplete-details-start-open-1005` обновлён под новый селектор
  (иначе бы перестал совпадать после рефакторинга) — проверено статической
  готовностью (`ok`). Диагностика пылесоса — `disclosure({className:
  'hpf-profile-diagnostics', ...})`.
- **AC5** (единые кнопки/плашки в помощи/печати/устройствах/правилах
  иконок/подтверждениях, без обрезанных hover-рамок/двойных контуров).
  Единственная реальная дыра дублирования, названная в теле issue —
  `.device-inbox-tabs button` в `editor-dialogs.styles.ts:754` (радиус
  999px) против `settings-dialogs.styles.ts:212` (радиус 7px) — устранена:
  старое определение полностью удалено из `editor-dialogs.styles.ts`,
  единственное определение в `settings-dialogs.styles.ts` обновлено на
  токены `--hpf-action-radius`. Проверено, что активная вкладка
  (`class="on"` + `aria-selected="true"`, оба выставляются одним условием в
  `houseplan-editor-runtime.ts:11088-11091`, сам рендерер не менялся) не
  теряет визуальное выделение: правило `[aria-selected=true]` в
  `settings-dialogs.styles.ts` не изменилось и покрывает то же состояние —
  удаление правила `.on` в `editor-dialogs.styles.ts` не регрессия.
  `_renderSupportDialog`/`_renderRulesDialog` (не менялись) уже вызывают
  `ensureSettingsDialogStyles`/несут `settings-layout`, поэтому получают
  единый лист без переноса бизнес-логики — ровно то, что требовала ревизия
  ТЗ после M1.
- **AC6** (визуальное соответствие). Golden: ровно 5 изменённых сцен в
  `baselines-index.json` соответствуют ровно 5 изменённым PNG в diff
  (`device-state-source-{unknown-en,protected-ru}`,
  `room-{temperature,discard}-dialog-mobile-ru`,
  `general-color-popover-desktop-en`); `ci.sha=49c3fb442`,
  `run=39681901012`, `acceptedOn=win32` с явным `foreignCapture.reason`
  («Linux-прогон, приёмка на Windows») — соответствует политике для
  Windows-приёмки Linux-кадров. `floor:10`, `witnesses.count:187` — не ниже
  порога. Независимый повторный golden и CI product на точном
  `a39e38f8d` зелёные (ссылки в handoff). PNG-компаратор, которым ранее была
  сделана ошибочная запись о 10 нулевых diff (отозвана автором отдельным
  комментарием), исправлен и подтверждён тремя способами: реальными
  black/white 1×1 и 1×1/2×1 negative controls в `smoke_capture_stability`,
  независимым Pillow (со слов автора, не перепроверялось мной отдельно) и
  тем, что `smoke_capture_stability` теперь содержит этот PNG-пробник
  постоянно (не разовая проверка).
- **AC7** (темы/viewport). Галерея покрывает 1280/390/320 × light/dark/custom
  (`smoke_dialog_ui_kit.mjs`); `_fit`-проверка подтверждает отсутствие
  горизонтального скролла/переполнения на каждой комбинации.
  `smoke_settings_polish_radar_vacuum_955`/`smoke_settings_polish_955`
  --geometry прогоняются на реальных формах (заявлено PASS в handoff,
  унаследовано — не гейт этого ревью, cм. выше).
- **AC8** (сохранение/отмена/Escape). Не затронутый этим диффом путь:
  `dialog-presence.ts`/`dialog-exit.ts`/`hp-dialog.ts` (overlay-реестр и
  `_onKeyDown`/Escape) не изменились — подтверждено `git diff --stat`.
  Единственное место, где `<details>` используется как «picker» внутри
  диалога (vacuum `vacpicker`), не было и не стало зарегистрированным
  overlay (`hp-dialog._overlays`) — Escape для него и раньше, и теперь не
  обрабатывается через overlay-реестр; это нативное поведение `<details>`/
  `<summary>` (Enter/Space), не затронутое задачей. `openPicker()` в
  `vacuum-settings-section.ts` обновлён на поиск по `id` (новый
  `id="vacpicker-${dev.id}"` от `disclosure()`) вместо снятого
  `data-dev-id` — проверено, что `data-dev-id`/`data-devId` нигде в
  src/demo/test больше не ожидается (grep пуст).
- **AC9** (View/lazy/бюджет). `dialogCompositionCss` подключается только
  через `FORM_KIT_CSS` в `form-kit.ts` (ленивый редакторский граф,
  неизменный механизм `adopted`/`WeakSet` с #594 AC8) — не импортируется в
  `cardStyles`/View/onboarding. `LAZY_EDITOR_GZIP_CEILING` поднят с 322_435
  до 325_007 с комментарием-обоснованием в самом файле и зеркальным абзацем
  в `DEVELOPMENT.md`; полоса 2000 B и View/furniture/onboarding потолки не
  тронуты.

## Что проверено и корректно (сверх AC-таблицы)

- Трейлеры: все 7 некоммитов класса A/B несут `Issue: #1007` и
  `User-Visible:`; 5 коммитов с `yes` правят оба changelog в том же
  коммите; коммит с baseline PNG несёт `Release:` + `Baseline-Reviewed:`
  (ссылка на реальный зелёный run).
- Один источник числа: `325_007` называется один раз в коде
  (`bundle-budget.mjs`) и зеркалируется прозой в `DEVELOPMENT.md` — не
  второй независимый источник.
- `scripts/ci-registry-inventory.json`/`scripts/smoke-links.mjs` обновлены
  под новые файлы/тест — иначе `smoke-select`/инвентарный тест упали бы.
- Старые CSS-исключения, названные в «Проблеме» issue (vacuum
  summary/Help, Zigbee дублирующие стили кнопок, device-inbox tabs), все
  устранены предметно, не просто переименованы.
- Release-ledger `stable-fix` обоснован корректно (поведение существовало в
  v1.82.0, не `line-fix`, `introducedBy` не требуется).

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне его (побочных находок нет,
`mode=issues` не требует нового issue).

Низкоприоритетное наблюдение (правлю сам, цикла не открывает, §3 п.8):
двойной вызов `ensureSettingsDialogStyles(this)` в
`hp-zigbee-topology-settings.ts` — один раз в начале `render()`, второй раз
внутри `_renderEmbedded()`, если `this.embedded`. Идемпотентно
(`WeakSet`-ранний выход в `ensureSettingsDialogStyles`), поведенчески и
по производительности не значимо — лишний `WeakSet.has()` за рендер.
Не меняю код ревьюером (запрещено правкой issue), фиксирую как Low без
дальнейших действий.

## Вердикт

Зелёный. AC1–AC9 выполнены и доказаны (автотестом с умеющим падать
свидетелем либо чтением без исполнения, с явной пометкой); трейлеры,
changelog, release-ledger и golden-приёмка корректны; единственный
отмеченный риск (perf/filter) разобран и закрыт чтением кода и
существующим smoke-свидетелем.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1007-dialog-ui-kit`, коммит `a39e38f8d5a8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0aab96f687de26a56a3e0ac2e92506d732c50625`
  ```
  git log --all --format='%H %T' | grep 0aab96f687de
  ```
- Тело issue: `5fd145cb6f54bbd1082de4792997b92e56a73d61e404fe9673276be0df5a79a5`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NjksIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTc0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNTAsIm91dHB1dF90b2tlbnMiOjM3MzM4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE5NTQ1MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk1MzIzODgsImNvc3RVc2RFc3RpbWF0ZSI6My4wNjE5NTc2MDAwMDAwMDA0fV0sInR1cm5zIjo4MSwiZHVyYXRpb25NcyI6NDUwNDM5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4wNjY5MzE2MDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5019 output_tokens=37359 cache_creation_input_tokens=195450 cache_read_input_tokens=9532388 num_turns=81 -->
