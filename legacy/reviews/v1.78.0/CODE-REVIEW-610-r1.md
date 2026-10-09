# CODE-REVIEW-610-r1

Issue: #610 · Этап: code (PROCESS.md §2.7) · Заход r1 · блокирующих циклов 0/2
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
рабочая копия на `2aa4dcf5bd15be4d58d4db8a076327970c062cce` (проверено `git rev-parse HEAD`).
Три коммита диапазона:
- `0b1b6bf9` docs: SPEC-REVIEW-610-r1 (спецификационное ревью, код не менялся).
- `3fb0d7fd` fix: clarify unsaved-settings confirmation (#610) — `Issue: #610`, `User-Visible: yes`.
- `2aa4dcf5` test: align device form smoke with atomic inputs (#610) — `Issue: #610`, `User-Visible: no`.

## Скоуп задачи

RU-копия и иконка диалога «Отменить изменения?» для четырёх сценариев
несохранённых настроек (room/space/marker/general settings): кнопки
`Продолжить`/`Отменить` → `Вернуться`/`Не сохранять`, иконка открытого замка →
`mdi:content-save-off-outline` в заголовке и на кнопке подтверждения. Данные,
схема, порядок кнопок, EN/DE/FR, прочие warning/destructive-подтверждения — не
трогаются. Соответствует ТЗ из тела issue (§2-3) и продолжает J4/J6 из
docs/SCOPE.md («keep the plan true», понятное безопасное действие в
редакторах). Спецификационное ревью (`docs/reviews/SPEC-REVIEW-610-r1.md`,
зелёный, 0 High/Medium) уже проверило исполнимость ТЗ; данный документ читает
только реализацию.

## Как проверялось

Дешёвые гейты на `2aa4dcf5` уже подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/35824681786, `headSha`
сверен командой `gh run view 35824681786 --json headSha` — совпадает с HEAD),
поэтому `npx tsc --noEmit`/`npm test`/`npm run build` со сверкой bundle tree не
перегонялись отдельно как самостоятельный гейт. Но для проверки дисциплины
«тест умеет падать» ниже они были задействованы вручную, локально:

1. Построчно сверил каждый файл диффа (`git diff origin/dev...HEAD`) с
   контрактом ТЗ п.4 и п.6 («Затронутые файлы»):
   - `src/danger-confirm.ts` — новое поле `confirmIcon?: string` в
     `HpConfirmRequest`, комментарий поясняет назначение.
   - `src/hp-confirm.ts` — кнопка подтверждения теперь берёт
     `request.confirmIcon || (destructive ? ... : ...)`, существующий fallback
     не тронут; заголовочная иконка (`request.icon || ...`) не менялась —
     этот путь был реализован до задачи (см. SPEC-REVIEW находку про п.2 ТЗ).
   - `src/editors/{general-settings-dialog,marker-dialog,room-settings-dialog,space-form}.ts` —
     ровно в четырёх вызовах `_confirmDanger` добавлена пара
     `icon: 'mdi:content-save-off-outline', confirmIcon: 'mdi:content-save-off-outline'`,
     без изменения остальных полей запроса.
   - `src/i18n/settings/ru.json` — изменены ровно два ключа
     (`dialog.discard_confirm`, `dialog.discard_keep`); `dialog.discard_title`/
     `_message` не тронуты.
2. `grep -rn "content-save-off-outline" src/ demo/ docs/` — иконка
   встречается ровно в 4 продуктовых call site + в тестах/документации; ни
   одного лишнего вызова `_confirmDanger` не задето.
3. `grep -rln "Продолжить|Отменить" demo src docs scripts` (исключая
   `demo/srv`, сгенерированный) — все прочие вхождения принадлежат другим
   i18n-ключам (`vac.route_*_body`, `space.copy_optimize_body`,
   `history.undo*`, `radar.discard_setup_title`, заголовок
   `dialog.discard_title`) — пересечения со скоупом нет, не-скоуп из ТЗ §3
   реален, а не декларативен.
4. Проверил `data-kind` на всех четырёх диалогов (`marker`, `room`, `space` —
   в `space-settings-dialog.ts` и `space-copy-runtime.ts`, `settings`), чтобы
   убедиться, что новый `demo/smoke_discard_copy.mjs` действительно находит
   каждый из четырёх диалогов по селектору, который использует.
5. **Тест умеет падать (проверено исполнением, не на слово).** Вручную
   применил патч мутанта `discard-confirm-action-icon-falls-back-to-lock` из
   `scripts/mutation-registry.mjs` к `src/hp-confirm.ts` (откатил
   `request.confirmIcon ||` обратно к жёсткому fallback), пересобрал
   (`npm run build` — прошёл, `tsc --noEmit` внутри чистый), синхронизировал
   бандл (`node scripts/bundle-sync.mjs`) и прогнал `node
   demo/smoke_discard_copy.mjs`: упали ровно 4 проверки
   (`{marker,room,space,settings}CopyAndIcons`), остальные (draft/discard
   поведение, fallback чужого warning) остались зелёными — мутант пойман
   ровно там, где и должен. Вернул файл (`cp` из бэкапа), пересобрал и
   пересинхронизировал — `git status --porcelain` пуст, дерево совпадает с
   коммитом; `node demo/smoke_discard_copy.mjs` снова зелёный (14/14).
   Round-trip заодно подтвердил AC6: три копии bundle tree (dist,
   `custom_components/houseplan/frontend`, `demo/srv/assets`) совпадают на
   этом SHA, раз пересборка не создала диффа.
6. Прогнал вручную (все зелёные, полный вывод в терминале сессии):
   - `node demo/smoke_discard_copy.mjs` — новый смок задачи, все 14 полей true.
   - `node demo/smoke_dialog_polish_603.mjs` — RU/EN/DE/FR × light/dark × DPR
     1/2 × ширины 320/360/560/640 (AC2), включая добавленную проверку
     `discardIcons` для каждой комбинации.
   - `node demo/smoke_room_settings_form.mjs` — обновлённые подписи
     `Вернуться`/`Не сохранять` в контексте формы комнаты.
   - `node demo/smoke_danger_confirmation.mjs` — Escape/крестик/scrim/replace,
     unlock-подтверждение (`unlockCancelAccept`) — доказывает, что чужие
     warning/destructive сценарии не задеты (AC4, ТЗ п.4.7).
   - `node demo/smoke_device_settings_form.mjs` — смок, изменённый вторым
     коммитом (`2aa4dcf5`); зелёный, подтверждает, что правка приводит его к
     контракту атомарных числовых полей #608, не меняя продуктовый код.
   - `node scripts/check-docs.mjs` — обязателен, т.к. диф трогает `src/**`
     (изменяет отпечаток скриншотов); «Documentation checks passed (7 files,
     12 external links)».
7. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` —
   **НЕОПРЕДЕЛЁННОСТЬ**: «дифф исполняемый, но ни один смок не связан
   доказуемо», 0 символов на изменённых строках. Причина понятна и не
   тревожна: инструмент строит таблицу символов по объявлениям верхнего
   уровня/членов класса с модификатором или `_`-префиксом
   (`scripts/smoke-select.mjs` DECLARATIONS); новое поле `confirmIcon?:
   string` внутри `interface HpConfirmRequest` — рядовой публичный член без
   модификатора и без `_` — таким объявлением не считается, поэтому
   зарегистрированная связь из `scripts/smoke-links.mjs` (символы
   `confirmIcon`, `HpConfirmRequest` → `smoke_discard_copy.mjs`,
   `smoke_dialog_polish_603.mjs`) не сработала на автомате. Решение по строке:
   прогнал оба зарегистрированных смока вручную (см. п.6) — они прямо и
   единственно доказывают AC1-AC4, поэтому автоматическое молчание инструмента
   не меняет вывод, просто не освобождает от чтения AC.
8. Инварианты модели (`npm run invariants`) не запускал — диф не трогает
   геометрию, `layout`, `marker.space`, толщину стен или `open_spans`.
   `pytest tests_backend` не запускал — Python не тронут.
   `npm run golden:verify` не запускал по существу изображения (см. ниже), но
   проверил, что диф в `demo/golden/` ограничен одной строкой ожидаемых
   лейблов в `harness.mjs`, а сам baseline-эталон не тронут — ровно то, что
   требует AC5 и п.10 ТЗ (принятие golden только из pre-release Linux CI).

## Находки

High: 0. Medium: 0. Задача реализована точно по ТЗ, без расширения и без
сужения скоупа.

## Что проверено и корректно

- **AC1/AC2 (browser smoke).** Все четыре `discard-*-dialog` показывают
  `Вернуться`/`Не сохранять`; `smoke_dialog_polish_603.mjs` подтверждает точные
  подписи, одну строку без переноса на 320-640px, autofocus безопасной кнопки
  и возврат к форме — во всех языках/темах/DPR (не только RU, что важно: EN/DE/FR
  подписи не изменились — проверено выражением `expected` в смоке и явным
  сравнением с ТЗ п.4.6).
- **AC3 (иконка).** `mdi:content-save-off-outline` передаётся явно в
  заголовок и на кнопку подтверждения из всех четырёх call site; других мест
  правка не касается — подтверждено и построчным чтением, и grep по всему
  дереву.
- **AC4 (fallback других confirmation).** `HpConfirm.render()` использует
  `request.confirmIcon || (destructive ? 'mdi:trash-can-outline' :
  'mdi:lock-open-variant')` — при отсутствии override (все прочие вызывающие
  сайты) поведение идентично коду до правки. `smoke_discard_copy.mjs`
  проверяет это прямо (`unrelatedWarningKeepsLockGlyphs`), а
  `smoke_danger_confirmation.mjs` — что unlock-сценарий не деградировал.
- **AC5 (доки/golden).** `docs/USER-GUIDE.ru.md` однозначно объясняет обе
  кнопки в разделе, общем для всех четырёх форм (единый form-kit). Golden
  harness (`demo/golden/harness.mjs`) обновлён под новые подписи, сам эталон
  `room-discard-dialog-mobile-ru` не тронут — приёмка по обычному
  pre-release-процессу, как и требует ТЗ п.10.
- **AC6 (гейты).** Validate на этом самом SHA зелёный (сверено `gh run view`
  по `headSha`); дополнительно вручную воспроизведена сборка + bundle-sync +
  round-trip мутанта без остаточного диффа — три копии бандла синхронны.
- **Мутационный тест ловит регресс.** Отдельно от заявления автора —
  воспроизвёл мутацию `discard-confirm-action-icon-falls-back-to-lock` руками
  и убедился, что именно `smoke_discard_copy.mjs` и только он падает
  (4 из 4 полей `*CopyAndIcons`), остальное поведение остаётся зелёным.
- **Второй коммит (`2aa4dcf5`) не расширяет скоуп.** Это тестовое
  выравнивание `smoke_device_settings_form.mjs` под уже существующий
  атомарный контракт числовых полей из #608 (`input` — черновик, `change` —
  фиксация); продуктовый код не тронут, `User-Visible: no` верно.
- **Трейлеры и changelog.** Оба продуктовых коммита несут `Issue: #610`;
  `User-Visible: yes` у коммита с реальным изменением сопровождается правкой
  обоих changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в том же
  коммите `3fb0d7fd`.
- **Не найдено дублирования источника значения** («одно число — один
  источник»): диф не вводит новых видимых пользователю величин — только
  текст двух кнопок и один и тот же строковый литерал иконки, используемый
  ровно там, где он должен отображаться (заголовок + кнопка одного диалога),
  не в двух независимых местах с потенциально разными источниками.

## Чего не проверял

- Не гонял `npx tsc --noEmit`/`npm test`/`npm run build` как самостоятельный
  формальный гейт — они уже зелёные на этом SHA по ссылке Validate; вместо
  этого использовал `npm run build` дважды как побочный инструмент для
  ручного round-trip мутанта (что фактически их и покрыло).
- Не гонял полный `npm run golden:verify` (реальный рендер и сравнение
  пикселей) — диф не меняет геометрию/CSS, только текст кнопок и строку
  иконки внутри уже существующего slot; визуальную часть придётся принять на
  pre-release Linux CI, как и предписывает ТЗ (эталон умышленно не
  обновлён в этом коммите).
- Не гонял `npm run invariants` и `pytest tests_backend` — diff не касается
  геометрии модели и Python-кода.
- Не гонял весь `demo/smoke_*.mjs` (263 файла) — задача узкая и локальная
  (один компонент, один i18n-ключ, четыре вызывающих сайта); прогнал шесть
  смоков, названных в ТЗ/выбранных по прямому текстовому упоминанию символов
  задачи (`smoke_discard_copy`, `smoke_dialog_polish_603`,
  `smoke_room_settings_form`, `smoke_danger_confirmation`,
  `smoke_device_settings_form` — единственный смок второго коммита,
  `check-docs.mjs` — обязателен для `src/**`). `smoke-select.mjs` вернул
  НЕОПРЕДЕЛЁННОСТЬ (см. «Как проверялось», п.7) — расширять выбор дальше не
  было оснований: ни один другой смок не упоминает изменённые символы
  (`confirmIcon`, `discard_confirm`, `discard_keep`) и не тестирует
  discard-диалоги.

## Вердикт

Зелёный. Реализация точно соответствует ТЗ #610: изменены ровно те два RU-ключа
и ровно четыре call site, что были указаны; fallback прочих
warning/destructive confirmation не сломан (проверено и чтением, и
воспроизведением мутанта); AC1-AC6 доказаны либо автотестом, который
подтверждённо умеет падать, либо чтением кода с явной пометкой. High: 0,
Medium: 0.

---

## Материал раунда

- HEAD: `2aa4dcf5bd15be4d58d4db8a076327970c062cce` (сверено `git rev-parse HEAD`).
- Диапазон: `origin/dev..HEAD`, три коммита (`0b1b6bf9`, `3fb0d7fd`, `2aa4dcf5`).
- Validate на этом SHA: https://github.com/Matysh/houseplan-card/actions/runs/35824681786
  (`conclusion: success`, `headSha` сверен командой `gh run view`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/610-discard-copy-icon`, коммит `2aa4dcf5bd15` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1826c6f7b4fc1e4136644304d6aa38299134378c`
  ```
  git log --all --format='%H %T' | grep 1826c6f7b4fc
  ```
- Тело issue: `ba5e9ea73d14fd143edf181ea90e230889146e7e2a6ce3ed6a46625deae355f1`
- Вердикт конвейера: `green` · High 0
