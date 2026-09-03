# CODE-REVIEW-431-r1

Issue: [#431](https://github.com/Matysh/houseplan-card/issues/431) — `kind:'image'` выпал из канонизации координат
Ветка: `issue/431-image-coordinate-canonicalization`
Материал ревью: `git diff origin/dev...HEAD`, HEAD = `6559679b63095a65c7c44ca4026070b0b2c9a930`
Заход: r1 · блокирующих циклов 0/4

## Скоуп

Бэклог аудита v1.71.0-beta.1 (§3.2 M4): `kind: "image"` — box-декор, добавленный
#51, — не входил в allowlist видов декора, канонизируемых координатным барьером
(#223/#224/#291), ни во фронтенде (`src/coordinate-canonicalization.ts`), ни в
Python-зеркале (`custom_components/houseplan/coordinate_canonicalization.py`).
Следствие: no-op сохранение или повторный Optimize мог давать технический diff
конфига только для изображений — класс дефекта #223/#224/#291 открывался заново.

ТЗ живёт в `docs/specs/431-image-coordinate-canonicalization.md`, ревью ТЗ —
`docs/reviews/SPEC-REVIEW-431-r1.md` (зелёное, r1, без находок). Полный трек
обоснован названным критерием §5 (два независимых рантайма на разных языках).

Изменение строго соответствует заявленному скоупу: единый TS runtime-каталог
`DECOR_BOX_KINDS` (`src/editors/decor/types.ts`), его использование через один
predicate `isDecorBoxKind` в обоих местах фронтенда (сбор отчёта и реальная
канонизация), точное Python-зеркало `DECOR_BOX_KINDS`, расширенная общая
fixture, новые тесты обеих рантайм-веток и два новых постоянных
mutation-witness. Никакой новый writer, схема, миграция, UI, i18n не появились
— соответствует «Не-скоупу» ТЗ.

## Как проверялось

Материал — диапазон `git diff origin/dev...HEAD` (32 файла: продуктовый код,
тесты, документация, сгенерированный бандл класса D). Продуктовая правка
ограничена четырьмя файлами: `src/coordinate-canonicalization.ts`,
`src/editors/decor/types.ts`, `custom_components/houseplan/coordinate_canonicalization.py`,
`scripts/mutation-gate.mjs` (новые defensive witness) — плюс тесты/фикстура и
документация.

### Гейты — что прогнано и почему

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build` (сверка бандла) | **не перегонялись заново** | Validate зелёный на точном HEAD `6559679b` (проверено: `gh run view 33734051066` → `conclusion: success`, `headSha: 6559679b…`, совпадает с материалом). Дешёвый набор уже подтверждён на этом SHA — повторный прогон не даёт новой информации (правило соразмерности гейтов) |
| `node scripts/check-docs.mjs` | **прогнан** | diff трогает `src/**` → обязателен. `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | **прогнан** | `Новых any нет` (17 добавленных строк в 2 файлах) |
| `node scripts/model-invariants.mjs` | **не требуется** | diff не трогает рёбра комнат, `layout`, `marker.space`, `open_spans`, записи толщины — только `decor.kind: image` box-геометрию; инварианты модели этой поверхности не касаются |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнан** | вывод: `НЕОПРЕДЕЛЁННОСТЬ`, символы `DECOR_BOX_KINDS`, `DecorBoxKind`, `DecorKind`, `isDecorBoxKind` ни в одном смоке не встречаются. Решение ревьюера: **браузерные смоки не нужны** — изменение целиком внутри чистого geometry-transform (`canonicalizeConfigGeometryInPlace`/`latticeCanonicalizationReport`), не задевает рендер, DOM, drag/resize, Optimize-UI; near-node значения снапаются к тем же координатам, видимого сдвига нет (заявлено в ТЗ и не опровергнуто чтением кода — канонизация не меняет числовое значение вне порога `LATTICE_NOISE_STEPS`). Полная матрица смоков — предрелизный гейт, не гейт ревью |
| `npm run golden:verify` | **не прогонялся** | diff не может изменить видимый результат: канонизация — числовое округление внутри порога snap, не геометрическое преобразование; screenshots/golden явно вне-скоупа по ТЗ, `demo/golden/baselines/**` в diff отсутствует |
| `python -m pytest tests_backend -q` | **не прогонялся штатно** (нет `homeassistant` в окружении: `test_coordinate_canonicalization.py` весь модуль пропускает через `importorskip`) — **проверено чтением и прямым исполнением модуля напрямую** (см. ниже) | `coordinate_canonicalization.py` не импортирует HA, поэтому логику можно исполнить в обход pytest |
| Мутационные свидетели AC4 (frontend + backend) | **прогнаны лично, оба** | см. раздел «Защитные AC» ниже |

## Защитные AC — таблица «чем краснеет» (#435)

| AC | Чем доказан | Чем краснеет — воспроизведено ревьюером |
|---|---|---|
| AC4 frontend completeness | `test/coordinate-canonicalization.test.mjs` → `decor box catalog canonicalizes every box kind…` (targeted `node --test --test-name-pattern="decor box catalog"`) | Применил патч мутанта `image-box-frontend-canonicalization-omitted` (искл. `'image'` из `isDecorBoxKind`) → пересобрал test-build (`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`) → тест **упал**: `image.x is canonical … expected: 0.5, actual: 0.5000000004`. Патч отменён, тест снова зелёный, `git status` чист |
| AC4 backend completeness | `tests_backend/test_coordinate_canonicalization.py` → `test_decor_box_catalog_matches_shared_contract`, зарегистрирован как `image-box-python-canonicalization-omitted` в `scripts/mutation-gate.mjs` (backend/HA-гейт, ревьюер не воспроизводит второй раз — правило §2.7) | HA недоступна локально, поэтому вместо pytest модуль `coordinate_canonicalization.py` (чистый Python без HA-импортов) загружен напрямую (`importlib`) и прогнан на shared fixture: (1) позитив — `canonicalize_config_geometry` даёт `image.x/y/w/h/angle` из `configExpected` и сохраняет `asset_id/opacity/flip_h/flip_v/future`; (2) применил ту же мутацию, что и в `mutation-gate.mjs` (`DECOR_BOX_KINDS = ("rect","ellipse","furniture")`) → `image.x` осталось `0.5000000004` вместо `0.5` — **сравнение с ожидаемым падает**, эквивалент красного pytest |
| AC5 allowlist boundary | unit `future-box` case (в том же frontend-тесте) + backend `future` field preservation | не мутировался отдельно; проверено чтением — `isDecorBoxKind`/`DECOR_BOX_KINDS in`-проверка применяется только к перечисленным видам, неизвестный `kind: 'future-box'` не попадает ни в одну ветку `if/elif`, объект возвращается `deepEqual` со входом (подтверждено прогоном теста, зелёный) |

Мутационная регистрация также прошла дешёвую проверку реестра:
`node scripts/mutation-gate.mjs --check` — оба новых id (`image-box-frontend-canonicalization-omitted`,
`image-box-python-canonicalization-omitted`) в списке `ok`; `node --test test/mutation-gate.test.mjs`
— 10/10 (структура реестра, отсутствие устаревших якорей, покрытие шардов).

## AC — разбор

- **AC1 (frontend unit)** — доказано и воспроизведено: `image.x/y/w/h` дают тот
  же lattice-результат, `angle` — тот же scalar, что параллельный `furniture` в
  той же fixture (побитовое сравнение `configExpected`, тест прогнан выше).
- **AC2 (отчёт + идемпотентность, unit)** — тест `lattice report includes image
  box coordinates` проверяет near-node/far классификацию для image
  (canonicalized=2, far=1); идемпотентность обеспечена тем, что оба места
  фронтенда используют один и тот же `isDecorBoxKind` (устраняет риск №1 ТЗ
  «исправлен writer, но не отчёт») — проверено чтением: `grep -n
  isDecorBoxKind src/coordinate-canonicalization.ts` даёт ровно два вызова, оба
  через общий predicate.
- **AC3 (backend mirror, backend)** — Python `DECOR_BOX_KINDS` идентичен по
  порядку и составу `fixture.boxKinds`; `CONFIG_SCHEMA` в `validation.py`
  строка 1388 уже валидировала `kind: "image"` с полями `x/y/w/h/angle`
  (добавлено в #51, этой задачей не тронуто) — проверено чтением, схема не в
  diff. Backend-логика подтверждена прямым исполнением модуля (см. таблицу
  выше), это эквивалентно `unit`-доказательству для чистого Python без HA.
- **AC4 (полнота набора, unit+backend+mutation)** — доказано и лично
  воспроизведено оба отрицательных прогона (см. таблицу выше).
- **AC5 (поля вне геометрии)** — доказано, тест прогнан; `future`
  extension-поле и presentation-поля (`asset_id/opacity/flip_h/flip_v`)
  проходят обе канонизации без изменений.
- **AC6 (совместимость)** — проверено чтением и прогоном: `validation.py` не в
  diff (схема не менялась), `import_export.py` не в diff, версии/миграции не
  тронуты. Полный файл тестов `test/coordinate-canonicalization.test.mjs`
  прогнан целиком локально — 11/11 зелёных, включая существующие тесты
  #224/#248/#291 (регрессий нет).
- **AC7 (документация/release)** — `docs/CONFIG-COMPATIBILITY.md` называет
  `image` в box-каталоге; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` получили
  парную запись в том же implementation-коммите `58efb6a1`
  (`User-Visible: yes`) — проверено чтением diff, оба файла в одном коммите.
- **AC8 (гейты)** — Validate зелёный на точном SHA (см. таблицу гейтов); ручные
  targeted-прогоны (frontend unit, оба мутанта, `check-docs`, `no-new-any`)
  прогнаны лично и задокументированы выше.

## Что проверено и корректно

- Единственный источник каталога box-видов на фронтенде: `DECOR_BOX_KINDS`
  экспортируется из `src/editors/decor/types.ts`, реэкспортируется из
  `coordinate-canonicalization.ts`, используется через `isDecorBoxKind` в обоих
  местах (сбор отчёта и запись) — не осталось параллельного списка сравнений.
- Python-зеркало `DECOR_BOX_KINDS` — точный exact-set и порядок совпадают с
  shared fixture `boxKinds`, используется через `in`-проверку на месте прежней
  явной цепочки сравнений.
- `DecorImage extends DecorBoxBase` (уже было в #51) — подтверждает, что box
  контракт `x/y/w/h/angle` для image структурно корректен, это не новое
  допущение, а факт типовой системы.
- Трейлеры коммитов: `58efb6a1` и `6559679b` несут `Issue: #431`; в
  implementation-коммите `User-Visible: yes` с правками обоих changelog в том
  же коммите — соответствует правилу.
- Не-скоуп соблюдён: не тронуты `validation.py` (схема), `import_export.py`,
  UI/рендер декора, i18n, миграции, версии.
- Бандл: `initialViewGzipBytes` вырос на 15 байт (290950→290965), далеко в
  пределах бюджета `INITIAL_VIEW_GZIP_BUDGET = 300000` — не находка.
- «Одно число — один источник»: в этом diff нет новой пользовательски видимой
  величины, отображаемой дважды (канонизация — служебное округление хвостов
  float, не новое значение в UI); правило не применимо к этому изменению.

## Чего не проверял

- Полный `python -m pytest tests_backend -q` c реальным HA-харнессом — модуль
  недоступен в этом окружении (`ModuleNotFoundError: No module named
  'homeassistant'`); заменено прямым исполнением чистого Python-модуля на
  shared fixture (позитив и мутация), что покрывает содержательную часть AC3 и
  AC4-backend без HA-обвязки. Полный pytest с HA канонично прогнан в Linux CI
  на точном SHA `6559679b` (Validate: `success`).
- Полная матрица браузерных смоков (215 файлов) и `golden`/`performance_smoke`
  — не запускались; обоснование в таблице гейтов (`smoke-select.mjs` дал
  `НЕОПРЕДЕЛЁННОСТЬ`, ревьюер решил не гонять: чистый geometry-transform без
  рендер-поверхности). Оба уже зелёные в Validate на точном SHA.
- `npm run docs:accept`/пересъёмка скриншотов — не требовалась, `check-docs`
  зелёный, `docs/images/screenshots.json` в diff содержит только обновлённый
  `sourceFingerprint`, кадры не менялись (заявлено автором, косвенно
  подтверждено отсутствием файлов `demo/docs/**` в diff).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Материал раунда

- SHA материала: `6559679b63095a65c7c44ca4026070b0b2c9a930` (= `origin/issue/431-image-coordinate-canonicalization`, = HEAD на момент ревью).
- Дерево материала: `git diff origin/dev...HEAD` (32 файла, продукт: 4 файла).
- Валидация: `gh run view 33734051066` → `status: completed`, `conclusion: success`, `headSha: 6559679b…`.
- Первый заход (r1) на код-ревью — раздел «Унаследовано» не применяется.

## Вердикт

Зелёный. Изменение узкое, полностью соответствует ТЗ и его AC, оба defensive-AC
воспроизведены лично (не только заявлены автором), гейты, покрывающие diff,
прогнаны или обоснованно пропущены с указанием причины. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/431-image-coordinate-canonicalization`, коммит `6559679b6309` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `131d031470b6191aee0ccafd4b06181a35e4f378`
  ```
  git log --all --format='%H %T' | grep 131d031470b6
  ```
- ТЗ `docs/specs/431-image-coordinate-canonicalization.md`, блоб `357572246be1e0649b607bc3bf3d59232310ff58`
  ```
  git log --all --find-object=357572246be1e0649b607bc3bf3d59232310ff58 -- docs/specs/431-image-coordinate-canonicalization.md
  ```
