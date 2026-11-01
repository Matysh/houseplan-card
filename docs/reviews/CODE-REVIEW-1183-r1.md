# Код-ревью #1183 — читаемость подписей смешанной прозрачности (r1)

## Скоуп

Материал: `b7ec51fa754b36bedb55a4fbee0769103c00a9ac` (единственный коммит
`b7ec51fa7 fix: let mixed opacity labels share the compact color field`,
база `740b42784`). Изменённые файлы: `demo/smoke_decor_multiselect.mjs`,
`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`,
`docs/release-ledger/v1.83.0/1183.json`, `scripts/ci-registry-inventory.json`,
`src/styles/form-kit.styles.ts`.

Трек show, этап code, заход r1. Задача восстанавливает поведение, принятое
#1150 AC3 и #1038 (читаемость смешанных значений в compact Properties),
регресс которого диагностирован (без права чинить продукт) в #1182.

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT (body issue, handoff, ciEvidence),
`read:diff` (полный патч), `read:log` (диапазон — один коммит),
содержимое `src/styles/form-kit.styles.ts` целиком вокруг `colorFieldsCss`,
консьюмеры `colorFieldsCss(..., 'property')` по `src/` (ровно один:
`src/editors/properties/styles.ts:95` → `.hp-properties .hpf-colorfield`),
и `docs/release-ledger/v1.83.0/1182.json` для сверки формата/цепочки с
диагностическим issue.

Независимое прослеживание кода (до чтения авторского объяснения):
- Правка — одна новая CSS-строка в `colorFieldsCss`, только в ветке
  `density !== 'standard'` (compact), внутри `:has(.${p}-inline-hex)`
  (т.е. не затрагивает обычные View/dialog поля — они используют ветку
  `standard`, которую diff не трогает).
- Новое правило `${field}:has(.${p}-inline-hex):has(.${p}-inline-alpha:placeholder-shown)`
  переключает `grid-template-columns` с `24px minmax(56px,1fr) 28px 8px` на
  `24px minmax(56px,1fr) minmax(0,1fr) 8px` **только** когда alpha-инпут
  показывает placeholder (т.е. пуст — mixed-состояние). Заполненная alpha
  возвращает `:placeholder-shown` в `false`, колонка снова фиксируется на
  28px — это единственный путь, которым в коде удерживается
  `filled_alpha_keeps_28px`.
- `image` (alpha-only, без `.${p}-inline-hex`) под селектор не попадает —
  подтверждено и структурой разметки (только один консьюмер compact-density,
  `.hp-properties`), и измерением ниже.
- Правка не вводит новый `--prop-*` токен и не создаёт локальную краску —
  единственный владелец `colorFieldsCss` не продублирован (AC3).

Правка теста (`smoke_decor_multiselect.mjs`): вместо булева агрегата
тест теперь возвращает подробные измерения (`value/placeholder/width/
left/right/fieldLeft/fieldRight/height/font/available/text`) для каждого
inline-инпута, добавлен фолбэк `context.font` на computed-longhands (на
случай, когда `style.font` пуст из-за `font-variant-numeric`) и
`context.letterSpacing` — это делает замер площже/строже, а не слабее
(измеряемая ширина текста не может стать меньше реальной). Добавлены:
проверка `*_keep_36px` на обеих раскладках (en/ru), RU-прогон тех же
mixed-замеров, `locale_does_not_write` (переключение языка не пишет
конфиг) и `filled_alpha_keeps_28px` после заполнения alpha. Критерий
`available>=text` не ослаблен — он тот же, что был, просто считается
точнее и для большего числа типов (rect/ellipse/line/text/furniture/image).

Исполненные проверки (после независимого разбора, адресно под изменённые
файлы и затронутый AC; `review-execution-policy` → `run_check`):

| check_id | Результат |
|---|---|
| `read:diff` | исполнено, PASS (прочитан полный патч) |
| `read:log` | исполнено, PASS (один коммит в диапазоне) |
| `build:build` | PASS (нужен для материализации бандла под smoke) |
| `build:bundle:sync` | PASS (demo-сервер читает синхронизированный бандл) |
| `smoke:demo/smoke_decor_multiselect.mjs` | PASS, итог `OK` — см. разбор ниже |
| `static:ci-registry-inventory` | PASS (пусто stdout/stderr) |
| `unit:test/release-ledger.test.mjs` | PASS |
| `unit:test/user-stable-changelog.test.mjs` | PASS |
| `build:test` | PASS (подготовка `test-build` для form-kit теста) |
| `unit:test/form-kit.test.mjs` | PASS |
| `build:typecheck` | PASS |

Первый вызов `smoke:demo/smoke_decor_multiselect.mjs` падал с
`Failed to fetch dynamically imported module` — бандл не был материализован
для demo-сервера; после `build:build` + `build:bundle:sync` (ordinary build,
не правка продукта/мутант) прогон PASS. Аналогично `unit:test/form-kit.test.mjs`
сначала падал `ERR_MODULE_NOT_FOUND test-build/...`, закрыт `build:test`.
Это подготовка fixed-check runner, а не изменение предмета ревью (#905).

Переиспользовано без повторного исполнения: validate-gate для точно этого
SHA (https://github.com/Matysh/houseplan-card/actions/runs/41299304208,
«review-light-golden proof is complete») — golden-сверка
`decor-multiselect-light/dark` и общий CI PASS по этому материалу не
пересчитывались повторно; полная smoke-матрица (500+ файлов) и
`smoke:demo/smoke_ui_polish_963.mjs` не перезапускались — задача
однoповерхностная (один compact color field), риск вне поверхности не
обнаружен при чтении диффа и grep по консьюмерам.

## Разбор по AC

**AC1** (читаемость mixed-плейсхолдеров rect/ellipse/line/text/furniture,
EN/RU, без регрессии image/заполненных полей). Доказано исполнением:
прогон `smoke:demo/smoke_decor_multiselect.mjs` на материале `b7ec51fa7`
дал `available=129 ≥ text=83.15625` (EN) и `available=129 ≥ text=96.19921875`
(RU) для всех пяти типов с hex, `height=36` на обеих раскладках, `image`
не регрессировал (`available=245` при `text` того же порядка, `width=249`).
Итог прогона — `OK` (все `check()` прошли). Числа совпадают с теми, что
приводит хендофф для зафиксированного fix-состояния.

Защитный AC (регрессия/читаемость) — обязательная строка «чем краснеет»:
обычный негативный случай с результатом взят из хендоффа автора (а не
воспроизведён мной повторно, т.к. воспроизведение требовало бы временного
патча продукта — исполнения мутанта вне ночного workflow, что запрещено
правилами ревью #905): до правки `unchanged-product` давал ровно 6 RED
(`mixed_labels_readable` для rect EN и всех языковых/связанных вариантов,
внутреннее место alpha 24px при тексте 83.15625px EN/96.19921875px RU,
свободная hex-колонка 233px) — то есть ровно то переполнение, которое
описано в проблеме issue. Эти же text-метрики (83.15625/96.19921875)
я получил и в своём PASS-прогоне fix-состояния, что независимо
подтверждает: разница между RED и PASS — именно доступная ширина (24px
→ 129px), а не смена текста/шрифта/локали между замерами.

**AC2** (поле остаётся 36px, обычная заполненная alpha — 28px, preview/
commit/Escape/Undo/Redo/opposite-alpha/persistence не меняются, язык не
пишет конфиг). `mixed_fields_keep_36px`/`mixed_ru_keeps_36px` и
`filled_alpha_keeps_28px` — новые проверки в том же смоуке, PASS в моём
прогоне. `locale_does_not_write` — PASS (переключение en→ru→en не
увеличивает `writes`). Остальные перечисленные в AC2 поведения (commit/
Escape/Undo/Redo/alpha_keeps_color/one_command_per_field) — существующие,
неизменённые проверки того же файла, подтверждены тем же зелёным прогоном
(`OK`, весь файл выполняется одним процессом, ни один `check()` не упал).

**AC3** (правка в общем compact `colorFieldsCss`, без локальной альтернативной
краски/нового `--prop-*`; line-fix(introducedBy 1150) против v1.83.0).
Подтверждено чтением: единственная новая строка — в общей функции
`colorFieldsCss` (`src/styles/form-kit.styles.ts:234`), единственный
потребитель compact-варианта — `.hp-properties .hpf-colorfield`
(`src/editors/properties/styles.ts:95`), новых CSS custom properties нет.
Классификация `line-fix`/`introducedBy:1150`/`baseStable:v1.83.0` в
`docs/release-ledger/v1.83.0/1183.json` соответствует таблице PROCESS.md
(«Правка новой функции, которой в предыдущем stable ещё не было»): #1150
попал только в `v1.84.0-beta.1` (ещё не stable), #1183 его чинит —
это ровно случай `line-fix`, milestone не требуется отдельно. Формат файла
согласован с соседним диагностическим `docs/release-ledger/v1.83.0/1182.json`
(та же цепочка: 1182 диагностирует, 1183 чинит продукт). `static:ci-registry-inventory`
и `unit:test/release-ledger.test.mjs` подтверждают консистентность
автогенерируемого `scripts/ci-registry-inventory.json` и валидность ledger-файла.

## User-Visible / changelog

Оба технических changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`)
правлены в одном и том же (единственном) коммите диапазона — структурно
требование «User-Visible: yes → оба changelog в одном коммите» выполнено,
т.к. иного коммита в диапазоне нет. `unit:test/user-stable-changelog.test.mjs`
PASS. Текст трейлеров (`Issue:`/`User-Visible:`) самого коммита independent
не проверен посимвольно: доступный оракул `read:log` отдаёт только oneline
(`git log --oneline`), отдельного check на полное тело коммита/трейлеры в
манифесте нет, а Bash/Edit недоступны по tool policy — честно фиксирую это
как границу доказательства, не как находку (контент обоих changelog и число
видимое пользователю — одно: формулировка про compact Properties — совпадает
дословно по смыслу en/ru).

## Что не проверялось и почему

- Полная smoke-матрица (500+ demo-файлов) и общий `gate:small` — не
  запускались: задача однoповерхностная (один общий compact color field,
  подтверждено grep по консьюмерам), полный гейт непропорционален объёму
  правки (§8); релевантный смоук прогнан адресно.
- `smoke:demo/smoke_ui_polish_963.mjs` и golden-сравнение
  `decor-multiselect-light/dark` — переиспользованы из зелёного
  validate-gate для точно этого SHA (`review-light-golden proof is complete`),
  повторно не исполнялись: входы/среда/oracle не менялись.
- Повторное воспроизведение RED на unchanged-product — не выполнялось
  (запрещённый мутант продукта); принято описание автора как обычный
  negative-input case с результатом, см. раздел AC1.
- Полный текст коммит-трейлеров — см. раздел выше, граница доказательства
  оракула, не находка.

## Находки

Находок уровня High/Medium в рамках диффа не обнаружено. Правка узкая,
единственная поверхность, соответствует принятому контракту #1150 AC3/#1038,
не вводит новых токенов/UX-решений/миграций, не затрагивает standard-density
поля и image-тип, подтверждена прямым измерением в браузере на материале
`b7ec51fa7` после пересборки бандла.

Побочных находок вне скоупа этой задачи не выявлено.

## Маршрут и вердикт

Критерии §5 (show): complexity/surfaces/migration/ux-contract/perf-touch/
undocumented — все выполняются (одна CSS-строка в одном общем владельце,
без миграций, без нового UX-контракта, без влияния на перф/touch, поведение
уже зафиксировано в #1150 AC3/#1038).

**route: fix**
**verdict: green**

Гейты: прогнаны адресно (см. таблицу выше) под изменённые файлы и
конкретные AC; переиспользован зелёный validate-gate точно этого SHA для
golden/полного CI. Полные `gate:small --smokes`/вся smoke-матрица не
запускались как непропорциональные объёму правки.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQ1ODI2NTQ2ZWY5M2E4ZTFhN2I5YTRmNTI1ZTgyM2QzMmNlNzM2YzFkODMzNzAyMzdmM2QxZTZmNTM0ZTAwZGIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxOTljNTRjY2Q2Y2ZmNDQxNmNiMDRjNjUzYzE2NTY4NTgxYjViMDIxMTE2NjI3ZjY1NjhmNjk5N2FiYzliODgxIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTgzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJiN2VjNTFmYTc1NGIzNmJlZGI1NWE0ZmJlZTA3NjkxMDNjMDBhOWFjIiwidHJlZSI6ImExYmYyNTFiOTI5YTM5ZTJmM2Q2NzYzNjIxOGQwNjFmNGUzZGFhN2IiLCJib2R5RGlnZXN0IjoiNmY2YWFmYzdlNTgxNzA3ZWU1N2YwZDJmNTU4NjQxOTBhOTc5ZDU1NDEzYTZkOWU2NzQ3MmUxNjEyZDBjMTJkYyIsInByb2R1Y2VyUnVuIjoiNDEzMDEwNjI4NTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjI5NmNlNmEzNDBiZWQ2NTgxZWJjMzFhOTRlMDVjNzQ2ZjVlNzJhZWIyODAyY2UzMDY1Mzk1Yzk0NDM4NjExODQiLCJ2ZXJkaWN0RGlnZXN0IjoiYmRiZWUwMjdlMTkyYTJkNDQwNmUxOWNlZjFjYmE2N2M4ZGVlNTJkZmIwM2VjYzQ3ZjcyNmQ5MDY0YmJlMTY1MSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjNTU4MWNjMGUyZjkwYmMwNDdmNGZhOWVlNmUzMjBlNTFiYzdhMmQ4OGQ5NWI4MjY4MzFjYmE1OWI3NjY0MjI2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU3MzIxMDI2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTgzI2lzc3VlY29tbWVudC02NTU3MzIxMDI2IiwiYm9keURpZ2VzdCI6IjMyZGE4YTI2ZmVlMjg0ZDc3YmViNDVmMDA2MzgzNDgxOTI2ZDFkNTM3NmM5NmQ2NjY0NGE1ZTNjYjI0ODY5ZTAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1183-readable-mixed-opacity-native`, коммит `b7ec51fa754b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a1bf251b929a39e2f3d67636218d061f4e3daa7b`
  ```
  git log --all --format='%H %T' | grep a1bf251b929a
  ```
- Тело issue: `6f6aafc7e581707ee57f0d2f55864190a979d55413a6d9e67472e1612d0c12dc`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41301062854,"run_attempt":1,"digest":"e4bab4f292db974cf9ed7604f6772d2b340b0b77f9cffde730ea8792d2bd2ee3"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjQsIm91dHB1dF90b2tlbnMiOjI2OTYzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExMDk3NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI4NzE0MjAsImNvc3RVc2RFc3RpbWF0ZSI6MS4yODc5NDJ9XSwidHVybnMiOjM3LCJkdXJhdGlvbk1zIjo1ODg4ODksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjI4Nzk0MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=64 output_tokens=26963 cache_creation_input_tokens=110975 cache_read_input_tokens=2871420 num_turns=37 -->
