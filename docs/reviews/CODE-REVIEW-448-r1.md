# CODE-REVIEW-448-r1

- Issue: [#448](https://github.com/Matysh/houseplan-card/issues/448)
- Материал: `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
- SHA материала: `658f284b44610fbb583cc795e12a3b4fae798f9c` (сверено `git rev-parse HEAD` перед выводом)
- Заход: r1 (первый код-ревью на этой задаче; ТЗ прошло spec-review r1→r2, но код-ревью считается отдельно)
- Вердикт: **жёлтый**

## Скоуп

Коммиты в диапазоне:

- `ed0fdd48` / `0ec0785d` / `7230e424` / `e846833e` — документация ТЗ и ревью ТЗ (класс C, вне код-ревью).
- `169fed01` — `feat: replace Labs expiry with persistent alpha switch` (Issue: #448, User-Visible: yes) — единственный продуктовый коммит: `src/labs.ts`, `src/houseplan-card.ts`, unit/golden/smoke/performance fixtures, оба changelog, `docs/DEVELOPMENT.md`, `docs/ISOMETRIC.md`, ADR-089/122, синхронные bundle-копии.
- `658f284b` — `docs: refresh alpha screenshot source fingerprint` (Issue: #448, User-Visible: no) — обновление `sourceFingerprint`/`sourceSha256` в `docs/images/screenshots.json` без нового PNG (`imageSha256` не менялся).

Изменение полностью соответствует заявленному скоупу ТЗ: `src/labs.ts` лишился `since`/`expires`/version-резолвера и получил единый `hp_alpha` (`ALPHA_STORAGE_KEY = houseplan_card_alpha_v1`), `houseplan-card.ts` тронут двумя строками сигнатур (`subscribeLabs`/`currentLabs`/`noteLabsRender` больше не принимают `CARD_VERSION`), backend/schema/HA-пути не тронуты.

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | pass, без вывода |
| Unit | `npm test` | 1908 тестов: 1907 pass, 1 skipped, 0 fail |
| Build | `npm run build` | pass, `dist` пересобран за 16.5с |
| Копии бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | побайтово идентичны |
| Дерево бандла | `node scripts/bundle-tree.mjs dist custom_components/houseplan/frontend` | 11 assets подтверждены |
| Синхронизация стенда | `npm run bundle:sync` | pass, синхронизирован `demo/srv/assets` |
| any-гигиена | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 60 добавленных символов в 2 файлах — новых `any` нет |
| Docs fingerprint | `node scripts/check-docs.mjs` | passed (7 файлов, 12 внешних ссылок) — обязателен, т.к. диф трогает `src/**` |
| Bundle budget | `npm run bundle:budget` | pass, initial View 295081 B / потолок 296000 B; предупреждение о запасе <15000 Б — существующий долг #367, не вызван этой задачей |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 10 прямых совпадений (см. ниже) |
| Isometric smoke-контракт (AC1/2/6/7/8/9, названы в плане автотестов ТЗ) | `node demo/smoke_isometric_contract.mjs` | OK, все 22 поля `true` |
| Isometric live/touch (AC7/8/9) | `node demo/smoke_isometric_live_touch.mjs` | OK, все 28 полей `true` |
| Прямые совпадения smoke-select (10/10) | `node demo/smoke_{grid_scale_invariance,hide_room_names,junction_patch_resilience,multiwall_junction,multiwall_strip_containment,room_fit,smooth_zoom,wall_key_roundtrip,wall_thickness_transition,wall_union_isolation}.mjs` | все 10 — exit 0, `OK`, ни одного `false` в выводе |
| Golden (AC10) | `npm run golden:verify` | 157/157 сценариев `passed`, включая все 7 isometric-сценариев (`isometric-geometry-view-dark/light`, `isometric-live-layers-dark`, `isometric-no-borders-dark`, `isometric-touch-kiosk-dark`, `isometric-large-warm-remount-dark`, `isometric-wall-junctions-dark`, `isometric-opening-symbol-parity-dark`) |
| Backend | не запускался | диф не трогает `custom_components/**/*.py` |
| Инварианты модели | не запускался | диф не трогает геометрию комнат/стен/`layout`/`marker.space`/`open_spans` — только capability-gate поверх уже существующей проекции |

Мутационная проверка защитного AC (см. таблицу ниже) выполнена вручную поверх рабочей копии и полностью отменена (`diff` после отката пуст, ревьюер продуктовый код не правит — только временная проверка «умеет ли тест падать»).

## Критерии приёмки — доказательство и статус

| AC | Что проверяет | Доказано | Статус |
|---|---|---|---|
| AC1 | `hp_alpha=1` query/hash включает, сохраняет `1`, не переписывает URL | unit `test/labs.test.mjs:29-40`, `demo/smoke_isometric_contract.mjs` (`alphaStored: true`) | ✅ |
| AC2 | `hp_alpha=0` выключает, сохраняет `0`, немедленно Flat | unit + `removalIsImmediateFlat: true` в smoke | ✅ |
| AC3 | query раньше hash, последнее распознанное значение сильнее | unit-таблица `test/labs.test.mjs:29-40`, все комбинации `0/1` × query/hash перекрёстно | ✅ |
| AC4 (защитный) | corrupted/unknown/absent storage не включают alpha, без исключений | unit `test/labs.test.mjs:42-52` — см. таблицу «чем краснеет» | ✅, мутация подтверждена |
| AC5 | Поведение не зависит от версии карточки | unit — `assert.doesNotMatch(source, /since|expires|parseVersionCore|compareVersion/)`; чтением подтверждено отсутствие `CARD_VERSION` в сигнатурах `labs.ts` | ✅ |
| AC6 (защитный) | `houseplan_card_labs_v1: ["iso"]` и `hp-labs=...` не включают и не мигрируют | unit `test/labs.test.mjs:63-74` + smoke `alphaFromUrl`-профиль «grep -c legacy» — legacy-ключ не читается (`grep -n LABS_STORAGE_KEY src/labs.ts` → 0 совпадений) | ✅ |
| AC7 | При alpha on — Flat↔3-D и Stage 2; при off — публичный Flat | `smoke_isometric_contract.mjs` (`toggleShown`, `isoRendered`), golden `isometric-geometry-view-{dark,light}` | ✅ |
| AC8 | Per-space preference переживает off/on, без alpha никогда не рендерится | `reenableRestoresPreference: true` в `smoke_isometric_contract.mjs`; golden `isometric-large-warm-remount-dark` | ✅ |
| AC9 (защитный) | Редакторы/`houseplan-space-card` — flat, kiosk без контрола | чтением: `_desiredProjection` гейтит `this._mode === 'view'` (houseplan-card.ts:2384-2387), кнопка — `this._labsIso && this._mode === 'view' && !this._kiosk` (houseplan-card.ts:11501); `space-card.ts`/`space-render.ts` не импортируют `labs.ts` вовсе (`grep _labs src/space-*.ts` → пусто). Поведенчески: `kioskHasNoToggle: true`, `kioskReadsPreference: true` (`smoke_isometric_live_touch.mjs`), golden `isometric-touch-kiosk-dark` | ✅ |
| AC10 | Golden-сценарии явно объявляют alpha и падают на Flat | `demo/golden/harness.mjs:826-829` — новый явный `throw` при `_effectiveProjection() !== 'iso'`; `npm run golden:verify` зелёный на всех 7 | ✅ |
| AC11 | Performance profile — новый контракт, не legacy | чтением: `demo/benchmark_large_house.mjs` теперь ставит `hp_alpha=1` через URL/storage и падает в legacy-инъекцию только для до-#448 сравнительных бандлов (комментарий и код это явно разделяют) | ✅, проверено чтением, профиль не запускался (см. «чего не проверял») |
| AC12 | Диагностика однозначно показывает switch/набор, не спамит console | чтением: `noteLabsRender` (`src/labs.ts:174-184`) — сигнатура строится из `active` только когда `alpha === true`, дедуп через `loggedSignature`; автотеста (unit/smoke) на этот путь нет | ✅, проверено чтением, не исполнением — доказательство ТЗ допускает «unit или targeted browser smoke», но ни того, ни другого в диффе нет |
| AC13 (защитный) | Alpha не участвует в HA data/request/schema/write путях | чтением: `src/labs.ts` не имеет ни одного `import` (`grep -n "^import" src/labs.ts` → пусто) — модуль структурно не может звать HA/сеть/схему; потребитель в `houseplan-card.ts` использует `_labs` только для `_labsIso`/`noteLabsRender`, ни один вызов `hass.callService`/`_cardToggle`/сохранения плана не читает `_labs` | ✅ |

### Защитные AC — таблица «чем краснеет» (PROCESS §2.7)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC4 | `test/labs.test.mjs:42` `'unknown alpha values fail closed for the current resolution without rewriting storage'` | Мутация `src/labs.ts:96` `url.present ? false : storedAlpha` → `url.present ? true : storedAlpha` (fail-open вместо fail-closed). Прогон: `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/labs.test.mjs` → `not ok 3 … Expected values to be strictly equal: true !== false`. Мутация полностью отменена (`diff src/labs.ts` пуст после отката), `npm test` перепрогнан зелёным. |
| AC6 | `test/labs.test.mjs:63-74` (`legacyUrl.alpha === false`, storage `'["iso"]'` игнорируется) | Отдельная мутация не ставилась — тест прямо утверждает `assert.equal(legacyUrl.alpha, false)` при точном старом значении `hp-labs=iso` и `houseplan_card_labs_v1`-подобной строке; удаление `ALPHA_STORAGE_KEY`-чтения или возврат operations-парсера немедленно уронит именно эту строку, а не косвенно. Дополнительно закрыто source-contract тестом `test/isometric-contract.test.mjs:22` (`doesNotMatch(labs, /houseplan_card_labs_v1|params\.getAll\('hp-labs'\)/`). |
| AC9 | Поведенческий — `smoke_isometric_live_touch.mjs` (`kioskHasNoToggle`, `kioskReadsPreference`) + golden `isometric-touch-kiosk-dark` (пиксельное сравнение) | Мутация не ставилась (дорогой гейт: browser smoke + golden, повторный отрицательный прогон ревьюер не воспроизводит по правилу §2.7 без `scripts/mutation-gate.mjs`, которого в этой задаче нет). Проверено чтением: гейт `!this._kiosk` — единственное условие, отделяющее kiosk от полного View в JSX-условии рендера кнопки (houseplan-card.ts:11501); при его снятии `kioskHasNoToggle` в уже прогнанном зелёном smoke стал бы `false`. |
| AC13 | Структурный — `src/labs.ts` не содержит `import` | Мутация не ставилась: свойство доказывается структурой файла (ноль импортов = структурная невозможность обратиться к HA/schema/network), а не поведением на входе. |

## Находки

### Medium (в скоупе, чинится в этой же задаче)

**M1 — `docs/RELEASE-NOTES.md` потерял пункт #447 в обеих секциях.**

Коммит `169fed01` заменяет запись `## Основное`/`## Highlights`: вместо того чтобы ДОБАВИТЬ пункт про `hp_alpha`, он одновременно добавляет пункт #448 и молча удаляет уже существовавший пункт #447 («Мебель примагничивается к обеим физическим граням наружной стены…» / «Furniture snaps to either physical face of an exterior wall…») в обеих языковых секциях.

Воспроизведение:
```
git show 775e55f0 -- docs/RELEASE-NOTES.md   # кандидат v1.72.0-beta.1 добавил #447 наравне с #152/#54
git diff origin/dev...HEAD -- docs/RELEASE-NOTES.md   # #448 стёр строку #447, оставив #152 и #54
grep -n '#447' docs/RELEASE-NOTES.md   # 0 совпадений
grep -n '#447' docs/CHANGELOG.md docs/CHANGELOG.ru.md   # запись жива в полном changelog — рассинхрон именно в RELEASE-NOTES
```

`docs/RELEASE-NOTES.md` — «текущий экземпляр» тела релиза (`docs/DEVELOPMENT.md`: «Release»), который `npm run release:prerelease` передаёт GitHub напрямую как `--notes-file`. Тег `v1.72.0-beta.1` ещё не существует (`git tag --list` пуст на эту версию), поэтому ничего пользователю ещё не ушло, но при публикации без исправления опубликованное тело беты не упомянет #447 вообще, хотя фича реализована, задокументирована в CHANGELOG и входит в тот же кандидат. `scripts/release-notes.mjs --verify` эту потерю не ловит: он для стабильных релизов (`isStable(tag)` отказывает на `-beta.N`), а филлер-строка «Мелкие исправления и улучшения» в теле есть, так что скрипт (если бы его вообще запускали на этом теге) не считает пропавший пункт ошибкой — маскирует находку, а не ловит её.

Не найдено логической причины удаления (не переименование, не рефактор формулировки) — похоже на случайную замену строки при редактировании файла.

**M2 — `AGENTS.md` §«Labs flags» не обновлён и описывает контракт, которого больше нет.**

`AGENTS.md:402-416` («Labs flags») — канонический раздел, который читается «первым» любым будущим агентом или ревьюером этого самого репозитория. После `169fed01` он остаётся текстуально нетронутым и всё ещё утверждает:

- активация через `?hp-labs=<id>` / `-<id>` / `off` — все три входа теперь игнорируются по прямому решению задачи (AC6);
- обязательные поля новой записи `since`, `expires` — оба поля физически удалены из `LabsFlag` (`git diff origin/dev...HEAD -- src/labs.ts`, интерфейс лишился `since: string; expires: string;`); следование этой инструкции в будущем даст ошибку типов;
- семантику `expires` («exclusive», «ignores prerelease suffixes») — тема, которой в `src/labs.ts` больше не существует.

Соседние документы (`docs/DEVELOPMENT.md`, `docs/ISOMETRIC.md`) в этом же коммите обновлены корректно (проверено `git diff` — новый `hp_alpha`, `houseplan_card_alpha_v1`, отсутствие version-lifetime); `AGENTS.md` — единственный явно упущенный из «Release-артефакты» ТЗ файл, хотя ТЗ прямо требует «Актуализация документации Labs/изометрии». Задача сама называет этот раздел ожидаемо затронутым («Затронутые файлы и модули»: «документация Labs/изометрии»), и `AGENTS.md` — источник именно этой документации по названию своего раздела.

Отдельно отмечу (не отдельная находка, документируется как контекст): `docs/STATUS.md:26` тоже упоминает «hidden, expiring `iso` experiment», но эта строка привязана к конкретным историческим релизам (v1.63.0-beta.1, v1.64.0) и читается как исторический факт «чем это было на момент выпуска», а не как текущий контракт — в отличие от `AGENTS.md`, который не version-scoped и подаётся как актуальное правило. Не поднимаю это до отдельной находки.

### High

Не найдено.

### Low

Не найдено сверх M1/M2.

## Что проверено и корректно

- Резолвер `resolveLabs`/`alphaFromUrl` реализует precedence «query → hash, последнее распознанное значение сильнее» именно так, как описано в контракте ТЗ (§«Единый внешний переключатель», пункт 5) — прочитан построчно и перепроверен всей unit-таблицей `test/labs.test.mjs:29-52`.
- `LabsSnapshot.alpha` — единственный источник для производного `active` (в `resolveLabs`: `active = alpha ? registry.map(...) : []`), карточка (`houseplan-card.ts`) читает только `active` через `_labsIso`, не пересчитывает состояние сама — «одно число, один источник» соблюдено для capability-флага.
- Kiosk/редакторы/`houseplan-space-card` не получают проекцию ни при каких условиях alpha (структурно и поведенчески, см. AC9 в таблице выше).
- Golden-инфраструктура получила настоящий регрессионный барьер: `demo/golden/harness.mjs` теперь бросает исключение, если isometric-сценарий фактически отрисовался Flat — раньше такой защиты не было (просто рендерили и сравнивали пиксели, которые могли молча остаться дефолтными).
- Тестовые фикстуры (`test/golden-matrix.test.mjs`) запрещают возврат старых полей (`labs`, `testOnlyLabsSnapshot`) в матрице контрактным тестом, а не соглашением.
- Все browser-fixtures, ранее обходившие Labs через тестовый snapshot-инжект (`_onLabsSnapshot`) в основных isometric smoke, переведены на реальный URL/storage-контракт (`smoke_isometric_contract.mjs`, `smoke_isometric_live_touch.mjs`) — соответствует заявленному в хендоффе «без тестовой подмены snapshot»; структурные wall-смоки (`smoke_wall_key_roundtrip` и др.) сознательно оставлены на прямой инъекции — это не путь пользователя, а фикстура геометрии, не относящаяся к AC этой задачи.
- Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) получили запись со ссылкой на #448 в том же коммите `169fed01`, что и продуктовый код — трейлер `User-Visible: yes` подтверждён.
- Коммит `658f284b` (только класс D/C: `docs/images/screenshots.json`) корректно несёт `User-Visible: no` — `imageSha256` не изменился, обновлён только `sourceFingerprint`/`sourceSha256` вслед за изменением `src/**`.

## Чего не проверял

- `npm run benchmark:large-house-isometric` (AC11) не запускался — это тяжёлый гейт вне обязательного минимума ревью; контракт проверен чтением диффа `demo/benchmark_large_house.mjs`/`demo/performance/README.md`, поведение выглядит корректным (переход на `hp_alpha=1`, legacy-инъекция явно ограничена сравнением с до-#448 бандлами), но фактический профильный запуск не выполнялся.
- `python -m pytest tests_backend -q` не запускался — диф не касается `custom_components/**/*.py` (подтверждено `git diff --stat`).
- `node scripts/model-invariants.mjs` не запускался — диф не касается геометрии комнат/стен/`layout`/`marker.space`/`open_spans`; capability-gate накладывается поверх уже существующей isometric-проекции, ссылки/ключи модели не меняются.
- Из 221 смока в матрице напрямую запущено 10 (все «прямые совпадения» `smoke-select`) плюс 2 названных в плане автотестов ТЗ (`smoke_isometric_contract`, `smoke_isometric_live_touch`) — итого 12/221. Остальные 209 не относятся ни к прямому совпадению символов, ни к AC этой задачи (диф не касается их доменов — стены/junctions/освещение и т.д. без Labs), полный прогон матрицы — предрелизный гейт, а не гейт код-ревью.
- AC12 не имеет собственного автотеста (ни unit, ни smoke) — доказано чтением кода `noteLabsRender`, что явно помечено в таблице AC как «проверено чтением, не исполнением», а не как выполненный автотест.
- Мутационная проверка выполнена только для AC4 (см. таблицу «чем краснеет»); AC9/AC13 доказаны структурно/существующими зелёными smoke+golden без отдельной мутации, с указанием причины в той же таблице.

## Материал раунда

- SHA: `658f284b44610fbb583cc795e12a3b4fae798f9c` (сверено `git rev-parse HEAD` непосредственно перед выводом вердикта)
- Диапазон: `origin/dev..HEAD`, 2 продуктовых/инфраструктурных коммита (`169fed01`, `658f284b`) + 4 докуменационных коммита ТЗ/ревью-ТЗ вне скоупа код-ревью
- Дерево: `git rev-parse HEAD^{tree}` на момент вывода

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/448-alpha-switch`, коммит `658f284b4461` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `417fc35379c08ddc060ba43fd37e6c5b835d6446`
  ```
  git log --all --format='%H %T' | grep 417fc35379c0
  ```
- ТЗ `docs/specs/448-alpha-switch.md`, блоб `951eaa1266d5845a7674a8ef61950cd78b8e140b`
  ```
  git log --all --find-object=951eaa1266d5845a7674a8ef61950cd78b8e140b -- docs/specs/448-alpha-switch.md
  ```
