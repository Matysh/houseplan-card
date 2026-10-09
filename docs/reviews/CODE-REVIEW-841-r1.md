# CODE-REVIEW-841-r1

Материал: `c9685232967abf054c6c8a567c625d2d806eef59` (ветка `issue/841-stable-heading`, рабочая копия на нём, `git rev-parse HEAD` сверен). Диапазон: `origin/dev..HEAD`, 1 коммит.
Трек: `track:show`, заход r1, блокирующих циклов 0/2.

## Скоуп

ТЗ (тело issue #841): владелец после зелёного #840 уточнил заголовок stable-анонса —
вместо «Новый релиз - HousePlan X.Y.Z» точно «Релиз Houseplan X.Y.Z» (EN: «Houseplan X.Y.Z release», без New и дефиса). Явно заявленный объём: общий форматтер/валидатор (`stableHeading`),
RU/EN записи 1.78.0/1.79.0/1.80.1, образец, правила PROCESS/AUTHOR/DEVELOPMENT, регрессионные тесты. Абзацы/emoji/ссылки/интервалы/классификация/доставка из #840 — не трогать; исторические review-документы и опубликованные release body — не переписывать; новых релизов и Telegram-отправок нет.

Класс изменения — B/C (`scripts/release-narrative.mjs`, тесты, документация), `src/**` и `custom_components/**` не затронуты. Коммит один, трейлеры `Issue: #841` / `User-Visible: no` — соответствует прецеденту #840 (та же природа правки: релизный инструмент/документация, не рантайм карточки).

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` + bundle-policy) уже подтверждены зелёным Validate на этом SHA (https://github.com/Matysh/houseplan-card/actions/runs/37945803210) — не перегонял.

Прогнано лично в этом раунде (дёшево, по диффу):

| Гейт | Команда | Результат |
|---|---|---|
| Целевые unit-тесты диффа | `node --test test/release-narrative.test.mjs test/user-stable-changelog.test.mjs test/release-contract.test.mjs test/release-notes.test.mjs test/process-digests.test.mjs` | 35/35 PASS |
| Мутационная проверка (AC2, защитный) | откат `stableHeading` к старому тексту «Новый релиз - HousePlan.../New release - HousePlan...», повторный прогон `release-narrative.test.mjs` | 3/8 подтестов покраснели (новый негативный тест и Telegram-тест), файл восстановлен `git status` чист |
| Счётчик тестов (§8, один источник) | `node scripts/inventory.mjs` | `Node unit 4100` — совпадает с правкой `docs/STATUS.md` |
| Легаси release-контракт (AC2: beta/legacy не меняется) | `node scripts/release-notes.mjs v1.80.1 --verify` | PASS, опубликованные notes v1.80.1 не переписаны |
| Документационные гейты | `node scripts/check-docs.mjs --strict`; `node scripts/status-snapshot.mjs --check` | PASS / «snapshot block is current» |
| Трейлеры/класс коммита | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемый WARN (инфра-диапазон, статусная метка не нужна до S7) |

Чтение кода: `scripts/release-narrative.mjs` (`stableHeading`, `validateNarrative`), `scripts/user-stable-changelog.mjs` (`userStableSection`, `composeUserStableNotes`), `scripts/telegram-release.mjs` — проверено чтением, не исполнением, в части путей, не задетых тестами выше.

## Чего не проверял и почему

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` + сверка трёх копий бандла — Validate зелёный на этом SHA, диффа во `src/**` нет, повторный прогон не добавляет информации.
- Браузерные смоки, `golden:verify`, `pytest tests_backend`, `npm run invariants` — в диффе нет кадров отрисовки плана, Python и геометрии; AC задачи их не называет. `ci:golden` не ставился.
- Performance — не упомянут в AC, диффа в рантайме нет.
- Фактическая отправка в Telegram / публикация релиза — вне скоупа задачи (явно исключено в ТЗ), не делалась.

## AC — разбор

**AC1** («RU/EN-источники, stable release body и dry-render Telegram используют новый точный заголовок; все три исторические записи проходят проверки, содержимое после заголовка не меняется»):
- Доказано автотестами: `user-stable-changelog.test.mjs` («approved 1.80.1 example…», «retrospective 1.78/1.79…», Telegram-тест) — зелёные.
- Прочтением подтверждено единство источника: `stableHeading` (`scripts/release-narrative.mjs:9`) — единственное место, где собирается текст заголовка; `userStableSection` (`scripts/user-stable-changelog.mjs:12`) и `validateNarrative` (`scripts/release-narrative.mjs:48`) оба вызывают именно его — нет второй захардкоженной копии строки (§8, «одно число — один источник»).
- Диффом подтверждено «содержимое после заголовка не меняется»: `git diff` по `docs/changelog_user_stable_{ru,en}.md` показывает ровно по 3 замены строки заголовка на файл, остальной текст (абзацы/emoji/ссылки/интервалы) не тронут.
- AC1 — проверено.

**AC2** («прежний заголовок, неправильный регистр HousePlan и неверная локаль отвергаются точной проверкой; beta/legacy release-контракт не меняется»), защитный AC:

| AC | чем доказан | чем краснеет |
|---|---|---|
| Старый заголовок / неверный регистр `HousePlan` / перепутанная локаль отвергаются | `release-narrative.test.mjs`: новый тест «stable title uses the exact owner-approved wording…» (6 отрицательных вариантов: старый RU/EN, `HousePlan` вместо `Houseplan`, перепутанные языки); `user-stable-changelog.test.mjs`: добавленные `assert.throws` на старый заголовок в реальных RU/EN источниках | Я лично откатил `stableHeading` к старой формулировке и перегнал `release-narrative.test.mjs` — 3 подтеста покраснели (включая новый негативный тест), т.е. тест ловит регрессию не только на бумаге |
| Beta/legacy release-контракт не меняется | `release-notes.mjs v1.80.1 --verify` (легаси-контракт, формат бета/leg release notes не трогается `stableHeading`) | Команда прогнана мной лично — PASS без изменений |

AC2 — проверено, третий столбец не пуст, мутация исполнена, а не названа без результата.

**AC3** («образец и правила согласованы, остальные поля сообщения и runtime неизменны») — ревью-AC:
- `PROCESS.md` §11.9, `docs/process/AUTHOR.md`, `docs/DEVELOPMENT.md` и `docs/STATUS.md` переписаны на новую точную формулировку синхронно с кодом (сверено текстом всех файлов).
- Остальные поля сообщения (вводный абзац, emoji-пункты, пустые строки, компактная ссылка на milestone, классификация major/stable-fix, доставка в Telegram) не изменены — подтверждено и диффом, и отдельными тестами из #840, которые остались зелёными без правок их содержательной части (только замена строк заголовка в фикстурах).
- Runtime карточки/интеграции не затронут — diff не касается `src/**`/`custom_components/**`.
- AC3 — проверено.

## Ledger

`docs/release-ledger/v1.80.1/841.json`: `category: infra`, `baseStable: v1.80.1` (совпадает с предыдущим stable), обоснование по существу («уточнение заголовка документации и транспорта… runtime не меняется… опубликованные release body сохранены»). Согласуется с прецедентами того же базового релиза (#838, #840 — тоже `infra` того же `baseStable`). Инфра не входит в пользовательский milestone — корректно, `isUserReleaseEntry` для `infra` не требует `summary.ru/en`, схема валидна (`validateEntry` в `scripts/release-ledger.mjs`).

## Трейлеры и changelog

Коммит `c968523`: `Issue: #841`, `User-Visible: no`. Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правятся в этом же коммите с идентичной по месту и ссылке записью на RU/EN — соответствует правилу синхронного пополнения, даже при `User-Visible: no` (тот же паттерн, что и в предшествующем #840, тоже `infra`/`User-Visible: no` с правками обоих changelog).

## Трек show — критерии §5

Диапазон не продуктовый (B/C), риска по классам нет:
- `complexity` ≤ 3 — текстовая правка одной константы и синхронизация документации.
- `surfaces` — одна поверхность: модуль генерации/валидации stable-анонса.
- `migration` — нет изменений конфигурации или полей совместимости.
- `ux-contract` — анонс релиза не часть UX-контракта карточки; поведение View/редакторов не меняется.
- `perf-touch` — не затронуты.
- `undocumented` — ожидаемый текст прямо продиктован владельцем в теле issue и зафиксирован в PROCESS.md §11.9 этим же коммитом.

Критерии пройдены, `route: fix`.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- Единственный источник истины для текста заголовка (`stableHeading`), используемый и генерацией, и валидацией, и Telegram-путём — нет дублирования строки.
- Три исторических записи (1.78.0/1.79.0/1.80.1) правлены только по заголовку, остальной текст, emoji и ссылки не тронуты (диффом).
- Защитный AC2 подтверждён исполняемой мутацией, а не декларацией.
- Опубликованные release notes v1.80.1 и исторический review-документ #840 не переписаны.
- Документация (PROCESS/AUTHOR/DEVELOPMENT/ARCHITECTURE/STATUS/CHANGELOG×2) синхронно отражает новую формулировку.
- Ledger и трейлеры корректны и согласуются с прецедентом #838/#840.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/841-stable-heading`, коммит `c9685232967a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3d2c028951a9aca1debbd7d79e42f3784543ae72`
  ```
  git log --all --format='%H %T' | grep 3d2c028951a9
  ```
- Тело issue: `eea33504bf410d203561d6e6ddbbf9e353216172e52838295ce8064cebff8a14`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4487 output_tokens=15935 cache_creation_input_tokens=98905 cache_read_input_tokens=1987196 num_turns=38 -->
