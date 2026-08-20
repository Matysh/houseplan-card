# Code review #225 — r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/225
- **Spec:** тело issue (лёгкий трек `small`), зелёное `SPEC-REVIEW-225-r2.md`
- **Reviewed branch:** `issue/225-import-attachment-url-query`
- **r1 code review:** жёлтый · SHA `e59962f` · документ `docs/reviews/CODE-REVIEW-225-r1.md`
- **Дельта этого раунда:** `git diff e59962f..HEAD` = коммит `04945e1`
  («fix: reject absolute urls in the content resolver, register the mutants»)
- **Base:** `origin/dev` at `5f000cb` (ветка — линейное продолжение `5f000cb`,
  не ребейз: `git merge-base HEAD origin/dev` = `5f000cb`, `origin/dev` ушёл
  вперёд по несвязанному issue #226 своей веткой)
- **Reviewer:** Claude, независимая сессия без контекста реализации

## Вердикт

**Зелёный · цикл r2/2 · High: 0 · Medium: 0.**

Разбор — по дельте (§2.10 PROCESS.md, issue #214): r1 закончился жёлтым с
двумя находками в скоупе (M1 — резолвер доверял `path` даже при `scheme`/
`netloc`; M2 — заявленные мутанты не осели в реестре). Дельта `e59962f..HEAD`
— один коммит, касающийся только того же файла/теста/гейта, которые уже были
в скоупе задачи; не ребейз, контракт поведения не менялся, новая подсистема не
затронута — сокращённый разбор оправдан.

Обе находки закрыты правильно и это подтверждено не заявлением автора, а
независимой проверкой: извлёк литеральную логику `_internal_path` (плюс
`sanitize_marker_id`/`sanitize_filename`, `_looks_internal`) вне HA-харнеса и
прогнал её на всех AC-кейсах и на всех трёх мутантах из реестра — старая
(до фикса) версия резолвит `https://evil.example/houseplan_files/files/m1/doc.pdf`
как внутренний файл, новая — корректно возвращает `None`; каждый из трёх
зарегистрированных мутантов при применении к текущему коду переворачивает
хотя бы один из своих AC-кейсов (детали — «Закрытие раунда r1» ниже). CI
`Validate` зелёный на точном SHA `04945e1`, job `backend` — 339 passed (было
335 на `e59962f`, +4 — ровно новый параметризованный тест на 4 варианта
абсолютного/protocol-relative URL). Дешёвые гейты (`tsc`, `npm test`
962/962, `build` + сверка трёх копий бандла, `mutation-gate --check` по
всему реестру, включая три новых id) прогнаны локально и зелёные.

Новых находок в этом раунде нет.

## Скоуп дельты

Один продуктовый коммит `04945e1` (`Issue: #225`, `User-Visible: no` —
верно: это закрытие M1/M2, а не пользовательское поведение; пользовательский
эффект уже описан в changelog коммитом `e59962f`, changelog в `04945e1` не
трогается и не должен был):

- `custom_components/houseplan/import_export.py` (+10/−1) — в `_internal_path`
  перед тем как доверять `parsed.path`, добавлена проверка
  `if parsed.scheme or parsed.netloc: return None`; комментарий указывает на
  ревью r1/M1. Остальная функция (префиксы, `sanitize_marker_id`/
  `sanitize_filename`, посегментное сравнение) не тронута — совпадает с
  диффом `e59962f..HEAD` построчно;
- `tests_backend/test_ha_import_export.py` (+20, 1 тест, 4 кейса) —
  `test_issue_225_absolute_url_never_resolves_onto_a_local_file`: https+FILES_URL,
  https+CONTENT_URL с query, protocol-relative `//`, https+PLANS_URL;
- `scripts/mutation-gate.mjs` (+41, 3 записи) — `internal-path-ignores-query`,
  `internal-path-trusts-foreign-host`, `internal-path-allows-traversal`, все
  с `guard: node scripts/backend-test-guard.mjs issue_225`;
- никаких изменений в `docs/CHANGELOG*`, `src/**`, i18n, конфиге
  совместимости — соответствует `User-Visible: no` и тому, что коммит чинит
  находки код-ревью, а не меняет заявленное поведение.

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm test` | **962/962 pass** (включает дешёвую половину мутационного гейта — `test/mutation-gate.test.mjs`: уникальность якорей и существование guard-файлов для всех мутантов, включая три новых) |
| `npm run build` + сверка трёх копий бандла | pass, `dist`/`custom_components/houseplan/frontend`/`demo/srv/assets` побайтово совпадают, `git status` после сборки чист |
| `node scripts/mutation-gate.mjs --check` (весь реестр, не только новые id) | **ok** на всех записях — новые три не столкнулись якорями со старыми 20+ |
| CI `Validate` на точном SHA `04945e1` (`gh api .../commits/04945e1/check-runs`, job `backend` id `96542792712`) | `completed success`; лог: «Backend unit tests (pure + HA harness) — **339 passed** in 5.26s» (было 335 на `e59962f`, делта +4 совпадает с числом новых параметризованных кейсов) |
| Независимая проверка «мутант умеет ловиться» — вынес `_internal_path`/`_looks_internal`/`sanitize_marker_id`/`sanitize_filename` в автономный скрипт (без HA) и прогнал: (а) новую версию на AC1/AC1-plan/AC4/AC4a/AC5-M1; (б) буквальные патчи всех трёх мутантов реестра против неё | новая версия проходит все кейсы; **все три мутанта переворачивают** результат хотя бы одного своего AC-кейса — не эквивалентные патчи, не «зелёный тест ничего не проверяет» (детали ниже) |
| `python -m pytest tests_backend -q` локально | не прогонял — окружение ревью на py3.12 без `homeassistant`; `test_ha_*.py` тем же механизмом молча пропускается, что и у автора и у меня же в r1 (см. `AGENTS.md`, «Backend»). Заменено CI-прогоном на точном SHA плюс независимым исполнением чистой логики вне HA — то же покрытие, что использовалось в r1 |
| browser `demo/smoke_*.mjs` (127 шт.), `npm run golden:verify`, performance-профили | не прогонял — дельта не касается `src/**`/визуала/производительности, ни один AC их не называет; то же основание, что в r1 |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — `urlsplit(url).path` доверяет пути даже при `scheme`/`netloc`; `https://evil.example/houseplan_files/files/m1/doc.pdf` резолвится как локальный файл, хотя `_looks_internal` говорит «внешний» | Добавлена проверка `if parsed.scheme or parsed.netloc: return None` перед использованием `parsed.path` | `custom_components/houseplan/import_export.py:364-366`; тест `test_issue_225_absolute_url_never_resolves_onto_a_local_file` (4 кейса: https+FILES_URL, https+CONTENT_URL+query, `//`+FILES_URL, https+PLANS_URL) — все требуют `_internal_path(...) is None` и `_looks_internal(...) is False`. Независимо прогнал ту же логику вне HA: без проверки все 4 URL резолвятся в валидный локальный путь, с проверкой — все 4 дают `None` |
| **M2** — три мутанта из ТЗ (`internal-path-ignores-query`, `internal-path-allows-traversal`, плюс подразумеваемый мутант на M1) не зарегистрированы в `scripts/mutation-gate.mjs`, разовый ручной прогон не оставляет постоянной защиты | Три записи добавлены в `MUTANTS` (`scripts/mutation-gate.mjs:676-716`): `internal-path-ignores-query`, `internal-path-trusts-foreign-host` (регрессия M1), `internal-path-allows-traversal`, все с `guard: node scripts/backend-test-guard.mjs issue_225` | `node scripts/mutation-gate.mjs --check` — все три анкера уникальны в текущем коде; `test/mutation-gate.test.mjs` (часть `npm test`, 962/962) проверяет то же плюс существование guard-файла. Прогнал патчи буквально: `internal-path-ignores-query` переворачивает 2/6 кейсов AC1 (варианты с `#fragment`) и оба кейса AC4a; `internal-path-trusts-foreign-host` переворачивает все 4 кейса нового теста M1; `internal-path-allows-traversal` переворачивает кейс `plans/_/../x.svg?v=1` из AC4 (для `files`-ветки этот же мутант оказывается эквивалентным — `sanitize_marker_id("..") == "misc"` ловит traversal независимо от структурной проверки, поэтому реестр справедливо не утверждает, что он ловит все AC4-кейсы, только тот один, который у файловой ветки не защищён вторым эшелоном) |

## Унаследовано из r1

Без повторной проверки в этом раунде — дельта их не касается — приняты выводы
из `docs/reviews/CODE-REVIEW-225-r1.md` (SHA `e59962f`):

- диагноз бага и контракт исправления (`urlsplit`, query/fragment вне
  определения файла) совпадают с кодом;
- данные пользователя не переписываются (`item["url"]` не трогается);
- `identity()` (`:1034-1039`) не включает `storage` в ключ сравнения —
  смена классификации `external → internal` для канонических cache-busted
  ссылок не ломает сопоставление manifest-строк (AC6);
- traversal-защита для случаев без `scheme`/`netloc` (три из четырёх кейсов
  AC4) не ослаблена дропом query — сегментные проверки работают над тем же
  материалом, что и раньше;
- AC6/AC7 (regression, plan-only idempotency) — diff `e59962f` только
  добавляет тесты в конец файла, plan-only диапазон (`:489-736`) вне диффа;
- trailers, ветка, оба changelog в коммите `e59962f` — по правилам.

Дельта r1→r2 не касается этих участков кода (только резолвер и мутационный
реестр), поэтому пересчёт не требовался — см. «Скоуп дельты» выше, где
подтверждено, что diff `e59962f..HEAD` ограничен ровно тем, что было
находками r1.

## Что проверено и корректно (в этом раунде)

- M1-фикс не задевает уже покрытые ветки: прогнал старую/новую версию
  резолвера на AC1 (5+3 кейса), AC4 (4 кейса), AC4a (2 кейса) — результат
  идентичен до и после добавления проверки `scheme`/`netloc`, потому что ни
  один из этих URL её не содержит.
- `_looks_internal` не менялась (проверено `git diff` — файл затронут только
  в `_internal_path`), поэтому согласованность двух функций, из-за
  расхождения которых родился исходный баг #225, теперь восстановлена в обе
  стороны: внутренний путь ⇒ обе функции согласны; внешний хост ⇒ обе
  согласны «внешний».
- Мутант `internal-path-allows-traversal` умышленно снимает два патча сразу;
  комментарий `because` в реестре объясняет, что снятие одного из них
  (`len(tail) != 2`) для файловой ветки было бы эквивалентным мутантом —
  проверил это утверждение напрямую (см. таблицу выше), оно верно.
- Trailers коммита `04945e1` (`Issue: #225`, `User-Visible: no`) корректны:
  фикс не меняет наблюдаемое пользователем поведение (только закрывает
  внутреннюю рассогласованность двух приватных функций), поэтому отсутствие
  правки changelog — не пропуск.
- `process-gate`/pre-push пройден (CI job `process-gate`: success на
  `04945e1`).

## Чего не проверял

- `python -m pytest tests_backend -q` в собственном окружении — та же
  причина, что в r1 (py3.12, без `homeassistant`, `test_ha_*.py` молча
  пропускается `conftest.py`). Компенсировано CI-прогоном на точном SHA
  (339 passed) и независимым исполнением чистой логики резолвера вне HA.
- Полный (дорогой) прогон `node scripts/mutation-gate.mjs` с пересборкой
  бандла в worktree для каждого из 20+ мутантов реестра — не требовался:
  задача не трогает остальные мутанты, а три новых проверены анкерным
  `--check` и независимым буквальным прогоном патчей против чистой логики
  (эквивалент того, что делает дорогой прогон, без пересборки бандла на
  каждый). Дорогой прогон — предрелизный гейт (`.github/workflows/
  mutation-gate.yml`), не гейт ревью (PROCESS.md §8 vs §2.7).
- Browser-смоки (127 шт.), `npm run golden:verify`, performance-профили —
  дельта не касается `src/**`, визуала или производительности; то же
  основание, что в r1.

## Лимит циклов

Код-ревью лёгкого трека — 2 цикла (§4). Это второй и последний цикл; вердикт
зелёный, лимит не понадобился.
