# CODE-REVIEW-231-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/231
- **ТЗ:** `docs/specs/231-decor-layer-order.md` (зелёный SPEC-REVIEW r2)
- **Диапазон полной задачи:** `git log --oneline origin/dev..HEAD` →
  `e023adb`, `9410be6`, `d2e7626`, `b747316` (продуктовый фикс, `Issue: #231`,
  `User-Visible: yes`), `e943e2f`, `d46abe5`, `6d31553`
- **Диапазон этого раунда (дельта r1→r2):** `b747316..6d31553` — SHA
  предыдущего раунда взят из тела документа r1 (`docs/reviews/CODE-REVIEW-231-r1.md`,
  «Диапазон» и «Как проверялось») и из вердикта r1 в issue (комментарий
  цитирует «на HEAD (`b747316`)»); формальная первая строка вердикта r1 сам
  SHA не называет — это соответствует ожидаемому формату §7.2, находкой не
  является, так как SHA восстанавливается однозначно из тела того же
  комментария и документа
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4

## Скоуп раунда (по дельте)

`git diff b747316..6d31553 --stat`:

```
 docs/TESTING.md                    |  14 ++-
 docs/reviews/CODE-REVIEW-231-r1.md | 204 +++++++++++++++++++++++++++++++++++
```

Продуктовый код (`src/houseplan-card.ts`, три копии бандла, тесты, smoke,
golden matrix/harness) в дельте не тронут вообще — коммит `d46abe5`
архивирует документ r1 в `docs/reviews/` (публикующий шаг, не авторская
правка), а `6d31553` — единственная содержательная правка автора: расширение
чек-листа `docs/TESTING.md` до полного списка golden-сцен, затронутых #231.
Это ровно и только предмет находки M1 из r1. Дельта локальна: новая
подсистема не затронута, контракт поведения не менялся, бандл не
пересобирался (SHA-256 идентичен r1).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе) — список golden-сцен, затронутых переносом decor, называл только 2 новые сцены; 3 существующие large-house сцены (`isometric-large-warm-remount-dark`, `large-house-zoom-250-dark`, `large-house-warm-remount-dark`) реально меняются тем же коммитом, но не были задокументированы, а причина в handoff-комментарии («уже накопленный dev-дрейф») была ошибочной | `docs/TESTING.md` теперь перечисляет все 5 сцен в одном пункте чек-листа и формулирует подтверждённую причину: «The three existing large-house scenes also change because their dense decor grid now renders above Glow-base room fills» — вместо прежней ссылки только на 2 новые сцены без объяснения. Ошибочное объяснение «дрейф dev» не повторено нигде в новом тексте. Требование «reviewed baselines только из Linux release artifact» сохранено для всех пяти сцен | `docs/TESTING.md:46-54` (см. diff выше); текстовая правка причины дополнительно зафиксирована в новом комментарии автора в issue #231 (`IC_kwDOTOcLQM8AAAABQL-q0w`, 2026-08-22 15:53), который прямо отменяет прежнюю формулировку |

Проверил построчно: три id сцен (`isometric-large-warm-remount-dark`,
`large-house-zoom-250-dark`, `large-house-warm-remount-dark`) реальны и
совпадают с определениями в `demo/golden/matrix.mjs:63,364,366` — не
опечатка и не выдуманные имена.

## Унаследовано из r1

Всё, до чего дельта `b747316..6d31553` не дотягивается, принято без
повторной проверки из `docs/reviews/CODE-REVIEW-231-r1.md` @ `b747316`
(`b74731698f664a9b0dc4c187b5b1b05ccf333b61`):

- AC1–AC7 (порядок decor относительно room fill, hover, обоих тоннелей,
  Glow-base, live Glow/солнца/стен/символов/устройств), доказанные
  `demo/smoke_decor_layer_order.mjs`, `demo/smoke_glow.mjs`,
  `demo/smoke_opening_tunnel_fill.mjs`, `demo/smoke_hide_layers.mjs`,
  `demo/smoke_decor.mjs`, `demo/smoke_backdrop.mjs` и мутантом
  `decor-restored-below-room-fills` — код `src/houseplan-card.ts` в дельте не
  менялся, бандл байт-в-байт идентичен (`sha256: baf60c9a89a8…`), поэтому
  повторный прогон этих smoke не может дать новый результат;
- Q1 (владелец) — единый порядок decor без нового persisted-флага;
- AC8 в части структуры двух новых golden-сцен (`decor-over-opaque-hover-light`,
  `decor-over-glow-base-dark`) и их `missing-baseline` статуса — сцены не
  менялись;
- release-артефакты предыдущего коммита: оба changelog, `docs/BACKDROP.md`,
  `docs/DECOR-EDITOR.md`, отпечаток `docs/images/screenshots.json`, три копии
  бандла — не затронуты этой дельтой;
- вывод «AC7/perf» (`oneDecorLayer: true`, отсутствие новых
  groups/observers/listeners) — код не менялся.

## Как проверялось в этом раунде

Дельта не трогает `src/**` и не меняет бандл, поэтому полный целевой набор
smoke/golden из r1 не переисполнялся — прогнаны только дешёвые обязательные
гейты, чтобы подтвердить, что дельта не сломала ничего наследуемого.

### Гейты — обязательная часть (прогнаны все)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | зелёный, 1070/1070 pass, 0 skip (на этом раннере `gh` доступен, `process-gate.test.mjs` не пропускается) |
| Build + bundle parity | `npm run build`, затем `sha256sum` трёх копий | зелёный, все три `houseplan-card.js` идентичны и совпадают с зафиксированным в r1 хэшем `baf60c9a89a8…` — подтверждает, что дельта не изменила продуктовый вывод |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный: «Documentation checks passed (7 files, 10 external links)» — формально не обязателен (дельта не трогает `src/**`), прогнан всё равно как дешёвый, т.к. дельта меняет `docs/TESTING.md` |

### Гейты — по необходимости

Не прогонялись повторно: `demo/smoke_decor_layer_order.mjs`, `smoke_glow.mjs`,
`smoke_opening_tunnel_fill.mjs`, `smoke_hide_layers.mjs`, `smoke_decor.mjs`,
`smoke_backdrop.mjs`, `npm run golden:verify`, `node scripts/mutation-gate.mjs`.
Причина: дельта этого раунда не касается `src/houseplan-card.ts`, тестовых
фикстур, golden-матрицы или mutation-gate — правка ограничена одним
Markdown-чек-листом. Бандл после `npm run build` в этом раунде byte-for-byte
идентичен бандлу r1 (тот же SHA-256), то есть материал, который эти гейты
проверяют, не изменился с r1 ни на бит. Повторный прогон дал бы тот же
результат, что уже запротоколирован в `docs/reviews/CODE-REVIEW-231-r1.md`, и
был бы разбором заново, а не по дельте (PROCESS §2.9).

`python -m pytest tests_backend -q` — не прогонялся, дельта не касается
Python. Performance-профили — не прогонялись, дельта не касается
производительности. Ручного тестирования в браузере не было — не
предусмотрено циклом.

## Находки

Новых находок нет. M1 закрыта полностью (см. «Закрытие раунда r1»).

## Что проверено и корректно

- Список из пяти golden-сцен в `docs/TESTING.md` полный и точный:
  2 новые + 3 существующие large-house сцены, все id проверены по существующей
  golden-матрице (`demo/golden/matrix.mjs:63,364,366`).
- Формулировка причины изменения существующих сцен верна и не противоречит
  разбору r1 (плотная decor-сетка `large-house` теперь рендерится поверх
  Glow-base заливки — прямое следствие переноса слоя, не побочный дефект).
- Правило «reviewed baseline только из Linux release artifact» сохранено для
  всех пяти сцен без исключений.
- Продуктовый код, тесты, smoke и golden-матрица не изменены этой дельтой —
  подтверждено идентичностью SHA-256 бандла и отсутствием diff вне
  `docs/TESTING.md` и архивного `docs/reviews/CODE-REVIEW-231-r1.md`.
- Трейлеры коммитов дельты (`d46abe5`, `6d31553`) — `Issue: #231`,
  `User-Visible: no`; верно, так как правка касается только внутреннего
  тест-плана, не пользовательского поведения — changelog не требуется.

## Чего не проверял

- Полный browser-smoke набор и целевые smoke из r1 (`smoke_decor_layer_order.mjs`,
  `smoke_glow.mjs`, `smoke_opening_tunnel_fill.mjs`, `smoke_hide_layers.mjs`,
  `smoke_decor.mjs`, `smoke_backdrop.mjs`) — не перепрогонялись в этом раунде,
  наследуются из r1 (см. «Унаследовано из r1»); дельта их не касается, бандл
  идентичен.
- `npm run golden:verify` и `mutation-gate` — не перепрогонялись, дельта не
  меняет рендер, геометрию, тестовые фикстуры или мутантные патчи.
- `pytest tests_backend` — не прогонялся, дельта не касается Python.
- Полный Linux golden-артефакт и его reviewed-принятие — вне цикла код-ревью
  (предрелизный шаг, §13 PROCESS.md), в этом раунде сам список сцен для
  будущего принятия проверен и признан полным.
