# CODE-REVIEW-840-r1

Материал: `9ef1980c0c631513300955a3c8514a770502f02f` (единственный коммит в
диапазоне `origin/dev..HEAD`, ветка `issue/840-user-stable-changelog`).
Заход r1, трек `track:show`, класс — инфраструктура (B/C), продуктовый
runtime (`src/**`, `custom_components/houseplan/**`) не тронут.

## Скоуп

Продолжение #838: вместо хранения авторского stable-текста внутри
`docs/RELEASE-NOTES.md`/язык-маркеров в техническом changelog заведены два
отдельных источника правды — `docs/changelog_user_stable_ru.md` и
`docs/changelog_user_stable_en.md` — с утверждённым владельцем форматом
(заголовок «Новый релиз - HousePlan X.Y.Z», emoji+bold вместо bullet, пустые
строки между блоками). `docs/RELEASE-NOTES.md` для стабильного релиза
становится механической проекцией этих файлов; Telegram читает тот же RU-файл
напрямую и рендерит `##`-заголовок как `<b>`, без старого
`🏠 houseplan-card vX.Y.Z … [Релиз](url)`-обёртывания. Технические/бета
changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) не меняют назначения.
Добавлена ретроспективная запись 1.78.0/1.79.0 (из milestones 6/5) и
сохранён утверждённый образец 1.80.1 — опубликованные release body не
переписываются. Попутно исправлен deadlock `release-notes.mjs` CLI на
циклическом top-level await при динамической загрузке `release-ledger.mjs`.

Diffstat: 18 файлов, только `scripts/**`, `test/**`, `docs/**`
(`docs/release-ledger/v1.80.1/840.json`, `docs/changelog_user_stable_{ru,en}.md`
— новые файлы). Соответствует заявленному classification `infra` в ledger.

## Как проверялось

Прочитан полный diff (`git diff origin/dev...HEAD`) по каждому изменённому
файлу: `scripts/user-stable-changelog.mjs` (новый), `release-narrative.mjs`,
`release-contract.mjs`, `release-notes.mjs`, `telegram-release.mjs`, все три
тестовых файла, оба новых пользовательских changelog целиком, ledger-файл,
PROCESS.md §11.9, DEVELOPMENT.md › Release, ARCHITECTURE.md, STATUS.md,
AUTHOR.md. Логика ключевых функций (`userStableSection`,
`composeUserStableNotes`, `validateNarrative`, `assertReleaseContract`,
`markdownToTelegram`/`telegramPayload`) разобрана построчно — «проверено
чтением, не исполнением» зафиксировано отдельно по каждому пункту ниже, где
исполнение не добавляло уверенности сверх чтения.

Исполнением проверено:
- Сам прогнал `node --test test/user-stable-changelog.test.mjs
  test/release-narrative.test.mjs test/release-contract.test.mjs` —
  24/24 PASS.
- Сам прогнал `node scripts/status-snapshot.mjs --check` — «snapshot block is
  current» (подтверждает число Node unit 4099 в STATUS.md регенерировано, а не
  вписано руками — единственный источник, §8).
- Сверил ретроспективные списки issue милстоунов 1.78.0/1.79.0 через
  `gh api .../milestones/{6,5}` (заголовки совпали: 1.78.0/1.79.0) и
  `gh api search/issues?q=...milestone:1.78.0|1.79.0` — totals 26 и 16,
  точно равны длине массивов `eligible` в
  `test/user-stable-changelog.test.mjs` (строки 49–52). Классификацию
  major/stable-fix внутри списка не перепроверял постатейно — это
  редакторское решение владельца, зафиксированное в теле issue.
- Прочитал содержимое `docs/changelog_user_stable_ru.md`/`_en.md` целиком —
  заголовки, пустые строки, emoji+bold, компактные ссылки и завершающая
  ссылка на milestone соответствуют контракту из тела issue.

Не прогонял повторно (приняты по ссылке на зелёный Validate на этом SHA,
п. «Чего не проверял»): `npx tsc --noEmit`, полный `npm test` (4099 тестов),
`npm run build` + сверка трёх копий бандла.

## Гейты — что прогнано, что нет и почему

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, полный `npm test`, `npm run build`+bundle-policy | зелёный | Validate на `9ef1980c`, https://github.com/Matysh/houseplan-card/actions/runs/37924448503 — дешёвые гейты подтверждены, повторно не гонял |
| `node --test` по трём изменённым тестовым файлам | зелёный, прогнал сам | 24/24 PASS (см. выше) |
| `node --test` по полному набору из 5 файлов (34 теста) | не перегонял, принял | заявлено автором: 34/34 PASS |
| `node scripts/status-snapshot.mjs --check` | зелёный, прогнал сам | «snapshot block is current» |
| `node scripts/check-docs.mjs --strict` | не перегонял, принял | заявлено автором: PASS |
| `node scripts/process-gate.mjs --issues --report` | не перегонял, принял | заявлено автором: PASS, ожидаемое предупреждение infra-без-S |
| `git diff --check` | не перегонял, принял | заявлено автором: PASS |
| `npm run invariants` (геометрия) | не прогонял | AC не затрагивает геометрию/конфиг плана — гейт неприменим |
| `pytest tests_backend` / HA-harness | не прогонял | Python/интеграция не изменены — гейт неприменим |
| `smoke-select.mjs`, golden, performance, Chromium-смоки | не прогонял | исполняемого frontend-диффа нет, демо/`src/**` не тронуты, задача не называет смоук — по #696 Chromium не нужен |
| Сверка milestones 1.78.0/1.79.0 через `gh api` | зелёный, прогнал сам | см. выше |

Полные наборы (golden, performance, HA-harness) — предрелизный гейт, здесь не
нужны: diff не касается рендера плана, geometry, touch или Python.

## Находки

Обе находки — Low, бухгалтерия/мёртвый код, без пользовательского дефекта и
без незакрытого AC; на `track:show` Low не образует цикла и не возвращается
автору (REVIEWER.md «Трек show»). Снимаю обе записью ниже, без доработки в
этом заходе.

1. **Low — недостижимая защитная ветка в `composeUserStableNotes`**
   (`scripts/user-stable-changelog.mjs:38`): проверка
   `if (ru.baseStable !== en.baseStable) throw new Error('RU/EN user changelog
   previous stable must agree')` не имеет падающего теста и фактически
   недостижима при существующих вызовах. Оба вызывающих места
   (`release-contract.mjs:180`, `release-notes.mjs:211`) всегда передают явный
   `baseStable`; при этом `userStableSection` для каждого языка уже бросает
   `"... has no matching previous stable marker"` раньше, чем управление
   дойдёт до этой строки, как только `base[1] !== baseStable` хоть для одного
   языка. Рассинхрон RU/EN реально ловится — но другим сообщением и раньше по
   стеку, а не этой строкой; заявленный в AC2 «негативный случай на
   рассинхрон» в тестах покрывает лишь расхождение файла с явным
   `baseStable` (`test/user-stable-changelog.test.mjs:42`), а не ветку
   `ru.baseStable !== en.baseStable` саму по себе. Пользователь не видит
   дефекта: поведение корректно при любом вызове, это лишний недостижимый
   код, не наблюдаемый регресс.
2. **Low — мёртвый экспорт `changelogVersionBody`**
   (`scripts/release-contract.mjs:133`): до этого коммита использовался в
   `assertReleaseContract` и в `test/release-narrative.test.mjs`; этот коммит
   убрал оба использования (заменив на `readUserStableNotes`/exact-match), но
   саму функцию и её экспорт не удалил. Проверил `grep -rn
   changelogVersionBody` по всему репозиторию — единственное вхождение
   осталось в файле объявления. Не влияет на поведение, кандидат на удаление
   в следующей мелкой правке.

## Что проверено и корректно

- **AC1** (отдельные RU/EN файлы с образцом 1.80.1 и ретроспективой
  1.78.0/1.79.0, явный момент добавления записи, технические changelog
  продолжаются): подтверждено чтением обоих файлов целиком + коммит в
  DEVELOPMENT.md/PROCESS.md/AUTHOR.md/STATUS.md, фиксирующий «новая запись —
  при подготовке stable, не на каждую задачу/бету»; `docs/CHANGELOG.md`/`.ru.md`
  получили только информационный пункт про перенос источника, их техническая
  функция не заменена (видно по diff — старые версии разделов остаются).
  Доказано тестом `user-stable-changelog.test.mjs` (точные regex на структуру,
  количество блоков `split(/\n\n(?=emoji)/).length === 6`, отсутствие старых
  bullet/`## Основное`/`## Highlights`) + сверкой issue-списков 1.78.0/1.79.0
  против реальных milestone через `gh api` (см. выше).
- **AC2** (контракт проверяет точное RU/EN-соответствие release body, emoji,
  заголовок, интервалы, классификацию, compact links, Telegram-лимит;
  негативные случаи; бета-контракт не ломается):

  | AC | Чем доказан | Чем краснеет |
  |---|---|---|
  | Точное RU/EN-совпадение release body с авторским источником | `assertReleaseContract` (`release-contract.mjs:178-183`) + `release-contract.test.mjs` позитивный путь | `write('docs/RELEASE-NOTES.md', mixed.replace('Двигайте стены.', 'Несогласованный текст.'))` → `/exact authored/` |
  | Ровно одна секция на тег, нет дублей/пропусков языка | `userStableSection` (`user-stable-changelog.mjs:9-23`) | `compose({ changelogRu: \`${ru}\n${ru}\` })` → `/exactly one/`; `compose({ changelogEn: en.replace(tag, 'v1.80.0') })` → `/exactly one/`; отдельно — отсутствующий en-файл в release-contract.test.mjs (`'# Missing English release'`) → `/exactly one/` |
  | Точный заголовок и пустая строка после него | `userStableSection`/`validateNarrative` heading-проверки | `compose({ changelogEn: en.replace('New release', 'Новый релиз') })` → `/exact release heading/`; `check(mixed.replace('## Новый релиз - HousePlan 1.81.0\n\n', ''))` → `/release heading/` |
  | Только emoji+bold-пункты, не старые bullet-списки | `/^\s*(?:...|[-*] )/` в `validateNarrative` | `check(mixed.replaceAll('🧱 **Новая возможность.**', '- Новая возможность.'))` → `/bullet lists/` |
  | 1–5 пунктов, покрытие issue совпадает с каталогом major | `isFeature`/`bulletIssues` сверка в `validateNarrative` | тест с 6 пунктами → `/1–5/`; `for (const n of [2,3,4,999]) ... issueLink(n)` → `/classified major/` |
  | Пустая строка между всеми блоками | новый тест «tight feature spacing» | `check(spaced.replaceAll('\n\n🔋', '\n🔋'))` → `/blank line/` |
  | Совпадение базового релиза (`<!-- base -->`) | `userStableSection` baseStable-проверка | `compose({ changelogRu: ru.replace(baseStable, 'v1.78.0') })` → `/previous stable/`; `check(mixed.replace('<!-- base: v1.80.1 -->', '<!-- base: v1.79.0 -->'))` → `/previous stable/` |
  | Telegram-лимит (4096 UTF-16) | дозированный рендер в `assertReleaseContract`/`telegramPayload` | `installNotes(mixed.replaceAll(..., 'я'.repeat(TELEGRAM_LIMIT)))` → `/agent must shorten/` |
  | Рассинхрон RU/EN `baseStable` внутри `composeUserStableNotes` | — | **не реддится своей веткой** (см. находку Low №1) — на практике закрыт другим сообщением на уровень ниже, AC не нарушен, но третья колонка для этой конкретной строки кода пуста |
  | Бета-контракт не изменился | `validateVersionSources`/`validateReleaseNotes` non-narrative-ветка — diff их не касается | `test/release-contract.test.mjs` сохранил прежние beta/prerelease-тесты (строки ~45-81, ~262+) без изменений, сам файл не трогал эти блоки |

- **AC3** (Telegram — полный RU-текст из пользовательского источника, bold/
  links/blank lines, без лишнего заголовка; publishing/HACS — тот же текст;
  тесты не шлют сообщений): подтверждено чтением `telegramPayload`/
  `markdownToTelegram` (замена `## heading` → `**bold**` → `<b>`, ссылки → `<a>`,
  никакого `🏠 houseplan-card vX.Y.Z`/`[Релиз](url)`-обёртывания — `url`
  полностью убран из сигнатуры) и тестами `'Telegram keeps the approved
  heading...'`, `'Telegram CLI reads only the RU user source...'` (оба
  используют `spawnSync` на временной рабочей копии — реальных сообщений не
  шлют, подтверждено также `assert.doesNotMatch(payload.text, /TECHNICAL
  CONTENT/)` при постороннем `docs/RELEASE-NOTES.md`). Негативный CLI-путь
  (`writeFileSync(... '# No selected release')`) проверен: `missing.status !==
  0`, `/exactly one/` в stderr; само отсутствие записи payload-файла явной
  ассерцией не проверяется, но гарантировано структурой кода — `writeFileSync`
  payload вызывается только после успешного `telegramPayload(...)` в одном
  `try`-блоке (`telegram-release.mjs:49-55`), так что бросок исключения всегда
  предшествует записи файла.
- Трейлеры коммита: `Issue: #840`, `User-Visible: no` — корректно: это
  изменение формата release-процесса/tooling, а не продуктового поведения
  карточки; `docs/CHANGELOG.md`/`.ru.md` правятся в этом же коммите как обычная
  техническая запись (это не требует `User-Visible: yes` — технический
  changelog фиксирует все классы изменений, включая infra).
- Ledger `docs/release-ledger/v1.80.1/840.json`: `category: "infra"`,
  `baseStable: "v1.80.1"` — соответствует текущему `cycle.json`
  (`baseStable: "v1.80.1"`), обоснование по существу (разделение документации и
  транспорта, runtime не меняется); `introducedBy` не требуется — это не
  починка новой бета-функции.
- Одно число — один источник (§8): STATUS.md «Node unit 4099» регенерирован
  `status-snapshot.mjs`, не вписан руками (сам перепроверил). Release body и
  Telegram-текст теперь имеют единственный источник —
  `docs/changelog_user_stable_{ru,en}.md`; ровно это и было целью задачи
  (устранить прежнее дублирование текста между `RELEASE-NOTES.md` и
  changelog-файлами), и контракт (`assertReleaseContract`) теперь ловит
  расхождение по точному `===`-сравнению, а не по эвристике.
- Побочная починка (не являющаяся AC): deadlock `release-notes.mjs` CLI на
  top-level await при динамической загрузке `release-ledger.mjs` — исправлена
  оборачиванием в `async function main()` вместо top-level `await` в теле
  модуля; тест `'release-notes CLI verifies immutable published metadata
  without circular top-level-await deadlock'` реально запускает CLI
  (`spawnSync`) и проверяет отсутствие `/unsettled top-level await/` в stderr —
  это не бутафорский, а падающий при регрессии тест (сам прогнал, зелёный).

## Критерии трека show (route)

- `complexity` — низкая: расширение существующего contract/narrative-модуля,
  без новых алгоритмов; ≤ 3.
- `surfaces` — одна поверхность: конвейер подготовки/публикации stable-релиза
  (release-notes/release-contract/release-narrative/telegram-release +
  новый модуль-экстрактор), не продуктовый UI.
- `migration` — нет: ни конфига карточки, ни compatibility-полей не касается.
- `ux-contract` — новый видимый формат release body/Telegram-анонса есть, но
  он дословно зафиксирован владельцем в разделе «## Контракт» тела issue
  (заголовок, emoji+bold, пустые строки, compact links, отсутствие старого
  заголовка) — контракт уже документирован в самом отчёте, доработка не
  изобретает поведение.
- `perf-touch` — не затронуто.
- `undocumented` — не применимо, см. `ux-contract`.

Все критерии §5 пройдены → `route: fix`.

## Чего не проверял

- Не перегонял `npx tsc --noEmit` и `npm run build`+bundle-policy — приняты по
  зелёному Validate на этом SHA.
- Не перегонял полный `npm test` (4099 тестов) — положился на Validate +
  собственный точечный прогон трёх изменённых файлов (24/24) и заявленный
  автором прогон 34/34 по пяти файлам.
- Не перепроверял постатейно классификацию major/stable-fix внутри
  ретроспективных списков 1.78.0/1.79.0 (кроме сверки итоговых количеств с
  `gh api`) — это редакторское решение владельца по тексту issue, не
  проверяемый техническими средствами факт.
- Golden/performance/HA-harness/pytest/invariants — не прогонял, гейты
  неприменимы (нет изменений в `src/**`, Python, геометрии, демо).
- Не проверял реальную отправку в Telegram или публикацию GitHub release —
  вне скоупа задачи и вне возможностей ревью (нет сети/секретов, тесты и сами
  не отправляют сообщений).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/840-user-stable-changelog`, коммит `9ef1980c0c63` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ae5a6d3932e56e1607172f16e362dfcead6a6c45`
  ```
  git log --all --format='%H %T' | grep ae5a6d3932e5
  ```
- Тело issue: `6ef88c0d7027619926484e688c42b5cd1e1db4bb37c98d682f297ce4f446a30c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4497 output_tokens=32904 cache_creation_input_tokens=115362 cache_read_input_tokens=2934424 num_turns=39 -->
