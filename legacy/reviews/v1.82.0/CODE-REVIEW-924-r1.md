# CODE-REVIEW-924-r1

Issue: #924 — «CI Sections: выяснить отказ `gridUsesContainerOwnedInlineHeight` и сохранять фактическую геометрию»
Этап: code · Заход: r1 · Трек: show · Материал: `d9ac4a0316c275d0effc9cd566262f671b6f5361` (рабочая копия)

## Скоуп

Инфраструктурная (харнесс) задача, не продуктовая: `demo/smoke_sections_resize.mjs`
перестаёт принимать «три RAF» за признак завершённого mode-transition и ждёт
реальный lifecycle-флаг `card._modeTransitionBusy` (включая `preparing`), пишет
ограниченные (≤48) диагностические снимки геометрии/режима/фазы/браузера — в
обычном выводе и в тексте таймаутов. Добавлен один новый regression-сценарий
(`setupDuringTransitionWaitsForSteadyLayout`): обычная настройка стартует
реальный переход в `plan` и проверяет, что steady-геометрия не читается раньше
независимого lifecycle-сигнала. Плюс `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.81.0/924.json`, `docs/reviews/evidence-924/README.md`
(авторское доказательство, обычная для репозитория директория эвиденса).
Никакого продуктового кода, ассертов, таймаутов (6000 ms / 3000 ms storm) не
менялось. `User-Visible: no` — верно: поведение карточки не меняется, меняется
только то, как харнесс о нём судит.

Привязка к Core user jobs (`docs/SCOPE.md`): прямой — эта задача чинит
достоверность единственного свидетеля «Sections (HA grid) владеет высотой
карточки» (#648), без которого регресс высоты в контейнере Sections не будет
пойман автоматически. Инфраструктура ревью по этой же причине допустима без
отдельной продуктовой строки SCOPE.

## Как проверялось

**Дешёвые гейты.** Validate на точном SHA `d9ac4a03` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/38971058367, job
`Классификация изменённых файлов` → `heavy=false`, см. ниже). Это покрывает
`tsc --noEmit`, `npm test`, `npm run build`+сверку бандла — не перегонял
повторно.

**Смоки, выбранные диффом — проверил сам.** На ветке задачи (`issue/NN-…`)
`classify-changes.mjs: heavyGatesRequested()` намеренно не включает тяжёлый
набор (смоки/golden/perf) — это документированное поведение #697, не пропуск
по ошибке: job `Смоки в браузере` в упомянутом прогоне `skipped` именно потому,
что `needs.changes.outputs.heavy=false` на task-branch событии, а не потому что
reuse-кеш подставил чужой прогон (`reuse.outputs.smoke=false` в логе —
смоук-гейт не был вайвнут). Это ровно то, что REVIEWER.md оставляет на
ревьюера: «смоки, выбранные по диффу». Прогнал сам:

```
npm run bundle:sync                                 # exit 0, свежий dist → demo/srv
HP_SMOKE_CHECKS=1 node demo/smoke_sections_resize.mjs
```

Результат — **15/15 PASS**, exit 0, включая новый
`setupDuringTransitionWaitsForSteadyLayout: true` и неослабленный
`gridUsesContainerOwnedInlineHeight: true` (`stageStyle === 'auto'` — буквально
то же сравнение, что до правки). `SECTIONS_DIAGNOSTICS` в моём прогоне содержит
реальный образец активного перехода: `{"label":"setup during active
transition","mode":"plan","busy":true,"preparing":false,"phase":"running",
"targetMode":"plan","stageStyle":"461.869px", …}`, за которым следует
`{"label":"10 rows","mode":"plan","busy":false,"phase":null,"stageStyle":"auto",…}`
— то есть реальный `_modeTransitionBusy` действительно наблюдался true/false на
границе ровно там, где это нужно сценарию, а не просто захардкожен в тексте
доказательства. `browser-attestation` подтвердил запущенный Chromium (151.0.7922.34,
headless-shell) против пинов toolchain — pinned browser attestation не обойдена.

**«Чем краснеет» для защитного AC (steady-readiness не должен приниматься по
трём RAF).** Автор называет обычный отрицательный случай с результатом (не
регистрировал witness id, что здесь и не требовалось, так как это не ночной
реестр мутаций): на прежнем three-RAF reader с уже добавленным новым сценарием
обычная настройка во время настоящего Plan-перехода дала **RED** именно и
только на `setupDuringTransitionWaitsForSteadyLayout` (все 14 прежних проверки
остались true), `artifacts/924/before.{log,json}`, 2026-10-16 20:52:27–20:52:34
UTC, exit 1 — зафиксировано в `docs/reviews/evidence-924/README.md`. Продуктовый
код/бандл/ассерт/таймаут для получения этого отказа не патчился (политика
ревью #905 запрещает менять предмет ревью — сам смок — ради отрицательной
пробы; поэтому я не повторял этот патч и не воспроизводил его заново, а принял
названный обычный случай с результатом как допустимое доказательство). После
рёбейза на принятый `dev@97692bdc` файл смока и evidence README побайтно
совпадают с до-рёбейзной `cd54dc23` (проверил: диапазон правок идентичен
прочитанному диффу, рёбейз тронул только `docs/DEVELOPMENT.md` и
`docs/STATUS.md` — обе правки аддитивны и неконфликтны, см. ниже), так что
старое доказательство остаётся валидным для этого SHA.

| AC (защитный) | Чем доказан | Чем краснеет |
|---|---|---|
| Steady-геометрия не читается до независимого lifecycle-сигнала (`_modeTransitionBusy`) | Мой прогон: 15/15 PASS, реальный переход пойман в диагностике (busy true→false на границе) | Обычный негативный случай на старом three-RAF reader: `setupDuringTransitionWaitsForSteadyLayout` false, 14/14 прочих true, exit 1, `artifacts/924/before.*`, 20:52:27–20:52:34 UTC |
| Прежние geometry/style/timeout assertions не ослаблены | Чтение диффа: `stageStyle === 'auto'`, 6000 ms / 3000 ms границы дословно те же | Не применимо — отрицательный случай не нужен для неизменённого кода; сверено построчно с `origin/dev` версией файла |

**Слияние с dev.** Трек show, ребейза не делал (ветка как есть). Материал
обгоняется `origin/dev` на 3 коммита (#927 и его индекс); `git merge-tree`
подтвердил чистое аддитивное слияние обеих затронутых зон `docs/DEVELOPMENT.md`
и `docs/STATUS.md` (разные абзацы, без пересечения строк) — конфликтов нет, как
и было заявлено в контексте запуска.

**Не проверял:** golden-кадры (диффа в рендере/разметке продукта нет —
не относится), perf-smoke, pytest backend, Hassfest/HACS, мутанты по диффу
(задача про тест-харнесс, не про продукт — реестр мутаций её не касается),
полный `npm run gate:small` (избыточен поверх точечного смока и уже зелёного
Validate на этом SHA; гейты соразмерны объёму правки — §8). Ручного
UI-тестирования в браузере вне смока не делал — для инфраструктурной правки
смока это и есть эквивалент.

## Находки

Нет High. Нет Medium.

Мелкое (ниже порога находки, не блокирует): формулировка в `DEVELOPMENT.md`
«retains all fourteen original checks and adds one regression» читается
двусмысленно (как будто добавлена регрессия, а не regression-guard тест) —
не влияет на корректность и не требует отдельного issue.

## Что проверено и корректно

- Новый `settle()` действительно ждёт `!card._modeTransitionBusy` дважды
  (до и после трёх RAF/`updateComplete`), что подтверждено как чтением кода,
  так и моим прогоном с реальными переходами в диагностике.
- Новый сценарий `setupDuringTransitionWaitsForSteadyLayout` стартует настоящий
  переход (`window.__hpTest.setMode('plan')`), дожидается `targetMode==='plan'`
  в busy-состоянии, затем через обычный `setRows(10)` корректно дожидается его
  завершения перед чтением geometry — без обращения к приватному forced-state.
  Возврат в `view` и общий `settle()` восстанавливают состояние для
  последующих проверок (minimumGeometry/resize storm/editor transitions), что
  подтверждается их PASS в том же прогоне.
- Pinned-browser attestation (`requirePinnedBrowser()`) используется ровно по
  тому же общему паттерну, что и ~12 других смоков — не новая абстракция.
- `docs/release-ledger/v1.81.0/924.json`: `category: infra`, обоснование
  соответствует изменению, формат идентичен соседним записям (#917, #922);
  `introducedBy` не требуется — не правка новой бета-фичи.
- Трейлеры коммита `Issue: #924`, `User-Visible: no` — корректны, changelog
  не трогается (нет пользовательски видимой величины).
- `docs/reviews/evidence-924/README.md` — обычное место для авторского
  доказательства, такой же паттерн, как `evidence-866`, `evidence-895`,
  `evidence-901/902/906`.

## Маршрут

Критерии §5 пройдены: сложность/риск низкие (один test-харнесс файл + доки),
одна поверхность (demo-смок), нет миграции конфига, нет нового UX-контракта
(поведение продукта не меняется), нет влияния на perf/touch-контракт, нет
недокументированного поведения (задача инфраструктурная, не описывает
пользовательское поведение). → `route: fix`.

## Вердикт

Зелёный. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/924-sections-settle`, коммит `d9ac4a0316c2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dc8f8ec6d8db3717e5991322ec409125e7b3fd57`
  ```
  git log --all --format='%H %T' | grep dc8f8ec6d8db
  ```
- Тело issue: `47a0a2428a21830e6ab6aaae7fa9b93c7952473d2aadec78c4ca4794114cca7f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NzgsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDg4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2OCwib3V0cHV0X3Rva2VucyI6MjQ4MzUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTEyMjMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyNDcwNzg4LCJjb3N0VXNkRXN0aW1hdGUiOjEuMTA3NTM1Nn1dLCJ0dXJucyI6NDUsImR1cmF0aW9uTXMiOjM2NTQ5OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMTEyNjIzNiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5046 output_tokens=24857 cache_creation_input_tokens=91223 cache_read_input_tokens=2470788 num_turns=45 -->
