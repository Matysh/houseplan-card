# CODE-REVIEW · issue #639 · заход r1

Материал: `0ac08434b5cd12848ce8b18aa17a6343b83b6653` (рабочая копия на нём).
Диапазон: `git diff origin/dev...HEAD` — 3 файла, 16 добавлений / 4 удаления,
2 коммита (`71e8dc29`, `0ac08434`). Правок продуктового кода нет: только
`demo/smoke_room_settings_form.mjs`, `demo/smoke_device_settings_form.mjs`,
`scripts/smoke-links.mjs`.

Предыдущего раунда не было: `71e8dc29` получил метку `S7-code-review`, но
Validate упал на preflight-сверке `process.yml`/`mutation-gate.yml` между
`main` и `dev` (несинхронный мердж #636) до того, как код кто-либо прочитал —
автор сам это фиксирует в комментарии 06:46. Раздел «Унаследовано из r0» не
нужен: наследовать нечего.

## Скоуп задачи

Ночной мутационный прогон 2026-09-23 упал пятью шардами из шести не на
сбежавшем мутанте, а на двух гардах, красных и на чистом `dev`:
`smoke_room_settings_form.mjs` (`numberWritesNameScaleOnly`) и
`smoke_device_settings_form.mjs` (`brightnessNumberWrites`,
`sizeAndAngleNumbersWrite`). Причина — #608 перенёс запись числа range-line
(слайдер+число, `rangeLine()` в `form-kit.ts`) с события `input` на атомарный
`change` (`committedRangeLineValue`), а оба смока-гарда продолжали задавать
поле одним `input`. Правка: смоки шлют `input`+`change`, как пользователь,
отпустивший поле. Вторым коммитом — попутная (не обязательная для гейта)
рекомендация из разбора: `scripts/smoke-links.mjs` получил запись
`rangeLine`/`unitInput` → `smoke_room_settings_form.mjs`,
`smoke_device_settings_form.mjs`, `smoke_space_settings_form.mjs`, чтобы
будущая правка контролов form-kit гоняла эти три смока на кандидате
ревью, а не дожидалась ночного реестра.

Класс B, `User-Visible: no` в обоих коммитах — верно: правка не меняет
поведение карточки, только тестовую инфраструктуру. `docs/SCOPE.md` здесь не
применяется впрямую (это не продуктовая фича), но и не нарушается.

## Как проверялось

**Валидация уже выполнена платформой** на этом SHA — Validate success,
https://github.com/Matysh/houseplan-card/actions/runs/35829479664. `npx tsc
--noEmit`, `npm test`, `npm run build` со сверкой копий бандла на этом
основании не перегонялись. Дельта не трогает `src/**`, геометрию,
`custom_components/**/*.py`, рендер/стили/слои и не заявляет perf-профили в
AC — поэтому `node scripts/check-docs.mjs`, `npm run invariants`,
`npm run golden:verify`, `python -m pytest tests_backend` тоже не запускались:
выбирать здесь нечего, это не пропуск, а несовпадение диффа с условием гейта.

Дешёвые гейты, которые я всё же прогнал сам (Validate их не покрывает —
это адресные смоки/тесты по теме диффа, что PROCESS.md требует делать
ревьюеру всегда):

1. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
   «Browser-smoke этим диффом не выбираются» — ожидаемо: инструмент читает
   исполняемый `src/**` фронтенд, а диффа там нет. Значит выбор смоков для
   ручной проверки я делал по теме задачи (сами два гарда, названные в
   разборе автора, плюс третий смок из новой записи реестра), а не по
   инструменту.
2. `npx mocha test/smoke-select.test.mjs` — 7/7 зелёных, включая тест
   «каждая запись реестра объясняет себя и указывает на существующий
   смок» — механически подтверждает, что новая запись ссылается на
   реальные файлы, но НЕ проверяет правдивость текста `because` (см.
   находку M1).
3. `npm run bundle:sync` (build + копия в `demo/srv/assets` —
   `demo/srv` не коммитится, без этого браузерные смоки не запускаются)
   — прошёл без ошибок, попутно повторно подтвердил `tsc --noEmit` и
   `rollup -c` чистыми на этом SHA.
4. `node demo/smoke_room_settings_form.mjs` и
   `node demo/smoke_device_settings_form.mjs` на HEAD — оба `OK`.
5. **Тест умеет падать** — отдельно проверил регрессионную ветвь: временно
   вернул оба файла к версии `origin/dev` (`git show origin/dev:... >`) и
   перезапустил те же два смока. Получил ровно то падение, которое описал
   автор:
   ```
   smoke_room_settings_form:   FAILED (1): numberWritesNameScaleOnly
   smoke_device_settings_form: FAILED (2): brightnessNumberWrites, sizeAndAngleNumbersWrite
   ```
   Затем восстановил файлы командой `git checkout HEAD -- ...`; рабочее
   дерево чистое (`git status --short` пусто), в репозиторий ничего не
   писал.
6. Прочитал по коду (не исполнением) все четыре исправленных поля в
   `src/editors/marker-dialog.ts` (`marker-glow-brightness`, `marker-size`,
   `marker-angle`) и `src/editors/room-settings-dialog.ts`
   (`room-${key}-scale`) — все четыре действительно обёрнуты в `rangeLine()`,
   где числовое поле коммитит на `onChange`, а `onInput` — no-op
   (`form-kit.ts:470-489`). Значит фикс задел ровно те поля, для которых он
   нужен.
7. Прочитал по коду соседние необновлённые поля в тех же файлах —
   `#room-temp-min/max`, `#marker-glow-radius` — это обычный `unitInput()` с
   `onInput`, коммитящий на `input` напрямую (не через `rangeLine`), т.е. их
   не нужно было трогать. Автор не задел лишнего и не пропустил нужное.

## Находки

### Medium (в скоупе — чинится в этой же ветке)

**M1. Новая запись `smoke-links.mjs` для `smoke_space_settings_form.mjs`
описывает проверку, которой смок не делает.**

`scripts/smoke-links.mjs` (диф, добавленная запись):
```js
{
  symbols: ['rangeLine', 'unitInput'],
  smokes: ['smoke_room_settings_form.mjs', 'smoke_device_settings_form.mjs', 'smoke_space_settings_form.mjs'],
  because: '#639: the three settings-form smokes drive range-line numbers (room name/label scale, '
    + 'device brightness/size/angle, space card font) through the DOM and assert the host draft; ...',
}
```
Утверждение — «space card font» проверяется «through the DOM». Но
`demo/smoke_space_settings_form.mjs:132-141` не отправляет на
`#space-card-font` ни `input`, ни `change`: значение слайдера/числа
изменяется напрямую присвоением `c._spaceDialog = { ...d, cardFontScale: 1.5 }`,
после чего проверяется только кнопка «Сбросить к 100 %». Поле `#space-card-font`
— это как раз настоящий `rangeLine()` (`src/editors/space-form.ts:427-431`,
`min:50, max:300, step:5`, число коммитит на `onChange`, см. `form-kit.ts:479-487`)
— то есть ровно тот же класс поля, который сломался в #608. Если бы `commit`-семантика
`rangeLine` сломалась именно для этого экземпляра, `smoke_space_settings_form`
никак не заметил бы: он не проходит через DOM-обработчик, который сломался.

Файл `scripts/smoke-links.mjs` сам формулирует требование к своим записям
(шапка файла, строки 10-15): «Каждая запись обязана объяснять, ЧТО именно
проверяет смок — иначе реестр превращается в список суеверий, который никто
не решается почистить». Эта запись именно так и врёт: она обещает DOM-покрытие
третьего смока, которого нет. Практический риск смягчён тем, что диапазон
`50/300/5` у `space.card-font` совпадает с `room-name-scale`/`room-label-scale`,
уже покрытыми смоком `smoke_room_settings_form`, — но именно поэтому вредно и
дальше опираться на неверный текст: он создаёт иллюзию третьей независимой
проверки там, где её нет, и следующий, кто аудирует реестр (как в #234), потратит
цикл на то же самое расследование, которое я проделал сейчас.

**Воспроизведение**: `demo/smoke_space_settings_form.mjs:132-141` — нет
`dispatchEvent` на `#space-card-font`.

**Как чинить (любое из двух, решает автор)**:
- либо убрать `smoke_space_settings_form.mjs` из этой записи и оставить два
  реально DOM-управляемых смока;
- либо дописать в `smoke_space_settings_form.mjs` DOM-коммит на
  `#space-card-font` (input+change, как в остальных двух смоках) и тогда текст
  записи станет верным.

Medium, в скоупе — задача именно про честность `smoke-links.mjs` для
range-line/unitInput; без High это жёлтый вердикт, отдельный issue не заводится.

## Что проверено и корректно

- Оба фикса (`smoke_room_settings_form.mjs:133`,
  `smoke_device_settings_form.mjs:102,144,145`) добавляют `change` ровно на
  тех полях, что реально используют `rangeLine()` и коммитят по `change` —
  подтверждено чтением исходников формы и воспроизведением падения/починки.
- `commit`-хелпер в `smoke_device_settings_form.mjs:25` и уже существовавший
  `change`-хелпер в `smoke_room_settings_form.mjs:23` (не добавлен этим
  диффом, был в файле раньше) корректно шлют `input` затем `change` —
  соответствует контракту `rangeLine` (`onInput` для числа — no-op, коммит
  на `onChange`).
- Соседние поля той же формы (`unitInput` без `rangeLine`) фиксом не тронуты
  — верно, у них коммит на `input` не менялся.
- Трейлеры обоих коммитов: `Issue: #639`, `User-Visible: no` — верно, правка
  не меняет видимое поведение карточки; изменений в user-facing changelog не
  требуется и не делалось.
- `test/smoke-select.test.mjs` зелёный (7/7), включая структурную проверку
  новой записи реестра (существование файлов/символов).
- Второй комментарий в issue объяснил и закрыл красный Validate на
  `71e8dc29` как инфраструктурный шум (несинхронный мердж #636 между `main`/
  `dev` на preflight), не имеющий отношения к коду ветки — согласуется с
  тем, что preflight сверяет `process.yml`/`mutation-gate.yml` между ветками,
  а не диффом задачи; отдельно перепроверять эту причину не требовалось.

## Чего не проверял и почему

- `npx tsc --noEmit`, `npm test`, `npm run build` (сверка 3 копий бандла) —
  не перегонял: зелёный Validate уже есть на этом SHA (run 35829479664),
  а дельта тестовая, не продуктовая.
- `node scripts/check-docs.mjs` — не запускал: `src/**` не тронут.
- `npm run invariants` — не запускал: диф не трогает геометрию/`layout`/
  толщины/`marker.space`/`open_spans`.
- `npm run golden:verify` — не запускал: диф не может изменить рендер (это
  событийная семантика smoke-теста, не код карточки).
- `python -m pytest tests_backend` — не запускал: `custom_components/**/*.py`
  не тронут.
- Остальные 259 смоков из `demo/smoke_*.mjs`, не поднятые ни автором, ни
  `smoke-select` — не гонял: диф не трогает исполняемый фронтенд, темы не
  пересекаются.
- Perf-профили — не запускал: не названы в задаче, дифф не затрагивает
  чувствительные к перфу пути.

## Вывод

Основная причинно-следственная цепочка разобрана верно, фикс двух гардов
точен и проверен на умение падать. Единственная находка — Medium, в скоупе:
новая запись реестра для `smoke_space_settings_form.mjs` заявляет DOM-проверку,
которой в файле нет. Практический риск снижен перекрытием с
`smoke_room_settings_form`, но запись должна быть либо исправлена, либо
урезана до двух реально DOM-управляемых смоков — это именно тот класс ошибки,
против которого сам файл предупреждает в своей шапке.

**Вердикт: жёлтый.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/639-range-line-smokes`, коммит `0ac08434b5cd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f7de276fa6df89e7f8b53499143a2ff0905e2f9a`
  ```
  git log --all --format='%H %T' | grep f7de276fa6df
  ```
- Тело issue: `7ad41f5686d99bfd44e274349b50adaec808bc8169c0e0ea2f31df52671bf0b3`
- Вердикт конвейера: `yellow` · High 0
