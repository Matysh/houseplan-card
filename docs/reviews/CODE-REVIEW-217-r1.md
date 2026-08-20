# CODE-REVIEW-217-r1

- **Issue:** #217 — внешняя рамка Text-маркера должна быть капсулой
- **ТЗ:** `docs/specs/217-text-shell-outline.md` (SPEC-REVIEW-217-r1, зелёный)
- **Ветка/SHA:** `issue/217-text-shell-outline` @ `39456dc` (implementation),
  предыдущий коммит `fe33dea` (spec), `c547586` (spec-review doc)
- **Диапазон:** `origin/dev...HEAD`
- **Трек:** обычный (не `small`)
- **Цикл:** r1/4
- **Вердикт:** зелёный · High: 0 · Medium: 0

## Скоуп ревью

Первый цикл — разбор полный. `git log --oneline origin/dev..HEAD` даёт три
коммита (spec, spec-review doc, implementation); `git diff
origin/dev...HEAD` — 17 файлов. Проверены: сам фикс в `src/styles.ts`,
source-regression тест, изменения в `demo/smoke_device_icon_design.mjs`,
golden-матрица (`demo/golden/matrix.mjs`, `harness.mjs`,
`test/golden-matrix.test.mjs`), reference-капчер (`capture_device_icon_reference.mjs`),
оба changelog, `docs/TESTING.md`, `docs/images/screenshots.json`, три копии
бандла, трейлеры коммитов. Соответствие AC1–AC9 из §13 ТЗ проверено по
каждому пункту.

## Как проверялось

Прочитаны целиком: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` §2.7/§7.2/§8/§12,
`docs/specs/217-text-shell-outline.md`, тело issue #217 и оба комментария,
`docs/reviews/SPEC-REVIEW-217-r1.md` (контекст спек-ревью), `src/styles.ts`
(строки 2013–2090 — весь блок `.device-shell`/`.device-shell-frame`),
`src/device-face.ts` (весь `renderDeviceFace`, классы `text-shell`/`with-values`).

Прогнаны гейты:

| Команда | Результат |
| --- | --- |
| `npx tsc --noEmit` | 0 ошибок |
| `npm test` | 957 pass / 0 fail |
| `npm run build` + `md5sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | одинаковый хеш `6b01daba677f602728d128dc80e25cfc` во всех трёх копиях |
| `node scripts/check-docs.mjs --external` | "Documentation checks passed (7 files, 10 external links)" |
| `node demo/smoke_device_icon_design.mjs` (изменён в этом диффе, покрывает AC1–AC5) | все флаги `true`, `OK` |
| `node demo/smoke_device_preview_parity.mjs` (AC7, названа в §14.2 ТЗ) | все флаги `true`, `OK` |
| `node demo/smoke_static_icon.mjs` (AC7, названа в §14.2 ТЗ) | все флаги `true`, `OK` |
| `npm run golden:verify` (диагностически, диф — CSS-геометрия, видимый результат меняется) | см. ниже |

Дисциплина «тест должен уметь падать» — применена к обоим тестам, которые
покрывают сам фикс:

- временно вернул старый селектор `.device-shell:not(.with-values)
  .device-shell-frame` (без `:not(.text-shell)`) в `src/styles.ts`, пересобрал,
  скопировал бандл в `demo/srv/assets/`, прогнал `smoke_device_icon_design.mjs` —
  красным стали ровно `textShellIsStadiumAtRepresentativeSizes: false` и
  `textShellMutationGuardRejects50Percent: false`, остальные 39 флагов не
  затронуты;
- на том же мутанте прогнал `node --test
  test/device-marker-polish-contract.test.mjs` — 6 pass / 1 fail (упал именно
  новый тест `issue 217 keeps the Text shell stadium...`);
- восстановил `src/styles.ts` из git, пересобрал, скопировал все три копии
  бандла — хеши снова совпали с закоммиченными (`6b01daba677f602728d128dc80e25cfc`),
  `git status` чист.

`npm run golden:verify` (диагностический Linux-раннер, не гейт код-ревью):
90 сценариев, `passed` — 84, `different` — 2, `missing-baseline` — 2, `error` — 0.

- `missing-baseline`: `device-text-shell-long-{light,dark}` — новые сценарии
  из этого диффа, у них по определению ещё нет принятого baseline. Просмотрел
  `artifacts/golden/actual/device-text-shell-long-{light,dark}.png`: маркер
  `498 ppm` показывает корректную stadium-форму (полукруглые торцы, прямой
  средний участок сверху/снизу) в обеих темах — визуально решает ровно тот
  сценарий, который описан в §2 ТЗ.
- `different`: `device-icon-state-table-{light,dark}` — существующий,
  ранее принятый baseline. Просмотрел `artifacts/golden/diff/*.png`:
  расхождение строго локализовано на одном маркере — `golden-left-temperature`
  (Text-only, `display: value`, длинное значение "Complete long localized
  state..."), его внешняя рамка стала капсулой вместо эллипса; стены, комнаты,
  остальные маркеры (Double/badge, Icon-only, presence, climate, LQI) пиксель
  в пиксель не изменились. Это ожидаемый побочный эффект того же самого фикса
  на уже существующем сценарии — доказательство, что фикс работает
  единообразно, а не находка. Принятие обновлённого baseline — пре-релизный
  шаг (`npm run golden:accept -- --reviewed` на Linux CI-артефакте, AGENTS.md
  «Gates»), не действие код-ревью; тот же паттерн зафиксирован в
  `docs/reviews/CODE-REVIEW-213-r1.md`.

Не прогонялись и почему:

- полный набор `demo/smoke_*.mjs` (127 файлов) — диф не задевает стены, tray,
  sun/glow, openings, isometric и т.п.; `golden:verify` выше подтвердил, что
  все сценарии этих поверхностей `passed` без изменений, значит расширять
  смок-набор не нужно;
- `python -m pytest tests_backend -q` — диф не касается `custom_components/**/*.py`;
- перф-профили — AC8 не требует их явно, изменение CSS-only (одно правило,
  без нового JS/ResizeObserver/слоя), проверено чтением `src/styles.ts` и
  диффа `demo/smoke_device_icon_design.mjs` целиком — новых наблюдателей,
  таймеров или compositor-слоёв не добавлено;
- `npm run golden:accept` — не роль код-ревью (см. выше).

## Проверка AC (§13 ТЗ)

1. **AC1 (stadium shell).** Подтверждено визуально по обоим новым golden-кадрам
   и смоком `textShellIsStadiumAtRepresentativeSizes`. ✅
2. **AC2 (защита от `50%`).** Source-тест `test/device-marker-polish-contract.test.mjs`
   и browser-мутант в смоке оба красны на documented mutant — проверено ручным
   реверсом селектора (см. выше). ✅
3. **AC3 (матрица размеров).** `textShellSizeMatrix` в смоке проходит все пять
   размеров (24/32/56/96/112) с допуском `<=0.5px` для радиуса/инсета. ✅
4. **AC4 (геометрическая совместимость).** Изменение — только `border-radius`
   одного CSS-правила; `width`/`height`/`inset` этим свойством не затрагиваются
   ни в спецификации CSS, ни фактически (golden-диф показывает identical
   footprint, меняется только форма угла). Проверено чтением + golden-диф. ✅
5. **AC5 (соседние варианты).** `iconShellIsCircle` и `doubleShellKeepsCapsule`
   в смоке — `true`; golden-диф подтверждает, что Icon-only/Double/badge
   маркеры в `device-icon-state-table-*` не изменились ни на пиксель. ✅
6. **AC6 (interaction parity).** `valueCapsuleOwnsHoverAndActionAtEveryPosition`,
   `hitAreaAtLeast44` — `true`; правка не касается `pointer-events`, hover- или
   action-кода — только `border-radius` в CSS, подтверждено чтением диффа. ✅
7. **AC7 (surface/theme parity).** `smoke_device_preview_parity.mjs`
   (`planPreviewEqual`, `planStaticEqual` — `true`) и `smoke_static_icon.mjs`
   (`planStaticCardParity` — `true`) плюс golden в обеих темах. ✅
8. **AC8 (data/i18n/security/perf).** Диф не содержит правок схемы, storage,
   i18n-ключей, `resolveToggleIntent`/`isControllable`/action-путей,
   `ResizeObserver`, media listener или анимации — проверено чтением всего
   диффа (`git diff origin/dev...HEAD`). ✅ — «проверено чтением, не исполнением».
9. **AC9 (release artifacts).** `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`
   правлены в том же коммите `39456dc` (`User-Visible: yes`), `docs/TESTING.md`
   получил новый раздел «Text marker shell shape (#217)»,
   `docs/images/screenshots.json` fingerprint обновлён и подтверждён
   `check-docs.mjs`, golden/smoke fixtures обновлены. ✅

## Трейлеры и класс изменений

- `fe33dea` (спек, класс C) — `Issue: #217` / `User-Visible: no` — корректно.
- `c547586` (документ спек-ревью, класс C) — те же трейлеры — корректно.
- `39456dc` (реализация) — `Issue: #217` / `User-Visible: yes`; правки
  `src/**` (класс A, только CSS), `test/**`/`demo/**` (класс B),
  `dist/**`/`custom_components/houseplan/frontend/**`/`demo/srv/assets/**`
  (класс D, три копии синхронны), `docs/**` (класс C, оба changelog в том же
  коммите — соответствует требованию AGENTS.md). Всё в одном коммите,
  ветка не содержит признаков ребейза на ушедший вперёд `dev` (три коммита
  линейно продолжают `origin/dev`).

## Находки

Нет находок High или Medium. Low не обнаружено (терминология changelog
"капсульную форму" соответствует `docs/USER-GUIDE.ru.md`; спек-ревью уже снял
единственный Low прошлого этапа — слово "stadium" в тексте ТЗ, не в
user-visible строке).

## Что проверено и корректно

- Сам фикс — `src/styles.ts:2061`: сужение селектора
  `.device-shell:not(.with-values) .device-shell-frame` до
  `.device-shell:not(.with-values):not(.text-shell) .device-shell-frame`.
  Единственная строка продуктового кода, ровно то, что предсказано §11 ТЗ
  ("сузить circular override так, чтобы он не захватывал Text").
- Комбинация классов `text-shell` + `with-values` (Text с badge) не затронута:
  такой маркер и раньше не попадал под circular override (уже был исключён
  `:not(.with-values)`), новое условие `:not(.text-shell)` для него избыточно,
  но не вредит — подтверждено чтением `src/device-face.ts:96-101`.
- Regression-тест и browser-мутант доказанно умеют падать (ручной реверс,
  см. «Как проверялось»).
- Побочный эффект на уже принятом golden (`device-icon-state-table-*`)
  локализован ровно на затронутом маркере, остальная сцена не сдвинулась —
  подтверждает, что фикс не расширяет blast radius за пределы Text-shell.
- Три копии бандла синхронны после чистой пересборки; фингерпринт скриншотов
  обновлён и проходит `check-docs.mjs`.

## Чего не проверял

- Полный `demo/smoke_*.mjs` (127 файлов) — не запускал; необходимость
  отсутствует, см. «Как проверялось». Косвенно покрыто через `golden:verify`
  (все нетронутые поверхности — `passed`).
- `python -m pytest tests_backend` — не запускал, диф не касается backend.
- Performance-профили (`performance_smoke` и аналоги) — не запускал; AC8 не
  требует их явно, изменение CSS-only проверено чтением.
- Принятие/пересчёт golden baseline (`npm run golden:accept -- --reviewed`) —
  сознательно не выполнял: это пре-релизный шаг на полном Linux CI-артефакте,
  не входит в роль код-ревью (прецедент — CODE-REVIEW-213-r1). Два
  `missing-baseline` и два `different` сценария должны быть приняты перед
  публикацией беты — фиксирую это как ожидаемый следующий шаг, не как
  блокирующую находку.
- Ручное браузерное тестирование за пределами `smoke_*.mjs`/`golden:verify` —
  не проводилось; по процессу ручного тестирования в цикле код-ревью нет.
