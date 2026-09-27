# CODE-REVIEW-42-r2

- Issue: https://github.com/Matysh/houseplan-card/issues/42
- Ветка: `issue/42-backend-quality`, HEAD на момент вердикта: `7e5a19376d921ba0faf9929ff040e467d0e8c0d0`
- Заход: r2 (второй фактический прогон ревью кода; счётчик циклов §4 = 1/4,
  зелёного цикла не образуется, а два комментария «ревью не запускалось» из-за
  конфликта ребейза — это остановка конвейера ДО ревью, не цикл)
- Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
  (53 файла, 926+/321-)

## Почему разбор полный, а не по дельте (§2.10)

Между r1 (SHA `ab337193`) и этим заходом ветка **дважды ребейзилась** на ушедший
вперёд `dev` (конфликты в собранных бандлах, зафиксированы в issue дважды —
прогоны 33318210024 и 33318796499). §7.2/§2.10 прямо называют этот случай
границей: «после ребейза это другой код». Поэтому ниже — полный разбор всех
пяти блоков ТЗ (ревизия 6), а не только диффа поверх r1.

## Закрытие раунда r1

r1 (SHA `ab337193abb8c629322313a0bf2d747105942db4`) был красным: High: 2.

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — новый `any` в `src/houseplan-card.ts:9743` (`(item: any)`) | Заменено на `(item: { id?: unknown })` | `src/houseplan-card.ts:9757` (текущий HEAD); `node scripts/no-new-any.mjs --base origin/dev --head HEAD` → «Новых any нет» — перепроверено мной командой сейчас |
| **H2** — `requirements_test.txt` не разрешим (`pytest==9.1.1`/`pytest-cov==7.1.0` конфликтуют с транзитивными пинами `pytest-homeassistant-custom-component`) | Пины сняты, затем `pytest-homeassistant-custom-component` закреплён на `0.13.316` (последний релиз с `Requires-Python <3.14`) в коммитах `9a62182f`→`3b1ccb85`→`5b102471` | Backend CI job HEAD `7e5a19376d92...` (job 99276949757): `pip install -r requirements_test.txt` завершается `Successfully installed ... pytest-homeassistant-custom-component-0.13.316 ... homeassistant-2026.2.3` — проверено чтением лога прогона, не со слов автора |

Оба High закрыты по существу, независимо перепроверено исполнением/логом CI, а
не по формулировке автора.

## Унаследовано из r1

Ничего не наследуется без повторной проверки в этом раунде — ребейз на ушедший
вперёд `dev` обязывает к полному разбору (см. выше), поэтому все AC ниже
перепроверены заново на текущем HEAD, а не приняты по r1. Единственное, что
буквально не пересчитывалось заново, а взято как решённое владельцем и не
подлежащее пересмотру ревьюером кода: сам текст ТЗ ревизии 6 (арбитраж
владельца от 30.08, бюджет ревью ТЗ исчерпан 4/4) — согласно роли (§6),
код-ревью не ревьюит спецификацию повторно, только реализацию.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы (frontend) | `npx tsc --noEmit` | чисто |
| Юниты (frontend) | `npm test` | 1636 pass / 0 fail / 1 skipped (совпадает с хендоффом) |
| Сборка + сверка 3 копий бандла | `npm run bundle:sync` | без diff после сборки — dist/custom_components/demo идентичны |
| Бюджет бандла | `npm run bundle:budget` | initial View 282745 B gzip / 300000 (запас 17255 B; авторские 282738 — расхождение в 7 байт, не критично) |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет (H1 подтверждён закрытым) |
| **Доки (`docs`, реальный блокер по AGENTS.md)** | `node scripts/check-docs.mjs --external` | **КРАСНО** — 10 несовпадений хэшей скриншотов (см. High-1) |
| ruff (CI-скоуп: только `custom_components/houseplan`) | `python -m ruff check custom_components/houseplan` | чисто |
| ruff (полный `include` из pyproject: + `scripts`, `tests_backend`) | `python -m ruff check custom_components/houseplan scripts tests_backend` | 53 находки — но CI это никогда не проверяет (см. Low-3) |
| mypy strict (6 модулей allowlist) | `python -m mypy --config-file pyproject.toml -p ...` (все 6 модулей) | `Success: no issues found in 6 source files` |
| Контракт-тесты (pure pytest) | `python -m pytest tests_backend/test_backend_quality.py -q` | 3 passed; мутант «убрать `invalid_passage_fields` из ERROR_CODES» — воспроизведён вручную, тест падает (AssertionError), файл восстановлен |
| Фронт-юниты error-текста (AC6) | `node --test test/open-passage-contract.test.mjs` | 8/8, включая тест `_errText` JSON-first/code-first fallback |
| mutation-gate self-test | `node --test test/mutation-gate.test.mjs` | 10/10 |
| i18n-паритет `backup.error.*` | `git diff origin/dev...HEAD -- src/i18n/*.json` + подсчёт | ровно 22 новых ключа в каждом из 4 словарей |
| CI на точном SHA `7e5a1937` | `gh run view` / job logs | **красный**: `backend` (86 failed, унаследовано с `dev` — см. ниже), `Предполётные проверки` (провален `check-docs`, см. High-1); фронтенд/HACS/hassfest — зелёные |
| `smoke-select.mjs` | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «НЕОПРЕДЕЛЁННОСТЬ» — 1 изменённая строка `src/**`, символ `_serverCfg` слишком широкий, доказанной связи нет |
| Геометрия (`wall_segment_model.py`, B023-фиксы) | чтение диффа + backend CI job (строка покрытия `wall_segment_model.py … 87%`, модуль не в списке 86 упавших) | closures (`covered_by`/`eligible`/`materialize`/`pick`) вызываются в той же итерации, где определены — биндинг по умолчанию не меняет поведение; независимо подтверждено прогоном CI (не только чтением) |
| `junction_limits.py` | чтение диффа | только type hints + перестановка импортов, поведение не менялось (подтверждает вывод r1) |

## Находки

### High-1 — `docs`-гейт красный: манифест скриншотов не совпадает ни с одним закоммиченным файлом

Скоуп: в задаче (файл `docs/images/screenshots.json` — часть коммитов этой
ветки).

**Воспроизведение:**

```
node scripts/check-docs.mjs --external
```
даёт 10 ошибок вида `ERROR screenshot <id>: image hash does not match manifest`
для `view-desktop`, `view-touch`, `space-create`, `room-contour-close`,
`plan-context-tray`, `device-editor`, `device-display-preview`,
`background-editor`, `room-card`, `device-info`.

Причина: коммиты `3b1ccb85` («refresh the doc capture») и `7e5a1937` («the
doc capture is retaken on the rebased HEAD») переписали
`docs/images/screenshots.json` — обновили `sourceFingerprint`, `oxipng`
(`"oxipng 10.2.0"` → `null`) и `imageSha256` всех 10 сценариев на новые
значения — но **ни разу не тронули ни один PNG-файл в `docs/images/`**:

```
git diff origin/dev...HEAD --stat -- docs/images/
 docs/images/screenshots.json | 44 ++++++++++++++++++++++----------------------
 1 file changed, 22 insertions(+), 22 deletions(-)
```

Проверено вручную (sha256 каждого файла `docs/images/*.png` против записи в
манифесте): фактический хэш каждого из 10 файлов совпадает со **старым**
(dev-овым) значением, а не с тем, что теперь в манифесте — то есть `capture.mjs`
действительно перерендерил кадры (иначе `sourceFingerprint` не совпал бы с
текущим `src/**`, а он совпадает — стейл-фингерпринт не выдаётся), но
получившиеся PNG никогда не были закоммичены (`git add` пропущен). Это ровно
тот класс дефекта, о котором предупреждает AGENTS.md («докс — реальный
блокер») и о котором явно сказано в брифе ревью (пропуск этого шага уже дважды
стоил `dev` красного job `docs`, #230/#234) — здесь это тот же паттерн, только
внутри одной задачи.

Независимо подтверждено логом CI на HEAD (job `Предполётные проверки`, прогон
33319669425): тот же список из 10 `ERROR screenshot … image hash does not
match manifest`, `##[error]Process completed with exit code 1`.

Чинится в скоупе: перезапустить `npm run build && node demo/docs/capture.mjs`
на актуальном HEAD и на этот раз закоммитить и манифест, и все 10
регенерированных PNG (`git add docs/images/*.png docs/images/screenshots.json`),
затем `node scripts/check-docs.mjs --external` — обязательное условие зелёного
раунда.

### Low (снято с записью) — AC1 (coverage-baseline) недоказан прогоном ветки, но блокер внешний и уже заведён

`scripts/backend-coverage-baseline.txt` остаётся плейсхолдером `80.0` — тем же,
что автор дважды пометил как временный («после зелёного CI закоммичу точное
значение до вердикта»). Зелёного `backend`-job на этой ветке не было ни разу.

Причина — НЕ код этой задачи: `pytest` в CI job `backend` (HEAD, прогон
99276949757) валится 86 тестами с одинаковой ошибкой
`Setup failed for custom integration 'houseplan': No setup or config entry
setup function defined` — и **на самом `dev`** (прогон 33317335067, job
99273097390) те же 86 тестов падают с тем же сообщением, тем же числом. Уже
заведено отдельно: **issue #389** «Backend-тесты HA-харнесса красные на dev с
30.08». Это не регрессия #42, а внешняя блокировка.

Важная деталь для следующего раунда: pytest всё равно ДОХОДИТ до конца и пишет
coverage-отчёт несмотря на 86 упавших тестов — я вижу в логе job'а `TOTAL …
68%` — но шаг «Порог покрытия не ниже baseline» после него **не запускается**,
потому что предыдущий шаг (`pytest`) вернул ненулевой код и GitHub Actions
пропускает последующие шаги без `if: always()`. Число 68% — не «настоящий»
бейзлайн: интеграция не поднимается в 86 тестах, огромные куски кода вообще не
исполняются, так что цифра занижена тем же #389 и использовать её как реальный
бейзлайн нельзя.

Не блокирую этим раундом: причина полностью внешняя и уже отслеживается в
#389, а плейсхолдер не ухудшает состояние `dev` (там `backend`-job и так
красный по той же причине). Но снимаю не молча: как только #389 закроется и
`backend`-job этой ветки дойдёт до сравнения с baseline, число должно быть
снято заново и закоммичено настоящим — заглушка не должна доехать до бета-гейта.

### Low (снято с записью) — ruff-долг `scripts/`+`tests_backend/` шире объявленного `include`, но вне CI-скоупа

`pyproject.toml` объявляет `include` на `custom_components/houseplan/**/*.py`,
`scripts/*.py` и `tests_backend/**/*.py`, но CI (`validate.yml:782`) реально
линтит только `custom_components/houseplan`. При прогоне по полному `include`
(`python -m ruff check custom_components/houseplan scripts tests_backend`) —
53 находки; на самом `dev` таких же находок 52 (проверено на чистом чекауте
`dev`), то есть эта ветка добавила ровно одну новую — `I001` (порядок
импортов) в новом файле `tests_backend/test_backend_quality.py:5`. ТЗ явно
сузило блок 2 до `custom_components/houseplan` (щадящий трек, «без массового
rewrite»), так что это не нарушение AC. Не блокирую, но `include` в
`pyproject.toml` шире, чем то, что реально проверяется — вводит в заблуждение
при чтении конфига; можно поправить `include` или добавить одну сортировку
импорта в новом файле при следующей правке.

### Low (снято с записью) — golden-расхождений на самом деле 8, не 4, но все вне скоупа #42

Автор в первом фикс-комментарии назвал 4 расходящиеся golden-сцены
(`device-dialog-mobile-ru`, `device-dialog-desktop-de`,
`toggle-entity-dialog-mobile-ru`, `device-ripple-color-popover-mobile-ru`).
Лог job `Golden-кадры` на прогоне того же периода (33318774716) показывает
**8**: те же четыре плюс `device-inbox-desktop-en-light`,
`device-inbox-desktop-ru-dark`, `device-inbox-narrow-ru-dark`,
`tray-medium-group-en`. Диф #42 не касается ни иконок устройств, ни inbox/tray
— все 8 объясняются тем же посторонним коммитом `2e30daa3` (#74, иконки
`mdi:motion-play-outline`/`mdi:repeat`/`mdi:stop-circle-outline`), только
затрагивает больше сцен, чем автор перечислил. Не в скоупе этой задачи (golden
— зона #74/пре-релизный гейт), фиксирую как неточность подсчёта, не как
находку против #42.

## Что проверено и корректно

- **H1/H2 из r1** — закрыты по существу (см. таблицу закрытия раунда выше).
- **AC3 (ruff, CI-скоуп)** — чисто.
- **AC4 (mypy strict, 6 модулей)** — зелёный, воспроизведено `--config-file
  pyproject.toml` (strict действительно применяется, не default-профиль).
- **AC5 (сканер ERROR_CODES/ERROR_CODE_FAMILIES, оба пути эмиссии)** — тест
  проходит; мутант «убрать флагманский код из ERROR_CODES» воспроизведён
  вручную и красный, как и требуется методологией ревью («тест умеет
  падать»). i18n-паритет 22/22/22/22.
- **AC6 (фронт: JSON-details + legacy regex fallback + code-first)** —
  `test/open-passage-contract.test.mjs` содержит прямой тест на `_errText`,
  зелёный; диф `houseplan-card.ts` читаемо реализует именно это поведение
  (JSON.parse → legacy regex → console.warn для сырого message → `err.code`
  fallback).
- **B023-рефакторинг в `wall_segment_model.py`/`junction_limits.py`** —
  прочитан построчно: замыкания вызываются исключительно внутри той же
  итерации цикла, где определены, поведенческой разницы биндинг по умолчанию
  не создаёт; подтверждено прогоном backend CI (строка покрытия модуля, тесты
  этого файла не в списке 86 упавших).
- **Трейлеры и changelog** — `feat`-коммит `cec11a95` несёт `User-Visible: yes`
  и правки обоих `docs/CHANGELOG*.md` в этом же коммите; формулировки совпадают
  с фактическим изменением поведения.
- **quality_scale.yaml** — `docs-troubleshooting`/`docs-examples` → `done`
  корректно (USER-GUIDE.ru §22 «Диагностика» действительно существует, что я
  проверил grep'ом, а не поверил инвентаризации автора).
- Импорт `CONF_ADMIN_ONLY`, убранный из `websocket_api.py` при isort-правке —
  проверено: нигде в файле не используется (используется только в `auth.py`,
  где импорт остался) — не регрессия.

## Чего не проверял

- **Полный `pytest tests_backend/` с реальным HA-harness** — недоступен в
  песочнице ревьюера (`ModuleNotFoundError: No module named 'homeassistant'`,
  как и предупреждает AGENTS.md); опирался на лог CI-прогона этой же ветки на
  точном HEAD, полученный и прочитанный независимо (не только со слов автора).
- **`npm run invariants`** — не гонял отдельно: диф не меняет геометрию
  фронтенда (`src/**` геометрический код не тронут), а Python-геометрия
  (`wall_segment_model.py`) — только рефакторинг замыканий без изменения
  формул; `npm test` уже прогнал JS model-invariants на всех моделях проекта
  и прошёл.
- **Браузерные смоки `demo/smoke_*.mjs`** — не гонял. `smoke-select.mjs` дал
  «НЕОПРЕДЕЛЁННОСТЬ» на единственной изменённой строке `src/**`
  (`_serverCfg` — широкий символ), а сама строка — только форматирование
  текста ошибки, покрытое юнитом AC6; видимого рендер-пути диф не касается.
- **`golden:verify` вручную** — не гонял; диф не может изменить рендер (только
  backend + текст ошибок), расхождения в CI golden проверены по логу и
  атрибутированы постороннему коммиту #74 (см. Low выше), не пересчитывал
  дифф картинок сам.
- **`python -m pytest tests_backend -q` целиком с покрытием** — не запускал
  локально (нет HA); совпадение цифр (366 pass/86 fail, `TOTAL … 68%`) взято из
  лога CI, не пересчитано мной построчно за пределами точечных грепов.

## Вердикт

Красный: High-1 (сломанный `docs`-гейт, самопричинён этой веткой, в скоупе,
воспроизведён и локально, и по логу CI) блокирует. H1/H2 из r1 закрыты
корректно. AC1 (baseline) не в счёт вердикта — блокирован внешним, уже
заведённым #389, и не регрессия этой ветки, но остаётся открытым пунктом до
следующего раунда.
