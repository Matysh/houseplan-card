# CODE-REVIEW-875-r3

Issue: #875 · Этап: code · Заход: r3 · Трек: ask · Блокирующих циклов израсходовано: 1/4 до этого вердикта

Материал: ветка `issue/875-empty-backup-import`, HEAD `559a07b6fe5b2ba62b015528bb070fdea4fde6e7`
(база `origin/dev` = `374dd219120b656ae8ed8f633a433f843ef2611d`). Рабочая копия — ровно этот SHA,
без локальных изменений.

## Скоуп раунда

r3 открыт не новой находкой ревью, а интеграционным событием: после зелёного r2
(`CODE-REVIEW-875-r2.md`, High0/Medium0) `dev` продвинулся на 11 коммитов, и
проверка кандидата на слияние (Validate run `38460080848`, коммит `6dbcaa5e`) упала на
ratchet-гейте монолита — измеренный `bundleBytes` рабочего дерева (`2825073`) разошёлся с
закреплённым `scripts/monolith-baseline.json` (`2820780`) больше чем на полосу 2000 Б. Это
ожидаемое поведение гейта при чужом росте `dev`, а не новый продуктовый дефект (PROCESS §2.10:
при конфликте baseline ребейз берёт dev).

Единственный коммит дельты к r2 — `559a07b6` «chore: record integrated empty-import bundle
size (#875)»:

```
scripts/monolith-baseline.json | 2 +-
1 file changed, 1 insertion(+), 1 deletion(-)
-  "bundleBytes": 2820780
+  "bundleBytes": 2825073
```

Весь остальной диапазон `origin/dev..HEAD` (`9f804a6f`, `18fbf6d2`, `a1d6b899`, `536304d5`,
`a10dc21f`, `6dbcaa5e`) — это сама фича #875, фикс M1 из r1 и автоматически публикуемые
ревью-документы/индекс; содержимое этих коммитов не изменилось с момента зелёного r2 (см.
«Унаследовано из r2»). Продуктовый код, тесты, i18n, UX и документация пользователя этим
раундом не тронуты — только учётное число ratchet-гейта.

Риск по изменённым участкам (#707), заявленный конвейером: новый i18n-ключ
`empty.import_backup` в `de/en/fr/ru`. Эта дельта i18n-файлы не трогает (последний коммит,
менявший их, — `9f804a6f`, часть r1/r2 материала). Покрытие — AC6 ТЗ («EN/RU/DE/FR подпись
правильная…»), уже подтверждено независимым ревью r1 (`CODE-REVIEW-875-r1.md`: «i18n-ключ
`empty.import_backup` в de/en/fr/ru — покрыт AC6… расхождений не найдено») и не затронуто
последующими раундами. Перечитал значения всех четырёх файлов заново (ниже) — совпадают
с ТЗ §8 и с r1.

## Как проверялось

| Гейт | Команда/источник | Результат |
|---|---|---|
| Дешёвые гейты (typecheck, `npm test`, `npm run build` + `bundle-policy --verify`) | Validate run [`38466257798`](https://github.com/Matysh/houseplan-card/actions/runs/38466257798) на точном SHA `559a07b6` (проверено `gh run view` — `headSha` совпадает, `conclusion: success`) | GREEN, не перегонялись локально (#343) |
| Содержимое дельты | `git show 559a07b6` | подтверждено: ровно одно число в одном сгенерированном файле |
| M1 (r1→r2) всё ещё закрыт | `git show 536304d5 -- src/houseplan-card.ts` построчно сверен с описанием фикса в `CODE-REVIEW-875-r2.md` | обе проверки `_openSpaceDialog` (`houseplan-card.ts:9724`, `:9731` на этом SHA) по-прежнему содержат `this._model.length === 0`; текст диффа идентичен тому, что r2 проверял на недостижимом теперь `dd2e3f08` (ребейз сменил SHA, не содержимое — #312) |
| i18n-риск по #707 | прочитаны `src/i18n/{en,ru,de,fr}.json:86` | `Import backup` / `Импорт резервной копии` / `Sicherung importieren` / `Importer une sauvegarde` — совпадает с ТЗ §8 |
| Соответствие прецеденту для bundleBytes-only коммитов | `git log -p -- scripts/monolith-baseline.json` (`4bc85adb`, `fed1c377`) | та же форма: один файл, `User-Visible: no`, без Release-трейлера — `scripts/monolith-baseline.json` не подпадает под правило «committed bundle»/golden baselines (AGENTS.md), это сгенерированный ratchet-референс, не `dist/` |
| Трейлеры | `git show -s --format=%B 559a07b6` | `Issue: #875`, `User-Visible: no` — верно: число не видно пользователю, продуктового/UX-изменения нет, changelog не требуется |

## Находки

Блокирующих находок нет.

**L1 (Low, снято ревьюером).** `docs/DEVELOPMENT.md:74` всё ещё читает «The raw bundle
baseline records the measured 2819806 B» — это число из прошлого ребейза (`dev 75aafe0f`,
коммит `536304d5`), а не из текущего закреплённого `2825073`. Разрыв (5267 Б) больше полосы
2000 Б. Формально — второй источник того же числа разошёлся. Не поднимаю до Medium: абзац
явно привязан к историческому событию («After rebasing onto dev `75aafe0f`…») и описывает
факт того ребейза, а не текущее состояние; прецедентные bundleBytes-only коммиты (`4bc85adb`,
`fed1c377`) тоже не трогают прозу DEVELOPMENT.md при повторных ребейзах — это установленная
практика проекта, не новый дефект этого коммита. Единственный источник, который гейт
действительно читает и на который опирается ratchet-проверка, — `scripts/monolith-baseline.json`,
и он актуален (подтверждено зелёным Validate на этом SHA). Решение: оставить без действия,
записано для прозрачности.

## Закрытие раунда r2

r2 был зелёным (High 0, Medium 0) — закрывать нечего, таблица пуста по построению.

## Унаследовано из r2 (не проверялось заново — материал не менялся)

Весь функционал #875 — новая кнопка/вход, `BackupImportIntent`, lazy-load в пределах user
activation, ACL/kiosk recheck, epoch-ownership против поздних ответов, взаимное исключение
с onboarding и (после фикса M1) с непустым Add space, i18n, узкая раскладка/фокус, AC1–AC7 —
принято без повторной проверки по документам:

- `docs/reviews/CODE-REVIEW-875-r1.md` (жёлтый, M1) — материал `528f30c1`;
- `docs/reviews/CODE-REVIEW-875-r2.md` (зелёный, 0/0) — материал `dd2e3f08` (дерево
  `861a70e8`); SHA `dd2e3f08` не резолвится в текущей истории (ушёл под ребейз на
  `374dd219` вместе с ещё 11 коммитами dev) — это штатный случай «SHA не резолвится»
  (#312/§2.10), не находка: содержимое проверено по дереву — `git show 536304d5` (тот же
  логический коммит после ребейза) побайтово совпадает с диффом, который описывает
  `CODE-REVIEW-875-r2.md` для `_openSpaceDialog`.

Основание переноса: диапазон `origin/dev..HEAD` между r2 и r3 добавляет только
документ-публикующие коммиты (`a10dc21f` — сам текст `CODE-REVIEW-875-r2.md`, `6dbcaa5e` —
перегенерированный `docs/reviews/INDEX.md`) и один учётный коммит `559a07b6`; ни один из
трёх не трогает `src/**`, `demo/**`, `test/**`, i18n или пользовательскую документацию.

## Что проверено и корректно

- Единственная продуктовая правка в материале r3 — ноль: дельта раунда ограничена одним
  числом в `scripts/monolith-baseline.json`, подтверждено построчным диффом.
- M1 из r1 по-прежнему исправлен корректно и симметрично в обеих ветках
  `_openSpaceDialog` (прямая проверка и колбэк `_ensureOnboardingRuntime().then(...)`).
- Трейлеры коммита `559a07b6` верны для его класса изменений (Class D, не `dist/`,
  не golden-baseline) и соответствуют двум прямым прецедентам в той же кодовой базе.
- i18n-ключ `empty.import_backup` остаётся правильным по всем четырём языкам — перепроверено
  чтением файлов на этом SHA, не только унаследовано из r1.
- Независимый Validate (дешёвые гейты) зелёный ровно на материале ревью `559a07b6`, что и
  было целью всего раунда r3 (чинили именно этот интеграционный провал).

## Чего не проверял

- Не перегонял `npx tsc --noEmit`, `npm test`, `npm run build`/`bundle-policy --verify`
  локально — зелёный Validate подтверждён на точном SHA материала (#343), независимо
  сверен через `gh run view` (headSha совпадает).
- Не перегонял ни один browser-smoke (`smoke_empty_backup_import`, `smoke_backup_transfer`,
  `smoke_post_write_adoption`, `smoke_lazy_editor_chunk`, `smoke_warm_dialogs`,
  `smoke_help_affordance`, `smoke_orphan_space_references`) — все уже исполнялись и были
  зелёными в r2 на тождественном по содержимому дереве (дифф через ребейз не менялся), а
  дельта r3 не затрагивает ни один файл, который эти smoke читают.
- Не гонял `mutation-gate.mjs`/мутанты — не входит в объём ревью в разработке (#709), и этот
  раунд не меняет ни один guard.
- Не гонял `ci:golden`, performance capture, `pytest tests_backend`, инварианты модели —
  AC #875 их не называют, геометрия/Python/рендер плана не менялись ни в фиче, ни в этой
  дельте.
- Не проверял реальный Home Assistant backend/atomic-CAS — вне скоупа ТЗ §4 и не менялось
  этим раундом; это ограничение фиксировалось ещё в r1/r2.
- Не стал поднимать до находки устаревшее число в `docs/DEVELOPMENT.md:74` (L1 выше) — решение
  обосновано в разделе «Находки».

## Вывод

Делта r3 — ровно то, чем она заявлена: учётная синхронизация ratchet-baseline после того, как
`dev` ушёл вперёд во время зелёного r2. Продуктовый код, ТЗ, AC и фикс M1 не изменились и не
требуют повторной проверки за пределами подтверждения, что они пережили ребейз байт-в-байт.
Блокирующих находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/875-empty-backup-import`, коммит `559a07b6fe5b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `08b1b5e2566a3052606b81f4f551220bbc2d9279`
  ```
  git log --all --format='%H %T' | grep 08b1b5e2566a
  ```
- Тело issue: `05c4527700d2e56574ffda517eb387f6d66067b51ff590461d0de7673ff2b6c3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MjksIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTM5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozOCwib3V0cHV0X3Rva2VucyI6MjkyOTcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTA1OTY3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTY0NjE1OCwiY29zdFVzZEVzdGltYXRlIjoxLjA0NjE0NTZ9XSwidHVybnMiOjMyLCJkdXJhdGlvbk1zIjozNTczOTcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjA1MDY4NDYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4467 output_tokens=29319 cache_creation_input_tokens=105967 cache_read_input_tokens=1646158 num_turns=32 -->
