# CODE-REVIEW-378-r1

- **Issue:** #378 — «Значение + состояние»: выбор источника значения, как у бейджа
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 до этого вердикта
- **SHA материала:** `552b78a134026f084593d5c76dcb55cba50088cd` (`git rev-parse HEAD`
  сверен непосредственно перед подведением итогов)
- **Диапазон:** `origin/dev...HEAD` = `6e1d9364..552b78a1`
  (`a851c8f9` ТЗ, `ad9c6349` ревью ТЗ r1 — зелёный, `591f8f6a` реализация,
  `552b78a1` docs screenshots после rebase)
- **Спецификация:** `docs/specs/378-value-face-source.md`, ревью ТЗ зелёное
  (`docs/reviews/SPEC-REVIEW-378-r1.md`)
- **Вердикт:** жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче

## Скоуп

Диапазон полный (первый заход код-ревью, дельты предыдущего раунда нет —
предыдущий вердикт того же issue относился к этапу ТЗ, не к коду). Проверены
все 10 AC ТЗ:

- `src/device-value-badge.ts` — общий `resolveValueSource`/formatter/failure-код,
  `valueSourceWriteFields`.
- `src/device-presentation.ts` — explicit-ветка `resolveValue()`, приоритет
  virtual, `sourceSignature`, `fallbackReason`/`valueFullText`.
- `src/houseplan-editor-runtime.ts` — селектор «Источник значения» в диалоге,
  draft/preview, reset на смену binding, rebind marker id.
- `src/devices.ts`, `src/houseplan-card.ts`, `src/types.ts` — поле конфига,
  `rewriteMarkerControlReferences`.
- `custom_components/houseplan/validation.py` — общая `validate_source()`,
  lossless-схема, delta-validation, marker-ref target/is_light.
- `custom_components/houseplan/import_export.py` — full/space export/import,
  drop/remap/virtualize, `_transfer_dropped_marker_links` maximum.
- `scripts/model-invariants.mjs`, `scripts/smoke-links.mjs` — новый инвариант
  ссылки и регистрация смока.
- `demo/smoke_value_face_source.mjs` — целевой browser smoke.
- Тесты: `test/device-presentation.test.mjs`,
  `test/device-presentation-policy.test.mjs`, `test/devices.test.mjs`,
  `test/native-select-contract.test.mjs`,
  `test/fixtures/device-presentation-decisions.mjs`,
  `tests_backend/test_validation.py`, `tests_backend/test_ha_import_export.py`.
- Документация: `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/DEVICE-PRESENTATION.md`, `docs/USER-GUIDE.md`/`.ru.md`,
  `docs/CHANGELOG.md`/`.ru.md`, i18n en/ru/de/fr, `docs/specs/README.md`.

## Как проверялось

Дешёвые гейты уже подтверждены зелёным Validate на этом же SHA `552b78a1`
(https://github.com/Matysh/houseplan-card/actions/runs/33270791009) —
`npx tsc --noEmit`, `npm test` (1574 passed / 1 skipped, включая
`model-invariants.test.mjs` на всех моделях проекта), `npm run build`,
backend `pytest` (143 passed), `no-new-any`, bundle budget/sync не
перегонялись повторно ревьюером.

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`, backend pytest, `no-new-any` | не гонял повторно | зелёный Validate на точном SHA `552b78a1` (ссылка выше); код с тех пор не менялся |
| `node scripts/check-docs.mjs` | **прогнал** | `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/bundle-sync.mjs` + сверка трёх копий бандла | **прогнал** | `git status --short` пуст после синка — `dist/`, `custom_components/.../frontend` и рабочая копия совпадают побайтово |
| `node scripts/bundle-budget.mjs` | **прогнал** | `277948 B` initial View при лимите `300000 B` (что коррелирует с заявленными автором `277599 B`; малая разница — среда/oxipng, бюджет не нарушен) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал** | прямое совпадение: `smoke_cover_tap.mjs`, `smoke_value_face_source.mjs`; зарегистрированная связь: `smoke_cold_view_toggle.mjs`; 31 слабая связь по общему имени `_markerDialog` — не прогонялись, см. «Чего не проверял» |
| `demo/smoke_value_face_source.mjs` | **прогнал**, зелёный, **проверил, что умеет падать** | мутация `text: text ?? '—'` → `'RAW'` в `device-value-badge.ts` дала 5 честных провалов (`preview42`, `plan42`, `static42`, `unavailableDash`, `recovered55`); откат мутации восстановил зелёный прогон и чистое дерево |
| `demo/smoke_cover_tap.mjs` (прямое совпадение) | **прогнал** | все ключи `true` |
| `demo/smoke_cold_view_toggle.mjs` (зарегистрированная связь: `resolvedLightSources`) | **прогнал** | все ключи `true` |
| `demo/smoke_device_preview_parity.mjs` (слабая связь, но прямо про preview, который правит диф) | **прогнал** | все ключи `true` |
| `npm run golden:verify` (диф трогает рендер лица значения) | **прогнал** | 78/78 сценариев `passed`, включая `device-value-badge-positions-dark` и все `device-dialog-*` |
| `npm run invariants -- --config <…>` на конкретном конфиге | не гонял отдельно | `checkReferences()` для `marker.value_source` уже покрыт `model-invariants.test.mjs`, часть зелёного `npm test` на всех моделях проекта |
| `python -m pytest tests_backend -q` | не гонял повторно | входит в зелёный Validate; изменения только в `validation.py`/`import_export.py`, оба покрыты новыми тестами, прочитанными построчно |

## Находки

### Medium — AC2 не доказан golden-сценарием, как того явно требует принятое ТЗ

- **Файл:** `docs/specs/378-value-face-source.md` (AC2, «План автотестов»,
  «Release-артефакты») vs фактический диапазон `demo/golden/**`
- **Summary:** ТЗ трижды явно требует golden-доказательство для видимого
  результата явного источника (`cover.current_position = 42` → `42 %`): в
  AC2 («unit + smoke + golden»), в плане автотестов («Golden-сценарий с cover
  42 % и выбранным source принимается только через штатный reviewed Linux
  artifact») и в разделе Release-артефактов. Ни один файл `demo/golden/**` не
  тронут: `git diff origin/dev...HEAD --stat -- demo/golden` пуст, в
  `demo/golden/matrix.mjs` нет ни одного маркера с `value_source`. Автор сам
  зафиксировал это в handoff-комментарии: «Локальный golden на Windows дал
  неканонические renderer-различия, baseline не менялся и не принимался»,
  но сценарий не был добавлен вовсе (даже без принятия эталона) — сравнивать
  боту было нечего, а не только «нечего принять».
- **Failure scenario:** будущий рефакторинг рендера `.valtext`/`.valonly`
  (шрифт, обрезка, цвет, позиционирование внутри капсулы) сможет сломать
  именно новый визуальный контракт «явный источник → `42 %` вместо иконки» и
  пройти незамеченным: `npm run golden:verify` в этом PR прогнал 78 сценариев
  зелёным, но ни один из них не рендерит маркер с `value_source`, поэтому
  регресс такого рода этот гейт органически не ловит. Browser-smoke
  (`demo/smoke_value_face_source.mjs`) проверяет только `textContent`
  (`'42 %'` как строку), а не визуальную раскладку — разного рода поломки
  вёрстки капсулы через него не видны.
- **Что делает находку Medium, а не High:** функциональная корректность самого
  значения (форматирование, dash, восстановление, паритет рендереров, rebind,
  import/export) доказана unit+backend+smoke кодом, который умеет падать (см.
  таблицу выше) — рабочего дефекта в текущем поведении нет. Пробел — только в
  будущей защите от визуальной регрессии, для которой ТЗ явно назвало метод
  доказательства, а имплементация его не предоставила. Находка в скоупе
  задачи (тот же файл ТЗ, тот же issue), поэтому по правилу #202 отдельный
  issue не заводится: правится в этой же ветке.
- **Что нужно:** добавить сценарий в `demo/golden/matrix.mjs` (маркер cover с
  `value_source: {kind: 'entity_attribute', entity_id: …, attribute:
  'current_position'}`, ожидаемое `42 %`) и провести штатный Linux-цикл
  capture/accept через `npm run golden:accept -- --reviewed` на CI — именно
  так же, как в этом PR уже был принят `docs screenshots` артефакт
  (`https://github.com/Matysh/houseplan-card/actions/runs/33270679280`).
  Автор физически не может принять корректный baseline с Windows — это не
  повод пропустить шаг, а повод завести его через CI, как и было сделано для
  скриншотов документации в этой же ветке.

### Low — index-таблица `docs/specs/README.md` нарушает сортировку по номеру issue

- **Файл:** `docs/specs/README.md:113`
- **Summary:** новая строка `#378` вставлена между `#90` и `#94`, хотя вся
  остальная таблица строго отсортирована по возрастанию номера issue (…, #90,
  #94, #101, #107, #113, …). Чисто косметическая непоследовательность,
  функционально ни на что не влияет (ссылка и путь верны).
- **Решение ревьюера:** снимается без правки — не блокирует и не входит в
  условия DoD; при следующей правке этого файла можно переставить строку.

## Что проверено и корректно

- **AC1 (список/сохранение).** `valueBadgeCandidates()` используется как
  единственный источник кандидатов и для value badge, и для нового селектора;
  `valueSourceWriteFields()` — тот же паттерн `touched/originalHas/original`,
  что и у `valueBadgeWriteFields()` (auto = отсутствие поля). Доказано unit
  (`test/device-presentation.test.mjs:920+` «persistence keeps untouched data»)
  и smoke (`candidatePresent`, `draftSourceExact`, `savedExact`,
  `reopenedExact`, `cancelKeptSource` — все `true`, прогнано лично).
- **AC2 (результат на всех рендерерах).** `resolveDevicePresentation()` —
  единственная функция, которую вызывают preview, полный план и
  `houseplan-space-card`; `sourceKey`/`text`/`fullText` формируются один раз в
  `resolveValueSource()`. Smoke подтвердил побитовое совпадение `preview42`,
  `plan42`, `static42`, `actionUnchanged` (лично прогнано, зелёное). Golden
  proof отсутствует — см. находку Medium выше.
- **AC3 (паритет formatter).** `resolveValueSource()` — общая функция для
  badge и face; unit-тест «explicit cover position uses the exact
  value-badge formatter» сравнивает `result.valueBadge.text === result.valueText`
  и сверяет источник через `valueBadgeCandidates()` за тем же ключом.
- **AC4 (legacy compatibility).** Явный источник читается только если
  `d.marker?.value_source` truthy; auto-ветка (`resolveValue()` без
  `explicitSource`) байт-в-байт совпадает с прежним кодом путём climate/temp/
  hum/ambiguous/no-state. Тест «explicit unavailable source… without auto
  fallback» отдельно прогоняет `legacy`-маркер без поля и получает
  `valueText: null` (не dash) — подтверждает, что явная и auto ветки не
  смешиваются. F09–F12 фикстуры `device-presentation-policy.test.mjs`
  не тронуты (только добавлен F18), `npm test` зелёный на этом SHA.
- **AC5 (fail explicit).** `resolveValueSource()`: `failure` выставляется
  ровно тогда, когда локальная переменная `text` осталась `null`; финальная
  сборка `text: text ?? '—'`, `fullText: text ?? unavailableText` гарантирует
  их взаимоисключение — dash и диагностический код всегда идут вместе, а не
  вместо друг друга. Убедился мутацией (см. таблицу гейтов): без dash-веточки
  тест валится по пяти полям. `fallbackReason` больше не гасится наличием
  dash-текста (убрано условие `!valueText`) — специально для explicit-ветки,
  где текст `'—'` не `null`, но диагностика должна остаться видимой; для
  auto-ветки это изменение поведенчески нейтрально, там `text` и `fallback`
  всегда взаимоисключающи и без этого условия.
- **AC6 (независимость).** `value_virtual`-проверка (`if (d.virtual) return`)
  стоит раньше чтения `value_source` — приоритет сохранён кодом, а не только
  комментарием. `lqiText` подавляется и при `valueBadge?.isLqi`, и теперь при
  `value.source?.kind === 'derived_lqi'` — покрыто unit-тестом «derived
  sources share the plan graph and suppress duplicate LQI». Duplicate-hint в
  диалоге теперь сравнивает `badgeSourceKey === innerValueSourceKey`, где
  `innerValueSourceKey` берётся из единого `previewPresentation.valueSource.sourceKey`
  вместо ручной реконструкции — то же наблюдаемое поведение, один источник
  строки. Touch/pointer путь не тронут структурно (`_clickDevice` не менялся,
  только текст `.valtext`) — **проверено чтением, не исполнением** отдельного
  touch-смока; логика тапа общая для обоих устройств ввода.
- **AC7 (конфиг и ссылки).** Backend: `validate_source()` — общая функция для
  `value_badge.source` и `value_source`, коды ошибок отличаются префиксом,
  проверено построчно; delta-validation честно различает changed/unchanged
  через `_matching_previous_marker` (rename-tolerant, тест
  «marker reference and id rename are delta-safe»). Import/export:
  `_drop_invalid_import_marker_links`, `_repair_target_space_refs`,
  `build_space_merge`, `create_export` — все четыре точки reference seam
  обновлены параллельно уже существующим для `value_badge`; счётчик
  `MAX_MARKERS * (MAX_CONTROLS + 2)` корректно увеличен на 1 (было `+1` для
  одного возможного badge-дропа на маркер, теперь `+2` для badge и source).
  Frontend rebind: `rewriteMarkerControlReferences()` и `_saveMarker()` id-rename
  оба переписывают `value_source.ref`, тест `devices.test.mjs` это подтверждает.
- **AC8 (preview/Cancel/binding).** Смена binding (оба места: virtual-radio и
  выбор HA-сущности) добавляет `valueSource: null, valueSourceTouched: true` —
  единственная точка сброса, найдена и прочитана в обоих местах. Smoke
  `bindingResetToAuto` и `cancelKeptSource` подтверждают оба направления
  (сброс на смену binding, сохранение при незасейвленной смене source).
- **AC9 (локализация/документация).** i18n: 5 новых ключей + обновление
  `marker.display_hint_value` присутствуют идентично в en/ru/de/fr (сверено
  построчно диффом). Документация: `ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`,
  `DEVICE-PRESENTATION.md` (новая строка F18 с корректной ссылкой на
  `device-presentation-policy-value`/`presentation-row-contract`, обе строки
  существуют как реальные тестовые id), `USER-GUIDE.md`/`.ru.md`,
  оба CHANGELOG — в одном коммите с поведением (`591f8f6a`), трейлер
  `User-Visible: yes` на месте. Docs screenshots пересчитаны после rebase на
  точном SHA `552b78a1` отдельным commit-only-docs коммитом с `User-Visible: no`
  — процессуально корректно.
- **AC10 (гейты и бюджет).** См. таблицу гейтов выше — все обязательные
  зелёные (частично по ссылке на Validate этого SHA, частично лично
  прогнаны).
- **Трейлеры и процесс.** `Issue: #378` на каждом коммите класса A/B/C,
  `User-Visible` расставлен верно, CHANGELOG в том же коммите, что поведение,
  branch `issue/378-value-face-source`, rebase-конфликт (только сгенерированный
  бандл) разрешён и пересобран без orphan chunks — подтверждено побайтовой
  сверкой `bundle-sync` выше.

## Чего не проверял

- Не прогонял 31 слабую связь `smoke-select` с общим именем `_markerDialog`
  (полный список — в выводе инструмента выше): диалог устройства используют
  почти все смоки этого файла не по существу дифа, специфичной для
  `value_source` логики в них нет. Решение — не прогонять, риск низкий.
- Не гонял `npx tsc --noEmit`, `npm test`, `npm run build`,
  `python -m pytest tests_backend -q` повторно — зелёный Validate на точном
  SHA `552b78a1` уже это доказал, код с тех пор не менялся.
- Не выполнял ручное тестирование в браузере (вне процесса, п. «оно вообще
  работает» закрыт код-ревью + автотестами + собственноручно прогнанными
  smoke/golden выше).
- Не проверял visual regression на конкретном golden-сценарии с явным
  `value_source` — он не существует (сама находка Medium).
- Полный performance-профиль не гонял: AC/риски не называют влияние на
  перф, а изменение — O(1) поиск по уже кэшированному графу; принято по
  чтению кода.
