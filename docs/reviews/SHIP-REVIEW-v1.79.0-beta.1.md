# Пакетное ревью ship v1.79.0-beta.1

Итог: High 0 · Medium 0 · Low 1

> Опубликовано вручную по решению владельца (30.09): `ship-review.yml` нет в `main`, GitHub его не зарегистрировал и запустить его нельзя ([#716](https://github.com/Matysh/houseplan-card/issues/716)). Шаги повторены локально: вход — `renderShipBrief` по данным issue, ревью — независимый агент без контекста реализации по промпту workflow, машинный блок — `anchorBlock`.

- Кандидат: `8afaa63caf6769810aebcec88fa1dd5d4e097958`, диапазон `v1.78.0` (`7d4d75bd`)..кандидат.
- Задачи ship: 1 (#693), коммит `18c9f8e77c2605a6a6ffc5708c30d43a35cf32a0`.
- Правила: `docs/process/REVIEWER.md` «Пакетное ревью ship», `PROCESS.md` §5 и §11.7.
- После коммита `18c9f8e7` в диапазоне ни один из затронутых им файлов не менялся (`git log 18c9f8e7..8afaa63c -- <файлы>` пуст), поэтому кандидат несёт правку в том виде, в каком она слита.

## #693 — View: над лестницей курсор move вместо pointer

**Строка ТЗ.** В View у `.hp-stair-hit` нет курсора `move`: лестница-ссылка показывает `pointer`, лестница без действующей цели показывает курсор сцены; редактор плана сохраняет `move`. `pointer` только у ссылки. Проверка: `demo/smoke_stairs.mjs` (`viewLinkHitCursorIsPointer`, `viewStairWithoutTargetHasNoMoveOrPointer`, `editorStairBodyCursorIsMove`), юнит `#693` в `test/stairs.test.mjs`, мутант `view-stair-cursor-move-again`.

**Что в коде.** Слой View (`src/stairs-view.ts:89`) добавляет группе класс `hp-stair-view`. Правило редактора сужено до `.hp-stair.input-enabled:not(.hp-stair-view) .hp-stair-hit { cursor: move; }` (`src/styles/plan.styles.ts:1642`). Раньше правило срабатывало и в View: слой View ставит `input-enabled`, чтобы получать клики, а область попадания лежит поверх контура, поэтому `pointer` группы-ссылки (`.hp-stair.navigable`, #683 AC12) не был виден никогда. Теперь в View область попадания наследует курсор группы. Кроме того, коммит добавляет три проверки в смоук, юнит каскада, мутант, абзац в `docs/STAIRS.md` и записи в оба changelog.

### Что проверил

| Проверка | Результат |
|---|---|
| `git show 18c9f8e7` — полный дифф | Правка делает заявленное и только его. Обработчики событий, `role`, `tabindex`, геометрия и слой редактора не тронуты |
| Рамки ship: `git show --numstat -- src/` | `src/stairs-view.ts` +1/−1, `src/styles/plan.styles.ts` +4/−1: 7 строк из 30. Новых файлов в `src/**`, ключей i18n, полей конфига и Python нет |
| Выход из ship по смыслу | Нет. `pointer` только у ссылки — контракт, уже записанный в #683 AC12 (правило `.hp-stair.navigable { cursor: pointer; }` и мутант `stairs-active-link-loses-pointer-cursor`). Правка делает его видимым, нового UX-контракта нет. Геометрии, конфига, перфа и touch правка не касается: курсор на touch не действует, класс ничего не стилизует, кроме `:not()` |
| Потребители класса и старой строки: `grep` по `src/`, `scripts/`, `test/`, `demo/` | На старый селектор или строку `<g class="hp-stair ${active…` не опирается ни один мутант и ни один тест. Редактор (`src/stairs-editor.ts:517`) и статический 2.5D-символ (`src/space-render.ts:916`) класс не получают. Выбор слоя (`src/houseplan-card.ts:11075`): в режиме plan с загруженным редактором рисует редактор, в остальных случаях — View-runtime (`input-enabled` только при `_mode === 'view'`) |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/stairs.test.mjs` | 20/20 pass, включая `#693 курсор move над телом лестницы — только в редакторе плана` |
| Мутант `view-stair-cursor-move-again`: патч применён вручную, затем `--test-name-pattern="#693"` | Юнит падает (`not ok 1`): мутант убит |
| `node scripts/mutation-gate.mjs --check` | `ok view-stair-cursor-move-again`, якорь находится ровно 1 раз. Есть 3 предупреждения реестра, все про чужие мутанты (`corpus-*`, `optimize-*`, `nightly-reuse-*`) |
| `npm run build && node scripts/bundle-sync.mjs` → `node demo/smoke_stairs.mjs` | exit 0, `OK`, 69/69 true. `viewLinkHitCursorIsPointer`, `viewStairWithoutTargetHasNoMoveOrPointer`, `editorStairBodyCursorIsMove` = true |
| Тот же смоук на сборке со старым CSS (патч мутанта) | exit 1, красные ровно `viewLinkHitCursorIsPointer` и `viewStairWithoutTargetHasNoMoveOrPointer`. Утверждение коммита «две View-проверки красные на старом коде» подтверждено |
| `node scripts/smoke-select.mjs --base 18c9f8e7^ --head 18c9f8e7` | «НЕОПРЕДЕЛЁННОСТЬ»: связь со смоуками не доказана, скрипт предложил визуальный минимум. Прогнал его весь: `smoke_modes`, `smoke_mode_transition`, `smoke_hide_layers`, `smoke_decor_layer_order`, `smoke_daycycle_zoom_layers`, `smoke_static_zoom_sharpness`, `smoke_wall_hatch_density`, `smoke_visual_continuity` — 8/8 OK. Других смоуков, которые проверяют лестницы, кроме `smoke_stairs.mjs`, в `demo/` нет |
| Свой зонд в Chromium (харнесс `demo/serve.mjs`): 5 лестниц (ссылка, spiral-ссылка, missing, self, deleted) × режимы, computed `cursor` группы и области попадания, `pointer-events`, верхний элемент под центром (`elementFromPoint`) | См. таблицу ниже. Кандидат совпадает со строкой ТЗ во всех ячейках |

Зонд, кандидат против старого CSS (курсор области попадания `.hp-stair-hit`):

| Режим | Ссылка (active, straight и spiral) | missing / self / deleted | Кандидат: курсор сцены | Старый CSS |
|---|---|---|---|---|
| View, плоский | `pointer` (верхний элемент — `hp-stair-hit`) | `auto` | `auto` | `move` у всех пяти |
| View, 2.5D | `pointer` | `auto` | `auto` | `move` у всех пяти |
| View, карточка с `floor:` (fixed) | `auto` (цель `fixed`, не ссылка) | `auto` | `auto` | `move` у всех пяти |
| Редактор плана (select и инструмент stairs) | `move` | `move` | — | `move` (без изменений) |
| devices / decor | `pointer-events: none`, курсор не влияет | то же | — | то же (без изменений) |

### Находки

**Low — английский changelog неточно описывает изменение для лестниц без цели.** В `docs/CHANGELOG.md` (раздел Unreleased) написано: «stairs without a valid target *keep* the plan's ordinary cursor». До правки над такими лестницами в View был `move` (строка «Старый CSS» в таблице зонда), так что они не «сохраняют» обычный курсор, а получают его впервые. Читатель английских заметок беты поймёт, что для лестниц без цели ничего не изменилось. Русская запись точна: «у лестниц без действующей цели — обычный курсор плана». Воспроизведение: прочитать запись #693 в `docs/CHANGELOG.md` и сравнить с результатом зонда на старом CSS. Предложение: «…stairs without a valid target now show the plan's ordinary cursor». Код и поведение не затронуты, публикацию беты это не блокирует.

Остальное не находки:
- `viewStairWithoutTargetHasNoMoveOrPointer` проверяет курсор отрицанием («не move и не pointer») и только для missing. Зонд закрыл self, deleted, fixed и 2.5D и показал равенство с курсором сцены (`auto`).
- Гвард мутанта `stairs-active-link-loses-pointer-cursor` (`--test-name-pattern=cursor`) не выбирает новый юнит #693 (в его имени кириллица «курсор»). Этот мутант и так убивает тест `#683 active target cursor is pointer-only`.

### Чего не проверял

- Живую наводку реальной мышью и Home Assistant: курсор проверен через computed style и `elementFromPoint` в headless Chromium.
- Firefox и Safari. `:not()` с одним простым селектором поддерживают все целевые браузеры.
- Полную матрицу смоуков и golden. Курсор в кадры не попадает, класс `hp-stair-view` визуально ничего не меняет, визуальный минимум зелёный.
- Официальный прогон мутанта раннером `mutation-gate.mjs`: патч применял вручную тем же `find`/`replace`, гвард запускал напрямую.

Рабочая копия после проверок восстановлена (`git checkout -- . && git clean -fd -e node_modules`, `git status` пуст, HEAD `8afaa63c`). Игнорируемые `demo/srv/assets` и `test-build/` пересобраны на кандидате, чтобы в них не осталась сборка с патчем мутанта.

<!-- hp-ship-review-anchors -->
### Материал пакетного ревью

```
tag v1.79.0-beta.1
candidate 8afaa63caf6769810aebcec88fa1dd5d4e097958
base v1.78.0
issues 693
high 0
medium 0
low 1
run —
```
