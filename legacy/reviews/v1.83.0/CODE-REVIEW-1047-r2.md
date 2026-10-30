# CODE-REVIEW-1047-r2

Issue: #1047 · Трек: show · Этап: code · Заход: r2 · блокирующих циклов использовано 0/2
Материал: `85d572f0c04547e7f0700374b46a21297cb745c5` (merge `abbbde539` + принятый dev
`c05ebc484f2c64fbf62e550eaa4ebbee87f743e9` после #1029), ветка `issue/1047-decor-selection`.
Validate-gate на этом материале: https://github.com/Matysh/houseplan-card/actions/runs/40034553107
(success, headSha=85d572f0c) — review-light proof принят как хендофф, не повторялся.

## Скоуп

Бага #1047: после последовательного рисования декора (линия/прямоугольник/овал,
текст, мебель, изображение) панель Properties и рамка выделения оставались на
первом созданном объекте вместо последнего. Правка в `syncNative()`
(`src/editors/properties/editor.ts`) больше не выходит рано при уже валидной
`identity` в decor-режиме; новый геттер `selectedTextId` даёт
`measureHouseplanDecorText()` (`src/live-editor.ts`) измерять рамку новой подписи
при активном инструменте Text; `escape()` отдаёт Esc активному `_decorDraft`.
Один модуль/одна поверхность, миграций/новых полей/UX-контракта нет, touch/perf
не затронуты; поведение уже зафиксировано в `docs/USER-GUIDE.ru.md` §14 («После
создания объект остаётся выбранным») и `docs/DECOR-EDITOR.md` — задача чинит код
под уже описанный контракт. **Критерии §5 пройдены, `route: fix`** (как и в r1).

Этот раунд — не повторное ревью реализации: это технический перенос уже зелёного
r1-кандидата на новую базу `dev` после того, как #1029 достигла S8 раньше, чем
ветка #1047 успела слиться (владелец, 22:23:49 и 22:02:17 в issue). Предмет
проверки — дельта merge, а не код #1047 заново.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Находок в r1 не было (High 0, Medium 0, Low 0) | — | `docs/reviews/CODE-REVIEW-1047-r1.md`, раздел «Находки» |

## Унаследовано из r1

Документ `docs/reviews/CODE-REVIEW-1047-r1.md` (в дереве текущего материала,
коммит `10f666a67`), материал `bc56161892bb98551b54ff9dc939fd27a1ac47e4`
(SHA жив на origin, подтянут `git fetch origin
bc56161892bb98551b54ff9dc939fd27a1ac47e4`, хотя больше не достижим с ветки —
это нормальное следствие rebase, не находка, п. «Повторный раунд» REVIEWER.md).

Принято без повторной проверки — полный разбор AC1–AC3, причинный механизм
бага (`syncNative()` ранний выход, воспроизведён уже в `v1.82.0`),
корректность `stable-fix` в release-ledger, таблица «AC · чем доказан · чем
краснеет» с тремя непустыми третьими столбцами, трейлеры/changelog в исходном
продуктовом коммите.

Проверено заново в r2 (дельта): байтовое тождество проверенных путей между
материалом r1 и текущим HEAD —

```
git diff bc56161892bb98551b54ff9dc939fd27a1ac47e4 HEAD -- \
  src/editors/properties/editor.ts src/live-editor.ts \
  demo/smoke_decor_creation_selection.mjs \
  test/properties-editor.test.mjs test/live-editor.test.mjs
```
пусто для всех пяти файлов — реализация и целевой browser-тест #1047 не менялись.
Также пусты: `docs/DECOR-EDITOR.md`, `docs/release-ledger/v1.82.0/1047.json`,
запись #1047 в `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`. Полный
`git diff bc5616189..HEAD --stat` (75 файлов) состоит исключительно из
принятого содержимого #1029 (`custom_components/houseplan/zigbee_lqi*.py`,
`src/device-signal-runtime.ts`, `test/device-signal-runtime.test.mjs`,
`tests_backend/test_ha_zigbee_lqi.py` и т.д.) и механически регенерированных
реестров/счётчиков (`docs/STATUS.md`, `docs/reviews/INDEX.md`,
`scripts/ci-registry-inventory.json`, `scripts/mutation-registry.mjs` —
только добавленные записи `*-1029`, три мутанта `*-1047` не тронуты,
прочитано построчно). Самостоятельно перепроверено чтением причинного
механизма (не повтор r1, независимое прочтение): diff `origin/dev..HEAD` для
`editor.ts`/`live-editor.ts` содержит ровно тот же код, что описан в r1 —
`syncNative()` заменяет старый ранний возврат на `if (host._mode !== 'decor'
&& this.identity) return;` (прочие редакторы сохраняют прежнюю границу),
`selectedTextId` и фильтр `textBox` по нему, `escape()` с новой строкой
`if (this.host._decorDraft) return false;`. Подтверждено отсутствие
конфликт-маркеров (`<<<<<<<`/`=======`/`>>>>>>>`) в `src/**`, `demo/**`,
`scripts/**`, `docs/**`, `test/**` — merge чистый. `git status` рабочей копии
чист, `HEAD` = материалу.

## Как проверялось (дельта r2)

| Гейт | Результат | Источник |
|---|---|---|
| Validate-gate на `85d572f0c` | PASS, run 40034553107 — review-light proof принят, не повторялся | `gh run view 40034553107 --json headSha,...` → headSha=85d572f0c, conclusion=success |
| `Браузер: выбранные проверки push` | PASS; лог содержит `passed smoke smoke_decor_creation_selection.mjs` и `passed smoke smoke_properties_panel.mjs` на этом SHA | лог job того же run |
| `Переиспользование: это дерево уже проверено` | success | тот же run — дерево продуктовых файлов #1047 признано уже проверенным (совпадает с байтовым тождеством выше) |
| `Фронтенд: типы, юниты, мутанты, синхрон бандла` | success | тот же run |
| `Продукт: свежие проверки диапазона и упаковки` | success | тот же run (trailers/process-gate/bundle-sync на диапазоне origin/dev..HEAD) |
| `Мутанты по диффу` | skipped (nightly only) | тот же run — соответствует политике, не находка |
| Трейлеры 5 коммитов диапазона | PASS | `git log --format='%H %s%n%b' origin/dev..HEAD`: все несут `Issue: #1047`; продуктовый `0c22c5d06` — `User-Visible: yes` с правкой обоих `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в том же коммите (`git show --stat 0c22c5d06`); остальные 4 (merge/test/doc) — `User-Visible: no`, корректно |
| Классификация release-ledger `stable-fix` | подтверждена независимо: `git show v1.82.0:src/editors/properties/editor.ts \| grep syncNative -A2` — тот же ранний возврат `if (!this.wide \|\| this.identity \|\| this.fields.draft) return;` уже в `v1.82.0` | воспроизведено в этом раунде |
| «Одно число — один источник» | STATUS.md тестовые счётчики (Node unit 5189 / smokes 424) — генерируемая строка, правок вручную нет; других мест, где эти числа показаны отдельно, в диффе нет | чтением |

### Чего не проверял

- Полный browser-smoke матрикс/Golden — не затронуты этим раундом, тот же
  обоснованный пропуск, что в r1 (`track:show`, без `ci:golden`); предрелизный
  гейт, не гейт ревью (§8).
- `pytest tests_backend` — дифф #1047 не касается Python; #1029 имеет
  собственный зелёный `CODE-REVIEW-1029-r1.md`, за пределами этого раунда.
  Backend-гейты validate-gate (`Бэкенд: pytest в Home Assistant`) в этом run
  — skipped по той же task-plan классификации, что и в #1029 отдельно.
- Инварианты модели — геометрия/хранение не менялись ни в r1, ни в этой
  дельте.
- Исполнение зарегистрированных мутантов #1047 (`decor-creation-retains-
  properties-owner-1047`, `decor-created-text-frame-unmeasured-1047`,
  `decor-properties-escape-steals-draft-1047`) — запрещено ревьюеру вне
  ночного workflow; определения в `scripts/mutation-registry.mjs` подтверждены
  байт-в-байт неизменными относительно r1.
- Повторный полный разбор AC1–AC3 по существу — не требуется: реализация и
  целевой тест байтово идентичны материалу r1, где разбор уже выполнен и
  задокументирован (раздел «Унаследовано из r1»); AC1–AC3 этой дельтой не
  задеты (merge не касается кода/теста #1047).
- Ручная dev/GPU-приёмка владельцем — не гейт (§7.1, #929).

## Находки

Находок нет (High: 0, Medium: 0, Low: 0). Побочных находок вне скоупа нет —
новые issue не заводились. Снимок политики: `mode=issues` (issue #1047, этап
code, round 2) — маршрут неприменим, так как side-находок не возникло.

## Вердикт

Зелёный. Дельта раунда r2 — чистый технический перенос уже зелёного r1 на
обновлённый `dev` (merge принятой #1029): реализация, целевой browser-тест и
документация поведения #1047 байтово не изменились (проверено независимо,
не только заявлением автора), конфликт-маркеров нет, validate-gate на точном
материале зелёный с обоими именованными AC browser smoke PASS в этом же
прогоне, трейлеры и changelog в порядке, release-ledger `stable-fix`
перепроверен чтением `v1.82.0`. AC1–AC3 не затронуты дельтой и остаются
доказанными разбором r1. Route: fix — критерии §5 пройдены (как в r1):
сложность/риск низкие, одна поверхность, нет миграции/нового UX-контракта/
влияния на perf-touch, поведение уже зафиксировано в USER-GUIDE.ru.md §14 и
DECOR-EDITOR.md.

---

<!-- material-anchors: заполняется ревьюером -->

## Материал раунда

- Ветка: `issue/1047-decor-selection`, коммит `85d572f0c04547e7f0700374b46a21297cb745c5`.
- Тело issue: digest `7e3812adbe01ccc0504e6b7f6f15b19f1e7a309359e6a8c7859d250c0474ce41`.
- Вердикт этого раунда: `green` · High 0 · Medium 0 · маршрут `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1047-decor-selection`, коммит `85d572f0c045` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7efec7736462e5593c4925899c5a078e7fff6ed6`
  ```
  git log --all --format='%H %T' | grep 7efec7736462
  ```
- Тело issue: `7e3812adbe01ccc0504e6b7f6f15b19f1e7a309359e6a8c7859d250c0474ce41`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTg3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Niwib3V0cHV0X3Rva2VucyI6MjU3MTksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE0NTgyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDE0OTkwNywiY29zdFVzZEVzdGltYXRlIjoxLjU0NTY3MTR9XSwidHVybnMiOjU2LCJkdXJhdGlvbk1zIjoyOTkzNDIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjU1MDg1ODQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5178 output_tokens=25738 cache_creation_input_tokens=114582 cache_read_input_tokens=4149907 num_turns=56 -->
