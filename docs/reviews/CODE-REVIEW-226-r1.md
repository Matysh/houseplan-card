# Код-ревью #226 — r1

- Issue: [#226](https://github.com/Matysh/houseplan-card/issues/226)
- ТЗ: [`docs/specs/226-entity-parent-dedup.md`](../specs/226-entity-parent-dedup.md)
  (зелёное ревью r2: [`SPEC-REVIEW-226-r2.md`](SPEC-REVIEW-226-r2.md))
- Ветка: `issue/226-entity-parent-dedup`, коммит реализации `f151e70`
- Материал: `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD`
- Вердикт: **зелёный** · цикл r1/4 · High: 0 · Medium: 0

## Скоуп разбора

Первый цикл код-ревью — разбор полный. Диапазон коммитов от `dev`: два
docs-коммита спец-ревью (уже приняты на этапе spec), один implementation
commit `f151e70`. Продуктовый код меняется только в `src/devices.ts`
(`buildDevices`, `seedHiddenBindings` + два новых internal helper).
Сопутствующие изменения: `test/devices.test.mjs`, `demo/smoke_entity_parent_dedup.mjs`,
`scripts/mutation-gate.mjs`, `docs/FILTERING.md`, `docs/USER-GUIDE{.ru,}.md`,
`docs/TESTING.md`, оба changelog, `docs/specs/README.md`, три копии bundle.

## Как проверялось

### Прочитано построчно

- `src/devices.ts` diff целиком: `entityMarkerOwnership()`,
  `residualAutoDeviceEntities()`, их встраивание в `buildDevices()` (авто-цикл
  устройств, строки ~1092–1144) и в `seedHiddenBindings()` (~1004–1030), а
  также неизменённые ветки — явный `device:D` (~1180–1210) и явный `entity:X`
  (~1211–1245), чтобы подтвердить заявленную асимметрию.
- `src/ha-binding-status.ts`: `activeRegistryHass`, `fullRegistryHass`,
  `isRegistryEntryEnabled`, `HaBindingStatus` — чтобы проверить, что
  реконструкция `itemBindingStatus` для частичного остатка (`{kind:'active',
  enabledEntityIds: entIds, allEntityIds: entIds}`) не роняет поля, которых нет
  в варианте `active`, и что `hass.entities[eid].hidden` — тот же нормализованный
  frontend-флаг, что уже используется в `visibleFirst()` (`devices.ts:147`) —
  не новое допущение этого PR.
- Потребители `allEntities`/`entities` вне `devices.ts` (`device-presentation.ts:247`,
  `device-toggle.ts:384,723`) — подтверждено, что частичный остаток
  сознательно не протекает через `allEntities` (§6 ТЗ), а не через
  недосмотр: если единственный cover в остатке скрыт HA, `allEntities`
  корректно не содержит его, и это ровно граница #94, которую ТЗ объявляет
  ожидаемой.
- `test/devices.test.mjs` и `test/mutation-gate.test.mjs` diff целиком —
  сопоставлено с матрицей §12 ТЗ (таблица ниже).
- `docs/FILTERING.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md`, оба `CHANGELOG` — сверено с §16 ТЗ и с формулировками,
  принятыми на ревью ТЗ (§3.3/§8), терминология не изобретена.

### Выполнено (не только прочитано)

```
npx tsc --noEmit                          → passed, без вывода
npm test                                  → 971 passed / 0 failed / 0 skipped
npm run build                             → passed
sha256sum dist/… custom_components/…/frontend/… demo/srv/assets/…
                                           → одинаковый хеш на всех трёх копиях,
                                             совпадает с хешем из хендоффа автора
                                             (795513ec6d15…)
node scripts/mutation-gate.mjs --id=entity-marker-kept-in-parent-device
                                           → чистый прогон ok, мутант "покраснел, как обязан"
node scripts/mutation-gate.mjs --id=entity-marker-parent-seeded
                                           → чистый прогон ok, мутант "покраснел, как обязан"
node demo/smoke_entity_parent_dedup.mjs   → OK, все 8 planFacts/previewFacts/staticFacts true
node demo/smoke_cover_not_primary.mjs     → OK, 36/36 фактов true (регресс #94 не пойман)
node demo/smoke_cover_tap.mjs             → OK, 31/31 фактов true
node scripts/check-docs.mjs --external    → passed (7 файлов, 10 внешних ссылок)
npm run inventory                         → 971 unit / 144 pure backend / 114 HA-harness / 156 smokes
                                             (сверено с записью автора)
```

Дисциплина «тест должен уметь падать» применена к обоим мутационным guard: у
каждого проверен и чистый прогон (ok), и то, что патч именно ломает целевой
тест, а не проходит мимо.

## Находки

Нет находок ни High, ни Medium. Один Low, снят с записью ниже.

**Low — тест-матрица §12.7 не покрывает первую половину кейса напрямую.**
ТЗ (кейс 7, AC4) требует: «явная HA-hidden entity работает как exact marker».
Тест `hidden-only curtain residual disappears…` доказывает только вторую
половину (hidden sibling не удерживает остаток). Прямого юнита «маркер
`entity:X`, где сама `X` имеет `reg.hidden: true`, и это не глушит explicit-ветку»
нет.

Снимаю без правки: ветка `kind === 'entity'` в `buildDevices` (строки
~1211–1245) не читает `hidden`/`reg.hidden` ни в этом коммите, ни до него —
diff её не касается вовсе. Поведение «explicit entity marker показывается
независимо от HA-hidden» не новое и не зависит от `entityMarkerOwnership`;
риск регрессии от этого PR отсутствует, потому что PR не добавляет туда ни
одной строки. Это пробел в тест-документации ТЗ (заявлена AC-покрытием кейса,
которого нет буквально), не дефект кода. Не блокирует — верно чтением, а не
исполнением, что здесь и достаточно.

## Что проверено и корректно

- **AC1 (нет полного дубля).** `residualAutoDeviceEntities` вычитает
  `placedEntityIds` из `entsBy[dev.id]`; при пустом остатке
  `if (residual.partial && !residual.entityIds.length) continue;` — устройство
  не попадает в вывод ни в `buildDevices`, ни в `seedHiddenBindings`. Юнит-кейсы
  1/3 зелёные, мутант `entity-marker-kept-in-parent-device` подтверждён
  падающим при откате правила.
- **AC2 (частичный остаток).** Тест «partial auto parent contains only visible
  unclaimed siblings» проверяет не только `entities`, но и `allEntities`,
  `bindingStatus`, `primary` и `resolvedLightSources` — заявленная claimed
  light не протекает повторно. `itemBindingStatus` — валидный `active`-вариант
  `HaBindingStatus` (проверено типом в `ha-binding-status.ts:14`), typecheck
  зелёный.
- **AC3 (явная асимметрия).** Тест «explicit device and child entity markers
  coexist intentionally»: `device:D` сохраняет полный состав через
  неизменённую ветку (~1187, `bindingStatus.enabledEntityIds`), не пересекается
  с `residualAutoDeviceEntities`. Пре-существующий тест «entity tombstone does
  not strip that entity from a live parent device» (строка 451, не в дельте)
  прогнан в общем `npm test` и зелёный — `entityMarkerOwnership` корректно
  пропускает `marker.removed === true`.
- **AC4 (hidden-контракты + #94).** `residualAutoDeviceEntities` возвращает
  `{partial:false, entityIds:[...entityIds]}`, когда `ownership.byDevice` не
  содержит записи для устройства — нетронутый auto/`device:D` не фильтрует
  hidden вообще, что и требует §8 ТЗ. Подтверждено смоками
  `smoke_cover_not_primary.mjs`/`smoke_cover_tap.mjs` (регресс #94 не
  воспроизведён) и юнитом «hidden-only curtain residual disappears but
  explicit device stays cover-first» — untouched-ветка даёт `primary:
  'cover.curtain'`, split-ветка убирает auto-marker, explicit `device:D`
  восстанавливает штору. Marker-hidden (case 5) и HA-disabled (case 9)
  отдельно покрыты юнитами и дают верный `ghost`/`hidden` статус.
- **AC5 (standalone/группы).** Ветка light-groups (`groups`, `claimed.has('entity:'+g.eid)`)
  не тронута диффом; helper без `device_id` пропускается в
  `entityMarkerOwnership` через `if (!deviceId) continue;`.
- **AC6 (seeder parity).** `seedHiddenBindings` использует те же
  `entityMarkerOwnership`/`residualAutoDeviceEntities`, не дублирующую
  реализацию — единственный источник правила, как требует §6 ТЗ. Тест
  «entity ownership uses the same visible residual as buildDevices» и мутант
  `entity-marker-parent-seeded` подтверждают.
- **AC7 (все renderers).** `demo/smoke_entity_parent_dedup.mjs` проверяет
  полный View/kiosk-DOM (390×760, touch-профиль), клик по exact-marker
  (`light.ceiling`, точный `turn_off`, конфиг не перезаписывается), Device
  editor preview (`hp-device-preview` — ровно одна `.dev`-морда) и
  `houseplan-space-card` (статическая карта видит только exact-сущность).
- **AC8 (динамический registry).** Юнит «registry hidden sibling changes
  rebuild the residual without config writes» — два снапшота (`hidden`/`visible`)
  дают разный список без переписывания маркера (`assert.deepEqual(marker, …)`
  на неизменный объект).
- **AC9 (совместимость).** Diff не трогает `ServerConfig`, backend,
  i18n-ключи, wire protocol. `npx tsc --noEmit` зелёный, `npm run build`
  зелёный.
- **AC10 (release-артефакты).** Оба changelog в том же коммите `f151e70`
  (`Issue: #226`, `User-Visible: yes`), `docs/FILTERING.md`/`USER-GUIDE{.ru,}.md`/`TESTING.md`
  описывают ownership тем же языком, что принят на ревью ТЗ.
  `docs/images/screenshots.json`: `sourceFingerprint` обновился (ожидаемо —
  `src/**` изменился), все 10 `imageSha256` идентичны dev — визуальной дельты
  в захваченных сценариях нет. Три копии bundle синхронны по SHA-256.
- **Производительность (§17 ТЗ).** `entityMarkerOwnership` — один проход по
  `markers` (`O(markers)`), `residualAutoDeviceEntities` — `O(1)` lookup на
  сущность через `Set`/`Map`, никакого вложенного поиска markers внутри
  device/entity циклов. Проверено чтением, не исполнением (нет отдельного
  perf-теста в AC этой задачи).
- **Мутационные guards.** Оба id из §14 ТЗ присутствуют в `scripts/mutation-gate.mjs`
  и подтверждены индивидуальным прогоном (см. выше). `test/mutation-gate.test.mjs`
  не менялся, но перебирает `MUTANTS` обобщённо — новые id уже под его
  структурными проверками (`patch anchors exactly once`, `guard file exists`,
  `explains itself`).
- **Трейлеры.** `f151e70`: `Issue: #226`, `User-Visible: yes` — терминальные,
  оба changelog в том же коммите.

## Чего не проверял и почему

- **`npm run golden:verify` не запускался.** Golden-фикстуры (`demo/golden/matrix.mjs`,
  `harness.mjs`) — про геометрию стен/комнат/glow, ни один сценарий не строит
  устройство с несколькими сущностями и явным entity-marker на части из них
  (проверено grep по фикстурам). Единственный канал, где эта задача могла
  задеть видимый пиксель, — количество/состав device-маркеров на скриншотах
  документации, а там все 10 `imageSha256` не изменились. Риск, который
  `golden:verify` мог бы поймать сверх уже пройденных смоков, оцениваю как
  пренебрежимо малый для объёма этой правки; полный golden — гейт предбета
  (PROCESS.md §8), не код-ревью.
- **`npm run golden:capture`/принятие baseline** не запускалось — не требуется:
  геометрия marker не меняется (ТЗ §15), новых сценариев нет.
- **`python -m pytest tests_backend`** не запускался — диф не касается
  `custom_components/houseplan/**/*.py` ни одним файлом (только сгенерированный
  frontend-бандл под `custom_components/houseplan/frontend/`, класс D).
- **Полный набор из 156 браузерных смоков** не прогонялся. Прогнаны три:
  новый `smoke_entity_parent_dedup.mjs` (назван в AC7/матрице §12.15) и два,
  которые делят с диффом общий resolver #94 (`smoke_cover_not_primary.mjs`,
  `smoke_cover_tap.mjs`). Остальные смоки покрывают геометрию/openings/sun/
  touch-жесты — поверхности, которых этот diff не трогает.
- **Performance-профиль на синтетическом большом registry** не запускался:
  не назван в AC этой задачи, а линейность подтверждена чтением кода (раздел
  выше).
- **Ручное тестирование в браузере** не проводилось — по процессу код-ревью
  этого цикла работает по диффу и автоматическим доказательствам, не по живому
  UI.

## Итог

Все 10 AC доказаны автотестом или прочитанным кодом с явной пометкой способа
проверки; оба мутационных guard подтверждены индивидуальным прогоном, включая
проверку, что они действительно способны покраснеть. Единственная находка —
Low, документационный пробел тест-матрицы без функционального риска, снят с
запиской выше. Готово к статусу «Принято»/`S8-merged`.
