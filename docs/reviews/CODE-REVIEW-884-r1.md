# CODE-REVIEW-884-r1

Issue: #884 · Трек: show (инфраструктура, PROCESS §1) · Заход: r1 · блокирующих циклов 0/2
Материал: `76c8a202170897065805b06fea34dea951917a1b` (HEAD = материал, рабочая копия на нём)
База: `origin/dev` (= `a4fa265e33230afb503234757871702e7b093f06`)

## Скоуп

QA-находка: `test/furniture-assets.test.mjs` иногда ловил ложный
`src/furniture-menu-art.generated.ts is stale` при полном `npm test`, хотя
`src/**`, generator и пак не менялись (замечено в #880). Причина — импорт
`PLAN_BOUNDS_TOLERANCE` из `scripts/generate-furniture-assets.mjs` в
`test/furniture-visual-bounds.test.mjs` исполнял top-level `loadPack()` +
`output()` и писал все три generated-модуля побочным эффектом импорта;
параллельный `--check` в дочернем процессе мог прочитать файл в окне между
`O_TRUNC`-открытием и записью байт.

Исправление: та же утилита `isMainModule`, что уже используется в ~40
скриптах репозитория, теперь гейтит единственный top-level блок записи —
импорт более не трогает диск, CLI-поведение (`furniture:generate`/`:check`,
относительный/абсолютный/symlink вход) не изменилось. Правка — класс B
(`scripts/**`, `test/**`) + документация/учёт; класса A, source SVG,
generated-модулей и продуктовой семантики в диффе нет (подтверждено
`git diff --stat` и `smoke-select`, ниже).

Соответствие критериям §5 (track:show): сложность и риск низкие (один
`if`-гейт по уже принятому в кодовой базе паттерну), одна поверхность
(генератор + его unit-тесты), нет миграции/compat-полей, нет нового
UX-контракта (поведение CLI не меняется, видимого пользователю поведения
нет вовсе), нет влияния на perf/touch, ожидаемое поведение зафиксировано
в этом же коммите (FURNITURE.md, DEVELOPMENT.md, STATUS.md) и как паттерн
— во всей кодовой базе. Все шесть критериев проходят → `route: fix`.

## Как проверялось

### Прогнано лично в этом раунде

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` →
  `noExecutableDiff: true`, `direct/registered/visualMinimum` пустые —
  продуктового frontend-диффа нет, фронтенд-смоки не нужны.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` →
  GREEN, один ожидаемый WARN «инфраструктурный диапазон, файлов класса A
  нет, статусная метка не нужна до S7» (#562) — совпадает с заявленным.
- `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/furniture-assets.test.mjs test/furniture-visual-bounds.test.mjs`
  → 18/18 PASS (4 новых + 14 прежних), в рабочем дереве.
- **Независимая проверка «умеет ли тест падать» для обоих защитных AC** —
  не поверено на слово автору, а воспроизведено лично в одноразовой копии
  `/tmp/hp884-verify` (вне checkout, удалена после): взят
  `scripts/generate-furniture-assets.mjs` родительского коммита
  `20457660` (до фикса) + неизменные `furniture-path-join.mjs`,
  `svg-path-bounds.mjs`, `spawn-portable.mjs`, `src/*.generated.ts`, пак
  `0.4.1`.
  - Проба AC1 (`node --input-type=module -e '...' -- --check`): на старом
    коде импорт печатает `Furniture pack OK: 60 plan symbols, 33 menu
    icons (generated files current).` перед значением допуска — тест
    ожидает `stdout === '0.1\n'`, т.е. **падает**, подтверждая, что AC1
    различает старое/новое поведение.
  - Проба AC2 (расширение `O_TRUNC`-окна `writeFileSync` на menu-файле,
    затем дочерний `--check`): на старом коде результат —
    `status: 1`, `stderr: "... src/furniture-menu-art.generated.ts is
    stale; run npm run furniture:generate"` — **точное воспроизведение
    исторической строки ошибки** из тела issue и из #880. Тест ожидает
    `check.status === 0` и `writes === []` — тоже падает на старом коде.
  - После проверки рабочее дерево репозитория осталось чистым
    (`git status --porcelain` пуст и до, и после; сборка `test-build/`
    игнорируется).

Итог: оба защитных AC не просто проходят на новом коде — они
воспроизводимо красные на коде до правки, причём именно с тем симптомом,
который видел автор на #880. Это сильнее одной лишь ссылки на CI.

### Не прогонялось (и почему не требовалось)

- `npx tsc --noEmit` / полный `npm test` / `npm run build` с проверкой трёх
  копий бандла — не повторялись: Validate на этом точном SHA зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/38450381927),
  §8 позволяет не перегонять дешёвые гейты, уже подтверждённые на
  материале ревью. Точечный прогон двух relevant unit-файлов (выше) —
  дополнительная, не заменяющая проверка.
- `golden:verify`, performance, pytest `tests_backend`, HA harness,
  инварианты модели — не относятся к диффу: нет изменений рендера,
  геометрии, Python или производительности; AC их не называют.
- Мутанты реестра — на `track:show` в разработке не гоняются (#709);
  изменённая строка `scripts/generate-furniture-assets.mjs` не входит ни
  в один существующий mutation-патч (проверено: единственный патч на этот
  файл, `furniture-pack-accepts-foreign-symbol-count`, трогает проверку
  кардинальности на 60 символов — её `find`-строка диффом не затронута,
  запись в реестре не протухла).
- Скриншоты документации — не гейт задачи (#697).

## Находки

Нет High. Нет Medium.

Низкоуровневые наблюдения (Low, не открывают цикл):
- Комментарий в тесте «`import must not write even identical generated
  bytes`» формально неточен — после правки импорт вообще не доходит до
  записи (ветка `output()` не вызывается, а не «пишет те же байты»).
  Смысл утверждения (`writes` пуст) верен, сообщение чуть вводит в
  заблуждение при будущем чтении диффа. Не исправляю сам — не моя роль;
  оставляю как наблюдение, не блокирует.

## Что проверено и корректно

- Причина бага подтверждена механически (не предположением): то же
  `O_TRUNC`-окно `fs.writeFileSync`, тот же дочерний `--check`,
  воспроизводится точная историческая строка ошибки на неизменённом коде
  родительского коммита.
- Фикс — применение уже существующего в репозитории паттерна
  `isMainModule(import.meta.url)` (используется в ~40 файлах `scripts/**`,
  включая сам `spawn-portable.mjs` и его тесты symlink/Windows-case),
  минимальный по площади: один `if`, без изменения `output()`,
  `loadPack()`, валидации пака или сигнатур экспортов.
- Все три AC покрыты тестами в `test/furniture-assets.test.mjs`, и оба
  защитных (AC1, AC2) независимо воспроизведены красными на коде до
  правки (таблица ниже). AC3 проверяет относительный/абсолютный/symlink
  вход и точные байты — часть полного прогона 18/18 PASS.
- Побочный fixture-файл `the generator refuses a pack whose cardinality
  drifted` корректно донастроен (добавлено копирование `spawn-portable.mjs`
  в одноразовую копию) — иначе спаун CLI в копии упал бы на
  `ERR_MODULE_NOT_FOUND` после добавления нового импорта в генератор.
- Все отрицательные пробы и race-симуляция выполняются только в
  `mkdtempSync`-копии вне checkout, с `rmSync` в `finally`; подтверждено
  личным прогоном, что ни один файл продукта/рабочего дерева не
  затрагивается.
- Трейлеры коммита корректны: `Issue: #884`, `User-Visible: no`.
  Изменения обоих `docs/CHANGELOG.md`/`.ru.md` с `User-Visible: no` не
  противоречат правилу — §11.9 прямо говорит, что эти файлы ведут полную
  технико-коммитную историю задач, включая беты, отдельно от
  пользовательского stable-текста; правка `User-Visible: yes` требует тех
  же правок, но не запрещает их при `no`.
- `docs/release-ledger/v1.80.1/884.json`: формат (`schema`, `issue`,
  `baseStable`, `category`, `rationale`, без `summary`) совпадает с
  прецедентом других `category: "infra"` записей этого цикла (638, 837–841,
  854–863, 868); классификация `infra` обоснована и верна — класс A,
  source SVG, generated-модули и продуктовая семантика не меняются,
  `introducedBy` не требуется (не `line-fix`).
- `docs/FURNITURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` описывают
  именно то поведение, которое вносит дифф; проверено построчным
  сопоставлением с кодом, расхождений нет.
- Числа/факты диффа сверены с деревом на этом SHA: единственный
  product-relevant факт — «импорт не пишет и не печатает» — имеет один
  источник (поведение `generate-furniture-assets.mjs`) и один набор
  потребителей документации; дублирования с независимым источником истины
  нет.
- Нет изменений в `dist/**` (class D) — Release-трейлер не требуется и
  отсутствует, корректно.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет (проверено лично) |
|---|---|---|
| AC1 — импорт допуска не читает пак/не пишет/не печатает CLI-вывод, включая `--check` в argv | `#884: importing the tolerance does not read a pack or execute the CLI` | На коде до фикса (род. коммит `20457660`) та же проба печатает `Furniture pack OK: 60 plan symbols, 33 menu icons (generated files current).` перед значением допуска → `stdout !== '0.1\n'`, тест падает |
| AC2 — гонка импорт/`--check` не даёт ложного stale; настоящий stale/missing отвергается, файлы не трогаются; пробы только в одноразовой копии | `#884: importing cannot expose a truncated menu module to a concurrent check` + `#884: imports and strict checks leave stale or missing generated files untouched` | На коде до фикса та же O_TRUNC-проба даёт `status:1`, `stderr: "...furniture-menu-art.generated.ts is stale..."` — точное совпадение с историческим симптомом из тела issue |
| AC3 — явные generate/check сохраняют контракт, точные байты, относительный/абсолютный/symlink вход — настоящий CLI | `#884: explicit generation keeps exact bytes and relative/absolute/symlink CLI entry works` + обновлённый `the generator refuses a pack whose cardinality drifted` | Проверено чтением и исполнением: без фикса эти же пути работают (CLI и до, и после правки — `isMainModule` истинен при прямом запуске), риск был не здесь, а в побочном эффекте импорта; негативный контроль кардинальности (59 вместо 60 отвергается) исполнен в полном прогоне, GREEN |

## Чего не проверял (и почему не требовалось)

- Полный `npm test`/`npm run build`/`tsc --noEmit`/`bundle-policy --verify`
  целиком — зелёный Validate на этом SHA уже их покрыл; перегонка не несёт
  нового сигнала для диффа без `src/**`.
- Golden, performance, pytest backend, HA harness, инварианты геометрии —
  вне применимости диффа (нет рендера/Python/геометрии/perf в изменённых
  файлах).
- Мутационный реестр (прогон) — не требуется на `track:show` в разработке;
  проверено только, что существующая запись не протухла.
- Ручное тестирование в браузере/демо — не применимо, диффа в `src/**` и
  `demo/**` нет.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/884-furniture-generator-isolation`, коммит `76c8a2021708` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9792d5013ed2f5307973972332fe825c1e6e8de4`
  ```
  git log --all --format='%H %T' | grep 9792d5013ed2
  ```
- Тело issue: `f691d9fafc779c50d351823bb1bef7c9380da3fa5135f8fd598c0dda143dba5d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTQsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njc5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3OCwib3V0cHV0X3Rva2VucyI6MjcxODEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTgyNzEsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozNDMzNTI2LCJjb3N0VXNkRXN0aW1hdGUiOjEuMzUxNzU1Mn1dLCJ0dXJucyI6NTMsImR1cmF0aW9uTXMiOjM0MzYwOSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMzU2NDM0MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4672 output_tokens=27198 cache_creation_input_tokens=98271 cache_read_input_tokens=3433526 num_turns=53 -->
