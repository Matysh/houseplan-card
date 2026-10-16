# CODE-REVIEW issue #838 · r1

Материал: `issue/838-stable-changelog` @ `51ce76bc99beb48e237b4ef0145c111abecc847f`
(`git rev-parse HEAD` совпадает). Трек: show, класс B/C, инфраструктурный
ускоренный вход (владелец в теле issue: «Инфраструктурная задача класса B/C:
ускоренный вход по PROCESS»). Заход r1, блокирующих циклов израсходовано 0 из 2.

## Скоуп

Issue #838 перерабатывает правила и исполняемую механику changelog
**стабильных** релизов (развивает #328): агент пишет пользовательский
вводный абзац + 1–5 пунктов крупных фич + опциональный абзац исправлений;
состав доказывается диапазоном `previous-stable..candidate` и авторской
классификацией (`major`/`infra`/`stable-fix`/`line-fix`) каждой влитой
задачи; milestone релиза получают только `major`/`stable-fix`; Telegram
передаёт русский авторский текст без обрезания и без англ. дубля.
Продуктовый runtime и опубликованный v1.80.1 не меняются — это J-строку
`docs/SCOPE.md` не затрагивает: задача инфраструктурная, обслуживает сам
процесс поставки, а не один из core user jobs.

Дифф: 24 файла, +914/-96. Новые скрипты `scripts/release-ledger.mjs` (161),
`scripts/release-narrative.mjs` (82), `scripts/telegram-release.mjs` (49);
правки `scripts/merge-candidate.mjs`, `scripts/release-contract.mjs`,
`scripts/release-notes.mjs`; `PROCESS.md` §11.9 (новая), `docs/DEVELOPMENT.md`
(раздел Release переписан), `docs/STATUS.md`, `docs/process/AUTHOR.md`,
`docs/process/REVIEWER.md`, `test/process-digests.test.mjs`; данные
`docs/release-ledger/cycle.json` + четыре `docs/release-ledger/v1.80.1/*.json`;
воркфлоу `.github/workflows/_process.yml`, `announce.yml`, `release.yml`;
тесты `test/merge-candidate.test.mjs` (+62), `test/release-ledger.test.mjs`
(новый, 78), `test/release-narrative.test.mjs` (новый, 73),
`test/release-contract.test.mjs` (+46). `src/**`, `custom_components/**`,
`dist/**`, `www/**` не тронуты — продуктовый код и бандл вне диффа.

**Вопрос маршрута (§5).** Диффу не хватает «одна поверхность» по числу
файлов, но подсказка аналитика явно относит инфраструктуру к `show` по
умолчанию (таблица §5, колонка «Для чего» track:show: «инфраструктура (§1)
по умолчанию»), а остальные пункты подсказки пройдены предметно, не
формально:
- **complexity** — риск ограничен тестами с явными негативными случаями на
  каждую защитную ветку (ниже) и fail-closed дизайном (отсутствующая/устаревшая
  классификация останавливает слияние, а не угадывается); риск по сути
  процессный, не продуктовый — опубликованный v1.80.1 неприкосновенен.
- **surfaces** — формально много файлов, но это один предмет: учёт релизных
  фактов + их публикация, типичная форма инфраструктурной задачи (скрипт +
  тест + процессный документ). Прецедент — #839 (r1) ровно так же тронул
  несколько поверхностей и остался на `show`; там Medium был не за
  multi-surface, а за протащенный файл ЧУЖОГО issue (#838) в скоуп #839 —
  здесь наоборот, #838 — его законный дом, подтверждено его же ревью (ниже).
- **migration** — нет нового поля/ключа в конфиге карточки, пользователь его
  не видит; `docs/release-ledger/**` — внутренний учёт конвейера, не продукт.
- **ux-contract** — не меняется ни одна видимая пользователю поверхность.
- **perf-touch** — не затронуто.
- **undocumented** — ожидаемое поведение зафиксировано в теле issue (владелец
  лично написал «Требования»/«Приёмка») и теперь — в `PROCESS.md` §11.9 и
  `docs/DEVELOPMENT.md` › Release, добавленных этим же диффом.

Решаю: `route: fix`, задача не реклассифицируется — ни один пункт подсказки
предметно не провален для инфраструктурной задачи этого типа.

## Как проверялось

Validate на `51ce76bc` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/37915480716) —
`typecheck`/`npm test`/`npm run build` + сверку бандла не перегонял.

| Гейт | Прогнан | Результат |
|---|---|---|
| Validate (ссылка выше) | нет, принят по SHA | success — дешёвые гейты подтверждены |
| `node --test test/release-ledger.test.mjs test/release-narrative.test.mjs test/release-contract.test.mjs test/release-notes.test.mjs test/merge-candidate.test.mjs test/process-digests.test.mjs test/monolith-text-anchors.test.mjs` | да | 75 pass / 0 fail (сам прогнал, не со слов автора) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | «Исполняемого frontend-диффа нет» — браузерные смоки этим диффом не выбираются |
| `node scripts/release-ledger.mjs catalogue --candidate=HEAD --tag=v1.81.0` | да | состав #638/#674/#838/#839, все `infra`, `userIssues: []` — совпадает слово в слово с авторским отчётом |
| `gh api repos/Matysh/houseplan-card/milestones/3` | да | `title: "1.81"`, `state: "open"` — совпадает с `cycle.json` |
| `npm run inventory` | да | Node unit 4092 — совпадает с `docs/STATUS.md` после правки |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | да | гейт пройден, 1 ожидаемое предупреждение (инфра-диапазон без статусной метки до S7 — штатно) |
| `git diff --check origin/dev...HEAD` | да | 0 |
| `git diff origin/dev...HEAD --stat -- dist/ www/` | да | пусто — бандл класса D не тронут |
| `git log origin/dev..HEAD --format='%B'` | да | оба коммита несут `Issue: #838` и `User-Visible: no`; changelog-файлы действительно не правились (согласовано: продукт не меняется) |
| pytest tests_backend / HA-harness | нет | `custom_components/**` не тронут |
| golden / browser-смоки / Chromium | нет | issue не называет смоук; рендер карточки не затронут |
| Инварианты модели (`npm run invariants`) | нет | геометрия не тронута |
| Мутанты | нет | трек `show`: не гоняются в разработке (поимку проверяет ночь, #709) |

## AC — чем доказано, чем краснеет

| AC | Доказательство | Чем краснеет (негативный случай в самом тесте) |
|---|---|---|
| AC1 (классификация до слияния, идемпотентный milestone, без повторного merge при сбое API) | `test/merge-candidate.test.mjs`: «missing classification stops dev push», «milestone/comment API failure... cannot cause S6 or a second merge», «trusted realOps reads classification from accepted git blobs» | Явные throws/assert.fail: `checkReleaseEntry` кидает → push не происходит (`!calls.some(push)`); `recordReleaseMilestone` кидает после успешного push → `result.merged===true`, `to==='S8-merged'`, ровно 1 push, `releaseWarning` содержит команду восстановления; второй вызов `recordReleaseMilestone` на реальном git не делает второй PATCH (`writes===1`) |
| AC2 (состав диапазоном previous-stable..candidate, не User-Visible/S8/бета; отсутствующая/устаревшая классификация — отказ) | `test/release-ledger.test.mjs` целиком; лично прогнанный `release-ledger.mjs catalogue` против реального репозитория | `catalogueFromCommits` кидает `/Invalid release classification/` без записи; `readCatalogue` кидает `/Missing classification/`, `/Cycle target/`, `/latest reachable/`; `validateEntry` кидает на `Stale`/пустом `rationale`/неполном `summary`/без `introducedBy` |
| AC3 (mixed/fixes-only/infra-only формат, ссылки, предел Telegram, тесты) | `test/release-narrative.test.mjs`, `test/release-contract.test.mjs` (новый фикстур-тест «real candidate contract»), `test/merge-candidate.test.mjs` (announce.yml assertions) | `validateNarrative` кидает на чужой/внутри-бетный/неклассифицированный issue, bullet не в конце строки, >5 пунктов, несовпадение RU/EN, смену `base`-маркера, развёрнутый URL; `telegramPayload` кидает на небезопасной ссылке, не-GitHub хосте, превышении `TELEGRAM_LIMIT`, пререлизе; фикстурный тест реально гоняет `assertReleaseContract` и ловит `/exact authored/` при разошедшемся changelog и `/agent must shorten/` при переполнении |

Все три защитных AC проходят требование §2.7: третий столбец непустой, и я
лично выполнил часть негативных веток (throws), а не принял их со слов автора.

## Проверено и корректно

- `scripts/merge-candidate.mjs` — `checkReleaseEntry`/`recordReleaseMilestone`
  track-агностичны (без `track`-условий в файле): это сознательно применяется
  ко всем будущим задачам, что совпадает с AC1 владельца («классификация
  каждой новой задачи проверяется перед вливанием»), а не самодеятельность
  реализации.
- `telegram-release.mjs`: HTML-экранирование (`&`,`<`,`>`,`"`) применяется до
  вставки ссылок, протокол/хост ссылки проверяется (`https://github.com`,
  без credentials) — безопасно от HTML-инъекции и утечки токена в тексте.
- Единственный источник `TELEGRAM_LIMIT = 4096` (`scripts/telegram-release.mjs:7`);
  другие вхождения `4096` в репозитории (`support-relay`, `smoke-links`,
  `resize.test.mjs`) — из другого домена, не дублируют это число.
- `docs/release-ledger/v1.80.1/838.json` и `839.json` — ровно то место, на
  которое указало ревью #839 r1 (Medium M1: файл `839.json` там был
  незаявленной поверхностью #838); в #838 он теперь закономерно живёт вместе
  с механизмом и потребителем, как это ревью и потребовало.
- `release-contract.mjs`: legacy-формат (`## Основное`/`## Highlights`)
  остаётся доступен только для уже опубликованного `cycle.baseStable`
  (`v1.80.1`) — новый стабильный релиз не может молча откатиться на старый
  формат.
- Трейлеры `Issue: #838` / `User-Visible: no` на обоих коммитах; `no`
  корректен — ни один файл `docs/CHANGELOG*.md` в диффе не изменён, и
  поведение продукта/интеграции действительно не меняется.
- `docs/STATUS.md` («Node unit... 4092») совпадает с живым
  `npm run inventory` — число не разошлось с источником.
- Бандл (`dist/`, `www/`) не тронут — не нарушено правило «D меняется только
  в коммите с `Release:`».

## Чего не проверял

- Полный `npx tsc --noEmit`, весь `npm test`, `npm run build` со сверкой трёх
  копий бандла — не перегонял: Validate зелёный на точном SHA материала
  (ссылка выше), а дифф не трогает `src/**`/бандл.
- Живой переход цикла релиза (что реально произойдёт сразу после публикации
  v1.81.0 — открытие следующего cycle.json, первый коммит после тега) — не
  исполнялся, т.к. релиз не выпускался; проверено только чтением
  (`readMergeEntry` кидает `has shipped`, если тег уже смёржен) и это
  осознанный fail-closed дизайн, а не находка.
- Реальная отправка в Telegram / `test dispatch` — не запускал (сетевых
  вызовов в ревью не делал); проверены только чистые функции экранирования,
  лимита и payload.
- `pytest tests_backend` / HA-harness — дифф не касается `custom_components/`.
- Golden / browser-смоки — дифф не трогает рендер карточки, `smoke-select`
  подтверждает «смоки не выбираются».
- Согласие владельца на итоговую формулировку текста будущего v1.81.0 —
  сам текст релиза этим диффом не пишется, только механика его проверки.

## Вердикт

Зелёный. High 0, Medium 0. Маршрут `fix` — ни один критерий §5 не провален
предметно для инфраструктурной задачи этого типа (см. «Вопрос маршрута»
выше). Все три AC доказаны автотестами с проверенной способностью падать;
числа и факты сверены исполнением, а не приняты на слово автора.

## Материал раунда

- Ветка: `issue/838-stable-changelog`, коммит `51ce76bc99beb48e237b4ef0145c111abecc847f`
- Диапазон: `origin/dev..HEAD`, 2 коммита
- Прогон гейтов: см. таблицу выше

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/838-stable-changelog`, коммит `51ce76bc99be` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `52bccbcc0b19f4ff1f22c94ece6b583c204e68fb`
  ```
  git log --all --format='%H %T' | grep 52bccbcc0b19
  ```
- Тело issue: `a2c95567d2c5373dbdba31840e96131526e07d6099d7acc53f0807d6475cb11f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4375 output_tokens=39507 cache_creation_input_tokens=127784 cache_read_input_tokens=2913369 num_turns=45 -->
