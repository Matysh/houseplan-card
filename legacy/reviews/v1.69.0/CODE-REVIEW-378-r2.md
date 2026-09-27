# CODE-REVIEW-378-r2

- **Issue:** #378 — «Значение + состояние»: выбор источника значения, как у бейджа
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4 до этого вердикта
- **SHA материала:** `e524f07ddecf81c3e6f8cbd6e64775ff97b69d26` (`git rev-parse HEAD`
  сверен непосредственно перед подведением итогов)
- **Диапазон дельты:** предыдущий вердикт (r1) получен на `552b78a134026f08...`;
  дельта — `552b78a1..e524f07d` (`git diff 552b78a1..e524f07d`)
- **Полный диапазон:** `origin/dev...HEAD` = `6e1d9364..e524f07d`; `origin/dev`
  не сдвинулся с r1 (`git merge-base origin/dev HEAD` = `6e1d9364`) — ребейза
  не было, полный повторный разбор не требуется
- **Спецификация:** `docs/specs/378-value-face-source.md`, ревью ТЗ зелёное
- **Предыдущее код-ревью:** `docs/reviews/CODE-REVIEW-378-r1.md` — жёлтый,
  High: 0, Medium: 1 (в скоупе)
- **Вердикт:** зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

## Скоуп разбора

Дельта локальна и мала: два коммита, оба вне `src/**`:

- `dbbe94ae` — `demo/golden/matrix.mjs` (+19 строк, новый сценарий),
  `test/golden-matrix.test.mjs` (+18 строк, структурный тест), плюс
  пересобранные bundle-копии (см. ниже почему).
- `e524f07d` — `docs/images/06-device-editor.png`,
  `docs/images/09-device-info.png`, `docs/images/screenshots.json`
  (пересъёмка после смены source fingerprint).

`origin/dev` не двигался, поведенческий контракт не менялся, новая подсистема
не задета, объём дельты много меньше исходной задачи → разбор ведётся по
дельте, а не заново, per PROCESS.md §2.9.

Единственная находка r1 (Medium: golden-доказательство AC2 отсутствует) —
предмет этого раунда. Всё остальное — унаследовано.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium — AC2 не доказан golden-сценарием: ТЗ трижды требует golden-проверку явного источника (`cover.current_position=42` → `42 %`), но `demo/golden/**` не был тронут в r1 | В `dbbe94ae` добавлен сценарий `device-value-face-cover-source-dark` в `demo/golden/matrix.mjs`: маркер `golden-left-linkquality` переопределён на `binding: 'entity:cover.golden_door_half'`, `display: 'value'`, `value_source: {kind: 'entity_attribute', entity_id: 'cover.golden_door_half', attribute: 'current_position'}`, `stateOverrides` даёт `current_position: 42`. `test/golden-matrix.test.mjs` (+тест «explicit cover value-source golden pins the 42 percent value face») проверяет структуру сценария построчно. `GOLDEN_MATRIX_VERSION` поднят 50→51 | `demo/golden/matrix.mjs:496-514`, `test/golden-matrix.test.mjs:591-607`. Лично прогнал `node --test test/golden-matrix.test.mjs` — 43/43 зелёных; смутировал `attribute: 'current_position'` → `'wrong_attribute'` — тест честно упал (`not ok 26`, diff показывает ожидаемое/полученное значение); откатил мутацию, дерево чистое. Лично прогнал `npm run golden:capture -- --scenario=device-value-face-cover-source-dark` и визуально проверил PNG-кадр: капсула показывает ровно `42 %` на изолированном маркере — контракт AC2 выполнен буквально |

Baseline в `demo/golden/baselines/**` сознательно не принят разработчиком —
это верно по процессу, не пропуск: PROCESS.md §6 (таблица ролей) прямо
запрещает роли «Разработчик» «принимать golden»; принятие эталонов относится к
предрелизному окну между `S8-merged` и выпуском (§11.4). Ревьюер тоже не
принимает golden — не входит в роль «Ревьюер кода» (§6). Проверить AC2 без
принятого baseline можно и нужно ручным просмотром снятого кадра — это и
сделано (см. таблицу выше).

## Унаследовано из r1

Из `docs/reviews/CODE-REVIEW-378-r1.md` (документ на SHA `552b78a1`) принято без
повторной проверки — дельта этого раунда их не задевает:

- **AC1** (список источников/сохранение) — `valueBadgeCandidates()`,
  `valueSourceWriteFields()`, unit+smoke доказательства.
- **AC3** (паритет formatter badge/face) — общий `resolveValueSource()`.
- **AC4** (legacy-совместимость) — auto-ветка байт-в-байт прежняя.
- **AC5** (fail explicit: dash + диагностика) — мутационная проверка
  выполнена в r1.
- **AC6** (независимость от лица virtual/derived_lqi) — приоритет в коде,
  не только в комментарии.
- **AC7** (backend-валидация и reference seam: rewrite/rebind/export/import) —
  `validate_source()`, `_drop_invalid_import_marker_links`,
  `_repair_target_space_refs`, счётчик `MAX_MARKERS*(MAX_CONTROLS+2)`.
- **AC8** (preview/Cancel/binding reset) — единственная точка сброса
  `value_source` на смену binding.
- **AC9** (локализация 4 языков, документация в том же коммите,
  `User-Visible: yes` + оба CHANGELOG) — сверено построчно в r1.
- **AC10** (гейты и бюджет на SHA `552b78a1`) — Validate зелёный
  (`https://github.com/Matysh/houseplan-card/actions/runs/33270791009`),
  smoke/golden лично прогнаны ревьюером r1.
- Трейлеры и процесс на коммите `591f8f6a`/`552b78a1`.

Обоснование доверия: ни один из этих ACs не завязан на файлы, тронутые
дельтой r2 (`demo/golden/matrix.mjs`, `test/golden-matrix.test.mjs`,
`docs/images/**`). Функциональный код (`src/**`, `custom_components/**/*.py`)
не менялся ни байтом между r1 и r2 — подтверждено самой дельтой
(`git diff --stat 552b78a1..e524f07d`, нет ни одного файла `src/**` или `*.py`).

## Как проверялось (r2)

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `python -m pytest tests_backend -q` | не гонял — код не менялся | `git diff --stat 552b78a1..e524f07d` не содержит `src/**` и `custom_components/**/*.py`; на неизменном коде результат тот же, что доказан в r1 на SHA `552b78a1` |
| `npm test` (включая новый `golden-matrix.test.mjs`) | **прогнал лично** | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/golden-matrix.test.mjs` → 43/43 passed; полный `npm test` на этом же содержимом кода уже зелёный на CI (см. ниже) |
| Тест «explicit cover value-source golden…» умеет падать | **проверил** | мутация `attribute: 'current_position'` → `'wrong_attribute'` дала честный `not ok` с диагностическим diff; откат вернул зелёный прогон и чистое дерево (`git status --short` пуст) |
| `node scripts/check-docs.mjs` (диф трогает docs/images) | **прогнал** | `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/bundle-sync.mjs` + сверка копий | **прогнал** | `git status --short` пуст после синка — `dist/`, `custom_components/.../frontend`, `demo/srv/assets` побайтово совпадают |
| `node scripts/bundle-budget.mjs` | **прогнал** | initial View `277941 B` при бюджете `300000 B` |
| `npm run golden:capture -- --scenario=device-value-face-cover-source-dark` | **прогнал, визуально проверил кадр** | статус `missing-baseline` (ожидаемо — эталон не принят по процессу); PNG открыт лично — капсула показывает `42 %`, кадр не пуст и не обрезан |
| `node scripts/smoke-select.mjs --base 552b78a1 --head HEAD` | **прогнал** | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются — выбирать нечего»; браузерные смоки в этом раунде не прогонялись — инструмент сам подтвердил отсутствие связи, а не то, что связь пропущена |
| Полный `npm run golden:verify` (78+1 сценариев) | не гонял повторно целиком | не требуется: единственный новый сценарий проверен точечно (`golden:capture --scenario=...`) визуальным просмотром; остальные 78 не зависят от этой дельты и уже зелёные в r1 (`https://github.com/Matysh/houseplan-card/actions/runs/33270791009`) и повторно в CI-прогоне автора на этом же коде (`https://github.com/Matysh/houseplan-card/actions/runs/33271690654`, 142 passed / 1 missing-baseline — расхождение только по новому, ещё не принятому сценарию) |
| `npm run invariants -- --config <…>` | не требуется | дельта не трогает геометрию/ссылки (только тестовый маркер в data-only golden-фикстуре, не влияет на модель проекта) |
| Полный performance-профиль | не требуется | AC не называют влияние на перф, дельта не трогает горячие пути |

### Разбор CI-статусов на промежуточных SHA (важное уточнение)

Автор сослался на «Validate на `e524f07d` завершился success»
(`https://github.com/Matysh/houseplan-card/actions/runs/33271765594`). Это
верно буквально, но проверил его смысл отдельно, потому что он вводит в
заблуждение при поверхностном чтении: в этом прогоне job'ы `frontend`,
`golden`, `smoke`, `backend` — **все `skipped`** (реюз/классификация путей:
коммит `e524f07d` трогает только `docs/images/**`, которые не входят в
`sourceFingerprint`). То есть этот конкретный зелёный прогон НЕ является
источником доказательства для tsc/unit/build/golden — только для
`check-docs`.

Источник для тех гейтов — прогон на `dbbe94ae`
(`https://github.com/Matysh/houseplan-card/actions/runs/33271690654`): job
`Фронтенд: типы, юниты, мутанты, синхрон бандла` = success (tsc, `npm test`,
bundle-sync/no-new-any все прошли), job `Golden` = failure (ожидаемо:
`missing-baseline` для одного нового сценария — это не дефект, это
единственно возможный результат `verify`-режима при непринятом эталоне), job
`Документация` = failure (`screenshot source fingerprint is stale` — именно
это чинит следующий коммит `e524f07d`). Итоговый `conclusion: failure` этого
прогона — ожидаемое и корректное поведение процесса, а не красный флаг:
golden не может стать зелёным до приёмки эталона, а приёмка — вне роли
разработчика и вне роли ревьюера (§6, §11.4).

Поскольку код (`src/**`, `*.py`) идентичен между `dbbe94ae` и `e524f07d`
(докс-коммит их не трогает), а `sourceFingerprint` тоже совпадает (докс вне
корпуса отпечатка), гейты tsc/unit/build, зафиксированные зелёными на
`dbbe94ae`, действительны и для HEAD `e524f07d` без повторного прогона.

## Находки

Нет находок High или Medium.

### Low — нет новых. Low из r1 (`docs/specs/README.md:113`, нарушение
сортировки по номеру issue) не тронут этой дельтой и остаётся снятым решением
ревьюера r1 без правки — повторно фиксировать нечего.

## Что проверено и корректно

- Новый golden-сценарий `device-value-face-cover-source-dark` синтаксически и
  семантически корректен: `binding: 'entity:cover.golden_door_half'` — валидный
  и уже используемый в этом же файле формат биндинга (`src/devices.ts:75-76`,
  `src/device-inbox.ts:177`), `cover.golden_door_half` — существующая fixture-
  сущность (`demo/fixtures/visual-matrix.mjs:155-156`, уже используется как
  `contact` стены в этом же матриксе). Форма `value_source` совпадает буква в
  букву с типом `{kind: 'entity_attribute'; entity_id; attribute}`
  (`src/types.ts:102`), `current_position` числится в
  `VALUE_BADGE_ATTRIBUTES.cover` (`src/device-value-badge.ts:13`) и форматируется
  как процент — то есть сценарий бьёт ровно в тот путь кода, который тестирует
  AC2, а не в косвенный.
- Приём `markerOverrides` + `deviceOnly` для превращения существующего id
  маркера в изолированный тестовый маркер — не новый паттерн: тот же приём уже
  используется в этом файле сценарием `device-icon-state-table-*`
  (`demo/golden/matrix.mjs:569-585`) на том же id `golden-left-linkquality`.
  Коллизии между сценариями нет: каждый сценарий строит независимую копию
  конфигурации (`prepareGoldenFixture`), `deviceOnly` изолирует рендер одним
  маркером.
- Пересборка трёх копий бандла (`dist/`, `custom_components/.../frontend`,
  `demo/srv/assets`) с новым `__HOUSEPLAN_SOURCE_FINGERPRINT__` в `dbbe94ae` —
  ожидаемый побочный эффект: `scripts/source-fingerprint.mjs` намеренно
  включает `demo/golden/**/*.mjs` (кроме `accept.mjs`/`policy.mjs`) в корпус
  отпечатка (комментарий в файле, #344) — правка `matrix.mjs` обязана
  поменять fingerprint и, значит, пересобранный бандл. Сверка
  `bundle-sync.mjs` подтвердила побайтовое согласие копий на HEAD.
- Докс-скриншоты (`06-device-editor.png`, `09-device-info.png`,
  `screenshots.json`) пересчитаны корректно: `sourceFingerprint`/`sourceSha256`
  синхронно обновлены везде, `imageSha256` поменялся только у двух реально
  изменившихся PNG (разница в несколько байт — согласуется с перерисовкой из-за
  смены встроенного build fingerprint, не визуальная регрессия — сам
  `check-docs.mjs` подтверждает согласованность инструментально).
- Трейлеры `Issue: #378`, `User-Visible: no` на обоих коммитах дельты —
  корректно: поведение не менялось, changelog не требуется.

## Чего не проверял

- Не прогонял `npx tsc --noEmit`, `python -m pytest tests_backend -q`,
  полный `npm run build` повторно на HEAD — код (`src/**`, `*.py`) не менялся
  с `552b78a1`/`dbbe94ae`, где эти гейты уже зафиксированы зелёными (см.
  таблицу и разбор CI-статусов выше).
- Не прогонял ни один `demo/smoke_*.mjs` — `smoke-select.mjs` сам подтвердил
  отсутствие исполняемого frontend-диффа; выбирать было нечего, а не
  пропущено с риском.
- Не прогонял полный `npm run golden:verify` по всем 78+1 сценариям заново —
  78 старых не задеты дельтой и уже дважды зелёные (r1-ревью и авторский прогон
  на `dbbe94ae`), новый проверен точечно личным просмотром кадра.
- Не принимал и не буду принимать `demo/golden/baselines/**` — вне роли
  ревьюера (§6); это релиз-менеджерское действие в окне `S8-merged` →
  выпуск (§11.4).
- Не выполнял ручное тестирование в браузере вне golden/smoke-инфраструктуры.
- Полный performance-профиль не гонял — дельта не создаёт новых горячих
  путей (только data-only тестовая фикстура).

## Вывод

Единственная находка r1 закрыта по существу и лично перепроверена: новый
golden-сценарий синтаксически верен, бьёт точно в контракт AC2, структурный
тест умеет падать, а визуальный кадр лично просмотрен и показывает `42 %`.
Baseline не принят намеренно и корректно по процессу (не ошибка). Дельта вне
этого — только докс-пересъёмка, мотивированная и подтверждённая
инструментально. Новых находок нет. Вердикт — зелёный.
