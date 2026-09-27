# CODE-REVIEW — issue #601, заход r1

Материал: `a551af9219083b2828cc2d840a22f5105d526bad` (единственный коммит поверх `dev`=`57572d8c`).
Класс изменений: B (`.github/workflows/**`, `scripts/**`, `test/**`) + C (`PROCESS.md`, `AGENTS.md`, `docs/TESTING.md`) — ни одного файла класса A, маршрут «инфраструктура» подтверждён.
`User-Visible: no`, `Issue: #601` — трейлеры на месте, changelog не требуется (изменение не задевает продукт).

## Скоуп

Мутанты по диффу (`changed_mutants` в `validate.yml`) сужаются с пяти точек запроса (кандидат ревью, кандидат слияния, кандидат беты `Release:`, `workflow_dispatch full=true`, PR) до трёх: кандидат ревью, кандидат слияния, PR. Кандидат беты и `full=true` больше не тянут mutant-job — обоснование владельца: к бете задача уже прогнана мутантами дважды (ревью + слитый после ребейза кандидат), а ночь покрыта полным реестром `mutation-gate.yml`. Симметрично меняется политика `release` в `ci-proof.mjs` (`mutants: false`), иначе proof кандидата беты без запрошенных mutant-jobs объявлялся бы `stale`.

Вне docs/SCOPE.md — чисто инфраструктурное решение о структуре CI, продуктового поведения не касается.

## Как проверялось

**Материал уже на a551af92, git fetch/checkout не делал.**

1. Прочитан полный `git diff origin/dev...HEAD` (10 файлов, +147/-45) — построчно, все хунки.
2. Прочитано тело issue #601 и комментарий-хендофф автора (SHA, таблица AC↔доказательство, перечень непрогнанного).
3. `scripts/classify-changes.mjs` и `scripts/ci-proof.mjs` прочитаны целиком, не только дифф — проверена согласованность сигнатур и мест вызова.
4. Точечные прогоны (Validate на этом SHA уже зелёный по ссылке из инструкции — `npx tsc`/`npm test`/`npm run build` не перегонял):
   - `node --test --test-name-pattern="#510" test/classify-changes.test.mjs` — pass;
   - `node --test --test-name-pattern="#601" test/classify-changes.test.mjs` — pass;
   - `node --test test/ci-proof.test.mjs test/classify-changes.test.mjs` — 38 pass, 0 fail;
   - `node --test test/release-gate.test.mjs test/merge-candidate.test.mjs test/validate-gate.test.mjs` — 38 pass, 0 fail (эти три потребителя `CI_PROOF_POLICIES`/`mutantsRequested` диффом не тронуты — `git diff --stat` по ним пуст, подтверждено).
5. Дисциплина «тест умеет падать» — прогнаны все четыре заявленных мутанта реальным `node scripts/mutation-gate.mjs --id=<id>`, а не по слову автора:
   - `mutants-run-on-every-push` → поймано 1 из 1;
   - `mutants-run-on-beta-candidate` → поймано 1 из 1;
   - `mutants-run-on-full-dispatch` → поймано 1 из 1;
   - `release-proof-demands-mutant-jobs` → поймано 1 из 1.
6. Сверены места вызова `mutantsRequested` — единственный вызов в `scripts/classify-changes.mjs:172` (CLI), сигнатура (`{eventName, mutantsInput}`) согласована с телом функции; лишние поля (`headMessage`, `fullInput`), которые CLI по-прежнему передаёт, просто игнорируются деструктуризацией — не баг.
7. Проверено, что `validate.yml` не имеет `on: schedule:` — ветка `schedule` в `mutantsRequested` действительно была мёртвой, её удаление безопасно (issue сам это утверждает, подтверждено чтением workflow).
8. Проверено, что явный `mutants=true` дёргают только `scripts/merge-candidate.mjs:161` и `scripts/validate-gate.mjs:136` (кандидат слияния и кандидат ревью) — оба файла вне диффа, поведение конвейера ревью/слияния не меняется.
9. Проверена документация: `PROCESS.md` правка лежит внутри §10.4 (заголовок на строке 930, правка на 962–971) — соответствует AC5; `docs/TESTING.md`, `AGENTS.md`, комментарий `mutation-gate.yml` — все называют #601 и новый список мест.
10. `git diff --stat` подтверждает 0 файлов `src/**` — `node scripts/check-docs.mjs` (гейт свежести скриншотов документации) не требуется.

## Находки

Нет. Ни High, ни Medium.

## Что проверено и корректно

- AC1 (`mutantsRequested`): все пять исходов из AC воспроизведены тестом и вручную прочитаны в коде — `push+Release:` → false, `workflow_dispatch full=true,mutants=false` → false, `workflow_dispatch mutants=true` → true, `pull_request` → true, обычный push → false. Мутанты `mutants-run-on-every-push` и `mutants-run-on-beta-candidate` реально красят тест при отмене этого поведения (проверено исполнением, не чтением).
- AC2 (`heavyGatesRequested` не изменился): дифф не касается этой функции; тест `heavy=true\nmutants_requested=false` для `Release:`/`full=true` проходит.
- AC3 (`evaluateCiProof` с политикой `release`): `mutants: false` не ослабляет `review`/`merge` — единственное место чтения политики (`ci-proof.mjs:294`, `if (policy?.mutants && !asBool(...))`) прочитано и подтверждено; тест «#601 AC3» покрывает все три политики явно; мутант `release-proof-demands-mutant-jobs` красит тест при регрессии.
- AC4 (`merge-candidate.mjs`/`validate-gate.mjs` не тронуты): подтверждено пустым `git diff --stat` по обоим файлам и их тестам; мутант `mutants-run-on-full-dispatch` перепроверяет смежную ветку.
- AC5 (документы называют оба места и #601): подтверждено чтением всех четырёх файлов, включая номер параграфа PROCESS.md.
- Продуктовое рассуждение: решение сокращает дорогой, но малоинформативный к моменту беты гейт (тесты уже дважды промутированы к этой точке), не ослабляя требование для ревью и слияния — риск регрессии тестового покрытия к релизу не растёт, а критический путь короче. Согласуется с прежним решением по #513 («мутационный гейт проверяет не продукт, а тесты»).

## Чего не проверял и почему

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` со сверкой бандла — не гонял: Validate на этом SHA уже зелёный (ссылка в инструкции ревью), `src/**` диффом не тронут.
- `node scripts/check-docs.mjs` — не требуется, `src/**` вне диффа.
- Инварианты модели (`npm run invariants`) — не требуются, геометрия/`layout`/толщины стен диффом не тронуты.
- Браузерные смоки `demo/smoke_*.mjs` и `npm run golden:verify` — не требуются, диф не касается рендера/UI, продукт не меняется (`User-Visible: no`).
- `python -m pytest tests_backend` — не требуется, `custom_components/**/*.py` не тронут.
- Полный `node --test` по всему `test/**` — не перегонял отдельно от точечных файлов; Validate уже подтвердил зелёный прогон на этом SHA (2795 pass по хендоффу автора, независимо проверять весь набор избыточно при таком узком диффе).

## Вердикт

Зелёный. Диф соответствует AC дословно, все мутанты, названные автором, реально ловятся (проверено исполнением), документация обновлена в том же коммите, класс изменений и трейлеры корректны, побочных потребителей не задето.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/601-mutants-only-on-request`, коммит `a551af921908` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4152b94d017f32f74759407836389ccc380e58c5`
  ```
  git log --all --format='%H %T' | grep 4152b94d017f
  ```
- Тело issue: `e9249b2960498c7d67400304134713f5fea221329f558e1f1d433c753ce96a91`
- Вердикт конвейера: `green` · High 0
