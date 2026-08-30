# CODE-REVIEW-391-r2

Issue: #391 «Ещё 26 as any на ключах i18n в device inbox (и рядом marker/gs) — тот же паттерн, что #390»
Этап: code (S7-code-review)
Заход: r2 · блокирующих циклов израсходовано 1 из 2 (израсходован жёлтым вердиктом r1)
Ветка: `issue/391-i18n-key-casts`
SHA под ревью: `c3f38654f6833d95e3299393afad8084652e2bb8`
Материал: `git diff origin/dev...HEAD`, `origin/dev` = `a3dcee52418e41ee698089910731ce0101492a24`.

## Почему разбор полный, а не только по находке M1

Между r1 и r2 ветка сменила базу: r1 разбирал SHA `81a4278a`, привязанный к
`origin/dev = eb5aa2a0`; сейчас `origin/dev = a3dcee52` — на один коммит
дальше (`ci: move the harness to the current Home Assistant`, #392,
класс B: `.github/workflows/{mutation-gate,validate}.yml`,
`tests_backend/requirements.txt`). Это ребейз на ушедший вперёд `dev`, а
инструкция раунда прямо называет такой ребейз триггером полного разбора
(«после ребейза это другой код», PROCESS.md §7.2) — независимо от того,
пересекается ли новый коммит dev с файлами задачи.

Проверил пересечение и содержимое, а не только факт ребейза:
`a3dcee52` не касается ни одного файла этой задачи (`src/**`,
`docs/images/**`, `scripts/mutation-gate.mjs`, `dist/**`,
`custom_components/houseplan/frontend/**`); прямое построчное сравнение
диффа `3bbc65aa` (продуктовый коммит после ребейза) с фрагментами, которые
r1 цитировал (строки 7746, 9766, 11772, 11979, 12043, 12252, 12408, 12596,
13098 в текущем файле), показывает тот же самый текст патча — ребейз не
переписал ни одну правку. Поэтому разбор ниже полный по всем AC (гейты
прогнаны заново), но выводы r1 о построчной верности диффа переиспользованы
там, где я сам подтвердил их идентичность чтением, а не поверил на слово.

## Скоуп (без изменений к r1)

Класс A: `src/houseplan-editor-runtime.ts` — снятие `as any` с 33 вызовов
`this.host._t(...)` в трёх семействах ключей (`device_inbox.*` — 26,
`marker.*` — 6, `gs.preflight_reason_*` — 1); вычисляемые ключи — `as
I18nKey`; литеральные — без каста.
Класс B: `scripts/mutation-gate.mjs` — перенос mutation-anchor #295
(`preflight-reason-lost-in-dialog`) на `src/houseplan-editor-runtime.ts` /
строгую сигнатуру `_t`, `guard`/`because` не менялись.
Класс C: `docs/images/screenshots.json` — новый коммит `7ae0f14d`,
закрывающий находку M1 из r1 (см. таблицу ниже).
Класс D: `dist/**`, `custom_components/houseplan/frontend/**`,
`demo/srv/assets/**` — пересборка.
`User-Visible: no` на всех трёх коммитах (`3bbc65aa`, `7ae0f14d`,
`c3f38654`), трейлер `Issue: #391` на месте — оба верны: чистый типовой
рефакторинг плюс служебный манифест скриншотов, видимого пользователю
эффекта нет, changelog не требуется и не тронут.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе) — `node scripts/check-docs.mjs` красный: закоммиченный `sourceFingerprint` (`d27cbb20…`) устарел относительно текущего `src/**` (`74378a15…`), докапчур не выполнялся | Коммит `7ae0f14d` заменяет ровно 11 полей в `docs/images/screenshots.json`: 1×`sourceFingerprint` (манифест) + 10×`sourceSha256` (по одному на сценарий), оба `d27cbb20…` → `74378a15…`; `imageSha256` каждого из 10 сценариев и сам PNG-набор не тронуты (`git diff --stat` по `docs/images/` показывает только `screenshots.json`, без бинарников) | Перепрогнал `node scripts/check-docs.mjs` на текущем SHA сам — `Documentation checks passed (7 files, 10 external links)`. Скрипт не просто читает поле: строка 134 пересчитывает `visualFingerprint(ROOT)` и сверяет с манифестом, строка 145 пересчитывает `sha256` каждого PNG с диска и сверяет с `imageSha256`, строка 147 сверяет `sourceSha256` сценария с `sourceFingerprint` манифеста — все три проверки прошли на живом дереве, это не заявление автора |

## Как проверялось (гейты прогнаны заново на `c3f38654`)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | pass, без вывода |
| Unit/integration | `npm test` | 1644 pass / 0 fail / 1 skipped — совпадает с отчётом автора |
| No-new-any (#342) | `git diff origin/dev...HEAD -- src/houseplan-editor-runtime.ts \| node scripts/no-new-any.mjs --diff -` | «Проверено добавленных строк: 32 в 1 файл(ах). Новых any нет.» |
| Mutation-gate (#295/#332) | `node --test test/mutation-gate.test.mjs` | 10/10 pass |
| Build | `npm run build` | pass |
| Bundle sync | `npm run bundle:sync` | pass; `git status --porcelain` после — пусто (обе generated-копии побайтово совпадают с закоммиченными) |
| Bundle budget | `npm run bundle:budget` | initial View 283100 B / budget 300000 B; lazy editor 143903 B; lazy locale 46996 B — совпадает с числами автора и с r1 |
| Docs fingerprint | `node scripts/check-docs.mjs` | pass (7 files, 10 external links) — см. таблицу закрытия M1 |
| Inventory | `npm run inventory` | Node 1645, pure backend 221, HA-harness 154, browser smokes 208 — совпадает с отчётом автора, расхождение r1 (1643 vs 1645) объяснялось несвязанным коммитом `eb5aa2a0` и здесь уже не проявляется |

Diff не трогает геометрию/модель (нет правок толщины стен, `layout`,
`marker.space`, `open_spans`, узлов/рёбер решётки) — `npm run invariants`
не запускался, решение не изменилось относительно r1.
Diff не трогает `custom_components/**/*.py` — `pytest tests_backend` не
запускался.
`golden:verify` не запускался: правка src — чистое удаление/сужение
TypeScript-каста, стирается на компиляции; докс-манифест меняет только
хранимые хэши, не сами кадры (подтверждено самим `check-docs.mjs`, а не
только рассуждением).

### Браузерные смоки

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` на этом SHA
выдал ту же выборку, что и на r1 (ожидаемо: `src/**`-часть диффа
байт-в-байт та же, база сместилась только по несвязанным CI-файлам):

```
Изменено файлов src/**: 1 · символов проекта на изменённых строках: 4
Прямое совпадение (7): _showToast →
  smoke_help_affordance, smoke_junction_limits,
  smoke_optimize_coordinate_canonicalization, smoke_partition_openings,
  smoke_room_resize, smoke_tap_ctx, smoke_zero_wall_migration_unblocked
```

Решение: эти 7 не перегонял повторно — унаследовал из r1 (см. раздел
ниже), содержимое диффа, которое их выбрало, идентично проверенному в r1
(символ `_showToast` на той же строке, механическая связь, не поведенческая).
Отдельно перегнал сам, свежо на этом SHA:
`node demo/smoke_preflight_diagnostics.mjs` — это guard-команда
mutation-anchor `preflight-reason-lost-in-dialog`, который правит diff
напрямую (не механическая связь, а прямое совпадение с `guard` в
`scripts/mutation-gate.mjs:3258-3259`) — результат `OK`. Полный набор
(208 смоков) не запускался — не оправдано ни AC, ни объёмом дельты между
раундами (один файл манифеста скриншотов плюс несвязанный CI-коммит в
базе).

## Что проверено и корректно (реверифицировано на этом SHA, не унаследовано молча)

- Прочитан целиком дифф `3bbc65aa` (продуктовый коммит после ребейза) по
  файлу `src/houseplan-editor-runtime.ts` — все 9 изменённых мест
  (`_setInboxHidden`, `_renderAlignDialog`, `_renderDevicesBar`,
  `_renderDeviceInbox` ×2 блока, `_toggleHintLines`,
  `_valueBadgeCandidateLabel`, `_renderMarkerDialog` ×2) текстуально
  совпадают с тем, что цитировал r1 — ребейз не исказил ни одну правку.
- `grep -n "as any" src/houseplan-editor-runtime.ts`, отфильтрованный по
  `device_inbox\.|marker\.|gs\.preflight_reason_`, — пусто: ни одного
  каста этих трёх семейств не осталось.
- Условный `readd`/`add` — литеральный union без каста на каждой ветке
  (`row.category === 'readd' ? 'device_inbox.readd' : 'device_inbox.add'`,
  без `as any` вообще) — подтверждено чтением и тем, что `tsc --noEmit`
  зелёный без ослаблений типов.
- `scripts/mutation-gate.mjs`: анchor `preflight-reason-lost-in-dialog`
  ссылается на `src/houseplan-editor-runtime.ts` и строку с `as I18nKey`
  (не `as any`), `guard`/`because` не изменены — подтверждено чтением
  `scripts/mutation-gate.mjs:3254-3266` и зелёным
  `node demo/smoke_preflight_diagnostics.mjs`.
- Generated bundle (класс D) синхронизирован и совпадает побайтово после
  `npm run build && npm run bundle:sync` — `git status` пуст.
- Трейлеры всех трёх коммитов раунда (`3bbc65aa`, `7ae0f14d`, `c3f38654`)
  корректны: `Issue: #391`, `User-Visible: no`; changelog оправданно не
  тронут ни в одном.
- M1 закрыта проверяемо, не на слово: см. таблицу «Закрытие раунда r1».

## Унаследовано из r1

Документ: `docs/reviews/CODE-REVIEW-391-r1.md`, SHA `81a4278a`
(зафиксирован в шапке того документа; на момент этого раунда сам SHA
недостижим в дереве — ветка ушла дальше по истории, но диффу это не
мешает: содержимое сверено текстуально, см. раздел выше).

Принято без повторной проверки в этом раунде:

- построчный пересчёт всех 33 целевых `as any` до правки и подтверждение,
  что ни один каст `tap.*`, `fill.*`, `decor.*`, `junction.*`, `vac.*`,
  `run.*` и generic `message`/`hintKey`/`labelKey` не тронут — r1 сверял
  это по полному диффу, который в r2 текстуально идентичен (см. «Что
  проверено» выше), пересчитывать заново нечего;
- 7 «прямых совпадений» браузерных смоков
  (`smoke_help_affordance`, `smoke_junction_limits`,
  `smoke_optimize_coordinate_canonicalization`, `smoke_partition_openings`,
  `smoke_room_resize`, `smoke_tap_ctx`,
  `smoke_zero_wall_migration_unblocked`) — прогнаны в r1 (8/8 OK вместе с
  guard-смоком), диффа, который их выбрал, в r2 не изменился;
- решение не гонять `npm run invariants`, `pytest tests_backend`,
  `golden:verify` и полный набор из 208 смоков — основания (diff не
  касается геометрии/`.py`/рендера, объём не сопоставим с полным набором)
  не изменились между раундами;
- оценка двух «нечистых» вычисляемых ключей
  (`marker.value_badge_attr_${source.attribute}`, `.replace()`/
  `.replaceAll()`) как принятого риска, а не новой находки — тот же
  профиль был под `as any` до задачи, ТЗ разрешает `as I18nKey` как
  единственный доступный вариант.

## Чего не проверял и почему

- `npm run invariants` — diff не касается геометрии/модели.
- `python -m pytest tests_backend` — diff не касается
  `custom_components/**/*.py`.
- `npm run golden:verify` — подтверждено самим `check-docs.mjs`
  (сверка `imageSha256` с диска), что кадры не изменились; полный
  golden-прогон был бы дороже без нового вопроса, на который надо
  ответить.
- 7 из 8 браузерных смоков (кроме guard-смока) — не перегонял повторно,
  унаследованы из r1 (см. раздел выше), диффа, который их выбрал, между
  раундами не изменился.
- Полный набор из 208 браузерных смоков — не оправдано ни AC, ни объёмом
  дельты между раундами.
- Performance-профили — не названы в AC, diff не касается чувствительных
  к перфу путей.
- Ручное тестирование в браузере (UI) — не требуется: изменение не может
  изменить скомпилированную семантику (стирание типовых кастов), докс-
  манифест не меняет кадры (подтверждено `check-docs.mjs`).

## Вердикт

Единственная находка r1 (M1) закрыта проверяемо — `check-docs.mjs`
пересчитывает и фингерпринт, и хэш каждого сохранённого PNG, и оба
совпадают на этом SHA, а не только на слово автора. Ребейз на ушедший
вперёд `dev` не задел ни один файл задачи и не исказил ни одну правку
(проверено текстуальным сравнением). Все дешёвые гейты зелены и совпадают
с отчётом автора. Новых находок нет. Все AC из тела issue выполнены и
подтверждены тестом либо построчным чтением с явной пометкой «проверено
чтением, не исполнением». Вердикт — зелёный.
