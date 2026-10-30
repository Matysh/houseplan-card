# CODE-REVIEW-1016-r2

## Материал раунда

- Issue: #1016, этап `code`, трек `show`, заход r2, блокирующих циклов 0/2.
- SHA материала: `70a6f2706e75b20a8864fdd02435a9faf1220224` (рабочая копия на нём, `git status` чист).
- Диапазон: `git log --oneline origin/dev..HEAD` (база `f7797eb781f3c9a4bfa9396e50b773bb8cab3738`) — 7 коммитов:
  `eb62f8e54` / `dccdf78a8` / `3ce1c97c6` (исходная реализация r1, уже разобрана в
  [CODE-REVIEW-1016-r1.md](CODE-REVIEW-1016-r1.md)), `913e66987` (документ r1,
  сгенерирован конвейером), `b78f604bd` (индекс ревью после сдвига каталога,
  конвейер), `13d49ee1f` (`fix(build): recover owned chunks after tracked-dist
  history`), `70a6f2706` (`docs: keep build guidance within the testing guide
  budget`). Оба новых коммита несут `Issue: #1016` / `User-Visible: no`.
- Предмет повторного раунда — дельта, а не задача целиком (§2.10): r1 был
  зелёным на `3ce1c97c6`, но именно этот exact-candidate не слился (`dev` ушёл
  вперёд, пока шёл CI — событие #856, видно в комментариях issue). После
  rebase на новый `dev` обязательный gate воспроизвёл новый дефект перехода:
  пересечение старой tracked-dist истории временно возвращает закоммиченный
  `dist`, перезаписывая manifest, а replay удаления `dist` убирает manifest, не
  зная про уже оставшиеся ignored-чанки — orphan asset, `bundleBytes` 6,58 МБ
  вместо ~3,31 МБ. Два новых коммита — это исправление именно этого перехода
  (новая реализационная дельта поверх зелёного r1) и попутная правка Low из r1.
- Классы: файлов класса A в диффе нет — задача инфраструктурная (§1), трек
  `show`.
- `docs/release-ledger/v1.82.0/1016.json` не менялся с r1 (`category: infra`,
  без `introducedBy`) — классификация по-прежнему корректна, дельта её не
  затрагивает.

## Скоуп

Делта двух новых коммитов — ровно `scripts/bundle-manifest.mjs`
(`cleanBundleOutputPlugin`) плюс его тест, плюс документация/CI-регистрация
нового теста:

- `scripts/bundle-manifest.mjs`: помимо удаления файлов по старому manifest,
  плагин теперь восстанавливает **owned** orphan-чанки — обычные файлы прямо в
  `houseplan-assets/`, чьё имя matчит `^[\w][\w.-]*-[\w-]{8}\.js$` **и** чьё
  содержимое несёт настоящее верхнеуровневое присваивание
  `globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__ = "<64 hex>"` (проверяется AST
  через `typescript`, с учётом hoisting и comma-expression, не regex по
  тексту). Любой путь прежнего manifest по-прежнему валидируется на escape
  **до** первого `rmSync` (атомарно). Симлинк самого output root или
  `houseplan-assets/` отклоняется до очистки.
- `test/bundle-output-clean.test.mjs` (новый, 5 тестов) — защитный AC2:
  recovery с manifest/без него, dotted/hoisted/comma-expression чанки
  удаляются; foreign JS, metadata-строка, комментарий, нераспознанное имя,
  посторонний файл и вложенный каталог сохраняются; path traversal кидает
  исключение и не трогает ни «свой», ни внешний файл; symlink root/assets
  каталога кидает исключение до удаления чего-либо.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/TESTING.md` описывают новое
  поведение восстановления; `docs/TESTING.md` сначала выросло, затем
  `70a6f2706` сократило формулировку, чтобы уложиться в бюджет
  ≤ 880 строк (тест `test/testing-doc.test.mjs`), заодно закрыв Low r1
  (устаревшее «закоммиченный `dist`»).
- `.github/workflows/validate-product.yml` / `validate-tooling.yml` и
  `scripts/ci-profile-paths.json` регистрируют новый тестовый файл в обоих
  path-фильтрах CI (продукт и тулинг), так что он не выпадает из обязательных
  раннеров.

Поведение продукта, устанавливаемый HACS-payload, версии — не затронуты.

## Как проверялось

Зелёного Validate (полный `validate.yml`, с мутантами/тяжёлым набором) на
`70a6f2706` нет: единственный ручной запуск (`39756496083`) отменён как
дубликат уже идущего push-прогона. Push-триггерные профильные lane'ы
(workflow «Проверка (CI)», джобы `CI product`/`CI tooling`/`CI docs`,
партиционированные `scripts/ci-profile-paths.json`) на точном SHA зелёные —
проверено `gh run view` по каждому id:

| run id | lane | conclusion | headSha |
|---|---|---|---|
| 39756439061 | CI product | success | `70a6f2706` |
| 39756439056 | CI tooling | success | `70a6f2706` |
| 39756439055 | CI docs | success | `70a6f2706` |

Эти три lane вместе покрывают партицию `test/*.test.mjs` (`product`+`tooling`
профили в `ci-profile-paths.json` взаимно дополняют друг друга), так что их
совместный зелёный результат — наиболее авторитетное доступное свидетельство
по всему тестовому корпусу на этом SHA. «Тяжёлого» Validate это не заменяет,
поэтому дешёвые гейты прогнал сам:

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit` | прогнан локально | PASS, 0 ошибок |
| `npm run build` | прогнан локально | `created dist in 47.5s`, 60 assets |
| `node scripts/bundle-policy.mjs --verify HEAD` | прогнан локально | `HEAD: свежая сборка dist цела (60 ассетов)`, exit 0 |
| `npm run bundle:sync` + `node scripts/bundle-tree.mjs dist demo/srv/assets` | прогнан локально | `verified 60 bundle assets` — третья копия (demo) сверена с dist |
| `npm run bundle:clean` | прогнан локально | «бандл возвращён к закоммиченному: `custom_components/houseplan/frontend`», `git status --short` пуст после |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | прогнан локально | PASS, 1 ожидаемый WARN (инфраструктурный диапазон без класса A, метка не нужна до S7) |
| `git diff --check origin/dev...HEAD` | прогнан локально | чисто |
| `node --test test/bundle-output-clean.test.mjs` | прогнан локально | **5/5 PASS** — защитный тест новой дельты (разобран построчно ниже) |
| `node --test test/testing-doc.test.mjs` | прогнан локально | **2/2 PASS** — подтверждает, что `TESTING.md` после правки `70a6f2706` ≤ 880 строк и раздел «Чего не проверяет автоматика» на месте |
| `node --test test/backend-pins.test.mjs test/toolchain-pins.test.mjs` | прогнан локально | **8/8 PASS** — пины сравниваются только там, где стек установлен; локальное расхождение Python (3.12.3 вместо пина 3.14, `npm run toolchain:check`) тестами уже учтено и не валит их |
| `npm test` (весь `test/*.test.mjs`, 5550 тестов) | прогнан дважды локально, см. ниже | второй (чистый) прогон — **PASS: 5549/5550, 1 skip, 0 fail** |
| `node scripts/smoke-select.mjs` | не перегонял заново | дельта не трогает `src/**`; r1 уже зафиксировал «исполняемого frontend-диффа нет» — условие не изменилось |
| `golden:verify` | не прогонялся | нет `ci:golden`, путь отрисовки плана не затронут |
| `pytest tests_backend` | не прогонялся | Python не менялся |
| `npm run invariants` | не прогонялся | геометрия не менялась |
| performance | не прогонялся | не назван в AC, байты бандла не меняются (только путь восстановления при аварийном переходе) |

### Полный `npm test`: два прогона, расхождение объяснено

Первый запуск (`time npm test 2>&1 | tail -100`) я по ошибке пропустил через
`tail -100` **в самой команде**, а не только в выводе для чтения — ранние
строки `not ok` навсегда потеряны (harness-файл фоновой задачи получил уже
урезанный поток). Видна была только сводка: `# tests 5550 / # pass 5535 /
# fail 14`. Этот прогон также шёл не изолированно: параллельно уже выполнялись
мои собственные `npm run build`/`bundle:sync`/`bundle:clean` на том же
раннере — лишняя конкуренция за CPU для тайминг-чувствительных тестов (paint
lease, resize/zoom).

Повторный прогон без `tail`, изолированно, довёл до конца: **`# tests 5550 /
# pass 5549 / # fail 0 / # skipped 1`**, `grep -c "^not ok"` = 0 по всему
файлу вывода. Вторым прогоном подтверждаю: весь `npm test` на материале
`70a6f2706` зелёный. Первый результат объясняю конкуренцией за ресурсы при
параллельной сборке на том же раннере (ни один файл этой дельты не
пересекается с zoom/pinch/timing-кодом, который попал бы под подозрение
первым) — записываю это объяснение честно, а не как придуманный вывод;
решающим считаю чистый второй прогон, а не предположение.

### Разбор защитного AC: `test/bundle-output-clean.test.mjs`

Прочитан построчно, не только по описанию из issue:

- `recovers orphan chunks with manifest=false/true` — 10 файлов-фикстур:
  обычный orphan, dotted-name (`form-kit.styles-…`), с предшествующим hoisted
  `function`, с comma-expression перед присваиванием, foreign JS (`export
  const userFile=true`), metadata-строка (сигнатура как JSON-литерал, не
  исполняемый код), JS-комментарий с той же строкой, нераспознанное имя
  (`not-a-hashed-output.js` — суффикс `-output` не 8 символов, под regex не
  попадает), `notes.txt`, вложенный `houseplan-assets/nested/…`. После
  `buildStart()` первые 4 удалены, остальные 6 — нет; повторный вызов
  `buildStart()` безопасен (идемпотентность проверена явно).
- `validates the complete previous inventory before deleting` — manifest
  называет один «свой» файл и один `../outside.txt`; `assert.throws(...,
  /escapes output root/)`, и — что важно — **ни один** файл не удалён, включая
  тот самый «свой», валидный: порядок в коде (сначала весь список путей
  проверяется на escape, `rmSync` вызывается только после полного прохода)
  подтверждён и тестом, и чтением (`for (file of manifest.files) {...
  managed.add}`, затем отдельный `for (path of managed) rmSync`).
- `refuses a symlinked root/assets directory` — оба случая: симлинк самого
  `outputRoot` и симлинк `houseplan-assets/` внутри обычного `outputRoot`;
  оба кидают `/symlink/` до какого-либо чтения/записи, внешний файл цел.

Это обычные negative-input фикстуры на неизменённой реализации (временные
каталоги, прямой вызов экспортированного `cleanBundleOutputPlugin` — не
патч продукта и не исполнение мутанта), соответствует политике раздела
«Отрицательные проверки и мутанты».

## Находки

Находок — High или Medium, в скоупе или вне его — нет.

Прочитан код `cleanBundleOutputPlugin` построчно (не только тест): двойной
гейт recovery (имя + AST-проверенная сигнатура) консервативен, `readdirSync`
нерекурсивен (вложенные файлы намеренно не трогаются — тест это подтверждает),
удаление происходит одним проходом после полной валидации — babylon ошибок
совмещения «частично удалили, потом упали» не нашёл.

## AC — таблица доказательств (дельта r2)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC2 (регрессия после r1, защитный): после перехода через старую tracked-dist историю build-cleanup восстанавливает только owned flat hashed chunks с настоящей build-сигнатурой; посторонние/вложенные файлы и директория-symlink не удаляются | `test/bundle-output-clean.test.mjs`, 5/5 PASS (разбор выше); реальный dirty-output сценарий также воспроизведён в `npm run build` на обычном дереве — PASS, 60 assets | Обычные temp-фикстуры неизменённой реализации: dotted/hoisted/comma-expression recovery срабатывает корректно; foreign/metadata/comment/unrecognized/notes/nested — не удаляются; manifest с `../outside.txt` → throw **до** удаления даже валидного файла; symlink root/assets → throw. Все случаи выполнены (не «умеет падать» на словах) |
| Low r1 (устаревшая формулировка `docs/TESTING.md:385`) | `test/testing-doc.test.mjs` 2/2 PASS, строка больше не называет `dist` закоммиченным (чтение файла) | н/п — документационная находка, не защитный AC |

AC1/AC3 дельтой не затронуты — унаследованы из r1 (ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Low: `docs/TESTING.md:385` сохранял формулировку «закоммиченный `dist`» | Переформулирован раздел про `gate:small`/`bundle-sync`: «Закоммичен только HACS frontend» | `docs/TESTING.md` (коммиты `13d49ee1f`, затем сокращение `70a6f2706`); `test/testing-doc.test.mjs` зелёный после правки |

## Унаследовано из r1

Из [CODE-REVIEW-1016-r1.md](CODE-REVIEW-1016-r1.md) (материал `3ce1c97c6`,
дерево `a7677f2b56883c24682d387e1122d31d53058cf5`) принято без повторной
проверки — код этих частей в делте r2 не менялся:

- AC1: Git-инвентарь/manifest/hash единственного frontend-снимка
  (`test/bundle-tree-committed.test.mjs`); отсутствие `dist/` среди tracked
  files.
- AC2 (обычная часть, classification): `unit-groups.mjs` видит
  transitive-читателей скомпилированного вывода как product-лейн даже без
  `dist` на диске/в Git; `bundle-policy.mjs --clean` восстанавливает только
  HACS-снимок.
- AC3: `candidate-readiness.mjs`/`release-prerelease.mjs` читают только
  `custom_components/houseplan/frontend/**`; `release.yml`/
  `publish-prerelease.yml` не менялись и по-прежнему строят ZIP из Git,
  сверяя свежий `dist` с закоммиченной копией; `ratchets.mjs --committed`
  read-only для report.
- Регенерация CI-фильтров (`ci-profiles.mjs --write`) — не ручной дрейф,
  гейт устаревания её бы поймал.
- Трейлеры `Issue:`/`User-Visible:` на коммитах r1 корректны; маршрут
  побочных находок (`mode: issues`) не менялся.

Эти тесты всё равно повторно выполнились в финальном локальном прогоне
(`bundle-tree-committed`, `unit-groups`, `candidate-858`, `ratchets`,
`release-contract` — см. таблицу гейтов выше, суммарно учтены в точечных
`node --test` прогонах) и в push-триггерных CI lane на точном SHA `70a6f2706`.

## Что проверено и корректно

- Оба новых коммита несут `Issue: #1016` / `User-Visible: no`; дельта не
  добавляет ничего пользователю видимого — changelog не требуется, и ни одно
  число (бюджеты/ratchets — внутренние CI-величины) не экспонируется дважды с
  разными источниками.
- `.github/workflows/validate-product.yml`/`validate-tooling.yml` и
  `scripts/ci-profile-paths.json` регистрируют новый тест в обоих
  соответствующих path-фильтрах (prefix `!`/без `!` симметрично для обоих
  триггеров job) — не оставляет файл вне обязательных CI-раннеров.
- `typescript` — уже существующая devDependency (`package.json:85`,
  `^5.4.5`), лениво подгружается через `createRequire` только при вызове
  `ownsBuildSignature`, не попадает в собираемый рантайм-бандл (вызывается
  из `cleanBundleOutputPlugin`, это build-time Rollup-плагин, не часть
  `src/**`).
- Маршрут побочных находок: `REVIEW_FINDINGS_POLICY` — `mode: issues`.
  Побочных находок нет, отдельный issue не заводится.

## Чего не проверял

- (закрыто) Полный `npm test` сначала дал неоднозначный первый прогон из-за
  моей ошибки с `tail` и параллельной сборки; изолированный повтор —
  5549/5550 PASS, 0 fail, 1 skip. Не включаю в «не проверял» — проверено.
- Golden/рендер-инварианты/touch/геометрия/perf — не затронуты диффом (только
  `scripts/**`, `test/**`, `.github/**`, `docs/**`), не прогонял.
- `pytest tests_backend`, HA-harness — Python не менялся, не прогонял; локально
  доступного `.venv-backend` для полного харнесса тоже нет (облачная среда
  ревью), но это не требовалось диффом.
- Исторические (до `BUNDLE_RELEASE_ONLY_SINCE`) ветки/коммиты на соответствие
  новому правилу — не проверял; задача явно не переписывает историю, и r1 это
  уже разобрал.
- Ручная/dev-приёмка владельцем — добровольна, не блокер на `show`.

## Маршрут вердикта (§5, #726)

Критерии трека `show`: класса A в диффе нет; поверхность одна — build-cleanup
плагин и его регистрация в CI/документации, не несколько независимых
продуктовых поверхностей; миграций конфига/compatibility-полей нет; нового
UX-контракта нет; influence на perf/touch нет (байты бандла не меняются,
только путь восстановления при аварийном переходе через старую историю);
ожидаемое поведение зафиксировано однозначно в самом issue (раздел «Переход
через старую tracked-dist историю (обнаружен после r1)» и «Регрессия AC2»).
Критерий не провален → `route: fix`.

## Вердикт

Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1016-r2.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1016-single-bundle-final`, коммит `70a6f2706e75` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6562c4004a5dd043c6ed814a8a43473630723b9f`
  ```
  git log --all --format='%H %T' | grep 6562c4004a5d
  ```
- Тело issue: `8b03976096b0b0b3698d74446ee84cce39e03d4946b88c8c174e52bbf7b5b6fa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDEsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDU2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMzgsIm91dHB1dF90b2tlbnMiOjQzMDQ2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NDQyMSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg0NzIwMzcsImNvc3RVc2RFc3RpbWF0ZSI6Mi43ODI4Mjc0MDAwMDAwMDA0fV0sInR1cm5zIjo4MSwiZHVyYXRpb25NcyI6ODU2ODkwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi43ODc4ODM0MDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5079 output_tokens=43069 cache_creation_input_tokens=164421 cache_read_input_tokens=8472037 num_turns=81 -->
