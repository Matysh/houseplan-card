# Code review #794 — static LED disconnect witness

Вердикт: зелёный · заход r1 · High: 0 · Medium: 0 · Low: 0 · маршрут: `fix`.

## Материал и границы

- Issue: https://github.com/Matysh/houseplan-card/issues/794 — прочитаны тело и комментарии.
- Ветка: `issue/794-static-led-disconnect-witness`.
- Материал: `d19bac39663e09285bf034c67ec1d1036f111652`.
- Дерево: `ff6900ce2e53c025488be7f58ba5fe655eefefa2`.
- База: `865312e0b09db8a46f5532655f299606f90166c5`.
- Полный дифф: шесть файлов, классы B/C; продуктовых и сгенерированных изменений нет.

Независимое локальное ревью агента `/root/review_794`, не автора реализации.
Это не вердикт модели конвейера, не подтверждение CI и не разрешение обходить
штатный порядок слияния. Исключение владельца здесь не заявляется.

Задача обслуживает J1: доказательство освобождения состояния светового слоя
View у отдельной карточки. Скоуп — исправить свидетель уже существующего
контракта, зафиксированного в `docs/LIGHT.md` (Owner teardown), без изменения
поведения продукта. `track:show` соответствует инфраструктуре; оснований
переклассифицировать задачу нет.

## Что проверено и корректно

Новый тест импортирует скомпилированный `HouseplanSpaceCard`, создаёт настоящий
экземпляр и вызывает настоящий `disconnectedCallback()`. Его метод не
подменяется и не копируется; строки исходника не используются как oracle.
Читается созданный конструктором `_glowRuntimeState`, а browser-owned свойства
`ownerDocument` и `isConnected` задаются управляемой фикстурой.

`loaded()` устанавливает оба настоящих lazy-слота — gate/runtime и field.
Прямого импорта field недостаточно для `ledRelease`, и тест это учитывает.
`renderStaticLed()` заполняет реальную геометрию поля и lifecycle на том же
owner. Проверяются entering, visible и leaving, отмена принадлежащих owner
rAF/таймеров, сохранность соседней карточки, новый cache и новый entering-rAF
при повторном подключении. Сохранённый старый entering callback вызывается
после reconnect и не может обновить owner или затронуть новый entry.

Сразу после callback, до любого render, таймера, rAF или микрозадачи,
`hasLedField(owner)` должен стать false, статистика — нулевой. Обычный
`disposeGlowRuntime(this._glowRuntimeState)` не маскирует отсутствие
`ledRelease`: LED field хранит отдельный `GlowRuntimeState` в owner-keyed
WeakMap. При удалённом вызове `ledRelease` непосредственный assert теста
остаётся красным по логике кода. Это проверено чтением, не запуском мутанта.

Именованный отрицательный случай исполняет обычную ветку connection guard без
teardown: позднее обновление подавлено, но cache и lifecycle остаются; после
reconnect новый entering-rAF не появляется. Поэтому отсутствие updates и
CSS transition events больше не принимаются за самостоятельное доказательство
disposal. Существующий browser smoke сохранён: изменены только пояснение и
название проверки, его assertions и последовательность не ослаблены.

Мутант `glow-static-led-release-skipped` сохранён с тем же продуктовым патчем,
guard перенесён на новый Node suite. `tsconfig.test.json` включает реальный
`space-card.ts`; `guardNeedsTestBuild()` в nightly execution подготавливает
test-build для короткой команды `node --test`. Новый browser guard не добавлен.
Трейлеры коммита корректны: `Issue: #794`, `User-Visible: no`.

## Проверки и происхождение доказательств

Самостоятельный запуск: WSL Ubuntu/ext4, Node `22.23.2`. WSL checkout остался
на базе с шестью изменёнными файлами; SHA-256 каждого из этих файлов совпал с
Windows-деревом материала. Остальные tracked-файлы WSL не изменены. Использован
test-build, подготовленный автором; повторная сборка и полный гейт ревьюером
не запускались.

| Команда / проверка | Результат и источник |
| --- | --- |
| `node --test test/space-card-led-disconnect.test.mjs` | Собственный запуск: PASS, 4/4, 0 skipped/cancelled, около 152 ms |
| `git diff --check 865312e0b..HEAD` | Собственный запуск: PASS |
| `git rev-parse HEAD` и полный дифф базы к материалу | Собственная сверка точного SHA, состава и трейлеров |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/space-card-led-disconnect.test.mjs` | Принято из авторского handoff и прочитанного `C:/Temp/hp794-scoped.log`: PASS, 4/4 |
| `npm run gate:small -- --base=865312e0b09db8a46f5532655f299606f90166c5` | Прочитан авторский `C:/Temp/hp794-gate-small-final.log`: PASS, 54 s, все 9 проверок — build/typecheck, units, bundle integrity/budget, lint:unused, no-new-any, no synchronous render layout, no-new-private-writes, smoke-select |
| `node scripts/bundle-sync.mjs && node demo/smoke_led_strip_glow.mjs` | Принято из авторского handoff и прочитанного `C:/Temp/hp794-smoke.log`: `OK`; самостоятельно браузер не запускался |
| `node scripts/mutation-gate.mjs --check` | Прочитан авторский `C:/Temp/hp794-mutation-check.log`: PASS, включая нужный mutant anchor; 235 browser guards, 4 предупреждения, без выполнения мутантов |
| `smoke-select` в small gate | Нет исполняемого frontend-диффа; дополнительные смоки по диффу не выбраны. Названный в AC LED smoke выполнен автором отдельно |

Четыре предупреждения static mutation check: три ранее существовавших
test-name-pattern с динамическими именами (`corpus-loses-its-short-edge`,
`optimize-reports-work-it-did-not-do`, `nightly-reuse-accepts-stale-marker`) и
превышение рекомендательного ориентира browser guards 200. Они не относятся к
новому свидетелю. Static `--check` не выдан за поимку мутанта.

### Приёмка и защитные случаи — чем краснеет

| AC / контракт | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1–2: именно static-card disconnect синхронно освобождает LED lifecycle, reconnect получает свежий entry | Три phase-case нового Node suite, собственный запуск 3/3; реальный callback и lazy slots проверены чтением | `glow-static-led-release-skipped` удаляет `ledRelease` только из disconnect; непосредственный `hasLedField === false` не выполняется. Поимку подтвердит ночь |
| AC1: connection guard не равнозначен disposal | Именованный negative case нового suite, собственный запуск 1/1 | Без teardown ожидаемо остаются старый cache/lifecycle и ноль новых entry frames; это отрицательный случай без source mutation |
| Owner isolation и отмена старого entry | Те же phase-case: сосед сохраняет cache/stats; pending callbacks удалены; старый rAF после reconnect не меняет updates/cache | Потеря соседнего поля, сохранённый owner callback либо stale update нарушают точные assertions; исполняется stale-rAF negative input |
| AC2: видимый fade остаётся browser-проверкой | Smoke assertions сохранены чтением диффа; авторский smoke `OK` | Существующий `glow-entry-initial-opacity-skipped` остаётся browser guard; выполнение мутанта не повторялось |
| AC3: ночной mutant связан с новым свидетелем, целевые и small checks зелёные | Registry diff, test-build wiring и static check; результаты выше | Статический gate отвергает отсутствующий anchor/guard; новый guard содержит прямой синхронный oracle. Фактическая nightly поимка пока не подтверждена |

## Риски и ограничения

- Async/lifecycle: проверены три фазы, synchronous boundary, cancellation,
  независимый сосед и replay старого entering-rAF. Replay уже извлечённых
  старых timer callbacks этот suite не доказывает и не заявляет.
- Host/input: Node вызывает callback напрямую с browser-property shims; это
  не самостоятельная проверка browser-driven removal, полного Lit render или
  полного `connectedCallback`. Сохранённый браузерный сценарий принят из
  авторского прогона, не из собственного исполнения.
- Визуал: CSS/fade сохраняются; новых пиксельных обещаний нет. Golden не
  запускался — визуального продуктового диффа и `ci:golden` нет.
- Данные/права, геометрия, touch и пользовательский UX не изменены; отдельные
  проверки миграций, HA-harness и модельных инвариантов здесь неприменимы.
- Объём/performance: browser guard заменён дешёвым Node guard; экономия всего
  ночного прогона не измерялась. Полные smokes/performance не запускались.
- Одно число — один источник: изменённые inventory counts 103 и 235 сверяются
  существующим `test/mutation-gate.test.mjs` с ID-списками и `MUTANTS`; ориентир
  200 сверяется с `BROWSER_GUARD_LIMIT`. Независимой новой числовой настройки нет.
- Мутанты не применялись и не запускались согласно PROCESS §2.7/#709.
  Реальную поимку проверит следующий nightly run. CI на кандидате слияния
  этим локальным ревью не подтверждается; штатный gate остаётся обязательным.

## Находки

High: 0. Medium: 0. Low: 0. Открытых находок нет.
## Дополнение интегратора: разрешение и объединённый кандидат

После завершения этого независимого ревью владелец явно разрешил ручное
слияние #794 и #795 по агентским ревью и перевод в S8. Решение зафиксировано
в [комментарии к #794](https://github.com/Matysh/houseplan-card/issues/794#issuecomment-5990879357).
Это разовое исключение при отказе штатной модели, не её зелёный вердикт.
Исходные SHA обоих проверенных материалов сохраняются в истории без rebase.

Отдельная read-only проверка совместимости агентом `/root/review_795`:
общих изменённых файлов нет; ID и общее число мутантов не меняются;
новый Node guard обеспечен существующей подготовкой test-build;
browser inventory после объединения равен 235. Замечаний нет.
Это проверка чтением, не запуск мутантов. Проверки точного объединённого
кандидата и результат push будут приложены в issue после исполнения.
