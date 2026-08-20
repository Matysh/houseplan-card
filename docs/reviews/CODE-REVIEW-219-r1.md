# Code review #219 — r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/219
- **Spec:** `docs/specs/219-lock-orange-palette.md`, зелёное `SPEC-REVIEW-219-r2.md`
- **Reviewed branch:** `issue/219-lock-orange-palette`
- **Reviewed range:** `origin/dev..HEAD` = `28d6b9c`…`84fa434` (ТЗ и ревью ТЗ,
  уже приняты на этапе spec) → `bc75e00` (единственный продуктовый коммит)
- **Base:** `origin/dev` at `b56e122`
- **Reviewer:** Claude, независимая сессия без контекста реализации

## Вердикт

**Зелёный · цикл r1/4 · High: 0 · Medium: 0.**

Единственный продуктовый коммит `bc75e00` заменяет старую black/amber
lock-палитру на red/green и унифицирует foreground всех цветных подложек
(`on`/`open`) по теме. Изменение точечное и декларативное — только
`src/styles.ts` — и покрыто исполняемыми contract-тестом и browser-smoke,
которые я лично прогнал, а contract-тест дополнительно проверил на
способность падать. Все 7 AC закрыты либо автотестом, либо чтением кода с
явной пометкой. Одна Low-находка снята без правки.

## Скоуп

Продуктовый файл — `src/styles.ts`:

- `.oplock.locked`/`.oplock.unlocked` (compact opening lock badge) и
  `.dev.lock-locked`/`.dev.lock-unlocked` (обычный marker) получили core/stroke
  `#66D17A`/`#F0410C` вместо `light-dark(#000,#252525)`/`#F0A00C`; foreground
  переведён на общий паттерн `light-dark(#fff,#252525)` + explicit
  `.theme-light`/`.theme-dark` overrides, как уже сделано у `.dev.on`;
- `.dev.open` получил тот же foreground-паттерн вместо постоянного `#4a2800`,
  плюс явные `.dev.theme-light.open`/`.dev.theme-dark.open`;
- ни geometry, ни stroke-ratio, ни selector order, ни alarm/hover/focus/
  selected/unavailable/virtual/press-правила не тронуты — весь остальной файл
  вне двух изменённых блоков идентичен `dev`.

Сопутствующие изменения: `test/device-marker-polish-contract.test.mjs` (новый
contract-тест issue 219), `demo/smoke_device_icon_design.mjs` (новый
`openingLockPaletteMatches`/`orangeGlyphsFollowTheme`/
`darkLockUsesGreenCoreAndDarkGlyph`, обновлённый reference override),
`demo/capture_device_icon_reference.mjs` + `demo/srv/reference/device-icons/README.md`
(runtime-override red/green поверх byte-identical designer SVG),
`demo/golden/matrix.mjs` + `test/golden-matrix.test.mjs` (сцена
`device-icon-state-table-*` теперь показывает `open` рядом с `on` и обоими
lock-состояниями), `docs/TESTING.md`, `docs/USER-GUIDE.md` +
`docs/USER-GUIDE.ru.md` (раздел «Замок» и таблица постоянных статусов —
заменяемый black/amber текст убран), оба changelog, `docs/specs/README.md`,
`docs/images/screenshots.json` (обновлён только `sourceFingerprint`, все 10
`imageSha256` без изменений), три сгенерированные копии бандла.

Ровно один продуктовый коммит `bc75e00`, трейлеры `Issue: #219` /
`User-Visible: yes` на месте, оба changelog в том же коммите, документация
(USER-GUIDE, TESTING) в том же коммите, что и поведение. Ветка
`issue/219-lock-orange-palette` соответствует правилу именования.

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm test` | **962/962 pass**, 0 skipped в этом окружении (`npm run inventory` подтверждает канонический счётчик 962 Node unit); хендофф указывает «961 passed, 1 skipped» — расхождение объяснимо `test/process-gate.test.mjs`, где 1 подтест условно `t.skip('нужен исполняемый stub gh')`/«git недоступен» в зависимости от окружения автора, файл не затронут этим диффом |
| `npm run build` + сверка трёх копий бандла | pass, все три `sha256` = `9c7df844ce825c0d56cfb65e82a0fbbb98620428d5aa5806abec0c40b1d9b1a2`, совпадает с хендоффом |
| `node --test test/device-marker-polish-contract.test.mjs` (targeted contract, назван в AC1/AC2/AC3) | pass (8/8) |
| Временный откат `--oplock-core-bg: #66D17A` → `#000` и повтор того же теста | **тест `issue 219 gives locks red-open green-closed…` красный** — дисциплина «тест умеет падать» подтверждена мной, а не только на слово автора |
| `node --test test/golden-matrix.test.mjs` | pass (26/26), включая новую проверку `deviceClassOverrides['golden-right-linkquality'] === ['open']` |
| `node demo/smoke_device_icon_design.mjs` (назван в AC1/AC3, хендоффе) | pass, все поля true, включая новые `openingLockPaletteMatches`, `orangeGlyphsFollowTheme`, `darkLockUsesGreenCoreAndDarkGlyph` |
| `node demo/smoke_device_preview_parity.mjs` (поверхность AC5 — Device preview) | pass |
| `node demo/smoke_static_icon.mjs` (поверхность AC5 — static space card) | pass |
| `node demo/smoke_lock_action.mjs` (смежная поверхность — lock action не должен был измениться) | pass |
| `node demo/smoke_lock_invariant.mjs` (смежная поверхность — lock invariant/SCOPE.md guard) | pass |
| `node scripts/check-docs.mjs --external` (AC7) | pass, 7 файлов, 10 внешних ссылок |
| `npm run golden:verify` | `device-icon-state-table-light`/`-dark` — **different**, ожидаемо (см. ниже); плюс 3 сцены, не названные в ТЗ — разобраны отдельно |

### Разбор `golden:verify`: почему «different» больше, чем в ТЗ

ТЗ (§10, §15, §16) называет ревьюеру только `device-icon-state-table-light`/
`-dark` как ожидаемую визуальную дельту. Фактический прогон показал ещё три
«different»: `isometric-large-warm-remount-dark`, `large-house-zoom-250-dark`,
`large-house-warm-remount-dark` (у всех пяти одинаковый `maxObservedDelta: 218`
— общий признак одного и того же цветового изменения).

Я не принял это на слово и сравнил с чистым `origin/dev` в отдельном
`git worktree` (та же сборка, тот же `golden:verify`): на `dev` эти три сцены
проходят как `passed`, а `device-icon-state-table-*` уже были `different`/
`missing-baseline` **до** этой задачи — предсуществующий дрейф baseline
(`GOLDEN_MATRIX_VERSION` 32→33 внесён более ранним `39456dc`, эталоны не
приняты), не имеющий отношения к #219. Причина трёх новых «different» —
`demo/fixtures/large-house.mjs` строка 129 циклически включает
`['lock', 'locked']` в синтетический набор устройств, которым пользуются
`perf-floor-1`/`perf-floor-2`; палитра lock-marker в этих сценах меняется тем
же общим CSS, что и ожидалось для shared renderer (AC5). Это не регрессия и
не «постороннее» изменение из риска в §13 — только более широкий, чем
задокументировано, набор golden-сцен, которым в предрелизном гейте потребуется
`npm run golden:accept -- --reviewed` вместе с state-table.

`device-text-shell-long-light/-dark` — `missing-baseline` независимо от этой
задачи (тот же предсуществующий дрейф `dev`, issue #217, вне скоупа #219).

### Не прогонялось, и почему

- **Полный набор из 155 browser-smoke.** Задача — точечное изменение общих CSS
  state-токенов; прогнаны названные в AC/хендоффе плюс смежные поверхности
  (device preview parity, static card, lock action, lock invariant). Остальные
  150 смоков не относятся к lock/orange-подложке (проёмы без замков, Glow,
  wall geometry, UI-хром и т. д.).
- **`python -m pytest tests_backend`.** Ни один файл
  `custom_components/**/*.py` не тронут.
- **Performance-профили.** Не названы в AC; §12 ТЗ явно фиксирует «CSS
  variables и fixture/test metadata», без нового DOM/JS в render path.

## Проверка AC1–AC7

| AC | Метод по ТЗ | Статус | Как закрыт |
|---|---|---|---|
| AC1 | contract unit + light/dark visual artifact | ✅ | `device-marker-polish-contract.test.mjs` проверяет `.oplock.locked/unlocked` core/stroke/fg по обеим темам; artifact — `smoke_device_icon_design.mjs` `openingLockPaletteMatches` (реальный `.oplock-core`/`.oplock-shell` computed style против reference с runtime-override) |
| AC2 | presentation/unit source contract + shared-renderer test + golden state-table | ✅ | Тот же contract-тест проверяет `.dev.lock-locked/unlocked` идентичными hex теми же селекторами, что и `.oplock.*`; `houseplan-card.ts`/`hp-device-preview.ts`/`space-card.ts` подтверждены источником как использующие общий `cardStyles`; golden `device-icon-state-table-*` включает оба lock-состояния |
| AC3 | contract unit + state-table light/dark golden с одновременно видимыми `on`/`open` | ✅ | Contract-тест проверяет `.dev.open` не содержит `#4a2800` и использует `light-dark(#fff,#252525)`; smoke `orangeGlyphsFollowTheme` подтверждает `rgb(255,255,255)`/`rgb(37,37,37)` для `on` и `open` в обеих темах на реальном рендере; golden-сцена теперь содержит `open` (`golden-right-linkquality`) рядом с `on` |
| AC4 | существующие device presentation/polish/pointer tests + source review | ✅ (чтением) | Diff `src/styles.ts` ограничен двумя блоками (`oplock.locked/unlocked`, `dev.open/lock-locked/lock-unlocked`); alarm/hover/focus/selected/unavailable/virtual/press/pulse селекторы вне диффа побайтово идентичны `dev`; полный regression (962/962) не покраснел |
| AC5 | shared-renderer unit + golden matrix | ✅ | Contract-тест проверяет, что `houseplan-card.ts`, `hp-device-preview.ts`, `space-card.ts` импортируют `cardStyles`; smoke `smoke_device_preview_parity.mjs`/`smoke_static_icon.mjs` подтверждают parity на реальных DOM для plan/preview/static; golden `device-icon-state-table-{light,dark}` — одна fixture, обе темы |
| AC6 | diff review, typecheck, полный unit и build | ✅ | Diff не касается config/backend/i18n (нет файлов вне `src/styles.ts`, тестов, demo, docs, generated); typecheck/unit/build зелёные |
| AC7 | diff, hash comparison, `check-docs` | ✅ | Оба changelog, `docs/TESTING.md`, `docs/USER-GUIDE.md`+`.ru.md` (раздел «Замок», таблица «Жёлтая подложка»/«Чёрный значок замка» переписаны на red/green) — все в `bc75e00`; три bundle sha256 идентичны; `check-docs.mjs --external` pass; `sourceFingerprint` в `docs/images/screenshots.json` обновлён и совпадает с фактическим build fingerprint, все 10 `imageSha256` не изменились |

## Находки

### Low-1 — AC7/§16 не называют все golden-сцены, которые изменит эта правка

ТЗ и хендофф называют только `device-icon-state-table-light`/`-dark` как
ожидаемую golden-дельту. Фактически общий CSS задевает ещё три сцены
(`isometric-large-warm-remount-dark`, `large-house-zoom-250-dark`,
`large-house-warm-remount-dark`) через lock-устройства в синтетической `large`
fixture (см. разбор выше) — я подтвердил это сравнением с чистым `dev`, а не
предположением. Риск §13 «Golden покажет ожидаемую дельту вместе с
посторонней» ровно это и предвидел, возлагая проверку на ревьюера — что я и
сделал.

**Вердикт:** снимается без правки. Не блокирует AC7 (диапазон изменяемых
сцен явно не был ограничен списком) и не создаёт риска для релиза — я
проверил происхождение всех пяти «different» и подтвердил, что это одно и то
же корректное цветовое изменение, а не регрессия. Фиксирую для предрелизного
гейта: `npm run golden:accept -- --reviewed` должен принять **все пять**
сцен разом (`device-icon-state-table-{light,dark}` +
`isometric-large-warm-remount-dark` + `large-house-zoom-250-dark` +
`large-house-warm-remount-dark`), не только две названные в ТЗ.
`device-text-shell-long-{light,dark}` (`missing-baseline`) — предсуществующий
дрейф `dev` вне скоупа #219, не путать с этой правкой при приёмке.

## Что проверено и корректно

- `.oplock.locked`/`.oplock.unlocked` и `.dev.lock-locked`/`.dev.lock-unlocked`
  используют идентичные hex (`#66D17A`/`#F0410C`) и идентичный
  `light-dark`+explicit-override паттерн foreground — одна lock-сущность даёт
  одинаковый цвет как compact badge, так и обычный marker (риск §13 «Compact
  opening badge и device marker разойдутся» закрыт одним contract-тестом на
  обе пары).
- Исходные designer SVG (`demo/srv/reference/device-icons/**`) остаются
  byte-identical; runtime-override в `capture_device_icon_reference.mjs`
  подтверждён построчным чтением фактических `fill="black"`/`fill="#252525"`/
  `fill="#1DC21D"`/`fill="#F0A00C"` — каждое встречается в SVG ровно один раз,
  `replaceAll` не задевает ничего постороннего.
- `--oplock-stroke-ratio: .025`/`--device-shell-stroke-ratio: .025` (dark
  theme) и вся геометрия/MDI-path/hit-area не изменены — совпадает с
  «не входит в задачу» §7 ТЗ.
- `mdi:lock`/`mdi:lock-open-variant` classification не менялась (regex-проверка
  в contract-тесте против `houseplan-card.ts`).
- `docs/USER-GUIDE.md`/`.ru.md`: заменяемые формулировки («чёрный/тёмный
  замок», «жёлтая подложка» применительно к lock, «Чёрный значок замка»)
  убраны полностью, включая таблицу постоянных статусов и `lock.*` в общей
  таблице поведений — сверено построчно, не на слово хендоффа.
- Trailers, changelog RU/EN, `docs/specs/README.md` — все в одном продуктовом
  коммите, соответствуют PROCESS.md §7.1/§10.1.

## Чего не проверял

- Визуальный итог обновлённых golden-сцен (baseline не принимается
  исполнителем/ревьюером по контракту — только `npm run golden:accept
  -- --reviewed` на полном Linux CI artifact перед бетой).
- Полный набор из 155 browser-smoke и `performance_smoke` — не относятся к
  этому точечному CSS-изменению; остаются обязательными на предрелизном
  гейте.
- Backend/HA harness — не затронут, ни один файл `custom_components/**/*.py`
  не изменён.
- Мобильный/touch путь отдельно не тестировал: правка ограничена CSS-цветом,
  не добавляет и не убирает pointer-modality селекторы (подтверждено чтением
  диффа — новых `:hover`/`[data-pointer-*]` правил нет).
