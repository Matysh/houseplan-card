# CODE-REVIEW-703-r1

Issue: #703 · «stable promotion ложно судит уже проверенную бета-линию»
Трек: show (владелец задал критерии в теле issue)
Материал: `4496c232a0a53186b5db426b584b99a431f7cfbb`, ветка
`issue/703-promotion-range-base` поверх `origin/dev`
Заход: r1 · блокирующих циклов израсходовано 0 из 2

## Скоуп

Инфраструктурная задача (не класс A, входит сразу в код-ревью, AGENTS.md
«Tracks»). Три AC в теле issue:

- **AC1 (unit, фикстура git)** — промоушен SHA, уже зелёного на `dev`, даёт
  пустой диапазон гейтам `no-new-any`/`no-new-private-writes` на `main`; без
  прогонов `dev` в окне API граница — последний тег `v*`, а не прошлый stable.
- **AC2 (unit)** — новое нарушение после границы по-прежнему красное (hotfix
  над кандидатом; повтор упавшего HEAD).
- **AC3 (контракт workflow + документация)** — `changes` и preflight на `main`
  читают прогоны обеих интеграционных веток, preflight больше не падает на
  `event.before`, граница описана в PROCESS.md §10.2.

Изменение процессное — `docs/SCOPE.md` им не ограничивается (AGENTS.md,
«infrastructure task … skips analysis and spec»). User-Visible: no в трейлере
коммита — верно, поведения продукта дифф не меняет.

## Как проверялось

Прочитаны: AGENTS.md, docs/process/REVIEWER.md, тело issue #703 и оба
комментария («Взял», «Сделано»), PROCESS.md §8, §10.2, §11.5, §11.6.
Дифф разобран целиком (`git diff origin/dev...HEAD`, 5 файлов):
`scripts/classify-base.mjs`, `.github/workflows/validate.yml`,
`test/promotion-range.test.mjs` (новый), `test/validate-workflow.test.mjs`,
PROCESS.md §10.2.

Прочитан `scripts/classify-base.mjs` целиком, не только дифф — проверено, что
`pickRangeBase` корректно приоритизирует HEAD (только доказанный успехом или
тегом), затем предков по объединению `judged ∪ tagged`, с верной атрибуцией
`reason` (`green-ancestor` vs `release-tag`).

Прогнал точечно (полный `gate:small`/`tsc`/`build` не гонял — см. «Чего не
проверял»):
- `node --test test/promotion-range.test.mjs` → `pass 6`.
- `node --test test/validate-workflow.test.mjs` → `pass 28`.
- Мутация: временно заменил `if (head && (headGreen.has(head) ||
  tagged.has(head)))` на `if (false)` в `scripts/classify-base.mjs`,
  перезапустил `promotion-range.test.mjs` → `pass 4, fail 2` (AC1-тесты
  красятся), откатил файл (`cp` бэкапа), `git status --short` после отката
  пуст — эксперимент следов не оставил. Тест умеет падать.
- Независимо, вне тестовой фикстуры, воспроизвёл парсинг
  `git for-each-ref --format='%(refname:short) %(objectname) %(*objectname)'`
  на настоящем репозитории с annotated и lightweight тегами — поле «коммит»
  (`peeled || object`) извлекается верно для обоих видов.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  «Исполняемого frontend-диффа нет»; дифф не трогает `src/**`, браузерные
  смоки не относятся.

**Главная проверка этого раунда — воспроизвести производственное поведение
границы по тегам, а не только unit-фикстуру.** AC1 второй сценарий
(«без прогонов dev … граница — последний тег») в `test/promotion-range.test.mjs`
создаёт теги прямо в свежесозданном git-репозитории и вызывает
`classify-base.mjs` там же — это НЕ то, как коммит попадает в рабочую копию
джобов `preflight`/`changes` в реальном Validate: там дерево кладёт
`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (`# v7`,
validate.yml:71,342) с `fetch-depth: 0, filter: 'blob:none'` и БЕЗ
`fetch-tags: true`. Я проверил исходники именно этого запиненного коммита
(`curl` тела `action.yml` и `dist/index.js` с того же SHA):

- `action.yml`: вход `fetch-tags` — `default: false`;
- `dist/index.js`, метод `fetch()`: `args.push('--no-tags')` **безусловно**, с
  комментарием «Always use --no-tags for explicit control over tag fetching»;
  refspec `+refs/tags/*:refs/tags/*` добавляется только когда
  `settings.fetchTags === true` (`getRefSpec`).

Затем эмпирически воспроизвёл именно эту последовательность: `git init` +
`remote add` + `git -c protocol.version=2 fetch --no-tags --prune
--no-recurse-submodules …` на репозитории с тегом, затем — как и делает шаг
`changes`/`preflight` дальше по файлу (`git fetch -q origin dev`,
validate.yml:371,726,841) — простой `git fetch` БЕЗ явного `--no-tags`. В обоих
случаях `git for-each-ref refs/tags` после фетча пуст: явный одиночный refspec
(`origin dev`) не включает git-механизм auto-follow тегов, а `--no-tags` на
первом fetch не оставляет вообще ни одного tracking-объекта для тега.
Убедился отдельно, что это не проблема моей среды ревью: в РАБОЧЕЙ КОПИИ этой
сессии (клонированной иначе, не через `actions/checkout`) теги есть —
несовпадение подтверждает, что дело в конкретном пути checkout-экшена, а не в
git вообще.

## Находки

### High — release-tag граница (AC1, вторая часть) не работает в реальном Validate: checkout никогда не тянет теги

`scripts/classify-base.mjs:88-99` (`releaseTaggedShas`) и вызов на
`scripts/classify-base.mjs:292-294` читают `git for-each-ref … refs/tags`
локально. Это верно работает в `test/promotion-range.test.mjs`, потому что
фикстура создаёт теги прямо в том же репозитории, где выполняется CLI. Но ни
один шаг `preflight`/`changes` в `.github/workflows/validate.yml` не
устанавливает `fetch-tags: true` на checkout (`grep -n fetch-tags
.github/workflows/validate.yml` — пусто), а сам `actions/checkout@…` (v7,
пин `3d3c42e5aac5ba805825da76410c181273ba90b1`) при `fetch-tags: false`
(дефолт) передаёт `git fetch --no-tags` безусловно и не добавляет refspec тегов
— подтверждено чтением `dist/index.js` этого экшена и независимо эмпирическим
повтором той же fetch-команды (см. «Как проверялось»). Последующие явные
`git fetch -q origin dev` (validate.yml:371,726,841) тоже не подтягивают теги:
явный одиночный refspec не запускает auto-follow.

**Воспроизведение (без CI, тем же способом, что и для встроенного unit-теста,
но с реальной последовательностью git-команд checkout-экшена):**
```
git init /tmp/src && cd /tmp/src && ... commit ... && git tag -a v1.0.0 -m rel
cd /tmp/dst && git init && git remote add origin /tmp/src
git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules \
  origin +refs/heads/main*:refs/remotes/origin/main* +refs/heads/main:refs/remotes/origin/main
git for-each-ref refs/tags   # пусто
git fetch -q origin dev     # как later-шаги validate.yml
git for-each-ref refs/tags   # по-прежнему пусто
```

**Следствие.** Основной путь AC1 (SHA, зелёный на `dev` в пределах окна API в
100 прогонов) не затронут — он работает через ответ GitHub API, а не через git
tag. Но именно вторая часть AC1 — «без прогонов `dev` в списке граница —
последний тег `v*`, а не прошлый stable» — заявлена как страховка НА СЛУЧАЙ,
когда SHA кандидата выпал из стодневного окна API (этот риск прямо назван
автором в комментарии «Сделано»: «Если SHA кандидата выпал из окна, границей
станет последний тег. Это шире, чем нужно, но не прошлый stable»). В
реальности это неверно: при выпадении из окна `tagged` пуст, `pickRangeBase`
падает мимо `release-tag` сразу в `fallback` (`event.before`), т.е.
воспроизводит ИМЕННО тот инцидент, ради которого заведено #703 — просто при
более редком триггере (окно API, а не разница `dev`/`main`). Ни один
существующий гейт это не ловит: `test/promotion-range.test.mjs` и
`test/validate-workflow.test.mjs` проверяют CLI и текст workflow-файла по
отдельности, ни один не проверяет фактическое поведение `actions/checkout` с
реальными его флагами.

**Чем закрыть (для автора, не для этого ревью):** добавить `fetch-tags: true`
к обоим checkout (`validate.yml:71` в `preflight`, `:342` в `changes`) — они и
так тянут `fetch-depth: 0`, полную историю, лишних данных это не добавит; и
дополнить `test/validate-workflow.test.mjs` (или новый тест) assertion на
`fetch-tags: true` рядом с уже добавленной проверкой `fetch-depth: 0`
(test/validate-workflow.test.mjs, новый тест «#703 AC3», последняя строка),
чтобы дальнейшая правка checkout не могла тихо снять флаг.

### Low — тест AC2 не различает «hotfix на main» и «пуш в dev» на практике

`test/promotion-range.test.mjs:121-134`, тест
«#703 AC2: новое нарушение после границы красное — hotfix на main и пуш в dev»
вызывает `rangeBase(fx, hotfix, { dev, main }, fx.candidate)` дважды с
ИДЕНТИЧНЫМИ аргументами (`onMain` и `onDev`) — разницы между «событие на
`main`» и «событие на `dev`» в самом вызове нет, оба используют один и тот же
merged payload. Это осмысленно отражает инвариант «граница одна независимо от
ветки», но имя и комментарий теста обещают проверку двух разных путей, а
по факту второй ассерт (`onDev`) — дубликат первого, не отдельный сценарий.
Не блокирует: собственно инвариант («граница одна») проверен по построению
(`mergeRunPayloads` тестируется отдельно), а не через эту дублирующую
проверку. Можно оставить как есть — записываю, находка Low, не открывает
цикл (трек show, REVIEWER.md «Трек show»: бухгалтерия — Low).

## Что проверено и корректно

- **AC1, первая часть** — исполнением: `test/promotion-range.test.mjs`
  «#703 AC1: промоушен проверенного SHA в main — пустой диапазон и ноль
  нарушений» зелёный, мутация на строку HEAD-проверки красит его (см. «Как
  проверялось»). CLI действительно возвращает `base = head`, диапазон пуст,
  `no-new-private-writes` находит 0 вместо 2 старых записей. Работает через
  API-ответ (`headGreen`), не зависит от найденного дефекта с тегами.
- **AC2** — оба сценария (hotfix над кандидатом, повтор упавшего HEAD)
  доказаны исполнением, зелёные, мутация на `firstGreen`/`headGreen` логику не
  ставилась отдельно, но покрывающий её путь (проверка «упавший HEAD не
  граница») в тесте `#703: HEAD засчитывает только успех или тег…`
  (`test/promotion-range.test.mjs:148-168`) явно различает упавший и
  доказанный HEAD через прямой вызов `pickRangeBase` — читал построчно,
  логика корректна.
- **AC3, контракт workflow** — подтверждено чтением `validate.yml` и
  исполнением `test/validate-workflow.test.mjs` (строковые ассерты на
  обновлённый `if:` preflight, цикл `for branch in dev main`, изменение
  `changes`/`base`-шага с `other=dev/main`). Preflight действительно больше не
  падает на `event.before` для `main`: шаг «База диапазона» теперь выполняется
  и для `refs/heads/main`, `BEFORE_SHA` у `provenance`/`process_gate`
  переключается на `steps.range.outputs.base`.
- **PROCESS.md §10.2** — текст соответствует коду один в один (три условия
  границы, HEAD только по успеху/тегу, ссылка на реализацию и тест); добавлен
  в верное место — рядом с уже существующей оговоркой «При продвижении в
  `main` не перепроверяются коммиты, уже достижимые из prerelease-тега».
- Трейлеры коммита — `Issue: #703`, `User-Visible: no` — верны, никакого
  видимого пользователю поведения дифф не меняет; changelog не тронут и не
  должен быть.
- «Одно число — один источник» (§8) — неприменимо, дифф не вводит величин,
  видимых пользователю.
- `releaseTaggedShas` корректно разбирает и annotated, и lightweight теги
  (проверено отдельным прогоном `git for-each-ref` на реальном репозитории —
  см. «Как проверялось»), фильтр `RELEASE_TAG` отсекает `beta.0` и
  немаркированные теги верно (юнит-тест плюс мой ручной прогон совпали).
- Изменение не трогает геометрию модели, Python-бэкенд, golden-эталоны —
  соответствующие гейты неприменимы.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` с сверкой трёх
  копий бандла не гонял заново: Validate на этом SHA (`4496c232`) зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/36745546331),
  §8/AGENTS.md разрешают на него сослаться. Прогнал точечно только два
  изменённых тестовых файла (см. «Как проверялось») — это не замена полного
  набора.
- Браузерные смоки — `smoke-select` сообщает «исполняемого frontend-диффа
  нет», тело issue не называет ни одного смока в AC; Chromium не поднимал.
- `npm run golden:verify` — метки `ci:golden` нет, `demo/golden/**` не тронут.
- `python -m pytest tests_backend` — `custom_components/**/*.py` не тронут.
- `npm run invariants` — дифф не касается геометрии модели плана.
- Performance-профили — не названы в AC, дифф не трогает рендер/performance
  код.
- Мутанты по диффу — трек `show`: мутанты в разработке не гоняются ни на
  каком треке (REVIEWER.md, «Трек show», #709); в этом диффе и нет
  продуктового кода, защита — чистые юниты с отрицательным случаем в самом
  тесте (см. таблицу ниже), реестр мутантов не применим.
- Живой промоушен `dev → main` на реальном GitHub Actions не воспроизводил —
  автор прямо пишет «НЕ сделано: живой промоушен в main этим не проверить до
  следующего stable»; это ожидаемо и не находка само по себе, но именно
  поэтому расхождение checkout-экшена с ожиданием теста осталось незамеченным
  до этого ревью.

## Таблица «AC · чем доказан · чем краснеет» (защитные AC)

| AC | чем доказан | чем краснеет |
|---|---|---|
| AC1 (пустой диапазон на доказанном SHA) | `test/promotion-range.test.mjs` тест «#703 AC1: промоушен …» | мутация `if (false)` на HEAD-проверку — падает (проверено в этом раунде) |
| AC1 (тег как граница без прогонов dev) | тот же файл, тест «#703 AC1: без прогонов dev …» | **не красит в производственном пайплайне** — см. находку High: `releaseTaggedShas` в реальном Validate всегда получает пустой набор тегов, юнит-тест этого не ловит, т.к. не проходит через `actions/checkout` |
| AC2 (новое нарушение красное) | тесты «#703 AC2: …» ×2 | отрицательный случай внутри самого теста (упавший HEAD vs доказанный) |
| AC3 (workflow-контракт) | `test/validate-workflow.test.mjs`, новый тест | строковые ассерты на regex — точечно, но соразмерно (контракт YAML, не поведение) |

## Вердикт

Красный. Один High: вторая часть AC1 (release-tag как граница, когда SHA
кандидата выпал из окна API в 100 прогонов) реализована в
`scripts/classify-base.mjs` корректно, но неработоспособна в реальном
Validate — ни один из задействованных шагов `actions/checkout` не получает
`fetch-tags: true`, и пин v7 (`3d3c42e5aac5ba805825da76410c181273ba90b1`)
безусловно передаёт `--no-tags`. Это тихо воспроизводит именно тот класс
инцидента, ради которого заведено #703, при более редком, но реальном
триггере. Основной путь AC1 (доказанный SHA в пределах окна API) и оба
сценария AC2 работают верно. Один Low — тестовая избыточность, не блокирует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/703-promotion-range-base`, коммит `4496c232a0a5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `68cd755f1339d9f4cedc1a28b173b15519540bed`
  ```
  git log --all --format='%H %T' | grep 68cd755f1339
  ```
- Тело issue: `d3b8c4a60a2666a458283fb684284710ad5982fe267e8a362f852f3dedaa5761`
- Вердикт конвейера: `red` · High 1
