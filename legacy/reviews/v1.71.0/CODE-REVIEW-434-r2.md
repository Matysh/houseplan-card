# CODE-REVIEW-434-r2

- Issue: #434 — «Полиш аудита v1.71.0-beta.1»
- Этап: код-ревью (PROCESS.md §2.7)
- Заход: r2 · блокирующих циклов израсходовано 0/4
- SHA материала: `c706f8a744a9406b0ce9a1bc49dfd65fd0b681a2` (сверено `git rev-parse HEAD`)
- Предыдущий вердикт: зелёный, r1, SHA `dbda64e89d6b76cabfe57c21f281cb6d5132c257`,
  документ `docs/reviews/CODE-REVIEW-434-r1.md`.
- Диапазон дельты: `git diff dbda64e8..c706f8a7`.

## Почему это r2, а не r1 заново

r1 прошёл зелёным на `dbda64e8` и был автоматически смёржен в `dev`. Догоняющий
Validate на смёрженном SHA (`bdba9f48`) упал на `ruff F401`: неиспользуемый
импорт `read_catalog` в `custom_components/houseplan/http_api.py`, оставшийся
после реализации #434. Автор вернул задачу в `S6-in-progress`, внёс
однострочное исправление (`c706f8a7`) и снова отправил на код-ревью — это и
есть материал r2.

## Дельта r1→r2

```
git diff dbda64e8..c706f8a7 --stat
 custom_components/houseplan/http_api.py           | 1 -
 docs/reviews/CODE-REVIEW-434-r1.md                | 315 +++++++++++++++++++
```

Продуктовый код: одна строка — удалена запись `read_catalog,` из блока
`from .decor_assets import (...)` в `http_api.py`. Второй файл —
артефакт публикации документа r1, не код, ревью не подлежит (он и есть
предыдущий вердикт).

Коммит `c706f8a7`: `fix: remove stale decor catalog import`, трейлеры
`Issue: #434`, `User-Visible: no`. Trailers корректны: удаление мёртвого
импорта не имеет наблюдаемого пользователем эффекта, changelog не требуется —
и он действительно не тронут в диффе, что согласовано с `User-Visible: no`.

Дельта локальна: один файл, одна строка, не геометрия, не контракт поведения,
не новая подсистема. Полный повторный разбор всех 12 AC из r1 не требуется —
ни один из них не описывает поведение `http_api.py`-импортов; сокращение
объёма разбора обосновано §2.9.

## Проверка правки по существу

`read_catalog` определена в `decor_assets.py:425`, используется в
`websocket_api.py:60,1124` (`ws_assets_list` читает каталог через
`hass.async_add_executor_job(read_catalog, root)`). В `http_api.py` (файл
загрузки/удаления blob) её реального использования нет — grep по всему
дереву не находит ни одного места, где `http_api.read_catalog` бы
реэкспортировался или вызывался (`grep -rn "from .http_api import\|from
custom_components.houseplan.http_api import"` — три хита, ни один не называет
`read_catalog`). Удаление корректно и безопасно: символ был мёртвым импортом
именно в этом файле, не переносом функциональности.

## Гейты, прогнанные лично на SHA `c706f8a7`

Диапазон не трогает `src/**`, геометрию, `demo/**` — большая часть набора
гейтов из r1 неприменима к этой дельте по определению; тронут ровно один
python-файл вне тестов. Прогнал:

| Гейт | Команда | Результат |
|---|---|---|
| ruff (сам источник падения CI) | `python3 -m ruff check custom_components/houseplan` (ruff доустановлен в среде ревью, `pip install ruff`) | `All checks passed!` |
| Typecheck | `npx tsc --noEmit` | 0 ошибок |
| Unit (JS) | `npm test` | 1813 тестов, 1812 pass, 1 skipped, 0 fail — совпадает с r1, регрессии нет |
| Build + сверка 3 копий бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && npm run bundle:sync` | байт-в-байт совпадение; `git status` после пересборки чист |
| backend pure (файл, соседний с правкой) | `python3 -m pytest tests_backend/test_decor_assets.py -q` (pytest доустановлен) | 50 passed, 2 skipped — тесты, требующие `pytest-homeassistant-custom-component`, скипаются в этой среде (тот же известный разрыв среды, что и в r1); ни одного fail |
| Отбор смоков | `node scripts/smoke-select.mjs --base dbda64e8 --head c706f8a7` | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются — выбирать нечего» |

### Не прогонял и почему

- **`node scripts/check-docs.mjs`** — условие запуска («diff трогает `src/**`»)
  не выполнено, дельта касается только `custom_components/houseplan/http_api.py`
  и файла документа ревью.
- **Полный HA-harness (`tests_backend/test_ha_websocket.py` и др. с реальным
  HA)** — среда ревью не поднимает `pytest-homeassistant-custom-component`
  (тот же разрыв среды, что зафиксирован в r1); ruff и `test_decor_assets.py`
  достаточны, чтобы доказать конкретно эту правку — она не меняет поведение,
  только убирает неиспользуемый символ. Живой Linux CI на смёрженном SHA —
  канонический прогон харнесса.
- **`npm run golden:verify`, `mutation-gate.mjs`, `model-invariants.mjs`,
  browser-смоки** — дельта не меняет ни одной строки поведения (ни
  продуктового кода, кроме удаления мёртвого импорта, ни рендера, ни
  геометрии); эти гейты релевантны логике #434, которую r1 уже проверил
  индивидуально по каждому AC и не переоткрывается.

## Закрытие раунда r1

| Находка/повод возврата r1 | Чем закрыта | Где видно |
|---|---|---|
| Догоняющий Validate: `ruff F401` на неиспользуемом `read_catalog` в `http_api.py` (обнаружено автором после автомёржа r1, не ревью-находка) | Импорт удалён | `git diff dbda64e8..c706f8a7 -- custom_components/houseplan/http_api.py`; `ruff check` зелёный на `c706f8a7` |

Собственных находок r1 (Low-1, Low-2) в этом раунде не переоткрываю — ниже.

## Унаследовано из r1

Документ `docs/reviews/CODE-REVIEW-434-r1.md`, SHA `dbda64e89d6b76cabfe57c21f281cb6d5132c257`,
зелёный, 0 High / 0 Medium. Дельта r2 не задевает ни один из 12 AC и ни один
файл, упомянутый в разборе r1, кроме самого `http_api.py` (и там — только
блок импортов, не логику). Принимаю без повторной проверки:

- Все 12 AC (physical inventory, upload recovery, explicit delete, sidecar
  regression test, capability guard, resolve cache, danger confirmation,
  Area snapshot witness, bounded smoke, support token cleanup, совместимость,
  гейты) — доказательства из r1 не устарели, код, который они проверяют, не
  менялся.
- Low-1 (`decorAssetsCapabilityChanged` в `space-card.ts` не влияет на
  поведение) — файл не в дельте.
- Low-2 (`_dangerConfirmLocaleGate` может вызвать `languageRenderGate()`
  дважды за цикл) — файл не в дельте.
- Отбор и прогон смоков/мутационных свидетелей r1 — предмет не менялся.

## Итог

High: 0. Medium: 0. Дельта r1→r2 — точечное, верно нацеленное исправление
ровно того дефекта, который остановил CI после автомёржа r1 (мёртвый импорт,
без изменения поведения). Ruff, typecheck, unit, build+bundle-sync и целевой
backend-тест зелёные на `c706f8a7`; grep подтверждает, что символ не
использовался и не реэкспортировался из `http_api.py`. Трейлеры `Issue`/
`User-Visible` соответствуют характеру правки. Вердикт: **зелёный**.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/434-v171-polish-audit`, коммит `c706f8a744a9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `aeb1b1d451adce7d3cb151a1716717bc68271873`
  ```
  git log --all --format='%H %T' | grep aeb1b1d451ad
  ```
- ТЗ `docs/specs/434-v171-polish-audit.md`, блоб `e235fcef2bcd817c39c0c5a9134fd2ec8f6eb2f1`
  ```
  git log --all --find-object=e235fcef2bcd817c39c0c5a9134fd2ec8f6eb2f1 -- docs/specs/434-v171-polish-audit.md
  ```
