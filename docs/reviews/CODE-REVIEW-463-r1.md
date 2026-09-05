# CODE-REVIEW-463-r1

Issue: #463 · "Diagnostics: `<hp-dialog>` native fallback opens non-modal, pinned to the left edge, no dimming"
Этап: code · заход r1 · блокирующих циклов 0/2 · трек `small`
SHA материала: `23c65e449e21f7541c7ca8ee6d42d94596b0bd14` (HEAD, совпадает с SHA в хендоффе и в ссылке на финальный Validate)

## Скоуп

Диапазон: `origin/dev..HEAD`, два коммита:

- `1856302c` — `fix: recover native dialog modal placement` (Issue: #463, User-Visible: yes) — продуктовый код + новый smoke + маршрутизация гейтов + документация + оба changelog + синхронные bundle.
- `23c65e44` — `test: accept corrected dialog baselines` (Issue: #463, User-Visible: no, Release: v1.72.0-beta.5, Baseline-Reviewed: ссылка на прогон) — только класс D: 29 golden-эталонов диалогов + 4 docs-скриншота + их индексы.

Файлы вне generated/baseline:

```
demo/smoke_dialog_modal_recovery.mjs | 318 ++++++++++++++++
docs/ARCHITECTURE.md                 |  14 +-
docs/CHANGELOG.md                    |   5 +
docs/CHANGELOG.ru.md                 |   5 +
scripts/mutation-gate.mjs            |  44 +++
scripts/smoke-links.mjs              |   7 +
src/hp-dialog.ts                     |  53 +++-
```

Ровно совпадает со списком «затронутые поверхности» ТЗ (лёгкий трек, тело issue). Ничего лишнего не тронуто.

Продуктовое изменение целиком в `src/hp-dialog.ts`: native-ветка `<dialog>` больше не растягивается на весь viewport (`width: auto` → `width: fit-content; height: fit-content; inset: 0`), и добавлен `_ensureNativeModal()` — сверка фактического `:modal` состояния после `firstUpdated`, каждого `updated` и в микрозадаче `connectedCallback` (восстановление после реконнекта), с безопасным `close()+showModal()` в `try/catch`. Ветка HA/native фиксируется один раз (`_useHaDialog === null` guard), как и было, но тип расширен до `boolean | null`, чтобы отличать «ещё не выбрано» от «выбран native».

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на точном SHA `23c65e44...` (https://github.com/Matysh/houseplan-card/actions/runs/33973740446, конкретно проверено `gh run view` — `conclusion: success`, `headSha` совпадает с HEAD): `tsc --noEmit`/юниты/сборка+синхрон бандла, `docs`, `provenance`, `process-gate`, `golden` — все успешны на этом SHA. Их заново не гонял.

То, что Validate не проверяет предметно (браузерные смоки и мутанты для этой задачи), прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Build (для смоков нужен свежий бандл) | `npm run build && npm run bundle:sync` | green, `git status` после — чисто (бандл в дереве байт-в-байт совпал с закоммиченным) |
| Целевой smoke | `node demo/smoke_dialog_modal_recovery.mjs` | green, все 20 проверок `true` |
| Мутант 1 (surface stretches) | `node scripts/mutation-gate.mjs --id=dialog-native-surface-stretches-to-viewport` | **краснеет** смок, как обязано — «поймано 1 из 1» |
| Мутант 2 (update recovery disabled) | `node scripts/mutation-gate.mjs --id=dialog-native-update-recovery-disabled` | **краснеет** — «поймано 1 из 1» |
| Мутант 3 (reconnect recovery disabled) | `node scripts/mutation-gate.mjs --id=dialog-native-reconnect-recovery-disabled` | **краснеет** — «поймано 1 из 1» |
| Выбор смоков по дифу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `smoke_help_affordance.mjs` (`_focusInitial`); зарегистрированная связь: `smoke_dialog_modal_recovery.mjs` (запись в `scripts/smoke-links.mjs` добавлена этим же диффом) |
| `smoke_help_affordance.mjs` | `node demo/smoke_help_affordance.mjs` | green, все проверки `true` |
| `smoke_danger_confirmation.mjs` | `node demo/smoke_danger_confirmation.mjs` | green (тот же компонент `hp-dialog`/`hp-confirm`, не в выборке селектора, но прямо назван в разделе «Затронутые поверхности» ТЗ) |
| `smoke_danger_confirm_branches.mjs` | `node demo/smoke_danger_confirm_branches.mjs` | green, включая `haDestructiveStaysNativeAlert` и т.п. |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 12 external links)» |
| Golden-приёмка на финальном SHA | прочитан job `golden` прогона Validate 33973740446 | success |
| Провенанс коммитов | прочитаны трейлеры `git show -s --format=full` для обоих коммитов | оба корректны (см. ниже) |

**Не прогонял** (и почему): `npm test`/`tsc --noEmit`/полный `npm run bundle:budget`/`no-new-any` отдельно — уже зелёные на этом же SHA в Validate, дельта с момента этого прогона нулевая (SHA совпадает с HEAD). `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`, backend job в обоих прогонах `skipped`/не назначен. `npm run golden:capture`/локальный визуальный просмотр всех 29 кадров — не переснимал сам (не Linux CI-артефакт под рукой в этой сессии), доверился job `golden: success` на точном SHA и списку изменённых файлов (см. ниже), это не альтернатива ревью, а имеющееся доказательство, которое я сверил, а не выдумал. Полный набор `demo/smoke_*.mjs` (226 файлов) — не прогонял: диф локален к одному компоненту, `smoke-select.mjs` не указал ничего внешнего, полный набор — предрелизный гейт.

## Находки

Нет находок уровня High или Medium. Реализация соответствует контракту ТЗ пункт-в-пункт, тесты умеют падать (проверено тремя реальными мутациями, не просто прочитаны из отчёта автора), а не только заявлены.

**Low.** `docs/ARCHITECTURE.md:126` — новая формулировка «An ordinary dialog uses `ha-dialog` when that component is registered as the instance is connected» синтаксически двусмысленна (читается как «зарегистрирован, поскольку экземпляр подключён», хотя смысл — «в момент подключения экземпляра»). Не блокирует, смысл абзаца в целом верен и совпадает с кодом (`connectedCallback`, `_useHaDialog === null` guard). Решение ревьюера: снято без правки — чисто редакционная шероховатость в документации класса C, не в контракте, следующая правка ARCHITECTURE.md эту фразу заденет естественным образом.

## Проверка критериев приёмки

| AC | Доказательство | Чем краснеет | Результат |
|---|---|---|---|
| AC1 (ровно один internal dialog, open+:modal, центрирован по обеим осям, backdrop alpha>0) | `smoke_dialog_modal_recovery.mjs` → `confirmHasOneNativeShell/confirmIsTopLayerModal/confirmSurfaceIsCentred/confirmBackdropIsVisible` = true | мутант `dialog-native-surface-stretches-to-viewport` (возвращает `width: auto`) — смок краснеет, проверено лично | Выполнен |
| AC2 (standard/wide fallback центрированы desktop+narrow, 92vw/92vh, без overflow; golden) | `standardFallbackStartsCentred` (desktop) и `wideNativeFallbackFitsAndCentresOnNarrowViewport` (narrow, `wide=true`) = true; golden job `success` на точном SHA, 29 изменённых кадров = ожидаемые 29 dialog-сцен (посчитано по стату коммита `23c65e44`) | геометрическое сравнение (не защитный AC в терминах §2.7 — расположение/размер, третий столбец не обязателен) | Выполнен |
| AC3 (open-but-nonmodal → update восстанавливает :modal на том же shell, без hp-close, без retry-loop) | `updateRecoversSameNativeShell`, `updateRecoveryRunsOnce` (2 update-цикла, `showModalCalls===1`), `recoveryNeverEmitsClose` = true | мутант `dialog-native-update-recovery-disabled` — смок краснеет, проверено лично | Выполнен |
| AC4 (detach/reattach → :modal, центрирован, без дубликата/hp-close, фокус восстановлен) | `detachActuallyDropsTopLayer`, `reconnectRecoversSameNativeShell`, `reconnectRestoresInitialFocus`, `recoveryNeverEmitsClose` = true | мутант `dialog-native-reconnect-recovery-disabled` — смок краснеет, проверено лично | Выполнен |
| AC5 (ветка стабильна для уже открытого; новый instance при готовом ha-dialog — один HA shell; alert всегда native) | `openFallbackDoesNotSwitchAfterLateHaRegistration`, `newOrdinaryUsesExactlyOneHaShell`, `alertAfterHaStillUsesExactlyOneNativeModal` = true; плюс чтение `_usesHaDialog()`/`connectedCallback` guard | доказательство smoke + код (`_useHaDialog === null` guard делает повторный выбор невозможным структурно) — проверено чтением | Выполнен |
| AC6 (top-layer order, focus containment/restore, действующие способы закрытия у вложенных/последовательных диалогов; без retry-loop) | `nestedNativeEscapeKeepsTopLayerOrder` (два вложенных native alert/parent, раздельные Escape); `stableUpdateDoesNotRetry`; регрессионные `smoke_danger_confirmation.mjs`/`smoke_danger_confirm_branches.mjs`/`smoke_help_affordance.mjs` зелёные | воспроизведение чтением: `@cancel`-обработчик и Tab-trap код не менялись этим диффом, `_ensureNativeModal` не подписывается на native `close`-событие (проверено чтением `render()` — только `@cancel`/`@click`, нет `@close`), поэтому программный `dialog.close()` не может синтезировать `hp-close` | Выполнен |

## Провенанс коммитов

- `1856302c`: `Issue: #463` · `User-Visible: yes` · оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите — правило §10.2.4/AGENTS соблюдено.
- `23c65e44`: `Issue: #463` · `User-Visible: no` · `Release: v1.72.0-beta.5` · `Baseline-Reviewed: .../runs/33973294353` — commit трогает только `demo/golden/baselines/**` + `docs/images/**` (класс D), трейлеры присутствуют по правилу. Ссылка проверена (`gh run view 33973294353`): реальный прогон на `headSha` = `1856302c`, `golden`-job там `failure` — ожидаемо, это и есть прогон, с которого взяты `actual`/`diff` для приёмки; после приёмки контрольный Validate на `23c65e44` зелёный целиком, включая `golden`.
- Ветка `issue/463-dialog-modal-recovery` соответствует `issue/NN-slug`.

## Одно число — один источник

Дифф не добавляет и не меняет ни одной пользовательски видимой величины (текста, числа, единицы измерения). Единственные «числа» в диффе — CSS-геометрия (`92vw/92vh`, уже существующие ограничения, не тронуты) и backdrop-alpha, которая нигде не показывается пользователю как число и не дублируется. Правило не применимо к этому диффу.

## Что проверено и корректно

- Скоуп диффа = заявленным «затронутым поверхностям» ТЗ, один за другим, без остатка и без лишнего.
- Целевой smoke и три обязательных мутанта — лично прогнаны, все три мутанта подтверждённо красят смок (не поверил заявлению автора на слово).
- Регрессионные smoke по тому же компоненту (`danger_confirmation`, `danger_confirm_branches`, `help_affordance`, выбранные `smoke-select.mjs` и явно перечисленные в ТЗ) — зелёные.
- `check-docs.mjs` зелёный — фингерпринт документации соответствует текущему `src/**`, скриншоты пересняты и приняты в этом же диапазоне.
- Golden: 29/29 dialog-сцен изменились (совпадает с заявленным числом), финальный Validate на HEAD зелёный по job `golden`.
- Оба changelog правлены в коммите с `User-Visible: yes`; ARCHITECTURE.md обновлён по факту (контракт совпадает с кодом).
- Не найдено ни одного нового `any` в диффе (`grep` по патчу `src/hp-dialog.ts`).
- Откат: два коммита, отдельно откатываемых, без миграции — соответствует разделу «Откат» ТЗ.

## Чего не проверял

- Реальную сессию Home Assistant с физическим разрывом соединения (сеть, DevTools throttling) — не воспроизводил; согласен с автором, что детерминированный browser-smoke через настоящий detach/reconnect DOM API покрывает утверждаемый контракт эквивалентно.
- Backend/HACS/Hassfest — не затронуты диффом, не прогонял.
- Полный набор из 226 browser-smoke и полный `golden:capture` с нуля — не входит в объём код-ревью (§8: полные наборы — предрелизный гейт); доверился уже пройденному предметному прогону на точном SHA плюс собственным целевым запускам.
- Визуальный просмотр каждого из 29 принятых golden-кадров глазами — не переоткрывал PNG-диффы сам; доверился тому, что `golden`-job на точном SHA зелёный (пиксельное сравнение с принятыми эталонами прошло) и числу изменившихся файлов, совпадающему с заявленным.

## Вердикт

Зелёный. Контракт закрыт по всем шести пунктам, все обязательные мутанты лично проверены как краснеющие, регрессионные смоки зелёные, provenance коммитов корректен, единственная находка — Low в документации, снята без правки.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/463-dialog-modal-recovery`, коммит `23c65e449e21` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `23c5b2eab1734a12bb6e61cdc1c0d867da8e5b0a`
  ```
  git log --all --format='%H %T' | grep 23c5b2eab173
  ```
