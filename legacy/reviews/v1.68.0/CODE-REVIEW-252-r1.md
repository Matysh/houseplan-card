# CODE-REVIEW-252-r1

- Issue: [#252](https://github.com/Matysh/houseplan-card/issues/252) — «Отчёт "Оптимизировать" перечисляет внутренние id вместо того, чтобы починить или сказать, что делать»
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- ТЗ: `docs/specs/252-optimize-orphan-layout-report.md`, зелёное ревью SPEC-REVIEW-252-r2
- Диапазон: `origin/dev..HEAD`, коммиты `883a95a…df51542`; поведенческий коммит — `8fd8ccb` (`Issue: #252`, `User-Visible: yes`)
- Вердикт: **зелёный** · High: 0 · Medium: 0 · Low: 1 (снято с записью)

## Скоуп

Задача — J6 (`docs/SCOPE.md`): «Keep the plan true as the home evolves». Optimize
теперь классифицирует layout-позиции с мёртвым `space` по владельцу (комната,
устройство/маркер, групповая метка, неизвестный namespace), автоматически
удаляет только доказанно отсутствующих владельцев, сохраняет живых и
непроверенных, и убирает внутренние id из основного текста отчёта в
свёрнутые «Подробности». Изменение не расширяет скоуп за рамки ТЗ: новых
персистентных полей, миграций или новых экранов нет; `config`/HA registry не
модифицируются, изменяется только layout-запись. Правило SCOPE.md «никогда не
удалять файл пользователя по догадке» не нарушено — здесь удаляются не файлы, а
координатные записи, и только при доказанном отсутствии владельца, а не по
инференции.

## Как проверялось

Дешёвые гейты (прогнаны в этом раунде, код изменился существенно):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | зелёный: 1124/1124 (в моём прогоне 0 skipped; автор указывал 1123/1 skipped — расхождение не воспроизвелось, не блокирует) |
| `npm run build` + сверка трёх копий бандла | зелёный; SHA-256 `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` идентичны и равны `341ef5e3…` из отчёта автора |
| `node scripts/check-docs.mjs` | зелёный: «7 files, 10 external links» (diff трогает `src/**`) |

Инварианты модели (`npm run invariants`): в этой версии репозитория такого
npm-скрипта не существует (`package.json` его не содержит, `#254` ещё не
слит в `dev`) — гейт неприменим, не пропущен молча.

`python -m pytest tests_backend`: не запускался — diff не трогает
`custom_components/**/*.py` (только сгенерированный JS-бандл в той же папке).

Smoke-подбор — `node scripts/smoke-select.mjs --base origin/dev --head HEAD`:

```
Прямое совпадение (6):
  demo/smoke_orphan_space_references.mjs   ← _alignDialog, _openAlignDialog, _toggleOptimizeLivePositions
  demo/smoke_grid_snap.mjs                 ← _alignDialog, _openAlignDialog
  demo/smoke_optimize_coordinate_canonicalization.mjs ← _alignDialog, _openAlignDialog
  demo/smoke_optimize_geometry_preflight.mjs ← _alignDialog, _openAlignDialog
  demo/smoke_optimize_micro_interval.mjs   ← _alignDialog, _openAlignDialog
  demo/smoke_warm_dialogs.mjs              ← _alignDialog, _openAlignDialog
```

Совпадает с выбором автора. Все 6 прогнаны локально (headless Chromium) —
все `OK`, включая `smoke_orphan_space_references.mjs`, который прямо
проверяет отсутствие сырых id (`opaque_owner`, `gone`) в основном тексте,
`aria-pressed` на кнопке opt-in и текст «выбраны для удаления» без
противоречивого «будут сохранены» рядом (регресс, который сам автор поймал и
закрыл в `df51542`). Остальные 165 смоков не запускались — тема (grid/geometry
preflight/micro-interval/warm-dialogs) действительно про общий диалог
Optimize, других сильных или слабых связей инструмент не назвал.

`node scripts/mutation-gate.mjs --check` — полный прогон, 136/136 `ok`,
включая оба новых мутанта:

- `orphan-cleanup-partial-registry-deletes` — ловит мутацию, при которой
  `rosterAuthoritative` захардкожен в `true` (неполный registry перестаёт быть
  доказательством отсутствия);
- `orphan-cleanup-proven-owners-kept` — ловит мутацию, которая перестаёт
  реально удалять `absent`-позицию из layout, оставляя только счётчик.

`npm run golden:verify` — политика репозитория (`demo/golden/policy.mjs`)
запрещает частичный `--scenario=`, разрешён только полный прогон. Прогнал
полный матрикс (97 сценариев, ~2 минуты, Chromium 151.0.7922.34 — совпадает с
зафиксированным в `baselines-index.json`): **97/97 passed**, включая
`optimize-orphan-references-dark-en` и `optimize-orphan-references-light-ru`.
Дополнительно сверил `git diff` по `baselines-index.json` — единственные
изменённые/добавленные хэши это ровно эти два сценария, что подтверждает
запись автора «изменены только две ожидаемые #252-сцены, 95 остальных
возвращены к прежним байтам» независимо от CI.

Performance-профили не запускались — не названы в AC8 явно как обязательные
для цикла ревью (AC8 требует их только на pre-release гейте), путь
maintenance-only и не в render loop.

## Разбор по AC

- **AC1** (доказанно отсутствующие room label/device/group удаляются,
  категории без id, сумма верна, второй Optimize — no-op): подтверждено
  unit-фикстурой `issue 252 removes only proven room, device and group orphans
  and is idempotent` (32/3/2, ровно числа из issue) и мутантом
  `orphan-cleanup-proven-owners-kept`; идемпотентность — вторым вызовом
  `repairSpaceReferences` в том же тесте (`again.report.*Removed === 0`).
- **AC2** (живой config-marker/HA device/`lg_` entity в мёртвом пространстве не
  удаляется по умолчанию, называется именем, удаляется только после opt-in +
  Apply): unit `issue 252 preserves live owners by default and removes only
  them after explicit opt-in` покрывает все три категории живых владельцев;
  smoke проверяет UI-цепочку preview → toggle → Apply → Undo сквозно.
- **AC3** (неавторитетный/ограниченный registry, неизвестный namespace,
  объект, пропавший только из `_devices`, — сохраняются, разрушительной кнопки
  нет): unit `issue 252 fails closed for limited registry and unknown future
  layout owners` + мутант `orphan-cleanup-partial-registry-deletes`. Отдельно
  прочитан код `_optimizeReferenceContext`: `liveDeviceIds`/`liveEntityIds`
  строятся из полного `registry.devices`/`registry.entities` (+ `hass.states`
  для entity), а не из отфильтрованного `_devices`, значит временный уход
  объекта из render-снапшота (area-фильтр и т.п.) не превращается в удаление —
  проверено чтением, не исполнением, отдельного unit на этот конкретный канал
  фильтрации нет, но принцип (`_devices` только для имён, не как доказательство)
  структурно закреплён и покрыт мутационным гейтом на противоположный канал
  (полный registry).
- **AC4** (id не в основном тексте; нет старых терминов «неразрешённых
  позиций»/«вложенных сопоставлений»): `test/i18n.test.mjs` явно проверяет
  отсутствие `this._t('gs.optimize_reference_warning'` в исходнике и
  отсутствие технических слов в новых RU/EN строках; smoke проверяет реальный
  DOM (сырые id есть только в закрытом `<details>`).
- **AC5** (clean config/layout deep-equal; #244 remap/detach не регрессирует;
  unknown fields сохраняются; #248 round-trip): существующие #244-тесты
  адаптированы, а не удалены (например, «detaches a live marker but preserves
  its stale coordinates until explicit cleanup» — намеренная смена поведения
  ровно в сторону AC2, не регресс); «large valid reference graph stays
  unchanged» не тронут и зелёный.
- **AC6** (Cancel не пишет; Apply — exact preview; Undo восстанавливает всё;
  no-op не трогает backup): подтверждено smoke (`previewOffersOneApplyWithoutWriting`,
  `cancelWritesNothing`, `applyUsesExactAtomicEndpoint`, `undoRestoresDeadRefs`
  — включая восстановление `rl_removed_room` и `removed-marker`, не только
  старого `orphan`-кейса).
- **AC7** (keyboard/screen reader, `<details>` свёрнут по умолчанию, фокус не
  теряется, touch target): `<details>` без `open` — свёрнут; `.optimize-cleanup`
  — настоящая `<button type="button">` с `min-height: 44px`; `aria-pressed`
  и `role="status"`/`role="alert"` расставлены по смыслу. Сохранение фокуса на
  кнопке после пересчёта preview не покрыто отдельным assert на
  `document.activeElement` — проверено чтением: кнопка рендерится в одной и той
  же ветке шаблона независимо от состояния `removeLiveMissingPositions`
  (меняются только атрибуты/текст внутри неё), поэтому lit-html переиспользует
  тот же DOM-узел и не может увести фокус структурно. Не блокирует, но стоит
  отметить как не доказанное исполнением.
- **AC8** (гейты implementation-цикла зелёные): `typecheck`/`unit`/`build`
  зелёные лично; targeted smoke и полный golden выполнены выше и тоже зелёные.

## Что проверено и корректно

- Классификация владельца (`src/space-reference-repair.ts:302-360`) построена
  на индексах, собранных один раз (`existingRoomIds`, `activeMarkers`,
  `removedMarkers`, `liveDeviceIds`, `liveEntityIds`, `knownDeviceIds`) —
  линейна по layout, соответствует заявленной сложности §12 ТЗ.
  `removed:true` маркер — единственное «мгновенное» доказательство отсутствия
  устройства (соответствует принятому предположению §14.4 ТЗ); `unknown`
  namespace всегда `unverified` независимо от `authoritative` (соответствует
  §6.3 «неизвестный ключ: всегда unverified»).
- Классификация не мутирует `config` — удаляется только `layout[key]`; сумма
  `orphan*Removed` корректно входит и в toast (`gs.align_done`), и в maintenance
  count диалога.
- `plan-optimizer.ts`: новые счётчики зануляются в «no persisted change» ветке
  наравне со старыми (`spaceRefsRemapped` и т.п.), а не персонально, что
  сохраняет прежний инвариант «нулевые счётчики на чистом конфиге» (AC5) без
  дублирования логики.
- Документация: `docs/CANVAS.md:494-497` — старая формулировка **заменена**
  (не дополнена) новым доказательным контрактом, как и требовало ТЗ и
  зелёное `SPEC-REVIEW-252-r2`; `docs/CHANGELOG.md`/`.ru.md` в том же
  коммите `8fd8ccb` явно называют сужение обещания v1.59.0-rc.1;
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE(.ru).md` обновлены по списку §13 ТЗ.
- `Baseline-Reviewed` golden-коммит (`668ed49`) соответствует правилу §12
  «не принимать golden по частичному артефакту»: явно указано, что просмотрен
  полный 97-сценарийный Linux-артефакт, изменения ограничены двумя
  #252-сценами, остальные 95 возвращены к прежним байтам — независимо
  перепроверено (см. выше).

## Находки

**Low (снято с записью, не блокирует).** `src/i18n/en.json`/`ru.json`
сохраняют ключ `gs.optimize_reference_warning` со старой формулировкой
(«неразрешённых позиций», «вложенных сопоставлений»), хотя код его больше не
вызывает (`test/i18n.test.mjs` прямо проверяет отсутствие вызова). Мёртвый
литерал, не влияющий на поведение и не нарушающий AC4 (AC4 — про то, что
видит пользователь, а не про наличие неиспользуемого ключа в словаре). Не
возвращаю автору: цена держания записи ниже цены повторного цикла ради одной
строки в JSON.

## Чего не проверял и почему

- `npm run invariants` — скрипта нет в этой версии репозитория (#254 не
  слит); гейт неприменим, а не пропущен.
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- Полная браузерная матрица smoke (171 файл за вычетом выбранных 6) — тема не
  пересекается с изменённым символьным следом (`_alignDialog`,
  `_openAlignDialog`, `_toggleOptimizeLivePositions`); инструмент подбора не
  назвал других прямых или слабых связей.
- Performance-профили (`benchmark:*`) — не названы в AC8 как обязательные для
  цикла ревью; путь maintenance-only, не render loop, полный performance-гейт
  явно отнесён ТЗ (§11) к пред-релизному циклу.
- Ручное тестирование в браузере (не входит в конвейер ревью) — вместо него
  использованы браузерные smoke на headless Chromium и полный `golden:verify`.
- Фокус-контракт AC7 (кнопка opt-in) — разобран чтением кода/шаблона lit-html,
  не отдельным исполняемым assert-ом на `document.activeElement` (см. AC7 выше).

## Итог

Реализация точно следует одобренному ТЗ: доказательный, а не эвристический,
контракт удаления; живые и непроверенные владельцы по умолчанию сохраняются;
внутренние id ушли из основного отчёта в «Подробности»; Preview/Cancel/Apply/
Undo/идемпотентность #248 не регрессируют. Все обязательные для этого этапа
гейты (typecheck, unit, build+bundle parity, check-docs, targeted smoke,
mutation-gate, полный golden) прогнаны лично и зелёные. Единственная находка —
Low, снята с записью. Blocking-находок нет.
