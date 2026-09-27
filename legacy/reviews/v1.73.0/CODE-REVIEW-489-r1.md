# CODE-REVIEW-489-r1

**Issue:** #489 — Объявленный `data-hp`-контракт для UI и E2E
**Ветка:** `issue/489-data-hp-contract`
**Материал:** `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD` на SHA `5586e0591cab96a9fb59e6a1eda17e33f4ea296c` (сверено `git rev-parse HEAD` непосредственно перед выводом — совпадает)
**Заход:** r1 (код-ревью первый раз для этого issue; ТЗ прошло два захода ревью, оба зафиксированы отдельными документами `SPEC-REVIEW-489-r1/r2`, зелёный вердикт получен на r2)
**Вердикт:** зелёный · High: 0 · Medium: 0

---

## 1. Скоуп проверки

Диапазон коммитов `origin/dev..HEAD` (7 коммитов, все с трейлером `Issue: #489`):

```
9cf10bdd docs: specify public data-hp test contract (#489)         User-Visible: no
a48827ec docs: review document for #489                            User-Visible: no
e072b222 docs: address first spec review for data-hp contract      User-Visible: no
1d2ed1e3 docs: review document for #489                            User-Visible: no
9c61ac67 feat: declare stable data-hp test contract (#489)         User-Visible: yes
15e0efe3 docs: accept data-hp contract screenshots (#489)          User-Visible: no
5586e059 perf: recenter initial bundle ceiling for data-hp contract (#489)  User-Visible: no
```

`User-Visible: yes` стоит ровно на коммите, добавляющем поведение (новые `data-hp` в DOM); оба changelog правятся в нём же (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) — трейлер корректен.

Изменённые файлы класса A: `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
`src/houseplan-onboarding-runtime.ts`, `src/houseplan-panel.ts`, `src/hp-dialog.ts`,
`src/hp-confirm.ts`, `src/editor-secondary.ts`, `src/backdrop-pick.ts`,
`src/decor-image-editor.ts`, `src/space-copy-runtime.ts`, `src/summary-panel-editor.ts`,
`src/pdf/hp-pdf-dialog.ts` — 12 файлов. Класс B: `test/data-hp-contract.test.mjs` (новый),
`test/houseplan-panel.test.mjs`, `demo/smoke_styling_hooks.mjs`, `scripts/bundle-budget.mjs`.
Класс C: `docs/STYLING-HOOKS.md`, `docs/CHANGELOG*.md`, `docs/data-hp-contract.json` (новый,
не runtime-код — данные), `docs/specs/README.md`, `docs/images/*`. Класс D: `dist/**`,
`custom_components/houseplan/frontend/**`, `demo/srv/assets/**`.

**Первый факт проверки диффа: весь код класса A — построчно только добавление
атрибутов.** Прогнал по всем 12 файлам фильтр добавленных строк, исключив паттерны
`data-hp|data-kind|data-tool|data-id=|launcherId|dataset.hp|setAttribute('data-hp'`
и переносы строк без содержимого. Остаток — исключительно строки, физически
перенесённые из-за возросшей длины строки (`@click=...`, `.title=...`,
`?disabled=...` без единого символа изменений внутри), плюс один поясняющий
комментарий и одно новое опциональное поле `launcherId` в уже существующем типе
модели (используется только для вычисления `data-kind` тrея; ветка `kind ===
'palette'`, читающая то же поле раньше, не задета — она проверяет другое значение
`kind`). Это прямое подтверждение §7 ТЗ («визуальная и интерактивная дельта равна
нулю») чтением, а не со слов автора, и оно же — причина, по которой пункт «браузерные
смоки» ниже решён так, как решён.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат | Источник |
|---|---|---|---|
| typecheck/test/build (сверка бандла) | `npx tsc --noEmit`, `npm test`, `npm run build` | зелёный | Validate CI на точном SHA `5586e059`: https://github.com/Matysh/houseplan-card/actions/runs/34265047142 (success) — переиспользован, не перегонялся |
| Свежесть бандла (перепроверка) | `npm run bundle:sync` | build прошёл, `git status` после — пусто (байт-в-байт совпадение с закоммиченным деревом) | прогнал сам |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (167 добавленных строк в 12 файлах) | прогнал сам |
| `check-docs` (обязателен, диф трогает `src/**`) | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 12 external links)» | прогнал сам |
| `bundle:budget` | `npm run bundle:budget` | initial View 291681 B ⩽ потолок 292500 B; общий бюджет 301066 B не тронут; предупреждение о запасе — унаследованный долг #367, не новый | прогнал сам, цифры совпадают с хендоффом |
| `test/data-hp-contract.test.mjs` (новый, защищает AC6) | `node --test test/data-hp-contract.test.mjs` | 6/6 зелёных | прогнал сам |
| `test/houseplan-panel.test.mjs` (AC5) | `node --test test/houseplan-panel.test.mjs` | 5/5 зелёных | прогнал сам |
| `demo/smoke_styling_hooks.mjs` (назван в AC1–AC4) | `node demo/smoke_styling_hooks.mjs` | все проверки `true`, вывод `OK` | прогнал сам после `bundle:sync` |
| Выборка смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 114 «прямое совпадение» + 39 «слабая связь» из 232 | прогнал сам, разбор — ниже |
| `python -m pytest tests_backend -q` | — | не прогонял | диф не трогает `custom_components/**/*.py` |
| `npm run model-invariants` | — | не прогонял | диф не трогает геометрию/`layout`/`marker.space`/`open_spans`/записи толщины |
| `golden:verify` | — | не прогонял | нулевой визуальный дифф заявлен в ТЗ §11.6 и подтверждён отсутствием правок в `demo/golden/baselines/**`; сами `data-hp`-атрибуты не участвуют в рендере пикселей |
| performance-профили | — | не прогонял | не названы в AC; диф не касается `src/iso-*`, `src/live-*`, `src/render-*`, lifecycle-файлов |

### Разбор выборки смоков (114 прямых + 39 слабых)

Инструмент называет почти весь смок-набор, потому что новые атрибуты
дописываются на тех же строках, что и существующие `@click=${…this._openMarkerDialog…}`,
`_mode`, `_toast` и т.п. — это совпадение по символу на строке, а не по изменению
поведения этого символа. Пункт 1 этого документа показывает построчно, что ни одна
из этих строк не меняет ничего, кроме появления атрибута. Раз обработчик и логика
не тронуты нигде в диффе, вероятность, что именно этот прогон поймает регрессию,
не отличается от вероятности на случайно выбранном смоке вне выборки — реального
риска, который стоило бы гасить прогоном полусотни смоков, выборка не вскрывает,
она вскрывает шум построчного диффа. Решение: не гоняю ни один из 153 отмеченных
смоков сверх названного в AC `smoke_styling_hooks.mjs`, с записью здесь как
осознанного выбора, а не молчаливого пропуска. Если бы хоть один добавленный
атрибут менял управляющую логику (условие рендера, обработчик, значение поля),
разбор был бы другим — но такого места диф не содержит (проверено p.1 и
дополнительно тремя целевыми мутациями ниже, все они бьют по новым тестам, а не
по существующим смокам).

## 3. AC — доказательство и «чем краснеет»

| AC | Доказано | Чем | Чем краснеет (защитные AC) |
|---|---|---|---|
| AC1 корень: state/mode | да | `test/data-hp-contract.test.mjs` тест «root readiness and mode…» (считает 4 ветки `<ha-card>`, требует по одному `data-hp-state=`/`data-hp-mode=` на каждую) + смок (`rootPublishesReadyView`, `mode_*_isPublished`, `returnToViewIsPublished`) | Живая мутация: убрал `data-hp-state` из одной из четырёх веток `houseplan-card.ts` → тест `#489 root readiness and mode attributes cover every full-card ha-card branch` красный (`Expected values to be strictly equal`). Дерево восстановлено, `git status` пуст |
| AC2 шапка/empty/toast | да | смок: `headerActionsHaveStableHooks`, `spaceActionsHaveStableHooks`, `toastHasStableKind`, `writableEmptyIsReady`/`writableEmptyHasCreateAction`, `readOnlyEmptyIsReady`/`readOnlyEmptyHasNoCreateAction` — все `true` на прогоне | смок использует `checkAll`, которая проваливает прогон на любом `false` (`demo/serve.mjs:75`); не мутировал отдельно, но механизм проверен на другом ключе (см. AC6) |
| AC3 три редактора | да | смок: `toolbar_{plan,devices,decor}_isPublished`, `tools_{plan,devices,decor}_arePublished`, `planGroupOpensPublishedTray` — все `true`; плюс чтением сверил, что Undo/Redo и пикеры не получили `data-tool` (§6.4 ТЗ) | не мутировал отдельно; логика идентична AC2 (та же `checkAll`) |
| AC4 диалоги | да | `test/data-hp-contract.test.mjs` тест «every hp-dialog call site declares a documented broad kind» (32 совпадения `<hp-dialog`, все с `data-kind` из закрытого словаря) + смок открывает settings-диалог и проверяет host/confirm/cancel | Живая мутация: убрал `data-kind="settings"` с одного вызова `<hp-dialog>` → тест красный (`hp-dialog without data-kind`). Восстановлено |
| AC5 sidebar panel | да | `test/houseplan-panel.test.mjs`: `menu.dataset.hp = 'panel-menu'`, `title.dataset.hp = 'panel-title'` — присутствуют, тест зелёный (прогнал: 5/5) | проверено чтением: `houseplan-panel.ts` не содержит ветки без установки `dataset.hp` на этих двух узлах — узлы создаются один раз в `connectedCallback` |
| AC6 инвентарь + самозащита | да | `test/data-hp-contract.test.mjs` целиком (6/6): схема, полнота (`sourceValues` ⇄ `publicValues`), встроенный мутант «переименованный хук», проверка каждого `hp-dialog`, root-веток | Живая мутация 1: переименовал `data-hp="settings"` → `settings-x` в исходнике → тест «every source data-hp value…» красный (`undeclared data-hp values: settings-x`), и сам встроенный мутант-тест тоже упал (регэксп ждал другую строку) — оба сигнала сработали. Живая мутация 2 и 3 — см. AC1/AC4 |
| AC7 документация/совместимость | да | `docs/STYLING-HOOKS.md` §7 (7.1–7.7) описывает audience, политику переходного периода, ссылку на JSON; оба changelog правлены в коммите `9c61ac67` (тот же, где новое поведение); `node scripts/check-docs.mjs` — зелёный (прогнал) | не защитный AC (текст/документация) — свидетель обычное сравнение, не мутант |
| AC8 обязательные гейты | да | таблица §2 этого документа | — |

## 4. Находки

Нет. High: 0, Medium: 0, Low: 0.

Проверенные потенциально спорные места оказались осознанными решениями,
задокументированными в ТЗ и подтверждёнными кодом:

- `data-hp="toolbar"` использует `data-kind="device"` (единственное число), а
  `data-hp-mode` — `"devices"` (множественное). Не рассогласование: ТЗ §6.4
  прямо фиксирует `device` для toolbar, отдельно от корневого режима, и это
  осознанно пережило r1→r2 спек-ревью (M3 в r1 касался только `data-hp-mode`,
  а не `data-kind` тулбара). Смок явно транслирует это соответствие
  (`mode === 'devices' ? 'device' : mode`).
- Диалог калибровки вакуума и диалог удаления комнаты несут по два
  `data-hp="dialog-confirm"` (Fit/Apply, Keep-walls/Delete-with-walls) — прямо
  разрешено ТЗ §6.5 («Alternate accepted outcomes may produce more than one
  confirm button»).
- Кнопки Skip (импорт floors) и Reset (kiosk-масштаб, живёт на слайдерах)
  не получили ни `dialog-confirm`, ни `dialog-cancel` — они не Save и не
  Close/Cancel/Back, ТЗ размечает только «принципиальные» действия диалога;
  это не пропуск, а точное соответствие §6.5.
- Кнопка `.tabadd`/`space-add` в kiosk не рендерится вовсе (существующее
  условие `!this._kiosk`), а zoom-кнопки в kiosk остаются в DOM под
  `display:none` — оба варианта описаны в ТЗ §6.3/§7.3 STYLING-HOOKS.md
  дословно, ровно то, что было закрыто как M1 в r1 спек-ревью.

**Одно число — один источник:** диф не вводит ни одной новой видимой
пользователю величины — только DOM-атрибуты, не участвующие в рендере и не
видимые вне DevTools/E2E. Вопрос неприменим к этой задаче.

## 5. Что проверено и корректно

- Все 4 корневых `<ha-card>`-ветки (`pending`, `invalid`, `!model.length`,
  обычный рендер) несут `data-hp-state`/`data-hp-mode`, значения совпадают
  с типом `_mode: 'view'|'plan'|'devices'|'decor'` — прочитано и подтверждено
  тестом.
- Все 33 вызова `<hp-dialog>` (32 в `src/*.ts`, 1 в `src/pdf/hp-pdf-dialog.ts`)
  несут `data-kind` из объявленного словаря `docs/data-hp-contract.json`
  (19 значений, совпадает с ТЗ §6.5 построчно).
- `data-hp="dialog-confirm"`/`dialog-cancel"` расставлены по каждому найденному
  главному действию диалогов — прочитано построчно по всем диффам класса A,
  расхождений с §6.5 не найдено.
- Host `<hp-dialog>` получает `data-hp="dialog"` через `setAttribute` в
  `connectedCallback` (вне HA/native ветки рендера) — верно для всех реализаций
  диалога, включая нативный HA fallback.
- `docs/data-hp-contract.json`: словарь `data-tool` покрывает весь список ТЗ
  §6.4 для Plan/Device/Decor, `internalPrefixes`/`internalExactValues`
  совпадают с §7.7 STYLING-HOOKS.md, `retiredHooks.room-draft` соответствует
  #478.
- Панель (#486): `panel-menu`/`panel-title` расставлены один раз при
  создании узлов, тест `houseplan-panel.test.mjs` обновлён и зелёный.
- Оба changelog содержат запись со ссылкой на #489 в том же коммите, где
  появляется новое поведение (`9c61ac67`, `User-Visible: yes`).
- `docs/specs/README.md` содержит двустороннюю ссылку issue ↔ ТЗ.
- Bundle ceiling пересчитан (`292000` → `292500`) с обоснованием в комментарии
  кода и не меняет общий бюджет — соответствует ТЗ §12 «Рост initial bundle».
- `scripts/bundle-budget.mjs` warning про запас < 15000 Б — унаследованный
  долг #367, явно так и оформлен, не находка этой задачи.

## 6. Чего не проверял и почему

- `python -m pytest tests_backend` — диф не трогает `custom_components/**/*.py`.
- `npm run model-invariants` / `scripts/model-invariants.mjs` — диф не трогает
  геометрию, `layout`, `marker.space`, `open_spans` или записи толщины стен;
  вся правка — DOM-атрибуты разметки.
- `npm run golden:verify` / `golden:capture` — ТЗ §11.6 заявляет нулевой
  визуальный дифф, `demo/golden/baselines/**` не менялся в диффе, а сами
  проверенные атрибуты не участвуют ни в одном стиле — расхождение было бы
  видно по изменившимся файлам baseline, которых нет.
- performance-профили (`large-house-isometric-v1`,
  `large-house-interaction-v1`) — не названы в AC, диф не касается
  `src/iso-*`, `src/live-*`, `src/render-*`, `houseplan-render-lifecycle.ts`,
  `houseplan-card.ts`-lifecycle-путей (только разметочные правки внутри уже
  существующих веток `houseplan-card.ts`, не по этим путям).
- 153 смока, отмеченных `smoke-select.mjs` («прямое совпадение» + «слабая
  связь») сверх названного в AC `smoke_styling_hooks.mjs` — решение и
  обоснование в §2 «Разбор выборки смоков».
- Полный `smoke`/`golden`/`performance_smoke` матрица — предрелизный гейт
  (PROCESS.md §8), не гейт код-ревью; согласно issue-переписке, полный CI со
  всеми mutation-shards на этом SHA уже прогнан автором
  (https://github.com/Matysh/houseplan-card/actions/runs/34265047142) и
  документационный скриншот-workflow отдельно
  (https://github.com/Matysh/houseplan-card/actions/runs/34263093186) — не
  перепроверял оба прогона вручную сверх сверки самого SHA и повторного
  локального `check-docs`.

## 7. Материал раунда

- SHA материала: `5586e0591cab96a9fb59e6a1eda17e33f4ea296c` (= `git rev-parse
  HEAD` на момент вывода вердикта).
- Диапазон: `origin/dev..HEAD`, 7 коммитов, диф `git diff
  origin/dev...HEAD` — 76 файлов (полный список в `git diff --stat`,
  приведён частично в §1).
- Рабочая копия после всех проверок и трёх пробных мутаций — чистая
  (`git status --porcelain` пуст, `git diff --stat` пуст).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/489-data-hp-contract`, коммит `5586e0591cab` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e2d351cf6dfaa46c478d4018f20b580da3a974c8`
  ```
  git log --all --format='%H %T' | grep e2d351cf6dfa
  ```
- ТЗ `docs/specs/489-data-hp-contract.md`, блоб `127ce9505c272a9a4152b92157d71d78b96b1070`
  ```
  git log --all --find-object=127ce9505c272a9a4152b92157d71d78b96b1070 -- docs/specs/489-data-hp-contract.md
  ```
