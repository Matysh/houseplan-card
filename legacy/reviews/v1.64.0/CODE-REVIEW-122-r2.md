# Код-ревью #122 — Isometric Stage 2: hidden visual polish (r2)

- Issue: https://github.com/Matysh/houseplan-card/issues/122
- Спецификация: `docs/specs/122-isometric-stage2.md` (SPEC-REVIEW-122-r1: green)
- Предыдущий цикл: `docs/reviews/CODE-REVIEW-122-r1.md` — красный, High: 2, Medium: 1 → #134
- Диапазон: `git diff origin/dev...HEAD`, новый коммит цикла —
  `ef3cc98` (`fix: preserve isometric fallback rendering`), поверх `42b3f44`
  (`feat: add hidden isometric stage 2`), `76ce755`/`4c73e2c`/`e13215c` (ТЗ и
  документы ревью)
- Роль: ревьюер кода (свежая сессия, без контекста реализации и без контекста
  сессии r1)
- **Вердикт: зелёный · цикл r2/4 · High: 0 · Medium: 0**

## Скоуп

Единственный продуктовый коммит цикла — `ef3cc98`. Класс файлов: A
(`src/houseplan-card.ts`, 13 insertions/4 deletions — два места: `_baseVb()` и
основной `<svg>`/`<g>` блок рендера плана) + B (`test/isometric-contract.test.mjs`,
+5 строк) + C (`docs/ISOMETRIC.md`, `docs/adr/122-isometric-stage2-composition.md`)
+ D (`dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`,
`demo/srv/assets/houseplan-card.js` — все три пересобраны и включены в тот же
коммит). Диапазон узкий и точечный: правка адресует ровно High-1 и High-2 из r1,
`demo/smoke_isometric_contract.mjs` и `demo/smoke_isometric_live_touch.mjs` в этом
коммите не менялись (они уже были частью `42b3f44`).

Трейлеры `ef3cc98`: `Issue: #122`, `User-Visible: no` — корректно, фича
по-прежнему за скрытым Labs-флагом `iso`, публичный changelog не требуется.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit | `npm test` | green, 766/766 |
| Build | `npm run build` | green |
| Синхронизация 3 копий бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и то же для `demo/srv/assets/houseplan-card.js` | **обе команды green** — байт-в-байт совпадают. High-1 из r1 закрыт |
| `npm run golden:verify` (диф меняет рендер — обязателен) | после `npm run build` + `cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | 45/50 сценариев `passed`; 5 `different` — все пять из семейства «непринятые Iso-эталоны Stage 2» (`isometric-geometry-view-dark/light`, `isometric-live-layers-dark`, `isometric-touch-kiosk-dark`, `isometric-large-warm-remount-dark`), что и предсказывал §12.3 ТЗ и r1. **`isometric-no-borders-dark` теперь `passed`** (High-2 закрыт), **`large-house-zoom-250-dark` теперь `passed`** (Medium-1/#134 регрессия исчезла тем же коммитом) |
| Повтор `golden:verify` для этих двух сценариев | тот же прогон второй раз | оба снова `passed` — детерминированно, не флейк |
| Целевые браузерные смоки (названы в AC1/AC5-AC7/AC9-AC11 и напрямую тронуты правкой `_baseVb`/рендера) | `node demo/smoke_isometric_contract.mjs`, `node demo/smoke_isometric_live_touch.mjs` (после того же build+copy) | оба green; в `live_touch` явно проверяется `noBordersUsesFloorSymbols: true` и `visibleBordersRestoreStage2: true` — оба режима show_borders исполнены в реальном DOM, не только прочитаны |
| Трейлеры коммита | `git log --format=... ef3cc98` | `Issue: #122`, `User-Visible: no` — оба присутствуют и терминальны |
| Backend | не прогонялся | правок в `custom_components/**/*.py` нет — не применимо |
| Performance (`large-house-isometric-v1`) | не прогонялся | как и в r1 — pre-beta гейт, заблокирован #124 по решению владельца, вне скоупа этого код-ревью |

**Чего не проверял и почему:** полный набор из 127 браузерных смоков — правка
цикла ограничена двумя точками в одном файле плюс правкой рендера, которую уже
покрывают целевые смоки/golden; `python -m pytest tests_backend` — нет
Python-правок; принятие golden-эталонов Stage 2 Iso — не роль ревьюера и не
требуется до pre-beta (§12.3 ТЗ, решение владельца); дифференциальный прогон на
`origin/dev` — не повторялся отдельно в этом цикле, т.к. `origin/dev` не менялся
с r1 и там же было доказано, что оба сценария чисты на dev (причинность уже
локализована в диффе задачи).

## Находки

Отсутствуют. Оба High из r1 закрыты, новых High/Medium не найдено.

## Что проверено и корректно

- **High-1 (три копии бандла)** — закрыт. `cmp` подтверждает байт-в-байт
  идентичность всех трёх копий после `npm run build`; коммит `ef3cc98` содержит
  пересобранные `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`
  и `demo/srv/assets/houseplan-card.js` внутри себя же (не отдельным коммитом) —
  правило «сгенерированное в том же коммите» соблюдено.
- **High-2 (`show_borders:false` в Iso ломал пиксельный контракт)** — закрыт.
  Причина по коду (`src/houseplan-card.ts:4558-4573`, `_baseVb()`): при
  `!showBorders` рамка теперь строится как `projectedFrame({ rect: flat,
  wallHeight: ISO_WALL_HEIGHT })` — это в точности старая Stage-1 проекция без
  вклада Stage 2 floor/opening-геометрии, а не безусловный `unionRect(flat,
  isoOpeningBounds())`, который ломал сцену в 42b3f44. Синхронно с этим основной
  `<svg>`/внутренний `<g>` (строки ~14181-14187) теперь используют
  `isoLayers?.structural` вместо `iso` как условие для класса
  `iso-floor-scene`/`transform`/viewBox — то есть в ветке «iso активен, но
  структура скрыта» контент рендерится без Stage-2-трансформации, тем же путём,
  что и Stage 1. Доказано исполнением: `golden:verify` даёт `passed` для
  `isometric-no-borders-dark` с нулевым отличием от принятого Stage-1 baseline,
  повторено дважды детерминированно; смок `live_touch` отдельно подтверждает
  `noBordersUsesFloorSymbols: true` в реальном DOM.
- **Атрибут `class` внешнего `<svg>`** (`class=${isoLayers?.structural ? 'plan-svg' : nothing}`,
  новая связка по сравнению с прежним безусловным `class="plan-svg"`) —
  прочитано и проверено: `.plan-svg { z-index: 1; }` в `src/styles.ts:472`
  имеет смысл только относительно братских `.iso-underlay-svg`/`.iso-shadows-svg`/`.iso-walls-svg`,
  а те сами рендерятся строго под условием `iso && isoLayers?.structural`
  (`src/houseplan-card.ts:14176`, `:14394`) — то есть ровно тогда же, когда
  `plan-svg` получает класс. Вне Flat и вне structural-iso конкурирующих слоёв
  с явным z-index нет, поэтому потеря класса не меняет порядок отрисовки.
  Единственное внешнее использование селектора `.plan-svg` — `demo/smoke_isometric_contract.mjs:49`,
  и там он опрашивается только в сценарии с `show_borders:true` (структурный),
  где класс присутствует. Подтверждено исполнением: ни один из 44 не-iso
  golden-сценариев (Flat, редакторы, lighting, tray, split-wall и т. д.) не
  показал отличий.
- **Medium-1 / #134 (регрессия `large-house-zoom-250-dark` при выключенном
  Labs)** — не было целью этого коммита (правка адресует High-1/High-2), но
  сценарий проходит чисто тем же коммитом. Открытая гипотеза из r1 (обёртка
  `<g class=${iso ? ... }>` как источник 0.1%-регрессии) теперь снята
  экспериментально: смена условия с `iso` на `isoLayers?.structural` на этой же
  строке устранила и её. Issue #134 остаётся открытым (`S1-new`) — закрытие
  issue не входит в роль ревьюера кода (§6 PROCESS.md), но по факту дефект,
  который он описывает, воспроизводимо больше не проявляется в этом дереве;
  стоит отметить это релиз-менеджеру/автору при обработке #134, а не оставлять
  как забытый висящий тикет.
- **AC7 (`unit`+`smoke`+`golden`)** — выполнен: `hide_openings` не трогает
  cuts/state/light (не менялось в этом коммите, покрыто существующими тестами
  из `npm test`); `show_borders:false` восстанавливает Stage-1 no-volume сцену —
  подтверждено golden. **AC15** (Flat и `isometric-no-borders-dark` неизменны) —
  выполнен для не-iso baseline; Stage-2-Iso-эталоны намеренно не приняты на
  этом этапе (§12.3 ТЗ) и остаются `different` — соответствует контракту, а не
  находка. **AC16** (три копии бандла байт-в-байт + зелёные typecheck/unit/build)
  — выполнен, доказано `cmp`.
- **`test/isometric-contract.test.mjs`** (+5 строк) — источниковые
  regex-проверки на буквальный текст новых веток `_baseVb()` и рендера
  (`if (!this._spaceDisplayForRender().showBorders)`,
  `projectedFrame({ rect: flat, wallHeight: ISO_WALL_HEIGHT })`,
  `preserveAspectRatio=...'xMidYMid meet' : 'none'`, и т. д.). Тест умеет
  падать при откате этих строк (буквальное совпадение с исходником), но сам по
  себе не проверяет визуальный результат — это делает `golden:verify`
  отдельно. Стиль согласован с уже существующими source-grep проверками того
  же файла (AC8/AC9/AC14 в r1). Оценка: приемлемо как дополнительная страховка,
  не как единственное доказательство AC7/AC15 — реальное доказательство даёт
  golden.
- **Документация** (`docs/ISOMETRIC.md`, ADR) — обновлена в том же коммите,
  описывает новое поведение точно (Stage-1 projected frame возвращается в
  no-borders ветке вместо union с Stage-2-геометрией); расхождений с кодом не
  найдено.

## Чего не проверял

- Полные 127 браузерных смоков — правка узкая (две точки в одном файле), вне
  необходимости, определяемой diff'ом; прогнаны два целевых, прямо относящихся
  к затронутому коду.
- `python -m pytest tests_backend` — нет изменений в Python.
- `large-house-isometric-v1` performance — вне гейта код-ревью, заблокирован
  #124 (решение владельца, повторяет позицию r1).
- Принятие golden-эталонов Stage 2 Iso (5 `different`-сценариев) — не роль
  ревьюера; это ожидаемое, задокументированное в ТЗ состояние, а не находка.
- Отдельный дифференциальный прогон на `origin/dev` в этом цикле — не
  повторялся: `origin/dev` не изменился с r1, где причинность уже была
  локализована в диффе задачи, а не в окружении/Chromium.

## Итог

Оба блокирующих High из r1 закрыты одним точечным коммитом (`ef3cc98`):
пересборка всех трёх копий бандла восстановлена и подтверждена `cmp`
(High-1); ветвление рамки/трансформации в `show_borders:false` теперь
воспроизводит принятую Stage-1 no-volume сцену вместо объединения с
Stage-2-геометрией, что подтверждено чистым `golden:verify` дважды подряд
(High-2). Ранее заведённая Medium-находка (#134) как побочный эффект того же
исправления тоже перестала воспроизводиться в golden — issue стоит закрыть
или, как минимум, обновить при её обработке, но это не входит в роль
ревьюера кода. Новых High/Medium-находок нет. Цикл r2/4 закрывается зелёным
вердиктом.
