# CODE-REVIEW-609-r2

Issue: #609 · Этап: code · Заход: r2 · Блокирующих циклов израсходовано: 1 из 4
Материал: `e8e5c863e474ea70f5567510c96587f90eeafcfa` (рабочая копия на нём; `git status` чист)
Validate на этом SHA: success — https://github.com/Matysh/houseplan-card/actions/runs/35804202890

## Скоуп раунда

r1 (материал `4b27268e`) закрыт жёлтым вердиктом с единственным Medium: диагностика
`verify_ha_form_shell_609.mjs` не переключала тему/масштаб текста, а
`demo/srv/demo.html` жёстко задаёт тёмную палитру, так что AC5 не был доказан
исполнением, только заявлен. Один Low снят без цикла (мутанты ссылались на
несуществующий «AC8»).

Дельта r1→r2 — ровно один коммит, `e8e5c863` (`test(dialog): cover HA theme and
enlarged text`, `Issue: #609`, `User-Visible: no`):

```
demo/helpers/README-ha-dialog-505.md               |   7 +-
demo/verify_ha_form_shell_609.mjs                  |  54 ++++++
docs/design/600-settings-dialogs/ACCEPTANCE.md     |   6 +-
.../pairs/room-ha-dark-text-200.png                | Bin 0 -> 57909 bytes
.../600-settings-dialogs/pairs/room-ha-light.png   | Bin 41120 -> 47927 bytes
.../pairs/room-ha-mobile-light.png                 | Bin 30218 -> 33659 bytes
docs/reviews/CODE-REVIEW-609-r1.md                 | 194 +++++++++++++++++++
scripts/mutation-registry.mjs                      |   4 +-
```

**`src/**` не тронут** — продуктовый код идентичен материалу r1. Это подтверждено
`git diff --stat 4b27268e..e8e5c863` (список выше, ни одного файла класса A) и
делает объём разбора локальным: единственная подсистема, которую задевает
дельта, — диагностика/доказательства #609 (класс B) и её документация (класс C).
Рёбра комнат, `layout`, `marker.space`, `open_spans`, толщина стен дельтой не
затронуты — geometry-инварианты не в скоупе r2.

## Как проверялось

Дешёвые гейты (`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла)
не перегонялись: они входят в зелёный Validate на этом же SHA, а дельта их не
касается (ни одного файла с типами или исполняемым продуктовым кодом).

Прогнал сам, целиком по делу этого раунда:

1. **`node demo/verify_ha_form_shell_609.mjs`** (без `--capture`, чтобы не менять
   рабочую копию) — green. Снял фактические значения из JSON-вывода:
   - light desktop: `cardBackground rgb(255,255,255)`, `formBodyBackground
     rgb(231,234,238)`, `colorScheme light`, `rootFontSize 16px`, panel 560×940,
     один `scrollOwners` (`.body.ha-scrollbar`);
   - dark + 200%: `cardBackground rgb(32,33,38)`, `formBodyBackground
     rgb(43,45,51)`, `colorScheme dark`, `rootFontSize 32px`, panel по-прежнему
     560×940 (±1px), один scroll-owner, `horizontalOverflow: false`, footer в
     границах панели.
   Оба набора чисел совпадают с тем, что автор привёл в комментарии передачи —
   не «на слово», а по фактическому stdout.
2. **Тест умеет падать.** Временно вырезал первый вызов `setPresentation({theme:
   'light', ...})` (эмуляция ровно того бага, который нашёл r1: демо остаётся на
   жёстко зашитой тёмной палитре) и перезапустил — тест упал на
   `desktop.cardBackground`: `actual 'rgb(28, 37, 48)'` (буквально
   `--card-background-color:#1c2530` из `demo/srv/demo.html:9`) против `expected
   'rgb(255, 255, 255)'`. Это тот самый регресс, который r1 требовал исключить.
   Файл восстановлен из бэкапа, `git status` после — чист.
3. **`node demo/smoke_ha_form_shell_parity.mjs`** (дешёвый Validate-свидетель,
   файл не входит в дельту, но зависит от той же CSS-цепочки) — green.
4. **`node scripts/mutation-gate.mjs --check`** — все мутанты `ok`, включая три
   формо-оболочечных: `ha-form-shell-width-falls-back-to-generic`,
   `ha-form-shell-loses-canvas`, `ha-form-shell-mobile-keeps-desktop-inset`
   (последние два — с исправленным в дельте r2 комментарием).
5. **`node scripts/check-docs.mjs`** — `Documentation checks passed (7 files, 12
   external links)`. Формально дельта не трогает `src/**`, поэтому отпечаток
   документации не обязан быть перепрогнан по правилам раунда — прогнал всё
   равно, т.к. дельта меняет `docs/design/**` и README рядом; green.
6. **`npm run bundle:sync`** перед пунктом 1 (диагностике нужен свежий бандл) —
   `git status` до и после идентичен: бандл уже был синхронизирован, новых
   изменений в `dist/**`/`custom_components/houseplan/frontend/**`/`demo/srv/assets/**`
   не появилось.
7. Прочитал производственный CSS, который делает возможным сам трюк
   `setPresentation`: `src/hp-dialog.ts:211-217` (`.content` канва —
   `--secondary-background-color`) и `src/styles/dialogs.styles.ts:568-583`
   (`hp-dialog[form-shell] .body` — `--hpf-canvas`, который сам фолбэчит на
   `--secondary-background-color`; `src/styles/form-kit.styles.ts:544`). Тест
   переопределяет ровно эти custom properties на `documentElement`, инлайн-стиль
   которого перебивает захардкоженный `:root{}` в `demo.html` — механизм фикса
   соответствует продуктовому коду, а не подгоняет тест под цифры.

**Не прогонял и почему:** `npx tsc --noEmit`, `npm test`, `npm run build` (с
трёхкратной сверкой копий бандла) и `npm run golden:verify` — покрыты зелёным
Validate на этом же SHA, а дельта их зону не задевает (нет продуктового TS, нет
изменений, видимых golden). `npm run invariants` — дельта не трогает геометрию.
Полный список browser smoke (`demo/smoke_*.mjs`) — дельта касается ровно одной
подсистемы (#609 form-shell диагностика), прогон всех остальных не добавил бы
доказательной силы; `scripts/smoke-select.mjs` не запускал отдельно, т.к. годный
кандидат (`smoke_ha_form_shell_parity.mjs`) уже очевиден по имени и уже
прогнан. `python -m pytest tests_backend` — дельта не трогает
`custom_components/**/*.py`.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **Medium** — AC5 не доказан исполнением: диагностика не переключает тему/шрифт, `demo.html` жёстко задаёт тёмную палитру, светлая тема физически не возникает | `demo/verify_ha_form_shell_609.mjs` получил `setPresentation()`, который инлайн-стилем на `documentElement` перебивает захардкоженные HA-токены `demo.html`, плюс новый desktop-кейс `dark + root font 32px` | `demo/verify_ha_form_shell_609.mjs:99-114` (функция), `:147-186` (вызовы и ассерты для light и dark/200%); исполнено мной — см. п.1 «Как проверялось», реальные rgb-значения совпадают для обеих тем, а откат первого вызова `setPresentation` воспроизвёл именно старый баг (п.2) |
| **Low** (снят без цикла) — два мутанта в `mutation-registry.mjs` ссылаются на несуществующий «AC8» | Ссылки исправлены на реальные пункты ТЗ | `git diff 4b27268e..e8e5c863 -- scripts/mutation-registry.mjs`: `#609 AC1/AC8` → `#609 AC1`, `#609 AC4/AC8` → `#609 AC4`; `mutation-gate.mjs --check` подтверждает оба мутанта по-прежнему `ok` |

## Унаследовано из r1

Без повторной проверки в r2 принято (документ `docs/reviews/CODE-REVIEW-609-r1.md`,
SHA `4b27268e`, вердикт жёлтый · High 0 · Medium 1):

- **AC1** (desktop 560×940, канва, один scroll-body, footer) — доказано
  исполнением `verify_ha_form_shell_609.mjs` на закреплённом
  `home-assistant-frontend==20260729.7`.
- **AC2** (mobile fullscreen 480×800 и 390×844, без переполнения) — то же.
- **AC3** (пять потребителей form-shell + отрицательный generic-контроль) —
  `smoke_ha_form_shell_parity.mjs` + `test/form-shell-consumers.test.mjs`
  (r1 лично снял `form-shell` у room-settings-dialog.ts и увидел падение).
- **AC4** (13 golden-сцен диалогов не меняются) — `golden:verify` зелёный на
  Linux; инфраструктурно golden-харнес не регистрирует `ha-dialog`, поэтому
  CSS для этой ветки не может задеть пиксели нативной ветки.
- **AC6** (мутанты ловят потерю ширины/канвы/fullscreen) — три мутанта
  зарегистрированы и проверены по отдельности на настоящую регрессию.
- **AC7** (фикстура #505 без внешних запросов/WebSocket/ошибок) —
  `fixture.assertClean()` в диагностике, проверено r1.
- Продуктовый код `src/hp-dialog.ts` и `src/styles/dialogs.styles.ts` в части
  #609 — прочитан r1 построчно и не менялся с тех пор (подтверждено пустым
  `git diff --stat 4b27268e..e8e5c863` по `src/**`), поэтому в r2 не перечитывал
  заново весь файл — только фрагменты, нужные для проверки механизма
  `setPresentation` (п.7 «Как проверялось»).

Не наследую слепо: пересчитал заново именно то, что задевает дельта — AC5 и
оба Low-мутанта, см. таблицу выше.

## Находки

Нет находок, оставшихся в скоупе после закрытия r1. Продуктовых, архитектурных
или новых замечаний к самой дельте (диагностика + документация) не нашёл:
логика переопределения тем соответствует реальным CSS-переменным продукта
(проверено чтением и исполнением), числа в тесте и в комментарии автора
совпадают буквально, тест доказанно падает при откате фикса.

## Что проверено и корректно

- Механизм `setPresentation` не подделывает результат: он переопределяет ровно
  те custom properties, которые продукт уже читает (`--card-background-color`,
  `--secondary-background-color`, `--ha-card-background`), а не создаёт
  параллельную систему цветов.
- «Одно число — один источник»: `cardBackground` и `formBodyBackground`
  снимаются с реальных DOM-узлов (`getComputedStyle`) после `card.updateComplete`,
  а не задаются тестом напрямую — сравнение честное, не тавтология.
- Скриншоты-доказательства (`room-ha-light.png`, `room-ha-mobile-light.png`,
  новый `room-ha-dark-text-200.png`) пересняты в момент, когда фикстура
  действительно в заявленной теме (byte-diff трёх файлов это подтверждает —
  старые два не идентичны новым, значит не переиспользованы вслепую).
- Трейлеры коммита `e8e5c863`: `Issue: #609`, `User-Visible: no` — верно,
  продуктовое поведение не изменилось; изменений в `demo/golden/baselines/**`
  нет, поэтому `Release:`/`Baseline-Reviewed:` не требуются; changelog не
  тронут, что согласуется с `User-Visible: no`.
- Класс изменений выдержан: `demo/**` и `scripts/**` — класс B (issue
  переиспользован, как разрешено), `docs/**` — класс C, часть DoD issue; ни
  один файл класса A/D не в дельте кроме уже подтверждённого пустого diff
  бандла после `bundle:sync`.

## Чего не проверял

- Полный набор `npm test` / `tsc --noEmit` / `npm run build` — не перегонял,
  положился на зелёный Validate этого SHA (дельта их зону не задевает).
- `golden:verify` в этом раунде — не перегонял; продуктовый CSS не менялся, а
  r1 уже подтвердил, что golden-харнес не видит `ha-dialog`-ветку в принципе.
- Полный список `demo/smoke_*.mjs` — прогнал только адресный
  `smoke_ha_form_shell_parity.mjs`; остальные не относятся к дельте (только
  диагностика и docs одного issue).
- `npm run invariants` — дельта не меняет геометрию/рёбра/`layout`.
- `python -m pytest tests_backend` — дельта не трогает Python.
- Живой настоящий HA вручную (браузером) — по правилам процесса ручного
  тестирования в цикле нет; доказательство — исполнение диагностики на
  закреплённой офлайн-фикстуре #505, что и было сделано.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/609-ha-form-shell-parity`, коммит `e8e5c863e474` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8b68353a33207d127ff8a4789c3bbd38150751d3`
  ```
  git log --all --format='%H %T' | grep 8b68353a3320
  ```
- Тело issue: `b08b9257ed688a47f3a0f422cdddc1bfc7cf7c511e81ada3ceeac8c2ce354d51`
- Вердикт конвейера: `green` · High 0
