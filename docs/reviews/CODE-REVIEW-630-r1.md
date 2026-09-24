# CODE-REVIEW-630-r1

**Issue:** #630 — `tests_backend/conftest.py`: без HA 277 (сейчас 292) тестов `test_ha_*.py`
не собираются молча (`collect_ignore_glob`) — печатать явное предупреждение.
**Материал:** `origin/dev...HEAD`, вершина `51e1643762917f362fba14ffc3559766f173a484`,
один коммит. Трек `trivial` (S2 → S5, минуя ТЗ), лимит циклов код-ревью — 2 (§5.1).
**Заход:** r1 · блокирующих циклов израсходовано 0 из 2.

## Скоуп диффа

```
AGENTS.md
docs/TESTING.md
scripts/mutation-registry.mjs
tests_backend/conftest.py
tests_backend/test_conftest_harness_notice.py (новый)
```

Инфраструктура тестов, `custom_components/**` и `src/**` не тронуты. Это не
продуктовая фича и не обязано закрывать строку Core user jobs (docs/SCOPE.md) —
это гейт качества самого процесса разработки (класс, аналогичный записям
"Backend quality gates" в docs/ARCHITECTURE.md §"#42"). `User-Visible: no`
в трейлере коммита соответствует действительности — правки в
`docs/changelog/`не требуются и не сделаны, это корректно.

## Что сделано (по коммиту `51e16437`)

- `tests_backend/conftest.py`: без HA, при импорте модуля, `ha_harness_inventory()`
  однократно считает файлы `test_ha_*.py` тем же glob, что и
  `collect_ignore_glob`, и объявления `def test_*`/`async def test_*` (включая
  методы классов) регулярным выражением. Результат печатается дважды —
  `pytest_report_header` (полный прогон) и `pytest_terminal_summary` (не
  зависит от `-q`, печатается всегда).
- `tests_backend/test_conftest_harness_notice.py` — новый чистый тест: обе ветки
  conftest (HA есть / нет) проверяются сборкой временного мини-проекта во
  вложенном процессе pytest, `homeassistant` подменён заглушкой на `PYTHONPATH`.
- `docs/TESTING.md`, `AGENTS.md` — формулировка «silently skips» заменена точной
  («does not collect» / «не собирается вовсе»), с указанием механизма
  (`collect_ignore_glob`) и ссылкой на #630.
- `scripts/mutation-registry.mjs` — два новых мутанта:
  `ha-harness-notice-silent` (гасит `terminal_summary`),
  `ha-harness-notice-count-frozen` (замораживает число тестов на 292).

## Как проверялось (исполнением, не только чтением)

Зелёный Validate на `51e16437` (https://github.com/Matysh/houseplan-card/actions/runs/35942627518)
покрывает frontend (`tsc`, `npm test`, `npm run build`) и backend-job CI **с
установленным HA** — это НЕ тот путь, который меняет диф (AC1 — про среду
БЕЗ HA). Поэтому именно этот путь прогнан здесь заново, вручную, а не принят
на слово:

1. `pip3 install --user pytest voluptuous` — в песочнице ревью изначально не
   было ни pytest, ни voluptuous ни для одного бэкенд-теста; это окружение
   ближе к «Windows/песочница» из тела issue, чем CI.
2. `python3 -m pytest tests_backend -q -p no:cacheprovider` (без HA, реальный
   харнесс, не временный) →
   `485 passed, 4 skipped, 1 warning`, и в конце секция:
   `HA harness not collected` / `HA harness NOT collected: 13 test_ha_*.py files
   (292 tests) were ignored…`. Число совпало с независимым пересчётом тем же
   регэкспом вручную (`13 файлов, 292 теста`) — **AC1 подтверждён живым
   прогоном**, включая формулировку в `-q`.
3. `python3 -m pytest tests_backend/test_conftest_harness_notice.py -q
   -p no:cacheprovider` → `5 passed`. Новый тест реально существует и реально
   зелёный, не только назван в отчёте автора.
4. `node scripts/mutation-gate.mjs --id=ha-harness-notice-silent` →
   `поймано 1 из 1`. `node scripts/mutation-gate.mjs --id=ha-harness-notice-count-frozen`
   → `поймано 1 из 1`. Проверена дисциплина «тест умеет падать»: без этих
   двух правок в `conftest.py` тест из п.3 действительно краснеет (мутация
   применяется, гоняется, откатывается — `git status` после чист).
5. `node scripts/mutation-gate.mjs --check` — все якоря реестра, включая два
   новых, находятся (`ok ha-harness-notice-silent`, `ok
   ha-harness-notice-count-frozen`), полный реестр не сломан.
6. Проверено отдельно (не входит в отчёт автора, но релевантно диффу): CI-шаг
   «HA-harness присутствует» (`validate.yml:1185-1190`) считает
   `grep -c "test_ha_"` по выводу `--collect-only` и требует `≥50`. Новый
   `pytest_report_header`/`terminal_summary` печатает строку, содержащую
   `test_ha_*.py`, **только когда `HAS_HA` ложно** — в CI `HAS_HA` истинно
   (шаг до этого явно делает `python -c "import homeassistant"`), значит
   `HA_HARNESS_IGNORED is None` и хуки возвращают `None`/no-op. Порог `≥50`
   не задет. Регрессии в существующем CI-гейте нет.
7. Проверено чтением, не исполнением: реального HA-харнесса под Linux CI/WSL
   здесь нет (как и у автора) — ветка `HAS_HA` в диффе не меняется, только
   вынесен общий `from pathlib import Path` наверх файла (было продублировано
   в обеих ветках `if not HAS_HA` / `if HAS_HA`); синтаксической ошибки в этом
   рефакторинге нет — файл успешно импортируется и исполняется в п.2 и п.3.
8. Прочитан diff `docs/TESTING.md`/`AGENTS.md`: формулировка исправлена на
   точную во всех местах, которые называет AC2. `CLAUDE.md` рабочей папки вне
   репозитория и вне материала ревью — принимается на слово автора, как и
   заявлено самим автором в разделе «Чего не проверял».

## Чего не проверял (осознанно, гейт не по размеру задачи)

- `npx tsc --noEmit`, полный `npm test`, `npm run build` — diff не трогает
  `src/**` ни один файл; Validate на этом SHA уже зелёный и покрывает их.
- `node scripts/check-docs.mjs` — не запускался: скрипт применим при правках
  `src/**`, диф их не трогает.
- Инварианты модели (`npm run invariants`) — diff не трогает геометрию, рёбра
  комнат, `layout`, `marker.space`, `open_spans`.
- Браузерные `demo/smoke_*.mjs` и `npm run golden:verify` — диф не меняет ни
  один рендер-путь; `scripts/smoke-select.mjs` не запускался осознанно, так
  как изменения не в JS/TS рантайме карточки, а в Python-тест-харнессе и
  markdown; смоки физически не видят `tests_backend/`.
- Настоящий HA-харнесс на Linux CI/WSL — здесь нет HA (как и у автора); ветка
  `HAS_HA` не менялась, поэтому риск сочтён низким и не гейтится вручную —
  сама CI job "Бэкенд: pytest в Home Assistant" прогонит это на слиянии.
- ruff/mypy по `custom_components/houseplan/**` — диф их не касается.
- Windows-прогон — недоступен в песочнице; код использует только `pathlib`,
  `sys.executable`, декодирование с `errors="replace"", риск сочтён низким.

## Находки

Нет находок уровня High или Medium в скоупе. Одно наблюдение, не требующее
действия (Low, не в скоупе AC2):

- `docs/ARCHITECTURE.md:2124` всё ещё говорит «refuses to run when the HA
  harness would **silently skip**» — та же неточная формулировка про этот же
  механизм (`collect_ignore_glob`), но AC2 issue #630 явно ограничивает объём
  правки `docs/TESTING.md` и локальным `CLAUDE.md`; `ARCHITECTURE.md` в тексте
  issue не назван. Не блокирует: формулировка описывает *CI-гейт* (порог
  `≥50`), а не поведение локального pytest, которое и было предметом задачи;
  контекст не вводит читателя в заблуждение так же остро, как исправленные
  места. Снимается без действия — правка по желанию в отдельной задаче, не
  заводится отдельным issue (Low, §12 — либо правится в скоупе, либо снимается
  с записью; здесь скоуп задачи её не включает).

## Итог по AC

| AC | Статус | Доказательство |
|---|---|---|
| AC1: вывод pytest без HA явно называет число несобранных HA-файлов/тестов | Выполнено | Живой прогон `pytest tests_backend -q` в песочнице ревью (не только отчёт автора): секция `HA harness not collected` с `13 files (292 tests)`, само число сошлось с независимым пересчётом |
| AC1: число не зашито, следует за харнессом | Выполнено | `test_inventory_of_the_real_harness_matches_an_independent_count` (AST) зелёный; мутант `ha-harness-notice-count-frozen` пойман 1/1 |
| AC2: формулировка «скипает» исправлена в `docs/TESTING.md`/`AGENTS.md` | Выполнено | Дифф прочитан, старая формулировка не встречается в этих файлах |
| AC2: `CLAUDE.md` рабочей папки | Не в материале ревью (вне репозитория) | Принято на слово автора, как заявлено самим автором |

## Вердикт

Зелёный. AC доказаны исполнением, не только заявлением автора; мутанты
проверены на способность падать; регрессии в существующем CI-пороге `≥50`
не обнаружено. Единственное наблюдение — Low, вне скоупа AC2, снимается без
действия.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/630-ha-harness-warning`, коммит `51e164376291` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3b1a904c469fc9c81d14f6e35d0f80c74af7abdb`
  ```
  git log --all --format='%H %T' | grep 3b1a904c469f
  ```
- Тело issue: `f68ed5ca3ddef44a1f638bcb046751e5e3b0f92df99ef272ade03444ccd2cb63`
- Вердикт конвейера: `green` · High 0
