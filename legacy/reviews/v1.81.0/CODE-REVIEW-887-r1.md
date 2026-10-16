# CODE-REVIEW-887-r1

Материал: `b8c58d5ac8c7b054de97c29b9075b2407d56bf43` (`origin/dev..HEAD`, 1 коммит).
Issue #887, трек `track:show`, заход r1, блокирующих циклов 0/2.

## Скоуп

Ночной полный мутационный прогон (run 38516587807, `dev`@`eb53fb764b0c`)
обнаружил три отказа:

1. `vacuum-physical-certification-infinite-line` — выжил (сбежавший мутант).
2. `wall-face-shared-cut-loses-own-carrier-cm` — выжил (сбежавший мутант).
3. `marker-save-click-forgets-baseline-before-result` — `setup-failure`
   (TS2304, отсутствующий импорт), без вердикта.

Задача чинит все три определения и усиливает тестовую фикстуру geometry
vacuum-пути. Изменены только файлы классов B/C: `scripts/mutation-registry.mjs`,
`test/mutation-gate.test.mjs`, `test/vacuum-path-geometry.test.mjs`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/release-ledger/v1.80.1/887.json`.
Класса A нет, продуктовое поведение не меняется — это соответствует
`docs/SCOPE.md`: задача не продукт, а ремонт собственной инфраструктуры
доказательств (защитные AC и ночной gate), без которой утверждения SCOPE про
инвариант геометрии/блокировки стен и safe-физику vacuum перестают быть
проверяемыми.

## Критерий §5 (трек show)

| Критерий | Результат |
|---|---|
| complexity ≤ 3 | да — три точечных определения мутантов плюс тестовая фикстура |
| surfaces | один — реестр мутационных свидетелей/нижайший тестовый слой |
| migration | нет — ни конфига, ни новых compatibility-полей |
| ux-contract | нет — продукт не меняется |
| perf-touch | нет влияния |
| undocumented | нет: `docs/VACUUM.md` («Ordered simplification certifies every original sample against a finite segment with monotone progress, at most 2 cm») и `docs/WALL-THICKNESS.md` («each newly promoted shared cut keeps its own partition's thickness») уже фиксируют то поведение, которое тесты теперь проверяют точнее |

Все критерии проходят → `route: fix`, реклассификация не нужна.

## Как проверялось

Дешёвые гейты уже подтверждены зелёным Validate на этом SHA (run 38538608805):
`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла — не
перегонялись повторно.

Прогнано лично в этом раунде:

| Гейт | Команда | Результат |
|---|---|---|
| Vacuum unit (AC1) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/vacuum-path-geometry.test.mjs` | 16/16 PASS |
| Негативная проба AC1 | вручную откатил `src/vacuum-path-geometry.ts:151` к `if (t < projection \|\| t > 1 \|\| ...)` → `if (ex*ex+ey*ey > squared)` (ровно мутация `vacuum-physical-certification-infinite-line`), пересобрал test-build | **1/16 FAIL** — новая гентл-фикстура ловит мутацию; восстановил исходник, подтвердил снова 16/16 |
| Wall-cut smoke (AC2) | `npm run bundle:sync && node demo/smoke_wall_face_room_split.mjs` на исходном коде | PASS, все сценарии включая «0/15cm» и «25/15cm» |
| Негативная проба AC2 | вручную применил патч мутанта `wall-face-shared-cut-loses-own-carrier-cm` (`original?.cm ?? carrier?.cm ?? this._wallSourceCmAt(...)` → `original?.cm ?? fallback`) к `src/houseplan-editor-runtime.ts:6778`, пересобрал бандл | **2 FAIL**: `Native reported drawing and Undo Redo: newCut15cm` и `Existing composite with 0/15cm carriers: sourceCmPreserved`. Восстановил исходник, `npm run bundle:clean`, рабочая копия чистая (`git status --porcelain` пуст) |
| Регрессия определений (AC3 структурно) | `node --test --test-name-pattern="#887" test/mutation-gate.test.mjs` | 2/2 PASS |
| Статическая целостность реестра | `node scripts/mutation-gate.mjs --check --changed=origin/dev..HEAD` | GREEN: definitions=192, source-reads=97, единственный WARN — прежний «browser guards: 313/200» (не новый) |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «исполняемого frontend-диффа нет» — согласуется с тем, что класс A не тронут |
| Трейлеры/статус | `git log -1`, `node scripts/process-gate.mjs --issues` | `Issue: #887`, `User-Visible: no` (верно — без правок changelog); process-gate GREEN, единственный WARN — ожидаемый «инфраструктурный диапазон без S-метки до S7» |

Для AC3 (`forgetMarkerBaseline`) дополнительно проверено чтением: импорт
`import { forgetMarkerBaseline, markerDirty, markerProblems } from
'./marker-form-state';` в патче мутанта дословно совпадает со строкой,
которая реально стоит в `src/editors/marker-dialog.ts:20` после применения
replace — т.е. static-anchor-check (`source.split(patch.find).length === 1`)
гарантирует, что find-якорь мутанта `import { markerDirty, markerProblems }
from './marker-form-state';` существует в текущем исходнике ровно один раз, и
что `forgetMarkerBaseline` реально экспортируется `marker-form-state.ts:26`.
Применение мутации и компиляция патча — ночная обязанность (track:show
мутанты в разработке не исполняет, #709) — не запускал, это ожидаемо и не
находка.

## Таблица AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (vacuum finite/monotone certificate) | `test/vacuum-path-geometry.test.mjs`, исполнено 16/16; две новые гентл-фикстуры проверяют временной порядок (`t` монотонно растёт в [0,1]) независимо от `protectedTurn` | мутант `vacuum-physical-certification-infinite-line`; лично воспроизведено — при отключении проверки `t < projection \|\| t > 1` тест красный (1 fail) |
| AC2 (own-carrier вместо first-face fallback) | `demo/smoke_wall_face_room_split.mjs`, исполнено PASS на исходном коде; `test/mutation-gate.test.mjs` подтверждает, что find-якорь покрывает оба запасных пути (`carrier?.cm` и `_wallSourceCmAt`) | мутант `wall-face-shared-cut-loses-own-carrier-cm`; лично воспроизведено — после патча 2 сценария smoke падают (`newCut15cm`, `sourceCmPreserved`) |
| AC3 (marker Save helper import) | `test/mutation-gate.test.mjs` (структура патча), чтением подтверждено совпадение find-якоря и реальный экспорт `forgetMarkerBaseline` | мутант `marker-save-click-forgets-baseline-before-result`; ранее падал с TS2304 ещё до заявленного теста — это и была исходная проблема («свидетель без доказательства»), патч устраняет именно её; фактическая поимка — ночным gate (мутанты в разработке не исполняются, track:show) |

Пустых третьих столбцов нет.

## Что проверено и корректно

- Все три определения в `scripts/mutation-registry.mjs` точно соответствуют
  текущему исходному коду (`original?.cm ?? carrier?.cm ?? this._wallSourceCmAt(...)`
  на `houseplan-editor-runtime.ts:6778-6779`, импорт на `marker-dialog.ts:20`).
  `fallback` в патче AC2 — реальная переменная в той же области видимости
  (`houseplan-editor-runtime.ts:6751`, вычисляется из `ring[0]`, то есть именно
  «cm первой грани», как и описано в теле issue).
- Трейлеры корректны: `Issue: #887`, `User-Visible: no` — верно, видимого
  поведения нет, changelog не нужен.
- `docs/release-ledger/v1.80.1/887.json`: `baseStable: v1.80.1` — действительно
  последний стабильный тег (`git tag --list 'v*'`); категория `infra` по
  таблице PROCESS.md §11.9 («инфраструктура/документация без изменения
  поведения продукта» → без milestone, `introducedBy` не требуется).
- Правки `docs/DEVELOPMENT.md` и `docs/STATUS.md` — ручная проза, фактически
  описывают только что проверенные изменения, без противоречий исполняемому
  коду.
- Рабочая копия после всех негативных проб восстановлена в точности до
  материала ревью (`git status --porcelain` пуст).

## Находки

Нет. High: 0, Medium: 0.

## Чего не проверял

- Полный `npm run gate:small`, `npx tsc --noEmit`/`npm test`/`npm run build`
  целиком — не перегонял: Validate зелёный на этом же SHA (run 38538608805),
  §8 разрешает не повторять дешёвые гейты, уже сошедшиеся на материале.
- Полный `node scripts/mutation-gate.mjs --check` по всем 1452 определениям —
  не требовалось: `--changed=origin/dev..HEAD` уже покрывает все изменённые/
  затронутые определения (192) и единственный WARN совпадает с прежним
  (browser guards 313/200), новых не появилось.
- Применение мутаций `vacuum-physical-certification-infinite-line`,
  `wall-face-shared-cut-loses-own-carrier-cm`,
  `marker-save-click-forgets-baseline-before-result` через нормальный ночной
  раннер (`--execute-nightly`) и фактический `caught`-вердикт — это обязанность
  ночного полного прогона (#709), не ревью; вместо этого применил патчи двух
  геометрических мутантов вручную и подтвердил красный результат — этого
  достаточно для доказательства «тест умеет падать» на этом раунде.
- `pytest tests_backend` — Python не тронут, не прогонялся.
- `npm run invariants` — геометрия `src/**` не менялась (правки только в
  тестах/определениях мутантов), инвариантный гейт не применим к этому диффу.
- Свежесть скриншотов документации — не гейт задачи (#697).

## Вердикт

Зелёный. Все три заявленных AC доказаны исполнением, включая личное
воспроизведение красного состояния на обеих геометрических мутациях;
третья (marker Save) доказана structurally + чтением, фактическая поимка —
ночная обязанность по правилам track:show. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/887-nightly-witnesses`, коммит `b8c58d5ac8c7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8d48301c88391cd0ddce1453412782a07952e11b`
  ```
  git log --all --format='%H %T' | grep 8d48301c8839
  ```
- Тело issue: `97d2370f97c935ae8489ad05d681dcbf7f677a394d30eaa0144c3d8b4c969b89`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MDEsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4OCwib3V0cHV0X3Rva2VucyI6MTkxODgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODk0NDYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozNTE4Njg4LCJjb3N0VXNkRXN0aW1hdGUiOjEuMjUzNTc3NjAwMDAwMDAwM31dLCJ0dXJucyI6NTgsImR1cmF0aW9uTXMiOjM5Mzk3MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMjU4Mjc4NjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4689 output_tokens=19208 cache_creation_input_tokens=89446 cache_read_input_tokens=3518688 num_turns=58 -->
