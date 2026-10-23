# CODE-REVIEW-1049-r1

**Issue:** #1049 «Continuous provisional tail» · трек `ask` · этап `code` · заход r1 · блокирующих циклов использовано 0/4
**Материал:** `e72d20456a5d0a0bdcb4bb61663a25504517dd8b` (ветка `issue/1049-vacuum-live-tail`, единственный коммит поверх `dev`)
**Предыдущий этап:** SPEC-REVIEW-1049-r1 — зелёный (комментарий 2026-10-23T19:40:01Z)

## Скоуп

Один коммит `feat(vacuum): keep an observed live tail between native snapshots`
(44 файла, +1295/-56). Реализует ТЗ из тела issue: общий ограниченный
provisional-хвост (`vacuum_live_tail.py` / `vacuum-live-tail.ts`) между
снимками native-пути, типизированную границу новой задачи Dreame (typed
`started`-признаки), склейку по единственному совпадающему endpoint с
2-см допуском, общий бюджет/камеру/стиль с native, диагностику на 4 языках
и сохранение полной обратной совместимости (format-2, Store v1, старый
frontend/backend). Трейлеры коммита: `Issue: #1049`, `User-Visible: yes`;
оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правлены в этом же коммите.
Релизный ledger `docs/release-ledger/v1.82.0/1049.json`: `major`,
milestone 1.83 — соответствует прямому решению владельца в ТЗ (раздел 11,
«отмена прежнего инварианта — решение владельца, не скрытый обход»),
подтверждённому в зелёном SPEC-REVIEW. `introducedBy` не требуется:
категория не `stable-fix`/`line-fix`.

## Как проверялось

| Гейт | Результат | Кто выполнил |
|---|---|---|
| CI product на точном SHA `e72d20456` (run 40019938885) | `success`, `headSha` совпадает | **я, `gh run view`** |
| `node scripts/process-gate.mjs --issues` | «гейт пройден, предупреждений 0» | **я** |
| `node scripts/mutation-gate.mjs --check` | все 6 новых `vacuum-live-*-1049` мутантов — `ok` (патч применяется к материалу), static-readiness 1808/execution=0 | **я** |
| `node --test test/vacuum-live-tail.test.mjs test/vacuum-trail-diagnostics.test.mjs test/vacuum-path-geometry.test.mjs` (после `tsc -p tsconfig.test.json` + `fix-test-build.mjs`) | 33/33 passed | **я** |
| `node --test test/golden-matrix.test.mjs` | 57/57 passed | **я** |
| Прямое исполнение `vacuum_live_tail.py` (`ensure_live/append_live/acknowledge_live/observe_task`) вне pytest, ключевые сценарии AC2–AC5 | все ассерты совпали с кодом тестов | **я** (pytest/`homeassistant` недоступны в среде ревью — см. «Чего не проверял») |
| HA-harness pytest (179 passed), `node demo/smoke_vacuum_live_tail.mjs` (16 red → green), golden-сцены `vacuum-live-tail-turn-dark` / `-pending-dialog-dark`, остальные vacuum-смоки | заявлено автором на WSL/push CI, **принятый proof** (review-light-golden complete, run 40019938885) | автор + validate-gate |
| `npm run gate:small`, полный `npm test` (5174/622/516/422) | заявлено автором, не повторялось (материал не менялся, покрытые проверки не дублирую) | автор |

Одно число — один источник: dist `+6737` байт (3 397 646 → 3 404 383)
читается из единственного файла `scripts/monolith-baseline.json`
(поле `bundleBytes`) — проверено диффом, совпадает с текстом комментария
автора. `docs/STATUS.md` счётчики тестов генерируются `status-snapshot.mjs`
из одного источника.

## AC / доказательства (защитные — с «чем краснеет»)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 непрерывный хвост | `smoke_vacuum_live_tail.mjs`: 16 red-свидетелей на неизменённом dev до кода (gap/pixel), green после; View/kiosk × Flat/2.5D; код `currentVacuumTrailFrame` прочитан | исполненный before/after smoke-прогон (принятый proof) |
| AC2 ordered-prefix catch-up | `acknowledge_live` исполнен мной вручную (prefix test OK); `vacuum-live-tail.test.mjs` (я, green); HA controlled delayed read — заявлен автором | mutant `vacuum-live-future-prefix-consumed-1049`, registered, **не исполнялся** |
| AC3 ambiguous/no guessed join | исполнено мной (`ambiguous test OK`); `vacuum-live-tail.test.mjs` «repeat native, empty… do not fabricate remote chords» (я, green) | mutant `vacuum-live-ambiguous-prefix-consumed-1049`, registered, **не исполнялся** |
| AC4 task boundary once / Store survives | исполнено мной (`task boundary test OK`); HA-harness `test_proven_start_clears_cached_native_and_store_preserves_consumed_proof` заявлен автором (WSL) | mutant `vacuum-live-prestart-position-relabelled-1049`, registered, **не исполнялся** |
| AC5 мойка/пауза не создают job | исполнено мной (`service-dock-no-arm OK`, параметризованные случаи прочитаны) | mutant `vacuum-live-service-dock-arms-task-1049`, registered, **не исполнялся** |
| AC6 owner/cursor fencing | `vacuum-live-tail.test.mjs` «owner, epoch, unknown, clock rollback, teleport» (я, green); backend `_live_owner` сброс в `trails.py::_sample` — проверено чтением, переменные `entry/vac_entry/owner/st_vac/st_src` определены выше по коду | mutant `vacuum-live-old-owner-joined-1049`, registered, **не исполнялся** |
| AC7 общая камера/стиль #1002 | код-ревью: non-hybrid путь рендера не меняется (`g.hybrid` оборачивает только гибридный случай), `.core` сохраняет старый `stroke-opacity`; существующие camera/style-смоки — принятый proof | — (не защитный AC в терминах лимита/гарда; поведенческий, покрыт существующими смоками) |
| AC8 perf/shared reserve/quota | `vacuum-path-geometry.test.mjs` «changing a tail quota does not rescan…» — **я исполнил**, `computations===1` для 10 разных budget; HA-счётчик `len(calls)==2` заявлен автором | mutant `vacuum-live-cap-missing-1049`, registered, **не исполнялся** |
| AC9 совместимость | `vacuum-live-tail.test.mjs` malformed/closed-projection (я, green); backend `test_live_tail_projection_never_exposes_private_metric_or_task_fields`, `test_malformed_store_is_reset_only_inside_the_known_private_window` — прочитаны, логика соответствует | тесты сами содержат отрицательные входы (malformed version/epoch/sample, private keys) |
| AC10 диагностика 4 языка + режимы | `vacuum-trail-diagnostics.test.mjs` — **я исполнил**, включает проверку `never`-режима и всех 4 языков | тест сам проверяет `never` переключает `display`/`rendered=0` |

## Находки

Находок уровня High или Medium нет.

Низкоуровневое наблюдение (Low, не открывает цикл): глобальная проверка
`self._entry_bytes() + 512*140+4096 > MAX_ENTRY_BYTES` в `TrailBook.on_point`
(общий бюджет 64 MiB на всю книгу, не только на хвост этого робота) не имеет
отдельного юнит-теста именно на срабатывание этого предохранителя — только
покрытие пер-хвостового лимита 512/32 (AC8). Поведение консервативно
(не рисует лишнего, просто раньше объявляет `limited`), путь крайне
маловероятен в проде (нужно почти исчерпать общий 64 MiB резерв), поэтому
не поднимаю это до Medium.

## Что проверено и корректно

- `vacuum_live_tail.py`: `ensure_live/append_live/acknowledge_live/project_live/observe_task`
  — прочитан целиком и независимо исполнен вне pytest на сценариях prefix-catch-up,
  ambiguous-revisit, task-boundary-once, service-dock-no-arm; поведение совпало
  с ассертами тестового файла.
- `trails.py`: `begin_native_task`, расширения `on_point`/`on_snapshot`
  (сравнение `_awaiting_digest`, watermark `since`, `acknowledge_live` вызов
  с `endpoint_cm`/`read_started_ms`), блок `_sample()` с `activity_owner`/
  `observe_task`/`_live_owner` сброс — прочитаны целиком, переменные
  определены корректно, границы совпадают с текстом ТЗ §5.3.
- `vacuum_path_collector.py`: `read_started_ms` через `time.time()` (реальные
  часы, не инжектируемый `self.clock()`) — согласовано с тем, что watermark
  сравнивается с `last_updated` реальных HA-состояний, а не с синтетическим
  тестовым `clock`; не нашёл несоответствия единиц времени.
- `vacuum_paths.py::public_trails`: `live_tail` проецируется через `project_live`
  (закрытая форма), при `waiting=True` для `current` публичные `paths/points`
  зануляются — подтверждено тестом `test_live_tail_projection_never_exposes_private_metric_or_task_fields`
  и `test_940_native_empty_is_persistent_and_full_replacements_do_not_archive_verified`
  (restart: `public ... == []`, `Store ... == raw`).
- `vacuum-trail-material.ts::currentVacuumTrailFrame`: гибридная композиция
  (native + provisional, единая `opacity`-группа, вычитание tip-точки из
  геометрии под RAF, общий бюджет `budget - count`) — логика и тест
  согласуются; при отсутствии `live_tail` (старый backend) ветка полностью
  пропускается — обратная совместимость подтверждена тестом.
- `vacuum-path-geometry.ts::VacuumPathGeometryCache`: проекция (calibrate+
  simplify) кэшируется отдельно от `budget` (новый `projections` WeakMap,
  ключ без budget) — именно это требовал риск AC8 «обход полной native
  трассы по geometry revision, не на каждой позиции»; подтверждено
  исполненным тестом (`computations===1` для 10 разных budget).
- `houseplan-card.ts`: `disconnectedCallback`/смена `_liveSyncConnection`/
  `_vacTick` на hidden/no-src/unknown корректно помечают `livePending.gap`,
  предотвращая утечку устаревшего локального pending через переподключение
  или скрытие устройства.
- i18n: 4 новых ключа добавлены во все 4 языка (`de/en/fr/ru`), текст
  совпадает с формулировками ТЗ §6; `USER-GUIDE.ru.md` переформулирован в духе
  нового контракта («живой хвост», «ожидается текущий путь») без изобретения
  терминологии.
- Документация (`VACUUM.md`, `ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`,
  `STATUS.md`, `DEVELOPMENT.md`) обновлена синхронно с кодом, формулировки
  не противоречат друг другу и диффу.
- Мутации: 6 новых защитных мутантов (`vacuum-live-*-1049`) зарегистрированы,
  статически применяются к материалу (`mutation-gate --check` → `ok` на
  каждом), не исполнялись — согласно общей политике (исполнение только
  nightly).

## Чего не проверял

- HA-harness `pytest tests_backend/...` (179 passed, WSL Ubuntu) —
  в среде этого ревью нет пакета `homeassistant` и `pytest`
  (`python3 -m pytest` → `No module named pytest`); воспроизвести не мог.
  Доверяю заявленному прогону автора и зелёному push CI product/tooling/docs
  на точном SHA (проверил `product` напрямую через `gh run view`, `headSha`
  совпал).
- Браузерные смоки/Golden (`smoke_vacuum_live_tail.mjs`,
  `smoke_vacuum_native_lifecycle.mjs`, `smoke_vacuum_camera.mjs`,
  `smoke_vacuum_style_1002.mjs`, две новые Golden-сцены) — не перезапускал:
  это адресный диапазон принятого `review-light-golden` proof на этом же
  SHA (ссылка в задаче), код после прогона не менялся. Содержимое двух PNG
  (SHA256 указаны автором) не просматривал пиксельно сам.
- Исполнение зарегистрированных мутантов (`vacuum-live-*-1049`) — запрещено
  вне ночного workflow; проверил только их статическую применимость.
- Полный `npm run gate:small` / полный `npm test` (5174+622+516+422 тестов) —
  не повторял целиком; выполнил адресный поднабор, напрямую касающийся
  диффа (frontend unit + golden-matrix структурные тесты), плюс
  `process-gate`/`mutation-gate --check`.
- `npm run invariants` — не запускал: дифф не меняет геометрию плана/комнат/
  стен, только кэш рендера и геометрию хвоста пылесоса; критерий «правка
  геометрии» (§8) к модели плана не относится.
- Ручная приёмка на реальном HA/физическом роботе — добровольна, не гейт
  (REVIEWER.md, «Позиция ревьюера»); её отсутствие не находка.

## Вердикт

Зелёный. Реализация соответствует принятому ТЗ по всем десяти AC,
защитные ветки имеют executed negative-тесты и/или зарегистрированные
(не исполненные) мутанты, совместимость и документация синхронны с кодом,
трейлеры и release-ledger корректны. Побочных находок нет — новый issue не
заводится (`mode=issues`, но Medium вне скоупа отсутствует).

**Маршрут:** `fix` (не применимо при зелёном — цикл не открывается).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1049-vacuum-live-tail`, коммит `e72d20456a5d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2106c3b3265f32e1efc7d2d607c2726ae733a601`
  ```
  git log --all --format='%H %T' | grep 2106c3b3265f
  ```
- Тело issue: `fbbf444a4ae964df15b21b98cb0c0f3d6010cdd7d6f5f5b5adcf04137bb5ab8b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMjMsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjI4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Niwib3V0cHV0X3Rva2VucyI6NDE5MjQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTg5NzIyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTY0NDY2NiwiY29zdFVzZEVzdGltYXRlIjoyLjMwNzIzMzE5OTk5OTk5OTN9XSwidHVybnMiOjUzLCJkdXJhdGlvbk1zIjo1MTQ5MDIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjMxMjQ2MTIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5209 output_tokens=41945 cache_creation_input_tokens=189722 cache_read_input_tokens=5644666 num_turns=53 -->
