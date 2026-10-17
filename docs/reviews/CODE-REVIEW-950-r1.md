# CODE-REVIEW-950-r1

Дата: 2026-10-17. Независимый локальный ревьюер: Codex, сессия
`/root/review_950`; автор реализации — другая сессия. Это локальное ревью по
разовому разрешению владельца, не результат штатной модельной job конвейера.
Машинные якоря и «Вердикт конвейера» здесь не создавались.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0 · маршрут fix

## Материал и полномочия

- Issue [#950](https://github.com/Matysh/houseplan-card/issues/950), актуальные
  тело, метки и оба комментария прочитаны непосредственно через GitHub API
  (`gh issue view 950 --repo Matysh/houseplan-card --json number,title,state,body,labels,comments,url,updatedAt`).
- Прямое разрешение человека на локальное независимое ревью и разовый ручной
  fast-forward только #950 при зелёных ревью и CI передано из текущего чата;
  [запись разрешения владельца в issue](https://github.com/Matysh/houseplan-card/issues/950#issuecomment-6236650390)
  опубликована авторской сессией от аккаунта Matysh, а не служит отдельным
  доказательством личного написания комментария человеком.
  Это не разрешение на слияние #928/#930 или обход остальных гейтов.
- Ветка материала: `issue/950-spec-delivery-heading`.
- Base: `d707793310114abc30444d1ffc41f4d7f00a4ace`.
- Рассмотренный commit: `95a0924d3336d5f36ee205a3c00695e708cc2533`.
- Дерево рассмотренного commit: `377b276a2db8c37a7894c5a98a1ea74278dc871f`.
- HEAD совпал с материалом в начале и после исполнительных проверок.
  Проверен весь `git diff <base>..<commit>`, а не только regex-ханк.
- Обязательные источники прочитаны: `docs/SCOPE.md`, `AGENTS.md`, весь
  `PROCESS.md`, `docs/process/REVIEWER.md`, `docs/STATUS.md`, индекс ревью;
  архитектурный контракт доставки — `docs/ARCHITECTURE.md`, раздел #903/#950.

## Скоуп и совместимость

Инфраструктура поддерживает проверяемую доставку изменений продукта; новых
пользовательских работ вне SCOPE не добавляет. В материале только B/C: reader,
его юнит-тесты, процессная/архитектурная документация и авторская infra-запись.
Класс A, workflow, права, пороги CI, опубликованные SPEC и прежние вердикты не
меняются. Единственный commit несёт терминальные `Issue: #950` и
`User-Visible: no`; отсутствие пользовательских changelog соответствует диффу.

Новая альтернатива заголовка точная: em dash, `issue #NN`, `заход rN`.
Issue берётся из проверяемых трейлеров, round — из имени единственного SPEC;
обе альтернативы привязаны к этим значениям. Заодно каноническая форма больше
не принимает другой round, что прямо требуется issue. Прежняя допустимость
концевых пробелов и многострочного поиска заголовка сохранена. Ни заголовок,
ни имя файла сами по себе не дают фазу доставки.

`readTaskCommit`, publisher/subject/trailers, allowlist дельты, anchors,
существование tree, Added status и content-bound sidecar не ослаблены.
`release-ledger` и `release-membership` продолжают пользоваться общим reader:
SPEC отделяется до создания implementation entries/membership. CODE-REVIEW и
обычная реализация не получают новую фазу.

Запись `docs/release-ledger/v1.81.0/950.json` соответствует schema 1,
действующей базе `v1.81.0` и смыслу категории `infra`: продукт относительно
stable не изменён, пользовательский milestone/changelog не добавляется.
`readMergeEntry` материала подтвердил это исполнением.

## Как проверялось

Все собственные команды Node выполнялись в WSL/ext4 checkout
`/home/sergey/houseplan-937-20261017` с
`PATH=/home/sergey/houseplan-card/.venv/bin:/usr/local/bin:/usr/bin:/bin`.
Wrapper `hp929-gh` не использовался.

| Проверка | Результат и граница доказательства |
|---|---|
| `node --test test/task-delivery-903.test.mjs test/release-ledger.test.mjs test/review-preflight.test.mjs test/process-digests.test.mjs` | PASS: 51 tests, 0 failed/skipped. Исполнено ревьюером на неизменённом reader. |
| `node scripts/smoke-select.mjs --base d707793310114abc30444d1ffc41f4d7f00a4ace --head 95a0924d3336d5f36ee205a3c00695e708cc2533` | «Исполняемого frontend-диффа нет»; browser-smoke не выбираются. Ни одна строка выбора не оставлена без решения. |
| `git diff --check <base>..<commit>` | PASS, exit 0. |
| Оригинальный `19eb72fd1b796938ec76f7d83d48598c61b43b79` через `readTaskCommit` и `taskDelivery` | PASS: `spec-review`; автор `209825114+claude[bot]@users.noreply.github.com`, только INDEX + новый SPEC928, status `A`, tree type `tree`. История не редактировалась. |
| `readMergeEntry('2ec89911ebe55ca6780062432444979284924821', 930)` | PASS: entry issue 930, category `major`, base `v1.81.0`. Это проверка ledger, не ревью и не разрешение слияния #930. |
| `readMergeEntry('95a0924d3336d5f36ee205a3c00695e708cc2533', 950)` | PASS: entry issue 950, category `infra`, base `v1.81.0`. |
| `readCatalogue({candidate:'95a0924d3336d5f36ee205a3c00695e708cc2533'})` с assertions | PASS; исходный SPEC928 присутствует в `specDeliveries`, issue 928 отсутствует в `entries`, issue 950 отсутствует в `userIssues`. |
| Независимые ordinary-input probes на объекте оригинального SPEC928 | PASS: 21 ожидаемый отказ и 2 положительных контроля, перечислены ниже. Это изменение входных данных в памяти, не кода/гарда/собранной копии. |
| Авторский `npm run gate:small` | Проверен `artifacts/950/gate-small.log`: 120 с, упало 0; build/typecheck, `npm test`, `bundle-policy --verify`, бюджет и lint PASS. Автор сообщил exit 0. Это чтение лога авторского исполнения, не собственный повтор. |
| Штатный pre-push `node scripts/gate-small.mjs --base=d707793310114abc30444d1ffc41f4d7f00a4ace` | Проверен `artifacts/950/push.log`: 115 с, упало 0; тот же полный малый набор PASS, опубликован exact SHA. В PATH отсутствовал gh, поэтому статусная часть локально пропущена; GitHub CI preflight/process уже success. Число unit tests лог не печатает, оно не предполагается. |
| CI на точном SHA | [Validate 39050065623](https://github.com/Matysh/houseplan-card/actions/runs/39050065623) на момент проверки ещё `in_progress`: preflight/provenance/process и Build уже success, Unit tests ещё running. До финального success интеграция не разрешена. |

Воспроизводимая read-only проверка настоящей истории, из корня checkout:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readTaskCommit, taskDelivery } from './scripts/task-delivery.mjs';
import { readMergeEntry, readCatalogue } from './scripts/release-ledger.mjs';
const run = args => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
}).trim();
const sha = '19eb72fd1b796938ec76f7d83d48598c61b43b79';
const original = readTaskCommit({ sha,
  message: run(['show', '-s', '--format=%B', sha]) }, run);
assert.equal(taskDelivery(original), 'spec-review');
assert.equal(readMergeEntry('2ec89911ebe55ca6780062432444979284924821', 930).entry.issue, 930);
const candidate = '95a0924d3336d5f36ee205a3c00695e708cc2533';
assert.equal(readMergeEntry(candidate, 950).entry.category, 'infra');
const catalogue = readCatalogue({ candidate });
assert(catalogue.specDeliveries.some(e => e.commit === sha && e.issue === 928));
assert(!catalogue.entries.some(e => e.issue === 928));
assert(!catalogue.userIssues.includes(950));
console.log('historical SPEC, candidate930 ledger, candidate950 catalogue: PASS');
JS
```

У независимого probe за основу взят `original` из этой команды. По одному
менялись только входные поля: subject на другой issue; форма subject;
нетерминальный trailer block; повтор `Issue`; второй issue; `User-Visible: yes`;
повтор visibility; неизвестная phase; повтор phase; foreign author; второй
SPEC; foreign SPEC path; отсутствие SPEC; status `M`; лишний B-путь;
неподтверждённый sidecar; чужой issue в заголовке; чужой round; обычный дефис
вместо em dash; суффикс `(accepted)`; отсутствующий tree type.
Каждый дал ожидаемый `Unproven spec-only` либо `Unknown/malformed` через
`assert.throws(() => taskDelivery({...original, ...over}), ...)`.
Положительные контроли — прежний publisher без phase trailer и канонический
заголовок того же issue/round — оба вернули `spec-review`.

## Защитные контракты: чем краснеет

Все названные ниже тесты входят в исполненный 51-test прогон. Третий столбец —
реальные обычные отрицательные входы; мутанты не исполнялись.

| AC / контракт | Чем доказан | Чем краснеет |
|---|---|---|
| AC1: оба заголовка, v1 и legacy остаются SPEC, не implementation/membership | Четыре `#903/#950 verified ... keeps trace without implementation membership`; оригинальная история выше | В этих же тестах поддельный manifest с единственным SPEC SHA даёт `/does not prove/`; `readMergeEntry` при одном SPEC даёт `/only SPEC delivery/`. PASS. |
| AC1/AC2: точное совпадение issue/round и формы | `#950 both supported SPEC headings must match the exact file issue and round` | Чужие issue/round в обеих формах, `r01`, CODE heading и suffix `(accepted)` дают отказ. PASS. |
| AC2: publisher, пути, Added и tree обязательны | `#950 published heading does not relax publisher, paths, new-file or machine-anchor proof` | Foreign author, лишний C-путь, status `M`, `blob` вместо `tree`, absent tree отвергнуты. PASS. |
| AC2: собственные body/tree/verdict anchors обязательны | Тот же `#950 ... machine-anchor proof` и `#903 rejects malformed record` | Поочерёдное отсутствие `Тело issue:`, `Дерево материала:`, `Вердикт конвейера:` и record без machine evidence отвергнуты. PASS. |
| AC2: subject, terminal trailers, phase и visible не ослаблены | Независимые ordinary-input probes оригинального SPEC928; `#903 rejects unknown phase`, `duplicate phase`, `a marker alone cannot confer spec phase` | Искажённый subject/terminal block, повтор Issue/visibility/phase, visible yes, второй issue, invented phase и marker-only отвергнуты. PASS. |
| AC2: sidecar только проверенный content-bound companion | `#950 published heading retains content-bound SPEC companion semantics`; `#926 SPEC sidecar exception refuses wrong content/hash/path/publisher and modifications` | Неподтверждённый sidecar с новым heading отвергнут; неверные content/hash/header/path/round/issue/stage, modified/NUL/oversize sidecar и скрытый продуктовый файл отвергнуты существующим общим reader. PASS. |
| SPEC не даёт реализации, release membership или права закрытия | Четыре positive/membership cases; `#903 published mixed manifests retain ancillary SPEC trace but require their own implementation SHA` | SPEC-only membership и mixed manifest без собственного implementation SHA отвергнуты. PASS. |
| Первая A/B доставка требует актуальной авторской классификации; исходная база сохраняется | `#903 later A/B delivery rejects absent/unchanged doc placeholder at catalogue and merge boundaries`, `subsequent implementation without any classification remains fail-closed`, `stale base and immutable candidate checks survive spec phase separation` | Неизменённый placeholder/форматирование/unknown field, отсутствующая классификация и устаревший stable дают отказ. PASS. |

## Bootstrap и риски

Bootstrap-ограничение подтверждено чтением, не исполнением старого гарда:
`_process.yml` закрепляет SHA `origin/dev` и архивирует его scripts до перехода
на материал; `review-preflight.mjs` вызывает `readMergeEntry`, который читает
всю историю цикла. В base старый regex принимает только каноническую форму и
не подходит к неизменённому заголовку SPEC928. Поэтому кандидат не может сам
разрешить своё принятие новым reader. Это не исправлено обходом в diff;
разовое исключение дано владельцем отдельно и только для #950.

Классы риска §2.6: данные/права применимы — publisher, документ, Git object и
membership проверены выше; async/order применимы только к trusted-tools
bootstrap и проверены чтением. Геометрия, визуал, объём/performance runtime,
HA/input/touch не затронуты. Нового пользовательского числового вывода нет;
issue/round обоих заголовков происходят из одного проверяемого имени SPEC,
дублированных независимых расчётов не появилось.

## Находки

High: 0. Medium: 0. Low: 0. Побочных находок нет; новые issue не создавались.
Настройка маршрута #926 в этой локальной сессии не фиксировалась prepare;
отсутствие побочных находок не потребовало ни файлового, ни issue-маршрута.

## Чего не проверял и не менял

- Второй `npm test`, build/typecheck и `gate:small` не запускал: общий прогон
  исполнял автор в том же checkout. Финальный зелёный CI остаётся отдельным
  обязательным условием интеграции, не выводится из данного ревью.
- Browser/golden/backend/геометрические/performance гейты не запускал: diff и
  AC не меняют эти поверхности, smoke-select прямо не выбрал browser cases.
- Мутанты, временные патчи guard/source/test-build/bundle не исполнялись;
  registered readiness или ordinary PASS не названы caught.
- HEAD, исходники, тесты, INDEX, machine anchors, labels, `dev`, история и
  опубликованные документы не менялись. Авторские generated `dist/**` после
  общего build замечены и не трогались ревьюером; автор затем очистил их
  штатным `npm run bundle:clean`. Финальный status содержит только этот новый
  review-документ; generated outputs не входят в зафиксированный diff.
- Документ ревью не закоммичен. Зелёный код-вердикт не утверждает, что CI уже
  завершился или fast-forward состоялся, и не разрешает слияние #928/#930.
