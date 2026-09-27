# CODE-REVIEW-354-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/354
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 2 (лёгкий трек, лимит 2)
- **SHA материала:** `1397afefd5564abf76cb6ed87b9f5eaee074361b` (`git rev-parse HEAD` на момент вердикта)
- **Ветка:** `issue/354-language-runtime`
- **Вердикт: жёлтый**

## Скоуп

ТЗ в теле issue #354, ревизия 2 (принята SPEC-REVIEW-354-r2, зелёный). Три контракта:

- **К1** — `LANGUAGE_RUNTIME` в `src/i18n/registry.ts` становится экземпляром
  тестируемого класса `LanguageRuntime`, рукописный `germanDictionary/germanPending/
  germanFailed/settleGerman` удаляется.
- **К2 (N7)** — отказ загрузки словаря виден тостом `toast.locale_load_failed`
  только в `houseplan-card` (View); остальные три поверхности (`space-card.ts`,
  `editor.ts`, `space-editor.ts`) остаются при `console.warn`.
- **К3** — возврат дубля ловится контракт-юнитом (`instanceof` + grep источника)
  и мутационным тестом.

Диапазон: `git diff origin/dev...HEAD` — единственный продуктовый коммит
`1397afef`. Файлы: `src/i18n/registry.ts`, `src/i18n/language-runtime.ts`,
`src/houseplan-card.ts`, `src/i18n/{en,ru,de}.json`, `test/i18n-runtime.test.mjs`,
`scripts/mutation-gate.mjs`, `demo/smoke_german_locale.mjs`, оба CHANGELOG,
синхронизированные копии бандла (`dist/**`, `custom_components/houseplan/frontend/**`,
`docs/images/*`, `docs/images/screenshots.json`).

## Как проверялось

| Гейт | Результат | Команда |
|---|---|---|
| typecheck | зелёный | `npx tsc --noEmit` |
| unit-тесты (полный набор) | зелёный, 1487 pass / 0 fail / 1 skip (не связан с #354) | `npm test` |
| build + сверка 3 копий бандла | зелёный, `git status --porcelain` пуст после сборки | `npm run build && npm run bundle:sync` |
| docs-гейт (скриншоты/фингерпринт) | зелёный | `node scripts/check-docs.mjs` |
| bundle:budget | зелёный, 257222 B < 282000 B бюджета (справочно, в AC не заявлен) | `npm run bundle:budget` |
| мутант К3 `language-runtime-handwritten-duplicate` | поймана 1/1 — тест «умеет падать» | `node scripts/mutation-gate.mjs --id=language-runtime-handwritten-duplicate` |
| мутант К2 `locale-failure-toast-dropped` | поймана 1/1 | `node scripts/mutation-gate.mjs --id=locale-failure-toast-dropped` |
| `demo/smoke_german_locale.mjs` (полный прогон) | зелёный, включая новую проверку `failureShowsToast` | `node demo/smoke_german_locale.mjs` |
| adversarial-проверка юнита «подписка получает код» | тест НЕ падает при выключенном fan-out — см. находку M1 | ручной мутант в `src/i18n/registry.ts`, откачен |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | см. ниже | — |

**smoke-select:** прямое совпадение по символу `_showToast` дало 6 несвязанных
смоков (`smoke_help_affordance`, `smoke_junction_limits`,
`smoke_optimize_coordinate_canonicalization`, `smoke_partition_openings`,
`smoke_room_resize`, `smoke_zero_wall_migration_unblocked`) — это слабая связь:
`_showToast` не менялся (не тронута ни сигнатура, ни реализация метода в
`src/houseplan-card.ts:6373`), диф лишь добавляет новый вызов с новым ключом.
Ни один не прогонялся — решение, а не пропуск. Зарегистрированная связь —
`demo/smoke_german_locale.mjs` (единственный смок, реально завязанный на
`LanguageRuntime`/`LanguageRuntimeContract`) — прогнан, зелёный.

**Не прогонялось и почему:** `npm run golden:verify` (диф не меняет геометрию,
рендер, стили и слои — только текстовая строка тоста и внутренняя разводка
i18n); `python -m pytest tests_backend` (ни один `*.py` не тронут);
`npm run invariants` (геометрия/`layout`/`marker.space`/`open_spans` не
затронуты); performance-профили (не названы в AC, чувствительные пути не
тронуты). Ручного тестирования в браузере (кроме прогона смоков через
Playwright) не проводилось — доказательства ниже отмечены как «прочитано» либо
«доказано автотестом/смоком».

## Находки

### M1 (Medium, в скоупе задачи) — юнит AC4 не проверяет то, что заявляет

**Файл:** `test/i18n-runtime.test.mjs:166-176`

АС4 текстом ТЗ требует три отдельных доказательства: смок с видимым тостом,
**юнит на `subscribeLanguageLoadFailures` («подписка получает код, отписка
работает»)**, и мутант «тост выброшен», красящий смок или юнит. Смок и мутант
на месте и оба проверены (см. таблицу выше). Юнит — нет.

```js
test('language load failure subscription delivers codes and unsubscribes (#354)', async () => {
  const { subscribeLanguageLoadFailures } = await import('../test-build/i18n/registry.js');
  const seen = [];
  const unsubscribe = subscribeLanguageLoadFailures((code) => seen.push(code));
  const second = subscribeLanguageLoadFailures((code) => seen.push(`2:${code}`));
  unsubscribe();
  second();                       // ← это ОТПИСКА второго слушателя, не триггер
  assert.deepEqual(seen, [], 'listeners removed before any failure stay silent');
  assert.equal(typeof unsubscribe, 'function');
});
```

`second` — это возвращаемая функция отписки второго слушателя (сигнатура
`subscribeLanguageLoadFailures` возвращает `() => void`), а не способ вызвать
доставку кода. Тест ни разу не проводит код через
`languageLoadFailureListeners` (`src/i18n/registry.ts:49-56, 65-72*) — он
проверяет только «отписанные слушатели молчат», то есть половину заявленного
в названии.

**Воспроизведение (тест умеет НЕ падать там, где должен):** временно вырезал
итерацию по подписчикам в продакшн-инстанции —

```diff
-  (code) => {
-    for (const listener of languageLoadFailureListeners) listener(code);
-  },
+  (_code) => {
+    // fan-out отключён
+  },
```

и прогнал `node --test --test-name-pattern="#354" test/i18n-runtime.test.mjs`
— все три `#354`-юнита остались зелёными (3/3 ok), в том числе тест из
находки. Правка отката (не коммитилась, `src/i18n/registry.ts` восстановлен из
бэкапа). Реальную поломку fan-out ловит только браузерный
`demo/smoke_german_locale.mjs` (подтверждено отдельно: мутант
`locale-failure-toast-dropped`, который выключает подписку карточки, а не
сам fan-out, тоже красит только смок) — то есть единственная быстрая, не
браузерная защита от регрессии в строке `for (const listener of
languageLoadFailureListeners) listener(code);` отсутствует, хотя АС явно
просит юнит на этот случай.

Это ровно тот класс дефекта, из-за которого заведён сам #354 (N6, «тест
выглядит защитой, а не ту цель проверяет», #85): название и комментарий теста
обещают проверку доставки кода, а тело её не делает.

**Почему Medium, не High:** реальное поведение карточки доказано
(smoke зелёный, мутант К2 ловится смоком) — пользователь тост увидит.
Дефект в надёжности матрицы гейтов, не в продукте: до релиза поломка
fan-out будет поймана медленным браузерным смоком, а не мгновенным юнитом,
как того хотел АС4.

**Как чинить (в этом же issue, без нового цикла на продукт):** переписать
тело теста так, чтобы `second` вызывался как слушатель, получающий код
(например, дать `subscribeLanguageLoadFailures` слушатель, инициировать
доставку через реальный сбой `LanguageRuntime` с фейковой `de`-записью — как
уже сделано в соседнем тесте «a settled dictionary failure reaches the
load-failed hook once» — либо экспортировать тестовый триггер). Минимально:
переименовать тест и явно ограничить его заявленную гарантию до «отписка
работает», раз доставка проверяется только смоком — но тогда стоит явно
сослаться на смок в комментарии, чтобы не терять доказательство из виду.

### L1 (Low, снята с запиской) — `docs/USER-GUIDE.ru.md` не упоminает новый тост

**Файл:** `docs/USER-GUIDE.ru.md:153-158`

Абзац прямо описывает тот же сценарий, который меняет К2: «если обе
ограниченные попытки загрузки не удались, карточка остаётся работоспособной
на английском» — без упоминания, что теперь при этом показывается тост
`toast.locale_load_failed`. Раздел `USER-GUIDE.ru.md` — канонический источник
формулировок интерфейса (AGENTS.md, «Read this first»), и он расходится с
новым поведением ровно там, где раньше был точным.

Не блокирую: цепочка артефактов (PROCESS.md §7.1) не включает
`USER-GUIDE.ru.md` как обязательное звено — только `changelog`, который
актуален (RU+EN, см. таблицу гейтов). ТЗ #354 не называет обновление гайда
частью контракта. Снимаю с запиской: стоит дополнить абзац одним предложением
о тосте при следующей правке этого раздела (например, вместе с #348, чей
canonical-документ он же расширяет).

## Что проверено и корректно

- **AC1** (=К1, К3): `LANGUAGE_RUNTIME` — экземпляр `new LanguageRuntime(...)`
  (`src/i18n/registry.ts:65-72`); `germanPending|germanFailed|settleGerman`
  вне тестового регэкспа в репозитории отсутствуют (`grep -rn` — единственное
  совпадение это сам паттерн в `test/i18n-runtime.test.mjs:143`). Контракт-юнит
  `instanceof` и grep-юнит зелёные; мутант «рукописный дубль» красит юнит
  (1/1, воспроизведено локально). Проверено автотестом + мутантом.
- **AC2**: `test/i18n-runtime.test.mjs` — только дополнения, ни одна старая
  строка не удалена и не изменена (`git diff` по файлу содержит только `+`);
  полный набор зелёный (1487/1487, 0 fail); паритет-тест ключей локалей
  (`test/i18n.test.mjs:109-112`, `Object.keys(en) === Object.keys(dictionary)`
  для каждого языка) прошёл в общем прогоне — новый ключ
  `toast.locale_load_failed` присутствует во всех трёх словарях
  (`en.json`, `ru.json`, `de.json`), несовпадений не было бы иначе. `demo/
  smoke_german_locale.mjs` зелёный целиком, включая старые проверки
  (нейтральный холодный кадр, ровно одна загрузка, атомарный коммит текста,
  повторное использование словаря вторым инстансом, ровно два ретрая,
  ровно один `console.warn`). Проверено автотестом.
- **AC3**: мутант `language-runtime-handwritten-duplicate` (возврат литерала
  вместо `new LanguageRuntime(...)`) красит юнит К3 — поймана 1/1, командой
  `node scripts/mutation-gate.mjs --id=language-runtime-handwritten-duplicate`.
  Проверено автотестом (мутационным).
- **AC4, часть 1 и 3**: смок проверяет `card._toast === card._t('toast.locale_load_failed')`
  в сценарии «оба ретрая упали» (`demo/smoke_german_locale.mjs:83-85`) —
  зелёный. Мутант `locale-failure-toast-dropped` (подписка карточки удалена)
  красит смок — поймана 1/1. Проверено автотестом/смоком + мутантом.
  Часть 2 (юнит на доставку кода) — см. **M1**.
- **К2 периметр**: только `src/houseplan-card.ts` импортирует
  `subscribeLanguageLoadFailures` и вызывает `_showToast`; `space-card.ts`,
  `editor.ts`, `space-editor.ts` используют `LANGUAGE_RUNTIME` напрямую и не
  содержат `toast`/`_showToast` (`grep` пуст). Подписка идёт в
  `connectedCallback` (`src/houseplan-card.ts:2480-2484`, с защитой от
  повторной подписки через `?.()` перед переприсваиванием, тот же паттерн, что
  и у соседнего `_continuityUnsub`), отписка в `disconnectedCallback`
  (`:2557-2560`). Проверено чтением + смоком.
- **Паритет поведения кодов реестра** (en/ru eager, de lazy; `state()`/
  `dictionary()`/`ensure()` для зарегистрированных кодов): построчное сравнение
  старой и новой логики (retry-цикл на 2 попытки, проверка `fingerprint`,
  текст warn `[houseplan] unable to load ${code} locale; using English`
  байт-в-байт с прежним `de`-текстом) — проверено чтением, не исполнением, плюс
  общий прогон существующего `test/i18n-runtime.test.mjs` (доказывающего класс
  с #348) не изменил ожиданий.
- **Трейлеры и changelog**: коммит `1397afef` несёt `Issue: #354` и
  `User-Visible: yes`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в
  том же коммите (см. `git show 1397afef --stat`). Соответствует правилу №10/11.
- **Генерируемые копии бандла**: после `npm run build && npm run bundle:sync`
  рабочее дерево чистое (`git status --porcelain` пуст) — три копии
  (`dist/**`, `custom_components/houseplan/frontend/**`,
  `demo/srv/assets/**`) синхронны с закоммиченным состоянием.
- **check-docs**: `node scripts/check-docs.mjs` зелёный — скриншоты и их
  фингерпринт актуальны относительно текущего `src/**`.
- **«Одно число — один источник»**: диф не добавляет и не меняет ни одну
  видимую пользователю величину (только строковый текст тоста и внутренняя
  разводка подписки) — правило не применимо к этой задаче.

## Чего не проверял

- `npm run golden:verify` — диф не меняет геометрию/рендер/стили/слои, только
  текст тоста и внутреннюю разводку i18n; решение, не пропуск.
- `python -m pytest tests_backend` — ни один `custom_components/**/*.py` не
  тронут.
- `npm run invariants` — геометрия, `layout`, `marker.space`, `open_spans` не
  затронуты этим дифом.
- Performance-профили — не названы в AC, чувствительные к перфу пути не
  задеты.
- 5 из 6 «прямых совпадений» `smoke-select` по символу `_showToast`
  (`smoke_help_affordance`, `smoke_junction_limits`,
  `smoke_optimize_coordinate_canonicalization`, `smoke_partition_openings`,
  `smoke_room_resize`, `smoke_zero_wall_migration_unblocked`) — слабая связь,
  сам метод не менялся; не прогонялись.
- Ручной просмотр карточки в живом браузере HA (только Playwright-смоки
  демо-стенда) — визуальная проверка текста тоста в интерфейсе не
  проводилась, доверился рендер-тексту в DOM через смок-ассерт.
