# CODE-REVIEW #250 — заход r1

- Issue: [#250](https://github.com/Matysh/houseplan-card/issues/250)
- ТЗ: `docs/specs/250-opening-centerline.md`, зелёный SPEC-REVIEW r1 на `2c776b0`
  (`docs/reviews/SPEC-REVIEW-250-r1.md`).
- Ветка: `issue/250-opening-centerline`
- Диапазон: `origin/dev..HEAD` = `2c776b0`, `2534916`, `0eb9ffe`, `7269550` (4 коммита)
- Продуктовый коммит: `0eb9ffe` (`Issue: #250`, `User-Visible: yes`, оба changelog).
  Второй коммит `7269550` — принятый Docs screenshots артефакт (`User-Visible: no`).

## Скоуп проверки

Диапазон небольшой (production-дельта — 3 файла `src/**`, остальное тесты,
мутанты, golden-контракт, документация), поэтому разбор полный: заход первый,
предыдущего раунда нет, «Унаследовано из r<N-1>» неприменимо.

Прочитаны docs/SCOPE.md (J1/J6), тело issue #250 и все пять комментариев,
docs/USER-GUIDE.ru.md, docs/WALL-THICKNESS.md, docs/ARCHITECTURE.md,
docs/ISOMETRIC.md, ТЗ целиком.

## Как проверялось

Прочитан весь `git diff origin/dev...HEAD` построчно (29 файлов). Дополнительно
исполнено (все команды дают тот же результат, что заявлен автором):

- `npx tsc --noEmit` — green.
- `npm test` — 1114/1114 pass, 0 fail (автор сообщил 1113 pass/1 skip; локально
  skip не воспроизведён — см. «Чего не проверял», не блокирует).
- `npm run build` — green; `sha256sum` трёх копий бандла совпадает друг с
  другом и с хэшем `806648ae6036…`, указанным автором.
- `node scripts/check-docs.mjs` — green (7 файлов, 10 внешних ссылок).
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` — green,
  0 предупреждений.
- `node scripts/mutation-gate.mjs --id=opening-symbol-flip-restores-edge-offset`
  — новый мутант пойман 1 из 1 (см. AC1 ниже).
- `node scripts/mutation-gate.mjs --id=opening-gate-flip-cancels-turn` —
  **0 из 1**, см. находку CR-1.
- `node demo/smoke_wall_thickness.mjs`, `node demo/smoke_isometric_contract.mjs`,
  `node demo/smoke_opening_preview.mjs` — все три green на свежепересобранном
  бандле (скопирован в `custom_components/houseplan/frontend/` и
  `demo/srv/assets/`).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` —
  НЕОПРЕДЕЛЁННОСТЬ (169 смоков, порог «широкого» символа >33; изменённых
  символов проекта — 6: `OpeningCfg`, `OpeningFaceOffset`, `_type`, `_flipV`,
  `_angle`, `_face`; ни один смок не назван инструментом напрямую). Решение
  ревьюера: три выбранных автором smoke — прямое покрытие темы (wall
  thickness/iso/opening preview), этого достаточно вместе с unit/golden-unit
  матрицей; полная матрица 167 смоков не оправдана диффом в 6 символов на 3
  файлах.
- `git diff --check origin/dev...HEAD` — чисто, whitespace ошибок нет.
- Трейлеры `0eb9ffe`/`7269550` прочитаны напрямую (`git log -1 --format=...`)
  — оба корректны, `User-Visible: yes` действительно несёт оба changelog в том
  же коммите.

Не прогонялось (осознанно, ниже обоснование): `npm run golden:verify` (полный),
`python -m pytest tests_backend` (backend/schema не тронуты, AC7 подтверждён
чтением — модель `flip_v` не меняется), полный `smoke_*` набор (167 смоков),
performance-профили (не названы в AC, дельта — константный helper без цикла).

## Находки

### CR-1 (Medium, в скоупе) — мутационный guard `opening-gate-flip-cancels-turn` сломан переименованием теста

`scripts/mutation-gate.mjs:1678` вызывает
`node --test --test-name-pattern="shared renderer centres defaults" test/opening-symbol.test.mjs`.
Этот тест был переименован этим же диффом
(`test/opening-symbol.test.mjs`, было `'shared renderer centres defaults and
preserves explicit door/window edge alignment'`, стало `'shared renderer
centres every flip while preserving opening direction'`) — подстрока
`"shared renderer centres defaults"` больше не встречается ни в одном имени
теста файла.

**Воспроизведение:**

```
$ node scripts/mutation-gate.mjs --id=opening-gate-flip-cancels-turn
ok   чистый прогон: ... node --test --test-name-pattern="shared renderer centres defaults" test/opening-symbol.test.mjs
FAIL opening-gate-flip-cancels-turn: тест остался зелёным на сломанном коде
поймано 0 из 1
```

Причина видна напрямую: паттерн не матчит ни один подтест, `node --test`
выполняет 0 тестов и рапортует `pass 1` (файл целиком) с exit code 0 — и на
чистом дереве, и на мутированном. Guard стал тождественно зелёным независимо
от того, сломано направление ворот или нет.

Дешёвая проверка `test/mutation-gate.test.mjs` («якоря живы») этого не ловит:
она проверяет только присутствие патч-анкора в исходнике, а не то, что
`--test-name-pattern` matches. Полный `mutation-gate.mjs` (единственное место,
где это видно) — предрелизный/еженедельный гейт
(`.github/workflows/mutation-gate.yml`), не гейт этого code review; поэтому
автор, прогнавший только новый мутант по имени, не был обязан это заметить
типовым implementation-гейтом, но ТЗ §14 прямо требует: «Существующий
`opening-gate-flip-cancels-turn` сохраняется и обязан продолжать падать».
Сейчас это не так — обязательство не выполнено.

**Почему это Medium, а не High:** реальную регрессию направления поворота
ворот по-прежнему ловит обычный `npm test` (assertions теста выполняются
целиком без фильтра имени, см. `demo/smoke_isometric_contract.mjs` /
`isoGateFlipReversesTurn` — независимое дублирующее покрытие тоже green).
Пострадала только дисциплина «тест обязан уметь падать» применительно к этому
конкретному mutation-guard, не пользовательское поведение.

**Почему в скоупе, не отдельный issue:** тест переименовало само это изменение
(`test/opening-symbol.test.mjs` — файл диффа задачи), а не соседняя
подсистема; PROCESS.md/#202 требует чинить Medium-в-скоупе на месте.

**Исправление:** привести `--test-name-pattern` в
`scripts/mutation-gate.mjs:1678` в соответствие новому имени теста (например,
`"shared renderer centres every flip"`) и повторно прогнать
`node scripts/mutation-gate.mjs --id=opening-gate-flip-cancels-turn`, ожидая
`поймано 1 из 1`.

Других находок нет.

## Что проверено и корректно

- **AC1** — `openingSymbolOffset()` возвращает точный `{ox:0, oy:0}` для всех
  комбинаций; сигнатура сохранена (`_type/_flipV/_angle/_face`, допущение §19.2).
  `test/opening-symbol-placement.test.mjs` — единый тест-матрица: 4 типа × 2
  flip × 5 углов (включая `NaN`) × 5 faces (включая `Infinity`/`NaN`/нулевую
  грань) — честная замена прежних трёх сценариев, мутант ловится 1/1
  (проверено исполнением, см. «Как проверялось»).
- **AC2/AC3** — Flat (`src/render/opening-symbol.ts`) и Iso
  (`src/iso-openings.ts:87`, не тронут — берёт тот же offset) используют один
  helper; `test/opening-symbol.test.mjs` и `test/iso-openings.test.mjs`
  раздельно проверяют «один origin» и «противоположный knob направления»
  (`scale(1 1)`/`scale(1 -1)`, `quarterVector[1]` знак). Прогонкой
  `demo/smoke_isometric_contract.mjs` подтверждено на реальном рендере.
- **AC4** — gate: offset остаётся нулевым, знак 10° поворота меняется;
  `opening-gate-flip-cancels-turn` mutant текстуально сохранён (но см. CR-1),
  дублирующее покрытие (`isoGateFlipReversesTurn` smoke, полный `npm test`)
  подтверждает поведение реально работает. Passage не создаёт символ — не
  тронут (`type === 'passage'` ветка убрана из helper, но `renderOpeningVisibleGeometry`
  для passage не рисует geometry вообще, проверено чтением).
- **AC5** — room-wall/partition parity: `demo/smoke_wall_thickness.mjs`
  (`doorSavedFlipStaysCentered`) и `demo/golden/matrix.mjs` (обе grани
  `positiveFace`/`negativeFace` в unit-тесте дают одинаковый ноль) — проверено
  исполнением.
- **AC6** — толстая стена: `src/wall-thickness.ts` тронут только в
  комментарии, `openingInnerFaceOffset` (physical half-depth/jamb) не задет;
  `demo/smoke_wall_thickness.mjs` (`thickWallFullHatched`,
  `thickWallStaticHatched`, `openingCutsSlab`) green — проверено исполнением.
  Lock badge/hitbox/actions — не тронуты диффом (проверено чтением: ни один
  файл лок-гарда/hitbox в diff не участвует).
- **AC7** — модель данных: diff не содержит правок schema/backend/migration
  (`git diff --stat` подтверждает — только `src/opening-symbol-placement.ts`,
  `src/render/opening-symbol.ts`, `src/wall-thickness.ts` в `src/**`); `flip_v`
  остаётся тем же boolean-полем — проверено чтением.
- **AC8** — документы больше не обещают edge-align:
  `WALL-THICKNESS.md`, `ARCHITECTURE.md`, `ISOMETRIC.md`, `USER-GUIDE.ru.md`,
  `TESTING.md` синхронно правлены, оба changelog заполнены в том же коммите
  `0eb9ffe` — прочитано построчно, `check-docs` green.
- **AC9** — typecheck/test/build green, три бандла побайтово идентичны —
  подтверждено исполнением (SHA `806648ae6036…` совпал).
- **Golden-контракт**: `demo/golden/matrix.mjs`/`harness.mjs`/`run.mjs`
  заменяют `offset: 'edge'` на `'center'` и убирают саму опцию `'edge'` из
  допустимых значений; `test/golden-matrix.test.mjs` проверяет обновлённый
  контракт четырёх сцен и счётчик impact-сет = 67 (совпадает с числом,
  заявленным автором) — прогнано вместе с `npm test`, green.
- **Мутанты (реестр)**: три устаревших якоря (`opening-symbol-default-uses-room-face`,
  `opening-symbol-partition-follows-endpoints`, `opening-gate-flip-translates-leaves`)
  корректно удалены из `scripts/mutation-gate.mjs` и нигде больше не
  упоминаются (`grep` по всему дереву) — контракт §14 ТЗ выполнен, кроме CR-1.
- Трейлеры и changelog-требование `AGENTS.md`/PROCESS.md — оба коммита
  корректны.

## Чего не проверял

- Полный `npm run golden:verify` (77 different, 2 error, 3 missing — цифры
  автора не перепроверены построчно): предрелизный гейт по ТЗ §13.3, локальный
  accept всё равно запрещён; не влияет на вердикт code review.
- Полный `smoke_*` набор (167 смоков) — только три выбранных вручную плюс
  вывод `smoke-select` (НЕОПРЕДЕЛЁННОСТЬ) учтены; более широкий прогон не
  оправдан 6-символьной дельтой в 3 файлах.
- `python -m pytest tests_backend` — backend/schema не в диффе (AC7 разобран
  чтением).
- Расхождение «1113/1 skip» (автор) vs «1114/0 skip» (у меня) в `npm test` —
  вероятно, разница окружения (Chromium/иное), не влияет на код; не
  расследовалось глубже, так как оба результата green по существу задачи.

## Вердикт

Единственная находка — CR-1, Medium, в скоупе задачи. High нет. Продуктовое
поведение (offset, направление, jamb, parity, документация, changelog)
подтверждено и исполнением, и чтением, полностью соответствует ТЗ и решению
владельца. Возврат автору для точечного исправления `--test-name-pattern` в
`scripts/mutation-gate.mjs` и повторного прогона мутанта.
