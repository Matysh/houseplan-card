# SPEC-REVIEW-847-r2

Issue: #847 · Этап: spec · Заход: r2 · Трек: ask, P2 · Материал: тело issue #847,
«ТЗ» редакция 2 от 14.10.2026 + разделы «Дельта r2» / «Унаследовано из r1»
(`bodyDigest` из REVIEW_CONTEXT совпадает с прочитанным телом) · SHA рабочей
копии: `1cabb5a5f45587ff69fb87fa4072513bf8f53d47` (используется только для
сверки кода, на который ссылается ТЗ; само ТЗ живёт в теле issue).

## Скоуп

Не изменился с r1: lifecycle удержания маркера устройства в View/kiosk на
touch и мышью (отмена, отпускание рядом, потеря фокуса, уход в фон, смена
пространства, отключение), соседний дефект `TouchGestureClickGuard` (D9,
защитно) и таймер растворения солнечных лучей на отключённом экземпляре
(D8). Этот раунд дополнительно вводит в скоуп: явный путь `pagehide` в общем
механизме видимости (`src/visual-continuity.ts`) и пару рискованных
native-сценариев F84/F86 (второй контакт после `lostpointercapture`,
touch-`contextmenu` после hold/navigation) как новый AC9. Не-скоуп не
изменился (см. SPEC-REVIEW-847-r1).

## Как проверялось

- Прочитаны заново `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`
  (раздел «Повторный раунд» — предмет раунда это дельта, обязателен раздел
  «Унаследовано», неизменные решения не перепроверяются).
- Прочитан `SPEC-REVIEW-847-r1.md` целиком (документ прошлого раунда,
  материал `2145262c19a0`) и вердикт-комментарий `#847` от
  `github-actions[bot]` (id 6177486456) — источник находок M1/M2.
- Прочитано полное текущее тело issue #847, включая новые разделы «Дельта
  перед S4» (без изменений с r1) и «Дельта r2» (новое). Прочитаны все 7
  комментариев через `gh api repos/Matysh/houseplan-card/issues/847/comments`:
  аналитика, вопрос/ответ владельца «1а», повторная сверка F84/F86, два
  авторских handoff-комментария (один — после r1, один — после публикации
  редакции с «Дельта r2») и вердикт r1. Новых продуктовых вопросов или
  владельческих решений после r1 нет — ровно то, что заявляет «Дельта r2».
- Построчно сверены формулировки AC4, AC6, новый AC9, «Файлы и модули»,
  «Производительность и touch» против текста находок M1 и M2 из r1 (см.
  «Закрытие раунда r1» ниже) — предмет дельты.
- Проверено по дереву репозитория на материале `1cabb5a5…`:
  - `git diff --stat 2145262c19a0..HEAD -- src/visual-continuity.ts
    src/touch-gesture-click-guard.ts src/kiosk-hold.ts src/pointer-modality.ts
    src/houseplan-card.ts src/houseplan-editor-runtime.ts` — пусто: ни одна
    из поверхностей, на которые ссылается ТЗ (включая D1–D9 построчный
    разбор, уже сверенный в r1), не менялась между материалом r1 и текущим
    материалом; повторная построчная сверка D1–D9 не нужна (§2.10, пригодный
    неизменившийся check);
  - прочитан `src/visual-continuity.ts:1-135` целиком: `subscribePageVisibility`
    по-прежнему слушает только `visibilitychange` и `pageshow` (строки
    106–107), слушателя `pagehide` нет — подтверждает и находку M1 из r1, и
    то, что план «добавить отсутствующую подписку на window pagehide» в
    «Дельта r2»/«Производительность и touch» описывает реальный пробел, а не
    то, что уже сделано кем-то другим;
  - проверено, что `onPageShow` уже несёт `persisted`-флаг и уже трактует
    `persisted` как `long`-сигнал (`visual-continuity.ts:93-103`) — заявление
    «Порог long-hidden, pageshow persisted… не меняются» и план
    «нормализовать pagehide в прежний hidden-сигнал» согласуются с формой
    существующего типа `PageVisibilitySignal`, это не произвольная выдумка;
  - `test/visual-continuity.test.mjs` существует (новая ТЗ-строка «Файлы и
    модули» называет его местом для idempotent hidden/pagehide тестов —
    файл для расширения, не фантомное имя); `demo/smoke_view_hold_lifecycle.mjs`
    не существует — ожидаемо для этапа spec (новый файл реализации);
    `scripts/mutation-registry.mjs` существует;
  - сверена `docs/TOUCH-SUPPORT.md:39-55` — строки «cancellation tails must
    stay inert» и «remain usable after backgrounding… warm remount»
    дословно совпадают с тем, что уже проверено в r1, без изменений;
  - `docs/release-ledger/v1.80.1/` существует, `CARD_VERSION =
    '1.81.0-beta.2'` (`houseplan-card.ts:324`) — путь `v1.80.1/847.json` в
    ТЗ остаётся верным;
  - `gh issue view 847` — метки `S4-spec-review`, `track:ask`, `P2`,
    состояние `OPEN`, совпадает с ожиданием.
- Гейты полных тестов/сборки не гонялись: `node_modules` отсутствует
  (проверено `ls node_modules` → нет каталога) — зависимости на этапе spec не
  ставятся (#696), `npx tsc`/`npm test`/`npm run build` здесь неприменимы и
  не являются пропущенным гейтом. Это то же состояние, что в r1, дельта его
  не меняет.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — контракт обещает `pagehide`, но ни один AC, план тестов или «Файлы и модули» не называют точку подключения и доказательство | AC4 получил явный подпункт «(г) pagehide без предшествующего hidden, затем pageshow(persisted); повтор hidden+pagehide идемпотентен» с доказательством «pagehide/pageshow(persisted) — явно dispatched PageTransitionEvent…, unit shared subscribe/disposal»; AC6 получил «эмуляция hidden→visible и отдельно dispatched pagehide→pageshow(persisted) без visibilitychange»; «Файлы и модули» теперь прямо называет точку подключения — `src/visual-continuity.ts` («shared pagehide listener/normalisation и removal вместе с last unsubscribe») и `test/visual-continuity.test.mjs` («idempotent hidden/pagehide, persisted pageshow, multi-instance/disposal»); «Производительность и touch» формулирует семантику нормализации явно: «Pagehide нормализуется в прежний hidden-сигнал… сочетание hidden+pagehide идемпотентно» | Тело issue, разделы «Критерии приёмки» (AC4, AC6), «Файлы и модули», «Производительность и touch»; подтверждено чтением `src/visual-continuity.ts:41-119` — план ложится на существующую форму `PageVisibilitySignal`/`subscribePageVisibility`, не противоречит коду |
| **M2** — F84/F86 заявлены в «Дельта перед S4», но не привязаны ни к одному AC и не имеют способа доказательства | Новый **AC9** дословно формулирует оба сценария (F84 — второй контакт после lost capture не активирует marker/service; F86 — touch-contextmenu после hold/navigation не открывает второе more-info) с доказательством (unit TouchGestureClickGuard/hold owner + `demo/smoke_view_hold_lifecycle.mjs`, CDP два контакта, dispatched contextmenu) и непустой графой «чем краснеет» (два именованных мутанта); «План автотестов» добавил named cases «второй контакт после lost capture первого ещё нажатого; touch contextmenu после hold и после pan, затем настоящая мышь/keyboard работают» | Тело issue, строка «| AC9 | …» таблицы AC и раздел «План автотестов и гейтов» |

Обе находки закрыты по существу, не декларативно: формулировки конкретны,
привязаны к проверяемому критерию и способу доказательства, согласуются с
реальным состоянием кода (`visual-continuity.ts` действительно не имеет
`pagehide`, значит эмуляция через dispatched `PageTransitionEvent` на `dev`
действительно покраснеет).

## Унаследовано из r1

Документ [SPEC-REVIEW-847-r1](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/SPEC-REVIEW-847-r1.md),
материал `2145262c19a04e61da916253f909ffdd5ce08003`. Принято без повторной
проверки (неизменный текст и неизменный код по `git diff --stat` выше):
сценарий и «что человек увидит», скоуп/не-скоуп базового контракта, owner
decision «1а», удержание 600 мс, «свежее намерение — только событие» (без
новых таймингов), AC1–AC3/AC5/AC7/AC8 с их доказательствами и мутантами,
построчный разбор D1–D9 против кода, модель данных/миграция/compatibility
(«нет»/«не меняется»), i18n («новых ключей нет»), откат, release-артефакты
(`v1.80.1/847.json`, draft summary RU/EN), зависимость с #846 по
`_commitSpace`.

## Что проверено и корректно (помимо закрытия r1)

- «Дельта r2» и «Унаследовано из r1» — оба обязательных для повторного
  раунда раздела присутствуют в теле issue и точно описывают то, что
  действительно изменилось (сверено построчно, не нашёл ни одного
  расхождения между заявленным в «Дельта r2» и фактическим текстом AC4/
  AC6/AC9/«Файлы и модули»).
- AC9 — защитный AC с непустой графой «чем краснеет» (два мутанта: «потеря
  capture забывает ещё нажатый контакт и пропускает второй как tap»; «touch
  contextmenu игнорирует armed hold/navigation tail») и честной оговоркой
  «Реальная Android последовательность остаётся полевой гипотезой,
  synthetic smoke не выдаётся за её воспроизведение» — она была и в r1,
  трогать её не требовалось, и она не тронута.
- Изменения не вышли за заявленные «Дельта r2» границы: контракт поведения,
  UX, модель данных, release-артефакты, риски и откат — текстуально те же,
  что проверены в r1 (сверено построчно), новых скрытых изменений не нашёл.
- Открытых продуктовых вопросов нет; owner-решение «1а» не пересматривается
  этой редакцией — подтверждено последним авторским handoff-комментарием
  (id 6177577646) и отсутствием новых владельческих комментариев между r1 и
  текущим телом.

## Чего не проверял

- Не прогонял `npx tsc --noEmit`, `npm test`, `npm run build` — `node_modules`
  отсутствует, зависимости на этапе spec не ставятся (#696); продуктовый код
  этой задачи ещё не написан (этап spec). Это не пропуск гейта — гейт
  неприменим на этой стадии, то же, что в r1.
- Не проверял исполнением реальную доставку `pagehide`/`hidden`/потерянных
  terminal-событий и lost capture на живом мобильном браузере или Android —
  сам документ честно называет это полевой гипотезой (оговорка в AC9 и в
  «Дельта перед S4» не тронута и не требует проверки повторно).
- Не перечитывал построчно код `touch-gesture-click-guard.ts`,
  `kiosk-hold.ts`, `pointer-modality.ts` заново — `git diff --stat` против
  материала r1 пуст, построчная сверка уже выполнена в r1 и не стала
  неактуальной.
- Не проверял содержимое внешнего файла `findings-2026-10-08.md` — вне
  материала ревью (тело issue + комментарии), как и в r1.

## Вердикт

Зелёный. M1 и M2 закрыты по существу: AC4/AC6 получили точку подключения и
способ доказательства для `pagehide`, AC9 закрепляет F84/F86 проверяемым
критерием с мутантами. High нет, Medium нет. Дельта раунда не вышла за
заявленные границы, остальное ТЗ (проверено в r1) не тронуто. Бюджет
циклов не расходуется зелёным вердиктом: 1/4 израсходовано (не изменилось).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `1cabb5a5f455` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2059b689753d1b6164aa4ca10042272914144c23`
  ```
  git log --all --format='%H %T' | grep 2059b689753d
  ```
- Тело issue: `11b75ad542ee26712d6b4209f4e16da51ca9e4f987e75c57fd6cba3b80769d53`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQxMDIsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MTkxOTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDIsIm91dHB1dF90b2tlbnMiOjIyNzgyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjg2MDE4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTYxODg2NiwiY29zdFVzZEVzdGltYXRlIjowLjg5NTc0OTE5OTk5OTk5OTl9XSwidHVybnMiOjI5LCJkdXJhdGlvbk1zIjoyNjA3OTYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjg5OTk0MTE5OTk5OTk5OTksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4144 output_tokens=22800 cache_creation_input_tokens=86018 cache_read_input_tokens=1618866 num_turns=29 -->
