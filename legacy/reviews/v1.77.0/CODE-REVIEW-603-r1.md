# CODE-REVIEW-603-r1

**Issue:** [#603](https://github.com/Matysh/houseplan-card/issues/603) — «Полировка редизайна диалогов, часть 2: confirm, переключатель, комната»
**Этап:** код-ревью (PROCESS.md §2.7), полный трек
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4
**Материал:** `ee3d78052aa1185f6e3d8a47ea710116da08f4a6` (рабочая копия на нём; `git fetch/checkout` не выполнялись)
**Ревьюер:** независимая сессия, без контекста реализации

## Скоуп

Три коммита на `origin/dev..HEAD`:

- `0a3e0674` `fix(dialogs): finish discard, switch and room polish (#603)` — продуктовый код (класс A: `src/editors/room-settings-dialog.ts`, `src/styles/form-kit.styles.ts`, `src/i18n/**`) + тесты/фикстуры/гейты (класс B) + документация (класс C) в одном коммите, `Issue: #603 · User-Visible: yes`, оба changelog правлены.
- `81355425` `chore(docs): accept updated dialog screenshots (#603)` — класс D (`docs/images/**`, `docs/images/screenshots.json`), `User-Visible: no`, `Baseline-Reviewed:` на реальный зелёный прогон.
- `ee3d7805` `chore(golden): accept dialog polish frames (#603)` — класс D (`demo/golden/baselines/**`), `User-Visible: no`, `Release: v1.77.0-beta.4` + `Baseline-Reviewed:` на реальный прогон.

Правит ровно три заявленных дефекта из ТЗ: обрезку кнопок discard-confirm (AC1/AC2), смещённый шарик form-kit toggle (AC3/AC4), лишний `h3` «Основное» в карточке Room (AC5). Диапазон файлов совпадает с разделом ТЗ «Модули и артефакты»: `form-kit.styles.ts`, `room-settings-dialog.ts`, 4×2 i18n-файла (`i18n/settings/*` + `i18n/*`); `dialogs.styles.ts` не тронут — решение подтверждено ниже.

## Как проверялось

Прочитаны и сопоставлены с диффом: `docs/SCOPE.md` (J4/J6), `AGENTS.md`, `PROCESS.md` §1–§10, тело issue #603 (`## ТЗ`, AC1–AC6, риски/допущения), все комментарии (аналитика → зелёное ревью ТЗ r1 → хендофф разработчика), `docs/USER-GUIDE.ru.md`/`.md` (диалог комнаты, toolbar Undo/Redo). Продуктовый код: `src/editors/room-settings-dialog.ts`, `src/editors/form-kit.ts` (`formCard`), `src/styles/form-kit.styles.ts`, `src/danger-confirm.ts`, `src/hp-confirm.ts`, `src/styles/dialogs.styles.ts` (`.danger-confirm-footer`), все 4 потребителя `dialog.discard_*` (`marker-dialog.ts`, `space-form.ts`, `room-settings-dialog.ts`, `general-settings-dialog.ts`), i18n-файлы всех 4 языков.

### Гейты

| Гейт | Команда | Результат |
|---|---|---|
| Validate на точном SHA | CI run [35567063107](https://github.com/Matysh/houseplan-card/actions/runs/35567063107) на `ee3d7805` | **success** (проверено `gh run view` — headSha совпадает) — покрывает typecheck/unit/build/bundle-sync/budget/smoke/golden/perf/geometry/backend |
| typecheck + build | `npm run bundle:sync` (сама вызывает `tsc --noEmit && rollup -c`) | зелёный, дополнительно синхронизировал `demo/srv/assets` для локальных смоков |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (1 добавленная строка в 1 файле) |
| `check-docs` (обязателен — diff трогает `src/**`) | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 12 external links)» |
| выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **НЕОПРЕДЕЛЁННОСТЬ** — правка внутри тела функций, символы на изменённых строках не задеты; решение по смокам — ниже |
| `npm test` / `npx tsc --noEmit` отдельно | — | не перегонял отдельно: покрыты зелёным Validate на этом SHA (#343) |
| `golden:capture`/`verify` полным набором | — | не перегонял: baseline уже принят `golden:accept -- --reviewed` по прогону [35566453055](https://github.com/Matysh/houseplan-card/actions/runs/35566453055) (проверил `gh run view`: golden-job закономерно **failure** — 3 отличающихся кадра на кандидате, остальные джобы, включая все шарды смоков, зелёные; screenshots-run [35566543872](https://github.com/Matysh/houseplan-card/actions/runs/35566543872) — success) |
| `pytest tests_backend` | — | не запускал: диф не трогает `custom_components/**/*.py` |
| `model-invariants` | — | не запускал: диф не трогает геометрию/ссылки на неё |
| perf-профили | — | не запускал: диф не трогает `src/iso-*`/`src/live-*`/`src/render-*`/lifecycle |

**Браузерные смоки, прогнанные лично** (после `npm run bundle:sync`, чтобы бандл демо-стенда был свежим):

| Смок | Причина выбора | Результат |
|---|---|---|
| `demo/smoke_dialog_polish_603.mjs` | новый, целевой для #603; `smoke-links.mjs` регистрирует связь `formKitCss`/`renderRoomSettingsDialog` → этот файл | **64/64** комбинаций (`ru/en/de/fr` × `light/dark` × `dpr 1/2` × `320/360/560/640`) — `OK` |
| `demo/smoke_room_settings_form.mjs` | напрямую задет `room-settings-dialog.ts` (AC5) + добавлены проверки `basicsHasNoHeadingButKeepsFields`/`discardLabelsAreShort` | зелёный, все поля `true` |
| `demo/smoke_room_settings.mjs` | обновлён список ожидаемых заголовков карточек (без `group_basics`) | зелёный |
| `demo/smoke_danger_confirmation.mjs` | напрямую задет общий `hp-confirm`/`danger-confirm.ts`, включая безопасный фокус/Escape/scrim на всех потребителях | зелёный, включая `germanNarrowFits`/`frenchNarrowFits` |
| `demo/smoke_space_settings_form.mjs` | **прогнал сам, не упомянут автором** — второй прямой потребитель `dialog.discard_*`; уже содержит `discardActionsShareOneRow` (одна строка, `scrollWidth<=clientWidth`) — прямая проверка AC2 на форме, которую целевой смок #603 не касается | зелёный |
| `demo/smoke_device_settings_form.mjs` | тот же довод, третий потребитель (marker-dialog) | зелёный |
| `demo/smoke_general_settings_form.mjs` | тот же довод, четвёртый потребитель | зелёный |

Причина, по которой три последних смока не были в отчёте автора, но были прогнаны мной: `dialog.discard_keep/confirm` и CSS `.hpf-toggle`/`.danger-confirm-footer` — общий код для 4 форм (`marker-dialog`, `space-form`, `room-settings-dialog`, `general-settings-dialog`), а автор явно тестировал геометрию только через Room-диалог. Риск того, что общий фикс по-другому ведёт себя в оставшихся трёх формах, не нулевой, а гейт дешёвый (секунды на смок) — прогнал лично, регрессий не нашёл.

`golden`/`performance_smoke`/`pytest`/`geometry_parity` не перегонялись мной отдельно, так как (а) уже покрыты зелёным Validate на точном SHA, (б) golden дополнительно подтверждён отдельным принятым прогоном с трейлерами, (в) диф не задевает Python/геометрию/perf-чувствительные пути.

## Находки

**High: 0 · Medium: 0 · Low: 0.**

Рассмотрел и решил не заводить находку по одному пункту: комментарий разработчика («В рисках отдельно учитываю, что «Отменить» здесь означает отбросить черновик, а не Undo истории редактора») не был перенесён строкой в текст ТЗ, как рекомендовал `SPEC-REVIEW-603-r1` (Low-1, **снятый с записью, не блокирующий**). Поскольку находка ТЗ была прямо снята ревьюером спецификации с пометкой «не блокирует» и не требовала правки кода/текста как условие, а код полностью соответствует зафиксированному в ТЗ порядку кнопок/safe-default, дополнительной находки на этапе код-ревью это не образует.

## Таблица AC → доказательство → что заставляет её покраснеть

| AC | Наблюдаемый результат | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 | RU discard-confirm = «Продолжить»/«Отменить»; EN/DE/FR короткие; safe default+autofocus+Escape/крестик/скрим = «продолжить» | `src/danger-confirm.ts`+`src/hp-confirm.ts` читал построчно: `cancelLabel` (safe, autofocus, первая кнопка) = `dialog.discard_keep`, `_decide(false)` на Escape/крестик/scrim (`dismiss-on-scrim`, `@hp-close`) — проверено чтением, не исполнением; `demo/smoke_dialog_polish_603.mjs.labels` + `smoke_danger_confirmation.mjs` (`cancelHasInitialFocus`, `cancelButtonIsSafe`, `escapeIsSafe`, `closeIsSafe`, `scrimIsSafe`) + i18n-юниты (`i18n.test.mjs`, `i18n-dead-keys.test.mjs`, покрыты зелёным Validate) | правка порядка кнопок в `hp-confirm.ts` или текста в любой из 4 локалей `settings/*.json` красит `labels`-сравнение и `cancelButtonIsSafe` |
| AC2 | 320/360/560(+640) px, 2 кнопки в 1 строке без clip/overflow; другие confirm не задеты | `demo/smoke_dialog_polish_603.mjs` меряет реальные `getBoundingClientRect` кнопок/лейблов/футера/surface (`contained`/`oneRow`/`fits`), не CSS-регэксп; RU mobile golden `room-discard-dialog-mobile-ru.png` (320px, новый принятый кадр); `smoke_space_settings_form.mjs.discardActionsShareOneRow` и `smoke_device_/general_settings_form.mjs.discardAsksFirst` подтверждают, что три другие формы не регрессировали | обрезка/наложение текста красит `contained`/`fits`; возврат длинных подписей красит `discardActionsShareOneRow` (`scrollWidth<=clientWidth`) |
| AC3 | шарик по центру дорожки, зазор Off/On симметричен ≤1px, включая border, light/dark, DPR1/2 | пересчитал геометрию вручную: `::before` inset 4px/11px + явный `width:36/height:22` без `box-sizing:border-box` над-ограничен на 2px (4+1+36+1+4=46≠44 при 1px border), правый эффективный отступ сжимается до 2px против левых 4px — это и есть баг; с `box-sizing: border-box` уравнение точное (4+1+34+1+4=44), гарантируя равные отступы `::before`; `smoke_dialog_polish_603.mjs.switchAligned` меряет то же самое в браузере на реальных вычисленных стилях, 64/64 зелёно | **мутация выполнена и приложена**: тест сам накатывает `box-sizing: content-box !important` на `::before` и проверяет `rejectsOldTrack` (расхождение зазоров > 1px) — прогнал лично, мутация действительно красит |
| AC4 | 44×44 hit area, мышь/клавиатура, focus/disabled сохранены | правка ограничена одним CSS-свойством (`box-sizing`) псевдоэлемента `::before`; `input` (реальный кликабельный/фокусируемый элемент) не тронут — проверено чтением; `off.target.width>=44 && height>=44` в `smoke_dialog_polish_603.mjs` зелёный на всех 64 комбинациях | обнуление `width:44px`/`height:44px` инпута красит эту проверку |
| AC5 | Room без `h3` «Основное», поля/зона/help/errors/Tab-порядок остаются | `formCard()` (`src/editors/form-kit.ts:77-84`) уже рендерит `.hpf-head` только при непустом `title` — убранная строка `title: t('room.group_basics')` не имеет побочных эффектов на `data-card`/`body` — проверено чтением; `smoke_room_settings_form.mjs.basicsHasNoHeadingButKeepsFields` (нет `.hpf-head`, есть `#room-name`/`#room-area`/`hp-help` у зоны) + `smoke_dialog_polish_603.mjs.roomFields` (3 оставшихся `h3` из 4 карточек) + golden `room-discard-dialog-mobile-ru` (снят на этом же диалоге) | возврат `title:` в `formCard` красит оба `roomFields`/`basicsHasNoHeadingButKeepsFields` |
| AC6 | typecheck/unit/build зелёные; смоки/golden перед S7; оба changelog в коммите | таблица гейтов выше + `git show 0a3e0674 -- docs/CHANGELOG.md docs/CHANGELOG.ru.md` — правки в обоих файлах в том же коммите, что и поведение | красный Validate на этом SHA либо отсутствие правки одного из changelog при `User-Visible: yes` |

Не заявляющие защиту AC (AC1, AC2, AC5 — расположение/текст/формат) не требуют отдельного столбца «чем краснеет» по PROCESS §2.7, но он приведён выше для полноты, так как автотесты уже дают такую пробу без дополнительной работы.

## Проверено и корректно

- **`room.group_basics` удалён из всех 4 основных локалей** (`src/i18n/{ru,en,de,fr}.json`) — ТЗ разрешало удаление только «пока не доказано отсутствие других потребителей». Проверил сам: `grep -rn "room\.group_basics"` (без `.help`) по `src/`, `demo/`, `test/` — совпадений нет, кроме исторических упоминаний в `docs/reviews/*`. `tsc --noEmit` зелёный (осиротевшая ссылка на удалённый ключ всплыла бы типом). Удаление корректно.
- **`dialogs.styles.ts` не тронут** — ТЗ допускало правку файла «только если сокращения [подписей] недостаточно». Подтвердил: `smoke_dialog_polish_603.mjs` меряет реальные пиксели кнопок на 320/360/560/640px и зелёный без изменения CSS футера — сокращения подписей действительно достаточно, файл обоснованно не тронут.
- **Порядок кнопок и safe default** в `hp-confirm.ts` не менялись (первая — `cancelLabel`/безопасная/autofocus, вторая — `confirmLabel`/danger-стиль) — соответствует контракту UX из ТЗ и не создаёт нового пути потери данных.
- **`box-sizing: border-box` на `::before`** математически устраняет асимметрию 4px/2px, вызванную border у track-псевдоэлемента при over-constrained абсолютном позиционировании (`inset` + явные `width/height`) — пересчитано вручную, независимо от теста.
- **Тестовые CSS-фикстуры** (`test/fixtures/form-kit-card-dialog{,-with-switch}.css`) обновлены в том же коммите, что и `form-kit.styles.ts` — `test/form-kit.test.mjs` сравнивает сгенерированный CSS с фикстурой построчно; расхождение упало бы там, будь фикстура забыта.
- **Golden-эталоны приняты по процессу**: оба commit класса D несут `Baseline-Reviewed:` на реально существующие и просмотренные прогоны (проверил `gh run view` на оба ID — headSha совпадает с материалом коммита, второй — с `Release: v1.77.0-beta.4`); `golden`-джоба на прогоне 35566453055 закономерно красная (кандидатные кадры для ревью), остальные джобы, включая три шарда браузерных смоков, зелёные — это ожидаемая картина процесса приёмки, не скрытая проблема.
- **Changelog RU+EN и `USER-GUIDE.md`/`.ru.md`** обновлены в коммите `0a3e0674`, формулировка «первая карточка без заголовка» согласована в обеих версиях гайда.
- **Три остальных потребителя** `dialog.discard_confirm/discard_keep` (`space-form`, `marker-dialog`, `general-settings-dialog`) не регрессировали — лично прогнал их смоки (см. таблицу гейтов), включая уже существующую прямую проверку одной строки в `smoke_space_settings_form.mjs`.
- **Один источник числа**: диф не вводит новую пользовательскую величину, отображаемую дважды (текст кнопок, заголовок карточки и CSS-геометрия — не числа, которые могли бы разойтись между превью/записью); `test/single-source-numbers.test.mjs` не затрагивается и не требуется.
- **Трейлеры**: все три коммита несут `Issue: #603` и корректный `User-Visible:`; D-класс несёт дополнительные `Release:`/`Baseline-Reviewed:`. Формат соответствует AGENTS.md/PROCESS §10.

## Чего не проверял

- `npm test`/`npx tsc --noEmit` как отдельные прогоны — не запускал их сам, доверился зелёному Validate на точном SHA `ee3d7805` (см. таблицу; `bundle:sync` попутно перегнал `tsc --noEmit`+`rollup`, тоже зелёный).
- Полный `golden:capture`/`verify` (174 сценария) и `performance_smoke` — не перегонял: обосновано выше (уже принят по процессу / диф не задевает perf-чувствительные пути).
- `pytest tests_backend`, `model-invariants` — не запускал, диф не касается Python и геометрии/ссылок на неё.
- Не переисследовал построчно, какой конкретно toggle и в каком состоянии показывают два изменившихся кадра `room-temperature-dialog-{desktop-en,mobile-ru}` — принял их изменение на основании корректно оформленной приёмки (`Baseline-Reviewed` на реальный зелёный прогон), не переигрывая его вручную.
- Не заводил отдельного вопроса про пропущенную в тексте ТЗ ссылку на прецедент «Отменить»=Undo — это уже закрытая, не блокирующая находка предыдущего этапа (Low-1 в `SPEC-REVIEW-603-r1`), а не новый дефект кода.

## Вердикт

**Зелёный.** Все шесть AC доказаны исполняемыми тестами (кроме мест, явно помеченных «проверено чтением»), защитный AC3 подтверждён мутацией с приложенным результатом, три незадетых напрямую потребителя общего кода перепроверены лично, гейты соразмерны риску задачи и явно перечислены. High: 0, Medium: 0.

---

<!-- material-anchors: заполняется конвейером -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/603-dialog-polish-2`, коммит `ee3d78052aa1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3e6e3d1ec75cd84ab24b803f8c2c4e37d10ea8be`
  ```
  git log --all --format='%H %T' | grep 3e6e3d1ec75c
  ```
- Тело issue: `e3fa4cf47f624039a45b39ad23ab485c72afd9cf2cd47a00b0faa0a7404fdae8`
- Вердикт конвейера: `green` · High 0
