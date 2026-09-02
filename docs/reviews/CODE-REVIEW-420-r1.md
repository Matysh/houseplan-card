# CODE-REVIEW-420-r1

Issue: [#420 — Support-пакет: value_badge.enabled/position копируются дословно в обход типизированной проекции](https://github.com/Matysh/houseplan-card/issues/420)
Ветка: `issue/420-support-badge-projection`
SHA материала ревью: `c5d9775c7a17a0ba3434fc9bc179f965f5c6455e` (сверено `git rev-parse HEAD` перед подведением итогов)
Трек: `trivial` (ТЗ — тело issue, ревью спеки — комментарий аналитика)
Заход: r1 · блокирующих циклов израсходовано 0 из 2

## Скоуп

Единственный продуктовый коммит `c5d9775c` (`fix: type-check support badge
projection`), трейлеры `Issue: #420` / `User-Visible: yes` на месте.

```
 custom_components/houseplan/support_package.py |  26 +++++++++++++++++------
 docs/CHANGELOG.md                               |   4 +++
 docs/CHANGELOG.ru.md                            |   4 +++
 tests_backend/test_support_package.py           |  49 +++++++++++++++++++++++++-
```

Класс изменений: A (`custom_components/houseplan/**/*.py`) + B (тест) + C
(changelog). `src/**`, `validation.py`, `MARKER_SCHEMA`, `demo/**` не тронуты.
Геометрия/`layout`/`marker.space`/`open_spans`/толщина стен не затронуты —
проекция экспортного дифф-безопасного диагностического пакета, а не хранимой
конфигурации или геометрии.

## Что делает изменение

`_project_marker()` раньше копировал `value_badge.enabled` и
`value_badge.position` через generic `_copy_keys()` — без проверки типа
значения. Новая функция `_project_value_badge()` строит typed allowlist:
`enabled` — только точный `bool`, `position` — только строка из
`{right, bottom, left, top}`, `source` — прежняя типизированная
`_project_value_source()`. Неизвестные ключи (например будущий `future`) и
неверно типизированные значения отбрасываются на своей глубине; если после
проекции не осталось ни одного поля — `value_badge` не экспортируется вовсе.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| TypeScript типы | `npx tsc --noEmit` | зелёный, без вывода |
| Frontend unit-тесты | `npm test` | `1742 passed, 1 skipped` (совпадает с заявленным автором числом) |
| Production build | `npm run build` | `tsc --noEmit && rollup -c` — зелёный, `dist` собран за 10.5s |
| Backend lint (ruff, пин 0.16.5 из `tests_backend/requirements.txt`) | `ruff check custom_components/houseplan/support_package.py tests_backend/test_support_package.py` | `All checks passed!` |
| Backend mypy strict | не прогонялся | `support_package` не входит в strict-allowlist `pyproject.toml` (`const`, `projection`, `coordinate_canonicalization`, `frontend_asset_manifest`, `junction_limits`, `plans`) — гейт неприменим к этому файлу |
| `python -m pytest tests_backend/test_support_package.py` (пинned `pytest-homeassistant-custom-component==0.13.357`) | не прогонялся штатно | пакет `custom_components.houseplan` при импорте тянет реальный `homeassistant` через `__init__.py`; пинned-набор из `tests_backend/requirements.txt` в этой песочнице не устанавливался (тяжёлая установка HA/phcc). Вместо этого — прямое исполнение модуля, см. ниже |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | зелёный вывод инструмента | `Исполняемого frontend-диффа нет (src/**/*.ts не тронут). Browser-smoke этим диффом не выбираются` — это «выбирать нечего», не пропуск |
| `node scripts/check-docs.mjs` | не прогонялся | diff не трогает `src/**` — условие прогона не выполнено |
| `npm run golden:verify` | не прогонялся | diff не меняет рендер/геометрию/стили — не применимо |
| `npm run invariants` | не прогонялся | diff не трогает рёбра комнат, толщину, `layout`, `marker.space`, `open_spans` — не геометрическое изменение |

### Прямое исполнение модуля (заменяет недоступный pytest-прогон)

`support_package.py` намеренно не импортирует Home Assistant (собственный
докстринг модуля), только `custom_components/houseplan/__init__.py`
безусловно импортирует `homeassistant.components.frontend` — то же самое
ограничение, что автор указал в хендофф-комментарии. Обойдено через
stub-пакеты в `sys.modules`, минуя реальный `__init__.py`, и модуль загружен
как **настоящий, неизменённый файл из рабочего дерева** — не переписанная
копия теста.

Так воспроизведены оба ключевых сценария теста `test_support_package.py`:

1. **Полный пакет с sentinel** (та же конфигурация, что и `_source()` в
   `tests_backend/test_support_package.py:29-90`, включая
   `value_badge.enabled = {"private": "value-badge-private-sentinel"}`,
   `position = [...]`, `source.kind = "private"`, лишний ключ `future`):
   на **текущем** коде (`c5d9775c`) `"value-badge-private-sentinel" in raw.decode()` →
   `False`, `marker["value_badge"]` отсутствует целиком (все поля
   провалились по типу/allowlist) — соответствует AC2 буквально: «если после
   проекции не осталось допустимых полей, `value_badge` отсутствует
   целиком».
2. **Тест умеет падать** (обязательная дисциплина ревью): та же
   конфигурация прогнана через **старый** `support_package.py`
   (`git show origin/dev:...` во временный файл, загружен тем же приёмом).
   На старом коде `"value-badge-private-sentinel" in raw.decode()` → **True**,
   `marker["value_badge"] == {'enabled': {'private': 'value-badge-private-sentinel'}, 'position': ['value-badge-private-sentinel']}` —
   утечка воспроизведена документально. Правка меняет `True → False` на
   идентичном входе — это и есть доказательство, что тест красный без фикса и
   зелёный с ним.
3. Четыре параметризованных случая из
   `tests_backend/test_support_package.py:344-357`
   (`({"private": …}, "right") → {"position": "right"}`,
   `(True, {"private": …}) → {"enabled": True}`,
   `([], "sideways") → None`, `("true", ["bottom"]) → None`) и случай
   `test_value_badge_projection_omits_empty_result` (все три поля невалидны →
   `value_badge` отсутствует) — воспроизведены исполнением `_project_marker`
   напрямую, результат в каждом случае совпал с ожиданием теста дословно.
4. Валидный полный набор (`enabled: True, position: "bottom",
   source: {"kind": "derived_lqi"}`) сохраняется без изменений — AC1.

Это исполнение конкретного, неизменённого продуктового модуля на входных
данных из реального тест-файла, а не пересказ логики по чтению — записываю
как «доказано исполнением», а не «прочтением».

### Соответствие allowlist контракту фронтенда

`src/types.ts:101` — `ValueBadgePosition = 'right' | 'bottom' | 'left' |
'top'` — ровно та же четвёрка, что и `_VALUE_BADGE_POSITIONS` в
`support_package.py`. `src/types.ts:104-108` — `ValueBadgeSource.kind` ∈
`{entity_state, entity_attribute, derived_lqi, derived_marker_state}` — ровно
множество, которое различает уже существующая `_project_value_source()`
(переиспользована без изменений). Allowlist не изобретён ревьюером и не
автором задним числом — он списан с действующего контракта фронтенда,
который проекция обязана пережить.

## AC — построчно

- **AC1 (корректная проекция, backend).** Доказано исполнением (раздел выше,
  случай 4 и тест `test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values`,
  строка diff `tests_backend/test_support_package.py:311-313`): валидные
  `enabled: bool`, `position` из четвёрки, допустимый `source` проходят без
  изменений; посторонние ключи `value_badge` (пример — `future` в sentinel-
  конфиге) никогда не попадали в вывод ни в старом, ни в новом коде — они не
  входили в allowlist `_copy_keys(("enabled", "position"))` изначально, так
  что это не регрессия, а неизменная часть контракта. **Выполнено.**
- **AC2 (fail-closed, backend).** Доказано исполнением: объект/массив/строка
  вместо `enabled`, невалидная/нестроковая `position`, вложенные
  sentinel-ключи не попадают в байты пакета (полный прогон `_source()` на
  `c5d9775c` — 0 совпадений); при полностью невалидном `value_badge` ключ
  отсутствует целиком (`test_value_badge_projection_omits_empty_result`,
  воспроизведено исполнением). Тест **умеет падать** — показано прогоном той
  же сцены на коде `origin/dev` (раздел выше, пункт 2): без фикса тот же
  ассерт был бы `False`. **Выполнено.**
- **AC3 (совместимость, ревью кода).** `git diff origin/dev...HEAD` не
  трогает `validation.py` — `MARKER_SCHEMA` и delta-safe-хранение будущих
  литералов остаются `vol.Optional("enabled"): object` /
  `vol.Optional("position"): object` (подтверждено чтением
  `validation.py:1750-1763`, там же явный комментарий про lossless-доктрину).
  Изменилась только диагностическая проекция support-пакета. Проверено
  чтением (по определению AC — «ревью кода», не автотест), подтверждено
  отсутствием изменений в файле схемы в диффе. **Выполнено.**

## Single-source-numbers

Изменение не добавляет и не меняет ни одной величины, видимой пользователю
дважды (превью/запись, подпись/площадь и т.п.) — это правка серверной
diagnostic-проекции одного экспортного файла, у `enabled`/`position` в нём и
так был единственный источник (конфиг маркера). Не применимо.

## Находки

Нет.

## Что проверено и корректно

- Логика `_project_value_badge` корректна на всех протестированных
  комбинациях типов, включая случай полностью пустого результата.
- `source` внутри `value_badge` использует прежнюю `_project_value_source`
  без изменений — риска рассинхронизации с остальными местами, где та же
  функция используется (`value_source` на маркере), нет.
- Позиции и виды источника в allowlist совпадают с реальным TS-контрактом
  (`src/types.ts`), а не придуманы.
- `validation.py`/`MARKER_SCHEMA` не тронуты — compatibility-контракт
  «не отвергать неизменённые данные будущей версии» не пострадал.
- Трейлеры `Issue: #420` / `User-Visible: yes` на коммите корректны; оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите, формулировки на EN/RU согласованы по смыслу.
- `npm test`, `npx tsc --noEmit`, `npm run build`, `ruff check` — зелёные,
  прогнаны лично на `c5d9775c`.
- Диагноз задачи (аудит `AUDIT-2026-09-02-v1700.md` §3.2 B2) устраняется
  именно там, где был назван: `value_badge.enabled`/`position` в
  `_project_marker`, без побочного расширения на `glow_color.bri`, `display`,
  `tap_action` — эти поля вне контракта исправления и в этой задаче
  сознательно не тронуты (issue формулирует их как «то же самое, но
  прикрыто строгой схемой», не как часть этой правки).

## Чего не проверял

- Полный `pytest tests_backend` через закреплённый набор из
  `tests_backend/requirements.txt` (`pytest-homeassistant-custom-component==0.13.357`,
  `homeassistant==2026.8.3`) — установка тяжёлого пинned-стека не выполнялась
  в песочнице ревью. Компенсировано прямым исполнением немодифицированного
  `support_package.py` на тех же входных данных, что и тест-файл, включая
  явное воспроизведение «красного» состояния на коде `origin/dev` (см. раздел
  «Прямое исполнение модуля»). Тестовые файлы (`.py`) прочитаны целиком и
  их ассерты сверены построчно с результатом исполнения — расхождений нет.
- `python -m mypy` — не запускался, файл вне strict-allowlist, гейт
  неприменим к этому диффу.
- Browser smoke (`demo/smoke_*.mjs`), `golden:verify`, `npm run invariants`
  — не прогонялись; diff не трогает `src/**`, рендер, геометрию или ссылки на
  неё, что подтверждено и инструментом `smoke-select.mjs` (нечего выбирать),
  и составом diff (`git diff --stat` выше).
- Ручного тестирования UI/браузера не было — изменение целиком серверное, у
  UI нет наблюдаемого пути к нему (support-пакет генерируется и скачивается
  тем же способом, что и раньше; изменился только внутренний состав байтов
  для непривилегированного тестового сценария с sentinel-данными, которых в
  реальном фронтенде и так не бывает).

## Материал раунда

- Ветка: `issue/420-support-badge-projection`
- SHA: `c5d9775c7a17a0ba3434fc9bc179f965f5c6455e`
- Диапазон: `origin/dev..HEAD` (один коммит)
- Первый заход (r1), унаследованных разделов нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/420-support-badge-projection`, коммит `c5d9775c7a17` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dbba2a334e77f806dc77aa912a06962fcb1eaa92`
  ```
  git log --all --format='%H %T' | grep dbba2a334e77
  ```
