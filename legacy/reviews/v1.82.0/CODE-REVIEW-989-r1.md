# CODE-REVIEW #989 · r1

Трек: show · Материал: `99fb1de5b1817099c4b946c1c1b8f250e7548fb4` (origin/dev..HEAD,
2 коммита: `13de94b07` fix, `99fb1de5b` test). Маршрут побочных находок: mode=issues
(доверенный снимок policy, схема v1, issue 989, stage code, round 1).

## Скоуп

Проблема (репорт владельца): при создании устройства переключение
«Виртуальное → Home Assistant» сразу раскрывало список HA-устройств; Escape
при открытом списке закрывал всю форму вместо одного списка. ТЗ — три AC:

- AC1 — список появляется закрытым (включая повторный переход
  virtual→ha→virtual→ha), открывается только явным нажатием.
- AC2 — поиск/выбор HA-устройства работают прежним образом, имя/комната/
  черновик сохраняются, «Show entities» и фильтрация кандидатов не меняются.
- AC3 — Escape из поиска/варианта списка закрывает только список, возвращает
  фокус кнопке, не открывает подтверждение отмены, не стирает черновик;
  Escape при уже закрытом списке продолжает штатное подтверждение несохранённых
  изменений.

Это Core user job из `docs/SCOPE.md` — редактирование устройства (создание
привязки к Home Assistant), одна существующая поверхность (диалог устройства),
без нового UX-контракта: поведение закрытого списка и scoped-Escape уже
является существующим паттерном карточки (`hp-settings-select`,
`hp-color-opacity`, `hp-help` — тот же `registerOverlay`/`HpDialog` LIFO-стек,
описанный в `ARCHITECTURE.md` п.6 «One transient-surface contract»).

## Маршрут вердикта (§5)

- complexity — автор заявил 2/10 сложности, 3/10 риска; дифф подтверждает:
  один новый файл-директива (43 строки), точечные правки в двух существующих
  местах рендера. ≤3 — да.
- surfaces — один диалог (`marker-dialog.ts`), один контрол (`sourcePicker`),
  единственный вызов в этом диалоге (проверено `grep`) — конфликта overlay-групп
  с другими пикерами того же диалога нет. Одна поверхность — да.
- migration — нет новых конфиг-полей/совместимости; `bindingOpen` — временное
  UI-состояние черновика, не персистентное поле. Нет миграции — да.
- ux-contract — закрытый список по умолчанию и scoped-Escape — уже
  задокументированный паттерн (`ARCHITECTURE.md` п.6); новый контракт не
  вводится, расширяется существующий `registerOverlay` на ещё один потребитель.
  Нет нового контракта — да.
- perf-touch — touch editor остаётся best effort (без изменения контракта,
  заявлено автором и не противоречит дифу — изменений в touch-путях нет);
  `mutation-gate --check` не показал скачка «Pointer geometry» категории сверх
  уже учтённого одного нового guard. Нет влияния — да.
- undocumented — ожидаемое поведение дословно зафиксировано в теле issue (AC1–
  AC3) и теперь закреплено в `USER-GUIDE.md`/`USER-GUIDE.ru.md` в том же
  коммите, что и поведенческая правка. Не undocumented — да.

Все шесть критериев §5 пройдены → `route: fix`.

## Как проверялось

Зелёного Validate на `99fb1de5b` не найдено — все проверки ниже выполнены мной
лично на этом SHA, рабочая копия соответствует ему (`git status` чист,
`git rev-parse HEAD` = материалу).

| Команда | Результат |
| --- | --- |
| `npx tsc --noEmit` | чисто, без ошибок |
| `npm run build` | OK, `dist` собран (29.8s) |
| `npm run bundle:sync` | OK, `demo/srv/assets` обновлён под текущий `dist` |
| `node demo/smoke_binding_ui.mjs` | PASS, все 12 именованных сценариев (AC1–AC3), реальные Playwright pointer/keyboard события, пин браузера подтверждён (`browser-attestation ok`) |
| `node demo/smoke_device_settings_form.mjs` | PASS (включая изменённую `createHaWithoutBindingIsAProblem`, теперь требующую `aria-expanded=false` и отсутствие панели) |
| `node demo/smoke_device_preview_parity.mjs` | PASS (с добавленным явным кликом по кнопке перед поиском) |
| `npm test` (tsc test-build + product/tooling unit-suite) | PASS — 5442/5443, 1 skipped, 0 fail, 318s |
| `node scripts/process-gate.mjs --issues` | PASS, диапазон origin/dev..HEAD, 2 коммита, 0 предупреждений |
| `node scripts/mutation-gate.mjs --check --base origin/dev` | PASS статических anchors (включая новую запись `source-picker-escape-keeps-list-open`); execution=0, caught=unknown (ночной прогон); 434/200 browser guards — ожидаемый WARN выше ориентира, не новая находка |

Чего не проверял и почему:
- `node demo/smoke_binding_ui.mjs --ha-cache ...` (прогон на официальном HA
  frontend) — нет подготовленной HA-фикстуры в среде ревью; полагаюсь на
  авторский отчёт о PASS на HA frontend 20260930.4/Chromium 151.0.7922.34
  (комментарий issue от 2026-10-21). Основной сценарий (demo-смоук) уже
  доказывает поведение реальными trusted-событиями, поэтому отсутствие
  повторного HA-прогона не блокирует вердикт.
- Полный `gate:small` / `gate:small -- --smokes` (59+ смоуков) не гонял — это
  предрелизный объём (§8), несоразмерный задаче track:show с одной
  поверхностью; прогнал только адресный и два изменённых смоука плюс полный
  обязательный unit-набор и build/typecheck.
- Исполнение зарегистрированного мутанта `source-picker-escape-keeps-list-open`
  — запрещено вне ночного workflow (общая политика, #905); использован только
  статический `--check`.
- Golden/скриншот-гейты — дифф не трогает путь отрисовки плана, авторская
  заявка «отдельные golden не требуются» подтверждена чтением: правки — только
  JS-логика открытия/закрытия и разметка панели, уже покрытая существующими
  visual-смоуками формы (их не затрагивает).

## Разбор по AC (код + тест)

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 | `marker-dialog.ts:294` переключение в `ha` теперь безусловно ставит `bindingOpen: false` (было `d.binding === 'virtual' || !d.binding` в v1.81.0 — проверено чтением тега); смоук `haStartsClosedAndSaveDisabled`, `secondHaAppearanceIsClosed` | Обычный отрицательный прогон: откат строки на условие из v1.81.0 вернул бы `aria-expanded=true` сразу после переключения — ловится тем же смоуком (не исполнялся, т.к. это правка предмета ревью, а не отдельный свидетель; проверено чтением диффа против тега) |
| AC2 | Поиск/выбор/черновик: смоук `unmatchedSearchHasNoSelectableResult`, `deviceEntitiesAreOptIn`, `pickUpdatesLabelClosesListAndRetainsDraft`, `reopenPreservesFilterAndDraft`; код `onPick`/`onFilter` не менялся (сверено построчно с v1.81.0, различий нет) | Пустой список при несовпадающем поиске — видимое сообщение и `role=option` count=0 |
| AC3 | `source-picker-overlay.ts` — `AsyncDirective`, регистрирует transient-overlay в `HpDialog.registerOverlay`, закрывает только список по `'escape'`, возвращает фокус `.hpf-pick`; смоук `escapeSearchClosesOnlyListAndReturnsFocus`, `escapeOptionClosesOnlyList`, `closedListEscapeStillAsksBeforeDiscard` | id `source-picker-escape-keeps-list-open` (зарегистрирован, статически проверен `--check`, **не исполнялся** — политика #905); мутация меняет `this.onClose?.()` на условный вызов, пропускающий закрытие при `reason==='escape'` — логически прослежено: `HpDialog` уже снимает запись из `_overlays` при Escape независимо от колбэка, поэтому без вызова `onClose` модельное состояние `bindingOpen` не меняется и `panel` остаётся в DOM — ассерт `toHaveCount(0)` в `closed()` обязан покраснеть |

## Разбор реализации (чтением)

`src/editors/source-picker-overlay.ts` — новая `AsyncDirective`, привязанная
как element-directive к `.hpf-picker`. Прослежены все пути:

- Регистрация отложена на `queueMicrotask` (комментарий в коде: «element part
  may run before a new picker is inserted into its dialog»). Проверил race
  между открытием и Escape: оба происходят в раздельных задачах event loop
  (клик → рендер → микротаски регистрации гарантированно дренируются до
  следующего события клавиатуры) — реальным пользовательским вводом окно гонки
  недостижимо.
- Повторные вызовы `update()` (на каждый ре-рендер диалога, включая ввод в
  других полях формы) не создают дублей: внутри микротаски есть ранний выход
  `|| this.dispose) return`, а `HpDialog.registerOverlay` дополнительно
  дедуплицирует по `owner` (сверено в `hp-dialog.ts:699-700`).
  Программное закрытие (клик по кандидату, повторный клик по кнопке, переход
  в «Виртуальное») не вызывает `onClose` — `sync()` при `!open` просто
  вызывает уже полученный `dispose()` (unregister), не трогая модель второй
  раз; сверено, что `onPick`/`onToggle` сами выставляют `bindingOpen: false`.
- Identity guard `if (this.host._markerDialog === d)` в `onClose` защищает от
  оживления уже закрытой/заменённой формы: `onClose` — это новое замыкание на
  каждый рендер (т.к. `renderMarkerDialog` выполняется заново и возвращает
  актуальный `d`), поэтому `this.onClose`-поле директивы всегда свежее при
  фактическом вызове, а guard нужен именно на случай, если сама форма успела
  retire (`_markerDialog = null`) между регистрацией и Escape.
- Единственный существующий вызов `sourcePicker` с `onClose` — в
  `marker-dialog.ts`; остальные три вызова (`room-settings-dialog.ts`,
  `properties/editor.ts` и определение в `form-kit.ts`) не передают `onClose`,
  директива для них остаётся no-op (`sync()` всегда уходит в ранний выход по
  `!this.onClose`) — блэст-радиус подтверждён точечным.
- Паттерн согласован с прецедентом `dialog-presence.ts` (та же пара
  `AsyncDirective` + `disconnected/reconnected`), а не изобретён заново;
  также согласован со стилем `registerOverlay` в `hp-settings-select.ts` /
  `hp-color-opacity.ts` / `hp-help.ts`.

Правок в `demo/smoke_device_settings_form.mjs` и
`demo/smoke_device_preview_parity.mjs` ровно столько, сколько нужно под новое
поведение (закрытая панель по умолчанию, явный клик перед поиском); остальные
их ассерты (preview parity, validation) не тронуты и прошли.

## Релизная классификация

`docs/release-ledger/v1.81.0/989.json` — `category: stable-fix`. Проверено
чтением тега `v1.81.0`: `marker-dialog.ts:301` там действительно безусловно
ставит `bindingOpen: d.binding === 'virtual' || !d.binding` (авто-раскрытие),
а `form-kit.ts` того тега не содержит ни `onClose`, ни `registerOverlay`.
Баг — подтверждённо существующий в стабильной линии, не часть новой
1.82-beta функции; классификация `stable-fix` корректна, это не вывод из
`User-Visible`, а отдельно проверенное авторское суждение.

## Трейлеры и changelog

- `13de94b07` — `Issue: #989`, `User-Visible: yes`; в этом же коммите —
  `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` (по 3 строки, формулировки
  совпадают по смыслу), `USER-GUIDE.md`/`USER-GUIDE.ru.md`, `ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `release-ledger/v1.81.0/989.json`, продуктовый код и
  мутационный реестр — всё вместе, как требует §8.
- `99fb1de5b` — `Issue: #989`, `User-Visible: no`; трогает только два смоука
  (подгонка ассертов под уже выпущенное в предыдущем коммите поведение),
  корректно помечен как невидимый пользователю.
- Величина, видимая пользователю дважды, в диффе не меняется (единственное
  число, которое двигается — счётчик browser guards 433→434 в
  `docs/testing-notes/mutation-browser-guards.md`, это внутренняя
  tooling-метрика реестра мутаций, а не пользовательское число; источник один
  — `scripts/mutation-registry.mjs`, сверено `mutation-gate --check`).

## Что проверено и корректно

- Поведение AC1–AC3 воспроизведено реальными Playwright pointer/keyboard
  событиями против актуального бандла (после `bundle:sync`), не моками модели.
- `tsc --noEmit`, `npm run build`, `npm test` (unit), `process-gate`,
  `mutation-gate --check` — все зелёные на материале.
- Blast radius подтверждён точечным (один вызов `sourcePicker` с `onClose`,
  остальные потребители не затронуты).
- Классификация `stable-fix` и трейлеры/changelog соответствуют политике.
- Документация (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `USER-GUIDE.(ru.)md`)
  согласована с кодом и друг с другом.

## Находки

Находок уровня High или Medium не обнаружено. Побочных находок вне скоупа
также нет.

## Вердикт

Зелёный. Все критерии §5 пройдены → `route: fix` (зелёный не возвращает
задачу на правки и не образует цикл; бюджет §4 не расходуется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/989-device-picker`, коммит `99fb1de5b181` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c57fd339afefb21aff80f64dcecf8049a2c2898d`
  ```
  git log --all --format='%H %T' | grep c57fd339afef
  ```
- Тело issue: `cf0a395933c420a763e7d4ed6aa9bacc61024d2ed42afdb51abaa841e145e08d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDAsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDV9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjExNiwib3V0cHV0X3Rva2VucyI6MzU3NzAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTMzNzMxLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTMzMjg0NiwiY29zdFVzZEVzdGltYXRlIjoxLjk1OTQyNTE5OTk5OTk5OTR9XSwidHVybnMiOjY2LCJkdXJhdGlvbk1zIjo3MjM3ODMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjk2NDQ3NTE5OTk5OTk5OTYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5056 output_tokens=35792 cache_creation_input_tokens=133731 cache_read_input_tokens=5332846 num_turns=66 -->
