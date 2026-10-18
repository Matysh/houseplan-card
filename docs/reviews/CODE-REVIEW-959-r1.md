# CODE-REVIEW-959-r1

Issue: #959 · этап: code · трек: show · заход: r1 · блокирующих циклов израсходовано 0 из 2
Материал: `9e203025f90b46c68be4921e8777380aa21de38d` (рабочая копия на нём, `git rev-parse HEAD` сверен)
Коммиты в материале: `68e7cef55` (fix(docs): reveal device appearance before capturing its preview), `9e203025f` (docs: record ordinary device preview capture recovery)

## Скоуп

Инфраструктурная правка класса B/C: адаптер канонической съёмки документации
(`demo/docs/capture.mjs`) не открывал раздел «Display on plan» / «Отображение
на плане» перед поиском `hp-device-preview`, потому что после переработки
настроек (#947/#955) секции остаются смонтированными с `hidden`, а по
умолчанию открыт раздел `basics`. Плюс старый фиксированный отступ 180px не
помещал выросший до 529px превью в 609px видимой области `.content`.
Без класса A — ускоренный вход в S7 по правилу AGENTS.md/PROCESS.md §1;
продукт (`src/**`) не тронут, что подтверждено `git diff --stat` (ниже).

Изменённые файлы (`git diff origin/dev...HEAD --stat`):
`demo/docs/capture.mjs` (+12/-2), `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/release-ledger/v1.81.0/959.json`,
`docs/analysis/959-doc-preview/{README.md,positive.txt,capture.json,preview.png}`.
Одна механическая поверхность — единственный блок `if (current.devicePresentationPreview)`.

## Как проверялось

1. Прочитан диапазон `git log --oneline origin/dev..HEAD` и полный
   `git diff origin/dev...HEAD` — построчно, весь diff (14 изменённых строк в
   коде, остальное документация/evidence).
2. Прочитан `src/editors/settings-sections.ts` — подтверждено, что
   `data-section-target="<id>"` это реальная кнопка навигации с
   `@click=${() => selectSettingsSection(...)}`, не фиктивный атрибут.
3. Прочитан `src/editors/marker-dialog.ts` (строки 606–809, 888–899) —
   подтверждено, что `hp-device-preview` лежит внутри секции `id: 'appearance'`
   (раздел «Display on plan»), а секция `basics` (index 0) выбрана по
   умолчанию — именно это объясняет исходный симптом (превью скрыто `hidden`).
4. Прочитана вся новая логика в `demo/docs/capture.mjs:144-169`: клик по
   кнопке `appearance`, `focus({preventScroll:true})`, ожидание
   `card.updateComplete`/`frame()`, затем прежний скроллер `.content` с новой
   формулой отступа `Math.min(180, Math.max(0, (scrollerRect.height -
   previewRect.height) / 2))`. Проверено по числам из тела issue: при
   scroller=609, preview=529 новая формула даёт отступ 40px (половина
   свободных 80px), что укладывает карточку целиком; при `previewHeight >
   scrollerHeight` `Math.max(0, …)` даёт 0, и неизменный guard
   (`visiblePreview.top/bottom` против `visibleScroller`) по-прежнему
   отказывает — «чем краснеет» защитного поведения не ослаблен.
5. Прочитан `docs/analysis/959-doc-preview/README.md` и `positive.txt`:
   обычный неизменённый RED на `0031dd58d` (run 39173950661, точная строка
   ошибки `documentation viewport does not show the device presentation
   preview`), затем два полных обычных прогона `capture-determinism.mjs` на
   исправленном `68e7cef55` — 11 сценариев, 12 PNG совпали между прогонами
   (включая `device-display-preview`). Ни один мутант, ручной патч исполняемой
   реализации или её сборки не исполнялся — подтверждено чтением diff и
   evidence-файлов: правка только в `demo/docs/capture.mjs`, `src/**` не
   менялся вообще.
6. Открыт `docs/analysis/959-doc-preview/preview.png` — карточка «Display
   preview · Now» видна целиком от заголовка до таблицы «Golden
   golden-light-two», верхний/нижний край внутри тела диалога, навигация
   «Display on plan» подсвечена активной. Совпадает с заявленным AC1.
7. Прочитан и выполнен точечно `test/capture-determinism-args.test.mjs` —
   тест `#600 кадр превью крутит единственный скроллер hp-dialog` матчит
   regex-блок `if (current.devicePresentationPreview) { … }` по новому телу
   функции (проверено вручную, что regex `[\s\S]*?\n  \}` всё ещё закрывается
   на прежней строке отступа) и требует неизменный `.content`-скроллер:
   `node --test test/capture-determinism-args.test.mjs` → 5/5 PASS.
8. Прогнан `node --test test/release-ledger.test.mjs` → 6/6 PASS (новый
   `docs/release-ledger/v1.81.0/959.json` не ломает схему/контракт).
9. Сверены трейлеры обоих коммитов (`Issue: #959`, `User-Visible: no` на
   обоих) — корректно: поведение продукта не меняется, changelog не требуется.
10. Прочитан `docs/release-ledger/v1.81.0/959.json` и сверен с соседними
    инфра-записями (`949.json`, `954.json`, `958.json`) — тот же schema 1,
    категория `infra`, `rationale` без `summary` (как у прочих infra-записей);
    `introducedBy` не нужен — это не правка внутри-бетной продуктовой фичи, а
    адаптация тестовой фикстуры к уже принятому #955.
11. Сверена ссылка на зелёный Validate на материале `9e203025f`:
    https://github.com/Matysh/houseplan-card/actions/runs/39174765713 — по
    указанию в промпте этот прогон уже подтверждает `tsc --noEmit`, `npm
    test`, `npm run build` + bundle-policy, пересчитывать не стал.

## Находки

Нет High. Нет Medium. Нет Low.

Побочных находок нет. Доверенный снимок политики:
`{"mode":"issues", ...}` — при mode=issues маршрут для Medium вне скоупа — новый
issue; таких находок не возникло, поэтому issue не заводился.

## Что проверено и корректно

- AC1: защитный guard полной видимости (`visiblePreview.top/bottom` против
  `visibleScroller`) не изменён по существу — изменилось только сообщение
  об ошибке (добавлены числовые координаты, что лишь улучшает диагностику) и
  вычисление отступа перед скроллом. Негативный случай (превью не помещается)
  по-прежнему кидает ошибку — доказано чтением формулы (`Math.max(0, …)`
  обнуляет отступ, не компенсируя переполнение) и прямым указанием автора в
  README, что это проверено.
- AC1: реальный `hp-device-preview` используется (без класса A в диффе — он
  и не мог поменяться), раздел действительно открывается кликом по настоящей
  кнопке навигации, а не синтетическим обходом состояния (`appearance.click()`
  вызывает тот же `selectSettingsSection`, что и ручной клик пользователя).
- AC2: названные в AC тесты (`capture-determinism`, `capture-determinism-args`,
  docs acceptance) выполнены автором дважды на исправленном коммите и
  точечно перепроверены мной (`capture-determinism-args.test.mjs`,
  `release-ledger.test.mjs`) — зелёные. Мутанты не исполнялись ни автором,
  ни мной.
- Трейлеры `Issue:`/`User-Visible:` верны на обоих коммитах; `User-Visible:
  no` корректен — видимого пользователю поведения карточка не меняет вовсе,
  правка только в тестовой инфраструктуре документации.
- `docs/release-ledger/v1.81.0/959.json` классифицирован как `infra` —
  корректно: это ремонт фикстуры захвата скриншотов, не пользовательская
  функция и не исправление стабильной линии; не входит в пользовательский
  milestone релиза, согласованно с соседними инфра-записями.
- Объём диффа соответствует заявленному в issue: «Ожидаемые файлы» названы
  автором заранее и совпадают с фактическим diff один в один, лишнего нет.
- Маршрут §5 (track:show): сложность низкая (одна формула отступа + один
  клик по существующей кнопке), одна поверхность (один файл кода,
  `demo/docs/capture.mjs`), миграции конфигов нет, нового UX-контракта нет
  (продукт не тронут), влияния на perf/touch нет, ожидаемое поведение уже
  зафиксировано в самом теле issue и в evidence — все критерии §5 пройдены,
  `route: fix`, `reclassify` не требуется.

## Чего не проверял

- Полный `npm test`/`npx tsc --noEmit`/`npm run build` с тройной сверкой
  бандла не перегонял — Validate на этом точном SHA (`9e203025f`) зелёный
  (run 39174765713), по правилам раунда это достаточно; продуктовый код
  (`src/**`) в диффе отсутствует, так что бандл в принципе не мог измениться.
- `golden:verify`/golden baselines — не запускал: на issue нет метки
  `ci:golden`, diff не касается `demo/golden/**` и не меняет рендер плана;
  изменённый сценарий — это фикстура документации, явно выведенная из
  golden-харнесса (см. комментарий в самом `capture.mjs`: «Keep these
  mutations out of the golden harness»).
- `npm run invariants` — не запускал: геометрия модели и ссылки на неё не
  менялись.
- `pytest tests_backend`/HA harness — не запускал: Python не менялся.
- Полный `node scripts/capture-determinism.mjs` (с реальным Chromium,
  пересчётом всех 11 сценариев) я сам не гонял — принял обычный
  неисполняемый-мной, но воспроизводимый и предъявленный автором прогон
  (positive.txt, capture.json, preview.png, два процесса, 12/12 PNG
  совпали) как действительное доказательство AC1/AC2; это обычный позитивный
  прогон на изменённом коде, не мутант и не замена CI-эталонов (сам автор
  честно пометил PNG как «observation evidence, not replacement baselines»).
  Полный штатный `beta-derived.yml` (pinned oxipng, stability×3, 6 заявленных
  /5 byte-witness сцен) ещё не прогонялся и по тексту issue прогоняется уже
  после независимой приёмки — это не входит в объём код-ревью этого раунда.
- `node scripts/smoke-select.mjs --base <base> --head <head>` отдельно не
  запускал: AC2 уже называет конкретный узкий набор тестов (capture-
  determinism/args/docs acceptance), который и есть релевантный смок для
  единственного тронутого файла; расширять его для чисто инфраструктурной
  правки фикстуры счёл несоразмерным объёму задачи (PROCESS.md §8, трек show).
- Ручную GPU/dev-приёмку владельцем не проводил — по правилам ревью она
  добровольна и не является гейтом.

## Маршрут побочных находок

Доверенный снимок: `mode=issues`. Побочных находок Medium вне скоупа не
возникло, поэтому новые issue не заводились.

## Вердикт

Зелёный. AC1 и AC2 выполнены и доказаны обычными исполненными прогонами
(не статикой и не мутантами); защитный guard не ослаблен; трейлеры и
release-ledger корректны; объём диффа соответствует заявленному B/C-скоупу
без класса A. route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/959-doc-device-preview`, коммит `9e203025f90b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2df845313c8e87dc11dcae053c3dfaea80e5d721`
  ```
  git log --all --format='%H %T' | grep 2df845313c8e
  ```
- Тело issue: `8832420ecc274417b791ad793a742513249df8a7bf3282461b3f2d4e1e53dab4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDAsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjAwMDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2MCwib3V0cHV0X3Rva2VucyI6MTY0ODIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzcwODAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMjI0OTQ1LCJjb3N0VXNkRXN0aW1hdGUiOjAuOTE4MjQ4OTk5OTk5OTk5OX1dLCJ0dXJucyI6NDAsImR1cmF0aW9uTXMiOjIwMzI5MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTIzNDQ5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5160 output_tokens=16502 cache_creation_input_tokens=77080 cache_read_input_tokens=2224945 num_turns=40 -->
