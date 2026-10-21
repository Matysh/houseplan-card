# CODE-REVIEW-990-r1

Issue: #990 · «Подтверждение отмены без сохранения: анимация, начальный фокус и крестик»
Трек: show · Этап: code · Заход: r1 · блокирующих циклов израсходовано 0 из 2
Материал: `issue/990-discard-dialog-polish` @ `f695dd6333e6908cc108ccc47c4a421fbd2c71f8` (рабочая копия), база `origin/dev` = `2b151e454750b3b1413b794311ac375caa1426cc`
Политика побочных находок: `mode=issues` (доверенный снимок сверен, расхождений нет) — побочных находок нет, новые issue не заводились.

## Скоуп

Задача закрывает полировку единственной существующей поверхности —
подтверждения несохранённых изменений (`hp-confirm` + его `discard-*`
запросы из `general-settings-dialog.ts`, `space-form.ts`, `radar-setup.ts`),
обслуживает J4/J6 (`docs/SCOPE.md`). Три AC:

- AC1 — вход диалога коротким fade/сдвигом, обратным уже существующему
  native-выходу; reduced motion отключает движение; другие подтверждения
  эффект не получают.
- AC2 — безопасный автофокус «Вернуться» без начальной жирной обводки,
  реальный Tab/Shift+Tab возвращает видимую индикацию; Back/Escape/X хранят
  черновик, «Не сохранять» закрывает без записи.
- AC3 — крестик подтверждения использует те же токены `160ms ease` /
  `rotate(90deg) scale(1.12)`, что настройки; при reduced motion — без
  transform/transition.

Диф: `src/hp-confirm.ts` (+16/-2), `src/hp-dialog.ts` (+18, только scoped
CSS), новый `demo/smoke_discard_dialog_polish.mjs`, адресная связь в
`scripts/smoke-links.mjs`, два декларативных nightly-мутанта в
`scripts/mutation-registry.mjs` + обновлённый инвентарь
`docs/testing-notes/mutation-browser-guards.md` (64→66 в категории Paint,
433→435 итог — сверяется автотестом `test/mutation-gate.test.mjs`, вошёл в
зелёный `npm test`), `docs/ARCHITECTURE.md`/`docs/DEVELOPMENT.md`,
changelog RU/EN, `docs/release-ledger/v1.81.0/990.json`. Общий lifecycle
`HpDialog` (exit-анимация, модальность, `cancelExit`) не тронут.

## Как проверялось

Зелёного Validate на `f695dd633` не найдено (только три path-профиля
«Проверка (CI)» — tooling/docs/product). Прогнал дешёвые гейты сам:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | PASS, 0 ошибок |
| `npm test` | PASS — 5443 тестов, 5442 pass, 1 skipped, 0 fail (включая `test/mutation-gate.test.mjs`, `test/release-ledger.test.mjs`, `test/release-contract.test.mjs` и другие, проверяющие числа инвентаря и ledger) |
| `npm run build` + `node scripts/bundle-policy.mjs --verify` | PASS — свежий `dist` цел, 60 ассетов (кандидат не сверяет закоммиченную копию, #657) |
| `node scripts/mutation-gate.mjs --check` | PASS, статически — оба новых id (`discard-confirm-initial-focus-ring-990`, `discard-confirm-ignores-reduced-motion-990`) видны реестру; execution=0/caught=unknown — мутанты не исполнялись (ночь, не этот цикл) |
| `node scripts/process-gate.mjs --issues` | PASS, 0 предупреждений — трейлеры коммита корректны |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | две зарегистрированные связи: `smoke_discard_dialog_polish.mjs` (прямое совпадение, назван в AC) и `smoke_ui_polish_976.mjs` (соседний риск по `hp-dialog.ts`) |
| `node demo/smoke_discard_dialog_polish.mjs` (после `npm run bundle:sync`) | **PASS 28/28** — все пункты AC1–AC3 на обеих ширинах/темах плюс reduced-motion и соседнее предупреждение |
| `node demo/smoke_ui_polish_976.mjs` | PASS — соседний риск по `hp-dialog.ts` не задет |

Первый прогон смоков падал на `Failed to fetch dynamically imported
module` — известная причина (см. `CODE-REVIEW-946-r1.md`,
`CODE-REVIEW-956-r1.md`): свежий `dist` не был синхронизирован в
`demo/srv/assets`. `npm run bundle:sync` устранил это; это стандартная
предпосылка смока, не правка предмета ревью.

**Golden.** Пайплайн пометил изменённые строки `hp-dialog.ts:212-213` как
риск отрисовки плана и поставил `ci:golden`; ревью — только после Validate
с golden на материале. Такого отдельного Validate-прогона с меткой нет, но
golden фактически уже исполнялся на точном SHA `f695dd633` внутри джоба «CI
product» (workflow `validate-product.yml`, run `39556526757`, job
`Golden-кадры против принятых эталонов`, **success**). Лог содержит
`room-discard-dialog-mobile-ru sha256=... diff=0px ratio=0.000000
maxDelta=0` — сдвига кадров нет вовсе, включая сцену, которую автор отдельно
пометил как «golden intent» на возможную потерю обводки. Остальные
золотые сцены в выборке лога (lighting-*) тоже `diff=0px`. Вывод: golden
зелёный на материале ревью, сдвига кадров нет.

**Не проверялось:** полная golden-матрица целиком (гейт предрелизный, не
ревью), performance/geometry-parity/backend-джобы (в AC не названы, в
диффе нет Python/геометрии), полный `gate:small`/ship-пакет, визуальная
ручная dev/GPU-приёмка (добровольна, #929), ночной исполненный прогон
зарегистрированных мутантов (nightly-зона, не этот цикл).

## Разбор по коду

- `src/hp-confirm.ts`: `updated()` ранний выход по `!changed.has('request')
  && !changed.has('token')`, затем по `!this.request?.key.startsWith('discard-')`
  — короткое замыкание optional chaining корректно не падает на `null`
  (`this.request?.key.startsWith(...)` целиком становится `undefined`, когда
  `request` отсутствует). `querySelector('[autofocus]')` ищет в light DOM
  самого `hp-confirm` (`createRenderRoot() { return this; }`), кнопка —
  его собственный light-дочерний элемент (слотируется в `hp-dialog`), поэтому
  без протыкания теневых границ находится корректно — подтверждено
  прохождением `keyboardTarget`/`noInitialRing` в смоке.
- `prepareDialogReturnFocus` переиспользован как есть (не менялся) — тот же
  helper, что уже используется для return-focus после закрытия диалога
  (#976); новый вызов только добавляет ещё одно место его применения.
- `src/hp-dialog.ts`: новая CSS-анимация `hp-discard-in` (`opacity 0→1,
  translateY(12px→0)`, 180ms ease) — посимвольно зеркало существующей
  JS-анимации выхода (`surface.animate([{opacity:1,translateY(0)},
  {opacity:0,translateY(12px)}], {duration:180, easing:'ease'})`,
  строки 656-659) — AC1 «обратный уже существующему native exit» выполнено
  буквально, не по описанию.
- Токены крестика `160ms ease` / `rotate(90deg) scale(1.12)` у
  `:host(.discard-confirm-dialog)` byte-в-byte совпадают со значениями,
  уже заданными для `settings-layout` (`src/styles/settings-dialogs.styles.ts:10`)
  и `hp-pdf-dialog.ts:56` — не новый контракт, а то же самое значение,
  примененное к третьему потребителю.
- Область видимости правки: все CSS-правила скопированы под новый класс
  `.discard-confirm-dialog`, применяемый только когда `request.key`
  начинается с `discard-`. Таких ключей в кодовой базе ровно три:
  `discard-settings-dialog`, `discard-space-dialog`, `discard-radar-setup` —
  все уже существующий паттерн «подтверждение несохранённых изменений»
  (не изобретён в этой задаче), так что обобщение на все три, а не только на
  протестированный General-settings сценарий, не выходит за рамки
  «одна поверхность». Смок явно проверяет соседний `warning`-запрос без
  префикса `discard-` и подтверждает отсутствие нового эффекта
  (`unrelatedKeepsSafeFocus`, `unrelatedHasNoNewEntrance`).
- Защитный аспект AC2 (безопасный автофокус не должен теряться) закрыт
  таблицей автора «AC · чем доказан · чем краснеет»: обычный доказанный
  before/after прогон на неизменённой реализации (`2b151e454`, 8 FAIL) плюс
  зарегистрированный `discard-confirm-initial-focus-ring-990` с честным
  «не исполнялся» — третий столбец не пуст, соответствует правилу.

## Трейлеры, changelog, release-ledger

- Коммит `f695dd633`: `Issue: #990`, `User-Visible: yes` — присутствуют;
  `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в том же коммите.
  Текст описывает ровно то же поведение (плавное появление, крестик как в
  настройках, снятая начальная обводка у «Вернуться», сохранённая
  клавиатурная/reduced-motion/Keep-Discard семантика) — согласован между RU
  и EN.
- `docs/release-ledger/v1.81.0/990.json`: `baseStable: v1.81.0` (текущий
  последний stable, подтверждено по дереву релизов), `category: line-fix`,
  `introducedBy: 976`. Фактическая цепочка функции — `#931` → `#976`
  (introducedBy 931, тоже line-fix) → `#990` (introducedBy 976). Это
  суждение автора о том, какая задача «впервые добавила» конкретно
  переиспользуемый механизм close-motion/return-focus, которым пользуется
  #990 — не формальная ошибка (оба конца цепочки одинаково исключены из
  stable milestone/changelog), но стоит отметить для будущего разбора линии:
  итоговое released-описание фичи должно схлопнуть цепочку к её коренному
  `major` (вероятно #931), а не плодить попарные ссылки. Не поднимаю это до
  находки — не меняет ни вердикт, ни гейты, ни milestone, чисто
  редакционное наблюдение для release-review.
- Одно число — один источник (§8): таблица `docs/testing-notes/
  mutation-browser-guards.md` (64→66, 433→435) и вывод
  `mutation-gate --check` (`435/200`) читают один и тот же реестр
  `MUTANTS`; совпадение таблицы с кодом проверяет исполняемый
  `test/mutation-gate.test.mjs` (прошёл в `npm test`) — не два независимых
  источника одного числа.

## Находки

Нет High. Нет Medium. Low не заведено.

## Что проверено и корректно

- Все три AC доказаны исполнением адресного смока (28/28 PASS) на
  пересобранном бандле этого SHA, включая реальный Tab/Shift+Tab, hover
  крестика, Escape/Back/X/Discard и reduced-motion.
- Golden зелёный на точном материале ревью (`f695dd633`, success,
  `room-discard-dialog-mobile-ru` diff=0px) — сдвига кадров нет.
  `ci:golden` условие выполнено по существу, хотя отдельного «Validate»
  коммент-гейта на этот SHA не было. Точечное наблюдение по golden: автор
  ожидал возможную потерю обводки на этом кадре, по факту diff=0 —
  противоречия с заявленным AC нет (кадр и так не фиксировал обводку),
  вопрос снят чтением лога, не находка.
- typecheck/юниты/сборка/bundle-policy/process-gate/mutation-gate(static)
  зелёные на материале ревью.
- Трейлеры и оба changelog в одном коммите; release-ledger классификация
  обоснована и имеет собственный SHA (не doc-only placeholder).
- Правка не трогает общий `HpDialog` lifecycle, не вводит новый UX-контракт,
  конфиг, миграцию, touch- или perf-контракт — критерии §5 трека `show`
  выполнены (сложность/риск ≤3, одна поверхность, документировано
  владельцем и в `docs/ARCHITECTURE.md`).

## Чего не проверял

- Полную golden-матрицу, performance, geometry-parity, backend pytest —
  не задеты диффом и не названы в AC; это предрелизный гейт, не гейт ревью.
- Исполнение зарегистрированных мутантов `discard-confirm-initial-focus-
  ring-990` и `discard-confirm-ignores-reduced-motion-990` — по общей
  политике их прогон вне ночного workflow запрещён; подтверждена только их
  регистрация (`mutation-gate --check` PASS, execution=0).
- Ручную dev/GPU-приёмку владельцем — добровольна, не является гейтом
  (#929).
- `ship`-пакетное ревью/полный `gate:small` — не требуются на этом треке и
  этапе.

## Вердикт

Зелёный. Route: fix (критерии §5 пройдены, `reclassify` не применяется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/990-discard-dialog-polish`, коммит `f695dd6333e6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `56673bb82b19290619dcf195c97a5b6c42c8f278`
  ```
  git log --all --format='%H %T' | grep 56673bb82b19
  ```
- Тело issue: `b7f7909b6cc0afe6ef9dc3fb344012f2d1ae0b3f66bdecd52a4178f33d4b50d3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5MzYsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDQ2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjAsIm91dHB1dF90b2tlbnMiOjQxNjA2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMzE0NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjYyMTEyNjAsImNvc3RVc2RFc3RpbWF0ZSI6Mi4xOTExMjh9XSwidHVybnMiOjc1LCJkdXJhdGlvbk1zIjo5MzYxNjgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjE5NjE3NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5056 output_tokens=41628 cache_creation_input_tokens=133144 cache_read_input_tokens=6211260 num_turns=75 -->
