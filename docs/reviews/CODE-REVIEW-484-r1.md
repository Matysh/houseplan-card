# CODE-REVIEW-484-r1

Issue: [#484](https://github.com/Matysh/houseplan-card/issues/484) — PDF: внешняя размерная цепь теряет размеры ступенчатого фасада
ТЗ: [docs/specs/484-pdf-exterior-dimension-chain.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/specs/484-pdf-exterior-dimension-chain.md), ревью ТЗ [SPEC-REVIEW-484-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/SPEC-REVIEW-484-r1.md) — зелёный.
Ветка: `issue/484-pdf-exterior-dimensions`. Материал ревью: `git diff origin/dev...HEAD`, HEAD на момент вывода вердикта — `904b8b225159e61546aba9a1ad46f548a1b3f4db` (сверено непосредственно перед выводом, `git status` чист).
Заход: r1 (первый заход, разделов «Унаследовано»/«Закрытие r0» не требуется — §2.10 применяется со второго цикла).

## 1. Скоуп диффа

62 файла, ядро изменения — два продуктовых файла:

- `src/pdf/pdf-collision.ts` — новый opt-in режим `allowStartExit` в
  `pdfSegmentTouchesGeometry()`: собирает пересечения extension line с
  архитектурными rings в отсортированные breakpoints, ищет первый свободный
  интервал («выход из собственного узла») и после него красит любое
  касание/пересечение/overlap как коллизию.
- `src/pdf/pdf-scene.ts` — только две внешние extension lines (`entry.a→entry.oa`,
  `entry.b→entry.ob`) переведены с `allowStartBoundary` на `allowStartExit`;
  dimension line, shelf, labels и внутренние размеры остались на строгом пути.

Остальное — тесты (`test/pdf-collision.test.mjs`, `test/pdf-scene.test.mjs`,
`test/golden-matrix.test.mjs`), два обязательных мутанта в
`scripts/mutation-gate.mjs`, новый browser-смок кейс в `demo/smoke_pdf_export.mjs`,
привязка символов в `scripts/smoke-links.mjs`, golden-фикстура/сценарий
(`demo/golden/harness.mjs`, `demo/golden/matrix.mjs`, `demo/golden/run.mjs`,
новый эталон `pdf-export-stepped-dimensions-light` + два обновлённых
`pdf-export-geometry-light`/`pdf-export-polish-light`), документация
(`ARCHITECTURE.md`, `PDF-EXPORT.md`, `USER-GUIDE.md`/`.ru.md`, оба CHANGELOG,
`STATUS.md`, `docs/specs/README.md`) и пересобранный бандл/фингерпринт
скриншотов.

## 2. Как проверялось

| Гейт | Команда | Результат | Источник |
|---|---|---|---|
| typecheck+build | `npm run build` (= `tsc --noEmit && rollup -c`) | зелёный | прогнан лично на HEAD |
| unit — целевые | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="external dimension extension\|stepped exterior\|reconstructable dimension chain" test/pdf-collision.test.mjs test/pdf-scene.test.mjs test/golden-matrix.test.mjs` | 3/3 pass | прогнан лично |
| unit — полный набор + backend | — | не перегонял отдельно | зелёный Validate на точном SHA `904b8b22` (https://github.com/Matysh/houseplan-card/actions/runs/34151982086), см. условие сужения в задании ревью |
| мутант AC3 `pdf-own-exit-prefix-disabled` | `node scripts/mutation-gate.mjs --id=pdf-own-exit-prefix-disabled` | «тест покраснел, как обязан», 1/1 | прогнан лично |
| мутант AC4 `pdf-post-exit-collision-ignored` | `node scripts/mutation-gate.mjs --id=pdf-post-exit-collision-ignored` | «тест покраснел, как обязан», 1/1 | прогнан лично |
| смок (по `smoke-select.mjs`) | `node demo/smoke_pdf_export.mjs` (после `npm run bundle:sync`) | зелёный, `steppedExteriorKeepsCompleteDimensionChain: true`, 0 EXC, exit 0 | прогнан лично |
| `check-docs.mjs` | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 12 external links)» | прогнан лично |
| `golden:verify` | `npm run golden:verify` | зелёный, exit 0; отдельно подтверждены три PDF-сценария: `pdf-export-geometry-light` passed, `pdf-export-polish-light` passed, `pdf-export-stepped-dimensions-light` passed | прогнан лично дважды (второй раз — построчный лог) |
| model-invariants | — | не запускал | диф не трогает геометрию плана/сохранённую модель — только временную PDF-сцену коллизий поверх уже построенных `architectureRings`; §6.3/§8 ТЗ явно фиксируют read-only и отсутствие изменений модели |
| `pytest tests_backend` | — | не запускал | Python/бэкенд не тронуты (0 файлов `custom_components/**/*.py` в диффе) |
| performance-профили сверх стандартных | — | не запускал | диф не трогает `src/iso-*`, `src/live-*`, `src/render-*`, `houseplan-render-lifecycle.ts`, `houseplan-card.ts`; названный в AC6 бюджет `<200 ms` проверяется существующим неизменённым тестом `test/pdf-scene.test.mjs:618` («current 20-room large-house space builds... under 200 ms»), покрыт зелёным полным прогоном `test` в Validate на точном SHA |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` вернул ровно одну
**зарегистрированную связь** — `demo/smoke_pdf_export.mjs`, объявленную через
символы `pdfSegmentTouchesGeometry`, `SegmentIntersection`, `segmentIntersection`,
`COORDINATE_EPSILON`, `PdfCollisionPoint`, `forEachRingSegment`, `pointOnSegment`,
`segmentParameter` (добавлены автором в `scripts/smoke-links.mjs` этим же диффом).
Других смоков (из 229 в дереве) diff не касается — прогон одного соответствует
объёму задачи (изменение локально для `src/pdf/**`).

## 3. Разбор по AC

- **AC1** (полная цепь ступени, оба winding) — доказано `test/pdf-scene.test.mjs`
  «stepped exterior keeps the complete reconstructable dimension chain»: цикл по
  `[step, [...step].reverse()]`, точные значения `1.20/2.40/3.60/3.75` присутствуют
  для обоих обходов. Прогнано лично, зелёный.
- **AC2** (единственность глубины, dedup, без диагонали) — тот же тест:
  `values.filter(v => v === '1.20 m').length === 1`, `values.length === 6`
  (4 внешних + общие width/height), `command.angle % 90 < 1e-8` для всех подписей.
  Зелёный.
- **AC3** (разрешённый начальный выход) — `test/pdf-collision.test.mjs` покрывает
  коллинеарный выход вдоль примыкающей ступени, выход через тело инцидентной
  стены (квадрат), сегмент, не достигающий свободного участка (fail closed), и
  ограничение исключения только сегментами, реально стартующими на своей
  границе. Защитный мутант `pdf-own-exit-prefix-disabled` красит тест при
  отключении режима — проверено лично, эффект подтверждён.
- **AC4** (запрет повторного входа после выхода) — тот же файл: второй wall
  после первого свободного интервала (`combinedSolid`, солид-коллизия) и
  касание постороннего угла без солид-интервала (`stepSolid`-only, точечное
  касание за счёт финальной проверки `hits.some(hit.t > exitT...)`) — оба дают
  `true`. Защитный мутант `pdf-post-exit-collision-ignored` красит тест при
  отключении финальной проверки — проверено лично, эффект подтверждён.
  Разобрано и по коду (см. §4 ниже) — механизм state-machine «префикс → выход →
  любое дальнейшее касание» соответствует §6.2 ТЗ построчно.
- **AC5** (label/dimension line/shelf/внутренние размеры не изменились) —
  проверено чтением: `grep -n "segmentTouchesArchitecture" src/pdf/pdf-scene.ts`
  показывает ровно один вызов (для двух extension lines внешнего размещения);
  `allowStartExit` не используется больше нигде в `src/pdf/pdf-scene.ts`;
  `allowStartBoundary` для внешних сегментов заменён полностью (не оставлен как
  мёртвый код), а как публичный API `pdfSegmentTouchesGeometry` со старым
  поведением по-прежнему покрыт своими исходными тестами (не тронуты этим
  диффом). Внутренние размеры комнат этот collision-helper вообще не вызывают.
- **AC6** (winding-независимость, детерминизм, `<200 ms`) — winding-цикл в
  AC1-тесте покрывает независимость от обхода; perf-бюджет — существующий
  неизменённый тест, зелёный в Validate на точном SHA.
- **AC7** (визуальное присутствие цепи в PDF) — двойное доказательство:
  browser-смок `demo/smoke_pdf_export.mjs` реально скачивает PDF из карточки в
  Chromium, разбирает через `pdfjs-dist` и проверяет присутствие всех шести
  подписей (`1.20/2.40/3.60/3.75/7.35/9.75 m`) — прогнано лично, зелёный; golden
  `pdf-export-stepped-dimensions-light` с `pdfSemantic.requiredDimensionLabels`
  и `forbiddenText` — прогнано лично (`golden:verify`), passed.
- **AC8** (документация, changelog, docs/golden fingerprints) — оба CHANGELOG
  ссылаются на #484 в одном коммите с кодом (`e88ef93c`), `PDF-EXPORT.md` и
  `ARCHITECTURE.md` описывают узкий source-exit контракт словами, совпадающими
  с §6.2 ТЗ, `USER-GUIDE.md`/`.ru.md` формулируют пользовательское обещание.
  `check-docs.mjs` зелёный. Скриншот-фингерпринт обновлён отдельным коммитом
  `7b826c19` с трейлером `Baseline-Reviewed: <ссылка на прогон>` — пиксели
  десяти doc-кадров не изменились (`decision.replace.length === 0`,
  `lastWriteWasFingerprintOnly: true`), что ожидаемо: правка изолирована в PDF
  export collision-геометрии и не задевает ни один из синтетических doc-сценариев.

## 4. Разбор ключевой логики чтением (без исполнения, дополнительно к тестам)

Прочитан построчно новый ветвь `allowStartExit` в `pdfSegmentTouchesGeometry()`
(`src/pdf/pdf-collision.ts:168-208`). State machine:

1. Если старт не на границе архитектуры — `true` (нет смысла в исключении, fail closed).
2. Собираются все пересечения `start→end` с рёбрами всех rings (`hits`), включая
   точечные касания (`t === endT`) и коллинеарные перекрытия (`overlap: true`,
   диапазон `[t, endT]`).
3. Отрезок делится на интервалы по отсортированным уникальным breakpoints
   (`0, 1, hit.t…, hit.endT…`, схлопнутым с `parameterEpsilon`); каждый интервал
   помечается «blocked», если его середина внутри `isSolid` или внутри
   collinear-overlap.
4. Идёт слева направо: пока не найден первый свободный интервал — копится
   «собственный префикс» (не важно, что именно его блокирует — коллинеарный
   участок примыкающей грани или солид инцидентной стены, оба разрешены §6.2);
   как только `exitT` найден — любой следующий blocked-интервал даёт `true`.
5. Если свободного интервала не нашлось вовсе — `true` (line 206, буквально
   реализует «линия, которая так и не получает свободного участка» из §6.2 —
   fail closed).
6. Финальная строка (207-208) ловит случай, который шаг 4 пропускает: точечное
   касание постороннего угла ПОСЛЕ выхода, не создающее blocked-интервал (обе
   соседние середины остаются свободны), но являющееся касанием по существу —
   `hits.some(hit.t > exitT || hit.endT > exitT)`. Именно этот путь проверяет
   тест «a later point contact remains a collision even without a solid
   interval», и именно его выключает мутант `pdf-post-exit-collision-ignored`.

Прослежено вручную на fixture из ТЗ/бага (`(10,3)→(16,3)` вдоль ступени
`(0,0)→(10,0)→(10,3)→(12,3)→(12,6)→(10,6)→(10,10)→(0,10)`): начальный коллинеарный
перекрыв с ребром `(10,3)-(12,3)` даёт blocked-префикс `[0, 0.333]`, `exitT=0.333`,
после чего свободно до конца — линия принимается без коллизии, что и требуется
для восстановления глубины выступа. Согласуется с зелёным `AC1`/`AC3`-тестами.

Существенных расхождений между кодом, ТЗ §6.2 и текстом issue не найдено.

## 5. Находки

Находок High или Medium нет. Two Low-замечания, ни одно не блокирует и не
требует правки:

1. **Low.** Комментарий в `pdf-collision.ts:204-205` объясняет назначение
   финальной проверки, но не называет её отдельно как «point-contact
   detector» — при последующей правке этой функции легко принять её за
   дублирование шага 4 и удалить как «мёртвый код», сломав ровно тот случай,
   который ловит мутант `pdf-post-exit-collision-ignored`. Не блокирует: тест и
   мутант физически предотвращают тихую регрессию, комментарий — не более чем
   удобство чтения. Оставляю как есть, автор/ревьюер могут усилить комментарий
   по желанию, отдельного цикла это не заслуживает.
2. **Low.** `docs/images/screenshots.json` получил `"acceptedOn": "win32"`
   вместо `"linux"` в этом же диффе (коммит `7b826c19`, `Baseline-Reviewed`
   указывает на CI-прогон). Механизм `#401/#455` (`scripts/docs-accept.mjs`)
   намеренно допускает приёмку с любой машины при условии совпадения
   witness-хешей с уже закоммиченными кадрами — это не нарушение процесса, а
   штатный путь «fingerprint-only» accept (ни один из 10 PNG не заменён:
   `lastWriteWasFingerprintOnly: true`). Отмечаю только потому, что поле смены
   платформы бросается в глаза при чтении диффа; проверка (`check-docs.mjs`)
   зелёная, разбирать глубже не требуется.

## 6. Что проверено и корректно

- Контракт `allowStartExit` реализует именно ту state machine, которую
  описывает §6.2 ТЗ, включая fail-closed при недостижимости свободного участка
  и защиту от post-exit re-entry (в т.ч. точечных касаний).
- `allowStartBoundary` (старое поведение) не удалён и не изменён — используется
  собственными старыми тестами и остаётся доступным API; ни один существующий
  вызывающий код кроме двух extension lines не переключён на `allowStartExit`.
- AC1/AC2 подтверждены точными числовыми значениями на fixture из issue, для
  обоих направлений обхода ring.
- Оба обязательных защитных мутанта (AC3, AC4) реально красят целевой тест при
  снятии соответствующей защиты — проверено запуском, а не по описанию.
- Browser smoke реально качает PDF из собранного бандла (`dist` → `bundle:sync`
  → demo stand) и разбирает его `pdfjs-dist`, а не читает внутреннее состояние
  — сквозной путь до реального артефакта.
- `golden:verify` (полный матрикс, обязателен процессом — частичный запуск
  инструмент отвергает) зелёный, включая обновлённые/новый PDF-эталоны.
- Документация (оба changelog, PDF-EXPORT.md, ARCHITECTURE.md, USER-GUIDE и
  .ru.md, STATUS.md, specs/README.md) согласована с контрактом ТЗ и терминологией
  USER-GUIDE.ru.md.
- Traceability: `Issue: #484` и `User-Visible` есть на всех коммитах диапазона;
  оба changelog правились в одном коммите (`e88ef93c`) с поведенческим фиксом.

## 7. Чего не проверял и почему

- Полный `npm test`/`npx tsc --noEmit` отдельно от `npm run build` — не
  перегонял: Validate зелёный на точном SHA `904b8b22`
  (https://github.com/Matysh/houseplan-card/actions/runs/34151982086), что по
  условию задания достаточно для этой пары дешёвых гейтов; `build` всё же
  прогнал лично (нужен был живой `dist` для смока).
- `python -m pytest tests_backend` — не запускал, диф не касается
  `custom_components/**/*.py`.
- `node scripts/model-invariants.mjs` — не запускал: диф не меняет геометрию
  плана, `layout`, `marker.space`, `open_spans` или записи толщины стен; PDF
  export работает поверх уже готовой read-only сцены и не пишет обратно в
  модель (подтверждено §8 ТЗ и чтением: изменения ограничены `pdf-collision.ts`
  /`pdf-scene.ts`).
- 228 из 229 файлов `demo/smoke_*.mjs`, не названных `smoke-select.mjs` и не
  упомянутых в AC, — не прогонял: diff не расширяется дальше PDF-экспорта,
  полный прогон — предрелizный гейт (§8 PROCESS.md), не гейт ревью.
- Performance-профили `large-house-isometric-v1`/`large-house-interaction-v1` —
  не запускал: правка не трогает `src/iso-*`/`src/live-*`/`src/render-*`
  /`houseplan-render-lifecycle.ts`/`houseplan-card.ts`, названные в §8 условия
  их подключения к Validate не выполняются.
- Живой снимок скринов документации (`npm run docs:accept`) — не переснимал:
  `check-docs.mjs` уже зелёный на текущем fingerprint, коммит `7b826c19` уже
  содержит доказательство (`Baseline-Reviewed`).

## 8. Вердикт

Зелёный. Все 8 AC доказаны автотестом (с проверенной способностью падать через
два обязательных мутанта) либо разобраны чтением там, где защита тривиальна
(AC5 — отсутствие новых вызовов). High: 0. Medium: 0. Low: 2, обе сняты без
правки с записью выше (п. 5).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/484-pdf-exterior-dimensions`, коммит `904b8b225159` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0b96360647a80380beab99dba4225b3f72556d30`
  ```
  git log --all --format='%H %T' | grep 0b96360647a8
  ```
- ТЗ `docs/specs/484-pdf-exterior-dimension-chain.md`, блоб `84fb3a65e309f90c2c8c149b6f7bb4f6bf876f4d`
  ```
  git log --all --find-object=84fb3a65e309f90c2c8c149b6f7bb4f6bf876f4d -- docs/specs/484-pdf-exterior-dimension-chain.md
  ```
