# CODE-REVIEW-1019-r1

Issue: #1019 · Трек: ask · Этап: code · Заход: r1 · Блокирующих циклов: 0/4
Материал: `b044e57b5aae518c467867ab6de084d7329072ec` (origin/dev..HEAD = 11
коммитов, диапазон тот же, что проверен validate-gate)

## Скоуп

ТЗ #1019 требует: (1) перечень миграции на UI Kit диалогов для всех 11
потребителей, (2) разбор и удаление доказанных CSS-сирот из аудита, (3) новый
гейт `gate:small` на CSS-сироты/неиспользуемые `@keyframes` без безразмерного
allowlist, (4) правило «перевод на кит удаляет локальное правило в том же
коммите», (5) golden-доказательство без сдвига кадров, (6) уменьшение bundle
редактора. Поведение, разметка и API кита не меняются (User-Visible: no на
всех 11 коммитах).

Работа закрывает техдолг J4/J6 (`docs/SCOPE.md`): поддерживаемость кода
диалогов/редакторов, без изменения видимого поведения для персон.

## Как проверялось

**Принятый proof (не повторялся):** validate-gate на точном материале
`b044e57b5aae518c467867ab6de084d7329072ec` —
https://github.com/Matysh/houseplan-card/actions/runs/40080885202 (success).
Прогнаны и зелёные: Hassfest, HACS, «Фронтенд: типы/юниты/статический
mutation-gate/синхрон бандла», «Бэкенд: pytest HA», «Геометрия: TS/Python
parity», «Браузер: выбранные проверки push» + 3 шарда смоков, «Перф-смок:
бюджет кадра», «Доказательство выполненных проверок». «Мутанты по диффу» и
«Golden-кадры против принятых эталонов» — `skipped` по дизайну (мутанты —
только ночью, #709; задача не принимает глобальные эталоны, #827/AGENTS.md).
Это и есть «review-light-golden proof», на него ссылается хендофф 11
native/canonical сравнений (117+11 пар) и 9 именованных AC-смоков.

**Адресные проверки, которые я выполнил сам** (для находок, не покрытых одной
ссылкой на CI, и чтобы лично убедиться, что новый B-гейт умеет падать):

| Проверка | Команда | Результат |
| --- | --- | --- |
| Новый CSS-сканер на реальном дереве | `node scripts/css-orphans.mjs` | PASS: 443 TS, 431 sheets, 1142 consumers, 0 diagnostics, 0 unresolved — совпадает с хендоффом |
| Юниты сканера, включая negative-input | `node --test test/css-orphans.test.mjs` | 24/24 PASS; тест `CLI --root gives file/name failures and is a mandatory gate step` реально спавнит `scripts/css-orphans.mjs` на синтетической фикстуре с заведомым сиротой/неиспользуемым `@keyframes`, проверяет `exitCode===1`, точный текст `file:line` и что `summarize()` считает шаг `failed` — обычный отрицательный вход, не мутация продукта |
| Свежая сборка `test-build` + целевые юниты | `tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/support-feedback.test.mjs test/styles-split.test.mjs test/form-kit.test.mjs test/golden-matrix.test.mjs` | 9+70+57 → все PASS (support-feedback 9/9, styles-split+form-kit 70/70, golden-matrix отдельно учтён) |
| Статический mutation-gate (без исполнения) | `node scripts/mutation-gate.mjs --check` | static-readiness: definitions=1841, unique-source-reads=1003, execution=0/caught=unknown, warnings=5 (все — унаследованные, не новые); browser guards 500/200 — существующий зарегистрированный избыток, не новый |
| Чтение диффа семи «comment-only» модулей (`src/editors/properties/surface.ts`, `src/houseplan-card.ts`, `src/hp-device-preview.ts`, `src/iso-scene-render.ts`, `src/iso-tiles.ts`, `src/radar-setup.ts`, `src/space-render.ts`) | `git diff` построчно | Подтверждено чтением: единственное изменение — добавление `/* css-uses {...} */` аннотаций перед реальными `render`-операторами; единственная не-комментарийная правка — удаление одной пустой строки (`houseplan-card.ts`) — не меняет исполняемый JS |
| Поиск использования удалённых CSS-классов в текущем дереве | `grep -rn` по `iso-shadows`, `tool-partition`, `stem`, `stage.*edit.*room`, `signal-visibility`, `iconclear` в `src/`, `demo/`, `test/` | Ни одного живого потребителя для удалённых правил; `iso-shadows-svg` (отличный класс) — жив и не тронут |
| Проверка, что в самом сканере нет безразмерного allowlist/базового списка ошибок (AC4) | `grep` по `scripts/css-orphans.mjs`, `scripts/css-source.mjs` | Пусто — допустимая динамика выражена только через 7 точечных `css-uses` аннотаций в исходниках (см. ниже), не через глобальный список |
| Проверка допустимой динамики в исходниках | `grep -rn css-uses src/` | Ровно 7 аннотаций, каждая у фактического render-оператора, с `owner`/`values`/`reason` — соответствует ТЗ п.4 («явный конечный allowlist… с причиной и владельцем в исходнике, без глобального wildcard») |
| Таблица миграции 11 потребителей и перечень из девяти кандидатов-сирот | Чтение `docs/development-notes/dialog-style-migration.md` против тела issue и диффа стилей | Все 11 строк (General/Space/Room/Device/Vacuum/Radar/Help/PDF/Device inbox/Icon rules/Confirmations) и все 9 изначально названных кандидатов (`menuwrap`/`menu .hd`, `decorbar dcolor/dwidth`, `editbar sname`, `rlgear`, `zoomwrap slide-*`+keyframes, `tab drop-*`, `editor-secondary-host kind-palette`) разобраны с историческим коммитом-причиной; `slide-*`/`drop-*`/`kind-*` оставлены как живые (проверено чтением шаблонов) |
| Wiring нового B-гейта | `git diff` `scripts/gate-small.mjs` | Шаг «CSS classes и keyframes имеют потребителей» добавлен как обязательный (без `informational: true`) |
| release-ledger | Чтение `docs/release-ledger/v1.82.0/1019.json` и соседних записей (#1007, #1009, #1011–#1018) | `category: "infra"`, обоснование соответствует характеру задачи (внутренняя чистка без видимого поведения); `visual` содержит новый golden-кадр `css-migration-rules-invalid-dark` (`expectation: "new"`) и 9 именованных смоков из AC; `introducedBy` не требуется — #1007 сам заведён как `stable-fix` относительно уже выпущенного v1.82.0, а не как новая бета-функция |

**Чего не проверял и почему не требовалось:** полный `npm run gate:small`,
`ci:golden` против глобальных эталонов и полную browser-матрицу — уже
исполнены и зелёные на этом же SHA в принятом validate-gate; повторный прогон
того же входа/среды/oracle запрещён политикой (#857). Исполнение
зарегистрированного свидетеля `editor-styles-adoption-dropped-from-runtime` —
не исполнял: это запрещённое вне ночного workflow исполнение мутанта (общая
политика); хендофф честно помечает его «не исполнялся», что и требуется
таблицей «чем краснеет». Windows-сборку бандла (AC6, фактические цифры
raw/gzip) не переизмерял — воспроизвёл бы инфраструктурное измерение другого
toolchain без нового риска для продукта; validate-gate джобы «Упаковка:
свежие артефакты кандидата» и «Продукт: свежие проверки диапазона и
упаковки» на этом SHA зелёные.

## Находки

Нет High и Medium находок, ни в скоупе, ни вне скоупа. Побочных находок нет
(снимок `REVIEW_FINDINGS_POLICY`: `mode=issues` — новых issue не заводится,
заводить нечего).

## Что проверено и корректно

- AC1 — таблица всех 11 потребителей с конкретными файлами/шаблонами,
  текущим общим владельцем и обоснованием KEEP/REMOVE на уровне отдельных
  свойств (не только целых правил) — проверено чтением и выборочно сверено с
  действующими шаблонами (`.hpf-signal-visibility`, `.hpf-iconclear` —
  реально нет текущих producer'ов в `src/`).
- AC2 — все девять изначально названных кандидатов разобраны с историческим
  коммитом; независимый `grep` по дереву подтверждает отсутствие живых
  потребителей удалённых правил, а `.iso-shadows-svg` (похожий, но другой
  класс) не задет.
- AC3/AC4 — реальный CLI (`scripts/css-orphans.mjs`) включён как обязательный
  шаг `gate:small`, 0 диагностик на полном дереве, 24/24 юнит-теста включают
  позитивные/негативные фикстуры (encoded classes, constant-false ветки, URL
  в data: literal, animation-name grammar, opaque CSS sinks, native nesting) и
  исполнение реального CLI с ожидаемым exit 1 — доказательство «чем
  краснеет» для защитного AC присутствует и исполнено, не просто
  зарегистрировано.
- AC5 — ledger `visual` содержит новый кадр с `expectation: "new"`,
  9 именованных AC-смоков; валидируемый (browser) слой validate-gate зелёный
  на материале; смоки `smoke_editor_styles_lazy.mjs` точно проверяют новое
  распределение владения (`.supportform > label:not(.srcrow)` теперь у
  отдельно принятого common-kit, а не у editor-only листа) вместо ослабления
  проверки.
- AC6 — семь «producer»-аннотаций в продуктовом коде не меняют исполняемый
  JS (только комментарии) — проверено построчным чтением диффа, а не со слов
  хендоффа.
- Трейлеры `Issue: #1019` / `User-Visible: no` — на всех 11 коммитах
  диапазона; `User-Visible: no` корректен (внешний вид не меняется),
  changelog не трогается — согласовано.
- release-ledger `category: infra` обоснован и согласуется с соседними
  записями того же цикла; `introducedBy` не требуется, так как #1007 сам
  классифицирован как `stable-fix` относительно уже выпущенного v1.82.0, а
  не как новая функция этой беты.
- Нет сохранённого параллельного пути: уникальный общий CSS-путь (shared
  dialog kit) не дублируется, старые локальные правила удаляются в том же
  коммите, где теряют последнего потребителя (#1014 правило) — подтверждено
  построчным diff.

## Вердикт

Зелёный. High: 0, Medium: 0. Route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1019-css-orphans-post-ui`, коммит `b044e57b5aae` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `32c4b98ef06f0864b49e5e911c30a5246e55e721`
  ```
  git log --all --format='%H %T' | grep 32c4b98ef06f
  ```
- Тело issue: `7a674a19642a112983a145377c9e6cf0225f1c0a9be51ffc7cb81b788dee9009`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzEsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODY2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2OCwib3V0cHV0X3Rva2VucyI6MjM1NTcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTIwNzc4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzQ4NjYzNiwiY29zdFVzZEVzdGltYXRlIjoxLjQxNjE0NTE5OTk5OTk5OTl9XSwidHVybnMiOjQyLCJkdXJhdGlvbk1zIjozMzAyNzIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjQyMTAxMTIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4839 output_tokens=23576 cache_creation_input_tokens=120778 cache_read_input_tokens=3486636 num_turns=42 -->
