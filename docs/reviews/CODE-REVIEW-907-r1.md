# CODE-REVIEW-907-r1

Материал: `af6affeb1a4389be1aea1c6e9fe11c895501a76a` (1 коммит над `origin/dev@ca33dbd7`).
Трек: `ask`. Заход r1, блокирующих циклов 0/4. ТЗ принято: SPEC-REVIEW-907-r2 (зелёный),
body sha256 `37f7facf6e3f686d80d7bf686785b92bbab6ae8d5c4fb7707574cc8608b9032d` — тело issue
на момент этого ревью совпадает.

## Скоуп

Три presentation seams без изменения ACL/cleanup/schema/geometry:

- **AC1** — превью устройства в открытой форме маркера наследует effective
  card locale от формы (а не только язык HA), включая explicit override/auto
  и живую смену языка.
- **AC2** — ранний guard записи позиции (`houseplan-card.ts:5382`), бросавший
  `Error` без `.code`, теперь даёт `code: 'context-changed'`, который проходит
  через существующий общий `configWriteErrorKey`-маппер и показывает понятный
  RU/EN toast вместо сырого английского текста; запись/успех не подделываются.
- **AC3** — `ownerName` в `space-reference-repair.ts` Optimize больше не читает
  унаследованные ключи прототипа (`constructor`/`toString`/`__proto__` и
  т. п.) через `names[id]`, а только собственные строковые свойства; fallback
  и classification не меняются.

Соответствует `docs/SCOPE.md` — полировка диагностики/UX для админ-поверхности
(Editors), без расширения прав или данных.

## Как проверялось

Validate на `af6affeb` зелёный (https://github.com/Matysh/houseplan-card/actions/runs/38792427157) —
принят как подтверждение `tsc`/`npm test`/`npm run build`+bundle-policy. Ниже —
то, что Validate не покрывает и было прогнано дополнительно в этом раунде.

| Гейт | Команда | Результат |
|---|---|---|
| Build+bundle sync (для смоков) | `npm run bundle:sync` | PASS, 25.7s |
| AC1 смок | `HP_SMOKE_CHECKS=1 node demo/smoke_device_preview_parity.mjs` | PASS, 33/33 checks, включая `haEnCardRu907`/`haRuCardEn907`/`haRuAuto907`/`haEnAuto907` |
| AC2 смок (RU) | `HP_SMOKE_CHECKS=1 node demo/smoke_placement_context_message.mjs` | PASS, toast = «…Контекст Home Assistant изменился. Повторите действие.», 1 вызов (`layout/delete`), сервер не изменился |
| AC2 смок (EN) | то же | PASS, toast = «…Home Assistant context changed. Try again.» |
| `smoke-select.mjs --base ca33dbd7 --head af6affeb` | — | 19 прямых совпадений — совпадает со списком автора; все 19 входят в предыдущий зелёный прогон (не перепрогонялись отдельно, т.к. не затронутый этим раундом набор и уже зелёные в последнем push-гейте автора) |
| Unit `config-write-context.test.mjs` + `space-reference-repair.test.mjs` | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test …` | PASS, 43/43 |
| i18n parity | `node --test test/i18n.test.mjs` | PASS, 27/27 |
| `tsc --noEmit` (повторная проверка) | — | PASS, exit 0 |
| Статический mutation-gate | `node scripts/mutation-gate.mjs --check` | exit 0; три новые декларации `ok`; `execution=0` (ночь единственная среда исполнения, не прогонялась и не должна была) |
| release-ledger ancestry | `git merge-base --is-ancestor 36b5a8c36 v1.80.1` / `2a8302f4d` / `c4dca1b46` | 0 / 0 / 1 — подтверждает классификацию `907.json` независимо от текста автора |
| Рабочая копия после | `npm run bundle:clean` + `git status --short` | чисто, D-артефакты не коммитились |

### Чего не проверял и почему

- Полный `npm test`/`npm run build`/`gate:small` целиком — покрыты зелёным
  Validate на этом SHA (§8, «дешёвые гейты уже подтверждены»); перепрогонять
  не требовалось. Вместо этого прогнаны только задетые юнит-файлы и две
  AC-смоки впрямую.
- Остальные 17 из 19 «прямых совпадений» smoke-select — не перепрогонялись
  отдельно: этот дифф не трогает их область (`_config`/`_loadOk`/`_serverStorage`
  используются вскользь, не по существу семантики), они уже зелёные в
  последнем push-гейте автора (`gate:small`, полный `npm test` в составе).
  Риска по ним не увидел при чтении диффа.
- `golden:verify` — нет метки `ci:golden`, diff не трогает рендер/геометрию.
- `pytest tests_backend` — Python не менялся.
- `npm run invariants` — геометрия/ссылки на неё не менялись.
- Performance — не назван в AC, скоуп ТЗ прямо заявляет «без нового
  scan/polling/timer/hot path», подтверждено чтением диффа (только выбор
  locale/mapping/own-property lookup).
- Исполнение зарегистрированных mutation-свидетелей (`device-preview-ignores-
  effective-card-locale`, `placement-early-refusal-loses-human-context-code`,
  `optimize-owner-name-trusts-inherited-string`) — не исполнялись сознательно:
  общая политика разрешает это только в ночном workflow; проверена только их
  статическая корректность (`--check` exit 0, уникальный `find`, патч
  действительно откатывает к старому поведению при чтении кода).

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | `demo/smoke_device_preview_parity.mjs`, живой прогон выше — HA=en/card=ru, HA=ru/card=en, auto×2, парная проверка parent-label и child heading/facts | Declaration `device-preview-ignores-effective-card-locale` (guard = тот же смок) зарегистрирована и статически валидна; не исполнялась (политика §2.7/#905) |
| AC2 | `test/config-write-context.test.mjs` (юнит-маппер) + `demo/smoke_placement_context_message.mjs` (реальный early refusal через зарегистрированную relocation-очередь и публичный HA-gap, RU и EN), прогнаны выше, PASS | Declaration `placement-early-refusal-loses-human-context-code` зарегистрирована и статически валидна; не исполнялась |
| AC3 | `test/space-reference-repair.test.mjs`, 24-кейсовая матрица (`constructor`/`toString`/`__proto__` × 8 вариантов значения), прогнана выше, 43/43 PASS | Declaration `optimize-owner-name-trusts-inherited-string` зарегистрирована и статически валидна; не исполнялась |

## Находки

Нет High. Нет Medium. Низкая/формальная находка не заведена — ничего не нашёл,
заслуживающего даже Low: дифф строго соответствует заявленному скоупу ТЗ,
изменения точечные (ровно одна строка кода на каждый из трёх симптомов плюс
переносимый i18n-ключ), регресса в соседнем поведении не увидел.

Owner-инструкция в комментариях issue («НОВЫЕ ISSUE НЕ ЗАВОДИТЬ», multiple
timestamps 2026-10-15) к этому вердикту неприменима — Medium вне скоупа не
обнаружен, заводить нечего.

## Что проверено и корректно

- **AC1**: единый источник языка. `marker-dialog.ts:779` передаёт
  `langOf(this.host.hass, this.host._config?.language)` — тот же вызов,
  которым форма сама вычисляет `_t` (`houseplan-card.ts:5923` и другие
  вызовы `langOf(this.hass, this._config?.language)`). `hp-device-preview.ts`
  использует `this.language ?? langOf(this.hass)` — родитель всегда передаёт
  значение, а автономный preview (без свойства) сохраняет прежний HA-only
  fallback, как того требует контракт ТЗ. §8 «одно число — один источник»
  выполнено: нет второго вычисления, которое могло бы разойтись.
- **AC2**: `houseplan-card.ts:5382` — единственное место из шести throw-сайтов
  с одинаковым `Object.assign(new Error('config authority changed'), { code:
  'context-changed' })` (`houseplan-editor-runtime.ts:1637`,
  `houseplan-card.ts:5412/7739/7744/7764` уже имели `.code` до этой задачи),
  которое не имело кода — это ровно F-BATCH-005, подтверждает точность скоупа
  находки. `configWriteErrorKey` (`config-write-context.ts:13`) — минимальное
  добавление одной ветки без изменения остальной логики; `_errText`
  (`houseplan-card.ts:9529`) — существующий общий маппер, новый код не
  создаёт отдельный путь. i18n-строки во всех 4 словарях (de/en/fr/ru)
  соответствуют UX-формулировке ТЗ дословно.
- **AC3**: `space-reference-repair.ts:336-339` — `own(names, id)` (существующая
  утилита `Object.prototype.hasOwnProperty.call`, уже использовалась в этом же
  файле на строке 316/361) гарантирует, что только собственное свойство
  читается; нестроковые собственные значения (number/object) отбрасываются
  через `typeof entry === 'string'`; name/fallback/`value !== id` ветки
  сохранены без изменений. 24 кейса теста покрывают все три ключа прототипа
  (`constructor`/`toString`/`__proto__`) × 8 значений, включая проверку
  неизменности classification, config и layout (as input и output).
- **Release-ledger**: классификация `docs/release-ledger/v1.80.1/907.json`
  (`stable-fix` для F-BATCH-004/017, `line-fix introducedBy:#890` для
  F-BATCH-005) подтверждена независимым `git merge-base --is-ancestor`, не
  доверием к тексту issue.
- **Трейлеры/changelog**: один коммит, `Issue: #907`, `User-Visible: yes`,
  оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом
  же коммите, текст по существу совпадает с ledger summary.
- **Документация**: `docs/USER-GUIDE.md`/`.ru.md`, `DEVICE-PRESENTATION.md`,
  `ARCHITECTURE.md`, `STATUS.md`, `DEVELOPMENT.md` — термины («display
  preview», «эффективный язык карточки») согласованы с уже принятой
  терминологией USER-GUIDE, не изобретены заново.
- **Объём изменений** соответствует заявленному «не-скоупу»: ACL, eligibility,
  cleanup, schema, миграции, geometry, performance — не тронуты (подтверждено
  чтением полного диффа, 24 файла, +269/-10 по `git diff --stat`).

## Вердикт

Зелёный. AC1–AC3 доказаны исполняемыми свидетелями (смоки/юниты) и
зарегистрированными (но не исполненными — политика §2.7/#905) mutation-
witness; release-ledger и трейлеры корректны; документация и i18n
согласованы с ТЗ и USER-GUIDE. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/907-presentation-locale`, коммит `af6affeb1a43` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b937d6eb83f4d13a933dca1851e151ef4a26f599`
  ```
  git log --all --format='%H %T' | grep b937d6eb83f4
  ```
- Тело issue: `37f7facf6e3f686d80d7bf686785b92bbab6ae8d5c4fb7707574cc8608b9032d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3MjksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODE4OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTAwLCJvdXRwdXRfdG9rZW5zIjoyNjI0MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMjE5NDQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo1MTQ5NDc1LCJjb3N0VXNkRXN0aW1hdGUiOjEuNzgwMzAxMDAwMDAwMDAwNH1dLCJ0dXJucyI6NjUsImR1cmF0aW9uTXMiOjQwOTU3MiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNzg1MTIwMDAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4829 output_tokens=26261 cache_creation_input_tokens=121944 cache_read_input_tokens=5149475 num_turns=65 -->
