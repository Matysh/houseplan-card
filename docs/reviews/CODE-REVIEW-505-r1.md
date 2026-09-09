# CODE-REVIEW-505-r1

Issue: [#505](https://github.com/Matysh/houseplan-card/issues/505)
Материал: `origin/dev..HEAD`, диапазон `2e387ac1..d32dfc9b`, 7 коммитов, рабочая
копия на `d32dfc9be107dce72a2fa465413633caf717d1f5` (проверено `git status` —
чисто, `HEAD` == материал).
ТЗ: [`docs/specs/505-summary-panel-design-parity.md`](https://github.com/Matysh/houseplan-card/blob/issue/505-summary-panel-polish/docs/specs/505-summary-panel-design-parity.md),
принято зелёным на S4 r2 (`SPEC-REVIEW-505-r2`).
Заход code-review: r1 (первый код-ревью этой задачи; предыдущие r1/r2 в
истории коммитов относились к этапу spec, не к этому этапу) — разбор полный.

## Скоуп

Задача переводит сводную панель (#437/#493, эксплуатационное исключение
`docs/SCOPE.md`) на дизайнерский прототип (архив `макет.zip`) плюс четыре
исходных UX-исправления: плавное скрытие панели, широкий диалог настроек,
удаление `Sizes on this screen`, зависимость mobile-опции от master-toggle.
Изменения — три поверхности: составная кнопка в шапке/киоске, плавающая
панель, диалог настроек. Данные, источники, backend, geometry и public
config schema не затрагиваются (подтверждено чтением диффа — правки только
в `src/summary-panel-*.ts`, `src/houseplan-card.ts` (порядок кнопок),
i18n, docs, тесты/смоки/mutation-gate).

## Как проверялось

Материал не переключался (`git fetch/pull/checkout` не выполнялись), рабочая
копия уже была на `d32dfc9b`.

Прочитан весь дифф `git diff origin/dev...HEAD` построчно: все хунки
`src/summary-panel-runtime-loaded.ts`, `summary-panel-presentation.ts`
(новый файл, ключевой для AC3/AC4), `summary-panel-editor.ts`,
`summary-panel-editor-style.ts`, `summary-panel-dialog-style.ts`,
`summary-panel-style.ts`, `summary-panel-icons.ts` (новый), `summary-panel-i18n.ts`,
`houseplan-card.ts`, `THIRD_PARTY_NOTICES.md`, оба CHANGELOG, оба
USER-GUIDE, `ARCHITECTURE.md`, `STATUS.md`, `test/summary-panel-presentation.test.mjs`
(новый, 465 строк), `test/summary-panel.test.mjs`, `scripts/mutation-gate.mjs`,
`scripts/check-inputs.mjs`, `scripts/smoke-links.mjs`.

Гейты — свои, зелёного Validate на этом SHA нет:
- `npx tsc --noEmit` — PASS, чисто.
- `npm test` — PASS, 2400/2400 (1 skipped — известный backend-only тест без HA harness), 40s.
- `npm run build` — PASS.
- `npm run bundle:sync` — PASS; `git status` после — чисто (три копии бандла
  byte-for-byte совпали без новых диффов).
- `npm run bundle:budget` — initial View 298558 B gzip, в бюджете (потолок
  301066, headroom 2508 — совпадает с заявленным автором +1B к базе; низкий
  headroom — известный системный долг #367/#474, не новый в этой задаче).
- `node scripts/check-docs.mjs --screenshots=warn` — PASS, только ожидаемый
  WARN о устаревшем скриншот-отпечатке (не ошибка вне release candidate).
- `node scripts/check-inputs.mjs --coverage` — PASS (exit 0).
- `node scripts/mutation-gate.mjs --check` — PASS, все guard'ы валидны формально.
- `node scripts/process-gate.mjs --range origin/dev..HEAD` — гейт пройден;
  1 WARN о классификации `THIRD_PARTY_NOTICES.md` вне таблицы классов —
  это preexisting-пробел классификатора (файл существовал до задачи в обеих
  копиях, изменение — лишь дописанная секция), не новое нарушение классов A/B/C/D.

Все шесть новых mutation-gate witness'ов прогнаны лично по одному
(`node scripts/mutation-gate.mjs --id=<id>`), не поверх `--check`:
`summary-hide-unmounts-before-animation`, `summary-dialog-loses-wide-shell`,
`summary-mobile-ignores-local-off` (все три через чистый+мутантный прогон
`smoke_summary_panel_polish.mjs`), `summary-animation-stale-completion-unguarded`,
`summary-animation-reset-keeps-presentation`, `summary-animation-ignores-reduced-motion`
(все три через целевые юнит-тесты `summary-panel-presentation.test.mjs`).
Для каждого: чистый прогон зелёный, мутант красный, «поймано 1 из 1», exit0 —
дисциплина «тест умеет падать» выполнена лично, не со слов автора.

Браузерные смоки — выбор по `node scripts/smoke-select.mjs --base origin/dev --head HEAD`:
прямое совпадение — `smoke_summary_panel.mjs`; 32 слабые связи только по
общему имени `_mode`, из которых relevant (в теме диалогов/навигации/kiosk/lazy)
восемь уже прогнаны автором, остальные — geometry/PDF/isometric/sun/walls,
не относящиеся к диффу (диалоговая и presentation-логика геометрию не трогает).
Лично (не со слов автора) прогнаны:
`smoke_summary_panel.mjs`, `smoke_kiosk.mjs`, `smoke_nav_persist.mjs`,
`smoke_dialog_footer_width.mjs`, `smoke_lazy_editor_chunk.mjs`,
`smoke_warm_dialogs.mjs`, `smoke_houseplan_panel.mjs` — все PASS (полный JSON
осмотрен, включая `pickerWitnessHas200RowsAnd10000States`, `lostAckClosesAsSuccess`,
`trueConflictStaysOpen` для AC9). `smoke_summary_panel_polish.mjs` лично не
запускался отдельным прогоном, но его чистая версия трижды прогнана как часть
каждого DOM/presentation mutation-gate witness выше — те же ассерты, тот же
результат. Остальные 24 слабые связи (geometry/PDF/isometric/walls/sun) не
прогонялись: диффу они не сопутствуют ни по файлам, ни по описанному
поведению — только имя `_mode` их связывает.

Инварианты модели (`npm run invariants`) не прогонялись — дифф не касается
рёбер комнат, толщины стен, `layout`, `marker.space`, `open_spans`.
`golden:verify` не прогонялся — задача явно размечена как diagnostic-evidence,
не изменение golden/docs baseline (ТЗ §8); визуальная приёмка велась через
собственный портативный harness задачи, отдельно от golden. `pytest tests_backend`
не прогонялся — Python/backend не тронут.

### Независимая визуальная проверка (не со слов автора)

Запущен `node demo/capture_summary_panel_505.mjs --probe-only` — подтверждено:
`sourceSha` в отчёте == `d32dfc9b` (материал ревью, не что-то другое),
0 page errors/external requests/websocket attempts, реальный pinned
`home-assistant-frontend==20260729.7` (сверен SHA-256 из README) отдаёт
контракт ширины именно как в ТЗ §6: `small=320`, `medium=580`,
`inherited(--ha-dialog-width-md:920px)=920`, `mobile=390` с `radius:0` (реальный
HA fullscreen). Это и есть самое рискованное предположение ТЗ («предполагается
наследование `--ha-dialog-width-md`; проверяется на настоящем компоненте») —
подтверждено на подлинном компоненте, не на заглушке.

Затем запущен точечный `--only desktop-light,settings-real-ha-desktop-light`
(тот же исходный SHA, тот же report.json). Осмотрены лично PNG:
- панель (`desktop-light-product-panel.png` vs `-reference-panel.png`) —
  шапка, карточка блока, разделители строк, левая подпись/правое жирное
  значение совпадают по составу и иерархии с адаптированной палитрой темы;
- составная кнопка (`-product-control.png` vs `-reference-control.png`) —
  шестерёнка слева, подсвеченная правая половина, разделитель — совпадает;
- диалог настроек в подлинном HA (`settings-real-ha-desktop-light-product-dialog.png`
  vs `-reference-dialog.png`) — «Основные настройки»/«Блоки» карточки,
  счётчик «1 из 10», grip/стрелки/имя/глаз в шапке блока, ряды
  подпись/источник/удаление, пунктирная «Добавить значение», футер
  Отмена/Сохранить — состав и порядок совпадают с прототипом; ширина реально
  920px в подлинном компоненте (не заглушке); кнопка «Удалить блок» видна
  частично на нижнем крае — это нормальная вертикальная прокрутка тела при
  зафиксированном футере (ТЗ §6), не обрезка.

Это независимое подтверждение AC1, AC2, AC5, AC6, а не пересказ отчёта автора.

## Находки

### Low — L1: неиспользуемый ключ локализации `summary.block_visible`

`src/summary-panel-i18n.ts:55,124,193,262` — ключ `summary.block_visible`
("Visible"/"Показывать"/"Sichtbar"/"Visible") остался во всех четырёх
словарях. До этой задачи он обслуживал текстовую подпись чекбокса видимости
блока; в этой задаче чекбокс заменён на eye/eye-off кнопку с новыми ключами
`summary.hide_block`/`summary.show_block` (`src/summary-panel-editor.ts`,
секция `summary-visibility`). Проверено `grep -rn "block_visible" src/ demo/
test/ docs/ scripts/` — единственные совпадения это сами объявления ключа,
потребителей в коде не осталось.

Не блокирует: сам по себе ключ не ломает функциональность и не виден
пользователю (мёртвая строка в бандле лишь занимает место). Тот же класс
дефекта, что явно требовалось устранить для `summary.sizes_title` (ТЗ §6:
«Remove `summary.sizes_title` only if no remaining consumer») — здесь тот же
принцип применяется правильно к одному ключу и упущен для другого. Автор
чинит в рамках этой задачи (Low: правится или снимается запиской) —
отдельный issue не заводится (only Medium outside scope получает issue,
здесь Low и в рамках задачи).

## Что проверено и корректно

- **AC1** (кнопки/порядок/состояния): `houseplan-card.ts` переносит
  `renderControls(false)` в конец группы действий View (было — перед
  zoom-контролами). Иконки — новые inline SVG `summaryIcon()` с Tabler-путями
  из прототипа, атрибуция в `THIRD_PARTY_NOTICES.md` (оба места, root и
  `custom_components/`). `aria-hidden`, `focusable="false"`, явный `viewBox`,
  `currentColor` через `stroke="currentColor"` — соответствует ТЗ §2/§3.
  Визуально подтверждено (см. выше).
- **AC2/AC6** (панель/диалог по макету): структура HTML и CSS
  (`summary-panel-style.ts`, `summary-panel-editor-style.ts`,
  `summary-panel-dialog-style.ts`) вводит `.summary-scroll`, `.summary-block`,
  `.summary-general`/`.summary-blocks-card`, grip/order/eye кнопки,
  `summary-source` с меткой и деталью источника, dashed add-строки,
  раздельный destructive footer блока. Селекторы либо scoped под
  `hp-dialog[data-kind='summary']`/`:host([data-kind='summary'])`, либо
  используют классы с префиксом `summary-`; `hp-dialog.ts` вообще не
  изменён (0 диффа) — совместное поведение других диалогов физически не
  затронуто. Визуально подтверждено.
- **AC3/AC4** (анимация lifecycle): `SummaryPanelPresentation` — новый класс,
  единственный источник transient-состояния показ/скрытие, никогда не пишет
  `local.show`. Прочитан построчно: генерация (`generation`) инвалидирует
  устаревшие `finished`/`timeout` колбэки; `settle()` — единственная точка
  отключения; `sync(..., immediate)` обрабатывает смену стороны и
  «жёсткие» границы синхронным `settle`; safety-timeout 250мс (≤300мс из ТЗ);
  reduced motion проверяется до создания WAAPI-анимации. Все шесть mutation
  witness'ов лично подтверждены (см. «Как проверялось»). Юнит-тест
  `test/summary-panel-presentation.test.mjs` (465 строк) покрывает реверсы,
  document hidden/visible без replay, resize/anchor/eligibility границы,
  все `hardBoundaries` (editor entry, disconnect, identity/route/kiosk/permission
  change) — читал построчно, сценарии совпадают с явным перечнем ТЗ §4.
- **AC5** (широкий диалог): `--hp-dialog-wide-width`/`--ha-dialog-width-md`
  выставлены в 920px, scoped на `hp-dialog[data-kind='summary']`
  (`summary-panel-editor-style.ts:4-5`), наследуются как CSS custom
  properties в shadow-дерево `hp-dialog`/`ha-dialog`. Подтверждено на
  подлинном pinned HA-компоненте (см. выше) — это была явно поименованная в
  ТЗ как предположение, требующее проверки, точка риска.
- **AC7** (Sizes on this screen): `sizeRows`/`summary-local-sizes`/
  `summary-icon-scale`/`summary-font-scale`/`summary-size-reset` полностью
  удалены из `summary-panel-editor.ts`; `context.saveLocal` для
  `icon_scale`/`font_scale` из формы больше не вызывается. `kiosk.icon_scale`/
  `kiosk.font_scale`/`gs.reset` не удалены из словарей — верно, у них
  остаются потребители в `houseplan-card.ts`/`houseplan-editor-runtime.ts`
  (View/kiosk-масштаб отдельно). `summary.sizes_title` вычищен из всех 4
  словарей, потребителей не осталось (grep пуст).
- **AC8** (mobile зависит от master): `summary-mobile-show`
  `?disabled=${!dialog.localShow || dialog.busy}` — ровно формула ТЗ §5;
  значение не обнуляется при выключении (mutation witness
  `summary-mobile-ignores-local-off` лично подтверждён).
- **AC11** (документация): оба CHANGELOG правлены в том же коммите
  (`05778a47`, `User-Visible: yes`), USER-GUIDE.md/.ru.md, ARCHITECTURE.md,
  STATUS.md актуализированы и не противоречат коду. Трейлеры всех 7
  коммитов корректны (`Issue: #505` на каждом, `User-Visible` соответствует
  содержимому).
- Инфраструктура ревью: `demo/helpers/README-ha-dialog-505.md` описывает
  реальные границы безопасности (loopback-only, CSP, request allowlist,
  запрещённый WebSocket) — лично подтверждено report.json (`pageErrors: []`,
  `externalRequests: []`, `websocketAttempts: []`), утверждения не голословны.

## Чего не проверял

- `npm run invariants` — дифф не касается геометрии/толщины/layout/marker.space.
- `npm run golden:verify`, полный `demo/smoke_*` (235 смоков целиком),
  `performance_smoke`, `python -m pytest tests_backend` — вне соразмерного
  объёма для этой задачи (см. обоснование выше); полный набор — обязанность
  pre-release гейта, не код-ревью.
- 24 из 32 «слабых» smoke-select связей (geometry/PDF/isometric/walls/sun) —
  связаны только общим именем `_mode`, дифф их не касается ни файлами, ни
  описанным поведением.
- Полный список визуальных пар из ТЗ §8 (все 5 контекстов панели ×
  light/dark/bottom/kiosk/mobile, узкие 320/390, увеличенный текст,
  длинные DE-строки) — лично осмотрены только 2 пары (панель+control light
  desktop, реальный HA settings light desktop) как точечная проверка самых
  рискованных утверждений (реальная ширина HA-компонента, состав диалога);
  остальные пары — по отчёту автора (`ACCEPTANCE.md`), не переснимались
  из-за объёма (полный прогон — десятки PNG и повторные загрузки/рендеры).
  Инструментарий (`capture_summary_panel_505.mjs`) лично проверен рабочим и
  привязанным к материалу ревью (`sourceSha` в report.json совпадает с SHA
  этого раунда), это снижает, но не снимает риск непросмотренных пар.
- `demo/smoke_summary_panel_polish.mjs` как отдельный самостоятельный прогон
  (только через mutation-gate witness'ы, где он прогоняется чистым трижды с
  идентичным результатом) — не запускался напрямую отдельной командой.

## Вердикт

High: 0 · Medium: 0 · Low: 1 (в скоупе, не блокирует).
Все 11 AC доказаны либо автотестом с личной проверкой «тест умеет падать»
(AC3, AC4, AC5, AC8 — mutation witness), либо смоками с реальными
DOM/geometry ассертами (AC1, AC2, AC6, AC7, AC9), либо документами и
трейлерами (AC11), плюс независимая визуальная проверка на подлинном
HA-компоненте для самого рискового пункта (AC5). Зелёный вердикт.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/505-summary-panel-polish`, коммит `d32dfc9be107` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `147b26d3d229df542d072881387fd4f0f5650be1`
  ```
  git log --all --format='%H %T' | grep 147b26d3d229
  ```
- ТЗ `docs/specs/505-summary-panel-design-parity.md`, блоб `fed71b61cb26deae64fef8dc1a364d3401242d48`
  ```
  git log --all --find-object=fed71b61cb26deae64fef8dc1a364d3401242d48 -- docs/specs/505-summary-panel-design-parity.md
  ```
- Вердикт конвейера: `green` · High 0
