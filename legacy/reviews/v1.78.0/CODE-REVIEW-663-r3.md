# CODE-REVIEW-663-r3

Материал раунда: `f2e114d71dba9e34242e63e92781ecffa9b3f730` (ветка
`issue/663-stairs`, рабочая копия уже на нём). Предыдущий материал (r2):
`d64338224da8606bf2b346906b8f6f2a9bd0a15e`.

Дельта: `git diff d6433822..f2e114d7` — 3 содержательных коммита (плюс
`8176f119` — публикация `CODE-REVIEW-663-r2.md`, класс C, не код):

- `8852207b` `test: стабилизировать проверку угла magnet лестницы` —
  `demo/smoke_stairs.mjs` (+5/-1);
- `9755b200` `chore(golden): принять разметку обратной лестницы` —
  `demo/golden/baselines/baselines-index.json` (+14/-14) и 4 PNG
  (`stairs-flat-normal-light`, `stairs-flat-hover-dark`,
  `stairs-flat-selected-light`, `stairs-isometric-dark`);
- `f2e114d7` `docs: обновить fingerprint скриншотов после лестниц` —
  `docs/images/screenshots.json` (+12/-12, только `sourceFingerprint`/
  `sourceSha256`, `imageSha256` не менялись).

Заход: r3 (код-ревью), блокирующих циклов израсходовано 2/4.

`dev` не сдвинулся с r1/r2: `git merge-base HEAD origin/dev` ==
`origin/dev` == `cf876c71` (та же база). Дельта не трогает ни одного файла
класса A (`src/**`, `custom_components/**/*.py`) — `node
scripts/process-gate.mjs --range d6433822..HEAD --issues` подтверждает:
«файлов класса A нет». Это чисто дельта-раунд: закрывает ровно две
Medium-находки `CODE-REVIEW-663-r2.md`, продуктовый код не менялся с r2.
Разбор — по дельте, а не заново; общий скоуп задачи (#663, J1/J4/J6 по
`docs/SCOPE.md`) не пересматривается — см. `CODE-REVIEW-663-r1.md`/`-r2.md`.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **Medium-1** — golden-эталон устарел для 4 сцен с лестницами (`direction:'backward'`), AC12 не доказан на материале r2 | `9755b200`: приняты 4 новых baseline PNG + `baselines-index.json` обновлён (`sourceFingerprint`, `localAttestation`, 4 новых `scenarios`-хэша). Коммит несёт `Release: v1.78.0-beta.5` + `Baseline-Reviewed-Local: sha256:d6725147cfe96217ca01c22b86bc05eb4b69dd9c73402d88b57e071adfb4e181` — ровно тот путь, что назвал r2 (прецедент `93876d75`/`ac6f4bfe`) | Лично прогнал `npm run bundle:sync && npm run golden:verify` на этом точном SHA: **`179 passed`, 0 different**, все 4 сцены лестниц в списке — `stairs-flat-normal-light`, `stairs-flat-hover-dark`, `stairs-flat-selected-light`, `stairs-isometric-dark` — `passed`. Trailer-хэш `d6725147…` совпадает с `localAttestation.sha256` в самом индексе — не рассинхронизирован |
| **Medium-2** — smoke-свидетель `wallMagnetUsesPhysicalFace` статистически ненадёжен (баг сравнения угла по модулю 180 для отрицательного эпсилон) | `8852207b`: старое `closeTo(((angle % 180) + 180) % 180, 0)` заменено на `axisAngleDistance(angle) = Math.min(normalized, 180 - normalized)` — ровно паттерн, который r2 указал как уже существующий в дереве (`src/junction-limits.ts:200-204`) | Математически воспроизвёл ровно случай из r2 (`node -e`): для `angle = -2.2737367544323206e-13` старая формула давала `179.999999999999773` → `closeTo(…, 0) === false` (подтверждает исходный баг); новая `axisAngleDistance` даёт `2.27e-13` → `true`, и для `+2.27e-13` — тоже `true` (симметрично). Проверил, что фикс не «обнуляет» дискриминацию теста: `axisAngleDistance(45) = 45`, `(90) = 90`, `(179.5) = 0.5` — все корректно `false`, тест по-прежнему ловит реально не-осевой угол. Лично прогнал `node demo/smoke_stairs.mjs` **30 раз подряд** (два прогона по 15, разными вызовами) на свежем `bundle:sync` этого SHA — `wallMagnetUsesPhysicalFace: true` и итоговый `OK` **30/30**, ни одного красного (было 3 красных из 13 на материале r2) |

Обе находки закрыты не на слово автору: golden — личным `golden:verify` на
точном SHA с явной проверкой каждой из 4 сцен построчно; smoke-формула — и
математической реконструкцией конкретного числа из r2, и живым 30-кратным
прогоном браузерного смока.

## Унаследовано из r2 без повторной проверки

Дельта не касается этих областей — приняты по `CODE-REVIEW-663-r2.md`
(материал `d6433822`, вердикт жёлтый, High 0) и, транзитивно, по
`CODE-REVIEW-663-r1.md` (материал `59a60d52`, вердикт жёлтый, High 0) без
повторного разбора:

- continuous/мебельный transform-контракт лестниц (`src/stairs.ts`,
  `src/coordinate-canonicalization.ts`), включая закрытый в r1 High-1;
- разметка ступеней для `direction:'backward'` (Medium-1 из r1, продуктовый
  фикс `src/stairs.ts:151-157` — сам код дельтой r2→r3 не тронут, менялся
  только его эталонный скриншот);
- mutation witnesses AC7/AC11 (`stairs-broken-targets-become-active`,
  `stairs-legacy-config-materializes-empty-collection`,
  `stairs-import-skips-target-space-remap`);
- backend-схема (`validation.py`, лимит 250), repair ссылки при удалении
  пространства, import/export remap;
- i18n (4 языка), 2D/2.5D через общий floor-projection слой, батчинг
  вычитания площади по кадрам (`ea1f19c3`), navigation/gesture guard'ы;
- документация (`STAIRS.md`, `CANVAS.md`, `UX-MODES.md`,
  `CONFIG-COMPATIBILITY.md`, `TOUCH-SUPPORT.md`), трейлеры и changelog
  предыдущих коммитов.

## Как проверялось

Обязательный Validate точного SHA материала — зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/36279695032. Проверил
job-список построчно (`gh run view 36279695032 --json jobs`): зелёные —
предпролёт, классификация, переиспользование, **frontend
(types+unit+build+bundle-sync)**, **мутанты по диффу (6/6 шардов)**,
«доказательство выполненных проверок»; **skipped** — hacs, hassfest,
geometry_parity, backend (pytest), смоки в браузере, golden,
performance_smoke, бандл dev для стенда. `node scripts/classify-changes.mjs
--heavy` на этом HEAD лично подтверждает `heavy=false` — эти heavy-джобы
skipped корректно (сам head-коммит `f2e114d7` не несёт `Release:`; тот
трейлер есть только у среднего коммита дельты `9755b200`, а heavy-флаг
смотрит на head), значит golden/browser-smoke Validate не подтверждал и они
остаются моей обязанностью — прогнаны ниже лично.

| Гейт | Прогнано | Результат |
|---|---|---|
| `npx tsc --noEmit` | лично, на этом SHA | зелёный, без ошибок |
| `npm run build` (+ `bundle:sync`) | лично, дважды (для golden и для смоков) | оба раза `created dist` без ошибок |
| `npm test` | лично, на свежем build | `# tests 3143 / pass 3142 / fail 0 / skipped 1` — совпадает с зафиксированным в r2 базовым числом |
| Мутанты по диффу (6/6 шардов) | зачтено по зелёному Validate этого SHA (дельта не содержит новых мутантов реестра — только правка существующего теста и golden/docs) | все 6 шардов `success` |
| `node scripts/check-docs.mjs` | лично | `Documentation checks passed (7 files, 12 external links)` — 0 warn (в r2 был 1 ожидаемый warn про устаревший fingerprint; коммит `f2e114d7` дельты его и закрывает) |
| `node scripts/check-docs.mjs --screenshots=strict` | лично | тоже зелёный, без расхождений |
| `node scripts/validate-commit-provenance.mjs` | лично, по диапазону дельты | без вывода/ошибок — трейлеры всех 3 коммитов дельты валидны (`Issue:#663`+`User-Visible:no` на всех трёх; `Release`+`Baseline-Reviewed-Local` на `9755b200`, ровно один из двух допустимых) |
| `node scripts/smoke-select.mjs --base d6433822 --head f2e114d7` | лично | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются» — ожидаемо: дельта не трогает `src/**` |
| `node demo/smoke_stairs.mjs` (AC2-свидетель, названный в r2 как ненадёжный) | лично, **30 последовательных прогонов** на свежем `bundle:sync` этого SHA | **30/30 `OK`**, `wallMagnetUsesPhysicalFace: true` во всех 30 — закрывает Medium-2 |
| `npm run golden:verify` (полная матрица, диф трогает golden напрямую) | лично, на свежем `bundle:sync` этого SHA | **`179 passed`, 0 different** — все 4 сцены лестниц явно `passed`, закрывает Medium-1 |
| `python -m pytest tests_backend -q` | не прогнано | нет `pytest`/`homeassistant` в этой ревью-среде (как в r1/r2); дельта r2→r3 не трогает ни одного `.py`-файла — риск нулевой для этой дельты |
| `npm run invariants -- --config …` | не прогнано | дельта не меняет модель/геометрию хранения — только тестовую формулу сравнения углов и эталонные PNG/фингерпринты |

После проверки бандл возвращён к закоммиченному состоянию (`npm run
bundle:clean`), `git status` — пусто.

Один число — один источник: `Release: v1.78.0-beta.5` в `9755b200` совпадает
с `package.json.version` (`1.78.0-beta.5`) — один источник версии, расхождения
нет. `Baseline-Reviewed-Local` хэш в трейлере (`d6725147…`) байт-в-байт равен
`localAttestation.sha256` в самом `baselines-index.json` — не два независимых
числа.

## Находки

Нет. Обе Medium-находки r2 закрыты и подтверждены исполнением (не чтением
хендоффа): golden — полным `golden:verify` на точном SHA с построчной
проверкой всех 4 сцен; smoke — 30 живыми прогонами плюс математическим
воспроизведением точного бага и подтверждением, что дискриминирующая
способность теста не пострадала. Новых находок при обязательном прогоне
названных в AC гейтов (golden, smoke_stairs, npm test, check-docs, provenance)
не появилось.

**Итого: High 0, Medium 0.**

## Что проверено и корректно

- Обе Medium-находки `CODE-REVIEW-663-r2.md` закрыты доказательно (таблица
  «Закрытие раунда r2» выше).
- `npm test` — 3142 pass / 1 skip / 0 fail (после чистого `npm run build`;
  число совпадает с зафиксированным в r2).
- `npm run golden:verify` — 179/179, 0 расхождений, включая все 4 сцены
  лестниц, ранее не совпадавшие.
- `node demo/smoke_stairs.mjs` — 30/30 подряд, включая ранее нестабильную
  проверку `wallMagnetUsesPhysicalFace`.
- Трейлеры всех 3 коммитов дельты корректны (`Issue`/`User-Visible` на всех,
  единственный `Baseline-Reviewed-Local` на коммите с golden-baseline,
  совпадает с содержимым индекса); `User-Visible: no` на всех трёх —
  оправданно: изменения не меняют наблюдаемое поведение продукта (тестовая
  формула, эталонные скриншоты, фингерпринт документации), changelog не
  требуется и не тронут.
- `node scripts/check-docs.mjs` (обычный и `--screenshots=strict`) — зелёный
  без warn; предыдущий warn r2 про устаревший fingerprint скриншотов закрыт
  коммитом `f2e114d7` этой же дельты.
- `node scripts/process-gate.mjs --range d6433822..HEAD --issues` — гейт
  пройден (единственный warn — ожидаемый, про инфраструктурный диапазон без
  файлов класса A).
- `node scripts/validate-commit-provenance.mjs` — без ошибок на диапазоне
  дельты.
- Дельта не расширяет и не сужает скоуп задачи: три коммита строго чинят то,
  что нашёл r2, никакого нового продуктового поведения не введено (что и
  подтверждает пустой диапазон класса A).

**Побочная заметка не как находка ревью:** при личном прогоне `npm test`
сразу после `npm run bundle:clean` (восстановление закоммиченного `dist`)
получил `4 fail` в `test/bundle-assets.test.mjs` (#438/#593/#627,
bundle-graph-budget тесты, не относятся к лестницам) — это оказался артефакт
моего собственного порядка команд (эти тесты читают именно свежесобранный
`dist`, а не восстановленный committed-копию, ровно как описывает `gate:small`
в `AGENTS.md`: «unit tests follow the completed build»). После `npm run
build` без последующего `bundle:clean` те же 4 теста (и весь набор) — зелёные
(проверил `test/bundle-assets.test.mjs` отдельно: `36/36 pass`). Не находка
материала — фиксирую, чтобы не создавать ложное впечатление регресса в логе
сессии.

## Чего не проверял

- **`python -m pytest tests_backend`** — не прогнано (нет `pytest`/
  `homeassistant` в этой среде, как в r1/r2); дельта r2→r3 не трогает ни
  одного `.py`-файла — нулевой риск для *этой* дельты. Backend-код в целом
  остаётся проверенным по r1/r2 (см. «Унаследовано»).
- **`npm run invariants`** — не прогонял; дельта не меняет модель/геометрию,
  только тестовую формулу и эталонные изображения/фингерпринты.
- **HACS/hassfest/geometry_parity/performance_smoke** — skipped на материале
  (heavy-гейты, ожидаемо), дельта не трогает манифесты, geometry-модель или
  perf-путь; не прогонял отдельно — уже закрыто по r1/r2 для остального кода,
  для этой дельты не в фокусе.
- **Полная browser-smoke матрица за пределами `smoke_stairs`** —
  `smoke-select` по дельте `d6433822..f2e114d7` не выбрал ни одного смока (нет
  `src/**` в дельте); `smoke_room_resize`/`smoke_summary_first_paint` (задетые
  более ранними багфиксами r1/r2) дельтой r2→r3 не затронуты, повторно не
  гонял.
- **Мутанты по диффу лично построчно** — не перечитывал логи всех 6 шардов
  заново (дельта не добавляет новых записей `mutation-registry.mjs`; проверил
  только, что ни один существующий stairs-мутант не таргетирует
  `wallMagnetUsesPhysicalFace` или изменённые golden-сцены — не таргетирует,
  см. проверку `scripts/mutation-registry.mjs` по всем 11 `stairs-*` id).

---

<!-- material-anchors: заполняется конвейером (#414) -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/663-stairs`, коммит `f2e114d71dba` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `682ed825a6708975ff1c3f6c5ef1bb7b5b90960b`
  ```
  git log --all --format='%H %T' | grep 682ed825a670
  ```
- Тело issue: `f3f0ee8408eb76ccec4f3ec50a9048ff1e29b2967259f0d4c4d333d8c68157e4`
- Вердикт конвейера: `green` · High 0
