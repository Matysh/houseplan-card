# CODE-REVIEW-212-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/212
- **Спецификация:** `docs/specs/212-device-icons-polish.md` (зелёный SPEC-REVIEW-212-r1)
- **Диапазон ревью:** `origin/dev...HEAD`. Полная задача — `ec6f77b` (specify) ·
  `5cae1fd` (SPEC-REVIEW doc) · `120d413` (`fix: polish device icons and
  pointer feedback`) · `b7bfc92` (CODE-REVIEW-212-r1 doc) · `c5ba699` (`fix:
  address device icon review findings`, `Issue: #212`, `User-Visible: yes`).
  Этот цикл — второй код-ревью, предметно новое по сравнению с r1 — только
  диапазон `b7bfc92..c5ba699`.
- **Ветка:** `issue/212-device-icons-polish`
- **Роль:** ревьюер кода, свежая сессия без контекста написания ТЗ/кода.

## Скоуп проверки

CODE-REVIEW-212-r1 (`docs/reviews/CODE-REVIEW-212-r1.md`) вынес жёлтый вердикт
с двумя находками Medium **в скоупе**, обе без High:

- **M1** — три существующих regression-смока (`smoke_glow.mjs`,
  `smoke_room_settings.mjs`, `smoke_ux_fixes.mjs`) остались на старом
  `MouseEvent('mouse{enter,move,leave}')`/удалённом `_touchSeen` и были
  красными на SHA `120d413` из-за миграции room/marker hover на
  `PointerEvent`.
- **M2** — `hp-device-preview.ts` гейтировал `.dev:hover` через
  `:host([data-pointer-hover])`, но карта не проставляла этот атрибут
  экземпляру `hp-device-preview` — hover z-index в Device preview был
  мёртв навсегда.

Задача этого цикла — проверить, закрыты ли обе находки по существу (не
просто «тест больше не падает», а поведение действительно восстановлено), и
что фикс не завёл новой регрессии. Весь остальной код задачи (AC1–AC16)
не тронут диапазоном `b7bfc92..c5ba699` и повторно не пересматривался —
он был закрыт по существу в r1.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юнит | `npm test` | 952/952 зелёных |
| Сборка | `npm run build` + `md5sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёная; все три хэша идентичны (`b238775be1735d550f2b95c1e268cfa1`) |
| Документация | `node scripts/check-docs.mjs --external` | «Documentation checks passed (7 files, 10 external links)» |
| Целевые смоки, фиксившиеся в c5ba699 | `node demo/smoke_glow.mjs`, `node demo/smoke_room_settings.mjs`, `node demo/smoke_ux_fixes.mjs`, `node demo/smoke_device_preview_parity.mjs` | все 4 зелёные |
| Failing-before/passing-after для M1 | те же 3 смока прогнаны против бандла коммита `b7bfc92` (пере-собран в отдельном `git worktree`, с символической ссылкой на существующий `node_modules`) | `smoke_glow` → `FAILED (3)`, `smoke_room_settings` → `FAILED (1)`, `smoke_ux_fixes` → `FAILED (8)` — то же множество, что описано в CODE-REVIEW-212-r1 |
| Failing-before/passing-after для M2 | новый файл `smoke_device_preview_parity.mjs` (из HEAD, с ассертом `previewHoverGatePropagates`) прогнан против бандла `b7bfc92` | `previewHoverGatePropagates: false` → `FAILED (1)` — тест умеет падать именно на старом коде |
| Смежные названные смоки той же hover-механики (не изменены диффом, но зависят от `POINTER_HOVER_TARGET_SELECTOR`) | `node demo/smoke_touch_tips.mjs`, `node demo/smoke_feedback_v2.mjs`, `node demo/smoke_help_affordance.mjs`, `node demo/smoke_device_icon_design.mjs` | все зелёные — расширение селектора не задело существующие цели |
| Mutation-proof | `node scripts/mutation-gate.mjs --check` (все зарегистрированные guard'ы) и отдельно `node scripts/mutation-gate.mjs --id=device-touch-hover-gate-removed` | все guard'ы зелёные на чистом коде; `device-touch-hover-gate-removed` «покраснел, как обязан» на мутанте |

Геометрический вывод AC1/AC3 не пересматривался — диапазон `b7bfc92..c5ba699`
эти файлы не трогает.

## Верификация находок r1

### M1 — исправлено, доказано реальным поведением, не только тестом

`src/houseplan-card.ts` не менялся в части обработчиков — миграция на
`PointerEvent` уже стояла в `120d413`. Фикс — только в трёх смоках:
`MouseEvent('mouse{enter,move,leave}')` заменён на
`PointerEvent('pointer{enter,move,leave}', { pointerType: 'mouse' })`, а
проверка touch-подавления тултипа (`smoke_ux_fixes.mjs`) перестала писать
удалённый статический `c.constructor._touchSeen` и вместо этого шлёт настоящую
последовательность `pointerdown/pointermove/pointerup` с `pointerType:
'touch'`.

Прочитано и прослежено по коду: `pointerdown` на `.room` всплывает
(`bubbles: true, composed: true`) до `@pointerdown` на stage-контейнере
(`src/houseplan-card.ts:15808`), который вызывает `_notePointer(e)` —
`PointerModalityController` переключает модальность в `touch` **до**
следующего `pointermove`. Обработчик `tip` на `.room` (строка 15907) на
`pointermove` вызывает `_showTip` → `_notePointer(ev)` → `if
(!this._pointerModality.hoverEnabled) return;` — при модальности `touch`
`_tip` не устанавливается. Тест проверяет ровно это: `c._tip === null`
после реального касания, а не факт вызова удалённого статического флага.

Подтверждено экспериментально (не только чтением): все три смока красные на
бандле `b7bfc92` (та же картина, что зафиксирована в r1) и зелёные на
`c5ba699`. **Доказано** — воспроизведена как первоначальная регрессия
стенда, так и её устранение.

### M2 — исправлено, доказано смоком, который умеет упасть

`POINTER_HOVER_TARGET_SELECTOR = 'hp-dialog, hp-help, hp-color-opacity,
hp-device-preview'` — новая единая константа, используемая и в
`_syncPointerHoverTargets` (полный проход по `renderRoot.querySelectorAll`
при смене модальности, подписка на строке 736), и в
`_syncPointerHoverSubtree` (обработчик `MutationObserver` на добавленные узлы,
строка 2017). `hp-device-preview` рендерится напрямую в шаблоне карты, то
есть попадает под оба механизма симметрично `hp-dialog`/`hp-help`/
`hp-color-opacity`, ранее уже подключённым тем же способом. **Проверено
чтением, не исполнением**, в части внутреннего механизма подписки.

Экспериментальная часть: новый ассерт `previewHoverGatePropagates` в
`smoke_device_preview_parity.mjs` диспатчит настоящий `PointerEvent(
'pointerover', { pointerType: 'mouse' })` на `<hp-device-preview>` и
проверяет `data-pointer-hover` и у карты, и у preview. На `c5ba699` —
`true`; при прогоне того же (нового) файла смока против бандла `b7bfc92` —
`false`, тест падает. Это прямое доказательство, что ассерт способен
детектировать именно тот регресс, который описывала находка M2, а не
проверяет тривиально всегда истинное условие.

Юнит-контракт (`device-marker-polish-contract.test.mjs`) расширен: список
файлов naked-hover-selector сканирования теперь включает
`hp-device-preview.ts`, и отдельный regex требует, чтобы
`POINTER_HOVER_TARGET_SELECTOR` содержал `hp-device-preview`. **Доказано**.

## Проверено и корректно

- Оба Medium из r1 закрыты по существу, не косметически: поведение
  восстановлено (подтверждено сравнением бандлов до/после фикса), а не
  просто подогнан ассерт под текущий результат.
- Три копии бандла идентичны; трейлеры `c5ba699` корректны (`Issue: #212`,
  `User-Visible: yes`); оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) обновлены в том же коммите и формулировка
  («Device preview» — термин уже используется в этом написании в
  `docs/specs/212-device-icons-polish.md` §5/§13, не изобретён заново).
- `docs/images/screenshots.json` — обновлён только `sourceFingerprint`/
  `sourceSha256` (бандл изменился), `imageSha256` не менялся — визуальный
  результат скриншотов не затронут точечным фиксом, `check-docs.mjs`
  подтверждает согласованность.
- Расширение `POINTER_HOVER_TARGET_SELECTOR` не задело существующие цели
  гейта (`hp-dialog`, `hp-help`, `hp-color-opacity`) — смежные смоки
  (`touch_tips`, `feedback_v2`, `help_affordance`, `device_icon_design`)
  зелёные без изменений.
- Diff `b7bfc92..c5ba699` не расширяет скоуп: изменены только файлы,
  напрямую относящиеся к M1/M2 (1 продуктовый файл, 4 смока, 1 юнит-тест,
  2 changelog, 1 fingerprint-файл) — без побочных правок «раз уж я здесь».
- i18n и backend (`custom_components/**/*.py`) не затронуты этим диапазоном.

## Чего не проверял

- **Полный `demo/smoke_*.mjs` (127 файлов)** не прогонялся — диапазон
  `b7bfc92..c5ba699` узко точечный (M1/M2), прогнаны все 4 напрямую
  изменённых смока плюс 4 смежных, зависящих от того же
  `POINTER_HOVER_TARGET_SELECTOR`/`PointerModalityController`. Остальные
  AC1–AC16-смоки уже прогонялись и разбирались в CODE-REVIEW-212-r1 и этим
  диапазоном не затронуты — повторный прогон не добавил бы информации.
- **`npm run golden:verify`/`golden:accept`** не запускался в этом цикле —
  диапазон не меняет геометрию/разметку, только тест-стенд и подписку на
  DOM-атрибут; визуальный результат (см. `imageSha256` выше) не изменился.
  Финальная сверка на Linux CI — пре-релизный гейт (PROCESS.md §8, §13).
- **`performance_smoke`, `python -m pytest tests_backend`, `npm run
  inventory`** не запускались — вне гейта код-ревью (PROCESS.md §8) и
  диапазон не трогает Python/производительность.
- Геометрический вывод AC1/AC3 и полная AC-трассировка AC1–AC16 не
  пересматривались повторно — они не входят в диапазон этого цикла и были
  закрыты по существу в CODE-REVIEW-212-r1.

## Вердикт

Обе находки r1 закрыты по существу и подтверждены экспериментально —
демонстрацией, что тот же тест/смок красный на коде до фикса и зелёный
после, а не только чтением итогового кода. Новых High или Medium в этом
диапазоне не найдено; диапазон узкий и не расширяет скоуп задачи.

**Вердикт: зелёный · цикл r2/4 · High: 0 · Medium: 0 → в задаче**
