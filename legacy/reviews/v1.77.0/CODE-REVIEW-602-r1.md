# CODE-REVIEW-602-r1

Issue: #602 · Этап: code · Заход: r1 · блокирующих циклов израсходовано 0 из 4
Материал: `c69d73f1f26b3277fde938a4eb08195c561e46ba` (issue/602-dialog-polish), рабочая копия ревью — на этом SHA, без отклонений (`git status` чист на всём протяжении разбора).

## Скоуп

ТЗ (принято владельцем на этапе spec, зелёный вердикт r2) устраняет визуальные
дефекты общего form-kit после редизайна #591/#600/#601 в четырёх диалогах
(Space, General settings, Room settings, Device) плюс общий confirm-dialog:
подписи-дубли, центрирование тумблера, обрезание числовых полей, выравнивание
подписей шкалы, однострочные футеры, порядок climate-настройки и замена
кнопки объявления радара на inline-тумблер с сохранением черновика между
Off/On в рамках сессии.

Диапазон разбора — `git diff origin/dev...HEAD` (82 файла: `src/**`,
`demo/smoke_*`, `test/**`, локали, `docs/**`, `dist/**` и зеркала бандла).
Полный код-ревью, поскольку это первый заход по задаче.

## Как проверялось

| Гейт | Статус | Как проверено |
|---|---|---|
| `typecheck` / `npm test` / `npm run build` + сверка 3 копий бандла | зелёный, не перегонял | Validate на точном материале `c69d73f1` — [прогон 35535791268](https://github.com/Matysh/houseplan-card/actions/runs/35535791268), `conclusion: success`, `headSha` совпадает. Подтверждено запросом `gh run view`. Мутанты по диффу (6/6 шардов) там же зелёные. |
| `node scripts/check-docs.mjs --strict` | зелёный, перегонял сам | `node scripts/check-docs.mjs --strict` → «Documentation checks passed (7 files, 12 external links)». Отпечаток `src/**` актуален после `npm run bundle:sync` на чистом дереве. |
| `npm run bundle:sync` (пересборка для последующих шагов) | выполнялся трижды (перед смоками, после каждой мутации) | `git status --short` пуст после каждого прогона — рабочее дерево не отклонилось от `c69d73f1`. |
| Смоки — 7 файлов, изменённых в этом диффе (`smoke_device_settings_form`, `smoke_space_settings_form`, `smoke_dialog_footer_width`, `smoke_radar_setup`, `smoke_climate_temp`, `smoke_general_settings_form`, `smoke_room_settings_form`) | зелёные, перегонял сам | Каждый запущен `node demo/smoke_<name>.mjs`, все напечатали `OK` без `FAILED`. `scripts/smoke-select.mjs --base origin/dev --head HEAD` вернул одно **прямое совпадение** (`smoke_radar_setup.mjs` ← `_markerDialog, isActive`, уже в списке выше) и 39 «слабых связей» по одному распространённому имени `_markerDialog` — по прочтении диффа это ожидаемо (символ есть почти в каждом смоке, трогающем диалог устройства), решил не гонять весь список: ни один из 39 не адресует изменённые CSS-контракты специфично. |
| Мутационная проверка «чем краснеет» для двух защитных AC | выполнил вручную (см. таблицу ниже) | См. раздел «Защитные AC». |
| `npm run golden:verify` | **красный**, перегонял сам | См. находку High/Medium ниже — 8 из 150 сцен `different`. |
| `npm run inventory`, `python -m pytest tests_backend` | не гонял | diff не трогает `custom_components/**/*.py`; нет причины запускать. |
| Performance-профили | не гонял | Не названы в AC, диффом не задеты чувствительные к перфу пути (ТЗ §13 подтверждает). |

## Находки

### Medium (в скоупе) — `golden:verify` красный на материале ревью, обновление golden-сцен из плана тестирования не сделано

ТЗ, план тестирования, п.4: «Обновить/добавить golden scenes минимум для
Space desktop/mobile, Device desktop/mobile с radar off/on, discard confirm
mobile…». AC15 прямо требует: «…`golden:verify` зелёные». Ни один файл под
`demo/golden/baselines/**` в диффе не изменился (`git diff
origin/dev...HEAD --stat -- demo/golden` — пусто).

Автор сам отметил риск в комментарии реализации r1: «`golden:verify` на
Windows выполнен диагностически и baseline не менял… канонический кандидат
должен снять Linux CI… Прошу проверить… Linux visual artifacts» — то есть
явно передал этот пункт на сторону код-ревью. Ревью выполняется на Linux, я
запустил канонический прогон сам:

```
npm run golden:verify
```

Результат — 8 из 150 сцен `different` (не `passed`): `device-dialog-desktop-en`,
`device-dialog-mobile-ru`, `device-dialog-desktop-de`, `device-help-popover-light-ru`,
`settings-help-zoom-200-en-light`, `settings-help-zoom-200-ru-dark`,
`device-ripple-color-popover-mobile-ru`, `space-room-color-popover-desktop-ru`.
По коду `demo/golden/policy.mjs:63` (`goldenRunFailed`) `mode==='verify'` и
любой статус `!== 'passed'` переводит `process.exitCode = 1` — гейт красный,
а не «прошёл с примечаниями».

Диф-артефакт `artifacts/golden/diff/device-dialog-desktop-en.png` показывает
ожидаемые различия: убранный текст «Unsaved changes» в футере, изменённая
раскладка поля/шкалы «Brightness», сдвиг блока «Glow radius» и всего, что
ниже — то есть разница закономерно объясняется именно этим диффом (CSS
`.hpf-range`, `.hpf-toggle`, `footerStatus`), а не посторонней регрессией.
Значит правки корректны по существу, но обещанный тестовый артефакт
(обновлённые/принятые baseline-кадры) отсутствует.

**Чем краснеет:** сам факт — `npm run golden:verify` красный на предъявленном
материале; это не гипотетическая мутация, а фактический прогон канонического
гейта, который AC15 требует зелёным. Артефакты прогона удалены после
проверки (`rm -rf artifacts/golden`), рабочее дерево осталось чистым на
`c69d73f1`.

**Что нужно:** принять новые кадры через `npm run golden:accept --
--reviewed` (плюс `scripts/golden-accept.mjs --expect-change=<8 id>`) на
канонической Linux-сборке этого материала, с коммитом, несущим `Release:` и
`Baseline-Reviewed:` (путь уже отработан на этой же ветке коммитом
`c69d73f1` для отдельного, независимого от `demo/golden/baselines`
docs-скриншотного механизма — `check-docs.mjs`/`docs/images/**`, который сам
по себе закрыт корректно и трейлеров не требовал, поскольку не трогает
`demo/golden/baselines/**`; это подтверждено чтением
`scripts/validate-commit-provenance.mjs:64-77`, где триггер — только
`demo/golden/baselines/*.{png,json}`).

**Серьёзность:** Medium, в скоупе задачи (сам ТЗ называет это условием
приёмки AC15 и явно перечисляет затронутые сцены в плане тестирования) —
без High это жёлтый вердикт, фикс проходит следующий цикл в этом же issue
(#202).

## Проверено и корректно

- **AC1/AC8 (лишние подписи и заголовок убраны).** `space.title_hint`,
  `space.scale_hint`, `marker.name_hint`, заголовок «Tap action» удалены из
  разметки и всех 4 locale-файлов `i18n/settings/*.json` синхронно (RU/EN/DE/FR);
  `marker.card_tap` синхронно вычищен из `i18n/{ru,en,de,fr}.json`. Подтверждено
  смоками `redundantBasicsHintsRemoved`, `nameFieldWithoutRedundantHint`,
  `tapActionCardHasNoLargeHeading` — все зелёные при собственном прогоне.
- **AC2 (центрирование тумблера).** `top: 50%; transform: translateY(-50%)` в
  `form-kit.styles.ts`; смок `switchPartsAreGeometricallyCentered` сравнивает
  computed `::before`/`::after` с серединой контрола (допуск 0.6px). **Чем
  краснеет:** вручную вернул `top: 14px`, пересобрал (`npm run bundle:sync`),
  прогнал `smoke_space_settings_form.mjs` — упал именно на этом поле
  (`switchPartsAreGeometricallyCentered: expected true, got false`), затем
  восстановил файл и пересобрал; `git status` после — чист.
- **AC3/AC5 (числовые поля не обрезаются/не перекрывают слайдер).** Ширина
  `.hpf-unit` для прозрачности увеличена до `4.8em`, `.hpf-range` переведён на
  grid с фиксированной колонкой значения (`--hpf-range-value-width: 84px`).
  Смоки проверяют реальные `getBoundingClientRect()`: `opacity100FitsTheNumberField`,
  `sizeAndAngleFieldsDoNotCoverSliders` (slider.right < unit.left, no
  overflow) — зелёные.
- **AC4 (подписи шкалы совпадают с концами трека).** `rangeEnds()` теперь
  оборачивает подписи в `.hpf-range-ends-track`, выровненный `grid-column: 1`
  с тем же `84px` резервом под значение, что и сам слайдер — единый источник
  ширины вместо независимого `padding-right: 122px`. Смок
  `fontScaleEndsMatchTheSlider` сверяет пиксельные левый/правый края трека и
  подписей (допуск 1px) — зелёный.
- **AC6/AC7/AC14 (однострочные футеры, mobile icon-only, confirm в одну
  строку, 320/360/560).** `dialogsStyles`: `.hpf-footer-space` — CSS grid
  (`auto auto minmax(0,1fr) auto`) с явными позициями `dialog-action-copy`/
  `dialog-action-danger`/`dialog-action-commit`; на ≤480px колонки сжимаются
  до `44px 44px minmax(0,1fr) auto`, `.hpf-mobile-icon` прячет текстовую метку
  и оставляет `aria-label`+`title`. `.danger-confirm-footer` получил тот же
  `nowrap`/grid-на-двух-кнопках паттерн. Смоки `smoke_dialog_footer_width.mjs`
  (`oneRow`, `iconOnlyDestructive`, ширины 320/360/560, RU/DE) и
  `smoke_space_settings_form.mjs` (`discardActionsShareOneRow`) — зелёные при
  собственном прогоне.
- **AC9 (climate-toggle после Additional actions).** Блок `toggleRow` для
  `useClimateTemp` физически перенесён в `marker-dialog.ts` под
  `_renderRadarSection(..., 'additional')` внутри карточки Details. Смок
  `climateToggleFollowsAdditionalActions` сравнивает
  `Node.DOCUMENT_POSITION_FOLLOWING` относительно заголовка «Additional
  actions» — зелёный. Значение/dirty-detection/сохранение `useClimateTemp` не
  тронуты (тот же биндинг `d.useClimateTemp`).
- **AC10 (нейтральный `dialog.unsaved` убран).** Убран из всех четырёх
  `footerStatus(...)` вызовов (`space-form.ts`, `general-settings-dialog.ts`,
  `room-settings-dialog.ts`, `marker-dialog.ts`) и из всех 4 locale JSON.
  `dialog.review_fields` (ошибки полей) и dirty-controlled `Save` не
  тронуты — смоки `saveEnabledWhenDirtyWithoutDuplicateStatus` (4 файла)
  зелёные.
- **AC11–AC13 (радар: единая секция-тумблер, восстановление черновика,
  virtual/saved-unsupported).** `renderRadarSection` теперь всегда рендерит
  один `toggleRow` в `.radaradditional` внутри Details; конфигурация
  раскрывается `:scope > .radargroup` строго под тумблером, вторая секция в
  «Основных параметрах» отсутствует (проверено смоками
  `radarEntryIsAToggleInAdditionalActions`, `noAutomaticSection`). Ключевое
  изменение поведения — `remove()` теперь сохраняет `radar: d.radar` вместо
  `radar: null`, так что Off не теряет черновик. **Чем краснеет:** вручную
  вернул `radar: null` в `remove()`, пересобрал, прогнал оба смока:
  `smoke_device_settings_form.mjs` упал на `radarOffKeepsSessionDraft` и
  `radarOnRestoresSessionDraft`; `smoke_radar_setup.mjs` упал на
  `savedOffKeepsOriginal`/`savedOnRestoresOriginal`; восстановил файл,
  пересобрал, `git status` — чист. `savedUnsupported`/`virtual` ветки кода
  структурно не тронуты (тот же `if (savedUnsupported || ...)`), только
  обёрнуты в общий `.radaradditional` div с тем же тумблером сверху —
  подтверждено смоком `virtualHasNoEntry`.
- **AC16 (release artifacts).** `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md`
  правлены в том же коммите `746147d0` (`User-Visible: yes`), формулировки не
  содержат внутренних CSS-классов/имён state-полей/номеров golden-сцен —
  прочитано текстом, ссылка на #602 есть в обеих версиях. `docs/USER-GUIDE.md`
  и `.ru.md` синхронно обновлены по описанным разделам (Basics/Tap
  action/Details/Presence radars) — терминология («Additional actions»,
  «This is a presence radar», «Review N fields») совпадает с уже
  используемой в остальном руководстве, не изобретена заново.
- **Трейлеры.** `746147d0`: `Issue: #602`, `User-Visible: yes` — оба
  changelog в этом же коммите (проверено `git show --stat`). `c69d73f1`:
  `Issue: #602`, `User-Visible: no`, плюс `Release:`/`Baseline-Reviewed:` —
  эти два трейлера не были обязательны для этого конкретного коммита (он не
  трогает `demo/golden/baselines/**`, только `docs/images/**`, а
  `scripts/validate-commit-provenance.mjs:64` триггерит их только на первый
  путь), но лишние трейлеры не нарушают провенанс и отражают реальный
  Linux-прогон 35534819172.

## Отдельно проверенный риск, оказавшийся не дефектом

Заподозрил, что новая формула `active = !!d.radar && !d.radarRemove`
(`radar-section.ts:88`) включает тумблер «Это радар присутствия» сразу при
открытии диалога не только для уже **сохранённого** радара (что явно
разрешено §6.6 ТЗ), но и для любого **распознанного, но никогда не
сохранённого** устройства (LD2450-профиль) — поскольку `radarDraft()`
(`radar-editor.ts:154-165`) возвращает ненулевой драфт уже при
`recognition.eligible === true`, независимо от наличия `.original`, а
`_openMarkerDialog` (`houseplan-editor-runtime.ts:7586`) вызывает эту функцию
безусловно при каждом открытии.

Проверил исполнением: поднял демо-стенд (`npm run bundle:sync` +
`demo/serve.mjs`), сконструировал синтетическое устройство с моделью
`HLK-LD2450` и entity-парой `..._target_1_x/_y`, зарегистрированным вне
HA-registry (чтобы `recognizeRadar` не подобрала настоящую модель из
реестра), открыл `_openMarkerDialog`. Результат: `radarEligible: true`,
`radar.enabled: false`, `radarRemove: false`, тумблер `checked: true`, форма
раскрыта — то есть подозрение подтвердилось техническим фактом.

Но дальше проверил, было ли это поведением, привнесённым этим диффом:
`_openMarkerDialog` и `radarDraft()` **не входят в диапазон
`git diff origin/dev...HEAD`** — они не менялись. Прочитал версию
`radar-section.ts` на `origin/dev` (`git show origin/dev:...`): условие
`if (!d.radar || d.radarRemove) { if (recognition.eligible) {…fieldset
'Настроить'…} return html''; } const radar = d.radar; …полная форма…` при
уже ненулевом `d.radar` (тот же факт, та же функция) точно так же пропускало
ветку «detected, click Настроить» и сразу показывало полную форму — то есть
поведение «распознанный радар раскрывается сразу» уже существовало в `dev`
до #602, просто было завёрнуто во внутренний чекбокс `radar.enabled` вместо
внешнего именованного тумблера. Формулировка §6.6 «для нового/ещё не
настроенного радара повторное включение… возвращает draft» описывает цикл
Off→On внутри сессии, а не начальное состояние впервые открытого диалога, и
не противоречит найденному факту. И `docs/USER-GUIDE.md`/`.ru.md` (раздел
«Presence radars»), поставленные этим же диффом, прямым текстом описывают
именно это как задуманное поведение: «For a recognized presence radar,
Additional actions contains the **enabled** This is a presence radar
switch…» — не гипотеза, а согласованный текст руководства. Вывод: не
регрессия и не находка, а унаследованное и теперь корректно
задокументированное поведение; фиксирую как проверенный и закрытый риск.

## Чего не проверял

- **`npm test`/`npm run typecheck`/`npm run build` — не перегонял сам**,
  положился на зелёный Validate на точном SHA `c69d73f1` (см. таблицу).
  Дешёвые гейты §10.2/§2.10 разрешают это при неизменном материале.
- **Полная матрица `demo/smoke_*.mjs` (258 файлов)** — не гонял. Инструмент
  выбора дал одно прямое совпадение (прогнано) и 39 слабых связей по общему
  имени `_markerDialog`; полный прогон — предрелизная обязанность (§8), не
  ревью.
- **`python -m pytest tests_backend`** — не гонял, diff не касается
  `custom_components/**/*.py`.
- **`npm run invariants`** — не гонял: diff не трогает геометрию комнат/стен,
  `layout`, `marker.space` или `open_spans`.
- **Performance-профили** — не гонял, не названы в AC и не задеты диффом
  (ТЗ §13 подтверждает отсутствие новых циклов рендера/таймеров).
- **Полный `npm run golden:verify` c последующим `accept`** — гейт я
  выполнил (см. находку), но фактическое принятие новых baseline-кадров —
  действие автора, не ревьюера (роль «ревьюер не правит материал»).
- **Ручная проверка в браузере HA** — не проводилась (среды HA нет);
  доказательство — DOM/computed-style смоки плюс golden-диф-изображение,
  прочитанное визуально.

## Материал раунда

- SHA ветки: `c69d73f1f26b3277fde938a4eb08195c561e46ba` (`issue/602-dialog-polish`)
- Дерево материала: идентично рабочей копии на момент вывода вердикта
  (`git status --short` пуст непосредственно перед выводом).
- ТЗ: тело issue #602, зелёный вердикт спецификации r2
  (`Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/602-dialog-polish`, коммит `c69d73f1f26b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ce2edc2506f2f52730a2fa576341f7eabf2dfccf`
  ```
  git log --all --format='%H %T' | grep ce2edc2506f2
  ```
- Тело issue: `8f8081ec29db1c104189682530643bde421d91127170b2c635107c595950a5a9`
- Вердикт конвейера: `yellow` · High 0
