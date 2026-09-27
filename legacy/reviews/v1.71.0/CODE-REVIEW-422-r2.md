# CODE-REVIEW-422-r2

- Issue: https://github.com/Matysh/houseplan-card/issues/422
- Ветка: `issue/422-capture-and-anchor-gates`
- SHA материала (сверен `git rev-parse HEAD`): `a1e1748b2de4ca8d056b751104ccad4c716bc595`
- Заход: r2, блокирующих циклов израсходовано 1 из 4
- Класс изменений: только B (`.github/**`, `demo/**`, `scripts/**`, `test/**`) —
  как и в r1, продуктового кода (`src/**`, `custom_components/**/*.py`) нет
- r1: `docs/reviews/CODE-REVIEW-422-r1.md`, вердикт красный на SHA `653b9a76`
  (High: 1, Medium: 2)

## Скоуп раунда

Разбор — по дельте (PROCESS.md §2.9): дельта локальна, продуктового кода не
касается, новой подсистемы не задевает, объём (4 файла, 3 коммита, ~300 строк,
почти все — новый тестовый файл) несопоставим с исходной задачей. Полный
повторный разбор не требуется.

```
git diff 653b9a76..HEAD --stat
 docs/images/screenshots.json           |   5 +-
 docs/reviews/CODE-REVIEW-422-r1.md     | 227 +++++++++
 scripts/mutation-gate.mjs              |  24 ++
 test/capture-determinism-gate.test.mjs |  50 +++
```

`docs/reviews/CODE-REVIEW-422-r1.md` — это сам r1-документ, положенный в дерево
шагом публикации; предмет разбора не он, а три содержательных файла.

Коммиты дельты: `74ad675a` (публикация r1-документа), `0f516116` (юниты + два
мутанта на `capture-determinism.mjs`), `a1e1748b` (исправление отпечатка
скрипта). Трейлеры всех трёх — `Issue: #422`, `User-Visible: no` — на месте;
поведения продукта дельта не меняет, changelog не тронут — верно.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (блокирует) — `captureScriptSha256` в манифесте не совпадает с реальным хешем `demo/docs/capture.mjs`, `check-docs.mjs` красный | Коммит `a1e1748b` заменил `12eb99bc095f…` на `cadb8e1bcab9…` | Я лично пересчитал `sha256sum demo/docs/capture.mjs` на HEAD — `cadb8e1bcab9f1dcdd7d75b3b90ddcbaaeb2b8c2a098f575a21f39ff70f5c59c`, совпадает с манифестом байт-в-байт; `node scripts/check-docs.mjs` → `Documentation checks passed (7 files, 10 external links)` |
| **M2** (в скоупе) — у нового гейта (`frameHashes`/`driftBetweenRuns`) не было ни юнита, ни мутанта | Добавлен `test/capture-determinism-gate.test.mjs` (5 тестов) и два мутанта (`capture-gate-forgives-a-missing-frame`, `capture-gate-hashes-everything-in-the-folder`) в `scripts/mutation-gate.mjs:959-982` | Прогнал сам: `node --test test/capture-determinism-gate.test.mjs` → 5/5 pass; `node scripts/mutation-gate.mjs --id=capture-gate-forgives-a-missing-frame` и `--id=capture-gate-hashes-everything-in-the-folder` → оба «покраснел, как обязан», поймано 1 из 1 каждый; `--check` → все мутанты реестра чистые, `FAIL` нет |
| **M2** (остаточная часть — формальное AC2-доказательство мутантом, что старый `--stability=3` остаётся зелёным на дефекте класса #410) | Автор привёл ручной эксперимент вместо мутанта: временно снят `--disable-partial-raster` (реинкарнация #424), обе проверки прогнаны на одной сборке — `--stability=3` зелёная 3/3, `capture-determinism.mjs` красный 3/5 | Только со слов автора в комментарии issue (конкретные хеши `06-device-editor.png: a13536d93f ≠ 46646e27b7`, счёт 3 из 5) — не переисполнял, см. «Чего не проверял». Принимаю как достаточное: дрейф стохастический по признанию автора же (3 из 5, не 5 из 5), автоматический мутант на таком дефекте был бы флаки по конструкции — ручное измерение здесь адекватнее синтетического мутанта, тем же путём в r1 было принято живое доказательство AC1 через инцидент #424 |
| **M1** (в скоупе) — AC8 требует числа «разница до/после» в issue, числа не было | В комментарии r2 названо: одиночная съёмка 17 350 мс, гейт (две съёмки) 34 614 мс, разница +17,3 с | Текст issue, комментарий «r1 → все три находки закрыты» — ровно то, что AC8 требует буквально («доказательство: … разница названа в issue числом»); повторный замер не делал — таймингом с CI/своей среды я бы получил другое число не по вине автора, важна форма доказательства, а её AC8 определяет как «названо в issue» |

## Унаследовано из r1

Без повторной проверки — дельта этих мест не касается, дельта на них не влияет:

- **AC3** (внутрипроцессная проверка `--stability` сохранена) — `docs/reviews/CODE-REVIEW-422-r1.md`, SHA `653b9a76`.
- **AC4** (целочисленная обрезка, `demo/docs/clip.mjs`) — там же; `test/capture-clip.test.mjs` дельтой не тронут.
- **AC5/AC6/AC7** (достижимость якоря вместо наличия, старое поведение #414 не сломано, тип объекта через `cat-file -t`) — там же; `scripts/review-doc-guard.mjs` и `test/review-doc-guard.test.mjs` дельтой не тронуты (нет в `git diff 653b9a76..HEAD --stat`).
- **AC9** и комментарий о порядке шагов в `docs-screenshots.yml` — там же; файл дельтой не тронут.
- **Класс файлов B, маршрут с ТЗ для инфраструктурной задачи** — принято ревью ТЗ r1 (`docs/reviews/SPEC-REVIEW-422-r1.md`) со ссылкой на прецеденты #398/#399/#404.
- **AC1 (позитив)** — живой кросс-прогонный гейт зелёный на исправленном дереве (10/10), красный на дефекте #424 в реальном CI — из r1.
- **L1** (снято с записью, формулировка «третий прогон» в комментарии `docs-screenshots.yml`) — дельта файл не трогает, статус не меняется.

## Как проверялось (дельта)

| Гейт | Команда | Результат |
|---|---|---|
| Причина H1 | `git show 653b9a76:demo/docs/capture.mjs \| sha256sum` vs манифест на том SHA | подтверждено: `12eb99bc…` (манифест) ≠ `cadb8e1b…` (файл) — дефект был реальным |
| H1 закрыт | `sha256sum demo/docs/capture.mjs` на HEAD vs `docs/images/screenshots.json` | совпадают: `cadb8e1bcab9f1dcdd7d75b3b90ddcbaaeb2b8c2a098f575a21f39ff70f5c59c` |
| `check-docs.mjs` | `node scripts/check-docs.mjs` | **зелёный**: `Documentation checks passed (7 files, 10 external links)` |
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit-тесты | `npm test` | **1770 pass / 0 fail / 1 skipped** (1771 всего) — рост ровно на 5 против r1 (1765), совпадает с новым файлом `test/capture-determinism-gate.test.mjs` |
| Build + сверка бандлов | `npm run build && npm run bundle:sync`, `cmp` трёх копий | `dist` = `custom_components/houseplan/frontend` = `demo/srv/assets`, побайтово; рабочее дерево чистое после |
| Новый юнит-файл отдельно | `node --test test/capture-determinism-gate.test.mjs` | 5/5 pass |
| Оба новых мутанта (умеют падать) | `node scripts/mutation-gate.mjs --id=capture-gate-forgives-a-missing-frame`, `--id=capture-gate-hashes-everything-in-the-folder` | оба «покраснел, как обязан», поймано 1 из 1 |
| Реестр мутантов согласован с кодом | `node scripts/mutation-gate.mjs --check` | все мутанты (включая 4 из этой задачи) чистые, `FAIL` нет |
| Выбор браузерных смоков | `node scripts/smoke-select.mjs --base 653b9a76 --head HEAD` | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — дельта не трогает `src/**` |

**Не прогонялось и почему:**
- Полный `docs-screenshots.yml` через `workflow_dispatch` — недоступен из
  ревью-сессии, как и в r1; `check-docs.mjs` локально воспроизводит именно ту
  проверку, что была красной в H1, и теперь зелёная.
- Ручной AC2-эксперимент автора (снятие `--disable-partial-raster`, 5 живых
  прогонов реального Chromium) — не переисполнял: дорого (реальный браузер,
  многократный прогон), дефект стохастический по признанию автора, а числа в
  комментарии достаточно детальны (конкретные хеши, счёт 3/5 и 3/3), чтобы не
  быть голословным «Verified». См. таблицу закрытия M2 выше.
- `npm run golden:verify`, `python -m pytest tests_backend`,
  `node scripts/model-invariants.mjs` — как и в r1, не тронуты соответствующие
  поверхности (визуальный результат карточки, backend, геометрия/`layout`/
  толщина стен/`marker.space`/`open_spans`).
- Единый источник числа: новое видимое-инженеру число этой дельты (`+17,3 с`,
  AC8) существует только в тексте issue-комментария, нигде не задокументировано
  повторно (`docs/TESTING.md` дельтой не тронут, других упоминаний нет) —
  дублирования нет, проверять нечего.

## Находки

Новых находок в дельте нет. Все три находки r1 (H1, M1, M2) закрыты — см.
таблицу выше. L1 (Low, снято с записью в r1) дельтой не задет.

## Проверено и корректно

- `docs/images/screenshots.json`: помимо исправленного `captureScriptSha256`,
  дельта добавляет `lastWriteWasFingerprintOnly: true` в блок `acceptance` —
  это существующее, ранее принятое поле из #421/#406 (`scripts/docs-accept.mjs:107`,
  `acceptedDocsManifest`), а не изобретённое здесь; значение верно отражает,
  что вторая приёмка не заменила ни одного PNG (`decision.replace.length === 0`).
- Оба новых мутанта содержательны, не тавтологичны: `capture-gate-forgives-a-missing-frame`
  бьёт по `[...new Set([...Object.keys(first), ...Object.keys(second)])]` →
  `Object.keys(first).filter((name) => name in second)` (пропавший кадр
  перестаёт быть расхождением); `capture-gate-hashes-everything-in-the-folder`
  снимает фильтр `.png` (манифест и посторонние файлы начинают участвовать в
  сравнении). Оба реалистичны как регрессии, а не искусственны.
- Трейлеры всех трёх коммитов дельты корректны, User-Visible: no согласуется
  с отсутствием изменений в `src/**`.

## Чего не проверял

- Полный `docs-screenshots.yml` (`workflow_dispatch`) на этом SHA — нет прав
  на диспетчеризацию из ревью-сессии.
- Ручной AC2-эксперимент автора живьём — см. обоснование выше и в таблице
  закрытия M2.
- `python -m pytest tests_backend`, `npm run golden:verify`,
  `node scripts/model-invariants.mjs` — соответствующие поверхности дельтой
  не тронуты.
- Всё, что помечено «унаследовано из r1» выше — не пересматривал, дельта
  этих мест не касается.

## Материал раунда

<!-- material-anchors: заполняется шагом публикации -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/422-capture-and-anchor-gates`, коммит `a1e1748b2de4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a9d1c98804b0f2457188f91464b4c93d9fa4474d`
  ```
  git log --all --format='%H %T' | grep a9d1c98804b0
  ```
- ТЗ `docs/specs/422-capture-and-anchor-gates.md`, блоб `797df838584f268fb2f1e99a41b5dad15088d698`
  ```
  git log --all --find-object=797df838584f268fb2f1e99a41b5dad15088d698 -- docs/specs/422-capture-and-anchor-gates.md
  ```
