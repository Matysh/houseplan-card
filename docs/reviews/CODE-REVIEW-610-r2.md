# CODE-REVIEW-610-r2

Issue: #610 · Этап: code (PROCESS.md §2.7) · Заход r2 · блокирующих циклов 0/2
(r1 был зелёным — зелёный вердикт бюджет не тратит, #227)

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
рабочая копия на `6647ef56775235755fafdedf950883cf4233b4db` (проверено
`git rev-parse HEAD`). `origin/dev` = `ee0f97c85caa6ff087cd24702eb3888e5f4fd422`.

Диапазон, 4 коммита:
- `fb615f9d` docs: SPEC-REVIEW-610-r1 (ребейзнутый, `Issue: #610`/`User-Visible: no`).
- `1dba8185` fix: clarify unsaved-settings confirmation (#610) — продуктовый
  коммит, `Issue: #610`/`User-Visible: yes`, changelog RU+EN в том же коммите.
- `e08a7b48` test: align device form smoke with atomic inputs (#610) —
  `Issue: #610`/`User-Visible: no`.
- `6647ef56` docs: CODE-REVIEW-610-r1 (ребейзнутый, `Issue: #610`/`User-Visible: no`).

## Почему это r2, а не продолжение правок

r1 (код-ревью) был **зелёным** на материале `2aa4dcf5bd15be4d58d4db8a076327970c062cce`
(High 0, Medium 0). Пока ревью шло, `dev` продвинулся на #636 (ci: событийное
ожидание Validate) и #608 (атомарный контракт числовых полей у слайдеров).
Ветка была перебазирована на новый `dev`, кандидат `6647ef56` не запустил
Validate в срок (баг конвейера #492), после синхронизации workflow-файлов из
#636 раунд перезапущен. И `3fb0d7fd`, и `2aa4dcf5` — мёртвые объекты
(`git cat-file -e` — `fatal: Not a valid object name`), это ожидаемо после
ребейза (98/804 по корпусу, не находка).

Это ровно случай PROCESS.md §2.10: «ребейз на ушедший вперёд `dev` — после
ребейза это другой код» → разбор остаётся **полным**, не по дельте. Ниже —
полный повторный разбор, а не только диф к r1.

## Скоуп задачи

RU-копия и иконка диалога «Отменить изменения?» для четырёх сценариев
несохранённых настроек (room/space/marker/general settings): кнопки
`Продолжить`/`Отменить` → `Вернуться`/`Не сохранять`, иконка открытого замка →
`mdi:content-save-off-outline` в заголовке и на кнопке подтверждения. Данные,
схема, порядок кнопок, EN/DE/FR, прочие warning/destructive-подтверждения не
трогаются. Соответствует ТЗ (тело issue, разделы 1-11) и поддерживает J4/J6 из
`docs/SCOPE.md`. Спецификационное ревью (`SPEC-REVIEW-610-r1.md`) зелёное,
0 High/Medium, три Low сняты записью — эта часть не пересматривается: цель
кода-ревью — реализация, а не повторная оценка исполнимости ТЗ.

## Идентичность содержимого r1 → r2

Дерево материала r1 (`1826c6f7b4fc1e4136644304d6aa38299134378c`, из блока
«Материал раунда» документа r1) само по себе не резолвится — ожидаемо после
ребейза. Идентичность содержимого проверена не по дереву, а построчным чтением
диффа: `git diff origin/dev...HEAD` на `6647ef56` содержит **ровно** те же
изменения продуктовых файлов, что описаны в `CODE-REVIEW-610-r1.md`
(`src/danger-confirm.ts`, `src/hp-confirm.ts`, четыре `src/editors/*.ts`,
`src/i18n/settings/ru.json`, `demo/smoke_discard_copy.mjs`,
`demo/smoke_dialog_polish_603.mjs`, `demo/smoke_room_settings_form.mjs`,
`demo/smoke_device_settings_form.mjs`, `demo/golden/harness.mjs`,
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`, доки). Разница —
только перенос второго родителя (rebase) и путь `dist`/`custom_components/houseplan/frontend`
асассетов (другие хэши бандла из-за нового `dev`). Функционального дрейфа не
найдено.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate **на этом самом SHA**:
https://github.com/Matysh/houseplan-card/actions/runs/35828449934 —
`headSha` сверен `gh run view 35828449934 --json headSha` (совпадает с HEAD).
Job-разбивка этого прогона (`gh run view --json jobs`):

| Job | Итог |
|---|---|
| Предполёт (докс/провенанс/процесс, включает `check-docs.mjs --external`) | success |
| Фронтенд (typecheck, unit, mutants, bundle sync) | success |
| Мутанты по диффу (6 шардов) | success |
| Переиспользование дерева | success |
| HACS / Hassfest | skipped (неприменимо) |
| Геометрия TS/Python parity / Бэкенд pytest | skipped (диф не трогает) |
| **Golden / Смоки в браузере / Perf-смок** | **skipped — переиспользованы** |
| Доказательство выполненных проверок | success |

Значит `npx tsc --noEmit`/`npm test`/`npm run build` (со сверкой копий бандла)
и `check-docs.mjs` в этом раунде повторно не гонял — они зелёные на точном SHA.
Но browser-смоки и golden в этом конкретном прогоне **не выполнялись заново**,
а взяты из переиспользования по ключу дерева — это ровно то, что инструкция
оставляет на ревьюера («смоки, выбранные по диффу... остаются за тобой»).
Поэтому прогнал сам:

1. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
   **НЕОПРЕДЕЛЁННОСТЬ** (0 символов на изменённых строках, матрица 263 смока).
   Причина техническая: `confirmIcon?: string` — рядовой член интерфейса без
   `_`/модификатора, инструмент такие объявления не индексирует (тот же вывод,
   что в r1). Не считаю это разрешением ничего не гонять: беру
   зарегистрированную связь `scripts/smoke-links.mjs` (`confirmIcon`,
   `HpConfirmRequest` → `smoke_discard_copy.mjs`, `smoke_dialog_polish_603.mjs`)
   плюс прямое чтение AC1-AC4.
2. Пересобрал (`npm run build && npm run bundle:sync` — три копии бандла
   синхронны, `git status --porcelain` пуст и после пересборки, и после
   мутационного round-trip ниже) и **сам выполнил**, не полагаясь на слово
   автора или r1:
   - `node demo/smoke_discard_copy.mjs` — 14/14 `true` (все 4 диалога,
     `titleIcon`/`actionIcon`, сохранение черновика на «Вернуться», закрытие
     на «Не сохранять», fallback чужого warning).
   - `node demo/smoke_dialog_polish_603.mjs` — все комбинации RU/EN/DE/FR ×
     light/dark × DPR1/2 × 320-640px, включая добавленную проверку
     `discardIcons` — `OK`.
   - `node demo/smoke_room_settings_form.mjs` — `OK` (новые подписи в
     контексте формы комнаты, атомарный commit числового поля).
   - `node demo/smoke_danger_confirmation.mjs` — `OK` (unlock/delete-сценарии
     не задеты, `unlockCancelAccept` в норме).
   - `node demo/smoke_device_settings_form.mjs` — `OK` (второй коммит раунда;
     подтверждает, что тестовое выравнивание под #608 не сломало форму
     устройства).
3. **Мутационный тест умеет падать — воспроизвёл сам, не веря записи в
   документе r1.** Патчнул `src/hp-confirm.ts` вручную (тот же патч, что
   объявлен как `discard-confirm-action-icon-falls-back-to-lock` в
   `scripts/mutation-registry.mjs`): убрал `request.confirmIcon ||`, оставил
   жёсткий fallback на `mdi:lock-open-variant`. Пересобрал и
   пересинхронизировал бандл, прогнал `smoke_discard_copy.mjs` — упали
   **ровно 4** ожидаемых поля (`{marker,room,space,settings}CopyAndIcons`),
   остальные 10 остались `true`. Восстановил файл из бэкапа, пересобрал,
   пересинхронизировал — `git status --porcelain` пуст (дерево совпадает с
   коммитом), `smoke_discard_copy.mjs` снова 14/14. Мутант ловит регресс
   именно там, где заявлено, и только там.
4. Построчно сверил продуктовый диф с ТЗ п.4/п.6:
   - `src/danger-confirm.ts` — новое опциональное поле `confirmIcon?: string`
     в `HpConfirmRequest`, с однострочным комментарием о назначении.
   - `src/hp-confirm.ts` — кнопка подтверждения берёт
     `request.confirmIcon || (destructive ? 'mdi:trash-can-outline' :
     'mdi:lock-open-variant')`; заголовочная иконка (`request.icon || ...`) не
     менялась. Порядок кнопок в разметке: `cancelLabel` (ghost, `autofocus`,
     `_decide(false)`) первым, `confirmLabel` вторым — совпадает с ожиданием
     `demo/golden/harness.mjs` `['Вернуться', 'Не сохранять']` и с ТЗ п.4.1-4.2.
   - Ровно в 4 вызовах `_confirmDanger` (`general-settings-dialog.ts:50`,
     `marker-dialog.ts:179`, `room-settings-dialog.ts:117`, `space-form.ts:121`)
     добавлена пара `icon: 'mdi:content-save-off-outline', confirmIcon: 'mdi:content-save-off-outline'`.
   - `src/i18n/settings/ru.json` — изменены ровно два ключа
     (`dialog.discard_confirm` → «Не сохранять», `dialog.discard_keep` →
     «Вернуться»); `dialog.discard_title`/`_message` не тронуты.
   - `grep -rn "content-save-off-outline" src demo docs` — иконка встречается
     ровно в 4 продуктовых call site + тесты/доки/собранный бандл, лишних
     мест нет (сам прогнал, не по записи r1).
   - `grep -rn "Продолжить|Отменить" src/i18n/*.json` — все прочие вхождения
     принадлежат другим ключам (`history.undo*`, `space.copy_optimize_body`,
     `radar.discard_setup_title`, `vac.route_*_body`, заголовок
     `dialog.discard_title`) — не-скоуп реален, пересечения нет (сам
     перепрогнал grep, не унаследовал вывод).
   - `grep -n 'data-kind="marker"\|"room"\|"space"\|"settings"' src/editors/*.ts`
     — все четыре диалога действительно несут атрибут, который использует
     селектор `smoke_discard_copy.mjs`; не только читал, но и убедился, что
     тест физически находит каждый диалог.
5. Инварианты модели/backend/golden:verify не гонял — обоснование в разделе
   «Чего не проверял».

## Находки

High: 0. Medium: 0. Реализация точно по ТЗ, скоуп не расширен и не сужен;
рефакторинг рамками ребейза не задет — единственная не связанная с #610
правка (`e08a7b48`) — тестовое выравнивание под уже смёрженный #608, без
изменения продуктового кода.

**Одно число — один источник.** Диф не вводит видимых пользователю величин
(чисел): меняется текст двух кнопок и один строковый литерал иконки,
используемый в двух местах одного диалога (заголовок + кнопка), оба явно
переданы из одного и того же вызова `_confirmDanger` — второго независимого
источника нет. Правило неприменимо в узком смысле (нет числа), но по духу —
дублирования не нашёл.

## Что проверено и корректно

- **AC1/AC2 (browser smoke).** Все четыре `discard-*-dialog` показывают
  «Вернуться»/«Не сохранять» в правильном порядке; `smoke_dialog_polish_603.mjs`
  подтверждает точные подписи, одну строку без переноса на 320-640px,
  autofocus безопасной кнопки и возврат к форме — RU/EN/DE/FR × light/dark ×
  DPR1/2. Прогнал сам, зелёный.
- **AC3 (иконка).** `mdi:content-save-off-outline` передаётся явно в
  заголовок и на кнопку подтверждения из всех четырёх call site; прочих мест
  правка не касается — построчное чтение + grep + браузерный смок сходятся.
- **AC4 (fallback других confirmation).** Без override поведение идентично
  коду до правки (`request.confirmIcon || (destructive ? ... : ...)`).
  `smoke_discard_copy.mjs` (`unrelatedWarningKeepsLockGlyphs`,
  `unrelatedWarningCancelIsSafe`) и `smoke_danger_confirmation.mjs`
  (`unlockCancelAccept`) — оба зелёные при самостоятельном прогоне.
- **AC5 (доки/golden).** `docs/USER-GUIDE.ru.md` однозначно объясняет обе
  кнопки. `demo/golden/harness.mjs` обновлён под новые подписи и порядок
  совпадает с реальной разметкой (`hp-confirm.ts`); сам PNG-эталон
  `room-discard-dialog-mobile-ru` умышленно не тронут — приёмка по
  pre-release Linux CI, как требует ТЗ п.10. `docs/images/screenshots.json`:
  `sourceFingerprint`/`sourceSha256` обновлены на новое значение,
  **`imageSha256` у всех сцен не изменился** — это след `docs:accept
  --identical` (ни один снятый кадр документации не рендерит discard-диалог),
  легитимный быстрый путь §8, не пропуск.
- **AC6 (гейты).** Validate зелёный на точном SHA `6647ef56` (сверено
  `headSha`); фронтенд-джоб (typecheck/unit/mutants/bundle-sync) — success.
  Дополнительно сам пересобрал и пересинхронизировал бандл дважды (обычный
  прогон + round-trip мутанта) — `git status --porcelain` пуст оба раза, три
  копии дерева совпадают.
- **Мутационный тест ловит регресс — воспроизведено мной, не со слов
  документа r1.** См. «Как проверялось», п.3: 4 из 4 ожидаемых полей падают,
  остальное остаётся зелёным.
- **Трейлеры и changelog.** Оба продуктовых коммита (`1dba8185`, `e08a7b48`)
  несут `Issue: #610`; `User-Visible: yes` у `1dba8185` сопровождается правкой
  обоих changelog в этом же коммите (`git show --stat` подтверждает).
- **Тестовое выравнивание (`e08a7b48`) не расширяет скоуп.** Разница против
  `dev`: `smoke_device_settings_form.mjs` теперь диспатчит `change` после
  `input` для `#marker-glow-brightness`, `#marker-size`, `#marker-angle`.
  Причина найдена и подтверждена в коде: `rangeLine()`
  (`src/editors/form-kit.ts:470-490`) с #608 коммитит числовое поле только по
  `change` (`onInput: () => undefined`, монтаж — в `onChange`), поэтому без
  диспатча `change` тест не увидел бы записи значения. Это адаптация к чужому
  уже смёрженному контракту, а не новая функциональность; продуктовый код в
  этом коммите не тронут, `User-Visible: no` верно.

## Закрытие раунда r1

r1 (код-ревью) был **зелёным**, High 0 / Medium 0 — блокирующих находок для
закрытия нет. Единственное «незакрытое» между r1 и r2 — не находка ревью, а
инфраструктурное событие (падение Validate на кандидате `3fb0d7fd`, до
вынесения вердикта r1, и невозможность прохождения событийного resume, после
вердикта r1):

| Событие | Чем закрыто | Где видно |
|---|---|---|
| Validate failed на `3fb0d7fd` (до r1) | смок `smoke_device_settings_form.mjs` приведён к атомарному контракту #608 | коммит `2aa4dcf5`→(ребейз)→`e08a7b48`; push Validate 35824536843 зелёный |
| SHA `2aa4dcf5` (материал r1) осиротел после ребейза на новый `dev` | ребейз ветки поверх `ee0f97c8` (#636+#608), содержимое диффа не изменилось (см. «Идентичность содержимого») | `git cat-file -e 2aa4dcf5` → мёртв; `git diff origin/dev...HEAD` идентичен описанию в `CODE-REVIEW-610-r1.md` |
| Validate не стартовал на `6647ef56` за 3 мин (#492) | ветка синхронизирована с workflow-файлами #636 из `main`, раунд S7 перезапущен | комментарий issue 2026-09-23T06:47:09Z; Validate 35828449934 — success на точном `headSha` |

Три Low-наблюдения из `SPEC-REVIEW-610-r1.md` относятся к этапу ТЗ, не кода, и
уже сняты записью ревьюером ТЗ — код-ревью их не пересматривает.

## Унаследовано из r1

Формально — ничего не принято «на слово» без повторной проверки: событие
между раундами — ребейз на ушедший вперёд `dev`, а не правка по замечанию, и
§2.10 прямо требует в этом случае **полный** разбор, а не разбор по дельте. Я
использовал `docs/reviews/CODE-REVIEW-610-r1.md` (материал:
`2aa4dcf5bd15be4d58d4db8a076327970c062cce`, дерево
`1826c6f7b4fc1e4136644304d6aa38299134378c` — оба мертвы, ожидаемо) как чек-лист
охвата (какие файлы, какие AC, какой мутант), но каждый пункт — построчное
чтение диффа, grep по не-скоупу, четыре browser-смока и мутационный round-trip
— выполнил заново и самостоятельно в этом раунде (см. «Как проверялось»).
Не переносил без проверки только вывод спецификационного ревью (`SPEC-REVIEW-610-r1.md`,
зелёный, вне компетенции код-ревью) и оценку аналитики (лёгкий трек, P3) — они
не являются предметом код-ревью.

## Чего не проверял

- `npx tsc --noEmit` / `npm test` / `npm run build` как самостоятельный
  формальный гейт — зелёные на этом самом SHA (Validate 35828449934,
  `headSha` сверен). Технически прогнал `npm run build`/`bundle:sync` дважды
  как побочный инструмент для мутационного round-trip — фактически покрывает
  typecheck и build ещё раз.
- `npm run golden:verify` (реальный рендер + попиксельное сравнение) — диф
  ожидаемо меняет пиксели ровно одной golden-сцены (`room-discard-dialog-mobile-ru`,
  новые подписи и иконка), а ТЗ п.10/AC5 явно откладывают приёмку нового
  эталона на pre-release Linux CI (`golden:accept -- --reviewed`, правило
  §8/§3.13). Прогон здесь предсказуемо покажет уже известное, принятое к
  плану расхождение — не новую информацию; полный набор — предрелизный гейт.
  Job `Golden-кадры против принятых эталонов` в самом Validate — `skipped`
  (переиспользование), поэтому нет и стороннего сигнала «что-то ещё сломалось»
  за пределами этой одной сцены; риск компенсирован тем, что harness-ассерт
  (`labels`) сверен построчно с реальным DOM-порядком кнопок.
- `npm run invariants` / `python -m pytest tests_backend` — диф не трогает
  геометрию, `layout`, `marker.space`, толщину стен, `open_spans` или Python.
- Полный `ls demo/smoke_*.mjs` (263 файла) не гонял целиком — `smoke-select.mjs`
  вернул НЕОПРЕДЕЛЁННОСТЬ, задача узкая (один компонент, один i18n-ключ,
  четыре call site), прогнал 5 смоков, прямо связанных символами/AC
  (`smoke_discard_copy`, `smoke_dialog_polish_603`, `smoke_room_settings_form`,
  `smoke_danger_confirmation`, `smoke_device_settings_form`) плюс `check-docs`
  через сам Validate.
- Perf-профили — диф не в списке путей, запускающих доп. профили (#473), и
  не назван в AC как влияющий на perf; два обязательных glow-профиля покрыты
  Validate (job `performance_smoke` в матрице — не изменяет вывод для этого
  диффа, эта пара не в списке чувствительных путей § changed-files).

## Вердикт

Зелёный. Ребейз не изменил содержимое реализации — независимо перепроверено
построчным чтением всего диффа против ТЗ. AC1-AC6 доказаны: либо
самостоятельно воспроизведённым зелёным browser-смоком (`smoke_discard_copy`,
`smoke_dialog_polish_603`, `smoke_room_settings_form`, `smoke_danger_confirmation`,
`smoke_device_settings_form`), либо чтением кода с явной пометкой, либо
зелёным Validate на точном SHA. Мутационный тест воспроизведён лично (не со
слов автора/r1) и ловит регресс ровно в 4 ожидаемых полях. High: 0, Medium: 0.

---

## Материал раунда

- HEAD: `6647ef56775235755fafdedf950883cf4233b4db` (сверено `git rev-parse HEAD`).
- Диапазон: `origin/dev..HEAD` (`origin/dev` = `ee0f97c85caa6ff087cd24702eb3888e5f4fd422`),
  4 коммита (`fb615f9d`, `1dba8185`, `e08a7b48`, `6647ef56`).
- Validate на этом SHA: https://github.com/Matysh/houseplan-card/actions/runs/35828449934
  (`conclusion: success`, `headSha` сверен `gh run view --json headSha`).
- Предыдущий материал (r1, code): `2aa4dcf5bd15be4d58d4db8a076327970c062cce`,
  дерево `1826c6f7b4fc1e4136644304d6aa38299134378c` — оба мертвы после ребейза
  (`git cat-file -e` → not a valid object name), ожидаемо по §2.10.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/610-discard-copy-icon`, коммит `6647ef567752` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b2fdcaf270a5d01055ba737c6fb5ac68315e34c5`
  ```
  git log --all --format='%H %T' | grep b2fdcaf270a5
  ```
- Тело issue: `ba5e9ea73d14fd143edf181ea90e230889146e7e2a6ce3ed6a46625deae355f1`
- Вердикт конвейера: `green` · High 0
