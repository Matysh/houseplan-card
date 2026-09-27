# CODE-REVIEW-495-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/495
- **Материал ревью:** SHA `2946e28352f35962f617d1066e53f3b8e9a4e044` (ветка `issue/495-import-commit-and-route-runs-durability`, `HEAD` рабочей копии на нём)
- **Диапазон:** `git diff origin/dev...HEAD` — 11 файлов, +842/−50
- **Заход:** r1 · блокирующих циклов израсходовано 0/4 (первый заход, бюджет §4 тратят только жёлтый/красный)
- **ТЗ:** `docs/specs/495-import-commit-and-route-runs-durability.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-495-r1.md`, комментарий issue от `claude`, S3→S5)

## Скоуп

Два независимых backend-разрыва между ответом/памятью и durable-состоянием
(аудит 2026-09-08 §11 п.6, B2/B3), в скоупе J6 `docs/SCOPE.md`:

- **B2 (Import Apply):** после успешного `_commit_pair` код повторно
  валидировал preview-токен (`get_candidate(..., consume=True)`) и мог
  вернуть `preview_expired` для уже применённого импорта (TTL истёк во время
  записи, либо токен вытеснен новым preview того же пользователя).
- **B3 (маршруты робота):** `TrailRecorder.async_purge_orphans` снимал
  прогоны удалённых/перенацеленных маршрутов из памяти книги, но не писал их
  в Store, если у маркера не было сирот — после рестарта HA прогоны
  возвращались.

Диапазон правки не тронул `src/**`, `demo/**`, миграции, i18n, геометрию плана
— только `custom_components/houseplan/{websocket_api,trails}.py`, тесты и
tooling (`scripts/mutation-gate.mjs`), changelog, `docs/specs/README.md`.

## Как проверялось

**Прочитано построчно и сверено со спецификацией:**

- `websocket_api.py` diff (§4.1 ТЗ): `await _commit_pair(...)` →
  `rt.import_previews.pop(msg["token"], None)` вместо повторного
  `get_candidate(..., consume=True)`. Проверено: после `_commit_pair` в блоке
  `try` не осталось ни одного выражения, способного поднять `ImportFailure`
  — путь «commit прошёл → ответ ошибка» недостижим по построению. Порядок
  событий (`houseplan_config_updated`/`layout_updated`, `send_result`) идёт
  строго после выхода из `try/except`, что совпадает с §4.2/§4.3 ТЗ.
- `trails.py` diff (§5.1 ТЗ), построчно сверено с шестью шагами контракта:
  снятие прогонов теперь считается под `_refresh_lock` (`_drop_unknown_routes`
  — новый приватный метод, возвращающий снятые слоты `{marker: {slot: run}}`
  для отката, семантика самого `TrailBook.drop_unknown_routes` не менялась —
  проверено чтением, дифф её не касается); ветки «есть сироты» /
  «сирот нет, но есть drop» ведут к одной и той же durable-записи
  (`_delete_many_locked` → `_save_now_locked`, либо просто
  `_save_now_locked`); откат при сбое записи восстанавливает и сирот
  (`_delete_many_locked`'s собственный `except`), и снятые прогоны
  (`_restore_dropped` во внешнем `except` `async_purge_orphans`) — оба пути
  дизъюнктны (сироты — маркеры вне `live_marker_ids`, `dropped` — только по
  живым маркерам из цикла `config.get("markers")`), пересечения нет; событие
  `houseplan_trail_updated` фильтруется флагом `fire`, установленным только
  после успешной записи, и не всплывает на раннем `return 0` (нет сирот, нет
  drop) — `finally` не поднимает событие, потому что `fire` остаётся `False`.
  `_delete_many_locked` не захватывает lock повторно (вызывается изнутри
  `async with self._refresh_lock` в `async_purge_orphans`, а публичный
  `_async_delete_many` остался тонкой lock-обёрткой для `async_delete`) —
  реентерантности `asyncio.Lock` не возникает.
- Все `find`-паттерны пяти новых мутантов в `scripts/mutation-gate.mjs`
  сверены построчным `grep`/`python` против текущего `trails.py`/
  `websocket_api.py` — каждый встречается ровно один раз, патчи не потеряют
  цель при будущей правке рядом (это частая причина немого мутанта).
- Трейлеры коммита `2946e283`: `Issue: #495`, `User-Visible: yes`; оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в этом же коммите.
  `docs/specs/README.md` обновлён.

**Независимо перепроверено через CI (не поверх заявления автора):**

Validate `2946e283` — https://github.com/Matysh/houseplan-card/actions/runs/34315451762,
`success`. Прочитаны логи конкретных джобов, не только итоговый статус:

- `Бэкенд: pytest в Home Assistant` — реально выполнен (не пропущен из-за
  отсутствия `homeassistant`): лог содержит установку
  `pytest-homeassistant-custom-component`, харнесс-гвард
  (`collected HA-harness tests: 367`, порог ≥50 пройден) и финал
  `830 passed, 2 skipped in 25.07s`. Это подтверждает независимо от текста
  автора, что новые `test_issue_495_*` в `test_ha_import_export.py`,
  `test_trail_recorder.py`, `test_ha_websocket.py` реально прогнаны и зелёные
  на точном материале ревью.
- Три джоба `Мутанты по диффу (1/3, 2/3, 3/3)` — построчно найдены все 5
  новых мутантов §6.3 ТЗ, каждый со своей строкой
  `<id>: тест покраснел, как обязан` (т.е. мутация действительно ломает
  тест — тест умеет падать) плюс предшествующий `ok   чистый прогон: …`
  (немутированный код тест не ломает). Это ровно дисциплина «тест должен
  уметь падать», проверенная средствами CI на этом SHA, а не по слову автора:
  `import-apply-rechecks-preview-after-commit`,
  `trail-purge-forgets-routes-when-orphans-exist`,
  `trail-purge-failed-orphan-write-loses-dropped-runs`,
  `trail-purge-drops-routes-in-memory-only`,
  `trail-purge-keeps-dropped-runs-after-failed-write` — все пять красные под
  мутацией.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` (прогнано
  локально в этом ревью): «Исполняемого frontend-диффа нет
  (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются».
  Подтверждает, что смоки/golden не применимы — диапазон правки не касается
  рендера или `src/**`.
- `npm run invariants` не запускался и не требовался: диапазон не касается
  геометрии плана, рёбер комнат, `layout`, `marker.space`, `open_spans` —
  только маршруты робота (независимая от геометрии сущность) и preview-реестр
  импорта.
- «Одно число — один источник»: диапазон не добавляет и не меняет ни одной
  видимой пользователю величины (ни в UI, ни в ответе Apply, кроме уже
  существующих `config_rev`/`layout_rev`, которые дублирования не приобрели).
  Не применимо.

## Находки

Нет ни одной находки High или Medium.

Отмечаю (Low, не блокирует, не правится в этом раунде): в `async_purge_orphans`
между снятием прогонов из памяти (`_drop_unknown_routes`, синхронно, под
`_refresh_lock`, без `await`) и завершением `await self.store.async_save(...)`
event-loop может выполнить синхронный HA-колбэк `_on_state` → `on_point`
для того же маркера (если в этот момент придёт точка робота на ещё живом
маршруте). Если запись Store после этого упадёт, `_restore_dropped` вернёт в
память старый снятый прогон поверх уже записанного `on_point`'ом нового —
частный случай потери самой свежей точки при одновременном сбое диска и
движении робота. Это не новый риск: тот же паттерн «restore перезаписывает
только что пришедшие данные при сбое записи» уже был в исходном
`_async_delete_many` (§335) — там `self.book.data.update(removed)` в `except`
делает то же самое для целого маркера. Диапазон #495 расширяет уже принятый
продуктом компромисс на более узкую гранулярность (слот вместо всего
маркера), не вводит новый класс риска и не относится ни к одному AC. Не
заводится отдельным issue (Low, не Medium) — оставляю как наблюдение.

## Что проверено и корректно

- AC1/AC2 (Apply): построчно + независимо через зелёный
  `test_issue_495_apply_result_follows_the_commit_when_the_preview_expires_meanwhile`
  и `..._survives_eviction_by_a_newer_preview` в CI-логе (часть
  `830 passed`), плюс мутант `import-apply-rechecks-preview-after-commit`
  подтверждённо красный под старым поведением.
- AC3 (drop без сирот доходит до Store): `test_issue_495_dropped_route_runs_reach_the_store_without_orphans`
  зелёный в CI; мутант `trail-purge-drops-routes-in-memory-only` красный.
- AC4 (откат памяти при сбое записи, оба пути — с сиротами и без):
  `test_issue_495_dropped_route_runs_roll_back_when_the_store_write_fails` и
  `test_issue_495_failed_orphan_transaction_restores_dropped_route_runs_too`
  зелёные; мутанты `trail-purge-keeps-dropped-runs-after-failed-write` и
  `trail-purge-failed-orphan-write-loses-dropped-runs` красные.
- AC5 (сироты и drop одной транзакцией):
  `test_issue_495_dropped_route_runs_share_the_orphan_transaction` зелёный;
  мутант `trail-purge-forgets-routes-when-orphans-exist` красный.
- AC6 (live-HA `config/set` → `trail/get` → `Store.async_load` без снятого
  прогона): `test_issue_495_config_set_dropping_a_route_purges_its_runs_durably`
  зелёный в CI (входит в 830 passed, реальный HA-харнесс, не стаб).
- AC7 (мутанты пойманы штатным раннером): все 5 подтверждены построчно в
  логах трёх джобов `Мутанты по диффу`.
- Трейлеры, оба changelog, `docs/specs/README.md` — на месте, в том же
  коммите.
- Не-скоуп ТЗ (§3) соблюдён: алгоритмы импорта/материализации/калибровки не
  тронуты; TTL не продлевается; #491-фехтование не тронуто; легаси-прогоны
  без `route_id` по-прежнему не удаляются; файлы пользователя не затронуты.
- Обратная совместимость `async_purge_orphans` (возвращает число маркеров, не
  прогонов) и `TrailBook.drop_unknown_routes` (сигнатура/семантика,
  `bool`-возврат для `test_trails.py`) — не менялись, проверено чтением: сам
  метод `drop_unknown_routes` вне диапазона правки.

## Чего не проверял

- Гейты `npx tsc --noEmit`, `npm test`, `npm run build`, `bundle:sync`,
  `bundle:budget`, `check-docs` — не прогонял: диапазон не трогает `src/**`
  ни один файл (`git diff --stat -- src/ demo/` пуст), эти гейты к этой
  задаче не относятся по правилу «объём гейтов соразмерен задаче». Фронтенд-
  джоб Validate (`Фронтенд: типы, юниты, мутанты, синхрон бандла`) всё равно
  зелёный на этом SHA как часть обычного прогона.
- `python -m pytest tests_backend -q` не прогонял локально сам — в этой
  сессии нет HA-харнесса (`ModuleNotFoundError: No module named
  'homeassistant'`, `.venv-backend` отсутствует). Вместо повторного прогона
  прочитал полный лог джоба `Бэкенд: pytest в Home Assistant` на точном SHA
  `2946e283` и убедился, что 830 тестов реально выполнились (харнесс-гвард
  ≥50 HA-тестов прошёл, не 0/skip) — это эквивалентно личному прогону по
  доказательной силе на этом материале.
- `npm run golden:verify`, browser smokes — не применимо, диапазон не меняет
  ничего рендеримого; `smoke-select.mjs` подтвердил это же локально.
- `npm run invariants` — не применимо, геометрия плана не затронута.
- Ручного тестирования (реальный HA + реальный робот/Zigbee-маршрут) не
  проводил — заменено: (а) чтением кода на предмет полноты контракта, (б)
  независимой проверкой, что весь набор `tests_backend` включая новый
  live-HA тест AC6 зелёный на CI для точного SHA.

## Вердикт

Все 7 AC выполнены и доказаны (автотестом + подтверждённой способностью
теста падать под соответствующим мутантом, независимо перепроверено по
логам CI на точном SHA, а не только по заявлению автора). High: 0. Medium: 0.
Единственное наблюдение — Low, вне AC, не новый риск (унаследован от #335),
не блокирует и не заводится отдельным issue.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/495-import-commit-and-route-runs-durability`, коммит `2946e28352f3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `00b28b1e78d556fc0a32afef46bab1c45304326b`
  ```
  git log --all --format='%H %T' | grep 00b28b1e78d5
  ```
- ТЗ `docs/specs/495-import-commit-and-route-runs-durability.md`, блоб `a6fb6bbe17da6cc4ca7579279397f40730c235fd`
  ```
  git log --all --find-object=a6fb6bbe17da6cc4ca7579279397f40730c235fd -- docs/specs/495-import-commit-and-route-runs-durability.md
  ```
- Вердикт конвейера: `green` · High 0
