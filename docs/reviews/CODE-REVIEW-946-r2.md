# CODE-REVIEW-946-r2

Issue: #946 — «Настройки комнаты: заливка, источники данных и связь с пространством»
Этап: code (PROCESS.md §2.7) · Трек: ask · Заход: r2 · блокирующих циклов израсходовано 1/4

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` на SHA
`6e2a8c480e733d34810163c92aa5a99c698f87b4` (рабочая копия уже на нём, `git rev-parse HEAD`
сверен). Validate на этом SHA зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/39152241454.

Предыдущий раунд: `docs/reviews/CODE-REVIEW-946-r1.md`, материал
`01901df0242b89dc78dd19098ef5c25d7d07850f`, вердикт жёлтый, Medium: 1 в скоупе.

## Скоуп ревью (дельта r1→r2)

Разбор — по дельте (PROCESS.md §2.10): `git diff
01901df0242b89dc78dd19098ef5c25d7d07850f..HEAD`, 18 файлов, 3 новых коммита:

- `db74707a` «Match every Room fill option label to the approved v4 reference» —
  фикс самой находки r1 (`User-Visible: yes`): `src/editors/room-settings-dialog.ts:115`,
  новый ключ `room.fill_none` в `src/i18n/settings/{ru,en,de,fr}.json`, расширение
  `demo/smoke_room_settings_946.mjs` прямым сравнением всех 5 опций с эталонным DOM,
  правки `docs/CHANGELOG(.ru).md`, `docs/DEVELOPMENT.md`.
- `32df1b3b` «Remove the retired generic fill label…» (`User-Visible: no`): удаление
  ставшего неиспользуемым `fill.none` из `src/i18n/{ru,en,de,fr}.json`, запись в
  `docs/DEVELOPMENT.md` о том, что это сделал normal-гейт (`i18n-dead-keys`), а не
  ручная правка.
- `6e2a8c48` «test(room): accept mobile wrap of approved fill caption» (`User-Visible: no`,
  `Release: v1.82.0-beta.1`, `Baseline-Reviewed-Local`): один обновлённый golden-кадр
  `room-discard-dialog-mobile-ru.png` + `baselines-index.json`.

Локальность дельты не вызывает сомнений: три маленьких коммита, тот же файл, что и
находка r1, без ребейза на ушедший вперёд `dev`, без смены контракта/подсистемы —
полный разбор ограничен этой дельтой плюс точечной проверкой побочных эффектов
(golden, demo-смоки), как требует §2.10.

Риск по изменённым участкам (ux-класс, i18n-ключи `room.*` в
`src/i18n/settings/*.json`): это тот же класс, что уже сверен r1 построчно против
`docs/design/settings-dialogs-944/room-settings-v4.html` и AC1 issue body; дельта
добавляет один новый ключ (`room.fill_none`) и убирает один retired (`fill.none`) —
оба разобраны ниже как исправление находки r1, отдельного непокрытого класса не вносят.

## Как проверялось

- Прочитаны `docs/reviews/CODE-REVIEW-946-r1.md` целиком (находка, доказательства,
  гейты), комментарии issue #946 (ответы автора r1→r2, включая отозванное и
  исправленное утверждение про golden), `git log`/`git diff` дельты `01901df0..HEAD`.
- Прочитан построчно diff `src/editors/room-settings-dialog.ts`,
  `src/i18n/{ru,en,de,fr}.json`, `src/i18n/settings/{ru,en,de,fr}.json`,
  `demo/smoke_room_settings_946.mjs`, `docs/DEVELOPMENT.md`, `docs/CHANGELOG(.ru).md`.
- Проверено чтением, что `fill.none` после удаления из всех четырёх базовых словарей
  не используется больше нигде в `src/**` (`git grep -n "fill\.none" <дельта>` —
  ноль совпадений в `src/`). Единственное оставшееся упоминание —
  `demo/smoke_ux_fixes.mjs:108` (см. находку Low ниже).
- Собран бандл (`npm run bundle:sync` — `tsc --noEmit` + `rollup` зелёные, нужен для
  демо-смоков) и прогнаны смоки, относящиеся к дельте и к Room-поверхности:
  `demo/smoke_room_settings_946.mjs`, `demo/smoke_room_settings_form.mjs`,
  `demo/smoke_room_save_retry_946.mjs`, `demo/smoke_room_co2.mjs`,
  `demo/smoke_room_temperature_thresholds.mjs`, `demo/smoke_dialog_config_parity.mjs`,
  `demo/smoke_space_settings_form.mjs`, `demo/smoke_ux_fixes.mjs` — все `OK`.
- Прогнан `npm test` целиком (5260 тестов, 5259 pass/0 fail/1 skipped, включая
  `test/room-save-946.test.mjs`) — Validate на этом SHA уже зелёный, но тест был
  перегнан дополнительно, т.к. один прямой `node --test test/room-save-946.test.mjs`
  без предварительной сборки `test-build` не проходит по независимой от продукта
  причине (`ERR_MODULE_NOT_FOUND` — файл собирается `tsc -p tsconfig.test.json` в
  составе `npm test`), и это стоило перепроверить именно через штатный скрипт.
- **Визуально сверен** обновлённый golden-кадр `room-discard-dialog-mobile-ru.png`
  (до/после, извлечены через `git show <rev>:<path>`, попиксельный diff
  `Pillow`): единственная зона отличий — bbox `y∈[513,730]`, `x∈[14,305]`, то есть
  область формы НИЖЕ диалога подтверждения, сдвинутая вниз на ~10–14 px; сам текст
  и кнопки confirm-диалога («Отменить изменения?», «Вернуться»/«Не сохранять»,
  название комнаты) идентичны пиксель в пиксель. Это согласуется с объяснением
  автора в комментариях issue (унаследованная подпись «Как у пространства · Без
  заливки» на 320 px: реальная ширина текстовой области 230 px, новая подпись
  247.07 px против старой 184.55 px, из-за чего select вырастает с 44 до 58 px и
  переносит нижние блоки формы на ~14 px) и не затрагивает ни один элемент
  content диалога подтверждения — эффект объяснён и визуально подтверждён
  независимо от слов автора, не принят на веру.
- Сверена целостность golden-аттестации дельты: `baselines-index.json` →
  `localAttestation.source.commit` = `32df1b3bdfe0bb4dbb5e896dee86091055b0c2b3` —
  это прямой предок материала ревью (второй коммит дельты), `clean: true`; в
  отличие от r1 здесь нет расхождения SHA/ветки, сверять через diff деревьев не
  требовалось. `Baseline-Reviewed-Local: sha256:021fc7c63b2d31ef823a688deb12b6a34553fcf9070471183c12ba75893fb84e`
  на коммите `6e2a8c48` совпадает с `localAttestation.sha256` в индексе.
  Witnesses `137→138`, floor `10` без изменений; остальные 211 эталонов не
  тронуты (стат дельты — ровно один изменённый PNG).
- Перечитана история диагностики в комментариях issue: первое Exact-b3 Validate
  (`39149280057`) было RED по этому же кадру, автор откатил S7 до S6, установил
  причину измерением DOM (не поверил на слово сам себе) и только затем сделал
  полную новую съёмку — то есть сам процесс обновления baseline соответствует
  политике (не ручной патч реализации, обычная регистрация нового эталона после
  легитимного изменения видимого текста).
- Мутанты не запускались (общая политика, вне ночного workflow запрещено):
  `scripts/mutation-registry.mjs` не менялся в этой дельте (diff пуст
  относительно r1-материала) — унаследовано без повторной проверки.

## Находки

### Low — мёртвая ссылка на удалённый ключ `fill.none` в demo-смоке (не блокирует)

**Файл:** `demo/smoke_ux_fixes.mjs:108`.

Коммит `32df1b3b` удалил ключ `fill.none` из всех четырёх базовых словарей
(`src/i18n/{ru,en,de,fr}.json`), сверив отсутствие потребителей в `src/**`. Но
`demo/smoke_ux_fixes.mjs:108` по-прежнему вызывает `c._t('fill.none')` —
это демо-смок уровня Space (`select[name="space-fill-mode"]`), не Room. Проверка
по `src/i18n.ts:32-34` (`dictionary[key] ?? FALLBACK_DICTIONARY[key] ?? key`)
возвращает теперь буквальную строку `'fill.none'` вместо прежнего «Нет».

**Почему не блокирует:** ожидаемое значение в самом смоке — `"fillHasNone": false`
(строка 147), и реальные подписи select у Space — `["Свой цвет", "По уровню
сигнала Zigbee", "Вкл/выкл свет", "По температуре"]` (строка 146) — ни «Nет», ни
`'fill.none'` среди них нет в обоих случаях, т.е. проверка была тавтологической
ещё до этой дельты (Space не показывает отдельную опцию None — после #945 она
материализуется как `custom`/0%) и остаётся тавтологической после. Прогнан:
`node demo/smoke_ux_fixes.mjs` → `OK`, `fillHasNone: false` не изменилось.

**Чем доказано:** чтение + прогон смока (обычный позитивный прогон, не мутант).
Низкая серьёзность — фактическое поведение тестов не нарушено, но ссылка на
несуществующий ключ — мусор, который стоит убрать при следующей правке этого
файла. Не блокирует вердикт, ревьюером не правится (это не предмет дельты #946),
запись оставлена для автора/следующего раунда по вкусу.

## Что проверено и корректно

- **Фикс находки r1 (AC1, опция `none`).** `src/editors/room-settings-dialog.ts:115`:
  `fillLabel` теперь зовёт `st('room.fill_none')` вместо `t('fill.none')`. Новый
  ключ `room.fill_none` добавлен во все четыре `src/i18n/settings/*.json`:
  RU «Без заливки» (дословно совпадает с эталоном
  `room-settings-v4.html` и цитатой ТЗ — та же проверка, что делал r1), EN «No
  fill», DE «Keine Füllung», FR «Aucun remplissage» — естественные переводы,
  согласованные по структуре с остальными `room.fill_*`/`space.fill_*` ключами.
- **Новый прямой oracle вместо косвенной проверки.** `demo/smoke_room_settings_946.mjs`
  добавляет точное сравнение `value`+`label` всех 5 опций (кроме `inherit`)
  реального диалога против живого DOM неизменного эталона
  (`JSON.stringify(actualFills)===JSON.stringify(expectedFills)`), с явным
  `throw` при расхождении. Логика побайтовая (не `includes`/не подстрока) —
  чтение кода достаточно, чтобы быть уверенным: любое текстовое расхождение
  хотя бы одной из пяти подписей (включая регресс обратно на `t('fill.none')`)
  приводит к разным строкам JSON → `throw`. Это и есть «тест умеет падать» для
  AC1, проверено чтением, не исполнением (исполнять старую/патченную реализацию
  запрещено общей политикой вне ночного workflow); прогон на текущем
  (исправленном) коде — `approvedOwnFillLabels: true`.
- **Удаление `fill.none`.** Подтверждено `git grep`, что ключ не используется
  нигде в `src/**` после удаления; единственная оставшаяся ссылка —
  `demo/smoke_ux_fixes.mjs` (разобрано в находке Low, не блокирует).
  `docs/DEVELOPMENT.md` честно документирует, что первый normal-push был
  остановлен штатным dead-key-гейтом (а не найден вручную), и что это не
  временное отключение проверки.
- **Трейлеры и changelog.** Все три коммита дельты несут `Issue: #946`.
  `db74707a` (`User-Visible: yes`) правит `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в себе же — оба changelog, один коммит. `32df1b3b` и
  `6e2a8c48` — `User-Visible: no`, changelog не требуется. `6e2a8c48` несёт
  `Release: v1.82.0-beta.1` + `Baseline-Reviewed-Local`, как и положено для
  коммита с обновлённым golden-эталоном.
- **Golden-аттестация дельты.** Один гарантированно изменённый кадр
  (`room-discard-dialog-mobile-ru`), причина установлена и подтверждена
  независимо (пиксельный diff + измерение ширины текста), источник аттестации —
  прямой предок материала (без несовпадения SHA/ветки, которое было у r1).
  Остальные 211 эталонов не тронуты, пороги/floor/matrixVersion не менялись.
- **Отсутствие побочных эффектов на модель/сохранение.** `src/logic.ts`,
  `room-save.ts`, `room-card-preview.ts`, резолверы наследования —
  не затронуты этой дельтой (diff дельты их не содержит); r1 уже проверил их
  построчно на предыдущем материале — поведение не изменилось, значит принято
  без повторной проверки (раздел «Унаследовано» ниже).
- Release-ledger (`docs/release-ledger/v1.81.0/946.json`, классификация `major`)
  этой дельтой не тронут — переклассификация не требуется.

## Гейты

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy --verify` | Validate зелёный на этом SHA (`6e2a8c48`): https://github.com/Matysh/houseplan-card/actions/runs/39152241454; дополнительно сам перегнал `npm run bundle:sync` (build OK) и весь `npm test` | OK — `npm test`: 5260 тестов, 5259 pass/0 fail/1 skipped |
| `demo/smoke_room_settings_946.mjs` | прогнал | `OK`, включая новый `approvedOwnFillLabels: true` |
| `demo/smoke_room_settings_form.mjs` | прогнал | `OK` |
| `demo/smoke_room_save_retry_946.mjs` | прогнал | `OK` |
| `demo/smoke_room_co2.mjs` | прогнал | `OK` |
| `demo/smoke_room_temperature_thresholds.mjs` | прогнал | `OK` |
| `demo/smoke_dialog_config_parity.mjs` | прогнал | `OK` |
| `demo/smoke_space_settings_form.mjs` | прогнал | `OK` |
| `demo/smoke_ux_fixes.mjs` | прогнал (из-за находки Low) | `OK`, `fillHasNone: false` не изменилось |
| `golden:verify` (метка `ci:golden`) | не перегонял целиком | один новый `Baseline-Reviewed-Local` на `6e2a8c48` + полный WSL-паспорт (212=211 сохранены+1 принят, 138 свидетелей/floor 10, упомянуты в комментариях автора и в `baselines-index.json`); попиксельно сверен сам изменённый кадр и причина сдвига — независимо от слов автора |
| `pytest tests_backend` | не требовался | дельта не трогает `custom_components/**`/`.py` |
| `npm run invariants` | не требовался | дельта не трогает геометрию/ссылки на неё |
| performance | не требовался | не назван ни в одном AC |

## Чего не проверял и почему

- Полный `golden:verify` на всей матрице 212 сцен не перегонялся — есть
  актуальный `Baseline-Reviewed-Local` с WSL-паспортом на материале этой
  дельты; перегон дорогого полного набора поверх уже засвидетельствованного —
  предрелизный, а не ревью-гейт (§8).
- Полная матрица demo-смоков (380+ файлов) не прогонялась — выбраны смоки с
  прямым отношением к Room/i18n-дельте (те же, что r1, плюс `smoke_ux_fixes.mjs`
  из-за находки Low); остальные не относятся к изменённым символам этой дельты.
- Части AC2–AC5 (независимое наследование границ, запрет материализации,
  источники/CO₂, независимые масштабы, Save/Cancel/retry) не перепроверялись
  заново кодом/мутантами — их реализация в этой дельте не менялась (diff
  `01901df0..HEAD` не содержит `room-save.ts`/`room-card-preview.ts`/`logic.ts`);
  приняты из r1 без повторного прогона, сами смоки перегнаны (раздел «Гейты»)
  ради уверенности, что дельта их не задела.
- `scripts/mutation-registry.mjs` не перечитывался заново построчно — diff
  относительно r1-материала пуст, запись `room-fill-segment-starts-at-none`
  унаследована как есть.
- Ручная dev/GPU-приёмка не проводилась (добровольна, #929).
- `docs/USER-GUIDE.ru.md` не правился в этой дельте и не проверялся заново
  построчно: единственные места, где встречается слово «Нет» рядом с
  описанием Room-заливки (строки ~2044, 2059, 2062, 2071), — это либо имя
  легаси space-level режима (таблица «Режимы заливки пространства», где
  Space вообще не показывает отдельную опцию None в UI, см. `smoke_ux_fixes`),
  либо неформальное перечисление через слэш («Нет/LQI/Свет/Температуру/свой
  цвет»), которое не копирует точные UI-подписи ни для одной из пяти опций
  (ср. «LQI» в доке против «По уровню сигнала Zigbee» в UI) — то есть это не
  новое расхождение, внесённое именно этой дельтой, а стиль, не изменившийся
  между r1 и r2.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: опция `none` в select «Режим заливки» показывает общее «Нет» (`fill.none`) вместо одобренного «Без заливки» (AC1) | Новый выделенный ключ `room.fill_none` = «Без заливки»/«No fill»/«Keine Füllung»/«Aucun remplissage» заменил переиспользование `t('fill.none')`; старый ключ удалён из всех базовых словарей; добавлен прямой побайтовый oracle, сравнивающий все 5 подписей с неизменным эталоном | `src/editors/room-settings-dialog.ts:115`; `src/i18n/settings/{ru,en,de,fr}.json` (новый ключ); `src/i18n/{ru,en,de,fr}.json` (удалённый ключ); `demo/smoke_room_settings_946.mjs` (`approvedOwnFillLabels: true` при прогоне); коммиты `db74707a`, `32df1b3b` |

## Унаследовано из r1

Без повторной проверки в r2 (документ `docs/reviews/CODE-REVIEW-946-r1.md`,
материал `01901df0242b89dc78dd19098ef5c25d7d07850f`), поскольку дельта r1→r2 их
не касается:

- Компоновка формы, 320/390 px без переполнения, обе темы (AC1 кроме находки) —
  `room-settings-dialog.ts:121-124`, `smoke_room_settings_946`/`smoke_room_settings_form`.
- Единый select, независимое наследование границ, запрет материализации
  эффективных значений, custom-цвет только в своей ветке, range-reset (AC2) —
  `room-save.ts`, `test/room-save-946.test.mjs`, `smoke_room_temperature_thresholds`.
- Источники/недоступный источник/CO₂ без подстановки нуля, комната без
  HA-зоны (AC3) — `renderRoomSource`, `smoke_room_co2`.
- Независимые размеры без двойного множителя, превью — синтетический образец
  (AC4) — `room-card-preview.ts`, `smoke_space_settings_form`.
- Save/Cancel/ошибка/retry, сохранение неизвестных/легаси ключей (AC5) —
  `demo/smoke_room_save_retry_946.mjs`, `test/room-save-946.test.mjs`.
- i18n-консистентность остальных (кроме разобранной) ключей `room.*`.
- Трейлеры/changelog r1-коммитов, классификация release-ledger (`major`).
- Целостность golden-аттестации r1 (`dd3a9860`, расхождение SHA/ветки
  объяснено и не влияет на доказательность).

## Побочные находки

Доверенный снимок политики: `mode=issues`. Побочных находок вне скоупа #946
нет — единственная находка этого раунда (Low, мёртвая ссылка на `fill.none` в
`demo/smoke_ux_fixes.mjs`) целиком внутри диффа дельты (её вызвало удаление
ключа этой же задачей), новый issue не создаётся.

## Маршрут и вердикт

High: 0. Medium: 0 — единственная Medium-находка r1 закрыта корректно и
полно (новый ключ, все 4 локали, прямой автотест-oracle, визуально
подтверждённый и объяснённый побочный эффект на golden). Единственная новая
находка — Low, не блокирует. Маршрут — `fix` (track `ask` не использует
`reclassify`).

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/946-room-settings`, коммит `6e2a8c480e73` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4e5e83a0a0d0c73532cfc7596ed7e9095f91483c`
  ```
  git log --all --format='%H %T' | grep 4e5e83a0a0d0
  ```
- Тело issue: `520d6d85ec8a94ccda22c1b8d47b9c3d1f52b9b228ab6ceaa083922181003dd1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NzIsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDYyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Miwib3V0cHV0X3Rva2VucyI6MzkzMTAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE4MzU5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDIwNDIxMSwiY29zdFVzZEVzdGltYXRlIjoxLjcwNzU2MjJ9XSwidHVybnMiOjYyLCJkdXJhdGlvbk1zIjo3NjgwOTksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjcxMjYyNDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5064 output_tokens=39328 cache_creation_input_tokens=118359 cache_read_input_tokens=4204211 num_turns=62 -->
