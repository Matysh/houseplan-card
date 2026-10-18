# CODE-REVIEW-945-r1

Issue: #945 «Настройки пространства: связанные разделы и явные переопределения»
Трек: `ask` · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `7cddd0b0b34beb28614f6f3578fed98cfc967204` (origin/dev..HEAD, 9 коммитов, 89 файлов,
+1374/-1014). ТЗ сверялось с текущим телом issue целиком (после spec r3 тело правилось
дважды — «Имя хранения локального режима заряда (уточнение r2)» и «Финальная команда
владельца…» — дельта не публикуется GitHub-ом, см. #517).

## Скоуп

Форма настроек пространства v7 (четыре раздела), объединение
границ/проёмов в один переключатель с миграцией `show_borders → hide_openings`,
независимые `card_name_scale`/`card_label_scale`, локальный режим заряда устройств
пространства `show_device_battery_mode`, совместимость фона/Glow, три закрытых
backend-контракта (`import_export.py`, `support_package.py`, `support_wire_schema.py`
+ зеркало `scripts/support-relay/hp_relay/support_wire_schema.py`),
`scripts/config-field-registry.mjs`/`config-schema.json`, golden-пересъёмка 4 сцен,
RU/EN/FR/DE i18n (245 ключей на локаль, паритет подтверждён).

## Риск по изменённым участкам (#707) — трек `ask`, сверка с AC ТЗ

| Класс | Участок | AC ТЗ, где поведение зафиксировано |
|---|---|---|
| migration | `import_export.py:98-99` (`_SPACE_DISPLAY_FIELDS`), `validation.py:1425,1435-1436` (новые поля схемы), `validation.py:2306-2319` (`normalize_space_display`) | AC2 (границы/проёмы), AC3 (два масштаба), AC4 (заряд) + «Уточнение backend-контрактов по ревью r1»/«Имя хранения… (r2)» |
| perf | `iso-scene-render.ts:252,856` (изо-рендер, раздельные базы для имени/показателей), `render-snapshot-capture.ts:117-118,168` (кэш снимка устройств по per-space заряду) | AC3 (раздельные масштабы, без двойного умножения), AC4 (заряд per-space в кэше снимка) |
| ux | `i18n/settings/*.json` (245 новых/изменённых ключей RU/EN/FR/DE) | AC1 (тексты/иконки/разделы v7), AC3 (подписи ползунков/CO₂), AC4 (подписи режимов заряда) |

Все три класса покрыты строкой AC — понижения трека не требуется, `route: fix` (не `reclassify`).

## Как проверялось

Чтение диффа `git diff origin/dev...HEAD` целиком по файлам; прослеживание каждого
нового поля через всю цепочку: валидация → миграция → frontend-resolver → UI → три
backend-контракта → реестр полей. Контракты backend сверены построчно (diff
`import_export.py`/`support_package.py`/`support_wire_schema.py`/relay-зеркало) —
во всех четырёх присутствуют `card_name_scale`, `card_label_scale`,
`show_device_battery_mode` с одним и тем же enum. `scripts/config-field-registry.mjs`
и `config-schema.json` зарегистрированы с теми же именами (#876-паттерн).

Прослежена математика независимых масштабов в рендере: `src/logic.ts:1366-1400`
(`spaceDisplayOf` — `cardNameScale`/`cardLabelScale` с fallback на legacy
`card_font_scale`, без двойного умножения), `src/houseplan-card.ts:12194`
(CSS-переменные `--rl-space`=`cardNameScale`, `--rl-meta`=`label_scale*cardLabelScale/
cardNameScale` — компенсация единой базы) и идентичная компенсация в
`src/iso-scene-render.ts:252-253,856` для изометрии. Математика проверена чтением:
база `font`/`rl-space` несёт `cardNameScale`, поэтому `metricScale`/`--rl-meta` делят
на `cardNameScale` и умножают на `cardLabelScale`, чтобы итоговая метрика зависела
только от своей базы — корректно и единообразно в обоих рендер-путях.

Миграция `show_borders`/`hide_openings` (`validation.py:2306-2319`) проверена чтением
против `src/logic.ts:1375,1398` (`showBorders: s.show_borders ?? noPlan`,
`hideOpenings: !(s.show_borders ?? noPlan)`) — backend-резолвер границ по умолчанию
совпадает с frontend (`not bool(plan_url)` ≡ `noPlan`). Frontend больше не читает
сырой `hide_openings` при рендере (полностью вычисляется из `show_borders`),
backend-поле остаётся только для внешних контрактов (экспорт/support) — подтверждено
`grep` по `hide_openings` в продуктовом коде.

Цепочка заряда устройств (`src/device-battery-settings.ts`) проверена чтением:
`deviceBatteryModeOf` — global → space (`spaceDeviceBatteryModeOf`, приоритет при
`!== 'inherit'`) → `device-presentation.ts:783` (`showBattery !== false &&
showMarkerBatteryOf(marker) && !effectiveHidden`, т.е. маркер может только
дополнительно скрыть, не переоткрыть). Везде, где раньше заряд читался только из
`host._settings` (глобально), теперь передаётся и `space.settings`
(`space-render.ts:599-600`, `render-snapshot-capture.ts:169`,
`render-snapshot-reuse.ts` — per-space режим добавлен в ключ кэша снимка, иначе смена
локального режима заряда не инвалидировала бы кэш).

Проверены защитные AC (таблица ниже), release-ledger, трейлеры коммитов, i18n-паритет,
восемь убранных контролов (`grep` по `s-custom-reset`/`s-glow`/`s-north-compass` и
аналогам — ни один не встречается в `space-form.ts`/стилях).

### Защитные AC — чем доказано, чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC2 (миграция границ/проёмов, идемпотентность, геометрия/свет не меняются) | `tests_backend/test_validation.py::test_issue_945_display_normalization_is_idempotent_and_keeps_geometry` (переборный unit по `plan_url`×`show_borders`×`hide_openings`, повторный вызов, неизменность `rooms`/`glow_enabled`); `test/logic.test.mjs` «#945 boundaries own opening visibility…»; `test/space-settings-945.test.mjs` «merged opening/border choice is immediate and stable» | Обычный отрицательный случай внутри того же теста: при нарушении инварианта (`hide_openings` не равен `!resolvedBorders`) assert в цикле по всем 3×3×2 комбинациям падает — ordinary PASS уже перебирает входы, которые краснеют при регрессии; выполнен в составе зелёного Validate на материале (см. ниже) |
| AC3 (card_name_scale/card_label_scale валидны 0.5–3, не ломают legacy) | `tests_backend/test_validation.py::test_issue_945_independent_font_keys_validate_without_changing_legacy` | В тексте теста — явный отрицательный случай: `for value in (True, False, 0.49, 3.01, None, "1.25", inf): pytest.raises(vol.Invalid)` — зарегистрированный негативный вход в той же функции, без мутации кода |
| AC4 (цепочка заряда global→space→marker, inherit не материализуется) | `tests_backend/test_validation.py::test_issue_945_space_battery_modes_are_lossless`; `test/space-settings-945.test.mjs` «battery inheritance is live…» (26 комбинаций `global×own`) | `assert.equal(deviceBatteryModeOf(...), …)` по всем сочетаниям — не просто happy-path: включает `global off + own undefined/inherit → off`, те же данные в обратную сторону (`own all` поверх `global off` → `all`) — несимметричный инвариант, который сломается при наивной реализации («global побеждает») |
| AC5 (фон/Glow совместимость, обычный Save не материализует унаследованное) | `test/space-settings-945.test.mjs` «active legacy background is explicit own static…» | `assert.equal('bg_color' in inherited,false)` после явного выбора «Как в общих» — отрицательный случай на материализацию сохранён в самом тесте |
| AC7 (удаление файла — отдельная операция, занятый/текущий не удалить) | Код не менялся (`git diff` не затрагивает модули удаления файлов) | Не применимо к этому диффу — поведение наследуется из уже принятого кода; новых мутаций риска нет |

Для трёх backend-контрактов (экспорт/импорт, support-пакет, wire-схема) негативный
случай — `support_wire_schema.validate()` отклоняет неизвестный ключ (`extra` не
разрешён), что и обеспечивает «тихую потерю» без добавления поля в `fields(...)`;
поля добавлены во все четыре копии (включая relay-зеркало), проверено чтением.

## Находки

### Medium (в скоупе) — `src/editors/room-settings-dialog.ts:271-272`

Диалог настроек комнаты показывает подсказку размеров и предпросмотр карточки,
используя `spaceDisplay.cardFontScale` как единую базу и для имени, и для показателей:

```ts
<p class="hpf-hint">${st('room.sizes_hint', { v: String(pct(spaceDisplay.cardFontScale)) })}</p>
<div class="hpf-tint hpf-preview">${roomCardPreview(t, st('preview.room_name'), spaceDisplay.cardFontScale, host._roomNameScale, host._roomLabelScale, co2Preview)}</div>
```

До #945 `cardFontScale` был единственным хранимым масштабом пространства и точно
отражал то, что реально рисуется на плане. После #945 (`src/logic.ts:1370-1388`)
`cardFontScale` остаётся **только** легаси-снэпшотом старого `card_font_scale` и
никогда не отражает новые независимые `card_name_scale`/`card_label_scale` —
именно эти два поля реально используются в продуктовом рендере
(`src/houseplan-card.ts:12194`, `src/iso-scene-render.ts:252-253,856`). AC3 прямо
требует: «Существующие множители комнаты применяются к соответствующим базам
пространства: имени — к `card_name_scale`, показателей — к `card_label_scale`».
`src/space-render.ts`/`houseplan-card.ts` этому следуют; `room-settings-dialog.ts` —
файл, не тронутый этим диффом (`git log -1` на нём — более ранний коммит), и он
остался на одной легаси-базе для обоих полей.

**Воспроизведение:** в Space v7 задать «Размер названия» 200%, «Размер показателей»
100% (не трогая легаси `card_font_scale`, то есть `cardFontScale` остаётся 1/100%);
сохранить. Открыть любую комнату этого пространства → «Размеры». Подсказка
`room.sizes_hint` сообщает «100%» как базу пространства для ОБОИХ полей, хотя
реально на плане имя масштабируется от 200%, а показатели — от 100%; предпросмотр
карточки (`roomCardPreview(...,spaceDisplay.cardFontScale,...)`) рисует оба элемента
с одной и той же (неверной для имени) базой. Админ получает неверную информацию и
несовпадающий со фактическим рендером предпросмотр — ровно для job J5/J6 (комнатные
показатели, поддержание плана в соответствии с реальностью).

Это не предусмотренный перенос в #946 (как явно оформлено для комнатного
legacy-Glow — см. `docs/CONFIG-COMPATIBILITY.md`: «Room suppression is retained
until its own redesigned form (#946) is saved»), а необъявленный побочный эффект:
нигде в ТЗ, `CONFIG-COMPATIBILITY.md` или `draft-decisions.md` это расхождение не
упомянуто. «Финализация комнаты/устройств» вне скоупа #945 как редизайн формы, но
сам факт поломки уже работающей (не макетной) подсказки/превью — смежный сценарий,
который ухудшается этим диффом (REVIEWER.md, «Находки и вердикт»).

Не High: сохранённые данные корректны, итоговый рендер на плане правильный
(`space-render.ts`/`houseplan-card.ts` используют верные поля) — страдает только
подсказка и предпросмотр в диалоге комнаты, не данные и не финальная отрисовка.

Предлагаемое исправление: передавать в `room.sizes_hint`/`roomCardPreview` две
отдельные базы (`spaceDisplay.cardNameScale`, `spaceDisplay.cardLabelScale`) вместо
одной `cardFontScale`, аналогично уже сделанной компенсации в
`iso-scene-render.ts`/`houseplan-card.ts`.

## Что проверено и корректно

- Три backend-контракта (`import_export.py::_SPACE_DISPLAY_FIELDS`,
  `support_package.py::_space_settings`, `support_wire_schema.py::SPACE_SETTINGS`) и
  relay-зеркало синхронно получили `card_name_scale`/`card_label_scale`/
  `show_device_battery_mode` — находки ревью ТЗ r1/r2 закрыты по существу, имя
  `space.settings.show_device_battery_mode` зафиксировано и использовано везде
  (validation.py, device-battery-settings.ts, registry, тесты).
- Миграция границ/проёмов: backend-резолвер по умолчанию (`not plan_url`) совпадает
  с frontend (`noPlan`); идемпотентность и сохранность геометрии/объектов проверены
  unit-тестом на всех 12 комбинациях `plan_url × show_borders × hide_openings`.
  Нормализация выполняется только в `CONFIG_SCHEMA` на пути записи кандидата
  (`websocket_api.py` candidate-валидация), не на пути чтения конфигурации для
  фронтенда (`config_store.async_load()` без `CONFIG_SCHEMA`) — подтверждено
  чтением обоих модулей, значит «одноразовое согласование… не отдельной записью
  при открытии» из ТЗ выполнено.
- Независимые масштабы: `logic.ts` резолвит оба новых поля с общим fallback на
  legacy `card_font_scale` без двойного умножения; реальный 2D- и изо-рендер
  корректно компенсируют единую «базовую» переменную через деление/умножение на
  нужный масштаб (проверено построчно, см. выше).
- Цепочка заряда устройств: global → space → marker реализована несимметрично
  правильно (`own all` побеждает `global off`; `marker` может только дополнительно
  скрыть); кэш снимка устройств (`render-snapshot-reuse.ts`) теперь учитывает
  per-space режим заряда в ключе инвалидации — без этого смена локального
  override не обновляла бы кэшированный снимок.
- i18n: 245 ключей на RU/EN/FR/DE, полный паритет множеств ключей (без
  расхождений); тексты «Показатель отображается, если для него есть источник
  данных.» и «Показывать уровень CO₂ в ppm.» совпадают с ТЗ дословно.
- Восемь выведенных из v7 контролов (`s-room-color-reset`, `s-card-font-reset`,
  `s-layer-openings`, `s-glow`, `s-north-reset`, `s-north-compass`, `s-card-font`,
  `s-custom-reset`) отсутствуют в реализации (`grep` по актуальным
  идентификаторам в `space-form.ts`/стилях — ноль совпадений).
- Трейлеры: все 9 коммитов несут `Issue: #945`; `User-Visible: yes` стоит ровно на
  двух коммитах (`62a7506c`, `bd0f5c54`), и оба в одном и том же коммите меняют
  `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` (проверено `git show --stat` по
  каждому). Коммит `e7f5ff70` несёт `Release: v1.82.0-beta.2` и
  `Baseline-Reviewed-Local: sha256:…` — трогает только 4 golden-baseline PNG и
  индекс, что соответствует правилу "commit touching baselines needs Release +
  Baseline-Reviewed(-Local)".
- `docs/release-ledger/v1.81.0/945.json`: `category: "major"` относительно
  предыдущего stable v1.81.0, обоснование и summary RU/EN присутствуют;
  `introducedBy` не требуется (это не `stable-fix`/`line-fix`, а новая бета-фича).
  Milestone-категория (`major`) корректно относит задачу к пользовательскому
  релизу v1.82.0.
- Одно число — один источник: размеры названия/показателей пространства хранятся
  как `card_name_scale`/`card_label_scale`, отображаются в одном месте черновика
  (`space-form.ts` ползунки) и читаются одним резолвером (`spaceDisplayOf`) всеми
  потребителями (2D и изо-рендер) — расхождения значений по месту показа не
  найдено (кроме указанной Medium-находки, где используется другое, устаревшее
  поле `cardFontScale`).

## Чего не проверял

- Полное визуальное сравнение «кадр макета / кадр реализации» для AC1 (парные
  desktop/mobile, обе темы, 320 px) не переснималось вручную: материал уже прошёл
  Validate (включая `ci:golden`) на точном SHA `7cddd0b0` —
  https://github.com/Matysh/houseplan-card/actions/runs/39125999057 — полагаюсь на
  этот прогон вместо повторной full-съёмки; сам PNG-дифф по 4 намеренно
  пересобранным сценам не открывал попиксельно.
- `npx tsc --noEmit`, `npm test`, `npm run build` (+`bundle-policy --verify`) и
  `pytest tests_backend` не перегонял: все они часть того же зелёного Validate на
  материале `7cddd0b0` (ссылка выше), включая бэкенд pytest-джоб «Бэкенд: pytest в
  Home Assistant» с установленным HA — свежий прогон не требуется по правилу
  «дешёвые гейты на этом SHA уже подтверждены» (#343).
- Полная матрица performance/нагрузочных тестов не запускалась — AC задачи её не
  называет, а предрелизные полные наборы не входят в объём ревью (§8).
- Ручная dev/GPU-приёмка не выполнялась (добровольна, #929, headless окружение не
  объявляется GPU-проверкой).
- `node scripts/invariants...` не запускал: геометрия стен/проёмов (`model_version`,
  контуры) этим диффом не меняется — меняется только видимость уже существующей
  геометрии через `show_borders`, инвариантный гейт по геометрии не относится к
  этому классу риска.
- Содержимое `draft-decisions.md`/README макета (внешние файлы по ссылкам в теле
  issue) не открывал отдельно — решения по совместимости, на которые они
  ссылаются, уже продублированы текстом в самом теле issue и в
  `docs/CONFIG-COMPATIBILITY.md`, что и было основным источником проверки.

## Маршрут и вердикт

Находка Medium в скоупе (`room-settings-dialog.ts` — устаревшая база масштаба в
подсказке/предпросмотре), High нет. Доверенный снимок политики находок:
`mode=issues`, но данная находка — **в скоупе #945**, поэтому отдельный issue не
заводится; она возвращается автору в рамках текущей задачи. Побочных находок вне
скоупа нет.

Маршрут вердикта — `route: fix` (track `ask`, не `show`; поле `criterion` не
применяется).

Вердикт: **жёлтый**.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/945-space-settings`, коммит `7cddd0b0b34b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3706e6d993c0e95e16c6c8465138980fc140659f`
  ```
  git log --all --format='%H %T' | grep 3706e6d993c0
  ```
- Тело issue: `8c57dced2dd92d55c9d6a12b1c0fb12171a934f6e2dac977b98bdc512532c193`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzNjcsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDU3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDIsIm91dHB1dF90b2tlbnMiOjQ3NDY1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1OTk1MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg2MTU2NzIsImNvc3RVc2RFc3RpbWF0ZSI6Mi44Mzc4NzI0MDAwMDAwMDA2fV0sInR1cm5zIjo3NywiZHVyYXRpb25NcyI6NTgzODQ0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi44NDMzMjk0MDAwMDAwMDA1LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5509 output_tokens=47483 cache_creation_input_tokens=159951 cache_read_input_tokens=8615672 num_turns=77 -->
