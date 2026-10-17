# CODE-REVIEW-951-r1

Issue: #951 · Трек: show · Этап: code · Заход r1 · блокирующих циклов использовано 0 из 2
Материал: `e703ddcb5f14616ed87992fff2081c9b0130e1c0` (рабочая копия — он же)
Побочные находки: `mode=issues` (доверенный снимок политики). Побочных находок нет — новых issue не заводилось.

## Скоуп

Регрессия #866: общая обводка группы устройств и контактная оболочка у стены
съезжали относительно маркера/стены при зуме, а их толщина (жёстко заданная
1.5 px) расходилась с обычной CSS-рамкой свободного маркера. ТЗ (три AC в теле
issue) ограничивает правку одной визуальной границей — стилями Flat-контактной
оболочки, без изменения solver/geometry/hit/writer/жестов/хранения. Это
соответствует Core user job по `docs/SCOPE.md` (корректное визуальное
представление устройств на плане, трек `show`).

Изменённые файлы: один продуктовый `src/device-contact.styles.ts`; новый
native-smoke `demo/smoke_device_contact_zoom.mjs`; связи в
`scripts/smoke-links.mjs`; два статически зарегистрированных мутанта в
`scripts/mutation-registry.mjs` + их инвентарь в
`docs/testing-notes/mutation-browser-guards.md`; документация
(`ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`, `DEVELOPMENT.md`, `STATUS.md`,
оба `CHANGELOG`); `docs/release-ledger/v1.81.0/951.json`; два golden-PNG +
`baselines-index.json`.

## Как проверялось

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | Не перегонял | Зелёный Validate подтверждён на точном SHA `e703ddcb` (https://github.com/Matysh/houseplan-card/actions/runs/39061324721, #343) |
| `npm run bundle:sync` (для native smoke) | Прогнал сам | OK, бандл собран; после проверки вернул `npm run bundle:clean` — рабочее дерево чистое |
| `node demo/smoke_device_contact_zoom.mjs` (назван в AC1/AC2/AC3, пинованный Chromium 151.0.7922.34) | Прогнал сам, на материале | **PASS** DPR1 и DPR2: 418 кадров/сэмплов, `maxOffset = 0.00062 CSS px` (допуск 0.1), `maxStrokeDifference = 0` во всех режимах (View/Devices, light/dark, zoom 1/3…4 и возврат, native pinch, кнопочный зум, колесо, pan, Fit, static card 720/360 px). Артефакты — `artifacts/951/zoom/*.png`, `results.json` — просмотрены (скрин приложен ниже по тексту отчёта автора, дополнительно открыты сами PNG из коммита). |
| `node demo/smoke_device_contacts.mjs` (AC3: базовый #866-smoke) | Прогнал сам | PASS |
| `node scripts/mutation-registry-check.mjs` | Прогнал сам | PASS, без ошибок |
| `node scripts/mutation-gate.mjs --check` | Прогнал сам | PASS: `definitions=1655`, оба новых id (`device-contact-inline-zoom-drift-951`, `device-contact-fixed-stroke-951`) — `ok`, без новых warning; `static-readiness: execution=0 caught=unknown (nightly only)` — как и требует политика (исполнение мутантов — только ночью) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прогнал сам | Оба AC-смока присутствуют адресно; остальные связи — широкие file-level (#866), честно помечены «НЕОПРЕДЕЛЁННОСТЬ» инструментом, не выдаются автором за прогнанные адресно |
| Golden (`ci:golden`, `baselines-index.json`) | Не перегонял полный `golden:verify` (210 сцен) — дорогой гейт, уже закрыт пайплайном (`ci:golden` ставится до Validate, §5.1) и зелёным Validate на точном SHA | Сверил сам diff `baselines-index.json`: изменились ровно 2 ожидаемых хеша (`device-contacts-designer-light/dark`), `witnesses.count` 108→115 согласован с +2 зарегистрированными мутантами и остальным инвентарём; commit `d4cbd165` несёт `Release:` + `Baseline-Reviewed-Local: sha256:…`, хеш совпадает с `localAttestation.sha256` в индексе |
| Инварианты модели (`npm run invariants`) | Не прогонял — не применимо | Геометрия/solver/hit/writer не меняются (confirmed by diff и docs); AC этого не требует |
| `pytest tests_backend` | Не прогонял — не применимо | Python/integration не затронуты |
| Performance | Не прогонял — не применимо | Не назван в AC, perf-механизм не меняется (AC3 явно требует отсутствия нового измерения на кадр — проверено тем же native smoke: `work.measurements`/`work.rebuilds` не растут) |
| «Визуальный минимум» (8 смоков, #690) | Не перегонял сам | Автор прогнал все 8 PASS до ребейза на #928 на исходном материале; после ребейза продуктовый стиль/smoke/DEVICE-PRESENTATION побайтово не изменились (`git diff --exit-code ce317d67b HEAD -- …` → 0 по заявлению автора — не перепроверял git-объекты старого коммита, они не входят в материал ревью), риск того, что эти 8 несвязанных сцен сломались именно из-за CSS правки одного contact-shell файла, оцениваю как исчезающе малый и не требующий отдельного перегона |
| Трейлеры `Issue`/`User-Visible`, оба CHANGELOG в одном коммите | Проверил чтением | `65de7ab1`: `Issue: #951`, `User-Visible: yes`, оба `CHANGELOG.md`/`CHANGELOG.ru.md` в этом же коммите — выполнено. `d4cbd165`: `Release:` + `Baseline-Reviewed-Local:` — выполнено. `e703ddcb`: doc-only ledger-правка, `User-Visible: no` — корректно |
| `docs/release-ledger/v1.81.0/951.json` классификация | Проверил чтением + исполнением валидатора | `category: line-fix`, `introducedBy: 866` (регрессия #866 внутри текущего бета-цикла после v1.81.0 — отсутствует в предыдущем stable, значит не входит в пользовательский milestone, см. §11.9). Подтвердил исполнением: `scripts/release-ledger.mjs:35-36` реально требует `introducedBy` для `line-fix` и бросает исключение без него — это не декларация автора, а код, который гоняет `merge-candidate.mjs` |
| «Одно число — один источник» (§8) | Проверил чтением | И CHANGELOG (RU/EN), и release-ledger summary описывают эффект словами («не смещается», «та же толщина»), ни одно число (px, зум) не продублировано как независимая константа в документации — единственный источник толщины в коде теперь `--device-shell-border-width`, общий с обычной CSS-рамкой (`src/styles/devices.styles.ts:119,210`) |

## Находки

Находок нет — ни High, ни Medium, ни Low.

## Что проверено и корректно

- **AC1 (положение).** Корень причины подтверждён и устранён корректно: inline
  `<svg>` по умолчанию — заменяющий inline-элемент и участвует в формировании
  строчного бокса родителя; при core меньше line-height это давало вертикальный
  сдвиг (анализ автора на неизменённом dev: `offsetY = 3.40625 px` при
  `zoom=1/3`). `display: block` (`src/device-contact.styles.ts:6`) убирает
  участие в строке — стандартное и единственно необходимое исправление, без
  побочных эффектов на позиционирование (`.device-contact-ink` остаётся
  `position: absolute; inset: 0`). Подтверждено прогоном: максимальная ошибка
  регистрации пути на 418 сэмплах — `0.00062` CSS px при допуске AC `0.1`.
  «Чем краснеет»: мутант `device-contact-inline-zoom-drift-951` (откат
  `display: inline`) зарегистрирован с верным guard-смоком; сам я его не
  исполнял (запрещено вне ночного workflow) — автор привёл обычный
  отрицательный случай на настоящем немодифицированном старом коммите
  (`d36364b2`/`b368c8236`): тот же смоук на том коде даёт `max error 9.77 px`,
  что подтверждает чувствительность теста без исполнения мутанта.
- **AC2 (толщина).** Жёсткая константа `1.5` убрана из продукта (подтверждено
  grep: в `src/device-contact.styles.ts` её больше нет, упоминание `1.5`
  осталось только в тексте мутанта-свидетеля). Новое правило
  `stroke-width: round(down, var(--device-shell-border-width), 1px);`
  переиспользует ту же переменную, что обычная рамка
  (`src/styles/devices.styles.ts:119,210`), округляя вниз до того же целого
  CSS-пикселя, который браузер фактически использует для рендера
  `border-width` — это и есть задокументированное в issue расхождение
  (вычисленная рамка свободного маркера — 1 px, обводка — 1.5 px). Верхняя
  строка `stroke-width: var(--device-shell-border-width);` остаётся валидным
  фолбэком для движков без CSS `round()` (невалидное повторное объявление
  CSS-свойства игнорируется браузером, а не ломает блок — проверено чтением
  спецификации каскада, это стандартный паттерн progressive enhancement, уже
  прокомментированный в коде). Подтверждено прогоном: `stroke` и `freeBorder`
  (вычисленный `border-top-width` того же элемента) совпадают с разницей `0`
  на всех 418 сэмплах, на DPR 1 и 2, светлой и тёмной теме. «Чем краснеет»:
  мутант `device-contact-fixed-stroke-951` зарегистрирован (возврат к
  `stroke-width: 1.5`), не исполнялся; обычный отрицательный случай на старом
  коде даёт разницу `0.5 px` — чувствительность подтверждена без исполнения
  мутанта.
- **AC3 (отсутствие побочных изменений).** Правка ограничена CSS: не
  переименовано ни одного метода, не создано новых DOM-измерений на кадр.
  Смоук отдельно сравнивает на каждом кадре `layout`/`config` (deep-equal с
  исходным), счётчик WS-записей (`houseplan/layout/update`,
  `houseplan/config/set`), сериализацию `scene.shapes`/`scene.edges` и
  счётчики `work.measurements`/`work.rebuilds` — все неизменны во время
  зума/pan/wheel/Fit. `smoke_device_contacts.mjs` (исходный #866-smoke:
  individual actions/history/cancel/refusal/Flat↔2.5D) зелёный на том же
  материале — соседнее поведение не задето. `.dev[data-hp-device-contact]
  .device-shell-frame { opacity: 0 }` (существующее правило, не изменено)
  подтверждает, что «одна эффективная рамка» на размерах контактного
  устройства и так была задумана общей переменной — расширение на
  `stroke-width` логически последовательно, а не новый механизм.
- **Трек show, критерии §5 (маршрут `fix`).** Один файл продуктового кода,
  один визуальный класс риска (CSS paint), сложность/риск 2/10 по собственной
  оценке автора — подтверждаю при чтении диффа: нет новой схемы хранения, нет
  compatibility-полей, нет нового UX-контракта (поведение — восстановление уже
  описанного в `DEVICE-PRESENTATION.md`/`CANVAS.md §6`), нет влияния на
  performance/touch-контракт (явно проверено тем же smoke). Ожидаемое
  поведение зафиксировано в отчёте владельца и в каноне подсистемы — задача
  проходит `undocumented`. Все шесть критериев §5 пройдены → `route: fix`.
- Документация (`ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`, `DEVELOPMENT.md`,
  `STATUS.md`) описывает ровно то, что показывает код и smoke, без
  преувеличений и без новых необоснованных утверждений.

## Чего не проверял

- Полный `golden:verify` (210 сцен) и полный `gate:small` — не перегонял;
  опёрся на зелёный Validate на точном SHA материала (#343) и на собственную
  сверку diff `baselines-index.json` (ровно 2 ожидаемых хеша).
- «Визуальный минимум» (8 смоков, #690) — не перегонял сам на `e703ddcb`;
  принял авторское свидетельство о прогоне на материале до ребейза на #928 и
  байт-в-байт неизменности продуктового стиля/smoke-файла/документации через
  ребейз. Старые git-объекты (`ce317d67b`, `faa74fec8`) вне материала этого
  ревью — не проверял их существование напрямую.
- Полный предрелизный набор (HA harness, performance suite, полная
  browser-matrix на всех платформах) — вне объёма ревью по §8, не требуется
  этим AC.
- Ручная dev/GPU-приёмка владельцем — добровольна (#929), её отсутствие не
  является находкой.
- Ночное исполнение двух новых мутантов (`device-contact-inline-zoom-drift-951`,
  `device-contact-fixed-stroke-951`) — вне этого цикла по общей политике;
  «caught» подтвердит только ночной workflow.

## Вердикт

Зелёный. AC1–AC3 доказаны именованным native-smoke, который я сам прогнал на
точном материале ревью и который реально падает на немодифицированном старом
коде (по свидетельству автора) — защитные AC2/AC1 имеют заполненную строку
«чем краснеет» с зарегистрированными, не исполнявшимися мутантами, что
соответствует политике. Трейлеры, оба changelog, release-ledger классификация
и её исполняемый валидатор, golden-диф — в порядке. Задача проходит все
критерии §5 трека show.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/951-contact-outline-zoom`, коммит `e703ddcb5f14` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d553cd12751189cd5b0099680907d6553e936e98`
  ```
  git log --all --format='%H %T' | grep d553cd127511
  ```
- Тело issue: `33ec9f314d1a75b55d44bd8f5e8b7d80f6ecf9d718d81abbfb7a1faa00acb06a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDIsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTc3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5NCwib3V0cHV0X3Rva2VucyI6Mjc1NjcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTI1ODY4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzk4ODA0MiwiY29zdFVzZEVzdGltYXRlIjoxLjU3NjkzODR9XSwidHVybnMiOjU3LCJkdXJhdGlvbk1zIjo1NDIxMTMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjU4MjExNTQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5196 output_tokens=27582 cache_creation_input_tokens=125868 cache_read_input_tokens=3988042 num_turns=57 -->
