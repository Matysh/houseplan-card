# CODE-REVIEW-251-r2

- Issue: [#251](https://github.com/Matysh/houseplan-card/issues/251) — «Маркер выключателя гаснет, когда недоступна управляемая им лампа — читается как «выключатель offline»»
- Этап: код-ревью (PROCESS.md §2.7), заход **r2**, блокирующих циклов израсходовано **1/4** до этого разбора
- Ветка: `issue/251-controller-target-availability`
- r1: вердикт **красный**, `High: 1` (H1 — golden-эталон `device-icon-state-table-{light,dark}` сломан diff'ом, не переприннят), `Medium: 0`. Документ: `docs/reviews/CODE-REVIEW-251-r1.md`. SHA, на котором получен вердикт r1, в коротком комментарии-вердикте issue **не назван** — сама находка процесса; восстановлен из тела документа r1 (таблица гейтов: «диапазон `origin/dev..HEAD`, HEAD `f18b5b4`»), а не из угадывания.
- **Разбор по дельте** (PROCESS.md §2.10): дельта `f18b5b4..HEAD` — три файла (принятие golden-baseline + правка одной смок-фикстуры + коммит документа r1), не меняет контракт поведения, не задевает новую подсистему, размер несопоставим с исходной задачей (`b984f16`). Полный разбор не требуется.

## Дельта r2 → r1

```
$ git log --oneline f18b5b4..HEAD
268348d test(smoke): mark cover controller available
e09e449 test(golden): accept v1.67.0-beta.4 controller states
e8d86f4 docs: review document for #251        (артефакт r1, публикация конвейера)

$ git diff --stat f18b5b4..HEAD
 demo/golden/baselines/baselines-index.json         |   8 +-
 demo/golden/baselines/device-icon-state-table-dark.png   | Bin
 demo/golden/baselines/device-icon-state-table-light.png  | Bin
 demo/smoke_cover_plate_precedence.mjs               |   8 +-
 docs/reviews/CODE-REVIEW-251-r1.md                  | 201 ++++++++
```

`e8d86f4` — публикация r1-документа шагом конвейера, класс C, не предмет этого разбора.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — `demo/golden/baselines/device-icon-state-table-{light,dark}.png` не переприняты под изменённый `demo/golden/matrix.mjs` (маркер `golden-left-linkquality` получил `controls`+`tap_action`, `light.golden_light_three` → `unavailable`); `golden:verify`/CI-job `golden` красны, `docs/TESTING.md` заявляет недоказанный AC6 | Коммит `e09e449` `test(golden): accept v1.67.0-beta.4 controller states` — полноценная приёмка через `npm run golden:accept -- --reviewed` по прогону CI `golden` на полном Linux-артефакте (`Baseline-Reviewed: .../actions/runs/32617372743`, `Release: v1.67.0-beta.4`), ровно как требовал вердикт r1, а не локальная перезапись. | Воспроизвёл сам: `node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-light` → `passed`; то же для `-dark` → `passed` (было `different`, `diffRatio 0.0014` при пороге `0.0005`). `sourceFingerprint` в `baselines-index.json` (`b674338…`) совпадает с `sourceFingerprint(cwd)`, пересчитанным на текущем дереве — эталон принят со свежего, а не устаревшего дерева. |

Сопутствующая находка, всплывшая у автора при пере-прогоне (не была частью H1, не входит в бюджет циклов — обнаружена и устранена автором самостоятельно до повторной подачи): полный exact-HEAD прогон (`.../runs/32618422055`) поймал устаревшую фикстуру `smoke_cover_plate_precedence.mjs` — маркер `p_remote` (сущность `sensor.remote`, `controls: ['light.hall']`) не имел собственного живого состояния, и после отделения controller/target availability (`b984f16`) стал классифицироваться как `unavail` вместо мирроринга состояния цели. Коммит `268348d` явно задаёт `sensor.remote: st('online', {})` — тот же приём, что применён к фикстуре солнца на #89: дефект в фикстуре, а не сокрытие. Проверил разбором и экспериментом (см. ниже) — предмет теста (target-state mirroring) не изменился, тест сохранил способность падать.

## Унаследовано из r1

Без повторной проверки — код и AC1–AC9 не менялись между `f18b5b4` и `HEAD`, задокументировано в `docs/reviews/CODE-REVIEW-251-r1.md` на SHA `f18b5b4`:

- Продуктовая семантика §6.1/§7.1/§7.2 ТЗ (`controllerAvailability()` в `src/device-presentation.ts`, `unavailableToggleTargetNames()` и confirm-race в `src/device-toggle.ts`/`houseplan-card.ts`) — читана построчно, юнит-матрица и 4 мутационных гварда подтверждены r1.
- AC7 (модель/схема/конфиг не меняются), AC8 (документация, i18n, changelog RU+EN в `b984f16`), AC9 (bundle parity в рамках реализации).
- Трейлеры и провенанс продуктовых коммитов `ba0c787`/`b984f16`/`f18b5b4`.
- Скриншоты документации (`f18b5b4`, прогон `32617490601`) и структурная проверка `check-docs.mjs` (без `--external`).
- Смок-выборка по diff'у `origin/dev..HEAD`: 4 прямых совпадения (`smoke_controls`, `smoke_help_affordance`, `smoke_optimize_coordinate_canonicalization`, `smoke_partition_openings`) — src-диапазон не менялся с r1, повторный подбор дал бы тот же список (перепроверено ниже, не только унаследовано).

## Как проверялось в r2

Дешёвые гейты — прогнаны заново на текущем `HEAD` (`268348d`), не унаследованы, т.к. дёшевы и код изменился:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm test` | `# tests 1117 / # pass 1117 / # fail 0 / # skipped 0` |
| `npm run build` | OK; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp … demo/srv/assets/houseplan-card.js` — три копии идентичны, SHA-256 `7a526c3fd9993b9d2de95eb842c9e66962a9b7c26f8d6135e8131ad562e23292` (совпадает с хендоффом автора) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | `гейт пройден, предупреждений 0` (7 коммитов в диапазоне) |

`node scripts/check-docs.mjs --external` не обязателен в этом раунде — дельта `f18b5b4..HEAD` не трогает `src/**` — но прогнан для очистки контекста: `Documentation checks passed (7 files, 10 external links)`.

По необходимости, определяемой дельтой:

| Гейт | Результат |
|---|---|
| `node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-light` | `passed` — H1 закрыт |
| `node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-dark` | `passed` — H1 закрыт |
| `node demo/smoke_cover_plate_precedence.mjs` | `OK`, все проверки true, включая `remoteMirrorsItsControls`/`remoteOffIsNeutral` |
| `node scripts/smoke-select.mjs --base f18b5b4 --head HEAD` | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)» — браузерные смоки этой дельтой не выбираются, выбирать нечего |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` (сверка с r1) | тот же список из 4 прямых совпадений, что и в r1 — src-диапазон с r1 не менялся |

**Дисциплина «тест умеет падать» — проверена экспериментом, не заявлением.** Извлёк версию `smoke_cover_plate_precedence.mjs` с SHA `f18b5b4` (до фикса) во временный файл и прогнал его против текущего (исправленного) бандла:

```
$ git show f18b5b4:demo/smoke_cover_plate_precedence.mjs > demo/smoke_cover_plate_precedence.OLD.mjs
$ node demo/smoke_cover_plate_precedence.OLD.mjs
...
FAILED (2):
  - remoteMirrorsItsControls: expected true, got false
  - remoteOffIsNeutral: expected true, got false
```
(временный файл удалён сразу после прогона, `git status --short` — чисто). Подтверждает: старая фикстура ломалась ровно по причине, названной автором (own-availability теперь требует живой собственной сущности), правка — не сокрытие регрессии, а необходимая адаптация фикстуры под новый, уже принятый в ТЗ контракт (аналогия с фикстурой #89, разрешённая PROCESS.md §11.4 по духу, хотя формально это не тот этап).

Не гонял: полный `npm run golden:verify` (~40 сценариев) и `python -m pytest tests_backend` — дельта не трогает ни остальные golden-сценарии, ни `custom_components/**/*.py`; unittest backend вне скоупа дельты. Оба уже были вне скоупа и в r1. Performance-профили не названы в AC и не затронуты дельтой.

## Находки

Нет находок High или Medium в этом раунде. Low не заводился и не снимался — в дельте нечего оспаривать: golden принят по правилам (§3.13, `--reviewed` на полном Linux-артефакте), фикстура актуализирована с воспроизведённым доказательством.

## Что проверено и корректно

- H1 закрыт доказательно: оба golden-сценария из находки перепройдены заново и дают `passed` на текущем дереве, `sourceFingerprint` в принятом baseline соответствует текущему исходнику.
- Приёмка golden прошла по правилам процесса: `Release:`/`Baseline-Reviewed:` трейлеры на коммите класса D, ссылка на реальный прогон CI (`32617372743`), не локальная перезапись.
- Смок-фикстура `smoke_cover_plate_precedence.mjs` не потеряла способность падать — проверено прогоном старой версии на новом коде, а не заявлением автора.
- Оба новых коммита несут `Issue: #251` и `User-Visible: no` — корректно, поведение не меняется, только тестовая инфраструктура и эталоны.
- Всё, унаследованное из r1 (см. таблицу выше), не тронуто дельтой и не требует повторной проверки.

## Чего не проверял

- Полный `npm run golden:verify` по всем ~40 сценариям — не задет дельтой; предрелизная обязанность (§8), не гейт ревью. Автор уже подтвердил 95/95 на exact-HEAD прогоне CI (`32618851703`).
- `python -m pytest tests_backend` — дельта не трогает Python.
- Реальную HA-инсталляцию/ручной клик — фазы ручного тестирования в цикле нет; вопрос «работает ли» для продуктовой логики закрыт в r1 (юнит-матрица, мутанты, production-bundle smoke), а в r2 предметом были только тестовые артефакты, а не продуктовый код.
- Провенанс самих CI-прогонов (`32617372743`, `32618422055`, `32618851703`) как содержимого GitHub Actions — не открывал вложения раннов, доверился структуре трейлеров и совпадению фингерпринта/хэшей на локальном воспроизведении.

## Вердикт

Зелёный. H1 закрыт с воспроизведённым доказательством, новая сопутствующая правка фикстуры проверена на способность падать, дешёвые гейты и предметные (golden-сценарии из находки, задетый смок) зелёные на текущем HEAD. Готово к слиянию.
