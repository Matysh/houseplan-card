# #514 — E2E на реальном HA как гейт стабильного релиза

- **Issue:** https://github.com/Matysh/houseplan-card/issues/514
- **Тип / приоритет:** infra, process / P2
- **Трек:** полный — две поверхности (`release.yml` + скрипт гейта здесь; `e2e.yml` в `houseplan-e2e`), плюс секрет владельца
- **Оценка:** ценность 8/10 (единственная проверка релиза на настоящем HA перед HACS); сложность 3/10; риск 2/10 (ложный красный задерживает stable, не ломает ничего)
- **Связано:** #511 (release-gate по последнему прогону), #510 (validate-gate — образец ожидания dispatch-прогона), houseplan-e2e (13 сценариев, 08–09.09), AUD-159B7-02 (ассет ждёт гейта)

## 1. Проблема

Стабильный релиз проходит Validate и Full Performance на точном SHA, но ни разу не запускается в настоящем Home Assistant: боковая панель, роли, рестарт HA, обновление интеграции проверяются только ночным прогоном `houseplan-e2e` на «последней бете», результат которого никто не ждёт и который не привязан к тегу. Между последней бетой и stable бывают коммиты (v1.73.0 = beta.9 + два коммита бюджетов) — stable уходит в HACS непроверенным.

## 1.1. Сценарий

Владелец публикует stable-релиз (как сейчас: тег → GitHub Release с ассетами → `release.yml`). Гейт `release.yml` для stable дополнительно запускает `e2e.yml` в `houseplan-e2e` на этом теге и ждёт зелёного; красный — ассет не публикуется, в логе гейта ссылка на прогон E2E с трейсами. Беты — без изменений.

## 1.2. Что человек увидит до и после

Пользователь HACS — ничего (кроме того, что stable, который падает на реальном HA, до него не доедет). Владелец — один дополнительный шаг в job `Гейт` (~4–6 мин) и его ссылка в логе.

## 2. Скоуп

1. `scripts/e2e-gate.mjs` (новый) — запуск и ожидание E2E на теге (§4).
2. `release.yml`, job `gate` — шаг «Require green E2E on a real Home Assistant for a stable release» после Full Performance (§5).
3. `houseplan-e2e/.github/workflows/e2e.yml` — сьют `journeys-dev` только по расписанию (§6).
4. Документация (§8).

## 3. Не-скоуп

- Беты, nightly, ревью-конвейер, merge-candidate — E2E там не запускается.
- Новые сценарии E2E, матрица HA beta для гейта (гейт — только `ha_version=stable`).
- Автоматическая публикация stable (остаётся ручной/скриптовой, как сейчас).

## 4. `scripts/e2e-gate.mjs`

Чистая функция `e2eGate({ tag, ops, appearMs, totalMs, pollMs })` поверх инъектируемых `ops` (образец — `validate-gate.mjs` #510) и `realOps({ repo: 'Matysh/houseplan-e2e', workflow: 'e2e.yml', token })` на `gh`.

1. `ops.dispatch(tag, upgradeFrom)` → `gh workflow run e2e.yml --repo Matysh/houseplan-e2e --ref main -f houseplan_ref=<tag> -f upgrade_from=<предыдущий stable> -f ha_version=stable`. `upgradeFrom` — новейший не-пре-релиз, не черновик, с тегом ≠ `<tag>` (`gh release list --repo Matysh/houseplan-card`); нет такого — `stable`. Уточнение после живого прогона в S6 (09.09): к моменту `release: published` сам тег — уже «stable», и `upgrade_from=stable` заставлял сьют `upgrade` обновлять v1.73.0 на v1.73.0 (`Expected: not "1.73.0"`). Ошибка запуска (403 — токен без `actions: write` на `houseplan-e2e`) → `result=error` с текстом «нужен секрет `E2E_DISPATCH_TOKEN` с правом Actions: write на houseplan-e2e»; ассет не публикуется.
2. Опознание своего прогона: `ops.listRuns()` (`gh run list --workflow e2e.yml --event workflow_dispatch --json databaseId,status,conclusion,url,createdAt --limit 10`) → кандидаты с `createdAt ≥ t0 − 60 с`; для каждого `ops.jobs(id)` — прогон **наш**, если хотя бы одна job называется `… · HP <tag> · …` (имя job в `e2e.yml` несёт `matrix.ref`). Первый подошедший — `tracked`; чужие dispatch (владелец запустил руками другой тег) игнорируются. Не появился за `appearMs` (3 мин) → `missing`.
3. Ожидание завершения `tracked` до `totalMs` (45 мин), опрос каждые 20 с. `success` → `green`; `failure`/`timed_out` → `red`; `cancelled` → `red` с пометкой «отменён вручную» (concurrency-группа dispatch в `e2e.yml` не отменяет — `cancel-in-progress: false`, значит отмена рукотворная); таймаут → `red`.
4. CLI: `node scripts/e2e-gate.mjs --tag=<tag> [--repo=Matysh/houseplan-e2e]`, печатает `result=`, `url=`, `note=` (и в `$GITHUB_OUTPUT`), код выхода 0 только на `green`. Константы 3/45 мин — из `merge-candidate.mjs` (`VALIDATE_APPEAR_MS`, `VALIDATE_TOTAL_MS`).

## 5. `release.yml`

Job `gate`, после «Require full performance for a stable release», с тем же `if: ${{ !github.event.release.prerelease }}`:

```yaml
- name: Require green E2E on a real Home Assistant for a stable release
  if: ${{ !github.event.release.prerelease }}
  env:
    GH_TOKEN: ${{ secrets.E2E_DISPATCH_TOKEN || secrets.HP_PROCESS_TOKEN }}
    TAG: ${{ github.event.release.tag_name }}
  run: node scripts/e2e-gate.mjs --tag="$TAG"
```

Ассет `houseplan.zip` к моменту события `published` уже приложен (`release-prerelease.mjs` и ручной stable-рецепт публикуют из черновика с ассетами; `release-zip.yml` лишь перекладывает), поэтому E2E ставит ровно те байты, что скачает HACS. Если ассета нет (публикация мимо рецепта) — `install-houseplan.mjs` падает с «no houseplan.zip asset», гейт красный с этой строкой в логе E2E: это правильный отказ, не флейк.

Токен: `HP_PROCESS_TOKEN` — classic PAT со scope `repo`+`workflow` (им конвейер пушит в `dev`), он даёт `workflow_dispatch` на все репозитории владельца; секрет `E2E_DISPATCH_TOKEN` — запасной вход на случай fine-grained токена. Проверка — первый stable после слияния; до него — dispatch `release.yml` невозможен (событие `release`), поэтому шаг проверяется тестом на текст и живым прогоном скрипта с `gh` владельца в хендоффе (`node scripts/e2e-gate.mjs --tag=v1.73.0` → green/red по факту).

## 6. `houseplan-e2e/e2e.yml`

Сьют `journeys-dev` (снимок `dev`) не относится к тегу и может краснеть по причинам, не связанным со stable: job получает `if: matrix.suite != 'journeys-dev' || github.event_name == 'schedule'`. Остальные три сьюта на dispatch с `houseplan_ref=<tag>`: `journeys` и `first-run` — тег, `upgrade` — с предыдущего stable (`upgrade_from` вычисляет гейт, §4 п.1) на тег. Условие «только по расписанию» для `journeys-dev` реализуется job `plan`, собирающей матрицу: job-level `if` не читает `matrix.*` (первая правка упала на парсинге workflow). Отдельный коммит в `houseplan-e2e` (там процесс не ведётся; ссылка на коммит — в хендоффе).

## 7. Тесты и мутанты

- `test/e2e-gate.test.mjs` (новый, fake ops с снимками и `jobsById`): dispatch и ожидание; чужой dispatch без `HP <tag>` в именах job игнорируется, свой отслеживается; red на failure; missing по `appearMs`; red по `totalMs`; `cancelled` → red с пометкой; ошибка dispatch → `error` с текстом про секрет.
- `test/release-workflow.test.mjs` (новый): шаг есть, стоит после Full Performance, условие `!prerelease`, токен с фолбэком, вызывает `scripts/e2e-gate.mjs --tag`.
- Мутанты (`scripts/mutation-gate.mjs`, гард `node --test test/e2e-gate.test.mjs`): `release-ships-on-red-e2e` (failure читается как green), `release-trusts-foreign-e2e-run` (опознание по имени job снято — любой dispatch считается своим), `release-upgrades-stable-onto-itself` (`upgrade_from` всегда `stable`). Каждый — отрицательным прогоном штатным раннером.

## 8. Документация

`PROCESS.md` §8 «Гейт стабильного релиза»: «+ E2E на реальном HA зелёный на теге (houseplan-e2e)». `docs/DEVELOPMENT.md` §релиз (строка про Full Performance): E2E, что делать при красном (открыть прогон, трейсы в артефактах, починить → новый тег). `AGENTS.md`/`docs/TESTING.md`: одна строка про место E2E. README `houseplan-e2e`: «dispatch с тегом — гейт stable в houseplan-card».

## 9. Совместимость и откат

Беты не затронуты. Откат — удалить шаг из `release.yml`; `e2e-gate.mjs` без вызова безвреден.

## 10. Критерии приёмки

- AC1. Stable-релиз (`!prerelease`) не получает ассеты, пока dispatch `e2e.yml` на этом теге не завершился `success`; красный/отсутствующий/отменённый прогон и ошибка запуска → гейт красный с понятной причиной и ссылкой (тесты `e2e-gate`, `release-workflow`).
- AC2. Гейт опознаёт **свой** прогон по `HP <tag>` в именах job и не принимает чужой dispatch (тест + мутант `release-trusts-foreign-e2e-run`).
- AC3. Пре-релизы (`prerelease: true`) шаг не выполняют (условие в yml, тест).
- AC4. `journeys-dev` не бежит на dispatch (коммит в houseplan-e2e, ссылка в хендоффе; проверка — dispatch e2e.yml на `v1.73.0` показывает 3 job).
- AC5. Все три мутанта §7 пойманы штатным раннером.
- AC6. Документы §8 обновлены; `User-Visible: no`; UX/i18n/модель данных/перф не затронуты.

## 10.0. UX, модель данных, i18n

Не затрагиваются: изменения только в workflow, скриптах CI и документации.

## 10.1. Риски и меры

- E2E-флейк задержит stable → повторный запуск `release.yml` невозможен по событию; владелец перезапускает job `gate` кнопкой «Re-run failed jobs» (release-gate ждёт по последнему прогону, #511, для e2e — новый dispatch).
- Токен без прав → гейт краснеет с явной инструкцией про `E2E_DISPATCH_TOKEN`, а не молчит.
- Параллельный ручной dispatch E2E владельцем на другой тег — не мешает опознанию (AC2).

## 11. Затронутые файлы

`scripts/e2e-gate.mjs` (новый), `.github/workflows/release.yml`, `scripts/mutation-gate.mjs`, `test/e2e-gate.test.mjs` (новый), `test/release-workflow.test.mjs` (новый), `PROCESS.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `AGENTS.md`, `docs/specs/README.md`; в `houseplan-e2e`: `.github/workflows/e2e.yml`, `README.md`.

## 12. Принятые предположения

- `HP_PROCESS_TOKEN` имеет `repo` scope (пушит в `dev` и переставляет метки) — dispatch в соседний репозиторий владельца им доступен; иначе — `E2E_DISPATCH_TOKEN`.
- Имя job в `e2e.yml` с `HP ${{ matrix.ref }}` — стабильный контракт для опознания; тест в houseplan-e2e его не пинит, поэтому фраза фиксируется в README e2e.
