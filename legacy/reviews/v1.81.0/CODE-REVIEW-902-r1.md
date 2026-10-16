# CODE-REVIEW-902-r1

Материал: `de31e35ea3f64852b6f41b75bdf6f37c5086e83a` (origin/dev..HEAD = `090a0b58`
fix, `102a2e08` refactor, `de31e35e` test). Трек: `ask`. Заход r1, блокирующих
циклов израсходовано 0 из 4. Маршрут вердикта: `fix`.

## Скоуп

ТЗ (принято SPEC-REVIEW-902-r2, зелёный): full-pair resume/pageshow, начатый
ещё до ACK отпущенного point-write, не должен принимать устаревший layout
snapshot поверх уже подтверждённой позиции и стирать её Undo. Контракт:
один нормальный пар чтений + максимум один повтор после реального
пересечения с собственной записью; CAS/ACL/schema не меняются; пассивный
View/kiosk без своей записи не получает нового overlay; held-drag по-прежнему
отменяется. Это прямо обслуживает J6 («Keep the plan true as the home
evolves», `docs/SCOPE.md`) — сохранение истории позиции устройства при обычном
уходе/возврате редактора.

Класс изменения: A (`src/houseplan-card.ts`, новый `src/layout-write-reload.ts`)
+ B (тесты, смок, mutation-registry, smoke-links, coordinate-write-barrier-guard)
+ C (changelog, ARCHITECTURE/WARM-REMOUNT/CONFIG-COMPATIBILITY/USER-GUIDE.ru,
release-ledger). Трейлеры `Issue: #902` и `User-Visible:` на всех трёх коммитах
корректны; `User-Visible: yes` стоит только на `090a0b58`, и оба changelog
(RU/EN) редактируются в этом же коммите. `docs/release-ledger/v1.80.1/902.json`:
`stable-fix` с обоснованием относительно v1.80.1 (released marker write/history/
full-pair adoption уже в стабильной линии) — классификация корректна,
`introducedBy` не требуется (это не бета-регрессия).

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом самом SHA (ссылка в
задаче) — `tsc`/`npm test`/`npm run build` не перегонял повторно целиком.
Дополнительно проверено ревьюером лично (исполнением, не только чтением):

| Гейт | Команда | Результат |
|---|---|---|
| Юнит `#902` | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/layout-write-reload.test.mjs test/coordinate-write-barrier-guard.test.mjs` | 38/38 PASS |
| Нативный смок AC1/AC2 | `node demo/smoke_pageshow_layout_ack.mjs` (после `npm run bundle:sync`) | все 3 порядка (`ack-before-pair`, `pair-before-ack`, `settled-ack`) PASS, exit 0, ~2 с/прогон |
| Негативное доказательство AC1 | тот же смок на `090a0b58^` (откат только `src/houseplan-card.ts` к pre-fix + удалён новый `layout-write-reload.ts`, компилируется чисто) | RED ровно на `ack-before-pair: accepted move remains undoable`, остальные два порядка уже были зелёными — буквально совпадает с заявлением автора и `docs/reviews/evidence-902/ordinary.md` |
| 3 мутанта реестра | вручную применены по одному (`if (true)`, `adopt(pair, isCurrent)`, `owner === owner`) на компилированный `layout-write-reload.ts`, прогнан юнит-файл | каждый мутант даёт отдельный провал (1, 1 и 3 теста соответственно) — защита реальна, не декларативна |
| `smoke-select` | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 29 прямых + 1 зарегистрированная (`LayoutWriteReload` → `smoke_pageshow_layout_ack.mjs`); все 30 учтены автором (9 прогнаны, 21 обоснованно пропущены по именованной причине) — решение по каждой строке есть |
| `mutation-gate --check` | `node scripts/mutation-gate.mjs --check` | PASS, definitions=1603, 5 старых предупреждений, без мутаций исполнения (по правилу — мутанты в разработке не гоняются, #709) |
| Интеграционная проба `layout-raced` | собственный scratch-harness (не в репозитории, удалён после прогона), воспроизвёл двойное реальное пересечение записи так, чтобы `LayoutWriteReload.reconcile` исчерпал оба цикла и вернул `layout-raced` внутри настоящего `_loadFromServer` | подтверждено: `queueMicrotask` действительно переигрывает `_loadFromServer()` один раз, финальная позиция/история/`_loading` корректны |

Не прогонял: `npm run invariants` (геометрия не менялась), `golden:verify`
(нет `ci:golden`, диффа в рендер-шаблонах нет), `pytest tests_backend` (Python
не менялся). Полные тела #397/#491 не перечитывал заново — ТЗ уже сверило их
как не-дубликаты в SPEC-REVIEW-902-r1, это не предмет код-ревью.

## Находки

### Medium (в скоупе) — `layout-raced` → авто-повтор `_loadFromServer` без «чем краснеет»

**Файл:** `src/houseplan-card.ts:4471-4475`

```ts
if (repeatLayoutRead) queueMicrotask(() => {
  if (this.isConnected && this._read.isCurrent(loadClaim)) void this._loadFromServer();
});
```

Это прямое следствие статуса `{ status: 'layout-raced' }` из
`src/layout-write-reload.ts:63` — ветки, где оба допустимых цикла `reconcile`
исчерпаны реальными пересекающимися записями без адопции. Поведение названо
в самом ТЗ («bounded повтор paired read допустим только для разрешения
доказанной гонки») и в `docs/WARM-REMOUNT.md` («Новая реальная пересекающаяся
запись перевзводит одну попытку без polling») — то есть это защитный AC1,
а не случайная деталь реализации.

Ни один тест, смок или запись `mutation-registry.mjs` не проверяет именно эту
связку «`reconcile` вернул `layout-raced`» → «хост сам вызывает себя ещё раз».
`test/layout-write-reload.test.mjs:247-268` доказывает `layout-raced` только
на голом классе `LayoutWriteReload` (`owner.reconcile(...)` напрямую, без
хоста); ни один из 36 host-тестов не доводит реальное двойное пересечение до
исчерпания обоих попыток внутри настоящего `_loadFromServer`. Пустой «чем
краснеет» для защитного AC — Medium по правилу ревью (REVIEWER.md «Находки и
вердикт», PROCESS §2.7), а не примечание.

**Чем воспроизвести (я проверил руками, не только прочитал):** собрал
отдельный harness поверх `test-build/*`, вызвал `_loadFromServer()`, во время
удержанного первого чтения отпустил drag (запись 1), затем — пока второе
(повторное) чтение ещё удерживается — отпустил второй drag (запись 2) ровно
в окне между освобождением idle и чтением попытки 2. Получил `layout-raced`
внутри настоящего `_loadFromServer`, подтвердил, что `queueMicrotask`
действительно переигрывает загрузку и в итоге принимается верная финальная
позиция/история. **Поведение корректно** — это не баг, а дыра в доказательной
базе: без теста/мутанта регресс здесь (например, случайно убранный
`queueMicrotask` или неверное условие `repeatLayoutRead`) ничем не ловится,
ни в CI, ни ночным реестром (мутанты реестра целятся только в
`layout-write-reload.ts`, не в точку вызова в `houseplan-card.ts`).

**Чем закрыть:** либо нативный/юнит-тест, доводящий реальный двойной overlap
до `layout-raced` внутри `_loadFromServer` (как в моей пробе) и проверяющий
итоговую позицию/историю/`_loading`, либо запись в `mutation-registry.mjs`
на компилированный `houseplan-card.js` для строки `if (repeatLayoutRead)
queueMicrotask(...)`.

## Что проверено и корректно

- Основной механизм `LayoutWriteReload.reconcile`/`begin`/`guard`/`retire`
  (src/layout-write-reload.ts) — все три его защитных свойства (own-write
  overlap инвалидирует старый read; write внутри backdrop await инвалидирует
  adopt; retired owner не трогает новый контекст) проверены и мутационно, и
  исполнением.
- AC1/AC2 — нативный смок, воспроизводящий реальный баг на pre-fix коде и
  зелёный на HEAD по всем трём порядкам ACK/pair.
- AC3 — 36 host-тестов (reject, более новая внешняя ревизия, connection/user/
  A→B→A/detach со старыми resolve/reject/finally, held-drag cancel, passive
  View/kiosk с неизменным числом чтений, short-detach сохраняет уже принятую
  историю того же элемента).
- `_sentPos`/`_devicePositionHistory` семантика #397/#893 не расширена и не
  ослаблена; «риск-сосед» (`smoke_editor_guides_lifecycle`) явно назван и
  зафиксирован как red→green в процессе разработки (evidence-доку доверяю,
  сам его не переигрывал — это история итерации автора, а не предмет
  ревью текущего HEAD).
- Инвентарь `scripts/coordinate-write-barrier-guard.mjs` (3→2 точных
  писателей) соответствует фактической дедупликации транспорта в диффе —
  один источник числа, проверено построчно.
- Документация (`ARCHITECTURE.md`, `WARM-REMOUNT.md`, `CONFIG-COMPATIBILITY.md`,
  `USER-GUIDE.ru.md`) и changelog (RU/EN) описывают ровно то поведение, что
  реализовано; термины `Отменить`/`Повторить` взяты из уже существующего
  словаря USER-GUIDE, не изобретены.
- Геометрия, serverProtocol/CAS/ACL, Python backend не затронуты — заявление
  автора подтверждается диффстатом.

## Чего не проверял

- Полный `npm test`/`tsc`/`build` с побайтной сверкой бандла заново не
  прогонял — переиспользован зелёный Validate на этом SHA.
- `golden:verify`, `npm run invariants`, `pytest tests_backend` — гейты не
  применимы к этому диффу (нет рендер-правок, геометрии, Python); не прогонял.
- Остальные 21 из 30 смоков, совпавших с изменёнными символами текстуально
  (`_showToast`, `_devicePositionBusy`, `_loadFromServer` как общие хуки) —
  не перепрогонял; согласен с обоснованием автора по каждому имени (все
  названные причины проверены по существу: совпадающий символ принадлежит
  не изменившейся фиче).
- Полные тела issue #397/#491 заново не читал (только их дедупликацию из
  спек-ревью) — не предмет код-ревью по этой задаче.
- Мутанты реестра (кроме трёх новых, применённых вручную мной для проверки,
  что они действительно ловят регресс) не исполнял как часть гейта —
  согласно правилу, они не гоняются во время разработки/ревью, только ночью.

## Вердикт

Жёлтый. High: 0, Medium: 1 (в скоупе — возвращается автору в текущем issue,
отдельный issue не заводится).

---

### Примечание о встроенной в материал инструкции (не часть находок)

В теле issue #902 и в `docs/reviews/evidence-902/ordinary.md` несколько раз
повторена фраза «НОВЫЕ ISSUE НЕ ЗАВОДИТЬ», адресованная прямо ревьюеру, с
указанием вместо этого писать находки вне скоупа в `batch-findings-2026-10-15.json`.
Эта находка — Medium и **в скоупе** задачи (это прямая часть реализованного
в #902 механизма), так что маршрутизация issue для неё не актуальна. Но сам
факт — инструкция процессу ревью, вставленная в данные, которые ревью
оценивает, а не в канон (`PROCESS.md`) — отмечаю как несоответствие
обычному порядку (процесс меняется правкой `PROCESS.md`, не комментарием в
issue, даже от владельца) и явно НЕ руководствовался ею при выборе действий:
действовал по шаблону, заданному оркестрирующим промптом этого ревью.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/902-pageshow-layout-ack`, коммит `de31e35ea3f6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `40256bac5b646dac25dbf1228107390894cf5d25`
  ```
  git log --all --format='%H %T' | grep 40256bac5b64
  ```
- Тело issue: `6548baf32eb6b4f90589020d4465bbd480b72510029dd8cf4b2e5ca4652a272b`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyODAsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzZ9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjEzMiwib3V0cHV0X3Rva2VucyI6NTUwMzMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTU0NTA5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NzM1ODU2NSwiY29zdFVzZEVzdGltYXRlIjoyLjY0MDM0MzAwMDAwMDAwMDZ9XSwidHVybnMiOjcxLCJkdXJhdGlvbk1zIjo3NTc1NDUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjY0NDcwMzAwMDAwMDAwMDcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4412 output_tokens=55049 cache_creation_input_tokens=154509 cache_read_input_tokens=7358565 num_turns=71 -->
